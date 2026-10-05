import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseDoveCli } from "../../src/cli/command-parser.mjs";
import { DOVE_CLAUDE_STOP_HOOK_COMMAND } from "../../src/core/ambient-policy.mjs";
import { identityCardContext, parseDoveCurrentRound, readDoveIdentityCard } from "../../src/core/identity-card.mjs";
import { mentorCallInRecord, parseStopPayload, stopHookOutput } from "../../src/core/stop-hook.mjs";

const payload = (extra = {}) => ({ hook_event_name: "Stop", stop_hook_active: false, transcript_path: "unused.jsonl", ...extra });
const user = (text = "继续") => ({ type: "user", message: { content: [{ type: "text", text }] } });
const mentor = { type: "assistant", message: { content: [{ type: "tool_use", name: "Agent", input: { subagent_type: "dove-mentor" } }] } };
const activeCard = "Mainline: 合成目标\nCurrent round: rounds/003-brief.md\nRound status: ongoing\n";
function cardOptions(card = activeCard) {
  return {
    project: "/virtual",
    fsOps: {
      realpathSync: (target) => target,
      lstatSync: (target) => ({ isSymbolicLink: () => false, isDirectory: () => !target.endsWith(".md"), isFile: () => target.endsWith(".md") }),
      readFileSync: () => Buffer.from(card)
    }
  };
}

test("active round without a mentor gets exactly the Stop reminder", async () => {
  const output = await stopHookOutput(payload(), { ...cardOptions(), mentorCalled: async () => false });
  assert.equal(output.decision, "block");
  assert.match(output.reason, /写本轮结果并调用导师/u);
  for (const status of ["paused", "completed"]) {
    assert.equal(await stopHookOutput(payload(), { ...cardOptions(activeCard.replace("ongoing", status)), mentorCalled: async () => false }), null);
  }
  assert.equal(await stopHookOutput(payload(), { ...cardOptions(), mentorCalled: async () => true }), null);
  assert.equal(await stopHookOutput(payload({ stop_hook_active: true }), { ...cardOptions(), mentorCalled() { throw new Error("must not inspect again"); } }), null);
  assert.equal(parseDoveCurrentRound(activeCard).brief, "rounds/003-brief.md");
});

test("Stop reads only current-turn event and mentor tool metadata", async () => {
  const called = (records) => records.reduce((state, record) => mentorCallInRecord(record, state), false);
  const toolResult = { type: "user", message: { content: [{ type: "tool_result", content: "结果" }] } };
  assert.equal(called([user(), mentor, toolResult]), true);
  assert.equal(called([user(), mentor, user("下一条问题")]), false);
  for (const type of ["image", "document"]) {
    assert.equal(called([user(), mentor, { type: "user", message: { content: [{ type }] } }]), false);
  }
  assert.equal(called([user(), mentor, { ...user("系统提示"), isMeta: true }]), true);
  assert.equal(called([user(), { type: "assistant", message: { content: [{ type: "text", text: "我调用过导师" }] } }]), false);
  assert.equal(called([user(), { type: "assistant", message: { content: [{ type: "tool_use", name: "Agent", input: { subagent_type: "dove-review" } }] } }]), false);
  const scratch = process.env.TMPDIR ?? new URL("../../.claude-tmp", import.meta.url).pathname;
  fs.mkdirSync(scratch, { recursive: true });
  const directory = fs.mkdtempSync(path.join(scratch, "dove-stop-events-"));
  const transcript = path.join(directory, "events.jsonl");
  try {
    fs.writeFileSync(transcript, [user(), mentor, toolResult].map(JSON.stringify).join("\n") + "\n");
    assert.equal(await stopHookOutput(payload({ transcript_path: transcript }), cardOptions()), null);
    fs.appendFileSync(transcript, JSON.stringify(user()) + "\n");
    assert.equal((await stopHookOutput(payload({ transcript_path: transcript }), cardOptions())).decision, "block");
    fs.writeFileSync(transcript, JSON.stringify(toolResult) + "\n");
    assert.equal(await stopHookOutput(payload({ transcript_path: transcript }), cardOptions()), null, "unknown turn shape passes");
    fs.writeFileSync(transcript, "broken JSON\n");
    assert.equal(await stopHookOutput(payload({ transcript_path: transcript }), cardOptions()), null);
    fs.writeFileSync(transcript, "irrelevant malformed history\n" + JSON.stringify(user()) + "\n" + JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "甲".repeat(50_000) }] } }));
    assert.equal((await stopHookOutput(payload({ transcript_path: transcript }), cardOptions())).decision, "block", "latest turn spans chunks without parsing unrelated history");
    fs.writeFileSync(transcript, [user(), mentor, { type: "user", message: { content: [{ type: "image" }] } }].map(JSON.stringify).join("\n"));
    assert.equal((await stopHookOutput(payload({ transcript_path: transcript }), cardOptions())).decision, "block");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("oversized identity retains a UTF-8-safe beginning instead of becoming missing", () => {
  const card = activeCard + "甲".repeat(1500);
  const options = cardOptions(card);
  const text = readDoveIdentityCard(options.project, options);
  assert.ok(Buffer.byteLength(text) <= 4096);
  assert.ok(text.startsWith(activeCard));
  assert.equal(text.includes("�"), false);
  const context = identityCardContext(options.project, options);
  assert.match(context, /exceeds 4KB/iu);
  assert.doesNotMatch(context, /No readable/iu);
  assert.equal(parseDoveCurrentRound(text).ongoing, true);
});

test("Stop fails open for missing context and recursion without initializing a project", async () => {
  for (const input of ["", "{", "null", "[]", "{}", JSON.stringify(payload({ hook_event_name: "SubagentStop" })), JSON.stringify(payload({ stop_hook_active: true }))]) {
    assert.equal(await stopHookOutput(parseStopPayload(input)), null);
  }
  assert.equal(await stopHookOutput(payload({ transcript_path: undefined }), cardOptions()), null);
  assert.equal(await stopHookOutput(payload({ transcript_path: "/missing/transcript.jsonl" }), cardOptions()), null);
  assert.equal(DOVE_CLAUDE_STOP_HOOK_COMMAND, 'dove hook stop --project "$CLAUDE_PROJECT_DIR"');
  assert.deepEqual(parseDoveCli(["hook", "stop", "--project", "/workspace"]), { command: "hook", subcommand: "stop", options: { project: "/workspace" }, passthrough: [] });
  const executable = new URL("../../bin/dove.mjs", import.meta.url).pathname;
  const result = spawnSync(process.execPath, [executable, "hook", "stop", "--project", "/not-initialized"], { input: JSON.stringify(payload()), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});
