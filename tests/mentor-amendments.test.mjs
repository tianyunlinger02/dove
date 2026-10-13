import assert from "node:assert/strict";
import test from "node:test";

import { COMMAND_SURFACE_BY_ID } from "../src/core/command-manifest.mjs";
import { renderClaudeDoveMentorAgent, renderClaudeDoveReviewAgent } from "../src/core/dove-agent-definition.mjs";
import {
  DOVE_RESEARCH_CLARIFICATION,
  DOVE_RESEARCH_CORRECTION_RECORDING,
  DOVE_RESEARCH_EVALUATION,
  DOVE_RESEARCH_EXPERIMENT_ITERATION,
  DOVE_RESEARCH_REFLECTION_CONTINUITY,
  DOVE_RESEARCH_ROUND_CYCLE,
  DOVE_RESEARCH_ROUND_RECORDS
} from "../src/core/dove-research-contract.mjs";

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
  assert.match(DOVE_RESEARCH_REFLECTION_CONTINUITY, /continue the current task.*For mentor judgment, pass dated user originals since the last mentor reading, not execution summaries/iu);
  assert.match(COMMAND_SURFACE_BY_ID["dove.research"].contract.actions.join("\n"), /dated user-original sources\/range.*last reading.*current user's exact words.*not execution conversation or paraphrased user intent/iu);
  assert.match(renderClaudeDoveReviewAgent(), /不读取[^\n]*transcript/u);
});

test("mentor amendments: topic selection tests core hypotheses and preserves the user's Mainline intent", () => {
  const selection = section("选题与主线");
  assert.match(selection, /没写入 Mainline.*选题/u);
  assert.match(selection, /领域.*收窄.*价值.*资源.*问题.*少量.*假设/u);
  assert.match(selection, /机制.*理由.*失败.*观察/u);
  assert.match(selection, /推荐.*执行者.*授权.*核心机制.*端到端/u);
  assert.match(selection, /观察.*发生.*改善.*结果.*修正.*替换.*暂停/u);
  assert.match(selection, /用户.*定夺.*问.*原意.*Mainline/u);
  assert.match(selection, /原话明确.*不重复确认/u);
  assert.match(selection, /领域.*推荐.*不是已定主线.*暂定按暂定.*写入.*不等于批准/u);
  assert.match(selection, /已有主线.*继续.*不重选.*降级/u);
  assert.match(selection, /遵从.*目标.*贡献.*完成条件.*用户.*固定的方法/u);
  assert.match(selection, /其他方法.*结论.*证据.*改变用户承诺.*问.*不为每次方法/u);
  assert.match(selection, /原话.*指定规范.*部署输入输出.*基线.*旧历史.*反例.*不继承.*限制/u);
  assert.match(selection, /只读\/设计.*不执行/u);
  const materials = section("选题材料");
  assert.match(materials, /指定标准.*topic start.*不是.*探索前置/u);
  assert.match(materials, /原话优先.*标准.*本项目.*不代替授权/u);
});

test("mentor amendments: all user metrics survive mentor protocol repair, historical recomputation and fresh tests", () => {
  const evaluation = section("评测可以纠错，不可以换目标");
  assert.match(evaluation, /探索.*核心假设.*观察.*对照.*EVAL.*不等.*评价器/u);
  assert.match(evaluation, /观察范围.*不冒充.*目标.*确认目标.*不降级.*正式比较.*协议.*完整/u);
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
  assert.match(DOVE_RESEARCH_EVALUATION, /EVAL.*dated user originals.*norms/iu);
  assert.match(DOVE_RESEARCH_EVALUATION, /Exploration.*proportionate.*observations\/controls.*not.*full-paper prerequisite/iu);
  assert.match(DOVE_RESEARCH_EVALUATION, /Formal comparisons.*confirmed requirements.*complete.*same-input strong baseline/iu);
  assert.match(DOVE_RESEARCH_EVALUATION, /evaluator flaws.*mentor.*protocol repair.*all-history recomputation.*only goal-meaning changes/iu);
  assert.match(DOVE_RESEARCH_EXPERIMENT_ITERATION, /After test use.*changed methods.*fresh unseen test draws.*same-set baselines.*not old-test retuning/iu);
  assert.match(COMMAND_SURFACE_BY_ID["dove.experiment"].contract.actions.join("\n"), /do not fix EVAL yourself.*mentor's protocol repair and all-history recomputation/iu);
});

test("mentor amendments: briefs assign concrete execution and one code version with reasoned replacements", () => {
  const brief = section("下一轮说明");
  assert.match(brief, /作者：导师.*轮次、方法版本.*原话日期\/出处/u);
  assert.match(brief, /任务收益.*机制依据.*关键未知.*实际实现\/检验/u);
  assert.match(brief, /假设.*理由.*可辨别观察.*结果怎样决定后续/u);
  assert.match(brief, /不等完整基线库、全部指标或理论证明才实现/u);
  assert.match(brief, /按用途.*对照与预算.*禁读输入.*门槛.*失败材料/u);
  assert.match(brief, /可量化.*EVAL.*数值预测.*依据.*不确定性/u);
  assert.match(brief, /失败定位.*1–2 个原始例子/u);
  assert.match(brief, /一轮=一个方法版本.*协同改动.*评测期间代码不改.*改代码.*新版本.*协议.*全量重跑.*不把单款修补算全轮结果/u);
  assert.match(brief, /旧方法作消融.*同预算对照.*辨别实验控制其他因素/u);
  assert.match(brief, /中途替换说明.*原因和作者/u);
  assert.match(brief, /学不动.*先做单件过拟合\/从空状态复现.*不把扩数据、建大评价器.*第一次检验前/u);
  assert.match(mentor, /不计算、不改文件.*搭评测、重算、显著性检验.*说明交给执行者/u);
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /user > external > mentor.*direct user tasks/iu);
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /one code version.*method round.*coordinated changes.*code changes.*new version.*full protocol rerun/iu);
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /Replacements.*author\/reason/iu);
});

