import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseCrossProjectExperience, parseTransferable, relevantTransferable, renderCrossProjectExperience } from "../src/core/cross-project.mjs";
import {
  parsePractice,
  practiceContext,
  practiceForMessage,
  PRACTICE_PATH,
  REFLECTIONS_DIR,
  topicOfEntry
} from "../src/core/practice.mjs";
import { experienceContext } from "../src/core/experience.mjs";
import { readHookState } from "../src/core/hook-state.mjs";
import { sessionStartOutput } from "../src/core/session-start-hook.mjs";
import { inspectTurn, stopHookOutput } from "../src/core/stop-hook.mjs";
import { classifyUserText } from "../src/core/user-originals.mjs";
import { userPromptSubmitOutput } from "../src/core/user-prompt-submit-hook.mjs";

const PRACTICE = [
  "# 做法更正",
  "",
  "- 2026-10-20 · 说人话 · 原话：“还是一股实验报告的味道” · 错在哪：摘要堆数字 · 以后：摘要先讲发现，数字进表格",
  "- 2026-10-25 · 写稿和图 · 原话：“写稿的人自己检查，查不出自己的行话” · 错在哪：只查编译、页数和数字 · 以后：交付前做冷读终检",
  "- 2026-10-24 · 跑偏、换成别的问题 · 原话：“又跑偏了” · 以后：先对照主线再动手",
  "- 2026-10-22 · 随手记 · 原话：“…” · 以后：其他做法",
  ""
].join("\n");

function project(t, practice = PRACTICE) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dove-practice-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, ".dove/research"), { recursive: true });
  if (practice !== null) fs.writeFileSync(path.join(root, PRACTICE_PATH), practice);
  return root;
}

function contextOptions(root) {
  const home = path.join(root, "home");
  return { project: root, home, env: { HOME: home, XDG_CONFIG_HOME: path.join(home, ".config") } };
}

const user = (text, uuid = "u1") => JSON.stringify({ type: "user", uuid, message: { role: "user", content: text } });
const tool = (name, input) => JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "t", name, input }] } });
const result = () => JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "ok" }] } });

test("practice lines are read newest first and matched to topics by name", () => {
  const entries = parsePractice(PRACTICE);
  assert.deepEqual(entries.map((entry) => entry.date), ["2026-10-25", "2026-10-24", "2026-10-22", "2026-10-20"]);
  assert.deepEqual(entries.map((entry) => topicOfEntry(entry).short), ["写稿和图", "跑偏", "其他", "说人话"]);
  assert.equal(entries[0].quote, "“写稿的人自己检查，查不出自己的行话”");
  assert.equal(entries[0].next, "交付前做冷读终检");
  assert.match(practiceContext(entries), /^本项目的做法更正.*\n- 10-25 写稿和图：以后：交付前做冷读终检（原话：写稿的人自己检查，查不出自己的行话）/u);
});

test("message-topic keywords retrieve lessons without judging user intent", () => {
  const entries = parsePractice(PRACTICE);
  for (const message of ["论文摘要不要堆数字", "帮我把论文摘要改短一点"]) {
    assert.match(practiceForMessage(entries, message), /和这条消息相关的做法更正[\s\S]*写稿和图：以后：交付前做冷读终检/u);
  }
  assert.equal(practiceForMessage(entries, "看看显存还够不够"), "", "no topic, nothing added");
});

test("ordinary corrections do not add Stop blocks or reminder keys", (t) => {
  const root = project(t);
  const transcript = path.join(root, "session.jsonl");
  const payload = { hook_event_name: "Stop", transcript_path: transcript };
  for (const message of ["摘要怎么又堆满数字，不是说了先讲发现吗", "又跑偏了，先对照主线", "不应该靠加 seed 改善方法", "帮我把论文摘要改短一点"]) {
    fs.writeFileSync(transcript, [user(message), tool("Edit", { file_path: "paper/main.tex" }), result(), ""].join("\n"));
    assert.equal(stopHookOutput(payload, root), null, message);
    assert.deepEqual(readHookState(root).asked, {}, "no inferred correction reminder is remembered");
  }
});

