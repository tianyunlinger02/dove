import assert from "node:assert/strict";
import test from "node:test";

import { COMMAND_SURFACE_BY_ID } from "../src/core/command-manifest.mjs";
import { renderClaudeDoveMentorAgent, renderClaudeDoveReviewAgent } from "../src/core/dove-agent-definition.mjs";
import {
  DOVE_RESEARCH_ACTION_SPINE,
  DOVE_RESEARCH_CLARIFICATION,
  DOVE_RESEARCH_EVALUATION,
  DOVE_RESEARCH_ONE_AGENT,
  DOVE_RESEARCH_QUALITY_REFERENCE_PATHS,
  DOVE_RESEARCH_REFLECTION_CONTINUITY,
  DOVE_RESEARCH_ROUND_CYCLE,
  DOVE_RESEARCH_ROUND_RECORDS,
  renderDoveResearchQualityFullReference,
  renderDoveResearchQualityReference
} from "../src/core/dove-research-contract.mjs";

const mentor = renderClaudeDoveMentorAgent();
const quality = renderDoveResearchQualityReference();
const tools = (prompt) => prompt.match(/^tools: (.+)$/mu)?.[1].split(", ");

test("mentor amendments: fresh direction judgment reads genuine user materials, unlike paper review", () => {
  const review = renderClaudeDoveReviewAgent();
  assert.deepEqual(tools(mentor), ["Read", "Grep", "Glob", "mcp__exa", "mcp__dove-paper-search"]);
  assert.deepEqual(tools(review), ["Read", "Grep", "Glob"]);
  assert.match(mentor, /每轮.*新的.*不 resume.*同一轮.*两三个.*跨轮.*笔记/u);
  assert.match(mentor, /宿主原话源路径和日期范围.*真实用户正文/u);
  assert.match(mentor, /排除.*元消息.*子会话.*工具返回.*系统.*执行者总结/u);
  assert.match(mentor, /来源读不到.*未知.*不.*撤销用户承诺或宿主权限/u);
  assert.match(mentor, /不读作者私有偏好.*不执行.*不写文件/u);
  assert.match(review, /指定的当前完整稿件.*不读.*对话.*不联网.*不执行.*不改稿/u);
});

test("mentor amendments: triggered calls use the generated template and its fixed questions", () => {
  assert.match(DOVE_RESEARCH_ROUND_CYCLE, /each round end.*two consecutive rounds.*user corrects direction.*paper claim\/story.*before changing routes/iu);
  assert.match(DOVE_RESEARCH_ROUND_CYCLE, /Engineering and verification failures count.*by the third.*ask the user.*before another round/iu);
  const command = "dove mentor brief --project <root>";
  assert.ok(DOVE_RESEARCH_ROUND_CYCLE.includes(command));
  assert.ok(mentor.includes(command));
  assert.match(mentor, /用 Dove 生成的导师调用模板.*材料.*末尾四问/u);
  assert.equal((mentor.match(/^\d+\. .+$/gmu) ?? []).length, 0, "The generator owns the fixed questions, not another handwritten copy");
  assert.match(mentor, /2–3.*用户选定.*选定前不安排方法实现/u);
});

test("mentor amendments: mentor-authored memory and bounded returns feed the next round without resumed history", () => {
  assert.ok(quality.includes("MENTOR_NOTES.md"));
  assert.match(DOVE_RESEARCH_REFLECTION_CONTINUITY, /MENTOR_NOTES\.md, not resumed conversation/iu);
  assert.match(mentor, /按质量摘要返回自己的“导师笔记”/u);
  assert.match(mentor, /主会话按摘要的篇幅与保存规则原样保存/u);
  assert.match(quality, /导师每次返回.*自有笔记.*不由执行者代写/u);
  assert.match(DOVE_RESEARCH_ROUND_CYCLE, /Mentors on either host read \.dove\/install\/RESEARCH_QUALITY\.md/iu);
  assert.match(quality, /1000 字符的自有笔记.*主会话原样追加到 MENTOR_NOTES\.md.*6000.*导师合并.*3000/u);
  const objectionHeading = "Objections to this brief / factual corrections";
  assert.ok(DOVE_RESEARCH_ROUND_RECORDS.includes(objectionHeading));
  assert.match(mentor, /先回应 result.*Objections to this brief \/ factual corrections.*再/u);
  assert.match(mentor, /2000 字符的下一轮说明.*作者：导师.*方法版本.*用户原话来源/u);
  assert.match(mentor, /1000 字符的八维.*主会话替换 EVAL 表后当前评分/u);
  assert.match(DOVE_RESEARCH_EVALUATION, /current assessment as specified in RESEARCH_QUALITY\.md/iu);
  assert.match(quality, /1000 字符的当前八维判断.*等级、依据与未知.*替换 EVAL\.md 表后当前评分.*不追加日志或自评/u);
});

