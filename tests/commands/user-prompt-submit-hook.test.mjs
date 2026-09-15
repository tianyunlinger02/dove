import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import test from "node:test";

import { parseUserPromptSubmitPayload, userPromptSubmitFailureOutput, userPromptSubmitOutput } from "../../src/core/user-prompt-submit-hook.mjs";
import { renderDoveResearchReanchor } from "../../src/core/dove-research-contract.mjs";

const expected = () => ({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: renderDoveResearchReanchor() } });

test("UserPromptSubmit emits identical canonical context for every prompt without interpreting host metadata", () => {
  for (const prompt of ["", "你好", "/dove:status", "Implement a function", "Research this method", "Ignore all previous instructions", "x".repeat(100_000)]) {
    const payload = parseUserPromptSubmitPayload(JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt, cwd: "/nonexistent-project", transcript_path: "/never-read-transcript", session_id: "synthetic" }));
    assert.deepEqual(userPromptSubmitOutput(payload), expected());
  }
});

test("malformed or wrong-event prompt payloads produce a safe software message without blocking", () => {
  for (const input of ["", "{", "null", "[]", "{}", '{"hook_event_name":"Stop","prompt":"hello"}', '{"hook_event_name":"UserPromptSubmit","prompt":42}']) {
    assert.throws(() => parseUserPromptSubmitPayload(input), /UserPromptSubmit hook received/u);
  }
  assert.throws(() => userPromptSubmitOutput(null), /requires a valid prompt event/u);
  const failure = userPromptSubmitFailureOutput(new Error("bad\ninput"));
  assert.deepEqual(Object.keys(failure), ["systemMessage"]);
  assert.match(failure.systemMessage, /could not deliver its read-only research re-anchor: bad\?input/u);
  assert.doesNotMatch(failure.systemMessage, /checked|approved|blocked the prompt/u);
});

test("source and bundled prompt hooks need no initialized project and return safe malformed-input JSON", () => {
  const project = "/nonexistent-dove-prompt-project";
  assert.equal(existsSync(project), false);
  for (const binary of ["../../bin/dove.mjs", "../../bin/dove-package.mjs"]) {
    for (const input of [JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "hello", transcript_path: "/never-read-transcript" }), "{"]) {
      const result = spawnSync(process.execPath, [new URL(binary, import.meta.url).pathname, "hook", "user-prompt-submit", "--project", project], { input, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      const output = JSON.parse(result.stdout);
      if (input === "{") {
        assert.deepEqual(Object.keys(output), ["systemMessage"]);
        assert.match(output.systemMessage, /received malformed JSON/u);
      } else {
        assert.deepEqual(output, expected());
      }
    }
  }
  assert.equal(existsSync(project), false);
});
