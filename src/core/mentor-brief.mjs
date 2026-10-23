import fs from "node:fs";
import path from "node:path";

import { parsePaperImpactLine } from "./dashboard-data.mjs";
import { latestLongTermIntent, longTermIntentDue } from "./mentor-intent.mjs";
import { USER_ORIGINALS_PATH } from "./user-originals.mjs";

const RESEARCH = ".dove/research";
const ROUND_FILE = /^(\d+)[-_](brief|result)\.md$/iu;
const IMPACT_FILE = /^impact-\d{4}-\d{2}-\d{2}\.md$/u;
const DIGEST_FILE = /^\d{4}-\d{2}-\d{2}\.json$/u;
const SCAN_FILE = /^scan-\d{4}-\d{2}-\d{2}\.md$/u;

// Shared questions for the mentor's independent research judgment.
const QUESTIONS = [
  "如果用户现在问‘这段时间取得了什么实质科研进展’，诚实的一句话回答是什么？",
  "最近的工作是在检验核心方法，还是在修工程、修评价、搭系统？",
  "按现在的做法，离用户要的最终结果还差什么、大概多久能到？有没有更直接、更快的路？",
  "对照 brief 的“方法设计”：问题及真实数据证据和要达到的程度、外部方法（含本领域高手的默认做法）的具体机制为何不足、改法的预测与成败标准，结果还支持这三段吗？",
  "对照 USER_ORIGINALS.md 中用户过去的纠正，当前做法有没有重犯？",
  "方向还服务用户的核心目标吗？相对最接近的工作新在哪里、离目标档次差什么，下一步最值得检验什么（至少考虑一个不是从当前做法改出来的方案）？"
];

function list(directory, fsOps) {
  try {
    return fsOps.readdirSync(directory);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return [];
    throw error;
  }
}

function describe(root, relative, fsOps) {
  try {
    return `\`${relative}\`${fsOps.statSync(path.join(root, relative)).isFile() ? "" : "（不是文件）"}`;
  } catch (error) {
    return `\`${relative}\`（${error.code === "ENOENT" ? "缺失" : `无法读取：${error.code ?? error.message}`}）`;
  }
}

// Read an explicit file window, without following links in the record.
function readWindow(file, fsOps, maxBytes = 16384, tail = false) {
  let fd;
  try {
    const stat = fsOps.statSync(file);
    if (!stat.isFile()) return { error: "不是文件" };
    fd = fsOps.openSync(file, "r");
    const bytes = Buffer.alloc(Math.min(stat.size, maxBytes));
    const position = tail ? Math.max(0, stat.size - bytes.length) : 0;
    const count = fsOps.readSync(fd, bytes, 0, bytes.length, position);
    let start = 0;
    while (start < count && (bytes[start] & 0xc0) === 0x80) start += 1;
    const truncated = stat.size > count;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(start, count), { stream: truncated && !tail });
    return { text, truncated, startByte: position + start, endByte: position + count, fileBytes: stat.size };
  } catch (error) {
    return { error: error.code === "ENOENT" ? "缺失" : `无法读取：${error.code ?? error.message}` };
  } finally {
    if (fd !== undefined) fsOps.closeSync(fd);
  }
}

function clip(text, limit) {
  const characters = Array.from(String(text));
  return characters.length <= limit ? characters.join("") : `${characters.slice(0, limit).join("")}…`;
}

function quote(text) {
  return String(text).split("\n").map((line) => `> ${line}`).join("\n");
}

function sourceAttachment(root, suppliedPath, fsOps) {
  const file = path.resolve(root, suppliedPath);
  const result = readWindow(file, fsOps, 8192, true);
  const source = `- 来源：\`${file}\``;
  if (result.error) return `${source}（${result.error}；未附正文）`;
  if (result.text.includes("\0")) return `${source}（二进制内容，未展开）`;
  const range = result.truncated
    ? `末尾片段，读取字节 ${result.startByte + 1}–${result.endByte} / ${result.fileBytes}；起首可能是残行，不代表全文`
    : `全文，${result.fileBytes} 字节`;
  return `${source}（${range}）\n${result.text ? quote(result.text) : "文件为空。"}`;
}

