import assert from "node:assert/strict";
import test from "node:test";

import { COMMAND_SURFACE_BY_ID } from "../src/core/command-manifest.mjs";
import { renderClaudeDoveMentorAgent, renderClaudeDoveReviewAgent } from "../src/core/dove-agent-definition.mjs";
import {
  DOVE_RESEARCH_ACTION_SPINE,
  DOVE_RESEARCH_CLARIFICATION,
  DOVE_RESEARCH_CORRECTION_RECORDING,
  DOVE_RESEARCH_EVALUATION,
  DOVE_RESEARCH_EXPERIMENT_ITERATION,
  DOVE_RESEARCH_REFLECTION_CONTINUITY,
  DOVE_RESEARCH_ROUND_CYCLE,
  DOVE_RESEARCH_ROUND_RECORDS
} from "../src/core/dove-research-contract.mjs";
import { RESEARCH_DEFAULT_DOCUMENTS } from "../src/core/research-defaults.mjs";

const mentor = renderClaudeDoveMentorAgent();

function section(title) {
  const result = mentor.split(/^## /mu).find((part) => part.startsWith(`${title}\n`));
  assert.ok(result, `mentor section: ${title}`);
  return result.slice(title.length).trim();
}

test("mentor amendments: actual user originals replace executor summaries, not host boundaries", () => {
  const sources = section("先读谁说了什么");
  assert.match(mentor, /^tools: Read, Grep, Glob, mcp__exa, mcp__dove-paper-search$/mu);
  assert.match(mentor, /全新上下文.*不 resume.*不带执行过程对话.*不用执行者转述代替用户原话.*不通过 CLI 启动模型/u);
  assert.match(sources, /立项\/接手按日期.*用户原话.*每轮开始.*上轮以来.*不只读执行者总结/u);
  assert.match(sources, /原话源路径.*上次读到的日期\/范围.*Grep\/Read.*真实用户消息.*只读用户写的正文/u);
  for (const excluded of ["元消息", "子会话", "工具返回", "系统/宿主注入", "assistant 执行记录"]) {
    assert.ok(sources.split("排除")[1].split("，不把整个 transcript")[0].includes(excluded), excluded);
  }
  assert.match(sources, /不把整个 transcript 当材料/u);
  assert.match(sources, /当前用户消息.*尚未落盘.*主会话.*当前原文.*不用执行者概括/u);
  assert.match(sources, /没有原话源.*原文或带日期出处的逐字引文.*不能核对.*不能把转述当原话/u);
  assert.match(sources, /用户限制\/纠正.*只收原话＋日期＋出处/u);
  assert.match(sources, /没有用户出处的自加研究禁令.*说明中明确撤销/u);
  assert.match(sources, /原话不可访问是未知，不是授权.*宿主工具拒绝.*不是.*可撤销/u);
  assert.match(DOVE_RESEARCH_CORRECTION_RECORDING, /restrictions\/Recent corrections.*verbatim quotes.*date.*source only/iu);
  assert.match(DOVE_RESEARCH_REFLECTION_CONTINUITY, /dated user originals since the last mentor reading, not execution summaries/iu);
  assert.match(COMMAND_SURFACE_BY_ID["dove.research"].contract.actions.join("\n"), /dated user-original sources\/range.*last reading.*current user's exact words.*not execution conversation or paraphrased user intent/iu);
  assert.match(renderClaudeDoveReviewAgent(), /不读取[^\n]*transcript/u);
});

test("mentor amendments: inception reconstructs broad deployment intent before one confirmation and EVAL", () => {
  const inception = section("立项在评测之前");
  assert.match(inception, /主线确认\/接手.*第一轮.*立项.*按日期.*用户原话和指定规范文档/u);
  for (const requirement of ["部署时实际输入", "所需输出", "创新点", "基线类别", "不是什么"]) assert.ok(inception.includes(requirement));
  assert.match(inception, /旧历史作反例.*不自动继承为限制/u);
  assert.match(inception, /先发散有宽度的候选，再审查.*资源缺口早交用户/u);
  assert.match(inception, /用户确认一次，再定 EVAL.*不自动重做已经确认的立项/u);
  assert.match(DOVE_RESEARCH_EVALUATION, /Confirm inception once.*dated user originals and specified norms.*before defining EVAL/iu);
  assert.match(DOVE_RESEARCH_ACTION_SPINE, /Inception.*user-confirmed goal.*method rounds.*EVAL results/iu);
  assert.match(RESEARCH_DEFAULT_DOCUMENTS[0].content, /Confirm inception.*originals first.*then.*mentor.*evaluation/iu);
});

test("mentor amendments: all user metrics survive mentor protocol repair, historical recomputation and fresh tests", () => {
  const evaluation = section("评测可以纠错，不可以换目标");
  assert.match(evaluation, /第一条数据行.*同输入强基线的完整结果/u);
  assert.match(evaluation, /列覆盖未见数据、训练-测试差距、论文卖点.*每一个指标/u);
  assert.match(evaluation, /没有样本\/类别特例的通用指标.*没测的不算达标/u);
  assert.match(evaluation, /预算、输入条件和失败分母可比.*崩溃、缺输出不能.*跳过/u);
  assert.match(evaluation, /执行者.*报告评测问题，不自行修改.*你.*修正协议.*执行者重算全部历史方法行/u);
  assert.match(evaluation, /EVAL 标明协议与测试划分.*完整重算.*不混用新旧数值/u);
  assert.match(evaluation, /修评价器不等于换方法.*原始产物重算.*缺产物.*历史方法重跑/u);
  assert.match(evaluation, /只有改变目标\/主张含义或部署输入输出才找用户.*不为评价器修复再审批/u);
  assert.match(evaluation, /测试集用过后方法再变.*从未用于开发或已用测试的数据.*重抽测试集.*基线\/对照同集重算/u);
  assert.match(evaluation, /旧测试只作历史\/开发证据.*没有新数据.*独立证据缺口.*不假称“未见”/u);
  assert.match(section("先读谁说了什么"), /每轮抽查原始图\/文件.*不能只信表/u);
  assert.match(DOVE_RESEARCH_EVALUATION, /evaluator flaws.*mentor.*revises the protocol.*all-history recomputation.*only changed goal meaning/iu);
  assert.match(DOVE_RESEARCH_EXPERIMENT_ITERATION, /After test use.*changed method.*fresh unseen test draw and same-set baselines.*not retuning on old test evidence/iu);
  assert.match(COMMAND_SURFACE_BY_ID["dove.experiment"].contract.actions.join("\n"), /do not fix EVAL yourself.*mentor's protocol repair and all-history recomputation/iu);
});

test("mentor amendments: briefs assign concrete execution and one code version with reasoned replacements", () => {
  const brief = section("下一轮说明的固定写法");
  assert.match(brief, /作者：导师.*轮次、方法版本.*原话日期\/出处/u);
  assert.match(brief, /原因诊断.*本轮唯一改动.*对照与预算.*禁读输入.*数字门槛.*失败汇报格式/u);
  assert.match(brief, /假设.*为什么有望奏效.*EVAL 指定列的数值预测.*依据和不确定性/u);
  assert.match(brief, /失败.*卡在哪一步.*1–2 个原始例子/u);
  assert.match(brief, /一轮=一个方法版本.*版本内代码不改.*改代码就新版本、全量重跑.*不把单款修补算全轮结果/u);
  assert.match(brief, /旧方法保留作消融.*各对照同预算/u);
  assert.match(brief, /中途替换本轮说明.*原因和作者.*代码变化.*新版本.*不能用改说明掩盖/u);
  assert.match(brief, /学不动.*立项后的第一个方法轮次.*先做单件过拟合\/从空状态复现.*不能把扩数据、建大评价器.*第一次检验前/u);
  assert.match(mentor, /不计算、不改文件.*搭评测、重算、显著性检验.*说明交给执行者/u);
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /priority is user > external > mentor.*direct user tasks/iu);
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /one code version.*new version and full rerun.*Replaced briefs.*author and reason/iu);
});

test("mentor amendments: result objections and factual corrections are answered before new judgments", () => {
  const judgment = section("每轮先回应，再判断三层");
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /Results.*prediction versus actual.*对本轮说明的反驳\/事实更正.*mentor answers that first/iu);
  assert.match(judgment, /^先回应结果中的“对本轮说明的反驳\/事实更正”/u);
  assert.match(judgment, /承认或用实际依据反驳，不能跳过.*引用 EVAL 列名、预测和实际数值，再判断/u);
});

