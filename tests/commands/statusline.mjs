import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatContextCapacity,
  formatSessionDuration,
  inspectGitBranch,
  inspectResearchMainline,
  parseDoveStatusLinePayload,
  parseResearchMainline,
  renderDoveStatusLine
} from "../../src/core/statusline.mjs";
import { RESEARCH_DEFAULT_DOCUMENTS } from "../../src/core/research-defaults.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function assertDoveStatusLineRenderer() {
  const payload = {
    model: { display_name: "gpt-5.6-sol(high)" },
    context_window: {
      context_window_size: 272_000,
      used_percentage: 76,
      remaining_percentage: 24
    },
    cost: { total_duration_ms: ((54 * 60) + 34) * 60_000 }
  };
  const options = {
    projectRoot: "/workspace/project with spaces",
    branch: "work-branch",
    mainline: "检验观测误差对机制识别的影响",
    env: {}
  };
  const expected = "gpt-5.6-sol(high) (272K) · ctx 24% · " +
    "\x1b[36m检验观测误差对机制识别的影响\x1b[0m · work-branch · 54h34m\n/workspace/project with spaces";
  assert.equal(renderDoveStatusLine(payload, options), expected);
  assert.equal(renderDoveStatusLine(payload, { ...options, env: { NO_COLOR: "" } }), expected);
  for (const NO_COLOR of ["1", "0", " "]) {
    assert.equal(renderDoveStatusLine(payload, { ...options, env: { NO_COLOR } }), expected.replace(/\x1b\[\d+m/gu, ""));
  }
  assert.equal(renderDoveStatusLine(payload, { ...options, mainline: null }),
    "gpt-5.6-sol(high) (272K) · ctx 24% · work-branch · 54h34m\n/workspace/project with spaces");
  assert.equal(renderDoveStatusLine({}, { ...options, mainline: null, branch: null }),
    "Dove\n/workspace/project with spaces");
  assert.equal(renderDoveStatusLine({}, { ...options, mainline: "Text\x1b[31m\nInjected", env: { NO_COLOR: "1" } }),
    "Text?[31m?Injected · work-branch\n/workspace/project with spaces");
  assert.equal(renderDoveStatusLine({}, { ...options, mainline: "甲".repeat(81), env: { NO_COLOR: "1" } }),
    `${"甲".repeat(79)}… · work-branch\n/workspace/project with spaces`);
  assert.equal(renderDoveStatusLine({
    model: { display_name: "Opus 4.8 (1M context)" },
    context_window: { context_window_size: 1_000_000, used_percentage: 85 },
    cost: {}
  }, { branch: null }), "Opus 4.8 (1M context)", "used percentage must not masquerade as remaining context");
  assert.equal(renderDoveStatusLine({
    model: { display_name: "Model\nInjected" },
    context_window: { remaining_percentage: 0 },
    cost: { total_duration_ms: 0 }
  }, { branch: "main\rbranch" }), "Model?Injected · ctx 0% · main?branch · 0m");
  assert.equal(renderDoveStatusLine("{broken", { branch: null }), "Dove");
  assert.deepEqual(parseDoveStatusLinePayload("[]"), {});
  assert.equal(formatContextCapacity(1_500_000), "1.5M");
  assert.equal(formatContextCapacity(undefined), null);
  assert.equal(formatSessionDuration(59_999), "0m");
  assert.equal(formatSessionDuration(undefined), null);

  let invocation = null;
  assert.equal(inspectGitBranch("/workspace/project", {
    timeoutMs: 125,
    spawnSync(command, argv, options) {
      invocation = { command, argv, options };
      return { status: 0, signal: null, stdout: "research-mainline\n", stderr: "" };
    }
  }), "research-mainline");
  assert.deepEqual(invocation.command, "git");
  assert.deepEqual(invocation.argv, ["branch", "--show-current"]);
  assert.equal(invocation.options.cwd, "/workspace/project");
  assert.equal(invocation.options.timeout, 125);
  assert.equal(invocation.options.env.GIT_CEILING_DIRECTORIES, "/workspace");
  assert.equal(inspectGitBranch("/workspace/project", {
    spawnSync() { return { status: 1, signal: null, stdout: "" }; }
  }), null);
  assert.equal(inspectGitBranch("/workspace/project", {
    spawnSync() { throw new Error("git unavailable"); }
  }), null);
}

export function assertResearchMainlineParsing() {
  assert.equal(parseResearchMainline("# Research\r\n\r\nMainline:  确认的问题与目标  \r\n"), "确认的问题与目标");
  assert.equal(parseResearchMainline("Mainline: Current goal"), "Current goal");
  for (const text of [
    "", "# Mainline: Heading", "Mainline: Heading\n===", "Mainline: Heading\n---",
    "- Mainline: List", "> Mainline: Quote",
    "    Mainline: Indented code", "\tMainline: Code", "mainline: Wrong case",
    "Mainline:No space", "Mainline:", "Mainline:   ",
    "Mainline: First\nMainline: Second", "Mainline: Same\nMainline: Same",
    "Mainline: Goal\nMainline:", "```md\nMainline: Example\n```",
    "~~~markdown\nMainline: Example\n~~~", "---\nMainline: Metadata\n---",
    "The confirmed mainline is described only in prose."
  ]) assert.equal(parseResearchMainline(text), null, text);
  const examples = "---\nMainline: Metadata\n---\n````md\n```\nMainline: Example\n````\n" +
    "~~~\nMainline: Another example\n~~~\nMainline: Actual goal\n> Mainline: Quote\n";
  assert.equal(parseResearchMainline(examples), "Actual goal");
  assert.equal(parseResearchMainline(RESEARCH_DEFAULT_DOCUMENTS[0].content), null, "fresh bootstrap is not a confirmed mainline");
}

