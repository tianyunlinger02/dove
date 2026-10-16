import assert from "node:assert/strict";

import { CLI_COMMAND_SPECS, parseDoveCli } from "../../src/cli/command-parser.mjs";
import { renderDoveHelp } from "../../src/cli/help-output.mjs";
import { renderProjectIntegrationResult } from "../../src/cli/project-integration-output.mjs";
import { renderRunMetric, renderRunResult } from "../../src/cli/run-output.mjs";
import {
  DOVE_PIXEL_ART,
  renderDoveHome,
  renderDoveLifecycleResult,
  renderDovePixelArt
} from "../../src/cli/terminal-output.mjs";

function assertRuntimeCli() {
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "init"));
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "hook"));
  assert.deepEqual(Object.keys(CLI_COMMAND_SPECS.hook.subcommands), ["session-start", "user-prompt-submit", "statusline"], "hook subcommands must be formal parser subcommands");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "mcp"), false, "CLI must not expose the retired MCP server");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "migrate-research"), false, "CLI must not expose format migration");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "export-research"), false, "CLI must not expose the retired legacy export command");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "review"), false, "Review is a native read-only Agent, not a CLI model or record runtime");
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "run"), "CLI must expose detached experiment run receipts");

  const assertParserShape = (value) => {
    assert.deepEqual(Object.keys(value), ["command", "subcommand", "options", "passthrough"], "parser result must expose only command/subcommand/options/passthrough");
    assert.equal(Object.hasOwn(value, "args"), false, "parser must not return args compatibility output");
    assert.equal(Object.hasOwn(value, "positionals"), false, "parser must not return positionals compatibility output");
    return value;
  };
  const assertParserError = (argv, pattern, jsonRequested) => {
    let caught = null;
    try {
      parseDoveCli(argv);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof Error, `${argv.join(" ")} must fail parsing`);
    assert.match(caught.message, pattern);
    assert.equal(caught.jsonRequested, jsonRequested, "parser error jsonRequested must reflect only flags before '--'");
  };

  assert.deepEqual(parseDoveCli(["hook", "user-prompt-submit", "--project=/workspace"]), {
    command: "hook", subcommand: "user-prompt-submit", options: { project: "/workspace" }, passthrough: []
  });
  assert.deepEqual(parseDoveCli(["settings", "--host-migration", "on", "--json"]), {
    command: "settings", subcommand: null, options: { hostMigration: "on", json: true }, passthrough: []
  });
  assertParserError(["settings", "--host-migration", "yes"], /--host-migration 只接受 on 或 off/u, false);
  assert.deepEqual(parseDoveCli(["mentor", "brief", "--trigger", "用户纠正", "--user-source", "/source", "--since", "2026-10-14", "--until", "2026-10-15", "--user-original", "原话", "--opinion", "opinion.md", "--artifact", "a.csv", "--artifact", "b.png"]), {
    command: "mentor", subcommand: "brief", options: { trigger: "用户纠正", userSource: "/source", since: "2026-10-14", until: "2026-10-15", userOriginal: "原话", opinion: "opinion.md", artifact: ["a.csv", "b.png"] }, passthrough: []
  });
  assertParserError(["mentor", "brief", "--task", "请裁决工程"], /Dove 不支持这个参数：--task/u, false);
  assert.deepEqual(Object.keys(CLI_COMMAND_SPECS.watch.subcommands), ["run", "configure"]);
  assert.deepEqual(parseDoveCli(["watch", "configure", "--project", "/workspace", "--mentor", "advice file.json", "--json"]), {
    command: "watch", subcommand: "configure", options: { project: "/workspace", mentor: "advice file.json", json: true }, passthrough: []
  });
  assert.deepEqual(parseDoveCli(["watch", "configure", "--project=/workspace", "--mentor=advice.json", "--format=json"]), {
    command: "watch", subcommand: "configure", options: { project: "/workspace", mentor: "advice.json", format: "json" }, passthrough: []
  });
  assert.deepEqual(parseDoveCli(["watch", "run"]), {
    command: "watch", subcommand: "run", options: {}, passthrough: []
  });
  assert.deepEqual(parseDoveCli(["watch", "run", "--project", "/workspace", "--json"]), {
    command: "watch", subcommand: "run", options: { project: "/workspace", json: true }, passthrough: []
  });
  assertParserError(["watch", "configure", "--mentor"], /--mentor 需要一个值/u, false);
  assertParserError(["watch", "configure", "--mentor", "--json"], /--mentor 需要一个值/u, true);
  assertParserError(["watch", "configure", "--mentor="], /--mentor 需要一个值/u, false);
  assertParserError(["watch", "configure", "--mentor", "a.json", "--mentor", "b.json"], /--mentor 只能提供一次/u, false);
  assertParserError(["watch", "configure", "--project", "/one", "--project", "/two", "--json"], /--project 只能提供一次/u, true);
  assertParserError(["watch", "configure", "advice.json"], /不接受位置参数/u, false);
  for (const option of ["--enabled", "--categories", "--source", "--all", "--run", "--model"]) {
    assertParserError(["watch", "configure", option, "--json"], /Dove 不支持这个参数/u, true);
  }
  assertParserError(["watch", "run", "--mentor", "advice.json"], /Dove 不支持这个参数：--mentor/u, false);
  assertParserError(["hook", "stop"], /hook 只接受这些子命令/u, false);
  assertParserError(["hook", "stop", "--project=/workspace"], /hook 只接受这些子命令/u, false);
  assert.deepEqual(assertParserShape(parseDoveCli(["init", "--host", "claude,dsh", "--host=dsh,claude", "--project=/workspace"])), {
    command: "init",
    subcommand: null,
    options: { host: ["claude", "dsh"], project: "/workspace" },
    passthrough: []
  });
  assert.deepEqual(assertParserShape(parseDoveCli(["run", "start", "--project", "/workspace", "--id", "run-a", "--seed", "42", "--metric-name", "score", "--direction", "max", "--", "node", "script.mjs", "--flag", "--not-dove"])), {
    command: "run",
    subcommand: "start",
    options: { project: "/workspace", id: "run-a", seed: "42", metricName: "score", direction: "max" },
    passthrough: ["node", "script.mjs", "--flag", "--not-dove"]
  });
  assert.deepEqual(assertParserShape(parseDoveCli(["run", "start", "--project", "/workspace", "--", "node", "script.mjs", "--json", "--format", "json"])), {
    command: "run",
    subcommand: "start",
    options: { project: "/workspace" },
    passthrough: ["node", "script.mjs", "--json", "--format", "json"]
  });
  assertParserError(["run", "status", "--project", "/workspace", "--id", "run-a", "--group", "group-a"], /(?:--id 不能和 --group|--group 不能和 --id) 同时使用/iu, false);
  assertParserError(["run", "start", "--project", "/workspace", "--format", "text", "--", "node"], /--format 只接受 json/iu, false);
  assertParserError(["run", "start", "--project", "/workspace", "--direction", "mean", "--", "node"], /--direction 只接受 min 或 max/iu, false);
  assertParserError(["doctor", "--json", "--format", "json"], /--format 不能和 --json 同时使用/iu, true);
  assertParserError(["doctor", "--", "--json"], /doctor 不接受位置参数/iu, false);
  assertParserError(["run", "start", "--project", "/workspace", "node"], /run start 需要在 '--' 后提供要执行的命令/iu, false);
  assertParserError(["run", "start", "--project", "/workspace", "node", "--", "script.mjs"], /Dove 选项必须写在 '--' 前/iu, false);
  assertParserError(["mcp", "serve"], /Dove 不支持这个命令：mcp/iu, false);
  for (const command of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    assertParserError([command], new RegExp(`Dove 不支持这个命令：${command}`), false);
  }
  assertParserError(["review"], /Dove 不支持这个命令：review/iu, false);
  assertParserError(["review", "handoff", "--json"], /Dove 不支持这个命令：review/iu, true);
}

