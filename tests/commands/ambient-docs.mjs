import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { renderProjectIntegrationResult } from "../../src/cli/project-integration-output.mjs";
import { renderDoveHome } from "../../src/cli/terminal-output.mjs";
import { renderClaudeDoveAgent } from "../../src/core/dove-agent-definition.mjs";
import { renderDoveReviewerStanceSection, renderDoveSharedResearchContractSection } from "../../src/core/dove-agent-persona.mjs";
import { USER_RESPONSE_POLICY } from "../../src/core/user-response-policy.mjs";
import {
  RESEARCH_DEFAULT_DIRECTORY_PATHS,
  RESEARCH_DEFAULT_DOCUMENTS,
  RESEARCH_DEFAULT_PATHS,
  RESEARCH_LESSON_TOPICS,
  planResearchDefaults
} from "../../src/core/research-defaults.mjs";
import {
  PAPER_SEARCH_MCP_FRAGMENT,
  PAPER_SEARCH_PACKAGE_SPECIFIER,
  PAPER_SEARCH_SUPPORT_SKILL_PATH
} from "../../src/core/paper-search-integration.mjs";
import {
  EXA_MCP_FRAGMENT,
  EXA_WEB_SUPPORT_SKILL_PATH,
  WEB_FETCH_DENY_PERMISSION
} from "../../src/core/web-access-integration.mjs";
import { generatedAdapterEntries, generatedClaudeAmbientProjectEntries } from "../../scripts/generate-command-adapters.mjs";
import { ROOT, assertDoveAgentSurfaceSemantics, assertSemanticDeletionsRejected } from "./common.mjs";

const EXPECTED_AMBIENT_PATHS = [
  ".claude/rules/dove.md",
  PAPER_SEARCH_SUPPORT_SKILL_PATH,
  EXA_WEB_SUPPORT_SKILL_PATH
];

export function assertUserResponsePolicy(value, label) {
  for (const pattern of [
    /(?:default|normally)[^.\n]*natural Chinese|natural Chinese[^.\n]*default/iu,
    /(?:explicit|requested)[^.\n]*(?:language|format)[^.\n]*(?:precedence|priority|override|first)|(?:follow|honor|respect)[^.\n]*(?:requested|explicit)[^.\n]*language[^.\n]*format/iu,
    /(?:judgment|conclusion|answer)[^.\n]*(?:before|then|first)[^.\n]*(?:evidence|basis|reason)/iu,
    /(?:plain|everyday) language[^.\n]*(?:complex|concept)|(?:complex|concept)[^.\n]*(?:plain|everyday) language/iu,
    /(?:foreign|technical|English) terms?[^.\n]*(?:Chinese|first)|(?:Chinese|first)[^.\n]*(?:foreign|technical|English) terms?/iu,
    /(?:avoid|minimize|less|reduce)[^.\n]*(?:internal|jargon)/iu,
    /(?:report|communicate|describe)[^.\n]*(?:substantive|material|actual) (?:research )?progress[^.\n]*user[^.\n]*goal[^.\n]*not[^.\n]*transcript/iu,
    /(?:close|end|stop|finish)[^.\n]*naturally|natural (?:close|ending)/iu,
    /(?:not|no|without)[^.\n]*(?:fixed|mandatory|routine|every)[^.\n]*(?:next|suggestion|recommendation|closing)/iu
  ]) assert.match(value, pattern, `${label}: communication boundary ${pattern}`);
}

// Independent semantic anchors, not copies of the canonical prose. Each level
// needs its own substantive criterion; headings or work-completion labels alone
// must not pass. Semicolon clauses keep a neighboring level from supplying it.
const QUALITY_DIMENSIONS = [
  [/Problem value/iu, [
    [/limited\/insufficient/iu, /even success[^;]*little[^;]*(?:knowledge|benefit)[^;]*alternatives/iu],
    [/local/iu, /real benefit[^;]*bounded need/iu],
    [/important/iu, /consequential bottleneck[^;]*severe failure[^;]*knowledge gap/iu],
    [/broad\/foundational/iu, /shared capabilities[^;]*understanding[^;]*class of problems/iu]
  ]],
  [/Novelty/iu, [
    [/no substantive novelty/iu, /core content[^;]*covered[^;]*remainder[^;]*equivalent/iu],
    [/incremental/iu, /genuine[^;]*limited extension[^;]*existing principle/iu],
    [/independent contribution/iu, /distinct mechanism[^;]*subtracting covered contributions[^;]*not[^;]*assembly/iu],
    [/significant innovation/iu, /changes[^;]*solution principle[^;]*revises[^;]*understanding/iu],
    [/foundational innovation/iu, /framework or principle[^;]*class of new[^;]*(?:methods|predictions)/iu]
  ]],
  [/Mechanism and theory quality/iu, [
    [/unsupported\/flawed/iu, /circularity[^;]*contradiction[^;]*gap[^;]*cannot support/iu],
    [/limited but coherent/iu, /local relationship[^;]*explicit conditions[^;]*limited[^;]*predictions/iu],
    [/strong\/nontrivial/iu, /sound relationship[^;]*meaningful effects[^;]*failure boundaries[^;]*alternatives/iu],
    [/deep\/generalizing/iu, /unifying explanation[^;]*fundamental relationship[^;]*predictions beyond/iu]
  ]],
  [/Method quality and feasibility/iu, [
    [/unsuitable\/infeasible/iu, /necessary capability[^;]*unavailable[^;]*worthwhile benefit[^;]*upper bound/iu],
    [/limited/iu, /explicit restrictions[^;]*capability[^;]*cost[^;]*robustness gaps/iu],
    [/fit for purpose/iu, /targets the problem[^;]*necessary capabilities[^;]*proportionate benefit/iu],
    [/strong\/adaptable/iu, /overall advantage[^;]*alternatives[^;]*important variations[^;]*complexity/iu]
  ]],
  [/Data and evaluation quality/iu, [
    [/invalid for purpose/iu, /leakage[^;]*target mismatch[^;]*confounding[^;]*judgment/iu],
    [/diagnostic only/iu, /bounded information[^;]*lacks[^;]*independence[^;]*identification/iu],
    [/fit for judgment/iu, /valid target measurement[^;]*fair comparisons[^;]*controlled[^;]*uncertainty/iu],
    [/strongly discriminating/iu, /separates[^;]*explanations[^;]*heterogeneity[^;]*failure boundaries/iu]
  ]],
  [/Implementation quality/iu, [
    [/unusable\/incorrect/iu, /necessary behavior[^;]*missing[^;]*wrong[^;]*downstream[^;]*silently fails/iu],
    [/restricted/iu, /explicit limits[^;]*correctness[^;]*reliability[^;]*integration gaps/iu],
    [/reliable for purpose/iu, /contracts[^;]*downstream behavior[^;]*correct[^;]*failures visible/iu],
    [/robust\/evolvable/iu, /reliability[^;]*boundaries and changes[^;]*ownership[^;]*maintenance complexity/iu]
  ]],
  [/Experiment and evidence value/iu, [
    [/uninformative\/invalid for the claim/iu, /cannot support[^;]*inference[^;]*confounded[^;]*non.discriminating/iu],
    [/limited leads/iu, /changes[^;]*understanding[^;]*main inference uncertain/iu],
    [/establishes a scoped conclusion/iu, /evidence supports, refutes, or bounds[^;]*claim[^;]*effect size[^;]*uncertainty/iu],
    [/strong\/deep insight/iu, /constraining evidence[^;]*alternatives[^;]*mechanisms[^;]*boundaries/iu]
  ]],
  [/Expression and delivery quality/iu, [
    [/misleading\/unusable/iu, /claims conflict with evidence[^;]*content[^;]*missing[^;]*intended use/iu],
    [/understandable but weak/iu, /core[^;]*discernible[^;]*reasoning[^;]*usability[^;]*deficient/iu],
    [/accurate\/clear\/usable/iu, /question[^;]*contribution[^;]*evidence[^;]*limitations[^;]*output align/iu],
    [/compelling\/efficient/iu, /accurate[^;]*key insight[^;]*strong objections[^;]*reader effort/iu]
  ]]
];

