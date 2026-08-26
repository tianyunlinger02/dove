#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { confirm } from "@inquirer/prompts";

import { parseDoveCli } from "../src/cli/command-parser.mjs";
import { renderDoveDoctor } from "../src/cli/doctor-output.mjs";
import { runInteractiveDoveSetup } from "../src/cli/interactive-setup.mjs";
import { renderProjectIntegrationResult } from "../src/cli/project-integration-output.mjs";
import {
  isInteractiveTerminal,
  renderCompleteReinstallInventory,
  renderDoveHome,
  renderDoveLifecycleResult,
  renderUninstallInventory,
  terminalColorEnabled
} from "../src/cli/terminal-output.mjs";
import { parseUserPromptSubmitPayload, userPromptSubmitOutput } from "../src/core/ambient-hook.mjs";
import { parseSessionStartPayload, sessionStartOutput } from "../src/core/session-start-hook.mjs";
import { stopHookOutput } from "../src/core/stop-hook.mjs";
import { completeReinstallDoveLifecycle, previewUninstallDoveLifecycle, uninstallDoveLifecycle, updateDoveLifecycle } from "../src/core/dove-lifecycle.mjs";
import { exportResearch, previewResearchExport } from "../src/core/research-export.mjs";
import { PROJECT_HOST_IDS } from "../src/core/host-registry.mjs";
import { classifyPackageCompatibility, PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { inspectProjectDoctor } from "../src/core/project-doctor.mjs";
import { initializeProjectIntegration, inspectProjectIntegration, previewProjectCompleteReinstall, synchronizeProjectIntegrationOnly } from "../src/core/project-installation.mjs";
import { readProjectInstallationManifest } from "../src/core/project-installation-manifest.mjs";
import { resolveExactInstalledProjectRoot, resolveInstalledProjectRoot, resolveProjectRootForInit } from "../src/core/project-root.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const PACKAGE_OPTIONS = { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION };
const KNOWN_COMMANDS = new Set(["init", "update", "reinstall", "uninstall", "doctor", "export-research", "hook"]);

function usage() {
  console.log(`dove

Usage:
  dove --help
  dove --version
  dove init [--project <dir>] [--host <host>...] [--json|--format json]
  dove update [--project <dir>] [--host <host>...] [--json|--format json]
  dove reinstall [--project <dir>] [--json|--format json]
  dove uninstall [--project <dir>] [--json|--format json]
  dove doctor [--project <dir>] [--json|--format json]
  dove export-research [--project <dir>] [--json|--format json]
  dove hook session-start --project <dir>
  dove hook user-prompt-submit --project <dir>
  dove hook stop --project <dir>

The runtime CLI manages project integration, diagnostics, one-time legacy JSON research export, and Claude lifecycle hooks. Research work uses the Dove agent and ten host Skills with ordinary Markdown research documents. Project initialization creates the ordinary default research tree, but it does not create research progress, a Mission, or a scientific conclusion.
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

function inspect(target, options = {}) {
  return inspectProjectDoctor(target, {
    ...PACKAGE_OPTIONS,
    packageRoot: PACKAGE_ROOT,
    executablePath: __filename,
    claudeCommand: process.env.DOVE_CLAUDE_COMMAND || "claude",
    ...options
  });
}

function assertRecognizedHookManifest(manifest) {
  const compatibility = classifyPackageCompatibility(manifest.package, { name: PACKAGE_NAME, version: PACKAGE_VERSION });
  if (compatibility === "identity-mismatch") {
    throw new Error("Dove hook execution requires matching package identity. Run dove doctor --json before making changes.");
  }
  if (["newer", "invalid-version"].includes(compatibility)) {
    throw new Error("Dove hook execution refuses project integration from a newer or invalid package version. Run dove doctor --json before making changes.");
  }
  if (!manifest.hosts.includes("claude")) {
    throw new Error("Dove project hooks require Claude host integration. Run dove update --host claude for this project.");
  }
}

function prepareHookProject(project) {
  const target = resolveExactInstalledProjectRoot(project, { hostIds: PROJECT_HOST_IDS });
  const manifest = readProjectInstallationManifest(target, { hostIds: PROJECT_HOST_IDS });
  assertRecognizedHookManifest(manifest);
  return target;
}

function assertHookPayloadProject(payload, target) {
  if (payload?.cwd === undefined) return;
  if (typeof payload.cwd !== "string" || !payload.cwd.trim()) throw new Error("Dove hook cwd must name a directory in the initialized project.");
  const cwdRoot = resolveInstalledProjectRoot(payload.cwd, { hostIds: PROJECT_HOST_IDS });
  if (cwdRoot !== target) throw new Error("Dove hook cwd does not belong to the declared initialized project.");
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

function inspectHome(target) {
  return inspect(target);
}

function homeState(inspection) {
  if (inspection.setup?.mode === "init") return "uninitialized";
  if (inspection.setup?.mode === "update") return "needs-sync";
  if (inspection.projectIntegration?.state === "current") return "current";
  if (inspection.projectIntegration?.state === "needs-sync") return "needs-sync";
  return "blocked";
}

const command = parsed.command;
const args = parsed.args;
if (!command) {
  try {
    if (isInteractiveTerminal(process.stdin) && isInteractiveTerminal(process.stdout)) {
      await runInteractiveDoveSetup({
        target: process.cwd(),
        inspect: inspectHome,
        initialize: (target) => initializeProjectIntegration(target, PACKAGE_OPTIONS),
        update: (target) => updateDoveLifecycle(target, { ...PACKAGE_OPTIONS, inspect }),
        previewCompleteReinstall: (target) => previewProjectCompleteReinstall(target, PACKAGE_OPTIONS),
        completeReinstall: (target, lifecycleOptions) => completeReinstallDoveLifecycle(target, { ...PACKAGE_OPTIONS, ...lifecycleOptions }),
        previewUninstall: (target) => previewUninstallDoveLifecycle(target, PACKAGE_OPTIONS),
        uninstall: (target, lifecycleOptions) => uninstallDoveLifecycle(target, { ...PACKAGE_OPTIONS, ...lifecycleOptions }),
        stream: process.stdout,
        env: process.env
      });
    } else {
      const inspection = inspectHome(process.cwd());
      console.log(renderDoveHome({
        stream: process.stdout,
        env: process.env,
        state: homeState(inspection)
      }));
    }
    process.exit(0);
  } catch (error) {
    operationalFailure(error, args);
    process.exit(1);
  }
}
if (command === "--help") {
  usage();
  process.exit(0);
}
if (command === "--version") {
  console.log(PACKAGE_VERSION);
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
        throw new Error("Dove is already initialized with a different host selection. Use dove update --host <host> to change it.");
      }
      inspectProjectIntegration(target, PACKAGE_OPTIONS);
      writeIntegrationResult("init", {
        status: "already-initialized",
        target,
        hosts: [...manifest.hosts],
        writtenPaths: [],
        removedPaths: [],
        changedPaths: []
      }, args);
      process.exit(0);
    }
    const result = initializeProjectIntegration(target, { ...PACKAGE_OPTIONS, hosts: selectedHosts(args) });
    writeIntegrationResult("init", integrationResult(result), args);
    process.exit(0);
  }

  if (command === "update") {
    const target = projectFlag(args) ?? process.cwd();
    const result = updateDoveLifecycle(target, {
      ...PACKAGE_OPTIONS,
      hosts: selectedHosts(args),
      inspect
    });
    writeIntegrationResult("update", integrationResult(result), args);
    process.exit(0);
  }

  if (command === "reinstall") {
    const target = path.resolve(projectFlag(args) ?? process.cwd());
    if (wantsJson(args)) {
      const preview = previewProjectCompleteReinstall(target, PACKAGE_OPTIONS);
      const { manifest, ...publicPreview } = preview;
      console.log(JSON.stringify(publicPreview, null, 2));
      process.exit(0);
    }
    const color = terminalColorEnabled(process.stdout, process.env);
    const preview = previewProjectCompleteReinstall(target, PACKAGE_OPTIONS);
    process.stdout.write(`${renderCompleteReinstallInventory(preview, { color })}\n\n`);
    const approved = await confirm({
      message: "警告：这会永久删除当前项目中的全部 Dove 配置、研究状态和旧归档。确认完全重新安装项目配置？",
      default: false
    });
    if (!approved) {
      console.log("未修改任何文件。");
      process.exit(0);
    }
    const result = completeReinstallDoveLifecycle(target, { ...PACKAGE_OPTIONS, confirmed: true, preview });
    writeLifecycleResult("reinstall", result, args);
    process.exit(0);
  }

  if (command === "uninstall") {
    const target = path.resolve(projectFlag(args) ?? process.cwd());
    const preview = previewUninstallDoveLifecycle(target, PACKAGE_OPTIONS);
    if (wantsJson(args)) {
      console.log(JSON.stringify(preview, null, 2));
      process.exit(0);
    }
    const color = terminalColorEnabled(process.stdout, process.env);
    process.stdout.write(`${renderUninstallInventory(preview, { color })}\n\n`);
    const approved = await confirm({
      message: "确认从当前项目卸载 Dove？研究 Markdown 与 DOCTOR.md 会保留。",
      default: false
    });
    if (!approved) {
      console.log("未修改任何文件。");
      process.exit(0);
    }
    const result = uninstallDoveLifecycle(target, { ...PACKAGE_OPTIONS, confirmed: true, preview });
    writeLifecycleResult("uninstall", result, args);
    process.exit(0);
  }

  if (command === "doctor") {
    const result = inspect(projectFlag(args) ?? process.cwd());
    if (wantsJson(args)) console.log(JSON.stringify(result, null, 2));
    else console.log(renderDoveDoctor(result, { stream: process.stdout, env: process.env }));
    process.exit(result.ready ? 0 : 1);
  }

  if (command === "export-research") {
    const target = path.resolve(projectFlag(args) ?? process.cwd());
    const now = new Date();
    const preview = previewResearchExport(target, { now });
    if (wantsJson(args)) {
      const { plan, ...publicPreview } = preview;
      console.log(JSON.stringify({ ...publicPreview, confirmation: { required: true, default: false } }, null, 2));
      process.exit(0);
    }
    const approved = await confirm({
      message: `将旧版 JSON 科研记录导出为 Markdown，并把原始文件归档到 ${preview.archiveDirectory}。确认导出？`,
      default: false
    });
    if (!approved) {
      console.log("未修改任何文件。");
      process.exit(0);
    }
    const result = exportResearch(target, { confirmed: true, now });
    console.log(`研究记录已导出到 ${result.researchDirectory}；原始旧版 JSON 科研记录已归档到 ${result.archiveDirectory}。`);
    process.exit(0);
  }

  if (command === "hook") {
    const hookName = parsed.positionals[0];
    if (!["session-start", "user-prompt-submit", "stop"].includes(hookName)) throw new Error("dove hook accepts only session-start, user-prompt-submit, or stop.");
    if (projectFlag(args) === undefined) throw new Error(`dove hook ${hookName} requires --project <dir>.`);
    const input = await readStdin();
    const target = prepareHookProject(projectFlag(args));
    if (hookName === "stop") {
      const output = stopHookOutput(input);
      if (output !== null) process.stdout.write(JSON.stringify(output));
      process.exit(0);
    }
    const payload = hookName === "session-start" ? parseSessionStartPayload(input) : parseUserPromptSubmitPayload(input);
    assertHookPayloadProject(payload, target);
    if (hookName === "session-start") {
      sessionStartOutput(input);
      synchronizeProjectIntegrationOnly(target, PACKAGE_OPTIONS);
      process.exit(0);
    }
    synchronizeProjectIntegrationOnly(target, PACKAGE_OPTIONS);
    const output = userPromptSubmitOutput(input);
    if (output !== null) process.stdout.write(JSON.stringify(output));
    process.exit(0);
  }
} catch (error) {
  operationalFailure(error, args);
  process.exit(1);
}
