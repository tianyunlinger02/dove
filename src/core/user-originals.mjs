import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The user's own words, gathered from every Claude Code session of a project so
// a fresh mentor reads the long-term intent instead of relays, summaries or
// tool output. Derived on mentor calls and daily prewarming; research records stay untouched.
export const USER_ORIGINALS_PATH = ".dove/install/USER_ORIGINALS.md";
export const USER_ORIGINALS_INDEX_PATH = ".dove/install/user-originals-index.json";

const SKIP = /^(?:<|\[Image|\[Your previous response|\[Request interrupted|This session is being continued|Base directory for this skill|# dove\.|Another Claude session sent|Caveat:|Continue the conversation from where)/u;
// Messages typed into the host on the user's behalf by a supervising session or a document.
const RELAY = /^(?:主会话 ?Claude|Claude[:：，,]|用户已同意|【用户已同意|告知[:：]|更正上一条|转达|用户 ?\d{4}-\d{2}-\d{2} ?决定|用户原话（|请先完整阅读)/u;
const SHORT = 6;
const LIMIT = 700;
const CHUNK = 8 << 20;
// Typed messages are small; larger lines are tool output or images and are skipped unread.
const MAX_LINE = 256 << 10;
// Each mentor call or daily prewarm gets this scan budget; the rest resumes next time.
export const USER_ORIGINALS_BUDGET_MS = 20000;

const encode = (value) => value.replace(/[^A-Za-z0-9]/gu, "-");

// Claude Code keeps one directory per working path; a moved or renamed project
// (for example a legacy- prefix) keeps the project name at the end.
export function sessionDirectories(project, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const base = path.join(options.home ?? options.env?.HOME ?? os.homedir(), ".claude/projects");
  let names = [];
  try {
    names = fsOps.readdirSync(base);
  } catch {
    return [];
  }
  const root = path.resolve(project);
  const own = encode(root);
  const tail = `-${encode(path.basename(root))}`;
  return names.filter((name) => name === own || name.endsWith(tail)).sort().map((name) => path.join(base, name));
}

function messageTexts(record) {
  if (record?.type !== "user" || record.isSidechain || record.isMeta || record.isCompactSummary) return [];
  const content = record.message?.content;
  if (typeof content === "string") return [content];
  return Array.isArray(content) ? content.filter((block) => block?.type === "text").map((block) => block.text ?? "") : [];
}

export function classifyUserText(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || SKIP.test(trimmed)) return null;
  return RELAY.test(trimmed) ? "relay" : "own";
}

// Visit complete lines appended after `start` without holding the file in memory.
// Returns the offset after the last complete line visited.
function scanNewLines(file, start, fsOps, onLine, deadline) {
  const fd = fsOps.openSync(file, "r");
  let position = start;
  let consumed = start;
  let carry = [];
  let carried = 0;
  let skipping = false;
  try {
    const chunk = Buffer.alloc(CHUNK);
    while (Date.now() < deadline) {
      const count = fsOps.readSync(fd, chunk, 0, CHUNK, position);
      if (!count) break;
      const base = position;
      position += count;
      let from = 0;
      for (;;) {
        const newline = chunk.indexOf(10, from);
        if (newline === -1 || newline >= count) {
          if (!skipping) {
            carry.push(Buffer.from(chunk.subarray(from, count)));
            carried += count - from;
            if (carried > MAX_LINE) { carry = []; carried = 0; skipping = true; }
          }
          break;
        }
        if (!skipping && carried + newline - from <= MAX_LINE) {
          const line = carried ? Buffer.concat([...carry, chunk.subarray(from, newline)]) : chunk.subarray(from, newline);
          onLine(line.toString("utf8"));
        }
        carry = [];
        carried = 0;
        skipping = false;
        from = newline + 1;
        consumed = base + from;
      }
    }
  } finally {
    fsOps.closeSync(fd);
  }
  return consumed;
}

function collect(line, session, found) {
  // Tool results are user-typed records too; they never hold the user's words.
  if (!line.includes('"user"') || line.includes('"tool_use_id"')) return;
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    return;
  }
  for (const text of messageTexts(record)) {
    const kind = classifyUserText(text);
    if (!kind) continue;
    const characters = Array.from(text.replace(/\s+/gu, " ").trim());
    if (characters.length <= SHORT) {
      found.short += 1;
      continue;
    }
    found.entries.push({ time: String(record.timestamp ?? "").slice(0, 16), session, kind, text: characters.length > LIMIT ? `${characters.slice(0, LIMIT).join("")}…` : characters.join("") });
  }
}

function readIndex(file, fsOps) {
  try {
    const index = JSON.parse(fsOps.readFileSync(file, "utf8"));
    return index && typeof index.files === "object" ? index : { files: {} };
  } catch {
    return { files: {} };
  }
}

function writeAtomic(file, content, fsOps) {
  fsOps.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fsOps.writeFileSync(temporary, content);
  fsOps.renameSync(temporary, file);
}

function render(directories, entries, short, pending) {
  const own = entries.filter((entry) => entry.kind === "own").length;
  const lines = [
    "# 用户本人原话汇总",
    "",
    "Dove 在生成导师调用材料时整理，常驻面板每天预热；目前只整理本项目全部 Claude Code 会话，暂不包含 DSH 会话。已排除子任务对话、工具返回、上下文压缩摘要、技能说明、后台通知和系统注入；由监督会话或文档代为输入的内容标为“转述”，不当作用户原话。只有几个字的消息（如“继续”）只计数。",
    "",
    `会话目录：${directories.map((directory) => `\`${directory}\``).join("、") || "未找到"}`,
    `本人 ${own} 条，转述 ${entries.length - own} 条，短消息 ${short} 条。按时间排列。`,
    ...(pending ? [`会话记录较大，还有约 ${Math.ceil(pending / (1 << 20))} MB 未整理，下次生成导师调用材料或每日预热时继续；目前的汇总可能缺少部分时段。`] : []),
    ""
  ];
  for (const entry of entries) lines.push(`- ${entry.time.replace("T", " ")} · ${entry.kind === "own" ? "本人" : "转述"} · ${entry.text}`);
  return `${lines.join("\n")}\n`;
}

export function refreshUserOriginals(project, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const root = path.resolve(project);
  const directories = sessionDirectories(root, options);
  const indexFile = path.join(root, USER_ORIGINALS_INDEX_PATH);
  const previous = readIndex(indexFile, fsOps);
  const files = {};
  const deadline = Date.now() + (options.budgetMs ?? USER_ORIGINALS_BUDGET_MS);
  let pending = 0;
  for (const directory of directories) {
    let names = [];
    try {
      names = fsOps.readdirSync(directory).filter((name) => name.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const name of names) {
      const file = path.join(directory, name);
      let size;
      try {
        size = fsOps.statSync(file).size;
      } catch {
        continue;
      }
      const known = previous.files[file];
      const resume = known && known.offset <= size ? known : { offset: 0, entries: [], short: 0 };
      if (resume.offset === size) {
        files[file] = resume;
        continue;
      }
      const found = { entries: [], short: 0 };
      const offset = Date.now() < deadline ? scanNewLines(file, resume.offset, fsOps, (line) => collect(line, name.slice(0, 8), found), deadline) : resume.offset;
      files[file] = { offset, entries: [...resume.entries, ...found.entries], short: resume.short + found.short };
      if (offset < size) pending += size - offset;
    }
  }
  const entries = Object.values(files).flatMap((item) => item.entries).sort((left, right) => left.time.localeCompare(right.time));
  const short = Object.values(files).reduce((sum, item) => sum + item.short, 0);
  writeAtomic(indexFile, `${JSON.stringify({ files })}\n`, fsOps);
  writeAtomic(path.join(root, USER_ORIGINALS_PATH), render(directories, entries, short, pending), fsOps);
  return { path: USER_ORIGINALS_PATH, directories, own: entries.filter((entry) => entry.kind === "own").length, relay: entries.filter((entry) => entry.kind === "relay").length, pendingBytes: pending };
}