export function assertResearchQuality(value, label) {
  for (const [dimension, levels] of QUALITY_DIMENSIONS) {
    const line = value.split("\n").find((item) => /\s[—–]\s/u.test(item) && dimension.test(item.split(/\s[—–]\s/u)[0]));
    assert.ok(line, `${label}: reachable quality dimension ${dimension}`);
    const clauses = line.split(/\s[—–]\s/u).slice(1).join(" — ").split(";");
    for (const [level, criterion] of levels) {
      const clause = clauses.find((item) => level.test(item.split(":")[0]));
      assert.ok(clause, `${label}: ${dimension} needs level ${level}`);
      assert.match(clause.slice(clause.indexOf(":") + 1), criterion, `${label}: ${dimension} ${level} needs substantive merit, not activity depth`);
    }
  }
  for (const pattern of [
    /substantive quality[^.\n]*not how much[^.\n]*searching[^.\n]*checking[^.\n]*completed/iu,
    /separately state[^.\n]*evidence and confidence[^.\n]*current purpose[^.\n]*work.completion facts/iu,
    /inspected evidence[^.\n]*reference and scope/iu,
    /qualify[^.\n]*predictions[^.\n]*provisional ratings[^.\n]*intervals/iu,
    /unknown[^.\n]*not[^.\n]*low quality or zero/iu,
    /not applicable[^.\n]*reason/iu,
    /investigating an invalid component[^.\n]*does not[^.\n]*high quality/iu,
    /negative result[^.\n]*advance knowledge[^.\n]*without improving[^.\n]*method/iu,
    /reassess affected ratings[^.\n]*scope[^.\n]*versions[^.\n]*dependencies/iu,
    /local requests[^.\n]*relevant dimensions[^.\n]*not every level/iu,
    /search coverage[^.\n]*full.text inspection[^.\n]*confidence, not novelty magnitude/iu,
    /exhaustive search[^.\n]*no novelty/iu,
    /correctness and applicability[^.\n]*necessary[^.\n]*not compensated by depth/iu,
    /empirical effectiveness[^.\n]*unknown without suitable execution evidence/iu,
    /theoretical guarantees[^.\n]*matching proof and conditions/iu,
    /test completion and file existence[^.\n]*evidence facts, not quality ratings/iu,
    /nonsignificant[^.\n]*does not establish no effect/iu,
    /run count[^.\n]*positive results[^.\n]*records[^.\n]*do not determine evidence value/iu,
    /delivery readiness[^.\n]*not scientific acceptance/iu,
    /ordinary Markdown evaluation table[^:\n]*useful/iu,
    /scoped object\/dimension[^.\n]*rating and reason[^.\n]*measurements[^.\n]*confidence\/unknowns[^.\n]*current.purpose[^.\n]*overall impact/iu,
    /criterion[^.\n]*rather than only a number/iu,
    /not a mandatory template or per.step report/iu,
    /measurements[^.\n]*units[^.\n]*denominators[^.\n]*protocol[^.\n]*reference[^.\n]*uncertainty/iu,
    /separate predictions from measurements/iu,
    /auxiliary scoring[^.\n]*allowed[^.\n]*grounded scales[^.\n]*justified[^.\n]*weights[^.\n]*uncertainty/iu,
    /sensitivity[^.\n]*reasonable weights[^.\n]*change the choice/iu,
    /do not average ordinal levels[^.\n]*percentages[^.\n]*success\/acceptance probabilities/iu,
    /unknown, failed, and not applicable[^.\n]*distinct/iu,
    /do not[^.\n]*drop missing dimensions[^.\n]*renormalize weights/iu,
    /do not change thresholds[^.\n]*weights[^.\n]*sample subsets[^.\n]*goal definitions[^.\n]*manufacture success/iu,
    /justified revisions[^.\n]*basis[^.\n]*preserved original comparison[^.\n]*authorization[^.\n]*final.test/iu,
    /no runtime rating state[^.\n]*automatic scientific PASS[^.\n]*forced research document/iu
  ]) assert.match(value, pattern, `${label}: substantive quality boundary ${pattern}`);
  assert.doesNotMatch(value, /DOVE_RESEARCH_MATURITY|level [1-4][^;\n]*(?:problem lead|concrete candidate|argument.ready|evidence.supported)/iu, `${label}: retired universal ladder must not remain`);
  assert.doesNotMatch(value, /(?:do not|never|no) (?:use |provide )?(?:evaluation tables|auxiliary scor(?:es|ing)|project scores)\b/iu, `${label}: do not prohibit grounded tables or auxiliary scoring`);
}

export function assertResearchQualityDeletions(value, label) {
  assertSemanticDeletionsRejected(value, label, assertResearchQuality,
    QUALITY_DIMENSIONS.flatMap(([, levels]) => levels.map(([, criterion]) => criterion)));
}

