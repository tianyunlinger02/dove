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
const KNOWN_COMMANDS = new Set(["init", "update", "reinstall", "uninstall", "doctor", "review", "run", "hook"]);

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
  dove review handoff --project <dir> --venue <venue> --material <path>... [--id <id>] [--json|--format json]
  dove review status --project <dir> [--id <id>] [--json|--format json]
  dove review resume --project <dir> --id <id> [--json|--format json]
  dove review rerun --project <dir> --id <id> --material <path>... [--venue <venue>] [--json|--format json]
  dove review import --project <dir> --id <id> --file <report.md> [--venue <venue>] [--material <path>...] [--json|--format json]
  dove run start --project <dir> [--id <id>] [--group <name>] [--wall-time <duration>|--timeout-ms <ms>] [--metric-name <name> --direction min|max] [--metric-unit <unit>] [--data <basis>] [--evaluator <basis>] [--resource-basis <basis>] [--kill-grace-ms <ms>] [--json|--format json] -- <command> [args...]
  dove run status --project <dir> [--id <id>|--group <name>] [--json|--format json]
  dove run resume --project <dir> --id <id> [--json|--format json]
  dove run finalize --project <dir> --id <id> --metric-value <number> [--metric-name <name> --direction min|max] [--metric-unit <unit>] [--decision <text>] [--note <text>] [--json|--format json]
  dove run compare --project <dir> [--group <name>|--id <id>...] [--json|--format json]
  dove hook session-start --project <dir>
  dove hook user-prompt-submit --project <dir>
  dove hook statusline --project <dir>

