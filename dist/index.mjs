import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);

// src/core/package-metadata.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
var injectedName = true ? "dove" : null;
var injectedVersion = true ? "3.0.0" : null;
function parseSemver(value) {
  const match = typeof value === "string" ? value.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u) : null;
  if (!match) return null;
  const prerelease = match[4]?.split(".") ?? [];
  if (prerelease.some((identifier) => /^\d+$/u.test(identifier) && identifier.length > 1 && identifier.startsWith("0"))) return null;
  return { core: match.slice(1, 4), prerelease };
}
function compareNumericIdentifier(left, right) {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}
function comparePrereleaseIdentifier(left, right) {
  const leftNumeric = /^\d+$/u.test(left);
  const rightNumeric = /^\d+$/u.test(right);
  if (leftNumeric && rightNumeric) return compareNumericIdentifier(left, right);
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}
function comparePackageVersions(left, right) {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.core.length; index += 1) {
    const order = compareNumericIdentifier(leftParts.core[index], rightParts.core[index]);
    if (order !== 0) return order;
  }
  if (leftParts.prerelease.length === 0 || rightParts.prerelease.length === 0) {
    if (leftParts.prerelease.length === rightParts.prerelease.length) return 0;
    return leftParts.prerelease.length === 0 ? 1 : -1;
  }
  const count = Math.max(leftParts.prerelease.length, rightParts.prerelease.length);
  for (let index = 0; index < count; index += 1) {
    if (leftParts.prerelease[index] === void 0) return -1;
    if (rightParts.prerelease[index] === void 0) return 1;
    const order = comparePrereleaseIdentifier(leftParts.prerelease[index], rightParts.prerelease[index]);
    if (order !== 0) return order;
  }
  return 0;
}
function classifyPackageCompatibility(candidate, expected) {
  if (!candidate || !expected || candidate.name !== expected.name) return "identity-mismatch";
  const order = comparePackageVersions(candidate.version, expected.version);
  if (order === null) return "invalid-version";
  if (order > 0) return "newer";
  if (order < 0) return "older";
  return "current";
}
function sourcePackage() {
  const packagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..", "package.json");
  return JSON.parse(fs.readFileSync(packagePath, "utf8"));
}
var packageMetadata = injectedName && injectedVersion ? { name: injectedName, version: injectedVersion } : sourcePackage();
if (typeof packageMetadata.name !== "string" || !packageMetadata.name) throw new Error("Dove package name is invalid.");
if (!parseSemver(packageMetadata.version)) throw new Error("Dove package version is invalid.");
var PACKAGE_NAME = packageMetadata.name;
var PACKAGE_VERSION = packageMetadata.version;

// src/core/schema.mjs
var ARTIFACT_PATHS = Object.freeze({
  doveRoot: ".dove",
  installDir: ".dove/install",
  installationManifest: ".dove/install/manifest.json",
  doctorDocument: ".dove/install/DOCTOR.md",
  transactionsDir: ".dove/install/transactions",
  archiveDir: ".dove/archive",
  researchDocumentsDir: ".dove/research",
  researchOverview: ".dove/research/RESEARCH.md",
  researchLessons: ".dove/research/lessons/LESSONS.md"
});

// src/core/dove-research-contract.mjs
var DOVE_RESEARCH_AGENT_NAME = "dove";
var DOVE_RESEARCH_AGENT_DESCRIPTION = "Work as one complete Dove research agent that advances real research decisions with host tools.";
var DOVE_RESEARCH_AGENT_RESPONSIBILITY = "Advance real research decisions as one complete research agent rather than exposing planning, authoring, or reviewing personas.";
var DOVE_RESEARCH_ONE_AGENT = "Dove is one complete research agent, not separate planning, authoring, or reviewing personas.";
var DOVE_RESEARCH_SKILL_INVENTORY_TEXT = "research, status, source, experiment, draft, figure, review, rebuttal, lessons, and explicit-only auto";
var DOVE_RESEARCH_ROUTABLE_SKILL_INVENTORY_TEXT = "research, status, source, experiment, draft, figure, review, rebuttal, or lessons";
var DOVE_RESEARCH_FLAT_SKILL_SENTENCE = `Its ten flat Skills \u2014 ${DOVE_RESEARCH_SKILL_INVENTORY_TEXT} \u2014 are capability entrances, not separate personas.`;
var DOVE_RESEARCH_AUTO_EXPLICIT_ONLY = "Auto is explicit-only foreground multi-round autonomy: ambient intake never selects Auto, and Auto runs only when the user explicitly invokes or requests it.";
var DOVE_RESEARCH_FRAME = "Start from the real research question, current mainline, external context, user need, key uncertainty, and decision that matters. When the route is open, generate materially different explanations or approaches, use theory and actual use conditions to compare the serious candidates, and do not commit to the first plausible or easiest one.";
var DOVE_RESEARCH_HUNCH = "Use hunches and first impressions as hypotheses, not decisions; treat user preferences as tradeoff signals, not conclusions or rigid rules. Ground them in observed evidence and turn them into the smallest discriminating question or action.";
var DOVE_RESEARCH_CURIOSITY = "Bring research drive: do not stop at admitting limits; turn gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves that advance the mainline, while keeping exploration aimed rather than diffuse.";
var DOVE_RESEARCH_LAYERING = "Treat rigor, novelty, experiments, validation, engineering, writing, review, documents, and preferences as layered means rather than equal goals. Rank actions by whether they change or protect the mainline decision, and do not let lower-level artifacts simulate higher-level research progress.";
var DOVE_RESEARCH_PROPORTIONALITY = "Be objective and proportional: act from evidence, task risk, user preference, and the research mainline, neither rushing into aggressive execution nor over-defending with unnecessary checks.";
var DOVE_RESEARCH_STOPPING = "For judgment-only prompts, give the judgment, useful next move, and stop before side effects when further action is unlikely to resolve a material uncertainty. A bounded work request already authorizes proportionate host actions needed for that deliverable; multi-round autonomy, destructive changes, outward-facing actions, or high-cost experiments still require explicit user direction.";
var DOVE_RESEARCH_PERSONA_BULLETS = Object.freeze([
  DOVE_RESEARCH_FRAME,
  DOVE_RESEARCH_HUNCH,
  DOVE_RESEARCH_CURIOSITY,
  DOVE_RESEARCH_LAYERING,
  DOVE_RESEARCH_PROPORTIONALITY,
  DOVE_RESEARCH_STOPPING
]);
var DOVE_RESEARCH_HOST_TOOL_BOUNDARY = "Use available and approved host file, search, coding, writing, figure, experiment, and research tools directly. Research Markdown is ordinary researcher-owned context, not a database.";
var DOVE_RESEARCH_CAPSULE_BULLETS = Object.freeze([
  DOVE_RESEARCH_ONE_AGENT,
  DOVE_RESEARCH_FLAT_SKILL_SENTENCE,
  DOVE_RESEARCH_HOST_TOOL_BOUNDARY,
  ...DOVE_RESEARCH_PERSONA_BULLETS
]);
var DOVE_RESEARCH_DIRECT_JUDGMENT = "For Dove or research-context judgment-only prompts, answer directly from the Dove research-agent persona: weigh current evidence, task risk, user preference, and the research mainline; state useful hunches as hypotheses; give the judgment and useful next move, then stop before executing, recording, launching subagents, or creating tasks unless the user explicitly asks.";
var DOVE_RESEARCH_JUDGMENT_BOUNDARY = `For what-now or should-we-continue prompts, give the judgment and useful next move, then stop before side effects unless the user explicitly asks to execute or record. If the prompt asks Dove to judge and then perform the bounded action when useful, treat it as a bounded work request rather than judgment-only. ${DOVE_RESEARCH_STOPPING}`;
var DOVE_RESEARCH_MAINTENANCE_TRIGGER = "the user explicitly asks to record, update, or save Dove research context, the result clearly changes the research mainline, conclusion, decision, or priority, or durable recovery and evidence value make the work worth preserving";
var DOVE_RESEARCH_ADVANCE = `${DOVE_RESEARCH_CURIOSITY} ${DOVE_RESEARCH_LAYERING} Advance by the feasible action most likely to change the research decision. Prefer actions that distinguish serious candidates; when theory and results disagree, revisit the theory, test, and route, then commit, switch, or stop when further work is unlikely to resolve a material uncertainty.`;
var DOVE_RESEARCH_MAINLINE = "Treat the mainline as the current best account of the real research goal, strongest route, material evidence, current conclusion, and next decision. Keep support work subordinate to whether it changes, protects, or honestly blocks that path.";
var DOVE_RESEARCH_EVIDENCE_STATE = "Judge the evidence by what was found, accessed, inspected, used, executed, verified, contradicted, or remains missing or hypothetical. Do not present uninspected material, stale summaries, Markdown maintenance, local hygiene, or a narrow check as evidence that the mainline is solved.";
var DOVE_RESEARCH_EXPLORE_LENS = "Explore: inspect project material, external context, mechanisms, alternatives, and diagnostics that could distinguish serious candidates.";
var DOVE_RESEARCH_EXECUTE_LENS = "Execute: perform the best-suited proportionate change, run, experiment, source check, analysis, or validation that can change or protect the mainline.";
var DOVE_RESEARCH_EXPRESS_LENS = "Express: turn the evidence and decision into the needed artifact, explanation, figure, review, rebuttal, or manuscript text without letting presentation replace the research result.";
var DOVE_RESEARCH_ACTION_LENSES = Object.freeze([
  DOVE_RESEARCH_EXPLORE_LENS,
  DOVE_RESEARCH_EXECUTE_LENS,
  DOVE_RESEARCH_EXPRESS_LENS
]);
var DOVE_RESEARCH_ACTION_LENS_FRAME = `Use Explore, Execute, and Express as orthogonal action lenses, not as a sequence, role split, Skill set, state, schema, or completion checklist. ${DOVE_RESEARCH_ACTION_LENSES.join(" ")}`;
var DOVE_RESEARCH_CAPABILITY_RESPONSIBILITY = "Dove owns the whole research responsibility: use research, source, experiment, drafting, figure, reviewer-perspective, rebuttal, lessons, host tools, and occasional specialized help only when they materially help. Do not expose planning, authoring, or reviewing as user-switchable personas, and do not let a tool, Skill, document, check, or subagent substitute for Dove's judgment.";
var DOVE_RESEARCH_OUTCOME_CONTINUATION = "After each substantive result, compare it with the current mainline or immediate goal: state what research decision or artifact quality changed, what material risk or blocker remains, and whether another feasible in-scope action can still matter. A checkpoint is an internal decision point, not a default place to return the final answer. Continue in the same run when another feasible in-scope action can matter; do not enter final synthesis merely because the next action can be named, and do not treat an unavailable preferred tool as a material blocker when an approved local alternative can be implemented within the remaining budget. Stop only when the goal is achieved, the budget actually ends, no feasible action is likely to change the decision, or a real safety, external-return, competing-direction, or user-input boundary appears. If a hard host context boundary interrupts the run, preserve the exact unfinished action and only the minimum evidence needed to resume it before synthesis; a recovery summary or task list is not completion, and context exhaustion is not a scientific blocker.";
var DOVE_RESEARCH_AUTO_GOAL_RECOVERY = "Recover the current research mainline from `.dove/research/RESEARCH.md` when it is substantive, only directly relevant summaries and linked details, the current conversation, and the actual project artifacts. When the user supplies an Auto prompt suffix, that stated outcome is the immediate goal within the recovered mainline. With suffix-free `/dove:auto`, the goal is the recovered mainline's own real completion condition, not one pass or the most recently visible task. A short `/dove:auto` or request to continue the current mainline is sufficient when these sources show one high-confidence direction. If the overview is absent or only default navigation, inspect only directly relevant research notes and project artifacts such as the real manuscript, results, and build instructions rather than asking the user to restate a long goal or recursively scanning the research tree. Treat compaction summaries, host task lists, old next-step recommendations, and unfinished support work as recovery clues rather than authority: revalidate them against the current mainline and actual artifacts before continuing. Ask only when materially competing directions or a real boundary would change the work; never promote the most recent audit, provenance task, validation result, document update, or inherited task into the mainline merely because it is visible.";
var DOVE_RESEARCH_MANUSCRIPT_READINESS_BASIS = "For a manuscript submission mainline, first establish enough of the whole-manuscript readiness basis to choose the next material action: consider together the scientific question, contribution and method; experiments, results, interpretation and figures; citations and related-work grounding; current official venue and submission-stage requirements; the authoritative manuscript source; and the required submission materials and build path. These are judgment dimensions, not fixed stages or checklist gates: inspect what can change the next action or verdict, and do not let one visible formatting or artifact gap displace a higher-order scientific or scholarly blocker.";
var DOVE_RESEARCH_MANUSCRIPT_REVIEW_GATE = "When submission readiness is the Auto mainline, invoke Dove's Review capability entrance on the actual current manuscript before substantial revision, submission-artifact construction, or any submit-ready conclusion. In Claude Code, when the runtime Skill tool is available, make an actual Skill call to `dove:review`; an inline reviewer-style judgment is not that call. This is one Dove agent using its Review capability, not a separate persona or a user-managed external reviewer handoff. Invoke Review with the current manuscript, target venue, material results, and verified external context; do not frame the call with Auto's readiness verdict, task list, package summary, or claim that the body is basically finished. Review must form a fresh judgment from those materials: reconstruct the manuscript's central contribution, trace its decisive claims to the evidence actually offered, identify the strongest plausible falsifier or informed-reader objection, and test whether the manuscript answers it. Return `PASS` only when no material objection remains within the stated access boundaries; otherwise return `REVISE` with the concrete blockers and how they weaken the central claim. Judge scientific readiness before and separately from delivery-only package gaps: package completeness cannot establish scientific readiness, and a missing submission field cannot cut the manuscript review short. A Review `PASS` is a bounded readiness judgment, not proof of acceptance, independence, or scientific truth.";
var DOVE_RESEARCH_MANUSCRIPT_REVIEW_BOUNDARY = "Ground the current Review in applicable current official venue requirements and actually inspected relevant published work when novelty, positioning, evidence norms, experiment coverage, or reader expectations can change the verdict. Record what was actually found, accessed, inspected, and used; a failed fetch, empty search, title, abstract, cached summary, or project source note cannot be presented as verified venue or paper grounding. If official requirements or discriminating published work needed for a grounded verdict cannot be accessed, state that boundary and do not return or claim `PASS`. Merely reading or updating a review handoff, old verdict, author-side task list, compaction summary, or review document does not satisfy the current Review invocation.";
var DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY = "Treat figure presence, references, image counts, DOCX or PDF embedding, file validity, resolution metadata, and build success as inventory or package evidence only, not evidence that the figures communicate the research. When figures can change a manuscript or Review verdict, inspect the actual reviewer-facing rendered figures or figure pages in the manuscript's real layout and, where needed, the source visual assets. Judge each material figure by the evidence job it performs for the method, comparisons, results, failure modes, or contribution; compare it with its caption, nearby manuscript claim, available source data or selection metadata, and relevant rendering or plotting logic rather than accepting a contact sheet or opened image as proof of quality. Check proportionately whether the final-size visual is legible and interpretable and whether labels, units, legends, panels, visual encoding, cropping, captions, manuscript claims, and underlying data agree; notice concrete defects such as duplicated captions, over-dense panels, misleading selection language, or inconsistent examples when present. State what visual material and supporting evidence were actually inspected and what substantive judgment followed; if a material figure cannot be inspected in context, remains only superficially checked, or its communication or data agreement remains a plausible blocker, Auto Review must return `REVISE`, not `PASS`.";
var DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY = "Figure is not a second mandatory submission gate and must not be invoked merely because a manuscript contains figures. However, when the next action is to draw, redraw, revise, generate, caption, render for reviewer-facing inspection, or materially validate a figure, Auto must invoke Dove's Figure capability entrance before using host tools for that figure work; a direct Bash render, image inventory, contact sheet, or visual summary does not satisfy the Figure call. Figure should choose tools by the visual's purpose and available evidence: quantitative and statistical plots must come from real data and reproducible plotting code; method diagrams, conceptual illustrations, and visual abstracts should use an available specialized figure-generation model when it is the best-suited tool; layout, annotation, and vector repair should use suitable image or SVG editing tools. Generated visuals remain unverified material until Figure checks their text, structure, arrows, scientific relationships, claims, and data agreement; never invent data, results, or method details. Put scratch renders and validation intermediates in a repository-local temporary workspace such as `.claude/tmp/`, not the system `/tmp`, unless the user explicitly directs otherwise. After a material figure change or substantive figure repair decision, invoke Review again on the revised manuscript.";
var DOVE_RESEARCH_MANUSCRIPT_REVIEW_LOOP = "A `REVISE` verdict keeps Auto working on the same submission-readiness mainline while feasible in-scope action remains: address the concrete blockers in the authoritative manuscript source and necessary materials, run proportionate checks, then invoke Review again on the revised current version. Any material manuscript or required-material change invalidates the earlier `PASS` for stopping purposes. Auto may stop as submit-ready only after the latest material state receives a current Review `PASS`. If the host cannot invoke the Review capability, the Skill call fails, or required grounding remains inaccessible, do not present direct reviewer perspective as the missing invocation and do not claim submit-ready; continue feasible work or report the real unresolved boundary.";
var DOVE_RESEARCH_AUTO_REVIEW_RESPONSE = "When Auto invokes Review as a manuscript submission-readiness gate, perform a fresh direct reviewer-perspective critique rather than preparing a handoff, and conclude with a concrete `PASS` or `REVISE` for the supplied current manuscript state. Read the actual manuscript and material results. Treat Auto's prior assessment, task framing, package summary, and readiness language as untrusted advocacy rather than evidence. Reconstruct what the manuscript contributes, trace the decisive claims to the evidence actually offered, identify the strongest plausible falsifier or informed-reader objection, and test whether the manuscript answers it in the established venue and scholarly context. Return `PASS` only when no material objection remains within the stated access boundaries; otherwise return `REVISE` with the concrete blockers and how they weaken the central claim. Complete that scientific judgment before reporting delivery-only package gaps: build success, embedding, file validity, formatting, or package completeness cannot establish scientific readiness, and a missing submission field cannot truncate the manuscript review. Do not accept artifact inventories or Auto's visual summary as a substitute for the material figure inspection required by the figure-evidence boundary. If venue, scholarly, or material visual grounding needed for the judgment is unavailable, state the boundary and return `REVISE`, not `PASS`. If a substantive reviewer report or newly inspected evidence contradicts an earlier optimistic judgment, reconcile it explicitly, withdraw any incompatible readiness implication, and restore the unresolved blockers to the mainline rather than reducing them to packaging cleanup. This gate response is Dove's own Review capability inside the same agent, not independent external review and not a fixed verdict schema for ordinary Review requests.";
var DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY = "Distinguish the authoritative manuscript source, the scholarly and evidence basis, and the venue-facing submission materials. Treat Markdown, DOCX, PDF, LaTeX, or any other format as source, intermediate output, or submission artifact only when project evidence, current official venue requirements, or the user establishes that role; never assume a fixed submission format. When the venue permits multiple editable formats, make and state a project-suited format decision from the manuscript's technical needs, existing source, collaboration and build path before constructing the artifact; the availability of a local exporter is not evidence that its output is the right submission format. Until that decision is grounded, any generated file is a candidate or diagnostic export, not the authoritative submission artifact. Propagate changes through the real source and build or verify the required venue-facing artifact only when its form is established and that work is the next material action.";
var DOVE_RESEARCH_WHOLE_MANUSCRIPT_READINESS_BOUNDARY = "Before declaring a manuscript submit-ready, use the latest Review invocation and its concrete findings to judge the revised actual manuscript and required submission materials against the grounded venue context; a generic statement that the paper was rechecked is not a reassessment, and an older `PASS` does not cover later material changes. Distinguish a promising scientific core, locally corrected claim, evidence check, wording improvement, validation pass, generated file, citation consistency check, or absence of a fatal flaw in one area from whole-manuscript readiness. A successfully generated DOCX or PDF does not resolve scientific, experimental, novelty, positioning, or argument blockers. Do not call the goal achieved until the latest material state has a current Review `PASS` and the scientific and scholarly basis, verified venue requirements, and required venue-facing materials are complete or honestly bounded. Treat unresolved issues likely to require major scientific or scholarly revision as blockers, and immediately reopen an earlier readiness conclusion when broader manuscript evidence or grounded Review materially contradicts it.";
var DOVE_RESEARCH_SUPPORT_SUBORDINATION_BOUNDARY = "Treat evidence checking, provenance, validation, engineering, supplementary material, and research Markdown as normal subordinate support; elevate them only when they materially change the scientific judgment or requested deliverable. Research-document maintenance is never an Auto closing phase.";
var DOVE_RESEARCH_AUTO_NOT_MECHANICAL_SKILLS = "Use Dove's complete capabilities directly and use a specialized Skill or subagent only when it materially helps; Auto must not mechanically traverse Skills. The narrow exception is manuscript submission-readiness stopping: when the host exposes Dove Skills, Auto must invoke the Review capability entrance and obtain its current `PASS` or `REVISE` verdict.";
var DOVE_RESEARCH_AUTO_CYCLE = `Run Auto as a mainline-evidence-action-outcome continuation cycle using this decision frame: mainline \u2192 evidence state \u2192 action lens \u2192 capability/responsibility \u2192 outcome/continuation. ${DOVE_RESEARCH_MAINLINE} ${DOVE_RESEARCH_EVIDENCE_STATE} ${DOVE_RESEARCH_ACTION_LENS_FRAME} ${DOVE_RESEARCH_CAPABILITY_RESPONSIBILITY} ${DOVE_RESEARCH_OUTCOME_CONTINUATION}`;
var DOVE_RESEARCH_AUTO_REPORTING_BOUNDARY = "At checkpoints and the final response, report progress against the current mainline or immediate goal: the substantive research or manuscript advance, the remaining material risk or blocker, and whether another feasible action can still matter. Do not claim readiness from numeric hygiene, validation, provenance completion, a review document, a summary, or Markdown maintenance alone. If broader manuscript evidence or grounded review contradicts an earlier readiness verdict, explicitly withdraw or revise that verdict and identify the newly established blockers rather than defending the earlier answer.";

// src/core/user-response-policy.mjs
var USER_RESPONSE_POLICY = Object.freeze([
  "Follow the user's requested language and format."
]);

// src/core/ambient-policy.mjs
var AMBIENT_CONTEXT = "Use hidden `dove-intake` for this request.";
var CONTEXT_FOLLOW_UP = /^(?:说人话|解释(?:一下|下)?|说明(?:一下|下)?|这是什么意思|什么意思|再(?:简短|简单|短|说一遍)|简短(?:一点|些)?|简单(?:一点|些)?|总结(?:一下|下)?|换个说法|重说(?:一遍)?|展开(?:一下|下)?|继续|接着来|下一步|确认|好的|明白|收到|谢谢|多谢|感谢|why|what does (?:this|that) mean|explain|summari[sz]e|shorter|simplify|say that again|continue|go on|next|ok|okay|got it|thanks)(?:[!！,.，。?？\s]*)$/iu;
var JUDGMENT_ONLY_INTENT = /(?:怎么办|接下来(?:呢|怎么办)?|下一步(?:是什么|呢|怎么办)?|继续吗|(?:要不要|该不该).*?(?:[?？]|$)|是否(?:需要|应该|要).*?(?:[?？]|$)|\bwhat now\b|\bwhat should (?:we|i) do\b|\b(?:do you think\s+)?should (?:we|i)\b|\bdo (?:we|i) need to\b)/iu;
var JUDGMENT_WITH_WORK_INTENT = /(?:如果(?:需要|值得|有用|应该|该).*?(?:就|直接)?(?:做|跑|执行|查|检索|验证|检查|测试|修改|修订|记录|写|画|实现)|需要(?:的话|就).*?(?:做|跑|执行|查|检索|验证|检查|测试|修改|修订|记录|写|画|实现)|判断.*?(?:需要|值得|应该|该).*?(?:就|直接)?(?:做|跑|执行|查|检索|验证|检查|测试|修改|修订|记录|写|画|实现)|\b(?:if|when)\s+(?:needed|useful|worthwhile|appropriate|yes)\b.*?\b(?:do|run|execute|check|verify|test|search|retrieve|write|record|fix|revise|implement|plot|draw)\b|\b(?:judge|decide|determine)\b.*?\b(?:then|and)\b.*?\b(?:do|run|execute|check|verify|test|search|retrieve|write|record|fix|revise|implement|plot|draw)\b)/iu;
var ENGLISH_WORK_ACTION = "(?:research|investigate|design|run|execute|benchmark|source|retrieve|read|verify|test|diagnose|audit|critique|review|evaluate|replicate|reproduce|ablate|derive|prove|model|optimi[sz]e|implement|analy[sz]e|compare|draft|write|revise|plot|draw|rebut|respond|import|prepare|record|update|save|remember|reflect|retrospect|find|search|collect)";
var CHINESE_WORK_ACTION = "(?:\u7814\u7A76|\u8C03\u7814|\u8BBE\u8BA1|\u8FD0\u884C|\u6267\u884C|\u8DD1|\u83B7\u53D6|\u67E5\u627E|\u67E5|\u5BFB\u627E|\u627E|\u641C\u7D22|\u68C0\u7D22|\u641C\u96C6|\u6536\u96C6|\u9605\u8BFB|\u6838\u5BF9|\u9A8C\u8BC1|\u6D4B\u8BD5|\u8BCA\u65AD|\u5BA1\u67E5|\u68C0\u67E5|\u5BA1\u9605|\u6279\u5224|\u5206\u6790|\u6BD4\u8F83|\u8BC4\u4F30|\u590D\u73B0|\u91CD\u590D|\u6D88\u878D|\u63A8\u5BFC|\u8BC1\u660E|\u5EFA\u6A21|\u5B9E\u73B0|\u4F18\u5316|\u8D77\u8349|\u5199|\u4FEE\u6539|\u4FEE\u8BA2|\u7ED8\u56FE|\u753B|\u8BC4\u5BA1|\u5BA1\u7A3F|\u56DE\u590D|\u53CD\u9A73|\u5BFC\u5165|\u51C6\u5907|\u8BB0\u5F55|\u66F4\u65B0|\u4FDD\u5B58|\u8BB0\u4F4F|\u590D\u76D8|\u53CD\u601D)";
var DOVE_WORK_ACTION = new RegExp(`(?:\\b${ENGLISH_WORK_ACTION}\\b|${CHINESE_WORK_ACTION})`, "iu");
var DOVE_WORK_DIRECTIVE = new RegExp(`^(?:${ENGLISH_WORK_ACTION}\\b\\s+|${CHINESE_WORK_ACTION}.+)|(?:\\b(?:please|can you|could you|would you|help me|help us|let'?s|we need to|i need you to|i want you to|i'd like you to)\\b|(?:\u5E2E\u6211|\u8BF7|\u8BF7\u4F60|\u9EBB\u70E6|\u5E2E\u5FD9|\u9700\u8981\u4F60|\u6211\u4EEC\u6765|\u7ED9\u6211)|(?:\u628A|\u5C06).*(?:\u5199\u8FDB|\u5199\u5230|\u8BB0\u5F55\u5230|\u66F4\u65B0\u5230|\u4FDD\u5B58\u5230))`, "iu");
var DOVE_DOMAIN_OBJECT = /(?:\bdove\b|\bresearch\b|\bresearch (?:question|record|note|context|mainline|decision|claim|route|problem|result)\b|\bexperiment(?:al)?(?: result| note| plan| design| record| output)?\b|\bbenchmark(?: result| plan)?\b|\b(?:literature|papers?|manuscripts?|figures?|plots?|captions?|reviewer|review handoff|review return|review finding|review document|review prompt|review exchange|rebuttal|lessons?|claims?|missions?|hypothes(?:is|es)|citations?|evidence|sources?|source note|source material|results?|methods?|protocols?|baselines?|datasets?|metrics?|algorithms?|models?|ablations?|evaluations?)\b|(?:Dove|科研|研究|研究(?:问题|记录|主线|上下文|结论|决策)|实验(?:结果|记录|计划|文档)?|基准|文献|来源|论文|稿件|草稿|图表|绘图|(?:这|那|该|本)?张图|评审|审稿|回复审稿|反驳|经验|教训|主线|结论|决策|假设|引用|证据|结果|方法|协议|数据集|指标|算法|模型|消融|评估|复现))/iu;
function isHighConfidenceAmbientWorkPrompt(prompt) {
  if (typeof prompt !== "string") return false;
  const normalized = prompt.normalize("NFKC").trim();
  if (!normalized || normalized.startsWith("/") || CONTEXT_FOLLOW_UP.test(normalized)) return false;
  const hasWork = DOVE_WORK_ACTION.test(normalized) && DOVE_DOMAIN_OBJECT.test(normalized);
  if (JUDGMENT_ONLY_INTENT.test(normalized) && !JUDGMENT_WITH_WORK_INTENT.test(normalized)) return false;
  if (JUDGMENT_WITH_WORK_INTENT.test(normalized)) return hasWork;
  return DOVE_WORK_DIRECTIVE.test(normalized) && hasWork;
}
var DOVE_CLAUDE_SETTINGS_PATH = ".claude/settings.json";
var DOVE_CLAUDE_AMBIENT_RULE_PATH = ".claude/rules/dove.md";
var DOVE_CLAUDE_AMBIENT_SKILL_PATH = ".claude/skills/dove-intake/SKILL.md";
var DOVE_CLAUDE_AMBIENT_HOOK_COMMAND = 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"';
var DOVE_CLAUDE_SESSION_START_HOOK_COMMAND = 'dove hook session-start --project "$CLAUDE_PROJECT_DIR"';
var DOVE_CLAUDE_STOP_HOOK_COMMAND = 'dove hook stop --project "$CLAUDE_PROJECT_DIR"';
var DOVE_CLAUDE_AMBIENT_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([
    Object.freeze({
      type: "command",
      command: DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
      timeout: 10
    })
  ])
});
var DOVE_CLAUDE_SESSION_START_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([
    Object.freeze({
      type: "command",
      command: DOVE_CLAUDE_SESSION_START_HOOK_COMMAND,
      timeout: 10
    })
  ])
});
var DOVE_CLAUDE_STOP_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([
    Object.freeze({
      type: "command",
      command: DOVE_CLAUDE_STOP_HOOK_COMMAND,
      timeout: 10
    })
  ])
});
function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function sameKeys(value, keys) {
  return plainObject(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}
function exactManagedHook(value, command) {
  if (!sameKeys(value, ["hooks"]) || !Array.isArray(value.hooks) || value.hooks.length !== 1) return false;
  const hook = value.hooks[0];
  return sameKeys(hook, ["command", "timeout", "type"]) && hook.type === "command" && hook.command === command && hook.timeout === 10;
}
function hookCommandMarkers(eventName) {
  if (eventName === "SessionStart") return ["dove hook session-start"];
  if (eventName === "UserPromptSubmit") return ["dove hook user-prompt-submit", "dove-user-prompt-submit-package.mjs"];
  if (eventName === "Stop") return ["dove hook stop"];
  throw new Error(`Unsupported Dove Claude hook event: ${eventName}.`);
}
function referencesManagedHook(value, eventName) {
  if (!plainObject(value) || !Array.isArray(value.hooks)) return false;
  const markers = hookCommandMarkers(eventName);
  return value.hooks.some((hook) => plainObject(hook) && typeof hook.command === "string" && markers.some((marker) => hook.command.includes(marker)));
}
function mergeManagedHook(entries, eventName, command, managedEntry) {
  const exactEntries = entries.filter((entry) => exactManagedHook(entry, command));
  const conflictingEntries = entries.filter((entry) => referencesManagedHook(entry, eventName) && !exactManagedHook(entry, command));
  if (exactEntries.length > 1 || conflictingEntries.length > 0) {
    throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} already defines a conflicting Dove-managed ${eventName} hook.`);
  }
  return exactEntries.length === 1 ? { entries, changed: false } : { entries: [...entries, managedEntry], changed: true };
}
function mergeClaudeAmbientSettings(settings) {
  if (!plainObject(settings)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} must contain a JSON object.`);
  if (settings.hooks !== void 0 && !plainObject(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const hooks = settings.hooks ?? {};
  const promptHooks = hooks.UserPromptSubmit;
  const sessionStartHooks = hooks.SessionStart;
  const stopHooks = hooks.Stop;
  if (promptHooks !== void 0 && !Array.isArray(promptHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.UserPromptSubmit must be an array.`);
  if (sessionStartHooks !== void 0 && !Array.isArray(sessionStartHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.SessionStart must be an array.`);
  if (stopHooks !== void 0 && !Array.isArray(stopHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.Stop must be an array.`);
  const prompt = mergeManagedHook(promptHooks ?? [], "UserPromptSubmit", DOVE_CLAUDE_AMBIENT_HOOK_COMMAND, DOVE_CLAUDE_AMBIENT_HOOK_ENTRY);
  const sessionStart = mergeManagedHook(sessionStartHooks ?? [], "SessionStart", DOVE_CLAUDE_SESSION_START_HOOK_COMMAND, DOVE_CLAUDE_SESSION_START_HOOK_ENTRY);
  const stop = mergeManagedHook(stopHooks ?? [], "Stop", DOVE_CLAUDE_STOP_HOOK_COMMAND, DOVE_CLAUDE_STOP_HOOK_ENTRY);
  if (!prompt.changed && !sessionStart.changed && !stop.changed) return { settings, changed: false };
  return {
    settings: {
      ...settings,
      hooks: {
        ...hooks,
        UserPromptSubmit: prompt.entries,
        SessionStart: sessionStart.entries,
        Stop: stop.entries
      }
    },
    changed: true
  };
}
function ambientContextForPrompt(prompt) {
  return isHighConfidenceAmbientWorkPrompt(prompt) ? AMBIENT_CONTEXT : null;
}
function renderClaudeAmbientRule() {
  return `# Dove

${USER_RESPONSE_POLICY.join("\n")}

${DOVE_RESEARCH_ONE_AGENT} ${DOVE_RESEARCH_FLAT_SKILL_SENTENCE}

The prompt hook selects hidden intake only when the original user prompt is a clear Dove work request involving research, papers, sources, experiments, drafts, figures, reviews, rebuttals, lessons, or research-adjacent project work. Intake routing is zero-write, may choose no Dove Skill for contextual follow-ups or judgment-only prompts, and never selects Auto. Before routing, the PATH-installed Dove CLI may transactionally hot-sync package-managed project integration only; it never touches \`.dove/research/\`, and Stop never performs this sync. Slash commands keep their explicit routing. ${DOVE_RESEARCH_DIRECT_JUDGMENT}

When the user explicitly names Dove while giving feedback, criticism, correction, or an improvement request about it, or when Dove's own Skill, hook, project integration, routing, document behavior, or guidance actually fails during use, append a concise natural-language note to \`.dove/install/DOCTOR.md\`. When the user gives reusable feedback about ordinary research or collaboration without explicitly naming Dove, preserve it in the relevant Lessons Markdown instead. A Stop-hook continuation is response rendering only: rewrite the current answer in plain language and do not call tools, create tasks, continue research, or write DOCTOR, Lessons, research Markdown, project artifacts, or any other file. Preserve what happened, its user impact, and useful context. Do not create IDs, statuses, severity fields, counters, frontmatter, or a fixed template. Do not record ordinary research uncertainty, project bugs, external tool failures, or general conversation merely because Dove is active. Do not ask the user to run \`dove doctor\` for this feedback channel.
`;
}
function renderClaudeAmbientSkill() {
  return `---
name: dove-intake
description: Route a clear work request to the smallest suitable Dove Skill.
user-invocable: false
---

# Dove intake

Select the smallest suitable Dove Skill only for a clear Dove work request involving research, papers, sources, experiments, drafts, figures, reviews, rebuttals, lessons, or research-adjacent project work: ${DOVE_RESEARCH_ROUTABLE_SKILL_INVENTORY_TEXT}. For contextual follow-ups, explanations, confirmations, or pure judgment-only prompts, choose no Dove Skill and answer directly; do not expand a short follow-up into a new research or experiment task. If the prompt asks Dove to judge and then perform the bounded action when useful, route the bounded work instead of treating it as pure judgment. ${DOVE_RESEARCH_DIRECT_JUDGMENT} ${DOVE_RESEARCH_AUTO_EXPLICIT_ONLY} Routing itself is zero-write. Ask only when a material ambiguity blocks the work.
`;
}

// src/core/ambient-hook.mjs
function parseUserPromptSubmitPayload(input) {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Dove UserPromptSubmit hook received malformed JSON.");
  }
  if (payload?.hook_event_name !== "UserPromptSubmit") {
    throw new Error("Dove UserPromptSubmit hook received an unsupported or missing hook event.");
  }
  if (typeof payload?.prompt !== "string") {
    throw new Error("Dove UserPromptSubmit hook requires a string prompt.");
  }
  return payload;
}
function userPromptSubmitOutput(input) {
  const payload = parseUserPromptSubmitPayload(input);
  const additionalContext = ambientContextForPrompt(payload.prompt);
  if (additionalContext === null) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext
    }
  };
}

// src/core/session-start-hook.mjs
function parseSessionStartPayload(input) {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Dove SessionStart hook received malformed JSON.");
  }
  if (payload?.hook_event_name !== "SessionStart") {
    throw new Error("Dove SessionStart hook received an unsupported or missing hook event.");
  }
  return payload;
}
function sessionStartOutput(input) {
  parseSessionStartPayload(input);
  return null;
}

// src/core/stop-hook.mjs
function parseStopPayload(input) {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Dove Stop hook received malformed JSON.");
  }
  if (payload?.hook_event_name !== "Stop") {
    throw new Error("Dove Stop hook received an unsupported or missing hook event.");
  }
  return payload;
}
function stopHookOutput(input) {
  const payload = parseStopPayload(input);
  if (payload.stop_hook_active === true) return null;
  if (typeof payload.last_assistant_message !== "string" || payload.last_assistant_message.trim() === "") return null;
  return {
    decision: "block",
    reason: "\u8BF4\u4EBA\u8BDD"
  };
}

