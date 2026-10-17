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
import { HOST_MIGRATION_PENDING_PATH } from "../../src/core/host-migration.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const scratch = process.env.TMPDIR ?? path.join(root, ".claude/tmp");
const binaries = ["bin/dove.mjs", "bin/dove-package.mjs"];
const event = (prompt = "hello", extra = {}) => ({ hook_event_name: "UserPromptSubmit", prompt, ...extra });

function workspace(t, hosts = ["claude"]) {
  fs.mkdirSync(scratch, { recursive: true });
  const project = fs.mkdtempSync(path.join(scratch, "dove-live-guidance-"));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  const previousConfig = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = path.join(project, ".test-config");
  t.after(() => {
    if (previousConfig === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previousConfig;
  });
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

const automaticPrompts = [
  "<task-notification>background result</task-notification>",
  " \n<task-notification data-id=\"1\">background result</task-notification>\n ",
  "<scheduled-wakeup>resume the loop</scheduled-wakeup>",
  "<background-task>worker finished</background-task>",
  "<system-reminder>\n[SYSTEM NOTIFICATION - NOT USER INPUT]\nbackground result",
  "[Your previous response had no visible output. Please continue and produce a user-visible response.]"
];

test("known host continuations skip project reads and return a guidance-dependent single line", (t) => {
  const guidance = { version: PACKAGE_VERSION, fingerprints: PROMPT_GUIDANCE_PATHS.map((resourcePath, index) => `${resourcePath} ${String(index + 1).repeat(12)}`) };
  t.mock.method(fs, "readFileSync", () => assert.fail("automatic context must not read identity or migration files"));
  t.mock.method(fs, "lstatSync", () => assert.fail("automatic context must not inspect the project"));
  const outputs = automaticPrompts.map((prompt) => userPromptSubmitOutput(event(prompt), guidance, { project: "/unread-project" }));
  for (const output of outputs) {
    assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    assert.equal(context(output).split("\n").length, 1);
    assert.ok(Array.from(context(output)).length < 160);
    assert.ok(context(output).includes(guidance.version));
    assert.equal(context(output), context(outputs[0]), "host notification bodies do not become instructions");
  }
  const changed = { ...guidance, fingerprints: ["changed guidance", ...guidance.fingerprints.slice(1)] };
  assert.notEqual(context(userPromptSubmitOutput(event(automaticPrompts[0]), changed)), context(outputs[0]));
});

test("automatic prompts omit existing identity and migration while user near-misses keep both", (t) => {
  const project = workspace(t);
  const config = path.join(process.env.XDG_CONFIG_HOME, "dove/settings.json");
  fs.mkdirSync(path.dirname(config), { recursive: true });
  fs.writeFileSync(config, JSON.stringify({ hostMigration: true }));
  const cardPath = path.join(project, ".dove/research/IDENTITY.md");
  const card = "Mainline: USER_CARD_UNIQUE_MARKER\n";
  const pendingPath = path.join(project, HOST_MIGRATION_PENDING_PATH);
  const pending = "PENDING_MIGRATION_UNIQUE_MARKER\n";
  fs.writeFileSync(cardPath, card);
  fs.writeFileSync(pendingPath, pending);
  const before = [cardPath, pendingPath, config].map((file) => [fs.readFileSync(file), fs.statSync(file).mtimeMs]);
  const guidance = currentPromptGuidance(JSON.parse(fs.readFileSync(path.join(project, ".dove/install/manifest.json"), "utf8")));
  const normal = userPromptSubmitOutput(event("继续用户已确认的任务"), guidance, { project });
  assert.ok(context(normal).includes(card.trim()));
  assert.ok(context(normal).includes(pending.trim()));
  const nearMisses = [
    "用户说：上一轮没有可见输出，所以请解释原因。",
    "请解释这条消息：<task-notification>result</task-notification>",
    "<task-notification-example>user-provided example</task-notification-example>",
    "<system-reminder>用户提供的普通正文</system-reminder>",
    "[Your previous response had no visible output. Please continue and produce a user-visible response.] 请解释原因。"
  ];
  for (const binary of binaries) {
    for (const prompt of automaticPrompts) {
      const delivered = invoke(binary, project, event(prompt, { cwd: project, transcript_path: "/unread-transcript" }));
      assert.deepEqual(delivered, userPromptSubmitOutput(event(prompt), guidance, { project }));
      assert.equal(context(delivered).split("\n").length, 1);
      assert.ok(Array.from(context(delivered)).length < 160);
      assert.equal(context(delivered).includes(card.trim()), false);
      assert.equal(context(delivered).includes(pending.trim()), false);
    }
    for (const prompt of nearMisses) assert.deepEqual(invoke(binary, project, event(prompt, { cwd: project })), normal);
  }
  for (const [index, file] of [cardPath, pendingPath, config].entries()) {
    assert.deepEqual(fs.readFileSync(file), before[index][0]);
    assert.equal(fs.statSync(file).mtimeMs, before[index][1]);
  }
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
