import fs from "node:fs";
import path from "node:path";

import { doveConfigDirectory } from "./paper-watch.mjs";

// Topic selection follows the user's own criteria document, kept at user
// level and copied into a project when a selection starts. Dove does not
// restate the criteria; it gives the rounds a place to live and reads the
// candidate cards' header lines for the dashboard.
const CRITERIA_NAME = "topic-criteria.md";
const TOPICS_DIR = ".dove/research/topics";
const CARD_FIELDS = Object.freeze({
  状态: "status",
  阶段: "stage",
  定位: "position",
  一句话: "summary",
  缺口: "gap",
  来源机制: "source",
  对应关系: "mapping",
  成立前提: "assumptions",
  近邻差别: "novelty",
  最大风险: "risk",
  改进自: "improves",
  评审结论: "verdict",
  修改焦点: "focus",
  最强反对: "objection",
  评审依据: "reviewEvidence"
});

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

先读项目标准，正式产物门槛不扣推荐；CRITERIA.md 复制用户标准、去掉外项目设置；PROJECT.md 记范围、资源、材料、原话日期/出处，当前原话优先。

- 并列生成再比较，按质量摘要列问题价值、强基线失败及数字来源、正文缺口、有来源思路与未知；不等方法闭合才推荐。
- 一轮交候选、实查近邻与最佳 2–3 个推荐，不足给 1 个。标准冲突或禁取证据时说明一次仍给方向，请用户选或调标准，不静态打磨。选择前不实现方法，只做标准允许诊断；确认后选题期限制结束，缺的独立资源授权合并问一次，再诊断、设计、实验、写开题。规模须能答问题，链路非机制证据。说明与结果写 ../rounds/ 并标作者。
- 每个候选一张 cards/NN-名称.md，按项目标准展开；缺口取证、跨领域检索和评审遵循 .dove/install/RESEARCH_QUALITY.md 的“选题与新意判断”。头部前 40 行逐行写以下栏目，面板读取摘要，详细依据放正文：
  - 状态：候选 / 维持 / 限定 / 暂缓 / 撤回 / 推荐 / 选定
  - 阶段：一 / 二 / 三 / 四
  - 定位：稳健 / 平衡 / 探索
  - 一句话：用大白话说清一个想法
  - 缺口：攻击的具体缺口及其重要性
  - 来源机制：来源论文编号、借用机制及它在原处为什么有效
  - 对应关系：移到本问题后，谁扮演谁
  - 成立前提：为什么可能有效，哪个关键条件必须成立
  - 近邻差别：最近的本领域论文编号及具体差别
  - 最大风险：最可能让想法或迁移失败的原因
  - 改进自：可选，原候选编号、弱点和本次改动
  - 评审结论：留下 / 修改 / 否掉（原因）
  - 修改焦点：仅修改时填写，选最弱的一项：新意 / 连贯 / 可行 / 清晰 / 对应关系 / 依据
  - 最强反对：一句话说清最大问题
  - 评审依据：论文编号及一两句理由，正文链接累积阅读笔记
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
    const match = line.match(/^\s*(?:[-*]\s*)?\**\s*([^:：*]+?)\s*\**\s*[:：]\s*\**\s*(.+)$/u);
    const field = match && Object.hasOwn(CARD_FIELDS, match[1]) ? CARD_FIELDS[match[1]] : null;
    if (field && !(field in card) && match[2].trim()) card[field] = match[2].trim();
  }
  const title = text.split(/\r?\n/u).find((line) => /^#\s+\S/u.test(line));
  if (title) card.title = title.replace(/^#\s+/u, "").trim();
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