// src/core/research-defaults.mjs
import crypto from "node:crypto";
import fs3 from "node:fs";
import path3 from "node:path";

// src/core/rooted-filesystem.mjs
import fs2 from "node:fs";
import path2 from "node:path";
function realpathNative(fsOps, targetPath) {
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(targetPath) : fsOps.realpathSync(targetPath);
}
function normalizeRelativePath(relativePath, label = "Filesystem path") {
  if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error(`${label} must be a non-empty relative path.`);
  if (relativePath.includes("\0") || path2.posix.isAbsolute(relativePath) || path2.win32.isAbsolute(relativePath) || relativePath.startsWith("\\\\")) {
    throw new Error(`${label} must stay inside the rooted workspace: ${relativePath}`);
  }
  const supplied = relativePath.replace(/\\/gu, "/");
  const normalized = path2.posix.normalize(supplied);
  if (supplied !== normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`${label} must stay inside the rooted workspace: ${relativePath}`);
  }
  return normalized;
}
var RootedFilesystem = class {
  constructor(root, options = {}) {
    this.fsOps = options.fsOps ?? fs2;
    this.root = realpathNative(this.fsOps, path2.resolve(root));
    const stat = this.fsOps.lstatSync(this.root);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Rooted workspace must be a real directory: ${this.root}`);
  }
  normalize(relativePath, label) {
    return normalizeRelativePath(relativePath, label);
  }
  displayPath(relativePath) {
    const normalized = this.normalize(relativePath);
    const target = path2.resolve(this.root, ...normalized.split("/"));
    const relative = path2.relative(this.root, target);
    if (relative === "" || relative === ".." || relative.startsWith(`..${path2.sep}`) || path2.isAbsolute(relative)) {
      throw new Error(`Filesystem path must stay inside the rooted workspace: ${relativePath}`);
    }
    return target;
  }
  assertParentChain(relativePath) {
    const normalized = this.normalize(relativePath);
    let current = this.root;
    for (const component of normalized.split("/").slice(0, -1)) {
      current = path2.join(current, component);
      let stat;
      try {
        stat = this.fsOps.lstatSync(current);
      } catch (error) {
        if (error?.code === "ENOENT") return;
        throw error;
      }
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Rooted directory component must be a real directory: ${path2.relative(this.root, current)}`);
    }
  }
  lstat(relativePath) {
    this.assertParentChain(relativePath);
    return this.fsOps.lstatSync(this.displayPath(relativePath));
  }
  tryLstat(relativePath) {
    try {
      return this.lstat(relativePath);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }
  exists(relativePath) {
    return this.tryLstat(relativePath) !== null;
  }
  inspectRegularFile(relativePath) {
    const stat = this.lstat(relativePath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Rooted read target must be a regular file: ${relativePath}`);
    return stat;
  }
  readFile(relativePath) {
    this.inspectRegularFile(relativePath);
    return Buffer.from(this.fsOps.readFileSync(this.displayPath(relativePath)));
  }
  writeNewFile(relativePath, content, options = {}) {
    this.assertParentChain(relativePath);
    this.fsOps.writeFileSync(this.displayPath(relativePath), content, {
      flag: "wx",
      mode: options.mode ?? 384,
      ...options.encoding === void 0 ? {} : { encoding: options.encoding }
    });
  }
  chmod(relativePath, mode) {
    this.inspectRegularFile(relativePath);
    this.fsOps.chmodSync(this.displayPath(relativePath), mode);
  }
  mkdir(relativePath, options = {}) {
    const normalized = this.normalize(relativePath, "Directory path");
    if (options.recursive === true) {
      let current = "";
      for (const component of normalized.split("/")) {
        current = current ? `${current}/${component}` : component;
        const stat = this.tryLstat(current);
        if (stat) {
          if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Rooted directory component is not a real directory: ${current}`);
          continue;
        }
        this.mkdir(current, { mode: options.mode });
      }
      return;
    }
    this.assertParentChain(normalized);
    this.fsOps.mkdirSync(this.displayPath(normalized), {
      recursive: false,
      ...options.mode === void 0 ? {} : { mode: options.mode }
    });
  }
  readdir(relativePath = null, options = {}) {
    const target = relativePath === null || relativePath === "" || relativePath === "." ? this.root : this.displayPath(relativePath);
    if (relativePath !== null && relativePath !== "" && relativePath !== ".") {
      const stat = this.lstat(relativePath);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Rooted directory must be a real directory: ${relativePath}`);
    }
    return this.fsOps.readdirSync(target, options);
  }
  rename(fromRelativePath, toRelativePath) {
    const from = this.normalize(fromRelativePath, "Rename source");
    const to = this.normalize(toRelativePath, "Rename destination");
    this.assertParentChain(from);
    this.assertParentChain(to);
    const sourceStat = this.fsOps.lstatSync(this.displayPath(from));
    if (sourceStat.isSymbolicLink()) throw new Error(`Rooted rename source must not be a symbolic link: ${from}`);
    const destinationStat = this.tryLstat(to);
    if (destinationStat?.isSymbolicLink()) throw new Error(`Rooted rename destination must not be a symbolic link: ${to}`);
    this.fsOps.renameSync(this.displayPath(from), this.displayPath(to));
  }
  unlink(relativePath, options = {}) {
    try {
      const stat = this.lstat(relativePath);
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Rooted unlink target must be a regular file: ${relativePath}`);
      this.fsOps.unlinkSync(this.displayPath(relativePath));
    } catch (error) {
      if (options.force === true && error?.code === "ENOENT") return;
      throw error;
    }
  }
  rmdir(relativePath, options = {}) {
    try {
      const normalized = this.normalize(relativePath);
      const stat = this.lstat(normalized);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Rooted removal target must be a real directory: ${normalized}`);
      this.fsOps.rmdirSync(this.displayPath(normalized));
    } catch (error) {
      if (options.force === true && error?.code === "ENOENT") return;
      throw error;
    }
  }
  remove(relativePath, options = {}) {
    const normalized = this.normalize(relativePath, "Removal path");
    const stat = this.tryLstat(normalized);
    if (!stat) {
      if (options.force === true) return;
      const error = new Error(`Rooted removal target does not exist: ${normalized}`);
      error.code = "ENOENT";
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Rooted removal target must not be a symbolic link: ${normalized}`);
    if (stat.isDirectory()) {
      if (options.recursive !== true) return this.rmdir(normalized);
      for (const entry of this.readdir(normalized, { withFileTypes: true })) {
        const childPath = `${normalized}/${entry.name}`;
        const childStat = this.lstat(childPath);
        if (childStat.isSymbolicLink()) throw new Error(`Rooted cleanup encountered a symbolic link: ${childPath}`);
        if (childStat.isDirectory()) this.remove(childPath, { recursive: true });
        else if (childStat.isFile()) this.unlink(childPath);
        else throw new Error(`Rooted cleanup encountered an unsupported path type: ${childPath}`);
      }
      return this.rmdir(normalized, { force: options.force });
    }
    if (stat.isFile()) return this.unlink(normalized, { force: options.force });
    throw new Error(`Rooted removal target has an unsupported path type: ${normalized}`);
  }
};
function openRootedFilesystem(root, options = {}) {
  return new RootedFilesystem(root, options);
}

