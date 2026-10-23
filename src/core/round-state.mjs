import fs from "node:fs";
import path from "node:path";

import { DOVE_RESEARCH_QUALITY_DIMENSIONS } from "./dove-research-contract.mjs";
import { cardField, parseDoveCurrentRound } from "./identity-card.mjs";

// What Dove computes from a project's own records, for the hooks, the status
// line, the mentor handoff and the dashboard alike: the current round's plan
// (aim, due date, scale), each result's verdict, overrun and stall, the main
// metric, the eight-dimension trend and what is waiting for the user.
// Read-only; a missing or old-format record yields unknown, never a guess.

const RESEARCH = ".dove/research";
const ROUND_FILE = /^(\d+)[-_](brief|result)\.md$/iu;
const DAY_MS = 86400000;
const HEADER_LINES = 40;
const MAX_TEXT_BYTES = 64 * 1024;

// Short forms hosts use for a dimension; the full names come first.
const DIMENSION_ALIASES = Object.freeze([
  ["问题价值", "问题"], ["创新", "新意"], ["机制与理论", "机制"], ["方法质量与可行性", "方法"],
  ["数据与评价", "评价"], ["实现", "实现"], ["实验与证据价值", "证据"], ["表达与交付", "表达"]
]);

export const METHOD_ARGUMENTS = Object.freeze([
  ["problem", "要解决什么问题"],
  ["externalMethods", "外部方法为什么不行"],
  ["change", "我们的改法为什么能修"]
]);

// File bytes through whichever synchronous interface the caller's filesystem
// offers; with descriptors only the needed window (head or tail) is read.
function readBytes(file, stat, fsOps, maxBytes, tail) {
  if (typeof fsOps.readFileSync === "function") return { bytes: Buffer.from(fsOps.readFileSync(file)), offset: 0 };
  const size = stat.size ?? 0;
  const length = Math.min(size, maxBytes);
  const position = tail ? size - length : 0;
  const bytes = Buffer.alloc(length);
  const fd = fsOps.openSync(file, "r");
  try {
    const count = length ? fsOps.readSync(fd, bytes, 0, length, position) : 0;
    return { bytes: bytes.subarray(0, count), offset: position, size };
  } finally {
    fsOps.closeSync(fd);
  }
}

// Records are small Markdown files; read them whole and keep the head (or the
// tail, for appended notes) so any synchronous filesystem stand-in works.
function readText(file, fsOps, maxBytes = MAX_TEXT_BYTES, tail = false) {
  try {
    const stat = (fsOps.lstatSync ?? fsOps.statSync).call(fsOps, file);
    if (!stat.isFile() || stat.isSymbolicLink?.()) return null;
    const read = readBytes(file, stat, fsOps, maxBytes, tail);
    const total = read.size ?? read.bytes.length;
    const size = Math.min(read.bytes.length, maxBytes);
    let window = tail ? read.bytes.subarray(read.bytes.length - size) : read.bytes.subarray(0, size);
    if (tail && total > size) {
      let start = 0;
      while (start < window.length && (window[start] & 0xc0) === 0x80) start += 1;
      window = window.subarray(start);
    }
    const birth = stat.birthtimeMs > 0 ? stat.birthtimeMs : null;
    return { text: new TextDecoder("utf-8").decode(window), truncated: total > size, mtime: stat.mtimeMs ?? null, birthtime: birth };
  } catch {
    return null;
  }
}

function listDirectory(directory, fsOps) {
  try {
    return fsOps.readdirSync(directory);
  } catch {
    return [];
  }
}

function validDate(value) {
  if (!value) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null;
}

function dateTime(date) {
  return Date.parse(`${date}T00:00:00Z`);
}

// The local calendar day, compared with record dates at day granularity.
function today(now) {
  const current = new Date(now ?? Date.now());
  return Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
}

function localDate(time) {
  const value = new Date(time);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

// Lines outside fenced code, so an example inside a code block is not a field.
function unfencedLines(text, limit = Infinity) {
  const lines = [];
  let fence = null;
  for (const line of String(text).split(/\r?\n/u)) {
    if (lines.length >= limit) break;
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/u)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      lines.push("");
      continue;
    }
    lines.push(fence ? "" : line);
  }
  return lines;
}

