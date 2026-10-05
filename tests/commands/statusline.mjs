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
import { DOVE_IDENTITY_CARD_PATH, readDoveIdentityCard } from "../../src/core/identity-card.mjs";
import { RESEARCH_DEFAULT_DOCUMENTS } from "../../src/core/research-defaults.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function assertDoveStatusLineRenderer() {
  const payload = {
    model: { display_name: "gpt-5.6-sol(high)" },
    context_window: { context_window_size: 272_000, used_percentage: 76, remaining_percentage: 24 },
    cost: { total_duration_ms: ((54 * 60) + 34) * 60_000 }
  };
  const options = { projectRoot: "/workspace/project with spaces", branch: "work-branch", mainline: "检验观测误差对机制识别的影响", env: {} };
  const expected = "gpt-5.6-sol(high) (272K) · ctx 24% · " +
    "\x1b[36m检验观测误差对机制识别的影响\x1b[0m · work-branch · 54h34m\n/workspace/project with spaces";
  assert.equal(renderDoveStatusLine(payload, options), expected);
  assert.equal(renderDoveStatusLine(payload, { ...options, env: { NO_COLOR: "" } }), expected);
  for (const NO_COLOR of ["1", "0", " "]) {
    assert.equal(renderDoveStatusLine(payload, { ...options, env: { NO_COLOR } }), expected.replace(/\x1b\[\d+m/gu, ""));
  }
  assert.equal(renderDoveStatusLine(payload, { ...options, mainline: null }),
    "gpt-5.6-sol(high) (272K) · ctx 24% · work-branch · 54h34m\n/workspace/project with spaces");
  assert.equal(renderDoveStatusLine({}, { ...options, mainline: null, branch: null }), "Dove\n/workspace/project with spaces");
  assert.equal(renderDoveStatusLine({}, { ...options, mainline: "Text\x1b[31m\nInjected", env: { NO_COLOR: "1" } }),
    "Text?[31m?Injected · work-branch\n/workspace/project with spaces");
  assert.equal(renderDoveStatusLine({}, { ...options, mainline: "甲".repeat(81), env: { NO_COLOR: "1" } }),
    `${"甲".repeat(79)}… · work-branch\n/workspace/project with spaces`);
  assert.equal(renderDoveStatusLine({ model: { display_name: "Opus 4.8 (1M context)" }, context_window: { context_window_size: 1_000_000, used_percentage: 85 }, cost: {} }, { branch: null }),
    "Opus 4.8 (1M context)", "used percentage must not masquerade as remaining context");
  assert.equal(renderDoveStatusLine({ model: { display_name: "Model\nInjected" }, context_window: { remaining_percentage: 0 }, cost: { total_duration_ms: 0 } }, { branch: "main\rbranch" }),
    "Model?Injected · ctx 0% · main?branch · 0m");
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
  assert.equal(invocation.command, "git");
  assert.deepEqual(invocation.argv, ["branch", "--show-current"]);
  assert.equal(invocation.options.cwd, "/workspace/project");
  assert.equal(invocation.options.timeout, 125);
  assert.equal(invocation.options.env.GIT_CEILING_DIRECTORIES, "/workspace");
  assert.equal(inspectGitBranch("/workspace/project", { spawnSync() { return { status: 1, signal: null, stdout: "" }; } }), null);
  assert.equal(inspectGitBranch("/workspace/project", { spawnSync() { throw new Error("git unavailable"); } }), null);
}

export function assertResearchMainlineParsing() {
  assert.equal(parseResearchMainline("# Identity\n\nMainline:  用户确认的合成目标  \n"), "用户确认的合成目标");
  assert.equal(parseResearchMainline("Mainline: First\nMainline: Second\n"), null);
  for (const text of ["", "# Mainline: Heading", "- Mainline: List", "> Mainline: Quote", "```\nMainline: Example\n```", "---\nMainline: Metadata\n---", "Mainline: "]) {
    assert.equal(parseResearchMainline(text), null, text);
  }
  assert.equal(parseResearchMainline(RESEARCH_DEFAULT_DOCUMENTS[0].content), null, "fresh bootstrap does not invent a mainline");
}

