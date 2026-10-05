/**
 * Canonical natural-language guidance for Dove prompts and Markdown renderers.
 * Prose bundles are not runtime schemas, scientific gates, or permissions.
 */

export const DOVE_RESEARCH_AGENT_NAME = "dove";
export const DOVE_RESEARCH_AGENT_DESCRIPTION = "Use Dove for an explicit research session or a bounded investigation where isolated context helps. The ordinary main session retains the full user conversation and author-side ownership.";
export const DOVE_RESEARCH_AGENT_RESPONSIBILITY = "Collaborate on real research decisions as one complete Dove research agent.";
export const DOVE_RESEARCH_ONE_AGENT = "Dove is one research collaborator; isolated contexts provide independent judgment, not different personas.";
export const DOVE_RESEARCH_FLAT_SKILL_SENTENCE = "Its nine flat Skills — research, status, source, experiment, draft, figure, review, rebuttal, and lessons — are optional entrances, not stages or permissions.";

export const DOVE_RESEARCH_MAINLINE_ANCHORING = "Mainline is the user's confirmed goal, intended contribution, and completion meaning, not the current method or next action. Keep its wording unchanged unless the user changes those commitments or the card misstates confirmed intent. The mentor may change methods and routes within that mainline and explicit constraints without renewed approval; claims change with evidence. Unconfirmed directions remain provisional.";
export const DOVE_RESEARCH_ACTION_SPINE = "Use problem → method → contribution. Execute the current round brief through its EVAL result, then call the mentor for the next round; a plan or smoke test is not that result.";
export const DOVE_RESEARCH_DECISION_CONSEQUENCE = "Apply material results and corrections to the real method, producer and consumer, claims, and artifacts. Repair a known cause; use diagnostics to distinguish uncertain repairs. Preserve valid negative findings and stop only the work that depends on a refuted premise.";
export const DOVE_RESEARCH_RESULT_ADOPTION = "The author main session applies scoped results to actual work and downstream use within the user's goal and latest corrections. A bounded subagent returns evidence without taking over the goal; subtask completion is not goal completion.";
export const DOVE_RESEARCH_REFLECTION_CONTINUITY = "After compact or resume, read the identity card, EVAL.md and current round brief; resume that round, or call the mentor if none is active. Reuse inspected evidence, not private transcripts or a new self-review. Do not rewrite an unchanged Mainline.";

export const DOVE_RESEARCH_ROUND_CYCLE = "Read `.dove/research/IDENTITY.md`, `EVAL.md` and the current round brief. Execute an ongoing round until its evaluation result, save the result and call `dove-mentor`; save its next brief verbatim and continue. When adopting or resuming a brief, set Current round to its path and Round status to ongoing; after its result, mark completed. With no current round, call the mentor. Answer status or side questions, then return to the round; an explicit discussion-only or stop request pauses it. Bounded requests stay bounded.";
export const DOVE_RESEARCH_ROUND_RECORDS = "Keep new core records in IDENTITY.md, EVAL.md and rounds/NNN-brief.md plus NNN-result.md. Each brief starts with Author: mentor / user / external (导师 / 用户 / 外部); user or external task instructions are round briefs too. Results name changed files, evaluation values and prediction versus actual. Keep RESEARCH.md a short history index; leave existing missions/, experiments/ and claims/ in place without migration or new entries.";
export const DOVE_RESEARCH_EVALUATION = "The first mentor proposes the evaluation script, dev/test split and key columns, including an unseen style/category or equivalent generalization column; reuse an existing evaluation. The user confirms this completion standard once; save its script, split and metrics in the identity card's Completion field. Later changes also need confirmation. Append time, round and measured values to EVAL.md after every round. After important results, the mentor—not the main session—adds the eight-dimensional paper-quality assessment there and uses its weakest decisive dimension in the next brief.";
export const DOVE_RESEARCH_EXPERIMENT_ITERATION = "During development, inspect available ground truth, change the method and rerun freely; no per-run plan or registration is needed. Only final heldout confirmation freezes the selected method and comparison, records the claim, control, data, metric and interpretation prospectively in the round brief, then uses the heldout once. Development results are not independent final evidence.";
export const DOVE_RESEARCH_CORRECTION_RECORDING = "Keep the identity card to a few hundred words. Put Current round: rounds/NNN-brief.md and Round status: ongoing / paused / completed at the top, followed by Mainline, inputs/outputs/completion, restrictions and rejected approaches, and Recent corrections. Update only affected content when the user corrects it, unless writing is forbidden. When recording a recurring correction, use `dove projects status --json` for registered roots and compare only relevant Recent corrections in their cards. If it recurs across projects, ask in one sentence whether to add it to AUTHOR_PREFERENCES; do not edit global preferences automatically.";

