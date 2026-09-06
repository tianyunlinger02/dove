import assert from "node:assert/strict";

import { CLI_COMMAND_SPECS, parseDoveCli } from "../../src/cli/command-parser.mjs";
import { renderDoveHelp } from "../../src/cli/help-output.mjs";
import { renderProjectIntegrationResult } from "../../src/cli/project-integration-output.mjs";
import { renderReviewResult } from "../../src/cli/review-output.mjs";
import { renderRunMetric, renderRunResult } from "../../src/cli/run-output.mjs";
import { normalizeReviewId } from "../../src/core/review-workspace.mjs";

function assertRuntimeCli() {
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "init"));
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "hook"));
  assert.deepEqual(Object.keys(CLI_COMMAND_SPECS.hook.subcommands), ["session-start", "statusline"], "hook subcommands must be formal parser subcommands");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "mcp"), false, "CLI must not expose the retired MCP server");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "migrate-research"), false, "CLI must not expose format migration");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "export-research"), false, "CLI must not expose the retired legacy export command");
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "review"), "CLI must expose explicit isolated review handoff runtime");
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

  assert.deepEqual(assertParserShape(parseDoveCli(["review", "handoff", "--project=/workspace", "--venue", "TestConf", "--material", "paper/main.tex", "--material=build/main.pdf", "--id", "review-1", "--json"])), {
    command: "review",
    subcommand: "handoff",
    options: { project: "/workspace", venue: "TestConf", material: ["paper/main.tex", "build/main.pdf"], id: "review-1", json: true },
    passthrough: []
  });
  for (const subcommand of ["handoff", "rerun"]) {
    assert.equal(CLI_COMMAND_SPECS.review.subcommands[subcommand].options.some((option) => option.name === "--file"), false);
    for (const fileOption of [["--file", "return.md"], ["--file=return.md"]]) {
      assertParserError(["review", subcommand, "--project=/workspace", "--json", ...fileOption], /Dove 不支持这个参数：--file/u, true);
    }
  }
  assert.deepEqual(assertParserShape(parseDoveCli(["review", "import", "--project=/workspace", "--id", "review-1", "--file=return.md", "--venue", "TestConf", "--material", "paper/main.tex"])), {
    command: "review",
    subcommand: "import",
    options: { project: "/workspace", id: "review-1", file: "return.md", venue: "TestConf", material: ["paper/main.tex"] },
    passthrough: []
  });
  assertParserError(["hook", "user-prompt-submit", "--project=/workspace"], /hook 只接受这些子命令：session-start(?:，或| 或) statusline/iu, false);
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
  assertParserError(["review"], /review 只接受这些子命令/iu, false);
  assertParserError(["review", "unknown"], /review 只接受这些子命令/iu, false);
}

function assertDoveCliHelpRenderer() {
  const output = renderDoveHelp();
  assert.match(output, /^dove\n/u);
  assert.match(output, /dove init \[--project <dir>\] \[--host <host>\.\.\.\] \[--json\|--format json\]/u);
  assert.match(output, /dove review handoff --project <dir> --venue <venue> --material <path>\.\.\./u);
  assert.match(output, /dove run start --project <dir>.*--seed <short-text>.* -- <command> \[args\.\.\.\]/u);
  assert.match(output, /dove hook session-start --project <dir>/u);
  assert.doesNotMatch(output, /dove hook user-prompt-submit/u);
  assert.match(output, /doctor、review、run 与 hook 等项目级命令/u);
  assert.match(output, /真正的科研推进仍在一个 Dove agent 中完成/u);
  assert.match(output, /研究记录是研究者维护的普通 Markdown/u);
  assert.match(output, /Dove 只管理 SessionStart 项目 hook，不安装也不暴露 UserPromptSubmit 或 Stop hook/u);
  assert.doesNotMatch(output, /(^|[^A-Za-z0-9_])mcp([^A-Za-z0-9_]|$)|migrate-research|export-research|auto|paper-factory/iu);
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
  assert.match(output, /SessionStart 只会跳过这些本地编辑并提醒/u);

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
}

