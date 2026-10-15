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
  assert.match(DOVE_RESEARCH_ROUND_CYCLE, /after.*mainline.*confirmation.*each round end.*two consecutive rounds.*user corrects direction.*paper claim\/story.*before changing routes/iu);
  assert.match(DOVE_RESEARCH_ROUND_CYCLE, /Engineering and verification failures count.*by the third.*ask the user.*before another round/iu);
  assert.match(mentor, /主线确认后.*每轮.*两轮.*诊断.*第三轮.*用户.*决定/u);
  const command = "dove mentor brief --project <root>";
  assert.ok(DOVE_RESEARCH_ROUND_CYCLE.includes(command));
  assert.ok(mentor.includes(command));
  assert.match(mentor, /用 Dove 生成的导师调用模板.*材料.*末尾四问/u);
  assert.equal((mentor.match(/^\d+\. .+$/gmu) ?? []).length, 0, "The generator owns the fixed questions, not another handwritten copy");
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
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /read.*CRITERIA\.md.*standards.*RESEARCH_QUALITY\.md/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /candidates.*neighbors?.*recommendations/iu);
  assert.match(mentor, /未定主线.*质量摘要.*候选.*评审/u);
  assert.match(quality, /项目标准.*挑战轴.*每轴.*至多两个缺口/u);
  assert.match(quality, /强基线.*真实失败.*数字来源/u);
  assert.match(quality, /缺口.*已有方法.*Y.*X.*但.*Y.*Z/u);
  assert.match(quality, /至少两篇.*正文.*论文.*不足/u);
  assert.match(quality, /缺陷类别.*闭合观察/u);
  assert.match(quality, /方法类缺口.*具体到方法.*摘要.*没人做过.*不算/u);
  assert.match(quality, /6[–-]10.*查询.*至少 3 个其他子领域.*机制.*保留查询.*来源/u);
  assert.match(quality, /本领域.*不能.*发现最近邻/u);
  assert.match(quality, /并列生成.*比较/u);
  assert.match(quality, /贡献类型.*标准/u);
  assert.match(DOVE_RESEARCH_ONE_AGENT, /one research collaborator.*not different personas/iu);
});

test("mentor amendments: recommendations lead to user selection, not a closed proposal or another static round", () => {
  assert.match(quality, /用户定主线.*结束选题.*不等.*闭合.*开题/u);
  assert.match(quality, /正式产物.*门槛.*只约束.*产物.*不.*推荐/u);
  assert.match(quality, /最大风险.*未知/u);
  assert.match(quality, /一个.*有来源.*思路.*供选.*方法.*闭合.*主线/u);
  assert.match(quality, /一轮.*候选.*近邻.*最佳.*2[–-]3.*不足.*1\s*个.*不凑数/u);
  assert.match(quality, /标准.*矛盾.*禁.*证据.*说明.*一次.*(?:仍|同时).*方向.*用户.*选.*调标准.*不.*静态打磨/u);
  assert.match(quality, /选定前不实现方法.*标准允许.*诊断/u);
  for (const guidance of [quality, mentor]) {
    assert.match(guidance, /确认后.*(?:结束选题期限制|选题期限制结束)/u);
    assert.match(guidance, /确认后.*独立资源.*授权.*(?:合并|一并)问一次/u);
    assert.match(guidance, /授权.*问一次.*诊断.*设计.*实验.*开题/u);
  }
  assert.match(quality, /跑模型授权.*问一次/u);
  assert.match(mentor, /一轮.*推荐.*用户定主线.*不.*闭合.*开题.*卡住/u);
  assert.match(mentor, /标准冲突.*一次.*仍给方向.*不.*静态打磨/u);
  assert.match(mentor, /已有主线.*不重选.*降档/u);
});

test("mentor amendments: candidate review attacks novelty and targets one repair dimension", () => {
  for (const field of ["一句话", "缺口", "来源机制", "对应关系", "成立前提", "近邻差别", "最大风险", "改进自"]) {
    assert.ok(quality.includes(field), field);
  }
  assert.match(quality, /隔离.*Dove.*机制.*迁移前提.*借用机制＋目标问题.*检索.*反证/u);
  assert.ok(quality.includes("留下 / 修改 / 否掉（原因）"));
  assert.match(quality, /修改(?:只|仅).*新意.*连贯.*可行.*清晰.*对应.*依据.*最弱(?:一项|项)/u);
  assert.match(quality, /附.*编号.*一两句.*证据.*最强反对/u);
  assert.match(quality, /不替代 dove-review/u);
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