function recentRounds(names) {
  const sorted = names.filter((name) => ROUND_FILE.test(name)).sort((left, right) =>
    Number(right.match(ROUND_FILE)[1]) - Number(left.match(ROUND_FILE)[1]) || left.localeCompare(right));
  const counts = { brief: 0, result: 0 };
  return sorted.filter((name) => ++counts[name.match(ROUND_FILE)[2].toLowerCase()] <= 2);
}

function watchMaterials(root, rounds, fsOps) {
  const relative = `${RESEARCH}/watch`;
  const directory = path.join(root, relative);
  const names = list(directory, fsOps).sort().reverse();
  const config = `${relative}/config.json`;
  const lines = [`- 配置：${describe(root, config, fsOps)}`];
  const configText = readWindow(path.join(root, config), fsOps, 8192);
  if (!configText.error) lines.push(quote(clip(configText.text.trim(), 1600)), "配置仅摘录，全文见路径。");
  let source = null;
  if (!configText.error && !configText.truncated) {
    try { source = JSON.parse(configText.text)?.source; } catch { /* Keep unreadable configuration distinct from an adopted suggestion. */ }
  }
  lines.push(source === "mentor" || source === "user"
    ? `- 配置来源：${source}（已保存）。本次仍核对是否服务主线。`
    : `- 追踪配置待导师修正（${configText.error ?? (configText.truncated ? "读取不完整" : source === "draft" ? "draft 初稿" : "来源未确认或 JSON 无法解析")}）：返回实际建议字段 JSON；主会话用 dove watch configure --project <root> --mentor <建议.json> 合并保存并核对回执，不只修改来源标签。`);

  // Only extract explicit saved labels, never infer a paper's scientific impact.
  // Historical brief labels remain usable; oversized records are not silently
  // treated as fully searched when identifying the remaining candidates.
  const judged = new Set();
  let incomplete = false;
  const impacts = names.filter((name) => IMPACT_FILE.test(name));
  const records = [
    ...rounds.filter((name) => ROUND_FILE.test(name) && /brief\.md$/iu.test(name)).sort((left, right) => parseInt(left) - parseInt(right)).map((name) => path.join(root, RESEARCH, "rounds", name)),
    ...[...impacts].reverse().map((name) => path.join(directory, name))
  ];
  for (const file of records) {
    const record = readWindow(file, fsOps, 65536, true);
    incomplete ||= Boolean(record.error || record.truncated);
    if (record.error) continue;
    // A bounded tail can start inside a row; do not consume that fragment as a
    // complete newer judgment. Keep the existing incomplete-history notice.
    const lines = record.text.split(/\r?\n/u);
    if (record.startByte) lines.shift();
    for (const line of lines) {
      const parsed = parsePaperImpactLine(line);
      if (!parsed) continue;
      if (parsed.impact) judged.add(parsed.id);
      else judged.delete(parsed.id);
    }
  }
  if (impacts.length) lines.push(`- 影响记录：\`${relative}/\`（含历史 brief 判断）`);
  for (const name of impacts.slice(0, 3)) lines.push(`- 最近影响：${describe(root, `${relative}/${name}`, fsOps)}`);
  if (incomplete) lines.push("判断记录有缺失或超过每文件末尾 64 KiB 的读取范围；以下仅表示在已读片段中未找到判断，请核对历史，不重复判断已评论文。");

  const digests = names.filter((name) => DIGEST_FILE.test(name));
  const pending = new Map();
  for (const name of digests.slice(0, 3)) {
    const file = path.join(directory, name);
    lines.push(`- 近期清单：${describe(root, `${relative}/${name}`, fsOps)}`);
    const result = readWindow(file, fsOps, 262144);
    if (result.error || result.truncated) {
      lines.push(`  ${result.error ?? "超过 256 KiB，未展开"}；请按路径核对未判断项。`);
      continue;
    }
    let digest;
    try {
      digest = JSON.parse(result.text);
    } catch {
      lines.push("  JSON 无法解析，未判断项未知。");
      continue;
    }
    if (!Array.isArray(digest?.items)) {
      lines.push("  缺少论文清单，未判断项未知。");
      continue;
    }
    lines.push(`  检索状态：${digest.status ?? "未记录"}；失败或部分完成不代表没有新论文。`);
    for (const item of digest.items) {
      if (!item?.id) continue;
      const id = String(item.id).replace(/v\d+$/u, "");
      if (!judged.has(id) && !pending.has(id)) pending.set(id, { item, file });
    }
  }
  lines.push("", `### ${incomplete ? "未找到判断的近期摘要（待核对历史）" : "未判断的近期摘要"}`,
    digests.length ? `从最近 ${Math.min(3, digests.length)} / ${digests.length} 份清单找到 ${pending.size} 项，最多展开 8 项；其余见 \`${relative}/\`，不代表全部历史。` : "未找到追踪清单。");
  for (const [id, { item, file }] of [...pending].slice(0, 8)) {
    lines.push("", quote(`${id} · ${clip(item.title ?? "未提供标题", 200)}\n原始发表日期：${item.published || "未记录"}\n来源：${file}\n${item.line ? "已有一句话" : "原摘要"}（不代表全文已读）：${clip(item.line || item.abstract || "未提供摘要", 400)}`));
  }
  const scan = names.find((name) => SCAN_FILE.test(name));
  lines.push("", scan ? `- 最近扫描（${scan.slice(5, 15)}）：${describe(root, `${relative}/${scan}`, fsOps)}` : "- 最近扫描：未找到。");
  return lines.join("\n");
}

