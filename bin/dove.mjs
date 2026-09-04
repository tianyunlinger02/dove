#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { confirm } from "@inquirer/prompts";

import { parseDoveCli } from "../src/cli/command-parser.mjs";
import { renderDoveDoctor } from "../src/cli/doctor-output.mjs";
import { renderDoveHelp } from "../src/cli/help-output.mjs";
import { runInteractiveDoveSetup } from "../src/cli/interactive-setup.mjs";
import { renderProjectIntegrationResult } from "../src/cli/project-integration-output.mjs";
import { renderReviewResult } from "../src/cli/review-output.mjs";
import { renderRunResult } from "../src/cli/run-output.mjs";
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
import { completeReinstallDoveLifecycle, previewUninstallDoveLifecycle, uninstallDoveLifecycle, updateDoveLifecycle } from "../src/core/dove-lifecycle.mjs";
import { PROJECT_HOST_IDS } from "../src/core/host-registry.mjs";
import { classifyPackageCompatibility, PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { inspectProjectDoctor } from "../src/core/project-doctor.mjs";
import { initializeProjectIntegration, inspectProjectIntegration, previewProjectCompleteReinstall, synchronizeProjectIntegrationOnly } from "../src/core/project-installation.mjs";
import { readProjectInstallationManifest } from "../src/core/project-installation-manifest.mjs";
import { resolveExactInstalledProjectRoot, resolveInstalledProjectRoot, resolveProjectRootForInit } from "../src/core/project-root.mjs";
import { compareRuns, inspectRunStatus } from "../src/core/run-record.mjs";
import { finalizeRunWithSupervisor, isRunSupervisorInvocation, resumeRun, runSupervisorMain, startDetachedRunSupervisor } from "../src/core/run-supervisor.mjs";
import { handoffReview, importReviewReturn, inspectReviewStatus, rerunReview, resumeReview } from "../src/core/review-runtime.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const PACKAGE_OPTIONS = { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION };
if (isRunSupervisorInvocation(process.argv.slice(2))) await runSupervisorMain(process.argv.slice(2));

function projectOption(options) {
  return options.project ?? undefined;
}

function selectedHosts(options) {
  return options.host ?? undefined;
}

function reviewMaterials(options) {
  return Array.isArray(options.material) && options.material.length > 0 ? options.material : undefined;
}

function runIds(options) {
  if (Array.isArray(options.id)) return options.id.length > 0 ? options.id : undefined;
  return options.id === undefined ? undefined : [options.id];
}

function runCommonOptions(options) {
  return {
    project: projectOption(options) ?? process.cwd(),
    id: Array.isArray(options.id) ? undefined : options.id,
    group: options.group,
    wallTime: options.wallTime,
    timeoutMs: options.timeoutMs,
    killGraceMs: options.killGraceMs,
    metricName: options.metricName,
    direction: options.direction,
    metricUnit: options.metricUnit,
    data: options.data,
    evaluator: options.evaluator,
    resourceBasis: options.resourceBasis,
    decision: options.decision,
    note: options.note,
    metricValue: options.metricValue,
    cwd: process.cwd(),
    executablePath: __filename
  };
}

function wantsJson(options = {}) {
  return options.json === true || options.format === "json";
}

function integrationResult(result) {
  const { manifest, ...publicFields } = result;
  return publicFields;
}

function writeJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function writeIntegrationResult(command, result, options) {
  if (wantsJson(options)) writeJson(result);
  else console.log(renderProjectIntegrationResult(command, result, { stream: process.stdout, env: process.env }));
}

function writeLifecycleResult(command, result, options) {
  if (wantsJson(options)) writeJson(integrationResult(result));
  else console.log(renderDoveLifecycleResult(command, result, { stream: process.stdout, env: process.env }));
}

function writeReviewResult(result, options) {
  if (wantsJson(options)) writeJson(result);
  else console.log(renderReviewResult(result));
}

function writeRunResult(result, options) {
  if (wantsJson(options)) writeJson(result);
  else console.log(renderRunResult(result));
}

function operationalFailure(error, jsonOrOptions = {}) {
  const message = error instanceof Error ? error.message : String(error);
  const jsonRequested = typeof jsonOrOptions === "boolean" ? jsonOrOptions : wantsJson(jsonOrOptions);
  if (jsonRequested) console.error(JSON.stringify({ status: "blocked", message }, null, 2));
  else console.error(`Dove 不能继续：${message}`);
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
    throw new Error("Dove hook 执行需要匹配的 package identity。请先运行 dove doctor --json，再决定是否修改。");
  }
  if (["newer", "invalid-version"].includes(compatibility)) {
    throw new Error("Dove hook 拒绝来自更新或无效 package version 的项目集成。请先运行 dove doctor --json，再决定是否修改。");
  }
  if (!manifest.hosts.includes("claude")) {
    throw new Error("Dove project hooks 需要 Claude host integration。请在这个项目中运行 dove update --host claude。");
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
  if (typeof payload.cwd !== "string" || !payload.cwd.trim()) throw new Error("Dove hook cwd 必须指向已初始化项目中的目录。");
  const cwdRoot = resolveInstalledProjectRoot(payload.cwd, { hostIds: PROJECT_HOST_IDS });
  if (cwdRoot !== target) throw new Error("Dove hook cwd 不属于声明的已初始化项目。");
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
  operationalFailure(error, error?.jsonRequested === true);
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
const subcommand = parsed.subcommand;
const options = parsed.options;
if (!command) {
  try {
    if (isInteractiveTerminal(process.stdin) && isInteractiveTerminal(process.stdout)) {
      await runInteractiveDoveSetup({
        target: process.cwd(),
        inspect: inspectHome,
        initialize: (target, lifecycleOptions) => initializeProjectIntegration(target, { ...PACKAGE_OPTIONS, ...lifecycleOptions }),
        update: (target, lifecycleOptions) => updateDoveLifecycle(target, { ...PACKAGE_OPTIONS, ...lifecycleOptions, inspect }),
        previewCompleteReinstall: (target, lifecycleOptions) => previewProjectCompleteReinstall(target, { ...PACKAGE_OPTIONS, ...lifecycleOptions }),
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
    operationalFailure(error, options);
    process.exit(1);
  }
}
if (command === "--help") {
  process.stdout.write(renderDoveHelp());
  process.exit(0);
}
if (command === "--version") {
  console.log(PACKAGE_VERSION);
  process.exit(0);
}

try {
  if (command === "init") {
    const requestedProject = projectOption(options);
    let target;
    try {
      target = resolveProjectRootForInit(requestedProject, { cwd: process.cwd(), hostIds: PROJECT_HOST_IDS });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("Dove project integration is already initialized at")) throw error;
      target = resolveInstalledProjectRoot(requestedProject ?? process.cwd());
      const manifest = readProjectInstallationManifest(target, { hostIds: PROJECT_HOST_IDS });
      const requestedHosts = selectedHosts(options);
      if (requestedHosts !== undefined && JSON.stringify([...requestedHosts].sort()) !== JSON.stringify([...manifest.hosts].sort())) {
        throw new Error("Dove 已经用另一组 host 初始化。请使用 dove update --host <host> 修改。");
      }
      inspectProjectIntegration(target, PACKAGE_OPTIONS);
      writeIntegrationResult("init", {
        status: "already-initialized",
        target,
        hosts: [...manifest.hosts],
        writtenPaths: [],
        removedPaths: [],
        changedPaths: []
      }, options);
      process.exit(0);
    }
    const result = initializeProjectIntegration(target, { ...PACKAGE_OPTIONS, hosts: selectedHosts(options) });
    writeIntegrationResult("init", integrationResult(result), options);
    process.exit(0);
  }

  if (command === "update") {
    const target = projectOption(options) ?? process.cwd();
    const result = updateDoveLifecycle(target, {
      ...PACKAGE_OPTIONS,
      hosts: selectedHosts(options),
      inspect
    });
    writeIntegrationResult("update", integrationResult(result), options);
    process.exit(0);
  }

  if (command === "reinstall") {
    const target = path.resolve(projectOption(options) ?? process.cwd());
    if (wantsJson(options)) {
      const preview = previewProjectCompleteReinstall(target, PACKAGE_OPTIONS);
      const { manifest, ...publicPreview } = preview;
      writeJson(publicPreview);
      process.exit(0);
    }
    const color = terminalColorEnabled(process.stdout, process.env);
    const preview = previewProjectCompleteReinstall(target, PACKAGE_OPTIONS);
    process.stdout.write(`${renderCompleteReinstallInventory(preview, { color })}\n\n`);
    const approved = await confirm({
      message: "警告：这会重新安装 Dove 管理的项目接入；研究 Markdown、Review records、run receipts 与 DOCTOR.md 会保留。确认重新安装项目配置？",
      default: false
    });
    if (!approved) {
      console.log("未修改任何文件。");
      process.exit(0);
    }
    const result = completeReinstallDoveLifecycle(target, { ...PACKAGE_OPTIONS, confirmed: true, preview });
    writeLifecycleResult("reinstall", result, options);
    process.exit(0);
  }

  if (command === "uninstall") {
    const target = path.resolve(projectOption(options) ?? process.cwd());
    const preview = previewUninstallDoveLifecycle(target, PACKAGE_OPTIONS);
    if (wantsJson(options)) {
      writeJson(preview);
      process.exit(0);
    }
    const color = terminalColorEnabled(process.stdout, process.env);
    process.stdout.write(`${renderUninstallInventory(preview, { color })}\n\n`);
    const approved = await confirm({
      message: "确认从当前项目卸载 Dove？研究 Markdown、Review records、run receipts 与 DOCTOR.md 会保留。",
      default: false
    });
    if (!approved) {
      console.log("未修改任何文件。");
      process.exit(0);
    }
    const result = uninstallDoveLifecycle(target, { ...PACKAGE_OPTIONS, confirmed: true, preview });
    writeLifecycleResult("uninstall", result, options);
    process.exit(0);
  }

  if (command === "doctor") {
    const result = inspect(projectOption(options) ?? process.cwd());
    if (wantsJson(options)) writeJson(result);
    else console.log(renderDoveDoctor(result, { stream: process.stdout, env: process.env }));
    process.exit(result.staticChecksPassed ? 0 : 1);
  }

  if (command === "review") {
    const project = projectOption(options) ?? process.cwd();
    const common = {
      project,
      id: options.id,
      venue: options.venue,
      materials: reviewMaterials(options),
      file: options.file,
      env: process.env,
      cwd: process.cwd()
    };
    let result;
    if (subcommand === "handoff") {
      result = handoffReview(common);
    } else if (subcommand === "status") {
      result = inspectReviewStatus(common);
    } else if (subcommand === "resume") {
      if (!common.id) throw new Error("dove review resume 需要 --id <review-id>。");
      result = resumeReview(common);
    } else if (subcommand === "rerun") {
      if (!common.id) throw new Error("dove review rerun 需要 --id <review-id>。");
      result = rerunReview(common);
    } else if (subcommand === "import") {
      if (!common.id) throw new Error("dove review import 需要 --id <review-id>。");
      if (!common.file) throw new Error("dove review import 需要 --file <report.md>。");
      result = importReviewReturn(common);
    } else {
      throw new Error("dove review 只接受 handoff、status、resume、rerun 或 import。");
    }
    writeReviewResult(result, options);
    process.exit(0);
  }

  if (command === "run") {
    const common = runCommonOptions(options);
    let result;
    if (subcommand === "start") {
      result = await startDetachedRunSupervisor({ ...common, argv: parsed.passthrough });
    } else if (subcommand === "status") {
      result = inspectRunStatus(common);
    } else if (subcommand === "resume") {
      if (!common.id) throw new Error("dove run resume 需要 --id <run-id>。");
      result = await resumeRun(common);
    } else if (subcommand === "finalize") {
      if (!common.id) throw new Error("dove run finalize 需要 --id <run-id>。");
      if (common.metricValue === undefined) throw new Error("dove run finalize 需要 --metric-value <number>。");
      result = await finalizeRunWithSupervisor(common);
    } else if (subcommand === "compare") {
      result = compareRuns({ ...common, ids: runIds(options) });
    } else {
      throw new Error("dove run 只接受 start、status、resume、finalize 或 compare。");
    }
    writeRunResult(result, options);
    process.exit(0);
  }

  if (command === "hook") {
    const hookName = subcommand;
    if (projectOption(options) === undefined) throw new Error(`dove hook ${hookName} 需要 --project <dir>。`);
    const input = await readStdin();
    const target = prepareHookProject(projectOption(options));
    if (hookName === "statusline") {
      process.stdout.write(`${target}\n`);
      process.exit(0);
    }
    const payload = hookName === "session-start" ? parseSessionStartPayload(input) : parseUserPromptSubmitPayload(input);
    assertHookPayloadProject(payload, target);
    if (hookName === "session-start") {
      sessionStartOutput(input);
      synchronizeProjectIntegrationOnly(target, PACKAGE_OPTIONS);
      process.exit(0);
    }
    const output = userPromptSubmitOutput(input);
    if (output !== null) process.stdout.write(JSON.stringify(output));
    process.exit(0);
  }
} catch (error) {
  operationalFailure(error, options);
  process.exit(1);
}