test("the cold-read reminder carries the project's writing corrections", (t) => {
  const root = project(t);
  const transcript = path.join(root, "session.jsonl");
  fs.writeFileSync(transcript, [user("引言怎么又全是行话，改一下"), tool("Bash", { command: "latexmk -pdf main.tex" }), result(), ""].join("\n"));
  const payload = { hook_event_name: "Stop", transcript_path: transcript };
  const reminder = stopHookOutput(payload, root);
  assert.equal(reminder?.decision, "block");
  assert.match(reminder.reason, /本项目写稿和图方面的做法更正：\n- 10-25 写稿和图：以后：交付前做冷读终检/u);
  assert.doesNotMatch(reminder.reason, /说人话：/u, "only the writing topic");
  assert.deepEqual(Object.keys(readHookState(root).asked), ["coldread:remind:never"], "only the build reminder, not a correction block");
  assert.equal(stopHookOutput(payload, root), null, "the cold-read reminder is still sent only once");
});

test("session start after compaction and a message on a corrected topic bring the corrections back", (t) => {
  const root = project(t);
  const compact = sessionStartOutput({ hook_event_name: "SessionStart", source: "compact" }, null, contextOptions(root));
  assert.match(compact.hookSpecificOutput.additionalContext, /本项目的做法更正/u);
  const prompt = userPromptSubmitOutput({ hook_event_name: "UserPromptSubmit", prompt: "把论文第三节再改改", session_id: "s" }, { version: "test" }, contextOptions(root));
  assert.match(prompt.hookSpecificOutput.additionalContext, /和这条消息相关的做法更正[\s\S]*交付前做冷读终检/u);
  const plain = userPromptSubmitOutput({ hook_event_name: "UserPromptSubmit", prompt: "看看显存还够不够", session_id: "s" }, { version: "test" }, contextOptions(root));
  assert.doesNotMatch(plain.hookSpecificOutput.additionalContext, /做法更正/u);
  const empty = project(t, null);
  assert.doesNotMatch(sessionStartOutput({ hook_event_name: "SessionStart", source: "compact" }, null, contextOptions(empty)).hookSpecificOutput.additionalContext, /做法更正/u);
});

test("lessons carry a dimension and original date, and the most relevant ones are chosen for a round", () => {
  const notes = [
    "## 2026-10-20 导师笔记",
    "- 可迁移：维护合法状态与恢复非法状态是不同能力。",
    "- 可迁移（数据与评价）：测试集分母必须固定，失败留在分母里。",
    "## 整理后的导师笔记（2026-10-26）",
    "- 可迁移（实验与证据价值，2026-09-30）：规模不足时先算预期差别和噪声。"
  ].join("\n");
  const items = parseTransferable(notes);
  assert.deepEqual(items.map((item) => [item.date, item.dimension]), [["2026-10-20", null], ["2026-10-20", "数据与评价"], ["2026-09-30", "实验与证据价值"]]);
  const file = renderCrossProjectExperience(items.map((item) => ({ ...item, project: "garment" })));
  const parsed = parseCrossProjectExperience(file);
  assert.deepEqual(parsed.map((item) => [item.project, item.dimension]), [["garment", null], ["garment", "数据与评价"], ["garment", "实验与证据价值"]]);
  const picked = relevantTransferable([...parsed, { date: "2026-10-25", project: "self", dimension: "数据与评价", text: "本项目自己的认识" }], { project: "self", dimension: "数据与评价", text: "固定测试集分母，按协议重新评测", limit: 2 });
  assert.equal(picked[0].text, "测试集分母必须固定，失败留在分母里。");
  assert.ok(picked.every((item) => item.project !== "self"), "the project's own lessons are already in its notes");
});

