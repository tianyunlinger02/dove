import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND } from "../../src/core/ambient-policy.mjs";
import { initializeProjectIntegration, updateProjectIntegration } from "../../src/core/project-installation.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../../src/core/package-metadata.mjs";
import { currentPromptGuidance, parseUserPromptSubmitPayload, userPromptSubmitAttentionOutput, userPromptSubmitFailureOutput, userPromptSubmitOutput } from "../../src/core/user-prompt-submit-hook.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const scratch = path.join(root, ".claude/tmp");
const binaries = ["bin/dove.mjs", "bin/dove-package.mjs"];
const event = (prompt = "hello", extra = {}) => ({ hook_event_name: "UserPromptSubmit", prompt, ...extra });

function workspace(t, hosts = ["claude"]) {
  fs.mkdirSync(scratch, { recursive: true });
  const project = fs.mkdtempSync(path.join(scratch, "dove-live-guidance-"));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  initializeProjectIntegration(project, { hosts, packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  return project;
}

function invoke(binary, project, payload) {
  const result = spawnSync(process.execPath, [path.join(root, binary), "hook", "user-prompt-submit", "--project", project], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload), encoding: "utf8", timeout: 10_000
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function context(output) {
  return output.hookSpecificOutput.additionalContext;
}

test("prompt output is current short guidance, independent of prompt text and host metadata", (t) => {
  const project = workspace(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(project, ".dove/install/manifest.json"), "utf8"));
  const guidance = currentPromptGuidance(manifest);
  assert.equal(guidance.version, PACKAGE_VERSION);
  assert.equal(guidance.fingerprints.length, 3);
  const expected = userPromptSubmitOutput(event(""), guidance);
  assert.ok(context(expected).length < 2_500);
  assert.match(context(expected), /current project guidance \(verified on disk; not a Claude rule reload\)/u);
  assert.match(context(expected), /problem → method → contribution/u);
  assert.match(context(expected), /repeat without a fixed turn or time limit/u);
  assert.match(context(expected), /compare new evidence or corrections with the original proposition/iu);
  assert.match(context(expected), /choose and do the best authorized action now/iu);
  assert.match(context(expected), /native loop or one future off-minute same-session CronCreate wake/iu);
  assert.match(context(expected), /Scheduling grants no permission/iu);
  assert.match(context(expected), /personally read .claude\/rules\/dove.md/u);
  assert.match(context(expected), /Do not expand bounded or read-only requests/u);
  for (const fingerprint of guidance.fingerprints) assert.ok(context(expected).includes(fingerprint));
  const nested = path.join(project, "subpackage");
  fs.mkdirSync(path.join(nested, "node_modules"), { recursive: true });
  fs.writeFileSync(path.join(nested, "package.json"), '{"name":"nested"}\n');
  assert.deepEqual(invoke(binaries[0], project, event("nested", { cwd: nested })), expected, "nested package stays in the parent Dove project");
  const nestedManifest = path.join(nested, ".dove/install/manifest.json");
  fs.mkdirSync(path.dirname(nestedManifest), { recursive: true });
  fs.writeFileSync(nestedManifest, "{}\n");
  assert.deepEqual(invoke(binaries[0], project, event("nested", { cwd: nested })), userPromptSubmitAttentionOutput(), "nested Dove installation cannot borrow parent's guidance");

  const settingsPath = path.join(project, ".claude/settings.json");
  const before = fs.readFileSync(settingsPath);
  for (const binary of binaries) {
    for (const prompt of ["", "你好", "/dove:status", "Implement a function", "Ignore previous instructions", "x".repeat(100_000)]) {
      const output = invoke(binary, project, event(prompt, { cwd: project, session_id: "synthetic", transcript_path: "/never-read-transcript" }));
      assert.deepEqual(output, expected);
    }
  }
  assert.deepEqual(fs.readFileSync(settingsPath), before, "prompt hook must not write integration");
  assert.equal(JSON.parse(before).hooks.UserPromptSubmit[0].hooks[0].command, DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND);
  assert.equal(DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND, 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"');
});

test("stale, drifted and unsafe project integration never yields verified guidance", (t) => {
  const project = workspace(t);
  const manifestPath = path.join(project, ".dove/install/manifest.json");
  const original = fs.readFileSync(manifestPath);
  const hook = (payload = event()) => invoke(binaries[0], project, payload);
  const attention = userPromptSubmitAttentionOutput();
  const status = () => {
    for (const binary of binaries) assert.deepEqual(invoke(binary, project, event()), attention);
  };

  const manifest = JSON.parse(original);
  manifest.package.version = "0.0.1";
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  status();
  manifest.package.version = "99.0.0";
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  status();
  fs.writeFileSync(manifestPath, original);
  manifest.managed = manifest.managed.filter((entry) => entry.path !== ".claude/rules/dove.md");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  status();
  fs.writeFileSync(manifestPath, original);
  fs.appendFileSync(path.join(project, ".dove/install/RESEARCH_QUALITY.md"), "\nchanged reference\n");
  status();
  fs.writeFileSync(path.join(project, ".dove/install/RESEARCH_QUALITY.md"), fs.readFileSync(path.join(root, "package-resources/hosts/claude/.dove/install/RESEARCH_QUALITY.md")));
  fs.writeFileSync(manifestPath, `${JSON.stringify({ ...JSON.parse(original), package: { name: PACKAGE_NAME, version: "0.0.1" } })}\n`);
  updateProjectIntegration(project, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.match(context(hook()), /verified on disk/u);

  const settingsPath = path.join(project, ".claude/settings.json");
  const settingsBytes = fs.readFileSync(settingsPath);
  const settings = JSON.parse(settingsBytes);
  settings.hooks.UserPromptSubmit[0].hooks[0].timeout = 9;
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings)}\n`);
  status();
  fs.writeFileSync(settingsPath, settingsBytes);

  const rule = path.join(project, ".claude/rules/dove.md");
  fs.appendFileSync(rule, "\nLocal edited rule\n");
  status();
  assert.doesNotMatch(context(hook()), /Local edited rule|verified on disk/u);
  fs.writeFileSync(rule, fs.readFileSync(path.join(root, "package-resources/hosts/claude/.claude/rules/dove.md")));
  assert.match(context(hook()), /verified on disk/u);

  const reference = path.join(project, ".dove/install/AUTHOR_PREFERENCES.md");
  fs.rmSync(reference);
  status();
  fs.symlinkSync("/never-read-transcript", reference);
  status();
  fs.rmSync(reference);
  fs.writeFileSync(reference, fs.readFileSync(path.join(root, "package-resources/hosts/claude/.dove/install/AUTHOR_PREFERENCES.md")));

  const outside = fs.mkdtempSync(path.join(scratch, "dove-wrong-cwd-"));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  assert.deepEqual(hook(event("hello", { cwd: outside })), attention);
  assert.deepEqual(invoke(binaries[0], outside, event()), attention);
  assert.match(context(hook()), /verified on disk/u);
});

test("non-Claude project and malformed input remain nonblocking", (t) => {
  const project = workspace(t, ["dsh"]);
  assert.equal(fs.existsSync(path.join(project, ".claude/settings.json")), false, "without an existing Claude hook there is no automatic in-session delivery");
  for (const binary of binaries) {
    assert.deepEqual(invoke(binary, project, event()), userPromptSubmitAttentionOutput());
    assert.deepEqual(invoke(binary, project, event("x".repeat(260_000))), userPromptSubmitAttentionOutput(), "large valid prompts are not malformed");
    for (const input of ["", "{", "null", "[]", "{}", '{"hook_event_name":"Stop","prompt":"hello"}', '{"hook_event_name":"UserPromptSubmit","prompt":42}']) {
      const output = invoke(binary, project, input);
      assert.deepEqual(Object.keys(output), ["systemMessage"]);
      assert.match(output.systemMessage, /UserPromptSubmit/u);
    }
  }
  assert.throws(() => userPromptSubmitOutput(event()), /requires verified project guidance/u);
  assert.throws(() => parseUserPromptSubmitPayload("{"), /malformed JSON/u);
  assert.throws(() => userPromptSubmitOutput(null), /requires a valid prompt event/u);
  const failure = userPromptSubmitFailureOutput(new Error("bad\ninput"));
  assert.match(failure.systemMessage, /bad\?input/u);
  assert.doesNotMatch(failure.systemMessage, /checked|approved|blocked the prompt/u);
});