test("mentor amendments: judgment separates method family, general capability and scientific contribution", () => {
  const judgment = section("每轮先回应，再判断三层");
  const levels = judgment.split("\n").filter((line) => /^\d\. /u.test(line));
  assert.equal(levels.length, 3);
  assert.match(levels[0], /这一族方法.*继续.*共同原因.*连续无净增就换族/u);
  assert.match(levels[1], /通用能力还是补丁.*哪类失败.*未见数据列.*不是某一件/u);
  assert.match(levels[2], /问题\/方法\/贡献.*敏感性、对照强弱、设定现实性/u);
  assert.match(levels[2], /验证.*真补强.*不默认收窄主张.*不要为单件样本出领域工艺主意/u);
});

test("mentor amendments: self-stops and stalled or zero-gain rounds trigger intervention, not bookkeeping", () => {
  const brief = section("下一轮说明的固定写法");
  assert.match(DOVE_RESEARCH_ROUND_CYCLE, /Call `dove-mentor` when no round is active.*inception\/handover.*result.*rule-based self-stop.*stalled EVAL.*repeated zero family gain/iu);
  assert.match(brief, /连续几轮 EVAL 没新行.*诊断.*未形成结果.*改下一轮.*不补造数据/u);
  assert.match(brief, /违背原则\/需要新机制\/规则不允许.*自行停下.*调用你核对规则来源/u);
  assert.match(section("每轮先回应，再判断三层"), /同族连续无净增就换族.*不再循环补丁/u);
  assert.match(brief, /上下文摘要大半是禁令.*建议用户清空.*身份卡、用户原话和当前说明.*不自行清空或撤销宿主权限/u);
});

test("mentor amendments: ask once for consequential changes and continue only authorized independent defaults", () => {
  const clarification = section("找用户，不反复等用户");
  assert.match(clarification, /只为目标\/主张、部署输入输出改变或资源超出找用户/u);
  assert.match(clarification, /数据规模、下载方式、加速.*已授权范围内.*直接定.*不发选择题/u);
  assert.match(clarification, /同一待决事项只问一次.*写清默认.*没回复继续不依赖该决定的已授权默认工作/u);
  assert.match(clarification, /不反复催问.*不把沉默当同意改目标或越过资源\/宿主权限/u);
  assert.match(clarification, /目标完成.*全部指标.*未量的不能称达标/u);
  assert.match(DOVE_RESEARCH_CLARIFICATION, /Ask once.*goal\/claim, deployment input\/output or resource changes/iu);
  assert.match(DOVE_RESEARCH_CLARIFICATION, /mentor decides evaluation repairs and engineering defaults.*without reply continue independent authorized work.*not repeated questions or assumed consent/iu);
});