test("mentor amendments: result objections and factual corrections are answered before new judgments", () => {
  const judgment = section("每轮先回应，再选择方法工作");
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /Results.*prediction versus actual.*对本轮说明的反驳\/事实更正.*mentor.*first/iu);
  assert.match(judgment, /^先回应结果中的“对本轮说明的反驳\/事实更正”/u);
  assert.match(judgment, /承认或用实际依据反驳，不能跳过.*引用 EVAL 列名、预测和实际数值，再判断/u);
});

test("mentor amendments: task benefit and mechanism evidence select substantive method work", () => {
  const judgment = section("每轮先回应，再选择方法工作");
  assert.match(judgment, /完整目标.*任务收益.*合理替代.*价值/u);
  assert.match(judgment, /方法族.*潜力.*共因/u);
  assert.match(judgment, /连续无净增.*不再循环补丁.*授权内.*换族.*不擅改.*固定的方法/u);
  assert.match(judgment, /机制.*收益.*依据.*关键未知/u);
  assert.match(judgment, /通用能力还是补丁.*哪类失败.*未见数据列.*不看单件调通/u);
  assert.match(judgment, /完整任务.*外部比较.*效用.*消融\/机制对照.*归因.*不互代/u);
  assert.match(judgment, /选核心实现、机制补强或改变决定的取证.*不止诊断/u);
  assert.match(judgment, /问题\/方法\/贡献.*敏感性、对照强弱、现实性.*不默认收窄主张/u);
  assert.match(judgment, /已知错误直接修.*不要求修复创新.*不出单件工艺主意/u);
});

test("mentor amendments: needed independent judgment reuses evidence and diagnoses stalled or zero-gain research", () => {
  const brief = section("下一轮说明");
  assert.match(DOVE_RESEARCH_ROUND_CYCLE, /dove-mentor.*on request.*independent.*judgment.*needed.*reuse.*without new material/iu);
  assert.match(brief, /连续几轮 EVAL 没新行.*诊断.*未形成结果.*调整实际工作.*不补造数据/u);
  assert.match(section("每轮先回应，再选择方法工作"), /连续无净增.*不再循环补丁.*授权内.*换族/u);
  assert.match(brief, /上下文摘要大半是禁令.*建议用户清空.*身份卡、用户原话和当前说明.*不自行清空或撤销宿主权限/u);
});

test("mentor amendments: ask once for consequential changes and continue only authorized independent defaults", () => {
  const clarification = section("找用户，不反复等用户");
  assert.match(clarification, /定夺方向.*目标\/主张.*固定的方法.*部署输入输出.*资源.*询问/u);
  assert.match(clarification, /明确.*不重复问/u);
  assert.match(clarification, /数据规模.*下载方式.*加速.*授权内.*直接定/u);
  assert.match(clarification, /同一事项.*一次.*默认.*没回复.*不依赖.*已授权/u);
  assert.match(clarification, /不把沉默当同意.*资源\/宿主权限/u);
  assert.match(clarification, /目标完成.*全部指标.*未量的不能称达标/u);
  assert.match(DOVE_RESEARCH_CLARIFICATION, /clear user words.*without reconfirmation/iu);
  assert.match(DOVE_RESEARCH_CLARIFICATION, /ask once.*undecided direction.*commitment.*deployment.*resource.*changes/iu);
  assert.match(DOVE_RESEARCH_CLARIFICATION, /Mentor.*evaluation.*engineering/iu);
  assert.match(DOVE_RESEARCH_CLARIFICATION, /no reply.*independent authorized work.*not assumed consent/iu);
});