The runtime CLI manages project integration, diagnostics, host lifecycle hooks, the explicit isolated dove-review handoff runtime, and detached experiment run receipts under \`.dove/runs/<id>/\`. Research work uses one Dove agent and nine optional capability Skills with ordinary Markdown research documents. Project initialization creates the minimal researcher-owned \`.dove/research/RESEARCH.md\` entry, but it does not create research progress, a Mission, or a scientific conclusion. Dove does not install or expose a Stop hook.
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
  return [...new Set(requested)];
}

function reviewMaterials(args) {
  const values = readFlagValues(args, "--material");
  return values.length === 0 ? undefined : values;
}

function reviewIdFlag(args) {
  return readFlagValue(args, "--id") ?? undefined;
}

function reviewVenueFlag(args) {
  return readFlagValue(args, "--venue") ?? undefined;
}

function reviewFileFlag(args) {
  return readFlagValue(args, "--file") ?? undefined;
}

function runIdFlag(args) {
  return readFlagValue(args, "--id") ?? undefined;
}

function runIds(args) {
  const values = readFlagValues(args, "--id");
  return values.length === 0 ? undefined : values;
}

function runGroupFlag(args) {
  return readFlagValue(args, "--group") ?? undefined;
}

function runCommonFlags(args) {
  return {
    project: projectFlag(args) ?? process.cwd(),
    id: runIdFlag(args),
    group: runGroupFlag(args),
    wallTime: readFlagValue(args, "--wall-time") ?? undefined,
    timeoutMs: readFlagValue(args, "--timeout-ms") ?? undefined,
    killGraceMs: readFlagValue(args, "--kill-grace-ms") ?? undefined,
    metricName: readFlagValue(args, "--metric-name") ?? undefined,
    direction: readFlagValue(args, "--direction") ?? undefined,
    metricUnit: readFlagValue(args, "--metric-unit") ?? undefined,
    data: readFlagValue(args, "--data") ?? undefined,
    evaluator: readFlagValue(args, "--evaluator") ?? undefined,
    resourceBasis: readFlagValue(args, "--resource-basis") ?? undefined,
    decision: readFlagValue(args, "--decision") ?? undefined,
    note: readFlagValue(args, "--note") ?? undefined,
    metricValue: readFlagValue(args, "--metric-value") ?? undefined,
    cwd: process.cwd(),
    executablePath: __filename
  };
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

function terminalSafeText(value) {
  return String(value ?? "").replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
}

function renderReviewResult(result) {
  if (result.command === "status" && Array.isArray(result.reviews)) {
    const lines = ["Dove review 状态", "", `项目：${terminalSafeText(result.project)}`];
    if (result.reviews.length === 0) lines.push("", "尚无 .dove/reviews/** 记录。");
    else lines.push("", ...result.reviews.map((review) => `- ${terminalSafeText(review.reviewId)}: ${terminalSafeText(review.status)} round ${review.currentRound}${review.sessionId ? ` session ${terminalSafeText(review.sessionId)}` : ""}`));
    return lines.join("\n");
  }
  if (result.command === "status") {
    return [
      "Dove review 状态",
      "",
      `项目：${terminalSafeText(result.project)}`,
      `Review：${terminalSafeText(result.reviewId)}`,
      `状态：${terminalSafeText(result.status)}`,
      `当前轮次：${terminalSafeText(result.currentRound)}`,
      `Session：${terminalSafeText(result.sessionId ?? "无")}`,
      "",
      ...(result.rounds ?? []).map((round) => {
        const latest = round.latestReportPath ?? round.reportPath;
        const canonical = latest === round.reportPath ? "" : `；原始报告保留在 ${terminalSafeText(round.reportPath)}`;
        return `- round ${round.round}: ${round.status} (${round.provenance}) ${terminalSafeText(latest)}${canonical}`;
      })
    ].join("\n");
  }
  const heading = {
    handoff: "Dove review handoff 已完成",
    resume: "Dove review 已恢复并更新当前轮次",
    rerun: "Dove review 已在同一 reviewer session 开始新完整轮次",
    import: "Dove review return 已导入"
  }[result.command] ?? "Dove review 完成";
  const materialLines = (result.materials ?? []).map((material) => `- ${material.path} (${material.size} bytes)`);
  return [
    heading,
    "",
    `项目：${terminalSafeText(result.project)}`,
    `Review：${terminalSafeText(result.reviewId)}`,
    `轮次：${terminalSafeText(result.round)}`,
    `状态：${terminalSafeText(result.status)}`,
    `来源：${terminalSafeText(result.provenance)}`,
    `Session：${terminalSafeText(result.sessionId ?? "无")}`,
    `报告：${terminalSafeText(result.latestReportPath ?? result.reportPath)}`,
    `Backend：${terminalSafeText(result.latestBackendPath ?? result.backendPath)}`,
    "",
    "冻结材料：",
    ...(materialLines.length > 0 ? materialLines : ["- 无；这是导入的外部返回记录"]),
    "",
    result.command === "import" ? "导入内容按用户提供文件原样保存；未声称由 Dove runtime reviewer 生成。" : "Reviewer 只接收本轮冻结材料；不会读取私有 transcript。"
  ].join("\n");
}

function writeReviewResult(result, args) {
  if (wantsJson(args)) console.log(JSON.stringify(result, null, 2));
  else console.log(renderReviewResult(result));
}

function renderRunMetric(metric) {
  if (!metric || metric.name === null || metric.name === undefined) return "未指定";
  const value = Object.hasOwn(metric, "value") ? `=${terminalSafeText(metric.value)}` : "";
  return `${terminalSafeText(metric.name)} ${terminalSafeText(metric.direction)}${metric.unit ? ` ${terminalSafeText(metric.unit)}` : ""}${value}`;
}

function renderRunResult(result) {
  if (result.command === "start") {
    return [
      "Dove run 已启动",
      "",
      `项目：${terminalSafeText(result.project)}`,
      `Run：${terminalSafeText(result.runId)}`,
      `状态：${terminalSafeText(result.status)}`,
      `Supervisor PID：${terminalSafeText(result.supervisorPid)}`,
      `命令：${terminalSafeText(result.argv.join(" "))}`,
      `工作目录：${terminalSafeText(result.cwd)}`,
      `Journal：${terminalSafeText(result.paths.journalPath)}`,
      `stdout：${terminalSafeText(result.paths.stdoutPath)}`,
      `stderr：${terminalSafeText(result.paths.stderrPath)}`,
      "",
      "Run 记录只证明该命令的本地执行收据；科研结论仍需 Dove 根据真实结果判断。"
    ].join("\n");
  }
  if (result.command === "status" && Array.isArray(result.runs)) {
    const lines = ["Dove run 状态", "", `项目：${terminalSafeText(result.project)}`];
    if (result.group) lines.push(`Group：${terminalSafeText(result.group)}`);
    if (result.runs.length === 0) lines.push("", "尚无匹配的 .dove/runs/** 记录。");
    else lines.push("", ...result.runs.map((run) => `- ${terminalSafeText(run.runId)}: ${terminalSafeText(run.status)}${run.group ? ` group ${terminalSafeText(run.group)}` : ""}${run.finalized ? ` metric ${renderRunMetric(run.metric)}` : ""}`));
    return lines.join("\n");
  }
  if (result.command === "status") {
    return [
      "Dove run 状态",
      "",
      `项目：${terminalSafeText(result.project)}`,
      `Run：${terminalSafeText(result.runId)}`,
      `状态：${terminalSafeText(result.status)}`,
      `Lifecycle：${terminalSafeText(result.lifecycle)}`,
      `Terminal：${terminalSafeText(result.terminal)}`,
      `Finalized：${terminalSafeText(result.finalized)}`,
      `Exit：${terminalSafeText(result.exitCode ?? "无")}`,
      `Signal：${terminalSafeText(result.signal ?? "无")}`,
      `Metric：${renderRunMetric(result.metric)}`,
      `Journal：${terminalSafeText(result.paths.journalPath)}`,
      `stdout：${terminalSafeText(result.paths.stdoutPath)}`,
      `stderr：${terminalSafeText(result.paths.stderrPath)}`,
      "",
      "PID 只作为观察信号，不是强身份。status 只读，不会修复或追加记录。"
    ].join("\n");
  }
  if (result.command === "resume") {
    return [
      "Dove run resume",
      "",
      `Run：${terminalSafeText(result.run?.runId)}`,
      `状态：${terminalSafeText(result.status)}`,
      `动作：${terminalSafeText(result.action)}`,
      `写入：${terminalSafeText(result.write)}`,
      `说明：${terminalSafeText(result.reason)}`
    ].join("\n");
  }
  if (result.command === "finalize") {
    return [
      "Dove run 已 finalize",
      "",
      `Run：${terminalSafeText(result.summary.runId)}`,
      `Metric：${renderRunMetric(result.event.metric)}`,
      `Decision：${terminalSafeText(result.event.decision ?? "无")}`,
      `Note：${terminalSafeText(result.event.note ?? "无")}`
    ].join("\n");
  }
  if (result.command === "compare") {
    if (!result.comparable) {
      return [
        "Dove run compare",
        "",
        `Comparable：false`,
        `字段：${terminalSafeText((result.fields ?? []).join(", ") || "无")}`,
        "只比较 terminal 且 finalized，并且 metric、budget、data、evaluator、resource basis 完全一致的 runs。"
      ].join("\n");
    }
    return [
      "Dove run compare",
      "",
      `Comparable：true`,
      `Metric：${renderRunMetric(result.basis.metric)}`,
      "",
      ...result.ranking.map((item) => `${item.rank}. ${terminalSafeText(item.runId)} ${terminalSafeText(item.metricValue)} delta ${terminalSafeText(item.deltaFromBest)}`)
    ].join("\n");
  }
  return JSON.stringify(result, null, 2);
}

function writeRunResult(result, args) {
  if (wantsJson(args)) console.log(JSON.stringify(result, null, 2));
  else console.log(renderRunResult(result));
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
      message: "警告：这会重新安装 Dove 管理的项目接入；研究 Markdown、Review records、run receipts 与 DOCTOR.md 会保留。确认重新安装项目配置？",
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
      message: "确认从当前项目卸载 Dove？研究 Markdown、Review records、run receipts 与 DOCTOR.md 会保留。",
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
    process.exit(result.staticChecksPassed ? 0 : 1);
  }


  if (command === "review") {
    const subcommand = parsed.positionals[0];
    const project = projectFlag(args) ?? process.cwd();
    const common = {
      project,
      id: reviewIdFlag(args),
      venue: reviewVenueFlag(args),
      materials: reviewMaterials(args),
      file: reviewFileFlag(args),
      env: process.env,
      cwd: process.cwd()
    };
    let result;
    if (subcommand === "handoff") {
      result = handoffReview(common);
    } else if (subcommand === "status") {
      result = inspectReviewStatus(common);
    } else if (subcommand === "resume") {
      if (!common.id) throw new Error("dove review resume requires --id <review-id>.");
      result = resumeReview(common);
    } else if (subcommand === "rerun") {
      if (!common.id) throw new Error("dove review rerun requires --id <review-id>.");
      result = rerunReview(common);
    } else if (subcommand === "import") {
      if (!common.id) throw new Error("dove review import requires --id <review-id>.");
      if (!common.file) throw new Error("dove review import requires --file <report.md>.");
      result = importReviewReturn(common);
    } else {
      throw new Error("dove review accepts only handoff, status, resume, rerun, or import.");
    }
    writeReviewResult(result, args);
    process.exit(0);
  }

  if (command === "run") {
    const subcommand = parsed.positionals[0];
    const common = runCommonFlags(args);
    let result;
    if (subcommand === "start") {
      result = await startDetachedRunSupervisor({ ...common, argv: parsed.passthrough ?? [] });
    } else if (subcommand === "status") {
      result = inspectRunStatus(common);
    } else if (subcommand === "resume") {
      if (!common.id) throw new Error("dove run resume requires --id <run-id>.");
      result = await resumeRun(common);
    } else if (subcommand === "finalize") {
      if (!common.id) throw new Error("dove run finalize requires --id <run-id>.");
      if (common.metricValue === undefined) throw new Error("dove run finalize requires --metric-value <number>.");
      result = await finalizeRunWithSupervisor(common);
    } else if (subcommand === "compare") {
      result = compareRuns({ ...common, ids: runIds(args) });
    } else {
      throw new Error("dove run accepts only start, status, resume, finalize, or compare.");
    }
    writeRunResult(result, args);
    process.exit(0);
  }

  if (command === "hook") {
    const hookName = parsed.positionals[0];
    if (!["session-start", "user-prompt-submit", "statusline"].includes(hookName)) throw new Error("dove hook accepts only session-start, user-prompt-submit, or statusline.");
    if (projectFlag(args) === undefined) throw new Error(`dove hook ${hookName} requires --project <dir>.`);
    const input = await readStdin();
    const target = prepareHookProject(projectFlag(args));
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
  operationalFailure(error, args);
  process.exit(1);
}
