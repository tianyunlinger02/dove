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

// A criteria document may carry one project's own settings (scope, resources,
// that project's explicit requests). They are not general criteria, so they
// stay out of the copy each project receives.
export function splitProjectSettings(text = "") {
  const lines = String(text).split(/\r?\n/u);
  const start = lines.findIndex((line) => /^##\s+.*项目设置/u.test(line));
  if (start < 0) return { general: String(text), removed: null };
  let end = lines.findIndex((line, index) => index > start && /^##\s+/u.test(line));
  if (end < 0) end = lines.length;
  return { general: [...lines.slice(0, start), ...lines.slice(end)].join("\n"), removed: lines[start].replace(/^##\s+/u, "").trim() };
}

function describe(text, stat) {
  return {
    title: text.split(/\r?\n/u).find((line) => /^#\s+\S/u.test(line))?.replace(/^#\s+/u, "").trim() ?? null,
    version: [...text.matchAll(/第\s*(\d+)\s*版/gu)].map((match) => Number(match[1])).sort((left, right) => right - left).map(String)[0] ?? null,
    bytes: Buffer.byteLength(text),
    projectSection: splitProjectSettings(text).removed,
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

本目录辅助整理已有选题标准；不运行整理命令也必须先读并遵循项目标准。CRITERIA.md 来自用户标准，复制时剥离其他项目设置；PROJECT.md 只记本项目范围、资源、材料及用户原话日期/出处。当前用户原话优先。

- 用户尚未确认主线就是选题阶段。先确定有意义的方向，再广泛生成并列候选，生成时不砍题；说明各自的机制、依据、关键未知和可区分的结果。
- 近邻审查用真实论文与网页检索，并用检索拓宽候选，不只扣分。比较后推荐 2–3 个交用户选定；选择前不实现方法，只做标准允许的诊断。选定后用能回答问题的规模设计和检验核心机制，接通链路不等于机制证据。说明与结果写 ../rounds/，标明作者。
- 每个候选方向一张卡：cards/NN-名称.md，按 CRITERIA.md 的方向卡模板写。卡片开头固定五行，面板据此显示：
  - 状态：候选 / 维持 / 限定 / 暂缓 / 撤回 / 推荐 / 选定
  - 阶段：一 / 二 / 三 / 四
  - 定位：稳健 / 平衡 / 探索
  - 一句话：问题或工作假设摘要
  - 六点：问题 满足｜方法 待核实｜贡献 …（六项各写 满足 / 待核实 / 不满足）
- 用户明确选择就直接记主线，不重复确认；领域、推荐或卡片记录不是选择。已有主线和用户固定方法按原意推进，不重选或降级；换路线明说原路线、新路线和原因。
`;

const PROJECT_TEMPLATE = `# 本项目的选题设置

只写本项目设置，注明用户原话日期/出处；当前原话优先，指定标准按本项目要求适用，其他项目设置不适用。明确的直接记，不重复确认；未知写“待用户确认”，暂定保留原意，不把记录当批准。

## 范围与兴趣

待用户确认

## 资源

待用户确认

## 项目材料

待用户确认

## 讨论方式与特别要求

待用户确认（已有只读/设计讨论、资源与宿主权限仍适用；不另设选题期实验审批）
`;

export function startTopicSelection(root, options = {}) {
  const source = topicCriteriaPath(options);
  if (!fs.existsSync(source)) throw new Error("还没有选题标准：先在面板设置页粘贴，或放到 " + source);
  const directory = path.join(root, TOPICS_DIR);
  fs.mkdirSync(path.join(directory, "cards"), { recursive: true });
  fs.writeFileSync(path.join(directory, "CRITERIA.md"), splitProjectSettings(fs.readFileSync(source, "utf8")).general);
  fs.writeFileSync(path.join(directory, "README.md"), README);
  if (!fs.existsSync(path.join(directory, "PROJECT.md"))) fs.writeFileSync(path.join(directory, "PROJECT.md"), PROJECT_TEMPLATE);
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
