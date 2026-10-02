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
  const expected = userPromptSubmitOutput(event(""), guidance, { project });
  assert.ok(context(expected).length < 2_500);
  assert.match(context(expected), /disk guidance, not rule reload/iu);
  assert.match(context(expected), /No readable short identity card at \.dove\/research\/IDENTITY\.md/iu);
  assert.match(context(expected), /do not infer a mainline from old notes or developer test prompts/iu);
  assert.match(context(expected), /shorten an oversized card without changing its Mainline/iu);
  assert.match(context(expected), /leave an unconfirmed Mainline unknown/iu);
  assert.match(context(expected), /update only affected fields unless writing is forbidden/iu);
  assert.match(context(expected), /Keep Mainline stable/iu);
  assert.match(context(expected), /Each open-goal round checks action, result and remaining gap against the same Mainline/iu);
  assert.doesNotMatch(context(expected), /^Mainline:/mu, "missing card does not synthesize a goal");
  assert.match(context(expected), /do the next core work now/iu);
  assert.match(context(expected), /Stop at whole-goal completion or a hard blocker/iu);
  assert.match(context(expected), /not a local batch or plan/iu);
  assert.match(context(expected), /On first use at these fingerprints/iu);
  assert.match(context(expected), /current main agent must personally read the current rule and the two short summaries/iu);
  assert.match(context(expected), /author preferences and research quality/iu);
  assert.match(context(expected), /Consult full references only for decision-relevant details/iu);
  assert.doesNotMatch(context(expected), /offsets|EOF|read the full rule and author preferences/iu);
  assert.match(context(expected), /card is context, not a substitute for the user's latest words/iu);
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
      assert.match(context(delivered), /corrections affect only relevant fields, not an unchanged Mainline/iu);
      assert.match(context(delivered), /next core work now/iu);
      assert.equal(fs.readFileSync(cardPath, "utf8"), card, "hook does not apply card corrections itself");
      assert.equal(fs.statSync(cardPath).mtimeMs, cardBefore, "hook does not write the card");
    }
  }
  const oversized = `${mainline}\n${"x".repeat(4096)}`;
  fs.writeFileSync(cardPath, oversized);
  const oversizedBefore = fs.statSync(cardPath).mtimeMs;
  for (const binary of binaries) {
    const delivered = invoke(binary, project, event());
    assert.match(context(delivered), /No readable short identity card/iu);
    assert.match(context(delivered), /shorten an oversized card without changing its Mainline/iu);
    assert.doesNotMatch(context(delivered), /^Mainline:/mu, "oversized card is not partially read or reconstructed");
    assert.equal(context(delivered).includes(mainline), false);
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
  assert.match(context(hook()), /disk guidance, not rule reload/u);

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
  assert.throws(() => userPromptSubmitOutput(event()), /requires verified project guidance/u);
  assert.throws(() => parseUserPromptSubmitPayload("{"), /malformed JSON/u);
  assert.throws(() => userPromptSubmitOutput(null), /requires a valid prompt event/u);
  const failure = userPromptSubmitFailureOutput(new Error("bad\ninput"));
  assert.match(failure.systemMessage, /bad\?input/u);
  assert.doesNotMatch(failure.systemMessage, /checked|approved|blocked the prompt/u);
});
