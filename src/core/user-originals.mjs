import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The user's own words, gathered from every Claude Code session of a project so
// a fresh mentor reads the long-term intent instead of relays, summaries or
// tool output. Derived and rebuilt on demand; research records stay untouched.
export const USER_ORIGINALS_PATH = ".dove/install/USER_ORIGINALS.md";
export const USER_ORIGINALS_INDEX_PATH = ".dove/install/user-originals-index.json";

const SKIP = /^(?:<|\[Image|\[Your previous response|\[Request interrupted|This session is being continued|Base directory for this skill|# dove\.|Another Claude session sent|Caveat:|Continue the conversation from where)/u;
// Messages typed into the host on the user's behalf by a supervising session or a document.
const RELAY = /^(?:主会话 ?Claude|Claude[:：，,]|用户已同意|【用户已同意|告知[:：]|更正上一条|转达|用户 ?\d{4}-\d{2}-\d{2} ?决定|用户原话（|请先完整阅读)/u;
const SHORT = 6;
const LIMIT = 700;
const CHUNK = 1 << 20;

const encode = (value) => value.replace(/[^A-Za-z0-9]/gu, "-");

// Claude Code keeps one directory per working path; a moved or renamed project
// (for example a legacy- prefix) keeps the project name at the end.
export function sessionDirectories(project, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const base = path.join(options.home ?? os.homedir(), ".claude/projects");
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

// Read complete lines appended after `start`; a trailing partial line waits for the next refresh.
function readNewLines(file, start, fsOps) {
  const fd = fsOps.openSync(file, "r");
  const lines = [];
  let position = start;
  let carry = Buffer.alloc(0);
  try {
    const chunk = Buffer.alloc(CHUNK);
    for (;;) {
      const count = fsOps.readSync(fd, chunk, 0, CHUNK, position);
      if (!count) break;
      position += count;
      const combined = Buffer.concat([carry, chunk.subarray(0, count)]);
      const end = combined.lastIndexOf(10);
      if (end === -1) {
        carry = combined;
        continue;
      }
      lines.push(...combined.subarray(0, end).toString("utf8").split("\n"));
      carry = combined.subarray(end + 1);
    }
  } finally {
    fsOps.closeSync(fd);
  }
  return { lines, offset: position - carry.length };
}

function extract(lines, session) {
  const entries = [];
  let short = 0;
  for (const line of lines) {
    if (!line.includes('"user"')) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    for (const text of messageTexts(record)) {
      const kind = classifyUserText(text);
      if (!kind) continue;
      const flat = text.replace(/\s+/gu, " ").trim();
      if (Array.from(flat).length <= SHORT) {
        short += 1;
        continue;
      }
      const characters = Array.from(flat);
      entries.push({ time: String(record.timestamp ?? "").slice(0, 16), session, kind, text: characters.length > LIMIT ? `${characters.slice(0, LIMIT).join("")}…` : flat });
    }
  }
  return { entries, short };
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

function render(directories, entries, short) {
  const own = entries.filter((entry) => entry.kind === "own").length;
  const lines = [
    "# 用户本人原话汇总",
    "",
    "Dove 在生成导师调用材料时自动整理，来源是本项目全部 Claude Code 会话。已排除子任务对话、工具返回、上下文压缩摘要、技能说明、后台通知和系统注入；由监督会话或文档代为输入的内容标为“转述”，不当作用户原话。只有几个字的消息（如“继续”）只计数。",
    "",
    `会话目录：${directories.map((directory) => `\`${directory}\``).join("、") || "未找到"}`,
    `本人 ${own} 条，转述 ${entries.length - own} 条，短消息 ${short} 条。按时间排列。`,
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
      const { lines, offset } = readNewLines(file, resume.offset, fsOps);
      const found = extract(lines, name.slice(0, 8));
      files[file] = { offset, entries: [...resume.entries, ...found.entries], short: resume.short + found.short };
    }
  }
  const entries = Object.values(files).flatMap((item) => item.entries).sort((left, right) => left.time.localeCompare(right.time));
  const short = Object.values(files).reduce((sum, item) => sum + item.short, 0);
  writeAtomic(indexFile, `${JSON.stringify({ files })}\n`, fsOps);
  writeAtomic(path.join(root, USER_ORIGINALS_PATH), render(directories, entries, short), fsOps);
  return { path: USER_ORIGINALS_PATH, directories, own: entries.filter((entry) => entry.kind === "own").length, relay: entries.filter((entry) => entry.kind === "relay").length };
}
