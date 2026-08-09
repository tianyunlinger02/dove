#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { confirm } from "@inquirer/prompts";

import { parseDoveCli } from "../src/cli/command-parser.mjs";
import { renderDoveDoctor } from "../src/cli/doctor-output.mjs";
import { renderProjectIntegrationResult } from "../src/cli/project-integration-output.mjs";
import {
  renderCompleteReinstallInventory,
  renderDoveHome,
  renderDoveLifecycleResult,
  terminalColorEnabled
} from "../src/cli/terminal-output.mjs";
import { userPromptSubmitOutput } from "../src/core/ambient-hook.mjs";
import { completeReinstallDoveLifecycle, upgradeDoveLifecycle } from "../src/core/dove-lifecycle.mjs";
import { PROJECT_HOST_IDS } from "../src/core/host-registry.mjs";
import { inspectProjectDoctor } from "../src/core/project-doctor.mjs";
import { initializeProjectIntegration, syncProjectIntegration } from "../src/core/project-installation.mjs";
import { readProjectInstallationManifest } from "../src/core/project-installation-manifest.mjs";
import { resolveInstalledProjectRoot, resolveProjectRootForInit } from "../src/core/project-root.mjs";
import { startServer } from "../src/mcp/server.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const PACKAGE = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"));
const PACKAGE_OPTIONS = { packageName: PACKAGE.name, packageVersion: PACKAGE.version };
const KNOWN_COMMANDS = new Set(["init", "sync", "upgrade", "reinstall", "doctor", "mcp", "hook"]);

function usage() {
  console.log(`dove

Usage:
  dove --help
  dove --version
  dove init [--project <dir>] [--host <host>...] [--json|--format json]
  dove sync [--project <dir>] [--host <host>...] [--json|--format json]
  dove upgrade [--project <dir>] [--json|--format json]
  dove reinstall [--project <dir>] [--json|--format json]
  dove doctor [--project <dir>] [--json|--format json]
  dove mcp serve --project <dir>
  dove hook user-prompt-submit --project <dir>

The runtime CLI manages project integration, diagnostics, MCP serving, and the Claude prompt hook. Research work uses the nine host Skills and eight public Dove MCP tools. Project setup never initializes a Research Workspace or creates a Mission.
`);
}

function readFlagValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : null;
}

function readFlagValues(args, flag) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && index + 1 < args.length) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

function projectFlag(args) {
  return readFlagValue(args, "--project") ?? undefined;
}

function selectedHosts(args) {
  const raw = readFlagValues(args, "--host");
  if (raw.length === 0) return undefined;
  const requested = raw.flatMap((value) => value.split(",").map((item) => item.trim()).filter(Boolean));
  return [...new Set(requested.includes("all") ? PROJECT_HOST_IDS : requested)];
}

function wantsJson(args) {
  return args.includes("--json") || readFlagValue(args, "--format") === "json";
}

function integrationResult(result) {
  const { manifest, ...publicFields } = result;
  return publicFields;
}

function writeIntegrationResult(command, result, args) {
  if (wantsJson(args)) console.log(JSON.stringify(result, null, 2));
  else console.log(renderProjectIntegrationResult(command, result, { stream: process.stdout, env: process.env }));
}

function writeLifecycleResult(command, result, args) {
  if (wantsJson(args)) console.log(JSON.stringify(integrationResult(result), null, 2));
  else console.log(renderDoveLifecycleResult(command, result, { stream: process.stdout, env: process.env }));
}

function operationalFailure(error, args = []) {
  const message = error instanceof Error ? error.message : String(error);
  if (wantsJson(args)) console.error(JSON.stringify({ status: "blocked", message }, null, 2));
  else console.error(message);
}

function inspect(target) {
  return inspectProjectDoctor(target, {
    ...PACKAGE_OPTIONS,
    packageRoot: PACKAGE_ROOT,
    executablePath: __filename,
    claudeCommand: process.env.DOVE_CLAUDE_COMMAND || "claude"
  });
}

function assertClaudeInstalled(root) {
  const manifest = readProjectInstallationManifest(root, { hostIds: PROJECT_HOST_IDS });
  if (!manifest.hosts.includes("claude")) throw new Error("Dove project runtime requires Claude host integration. Run dove init --host claude for this project.");
}