function withStatusLineFixture(run) {
  const scratch = path.join(ROOT, ".claude", "tmp");
  fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, "dove-statusline-"));
  try {
    const project = path.join(root, "project with spaces");
    fs.mkdirSync(project);
    const card = path.join(project, DOVE_IDENTITY_CARD_PATH);
    const overview = path.join(project, ".dove/research/RESEARCH.md");
    const writeCard = (content) => {
      fs.mkdirSync(path.dirname(card), { recursive: true });
      fs.writeFileSync(card, content);
    };
    run({ root, project, card, overview, writeCard });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export function assertResearchMainlineReadBoundary() {
  withStatusLineFixture(({ root, project, card, overview, writeCard }) => {
    assert.equal(inspectResearchMainline(project), null);
    assert.deepEqual(fs.readdirSync(project), [], "missing card must not trigger bootstrap");
    fs.mkdirSync(path.dirname(overview), { recursive: true });
    fs.writeFileSync(overview, "Mainline: Old overview goal\n");
    assert.equal(inspectResearchMainline(project), null, "no fallback to overview");
    const content = "# Identity\nMainline: 合成主线\nNext core action: run synthetic check\n";
    writeCard(content);
    const before = fs.statSync(card);
    assert.equal(readDoveIdentityCard(project), content.trim());
    assert.equal(inspectResearchMainline(project), "合成主线");
    assert.equal(fs.statSync(card).mtimeMs, before.mtimeMs, "statusline remains read-only");
    writeCard("# Identity\nNext core action: inspect synthetic data\n");
    assert.equal(inspectResearchMainline(project), null, "no inferred mainline");
    writeCard("Mainline: First\nMainline: Second\n");
    assert.equal(inspectResearchMainline(project), null, "ambiguous card mainline is omitted");
    writeCard("Mainline: Oversized\n" + "x".repeat(4096));
    assert.equal(Buffer.byteLength(readDoveIdentityCard(project)), 4096, "oversized card keeps its beginning");
    assert.equal(inspectResearchMainline(project), "Oversized");
    fs.rmSync(card);
    fs.mkdirSync(card);
    assert.equal(inspectResearchMainline(project), null, "directory is not a card");
    fs.rmdirSync(card);
    const outside = path.join(root, "synthetic-outside.md");
    fs.writeFileSync(outside, "Mainline: Not in project\n");
    fs.symlinkSync(outside, card);
    assert.equal(inspectResearchMainline(project), null, "do not follow card symlinks");
  });
}

export function assertDoveStatusLineCli() {
  withStatusLineFixture(({ project, overview, writeCard }) => {
    const env = { ...process.env };
    delete env.NO_COLOR;
    writeCard("# Identity\nMainline: 合成确认主线\nNext core action: synthetic test\n");
    fs.writeFileSync(overview, "Mainline: Wrong overview goal\n" + "历史记录\n".repeat(10_000));
    const payload = JSON.stringify({
      model: { display_name: "Synthetic model" },
      context_window: { context_window_size: 272_000, remaining_percentage: 24 },
      cost: { total_duration_ms: 120_000 },
      workspace: { project_dir: "/not-the-explicit-project" }
    });
    const expected = `Synthetic model (272K) · ctx 24% · \x1b[36m合成确认主线\x1b[0m · 2m\n${project}\n`;
    for (const entry of ["bin/dove.mjs", "bin/dove-package.mjs"]) {
      const result = spawnSync(process.execPath, [path.join(ROOT, entry), "hook", "statusline", "--project", project], {
        cwd: project, input: payload, encoding: "utf8", env, timeout: 10_000
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      assert.equal(result.stdout, expected, entry);
    }
  });
}