function assertDoveCliHelpRenderer() {
  const output = renderDoveHelp();
  assert.match(output, /^dove\n/u);
  assert.match(output, /dove init \[--project <dir>\] \[--host <host>\.\.\.\] \[--json\|--format json\]/u);
  assert.doesNotMatch(output, /dove review (?:handoff|resume|rerun|status|import|report)/u);
  assert.match(output, /dove run start --project <dir>.*--seed <short-text>.* -- <command> \[args\.\.\.\]/u);
  assert.match(output, /dove hook session-start --project <dir>/u);
  assert.match(output, /dove hook user-prompt-submit --project <dir>/u);
  assert.deepEqual(Object.keys(CLI_COMMAND_SPECS), ["init", "update", "reinstall", "uninstall", "doctor", "dashboard", "watch", "topic", "settings", "mentor", "projects", "run", "hook"], "CLI inventory, not help prose, owns public command exposure");
  for (const command of Object.keys(CLI_COMMAND_SPECS)) {
    assert.ok(output.includes(`dove ${command}`), `${command}: help exposes the parser's public commands`);
  }
  assert.match(output, /dove projects import --project <dir>/u);
  assert.match(output, /dove projects sync/u);
}

function countOccurrences(text, value) {
  return text.split(value).length - 1;
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/gu, "");
}

