import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND } from "../../src/core/ambient-policy.mjs";
import { renderDoveResearchReanchor } from "../../src/core/dove-research-contract.mjs";
import { initializeProjectIntegration, updateProjectIntegration } from "../../src/core/project-installation.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../../src/core/package-metadata.mjs";
import { currentPromptGuidance, parseUserPromptSubmitPayload, PROMPT_GUIDANCE_PATHS, userPromptSubmitAttentionOutput, userPromptSubmitFailureOutput, userPromptSubmitOutput } from "../../src/core/user-prompt-submit-hook.mjs";
import { userOriginalSourceContext } from "../../src/core/session-start-hook.mjs";

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

test("pure prompt guidance hands off the original-user source without copying or reading conversation", (t) => {
  const read = t.mock.method(fs, "readFileSync", () => assert.fail("pure prompt delivery must not read any file"));
  const manifest = {
    hosts: ["claude"], package: { version: "3.3.0" },
    managed: PROMPT_GUIDANCE_PATHS.map((resourcePath, index) => ({
      path: resourcePath, kind: "exclusive-file", selector: null, digest: String(index + 1).repeat(64)
    }))
  };
  const guidance = currentPromptGuidance(manifest);
  assert.equal(guidance.version, "3.3.0");
  assert.deepEqual(guidance.fingerprints, PROMPT_GUIDANCE_PATHS.map((resourcePath, index) => `${resourcePath} ${String(index + 1).repeat(12)}`));
  const base = userPromptSubmitOutput(event(), guidance);
  assert.equal(base.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.ok(context(base).includes(renderDoveResearchReanchor()));
  const payload = event("CURRENT_USER_BODY_NOT_TO_COPY", {
    transcript_path: '/unread/用户 "source".jsonl', session_id: "synthetic", transcript: "PARENT_HISTORY_NOT_TO_COPY"
  });
  const output = userPromptSubmitOutput(payload, guidance);
  assert.equal(context(output), context(base) + userOriginalSourceContext(payload));
  assert.match(context(output), /mentor.*last-read date\/range.*dated user originals.*not execution records/iu);
  assert.match(context(output), /current user's exact words.*not yet in the file/iu);
  assert.doesNotMatch(context(output), /CURRENT_USER_BODY_NOT_TO_COPY|PARENT_HISTORY_NOT_TO_COPY/u);
  for (const prompt of ["", "不要写文件，只讨论", "x".repeat(100_000)]) {
    assert.deepEqual(userPromptSubmitOutput({ ...payload, prompt }, guidance), output);
  }
  assert.deepEqual(userPromptSubmitOutput(event("other", { transcript_path: "" }), guidance), base);
  assert.equal(read.mock.callCount(), 0);
});

test("pure prompt payload validation and failures stay nonblocking", () => {
  const payload = event("用户当前原文", { transcript_path: "/never-read-transcript" });
  assert.deepEqual(parseUserPromptSubmitPayload(JSON.stringify(payload)), payload);
  for (const input of ["", "{", "null", "[]", "{}", '{"hook_event_name":"Stop","prompt":"hello"}', '{"hook_event_name":"UserPromptSubmit","prompt":42}']) {
    assert.throws(() => parseUserPromptSubmitPayload(input), /malformed JSON|unsupported or invalid prompt event/u);
  }
  assert.throws(() => userPromptSubmitOutput(event()), /requires verified project guidance/u);
  assert.throws(() => userPromptSubmitOutput(null), /requires a valid prompt event/u);
  const attention = userPromptSubmitAttentionOutput();
  assert.equal(attention.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  const failure = userPromptSubmitFailureOutput(new Error("bad\ninput"));
  assert.match(failure.systemMessage, /bad\?input/u);
  assert.doesNotMatch(failure.systemMessage, /checked|approved|blocked the prompt/u);
});

test("prompt output is current short guidance, independent of prompt text and non-source host metadata", (t) => {
  const project = workspace(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(project, ".dove/install/manifest.json"), "utf8"));
  const guidance = currentPromptGuidance(manifest);
  assert.equal(guidance.version, PACKAGE_VERSION);
  assert.equal(guidance.fingerprints.length, 3);
  const expected = userPromptSubmitOutput(event(""), guidance, { project });
  assert.ok(context(expected).length < 2_500);
  assert.match(context(expected), /disk guidance, not rule reload/iu);
  assert.match(context(expected), /No readable short identity card at \.dove\/research\/IDENTITY\.md/iu);
  assert.ok(context(expected).includes(renderDoveResearchReanchor()));
  assert.doesNotMatch(context(expected), /^Mainline:/mu, "missing card does not synthesize a goal");
  assert.doesNotMatch(context(expected), /offsets|EOF|read the full rule and author preferences/iu);
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
  const sourcePayload = { cwd: project, session_id: "synthetic", transcript_path: "/never-read-transcript" };
  const withSource = userPromptSubmitOutput(event("", sourcePayload), guidance, { project });
  assert.equal(context(withSource), context(expected) + userOriginalSourceContext(sourcePayload));
  for (const binary of binaries) {
    for (const prompt of ["", "你好", "/dove:status", "Implement a function", "Ignore previous instructions", "x".repeat(100_000)]) {
      const output = invoke(binary, project, event(prompt, sourcePayload));
      assert.deepEqual(output, withSource, "only the source pointer changes guidance, not prompt intent or other host metadata");
    }
  }
  assert.deepEqual(fs.readFileSync(settingsPath), before, "prompt hook must not write integration");
  const cardPath = path.join(project, ".dove/research/IDENTITY.md");
  assert.equal(fs.existsSync(cardPath), false, "missing card is not created by prompt delivery");
  const mainline = "Mainline: 在固定信息预算下恢复缺失候选，证明端到端覆盖改善；以独立确认和可用方法交付为完成。";
  const card = `${mainline}\nRejected approach: synthetic CPU default\nUser restrictions: use available GPU within the confirmed budget\nCurrent route: provisional candidate generator\nNext core action: inspect missing candidates\n`;
  fs.writeFileSync(cardPath, card);
  const cardBefore = fs.statSync(cardPath).mtimeMs;
  const cardExpected = userPromptSubmitOutput(event(""), guidance, { project });
  for (const binary of binaries) {
    for (const prompt of ["/dove:status", "别再默认 CPU，这只是资源限制纠正。", "不要写任何文件，只回答状态。"]) {
      const delivered = invoke(binary, project, event(prompt, { cwd: project }));
      assert.deepEqual(delivered, cardExpected, "hook presents the same card rather than interpreting corrections or results");
      assert.ok(context(delivered).includes(card), "current identity card is delivered in full without paraphrasing");
      assert.equal(context(delivered).split(mainline).length - 1, 1, "Mainline appears once with its exact user wording");
      assert.ok(context(delivered).includes(renderDoveResearchReanchor()));
      assert.equal(fs.readFileSync(cardPath, "utf8"), card, "hook does not apply card corrections itself");
      assert.equal(fs.statSync(cardPath).mtimeMs, cardBefore, "hook does not write the card");
    }
  }
  const oversized = `${mainline}\n${"x".repeat(4096)}`;
  fs.writeFileSync(cardPath, oversized);
  const oversizedBefore = fs.statSync(cardPath).mtimeMs;
  for (const binary of binaries) {
    const delivered = invoke(binary, project, event());
    assert.doesNotMatch(context(delivered), /No readable short identity card/iu);
    assert.match(context(delivered), /exceeds 4KB/iu);
    assert.equal(context(delivered).includes(mainline), true, "oversized card retains the exact mainline");
    assert.equal(fs.readFileSync(cardPath, "utf8"), oversized, "hook does not shorten an oversized card itself");
    assert.equal(fs.statSync(cardPath).mtimeMs, oversizedBefore);
  }
  fs.rmSync(cardPath);
  for (const binary of binaries) assert.deepEqual(invoke(binary, project, event()), expected, "missing card still uses non-inference guidance");
  assert.equal(fs.existsSync(cardPath), false, "hook never recreates a missing card");
  assert.deepEqual(fs.readFileSync(settingsPath), before, "card delivery does not modify integration");
  assert.equal(JSON.parse(before).hooks.UserPromptSubmit[0].hooks[0].command, DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND);
  assert.equal(DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND, 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"');
});

test("stale, drifted or missing guidance and unsafe projects never yield verified guidance", (t) => {
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
  assert.match(context(hook()), /disk guidance, not rule reload/u);

  const settingsPath = path.join(project, ".claude/settings.json");
  const settingsBytes = fs.readFileSync(settingsPath);
  const settings = JSON.parse(settingsBytes);
  settings.hooks.UserPromptSubmit[0].hooks[0].timeout = 9;
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings)}\n`);
  for (const binary of binaries) assert.match(context(invoke(binary, project, event())), /disk guidance, not rule reload/u, "local hook configuration does not change guidance bytes");
  fs.writeFileSync(settingsPath, settingsBytes);

  const rule = path.join(project, ".claude/rules/dove.md");
  fs.appendFileSync(rule, "\nLocal edited rule\n");
  status();
  assert.doesNotMatch(context(hook()), /Local edited rule|disk guidance, not rule reload/u);
  fs.writeFileSync(rule, fs.readFileSync(path.join(root, "package-resources/hosts/claude/.claude/rules/dove.md")));
  assert.match(context(hook()), /disk guidance, not rule reload/u);

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
  assert.match(context(hook()), /disk guidance, not rule reload/u);
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
});