function opinionAttachment(root, opinion, fsOps) {
  if (!opinion) return "未附意见文件。";
  const file = path.resolve(root, opinion);
  const result = readWindow(file, fsOps, 4096);
  if (result.error) throw new Error(`意见文件${result.error}：${file}`);
  const length = Array.from(result.text).length;
  const author = result.text.match(/^\s*(?:[-*]\s*)?(?:\*\*)?(?:Author|作者)(?:\*\*)?\s*[:：][ \t]*(\S[^\r\n]*)$/imu)?.[1];
  // Report authorship and length; a long or unsigned opinion is still the executor's material.
  return `- 意见文件：\`${file}\`\n${quote(`作者：${author ?? "未署名（按执行者意见看待）"}\n篇幅：${result.truncated ? "超过 4 KiB，导师按路径读全文" : `约 ${length} 字（建议 1000 字内）`}`)}`;
}

/**
 * Render a read-only mentor handoff; no model invocation or research writes.
 * Options: trigger, userSource, since, until, userOriginal, userOriginals,
 * opinion (one path), artifact (path array), fsOps (synchronous filesystem injection).
 * Only the saved originals index and explicit artifacts get bounded excerpts;
 * private sessions and paths mentioned inside records are never opened here.
 */
export function renderMentorBrief(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const project = path.resolve(root);
  const research = path.join(project, RESEARCH);
  const rounds = list(path.join(research, "rounds"), fsOps);
  const selected = recentRounds(rounds);
  const notes = readWindow(path.join(research, "MENTOR_NOTES.md"), fsOps, Infinity);
  const intent = notes.error ? null : latestLongTermIntent(notes.text);
  const intentStatus = notes.error ? `导师笔记${notes.error}` : !intent ? "笔记中没有长期意图一节" : !intent.date ? "长期意图没有有效日期" : `最近一次为 ${intent.date}`;
  const originals = options.userOriginals?.path ?? USER_ORIGINALS_PATH;
  const lines = [
    "# Dove 导师调用材料", "", `项目：\`${project}\`（材料路径相对此目录）`,
    "本材料原样作为调用正文。先看用户原话和原始结果，再独立判断；宿主简报只是目录和观点。", "",
    "## 用户原话与来源", "",
    quote(`来源：${options.userSource || "未提供"}\n日期范围：${options.since || "未提供起点"} — ${options.until || "未提供终点"}`), "",
    options.userOriginal ? `当前直接提供的原话（原样附入）：\n${quote(options.userOriginal)}` : "未直接附原话。",
    "日期范围仅按输入展示；生成器不读取私有 session，导师需按来源核对本人正文。", "",
    "### 过去的纠正与长期意图", "",
    "USER_ORIGINALS.md 是索引性摘录：压缩空白、每条最多 700 字，转述单列，不是完整原话；判断过去的纠正需回原始来源核对上下文。",
    ...(options.userOriginals
      ? [`- 整理范围：本人 ${options.userOriginals.own} 条、转述 ${options.userOriginals.relay} 条，${options.userOriginals.directories.length} 个会话目录${options.userOriginals.pendingBytes ? "（尚未整理完，当前可能缺时段）" : ""}。`, `- 原会话目录（仅供导师按来源定位）：${options.userOriginals.directories.map((directory) => `\`${directory}\``).join("、") || "未找到"}。`]
      : []),
    sourceAttachment(project, originals, fsOps),
    ...(options.userOriginalsError ? [`- 汇总整理失败：${options.userOriginalsError}。已有摘录可能不完整，缺失不等于用户没说过。`] : []),
    longTermIntentDue(intent, options.now) ? `- 长期意图对照到期（${intentStatus}）：读 USER_ORIGINALS.md 并核对本人来源，返回带日期的“长期意图”。` : `- 长期意图对照：${intentStatus}，尚未到期。`, "",
    "## 原始结果文件与数字", "",
    "只展开显式提供的前 4 个文件，每个最多末尾 8 KiB；不递归找数据，不追读文件中的路径。未附原始结果就直说证据不足，宿主声称已读或已测不算证据。",
    ...(options.artifact?.length
      ? options.artifact.map((file, index) => index < 4 ? sourceAttachment(project, file, fsOps) : `- \`${path.resolve(project, file)}\`（超出本次展开数量，仅列路径）`)
      : ["未提供原始结果文件或数字。"]), "",
    "## 宿主记录与目录（不是结论框架）", "",
    "### 本次触发", "", quote(options.trigger || "未填写"),
    "只写一句；同轮再调用注明用户纠正、换路线等触发。", "",
    ...[".dove/install/RESEARCH_QUALITY.md", `${RESEARCH}/IDENTITY.md`, `${RESEARCH}/MENTOR_NOTES.md`, `${RESEARCH}/EVAL.md`]
      .map((file) => `- ${describe(project, file, fsOps)}`), "",
    "EVAL、brief/result 和执行者意见用于定位材料、提出观点，不能代替原始结果；仅列路径不代表导师已读。",
    "方法三段见身份卡 Method design 指向的 brief 的“## 方法设计”（三个 ### 小节），不从身份卡研究状态推定论证成立。", "",
    "### 最近 brief/result", "",
    ...(selected.length ? selected.map((name) => `- ${describe(project, `${RESEARCH}/rounds/${name}`, fsOps)}`) : ["未找到轮次文件。"]), "",
    opinionAttachment(project, options.opinion, fsOps), "",
    "### 选题阶段适用的标准", "",
    `- ${describe(project, ".dove/install/TOPIC_CRITERIA.md", fsOps)}（Dove 的选题标准）`,
    `- ${describe(project, `${RESEARCH}/topics/PROJECT.md`, fsOps)}（本项目的选题设置）`, "",
    "## 论文追踪", "", watchMaterials(project, rounds, fsOps), "",
    "## 固定问题（先答前三问）", "",
    ...QUESTIONS.map((question, index) => `${index + 1}. ${question}`)
  ];
  return `${lines.join("\n")}\n`;
}