// "对准：x", "- 对准：x", "**对准**：x" and "主指标（待用户确认）：x" are the same field.
function headerField(lines, name) {
  const pattern = new RegExp(`^[ \\t]*(?:[-*][ \\t]*)?\\**[ \\t]*${name}[ \\t]*(?:[（(][^）)\\r\\n]{0,30}[）)])?[ \\t]*\\**[ \\t]*[:：][ \\t]*(.*?)[ \\t]*$`, "u");
  for (const line of lines) {
    const value = line.match(pattern)?.[1]?.replace(/\*\*/gu, "").trim();
    if (value) return value;
  }
  return null;
}

export function normalizeDimension(value) {
  if (!value) return null;
  const text = String(value);
  return DOVE_RESEARCH_QUALITY_DIMENSIONS.find((name) => text.includes(name))
    ?? DIMENSION_ALIASES.find(([, alias]) => text.includes(alias))?.[0]
    ?? null;
}

function plainLine(text, limit = 240) {
  if (!text) return null;
  const flat = String(text).replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1").replace(/[`*]/gu, "").replace(/\s+/gu, " ").trim();
  if (!flat) return null;
  const characters = Array.from(flat);
  return characters.length > limit ? `${characters.slice(0, limit).join("")}…` : flat;
}

function sectionParagraph(lines, pattern) {
  const start = lines.findIndex((line) => /^\s*#{1,4}\s+/u.test(line) && pattern.test(line));
  if (start === -1) return null;
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\s*#{1,4}\s+/u.test(line)) break;
    if (!line.trim()) {
      if (body.length) break;
      continue;
    }
    body.push(line.trim().replace(/^[-*+]\s+/u, ""));
  }
  return body.join(" ") || null;
}

/** The plan a round brief commits to at its top. */
export function parseBriefHeader(text = "") {
  const lines = unfencedLines(text);
  const head = lines.slice(0, HEADER_LINES);
  const targetText = headerField(head, "对准");
  const dueText = headerField(head, "见分晓");
  const dates = dueText?.match(/\d{4}-\d{2}-\d{2}/gu) ?? [];
  // "见分晓：2026-10-30（开始：2026-10-23）" or "…（2026-10-23 开始）"; the first date is always the due date.
  const startAfter = dueText?.match(/开始\s*[:：]?\s*(\d{4}-\d{2}-\d{2})/u)?.[1];
  const startBefore = dates.slice(1).find((date) => new RegExp(`${date}\\s*开始`, "u").test(dueText));
  return {
    summary: plainLine(headerField(lines, "一句话"), 200),
    target: targetText,
    targetDimension: normalizeDimension(targetText),
    due: validDate(dates[0]),
    start: validDate(startAfter ?? startBefore),
    scale: headerField(head, "规模")?.replace(/[。；;，,\s]+$/u, "") || null,
    success: plainLine(sectionParagraph(lines, /预期结果/u), 300)
  };
}

export function verdictKind(value) {
  if (!value) return null;
  const text = String(value).replace(/^[\s*]+/u, "");
  if (/^未兑现/u.test(text)) return "missed";
  if (/^方法取舍/u.test(text)) return "decision";
  if (/^兑现/u.test(text)) return "delivered";
  return null;
}

export const VERDICT_LABELS = Object.freeze({ delivered: "兑现", missed: "未兑现", decision: "方法取舍" });

/** The verdict a round result records against its own brief. */
export function parseResultHeader(text = "") {
  const verdict = headerField(unfencedLines(text, HEADER_LINES), "判定");
  return { verdict, verdictKind: verdictKind(verdict) };
}

export function parseMarkdownTables(text = "") {
  const tables = [];
  let current = null;
  const cells = (line) => line.trim().replace(/^\|/u, "").replace(/\|$/u, "").split("|").map((cell) => cell.trim());
  for (const line of String(text).split(/\r?\n/u)) {
    if (!/^\s*\|.*\|\s*$/u.test(line)) {
      if (current) tables.push(current);
      current = null;
      continue;
    }
    const row = cells(line);
    if (row.every((cell) => /^:?-+:?$/u.test(cell))) continue;
    if (!current) current = { header: row, rows: [] };
    else current.rows.push(row);
  }
  if (current) tables.push(current);
  return tables;
}

/** EVAL's top line: `主指标：名称（数据与协议）；当前最好：值（日期，第 N 轮）`. */
export function parseMainMetric(text = "") {
  const value = headerField(unfencedLines(text, 80), "主指标");
  if (!value) return null;
  const [name, best] = value.split(/[；;]\s*当前最好\s*[:：]\s*/u);
  return { text: value, name: name.trim() || null, best: best?.trim() || null };
}