export function assertResearchTaskIdentity(value, label) {
  for (const pattern of [
    /scientific task continuity[^.\n]*actual problem or phenomenon[^.\n]*target objects\/population and regime[^.\n]*inputs and permitted information[^.\n]*output or estimand/iu,
    /constraints[^.\n]*baseline\/reference[^.\n]*real.world goal[^.\n]*proxy relationship[^.\n]*core proposition[^.\n]*intended contribution[^.\n]*success conditions[^.\n]*completion meaning/iu,
    /Compare only the items relevant[^.\n]*current decision[^.\n]*stayed fixed[^.\n]*materially changed/iu,
    /project, paper, repository, module, dataset, and code lineage[^.\n]*asset continuity, not scientific task continuity/iu,
    /asset continuity[^.\n]*not[^.\n]*inherited value[^.\n]*novelty[^.\n]*admission[^.\n]*completion/iu,
    /proxy supports the real goal only through a grounded relationship/iu,
    /silently making an easier proxy, output, or success criterion the goal[^.\n]*task change, not success/iu,
    /targeted identity comparison[^.\n]*decisive support\/refutation[^.\n]*promoting a surviving component[^.\n]*expanding major investment/iu,
    /outputs, goals, baselines, proxies, contribution, or completion meaning change/iu,
    /cumulative local changes[^.\n]*changed the task[^.\n]*current materials conflict/iu,
    /Reuse still.applicable evidence[^.\n]*do not recheck the whole task[^.\n]*ordinary repeat runs[^.\n]*equivalent implementations[^.\n]*unrelated refactors/iu,
    /low.cost reversible choices[^.\n]*leave the core judgment unchanged/iu,
    /natural.language judgment[^.\n]*not a required schema, table, ID, or per.round record/iu
  ]) assert.match(value, pattern, `${label}: scientific task identity boundary ${pattern}`);
}

export function assertPropositionTransition(value, label) {
  for (const pattern of [
    /After a material result[^.\n]*first judge[^.\n]*proposition that motivated the work/iu,
    /implementation or comparison failure[^.\n]*scientific proposition unresolved/iu,
    /local mechanism result[^.\n]*constrains its dependencies/iu,
    /matching evidence[^.\n]*support, refute, or bound the core proposition/iu,
    /Accept factual negative conclusions without waiting for approval/iu,
    /state affected claims and investment/iu,
    /Preserve valid code, data, evidence, and negative findings as assets/iu,
    /do not let[^.\n]*surviving component[^.\n]*local metric gain[^.\n]*review request[^.\n]*reusable implementation[^.\n]*automatically become the main method[^.\n]*restore the original claim/iu,
    /provisional candidate[^.\n]*authorized, proportionate investigation/iu,
    /Before promoting[^.\n]*intended contribution or confirmed mainline[^.\n]*compare its task identity[^.\n]*preserve the original conclusion/iu,
    /independently reassess[^.\n]*problem value[^.\n]*novelty[^.\n]*mechanism\/method[^.\n]*data\/evaluation[^.\n]*feasibility[^.\n]*resources[^.\n]*joint conditions/iu,
    /compare serious alternatives/iu,
    /Investigation permission is not mainline.change permission/iu,
    /material change[^.\n]*confirmed mainline[^.\n]*intended contribution[^.\n]*completion meaning[^.\n]*requires the user's decision/iu,
    /Once authorized[^.\n]*continue the new mainline[^.\n]*without repeatedly requesting the same decision/iu,
    /never rewriting its success as success of the old proposition/iu,
    /no inherited success, admission, or completion[^.\n]*not deleting assets[^.\n]*discarding evidence[^.\n]*assigning unknowns zero[^.\n]*blocking useful early investigation/iu
  ]) assert.match(value, pattern, `${label}: proposition transition boundary ${pattern}`);
}