async function readStdin() {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

let parsed;
try {
  parsed = parseDoveCli(process.argv.slice(2));
} catch (error) {
  operationalFailure(error, process.argv.slice(2));
  process.exit(1);
}

const command = parsed.command;
const args = parsed.args;
if (!command) {
  let projectInitialized = false;
  try {
    resolveInstalledProjectRoot(process.cwd());
    projectInitialized = true;
  } catch {
    projectInitialized = false;
  }
  console.log(renderDoveHome({ stream: process.stdout, env: process.env, projectInitialized }));
  process.exit(0);
}
if (command === "--help") {
  usage();
  process.exit(0);
}
if (command === "--version") {
  console.log(PACKAGE.version);
  process.exit(0);
}
if (!KNOWN_COMMANDS.has(command)) {
  usage();
  process.exit(1);
}

try {
  if (command === "init") {
    const requestedProject = projectFlag(args);
    let target;
    try {
      target = resolveProjectRootForInit(requestedProject, { cwd: process.cwd(), hostIds: PROJECT_HOST_IDS });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("Dove project integration is already initialized at")) throw error;
      target = resolveInstalledProjectRoot(requestedProject ?? process.cwd());
      const manifest = readProjectInstallationManifest(target, { hostIds: PROJECT_HOST_IDS });
      const requestedHosts = selectedHosts(args);
      if (requestedHosts !== undefined && JSON.stringify([...requestedHosts].sort()) !== JSON.stringify([...manifest.hosts].sort())) {
        throw new Error("Dove is already initialized with a different host selection. Use dove sync --host <host> to change it.");
      }
      writeIntegrationResult("init", {
        status: "already-initialized",
        target,
        hosts: [...manifest.hosts],
        writtenPaths: [],
        removedPaths: [],
        changedPaths: [],
        transactionState: null
      }, args);
      process.exit(0);
    }
    const result = initializeProjectIntegration(target, { ...PACKAGE_OPTIONS, hosts: selectedHosts(args) });
    writeIntegrationResult("init", integrationResult(result), args);
    process.exit(0);
  }

  if (command === "sync") {
    const result = syncProjectIntegration(projectFlag(args) ?? process.cwd(), { ...PACKAGE_OPTIONS, hosts: selectedHosts(args) });
    writeIntegrationResult("sync", integrationResult(result), args);
    process.exit(0);
  }

  if (command === "upgrade") {
    const result = upgradeDoveLifecycle(projectFlag(args) ?? process.cwd(), PACKAGE_OPTIONS);
    writeLifecycleResult("upgrade", result, args);
    process.exit(0);
  }

  if (command === "reinstall") {
    const target = path.resolve(projectFlag(args) ?? process.cwd());
    const color = terminalColorEnabled(process.stdout, process.env);
    process.stdout.write(`${renderCompleteReinstallInventory(target, { color })}\n\n`);
    const approved = await confirm({
      message: "警告：这会永久删除当前项目中的全部 Dove 配置、研究状态和旧归档。确认完全重新安装项目配置？",
      default: false
    });
    if (!approved) {
      if (wantsJson(args)) console.log(JSON.stringify({ status: "cancelled", zeroWrite: true }, null, 2));
      else console.log("未修改任何文件。");
      process.exit(0);
    }
    const result = completeReinstallDoveLifecycle(target, { ...PACKAGE_OPTIONS, confirmed: true });
    writeLifecycleResult("reinstall", result, args);
    process.exit(0);
  }

  if (command === "doctor") {
    const result = inspect(projectFlag(args) ?? process.cwd());
    if (wantsJson(args)) console.log(JSON.stringify(result, null, 2));
    else console.log(renderDoveDoctor(result, { stream: process.stdout, env: process.env }));
    process.exit(result.healthy ? 0 : 1);
  }

  if (command === "mcp") {
    if (parsed.positionals[0] !== "serve") throw new Error("dove mcp accepts only serve.");
    if (projectFlag(args) === undefined) throw new Error("dove mcp serve requires --project <dir>.");
    const target = resolveInstalledProjectRoot(projectFlag(args));
    assertClaudeInstalled(target);
    startServer(target);
    process.stdin.resume();
    await new Promise(() => {});
  }

  if (command === "hook") {
    if (parsed.positionals[0] !== "user-prompt-submit") throw new Error("dove hook accepts only user-prompt-submit.");
    if (projectFlag(args) === undefined) throw new Error("dove hook user-prompt-submit requires --project <dir>.");
    const target = resolveInstalledProjectRoot(projectFlag(args));
    assertClaudeInstalled(target);
    const output = userPromptSubmitOutput(await readStdin());
    if (output !== null) process.stdout.write(JSON.stringify(output));
    process.exit(0);
  }
} catch (error) {
  operationalFailure(error, args);
  process.exit(1);
}
