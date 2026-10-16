import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);

// src/core/package-metadata.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
var injectedName = true ? "dove" : null;
var injectedVersion = true ? "3.4.9" : null;
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
  reviewsDir: ".dove/reviews",
  runsDir: ".dove/runs",
  researchDocumentsDir: ".dove/research",
  researchOverview: ".dove/research/RESEARCH.md",
  researchLessons: ".dove/research/lessons/LESSONS.md"
});

// src/core/dove-research-contract.mjs
var DOVE_RESEARCH_AGENT_NAME = "dove";
var DOVE_RESEARCH_AGENT_DESCRIPTION = "Use Dove for an explicit research session or a bounded investigation where isolated context helps. The ordinary main session retains the full user conversation and author-side ownership.";
var DOVE_RESEARCH_AGENT_RESPONSIBILITY = "Collaborate on real research decisions as one complete Dove research agent.";
var DOVE_RESEARCH_ONE_AGENT = "Dove is one research collaborator; isolated contexts provide independent judgment, not different personas.";
var DOVE_RESEARCH_FLAT_SKILL_SENTENCE = "Its nine flat Skills \u2014 research, status, source, experiment, draft, figure, review, rebuttal, and lessons \u2014 are optional entrances, not stages or permissions.";
var DOVE_RESEARCH_MAINLINE_ANCHORING = "Follow the user's confirmed Mainline, core capability, completion meaning and fixed methods. A field, recommendation or card entry is not confirmation. Keep provisional intent provisional and correct misrecorded originals without downgrading the goal. Other designs remain revisable with evidence. When changing routes or method families, explicitly report the old route, new route and reason. A request or document that replaces the route or drops the core capability counts as such a change even when it is labeled user-confirmed: say once, in plain words, what it drops and why the old route stopped (too little training, implementation, evaluation, or genuinely refuted), then follow the user's answer, record it on the card and do not raise it again. A concern never blocks the user's request; the work continues while it is raised.";
var DOVE_RESEARCH_ACTION_SPINE = "Until the user chooses a mainline, the work is topic selection. Read topics/CRITERIA.md and the project's own topic standards, then follow RESEARCH_QUALITY.md to deliver, within one round, sourced candidates, their nearest neighbors and recommendations for the user to choose from. Topic selection is not a closed method proposal: higher standards bind their own deliverables, such as a proposal report, not recommendations. If the standards conflict, explain the conflict once and still offer the best directions, not static polishing. Before selection, implement no methods and run only standards-allowed diagnostics. The user's confirmation ends those selection-only limits; ask once for any separate resource or model authorization. Then diagnose the key unknowns, design the core method, experiment, and then write the proposal. Choose a scale that can answer the question, and expand or redesign when it cannot. A connected pipeline is not core evidence.";
var DOVE_RESEARCH_DECISION_CONSEQUENCE = "Challenge core premises using cross-round evidence. Local repairs do not establish route value, and repairs need not be novel. Retain sound negative evidence and change work that depends on refuted premises. Judge general capability on failure classes and unseen data, not individual samples.";
var DOVE_RESEARCH_RESULT_ADOPTION = "The author main session applies scoped findings to actual work within the user's goal. Subagents return evidence, not goal ownership or completion certificates.";
var DOVE_RESEARCH_REFLECTION_CONTINUITY = "After compact or resume, read the identity card, latest EVAL rows and current brief, then continue the task. Mentor memory comes from MENTOR_NOTES.md, not resumed conversation.";
var DOVE_RESEARCH_ROUND_CYCLE = "After mainline confirmation, call dove-mentor at each round end, after two consecutive rounds without new scientific results, when the user corrects direction or questions the paper claim/story, before changing routes, or when requested. Engineering and verification failures count as rounds without results: seek the mentor's diagnosis after two, and by the third explain the blockage and ask the user before another round. Use a new mentor context for each round, without the execution conversation; two or three clarifications within one judgment are fine. Mentors on either host read .dove/install/RESEARCH_QUALITY.md for returns and tracking. Send Dove's generated mentor call template (dove mentor brief --project <root>) as the whole prompt plus the trigger. Status questions and bounded replies need no round or handoff; honor discussion-only and stop requests.";
var DOVE_RESEARCH_ROUND_RECORDS = "Research records are read by the user on the Dove dashboard, so write the identity card, EVAL conclusions, briefs and results in natural Chinese full sentences. Explain internal codes, version names and abbreviations in plain words on first use or leave them out, and keep process detail in linked files. Each round has one rounds/NNN-brief.md (about 2000 characters) and one NNN-result.md (about 3000); put details in ordinary project files and link them, not extra round attachments. A brief starts with Author: mentor / user / external (\u5BFC\u5E08 / \u7528\u6237 / \u5916\u90E8), method version and dated user sources, then a line \u4E00\u53E5\u8BDD\uFF1Asaying in plain words what this round does, and has a section ## \u9884\u671F\u7ED3\u679C stating the expected result and which outcomes would change the decision; priority is user > external > mentor. Save mentor briefs verbatim; name replacement authors and reasons. A result starts with \u4E00\u53E5\u8BDD\uFF1Asaying what happened and has four sections: ## \u6539\u4E86\u4EC0\u4E48, ## \u6D4B\u5230\u4E86\u4EC0\u4E48, ## \u9884\u671F\u4E0E\u5B9E\u9645, ## \u5BF9\u672C\u8F6E\u8BF4\u660E\u7684\u53CD\u9A73\u4E0E\u4E8B\u5B9E\u66F4\u6B63. The mentor answers the objections first. RESEARCH.md is a short history index; preserve historical missions/, experiments/ and claims/ without adding entries.";
var DOVE_RESEARCH_EVALUATION = "EVAL.md starts with a completion reference to the script, protocol and all user metrics, then one row per method version with the columns \u65E5\u671F\u3001\u7248\u672C/\u8F6E\u6B21\u3001\u534F\u8BAE\u4E0E\u6570\u636E\u3001\u6D4B\u91CF\u7ED3\u679C\u3001\u672A\u89C1\u6570\u636E\u4E0E\u6CDB\u5316\u5DEE\u8DDD\u3001\u7ED3\u8BBA\u3001\u4EA7\u7269 (existing English headers may stay). Cells hold numbers and one short sentence (about 200 characters); link detailed values. Keep engineering logs and process status out. Formal comparisons include complete strong same-input baselines and all confirmed requirements; unknown stays unknown. The executor repairs evaluator errors and recomputes all comparable historical rows, using retained outputs before rerunning; keep old protocols as history. Save the mentor's current assessment as specified in RESEARCH_QUALITY.md.";
var DOVE_RESEARCH_EXPERIMENT_ITERATION = "Develop with available ground truth and reruns, without per-run registration. Each round uses one method-code version, including coordinated changes; later code changes need a new version and full applicable evaluation. Retain old versions for ablation, with fair budgets and causal controls fixing other factors. After test use, changed methods need a fresh draw unused in development or previous tests and same-set baselines. For final confirmation, put the claim, controls, data and metrics in the brief and use heldout once.";
var DOVE_RESEARCH_CORRECTION_RECORDING = "Keep IDENTITY.md short enough to read at a glance (about 1200 characters), in fixed fields: Current round: rounds/NNN-brief.md; Round status: ongoing / paused / completed; Mainline; Core capability (what the research must show, such as a model that learns from data, with the user's quotes); Target tier (conference/journal level); Deployment inputs/outputs; Completion; User restrictions; Recent corrections; Research state. Ask once if the target tier is missing; do not assume one. Each restriction names the quotation, date/source, whether it is original user wording or a relay, and whether it is long-term or task-specific. Relays and task-specific limits are not standing restrictions. Update research state after important results and apply corrections to action, not just quotations. Keep method rejections in briefs or mentor notes. Preserve unchanged Mainline wording. For recurring corrections, dove projects status --json locates relevant cards; ask once before changing AUTHOR_PREFERENCES and never edit it automatically.";
function renderDoveResearchReanchor() {
  return "Read the identity card, EVAL.md and current brief; continue the current task within authorization. Keep Mainline stable and dated user originals.";
}
var DOVE_RESEARCH_CLARIFICATION = "Record clear user words without reconfirmation. Ask for undecided direction or changes to the goal, fixed methods, deployment inputs/outputs or resource commitments. The executor decides engineering, parameters, acceleration and evaluator repairs; the mentor judges direction and time spent. When you add a restriction or check, say what it protects; remove self-added ones that protect nothing. Without a reply, do only independent authorized work, not assume consent.";
var DOVE_RESEARCH_CROSS_DOMAIN_INTUITION = "Use literature, adjacent fields, mathematics, physical reasoning and analogies to invent testable mechanisms; seek where the analogy fails rather than collecting citations.";
var DOVE_RESEARCH_ACTUAL_MATERIAL_FACT_BOUNDARY = "State project methods, experiment procedures, result numbers, citation content, and source facts only from material actually read, retrieved, executed, or inspected; use general knowledge only for hypotheses and search directions.";
var DOVE_RESEARCH_CANDIDATE_COVERAGE = "Separate candidate generation or reachability, selection on the same candidates, and end-to-end effect. Fixed candidates cannot assess generation; successful intersections cannot represent the full task. State how failed, missing, invalid and excluded cases enter the denominator.";
var DOVE_RESEARCH_MAINTENANCE_TRIGGER = "the user explicitly asks to record, update, or save Dove research context, a result changes a conclusion, route decision, or priority within the confirmed goal, or preserving evidence and continuation context is genuinely useful";
var DOVE_RESEARCH_QUALITY_CRITERIA = Object.freeze([
  "Problem value (1\u20134) \u2014 insufficient: success adds no consequential knowledge or benefit beyond alternatives; limited but clear: a real need with limited consequences; important: removes a consequential bottleneck, severe failure or key dispute; major: substantially changes solvability, practice or understanding. Ground benefits and alternatives; breadth alone is not value.",
  "Novelty (1\u20134) \u2014 none: covered/restated; limited: local extension of the solution principle; substantive: consequential new methods, relationships, resources, results or understanding; major: a new solution principle or generative, unifying framework. Subtract prior contributions at equal granularity across fields. Shared functions need not mean equal contributions; exclusivity is unnecessary. Search depth affects confidence, not magnitude.",
  "Mechanism and theory (1\u20134) \u2014 unsound: contradiction, circularity or a decisive invalid step; limited but sound: a valid local relationship under stated conditions; strong: discriminating predictions or boundaries addressing serious alternatives; deep: decisive constraints, tight bounds or unifying relationships. Unformed or unchecked mechanisms remain unknown, not unsound. Match proof or empirical grounds to the claim; complexity cannot offset invalidity.",
  "Method quality and feasibility (1\u20134) \u2014 critically unsuitable: necessary capability or conditions are unavailable, or valid grounds rule out worthwhile benefit; partly suitable: important capability, cost or boundary gaps; fit for purpose: capabilities, benefit, constraints and cost fit the use; substantial advantage: a clear overall benefit/cost/capability advantage over serious alternatives. Design fit is provisional until effects are observed. One failed model or Oracle is not a whole-space impossibility bound.",
  "Data and evaluation (1\u20134) \u2014 invalid: target mismatch, leakage, wrong accounting, incomparable conditions or decisive confounding; limited: reliable partial judgment with consequential coverage or identification gaps; valid: measurement, comparison, confounds and uncertainty support the scoped claim; strongly discriminating: also resolves important alternatives, heterogeneity or boundaries. Small diagnostics may be strong for a bounded question. More data and frozen protocols cannot repair invalid evaluation.",
  "Implementation (1\u20133) \u2014 unfit: necessary behavior is wrong, absent, inaccessible or hides failures; restricted: a correct local chain with consequential reliability, efficiency or downstream gaps; reliable within scope: actual producer/consumer behavior and use boundaries work, failures are visible and costs proportionate. Reliability needs execution grounds; no execution is unknown, not failure. Evolvability is a tradeoff, not a universally higher grade.",
  "Experiment and evidence value (1\u20134) \u2014 none: no valid judgment contribution; limited update: a real lead or constraint with major judgment gaps; proportionate conclusion: supports, refutes or bounds an important claim; resolves key uncertainty: settles a decisive dispute and important alternatives. Judge knowledge added separately from method quality. Reliable negative evidence can be strongest; run counts, nonsignificance alone and positive scores are not conclusions.",
  "Expression and delivery (1\u20134) \u2014 misleading/unusable: claims conflict with evidence or the artifact fails its use; understandable but weak: consequential reasoning or usability gaps; accurate/clear/usable: claims, evidence, limits and output align; substantially more efficient: faithful expression reveals the insight and reduces understanding or use costs. Scope follows the artifact and audience. Beauty, draft count and build success cannot replace scientific accuracy."
]);
var DOVE_RESEARCH_REFERENCE_BULLETS = Object.freeze([
  "Judge substantive quality, confidence in evidence, sufficiency for the current use and completed work separately. Explain unknown, unformed or inapplicable items instead of giving zero. State scope and conditions; do not average ordinal grades or infer acceptance probabilities.",
  ...DOVE_RESEARCH_QUALITY_CRITERIA,
  "Choose core work and its scale using the goal, benefits, alternatives, mechanism and unknowns in the shared contract. Inspected sources, derivation, code or observations can justify implementing a selected method before effects are measured or theory and baseline libraries are complete.",
  "For topic selection, apply the sourced gaps, mechanism search, candidate cards and adversarial review in RESEARCH_QUALITY.md. For other novelty claims, inspect decisive neighbors across fields at equal contribution granularity. Known parts do not rule out novelty; paradigm labels and absence of precedent do not prove it. Separate operation equivalence, expressive coverage, public availability and empirical parity. Use criteria relevant to the deliverable.",
  "Interfaces, inherited code, available datasets and teacher outputs do not define value, reference truth or the user's goal. If the problem, population, allowed information, output, reference, proxy, contribution or completion meaning changes, explain it. A new route cannot erase an old proposition's failure or inherit its success.",
  DOVE_RESEARCH_ACTUAL_MATERIAL_FACT_BOUNDARY,
  DOVE_RESEARCH_CANDIDATE_COVERAGE,
  "Full-task comparisons against reasonable external alternatives test utility; internal ablations and causal controls test attribution. Neither replaces the other. Before interpreting anomalies, inspect the relevant code, data, configuration, randomness, metrics and analysis. Preserve units, input conditions, budgets, uncertainty, failed cases and exclusions. Execution alone proves neither valid evaluation nor the proposed mechanism.",
  "Compare predictions with results and distinguish implementation failure, invalid evaluation, local mechanism limits and a refuted core proposition. Retain sound evidence and stop dependent claims. Repairs need no novelty and do not automatically contribute novelty. The executor handles engineering and evaluator corrections; the mentor independently judges direction and the time being spent, rather than selecting parameters or adjudicating equivalence.",
  "Match evidence to the intended conclusion and investment. Informative exploration needs plausible value, a concrete hypothesis and accessible resources; major development also needs a meaningful remaining contribution and feasible validation. Confirmation needs reliable execution and fair evaluation; conclusions need sufficient evidence and serious counterevidence addressed. No score compensates for leakage, contradiction or a covered core contribution. Reproduction, repair and delivery do not automatically reopen topic selection.",
  "Choose engineering by capability, resources and total time to trustworthy evidence or delivery, including preparation, evaluation and rework. Reuse valid measurements; profile representative work only when useful. Use suitable available accelerators without inventing single-card or CPU-only limits, redundant fallbacks or infrastructure without benefit. Kernel speed and hardware utilization do not establish end-to-end speed.",
  "At important-result mentor calls, save its current eight-dimensional quality assessment in EVAL.md with grounds and unknowns. The weakest decisive dimension informs the next brief; the main session does not duplicate that self-assessment. Measurements and predictions remain separate. Paper-review objections are reasoned judgments, not new empirical evidence, permission or acceptance. Submission still needs scientific sufficiency, independent current-version review and actual delivery readiness."
]);
function renderDoveResearchQualityReference() {
  return `# Dove \u7814\u7A76\u8D28\u91CF\u8981\u70B9

\u65B0\u4F5C\u8005\u4E3B\u4E0A\u4E0B\u6587\u4EB2\u81EA\u8BFB\u672C\u6458\u8981\u548C\u4F5C\u8005\u504F\u597D\u6458\u8981\uFF0C\u538B\u7F29\u6216\u6062\u590D\u540E\u590D\u7528\u3002\u7EC6\u5219\u6309\u9700\u770B [\u8D28\u91CF\u5168\u6587](RESEARCH_QUALITY_FULL.md)\u3002

- \u5224\u65AD\u770B\u95EE\u9898\u3001\u65B9\u6CD5\u4E0E\u8D21\u732E\uFF0C\u7528\u6237\u76EE\u6807\u4E0D\u56E0\u67D0\u4E2A\u7EC4\u4EF6\u6216\u4EE3\u7406\u6307\u6807\u800C\u964D\u4F4E\u3002\u521B\u65B0\u4E0D\u8981\u6C42\u529F\u80FD\u72EC\u5360\uFF0C\u529F\u80FD\u76F8\u540C\u4E5F\u672A\u5FC5\u8D21\u732E\u76F8\u540C\uFF1B\u6362\u8303\u5F0F\u3001\u6362\u9886\u57DF\u6216\u7EC4\u5408\u672C\u8EAB\u4E0D\u8BC1\u660E\u521B\u65B0\u3002\u6309\u5177\u4F53\u65B9\u6CD5\u3001\u5173\u7CFB\u3001\u7ED3\u679C\u6216\u8BA4\u8BC6\u6838\u5BF9\u9886\u57DF\u5185\u5916\u7684\u5148\u4F8B\uFF1B\u8BF4\u67D0\u9879\u80FD\u529B\u901A\u7528\uFF0C\u8981\u6709\u6CDB\u5316\u4F9D\u636E\u3002
- \u516B\u7EF4\u6307\u95EE\u9898\u4EF7\u503C\u3001\u521B\u65B0\u3001\u673A\u5236\u7406\u8BBA\u3001\u65B9\u6CD5\u53EF\u884C\u6027\u3001\u6570\u636E\u8BC4\u4EF7\u3001\u5B9E\u73B0\u3001\u5B9E\u9A8C\u8BC1\u636E\u3001\u8868\u8FBE\u4EA4\u4ED8\u3002\u5B9E\u8D28\u8D28\u91CF\u3001\u5224\u65AD\u628A\u63E1\u3001\u662F\u5426\u591F\u7528\u3001\u5DE5\u4F5C\u662F\u5426\u5B8C\u6210\u5206\u5F00\u8BF4\u660E\uFF1B\u672A\u77E5\u3001\u5C1A\u672A\u5F62\u6210\u6216\u4E0D\u9002\u7528\u7684\u7EF4\u5EA6\u5199\u660E\u539F\u56E0\u800C\u4E0D\u586B\u96F6\uFF0C\u5E8F\u6570\u4E0D\u6C42\u5E73\u5747\uFF0C\u4E5F\u4E0D\u6362\u7B97\u6210\u5F55\u7528\u6982\u7387\u3002
- \u5B9E\u9645\u5DE5\u4F5C\u6309\u4EFB\u52A1\u6536\u76CA\u3001\u5408\u7406\u66FF\u4EE3\u3001\u673A\u5236\u4F9D\u636E\u548C\u5173\u952E\u672A\u77E5\u6765\u9009\u3002\u89C4\u6A21\u548C\u6539\u52A8\u8981\u80FD\u56DE\u7B54\u95EE\u9898\uFF1A\u56DE\u7B54\u4E0D\u4E86\u5C31\u6269\u5927\u6216\u91CD\u65B0\u8BBE\u8BA1\uFF0C\u80FD\u56DE\u7B54\u5C31\u4E0D\u5FC5\u66F4\u5927\u3002\u94FE\u8DEF\u63A5\u901A\u53EA\u8BF4\u660E\u80FD\u8DD1\uFF0C\u6838\u5FC3\u673A\u5236\u8FD8\u8981\u53E6\u884C\u8BBE\u8BA1\u548C\u68C0\u9A8C\u3002
- \u5148\u4F8B\u6BD4\u8F83\u5224\u65AD\u8D21\u732E\u662F\u5426\u88AB\u8986\u76D6\uFF0C\u5B8C\u6574\u4EFB\u52A1\u548C\u5916\u90E8\u6BD4\u8F83\u5224\u65AD\u6548\u7528\uFF0C\u5185\u90E8\u5BF9\u7167\u5224\u65AD\u5F52\u56E0\uFF0C\u4E09\u8005\u5404\u7BA1\u4E00\u4EF6\u4E8B\u3002\u4E8B\u5B9E\u6765\u81EA\u5B9E\u8BFB\u3001\u63A8\u5BFC\u3001\u4EE3\u7801\u6216\u89C2\u5BDF\uFF0C\u6548\u679C\u6765\u81EA\u5B9E\u6D4B\uFF1B\u8BB0\u5F55\u4FE1\u606F\u6761\u4EF6\u3001\u9884\u7B97\u3001\u5931\u8D25\u5206\u6BCD\u3001\u672A\u77E5\u4E0E\u53CD\u8BC1\u3002
- \u5F00\u53D1\u9636\u6BB5\u53EF\u4EE5\u770B\u771F\u503C\u3001\u53CD\u590D\u91CD\u8DD1\u3002\u65B9\u6CD5\u4E00\u6539\u5C31\u5F00\u65B0\u7248\u672C\u5E76\u5B8C\u6574\u8BC4\u6D4B\uFF1B\u6D4B\u8BD5\u96C6\u7528\u8FC7\u4E4B\u540E\u518D\u6539\u65B9\u6CD5\uFF0C\u8981\u7528\u771F\u6B63\u6CA1\u7528\u8FC7\u7684\u6D4B\u8BD5\u6570\u636E\uFF0C\u5E76\u5728\u540C\u4E00\u6279\u6570\u636E\u4E0A\u5BF9\u7167\u57FA\u7EBF\u3002\u6267\u884C\u8005\u4FEE\u8BC4\u6D4B\u5E76\u91CD\u7B97\u53EF\u6BD4\u7684\u5386\u53F2\u7ED3\u679C\uFF0C\u76EE\u6807\u4FDD\u6301\u4E0D\u53D8\uFF1B\u5BFC\u5E08\u53EA\u7BA1\u65B9\u5411\u3002
- \u91CD\u8981\u7ED3\u679C\u7531\u5BFC\u5E08\u7ED9\u51FA\u7EA6 1000 \u5B57\u7B26\u7684\u5F53\u524D\u516B\u7EF4\u5224\u65AD\uFF0C\u8BF4\u660E\u7B49\u7EA7\u3001\u4F9D\u636E\u4E0E\u672A\u77E5\uFF1B\u4E3B\u4F1A\u8BDD\u66FF\u6362 EVAL.md \u8868\u540E\u5F53\u524D\u8BC4\u5206\uFF0C\u4E0D\u8FFD\u52A0\u65E5\u5FD7\u6216\u81EA\u8BC4\u3002\u6700\u5F31\u4E14\u51B3\u5B9A\u6027\u7684\u7EF4\u5EA6\u51B3\u5B9A\u4E0B\u4E00\u8F6E\u91CD\u70B9\uFF1B\u95EE\u9898\u4EF7\u503C\u3001\u521B\u65B0\u8FD9\u7C7B\u51B3\u5B9A\u6027\u7EF4\u5EA6\u8FDE\u7EED\u4E24\u6B21\u5224\u4E3A\u672A\u77E5\uFF0C\u67E5\u6E05\u5B83\u5C31\u662F\u4E0B\u4E00\u8F6E\u7684\u9996\u8981\u5DE5\u4F5C\u3002\u8D1F\u7ED3\u679C\u540C\u6837\u589E\u52A0\u8BA4\u8BC6\uFF1B\u5B9E\u73B0\u9519\u8BEF\u3001\u8BC4\u4EF7\u5931\u6548\u548C\u547D\u9898\u88AB\u5426\u5B9A\u8981\u5206\u5F00\u8BF4\uFF0C\u5DE5\u7A0B\u6838\u9A8C\u3001\u8BA1\u5212\u548C\u8BB0\u5F55\u6570\u91CF\u5355\u72EC\u5217\u51FA\uFF0C\u4E0D\u7B97\u79D1\u7814\u7ED3\u679C\u3002

## \u9009\u9898\u4E0E\u65B0\u610F\u5224\u65AD

\u9009\u9898\u4ECE\u9879\u76EE\u6807\u51C6\u8BA4\u53EF\u7684\u6709\u4EF7\u503C\u95EE\u9898\u51FA\u53D1\uFF0C\u5148\u5217\u51FA\u51E0\u6761\u6311\u6218\u8F74\uFF0C\u6BCF\u6761\u8F74\u6DF1\u6316\uFF0C\u4E00\u822C\u627E\u4E00\u5230\u4E24\u4E2A\u771F\u6B63\u7684\u7F3A\u53E3\uFF0C\u5B81\u6DF1\u52FF\u591A\u3002\u63A8\u8350\u65F6\u5199\u660E\u5F3A\u57FA\u7EBF\u7684\u771F\u5B9E\u5931\u8D25\u53CA\u6570\u5B57\u6765\u6E90\u3002

\u6BCF\u4E2A\u7F3A\u53E3\u5199\u6210\u201C\u5DF2\u6709\u65B9\u6CD5\u901A\u8FC7 Y \u505A X\uFF0C\u4F46 Y \u7559\u4E0B Z\u201D\uFF0C\u8BF4\u660E\u573A\u666F\u548C\u80CC\u540E\u7684\u5047\u8BBE\uFF0C\u70B9\u540D\u81F3\u5C11\u4E24\u7BC7\u8BFB\u8FC7\u6B63\u6587\u3001\u5DEE\u4E00\u70B9\u5C31\u505A\u5230\u7684\u8BBA\u6587\u53CA\u5404\u81EA\u7684\u4E0D\u8DB3\uFF0C\u5199\u51FA\u7F3A\u9677\u7C7B\u522B\uFF0C\u4EE5\u53CA\u80FD\u8BC1\u660E\u4EE5\u540E\u7684\u65B9\u6CD5\u8865\u4E0A\u5B83\u7684\u95ED\u5408\u89C2\u5BDF\u3002\u65B9\u6CD5\u7C7B\u7F3A\u53E3\u8981\u5177\u4F53\u5230\u65B9\u6CD5\uFF1B\u53EA\u770B\u8FC7\u6458\u8981\u3001\u6216\u8005\u53EA\u662F\u201C\u6CA1\u4EBA\u505A\u8FC7\u201D\uFF0C\u90FD\u4E0D\u7B97\u7F3A\u53E3\u3002

\u7528\u6237\u5B9A\u4E3B\u7EBF\u5C31\u7ED3\u675F\u9009\u9898\uFF0C\u4E0D\u7B49\u65B9\u6CD5\u95ED\u5408\u3001\u5199\u6210\u7406\u8BBA\u5F00\u9898\uFF1B\u8D21\u732E\u7C7B\u578B\u6309\u9879\u76EE\u6807\u51C6\u6765\uFF0C\u6807\u51C6\u91CC\u9488\u5BF9\u6B63\u5F0F\u4EA7\u7269\uFF08\u5982\u5F00\u9898\u62A5\u544A\uFF09\u7684\u95E8\u69DB\u53EA\u7EA6\u675F\u90A3\u4EFD\u4EA7\u7269\uFF0C\u4E0D\u7528\u6765\u6263\u4F4F\u63A8\u8350\u3002

\u9488\u5BF9\u6BCF\u4E2A\u7F3A\u53E3\uFF0C\u7528\u901A\u5E38 6\u201310 \u4E2A\u67E5\u8BE2\uFF0C\u8DE8\u81F3\u5C11 3 \u4E2A\u5176\u4ED6\u5B50\u9886\u57DF\u53BB\u627E\u89E3\u51B3\u8FC7\u7ED3\u6784\u76F8\u4F3C\u96BE\u9898\u7684\u673A\u5236\uFF0C\u4FDD\u7559\u67E5\u8BE2\u548C\u6765\u6E90\uFF1B\u672C\u9886\u57DF\u7684\u6765\u6E90\u4E5F\u53EF\u4EE5\uFF0C\u4F46\u4E0D\u80FD\u53EA\u662F\u91CD\u65B0\u53D1\u73B0\u6700\u8FD1\u90BB\u3002\u8BFB\u6765\u6E90\u673A\u5236\u548C\u6700\u63A5\u8FD1\u7684\u672C\u9886\u57DF\u5DE5\u4F5C\u7684\u6B63\u6587\uFF0C\u5148\u5E76\u5217\u751F\u6210\u591A\u4E2A\u601D\u8DEF\uFF0C\u518D\u6BD4\u8F83\u3002

\u5019\u9009\u5361\u7528\u4E03\u680F\uFF1A\u4E00\u53E5\u8BDD\uFF1B\u7F3A\u53E3\uFF1B\u6765\u6E90\u673A\u5236\uFF08\u7F16\u53F7\u3001\u539F\u7406\uFF09\uFF1B\u5BF9\u5E94\u5173\u7CFB\uFF08\u8C01\u626E\u6F14\u8C01\uFF09\uFF1B\u6210\u7ACB\u524D\u63D0\uFF08\u7406\u7531\u3001\u6761\u4EF6\uFF09\uFF1B\u8FD1\u90BB\u5DEE\u522B\uFF08\u672C\u9886\u57DF\u7F16\u53F7\u3001\u5177\u4F53\u5DEE\u522B\uFF09\uFF1B\u6700\u5927\u98CE\u9669\uFF08\u542B\u672A\u77E5\uFF09\u3002\u6709\u4E00\u4E2A\u6709\u6765\u6E90\u7684\u601D\u8DEF\u5373\u53EF\u4F9B\u9009\uFF0C\u65B9\u6CD5\u8BBE\u8BA1\u548C\u95ED\u5408\u7559\u5728\u4E3B\u7EBF\u91CC\u505A\uFF1B\u6539\u8FDB\u5DF2\u6709\u5019\u9009\u65F6\u5199\u660E\u6539\u8FDB\u81EA\u54EA\u4E2A\u7F16\u53F7\u3001\u8865\u4E86\u54EA\u4E2A\u5F31\u70B9\u3001\u6539\u4E86\u4EC0\u4E48\uFF0C\u4E0D\u7528\u5B8C\u6574\u65B9\u6848\u628A\u60F3\u6CD5\u6324\u6389\u3002

\u5BFC\u5E08\u6216\u9694\u79BB\u7684 Dove \u4E0A\u4E0B\u6587\u6838\u5BF9\u673A\u5236\u548C\u8FC1\u79FB\u524D\u63D0\uFF0C\u5E76\u6309\u201C\u501F\u7528\u673A\u5236\uFF0B\u76EE\u6807\u95EE\u9898\u201D\u4E3B\u52A8\u68C0\u7D22\u53CD\u8BC1\uFF1B\u8FD9\u4E0D\u66FF\u4EE3 dove-review \u7684\u8BBA\u6587\u5BA1\u7A3F\u3002\u6BCF\u4E2A\u5019\u9009\u7ED9\u201C\u7559\u4E0B / \u4FEE\u6539 / \u5426\u6389\uFF08\u539F\u56E0\uFF09\u201D\uFF1A\u4FEE\u6539\u53EA\u70B9\u65B0\u610F\u3001\u8FDE\u8D2F\u3001\u53EF\u884C\u3001\u6E05\u6670\u3001\u5BF9\u5E94\u6216\u4F9D\u636E\u4E2D\u6700\u5F31\u4E00\u9879\uFF0C\u9644\u7F16\u53F7\u3001\u4E00\u4E24\u53E5\u8BC1\u636E\u548C\u6700\u5F3A\u53CD\u5BF9\u3002\u5361\u5934\u7559\u72B6\u6001\u3001\u9636\u6BB5\u3001\u5B9A\u4F4D\u3001\u4E03\u680F\u3001\u8BC4\u5BA1\u3001\u7126\u70B9\u3001\u53CD\u5BF9\u3001\u4F9D\u636E\uFF0C\u4EE5\u53CA\u53EF\u9009\u7684\u201C\u6539\u8FDB\u81EA\u201D\u3002

\u4E00\u8F6E\u5185\u4EA4\u51FA\u5019\u9009\u3001\u8FD1\u90BB\u548C\u6700\u4F73 2\u20133 \u4E2A\u63A8\u8350\uFF1B\u624E\u5B9E\u7684\u4E0D\u8DB3\u5C31\u7ED9 1 \u4E2A\uFF0C\u4E0D\u51D1\u6570\u3002\u5982\u679C\u6807\u51C6\u4E92\u76F8\u77DB\u76FE\u3001\u7981\u6B62\u53D6\u5F97\u9700\u8981\u7684\u8BC1\u636E\u6216\u95E8\u69DB\u5361\u4F4F\uFF0C\u5411\u7528\u6237\u8BF4\u660E\u51B2\u7A81\u4E00\u6B21\uFF0C\u540C\u65F6\u4ECD\u7ED9\u51FA\u6700\u4F73\u65B9\u5411\uFF0C\u8BF7\u7528\u6237\u9009\u6216\u8C03\u6807\u51C6\uFF0C\u4E0D\u518D\u9759\u6001\u6253\u78E8\u3002\u9009\u5B9A\u524D\u4E0D\u5B9E\u73B0\u65B9\u6CD5\uFF0C\u53EA\u505A\u6807\u51C6\u5141\u8BB8\u7684\u8BCA\u65AD\uFF1B\u786E\u8BA4\u540E\u7ED3\u675F\u9009\u9898\u671F\u9650\u5236\uFF0C\u7F3A\u7684\u72EC\u7ACB\u8D44\u6E90\uFF0F\u8DD1\u6A21\u578B\u6388\u6743\u5408\u5E76\u95EE\u4E00\u6B21\uFF0C\u7136\u540E\u8BCA\u65AD\u5173\u952E\u672A\u77E5\u3001\u8BBE\u8BA1\u6838\u5FC3\u65B9\u6CD5\u3001\u505A\u6B63\u5F0F\u5B9E\u9A8C\u3001\u5199\u5F00\u9898\u62A5\u544A\u3002

\u9700\u8981\u6B63\u6587\u7EC6\u8282\u65F6\uFF0C\u5E26 1\u20135 \u4E2A\u5177\u4F53\u95EE\u9898\u8BFB\u5168\u6587\uFF0C\u5728 .dove/research/papers/<id>.md \u8BB0\u6807\u9898\u3001\u6765\u6E90\u3001\u4E00\u6BB5\u201C\u8FD9\u7BC7\u505A\u4E86\u4EC0\u4E48\u201D\u548C\u7D2F\u79EF\u9010\u95EE\u56DE\u7B54\uFF0C\u6CE8\u660E\u7AE0\u8282\u3001\u9875\u7801\u6216\u516C\u5F0F\u7B49\u6B63\u6587\u4F4D\u7F6E\u3002\u590D\u7528\u5DF2\u56DE\u7B54\u7684\u95EE\u9898\uFF0C\u4FDD\u7559\u65E7\u7B54\u6848\uFF0C\u53EA\u8865\u65B0\u95EE\u9898\uFF1B\u6B63\u6587\u4E0D\u80FD\u56DE\u7B54\u7684\u660E\u786E\u8BB0\u672A\u77E5\u3002\u65B0\u610F\u4E0E\u649E\u9898\u5224\u65AD\u5F15\u7528\u8FD9\u4E9B\u7B14\u8BB0\u3002\u53EA\u8BFB\u4E0A\u4E0B\u6587\u8FD4\u56DE\u65B0\u589E\u95EE\u7B54\u7531\u4E3B\u4F1A\u8BDD\u4FDD\u5B58\uFF0C\u4E0D\u81EA\u884C\u5199\u5165\u3002

## \u4E24\u79CD\u5BBF\u4E3B\u5171\u540C\u7684\u5BFC\u5E08\u8FD4\u56DE

\u5BFC\u5E08\u6BCF\u6B21\u8FD4\u56DE\u7EA6 1000 \u5B57\u7B26\u7684\u81EA\u6709\u7B14\u8BB0\uFF0C\u5199\u5224\u65AD\u3001\u9884\u6D4B\u4E0E\u5151\u73B0\u3001\u5426\u6389\u7684\u65B9\u6CD5\u65CF\u53CA\u539F\u56E0\u3001\u62C5\u5FE7\u548C\u539F\u8BDD\u5DF2\u8BFB\u8303\u56F4\u3002\u4E3B\u4F1A\u8BDD\u539F\u6837\u8FFD\u52A0\u5230 MENTOR_NOTES.md\uFF1B\u8D85\u8FC7\u7EA6 6000 \u5B57\u7B26\u65F6\uFF0C\u7531\u5BFC\u5E08\u5408\u5E76\u6210\u7EA6 3000 \u5B57\u7B26\u7684\u66FF\u6362\u5168\u6587\uFF0C\u4E0D\u7531\u6267\u884C\u8005\u4EE3\u5199\u3002

\u6BCF\u6B21\u5BFC\u5E08\u8C03\u7528\u90FD\u68C0\u67E5 watch/config.json\u3001\u672A\u5224\u65AD\u8BBA\u6587\u3001\u5DF2\u6709\u5F71\u54CD\u548C\u6700\u8FD1\u626B\u63CF\uFF0C\u4E0D\u7B49\u5F85\u65B0\u8F6E\u6B21\u3002\u914D\u7F6E\u4E3A draft \u6216\u660E\u663E\u8DD1\u504F\u65F6\uFF0C\u5BFC\u5E08\u7ED9\u51FA\u672C\u9879\u76EE\u7684\u5173\u952E\u8BCD\u3001\u4F5C\u8005\u3001\u4F1A\u8BAE\u3001\u673A\u6784\u548C\u8FD1\u90BB\u7F16\u53F7\uFF0C\u4E3B\u4F1A\u8BDD\u5199\u56DE\u5E76\u8BBE source \u4E3A mentor\u3002

\u8BBA\u6587\u9010\u7BC7\u6309\u201C- ID | \u5224\u65AD | \u7406\u7531 | \u65B9\u5411 | \u4E2D\u6587\u4E00\u53E5\u8BDD\u201D\u8FD4\u56DE\uFF0C\u5224\u65AD\u662F\u649E\u9898\u3001\u65B0\u57FA\u7EBF\u3001\u53EF\u501F\u7528\u6216\u65E0\u5173\u4E4B\u4E00\u3002\u5BFC\u5E08\u6216\u4E3B\u4F1A\u8BDD\u53EF\u636E\u6458\u8981\u5199\u201C\u8FD9\u7BC7\u505A\u4E86\u4EC0\u4E48\u201D\uFF0C\u4F46\u4E0D\u628A\u6458\u8981\u6216\u6838\u5B9E\u8FC7\u7684\u5143\u6570\u636E\u5F53\u6210\u8BFB\u8FC7\u5168\u6587\uFF1B\u91CD\u8981\u6216\u7591\u4F3C\u649E\u9898\u7684\u8BBA\u6587\u5148\u67E5\u5168\u6587\u548C\u4F5C\u8005\u7684\u76F8\u5173\u5DE5\u4F5C\uFF0C\u67E5\u4E0D\u5230\u7684\u4FDD\u7559\u4E3A\u672A\u77E5\uFF0C\u82E5\u8986\u76D6\u6838\u5FC3\u8D21\u732E\u5C31\u627E\u7528\u6237\u3002\u4E3B\u4F1A\u8BDD\u628A\u5224\u65AD\u53E6\u5B58\u4E3A watch/impact-\u65E5\u671F.md\uFF0C\u65B0\u57FA\u7EBF\u548C\u53EF\u501F\u7528\u7684\u5185\u5BB9\u7528\u5230\u4E0B\u4E00\u6B65\u5DE5\u4F5C\u91CC\u3002

\u65B0\u57FA\u7EBF\u3001\u53EF\u501F\u7528\u6216\u649E\u9898\u7684\u8BBA\u6587\uFF0C\u7531\u663E\u5F0F\u9762\u677F\u79EF\u7D2F\u6216\u4E0B\u4E00\u6B21 watch \u8FD0\u884C\u6309\u65B9\u5411\u5199\u5165 papers/library.json \u548C papers/library.md\uFF0C\u4F9B Draft \u5206\u7EC4\u5F15\u7528\u548C\u5BFC\u51FA BibTeX\uFF1B\u53EA\u662F\u8BFB\u9762\u677F\u4E0D\u5199\u6587\u732E\u5E93\u3002

\u4ECE\u672A\u626B\u63CF\u6216\u8DDD\u4E0A\u6B21\u5DF2\u8D85\u8FC7\u4E03\u5929\u65F6\uFF0C\u68C0\u7D22\u8FD1\u671F\u63A5\u6536\u8BBA\u6587\u3001\u7EFC\u8FF0\u548C\u8BA8\u8BBA\uFF0C\u8FD4\u56DE\u5E26\u6765\u6E90\u548C\u9879\u76EE\u5F71\u54CD\u7684\u9886\u57DF\u626B\u63CF\uFF08\u7EA6 2000 \u5B57\u7B26\uFF09\uFF0C\u4E3B\u4F1A\u8BDD\u53E6\u5B58 watch/scan-\u65E5\u671F.md\u3002\u4EE5\u4E0A\u5185\u5BB9\u90FD\u5355\u72EC\u8FD4\u56DE\uFF0C\u4E0D\u6324\u8FDB\u8F6E\u6B21\u8BF4\u660E\u3002`;
}
function renderDoveResearchQualityFullReference() {
  return `# Dove research quality reference

Read the relevant criteria for consequential judgments, not the whole reference each round. Grades describe scoped merit, not stages, permissions or automatic gates. Mentors and reviewers use only their specified materials; guidance is not evidence.

${DOVE_RESEARCH_REFERENCE_BULLETS.map((item) => `- ${item}`).join("\n\n")}
`;
}
var DOVE_RESEARCH_QUALITY_REFERENCE_PATHS = Object.freeze({
  claude: ".dove/install/RESEARCH_QUALITY.md",
  dsh: ".dove/install/RESEARCH_QUALITY.md"
});
var DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS = Object.freeze({
  claude: ".dove/install/RESEARCH_QUALITY_FULL.md",
  dsh: ".dove/install/RESEARCH_QUALITY_FULL.md"
});
var DOVE_RESEARCH_MENTOR_NAME = "dove-mentor";
var DOVE_RESEARCH_REVIEW_AGENT_NAME = "dove-review";
var DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS = "For the complete paper, ask four questions: does the method answer the research question; are the mechanisms, terms, comparisons, literature, counterexamples, and limits correct for the field; do the contribution, evidence, scope, and expression fit the target venue and its readers; and what is the strongest reasonable objection, with the evidence or revision needed to answer it.";
var DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC = "Author-side self-check critiques the current paper with concrete evidence and feasible action; it is not independent review.";
var DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY = "Delivery review checks actual venue rules, build/export output and required materials; delivery readiness is separate from scientific acceptability.";
var DOVE_RESEARCH_REVIEW_DUAL_COMPLETION = "A user-confirmed submission-completion goal needs author-side scientific sufficiency, an actual independent review recommending scientific acceptability of the same complete current version, and real delivery readiness. Unavailable independent review remains a gap; bounded tasks can finish within scope.";
var DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY = "Judge a figure by whether it expresses the manuscript claim correctly, clearly, and attractively in context; inspect the rendered visual, source data or source visuals, rendering logic, caption, nearby text, final dimensions, and manuscript layout when they can change meaning.";
var DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY = "When figure work is useful, plan, create, revise, render, open, inspect, caption, and deliver the actual visual with suitable host tools and editable sources; quantitative plots use real data and reproducible code, diagrams preserve route-native editable structure, generated or edited images use exposed host image tools when appropriate, and mixed raster plus SVG/vector work remains modifiable.";
var DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY = "For manuscript work, preserve the user's current authoritative manuscript format, identify its source and build or export path, and follow actual venue requirements. Only for a new manuscript, default to LaTeX when the venue accepts it; otherwise use the required format. Inspect the actual submission output, including compiled output for LaTeX, keep scholarly evidence distinct from venue-facing materials, and propagate authorized changes through the authoritative source.";
var DOVE_RESEARCH_SHARED_CONTRACT_BULLETS = Object.freeze([
  DOVE_RESEARCH_MAINLINE_ANCHORING,
  DOVE_RESEARCH_ACTION_SPINE,
  DOVE_RESEARCH_DECISION_CONSEQUENCE,
  DOVE_RESEARCH_ROUND_CYCLE,
  DOVE_RESEARCH_ROUND_RECORDS,
  DOVE_RESEARCH_EVALUATION,
  DOVE_RESEARCH_CLARIFICATION,
  DOVE_RESEARCH_EXPERIMENT_ITERATION,
  DOVE_RESEARCH_REVIEW_DUAL_COMPLETION
]);

// src/core/dove-author-preferences-content.generated.mjs
var DOVE_AUTHOR_PREFERENCES_CONTENT = "# \u901A\u7528\u79D1\u7814\u3001\u5DE5\u7A0B\u4E0E\u534F\u4F5C\u504F\u597D\n\n> \u672C\u6587\u6574\u7406\u957F\u671F\u7A33\u5B9A\u3001\u53EF\u8DE8\u9886\u57DF\u590D\u7528\u7684\u79D1\u7814\u3001\u5DE5\u7A0B\u3001\u8BBA\u6587\u5199\u4F5C\u4E0E\u534F\u4F5C\u539F\u5219\u3002\u5185\u5BB9\u4E0D\u4F9D\u8D56\u7279\u5B9A\u9879\u76EE\u3001\u6570\u636E\u96C6\u3001\u6A21\u578B\u6216\u5E73\u53F0\u3002\n>\n> **\u603B\u539F\u5219\uFF1A\u9009\u62E9\u771F\u5B9E\u3001\u91CD\u8981\u4E14\u6709\u6311\u6218\u7684\u95EE\u9898\uFF0C\u6309\u7814\u7A76\u7C7B\u578B\u660E\u786E\u95EE\u9898\u3001\u5047\u8BBE\u3001\u547D\u9898\u6216\u76EE\u6807\uFF0C\u7528\u4E0E\u95EE\u9898\u5339\u914D\u4E14\u8FDE\u8D2F\u7684\u65B9\u6CD5\u89E3\u51B3\uFF1B\u79D1\u7814\u4EE5\u771F\u5B9E\u4EFB\u52A1\u8BC1\u636E\u4E3A\u51C6\uFF0C\u5DE5\u7A0B\u4EE5\u7AEF\u5230\u7AEF\u53EF\u7528\u7ED3\u679C\u4E3A\u51C6\uFF0C\u4EFB\u4F55\u7ED3\u8BBA\u90FD\u4E0D\u5F97\u8D85\u8FC7\u8BC1\u636E\u3002**\n\n## \u9605\u8BFB\u4E0E\u9002\u7528\u89C4\u5219\n\n\u672C\u6587\u4E2D\u7684\u201C\u5E94\u201D\u201C\u5FC5\u987B\u201D\u201C\u7981\u6B62\u201D\u90FD\u53EA\u5728\u76F8\u5E94\u9002\u7528\u6761\u4EF6\u5185\u6210\u7ACB\uFF0C\u4E0D\u80FD\u8131\u79BB\u4EFB\u52A1\u9636\u6BB5\u548C\u4E0A\u4F4D\u76EE\u6807\u673A\u68B0\u6267\u884C\u3002\u53D1\u751F\u51B2\u7A81\u65F6\uFF0C\u4EE5\u660E\u786E\u7684\u7528\u6237\u76EE\u6807\u3001\u5B9E\u9645\u8FD0\u884C\u6761\u4EF6\u3001\u5DF2\u6709\u9879\u76EE\u7EA6\u675F\u548C\u7B2C 1 \u8282\u7684\u539F\u5219\u4E3A\u51C6\uFF0C\u4E0D\u81EA\u884C\u8865\u51FA\u4EFB\u52A1\u6CA1\u6709\u8981\u6C42\u7684\u751F\u4EA7\u7EA7\u76EE\u6807\u3002\n\n\u672C\u6587\u662F\u79D1\u7814\u4E0E\u5DE5\u7A0B\u51B3\u7B56\u504F\u597D\uFF0C\u4E0D\u662F\u9ED8\u8BA4\u7684\u5B89\u5168\u3001\u5408\u89C4\u6216\u5BA1\u8BA1\u5EFA\u8BBE\u6E05\u5355\u3002\u5DF2\u7ECF\u660E\u786E\u9002\u7528\u7684\u9650\u5236\u6309\u5176\u5177\u4F53\u5185\u5BB9\u6267\u884C\uFF1B\u9075\u5B88\u884C\u4E3A\u8FB9\u754C\u4E0D\u7B49\u4E8E\u65B0\u589E\u9632\u62A4\u7CFB\u7EDF\uFF0C\u8BDA\u5B9E\u62A5\u544A\u8BC1\u636E\u4E0D\u7B49\u4E8E\u5EFA\u8BBE\u8BC1\u636E\u8BA4\u8BC1\u7CFB\u7EDF\u3002\u4E0D\u80FD\u4EC5\u51ED\u201C\u5B89\u5168\u201D\u201C\u9690\u79C1\u201D\u201C\u53EF\u9760\u6027\u201D\u6216\u201C\u8BC1\u636E\u5B8C\u6574\u6027\u201D\u7B49\u6982\u5FF5\u6269\u5927\u5B9E\u65BD\u8303\u56F4\u3002\n\n\u6309\u4EFB\u52A1\u7C7B\u578B\u4E0E\u5DE5\u4F5C\u9636\u6BB5\u9009\u7528\u76F8\u5173\u539F\u5219\uFF0C\u4E0D\u628A\u5168\u6587\u5F53\u4F5C\u6BCF\u6B21\u4EFB\u52A1\u7684\u524D\u7F6E\u6E05\u5355\u3002\u5BF9\u5DF2\u786E\u5B9A\u8DEF\u7EBF\u7684\u5B9E\u73B0\u3001\u4FEE\u590D\u6216\u590D\u73B0\u4EFB\u52A1\uFF0C\u76F4\u63A5\u5B8C\u6210\u76F8\u5E94\u80FD\u529B\uFF0C\u4E0D\u81EA\u52A8\u91CD\u65B0\u5F00\u542F\u9009\u9898\u3001\u521B\u65B0\u6027\u8BC4\u4F30\u6216\u5B8C\u6574\u6587\u732E\u6BD4\u8F83\uFF1B\u53EA\u6709\u53D1\u73B0\u8DB3\u4EE5\u5F71\u54CD\u5F53\u524D\u76EE\u6807\u6B63\u786E\u6027\u6216\u53EF\u884C\u6027\u7684\u5177\u4F53\u95EE\u9898\u65F6\uFF0C\u624D\u56DE\u5230\u8DEF\u7EBF\u5C42\u8BA8\u8BBA\u3002\u5FC5\u8981\u7684\u6280\u672F\u67E5\u9605\u4E0D\u53D7\u6B64\u9650\u3002\n\n\u7814\u7A76\u6D3B\u52A8\u4E0E\u4EA4\u4ED8\u9636\u6BB5\u6309\u4EE5\u4E0B\u542B\u4E49\u533A\u5206\uFF1A\n\n- **\u63A2\u7D22\u6216\u8BCA\u65AD\u9636\u6BB5**\uFF1A\u76EE\u6807\u662F\u53D1\u73B0\u6709\u4EF7\u503C\u7684\u73B0\u8C61\u3001\u83B7\u5F97\u4FE1\u606F\u3001\u9A8C\u8BC1\u53EF\u884C\u6027\u6216\u5B9A\u4F4D\u74F6\u9888\uFF1B\u5141\u8BB8\u76F4\u63A5\u4F7F\u7528\u4E34\u65F6\u5B9E\u73B0\u5E76\u533A\u5206\u7528\u9014\uFF0C\u4E0D\u8981\u6C42\u6BCF\u6B21\u8FD0\u884C\u9884\u5148\u7ED1\u5B9A\u4EE3\u7801\u4FEE\u6539\uFF0C\u4E5F\u4E0D\u5F97\u628A\u63A2\u7D22\u7ED3\u679C\u5192\u5145\u786E\u8BA4\u6027\u7ED3\u8BBA\uFF1B\n- **\u786E\u8BA4\u6027\u68C0\u9A8C**\uFF1A\u76EE\u6807\u662F\u68C0\u9A8C\u9884\u5148\u660E\u786E\u7684\u4E3B\u5F20\uFF1B\u6309\u4E3B\u5F20\u786E\u5B9A\u6837\u672C\u53E3\u5F84\u3001\u56FA\u5B9A\u76F8\u5E94\u534F\u8BAE\u5E76\u63A7\u5236\u76F8\u5173\u66FF\u4EE3\u89E3\u91CA\uFF0C\u5141\u8BB8\u4FDD\u6301\u5B9E\u73B0\u4E0D\u53D8\u4EE5\u8865\u9F50\u6240\u9700\u8BC1\u636E\uFF1B\n- **\u4EA4\u4ED8\u6216\u5B9E\u9645\u4F7F\u7528\u9636\u6BB5**\uFF1A\u76EE\u6807\u662F\u8BA9\u7528\u6237\u6216\u4E0B\u6E38\u771F\u6B63\u7528\u4E0A\u7ED3\u679C\uFF1B\u6309\u5DF2\u660E\u786E\u7684\u4F7F\u7528\u8303\u56F4\u6EE1\u8DB3\u63A5\u53E3\u3001\u6027\u80FD\u4E0E\u7EF4\u62A4\u8981\u6C42\uFF0C\u4E0D\u81EA\u52A8\u5347\u7EA7\u4E3A\u6301\u7EED\u5728\u7EBF\u3001\u591A\u79DF\u6237\u6216\u5BF9\u6297\u6027\u73AF\u5883\u4E2D\u7684\u751F\u4EA7\u7CFB\u7EDF\u3002\n\n\u201C\u63A2\u7D22\u6027\u3001\u786E\u8BA4\u6027\u201D\u63CF\u8FF0\u8BC1\u636E\u7684\u5F62\u6210\u65B9\u5F0F\uFF0C\u201C\u4E34\u65F6\u3001\u6B63\u5F0F\u201D\u63CF\u8FF0\u7ED3\u679C\u7684\u7528\u9014\u3002\u63A2\u7D22\u6027\u53D1\u73B0\u4E5F\u53EF\u4EE5\u6210\u4E3A\u6B63\u5F0F\u8BBA\u6587\u5185\u5BB9\u6216\u4EA4\u4ED8\u7ED3\u679C\uFF0C\u53EA\u9700\u5982\u5B9E\u8BF4\u660E\u5176\u5F62\u6210\u8FC7\u7A0B\u4E0E\u652F\u6301\u8303\u56F4\uFF0C\u4E0D\u628A\u4E8B\u540E\u89C2\u5BDF\u5192\u5145\u9884\u5148\u63D0\u51FA\u5047\u8BBE\u540E\u7684\u72EC\u7ACB\u786E\u8BA4\u3002\n\n\u540C\u4E00\u9879\u76EE\u53EF\u4EE5\u5305\u542B\u4E0A\u8FF0\u4E0D\u540C\u6D3B\u52A8\uFF1B\u4E0D\u80FD\u628A\u751F\u4EA7\u7EA7\u57FA\u7840\u8BBE\u65BD\u5F3A\u52A0\u7ED9\u79D1\u7814\u4EE3\u7801\u3001\u5185\u90E8\u5DE5\u5177\u6216\u4E00\u6B21\u6027\u4EA4\u4ED8\uFF0C\u4E5F\u4E0D\u80FD\u7528\u7F3A\u5C11\u5FC5\u8981\u80FD\u529B\u7684\u8BCA\u65AD\u7EA7\u539F\u578B\u66FF\u4EE3\u6B63\u5F0F\u65B9\u6848\u3002\u9700\u8981\u54EA\u4E9B\u8FD0\u884C\u4FDD\u969C\uFF0C\u7531\u5B9E\u9645\u4F7F\u7528\u6761\u4EF6\u51B3\u5B9A\uFF0C\u4E0D\u7531\u201C\u6B63\u5F0F\u201D\u6216\u201C\u4EA4\u4ED8\u201D\u8FD9\u4E24\u4E2A\u8BCD\u81EA\u52A8\u63A8\u51FA\u3002\n\n\u672C\u6587\u4E2D\u7684\u5173\u952E\u672F\u8BED\u6309\u4EE5\u4E0B\u542B\u4E49\u7406\u89E3\uFF1A\n\n- **\u5F53\u524D\u76EE\u6807**\uFF1A\u672C\u6B21\u660E\u786E\u4EA4\u4ED8\u53CA\u5176\u5DF2\u77E5\u7684\u5FC5\u8981\u6B65\u9AA4\uFF0C\u4E0D\u662F\u773C\u524D\u4E0B\u4E00\u6761\u547D\u4EE4\u6216\u6700\u5C0F\u6F14\u793A\uFF1B\n- **\u6700\u7EC8\u76EE\u6807**\uFF1A\u771F\u5B9E\u7814\u7A76\u3001\u4E1A\u52A1\u6216\u7528\u6237\u7ED3\u679C\uFF0C\u4EE5\u53CA\u8981\u652F\u6301\u7684\u6B63\u5F0F\u4E3B\u5F20\uFF1B\n- **\u6700\u5C0F\u5FC5\u8981\u5B9E\u73B0**\uFF1A\u5728\u6700\u7EC8\u76EE\u6807\u3001\u6709\u6548\u89C4\u6A21\u3001\u8BC1\u636E\u8981\u6C42\u548C\u5B9E\u9645\u8D44\u6E90\u8303\u56F4\u5185\u9009\u62E9\u603B\u4F53\u66F4\u4F18\u65B9\u6848\uFF0C\u518D\u5220\u53BB\u5BF9\u76EE\u6807\u6CA1\u6709\u8D21\u732E\u7684\u590D\u6742\u5EA6\uFF1B\u5B83\u4E0D\u662F\u5F00\u53D1\u987A\u5E8F\u6216\u9010\u8F6E\u6700\u5C0F\u8865\u4E01\u7B56\u7565\uFF0C\u4E0D\u7B49\u4E8E\u4EE3\u7801\u6700\u5C11\u3001\u6A21\u578B\u6700\u5C0F\u3001\u7B97\u529B\u6700\u4F4E\u6216\u505C\u5728\u6700\u4F4E\u5408\u683C\u7EBF\uFF0C\u4E5F\u4E0D\u6392\u9664\u6709\u5408\u7406\u9884\u671F\u6536\u76CA\u7684\u6539\u8FDB\uFF1B\n- **\u79D1\u5B66\u5408\u540C**\uFF1A\u5DF2\u7ECF\u660E\u786E\u7684\u8F93\u5165\u3001\u8F93\u51FA\u3001\u6570\u636E\u8FB9\u754C\u3001\u9884\u7B97\u3001\u8BC4\u4EF7\u3001\u5931\u8D25\u8BB0\u8D26\u548C\u5141\u8BB8\u7684\u4FE1\u606F\u6761\u4EF6\uFF0C\u4E5F\u5C31\u662F\u4EFB\u52A1\u4E0E\u5B9E\u9A8C\u7EA6\u5B9A\uFF1B\u5DF2\u6709\u914D\u7F6E\u3001\u4EE3\u7801\u63A5\u53E3\u6216\u76F4\u63A5\u8BF4\u660E\u6E05\u695A\u65F6\u5373\u53EF\uFF0C\u4E0D\u8981\u6C42\u53E6\u5199\u5408\u540C\u3001\u9010\u6B65\u767B\u8BB0\u6216\u5EFA\u8BBE\u901A\u7528 `schema/version`\u3001\u8C31\u7CFB\u4E0E\u8BA4\u8BC1\u4F53\u7CFB\uFF1B\n- **\u6B63\u5F0F\u7ED3\u679C\u6216\u6B63\u5F0F\u4EA7\u7269**\uFF1A\u51C6\u5907\u8FDB\u5165\u9A8C\u6536\u3001\u5BF9\u5916\u4F7F\u7528\u6216\u8BBA\u6587\u7ED3\u8BBA\u7684\u7ED3\u679C\uFF1B\u53EF\u4EE5\u5305\u542B\u7528\u9014\u4E0E\u8BC1\u636E\u8303\u56F4\u660E\u786E\u7684\u63A2\u7D22\u6027\u53D1\u73B0\uFF0C\u4E0D\u56E0\u201C\u6B63\u5F0F\u201D\u4E8C\u5B57\u5C31\u53D8\u6210\u786E\u8BA4\u6027\u7ED3\u8BBA\uFF1B\n- **\u771F\u5B9E\u4EFB\u52A1\u8BC1\u636E**\uFF1A\u4E0E\u4E3B\u5F20\u7C7B\u578B\u76F4\u63A5\u5BF9\u5E94\u7684\u8BC1\u636E\u3002\u7406\u8BBA\u7814\u7A76\u53EF\u4EE5\u662F\u5F62\u5F0F\u8BC1\u660E\u3001\u53EF\u68C0\u9A8C\u63A8\u8BBA\u6216\u53CD\u4F8B\uFF1B\u7ECF\u9A8C\u7814\u7A76\u53EF\u4EE5\u662F\u4E0E\u95EE\u9898\u5339\u914D\u7684\u89C2\u5BDF\u3001\u6D4B\u91CF\u6216\u5B9E\u9A8C\u7ED3\u679C\uFF0C\u662F\u5426\u9700\u8981\u51BB\u7ED3\u534F\u8BAE\u4E0E\u72EC\u7ACB\u786E\u8BA4\u53D6\u51B3\u4E8E\u4E3B\u5F20\u548C\u8BC4\u4EF7\u7528\u9014\uFF1B\u5DE5\u7A0B\u7814\u7A76\u53EF\u4EE5\u662F\u7AEF\u5230\u7AEF\u4F7F\u7528\u7ED3\u679C\u3002\u5B83\u4E0D\u7B49\u4E8E\u6240\u6709\u7814\u7A76\u90FD\u5FC5\u987B\u6709\u4EA7\u54C1\u90E8\u7F72\u6216\u540C\u4E00\u79CD\u6307\u6807\u3002\n\n\u201C\u6700\u4F4E\u6709\u6548\u89C4\u6A21\u201D\u201C\u663E\u8457\u589E\u52A0\u201D\u201C\u5F3A\u57FA\u7EBF\u201D\u201C\u5408\u7406\u603B\u65F6\u95F4\u201D\u201C\u751F\u4EA7\u5C31\u7EEA\u201D\u7B49\u6CA1\u6709\u8DE8\u9879\u76EE\u7EDF\u4E00\u6570\u503C\u3002\u5177\u4F53\u9879\u76EE\u5E94\u7ED3\u5408\u9884\u7B97\u3001\u98CE\u9669\u3001\u9886\u57DF\u60EF\u4F8B\u548C\u6B63\u5F0F\u4E3B\u5F20\u7ED9\u51FA\u53EF\u64CD\u4F5C\u5B9A\u4E49\uFF1B\u5728\u5C1A\u672A\u5B9A\u4E49\u65F6\uFF0C\u4E0D\u5F97\u628A\u8FD9\u4E9B\u8BCD\u5F53\u4F5C\u4EFB\u610F\u6269\u5F20\u6216\u4EFB\u610F\u5220\u51CF\u7684\u7406\u7531\u3002\n\n# \u4E00\u3001\u603B\u4F53\u51B3\u7B56\u539F\u5219\n\n## 1. \u4EE5\u771F\u5B9E\u7ED3\u679C\u548C\u957F\u671F\u4EF7\u503C\u4E3A\u6700\u9AD8\u6807\u51C6\n\n\u5F53\u591A\u4E2A\u76EE\u6807\u53D1\u751F\u51B2\u7A81\u65F6\uFF0C\u9ED8\u8BA4\u6309\u4EE5\u4E0B\u987A\u5E8F\u5224\u65AD\uFF1A\n\n1. **\u4E8B\u5B9E\u4E0E\u7ED3\u8BBA\u771F\u5B9E**\uFF1A\u4E0D\u4F2A\u9020\u7ED3\u679C\u3001\u4E0D\u63A9\u76D6\u5931\u8D25\u3001\u4E0D\u628A\u672A\u9A8C\u8BC1\u5199\u6210\u5DF2\u5B8C\u6210\uFF0C\u4E5F\u4E0D\u901A\u8FC7\u9009\u62E9\u6027\u6C47\u62A5\u6216\u6D4B\u8BD5\u6570\u636E\u6CC4\u6F0F\u5236\u9020\u6210\u529F\u3002\n2. **\u771F\u5B9E\u4EFB\u52A1\u7ED3\u679C\u4E0E\u957F\u671F\u4EF7\u503C**\uFF1A\u4F18\u5148\u89E3\u51B3\u6700\u7EC8\u95EE\u9898\uFF0C\u800C\u4E0D\u662F\u7F8E\u5316\u5C40\u90E8\u6307\u6807\u3001\u5FEB\u901F\u751F\u6210\u6F14\u793A\u6216\u7EF4\u6301\u8868\u9762\u8FDB\u5EA6\u3002\n3. **\u79D1\u7814\u4EF7\u503C\u4E0E\u67B6\u6784\u6B63\u786E\u6027**\uFF1A\u4F18\u5148\u6839\u672C\u673A\u5236\u3001\u5171\u4EAB\u6839\u56E0\u548C\u7A33\u5B9A\u8D23\u4EFB\u8FB9\u754C\uFF0C\u800C\u4E0D\u662F\u5F53\u524D\u5B9E\u73B0\u662F\u5426\u65B9\u4FBF\u3002\n4. **\u65B9\u6CD5\u7B80\u6D01\u6027\u4E0E\u7CFB\u7EDF\u53EF\u7EF4\u62A4\u6027**\uFF1A\u4F18\u5148\u8FDE\u8D2F\u4E14\u6709\u8D21\u732E\u4F9D\u636E\u7684\u673A\u5236\u3001\u6E05\u695A\u5408\u540C\u548C\u53EF\u6301\u7EED\u7EF4\u62A4\uFF0C\u800C\u4E0D\u662F\u65E0\u4F9D\u636E\u5730\u5806\u53E0\u6A21\u5757\u3001\u89C4\u5219\u548C\u517C\u5BB9\u5C42\u3002\n5. **\u8D44\u6E90\u5229\u7528\u4E0E\u6267\u884C\u6548\u7387**\uFF1A\u76EE\u6807\u548C\u7EA6\u675F\u660E\u786E\u540E\uFF0C\u6309\u771F\u5B9E\u53EF\u7528\u8D44\u6E90\u9009\u62E9\u6700\u9AD8\u6548\u3001\u6700\u5408\u9002\u7684\u5B9E\u73B0\uFF0C\u4E0D\u4E3B\u52A8\u964D\u914D\uFF0C\u4E5F\u4E0D\u4E3A\u4E0D\u5B58\u5728\u7684\u9700\u6C42\u7EF4\u62A4\u4F4E\u6548\u8DEF\u5F84\u3002\n6. **\u5C55\u793A\u4E0E\u5305\u88C5**\uFF1A\u53EA\u8D1F\u8D23\u51C6\u786E\u5448\u73B0\u7ED3\u679C\uFF0C\u4E0D\u80FD\u53CD\u8FC7\u6765\u51B3\u5B9A\u95EE\u9898\u3001\u65B9\u6CD5\u6216\u7ED3\u8BBA\u3002\n\n\u79D1\u7814\u8DEF\u7EBF\u9996\u5148\u7531\u95EE\u9898\u4EF7\u503C\u548C\u6700\u7EC8\u76EE\u6807\u51B3\u5B9A\uFF1B\u8DEF\u7EBF\u786E\u5B9A\u540E\uFF0C\u5B9E\u73B0\u5E94\u5145\u5206\u5229\u7528\u771F\u5B9E\u53EF\u7528\u8D44\u6E90\uFF0C\u800C\u4E0D\u662F\u56F4\u7ED5\u6700\u4F4E\u914D\u7F6E\u6216\u8868\u9762\u901A\u7528\u6027\u8BBE\u8BA1\u3002\u4E8B\u5B9E\u4E0E\u7ED3\u8BBA\u771F\u5B9E\u9650\u5236\u7684\u662F\u5B9E\u9645\u884C\u4E3A\u548C\u53EF\u58F0\u79F0\u7684\u7ED3\u679C\uFF0C\u4E0D\u8981\u6C42\u96F6\u98CE\u9669\u3001\u5168\u94FE\u8DEF\u8BA4\u8BC1\u6216\u5148\u6392\u9664\u6240\u6709\u4E0D\u786E\u5B9A\u6027\u624D\u5141\u8BB8\u5F00\u5C55\u5B9E\u9A8C\uFF1B\u51C6\u786E\u8BF4\u51FA\u201C\u5C1A\u672A\u5B9E\u73B0\u6216\u9A8C\u8BC1\u201D\u4E0D\u7B49\u4E8E\u5B8C\u6210\u4ECD\u53EF\u5B9E\u65BD\u3001\u5DF2\u83B7\u51C6\u7684\u5B9E\u73B0\u6216\u4FEE\u590D\u3002\u63A2\u7D22\u53EF\u4EE5\u5E26\u7740\u4E0D\u786E\u5B9A\u6027\u63A8\u8FDB\uFF0C\u53EA\u8981\u4E0D\u628A\u731C\u6D4B\u5199\u6210\u5DF2\u7ECF\u9A8C\u8BC1\u7684\u4E8B\u5B9E\u3002\n\n\u5176\u4F59\u6761\u76EE\u6309\u5BF9\u6700\u7EC8\u7ED3\u679C\u7684\u5B9E\u9645\u5F71\u54CD\u7EFC\u5408\u5224\u65AD\uFF0C\u4E0D\u673A\u68B0\u9010\u9879\u538B\u5236\u3002\u82E5\u6267\u884C\u6548\u7387\u51B3\u5B9A\u6B63\u5F0F\u5B9E\u9A8C\u80FD\u5426\u5B8C\u6210\uFF0C\u6548\u7387\u5C31\u662F\u4EFB\u52A1\u7ED3\u679C\u7684\u4E00\u90E8\u5206\uFF0C\u800C\u4E0D\u53EA\u662F\u7B2C 5 \u4F4D\u7684\u5C40\u90E8\u4F18\u5316\u3002\u201C\u957F\u671F\u4EF7\u503C\u201D\u53EA\u8986\u76D6\u5DF2\u77E5\u7814\u7A76\u8BA1\u5212\u3001\u4EA4\u4ED8\u5468\u671F\u548C\u53EF\u9884\u89C1\u7EF4\u62A4\u8303\u56F4\uFF0C\u4E0D\u4EE5\u60F3\u8C61\u4E2D\u7684\u672A\u6765\u9700\u6C42\u4E3A\u7406\u7531\u63D0\u524D\u5EFA\u8BBE\uFF1B\u201C\u67B6\u6784\u6B63\u786E\u6027\u201D\u53EA\u6307\u652F\u6491\u8FD9\u4E9B\u76EE\u6807\u6240\u9700\u7684\u8D23\u4EFB\u8FB9\u754C\u548C\u6570\u636E\u5408\u540C\uFF0C\u4E0D\u7B49\u4E8E\u8FFD\u6C42\u7406\u60F3\u5316\u91CD\u6784\u3002\n\n## 2. \u6309\u5DE5\u4F5C\u4EF7\u503C\u4E0E\u5FC5\u8981\u6027\u53D6\u820D\uFF0C\u4E0D\u7528\u65F6\u95F4\u8BDD\u672F\u56DE\u907F\u6838\u5FC3\u4EFB\u52A1\n\n\u4E00\u9879\u5DE5\u4F5C\u53EF\u4EE5\u540C\u65F6\u5177\u6709\u591A\u79CD\u5C5E\u6027\uFF0C\u6309\u5176\u5B9E\u9645\u4F5C\u7528\u5224\u65AD\uFF0C\u4E0D\u8981\u6C42\u4E3A\u666E\u901A\u6B65\u9AA4\u9010\u9879\u586B\u5199\u5206\u7C7B\u8BF4\u660E\uFF1A\n\n- **\u5FC5\u8981\u5DE5\u4F5C**\uFF1A\u7F3A\u5931\u540E\u65E0\u6CD5\u652F\u6491\u6700\u7EC8\u76EE\u6807\u3001\u6838\u5FC3\u80FD\u529B\u3001\u6B63\u5F0F\u5B9E\u9A8C\u6216\u8BBA\u6587\u4E3B\u5F20\uFF1B\n- **\u6709\u4EF7\u503C\u7684\u6539\u8FDB**\uFF1A\u6709\u5408\u7406\u4F9D\u636E\u9884\u671F\u4F1A\u6539\u5584\u672C\u6B21\u5DF2\u660E\u786E\u7684\u8D28\u91CF\u3001\u80FD\u529B\u6216\u6548\u7387\u76EE\u6807\uFF0C\u4E14\u6536\u76CA\u503C\u5F97\u5176\u6210\u672C\uFF0C\u4E0D\u5FC5\u8BC1\u660E\u201C\u4E0D\u505A\u5C31\u65E0\u6CD5\u5B8C\u6210\u201D\uFF1B\n- **\u63A2\u7D22\u4E0E\u8BCA\u65AD\u5DE5\u4F5C**\uFF1A\u7528\u4E8E\u83B7\u5F97\u6709\u4EF7\u503C\u7684\u65B0\u89C2\u5BDF\u3001\u5224\u65AD\u5047\u8BBE\u3001\u5B9A\u4F4D\u74F6\u9888\u6216\u51B3\u5B9A\u8DEF\u7EBF\u53BB\u7559\uFF1B\n- **\u5FC5\u8981\u5B9E\u9A8C\u652F\u6491**\uFF1A\u5F53\u524D\u5B9E\u9A8C\u786E\u5B9E\u9700\u8981\u7684\u6570\u636E\u5212\u5206\u3001\u914D\u7F6E\u3001\u7ED3\u679C\u8BB0\u5F55\u548C\u8FD0\u884C\u652F\u6301\uFF1B\u73B0\u6709\u5DE5\u5177\u6216\u5C11\u91CF\u76F4\u63A5\u5B9E\u73B0\u8DB3\u591F\u65F6\uFF0C\u4E0D\u518D\u5EFA\u8BBE\u901A\u7528\u57FA\u7840\u8BBE\u65BD\uFF1B\n- **\u6700\u7EC8\u8BC1\u636E**\uFF1A\u53EF\u4EE5\u76F4\u63A5\u8FDB\u5165\u4E1A\u52A1\u9A8C\u6536\u3001\u8BBA\u6587\u4E3B\u8868\u3001\u4E3B\u56FE\u6216\u6838\u5FC3\u7ED3\u8BBA\uFF1B\n- **\u65E0\u4F9D\u636E\u7684\u989D\u5916\u5DE5\u4F5C**\uFF1A\u5BF9\u5F53\u524D\u76EE\u6807\u6CA1\u6709\u53EF\u8BF4\u660E\u7684\u8D21\u732E\uFF0C\u6216\u9884\u671F\u6536\u76CA\u4E0D\u8DB3\u4EE5\u62B5\u507F\u65B0\u589E\u8D1F\u62C5\u3002\n\n\u589E\u52A0\u5DE5\u4F5C\u6216\u673A\u5236\uFF0C\u5E94\u6709\u4EE5\u4E0B\u81F3\u5C11\u4E00\u9879\u5177\u4F53\u4F9D\u636E\uFF0C\u4E14\u5B9E\u65BD\u8303\u56F4\u4E0E\u8BE5\u4F9D\u636E\u76F4\u63A5\u5BF9\u5E94\uFF1A\n\n1. \u7528\u6237\u660E\u786E\u8981\u6C42\uFF1B\n2. \u7F3A\u5C11\u5B83\u4F1A\u76F4\u63A5\u5BFC\u81F4\u76EE\u6807\u7ED3\u679C\u9519\u8BEF\uFF1B\n3. \u7F3A\u5C11\u5B83\u4F1A\u8FDD\u53CD\u5DF2\u7ECF\u660E\u786E\u4E14\u9002\u7528\u4E8E\u672C\u6B21\u4EFB\u52A1\u7684\u79D1\u5B66\u5408\u540C\u3001\u4EA4\u4ED8\u6807\u51C6\u6216\u5177\u4F53\u8FD0\u884C\u8981\u6C42\uFF1B\n4. \u7F3A\u5C11\u5B83\u4F1A\u4F7F\u6B63\u5F0F\u7A0B\u5E8F\u3001\u5B9E\u9A8C\u77E9\u9635\u6216\u4EA4\u4ED8\u65E0\u6CD5\u5B8C\u6210\uFF1B\n5. \u7F3A\u5C11\u5B83\u4F1A\u4F7F\u6A21\u578B\u3001\u6570\u636E\u3001\u8BA1\u7B97\u6216\u7CFB\u7EDF\u4F4E\u4E8E\u68C0\u9A8C\u5F53\u524D\u5047\u8BBE\u6216\u5B9E\u73B0\u76EE\u6807\u80FD\u529B\u6240\u9700\u7684\u6709\u6548\u89C4\u6A21\uFF1B\n6. \u7F3A\u5C11\u5B83\u4F1A\u663E\u8457\u589E\u52A0\u83B7\u5F97\u51B3\u5B9A\u6027\u8BC1\u636E\u6216\u5B8C\u6210\u4EA4\u4ED8\u7684\u603B\u65F6\u95F4\u3001\u603B\u8D44\u6E90\u6210\u672C\uFF0C\u5305\u62EC\u5DF2\u77E5\u8FD0\u884C\u6761\u4EF6\u4E0B\u53EF\u5408\u7406\u9884\u8BA1\u7684\u4E2D\u65AD\u4E0E\u91CD\u8DD1\u6210\u672C\uFF0C\u4E14\u589E\u52A0\u5B83\u7684\u6536\u76CA\u8DB3\u4EE5\u62B5\u507F\u5B9E\u73B0\u3001\u8FD0\u884C\u548C\u7EF4\u62A4\u8D1F\u62C5\uFF1B\n7. \u6709\u5177\u4F53\u7406\u7531\u9884\u671F\u5B83\u80FD\u76F4\u63A5\u6539\u5584\u672C\u6B21\u5DF2\u660E\u786E\u7684\u8D28\u91CF\u3001\u80FD\u529B\u3001\u6548\u7387\u6216\u79D1\u7814\u8BA4\u8BC6\u76EE\u6807\uFF0C\u4E14\u5728\u5F53\u524D\u9884\u7B97\u5185\uFF0C\u9884\u671F\u6536\u76CA\u503C\u5F97\u5B9E\u73B0\u3001\u8FD0\u884C\u548C\u7EF4\u62A4\u6210\u672C\u3002\n\n\u524D\u51E0\u9879\u4E3B\u8981\u5224\u65AD\u4E0D\u53EF\u7F3A\u5C11\u7684\u5DE5\u4F5C\uFF0C\u7B2C 7 \u9879\u5141\u8BB8\u503C\u5F97\u5B9E\u65BD\u7684\u6539\u8FDB\u4E0E\u63A2\u7D22\uFF1B\u4E0D\u80FD\u628A\u201C\u4E0D\u505A\u4E5F\u80FD\u4EA4\u4ED8\u201D\u5F53\u6210\u5220\u9664\u6709\u6548\u6539\u8FDB\u7684\u5145\u5206\u7406\u7531\u3002\u56FA\u5B9A\u4EA4\u4ED8\u76EE\u6807\u5DF2\u7ECF\u6EE1\u8DB3\u65F6\uFF0C\u4E0D\u4E3A\u76EE\u6807\u4E4B\u5916\u7684\u6F5C\u5728\u63D0\u5347\u65E0\u9650\u8C03\u4F18\uFF1B\u4EFB\u52A1\u672C\u6765\u8981\u6C42\u5728\u7ED9\u5B9A\u9884\u7B97\u5185\u4F18\u5316\u6548\u679C\u65F6\uFF0C\u4E5F\u4E0D\u80FD\u628A\u6700\u4F4E\u5408\u683C\u6807\u51C6\u5F53\u4F5C\u505C\u6B62\u6539\u8FDB\u7684\u7406\u7531\u3002\n\n\u201C\u660E\u786E\u8981\u6C42\u201D\u6765\u81EA\u7528\u6237\u8BF4\u660E\u3001\u73B0\u6709\u9879\u76EE\u5408\u540C\u6216\u5B9E\u9645\u8FD0\u884C\u6761\u4EF6\uFF0C\u4E0D\u5305\u62EC\u6839\u636E\u4E00\u822C\u6700\u4F73\u5B9E\u8DF5\u81EA\u884C\u63A8\u5BFC\u7684\u4F01\u4E1A\u7EA7\u4E49\u52A1\u3002\u201C\u53EF\u80FD\u4EE5\u540E\u6709\u7528\u201D\u201C\u66F4\u52A0\u7A33\u5065\u201D\u201C\u4FBF\u4E8E\u5BA1\u8BA1\u201D\u201C\u9632\u6B62\u7406\u8BBA\u4E0A\u7684\u8BEF\u7528\u201D\u672C\u8EAB\u4E0D\u6784\u6210\u5B9E\u65BD\u4F9D\u636E\u3002\u73B0\u6709\u5DE5\u5177\u3001\u6743\u9650\u6216\u6D41\u7A0B\u5DF2\u7ECF\u6EE1\u8DB3\u7684\u8981\u6C42\uFF0C\u4E0D\u91CD\u590D\u5EFA\u8BBE\u3002\u79D1\u7814\u5019\u9009\u673A\u5236\u53EF\u4EE5\u56E0\u5176\u4FE1\u606F\u4EF7\u503C\u800C\u5B9E\u73B0\uFF0C\u4E0D\u8981\u6C42\u5728\u63A2\u7D22\u524D\u8BC1\u660E\u5B83\u4F1A\u8FDB\u5165\u6700\u7EC8\u65B9\u6CD5\uFF1B\u63A2\u7D22\u3001\u8BCA\u65AD\u4E0E\u6838\u5FC3\u5B9E\u73B0\u7684\u8854\u63A5\u6309\u7B2C 11\u300116 \u8282\u5224\u65AD\u3002\n\n\u53EF\u4EE5\u5206\u9636\u6BB5\u9A8C\u8BC1\uFF0C\u4F46\u4E0D\u80FD\u7528\u201C\u5148\u505A\u4E00\u4E2A\u7B80\u5355\u7248\u672C\uFF0C\u4EE5\u540E\u518D\u505A\u771F\u6B63\u7248\u672C\u201D\u6084\u6084\u5220\u9664\u6700\u7EC8\u5FC5\u8981\u80FD\u529B\u3002\u7F29\u5C0F\u5B9E\u9A8C\u7684\u7ED3\u8BBA\u8303\u56F4\u5E94\u4E0E\u5B83\u5B9E\u9645\u4FDD\u7559\u7684\u673A\u5236\u548C\u6761\u4EF6\u5BF9\u5E94\uFF1B\u89C4\u6A21\u4E0E\u8D1F\u7ED3\u679C\u7684\u89E3\u91CA\u6309\u7B2C 13 \u8282\u5224\u65AD\u3002\n\n## 3. \u5145\u5206\u5229\u7528\u7B26\u5408\u8981\u6C42\u7684\u73B0\u6709\u8D44\u6E90\n\n\u8D44\u6E90\u5305\u62EC\u7B97\u529B\u3001\u786C\u4EF6\u3001\u663E\u5B58\u3001\u5B58\u50A8\u548C\u5E76\u884C\u80FD\u529B\uFF0C\u4E5F\u5305\u62EC\u5DF2\u6709\u4EE3\u7801\u3001\u6A21\u578B\u3001\u6570\u636E\u3001\u5DE5\u5177\u3001\u5E73\u53F0\u3001\u53EF\u9760\u7814\u7A76\u7ED3\u8BBA\u3001\u56E2\u961F\u7ECF\u9A8C\u548C\u65E2\u6709\u4EA7\u7269\u3002\u76EE\u6807\u4E0E\u7EA6\u675F\u660E\u786E\u540E\uFF0C\u5E94\u6309\u5B9E\u9645\u8D44\u6E90\u6761\u4EF6\u9009\u62E9\u6700\u9AD8\u6548\u3001\u6700\u9002\u5408\u7684\u5B9E\u73B0\uFF0C\u4E0D\u4E3B\u52A8\u964D\u914D\uFF0C\u4E5F\u4E0D\u4E3A\u4E86\u6CA1\u6709\u771F\u5B9E\u9700\u6C42\u7684\u517C\u5BB9\u6027\u7EF4\u62A4\u4F4E\u6548\u8DEF\u5F84\u3002\n\n\u4F8B\u5982\uFF0C\u5B9E\u9A8C\u7684\u8BA1\u7B97\u4E3B\u8DEF\u5F84\u9700\u8981 `GPU`\uFF08\u56FE\u5F62\u5904\u7406\u5668\uFF09\uFF0C\u5F53\u524D\u5177\u5907 GPU\uFF0C\u4E14\u771F\u5B9E\u90E8\u7F72\u6CA1\u6709 CPU \u8FD0\u884C\u8981\u6C42\u65F6\uFF0C\u5E94\u56F4\u7ED5 GPU \u5B9E\u73B0\u548C\u4F18\u5316\uFF0C\u800C\u4E0D\u662F\u4E3A\u4E86\u8868\u9762\u901A\u7528\u6027\u7EF4\u62A4\u4E00\u5957\u5B8C\u6574\u7684 CPU \u8BAD\u7EC3\u6216\u63A8\u7406\u5B9E\u73B0\u3002\u8F7B\u91CF\u7684 CPU \u9884\u5904\u7406\u3001\u5355\u5143\u6D4B\u8BD5\u3001\u8C03\u8BD5\u6216\u6570\u636E\u68C0\u67E5\u4ECD\u53EF\u5B58\u5728\uFF0C\u53EA\u8981\u5B83\u4EEC\u4E0D\u662F\u6C38\u4E45\u7684\u7B2C\u4E8C\u5957\u6838\u5FC3\u5B9E\u73B0\u3002\n\n\u5DF2\u6709\u4EE3\u7801\u3001\u6570\u636E\u3001\u6A21\u578B\u3001\u5DE5\u5177\u6216\u7ED3\u8BBA\u7B26\u5408\u5F53\u524D\u529F\u80FD\u548C\u5B9E\u9A8C\u6761\u4EF6\u65F6\uFF0C\u5E94\u4F18\u5148\u590D\u7528\uFF1B\u5DF2\u660E\u786E\u7684\u8BB8\u53EF\u6216\u6570\u636E\u4F7F\u7528\u9650\u5236\u6309\u5B9E\u9645\u4F7F\u7528\u65B9\u5F0F\u5904\u7406\uFF0C\u4E0D\u628A\u590D\u7528\u4E00\u5F8B\u524D\u7F6E\u4E3A\u5B8C\u6574\u7684\u5B89\u5168\u3001\u5408\u89C4\u6216\u4F9B\u5E94\u94FE\u5BA1\u8BA1\u3002\u4E5F\u4E0D\u80FD\u53EA\u56E0\u201C\u5DF2\u6709\u201D\u5C31\u5F3A\u884C\u4F7F\u7528\uFF1A\u5E94\u6BD4\u8F83\u9002\u914D\u6210\u672C\u3001\u5B9E\u9A8C\u541E\u5410\u3001\u540E\u7EED\u7EF4\u62A4\u548C\u8BC1\u636E\u8D28\u91CF\u3002\u5F53\u6539\u9020\u65E2\u6709\u65B9\u6848\u7684\u603B\u6210\u672C\u660E\u663E\u9AD8\u4E8E\u91CD\u65B0\u5B9E\u73B0\u65F6\uFF0C\u4ECE\u96F6\u642D\u5EFA\u4E5F\u53EF\u4EE5\u662F\u66F4\u4F18\u9009\u62E9\u3002\n\n\u5145\u5206\u5229\u7528\u8D44\u6E90\u662F\u4E00\u6761\u6267\u884C\u539F\u5219\u3002\u5B83\u4E0D\u80FD\u8BA9\u73B0\u6210\u8D44\u6E90\u53CD\u8FC7\u6765\u5B9A\u4E49\u79D1\u7814\u95EE\u9898\uFF0C\u4E5F\u4E0D\u80FD\u4EE5\u6548\u7387\u4E3A\u7406\u7531\u727A\u7272\u6280\u672F\u6B63\u786E\u6027\u3001\u8BC1\u636E\u8D28\u91CF\u6216\u771F\u5B9E\u90E8\u7F72\u8981\u6C42\u3002\u6548\u7387\u5224\u65AD\u5E94\u770B\u5B8C\u6574\u7814\u7A76\u6216\u4EA4\u4ED8\u5468\u671F\uFF0C\u800C\u4E0D\u662F\u53EA\u6BD4\u8F83\u5F53\u524D\u4EE3\u7801\u884C\u6570\u6216\u5355\u6B21\u8FD0\u884C\u6210\u672C\u3002\n\n## 4. \u4E0D\u53D7\u6C89\u6CA1\u6210\u672C\u7ED1\u67B6\n\n\u5386\u53F2\u5B9E\u73B0\u3001\u5DF2\u8DD1\u5B9E\u9A8C\u548C\u5DF2\u6709\u4EE3\u7801\u7684\u4EF7\u503C\uFF0C\u662F\u5E2E\u52A9\u7406\u89E3\u95EE\u9898\u548C\u66B4\u9732\u969C\u788D\uFF0C\u4E0D\u662F\u8981\u6C42\u6240\u6709\u505A\u8FC7\u7684\u5185\u5BB9\u90FD\u8FDB\u5165\u6700\u7EC8\u7CFB\u7EDF\u6216\u8BBA\u6587\u3002\n\n\u8DEF\u7EBF\u7684\u79D1\u5B66\u4EF7\u503C\u4E0E\u5F53\u524D\u662F\u5426\u503C\u5F97\u7EE7\u7EED\u6295\u5165\u5E94\u5206\u5F00\u5224\u65AD\u3002\u53EF\u4EE5\u6839\u636E\u73B0\u6709\u8BC1\u636E\u3001\u8D44\u6E90\u3001\u65F6\u95F4\u548C\u66FF\u4EE3\u65B9\u6848\u7684\u9884\u671F\u6536\u76CA\u6682\u505C\u6216\u66F4\u6362\u65B9\u6CD5\u5019\u9009\uFF0C\u4E0D\u5FC5\u5148\u8BC1\u660E\u5B83\u539F\u5219\u4E0A\u4E0D\u6210\u7ACB\uFF1B\u8FD9\u79CD\u53D6\u820D\u4E0D\u7B49\u4E8E\u5426\u5B9A\u79D1\u5B66\u5047\u8BBE\uFF0C\u66F4\u4E0D\u7B49\u4E8E\u7528\u6237\u786E\u8BA4\u7684\u6574\u4F53\u76EE\u6807\u5DF2\u65E0\u8DEF\u53EF\u8D70\u3002\u5019\u9009\u5931\u8D25\u3001\u5C40\u90E8\u4F9D\u8D56\u53D7\u963B\u3001\u4E00\u6B21\u6267\u884C\u53D7\u9650\u6216\u5BBF\u4E3B\u65E0\u6CD5\u7EED\u63A5\u65F6\uFF0C\u5148\u6BD4\u8F83\u8303\u56F4\u5185\u7684\u6838\u5FC3\u5B9E\u73B0\u3001\u8BC4\u4EF7\u4FEE\u590D\u3001\u4E25\u8083\u66FF\u4EE3\u548C\u8FA8\u522B\u6027\u8BC1\u636E\uFF1B\u53EA\u505C\u6B62\u4F9D\u8D56\u5931\u6548\u524D\u63D0\u7684\u6295\u5165\u3002\u4E0D\u80FD\u53EA\u56E0\u5B9E\u73B0\u56F0\u96BE\u5C31\u8BA4\u5B9A\u8DEF\u7EBF\u4F4E\u4EF7\u503C\uFF0C\u4E5F\u4E0D\u80FD\u4EE5\u9AD8\u4EF7\u503C\u4E3A\u7531\u5FFD\u7565\u6301\u7EED\u6295\u5165\u7684\u5B9E\u9645\u4EE3\u4EF7\u3002\n\n\u5F53\u4E00\u6761\u8DEF\u7EBF\u5DF2\u7ECF\u5B8C\u6210\u5F53\u524D\u8BCA\u65AD\u4F7F\u547D\uFF0C\u6216\u73B0\u6709\u8BC1\u636E\u4E0D\u518D\u652F\u6301\u7EE7\u7EED\u6295\u5165\u65F6\uFF0C\u505C\u6B62\u65E0\u589E\u91CF\u5DE5\u4F5C\uFF0C\u5E76\u6309\u5F53\u524D\u7528\u9014\u6E05\u7406\u65E0\u7528\u7684\u6D3B\u52A8\u5165\u53E3\u3002\u662F\u5426\u7EE7\u7EED\u6295\u5165\u3001\u662F\u5426\u4FDD\u7559\u6D3B\u52A8\u4EE3\u7801\uFF0C\u4EE5\u53CA\u7ED3\u679C\u662F\u5426\u8FDB\u5165\u8BBA\u6587\uFF0C\u5E94\u5206\u522B\u5224\u65AD\uFF1B\u6709\u6548\u8D1F\u7ED3\u679C\u3001\u53CD\u4F8B\u548C\u5931\u8D25\u8FB9\u754C\u53EF\u4EE5\u6784\u6210\u6838\u5FC3\u7ED3\u8BBA\uFF0C\u4E0D\u56E0\u539F\u8DEF\u7EBF\u672A\u6210\u529F\u5C31\u81EA\u52A8\u4ECE\u8BBA\u6587\u4E2D\u79FB\u9664\u3002\n\n\u4ECD\u6709\u590D\u73B0\u6216\u5206\u6790\u4EF7\u503C\u7684\u7814\u7A76\u8BB0\u5F55\u53EF\u4EE5\u4FDD\u7559\uFF1B\u672C\u6B21\u751F\u6210\u4E14\u4E0D\u518D\u9700\u8981\u7684\u53EF\u91CD\u5EFA\u4E34\u65F6\u4EA7\u7269\uFF0C\u53EF\u5728\u4EFB\u52A1\u8303\u56F4\u5185\u76F4\u63A5\u6E05\u7406\uFF0C\u4E0D\u9ED8\u8BA4\u589E\u52A0\u5907\u4EFD\u4E0E\u5BA1\u6279\u6D41\u7A0B\u3002\u539F\u59CB\u6570\u636E\u3001\u552F\u4E00\u5B9E\u9A8C\u7ED3\u679C\u548C\u7528\u6237\u5DE5\u4F5C\u6587\u4EF6\u4E0D\u80FD\u6309\u4E34\u65F6\u4EA7\u7269\u5904\u7406\uFF1B\u8D85\u51FA\u6388\u6743\u7684\u4E0D\u53EF\u9006\u5220\u9664\u5148\u786E\u8BA4\u3002\u4E0D\u80FD\u56E0\u4E3A\u6295\u5165\u8F83\u591A\uFF0C\u5C31\u7EE7\u7EED\u7ED9\u5F31\u673A\u5236\u589E\u52A0\u8865\u4E01\u3001\u628A\u5931\u8D25\u7ED3\u679C\u6539\u53E3\u5F84\u5305\u88C5\u6210\u6210\u529F\uFF0C\u6216\u628A\u5DE5\u7A0B\u5386\u53F2\u5305\u88C5\u6210\u65B9\u6CD5\u8D21\u732E\u3002\n\n## 5. \u5B8C\u6210\u6807\u51C6\u843D\u5230\u672C\u6B21\u76EE\u6807\uFF0C\u4E0D\u64C5\u81EA\u6269\u5927\u9A8C\u6536\u8303\u56F4\n\n\u5B8C\u6210\u6807\u51C6\u7531\u672C\u6B21\u7528\u6237\u8BF7\u6C42\u3001\u5DF2\u660E\u786E\u7684\u4EA4\u4ED8\u8303\u56F4\u4E0E\u8981\u652F\u6301\u7684\u4E3B\u5F20\u51B3\u5B9A\u3002\u5C40\u90E8\u51FD\u6570\u53EF\u8FD0\u884C\u3001\u5355\u5143\u6D4B\u8BD5\u901A\u8FC7\u3001\u6A21\u578B\u80FD\u591F\u8BAD\u7EC3\u3001\u65E5\u5FD7\u6210\u529F\u751F\u6210\u6216\u4EA7\u7269\u53EF\u4EE5\u5BFC\u51FA\uFF0C\u90FD\u4E0D\u80FD\u81EA\u52A8\u8BC1\u660E\u66F4\u5927\u76EE\u6807\u5DF2\u7ECF\u5B8C\u6210\uFF1B\u5982\u679C\u672C\u6B21\u76EE\u6807\u5C31\u662F\u5176\u4E2D\u67D0\u9879\uFF0C\u6EE1\u8DB3\u8BE5\u9879\u7EA6\u5B9A\u8981\u6C42\u5373\u53EF\u5B8C\u6210\u3002\n\n\u5BF9\u4E8E\u9700\u8981\u751F\u6210\u5E76\u5B9E\u9645\u4F7F\u7528\u4EA7\u7269\u7684\u4EFB\u52A1\uFF0C\u6309\u672C\u6B21\u76EE\u6807\u8986\u76D6\u76F8\u5173\u73AF\u8282\uFF1A\n\n```text\n\u771F\u5B9E\u8F93\u5165\n\u2192 \u7EA6\u5B9A\u7684\u5904\u7406\u6216\u63A8\u7406\u6D41\u7A0B\n\u2192 \u7B26\u5408\u8981\u6C42\u3001\u5B8C\u6574\u3001\u53EF\u4F7F\u7528\u7684\u8F93\u51FA\n\u2192 \u672C\u6B21\u76EE\u6807\u9700\u8981\u7684\u91CD\u65B0\u8BFB\u53D6\u6216\u4E0B\u6E38\u4F7F\u7528\n\u2192 \u5BF9\u5E94\u7684\u8D28\u91CF\u3001\u4E1A\u52A1\u6216\u79D1\u7814\u6807\u51C6\u9A8C\u8BC1\n```\n\n\u7EAF\u5206\u6790\u3001\u4EE3\u7801\u5BA1\u67E5\u3001\u7406\u8BBA\u63A8\u5BFC\u3001\u5C40\u90E8\u4FEE\u590D\u6216\u8BCA\u65AD\uFF0C\u6309\u76F8\u5E94\u4EFB\u52A1\u8303\u56F4\u4EA4\u4ED8\uFF1B\u4E0D\u80FD\u81EA\u52A8\u8FFD\u52A0\u5B8C\u6574\u8BAD\u7EC3\u3001\u6574\u5957\u5B9E\u9A8C\u77E9\u9635\u3001\u65E0\u5173\u4E0B\u6E38\u90E8\u7F72\u6216\u8BBA\u6587\u6548\u679C\u9A8C\u8BC1\u3002\u53CD\u8FC7\u6765\uFF0C\u672C\u6B21\u8BF7\u6C42\u660E\u786E\u8981\u6C42\u5B8C\u6574\u80FD\u529B\u65F6\uFF0C\u4E0D\u80FD\u7528\u5C40\u90E8\u6D4B\u8BD5\u6216\u73A9\u5177\u95ED\u73AF\u66FF\u4EE3\u3002\n\n\u4E0E\u672C\u6B21\u76EE\u6807\u6709\u5173\u7684\u5173\u952E\u73AF\u8282\u672A\u5B8C\u6210\u3001\u5FC5\u8981\u9A8C\u8BC1\u672A\u8FD0\u884C\u6216\u5931\u8D25\u672A\u6309\u8981\u6C42\u5904\u7406\u65F6\uFF0C\u5982\u5B9E\u8BF4\u660E\u5177\u4F53\u7F3A\u53E3\uFF1B\u76F8\u5173\u76EE\u6807\u5DF2\u7ECF\u8FBE\u5230\u4E14\u8BC1\u636E\u8DB3\u4EE5\u652F\u6301\u65F6\uFF0C\u5373\u53EF\u5B8C\u6210\uFF0C\u4E0D\u7EE7\u7EED\u4E0A\u63D0\u9A8C\u6536\u5C42\u7EA7\u3002\n\n# \u4E8C\u3001\u79D1\u7814\u95EE\u9898\u3001\u5047\u8BBE\u4E0E\u65B9\u6CD5\n\n## 6. \u4ECE\u771F\u5B9E\u95EE\u9898\u548C\u77E5\u8BC6\u7F3A\u53E3\u51FA\u53D1\n\n\u7814\u7A76\u9996\u5148\u8981\u56DE\u7B54\u7684\u4E0D\u662F\u201C\u53EF\u4EE5\u589E\u52A0\u4EC0\u4E48\u6A21\u5757\u201D\uFF0C\u800C\u662F\uFF1A\n\n- \u73B0\u6709\u5DE5\u4F5C\u5171\u540C\u89E3\u51B3\u4EC0\u4E48\u95EE\u9898\uFF1B\n- \u54EA\u4E2A\u771F\u5B9E\u77DB\u76FE\u4ECD\u672A\u88AB\u5145\u5206\u89E3\u51B3\uFF1B\n- \u73B0\u6709\u65B9\u6CD5\u4E3A\u4EC0\u4E48\u65E0\u6CD5\u540C\u65F6\u6EE1\u8DB3\u5173\u952E\u8981\u6C42\uFF1B\n- \u8FD9\u79CD\u5C40\u9650\u662F\u5076\u7136\u5B9E\u73B0\u95EE\u9898\uFF0C\u8FD8\u662F\u5171\u540C\u5EFA\u6A21\u5047\u8BBE\u9020\u6210\u7684\uFF1B\n- \u89E3\u51B3\u540E\u4F1A\u5E26\u6765\u4EC0\u4E48\u65B0\u80FD\u529B\u3001\u65B0\u8BA4\u8BC6\u6216\u65B0\u7684\u5EFA\u6A21\u65B9\u5F0F\uFF1B\n- \u4E3A\u4EC0\u4E48\u7B80\u5355\u89C4\u5219\u3001\u68C0\u7D22\u3001\u66F4\u591A\u91C7\u6837\u3001\u66F4\u5927\u6A21\u578B\u6216\u540E\u5904\u7406\u4E0D\u80FD\u76F4\u63A5\u7ED5\u8FC7\u3002\n\n\u504F\u597D\u91CD\u8981\u3001\u6709\u6311\u6218\u5E76\u4E0E\u793E\u533A\u5171\u4EAB\u95EE\u9898\u7A7A\u95F4\u7684\u7814\u7A76\uFF0C\u800C\u4E0D\u662F\u4E3A\u4E86\u5BB9\u6613\u6210\u529F\u4E3B\u52A8\u521B\u9020\u4E00\u4E2A\u5C01\u95ED\u5C0F\u8D5B\u9053\u3002\u95EE\u9898\u53EF\u4EE5\u6709\u91CE\u5FC3\uFF0C\u4F46\u5FC5\u987B\u5B9A\u4E49\u6E05\u695A\u7814\u7A76\u5BF9\u8C61\u3001\u5047\u8BBE\u6216\u8F93\u5165\u8F93\u51FA\u3001\u9002\u7528\u6761\u4EF6\u3001\u79D1\u5B66\u6216\u7528\u6237\u9700\u6C42\uFF0C\u4EE5\u53CA\u8BC4\u4EF7\u3001\u9A8C\u8BC1\u6216\u8BC1\u660E\u6807\u51C6\u3002\u5E94\u7528\u578B\u5DE5\u4F5C\u5E94\u8FDB\u4E00\u6B65\u8BF4\u660E\u90E8\u7F72\u6761\u4EF6\uFF1B\u7406\u8BBA\u548C\u57FA\u7840\u7814\u7A76\u4E0D\u5FC5\u865A\u6784\u4EA7\u54C1\u7528\u6237\uFF0C\u4F46\u5FC5\u987B\u8BF4\u660E\u5B83\u586B\u8865\u7684\u77E5\u8BC6\u7F3A\u53E3\u548C\u53EF\u68C0\u9A8C\u610F\u4E49\u3002\u5982\u679C\u7B80\u5355\u89C4\u5219\u3001\u68C0\u7D22\u3001\u66F4\u591A\u91C7\u6837\u3001\u66F4\u5927\u6A21\u578B\u6216\u540E\u5904\u7406\u5DF2\u7ECF\u80FD\u5728\u76F8\u540C\u7EA6\u675F\u4E0B\u53EF\u9760\u89E3\u51B3\u95EE\u9898\uFF0C\u5E94\u627F\u8BA4\u5E76\u4F18\u5148\u4F7F\u7528\u7B80\u5355\u65B9\u6848\uFF0C\u800C\u4E0D\u662F\u4E3A\u4E86\u5236\u9020\u7814\u7A76\u7A7A\u95F4\u800C\u56DE\u907F\u5B83\u3002\n\n## 7. \u79D1\u7814\u5224\u65AD\u5E94\u5BF9\u7167\u53EF\u83B7\u5F97\u7684\u5916\u90E8\u7814\u7A76\u73B0\u72B6\n\n\u6D89\u53CA\u65B9\u5411\u4EF7\u503C\u3001\u6700\u65B0\u8FDB\u5C55\u3001\u521B\u65B0\u8FB9\u754C\u3001\u57FA\u7EBF\u9009\u62E9\u548C\u8BBA\u6587\u4E3B\u5F20\u65F6\uFF0C\u5728\u7528\u6237\u5141\u8BB8\u4E14\u6765\u6E90\u53EF\u7528\u7684\u8303\u56F4\u5185\uFF0C\u56F4\u7ED5\u5F53\u524D\u5224\u65AD\u6838\u5BF9\u6700\u76F8\u5173\u3001\u6700\u53EF\u80FD\u6539\u53D8\u7ED3\u8BBA\u7684\u5916\u90E8\u5DE5\u4F5C\u3002\u91CD\u70B9\u6765\u6E90\u5305\u62EC\uFF1A\n\n- \u6700\u8FD1\u90BB\u5F3A\u65B9\u6CD5\uFF1B\n- \u6700\u65B0\u76F8\u5173\u7814\u7A76\uFF1B\n- \u53EF\u80FD\u53CD\u9A73\u5F53\u524D\u5047\u8BBE\u6216\u524A\u5F31\u521B\u65B0\u6027\u7684\u5DE5\u4F5C\uFF1B\n- \u793E\u533A\u5DF2\u6709\u4EFB\u52A1\u3001\u6307\u6807\u3001\u534F\u8BAE\u548C\u8BC4\u4EF7\u60EF\u4F8B\u3002\n\n\u5224\u65AD\u65F6\u5FC5\u987B\u533A\u5206\uFF1A\n\n1. \u5916\u90E8\u9886\u57DF\u5DF2\u7ECF\u505A\u5230\u4EC0\u4E48\uFF1B\n2. \u5F53\u524D\u5DE5\u4F5C\u5DF2\u7ECF\u771F\u5B9E\u505A\u5230\u4EC0\u4E48\uFF1B\n3. \u4E24\u8005\u4E4B\u95F4\u8FD8\u5B58\u5728\u4EC0\u4E48\u5DEE\u8DDD\uFF1B\n4. \u54EA\u4E9B\u7ED3\u679C\u80FD\u591F\u5F62\u6210\u8BBA\u6587\u7ED3\u8BBA\uFF1B\n5. \u54EA\u4E9B\u53EA\u662F\u5DE5\u7A0B\u9A8C\u8BC1\u3001\u673A\u5236\u8BCA\u65AD\u6216\u5C1A\u672A\u5B8C\u6210\u7684\u5FC5\u8981\u5DE5\u4F5C\u3002\n\n\u4E0D\u80FD\u53EA\u5728\u81EA\u5DF1\u7684\u4EE3\u7801\u3001\u6570\u636E\u548C\u8BC4\u4EF7\u5668\u4E2D\u5F62\u6210\u81EA\u6D3D\u95ED\u73AF\u3002\u4FE1\u606F\u5DF2\u7ECF\u8DB3\u4EE5\u652F\u6301\u5F53\u524D\u9009\u62E9\u65F6\uFF0C\u5E94\u63A8\u8FDB\u5B9E\u73B0\uFF1B\u51FA\u73B0\u91CD\u8981\u65B0\u8BC1\u636E\u65F6\u518D\u66F4\u65B0\u5224\u65AD\uFF0C\u4E0D\u4EE5\u7A77\u5C3D\u6587\u732E\u4E3A\u5F00\u5DE5\u524D\u63D0\u3002\u82E5\u53D7\u9650\u4E8E\u79BB\u7EBF\u73AF\u5883\u3001\u5C01\u95ED\u8D44\u6599\u6216\u7528\u6237\u6307\u5B9A\u6765\u6E90\uFF0C\u5E94\u660E\u786E\u8BF4\u660E\u68C0\u7D22\u8FB9\u754C\uFF0C\u4E0D\u80FD\u628A\u672A\u6838\u5B9E\u7684\u5916\u90E8\u73B0\u72B6\u6216\u68C0\u7D22\u5B8C\u6574\u5EA6\u5199\u6210\u4E8B\u5B9E\u3002\n\n## 8. \u7528\u6700\u8FD1\u90BB\u5DE5\u4F5C\u5B9A\u4F4D\u95EE\u9898\u4E0E\u8D21\u732E\n\n\u7528\u6700\u76F8\u5173\u7684\u5DF2\u6709\u5DE5\u4F5C\u5B9A\u4F4D\u95EE\u9898\u4E0E\u8D21\u732E\uFF0C\u4E0D\u8981\u6C42\u5148\u53D6\u5F97\u201C\u67E5\u65E0\u540C\u7C7B\u201D\u7684\u786E\u5B9A\u7ED3\u8BBA\u624D\u5F00\u59CB\u7814\u7A76\u3002\u5224\u65AD\u662F\u5426\u89E3\u51B3\u540C\u4E00\u95EE\u9898\uFF0C\u4E0D\u80FD\u53EA\u6BD4\u8F83\u6280\u672F\u540D\u79F0\uFF0C\u800C\u8981\u6BD4\u8F83\uFF1A\n\n- \u8F93\u5165\u662F\u5426\u76F8\u540C\uFF1B\n- \u8F93\u51FA\u662F\u5426\u76F8\u540C\uFF1B\n- \u63A8\u7406\u65F6\u53EF\u7528\u4FE1\u606F\u662F\u5426\u76F8\u540C\uFF1B\n- \u662F\u5426\u4F7F\u7528\u76EE\u6807\u7B54\u6848\u3001\u989D\u5916\u6807\u6CE8\u6216\u6D4B\u8BD5\u65F6\u4F18\u5316\uFF1B\n- \u662F\u5426\u4F9D\u8D56\u56FA\u5B9A\u6A21\u677F\u3001\u5019\u9009\u641C\u7D22\u3001\u91CD\u6392\u3001\u4EBA\u5DE5\u4FEE\u590D\u6216\u9690\u85CF\u540E\u5904\u7406\uFF1B\n- \u662F\u5426\u89E3\u51B3\u540C\u4E00\u4E2A\u7528\u6237\u9700\u6C42\uFF1B\n- \u8BC4\u4EF7\u534F\u8BAE\u548C\u8BA1\u7B97\u9884\u7B97\u662F\u5426\u53EF\u6BD4\u3002\n\n\u5173\u952E\u4E0D\u662F\u201C\u6709\u6CA1\u6709\u4EBA\u4F7F\u7528\u7C7B\u4F3C\u6280\u672F\u201D\uFF0C\u800C\u662F\u201C\u6709\u6CA1\u6709\u4EBA\u5DF2\u7ECF\u5728\u76F8\u540C\u90E8\u7F72\u7EA6\u675F\u4E0B\u89E3\u51B3\u540C\u4E00\u4E2A\u95EE\u9898\u201D\u3002\u5982\u679C\u5DF2\u6709\u5B8C\u5168\u76F8\u540C\u7684\u95EE\u9898\uFF0C\u5E94\u51C6\u786E\u5B9A\u4F4D\u5F53\u524D\u8D21\u732E\uFF0C\u53EF\u80FD\u662F\u65B9\u6CD5\u6539\u8FDB\u3001\u6548\u7387\u6539\u8FDB\u3001\u7406\u8BBA\u89E3\u91CA\u3001\u7CFB\u7EDF\u5316\u8BC4\u6D4B\u3001\u6570\u636E\u8D44\u6E90\u3001\u590D\u73B0\u7EA0\u9519\u6216\u8FB9\u754C\u5206\u6790\uFF0C\u800C\u4E0D\u662F\u901A\u8FC7\u6539\u540D\u5BA3\u79F0\u65B0\u95EE\u9898\u3002\n\n## 9. \u6309\u7814\u7A76\u9636\u6BB5\u660E\u786E\u95EE\u9898\u3001\u5047\u8BBE\u4E0E\u68C0\u9A8C\u76EE\u6807\n\n\u5728\u786E\u8BA4\u6027\u68C0\u9A8C\u524D\uFF0C\u5E94\u660E\u786E\u4E00\u4E2A\u53EF\u80FD\u88AB\u8BC1\u636E\u524A\u5F31\u3001\u63A8\u7FFB\u6216\u9650\u5B9A\u7684\u95EE\u9898\u3001\u4E3B\u5F20\u6216\u5047\u8BBE\uFF0C\u800C\u4E0D\u662F\u76F4\u63A5\u628A\u67D0\u79CD\u6280\u672F\u7EC4\u5408\u4F5C\u4E3A\u7814\u7A76\u76EE\u6807\u3002\u56E0\u679C\u6216\u673A\u5236\u7814\u7A76\u5E94\u63D0\u51FA\u673A\u5236\u5047\u8BBE\uFF1B\u6D4B\u91CF\u3001\u57FA\u51C6\u3001\u6570\u636E\u96C6\u3001\u7406\u8BBA\u548C\u63CF\u8FF0\u6027\u7814\u7A76\u53EF\u4EE5\u63D0\u51FA\u7814\u7A76\u95EE\u9898\u3001\u5B9A\u7406\u547D\u9898\u3001\u8986\u76D6\u76EE\u6807\u6216\u5224\u522B\u6807\u51C6\u3002\u63A2\u7D22\u9636\u6BB5\u53EF\u4EE5\u5148\u89C2\u5BDF\u73B0\u8C61\u3001\u8BD5\u7528\u5DE5\u5177\u6216\u751F\u6210\u5019\u9009\u89E3\u91CA\uFF0C\u4F46\u5728\u628A\u7ED3\u679C\u5F53\u4F5C\u9A8C\u8BC1\u6027\u8BC1\u636E\u524D\uFF0C\u5FC5\u987B\u660E\u786E\u533A\u5206\u4E8B\u540E\u5F62\u6210\u7684\u89E3\u91CA\u4E0E\u9884\u5148\u63D0\u51FA\u7684\u68C0\u9A8C\u76EE\u6807\u3002\n\n\u4E00\u4E2A\u51C6\u5907\u8FDB\u5165\u786E\u8BA4\u6027\u68C0\u9A8C\u7684\u673A\u5236\u5047\u8BBE\uFF0C\u5E94\u660E\u786E\u4E0E\u8BE5\u68C0\u9A8C\u6709\u5173\u7684\u5185\u5BB9\uFF1A\n\n- **\u673A\u5236\u5224\u65AD**\uFF1A\u76F8\u4FE1\u4EC0\u4E48\u7ED3\u6784\u3001\u5173\u7CFB\u6216\u89C4\u5F8B\u5B58\u5728\uFF1B\n- **\u6210\u7ACB\u4F9D\u636E**\uFF1A\u4E3A\u4EC0\u4E48\u4ECE\u7406\u8BBA\u3001\u903B\u8F91\u3001\u5148\u9A8C\u7814\u7A76\u6216\u5DF2\u6709\u73B0\u8C61\u770B\uFF0C\u5B83\u53EF\u80FD\u6210\u7ACB\uFF1B\n- **\u53EF\u89C2\u5BDF\u9884\u6D4B**\uFF1A\u5982\u679C\u6210\u7ACB\uFF0C\u54EA\u4E9B\u73B0\u8C61\u6216\u6307\u6807\u5E94\u5F53\u6539\u53D8\uFF1B\n- **\u5931\u8D25\u6761\u4EF6**\uFF1A\u4EC0\u4E48\u7ED3\u679C\u4F1A\u524A\u5F31\u6216\u63A8\u7FFB\u5047\u8BBE\uFF1B\n- **\u66FF\u4EE3\u89E3\u91CA**\uFF1A\u540C\u4E00\u7ED3\u679C\u8FD8\u53EF\u80FD\u7531\u54EA\u4E9B\u56E0\u7D20\u9020\u6210\uFF1B\n- **\u533A\u5206\u5B9E\u9A8C**\uFF1A\u5982\u4F55\u6392\u9664\u8FD9\u4E9B\u66FF\u4EE3\u89E3\u91CA\u3002\n\n\u84B8\u998F\u3001\u68C0\u7D22\u3001\u6269\u6563\u3001\u5F3A\u5316\u5B66\u4E60\u3001\u56FE\u7F51\u7EDC\u3001\u4EE3\u7406\u6A21\u578B\u3001\u6A21\u62DF\u5668\u548C\u9002\u914D\u5668\u90FD\u53EA\u662F\u5019\u9009\u5DE5\u5177\u3002\u6B63\u5F0F\u7814\u7A76\u95EE\u9898\u548C\u8BC1\u636E\u6807\u51C6\u5E94\u72EC\u7ACB\u4E8E\u5177\u4F53\u5DE5\u5177\u662F\u5426\u6D41\u884C\uFF1B\u63A2\u7D22\u53EF\u80FD\u7531\u65B0\u5DE5\u5177\u89E6\u53D1\u73B0\u8C61\uFF0C\u4F46\u6700\u7EC8\u8D21\u732E\u4E0D\u80FD\u53EA\u5269\u4E0B\u5DE5\u5177\u540D\u79F0\u3002\n\n## 10. \u6BD4\u8F83\u6709\u7ADE\u4E89\u529B\u7684\u5019\u9009\u8DEF\u7EBF\uFF0C\u53CA\u65F6\u63A8\u8FDB\u4E3B\u8DEF\u7EBF\n\n\u8BA8\u8BBA\u65B0\u65B9\u5411\u65F6\uFF0C\u6BD4\u8F83\u5F53\u524D\u6700\u6709\u7ADE\u4E89\u529B\u3001\u6700\u53EF\u80FD\u6539\u53D8\u9009\u62E9\u7684\u5019\u9009\u8DEF\u7EBF\u3002\u4EE5\u4E0B\u662F\u53EF\u8003\u8651\u7684\u521B\u65B0\u5C42\u7EA7\uFF0C\u4E0D\u8981\u6C42\u9010\u5C42\u679A\u4E3E\uFF0C\u4E5F\u4E0D\u8981\u6C42\u6BCF\u4E2A\u5C42\u7EA7\u90FD\u5F62\u6210\u4E00\u4E2A\u5019\u9009\u65B9\u6848\uFF1A\n\n- \u65B0\u95EE\u9898\u6216\u65B0\u4EFB\u52A1\u5B9A\u4E49\uFF1B\n- \u65B0\u8868\u793A\uFF1B\n- \u65B0\u751F\u6210\u3001\u63A8\u7406\u6216\u4F18\u5316\u673A\u5236\uFF1B\n- \u65B0\u8BAD\u7EC3\u76EE\u6807\uFF1B\n- \u65B0\u8BC4\u4EF7\u534F\u8BAE\uFF1B\n- \u65B0\u7406\u8BBA\u89E3\u91CA\u6216\u5931\u8D25\u89C4\u5F8B\uFF1B\n- \u5728\u4FDD\u6301\u80FD\u529B\u524D\u63D0\u4E0B\u663E\u8457\u66F4\u7B80\u5355\u3001\u66F4\u7A33\u5B9A\u6216\u66F4\u9AD8\u6548\u7684\u65B9\u6848\u3002\n\n\u5019\u9009\u8DEF\u7EBF\u5E94\u4ECE\u4EE5\u4E0B\u65B9\u9762\u6BD4\u8F83\uFF1A\n\n- \u662F\u5426\u771F\u6B63\u9002\u914D\u95EE\u9898\uFF1B\n- \u662F\u5426\u89E3\u51B3\u66F4\u6839\u672C\u7684\u969C\u788D\uFF1B\n- \u662F\u5426\u6709\u6E05\u695A\u4E14\u975E\u5E73\u51E1\u7684\u521B\u65B0\uFF1B\n- \u662F\u5426\u80FD\u591F\u5F62\u6210\u6E05\u695A\u3001\u8FDE\u8D2F\u7684\u7406\u8BBA\u6216\u673A\u5236\u89E3\u91CA\uFF1B\n- \u662F\u5426\u6709\u673A\u4F1A\u5728\u516C\u5E73\u6761\u4EF6\u4E0B\u8D85\u8FC7\u5F3A\u57FA\u7EBF\uFF0C\u6216\u5728\u7406\u8BBA\u3001\u8BCA\u65AD\u3001\u6548\u7387\u3001\u7A33\u5065\u6027\u3001\u8FB9\u754C\u8BA4\u8BC6\u7B49\u76EE\u6807\u4E0A\u63D0\u4F9B\u4E0D\u53EF\u7531\u5355\u7EAF\u6027\u80FD\u6392\u540D\u66FF\u4EE3\u7684\u65B0\u4EF7\u503C\uFF1B\n- \u6570\u636E\u3001\u76D1\u7763\u3001\u63A8\u7406\u548C\u8BC4\u4EF7\u98CE\u9669\u662F\u4EC0\u4E48\uFF1B\n- \u5BA1\u7A3F\u4EBA\u6700\u53EF\u80FD\u63D0\u51FA\u4EC0\u4E48\u53CD\u5BF9\u610F\u89C1\u3002\n\n\u6700\u7EC8\u9009\u62E9\u5E94\u57FA\u4E8E\u79D1\u7814\u4EF7\u503C\u3001\u9884\u671F\u4F18\u8D8A\u6027\u3001\u53EF\u9A8C\u8BC1\u6027\u548C\u53EF\u884C\u6027\uFF0C\u800C\u4E0D\u662F\u54EA\u6761\u4EE3\u7801\u8DEF\u5F84\u6700\u987A\u624B\u3002\u5DF2\u6709\u8DB3\u591F\u4F9D\u636E\u65F6\u63A8\u8FDB\u4E3B\u8DEF\u7EBF\uFF0C\u4E0D\u4E3A\u4E86\u6BD4\u8F83\u5F62\u5F0F\u5B8C\u6574\u800C\u6301\u7EED\u6269\u5C55\u65B9\u6848\u6811\u3002\n\n## 11. \u7528\u5FC5\u8981\u8BCA\u65AD\u4E0E\u6838\u5FC3\u5B9E\u73B0\u5171\u540C\u89E3\u51B3\u5173\u952E\u4E0D\u786E\u5B9A\u6027\n\n\u9AD8\u4EF7\u503C\u8DEF\u7EBF\u4E0D\u56E0\u96BE\u800C\u4E3B\u52A8\u964D\u7EA7\uFF0C\u4E5F\u4E0D\u8981\u6C42\u5148\u8BC1\u660E\u8DEF\u7EBF\u6210\u7ACB\uFF0C\u518D\u5141\u8BB8\u5B9E\u73B0\u6838\u5FC3\u3002\u80FD\u591F\u901A\u8FC7\u4F4E\u6210\u672C\u68C0\u67E5\u6539\u53D8\u91CD\u5927\u6295\u5165\u51B3\u5B9A\u7684\u95EE\u9898\uFF0C\u53EF\u4EE5\u5148\u68C0\u67E5\uFF1B\u53EA\u6709\u8FDB\u5165\u6838\u5FC3\u5B9E\u73B0\u6216\u6B63\u5F0F\u89C4\u6A21\u624D\u80FD\u56DE\u7B54\u7684\u95EE\u9898\uFF0C\u5E94\u76F4\u63A5\u63A8\u8FDB\u76F8\u5E94\u5B9E\u73B0\u3002\u6838\u5FC3\u5B9E\u73B0\u672C\u8EAB\u4E5F\u53EF\u4EE5\u662F\u53EF\u884C\u6027\u5DE5\u4F5C\uFF0C\u4E0D\u5FC5\u6392\u5728\u6240\u6709\u5916\u56F4\u8BCA\u65AD\u4E4B\u540E\u3002\n\n\u6839\u636E\u5F53\u524D\u963B\u585E\u9009\u62E9\u76F8\u5173\u95EE\u9898\uFF0C\u4E0D\u628A\u4EE5\u4E0B\u5185\u5BB9\u5F53\u4F5C\u8FDB\u5165\u5F00\u53D1\u524D\u5FC5\u987B\u5168\u90E8\u901A\u8FC7\u7684\u95E8\u69DB\uFF1A\n\n- **\u7406\u60F3\u4E0A\u754C**\uFF1A\u5373\u4F7F\u7ED9\u51FA\u7406\u60F3\u4E2D\u95F4\u7ED3\u679C\uFF0C\u6700\u7EC8\u76EE\u6807\u80FD\u5426\u8FBE\u5230\uFF1B\n- **\u53EF\u8FBE\u6027**\uFF1A\u5F53\u524D\u8868\u793A\u3001\u52A8\u4F5C\u3001\u5019\u9009\u6216\u8F93\u51FA\u7A7A\u95F4\u662F\u5426\u5305\u542B\u6B63\u786E\u7B54\u6848\uFF1B\n- **\u7EA6\u675F\u53EF\u884C\u6027**\uFF1A\u6B63\u786E\u65B9\u5411\u662F\u5426\u80FD\u6EE1\u8DB3\u4EFB\u52A1\u5DF2\u660E\u786E\u7684\u7ED3\u6784\u3001\u7269\u7406\u3001\u4E1A\u52A1\u548C\u5B9E\u9645\u8FD0\u884C\u6761\u4EF6\uFF1B\n- **\u8986\u76D6\u6027**\uFF1A\u6570\u636E\u548C\u76D1\u7763\u662F\u5426\u8986\u76D6\u76EE\u6807\u673A\u5236\u4E0E\u53D8\u5316\u8303\u56F4\uFF1B\n- **\u8BC4\u4EF7\u53EF\u9760\u6027**\uFF1A\u4EE3\u7406\u6307\u6807\u3001\u6A21\u62DF\u5668\u6216\u81EA\u52A8\u8BC4\u4EF7\u5668\u662F\u5426\u771F\u7684\u5BF9\u5E94\u6700\u7EC8\u76EE\u6807\uFF1B\n- **\u6709\u6548\u5E45\u5EA6\u4E0E\u89C4\u6A21**\uFF1A\u9884\u671F\u6548\u5E94\u662F\u5426\u8DB3\u4EE5\u6539\u53D8\u79D1\u7814\u5224\u65AD\uFF0C\u6A21\u578B\u3001\u6570\u636E\u548C\u8BA1\u7B97\u662F\u5426\u9002\u5408\u68C0\u9A8C\u5F53\u524D\u95EE\u9898\u3002\n\n\u4E0B\u4E00\u6B65\u6309\u5176\u89E3\u9664\u6838\u5FC3\u963B\u585E\u3001\u83B7\u5F97\u5173\u952E\u8BA4\u8BC6\u548C\u63A8\u8FDB\u6700\u7EC8\u7ED3\u679C\u7684\u4EF7\u503C\u9009\u62E9\uFF0C\u7EFC\u5408\u5B9E\u73B0\u6210\u672C\u4E0E\u5B8C\u6574\u5B9E\u9A8C\u5468\u671F\uFF0C\u4E0D\u9ED8\u8BA4\u4F18\u5148\u505A\u6700\u4FBF\u5B9C\u3001\u6700\u5BB9\u6613\u89E3\u91CA\u6216\u6700\u5BB9\u6613\u51FA\u7ED3\u679C\u7684\u5B9E\u9A8C\u3002\u5DF2\u660E\u786E\u9700\u8981\u7684\u6838\u5FC3\u6A21\u5757\uFF0C\u4E0D\u56E0\u8FD8\u6709\u5916\u56F4\u95EE\u9898\u672A\u67E5\u6E05\u800C\u65E0\u9650\u5EF6\u540E\u3002\n\n\u8BCA\u65AD\u5E94\u670D\u52A1\u5177\u4F53\u95EE\u9898\u5E76\u63D0\u4F9B\u6709\u589E\u91CF\u7684\u4FE1\u606F\u3002\u5DF2\u6709\u4FE1\u606F\u8DB3\u4EE5\u6307\u5BFC\u884C\u52A8\u65F6\uFF0C\u5E94\u8FDB\u5165\u76F8\u5E94\u6838\u5FC3\u5B9E\u73B0\u3001\u4FEE\u590D\u6216\u8DEF\u7EBF\u53D6\u820D\uFF0C\u4E0D\u7EE7\u7EED\u7528\u540C\u7C7B\u4F4E\u589E\u91CF\u8BCA\u65AD\u62D6\u5EF6\uFF1B\u5C1A\u4E0D\u80FD\u6307\u5B9A\u4E0B\u4E00\u6B21\u4EE3\u7801\u4FEE\u6539\u7684\u63A2\u7D22\uFF0C\u4E0D\u56E0\u6B64\u81EA\u52A8\u5931\u53BB\u4EF7\u503C\u3002\u786E\u8BA4\u6027\u5B9E\u9A8C\u4E3A\u8865\u9F50\u6B63\u5F0F\u8BC1\u636E\u800C\u4FDD\u6301\u5B9E\u73B0\u4E0D\u53D8\uFF0C\u4E5F\u4E0D\u5C5E\u4E8E\u56DE\u907F\u6838\u5FC3\u5B9E\u73B0\uFF0C\u89C1\u7B2C 16 \u8282\u3002\n\n## 12. \u65B9\u6CD5\u5E94\u56F4\u7ED5\u6E05\u695A\u6838\u5FC3\u95EE\u9898\u5F62\u6210\u8FDE\u8D2F\u673A\u5236\n\n\u7406\u60F3\u65B9\u6CD5\u5E94\u80FD\u7528\u4E00\u4E24\u53E5\u8BDD\u8BF4\u660E\u5176\u6838\u5FC3\u5173\u7CFB\uFF1A\n\n> \u73B0\u6709\u65B9\u6CD5\u7F3A\u5C11\u4EC0\u4E48\uFF0C\u6211\u4EEC\u901A\u8FC7\u4EC0\u4E48\u673A\u5236\u6216\u76F8\u4E92\u914D\u5408\u7684\u6B65\u9AA4\u89E3\u51B3\u3002\n\n\u504F\u597D\u7684\u65B9\u6CD5\u5F62\u6001\u662F\uFF1A\n\n- \u4E00\u4E2A\u6E05\u695A\u7684\u6838\u5FC3\u95EE\u9898\u548C\u4E3B\u8981\u5047\u8BBE\uFF1B\n- \u4E0E\u76EE\u6807\u5339\u914D\u3001\u76F8\u4E92\u914D\u5408\u4E14\u80FD\u8BF4\u660E\u8D21\u732E\u7684\u4E3B\u8981\u673A\u5236\uFF1B\n- \u4E00\u4E2A\u6E05\u695A\u7684\u8F93\u5165\u8F93\u51FA\u5173\u7CFB\uFF1B\n- \u4E0E\u8BBA\u6587\u4E3B\u5F20\u76F4\u63A5\u5BF9\u5E94\u7684\u8BAD\u7EC3\u6216\u63A8\u7406\u76EE\u6807\u3002\n\n\u201C\u8FDE\u8D2F\u201D\u6307\u7EC4\u4EF6\u4E4B\u95F4\u7684\u5173\u7CFB\u3001\u5206\u5DE5\u548C\u5BF9\u76EE\u6807\u7684\u8D21\u732E\u6E05\u695A\uFF0C\u4E0D\u8981\u6C42\u6240\u6709\u7EC4\u4EF6\u5F52\u5165\u540C\u4E00\u4E2A\u673A\u5236\u89E3\u91CA\u3002\u7EC4\u4EF6\u662F\u5426\u4FDD\u7559\uFF0C\u7531\u5176\u5BF9\u76EE\u6807\u80FD\u529B\u3001\u6548\u679C\u548C\u603B\u4F53\u6210\u672C\u7684\u8D21\u732E\u51B3\u5B9A\uFF0C\u4E0D\u6309\u540D\u79F0\u3001\u6570\u91CF\u6216\u662F\u5426\u7AEF\u5230\u7AEF\u4E00\u4F53\u5316\u5224\u65AD\u3002\u591A\u9636\u6BB5\u3001\u591A\u6A21\u6001\u3001\u591A\u7269\u7406\u8FC7\u7A0B\u4EE5\u53CA\u751F\u6210\u3001\u8BC4\u5206\u3001\u641C\u7D22\u3001\u7EA6\u675F\u6C42\u89E3\u7B49\u7EC4\u5408\uFF0C\u53EF\u4EE5\u662F\u5408\u7406\u7684\u6B63\u5F0F\u65B9\u6848\u3002\n\n\u53CD\u5BF9\uFF1A\n\n- \u672A\u5224\u65AD\u5171\u4EAB\u6839\u56E0\u548C\u73B0\u6709\u673A\u5236\u662F\u5426\u8DB3\u591F\uFF0C\u6BCF\u9047\u5230\u5931\u8D25\u5C31\u673A\u68B0\u589E\u52A0\u6A21\u5757\uFF1B\n- \u6CA1\u6709\u53EF\u8BF4\u660E\u7684\u80FD\u529B\u3001\u6548\u679C\u6216\u6210\u672C\u6536\u76CA\uFF0C\u5374\u7EE7\u7EED\u5806\u53E0\u9009\u62E9\u5668\u3001\u8DEF\u7531\u5668\u3001\u8BC4\u5206\u5668\u3001\u4FEE\u590D\u5668\u548C\u56DE\u9000\u5C42\uFF1B\n- \u5C06\u591A\u4E2A\u5E38\u89C1\u7EC4\u4EF6\u62FC\u63A5\u540E\u4F9D\u9760\u547D\u540D\u5236\u9020\u521B\u65B0\u611F\uFF1B\n- \u7528\u672A\u62AB\u9732\u7684\u989D\u5916\u6B65\u9AA4\u63A9\u76D6\u6240\u58F0\u79F0\u673A\u5236\u7684\u4E0D\u8DB3\uFF1B\n- \u628A\u5F00\u53D1\u5386\u53F2\u539F\u6837\u5199\u6210\u8BBA\u6587\u7ED3\u6784\u3002\n\n\u8BBA\u6587\u4E3B\u5F20\u9700\u8981\u8FDE\u8D2F\uFF0C\u4F46\u5DE5\u7A0B\u4E2D\u7684\u6BCF\u4E2A\u5FC5\u8981\u6B65\u9AA4\u4E0D\u5FC5\u5404\u81EA\u627F\u8F7D\u521B\u65B0\uFF0C\u4E5F\u4E0D\u5FC5\u670D\u52A1\u540C\u4E00\u4E2A\u5B66\u672F\u89C2\u70B9\u3002\u4E00\u4E2A\u6A21\u5757\u82E5\u53EA\u5229\u7528\u67D0\u4E2A\u6837\u4F8B\u7684\u5076\u7136\u7279\u5F81\uFF0C\u4E0D\u80FD\u8BF4\u660E\u53EF\u63A8\u5E7F\u7684\u4F5C\u7528\uFF0C\u901A\u5E38\u4E0D\u9002\u5408\u8FDB\u5165\u4E3B\u65B9\u6CD5\u3002\n\n## 13. \u6309\u673A\u5236\u548C\u9002\u7528\u6761\u4EF6\u89E3\u91CA\u89C4\u6A21\u8BC1\u636E\uFF0C\u4E0D\u628A\u5B8C\u6574\u8BBE\u8BA1\u5F53\u4F5C\u5F00\u5DE5\u524D\u63D0\n\n\u5C0F\u6A21\u578B\u3001\u89C4\u5219\u65B9\u6CD5\u3001\u5355\u6837\u672C\u8FC7\u62DF\u5408\u548C\u5C40\u90E8\u811A\u672C\u53EF\u4EE5\u56DE\u7B54\u8868\u793A\u3001\u76D1\u7763\u3001\u4F18\u5316\u6216\u89E3\u7801\u95EE\u9898\uFF0C\u4E5F\u53EF\u4EE5\u68C0\u67E5\u4EE3\u7801\u8DEF\u5F84\uFF0C\u4F46\u7ED3\u8BBA\u8303\u56F4\u53D6\u51B3\u4E8E\u5B9E\u9645\u4FDD\u7559\u7684\u673A\u5236\u548C\u6761\u4EF6\u3002\u5C0F\u89C4\u6A21\u5931\u8D25\u662F\u5426\u524A\u5F31\u6838\u5FC3\u5047\u8BBE\uFF0C\u53D6\u51B3\u4E8E\u8BE5\u5047\u8BBE\u662F\u5426\u9884\u6D4B\u5728\u5F53\u524D\u6761\u4EF6\u4E0B\u6210\u7ACB\uFF0C\u4EE5\u53CA\u5B9E\u9A8C\u662F\u5426\u4FDD\u7559\u76F8\u5173\u673A\u5236\uFF1B\u4E0D\u80FD\u4EC5\u51ED\u53C2\u6570\u5C11\u5C31\u6392\u9664\u5176\u53CD\u8BC1\u4EF7\u503C\u3002\n\n\u786E\u6709\u4F9D\u636E\u8868\u660E\u6240\u9700\u5BB9\u91CF\u3001\u6570\u636E\u6216\u8BA1\u7B97\u672A\u8FBE\u5230\u65F6\uFF0C\u4E0D\u80FD\u7528\u8BE5\u5B9E\u9A8C\u5426\u5B9A\u4F9D\u8D56\u8FD9\u4E9B\u6761\u4EF6\u7684\u6B63\u5F0F\u5047\u8BBE\u3002\u53CD\u8FC7\u6765\uFF0C\u4E5F\u4E0D\u80FD\u5C06\u6240\u6709\u8D1F\u7ED3\u679C\u9ED8\u8BA4\u5F52\u56E0\u4E3A\u89C4\u6A21\u4E0D\u8DB3\uFF0C\u6216\u6BCF\u6B21\u5931\u8D25\u540E\u4E0D\u65AD\u62AC\u9AD8\u201C\u6700\u4F4E\u6709\u6548\u89C4\u6A21\u201D\u3002\u89C4\u6A21\u5224\u65AD\u5E94\u6709\u7406\u8BBA\u3001\u5DF2\u6709\u73B0\u8C61\u6216\u5B9E\u9645\u89C4\u6A21\u8D8B\u52BF\u7B49\u5177\u4F53\u4F9D\u636E\uFF0C\u5E76\u7ED3\u5408\u5F53\u524D\u9884\u7B97\u4E0E\u9884\u671F\u6536\u76CA\u66F4\u65B0\uFF1B\u89C4\u6A21\u672A\u77E5\u65F6\uFF0C\u4E0D\u8981\u6C42\u5148\u8BC1\u660E\u7CBE\u786E\u95E8\u69DB\u624D\u5141\u8BB8\u5F00\u5C55\u5B9E\u73B0\u3002\u7EE7\u7EED\u6269\u5927\u6295\u5165\u4E0E\u6682\u505C\u8DEF\u7EBF\u6309\u7B2C 4 \u8282\u5224\u65AD\u3002\n\n\u5728\u63A8\u8FDB\u4E2D\u660E\u786E\u6700\u7EC8\u76EE\u6807\u548C\u5DF2\u77E5\u4E0D\u53EF\u7F3A\u5931\u7684\u80FD\u529B\uFF1B\u53EA\u9700\u5148\u51B3\u5B9A\u652F\u6491\u5F53\u524D\u6838\u5FC3\u6B65\u9AA4\u7684\u8BBE\u8BA1\uFF0C\u4E0D\u8981\u6C42\u5B8C\u6574\u67B6\u6784\u5148\u786E\u5B9A\u6216\u5168\u90E8\u9A8C\u8BC1\u3002\u4F18\u5148\u5B9E\u73B0\u80FD\u66B4\u9732\u6838\u5FC3\u80FD\u529B\u6216\u5173\u952E\u98CE\u9669\u7684\u51B3\u7B56\u76F8\u5173\u5B8C\u6574\u5207\u7247\uFF0C\u63A5\u901A\u771F\u5B9E\u8F93\u5165\u751F\u4EA7\u3001\u4E0B\u6E38\u6D88\u8D39\u3001\u5FC5\u8981\u8FB9\u754C\u4E0E\u76F8\u79F0\u9A8C\u8BC1\uFF1B\u4F9D\u636E\u89C2\u5BDF\u4FEE\u590D\u5171\u56E0\u3001\u8C03\u6574\u8BBE\u8BA1\u6216\u6269\u5C55\u5230\u76EE\u6807\u89C4\u6A21\u548C\u4F7F\u7528\u6761\u4EF6\uFF0C\u518D\u7EE7\u7EED\u4E0B\u4E00\u9879\u6709\u6548\u884C\u52A8\u3002\u5207\u7247\u7531\u4F9D\u8D56\u548C\u8FA8\u522B\u529B\u51B3\u5B9A\uFF0C\u4E0D\u4E00\u5B9A\u5C0F\uFF1B\u5C40\u90E8\u6D4B\u8BD5\u901A\u8FC7\u6216\u539F\u578B\u8FD0\u884C\u4E0D\u80FD\u66FF\u4EE3\u672A\u5B8C\u6210\u7684\u76EE\u6807\u80FD\u529B\uFF0C\u4E5F\u4E0D\u8BBE\u56FA\u5B9A\u8F6E\u6570\u3002\u4EE5\u4E0B\u95EE\u9898\u6309\u76F8\u5173\u6027\u9010\u6B65\u660E\u786E\uFF0C\u5177\u4F53\u7ED3\u6784\u53EF\u4EE5\u968F\u5B9E\u73B0\u548C\u8BC1\u636E\u8FED\u4EE3\uFF1A\n\n- \u8868\u793A\u5355\u4F4D\u662F\u4EC0\u4E48\uFF1B\n- \u7ED3\u6784\u5173\u7CFB\u5982\u4F55\u7F16\u7801\uFF1B\n- \u751F\u6210\u6216\u9884\u6D4B\u987A\u5E8F\u662F\u4EC0\u4E48\uFF1B\n- \u6A21\u578B\u8F93\u51FA\u6EE1\u8DB3\u4EC0\u4E48\u5408\u540C\uFF1B\n- \u54EA\u4E9B\u7EA6\u675F\u7531\u6A21\u578B\u5185\u90E8\u4FDD\u8BC1\uFF1B\n- \u54EA\u4E9B\u7EA6\u675F\u7531\u5916\u90E8\u9A8C\u8BC1\uFF1B\n- \u63A8\u7406\u65F6\u662F\u5426\u9700\u8981\u641C\u7D22\u3001\u91CD\u6392\u6216\u4FEE\u590D\uFF1B\n- \u65B9\u6CD5\u4E0E\u5BBF\u4E3B\u7CFB\u7EDF\u4E4B\u95F4\u7684\u63A5\u53E3\u662F\u4EC0\u4E48\u3002\n\n\u5982\u679C\u5145\u5206\u8BC1\u636E\u8868\u660E\u7B80\u5355\u6A21\u578B\u5DF2\u7ECF\u6EE1\u8DB3\u6700\u7EC8\u76EE\u6807\u3001\u771F\u5B9E\u7EA6\u675F\u548C\u76F8\u5E94\u6BD4\u8F83\u8981\u6C42\uFF0C\u5B83\u53EF\u4EE5\u6210\u4E3A\u6700\u7EC8\u65B9\u6CD5\uFF1B\u201C\u7B80\u5355\u201D\u672C\u8EAB\u4E0D\u662F\u964D\u7EA7\u3002\u4E5F\u4E0D\u80FD\u4EC5\u56E0\u5DF2\u7ECF\u6295\u5165\u5DE5\u4F5C\uFF0C\u5C31\u628A\u80FD\u529B\u4E0D\u8DB3\u7684\u8BCA\u65AD\u5B9E\u73B0\u4E0D\u65AD\u8865\u4E01\u5316\u6210\u8BBA\u6587\u4E3B\u65B9\u6CD5\u3002\n\n## 14. \u4F9D\u636E\u7ED3\u679C\u4FEE\u6B63\u5224\u65AD\uFF0C\u4E0D\u6539\u53E3\u5F84\u5236\u9020\u6210\u529F\n\n\u7ED3\u679C\u4E0D\u652F\u6301\u5047\u8BBE\u65F6\uFF0C\u5148\u6838\u5BF9\u4E8B\u524D\u7684\u673A\u5236\u4F9D\u636E\u3001\u9002\u7528\u6761\u4EF6\u548C\u53EF\u89C2\u5BDF\u9884\u671F\uFF0C\u590D\u7528\u6B64\u524D\u4ECD\u6210\u7ACB\u7684\u63A8\u5BFC\u4E0E\u68C0\u9A8C\uFF0C\u53EA\u8865\u67E5\u65B0\u53CD\u8BC1\u6216\u6761\u4EF6\u53D8\u5316\u3002\u5B9A\u4F4D\u8FD9\u6B21\u5931\u8D25\u5B9E\u9645\u5F71\u54CD\u7684\u547D\u9898\u548C\u5171\u4EAB\u6839\u56E0\uFF0C\u57FA\u4E8E\u6559\u8BAD\u4FEE\u6B63\u5B9E\u73B0\u3001\u8BC4\u4EF7\u6216\u673A\u5236\uFF0C\u63D0\u51FA\u6709\u4F9D\u636E\u4E14\u66F4\u53EF\u8FA8\u522B\u7684\u4E0B\u4E00\u65B9\u6CD5\uFF0C\u5E76\u7EE7\u7EED\u5DF2\u6388\u6743\u7684\u6709\u6548\u884C\u52A8\uFF1B\u82E5\u5F97\u5230\u53EF\u8FC1\u79FB\u8BA4\u8BC6\u4E14\u5141\u8BB8\u5199\u5165\uFF0C\u4FDD\u5B58\u76F8\u5E94 Lesson\uFF0C\u4E0D\u80FD\u4EE5\u5199\u5B8C\u53CD\u601D\u6216\u62A5\u544A\u963B\u585E\u4EE3\u66FF\u4FEE\u590D\u3002\u53EF\u6309\u8BC1\u636E\u4EF7\u503C\u3001\u6392\u67E5\u6210\u672C\u548C\u98CE\u9669\u9009\u62E9\u6027\u68C0\u67E5\u4EE5\u4E0B\u5C42\u9762\uFF0C\u4E0D\u8981\u6C42\u673A\u68B0\u9075\u5FAA\u56FA\u5B9A\u987A\u5E8F\uFF1A\n\n1. \u8BC4\u4EF7\u5668\u662F\u5426\u53EF\u4FE1\uFF1B\n2. \u4EFB\u52A1\u548C\u76D1\u7763\u662F\u5426\u771F\u6B63\u8981\u6C42\u76EE\u6807\u80FD\u529B\uFF1B\n3. \u6570\u636E\u662F\u5426\u8986\u76D6\u76EE\u6807\u53D8\u5316\uFF1B\n4. \u8868\u793A\u7A7A\u95F4\u662F\u5426\u80FD\u591F\u8868\u8FBE\u6B63\u786E\u7B54\u6848\uFF1B\n5. \u6A21\u578B\u662F\u5426\u771F\u6B63\u4F7F\u7528\u4E86\u5173\u952E\u6761\u4EF6\uFF1B\n6. \u4F18\u5316\u8FC7\u7A0B\u662F\u5426\u963B\u788D\u5B66\u4E60\uFF1B\n7. \u63A8\u7406\u534F\u8BAE\u662F\u5426\u7834\u574F\u8BAD\u7EC3\u80FD\u529B\uFF1B\n8. \u57FA\u7EBF\u3001\u6570\u636E\u548C\u9884\u7B97\u662F\u5426\u516C\u5E73\uFF1B\n9. \u539F\u59CB\u79D1\u5B66\u5047\u8BBE\u662F\u5426\u672C\u8EAB\u9519\u8BEF\u3002\n\n\u4E0D\u80FD\u901A\u8FC7\u4E8B\u540E\u4FEE\u6539\u4EFB\u52A1\u3001\u7B5B\u9009\u5B50\u96C6\u3001\u66F4\u6362\u6307\u6807\u53E3\u5F84\u6216\u53EA\u5C55\u793A\u6B63\u4F8B\u5236\u9020\u6210\u529F\u3002\u4F9D\u636E\u73B0\u6709\u8BC1\u636E\u5982\u5B9E\u6536\u7A84\u7ED3\u8BBA\u3001\u91CD\u65B0\u754C\u5B9A\u80FD\u529B\u8FB9\u754C\u662F\u6B63\u5E38\u7684\u5224\u65AD\u4FEE\u6B63\uFF1B\u53EA\u8C03\u6574\u8868\u8FF0\u800C\u672A\u6539\u53D8\u8BC1\u636E\u6216\u8BC4\u4EF7\u6761\u4EF6\u65F6\uFF0C\u4E0D\u81EA\u52A8\u8981\u6C42\u91CD\u505A\u5B9E\u9A8C\u3002\u5B9E\u9645\u4FEE\u6539\u6570\u636E\u7B5B\u9009\u3001\u6307\u6807\u3001\u65B9\u6CD5\u6216\u4F7F\u7528\u6D4B\u8BD5\u53CD\u9988\u65F6\uFF0C\u5E94\u8BF4\u660E\u53D8\u66F4\uFF0C\u6309\u53D7\u5F71\u54CD\u7684\u4E3B\u5F20\u5904\u7406\u53EF\u6BD4\u6027\u4E0E\u5FC5\u8981\u9A8C\u8BC1\uFF0C\u4FDD\u7559\u6709\u5173\u539F\u7ED3\u679C\uFF0C\u4E0D\u80FD\u628A\u4FEE\u6539\u540E\u7684\u6210\u529F\u5192\u5145\u539F\u534F\u8BAE\u6210\u529F\u3002\n\n\u8D1F\u7ED3\u679C\u53EF\u4EE5\u63A5\u53D7\uFF1B\u5B9A\u4F4D\u4EE5\u8DB3\u4EE5\u6307\u5BFC\u5F53\u524D\u884C\u52A8\u4E3A\u5EA6\uFF0C\u8BCA\u65AD\u4E0E\u6838\u5FC3\u5B9E\u73B0\u7684\u8854\u63A5\u6309\u7B2C 11 \u8282\u5904\u7406\uFF0C\u4E0D\u8981\u6C42\u5148\u6392\u9664\u6240\u6709\u5C42\u9762\u624D\u5141\u8BB8\u4FEE\u590D\u6216\u8C03\u6574\u8DEF\u7EBF\u3002\n\n## 15. \u4FE1\u606F\u548C\u901A\u7528\u6027\u90FD\u5FC5\u987B\u53D7\u5230\u7EA6\u675F\n\n\u8BAD\u7EC3\u3001\u63A8\u7406\u548C\u8BC4\u4EF7\u5206\u522B\u6309\u5404\u81EA\u534F\u8BAE\u5224\u65AD\u4FE1\u606F\u53EF\u7528\u6027\uFF0C\u8FDB\u5165\u65B9\u6CD5\u7684\u4FE1\u606F\u5E94\u6EE1\u8DB3\u4E0E\u5176\u89D2\u8272\u76F8\u79F0\u7684\u6761\u4EF6\uFF1A\n\n- \u4E0E\u7814\u7A76\u95EE\u9898\u76F4\u63A5\u76F8\u5173\uFF1B\n- \u63A8\u7406\u5B9E\u9645\u4F7F\u7528\u7684\u4FE1\u606F\u5FC5\u987B\u5728\u63A8\u7406\u65F6\u771F\u5B9E\u53EF\u83B7\u5F97\uFF1B\u8BAD\u7EC3\u4E13\u7528\u7684\u76D1\u7763\u3001\u6559\u5E08\u4FE1\u53F7\u6216\u8F85\u52A9\u76EE\u6807\u4E0D\u8981\u6C42\u63A8\u7406\u65F6\u4ECD\u7136\u63D0\u4F9B\uFF1B\n- \u4E0D\u5F15\u5165\u8FDD\u53CD\u6570\u636E\u5212\u5206\u3001\u4FE1\u606F\u6761\u4EF6\u6216\u6BD4\u8F83\u534F\u8BAE\u7684\u7B54\u6848\u4FE1\u606F\u548C\u9690\u6027\u6CC4\u6F0F\uFF1B\n- \u4E0D\u4EE5\u4E0E\u4EFB\u52A1\u65E0\u5173\u7684\u7C7B\u522B\u3001\u8EAB\u4EFD\u3001\u6A21\u677F\u6216\u6837\u672C\u6377\u5F84\u66FF\u4EE3\u76EE\u6807\u80FD\u529B\uFF1B\n- \u5F53\u8BBA\u6587\u4E3B\u5F20\u4F9D\u8D56\u8BE5\u4FE1\u606F\u7684\u4F5C\u7528\u65F6\uFF0C\u80FD\u901A\u8FC7\u6D88\u878D\u3001\u9519\u914D\u3001\u53CD\u4E8B\u5B9E\u6216\u5176\u4ED6\u5408\u9002\u65B9\u6CD5\u9A8C\u8BC1\u3002\n\n\u7C7B\u522B\u3001\u8EAB\u4EFD\u3001\u5750\u6807\u3001\u6A21\u677F\u7B49\u4FE1\u606F\u82E5\u672C\u6765\u5C31\u662F\u5408\u6CD5\u4EFB\u52A1\u8F93\u5165\uFF0C\u53EF\u4EE5\u4F7F\u7528\uFF1B\u95EE\u9898\u5728\u4E8E\u5B83\u4EEC\u662F\u5426\u9020\u6210\u672A\u58F0\u660E\u7684\u6377\u5F84\u6216\u4F7F\u6BD4\u8F83\u6761\u4EF6\u4E0D\u4E00\u81F4\u3002\n\n\u540C\u6837\uFF0C\u901A\u7528\u6027\u4E0D\u80FD\u7531\u63A5\u53E3\u8BBE\u8BA1\u76F4\u63A5\u63A8\u51FA\uFF1A\n\n- \u5355\u4E2A\u6570\u636E\u96C6\u7684\u6210\u529F\u4E0D\u80FD\u81EA\u52A8\u63A8\u51FA\u66F4\u5E7F\u8303\u56F4\u7684\u6709\u6548\u6027\uFF0C\u63A8\u5E7F\u8303\u56F4\u53D6\u51B3\u4E8E\u4E0E\u4E3B\u5F20\u5339\u914D\u7684\u8BC1\u636E\u4E0E\u9002\u7528\u6761\u4EF6\uFF1B\n- \u5728\u4E00\u4E2A\u9AA8\u5E72\u6210\u529F\uFF0C\u4E0D\u80FD\u76F4\u63A5\u5BA3\u79F0\u9AA8\u5E72\u65E0\u5173\uFF1B\n- \u5728\u4E00\u4E2A\u7C7B\u522B\u6210\u529F\uFF0C\u4E0D\u80FD\u76F4\u63A5\u5BA3\u79F0\u8DE8\u7C7B\u522B\u6CDB\u5316\uFF1B\n- \u4EE3\u7801\u80FD\u591F\u63A5\u5165\u591A\u4E2A\u7CFB\u7EDF\uFF0C\u4E0D\u7B49\u4E8E\u65B9\u6CD5\u5DF2\u7ECF\u5728\u591A\u4E2A\u7CFB\u7EDF\u4E0A\u6709\u6548\u3002\n\n\u901A\u7528\u6027\u5FC5\u987B\u7531\u4E0E\u4E3B\u5F20\u5339\u914D\u7684\u8BC1\u636E\u652F\u6301\uFF0C\u4F8B\u5982\u8DE8\u6761\u4EF6\u5B9E\u9A8C\u3001\u5F62\u5F0F\u8BC1\u660E\u6216\u6E05\u695A\u7684\u9002\u7528\u57DF\u5206\u6790\uFF0C\u800C\u4E0D\u662F\u7531\u547D\u540D\u6216\u62BD\u8C61\u63A5\u53E3\u5E26\u6765\u7684\u5370\u8C61\u3002\n\n# \u4E09\u3001\u5B9E\u9A8C\u4E0E\u8BC1\u636E\n\n## 16. \u6309\u63A2\u7D22\u3001\u8BCA\u65AD\u548C\u786E\u8BA4\u76EE\u7684\u5224\u65AD\u5B9E\u9A8C\u4EF7\u503C\n\n\u51C6\u5907\u8FDB\u5165\u8BBA\u6587\u8BC1\u636E\u6216\u6B63\u5F0F\u8DEF\u7EBF\u51B3\u7B56\u7684\u5B9E\u9A8C\uFF0C\u5E94\u81F3\u5C11\u5B8C\u6210\u4E00\u9879\u660E\u786E\u4EFB\u52A1\uFF1A\n\n- \u9A8C\u8BC1\u6838\u5FC3\u5047\u8BBE\uFF1B\n- \u6392\u9664\u4E00\u79CD\u91CD\u8981\u66FF\u4EE3\u89E3\u91CA\uFF1B\n- \u51B3\u5B9A\u8DEF\u7EBF\u7EE7\u7EED\u8FD8\u662F\u505C\u6B62\uFF1B\n- \u5F62\u6210\u4E3B\u8868\u3001\u4E3B\u56FE\u6216\u5173\u952E\u6D88\u878D\uFF1B\n- \u660E\u786E\u80FD\u529B\u8FB9\u754C\u3001\u5931\u8D25\u89C4\u5F8B\u6216\u9002\u7528\u6761\u4EF6\u3002\n\n\u786E\u8BA4\u6027\u5B9E\u9A8C\u53EF\u4EE5\u4FDD\u6301\u6838\u5FC3\u5B9E\u73B0\u4E0E\u534F\u8BAE\u4E0D\u53D8\uFF0C\u4EE5\u8865\u9F50\u91CD\u590D\u8FD0\u884C\u3001\u5F3A\u57FA\u7EBF\u6BD4\u8F83\u6216\u6700\u7EC8\u8BC4\u4EF7\u6240\u9700\u8BC1\u636E\u4E3A\u76EE\u7684\uFF1B\u4E0D\u8981\u6C42\u6BCF\u6B21\u5B9E\u9A8C\u90FD\u6539\u4EE3\u7801\u3001\u6539\u8DEF\u7EBF\u6216\u7EC8\u6B62\u9879\u76EE\u3002\n\n\u63A2\u7D22\u6027\u5B9E\u9A8C\u53EF\u4EE5\u5148\u4EA7\u751F\u6709\u4EF7\u503C\u7684\u65B0\u89C2\u5BDF\u3001\u66B4\u9732\u95EE\u9898\u6216\u5F62\u6210\u5019\u9009\u89E3\u91CA\uFF0C\u4E0D\u8981\u6C42\u6BCF\u6B21\u8FD0\u884C\u9884\u5148\u7ED1\u5B9A\u786E\u5B9A\u7684\u5B9E\u73B0\u52A8\u4F5C\u3002\u5192\u70DF\u6D4B\u8BD5\u3001\u6027\u80FD\u5256\u6790\u3001\u8D85\u53C2\u6570\u63A2\u7D22\u3001\u6570\u636E\u68C0\u67E5\u548C\u6545\u969C\u590D\u73B0\u4E5F\u6709\u5176\u5DE5\u7A0B\u6216\u8BCA\u65AD\u7528\u9014\uFF0C\u4F46\u53EA\u652F\u6301\u4E0E\u5176\u76EE\u7684\u5BF9\u5E94\u7684\u7ED3\u8BBA\u3002\n\n\u4E0D\u4EE5\u5B9E\u9A8C\u6570\u91CF\u6216\u4EE3\u7801\u6539\u52A8\u6B21\u6570\u5224\u65AD\u8FDB\u5C55\uFF0C\u4E5F\u4E0D\u4E3A\u5C55\u793A\u5DE5\u4F5C\u91CF\u800C\u8FD0\u884C\u3002\u5E94\u538B\u7F29\u7684\u662F\u6CA1\u6709\u4FE1\u606F\u589E\u91CF\u3001\u6CA1\u6709\u5FC5\u8981\u8BC1\u636E\u4EF7\u503C\u4E14\u4E0D\u80FD\u63A8\u8FDB\u5F53\u524D\u76EE\u6807\u7684\u91CD\u590D\u5DE5\u4F5C\uFF1B\u8BCA\u65AD\u4F55\u65F6\u8F6C\u5165\u884C\u52A8\u6309\u7B2C 11 \u8282\u5904\u7406\u3002\u8FD9\u4E9B\u5224\u65AD\u53EF\u4EE5\u6CBF\u7528\u5F53\u524D\u7814\u7A76\u8BA1\u5212\uFF0C\u4E0D\u8981\u6C42\u4E3A\u6BCF\u6B21\u8FD0\u884C\u53E6\u5199\u884C\u52A8\u8BF4\u660E\u8868\u3002\n\n## 17. \u6309\u7814\u7A76\u7C7B\u578B\u660E\u786E\u5B9E\u9A8C\u8BBE\u8BA1\uFF0C\u786E\u8BA4\u6027\u68C0\u9A8C\u63D0\u524D\u786E\u5B9A\u5224\u636E\n\n\u5B9E\u9A8C\u8BBE\u8BA1\u5E94\u5199\u6E05\u6216\u6CBF\u7528\u5DF2\u6709\u8BB0\u5F55\u4E2D\u4F1A\u5F71\u54CD\u5F53\u524D\u7ED3\u8BBA\u7684\u6761\u4EF6\u3002\u786E\u8BA4\u6027\u68C0\u9A8C\u5728\u5F00\u59CB\u524D\u660E\u786E\u76F8\u5E94\u4E3B\u5F20\u4E0E\u5224\u636E\uFF1B\u63A2\u7D22\u6027\u7814\u7A76\u53EF\u4EE5\u968F\u89C2\u5BDF\u5F62\u6210\u95EE\u9898\u548C\u89E3\u91CA\uFF0C\u4E5F\u53EF\u4EE5\u4EA7\u751F\u6B63\u5F0F\u8BBA\u6587\u7ED3\u679C\uFF0C\u4F46\u5E94\u5982\u5B9E\u8BF4\u660E\u5F62\u6210\u8FC7\u7A0B\uFF0C\u4E0D\u628A\u4E8B\u540E\u9009\u62E9\u5192\u5145\u9884\u5148\u8BBE\u5B9A\u3002\n\n\u6309\u7814\u7A76\u7C7B\u578B\u9009\u62E9\u76F8\u5173\u5185\u5BB9\uFF0C\u4E0D\u4E3A\u586B\u6EE1\u6E05\u5355\u7F16\u9020\u6CA1\u6709\u5B9E\u9645\u7528\u9014\u7684\u81EA\u53D8\u91CF\u3001\u6548\u5E94\u9608\u503C\u6216\u505C\u6B62\u6570\u5B57\uFF1A\n\n- \u8981\u56DE\u7B54\u7684\u95EE\u9898\u3001\u68C0\u9A8C\u7684\u4E3B\u5F20\u6216\u5224\u522B\u76EE\u6807\uFF1B\n- \u9700\u8981\u64CD\u7EB5\u6216\u6BD4\u8F83\u7684\u53D8\u91CF\uFF0C\u4EE5\u53CA\u9700\u8981\u4FDD\u6301\u4E0D\u53D8\u7684\u6570\u636E\u3001\u8F93\u5165\u3001\u6A21\u578B\u89C4\u6A21\u3001\u9884\u7B97\u548C\u540E\u5904\u7406\uFF1B\n- \u8BC4\u4EF7\u6307\u6807\u3001\u6D4B\u91CF\u65B9\u5F0F\u6216\u5176\u4ED6\u5224\u65AD\u4F9D\u636E\uFF1B\n- \u4EC0\u4E48\u7ED3\u679C\u652F\u6301\u3001\u524A\u5F31\u6216\u9650\u5B9A\u5F53\u524D\u5224\u65AD\uFF1B\n- \u5BF9\u5F53\u524D\u51B3\u7B56\u6709\u5B9E\u9645\u610F\u4E49\u7684\u5DEE\u5F02\u3001\u9608\u503C\u6216\u505C\u6B62\u6761\u4EF6\uFF1B\n- \u7ED3\u679C\u5982\u4F55\u7528\u4E8E\u7814\u7A76\u5224\u65AD\u3001\u5F62\u6210\u8BC1\u636E\u6216\u51B3\u5B9A\u540E\u7EED\u5DE5\u4F5C\u3002\n\n\u4E3A\u4E86\u56E0\u679C\u5F52\u56E0\uFF0C\u4F18\u5148\u8BA9\u4E00\u6B21\u5BF9\u7167\u53EA\u6539\u53D8\u4E00\u4E2A\u5173\u952E\u56E0\u7D20\u3002\u56E0\u5B50\u8BBE\u8BA1\u3001\u591A\u53D8\u91CF\u5B9E\u9A8C\u3001\u7CFB\u7EDF\u7EA7\u6BD4\u8F83\u6216\u8054\u5408\u6269\u5C55\u4E5F\u53EF\u4EE5\u4F7F\u7528\uFF0C\u4F46\u5206\u6790\u5E94\u4E0E\u8981\u5F52\u56E0\u7684\u4E3B\u8981\u6548\u5E94\u3001\u4EA4\u4E92\u4F5C\u7528\u6216\u6574\u4F53\u7CFB\u7EDF\u4EF7\u503C\u5BF9\u5E94\uFF0C\u4E0D\u80FD\u5728\u540C\u65F6\u4FEE\u6539\u591A\u9879\u6761\u4EF6\u540E\u628A\u5168\u90E8\u63D0\u5347\u5F52\u56E0\u7ED9\u5355\u4E00\u673A\u5236\u3002\n\n\u540C\u4E00\u534F\u8BAE\u4E0B\u7684\u91CD\u590D\u8FD0\u884C\u53EF\u4EE5\u5171\u7528\u5B9E\u9A8C\u8BBE\u8BA1\uFF0C\u4E0D\u8981\u6C42\u9010\u6B21\u91CD\u5199\u3002\u6700\u7EC8\u6D4B\u8BD5\u4E0E\u72EC\u7ACB\u786E\u8BA4\u7684\u534F\u8BAE\u6309\u7B2C 22 \u8282\u5904\u7406\uFF1B\u666E\u901A\u5F00\u53D1\u96C6\u8C03\u8BD5\u4E0D\u56E0\u7ED3\u679C\u51C6\u5907\u53D1\u8868\u5C31\u81EA\u52A8\u53D8\u6210\u51BB\u7ED3\u7684\u786E\u8BA4\u6027\u68C0\u9A8C\u3002\n\n## 18. \u57FA\u7EBF\u5E94\u5C3D\u53EF\u80FD\u5916\u90E8\u3001\u5F3A\u3001\u8FD1\u4E14\u516C\u5E73\n\n\u4ECE\u4EE5\u4E0B\u6765\u6E90\u9009\u62E9\u8DB3\u4EE5\u652F\u6491\u5F53\u524D\u4E3B\u5F20\u7684\u76F8\u5173\u4E14\u6709\u7ADE\u4E89\u529B\u7684\u57FA\u7EBF\uFF0C\u4E0D\u8981\u6C42\u6BCF\u7C7B\u90FD\u8865\u9F50\u4E00\u4E2A\u65B9\u6CD5\uFF1A\n\n- \u540C\u4EFB\u52A1\u516C\u5F00\u5F3A\u65B9\u6CD5\uFF1B\n- \u8F93\u5165\u3001\u8F93\u51FA\u548C\u90E8\u7F72\u6761\u4EF6\u6700\u63A5\u8FD1\u7684\u65B9\u6CD5\uFF1B\n- \u7ECF\u8FC7\u5408\u7406\u9002\u914D\u7684\u5916\u90E8\u65B9\u6CD5\uFF1B\n- \u80FD\u89E3\u51B3\u90E8\u5206\u4EFB\u52A1\u7684\u5F3A\u65B9\u6CD5\uFF1B\n- \u6700\u7B80\u5355\u4F46\u6709\u7ADE\u4E89\u529B\u7684\u66FF\u4EE3\u65B9\u6848\uFF1B\n- \u5FC5\u8981\u65F6\u4F7F\u7528\u989D\u5916\u4FE1\u606F\u7684\u53C2\u8003\u4E0A\u754C\u6216\u4E13\u5BB6\u65B9\u6CD5\u3002\n\n\u5185\u90E8\u65E7\u7248\u672C\u548C\u81EA\u8EAB\u53D8\u4F53\u53EF\u4EE5\u7528\u4E8E\u6D88\u878D\u3001\u8BCA\u65AD\u3001\u4E0B\u754C\u6216\u5386\u53F2\u6BD4\u8F83\uFF0C\u901A\u5E38\u4E0D\u80FD\u66FF\u4EE3\u53EF\u83B7\u5F97\u7684\u5916\u90E8\u5F3A\u57FA\u7EBF\u3002\u4E0D\u80FD\u4EC5\u56E0\u5F3A\u57FA\u7EBF\u96BE\u4EE5\u5B9E\u73B0\uFF0C\u5C31\u7528\u5F31\u6BD4\u8F83\u5236\u9020\u4F18\u52BF\uFF1B\u5FC5\u8981\u6BD4\u8F83\u672A\u5B8C\u6210\u65F6\u8BF4\u660E\u7ED3\u8BBA\u9650\u5236\uFF0C\u4F46\u4E0D\u628A\u5B8C\u6574\u57FA\u7EBF\u5E93\u4F5C\u4E3A\u6838\u5FC3\u5B9E\u73B0\u7684\u5F00\u5DE5\u6761\u4EF6\u3002\u5BF9\u4E8E\u5168\u65B0\u4EFB\u52A1\u3001\u5C01\u95ED\u7CFB\u7EDF\u6216\u4E0D\u5B58\u5728\u53EF\u6BD4\u5916\u90E8\u65B9\u6CD5\u7684\u60C5\u51B5\uFF0C\u5E94\u8BF4\u660E\u539F\u56E0\uFF0C\u5E76\u9009\u62E9\u9002\u5408\u5F53\u524D\u4E3B\u5F20\u7684\u6709\u7ADE\u4E89\u529B\u66FF\u4EE3\u65B9\u6848\u3001\u53C2\u8003\u4E0A\u754C\u6216\u516C\u5F00\u7EC4\u4EF6\u7EC4\u5408\u3002\n\n\u516C\u5E73\u6BD4\u8F83\u81F3\u5C11\u5E94\u8BF4\u660E\u4EE5\u4E0B\u6761\u4EF6\uFF0C\u5E76\u6839\u636E\u6BD4\u8F83\u95EE\u9898\u9009\u62E9\u5BF9\u9F50\u3001\u5206\u5C42\u62A5\u544A\u6216\u8FDB\u884C\u6210\u672C\u2014\u6027\u80FD\u5206\u6790\uFF1A\n\n- \u6570\u636E\u548C\u5212\u5206\uFF1B\n- \u8F93\u5165\u4FE1\u606F\uFF1B\n- \u76D1\u7763\u4FE1\u606F\uFF1B\n- \u6A21\u578B\u6216\u8BA1\u7B97\u9884\u7B97\uFF1B\n- \u8BAD\u7EC3\u548C\u63A8\u7406\u6B21\u6570\uFF1B\n- \u540E\u5904\u7406\u6761\u4EF6\uFF1B\n- \u8BC4\u4EF7\u534F\u8BAE\uFF1B\n- \u5931\u8D25\u6837\u672C\u7684\u8BB0\u8D26\u65B9\u5F0F\u3002\n\n\u516C\u5E73\u4E0D\u603B\u7B49\u4E8E\u6240\u6709\u9884\u7B97\u5B8C\u5168\u76F8\u540C\uFF0C\u800C\u662F\u6BD4\u8F83\u6761\u4EF6\u5FC5\u987B\u56DE\u7B54\u9884\u5148\u58F0\u660E\u7684\u95EE\u9898\u3002\u82E5\u7814\u7A76\u76EE\u6807\u672C\u6765\u5C31\u662F\u5229\u7528\u66F4\u591A\u6570\u636E\u3001\u4FE1\u606F\u3001\u53C2\u6570\u6216\u8BA1\u7B97\uFF0C\u5E94\u540C\u65F6\u62A5\u544A\u8D44\u6E90\u5DEE\u5F02\u3001\u6210\u672C\u2014\u6027\u80FD\u5173\u7CFB\uFF0C\u5E76\u5C3D\u53EF\u80FD\u52A0\u5165\u5339\u914D\u9884\u7B97\u6216\u5339\u914D\u4FE1\u606F\u7684\u5BF9\u7167\u3002\u4E0D\u80FD\u9690\u85CF\u989D\u5916\u8D44\u6E90\u540E\u628A\u4F18\u52BF\u5F52\u56E0\u7ED9\u6838\u5FC3\u673A\u5236\u3002\n\n## 19. \u8BC1\u636E\u5F3A\u5EA6\u53D6\u51B3\u4E8E\u5B83\u8981\u652F\u6301\u7684\u4E3B\u5F20\n\n\u4E0D\u540C\u8BC1\u636E\u56DE\u7B54\u4E0D\u540C\u95EE\u9898\uFF0C\u4E0D\u80FD\u7528\u4E00\u6761\u5168\u5C40\u6392\u5E8F\u66FF\u4EE3\u4E3B\u5F20\u5339\u914D\uFF1A\n\n- **\u5F62\u5F0F\u8BC1\u660E\u3001\u4E25\u8C28\u63A8\u5BFC\u548C\u53EF\u9A8C\u8BC1\u53CD\u4F8B**\u6700\u76F4\u63A5\u652F\u6301\u76F8\u5E94\u7684\u7406\u8BBA\u4E3B\u5F20\uFF0C\u4F46\u4E0D\u80FD\u81EA\u52A8\u8BC1\u660E\u7ECF\u9A8C\u7CFB\u7EDF\u5728\u771F\u5B9E\u5206\u5E03\u4E0A\u7684\u6548\u679C\uFF1B\n- **\u771F\u5B9E\u4EFB\u52A1\u7684\u7AEF\u5230\u7AEF\u6700\u7EC8\u7ED3\u679C**\u6700\u76F4\u63A5\u652F\u6301\u201C\u7CFB\u7EDF\u662F\u5426\u6709\u7528\u3001\u662F\u5426\u8FBE\u5230\u4E1A\u52A1\u6216\u4EFB\u52A1\u76EE\u6807\u201D\uFF1B\n- **\u673A\u5236\u6027\u5BF9\u7167\u3001\u53CD\u4E8B\u5B9E\u5B9E\u9A8C\u548C\u4E25\u683C\u8D1F\u63A7\u5236**\u6700\u76F4\u63A5\u652F\u6301\u201C\u63D0\u5347\u662F\u5426\u6765\u81EA\u6240\u58F0\u79F0\u7684\u673A\u5236\u201D\uFF1B\n- **\u4E2D\u95F4\u8868\u793A\u3001\u68AF\u5EA6\u3001\u7279\u5F81\u3001\u6392\u5E8F\u6216\u8BAD\u7EC3\u8BCA\u65AD**\u652F\u6301\u5B66\u4E60\u8FC7\u7A0B\u3001\u6545\u969C\u5B9A\u4F4D\u548C\u5C40\u90E8\u673A\u5236\u89E3\u91CA\uFF1B\n- **\u4EE3\u7801\u3001\u5355\u5143\u6D4B\u8BD5\u3001\u5408\u540C\u6D4B\u8BD5\u548C\u6D41\u7A0B\u65E5\u5FD7**\u652F\u6301\u5B9E\u73B0\u6B63\u786E\u6027\u3001\u53EF\u91CD\u590D\u8FD0\u884C\u548C\u6545\u969C\u53EF\u89C1\u6027\uFF1B\n- **\u6848\u4F8B\u548C\u5B9A\u6027\u89C2\u5BDF**\u5E2E\u52A9\u89E3\u91CA\u73B0\u8C61\uFF0C\u4F46\u9664\u975E\u534F\u8BAE\u660E\u786E\u4E14\u6837\u672C\u5177\u6709\u4EE3\u8868\u6027\uFF0C\u901A\u5E38\u4E0D\u80FD\u72EC\u7ACB\u652F\u6491\u603B\u4F53\u7ED3\u8BBA\u3002\n\n\u8BAD\u7EC3\u635F\u5931\u4E0B\u964D\u3001\u68AF\u5EA6\u6B63\u5E38\u3001\u9690\u85CF\u72B6\u6001\u53D8\u5316\u3001\u4EE3\u7406\u5206\u6570\u63D0\u9AD8\u3001\u4EE3\u7801\u94FE\u8DEF\u53EF\u8FD0\u884C\u6216\u5C11\u91CF\u6F02\u4EAE\u6848\u4F8B\uFF0C\u53EA\u80FD\u8BC1\u660E\u4E0E\u5176\u5BF9\u5E94\u7684\u5C40\u90E8\u4E8B\u5B9E\uFF0C\u4E0D\u80FD\u66FF\u4EE3\u6700\u7EC8\u4EFB\u52A1\u80FD\u529B\uFF1B\u540C\u6837\uFF0C\u7AEF\u5230\u7AEF\u5206\u6570\u63D0\u9AD8\u4E5F\u4E0D\u80FD\u5355\u72EC\u8BC1\u660E\u5177\u4F53\u56E0\u679C\u673A\u5236\u3002\n\n## 20. \u5E94\u540C\u65F6\u533A\u5206\u201C\u80FD\u7528\u201D\u548C\u201C\u505A\u5BF9\u201D\n\n\u5BF9\u4E8E\u751F\u6210\u3001\u7F16\u8F91\u3001\u51B3\u7B56\u548C\u7ED3\u6784\u5316\u8F93\u51FA\u4EFB\u52A1\uFF0C\u5E94\u6309\u4EFB\u52A1\u5B9E\u9645\u76F8\u5173\u6027\u533A\u5206\u4EE5\u4E0B\u7EF4\u5EA6\uFF1B\u4E0D\u9002\u7528\u7684\u7EF4\u5EA6\u4E0D\u5FC5\u673A\u68B0\u8BC4\u4EF7\uFF1A\n\n- **\u53EF\u884C\u6027**\uFF1A\u662F\u5426\u5408\u6CD5\u3001\u5B8C\u6574\u3001\u53EF\u89E3\u6790\u3001\u53EF\u6267\u884C\uFF1B\n- **\u76EE\u6807\u6B63\u786E\u6027**\uFF1A\u662F\u5426\u771F\u6B63\u6EE1\u8DB3\u4EFB\u52A1\u6216\u7528\u6237\u610F\u56FE\uFF1B\n- **\u65B9\u5411\u4E0E\u5E45\u5EA6**\uFF1A\u53D8\u5316\u662F\u5426\u65B9\u5411\u6B63\u786E\u4E14\u8DB3\u591F\u660E\u663E\uFF1B\n- **\u5C40\u90E8\u6027**\uFF1A\u662F\u5426\u53EA\u5F71\u54CD\u5E94\u8BE5\u5F71\u54CD\u7684\u90E8\u5206\uFF1B\n- **\u65C1\u8DEF\u635F\u4F24**\uFF1A\u975E\u76EE\u6807\u90E8\u5206\u662F\u5426\u88AB\u7834\u574F\uFF1B\n- **\u7ED3\u6784\u4FDD\u6301**\uFF1A\u4E0D\u8981\u6C42\u6539\u53D8\u7684\u7EA6\u675F\u662F\u5426\u7A33\u5B9A\uFF1B\n- **\u771F\u5B9E\u4E0B\u6E38\u6548\u679C**\uFF1A\u6700\u7EC8\u89C6\u89C9\u3001\u7269\u7406\u3001\u4E1A\u52A1\u6216\u7528\u6237\u7ED3\u679C\u662F\u5426\u6210\u7ACB\u3002\n\n\u201C\u6CA1\u6709\u574F\u6389\u201D\u4E0D\u7B49\u4E8E\u201C\u5B8C\u6210\u4E86\u76EE\u6807\u201D\u3002\u4EC5\u9A8C\u8BC1\u683C\u5F0F\u3001\u53EF\u8FD0\u884C\u6027\u6216\u4E2D\u95F4\u91CF\u53D8\u5316\uFF0C\u4E0D\u80FD\u66FF\u4EE3\u5B83\u4EEC\u672A\u8986\u76D6\u7684\u6700\u7EC8\u6548\u679C\u8BC4\u4EF7\uFF1B\u5B9E\u9645\u8986\u76D6\u4EFB\u52A1\u76EE\u6807\u7684\u81EA\u52A8\u8BC4\u4EF7\uFF0C\u53EF\u4EE5\u652F\u6491\u5BF9\u5E94\u4E3B\u5F20\u3002\u4E0D\u56E0\u4E3A\u8BC4\u4EF7\u662F\u81EA\u52A8\u5B8C\u6210\u7684\uFF0C\u5C31\u53E6\u52A0\u4EBA\u5DE5\u5BA1\u6838\u6216\u91CD\u590D\u9A8C\u6536\uFF1B\u4EBA\u5DE5\u5BA1\u6838\u6309\u7B2C 23 \u8282\u7684\u65E2\u5B9A\u8303\u56F4\u5904\u7406\u3002\n\n## 21. \u5B9E\u9A8C\u5E94\u4E3B\u52A8\u6392\u9664\u66FF\u4EE3\u89E3\u91CA\n\n\u56F4\u7ED5\u5F53\u524D\u4E3B\u5F20\uFF0C\u9009\u62E9\u6700\u53EF\u80FD\u6539\u53D8\u5224\u65AD\u7684\u66FF\u4EE3\u89E3\u91CA\u5E76\u636E\u6B64\u8BBE\u8BA1\u5BF9\u7167\u3002\u4EE5\u4E0B\u662F\u5019\u9009\u95EE\u9898\uFF0C\u4E0D\u8981\u6C42\u4E00\u6B21\u5B9E\u9A8C\u6216\u4E00\u4E2A\u9879\u76EE\u7A77\u5C3D\u5168\u90E8\u89E3\u91CA\uFF1A\n\n- \u8868\u793A\u80FD\u529B\u4E0D\u8DB3\uFF1B\n- \u6570\u636E\u6216\u76D1\u7763\u8986\u76D6\u4E0D\u8DB3\uFF1B\n- \u8F93\u51FA\u7A7A\u95F4\u6216\u5019\u9009\u7A7A\u95F4\u4E0D\u53EF\u8FBE\uFF1B\n- \u8BC4\u5206\u5668\u3001\u6A21\u62DF\u5668\u6216\u8BC4\u4EF7\u5668\u9519\u8BEF\uFF1B\n- \u4F18\u5316\u5931\u8D25\uFF1B\n- \u6A21\u578B\u5BB9\u91CF\u4E0D\u8DB3\uFF1B\n- \u6761\u4EF6\u8F93\u5165\u672A\u88AB\u771F\u6B63\u4F7F\u7528\uFF1B\n- \u7ED3\u679C\u6765\u81EA\u989D\u5916\u4FE1\u606F\u3001\u66F4\u591A\u6570\u636E\u6216\u66F4\u591A\u8BA1\u7B97\uFF1B\n- \u4EFB\u52A1\u76EE\u6807\u672C\u8EAB\u5B9A\u4E49\u4E0D\u5408\u7406\u3002\n\n\u6839\u636E\u5F53\u524D\u4E3B\u5F20\u4F18\u5148\u4F7F\u7528\uFF1A\n\n- \u771F\u6B63\u7834\u574F\u5173\u952E\u5173\u7CFB\u7684\u968F\u673A\u3001\u6253\u4E71\u6216\u9519\u8BEF\u914D\u5BF9\u8D1F\u63A7\u5236\uFF1B\n- \u7406\u60F3\u4E0A\u754C\u548C\u53C2\u8003\u4E0B\u754C\uFF1B\n- \u540C\u4E00\u6837\u672C\u4E0A\u7684\u6210\u5BF9\u6BD4\u8F83\uFF1B\n- \u5728\u53EF\u6BD4\u65F6\u4FDD\u6301\u53C2\u6570\u91CF\u548C\u8BA1\u7B97\u91CF\u7684\u7B80\u5355\u66FF\u4EE3\uFF1B\n- \u5F53\u4E3B\u5F20\u6D89\u53CA\u901A\u7528\u6027\u65F6\u8FDB\u884C\u8DE8\u7C7B\u522B\u3001\u8DE8\u6570\u636E\u57DF\u6216\u8DE8\u9AA8\u5E72\u9A8C\u8BC1\uFF1B\n- \u6309\u9884\u5148\u5B9A\u4E49\u6837\u672C\u53E3\u5F84\u8BA1\u5165\u5931\u8D25\u7684\u8BC4\u4EF7\u3002\n\n\u5F53\u4E3B\u5F20\u6D89\u53CA\u56E0\u679C\u673A\u5236\u65F6\uFF0C\u53EA\u7EDF\u8BA1\u201C\u53C8\u591A\u4E86\u51E0\u4E2A\u6210\u529F\u6216\u5931\u8D25\u201D\u800C\u65E0\u6CD5\u6392\u9664\u66FF\u4EE3\u89E3\u91CA\uFF0C\u4E0D\u8DB3\u4EE5\u6210\u4E3A\u4E3B\u8981\u673A\u5236\u8BC1\u636E\u3002\u82E5\u4E3B\u5F20\u53EA\u662F\u6BD4\u8F83\u771F\u5B9E\u4EFB\u52A1\u6548\u7528\uFF0C\u4E25\u683C\u5B9A\u4E49\u7684\u6210\u529F\u7387\u3001\u5931\u8D25\u7387\u6216\u7AEF\u5230\u7AEF\u7ED3\u679C\u672C\u8EAB\u53EF\u4EE5\u662F\u4E3B\u8981\u8BC1\u636E\uFF0C\u4F46\u4E0D\u80FD\u636E\u6B64\u989D\u5916\u58F0\u79F0\u5177\u4F53\u673A\u5236\u6210\u7ACB\u3002\n\n## 22. \u72EC\u7ACB\u786E\u8BA4\u4E0E\u6700\u7EC8\u6D4B\u8BD5\u6309\u56FA\u5B9A\u534F\u8BAE\u8BC4\u4EF7\uFF0C\u4E0D\u7528\u6700\u7EC8\u6D4B\u8BD5\u53CD\u9988\u8C03\u8BD5\n\n\u5BF9\u627F\u62C5\u72EC\u7ACB\u786E\u8BA4\u6216\u6700\u7EC8\u8BC4\u4EF7\u4F5C\u7528\u7684\u5B9E\u9A8C\uFF0C\u4E0D\u80FD\u6839\u636E\u672C\u8F6E\u6D4B\u8BD5\u7ED3\u679C\u4E34\u65F6\u8C03\u6574\u4EE5\u4E0B\u6761\u4EF6\u540E\uFF0C\u4ECD\u628A\u7ED3\u679C\u58F0\u79F0\u4E3A\u539F\u534F\u8BAE\u4E0B\u672A\u53D7\u53CD\u9988\u5F71\u54CD\u7684\u8BC4\u4EF7\uFF1A\n\n- \u63D0\u793A\u8BCD\uFF1B\n- \u91C7\u6837\u7B56\u7565\uFF1B\n- \u9608\u503C\uFF1B\n- \u6570\u636E\u8FC7\u6EE4\uFF1B\n- \u5019\u9009\u751F\u6210\uFF1B\n- \u8BC4\u5206\u4E0E\u590D\u6838\u89C4\u5219\uFF1B\n- \u540E\u5904\u7406\uFF1B\n- \u53EF\u89C6\u5316\u9009\u62E9\u6807\u51C6\u3002\n\n\u4EFB\u4F55\u540E\u7EED\u4FEE\u6539\u90FD\u5E94\u89C6\u4E3A\u65B0\u7684\u5F00\u53D1\u7248\u672C\u3001\u8BCA\u65AD\u5B9E\u9A8C\u6216\u65B0\u534F\u8BAE\uFF0C\u4E0D\u80FD\u6DF7\u5165\u539F\u51BB\u7ED3\u7ED3\u679C\u3002\u9884\u5148\u58F0\u660E\u7684\u81EA\u9002\u5E94\u91C7\u6837\u3001\u5E8F\u8D2F\u68C0\u9A8C\u6216\u505C\u6B62\u89C4\u5219\u53EF\u4EE5\u5C5E\u4E8E\u51BB\u7ED3\u534F\u8BAE\u7684\u4E00\u90E8\u5206\uFF1B\u201C\u51BB\u7ED3\u201D\u4E0D\u662F\u7981\u6B62\u6240\u6709\u81EA\u9002\u5E94\u65B9\u6CD5\uFF0C\u800C\u662F\u7981\u6B62\u6839\u636E\u672A\u9884\u5148\u89C4\u5B9A\u7684\u7ED3\u679C\u53CD\u9988\u4E34\u65F6\u6539\u89C4\u5219\u3002\u8FD9\u91CC\u7684\u51BB\u7ED3\u662F\u5B9E\u9A8C\u65B9\u6CD5\u4E0A\u7684\u7EA6\u675F\uFF0C\u901A\u5E38\u901A\u8FC7\u73B0\u6709\u914D\u7F6E\u3001\u4EE3\u7801\u7248\u672C\u4E0E\u7ED3\u679C\u8BB0\u5F55\u843D\u5B9E\u3002\n\n\u8BAD\u7EC3\u96C6\u3001\u5F00\u53D1\u96C6\u3001\u786E\u8BA4\u96C6\u548C\u6700\u7EC8\u6D4B\u8BD5\u96C6\u5E94\u6309\u4EFB\u52A1\u9700\u8981\u5EFA\u7ACB\u660E\u786E\u8FB9\u754C\u3002\u591A\u6B21\u67E5\u770B\u6D4B\u8BD5\u7ED3\u679C\u540E\u7EE7\u7EED\u8C03\u7CFB\u7EDF\uFF0C\u4F1A\u4F7F\u8BE5\u6D4B\u8BD5\u96C6\u5B9E\u9645\u53D8\u6210\u5F00\u53D1\u96C6\uFF1B\u82E5\u516C\u5F00\u699C\u5355\u6216\u5916\u90E8\u53CD\u9988\u4E0D\u53EF\u907F\u514D\uFF0C\u5E94\u627F\u8BA4\u8FD9\u4E00\u4E8B\u5B9E\uFF0C\u5E76\u4F7F\u7528\u65B0\u7684\u4FDD\u7559\u96C6\u3001\u65F6\u95F4\u5207\u5206\u6216\u72EC\u7ACB\u590D\u6838\u4F5C\u4E3A\u6700\u7EC8\u8BC1\u636E\u3002\n\n## 23. \u5931\u8D25\u8BB0\u8D26\u4E0E\u8BC1\u636E\u7559\u5B58\u5E94\u771F\u5B9E\uFF0C\u4E0D\u9ED8\u8BA4\u8BBE\u8BA1\u4EBA\u5DE5\u5BA1\u6838\n\n\u6B63\u5F0F\u5B9E\u9A8C\u5E94\u4FDD\u7559\u8DB3\u4EE5\u590D\u6838\u4E3B\u8981\u7ED3\u8BBA\u3001\u5931\u8D25\u7EDF\u8BA1\u548C\u5173\u952E\u8FD0\u884C\u6761\u4EF6\u7684\u8BB0\u5F55\uFF0C\u800C\u4E0D\u53EA\u7559\u4E0B\u6700\u7EC8\u5E73\u5747\u5206\u3002\u4EE5\u4E0B\u5185\u5BB9\u6309\u5F53\u524D\u534F\u8BAE\u548C\u590D\u73B0\u9700\u8981\u9009\u62E9\uFF0C\u4E0D\u8981\u6C42\u5168\u90E8\u4FDD\u5B58\uFF1B\u53D7\u5B58\u50A8\u6216\u660E\u786E\u7684\u6570\u636E\u4F7F\u7528\u9650\u5236\u5F71\u54CD\u65F6\uFF0C\u4FDD\u7559\u5FC5\u8981\u8BB0\u5F55\u5E76\u8BF4\u660E\u91CD\u8981\u7F3A\u5931\uFF1A\n\n- \u8F93\u5165\u548C\u914D\u7F6E\uFF1B\n- \u6A21\u578B\u539F\u59CB\u8F93\u51FA\uFF1B\n- \u89E3\u6790\u7ED3\u679C\uFF1B\n- \u4E2D\u95F4\u5019\u9009\uFF1B\n- \u8BC4\u5206\u3001\u63A5\u53D7\u548C\u62D2\u7EDD\u539F\u56E0\uFF1B\n- \u6700\u7EC8\u8F93\u51FA\uFF1B\n- \u65E5\u5FD7\u3001\u7248\u672C\u548C\u968F\u673A\u79CD\u5B50\uFF1B\n- \u53EF\u89C6\u5316\u548C\u6E32\u67D3\u7ED3\u679C\uFF1B\n- \u65E2\u5B9A\u534F\u8BAE\u5305\u542B\u4EBA\u5DE5\u5BA1\u6838\u65F6\u7684\u76F8\u5173\u8BB0\u5F55\uFF1B\n- \u5916\u90E8\u6A21\u578B\u3001\u6570\u636E\u548C\u5DE5\u5177\u7684\u6765\u6E90\u4FE1\u606F\u3002\n\n\u9884\u5B9A\u8BC4\u4EF7\u6837\u672C\u90FD\u5E94\u4EA4\u4EE3\u53BB\u5411\uFF0C\u6309\u4E00\u81F4\u534F\u8BAE\u5904\u7406\u65B9\u6CD5\u8F93\u51FA\u5931\u8D25\u3001\u57FA\u7840\u8BBE\u65BD\u4E2D\u65AD\u3001\u91CD\u8DD1\u4E0E\u672A\u5B8C\u6210\u8BC4\u4EF7\uFF0C\u4E0D\u80FD\u9759\u9ED8\u5220\u9664\u5931\u8D25\u540E\u53EA\u62A5\u544A\u6210\u529F\u5B50\u96C6\u3002\u65E0\u6CD5\u89E3\u6790\u3001\u7ED3\u6784\u975E\u6CD5\u3001\u7A7A\u8F93\u51FA\uFF0C\u4EE5\u53CA\u65E2\u5B9A\u534F\u8BAE\u4E2D\u7684\u4EBA\u5DE5\u5BA1\u6838\u4E0D\u901A\u8FC7\uFF0C\u6309\u8BC4\u4EF7\u76EE\u6807\u8BB0\u5165\u76F8\u5E94\u7ED3\u679C\uFF1B\u8D85\u65F6\u3001\u6A21\u62DF\u4E2D\u65AD\u7B49\u5E94\u533A\u5206\u65B9\u6CD5\u672A\u8FBE\u5230\u8981\u6C42\u4E0E\u8FD0\u884C\u672A\u5B8C\u6210\uFF0C\u662F\u5426\u8BA1\u5165\u540C\u4E00\u6307\u6807\u7531\u5B9E\u9645\u8BC4\u4EF7\u76EE\u6807\u548C\u534F\u8BAE\u51B3\u5B9A\uFF0C\u4E0D\u80FD\u672A\u7ECF\u5B9A\u4E49\u5C31\u5C06\u6240\u6709\u4E2D\u65AD\u7B97\u4F5C\u6A21\u578B\u5931\u8D25\uFF0C\u4E5F\u4E0D\u80FD\u628A\u4E2D\u65AD\u6837\u672C\u5F53\u4F5C\u6210\u529F\u3002\n\n\u786E\u5C5E\u4EFB\u52A1\u8303\u56F4\u5916\u3001\u6570\u636E\u635F\u574F\u6216\u534F\u8BAE\u89C4\u5B9A\u53EF\u6392\u9664\u7684\u6837\u672C\uFF0C\u6309\u9884\u5148\u89C4\u5219\u6216\u72EC\u7ACB\u4E8E\u7ED3\u679C\u7684\u6807\u51C6\u5904\u7406\uFF0C\u5E76\u62A5\u544A\u6392\u9664\u6570\u91CF\u4E0E\u539F\u56E0\u3002\u8BB0\u5F55\u8DB3\u4EE5\u8BF4\u660E\u7ED3\u679C\u7684\u5FC5\u8981\u539F\u56E0\u5373\u53EF\uFF0C\u4E0D\u53E6\u5EFA\u5F02\u5E38\u5206\u7C7B\u5E73\u53F0\u3002\n\n**\u4E00\u822C\u4E0D\u64C5\u81EA\u8BBE\u8BA1\u4EBA\u5DE5\u5BA1\u6838\u76F8\u5173\u5B9E\u9A8C\u3002** \u53EA\u6709\u7528\u6237\u660E\u786E\u8981\u6C42\u6216\u65E2\u5B9A\u4EFB\u52A1\u534F\u8BAE\u5DF2\u5305\u542B\u65F6\uFF0C\u624D\u5B89\u6392\u76F8\u5E94\u7684\u4EBA\u5DE5\u5BA1\u6838\u3001\u4EBA\u5DE5\u6253\u5206\u6216\u4E13\u5BB6\u8BC4\u5BA1\uFF1B\u4E0D\u56E0\u201C\u66F4\u53EF\u4FE1\u201D\u201C\u66F4\u5B8C\u6574\u201D\u800C\u65B0\u589E\u4EBA\u5BA1\u73AF\u8282\uFF0C\u4E5F\u4E0D\u628A\u5B83\u4F5C\u4E3A\u666E\u901A\u5B9E\u9A8C\u6216\u4EA4\u4ED8\u5B8C\u6210\u7684\u9ED8\u8BA4\u524D\u7F6E\u6761\u4EF6\u3002\u786E\u5DF2\u5305\u542B\u4EBA\u5DE5\u5BA1\u6838\u65F6\uFF0C\u6807\u4E3A\u4EBA\u5DE5\u5BA1\u6838\u7684\u7ED3\u679C\u5FC5\u987B\u7ECF\u8FC7\u771F\u5B9E\u4EBA\u5DE5\u67E5\u770B\uFF0C\u4E0D\u80FD\u7528\u81EA\u52A8\u5224\u5B9A\u6216\u81EA\u52A8\u9884\u586B\u5192\u5145\u3002\n\n\u666E\u901A\u914D\u7F6E\u3001\u7ED3\u679C\u8868\u548C\u5FC5\u8981\u65E5\u5FD7\u8DB3\u591F\u652F\u6301\u5F53\u524D\u7ED3\u8BBA\u65F6\uFF0C\u5230\u6B64\u4E3A\u6B62\u3002\u8BC1\u636E\u7559\u5B58\u4E0D\u81EA\u52A8\u63A8\u51FA\u8BA4\u8BC1\u6216\u5BA1\u8BA1\u4F53\u7CFB\uFF0C\u76F8\u5173\u5B9E\u73B0\u6309\u7B2C 2\u300135 \u8282\u7684\u5177\u4F53\u4F9D\u636E\u53D6\u820D\u3002\n\n# \u56DB\u3001\u5DE5\u7A0B\u5B9E\u73B0\u4E0E\u8D28\u91CF\u63A7\u5236\n\n## 24. \u6309\u672C\u6B21\u4EA4\u4ED8\u76EE\u6807\u9A8C\u6536\uFF0C\u4E0D\u5938\u5927\u9A8C\u8BC1\u8303\u56F4\n\n\u5DE5\u7A0B\u9A8C\u6536\u76F4\u63A5\u68C0\u9A8C\u672C\u6B21\u4EA4\u4ED8\u662F\u5426\u5728\u6240\u9700\u4F7F\u7528\u6761\u4EF6\u4E0B\u8FBE\u5230\u76EE\u6807\u3002\u5C40\u90E8\u4FEE\u590D\u82E5\u5DF2\u7531\u76F8\u5173\u9A8C\u8BC1\u8986\u76D6\u5176\u76EE\u6807\u4E0E\u5F71\u54CD\u8303\u56F4\uFF0C\u53EF\u4EE5\u5B8C\u6210\uFF1B\u4E0D\u80FD\u56E0\u6B64\u58F0\u79F0\u672A\u8986\u76D6\u7684\u6574\u4F53\u80FD\u529B\u4E5F\u5DF2\u901A\u8FC7\uFF0C\u4E5F\u4E0D\u5FC5\u8FD0\u884C\u4E0E\u6539\u52A8\u65E0\u5173\u7684\u5B8C\u6574\u7814\u7A76\u6D41\u7A0B\u3002\u4EE3\u7801\u5DF2\u5B9E\u73B0\u3001\u5C40\u90E8\u6D4B\u8BD5\u901A\u8FC7\u6216\u6210\u529F\u5BFC\u51FA\u6587\u4EF6\uFF0C\u662F\u5426\u8DB3\u4EE5\u9A8C\u6536\u53D6\u51B3\u4E8E\u5B83\u4EEC\u5B9E\u9645\u8986\u76D6\u4E86\u4EC0\u4E48\uFF0C\u4E0D\u80FD\u6309\u9A8C\u8BC1\u540D\u79F0\u51B3\u5B9A\u3002\u5B8C\u6210\u8303\u56F4\u7EDF\u4E00\u6309\u7B2C 5 \u8282\u5224\u65AD\u3002\n\n\u201C\u751F\u4EA7\u5C31\u7EEA\u201D\u53EA\u7528\u4E8E\u786E\u5B9E\u9762\u5411\u751F\u4EA7\u3001\u4E14\u5DF2\u6EE1\u8DB3\u8BE5\u9879\u76EE\u5177\u4F53\u4E0A\u7EBF\u6807\u51C6\u7684\u4EFB\u52A1\uFF1B\u79D1\u7814\u5B9E\u9A8C\u3001\u5185\u90E8\u5DE5\u5177\u548C\u4E00\u6B21\u6027\u4EA4\u4ED8\u4E0D\u5FC5\u5148\u8865\u6210\u751F\u4EA7\u7CFB\u7EDF\u3002\u9A8C\u8BC1\u65B9\u6CD5\u6309\u7B2C 32 \u8282\u9009\u62E9\uFF0C\u7ED3\u679C\u72B6\u6001\u6309\u7B2C 49 \u8282\u7B80\u6D01\u62A5\u544A\uFF0C\u4E0D\u4E3A\u5206\u5C42\u6C47\u62A5\u53E6\u5EFA\u72B6\u6001\u673A\u6216\u8BB0\u5F55\u4F53\u7CFB\u3002\n\n## 25. \u4F9D\u636E\u5DF2\u6709\u8BC1\u636E\u5C3D\u5FEB\u4FEE\u590D\u771F\u5B9E\u95EE\u9898\n\n\u4EFB\u52A1\u5305\u542B\u4FEE\u590D\u65F6\uFF0C\u5355\u4E2A\u53EF\u9760\u590D\u73B0\u5DF2\u7ECF\u8DB3\u4EE5\u5B9A\u4F4D\u95EE\u9898\uFF0C\u5C31\u76F4\u63A5\u4FEE\u590D\u5E76\u9A8C\u8BC1\u76F8\u5173\u5F71\u54CD\u3002\u591A\u4E2A\u5931\u8D25\u660E\u663E\u5171\u4EAB\u6839\u56E0\uFF0C\u6216\u53CD\u590D\u91CD\u8DD1\u6210\u672C\u5F88\u9AD8\u65F6\uFF0C\u518D\u4F18\u5148\u6309\u8D23\u4EFB\u6A21\u5757\u3001\u6570\u636E\u6D41\u3001\u8F93\u5165\u6761\u4EF6\u6216\u5931\u8D25\u8868\u73B0\u5F52\u7C7B\uFF1B\u4E0D\u8981\u6C42\u5148\u5F62\u6210\u5B8C\u6574\u6216\u4EE3\u8868\u6027\u5931\u8D25\u96C6\u5408\uFF0C\u624D\u5141\u8BB8\u4FEE\u6539\u6838\u5FC3\u5B9E\u73B0\u3002\n\n\u4F18\u5148\u4FEE\u590D\u80FD\u591F\u89E3\u91CA\u5F53\u524D\u95EE\u9898\u7684\u771F\u5B9E\u6839\u56E0\u3002\u5171\u4EAB\u95EE\u9898\u5728\u76F8\u5E94\u8D23\u4EFB\u6A21\u5757\u5904\u7406\uFF0C\u5F7C\u6B64\u72EC\u7ACB\u7684\u6545\u969C\u5206\u522B\u89E3\u51B3\uFF0C\u4E0D\u4E3A\u4E86\u7EDF\u4E00\u89E3\u91CA\u5F3A\u884C\u5408\u5E76\u3002\u9A8C\u8BC1\u4E0E\u4FEE\u6539\u4EA4\u66FF\u63A8\u8FDB\uFF0C\u5DF2\u6709\u4FE1\u606F\u8DB3\u4EE5\u6307\u5BFC\u4FEE\u590D\u65F6\uFF0C\u4E0D\u7EE7\u7EED\u6536\u96C6\u540C\u7C7B\u4F4E\u589E\u91CF\u8BCA\u65AD\u3002\n\n\u4FEE\u590D\u5E94\u6EE1\u8DB3\u672C\u6B21\u4EFB\u52A1\u4E0E\u76F8\u5173\u8F93\u5165\u6761\u4EF6\uFF0C\u4E0D\u9760\u6837\u672C\u7279\u5224\u4F2A\u88C5\u901A\u7528\u80FD\u529B\u3002\u771F\u5B9E\u5931\u8D25\u6837\u672C\u548C\u5FC5\u8981\u914D\u7F6E\u53EF\u4EE5\u76F4\u63A5\u7528\u4E8E\u590D\u73B0\u6216\u56DE\u5F52\uFF1B\u9650\u5B9A\u7528\u9014\u7684\u5E38\u91CF\u4E0E\u89C4\u5219\u6309\u7B2C 30 \u8282\u5224\u65AD\uFF0C\u9A8C\u8BC1\u8303\u56F4\u6309\u7B2C 31\u300132 \u8282\u9009\u62E9\u3002\n\n\u7528\u6237\u8981\u6C42\u4FEE\u590D\u65F6\uFF0C\u5B9A\u4F4D\u540E\u7EE7\u7EED\u5B8C\u6210\u76F8\u5E94\u6539\u52A8\uFF1B\u7528\u6237\u53EA\u8981\u6C42\u5BA1\u67E5\u6216\u5B9A\u4F4D\u65F6\uFF0C\u4EA4\u4ED8\u53D1\u73B0\u3001\u4F9D\u636E\u4E0E\u5EFA\u8BAE\u5373\u53EF\uFF0C\u4E0D\u64C5\u81EA\u628A\u5BA1\u67E5\u6269\u5C55\u4E3A\u4FEE\u6539\u3002\n\n## 26. \u5728\u5B9E\u9645\u8BED\u4E49\u51B2\u7A81\u5904\u660E\u786E\u6765\u6E90\u4E0E\u4F18\u5148\u7EA7\n\n\u8DE8\u6A21\u5757\u91CD\u590D\u5B9A\u4E49\u3001\u914D\u7F6E\u8986\u76D6\u6216\u6D3E\u751F\u6570\u636E\u51B2\u7A81\u53EF\u80FD\u5F71\u54CD\u7ED3\u679C\u65F6\uFF0C\u5E94\u660E\u786E\u76F8\u5E94\u8BED\u4E49\u3001\u6765\u6E90\u4E0E\u53D6\u503C\u4F18\u5148\u7EA7\u3002\u73B0\u6709\u53C2\u6570\u3001\u51FD\u6570\u8FD4\u56DE\u503C\u548C\u76F4\u63A5\u7EA6\u5B9A\u5DF2\u7ECF\u6E05\u695A\u65F6\u5373\u53EF\uFF0C\u4E0D\u4E3A\u6BCF\u4E2A\u53D8\u91CF\u6216\u666E\u901A\u914D\u7F6E\u589E\u52A0\u6240\u6709\u8005\u5B57\u6BB5\u3001\u6CE8\u518C\u8868\u6216\u8FFD\u8E2A\u673A\u5236\u3002\n\n\u7F13\u5B58\u3001\u7D22\u5F15\u3001\u6D3E\u751F\u89C6\u56FE\u3001\u5E8F\u5217\u5316\u526F\u672C\u548C\u8DE8\u670D\u52A1\u8868\u793A\u53EF\u4EE5\u5B58\u5728\uFF1B\u5728\u5B9E\u9645\u76F8\u5173\u7684\u4F7F\u7528\u8FB9\u754C\u8BF4\u660E\u5B83\u4EEC\u7531\u4EC0\u4E48\u751F\u6210\u3001\u4F55\u65F6\u9700\u8981\u66F4\u65B0\uFF0C\u4EE5\u53CA\u51B2\u7A81\u65F6\u4EE5\u8C01\u4E3A\u51C6\u3002\u4E0D\u540C\u6A21\u5757\u4E0D\u5E94\u5728\u7F3A\u5C11\u7EA6\u5B9A\u65F6\u5404\u81EA\u731C\u6D4B\u540C\u4E00\u8BED\u4E49\u3002\n\n\u9700\u8981\u8D2F\u7A7F\u591A\u4E2A\u5904\u7406\u73AF\u8282\u7684\u8BED\u4E49\u4FDD\u6301\u4E00\u81F4\uFF0C\u4E0D\u8981\u6C42\u5404\u5C42\u4F7F\u7528\u540C\u4E00\u7269\u7406\u6570\u636E\u7ED3\u6784\uFF0C\u4E5F\u4E0D\u8981\u6C42\u4E3A\u4E0B\u5217\u6BCF\u4E2A\u9636\u6BB5\u5355\u72EC\u5EFA\u8BBE\u6A21\u5757\u6216\u9A8C\u8BC1\u5668\uFF1A\n\n```text\n\u8F93\u5165\n\u2192 \u89E3\u6790\n\u2192 \u89C4\u8303\u5316\n\u2192 \u9886\u57DF\u6A21\u578B\n\u2192 \u6267\u884C\n\u2192 \u6301\u4E45\u5316\u6216\u8F93\u51FA\n\u2192 \u9A8C\u8BC1\n\u2192 \u5C55\u793A\n```\n\n\u9A8C\u8BC1\u4E0D\u80FD\u5077\u5077\u91CD\u5199\u88AB\u9A8C\u8BC1\u7684\u6570\u636E\uFF0C\u5C55\u793A\u4E0D\u80FD\u8865\u9020\u7F3A\u5931\u8BED\u4E49\u3002\u6B63\u5F0F\u7EA6\u5B9A\u7684\u89E3\u6790\u3001\u8F6C\u6362\u548C\u89C4\u8303\u5316\u53EF\u4EE5\u5728\u76F8\u5E94\u8D23\u4EFB\u4F4D\u7F6E\u6267\u884C\uFF0C\u6D4B\u8BD5\u7684\u6B63\u786E\u6027\u4F9D\u636E\u6309\u7B2C 31 \u8282\u5904\u7406\u3002\n\n## 27. \u67B6\u6784\u8FC1\u79FB\u5E94\u6709\u660E\u786E\u7EC8\u6001\u5E76\u5B8C\u6210\u5207\u6362\n\n\u53EA\u6709\u5F53\u524D\u76EE\u6807\u786E\u5B9E\u8981\u6C42\u67B6\u6784\u8FC1\u79FB\u65F6\u624D\u542F\u52A8\u8FC1\u79FB\uFF0C\u4E0D\u80FD\u628A\u5C40\u90E8\u4EFB\u52A1\u6269\u5C55\u6210\u65E0\u5173\u91CD\u6784\u3002\u4E00\u65E6\u51B3\u5B9A\u8FC1\u79FB\uFF0C\u5E94\u5148\u5B9A\u4E49\u76EE\u6807\u7EC8\u6001\u3001\u8FC7\u6E21\u671F\u548C\u9000\u51FA\u6761\u4EF6\u3002\u6700\u7EC8\u5185\u90E8\u8FC1\u79FB\u901A\u5E38\u5305\u62EC\uFF1A\n\n- \u5B9A\u4E49\u65B0\u6743\u5A01\u5408\u540C\uFF1B\n- \u66F4\u65B0\u6240\u6709\u751F\u4EA7\u8005\uFF1B\n- \u66F4\u65B0\u6240\u6709\u6D88\u8D39\u8005\uFF1B\n- \u66F4\u65B0\u9A8C\u8BC1\u548C\u6D4B\u8BD5\uFF1B\n- \u5220\u9664\u65E7\u5B9E\u73B0\uFF1B\n- \u5220\u9664\u8FC7\u65F6\u6D4B\u8BD5\u548C\u5939\u5177\uFF1B\n- \u5168\u5C40\u68C0\u67E5\u662F\u5426\u4ECD\u6709\u65E7\u8DEF\u5F84\u5F15\u7528\u3002\n\n\u53EA\u6709\u5B9E\u9645\u8FC1\u79FB\u9700\u8981\u7070\u5EA6\u3001\u6570\u636E\u8F6C\u6362\u6216\u4E0D\u4E2D\u65AD\u5DF2\u6709\u670D\u52A1\u65F6\uFF0C\u624D\u4FDD\u7559\u4E34\u65F6\u53CC\u8DEF\u5F84\u6216\u56DE\u6EDA\u80FD\u529B\uFF0C\u5E76\u8BF4\u660E\u5207\u6362\u5B8C\u6210\u7684\u5224\u636E\u548C\u4F55\u65F6\u5220\u9664\u3002\u7B80\u5355\u5185\u90E8\u8FC1\u79FB\u53EF\u4EE5\u76F4\u63A5\u5207\u6362\uFF0C\u4E0D\u5148\u5EFA\u8BBE\u53D1\u5E03\u3001\u76D1\u63A7\u6216\u56DE\u6EDA\u5E73\u53F0\u3002\u5B8C\u6210\u8FC1\u79FB\u540E\uFF0C\u5220\u9664\u6CA1\u6709\u5B9E\u9645\u7528\u9014\u7684\u5F71\u5B50\u7ED3\u6784\u3001\u91CD\u590D\u914D\u7F6E\u3001\u517C\u5BB9\u5916\u89C2\u5C42\u548C\u65E7\u5B9E\u73B0\u81EA\u52A8\u56DE\u9000\u3002\u53EA\u6709\u5DF2\u77E5\u5B9E\u9645\u6D88\u8D39\u8005\u6216\u672C\u6B21\u4EFB\u52A1\u786E\u5B9E\u4F9D\u8D56\u65E7\u63A5\u53E3\u3001\u683C\u5F0F\u6216\u65E2\u6709\u4EA7\u7269\u65F6\uFF0C\u624D\u4FDD\u7559\u8303\u56F4\u6E05\u695A\u7684\u517C\u5BB9\u6216\u8F6C\u6362\uFF1B\u5224\u65AD\u4F9D\u636E\u662F\u5B9E\u9645\u4F9D\u8D56\uFF0C\u4E0D\u662F\u63A5\u53E3\u662F\u5426\u516C\u5F00\u3002\u4E0D\u80FD\u4EC5\u56E0\u201C\u53EF\u80FD\u6709\u4EBA\u7528\u201D\u6C38\u4E45\u4FDD\u7559\uFF0C\u4E5F\u4E0D\u80FD\u4EC5\u56E0\u63A5\u53E3\u4E0D\u516C\u5F00\u5C31\u5220\u9664\u5FC5\u8981\u80FD\u529B\u3002\n\n## 28. \u4E0D\u5141\u8BB8\u56DE\u9000\u3001\u9ED8\u8BA4\u503C\u548C\u622A\u65AD\u63A9\u76D6\u9519\u8BEF\n\n\u672C\u8282\u53CD\u5BF9\u7684\u662F\u201C\u63A9\u76D6\u9519\u8BEF\u201D\uFF0C\u4E0D\u662F\u6240\u6709\u91CD\u8BD5\u3001\u9ED8\u8BA4\u503C\u3001\u5C40\u90E8\u7EE7\u7EED\u6216\u53D7\u63A7\u964D\u7EA7\u3002\u8BED\u4E49\u6B63\u786E\u3001\u8303\u56F4\u660E\u786E\u4E14\u80FD\u533A\u5206\u5B9E\u9645\u5B8C\u6210\u72B6\u6001\u7684\u9ED8\u8BA4\u884C\u4E3A\u3001\u5FC5\u8981\u91CD\u8BD5\u548C\u6279\u5904\u7406\u4E2D\u5355\u9879\u5931\u8D25\u540E\u7EE7\u7EED\uFF0C\u53EF\u4EE5\u76F4\u63A5\u4F7F\u7528\u3002\u6B63\u5E38\u63A7\u5236\u6D41\u3001\u5DF2\u5B9A\u4E49\u7684\u7B49\u4EF7\u7B56\u7565\u9009\u62E9\u6216\u6B63\u5E38\u7F13\u5B58\u672A\u547D\u4E2D\uFF0C\u4E0D\u5FC5\u9010\u6B21\u62A5\u544A\uFF1B\u707E\u5907\u4E0E\u964D\u7EA7\u670D\u52A1\u53EA\u5728\u786E\u6709\u9700\u6C42\u65F6\u5B9E\u73B0\uFF0C\u4E0D\u4F5C\u4E3A\u9ED8\u8BA4\u4FDD\u969C\u3002\n\n\u4E0D\u63A5\u53D7\uFF1A\n\n- \u672A\u7ECF\u8BF4\u660E\u4E14\u6539\u53D8\u4EFB\u52A1\u8BED\u4E49\u3001\u8D28\u91CF\u3001\u8D44\u6E90\u6761\u4EF6\u6216\u5B8C\u6210\u72B6\u6001\u7684\u56DE\u9000\uFF1B\n- \u964D\u7EA7\u540E\u4ECD\u6807\u8BB0\u6B63\u5F0F\u901A\u8FC7\uFF1B\n- \u6700\u4F4E\u914D\u8F93\u51FA\u5192\u5145\u6B63\u5F0F\u4EA7\u7269\uFF1B\n- \u5C06\u5F71\u54CD\u7ED3\u679C\u7684\u5F02\u5E38\u541E\u6389\uFF0C\u65E2\u4E0D\u8BB0\u5F55\u4E5F\u4E0D\u5982\u5B9E\u8C03\u6574\u5B8C\u6210\u72B6\u6001\uFF1B\n- \u7528\u65E0\u5173\u9ED8\u8BA4\u503C\u66FF\u4EE3\u5FC5\u9700\u4FE1\u606F\uFF1B\n- \u672A\u58F0\u660E\u5730\u5207\u6362\u5230\u7ED3\u679C\u8BED\u4E49\u3001\u8D28\u91CF\u6216\u6BD4\u8F83\u6761\u4EF6\u4E0D\u540C\u7684\u65E7\u5B9E\u73B0\uFF1B\n- \u8DF3\u8FC7\u5931\u8D25\u6B65\u9AA4\u540E\u4ECD\u5BA3\u79F0\u6D41\u7A0B\u5B8C\u6574\u901A\u8FC7\uFF1B\n- \u5220\u9664\u95EE\u9898\u5BF9\u8C61\u53EA\u662F\u4E3A\u4E86\u8BA9\u5269\u4F59\u6D41\u7A0B\u901A\u8FC7\uFF1B\n- \u7528\u4E25\u683C\u4E0E\u975E\u4E25\u683C\u53CC\u6807\u51C6\u7ED5\u8FC7\u8D28\u91CF\u95E8\u69DB\u3002\n\n\u7F3A\u5C11\u5FC5\u9700\u8BED\u4E49\u65F6\uFF0C\u5728\u5408\u9002\u8FB9\u754C\u62A5\u9519\u6216\u8BB0\u5F55\u5177\u4F53\u5931\u8D25\u539F\u56E0\u5373\u53EF\uFF0C\u4E0D\u8981\u6C42\u53E6\u5EFA\u5F02\u5E38\u5206\u7C7B\u4F53\u7CFB\u6216\u72B6\u6001\u673A\u3002\u8FD9\u53EF\u80FD\u662F\u7EC8\u6B62\u6574\u4E2A\u8BF7\u6C42\uFF0C\u4E5F\u53EF\u80FD\u662F\u5728\u6279\u5904\u7406\u4E2D\u8BB0\u5F55\u5355\u9879\u5931\u8D25\u540E\u7EE7\u7EED\u5904\u7406\u72EC\u7ACB\u6837\u672C\u3002\u964D\u7EA7\u53EA\u5728\u6709\u660E\u786E\u4EFB\u52A1\u9700\u6C42\u65F6\u4F7F\u7528\uFF0C\u8BF4\u660E\u5B9E\u9645\u8F93\u51FA\u8FBE\u5230\u4E86\u4EC0\u4E48\u6807\u51C6\uFF0C\u4E0D\u80FD\u628A\u672A\u6EE1\u8DB3\u7684\u539F\u76EE\u6807\u6807\u4E3A\u901A\u8FC7\u3002\n\n\u88C1\u526A\u3001\u6295\u5F71\u3001\u7EA6\u675F\u5904\u7406\u548C\u4FEE\u590D\u53EF\u4EE5\u662F\u65B9\u6CD5\u6216\u6570\u636E\u5408\u540C\u7684\u4E00\u90E8\u5206\uFF0C\u4F8B\u5982\u68AF\u5EA6\u88C1\u526A\u3001\u6295\u5F71\u5230\u53EF\u884C\u57DF\u6216\u58F0\u660E\u8FC7\u7684\u7EA6\u675F\u6C42\u89E3\u3002\u7981\u6B62\u7684\u662F\u4E3A\u63A9\u76D6\u4E0A\u6E38\u9519\u8BEF\u3001\u5931\u8D25\u6216\u4E0D\u516C\u5E73\u6BD4\u8F83\u800C\u4E34\u65F6\u4FEE\u6539\u7ED3\u679C\uFF1B\u4E0D\u80FD\u4EC5\u56E0\u5B9E\u73B0\u4E2D\u5B58\u5728\u8FD9\u4E9B\u64CD\u4F5C\u5C31\u5C06\u5176\u5220\u9664\uFF0C\u4E5F\u4E0D\u80FD\u5C06\u672A\u7ECF\u58F0\u660E\u7684\u4FEE\u590D\u540E\u7ED3\u679C\u5192\u5145\u539F\u59CB\u8F93\u51FA\u3002\n\n## 29. \u63A5\u53E3\u8868\u8FBE\u5BF9\u5B9E\u9645\u4F7F\u7528\u8005\u6E05\u695A\u3001\u51C6\u786E\u7684\u8BED\u4E49\n\n\u5916\u90E8\u63A5\u53E3\u3001\u9886\u57DF\u6A21\u578B\u3001\u914D\u7F6E\u548C\u63A7\u5236\u8BED\u8A00\u5E94\u8BA9\u5B9E\u9645\u4F7F\u7528\u8005\u7406\u89E3\u8F93\u5165\u3001\u8F93\u51FA\u548C\u63A7\u5236\u9879\u7684\u542B\u4E49\uFF0C\u4E0D\u628A\u5076\u7136\u5B9E\u73B0\u7EC6\u8282\u4F2A\u88C5\u6210\u9886\u57DF\u6982\u5FF5\uFF0C\u4E5F\u4E0D\u4E3A\u201C\u4E1A\u52A1\u5316\u201D\u547D\u540D\u518D\u5305\u88C5\u4E00\u5C42\u3002\n\n\u79D1\u7814\u548C\u6570\u503C\u63A5\u53E3\u53EF\u4EE5\u76F4\u63A5\u8868\u8FBE\u5F20\u91CF\u7EF4\u5EA6\u3001\u7D22\u5F15\u3001\u5750\u6807\u3001\u9608\u503C\u3001\u8BA1\u7B97\u53C2\u6570\u3001\u7CBE\u5EA6\u4E0E\u8BBE\u5907\u914D\u7F6E\uFF0C\u53EA\u9700\u76F8\u5173\u7684\u5355\u4F4D\u3001\u8303\u56F4\u548C\u4F5C\u7528\u6E05\u695A\u3002\u95EE\u9898\u5728\u4E8E\u542B\u4E49\u6A21\u7CCA\u3001\u4F9D\u8D56\u672A\u8BF4\u660E\u7684\u9B54\u6CD5\u503C\u6216\u5F62\u6210\u9519\u8BEF\u62BD\u8C61\uFF0C\u800C\u4E0D\u662F\u53C2\u6570\u662F\u5426\u6280\u672F\u5316\u3001\u662F\u5426\u770B\u8D77\u6765\u4F4E\u7EA7\u3002\n\n\u65B0\u589E\u5B57\u6BB5\u6216\u63A7\u5236\u9879\u65F6\uFF0C\u660E\u786E\u5B83\u670D\u52A1\u7684\u5F53\u524D\u7528\u9014\u3001\u6765\u6E90\u548C\u5B9E\u9645\u6D88\u8D39\u4F4D\u7F6E\u5373\u53EF\u3002\u5B57\u6BB5\u53EA\u9700\u51FA\u73B0\u5728\u9700\u8981\u5B83\u7684\u9636\u6BB5\uFF0C\u4E0D\u8981\u6C42\u8D2F\u7A7F\u6240\u6709\u6570\u636E\u6D41\uFF0C\u4E5F\u4E0D\u4EE5\u8DE8\u6837\u672C\u590D\u7528\u6216\u5F62\u5F0F\u4E0A\u7684\u6240\u6709\u6743\u4E3A\u7406\u7531\u6269\u5927\u63A5\u53E3\u3002\u4FE1\u606F\u8FB9\u754C\u4E0E\u9650\u5B9A\u4EFB\u52A1\u4E2D\u7684\u5FC5\u8981\u5E38\u91CF\u6309\u7B2C 15\u300130 \u8282\u5904\u7406\u3002\n\n## 30. \u6309\u4FE1\u606F\u4F9D\u8D56\u4E0E\u4EFB\u52A1\u7EA6\u5B9A\u4FDD\u6301\u6570\u636E\u8FB9\u754C\n\n\u8BAD\u7EC3\u4E0E\u5F00\u53D1\u4FE1\u606F\u3001\u6B63\u5F0F\u8FD0\u884C\u8F93\u5165\u548C\u8BC4\u4EF7\u4F9D\u636E\u5E94\u5728\u7528\u9014\u4E0A\u6E05\u695A\u3002\u53C2\u8003\u7B54\u6848\u3001\u539F\u59CB\u6837\u672C\u548C\u5916\u90E8\u6570\u636E\u53EF\u4EE5\u7528\u4E8E\u5206\u6790\u3001\u76D1\u7763\u4E0E\u9A8C\u8BC1\uFF0C\u4F46\u4E0D\u80FD\u6697\u4E2D\u63D0\u4F9B\u4EFB\u52A1\u672A\u5141\u8BB8\u7684\u7B54\u6848\u4FE1\u606F\u3002\n\n\u4E0D\u5141\u8BB8\u53C2\u8003\u7B54\u6848\u4F5C\u4E3A\u8FD0\u884C\u8F93\u5165\u7684\u4EFB\u52A1\u4E2D\uFF0C\u53C2\u8003\u7B54\u6848\u53CA\u5176\u8BC4\u4EF7\u53CD\u9988\u4E0D\u80FD\u5F71\u54CD\u5B83\u4EEC\u672C\u4E0D\u5E94\u53C2\u4E0E\u7684\u6B63\u5F0F\u9884\u6D4B\u3001\u5019\u9009\u9009\u62E9\u3001\u8C03\u53C2\u6216\u8BC4\u4EF7\u89C4\u5219\u3002\u5DF2\u7ECF\u56FA\u5B9A\u4E14\u4E92\u4E0D\u5F71\u54CD\u7684\u72EC\u7ACB\u8F93\u51FA\uFF0C\u53EF\u4EE5\u968F\u751F\u6210\u968F\u8BC4\u4EF7\uFF1B\u662F\u5426\u5206\u79BB\u6267\u884C\uFF0C\u7531\u5B9E\u9645\u4FE1\u606F\u4F9D\u8D56\u51B3\u5B9A\uFF0C\u4E0D\u8981\u6C42\u5148\u4FDD\u5B58\u5168\u90E8\u8F93\u51FA\u518D\u7EDF\u4E00\u8BC4\u4EF7\u3002\n\n\u4EFB\u52A1\u672C\u6765\u5141\u8BB8\u793A\u4F8B\u3001\u68C0\u7D22\u5E93\u3001\u6559\u5E08\u4FE1\u53F7\u6216\u4EBA\u5DE5\u53CD\u9988\u4F5C\u4E3A\u8FD0\u884C\u65F6\u8F93\u5165\u65F6\uFF0C\u5E94\u5728\u4EFB\u52A1\u5B9A\u4E49\u548C\u6BD4\u8F83\u6761\u4EF6\u4E2D\u660E\u786E\uFF0C\u4E0D\u80FD\u4E0E\u4E0D\u5141\u8BB8\u8FD9\u4E9B\u4FE1\u606F\u7684\u4EFB\u52A1\u6DF7\u4E3A\u4E00\u8C08\u3002\u7814\u7A76\u9636\u6BB5\u7684\u4FE1\u606F\u53EF\u7528\u6027\u6309\u7B2C 15 \u8282\u5224\u65AD\uFF0C\u6700\u7EC8\u6D4B\u8BD5\u53CD\u9988\u6309\u7B2C 22 \u8282\u5904\u7406\u3002\n\n\u53C2\u8003\u6570\u636E\u3001\u6D4B\u8BD5\u5939\u5177\u3001\u6B63\u5F0F\u8F93\u5165\u548C\u8BC4\u4EF7\u4EA7\u7269\u901A\u5E38\u7528\u5DF2\u6709\u5212\u5206\u6587\u4EF6\u3001\u52A0\u8F7D\u63A5\u53E3\u6216\u76EE\u5F55\u7EA6\u5B9A\u533A\u5206\u5373\u53EF\u3002\u7528\u6237\u660E\u786E\u9650\u5B9A\u7684\u5355\u6587\u4EF6\u3001\u5355\u6837\u672C\u3001\u56FA\u5B9A\u683C\u5F0F\u6216\u56FA\u5B9A\u5750\u6807\u4EFB\u52A1\uFF0C\u53EF\u4EE5\u4F7F\u7528\u5FC5\u8981\u5E38\u91CF\u548C\u4E13\u7528\u89C4\u5219\uFF1B\u5DF2\u7ECF\u660E\u786E\u7684\u9886\u57DF\u7EA6\u5B9A\u4E0D\u5FC5\u516C\u5F00\u3002\u7981\u6B62\u7684\u662F\u5229\u7528\u6837\u672C\u8EAB\u4EFD\u6216\u7B54\u6848\u7279\u5224\u4F2A\u88C5\u901A\u7528\u80FD\u529B\u3001\u9690\u7792\u6BD4\u8F83\u6761\u4EF6\uFF0C\u4E0D\u662F\u6240\u6709\u9650\u5B9A\u7528\u9014\u7684\u5B9E\u73B0\u3002\n\n## 31. \u6D4B\u8BD5\u670D\u52A1\u5F53\u524D\u5B9E\u73B0\u4E0E\u5B9E\u9645\u7ED3\u679C\uFF0C\u4E0D\u6269\u5F20\u4E3A\u72EC\u7ACB\u5DE5\u7A0B\n\n\u6D4B\u8BD5\u7528\u4E8E\u5224\u65AD\u672C\u6B21\u5B9E\u73B0\u662F\u5426\u7B26\u5408\u4EFB\u52A1\u8981\u6C42\u3001\u4FEE\u6539\u662F\u5426\u751F\u6548\uFF0C\u4EE5\u53CA\u662F\u5426\u7834\u574F\u76F4\u63A5\u76F8\u5173\u7684\u5DF2\u6709\u529F\u80FD\u3002\u8303\u56F4\u4ECE\u5177\u4F53\u4EFB\u52A1\u548C\u53D8\u66F4\u51FA\u53D1\uFF0C\u4E0D\u4ECE\u901A\u7528\u6D4B\u8BD5\u5206\u7C7B\u53CD\u63A8\u8981\u5EFA\u8BBE\u7684\u529F\u80FD\u3001\u72B6\u6001\u6216\u6D41\u7A0B\u3002\n\n\u4F18\u5148\u590D\u7528\u5DF2\u6709\u6D4B\u8BD5\u3001\u53EF\u9760\u5BF9\u7167\u548C\u4ECD\u9002\u7528\u4E8E\u5F53\u524D\u5B9E\u73B0\u7684\u8FD0\u884C\u8BC1\u636E\uFF1B\u7F3A\u5C11\u5FC5\u8981\u9A8C\u8BC1\u65F6\uFF0C\u518D\u8865\u5145\u9488\u5BF9\u6027\u68C0\u67E5\u3002\u4E0D\u9ED8\u8BA4\u65B0\u5EFA\u6D4B\u8BD5\u6846\u67B6\u3001\u5B8C\u6574\u53C2\u8003\u7B97\u6CD5\u6216\u8986\u76D6\u77E9\u9635\uFF0C\u4E5F\u4E0D\u628A\u6BCF\u6B21\u4E34\u65F6\u68C0\u67E5\u90FD\u8F6C\u4E3A\u6C38\u4E45\u6D4B\u8BD5\u6587\u4EF6\u3002\u662F\u5426\u4FDD\u7559\u4E3A\u957F\u671F\u56DE\u5F52\u6D4B\u8BD5\uFF0C\u6309\u5B9E\u9645\u91CD\u590D\u4F7F\u7528\u4EF7\u503C\u548C\u7EF4\u62A4\u6210\u672C\u5224\u65AD\u3002\n\n\u9A8C\u8BC1\u6761\u4EF6\u7531\u95EE\u9898\u51B3\u5B9A\u3002\u5C0F\u6837\u4F8B\u80FD\u591F\u67E5\u6E05\u7684\u95EE\u9898\uFF0C\u4E0D\u5FC5\u8FD0\u884C\u5927\u5B9E\u9A8C\uFF1B\u4F9D\u8D56\u5B9E\u9645\u6570\u636E\u3001\u6A21\u578B\u89C4\u6A21\u3001\u7CBE\u5EA6\u3001\u663E\u5B58\u6216\u541E\u5410\u7684\u95EE\u9898\uFF0C\u5E94\u5728\u76F8\u5E94\u6761\u4EF6\u4E0B\u9A8C\u8BC1\uFF0C\u4E0D\u7528\u73A9\u5177\u6D4B\u8BD5\u4EE3\u66FF\uFF0C\u4E5F\u4E0D\u8981\u6C42\u5148\u8865\u9F50\u4E00\u5957\u5C0F\u578B\u6D4B\u8BD5\u3002\u771F\u5B9E\u5931\u8D25\u6837\u672C\u548C\u5FC5\u8981\u914D\u7F6E\u53EF\u4EE5\u76F4\u63A5\u7528\u4E8E\u590D\u73B0\uFF0C\u4E0D\u4E3A\u8FFD\u6C42\u5F62\u5F0F\u4E0A\u7684\u201C\u6700\u5C0F\u201D\u800C\u5220\u9664\u89E6\u53D1\u95EE\u9898\u7684\u6761\u4EF6\u3002\n\n\u6B63\u786E\u6027\u5224\u65AD\u5E94\u4F9D\u636E\u4EFB\u52A1\u8981\u6C42\u3001\u660E\u786E\u7684\u6570\u5B66\u6216\u9886\u57DF\u5B9A\u4E49\u3001\u53EF\u9760\u5BF9\u7167\uFF0C\u800C\u4E0D\u662F\u628A\u5F53\u524D\u672A\u7ECF\u6838\u5B9E\u7684\u8F93\u51FA\u5F53\u4F5C\u6B63\u786E\u7B54\u6848\u3002\u5DF2\u7ECF\u9A8C\u8BC1\u3001\u4E14\u4E0E\u5F53\u524D\u4EFB\u52A1\u7EA6\u5B9A\u4E00\u81F4\u7684\u57FA\u7EBF\u7ED3\u679C\u53EF\u4EE5\u7528\u4E8E\u56DE\u5F52\u6BD4\u8F83\uFF1B\u7ED3\u679C\u4E00\u81F4\u53EA\u652F\u6301\u76F8\u5E94\u7684\u4E00\u81F4\u6027\u7ED3\u8BBA\u3002\u53EF\u4EE5\u590D\u7528\u5DF2\u6709\u53C2\u8003\u5B9E\u73B0\uFF1B\u786E\u9700\u72EC\u7ACB\u5BF9\u7167\u65F6\uFF0C\u5B9E\u73B0\u8303\u56F4\u4EE5\u56DE\u7B54\u5177\u4F53\u95EE\u9898\u4E3A\u51C6\uFF0C\u4E0D\u9ED8\u8BA4\u7EF4\u62A4\u7B2C\u4E8C\u5957\u5B8C\u6574\u7B97\u6CD5\u3002\u5F62\u72B6\u3001\u8303\u56F4\u548C\u4E0D\u53D8\u91CF\u68C0\u67E5\u4E0D\u80FD\u66FF\u4EE3\u5B83\u4EEC\u6CA1\u6709\u8986\u76D6\u7684\u5173\u952E\u8BA1\u7B97\u6216\u5B9E\u9645\u884C\u4E3A\u3002\n\n\u5B9E\u73B0\u4E0E\u9A8C\u8BC1\u4EA4\u66FF\u63A8\u8FDB\uFF0C\u4E0D\u628A\u5B8C\u6574\u6D4B\u8BD5\u4F53\u7CFB\u4F5C\u4E3A\u6838\u5FC3\u5B9E\u73B0\u7684\u5F00\u5DE5\u524D\u63D0\u3002\u4EFB\u52A1\u5305\u542B\u4FEE\u590D\u4E14\u95EE\u9898\u5DF2\u5B9A\u4F4D\u5230\u8DB3\u4EE5\u4FEE\u590D\u65F6\uFF0C\u4F18\u5148\u4FEE\u590D\uFF1B\u5DF2\u6709\u8BC1\u636E\u8DB3\u4EE5\u652F\u6301\u5F53\u524D\u4EA4\u4ED8\u7ED3\u8BBA\u65F6\uFF0C\u7ED3\u675F\u672C\u8F6E\u9A8C\u8BC1\u5E76\u7EE7\u7EED\u6838\u5FC3\u5DE5\u4F5C\u6216\u5B8C\u6210\u4EA4\u4ED8\uFF0C\u4E0D\u8FFD\u52A0\u65E0\u5173\u9A8C\u6536\u6761\u4EF6\u3002\u5C40\u90E8\u6D4B\u8BD5\u53EA\u652F\u6301\u5176\u5B9E\u9645\u8986\u76D6\u7684\u7ED3\u8BBA\uFF1B\u8986\u76D6\u5F53\u524D\u9A8C\u6536\u76EE\u6807\u7684\u6D4B\u8BD5\u53EF\u4EE5\u4F5C\u4E3A\u9A8C\u6536\u4F9D\u636E\u3002\u590D\u7528\u65E7\u7ED3\u679C\u53CA\u672A\u8FD0\u884C\u9A8C\u8BC1\u7684\u8868\u8FBE\u6309\u7B2C 32\u300149 \u8282\u5904\u7406\u3002\n\n\u5F00\u53D1\u6D4B\u8BD5\u4E0D\u81EA\u52A8\u53D8\u6210\u6B63\u5F0F\u8FD0\u884C\u4E2D\u7684\u5E38\u9A7B\u68C0\u67E5\u3002\u8BAD\u7EC3\u3001\u63A8\u7406\u8DEF\u5F84\u4E2D\u7684\u6821\u9A8C\u6216\u8BCA\u65AD\uFF0C\u6309\u5177\u4F53\u7528\u9014\u4E0E\u8FD0\u884C\u5F00\u9500\u51B3\u5B9A\u662F\u5426\u4FDD\u7559\uFF0C\u4E0D\u4E3A\u914D\u5408\u6D4B\u8BD5\u800C\u9ED8\u8BA4\u589E\u52A0\u9010\u6B65\u626B\u63CF\u3001\u91CD\u590D\u6821\u9A8C\u6216\u6C38\u4E45\u8BCA\u65AD\u5206\u652F\u3002\n\n## 32. \u6309\u5F53\u524D\u4E3B\u5F20\u9009\u62E9\u9A8C\u8BC1\uFF0C\u6D89\u53CA\u771F\u5B9E\u4F7F\u7528\u65F6\u9A8C\u8BC1\u5B9E\u9645\u8DEF\u5F84\n\n\u4EE5\u4E0B\u662F\u53EF\u9009\u7684\u9A8C\u8BC1\u65B9\u5F0F\uFF0C\u4E0D\u662F\u5FC5\u987B\u9010\u5C42\u901A\u5173\u7684\u6E05\u5355\u3002\u9009\u62E9\u8DB3\u4EE5\u652F\u6491\u5F53\u524D\u4E3B\u5F20\u4E0E\u9A8C\u6536\u7684\u7EC4\u5408\uFF1B\u6D89\u53CA\u771F\u5B9E\u4F7F\u7528\u7ED3\u8BBA\u65F6\uFF0C\u5FC5\u987B\u8986\u76D6\u5BF9\u5E94\u7684\u5B9E\u9645\u6216\u4EE3\u8868\u6027\u4F7F\u7528\u8DEF\u5F84\uFF1A\n\n1. \u9759\u6001\u3001\u8BED\u6CD5\u548C\u7C7B\u578B\u68C0\u67E5\uFF1B\n2. \u805A\u7126\u8D23\u4EFB\u6A21\u5757\u6D4B\u8BD5\uFF1B\n3. \u8DE8\u6A21\u5757\u5408\u540C\u6D4B\u8BD5\uFF1B\n4. \u96C6\u6210\u6D4B\u8BD5\uFF1B\n5. \u5B8C\u6574\u771F\u5B9E\u6D41\u7A0B\uFF1B\n6. \u6B63\u5F0F\u8F93\u51FA\u4E0E\u91CD\u65B0\u8BFB\u53D6\u9A8C\u8BC1\uFF1B\n7. \u7528\u6237\u754C\u9762\u6216\u5B9E\u9645\u4F7F\u7528\u8DEF\u5F84\uFF1B\n8. \u4E0E\u53C2\u8003\u7ED3\u679C\u6216\u4E1A\u52A1\u6807\u51C6\u6BD4\u8F83\u3002\n\n\u4F18\u5148\u590D\u7528\u5DF2\u6709\u6D4B\u8BD5\uFF0C\u6309\u672C\u6B21\u53D8\u66F4\u7684\u5B9E\u9645\u5F71\u54CD\u8FD0\u884C\u5FC5\u8981\u90E8\u5206\uFF0C\u4E0D\u8981\u6C42\u6BCF\u6B21\u5168\u91CF\u91CD\u6D4B\u3002\u590D\u7528\u6D4B\u8BD5\u65B9\u6CD5\u4E0D\u7B49\u4E8E\u81EA\u52A8\u590D\u7528\u4FEE\u6539\u524D\u7684\u901A\u8FC7\u7ED3\u8BBA\uFF1B\u53EA\u6709\u786E\u5B9E\u672A\u53D7\u6539\u52A8\u5F71\u54CD\u3001\u524D\u63D0\u4ECD\u6210\u7ACB\u7684\u7ED3\u679C\u624D\u53EF\u7EE7\u7EED\u5F15\u7528\u3002\u5C1A\u672A\u91CD\u8DD1\u7684\u76F8\u5173\u9A8C\u8BC1\uFF0C\u5E94\u8BF4\u660E\u54EA\u4E9B\u6539\u52A8\u4ECD\u672A\u9A8C\u8BC1\uFF0C\u4E0D\u628A\u65E7\u7ED3\u679C\u79F0\u4E3A\u672C\u6B21\u901A\u8FC7\u3002\u62A5\u544A\u65B9\u5F0F\u89C1\u7B2C 49 \u8282\uFF0C\u4E0D\u53E6\u5EFA\u95E8\u69DB\u77E9\u9635\u6216\u9A8C\u6536\u62A5\u544A\u3002\n\n\u5BF9\u4E8E\u754C\u9762\u3001\u5DE5\u4F5C\u6D41\u548C\u667A\u80FD\u4F53\u4EA7\u54C1\uFF0C\u5F53\u7ED3\u8BBA\u6D89\u53CA\u7528\u6237\u53EF\u89C1\u884C\u4E3A\u65F6\uFF0C\u5E94\u5728\u771F\u5B9E\u73AF\u5883\u6216\u5177\u6709\u4EE3\u8868\u6027\u7684\u7AEF\u5230\u7AEF\u73AF\u5883\u4E2D\u4F7F\u7528\uFF0C\u68C0\u67E5\u7528\u6237\u80FD\u591F\u770B\u5230\u4EC0\u4E48\u3001\u5931\u8D25\u5982\u4F55\u5448\u73B0\u3001\u6700\u7EC8\u4EA7\u7269\u662F\u5426\u771F\u6B63\u53EF\u7528\u3002\u5BF9\u4E8E\u5E93\u3001\u540E\u53F0\u670D\u52A1\u6216\u65E0\u754C\u9762\u7EC4\u4EF6\uFF0C\u201C\u771F\u5B9E\u4F7F\u7528\u8DEF\u5F84\u201D\u53EF\u4EE5\u662F\u4EE3\u8868\u6027\u96C6\u6210\u8C03\u7528\uFF0C\u4E0D\u8981\u6C42\u4EBA\u4E3A\u589E\u52A0\u56FE\u5F62\u754C\u9762\u3002\n\n## 33. \u5FC5\u8981\u7684\u53EF\u89C2\u6D4B\u6027\u548C\u53EF\u89C6\u5316\u5C5E\u4E8E\u529F\u80FD\n\n\u5F53\u590D\u6742\u6D41\u7A0B\u7684\u8FD0\u884C\u3001\u8BCA\u65AD\u6216\u9A8C\u6536\u4F9D\u8D56\u53EF\u89C1\u72B6\u6001\u65F6\uFF0C\u7528\u8DB3\u4EE5\u5B9A\u4F4D\u5F53\u524D\u95EE\u9898\u7684\u65E5\u5FD7\u3001\u6307\u6807\u3001\u62A5\u544A\u6216\u754C\u9762\u5448\u73B0\u4EE5\u4E0B\u76F8\u5173\u5185\u5BB9\uFF1B\u4E0D\u8981\u6C42\u540C\u65F6\u5EFA\u8BBE\u591A\u5957\u5448\u73B0\u65B9\u5F0F\uFF1A\n\n- \u5F53\u524D\u9636\u6BB5\uFF1B\n- \u5DF2\u5B8C\u6210\u5185\u5BB9\uFF1B\n- \u5931\u8D25\u4F4D\u7F6E\u548C\u539F\u56E0\uFF1B\n- \u8F93\u5165\u4E0E\u8F93\u51FA\uFF1B\n- \u8D28\u91CF\u6307\u6807\uFF1B\n- \u5BF9\u6BD4\u7ED3\u679C\uFF1B\n- \u6B63\u5F0F\u4EA7\u7269\u662F\u5426\u53EF\u7528\u3002\n\n\u8BCA\u65AD\u4FE1\u606F\u6309\u5B9E\u9645\u4F7F\u7528\u8005\u548C\u5F53\u524D\u95EE\u9898\u9009\u62E9\u3002\u9762\u5411\u7528\u6237\u8BF4\u660E\u53EF\u7528\u7ED3\u679C\u4E0E\u5931\u8D25\u542B\u4E49\uFF1B\u9762\u5411\u7814\u7A76\u4E0E\u5F00\u53D1\u4EBA\u5458\uFF0C\u53EF\u4EE5\u76F4\u63A5\u63D0\u4F9B\u5FC5\u8981\u7684\u5806\u6808\u3001\u7EF4\u5EA6\u3001\u68AF\u5EA6\u3001\u6570\u503C\u6216\u663E\u5B58\u72B6\u6001\u3002\u80FD\u5E2E\u52A9\u5224\u65AD\u6216\u5B9A\u4F4D\u95EE\u9898\u5373\u53EF\uFF0C\u4E0D\u6309\u662F\u5426\u4E1A\u52A1\u5316\u3001\u662F\u5426\u6709\u56FE\u8868\u8BC4\u4EF7\u8D28\u91CF\uFF1B\u5DF2\u6709\u65E5\u5FD7\u8DB3\u591F\u65F6\u4E0D\u518D\u5EFA\u8BBE\u5448\u73B0\u5C42\u3002\u9884\u89C8\u3001\u53C2\u8003\u7ED3\u679C\u3001\u8BCA\u65AD\u4EA7\u7269\u548C\u6B63\u5F0F\u4EA7\u7269\u4FDD\u6301\u7528\u9014\u6E05\u695A\uFF0C\u5448\u73B0\u8303\u56F4\u4EE5\u5F53\u524D\u8BCA\u65AD\u4E0E\u9A8C\u6536\u9700\u8981\u4E3A\u9650\u3002\n\n## 34. \u8BA9\u4EE3\u7801\u7ED3\u6784\u670D\u52A1\u5F53\u524D\u5B9E\u73B0\u4E0E\u5DF2\u77E5\u7EF4\u62A4\n\n\u51C6\u5907\u8FDB\u5165\u957F\u671F\u7EF4\u62A4\u3001\u6B63\u5F0F\u5B9E\u9A8C\u6216\u771F\u5B9E\u4EA4\u4ED8\u7684\u4EE3\u7801\uFF0C\u5E94\u4F18\u5148\u4FDD\u8BC1\u6E05\u695A\u8FB9\u754C\u548C\u53EF\u7EF4\u62A4\u6027\u3002\u4E00\u6B21\u6027\u8BCA\u65AD\u811A\u672C\u6216\u63A2\u7D22\u539F\u578B\u53EF\u4EE5\u4E3A\u901F\u5EA6\u727A\u7272\u90E8\u5206\u7ED3\u6784\uFF0C\u5E94\u4E0E\u6B63\u5F0F\u5165\u53E3\u548C\u7ED3\u679C\u533A\u5206\u7528\u9014\uFF1B\u8FDB\u5165\u6B63\u5F0F\u8DEF\u5F84\u524D\uFF0C\u53EA\u8865\u9F50\u4E0E\u6B63\u5F0F\u76EE\u6807\u6709\u5173\u7684\u80FD\u529B\u3001\u6B63\u786E\u6027\u548C\u53EF\u7EF4\u62A4\u6027\u8981\u6C42\uFF0C\u4E0D\u9ED8\u8BA4\u8FDB\u884C\u751F\u4EA7\u5316\u6539\u9020\u3002\n\n\u4EE5\u4E0B\u73B0\u8C61\u53EF\u4EE5\u63D0\u793A\u6F5C\u5728\u7684\u7406\u89E3\u3001\u4FEE\u6539\u6216\u8FD0\u884C\u95EE\u9898\uFF0C\u4F46\u4E0D\u662F\u81EA\u52A8\u91CD\u6784\u6E05\u5355\uFF1A\n\n- \u7F3A\u5C11\u65B9\u6CD5\u6216\u5408\u540C\u4F9D\u636E\u7684\u9B54\u6CD5\u6BD4\u4F8B\u548C\u5C42\u5C42\u622A\u65AD\uFF1B\n- \u8D85\u957F\u53D8\u91CF\u540D\u8BB0\u5F55\u8865\u4E01\u5386\u53F2\uFF1B\n- \u4E00\u4E2A\u51FD\u6570\u627F\u62C5\u8FC7\u591A\u804C\u8D23\uFF1B\n- \u6570\u636E\u6765\u6E90\u3001\u4E1A\u52A1\u903B\u8F91\u3001\u9A8C\u8BC1\u548C\u63A7\u5236\u89E3\u6790\u6DF7\u5728\u4E00\u8D77\uFF1B\n- \u4E0D\u65AD\u589E\u52A0\u5B57\u6BB5\u3001\u5F00\u5173\u3001\u6A21\u5F0F\u548C\u5206\u652F\u6765\u56DE\u907F\u67B6\u6784\u51B3\u7B56\uFF1B\n- `new`\uFF08\u65B0\uFF09\u3001`legacy`\uFF08\u65E7\u7248\uFF09\u3001`v2`\uFF08\u7B2C\u4E8C\u7248\uFF09\u3001`temporary`\uFF08\u4E34\u65F6\uFF09\u7B49\u540D\u79F0\u957F\u671F\u5B58\u5728\uFF1B\n- \u5927\u89C4\u6A21\u590D\u5236\u4EE3\u7801\u540E\u5F62\u6210\u96BE\u4EE5\u7EF4\u62A4\u7684\u5206\u53C9\u3002\n\n\u51FD\u6570\u957F\u5EA6\u3001\u540D\u79F0\u548C\u6587\u4EF6\u6570\u91CF\u53EA\u662F\u7EBF\u7D22\uFF0C\u5B9E\u9645\u9020\u6210\u7406\u89E3\u3001\u4FEE\u6539\u6216\u8FD0\u884C\u95EE\u9898\u65F6\u518D\u5904\u7406\u3002\u6A21\u5757\u5212\u5206\u3001\u5904\u7406\u9636\u6BB5\u548C\u6570\u636E\u7ED3\u6784\u4EE5\u5F53\u524D\u5B9E\u73B0\u4E0E\u5DF2\u77E5\u7EF4\u62A4\u9700\u8981\u4E3A\u51C6\uFF0C\u4E0D\u4E3A\u5916\u89C2\u4E00\u81F4\u62C6\u51FA\u5927\u91CF\u5C0F\u6A21\u5757\uFF0C\u4E0D\u56E0\u540D\u79F0\u5E26\u6709\u5386\u53F2\u75D5\u8FF9\u5C31\u81EA\u52A8\u91CD\u6784\u3002\u786E\u9700\u4FEE\u6539\u5171\u4EAB\u57FA\u7840\u65F6\uFF0C\u4FDD\u6301\u6539\u52A8\u96C6\u4E2D\uFF0C\u80FD\u89E3\u91CA\u5E76\u9A8C\u8BC1\u5176\u5F71\u54CD\u3002\u957F\u671F\u4EE3\u7801\u5065\u5EB7\u4E0D\u7B49\u4E8E\u63D0\u524D\u5EFA\u8BBE\u672A\u6765\u6846\u67B6\uFF1B\u4EC5\u4E3A\u53EF\u80FD\u6269\u5C55\u3001\u5F62\u5F0F\u5B8C\u5907\u6216\u7406\u8BBA\u4E0A\u7684\u5B89\u5168\u6027\u589E\u52A0\u62BD\u8C61\u3001\u72B6\u6001\u3001\u6743\u9650\u548C\u6062\u590D\u8DEF\u5F84\uFF0C\u5C5E\u4E8E\u9700\u8981\u5220\u51CF\u7684\u989D\u5916\u590D\u6742\u5EA6\u3002\n\n## 35. \u6700\u5C0F\u5FC5\u8981\u5B9E\u73B0\u4E0E\u53D8\u66F4\u8303\u56F4\uFF1A\u4FDD\u7559\u6709\u6548\u80FD\u529B\uFF0C\u5220\u51CF\u65E0\u4F9D\u636E\u7684\u590D\u6742\u5EA6\n\n\u201C\u6700\u5C0F\u5FC5\u8981\u201D\u7528\u4E8E\u5220\u9664\u5BF9\u65E2\u5B9A\u76EE\u6807\u6CA1\u6709\u8D21\u732E\u7684\u590D\u6742\u5EA6\uFF0C\u4E0D\u7528\u4E8E\u51B3\u5B9A\u6BCF\u8F6E\u505A\u6700\u5C0F\u53D8\u66F4\u3001\u628A\u65B9\u6848\u505C\u5728\u6700\u4F4E\u5408\u683C\u7EBF\uFF0C\u4E5F\u4E0D\u8981\u6C42\u5148\u8BC1\u660E\u6240\u6709\u5019\u9009\u65B9\u6848\u53EF\u884C\u3002\u9ED8\u8BA4\u8FED\u4EE3\u63A8\u8FDB\u9884\u671F\u66F4\u4F18\u7684\u6574\u4F53\u5DE5\u7A0B\u8DEF\u7EBF\uFF1A\u6BCF\u8F6E\u5B8C\u6210\u8DB3\u4EE5\u68C0\u67E5\u5F53\u524D\u6838\u5FC3\u80FD\u529B\u6216\u5173\u952E\u98CE\u9669\u7684\u771F\u5B9E\u4E0A\u4E0B\u6E38\u5207\u7247\uFF0C\u5438\u6536\u5B9E\u73B0\u548C\u4F7F\u7528\u53CD\u9988\uFF0C\u5FC5\u8981\u65F6\u4FEE\u6B63\u5171\u56E0\u6216\u8C03\u6574\u8BBE\u8BA1\uFF0C\u518D\u6269\u5C55\u672A\u5B8C\u6210\u7684\u80FD\u529B\u4E0E\u89C4\u6A21\uFF1B\u6709\u754C\u8BF7\u6C42\u5B8C\u6210\u7EA6\u5B9A\u7ED3\u679C\u5373\u53EF\uFF0C\u4E0D\u5F3A\u5236\u591A\u8F6E\u3002\u6309\u6700\u7EC8\u80FD\u529B\u3001\u6709\u6548\u89C4\u6A21\u3001\u8BC1\u636E\u8981\u6C42\u3001\u5B9E\u9645\u8FD0\u884C\u6761\u4EF6\u548C\u9884\u7B97\uFF0C\u7EFC\u5408\u79D1\u5B66\u4EF7\u503C\u3001\u5B8C\u6574\u5B9E\u9A8C\u5468\u671F\u3001\u5B9E\u73B0\u4E0E\u8FD0\u884C\u6210\u672C\u53CA\u5DF2\u77E5\u7EF4\u62A4\u8D1F\u62C5\uFF0C\u9009\u62E9\u9884\u671F\u66F4\u4F18\u65B9\u6848\u3002\u4EE3\u7801\u66F4\u957F\u4F46\u80FD\u5145\u5206\u5229\u7528 GPU\u3001\u663E\u8457\u7F29\u77ED\u5B9E\u9A8C\u77E9\u9635\uFF0C\u6216\u66F4\u5927\u6A21\u578B\u624D\u5177\u6709\u76EE\u6807\u80FD\u529B\u65F6\uFF0C\u4E0D\u5E94\u4E3A\u51CF\u5C11\u4EE3\u7801\u548C\u89C4\u6A21\u800C\u5220\u53BB\u8FD9\u4E9B\u80FD\u529B\u3002\u672C\u8282\u4E3B\u8981\u9650\u5236\u65E0\u5F53\u524D\u7528\u9014\u7684\u652F\u6491\u4F53\u7CFB\u548C\u4E0D\u503C\u5F97\u5176\u6210\u672C\u7684\u590D\u6742\u5EA6\uFF1B\u6709\u5408\u7406\u9884\u671F\u6536\u76CA\u7684\u6539\u8FDB\u4E0E\u63A2\u7D22\u6309\u7B2C 2 \u8282\u5B9E\u65BD\uFF0C\u4E0D\u56E0\u5C1A\u975E\u4E0D\u53EF\u7F3A\u5C11\u6216\u6682\u672A\u8BC1\u660E\u6709\u6548\u800C\u81EA\u52A8\u5220\u9664\u3002\n\n\u5B9E\u65BD\u4F9D\u636E\u7EDF\u4E00\u6309\u7B2C 2 \u8282\u5224\u65AD\uFF0C\u672C\u8282\u4E0D\u53E6\u8BBE\u201C\u4E3A\u4E86\u5B89\u5168\u6216\u7A33\u5065\u5373\u53EF\u589E\u52A0\u201D\u7684\u515C\u5E95\u3002\u4EE5\u9632\u62A4\u3001\u6821\u9A8C\u3001\u6062\u590D\u6216\u53EF\u9760\u6027\u4E3A\u7531\u589E\u52A0\u5B9E\u73B0\u65F6\uFF0C\u5E94\u80FD\u8BF4\u6E05\u5F53\u524D\u573A\u666F\u4E2D\u54EA\u4E2A\u73AF\u8282\u4F1A\u51FA\u4EC0\u4E48\u5177\u4F53\u95EE\u9898\uFF0C\u4EE5\u53CA\u4E3A\u4F55\u73B0\u6709\u673A\u5236\u6216\u66F4\u76F4\u63A5\u7684\u5904\u7406\u4E0D\u8DB3\uFF1B\u4EC5\u80FD\u8BF4\u201C\u7406\u8BBA\u4E0A\u53EF\u80FD\u6709\u98CE\u9669\u201D\u65F6\u4E0D\u589E\u52A0\u3002\u8FD9\u662F\u5B9E\u73B0\u53D6\u820D\uFF0C\u4E0D\u8981\u6C42\u53E6\u4EA4\u98CE\u9669\u8BC1\u660E\u6216\u5BA1\u6279\u6750\u6599\uFF0C\u4E5F\u4E0D\u8981\u6C42\u7B49\u95EE\u9898\u5B9E\u9645\u53D1\u751F\u540E\u624D\u5904\u7406\u6709\u660E\u786E\u4F9D\u636E\u7684\u9884\u671F\u635F\u5931\u3002\n\n\u80FD\u76F4\u63A5\u907F\u514D\u67D0\u9879\u64CD\u4F5C\u3001\u590D\u7528\u73B0\u6709\u8BBE\u7F6E\u6216\u5728\u5FC5\u8981\u8FB9\u754C\u505A\u4E00\u6B21\u68C0\u67E5\u5C31\u89E3\u51B3\u7684\u95EE\u9898\uFF0C\u4E0D\u518D\u5EFA\u8BBE\u901A\u7528\u9632\u62A4\u7CFB\u7EDF\u3002\u6CA1\u6709\u5B9E\u9645\u5BF9\u5916\u670D\u52A1\u3001\u591A\u79DF\u6237\u3001\u654F\u611F\u6570\u636E\u5904\u7406\u6216\u6297\u6076\u610F\u8F93\u5165\u7684\u4EFB\u52A1\u4F9D\u636E\u65F6\uFF0C\u4E0D\u81EA\u884C\u5047\u8BBE\u8FD9\u4E9B\u90E8\u7F72\u9700\u6C42\uFF1B\u5DF2\u7ECF\u660E\u786E\u5B58\u5728\u7684\u5177\u4F53\u95EE\u9898\uFF0C\u53EA\u5904\u7406\u5176\u76F8\u5173\u8DEF\u5F84\u3002\n\n\u9664\u975E\u6EE1\u8DB3\u7B2C 2 \u8282\u7684\u5177\u4F53\u4F9D\u636E\uFF0C\u9ED8\u8BA4\u4E0D\u4E3B\u52A8\u589E\u52A0\uFF1A\n\n- `SHA/hash/digest` \u6821\u9A8C\uFF1B\n- `artifact authentication`\uFF08\u4EA7\u7269\u8BA4\u8BC1\uFF09\u3001`receipt`\uFF08\u6536\u636E\uFF09\u3001`lineage`\uFF08\u8C31\u7CFB\uFF09\u6216\u8BC1\u636E\u94FE\uFF1B\n- \u901A\u7528 `schema/version`\uFF08\u6A21\u5F0F\u6216\u7248\u672C\uFF09\u5E73\u53F0\uFF1B\n- `immutable/sealed/read-only publication`\uFF08\u4E0D\u53EF\u53D8\u3001\u5C01\u5B58\u6216\u53EA\u8BFB\u53D1\u5E03\uFF09\u4F53\u7CFB\uFF1B\n- `payload inventory`\uFF08\u8F7D\u8377\u6E05\u5355\uFF09\uFF1B\n- \u901A\u7528\u7684 `checkpoint`\uFF08\u68C0\u67E5\u70B9\uFF09\u3001`dataset`\uFF08\u6570\u636E\u96C6\uFF09\u3001`domain`\uFF08\u9886\u57DF\uFF09\u6216 `trace`\uFF08\u8FFD\u8E2A\u8BB0\u5F55\uFF09\u8EAB\u4EFD\u7ED1\u5B9A\uFF1B\n- \u65E0\u5DF2\u77E5\u5B9E\u9645\u4F9D\u8D56\u7684 `legacy compatibility`\uFF08\u65E7\u7248\u517C\u5BB9\uFF09\u3001\u8F6C\u6362\u5668\u6216\u517C\u5BB9\u5C42\uFF1B\n- \u65E0\u771F\u5B9E\u90E8\u7F72\u8981\u6C42\u7684\u5B8C\u6574 `CPU fallback`\uFF08CPU \u56DE\u9000\uFF09\u6216\u6C38\u4E45\u53CC\u5B9E\u73B0\uFF1B\n- `speculative abstraction`\uFF08\u5047\u8BBE\u6027\u62BD\u8C61\uFF09\u3001\u901A\u7528\u6846\u67B6\u6216\u672A\u6765\u6269\u5C55\u63A5\u53E3\uFF1B\n- \u4E0E\u5F53\u524D\u4EFB\u52A1\u65E0\u76F4\u63A5\u5173\u7CFB\u7684\u6743\u9650\u5206\u5C42\u3001\u53CD\u8BEF\u7528\u3001\u5BA1\u8BA1\u3001\u81EA\u52A8\u6062\u590D\u6216\u5BA1\u6279\u6D41\u7A0B\uFF1B\n- \u4E0E\u5F53\u524D\u5408\u540C\u3001\u5177\u4F53\u5931\u8D25\u6A21\u5F0F\u548C\u9A8C\u6536\u76EE\u6807\u65E0\u5173\u7684\u9632\u5FA1\u6027\u68C0\u67E5\u548C\u6D4B\u8BD5\u3002\n\n\u8FD0\u884C\u6807\u8BC6\u3001\u914D\u7F6E\u8BB0\u5F55\u3001\u968F\u673A\u79CD\u5B50\u3001\u5FC5\u8981\u683C\u5F0F\u7248\u672C\u6216\u5C11\u91CF\u8BAD\u7EC3\u68C0\u67E5\u70B9\uFF0C\u53EA\u8981\u76F4\u63A5\u670D\u52A1\u5DF2\u786E\u5B9A\u7684\u590D\u73B0\u3001\u6A21\u578B\u9009\u62E9\u3001\u8FC1\u79FB\u6216\u6602\u8D35\u8BAD\u7EC3\u6062\u590D\uFF0C\u4E0D\u56E0\u540D\u79F0\u4E0E\u4E0A\u5217\u76F8\u4F3C\u800C\u81EA\u52A8\u7981\u6B62\u3002\u68C0\u67E5\u70B9\u7528\u4E8E\u4FDD\u5B58\u548C\u6062\u590D\u5FC5\u8981\u8BAD\u7EC3\u72B6\u6001\uFF0C\u4E0D\u7B49\u4E8E\u8981\u5EFA\u7ACB\u8EAB\u4EFD\u7ED1\u5B9A\u3001\u4EA7\u7269\u8BA4\u8BC1\u6216\u901A\u7528\u6062\u590D\u5E73\u53F0\u3002\u5DF2\u6709\u6846\u67B6\u80FD\u529B\u8DB3\u591F\u65F6\u76F4\u63A5\u590D\u7528\uFF0C\u4E0D\u518D\u989D\u5916\u5305\u88C5\u4E00\u5C42\u3002\n\n\u591A\u4E2A\u65B9\u6848\u5728\u6700\u7EC8\u80FD\u529B\u3001\u8BC1\u636E\u8981\u6C42\u3001\u6700\u4F4E\u6709\u6548\u89C4\u6A21\u3001\u5B9E\u9A8C\u541E\u5410\u548C\u5DF2\u660E\u786E\u8FD0\u884C\u6761\u4EF6\u4E0A\u57FA\u672C\u7B49\u4EF7\u65F6\uFF0C\u518D\u4F18\u5148\u9009\u62E9\u4EE3\u7801\u3001\u72B6\u6001\u3001\u6587\u4EF6\u548C\u68C0\u67E5\u66F4\u5C11\u7684\u65B9\u6848\u3002\u4E0D\u8981\u6C42\u65B9\u6848\u5728\u4E00\u5207\u5047\u8BBE\u6027\u98CE\u9669\u4E0A\u7B49\u4EF7\uFF0C\u4E5F\u4E0D\u56E0\u67D0\u4E2A\u65B9\u6848\u9632\u62A4\u66F4\u591A\u5C31\u9ED8\u8BA4\u4F18\u5148\u3002\u76EE\u6807\u662F\u4EE5\u66F4\u597D\u7684\u603B\u4F53\u6210\u672C\u83B7\u5F97\u51B3\u5B9A\u6027\u79D1\u7814\u8BC1\u636E\u6216\u53EF\u7528\u5DE5\u7A0B\u7ED3\u679C\uFF0C\u800C\u4E0D\u662F\u5355\u72EC\u6700\u5C0F\u5316\u6E90\u4EE3\u7801\u884C\u6570\u3002\n\n\u53D1\u73B0\u672C\u6B21\u65B0\u589E\u5185\u5BB9\u8D85\u51FA\u5F53\u524D\u76EE\u6807\u6216\u7F3A\u5C11\u7B2C 2 \u8282\u7684\u5B9E\u65BD\u4F9D\u636E\u65F6\uFF0C\u505C\u6B62\u7EE7\u7EED\u5B8C\u5584\uFF1B\u672C\u6B21\u65B0\u589E\u4E14\u65E0\u6D3B\u52A8\u4F9D\u8D56\u7684\u8FC7\u5EA6\u5B9E\u73B0\u76F4\u63A5\u5220\u9664\uFF0C\u4E0D\u8865\u6D4B\u8BD5\u3001\u4E0D\u4FDD\u7559\u4E3A\u6C38\u4E45\u53EF\u9009\u8DEF\u5F84\u3002\u786E\u6709\u73B0\u5B58\u4F9D\u8D56\u65F6\u5904\u7406\u5177\u4F53\u4F9D\u8D56\uFF0C\u4E0D\u7528\u201C\u53EF\u80FD\u5B58\u5728\u9690\u85CF\u4F9D\u8D56\u201D\u65E0\u9650\u5EF6\u671F\uFF1B\u7814\u7A76\u8BB0\u5F55\u4E0E\u7528\u6237\u6587\u4EF6\u6309\u7B2C 4 \u8282\u5904\u7406\uFF0C\u4E0D\u4E3A\u5220\u9664\u65E0\u7528\u4EE3\u7801\u53E6\u5EFA\u5907\u4EFD\u3001\u5F52\u6863\u6216\u5BA1\u6279\u4F53\u7CFB\u3002\n\n\u5728\u4E0A\u8FF0\u7EA6\u675F\u4E0B\uFF1A\n\n- \u6839\u636E\u5F53\u524D\u95EE\u9898\u4F7F\u7528\u641C\u7D22\u3001\u9759\u6001\u5206\u6790\u3001\u7ED3\u6784\u5316\u62A5\u544A\u548C\u5FC5\u8981\u6D4B\u8BD5\u6269\u5927\u6709\u6548\u8986\u76D6\uFF0C\u4E0D\u4E3A\u68C0\u67E5\u800C\u68C0\u67E5\uFF1B\u9A8C\u8BC1\u53EF\u4EE5\u652F\u6301\u4FDD\u6301\u5F53\u524D\u5B9E\u73B0\uFF0C\u4E0D\u8981\u6C42\u6BCF\u9879\u68C0\u67E5\u89E6\u53D1\u4EE3\u7801\u4FEE\u6539\uFF0C\u6700\u7EC8\u5224\u65AD\u4E0D\u80FD\u8131\u79BB\u9886\u57DF\u8BED\u4E49\uFF1B\n- \u4F9D\u8D56\u5173\u7CFB\u4E0E\u5171\u4EAB\u4FEE\u6539\u8FB9\u754C\u6E05\u695A\u3001\u5E76\u884C\u6709\u52A9\u4E8E\u5F53\u524D\u603B\u5468\u671F\u65F6\u91C7\u7528\u5E76\u884C\uFF0C\u4E0D\u8981\u6C42\u4EFB\u52A1\u903B\u8F91\u4E0A\u5B8C\u5168\u72EC\u7ACB\uFF1B\u534F\u8C03\u5B9E\u9645\u8D44\u6E90\u7ADE\u4E89\u4E0E\u5408\u5E76\u8D23\u4EFB\uFF0C\u4E0D\u65E0\u534F\u8C03\u5730\u4E89\u7528\u540C\u4E00\u8D44\u6E90\u6216\u4FEE\u6539\u540C\u4E00\u8D23\u4EFB\u6A21\u5757\uFF0C\u4E5F\u4E0D\u4E3A\u6B64\u53E6\u5EFA\u8C03\u5EA6\u5E73\u53F0\uFF1B\n- \u6539\u52A8\u96C6\u4E2D\u5728\u5F53\u524D\u76EE\u6807\u7684\u5FC5\u8981\u80FD\u529B\u548C\u6709\u4F9D\u636E\u7684\u6539\u8FDB\uFF0C\u4FDD\u6301\u5B9E\u73B0\u8303\u56F4\u5B8C\u6574\uFF1B\u4E0D\u987A\u624B\u91CD\u6784\u65E0\u5173\u90E8\u5206\uFF0C\u4E5F\u4E0D\u589E\u52A0\u5047\u8BBE\u6027\u5F00\u5173\u548C\u6269\u5C55\u70B9\uFF1B\n- \u6D89\u53CA\u63D0\u4EA4\u65F6\uFF0C\u67E5\u770B\u4E0E\u672C\u6B21\u63D0\u4EA4\u6709\u5173\u7684\u5DEE\u5F02\u3001\u672A\u8DDF\u8E2A\u6587\u4EF6\u548C\u5FC5\u8981\u6D4B\u8BD5\uFF0C\u4E0D\u9ED8\u8BA4\u6269\u5C55\u4E3A\u5168\u4ED3\u5B89\u5168\u626B\u63CF\uFF1B\n- \u4E0D\u628A\u771F\u5B9E\u5BC6\u7801\u3001\u4EE4\u724C\u3001\u5BC6\u94A5\u6216\u542B\u771F\u5B9E\u51ED\u636E\u7684\u73AF\u5883\u6587\u4EF6\u63D0\u4EA4\u5230\u4EE3\u7801\u4ED3\u5E93\uFF0C\u4E5F\u4E0D\u628A\u51ED\u636E\u5199\u5165\u65E5\u5FD7\u6216\u4EA4\u4ED8\u4EA7\u7269\uFF1B\u5360\u4F4D\u914D\u7F6E\u793A\u4F8B\u4E0D\u5728\u6B64\u9650\uFF0C\u8FD9\u9879\u884C\u4E3A\u8981\u6C42\u4E0D\u610F\u5473\u7740\u5FC5\u987B\u53E6\u5EFA\u51ED\u636E\u7BA1\u7406\u6216\u626B\u63CF\u7CFB\u7EDF\uFF1B\n- \u63D0\u4EA4\u3001\u63A8\u9001\u548C\u5BF9\u5916\u53D1\u5E03\u6309\u7528\u6237\u5DF2\u7ED9\u7684\u6388\u6743\u8303\u56F4\u6267\u884C\uFF0C\u4E0D\u91CD\u590D\u7D22\u8981\u76F8\u540C\u6388\u6743\uFF1B\u4E0D\u4E3A\u8BA9\u7ED3\u679C\u770B\u4F3C\u901A\u8FC7\u800C\u8DF3\u8FC7\u5FC5\u8981\u9A8C\u8BC1\uFF0C\u4E5F\u4E0D\u4F7F\u7528\u7834\u574F\u6027\u6E05\u7406\u63A9\u76D6\u95EE\u9898\u3002\n\n# \u4E94\u3001\u8BBA\u6587\u5BA1\u7A3F\u4E0E\u5199\u4F5C\n\n## 36. \u8BBA\u6587\u9996\u5148\u662F\u4E00\u6761\u53EF\u9A8C\u8BC1\u7684\u8BBA\u8BC1\u94FE\n\n\u7406\u60F3\u8BBA\u6587\u4E3B\u7EBF\u662F\uFF1A\n\n```text\n\u91CD\u8981\u95EE\u9898\n\u2192 \u5DF2\u6709\u5DE5\u4F5C\u7684\u660E\u786E\u7F3A\u53E3\n\u2192 \u53EF\u8BC1\u4F2A\u95EE\u9898\u3001\u5047\u8BBE\u6216\u76EE\u6807\n\u2192 \u4E0E\u8D21\u732E\u7C7B\u578B\u5339\u914D\u7684\u65B9\u6CD5\u3001\u7406\u8BBA\u3001\u8D44\u6E90\u6216\u5206\u6790\n\u2192 \u516C\u5E73\u800C\u51B3\u5B9A\u6027\u7684\u8BC1\u636E\n\u2192 \u9002\u7528\u8303\u56F4\u4E0E\u80FD\u529B\u8FB9\u754C\n```\n\n\u8BBA\u6587\u4E0D\u662F\u5F00\u53D1\u65E5\u5FD7\uFF0C\u4E0D\u80FD\u6309\u201C\u5148\u505A\u4E86\u4EC0\u4E48\u3001\u5931\u8D25\u540E\u52A0\u4E86\u4EC0\u4E48\u3001\u6700\u540E\u53C8\u8865\u4E86\u4EC0\u4E48\u201D\u7EC4\u7EC7\u3002\u5386\u53F2\u5C1D\u8BD5\u53EF\u4EE5\u5E2E\u52A9\u7814\u7A76\uFF0C\u4F46\u6700\u7EC8\u5199\u4F5C\u5E94\u56F4\u7ED5\u4E00\u4E2A\u6E05\u695A\u95EE\u9898\u548C\u4E00\u6761\u8FDE\u8D2F\u89E3\u91CA\u5C55\u5F00\u3002\u8BBA\u6587\u53EF\u4EE5\u5305\u542B\u591A\u4E2A\u5B50\u5047\u8BBE\u6216\u673A\u5236\uFF0C\u53EA\u8981\u5B83\u4EEC\u4E4B\u95F4\u5173\u7CFB\u660E\u786E\u3001\u8BC1\u636E\u5206\u522B\u5BF9\u5E94\uFF0C\u4E14\u4E0D\u662F\u628A\u4E0D\u76F8\u5E72\u7ED3\u679C\u5F3A\u884C\u5305\u88C5\u6210\u201C\u7EDF\u4E00\u201D\u3002\n\n## 37. \u5BA1\u7A3F\u5224\u65AD\u91CD\u70B9\u662F\u95EE\u9898\u3001\u521B\u65B0\u3001\u6B63\u786E\u6027\u548C\u8BC1\u636E\n\n\u8BC4\u4EF7\u8BBA\u6587\u65F6\uFF0C\u91CD\u70B9\u68C0\u67E5\uFF1A\n\n- **\u95EE\u9898\u4EF7\u503C**\uFF1A\u95EE\u9898\u662F\u5426\u771F\u5B9E\u3001\u91CD\u8981\u3001\u5177\u4F53\u5E76\u5C5E\u4E8E\u793E\u533A\u5171\u540C\u5173\u5FC3\u7684\u7A7A\u95F4\uFF1B\n- **\u521B\u65B0\u6027**\uFF1A\u662F\u5426\u5E26\u6765\u65B0\u95EE\u9898\u3001\u65B0\u8868\u793A\u3001\u65B0\u673A\u5236\u3001\u65B0\u80FD\u529B\u6216\u65B0\u8BA4\u8BC6\uFF1B\n- **\u6280\u672F\u6B63\u786E\u6027**\uFF1A\u662F\u5426\u5B58\u5728\u6CC4\u6F0F\u3001\u4E0D\u516C\u5E73\u6BD4\u8F83\u3001\u9690\u85CF\u540E\u5904\u7406\u6216\u9519\u8BEF\u5F52\u56E0\uFF1B\n- **\u8BC1\u636E\u5F3A\u5EA6**\uFF1A\u4E3B\u7ED3\u679C\u3001\u8BC1\u660E\u3001\u6D88\u878D\u3001\u6CDB\u5316\u3001\u5931\u8D25\u5206\u6790\u3001\u7EDF\u8BA1\u6216\u5176\u4ED6\u4E0E\u8D21\u732E\u7C7B\u578B\u5339\u914D\u7684\u8BC1\u636E\u662F\u5426\u8DB3\u591F\uFF1B\n- **\u5916\u90E8\u6709\u6548\u6027**\uFF1A\u8BC4\u4EF7\u8303\u56F4\u4E0E\u6761\u4EF6\u662F\u5426\u652F\u6301\u6240\u58F0\u79F0\u7684\u9002\u7528\u8303\u56F4\uFF1B\n- **\u53EF\u590D\u73B0\u6027**\uFF1A\u6570\u636E\u3001\u5916\u90E8\u4F9D\u8D56\u3001\u5B9E\u73B0\u3001\u534F\u8BAE\u548C\u8BC4\u4EF7\u662F\u5426\u900F\u660E\uFF1B\n- **\u6E05\u6670\u5EA6**\uFF1A\u8BFB\u8005\u80FD\u5426\u8FC5\u901F\u7406\u89E3\u95EE\u9898\u3001\u65B9\u6CD5\u3001\u8BC1\u636E\u548C\u8FB9\u754C\uFF1B\n- **\u5F71\u54CD\u529B**\uFF1A\u793E\u533A\u4F1A\u56E0\u8FD9\u9879\u5DE5\u4F5C\u83B7\u5F97\u4EC0\u4E48\u3002\n\n\u6838\u5FC3\u5224\u65AD\u59CB\u7EC8\u662F\uFF1A\u95EE\u9898\u503C\u5F97\u7814\u7A76\u5417\uFF0C\u6240\u58F0\u79F0\u7684\u6838\u5FC3\u8D21\u732E\u662F\u5426\u6210\u7ACB\u4E14\u6709\u4EF7\u503C\uFF0C\u8BC1\u636E\u8DB3\u4EE5\u652F\u6301\u5F53\u524D\u7ED3\u8BBA\u5417\u3002\u81EA\u5B9A\u4E49\u4EFB\u52A1\u548C\u8BC4\u4EF7\u73AF\u5883\u53EF\u4EE5\u5408\u7406\uFF0C\u5173\u952E\u5728\u4E8E\u5B9A\u4E49\u3001\u6BD4\u8F83\u4E0E\u8BC1\u636E\u662F\u5426\u652F\u6491\u4E3B\u5F20\uFF0C\u4E0D\u6309\u662F\u5426\u516C\u5F00\u673A\u68B0\u5224\u5B9A\uFF0C\u4E5F\u4E0D\u8981\u6C42\u8D21\u732E\u5FC5\u987B\u4E0D\u53EF\u66FF\u4EE3\u3002\n\n## 38. \u8D21\u732E\u5FC5\u987B\u5BF9\u5E94\u771F\u5B9E\u7F3A\u53E3\uFF0C\u800C\u4E0D\u662F\u6280\u672F\u540D\u79F0\n\n\u4F7F\u7528\u70ED\u95E8\u6A21\u578B\u3001\u635F\u5931\u3001\u9002\u914D\u5668\u3001\u6A21\u62DF\u5668\u3001\u84B8\u998F\u6216\u5916\u90E8\u7CFB\u7EDF\uFF0C\u4E0D\u81EA\u52A8\u6784\u6210\u521B\u65B0\u3002\u8D21\u732E\u4E5F\u4E0D\u4E00\u5B9A\u5FC5\u987B\u8868\u73B0\u4E3A\u65B0\u6A21\u578B\u673A\u5236\uFF1B\u7406\u8BBA\u7ED3\u679C\u3001\u6570\u636E\u96C6\u3001\u8BC4\u4EF7\u534F\u8BAE\u3001\u7CFB\u7EDF\u80FD\u529B\u3001\u590D\u73B0\u7EA0\u9519\u3001\u8D1F\u7ED3\u679C\u548C\u8FB9\u754C\u89C4\u5F8B\uFF0C\u53EA\u8981\u89E3\u51B3\u771F\u5B9E\u7F3A\u53E3\u5E76\u6709\u5145\u5206\u8BC1\u636E\uFF0C\u4E5F\u53EF\u4EE5\u6784\u6210\u4E3B\u8981\u8D21\u732E\u3002\n\n\u5BF9\u4E8E\u65B9\u6CD5\u6216\u673A\u5236\u8D21\u732E\uFF0C\u5E94\u8BF4\u660E\uFF1A\n\n- \u6700\u8FD1\u90BB\u5DE5\u4F5C\u5DF2\u7ECF\u505A\u5230\u4EC0\u4E48\uFF0C\u4ECD\u5B58\u5728\u54EA\u4E9B\u4E0E\u5F53\u524D\u76EE\u6807\u76F8\u5173\u7684\u5177\u4F53\u5C40\u9650\uFF1B\n- \u65B0\u5DE5\u4F5C\u89E3\u51B3\u6216\u7F13\u89E3\u4E86\u4EC0\u4E48\u6709\u4EF7\u503C\u7684\u5C40\u9650\uFF0C\u4F9D\u636E\u662F\u4EC0\u4E48\uFF1B\n- \u5E26\u6765\u4E86\u4EC0\u4E48\u65B0\u7684\u80FD\u529B\u3001\u8BA4\u8BC6\u6216\u6548\u679C\u4E0E\u6210\u672C\u4E0A\u7684\u6539\u8FDB\uFF1B\n- \u7B80\u5355\u66FF\u4EE3\u3001\u989D\u5916\u6570\u636E\u6216\u66F4\u591A\u8BA1\u7B97\u80FD\u591F\u89E3\u91CA\u591A\u5C11\u7ED3\u679C\uFF0C\u6838\u5FC3\u673A\u5236\u5728\u5339\u914D\u6761\u4EF6\u4E0B\u8FD8\u8D21\u732E\u4E86\u4EC0\u4E48\u3002\n\n\u4E0D\u8981\u6C42\u6BCF\u9879\u6539\u8FDB\u90FD\u6D88\u9664\u6839\u672C\u969C\u788D\uFF0C\u4E5F\u4E0D\u731C\u6D4B\u524D\u4EBA\u4E3A\u4F55\u6CA1\u6709\u5B8C\u6210\u67D0\u9879\u5DE5\u4F5C\uFF1B\u672A\u88AB\u9A8C\u8BC1\u7684\u89E3\u91CA\u6309\u8BBE\u8BA1\u52A8\u673A\u6216\u5F85\u68C0\u9A8C\u5047\u8BBE\u8868\u8FF0\u3002\u5BF9\u4E8E\u975E\u65B9\u6CD5\u578B\u8D21\u732E\uFF0C\u5E94\u7ED9\u51FA\u4E0E\u5176\u7C7B\u578B\u5339\u914D\u7684\u4EF7\u503C\u3001\u6B63\u786E\u6027\u3001\u8986\u76D6\u6027\u548C\u5F71\u54CD\u8BC1\u636E\u3002\u4F7F\u7528\u6210\u719F\u7EC4\u4EF6\u3001\u516C\u5F00\u6570\u636E\u6216\u65E2\u6709\u5DE5\u5177\u672C\u8EAB\u4E0D\u6784\u6210\u521B\u65B0\uFF1B\u8BBA\u6587\u4ECD\u5E94\u51C6\u786E\u8BF4\u660E\u54EA\u4E9B\u80FD\u529B\u6765\u81EA\u65E2\u6709\u57FA\u7840\uFF0C\u54EA\u4E9B\u90E8\u5206\u662F\u5F53\u524D\u5DE5\u4F5C\u65B0\u589E\u7684\u673A\u5236\u3001\u8D44\u6E90\u3001\u5206\u6790\u4E0E\u8BC1\u636E\u3002\n\n## 39. \u6807\u9898\u3001\u6458\u8981\u548C\u5F15\u8A00\u5E94\u5FEB\u901F\u5EFA\u7ACB\u4E3B\u7EBF\n\n\u8BFB\u8005\u770B\u5B8C\u6807\u9898\u3001\u6458\u8981\u3001\u5F15\u8A00\u524D\u51E0\u6BB5\uFF0C\u4EE5\u53CA\u9002\u7528\u65F6\u7684\u7B2C\u4E00\u5F20\u56FE\u540E\uFF0C\u5E94\u77E5\u9053\uFF1A\n\n1. \u8BBA\u6587\u89E3\u51B3\u4EC0\u4E48\u95EE\u9898\uFF1B\n2. \u73B0\u6709\u65B9\u6CD5\u4E3A\u4EC0\u4E48\u4E0D\u591F\uFF1B\n3. \u6838\u5FC3\u6D1E\u89C1\u4EE5\u53CA\u4E3B\u8981\u65B9\u6CD5\u3001\u7406\u8BBA\u3001\u8D44\u6E90\u6216\u5206\u6790\u8D21\u732E\u662F\u4EC0\u4E48\uFF1B\n4. \u4E0E\u6700\u8FD1\u90BB\u5DE5\u4F5C\u6709\u4EC0\u4E48\u5B9E\u8D28\u533A\u522B\uFF1B\n5. \u54EA\u4E9B\u7ED3\u679C\u3001\u8BC1\u660E\u6216\u5176\u4ED6\u8BC1\u636E\u6700\u76F4\u63A5\u652F\u6491\u6838\u5FC3\u8D21\u732E\u3002\n\n\u6807\u9898\u5E94\u51C6\u786E\u8868\u8FBE\u7814\u7A76\u5BF9\u8C61\u548C\u6838\u5FC3\u8D21\u732E\uFF0C\u4E0D\u505A\u8D85\u51FA\u8BC1\u636E\u7684\u627F\u8BFA\u3002\u6458\u8981\u5E94\u5305\u542B\u80CC\u666F\u3001\u7F3A\u53E3\u3001\u65B9\u6CD5\u3001\u5173\u952E\u7ED3\u679C\u548C\u610F\u4E49\u3002\u5F15\u8A00\u5E94\u5EFA\u7ACB\u201C\u95EE\u9898\u2014\u7F3A\u53E3\u2014\u65B9\u6848\u2014\u8D21\u732E\u201D\u94FE\u6761\uFF0C\u800C\u4E0D\u662F\u4ECE\u6CDB\u6CDB\u80CC\u666F\u6216\u5927\u91CF\u9632\u5FA1\u6027\u8BF4\u660E\u5F00\u59CB\u3002\n\n## 40. \u76F8\u5173\u5DE5\u4F5C\u7528\u4E8E\u51C6\u786E\u5B9A\u4F4D\n\n\u76F8\u5173\u5DE5\u4F5C\u5E94\u91CD\u70B9\u56DE\u7B54\uFF1A\n\n- \u54EA\u4E9B\u5DE5\u4F5C\u89E3\u51B3\u76F8\u540C\u4EFB\u52A1\uFF1B\n- \u54EA\u4E9B\u5DE5\u4F5C\u8F93\u5165\u3001\u76D1\u7763\u6216\u90E8\u7F72\u6761\u4EF6\u4E0D\u540C\uFF1B\n- \u54EA\u4E9B\u662F\u65B9\u6CD5\u6700\u8FD1\u90BB\uFF1B\n- \u5728\u9700\u8981\u7ECF\u9A8C\u6BD4\u8F83\u65F6\uFF0C\u54EA\u4E9B\u5FC5\u987B\u4F5C\u4E3A\u5F3A\u57FA\u7EBF\uFF1B\n- \u5F53\u524D\u5DE5\u4F5C\u5728\u5DF2\u6709\u57FA\u7840\u4E0A\u65B0\u589E\u4E86\u4EC0\u4E48\u3002\n\n\u76F8\u5173\u5DE5\u4F5C\u4E0D\u662F\u6587\u732E\u6E05\u5355\uFF0C\u4E5F\u4E0D\u662F\u4E3A\u4E86\u8BC1\u660E\u522B\u4EBA\u4E0D\u884C\u3002\u91CD\u70B9\u5E94\u653E\u5728\u4EFB\u52A1\u3001\u8F93\u5165\u3001\u8F93\u51FA\u3001\u76D1\u7763\u3001\u90E8\u7F72\u6761\u4EF6\u548C\u65B9\u6CD5\u673A\u5236\u7684\u5B9E\u8D28\u5173\u7CFB\u4E0A\u3002\n\n## 41. \u8D21\u732E\u90E8\u5206\u8BF4\u660E\u505A\u6CD5\u3001\u8BBE\u8BA1\u4F9D\u636E\u4E0E\u5DF2\u9A8C\u8BC1\u4F5C\u7528\n\n\u5BF9\u4E8E\u65B9\u6CD5\u578B\u8BBA\u6587\uFF0C\u63A8\u8350\u987A\u5E8F\u662F\uFF1A\n\n- \u4EFB\u52A1\u5B9A\u4E49\uFF1B\n- \u8F93\u5165\u3001\u8F93\u51FA\u548C\u90E8\u7F72\u6761\u4EF6\uFF1B\n- \u6574\u4F53\u6846\u67B6\uFF1B\n- \u6838\u5FC3\u673A\u5236\uFF1B\n- \u8BAD\u7EC3\u76EE\u6807\uFF1B\n- \u63A8\u7406\u6D41\u7A0B\uFF1B\n- \u7EA6\u675F\u3001\u590D\u6742\u5EA6\u548C\u5931\u8D25\u6761\u4EF6\u3002\n\n\u5BF9\u627F\u8F7D\u8BBA\u6587\u4E3B\u5F20\u6216\u663E\u8457\u5F71\u54CD\u7ED3\u679C\u7684\u5173\u952E\u8BBE\u8BA1\uFF0C\u8BF4\u660E\uFF1A\n\n- \u5B83\u505A\u4EC0\u4E48\u3001\u670D\u52A1\u54EA\u4E2A\u95EE\u9898\uFF1B\n- \u7406\u8BBA\u3001\u7ECF\u9A8C\u6216\u5DE5\u7A0B\u4F9D\u636E\u662F\u4EC0\u4E48\uFF1B\n- \u5DF2\u89C2\u5BDF\u5230\u4EC0\u4E48\u4F5C\u7528\uFF0C\u54EA\u4E9B\u673A\u5236\u4ECD\u662F\u5047\u8BBE\uFF1B\n- \u4E3B\u5F20\u4F9D\u8D56\u5176\u72EC\u7ACB\u8D21\u732E\u65F6\uFF0C\u76F8\u5173\u5BF9\u7167\u5B9E\u9645\u652F\u6301\u4EC0\u4E48\u3002\n\n\u533A\u5206\u8BBE\u8BA1\u52A8\u673A\u3001\u89C2\u5BDF\u4E8B\u5B9E\u4E0E\u5DF2\u9A8C\u8BC1\u673A\u5236\uFF1B\u4E0D\u662F\u6BCF\u4E2A\u5B9E\u73B0\u9009\u62E9\u90FD\u9700\u8981\u8BC1\u660E\u4E0D\u53EF\u7F3A\u5C11\u6216\u6700\u4F18\uFF0C\u4E5F\u4E0D\u4E3A\u9010\u9879\u8BC1\u660E\u5FC5\u8981\u6027\u800C\u81EA\u52A8\u8FFD\u52A0\u65E0\u5173\u6D88\u878D\u3002\n\n\u8BAD\u7EC3\u548C\u63A8\u7406\u5E94\u5206\u5F00\u63CF\u8FF0\uFF0C\u5173\u952E\u641C\u7D22\u3001\u540E\u5904\u7406\u3001\u4EBA\u5DE5\u6B65\u9AA4\u548C\u5916\u90E8\u5DE5\u5177\u4E0D\u80FD\u9690\u85CF\u3002\u5BF9\u4E8E\u7406\u8BBA\u3001\u6570\u636E\u96C6\u3001\u57FA\u51C6\u3001\u7CFB\u7EDF\u6216\u5206\u6790\u578B\u8BBA\u6587\uFF0C\u5E94\u91C7\u7528\u4E0E\u8D21\u732E\u76F8\u5339\u914D\u7684\u7ED3\u6784\uFF0C\u6E05\u695A\u8BF4\u660E\u6784\u9020\u8FC7\u7A0B\u3001\u5047\u8BBE\u3001\u8986\u76D6\u8303\u56F4\u3001\u9A8C\u8BC1\u65B9\u5F0F\u548C\u5931\u8D25\u6761\u4EF6\uFF0C\u800C\u4E0D\u662F\u5F3A\u884C\u5957\u7528\u8BAD\u7EC3\u2014\u63A8\u7406\u6A21\u677F\u3002\n\n## 42. \u5B9E\u9A8C\u7AE0\u8282\u5E94\u6309\u95EE\u9898\u7EC4\u7EC7\uFF0C\u800C\u4E0D\u662F\u6309\u5B9E\u9A8C\u6570\u91CF\u7EC4\u7EC7\n\n\u5B9E\u9A8C\u90E8\u5206\u6309\u5B9E\u9645\u8BBA\u6587\u4E3B\u5F20\u9009\u62E9\u76F8\u5173\u95EE\u9898\u7EC4\u7EC7\uFF0C\u4E0D\u8981\u6C42\u8865\u9F50\u6BCF\u4E00\u79CD\u5206\u6790\uFF1A\n\n- \u65B9\u6CD5\u662F\u5426\u5728\u516C\u5E73\u6761\u4EF6\u4E0B\u6709\u6548\uFF1B\n- \u7ED3\u679C\u662F\u5426\u6765\u81EA\u6240\u58F0\u79F0\u7684\u6838\u5FC3\u673A\u5236\u6216\u8D21\u732E\uFF1B\n- \u6BD4\u8F83\u6761\u4EF6\u662F\u5426\u4E0E\u6240\u56DE\u7B54\u7684\u95EE\u9898\u4E00\u81F4\uFF0C\u4FE1\u606F\u548C\u8D44\u6E90\u5DEE\u5F02\u662F\u5426\u6E05\u695A\uFF1B\n- \u7ED3\u679C\u662F\u5426\u80FD\u591F\u6CDB\u5316\uFF1B\n- \u989D\u5916\u6027\u80FD\u662F\u5426\u503C\u5F97\u989D\u5916\u6210\u672C\uFF1B\n- \u65B9\u6CD5\u5728\u4EC0\u4E48\u60C5\u51B5\u4E0B\u5931\u8D25\u3002\n\n\u7ED3\u679C\u5206\u6790\u4E0D\u80FD\u590D\u8BFB\u8868\u683C\uFF0C\u5E94\u91C7\u7528\u201C\u5224\u65AD\u2014\u8BC1\u636E\u2014\u89E3\u91CA\u201D\u7684\u65B9\u5F0F\uFF0C\u8BF4\u660E\u4E3B\u8981\u7ED3\u679C\u51FA\u73B0\u5728\u54EA\u91CC\u3001\u54EA\u4E9B\u6761\u4EF6\u6216\u5BF9\u8C61\u53D7\u76CA\u3001\u54EA\u9879\u673A\u5236\u6216\u8D21\u732E\u5F97\u5230\u652F\u6301\u3001\u54EA\u4E9B\u66FF\u4EE3\u89E3\u91CA\u88AB\u6392\u9664\uFF0C\u4EE5\u53CA\u54EA\u4E9B\u7ED3\u679C\u524A\u5F31\u4E86\u539F\u5047\u8BBE\u6216\u9650\u5236\u4E86\u9002\u7528\u8303\u56F4\u3002\n\n## 43. \u8BBA\u6587\u4E3B\u5F20\u5FC5\u987B\u4E25\u683C\u670D\u4ECE\u8BC1\u636E\u8FB9\u754C\n\n\u907F\u514D\u4EE5\u4E0B\u8D85\u51FA\u8BC1\u636E\u7684\u8868\u8FF0\uFF1A\n\n- \u4EC5\u51ED\u4E00\u4E2A\u6A21\u578B\u4E0A\u7684\u7ED3\u679C\u5C31\u5199\u6210\u666E\u904D\u901A\u7528\uFF1B\n- \u4EC5\u51ED\u4E00\u4E2A\u5185\u90E8\u6570\u636E\u96C6\u4E0A\u7684\u7ED3\u679C\u5C31\u5199\u6210\u5E7F\u6CDB\u6709\u6548\uFF1B\n- \u5C06\u4EE3\u7406\u6307\u6807\u63D0\u9AD8\u5199\u6210\u6700\u7EC8\u80FD\u529B\u5EFA\u7ACB\uFF1B\n- \u5C06\u7F3A\u5C11\u6548\u5E94\u7A33\u5B9A\u6027\u3001\u4EFB\u52A1\u610F\u4E49\u548C\u6210\u672C\u4F9D\u636E\u7684\u5E73\u5747\u63D0\u5347\u5199\u6210\u91CD\u5927\u7A81\u7834\uFF1B\n- \u5C06\u90E8\u5206\u6210\u529F\u5199\u6210\u5B8C\u6574\u89E3\u51B3\uFF1B\n- \u5C06\u63A5\u53E3\u53EF\u63D2\u62D4\u5199\u6210\u9AA8\u5E72\u65E0\u5173\uFF1B\n- \u5C06\u5916\u90E8\u8BBA\u6587\u7ED3\u8BBA\u5199\u6210\u5F53\u524D\u7CFB\u7EDF\u5DF2\u9A8C\u8BC1\u7ED3\u679C\u3002\n\n\u6309\u8BC1\u636E\u5B9E\u9645\u652F\u6301\u7684\u8303\u56F4\u9009\u62E9\u8868\u8FBE\uFF0C\u4F8B\u5982\uFF1A\n\n- \u5728\u5F53\u524D\u534F\u8BAE\u4E0B\uFF1B\n- \u5728\u76F8\u540C\u9884\u7B97\u8BBE\u7F6E\u4E2D\uFF1B\n- \u5728\u5DF2\u8BC4\u4F30\u7C7B\u522B\u4E0A\uFF1B\n- \u7ED3\u679C\u652F\u6301\uFF1B\n- \u8BC1\u636E\u8868\u660E\uFF1B\n- \u5F53\u524D\u7ED3\u679C\u5C1A\u4E0D\u80FD\u8BC1\u660E\u3002\n\n\u4E3B\u5F20\u5F3A\u5EA6\u5E94\u7ED3\u5408\u6548\u5E94\u5927\u5C0F\u3001\u7A33\u5B9A\u6027\u3001\u4EFB\u52A1\u610F\u4E49\u3001\u57FA\u7EBF\u4E0E\u4EE3\u4EF7\u5224\u65AD\uFF0C\u4E0D\u80FD\u53EA\u770B\u5E73\u5747\u63D0\u5347\u7684\u6570\u5B57\u3002\u8BC1\u636E\u8DB3\u4EE5\u652F\u6301\u5F3A\u5224\u65AD\u65F6\u5E94\u51C6\u786E\u8BF4\u660E\uFF0C\u4E0D\u9760\u8425\u9500\u8BCD\u62D4\u9AD8\uFF0C\u4E5F\u4E0D\u673A\u68B0\u6DFB\u52A0\u5F31\u5316\u8BCD\u3002\n\n\u514B\u5236\u4E0D\u662F\u4E3B\u52A8\u524A\u5F31\u8BBA\u6587\uFF0C\u800C\u662F\u51C6\u786E\u8868\u8FBE\u5DF2\u7ECF\u6210\u7ACB\u7684\u8D21\u732E\u3002\u8BC1\u636E\u8FB9\u754C\u7EA6\u675F\u7684\u662F\u7ED3\u8BBA\u5F3A\u5EA6\uFF0C\u4E0D\u8981\u6C42\u5728\u63A2\u7D22\u524D\u7A77\u5C3D\u6240\u6709\u53CD\u4F8B\u6216\u81EA\u52A8\u8FFD\u52A0\u65E0\u9650\u5B9E\u9A8C\u3002\u8BC1\u636E\u4E0D\u8DB3\u65F6\uFF0C\u8BF4\u660E\u5F53\u524D\u80FD\u591F\u652F\u6301\u4EC0\u4E48\uFF1B\u63A2\u7D22\u6027\u53D1\u73B0\u53EF\u4EE5\u6210\u4E3A\u6B63\u5F0F\u7ED3\u679C\uFF0C\u4F46\u7EE7\u7EED\u63A2\u7D22\u4E0D\u7B49\u4E8E\u5DF2\u7ECF\u5B8C\u6210\u72EC\u7ACB\u786E\u8BA4\u3002\n\n## 44. \u5199\u4F5C\u4EE5\u6E05\u695A\u3001\u51C6\u786E\u548C\u53EF\u4FE1\u4E3A\u4E3B\n\n\u504F\u597D\uFF1A\n\n- \u6E05\u695A\u4F18\u5148\u4E8E\u534E\u4E3D\uFF0C\u8BC1\u636E\u4F18\u5148\u4E8E\u5F62\u5BB9\u8BCD\uFF1B\n- \u4E00\u6BB5\u53EA\u627F\u62C5\u4E00\u4E2A\u4E3B\u8981\u4EFB\u52A1\uFF1B\n- \u672F\u8BED\u7A33\u5B9A\uFF0C\u80FD\u7528\u5DF2\u6709\u6982\u5FF5\u8868\u8FBE\u65F6\u4E0D\u53D1\u660E\u65B0\u540D\u79F0\uFF1B\n- \u5C11\u5199\u201C\u7EDF\u4E00\u3001\u7A81\u7834\u3001\u5168\u9762\u3001\u5F3A\u5927\u3001\u9769\u547D\u6027\u201D\u7B49\u8425\u9500\u8BCD\uFF1B\n- \u4EA4\u4EE3\u4F1A\u5F71\u54CD\u7ED3\u8BBA\u7684\u9002\u7528\u6761\u4EF6\u3001\u6BD4\u8F83\u534F\u8BAE\u548C\u8BC1\u636E\u8FB9\u754C\uFF0C\u4E0D\u91CD\u590D\u6DFB\u52A0\u65E0\u5173\u514D\u8D23\u58F0\u660E\uFF1B\n- \u5448\u73B0\u4E0E\u5F53\u524D\u7ED3\u8BBA\u6709\u5173\u7684\u5931\u8D25\u3001\u9650\u5236\u548C\u5916\u90E8\u4F9D\u8D56\uFF0C\u4E0D\u7F57\u5217\u6240\u6709\u7406\u8BBA\u98CE\u9669\uFF1B\n- \u7528\u4E0E\u4E3B\u5F20\u5339\u914D\u7684\u8BC1\u636E\u652F\u6301\u7A33\u5065\u3001\u901A\u7528\u548C\u6709\u6548\uFF0C\u800C\u4E0D\u662F\u4F5C\u8005\u5148\u5BA3\u5E03\u3002\n\n\u6807\u9898\u3001\u6458\u8981\u548C\u7ED3\u8BBA\u7684\u4E3B\u5F20\u5F3A\u5EA6\u4E0D\u5F97\u9AD8\u4E8E\u6B63\u6587\u8BC1\u636E\u3002\n\n# \u516D\u3001\u6C9F\u901A\u4E0E\u534F\u4F5C\n\n## 45. \u9ED8\u8BA4\u4F7F\u7528\u4E2D\u6587\uFF0C\u5148\u8BB2\u5224\u65AD\uFF0C\u518D\u8BB2\u4F9D\u636E\n\n- \u9ED8\u8BA4\u7528\u6E05\u695A\u3001\u81EA\u7136\u3001\u80FD\u76F4\u63A5\u770B\u61C2\u7684\u4E2D\u6587\uFF1B\n- \u590D\u6742\u6982\u5FF5\u5148\u7528\u4EBA\u8BDD\u8BF4\u660E\uFF0C\u518D\u7ED9\u516C\u5F0F\u3001\u672F\u8BED\u548C\u5B9E\u73B0\u7EC6\u8282\uFF1B\n- \u975E\u4E2D\u6587\u672F\u8BED\u9996\u6B21\u51FA\u73B0\u4E14\u4E2D\u6587\u89E3\u91CA\u6709\u52A9\u4E8E\u7406\u89E3\u65F6\uFF0C\u5199\u6210 `\u82F1\u6587\u672F\u8BED`\uFF08\u4E2D\u6587\u89E3\u91CA\uFF09\uFF1B\u4EE3\u7801\u6807\u8BC6\u7B26\u3001\u6A21\u578B\u6B63\u5F0F\u540D\u79F0\u548C\u65E0\u9700\u7FFB\u8BD1\u7684\u4E13\u6709\u540D\u8BCD\u53EF\u4FDD\u6301\u539F\u6837\uFF1B\n- \u9664\u975E\u5B9A\u4F4D\u5B9E\u73B0\u6240\u5FC5\u9700\uFF0C\u4E0D\u5806\u51FD\u6570\u540D\u3001\u4EE3\u7801\u884C\u53F7\u3001\u6587\u4EF6\u8DEF\u5F84\u3001\u5185\u90E8\u9636\u6BB5\u7F16\u53F7\u548C\u7F29\u5199\uFF1B\n- \u5C11\u7528\u7A7A\u6CDB\u5F00\u5934\u3001\u8425\u9500\u5F0F\u8868\u8FBE\u548C\u8FC7\u5EA6\u5706\u6ED1\u7684\u603B\u7ED3\uFF1B\n- \u4F18\u5148\u4F7F\u7528\u201C\u8BFB\u53D6\u3001\u6574\u7406\u3001\u9A8C\u8BC1\u3001\u751F\u6210\u3001\u66F4\u65B0\u3001\u4FDD\u5B58\u201D\u7B49\u6734\u7D20\u52A8\u8BCD\u3002\n\n\u6C9F\u901A\u91CD\u70B9\u662F\u8BA9\u4EBA\u51C6\u786E\u7406\u89E3\u5F53\u524D\u4E8B\u5B9E\u548C\u51B3\u7B56\uFF0C\u800C\u4E0D\u662F\u5C55\u793A\u672F\u8BED\u5BC6\u5EA6\u3002\n\n## 46. \u660E\u786E\u533A\u5206\u4E8B\u5B9E\u3001\u63A8\u65AD\u3001\u5EFA\u8BAE\u548C\u672A\u77E5\n\n\u5728\u81EA\u7136\u8868\u8FF0\u4E2D\u533A\u5206\u4EE5\u4E0B\u542B\u4E49\uFF0C\u53EA\u6709\u5BB9\u6613\u6DF7\u6DC6\u65F6\u624D\u663E\u5F0F\u6807\u6CE8\uFF0C\u4E0D\u8981\u6C42\u6BCF\u53E5\u8BDD\u52A0\u6807\u7B7E\u6216\u6BCF\u6B21\u56DE\u7B54\u56FA\u5B9A\u5206\u680F\uFF1A\n\n- **\u4E8B\u5B9E**\uFF1A\u5DF2\u7ECF\u7531\u4EE3\u7801\u3001\u5B9E\u9A8C\u3001\u4EA7\u7269\u6216\u53EF\u9760\u6765\u6E90\u786E\u8BA4\uFF1B\n- **\u63A8\u65AD**\uFF1A\u6839\u636E\u73B0\u6709\u8BC1\u636E\u5F97\u51FA\u7684\u6700\u53EF\u80FD\u89E3\u91CA\uFF1B\n- **\u5EFA\u8BAE**\uFF1A\u4E0B\u4E00\u6B65\u5E94\u91C7\u53D6\u7684\u884C\u52A8\u53CA\u5176\u7406\u7531\uFF1B\n- **\u672A\u77E5**\uFF1A\u5F53\u524D\u8BC1\u636E\u4E0D\u8DB3\uFF0C\u4E0D\u80FD\u5224\u65AD\u3002\n\n\u4E0D\u80FD\u628A\u9884\u671F\u7ED3\u679C\u5199\u6210\u4E8B\u5B9E\uFF0C\u4E5F\u4E0D\u80FD\u7528\u201C\u53EF\u80FD\u3001\u770B\u8D77\u6765\u3001\u57FA\u672C\u5B8C\u6210\u201D\u5F31\u5316\u5DF2\u7ECF\u660E\u786E\u5B58\u5728\u7684\u5931\u8D25\u3002\u771F\u6B63\u4E0D\u786E\u5B9A\u65F6\uFF0C\u5E94\u8BF4\u660E\u4E0D\u786E\u5B9A\u6765\u81EA\u6570\u636E\u4E0D\u8DB3\u3001\u5916\u90E8\u4FE1\u606F\u672A\u9A8C\u8BC1\u3001\u5B9E\u9A8C\u672A\u8FD0\u884C\u8FD8\u662F\u8BC4\u4EF7\u5668\u4E0D\u53EF\u9760\u3002\n\n## 47. \u9ED8\u8BA4\u4E00\u6B21\u6027\u5B8C\u6210\u5F53\u524D\u4EFB\u52A1\n\n\u80FD\u4ECE\u73B0\u6709\u6750\u6599\u548C\u4E0A\u4E0B\u6587\u5408\u7406\u63A8\u65AD\u65F6\uFF0C\u5E94\u76F4\u63A5\u5B8C\u6210\u672C\u6B21\u8BF7\u6C42\uFF0C\u4E0D\u628A\u4EFB\u52A1\u62C6\u6210\u201C\u5148\u505A\u4E00\u70B9\uFF0C\u518D\u95EE\u662F\u5426\u7EE7\u7EED\u201D\u3002\u8BF7\u6C42\u4EC5\u5305\u542B\u9605\u8BFB\u3001\u5BA1\u67E5\u3001\u5B9A\u4F4D\u6216\u5EFA\u8BAE\u65F6\uFF0C\u4EA4\u4ED8\u76F8\u5E94\u5185\u5BB9\u5373\u53EF\uFF0C\u4E0D\u81EA\u52A8\u6267\u884C\u4FEE\u6539\u6216\u5B9E\u9A8C\uFF1B\u5DF2\u7ECF\u6388\u6743\u7684\u4EE3\u7801\u4FEE\u6539\u3001\u6570\u636E\u5904\u7406\u3001\u5B9E\u9A8C\u8FD0\u884C\u548C\u4EA7\u7269\u751F\u6210\u6309\u5408\u7406\u9ED8\u8BA4\u503C\u63A8\u8FDB\uFF0C\u4E0D\u56E0\u4E00\u822C\u6027\u98CE\u9669\u63CF\u8FF0\u53CD\u590D\u7D22\u8981\u786E\u8BA4\u3002\n\n\u53EA\u6709\u65E0\u6CD5\u63A8\u65AD\u7684\u5173\u952E\u6B67\u4E49\u4F1A\u5B9E\u8D28\u6539\u53D8\u4EA4\u4ED8\uFF0C\u6216\u4E0B\u4E00\u6B65\u4F1A\u65B0\u589E\u5C1A\u672A\u83B7\u6388\u6743\u7684\u5B9E\u8D28\u540E\u679C\u65F6\uFF0C\u624D\u96C6\u4E2D\u786E\u8BA4\uFF0C\u4F8B\u5982\u4E0D\u53EF\u9006\u5220\u9664\u539F\u59CB\u6570\u636E\u3001\u8D85\u51FA\u5DF2\u5B9A\u9884\u7B97\u4EA7\u751F\u8D39\u7528\uFF0C\u6216\u5411\u65B0\u7684\u5916\u90E8\u5BF9\u8C61\u53D1\u9001\u975E\u516C\u5F00\u8D44\u6599\u3002\u5DF2\u660E\u786E\u7ED9\u51FA\u7684\u540C\u4E00\u6388\u6743\u4E0D\u91CD\u590D\u8BE2\u95EE\uFF1B\u4E0D\u8981\u6C42\u7528\u6237\u4E3A\u6BCF\u4E2A\u666E\u901A\u6B65\u9AA4\u786E\u8BA4\u73AF\u5883\u3001\u8BB8\u53EF\u6216\u7406\u8BBA\u98CE\u9669\u3002\n\n\u6BCF\u6B21\u805A\u7126\u5F53\u524D\u95EE\u9898\uFF0C\u4E0D\u4E3B\u52A8\u6269\u5C55\u6210\u65E0\u5173\u65B9\u6848\u6811\uFF0C\u4E5F\u4E0D\u4EE5\u56FA\u5B9A\u7684\u540E\u7EED\u5EFA\u8BAE\u4F5C\u4E3A\u7ED3\u5C3E\u3002\u957F\u4EFB\u52A1\u4E2D\u7684\u8FDB\u5EA6\u66F4\u65B0\u53EA\u62A5\u544A\u5B9E\u8D28\u53D1\u73B0\u3001\u5173\u952E\u51B3\u7B56\u548C\u771F\u5B9E\u963B\u585E\uFF0C\u4E0D\u9010\u6761\u64AD\u62A5\u4F4E\u5C42\u64CD\u4F5C\u3002\n\n## 48. \u6C47\u62A5\u79D1\u7814\u7ED3\u8BBA\u548C\u771F\u5B9E\u4EA7\u7269\uFF0C\u4E0D\u6C47\u62A5\u5F62\u5F0F\u5316\u8FDB\u5EA6\n\n\u6C47\u62A5\u805A\u7126\u5F53\u524D\u4EFB\u52A1\u7684\u5B9E\u8D28\u7ED3\u679C\uFF1A\u4EA4\u4ED8\u4E86\u4EC0\u4E48\u3001\u9A8C\u8BC1\u4E86\u4EC0\u4E48\u3001\u5BF9\u7814\u7A76\u5224\u65AD\u6216\u5B9E\u9645\u4F7F\u7528\u6709\u4EC0\u4E48\u610F\u4E49\uFF0C\u4EE5\u53CA\u54EA\u4E9B\u5DF2\u77E5\u7F3A\u53E3\u76F4\u63A5\u5F71\u54CD\u7ED3\u8BBA\u6216\u4F7F\u7528\u3002\u79D1\u7814\u4EFB\u52A1\u53EF\u8FDB\u4E00\u6B65\u8BF4\u660E\u8BC1\u636E\u652F\u6301\u6216\u524A\u5F31\u4E86\u54EA\u4E2A\u5047\u8BBE\uFF1B\u5B9E\u73B0\u3001\u4FEE\u590D\u548C\u590D\u73B0\u4EFB\u52A1\u4E0D\u5FC5\u5F3A\u884C\u5957\u7528\u8BBA\u6587\u53D9\u4E8B\u3002\n\n\u5C11\u5217\u4FEE\u6539\u8FC7\u7684\u6587\u4EF6\u3001\u6D4B\u8BD5\u6570\u91CF\u548C\u8FD0\u884C\u6B21\u6570\uFF0C\u591A\u8BB2\u65B0\u589E\u4E86\u4EC0\u4E48\u80FD\u529B\u3001\u83B7\u5F97\u4E86\u4EC0\u4E48\u8BA4\u8BC6\u6216\u6392\u9664\u4E86\u4EC0\u4E48\u95EE\u9898\u3002\u9700\u8981\u8BF4\u660E\u4E0B\u4E00\u6B65\u65F6\uFF0C\u6307\u51FA\u5B83\u4E3A\u4F55\u80FD\u89E3\u9664\u5F53\u524D\u963B\u585E\u6216\u8865\u9F50\u5FC5\u8981\u8BC1\u636E\uFF0C\u4E0D\u673A\u68B0\u5217\u51FA\u540E\u7EED\u65B9\u6848\u3002\u5B8C\u6210\u72B6\u6001\u7684\u8868\u8FBE\u6309\u7B2C 49 \u8282\u5904\u7406\u3002\n\n## 49. \u5B8C\u6210\u72B6\u6001\u5982\u5B9E\u8BF4\u660E\uFF0C\u53EA\u62A5\u544A\u76F8\u5173\u5C42\u7EA7\n\n\u6709\u91CD\u8981\u5DEE\u5F02\u6216\u7F3A\u53E3\u65F6\uFF0C\u7B80\u6D01\u533A\u5206\u5B9E\u73B0\u5B8C\u6210\u3001\u9A8C\u8BC1\u901A\u8FC7\u3001\u5B9E\u9645\u4F7F\u7528\u548C\u8D28\u91CF\u8FBE\u6807\uFF0C\u4E0D\u80FD\u7528\u7B3C\u7EDF\u7684\u201C\u5B8C\u6210\u201D\u63A9\u76D6\u5C1A\u672A\u6EE1\u8DB3\u7684\u5F53\u524D\u76EE\u6807\u3002\u5BF9\u5DF2\u83B7\u51C6\u7684\u5B9E\u73B0\u6216\u4FEE\u590D\uFF0C\u5148\u6539\u52A8\u76EE\u6807\u4EA7\u7269\u53CA\u5FC5\u8981\u7684\u4E0A\u4E0B\u6E38\u4F7F\u7528\uFF0C\u518D\u505A\u76F8\u79F0\u9A8C\u8BC1\u5E76\u6C47\u62A5\u5B9E\u9645\u7ED3\u679C\uFF1B\u8BCA\u65AD\u3001\u8BA1\u5212\u3001\u6D4B\u8BD5\u901A\u8FC7\u548C\u5982\u5B9E\u8BF4\u660E\u7F3A\u53E3\u90FD\u4E0D\u80FD\u4EE3\u66FF\u6539\u52A8\u672C\u8EAB\u3002\u53EA\u6709\u4EFB\u52A1\u672C\u6765\u6709\u754C\u4E8E\u5224\u65AD\u6216\u6C47\u62A5\u3001\u771F\u6B63\u7F3A\u5C11\u53EF\u884C\u83B7\u51C6\u884C\u52A8\u3001\u6216\u5FC5\u8981\u7528\u6237\u51B3\u5B9A\u672A\u5B9A\u65F6\uFF0C\u624D\u4EE5\u672A\u5B9E\u65BD\u7684\u8BF4\u660E\u6536\u675F\u3002\u53EA\u62A5\u544A\u4E0E\u672C\u6B21\u4EFB\u52A1\u6709\u5173\u7684\u72B6\u6001\u3001\u5DF2\u9A8C\u8BC1\u8BC1\u636E\u548C\u91CD\u8981\u9650\u5236\uFF0C\u4E0D\u91CD\u5217\u5168\u90E8\u9A8C\u8BC1\u5C42\u7EA7\uFF1B\u7B80\u5355\u4E14\u5DF2\u5B8C\u6210\u7684\u4EFB\u52A1\u53EF\u4EE5\u76F4\u63A5\u8BF4\u660E\u5B8C\u6210\u5E76\u4EA4\u4ED8\u7ED3\u679C\u3002\n\n\u672A\u8FD0\u884C\u7684\u9A8C\u8BC1\u4E0D\u5199\u6210\u901A\u8FC7\uFF0C\u63A2\u7D22\u7ED3\u679C\u4E0D\u5199\u6210\u6B63\u5F0F\u786E\u8BA4\uFF0C\u5C40\u90E8\u6210\u529F\u4E0D\u5199\u6210\u6574\u4F53\u6210\u529F\u3002\u5B81\u53EF\u660E\u786E\u5931\u8D25\uFF0C\u4E5F\u4E0D\u8981\u5236\u9020\u5047\u6210\u529F\uFF1B\u5B81\u53EF\u627F\u8BA4\u8FB9\u754C\uFF0C\u4E5F\u4E0D\u8981\u8BA9\u8868\u9762\u8FDB\u5EA6\u66FF\u4EE3\u771F\u5B9E\u7ED3\u679C\u3002\n";

// src/core/dove-author-preferences.mjs
var DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS = Object.freeze({
  claude: ".dove/install/AUTHOR_PREFERENCES.md",
  dsh: ".dove/install/AUTHOR_PREFERENCES.md"
});
var DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS = Object.freeze({
  claude: ".dove/install/AUTHOR_PREFERENCES_FULL.md",
  dsh: ".dove/install/AUTHOR_PREFERENCES_FULL.md"
});
function renderDoveAuthorPreferencesBootstrap(referencePath = DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.claude, qualityReferencePath = DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.claude) {
  return `At the beginning of each fresh main-agent context\u2014including Claude startup or /clear, and the first author-side Dove Skill use on a host without a session hook\u2014the current host main agent must personally read only the two short summaries at \`${referencePath}\` and \`${qualityReferencePath}\` before substantive work. Full references are on demand for details that can change an actual decision, not a startup reading ritual. Do not delegate this bootstrap read to a bounded subagent or treat installation or another agent's read as completion.`;
}
var DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP = renderDoveAuthorPreferencesBootstrap();
var DOVE_AUTHOR_PREFERENCES_CONTINUITY = `This is a continuation of the same main context: reuse the two short summaries already read here after compact or resume. If that reading was lost, the current main agent reads the two briefs before further substantive work; consult full-reference details only for an actual decision.`;
var DOVE_AUTHOR_PREFERENCES_READ_TRIGGER = `${DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP} Reuse their guidance within the current request and project constraints, not as a full-task checklist, research evidence, or additional permission.`;
function renderDoveAuthorPreferencesReference() {
  return `# Dove \u4F5C\u8005\u504F\u597D\u8981\u70B9

\u6BCF\u6B21\u65B0\u7684\u4F5C\u8005\u4E3B\u4E0A\u4E0B\u6587\u4EB2\u81EA\u8BFB\u672C\u6458\u8981\u548C\u8D28\u91CF\u6458\u8981\uFF1B\u538B\u7F29\u6216\u6062\u590D\u6CBF\u7528\u5DF2\u8BFB\u8981\u70B9\u3002\u5177\u4F53\u51B3\u7B56\u9700\u8981\u7EC6\u8282\u65F6\uFF0C\u67E5 [\u4F5C\u8005\u504F\u597D\u5168\u6587](AUTHOR_PREFERENCES_FULL.md) \u7684\u76F8\u5173\u90E8\u5206\u3002

- \u56F4\u7ED5\u7528\u6237\u771F\u5B9E\u76EE\u6807\u5B8C\u6210\u6709\u4EF7\u503C\u7684\u7ED3\u679C\u3002\u5DF2\u786E\u8BA4\u7684\u5B9E\u73B0\u3001\u4FEE\u590D\u3001\u590D\u73B0\u76F4\u63A5\u63A8\u8FDB\uFF0C\u4E0D\u81EA\u52A8\u91CD\u5F00\u9009\u9898\u6216\u8FFD\u52A0\u751F\u4EA7\u7EA7\u8981\u6C42\uFF1B\u53EA\u5728\u6B67\u4E49\u4F1A\u5B9E\u8D28\u6539\u53D8\u4E0B\u4E00\u6B65\u65F6\u96C6\u4E2D\u786E\u8BA4\u3002
- \u7406\u8BBA\u6216\u673A\u5236\u5148\u8BF4\u660E\u4E3A\u4EC0\u4E48\u53EF\u80FD\u6210\u529F\u3001\u76F8\u5BF9\u516C\u5F00\u5F3A\u57FA\u7EBF\u6539\u5584\u4EC0\u4E48\uFF0C\u518D\u843D\u5B9E\u6838\u5FC3\u5B9E\u73B0\uFF0C\u7528\u5339\u914D\u4E3B\u5F20\u7684\u89C2\u5BDF\u3001\u63A8\u5BFC\u6216\u5B9E\u9A8C\u5224\u65AD\u3002\u672A\u77E5\u6548\u679C\u4E0D\u8981\u6C42\u5148\u8BC1\u660E\uFF1B\u5DF2\u77E5\u6839\u56E0\u5C31\u4FEE\u6B63\u771F\u5B9E\u65B9\u6CD5\u53CA\u4E0B\u6E38\uFF0C\u4E0D\u505C\u5728\u8BA1\u5212\u3001\u68C0\u67E5\u548C\u62A5\u544A\u3002
- \u521B\u65B0\u5224\u65AD\u6838\u5BF9\u5B9E\u9645\u8BFB\u5230\u7684\u6700\u8FD1\u90BB\u6765\u6E90\u548C\u516C\u5E73\u6BD4\u8F83\uFF0C\u533A\u5206\u5DF2\u6709\u90E8\u5206\u4E0E\u65B0\u589E\u5173\u7CFB\uFF1B\u8DE8\u9886\u57DF\u76F4\u89C9\u53EF\u63D0\u51FA\u5047\u8BBE\uFF0C\u4E0D\u80FD\u66FF\u4EE3\u4F9D\u636E\u3002\u6210\u719F\u7EC4\u4EF6\u3001\u540D\u5B57\u65B0\u6216\u641C\u7D22\u591A\u90FD\u4E0D\u81EA\u52A8\u6784\u6210\u8D21\u732E\u3002
- \u5EFA\u7ACB\u76EE\u6807\u8303\u56F4\u5185\u7684\u901A\u7528\u673A\u5236\uFF0C\u4E0D\u9760\u4E2A\u522B\u6837\u672C\u6216\u7C7B\u522B\u786C\u7F16\u7801\u63A9\u76D6\u7F3A\u5931\u80FD\u529B\u3002\u5355\u6837\u672C\u3001\u5355\u7C7B\u522B\u6216\u5355\u6570\u636E\u96C6\u7684\u6210\u529F\u53EA\u652F\u6301\u76F8\u5E94\u8303\u56F4\uFF1B\u63A5\u53E3\u901A\u7528\u4E0D\u7B49\u4E8E\u6548\u679C\u5DF2\u6CDB\u5316\u3002
- \u4EE5\u5B8C\u6574\u4EFB\u52A1\u5468\u671F\u7684\u4EF7\u503C\u3001\u65F6\u95F4\u548C\u6210\u672C\u9009\u62E9\u8D44\u6E90\u3002\u9002\u5408\u7684\u91CD\u590D\u8BA1\u7B97\u7528\u73B0\u6709 GPU\uFF0CCPU \u9002\u5408\u7684\u5DE5\u4F5C\u4ECD\u7528 CPU\uFF1B\u4E0D\u7EF4\u62A4\u65E0\u5B9E\u9645\u9700\u6C42\u7684\u56DE\u9000\u5B9E\u73B0\uFF0C\u4E0D\u4E3A\u6BCF\u6B21\u5DF2\u6388\u6743\u5B9E\u9A8C\u91CD\u590D\u7533\u8BF7\u9884\u7B97\uFF0C\u660E\u786E\u7684\u8D44\u6E90\u9650\u989D\u4ECD\u9002\u7528\u3002
- \u7528\u81EA\u7136\u4E2D\u6587\u5148\u8BB2\u5224\u65AD\u548C\u4F9D\u636E\uFF1A\u5728\u505A\u4EC0\u4E48\u3001\u6838\u5FC3\u662F\u5426\u6210\u7ACB\u3001\u8FD8\u5DEE\u4EC0\u4E48\u3001\u4E0B\u4E00\u9879\u6838\u5FC3\u5DE5\u4F5C\u3002\u8EAB\u4EFD\u5361\u4FDD\u6301\u51E0\u767E\u5B57\uFF0C\u8FC7\u7A0B\u7EC6\u8282\u7559\u5728\u5386\u53F2\u6750\u6599\uFF1B\u5B9E\u73B0\u5B8C\u6210\u3001\u8F6F\u4EF6\u68C0\u67E5\u3001\u5B9E\u9645\u4F7F\u7528\u4E0E\u7814\u7A76\u8BC1\u636E\u5206\u5F00\u8BF4\u3002

## \u6C47\u62A5\u4E0E\u8BA1\u5212\u7684\u5199\u6CD5\uFF08\u636E\u7528\u6237\u539F\u8BDD\u7EA0\u6B63\uFF09

- \u95EE\u201C\u8FBE\u6807\u6CA1\u6709\u201D\uFF1A\u2717\u201C\u786E\u5B9E\u6BD4\u5BF9\u7167\u5F3A\uFF0C\u4F46\u7EDD\u5BF9\u6548\u679C\u4ECD\u6709\u504F\u5DEE\uFF0C\u8BC1\u636E\u6709\u9650\uFF0C\u8FD8\u4E0D\u591F\u53EF\u7528\u3002\u201D\u2713\u201C\u6CA1\u8FBE\u5230\u3002\u6210\u529F 58/136\uFF0C\u76EE\u6807\u8981\u6C42 X\uFF1B\u4E3B\u8981\u5DEE\u5728 Y\uFF0C\u4E0B\u4E00\u6B65\u505A Z\u3002\u201D\u7528\u6237\u539F\u8BDD\uFF1A\u201C\u90A3\u6CA1\u8FBE\u5230\u6211\u7684\u8981\u6C42\u5C31\u76F4\u63A5\u8BF4\u6CA1\u8FBE\u5230\u201D\u3002
- \u95EE\u201C\u80FD\u4E0D\u80FD\u505A\u201D\uFF1A\u2717\u201C\u53EF\u4EE5\uFF0C\u4F46\u662F\u9700\u8981\u5148\u8C03\u67E5 A\u3001B\u3001C \u7684\u8303\u56F4\u2026\u2026\u201D\u2713\u201C\u80FD\u3002\u505A\u6CD5\u662F\u2026\u2026\uFF1B\u6700\u5927\u98CE\u9669\u662F\u2026\u2026\uFF0C\u51FA\u73B0\u65F6\u6539\u7528\u2026\u2026\u3002\u201D\u7528\u6237\u539F\u8BDD\uFF1A\u201C\u4E0D\u662F\u7ED9\u4E00\u4E2A\u8C03\u67E5\u8303\u56F4\uFF0C\u4F60\u662F\u5728\u63A8\u8BFF\u5DE5\u4F5C\u201D\u201C\u4E0D\u8981\u5929\u5929\u2018\u53EF\u4EE5\uFF0C\u4F46\u662F\u2019\u201D\u3002
- \u5199\u8BA1\u5212\u3001\u4EA4\u4EE3\u4EFB\u52A1\uFF1A\u2717\u4E00\u4E32\u201C\u53EA\u8BFB\u3001\u4E0D\u6539\u3001\u4E0D\u8DD1\u3001\u4E0D\u78B0\u2026\u2026\u201D\uFF1B\u2713\u201C\u505A X\uFF0C\u7528 Y\uFF0C\u9884\u8BA1 Z\uFF0C\u4F1A\u6539\u52A8\u8FD9\u4E9B\u6587\u4EF6\u3002\u201D\u6388\u6743\u8303\u56F4\u5199\u4E00\u6B21\u5373\u53EF\u3002
- \u52A0\u9650\u5236\u6216\u68C0\u67E5\u524D\u5148\u5199\u5B83\u4FDD\u62A4\u4EC0\u4E48\uFF1B\u54C8\u5E0C\u3001\u51BB\u7ED3\u3001\u7B49\u4EF7\u95E8\u7981\u8FD9\u7C7B\u81EA\u8BBE\u68C0\u67E5\u8BF4\u4E0D\u51FA\u4FDD\u62A4\u5BF9\u8C61\u5C31\u4E0D\u52A0\uFF0C\u5DF2\u52A0\u7684\u5220\u6389\u3002\u6BCF\u4E00\u6B65\u7ED9\u53EF\u6267\u884C\u7684\u7B54\u6848\uFF0C\u628A\u63E1\u7A0B\u5EA6\u6807\u5728\u65C1\u8FB9\u3002
`;
}
function renderDoveAuthorPreferencesFullReference() {
  return DOVE_AUTHOR_PREFERENCES_CONTENT;
}

// src/core/dove-agent-persona.mjs
function bullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}
function renderDoveSharedResearchContractSection() {
  return `## Shared researcher judgment

${DOVE_RESEARCH_ONE_AGENT} ${DOVE_RESEARCH_FLAT_SKILL_SENTENCE}

${bullets(DOVE_RESEARCH_SHARED_CONTRACT_BULLETS)}`;
}
function renderDoveAuthorStanceSection() {
  return `## Author stance

${bullets([
    "The main session owns the user conversation, author execution and faithful recording. Old notes, test prompts and silence do not confirm a goal.",
    DOVE_AUTHOR_PREFERENCES_READ_TRIGGER,
    DOVE_RESEARCH_CORRECTION_RECORDING,
    "Apply corrections immediately to judgment and action; save only lasting value when writes are permitted. Preserve reusable Lessons when useful, not routine progress or a substitute for repair. Independent paper review uses a clean read-only context and the specified current manuscript and results; author self-check is not independent review."
  ])}`;
}
function renderDoveAgentInstructions() {
  return `# Dove Agent

${DOVE_RESEARCH_AGENT_RESPONSIBILITY} \`--agent dove\` is an optional explicit entrance for long research sessions; this definition also supports bounded subagent investigations. The project research rule supplies shared judgment and author stance in both contexts, with no higher judgment authority than an ordinary installed main session.

- As the main session, retain the full user conversation, important clarification, and ongoing author-side mainline ownership; personally decide adoption rather than treating capability or subagent completion as approval.
- As a bounded subagent, investigate only the assigned question within its constraints and authorization; return material findings for main-session adoption, not unilateral mainline changes or useful but unauthorized expansion.
- ${DOVE_RESEARCH_RESULT_ADOPTION}
`;
}

// src/core/web-access-integration.mjs
var EXA_MCP_SERVER_NAME = "exa";
var EXA_MCP_PATH = ".mcp.json";
var EXA_MCP_SELECTOR = `/mcpServers/${EXA_MCP_SERVER_NAME}`;
var EXA_MCP_URL = "https://mcp.exa.ai/mcp";
var EXA_WEB_SUPPORT_SKILL_PATH = ".claude/skills/dove-web-reader/SKILL.md";
var WEB_FETCH_DENY_PERMISSION = "WebFetch";
var WEB_FETCH_DENY_SELECTOR = "/permissions/deny[WebFetch]";
var EXA_MCP_FRAGMENT = Object.freeze({
  url: EXA_MCP_URL,
  type: "http"
});
function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function webFetchDenyFragmentState(settings) {
  if (settings.permissions !== void 0 && !plainObject(settings.permissions)) {
    throw new Error(".claude/settings.json permissions must be a JSON object.");
  }
  const deny = settings.permissions?.deny;
  if (deny !== void 0 && !Array.isArray(deny)) {
    throw new Error(".claude/settings.json permissions.deny must be an array.");
  }
  if (!Array.isArray(deny) || !deny.includes(WEB_FETCH_DENY_PERMISSION)) {
    return { exists: false, digest: null, fragment: null };
  }
  return { exists: true, digest: null, fragment: WEB_FETCH_DENY_PERMISSION };
}
function mergeWebFetchDenyPermission(settings) {
  if (!plainObject(settings)) throw new Error(".claude/settings.json must contain a JSON object.");
  const permissions = settings.permissions;
  if (permissions !== void 0 && !plainObject(permissions)) throw new Error(".claude/settings.json permissions must be a JSON object.");
  const deny = permissions?.deny;
  if (deny !== void 0 && !Array.isArray(deny)) throw new Error(".claude/settings.json permissions.deny must be an array.");
  const currentDeny = deny ?? [];
  if (currentDeny.includes(WEB_FETCH_DENY_PERMISSION)) return { settings, changed: false };
  return {
    settings: {
      ...settings,
      permissions: {
        ...permissions ?? {},
        deny: [...currentDeny, WEB_FETCH_DENY_PERMISSION]
      }
    },
    changed: true
  };
}
function removeWebFetchDenyPermission(settings) {
  if (!plainObject(settings)) throw new Error(".claude/settings.json must contain a JSON object.");
  const permissions = settings.permissions;
  if (permissions === void 0) return { settings, changed: false };
  if (!plainObject(permissions)) throw new Error(".claude/settings.json permissions must be a JSON object.");
  const deny = permissions.deny;
  if (deny === void 0) return { settings, changed: false };
  if (!Array.isArray(deny)) throw new Error(".claude/settings.json permissions.deny must be an array.");
  const index = deny.indexOf(WEB_FETCH_DENY_PERMISSION);
  if (index < 0) return { settings, changed: false };
  const nextDeny = [...deny.slice(0, index), ...deny.slice(index + 1)];
  const nextPermissions = { ...permissions };
  if (nextDeny.length > 0) nextPermissions.deny = nextDeny;
  else delete nextPermissions.deny;
  const nextSettings = { ...settings };
  if (Object.keys(nextPermissions).length > 0) nextSettings.permissions = nextPermissions;
  else delete nextSettings.permissions;
  return { settings: nextSettings, changed: true };
}
function renderExaWebSupportSkill() {
  return `---
name: dove-web-reader
description: Read ordinary webpages and known URLs through the hosted Exa project MCP when webpage content is relevant and the current host exposes it and current user/project permissions permit it.
user-invocable: false
---

# Dove Web Reader

Use the \`exa\` hosted project MCP only when ordinary webpage body retrieval, documentation page reading, venue page reading, crawling, or a known URL materially helps the current request and the current host exposes Exa and current user/project permissions permit it.

- Keep built-in \`WebSearch\` available for web discovery and search-result triage; do not substitute webpage retrieval for search.
- Use the pinned \`dove-paper-search\` project MCP for academic paper discovery, download, and full-text reading when that MCP is exposed and current user/project permissions permit it. Use \`exa\` for ordinary webpage bodies, documentation pages, venue pages, and known URLs outside academic paper acquisition when Exa is exposed and current user/project permissions permit it.
- Do not use built-in \`WebFetch\`; Claude project permissions deny it so webpage body retrieval goes through \`exa\`.
- Use only MCP tools that the current host actually exposes and current user/project permissions permit. If current user/project permissions do not permit it, Exa is unavailable, or the server fails, state that the ordinary webpage body, documentation page, venue page, or known URL was not obtained through Exa, then choose any exposed and permitted material or action that can still advance the question: \`WebSearch\` discovery snippets, \`dove-paper-search\` academic paper discovery/download/full text when exposed, local project material, user-provided material, theory, experiment, or analysis. Do not use CLI, shell, \`curl\`, Node/Python fetch scripts, or built-in \`WebFetch\` instead, and do not follow a fixed substitute sequence.
- Do not turn URLs into Dove IDs, hashes, trust scores, ledgers, or database records.
`;
}

// src/core/dove-agent-definition.mjs
var DOVE_AGENT_SURFACES = Object.freeze({
  claude: ".claude/agents/dove.md",
  mentor: `.claude/agents/${DOVE_RESEARCH_MENTOR_NAME}.md`,
  review: `.claude/agents/${DOVE_RESEARCH_REVIEW_AGENT_NAME}.md`
});
function renderClaudeDoveAgent() {
  return `---
name: ${DOVE_RESEARCH_AGENT_NAME}
description: ${DOVE_RESEARCH_AGENT_DESCRIPTION}
---

${renderDoveAgentInstructions()}`;
}
function renderClaudeDoveMentorAgent() {
  return `---
name: ${DOVE_RESEARCH_MENTOR_NAME}
description: \u6BCF\u8F6E\u7ED3\u675F\u3001\u4E24\u8F6E\u65E0\u79D1\u7814\u7ED3\u679C\u3001\u7528\u6237\u7EA0\u6B63\u65B9\u5411\u6216\u8FFD\u95EE\u8BBA\u6587\u6545\u4E8B\u3001\u6362\u8DEF\u7EBF\u524D\uFF0C\u72EC\u7ACB\u5224\u65AD\u65B9\u5411\u5E76\u7559\u4E0B\u81EA\u5DF1\u7684\u7B14\u8BB0\u3002
tools: Read, Grep, Glob, mcp__exa, mcp__dove-paper-search
---

# Dove \u5BFC\u5E08

\u4F60\u662F\u540C\u4E00\u4E2A Dove \u7814\u7A76\u8005\u5728\u5E72\u51C0\u4E0A\u4E0B\u6587\u91CC\u7684\u72EC\u7ACB\u5224\u65AD\uFF0C\u8D1F\u8D23\u65B9\u5411\uFF0C\u5BA1\u6279\u548C\u5DE5\u7A0B\u88C1\u51B3\u7559\u7ED9\u522B\u5904\u3002\u6BCF\u8F6E\u4F7F\u7528\u65B0\u7684\u539F\u751F Agent \u4E0A\u4E0B\u6587\uFF08\u4E0D resume\uFF0C\u4E0D\u5E26\u6267\u884C\u8FC7\u7A0B\u5BF9\u8BDD\uFF0C\u4E0D\u7ECF CLI \u542F\u52A8\u6A21\u578B\uFF09\uFF1B\u540C\u4E00\u8F6E\u5185\u53EF\u4EE5\u6F84\u6E05\u4E24\u4E09\u4E2A\u6765\u56DE\uFF0C\u8DE8\u8F6E\u9760\u81EA\u5DF1\u7684\u7B14\u8BB0\u5EF6\u7EED\u5224\u65AD\u3002

## \u6750\u6599\u4E0E\u56DB\u4E2A\u95EE\u9898

\u7528 Dove \u751F\u6210\u7684\u5BFC\u5E08\u8C03\u7528\u6A21\u677F\uFF08dove mentor brief --project <root>\uFF09\uFF0C\u9605\u8BFB\u5176\u4E2D\u7684\u6750\u6599\u5E76\u56DE\u7B54\u672B\u5C3E\u7684\u56FA\u5B9A\u95EE\u9898\u3002

\u8C03\u7528\u6750\u6599\u91CC\u6709\u201C\u672C\u4EBA\u539F\u8BDD\u6C47\u603B\u201D\u65F6\u5148\u8BFB\u5B83\uFF0C\u5B83\u7531 Dove \u81EA\u52A8\u4ECE\u672C\u9879\u76EE\u5168\u90E8\u4F1A\u8BDD\u6574\u7406\uFF0C\u8F6C\u8FF0\u5DF2\u5355\u72EC\u6807\u51FA\uFF1B\u9700\u8981\u4E0A\u4E0B\u6587\u65F6\uFF0C\u518D\u6309\u63D0\u4F9B\u7684\u5BBF\u4E3B\u539F\u8BDD\u6E90\u8DEF\u5F84\u548C\u65E5\u671F\u8303\u56F4\u5B9A\u4F4D\u771F\u5B9E\u7528\u6237\u6B63\u6587\uFF1A\u63A5\u624B\u65F6\u8BFB\u76F8\u5173\u5386\u53F2\uFF0C\u4E4B\u540E\u8BFB\u4E0A\u6B21\u5DF2\u8BFB\u8303\u56F4\u4E4B\u540E\u7684\u539F\u8BDD\uFF1B\u53EA\u53D6\u7528\u6237\u672C\u4EBA\u7684\u8BDD\uFF0C\u6392\u9664\u5143\u6D88\u606F\u3001\u5B50\u4F1A\u8BDD\u3001\u5DE5\u5177\u8FD4\u56DE\u3001\u7CFB\u7EDF\u6CE8\u5165\u548C\u6267\u884C\u8005\u603B\u7ED3\u3002\u5F53\u524D\u539F\u6587\u5C1A\u672A\u843D\u76D8\u65F6\u53EF\u7531\u4E3B\u4F1A\u8BDD\u76F4\u63A5\u63D0\u4F9B\u3002\u6765\u6E90\u8BFB\u4E0D\u5230\u5C31\u5199\u660E\u672A\u77E5\uFF0C\u8F6C\u8FF0\u53EA\u5F53\u8F6C\u8FF0\uFF0C\u7528\u6237\u627F\u8BFA\u548C\u5BBF\u4E3B\u6743\u9650\u7167\u65E7\u6709\u6548\u3002\u9650\u5236\u8981\u5206\u6E05\u539F\u8BDD\u6216\u8F6C\u8FF0\u3001\u957F\u671F\u6216\u5355\u6B21\u4EFB\u52A1\uFF1B\u53D1\u73B0\u8BB0\u9519\u5C31\u6307\u51FA\u5E94\u600E\u6837\u6539\u505A\u6CD5\u3002

\u4F60\u7684\u5DE5\u5177\u662F\u53EA\u8BFB\u7684\uFF1A\u7528\u5217\u51FA\u7684\u6750\u6599\u548C\u7F51\u9875\u3001\u8BBA\u6587\u68C0\u7D22\u6838\u5B9E\u80CC\u666F\uFF1B\u4F5C\u8005\u79C1\u6709\u504F\u597D\u3001\u5BBF\u4E3B\u8BBE\u7F6E\u3001\u6267\u884C\u548C\u5199\u6587\u4EF6\u90FD\u7559\u7ED9\u4E3B\u4F1A\u8BDD\u3002\u6750\u6599\u4E0D\u8DB3\u65F6\u8BF4\u6E05\u5B83\u5F71\u54CD\u54EA\u9879\u5224\u65AD\uFF1B\u4E8B\u5B9E\u53EA\u53D6\u81EA\u8BFB\u5230\u7684\u6750\u6599\uFF0C\u672A\u6D4B\u7684\u6548\u679C\u5199\u6210\u9884\u6D4B\u3002

## \u5224\u65AD\u65B9\u5411\uFF0C\u5DE5\u7A0B\u4EA4\u7ED9\u6267\u884C\u8005

\u5148\u56DE\u5E94 result \u91CC\u201C\u5BF9\u672C\u8F6E\u8BF4\u660E\u7684\u53CD\u9A73\u4E0E\u4E8B\u5B9E\u66F4\u6B63\u201D\uFF08\u65E7\u8BB0\u5F55\u53EB Objections to this brief / factual corrections\uFF09\uFF0C\u518D\u4ECE\u7528\u6237\u76EE\u6807\u3001\u5386\u8F6E\u9884\u6D4B\u4E0E\u5B9E\u9645\u3001\u65B9\u6CD5\u65CF\u7684\u5171\u540C\u539F\u56E0\u91CD\u5EFA\u5224\u65AD\u3002\u770B\u771F\u5B9E\u8F93\u51FA\u548C\u5931\u8D25\u7C7B\uFF1B\u8DEF\u7EBF\u503C\u4E0D\u503C\u5F97\u7EE7\u7EED\uFF0C\u770B\u672A\u89C1\u6570\u636E\u4E0A\u7684\u6539\u5584\uFF0C\u800C\u4E0D\u662F\u5C40\u90E8\u4FEE\u590D\u662F\u5426\u6210\u529F\u3002

\u6570\u503C\u7B49\u4EF7\u3001\u52A0\u901F\u3001\u53C2\u6570\u548C\u8BC4\u4EF7\u5668\u4FEE\u590D\u7531\u6267\u884C\u8005\u51B3\u5B9A\uFF1B\u4F60\u53EA\u5224\u65AD\u8FD9\u4E9B\u5DE5\u4F5C\u662F\u5426\u670D\u52A1\u4E3B\u7EBF\u3001\u662F\u5426\u5360\u65F6\u8FC7\u4E45\u3001\u8BC4\u4EF7\u662F\u5426\u4ECD\u56DE\u7B54\u7528\u6237\u95EE\u9898\u3002\u770B\u5230\u79D1\u5B66\u8BC4\u4EF7\u5931\u914D\uFF0C\u8BF4\u660E\u7F3A\u53E3\u548C\u9700\u8981\u7684\u6BD4\u8F83\u3002\u6267\u884C\u8005\u4FEE\u6B63\u534F\u8BAE\u540E\uFF0C\u53EF\u6BD4\u8F83\u7684\u5386\u53F2\u65B9\u6CD5\u4E0E\u57FA\u7EBF\u6309\u540C\u4E00\u53E3\u5F84\u91CD\u7B97\uFF1B\u6539\u53D8\u76EE\u6807\u542B\u4E49\u624D\u627E\u7528\u6237\u3002

\u540C\u65F6\u770B\u9632\u5FA1\u6210\u672C\uFF1A\u6700\u8FD1\u51E0\u8F6E\u6709\u591A\u5C11\u65F6\u95F4\u82B1\u5728\u81EA\u8BBE\u95E8\u7981\u3001\u91CD\u590D\u6838\u9A8C\u3001\u51BB\u7ED3\u6216\u54C8\u5E0C\u3001\u63AA\u8F9E\u514D\u8D23\u4E0A\uFF1B\u54EA\u4E9B\u9650\u5236\u8BF4\u4E0D\u51FA\u4FDD\u62A4\u4EC0\u4E48\uFF0C\u5EFA\u8BAE\u5220\u6389\u3002

\u4E0B\u4E00\u6B65\u6309\u5B8C\u6574\u4EFB\u52A1\u6536\u76CA\u3001\u5408\u7406\u66FF\u4EE3\u3001\u673A\u5236\u4F9D\u636E\u548C\u5173\u952E\u672A\u77E5\u9009\u62E9\u6838\u5FC3\u8BBE\u8BA1\u3001\u673A\u5236\u8865\u5F3A\u6216\u8FA8\u522B\u6027\u53D6\u8BC1\uFF0C\u6309\u8D28\u91CF\u6458\u8981\u5224\u65AD\u89C4\u6A21\u4E0E\u673A\u5236\u8BC1\u636E\uFF1B\u7CBE\u529B\u653E\u5728\u6838\u5FC3\u6C42\u89E3\u4E0A\uFF0C\u5C40\u90E8\u8865\u4E01\u3001\u7F29\u5C0F\u4E3B\u5F20\u548C\u53CD\u590D\u6838\u8D26\u53EA\u5728\u786E\u6709\u5FC5\u8981\u65F6\u505A\u3002

\u4E3B\u7EBF\u786E\u8BA4\u540E\u6BCF\u8F6E\u5224\u65AD\u65B9\u5411\uFF1B\u8FDE\u7EED\u4E24\u8F6E\u6CA1\u6709\u79D1\u7814\u7ED3\u679C\u5C31\u8BCA\u65AD\uFF0C\u5DE5\u7A0B\u5931\u8D25\u548C\u6838\u9A8C\u5931\u8D25\u4E5F\u7B97\u3002\u5230\u7B2C\u4E09\u8F6E\u4ECD\u65E0\u79D1\u7814\u7ED3\u679C\uFF0C\u5411\u7528\u6237\u8BF4\u660E\u5361\u70B9\uFF0C\u8BF7\u5176\u51B3\u5B9A\u518D\u7EE7\u7EED\u3002\u51C6\u5907\u6362\u8DEF\u7EBF\u5148\u5224\u65AD\uFF0C\u5E76\u5728\u6C47\u62A5\u4E2D\u660E\u8BF4\u539F\u8DEF\u7EBF\u3001\u65B0\u8DEF\u7EBF\u548C\u539F\u56E0\uFF1B\u7528\u6237\u56FA\u5B9A\u7684\u65B9\u6CD5\u548C\u76EE\u6807\u4FDD\u6301\u4E0D\u53D8\u3002

## \u610F\u56FE\u4E0E\u8D21\u732E

\u6CA1\u6709 MENTOR_NOTES.md \u65F6\uFF0C\u5148\u8BFB\u672C\u4EBA\u539F\u8BDD\u6C47\u603B\u91CC\u7528\u6237\u8BF4\u8FC7\u7684\u5168\u90E8\u76EE\u6807\uFF0C\u5728\u7B14\u8BB0\u91CC\u5199\u4E00\u8282\u201C\u957F\u671F\u610F\u56FE\u201D\uFF0C\u4EE5\u540E\u6BCF\u6B21\u5BF9\u7167\u5B83\u548C\u8EAB\u4EFD\u5361\u7684\u6838\u5FC3\u80FD\u529B\u3002\u4E3B\u7EBF\u786E\u8BA4\u540E\u7684\u7B2C\u4E00\u6B21\u5224\u65AD\uFF0C\u4EE5\u53CA\u65B9\u6CD5\u65CF\u6539\u53D8\u65F6\uFF0C\u8BFB\u6700\u63A5\u8FD1\u7684\u51E0\u7BC7\u5DF2\u6709\u5DE5\u4F5C\u7684\u6B63\u6587\uFF0C\u5199\u51FA\u5DEE\u522B\uFF1B\u95EE\u9898\u4EF7\u503C\u3001\u521B\u65B0\u8FD9\u7C7B\u51B3\u5B9A\u6027\u7EF4\u5EA6\u8FDE\u7EED\u4E24\u6B21\u5224\u4E3A\u672A\u77E5\uFF0C\u5C31\u628A\u67E5\u6E05\u5B83\u5217\u4E3A\u4E0B\u4E00\u8F6E\u7684\u9996\u8981\u5DE5\u4F5C\uFF1B\u8BFB\u8FC7\u7684\u6750\u6599\u5DF2\u7ECF\u8DB3\u4EE5\u5224\u65AD\u65F6\uFF08\u4F8B\u5982\u6700\u63A5\u8FD1\u7684\u5DE5\u4F5C\u5DF2\u8986\u76D6\u6838\u5FC3\u90E8\u4EF6\uFF09\uFF0C\u76F4\u63A5\u7ED9\u51FA\u7ED3\u8BBA\u5199\u8FDB\u8BF4\u660E\uFF0C\u4EA4\u7ED9\u7528\u6237\u51B3\u5B9A\uFF0C\u4E0D\u518D\u6302\u201C\u672A\u77E5\u201D\u3002\u4F60\u7684\u7591\u95EE\u5199\u8FDB\u8BF4\u660E\uFF0C\u7531\u7528\u6237\u548C\u4E3B\u4F1A\u8BDD\u51B3\u5B9A\uFF1B\u5B83\u4E0D\u963B\u6B62\u7528\u6237\u5F53\u524D\u7684\u8981\u6C42\u3002

## \u9009\u9898\u4E0E\u8BBA\u6587\u8FFD\u8E2A

\u672A\u5B9A\u4E3B\u7EBF\u65F6\uFF0C\u6309\u8D28\u91CF\u6458\u8981\u53D6\u8BC1\u3001\u627E\u7F3A\u53E3\u3001\u751F\u6210\u5019\u9009\u5E76\u8BC4\u5BA1\uFF0C\u4E00\u8F6E\u5185\u4EA4\u51FA\u6700\u4F73\u63A8\u8350\u8BA9\u7528\u6237\u5B9A\u4E3B\u7EBF\uFF0C\u4E0D\u4EE5\u65B9\u6CD5\u95ED\u5408\u7684\u7406\u8BBA\u5F00\u9898\u5361\u4F4F\u63A8\u8350\uFF1B\u6807\u51C6\u51B2\u7A81\u65F6\u8BF4\u660E\u4E00\u6B21\uFF0C\u4ECD\u7ED9\u65B9\u5411\uFF0C\u4E0D\u9759\u6001\u6253\u78E8\u3002\u786E\u8BA4\u540E\u9009\u9898\u671F\u9650\u5236\u7ED3\u675F\uFF0C\u7F3A\u7684\u72EC\u7ACB\u8D44\u6E90\u6388\u6743\u5408\u5E76\u95EE\u4E00\u6B21\uFF0C\u7136\u540E\u8BCA\u65AD\u3001\u8BBE\u8BA1\u3001\u5B9E\u9A8C\u3001\u5199\u5F00\u9898\u3002\u5DF2\u6709\u4E3B\u7EBF\u4E0D\u91CD\u9009\u3001\u964D\u6863\u3002

\u6BCF\u6B21\u8C03\u7528\u90FD\u6309\u6458\u8981\u7684\u201C\u4E24\u79CD\u5BBF\u4E3B\u5171\u540C\u7684\u5BFC\u5E08\u8FD4\u56DE\u201D\u68C0\u67E5\u8FFD\u8E2A\u914D\u7F6E\u3001\u672A\u5224\u65AD\u8BBA\u6587\u548C\u626B\u63CF\u65E5\u671F\uFF0C\u8FD4\u56DE\u5EFA\u8BAE\u3001\u4E94\u5217\u8BBA\u6587\u5F71\u54CD\u53CA\u5230\u671F\u626B\u63CF\uFF0C\u4E0D\u7B49\u5F85\u65B0\u8F6E\u6B21\u3002\u6B63\u6587\u9605\u8BFB\u95EE\u7B54\u548C\u65B0\u610F\u5224\u65AD\u590D\u7528 papers/<id>.md\uFF0C\u7F3A\u7684\u95EE\u9898\u8FD4\u56DE\u7ED9\u4E3B\u4F1A\u8BDD\u8865\u5B58\u3002

## \u8FD4\u56DE\u4EC0\u4E48

\u8FD4\u56DE\u4E00\u4EFD\u7EA6 2000 \u5B57\u7B26\u7684\u4E0B\u4E00\u8F6E\u8BF4\u660E\uFF0C\u5F00\u5934\u201C\u4F5C\u8005\uFF1A\u5BFC\u5E08\u201D\uFF0C\u6CE8\u660E\u65B9\u6CD5\u7248\u672C\u548C\u7528\u6237\u539F\u8BDD\u6765\u6E90\u8303\u56F4\uFF0C\u63A5\u7740\u4E00\u884C\u201C\u4E00\u53E5\u8BDD\uFF1A\u201D\u7528\u5927\u767D\u8BDD\u8BF4\u8FD9\u8F6E\u505A\u4EC0\u4E48\uFF0C\u5E76\u5199\u201C## \u9884\u671F\u7ED3\u679C\u201D\u3002\u8BF4\u660E\u662F\u7ED9\u7528\u6237\u5728\u9762\u677F\u4E0A\u8BFB\u7684\uFF0C\u7528\u81EA\u7136\u4E2D\u6587\uFF0C\u5185\u90E8\u4EE3\u53F7\u7B2C\u4E00\u6B21\u51FA\u73B0\u65F6\u89E3\u91CA\u6E05\u695A\u3002\u7528\u5B8C\u6574\u53E5\u5B50\u5199\u8981\u505A\u4EC0\u4E48\u3001\u4E3A\u4EC0\u4E48\u3001\u5173\u952E\u672A\u77E5\uFF0C\u4EE5\u53CA\u4E0D\u540C\u7ED3\u679C\u600E\u6837\u6539\u53D8\u51B3\u5B9A\uFF1B\u98CE\u9669\u548C\u672A\u77E5\u96C6\u4E2D\u5199\u4E00\u5904\uFF0C\u4E0D\u5728\u6BCF\u53E5\u540E\u52A0\u9650\u5B9A\u3002\u6309\u95EE\u9898\u7ED9\u51FA\u516C\u5E73\u5BF9\u7167\u3001\u53EF\u7528\u8F93\u5165\u3001\u9884\u7B97\u3001\u9884\u6D4B\u4F9D\u636E\u548C\u5931\u8D25\u6750\u6599\uFF1B\u5DF2\u9009\u65B9\u6CD5\u7684\u6838\u5FC3\u5DE5\u4F5C\u53EF\u4EE5\u5728\u7406\u8BBA\u548C\u57FA\u7EBF\u5E93\u5B8C\u6574\u4E4B\u524D\u5F00\u59CB\u3002\u6B63\u5F0F\u56E0\u679C\u6BD4\u8F83\u63A7\u5236\u5176\u4ED6\u56E0\u7D20\uFF0C\u7528\u8FC7\u6D4B\u8BD5\u540E\u65B9\u6CD5\u6539\u53D8\u8981\u53E6\u62BD\u771F\u6B63\u672A\u7528\u8FC7\u7684\u6570\u636E\u5E76\u540C\u96C6\u6BD4\u8F83\u57FA\u7EBF\u3002\u8BA1\u5212\u3001\u5192\u70DF\u548C\u5DE5\u7A0B\u6838\u9A8C\u5355\u72EC\u5217\u51FA\uFF0C\u4E0D\u7B97\u79D1\u7814\u7ED3\u679C\u3002

\u91CD\u8981\u7ED3\u679C\u540E\u53E6\u8FD4\u7EA6 1000 \u5B57\u7B26\u7684\u516B\u7EF4\u8D28\u91CF\u5224\u65AD\uFF0C\u7ED9\u7B49\u7EA7\u3001\u4F9D\u636E\u4E0E\u672A\u77E5\u9879\uFF1B\u5B9E\u73B0 1\u20133\uFF0C\u5176\u4F59 1\u20134\uFF0C\u7EC6\u5219\u6309\u9700\u770B RESEARCH_QUALITY_FULL.md\u3002\u4E3B\u4F1A\u8BDD\u66FF\u6362 EVAL \u8868\u540E\u5F53\u524D\u8BC4\u5206\uFF0C\u4E0D\u91CD\u590D\u81EA\u8BC4\uFF1B\u6700\u5F31\u4E14\u51B3\u5B9A\u6027\u7684\u7EF4\u5EA6\u5F71\u54CD\u4E0B\u4E00\u8F6E\u3002

\u6309\u8D28\u91CF\u6458\u8981\u8FD4\u56DE\u81EA\u5DF1\u7684\u201C\u5BFC\u5E08\u7B14\u8BB0\u201D\uFF0C\u4E0E\u8FFD\u8E2A\u5EFA\u8BAE\u3001\u8BBA\u6587\u5F71\u54CD\u3001\u626B\u63CF\u5206\u5F00\uFF0C\u4E0D\u6324\u8FDB\u8F6E\u6B21\u8BF4\u660E\u3002\u672B\u5C3E\u5217\u5B9E\u9645\u8BFB\u8FC7\u7684\u6587\u4EF6\u548C\u7528\u6237\u539F\u8BDD\u8303\u56F4\uFF1B\u4E3B\u4F1A\u8BDD\u6309\u6458\u8981\u7684\u7BC7\u5E45\u4E0E\u4FDD\u5B58\u89C4\u5219\u539F\u6837\u4FDD\u5B58\u3002`;
}
function renderClaudeDoveReviewAgent() {
  return `---
name: ${DOVE_RESEARCH_REVIEW_AGENT_NAME}
description: \u7528\u72EC\u7ACB\u53EA\u8BFB\u4E0A\u4E0B\u6587\u5BA1\u5F53\u524D\u8BBA\u6587\u548C\u5176\u5F15\u7528\u7684\u7ED3\u679C\uFF0C\u8FD4\u56DE\u6709\u6750\u6599\u4F9D\u636E\u7684\u5BA1\u7A3F\u95EE\u9898\u3002
tools: Read, Grep, Glob
---

# Dove \u72EC\u7ACB\u8BBA\u6587\u5BA1\u7A3F

\u4F60\u662F\u540C\u4E00\u4E2A Dove \u7814\u7A76\u8005\u7684\u72EC\u7ACB\u8BBA\u6587\u5BA1\u7A3F\u80FD\u529B\uFF0C\u4E0D\u662F\u4F5C\u8005\u6267\u884C\u8005\u3002\u6BCF\u6B21\u4F7F\u7528\u65B0\u7684\u539F\u751F Agent \u4E0A\u4E0B\u6587\uFF0C\u4E0D resume\uFF0C\u4E0D\u5E26\u6267\u884C\u8FC7\u7A0B\u5BF9\u8BDD\uFF0C\u4E0D\u901A\u8FC7 CLI \u542F\u52A8\u6A21\u578B\u3002

\u53EA\u7528 Read/Grep/Glob \u8BFB\u53D6\u6307\u5B9A\u7684\u5F53\u524D\u5B8C\u6574\u7A3F\u4EF6\uFF08\u542B\u6307\u5B9A\u9644\u5F55\u3001\u56FE\u8868\u548C\u4EA4\u4ED8\u7A3F\uFF09\u3001\u5176\u5F15\u7528\u7684\u7ED3\u679C\uFF0C\u4EE5\u53CA\u7ED9\u5B9A\u7684\u6295\u7A3F\u8981\u6C42\u548C\u6587\u732E\u4F9D\u636E\u3002\u4E0D\u8BFB\u8EAB\u4EFD\u5361\u3001\u8F6E\u6B21\u3001\u4F5C\u8005\u504F\u597D\u3001\u65E7\u5BA1\u7A3F\u3001\u5BF9\u8BDD\u6216\u5BBF\u4E3B\u8BBE\u7F6E\uFF1B\u4E0D\u8054\u7F51\u3001\u4E0D\u6267\u884C\u3001\u4E0D\u6539\u7A3F\u3002\u672A\u63D0\u4F9B\u7684\u8BC1\u636E\u8BB0\u4E3A\u7F3A\u5931\uFF0C\u4E0D\u81EA\u884C\u8FFD\u8BFB\uFF1B\u4E0D\u8981\u6C42\u51BB\u7ED3\u3001\u590D\u5236\u6216\u54C8\u5E0C\u3002

\u4ECE\u7A3F\u4EF6\u91CD\u5EFA\u5E76\u6311\u6218\u8D21\u732E\uFF1A\u65B9\u6CD5\u662F\u5426\u56DE\u7B54\u95EE\u9898\uFF1F\u9886\u57DF\u673A\u5236\u3001\u672F\u8BED\u3001\u6BD4\u8F83\u3001\u6587\u732E\u548C\u5C40\u9650\u662F\u5426\u6B63\u786E\uFF1F\u8D21\u732E\u3001\u8BC1\u636E\u548C\u8868\u8FBE\u662F\u5426\u9002\u5408\u76EE\u6807\u4F1A\u8BAE/\u671F\u520A\u4E0E\u8BFB\u8005\uFF1F\u6700\u5F3A\u5408\u7406\u53CD\u5BF9\u610F\u89C1\u9700\u8981\u4EC0\u4E48\u8BC1\u636E\u6216\u4FEE\u6539\uFF1F\u7F3A\u6295\u7A3F\u6216\u6587\u732E\u4F9D\u636E\u5C31\u8BF4\u660E\u9650\u5236\uFF0C\u4E0D\u5047\u5B9A\u4F5C\u8005\u4E3B\u7EBF\u6210\u7ACB\u3002

\u8FD4\u56DE\u7B80\u6D01 Markdown\uFF1A\u603B\u4F53\u5224\u65AD\u3001\u963B\u788D\u63A5\u6536\u7684\u5B9E\u8D28\u95EE\u9898\u3001\u7A3F\u4EF6\u4F4D\u7F6E\u6216\u7ED3\u679C\u4F9D\u636E\u3001\u5EFA\u8BAE\u4F5C\u8005\u7684\u884C\u52A8\uFF0C\u4EE5\u53CA\u5B9E\u9645\u8BFB\u8FC7\u7684\u6587\u4EF6\u548C\u90E8\u5206\u3002\u5408\u5E76\u5171\u540C\u539F\u56E0\uFF0C\u672A\u77E5\u4FDD\u6301\u672A\u77E5\u3002\u5C40\u90E8\u6307\u6807\u3001\u683C\u5F0F\u6216\u6784\u5EFA\u6210\u529F\u4E0D\u7B49\u4E8E\u79D1\u5B66\u53EF\u63A5\u53D7\uFF1B\u4E0D\u80FD\u9690\u53BB\u5931\u8D25\u3001\u7F29\u5C0F\u95EE\u9898\u6216\u6539\u53D8\u6807\u51C6\u5236\u9020\u901A\u8FC7\u3002\u4F60\u53EA\u8FD4\u56DE\u5224\u65AD\uFF0C\u4E3B\u4F1A\u8BDD\u51B3\u5B9A\u56DE\u5E94\u548C\u4FEE\u8BA2\uFF1B\u63A8\u8350\u4E0D\u662F\u5916\u90E8\u63A5\u6536\u3002`;
}
function generatedDoveAgentEntries() {
  return [
    { relativePath: DOVE_AGENT_SURFACES.claude, content: renderClaudeDoveAgent() },
    { relativePath: DOVE_AGENT_SURFACES.mentor, content: renderClaudeDoveMentorAgent() },
    { relativePath: DOVE_AGENT_SURFACES.review, content: renderClaudeDoveReviewAgent() }
  ];
}

// src/core/command-manifest.mjs
var PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/AUTHOR_PREFERENCES.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
var PACKAGE_BRAND_PATHS = ["dove.png"];
var PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs"];
var PROJECT_HOST_IDS = ["claude", "dsh"];
var DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([
  ".claude/rules/dove.md",
  DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.claude,
  DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS.claude,
  DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.claude,
  DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS.claude,
  ".claude/skills/dove-paper-search/SKILL.md",
  ".claude/skills/dove-web-reader/SKILL.md",
  ".claude/settings.json"
]);
var PACKAGE_RESOURCE_ROOT = "package-resources/hosts";
var PACKAGE_GENERATED_SUPPORT_PATHS = Object.freeze([
  ...Object.values(DOVE_AGENT_SURFACES).map((agentPath) => `${PACKAGE_RESOURCE_ROOT}/claude/${agentPath}`),
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/rules/dove.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/skills/dove-paper-search/SKILL.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/${EXA_WEB_SUPPORT_SKILL_PATH}`,
  ...PROJECT_HOST_IDS.flatMap((hostId) => [
    `${PACKAGE_RESOURCE_ROOT}/${hostId}/${DOVE_RESEARCH_QUALITY_REFERENCE_PATHS[hostId]}`,
    `${PACKAGE_RESOURCE_ROOT}/${hostId}/${DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS[hostId]}`,
    `${PACKAGE_RESOURCE_ROOT}/${hostId}/${DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS[hostId]}`,
    `${PACKAGE_RESOURCE_ROOT}/${hostId}/${DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS[hostId]}`
  ])
]);
var HOST_DEFINITIONS = {
  claude: { label: "Claude Code", scope: "project", jsonChecks: [] },
  dsh: { label: "DeepSeek Harness (dsh)", scope: "project", jsonChecks: [] }
};
var DEFAULT_HOST_GUIDANCE = Object.freeze({
  common: Object.freeze([
    "Use tools and materials exposed by the current host and permitted by the user and project. If something is unavailable, name the gap and continue with useful permitted alternatives."
  ]),
  claude: Object.freeze([
    "Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session."
  ]),
  dsh: Object.freeze([
    "Use project-local files and the tools exposed by the current DSH run."
  ])
});
function hostGuidance(extra = {}) {
  return Object.fromEntries(["common", "claude", "dsh"].map((hostId) => [hostId, [
    ...DEFAULT_HOST_GUIDANCE[hostId] ?? [],
    ...extra[hostId] ?? []
  ]]));
}
function capabilityContract(options) {
  return {
    ...options,
    hostGuidance: options.hostGuidance ?? hostGuidance()
  };
}
function contract(slug) {
  if (slug === "research") return capabilityContract({
    ambientParticipation: "Follow the shared topic-selection process until the user chooses a mainline, then advance it through work that can answer the research question.",
    purpose: "Help the user choose a research direction or advance the confirmed mainline through substantive method work.",
    when: "Use for topic exploration, method development or continuation of existing research.",
    actions: [
      "Apply the shared topic-selection process and RESEARCH_QUALITY.md's sourced gaps, cross-domain mechanism search and adversarial candidate review. Use Source for question-led full-text notes and link candidate cards to that evidence.",
      "After confirmation, diagnose key unknowns, design the core method, experiment, then write the proposal. Scale must answer the question. Use Experiment for comparisons and evaluator repairs; the executor recomputes comparable history when evaluation changes.",
      `Follow the shared research contract for mainline continuity, round records and ${DOVE_RESEARCH_MENTOR_NAME}'s direction-only judgment, including its triggers, fixed questions and note flow.`
    ],
    boundaries: [
      "Before the user's mainline choice, do not implement candidate methods; undertake only diagnostics allowed by the topic criteria. Bounded questions stay bounded, and read-only or design-only requests do not authorize execution."
    ]
  });
  if (slug === "status") return capabilityContract({
    ambientParticipation: "Explain what has been made, whether the core is demonstrated, what blocks progress and which round is underway without starting new work.",
    purpose: "Give a concise, evidence-grounded account of the current research state.",
    when: "Use when the user asks about progress or what remains unresolved.",
    actions: [
      "Read IDENTITY.md, the last few EVAL.md rows and the current round brief. Answer in four plain sentences covering what we have made, whether the core is demonstrated, what blocks it and which round is underway. Include actual values when useful and leave missing evidence unknown."
    ],
    boundaries: ["Status is read-only and does not run research or update documents."]
  });
  if (slug === "source") return capabilityContract({
    ambientParticipation: "Use inspected sources to answer the source question, broaden ideas and improve affected designs or claims.",
    purpose: "Discover, retrieve, inspect and verify sources that can change a research decision or answer a specified question.",
    when: "Use for literature discovery, source reading, citation identity checks, claim verification, related-work comparison or systematic synthesis.",
    actions: [
      "Start from the user's question and relevant existing notes. Distinguish discovery, verified citation identity, full-text inspection and claim support; none substitutes for the next. For citation identity, use direct DOI lookup before fuzzy title search, checking title, authors, year and venue/version. Report conflicts, missing entries and unknowns.",
      "For body-level details, read the full text with 1\u20135 concrete questions, using `.dove/research/papers/<id>.md` and the cumulative note format in RESEARCH_QUALITY.md. Reuse answered questions rather than rereading; append only new answers with section, page or equation locations, preserving earlier ones. Check-only work returns answers without creating notes or editing manuscripts.",
      "Split compound claims and mark each supported, contradicted, or uncovered, with the relevant passage, formula, algorithm or code and its limits. Use the cumulative notes for novelty and overlap judgments, link affected artifacts and recommend wording matching actual support, not support for only part of a sentence.",
      "Search real neighbors across fields at equal contribution granularity, following the shared topic guidance when selecting ideas. Inspect decisive overlap and use findings to develop mechanisms, candidates and controls, not just deduct novelty. Apply findings to designs or claims; stop when retrieval would not change the decision.",
      "For explicit systematic reviews or meta-analysis, define the question, search scope and eligibility. Use applicable PRISMA tracking, bias and certainty assessment; pool only comparable effects. Ordinary searches need no such machinery. Update `sources/SOURCES.md` only when useful links or synthesis change."
    ],
    boundaries: [
      "Search snippets, abstracts, metadata and absent search results do not establish full-text inspection or absence of overlap. If retrieval is unavailable, state the gap and use other permitted material rather than shell fetching or substitute retrieval chains."
    ],
    hostGuidance: hostGuidance({
      claude: ["Use exposed WebSearch for discovery, dove-paper-search for DOI metadata and academic papers, and hosted exa for ordinary webpages and known URLs."]
    })
  });
  if (slug === "experiment") return capabilityContract({
    ambientParticipation: "Use actual outputs and fair comparisons to distinguish method effects from implementation or evaluation errors.",
    purpose: "Develop, reproduce and evaluate methods with evidence that answers the research question.",
    when: "Use for authorized development, diagnostics, confirmation, reproduction or analysis of existing results.",
    actions: [
      "Inspect the relevant code, data, configuration, outputs and analysis before interpreting results. When a model cannot learn, test single-example overfitting to diagnose the learning mechanism rather than treating larger data or a larger evaluator as the first remedy. A diagnostic supports only the question it actually tests.",
      "Use complete-task comparisons against strong same-input alternatives to assess utility, and ablations or controlled comparisons to test attribution. Keep budgets, uncertainty and failure denominators visible, including missing or invalid outputs. Follow the shared experiment contract for method versions, full evaluation, fresh test draws and final heldout confirmation.",
      "The main executor repairs evaluator errors and recomputes every historical method and baseline under the corrected protocol on comparable data. Reuse retained raw outputs first and rerun historical versions where outputs are missing. Keep earlier protocol results as history rather than mixing them with current comparisons. Protocol repair alone is not a method-version change; ask the user only if the correction changes the goal's meaning."
    ],
    boundaries: [
      "Read-only or design-only requests do not execute. Heldout data used for tuning is no longer independent final evidence."
    ]
  });
  if (slug === "draft") return capabilityContract({
    ambientParticipation: "Write evidence-grounded text in the authoritative manuscript format and carry changes through to an inspected deliverable.",
    purpose: "Draft, assess or revise the specified manuscript, section or claim-bearing artifact.",
    when: "Use for requested writing or revision, or when the argument, expression or delivery artifact needs work.",
    actions: [
      "Read the target and claim evidence. Connect problem, gap, insight, method, evidence and limits; preserve certainty, causality, scope, quantitative qualifiers and novelty. Explain evidence-driven claim changes before revising. Address in-scope source, method, evidence or figure gaps rather than merely weakening prose; polished text does not establish a sound contribution.",
      "Use `.dove/research/papers/library.json` and `library.md` to group related work by direction, checking claim support against `papers/<id>.md`. Verify citation metadata with Source before citing or exporting BibTeX; never invent authors, venue, date or identifiers. Export only verified fields. Explicit library accumulation or a later watch run maintains the library; merely reading it does not write it.",
      "Write publishable findings, setup and limits plainly. Ask the author about missing material rather than putting 'not provided' into the manuscript. Follow reliable author style samples within accuracy and venue norms, and check effects on the whole argument without expanding local writing into a new research task.",
      DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY,
      "Carry edits through the real build or export path and inspect the actual output before calling it current. Check compiled pages for overfull boxes, undefined references, float numbering and placement, and wide tables that need full width in two-column layouts. Measure body word count on the source without tables, captions or references against the target. Fix in-scope issues and report remaining material limits.",
      "If a venue template needs missing fonts or packages, obtain them with permitted tools in a project-local texmf and point the build there, rather than silently substituting fonts or changing system installations."
    ],
    boundaries: [
      "Assessment-only requests return findings without edits. Local writing stays local and does not require a mentor, new round or subagent merely to read the materials. Artifact preparation does not authorize submission."
    ]
  });
  if (slug === "figure") return capabilityContract({
    ambientParticipation: "Turn inspected data or mechanism logic into a rendered, checked figure with a caption and editable sources.",
    purpose: "Gather materials and plan, create, revise, inspect and caption publication figures.",
    when: "Use for a requested diagram, plot, caption, visual revision or assessment, or when a visual is needed to explain evidence or a mechanism.",
    actions: [
      "Inspect the actual data, source visuals and mechanism logic. Plan the figure's claim, audience, panel structure, manuscript placement, final dimensions and editable-source route, distinguishing schematic explanation from measured evidence.",
      "Choose the route that fits the material: plot real data with reproducible code, draw diagrams in editable SVG or vector form, use exposed host image generation or editing when an illustrative image is appropriate and permitted, or combine raster panels with editable vector labels and layout. Keep scratch renders in a repository-local workspace such as `.claude/tmp/` unless directed otherwise.",
      "Render the actual figure and write its caption from the inspected materials, explaining panels, encodings and relevant limits without inventing data, results or method details.",
      "Open or view the actual rendered figure at realistic final dimensions and in manuscript context when available. Check source data or logic against panels, labels, units, legends, caption, nearby text and the claim. Draw at the final column width, keep text at least about 70% of body text in the body font family, avoid label collisions and distinguish series in grayscale. A standalone preview does not establish final-context readiness.",
      "For revision, change the editable source, plotting code, image, layout, caption or nearby text as needed, then rerender and inspect the result. Deliver the final figure file and caption with the route-native editable source, including plotting code and data references, vector structure or an editable raster/vector composition."
    ],
    boundaries: [
      "Planning-only, assessment-only and no-write requests return plans or findings without creating files. Judge a finished visual by faithful meaning and usability, not image counts, resolution or beauty alone."
    ]
  });
  if (slug === "review") return capabilityContract({
    ambientParticipation: "Judge the specified current paper in a clean read-only context, distinguishing independent review from author self-check and delivery checks.",
    purpose: "Assess the scientific quality of a paper, a local artifact, delivery readiness or an existing reviewer return.",
    when: "Use for paper judgment and review inspection rather than mentor direction decisions.",
    responsibilities: [
      DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
      DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY
    ],
    actions: [
      DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
      `For independent review, call ${DOVE_RESEARCH_REVIEW_AGENT_NAME} in a fresh read-only context with the current manuscript, cited results and relevant inspected venue or literature material. It uses Read/Grep/Glob on specified files, not the author's execution conversation. Use an equivalent clean context on other hosts and report the limitation if none is available; no frozen snapshot, review CLI or persistent reviewer session is needed.`,
      "Request a concise judgment with blocking issues, cited evidence, author-side actions and the files actually read. Missing grounding limits the judgment. Whole-paper review reads the complete current version, while local review stays local; after substantive changes, obtain a fresh full-version review before treating a previous recommendation as current.",
      "Preserve actual reviewer returns faithfully and distinguish user-pasted opinions from independent work performed. Store useful returns as ordinary project material, not a runtime exchange store. Reading or preserving a return does not itself authorize revisions or another review."
    ],
    boundaries: [
      "Review findings are reasoned objections, not empirical evidence or automatic acceptance. The author assesses their grounds and addresses material concerns; author self-check cannot certify independent review."
    ]
  });
  if (slug === "rebuttal") return capabilityContract({
    ambientParticipation: "Respond to verified review concerns as the author, make in-scope evidence-backed revisions and state what remains unresolved.",
    purpose: "Analyze review findings, draft author responses and implement requested revisions.",
    when: "Use when the user asks for a rebuttal, response or follow-through on review findings.",
    actions: [
      "Read the review, its reviewed-material list and the current artifacts. Group findings with the same root cause and verify their grounds rather than accepting every objection. Prioritize material consequences, decide whether to accept, rebut, qualify or investigate, and preserve coverage of every material finding.",
      "Use Source to verify new citations and claim support, and Experiment to obtain or interpret new results. Compare the original claim, reviewer interpretation, response and revised claim so certainty, causality, scope, quantitative qualifiers and novelty do not change silently. Shared mainline rules govern any proposed change of research direction.",
      "Draft the response and make requested revisions to evidence, analysis, text, figures, tables, supplements or venue-facing files, not just response tone. Address shared causes when a local reply would leave the concern intact. Preserve accurate claims and counterevidence instead of seeking apparent acceptance through cosmetic changes or unjustified narrowing.",
      "Use Draft's authoritative-source and build/export workflow to deliver inspected revisions. Apply Review's current-version rule before relying on an old recommendation, but do not rerun review merely for cosmetic or response-only edits. State whether each underlying concern is resolved, reduced or still limiting; a written reply is not resolution or reviewer acceptance.",
      "Keep useful responses, revisions and unresolved issues with links to the originating review and changed artifacts. Preserve original reviewer returns separately from author commentary and do not overwrite them with summaries."
    ],
    boundaries: [
      "Author-side responses and revisions remain within the requested scope and do not authorize submission or destructive actions."
    ]
  });
  return capabilityContract({
    ambientParticipation: "Consult useful Lessons at consequential choices or after recurring mistakes, and preserve transferable insights as optional guidance rather than evidence.",
    purpose: "Read and preserve researcher-owned Lessons that improve future choices or prevent repeated mistakes.",
    when: "Use when experience can inform a current decision, broaden ideas or improve later work, including explicit requests to remember or reflect.",
    actions: [
      "Before the first consequential choice for the current question, or after a correction or recurring failure exposes a shared mistaken premise, check `.dove/research/lessons/LESSONS.md` once if it exists. Follow only relevant or plausibly useful links and reuse Lessons already read in the active context. Missing Lessons and ordinary deterministic local work have no Lessons prerequisite; reading creates no files.",
      "Preserve a grounded reusable insight when it can improve research, collaboration or delivery, stating its basis, conditions, counterexamples and limits. For a transferable failure, explain the mistaken premise, still-valid earlier grounds and the better approach it informs. Reuse can refute a Lesson rather than strengthen it, so assess transfer value instead of counting applications.",
      "Write in the narrowest suitable researcher-owned Lessons document within author write scope. Create a content-bearing `.dove/research/lessons/LESSONS.md` only for the first qualifying insight, not an empty index during reading. Separate a theme into a naturally named Markdown file only when useful, and update its ordinary summary link. Omit routine progress, transient status, one-off tool failures and non-transferable bugs."
    ],
    boundaries: [
      "Lessons are optional, fallible guidance, not package defaults, research evidence or completion certificates. Recording advice does not fix the current problem or replace action, and needs no IDs, frontmatter schema or application ledger."
    ]
  });
}
var SURFACES = [
  ["research", "Explore a broad candidate pool for the user's choice, or advance a confirmed mainline with substantive research."],
  ["status", "Report the current results, core evidence, blockers and active round without running new work."],
  ["source", "Find and inspect sources, verify citation identities and claims, and use the findings to improve research decisions."],
  ["experiment", "Develop and evaluate methods through fair comparisons, informative diagnostics and trustworthy result analysis."],
  ["draft", "Write or revise evidence-grounded text and deliver the authoritative manuscript through its actual build or export."],
  ["figure", "Create and inspect figures from real materials, delivering captions and editable sources with the rendered visuals."],
  ["review", "Independently review the specified current paper or inspect local artifacts, delivery readiness and returned opinions."],
  ["rebuttal", "Verify review concerns, write author responses and make evidence-backed revisions within the requested scope."],
  ["lessons", "Read or preserve reusable guidance that improves judgment without turning routine progress into a second log."]
];
var COMMAND_SURFACES = SURFACES.map(([slug, summary]) => ({
  id: `dove.${slug}`,
  title: `Dove ${slug}`,
  summary,
  contract: contract(slug),
  examples: [`/dove:${slug}`]
}));
var COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));
function renderDoveAmbientParticipationSection() {
  return `## Capability participation

Apply these methods directly in the ordinary main session when useful; commands are shortcuts, not prerequisites. The main session retains judgment before and after delegation.

${COMMAND_SURFACES.map((command) => `- ${command.title}: ${command.contract.ambientParticipation}`).join("\n")}`;
}
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
  const extraPaths = hostId === "claude" ? [...DOVE_CLAUDE_AMBIENT_PROJECT_PATHS] : [
    DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.dsh,
    DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS.dsh,
    DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.dsh,
    DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS.dsh
  ];
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths: [...commandPaths, ...extraPaths], requiredPaths: [...commandPaths, ...extraPaths], jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));
var CURRENT_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...PACKAGE_RUNTIME_PATHS]),
  claude: Object.freeze([...HOST_ADAPTERS.claude.paths]),
  dsh: Object.freeze([...HOST_ADAPTERS.dsh.paths])
});
function packageResourcePath(hostId, destinationPath) {
  return `${PACKAGE_RESOURCE_ROOT}/${hostId}/${destinationPath}`;
}
var MANAGED_PACKAGE_PATHS = Object.freeze([
  ...commandAdapterPathsForHost("claude").map((item) => packageResourcePath("claude", item)),
  ...commandAdapterPathsForHost("dsh").map((item) => packageResourcePath("dsh", item)),
  ...PACKAGE_GENERATED_SUPPORT_PATHS,
  ...CURRENT_MANAGED_PATHS.core,
  ...PACKAGE_BRAND_PATHS,
  ...PACKAGE_DOCUMENTATION_PATHS
]);

// src/core/user-response-policy.mjs
var USER_RESPONSE_POLICY = Object.freeze([
  "Default to natural Chinese in user-facing responses; the user's explicit language and format requests take precedence.",
  "For judgment questions such as whether it meets the goal, is faster or can work, make the first sentence only the conclusion: \u8FBE\u5230 / \u6CA1\u8FBE\u5230 / \u80FD / \u4E0D\u80FD / \u8FD8\u4E0D\u77E5\u9053, or an equally direct answer to the question. Follow with one or two sentences of evidence and at most one sentence on evidence limits; do not open with \u53EF\u4EE5\uFF0C\u4F46\u662F. Explain complex ideas in plain language before technical detail, and explain necessary foreign terms in Chinese on first use.",
  "Report substantive progress and what it changes for the user's goal, not a tool or bookkeeping transcript. Plans state actions, data and decision-changing results; risks once. End naturally when the request is answered; include next steps only when useful, not as a fixed closing suggestion."
]);

// src/core/ambient-policy.mjs
var DOVE_CLAUDE_SETTINGS_PATH = ".claude/settings.json";
var DOVE_CLAUDE_AMBIENT_RULE_PATH = ".claude/rules/dove.md";
var DOVE_CLAUDE_SESSION_START_HOOK_COMMAND = 'dove hook session-start --project "$CLAUDE_PROJECT_DIR"';
var DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND = 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"';
var DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([Object.freeze({ type: "command", command: DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND, timeout: 10 })])
});
var DOVE_CLAUDE_STATUS_LINE_COMMAND = 'dove hook statusline --project "$CLAUDE_PROJECT_DIR"';
var DOVE_CLAUDE_STATUS_LINE = Object.freeze({
  type: "command",
  command: DOVE_CLAUDE_STATUS_LINE_COMMAND
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
function plainObject2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function sameKeys(value, keys) {
  return plainObject2(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}
function exactManagedHook(value, command) {
  if (!sameKeys(value, ["hooks"]) || !Array.isArray(value.hooks) || value.hooks.length !== 1) return false;
  const hook = value.hooks[0];
  return sameKeys(hook, ["command", "timeout", "type"]) && hook.type === "command" && hook.command === command && hook.timeout === 10;
}
function hookCommandMarkers(eventName) {
  if (eventName === "SessionStart") return ["dove hook session-start"];
  if (eventName === "UserPromptSubmit") return ["dove hook user-prompt-submit"];
  throw new Error(`Unsupported Dove Claude hook event: ${eventName}.`);
}
function referencesManagedHook(value, eventName) {
  if (!plainObject2(value) || !Array.isArray(value.hooks)) return false;
  const markers = hookCommandMarkers(eventName);
  return value.hooks.some((hook) => plainObject2(hook) && typeof hook.command === "string" && markers.some((marker) => hook.command.includes(marker)));
}
function mergeManagedHook(entries, eventName, command, managedEntry) {
  const exactEntries = entries.filter((entry) => exactManagedHook(entry, command));
  const conflictingEntries = entries.filter((entry) => referencesManagedHook(entry, eventName) && !exactManagedHook(entry, command));
  if (exactEntries.length > 1 || conflictingEntries.length > 0) {
    throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} already defines a conflicting Dove-managed ${eventName} hook.`);
  }
  return exactEntries.length === 1 ? { entries, changed: false } : { entries: [...entries, managedEntry], changed: true };
}
function assertClaudeSettingsShape(settings) {
  if (!plainObject2(settings)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} must contain a JSON object.`);
  if (settings.hooks !== void 0 && !plainObject2(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  return settings.hooks ?? {};
}
function mergeClaudeSessionStartSettings(settings) {
  const hooks = assertClaudeSettingsShape(settings);
  const sessionStartHooks = hooks.SessionStart;
  if (sessionStartHooks !== void 0 && !Array.isArray(sessionStartHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.SessionStart must be an array.`);
  const sessionStart = mergeManagedHook(sessionStartHooks ?? [], "SessionStart", DOVE_CLAUDE_SESSION_START_HOOK_COMMAND, DOVE_CLAUDE_SESSION_START_HOOK_ENTRY);
  if (!sessionStart.changed) return { settings, changed: false };
  return {
    settings: {
      ...settings,
      hooks: {
        ...hooks,
        SessionStart: sessionStart.entries
      }
    },
    changed: true
  };
}
function mergeClaudeUserPromptSubmitSettings(settings) {
  const hooks = assertClaudeSettingsShape(settings);
  const entries = hooks.UserPromptSubmit;
  if (entries !== void 0 && !Array.isArray(entries)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.UserPromptSubmit must be an array.`);
  const merged = mergeManagedHook(entries ?? [], "UserPromptSubmit", DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND, DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_ENTRY);
  if (!merged.changed) return { settings, changed: false };
  return { settings: { ...settings, hooks: { ...hooks, UserPromptSubmit: merged.entries } }, changed: true };
}
function renderClaudeAmbientRule() {
  return `# Dove

${USER_RESPONSE_POLICY.join("\n")}

This project rule is the primary Dove entry in ordinary Claude conversations. Apply its judgment to relevant research, engineering, experiment, writing, and collaboration work without requiring \`--agent dove\` or a Skill. This is scoped collaboration, not a separate Auto mode or permission to expand the request. Complete ordinary tasks with no research impact normally, without imposing research planning, grading, or records.

When running as dove-mentor or dove-review, follow that subagent's read-only material scope; the author-side bootstrap and round execution below do not apply.

${renderDoveSharedResearchContractSection()}

Full quality details (project-relative): \`${DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS.claude}\`. Consult relevant criteria only when an actual scoped quality or investment decision needs them. Author stance below owns the fresh main context's personal read of the two short summaries; reuse them after compact or resume, without reading both full references as a startup ritual. Neither guidance reference is research evidence.

${renderDoveAuthorStanceSection()}

${renderDoveAmbientParticipationSection()}

For web work, use the current project's real paper and webpage reading tools when available and permitted; search snippets can guide discovery, but do not replace unretrieved paper or webpage content with shell, \`curl\`, or ad hoc fetch substitutes.

Record concise natural-language notes in \`.dove/install/DOCTOR.md\` only for explicit feedback about Dove itself or actual Dove integration, routing, Skill, document, or guidance failures. Preserve reusable ordinary research or collaboration experience as Lessons instead.
`;
}

// src/core/identity-card.mjs
import fs3 from "node:fs";

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

// src/core/identity-card.mjs
var DOVE_IDENTITY_CARD_PATH = ".dove/research/IDENTITY.md";
var MAX_CARD_BYTES = 4096;
function readCard(project, options) {
  if (!project) return null;
  try {
    const root = openRootedFilesystem(project, { fsOps: options.fsOps ?? fs3 });
    const bytes = root.readFile(DOVE_IDENTITY_CARD_PATH);
    const truncated = bytes.length > MAX_CARD_BYTES;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, MAX_CARD_BYTES), { stream: truncated }).trim();
    return text ? { text, truncated } : null;
  } catch {
    return null;
  }
}
function readDoveIdentityCard(project, options = {}) {
  return readCard(project, options)?.text ?? null;
}
function parseDoveCurrentRound(card = "") {
  const brief = card.match(/^Current round:[ \t]*(.+)$/mu)?.[1]?.trim();
  const status = card.match(/^Round status:[ \t]*(.+)$/mu)?.[1]?.trim();
  return brief ? { brief, ongoing: /^(ongoing|进行中)$/iu.test(status ?? "") } : null;
}
function identityCardContext(project, options = {}) {
  const card = readCard(project, options);
  if (!card) return `No readable short identity card at ${DOVE_IDENTITY_CARD_PATH}. Do not infer a mainline from old notes. Create one for a confirmed goal when writing is permitted.`;
  const reminder = card.truncated ? "\nIdentity card exceeds 4KB; the beginning is shown, not a missing card. Read the full card when needed and shorten it without changing Mainline; keep round details in rounds/ and measurements in EVAL.md." : "";
  return `Project identity card (researcher-owned; corrections affect only relevant fields, not an unchanged Mainline):
${card.text}${reminder}`;
}

// src/core/host-migration.mjs
import fs4 from "node:fs";
import os from "node:os";
import path3 from "node:path";
var HOST_MIGRATION_PENDING_PATH = ".dove/install/MIGRATION_PENDING.md";
var HOST_MIGRATION_REGISTERED_PATH = ".dove/install/migration-registered.json";
var HOST_MIGRATION_TASK = `\u6574\u7406 3.4.0 \u8D77\u5DF2\u6709\u7684\u7814\u7A76\u8BB0\u5F55\uFF0C\u53EA\u5904\u7406\u5DF2\u6709\u5185\u5BB9\uFF0C\u4E0D\u4E3A\u8FC1\u79FB\u53E6\u5F00\u7814\u7A76\u4EFB\u52A1\uFF1A

1. .dove/research/IDENTITY.md \u6539\u4E3A\u89C4\u5219\u91CC\u7684\u56FA\u5B9A\u680F\u76EE\uFF0C\u7BC7\u5E45\u4E00\u773C\u80FD\u8BFB\u5B8C\uFF08\u7EA6 1200 \u5B57\u7B26\uFF09\uFF1B\u672A\u53D8\u7684 Mainline \u548C\u7528\u6237\u539F\u8BDD\u4FDD\u7559\uFF0C\u8FC7\u957F\u7684\u539F\u6587\u79FB\u5230\u540C\u76EE\u5F55\u5386\u53F2\u6587\u4EF6\u5E76\u94FE\u63A5\uFF1B\u7F3A Target tier \u4E14\u6CA1\u95EE\u8FC7\u5C31\u95EE\u4E00\u6B21\uFF1B\u6BCF\u6761\u9650\u5236\u6CE8\u660E\u5F15\u6587\u3001\u6765\u6E90\u3001\u539F\u8BDD\u8FD8\u662F\u8F6C\u8FF0\u3001\u957F\u671F\u8FD8\u662F\u5355\u6B21\u4EFB\u52A1\u3002
2. .dove/research/EVAL.md \u6539\u4E3A\u4E00\u4E2A\u65B9\u6CD5\u7248\u672C\u4E00\u884C\uFF0C\u5355\u5143\u683C\u5199\u5DF2\u6709\u6570\u5B57\u52A0\u4E00\u53E5\u8BDD\uFF08\u7EA6 200 \u5B57\u7B26\uFF09\uFF1B\u65E7\u7684\u957F\u5185\u5BB9\u539F\u6837\u79FB\u5230\u540C\u76EE\u5F55\u5386\u53F2\u6587\u4EF6\u5E76\u94FE\u63A5\uFF0C\u7ED3\u8BBA\u548C\u7ED3\u679C\u4FDD\u6301\u539F\u6837\u3002
3. MENTOR_NOTES.md \u8D85\u8FC7\u7EA6 6000 \u5B57\u7B26\u65F6\uFF0C\u4E0B\u6B21\u6B63\u5E38\u5BFC\u5E08\u8C03\u7528\u8BF7\u5BFC\u5E08\u5408\u5E76\u6210\u7EA6 3000 \u5B57\u7B26\u7684\u5168\u6587\u3002
4. watch/config.json \u4ECD\u662F draft \u65F6\uFF0C\u4E0B\u6B21\u6B63\u5E38\u5BFC\u5E08\u8C03\u7528\u8BF7\u5BFC\u5E08\u7ED9\u51FA\u8FFD\u8E2A\u4FEE\u6B63\u5EFA\u8BAE\uFF0C\u4E3B\u4F1A\u8BDD\u5199\u56DE\u5E76\u6807 source: mentor\u3002\u8981\u7B49\u4E0B\u6B21\u8C03\u7528\u7684\u4E8B\u9879\u5728\u5DF2\u6709\u8BB0\u5F55\u91CC\u7559\u4E00\u53E5\u63D0\u9192\uFF0C\u8FD9\u4E00\u9879\u5C31\u7B97\u5B8C\u6210\u3002
5. \u4ECD\u5728\u9009\u9898\u65F6\uFF0C\u4E0B\u6B21\u6B63\u5E38\u56DE\u590D\u6309\u8D28\u91CF\u6458\u8981\u4E00\u8F6E\u4EA4\u5019\u9009\u3001\u8FD1\u90BB\u53CA\u6700\u4F73 2\u20133 \u4E2A\u65B9\u5411\uFF0C\u4E0D\u8DB3\u7ED9 1 \u4E2A\uFF0C\u4E0D\u91CD\u8DD1\u3002\u63A8\u8350\u4F9B\u5B9A\u4E3B\u7EBF\uFF0C\u4E0D\u7B49\u65B9\u6CD5\u95ED\u5408\uFF0C\u6B63\u5F0F\u4EA7\u7269\u95E8\u69DB\u4E0D\u6263\u4F4F\u63A8\u8350\uFF1B\u6807\u51C6\u77DB\u76FE\u6216\u7981\u53D6\u8BC1\u636E\u5361\u4F4F\u65F6\uFF0C\u8BF4\u660E\u4E00\u6B21\u4ECD\u7ED9\u65B9\u5411\uFF0C\u8BF7\u7528\u6237\u9009\u6216\u8C03\u6807\u51C6\uFF0C\u4E0D\u9759\u6001\u6253\u78E8\u3002\u786E\u8BA4\u540E\u7ED3\u675F\u9009\u9898\u671F\u9650\u5236\uFF0C\u7F3A\u7684\u72EC\u7ACB\u8D44\u6E90\uFF0F\u8DD1\u6A21\u578B\u6388\u6743\u5408\u5E76\u95EE\u4E00\u6B21\uFF0C\u518D\u8BCA\u65AD\u3001\u8BBE\u8BA1\u3001\u5B9E\u9A8C\u3001\u5199\u5F00\u9898\uFF1B\u5DF2\u6709\u4E3B\u7EBF\u7EED\u505A\u3002\u4E0D\u6539\u9879\u76EE\u53CA\u7528\u6237\u7EA7\u6807\u51C6\u3001\u8FDB\u884C\u4E2D\u9009\u9898\u6750\u6599\uFF0C\u53EA\u6539\u540E\u7EED\u5B89\u6392\u3002
6. \u6E05\u7406\u81EA\u8BBE\u9650\u5236\uFF1A\u770B IDENTITY \u7684 User restrictions\u3001\u5F53\u524D brief \u548C\u5728\u7528\u7684\u6267\u884C\u534F\u8BAE\uFF0C\u6267\u884C\u8005\u6216\u5BFC\u5E08\u81EA\u5DF1\u52A0\u7684\u9650\u5236\u4E0E\u68C0\u67E5\uFF08\u54C8\u5E0C\u3001\u51BB\u7ED3\u3001\u7B49\u4EF7\u95E8\u7981\u3001\u53EA\u8BFB\u6E05\u5355\u7B49\uFF09\u9010\u6761\u5199\u4E00\u53E5\u5B83\u4FDD\u62A4\u4EC0\u4E48\uFF1B\u8BF4\u4E0D\u51FA\u4FDD\u62A4\u5BF9\u8C61\u7684\u5220\u6389\u6216\u6539\u4E3A\u4E00\u53E5\u8BF4\u660E\uFF0C\u7528\u6237\u539F\u8BDD\u5B9A\u7684\u9650\u5236\u539F\u6837\u4FDD\u7559\u3002
7. \u8BB0\u5F55\u5199\u6210\u4EBA\u8BDD\uFF1A\u8EAB\u4EFD\u5361\u7684\u7814\u7A76\u73B0\u72B6\u3001\u5F53\u524D\u8F6E\u6B21\u7684\u8BF4\u660E\u548C\u7ED3\u679C\u6539\u6210\u81EA\u7136\u4E2D\u6587\uFF0C\u5185\u90E8\u4EE3\u53F7\u7B2C\u4E00\u6B21\u51FA\u73B0\u65F6\u89E3\u91CA\u6216\u5220\u6389\uFF1B\u5F53\u524D\u8BF4\u660E\u8865\u4E00\u884C\u201C\u4E00\u53E5\u8BDD\uFF1A\u201D\u548C\u201C## \u9884\u671F\u7ED3\u679C\u201D\uFF0C\u5F53\u524D\u7ED3\u679C\u8865\u201C\u4E00\u53E5\u8BDD\uFF1A\u201D\u548C\u201C## \u9884\u671F\u4E0E\u5B9E\u9645\u201D\u3002\u65E7\u8F6E\u6B21\u4E0D\u5FC5\u56DE\u6539\u3002
8. \u8EAB\u4EFD\u5361\u52A0\u201CCore capability\uFF08\u6838\u5FC3\u80FD\u529B\uFF09\u201D\u4E00\u680F\uFF1A\u4ECE\u7528\u6237\u5386\u53F2\u539F\u8BDD\u91CC\u627E\u8FD9\u4E2A\u7814\u7A76\u5FC5\u987B\u4F53\u73B0\u7684\u80FD\u529B\u5E76\u9644\u539F\u8BDD\uFF1B\u627E\u4E0D\u5230\u5C31\u95EE\u7528\u6237\u4E00\u6B21\u3002\u82E5\u5F53\u524D\u505A\u6CD5\u5DF2\u4E0D\u518D\u4F53\u73B0\u5B83\uFF0C\u7528\u5927\u767D\u8BDD\u8BF4\u660E\u4E00\u6B21\u62FF\u6389\u4E86\u4EC0\u4E48\u3001\u539F\u8DEF\u7EBF\u4E3A\u4F55\u505C\u4E0B\uFF0C\u6309\u7528\u6237\u56DE\u7B54\u6267\u884C\u5E76\u8BB0\u5F55\uFF0C\u4E0D\u91CD\u590D\u63D0\u3002`;
function settingsPath(options) {
  const env = options.env ?? process.env;
  const base = env.XDG_CONFIG_HOME || path3.join(env.HOME || os.homedir(), ".config");
  if (!path3.isAbsolute(base)) throw new Error("Dove user configuration root must be absolute.");
  return path3.join(base, "dove/settings.json");
}
function hostSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.hostMigration !== void 0 && typeof value.hostMigration !== "boolean") {
    throw new Error("Dove host settings require a boolean hostMigration value.");
  }
  return { hostMigration: value.hostMigration ?? false };
}
function readHostSettings(options = {}) {
  const fsOps = options.fsOps ?? fs4;
  try {
    return hostSettings(JSON.parse(fsOps.readFileSync(settingsPath(options), "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return { hostMigration: false };
    throw error;
  }
}
function writeHostSettings(value, options = {}) {
  const settings = hostSettings(value);
  const fsOps = options.fsOps ?? fs4;
  const file = settingsPath(options);
  fsOps.mkdirSync(path3.dirname(file), { recursive: true, mode: 448 });
  const temporary = `${file}.${process.pid}.tmp`;
  fsOps.writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}
`, { mode: 384 });
  fsOps.renameSync(temporary, file);
  return settings;
}
function migrationFile(project, relativePath, options) {
  const root = openRootedFilesystem(project, options);
  if (!root.exists(relativePath)) return null;
  return root.readFile(relativePath).toString("utf8");
}
function renderHostMigrationPending(version = PACKAGE_VERSION, now = /* @__PURE__ */ new Date()) {
  const timestamp = new Date(now).toISOString();
  return `# Dove ${version} \u5BBF\u4E3B\u8FC1\u79FB\u5F85\u529E

\u767B\u8BB0\u65F6\u95F4\uFF1A${timestamp}

Dove \u5DF2\u66F4\u65B0\u5230 ${version}\u3002\u8BF7\u5728\u5F53\u524D\u5DE5\u4F5C\u544A\u4E00\u6BB5\u843D\u65F6\u5B8C\u6210\u4EE5\u4E0B\u8FC1\u79FB\uFF0C\u4E0D\u6253\u65AD\u5F53\u524D\u5728\u8DD1\u7684\u4EFB\u52A1\uFF0C\u4E0D\u6682\u505C\u6216\u91CD\u542F\u8BAD\u7EC3/\u8BC4\u6D4B\uFF0C\u4E0D\u6539\u52A8\u7814\u7A76\u7ED3\u8BBA\u548C\u7528\u6237\u539F\u8BDD\uFF0C\u4E0D\u91CD\u7B97\u4EFB\u4F55\u7ED3\u679C\u3002\u5B8C\u6210\u540E\u5220\u9664 ${HOST_MIGRATION_PENDING_PATH}\uFF0C\u5E76\u5728\u56DE\u590D\u4E2D\u7528\u4E00\u53E5\u8BDD\u8BF4\u660E\u505A\u4E86\u4EC0\u4E48\uFF1B\u4E0D\u9002\u7528\u7684\u4E8B\u9879\u8BF4\u660E\u4E00\u53E5\u539F\u56E0\u4E5F\u7B97\u5B8C\u6210\u3002\u6B64\u5F85\u529E\u4E0D\u53D6\u4EE3\u7528\u6237\u5F53\u524D\u8BF7\u6C42\u6216\u5176\u5199\u5165\u9650\u5236\u3002

${HOST_MIGRATION_TASK}
`;
}
function prepareHostMigration(project, options = {}) {
  const version = options.packageVersion ?? PACKAGE_VERSION;
  if (!HOST_MIGRATION_TASK || version !== PACKAGE_VERSION || !readHostSettings(options).hostMigration) return [];
  const registered = migrationFile(project, HOST_MIGRATION_REGISTERED_PATH, options);
  const prior = registered ? JSON.parse(registered) : null;
  if (prior && (prior.task === void 0 ? prior.version === version : prior.task === HOST_MIGRATION_TASK)) return [];
  return [
    { root: project, relativePath: HOST_MIGRATION_PENDING_PATH, content: renderHostMigrationPending(version, options.now), force: true },
    { root: project, relativePath: HOST_MIGRATION_REGISTERED_PATH, content: `${JSON.stringify({ version, task: HOST_MIGRATION_TASK })}
`, force: true }
  ];
}
function hostMigrationContext(project, options = {}) {
  if (!project || !readHostSettings(options).hostMigration) return "";
  const pending = migrationFile(project, HOST_MIGRATION_PENDING_PATH, options);
  return pending?.trim() ? `

${pending.trim()}` : "";
}

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
      ".claude/agents/dove.md"
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

// src/core/project-installation-manifest.mjs
import fs5 from "node:fs";
import path4 from "node:path";
var INSTALLATION_MANIFEST_PATH = ARTIFACT_PATHS.installationManifest;
var LEGACY_INSTALLATION_MANIFEST_PATH = ".dove-install/manifest.json";
var INSTALLATION_MANIFEST_REVISION = "2.0";
var MANIFEST_FIELDS = /* @__PURE__ */ new Set(["revision", "package", "runtime", "hosts", "managed", "createdAt", "updatedAt"]);
var PACKAGE_FIELDS = /* @__PURE__ */ new Set(["name", "version"]);
var RUNTIME_FIELDS = /* @__PURE__ */ new Set(["mode"]);
var MANAGED_FIELDS = /* @__PURE__ */ new Set(["path", "kind", "selector", "digest"]);
var MANAGED_KINDS = /* @__PURE__ */ new Set(["exclusive-file", "json-fragment", "text-block"]);
var MANAGED_REFERENCE_PATHS = /* @__PURE__ */ new Set([
  ".dove/install/RESEARCH_QUALITY.md",
  ".dove/install/RESEARCH_QUALITY_FULL.md",
  ".dove/install/AUTHOR_PREFERENCES.md",
  ".dove/install/AUTHOR_PREFERENCES_FULL.md"
]);
var SHA256 = /^[a-f0-9]{64}$/u;
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
  if (value.includes("\\") || path4.posix.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
    throw new Error(`${label} must be a project-relative path without backslashes: ${value}`);
  }
  const normalized = path4.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized === ".." || normalized.startsWith("../") || value.includes("//") || value.endsWith("/")) {
    throw new Error(`${label} must be one canonical project-relative path: ${value}`);
  }
  if ((value === ".dove" || value.startsWith(".dove/")) && !MANAGED_REFERENCE_PATHS.has(value)) {
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
  if (MANAGED_REFERENCE_PATHS.has(entry.path) && (entry.kind !== "exclusive-file" || entry.selector !== null)) {
    throw new Error(`${label} must own ${path4.posix.basename(entry.path)} as one exclusive file.`);
  }
  if (!MANAGED_KINDS.has(entry.kind)) throw new Error(`${label}.kind is unsupported: ${entry.kind}.`);
  if (entry.kind === "exclusive-file") {
    if (entry.selector !== null) throw new Error(`${label}.selector must be null for exclusive-file ownership.`);
  } else {
    nonEmptyString(entry.selector, `${label}.selector`);
  }
  if (typeof entry.digest !== "string" || !SHA256.test(entry.digest)) {
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
function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function inspectManifestFile(root, fsOps, manifestRelativePath) {
  const installationDirectory = path4.join(root, path4.posix.dirname(manifestRelativePath));
  const directoryStat = lstatOrNull(fsOps, installationDirectory);
  if (directoryStat === null) throw new Error(`Dove project installation manifest is missing: ${manifestRelativePath}.`);
  if (directoryStat.isSymbolicLink()) throw new Error(`Dove project installation directory must not be a symbolic link: ${installationDirectory}.`);
  if (!directoryStat.isDirectory()) throw new Error(`Dove project installation path must be a directory: ${installationDirectory}.`);
  const manifestPath = path4.join(root, manifestRelativePath);
  const stat = lstatOrNull(fsOps, manifestPath);
  if (stat === null) throw new Error(`Dove project installation manifest is missing: ${manifestRelativePath}.`);
  if (stat.isSymbolicLink()) throw new Error(`Dove project installation manifest must not be a symbolic link: ${manifestRelativePath}.`);
  if (!stat.isFile()) throw new Error(`Dove project installation manifest must be a regular file: ${manifestRelativePath}.`);
  return manifestPath;
}
function readProjectInstallationManifest(root, options = {}) {
  const fsOps = options.fsOps ?? fs5;
  const doveStat = lstatOrNull(fsOps, path4.join(root, ".dove"));
  if (doveStat && (doveStat.isSymbolicLink() || !doveStat.isDirectory())) throw new Error("Dove installation parent .dove must be a real directory.");
  if (lstatOrNull(fsOps, path4.join(root, ".dove-install")) !== null) throw new Error("Dove found unsupported legacy installation state; resolve it explicitly without automatic migration or cleanup.");
  const manifestPath = inspectManifestFile(root, fsOps, INSTALLATION_MANIFEST_PATH);
  try {
    const parsed = JSON.parse(fsOps.readFileSync(manifestPath, "utf8"));
    validateProjectInstallationManifest(parsed, options);
    return parsed;
  } catch (error) {
    throw new Error(`Invalid Dove project installation manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

// src/core/project-installation-plan.mjs
import fs8 from "node:fs";
import path7 from "node:path";

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
  args: Object.freeze(["--from", PAPER_SEARCH_PACKAGE_SPECIFIER, "--with", "mcp<2", PAPER_SEARCH_PACKAGE])
});
function renderPaperSearchSupportSkill() {
  return `---
name: dove-paper-search
description: Search, verify metadata, retrieve, and read academic papers through the pinned dove-paper-search project MCP when scholarly material is relevant and the current host exposes it and current user/project permissions permit it.
user-invocable: false
---

# Dove Paper Search

Use the pinned \`dove-paper-search\` project MCP only when academic paper discovery, metadata verification, retrieval, or full-text reading materially helps the current request and the current host exposes that MCP and current user/project permissions permit it.

- Keep searches bounded and choose relevant scholarly sources instead of querying every available index or service by default.
- When a DOI matters and the MCP exposes \`get_crossref_paper_by_doi\`, use that direct lookup before fuzzy title search. Compare DOI, title, authors, year, and venue or version, then report verified, conflict, not-found, or unknown.
- An empty result is not-found; an MCP, permission, or network failure is unknown. Do not recreate the lookup through CLI, shell, \`curl\`, ad hoc fetch, or a substitute chain.
- Metadata identity is not full-text inspection or claim support. Inspect actual paper content before saying it supports a scientific claim.
- Download or read full text only when the task needs it. Distinguish material merely found, identity-verified, downloaded, actually read, and used, and report saved paths when useful.
- Prefer source-native open download and read tools. If \`download_with_fallback\` is needed for full text, always pass \`use_scihub: false\` explicitly. Do not call Sci-Hub tools.
- Use only MCP tools that the current host actually exposes and current user/project permissions permit. If current user/project permissions do not permit it, \`uvx\` is unavailable, or the server fails, state that the academic paper discovery, metadata lookup, download, or full text was not obtained through \`dove-paper-search\`, then choose any exposed and permitted material or action that can still advance the question: \`WebSearch\` discovery snippets, Exa ordinary webpage/documentation/venue/known-URL text when exposed, local project material, user-provided material, theory, experiment, or analysis. Do not install dependencies or substitute a CLI, shell, \`curl\`, or ad hoc fetch script for this MCP, and do not follow a fixed substitute sequence.
- A bounded bibliography DOI identity check may cover the requested entries in the current manuscript; keep it within that scope. Keep DOI checks transient by default. Update an ordinary Source note or bibliography only when the result materially changes research judgment, manuscript citations, or continuation context. Do not build a database, cache, score, ledger, generated ID, or BibTeX parser around them.
- Keep \`dove-paper-search\` for scholarly paper acquisition. Use built-in \`WebSearch\` for discovery when appropriate, and the project \`exa\` MCP for ordinary webpages and known URLs when exposed and permitted.
`;
}

// src/core/project-installation-resources.mjs
import crypto2 from "node:crypto";

// scripts/generate-command-adapters.mjs
import fs7 from "node:fs";
import path6 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/core/file-set-transaction.mjs
import crypto from "node:crypto";
import fs6 from "node:fs";
import path5 from "node:path";
var MAX_CLEANUP_WARNINGS = 20;
var ENTRY_FIELDS = /* @__PURE__ */ new Set(["root", "relativePath", "content", "encoding", "force", "delete", "deleteEmptyDirectory", "expectedState", "label"]);
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}
function state(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return { exists: false, type: "absent", sha256: null, mode: null };
  if (stat.isSymbolicLink()) return { exists: true, type: "symlink", sha256: null, mode: stat.mode & 4095 };
  if (stat.isDirectory()) return { exists: true, type: "directory", sha256: null, mode: stat.mode & 4095 };
  if (!stat.isFile()) return { exists: true, type: "other", sha256: null, mode: stat.mode & 4095 };
  return { exists: true, type: "file", sha256: sha256(anchor.readFile(relativePath)), mode: stat.mode & 4095 };
}
function sameState(left, right) {
  return left.exists === right.exists && left.type === right.type && left.sha256 === right.sha256 && left.mode === right.mode;
}
function expectedState(raw, index) {
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
  const fsOps = options.fsOps ?? fs6;
  const transactionId = (options.transactionId ?? crypto.randomUUID()).replace(/[^a-z0-9._-]/giu, "-");
  const anchors = /* @__PURE__ */ new Map();
  const resolved = [];
  const targets = /* @__PURE__ */ new Set();
  const transactions = /* @__PURE__ */ new Map();
  const promotions = [];
  const createdDirectories = /* @__PURE__ */ new Map();
  const anchorFor = (root) => {
    const canonicalRoot = typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(path5.resolve(root)) : fsOps.realpathSync(path5.resolve(root));
    if (!anchors.has(canonicalRoot)) anchors.set(canonicalRoot, openRootedFilesystem(canonicalRoot, { fsOps }));
    return anchors.get(canonicalRoot);
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
      const approvedState = expectedState(entry.expectedState, index);
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
    const retainedAnchors = /* @__PURE__ */ new Set();
    const attempt = (callback, restoreAnchor) => {
      try {
        callback();
      } catch (rollbackError) {
        rollbackFailures.push(errorMessage(rollbackError));
        if (restoreAnchor) retainedAnchors.add(restoreAnchor);
      }
    };
    for (const promotion of [...promotions].reverse()) {
      const { entry } = promotion;
      attempt(() => {
        if (promotion.promoted && entry.anchor.exists(entry.relativePath)) {
          if (state(entry.anchor, entry.relativePath).sha256 !== sha256(entry.content)) {
            throw new Error(`Transactional rollback target changed: ${entry.relativePath}.`);
          }
          entry.anchor.remove(entry.relativePath, { force: true });
        }
        if (promotion.backupPath && entry.anchor.exists(promotion.backupPath)) {
          if (entry.anchor.exists(entry.relativePath)) throw new Error(`Transactional rollback target is occupied: ${entry.relativePath}.`);
          entry.anchor.rename(promotion.backupPath, entry.relativePath);
        }
      }, entry.anchor);
    }
    for (const entry of resolved) {
      if (entry.stagedPath) attempt(() => entry.anchor.remove(entry.stagedPath, { force: true }));
    }
    for (const [anchor, directories] of createdDirectories) {
      for (const directoryPath of [...directories].sort((left, right) => right.length - left.length)) attempt(() => anchor.rmdir(directoryPath, { force: true }));
    }
    for (const [anchor, transaction] of transactions) {
      if (retainedAnchors.has(anchor)) continue;
      attempt(() => anchor.remove(transaction.transactionPath, { recursive: true, force: true }));
      attempt(() => removeNewTransactionParents(anchor, transaction));
    }
    if (rollbackFailures.length > 0) {
      const retained = [...retainedAnchors].map((anchor) => {
        const transaction = transactions.get(anchor);
        return `${anchor.displayPath(transaction.transactionPath)} (backups: ${anchor.displayPath(transaction.backupRoot)})`;
      });
      throw new Error(`Transactional write failed and rollback also failed: ${errorMessage(error)}; rollback: ${rollbackFailures.join("; ")}${retained.length ? `; retained transaction paths: ${retained.join("; ")}` : ""}`, { cause: error });
    }
    throw new Error(`Transactional write failed and all staged changes were rolled back: ${errorMessage(error)}`, { cause: error });
  }
}

// scripts/generate-command-adapters.mjs
var __filename = fileURLToPath2(import.meta.url);
var __dirname = path6.dirname(__filename);
var PACKAGE_ROOT = path6.resolve(__dirname, "..");
function markdownTitle(command) {
  return command.title.replace(/\b\w/g, (char) => char.toUpperCase());
}
function yamlString(value) {
  return JSON.stringify(String(value).replace(/\n/g, " "));
}
function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
function exampleBullets(command, hostId = null) {
  if (hostId === "dsh") return [];
  const examples = command.examples;
  if (!Array.isArray(examples)) return [];
  return examples.map((example) => String(example).trim()).filter(Boolean);
}
function renderBullets(bullets2) {
  return bullets2.map((bullet) => `- ${bullet}`).join("\n");
}
function renderListSection(title, items) {
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  return values.length > 0 ? `### ${title}

${renderBullets(values)}` : "";
}
function renderHostGuidance(contract2, hostId) {
  const hostGuidance2 = contract2.hostGuidance ?? {};
  const values = unique([
    ...hostGuidance2.common ?? [],
    ...hostId ? hostGuidance2[hostId] ?? [] : []
  ]);
  return renderListSection("Using host tools", values);
}
function renderReturnWith(contract2) {
  return renderListSection("Return with", contract2.returnWith);
}
function renderCapabilityContract(command, hostId = null) {
  const contract2 = command.contract;
  if (!contract2) return "";
  const sections = [
    "## How Dove approaches this work\n\nThese are flexible research considerations, not a required order or report template.",
    `### What this is for

${contract2.purpose}`,
    `### When to use

${contract2.when}`,
    renderListSection("What Dove will examine", contract2.responsibilities),
    renderListSection("Scope and changes", contract2.boundaries),
    Array.isArray(contract2.actions) && contract2.actions.length > 0 ? `### Ways Dove may proceed

${renderBullets(contract2.actions)}` : "",
    renderListSection("What this should not replace", contract2.nonGoals),
    renderListSection("When Dove needs input", contract2.clarification),
    renderHostGuidance(contract2, hostId),
    renderReturnWith(contract2)
  ].filter(Boolean);
  return sections.join("\n\n");
}
function renderExamples(command, hostId = null) {
  const examples = exampleBullets(command, hostId);
  return examples.length > 0 ? `

## Examples

${examples.map((example) => `- \`${example}\``).join("\n")}` : "";
}
function renderArgumentBlock(hostId) {
  if (hostId !== "claude") return "";
  return "## Request\n\n$ARGUMENTS";
}
function renderBody(command, heading, hostId = null) {
  const purpose = command.summary;
  const args = renderArgumentBlock(hostId);
  const examples = renderExamples(command, hostId);
  const contract2 = renderCapabilityContract(command, hostId);
  const responsePolicy = hostId === "dsh" ? USER_RESPONSE_POLICY.join("\n") : "";
  const shared = hostId === "dsh" ? [
    responsePolicy,
    renderDoveSharedResearchContractSection(),
    command.id === "dove.status" ? `Quality summary (project-relative): \`${DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.dsh}\`; consult relevant details in \`${DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS.dsh}\` only when the status judgment needs them. Guidance is not research evidence.` : `Full quality details (project-relative): \`${DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS.dsh}\`. Consult relevant criteria only when an actual decision needs them; author stance below requires both short summaries in each fresh author main context. Reuse the briefs after compact or resume, not both full references as a startup ritual. Guidance is not research evidence.`,
    command.id === "dove.status" ? "For Status, apply these principles and user corrections to a read-only answer, not research execution or document updates." : renderDoveAuthorStanceSection()
  ].join("\n\n") : "";
  return [`# ${heading}`, purpose, args, examples.trim(), shared, contract2].filter(Boolean).join("\n\n") + "\n";
}
function renderFrontmatter(command, fields = {}) {
  const lines = ["---"];
  if (fields.name) {
    lines.push(`name: ${fields.name}`);
  }
  lines.push(`description: ${yamlString(command.summary)}`);
  if (fields.argumentHint) {
    lines.push(`argument-hint: ${yamlString(fields.argumentHint)}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}
function renderMarkdownCommand(command, heading, hostId = null) {
  return `${renderFrontmatter(command, { argumentHint: "optional request, artifact path, venue, constraint, or follow-up context" })}
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
function generatedResearchQualityReferenceEntries() {
  return PROJECT_HOST_IDS.flatMap((hostId) => [
    [DOVE_RESEARCH_QUALITY_REFERENCE_PATHS[hostId], renderDoveResearchQualityReference()],
    [DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS[hostId], renderDoveResearchQualityFullReference()]
  ].map(([destinationPath, content]) => ({
    hostId,
    destinationPath,
    relativePath: packageResourcePath(hostId, destinationPath),
    content
  })));
}
function generatedAuthorPreferencesReferenceEntries() {
  return PROJECT_HOST_IDS.flatMap((hostId) => [
    [DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS[hostId], renderDoveAuthorPreferencesReference()],
    [DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS[hostId], renderDoveAuthorPreferencesFullReference()]
  ].map(([destinationPath, content]) => ({
    hostId,
    destinationPath,
    relativePath: packageResourcePath(hostId, destinationPath),
    content
  })));
}
function generatedClaudeAmbientProjectEntries() {
  return [
    { destinationPath: DOVE_CLAUDE_AMBIENT_RULE_PATH, relativePath: packageResourcePath("claude", DOVE_CLAUDE_AMBIENT_RULE_PATH), content: renderClaudeAmbientRule() },
    { destinationPath: PAPER_SEARCH_SUPPORT_SKILL_PATH, relativePath: packageResourcePath("claude", PAPER_SEARCH_SUPPORT_SKILL_PATH), content: renderPaperSearchSupportSkill() },
    { destinationPath: EXA_WEB_SUPPORT_SKILL_PATH, relativePath: packageResourcePath("claude", EXA_WEB_SUPPORT_SKILL_PATH), content: renderExaWebSupportSkill() }
  ];
}

// src/core/project-installation-resources.mjs
var USER_PROMPT_SUBMIT_SELECTOR = "/hooks/UserPromptSubmit[dove-user-prompt-submit]";
var SESSION_START_SELECTOR = "/hooks/SessionStart[dove-session-start]";
var STOP_SELECTOR = "/hooks/Stop[dove-stop]";
var STATUS_LINE_SELECTOR = "/statusLine[dove-project-directory]";
var CLAUDE_HOST = "claude";
var FORBIDDEN_RESOURCE_PREFIXES = [".dove/", "bin/", "dist/", "mcp/", "scripts/"];
function sha2562(content) {
  return crypto2.createHash("sha256").update(content).digest("hex");
}
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}
function semanticDigest(value) {
  return sha2562(canonicalJson(value));
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
function assertManagedResourcePath(relativePath) {
  if ([".dove/install/RESEARCH_QUALITY.md", ".dove/install/RESEARCH_QUALITY_FULL.md", ".dove/install/AUTHOR_PREFERENCES.md", ".dove/install/AUTHOR_PREFERENCES_FULL.md"].includes(relativePath)) return;
  if (relativePath === ".dove" || relativePath.startsWith(".dove/")) throw new Error(`Project integration resources must not manage Dove workspace state: ${relativePath}.`);
  if (FORBIDDEN_RESOURCE_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) throw new Error(`Project integration resources must not install runtime bundles: ${relativePath}.`);
}
function claudeResources() {
  const agentEntries = generatedDoveAgentEntries().filter((entry) => entry.relativePath.startsWith(".claude/agents/"));
  const files = [
    ...generatedAdapterEntries().filter((entry) => entry.hostId === CLAUDE_HOST),
    ...generatedClaudeAmbientProjectEntries(),
    ...generatedResearchQualityReferenceEntries().filter((entry) => entry.hostId === CLAUDE_HOST),
    ...generatedAuthorPreferencesReferenceEntries().filter((entry) => entry.hostId === CLAUDE_HOST),
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
      digest: sha2562(content)
    };
  });
  const sessionStartHook = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: SESSION_START_SELECTOR,
    fragment: DOVE_CLAUDE_SESSION_START_HOOK_ENTRY,
    digest: semanticDigest(DOVE_CLAUDE_SESSION_START_HOOK_ENTRY)
  };
  const userPromptSubmitHook = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: USER_PROMPT_SUBMIT_SELECTOR,
    fragment: DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_ENTRY,
    digest: semanticDigest(DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_ENTRY)
  };
  const statusLine = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: STATUS_LINE_SELECTOR,
    fragment: DOVE_CLAUDE_STATUS_LINE,
    digest: semanticDigest(DOVE_CLAUDE_STATUS_LINE)
  };
  const webFetchDeny = {
    hostId: CLAUDE_HOST,
    path: DOVE_CLAUDE_SETTINGS_PATH,
    kind: "json-fragment",
    selector: WEB_FETCH_DENY_SELECTOR,
    fragment: WEB_FETCH_DENY_PERMISSION,
    digest: semanticDigest(WEB_FETCH_DENY_PERMISSION)
  };
  const paperSearch = {
    hostId: CLAUDE_HOST,
    path: PAPER_SEARCH_MCP_PATH,
    kind: "json-fragment",
    selector: PAPER_SEARCH_MCP_SELECTOR,
    fragment: PAPER_SEARCH_MCP_FRAGMENT,
    digest: semanticDigest(PAPER_SEARCH_MCP_FRAGMENT)
  };
  const exa = {
    hostId: CLAUDE_HOST,
    path: PAPER_SEARCH_MCP_PATH,
    kind: "json-fragment",
    selector: EXA_MCP_SELECTOR,
    fragment: EXA_MCP_FRAGMENT,
    digest: semanticDigest(EXA_MCP_FRAGMENT)
  };
  const resources = [...files, sessionStartHook, userPromptSubmitHook, statusLine, webFetchDeny, paperSearch, exa];
  if (new Set(resources.map(managedKey2)).size !== resources.length) throw new Error("Generated project integration resources contain duplicate manifest entries.");
  return resources;
}
function dshResources() {
  return [...generatedAdapterEntries(), ...generatedResearchQualityReferenceEntries(), ...generatedAuthorPreferencesReferenceEntries()].filter((entry) => entry.hostId === "dsh").map((entry) => {
    assertManagedResourcePath(entry.destinationPath);
    const content = normalizedGeneratedContent(entry.content);
    return {
      hostId: "dsh",
      path: entry.destinationPath,
      kind: "exclusive-file",
      selector: null,
      content,
      digest: sha2562(content)
    };
  });
}
function resourcesForHosts(hosts) {
  const selected = [...claudeResources(), ...dshResources()].filter((entry) => hosts.includes(entry.hostId));
  return [...new Map(selected.map((entry) => [managedKey2(entry), entry])).values()].sort(compareManaged2);
}
function desiredManaged(resources) {
  return resources.map(({ path: relativePath, kind, selector, digest }) => ({ path: relativePath, kind, selector, digest })).sort(compareManaged2);
}

// src/core/strict-json.mjs
function duplicateKeyError(label, key, path17) {
  throw new Error(`${label} must not contain duplicate JSON object keys: ${path17 === "$" ? key : `${path17}.${key}`}.`);
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
  function parseArray(path17) {
    index += 1;
    skipWhitespace();
    if (text[index] === "]") {
      index += 1;
      return;
    }
    let itemIndex = 0;
    while (true) {
      parseValue(`${path17}[${itemIndex}]`);
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
  function parseObject(path17) {
    index += 1;
    skipWhitespace();
    if (text[index] === "}") {
      index += 1;
      return;
    }
    const keys = /* @__PURE__ */ new Set();
    while (true) {
      const key = parseString();
      if (keys.has(key)) duplicateKeyError(label, key, path17);
      keys.add(key);
      skipWhitespace();
      if (text[index] !== ":") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      parseValue(path17 === "$" ? `$.${key}` : `${path17}.${key}`);
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
  function parseValue(path17) {
    skipWhitespace();
    const character = text[index];
    if (character === "{") parseObject(path17);
    else if (character === "[") parseArray(path17);
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

// src/core/project-installation-plan.mjs
function plainObject4(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function lstatOrNull2(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function inspectRegularProjectFile(root, relativePath, fsOps = fs8) {
  let current = root;
  const components = relativePath.split("/");
  for (const [index, component] of components.entries()) {
    current = path7.join(current, component);
    const stat = lstatOrNull2(fsOps, current);
    if (stat === null) return { exists: false, bytes: null, digest: null, mode: null, type: "absent" };
    if (stat.isSymbolicLink()) throw new Error(`Dove project integration path must not be a symbolic link: ${relativePath}.`);
    if (index < components.length - 1) {
      if (!stat.isDirectory()) throw new Error(`Dove project integration parent must be a directory: ${relativePath}.`);
      continue;
    }
    if (!stat.isFile()) throw new Error(`Dove project integration path must be absent or a regular file: ${relativePath}.`);
    const bytes = fsOps.readFileSync(current);
    return { exists: true, bytes, digest: sha2562(bytes), mode: stat.mode & 4095, type: "file" };
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
function sameKeys2(value, keys) {
  return plainObject4(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}
function exactRetiredDoveUserPromptSubmitHook(entry) {
  if (!sameKeys2(entry, ["hooks"]) || !Array.isArray(entry.hooks) || entry.hooks.length !== 1) return false;
  const hook = entry.hooks[0];
  return sameKeys2(hook, ["command", "timeout", "type"]) && hook.type === "command" && hook.command === 'node "$CLAUDE_PROJECT_DIR/scripts/dove-user-prompt-submit-package.mjs"' && hook.timeout === 10;
}
function inspectRetiredHooks(settings) {
  const matchedPaths = [];
  for (const [index, entry] of (settings.hooks?.UserPromptSubmit ?? []).entries()) {
    if (exactRetiredDoveUserPromptSubmitHook(entry)) matchedPaths.push(`${DOVE_CLAUDE_SETTINGS_PATH}#/hooks/UserPromptSubmit/${index}`);
  }
  return { matchedPaths };
}
function hookCommandMarkers2(eventName) {
  if (eventName === "SessionStart") return ["dove hook session-start"];
  if (eventName === "UserPromptSubmit") return ["dove hook user-prompt-submit"];
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
  if (entries !== void 0 && !Array.isArray(entries)) {
    throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.${eventName} must be an array.`);
  }
  const candidates = (entries ?? []).map((entry, index) => ({ entry, index })).filter(({ entry }) => referencesDoveHook(entry, eventName));
  if (candidates.length > 1) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} defines multiple Dove ${eventName} hooks.`);
  if (candidates.length === 0) return { exists: false, digest: null, index: -1, fragment: null };
  const fragment = candidates[0].entry;
  return { exists: true, digest: semanticDigest(fragment), index: candidates[0].index, fragment };
}
function settingsWithHookEntries(settings, eventName, entries) {
  const hooks = { ...settings.hooks };
  if (entries.length > 0) hooks[eventName] = entries;
  else delete hooks[eventName];
  const next = { ...settings };
  if (Object.keys(hooks).length > 0) next.hooks = hooks;
  else delete next.hooks;
  return next;
}
function namedMcpFragmentState(config, serverName) {
  if (config.mcpServers !== void 0 && !plainObject4(config.mcpServers)) throw new Error(`${PAPER_SEARCH_MCP_PATH} mcpServers must be a JSON object.`);
  if (!Object.hasOwn(config.mcpServers ?? {}, serverName)) return { exists: false, digest: null, fragment: null };
  const fragment = config.mcpServers[serverName];
  return { exists: true, digest: semanticDigest(fragment), fragment };
}
function paperSearchMcpFragmentState(config) {
  return namedMcpFragmentState(config, PAPER_SEARCH_MCP_SERVER_NAME);
}
function exaMcpFragmentState(config) {
  return namedMcpFragmentState(config, EXA_MCP_SERVER_NAME);
}
function webFetchDenyFragmentState2(settings) {
  const state2 = webFetchDenyFragmentState(settings);
  return state2.exists ? { ...state2, digest: semanticDigest(state2.fragment) } : state2;
}
function statusLineState(value) {
  if (value.statusLine === void 0) return { exists: false, digest: null, index: -1, fragment: null };
  return { exists: true, digest: semanticDigest(value.statusLine), index: -1, fragment: value.statusLine };
}
function fragmentState(resource, value) {
  if (resource.selector === USER_PROMPT_SUBMIT_SELECTOR) return hookFragmentState(value, "UserPromptSubmit");
  if (resource.selector === SESSION_START_SELECTOR) return hookFragmentState(value, "SessionStart");
  if (resource.selector === STOP_SELECTOR) return hookFragmentState(value, "Stop");
  if (resource.selector === STATUS_LINE_SELECTOR) return statusLineState(value);
  if (resource.selector === WEB_FETCH_DENY_SELECTOR) return webFetchDenyFragmentState2(value);
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) return paperSearchMcpFragmentState(value);
  if (resource.selector === EXA_MCP_SELECTOR) return exaMcpFragmentState(value);
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}
function removeHookFragment(value, eventName) {
  const state2 = hookFragmentState(value, eventName);
  if (!state2.exists) return value;
  return settingsWithHookEntries(value, eventName, value.hooks[eventName].filter((_, index) => index !== state2.index));
}
function removeFragment(resource, value, current, options = {}) {
  if (resource.selector === USER_PROMPT_SUBMIT_SELECTOR) return removeHookFragment(value, "UserPromptSubmit");
  if (resource.selector === SESSION_START_SELECTOR) return removeHookFragment(value, "SessionStart");
  if (resource.selector === STOP_SELECTOR) return removeHookFragment(value, "Stop");
  if (resource.selector === STATUS_LINE_SELECTOR) {
    const next = { ...value };
    if (options.force === true || JSON.stringify(next.statusLine) === JSON.stringify(DOVE_CLAUDE_STATUS_LINE)) delete next.statusLine;
    return next;
  }
  if (resource.selector === WEB_FETCH_DENY_SELECTOR) {
    return removeWebFetchDenyPermission(value).settings;
  }
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) {
    const servers = { ...value.mcpServers };
    delete servers[PAPER_SEARCH_MCP_SERVER_NAME];
    return { ...value, mcpServers: servers };
  }
  if (resource.selector === EXA_MCP_SELECTOR) {
    const servers = { ...value.mcpServers };
    delete servers[EXA_MCP_SERVER_NAME];
    return { ...value, mcpServers: servers };
  }
  throw new Error(`Unsupported Dove project integration selector: ${resource.selector}.`);
}
function emptySharedJsonShell(resource, value) {
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR || resource.selector === EXA_MCP_SELECTOR) {
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
function localEditRecord(resource) {
  return { path: resource.path, selector: resource.selector ?? null };
}
function shouldReplaceLocalEdit(options) {
  return options.replacementPolicy === "explicit-update" || options.replacementPolicy === "confirmed-reinstall";
}
function shouldRecordReplacedLocalEdit(options) {
  return options.replacementPolicy === "explicit-update";
}
function shouldSkipLocalEdit(options) {
  return options.replacementPolicy === "inspect" || options.replacementPolicy === "auto-inspect";
}
function shouldPreserveMissing(options) {
  return options.replacementPolicy === "auto-inspect" || options.replacementPolicy === "auto-safe";
}
function emptyPlanResult(entry = null, changed = false) {
  return { entry, changed, skippedLocalEdits: [], replacedLocalEdits: [], retainedManaged: [], omittedManagedKeys: [] };
}
function planExclusive(root, desired, oldEntry, fsOps, options = {}) {
  const resource = desired ?? oldEntry;
  const replaceDrift = shouldReplaceLocalEdit(options);
  const skipDrift = shouldSkipLocalEdit(options);
  const observed = inspectRegularProjectFile(root, resource.path, fsOps);
  if (!oldEntry) {
    if (!observed.exists) return emptyPlanResult(transactionWrite(root, desired, desired.content, observed), true);
    if (observed.digest === desired.digest) return emptyPlanResult(null, false);
    throw conflictError(desired);
  }
  if (desired) {
    if (!observed.exists) {
      if (shouldPreserveMissing(options)) {
        if (skipDrift) return { ...emptyPlanResult(null, false), skippedLocalEdits: [localEditRecord(resource)], retainedManaged: [oldEntry], omittedManagedKeys: [managedKey2(resource)] };
        throw driftError(resource, null);
      }
      return emptyPlanResult(transactionWrite(root, desired, desired.content, observed), true);
    }
    const drifted2 = observed.digest !== oldEntry.digest && observed.digest !== desired.digest;
    if (drifted2 && !replaceDrift) {
      if (skipDrift) return { ...emptyPlanResult(null, false), skippedLocalEdits: [localEditRecord(resource)], retainedManaged: [oldEntry], omittedManagedKeys: [managedKey2(resource)] };
      throw driftError(resource, observed.digest);
    }
    if (observed.digest === desired.digest) return emptyPlanResult(null, oldEntry.digest !== desired.digest);
    return {
      ...emptyPlanResult(transactionWrite(root, desired, desired.content, observed), true),
      replacedLocalEdits: drifted2 && shouldRecordReplacedLocalEdit(options) ? [localEditRecord(resource)] : []
    };
  }
  if (!observed.exists) {
    if (shouldPreserveMissing(options)) {
      if (skipDrift) return { ...emptyPlanResult(null, false), skippedLocalEdits: [localEditRecord(resource)], retainedManaged: [oldEntry], omittedManagedKeys: [managedKey2(resource)] };
      throw driftError(resource, null);
    }
    return emptyPlanResult(null, true);
  }
  const drifted = observed.digest !== oldEntry.digest;
  if (drifted && !replaceDrift) {
    if (skipDrift) return { ...emptyPlanResult(null, false), skippedLocalEdits: [localEditRecord(resource)], retainedManaged: [oldEntry], omittedManagedKeys: [managedKey2(resource)] };
    throw driftError(resource, observed.digest);
  }
  return {
    ...emptyPlanResult(transactionDelete(root, resource, observed), true),
    replacedLocalEdits: drifted && shouldRecordReplacedLocalEdit(options) ? [localEditRecord(resource)] : []
  };
}
function addFragment(resource, value) {
  if (resource.selector === USER_PROMPT_SUBMIT_SELECTOR) return mergeClaudeUserPromptSubmitSettings(value).settings;
  if (resource.selector === SESSION_START_SELECTOR) return mergeClaudeSessionStartSettings(value).settings;
  if (resource.selector === STATUS_LINE_SELECTOR) return { ...value, statusLine: resource.fragment };
  if (resource.selector === WEB_FETCH_DENY_SELECTOR) return mergeWebFetchDenyPermission(value).settings;
  if (resource.selector === PAPER_SEARCH_MCP_SELECTOR) {
    return {
      ...value,
      mcpServers: {
        ...value.mcpServers ?? {},
        [PAPER_SEARCH_MCP_SERVER_NAME]: resource.fragment
      }
    };
  }
  if (resource.selector === EXA_MCP_SELECTOR) {
    return {
      ...value,
      mcpServers: {
        ...value.mcpServers ?? {},
        [EXA_MCP_SERVER_NAME]: resource.fragment
      }
    };
  }
  throw new Error(`Dove does not install unsupported project-local fragment ${resource.path}#${resource.selector}.`);
}
function planJsonFragments(root, relativePath, desiredEntries, oldEntries, fsOps = fs8, options = {}) {
  const replaceDrift = shouldReplaceLocalEdit(options);
  const skipDrift = shouldSkipLocalEdit(options);
  const observed = inspectRegularProjectFile(root, relativePath, fsOps);
  const original = parseSharedJson(observed, relativePath);
  const retiredHooks = relativePath === DOVE_CLAUDE_SETTINGS_PATH && options.replacementPolicy === "inspect" ? inspectRetiredHooks(original) : null;
  const desiredByKey = new Map(desiredEntries.map((entry) => [managedKey2(entry), entry]));
  const oldByKey = new Map(oldEntries.map((entry) => [managedKey2(entry), entry]));
  const skippedLocalEdits = [];
  const replacedLocalEdits = [];
  const retainedManaged = [];
  const omittedManagedKeys = [];
  let next = original;
  let changed = false;
  const retainSkipped = (resource2, oldEntry) => {
    skippedLocalEdits.push(localEditRecord(resource2));
    if (oldEntry) retainedManaged.push(oldEntry);
    omittedManagedKeys.push(managedKey2(resource2));
  };
  for (const key of [.../* @__PURE__ */ new Set([...oldByKey.keys(), ...desiredByKey.keys()])].sort()) {
    const desired = desiredByKey.get(key) ?? null;
    const oldEntry = oldByKey.get(key) ?? null;
    const resource2 = desired ?? oldEntry;
    if (oldEntry && resource2.selector === USER_PROMPT_SUBMIT_SELECTOR && Array.isArray(next.hooks?.UserPromptSubmit)) {
      const entries = next.hooks.UserPromptSubmit;
      const ownedLegacy = entries.filter((entry) => exactRetiredDoveUserPromptSubmitHook(entry) && semanticDigest(entry) === oldEntry.digest);
      if (ownedLegacy.length > 1) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} defines multiple owned legacy Dove UserPromptSubmit hooks.`);
      if (ownedLegacy.length === 1) {
        next = settingsWithHookEntries(next, "UserPromptSubmit", entries.filter((entry) => entry !== ownedLegacy[0]));
        changed = true;
      }
    }
    const current = fragmentState(resource2, next);
    if (oldEntry && !desired && (resource2.selector === USER_PROMPT_SUBMIT_SELECTOR || resource2.selector === STOP_SELECTOR)) {
      if (resource2.selector === STOP_SELECTOR && (!current.exists || current.digest !== oldEntry.digest)) {
        if (skipDrift) {
          retainSkipped(resource2, oldEntry);
          continue;
        }
        throw driftError(resource2, current.digest);
      }
      if (!current.exists && shouldPreserveMissing(options)) {
        if (skipDrift) {
          retainSkipped(resource2, oldEntry);
          continue;
        }
        throw driftError(resource2, null);
      }
      if (current.exists && current.digest === oldEntry.digest) {
        next = removeFragment(resource2, next, current, { force: true });
      }
      changed = true;
      continue;
    }
    if (oldEntry && !desired && resource2.selector === STATUS_LINE_SELECTOR) {
      if (!current.exists && shouldPreserveMissing(options)) {
        if (skipDrift) {
          retainSkipped(resource2, oldEntry);
          continue;
        }
        throw driftError(resource2, null);
      }
      if (current.exists && current.digest === oldEntry.digest) {
        next = removeFragment(resource2, next, current, { force: true });
      }
      changed = true;
      continue;
    }
    if (!oldEntry) {
      if (current.exists && current.digest === desired.digest) continue;
      if (current.exists) throw conflictError(desired);
      next = addFragment(desired, next);
      changed = true;
      continue;
    }
    if (desired) {
      if (!current.exists) {
        if (shouldPreserveMissing(options)) {
          if (skipDrift) {
            retainSkipped(resource2, oldEntry);
            continue;
          }
          throw driftError(resource2, null);
        }
        next = addFragment(desired, next);
        changed = true;
        continue;
      }
      const drifted2 = current.digest !== oldEntry.digest && current.digest !== desired.digest;
      if (drifted2 && !replaceDrift) {
        if (skipDrift) {
          retainSkipped(resource2, oldEntry);
          continue;
        }
        throw driftError(resource2, current.digest);
      }
      if (current.digest === desired.digest) {
        if (oldEntry.digest !== desired.digest) changed = true;
        continue;
      }
      next = addFragment(desired, removeFragment(desired, next, current, { force: replaceDrift }));
      changed = true;
      if (drifted2 && shouldRecordReplacedLocalEdit(options)) replacedLocalEdits.push(localEditRecord(resource2));
      continue;
    }
    if (!current.exists) {
      if (shouldPreserveMissing(options)) {
        if (skipDrift) {
          retainSkipped(resource2, oldEntry);
          continue;
        }
        throw driftError(resource2, null);
      }
      changed = true;
      continue;
    }
    const drifted = current.digest !== oldEntry.digest;
    if (drifted && !replaceDrift) {
      if (skipDrift) {
        retainSkipped(resource2, oldEntry);
        continue;
      }
      throw driftError(resource2, current.digest);
    }
    next = removeFragment(resource2, next, current, { force: replaceDrift });
    changed = true;
    if (drifted && shouldRecordReplacedLocalEdit(options)) replacedLocalEdits.push(localEditRecord(resource2));
  }
  if (canonicalJson(next) === canonicalJson(original)) {
    return { entry: null, changed, skippedLocalEdits, replacedLocalEdits, retainedManaged, omittedManagedKeys, retiredHooks };
  }
  const resource = desiredEntries[0] ?? oldEntries[0];
  return {
    entry: emptySharedJsonShell(resource, next) ? transactionDelete(root, resource, observed) : transactionWrite(root, resource, serializeSharedJson(next), observed),
    changed: true,
    skippedLocalEdits,
    replacedLocalEdits,
    retainedManaged,
    omittedManagedKeys,
    retiredHooks
  };
}
function planResource(root, desired, oldEntry, fsOps = fs8, options = {}) {
  const kind = desired?.kind ?? oldEntry.kind;
  if (kind === "exclusive-file") return planExclusive(root, desired, oldEntry, fsOps, options);
  throw new Error(`Unsupported project integration resource kind: ${kind}.`);
}
function assertManagedOwnership(manifest) {
  const hosts = manifest?.hosts ?? [];
  const knownKeys = new Set(resourcesForHosts(hosts).filter((entry) => entry.kind === "exclusive-file").map(managedKey2));
  if (hosts.includes("claude")) {
    for (const selector of [SESSION_START_SELECTOR, USER_PROMPT_SUBMIT_SELECTOR, STOP_SELECTOR, STATUS_LINE_SELECTOR, WEB_FETCH_DENY_SELECTOR]) {
      knownKeys.add(managedKey2({ path: DOVE_CLAUDE_SETTINGS_PATH, kind: "json-fragment", selector }));
    }
    for (const selector of [PAPER_SEARCH_MCP_SELECTOR, EXA_MCP_SELECTOR]) {
      knownKeys.add(managedKey2({ path: PAPER_SEARCH_MCP_PATH, kind: "json-fragment", selector }));
    }
  }
  knownKeys.add(managedKey2({ path: ".claude/agents/dove-reviewer.md", kind: "exclusive-file", selector: null }));
  for (const entry of manifest?.managed ?? []) {
    if (!knownKeys.has(managedKey2(entry))) {
      throw new Error(`Dove project integration contains unknown ownership: ${entry.path}${entry.selector ? `#${entry.selector}` : ""}.`);
    }
  }
}
function preparePlan({ root, hosts, packageName, packageVersion, now, fsOps = fs8, manifest = null, replacementPolicy = "safe" }) {
  if (manifest && ["identity-mismatch", "invalid-version", "newer"].includes(classifyPackageCompatibility(manifest.package, { name: packageName, version: packageVersion }))) {
    throw new Error("Dove project integration package is incompatible with the running CLI.");
  }
  assertManagedOwnership(manifest);
  const oldByKey = new Map((manifest?.managed ?? []).map((entry) => [managedKey2(entry), entry]));
  const skippedLocalEdits = [];
  const replacedLocalEdits = [];
  const retainedManagedByKey = /* @__PURE__ */ new Map();
  const omittedManagedKeys = /* @__PURE__ */ new Set();
  const desiredResources = resourcesForHosts(hosts).filter((entry) => {
    if (oldByKey.has(managedKey2(entry))) return true;
    if (entry.selector === STATUS_LINE_SELECTOR) {
      const observed = inspectRegularProjectFile(root, entry.path, fsOps);
      return !observed.exists || !statusLineState(parseSharedJson(observed, entry.path)).exists;
    }
    if (entry.selector === WEB_FETCH_DENY_SELECTOR) {
      const observed = inspectRegularProjectFile(root, entry.path, fsOps);
      return !observed.exists || !webFetchDenyFragmentState(parseSharedJson(observed, entry.path)).exists;
    }
    return true;
  });
  const desiredByKey = new Map(desiredResources.map((entry) => [managedKey2(entry), entry]));
  const entries = [];
  let resourcesChanged = false;
  let retiredHooks = null;
  const sharedPaths = [.../* @__PURE__ */ new Set([
    ...desiredResources.filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path),
    ...(manifest?.managed ?? []).filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path),
    ...desiredResources.some((entry) => entry.selector === WEB_FETCH_DENY_SELECTOR) || (manifest?.managed ?? []).some((entry) => entry.selector === WEB_FETCH_DENY_SELECTOR) ? [DOVE_CLAUDE_SETTINGS_PATH] : [],
    ...desiredResources.some((entry) => entry.selector === EXA_MCP_SELECTOR) || (manifest?.managed ?? []).some((entry) => entry.selector === EXA_MCP_SELECTOR) ? [PAPER_SEARCH_MCP_PATH] : []
  ])].sort();
  for (const relativePath of sharedPaths) {
    const planned = planJsonFragments(
      root,
      relativePath,
      desiredResources.filter((entry) => entry.kind === "json-fragment" && entry.path === relativePath),
      (manifest?.managed ?? []).filter((entry) => entry.kind === "json-fragment" && entry.path === relativePath),
      fsOps,
      { replacementPolicy }
    );
    if (planned.retiredHooks) retiredHooks = planned.retiredHooks;
    if (planned.entry) entries.push(planned.entry);
    if (planned.changed) resourcesChanged = true;
    for (const item of planned.skippedLocalEdits ?? []) skippedLocalEdits.push(item);
    for (const item of planned.replacedLocalEdits ?? []) replacedLocalEdits.push(item);
    for (const item of planned.retainedManaged ?? []) retainedManagedByKey.set(managedKey2(item), item);
    for (const key of planned.omittedManagedKeys ?? []) omittedManagedKeys.add(key);
  }
  const keys = [.../* @__PURE__ */ new Set([...oldByKey.keys(), ...desiredByKey.keys()])].filter((key) => (desiredByKey.get(key) ?? oldByKey.get(key)).kind !== "json-fragment").sort();
  for (const key of keys) {
    const planned = planResource(root, desiredByKey.get(key) ?? null, oldByKey.get(key) ?? null, fsOps, { replacementPolicy });
    if (planned.entry) entries.push(planned.entry);
    if (planned.changed) resourcesChanged = true;
    for (const item of planned.skippedLocalEdits ?? []) skippedLocalEdits.push(item);
    for (const item of planned.replacedLocalEdits ?? []) replacedLocalEdits.push(item);
    for (const item of planned.retainedManaged ?? []) retainedManagedByKey.set(managedKey2(item), item);
    for (const omittedKey of planned.omittedManagedKeys ?? []) omittedManagedKeys.add(omittedKey);
  }
  const managed = [
    ...desiredManaged(desiredResources).filter((entry) => !omittedManagedKeys.has(managedKey2(entry))),
    ...[...retainedManagedByKey.values()]
  ].sort(compareManaged2);
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
  return { entries, manifest: nextManifest, manifestChanged, skippedLocalEdits, replacedLocalEdits, retiredHooks };
}

// src/core/session-start-hook.mjs
import path8 from "node:path";
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
function systemMessage(message) {
  return { systemMessage: message };
}
function userOriginalSourceContext(payload) {
  if (typeof payload.transcript_path !== "string" || !payload.transcript_path) return "";
  return `
User-original source: ${JSON.stringify(payload.transcript_path)}. Give the mentor its last-read date/range and dated user originals, not execution records. Include the current user's exact words if not yet in the file; retain sources in the brief, not a new ledger.`;
}
function sessionStartOutput(payload, result = null, options = {}) {
  const output = {};
  if (result && result.status !== "current") {
    output.systemMessage = "Dove project integration needs attention. SessionStart is read-only; run dove update explicitly to update supported manifest-owned integration. If blocked, inspect dove doctor --json before changing files.";
  }
  if (payload.source === "startup" || payload.source === "clear") {
    if (typeof options.project !== "string" || !path8.isAbsolute(options.project)) {
      throw new Error("Dove SessionStart bootstrap requires an explicit absolute project root.");
    }
    output.hookSpecificOutput = {
      hookEventName: "SessionStart",
      additionalContext: renderDoveAuthorPreferencesBootstrap(
        path8.join(options.project, DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.claude),
        path8.join(options.project, DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.claude)
      )
    };
  } else if (payload.source === "compact" || payload.source === "resume") {
    output.hookSpecificOutput = {
      hookEventName: "SessionStart",
      additionalContext: `${identityCardContext(options.project, options)}
${DOVE_AUTHOR_PREFERENCES_CONTINUITY}
${DOVE_RESEARCH_REFLECTION_CONTINUITY}`
    };
  }
  if (output.hookSpecificOutput) output.hookSpecificOutput.additionalContext += userOriginalSourceContext(payload) + hostMigrationContext(options.project, options);
  return Object.keys(output).length > 0 ? output : null;
}
function sessionStartFailureOutput(error) {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
  return systemMessage(`Dove SessionStart could not inspect project integration (read-only): ${message} Run dove update explicitly for supported integration, or dove doctor --json to inspect blocked state.`);
}

// src/core/user-prompt-submit-hook.mjs
var PROMPT_GUIDANCE_PATHS = Object.freeze([
  DOVE_CLAUDE_AMBIENT_RULE_PATH,
  DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.claude,
  DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.claude
]);
function parseUserPromptSubmitPayload(input) {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Dove UserPromptSubmit hook received malformed JSON.");
  }
  if (payload?.hook_event_name !== "UserPromptSubmit" || typeof payload.prompt !== "string") {
    throw new Error("Dove UserPromptSubmit hook received an unsupported or invalid prompt event.");
  }
  return payload;
}
function userPromptSubmitOutput(payload, guidance, options = {}) {
  if (payload?.hook_event_name !== "UserPromptSubmit" || typeof payload.prompt !== "string") {
    throw new Error("Dove UserPromptSubmit hook requires a valid prompt event.");
  }
  if (!guidance) throw new Error("Dove UserPromptSubmit hook requires verified project guidance.");
  const context = `Dove ${guidance.version} (disk guidance, not rule reload):
${guidance.fingerprints.join("\n")}
${identityCardContext(options.project, options)}
${renderDoveResearchReanchor()}
On first use at these fingerprints, the current main agent must personally read the current rule and the two short summaries (author preferences and research quality); otherwise reuse them. Consult full references only for decision-relevant details. The card is context, not a substitute for the user's latest words.${userOriginalSourceContext(payload)}${hostMigrationContext(options.project, options)}`;
  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: context
    }
  };
}
function userPromptSubmitFailureOutput(error) {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
  return {
    systemMessage: `Dove UserPromptSubmit could not deliver its read-only guidance: ${message}`
  };
}

// src/core/statusline.mjs
import { spawnSync } from "node:child_process";
import path9 from "node:path";
import process2 from "node:process";
var MAX_MAINLINE_CODE_POINTS = 80;
var STATUS_SEPARATOR = " \xB7 ";
var CONTROL_CHARACTERS = /[\x00-\x1f\x7f-\x9f]/gu;
var CAPACITY_IN_MODEL_NAME = /\b\d+(?:\.\d+)?\s*[KMG](?:\s+context)?\b/iu;
function plainObject5(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function oneLine(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(CONTROL_CHARACTERS, "?");
  return normalized || null;
}
function shortMainline(value) {
  const normalized = oneLine(value);
  if (!normalized) return null;
  const codePoints = [...normalized];
  return codePoints.length <= MAX_MAINLINE_CODE_POINTS ? normalized : `${codePoints.slice(0, MAX_MAINLINE_CODE_POINTS - 1).join("")}\u2026`;
}
function nonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function parseDoveStatusLinePayload(input) {
  try {
    const value = JSON.parse(input);
    return plainObject5(value) ? value : {};
  } catch {
    return {};
  }
}
function formatContextCapacity(value) {
  const size = nonNegativeNumber(value);
  if (size === null || size === 0) return null;
  if (size >= 1e6) return `${Number((size / 1e6).toFixed(1))}M`;
  if (size >= 1e3) return `${Math.round(size / 1e3)}K`;
  return String(Math.round(size));
}
function formatSessionDuration(value) {
  const milliseconds = nonNegativeNumber(value);
  if (milliseconds === null) return null;
  const minutes = Math.floor(milliseconds / 6e4);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h${minutes % 60}m` : `${minutes}m`;
}
function inspectGitBranch(projectRoot, options = {}) {
  const run = options.spawnSync ?? spawnSync;
  try {
    const result = run("git", ["branch", "--show-current"], {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: options.timeoutMs ?? 500,
      maxBuffer: 64 * 1024,
      windowsHide: true,
      env: {
        ...process2.env,
        GIT_CEILING_DIRECTORIES: path9.dirname(path9.resolve(projectRoot))
      }
    });
    if (result?.status !== 0 || result.signal || result.error) return null;
    return oneLine(result.stdout);
  } catch {
    return null;
  }
}
var HTML_BLOCK_TAG = /^(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|ol|p|pre|script|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)$/iu;
function htmlBlockTag(line) {
  const match = line.match(/^ {0,3}<([A-Za-z][A-Za-z0-9-]*)\b[^>]*>/u);
  return match && HTML_BLOCK_TAG.test(match[1]) ? match[1].toLowerCase() : null;
}
function isBlockContinuation(line) {
  return /^ {0,3}(?:>\s?|(?:[-+*]|\d+[.)])\s+)/u.test(line);
}
function isMainlineBoundary(line) {
  return !(line ?? "").trim() || /^ {0,3}#{1,6}(?:[ \t]|$)/u.test(line ?? "") || /^ {0,3}(?:`{3,}|~{3,})/u.test(line ?? "") || /^ {0,3}(?:---|\.\.\.|-->)\s*$/u.test(line ?? "") || /^ {0,3}<!--/u.test(line ?? "") || /^(?:Current round|Round status):/u.test(line ?? "");
}
function parseResearchMainline(markdown2, options = {}) {
  let fence = null;
  let frontmatter = false;
  let comment = false;
  let htmlBlock = null;
  const matches = [];
  const lines = markdown2.split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    if (index === 0 && line === "---") {
      frontmatter = true;
      continue;
    }
    if (frontmatter) {
      if (line === "---" || line === "...") frontmatter = false;
      continue;
    }
    if (fence) {
      const closing = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/u);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) fence = null;
      continue;
    }
    if (htmlBlock) {
      if (new RegExp(`^ {0,3}</${htmlBlock}>[ \\t]*$`, "iu").test(line)) htmlBlock = null;
      continue;
    }
    const opening = !comment && line.match(/^ {0,3}(`{3,}|~{3,})/u);
    if (opening) {
      fence = opening[1];
      continue;
    }
    const blockTag = !comment && htmlBlockTag(line);
    if (blockTag) {
      if (!new RegExp(`</${blockTag}>`, "iu").test(line)) htmlBlock = blockTag;
      continue;
    }
    const startsInComment = comment;
    for (const marker of line.matchAll(/<!--|-->/gu)) {
      if (marker[0] === "<!--") comment = true;
      else comment = false;
    }
    if (startsInComment || comment) continue;
    if (line.startsWith("Mainline:")) {
      const previousLine = lines[index - 1] ?? "";
      if (/^Mainline:/u.test(previousLine)) return null;
      const accepted = (index === 0 || isMainlineBoundary(previousLine)) && !isBlockContinuation(previousLine) && !/^ {0,3}(?:=+|-+)[ \t]*$/u.test(lines[index + 1] ?? "");
      if (accepted && options.uncertainFinalLine && index === lines.length - 2) return null;
      if (accepted) matches.push(line.slice("Mainline:".length));
      if (matches.length > 1) return null;
    }
  }
  return matches.length === 1 && matches[0].startsWith(" ") ? oneLine(matches[0]) : null;
}
function renderDoveStatusLine(input, options = {}) {
  const payload = typeof input === "string" ? parseDoveStatusLinePayload(input) : plainObject5(input) ? input : {};
  const model = oneLine(payload.model?.display_name);
  const capacity = formatContextCapacity(payload.context_window?.context_window_size);
  const remainingValue = nonNegativeNumber(payload.context_window?.remaining_percentage);
  const remaining = remainingValue === null ? null : Math.min(100, Math.round(remainingValue));
  const duration = formatSessionDuration(payload.cost?.total_duration_ms);
  const project = options.projectRoot ? oneLine(path9.resolve(options.projectRoot)) : null;
  const card = readDoveIdentityCard(options.projectRoot, options) ?? "";
  const mainline = shortMainline(Object.hasOwn(options, "mainline") ? options.mainline : parseResearchMainline(card));
  const noColorValue = (options.env ?? process2.env).NO_COLOR;
  const noColor = typeof noColorValue === "string" && noColorValue.length > 0;
  const branch = Object.hasOwn(options, "branch") ? oneLine(options.branch) : inspectGitBranch(options.projectRoot, options);
  const parts = [];
  if (model) parts.push(capacity && !CAPACITY_IN_MODEL_NAME.test(model) ? `${model} (${capacity})` : model);
  else if (capacity) parts.push(`ctx ${capacity}`);
  if (remaining !== null) parts.push(`ctx ${remaining}%`);
  if (mainline) parts.push(noColor ? mainline : `\x1B[36m${mainline}\x1B[0m`);
  const round = parseDoveCurrentRound(card);
  const roundNumber = round?.brief.match(/(?:^|\/)0*(\d+)-brief\.md(?:\)|$)/u)?.[1];
  if (roundNumber) parts.push(`\u7B2C${Number(roundNumber)}\u8F6E`);
  if (branch) parts.push(branch);
  if (duration) parts.push(duration);
  const session = parts.length > 0 ? parts.join(STATUS_SEPARATOR) : "Dove";
  return project ? `${session}
${project}` : session;
}

// src/core/research-defaults.mjs
import fs9 from "node:fs";
var RESEARCH_ROOT = ARTIFACT_PATHS.researchDocumentsDir;
var RESEARCH_DEFAULT_PATHS = Object.freeze({
  root: RESEARCH_ROOT,
  overview: ARTIFACT_PATHS.researchOverview,
  identity: DOVE_IDENTITY_CARD_PATH,
  evaluation: `${RESEARCH_ROOT}/EVAL.md`,
  roundsDirectory: `${RESEARCH_ROOT}/rounds`,
  lessonsDirectory: `${RESEARCH_ROOT}/lessons`,
  lessonsSummary: ARTIFACT_PATHS.researchLessons
});
var RESEARCH_DEFAULT_DOCUMENTS = Object.freeze([
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.overview,
    content: "# Research\n\nUse `IDENTITY.md`, `EVAL.md` and `rounds/` for current research. Until the user confirms Mainline, read the project topic-selection standards, explore parallel candidates and offer recommendations for the user to choose before method implementation. Follow a confirmed mainline and choose work at a scale that can answer the question. The mentor keeps its own `MENTOR_NOTES.md`. This file is a short history index; leave existing missions, experiments and claims in place.\n"
  })
]);
var RESEARCH_DEFAULT_DIRECTORY_PATHS = Object.freeze([RESEARCH_ROOT]);
function prepareResearchDefaults(root, options = {}) {
  const anchor = openRootedFilesystem(root, { fsOps: options.fsOps ?? fs9 });
  const directory = anchor.tryLstat(RESEARCH_ROOT);
  if (directory && (directory.isSymbolicLink() || !directory.isDirectory())) {
    throw new Error(`${RESEARCH_ROOT} must be a real directory.`);
  }
  const entries = directory ? [] : RESEARCH_DEFAULT_DOCUMENTS.map(({ path: relativePath, content }) => ({
    root,
    relativePath,
    content,
    force: false,
    expectedState: { exists: false, type: "absent", sha256: null, mode: null },
    label: `Dove research bootstrap ${relativePath}`
  }));
  return { entries, changedPaths: entries.map((entry) => entry.relativePath) };
}

// src/core/research-documents.mjs
import fs10 from "node:fs";
var RESEARCH_DOCUMENT_PATHS = Object.freeze({ ...RESEARCH_DEFAULT_PATHS });
function readableMarkdown(root, relativePath) {
  const stat = root.tryLstat(relativePath);
  if (!stat) return null;
  const text = new TextDecoder("utf-8", { fatal: true }).decode(root.readFile(relativePath));
  if (text.includes("\0")) throw new Error(`${relativePath} contains null bytes.`);
  return { path: relativePath };
}
function inspectResearchDocuments(project, options = {}) {
  const base = { root: RESEARCH_DOCUMENT_PATHS.root, identity: null, evaluation: null, rounds: null, overview: null };
  try {
    const root = openRootedFilesystem(project, { fsOps: options.fsOps ?? fs10 });
    const directory = root.tryLstat(RESEARCH_DOCUMENT_PATHS.root);
    if (!directory) return { ...base, healthy: true, state: "absent" };
    if (directory.isSymbolicLink() || !directory.isDirectory()) throw new Error(`${base.root} must be a real directory.`);
    const rounds = root.tryLstat(RESEARCH_DOCUMENT_PATHS.roundsDirectory);
    if (rounds && (rounds.isSymbolicLink() || !rounds.isDirectory())) throw new Error(`${RESEARCH_DOCUMENT_PATHS.roundsDirectory} must be a real directory.`);
    return {
      ...base,
      healthy: true,
      state: "current",
      identity: readableMarkdown(root, RESEARCH_DOCUMENT_PATHS.identity),
      evaluation: readableMarkdown(root, RESEARCH_DOCUMENT_PATHS.evaluation),
      rounds: rounds ? { path: RESEARCH_DOCUMENT_PATHS.roundsDirectory } : null,
      overview: readableMarkdown(root, RESEARCH_DOCUMENT_PATHS.overview)
    };
  } catch (error) {
    return { ...base, healthy: false, state: "invalid", error: error instanceof Error ? error.message : String(error) };
  }
}

// src/core/paper-library.mjs
import fs11 from "node:fs";
import path10 from "node:path";
var LIBRARY = ".dove/research/papers/library";
var IMPACT_LABELS = { overlap: "\u649E\u9898", baseline: "\u65B0\u57FA\u7EBF", borrow: "\u53EF\u501F\u7528" };
function readPaperLibrary(root) {
  try {
    return JSON.parse(fs11.readFileSync(path10.join(root, `${LIBRARY}.json`), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { papers: [] };
    throw error;
  }
}
function groupPaperLibrary(papers) {
  const groups = /* @__PURE__ */ new Map();
  for (const paper of papers) {
    const direction = paper.direction || "\u5F85\u5F52\u7C7B";
    if (!groups.has(direction)) groups.set(direction, []);
    groups.get(direction).push(paper);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, "zh-CN")).map(([direction, items]) => ({ direction, papers: items.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || a.id.localeCompare(b.id)) }));
}
var markdown = (value) => String(value ?? "").replace(/[\r\n]+/gu, " ").replace(/[\\`*\[\]<>]/gu, "\\$&");
function renderPaperLibrary(papers) {
  const lines = ["# \u9879\u76EE\u6587\u732E\u5E93", "", "\u6309\u65B9\u5411\u7D2F\u79EF\u5DF2\u5224\u4E3A\u65B0\u57FA\u7EBF\u3001\u53EF\u501F\u7528\u6216\u649E\u9898\u7684\u8FFD\u8E2A\u8BBA\u6587\u3002\u4E00\u53E5\u8BDD\u7531\u5BFC\u5E08\u6216\u4E3B\u4F1A\u8BDD\u636E\u6458\u8981\u63D0\u4F9B\uFF0C\u4E0D\u4EE3\u8868\u8BFB\u8FC7\u5168\u6587\uFF1B\u6B63\u6587\u95EE\u7B54\u53E6\u5B58\u540C\u76EE\u5F55\u7684\u8BBA\u6587\u7B14\u8BB0\u3002", ""];
  for (const group of groupPaperLibrary(papers)) {
    lines.push(`## ${markdown(group.direction)}`, "");
    for (const paper of group.papers) {
      const title = markdown(paper.title || paper.id);
      const metadata = [paper.authors?.length ? paper.authors.join(", ") : null, paper.venue, paper.arxivId ? `arXiv ${paper.arxivId}` : null, paper.date].filter(Boolean);
      lines.push(
        `- **${paper.url ? `[${title}](<${paper.url}>)` : title}** \xB7 ${markdown(paper.id)}`,
        `  ${markdown(paper.line || "\u4E2D\u6587\u4E00\u53E5\u8BDD\u5F85\u636E\u6458\u8981\u8865\u5145\u3002")}`,
        `  ${metadata.map(markdown).join(" \xB7 ")}`,
        `  ${IMPACT_LABELS[paper.impact]}\uFF1A${markdown(paper.note)}${paper.impactFile ? `\uFF08${markdown(paper.impactFile)}\uFF09` : ""}`,
        ""
      );
    }
  }
  return `${lines.join("\n")}
`;
}
var bibtexText = (value) => String(value).replace(/\s+/gu, " ").replace(/[\\{}%&#_$~^]/gu, (char) => ({ "\\": "\\textbackslash{}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" })[char] ?? `\\${char}`);
function exportPaperBibtex(papers) {
  return [...new Map(papers.map((paper) => [paper.id, paper])).values()].map((paper) => {
    const type = paper.kind === "conference" ? "inproceedings" : paper.kind === "journal" ? "article" : "misc";
    const fields = { title: paper.title };
    if (paper.authors?.length) fields.author = paper.authors.join(" and ");
    const year = String(paper.date ?? "").match(/^(\d{4})(?:-|$)/u)?.[1];
    if (year) fields.year = year;
    if (paper.venue) fields[type === "inproceedings" ? "booktitle" : type === "article" ? "journal" : "howpublished"] = paper.venue;
    if (paper.arxivId) Object.assign(fields, { eprint: paper.arxivId, archivePrefix: "arXiv" });
    if (paper.url) fields.url = paper.url;
    const key = `dove:${paper.id.replace(/[^a-zA-Z0-9.:-]/gu, "-")}`;
    return `@${type}{${key},
${Object.entries(fields).filter(([, value]) => value).map(([name, value]) => `  ${name} = {${name === "url" ? String(value).replace(/[{}]/gu, "\\$&") : bibtexText(value)}}`).join(",\n")}
}`;
  }).join("\n\n") + (papers.length ? "\n" : "");
}

// src/core/mentor-brief.mjs
import fs12 from "node:fs";
import path11 from "node:path";
var RESEARCH = ".dove/research";
var ROUND_FILE = /^(\d+)[-_](brief|result)\.md$/iu;
var IMPACT_FILE = /^impact-\d{4}-\d{2}-\d{2}\.md$/u;
var DIGEST_FILE = /^\d{4}-\d{2}-\d{2}\.json$/u;
var SCAN_FILE = /^scan-\d{4}-\d{2}-\d{2}\.md$/u;
var QUESTIONS = [
  "\u76F8\u5BF9\u7528\u6237\u539F\u8BDD\u548C\u8EAB\u4EFD\u5361\u7684\u6838\u5FC3\u80FD\u529B\uFF0C\u65B9\u5411\u5BF9\u4E0D\u5BF9\uFF1F",
  "\u8FD9\u51E0\u8F6E\u662F\u5728\u5EFA\u7ACB\u901A\u7528\u80FD\u529B\uFF0C\u8FD8\u662F\u53CD\u590D\u6253\u8865\u4E01\uFF1F",
  "\u79BB\u7528\u6237\u76EE\u6807\u548C\u76EE\u6807\u6863\u6B21\u8FD8\u5DEE\u4EC0\u4E48\uFF1F",
  "\u4E0B\u4E00\u8F6E\u8BE5\u505A\u4EC0\u4E48\uFF0C\u4E3A\u4EC0\u4E48\uFF1F",
  "\u76F8\u5BF9\u6700\u63A5\u8FD1\u7684\u5DF2\u6709\u5DE5\u4F5C\uFF0C\u65B0\u5728\u54EA\u91CC\uFF1F\u6309\u76EE\u6807\u6863\u6B21\u7684\u5BA1\u7A3F\u4EBA\u770B\uFF0C\u8D21\u732E\u591F\u4E0D\u591F\uFF1F"
];
function list(directory, fsOps) {
  try {
    return fsOps.readdirSync(directory);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return [];
    throw error;
  }
}
function describe(root, relative, fsOps) {
  try {
    return `\`${relative}\`${fsOps.statSync(path11.join(root, relative)).isFile() ? "" : "\uFF08\u4E0D\u662F\u6587\u4EF6\uFF09"}`;
  } catch (error) {
    return `\`${relative}\`\uFF08${error.code === "ENOENT" ? "\u7F3A\u5931" : `\u65E0\u6CD5\u8BFB\u53D6\uFF1A${error.code ?? error.message}`}\uFF09`;
  }
}
function readWindow(file, fsOps, maxBytes = 16384, tail = false) {
  let fd;
  try {
    const stat = fsOps.statSync(file);
    if (!stat.isFile()) return { error: "\u4E0D\u662F\u6587\u4EF6" };
    fd = fsOps.openSync(file, "r");
    const bytes = Buffer.alloc(Math.min(stat.size, maxBytes));
    const position = tail ? Math.max(0, stat.size - bytes.length) : 0;
    const count = fsOps.readSync(fd, bytes, 0, bytes.length, position);
    let start = 0;
    while (start < count && (bytes[start] & 192) === 128) start += 1;
    const truncated = stat.size > count;
    const text = new TextDecoder().decode(bytes.subarray(start, count), { stream: truncated && !tail });
    return { text, truncated, partialFirstLine: position > 0 };
  } catch (error) {
    return { error: error.code === "ENOENT" ? "\u7F3A\u5931" : `\u65E0\u6CD5\u8BFB\u53D6\uFF1A${error.code ?? error.message}` };
  } finally {
    if (fd !== void 0) fsOps.closeSync(fd);
  }
}
function clip(text, limit, tail = false) {
  const characters = Array.from(String(text));
  return characters.length <= limit ? characters.join("") : tail ? `\u2026${characters.slice(-limit).join("")}` : `${characters.slice(0, limit).join("")}\u2026`;
}
function quote(text) {
  return String(text).split("\n").map((line) => `> ${line}`).join("\n");
}
function evaluationExcerpt(file, fsOps) {
  const result = readWindow(file, fsOps, 16384, true);
  if (result.error) return result.error;
  const lines = result.text.split(/\r?\n/u);
  if (result.partialFirstLine) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  return clip(lines.slice(-12).join("\n"), 2400, true) || "\u6CA1\u6709\u53EF\u6458\u5F55\u7684\u8FD1\u671F\u5B8C\u6574\u884C\uFF1B\u6309\u8DEF\u5F84\u8BFB\u53D6\u3002";
}
function recentRounds(names) {
  const sorted = names.filter((name) => ROUND_FILE.test(name)).sort((left, right) => Number(right.match(ROUND_FILE)[1]) - Number(left.match(ROUND_FILE)[1]) || left.localeCompare(right));
  const counts = { brief: 0, result: 0 };
  return sorted.filter((name) => ++counts[name.match(ROUND_FILE)[2].toLowerCase()] <= 2);
}
function watchMaterials(root, rounds, fsOps) {
  const relative = `${RESEARCH}/watch`;
  const directory = path11.join(root, relative);
  const names = list(directory, fsOps).sort().reverse();
  const config = `${relative}/config.json`;
  const lines = [`- \u914D\u7F6E\uFF1A${describe(root, config, fsOps)}`];
  const configText = readWindow(path11.join(root, config), fsOps, 8192);
  if (!configText.error) lines.push(quote(clip(configText.text.trim(), 1600)), "\u914D\u7F6E\u4EC5\u6458\u5F55\uFF0C\u5168\u6587\u89C1\u8DEF\u5F84\u3002");
  const judged = /* @__PURE__ */ new Set();
  let incomplete = false;
  const impacts = names.filter((name) => IMPACT_FILE.test(name));
  const records = [
    ...rounds.filter((name) => ROUND_FILE.test(name) && /brief\.md$/iu.test(name)).map((name) => path11.join(root, RESEARCH, "rounds", name)),
    ...impacts.map((name) => path11.join(directory, name))
  ];
  for (const file of records) {
    const record = readWindow(file, fsOps, 65536, true);
    incomplete ||= Boolean(record.error || record.truncated);
    if (record.error) continue;
    for (const match of record.text.matchAll(/^\s*(?:[-*]\s*)?\|?\s*`?(\d{4}\.\d{4,5}|[a-z][a-z.-]*\/\d{7}|W\d+)(?:v\d+)?`?\s*\|\s*(撞题|新基线|可借用|无关)\s*\|/gmu)) {
      judged.add(match[1]);
    }
  }
  if (impacts.length) lines.push(`- \u5F71\u54CD\u8BB0\u5F55\uFF1A\`${relative}/\`\uFF08\u542B\u5386\u53F2 brief \u5224\u65AD\uFF09`);
  for (const name of impacts.slice(0, 3)) lines.push(`- \u6700\u8FD1\u5F71\u54CD\uFF1A${describe(root, `${relative}/${name}`, fsOps)}`);
  if (incomplete) lines.push("\u5224\u65AD\u8BB0\u5F55\u6709\u7F3A\u5931\u6216\u8D85\u8FC7\u6BCF\u6587\u4EF6\u672B\u5C3E 64 KiB \u7684\u8BFB\u53D6\u8303\u56F4\uFF1B\u4EE5\u4E0B\u4EC5\u8868\u793A\u5728\u5DF2\u8BFB\u7247\u6BB5\u4E2D\u672A\u627E\u5230\u5224\u65AD\uFF0C\u8BF7\u6838\u5BF9\u5386\u53F2\uFF0C\u4E0D\u91CD\u590D\u5224\u65AD\u5DF2\u8BC4\u8BBA\u6587\u3002");
  const digests = names.filter((name) => DIGEST_FILE.test(name));
  const pending = /* @__PURE__ */ new Map();
  for (const name of digests.slice(0, 3)) {
    const file = path11.join(directory, name);
    lines.push(`- \u8FD1\u671F\u6E05\u5355\uFF1A${describe(root, `${relative}/${name}`, fsOps)}`);
    const result = readWindow(file, fsOps, 262144);
    if (result.error || result.truncated) {
      lines.push(`  ${result.error ?? "\u8D85\u8FC7 256 KiB\uFF0C\u672A\u5C55\u5F00"}\uFF1B\u8BF7\u6309\u8DEF\u5F84\u6838\u5BF9\u672A\u5224\u65AD\u9879\u3002`);
      continue;
    }
    let digest;
    try {
      digest = JSON.parse(result.text);
    } catch {
      lines.push("  JSON \u65E0\u6CD5\u89E3\u6790\uFF0C\u672A\u5224\u65AD\u9879\u672A\u77E5\u3002");
      continue;
    }
    if (!Array.isArray(digest?.items)) {
      lines.push("  \u7F3A\u5C11\u8BBA\u6587\u6E05\u5355\uFF0C\u672A\u5224\u65AD\u9879\u672A\u77E5\u3002");
      continue;
    }
    lines.push(`  \u68C0\u7D22\u72B6\u6001\uFF1A${digest.status ?? "\u672A\u8BB0\u5F55"}\uFF1B\u5931\u8D25\u6216\u90E8\u5206\u5B8C\u6210\u4E0D\u4EE3\u8868\u6CA1\u6709\u65B0\u8BBA\u6587\u3002`);
    for (const item of digest.items) {
      if (!item?.id) continue;
      const id = String(item.id).replace(/v\d+$/u, "");
      if (!judged.has(id) && !pending.has(id)) pending.set(id, { item, file });
    }
  }
  lines.push(
    "",
    `### ${incomplete ? "\u672A\u627E\u5230\u5224\u65AD\u7684\u8FD1\u671F\u6458\u8981\uFF08\u5F85\u6838\u5BF9\u5386\u53F2\uFF09" : "\u672A\u5224\u65AD\u7684\u8FD1\u671F\u6458\u8981"}`,
    digests.length ? `\u4ECE\u6700\u8FD1 ${Math.min(3, digests.length)} / ${digests.length} \u4EFD\u6E05\u5355\u627E\u5230 ${pending.size} \u9879\uFF0C\u6700\u591A\u5C55\u5F00 8 \u9879\uFF1B\u5176\u4F59\u89C1 \`${relative}/\`\uFF0C\u4E0D\u4EE3\u8868\u5168\u90E8\u5386\u53F2\u3002` : "\u672A\u627E\u5230\u8FFD\u8E2A\u6E05\u5355\u3002"
  );
  for (const [id, { item, file }] of [...pending].slice(0, 8)) {
    lines.push("", quote(`${id} \xB7 ${clip(item.title ?? "\u672A\u63D0\u4F9B\u6807\u9898", 200)}
\u539F\u59CB\u53D1\u8868\u65E5\u671F\uFF1A${item.published || "\u672A\u8BB0\u5F55"}
\u6765\u6E90\uFF1A${file}
${item.line ? "\u5DF2\u6709\u4E00\u53E5\u8BDD" : "\u539F\u6458\u8981"}\uFF08\u4E0D\u4EE3\u8868\u5168\u6587\u5DF2\u8BFB\uFF09\uFF1A${clip(item.line || item.abstract || "\u672A\u63D0\u4F9B\u6458\u8981", 400)}`));
  }
  const scan = names.find((name) => SCAN_FILE.test(name));
  lines.push("", scan ? `- \u6700\u8FD1\u626B\u63CF\uFF08${scan.slice(5, 15)}\uFF09\uFF1A${describe(root, `${relative}/${scan}`, fsOps)}` : "- \u6700\u8FD1\u626B\u63CF\uFF1A\u672A\u627E\u5230\u3002");
  return lines.join("\n");
}
function opinionAttachment(root, opinion, fsOps) {
  if (!opinion) return "\u672A\u9644\u610F\u89C1\u6587\u4EF6\u3002";
  const file = path11.resolve(root, opinion);
  const result = readWindow(file, fsOps, 4096);
  if (result.error) throw new Error(`\u610F\u89C1\u6587\u4EF6${result.error}\uFF1A${file}`);
  const length = Array.from(result.text).length;
  const author = result.text.match(/^\s*(?:[-*]\s*)?(?:\*\*)?(?:Author|作者)(?:\*\*)?\s*[:：][ \t]*(\S[^\r\n]*)$/imu)?.[1];
  return `- \u610F\u89C1\u6587\u4EF6\uFF1A\`${file}\`
${quote(`\u4F5C\u8005\uFF1A${author ?? "\u672A\u7F72\u540D\uFF08\u6309\u6267\u884C\u8005\u610F\u89C1\u770B\u5F85\uFF09"}
\u7BC7\u5E45\uFF1A${result.truncated ? "\u8D85\u8FC7 4 KiB\uFF0C\u5BFC\u5E08\u6309\u8DEF\u5F84\u8BFB\u5168\u6587" : `\u7EA6 ${length} \u5B57\uFF08\u5EFA\u8BAE 1000 \u5B57\u5185\uFF09`}`)}`;
}
function renderMentorBrief(root, options = {}) {
  const fsOps = options.fsOps ?? fs12;
  const project = path11.resolve(root);
  const research = path11.join(project, RESEARCH);
  const rounds = list(path11.join(research, "rounds"), fsOps);
  const selected = recentRounds(rounds);
  const evaluation = path11.join(research, "EVAL.md");
  const lines = [
    "# Dove \u5BFC\u5E08\u8C03\u7528\u6750\u6599",
    "",
    `\u9879\u76EE\uFF1A\`${project}\`\uFF08\u6750\u6599\u8DEF\u5F84\u76F8\u5BF9\u6B64\u76EE\u5F55\uFF09`,
    "\u672C\u6750\u6599\u539F\u6837\u4F5C\u4E3A\u5BFC\u5E08\u8C03\u7528\u7684\u5168\u90E8\u6B63\u6587\uFF0C\u53EA\u5728\u201C\u672C\u6B21\u89E6\u53D1\u201D\u5199\u4E00\u53E5\uFF1B\u6267\u884C\u8005\u770B\u6CD5\u653E\u610F\u89C1\u6587\u4EF6\uFF0C\u4E0D\u53E6\u5217\u7981\u4EE4\u3002",
    "",
    "## \u672C\u6B21\u89E6\u53D1",
    "",
    quote(options.trigger || "\u672A\u586B\u5199"),
    "\u540C\u8F6E\u518D\u8C03\u7528\u65F6\uFF0C\u5728\u6B64\u6CE8\u660E\u5BF9\u5E94\u89E6\u53D1\uFF08\u7528\u6237\u7EA0\u6B63\u3001\u6362\u8DEF\u7EBF\u7B49\uFF09\u3002",
    "",
    "## \u7528\u6237\u539F\u8BDD\u4E0E\u6765\u6E90",
    "",
    quote(`\u6765\u6E90\uFF1A${options.userSource || "\u672A\u63D0\u4F9B"}
\u65E5\u671F\u8303\u56F4\uFF1A${options.since || "\u672A\u63D0\u4F9B\u8D77\u70B9"} \u2014 ${options.until || "\u672A\u63D0\u4F9B\u7EC8\u70B9"}`),
    "",
    options.userOriginal ? quote(options.userOriginal) : "\u672A\u76F4\u63A5\u9644\u539F\u8BDD\u3002",
    "\u7531\u5BFC\u5E08\u8BFB\u53D6\u6307\u5B9A\u6765\u6E90\uFF1B\u751F\u6210\u5668\u4E0D\u8BFB\u53D6\u79C1\u6709 session\u3002",
    ...options.userOriginals ? [`- \u672C\u4EBA\u539F\u8BDD\u6C47\u603B\uFF08\u81EA\u52A8\u6574\u7406\uFF0C\u8F6C\u8FF0\u5DF2\u5355\u72EC\u6807\u51FA\uFF09\uFF1A\`${options.userOriginals.path}\`\uFF0C\u672C\u4EBA ${options.userOriginals.own} \u6761\u3001\u8F6C\u8FF0 ${options.userOriginals.relay} \u6761\uFF0C\u8986\u76D6 ${options.userOriginals.directories.length} \u4E2A\u4F1A\u8BDD\u76EE\u5F55${options.userOriginals.pendingBytes ? "\uFF08\u8F83\u5927\uFF0C\u5C1A\u672A\u6574\u7406\u5B8C\uFF0C\u4E0B\u6B21\u7EE7\u7EED\uFF09" : ""}\u3002\u5148\u8BFB\u5B83\u628A\u63E1\u957F\u671F\u610F\u56FE\uFF0C\u9700\u8981\u4E0A\u4E0B\u6587\u518D\u6309\u4F1A\u8BDD\u8DEF\u5F84\u67E5\u539F\u6587\u3002`] : [],
    ...describe(project, `${RESEARCH}/MENTOR_NOTES.md`, fsOps).includes("\u7F3A\u5931") ? ["\u5BFC\u5E08\u7B14\u8BB0\u8FD8\u4E0D\u5B58\u5728\uFF1A\u5148\u8BFB\u7528\u6237\u5728\u672C\u9879\u76EE\u5168\u90E8\u5386\u53F2\u91CC\u8BF4\u8FC7\u7684\u76EE\u6807\uFF0C\u5728\u7B14\u8BB0\u5199\u201C\u957F\u671F\u610F\u56FE\u201D\u3002"] : [],
    "",
    "## \u9879\u76EE\u6750\u6599",
    "",
    ...[".dove/install/RESEARCH_QUALITY.md", `${RESEARCH}/IDENTITY.md`, `${RESEARCH}/MENTOR_NOTES.md`, `${RESEARCH}/EVAL.md`].map((file) => `- ${describe(project, file, fsOps)}`),
    "",
    "EVAL \u8FD1\u671F\u6458\u5F55\uFF08\u672B\u5C3E 16 KiB \u5185\u81F3\u591A 12 \u884C\u30012400 \u5B57\uFF09\uFF1A",
    "",
    quote(evaluationExcerpt(evaluation, fsOps)),
    "",
    "### \u6700\u8FD1 brief/result",
    "",
    ...selected.length ? selected.map((name) => `- ${describe(project, `${RESEARCH}/rounds/${name}`, fsOps)}`) : ["\u672A\u627E\u5230\u8F6E\u6B21\u6587\u4EF6\u3002"],
    "",
    "### \u9009\u9898\u9636\u6BB5\u9002\u7528\u7684\u6807\u51C6",
    "",
    ...["CRITERIA.md", "PROJECT.md"].map((name) => `- ${describe(project, `${RESEARCH}/topics/${name}`, fsOps)}`),
    "",
    "## \u8BBA\u6587\u8FFD\u8E2A",
    "",
    watchMaterials(project, rounds, fsOps),
    "",
    "## \u6267\u884C\u8005\u9644\u5C5E\u6750\u6599",
    "",
    opinionAttachment(project, options.opinion, fsOps),
    "",
    "\u65B0\u589E\u539F\u59CB\u4EA7\u7269\uFF08\u53EA\u5217\u8DEF\u5F84\uFF09\uFF1A",
    ...options.artifact?.length ? options.artifact.map((file) => `- \`${path11.resolve(project, file)}\``) : ["\u672A\u63D0\u4F9B\u3002"],
    "",
    "## \u56FA\u5B9A\u95EE\u9898",
    "",
    ...QUESTIONS.map((question, index) => `${index + 1}. ${question}`)
  ];
  return `${lines.join("\n")}
`;
}

// src/core/project-installation.mjs
import fs15 from "node:fs";
import path14 from "node:path";

// src/core/user-originals.mjs
import fs13 from "node:fs";
import os2 from "node:os";
import path12 from "node:path";
var USER_ORIGINALS_PATH = ".dove/install/USER_ORIGINALS.md";
var USER_ORIGINALS_INDEX_PATH = ".dove/install/user-originals-index.json";
var CHUNK = 8 << 20;
var MAX_LINE = 256 << 10;

// src/core/project-root.mjs
import fs14 from "node:fs";
import path13 from "node:path";
var INSTALLATION_DIRECTORY = path13.posix.dirname(INSTALLATION_MANIFEST_PATH);
function realpathNative2(fsOps, targetPath) {
  return typeof fsOps.realpathSync?.native === "function" ? fsOps.realpathSync.native(targetPath) : fsOps.realpathSync(targetPath);
}
function canonicalExistingDirectory(value, label, fsOps) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error(`${label} must name an existing directory.`);
  const resolved = path13.resolve(value);
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
    const parent = path13.dirname(current);
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
function preservedInstallationDirectory(directoryPath, directoryStat, fsOps) {
  if (directoryStat === null) return false;
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) return false;
  const children = fsOps.readdirSync(directoryPath).map(String).sort();
  if (children.length > 1 || children.length === 1 && children[0] !== "DOCTOR.md") return false;
  if (children.length === 0) return true;
  const doctorStat = lstatOrNull3(fsOps, path13.join(directoryPath, "DOCTOR.md"));
  return doctorStat?.isFile() === true && !doctorStat.isSymbolicLink();
}
function installationStateAt(root, options) {
  const fsOps = options.fsOps ?? fs14;
  const doveStat = lstatOrNull3(fsOps, path13.join(root, ".dove"));
  if (doveStat && (doveStat.isSymbolicLink() || !doveStat.isDirectory())) throw new Error(`Dove installation parent must be a real directory: ${root}/.dove.`);
  if (lstatOrNull3(fsOps, path13.join(root, ".dove-install")) !== null) throw legacyInitError(root);
  const directoryPath = path13.join(root, INSTALLATION_DIRECTORY);
  const manifestPath = path13.join(root, INSTALLATION_MANIFEST_PATH);
  const manifestStat = lstatOrNull3(fsOps, manifestPath);
  if (manifestStat === null) {
    const directoryStat2 = lstatOrNull3(fsOps, directoryPath);
    if (directoryStat2 === null || preservedInstallationDirectory(directoryPath, directoryStat2, fsOps)) return { state: "absent", root, manifestPath };
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
function setupEvidenceAt(root, fsOps) {
  const paths = [
    INSTALLATION_MANIFEST_PATH,
    LEGACY_INSTALLATION_MANIFEST_PATH
  ];
  for (const relativePath of paths) {
    const target = path13.join(root, relativePath);
    const stat = lstatOrNull3(fsOps, target);
    if (stat === null) continue;
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`Dove setup marker must be a regular non-symbolic-link file: ${target}.`);
    }
    return { state: "marker", relativePath };
  }
  for (const relativePath of [INSTALLATION_DIRECTORY, ".dove-install"]) {
    const target = path13.join(root, relativePath);
    const stat = lstatOrNull3(fsOps, target);
    if (stat === null) continue;
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Dove setup path must be a real directory: ${target}.`);
    }
    if (relativePath === INSTALLATION_DIRECTORY && preservedInstallationDirectory(target, stat, fsOps)) continue;
    return { state: "residue", relativePath };
  }
  return { state: "absent", relativePath: null };
}
function legacyInitError(root) {
  return new Error(`Dove found unsupported or incomplete installation state at ${root}. Run 'dove doctor --json' and resolve it explicitly; Dove does not migrate or clean it up.`);
}
function gitRootFrom(start, fsOps) {
  for (const directory of parentDirectories2(start)) {
    const dotGit = path13.join(directory, ".git");
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
  const fsOps = options.fsOps ?? fs14;
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
    const evidence = setupEvidenceAt(directory, fsOps);
    if (evidence.state !== "absent") throw legacyInitError(directory);
  }
  return !explicitProject && gitRoot !== null ? gitRoot : candidate;
}
function packageProjectBoundary(directory, fsOps) {
  const packageJson = lstatOrNull3(fsOps, path13.join(directory, "package.json"));
  const nodeModules = lstatOrNull3(fsOps, path13.join(directory, "node_modules"));
  return packageJson?.isFile() && !packageJson.isSymbolicLink() && nodeModules?.isDirectory() && !nodeModules.isSymbolicLink();
}
function resolveProjectRootForSetup(start, options = {}) {
  const fsOps = options.fsOps ?? fs14;
  const candidate = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project setup start", fsOps);
  for (const directory of parentDirectories2(candidate)) {
    if (setupEvidenceAt(directory, fsOps).state !== "absent") return directory;
    const dotGit = lstatOrNull3(fsOps, path13.join(directory, ".git"));
    if (dotGit !== null) {
      if (dotGit.isSymbolicLink() || !dotGit.isDirectory() && !dotGit.isFile()) {
        throw new Error(`Git project marker must be a file or directory: ${path13.join(directory, ".git")}.`);
      }
      return directory;
    }
    if (packageProjectBoundary(directory, fsOps)) return directory;
  }
  return candidate;
}
function resolveInstalledProjectRoot(start, options = {}) {
  const fsOps = options.fsOps ?? fs14;
  const startingDirectory = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project search start", fsOps);
  for (const directory of parentDirectories2(startingDirectory)) {
    const installation = installationStateAt(directory, options);
    if (installation.state === "initialized") return directory;
    if (installation.state === "residue") throw new Error(`Dove installation state is incomplete at ${directory}.`);
    if (lstatOrNull3(fsOps, path13.join(directory, ".git")) !== null || packageProjectBoundary(directory, fsOps)) break;
  }
  throw initRequiredError(startingDirectory);
}
function inspectProjectRoot(start, options = {}) {
  let canonicalStart = null;
  try {
    canonicalStart = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project search start", options.fsOps ?? fs14);
    const root = resolveInstalledProjectRoot(canonicalStart, options);
    return Object.freeze({ state: "initialized", initialized: true, start: canonicalStart, root, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const uninitialized = message.includes("Dove project integration is not initialized");
    return Object.freeze({
      state: uninitialized ? "uninitialized" : "blocked",
      initialized: false,
      start: canonicalStart,
      root: null,
      error: message
    });
  }
}

// src/core/project-installation.mjs
function exactTimestamp(value) {
  if (value === void 0) return (/* @__PURE__ */ new Date()).toISOString();
  const timestamp = value instanceof Date ? value.toISOString() : value;
  if (typeof timestamp !== "string" || new Date(timestamp).toISOString() !== timestamp) throw new Error("Project integration now must be a Date or exact ISO timestamp.");
  return timestamp;
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
function resultFromTransaction(status, target, hosts, manifest, transaction, details = {}) {
  return {
    status,
    target,
    hosts: [...hosts],
    writtenPaths: [...transaction.writtenPaths],
    removedPaths: [...transaction.removedPaths],
    changedPaths: [...transaction.changedPaths],
    cleanupWarnings: [...transaction.cleanupWarnings],
    omittedCleanupWarningCount: transaction.omittedCleanupWarningCount,
    skippedLocalEdits: [...details.skippedLocalEdits ?? []],
    replacedLocalEdits: [...details.replacedLocalEdits ?? []],
    manifest
  };
}
function transactionOptions(fsOps, options = {}) {
  return { ...options, fsOps };
}
function initializeProjectIntegration(rootOrProject, options = {}) {
  const fsOps = options.fsOps ?? fs15;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const hosts = normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: true });
  const now = exactTimestamp(options.now);
  const root = resolveProjectRootForInit(rootOrProject, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const plan = preparePlan({ root, hosts, packageName: options.packageName, packageVersion: options.packageVersion, now, fsOps });
  plan.entries.push(...prepareResearchDefaults(root, { fsOps }).entries);
  plan.entries.push(...prepareHostMigration(root, { ...options, fsOps, now }));
  return resultFromTransaction(
    "initialized",
    root,
    hosts,
    plan.manifest,
    writeFileSetTransaction(plan.entries, transactionOptions(fsOps))
  );
}
function prepareInstalledPlan(start, options = {}) {
  const fsOps = options.fsOps ?? fs15;
  const root = resolveInstalledProjectRoot(start, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const manifest = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const hosts = options.hosts === void 0 ? [...manifest.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const packageName = options.packageName ?? manifest.package.name;
  const packageVersion = options.packageVersion ?? manifest.package.version;
  assertPackageInput(packageName, packageVersion, { required: true });
  const plan = preparePlan({ root, hosts, packageName, packageVersion, now: exactTimestamp(options.now), fsOps, manifest, replacementPolicy: options.replacementPolicy ?? "safe" });
  return { fsOps, root, hosts, currentManifest: manifest, ...plan };
}
function updateProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, { ...options, replacementPolicy: "explicit-update" });
  prepared.entries.push(...prepareHostMigration(prepared.root, { ...options, fsOps: prepared.fsOps, packageVersion: prepared.manifest.package.version }));
  const transaction = writeFileSetTransaction(
    prepared.entries,
    transactionOptions(prepared.fsOps)
  );
  return resultFromTransaction(transaction.changedPaths.length === 0 ? "unchanged" : "updated", prepared.root, prepared.hosts, prepared.manifest, transaction, prepared);
}
function inspectProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, { ...options, replacementPolicy: options.autoSync === true ? "auto-inspect" : "inspect" });
  const writtenPaths = prepared.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  const needsUpdate = prepared.entries.length > 0 || prepared.skippedLocalEdits.length > 0;
  return {
    status: needsUpdate ? "needs-update" : "current",
    target: prepared.root,
    hosts: [...prepared.hosts],
    writtenPaths,
    removedPaths,
    changedPaths: prepared.entries.map((entry) => entry.relativePath),
    skippedLocalEdits: [...prepared.skippedLocalEdits],
    replacedLocalEdits: [...prepared.replacedLocalEdits],
    retiredHooks: prepared.retiredHooks,
    manifest: prepared.currentManifest
  };
}
function canonicalLifecycleRoot(start, fsOps) {
  const resolved = path14.resolve(start ?? process.cwd());
  const stat = fsOps.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove lifecycle project root must be a real directory: ${resolved}.`);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}
function prepareLifecycleIntegration(root, options, { hosts, source }) {
  const planned = preparePlan({
    root,
    hosts,
    packageName: options.packageName,
    packageVersion: options.packageVersion,
    now: exactTimestamp(options.now),
    fsOps: options.fsOps ?? fs15,
    manifest: source,
    replacementPolicy: "confirmed-reinstall"
  });
  planned.entries.push(...prepareHostMigration(root, options));
  return { ...planned, scope: [] };
}
function previewShape(kind, root, hosts, prepared, confirmationRequired) {
  const writtenEntries = prepared.entries.filter((entry) => entry.delete !== true);
  const writtenPaths = writtenEntries.map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  const replacedPaths = kind === "reinstall" ? writtenPaths : [];
  const preview = {
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
  if (kind === "reinstall") {
    Object.defineProperty(preview, "approvalState", {
      value: writtenEntries.map((entry) => ({
        path: entry.relativePath,
        expectedState: entry.expectedState
      })),
      enumerable: false
    });
  }
  return preview;
}
function previewProjectCompleteReinstall(start, options = {}) {
  const fsOps = options.fsOps ?? fs15;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  const source = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const hosts = options.hosts === void 0 ? [...source.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source });
  return previewShape("reinstall", root, hosts, prepared, true);
}
function reinstallPreviewScope(preview) {
  return JSON.stringify({
    target: preview.target,
    hosts: preview.hosts,
    writtenPaths: preview.writtenPaths,
    removedPaths: preview.removedPaths,
    changedPaths: preview.changedPaths,
    replacedPaths: preview.replacedPaths,
    destructiveScope: preview.destructiveScope,
    approvalState: preview.approvalState
  });
}
function completeReinstallProjectIntegration(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true after displaying the real destructive scope.");
  if (!options.preview || options.preview.action !== "reinstall") throw new Error("Complete Reinstall requires the approved reinstall preview.");
  const fsOps = options.fsOps ?? fs15;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  const source = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  const hosts = options.hosts === void 0 ? [...source.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const prepared = prepareLifecycleIntegration(root, options, { hosts, source });
  const currentPreview = previewShape("reinstall", root, hosts, prepared, true);
  if (reinstallPreviewScope(currentPreview) !== reinstallPreviewScope(options.preview)) {
    throw new Error("Complete Reinstall preview is stale; review the current destructive scope and confirm again.");
  }
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
    ),
    prepared
  );
}
function prepareUninstall(start, options = {}) {
  const fsOps = options.fsOps ?? fs15;
  const root = canonicalLifecycleRoot(start, fsOps);
  const manifest = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  assertManagedOwnership(manifest);
  const entries = [];
  const sharedPaths = [...new Set(manifest.managed.filter((entry) => entry.kind === "json-fragment").map((entry) => entry.path))].sort();
  for (const relativePath of sharedPaths) {
    const planned = planJsonFragments(
      root,
      relativePath,
      [],
      manifest.managed.filter((entry) => entry.kind === "json-fragment" && entry.path === relativePath),
      fsOps,
      { replacementPolicy: "safe" }
    );
    if (planned.entry) entries.push(planned.entry);
  }
  for (const entry of manifest.managed.filter((managed) => managed.kind !== "json-fragment").sort(compareManaged2)) {
    const planned = planResource(root, null, entry, fsOps);
    if (planned.entry) entries.push(planned.entry);
  }
  for (const relativePath of [HOST_MIGRATION_PENDING_PATH, HOST_MIGRATION_REGISTERED_PATH, USER_ORIGINALS_PATH, USER_ORIGINALS_INDEX_PATH]) {
    const observed = inspectRegularProjectFile(root, relativePath, fsOps);
    if (observed.exists) entries.push(transactionDelete(root, { path: relativePath }, observed));
  }
  const manifestObserved = inspectRegularProjectFile(root, INSTALLATION_MANIFEST_PATH, fsOps);
  if (!manifestObserved.exists) throw new Error("Dove uninstall requires the current project installation manifest.");
  entries.push(transactionDelete(root, { path: INSTALLATION_MANIFEST_PATH }, manifestObserved));
  return { fsOps, root, manifest, entries };
}
function uninstallPreview(prepared) {
  const writtenPaths = prepared.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  const preview = {
    status: "ready",
    action: "uninstall",
    target: prepared.root,
    hosts: [...prepared.manifest.hosts],
    writtenPaths,
    removedPaths,
    changedPaths: [.../* @__PURE__ */ new Set([...writtenPaths, ...removedPaths])],
    preservedPaths: [".dove/research/**", ".dove/reviews/**", ".dove/runs/**", ".dove/install/DOCTOR.md"],
    confirmation: { required: true, default: false }
  };
  Object.defineProperty(preview, "approvalState", {
    value: prepared.entries.map((entry) => ({
      path: entry.relativePath,
      expectedState: entry.expectedState
    })),
    enumerable: false
  });
  return preview;
}
function uninstallPreviewScope(preview) {
  return JSON.stringify({
    target: preview.target,
    hosts: preview.hosts,
    writtenPaths: preview.writtenPaths,
    removedPaths: preview.removedPaths,
    changedPaths: preview.changedPaths,
    preservedPaths: preview.preservedPaths,
    approvalState: preview.approvalState
  });
}
function previewProjectUninstall(start, options = {}) {
  return uninstallPreview(prepareUninstall(start, options));
}
function uninstallProjectIntegration(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Dove uninstall requires confirmed: true after displaying the exact removal scope.");
  if (!options.preview || options.preview.action !== "uninstall") throw new Error("Dove uninstall requires the approved uninstall preview.");
  const prepared = prepareUninstall(start, options);
  const currentPreview = uninstallPreview(prepared);
  if (uninstallPreviewScope(currentPreview) !== uninstallPreviewScope(options.preview)) {
    throw new Error("Dove uninstall preview is stale; review the current removal scope and confirm again.");
  }
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
    preservedPaths: [".dove/research/**", ".dove/reviews/**", ".dove/runs/**", ".dove/install/DOCTOR.md"]
  };
}

// src/core/dove-lifecycle.mjs
import fs16 from "node:fs";
function updateDoveLifecycle(start, options = {}) {
  const fsOps = options.fsOps ?? fs16;
  const root = resolveProjectRootForSetup(start, { fsOps });
  return updateProjectIntegration(root, options);
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
import fs17 from "node:fs";
import path15 from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";

// src/core/project-setup-classification.mjs
var ACTIONS = Object.freeze({
  uninitialized: Object.freeze(["init", "details", "exit"]),
  "needs-update": Object.freeze(["update", "change-hosts", "reinstall", "uninstall", "details", "exit"]),
  current: Object.freeze(["change-hosts", "reinstall", "uninstall", "details", "exit"]),
  blocked: Object.freeze(["details", "exit"])
});
function classifyProjectSetup(result) {
  const state2 = result?.projectIntegration?.state;
  const mode = Object.hasOwn(ACTIONS, state2) ? state2 : "blocked";
  return Object.freeze({ mode, reason: mode, allowedActions: ACTIONS[mode] });
}

// src/core/project-doctor.mjs
var MODULE_DIRECTORY = path15.dirname(fileURLToPath3(import.meta.url));
var DEFAULT_PACKAGE_ROOT = path15.resolve(MODULE_DIRECTORY, ["dist", "bin"].includes(path15.basename(MODULE_DIRECTORY)) ? ".." : "../..");
function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}
function plainObject6(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function lstatOrNull4(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function regularNonSymlink(fsOps, targetPath) {
  const stat = lstatOrNull4(fsOps, targetPath);
  return stat !== null && stat.isFile() && !stat.isSymbolicLink();
}
function inspectUserCli(options) {
  const fsOps = options.fsOps ?? fs17;
  const packageRoot = path15.resolve(options.packageRoot ?? DEFAULT_PACKAGE_ROOT);
  const runtimePaths = (options.packageRuntimePaths ?? PACKAGE_RUNTIME_PATHS).map((relativePath) => {
    const absolutePath = path15.resolve(packageRoot, relativePath);
    const relative = path15.relative(packageRoot, absolutePath);
    const contained = relative !== "" && !relative.startsWith("..") && !path15.isAbsolute(relative);
    const healthy2 = contained && regularNonSymlink(fsOps, absolutePath);
    return { path: relativePath, healthy: healthy2, state: healthy2 ? "current" : contained ? "missing-or-invalid" : "outside-package-root" };
  });
  const executablePath = path15.resolve(options.executablePath ?? path15.join(packageRoot, "bin/dove-package.mjs"));
  const executableRelative = path15.relative(packageRoot, executablePath);
  const executableContained = executableRelative === "" || !executableRelative.startsWith("..") && !path15.isAbsolute(executableRelative);
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
  let manifest;
  try {
    manifest = readProjectInstallationManifest(project.root, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS2 });
  } catch (error) {
    return {
      healthy: false,
      state: "blocked",
      start: project.start,
      root: project.root,
      error: messageFor(error),
      manifest: null,
      missing: [],
      drifted: []
    };
  }
  if (options.packageName !== void 0 && options.packageVersion !== void 0) {
    const compatibility = classifyPackageCompatibility(manifest.package, { name: options.packageName, version: options.packageVersion });
    if (["identity-mismatch", "newer", "invalid-version"].includes(compatibility)) {
      return { healthy: false, state: "blocked", start: project.start, root: project.root, error: "Dove project integration package is incompatible with the running CLI.", manifest: manifestSummary(manifest), packageCompatibility: compatibility, missing: [], drifted: [] };
    }
  }
  try {
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
      needsUpdate: canonical.status === "needs-update",
      updatePaths: [...canonical.changedPaths],
      skippedLocalEdits: [...canonical.skippedLocalEdits ?? []],
      replacedLocalEdits: [...canonical.replacedLocalEdits ?? []],
      retiredHooks: canonical.retiredHooks ?? null,
      missing: [],
      drifted: [...canonical.skippedLocalEdits ?? []]
    };
  } catch (error) {
    const message = messageFor(error);
    return {
      healthy: false,
      state: "blocked",
      start: project.start,
      root: project.root,
      error: message,
      manifest: manifestSummary(manifest),
      missing: [],
      drifted: []
    };
  }
}
function researchState(root, options) {
  if (!root) return { healthy: false, state: "unavailable", error: "Project root is unavailable." };
  try {
    const inspected = (options.inspectResearchDocuments ?? inspectResearchDocuments)(root, { fsOps: options.fsOps });
    if (!plainObject6(inspected)) throw new Error("Research document inspection returned an invalid result.");
    return { ...inspected, healthy: inspected.healthy === true };
  } catch (error) {
    return { healthy: false, state: "invalid", error: messageFor(error) };
  }
}
function shellQuote(value) {
  return `'${String(value).replace(/'/gu, "'\\''")}'`;
}
function projectCommand(command, target) {
  return `${command} --project ${shellQuote(target)}`;
}
function actionsFor(result) {
  const target = typeof result.target === "string" && result.target ? result.target : null;
  if (result.setup.mode === "uninitialized") return [{ kind: "init", command: target ? projectCommand("dove init", target) : "dove init" }];
  if (result.setup.mode === "needs-update") return [{ kind: "update", command: target ? projectCommand("dove update", target) : "dove update" }];
  if (result.setup.mode === "blocked" || result.projectIntegration.retiredHooks?.matchedPaths.length > 0) {
    return [{ kind: "inspect", command: target ? projectCommand("dove doctor --json", target) : "dove doctor --json" }];
  }
  return [];
}
function inspectProjectDoctor(start, options = {}) {
  const userCli = inspectUserCli(options);
  let setupRoot = null;
  try {
    setupRoot = resolveProjectRootForSetup(start, { fsOps: options.fsOps });
  } catch {
    setupRoot = typeof start === "string" ? path15.resolve(start) : null;
  }
  const projectIntegration = inspectIntegration(start, options);
  const safeRoot = projectIntegration.root ?? setupRoot;
  const workspaceState = researchState(safeRoot, options);
  const setup = classifyProjectSetup({ projectIntegration });
  const staticChecksPassed = userCli.healthy && projectIntegration.healthy && workspaceState.healthy;
  const result = {
    staticChecksPassed,
    state: staticChecksPassed ? "static-checks-passed" : "attention",
    target: safeRoot,
    userCli,
    projectIntegration,
    workspaceState,
    setup
  };
  result.actions = actionsFor(result);
  return result;
}

// src/core/run-record.mjs
import crypto3 from "node:crypto";
import fs18 from "node:fs";
import path16 from "node:path";
import process3 from "node:process";

// src/core/run-environment.mjs
import { spawnSync as spawnSync2 } from "node:child_process";
var GIT_CAPTURE_TIMEOUT_MS = 5e3;
var GIT_CAPTURE_MAX_BUFFER = 1024 * 1024;
function runGit(projectRoot, gitArgs, options = {}) {
  const gitCommand = options.gitCommand ?? "git";
  try {
    const result = spawnSync2(gitCommand, ["-C", projectRoot, ...gitArgs], {
      cwd: projectRoot,
      shell: false,
      encoding: null,
      timeout: options.gitTimeoutMs ?? GIT_CAPTURE_TIMEOUT_MS,
      maxBuffer: options.gitMaxBuffer ?? GIT_CAPTURE_MAX_BUFFER,
      windowsHide: true
    });
    if (result.error || result.signal) return { ok: false };
    return {
      ok: true,
      statusCode: result.status ?? 0,
      stdout: Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? "")
    };
  } catch {
    return { ok: false };
  }
}
function trimGitOutput(bytes) {
  return bytes.toString("utf8").trim();
}
function normalizeCommit(value) {
  if (value === void 0 || value === null || value === "") return null;
  const trimmed = String(value).trim().toLowerCase();
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(trimmed) ? trimmed : null;
}
function normalizeDirty(value) {
  if (value === true || value === false) return value;
  return null;
}
function normalizeRunGitFacts(value = {}) {
  return {
    commit: normalizeCommit(value.commit ?? null),
    dirty: normalizeDirty(value.dirty)
  };
}
function captureRunGitFacts(projectRoot, options = {}) {
  try {
    if (typeof projectRoot !== "string" || !projectRoot.trim() || projectRoot.includes("\0")) return { commit: null, dirty: null };
    const inside = runGit(projectRoot, ["rev-parse", "--is-inside-work-tree"], options);
    if (!inside.ok || inside.statusCode !== 0 || trimGitOutput(inside.stdout) !== "true") return { commit: null, dirty: null };
    const headResult = runGit(projectRoot, ["rev-parse", "--verify", "HEAD"], options);
    const commit = headResult.ok && headResult.statusCode === 0 ? normalizeCommit(trimGitOutput(headResult.stdout)) : null;
    const statusResult = runGit(projectRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], options);
    const dirty = statusResult.ok && statusResult.statusCode === 0 ? statusResult.stdout.length > 0 : null;
    return { commit, dirty };
  } catch {
    return { commit: null, dirty: null };
  }
}

// src/core/run-record.mjs
var RUN_EVENT_SCHEMA_VERSION = "dove.run.event.v1";
var RUNS_DIRECTORY_PATH = ARTIFACT_PATHS.runsDir;
var RUN_JOURNAL_FILE = "run.jsonl";
var RUN_STDOUT_FILE = "stdout.log";
var RUN_STDERR_FILE = "stderr.log";
var RUN_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/u;
var WINDOWS_RESERVED_NAMES = /* @__PURE__ */ new Set(["CON", "PRN", "AUX", "NUL", ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`), ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`)]);
var RESERVED_EVENT_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "seq", "at", "type", "runId"]);
var FINAL_DECISIONS_MAX_LENGTH = 400;
var FINAL_NOTE_MAX_LENGTH = 4e3;
var RUN_LOCK_DIRECTORY = ".journal.lock";
var RUN_LOCK_WAIT_MS = 2e3;
var RUN_LOCK_RETRY_MS = 25;
var RUN_SEED_MAX_LENGTH = 200;
var RUN_TIMER_MAX_MS = 2147483647;
function plainObject7(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function lstatOrNull5(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function assertRealDirectory(fsOps, targetPath, label) {
  const stat = lstatOrNull5(fsOps, targetPath);
  if (stat === null) throw new Error(`${label} must exist: ${targetPath}`);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${label} must be a real directory: ${targetPath}`);
  return stat;
}
function assertRegularFile(fsOps, targetPath, label) {
  const stat = lstatOrNull5(fsOps, targetPath);
  if (stat === null) throw new Error(`${label} is missing: ${targetPath}`);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} must be a regular non-symlink file: ${targetPath}`);
  return stat;
}
function exactIsoTimestamp2(value = /* @__PURE__ */ new Date(), label = "Dove run timestamp") {
  const timestamp = value instanceof Date ? value.toISOString() : value;
  if (typeof timestamp !== "string" || !timestamp.trim() || timestamp.includes("\0")) throw new Error(`${label} must be an exact ISO timestamp.`);
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== timestamp) throw new Error(`${label} must be an exact ISO timestamp.`);
  return timestamp;
}
function sanitizeOptionalText(value, label, options = {}) {
  if (value === void 0 || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("\0")) throw new Error(`${label} must be a non-empty string without NUL bytes.`);
  const max = options.max ?? 1e3;
  if (trimmed.length > max) throw new Error(`${label} must be at most ${max} characters.`);
  return trimmed;
}
function finiteNumber(value, label) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
    return value;
  }
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error(`${label} must be a finite number.`);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number.`);
  return number;
}
function positiveIntegerOrNull(value, label) {
  if (value === void 0 || value === null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > Number.MAX_SAFE_INTEGER) throw new Error(`${label} must be a positive safe integer.`);
  return number;
}
function nonNegativeInteger(value, label) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 0 || number > Number.MAX_SAFE_INTEGER) throw new Error(`${label} must be a non-negative safe integer.`);
  return number;
}
function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}
function observePid(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return { pid: Number.isInteger(pid) ? pid : null, alive: false, observation: "not-recorded", identity: "pid-only" };
  try {
    process3.kill(pid, 0);
    return { pid, alive: true, observation: "signal-zero", identity: "pid-only" };
  } catch (error) {
    if (error?.code === "ESRCH") return { pid, alive: false, observation: "not-observed", identity: "pid-only" };
    if (error?.code === "EPERM") return { pid, alive: true, observation: "permission-denied", identity: "pid-only" };
    return { pid, alive: false, observation: `error:${error?.code ?? "unknown"}`, identity: "pid-only" };
  }
}
function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}
function createRunId(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const date = now.toISOString().slice(0, 10).replace(/-/gu, "");
  const time = now.toISOString().slice(11, 19).replace(/:/gu, "");
  const suffix = crypto3.randomBytes(4).toString("hex");
  return `run-${date}-${time}-${suffix}`;
}
function normalizeRunId(value) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.includes("\0")) throw new Error("Dove run id must be a non-empty trimmed path-safe string.");
  if (!RUN_ID_PATTERN.test(value)) throw new Error(`Dove run id must be path-safe and contain only letters, numbers, '.', '_' and '-': ${value}`);
  const upper = value.split(".", 1)[0].toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(upper)) throw new Error(`Dove run id must not use a reserved device name: ${value}`);
  return value;
}
function normalizeRunProject(project, options = {}) {
  const fsOps = options.fsOps ?? fs18;
  return resolveInstalledProjectRoot(project ?? options.cwd ?? process3.cwd(), { fsOps });
}
function runRelativePaths(runId) {
  const id = normalizeRunId(runId);
  const base = `${RUNS_DIRECTORY_PATH}/${id}`;
  return {
    runDirectory: base,
    journalPath: `${base}/${RUN_JOURNAL_FILE}`,
    stdoutPath: `${base}/${RUN_STDOUT_FILE}`,
    stderrPath: `${base}/${RUN_STDERR_FILE}`
  };
}
function runAbsolutePaths(projectRoot, runId) {
  const relative = runRelativePaths(runId);
  return {
    ...relative,
    absoluteRunDirectory: path16.join(projectRoot, relative.runDirectory),
    absoluteJournalPath: path16.join(projectRoot, relative.journalPath),
    absoluteStdoutPath: path16.join(projectRoot, relative.stdoutPath),
    absoluteStderrPath: path16.join(projectRoot, relative.stderrPath)
  };
}
function ensureRunsRoot(projectRoot, options = {}) {
  const fsOps = options.fsOps ?? fs18;
  const doveRoot = path16.join(projectRoot, ARTIFACT_PATHS.doveRoot);
  assertRealDirectory(fsOps, doveRoot, "Dove workspace root");
  const runsRoot = path16.join(projectRoot, RUNS_DIRECTORY_PATH);
  const stat = lstatOrNull5(fsOps, runsRoot);
  if (stat !== null) {
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove runs directory must be a real directory: ${RUNS_DIRECTORY_PATH}`);
    return runsRoot;
  }
  try {
    fsOps.mkdirSync(runsRoot, { mode: 448 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const raced = lstatOrNull5(fsOps, runsRoot);
    if (raced?.isDirectory() !== true || raced.isSymbolicLink()) throw new Error(`Dove runs directory must be a real directory: ${RUNS_DIRECTORY_PATH}`);
  }
  return runsRoot;
}
function reserveRunDirectory(options = {}) {
  const fsOps = options.fsOps ?? fs18;
  const projectRoot = normalizeRunProject(options.project, options);
  const runId = normalizeRunId(options.id ?? createRunId({ now: options.now }));
  ensureRunsRoot(projectRoot, { fsOps });
  const paths = runAbsolutePaths(projectRoot, runId);
  try {
    fsOps.mkdirSync(paths.absoluteRunDirectory, { mode: 448 });
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`Dove run id already exists: ${runId}`);
    throw error;
  }
  assertRealDirectory(fsOps, paths.absoluteRunDirectory, "Dove run directory");
  return { projectRoot, runId, paths };
}
function requireRunDirectory(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs18;
  const paths = runAbsolutePaths(projectRoot, runId);
  assertRealDirectory(fsOps, paths.absoluteRunDirectory, "Dove run directory");
  return paths;
}
function tryRunDirectory(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs18;
  const paths = runAbsolutePaths(projectRoot, runId);
  const stat = lstatOrNull5(fsOps, paths.absoluteRunDirectory);
  if (stat === null) return null;
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove run directory must be a real directory: ${paths.runDirectory}`);
  return paths;
}
function acquireRunMutationLock(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs18;
  const paths = requireRunDirectory(projectRoot, runId, { fsOps });
  const lockPath = path16.join(paths.absoluteRunDirectory, RUN_LOCK_DIRECTORY);
  for (let attempt = 0; attempt <= RUN_LOCK_WAIT_MS / RUN_LOCK_RETRY_MS; attempt += 1) {
    try {
      fsOps.mkdirSync(lockPath, { mode: 448 });
      return { release: () => fsOps.rmdirSync(lockPath) };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (attempt < RUN_LOCK_WAIT_MS / RUN_LOCK_RETRY_MS) sleepSync(RUN_LOCK_RETRY_MS);
    }
  }
  throw new Error(`Dove run ${runId} journal writer lock remains occupied: ${lockPath}. Inspect this path before manually removing a leftover lock; Dove does not recover locks automatically.`);
}
function validateRunEvent(value, expectedRunId, expectedSeq, label) {
  if (!plainObject7(value)) throw new Error(`${label} must be a JSON object.`);
  if (value.schemaVersion !== RUN_EVENT_SCHEMA_VERSION) throw new Error(`${label} has unsupported schemaVersion.`);
  if (value.seq !== expectedSeq) throw new Error(`${label} must have contiguous seq ${expectedSeq}.`);
  exactIsoTimestamp2(value.at, `${label}.at`);
  if (typeof value.type !== "string" || !value.type.trim() || value.type.includes("\0")) throw new Error(`${label}.type must be a non-empty string.`);
  if (value.runId !== expectedRunId) throw new Error(`${label}.runId must equal ${expectedRunId}.`);
  return value;
}
function readRunEvents(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs18;
  const id = normalizeRunId(runId);
  const paths = requireRunDirectory(projectRoot, id, { fsOps });
  assertRegularFile(fsOps, paths.absoluteJournalPath, "Dove run journal");
  const text = fsOps.readFileSync(paths.absoluteJournalPath, "utf8");
  if (!text.endsWith("\n")) throw new Error(`Dove run journal must be newline-terminated JSONL: ${paths.journalPath}`);
  const lines = text.slice(0, -1).split("\n");
  if (lines.length === 0 || lines.length === 1 && lines[0] === "") throw new Error(`Dove run journal must contain JSONL events: ${paths.journalPath}`);
  return lines.map((line, index) => {
    if (!line.trim()) throw new Error(`Dove run journal must not contain blank lines: ${paths.journalPath}`);
    const parsed = JSON.parse(line);
    return validateRunEvent(parsed, id, index + 1, `${paths.journalPath}:${index + 1}`);
  });
}
function tryReadRunEvents(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs18;
  const id = normalizeRunId(runId);
  const paths = tryRunDirectory(projectRoot, id, { fsOps });
  if (paths === null) return null;
  const stat = lstatOrNull5(fsOps, paths.absoluteJournalPath);
  if (stat === null) return null;
  return readRunEvents(projectRoot, id, { fsOps });
}
function appendRunEvents(projectRoot, runId, items, options = {}) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Dove run event append requires at least one event item.");
  const fsOps = options.fsOps ?? fs18;
  const id = normalizeRunId(runId);
  const lock = acquireRunMutationLock(projectRoot, id, { fsOps });
  try {
    const paths = requireRunDirectory(projectRoot, id, { fsOps });
    const exists = lstatOrNull5(fsOps, paths.absoluteJournalPath) !== null;
    const previousEvents = exists ? readRunEvents(projectRoot, id, { fsOps }) : [];
    if (options.requireExisting === true && previousEvents.length === 0) throw new Error(`Dove run journal does not exist: ${paths.journalPath}`);
    if (typeof options.precondition === "function") options.precondition(previousEvents);
    const appended = [];
    for (const [index, item] of items.entries()) {
      if (!plainObject7(item)) throw new Error(`Dove run event append item ${index} must be an object.`);
      const { type, payload = {} } = item;
      if (typeof type !== "string" || !type.trim() || type.includes("\0")) throw new Error("Dove run event type must be a non-empty string.");
      const resolvedPayload = typeof payload === "function" ? payload([...previousEvents, ...appended]) : payload;
      if (!plainObject7(resolvedPayload)) throw new Error("Dove run event payload must be a plain object.");
      const forbidden = Object.keys(resolvedPayload).filter((field) => RESERVED_EVENT_FIELDS.has(field));
      if (forbidden.length > 0) throw new Error(`Dove run event payload cannot override public fields: ${forbidden.join(", ")}.`);
      appended.push({
        schemaVersion: RUN_EVENT_SCHEMA_VERSION,
        seq: previousEvents.length + appended.length + 1,
        at: exactIsoTimestamp2(options.now ?? /* @__PURE__ */ new Date()),
        type,
        runId: id,
        ...resolvedPayload
      });
    }
    fsOps.appendFileSync(paths.absoluteJournalPath, appended.map((event) => JSON.stringify(event)).join("\n") + "\n", { encoding: "utf8", mode: 384 });
    return appended;
  } finally {
    lock.release();
  }
}
function appendRunEvent(projectRoot, runId, type, payload = {}, options = {}) {
  return appendRunEvents(projectRoot, runId, [{ type, payload }], options)[0];
}
function normalizeRunCommandArgv(rawArgv) {
  if (!Array.isArray(rawArgv) || rawArgv.length === 0) throw new Error("dove run start requires a command after '--'.");
  const argv = rawArgv.map((item) => String(item));
  for (const [index, item] of argv.entries()) {
    if (index === 0 && !item) throw new Error("Dove run command argv[0] must be a non-empty string.");
    if (item.includes("\0")) throw new Error(`Dove run command argv[${index}] must not contain NUL bytes.`);
  }
  return argv;
}
function parseWallTime(value) {
  if (value === void 0 || value === null || value === "") return null;
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error("--wall-time must be a duration such as 500ms, 2s, 10m, or 1h.");
  const match = value.trim().match(/^(\d+)(ms|s|m|h)?$/iu);
  if (!match) throw new Error("--wall-time must be a duration such as 500ms, 2s, 10m, or 1h.");
  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("--wall-time must be a positive duration.");
  const unit = (match[2] ?? "ms").toLowerCase();
  const multiplier = { ms: 1, s: 1e3, m: 6e4, h: 36e5 }[unit];
  const milliseconds = amount * multiplier;
  if (!Number.isSafeInteger(milliseconds) || milliseconds > RUN_TIMER_MAX_MS) throw new Error(`--wall-time must be at most ${RUN_TIMER_MAX_MS}ms (Node.js timer limit).`);
  return milliseconds;
}
function normalizeRunBudget(options = {}) {
  const timeoutMsFromNumber = positiveIntegerOrNull(options.timeoutMs, "--timeout-ms");
  if (timeoutMsFromNumber > RUN_TIMER_MAX_MS) throw new Error(`--timeout-ms must be at most ${RUN_TIMER_MAX_MS}ms (Node.js timer limit).`);
  const timeoutMsFromWallTime = parseWallTime(options.wallTime);
  if (timeoutMsFromNumber !== null && timeoutMsFromWallTime !== null) throw new Error("Use only one of --timeout-ms or --wall-time for a Dove run.");
  const timeoutMs = timeoutMsFromNumber ?? timeoutMsFromWallTime;
  const killGraceMs = options.killGraceMs === void 0 || options.killGraceMs === null || options.killGraceMs === "" ? 5e3 : nonNegativeInteger(options.killGraceMs, "--kill-grace-ms");
  if (killGraceMs > RUN_TIMER_MAX_MS) throw new Error(`--kill-grace-ms must be at most ${RUN_TIMER_MAX_MS}ms (Node.js timer limit).`);
  return { timeoutMs, killGraceMs };
}
function normalizeRunMetricSpec(options = {}) {
  const name = sanitizeOptionalText(options.metricName ?? options.name, "--metric-name", { max: 200 });
  const direction = sanitizeOptionalText(options.direction, "--direction", { max: 3 });
  const unit = sanitizeOptionalText(options.metricUnit ?? options.unit, "--metric-unit", { max: 80 });
  if ((direction !== null || unit !== null) && name === null) throw new Error("--direction and --metric-unit require --metric-name.");
  if (name !== null && !["min", "max"].includes(direction ?? "")) throw new Error("--metric-name requires --direction min or --direction max.");
  return name === null ? { name: null, direction: null, unit: null } : { name, direction, unit };
}
function normalizeRunBasis(options = {}) {
  return {
    data: sanitizeOptionalText(options.data, "--data", { max: 500 }),
    evaluator: sanitizeOptionalText(options.evaluator, "--evaluator", { max: 500 }),
    resourceBasis: sanitizeOptionalText(options.resourceBasis, "--resource-basis", { max: 500 })
  };
}
function normalizeRunSeed(value) {
  if (typeof value === "string" && /[\x00-\x1f\x7f-\x9f]/u.test(value)) throw new Error("--seed must not contain control characters.");
  const text = sanitizeOptionalText(value, "--seed", { max: RUN_SEED_MAX_LENGTH });
  return text === null ? { declaration: "not-declared", value: null } : { declaration: "declared", value: text };
}
function normalizeRunGroup(value) {
  return sanitizeOptionalText(value, "--group", { max: 200 });
}
function normalizeFinalizeInput(options = {}, startedMetric = { name: null, direction: null, unit: null }) {
  const metricValue = finiteNumber(options.metricValue, "--metric-value");
  const explicitMetric = normalizeRunMetricSpec(options);
  const name = explicitMetric.name ?? startedMetric?.name ?? null;
  const direction = explicitMetric.direction ?? startedMetric?.direction ?? null;
  const unit = explicitMetric.name === null ? startedMetric?.unit ?? null : explicitMetric.unit;
  if (typeof name !== "string" || !name || !["min", "max"].includes(direction)) {
    throw new Error("dove run finalize requires a metric name and direction, either from run start or from --metric-name and --direction.");
  }
  if (startedMetric?.name !== null && startedMetric?.name !== void 0) {
    if (name !== startedMetric.name || direction !== startedMetric.direction || (unit ?? null) !== (startedMetric.unit ?? null)) {
      throw new Error("dove run finalize metric definition must match the metric recorded at run start.");
    }
  }
  return {
    metric: { name, direction, unit: unit ?? null, value: metricValue },
    decision: sanitizeOptionalText(options.decision, "--decision", { max: FINAL_DECISIONS_MAX_LENGTH }),
    note: sanitizeOptionalText(options.note, "--note", { max: FINAL_NOTE_MAX_LENGTH })
  };
}
function terminalEventFrom(events) {
  return events.filter((event) => event.type === "run.terminal").at(-1) ?? null;
}
function reconciledEventFrom(events) {
  return events.filter((event) => event.type === "run.reconciled").at(-1) ?? null;
}
function finalizedEventFrom(events) {
  return events.filter((event) => event.type === "run.finalized").at(-1) ?? null;
}
function startedEventFrom(events) {
  return events.find((event) => event.type === "run.started") ?? null;
}
function normalizeStartedSeed(started) {
  try {
    return normalizeRunSeed(plainObject7(started.seed) && started.seed.declaration === "declared" ? started.seed.value : null);
  } catch {
    return normalizeRunSeed(null);
  }
}
function normalizeStartedEventFacts(started, projectRoot) {
  const legacyGit = plainObject7(started?.environment?.git) ? started.environment.git : {};
  const git = normalizeRunGitFacts({
    commit: Object.hasOwn(started, "commit") ? started.commit : legacyGit.fullHead,
    dirty: Object.hasOwn(started, "dirty") ? started.dirty : legacyGit.dirty
  });
  return {
    group: started.group ?? null,
    argv: Array.isArray(started.argv) ? [...started.argv] : [],
    cwd: started.cwd ?? projectRoot,
    budget: started.budget ?? { timeoutMs: null, killGraceMs: null },
    metric: started.metric ?? { name: null, direction: null, unit: null },
    data: started.data ?? null,
    evaluator: started.evaluator ?? null,
    resourceBasis: started.resourceBasis ?? null,
    seed: normalizeStartedSeed(started),
    commit: git.commit,
    dirty: git.dirty,
    supervisorPid: started.supervisorPid ?? null,
    startedAt: started.at
  };
}
function targetEventFrom(events) {
  return events.filter((event) => event.type === "target.started").at(-1) ?? null;
}
function timeoutEventFrom(events) {
  return events.filter((event) => event.type === "timeout.requested").at(-1) ?? null;
}
function summarizeStatus(projectRoot, runId, events) {
  const started = startedEventFrom(events);
  if (!started) throw new Error(`Dove run ${runId} has no run.started event.`);
  const startedFacts = normalizeStartedEventFacts(started, projectRoot);
  const target = targetEventFrom(events);
  const timeout = timeoutEventFrom(events);
  const terminal = terminalEventFrom(events);
  const reconciled = reconciledEventFrom(events);
  const finalized = finalizedEventFrom(events);
  const supervisorObservation = observePid(startedFacts.supervisorPid);
  const recordedTargetPid = target?.targetPid ?? terminal?.targetPid ?? reconciled?.targetPid ?? null;
  const targetObservation = observePid(recordedTargetPid);
  let status;
  let lifecycle;
  if (terminal) {
    status = terminal.outcome ?? terminal.status ?? "terminal";
    lifecycle = "terminal";
  } else if (reconciled?.terminal === true) {
    status = reconciled.outcome ?? reconciled.status ?? "interrupted";
    lifecycle = "terminal";
  } else if (supervisorObservation.alive) {
    status = target ? "running" : "starting";
    lifecycle = "active";
  } else if (targetObservation.alive) {
    status = "orphaned";
    lifecycle = "blocked";
  } else {
    status = "unreconciled";
    lifecycle = "needs-reconcile";
  }
  const paths = runRelativePaths(runId);
  return {
    runId,
    project: projectRoot,
    status,
    lifecycle,
    terminal: terminal !== null || reconciled?.terminal === true,
    finalized: finalized !== null,
    outcome: terminal?.outcome ?? reconciled?.outcome ?? null,
    exitCode: terminal?.exitCode ?? reconciled?.exitCode ?? null,
    signal: terminal?.signal ?? reconciled?.signal ?? null,
    group: startedFacts.group,
    argv: startedFacts.argv,
    cwd: startedFacts.cwd,
    budget: startedFacts.budget,
    metric: finalized?.metric ?? startedFacts.metric,
    startMetric: startedFacts.metric,
    data: startedFacts.data,
    evaluator: startedFacts.evaluator,
    resourceBasis: startedFacts.resourceBasis,
    seed: startedFacts.seed,
    commit: startedFacts.commit,
    dirty: startedFacts.dirty,
    startedAt: startedFacts.startedAt,
    terminalAt: terminal?.at ?? reconciled?.at ?? null,
    finalizedAt: finalized?.at ?? null,
    supervisorPid: startedFacts.supervisorPid,
    targetPid: recordedTargetPid,
    pidObservation: {
      supervisor: supervisorObservation,
      target: targetObservation,
      note: "PID liveness is observation only and is not a strong process identity."
    },
    timeoutTriggered: timeout !== null,
    paths,
    eventCount: events.length,
    latestEventType: events.at(-1)?.type ?? null
  };
}
function summarizeRun(projectRoot, runId, options = {}) {
  const events = readRunEvents(projectRoot, runId, options);
  return summarizeStatus(projectRoot, normalizeRunId(runId), events);
}
function runsRootEntries(projectRoot, options = {}) {
  const fsOps = options.fsOps ?? fs18;
  const runsRoot = path16.join(projectRoot, RUNS_DIRECTORY_PATH);
  const stat = lstatOrNull5(fsOps, runsRoot);
  if (stat === null) return [];
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove runs directory must be a real directory: ${RUNS_DIRECTORY_PATH}`);
  return fsOps.readdirSync(runsRoot, { withFileTypes: true }).filter((entry) => !entry.name.startsWith(".")).map((entry) => {
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`Dove run entry must be a real directory: ${RUNS_DIRECTORY_PATH}/${entry.name}`);
    return normalizeRunId(entry.name);
  }).sort();
}
function listRunSummaries(options = {}) {
  const fsOps = options.fsOps ?? fs18;
  const projectRoot = normalizeRunProject(options.project, options);
  const group = normalizeRunGroup(options.group);
  const runs = [];
  for (const runId of runsRootEntries(projectRoot, { fsOps })) {
    const events = tryReadRunEvents(projectRoot, runId, { fsOps });
    if (events === null) continue;
    const summary = summarizeStatus(projectRoot, runId, events);
    if (group !== null && summary.group !== group) continue;
    runs.push(summary);
  }
  return { command: "status", status: "ok", project: projectRoot, group, runs };
}
function inspectRunStatus(options = {}) {
  const fsOps = options.fsOps ?? fs18;
  const projectRoot = normalizeRunProject(options.project, options);
  if (options.id !== void 0 && options.id !== null) {
    if (options.group !== void 0 && options.group !== null) throw new Error("Use only one of --id or --group for dove run status.");
    const runId = normalizeRunId(options.id);
    return { command: "status", ...summarizeRun(projectRoot, runId, { fsOps }) };
  }
  return listRunSummaries({ ...options, fsOps, project: projectRoot });
}
function appendReconciledInterrupted(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs18;
  const id = normalizeRunId(runId);
  const event = appendRunEvent(projectRoot, id, "run.reconciled", {
    outcome: "interrupted",
    status: "interrupted",
    terminal: true,
    reason: "supervisor-and-target-not-observed",
    observed: {
      supervisorPid: options.supervisorPid ?? null,
      targetPid: options.targetPid ?? null,
      supervisorAlive: false,
      targetAlive: false,
      pidIdentity: "pid-only"
    },
    reconcilerPid: process3.pid
  }, {
    fsOps,
    requireExisting: true,
    now: options.now,
    precondition(events) {
      if (terminalEventFrom(events) || reconciledEventFrom(events)?.terminal === true) throw new Error(`Dove run ${id} is already terminal.`);
      if (events.some((item) => item.type === "run.reconciled")) throw new Error(`Dove run ${id} has already been reconciled.`);
    }
  });
  return { event, summary: summarizeRun(projectRoot, id, { fsOps }) };
}
function appendFinalizedRun(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs18;
  const root = normalizeRunProject(projectRoot, { fsOps, cwd: options.cwd });
  const id = normalizeRunId(runId);
  const event = appendRunEvent(root, id, "run.finalized", (events) => {
    const started = startedEventFrom(events);
    if (!started) throw new Error(`Dove run ${id} has no run.started event.`);
    return normalizeFinalizeInput(options, started.metric ?? { name: null, direction: null, unit: null });
  }, {
    fsOps,
    requireExisting: true,
    now: options.now,
    precondition(events) {
      if (!startedEventFrom(events)) throw new Error(`Dove run ${id} has no run.started event.`);
      if (!terminalEventFrom(events) && reconciledEventFrom(events)?.terminal !== true) throw new Error(`dove run finalize requires a terminal run: ${id}`);
      if (finalizedEventFrom(events)) throw new Error(`Dove run ${id} is already finalized.`);
    }
  });
  return { event, summary: summarizeRun(root, id, { fsOps }) };
}
function compareBasis(summary) {
  const metric = summary.metric ?? {};
  return {
    metric: { name: metric.name ?? null, direction: metric.direction ?? null, unit: metric.unit ?? null },
    budget: summary.budget ?? { timeoutMs: null, killGraceMs: null },
    data: summary.data ?? null,
    evaluator: summary.evaluator ?? null,
    resourceBasis: summary.resourceBasis ?? null
  };
}
function mismatchFields(summaries) {
  if (summaries.length <= 1) return [];
  const baseline = compareBasis(summaries[0]);
  return Object.keys(baseline).filter((field) => summaries.some((summary) => stableJson(compareBasis(summary)[field]) !== stableJson(baseline[field])));
}
function selectedRunIds(projectRoot, options = {}) {
  const explicitIds = Array.isArray(options.ids) ? options.ids.map(normalizeRunId) : [];
  if (explicitIds.length > 0 && options.group !== void 0 && options.group !== null) throw new Error("Use only one of --id or --group for dove run compare.");
  const byGroup = options.group === void 0 || options.group === null ? [] : listRunSummaries({ ...options, project: projectRoot }).runs.map((run) => run.runId);
  return [.../* @__PURE__ */ new Set([...explicitIds, ...byGroup])].sort();
}
function compareRuns(options = {}) {
  const fsOps = options.fsOps ?? fs18;
  const projectRoot = normalizeRunProject(options.project, options);
  const runIds = selectedRunIds(projectRoot, { ...options, fsOps });
  if (runIds.length === 0) {
    return { command: "compare", status: "ok", comparable: false, fields: ["selection"], project: projectRoot, group: options.group ?? null, runIds, runs: [], message: "No Dove runs were selected for comparison." };
  }
  const summaries = runIds.map((runId) => summarizeRun(projectRoot, runId, { fsOps }));
  const notReady = summaries.filter((summary) => !summary.terminal || !summary.finalized || typeof summary.metric?.value !== "number" || !Number.isFinite(summary.metric.value));
  if (notReady.length > 0) {
    return {
      command: "compare",
      status: "ok",
      comparable: false,
      fields: ["state"],
      project: projectRoot,
      group: options.group ?? null,
      runIds,
      runs: summaries.map((summary) => ({ runId: summary.runId, status: summary.status, terminal: summary.terminal, finalized: summary.finalized, metric: summary.metric, commit: summary.commit, dirty: summary.dirty }))
    };
  }
  const fields = mismatchFields(summaries);
  if (fields.length > 0) {
    return {
      command: "compare",
      status: "ok",
      comparable: false,
      fields,
      project: projectRoot,
      group: options.group ?? null,
      runIds,
      runs: summaries.map((summary) => ({ runId: summary.runId, basis: compareBasis(summary), metric: summary.metric, status: summary.status, commit: summary.commit, dirty: summary.dirty }))
    };
  }
  const basis = compareBasis(summaries[0]);
  const direction = basis.metric.direction;
  const ranked = [...summaries].sort((left, right) => {
    const delta = direction === "min" ? left.metric.value - right.metric.value : right.metric.value - left.metric.value;
    return delta || left.runId.localeCompare(right.runId);
  });
  const best = ranked[0].metric.value;
  const ranking = ranked.map((summary, index) => {
    const delta = direction === "min" ? summary.metric.value - best : best - summary.metric.value;
    return {
      rank: index + 1,
      runId: summary.runId,
      status: summary.status,
      metricValue: summary.metric.value,
      commit: summary.commit,
      dirty: summary.dirty,
      deltaFromBest: Number.isFinite(delta) ? delta : null,
      stdoutPath: summary.paths.stdoutPath,
      stderrPath: summary.paths.stderrPath
    };
  });
  return { command: "compare", status: "ok", comparable: true, fields: [], project: projectRoot, group: options.group ?? null, runIds, basis, ranking };
}

// src/core/run-supervisor.mjs
import { spawn } from "node:child_process";
import fs19 from "node:fs";
import process4 from "node:process";
var SUPERVISOR_ENTRY = "__dove-run-supervisor";
var SUPERVISOR_READY_TIMEOUT_MS = 1e4;
var SUPERVISOR_CONFIG_TIMEOUT_MS = 1e4;
function plainObject8(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function spawnSupervisor(executablePath, payload) {
  if (typeof executablePath !== "string" || !executablePath.trim()) throw new Error("Dove run supervisor requires the current CLI executable path.");
  const child = spawn(process4.execPath, [executablePath, SUPERVISOR_ENTRY], {
    cwd: payload.projectRoot,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", "ignore", "ignore", "ipc"]
  });
  return child;
}
function waitForSupervisorMessage(child, acceptedTypes, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? SUPERVISOR_READY_TIMEOUT_MS;
    const expected = acceptedTypes.join("/");
    let settled = false;
    const timer = setTimeout(() => {
      settle(() => reject(new Error(`Dove run supervisor did not report ${expected} before the timeout.`)));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      child.off("message", onMessage);
      child.off("error", onError);
      child.off("exit", onExit);
    };
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onMessage = (message) => {
      if (!plainObject8(message) || typeof message.type !== "string") return;
      if (message.type === "failed") {
        settle(() => reject(new Error(message.error ?? "Dove run supervisor failed.")));
        return;
      }
      if (acceptedTypes.includes(message.type)) settle(() => resolve(message));
    };
    const onError = (error) => settle(() => reject(error));
    const onExit = (code, signal) => settle(() => reject(new Error(`Dove run supervisor exited before reporting ${acceptedTypes.join("/")}: code ${code ?? "null"}, signal ${signal ?? "null"}.`)));
    child.on("message", onMessage);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}
function sendSupervisorConfig(child, payload) {
  return new Promise((resolve, reject) => {
    if (typeof child.send !== "function" || child.connected === false) {
      reject(new Error("Dove run supervisor IPC channel is not available for configuration."));
      return;
    }
    child.send({ type: "config", payload }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
async function configureSupervisorAndWait(child, payload, acceptedTypes) {
  await waitForSupervisorMessage(child, ["awaiting-config"], { timeoutMs: SUPERVISOR_CONFIG_TIMEOUT_MS });
  const result = waitForSupervisorMessage(child, acceptedTypes);
  try {
    await sendSupervisorConfig(child, payload);
  } catch (error) {
    result.catch(() => {
    });
    throw error;
  }
  return await result;
}
function removeEmptyReservedRunDirectory(paths, fsOps = fs19) {
  try {
    const entries = fsOps.readdirSync(paths.absoluteRunDirectory);
    if (entries.length === 0) fsOps.rmdirSync(paths.absoluteRunDirectory);
  } catch {
  }
}
async function startDetachedRunSupervisor(options = {}) {
  const argv = normalizeRunCommandArgv(options.argv);
  const budget = normalizeRunBudget(options);
  const metric = normalizeRunMetricSpec(options);
  const basis = normalizeRunBasis(options);
  const seed = normalizeRunSeed(options.seed);
  const group = normalizeRunGroup(options.group);
  const projectRoot = normalizeRunProject(options.project, { cwd: options.cwd });
  const runId = normalizeRunId(options.id ?? createRunId({ now: options.now }));
  const git = captureRunGitFacts(projectRoot);
  const reserved = reserveRunDirectory({ project: projectRoot, id: runId, cwd: options.cwd, now: options.now });
  const payload = {
    mode: "start",
    projectRoot: reserved.projectRoot,
    runId: reserved.runId,
    argv,
    budget,
    metric,
    basis,
    seed,
    commit: git.commit,
    dirty: git.dirty,
    group
  };
  const child = spawnSupervisor(options.executablePath, payload);
  let ready;
  try {
    ready = await configureSupervisorAndWait(child, payload, ["ready"]);
  } catch (error) {
    try {
      child.kill();
    } catch {
    }
    removeEmptyReservedRunDirectory(reserved.paths);
    throw error;
  }
  try {
    child.disconnect();
  } catch {
  }
  child.unref();
  return {
    command: "start",
    status: "started",
    project: reserved.projectRoot,
    runId: reserved.runId,
    supervisorPid: ready.supervisorPid ?? child.pid,
    argv,
    cwd: reserved.projectRoot,
    group,
    budget,
    metric,
    data: basis.data,
    evaluator: basis.evaluator,
    resourceBasis: basis.resourceBasis,
    seed,
    commit: ready.commit,
    dirty: ready.dirty,
    paths: {
      runDirectory: reserved.paths.runDirectory,
      journalPath: reserved.paths.journalPath,
      stdoutPath: reserved.paths.stdoutPath,
      stderrPath: reserved.paths.stderrPath
    }
  };
}
function resumeRun(options = {}) {
  const initial = inspectRunStatus(options);
  if (initial.terminal) return { command: "resume", status: "terminal", action: "none", write: false, reason: "run is already terminal", run: initial };
  if (initial.pidObservation.supervisor.alive) return { command: "resume", status: "active", action: "none", write: false, reason: "supervisor pid is currently observable by PID-only liveness; Dove will not reconcile or mutate it", run: initial };
  if (initial.pidObservation.target.alive) return { command: "resume", status: "orphaned", action: "blocked", write: false, reason: "target pid is observable by PID-only liveness but supervisor pid is not; Dove will not rerun or mutate this run", run: initial };
  const { summary: reconciled } = appendReconciledInterrupted(initial.project, initial.runId, {
    ...options,
    supervisorPid: initial.supervisorPid,
    targetPid: initial.targetPid
  });
  return { command: "resume", status: "interrupted", action: "reconciled", write: true, reason: "supervisor and target pids were not observable, so Dove recorded one interrupted reconciliation", run: reconciled };
}
export {
  ARTIFACT_PATHS,
  COMMAND_SURFACES,
  COMMAND_SURFACE_BY_ID,
  DOVE_AGENT_SURFACES,
  DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS,
  DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS,
  DOVE_CLAUDE_SESSION_START_HOOK_COMMAND,
  DOVE_CLAUDE_STATUS_LINE,
  DOVE_CLAUDE_STATUS_LINE_COMMAND,
  DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND,
  DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_ENTRY,
  DOVE_RESEARCH_ACTION_SPINE,
  DOVE_RESEARCH_ACTUAL_MATERIAL_FACT_BOUNDARY,
  DOVE_RESEARCH_AGENT_DESCRIPTION,
  DOVE_RESEARCH_AGENT_NAME,
  DOVE_RESEARCH_AGENT_RESPONSIBILITY,
  DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY,
  DOVE_RESEARCH_CANDIDATE_COVERAGE,
  DOVE_RESEARCH_CLARIFICATION,
  DOVE_RESEARCH_CORRECTION_RECORDING,
  DOVE_RESEARCH_CROSS_DOMAIN_INTUITION,
  DOVE_RESEARCH_DECISION_CONSEQUENCE,
  DOVE_RESEARCH_EVALUATION,
  DOVE_RESEARCH_EXPERIMENT_ITERATION,
  DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY,
  DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY,
  DOVE_RESEARCH_FLAT_SKILL_SENTENCE,
  DOVE_RESEARCH_MAINLINE_ANCHORING,
  DOVE_RESEARCH_MAINTENANCE_TRIGGER,
  DOVE_RESEARCH_MENTOR_NAME,
  DOVE_RESEARCH_ONE_AGENT,
  DOVE_RESEARCH_QUALITY_CRITERIA,
  DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS,
  DOVE_RESEARCH_QUALITY_REFERENCE_PATHS,
  DOVE_RESEARCH_REFLECTION_CONTINUITY,
  DOVE_RESEARCH_RESULT_ADOPTION,
  DOVE_RESEARCH_REVIEW_AGENT_NAME,
  DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY,
  DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
  DOVE_RESEARCH_REVIEW_DUAL_COMPLETION,
  DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
  DOVE_RESEARCH_ROUND_CYCLE,
  DOVE_RESEARCH_ROUND_RECORDS,
  DOVE_RESEARCH_SHARED_CONTRACT_BULLETS,
  EXA_MCP_FRAGMENT,
  EXA_MCP_PATH,
  EXA_MCP_SELECTOR,
  EXA_MCP_SERVER_NAME,
  EXA_MCP_URL,
  EXA_WEB_SUPPORT_SKILL_PATH,
  HOST_ADAPTERS,
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
  RESEARCH_DEFAULT_PATHS,
  RESEARCH_DOCUMENT_PATHS,
  RUNS_DIRECTORY_PATH,
  RUN_EVENT_SCHEMA_VERSION,
  USER_RESPONSE_POLICY,
  WEB_FETCH_DENY_PERMISSION,
  WEB_FETCH_DENY_SELECTOR,
  allGeneratedCommandAdapterPaths,
  appendFinalizedRun,
  commandAdapterPathsForHost,
  compareRuns,
  completeReinstallDoveLifecycle,
  createRunId,
  exportPaperBibtex,
  formatContextCapacity,
  formatSessionDuration,
  generatedDoveAgentEntries,
  groupPaperLibrary,
  initializeProjectIntegration,
  inspectGitBranch,
  inspectProjectDoctor,
  inspectProjectIntegration,
  inspectResearchDocuments,
  inspectRunStatus,
  mergeClaudeUserPromptSubmitSettings,
  normalizeRunId,
  parseDoveStatusLinePayload,
  parseSessionStartPayload,
  parseUserPromptSubmitPayload,
  prepareResearchDefaults,
  previewProjectCompleteReinstall,
  previewProjectUninstall,
  previewUninstallDoveLifecycle,
  readHostSettings,
  readPaperLibrary,
  readRunEvents,
  renderClaudeAmbientRule,
  renderClaudeDoveAgent,
  renderDoveAgentInstructions,
  renderDoveAuthorPreferencesFullReference,
  renderDoveAuthorPreferencesReference,
  renderDoveAuthorStanceSection,
  renderDoveResearchQualityFullReference,
  renderDoveResearchQualityReference,
  renderDoveResearchReanchor,
  renderDoveSharedResearchContractSection,
  renderDoveStatusLine,
  renderExaWebSupportSkill,
  renderMentorBrief,
  renderPaperLibrary,
  renderPaperSearchSupportSkill,
  resumeRun,
  runRelativePaths,
  sessionStartFailureOutput,
  sessionStartOutput,
  startDetachedRunSupervisor,
  summarizeRun,
  uninstallDoveLifecycle,
  uninstallProjectIntegration,
  updateDoveLifecycle,
  updateProjectIntegration,
  userPromptSubmitFailureOutput,
  userPromptSubmitOutput,
  writeHostSettings
};