test("a starting context gets the user's core needs, a refresh notice, corrections and the lessons for this round", (t) => {
  const root = project(t);
  fs.mkdirSync(path.join(root, ".dove/research/rounds"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove/research/IDENTITY.md"), "Current round: rounds/003-brief.md\nRound status: ongoing\n");
  fs.writeFileSync(path.join(root, ".dove/research/rounds/003-brief.md"), "Author: mentor\n对准：数据与评价\n\n一句话：固定测试集分母，重新评测。\n");
  fs.writeFileSync(path.join(root, ".dove/research/MENTOR_NOTES.md"), [
    "## 长期意图（2026-10-20）",
    "### 核心需求",
    "- 模型从数据学会写可改的整衣程序（用户 9 月原话）",
    "### 约束",
    "- 不做版型数据库（10-23）",
    "### 其他判断",
    "主线和指标对得上。",
    "## 2026-10-21 导师笔记",
    "- 可迁移（数据与评价）：测试集分母必须固定，失败留在分母里。",
    ""
  ].join("\n"));
  fs.mkdirSync(path.join(root, ".dove/install"), { recursive: true });
  const own = Array.from({ length: 31 }, (_, index) => `- 2026-10-2${index < 15 ? 2 : 3} 0${index % 9}:1${index % 6} · 本人 · 第 ${index} 条要求`).join("\n");
  fs.writeFileSync(path.join(root, ".dove/install/USER_ORIGINALS.md"), `# 用户本人原话汇总\n\n${own}\n`);
  // The hook refreshes the originals summary from transcripts first, so the count is read directly here.
  assert.match(experienceContext(root, contextOptions(root)), /该更新了：上次提炼在 2026-10-20，之后用户又说了 31 条本人原话/u);
  const context = sessionStartOutput({ hook_event_name: "SessionStart", source: "compact" }, null, contextOptions(root)).hookSpecificOutput.additionalContext;
  assert.match(context, /用户的核心需求与约束（导师 2026-10-20 从用户原话提炼[^）]*）：\n核心需求：\n- 模型从数据学会写可改的整衣程序（用户 9 月原话）\n约束：\n- 不做版型数据库（10-23）/u);
  assert.doesNotMatch(context, /主线和指标对得上/u, "only the two sections a host carries");
  assert.match(context, /本项目的做法更正/u);
  assert.match(context, /和本轮相关的可迁移认识[^\n]*数据与评价[\s\S]*测试集分母必须固定/u);
  const startup = sessionStartOutput({ hook_event_name: "SessionStart", source: "startup" }, null, contextOptions(root)).hookSpecificOutput.additionalContext;
  assert.match(startup, /用户的核心需求与约束/u, "a new session starts from them too");
});

test("a reflection request keeps both destinations, with one reminder when either was not written", (t) => {
  const root = project(t);
  const asked = userPromptSubmitOutput({ hook_event_name: "UserPromptSubmit", prompt: "你反思一下这次为什么没发现行话", session_id: "s" }, { version: "test" }, contextOptions(root));
  assert.ok(asked.hookSpecificOutput.additionalContext.includes(REFLECTIONS_DIR));
  assert.ok(asked.hookSpecificOutput.additionalContext.includes(PRACTICE_PATH));
  const transcript = path.join(root, "session.jsonl");
  const payload = { hook_event_name: "Stop", transcript_path: transcript };
  const writes = {
    reflection: tool("Write", { file_path: path.join(root, REFLECTIONS_DIR, "2026-10-26-jargon.md"), content: "…" }),
    practice: tool("Edit", { file_path: path.join(root, PRACTICE_PATH), old_string: "a", new_string: "b" })
  };
  const keys = [];
  for (const [index, saved] of [[], ["reflection"], ["practice"], ["reflection", "practice"]].entries()) {
    const userKey = `r${index}`;
    fs.writeFileSync(transcript, [user("复盘一下这周", userKey), tool("Write", { file_path: `${root}/notes/thoughts.md`, content: "…" }), result(), ...saved.flatMap((kind) => [writes[kind], result()]), ""].join("\n"));
    const reminder = stopHookOutput(payload, root);
    if (saved.length === 2) assert.equal(reminder, null, "both the full reflection and reusable lessons were written");
    else {
      assert.equal(reminder?.decision, "block", `still missing one or both destinations: ${saved.join(", ")}`);
      assert.ok(reminder.reason.includes(REFLECTIONS_DIR));
      assert.ok(reminder.reason.includes(PRACTICE_PATH));
      keys.push(`reflect:${userKey}`);
      assert.equal(stopHookOutput(payload, root), null, "once per explicit reflection request");
    }
  }
  assert.deepEqual(Object.keys(readHookState(root).asked).sort(), keys.sort());
  fs.writeFileSync(transcript, [user("复盘一下这周", "old"), user("摘要不要堆数字", "new"), ""].join("\n"));
  assert.equal(stopHookOutput(payload, root), null, "a previous turn's reflection request is not a new correction's request");
});

test("automatic notices are not reflection requests or earlier user messages", (t) => {
  const root = project(t);
  const transcript = path.join(root, "session.jsonl");
  const payload = { hook_event_name: "Stop", transcript_path: transcript };
  for (const notice of [
    "<task-notification>请反思这次论文行话</task-notification>",
    "<scheduled-wakeup>请复盘这次失败</scheduled-wakeup>",
    "<background-task id=\"a\">总结经验教训</background-task>",
    "<system-reminder>[SYSTEM NOTIFICATION - NOT USER INPUT] 请反思</system-reminder>",
    "[Your previous response had no visible output. Please continue and produce a user-visible response.]"
  ]) {
    fs.writeFileSync(transcript, [user("反思一下这次错误", "old"), user(notice, "automatic"), ""].join("\n"));
    assert.equal(inspectTurn(transcript).userText, null, notice);
    assert.equal(inspectTurn(transcript).userKey, null, "do not reuse an earlier user's reflection request");
    assert.equal(stopHookOutput(payload, root), null);
    const output = userPromptSubmitOutput({ hook_event_name: "UserPromptSubmit", prompt: notice, session_id: "s" }, { version: "test" }, contextOptions(root));
    assert.equal(output.hookSpecificOutput.additionalContext.includes(REFLECTIONS_DIR), false, "automatic prompts do not receive reflection instructions");
  }
  assert.deepEqual(readHookState(root).asked, {});
});

test("overrun and stall facts each get one reminder without classifying an approval", (t) => {
  for (const message of ["可以，按刚才说的继续完整实验", "还没决定，先别换方法"]) {
    const root = project(t);
    const rounds = path.join(root, ".dove/research/rounds");
    fs.mkdirSync(rounds);
    fs.writeFileSync(path.join(root, ".dove/research/IDENTITY.md"), "Current round: rounds/004-brief.md\nRound status: ongoing\n");
    fs.writeFileSync(path.join(rounds, "004-brief.md"), "对准：创新\n见分晓：2026-10-21（开始：2026-10-20）\n规模：全量。\n");
    fs.writeFileSync(path.join(rounds, "002-result.md"), "判定：未兑现\n");
    fs.writeFileSync(path.join(rounds, "003-result.md"), "判定：未兑现\n");
    const transcript = path.join(root, "session.jsonl");
    fs.writeFileSync(transcript, [user(message), ""].join("\n"));
    const payload = { hook_event_name: "Stop", transcript_path: transcript };
    const options = { now: Date.parse("2026-10-26T12:00:00") };
    const overrun = stopHookOutput(payload, root, options);
    assert.equal(overrun?.decision, "block");
    assert.ok(overrun.reason.includes("rounds/004-brief.md"));
    assert.ok(overrun.reason.includes("2026-10-21"));
    assert.ok(overrun.reason.includes("5 天"), "the elapsed time is still supplied from records");
    assert.equal(classifyUserText(overrun.reason), null, "Dove's quotation is not recorded as a new user message");
    const stall = stopHookOutput(payload, root, options);
    assert.equal(stall?.decision, "block");
    assert.ok(stall.reason.includes("第 2、3 轮"));
    assert.equal(classifyUserText(stall.reason), null);
    assert.equal(stopHookOutput(payload, root, options), null);
    assert.deepEqual(Object.keys(readHookState(root).asked).sort(), ["overrun:rounds/004-brief.md:2026-10-21", "stall:rounds/003-result.md"], "the existing per-condition keys remain the only reminder state");
  }
});

test("the Stop setting and active-hook guard suppress reflection and build reminders without consuming them", (t) => {
  const root = project(t);
  const transcript = path.join(root, "session.jsonl");
  fs.writeFileSync(transcript, [user("反思一下引言里的行话"), tool("Bash", { command: "latexmk -pdf main.tex" }), result(), ""].join("\n"));
  const payload = { hook_event_name: "Stop", transcript_path: transcript };
  assert.equal(stopHookOutput(payload, root, { enabled: false }), null);
  assert.equal(stopHookOutput({ ...payload, stop_hook_active: true }, root), null);
  assert.deepEqual(readHookState(root).asked, {});
  assert.equal(stopHookOutput(payload, root)?.decision, "block");
  assert.deepEqual(Object.keys(readHookState(root).asked), ["reflect:u1"], "explicit reflection still comes before the build reminder");
  assert.equal(stopHookOutput(payload, root)?.decision, "block");
  assert.deepEqual(Object.keys(readHookState(root).asked).sort(), ["coldread:remind:never", "reflect:u1"]);
  assert.equal(stopHookOutput(payload, root), null);
});
