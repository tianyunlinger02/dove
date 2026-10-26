import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseCrossProjectExperience, parseTransferable, relevantTransferable, renderCrossProjectExperience } from "../src/core/cross-project.mjs";
import {
  correctionTopics,
  parsePractice,
  practiceContext,
  practiceForMessage,
  PRACTICE_PATH,
  topicOfEntry
} from "../src/core/practice.mjs";
import { experienceContext } from "../src/core/experience.mjs";
import { sessionStartOutput } from "../src/core/session-start-hook.mjs";
import { stopHookOutput } from "../src/core/stop-hook.mjs";
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

test("a correction is told apart from an ordinary request on the same subject", () => {
  assert.deepEqual(correctionTopics("论文摘要不要堆数字").map((topic) => topic.id), ["writing"]);
  assert.deepEqual(correctionTopics("帮我把论文摘要改短一点"), []);
  assert.deepEqual(correctionTopics("又跑偏了").map((topic) => topic.id), ["drift"]);
  assert.deepEqual(correctionTopics("跑一下 seed 3"), []);
  const entries = parsePractice(PRACTICE);
  assert.match(practiceForMessage(entries, "帮我把论文摘要改短一点"), /和这条消息相关的做法更正[\s\S]*写稿和图：以后：交付前做冷读终检/u);
  assert.equal(practiceForMessage(entries, "看看显存还够不够"), "", "no topic, nothing added");
});

test("a correction left unwritten gets one reminder; writing it down or an automatic notice gets none", (t) => {
  const root = project(t);
  const transcript = path.join(root, "session.jsonl");
  fs.writeFileSync(transcript, [user("摘要怎么又堆满数字，不是说了先讲发现吗"), tool("Edit", { file_path: "paper/main.tex" }), result(), ""].join("\n"));
  const payload = { hook_event_name: "Stop", transcript_path: transcript };
  const first = stopHookOutput(payload, root);
  assert.equal(first?.decision, "block");
  assert.match(first.reason, /做法的纠正（写稿和图）/u);
  assert.match(first.reason, /PRACTICE\.md/u);
  assert.equal(stopHookOutput(payload, root), null, "once per message");

  fs.writeFileSync(transcript, [user("摘要怎么又堆满数字", "u2"), tool("Edit", { file_path: `${root}/.dove/research/PRACTICE.md` }), result(), ""].join("\n"));
  assert.equal(stopHookOutput(payload, root), null, "the turn wrote the correction down");

  fs.writeFileSync(transcript, [user("<task-notification>任务又没完成</task-notification>", "u3"), ""].join("\n"));
  assert.equal(stopHookOutput(payload, root), null);
});

test("the cold-read reminder carries the project's writing corrections", (t) => {
  const root = project(t);
  const transcript = path.join(root, "session.jsonl");
  fs.writeFileSync(transcript, [user("改一下引言"), tool("Bash", { command: "latexmk -pdf main.tex" }), result(), ""].join("\n"));
  const reminder = stopHookOutput({ hook_event_name: "Stop", transcript_path: transcript }, root);
  assert.match(reminder.reason, /本项目写稿和图方面的做法更正：\n- 10-25 写稿和图：以后：交付前做冷读终检/u);
  assert.doesNotMatch(reminder.reason, /说人话：/u, "only the writing topic");
});

test("session start after compaction and a message on a corrected topic bring the corrections back", (t) => {
  const root = project(t);
  const compact = sessionStartOutput({ hook_event_name: "SessionStart", source: "compact" }, null, { project: root });
  assert.match(compact.hookSpecificOutput.additionalContext, /本项目的做法更正/u);
  const prompt = userPromptSubmitOutput({ hook_event_name: "UserPromptSubmit", prompt: "把论文第三节再改改", session_id: "s" }, { version: "test" }, { project: root });
  assert.match(prompt.hookSpecificOutput.additionalContext, /和这条消息相关的做法更正[\s\S]*交付前做冷读终检/u);
  const plain = userPromptSubmitOutput({ hook_event_name: "UserPromptSubmit", prompt: "看看显存还够不够", session_id: "s" }, { version: "test" }, { project: root });
  assert.doesNotMatch(plain.hookSpecificOutput.additionalContext, /做法更正/u);
  const empty = project(t, null);
  assert.doesNotMatch(sessionStartOutput({ hook_event_name: "SessionStart", source: "compact" }, null, { project: empty }).hookSpecificOutput.additionalContext, /做法更正/u);
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
  assert.match(experienceContext(root), /该更新了：上次提炼在 2026-10-20，之后用户又说了 31 条本人原话/u);
  const context = sessionStartOutput({ hook_event_name: "SessionStart", source: "compact" }, null, { project: root }).hookSpecificOutput.additionalContext;
  assert.match(context, /用户的核心需求与约束（导师 2026-10-20 从用户原话提炼[^）]*）：\n核心需求：\n- 模型从数据学会写可改的整衣程序（用户 9 月原话）\n约束：\n- 不做版型数据库（10-23）/u);
  assert.doesNotMatch(context, /主线和指标对得上/u, "only the two sections a host carries");
  assert.match(context, /本项目的做法更正/u);
  assert.match(context, /和本轮相关的可迁移认识[^\n]*数据与评价[\s\S]*测试集分母必须固定/u);
  const startup = sessionStartOutput({ hook_event_name: "SessionStart", source: "startup" }, null, { project: root }).hookSpecificOutput.additionalContext;
  assert.match(startup, /用户的核心需求与约束/u, "a new session starts from them too");
});

test("a reflection request is told where the reflection goes, and reminded once if it was not saved", (t) => {
  const root = project(t);
  const asked = userPromptSubmitOutput({ hook_event_name: "UserPromptSubmit", prompt: "你反思一下这次为什么没发现行话", session_id: "s" }, { version: "test" }, { project: root });
  assert.match(asked.hookSpecificOutput.additionalContext, /\.dove\/research\/reflections\/YYYY-MM-DD-主题\.md/u);
  const transcript = path.join(root, "session.jsonl");
  const payload = { hook_event_name: "Stop", transcript_path: transcript };
  fs.writeFileSync(transcript, [user("你反思一下这次为什么没发现行话", "r1"), tool("Write", { file_path: `${root}/notes/thoughts.md`, content: "…" }), result(), ""].join("\n"));
  const reminder = stopHookOutput(payload, root);
  assert.match(reminder.reason, /还没有存到 \.dove\/research\/reflections，也没有把以后怎么做记进做法更正/u);
  assert.equal(stopHookOutput(payload, root), null);
  fs.writeFileSync(transcript, [user("复盘一下这周", "r2"), tool("Write", { file_path: `${root}/.dove/research/reflections/2026-10-26-jargon.md`, content: "…" }), result(), tool("Edit", { file_path: `${root}/.dove/research/PRACTICE.md`, old_string: "a", new_string: "b" }), result(), ""].join("\n"));
  assert.equal(stopHookOutput(payload, root), null, "saved in both places");
});
