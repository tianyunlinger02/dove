#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { confirm } from "@inquirer/prompts";

import { parseDoveCli } from "../src/cli/command-parser.mjs";
import { createDashboardActions } from "../src/cli/dashboard-actions.mjs";
import { DEFAULT_DASHBOARD_BIND, DEFAULT_DASHBOARD_PORT, startDashboardServer } from "../src/cli/dashboard-server.mjs";
import { runWatch } from "../src/core/paper-watch.mjs";
import { startTopicSelection } from "../src/core/topic-selection.mjs";
import { renderDoveDoctor } from "../src/cli/doctor-output.mjs";
import { renderDoveHelp } from "../src/cli/help-output.mjs";
import { runInteractiveDoveSetup } from "../src/cli/interactive-setup.mjs";
import { renderProjectIntegrationResult } from "../src/cli/project-integration-output.mjs";
import { renderRunResult } from "../src/cli/run-output.mjs";
import {
  isInteractiveTerminal,
  renderCompleteReinstallInventory,
  renderDoveHome,
  renderDoveLifecycleResult,
  renderUninstallInventory,
  terminalColorEnabled
} from "../src/cli/terminal-output.mjs";
import { currentPromptGuidance, parseUserPromptSubmitPayload, userPromptSubmitAttentionOutput, userPromptSubmitFailureOutput, userPromptSubmitOutput } from "../src/core/user-prompt-submit-hook.mjs";
import { parseSessionStartPayload, sessionStartFailureOutput, sessionStartOutput } from "../src/core/session-start-hook.mjs";
import { renderDoveStatusLine } from "../src/core/statusline.mjs";
import { collectDashboard, readProjectDocument } from "../src/core/dashboard-data.mjs";
import { completeReinstallDoveLifecycle, previewUninstallDoveLifecycle, uninstallDoveLifecycle, updateDoveLifecycle } from "../src/core/dove-lifecycle.mjs";
import { PROJECT_HOST_IDS } from "../src/core/host-registry.mjs";
import { importProjectRoots, inspectRegisteredProjects, syncRegisteredProjects } from "../src/core/project-cascade.mjs";
import { changeRegisteredProjects, readLastProjectSync, readRegisteredProjects } from "../src/core/project-registry.mjs";
import { classifyPackageCompatibility, PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { inspectProjectDoctor } from "../src/core/project-doctor.mjs";
import { initializeProjectIntegration, inspectProjectIntegration, previewProjectCompleteReinstall } from "../src/core/project-installation.mjs";
import { readProjectInstallationManifest } from "../src/core/project-installation-manifest.mjs";
import { resolveExactInstalledProjectRoot, resolveInstalledProjectRoot, resolveProjectRootForInit } from "../src/core/project-root.mjs";
import { appendFinalizedRun, compareRuns, inspectRunStatus } from "../src/core/run-record.mjs";
import { isRunSupervisorInvocation, resumeRun, runSupervisorMain, startDetachedRunSupervisor } from "../src/core/run-supervisor.mjs";

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

function runIds(options) {
  if (Array.isArray(options.id)) return options.id.length > 0 ? options.id : undefined;
  return options.id === undefined ? undefined : [options.id];
}

function runCommonOptions(options) {
  return {
    project: projectOption(options) ?? process.cwd(),
    id: Array.isArray(options.id) ? undefined : options.id,
    group: options.group,
    seed: options.seed,
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

function recordLifecycle(result, action) {
  try {
    if (action === "uninstall") changeRegisteredProjects([], [result.target]);
    else changeRegisteredProjects([result.target]);
  } catch (error) {
    throw new Error(`Dove project operation ${action} succeeded at ${result.target}, but user-level project registration failed; future automatic upgrades may not reach this project: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  return result;
}

function warnSyncResult(result) {
  if (result.reportError) console.error(`Dove: 项目级联结果未能持久保存：${result.reportError}`);
  if (result.status === "partial") console.error("Dove: 部分已登记项目未更新；运行 dove projects status 查看上次保存的结果，或 dove projects sync 重试。");
}

function reportIncompleteCascade() {
  try {
    const last = readLastProjectSync();
    if (last?.packageVersion === PACKAGE_VERSION && last.status === "partial") {
      console.error("Dove: 部分项目自动更新未完成；运行 dove projects status 查看受保护或失败的项目。");
    }
  } catch (error) {
    console.error(`Dove: 无法读取项目级联报告：${error instanceof Error ? error.message : String(error)}`);
  }
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
  if (typeof payload.cwd !== "string" || !payload.cwd.trim() || payload.cwd.includes("\0")) throw new Error("Dove hook cwd 必须指向已初始化项目中的目录。");
  const cwd = fs.realpathSync(payload.cwd);
  const stat = fs.statSync(cwd);
  const relative = path.relative(target, cwd);
  if (!stat.isDirectory() || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Dove hook cwd 不属于声明的已初始化项目。");
  }
  // A nested package boundary need not be a new Dove project, but an actual
  // nested Dove installation must not borrow its parent's hook guidance.
  let directory = cwd;
  while (directory !== target) {
    if (fs.existsSync(path.join(directory, ".dove/install/manifest.json")) || fs.existsSync(path.join(directory, ".dove-install"))) {
      throw new Error("Dove hook cwd 属于另一个项目集成。");
    }
    directory = path.dirname(directory);
  }
}

async function readStdin() {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    input += chunk;
  }
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
  return inspection.setup.mode;
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
        initialize: (target, lifecycleOptions) => recordLifecycle(initializeProjectIntegration(target, { ...PACKAGE_OPTIONS, ...lifecycleOptions }), "init"),
        update: (target, lifecycleOptions) => recordLifecycle(updateDoveLifecycle(target, { ...PACKAGE_OPTIONS, ...lifecycleOptions, inspect }), "update"),
        previewCompleteReinstall: (target, lifecycleOptions) => previewProjectCompleteReinstall(target, { ...PACKAGE_OPTIONS, ...lifecycleOptions }),
        completeReinstall: (target, lifecycleOptions) => recordLifecycle(completeReinstallDoveLifecycle(target, { ...PACKAGE_OPTIONS, ...lifecycleOptions }), "reinstall"),
        previewUninstall: (target) => previewUninstallDoveLifecycle(target, PACKAGE_OPTIONS),
        uninstall: (target, lifecycleOptions) => recordLifecycle(uninstallDoveLifecycle(target, { ...PACKAGE_OPTIONS, ...lifecycleOptions }), "uninstall"),
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
      reportIncompleteCascade();
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
      const result = recordLifecycle({
        status: "already-initialized",
        target,
        hosts: [...manifest.hosts],
        writtenPaths: [],
        removedPaths: [],
        changedPaths: []
      }, "init");
      writeIntegrationResult("init", result, options);
      process.exit(0);
    }
    const result = recordLifecycle(initializeProjectIntegration(target, { ...PACKAGE_OPTIONS, hosts: selectedHosts(options) }), "init");
    writeIntegrationResult("init", integrationResult(result), options);
    process.exit(0);
  }

  if (command === "update") {
    const target = projectOption(options) ?? process.cwd();
    const result = recordLifecycle(updateDoveLifecycle(target, {
      ...PACKAGE_OPTIONS,
      hosts: selectedHosts(options),
      inspect
    }), "update");
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
    const result = recordLifecycle(completeReinstallDoveLifecycle(target, { ...PACKAGE_OPTIONS, confirmed: true, preview }), "reinstall");
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
    const result = recordLifecycle(uninstallDoveLifecycle(target, { ...PACKAGE_OPTIONS, confirmed: true, preview }), "uninstall");
    writeLifecycleResult("uninstall", result, options);
    process.exit(0);
  }

  if (command === "projects") {
    if (subcommand === "postinstall") {
      if (process.env.npm_config_global !== "true") process.exit(0);
      const result = syncRegisteredProjects(PACKAGE_OPTIONS);
      console.log(JSON.stringify(result));
      warnSyncResult(result);
      process.exit(0);
    }
    if (subcommand === "import") {
      const projects = importProjectRoots(options.project ?? [], PACKAGE_OPTIONS);
      const result = options.sync ? syncRegisteredProjects(PACKAGE_OPTIONS) : { status: "registered", projects };
      if (wantsJson(options)) writeJson(result);
      else console.log(JSON.stringify(result, null, 2));
      if (options.sync) warnSyncResult(result);
      process.exit(0);
    }
    const result = subcommand === "sync" ? syncRegisteredProjects(PACKAGE_OPTIONS) : inspectRegisteredProjects(PACKAGE_OPTIONS);
    if (wantsJson(options)) writeJson(result);
    else console.log(JSON.stringify(result, null, 2));
    if (subcommand === "sync") warnSyncResult(result);
    process.exit(0);
  }

  if (command === "dashboard") {
    const collect = () => collectDashboard({ ...PACKAGE_OPTIONS, packageVersion: PACKAGE_VERSION });
    if (wantsJson(options)) {
      process.stdout.write(`${JSON.stringify(collect(), null, 2)}\n`, () => process.exit(0));
      await new Promise(() => {});
    }
    const port = options.port === undefined ? DEFAULT_DASHBOARD_PORT : Number(options.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`--port 需要 1 到 65535 之间的整数：${options.port}`);
    const bind = options.bind ?? DEFAULT_DASHBOARD_BIND;
    let password = null;
    const passwordFile = options.passwordFile === undefined ? null : path.resolve(options.passwordFile);
    if (passwordFile) {
      password = fs.readFileSync(passwordFile, "utf8").trim();
      if (!password) throw new Error(`密码文件为空：${options.passwordFile}`);
    }
    const actions = createDashboardActions({ packageOptions: PACKAGE_OPTIONS, passwordFile });
    await startDashboardServer({ collect, listRoots: () => readRegisteredProjects(PACKAGE_OPTIONS), readDocument: readProjectDocument, password, actions, bind, port });
    actions.startScheduler();
    console.log(`Dove 科研面板（${password ? "需密码登录" : "无密码，只应在本机或 SSH 隧道里打开"}）：http://${bind}:${port}/   Ctrl+C 退出`);
    console.log("论文追踪会在面板运行期间按设置每天自动执行一次。");
    if (bind === DEFAULT_DASHBOARD_BIND) console.log(`从自己电脑打开：ssh -N -L ${port}:127.0.0.1:${port} <服务器>，再访问 http://localhost:${port}/`);
    await new Promise(() => {});
  }

  if (command === "topic") {
    const root = path.resolve(options.project ?? process.cwd());
    const result = startTopicSelection(root, PACKAGE_OPTIONS);
    if (wantsJson(options)) writeJson(result);
    else console.log(`选题目录已就绪：${path.join(root, ".dove/research/topics")}（依据：${result.criteria?.title ?? "选题标准"}${result.criteria?.version ? `，第 ${result.criteria.version} 版` : ""}；已有候选 ${result.cards.length} 个）`);
    process.exit(0);
  }

  if (command === "watch") {
    const roots = options.project ? [path.resolve(options.project)] : readRegisteredProjects(PACKAGE_OPTIONS).filter((root) => fs.existsSync(root));
    const result = await runWatch(roots, PACKAGE_OPTIONS);
    if (wantsJson(options)) writeJson(result);
    else for (const item of result.results) console.log(`${path.basename(item.root)}：${({ done: `新论文 ${item.found} 篇`, unconfigured: "还没设置关键词或作者", disabled: "已关闭追踪", failed: `失败 ${item.error}` })[item.status] ?? item.status}${item.notes?.length ? `（${item.notes.join("；")}）` : ""}`);
    process.exit(0);
  }

  if (command === "doctor") {
    const result = inspect(projectOption(options) ?? process.cwd());
    if (wantsJson(options)) writeJson(result);
    else {
      console.log(renderDoveDoctor(result, { stream: process.stdout, env: process.env }));
      reportIncompleteCascade();
    }
    process.exit(result.staticChecksPassed ? 0 : 1);
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
      result = resumeRun(common);
    } else if (subcommand === "finalize") {
      if (!common.id) throw new Error("dove run finalize 需要 --id <run-id>。");
      if (common.metricValue === undefined) throw new Error("dove run finalize 需要 --metric-value <number>。");
      result = { command: "finalize", ...appendFinalizedRun(common.project, common.id, common) };
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
    if (hookName === "user-prompt-submit") {
      let payload;
      try {
        payload = parseUserPromptSubmitPayload(input);
      } catch (error) {
        process.stdout.write(JSON.stringify(userPromptSubmitFailureOutput(error)));
        process.exit(0);
      }
      try {
        const target = prepareHookProject(projectOption(options));
        assertHookPayloadProject(payload, target);
        const inspected = inspectProjectIntegration(target, PACKAGE_OPTIONS);
        if (inspected.status !== "current") {
          process.stdout.write(JSON.stringify(userPromptSubmitAttentionOutput()));
        } else {
          process.stdout.write(JSON.stringify(userPromptSubmitOutput(payload, currentPromptGuidance(inspected.manifest), { project: target })));
        }
      } catch {
        // An invalid or unsafe installation does not authorize new project guidance.
        process.stdout.write(JSON.stringify(userPromptSubmitAttentionOutput()));
      }
      process.exit(0);
    }
    if (hookName === "session-start") {
      try {
        const target = prepareHookProject(projectOption(options));
        const payload = parseSessionStartPayload(input);
        assertHookPayloadProject(payload, target);
        const result = inspectProjectIntegration(target, PACKAGE_OPTIONS);
        const output = sessionStartOutput(payload, result, { project: target });
        if (output !== null) process.stdout.write(JSON.stringify(output));
        process.exit(0);
      } catch (error) {
        const output = sessionStartFailureOutput(error);
        process.stdout.write(JSON.stringify(output));
        // Claude processes hook JSON only on exit 0. The systemMessage reports
        // the failed read-only inspection; no project writes run in this hook.
        process.exit(0);
      }
    }
    if (hookName === "statusline") {
      process.stdout.write(`${renderDoveStatusLine(input, { projectRoot: path.resolve(projectOption(options)) })}\n`);
      process.exit(0);
    }
    throw new Error("dove hook only supports session-start, user-prompt-submit and statusline.");
  }
} catch (error) {
  operationalFailure(error, options);
  process.exit(1);
}