function assertReviewResultRenderer() {
  assert.equal(normalizeReviewId("review-20260904-a1b2c3"), "review-20260904-a1b2c3");
  for (const unsafeId of ["CON", "review.", "review-", "review/1", " review", ".."]) {
    assert.throws(() => normalizeReviewId(unsafeId), /path-safe|must not use a reserved device name|must start and end/iu, `${unsafeId} must not be accepted as a review id`);
  }

  const emptyStatus = renderReviewResult({ command: "status", project: "/workspace/example-project", reviews: [] });
  assert.match(emptyStatus, /Dove review 状态/u);
  assert.match(emptyStatus, /尚无 \.dove\/reviews\/\*\* 记录/u);

  const listStatus = renderReviewResult({
    command: "status",
    project: "/workspace/example-project",
    reviews: [{ reviewId: "review-1", status: "completed", currentRound: 2, sessionId: "session-1" }]
  });
  assert.match(listStatus, /review-1：completed，轮次 2，会话 session-1/u);

  const detailedStatus = renderReviewResult({
    command: "status",
    project: "/workspace/example-project",
    reviewId: "review-1",
    status: "completed",
    currentRound: 2,
    sessionId: null,
    materialCurrentness: {
      overall: "changed",
      items: [
        { path: "paper/main.tex", status: "changed", expected: { size: 123, sha256: "a".repeat(64) }, observed: { exists: true, type: "file", size: 124, sha256: "b".repeat(64) } },
        { path: "paper/link.tex", status: "changed", expected: { size: 123, sha256: "a".repeat(64) }, observed: { exists: true, type: "symlink" } }
      ]
    },
    rounds: [{ round: 1, status: "completed", provenance: "runtime", reportPath: ".dove/reviews/review-1/rounds/1/report.md", latestReportPath: ".dove/reviews/review-1/rounds/1/report-imported.md", materialCurrentness: { overall: "missing", items: [] } }]
  });
  assert.match(detailedStatus, /审阅记录：review-1/u);
  assert.match(detailedStatus, /会话：无/u);
  assert.match(detailedStatus, /当前轮次材料版本关系：changed/u);
  assert.match(detailedStatus, /paper\/main\.tex：changed（snapshot 123 bytes；observed file 124 bytes）/u);
  assert.match(detailedStatus, /paper\/link\.tex：changed（snapshot 123 bytes；observed symlink \(not followed\)）/u);
  assert.match(detailedStatus, /verdict 是对应 frozen snapshot 的历史判断/u);
  assert.match(detailedStatus, /不解析报告文字来猜 PASS\/REVISE/u);
  assert.doesNotMatch(detailedStatus, /^Review：|^Session：|^Backend：/mu);
  assert.match(detailedStatus, /轮次 1：completed（runtime），报告 \.dove\/reviews\/review-1\/rounds\/1\/report-imported\.md/u);
  assert.match(detailedStatus, /原始报告保留在 \.dove\/reviews\/review-1\/rounds\/1\/report\.md/u);
  assert.match(detailedStatus, /材料 missing/u);

  const unavailableStatus = renderReviewResult({
    command: "status",
    project: "/workspace/example-project",
    reviewId: "review-1",
    materialCurrentness: { overall: "unavailable", items: [], error: "ENOENT: snapshot" + String.fromCharCode(7) + ".json" },
    rounds: []
  });
  assert.match(unavailableStatus, /材料版本检查失败：ENOENT: snapshot\?\.json/u);
  assert.doesNotMatch(unavailableStatus, /无 frozen materials 可比较/u);
  const noMaterialsStatus = renderReviewResult({
    command: "status",
    materialCurrentness: { overall: "unavailable", items: [] },
    rounds: []
  });
  assert.match(noMaterialsStatus, /无 frozen materials 可比较/u);

  const handoff = renderReviewResult({
    command: "handoff",
    project: "/workspace/example-project",
    reviewId: "review-1",
    round: 1,
    status: "waiting",
    provenance: "runtime",
    sessionId: "session-1",
    reportPath: ".dove/reviews/review-1/rounds/1/report.md",
    backendPath: ".dove/reviews/review-1/rounds/1/backend.json",
    materials: [{ path: "paper/main.tex", size: 123 }, { path: "paper/unsafe" + String.fromCharCode(7) + ".tex", size: "bad" + String.fromCharCode(0) }]
  });
  assert.match(handoff, /Dove review handoff 已完成/u);
  assert.match(handoff, /paper\/main\.tex \(123 bytes\)/u);
  assert.match(handoff, /paper\/unsafe\?\.tex \(bad\? bytes\)/u);
  assert.match(handoff, /Reviewer 只接收本轮冻结材料/u);

  for (const command of ["handoff", "resume", "rerun"]) {
    const failed = renderReviewResult({
      command,
      status: "failed",
      project: "/workspace/example-project",
      reviewId: "review-1",
      round: 1,
      provenance: "runtime",
      materials: []
    });
    assert.match(failed, /^Dove review 运行失败；未生成本次 reviewer 报告/u);
    assert.match(failed, /状态：failed/u);
    assert.doesNotMatch(failed, /handoff 已完成|已恢复并更新|已在同一 reviewer session 中开始/u);
  }
  const failedStatus = renderReviewResult({ command: "status", status: "failed", reviewId: "review-1", rounds: [] });
  assert.match(failedStatus, /^Dove review 状态/u);
  assert.doesNotMatch(failedStatus, /运行失败；未生成本次/u);
  const completedNegativeReview = renderReviewResult({ command: "handoff", status: "completed", report: "## Verdict\nREVISE", materials: [] });
  assert.match(completedNegativeReview, /^Dove review handoff 已完成/u);

  const imported = renderReviewResult({
    command: "import",
    project: "/workspace/example-project",
    reviewId: "review-1",
    round: 2,
    status: "imported",
    provenance: "imported",
    sessionId: null,
    reportPath: ".dove/reviews/review-1/rounds/2/report.md",
    backendPath: ".dove/reviews/review-1/rounds/2/backend.json",
    materials: []
  });
  assert.match(imported, /Dove review return 已导入/u);
  assert.match(imported, /无；这是导入的外部返回记录/u);
  assert.match(imported, /按用户提供文件原样保存/u);

  const safe = renderReviewResult({
    command: "status",
    project: "/workspace" + String.fromCharCode(0) + "bad",
    reviews: [{ reviewId: "review" + String.fromCharCode(7) + "bad", status: "ok", currentRound: 1 }]
  });
  assert.match(safe, /\?/u);
  for (const character of safe) {
    const code = character.codePointAt(0);
    assert.ok(code === 10 || code >= 32, "review renderer must replace non-newline control characters");
  }
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
  assert.deepEqual(assertParserShape(parseDoveCli(["review", "status", "--project", "/workspace", "--id", "review-1", "--format", "json"])), {
    command: "review",
    subcommand: "status",
    options: { project: "/workspace", id: "review-1", format: "json" },
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
  assertProjectIntegrationRenderer();
  assertReviewResultRenderer();
  assertRunResultRenderer();
}
