import fs from "node:fs";
import path from "node:path";

const RESEARCH = ".dove/research";
const ROUND_FILE = /^(\d+)[-_](brief|result)\.md$/iu;
const IMPACT_FILE = /^impact-\d{4}-\d{2}-\d{2}\.md$/u;
const DIGEST_FILE = /^\d{4}-\d{2}-\d{2}\.json$/u;
const SCAN_FILE = /^scan-\d{4}-\d{2}-\d{2}\.md$/u;

// Moved verbatim from the canonical mentor definition's four questions.
const QUESTIONS = [
  "相对用户原话，方向对不对？",
  "这几轮是在建立通用能力，还是反复打补丁？",
  "离用户目标和目标档次还差什么？",
  "下一轮该做什么，为什么？"
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

// Read a bounded window, not a complete old EVAL or execution transcript.
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
    const text = new TextDecoder().decode(bytes.subarray(start, count), { stream: truncated && !tail });
    return { text, truncated, partialFirstLine: position > 0 };
  } catch (error) {
    return { error: error.code === "ENOENT" ? "缺失" : `无法读取：${error.code ?? error.message}` };
  } finally {
    if (fd !== undefined) fsOps.closeSync(fd);
  }
}

function clip(text, limit, tail = false) {
  const characters = Array.from(String(text));
  return characters.length <= limit ? characters.join("") : tail
    ? `…${characters.slice(-limit).join("")}`
    : `${characters.slice(0, limit).join("")}…`;
}

function quote(text) {
  return String(text).split("\n").map((line) => `> ${line}`).join("\n");
}

function evaluationExcerpt(file, fsOps) {
  const result = readWindow(file, fsOps, 16384, true);
  if (result.error) return result.error;
  const lines = result.text.split(/\r?\n/u);
  if (result.partialFirstLine) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  return clip(lines.slice(-12).join("\n"), 2400, true) || "没有可摘录的近期完整行；按路径读取。";
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

  // Only extract explicit saved labels, never infer a paper's scientific impact.
  // Historical brief labels remain usable; oversized records are not silently
  // treated as fully searched when identifying the remaining candidates.
  const judged = new Set();
  let incomplete = false;
  const impacts = names.filter((name) => IMPACT_FILE.test(name));
  const records = [
    ...rounds.filter((name) => ROUND_FILE.test(name) && /brief\.md$/iu.test(name)).map((name) => path.join(root, RESEARCH, "rounds", name)),
    ...impacts.map((name) => path.join(directory, name))
  ];
  for (const file of records) {
    const record = readWindow(file, fsOps, 65536, true);
    incomplete ||= Boolean(record.error || record.truncated);
    if (record.error) continue;
    for (const match of record.text.matchAll(/^\s*(?:[-*]\s*)?\|?\s*`?(\d{4}\.\d{4,5}|[a-z][a-z.-]*\/\d{7}|W\d+)(?:v\d+)?`?\s*\|\s*(撞题|新基线|可借用|无关)\s*\|/gmu)) {
      judged.add(match[1]);
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
  if (result.truncated || length > 1000) throw new Error(`意见文件须不超过 1000 字（含署名）：${file}`);
  const author = result.text.match(/^\s*(?:[-*]\s*)?(?:\*\*)?(?:Author|作者)(?:\*\*)?\s*[:：][ \t]*(\S[^\r\n]*)$/imu)?.[1];
  if (!author) throw new Error(`意见文件须标明作者（Author: 或 作者：）：${file}`);
  return `- 意见文件：\`${file}\`\n${quote(`作者：${author}\n篇幅：${length} / 1000 字（含署名）`)}`;
}

/**
 * Render a read-only mentor handoff; no model invocation or research writes.
 * Options: trigger, userSource, since, until, userOriginal, opinion (one path),
 * artifact (path array), fsOps (synchronous filesystem injection for tests).
 * User-source paths and artifact contents are never opened by this renderer.
 */
export function renderMentorBrief(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const project = path.resolve(root);
  const research = path.join(project, RESEARCH);
  const rounds = list(path.join(research, "rounds"), fsOps);
  const selected = recentRounds(rounds);
  const evaluation = path.join(research, "EVAL.md");
  const lines = [
    "# Dove 导师调用材料", "", `项目：\`${project}\`（材料路径相对此目录）`,
    "本材料原样作为导师调用的全部正文，只在“本次触发”写一句；执行者看法放意见文件，不另列禁令。", "",
    "## 本次触发", "", quote(options.trigger || "未填写"),
    "同轮再调用时，在此注明对应触发（用户纠正、换路线等）。", "",
    "## 用户原话与来源", "",
    quote(`来源：${options.userSource || "未提供"}\n日期范围：${options.since || "未提供起点"} — ${options.until || "未提供终点"}`), "",
    options.userOriginal ? quote(options.userOriginal) : "未直接附原话。",
    "由导师读取指定来源；生成器不读取私有 session。", "",
    "## 项目材料", "",
    ...[".dove/install/RESEARCH_QUALITY.md", `${RESEARCH}/IDENTITY.md`, `${RESEARCH}/MENTOR_NOTES.md`, `${RESEARCH}/EVAL.md`]
      .map((file) => `- ${describe(project, file, fsOps)}`), "",
    "EVAL 近期摘录（末尾 16 KiB 内至多 12 行、2400 字）：", "",
    quote(evaluationExcerpt(evaluation, fsOps)), "",
    "### 最近 brief/result", "",
    ...(selected.length ? selected.map((name) => `- ${describe(project, `${RESEARCH}/rounds/${name}`, fsOps)}`) : ["未找到轮次文件。"]), "",
    "### 选题阶段适用的标准", "",
    ...["CRITERIA.md", "PROJECT.md"].map((name) => `- ${describe(project, `${RESEARCH}/topics/${name}`, fsOps)}`), "",
    "## 论文追踪", "", watchMaterials(project, rounds, fsOps), "",
    "## 执行者附属材料", "",
    opinionAttachment(project, options.opinion, fsOps), "",
    "新增原始产物（只列路径）：",
    ...(options.artifact?.length ? options.artifact.map((file) => `- \`${path.resolve(project, file)}\``) : ["未提供。"]), "",
    "## 固定四问", "",
    ...QUESTIONS.map((question, index) => `${index + 1}. ${question}`)
  ];
  return `${lines.join("\n")}\n`;
}
