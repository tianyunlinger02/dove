import fs from "node:fs";
import path from "node:path";

import { doveConfigDirectory } from "./paper-watch.mjs";

// Topic selection follows the user's own criteria document, kept at user
// level and copied into a project when a selection starts. Dove does not
// restate the criteria; it gives the rounds a place to live and reads the
// candidate cards' header lines for the dashboard.
const CRITERIA_NAME = "topic-criteria.md";
const TOPICS_DIR = ".dove/research/topics";
const CARD_FIELDS = Object.freeze({ 状态: "status", 阶段: "stage", 定位: "position", 一句话: "summary", 六点: "six" });

export function topicCriteriaPath(options = {}) {
  return path.join(doveConfigDirectory(options), CRITERIA_NAME);
}

function describe(text, stat) {
  return {
    title: text.split(/\r?\n/u).find((line) => /^#\s+\S/u.test(line))?.replace(/^#\s+/u, "").trim() ?? null,
    version: [...text.matchAll(/第\s*(\d+)\s*版/gu)].map((match) => Number(match[1])).sort((left, right) => right - left).map(String)[0] ?? null,
    bytes: Buffer.byteLength(text),
    updatedAt: stat ? new Date(stat.mtimeMs).toISOString() : null
  };
}

export function readTopicCriteriaInfo(options = {}) {
  const file = topicCriteriaPath(options);
  try {
    return { present: true, ...describe(fs.readFileSync(file, "utf8"), fs.statSync(file)) };
  } catch {
    return { present: false };
  }
}

export function writeTopicCriteria(text, options = {}) {
  const value = String(text ?? "");
  if (value.trim().length < 200) throw new Error("选题标准内容太短，像是没粘贴完整");
  const file = topicCriteriaPath(options);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, value, { mode: 0o600 });
  fs.renameSync(temporary, file);
  return readTopicCriteriaInfo(options);
}

const README = `# 选题

本目录记录一次选题。依据是 CRITERIA.md（开始时从用户的选题标准复制，之后标准更新时可重新复制）。

- 按 CRITERIA.md 的固定顺序和硬规则推进；每一阶段是一轮，说明和结果照常写在 ../rounds/，作者标明。
- 先发散出有宽度的候选，再做反向审查；近邻审计用真实的论文与网页检索，写出出处。
- 每个候选方向一张卡：cards/NN-名称.md，按 CRITERIA.md 的方向卡模板写。卡片开头固定五行，面板据此显示：
  - 状态：候选 / 维持 / 限定 / 暂缓 / 撤回 / 推荐 / 选定
  - 阶段：一 / 二 / 三 / 四
  - 定位：稳健 / 平衡 / 探索
  - 一句话：读者能记住的主贡献
  - 六点：问题 满足｜方法 待核实｜贡献 …（六项各写 满足 / 待核实 / 不满足）
- 选定方向由用户确认后，成为项目立项的依据（身份卡与评测表）。
`;

export function startTopicSelection(root, options = {}) {
  const source = topicCriteriaPath(options);
  if (!fs.existsSync(source)) throw new Error("还没有选题标准：先在面板设置页粘贴，或放到 " + source);
  const directory = path.join(root, TOPICS_DIR);
  fs.mkdirSync(path.join(directory, "cards"), { recursive: true });
  fs.copyFileSync(source, path.join(directory, "CRITERIA.md"));
  if (!fs.existsSync(path.join(directory, "README.md"))) fs.writeFileSync(path.join(directory, "README.md"), README);
  return readTopics(root);
}

export function parseCardHeader(text = "") {
  const card = {};
  for (const line of text.split(/\r?\n/u).slice(0, 40)) {
    const match = line.match(/^\s*(?:[-*]\s*)?\**\s*(状态|阶段|定位|一句话|六点)\s*\**\s*[:：]\s*(.+)$/u);
    if (match && !(CARD_FIELDS[match[1]] in card)) card[CARD_FIELDS[match[1]]] = match[2].trim();
  }
  const title = text.split(/\r?\n/u).find((line) => /^#\s+\S/u.test(line));
  if (title) card.title = title.replace(/^#\s+/u, "").trim();
  if (card.six) {
    card.sixParts = card.six.split(/[｜|;；,，]/u).map((part) => part.trim()).filter(Boolean)
      .map((part) => ({ text: part, state: /不满足/u.test(part) ? "no" : /待核实|待定/u.test(part) ? "pending" : /满足/u.test(part) ? "yes" : "unknown" }));
  }
  return card;
}

export function readTopics(root) {
  const directory = path.join(root, TOPICS_DIR);
  if (!fs.existsSync(directory)) return { started: false };
  let criteria = null;
  try {
    const file = path.join(directory, "CRITERIA.md");
    criteria = describe(fs.readFileSync(file, "utf8"), fs.statSync(file));
  } catch { /* missing */ }
  const cards = [];
  try {
    for (const name of fs.readdirSync(path.join(directory, "cards")).filter((item) => item.endsWith(".md")).sort()) {
      const file = path.join(directory, "cards", name);
      const text = fs.readFileSync(file, "utf8").slice(0, 64 * 1024);
      cards.push({ file: `topics/cards/${name}`, name: name.replace(/\.md$/u, ""), mtime: fs.statSync(file).mtimeMs, ...parseCardHeader(text) });
    }
  } catch { /* no cards yet */ }
  const documents = fs.readdirSync(directory).filter((name) => name.endsWith(".md") && name !== "CRITERIA.md").sort().map((name) => `topics/${name}`);
  return { started: true, criteria, cards, documents };
}