export function assertSharedResearchJudgment(value, label) {
  assertResearchQuality(value, label);
  assertResearchTaskIdentity(value, label);
  assertPropositionTransition(value, label);
  for (const pattern of [
    /core[^;\n]*main goal[^;\n]*branch[^;\n]*dependent route or claim[^;\n]*local[^;\n]*bounded quality/iu,
    /separately from evidence strength and repair effort/iu,
    /joint conditions[^.\n]*current decision/iu,
    /investigation needs[^;\n]*plausible value[^;\n]*proportionate[^;\n]*informative evidence/iu,
    /full implementation or major development[^;\n]*problem value[^;\n]*contribution\/positioning[^;\n]*concrete mechanism[^;\n]*feasibility, and resources/iu,
    /scaling formal experiments[^;\n]*trustworthy execution[^;\n]*valid evaluation[^;\n]*fair identification, and[^;\n]*uncertainty[^;\n]*scale can resolve/iu,
    /core conclusion[^;\n]*evidence sufficient[^;\n]*claim[^;\n]*alternatives and counterevidence[^;\n]*matching theoretical\/statistical scope/iu,
    /submission completion[^.\n]*scientific sufficiency[^.\n]*accurate expression[^.\n]*delivery readiness, and[^.\n]*same.version independent review/iu,
    /non.compensable necessary conditions[^.\n]*negotiable objectives/iu,
    /high scores cannot offset[^.\n]*leakage[^.\n]*invalid evaluation[^.\n]*theoretical contradiction[^.\n]*unavailable necessary resources[^.\n]*insufficient necessary value[^.\n]*coverage[^.\n]*independent contribution/iu,
    /neither an average rating nor an arbitrary lowest dimension[^.\n]*project/iu,
    /authorized diagnostics[^.\n]*need not satisfy full.implementation conditions/iu,
    /failed prerequisite[^.\n]*dependent investment, not all useful action/iu,
    /important incremental work[^.\n]*preferable[^.\n]*low.value radical idea/iu,
    /before defaulting[^.\n]*local fix[^.\n]*whether the route remains worth pursuing/iu,
    /compare[^.\n]*complete repair[^.\n]*shared.cause redesign[^.\n]*alternative mechanism\/route[^.\n]*discriminating evidence[^.\n]*stopping/iu,
    /substantive result[^.\n]*overall consequences/iu,
    /cross.dimension changes[^.\n]*counterevidence[^.\n]*expansion[^.\n]*repeated patches[^.\n]*targeted reassessment[^.\n]*not[^.\n]*every tool action/iu,
    /gains against lost necessary capabilities[^.\n]*cost[^.\n]*coverage[^.\n]*knowledge[^.\n]*future options/iu,
    /do not require every step[^.\n]*Pareto.improving/iu,
    /temporary regression[^.\n]*knowledge[^.\n]*later capability[^.\n]*reason, boundary, and evidence for reassessment/iu,
    /not an indefinitely deferred promise/iu,
    /no metric gain[^.\n]*does not automatically require rollback/iu,
    /best defensible path[^.\n]*evidence and constraints[^.\n]*not[^.\n]*mathematical global optimum/iu,
    /distinguish scientific progress, enabling engineering work, and expression\/delivery progress/iu,
    /scientific progress[^.\n]*justified understanding[^.\n]*target research capability or result[^.\n]*valid reference[^.\n]*defensible research decision/iu,
    /enabling a pipeline to run[^.\n]*engineering capability, not the research effect/iu,
    /explain[^.\n]*evidence[^.\n]*inference or choice changed/iu,
    /near miss[^.\n]*only[^.\n]*actually teaches/iu,
    /coding, search, passing checks[^.\n]*successful runs[^.\n]*frozen protocols[^.\n]*do not by themselves establish[^.\n]*novelty[^.\n]*valid evidence[^.\n]*scientific goal attainment/iu,
    /enabling and delivery work[^.\n]*necessary[^.\n]*complete a bounded request/iu,
    /report that value without claiming scientific support/iu,
    /do not force[^.\n]*immediate scientific result[^.\n]*every useful engineering action/iu,
    /repeated support work[^.\n]*substitute[^.\n]*scientific bottleneck/iu,
    /Before committing to or materially changing[^\n]*direction[^\n]*method[^\n]*evaluation target[^\n]*central experiment/iu,
    /core proposition[^.\n]*theory or mechanism[^.\n]*proportionate/iu,
    /simple alternatives[^.\n]*assumptions[^.\n]*applicability[^.\n]*inspected evidence/iu,
    /distinguish\w* predictions or failure conditions/iu,
    /derivation[^.\n]*counterexamples[^.\n]*(?:permitted|authorized) exploratory diagnostics[^.\n]*as needed/iu,
    /as needed to (?:choose or revise|change)[^.\n]*method[^.\n]*baseline[^.\n]*metric[^.\n]*investment decision/iu,
    /inspect[^.\n]*theory[^.\n]*(?:related|near.neighbor|contrary) work[^.\n]*when it can (?:inform|change)[^.\n]*decision/iu,
    /(?:decompose|split)[^.\n]*mainline[^.\n]*(?:candidates|subgoals)[^.\n]*(?:decision.sized|work) units/iu,
    /(?:retain|preserv)[^.\n]*dependencies[^.\n]*(?:whole|overall) mechanism[^.\n]*final value/iu,
    /same granularity[^.\n]*inputs[^.\n]*outputs[^.\n]*assumptions[^.\n]*mechanisms[^.\n]*claims/iu,
    /subtract[^.\n]*covered contributions[^.\n]*reassess[^.\n]*remaining difference[^.\n]*value/iu,
    /stop decomposing[^.\n]*decision[^.\n]*clear/iu,
    /clarify[^.\n]*undefined objects[^.\n]*design[^.\n]*missing mechanisms[^.\n]*validate[^.\n]*unknown effects/iu,
    /simple mechanisms[^.\n]*(?:important|valuable) contributions/iu,
    /diagnostic prototype[^.\n]*not[^.\n]*main method[^.\n]*sunk cost/iu,
    /failure[^.\n]*does not automatically refute[^.\n]*higher.level hypothesis/iu,
    /(?:design.only|topic.selection)[^.\n]*restrictions[^.\n]*(?:govern|constrain)[^.\n]*execution/iu,
    /insufficiently grounded routes[^.\n]*provisional/iu,
    /routine local work[^.\n]*no fixed theory preamble/iu,
    /Prioritize[^\n]*problem[^\n]*contribution[^\n]*data and evaluation validity[^\n]*method and statistical identification[^\n]*execution[^\n]*recovery[^\n]*delivery/iu,
    /highest-level active limitation[^\n]*without skipping necessary run-validity checks[^\n]*urgent protection[^\n]*artifact/iu,
    /Reuse checked evidence[^\n]*conditions still hold/iu,
    /inspect only material changes, contradictions, or decision-changing gaps[^\n]*not the whole project again for each agent/iu,
    /scientific value.*result quality.*time.*resources.*opportunity cost.*rework risk.*downstream effects.*whole research path/isu,
    /Before treating[^.\n]*unusually strong results as evidence[^.\n]*(?:check|inspect)[^.\n]*implementation[^.\n]*data[^.\n]*configuration[^.\n]*environment[^.\n]*randomness[^.\n]*metrics[^.\n]*analysis[^.\n]*interpretation/iu,
    /(?:Valid execution|performance gain)[^.\n]*alone does not establish[^.\n]*evaluation validity[^.\n]*component's contribution[^.\n]*scientific mechanism/iu,
    /frozen protocol[^.\n]*(?:fix|freez)[^.\n]*comparison rules[^.\n]*(?:not|does not)[^.\n]*scientific validity[^.\n]*metric[^.\n]*budget[^.\n]*method/iu,
    /stop investigating[^.\n]*(?:inspection|investigation)[^.\n]*(?:not|no longer)[^.\n]*change[^.\n]*next action/iu,
    /(?:retain|keep)[^.\n]*nonblocking unknowns[^.\n]*without[^.\n]*(?:reopen|reinvestigat)/iu,
    /unresolved gap[^.\n]*limits dependent work[^.\n]*claims[^.\n]*not every independent action/iu,
    /Citation identity[^.\n]*full-text inspection[^.\n]*claim support[^.\n]*separate judgments/iu,
    /(?:files|passing checks)[^.\n]*alone are not research progress/iu,
    /claim strength within the evidence.*generality, quantitative qualifiers, and novelty/isu,
    /state unknowns[^.\n]*include counterevidence/iu,
    /summaries, notes, and verdicts[^\n]*context, not proof/iu,
    /revise optimistic judgments[^\n]*current evidence contradicts/iu,
    /distinguish support, contradiction, insufficient evidence[^\n]*comparison that cannot identify the contribution/iu,
    /user decisions can change the goal, not the facts/iu,
    /Answer and stop for pure judgment or bounded requests.*only exposed, permitted host tools/isu
  ]) assert.match(value, pattern, `${label}: shared judgment boundary ${pattern}`);
  assert.doesNotMatch(value, /always (?:search|retrieve|review) (?:the )?literature|(?:complete|exhaustive) theory review before (?:any|every) (?:action|diagnostic)/iu, `${label}: theory must not become an execution gate`);
}