// src/core/research-defaults.mjs
var RESEARCH_ROOT = ARTIFACT_PATHS.researchDocumentsDir;
var RESEARCH_DEFAULT_PATHS = Object.freeze({
  root: RESEARCH_ROOT,
  overview: ARTIFACT_PATHS.researchOverview,
  missionsDirectory: `${RESEARCH_ROOT}/missions`,
  missionsSummary: `${RESEARCH_ROOT}/missions/MISSIONS.md`,
  experimentsDirectory: `${RESEARCH_ROOT}/experiments`,
  experimentsSummary: `${RESEARCH_ROOT}/experiments/EXPERIMENTS.md`,
  sourcesDirectory: `${RESEARCH_ROOT}/sources`,
  sourcesSummary: `${RESEARCH_ROOT}/sources/SOURCES.md`,
  reviewsDirectory: `${RESEARCH_ROOT}/reviews`,
  reviewsSummary: `${RESEARCH_ROOT}/reviews/REVIEWS.md`,
  claimsDirectory: `${RESEARCH_ROOT}/claims`,
  claimsSummary: `${RESEARCH_ROOT}/claims/CLAIMS.md`,
  lessonsDirectory: `${RESEARCH_ROOT}/lessons`,
  lessonsSummary: ARTIFACT_PATHS.researchLessons,
  decisionMaking: `${RESEARCH_ROOT}/lessons/decision-making.md`,
  researchMethod: `${RESEARCH_ROOT}/lessons/research-method.md`,
  experimentsAndEvidence: `${RESEARCH_ROOT}/lessons/experiments-and-evidence.md`,
  engineeringAndValidation: `${RESEARCH_ROOT}/lessons/engineering-and-validation.md`,
  writingAndReview: `${RESEARCH_ROOT}/lessons/writing-and-review.md`,
  collaborationAndEnvironment: `${RESEARCH_ROOT}/lessons/collaboration-and-environment.md`,
  importedLessons: `${RESEARCH_ROOT}/lessons/imported-lessons.md`
});
var RETIRED_RESEARCH_PATHS = Object.freeze({
  additionalLessons: `${RESEARCH_ROOT}/lessons/additional-lessons.md`,
  topLevelLessons: `${RESEARCH_ROOT}/LESSONS.md`
});
var OVERVIEW_LINKS = Object.freeze([
  "- [Missions](missions/MISSIONS.md)",
  "- [Experiments](experiments/EXPERIMENTS.md)",
  "- [Sources](sources/SOURCES.md)",
  "- [Reviews](reviews/REVIEWS.md)",
  "- [Claims](claims/CLAIMS.md)",
  "- [Lessons](lessons/LESSONS.md)"
]);
var LESSON_LINKS = Object.freeze([
  "- [Decision making](decision-making.md)",
  "- [Research method](research-method.md)",
  "- [Experiments and evidence](experiments-and-evidence.md)",
  "- [Engineering and validation](engineering-and-validation.md)",
  "- [Writing and review](writing-and-review.md)",
  "- [Collaboration and environment](collaboration-and-environment.md)"
]);
var IMPORTED_LESSONS_LINK = "- [Imported legacy Lessons](imported-lessons.md)";
var BUILT_IN_LESSON_NOTICE = "This is a Dove built-in Lesson. `dove update` replaces this file. Put project-specific guidance in a separate naturally named Lessons file and link it from `LESSONS.md`.";
var SUMMARY_DOCUMENTS = Object.freeze([
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.overview,
    title: "# Research",
    blocks: Object.freeze([
      "This overview keeps the current research mainline, material progress, important conclusions and limits, linked work, and next priorities concise and recoverable."
    ]),
    navigationHeading: "## Research areas",
    navigationLines: OVERVIEW_LINKS
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.missionsSummary,
    title: "# Missions",
    blocks: Object.freeze([
      "Use this summary to connect bounded research goals, substantive work, current conclusions, decisions, and useful next branches. Add or revise natural links when Mission documents change."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.experimentsSummary,
    title: "# Experiments",
    blocks: Object.freeze([
      "Use this summary to connect experiments that matter to a research decision. Keep each prospective plan and its later execution and results in the same naturally named document."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.sourcesSummary,
    title: "# Sources",
    blocks: Object.freeze([
      "Use this summary to connect sources that materially inform the work and record what was actually inspected and learned when durable context is useful."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.reviewsSummary,
    title: "# Reviews",
    blocks: Object.freeze([
      "Use this summary to connect Review documents for direct reviewer-perspective critiques, separate review handoffs, actual returned Markdown, author handling, and follow-up. Keep scopes, prompts, returns, and author-side work clearly separated in the relevant Review document."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.claimsSummary,
    title: "# Claims",
    blocks: Object.freeze([
      "Use this summary to organize important research claims when that improves the work. Keep the claim, its current basis, and the decision or next action it affects clear."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.lessonsSummary,
    title: "# Lessons",
    blocks: Object.freeze([
      "Lessons are fallible, reviewable guidance for future work. They are not research evidence, scientific validation, permission, or a completion certificate. Treat the six built-in themes as package-managed references; when durable project-specific guidance warrants maintenance, update or create a researcher-owned Lessons file and link it here."
    ]),
    navigationHeading: "## Themes",
    navigationLines: LESSON_LINKS
  })
]);
var RESEARCH_LESSON_TOPICS = Object.freeze([
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.decisionMaking,
    title: "# Decision making",
    intro: "Use these principles to choose and stop work according to real value rather than presentation or sunk cost.",
    paragraphs: Object.freeze([
      "Prefer work that advances the real research goal or resolves an important uncertainty. Navigation, record keeping, local metrics, demonstrations, and surface progress matter only when they improve the next decision or substantive result.",
      DOVE_RESEARCH_LAYERING,
      "Choose the feasible action most likely to change the research decision. Use suitable existing code, data, models, tools, compute, prior results, and user preferences to accelerate the chosen question, but do not let available resources or preferences redefine it without saying why.",
      "After a meaningful result, commit to the strongest route, switch when another explanation or approach becomes better, or stop when further feasible work is unlikely to resolve the important uncertainty.",
      "Judge progress by the real path from representative input to a useful result, not by the amount of analysis, validation, or documentation produced."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.researchMethod,
    title: "# Research method",
    intro: "Use these principles to keep the problem, hypothesis, mechanism, and route scientifically meaningful.",
    paragraphs: Object.freeze([
      "Start from the real research question and the conditions in which the answer must matter. Inspect the actual project and relevant external work before letting available methods, metrics, or publication pressure redefine the problem.",
      DOVE_RESEARCH_HUNCH,
      DOVE_RESEARCH_CURIOSITY,
      "When the route is open, generate materially different explanations or approaches. Use theory to derive different expectations, compare the serious candidates under the actual use conditions, and do not commit to the first plausible or easiest one.",
      "Choose work that can distinguish the serious candidates or expose the key mechanism. A small diagnostic, source investigation, analysis, prototype, or experiment is valuable when its possible outcomes would lead to different research decisions; do not treat missing evidence as a reason to stop before seeking the evidence that matters.",
      "When theory and results disagree, revisit the theory, test, and route rather than defending the current story or automatically adding experiments. Use the result to commit, switch, or stop."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.experimentsAndEvidence,
    title: "# Experiments and evidence",
    intro: "Use experiments when they are the best way to change a research decision.",
    paragraphs: Object.freeze([
      "Before treating an experiment as central, establish the real problem, key uncertainty, or route decision it should resolve. If that basis is not yet established, pause central experiment design and inspect the actual project material, relevant sources, or smaller low-risk diagnostic needed to investigate the problem; do not invent a substitute experiment or stop at merely admitting the basis is missing.",
      "For new execution, state what is being tested and how the result will be judged before running it. Use comparisons or diagnostics that can distinguish the serious candidates under the conditions that matter.",
      "Experiments, validation, audits, and documents are means. When they cannot change or protect the mainline decision, more of them becomes fake rigor or fake progress rather than better research.",
      "Prefer the real task over convenient proxies when the real task is feasible. Record the actual result and any deviation or failure that changes its interpretation when it has durable recovery or evidence value, then use it to continue, change, or stop the route."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.engineeringAndValidation,
    title: "# Engineering and validation",
    intro: "Use these principles to turn implementation checks into trustworthy end-to-end software results without overstating them.",
    paragraphs: Object.freeze([
      "Implement the smallest complete path that serves the real task. Keep concepts and data authority clear across input, execution, output, and interpretation, and remove obsolete paths rather than accumulating fallback, shadow state, duplicate rules, and switches. When a gap blocks progress, name the smallest concrete probe or repair that could unblock the mainline rather than ending at the gap itself.",
      "Diagnose the shared cause of failures and make the actual repair; do not let investigation, bookkeeping, or local checks replace the requested result, and do not manufacture a valid-looking output through unrelated defaults, swallowed errors, or skipped problem cases.",
      "Validate in proportion to the consequence of the change, using the real interface or artifact when that matters. Stop when the real path works well enough for the requested purpose rather than accumulating redundant checks.",
      DOVE_RESEARCH_PROPORTIONALITY,
      "Do not cause real harm or lose user content. Preserve unrelated project changes, protect credentials and sensitive data, and obtain explicit confirmation before destructive or outward-facing actions."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.writingAndReview,
    title: "# Writing and review",
    intro: "Use these principles to make papers and reviews follow a clear research argument.",
    paragraphs: Object.freeze([
      "Build the paper or report around a clear argument: an important problem, a specific gap, a falsifiable hypothesis or mechanism, fair evidence, and an explicit capability boundary. Organize the account around that argument rather than the chronology of development and patches. When you read as a reviewer, test the claim, evidence, method, novelty, limitations, and likely reader confusion before deciding what to ask or revise.",
      "Explain what is genuinely new by identifying the prior obstacle that is removed and separating the contribution from inherited models, public data, tools, simulators, and external services. Compare the nearest work on the actual task, information, supervision, use conditions, protocol, mechanism, real user need, and supporting evidence rather than merely listing sources or iterating an internal novelty story.",
      "Describe enough of the method, evidence conditions, adverse evidence, provenance, and experiment conditions for the reader to understand how and why the result was produced. Organize important results around the research or contribution promise they test and explain how they change the argument.",
      "Keep the paper focused on the strongest supported contribution. Revise or remove claims when a result changes the argument rather than surrounding them with defensive qualification."
    ])
  }),
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.collaborationAndEnvironment,
    title: "# Collaboration and environment",
    intro: "Use these principles to communicate decisions clearly and execute safely in the environment that actually exists.",
    paragraphs: Object.freeze([
      "Use the user's requested language and format. State the result or judgment clearly, explain difficult ideas in ordinary language before specialized terms, and do not bury the answer under internal workflow detail.",
      "Treat user preferences as collaboration and risk signals that matter, but weigh them against current evidence, task risk, and the research mainline when they conflict.",
      "Complete the current bounded request when the available context permits it, and ask only when a material ambiguity changes the work. Parallelize only genuinely independent tasks, preserve unrelated user changes, and do not commit, push, publish, or perform destructive cleanup without the required user direction or confirmation.",
      "Before using platform-specific commands, confirm the actual operating system, shell, path conventions, and available toolchain, then use that environment's native commands instead of trying Windows, Linux, and macOS commands by guesswork.",
      "For compute-intensive work, inspect the actual hardware and deployment constraints. Use suitable available GPUs and sufficiently capable models when the task benefits from them; do not default without evidence to CPU, small memory, weak models, or overly frugal settings, and do not retain an unrequested CPU fallback when the real deployment does not need one."
    ])
  })
]);
function renderDocument({ title, blocks = [], navigationHeading = null, navigationLines = [] }) {
  const parts = [title, ...blocks];
  if (navigationLines.length > 0) parts.push(navigationHeading, navigationLines.join("\n"));
  return `${parts.join("\n\n")}
`;
}
function topicDocument(topic) {
  return renderDocument({ title: topic.title, blocks: [BUILT_IN_LESSON_NOTICE, topic.intro, ...topic.paragraphs] });
}
var RESEARCH_DEFAULT_DOCUMENTS = Object.freeze([
  ...SUMMARY_DOCUMENTS.map((document) => Object.freeze({ path: document.path, content: renderDocument(document) })),
  ...RESEARCH_LESSON_TOPICS.map((topic) => Object.freeze({ path: topic.path, content: topicDocument(topic) }))
]);
var RESEARCH_DEFAULT_FILE_PATHS = Object.freeze(RESEARCH_DEFAULT_DOCUMENTS.map((document) => document.path));
var RESEARCH_DEFAULT_DIRECTORY_PATHS = Object.freeze([
  RESEARCH_DEFAULT_PATHS.root,
  RESEARCH_DEFAULT_PATHS.missionsDirectory,
  RESEARCH_DEFAULT_PATHS.experimentsDirectory,
  RESEARCH_DEFAULT_PATHS.sourcesDirectory,
  RESEARCH_DEFAULT_PATHS.reviewsDirectory,
  RESEARCH_DEFAULT_PATHS.claimsDirectory,
  RESEARCH_DEFAULT_PATHS.lessonsDirectory
]);
function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}
function canonicalRoot(root, fsOps) {
  const resolved = path3.resolve(root);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}
function decodeMarkdown(bytes, relativePath) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch (error) {
    throw new Error(`${relativePath} must contain valid UTF-8 Markdown.`, { cause: error });
  }
  if (text.includes("\0")) throw new Error(`${relativePath} contains null bytes.`);
  return text;
}
function absentState(relativePath) {
  return { relativePath, exists: false, type: "absent", bytes: null, text: null, sha256: null, mode: null };
}
function readFileState(anchor, relativePath, options = {}) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return absentState(relativePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${relativePath} must be a regular file without symbolic links.`);
  const bytes = anchor.readFile(relativePath);
  return {
    relativePath,
    exists: true,
    type: "file",
    bytes,
    text: options.decode === false ? null : decodeMarkdown(bytes, relativePath),
    sha256: sha256(bytes),
    mode: stat.mode & 4095
  };
}
function assertRealDirectoryIfPresent(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error(`${relativePath} must be a real directory.`);
  return stat !== null;
}
function expectedState(state2) {
  return state2.exists ? { exists: true, type: "file", sha256: state2.sha256, mode: state2.mode } : { exists: false, type: "absent", sha256: null, mode: null };
}
function exactLinePresent(text, line) {
  return text.split(/\r?\n/u).includes(line);
}
function exactMarkdownBlockPresent(text, block) {
  let offset = 0;
  while (offset <= text.length) {
    const index = text.indexOf(block, offset);
    if (index === -1) return false;
    const end = index + block.length;
    const startsAtLineBoundary = index === 0 || index === 1 && text[0] === "\uFEFF" || text[index - 1] === "\n";
    const endsAtLineBoundary = end === text.length || text[end] === "\n" || text.startsWith("\r\n", end);
    if (startsAtLineBoundary && endsAtLineBoundary) return true;
    offset = index + 1;
  }
  return false;
}
function appendSeparator(text) {
  if (!text) return "";
  if (text.endsWith("\n\n")) return "";
  if (text.endsWith("\n")) return "\n";
  return "\n\n";
}
function appendByteSeparator(bytes) {
  if (bytes.length === 0) return Buffer.alloc(0);
  if (bytes.subarray(-4).equals(Buffer.from("\r\n\r\n")) || bytes.subarray(-2).equals(Buffer.from("\n\n"))) return Buffer.alloc(0);
  if (bytes.subarray(-2).equals(Buffer.from("\r\n"))) return Buffer.from("\r\n");
  if (bytes.at(-1) === 10) return Buffer.from("\n");
  return Buffer.from("\n\n");
}
function appendExactMarkdownBlocks(original, blocks) {
  let result = String(original);
  for (const raw of blocks) {
    const block = String(raw).trimEnd();
    if (!block || exactMarkdownBlockPresent(result, block)) continue;
    result += `${appendSeparator(result)}${block}
`;
  }
  return result;
}
function appendExactMarkdownBytes(original, addition) {
  const existing = Buffer.isBuffer(original) ? Buffer.from(original) : Buffer.from(original ?? "");
  const appended = Buffer.isBuffer(addition) ? Buffer.from(addition) : Buffer.from(addition ?? "");
  if (appended.length === 0 || existing.indexOf(appended) !== -1) return existing;
  return Buffer.concat([existing, appendByteSeparator(existing), appended]);
}
function appendExactMarkdownLines(original, heading, lines) {
  const missing = lines.filter((line) => !exactLinePresent(original, line));
  if (missing.length === 0) return original;
  const parts = [];
  if (heading && !exactLinePresent(original, heading)) parts.push(heading);
  parts.push(...missing);
  return appendExactMarkdownBlocks(original, [parts.join("\n")]);
}
function readResearchDefaultsSnapshot(root, options = {}) {
  const fsOps = options.fsOps ?? fs3;
  const replace = options.mode === "replace";
  const anchor = openRootedFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
  for (const directoryPath of RESEARCH_DEFAULT_DIRECTORY_PATHS) assertRealDirectoryIfPresent(anchor, directoryPath);
  const states = /* @__PURE__ */ new Map();
  const selectedPaths = /* @__PURE__ */ new Set([
    ...RESEARCH_DEFAULT_FILE_PATHS,
    RETIRED_RESEARCH_PATHS.additionalLessons,
    RESEARCH_DEFAULT_PATHS.importedLessons,
    RETIRED_RESEARCH_PATHS.topLevelLessons
  ]);
  for (const relativePath of selectedPaths) {
    const opaque = relativePath === RETIRED_RESEARCH_PATHS.additionalLessons || relativePath === RESEARCH_DEFAULT_PATHS.importedLessons || relativePath === RETIRED_RESEARCH_PATHS.topLevelLessons;
    states.set(relativePath, readFileState(anchor, relativePath, { decode: !replace && !opaque }));
  }
  return { states };
}
function stateFor(snapshot, relativePath) {
  return snapshot.states.get(relativePath) ?? absentState(relativePath);
}
function setWrite(writes, snapshot, relativePath, content) {
  const bytes = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), "utf8");
  const state2 = stateFor(snapshot, relativePath);
  if (state2.exists && state2.bytes.equals(bytes)) {
    writes.delete(relativePath);
    return;
  }
  writes.set(relativePath, bytes);
}
function currentText(snapshot, writes, relativePath) {
  if (writes.has(relativePath)) return decodeMarkdown(writes.get(relativePath), relativePath);
  const state2 = stateFor(snapshot, relativePath);
  return state2.exists ? state2.text : null;
}
function removeExactMarkdownLine(original, line) {
  const escaped = line.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return original.replace(new RegExp(`^${escaped}(?:\\r?\\n|$)`, "gmu"), "");
}
function planSummaryDocument(snapshot, writes, document) {
  const state2 = stateFor(snapshot, document.path);
  if (!state2.exists) {
    setWrite(writes, snapshot, document.path, renderDocument(document));
    return;
  }
  let content = currentText(snapshot, writes, document.path);
  if (document.path === RESEARCH_DEFAULT_PATHS.lessonsSummary) {
    content = removeExactMarkdownLine(content, "- [Additional migrated Lessons](additional-lessons.md)");
  }
  content = appendExactMarkdownLines(content, document.navigationHeading, document.navigationLines);
  setWrite(writes, snapshot, document.path, content);
}
function planResearchDefaults(snapshot, options = {}) {
  if (!snapshot || !(snapshot.states instanceof Map)) {
    throw new Error("Research defaults planning requires a research Markdown snapshot.");
  }
  const mode = options.mode ?? "sync";
  if (!(/* @__PURE__ */ new Set(["sync", "replace"])).has(mode)) throw new Error(`Unsupported research defaults planning mode: ${mode}.`);
  const writes = /* @__PURE__ */ new Map();
  const deletes = /* @__PURE__ */ new Set();
  if (mode === "replace") {
    for (const document of RESEARCH_DEFAULT_DOCUMENTS) setWrite(writes, snapshot, document.path, document.content);
    return { writes, deletes };
  }
  for (const deprecatedPath of [RETIRED_RESEARCH_PATHS.topLevelLessons, RETIRED_RESEARCH_PATHS.additionalLessons]) {
    if (stateFor(snapshot, deprecatedPath).exists) deletes.add(deprecatedPath);
  }
  for (const document of SUMMARY_DOCUMENTS) planSummaryDocument(snapshot, writes, document);
  for (const topic of RESEARCH_LESSON_TOPICS) setWrite(writes, snapshot, topic.path, topicDocument(topic));
  return { writes, deletes };
}
function researchDefaultTransactionEntries(root, snapshot, plan, options = {}) {
  const label = options.label ?? "Dove research default";
  return [
    ...[...plan.writes.entries()].map(([relativePath, content]) => ({
      root,
      relativePath,
      content,
      force: true,
      expectedState: expectedState(stateFor(snapshot, relativePath)),
      label: `${label} ${relativePath}`
    })),
    ...[...plan.deletes].map((relativePath) => ({
      root,
      relativePath,
      delete: true,
      force: true,
      expectedState: expectedState(stateFor(snapshot, relativePath)),
      label: `Retired Dove research document ${relativePath}`
    }))
  ];
}
function prepareResearchDefaults(root, options = {}) {
  const fsOps = options.fsOps ?? fs3;
  const canonical = canonicalRoot(root, fsOps);
  const mode = options.mode ?? "sync";
  const snapshot = readResearchDefaultsSnapshot(canonical, { ...options, fsOps, mode });
  const plan = planResearchDefaults(snapshot, { mode });
  const entries = researchDefaultTransactionEntries(canonical, snapshot, plan, { label: options.label });
  return {
    root: canonical,
    snapshot,
    plan,
    entries,
    changedPaths: entries.map((entry) => entry.relativePath)
  };
}

// src/core/research-documents.mjs
import fs4 from "node:fs";
import path4 from "node:path";

// src/core/strict-json.mjs
function duplicateKeyError(label, key, path14) {
  throw new Error(`${label} must not contain duplicate JSON object keys: ${path14 === "$" ? key : `${path14}.${key}`}.`);
}
function parseJsonWithoutDuplicateKeys(text, label = "JSON input") {
  if (typeof text !== "string") throw new Error(`${label} must contain valid JSON.`);
  let index = 0;
  function skipWhitespace() {
    while (/\s/u.test(text[index] ?? "")) index += 1;
  }
  function parseString() {
    if (text[index] !== '"') throw new Error(`${label} must contain valid JSON.`);
    const start = index;
    index += 1;
    let escaped = false;
    while (index < text.length) {
      const character = text[index];
      index += 1;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') {
        return JSON.parse(text.slice(start, index));
      }
      if (character.charCodeAt(0) < 32) throw new Error(`${label} must contain valid JSON.`);
    }
    throw new Error(`${label} must contain valid JSON.`);
  }
  function parseNumber() {
    const match = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
    if (!match) throw new Error(`${label} must contain valid JSON.`);
    index += match[0].length;
  }
  function parseArray(path14) {
    index += 1;
    skipWhitespace();
    if (text[index] === "]") {
      index += 1;
      return;
    }
    let itemIndex = 0;
    while (true) {
      parseValue(`${path14}[${itemIndex}]`);
      itemIndex += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      if (text[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }
  function parseObject(path14) {
    index += 1;
    skipWhitespace();
    if (text[index] === "}") {
      index += 1;
      return;
    }
    const keys = /* @__PURE__ */ new Set();
    while (true) {
      const key = parseString();
      if (keys.has(key)) duplicateKeyError(label, key, path14);
      keys.add(key);
      skipWhitespace();
      if (text[index] !== ":") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      parseValue(path14 === "$" ? `$.${key}` : `${path14}.${key}`);
      skipWhitespace();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      if (text[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }
  function parseValue(path14) {
    skipWhitespace();
    const character = text[index];
    if (character === "{") parseObject(path14);
    else if (character === "[") parseArray(path14);
    else if (character === '"') parseString();
    else if (character === "-" || /\d/u.test(character ?? "")) parseNumber();
    else if (text.startsWith("true", index)) index += 4;
    else if (text.startsWith("false", index)) index += 5;
    else if (text.startsWith("null", index)) index += 4;
    else throw new Error(`${label} must contain valid JSON.`);
    skipWhitespace();
  }
  try {
    parseValue("$");
    skipWhitespace();
    if (index !== text.length) throw new Error(`${label} must contain valid JSON.`);
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label} must not contain duplicate`)) throw error;
    throw new Error(`${label} must contain valid JSON.`);
  }
}

// src/core/research-documents.mjs
var V2_FORMAT_PATH = ".dove/format.json";
var V2_FORMAT = "dove-research-v2";
var RESEARCH_DOCUMENT_PATHS = Object.freeze({ ...RESEARCH_DEFAULT_PATHS });
var SUMMARY_ENTRIES = Object.freeze([
  Object.freeze(["missions", RESEARCH_DOCUMENT_PATHS.missionsDirectory, RESEARCH_DOCUMENT_PATHS.missionsSummary]),
  Object.freeze(["experiments", RESEARCH_DOCUMENT_PATHS.experimentsDirectory, RESEARCH_DOCUMENT_PATHS.experimentsSummary]),
  Object.freeze(["sources", RESEARCH_DOCUMENT_PATHS.sourcesDirectory, RESEARCH_DOCUMENT_PATHS.sourcesSummary]),
  Object.freeze(["reviews", RESEARCH_DOCUMENT_PATHS.reviewsDirectory, RESEARCH_DOCUMENT_PATHS.reviewsSummary]),
  Object.freeze(["claims", RESEARCH_DOCUMENT_PATHS.claimsDirectory, RESEARCH_DOCUMENT_PATHS.claimsSummary]),
  Object.freeze(["lessons", RESEARCH_DOCUMENT_PATHS.lessonsDirectory, RESEARCH_DOCUMENT_PATHS.lessonsSummary])
]);
function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}
function canonicalRoot2(root, fsOps) {
  const resolved = path4.resolve(root);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}
function readMarkdown(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return null;
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${relativePath} must be a regular file without symbolic links.`);
  }
  let markdown;
  try {
    markdown = new TextDecoder("utf-8", { fatal: true }).decode(anchor.readFile(relativePath));
  } catch (error) {
    throw new Error(`${relativePath} must contain valid UTF-8 Markdown.`, { cause: error });
  }
  if (markdown.includes("\0")) throw new Error(`${relativePath} contains null bytes.`);
  return markdown;
}
function inspectDirectory(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return false;
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${relativePath} must be a real directory.`);
  return true;
}
function emptyResult(state2, fields = {}) {
  return {
    healthy: true,
    state: state2,
    root: RESEARCH_DOCUMENT_PATHS.root,
    overview: null,
    summaries: {
      missions: null,
      experiments: null,
      sources: null,
      reviews: null,
      claims: null,
      lessons: null
    },
    missingSummaries: SUMMARY_ENTRIES.map(([, , summaryPath]) => summaryPath),
    ...fields
  };
}
function inspectResearchDocuments(root, options = {}) {
  const fsOps = options.fsOps ?? fs4;
  let anchor;
  try {
    anchor = openRootedFilesystem(canonicalRoot2(root, fsOps), { ...options, fsOps });
    const directory = anchor.tryLstat(RESEARCH_DOCUMENT_PATHS.root);
    if (!directory) {
      const format = anchor.tryLstat(V2_FORMAT_PATH);
      if (format) {
        if (format.isSymbolicLink() || !format.isFile()) {
          throw new Error(`${V2_FORMAT_PATH} must be a regular file without symbolic links.`);
        }
        const marker = parseJsonWithoutDuplicateKeys(
          new TextDecoder("utf-8", { fatal: true }).decode(anchor.readFile(V2_FORMAT_PATH)),
          V2_FORMAT_PATH
        );
        if (marker?.format === V2_FORMAT && Object.keys(marker).length === 1) {
          return emptyResult("previous-research-format", { exportCommand: "dove export-research" });
        }
      }
      return emptyResult("absent");
    }
    if (directory.isSymbolicLink() || !directory.isDirectory()) {
      throw new Error(`${RESEARCH_DOCUMENT_PATHS.root} must be a real directory.`);
    }
    const overview2 = readMarkdown(anchor, RESEARCH_DOCUMENT_PATHS.overview);
    const summaries = {};
    const missingSummaries = [];
    for (const [name, directoryPath, summaryPath] of SUMMARY_ENTRIES) {
      const directoryExists = inspectDirectory(anchor, directoryPath);
      const markdown = directoryExists ? readMarkdown(anchor, summaryPath) : null;
      summaries[name] = markdown === null ? null : { path: summaryPath };
      if (markdown === null) missingSummaries.push(summaryPath);
    }
    return {
      healthy: true,
      state: "current",
      root: RESEARCH_DOCUMENT_PATHS.root,
      overview: overview2 === null ? null : { path: RESEARCH_DOCUMENT_PATHS.overview },
      summaries,
      missingSummaries
    };
  } catch (error) {
    return {
      healthy: false,
      state: "invalid",
      root: RESEARCH_DOCUMENT_PATHS.root,
      overview: null,
      summaries: {
        missions: null,
        experiments: null,
        sources: null,
        reviews: null,
        claims: null,
        lessons: null
      },
      missingSummaries: [],
      error: messageFor(error)
    };
  }
}

// src/core/research-export.mjs
import crypto3 from "node:crypto";
import fs6 from "node:fs";
import path6 from "node:path";

// src/core/file-set-transaction.mjs
import crypto2 from "node:crypto";
import fs5 from "node:fs";
import path5 from "node:path";
var MAX_CLEANUP_WARNINGS = 20;
var ENTRY_FIELDS = /* @__PURE__ */ new Set(["root", "relativePath", "content", "encoding", "force", "delete", "deleteEmptyDirectory", "expectedState", "label"]);
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function sha2562(content) {
  return crypto2.createHash("sha256").update(content).digest("hex");
}
function state(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return { exists: false, type: "absent", sha256: null, mode: null };
  if (stat.isSymbolicLink()) return { exists: true, type: "symlink", sha256: null, mode: stat.mode & 4095 };
  if (stat.isDirectory()) return { exists: true, type: "directory", sha256: null, mode: stat.mode & 4095 };
  if (!stat.isFile()) return { exists: true, type: "other", sha256: null, mode: stat.mode & 4095 };
  return { exists: true, type: "file", sha256: sha2562(anchor.readFile(relativePath)), mode: stat.mode & 4095 };
}
function sameState(left, right) {
  return left.exists === right.exists && left.type === right.type && left.sha256 === right.sha256 && left.mode === right.mode;
}
function expectedState2(raw, index) {
  if (raw === void 0) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Transactional write entry ${index} expectedState must be an object.`);
  const keys = Object.keys(raw).sort();
  if (keys.join(",") !== "exists,mode,sha256,type") throw new Error(`Transactional write entry ${index} expectedState must contain exactly exists, type, sha256, and mode.`);
  if (typeof raw.exists !== "boolean" || !["absent", "directory", "file"].includes(raw.type)) throw new Error(`Transactional write entry ${index} expectedState is invalid.`);
  if (raw.exists !== (raw.type !== "absent")) throw new Error(`Transactional write entry ${index} expectedState existence is contradictory.`);
  if (raw.exists ? !Number.isInteger(raw.mode) || raw.mode < 0 || raw.mode > 4095 : raw.mode !== null) throw new Error(`Transactional write entry ${index} expectedState mode is invalid.`);
  if (raw.type === "file") {
    if (typeof raw.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(raw.sha256)) throw new Error(`Transactional write entry ${index} expectedState file requires a lowercase SHA-256 digest.`);
  } else if (raw.sha256 !== null) {
    throw new Error(`Transactional write entry ${index} expectedState ${raw.type} must use a null digest.`);
  }
  return { exists: raw.exists, type: raw.type, sha256: raw.sha256, mode: raw.mode };
}
function parentDirectories(relativePath) {
  const directories = [];
  let current = path5.posix.dirname(relativePath);
  while (current !== ".") {
    directories.push(current);
    current = path5.posix.dirname(current);
  }
  return directories.reverse();
}
function inspectParentDirectories(anchor, relativePath) {
  for (const directoryPath of parentDirectories(relativePath)) {
    const stat = anchor.tryLstat(directoryPath);
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error(`Transactional directory component must be a real directory: ${directoryPath}`);
    if (!stat) break;
  }
}
function ensureParentDirectories(anchor, relativePath, createdDirectories) {
  for (const directoryPath of parentDirectories(relativePath)) {
    const stat = anchor.tryLstat(directoryPath);
    if (stat) {
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Transactional directory component must be a real directory: ${directoryPath}`);
      continue;
    }
    anchor.mkdir(directoryPath);
    createdDirectories.push(directoryPath);
  }
}
function removeNewTransactionParents(anchor, transaction) {
  if (anchor.exists(transaction.transactionBase) && anchor.readdir(transaction.transactionBase).length === 0) anchor.rmdir(transaction.transactionBase, { force: true });
  for (const parent of [...transaction.transactionParents].reverse()) {
    if (!parent.existed && anchor.exists(parent.relativePath) && anchor.readdir(parent.relativePath).length === 0) anchor.rmdir(parent.relativePath, { force: true });
  }
}
function assertNoUnexpectedChildren(entry, resolved) {
  const scheduledChildren = new Set(resolved.filter((candidate) => candidate.anchor === entry.anchor && candidate.deleting && path5.posix.dirname(candidate.relativePath) === entry.relativePath).map((candidate) => path5.posix.basename(candidate.relativePath)));
  const unexpected = entry.anchor.readdir(entry.relativePath).map((child) => typeof child === "string" ? child : child.name).filter((child) => !scheduledChildren.has(child));
  if (unexpected.length > 0) {
    throw new Error(`Transactional directory deletion found an unscheduled child: ${entry.relativePath}/${unexpected.sort().join(`, ${entry.relativePath}/`)}.`);
  }
}
function committedResult(entries, cleanupFailures) {
  const warnings = cleanupFailures.slice(0, MAX_CLEANUP_WARNINGS);
  return {
    writtenPaths: entries.filter((entry) => !entry.deleting).map((entry) => entry.relativePath),
    removedPaths: entries.filter((entry) => entry.deleting).map((entry) => entry.relativePath),
    changedPaths: entries.map((entry) => entry.relativePath),
    cleanupWarnings: warnings,
    omittedCleanupWarningCount: Math.max(0, cleanupFailures.length - warnings.length)
  };
}
function writeFileSetTransaction(entries, options = {}) {
  if (!Array.isArray(entries)) throw new Error("Transactional write entries must be an array.");
  const fsOps = options.fsOps ?? fs5;
  const transactionId = (options.transactionId ?? crypto2.randomUUID()).replace(/[^a-z0-9._-]/giu, "-");
  const anchors = /* @__PURE__ */ new Map();
  const resolved = [];
  const targets = /* @__PURE__ */ new Set();
  const transactions = /* @__PURE__ */ new Map();
  const promotions = [];
  const createdDirectories = /* @__PURE__ */ new Map();
  const anchorFor = (root) => {
    const canonicalRoot4 = typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(path5.resolve(root)) : fsOps.realpathSync(path5.resolve(root));
    if (!anchors.has(canonicalRoot4)) anchors.set(canonicalRoot4, openRootedFilesystem(canonicalRoot4, { fsOps }));
    return anchors.get(canonicalRoot4);
  };
  try {
    for (const [index, entry] of entries.entries()) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Transactional write entry ${index} must be an object.`);
      const unknownFields = Object.keys(entry).filter((field) => !ENTRY_FIELDS.has(field));
      if (unknownFields.length > 0) throw new Error(`Transactional write entry ${index} uses unsupported fields: ${unknownFields.join(", ")}.`);
      const anchor = anchorFor(entry.root);
      const relativePath = anchor.normalize(entry.relativePath, entry.label ?? "Transactional write path");
      const key = `${anchor.root}\0${relativePath}`;
      if (targets.has(key)) throw new Error(`Transactional write set contains duplicate target ${relativePath}.`);
      targets.add(key);
      inspectParentDirectories(anchor, relativePath);
      const previous = state(anchor, relativePath);
      const approvedState = expectedState2(entry.expectedState, index);
      if (approvedState !== null && !sameState(previous, approvedState)) throw new Error(`Transactional write approved precondition changed for ${relativePath}.`);
      const deleting = entry.delete === true;
      const deletingEmptyDirectory = deleting && entry.deleteEmptyDirectory === true;
      if (previous.exists && previous.type !== "file" && !(deletingEmptyDirectory && previous.type === "directory")) {
        throw new Error(`Transactional write target must be absent or a regular file${deletingEmptyDirectory ? " or an explicitly selected empty directory" : ""}: ${relativePath}.`);
      }
      if (deleting && !previous.exists) continue;
      if (!deleting && previous.exists && entry.force !== true) continue;
      resolved.push({
        ...entry,
        anchor,
        relativePath,
        deleting,
        deletingEmptyDirectory,
        previous,
        content: deleting ? null : Buffer.isBuffer(entry.content) ? Buffer.from(entry.content) : Buffer.from(String(entry.content ?? ""), entry.encoding ?? "utf8")
      });
    }
    if (resolved.length === 0) return committedResult([], []);
    for (const anchor of new Set(resolved.map((entry) => entry.anchor))) {
      const transactionBase = anchor.normalize(options.transactionBase ?? ".dove/install/transactions", "Transactional staging base");
      const transactionPath = `${transactionBase}/${transactionId}`;
      if (anchor.exists(transactionPath)) throw new Error(`Transactional staging path is already occupied: ${anchor.displayPath(transactionPath)}.`);
      const transactionParents = parentDirectories(`${transactionPath}/placeholder`).map((relativePath) => ({ relativePath, existed: anchor.exists(relativePath) }));
      anchor.mkdir(transactionPath, { recursive: true });
      anchor.mkdir(`${transactionPath}/backups`);
      transactions.set(anchor, { transactionBase, transactionPath, transactionParents, backupRoot: `${transactionPath}/backups` });
      createdDirectories.set(anchor, []);
    }
    for (const [index, entry] of resolved.entries()) {
      if (entry.deleting) continue;
      const parent = path5.posix.dirname(entry.relativePath);
      const temporaryName = `.${path5.posix.basename(entry.relativePath)}.${transactionId}.${index}.tmp`;
      entry.stagedPath = parent === "." ? temporaryName : `${parent}/${temporaryName}`;
      ensureParentDirectories(entry.anchor, entry.relativePath, createdDirectories.get(entry.anchor));
      entry.anchor.writeNewFile(entry.stagedPath, entry.content);
      if (entry.previous.mode !== null) entry.anchor.chmod(entry.stagedPath, entry.previous.mode);
    }
    for (const [index, entry] of resolved.entries()) {
      const transaction = transactions.get(entry.anchor);
      const promotion = { entry, backupPath: null, promoted: false };
      promotions.push(promotion);
      ensureParentDirectories(entry.anchor, entry.relativePath, createdDirectories.get(entry.anchor));
      const actual = state(entry.anchor, entry.relativePath);
      if (!sameState(actual, entry.previous)) throw new Error(`Transactional write precondition changed for ${entry.relativePath}.`);
      if (entry.deletingEmptyDirectory) assertNoUnexpectedChildren(entry, resolved);
      if (entry.previous.exists) {
        promotion.backupPath = `${transaction.backupRoot}/file-${index}`;
        entry.anchor.rename(entry.relativePath, promotion.backupPath);
      }
      if (!entry.deleting) {
        entry.anchor.rename(entry.stagedPath, entry.relativePath);
        promotion.promoted = true;
      }
    }
    const cleanupFailures = [];
    for (const [anchor, transaction] of transactions) {
      try {
        anchor.remove(transaction.transactionPath, { recursive: true, force: true });
        removeNewTransactionParents(anchor, transaction);
      } catch (cleanupError) {
        cleanupFailures.push({ path: anchor.displayPath(transaction.transactionPath), reason: errorMessage(cleanupError) });
      }
    }
    return committedResult(resolved, cleanupFailures);
  } catch (error) {
    const rollbackFailures = [];
    const attempt = (callback) => {
      try {
        callback();
      } catch (rollbackError) {
        rollbackFailures.push(errorMessage(rollbackError));
      }
    };
    for (const promotion of [...promotions].reverse()) {
      const { entry } = promotion;
      if (promotion.promoted && entry.anchor.exists(entry.relativePath)) {
        attempt(() => entry.anchor.remove(entry.relativePath, { force: true }));
      }
      if (promotion.backupPath && entry.anchor.exists(promotion.backupPath)) attempt(() => {
        if (entry.anchor.exists(entry.relativePath)) throw new Error(`Transactional rollback target is occupied: ${entry.relativePath}.`);
        entry.anchor.rename(promotion.backupPath, entry.relativePath);
      });
    }
    for (const [anchor, directories] of createdDirectories) {
      for (const directoryPath of [...directories].sort((left, right) => right.length - left.length)) attempt(() => anchor.rmdir(directoryPath, { force: true }));
    }
    for (const entry of resolved) {
      if (entry.stagedPath && entry.anchor.exists(entry.stagedPath)) attempt(() => entry.anchor.remove(entry.stagedPath, { force: true }));
    }
    for (const [anchor, transaction] of transactions) {
      attempt(() => anchor.remove(transaction.transactionPath, { recursive: true, force: true }));
      attempt(() => removeNewTransactionParents(anchor, transaction));
    }
    if (rollbackFailures.length > 0) {
      throw new Error(`Transactional write failed and rollback also failed: ${errorMessage(error)}; rollback: ${rollbackFailures.join("; ")}`, { cause: error });
    }
    throw new Error(`Transactional write failed and all staged changes were rolled back: ${errorMessage(error)}`, { cause: error });
  }
}

// src/core/research-export.mjs
var V2_FORMAT2 = "dove-research-v2";
var OLD_ROOT = ".dove";
var NEW_ROOT = ".dove/research";
var ARCHIVE_ROOT = ".dove/archive";
var REQUIRED_FILES = [".dove/format.json", ".dove/workspace.json", ".dove/LESSONS.md"];
var RECORD_DIRECTORIES = [
  ["direction-decisions", "directionDecisions"],
  ["missions", "missions"],
  ["sources", "sources"],
  ["experiments", "experiments"],
  ["claims", "claims"],
  ["review-exchanges", "reviewExchanges"],
  ["reviews", "reviews"]
];
var RECORD_DIRECTORY_PATHS = RECORD_DIRECTORIES.map(([directory]) => `.dove/${directory}`);
var SAFE_FILE_PART = /[^\p{L}\p{N}._-]+/gu;
var SAFE_RESEARCH_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var SHA256 = /^[a-f0-9]{64}$/u;
var WORKSPACE_FIELDS = /* @__PURE__ */ new Set(["workspaceId", "researchQuestion", "mainline", "contributionIntent", "currentFocus", "createdAt", "updatedAt"]);
var MISSION_FIELDS = /* @__PURE__ */ new Set(["missionId", "parentMissionId", "dependsOnMissionIds", "branchKind", "branchReason", "goal", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs", "contributionRole", "createdAt"]);
var CONCLUSION_FIELDS = /* @__PURE__ */ new Set(["missionId", "outcome", "synthesis", "failures", "limitations", "uncertainty", "sourceIds", "experimentIds", "claimIds", "recommendedBranches", "concludedAt"]);
var SOURCE_FIELDS = /* @__PURE__ */ new Set(["sourceId", "missionId", "citationKey", "title", "authors", "year", "locator", "sourceType", "summary", "conditions", "relationship", "conflicts", "limitations", "capture", "recordedAt"]);
var CAPTURE_FIELDS = /* @__PURE__ */ new Set(["path", "sha256"]);
var PLAN_FIELDS = /* @__PURE__ */ new Set(["experimentId", "missionId", "title", "hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts", "cost", "risk", "failureValue", "contributionRole", "plannedAt"]);
var RESULT_FIELDS = /* @__PURE__ */ new Set(["experimentId", "missionId", "kind", "summary", "observations", "measurements", "denominator", "hypothesisImpacts", "claimImpacts", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations", "recordedAt"]);
var MEASUREMENT_FIELDS = /* @__PURE__ */ new Set(["metric", "value", "unit", "condition", "denominatorRef", "note"]);
var HYPOTHESIS_IMPACT_FIELDS = /* @__PURE__ */ new Set(["hypothesisRef", "impact", "rationale"]);
var CLAIM_IMPACT_FIELDS = /* @__PURE__ */ new Set(["claimId", "impact", "rationale"]);
var CLAIM_FIELDS = /* @__PURE__ */ new Set(["claimId", "missionId", "statement", "supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "assessment", "storyRole", "artifactRefs", "supersedesClaimId", "revisionReason", "recordedAt"]);
var REVIEW_EXCHANGE_FIELDS = /* @__PURE__ */ new Set(["exchangeId", "missionId", "artifacts", "preparedAt"]);
var REVIEW_ARTIFACT_FIELDS = /* @__PURE__ */ new Set(["path", "sha256"]);
var REVIEW_FIELDS = /* @__PURE__ */ new Set(["reviewId", "exchangeId", "missionId", "artifacts", "status", "verdict", "summary", "rubric", "findings", "actionItems", "report", "provenance", "limitations", "reviewedAt"]);
var DIRECTION_FIELDS = /* @__PURE__ */ new Set(["decisionId", "priorDirection", "nextDirection", "reason", "evidenceRefs", "missionRefs", "decidedAt"]);
var DIRECTION_VALUE_FIELDS = /* @__PURE__ */ new Set(["researchQuestion", "mainline", "contributionIntent"]);
function canonicalRoot3(root, fsOps) {
  const resolved = path6.resolve(root);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}
function timestamp(value) {
  const date = value === void 0 ? /* @__PURE__ */ new Date() : value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Research export now must be a Date or valid timestamp.");
  return date.toISOString().replace(/[-:]/gu, "").replace(".", "-");
}
function fileState(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return { exists: false, type: "absent", sha256: null, mode: null };
  if (stat.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
  if (stat.isDirectory()) return { exists: true, type: "directory", sha256: null, mode: stat.mode & 4095 };
  if (!stat.isFile()) throw new Error(`${relativePath} must be a regular file or directory.`);
  return { exists: true, type: "file", sha256: crypto3.createHash("sha256").update(anchor.readFile(relativePath)).digest("hex"), mode: stat.mode & 4095 };
}
function expectedTransactionState(state2) {
  if (state2.exists) {
    if (state2.type !== "file") throw new Error("Research Markdown export targets must be absent or regular files.");
    return { exists: true, type: "file", sha256: state2.sha256, mode: state2.mode };
  }
  return { exists: false, type: "absent", sha256: null, mode: null };
}
function readRequired(anchor, relativePath) {
  const state2 = fileState(anchor, relativePath);
  if (!state2.exists || state2.type !== "file") throw new Error(`legacy JSON research export requires ${relativePath} as a regular file.`);
  return { relativePath, bytes: anchor.readFile(relativePath), state: state2 };
}
function strictJson(file) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
  } catch (error) {
    throw new Error(`${file.relativePath} must contain valid UTF-8 JSON.`, { cause: error });
  }
  return parseJsonWithoutDuplicateKeys(text, file.relativePath);
}
function listJson(anchor, relativeDirectory) {
  const state2 = fileState(anchor, relativeDirectory);
  if (!state2.exists) return [];
  if (state2.type !== "directory") throw new Error(`${relativeDirectory} must be a real directory.`);
  const files = [];
  for (const entry of anchor.readdir(relativeDirectory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativeDirectory} may contain only regular JSON files for export: ${entry.name}.`);
    files.push(readRequired(anchor, relativePath));
  }
  return files;
}
function plainObject2(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value;
}
function exactFields(value, fields, label) {
  plainObject2(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} contains unsupported fields: ${unknown.join(", ")}.`);
  return value;
}
function researchId(value, label) {
  if (typeof value !== "string" || !SAFE_RESEARCH_ID.test(value)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return value;
}
function nonEmptyText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be non-empty text.`);
  return value;
}
function nullableText(value, label) {
  if (value === null) return value;
  return nonEmptyText(value, label);
}
function stringArray(value, label, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${label} must be an array of non-empty strings.`);
  return value;
}
function plainArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}
function exactTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO timestamp.`);
  return value;
}
function enumeration(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  return value;
}
function assertFilename(file, expected, label) {
  if (path6.posix.basename(file.relativePath) !== expected) throw new Error(`${file.relativePath} does not match ${label} identifier ${expected}.`);
}
function validateWorkspace(value) {
  exactFields(value, WORKSPACE_FIELDS, "legacy JSON research Workspace");
  researchId(value.workspaceId, "legacy JSON research Workspace.workspaceId");
  for (const field of ["researchQuestion", "mainline", "contributionIntent", "currentFocus"]) nonEmptyText(value[field], `legacy JSON research Workspace.${field}`);
  exactTimestamp(value.createdAt, "legacy JSON research Workspace.createdAt");
  exactTimestamp(value.updatedAt, "legacy JSON research Workspace.updatedAt");
  if (value.updatedAt < value.createdAt) throw new Error("legacy JSON research Workspace.updatedAt must not precede createdAt.");
  return value;
}
function validateMissionEntry(entry) {
  const conclusion = entry.file.relativePath.endsWith(".conclusion.json");
  if (conclusion) {
    exactFields(entry.value, CONCLUSION_FIELDS, entry.file.relativePath);
    const missionId2 = researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
    assertFilename(entry.file, `${missionId2}.conclusion.json`, "Mission conclusion");
    enumeration(entry.value.outcome, ["completed", "blocked", "stopped"], `${entry.file.relativePath}.outcome`);
    nonEmptyText(entry.value.synthesis, `${entry.file.relativePath}.synthesis`);
    for (const field of ["failures", "limitations", "uncertainty", "sourceIds", "experimentIds", "claimIds", "recommendedBranches"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
    exactTimestamp(entry.value.concludedAt, `${entry.file.relativePath}.concludedAt`);
    return { kind: "conclusion", id: missionId2 };
  }
  exactFields(entry.value, MISSION_FIELDS, entry.file.relativePath);
  const missionId = researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  assertFilename(entry.file, `${missionId}.json`, "Mission");
  if (entry.value.parentMissionId !== null) researchId(entry.value.parentMissionId, `${entry.file.relativePath}.parentMissionId`);
  for (const field of ["dependsOnMissionIds", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
  for (const field of ["goal", "contributionRole"]) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
  nullableText(entry.value.branchKind, `${entry.file.relativePath}.branchKind`);
  nullableText(entry.value.branchReason, `${entry.file.relativePath}.branchReason`);
  exactTimestamp(entry.value.createdAt, `${entry.file.relativePath}.createdAt`);
  return { kind: "mission", id: missionId };
}
function validateSourceEntry(entry) {
  exactFields(entry.value, SOURCE_FIELDS, entry.file.relativePath);
  const sourceId = researchId(entry.value.sourceId, `${entry.file.relativePath}.sourceId`);
  assertFilename(entry.file, `${sourceId}.json`, "Source");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  if (entry.value.title === null && entry.value.locator === null) throw new Error(`${entry.file.relativePath} requires title or locator.`);
  for (const field of ["citationKey", "title", "locator", "sourceType"]) if (entry.value[field] !== null) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
  stringArray(entry.value.authors, `${entry.file.relativePath}.authors`);
  if (entry.value.year !== null && !["string", "number"].includes(typeof entry.value.year)) throw new Error(`${entry.file.relativePath}.year must be text, a number, or null.`);
  if (typeof entry.value.year === "string") nonEmptyText(entry.value.year, `${entry.file.relativePath}.year`);
  if (typeof entry.value.year === "number" && !Number.isFinite(entry.value.year)) throw new Error(`${entry.file.relativePath}.year must be finite.`);
  nonEmptyText(entry.value.summary, `${entry.file.relativePath}.summary`);
  enumeration(entry.value.relationship, ["consensus", "conflict", "condition-specific", "uncovered", "testable-gap"], `${entry.file.relativePath}.relationship`);
  for (const field of ["conditions", "conflicts", "limitations"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
  if (entry.value.capture !== null) {
    exactFields(entry.value.capture, CAPTURE_FIELDS, `${entry.file.relativePath}.capture`);
    nonEmptyText(entry.value.capture.path, `${entry.file.relativePath}.capture.path`);
    if (!SHA256.test(entry.value.capture.sha256)) throw new Error(`${entry.file.relativePath}.capture.sha256 must be a lowercase SHA-256 digest.`);
  }
  exactTimestamp(entry.value.recordedAt, `${entry.file.relativePath}.recordedAt`);
  return sourceId;
}
function validateExperimentEntry(entry) {
  const plan = entry.file.relativePath.endsWith(".plan.json");
  const result = entry.file.relativePath.endsWith(".result.json");
  if (!plan && !result) throw new Error(`${entry.file.relativePath} must use .plan.json or .result.json.`);
  if (plan) {
    exactFields(entry.value, PLAN_FIELDS, entry.file.relativePath);
    const experimentId2 = researchId(entry.value.experimentId, `${entry.file.relativePath}.experimentId`);
    assertFilename(entry.file, `${experimentId2}.plan.json`, "Experiment plan");
    researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
    for (const field of ["title", "cost", "risk", "failureValue", "contributionRole"]) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
    for (const field of ["hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`, ["protocol", "inputs", "metrics", "discriminatingObservations", "stopConditions"].includes(field) ? 1 : 0);
    exactTimestamp(entry.value.plannedAt, `${entry.file.relativePath}.plannedAt`);
    return { kind: "plan", id: experimentId2 };
  }
  exactFields(entry.value, RESULT_FIELDS, entry.file.relativePath);
  const experimentId = researchId(entry.value.experimentId, `${entry.file.relativePath}.experimentId`);
  assertFilename(entry.file, `${experimentId}.result.json`, "Experiment result");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  enumeration(entry.value.kind, ["positive", "negative", "null", "mixed", "failed", "stopped"], `${entry.file.relativePath}.kind`);
  nonEmptyText(entry.value.summary, `${entry.file.relativePath}.summary`);
  for (const field of ["observations", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
  plainArray(entry.value.measurements, `${entry.file.relativePath}.measurements`).forEach((measurement, index) => {
    exactFields(measurement, MEASUREMENT_FIELDS, `${entry.file.relativePath}.measurements[${index}]`);
    nonEmptyText(measurement.metric, `${entry.file.relativePath}.measurements[${index}].metric`);
    if (!["string", "number", "boolean"].includes(typeof measurement.value) || typeof measurement.value === "number" && !Number.isFinite(measurement.value)) throw new Error(`${entry.file.relativePath}.measurements[${index}].value is invalid.`);
    for (const field of ["unit", "condition", "denominatorRef", "note"]) if (measurement[field] !== void 0) nonEmptyText(measurement[field], `${entry.file.relativePath}.measurements[${index}].${field}`);
  });
  plainObject2(entry.value.denominator, `${entry.file.relativePath}.denominator`);
  plainArray(entry.value.hypothesisImpacts, `${entry.file.relativePath}.hypothesisImpacts`).forEach((impact, index) => {
    exactFields(impact, HYPOTHESIS_IMPACT_FIELDS, `${entry.file.relativePath}.hypothesisImpacts[${index}]`);
    nonEmptyText(impact.hypothesisRef, `${entry.file.relativePath}.hypothesisImpacts[${index}].hypothesisRef`);
    enumeration(impact.impact, ["supports", "weakens", "refutes", "mixed", "unchanged", "inconclusive"], `${entry.file.relativePath}.hypothesisImpacts[${index}].impact`);
    nonEmptyText(impact.rationale, `${entry.file.relativePath}.hypothesisImpacts[${index}].rationale`);
  });
  plainArray(entry.value.claimImpacts, `${entry.file.relativePath}.claimImpacts`).forEach((impact, index) => {
    exactFields(impact, CLAIM_IMPACT_FIELDS, `${entry.file.relativePath}.claimImpacts[${index}]`);
    researchId(impact.claimId, `${entry.file.relativePath}.claimImpacts[${index}].claimId`);
    enumeration(impact.impact, ["supports", "weakens", "refutes", "mixed", "unchanged", "inconclusive"], `${entry.file.relativePath}.claimImpacts[${index}].impact`);
    nonEmptyText(impact.rationale, `${entry.file.relativePath}.claimImpacts[${index}].rationale`);
  });
  exactTimestamp(entry.value.recordedAt, `${entry.file.relativePath}.recordedAt`);
  return { kind: "result", id: experimentId };
}
function validateClaimEntry(entry) {
  exactFields(entry.value, CLAIM_FIELDS, entry.file.relativePath);
  const claimId = researchId(entry.value.claimId, `${entry.file.relativePath}.claimId`);
  assertFilename(entry.file, `${claimId}.json`, "Claim");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  for (const field of ["statement", "storyRole"]) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
  for (const field of ["supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "artifactRefs"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
  enumeration(entry.value.assessment, ["supported", "weakened", "refuted", "inconclusive", "blocked"], `${entry.file.relativePath}.assessment`);
  if (entry.value.supersedesClaimId !== null) researchId(entry.value.supersedesClaimId, `${entry.file.relativePath}.supersedesClaimId`);
  nullableText(entry.value.revisionReason, `${entry.file.relativePath}.revisionReason`);
  exactTimestamp(entry.value.recordedAt, `${entry.file.relativePath}.recordedAt`);
  return claimId;
}
function validateReviewArtifact(value, label) {
  exactFields(value, REVIEW_ARTIFACT_FIELDS, label);
  nonEmptyText(value.path, `${label}.path`);
  if (!SHA256.test(value.sha256)) throw new Error(`${label}.sha256 must be a lowercase SHA-256 digest.`);
}
function validateReviewExchangeEntry(entry) {
  exactFields(entry.value, REVIEW_EXCHANGE_FIELDS, entry.file.relativePath);
  const exchangeId = researchId(entry.value.exchangeId, `${entry.file.relativePath}.exchangeId`);
  assertFilename(entry.file, `${exchangeId}.json`, "ReviewExchange");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  plainArray(entry.value.artifacts, `${entry.file.relativePath}.artifacts`).forEach((artifact, index) => validateReviewArtifact(artifact, `${entry.file.relativePath}.artifacts[${index}]`));
  if (entry.value.artifacts.length === 0) throw new Error(`${entry.file.relativePath}.artifacts must not be empty.`);
  exactTimestamp(entry.value.preparedAt, `${entry.file.relativePath}.preparedAt`);
  return exchangeId;
}
function validateReviewEntry(entry) {
  exactFields(entry.value, REVIEW_FIELDS, entry.file.relativePath);
  const reviewId = researchId(entry.value.reviewId, `${entry.file.relativePath}.reviewId`);
  const exchangeId = researchId(entry.value.exchangeId, `${entry.file.relativePath}.exchangeId`);
  if (reviewId !== exchangeId) throw new Error(`${entry.file.relativePath} reviewId must match exchangeId.`);
  assertFilename(entry.file, `${exchangeId}.json`, "Review");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  plainArray(entry.value.artifacts, `${entry.file.relativePath}.artifacts`).forEach((artifact, index) => validateReviewArtifact(artifact, `${entry.file.relativePath}.artifacts[${index}]`));
  if (entry.value.artifacts.length === 0) throw new Error(`${entry.file.relativePath}.artifacts must not be empty.`);
  enumeration(entry.value.status, ["completed", "blocked", "failed"], `${entry.file.relativePath}.status`);
  enumeration(entry.value.verdict, ["coherent", "needs-revision", "needs-evidence", "blocked"], `${entry.file.relativePath}.verdict`);
  for (const field of ["summary", "report"]) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
  for (const field of ["rubric", "actionItems", "limitations"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`, field === "rubric" ? 1 : 0);
  plainArray(entry.value.findings, `${entry.file.relativePath}.findings`).forEach((finding, index) => {
    exactFields(finding, /* @__PURE__ */ new Set(["findingId", "severity", "summary", "linkedArtifactPaths"]), `${entry.file.relativePath}.findings[${index}]`);
    researchId(finding.findingId, `${entry.file.relativePath}.findings[${index}].findingId`);
    enumeration(finding.severity, ["low", "medium", "high"], `${entry.file.relativePath}.findings[${index}].severity`);
    nonEmptyText(finding.summary, `${entry.file.relativePath}.findings[${index}].summary`);
    stringArray(finding.linkedArtifactPaths, `${entry.file.relativePath}.findings[${index}].linkedArtifactPaths`, 1);
  });
  plainObject2(entry.value.provenance, `${entry.file.relativePath}.provenance`);
  exactTimestamp(entry.value.reviewedAt, `${entry.file.relativePath}.reviewedAt`);
  return exchangeId;
}
function validateDirectionEntry(entry) {
  exactFields(entry.value, DIRECTION_FIELDS, entry.file.relativePath);
  const decisionId = researchId(entry.value.decisionId, `${entry.file.relativePath}.decisionId`);
  assertFilename(entry.file, `${decisionId}.json`, "Direction Decision");
  for (const field of ["priorDirection", "nextDirection"]) {
    exactFields(entry.value[field], DIRECTION_VALUE_FIELDS, `${entry.file.relativePath}.${field}`);
    for (const directionField of DIRECTION_VALUE_FIELDS) nonEmptyText(entry.value[field][directionField], `${entry.file.relativePath}.${field}.${directionField}`);
  }
  nonEmptyText(entry.value.reason, `${entry.file.relativePath}.reason`);
  stringArray(entry.value.evidenceRefs, `${entry.file.relativePath}.evidenceRefs`, 1);
  stringArray(entry.value.missionRefs, `${entry.file.relativePath}.missionRefs`, 1).forEach((missionId, index) => researchId(missionId, `${entry.file.relativePath}.missionRefs[${index}]`));
  exactTimestamp(entry.value.decidedAt, `${entry.file.relativePath}.decidedAt`);
  return decisionId;
}
function uniqueIds(entries, validator, label) {
  const ids = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    const id = validator(entry);
    if (ids.has(id)) throw new Error(`legacy JSON research export found duplicate ${label} identifier: ${id}.`);
    ids.add(id);
  }
  return ids;
}
function validateV2Records(workspace, raw) {
  validateWorkspace(workspace);
  const missionKinds = raw.missions.map((entry) => ({ entry, ...validateMissionEntry(entry) }));
  const missionEntries = missionKinds.filter(({ kind }) => kind === "mission").map(({ entry }) => entry);
  const conclusionEntries = missionKinds.filter(({ kind }) => kind === "conclusion").map(({ entry }) => entry);
  const missionIds = uniqueIds(missionEntries, (entry) => entry.value.missionId, "Mission");
  const conclusionIds = uniqueIds(conclusionEntries, (entry) => entry.value.missionId, "Mission conclusion");
  for (const missionId of conclusionIds) if (!missionIds.has(missionId)) throw new Error(`Mission conclusion ${missionId} has no matching Mission.`);
  for (const entry of missionEntries) {
    const references = [...entry.value.dependsOnMissionIds, ...entry.value.parentMissionId === null ? [] : [entry.value.parentMissionId]];
    for (const reference of references) if (!missionIds.has(reference)) throw new Error(`${entry.file.relativePath} references unknown Mission ${reference}.`);
  }
  const experimentKinds = raw.experiments.map((entry) => ({ entry, ...validateExperimentEntry(entry) }));
  const planEntries = experimentKinds.filter(({ kind }) => kind === "plan").map(({ entry }) => entry);
  const resultEntries = experimentKinds.filter(({ kind }) => kind === "result").map(({ entry }) => entry);
  const planIds = uniqueIds(planEntries, (entry) => entry.value.experimentId, "Experiment plan");
  const resultIds = uniqueIds(resultEntries, (entry) => entry.value.experimentId, "Experiment result");
  const planById = new Map(planEntries.map((entry) => [entry.value.experimentId, entry.value]));
  for (const entry of resultEntries) {
    const plan = planById.get(entry.value.experimentId);
    if (!plan) throw new Error(`Experiment result ${entry.value.experimentId} has no matching prospective plan.`);
    if (plan.missionId !== entry.value.missionId) throw new Error(`Experiment result ${entry.value.experimentId} does not match its plan Mission.`);
    for (const impact of entry.value.hypothesisImpacts) if (!plan.hypothesisRefs.includes(impact.hypothesisRef)) throw new Error(`${entry.file.relativePath} references a hypothesis absent from its plan: ${impact.hypothesisRef}.`);
  }
  for (const experimentId of resultIds) if (!planIds.has(experimentId)) throw new Error(`Experiment result ${experimentId} has no matching prospective plan.`);
  const sourceIds = uniqueIds(raw.sources, validateSourceEntry, "Source");
  const claimIds = uniqueIds(raw.claims, validateClaimEntry, "Claim");
  for (const entry of [...missionEntries, ...conclusionEntries, ...raw.sources, ...raw.claims, ...planEntries, ...resultEntries, ...raw.reviewExchanges, ...raw.reviews]) {
    if (Object.hasOwn(entry.value, "missionId") && !missionIds.has(entry.value.missionId)) throw new Error(`${entry.file.relativePath} references unknown Mission ${entry.value.missionId}.`);
  }
  for (const entry of conclusionEntries) {
    for (const sourceId of entry.value.sourceIds) if (!sourceIds.has(sourceId)) throw new Error(`${entry.file.relativePath} references unknown Source ${sourceId}.`);
    for (const experimentId of entry.value.experimentIds) if (!resultIds.has(experimentId)) throw new Error(`${entry.file.relativePath} references Experiment ${experimentId} without a result.`);
    for (const claimId of entry.value.claimIds) if (!claimIds.has(claimId)) throw new Error(`${entry.file.relativePath} references unknown Claim ${claimId}.`);
  }
  for (const entry of raw.claims) if (entry.value.supersedesClaimId !== null && !claimIds.has(entry.value.supersedesClaimId)) throw new Error(`${entry.file.relativePath} supersedes unknown Claim ${entry.value.supersedesClaimId}.`);
  for (const entry of resultEntries) for (const impact of entry.value.claimImpacts) if (!claimIds.has(impact.claimId)) throw new Error(`${entry.file.relativePath} references unknown Claim ${impact.claimId}.`);
  uniqueIds(raw.directionDecisions, validateDirectionEntry, "Direction Decision");
  for (const entry of raw.directionDecisions) for (const missionId of entry.value.missionRefs) if (!missionIds.has(missionId)) throw new Error(`${entry.file.relativePath} references unknown Mission ${missionId}.`);
  const exchangeIds = uniqueIds(raw.reviewExchanges, validateReviewExchangeEntry, "ReviewExchange");
  const reviewIds = uniqueIds(raw.reviews, validateReviewEntry, "Review");
  const exchangeById = new Map(raw.reviewExchanges.map((entry) => [entry.value.exchangeId, entry.value]));
  for (const entry of raw.reviews) {
    const exchange = exchangeById.get(entry.value.exchangeId);
    if (!exchange) throw new Error(`Review ${entry.value.exchangeId} has no matching ReviewExchange.`);
    if (entry.value.missionId !== exchange.missionId || JSON.stringify(entry.value.artifacts) !== JSON.stringify(exchange.artifacts)) throw new Error(`${entry.file.relativePath} does not match its ReviewExchange scope.`);
  }
  for (const exchangeId of reviewIds) if (!exchangeIds.has(exchangeId)) throw new Error(`Review ${exchangeId} has no matching ReviewExchange.`);
}
function directoryDeleteEntries(anchor) {
  return [...RECORD_DIRECTORY_PATHS].reverse().map((relativePath) => ({
    relativePath,
    state: fileState(anchor, relativePath)
  }));
}
function valueText(value) {
  if (value === null || value === void 0 || value === "") return null;
  if (typeof value === "string") return value;
  if (["number", "boolean"].includes(typeof value)) return String(value);
  return `\`${JSON.stringify(value)}\``;
}
function section(title, value) {
  const text = valueText(value);
  return text === null ? "" : `
## ${title}

${text}
`;
}
function bulletSection(title, value) {
  if (!Array.isArray(value) || value.length === 0) return "";
  return `
## ${title}

${value.map((item) => `- ${valueText(item)}`).join("\n")}
`;
}
function readableName(value, fallback) {
  const raw = [value?.title, value?.goal, value?.statement, value?.summary, value?.missionId, value?.experimentId, value?.sourceId, value?.exchangeId, value?.reviewId, value?.decisionId, fallback].find((item) => typeof item === "string" && item.trim());
  const normalized = raw.normalize("NFKC").trim().replace(SAFE_FILE_PART, "-").replace(/^-+|-+$/gu, "").slice(0, 80);
  return normalized || fallback;
}
function uniquePath(directory, base, used) {
  let suffix = 1;
  let relativePath = `${directory}/${base}.md`;
  while (used.has(relativePath)) {
    suffix += 1;
    relativePath = `${directory}/${base}-${suffix}.md`;
  }
  used.add(relativePath);
  return relativePath;
}
function renderObject(title, value, fields) {
  let markdown = `# ${title}
`;
  for (const [field, heading] of fields) {
    markdown += Array.isArray(value?.[field]) ? bulletSection(heading, value[field]) : section(heading, value?.[field]);
  }
  return `${markdown.trimEnd()}
`;
}
function renderMission(value, conclusion) {
  let markdown = renderObject(readableName(value, "Mission"), value, [
    ["goal", "Goal"],
    ["requirements", "Requirements"],
    ["assumptions", "Assumptions"],
    ["scope", "Scope"],
    ["outOfScope", "Out of scope"],
    ["evidenceRequirements", "Evidence needs"],
    ["competingHypotheses", "Competing hypotheses"],
    ["openQuestions", "Open questions"],
    ["contextRefs", "Related material"],
    ["branchReason", "Branch context"],
    ["contributionRole", "Contribution role"]
  ]);
  if (conclusion) markdown += `
${renderObject("Recorded conclusion", conclusion, [["outcome", "Outcome"], ["synthesis", "Synthesis"], ["failures", "Failures"], ["limitations", "Limitations"], ["uncertainty", "Uncertainty"], ["recommendedBranches", "Recommended next work"]])}`;
  return markdown;
}
function renderExperiment(plan, result) {
  let markdown = renderObject(readableName(plan ?? result, "Experiment"), plan ?? {}, [
    ["title", "Why this experiment matters"],
    ["hypothesisRefs", "Hypotheses or competing explanations"],
    ["protocol", "Prospective protocol"],
    ["inputs", "Inputs"],
    ["comparisons", "Comparisons"],
    ["metrics", "Metrics"],
    ["discriminatingObservations", "Discriminating observations"],
    ["successConditions", "Success conditions"],
    ["stopConditions", "Stop conditions"],
    ["constraints", "Constraints"],
    ["expectedArtifacts", "Expected artifacts"],
    ["cost", "Cost"],
    ["risk", "Risk"],
    ["failureValue", "Failure value"]
  ]);
  if (result) markdown += `
${renderObject("Actual execution and result", result, [["kind", "Recorded outcome"], ["summary", "Summary"], ["observations", "Observations"], ["measurements", "Measurements"], ["denominator", "Denominator"], ["hypothesisImpacts", "Hypothesis impacts"], ["claimImpacts", "Claim impacts"], ["unexpectedObservations", "Unexpected observations"], ["artifactRefs", "Artifacts"], ["failures", "Failures"], ["deviations", "Deviations"], ["limitations", "Limitations"], ["uncertainty", "Uncertainty"]])}`;
  return markdown;
}
function renderSource(value) {
  return renderObject(readableName(value, "Source"), value, [["citationKey", "Citation key"], ["title", "Title"], ["authors", "Authors"], ["year", "Year"], ["locator", "Locator"], ["sourceType", "Source type"], ["summary", "What was learned"], ["conditions", "Conditions"], ["relationship", "Relationship to the work"], ["conflicts", "Conflicts"], ["limitations", "Limitations"], ["capture", "Preserved capture"]]);
}
function renderClaim(value) {
  return renderObject(readableName(value, "Claim"), value, [["statement", "Claim"], ["supportRefs", "Recorded support"], ["counterEvidenceRefs", "Recorded counter-evidence"], ["missingEvidence", "Missing evidence"], ["cannotSay", "Cannot say"], ["uncertainty", "Uncertainty"], ["assessment", "Former assessment"], ["storyRole", "Role in the argument"], ["artifactRefs", "Related artifacts"], ["revisionReason", "Revision context"]]);
}
function renderDirection(value) {
  return renderObject(readableName(value, "Direction-change"), value, [["priorDirection", "Previous direction"], ["nextDirection", "Next direction"], ["reason", "Why it changed"], ["evidenceRefs", "Recorded evidence"], ["missionRefs", "Related work"]]);
}
function renderReview(exchange, review) {
  const source = exchange ?? review ?? {};
  let markdown = renderObject(readableName(source, "Review"), source, [["artifacts", "Declared artifact scope"], ["preparedAt", "Prepared at"]]);
  if (review) markdown += `
${renderObject("Returned review", review, [["status", "Recorded status"], ["verdict", "Former verdict"], ["summary", "Summary"], ["rubric", "Rubric"], ["findings", "Findings"], ["actionItems", "Action items"], ["report", "Original report"], ["provenance", "Reported provenance"], ["limitations", "Limitations"]])}`;
  else markdown += "\n## Review return\n\nNo returned review was present in the legacy JSON research state.\n";
  return markdown;
}
function overview(workspace, links, directions) {
  const lines = ["# Research overview", "", "## Current research", "", workspace.researchQuestion ?? "Not recorded.", "", "## Mainline", "", workspace.mainline ?? "Not recorded."];
  if (workspace.contributionIntent) lines.push("", "## Contribution target", "", workspace.contributionIntent);
  if (workspace.currentFocus) lines.push("", "## Current focus", "", workspace.currentFocus);
  if (links.length > 0) lines.push("", "## Exported documents", "", ...links.map((entry) => `- [${entry.label}](${entry.link})`));
  if (directions.length > 0) lines.push("", "## Recorded direction changes", "", ...directions.map((entry) => `- [${entry.label}](${entry.link})`));
  lines.push("", "## Export note", "", "This overview was mechanically exported from legacy Dove JSON research records. Review the documents, repair natural links and names, and do not treat the export as scientific validation.", "");
  return lines.join("\n");
}
function relativeLink(from, to) {
  return path6.posix.relative(path6.posix.dirname(from), to);
}
function previewResearchExport(start, options = {}) {
  const fsOps = options.fsOps ?? fs6;
  const root = canonicalRoot3(start, fsOps);
  const anchor = openRootedFilesystem(root, { ...options, fsOps });
  const required = new Map(REQUIRED_FILES.map((relativePath) => [relativePath, readRequired(anchor, relativePath)]));
  const marker = strictJson(required.get(".dove/format.json"));
  if (!marker || marker.format !== V2_FORMAT2 || Object.keys(marker).length !== 1) throw new Error(`Research export accepts only an exact ${V2_FORMAT2} marker.`);
  const workspace = strictJson(required.get(".dove/workspace.json"));
  const lessonsBytes = required.get(".dove/LESSONS.md").bytes;
  let lessonsText;
  try {
    lessonsText = new TextDecoder("utf-8", { fatal: true }).decode(lessonsBytes);
  } catch (error) {
    throw new Error(".dove/LESSONS.md must contain valid UTF-8 Markdown.", { cause: error });
  }
  if (lessonsText.includes("\0")) throw new Error(".dove/LESSONS.md contains null bytes.");
  const raw = Object.fromEntries(RECORD_DIRECTORIES.map(([directory, key]) => [key, listJson(anchor, `.dove/${directory}`).map((file) => ({ file, value: strictJson(file) }))]));
  validateV2Records(workspace, raw);
  const archiveStamp = timestamp(options.now);
  const archiveDirectory = `${ARCHIVE_ROOT}/research-format-v2-${archiveStamp}`;
  if (fileState(anchor, archiveDirectory).exists) throw new Error(`Research export archive already exists: ${archiveDirectory}.`);
  const researchRootState = fileState(anchor, NEW_ROOT);
  if (researchRootState.exists && researchRootState.type !== "directory") throw new Error(`${NEW_ROOT} must be a real directory when legacy research is exported additively.`);
  const defaults = prepareResearchDefaults(root, {
    ...options,
    fsOps,
    label: "Dove research export defaults"
  });
  const used = new Set(RESEARCH_DEFAULT_FILE_PATHS);
  if (researchRootState.exists) {
    const targetDirectories = new Set(RECORD_DIRECTORIES.map(([directory]) => directory === "review-exchanges" ? "reviews" : directory === "direction-decisions" ? "missions" : directory));
    for (const targetDirectory of targetDirectories) {
      const relativeDirectory = `${NEW_ROOT}/${targetDirectory}`;
      const directoryState = fileState(anchor, relativeDirectory);
      if (!directoryState.exists) continue;
      if (directoryState.type !== "directory") throw new Error(`${relativeDirectory} must be a real directory when legacy research is exported additively.`);
      for (const entry of anchor.readdir(relativeDirectory, { withFileTypes: true })) {
        const relativePath = `${relativeDirectory}/${entry.name}`;
        if (entry.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
        if (entry.isFile() || entry.isDirectory()) used.add(relativePath);
        else throw new Error(`${relativePath} has an unsupported file type.`);
      }
    }
  }
  const documents = [];
  const links = [];
  const directions = [];
  const add = (directory, value, fallback, content, collection = links) => {
    const target = uniquePath(`${NEW_ROOT}/${directory}`, readableName(value, fallback), used);
    documents.push({ relativePath: target, content });
    collection.push({
      label: readableName(value, fallback),
      target,
      link: relativeLink(`${NEW_ROOT}/RESEARCH.md`, target)
    });
    return target;
  };
  const conclusionByMission = new Map(raw.missions.filter((entry) => entry.file.relativePath.endsWith(".conclusion.json")).map((entry) => [entry.value?.missionId, entry.value]));
  for (const entry of raw.missions.filter((item) => !item.file.relativePath.endsWith(".conclusion.json"))) add("missions", entry.value, "Mission", renderMission(entry.value, conclusionByMission.get(entry.value?.missionId)));
  const resultByExperiment = new Map(raw.experiments.filter((entry) => entry.file.relativePath.endsWith(".result.json")).map((entry) => [entry.value?.experimentId, entry.value]));
  for (const entry of raw.experiments.filter((item) => item.file.relativePath.endsWith(".plan.json"))) add("experiments", entry.value, "Experiment", renderExperiment(entry.value, resultByExperiment.get(entry.value?.experimentId)));
  for (const entry of raw.sources) add("sources", entry.value, "Source", renderSource(entry.value));
  for (const entry of raw.claims) add("claims", entry.value, "Claim", renderClaim(entry.value));
  for (const entry of raw.directionDecisions) add("missions", entry.value, "Direction-change", renderDirection(entry.value), directions);
  const reviewByExchange = new Map(raw.reviews.map((entry) => [entry.value?.exchangeId ?? entry.value?.reviewId, entry.value]));
  const exchangeIds = /* @__PURE__ */ new Set();
  for (const entry of raw.reviewExchanges) {
    exchangeIds.add(entry.value?.exchangeId);
    add("reviews", entry.value, "Review", renderReview(entry.value, reviewByExchange.get(entry.value?.exchangeId)));
  }
  for (const entry of raw.reviews.filter((item) => !exchangeIds.has(item.value?.exchangeId ?? item.value?.reviewId))) add("reviews", entry.value, "Review", renderReview(null, entry.value));
  const desiredWrites = new Map(defaults.plan.writes);
  const desiredDeletes = new Set(defaults.plan.deletes);
  const stateFor2 = (relativePath) => defaults.snapshot.states.get(relativePath) ?? {
    exists: false,
    type: "absent",
    bytes: null,
    text: null,
    sha256: null,
    mode: null
  };
  const currentText2 = (relativePath) => desiredWrites.has(relativePath) ? new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(desiredWrites.get(relativePath)) : stateFor2(relativePath).text;
  const setDesired = (relativePath, content) => {
    const bytes = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), "utf8");
    const state2 = stateFor2(relativePath);
    if (state2.exists && state2.bytes.equals(bytes)) desiredWrites.delete(relativePath);
    else desiredWrites.set(relativePath, bytes);
  };
  const overviewPath = RESEARCH_DEFAULT_PATHS.overview;
  const exportedOverview = overview(workspace, links, directions);
  setDesired(
    overviewPath,
    appendExactMarkdownBlocks(currentText2(overviewPath) ?? "", [exportedOverview])
  );
  const summaryLinks = /* @__PURE__ */ new Map([
    ["missions", []],
    ["experiments", []],
    ["sources", []],
    ["reviews", []],
    ["claims", []]
  ]);
  for (const link of [...links, ...directions]) {
    const directory = path6.posix.basename(path6.posix.dirname(link.target));
    summaryLinks.get(directory)?.push(`- [${link.label}](${relativeLink(RESEARCH_DEFAULT_PATHS[`${directory}Summary`], link.target)})`);
  }
  for (const [directory, lines] of summaryLinks) {
    if (lines.length === 0) continue;
    const summaryPath = RESEARCH_DEFAULT_PATHS[`${directory}Summary`];
    setDesired(
      summaryPath,
      appendExactMarkdownLines(currentText2(summaryPath) ?? "", "## Imported legacy documents", lines)
    );
  }
  const importedLessonsPath = RESEARCH_DEFAULT_PATHS.importedLessons;
  const importedState = stateFor2(importedLessonsPath);
  if (!importedState.exists) setDesired(importedLessonsPath, lessonsBytes);
  else setDesired(importedLessonsPath, appendExactMarkdownBytes(importedState.bytes, lessonsBytes));
  const lessonsSummaryPath = RESEARCH_DEFAULT_PATHS.lessonsSummary;
  setDesired(
    lessonsSummaryPath,
    appendExactMarkdownLines(currentText2(lessonsSummaryPath) ?? "", "## Imported guidance", [IMPORTED_LESSONS_LINK])
  );
  documents.unshift(...[...desiredWrites.entries()].map(([relativePath, content]) => ({
    relativePath,
    content,
    expectedState: stateFor2(relativePath)
  })));
  const oldFiles = [...required.values(), ...Object.values(raw).flat().map((entry) => entry.file)];
  const oldDirectories = directoryDeleteEntries(anchor);
  const archiveFiles = oldFiles.map((file) => ({ relativePath: `${archiveDirectory}/${file.relativePath.slice(`${OLD_ROOT}/`.length)}`, content: file.bytes }));
  return {
    status: "ready",
    action: "export-research",
    target: root,
    from: V2_FORMAT2,
    to: "markdown",
    researchDirectory: NEW_ROOT,
    archiveDirectory,
    writtenPaths: [...documents.map((entry) => entry.relativePath), ...archiveFiles.map((entry) => entry.relativePath)],
    archivedPaths: archiveFiles.map((entry) => entry.relativePath),
    plan: {
      documents,
      researchDeletes: [...desiredDeletes].map((relativePath) => ({
        relativePath,
        state: stateFor2(relativePath)
      })),
      archiveFiles,
      sourceFiles: oldFiles.map((file) => ({ relativePath: file.relativePath, state: file.state })),
      sourceDirectories: oldDirectories
    }
  };
}
function exportResearch(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Research export requires confirmed: true after preview.");
  const preview = previewResearchExport(start, options);
  const entries = [
    ...preview.plan.documents.map((entry) => ({
      root: preview.target,
      relativePath: entry.relativePath,
      content: entry.content,
      force: entry.expectedState?.exists === true,
      expectedState: expectedTransactionState(entry.expectedState ?? { exists: false }),
      label: "Research Markdown export"
    })),
    ...preview.plan.researchDeletes.map((entry) => ({
      root: preview.target,
      relativePath: entry.relativePath,
      delete: true,
      force: true,
      expectedState: expectedTransactionState(entry.state),
      label: "Retired top-level research Lessons"
    })),
    ...preview.plan.archiveFiles.map((entry) => ({ root: preview.target, relativePath: entry.relativePath, content: entry.content, force: false, expectedState: { exists: false, type: "absent", sha256: null, mode: null }, label: "Legacy JSON research archive" })),
    ...preview.plan.sourceFiles.map((entry) => ({ root: preview.target, relativePath: entry.relativePath, delete: true, expectedState: entry.state, label: "Retired Dove legacy JSON research state" })),
    ...preview.plan.sourceDirectories.map((entry) => ({
      root: preview.target,
      relativePath: entry.relativePath,
      delete: true,
      deleteEmptyDirectory: entry.state.exists,
      expectedState: entry.state,
      label: "Retired legacy JSON research directory"
    }))
  ];
  const result = writeFileSetTransaction(entries, {
    ...options,
    transactionBase: ".dove/install/transactions"
  });
  return { status: "exported", action: preview.action, target: preview.target, from: preview.from, to: preview.to, researchDirectory: preview.researchDirectory, archiveDirectory: preview.archiveDirectory, ...result };
}

// src/core/paper-search-integration.mjs
var PAPER_SEARCH_MCP_SERVER_NAME = "dove-paper-search";
var PAPER_SEARCH_MCP_PATH = ".mcp.json";
var PAPER_SEARCH_MCP_SELECTOR = `/mcpServers/${PAPER_SEARCH_MCP_SERVER_NAME}`;
var PAPER_SEARCH_PACKAGE = "paper-search-mcp";
var PAPER_SEARCH_PACKAGE_VERSION = "0.1.4";
var PAPER_SEARCH_PACKAGE_SPECIFIER = `${PAPER_SEARCH_PACKAGE}==${PAPER_SEARCH_PACKAGE_VERSION}`;
var PAPER_SEARCH_SUPPORT_SKILL_PATH = ".claude/skills/dove-paper-search/SKILL.md";
var PAPER_SEARCH_MCP_FRAGMENT = Object.freeze({
  type: "stdio",
  command: "uvx",
  args: Object.freeze(["--from", PAPER_SEARCH_PACKAGE_SPECIFIER, PAPER_SEARCH_PACKAGE])
});
function renderPaperSearchSupportSkill() {
  return `---
name: dove-paper-search
description: Search, retrieve, and read academic papers through the approved dove-paper-search project MCP when scholarly material is relevant.
user-invocable: false
---

# Dove Paper Search

Use the \`dove-paper-search\` project MCP only when academic paper discovery, retrieval, or full-text reading materially helps the current request.

- Keep searches bounded and choose relevant scholarly sources instead of searching every provider by default.
- Download or read full text only when the task needs it. Distinguish material merely found, downloaded, or actually read, and report saved paths when useful.
- Prefer source-native open download and read tools. If \`download_with_fallback\` is needed, always pass \`use_scihub: false\` explicitly. Do not call Sci-Hub tools.
- Use only MCP tools already available and approved by the user. If approval is missing, \`uvx\` is unavailable, or the server fails, say so directly; do not install dependencies or use a CLI or shell fallback for this MCP. This boundary does not forbid other already-approved host web/search tools, local PDFs, URLs, or user-provided material that can still support the source task.
- Do not turn paper identifiers into Dove IDs, hashes, trust scores, ledgers, or database records.
`;
}

// src/core/dove-agent-persona.mjs
var DOVE_AGENT_NAME = DOVE_RESEARCH_AGENT_NAME;
var DOVE_AGENT_DESCRIPTION = DOVE_RESEARCH_AGENT_DESCRIPTION;
var DOVE_AGENT_FRAME = DOVE_RESEARCH_FRAME;
var DOVE_AGENT_HUNCH = DOVE_RESEARCH_HUNCH;
var DOVE_AGENT_CURIOSITY = DOVE_RESEARCH_CURIOSITY;
var DOVE_AGENT_LAYERING = DOVE_RESEARCH_LAYERING;
var DOVE_AGENT_PROPORTIONALITY = DOVE_RESEARCH_PROPORTIONALITY;
var DOVE_AGENT_STOPPING = DOVE_RESEARCH_STOPPING;
var DOVE_AGENT_PERSONA_BULLETS = DOVE_RESEARCH_PERSONA_BULLETS;
var DOVE_AGENT_CAPSULE_BULLETS = DOVE_RESEARCH_CAPSULE_BULLETS;
var DOVE_AGENT_DIRECT_JUDGMENT = DOVE_RESEARCH_DIRECT_JUDGMENT;
function bullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}
function renderDoveAgentPersonaSection() {
  return `## Dove research-agent persona

${bullets(DOVE_AGENT_PERSONA_BULLETS)}`;
}
function renderDoveAgentInstructions() {
  return `# Dove Agent

${DOVE_RESEARCH_ONE_AGENT} ${DOVE_RESEARCH_FLAT_SKILL_SENTENCE}

${renderDoveAgentPersonaSection()}

## Tool and Markdown boundaries

- ${DOVE_RESEARCH_HOST_TOOL_BOUNDARY}
- Maintain Dove research Markdown when ${DOVE_RESEARCH_MAINTENANCE_TRIGGER}.
- ${DOVE_RESEARCH_DIRECT_JUDGMENT}
- When a review is requested, use reviewer perspective to test the claim, evidence, method, novelty, limitations, and likely reader confusion; separate review handoffs remain user-managed.
- For a manuscript submission-readiness Auto mainline, ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_GATE} ${DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY} ${DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY} ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_LOOP}
- ${DOVE_RESEARCH_AUTO_EXPLICIT_ONLY} It runs as a goal/mission cycle until the goal is achieved, a real boundary appears, or the budget ends.
- Do not expose planning, authoring, or reviewing as user-switchable Dove personas. Separate review remains a user-managed exchange, not proof of independence or authority.
`;
}

// src/core/dove-agent-definition.mjs
var DOVE_AGENT_SURFACES = Object.freeze({
  claude: ".claude/agents/dove.md"
});
var DOVE_AGENT_DEFINITION = Object.freeze({
  id: DOVE_AGENT_NAME,
  publicName: "Dove",
  title: DOVE_AGENT_NAME,
  description: DOVE_AGENT_DESCRIPTION,
  responsibility: DOVE_RESEARCH_AGENT_RESPONSIBILITY
});
function renderClaudeDoveAgent() {
  return `---
name: ${DOVE_AGENT_NAME}
description: ${DOVE_AGENT_DESCRIPTION}
---

${renderDoveAgentInstructions()}`;
}
function generatedDoveAgentEntries() {
  return [
    { relativePath: DOVE_AGENT_SURFACES.claude, content: renderClaudeDoveAgent() }
  ];
}

// src/core/command-manifest.mjs
var PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
var PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs", "scripts/dove-user-prompt-submit-package.mjs"];
var RETIRED_PACKAGE_RUNTIME_PATHS = [
  "mcp/dove-state-server-package.mjs",
  "scripts/doctor-mcp-probe-package.mjs"
];
var PROJECT_HOST_IDS = ["claude", "dsh"];
var HOST_IDS = [...PROJECT_HOST_IDS];
var DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  ".claude/skills/dove-paper-search/SKILL.md",
  ".claude/settings.json"
]);
var PACKAGE_RESOURCE_ROOT = "package-resources/hosts";
var PACKAGE_GENERATED_SUPPORT_PATHS = Object.freeze([
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/agents/dove.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/rules/dove.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/skills/dove-intake/SKILL.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/skills/dove-paper-search/SKILL.md`
]);
var HOST_DEFINITIONS = {
  claude: { label: "Claude Code", scope: "project", jsonChecks: [] },
  dsh: { label: "DeepSeek Harness (dsh)", scope: "project", jsonChecks: [] }
};
var HOST_ADAPTER_POLICY = Object.freeze({
  toolAccess: Object.freeze({ transport: "host-files", unavailable: "report", cliFallback: false, shellFallback: false }),
  privacy: Object.freeze({ exposePrivateProtocol: false }),
  adapterBullets: DOVE_RESEARCH_CAPSULE_BULLETS
});
var RESEARCH_FRAME = DOVE_RESEARCH_FRAME;
var RESEARCH_ADVANCE = DOVE_RESEARCH_ADVANCE;
var RESEARCH_HUNCH = DOVE_RESEARCH_HUNCH;
var JUDGMENT_BOUNDARY = DOVE_RESEARCH_JUDGMENT_BOUNDARY;
var RESEARCH_MAINTENANCE_TRIGGER = DOVE_RESEARCH_MAINTENANCE_TRIGGER;
var host = (instruction, options = {}) => ({
  type: "host",
  capability: options.capability ?? "ordinary-project-work",
  readOnly: options.readOnly === true,
  persistWhen: options.persistWhen ?? "never",
  persistencePolicy: options.persistencePolicy ?? "never",
  instruction
});
var commonClarification = ["Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation."];
var readResearchDocuments = (instruction) => host(instruction, { capability: "research-document-reading", readOnly: true });
var updateResearchDocuments = (instruction, options = {}) => host(instruction, {
  capability: "research-document-maintenance",
  persistWhen: options.persistWhen ?? RESEARCH_MAINTENANCE_TRIGGER,
  persistencePolicy: options.persistencePolicy ?? "standard-research"
});
var relevantLessons = host(
  "When reusable guidance may help the current task, read `.dove/research/lessons/LESSONS.md`, then only the naturally linked theme documents directly relevant to the work. Do not read unrelated themes or give any one Lesson special treatment. Treat Lessons as fallible advice, never as evidence or authority.",
  { capability: "lesson-reading", readOnly: true }
);
var AREA = Object.freeze({
  missions: Object.freeze({ directory: "missions", summary: "MISSIONS.md" }),
  experiments: Object.freeze({ directory: "experiments", summary: "EXPERIMENTS.md" }),
  sources: Object.freeze({ directory: "sources", summary: "SOURCES.md" }),
  reviews: Object.freeze({ directory: "reviews", summary: "REVIEWS.md" }),
  claims: Object.freeze({ directory: "claims", summary: "CLAIMS.md" }),
  lessons: Object.freeze({ directory: "lessons", summary: "LESSONS.md" })
});
function areaPath(area) {
  const value = AREA[area];
  return `.dove/research/${value.directory}/${value.summary}`;
}
function readArea(area, purpose) {
  return readResearchDocuments(
    `When existing Dove research context would materially help ${purpose}, read \`.dove/research/RESEARCH.md\`, then \`${areaPath(area)}\`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally rather than inferring a database state.`
  );
}
function maintainArea(area, instruction) {
  return updateResearchDocuments(
    `${instruction} Update only the narrowest relevant research document. Update \`${areaPath(area)}\` only when its own links or synthesis materially change. Update \`.dove/research/RESEARCH.md\` only for a project-level mainline, conclusion, navigation, or priority change.`
  );
}
function workflow(slug) {
  if (slug === "research") return {
    status: "single-bounded-pass",
    modes: [{ id: "default", when: "The user requests one bounded pass of research framing, investigation, synthesis, or project work.", steps: [
      readArea("missions", "the bounded research goal"),
      relevantLessons,
      host(`Inspect the relevant ordinary project materials and real external resources needed to understand the question. ${RESEARCH_FRAME} ${RESEARCH_HUNCH}`, { capability: "project-exploration", readOnly: true }),
      host(`Complete exactly one bounded research or project pass. ${RESEARCH_ADVANCE} ${JUDGMENT_BOUNDARY} Produce the requested analysis or artifact, advance a real judgment or eliminate a serious candidate, and stop after the bounded deliverable rather than turning Research into multi-round autonomy.`, { capability: "research-work" }),
      maintainArea("missions", "When the maintenance trigger is met, update the existing Mission document or create one naturally named Mission document for the bounded goal, substantive work, current conclusion, and useful next branches.")
    ], clarification: commonClarification }]
  };
  if (slug === "auto") return {
    status: "explicit-multi-round-autonomy",
    modes: [{ id: "default", when: "The user explicitly invokes high-autonomy multi-round research on the current mainline or an immediate stated goal.", steps: [
      readResearchDocuments(`${DOVE_RESEARCH_AUTO_GOAL_RECOVERY} For a paper project whose mainline is submission readiness, continue until the whole manuscript and required submission package are actually ready or a material blocker cannot be resolved under current conditions. ${DOVE_RESEARCH_MANUSCRIPT_READINESS_BASIS} ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_GATE} ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_BOUNDARY} ${DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY} ${DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY}`),
      host(`${DOVE_RESEARCH_AUTO_CYCLE} ${DOVE_RESEARCH_SUPPORT_SUBORDINATION_BOUNDARY} ${DOVE_RESEARCH_AUTO_NOT_MECHANICAL_SKILLS} Use the recovered whole-manuscript readiness basis to choose the next material action; do not let one visible formatting or artifact gap displace a higher-order scientific or scholarly blocker. ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_GATE} ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_BOUNDARY} ${DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY} ${DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY} ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_LOOP} ${DOVE_RESEARCH_WHOLE_MANUSCRIPT_READINESS_BOUNDARY} ${DOVE_RESEARCH_AUTO_REPORTING_BOUNDARY} ${DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY} Repeat the decision cycle as needed. Finishing one edit, check, Review invocation, export, or validation is a result to reassess, not a reason to close Auto. If the goal is not achieved and another feasible in-scope action is likely to matter, perform that action in the same Auto run and continue the next cycle; do not stop after describing work that Auto can still carry out.`, { capability: "autonomous-research-work" }),
      updateResearchDocuments(`${DOVE_RESEARCH_SUPPORT_SUBORDINATION_BOUNDARY} This maintenance step is conditional support, not a per-cycle closing phase or a substitute for resuming interrupted work. Skip maintenance unless the result materially changes the active mainline, conclusion, decision, or priority, or durable recovery genuinely requires a narrow project document. Update only the narrowest relevant naturally named document; keep \`RESEARCH.md\` concise and update it only for a real project-level mainline, conclusion, navigation, or priority change. Never infer Lessons maintenance from Auto completion or a Stop continuation; maintain Lessons only when the explicit request is to remember, reflect, or preserve durable guidance.`, { persistencePolicy: "auto-subordinate" }),
      host(`${DOVE_RESEARCH_AUTO_REPORTING_BOUNDARY} Final synthesis is allowed only after a real stop condition is met. For manuscript submission readiness, a goal-achieved synthesis requires a current Review invocation returning \`PASS\` on the latest material state; otherwise synthesize only a real unresolved boundary, not submit-ready completion. If another executable in-scope action is still likely to change the mainline, return to autonomous research work and perform it rather than reporting it as a future next step. Do not stop merely because one pass or support task finished. Stop only when the goal is achieved, the user budget ends, no feasible action is likely to change the research decision, or a safety, genuinely competing direction, required external return, or other real boundary needs user input.`, { capability: "research-synthesis", readOnly: true })
    ], clarification: commonClarification }]
  };
  if (slug === "status") return {
    status: "read-only",
    modes: [{ id: "default", when: "The user requests current Dove research status.", steps: [
      readResearchDocuments("Read `.dove/research/RESEARCH.md` once when it exists, then read the one or more directory summaries needed for the question, then only directly linked details needed to resolve material ambiguity. Do not recursively scan the research tree. Report the current mainline, substantive progress, active problems, decisions, and next priorities. If an overview, summary, or link is absent, say so naturally; do not infer a database state or modify files."),
      relevantLessons
    ], clarification: [] }]
  };
  if (slug === "source") return {
    status: "bounded-source-work",
    modes: [{ id: "default", when: "The user requests source discovery, reading, comparison, or verification.", steps: [
      readArea("sources", "the source question"),
      relevantLessons,
      host("Discover, retrieve when available, save when useful, read, and verify real material with available and approved host-native project or external research tools. Distinguish material merely found from material actually retrieved, inspected, and used; when one source path is unavailable, report that boundary and continue with other approved local, web, or user-provided material that can still inform the question.", { capability: "source-research" }),
      maintainArea("sources", "When a used source deserves durable context, create or update one naturally named source note under `sources/` with the citation or URL, what was actually inspected and learned, and useful related links. Do not generate a Source ID, fingerprint, or byte hash.")
    ], clarification: commonClarification }]
  };
  if (slug === "experiment") return {
    status: "planned-experiment-work",
    modes: [{ id: "default", when: "The user requests experiment design, execution, analysis, or recording.", steps: [
      readArea("experiments", "the experiment"),
      relevantLessons,
      host(`Follow the user's actual experiment request. ${JUDGMENT_BOUNDARY} Before treating a new experiment as central, establish the real problem, key uncertainty, or route decision it should resolve from the request and project context; if that basis is not yet established, pause central experiment design and inspect the actual project material, relevant sources, or smallest low-risk diagnostic needed to investigate the problem; do not invent a substitute experiment or stop at merely admitting the basis is missing. ${RESEARCH_HUNCH} For a new experiment that will be executed and needs recording for future recovery, choose or create one naturally named Experiment document under \`experiments/\` and write what it tests and how the result will be judged. For design-only work, produce an executable plan and stop before central execution. For analysis of existing results, inspect and analyze those results directly. For retrospective recording, label it as retrospective rather than presenting it as a prospective plan.`, { capability: "experiment-design" }),
      host("Execute the central experiment only when the request calls for execution. Use normal host tools. Append the actual procedure, result, and any deviation that changes the interpretation to the same Experiment document used for the prospective plan only when the maintenance trigger is met. For analysis-only or retrospective work, do not invent an execution step.", { capability: "experiment-execution" }),
      maintainArea("experiments", "When the maintenance trigger is met, record the experiment, diagnostic, result, failure, and the research decision it informs in the relevant Experiment document.")
    ], clarification: commonClarification }]
  };
  if (slug === "draft") return {
    status: "artifact-work",
    modes: [{ id: "default", when: "The user requests drafting, assessment, or revision of ordinary project text or artifacts.", steps: [
      readArea("claims", "the draft and its material claims"),
      relevantLessons,
      host("Read the target and relevant project material, then draft, assess, create, or revise the ordinary artifact with host editing tools when the requested deliverable requires it.", { capability: "artifact-editing" }),
      host("Run the checks needed for the requested artifact. If checks reveal in-scope fixable issues, route back to artifact editing before the final response; report only remaining issues that materially affect the artifact, exceed scope, or require user judgment.", { capability: "artifact-validation", readOnly: true }),
      maintainArea("claims", "Create or revise a naturally named Claim document under `claims/` only when an important research claim needs durable treatment. Do not build a Claim database.")
    ], clarification: commonClarification }]
  };
  if (slug === "figure") return {
    status: "artifact-work",
    modes: [{ id: "default", when: "The user requests a figure, diagram, plot, caption, or figure assessment.", steps: [
      readResearchDocuments("When existing Dove research context would materially help the requested figure, read `.dove/research/RESEARCH.md`, then the directly relevant Mission or Experiment summary, then only needed linked details. Otherwise work directly from the user's requested materials and data. Do not recursively scan the research tree."),
      relevantLessons,
      host("Inspect the requested figure's evidence job in the manuscript or research argument and gather the actual data, selection metadata, source visuals, plotting or rendering code, captions, nearby claims, and intended manuscript layout needed to judge that job. Create or revise the figure with the best-suited available specialized tool: use real data and reproducible plotting code for quantitative or statistical plots; use an available specialized figure-generation model for method diagrams, conceptual illustrations, or visual abstracts when it is the best fit; and use suitable SVG, layout, annotation, or image-editing tools for composition and repair. Do not invent data, results, or method details, and do not treat opening, contact-sheeting, or re-exporting an unchanged figure as improvement. Put scratch renders and validation intermediates in a repository-local temporary workspace such as `.claude/tmp/`, not the system `/tmp`, unless the user explicitly directs otherwise.", { capability: "figure-creation" }),
      host("Inspect the actual rendered figure in its reviewer-facing manuscript layout and at realistic final size, not only as a standalone source image or contact sheet. Check proportionately that it performs its intended evidence job for the method, comparison, result, failure mode, or contribution; remains legible and interpretable; and that its text, labels, units, legends, panels, visual encoding, arrows, cropping, caption, nearby manuscript claim, source data or selection metadata, and rendering or plotting logic agree. Look for concrete defects such as duplicate captions, over-dense panels, mismatched selection wording, or inconsistent examples when the materials make them possible. Treat generated-model output and visual inspection alone as unverified until these cross-checks pass. If checks reveal in-scope fixable issues, return to figure creation before the final response; report only remaining material issues, missing source material, scope limits, or needed user choices.", { capability: "figure-validation", readOnly: true }),
      updateResearchDocuments("Link the figure from the relevant Mission or Experiment detail document when that improves recovery. Update a directory summary or `RESEARCH.md` only if the figure materially changes that synthesis, mainline, conclusion, navigation, or priority.")
    ], clarification: commonClarification }]
  };
  if (slug === "review") return {
    status: "reviewer-perspective-work",
    modes: [{ id: "default", when: "The user requests reviewer-perspective critique, separate review preparation, return import, or review-context inspection.", steps: [
      readArea("reviews", "the review work"),
      relevantLessons,
      host("For a direct reviewer-perspective critique or separate review preparation, establish the external review context before forming findings. Infer the target venue and submission stage from the request, manuscript, and existing context; if the venue remains unclear and would materially change the review, ask rather than pretending the critique is venue-grounded. Reuse user-provided material only after checking that it is sufficiently current and relevant. Otherwise use available and approved host-native tools to discover, retrieve when available, read, and verify the material that can change the review judgment. Use current official venue sources for applicable scope, submission, review, formatting, anonymity, and required-material rules; published papers are scholarly context and cannot substitute for official venue requirements. Inspect a small, discriminating set of relevant published work when novelty, positioning, nearest comparators, evidence norms, experiment presentation, or reader expectations are material. Distinguish material merely found from material retrieved, inspected, and actually used; do not present search results, titles, or abstracts as papers read, and do not turn failure to find material into a claim that none exists. Do not require a fixed paper count, provider order, source list, or venue checklist. Stop when the inspected context is sufficient to support or change material findings, further search is unlikely to matter, or access boundaries are clear; report those boundaries and continue from available project material. For returned-review import or ordinary review-context inspection, do not trigger venue or paper search merely because Review was invoked.", { capability: "review-grounding", readOnly: true }),
      host(`Follow the user's actual Review request. ${DOVE_RESEARCH_AUTO_REVIEW_RESPONSE} ${DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY} For other direct review, form a fresh scoped judgment from the declared artifact or material and the established external review context: reconstruct its intended contribution, trace the claims that matter to the evidence actually offered, identify the strongest plausible falsifier or informed-reader objection, and judge whether the work answers it. Connect material findings to the official venue requirements and published work actually inspected when applicable. Return a scoped Markdown critique without pretending it is an independent external review; if grounding is unavailable or inapplicable, state that boundary instead of inventing references or substituting generic review language. To prepare a separate review, select or create one naturally named Review Markdown under \`reviews/\` and record the purpose, target venue when known, relevant project-relative artifact paths, scope limits, useful rubric, the official venue material and published work actually inspected or the access boundary, and a self-contained prompt for a separate reviewer chosen and managed by the user. Ask that reviewer to verify time-sensitive grounding when needed without assuming they have Dove's tools. If exact version freezing matters, use an ordinary Git commit, versioned copy, or review bundle and link it. To import a returned review, locate the corresponding Review document and preserve the supplied return faithfully without reconstructing preparation. To inspect existing review context, read and report it without creating a new Review document.`, { capability: "reviewer-perspective-work" }),
      host("Only when preparing a separate review handoff, return the relevant files and self-contained prompt to the user. Dove may declare a read-only scope and Markdown return contract, but the user is responsible for choosing and configuring the separate reviewer or session accordingly. Do not launch, impersonate, substitute for, or certify the separate reviewer. When importing, inspecting, or directly reviewing, do not create a new handoff.", { capability: "review-handoff", readOnly: true }),
      maintainArea("reviews", "When the user supplies an actual reviewer return, or asks to preserve a direct reviewer-perspective critique, append it faithfully to the corresponding Review document with a clear boundary from existing text. Do not rewrite, summarize over, or normalize the original return, and do not require verdict, severity, finding IDs, or a strict schema. Add author interpretation only when the user asks for it; use Rebuttal for substantive response, revision, and follow-up work.")
    ], clarification: commonClarification }]
  };
  if (slug === "rebuttal") return {
    status: "author-side-work",
    modes: [{ id: "default", when: "The user requests author-side rebuttal or requested revision from review findings.", steps: [
      readArea("reviews", "the relevant returned review"),
      relevantLessons,
      host("Read the relevant Review document and actual artifacts. Analyze each material finding against the evidence, draft or revise the response, and make requested ordinary project revisions. This remains author-side Dove work rather than a separate review return.", { capability: "rebuttal-and-revision" }),
      host("Check that each response and requested revision addresses a real finding. If checks reveal in-scope fixable issues, return to rebuttal or revision work before the final response; report only remaining material issues, scope limits, or needed user choices.", { capability: "artifact-validation", readOnly: true }),
      maintainArea("reviews", "Append the author response, requested revisions, resulting decisions, unresolved issues, and follow-up to the same Review document or the directly affected research document when that context is worth preserving.")
    ], clarification: commonClarification }]
  };
  return {
    status: "advisory-markdown",
    modes: [
      { id: "read", when: "The user requests reading or explaining current Lessons.", steps: [
        readResearchDocuments("Read `.dove/research/RESEARCH.md` first only when project context is needed, then read `.dove/research/lessons/LESSONS.md`, then only the linked theme documents relevant to the request. Report supported reusable guidance as fallible advice. Do not create or modify files and do not treat Lessons as evidence.")
      ], clarification: [] },
      { id: "maintain", when: "The user explicitly requests remembering, reflection, or durable Lessons maintenance.", steps: [
        readResearchDocuments("Read `.dove/research/RESEARCH.md` first only when project context is needed, then `.dove/research/lessons/LESSONS.md`, then only relevant linked themes. Do not recursively scan all research files."),
        updateResearchDocuments("Preserve useful existing structure in researcher-owned Lessons documents, or create a naturally named Markdown file when a new project-specific theme is genuinely useful. Do not write project-specific guidance into package-managed built-in Lessons themes. Update `lessons/LESSONS.md` with a natural link when needed. Source explanation is optional. Do not create lesson IDs, frontmatter, an application ledger, or treat Lessons as evidence.", {
          persistWhen: "the user explicitly asks to remember, reflect, or preserve durable Lessons guidance",
          persistencePolicy: "explicit-lessons"
        })
      ], clarification: commonClarification }
    ]
  };
}
var SURFACES = [
  ["research", "Complete one bounded pass of research, synthesis, or project investigation."],
  ["status", "Read the research overview, relevant summaries, and necessary linked context without writes."],
  ["source", "Discover, retrieve when available, read, verify, and document useful sources that materially inform the research."],
  ["experiment", "Design, analyze, record, or explicitly execute an experiment that advances a research decision."],
  ["draft", "Draft, assess, or revise ordinary project text and artifacts from the available evidence."],
  ["figure", "Inspect or gather real materials, then create, revise, validate, or caption figures when requested."],
  ["review", "Use reviewer perspective, prepare a separate review handoff, import a return, or inspect review context."],
  ["rebuttal", "Analyze review findings, draft author-side responses, and make requested evidence-backed revisions."],
  ["lessons", "Read advisory Lessons or maintain researcher-owned project Lessons when explicitly asked."],
  ["auto", `${DOVE_RESEARCH_AUTO_EXPLICIT_ONLY} Conduct foreground goal/mission cycles that autonomously advance the documented or recovered mainline within the user's limits.`]
];
var COMMAND_SURFACES = SURFACES.map(([slug, summary]) => ({
  id: `dove.${slug}`,
  title: `Dove ${slug}`,
  summary,
  requiredTools: [],
  workflow: workflow(slug),
  examples: [`/dove:${slug}`],
  guidance: slug === "review" ? ["Review can use Dove's reviewer perspective directly or prepare a user-managed separate exchange. Dove never launches, impersonates, or certifies a separate reviewer."] : slug === "auto" ? ["For manuscript submission readiness, the Review gate is the narrow exception to Auto's no-mechanical-Skill rule: when the Claude Code runtime exposes the Skill tool, make an actual `dove:review` call and wait for `PASS` or `REVISE`. Figure is not another mandatory gate, but actual drawing, redrawing, figure revision, or figure-specific validation must use `dove:figure`; generated Markdown can request but cannot prove either runtime call."] : []
}));
var COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));
function commandIdToSlug(commandId) {
  return commandId.replace(/^dove\./u, "");
}
function hostCommandSlug(commandId) {
  return commandIdToSlug(commandId).replace(/\./gu, "-");
}
function adapterPathForCommand(hostId, command) {
  const commandId = typeof command === "string" ? command : command.id;
  const slug = hostCommandSlug(commandId);
  if (hostId === "claude") return `.claude/commands/dove/${slug}.md`;
  if (hostId === "dsh") return `.dsh/skills/dove-${slug}/SKILL.md`;
  throw new Error(`Unknown host adapter: ${hostId}`);
}
function commandAdapterPathsForHost(hostId) {
  return COMMAND_SURFACES.map((command) => adapterPathForCommand(hostId, command));
}
function allGeneratedCommandAdapterPaths() {
  return PROJECT_HOST_IDS.flatMap(commandAdapterPathsForHost);
}
var HOST_ADAPTERS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => {
  const commandPaths = commandAdapterPathsForHost(hostId);
  const extraPaths = hostId === "claude" ? [...DOVE_CLAUDE_AMBIENT_PROJECT_PATHS] : [];
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths: [...commandPaths, ...extraPaths], requiredPaths: [...commandPaths, ...extraPaths], jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));
var CURRENT_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...PACKAGE_RUNTIME_PATHS]),
  claude: Object.freeze([...HOST_ADAPTERS.claude.paths]),
  dsh: Object.freeze([...HOST_ADAPTERS.dsh.paths])
});
var RETIRED = ["workspace", "mission", "note", "experience"];
var RETIRED_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...RETIRED_PACKAGE_RUNTIME_PATHS]),
  claude: Object.freeze([...RETIRED.map((slug) => `.claude/commands/dove/${slug}.md`), ".claude/agents/dove-reviewer.md"]),
  dsh: Object.freeze(RETIRED.flatMap((slug) => [`.dsh/skills/dove-${slug}/SKILL.md`, `.dsh/skills/dove-${slug}`]))
});
function packageResourcePath(hostId, destinationPath) {
  return `${PACKAGE_RESOURCE_ROOT}/${hostId}/${destinationPath}`;
}
var MANAGED_PACKAGE_PATHS = Object.freeze([
  ...commandAdapterPathsForHost("claude").map((item) => packageResourcePath("claude", item)),
  ...commandAdapterPathsForHost("dsh").map((item) => packageResourcePath("dsh", item)),
  ...PACKAGE_GENERATED_SUPPORT_PATHS,
  ...CURRENT_MANAGED_PATHS.core,
  ...PACKAGE_DOCUMENTATION_PATHS
]);

