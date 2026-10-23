import assert from "node:assert/strict";

import { CLI_COMMAND_SPECS, parseDoveCli } from "../../src/cli/command-parser.mjs";
import { renderDoveHelp } from "../../src/cli/help-output.mjs";
import { renderProjectIntegrationResult } from "../../src/cli/project-integration-output.mjs";
import {
  DOVE_PIXEL_ART,
  renderDoveHome,
  renderDoveLifecycleResult,
  renderDovePixelArt
} from "../../src/cli/terminal-output.mjs";

function assertRuntimeCli() {
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "init"));
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "hook"));
  assert.deepEqual(Object.keys(CLI_COMMAND_SPECS.hook.subcommands), ["session-start", "user-prompt-submit", "statusline", "stop"], "hook subcommands must be formal parser subcommands");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "mcp"), false, "CLI must not expose the retired MCP server");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "migrate-research"), false, "CLI must not expose format migration");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "export-research"), false, "CLI must not expose the retired legacy export command");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "review"), false, "Review is a native read-only Agent, not a CLI model or record runtime");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "run"), false, "run receipts are retired; EVAL rows link their result files");

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
  assert.deepEqual(parseDoveCli(["settings", "--stop-prompts", "off"]), {
    command: "settings", subcommand: null, options: { stopPrompts: "off" }, passthrough: []
  });
  assertParserError(["settings", "--stop-prompts", "maybe"], /--stop-prompts 只接受 on 或 off/u, false);
  assert.deepEqual(parseDoveCli(["mentor", "brief", "--watch"]), {
    command: "mentor", subcommand: "brief", options: { watch: true }, passthrough: []
  });
  assert.deepEqual(parseDoveCli(["mentor", "brief", "--trigger", "用户纠正", "--user-source", "/source", "--since", "2026-10-14", "--until", "2026-10-15", "--user-original", "原话", "--opinion", "opinion.md", "--artifact", "a.csv", "--artifact", "b.png"]), {
    command: "mentor", subcommand: "brief", options: { trigger: "用户纠正", userSource: "/source", since: "2026-10-14", until: "2026-10-15", userOriginal: "原话", opinion: "opinion.md", artifact: ["a.csv", "b.png"] }, passthrough: []
  });
  assertParserError(["mentor", "brief", "--task", "请裁决工程"], /Dove 不支持这个参数：--task/u, false);
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS.figure, "subcommands"), false, "figure generation and editing share one CLI entry point");
  assert.deepEqual(CLI_COMMAND_SPECS.figure.options.map((option) => option.name), ["--project", "--prompt", "--prompt-file", "--image", "--output", "--size", "--quality", "--background", "--tools", "--json", "--format"]);
  assert.deepEqual(assertParserShape(parseDoveCli(["figure", "--project", "/workspace", "--prompt-file", "prompt.txt", "--output", "figures/new.png", "--json"])), {
    command: "figure", subcommand: null, options: { project: "/workspace", promptFile: "prompt.txt", output: "figures/new.png", json: true }, passthrough: []
  });
  assert.deepEqual(parseDoveCli(["figure", "--project=/workspace", "--prompt-file=prompts/figure prompt.txt", "--image", "inputs/reference,style.png", "--image=inputs/edit target.png", "--image", "inputs/reference,style.png", "--output=figures/new.png", "--size=1536x1024", "--format", "json"]), {
    command: "figure", subcommand: null,
    options: { project: "/workspace", promptFile: "prompts/figure prompt.txt", image: ["inputs/reference,style.png", "inputs/edit target.png", "inputs/reference,style.png"], output: "figures/new.png", size: "1536x1024", format: "json" },
    passthrough: []
  }, "figure input paths retain their order and spelling for the core module to resolve against the project root");
  assert.deepEqual(parseDoveCli(["figure", "--prompt-file", "prompt.txt", "--image", "input.png", "--output", "new.png", "--size", "1024x1024", "--format=json"]), {
    command: "figure", subcommand: null, options: { promptFile: "prompt.txt", image: ["input.png"], output: "new.png", size: "1024x1024", format: "json" }, passthrough: []
  }, "a single image is still an array and an omitted project is left for the CLI's cwd default");
  for (const option of ["--project", "--prompt-file", "--image", "--output", "--size"]) {
    assertParserError(["figure", option], new RegExp(`${option} 需要一个值`, "u"), false);
    assertParserError(["figure", `${option}=`], new RegExp(`${option} 需要一个值`, "u"), false);
    assertParserError(["figure", option, "--json"], new RegExp(`${option} 需要一个值`, "u"), true);
    if (option !== "--image") {
      assertParserError(["figure", option, "first", option, "second", "--format=json"], new RegExp(`${option} 只能提供一次`, "u"), true);
    }
  }
  for (const subcommand of ["generate", "edit", "configure"]) {
    assertParserError(["figure", subcommand, "--json"], /figure 不接受位置参数/u, true);
  }
  for (const option of ["--provider", "--model", "--base-url", "--api-key", "--api-key-env", "--approve"]) {
    assertParserError(["figure", option, "value", "--json"], /Dove 不支持这个参数/u, true);
  }
  assertParserError(["figure", "--json", "--format", "json"], /--format 不能和 --json 同时使用/u, true);
  assertParserError(["figure", "--format=json", "--json"], /--json 不能和 --format 同时使用/u, true);
  assertParserError(["figure", "--format", "text"], /--format 只接受 json/u, false);
  assertParserError(["figure", "--", "--json"], /figure 不接受位置参数/u, false);
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
  assert.deepEqual(parseDoveCli(["hook", "stop", "--project=/workspace"]), {
    command: "hook", subcommand: "stop", options: { project: "/workspace" }, passthrough: []
  });
  assertParserError(["hook", "pre-tool-use", "--project=/workspace"], /hook 只接受这些子命令/u, false);
  assert.deepEqual(assertParserShape(parseDoveCli(["init", "--host", "claude", "--host=claude", "--project=/workspace"])), {
    command: "init",
    subcommand: null,
    options: { host: ["claude"], project: "/workspace" },
    passthrough: []
  });
  assertParserError(["init", "--host", "dsh"], /--host 只接受 claude/iu, false);
  assertParserError(["doctor", "--json", "--format", "json"], /--format 不能和 --json 同时使用/iu, true);
  assertParserError(["doctor", "--", "--json"], /doctor 不接受位置参数/iu, false);
  assertParserError(["mcp", "serve"], /Dove 不支持这个命令：mcp/iu, false);
  assertParserError(["run", "start", "--project", "/workspace", "--", "node"], /Dove 不支持这个命令：run/iu, false);
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
  assert.doesNotMatch(output, /dove run /u);
  assert.match(output, /dove hook stop --project <dir>/u);
  assert.match(output, /dove settings \[--host-migration on\|off\] \[--stop-prompts on\|off\]/u);
  assert.match(output, /超时.*停滞.*各引用一次用户原话追问/u);
  assert.match(output, /dove hook session-start --project <dir>/u);
  assert.match(output, /dove hook user-prompt-submit --project <dir>/u);
  assert.match(output, /dove figure --project <root> \(--prompt <text>\|--prompt-file <file>\) \[--image <file> \.\.\.\] --output <file\.png> \[--size <size>\]/u);
  assert.match(output, /dove figure --tools \[--json\|--format json\]/u);
  const figureHelp = output.split("\n").find((line) => line.startsWith("dove figure "));
  assert.ok(figureHelp, "help explains the figure command's model and data boundary");
  assert.match(figureHelp, /settings\.figure.*baseURL.*model.*apiKeyEnv.*配置.*图像模型/u);
  assert.match(figureHelp, /发送.*prompt.*输入图.*授权/u);
  assert.match(figureHelp, /--image.*生成.*编辑.*--image.*重复/u);
  assert.match(figureHelp, /相对.*路径.*--project.*当前目录/u);
  assert.match(figureHelp, /CLI.*不能调用.*宿主内置 image_gen/u);
  assert.match(output, /导师 dove-mentor.*论文审稿 dove-review.*宿主原生.*全新只读/u);
  assert.deepEqual(Object.keys(CLI_COMMAND_SPECS), ["init", "update", "reinstall", "uninstall", "doctor", "dashboard", "watch", "topic", "figure", "settings", "mentor", "projects", "hook"], "CLI inventory, not help prose, owns public command exposure");
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
  assert.match(output, /主会话本人先读“用户最常说的话”/u);
  assert.match(output, /安装本身不代表模型已经读过/u);
  assert.match(output, /已打开的会话.*一次更新提示/u);
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

  const pending = renderProjectIntegrationResult("update", {
    ...initializedResult, status: "unchanged", hosts: ["claude"], hostMigrationPending: ".dove/install/MIGRATION_PENDING.md"
  }, { stream: { isTTY: false }, env: {} });
  assert.match(pending, /宿主迁移待办：\.dove\/install\/MIGRATION_PENDING\.md/u);
  assert.match(pending, /当前工作告一段落且用户允许/u);

  for (const hosts of [["claude"]]) {
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
}

function assertCliParserAdditionalCases() {
  const assertParserShape = (value) => {
    assert.deepEqual(Object.keys(value), ["command", "subcommand", "options", "passthrough"], "parser result must expose only command/subcommand/options/passthrough");
    return value;
  };
  assert.deepEqual(assertParserShape(parseDoveCli(["--help"])), { command: "--help", subcommand: null, options: {}, passthrough: [] });
  assert.deepEqual(assertParserShape(parseDoveCli(["--version"])), { command: "--version", subcommand: null, options: {}, passthrough: [] });
  assert.deepEqual(assertParserShape(parseDoveCli(["doctor", "--format=json"])), { command: "doctor", subcommand: null, options: { format: "json" }, passthrough: [] });

  for (const [argv, pattern, jsonRequested] of [
    [["--help", "extra"], /--help 后面不接受其他参数/iu, false],
    [["doctor", "--json=true"], /--json 不接受值/iu, true],
    [["doctor", "--json", "--json"], /--json 只能提供一次/iu, true],
    [["init", "--host", ",,"], /--host 需要一个值/iu, false],
    [["init", "--host", "all"], /--host 只接受 claude/iu, false],
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
}