export function assertSharedAuthorStance(value, label) {
  for (const pattern of [
    /user-confirmed Workspace mainline, intended contribution.*completion meaning.*material change to that anchor belongs to the user/isu,
    /direction is open.*clearly provisional research question or route/isu,
    /active confirmed research context.*feasible next in-scope step.*continue while an effective mainline action remains/isu,
    /Read-only requests authorize inspection and reporting, not execution or recording/iu,
    /After delegation[^\n]*main session[^\n]*full user context[^\n]*synthesizes decisive evidence/iu,
    /subtask applicability[^.\n]*unverified limits[^.\n]*resolves contradictions[^.\n]*(?:chooses|decides)[^.\n]*(?:next action|what comes next)/iu,
    /without redoing every subtask/iu,
    /(?:decisive|key|critical) objections[^.\n]*change dependent investment[^.\n]*claims[^.\n]*(?:answer|rebut)[^.\n]*inspected evidence/iu,
    /unresolved objections[^.\n]*(?:retain|limit|constrain)[^.\n]*later decisions[^.\n]*reports/iu,
    /reasonable defaults[^.\n]*low.cost[^.\n]*reversible[^.\n]*in.scope choices[^.\n]*do not change the core research judgment/iu,
    /before expanding[^.\n]*cost[^.\n]*dependencies[^.\n]*claim strength[^.\n]*joint conditions[^.\n]*not just[^.\n]*implementation succeeded/iu,
    /proportionate scope of work[^.\n]*absorb[^.\n]*overall result[^.\n]*before expanding/iu,
    /neither check every small step[^.\n]*nor wait[^.\n]*every scientific premise[^.\n]*before authorized investigation/iu,
    /failure[^.\n]*trace affected dependencies[^.\n]*complete repair[^.\n]*shared.cause redesign[^.\n]*alternative route[^.\n]*further evidence[^.\n]*stopping/iu,
    /do not default to minimal patches[^.\n]*unrelated refactoring/iu,
    /report[^.\n]*scientific judgment changed[^.\n]*engineering capability[^.\n]*delivery requirement[^.\n]*without substituting/iu,
    /retain still.valid work[^.\n]*negative evidence[^.\n]*rather than restart everything[^.\n]*sunk cost/iu,
    /(?:when|if) implementing[^.\n]*one authoritative contract[^.\n]*producers[^.\n]*consumers[^.\n]*validation[^.\n]*presentation/iu,
    /(?:complete|perform)[^.\n]*(?:needed|necessary) migrations[^.\n]*without redundant[^.\n]*(?:compatibility|shadow) paths/iu,
    /(?:not|never) hide errors[^.\n]*swallowed failures[^.\n]*defaults[^.\n]*truncation/iu,
    /(?:report|state)[^.\n]*completion facts separately[^.\n]*implemented[^.\n]*focused checks[^.\n]*integration[^.\n]*real execution[^.\n]*formal output[^.\n]*read.back[^.\n]*actual downstream use/iu,
    /earlier fact[^.\n]*cannot stand in[^.\n]*later one[^.\n]*scientific support/iu,
    /work and validation performed, not substantive quality grades/iu,
    /missing validation[^.\n]*without requiring every bounded task[^.\n]*production readiness/iu,
    /distinguish changing[^.\n]*method[^.\n]*evaluation[^.\n]*research goal/iu,
    /mentioning another direction[^.\n]*not authorization[^.\n]*adopt/iu,
    /agent completion[^.\n]*majority opinion[^.\n]*concatenated reports[^.\n]*not scientific judgment/iu,
    /Bounded Dove subagents[^.\n]*investigate[^.\n]*question[^.\n]*not own[^.\n]*mainline or important user communication/iu,
    /feasible discriminating follow-up[^\n]*resolve uncertainty[^\n]*rather than merely weakening prose/iu,
    /do not indefinitely postpone accepting counterevidence/iu,
    /new route[^.\n]*does not erase[^.\n]*failure[^.\n]*original proposition/iu,
    /factual negative judgment[^.\n]*does not await[^.\n]*user approval/iu,
    /surviving component[^.\n]*asset or provisional candidate[^.\n]*not an automatic mainline/iu,
    /code continuity[^.\n]*does not establish scientific task continuity/iu,
    /normal in.task corrections[^.\n]*authorized provisional investigation[^.\n]*without repeatedly seeking approval/iu,
    /accepting factual refutation[^.\n]*no approval/iu,
    /adopting a materially different confirmed mainline[^.\n]*contribution[^.\n]*completion meaning[^.\n]*does/iu,
    /cosmetic.only changes[^.\n]*selective evidence[^.\n]*hiding counterevidence[^.\n]*unjustified narrowing[^.\n]*diff.only review[^.\n]*restarting the reviewer context/iu,
    /favorable review recommendation[^.\n]*cannot turn success on a different task into success of the original proposition/iu,
    /material change[^\n]*confirmed mainline[^\n]*intended contribution[^\n]*completion meaning does/iu,
    /limits on actions, not automatic limits on the research mainline.*one path is blocked.*other effective in-mainline paths before calling the research blocked/isu,
    /user-confirmed submission-completion goal.*author-side scientific sufficiency.*current independent `dove-review`.*same full version.*real delivery readiness/isu,
    /Unavailable isolated review leaves that requirement unmet, not waived/iu,
    /bounded local review, edit, figure, or other task can finish without becoming a submission-completion goal/iu
  ]) assert.match(value, pattern, `${label}: author boundary ${pattern}`);
}