// src/core/project-installation.mjs
import crypto4 from "node:crypto";
import fs11 from "node:fs";
import path11 from "node:path";

// src/core/host-registry.mjs
var PROJECT_HOST_IDS2 = Object.freeze(["claude", "dsh"]);
var HOST_DEFINITIONS2 = [
  {
    id: "claude",
    label: "Claude Code",
    order: 0,
    projectInitializable: true,
    capabilities: { commandAdapters: true, projectHooks: true, sharedInstructions: false },
    legacySignatures: [
      "mcp/dove-claude-project.json",
      ".mcp.json",
      ".claude/settings.json",
      ".claude/rules/dove.md",
      ".claude/agents/dove.md",
      ".claude/skills/dove-intake/SKILL.md"
    ]
  },
  {
    id: "dsh",
    label: "DeepSeek Harness (dsh)",
    order: 1,
    projectInitializable: true,
    capabilities: { commandAdapters: true, projectHooks: false, sharedInstructions: false },
    legacySignatures: [".dsh/skills/dove-status/SKILL.md"]
  }
];
function freezeHostDefinition(definition) {
  return Object.freeze({
    ...definition,
    capabilities: Object.freeze({ ...definition.capabilities }),
    legacySignatures: Object.freeze([...definition.legacySignatures])
  });
}
var HOST_REGISTRY = Object.freeze(Object.fromEntries(
  HOST_DEFINITIONS2.map((definition) => [definition.id, freezeHostDefinition(definition)])
));
var DEFAULT_INITIALIZABLE_HOSTS = Object.freeze(["claude"]);
function selectionValues(raw) {
  if (raw === void 0 || raw === null) return [];
  if (typeof raw === "string") return [raw];
  if (!Array.isArray(raw)) throw new Error("Host selection must be a host id or an array of host ids.");
  return raw;
}
function defaultSelection(defaultWhenEmpty) {
  if (defaultWhenEmpty === false || defaultWhenEmpty === null) return [];
  if (defaultWhenEmpty === true || defaultWhenEmpty === void 0) return [...DEFAULT_INITIALIZABLE_HOSTS];
  return selectionValues(defaultWhenEmpty);
}
function normalizeHostSelection(raw, options = {}) {
  const requested = selectionValues(raw);
  const source = requested.length > 0 ? requested : defaultSelection(options.defaultWhenEmpty);
  for (const hostId of source) {
    if (typeof hostId !== "string" || !hostId || hostId !== hostId.trim()) {
      throw new Error(`Invalid Dove project host id: ${String(hostId)}.`);
    }
    if (hostId === "all") throw new Error("Dove host selection accepts only claude or dsh; 'all' is not supported.");
  }
  const unknown = [...new Set(source.filter((hostId) => !PROJECT_HOST_IDS2.includes(hostId)))];
  if (unknown.length > 0) throw new Error(`Unknown Dove project host(s): ${unknown.join(", ")}.`);
  const selected = PROJECT_HOST_IDS2.filter((hostId) => source.includes(hostId));
  if (options.requireInitializable === true) {
    const unavailable = selected.filter((hostId) => !HOST_REGISTRY[hostId].projectInitializable);
    if (unavailable.length > 0) {
      throw new Error(`Dove project initialization is not available for host(s): ${unavailable.join(", ")}.`);
    }
  }
  return Object.freeze(selected);
}

