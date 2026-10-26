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
    // "可迁移：", or "可迁移（数据与评价）：" / "可迁移（数据与评价，2026-10-21）：" carrying the dimension and the original date.
    const item = line.match(/^\s*(?:[-*+]\s*|\d+[.)]\s+)?\**\s*可迁移\s*(?:[（(]([^）)]{0,40})[）)])?\s*\**\s*[:：]\s*(.+?)\s*$/u);
    if (item) {
      const note = item[1] ?? "";
      items.push({
        date: validDate(note.match(/\d{4}-\d{2}-\d{2}/u)?.[0]) ?? date,
        dimension: dimensionOf(note),
        text: item[2].replace(/\*\*/gu, "").trim()
      });
    }
  }
  return items;
}

// The eight dimensions, with the words that usually signal each in a lesson.
export const DIMENSION_WORDS = Object.freeze({
  问题价值: /问题价值|价值|意义|应用场景|需求/u,
  创新: /创新|新意|近邻|首次|差异化/u,
  机制与理论: /机制|理论|原理|因果|命题|解释/u,
  方法质量与可行性: /方法|可行|约束|优化|求解|收敛|初始化|表示/u,
  数据与评价: /评价|评测|指标|协议|分母|测试集|基准|标注|数据/u,
  实现: /实现|代码|接口|执行器|管线|工程/u,
  实验与证据价值: /实验|证据|对照|消融|规模|样本|显著/u,
  表达与交付: /表达|交付|写作|论文|摘要|图注|稿/u
});
const DIMENSION_SHORT = Object.freeze({ 问题: "问题价值", 新意: "创新", 机制: "机制与理论", 理论: "机制与理论", 方法: "方法质量与可行性", 可行性: "方法质量与可行性", 评价: "数据与评价", 数据: "数据与评价", 实验: "实验与证据价值", 证据: "实验与证据价值", 表达: "表达与交付", 交付: "表达与交付" });

function dimensionOf(text) {
  const value = String(text ?? "");
  const full = Object.keys(DIMENSION_WORDS).find((name) => value.includes(name));
  if (full) return full;
  const short = Object.keys(DIMENSION_SHORT).find((name) => value.includes(name));
  return short ? DIMENSION_SHORT[short] : null;
}

function bigrams(text) {
  const characters = Array.from(String(text ?? "").replace(/[\s，。；：、“”‘’（）()《》,.;:!?！？\-—]/gu, ""));
  const set = new Set();
  for (let index = 0; index + 1 < characters.length; index += 1) set.add(characters[index] + characters[index + 1]);
  return set;
}

/**
 * Lessons from other projects most relevant to this round: the targeted
 * dimension (tagged, or read from the lesson's words), shared wording with
 * the round's plan, then recency. Fixed weights, not tuned per project.
 */
export function relevantTransferable(items, { project = null, dimension = null, text = "", limit = 6 } = {}) {
  const plan = bigrams(text);
  const dated = items.filter((item) => item.project !== project);
  const dates = dated.map((item) => item.date ?? "").sort();
  const scored = dated.map((item, index) => {
    let score = 0;
    if (dimension && item.dimension === dimension) score += 3;
    else if (dimension && !item.dimension && DIMENSION_WORDS[dimension]?.test(item.text)) score += 2;
    if (plan.size) {
      const words = bigrams(item.text);
      let shared = 0;
      for (const pair of words) if (plan.has(pair)) shared += 1;
      score += words.size ? (10 * shared) / Math.sqrt(words.size * plan.size) : 0;
    }
    const rank = dates.length > 1 ? dates.indexOf(item.date ?? "") / (dates.length - 1) : 0;
    return { item, score, recency: rank, index };
  });
  const relevant = scored.filter((entry) => entry.score > 0).sort((left, right) => right.score + right.recency - (left.score + left.recency));
  const picked = relevant.length ? relevant : scored.sort((left, right) => String(right.item.date ?? "").localeCompare(String(left.item.date ?? "")));
  return picked.slice(0, limit).map((entry) => entry.item);
}

/** Lines of the cross-project experience file written by renderCrossProjectExperience. */
export function parseCrossProjectExperience(text = "") {
  const items = [];
  for (const line of String(text).split(/\r?\n/u)) {
    const match = line.match(/^- (\d{4}-\d{2}-\d{2}|未注明日期) · ([^：（]+?)(?:（([^）]+)）)?：(.+)$/u);
    if (match) items.push({ date: match[1] === "未注明日期" ? null : match[1], project: match[2], dimension: match[3] ?? null, text: match[4] });
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
  for (const item of items) lines.push(`- ${item.date ?? "未注明日期"} · ${item.project}${item.dimension ? `（${item.dimension}）` : ""}：${item.text}`);
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
// `short` names the topic in a practice correction.
export const CORRECTION_TOPICS = Object.freeze([
  { id: "plain", short: "说人话", label: "说人话、讲清楚", pattern: /说人话|看不懂|听不懂|大白话|白话|第一次接手|讲清楚|说清楚/u },
  { id: "drift", short: "跑偏", label: "跑偏、换成别的问题", pattern: /跑偏|带偏|偏了|偏离|等价成|主问题|不是我要的|离题|答非所问/u },
  { id: "limits", short: "设限", label: "给自己设限", pattern: /给自己设|自设|套授权|不要给自己|别给自己|设那[么麽]多|自己加的限制|不需要授权/u },
  { id: "scale", short: "实验太小", label: "实验太小", pattern: /小规模|规模太小|样本太少|跑全量/u },
  { id: "engineering", short: "变成工程", label: "变成工程", pattern: /变成工程|工程化|不是科研|工程上的/u },
  { id: "seeds", short: "补种子", label: "补种子、加步数", pattern: /种子|seed/iu },
  { id: "facts", short: "莫须有", label: "莫须有、编造", pattern: /莫须有|编造|瞎说|胡说|乱说|没有依据/u },
  { id: "generality", short: "通用和泛化", label: "通用和泛化", pattern: /泛化|狭窄|局限成/u },
  { id: "finish", short: "没做完", label: "没做完、半途收窄", pattern: /没做完|赶紧做完|半途|收窄/u },
  { id: "method-first", short: "先讲清问题和方法", label: "先讲清问题和方法", pattern: /现有方法为什么不好|要解决什么问题|先回答我/u },
  { id: "stall", short: "停滞", label: "停滞、没进展", pattern: /停滞|没进展|没有进展|进展缓慢|一直没有|原地/u }
]);

function ownEntries(text) {
  const entries = [];
  for (const line of String(text).split(/\r?\n/u)) {
    const match = line.match(/^- (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) · 本人 · (.*)$/u);
    if (!match) continue;
    // The summary keeps transcript time (UTC); rounds are counted in local days.
    const at = Date.parse(`${match[1]}T${match[2]}:00Z`);
    entries.push({ date: match[1], time: `${match[1]} ${match[2]}`, at, day: dayString(at), text: match[3] });
  }
  return entries;
}

/** The user's own messages from a project's originals summary, with their local day. */
export function readOwnEntries(root, options = {}) {
  const text = readText(path.join(root, USER_ORIGINALS_PATH), options.fsOps ?? fs);
  return text ? ownEntries(text) : [];
}

/** Whether one of the user's own messages is a correction on a recurring topic. */
export function isCorrection(text) {
  return CORRECTION_TOPICS.some((topic) => topic.pattern.test(text));
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
