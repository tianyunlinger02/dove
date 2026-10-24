import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The user's own words, gathered from every Claude Code session of a project so
// a fresh mentor reads the long-term intent instead of relays, summaries or
// tool output. Derived on mentor calls and daily prewarming; research records stay untouched.
export const USER_ORIGINALS_PATH = ".dove/install/USER_ORIGINALS.md";
export const USER_ORIGINALS_INDEX_PATH = ".dove/install/user-originals-index.json";
// How much the host does, and how it writes, from the same transcripts, in
// ten-minute buckets: subagent and mentor calls, context compactions, reply
// length, hedging, newly written gate words, and claims that something was
// verified or passed made in a turn that neither ran nor read anything; plus when
// each round's brief and result were first written, which is where one round
// ends and the next begins. Several rounds can share a day, so days are too
// coarse. Nothing here is shown to the host: it is statistics for the mentor
// and the dashboard.
export { ACTIVITY_FIELDS };
export const ACTIVITY_INDEX_PATH = ".dove/install/activity-index.json";
export const ACTIVITY_BUCKET_MS = 600000;
const ACTIVITY_SCHEMA = 2;
const HEDGES = ["但是", "不过", "可能", "尚未", "仍需", "不代表", "不等于", "不能宣称", "不保证", "证据边界", "有待", "暂不"];
// Bare "hash" and "frozen" are left out: in code they are ordinary (hash(), frozen dataclasses).
const GATES = /sha256|哈希|冻结|门禁|equivalence gate|只读清单/giu;
const ROUND_FILE = /(?:^|\/)\.dove\/research\/rounds\/(\d+)[-_](brief|result)\.md$/u;
// "实测" is left out: records ask for a "实测：" line, so the word itself is no claim.
const CLAIMS = /已验证|验证通过|测试通过|全部通过|已跑通|跑通了|已确认可用/gu;
const ACTIVITY_FIELDS = Object.freeze(["agents", "compactions", "mentor", "chars", "hedges", "gates", "claims", "unrun"]);

