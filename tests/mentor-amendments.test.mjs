import assert from "node:assert/strict";
import test from "node:test";

import { COMMAND_SURFACE_BY_ID } from "../src/core/command-manifest.mjs";
import { renderClaudeDoveMentorAgent, renderClaudeDoveReviewAgent } from "../src/core/dove-agent-definition.mjs";
import {
  DOVE_RESEARCH_CLARIFICATION,
  DOVE_RESEARCH_EVALUATION,
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

test("mentor amendments: mandatory calls ask four direction questions rather than executor-framed tasks", () => {
  assert.match(DOVE_RESEARCH_ROUND_CYCLE, /each round end.*two consecutive rounds.*user corrects direction.*paper claim\/story.*before changing routes/iu);
  assert.match(DOVE_RESEARCH_ROUND_CYCLE, /Engineering and verification failures count.*by the third.*ask the user.*before another round/iu);
  assert.match(DOVE_RESEARCH_ROUND_CYCLE, /only a material list.*Executor opinions.*attachment, not the task framing/iu);
  assert.match(mentor, /只交材料清单.*不.*框定任务/u);
  const questions = mentor.match(/^\d+\. .+$/gmu) ?? [];
  assert.equal(questions.length, 4);
  for (const [index, subject] of [/用户原话.*方向/u, /通用能力.*补丁/u, /目标.*还差/u, /下一轮.*做什么/u].entries()) {
    assert.match(questions[index], subject);
  }
  assert.match(mentor, /2–3.*用户选定.*选定前不安排方法实现/u);
});

test("mentor amendments: mentor-authored memory and bounded returns feed the next round without resumed history", () => {
  assert.ok(DOVE_RESEARCH_ROUND_CYCLE.includes("MENTOR_NOTES.md"));
  assert.match(DOVE_RESEARCH_REFLECTION_CONTINUITY, /MENTOR_NOTES\.md, not resumed conversation/iu);
  assert.match(mentor, /导师笔记.*1000.*原样追加到 MENTOR_NOTES\.md/u);
  assert.match(mentor, /笔记超过 6000.*你合并.*3000.*替换全文/u);
  assert.match(mentor, /笔记只来自你自己的返回.*不由执行者代写/u);
  assert.match(DOVE_RESEARCH_ROUND_CYCLE, /Mentors on either host read \.dove\/install\/RESEARCH_QUALITY\.md/iu);
  assert.match(quality, /1000 字符的自有笔记.*主会话原样追加到 MENTOR_NOTES\.md.*6000.*导师合并.*3000/u);
  const objectionHeading = "Objections to this brief / factual corrections";
  assert.ok(DOVE_RESEARCH_ROUND_RECORDS.includes(objectionHeading));
  assert.match(mentor, /先回应 result.*Objections to this brief \/ factual corrections.*再/u);
  assert.match(mentor, /2000 字符的下一轮说明.*作者：导师.*方法版本.*用户原话来源/u);
  assert.match(mentor, /1000 字符的八维.*主会话替换 EVAL 表后当前评分/u);
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

test("mentor amendments: every invocation checks independent paper-watch configuration, impacts and scan dates", () => {
  for (const material of ["watch/config.json", "unreviewed digests", "impact records", "latest scan"]) {
    assert.ok(DOVE_RESEARCH_ROUND_CYCLE.includes(material), `Mentor material handoff: ${material}`);
  }
  assert.match(quality, /每次导师调用.*watch\/config\.json.*未判断论文.*已有影响.*最近扫描.*不等待新轮次/u);
  assert.match(quality, /配置为 draft.*主会话写回.*source 为 mentor/u);
  assert.match(quality, /主会话独立保存到 watch\/impact-.*未扫描或已超过七天.*来源.*2000 字符.*watch\/scan-/u);
  for (const artifact of ["watch/config.json", "watch/impact-日期.md", "watch/scan-日期.md"]) {
    assert.ok(mentor.includes(artifact), `Native mentor and shared guidance use the same artifact: ${artifact}`);
  }
});
