import fs from "node:fs";
import path from "node:path";

import { CORRECTION_TOPICS } from "./cross-project.mjs";

// Practice corrections: where the user corrected how the work was done in
// this project, what was wrong and what is done instead. The host adds one
// line right after a correction; Dove brings the lines back when they matter:
// at session start and after compaction, when the user's message touches a
// topic, beside the cold-read reminder for writing, and in the mentor's brief.
//
//   - 2026-10-25 · 写稿和图 · 原话：“……” · 错在哪：…… · 以后：……

export const PRACTICE_PATH = ".dove/research/PRACTICE.md";
const MAX_BYTES = 512 * 1024;

// The correction topics plus writing and "other"; patterns find the topic a
// user's message touches (a correction or simply a request on that subject).
export const PRACTICE_TOPICS = Object.freeze([
  ...CORRECTION_TOPICS.map((topic) => ({ id: topic.id, short: topic.short, pattern: topic.pattern })),
  { id: "writing", short: "写稿和图", pattern: /论文|摘要|引言|图注|画图|配图|作图|版面|排版|行话|写作|稿子|稿件|措辞|投稿/u },
  { id: "other", short: "其他", pattern: null }
]);

// A correction says something was wrong or should have been done otherwise.
const CRITIQUE = /不|别|没|又|还是|为什么|怎么|错|应该/u;

export function practiceTopicNames() {
  return PRACTICE_TOPICS.map((topic) => topic.short);
}

/** The topic an entry names, matched by its short name (or a topic's full label). */
export function topicOfEntry(entry) {
  const named = String(entry?.topic ?? "");
  const byShort = PRACTICE_TOPICS.find((topic) => named === topic.short)
    ?? PRACTICE_TOPICS.find((topic) => topic.id !== "other" && named.includes(topic.short));
  if (byShort) return byShort;
  const byLabel = CORRECTION_TOPICS.find((topic) => topic.label.split("、").some((part) => named.includes(part)));
  return (byLabel && PRACTICE_TOPICS.find((topic) => topic.id === byLabel.id)) ?? PRACTICE_TOPICS.find((topic) => topic.id === "other");
}

/** Topics a message touches, by keyword. */
export function topicsOfMessage(text) {
  const value = String(text ?? "");
  return PRACTICE_TOPICS.filter((topic) => topic.pattern?.test(value));
}

/** Whether a user's message reads as a correction of how the work was done. */
export function correctionTopics(text) {
  const value = String(text ?? "");
  if (!CRITIQUE.test(value)) return [];
  return topicsOfMessage(value);
}

function field(fields, name) {
  const found = fields.find((item) => new RegExp(`^${name}\\s*[:：]`, "u").test(item));
  return found ? found.replace(/^[^:：]+[:：]\s*/u, "").trim() : null;
}

export function parsePractice(text = "") {
  const entries = [];
  for (const line of String(text).split(/\r?\n/u)) {
    const match = line.match(/^\s*[-*]\s*(\d{4}-\d{2}-\d{2})\s*[·•|]\s*(.+?)\s*$/u);
    if (!match) continue;
    const fields = match[2].split(/\s*[·•]\s*/u);
    const topic = fields.shift().trim();
    entries.push({ date: match[1], topic, quote: field(fields, "原话"), wrong: field(fields, "错在哪"), next: field(fields, "以后") });
  }
  return entries.map((entry, index) => ({ ...entry, order: index }))
    .sort((left, right) => right.date.localeCompare(left.date) || right.order - left.order)
    .map(({ order, ...entry }) => entry);
}

export function readPractice(project, options = {}) {
  const fsOps = options.fsOps ?? fs;
  try {
    const file = path.join(project, PRACTICE_PATH);
    const stat = fsOps.statSync(file);
    if (!stat.isFile() || stat.size > MAX_BYTES) return [];
    const fd = fsOps.openSync(file, "r");
    try {
      const buffer = Buffer.alloc(stat.size);
      const count = fsOps.readSync(fd, buffer, 0, buffer.length, 0);
      return parsePractice(buffer.subarray(0, count).toString("utf8"));
    } finally {
      fsOps.closeSync(fd);
    }
  } catch {
    return [];
  }
}

function clip(text, limit) {
  const characters = Array.from(String(text ?? ""));
  return characters.length > limit ? `${characters.slice(0, limit).join("")}…` : characters.join("");
}

function line(entry) {
  const next = entry.next ? `以后：${clip(entry.next, 120)}` : entry.wrong ? `错在：${clip(entry.wrong, 120)}` : "";
  const quote = entry.quote ? `（原话：${clip(entry.quote.replace(/^[“"]|[”"]$/gu, ""), 40)}）` : "";
  return `- ${entry.date.slice(5)} ${topicOfEntry(entry).short}：${next}${quote}`;
}

/** The latest entries, for session start and after compaction. */
export function practiceContext(entries, limit = 8) {
  if (!entries.length) return "";
  return [`本项目的做法更正（用户纠正过的做法，新的在前；全部见 ${PRACTICE_PATH}）：`, ...entries.slice(0, limit).map(line)].join("\n");
}

/** Entries on the topics a message touches, for that message only. */
export function practiceForMessage(entries, text, limit = 5) {
  const topics = new Set(topicsOfMessage(text).map((topic) => topic.id));
  if (!topics.size) return "";
  const matched = entries.filter((entry) => topics.has(topicOfEntry(entry).id)).slice(0, limit);
  if (!matched.length) return "";
  return ["和这条消息相关的做法更正（本项目用户纠正过的做法）：", ...matched.map(line)].join("\n");
}

/** Entries on one topic, by id. */
export function practiceOnTopic(entries, id, limit = 5) {
  const matched = entries.filter((entry) => topicOfEntry(entry).id === id).slice(0, limit);
  return matched.length ? matched.map(line).join("\n") : "";
}

// A reflection the user asks for has one home: the full text in reflections/,
// each "以后怎么做" also as a practice line so Dove brings it back.
export const REFLECTIONS_DIR = ".dove/research/reflections";
const REFLECTION_REQUEST = /反思|复盘|总结(?:一下)?(?:经验|教训)|吸取教训|教训是什么|经验教训/u;

export function reflectionRequested(text) {
  return REFLECTION_REQUEST.test(String(text ?? ""));
}

export function reflectionGuidance() {
  return `用户要你反思。写到 ${REFLECTIONS_DIR}/YYYY-MM-DD-主题.md：哪里出了问题、为什么、依据（原话、记录或结果）、以后怎么做；结尾“以后怎么做”的每一条，同时按做法更正的格式追加到 ${PRACTICE_PATH}，Dove 之后会在会话开始、压缩后和相关的消息里把这些行送回来。只写能改变以后做法的结论，不写检讨套话。`;
}

export function reflectionReminder(missing) {
  return `用户这一轮要你反思，但还没有${missing.join("，也没有")}。${reflectionGuidance()}这段话是 Dove 根据用户消息自动提出的，不是用户刚说的。`;
}

export function correctionReminder(topics) {
  const names = topics.map((topic) => topic.short).join("、");
  return `用户这条消息像是对做法的纠正（${names}）。按操作说明“用户纠正之后”这一时刻，在 ${PRACTICE_PATH} 记一行：- YYYY-MM-DD · 主题 · 原话：“……” · 错在哪：…… · 以后：……。主题从 ${practiceTopicNames().join("、")} 里选；只记这次实际错在哪、以后具体怎么做，不扩成普遍禁令。如果这条其实不是纠正，就不用记。这段话是 Dove 根据用户消息自动提出的，不是用户刚说的。`;
}