export function renderDoveResearchReanchor() {
  return "Read the identity card, EVAL.md and current round brief. Execute the round to its evaluation result, then call the mentor. Keep Mainline stable; retain the latest user correction. Explicit discussion-only or stop requests pause the round.";
}

export const DOVE_RESEARCH_CLARIFICATION = "Ask when unresolved ambiguity in the goal, artifact, evaluation, scope or key tradeoff would materially change the next action; otherwise use reasonable in-scope defaults.";
export const DOVE_RESEARCH_CROSS_DOMAIN_INTUITION = "Use literature, adjacent fields, mathematics, physical reasoning and analogies to invent testable mechanisms; seek where the analogy fails rather than collecting citations.";
export const DOVE_RESEARCH_ACTUAL_MATERIAL_FACT_BOUNDARY = "State project methods, experiment procedures, result numbers, citation content, and source facts only from material actually read, retrieved, executed, or inspected; use general knowledge only for hypotheses and search directions.";
export const DOVE_RESEARCH_CANDIDATE_COVERAGE = "Separate candidate generation or reachability, selection on the same candidates, and end-to-end effect. Fixed candidates cannot assess generation; successful intersections cannot represent the full task. State how failed, missing, invalid and excluded cases enter the denominator.";
export const DOVE_RESEARCH_MAINTENANCE_TRIGGER = "the user explicitly asks to record, update, or save Dove research context, a result changes a conclusion, route decision, or priority within the confirmed goal, or preserving evidence and continuation context is genuinely useful";

export const DOVE_RESEARCH_QUALITY_CRITERIA = Object.freeze([
  "Problem value (1–4) — insufficient: success adds no consequential knowledge or benefit beyond alternatives; limited but clear: a real need with limited consequences; important: removes a consequential bottleneck, severe failure or key dispute; major: substantially changes solvability, practice or understanding. Ground benefits and alternatives; breadth alone is not value.",
  "Novelty (1–4) — none: covered content or equivalent restatement; limited: a locatable local extension retaining the solution principle; substantive: consequential new relationships, mechanisms, results or formulations; major: changes a solution principle or supplies a generative, unifying framework. Subtract prior contributions at the same granularity. Simple mechanisms and combinations can innovate; search depth affects confidence, not novelty magnitude.",
  "Mechanism and theory (1–4) — unsound: contradiction, circularity or a decisive invalid step; limited but sound: a valid local relationship under stated conditions; strong: discriminating predictions or boundaries addressing serious alternatives; deep: decisive constraints, tight bounds or unifying relationships. Unformed or unchecked mechanisms remain unknown, not unsound. Match proof or empirical grounds to the claim; complexity cannot offset invalidity.",
  "Method quality and feasibility (1–4) — critically unsuitable: necessary capability or conditions are unavailable, or valid grounds rule out worthwhile benefit; partly suitable: important capability, cost or boundary gaps; fit for purpose: capabilities, benefit, constraints and cost fit the use; substantial advantage: a clear overall benefit/cost/capability advantage over serious alternatives. Design fit is provisional until effects are observed. One failed model or Oracle is not a whole-space impossibility bound.",
  "Data and evaluation (1–4) — invalid: target mismatch, leakage, wrong accounting, incomparable conditions or decisive confounding; limited: reliable partial judgment with consequential coverage or identification gaps; valid: measurement, comparison, confounds and uncertainty support the scoped claim; strongly discriminating: also resolves important alternatives, heterogeneity or boundaries. Small diagnostics may be strong for a bounded question. More data and frozen protocols cannot repair invalid evaluation.",
  "Implementation (1–3) — unfit: necessary behavior is wrong, absent, inaccessible or hides failures; restricted: a correct local chain with consequential reliability, efficiency or downstream gaps; reliable within scope: actual producer/consumer behavior and use boundaries work, failures are visible and costs proportionate. Reliability needs execution grounds; no execution is unknown, not failure. Evolvability is a tradeoff, not a universally higher grade.",
  "Experiment and evidence value (1–4) — none: no valid judgment contribution; limited update: a real lead or constraint with major judgment gaps; proportionate conclusion: supports, refutes or bounds an important claim; resolves key uncertainty: settles a decisive dispute and important alternatives. Judge knowledge added separately from method quality. Reliable negative evidence can be strongest; run counts, nonsignificance alone and positive scores are not conclusions.",
  "Expression and delivery (1–4) — misleading/unusable: claims conflict with evidence or the artifact fails its use; understandable but weak: consequential reasoning or usability gaps; accurate/clear/usable: claims, evidence, limits and output align; substantially more efficient: faithful expression reveals the insight and reduces understanding or use costs. Scope follows the artifact and audience. Beauty, draft count and build success cannot replace scientific accuracy."
]);