function assertDoveMascotRenderer() {
  const plainMascot = DOVE_PIXEL_ART.join("\n");
  assert.equal(DOVE_PIXEL_ART.length, 19, "terminal mascot must preserve the 32×32 artwork's occupied rows");
  assert.equal(Math.max(...DOVE_PIXEL_ART.map((line) => line.length)), 44, "terminal mascot must preserve two terminal columns per logical pixel");
  for (const line of DOVE_PIXEL_ART) {
    assert.match(line, /^[ █]*$/u, "terminal mascot must use only exact hard pixels and spaces");
    assert.equal(line.trimEnd(), line, "terminal mascot must not contain trailing spaces");
  }
  assert.equal(renderDovePixelArt(), plainMascot);
  const coloredMascot = renderDovePixelArt({ color: true });
  assert.equal(stripAnsi(coloredMascot), plainMascot, "color must not change Dove pixels");
  assert.match(coloredMascot, /\x1b\[36m/u, "Dove body must be cyan in a color terminal");
  assert.match(coloredMascot, /\x1b\[32m/u, "Dove branch must be green in a color terminal");
  assert.doesNotMatch(plainMascot, /[░▒▓▀▄]/u, "terminal mascot must not add glow or resampled pixels");

  const ttyNoColorHome = renderDoveHome({ stream: { isTTY: true }, env: { NO_COLOR: "1" }, state: "current" });
  assert.equal(countOccurrences(ttyNoColorHome, plainMascot), 1, "TTY home must show one mascot when color is disabled");
  assert.doesNotMatch(ttyNoColorHome, /\x1b\[/u);
  const ttyColorHome = renderDoveHome({ stream: { isTTY: true }, env: { NO_COLOR: "" }, state: "current" });
  assert.match(ttyColorHome, /\x1b\[32m/u, "empty NO_COLOR must keep the green branch");
  assert.equal(stripAnsi(ttyColorHome).includes(plainMascot), true);
  const nonTtyHome = renderDoveHome({ stream: { isTTY: false }, env: {}, state: "current" });
  assert.equal(nonTtyHome.includes(plainMascot), false, "non-TTY home must not show the mascot");
  assert.doesNotMatch(nonTtyHome, /\x1b\[/u);
}

function assertProjectIntegrationRenderer() {
  const output = renderProjectIntegrationResult("update", {
    status: "updated",
    target: "/workspace/example-project",
    hosts: ["claude"],
    writtenPaths: [".claude/settings.json"],
    removedPaths: [],
    changedPaths: [".claude/settings.json"],
    replacedLocalEdits: [{ path: `.claude/settings${String.fromCharCode(7)}.json`, selector: "/hooks/SessionStart[dove-session-start]" }]
  }, { stream: { isTTY: false }, env: {} });
  assert.match(output, /已覆盖 1 个 manifest-owned 本地编辑/u);
  assert.match(output, /\.claude\/settings\?\.json#\/hooks\/SessionStart\[dove-session-start\]/u);
  assert.match(output, /SessionStart 完全只读，不会修改这些本地编辑/u);
  assert.match(output, /主 agent.*读取两个短要点/u);
  assert.match(output, /安装本身不代表模型已经读过/u);
  assert.match(output, /现有主 agent.*补读/u);
  assert.match(output, /missions.*experiments.*claims.*保留原地/u);
  const warningOutput = renderProjectIntegrationResult("update", {
    status: "updated",
    target: "/workspace/example-project",
    hosts: ["claude"],
    writtenPaths: [],
    removedPaths: [],
    changedPaths: [],
    cleanupWarnings: [{ path: `.claude/transactions${String.fromCharCode(7)}`, reason: "permission denied" }],
    omittedCleanupWarningCount: 2
  }, { stream: { isTTY: false }, env: {} });
  assert.match(warningOutput, /主操作已提交.*3 项/u);
  assert.match(warningOutput, /transactions\?[^\n]*permission denied/u);
  assert.match(warningOutput, /不表示项目集成回滚/u);

  const initializedResult = {
    status: "initialized",
    target: "/workspace/example-project",
    hosts: ["claude"],
    removedPaths: [],
    changedPaths: []
  };
  const createdOverview = renderProjectIntegrationResult("init", {
    ...initializedResult,
    writtenPaths: [".dove/research/RESEARCH.md", ".dove/install/manifest.json"]
  }, { stream: { isTTY: false }, env: {} });
  assert.match(createdOverview, /最小研究入口 RESEARCH\.md 已建立/u);
  const preservedResearch = renderProjectIntegrationResult("init", {
    ...initializedResult,
    writtenPaths: [".dove/install/manifest.json"]
  }, { stream: { isTTY: false }, env: {} });
  assert.match(preservedResearch, /现有研究目录保持不变，未创建或补写研究文档/u);
  assert.doesNotMatch(preservedResearch, /研究入口(?: RESEARCH\.md)?已建立|研究入口 RESEARCH\.md 已建立/u);

  const plainMascot = renderDovePixelArt();
  const directInit = renderProjectIntegrationResult("init", {
    ...initializedResult,
    writtenPaths: [".dove/install/manifest.json"]
  }, { stream: { isTTY: true }, env: { NO_COLOR: "1" } });
  assert.equal(countOccurrences(directInit, plainMascot), 1, "direct TTY init must show one mascot");
  const suppressedInit = renderProjectIntegrationResult("init", {
    ...initializedResult,
    writtenPaths: [".dove/install/manifest.json"]
  }, { stream: { isTTY: true }, env: { NO_COLOR: "1" }, showMascot: false });
  assert.equal(suppressedInit.includes(plainMascot), false, "interactive init summary must be able to suppress its second mascot");
  const ttyUpdate = renderProjectIntegrationResult("update", {
    ...initializedResult,
    status: "updated",
    writtenPaths: []
  }, { stream: { isTTY: true }, env: { NO_COLOR: "1" } });
  assert.equal(ttyUpdate.includes(plainMascot), false, "update must not show the mascot");

  const dshOnly = renderProjectIntegrationResult("init", {
    ...initializedResult,
    hosts: ["dsh"],
    writtenPaths: [".dove/install/manifest.json"]
  }, { stream: { isTTY: false }, env: {} });
  assert.match(dshOnly, /DSH 没有 SessionStart/u);
  assert.match(dshOnly, /主 agent.*读取两个短要点/u);
  assert.doesNotMatch(dshOnly, /Claude startup/u);

  for (const hosts of [["claude"], ["dsh"], ["claude", "dsh"]]) {
    const alreadyInitialized = renderProjectIntegrationResult("init", {
      ...initializedResult,
      status: "already-initialized",
      hosts,
      writtenPaths: []
    }, { stream: { isTTY: false }, env: {} });
    assert.match(alreadyInitialized, /未刷新.*要点或宿主引导/u);
    assert.match(alreadyInitialized, /不能据此确认/u);
    assert.match(alreadyInitialized, /dove update/u);
    assert.match(alreadyInitialized, /安装本身不代表模型已经读过/u);
    assert.doesNotMatch(alreadyInitialized, /完整作者偏好已安装|startup 与 \/clear 会要求/u);
  }

  const claudeReinstall = renderDoveLifecycleResult("reinstall", {
    status: "reinstalled",
    hosts: ["claude"]
  }, { stream: { isTTY: false }, env: {} });
  assert.match(claudeReinstall, /AUTHOR_PREFERENCES\.md/u);
  assert.match(claudeReinstall, /Claude.*(?:会话|clear)/u);
  assert.match(claudeReinstall, /安装本身不代表.*读过/u);
  const warningReinstall = renderDoveLifecycleResult("reinstall", {
    status: "reinstalled",
    hosts: ["claude"],
    cleanupWarnings: [{ path: `.dove/transaction${String.fromCharCode(7)}`, reason: "busy" }],
    omittedCleanupWarningCount: 1
  }, { stream: { isTTY: false }, env: {} });
  assert.match(warningReinstall, /主操作已提交.*2 项/u);
  assert.match(warningReinstall, /不表示项目集成回滚/u);
  const dshReinstall = renderDoveLifecycleResult("reinstall", {
    status: "reinstalled",
    hosts: ["dsh"]
  }, { stream: { isTTY: false }, env: {} });
  assert.match(dshReinstall, /DSH 没有 SessionStart/u);
  assert.doesNotMatch(dshReinstall, /新开 Claude 会话/u);
}

function assertRunResultRenderer() {
  assert.equal(renderRunMetric(null), "未指定");
  assert.equal(renderRunMetric({ name: "score", direction: "max", unit: "f1", value: 0.9 }), "score max f1=0.9");

  const start = renderRunResult({
    command: "start",
    project: "/workspace/example-project",
    runId: "run-1",
    status: "running",
    supervisorPid: 1234,
    argv: ["node", "script.mjs"],
    cwd: "/workspace/example-project",
    seed: { declaration: "declared", value: "42" },
    commit: "a".repeat(40),
    dirty: false,
    paths: { journalPath: ".dove/runs/run-1/run.jsonl", stdoutPath: ".dove/runs/run-1/stdout.log", stderrPath: ".dove/runs/run-1/stderr.log" }
  });
  assert.match(start, /Dove run 已启动/u);
  assert.match(start, /seed（用户声明）：42/u);
  assert.match(start, /Git：commit [a-f0-9]{40}；dirty false/u);
  assert.match(start, /日志：\.dove\/runs\/run-1\/run\.jsonl/u);
  assert.doesNotMatch(start, /^Run：|^Journal：/mu);
  assert.match(start, /本地执行收据/u);

  const listStatus = renderRunResult({
    command: "status",
    project: "/workspace/example-project",
    group: "main",
    runs: [{ runId: "run-1", status: "terminal", group: "main", finalized: true, metric: { name: "score", direction: "max", value: 0.9 } }]
  });
  assert.match(listStatus, /Dove run 状态/u);
  assert.match(listStatus, /分组：main/u);
  assert.match(listStatus, /run-1：terminal，分组 main，指标 score max=0.9/u);

  const emptyListStatus = renderRunResult({ command: "status", project: "/workspace/example-project", runs: [] });
  assert.match(emptyListStatus, /尚无匹配的 \.dove\/runs\/\*\* 记录/u);

  const detailStatus = renderRunResult({
    command: "status",
    project: "/workspace/example-project",
    runId: "run-1",
    status: "terminal",
    lifecycle: "completed",
    terminal: true,
    finalized: false,
    exitCode: 0,
    signal: null,
    metric: { name: "score", direction: "max" },
    paths: { journalPath: ".dove/runs/run-1/run.jsonl", stdoutPath: ".dove/runs/run-1/stdout.log", stderrPath: ".dove/runs/run-1/stderr.log" }
  });
  assert.match(detailStatus, /PID 只作为观察信号，不是强身份/u);
  assert.match(detailStatus, /退出码：0/u);
  assert.match(detailStatus, /信号：无/u);
  assert.doesNotMatch(detailStatus, /^Run：|^Lifecycle：|^Terminal：|^Finalized：|^Exit：|^Signal：|^Metric：|^Journal：/mu);

  const resume = renderRunResult({ command: "resume", status: "terminal", action: "none", write: "none", reason: "already terminal", run: { runId: "run-1" } });
  assert.match(resume, /Dove run resume/u);
  assert.match(resume, /动作：none/u);

  const finalize = renderRunResult({ command: "finalize", summary: { runId: "run-1" }, event: { metric: { name: "score", direction: "max", unit: "f1", value: 0.9 }, decision: "keep", note: "ok" } });
  assert.match(finalize, /Dove run 已 finalize/u);
  assert.match(finalize, /指标：score max f1=0.9/u);
  assert.doesNotMatch(finalize, /^Metric：|^Decision：|^Note：/mu);

  const notComparable = renderRunResult({ command: "compare", comparable: false, fields: ["metric", "budget"] });
  assert.match(notComparable, /可比较：false/u);
  assert.match(notComparable, /Git commit\/dirty 只是运行事实/u);
  assert.match(notComparable, /terminal 且 finalized/u);
  assert.doesNotMatch(notComparable, /环境对比|environmentComparison/u);

  const comparable = renderRunResult({
    command: "compare",
    comparable: true,
    basis: { metric: { name: "score", direction: "max", value: 0.9 } },
    ranking: [{ rank: 1, runId: "run-1", metricValue: 0.9, deltaFromBest: 0 }]
  });
  assert.match(comparable, /可比较：true/u);
  assert.match(comparable, /1\. run-1 指标值 0\.9，与最佳差值 0/u);

  const fallback = renderRunResult({ command: "unknown", value: 1 });
  assert.equal(fallback, JSON.stringify({ command: "unknown", value: 1 }, null, 2));
}

function assertCliParserAdditionalCases() {
  const assertParserShape = (value) => {
    assert.deepEqual(Object.keys(value), ["command", "subcommand", "options", "passthrough"], "parser result must expose only command/subcommand/options/passthrough");
    return value;
  };
  assert.deepEqual(assertParserShape(parseDoveCli(["--help"])), { command: "--help", subcommand: null, options: {}, passthrough: [] });
  assert.deepEqual(assertParserShape(parseDoveCli(["--version"])), { command: "--version", subcommand: null, options: {}, passthrough: [] });
  assert.deepEqual(assertParserShape(parseDoveCli(["doctor", "--format=json"])), { command: "doctor", subcommand: null, options: { format: "json" }, passthrough: [] });
  assert.deepEqual(assertParserShape(parseDoveCli(["run", "compare", "--project", "/workspace", "--id", "run-a", "--id=run-b"])), {
    command: "run",
    subcommand: "compare",
    options: { project: "/workspace", id: ["run-a", "run-b"] },
    passthrough: []
  });

  for (const [argv, pattern, jsonRequested] of [
    [["--help", "extra"], /--help 后面不接受其他参数/iu, false],
    [["doctor", "--json=true"], /--json 不接受值/iu, true],
    [["doctor", "--json", "--json"], /--json 只能提供一次/iu, true],
    [["init", "--host", ",,"], /--host 需要一个值/iu, false],
    [["init", "--host", "all"], /--host 只接受 claude 或 dsh/iu, false],
    [["doctor", "--json", "--", "--format", "json"], /doctor 不接受位置参数/iu, true]
  ]) {
    let caught = null;
    try {
      parseDoveCli(argv);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof Error, `${argv.join(" ")} must fail parsing`);
    assert.match(caught.message, pattern);
    assert.equal(caught.jsonRequested, jsonRequested, "parser error jsonRequested must reflect only flags before '--'");
  }
}

export function assertCliParserAndRenderers() {
  assertRuntimeCli();
  assertCliParserAdditionalCases();
  assertDoveCliHelpRenderer();
  assertDoveMascotRenderer();
  assertProjectIntegrationRenderer();
  assertRunResultRenderer();
}