export function assertAmbientRouting() {
  const entries = generatedClaudeAmbientProjectEntries();
  assert.deepEqual(entries.map((entry) => entry.destinationPath), EXPECTED_AMBIENT_PATHS);
  const byPath = new Map(entries.map((entry) => [entry.destinationPath, entry.content]));
  const rule = byPath.get(".claude/rules/dove.md");
  const paperSearch = byPath.get(PAPER_SEARCH_SUPPORT_SKILL_PATH);
  const webReader = byPath.get(EXA_WEB_SUPPORT_SKILL_PATH);
  assert.match(rule, /shared researcher judgment/iu);
  assert.match(rule, /one complete (?:Dove )?research agent|same research collaboration/iu);
  assert.match(rule, /nine Skills.*(?:same research collaboration|current decision|optional specialist methods)|optional specialist capabilities/isu);
  assert.match(rule, /research requests in the current conversation/iu);
  assert.match(rule, /answer, clarify, or use a Dove capability when useful/iu);
  assert.match(rule, /ask only when unresolved ambiguity or authorization[^.\n]*materially change/iu);
  assertSharedResearchJudgment(rule, "Ordinary Claude rule");
  assertSharedAuthorStance(rule, "Ordinary Claude rule");
  assertUserResponsePolicy(rule, "Ordinary Claude rule");
  for (const instruction of USER_RESPONSE_POLICY) assert.ok(rule.includes(instruction), "Claude rule must use the canonical communication policy");
  assert.equal((rule.match(/^## Author stance$/gmu) ?? []).length, 1, "Ordinary Claude uses one shared author section");
  assert.match(rule, /real paper and webpage reading tools/iu);
  assert.match(rule, /search snippets can guide discovery/iu);
  assert.match(rule, /do not replace unretrieved paper or webpage content with shell, `curl`, or ad hoc fetch substitutes/iu);
  assert.match(rule, /Record concise natural-language notes in `\.dove\/install\/DOCTOR\.md` only for explicit feedback about Dove itself or actual Dove integration, routing, Skill, document, or guidance failures/iu);
  assert.match(rule, /Preserve reusable ordinary research or collaboration experience as Lessons instead/iu);
  assert.doesNotMatch(rule, /hidden `dove-intake`|dove-intake|UserPromptSubmit.*zero-write|Stop hook|Stop-hook|Stop does not drive|plain-language rendering path|说人话/iu);
  assert.doesNotMatch(rule, /dove-paper-search|hosted `exa`|built-in `WebFetch`|built-in `WebSearch`|MCP|severity fields|fixed template|Do not ask the user to run `dove doctor`/iu);
  assert.doesNotMatch(entries.map((entry) => entry.destinationPath).join("\n"), /dove-intake/iu);
  assert.doesNotMatch(rule, /dove-lessons-intake|manage_dove|public Dove MCP|semantic ID/iu);
  assert.match(paperSearch, /user-invocable: false/u);
  assert.match(paperSearch, /Search, verify metadata, retrieve, and read academic papers through the pinned dove-paper-search project MCP/iu);
  assert.match(paperSearch, /academic paper discovery, metadata verification, retrieval, or full-text reading materially helps/iu);
  assert.match(paperSearch, /get_crossref_paper_by_doi/u);
  assert.match(paperSearch, /direct lookup before fuzzy title search/iu);
  assert.match(paperSearch, /verified, conflict, not-found, or unknown/iu);
  assert.match(paperSearch, /Metadata identity is not full-text inspection or claim support/iu);
  assert.match(paperSearch, /use_scihub: false/u);
  assert.match(paperSearch, /current host actually exposes and current user\/project permissions permit/iu);
  assert.match(paperSearch, /academic paper discovery, metadata lookup, download, or full text was not obtained through `dove-paper-search`/iu);
  assert.match(paperSearch, /choose any exposed and permitted material or action that can still advance the question: `WebSearch` discovery snippets, Exa ordinary webpage\/documentation\/venue\/known-URL text when exposed, local project material, user-provided material, theory, experiment, or analysis/iu);
  assert.match(paperSearch, /Do not install dependencies or substitute a CLI, shell, `curl`, or ad hoc fetch script for this MCP, and do not follow a fixed substitute sequence/iu);
  assert.match(paperSearch, /Use built-in `WebSearch` for discovery when appropriate/iu);
  assert.match(paperSearch, /project `exa` MCP for ordinary webpages and known URLs/iu);
  assert.doesNotMatch(paperSearch, /WebFetch/iu);
  assert.match(webReader, /user-invocable: false/u);
  assert.match(webReader, /hosted Exa project MCP/iu);
  assert.match(webReader, /ordinary webpage body retrieval, documentation page reading, venue page reading, crawling, or a known URL materially helps/iu);
  assert.match(webReader, /built-in `WebSearch`/iu);
  assert.match(webReader, /built-in `WebFetch`/iu);
  assert.match(webReader, /`exa` hosted project MCP/iu);
  assert.match(webReader, /ordinary webpage bodies, documentation pages, venue pages, and known URLs/iu);
  assert.match(webReader, /current host actually exposes and current user\/project permissions permit/iu);
  assert.match(webReader, /ordinary webpage body, documentation page, venue page, or known URL was not obtained through Exa/iu);
  assert.match(webReader, /choose any exposed and permitted material or action that can still advance the question: `WebSearch` discovery snippets, `dove-paper-search` academic paper discovery\/download\/full text when exposed, local project material, user-provided material, theory, experiment, or analysis/iu);
  assert.match(webReader, /Do not use CLI, shell, `curl`, Node\/Python fetch scripts, or built-in `WebFetch` instead, and do not follow a fixed substitute sequence/iu);
  assert.deepEqual(PAPER_SEARCH_MCP_FRAGMENT, {
    type: "stdio",
    command: "uvx",
    args: ["--from", PAPER_SEARCH_PACKAGE_SPECIFIER, "paper-search-mcp"]
  });
  assert.equal(Object.hasOwn(PAPER_SEARCH_MCP_FRAGMENT, "env"), false);
  assert.deepEqual(EXA_MCP_FRAGMENT, {
    url: "https://mcp.exa.ai/mcp",
    type: "http"
  });
  assert.equal(WEB_FETCH_DENY_PERMISSION, "WebFetch");

  for (const entry of generatedAdapterEntries()) {
    if (entry.hostId === "claude") {
      assert.doesNotMatch(entry.content, /^## (?:Shared researcher judgment|Author stance)$/mu, "Claude commands must not duplicate the ambient sections");
      continue;
    }
    assertSharedResearchJudgment(entry.content, `${entry.command.id} DSH projection`);
    assert.doesNotMatch(entry.content, /\.claude\/rules|claude --agent|ambient rule/iu, "DSH must not depend on Claude-only researcher context");
    assert.equal((entry.content.match(/^## Research judgment$/gmu) ?? []).length, 1, "DSH uses one compact shared section");
    assertUserResponsePolicy(entry.content, `${entry.command.id} DSH projection`);
    for (const instruction of USER_RESPONSE_POLICY) assert.ok(entry.content.includes(instruction), "DSH must use the canonical communication policy");
    if (entry.command.id === "dove.status") {
      assert.match(entry.content, /For Status.*only to inspect and report.*do not execute research actions or maintain documents/isu);
      assert.doesNotMatch(entry.content, /^## Author stance$|first try any feasible in-mainline|perform the feasible next in-scope step|Maintain Dove research Markdown/mu, "Status must not receive author execution or maintenance duties");
    } else {
      assertSharedAuthorStance(entry.content, `${entry.command.id} DSH projection`);
      const authorSection = entry.content.split("## Author stance\n")[1].split(/\n## /u)[0];
      assert.doesNotMatch(authorSection, /Maintain Dove research Markdown|Author-side Review is Dove's own/iu, "Compact author context leaves specialist recording and review operations to the capability");
    }
  }
}

export function assertPackagedAgentPolicy() {
  const agentText = renderClaudeDoveAgent();
  assert.ok(USER_RESPONSE_POLICY.length > 0);
  assertDoveAgentSurfaceSemantics(agentText, "Packaged Dove agent");
  assertSharedResearchJudgment(agentText, "Explicit and bounded Dove agent");
  assertSharedAuthorStance(agentText, "Explicit and bounded Dove agent");
  assertUserResponsePolicy(agentText, "Explicit and bounded Dove agent");
  for (const instruction of USER_RESPONSE_POLICY) assert.ok(agentText.includes(instruction), "Dove agent must use the canonical communication policy");
  assert.match(agentText, /explicit main research agent.*--agent dove.*bounded independent subagent.*do not delegate work needing the full user conversation, important clarification, or ongoing author-side mainline ownership/isu);
  assert.doesNotMatch(agentText, /actual Skill call to `dove:review`|latest material state receives a current Review `PASS`|Review gate/iu);
  assert.doesNotMatch(agentText, /Keep three primary roles distinct|Planner frames|Builder\/Author performs|Reviewer returns/iu);

  const reviewer = renderDoveReviewerStanceSection();
  const prompt = `${renderDoveSharedResearchContractSection()}\n\n${reviewer}`;
  assertReviewerPrompt(prompt, "Shared judgment + reviewer stance");
  assertSemanticDeletionsRejected(prompt, "Reviewer prompt", assertReviewerPrompt, [
    /core proposition/iu,
    /comparison that cannot identify the contribution/iu,
    /only to judging the frozen materials/iu,
    /Do not establish missing grounding through new research/iu,
    /read-only and limited to the listed frozen materials/iu,
    /instead of fetching, inferring, or obtaining unlisted context/iu,
    /not only a diff/iu,
    /cosmetic-only changes/iu,
    /selective evidence/iu,
    /hiding counterevidence/iu,
    /unjustified narrowing/iu,
    /restarting the reviewer context/iu,
    /does not rewrite failure of an earlier proposition/iu,
    /within its requested scope/iu
  ]);
}

function assertReviewerPrompt(prompt, label) {
  assertSharedResearchJudgment(prompt, label);
  for (const pattern of [
    /shared theory, validity, and action-selection principles only to judging the frozen materials and recommending author-side work/iu,
    /Do not establish missing grounding through new research, run diagnostics, execute experiments, or perform author revisions/iu,
    /Reconstruct and challenge the contribution from the frozen materials.*do not inherit or endorse the author's mainline/isu,
    /read-only and limited to the listed frozen materials/iu,
    /Do not use.*web tools, shell commands, Edit, Write, Bash, MCP, or any unlisted path/isu,
    /not include enough venue rules, literature grounding, or task.identity material[^.\n]*judgment is limited instead of fetching, inferring, or obtaining unlisted context/iu,
    /listed materials[^.\n]*do not include[^.\n]*task.identity material[^.\n]*judgment is limited[^.\n]*instead of fetching, inferring, or obtaining unlisted context/iu,
    /complete current manuscript.*not only a diff/isu,
    /cosmetic.only changes[^.\n]*selective evidence[^.\n]*hiding counterevidence[^.\n]*unjustified narrowing[^.\n]*diff.only review[^.\n]*restarting the reviewer context/iu,
    /favorable recommendation[^.\n]*current frozen task and claims[^.\n]*does not rewrite failure[^.\n]*earlier proposition[^.\n]*authorize a different author.side mainline/iu,
    /does the method answer the research question.*correct for the field.*fit the target venue.*strongest reasonable objection/isu,
    /Keep a bounded local review within its requested scope/iu,
    /Verdict, Blocking issues, Grounding basis, and Author-side next actions/iu
  ]) assert.match(prompt, pattern, `${label}: reviewer boundary ${pattern}`);
  assert.doesNotMatch(prompt, /^## Author stance$|After delegation|synthesizes decisive evidence|first try any feasible in-mainline|perform the feasible next in-scope step|Maintain Dove research Markdown|proportionate scope of work|When implementing|Report relevant completion facts/mu);
  assert.doesNotMatch(prompt, /(?:read|load|consult|fetch)[^.\n]*Lessons|\.dove\/research\/lessons\//iu, `${label}: frozen review must not acquire Lessons-reading duties`);

}

export function assertPublicDocumentationBoundaries() {
  const usage = fs.readFileSync(path.join(ROOT, "docs/USAGE.md"), "utf8");
  const capabilityMatrix = fs.readFileSync(path.join(ROOT, "docs/CAPABILITY_MATRIX.md"), "utf8");
  const packaging = fs.readFileSync(path.join(ROOT, "docs/PACKAGING.md"), "utf8");
  for (const document of [usage, capabilityMatrix]) {
    assert.match(document, /current research direction|current full paper|confirmed goal|research goal|Workspace mainline/iu);
    assert.match(document, /same Dove agent|same Dove|one complete Dove agent|one complete Dove persona|one research agent/iu);
    assert.match(document, /Review.*advisory|advisory.*Review|Review findings?.*evidence|returned review.*evidence|not independent external review/isu);
    assert.match(document, /goal is (?:reached|achieved)|no effective in-scope path|stops? when|keeps working while another useful in-scope step/isu);
    assert.match(document, /dove(?:\.|:)figure|Figure capability|Figure.*materially improve|figure.*material evidence|draw or revise figures/iu);
    assert.match(document, /dove run|run receipts|\.dove\/runs/iu);
    assert.doesNotMatch(document, /documented or recovered mainline|recovers the current mainline|Review-gated|Auto-gate|latest current `PASS`|actual `dove:review` call/iu);
  }
  assert.match(usage, /real manuscript context|manuscript layout|check(?:s|ing)? the result in its real manuscript context/iu);
  assert.match(usage, /generation.*revision.*checking|best available tool|draw.*generate.*revise.*inspect/isu);
  assert.match(usage, /LaTeX source/iu);
  assert.match(usage, /unless the target venue requires another format|venue.*(?:does not provide or accept|lacks|required|requires).*LaTeX/isu);
  assert.match(packaging, /generated adapters/iu);
  assert.match(packaging, /release validation/iu);
  assert.match(packaging, /run receipt behavior|\.dove\/runs|dove run/iu);
  assert.match(packaging, /cannot prove that Dove chose or performed the right research action/iu);
  assert.doesNotMatch(packaging, /Review gate|actual `dove-review` actually ran|runtime Skill call/iu);
}

export function assertUserFacingCliOutput() {
  const homeCurrent = renderDoveHome({ state: "current" });
  const homeNeedsSync = renderDoveHome({ state: "needs-sync" });
  assert.match(homeCurrent, /完整科研 agent/iu);
  assert.match(homeCurrent, /进入支持的宿主后直接提出科研请求/u);
  assert.match(homeNeedsSync, /Dove 项目集成需要更新/u);
  assert.match(homeNeedsSync, /dove update/u);
  assert.doesNotMatch(`${homeCurrent}\n${homeNeedsSync}`, /dove sync|\/dove:workspace/u);

  const initOutput = renderProjectIntegrationResult("init", {
    status: "initialized",
    target: "/workspace/example-project",
    hosts: ["claude"],
    writtenPaths: [],
    removedPaths: [],
    changedPaths: []
  });
  assert.match(initOutput, /Dove agent 与 9 个可选专项入口已安装/u);
  assert.match(initOutput, /9 个可选专项入口已安装/u);
  assert.match(initOutput, /直接提出科研请求/u);
  assert.match(initOutput, /SessionStart hook 与 WebFetch 禁用/u);
  assert.match(initOutput, /普通网页 Exa MCP/u);
  assert.match(initOutput, /WebSearch 保留用于搜索发现，WebFetch 由项目权限禁用/u);
  assert.doesNotMatch(initOutput, /12 个 Dove 工作入口|Dove-only MCP 批准|\/dove:workspace/u);

  const updateOutput = renderProjectIntegrationResult("update", {
    status: "updated",
    target: "/workspace/example-project",
    hosts: ["claude"],
    writtenPaths: [],
    removedPaths: [],
    changedPaths: []
  });
  assert.match(updateOutput, /Dove 能力入口和已选宿主接入已刷新/u);
  assert.doesNotMatch(updateOutput, /内置 Lessons 已刷新|dove sync|Dove-only MCP 批准/u);

  const dshOutput = renderProjectIntegrationResult("init", {
    status: "initialized",
    target: "/workspace/example-project",
    hosts: ["dsh"],
    writtenPaths: [],
    removedPaths: [],
    changedPaths: []
  });
  assert.match(dshOutput, /DSH 项目级 filesystem Skills 已安装/u);
  assert.match(dshOutput, /DSH 不提供 Claude slash 命令、Hooks 或 MCP 声明/u);
  assert.doesNotMatch(dshOutput, /Claude 提示钩子|WebFetch 禁用|Exa MCP|dove-paper-search|重新进入 Claude Code/u);
}

function researchState(relativePath, content = null) {
  const bytes = content === null ? null : Buffer.from(content, "utf8");
  return {
    relativePath,
    exists: bytes !== null,
    type: bytes === null ? "absent" : "file",
    bytes,
    text: content,
    sha256: null,
    mode: bytes === null ? null : 0o644
  };
}

export function assertResearchDefaultsOwnership() {
  const retiredTopLevelLessons = ".dove/research/LESSONS.md";
  const retiredAdditionalLessons = ".dove/research/lessons/additional-lessons.md";
  assert.equal(Object.hasOwn(RESEARCH_DEFAULT_PATHS, "retiredTopLevelLessons"), false, "Retired top-level Lessons must not remain in the public default-path API");
  assert.equal(Object.hasOwn(RESEARCH_DEFAULT_PATHS, "additionalLessons"), false, "Retired additional Lessons must not remain in the public default-path API");
  assert.deepEqual(RESEARCH_DEFAULT_DOCUMENTS.map((document) => document.path), [RESEARCH_DEFAULT_PATHS.overview]);
  assert.deepEqual(RESEARCH_DEFAULT_DIRECTORY_PATHS, [RESEARCH_DEFAULT_PATHS.root]);
  assert.deepEqual(RESEARCH_LESSON_TOPICS, []);

  const defaults = new Map(RESEARCH_DEFAULT_DOCUMENTS.map((document) => [document.path, document.content]));
  const overviewDefault = defaults.get(RESEARCH_DEFAULT_PATHS.overview);
  assert.match(overviewDefault, /^# Research/mu);
  assert.match(overviewDefault, /researcher-owned entry/iu);
  for (const relativePath of [
    RESEARCH_DEFAULT_PATHS.missionsSummary,
    RESEARCH_DEFAULT_PATHS.experimentsSummary,
    RESEARCH_DEFAULT_PATHS.sourcesSummary,
    RESEARCH_DEFAULT_PATHS.reviewsSummary,
    RESEARCH_DEFAULT_PATHS.claimsSummary,
    RESEARCH_DEFAULT_PATHS.lessonsSummary,
    RESEARCH_DEFAULT_PATHS.decisionMaking,
    RESEARCH_DEFAULT_PATHS.researchMethod,
    RESEARCH_DEFAULT_PATHS.experimentsAndEvidence,
    RESEARCH_DEFAULT_PATHS.engineeringAndValidation,
    RESEARCH_DEFAULT_PATHS.writingAndReview,
    RESEARCH_DEFAULT_PATHS.collaborationAndEnvironment
  ]) assert.equal(defaults.has(relativePath), false, `${relativePath} must not be a mandatory installed research default`);

  const absentStates = new Map(RESEARCH_DEFAULT_DOCUMENTS.map((document) => [document.path, researchState(document.path)]));
  const bootstrapPlan = planResearchDefaults({ states: absentStates });
  assert.deepEqual([...bootstrapPlan.writes.keys()], [RESEARCH_DEFAULT_PATHS.overview]);
  assert.equal(bootstrapPlan.writes.get(RESEARCH_DEFAULT_PATHS.overview).toString("utf8"), overviewDefault);
  assert.deepEqual([...bootstrapPlan.deletes], []);

  const researcherOverview = "# My research\n\nProject-owned mainline.\n";
  const researcherMissions = "# My missions\n\nProject-owned summary.\n";
  const researcherLessons = "# My lessons\n\nProject-owned guidance.\n- [Additional migrated Lessons](additional-lessons.md)\n";
  const staleTopic = "# Old built-in topic\n\nOutdated package doctrine.\n";
  const states = new Map(RESEARCH_DEFAULT_DOCUMENTS.map((document) => [document.path, researchState(document.path)]));
  states.set(RESEARCH_DEFAULT_PATHS.overview, researchState(RESEARCH_DEFAULT_PATHS.overview, researcherOverview));
  states.set(RESEARCH_DEFAULT_PATHS.missionsSummary, researchState(RESEARCH_DEFAULT_PATHS.missionsSummary, researcherMissions));
  states.set(RESEARCH_DEFAULT_PATHS.lessonsSummary, researchState(RESEARCH_DEFAULT_PATHS.lessonsSummary, researcherLessons));
  states.set(RESEARCH_DEFAULT_PATHS.decisionMaking, researchState(RESEARCH_DEFAULT_PATHS.decisionMaking, staleTopic));
  states.set(retiredTopLevelLessons, researchState(retiredTopLevelLessons, "retired"));
  states.set(retiredAdditionalLessons, researchState(retiredAdditionalLessons, "migrated"));
  states.set(RESEARCH_DEFAULT_PATHS.importedLessons, researchState(RESEARCH_DEFAULT_PATHS.importedLessons, "imported"));

  const plan = planResearchDefaults({ states });
  assert.equal(plan.writes.size, 0, "Existing .dove/research/** must remain researcher-owned and untouched during sync");
  assert.equal(plan.deletes.size, 0, "Research sync must not delete retired or optional researcher-visible materials");

  const replacePlan = planResearchDefaults({ states }, { mode: "replace" });
  assert.deepEqual([...replacePlan.writes.keys()], [RESEARCH_DEFAULT_PATHS.overview]);
  assert.equal(replacePlan.writes.get(RESEARCH_DEFAULT_PATHS.overview).toString("utf8"), overviewDefault);
  assert.deepEqual([...replacePlan.deletes], []);
}

export function assertTrellisSpecMirrors() {
  const sourceDir = path.join(ROOT, ".trellis/spec/frontend");
  const templateDir = path.join(ROOT, "src/templates/markdown/spec/frontend");
  const sourceNames = fs.readdirSync(sourceDir).filter((name) => name.endsWith(".md")).sort();
  const templateNames = fs.readdirSync(templateDir).filter((name) => name.endsWith(".md")).sort();
  assert.deepEqual(templateNames, sourceNames);
  for (const name of sourceNames) assert.ok(fs.readFileSync(path.join(templateDir, name)).equals(fs.readFileSync(path.join(sourceDir, name))), name);
  const component = fs.readFileSync(path.join(sourceDir, "component-guidelines.md"), "utf8");
  const exclusion = component.match(/(?:Do not|Never) (?:supply|provide)[^\n]*private transcripts[^\n]*/iu)?.[0]?.split(/\.\s/u)[0];
  assert.ok(exclusion, "component guidance must exclude private author materials from independent review");
  for (const pattern of [/author.side old Reviews/iu, /settings/iu, /CLAUDE\.md/iu, /hidden notes/iu, /unlisted files/iu]) {
    assert.match(exclusion, pattern, `review material exclusion ${pattern}`);
  }
  assert.doesNotMatch(exclusion, /by default|normally|unless/iu, "private-material exclusions must not become optional defaults");
}