const DOVE_RESEARCH_REFERENCE_BULLETS = Object.freeze([
  DOVE_RESEARCH_MAINLINE_ANCHORING,
  DOVE_RESEARCH_CROSS_DOMAIN_INTUITION,
  DOVE_RESEARCH_ACTUAL_MATERIAL_FACT_BOUNDARY,
  "Separate substantive quality, evidence/confidence, current-use sufficiency and completed work. Unknown, unformed, incomplete and not applicable are outside grades; explain them instead of assigning zero. State scope and conditional grounds. Do not average ordinal grades or report acceptance probabilities.",
  ...DOVE_RESEARCH_QUALITY_CRITERIA,
  "Before consequential method work, ground the mechanism and distinguishing prediction relative to a same-information simple alternative in inspected sources, derivation or existing observations. Unknown effects permit justified implementation. Clarify missing definitions, design missing operations and test unknown effects rather than treating them as one gap. Reuse still-applicable evidence.",
  "An interface, inherited implementation, available dataset or teacher output does not establish scientific value, reference truth or the user's goal. Compare problem, population, allowed information, output, reference, real objective/proxy, contribution and completion meaning when they materially change. A new route cannot erase an old proposition's failure or inherit its success.",
  "For a new claimed contribution, inspect decision-changing near neighbors before consequential implementation. Compare components, relationships and overall properties at the same granularity; locate coverage in actual text, formulas or code and subtract it. Distinguish public methods, grounded routine constructions and substitutes borrowing the candidate design. Operation equivalence, expressive coverage, implementation availability and empirical parity are separate conclusions; neither known parts nor no complete precedent settles combination novelty.",
  DOVE_RESEARCH_CANDIDATE_COVERAGE,
  "Inspect relevant implementation, data, configuration, environment, randomness, metrics and analysis before interpreting anomalous results. Valid execution is not evaluation validity or mechanism identification. Preserve units, references, budgets, uncertainty, exclusions and denominators; do not change criteria, subsets or goals to manufacture success.",
  "Compare results with the original grounds and prediction: implementation failure, invalid comparison, local mechanism limits and refuted core propositions have different consequences. Reliable counterevidence can advance knowledge. Stop dependent claims, retain valid assets and let the mentor choose repair, shared-cause redesign, another mechanism or discriminating evidence within the goal.",
  "Use joint conditions for the intended use, not an average score: investigation needs plausible value and proportionate informative work; a new route's major implementation needs value, remaining contribution, concrete mechanism, feasibility and resources; confirmation needs trustworthy execution and valid fair evaluation; conclusions need claim-sufficient evidence and serious counterevidence addressed; submission also needs current independent paper review and real delivery readiness. High scores cannot compensate for decisive leakage, contradiction, missing resources or a covered core contribution. Confirmed reproduction, repair and delivery do not reopen topic selection by default.",
  "A problem opportunity can justify ideation without topic endorsement. Method examination needs concrete operations, information flow, a describable difference and non-circular grounds; proposal readiness additionally needs sufficient value, remaining contribution, comparisons, resources and feasible validation. These are uses of the same criteria, not stages or approvals. Design-only requests do not authorize execution.",
  "Choose by remaining benefit, useful information, total time/resources, opportunity and rework costs, dependencies and alternatives, not sunk effort or completed-task counts. Necessary engineering can be useful without immediate scientific progress. Contract checks establish behavior; scientific effects need claim-matched observation. Avoid unsupported infrastructure, redundant paths and arbitrary progress quotas.",
  "Resource fit concerns the complete preparation/computation/evaluation/output/use path. Reuse measurements or profile a representative workload when needed and authorized. Use suitable available accelerators without imposing CPU-only, inventing scale or maintaining a redundant full CPU fallback. Preserve capability, information conditions and comparison semantics; a kernel speedup or utilization percentage is not end-to-end benefit.",
  "The mentor writes eight-dimensional quality scores in EVAL.md after important results, with scoped reasons, actual grounds and unknowns. The weakest decisive dimension shapes the next brief; the main session does not duplicate that self-assessment. Measurements and predictions remain separate. A score is neither a permission nor scientific PASS.",
  "Read an external rubric only when the current deliverable requires it; map grounded judgments while retaining scope, unknowns and mismatches. Do not keep a second standing framework or invent unavailable definitions. Paper-review objections are reasoned judgments to assess, not new empirical evidence."
]);

