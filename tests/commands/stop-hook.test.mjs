import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { parseDoveCli } from "../../src/cli/command-parser.mjs";
import { DOVE_CLAUDE_STOP_HOOK_COMMAND } from "../../src/core/ambient-policy.mjs";
import { parseStopPayload, stopHookOutput } from "../../src/core/stop-hook.mjs";

const unfinished = "I have not implemented the requested core feature. I can implement it now, but I am stopping here.";
const payload = (last_assistant_message, extra = {}) => ({
  hook_event_name: "Stop", stop_hook_active: false, last_assistant_message, ...extra
});

test("Stop cannot distinguish an early sign-off from a bounded status report", () => {
  // The host sends identical Stop data for these two different user requests.
  for (const userScope of ["implement the core", "only report status", "design only", "permission denied"]) {
    const input = JSON.stringify(payload(unfinished, { transcript_path: `/not-read/${userScope}` }));
    assert.equal(stopHookOutput(parseStopPayload(input)), null, userScope);
  }
  for (const text of ["我尚未完成核心功能。我现在可以实现，但我先结束。", unfinished, "The task is complete."]) {
    assert.equal(stopHookOutput(parseStopPayload(JSON.stringify(payload(text)))), null, text);
  }
});

test("Stop fails open for recursion, invalid payloads and unknown user scope", () => {
  for (const input of ["", "{", "null", "[]", "{}", JSON.stringify(payload(unfinished, { hook_event_name: "SubagentStop" })),
    JSON.stringify(payload(unfinished, { stop_hook_active: true })),
    JSON.stringify(payload(unfinished, { stop_hook_active: "false" })),
    JSON.stringify(payload(42)), JSON.stringify(payload(unfinished, { session_id: 23 })),
    JSON.stringify(payload(unfinished.repeat(500))), " ".repeat(64_001)]) {
    assert.equal(stopHookOutput(parseStopPayload(input)), null);
  }
});

test("optional registered Stop command accepts --project and emits nothing", () => {
  assert.equal(DOVE_CLAUDE_STOP_HOOK_COMMAND, 'dove hook stop --project "$CLAUDE_PROJECT_DIR"');
  assert.deepEqual(parseDoveCli(["hook", "stop", "--project", "/workspace"]), {
    command: "hook", subcommand: "stop", options: { project: "/workspace" }, passthrough: []
  });
  const executable = new URL("../../bin/dove.mjs", import.meta.url).pathname;
  const marker = "SECRET-SYNTHETIC-DO-NOT-ECHO";
  for (const input of [JSON.stringify(payload(unfinished, { transcript_path: `/missing/${marker}`, session_id: marker })),
    JSON.stringify(payload(unfinished, { stop_hook_active: true })), "{", JSON.stringify(payload(unfinished.repeat(500)))] ) {
    const result = spawnSync(process.execPath, [executable, "hook", "stop", "--project", "/synthetic-not-installed"], { input, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, "");
  }
});
