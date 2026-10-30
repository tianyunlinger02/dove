import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND } from "../../src/core/ambient-policy.mjs";
import { renderDoveMessageReminder } from "../../src/core/dove-research-contract.mjs";
import { recordSessionGuidance } from "../../src/core/hook-state.mjs";
import { initializeProjectIntegration } from "../../src/core/project-installation.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../../src/core/package-metadata.mjs";
import { inspectCurrentPromptGuidance, parseUserPromptSubmitPayload, userPromptSubmitAttentionOutput, userPromptSubmitFailureOutput, userPromptSubmitOutput } from "../../src/core/user-prompt-submit-hook.mjs";
import { userOriginalSourceContext } from "../../src/core/session-start-hook.mjs";
import { HOST_MIGRATION_PENDING_PATH } from "../../src/core/host-migration.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const scratch = process.env.TMPDIR ?? path.join(root, ".claude/tmp");
const binaries = ["bin/dove.mjs", "bin/dove-package.mjs"];
const event = (prompt = "hello", extra = {}) => ({ hook_event_name: "UserPromptSubmit", prompt, ...extra });
const NOTICE = /只提示这一次/u;

function workspace(t) {
  fs.mkdirSync(scratch, { recursive: true });
  const project = fs.mkdtempSync(path.join(scratch, "dove-live-guidance-"));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  const previousConfig = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = path.join(project, ".test-config");
  t.after(() => {
    if (previousConfig === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previousConfig;
  });
  initializeProjectIntegration(project, { hosts: ["claude"], packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
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

function writeResearch(project, files) {
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(project, ".dove/research", relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}

const automaticPrompts = [
  "<task-notification>background result</task-notification>",
  " \n<task-notification data-id=\"1\">background result</task-notification>\n ",
  "<scheduled-wakeup>resume the loop</scheduled-wakeup>",
  "<background-task>worker finished</background-task>",
  "<system-reminder>\n[SYSTEM NOTIFICATION - NOT USER INPUT]\nbackground result",
  "[Your previous response had no visible output. Please continue and produce a user-visible response.]"
];

test("host notifications get one line and never read the project", (t) => {
  const guidance = { version: PACKAGE_VERSION };
  t.mock.method(fs, "readFileSync", () => assert.fail("automatic context must not read identity or migration files"));
  t.mock.method(fs, "lstatSync", () => assert.fail("automatic context must not inspect the project"));
  const outputs = automaticPrompts.map((prompt) => userPromptSubmitOutput(event(prompt, { session_id: "s" }), guidance, { project: "/unread-project" }));
  for (const output of outputs) {
    assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    assert.equal(context(output), `Dove ${PACKAGE_VERSION} · 自动通知，不是用户的新要求。`);
  }
});

test("each user message carries the identity card, this round's situation and the source pointer", (t) => {
  const project = workspace(t);
  const guidance = inspectCurrentPromptGuidance(project, { packageVersion: PACKAGE_VERSION });
  assert.deepEqual(guidance, { version: PACKAGE_VERSION });
  const empty = context(userPromptSubmitOutput(event(""), guidance, { project }));
  assert.match(empty, /未读到身份卡 \.dove\/research\/IDENTITY\.md/u);
  assert.match(empty, /身份卡没有指向当前轮次/u);
  assert.ok(empty.includes(renderDoveMessageReminder()));

  writeResearch(project, {
    "IDENTITY.md": "Current round: rounds/003-brief.md\nRound status: ongoing\nMainline: 合成主线\nResearch state: 合成研究状态\n",
    "rounds/003-brief.md": "Author: mentor\n对准：数据与评价——完整方法与强对照同协议比较\n见分晓：2099-01-05（开始：2099-01-01）\n规模：全量 445 对，噪声约 1.5 点。\n\n一句话：合成轮次。\n\n## 预期结果\n\n完整任务中正确事件增加，强对照同协议比较。\n",
    "EVAL.md": "主指标：事件 F1（445 对开发集）；当前最好：11.5（2026-10-22，第 2 轮）\n\n| 日期 | 轮次 | 问题价值 | 创新 | 机制与理论 | 方法质量与可行性 | 数据与评价 | 实现 | 实验与证据价值 | 表达与交付 | 最卡的一维 |\n|---|---|---|---|---|---|---|---|---|---|---|\n| 2026-10-22 | 第 2 轮 | 3 | 1 | 未知 | 2 | 2 | 2 | 2 | 2 | 数据与评价 |\n",
    "MENTOR_NOTES.md": "## 2026-10-22 导师笔记\n\n### 待用户决定\n\n- 是否扩大到 494 对。\n"
  });
  const payload = event("CURRENT_USER_BODY_NOT_TO_COPY", { cwd: project, transcript_path: "/unread/source.jsonl", transcript: "PARENT_HISTORY_NOT_TO_COPY" });
  const delivered = context(invoke(binaries[0], project, payload));
  for (const expected of ["Mainline: 合成主线", "合成研究状态", "本轮：第 3 轮（rounds/003-brief.md，进行中）", "对准：数据与评价——完整方法与强对照同协议比较", "完整任务中正确事件增加，强对照同协议比较。", "规模：全量 445 对，噪声约 1.5 点", "见分晓：2099-01-05", "主指标：事件 F1（445 对开发集）；当前最好：11.5", "是否扩大到 494 对。"]) {
    assert.ok(delivered.includes(expected), expected);
  }
  assert.doesNotMatch(delivered, /最卡的一维/u);
  assert.ok(delivered.endsWith(userOriginalSourceContext(payload)));
  assert.doesNotMatch(delivered, /CURRENT_USER_BODY_NOT_TO_COPY|PARENT_HISTORY_NOT_TO_COPY/u);
  for (const binary of binaries) {
    for (const prompt of ["", "/dove:status", "不要写任何文件，只回答状态。", "x".repeat(100_000)]) {
      assert.equal(context(invoke(binary, project, event(prompt, { cwd: project, transcript_path: "/unread/source.jsonl" }))), delivered, "the situation comes from the records, not the prompt");
    }
  }

  // Missing auxiliary planning fields do not block the next substantive message.
  writeResearch(project, { "rounds/003-brief.md": "Author: mentor\n\n一句话：先实现完整方法。\n" });
  const incomplete = context(invoke(binaries[0], project, event()));
  assert.doesNotMatch(incomplete, /本轮说明开头还缺|补上再接着做|还没写“判定：”/u);
  writeResearch(project, { "rounds/003-result.md": "一句话：旧格式结果。\n" });
  const finished = context(invoke(binaries[0], project, event()));
  assert.doesNotMatch(finished, /还缺|还没写“判定：”/u);
});

test("a session is told once after the installed guidance changed", (t) => {
  const project = workspace(t);
  const guidance = { version: PACKAGE_VERSION };
  const say = (session) => context(userPromptSubmitOutput(event("继续", { session_id: session }), guidance, { project }));
  assert.match(say("unknown-session"), NOTICE, "a session Dove has no record of may hold older guidance");
  assert.doesNotMatch(say("unknown-session"), NOTICE);
  recordSessionGuidance(project, "fresh-session", PACKAGE_VERSION);
  assert.doesNotMatch(say("fresh-session"), NOTICE, "a context that started on this version already read it");
  recordSessionGuidance(project, "old-session", "0.0.1");
  assert.match(say("old-session"), NOTICE);
  assert.doesNotMatch(say("old-session"), NOTICE);
  assert.doesNotMatch(context(userPromptSubmitOutput(event("继续"), guidance, { project })), NOTICE, "without a session id nothing is remembered or said");
});

test("migration notices ride along with user messages, not host notifications", (t) => {
  const project = workspace(t);
  const config = path.join(process.env.XDG_CONFIG_HOME, "dove/settings.json");
  fs.mkdirSync(path.dirname(config), { recursive: true });
  fs.writeFileSync(config, JSON.stringify({ hostMigration: true }));
  writeResearch(project, { "IDENTITY.md": "Mainline: USER_CARD_UNIQUE_MARKER\n" });
  fs.writeFileSync(path.join(project, HOST_MIGRATION_PENDING_PATH), "PENDING_MIGRATION_UNIQUE_MARKER\n");
  for (const binary of binaries) {
    const normal = context(invoke(binary, project, event("继续用户已确认的任务", { cwd: project })));
    assert.ok(normal.includes("USER_CARD_UNIQUE_MARKER"));
    assert.ok(normal.includes("PENDING_MIGRATION_UNIQUE_MARKER"));
    for (const prompt of automaticPrompts) {
      const automatic = context(invoke(binary, project, event(prompt, { cwd: project })));
      assert.equal(automatic.includes("USER_CARD_UNIQUE_MARKER"), false);
      assert.equal(automatic.includes("PENDING_MIGRATION_UNIQUE_MARKER"), false);
    }
    for (const prompt of ["请解释这条消息：<task-notification>result</task-notification>", "<system-reminder>用户提供的普通正文</system-reminder>"]) {
      assert.ok(context(invoke(binary, project, event(prompt, { cwd: project }))).includes("USER_CARD_UNIQUE_MARKER"), "user text that only mentions a notification is a user message");
    }
  }
});

test("the hook never writes the card, the settings or the research records", (t) => {
  const project = workspace(t);
  const settingsPath = path.join(project, ".claude/settings.json");
  writeResearch(project, { "IDENTITY.md": `Mainline: 合成主线\n${"x".repeat(4096)}` });
  const cardPath = path.join(project, ".dove/research/IDENTITY.md");
  const before = [settingsPath, cardPath].map((file) => [fs.readFileSync(file), fs.statSync(file).mtimeMs]);
  for (const binary of binaries) {
    const delivered = context(invoke(binary, project, event("别再默认 CPU，这只是资源限制纠正。", { cwd: project, session_id: "write-check" })));
    assert.match(delivered, /身份卡超过 4KB/u);
    assert.ok(delivered.includes("Mainline: 合成主线"));
  }
  for (const [index, file] of [settingsPath, cardPath].entries()) {
    assert.deepEqual(fs.readFileSync(file), before[index][0]);
    assert.equal(fs.statSync(file).mtimeMs, before[index][1]);
  }
  assert.equal(JSON.parse(fs.readFileSync(settingsPath)).hooks.UserPromptSubmit[0].hooks[0].command, DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND);
});

test("older installations keep their context; other directories and bad input stay nonblocking", (t) => {
  const project = workspace(t);
  const manifestPath = path.join(project, ".dove/install/manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.package.version = "0.0.1";
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  for (const binary of binaries) assert.match(context(invoke(binary, project, event())), /项目指导为 0\.0\.1，命令行为/u);

  const outside = fs.mkdtempSync(path.join(scratch, "dove-wrong-cwd-"));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const attention = userPromptSubmitAttentionOutput();
  assert.deepEqual(invoke(binaries[0], project, event("hello", { cwd: outside })), attention);
  assert.deepEqual(invoke(binaries[0], outside, event()), attention);
  const nested = path.join(project, "subpackage");
  fs.mkdirSync(path.join(nested, ".dove/install"), { recursive: true });
  fs.writeFileSync(path.join(nested, ".dove/install/manifest.json"), "{}\n");
  assert.deepEqual(invoke(binaries[0], project, event("nested", { cwd: nested })), attention, "a nested Dove installation cannot borrow its parent's guidance");

  const payload = event("用户当前原文", { transcript_path: "/never-read-transcript" });
  assert.deepEqual(parseUserPromptSubmitPayload(JSON.stringify(payload)), payload);
  for (const binary of binaries) {
    for (const input of ["", "{", "null", "[]", "{}", '{"hook_event_name":"Stop","prompt":"hello"}', '{"hook_event_name":"UserPromptSubmit","prompt":42}']) {
      assert.throws(() => parseUserPromptSubmitPayload(input), /malformed JSON|unsupported or invalid prompt event/u);
      const output = invoke(binary, project, input);
      assert.deepEqual(Object.keys(output), ["systemMessage"]);
      assert.match(output.systemMessage, /UserPromptSubmit/u);
    }
  }
  assert.throws(() => userPromptSubmitOutput(event()), /requires verified project guidance/u);
  assert.throws(() => userPromptSubmitOutput(null), /requires a valid prompt event/u);
  assert.match(userPromptSubmitFailureOutput(new Error("bad\ninput")).systemMessage, /bad\?input/u);
});

test("large context arrives whole through the pipe the host reads", (t) => {
  const project = workspace(t);
  const config = path.join(process.env.XDG_CONFIG_HOME, "dove/settings.json");
  fs.mkdirSync(path.dirname(config), { recursive: true });
  fs.writeFileSync(config, JSON.stringify({ hostMigration: true }));
  // A pending notice far beyond one pipe buffer.
  fs.writeFileSync(path.join(project, HOST_MIGRATION_PENDING_PATH), `${"迁移待办正文。".repeat(40_000)}\nEND_OF_PENDING\n`);
  for (const binary of binaries) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const delivered = context(invoke(binary, project, event("继续", { cwd: project })));
      assert.ok(delivered.includes("END_OF_PENDING"), `${binary} attempt ${attempt}: output is complete`);
    }
  }
});
