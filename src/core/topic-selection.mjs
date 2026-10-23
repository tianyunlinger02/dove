import fs from "node:fs";
import path from "node:path";

import { DOVE_TOPIC_CRITERIA_REFERENCE_PATH, renderDoveTopicCriteriaReference } from "./dove-topic-criteria.mjs";

// Topic selection follows Dove's own standard (docs/TOPIC_CRITERIA.md),
// installed in every project as .dove/install/TOPIC_CRITERIA.md and updated
// with Dove. A project keeps only its own settings in topics/PROJECT.md.
// Dove gives the rounds a place to live and reads the candidate cards'
// header lines for the dashboard.
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

function describe(text, stat) {
  return {
    title: text.split(/\r?\n/u).find((line) => /^#\s+\S/u.test(line))?.replace(/^#\s+/u, "").trim() ?? null,
    version: [...text.matchAll(/第\s*(\d+)\s*版/gu)].map((match) => Number(match[1])).sort((left, right) => right - left).map(String)[0] ?? null,
    bytes: Buffer.byteLength(text),
    updatedAt: stat ? new Date(stat.mtimeMs).toISOString() : null
  };
}

export function readTopicCriteriaInfo() {
  return { present: true, source: "dove", ...describe(renderDoveTopicCriteriaReference()) };
}

// A project reads the copy Dove installed; before installation, the bundled one.
function projectCriteria(root) {
  const file = path.join(root, DOVE_TOPIC_CRITERIA_REFERENCE_PATH);
  try {
    return { ...describe(fs.readFileSync(file, "utf8"), fs.statSync(file)), path: DOVE_TOPIC_CRITERIA_REFERENCE_PATH };
  } catch {
    return readTopicCriteriaInfo();
  }
}

const README = `# 选题

本目录放这个项目的选题材料：PROJECT.md 记本项目的范围、资源、材料和用户原话出处，cards/ 里每个候选一张卡。

怎样找缺口、形成候选、评审和推荐，按 Dove 的选题标准 .dove/install/TOPIC_CRITERIA.md（随 Dove 更新，项目内不另存一份）和 .dove/install/RESEARCH_QUALITY.md 的“选题与新意判断”“从问题到方法”去做。用户明确选定的方向直接记成主线，不重复确认；领域、推荐或卡片记录本身不是选择。每轮的说明与结果写在 ../rounds/，标明作者。

每张卡命名为 cards/NN-名称.md，头部前 40 行逐行写下面这些栏目，面板读取它们做摘要，详细依据写在正文：

- 状态：候选 / 维持 / 限定 / 暂缓 / 撤回 / 推荐 / 选定
- 阶段：一 / 二 / 三 / 四
- 定位：稳健 / 平衡 / 探索
- 一句话：用大白话说清一个想法
- 缺口：攻击的具体缺口及其重要性
- 来源机制：想法从哪来——论文编号与借用的机制及它在原处为什么有效，或观察到的异常与被违反的性质
- 对应关系：移到本问题后，谁扮演谁
- 成立前提：为什么可能有效，哪个关键条件必须成立
- 近邻差别：最近的本领域论文编号及具体差别
- 最大风险：最可能让想法或迁移失败的原因
- 改进自：可选，原候选编号、弱点和本次改动
- 评审结论：留下 / 修改 / 否掉（原因）
- 修改焦点：仅修改时填写，说明决定性瓶颈、共因或关键未知及改进方案；可协调多处修改或替换候选路线，不限于单项修补
- 最强反对：一句话说清最大问题
- 评审依据：论文编号及支持判断的理由，正文链接累积阅读笔记
`;

const PROJECT_TEMPLATE = `# 本项目的选题设置

只写本项目设置，注明用户原话日期/出处；当前原话优先，指定标准按本项目要求适用，其他项目设置不适用。明确的直接记，不重复确认；用户固定的目标、方法和资源照原意保留；未知写“待用户确认”，暂定保留原意，不把记录当批准。

## 范围与兴趣

待用户确认

## 资源

待用户确认

## 项目材料

待用户确认

## 讨论方式与特别要求

待用户确认（已有只读/设计讨论、资源与宿主权限仍适用；不另设选题期实验审批）
`;

export function startTopicSelection(root) {
  const directory = path.join(root, TOPICS_DIR);
  fs.mkdirSync(path.join(directory, "cards"), { recursive: true });
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
  const criteria = projectCriteria(root);
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