function withStatusLineFixture(run) {
  const scratch = path.join(ROOT, ".claude", "tmp");
  fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, "dove-statusline-"));
  try {
    const project = path.join(root, "project with spaces");
    fs.mkdirSync(project);
    const overview = path.join(project, ".dove", "research", "RESEARCH.md");
    const writeOverview = (content) => {
      fs.mkdirSync(path.dirname(overview), { recursive: true });
      fs.writeFileSync(overview, content);
    };
    run({ root, project, overview, writeOverview });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export function assertResearchMainlineReadBoundary() {
  withStatusLineFixture(({ root, project, overview, writeOverview }) => {
    assert.equal(inspectResearchMainline(project), null);
    assert.deepEqual(fs.readdirSync(project), [], "missing overview must not trigger bootstrap");
    writeOverview("# Research\nMainline: 合成主线\n");
    const before = fs.statSync(overview);
    const opened = [];
    const unexpected = [];
    let bytesRead = 0;
    let closed = 0;
    const fsOps = new Proxy(fs, {
      get(target, name) {
        if (name === "openSync") return (file, flags) => {
          opened.push(file);
          assert.equal(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT), 0);
          return fs.openSync(file, flags);
        };
        if (name === "readSync") return (fd, buffer, offset, length, position) => {
          assert.ok(offset + length <= 64 * 1024 + 1, "bounded buffer even across partial reads");
          const count = fs.readSync(fd, buffer, offset, Math.min(length, 7), position);
          bytesRead += count;
          return count;
        };
        if (name === "closeSync") return (fd) => { closed++; fs.closeSync(fd); };
        if (["realpathSync", "lstatSync", "fstatSync"].includes(name)) return target[name];
        unexpected.push(name);
        throw new Error(`Unexpected filesystem operation: ${String(name)}`);
      }
    });
    assert.equal(inspectResearchMainline(project, { fsOps }), "合成主线");
    assert.deepEqual(opened, [overview]);
    assert.deepEqual(unexpected, []);
    assert.equal(bytesRead, before.size);
    assert.equal(closed, 1);
    assert.equal(fs.statSync(overview).mtimeMs, before.mtimeMs);
    assert.equal(inspectResearchMainline(project, { fsOps: { ...fs, openSync() { throw new Error("unreadable"); } } }), null);
    writeOverview(Buffer.from([0xff, 0xfe]));
    assert.equal(inspectResearchMainline(project), null);
    writeOverview("Mainline: Too large\n" + "x".repeat(64 * 1024));
    assert.equal(inspectResearchMainline(project, { fsOps }), null);
    assert.equal(opened.length, 1, "known oversized files are not opened");
    assert.equal(inspectResearchMainline(project, {
      fsOps: { ...fs, lstatSync(file) {
        const stat = fs.lstatSync(file);
        if (file === overview) stat.size = 1;
        return stat;
      } }
    }), null, "reads remain bounded if the overview grows after stat");
    fs.unlinkSync(overview);
    fs.mkdirSync(overview);
    assert.equal(inspectResearchMainline(project), null, "directories are not display sources");
    fs.rmdirSync(overview);
    const target = path.join(root, "synthetic-outside.md");
    fs.writeFileSync(target, "Mainline: Not in project\n");
    fs.symlinkSync(target, overview);
    assert.equal(inspectResearchMainline(project), null, "do not follow overview symlinks");
    fs.unlinkSync(overview);
    fs.rmdirSync(path.dirname(overview));
    fs.symlinkSync(root, path.dirname(overview), "dir");
    assert.equal(inspectResearchMainline(project), null, "do not follow parent directory symlinks");
  });
}

export function assertDoveStatusLineCli() {
  withStatusLineFixture(({ project, writeOverview }) => {
    const env = { ...process.env };
    delete env.NO_COLOR;
    writeOverview("# Research\nMainline: 合成确认主线\n");
    const payload = JSON.stringify({
      model: { display_name: "Synthetic model" },
      context_window: { context_window_size: 272_000, remaining_percentage: 24 },
      cost: { total_duration_ms: 120_000 },
      workspace: { project_dir: "/not-the-explicit-project" }
    });
    const expected = `Synthetic model (272K) · ctx 24% · \x1b[36m合成确认主线\x1b[0m · 2m\n${project}\n`;

    for (const entry of ["bin/dove.mjs", "bin/dove-package.mjs"]) {
      const result = spawnSync(process.execPath, [
        path.join(ROOT, entry), "hook", "statusline", "--project", project
      ], {
        cwd: project,
        input: payload,
        encoding: "utf8",
        env,
        timeout: 10_000
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      assert.equal(result.stdout, expected, entry);
    }
  });
}