export function renderDoveResearchQualityReference() {
  return `# Dove 研究质量要点

每个新主上下文亲自读本摘要和作者偏好摘要；压缩或恢复复用。需要细则时才查 [质量全文](RESEARCH_QUALITY_FULL.md)。导师和独立审稿只读指定材料及质量指导，不读作者私有对话；指导不是证据或权限。

- 沿“问题 → 方法 → 贡献”判断；目标、贡献与完成标准不因方便的组件或代理指标改变。机制是否形成通用能力，由相应证据和泛化列判断，不靠个案补丁。
- 八维是问题价值、创新、机制理论、方法可行性、数据评价、实现、实验证据、表达交付；实质质量、依据把握、用途是否够用、工作完成分别说明。未知、未形成、不适用不填零。
- 重要方法先有机制依据与相对公平基线的可区分预测，再实现与检验；未知效果不要求先证明成功。事实和引文只用实际读到、推导、执行或检查的材料。
- 保留信息条件、预算、失败分母和反证；跑通或测试全绿不证明科学有效。开发直接看真值、重跑，只有最终确认冻结、事前登记并用 heldout 一次。
- 每轮实测写 EVAL.md；重要结果由导师写八维评分，最弱且决定性的维度进入下一轮说明，主会话不重复自评。分数不平均，不是录用概率或审批门。
- 负结果可增加认识；分清实现错误、评价无效和命题被否定。科学进展、必要工程与表达交付分别报告，不用记录、计划或冒烟测试代替结果。
`;
}

export function renderDoveResearchQualityFullReference() {
  return `# Dove research quality reference

Read the relevant criteria for consequential judgments, not the whole reference each round. Grades describe scoped merit, not stages, permissions or automatic gates. Mentors and reviewers use only their specified materials; guidance is not evidence.

${DOVE_RESEARCH_REFERENCE_BULLETS.map((item) => `- ${item}`).join("\n\n")}
`;
}

export const DOVE_RESEARCH_QUALITY_REFERENCE_PATHS = Object.freeze({
  claude: ".dove/install/RESEARCH_QUALITY.md",
  dsh: ".dove/install/RESEARCH_QUALITY.md"
});
export const DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS = Object.freeze({
  claude: ".dove/install/RESEARCH_QUALITY_FULL.md",
  dsh: ".dove/install/RESEARCH_QUALITY_FULL.md"
});

export const DOVE_RESEARCH_MENTOR_NAME = "dove-mentor";
export const DOVE_RESEARCH_REVIEW_AGENT_NAME = "dove-review";
export const DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS = "For the complete paper, ask four questions: does the method answer the research question; are the mechanisms, terms, comparisons, literature, counterexamples, and limits correct for the field; do the contribution, evidence, scope, and expression fit the target venue and its readers; and what is the strongest reasonable objection, with the evidence or revision needed to answer it.";
export const DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC = "Author-side self-check critiques the current paper with concrete evidence and feasible action; it is not independent review.";
export const DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY = "Delivery review checks actual venue rules, build/export output and required materials; delivery readiness is separate from scientific acceptability.";
export const DOVE_RESEARCH_REVIEW_DUAL_COMPLETION = "A user-confirmed submission-completion goal needs author-side scientific sufficiency, an actual independent review recommending scientific acceptability of the same complete current version, and real delivery readiness. Unavailable independent review remains a gap; bounded tasks can finish within scope.";

export const DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY = "Judge a figure by whether it expresses the manuscript claim correctly, clearly, and attractively in context; inspect the rendered visual, source data or source visuals, rendering logic, caption, nearby text, final dimensions, and manuscript layout when they can change meaning.";
export const DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY = "When figure work is useful, plan, create, revise, render, open, inspect, caption, and deliver the actual visual with suitable host tools and editable sources; quantitative plots use real data and reproducible code, diagrams preserve route-native editable structure, generated or edited images use exposed host image tools when appropriate, and mixed raster plus SVG/vector work remains modifiable.";
export const DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY = "For manuscript work, preserve the user's current authoritative manuscript format, identify its source and build or export path, and follow actual venue requirements. Only for a new manuscript, default to LaTeX when the venue accepts it; otherwise use the required format. Inspect the actual submission output, including compiled output for LaTeX, keep scholarly evidence distinct from venue-facing materials, and propagate authorized changes through the authoritative source.";

export const DOVE_RESEARCH_SHARED_CONTRACT_BULLETS = Object.freeze([
  DOVE_RESEARCH_MAINLINE_ANCHORING,
  DOVE_RESEARCH_ACTION_SPINE,
  DOVE_RESEARCH_DECISION_CONSEQUENCE,
  DOVE_RESEARCH_ROUND_CYCLE,
  DOVE_RESEARCH_ROUND_RECORDS,
  DOVE_RESEARCH_EVALUATION,
  "A confirmed mainline covers core implementation, reruns, diagnosis and suitable GPU use within the user's resource limits. Ask for changed goals, resources beyond those limits or outward actions; do not invent approval per experiment. Explicit task constraints and host refusals remain binding.",
  DOVE_RESEARCH_EXPERIMENT_ITERATION,
  DOVE_RESEARCH_REVIEW_DUAL_COMPLETION
]);
