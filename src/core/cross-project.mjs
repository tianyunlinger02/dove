import fs from "node:fs";
import path from "node:path";

import { USER_ORIGINALS_PATH } from "./user-originals.mjs";

// Two views across all registered projects: what mentors marked as
// transferable ("可迁移："), and the user's recurring corrections grouped by
// topic. The first is also written into each project so a host writing a
// method design can read it; the second feeds Dove's own development.

export const CROSS_PROJECT_EXPERIENCE_PATH = ".dove/install/CROSS_PROJECT_EXPERIENCE.md";
const MENTOR_NOTES = ".dove/research/MENTOR_NOTES.md";
const MAX_ITEMS = 120;
const DAY_MS = 86400000;

function readText(file, fsOps) {
  try {
    const stat = fsOps.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    return fsOps.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function validDate(value) {
  if (!value) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null;
}

/** Lines a mentor note marks "可迁移：", with the date of the note they sit in. */
export function parseTransferable(text = "") {
  const items = [];
  let date = null;
  let fence = null;
  for (const line of String(text).split(/\r?\n/u)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/u)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^\s*#{1,6}\s+(.+)$/u);
    if (heading) {
      date = validDate(heading[1].match(/\d{4}-\d{2}-\d{2}/u)?.[0]) ?? date;
      continue;
    }
    const explicit = line.match(/^\s*(?:[-*]\s*)?(?:\*\*)?日期(?:\*\*)?\s*[:：]\s*(\d{4}-\d{2}-\d{2})/u)?.[1];
    if (explicit) date = validDate(explicit) ?? date;
    const item = line.match(/^\s*(?:[-*+]\s*|\d+[.)]\s+)?\**\s*可迁移\s*\**\s*[:：]\s*(.+?)\s*$/u)?.[1];
    if (item) items.push({ date, text: item.replace(/\*\*/gu, "").trim() });
  }
  return items;
}

export function collectTransferable(roots, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const items = [];
  for (const root of roots) {
    const text = readText(path.join(root, MENTOR_NOTES), fsOps);
    if (!text) continue;
    for (const item of parseTransferable(text)) items.push({ project: path.basename(root), root, ...item });
  }
  return items.sort((left, right) => String(right.date ?? "").localeCompare(String(left.date ?? ""))).slice(0, MAX_ITEMS);
}

export function renderCrossProjectExperience(items) {
  const lines = [
    "# 跨项目经验",
    "",
    "Dove 从各项目导师笔记里收集标着“可迁移：”的认识，新的在前。写方法设计时看一眼：别的项目已经验证或否掉的做法，说明这次有什么不同。这些是其他项目的导师判断，不是本项目的证据，也不是用户的要求。",
    ""
  ];
  if (!items.length) lines.push("还没有导师标过可迁移的认识。");
  for (const item of items) lines.push(`- ${item.date ?? "未注明日期"} · ${item.project}：${item.text}`);
  return `${lines.join("\n")}\n`;
}

/** Write the shared experience file into every registered project that has Dove installed; unchanged files stay untouched. */
export function refreshCrossProjectExperience(roots, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const content = renderCrossProjectExperience(collectTransferable(roots, options));
  const written = [];
  for (const root of roots) {
    const file = path.join(root, CROSS_PROJECT_EXPERIENCE_PATH);
    try {
      if (!fsOps.statSync(path.dirname(file)).isDirectory()) continue;
      if (readText(file, fsOps) === content) continue;
      const temporary = `${file}.${process.pid}.tmp`;
      fsOps.writeFileSync(temporary, content);
      fsOps.renameSync(temporary, file);
      written.push(root);
    } catch {
      // A project without an install directory, or unwritable, is skipped.
    }
  }
  return { items: content, written };
}

// Topics follow "the user's most frequent sayings". Keyword grouping is a
// rough index for Dove's development, not a judgment of any message.
export const CORRECTION_TOPICS = Object.freeze([
  { id: "plain", label: "说人话、讲清楚", pattern: /说人话|看不懂|听不懂|大白话|白话|第一次接手|讲清楚|说清楚/u },
  { id: "drift", label: "跑偏、换成别的问题", pattern: /跑偏|带偏|偏了|偏离|等价成|主问题|不是我要的|离题|答非所问/u },
  { id: "limits", label: "给自己设限", pattern: /给自己设|自设|套授权|不要给自己|别给自己|设那[么麽]多|自己加的限制|不需要授权/u },
  { id: "scale", label: "实验太小", pattern: /小规模|规模太小|样本太少|跑全量/u },
  { id: "engineering", label: "变成工程", pattern: /变成工程|工程化|不是科研|工程上的/u },
  { id: "seeds", label: "补种子、加步数", pattern: /种子|seed/iu },
  { id: "facts", label: "莫须有、编造", pattern: /莫须有|编造|瞎说|胡说|乱说|没有依据/u },
  { id: "generality", label: "通用和泛化", pattern: /泛化|狭窄|局限成/u },
  { id: "finish", label: "没做完、半途收窄", pattern: /没做完|赶紧做完|半途|收窄/u },
  { id: "method-first", label: "先讲清问题和方法", pattern: /现有方法为什么不好|要解决什么问题|先回答我/u },
  { id: "stall", label: "停滞、没进展", pattern: /停滞|没进展|没有进展|进展缓慢|一直没有|原地/u }
]);

function ownEntries(text) {
  const entries = [];
  for (const line of String(text).split(/\r?\n/u)) {
    const match = line.match(/^- (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) · 本人 · (.*)$/u);
    if (match) entries.push({ date: match[1], time: `${match[1]} ${match[2]}`, text: match[3] });
  }
  return entries;
}

function clip(text, limit) {
  const characters = Array.from(String(text));
  return characters.length > limit ? `${characters.slice(0, limit).join("")}…` : characters.join("");
}

function dayString(time) {
  const value = new Date(time);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

/** The user's own messages per topic over the last 7 and 30 days, with the most recent wording. */
export function summarizeCorrections(roots, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const now = options.now ?? Date.now();
  const since30 = dayString(now - 29 * DAY_MS);
  const since7 = dayString(now - 6 * DAY_MS);
  const topics = CORRECTION_TOPICS.map((topic) => ({ id: topic.id, label: topic.label, count7: 0, count30: 0, projects: {}, recent: [] }));
  let messages = 0;
  for (const root of roots) {
    const text = readText(path.join(root, USER_ORIGINALS_PATH), fsOps);
    if (!text) continue;
    const project = path.basename(root);
    for (const entry of ownEntries(text)) {
      if (entry.date < since30) continue;
      messages += 1;
      for (const [index, topic] of CORRECTION_TOPICS.entries()) {
        if (!topic.pattern.test(entry.text)) continue;
        const summary = topics[index];
        summary.count30 += 1;
        if (entry.date >= since7) summary.count7 += 1;
        summary.projects[project] = (summary.projects[project] ?? 0) + 1;
        summary.recent.push({ project, time: entry.time, text: clip(entry.text, 300) });
      }
    }
  }
  for (const topic of topics) topic.recent = topic.recent.sort((left, right) => right.time.localeCompare(left.time)).slice(0, 5);
  return { since: since30, since7, messages, topics: topics.filter((topic) => topic.count30 > 0).sort((left, right) => right.count30 - left.count30) };
}