const SKIP = /^(?:<|\[Image|\[Your previous response|\[Request interrupted|This session is being continued|Base directory for this skill|# dove\.|Another Claude session sent|Caveat:|Continue the conversation from where|Stop hook feedback|【Dove 引用用户)/u;
// Messages typed into the host on the user's behalf by a supervising session or a document.
const RELAY = /^(?:主会话 ?Claude|Claude[:：，,]|用户已同意|【用户已同意|告知[:：]|更正上一条|转达|用户 ?\d{4}-\d{2}-\d{2} ?决定|用户原话（|请先完整阅读)/u;
const SHORT = 6;
const LIMIT = 700;
const CHUNK = 8 << 20;
// Earlier indexes did not verify each record's cwd; none of their contents are trusted.
const INDEX_SCHEMA = 1;
// Typed messages are small; larger lines are tool output or images and are skipped unread.
const MAX_LINE = 256 << 10;
// Each mentor call or daily prewarm gets this scan budget; the rest resumes next time.
export const USER_ORIGINALS_BUDGET_MS = 20000;

const encode = (value) => value.replace(/[^A-Za-z0-9]/gu, "-");

function sessionDirectory(root, options) {
  return path.join(options.home ?? options.env?.HOME ?? os.homedir(), ".claude/projects", encode(root));
}

// Only the complete encoded working path is a source; matching basenames are unrelated.
export function sessionDirectories(project, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const root = path.resolve(project);
  const directory = sessionDirectory(root, options);
  try {
    return fsOps.readdirSync(path.dirname(directory)).includes(encode(root)) ? [directory] : [];
  } catch {
    return [];
  }
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

function insideRoot(record, root) {
  if (typeof record?.cwd !== "string" || !path.isAbsolute(record.cwd)) return false;
  const relative = path.relative(root, record.cwd);
  return !(relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative));
}


function bump(found, bucket, field, amount = 1) {
  if (!amount) return;
  const counts = found.buckets[bucket] ?? (found.buckets[bucket] = {});
  counts[field] = (counts[field] ?? 0) + amount;
}

function mark(found, key, time) {
  if (!(found.marks[key] <= time)) found.marks[key] = time;
}

function occurrences(text, needle) {
  return text.split(needle).length - 1;
}

// `state.evidence` says whether the current turn has run or read anything yet;
// a new user message starts a new turn.
function collectActivity(line, root, found, state) {
  const compaction = line.includes('"compact_boundary"');
  const userText = line.includes('"type":"user"') && !line.includes('"tool_use_id"');
  const assistant = line.includes('"type":"assistant"');
  if (!compaction && !userText && !assistant) return;
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    return;
  }
  if (record?.isSidechain || !insideRoot(record, root)) return;
  const time = Date.parse(record.timestamp);
  if (!Number.isFinite(time)) return;
  const bucket = String(Math.floor(time / ACTIVITY_BUCKET_MS));
  if (record.type === "system" && record.subtype === "compact_boundary") {
    bump(found, bucket, "compactions");
    return;
  }
  if (record.type === "user") {
    if (!record.isMeta && !record.isCompactSummary && messageTexts(record).some((text) => text.trim())) state.evidence = false;
    return;
  }
  if (record.type !== "assistant" || !Array.isArray(record.message?.content)) return;
  for (const block of record.message.content) {
    if (block?.type === "tool_use") {
      const input = block.input ?? {};
      if (block.name === "Agent" || block.name === "Task") {
        bump(found, bucket, "agents");
        if (input.subagent_type === "dove-mentor") bump(found, bucket, "mentor");
      } else if (block.name === "Bash" || block.name === "Read") {
        state.evidence = true;
      } else if (block.name === "Write" || block.name === "Edit") {
        const target = String(input.file_path ?? "");
        const round = target.match(ROUND_FILE);
        if (round && block.name === "Write" && (!path.isAbsolute(target) || target.startsWith(`${root}${path.sep}`))) mark(found, `${round[2]}:${Number(round[1])}`, time);
        const written = `${input.content ?? ""}${input.new_string ?? ""}`.match(GATES)?.length ?? 0;
        const before = String(input.old_string ?? "").match(GATES)?.length ?? 0;
        bump(found, bucket, "gates", Math.max(0, written - before));
      }
    } else if (block?.type === "text" && typeof block.text === "string") {
      bump(found, bucket, "chars", Array.from(block.text).length);
      bump(found, bucket, "hedges", HEDGES.reduce((sum, word) => sum + occurrences(block.text, word), 0));
      const claims = block.text.match(CLAIMS)?.length ?? 0;
      bump(found, bucket, "claims", claims);
      if (!state.evidence) bump(found, bucket, "unrun", claims);
    }
  }
}

function mergeBuckets(target, source) {
  for (const [bucket, counts] of Object.entries(source ?? {})) {
    const into = target[bucket] ?? (target[bucket] = {});
    for (const field of ACTIVITY_FIELDS) if (counts[field]) into[field] = (into[field] ?? 0) + counts[field];
  }
  return target;
}

function mergeMarks(target, source) {
  for (const [key, time] of Object.entries(source ?? {})) if (!(target[key] <= time)) target[key] = time;
  return target;
}

function collect(line, session, root, found) {
  // Tool results are user-typed records too; they never hold the user's words.
  if (!line.includes('"user"') || line.includes('"tool_use_id"')) return;
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    return;
  }
  // Encoded paths can collide, and a session can change cwd between messages.
  if (!insideRoot(record, root)) return;
  for (const raw of messageTexts(record)) {
    // Words typed after a slash command arrive wrapped in command tags.
    const args = /^\s*<command-(?:message|name)>/u.test(raw) ? raw.match(/<command-args>([\s\S]*?)<\/command-args>/u)?.[1] : undefined;
    const text = args ?? raw;
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

function readIndex(file, root, fsOps) {
  try {
    const index = JSON.parse(fsOps.readFileSync(file, "utf8"));
    return index?.schema === INDEX_SCHEMA && index.root === root && index.files && typeof index.files === "object" ? index : { files: {} };
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
    "Dove 在生成导师调用材料时整理，常驻面板每天预热；整理本项目全部 Claude Code 会话。已排除子任务对话、工具返回、上下文压缩摘要、技能说明、后台通知和系统注入；由监督会话或文档代为输入的内容标为“转述”，不当作用户原话。只有几个字的消息（如“继续”）只计数。",
    "",
    `会话目录：${directories.map((directory) => `\`${directory}\``).join("、") || "未找到"}`,
    `本人 ${own} 条，转述 ${entries.length - own} 条，短消息 ${short} 条。按时间排列。`,
    ...(pending ? [`会话记录较大，还有约 ${Math.ceil(pending / (1 << 20))} MB 未整理，下次生成导师调用材料或每日预热时继续；目前的汇总可能缺少部分时段。`] : []),
    ""
  ];
  for (const entry of entries) lines.push(`- ${entry.time.replace("T", " ")} · ${entry.kind === "own" ? "本人" : "转述"} · ${entry.text}`);
  return `${lines.join("\n")}\n`;
}

function readActivityIndex(file, root, fsOps) {
  try {
    const index = JSON.parse(fsOps.readFileSync(file, "utf8"));
    return index?.schema === ACTIVITY_SCHEMA && index.root === root && index.files && typeof index.files === "object" ? index : { files: {} };
  } catch {
    return { files: {} };
  }
}

function transcriptsOf(directories, fsOps) {
  const transcripts = [];
  for (const directory of directories) {
    let names = [];
    try {
      names = fsOps.readdirSync(directory).filter((name) => name.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const name of names) {
      const file = path.join(directory, name);
      try {
        const stat = fsOps.statSync(file);
        transcripts.push({ file, name, size: stat.size, mtime: stat.mtimeMs ?? 0 });
      } catch {
        // Unreadable now; anything counted from it earlier is kept.
      }
    }
  }
  // Newest sessions first, so recent weeks are complete within the time budget.
  return transcripts.sort((left, right) => right.mtime - left.mtime);
}

/** Count subagent calls and compactions per day, resuming where the last scan stopped. */
export function refreshActivity(project, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const root = path.resolve(project);
  const indexFile = path.join(root, ACTIVITY_INDEX_PATH);
  const previous = readActivityIndex(indexFile, root, fsOps);
  const deadline = Date.now() + (options.budgetMs ?? USER_ORIGINALS_BUDGET_MS);
  const files = {};
  let pending = 0;
  for (const { file, size } of transcriptsOf(sessionDirectories(root, options), fsOps)) {
    const known = previous.files[file];
    const resume = known && known.offset <= size ? known : { offset: 0, buckets: {}, marks: {}, evidence: false };
    if (resume.offset === size || Date.now() >= deadline) {
      files[file] = resume;
      if (resume.offset < size) pending += size - resume.offset;
      continue;
    }
    const found = { buckets: {}, marks: {} };
    const state = { evidence: Boolean(resume.evidence) };
    const offset = scanNewLines(file, resume.offset, fsOps, (line) => collectActivity(line, root, found, state), deadline);
    files[file] = { offset, buckets: mergeBuckets(structuredClone(resume.buckets ?? {}), found.buckets), marks: mergeMarks({ ...resume.marks }, found.marks), evidence: state.evidence };
    if (offset < size) pending += size - offset;
  }
  for (const [file, item] of Object.entries(previous.files)) if (!(file in files)) files[file] = item;
  writeAtomic(indexFile, `${JSON.stringify({ schema: ACTIVITY_SCHEMA, root, files })}\n`, fsOps);
  return { pendingBytes: pending };
}

/**
 * Counts per ten-minute bucket (see ACTIVITY_FIELDS; keys are epoch time /
 * ACTIVITY_BUCKET_MS) and first-write times of round files ("brief:15",
 * "result:14"), gathered so far, without scanning.
 * With `pending: true`, also stats the transcripts to report bytes not yet counted.
 */
export function readActivity(project, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const root = path.resolve(project);
  const index = readActivityIndex(path.join(root, ACTIVITY_INDEX_PATH), root, fsOps);
  const buckets = {};
  const marks = {};
  for (const item of Object.values(index.files)) {
    mergeBuckets(buckets, item.buckets);
    mergeMarks(marks, item.marks);
  }
  const result = { buckets, marks, scanned: Object.keys(index.files).length > 0 };
  if (options.pending) {
    result.pendingBytes = transcriptsOf(sessionDirectories(root, options), fsOps)
      .reduce((sum, { file, size }) => sum + Math.max(0, size - (index.files[file]?.offset ?? 0)), 0);
  }
  return result;
}

export function refreshUserOriginals(project, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const root = path.resolve(project);
  const directories = sessionDirectories(root, options);
  const sourceDirectory = sessionDirectory(root, options);
  const indexFile = path.join(root, USER_ORIGINALS_INDEX_PATH);
  const previous = readIndex(indexFile, root, fsOps);
  const files = {};
  const deadline = Date.now() + (options.budgetMs ?? USER_ORIGINALS_BUDGET_MS);
  let pending = 0;
  const transcripts = transcriptsOf(directories, fsOps);
  {
    for (const { file, name, size } of transcripts) {
      const known = previous.files[file];
      const resume = known && known.offset <= size ? known : { offset: 0, entries: [], short: 0 };
      if (resume.offset === size) {
        files[file] = resume;
        continue;
      }
      const found = { entries: [], short: 0 };
      const offset = Date.now() < deadline ? scanNewLines(file, resume.offset, fsOps, (line) => collect(line, name.slice(0, 8), root, found), deadline) : resume.offset;
      files[file] = { offset, entries: [...resume.entries, ...found.entries], short: resume.short + found.short };
      if (offset < size) pending += size - offset;
    }
  }
  // Deleted sessions keep only words verified under this schema, root and source directory.
  for (const [file, item] of Object.entries(previous.files)) if (path.dirname(file) === sourceDirectory && !(file in files)) files[file] = item;
  const entries = Object.values(files).flatMap((item) => item.entries).sort((left, right) => left.time.localeCompare(right.time));
  const short = Object.values(files).reduce((sum, item) => sum + item.short, 0);
  writeAtomic(indexFile, `${JSON.stringify({ schema: INDEX_SCHEMA, root, files })}\n`, fsOps);
  writeAtomic(path.join(root, USER_ORIGINALS_PATH), render(directories, entries, short, pending), fsOps);
  let activity = { pendingBytes: null };
  try {
    activity = refreshActivity(root, { ...options, budgetMs: Math.max(0, deadline - Date.now()) });
  } catch {
    // Activity counts are a side view; the originals summary stands on its own.
  }
  return { path: USER_ORIGINALS_PATH, directories, own: entries.filter((entry) => entry.kind === "own").length, relay: entries.filter((entry) => entry.kind === "relay").length, pendingBytes: pending, activityPendingBytes: activity.pendingBytes };
}