// src/core/legacy-workspace-marker.mjs
import fs7 from "node:fs";
import path7 from "node:path";
var MARKER_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "manifestVersion",
  "workspaceId",
  "createdAt",
  "packageVersion"
]);
var RETIRED_SCHEMA_VERSIONS = /* @__PURE__ */ new Set([7, 8, 9, 18]);
var SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function assertMarker(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Dove legacy workspace marker must be a plain object.");
  }
  const unknown = Object.keys(value).filter((key) => !MARKER_FIELDS.has(key));
  if (unknown.length > 0) throw new Error(`Dove legacy workspace marker has unknown fields: ${unknown.join(", ")}.`);
  if (!RETIRED_SCHEMA_VERSIONS.has(value.schemaVersion)) throw new Error("Dove legacy workspace marker schema is unsupported.");
  if (value.manifestVersion !== 1) throw new Error("Dove legacy workspace marker manifest version is unsupported.");
  if (typeof value.workspaceId !== "string" || !SAFE_ID.test(value.workspaceId)) throw new Error("Dove legacy workspace marker workspaceId is invalid.");
  if (typeof value.createdAt !== "string" || !ISO_TIMESTAMP.test(value.createdAt) || new Date(value.createdAt).toISOString() !== value.createdAt) {
    throw new Error("Dove legacy workspace marker createdAt is invalid.");
  }
  if (typeof value.packageVersion !== "string" || !value.packageVersion.trim()) throw new Error("Dove legacy workspace marker packageVersion is invalid.");
  return value;
}
function readLegacyWorkspaceMarker(root, options = {}) {
  const fsOps = options.fsOps ?? fs7;
  const markerPath = options.markerPath ?? ".dove/manifest.json";
  const absolutePath = path7.join(root, markerPath);
  const stat = lstatOrNull(fsOps, absolutePath);
  if (stat === null) return null;
  try {
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Dove legacy workspace marker must be a regular file: ${markerPath}.`);
    let text;
    try {
      text = fsOps.readFileSync(absolutePath, "utf8");
    } catch (error) {
      throw new Error(`Dove legacy workspace marker cannot be read: ${markerPath}.`, { cause: error });
    }
    return assertMarker(parseJsonWithoutDuplicateKeys(text, markerPath));
  } catch (error) {
    if (options.strict === false) return null;
    throw error;
  }
}
var LEGACY_WORKSPACE_MARKER_PATH = ".dove/manifest.json";

// src/core/project-installation-manifest.mjs
import fs8 from "node:fs";
import path8 from "node:path";
var INSTALLATION_MANIFEST_PATH = ARTIFACT_PATHS.installationManifest;
var LEGACY_INSTALLATION_MANIFEST_PATH = ".dove-install/manifest.json";
var INSTALLATION_MANIFEST_REVISION = "2.0";
var PREVIOUS_INSTALLATION_MANIFEST_REVISION = "1.0";
var MANIFEST_FIELDS = /* @__PURE__ */ new Set(["revision", "package", "runtime", "hosts", "managed", "createdAt", "updatedAt"]);
var PACKAGE_FIELDS = /* @__PURE__ */ new Set(["name", "version"]);
var RUNTIME_FIELDS = /* @__PURE__ */ new Set(["mode"]);
var MANAGED_FIELDS = /* @__PURE__ */ new Set(["path", "kind", "selector", "digest"]);
var MANAGED_KINDS = /* @__PURE__ */ new Set(["exclusive-file", "json-fragment", "text-block"]);
var SHA2562 = /^[a-f0-9]{64}$/u;
var SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
function plainObject3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function assertPlainObject(value, label) {
  if (!plainObject3(value)) throw new Error(`${label} must be a plain object.`);
}
function assertFields(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
  const missing = [...fields].filter((field) => !Object.hasOwn(value, field));
  if (missing.length > 0) throw new Error(`${label} is missing required fields: ${missing.join(", ")}.`);
}
function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value || value !== value.trim() || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty trimmed string.`);
  }
  return value;
}
function exactIsoTimestamp(value, label) {
  nonEmptyString(value, label);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO timestamp.`);
  }
  return value;
}
function canonicalProjectRelativePath(value, label) {
  nonEmptyString(value, label);
  if (value.includes("\\") || path8.posix.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
    throw new Error(`${label} must be a project-relative path without backslashes: ${value}`);
  }
  const normalized = path8.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized === ".." || normalized.startsWith("../") || value.includes("//") || value.endsWith("/")) {
    throw new Error(`${label} must be one canonical project-relative path: ${value}`);
  }
  if (value === ".dove" || value.startsWith(".dove/")) {
    throw new Error(`${label} must not manage Dove research or installation state: ${value}`);
  }
  return value;
}
function normalizeAllowedHosts(options) {
  const allowed = options.hostIds;
  if (!Array.isArray(allowed) || allowed.length === 0 || allowed.some((hostId) => typeof hostId !== "string" || !hostId || hostId === "all")) {
    throw new Error("Project installation manifest validation requires concrete hostIds in registry order.");
  }
  if (new Set(allowed).size !== allowed.length) throw new Error("Project installation manifest hostIds must be unique.");
  return allowed;
}
function validateHosts(hosts, allowedHosts) {
  if (!Array.isArray(hosts) || hosts.length === 0) throw new Error("Project installation manifest hosts must be a non-empty array.");
  for (const hostId of hosts) {
    nonEmptyString(hostId, "Project installation manifest host");
    if (hostId === "all" || !allowedHosts.includes(hostId)) throw new Error(`Project installation manifest contains unknown host: ${hostId}.`);
  }
  if (new Set(hosts).size !== hosts.length) throw new Error("Project installation manifest hosts must be unique.");
  return hosts;
}
function validateManagedEntry(entry, index) {
  const label = `Project installation manifest managed[${index}]`;
  assertFields(entry, MANAGED_FIELDS, label);
  canonicalProjectRelativePath(entry.path, `${label}.path`);
  if (!MANAGED_KINDS.has(entry.kind)) throw new Error(`${label}.kind is unsupported: ${entry.kind}.`);
  if (entry.kind === "exclusive-file") {
    if (entry.selector !== null) throw new Error(`${label}.selector must be null for exclusive-file ownership.`);
  } else {
    nonEmptyString(entry.selector, `${label}.selector`);
  }
  if (typeof entry.digest !== "string" || !SHA2562.test(entry.digest)) {
    throw new Error(`${label}.digest must be a lowercase 64-character SHA-256 digest.`);
  }
  return entry;
}
function managedKey(entry) {
  return `${entry.path}\0${entry.kind}\0${entry.selector ?? ""}`;
}
function compareManaged(left, right) {
  return left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind) || String(left.selector ?? "").localeCompare(String(right.selector ?? ""));
}
function validateManaged(managed) {
  if (!Array.isArray(managed)) throw new Error("Project installation manifest managed must be an array.");
  managed.forEach(validateManagedEntry);
  const keys = managed.map(managedKey);
  if (new Set(keys).size !== keys.length) throw new Error("Project installation manifest managed entries must be unique.");
  return managed;
}
function normalizeTimestamp(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return exactIsoTimestamp(value, "Project installation manifest timestamp");
  if (value === void 0) return (/* @__PURE__ */ new Date()).toISOString();
  throw new Error("Project installation manifest timestamp must be a Date or exact ISO timestamp.");
}
function normalizeManaged(rawManaged = []) {
  const byKey = /* @__PURE__ */ new Map();
  for (const rawEntry of rawManaged) {
    const entry = {
      path: rawEntry.path,
      kind: rawEntry.kind,
      selector: rawEntry.selector ?? null,
      digest: rawEntry.digest
    };
    validateManagedEntry(entry, byKey.size);
    const key = managedKey(entry);
    const previous = byKey.get(key);
    if (previous && previous.digest !== entry.digest) throw new Error(`Conflicting project installation manifest entry: ${entry.path}.`);
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort(compareManaged);
}
function validateProjectInstallationManifest(value, options = {}) {
  const allowedHosts = normalizeAllowedHosts(options);
  assertFields(value, MANIFEST_FIELDS, "Project installation manifest");
  if (value.revision !== INSTALLATION_MANIFEST_REVISION) {
    throw new Error(`Project installation manifest revision must equal ${INSTALLATION_MANIFEST_REVISION}.`);
  }
  assertFields(value.package, PACKAGE_FIELDS, "Project installation manifest package");
  nonEmptyString(value.package.name, "Project installation manifest package.name");
  nonEmptyString(value.package.version, "Project installation manifest package.version");
  if (!SEMVER.test(value.package.version)) throw new Error("Project installation manifest package.version must be a semantic version.");
  assertFields(value.runtime, RUNTIME_FIELDS, "Project installation manifest runtime");
  if (value.runtime.mode !== "user-cli") throw new Error("Project installation manifest runtime.mode must be user-cli.");
  validateHosts(value.hosts, allowedHosts);
  validateManaged(value.managed);
  const createdAt = exactIsoTimestamp(value.createdAt, "Project installation manifest createdAt");
  const updatedAt = exactIsoTimestamp(value.updatedAt, "Project installation manifest updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Project installation manifest updatedAt must not precede createdAt.");
  return value;
}
function createProjectInstallationManifest(input = {}, options = {}) {
  const allowedHosts = normalizeAllowedHosts(options);
  const requestedHosts = input.hosts ?? [];
  if (!Array.isArray(requestedHosts) || requestedHosts.some((hostId) => hostId === "all" || !allowedHosts.includes(hostId))) {
    throw new Error("Project installation manifest hosts must contain only concrete known host ids.");
  }
  const hosts = allowedHosts.filter((hostId) => requestedHosts.includes(hostId));
  const createdAt = normalizeTimestamp(input.createdAt ?? input.now);
  const updatedAt = normalizeTimestamp(input.updatedAt ?? createdAt);
  const manifest = {
    revision: INSTALLATION_MANIFEST_REVISION,
    package: { name: input.package?.name, version: input.package?.version },
    runtime: { mode: "user-cli" },
    hosts,
    managed: normalizeManaged(input.managed),
    createdAt,
    updatedAt
  };
  validateProjectInstallationManifest(manifest, { hostIds: allowedHosts });
  return manifest;
}
function serializeProjectInstallationManifest(value, options = {}) {
  validateProjectInstallationManifest(value, options);
  return `${JSON.stringify(value, null, 2)}
`;
}
function lstatOrNull2(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function inspectManifestFile(root, fsOps, manifestRelativePath) {
  const installationDirectory = path8.join(root, path8.posix.dirname(manifestRelativePath));
  const directoryStat = lstatOrNull2(fsOps, installationDirectory);
  if (directoryStat === null) throw new Error(`Dove project installation manifest is missing: ${manifestRelativePath}.`);
  if (directoryStat.isSymbolicLink()) throw new Error(`Dove project installation directory must not be a symbolic link: ${installationDirectory}.`);
  if (!directoryStat.isDirectory()) throw new Error(`Dove project installation path must be a directory: ${installationDirectory}.`);
  const manifestPath = path8.join(root, manifestRelativePath);
  const stat = lstatOrNull2(fsOps, manifestPath);
  if (stat === null) throw new Error(`Dove project installation manifest is missing: ${manifestRelativePath}.`);
  if (stat.isSymbolicLink()) throw new Error(`Dove project installation manifest must not be a symbolic link: ${manifestRelativePath}.`);
  if (!stat.isFile()) throw new Error(`Dove project installation manifest must be a regular file: ${manifestRelativePath}.`);
  return manifestPath;
}
function readProjectInstallationManifest(root, options = {}) {
  const fsOps = options.fsOps ?? fs8;
  const manifestPath = inspectManifestFile(root, fsOps, INSTALLATION_MANIFEST_PATH);
  try {
    const parsed = parseJsonWithoutDuplicateKeys(fsOps.readFileSync(manifestPath, "utf8"), "Dove project installation manifest");
    validateProjectInstallationManifest(parsed, options);
    return parsed;
  } catch (error) {
    throw new Error(`Invalid Dove project installation manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}
