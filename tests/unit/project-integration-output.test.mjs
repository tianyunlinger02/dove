import test from "node:test";
import assert from "node:assert/strict";

import { renderProjectIntegrationResult } from "../../src/cli/project-integration-output.mjs";
import { DOVE_PIXEL_ART } from "../../src/cli/terminal-output.mjs";

const ANSI_PATTERN = /\[/u;
const RESULT = Object.freeze({
  status: "initialized",
  target: "/work/example-project",
  hosts: ["claude"],
  writtenPaths: [".claude/commands/dove/mission.md"],
  removedPaths: [],
  changedPaths: [".dove-install/manifest.json"],
  transactionState: { phase: "committed" }
});

function assertHumanBoundary(output) {
  for (const hidden of ["writtenPaths", "removedPaths", "changedPaths", "transactionState", ".dove-install/manifest.json", ".claude/commands"]) {
    assert.doesNotMatch(output, new RegExp(hidden.replaceAll(".", "\\."), "u"));
  }
}

test("interactive init renders the original pixel dove and a concise setup summary", () => {
  const output = renderProjectIntegrationResult("init", RESULT, { stream: { isTTY: true }, env: {} });
  assert.match(output, ANSI_PATTERN);
  for (const line of DOVE_PIXEL_ART) assert.ok(output.includes(line));
  assert.match(output, /Dove 已在此项目启用/u);
  assert.match(output, /example-project/u);
  assert.doesNotMatch(output, /\/work\/example-project/u);
  assert.match(output, /Claude Code/u);
  assert.match(output, /12 个 Dove 工作入口/u);
  assert.match(output, /MCP 服务已注册并仅为 Dove 批准/u);
  assert.match(output, /自然语言任务入口/u);
  assert.doesNotMatch(output, /请批准|\/mcp/u);
  assert.match(output, /科研主线尚未建立/u);
  assert.match(output, /\/dove:workspace/u);
  assert.match(output, /进入或重新进入 Claude Code/u);
  assertHumanBoundary(output);
});

test("NO_COLOR keeps the pixel dove while removing ANSI", () => {
  const output = renderProjectIntegrationResult("init", RESULT, { stream: { isTTY: true }, env: { NO_COLOR: "1" } });
  assert.doesNotMatch(output, ANSI_PATTERN);
  assert.ok(output.includes(DOVE_PIXEL_ART.join("\n")));
});

test("non-TTY init is clean human text without art or ANSI", () => {
  const output = renderProjectIntegrationResult("init", RESULT, { stream: { isTTY: false }, env: {} });
  assert.doesNotMatch(output, ANSI_PATTERN);
  assert.equal(output.includes(DOVE_PIXEL_ART[0]), false);
  assert.match(output, /Dove 已在此项目启用/u);
  assert.match(output, /Claude Code/u);
  assert.match(output, /进入或重新进入 Claude Code/u);
  assertHumanBoundary(output);
});

test("project paths stay private and cannot inject control sequences into human output", () => {
  const target = `/work/private${String.fromCharCode(27)}[31msecret${String.fromCharCode(10)}forged`;
  for (const stream of [{ isTTY: true }, { isTTY: false }]) {
    const output = renderProjectIntegrationResult("init", { ...RESULT, target }, { stream, env: { NO_COLOR: "1" } });
    assert.doesNotMatch(output, /\/work\/private|\x1b\[31m|\nforged/u);
    assert.match(output, /项目  private\?\[31msecret\?forged/u);
  }
});

test("repeated init is a zero-write friendly status and reuses the mascot", () => {
  const output = renderProjectIntegrationResult("init", { ...RESULT, status: "already-initialized" }, { stream: { isTTY: true }, env: { NO_COLOR: "1" } });
  assert.ok(output.includes(DOVE_PIXEL_ART[0]));
  assert.match(output, /已经在此项目启用/u);
  assert.match(output, /没有写入任何文件/u);
  assert.match(output, /dove sync/u);
  assert.match(output, /科研记录未被修改/u);
  assertHumanBoundary(output);
});

test("sync uses current-state language and never renders the mascot", () => {
  for (const [status, pattern] of [["unchanged", /已是最新/u], ["synchronized", /已刷新/u]]) {
    const output = renderProjectIntegrationResult("sync", { ...RESULT, status }, { stream: { isTTY: true }, env: {} });
    assert.match(output, pattern);
    assert.match(output, /科研记录未被修改/u);
    assert.equal(output.includes(DOVE_PIXEL_ART[0]), false);
    assertHumanBoundary(output);
  }
});

test("unsupported success states cannot accidentally render a mascot", () => {
  assert.throws(
    () => renderProjectIntegrationResult("init", { ...RESULT, status: "failed" }, { stream: { isTTY: true }, env: {} }),
    /Unsupported Dove integration presentation/u
  );
});