/** The eight-dimension trend table: one row per mentor judgment, the last row is the latest. */
export function parseTrendTable(text = "") {
  const table = parseMarkdownTables(text).filter((candidate) =>
    candidate.header.some((cell) => cell.includes("最卡"))
    && candidate.header.filter((cell) => normalizeDimension(cell)).length >= 4).at(-1);
  if (!table) return null;
  const bottleneckColumn = table.header.findIndex((cell) => cell.includes("最卡"));
  const dateColumn = table.header.findIndex((cell) => /日期|date/iu.test(cell));
  const roundColumn = table.header.findIndex((cell) => /轮|round/iu.test(cell));
  const rows = table.rows.filter((row) => row.some(Boolean)).map((row) => ({
    date: row[dateColumn] ?? null,
    round: row[roundColumn] ?? null,
    grades: Object.fromEntries(table.header.map((cell, index) => [normalizeDimension(cell), row[index]])
      .filter(([dimension], index) => dimension && index !== bottleneckColumn)),
    bottleneck: normalizeDimension(row[bottleneckColumn]) ?? (row[bottleneckColumn] || null)
  }));
  return { header: table.header, rows, latest: rows.at(-1) ?? null };
}

// Keep the full argument and the user's recorded words, not a one-line summary.
export function parseMethodDesign(text = "") {
  const paragraphs = { problem: [], externalMethods: [], change: [], userReply: [] };
  let inDesign = false;
  let active = null;
  let fence = null;
  for (const line of String(text).split(/\r?\n/u)) {
    const marker = line.match(/^\s*(`{3,}|~{3,})(.*)$/u);
    if (fence) {
      if (active) paragraphs[active].push(line);
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }
    if (marker) {
      fence = marker[1];
      if (active) paragraphs[active].push(line);
      continue;
    }
    const heading = line.match(/^\s*(#{1,3})\s+(.+?)\s*#*\s*$/u);
    if (!inDesign) {
      if (heading?.[1] === "##" && heading[2] === "方法设计") inDesign = true;
      continue;
    }
    if (heading) {
      if (heading[1].length <= 2) break;
      active = METHOD_ARGUMENTS.find(([, label]) => label === heading[2])?.[0] ?? (heading[2] === "用户答复" ? "userReply" : null);
      continue;
    }
    if (active) paragraphs[active].push(line);
  }
  if (!inDesign) return null;
  const fields = Object.fromEntries(Object.entries(paragraphs).map(([key, lines]) => [key, lines.join("\n").trim() || null]));
  // A placeholder such as "（待用户答复）" or "尚未答复" is not the user's reply.
  if (fields.userReply && PLACEHOLDER_REPLY.test(fields.userReply.replace(/^[-*>\s]+/u, ""))) fields.userReply = null;
  return { ...fields, missing: METHOD_ARGUMENTS.filter(([key]) => !fields[key]).map(([, label]) => label) };
}

const NOTHING = /^(?:无|没有|暂无|none|n\/a)[。.]?$/iu;
const PLACEHOLDER_REPLY = /^[（(【\[]?\s*(?:待|尚未|未|暂无|无|还没有|目前没有|当前没有|TBD|pending)/iu;

/** Items the mentor's latest note leaves for the user, under a `待用户决定` heading or line. */
export function parseMentorPending(text = "") {
  const lines = unfencedLines(text);
  let start = -1;
  let level = 0;
  let inline = null;
  for (const [index, line] of lines.entries()) {
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/u);
    if (heading && /待(?:用户|你)决定|等(?:用户|你)定/u.test(heading[2])) {
      start = index;
      level = heading[1].length;
      inline = null;
      continue;
    }
    const field = line.match(/^\s*(?:[-*]\s*)?\**\s*待(?:用户|你)决定\s*\**\s*[:：]\s*(.*)$/u);
    if (field) {
      start = -1;
      inline = field[1];
    }
  }
  if (inline !== null) return inline.split(/[；;]/u).map((item) => item.trim()).filter((item) => item && !NOTHING.test(item));
  if (start === -1) return [];
  const items = [];
  for (const line of lines.slice(start + 1)) {
    const heading = line.match(/^\s*(#{1,6})\s+/u);
    if (heading && heading[1].length <= level) break;
    const item = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/u)?.[1]?.trim();
    if (item && !NOTHING.test(item)) items.push(item);
  }
  return items;
}

function collectRoundFiles(directory, fsOps) {
  const byNumber = new Map();
  for (const name of listDirectory(directory, fsOps)) {
    const match = name.match(ROUND_FILE);
    if (!match) continue;
    const number = Number(match[1]);
    const entry = byNumber.get(number) ?? { number, label: match[1] };
    entry[match[2].toLowerCase()] = name;
    byNumber.set(number, entry);
  }
  return [...byNumber.values()].sort((left, right) => right.number - left.number);
}

function roundNumberOf(reference) {
  const value = reference?.match(/(?:^|\/)0*(\d+)[-_]brief\.md/iu)?.[1];
  return value === undefined ? null : Number(value);
}

// "One round over its plan by as long again": the planned span runs from the
// stated start (or the brief file's creation) to the due date, at least a day.
export function computeOverrun({ due, start, createdAt }, now) {
  if (!due) return null;
  const dueTime = dateTime(due);
  const startTime = start ? dateTime(start) : createdAt ? today(createdAt) : null;
  const span = startTime !== null && startTime < dueTime ? dueTime - startTime : DAY_MS;
  const current = today(now);
  if (current <= dueTime + span) return null;
  return { due, daysPastDue: Math.round((current - dueTime) / DAY_MS), plannedDays: Math.round(span / DAY_MS) };
}

/**
 * Everything Dove computes about a project's rounds. Options: fsOps, now,
 * maxRounds (how many recent rounds to summarize, default 12).
 */
export function inspectRoundState(project, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const research = path.join(project, RESEARCH);
  const card = readText(path.join(research, "IDENTITY.md"), fsOps, Infinity)?.text ?? "";
  const current = card ? parseDoveCurrentRound(card) : null;
  const roundStatus = card ? cardField(card, "Round status") : null;
  const files = collectRoundFiles(path.join(research, "rounds"), fsOps);
  const rounds = files.slice(0, options.maxRounds ?? 12).map((entry) => {
    const brief = entry.brief ? readText(path.join(research, "rounds", entry.brief), fsOps) : null;
    const result = entry.result ? readText(path.join(research, "rounds", entry.result), fsOps) : null;
    return {
      number: entry.number,
      label: entry.label,
      ...(brief ? { brief: { file: `rounds/${entry.brief}`, createdAt: brief.birthtime ?? brief.mtime, ...parseBriefHeader(brief.text) } } : {}),
      ...(result ? { result: { file: `rounds/${entry.result}`, mtime: result.mtime, ...parseResultHeader(result.text) } } : {})
    };
  });

  const currentNumber = roundNumberOf(current?.brief);
  const currentRound = currentNumber === null ? null : rounds.find((round) => round.number === currentNumber)
    ?? { number: currentNumber, label: String(currentNumber) };
  const open = currentRound && !currentRound.result && !/paused|暂停|completed|完成|结束/iu.test(roundStatus ?? "");
  const overrun = open && currentRound.brief ? computeOverrun(currentRound.brief, options.now) : null;

  // Stall: the two latest results both missed, with no method decision between them.
  const results = rounds.filter((round) => round.result);
  const lastTwo = results.slice(0, 2);
  const stall = lastTwo.length === 2 && lastTwo.every((round) => round.result.verdictKind === "missed")
    ? { results: lastTwo.map((round) => round.result.file).reverse(), rounds: lastTwo.map((round) => round.number).reverse() }
    : null;

  const evaluation = readText(path.join(research, "EVAL.md"), fsOps, 256 * 1024)?.text ?? "";
  const mainMetric = parseMainMetric(evaluation);
  const trend = parseTrendTable(evaluation);

  const methodReference = card ? cardField(card, "Method design") : null;
  const methodBrief = methodReference?.match(/rounds\/\d+[-_]brief\.md/iu)?.[0] ?? null;
  const methodText = methodBrief ? readText(path.join(research, methodBrief), fsOps, Infinity)?.text : null;
  const methodDesign = methodText ? parseMethodDesign(methodText) : null;

  const notes = readText(path.join(research, "MENTOR_NOTES.md"), fsOps, MAX_TEXT_BYTES, true)?.text ?? "";
  const pending = [];
  if (methodDesign && !methodDesign.userReply) pending.push({ kind: "method-design", text: `方法设计（${methodBrief}）还没有记录用户看过后的答复。` });
  if (overrun) pending.push({ kind: "overrun", text: `第 ${currentRound.number} 轮超时：原定 ${overrun.due} 见分晓，已过 ${overrun.daysPastDue} 天（预计 ${overrun.plannedDays} 天）。继续当前方法、换方法还是换方向，等用户定。` });
  if (stall) pending.push({ kind: "stall", text: `第 ${stall.rounds.join("、")} 轮判定都是未兑现，其间没有方法取舍。继续当前方法、换方法还是换方向，等用户定。` });
  for (const item of parseMentorPending(notes)) pending.push({ kind: "mentor", text: item });

  return {
    currentRound: currentRound ? { ...currentRound, reference: current.brief, status: roundStatus, open: Boolean(open) } : null,
    rounds,
    overrun,
    stall,
    mainMetric,
    trend,
    methodDesign: methodDesign ? { source: methodBrief, ...methodDesign } : null,
    pending
  };
}

function dueText(due, now) {
  if (!due) return "未写";
  const days = Math.round((dateTime(due) - today(now)) / DAY_MS);
  return `${due}（${days > 0 ? `还有 ${days} 天` : days === 0 ? "就是今天" : `已过 ${-days} 天`}）`;
}

/** The per-message situation: this round's plan, flags, main metric and what waits for the user. */
export function renderRoundSituation(state, options = {}) {
  const lines = [];
  const round = state.currentRound;
  if (!round) lines.push("身份卡没有指向当前轮次（Current round）。");
  else if (!round.brief) lines.push(`当前轮次 ${round.reference} 还没有说明文件。`);
  else {
    const brief = round.brief;
    const status = round.result ? "已出结果" : round.open ? "进行中" : (round.status ?? "未写状态");
    lines.push(`本轮：第 ${round.number} 轮（${brief.file}，${status}）${brief.summary ? `：${brief.summary}` : "。"}`);
    const missing = [["对准", brief.target], ["见分晓", brief.due], ["规模", brief.scale]].filter(([, value]) => !value).map(([name]) => name);
    lines.push(`对准：${brief.targetDimension ?? brief.target ?? "未写"}；怎样算成：${brief.success ?? "说明里还没有“## 预期结果”"}`);
    lines.push(`规模：${brief.scale ?? "未写"}；见分晓：${dueText(brief.due, options.now)}。`);
    // Only the open round is asked to complete its plan; finished rounds are never rewritten.
    if (round.open && missing.length) lines.push(`本轮说明开头还缺：${missing.join("、")}。补上再接着做。`);
    const newFormat = Boolean(brief.target || brief.due || brief.scale);
    if (round.result?.verdict) lines.push(`判定：${round.result.verdict}。`);
    else if (round.result && newFormat) lines.push("判定：结果开头还没写“判定：”（兑现／未兑现／方法取舍），请对照说明里事先写下的标准补上。");
  }
  if (state.overrun) lines.push(`超时：本轮已超过预计时长一倍还没有结果。`);
  if (state.stall) lines.push(`停滞：第 ${state.stall.rounds.join("、")} 轮判定都是未兑现，其间没有方法取舍。`);
  lines.push(state.mainMetric ? `主指标：${state.mainMetric.text}` : "主指标：EVAL 开头还没写主指标（写好后请用户确认一次）。");
  const latest = state.trend?.latest;
  if (latest?.bottleneck) lines.push(`最近一次导师判断（${latest.date ?? "未写日期"}）最卡的一维：${latest.bottleneck}。`);
  if (state.pending.length) lines.push("等用户定的事：", ...state.pending.map((item) => `- ${item.text}`));
  return lines.join("\n");
}

/** Status line text: main metric, this round's aim and due date. */
export function renderRoundStatusSummary(state, options = {}) {
  const parts = [];
  const round = state.currentRound;
  if (round) parts.push(`第${round.number}轮`);
  const brief = round?.brief;
  if (brief?.targetDimension || brief?.target) parts.push(`对准 ${brief.targetDimension ?? plainLine(brief.target, 16)}`);
  if (brief?.due && !round.result) parts.push(`${brief.due.slice(5)} 见分晓`);
  if (round?.result?.verdict) parts.push(`判定 ${VERDICT_LABELS[round.result.verdictKind] ?? plainLine(round.result.verdict, 12)}`);
  if (state.overrun) parts.push("已超时");
  if (state.stall) parts.push("停滞");
  if (state.mainMetric) {
    // Short form: the metric's name without its protocol, the best value and its round.
    const name = (state.mainMetric.name ?? state.mainMetric.text).replace(/（[^）]*）|\([^)]*\)/gu, "").trim();
    const value = state.mainMetric.best?.split(/[（(]/u)[0].trim();
    const where = state.mainMetric.best?.match(/第\s*\d+\s*轮/u)?.[0];
    parts.push(`主指标 ${plainLine([name, value].filter(Boolean).join(" "), options.metricLimit ?? 40)}${where ? `（${where.replace(/\s+/gu, "")}）` : ""}`);
  }
  return parts.join(" · ");
}

export { localDate as roundStateLocalDate };