function validatePreviousManagedEntry(entry, index) {
  const label = `Dove 1.0 installation manifest managed[${index}]`;
  assertPlainObject(entry, label);
  const kind = entry.kind ?? entry.mode;
  const normalized = { path: entry.path, kind, selector: entry.selector ?? null, digest: entry.digest };
  validateManagedEntry(normalized, index);
  return normalized;
}
function normalizePreviousManifest(value, manifestPath, options) {
  assertPlainObject(value, "Dove 1.0 installation manifest");
  const recognizedRevision = value.revision === PREVIOUS_INSTALLATION_MANIFEST_REVISION;
  const recognizedReleasedShape = value.schemaVersion === 1 && value.integrationVersion === 4 && value.ownershipVersion === 4 && value.runtime?.protocolVersion === 3;
  if (!recognizedRevision && !recognizedReleasedShape) {
    throw new Error(`Dove migration accepts only installation revision ${PREVIOUS_INSTALLATION_MANIFEST_REVISION}.`);
  }
  const allowedHosts = normalizeAllowedHosts(options);
  assertPlainObject(value.package, "Dove 1.0 installation manifest package");
  nonEmptyString(value.package.name, "Dove 1.0 installation manifest package.name");
  nonEmptyString(value.package.version, "Dove 1.0 installation manifest package.version");
  if (!SEMVER.test(value.package.version)) throw new Error("Dove 1.0 installation manifest package.version must be a semantic version.");
  if (value.runtime?.mode !== "user-cli") throw new Error("Dove 1.0 installation manifest runtime.mode must be user-cli.");
  validateHosts(value.hosts, allowedHosts);
  if (!Array.isArray(value.managed)) throw new Error("Dove 1.0 installation manifest managed must be an array.");
  const managed = value.managed.map(validatePreviousManagedEntry);
  if (new Set(managed.map(managedKey)).size !== managed.length) throw new Error("Dove 1.0 installation manifest managed entries must be unique.");
  const createdAt = exactIsoTimestamp(value.createdAt, "Dove 1.0 installation manifest createdAt");
  const updatedAt = exactIsoTimestamp(value.updatedAt, "Dove 1.0 installation manifest updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Dove 1.0 installation manifest updatedAt must not precede createdAt.");
  return {
    revision: PREVIOUS_INSTALLATION_MANIFEST_REVISION,
    package: { name: value.package.name, version: value.package.version },
    runtime: { mode: "user-cli" },
    hosts: [...value.hosts],
    managed,
    createdAt,
    updatedAt,
    sourcePath: manifestPath
  };
}
function readProjectInstallationManifestForMigration(root, options = {}) {
  const fsOps = options.fsOps ?? fs8;
  const relativePath = options.manifestPath ?? INSTALLATION_MANIFEST_PATH;
  if (![INSTALLATION_MANIFEST_PATH, LEGACY_INSTALLATION_MANIFEST_PATH].includes(relativePath)) {
    throw new Error(`Unsupported Dove installation migration manifest path: ${relativePath}.`);
  }
  const manifestPath = inspectManifestFile(root, fsOps, relativePath);
  try {
    const parsed = parseJsonWithoutDuplicateKeys(fsOps.readFileSync(manifestPath, "utf8"), "Dove 1.0 installation manifest");
    return normalizePreviousManifest(parsed, relativePath, options);
  } catch (error) {
    throw new Error(`Invalid Dove 1.0 installation manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

// src/core/project-root.mjs
import fs9 from "node:fs";
import path9 from "node:path";
var INSTALLATION_DIRECTORY = path9.posix.dirname(INSTALLATION_MANIFEST_PATH);
function realpathNative2(fsOps, targetPath) {
  return typeof fsOps.realpathSync?.native === "function" ? fsOps.realpathSync.native(targetPath) : fsOps.realpathSync(targetPath);
}
function canonicalExistingDirectory(value, label, fsOps) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error(`${label} must name an existing directory.`);
  const resolved = path9.resolve(value);
  let stat;
  try {
    stat = fsOps.statSync(resolved);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`${label} must name an existing directory: ${resolved}.`);
    throw error;
  }
  if (!stat.isDirectory()) throw new Error(`${label} must name an existing directory: ${resolved}.`);
  return realpathNative2(fsOps, resolved);
}
function parentDirectories2(start) {
  const directories = [];
  let current = start;
  while (true) {
    directories.push(current);
    const parent = path9.dirname(current);
    if (parent === current) return directories;
    current = parent;
  }
}
function lstatOrNull3(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function preservedDoctorOnly(directoryPath, directoryStat, fsOps) {
  if (directoryStat === null) return false;
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) return false;
  const children = fsOps.readdirSync(directoryPath).map(String).sort();
  if (children.length !== 1 || children[0] !== "DOCTOR.md") return false;
  const doctorStat = lstatOrNull3(fsOps, path9.join(directoryPath, "DOCTOR.md"));
  return doctorStat?.isFile() === true && !doctorStat.isSymbolicLink();
}
function installationStateAt(root, options) {
  const fsOps = options.fsOps ?? fs9;
  const directoryPath = path9.join(root, INSTALLATION_DIRECTORY);
  const manifestPath = path9.join(root, INSTALLATION_MANIFEST_PATH);
  const manifestStat = lstatOrNull3(fsOps, manifestPath);
  if (manifestStat === null) {
    const directoryStat2 = lstatOrNull3(fsOps, directoryPath);
    if (directoryStat2 === null || preservedDoctorOnly(directoryPath, directoryStat2, fsOps)) return { state: "absent", root, manifestPath };
    return { state: "residue", root, manifestPath, directoryPath, directoryStat: directoryStat2 };
  }
  if (manifestStat.isSymbolicLink()) throw new Error(`Dove project installation manifest must not be a symbolic link: ${manifestPath}.`);
  if (!manifestStat.isFile()) throw new Error(`Dove project installation manifest must be a regular file: ${manifestPath}.`);
  const directoryStat = lstatOrNull3(fsOps, directoryPath);
  if (directoryStat === null || directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) throw new Error(`Dove installation path must be a real directory: ${directoryPath}.`);
  const manifest = readProjectInstallationManifest(root, { ...options, hostIds: options.hostIds ?? PROJECT_HOST_IDS2 });
  return { state: "initialized", root, manifestPath, manifest };
}
function assertSafeInitCandidate(candidate, installation) {
  if (installation.state !== "residue") return;
  const stat = installation.directoryStat;
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove installation path must be a real directory: ${installation.directoryPath}.`);
  throw new Error(`Dove installation directory is incomplete because ${INSTALLATION_MANIFEST_PATH} is missing at ${candidate}.`);
}
function setupEvidenceAt(root, fsOps, options = {}) {
  const paths = [
    INSTALLATION_MANIFEST_PATH,
    LEGACY_INSTALLATION_MANIFEST_PATH,
    ...options.includeResearch === true ? [".dove/manifest.json"] : []
  ];
  for (const relativePath of paths) {
    const target = path9.join(root, relativePath);
    const stat = lstatOrNull3(fsOps, target);
    if (stat === null) continue;
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`Dove setup marker must be a regular non-symbolic-link file: ${target}.`);
    }
    return { state: "marker", relativePath };
  }
  for (const relativePath of [INSTALLATION_DIRECTORY, ".dove-install"]) {
    const target = path9.join(root, relativePath);
    const stat = lstatOrNull3(fsOps, target);
    if (stat === null) continue;
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Dove setup path must be a real directory: ${target}.`);
    }
    if (relativePath === INSTALLATION_DIRECTORY && preservedDoctorOnly(target, stat, fsOps)) continue;
    return { state: "residue", relativePath };
  }
  return { state: "absent", relativePath: null };
}
function legacyInitError(candidate, root, evidence) {
  if (evidence.relativePath === LEGACY_INSTALLATION_MANIFEST_PATH) {
    return new Error(`Dove found a legacy project installation at ${root}. Current adoption accepts only a readable Markdown research tree with the old .dove/manifest.json marker. Run 'dove doctor --json' before choosing explicit reinstall or manual recovery.`);
  }
  if (evidence.relativePath === ".dove/manifest.json") {
    return new Error(`Dove found existing Dove research workspace state at ${root}. Run 'dove update' to adopt it when the Markdown research tree is current, or 'dove doctor --json' for diagnosis.`);
  }
  return new Error(`Dove found incomplete legacy Dove state at ${root}. Run 'dove doctor --json' before initializing another project.`);
}
function gitRootFrom(start, fsOps) {
  for (const directory of parentDirectories2(start)) {
    const dotGit = path9.join(directory, ".git");
    const stat = lstatOrNull3(fsOps, dotGit);
    if (stat === null) continue;
    if (stat.isSymbolicLink()) throw new Error(`Git project marker must not be a symbolic link: ${dotGit}.`);
    if (!stat.isDirectory() && !stat.isFile()) throw new Error(`Git project marker must be a file or directory: ${dotGit}.`);
    return directory;
  }
  return null;
}
function initRequiredError(start) {
  return new Error(`Dove project integration is not initialized from ${start}. Run 'dove init' from the project root, or use 'dove init --project <dir>'.`);
}
function resolveProjectRootForInit(project, options = {}) {
  const fsOps = options.fsOps ?? fs9;
  const explicitProject = project !== void 0 && project !== null;
  const candidateInput = explicitProject ? project : options.cwd ?? process.cwd();
  const candidate = canonicalExistingDirectory(candidateInput, explicitProject ? "Dove project" : "Current working directory", fsOps);
  const gitRoot = gitRootFrom(candidate, fsOps);
  const allDirectories = parentDirectories2(candidate);
  const directories = gitRoot === null ? allDirectories : allDirectories.slice(0, allDirectories.indexOf(gitRoot) + 1);
  for (let index = 0; index < directories.length; index += 1) {
    const directory = directories[index];
    const installation = installationStateAt(directory, options);
    if (index === 0) assertSafeInitCandidate(candidate, installation);
    if (installation.state === "initialized") {
      if (index === 0) throw new Error(`Dove project integration is already initialized at ${directory}. Use dove update instead.`);
      throw new Error(`Refusing nested Dove project initialization at ${candidate}; an initialized project already exists at ${directory}.`);
    }
    const evidence = setupEvidenceAt(directory, fsOps, { includeResearch: index === 0 });
    if (evidence.state !== "absent") throw legacyInitError(candidate, directory, evidence);
  }
  return !explicitProject && gitRoot !== null ? gitRoot : candidate;
}
function packageProjectBoundary(directory, fsOps) {
  const packageJson = lstatOrNull3(fsOps, path9.join(directory, "package.json"));
  const nodeModules = lstatOrNull3(fsOps, path9.join(directory, "node_modules"));
  return packageJson?.isFile() && !packageJson.isSymbolicLink() && nodeModules?.isDirectory() && !nodeModules.isSymbolicLink();
}
function resolveProjectRootForSetup(start, options = {}) {
  const fsOps = options.fsOps ?? fs9;
  const candidate = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project setup start", fsOps);
  for (const directory of parentDirectories2(candidate)) {
    if (setupEvidenceAt(directory, fsOps).state !== "absent") return directory;
    const dotGit = lstatOrNull3(fsOps, path9.join(directory, ".git"));
    if (dotGit !== null) {
      if (dotGit.isSymbolicLink() || !dotGit.isDirectory() && !dotGit.isFile()) {
        throw new Error(`Git project marker must be a file or directory: ${path9.join(directory, ".git")}.`);
      }
      return directory;
    }
    if (packageProjectBoundary(directory, fsOps)) return directory;
  }
  return candidate;
}
function resolveInstalledProjectRoot(start, options = {}) {
  const fsOps = options.fsOps ?? fs9;
  const startingDirectory = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project search start", fsOps);
  for (const directory of parentDirectories2(startingDirectory)) {
    const installation = installationStateAt(directory, options);
    if (installation.state === "initialized") return directory;
  }
  throw initRequiredError(startingDirectory);
}
function resolveExactInstalledProjectRoot(start, options = {}) {
  const fsOps = options.fsOps ?? fs9;
  if (typeof start !== "string" || !start.trim() || start.includes("\0")) throw new Error("Dove hook project must name an initialized project root.");
  const resolved = path9.resolve(start);
  const stat = lstatOrNull3(fsOps, resolved);
  if (stat === null || stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove hook project must be a real directory: ${resolved}.`);
  const root = realpathNative2(fsOps, resolved);
  const installation = installationStateAt(root, options);
  if (installation.state !== "initialized") throw initRequiredError(root);
  return root;
}
function inspectProjectRoot(start, options = {}) {
  let canonicalStart = null;
  try {
    canonicalStart = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project search start", options.fsOps ?? fs9);
    const root = resolveInstalledProjectRoot(canonicalStart, options);
    return Object.freeze({ state: "initialized", initialized: true, start: canonicalStart, root, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const uninitialized = message.includes("Dove project integration is not initialized");
    return Object.freeze({
      state: uninitialized ? "uninitialized" : "invalid",
      initialized: false,
      start: canonicalStart,
      root: null,
      error: message
    });
  }
}

// scripts/generate-command-adapters.mjs
import fs10 from "node:fs";
import path10 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var __filename = fileURLToPath2(import.meta.url);
var __dirname = path10.dirname(__filename);
var PACKAGE_ROOT = path10.resolve(__dirname, "..");
function markdownTitle(command) {
  return command.title.replace(/\b\w/g, (char) => char.toUpperCase());
}
function yamlString(value) {
  return JSON.stringify(String(value).replace(/\n/g, " "));
}
function exampleBullets(command, hostId = null) {
  const examples = command.examples;
  if (!Array.isArray(examples)) {
    return [];
  }
  return examples.map((example) => {
    const text = String(example).trim();
    return hostId === "opencode" ? text.replace(/^\/dove:/u, "/dove.") : text;
  }).filter(Boolean);
}
function renderBullets(bullets2) {
  return bullets2.map((bullet) => `- ${bullet}`).join("\n");
}
function renderWorkflow(command) {
  const modes = command.workflow?.modes;
  if (!Array.isArray(modes) || modes.length === 0) return "";
  const lines = [
    "## Internal workflow",
    "",
    "Internal guidance only; never use this workflow as the final report outline.",
    ""
  ];
  for (const item of modes) {
    lines.push(`- **${item.when}**`);
    for (const [index, step] of item.steps.entries()) {
      const writeBoundary = step.readOnly ? " This step is read-only; do not create or modify files." : step.persistencePolicy === "standard-research" ? ` Maintain Dove research Markdown only when ${step.persistWhen}.` : step.persistencePolicy === "explicit-lessons" ? ` Maintain Lessons only when ${step.persistWhen}.` : "";
      lines.push(`  ${index + 1}. Use host tools (${step.readOnly ? "read-only" : "work"}; ${step.capability}). ${step.instruction}${writeBoundary}`);
    }
    for (const clarification of item.clarification ?? []) {
      lines.push(`  - Clarification: ${clarification}`);
    }
  }
  return lines.join("\n");
}
function renderGuidance(command) {
  const notes = Array.isArray(command.guidance) ? command.guidance.filter(Boolean) : [];
  return notes.length > 0 ? `## Command guidance

${renderBullets(notes)}` : "";
}
function renderCapsule() {
  return `## Dove capsule

${renderBullets(HOST_ADAPTER_POLICY.adapterBullets)}`;
}
function renderExamples(command, hostId = null) {
  const examples = exampleBullets(command, hostId);
  return examples.length > 0 ? `

## Examples

${examples.map((example) => `- \`${example}\``).join("\n")}` : "";
}
function renderBody(command, heading, hostId = null) {
  const purpose = command.summary;
  const examples = renderExamples(command, hostId);
  const workflow2 = renderWorkflow(command);
  const guidance = renderGuidance(command);
  const capsule = renderCapsule();
  return `# ${heading}

${purpose}${examples}

${workflow2}${guidance ? `

${guidance}` : ""}

${capsule}
`;
}
function renderFrontmatter(command, fields = {}) {
  const lines = ["---"];
  if (fields.name) {
    lines.push(`name: ${fields.name}`);
  }
  lines.push(`description: ${yamlString(command.summary)}`);
  lines.push("---", "");
  return lines.join("\n");
}
function renderMarkdownCommand(command, heading, hostId = null) {
  return `${renderFrontmatter(command)}
${renderBody(command, heading, hostId)}`;
}
function renderSkill(command, hostId = null) {
  const name = `dove-${hostCommandSlug(command.id)}`;
  return `${renderFrontmatter(command, { name })}
${renderBody(command, markdownTitle(command), hostId)}`;
}
function renderCommandAdapter(hostId, command) {
  switch (hostId) {
    case "claude":
      return renderMarkdownCommand(command, command.id, hostId);
    case "dsh":
      return renderSkill(command, hostId);
    default:
      throw new Error(`Unknown host adapter: ${hostId}`);
  }
}
function generatedAdapterEntries() {
  return PROJECT_HOST_IDS.flatMap((hostId) => COMMAND_SURFACES.map((command) => ({
    hostId,
    command,
    destinationPath: adapterPathForCommand(hostId, command),
    relativePath: packageResourcePath(hostId, adapterPathForCommand(hostId, command)),
    content: renderCommandAdapter(hostId, command)
  })));
}
function generatedClaudeAmbientProjectEntries() {
  return [
    { destinationPath: DOVE_CLAUDE_AMBIENT_RULE_PATH, relativePath: packageResourcePath("claude", DOVE_CLAUDE_AMBIENT_RULE_PATH), content: renderClaudeAmbientRule() },
    { destinationPath: DOVE_CLAUDE_AMBIENT_SKILL_PATH, relativePath: packageResourcePath("claude", DOVE_CLAUDE_AMBIENT_SKILL_PATH), content: renderClaudeAmbientSkill() },
    { destinationPath: PAPER_SEARCH_SUPPORT_SKILL_PATH, relativePath: packageResourcePath("claude", PAPER_SEARCH_SUPPORT_SKILL_PATH), content: renderPaperSearchSupportSkill() }
  ];
}

// src/core/project-installation.mjs
var MCP_PATH = PAPER_SEARCH_MCP_PATH;
var SETTINGS_SELECTOR = "/hooks/UserPromptSubmit[dove-user-prompt-submit]";
var CLAUDE_HOST = "claude";
var FORBIDDEN_RESOURCE_PREFIXES = [".dove/", "bin/", "dist/", "mcp/", "scripts/"];
function plainObject4(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function sha2563(content) {
  return crypto4.createHash("sha256").update(content).digest("hex");
}
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}
function semanticDigest(value) {
  return sha2563(canonicalJson(value));
}
function normalizedGeneratedContent(content) {
  return `${String(content).trimEnd()}
`;
}
function managedKey2(entry) {
  return `${entry.path}\0${entry.kind}\0${entry.selector ?? ""}`;
}
function compareManaged2(left, right) {
  return left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind) || String(left.selector ?? "").localeCompare(String(right.selector ?? ""));
}
function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function samePackage(left, right) {
  return left.name === right.name && left.version === right.version;
}
function sameManaged(left, right) {
  const sortedLeft = [...left].sort(compareManaged2);
  const sortedRight = [...right].sort(compareManaged2);
  return sortedLeft.length === sortedRight.length && sortedLeft.every((entry, index) => managedKey2(entry) === managedKey2(sortedRight[index]) && entry.digest === sortedRight[index].digest);
}
function exactTimestamp2(value) {
  if (value === void 0) return (/* @__PURE__ */ new Date()).toISOString();
  const timestamp2 = value instanceof Date ? value.toISOString() : value;
  if (typeof timestamp2 !== "string" || new Date(timestamp2).toISOString() !== timestamp2) throw new Error("Project integration now must be a Date or exact ISO timestamp.");
  return timestamp2;
}
function assertPackageInput(packageName, packageVersion, { required }) {
  if (!required && packageName === void 0 && packageVersion === void 0) return;
  if (typeof packageName !== "string" || !packageName || packageName !== packageName.trim() || packageName.includes("\0")) throw new Error("Project integration packageName must be a non-empty trimmed string.");
  if (typeof packageVersion !== "string" || !packageVersion || packageVersion !== packageVersion.trim()) throw new Error("Project integration packageVersion must be a semantic version string.");
}
function normalizeSelectedHosts(raw, { defaultWhenEmpty }) {
  if (Array.isArray(raw) && raw.length === 0) throw new Error("Dove project integration requires at least one host.");
  const hosts = normalizeHostSelection(raw, { defaultWhenEmpty, requireInitializable: true });
  if (hosts.length === 0) throw new Error("Dove project integration requires at least one host.");
  return [...hosts];
}
function assertManagedResourcePath(relativePath) {
  if (relativePath === ".dove" || relativePath.startsWith(".dove/")) throw new Error(`Project integration resources must not manage Dove workspace state: ${relativePath}.`);
  if (FORBIDDEN_RESOURCE_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) throw new Error(`Project integration resources must not install runtime bundles: ${relativePath}.`);
}
function claudeResources() {
  const agentEntries = generatedDoveAgentEntries().filter((entry) => entry.relativePath.startsWith(".claude/agents/"));
  const files = [
    ...generatedAdapterEntries().filter((entry) => entry.hostId === CLAUDE_HOST),
    ...generatedClaudeAmbientProjectEntries(),
    ...agentEntries
  ].map((entry) => {
    const destinationPath = entry.destinationPath ?? entry.relativePath;
    assertManagedResourcePath(destinationPath);
    const content = normalizedGeneratedContent(entry.content);
    return {
      hostId: CLAUDE_HOST,
      path: destinationPath,
      kind: "exclusive-file",
      selector: null,
      content,
      digest: sha2563(content)
    };
  });
  const hooks = {
    SessionStart: DOVE_CLAUDE_SESSION_START_HOOK_ENTRY,
    UserPromptSubmit: DOVE_CLAUDE_AMBIENT_HOOK_ENTRY,
    Stop: DOVE_CLAUDE_STOP_HOOK_ENTRY
  };
  const hook = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: SETTINGS_SELECTOR,
    fragment: hooks,
    digest: semanticDigest(hooks)
  };
  const paperSearch = {
    hostId: CLAUDE_HOST,
    path: PAPER_SEARCH_MCP_PATH,
    kind: "json-fragment",
    selector: PAPER_SEARCH_MCP_SELECTOR,
    fragment: PAPER_SEARCH_MCP_FRAGMENT,
    digest: semanticDigest(PAPER_SEARCH_MCP_FRAGMENT)
  };
  const resources = [...files, hook, paperSearch];
  if (new Set(resources.map(managedKey2)).size !== resources.length) throw new Error("Generated project integration resources contain duplicate manifest entries.");
  return resources;
}
function dshResources() {
  return generatedAdapterEntries().filter((entry) => entry.hostId === "dsh").map((entry) => {
    const content = normalizedGeneratedContent(entry.content);
    return {
      hostId: "dsh",
      path: entry.destinationPath,
      kind: "exclusive-file",
      selector: null,
      content,
      digest: sha2563(content)
    };
  });
}
function resourcesForHosts(hosts) {
  return [...claudeResources(), ...dshResources()].filter((entry) => hosts.includes(entry.hostId)).sort(compareManaged2);
}
function lstatOrNull4(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function inspectRegularProjectFile(root, relativePath, fsOps) {
  let current = root;
  for (const [index, component] of relativePath.split("/").entries()) {
    current = path11.join(current, component);
    const stat = lstatOrNull4(fsOps, current);
    if (stat === null) return { exists: false, bytes: null, digest: null, mode: null, type: "absent" };
    if (stat.isSymbolicLink()) throw new Error(`Dove project integration path must not be a symbolic link: ${relativePath}.`);
    if (index < relativePath.split("/").length - 1) {
      if (!stat.isDirectory()) throw new Error(`Dove project integration parent must be a directory: ${relativePath}.`);
      continue;
    }
    if (!stat.isFile()) throw new Error(`Dove project integration path must be absent or a regular file: ${relativePath}.`);
    const bytes = fsOps.readFileSync(current);
    return { exists: true, bytes, digest: sha2563(bytes), mode: stat.mode & 4095, type: "file" };
  }
  throw new Error(`Invalid Dove project integration path: ${relativePath}.`);
}
function expectedFileState(state2) {
  return state2.exists ? { exists: true, type: "file", sha256: state2.digest, mode: state2.mode } : { exists: false, type: "absent", sha256: null, mode: null };
}
function transactionWrite(root, resource, content, observed) {
  return {
    root,
    relativePath: resource.path,
    content,
    encoding: "utf8",
    force: true,
    expectedState: expectedFileState(observed),
    label: `Dove project integration resource ${resource.path}`
  };
}
function transactionDelete(root, resource, observed) {
  return {
    root,
    relativePath: resource.path,
    delete: true,
    force: true,
    expectedState: expectedFileState(observed),
    label: `Dove project integration resource ${resource.path}`
  };
}
function parseSharedJson(state2, relativePath) {
  if (!state2.exists) return {};
  const value = parseJsonWithoutDuplicateKeys(state2.bytes.toString("utf8"), relativePath);
  if (!plainObject4(value)) throw new Error(`${relativePath} must contain a JSON object.`);
  return value;
}
function serializeSharedJson(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}
function hookCommandMarkers2(eventName) {
  if (eventName === "SessionStart") return ["dove hook session-start"];
  if (eventName === "UserPromptSubmit") return ["dove hook user-prompt-submit", "dove-user-prompt-submit-package.mjs"];
  if (eventName === "Stop") return ["dove hook stop"];
  throw new Error(`Unsupported Dove Claude hook event: ${eventName}.`);
}
function referencesDoveHook(entry, eventName) {
  if (!plainObject4(entry) || !Array.isArray(entry.hooks)) return false;
  const markers = hookCommandMarkers2(eventName);
  return entry.hooks.some((hook) => plainObject4(hook) && typeof hook.command === "string" && markers.some((marker) => hook.command.includes(marker)));
}
function hookFragmentState(settings, eventName) {
  if (settings.hooks !== void 0 && !plainObject4(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const entries = settings.hooks?.[eventName];
  if (entries !== void 0 && !Array.isArray(entries)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.${eventName} must be an array.`);
  const candidates = (entries ?? []).map((entry, index) => ({ entry, index })).filter(({ entry }) => referencesDoveHook(entry, eventName));
  if (candidates.length > 1) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} defines multiple Dove ${eventName} hooks.`);
  if (candidates.length === 0) return { exists: false, digest: null, index: -1, fragment: null };
  return { exists: true, digest: semanticDigest(candidates[0].entry), index: candidates[0].index, fragment: candidates[0].entry };
}
function namedMcpFragmentState(config, serverName) {
  if (config.mcpServers !== void 0 && !plainObject4(config.mcpServers)) throw new Error(`${MCP_PATH} mcpServers must be a JSON object.`);
  if (!Object.hasOwn(config.mcpServers ?? {}, serverName)) return { exists: false, digest: null, fragment: null };
  const fragment = config.mcpServers[serverName];
  return { exists: true, digest: semanticDigest(fragment), fragment };
}
function paperSearchMcpFragmentState(config) {
  return namedMcpFragmentState(config, PAPER_SEARCH_MCP_SERVER_NAME);
}
function fragmentState(resource, value) {
  if (resource.selector === SETTINGS_SELECTOR) {
    const prompt = hookFragmentState(value, "UserPromptSubmit");
    const sessionStart = hookFragmentState(value, "SessionStart");
    const stop = hookFragmentState(value, "Stop");
    if (!prompt.exists) return { exists: false, digest: null, index: -1, fragment: null };
    const fragment = {
      UserPromptSubmit: prompt.fragment,
      ...sessionStart.exists ? { SessionStart: sessionStart.fragment } : {},
      ...stop.exists ? { Stop: stop.fragment } : {}
    };
    return { exists: true, digest: semanticDigest(fragment), index: -1, fragment };
  }
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) return paperSearchMcpFragmentState(value);
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}
function removeFragment(resource, value, current) {
  if (resource.selector === SETTINGS_SELECTOR) {
    let next = value;
    for (const eventName of ["UserPromptSubmit", "SessionStart", "Stop"]) {
      const state2 = hookFragmentState(next, eventName);
      if (!state2.exists) continue;
      next = { ...next, hooks: { ...next.hooks, [eventName]: next.hooks[eventName].filter((_, index) => index !== state2.index) } };
    }
    return next;
  }
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) {
    const servers = { ...value.mcpServers };
    delete servers[PAPER_SEARCH_MCP_SERVER_NAME];
    return { ...value, mcpServers: servers };
  }
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}
function emptySharedJsonShell(resource, value) {
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) {
    return Object.keys(value).length === 1 && plainObject4(value.mcpServers) && Object.keys(value.mcpServers).length === 0;
  }
  return false;
}
function driftError(resource, currentDigest) {
  return new Error(`Dove project integration ownership drift at ${resource.path}${resource.selector ? `#${resource.selector}` : ""}; current digest ${currentDigest ?? "absent"} matches neither the manifest nor the expected resource.`);
}
function conflictError(resource) {
  return new Error(`Dove project integration cannot claim conflicting content at ${resource.path}${resource.selector ? `#${resource.selector}` : ""}.`);
}
function planExclusive(root, desired, oldEntry, fsOps) {
  const resource = desired ?? oldEntry;
  const observed = inspectRegularProjectFile(root, resource.path, fsOps);
  if (!oldEntry) {
    if (!observed.exists) return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
    if (observed.digest === desired.digest) return { entry: null, changed: false };
    throw conflictError(desired);
  }
  if (desired) {
    if (!observed.exists) return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
    if (observed.digest !== oldEntry.digest && observed.digest !== desired.digest) throw driftError(resource, observed.digest);
    if (observed.digest === desired.digest) return { entry: null, changed: oldEntry.digest !== desired.digest };
    return { entry: transactionWrite(root, desired, desired.content, observed), changed: true };
  }
  if (!observed.exists) return { entry: null, changed: true };
  if (observed.digest !== oldEntry.digest) throw driftError(resource, observed.digest);
  return { entry: transactionDelete(root, resource, observed), changed: true };
}
function addFragment(resource, value) {
  if (resource.selector === SETTINGS_SELECTOR) return mergeClaudeAmbientSettings(value).settings;
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) {
    return {
      ...value,
      mcpServers: {
        ...value.mcpServers ?? {},
        [PAPER_SEARCH_MCP_SERVER_NAME]: resource.fragment
      }
    };
  }
  throw new Error(`Dove does not install unsupported project-local fragment ${resource.path}#${resource.selector}.`);
}
function planJsonFragments(root, relativePath, desiredEntries, oldEntries, fsOps, options = {}) {
  const observed = inspectRegularProjectFile(root, relativePath, fsOps);
  const original = parseSharedJson(observed, relativePath);
  const desiredByKey = new Map(desiredEntries.map((entry) => [managedKey2(entry), entry]));
  const oldByKey = new Map(oldEntries.map((entry) => [managedKey2(entry), entry]));
  let next = original;
  let changed = false;
  for (const key of [.../* @__PURE__ */ new Set([...oldByKey.keys(), ...desiredByKey.keys()])].sort()) {
    const desired = desiredByKey.get(key) ?? null;
    const oldEntry = oldByKey.get(key) ?? null;
    const resource2 = desired ?? oldEntry;
    const current = fragmentState(resource2, next);
    if (!oldEntry) {
      if (current.exists && current.digest === desired.digest) continue;
      const adoptableClaudeHookFragment = options.adopt === true && relativePath === DOVE_CLAUDE_SETTINGS_PATH && resource2.selector === SETTINGS_SELECTOR;
      if (adoptableClaudeHookFragment) {
        for (const eventName of ["UserPromptSubmit", "SessionStart", "Stop"]) {
          const eventState = hookFragmentState(next, eventName);
          if (eventState.exists && eventState.digest !== semanticDigest(desired.fragment[eventName])) throw conflictError(desired);
        }
      } else if (current.exists) {
        throw conflictError(desired);
      }
      next = addFragment(desired, next);
      changed = true;
      continue;
    }
    if (desired) {
      if (!current.exists) {
        next = addFragment(desired, next);
        changed = true;
        continue;
      }
      if (current.digest !== oldEntry.digest && current.digest !== desired.digest) throw driftError(resource2, current.digest);
      if (current.digest === desired.digest) {
        if (oldEntry.digest !== desired.digest) changed = true;
        continue;
      }
      next = addFragment(desired, removeFragment(desired, next, current));
      changed = true;
      continue;
    }
    if (!current.exists) {
      changed = true;
      continue;
    }
    if (current.digest !== oldEntry.digest) throw driftError(resource2, current.digest);
    next = removeFragment(resource2, next, current);
    changed = true;
  }
  if (canonicalJson(next) === canonicalJson(original)) return { entry: null, changed };
  const resource = desiredEntries[0] ?? oldEntries[0];
  return {
    entry: emptySharedJsonShell(resource, next) ? transactionDelete(root, resource, observed) : transactionWrite(root, resource, serializeSharedJson(next), observed),
    changed: true
  };
}
function planResource(root, desired, oldEntry, fsOps) {
  const kind = desired?.kind ?? oldEntry.kind;
  if (kind === "exclusive-file") return planExclusive(root, desired, oldEntry, fsOps);
  throw new Error(`Unsupported project integration resource kind: ${kind}.`);
}
function desiredManaged(resources) {
  return resources.map(({ path: relativePath, kind, selector, digest }) => ({ path: relativePath, kind, selector, digest })).sort(compareManaged2);
}
function preparePlan({ root, hosts, packageName, packageVersion, now, fsOps, manifest = null, adopt = false }) {
  const desiredResources = resourcesForHosts(hosts);
  const desiredByKey = new Map(desiredResources.map((entry) => [managedKey2(entry), entry]));
  const oldByKey = new Map((manifest?.managed ?? []).map((entry) => [managedKey2(entry), entry]));
  const entries = [];
  let resourcesChanged = false;
  const sharedPaths = [.../* @__PURE__ */ new Set([
    ...desiredResources.filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path),
    ...(manifest?.managed ?? []).filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path)
  ])].sort();
  for (const relativePath of sharedPaths) {
    const planned = planJsonFragments(
      root,
      relativePath,
      desiredResources.filter((entry) => entry.kind === "json-fragment" && entry.path === relativePath),
      (manifest?.managed ?? []).filter((entry) => entry.kind === "json-fragment" && entry.path === relativePath),
      fsOps,
      { adopt }
    );
    if (planned.entry) entries.push(planned.entry);
    if (planned.changed) resourcesChanged = true;
  }
  const keys = [.../* @__PURE__ */ new Set([...oldByKey.keys(), ...desiredByKey.keys()])].filter((key) => (desiredByKey.get(key) ?? oldByKey.get(key)).kind !== "json-fragment").sort();
  for (const key of keys) {
    const planned = planResource(root, desiredByKey.get(key) ?? null, oldByKey.get(key) ?? null, fsOps);
    if (planned.entry) entries.push(planned.entry);
    if (planned.changed) resourcesChanged = true;
  }
  const managed = desiredManaged(desiredResources);
  const packageInfo = { name: packageName, version: packageVersion };
  const manifestChanged = manifest === null || resourcesChanged || !sameArray(manifest.hosts, hosts) || !samePackage(manifest.package, packageInfo) || !sameManaged(manifest.managed, managed);
  const nextManifest = manifestChanged ? createProjectInstallationManifest({
    package: packageInfo,
    hosts,
    managed,
    createdAt: manifest?.createdAt ?? now,
    updatedAt: now
  }, { hostIds: PROJECT_HOST_IDS2 }) : manifest;
  if (manifestChanged) {
    const observed = inspectRegularProjectFile(root, INSTALLATION_MANIFEST_PATH, fsOps);
    entries.push(transactionWrite(root, { path: INSTALLATION_MANIFEST_PATH }, serializeProjectInstallationManifest(nextManifest, { hostIds: PROJECT_HOST_IDS2 }), observed));
  }
  return { entries, manifest: nextManifest, manifestChanged };
}
function resultFromTransaction(status, target, hosts, manifest, transaction) {
  return {
    status,
    target,
    hosts: [...hosts],
    writtenPaths: [...transaction.writtenPaths],
    removedPaths: [...transaction.removedPaths],
    changedPaths: [...transaction.changedPaths],
    cleanupWarnings: [...transaction.cleanupWarnings],
    omittedCleanupWarningCount: transaction.omittedCleanupWarningCount,
    manifest
  };
}
function appendResearchDefaults(root, entries, options = {}) {
  const prepared = prepareResearchDefaults(root, {
    fsOps: options.fsOps,
    mode: options.mode ?? "sync",
    label: options.label
  });
  const existingTargets = new Set(entries.map((entry) => entry.relativePath));
  for (const entry of prepared.entries) {
    if (!existingTargets.has(entry.relativePath)) entries.push(entry);
  }
  return prepared;
}
function transactionOptions(fsOps, options = {}) {
  return { ...options, fsOps };
}
function initializeProjectIntegration(rootOrProject, options = {}) {
  const fsOps = options.fsOps ?? fs11;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const hosts = normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: true });
  const now = exactTimestamp2(options.now);
  const root = resolveProjectRootForInit(rootOrProject, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const plan = preparePlan({ root, hosts, packageName: options.packageName, packageVersion: options.packageVersion, now, fsOps });
  const researchDefaults = appendResearchDefaults(root, plan.entries, { fsOps, label: "Dove research bootstrap" });
  return resultFromTransaction(
    "initialized",
    root,
    hosts,
    plan.manifest,
    writeFileSetTransaction(plan.entries, transactionOptions(fsOps))
  );
}
function prepareInstalledIntegrationPlan(start, options = {}) {
  const fsOps = options.fsOps ?? fs11;
  const root = resolveInstalledProjectRoot(start, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const manifest = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const hosts = options.hosts === void 0 ? [...manifest.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const packageName = options.packageName ?? manifest.package.name;
  const packageVersion = options.packageVersion ?? manifest.package.version;
  assertPackageInput(packageName, packageVersion, { required: true });
  const plan = preparePlan({ root, hosts, packageName, packageVersion, now: exactTimestamp2(options.now), fsOps, manifest });
  return { fsOps, root, hosts, currentManifest: manifest, ...plan };
}
function prepareInstalledPlan(start, options = {}) {
  const prepared = prepareInstalledIntegrationPlan(start, options);
  const researchDefaults = appendResearchDefaults(prepared.root, prepared.entries, { fsOps: prepared.fsOps, label: "Dove research defaults sync" });
  return { ...prepared, researchDefaults };
}
function synchronizeProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, options);
  const transaction = writeFileSetTransaction(
    prepared.entries,
    transactionOptions(prepared.fsOps)
  );
  return resultFromTransaction(transaction.changedPaths.length === 0 ? "unchanged" : "synchronized", prepared.root, prepared.hosts, prepared.manifest, transaction);
}
function assertIntegrationOnlyEntries(entries) {
  if (entries.some((entry) => entry.relativePath === ".dove/research" || entry.relativePath.startsWith(".dove/research/"))) {
    throw new Error("Dove hot sync refuses to write Dove research state.");
  }
}
function synchronizeProjectIntegrationOnly(start, options = {}) {
  const fsOps = options.fsOps ?? fs11;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = resolveExactInstalledProjectRoot(start, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const currentManifest = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const compatibility = classifyPackageCompatibility(currentManifest.package, {
    name: options.packageName,
    version: options.packageVersion
  });
  if (["identity-mismatch", "invalid-version", "newer"].includes(compatibility)) {
    throw new Error("Dove hot sync refuses missing, invalid, newer, or foreign project integration.");
  }
  if (!currentManifest.hosts.includes(CLAUDE_HOST)) {
    throw new Error("Dove hot sync requires Claude Code host integration.");
  }
  const plan = preparePlan({
    root,
    hosts: [...currentManifest.hosts],
    packageName: options.packageName,
    packageVersion: options.packageVersion,
    now: exactTimestamp2(options.now),
    fsOps,
    manifest: currentManifest
  });
  assertIntegrationOnlyEntries(plan.entries);
  const transaction = writeFileSetTransaction(plan.entries, transactionOptions(fsOps));
  return resultFromTransaction(transaction.changedPaths.length === 0 ? "unchanged" : "synchronized", root, currentManifest.hosts, plan.manifest, transaction);
}
function inspectProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, options);
  const writtenPaths = prepared.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  return {
    status: prepared.entries.length === 0 ? "current" : "needs-sync",
    target: prepared.root,
    hosts: [...prepared.hosts],
    writtenPaths,
    removedPaths,
    changedPaths: prepared.entries.map((entry) => entry.relativePath),
    manifest: prepared.currentManifest
  };
}
function canonicalLifecycleRoot(start, fsOps) {
  const resolved = path11.resolve(start ?? process.cwd());
  const stat = fsOps.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove lifecycle project root must be a real directory: ${resolved}.`);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}
function walkDeletion(root, relativePath, fsOps, entries, scope, preservePaths = /* @__PURE__ */ new Set()) {
  const absolutePath = path11.join(root, relativePath);
  const stat = lstatOrNull4(fsOps, absolutePath);
  if (stat === null) return;
  if (stat.isSymbolicLink()) throw new Error(`Dove lifecycle refuses symbolic links in destructive scope: ${relativePath}.`);
  if (stat.isFile()) {
    if (preservePaths.has(relativePath)) return;
    const observed = inspectRegularProjectFile(root, relativePath, fsOps);
    entries.push(transactionDelete(root, { path: relativePath }, observed));
    scope.push({ path: relativePath, kind: "file", digest: observed.digest });
    return;
  }
  if (!stat.isDirectory()) throw new Error(`Dove lifecycle found unsupported project state: ${relativePath}.`);
  for (const child of fsOps.readdirSync(absolutePath).map(String).sort()) {
    walkDeletion(root, path11.posix.join(relativePath, child), fsOps, entries, scope, preservePaths);
  }
  if (preservePaths.has(relativePath)) return;
  entries.push({
    root,
    relativePath,
    delete: true,
    deleteEmptyDirectory: true,
    force: true,
    expectedState: { exists: true, type: "directory", sha256: null, mode: stat.mode & 4095 },
    label: `Dove lifecycle directory deletion ${relativePath}`
  });
  scope.push({ path: relativePath, kind: "directory", digest: null });
}
function migrationSource(root, fsOps) {
  const current = lstatOrNull4(fsOps, path11.join(root, INSTALLATION_MANIFEST_PATH));
  const legacy = lstatOrNull4(fsOps, path11.join(root, LEGACY_INSTALLATION_MANIFEST_PATH));
  if (current !== null && legacy !== null) throw new Error("Dove project update found both current and 1.0 project installation manifests.");
  if (current !== null) return readProjectInstallationManifestForMigration(root, { fsOps, hostIds: PROJECT_HOST_IDS2, manifestPath: INSTALLATION_MANIFEST_PATH });
  if (legacy !== null) return readProjectInstallationManifestForMigration(root, { fsOps, hostIds: PROJECT_HOST_IDS2, manifestPath: LEGACY_INSTALLATION_MANIFEST_PATH });
  throw new Error("Dove project update requires an installation revision 1.0 manifest.");
}
function assertAdoptableResearch(root, fsOps) {
  const research = inspectResearchDocuments(root, { fsOps });
  if (research.state !== "current" || research.healthy !== true) {
    throw new Error("Dove project adoption requires a readable current Markdown research tree.");
  }
  return research;
}
function adoptionSource(start, options = {}) {
  const fsOps = options.fsOps ?? fs11;
  const root = resolveProjectRootForSetup(start, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const current = lstatOrNull4(fsOps, path11.join(root, INSTALLATION_MANIFEST_PATH));
  if (current !== null) throw new Error("Dove project adoption requires an uninitialized project without a current installation manifest.");
  const legacyInstall = lstatOrNull4(fsOps, path11.join(root, LEGACY_INSTALLATION_MANIFEST_PATH));
  if (legacyInstall !== null) throw new Error("Dove project adoption accepts only the old .dove/manifest.json workspace marker, not legacy installation manifests.");
  if (readLegacyWorkspaceMarker(root, { fsOps }) === null) {
    throw new Error("Dove project adoption requires the old .dove/manifest.json workspace marker.");
  }
  assertAdoptableResearch(root, fsOps);
  return { root, sourcePath: LEGACY_WORKSPACE_MARKER_PATH, createdAt: null };
}
function prepareLifecycleIntegration(root, options, { hosts, source = null, reinstall = false, adopt = false }) {
  const fsOps = options.fsOps ?? fs11;
  const entries = [];
  const scope = [];
  const oldManifest = source ? { ...source, managed: source.managed } : null;
  const now = exactTimestamp2(options.now);
  const planned = preparePlan({
    root,
    hosts,
    packageName: options.packageName,
    packageVersion: options.packageVersion,
    now,
    fsOps,
    manifest: oldManifest,
    adopt
  });
  const existingPaths = new Set(entries.map((entry) => entry.relativePath));
  for (const entry of planned.entries) {
    if (existingPaths.has(entry.relativePath)) continue;
    existingPaths.add(entry.relativePath);
    entries.push(entry);
  }
  let researchDefaults = null;
  if (reinstall) {
    const preservedResearchPaths = /* @__PURE__ */ new Set([
      ...RESEARCH_DEFAULT_DIRECTORY_PATHS,
      ...RESEARCH_DEFAULT_FILE_PATHS
    ]);
    const doveRoot = path11.join(root, ".dove");
    const doveStat = lstatOrNull4(fsOps, doveRoot);
    if (doveStat !== null) {
      if (doveStat.isSymbolicLink() || !doveStat.isDirectory()) throw new Error("Complete Reinstall requires .dove to be a real directory.");
      for (const child of fsOps.readdirSync(doveRoot).map(String).sort()) {
        if (child !== "install") walkDeletion(root, `.dove/${child}`, fsOps, entries, scope, preservedResearchPaths);
      }
      const installRoot = path11.join(doveRoot, "install");
      const installStat = lstatOrNull4(fsOps, installRoot);
      if (installStat !== null) {
        if (installStat.isSymbolicLink() || !installStat.isDirectory()) throw new Error("Complete Reinstall requires .dove/install to be a real directory.");
        for (const child of fsOps.readdirSync(installRoot).map(String).sort()) {
          if (child !== "manifest.json") walkDeletion(root, `.dove/install/${child}`, fsOps, entries, scope);
        }
      }
    }
    walkDeletion(root, ".dove-archive", fsOps, entries, scope);
    walkDeletion(root, ".dove-install", fsOps, entries, scope);
    researchDefaults = appendResearchDefaults(root, entries, {
      fsOps,
      mode: "replace",
      label: "Dove Complete Reinstall research bootstrap"
    });
  } else if (source?.sourcePath === LEGACY_INSTALLATION_MANIFEST_PATH) {
    const legacyDirectory = lstatOrNull4(fsOps, path11.join(root, ".dove-install"));
    if (legacyDirectory?.isSymbolicLink() || legacyDirectory !== null && !legacyDirectory.isDirectory()) {
      throw new Error("Updating Dove project integration requires .dove-install to be a real directory.");
    }
    const legacyObserved = inspectRegularProjectFile(root, LEGACY_INSTALLATION_MANIFEST_PATH, fsOps);
    entries.push(transactionDelete(root, { path: LEGACY_INSTALLATION_MANIFEST_PATH }, legacyObserved));
    const legacyChildren = legacyDirectory === null ? [] : fsOps.readdirSync(path11.join(root, ".dove-install")).map(String).sort();
    if (sameArray(legacyChildren, ["manifest.json"])) {
      entries.push({
        root,
        relativePath: ".dove-install",
        delete: true,
        deleteEmptyDirectory: true,
        force: true,
        expectedState: { exists: true, type: "directory", sha256: null, mode: legacyDirectory.mode & 4095 },
        label: "Dove 1.0 installation directory cleanup"
      });
    }
  }
  if (!reinstall && !adopt) {
    researchDefaults = appendResearchDefaults(root, entries, {
      fsOps,
      label: "Dove research defaults update"
    });
  }
  return { entries, manifest: planned.manifest, scope, researchDefaults };
}
function previewShape(kind, root, hosts, prepared, confirmationRequired) {
  const writtenEntries = prepared.entries.filter((entry) => entry.delete !== true);
  const writtenPaths = writtenEntries.map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  const defaultResearchPaths = new Set(RESEARCH_DEFAULT_FILE_PATHS);
  const replacedPaths = writtenEntries.filter((entry) => entry.expectedState?.exists === true && defaultResearchPaths.has(entry.relativePath)).map((entry) => entry.relativePath);
  return {
    status: "ready",
    action: kind,
    target: root,
    hosts: [...hosts],
    writtenPaths,
    removedPaths,
    changedPaths: [.../* @__PURE__ */ new Set([...writtenPaths, ...removedPaths])],
    destructiveScope: prepared.scope,
    ...kind === "reinstall" ? { replacedPaths } : {},
    confirmation: { required: confirmationRequired, default: false },
    manifest: prepared.manifest
  };
}
function previewProjectAdoption(start, options = {}) {
  const fsOps = options.fsOps ?? fs11;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const source = adoptionSource(start, { ...options, fsOps });
  const hosts = normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: true });
  const prepared = prepareLifecycleIntegration(source.root, options, { hosts, source: null, reinstall: false, adopt: true });
  return previewShape("adopt", source.root, hosts, prepared, false);
}
function adoptProjectIntegration(start, options = {}) {
  const fsOps = options.fsOps ?? fs11;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const source = adoptionSource(start, { ...options, fsOps });
  const hosts = normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: true });
  const prepared = prepareLifecycleIntegration(source.root, options, { hosts, source: null, reinstall: false, adopt: true });
  return resultFromTransaction(
    "adopted",
    source.root,
    hosts,
    prepared.manifest,
    writeFileSetTransaction(prepared.entries, transactionOptions(fsOps))
  );
}
function previewProjectCompleteReinstall(start, options = {}) {
  const fsOps = options.fsOps ?? fs11;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  let source = null;
  try {
    source = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  } catch {
    try {
      source = migrationSource(root, fsOps);
    } catch {
      source = null;
    }
  }
  const hosts = options.hosts === void 0 ? [...source?.hosts ?? [CLAUDE_HOST]] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source, reinstall: true });
  return previewShape("reinstall", root, hosts, prepared, true);
}
function completeReinstallProjectIntegration(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true after displaying the real destructive scope.");
  const fsOps = options.fsOps ?? fs11;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  let source = null;
  try {
    source = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  } catch {
    try {
      source = migrationSource(root, fsOps);
    } catch {
      source = null;
    }
  }
  const hosts = options.hosts === void 0 ? [...source?.hosts ?? [CLAUDE_HOST]] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source, reinstall: true });
  return resultFromTransaction(
    "reinstalled",
    root,
    hosts,
    prepared.manifest,
    writeFileSetTransaction(
      prepared.entries,
      transactionOptions(fsOps, {
        transactionBase: ".dove-transaction"
      })
    )
  );
}
function prepareUninstall(start, options = {}) {
  const fsOps = options.fsOps ?? fs11;
  const root = canonicalLifecycleRoot(start, fsOps);
  const manifest = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const entries = [];
  const sharedPaths = [...new Set(manifest.managed.filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path))].sort();
  for (const relativePath of sharedPaths) {
    const planned = planJsonFragments(
      root,
      relativePath,
      [],
      manifest.managed.filter((entry) => entry.kind === "json-fragment" && entry.path === relativePath),
      fsOps
    );
    if (planned.entry) entries.push(planned.entry);
  }
  for (const entry of manifest.managed.filter((managed) => managed.kind !== "json-fragment").sort(compareManaged2)) {
    const planned = planResource(root, null, entry, fsOps);
    if (planned.entry) entries.push(planned.entry);
  }
  const manifestObserved = inspectRegularProjectFile(root, INSTALLATION_MANIFEST_PATH, fsOps);
  if (!manifestObserved.exists) throw new Error("Dove uninstall requires the current project installation manifest.");
  entries.push(transactionDelete(root, { path: INSTALLATION_MANIFEST_PATH }, manifestObserved));
  const legacyMarker = readLegacyWorkspaceMarker(root, { fsOps, strict: false });
  if (legacyMarker !== null) {
    const markerObserved = inspectRegularProjectFile(root, LEGACY_WORKSPACE_MARKER_PATH, fsOps);
    entries.push(transactionDelete(root, { path: LEGACY_WORKSPACE_MARKER_PATH }, markerObserved));
  }
  return { fsOps, root, manifest, entries };
}
function uninstallPreview(prepared) {
  const writtenPaths = prepared.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  return {
    status: "ready",
    action: "uninstall",
    target: prepared.root,
    hosts: [...prepared.manifest.hosts],
    writtenPaths,
    removedPaths,
    changedPaths: [.../* @__PURE__ */ new Set([...writtenPaths, ...removedPaths])],
    preservedPaths: [".dove/research/**", ".dove/install/DOCTOR.md"],
    confirmation: { required: true, default: false }
  };
}
function previewProjectUninstall(start, options = {}) {
  return uninstallPreview(prepareUninstall(start, options));
}
function uninstallProjectIntegration(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Dove uninstall requires confirmed: true after displaying the exact removal scope.");
  const prepared = prepareUninstall(start, options);
  const transaction = writeFileSetTransaction(prepared.entries, transactionOptions(prepared.fsOps));
  return {
    status: "uninstalled",
    target: prepared.root,
    hosts: [...prepared.manifest.hosts],
    writtenPaths: [...transaction.writtenPaths],
    removedPaths: [...transaction.removedPaths],
    changedPaths: [...transaction.changedPaths],
    cleanupWarnings: [...transaction.cleanupWarnings],
    omittedCleanupWarningCount: transaction.omittedCleanupWarningCount,
    preservedPaths: [".dove/research/**", ".dove/install/DOCTOR.md"]
  };
}
function updateProjectIntegration(start, options = {}) {
  return synchronizeProjectIntegration(start, options);
}
var PROJECT_INTEGRATION_MANAGED_PATHS = Object.freeze(claudeResources().map((resource) => resource.path).sort());

// src/core/dove-lifecycle.mjs
import fs12 from "node:fs";
import path12 from "node:path";
function publicUpdateResult(result) {
  return {
    ...result,
    status: result.status === "unchanged" || result.status === "adopted" ? result.status : "updated"
  };
}
function lstatOrNull5(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function hasCurrentManifest(root, fsOps) {
  return lstatOrNull5(fsOps, path12.join(root, INSTALLATION_MANIFEST_PATH)) !== null;
}
function updateDoveLifecycle(start, options = {}) {
  const fsOps = options.fsOps ?? fs12;
  const root = resolveProjectRootForSetup(start, { fsOps });
  return publicUpdateResult(hasCurrentManifest(root, fsOps) ? updateProjectIntegration(root, options) : adoptProjectIntegration(root, options));
}
function completeReinstallDoveLifecycle(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true.");
  return completeReinstallProjectIntegration(start, options);
}
function previewUninstallDoveLifecycle(start, options = {}) {
  return previewProjectUninstall(start, options);
}
function uninstallDoveLifecycle(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Dove uninstall requires confirmed: true.");
  return uninstallProjectIntegration(start, options);
}

// src/core/project-doctor.mjs
import fs13 from "node:fs";
import path13 from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";

// src/core/project-setup-classification.mjs
var ACTIONS = Object.freeze({
  init: Object.freeze(["init", "exit"]),
  update: Object.freeze(["update", "exit"]),
  updateOrReinstall: Object.freeze(["update", "reinstall", "exit"]),
  reinstall: Object.freeze(["reinstall", "exit"]),
  blocked: Object.freeze(["exit"])
});
function setup(mode, reason, actions = mode) {
  return Object.freeze({ mode, reason, allowedActions: ACTIONS[actions] });
}
function classifyProjectSetup(result) {
  const integration = result?.projectIntegration ?? {};
  const migration = result?.migrationInstallation ?? { state: "absent" };
  const workspace = result?.workspaceState ?? { mode: "unavailable", healthy: false };
  const adoption = result?.adoption ?? { state: "absent" };
  if (migration.state === "conflicting-manifests") return setup("blocked", "conflicting-manifests");
  if (migration.state === "valid-legacy") return setup("blocked", "unsupported-legacy-installation");
  if (migration.state === "invalid-legacy") return setup("blocked", "invalid-legacy");
  if (adoption.state === "adoptable") return setup("update", "adoptable", "update");
  if (["invalid", "drifted"].includes(integration.state)) return setup("blocked", integration.state);
  if (integration.state === "needs-sync") return setup("update", "needs-sync", "updateOrReinstall");
  if (integration.state === "current") return setup("reinstall", "current");
  if (workspace.mode === "current" && workspace.healthy === true) return setup("init", "preserved-research");
  if (workspace.mode !== "absent") return setup("reinstall", "unsupported-workspace");
  return setup("init", "clean-uninitialized");
}

// src/core/project-doctor.mjs
var MODULE_DIRECTORY = path13.dirname(fileURLToPath3(import.meta.url));
var DEFAULT_PACKAGE_ROOT = path13.resolve(MODULE_DIRECTORY, "../..");
function messageFor2(error) {
  return error instanceof Error ? error.message : String(error);
}
function plainObject5(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function lstatOrNull6(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function regularNonSymlink(fsOps, targetPath) {
  const stat = lstatOrNull6(fsOps, targetPath);
  return stat !== null && stat.isFile() && !stat.isSymbolicLink();
}
function inspectUserCli(options) {
  const fsOps = options.fsOps ?? fs13;
  const packageRoot = path13.resolve(options.packageRoot ?? DEFAULT_PACKAGE_ROOT);
  const runtimePaths = (options.packageRuntimePaths ?? PACKAGE_RUNTIME_PATHS).map((relativePath) => {
    const absolutePath = path13.resolve(packageRoot, relativePath);
    const relative = path13.relative(packageRoot, absolutePath);
    const contained = relative !== "" && !relative.startsWith("..") && !path13.isAbsolute(relative);
    const healthy2 = contained && regularNonSymlink(fsOps, absolutePath);
    return { path: relativePath, healthy: healthy2, state: healthy2 ? "current" : contained ? "missing-or-invalid" : "outside-package-root" };
  });
  const executablePath = path13.resolve(options.executablePath ?? path13.join(packageRoot, "bin/dove-package.mjs"));
  const executableRelative = path13.relative(packageRoot, executablePath);
  const executableContained = executableRelative === "" || !executableRelative.startsWith("..") && !path13.isAbsolute(executableRelative);
  const executableHealthy = executableContained && regularNonSymlink(fsOps, executablePath);
  const executable = { path: executablePath, healthy: executableHealthy, state: executableHealthy ? "current" : "missing-or-invalid" };
  const healthy = runtimePaths.every((entry) => entry.healthy) && executable.healthy;
  return {
    healthy,
    state: healthy ? "healthy" : "unhealthy",
    package: { name: options.packageName ?? null, version: options.packageVersion ?? null, root: packageRoot },
    runtimePaths,
    executable,
    missing: runtimePaths.filter((entry) => !entry.healthy).map((entry) => entry.path)
  };
}
function manifestSummary(manifest) {
  return manifest ? {
    path: INSTALLATION_MANIFEST_PATH,
    revision: manifest.revision,
    package: manifest.package,
    runtime: manifest.runtime,
    hosts: [...manifest.hosts]
  } : null;
}
function inspectIntegration(start, options) {
  const project = inspectProjectRoot(start, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS2 });
  if (!project.initialized) return { healthy: false, state: project.state, start: project.start, root: project.root, error: project.error, manifest: null, missing: [], drifted: [] };
  try {
    const manifest = readProjectInstallationManifest(project.root, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS2 });
    if (options.packageName !== void 0 && options.packageVersion !== void 0) {
      const compatibility = classifyPackageCompatibility(manifest.package, { name: options.packageName, version: options.packageVersion });
      if (["identity-mismatch", "newer", "invalid-version"].includes(compatibility)) {
        return { healthy: false, state: "invalid", start: project.start, root: project.root, error: "Dove project integration package is incompatible with the running CLI.", manifest: manifestSummary(manifest), packageCompatibility: compatibility, missing: [], drifted: [] };
      }
    }
    const canonical = (options.inspectCurrentIntegration ?? inspectProjectIntegration)(project.root, {
      packageName: options.packageName ?? manifest.package.name,
      packageVersion: options.packageVersion ?? manifest.package.version,
      fsOps: options.fsOps
    });
    return {
      healthy: canonical.status === "current",
      state: canonical.status,
      start: project.start,
      root: project.root,
      error: null,
      manifest: manifestSummary(manifest),
      needsSync: canonical.status === "needs-sync",
      syncPaths: [...canonical.changedPaths],
      missing: [],
      drifted: []
    };
  } catch (error) {
    const message = messageFor2(error);
    return {
      healthy: false,
      state: /ownership drift/iu.test(message) ? "drifted" : "invalid",
      start: project.start,
      root: project.root,
      error: message,
      manifest: null,
      missing: [],
      drifted: []
    };
  }
}
function inspectMigration(root, options) {
  const fsOps = options.fsOps ?? fs13;
  const current = lstatOrNull6(fsOps, path13.join(root, INSTALLATION_MANIFEST_PATH));
  const legacy = lstatOrNull6(fsOps, path13.join(root, LEGACY_INSTALLATION_MANIFEST_PATH));
  const migrationPath = legacy ? LEGACY_INSTALLATION_MANIFEST_PATH : current ? INSTALLATION_MANIFEST_PATH : null;
  const result = (state2, fields = {}) => ({ state: state2, root, markerPath: migrationPath, ...fields });
  if (current && legacy) return result("conflicting-manifests", { error: "Dove found both current and 1.0 installation manifests." });
  if (!legacy && !current) {
    const legacyDirectory = lstatOrNull6(fsOps, path13.join(root, ".dove-install"));
    return legacyDirectory ? result("invalid-legacy", { error: "Dove found an incomplete 1.0 installation directory." }) : result("absent", { error: null });
  }
  if (current) {
    try {
      readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
      return result("absent", { markerPath: null, error: null });
    } catch {
    }
  }
  try {
    const manifest = readProjectInstallationManifestForMigration(root, { fsOps, hostIds: PROJECT_HOST_IDS2, manifestPath: migrationPath });
    return result("valid-legacy", { error: null, manifest: { path: migrationPath, revision: manifest.revision, package: manifest.package, runtime: manifest.runtime, hosts: [...manifest.hosts] } });
  } catch (error) {
    return result("invalid-legacy", { error: messageFor2(error) });
  }
}
function researchState(root, options) {
  if (!root) return { healthy: false, state: "unavailable", mode: "unavailable", error: "Project root is unavailable." };
  try {
    const inspected = (options.inspectResearchDocuments ?? inspectResearchDocuments)(root, { fsOps: options.fsOps });
    if (!plainObject5(inspected)) throw new Error("Research document inspection returned an invalid result.");
    const mode = inspected.state === "absent" ? "absent" : inspected.state === "previous-research-format" ? "previous-research-format" : inspected.healthy === true ? "current" : "invalid";
    return { ...inspected, mode, healthy: inspected.healthy === true };
  } catch (error) {
    return { healthy: false, state: "invalid", mode: "invalid", error: messageFor2(error) };
  }
}
function adoptionState(root, options) {
  if (!root) return { state: "absent", ready: false, preview: null, error: "Project root is unavailable." };
  try {
    const preview = (options.previewProjectAdoption ?? previewProjectAdoption)(root, {
      fsOps: options.fsOps,
      packageName: options.packageName,
      packageVersion: options.packageVersion
    });
    return { state: "adoptable", ready: true, preview, error: null };
  } catch (error) {
    return { state: "absent", ready: false, preview: null, error: messageFor2(error) };
  }
}
function actionsFor(result) {
  const actions = [];
  const adoptReady = result.adoption.state === "adoptable";
  if (adoptReady) actions.push({ kind: "update", command: "dove update" });
  if (!adoptReady && result.workspaceState.state === "previous-research-format") actions.push({ kind: "export-research", command: "dove export-research" });
  else if (!adoptReady && result.setup.mode === "init") actions.push({ kind: "init", command: "dove init" });
  else if (!adoptReady && result.projectIntegration.state === "needs-sync") actions.push({ kind: "update", command: "dove update" });
  else if (!adoptReady && result.setup.mode === "reinstall" && result.projectIntegration.state !== "current") actions.push({ kind: "reinstall", command: "dove reinstall" });
  else if (!adoptReady && result.setup.mode === "blocked") actions.push({ kind: "inspect", command: "dove doctor --json" });
  return actions;
}
function inspectProjectDoctor(start, options = {}) {
  const userCli = inspectUserCli(options);
  let setupRoot = null;
  try {
    setupRoot = resolveProjectRootForSetup(start, { fsOps: options.fsOps });
  } catch {
    setupRoot = typeof start === "string" ? path13.resolve(start) : null;
  }
  const projectIntegration = inspectIntegration(start, options);
  const safeRoot = projectIntegration.root ?? setupRoot;
  const migrationInstallation = safeRoot ? inspectMigration(safeRoot, options) : { state: "absent", root: null, error: "Project root is unavailable." };
  const workspaceState = researchState(safeRoot, options);
  const adoption = safeRoot ? adoptionState(safeRoot, options) : { state: "absent", ready: false, preview: null, error: "Project root is unavailable." };
  const setup2 = classifyProjectSetup({ projectIntegration, migrationInstallation, workspaceState, adoption });
  const ready = userCli.healthy && projectIntegration.healthy && workspaceState.healthy;
  const result = {
    ready,
    state: ready ? "ready" : "attention",
    target: safeRoot,
    userCli,
    projectIntegration,
    migrationInstallation,
    workspaceState,
    adoption,
    setup: setup2
  };
  result.actions = actionsFor(result);
  return result;
}
export {
  ARTIFACT_PATHS,
  COMMAND_SURFACES,
  COMMAND_SURFACE_BY_ID,
  DOVE_AGENT_CAPSULE_BULLETS,
  DOVE_AGENT_CURIOSITY,
  DOVE_AGENT_DEFINITION,
  DOVE_AGENT_DESCRIPTION,
  DOVE_AGENT_DIRECT_JUDGMENT,
  DOVE_AGENT_FRAME,
  DOVE_AGENT_HUNCH,
  DOVE_AGENT_LAYERING,
  DOVE_AGENT_NAME,
  DOVE_AGENT_PERSONA_BULLETS,
  DOVE_AGENT_PROPORTIONALITY,
  DOVE_AGENT_STOPPING,
  DOVE_AGENT_SURFACES,
  DOVE_CLAUDE_SESSION_START_HOOK_COMMAND,
  DOVE_CLAUDE_STOP_HOOK_COMMAND,
  DOVE_RESEARCH_ACTION_LENSES,
  DOVE_RESEARCH_ACTION_LENS_FRAME,
  DOVE_RESEARCH_ADVANCE,
  DOVE_RESEARCH_AGENT_DESCRIPTION,
  DOVE_RESEARCH_AGENT_NAME,
  DOVE_RESEARCH_AGENT_RESPONSIBILITY,
  DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY,
  DOVE_RESEARCH_AUTO_CYCLE,
  DOVE_RESEARCH_AUTO_EXPLICIT_ONLY,
  DOVE_RESEARCH_AUTO_GOAL_RECOVERY,
  DOVE_RESEARCH_AUTO_NOT_MECHANICAL_SKILLS,
  DOVE_RESEARCH_AUTO_REPORTING_BOUNDARY,
  DOVE_RESEARCH_AUTO_REVIEW_RESPONSE,
  DOVE_RESEARCH_CAPABILITY_RESPONSIBILITY,
  DOVE_RESEARCH_CAPSULE_BULLETS,
  DOVE_RESEARCH_CURIOSITY,
  DOVE_RESEARCH_DIRECT_JUDGMENT,
  DOVE_RESEARCH_EVIDENCE_STATE,
  DOVE_RESEARCH_EXECUTE_LENS,
  DOVE_RESEARCH_EXPLORE_LENS,
  DOVE_RESEARCH_EXPRESS_LENS,
  DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY,
  DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY,
  DOVE_RESEARCH_FLAT_SKILL_SENTENCE,
  DOVE_RESEARCH_FRAME,
  DOVE_RESEARCH_HOST_TOOL_BOUNDARY,
  DOVE_RESEARCH_HUNCH,
  DOVE_RESEARCH_JUDGMENT_BOUNDARY,
  DOVE_RESEARCH_LAYERING,
  DOVE_RESEARCH_MAINLINE,
  DOVE_RESEARCH_MAINTENANCE_TRIGGER,
  DOVE_RESEARCH_MANUSCRIPT_READINESS_BASIS,
  DOVE_RESEARCH_MANUSCRIPT_REVIEW_BOUNDARY,
  DOVE_RESEARCH_MANUSCRIPT_REVIEW_GATE,
  DOVE_RESEARCH_MANUSCRIPT_REVIEW_LOOP,
  DOVE_RESEARCH_ONE_AGENT,
  DOVE_RESEARCH_OUTCOME_CONTINUATION,
  DOVE_RESEARCH_PERSONA_BULLETS,
  DOVE_RESEARCH_PROPORTIONALITY,
  DOVE_RESEARCH_ROUTABLE_SKILL_INVENTORY_TEXT,
  DOVE_RESEARCH_SKILL_INVENTORY_TEXT,
  DOVE_RESEARCH_STOPPING,
  DOVE_RESEARCH_SUPPORT_SUBORDINATION_BOUNDARY,
  DOVE_RESEARCH_WHOLE_MANUSCRIPT_READINESS_BOUNDARY,
  HOST_ADAPTERS,
  HOST_ADAPTER_POLICY,
  PACKAGE_NAME,
  PACKAGE_VERSION,
  PAPER_SEARCH_MCP_FRAGMENT,
  PAPER_SEARCH_MCP_PATH,
  PAPER_SEARCH_MCP_SELECTOR,
  PAPER_SEARCH_MCP_SERVER_NAME,
  PAPER_SEARCH_PACKAGE_SPECIFIER,
  PAPER_SEARCH_SUPPORT_SKILL_PATH,
  PROJECT_HOST_IDS,
  RESEARCH_DEFAULT_DIRECTORY_PATHS,
  RESEARCH_DEFAULT_DOCUMENTS,
  RESEARCH_DEFAULT_FILE_PATHS,
  RESEARCH_DEFAULT_PATHS,
  RESEARCH_DOCUMENT_PATHS,
  RESEARCH_LESSON_TOPICS,
  USER_RESPONSE_POLICY,
  allGeneratedCommandAdapterPaths,
  ambientContextForPrompt,
  appendExactMarkdownBlocks,
  appendExactMarkdownLines,
  commandAdapterPathsForHost,
  completeReinstallDoveLifecycle,
  exportResearch,
  generatedDoveAgentEntries,
  initializeProjectIntegration,
  inspectProjectDoctor,
  inspectProjectIntegration,
  inspectResearchDocuments,
  isHighConfidenceAmbientWorkPrompt,
  parseSessionStartPayload,
  parseUserPromptSubmitPayload,
  planResearchDefaults,
  prepareResearchDefaults,
  previewProjectCompleteReinstall,
  previewProjectUninstall,
  previewResearchExport,
  previewUninstallDoveLifecycle,
  readResearchDefaultsSnapshot,
  renderClaudeAmbientRule,
  renderClaudeAmbientSkill,
  renderClaudeDoveAgent,
  renderDoveAgentInstructions,
  renderDoveAgentPersonaSection,
  renderPaperSearchSupportSkill,
  researchDefaultTransactionEntries,
  sessionStartOutput,
  stopHookOutput,
  synchronizeProjectIntegrationOnly,
  uninstallDoveLifecycle,
  uninstallProjectIntegration,
  updateDoveLifecycle,
  updateProjectIntegration,
  userPromptSubmitOutput
};