test("mentor amendments: the executor owns engineering and evaluator repair while the mentor judges direction", () => {
  const experiment = COMMAND_SURFACE_BY_ID["dove.experiment"].contract.actions.join("\n");
  assert.match(DOVE_RESEARCH_CLARIFICATION, /executor decides engineering.*evaluator repairs.*mentor judges direction/iu);
  assert.match(mentor, /评价器修复由执行者决定.*你只判断.*主线.*占时/u);
  assert.match(experiment, /executor repairs evaluator errors.*recomputes every historical method and baseline/iu);
  assert.match(DOVE_RESEARCH_EVALUATION, /all user metrics.*all confirmed requirements/iu);
  assert.match(DOVE_RESEARCH_EVALUATION, /executor repairs.*historical rows.*retained outputs before rerunning/iu);
  assert.match(renderDoveResearchQualityReference(), /执行者.*修评测.*重算.*导师只管方向/u);
  assert.match(renderDoveResearchQualityFullReference(), /executor handles engineering and evaluator corrections.*mentor independently judges direction/iu);
});

test("mentor amendments: every invocation follows shared tracking, impact and scan guidance", () => {
  assert.ok(DOVE_RESEARCH_ROUND_CYCLE.includes("RESEARCH_QUALITY.md for returns and tracking"));
  assert.match(quality, /每次导师调用.*watch\/config\.json.*未判断论文.*已有影响.*最近扫描.*不等待新轮次/u);
  assert.match(quality, /配置为 draft.*主会话写回.*source 为 mentor/u);
  assert.match(quality, /主会话另存 watch\/impact-.*未扫描或已超过七天.*来源.*2000 字符.*watch\/scan-/u);
  assert.match(mentor, /每次调用都按摘要的“两种宿主共同的导师返回”.*配置.*论文.*扫描日期/u);
  assert.ok(quality.includes("- ID | 判断 | 理由 | 方向 | 中文一句话"));
  assert.match(quality, /导师或主会话可据摘要.*不把摘要或核实元数据当全文已读/u);
  assert.match(quality, /显式面板积累或下一次 watch 运行.*papers\/library\.json.*papers\/library\.md/u);
  assert.match(quality, /读面板不写文献库/u);
});

test("mentor amendments: both hosts share grounded gap discovery before mechanism invention", () => {
  assert.equal(DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.claude, DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.dsh);
  assert.ok(DOVE_RESEARCH_ACTION_SPINE.includes("RESEARCH_QUALITY.md"));
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /first read.*standards.*broad parallel candidate pool.*without pruning/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /2–3.*user to choose.*do not implement/iu);
  assert.match(mentor, /质量摘要的“选题与新意判断”/u);
  assert.match(quality, /先读项目选题标准.*挑战轴.*每轴.*至多两个缺口/u);
  assert.ok(quality.includes("已有方法通过 Y 做 X，但 Y 留下问题 Z"));
  assert.match(quality, /至少.*两篇.*正文.*逐篇说明差在哪里/u);
  assert.match(quality, /缺陷类别.*缺机制.*算法局限.*归纳偏置.*信用分配.*目标不匹配.*表示局限.*扩展性/u);
  assert.match(quality, /什么观察或比较.*缺口补上.*不预设解法/u);
  assert.match(quality, /6–10.*查询.*至少 3 个其他子领域.*机制.*查询与来源/u);
  assert.match(quality, /本领域来源也可以.*不能只是重新发现最近邻/u);
  assert.match(quality, /贡献类型由项目标准决定.*只有标准要求时才限方法贡献/u);
  assert.match(DOVE_RESEARCH_ONE_AGENT, /one research collaborator.*not different personas/iu);
});

test("mentor amendments: candidate review attacks novelty and targets one repair dimension", () => {
  for (const field of ["一句话", "缺口", "来源机制", "对应关系", "成立前提", "近邻差别", "最大风险", "改进自"]) {
    assert.ok(quality.includes(field), field);
  }
  assert.match(quality, /隔离的 Dove 判断上下文.*来源机制与迁移前提.*借用机制＋目标问题.*证伪新意/u);
  assert.ok(quality.includes("留下 / 修改 / 否掉（原因）"));
  assert.match(quality, /修改只选最弱的一项：新意、连贯、可行、清晰、对应关系或依据/u);
  assert.match(quality, /论文编号及一两句证据理由.*一句最强反对/u);
  assert.match(quality, /不是完整稿件的 dove-review/u);
  assert.deepEqual(tools(renderClaudeDoveReviewAgent()), ["Read", "Grep", "Glob"]);
});

test("mentor amendments: question-led reading accumulates evidence and Draft verifies library citations", () => {
  const source = COMMAND_SURFACE_BY_ID["dove.source"].contract.actions.join("\n");
  const draft = COMMAND_SURFACE_BY_ID["dove.draft"].contract.actions.join("\n");
  assert.match(quality, /1–5.*问题.*全文.*papers\/<id>\.md.*逐问回答.*正文位置/u);
  assert.match(quality, /复用已回答的问题.*只补新问题.*新意与撞题判断引用这些笔记/u);
  assert.match(quality, /只读上下文.*主会话保存.*不自行写入/u);
  assert.match(source, /full text with 1–5 concrete questions/iu);
  assert.match(source, /papers\/<id>\.md.*cumulative note format in RESEARCH_QUALITY\.md/iu);
  assert.match(source, /Reuse answered questions rather than rereading.*append only new answers with section, page or equation locations/iu);
  assert.match(source, /check-only work.*without creating notes or editing manuscripts/iu);
  assert.match(draft, /papers\/library\.json.*library\.md.*group related work by direction/iu);
  assert.match(draft, /Verify citation metadata.*BibTeX.*never invent authors, venue, date or identifiers/iu);
});
