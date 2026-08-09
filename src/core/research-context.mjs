export const RESEARCH_CONTEXT_VIEWS = Object.freeze([
  "overview", "diagnosis", "related-work", "hypotheses", "experiment-options",
  "result-synthesis", "claim-story", "branch-synthesis", "reviews"
]);

const VIEW_SET = new Set(RESEARCH_CONTEXT_VIEWS);
const RESULT_KINDS = Object.freeze(["positive", "negative", "null", "mixed", "failed", "stopped"]);
const MODEL_FIELDS = new Set(["workspace", "missions", "sources", "experiments", "claims", "reviews", "lessons"]);
const INPUT_FIELDS = new Set(["experimentCandidates", "lessonApplications", "hostAnalysis"]);
const QUERY_FIELDS = new Set(["view", "missionIds", "branchMissionIds"]);
const WORKSPACE_FIELDS = new Set(["workspaceId", "researchQuestion", "mainline", "contributionIntent", "currentFocus", "changeHistory", "createdAt", "updatedAt"]);
const MISSION_FIELDS = new Set(["missionId", "parentMissionId", "dependsOnMissionIds", "branchKind", "branchReason", "goal", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs", "contributionRole", "createdAt"]);
const SOURCE_FIELDS = new Set(["sourceId", "missionId", "citationKey", "title", "authors", "year", "locator", "sourceType", "summary", "conditions", "relationship", "conflicts", "limitations", "capture", "recordedAt"]);
const CAPTURE_FIELDS = new Set(["path", "sizeBytes", "sha256"]);
const EXPERIMENT_FIELDS = new Set(["plan", "result"]);
const PLAN_FIELDS = new Set(["experimentId", "missionId", "title", "hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts", "cost", "risk", "failureValue", "contributionRole", "plannedAt"]);
const RESULT_FIELDS = new Set(["experimentId", "missionId", "kind", "summary", "observations", "measurements", "denominator", "hypothesisImpacts", "claimImpacts", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations", "recordedAt"]);
const CLAIM_FIELDS = new Set(["claimId", "missionId", "statement", "supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "assessment", "storyRole", "artifactRefs", "recordedAt"]);
const REVIEW_FIELDS = new Set(["reviewId", "missionId", "status", "verdict", "summary", "rubric", "reviewedArtifacts", "reviewedArtifactSetSha256", "findings", "actionItems", "report", "provenance", "limitations", "reviewedAt"]);
const CANDIDATE_FIELDS = new Set(["candidateId", "title", "source", "missionId", "hypothesisRefs", "protocol", "discriminatingObservations", "cost", "risk", "failureValue", "contributionRole"]);

function plain(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  return value;
}
function sealed(value, fields, label, requireAll = true) {
  plain(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
  if (requireAll) for (const field of fields) if (!Object.hasOwn(value, field)) throw new Error(`${label} requires ${field}.`);
  return value;
}
function text(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim().replace(/\s+/gu, " ");
}
function optionalText(value, label) { return value === null ? null : text(value, label); }
function list(value, label) { if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); return value; }
function strings(value, label) { return list(value, label).map((item, index) => text(item, `${label}[${index}]`)); }
function records(value, label) { return value instanceof Map ? [...value.values()] : list(value, label); }
function clone(value) { if (Array.isArray(value)) return value.map(clone); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])); return value; }
function freeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; for (const item of Object.values(value)) freeze(item); return Object.freeze(value); }
function immutable(value) { return freeze(clone(value)); }
function unique(items, keyOf = (item) => JSON.stringify(item)) { const seen = new Set(); return items.filter((item) => { const key = keyOf(item); if (seen.has(key)) return false; seen.add(key); return true; }); }

function normalizeWorkspace(value) {
  sealed(value, WORKSPACE_FIELDS, "workspace");
  for (const field of ["workspaceId", "researchQuestion", "mainline", "contributionIntent", "currentFocus", "createdAt", "updatedAt"]) text(value[field], `workspace.${field}`);
  list(value.changeHistory, "workspace.changeHistory");
  return clone(value);
}
function normalizeMission(value, index) {
  const label = `missions[${index}]`; sealed(value, MISSION_FIELDS, label);
  text(value.missionId, `${label}.missionId`); optionalText(value.parentMissionId, `${label}.parentMissionId`); optionalText(value.branchKind, `${label}.branchKind`); optionalText(value.branchReason, `${label}.branchReason`);
  for (const field of ["goal", "contributionRole", "createdAt"]) text(value[field], `${label}.${field}`);
  for (const field of ["dependsOnMissionIds", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs"]) strings(value[field], `${label}.${field}`);
  return clone(value);
}
function normalizeSource(value, index) {
  const label = `sources[${index}]`; sealed(value, SOURCE_FIELDS, label); text(value.sourceId, `${label}.sourceId`); text(value.missionId, `${label}.missionId`); optionalText(value.citationKey, `${label}.citationKey`); optionalText(value.title, `${label}.title`); optionalText(value.locator, `${label}.locator`); optionalText(value.sourceType, `${label}.sourceType`); text(value.summary, `${label}.summary`); text(value.relationship, `${label}.relationship`); text(value.recordedAt, `${label}.recordedAt`);
  for (const field of ["authors", "conditions", "conflicts", "limitations"]) strings(value[field], `${label}.${field}`);
  if (value.capture !== null) sealed(value.capture, CAPTURE_FIELDS, `${label}.capture`);
  return clone(value);
}
function normalizePlan(value, index) {
  const label = `experiments[${index}].plan`; sealed(value, PLAN_FIELDS, label);
  for (const field of ["experimentId", "missionId", "title", "cost", "risk", "failureValue", "contributionRole", "plannedAt"]) text(value[field], `${label}.${field}`);
  for (const field of ["hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts"]) strings(value[field], `${label}.${field}`);
  return clone(value);
}
function normalizeResult(value, index) {
  const label = `experiments[${index}].result`; sealed(value, RESULT_FIELDS, label); text(value.experimentId, `${label}.experimentId`); text(value.missionId, `${label}.missionId`); text(value.summary, `${label}.summary`); text(value.recordedAt, `${label}.recordedAt`); if (!RESULT_KINDS.includes(value.kind)) throw new Error(`${label}.kind is unsupported.`);
  for (const field of ["observations", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations"]) strings(value[field], `${label}.${field}`);
  for (const field of ["measurements", "hypothesisImpacts", "claimImpacts"]) list(value[field], `${label}.${field}`);
  plain(value.denominator, `${label}.denominator`);
  return clone(value);
}
function normalizeExperiment(value, index) {
  const label = `experiments[${index}]`; sealed(value, EXPERIMENT_FIELDS, label); const plan = normalizePlan(value.plan, index); const result = value.result === null ? null : normalizeResult(value.result, index);
  if (result && (result.experimentId !== plan.experimentId || result.missionId !== plan.missionId)) throw new Error(`${label} plan and result bindings differ.`);
  return { plan, result };
}
function normalizeClaim(value, index) {
  const label = `claims[${index}]`; sealed(value, CLAIM_FIELDS, label);
  for (const field of ["claimId", "missionId", "statement", "assessment", "storyRole", "recordedAt"]) text(value[field], `${label}.${field}`);
  for (const field of ["supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "artifactRefs"]) strings(value[field], `${label}.${field}`);
  return clone(value);
}
function normalizeReview(value, index) {
  const label = `reviews[${index}]`; sealed(value, REVIEW_FIELDS, label);
  for (const field of ["reviewId", "missionId", "status", "verdict", "summary", "reviewedArtifactSetSha256", "report", "reviewedAt"]) text(value[field], `${label}.${field}`);
  for (const field of ["rubric", "actionItems", "limitations"]) strings(value[field], `${label}.${field}`);
  list(value.reviewedArtifacts, `${label}.reviewedArtifacts`); list(value.findings, `${label}.findings`); plain(value.provenance, `${label}.provenance`);
  return clone(value);
}
function parseLessons(markdown) {
  if (typeof markdown !== "string" || !markdown.trim()) throw new Error("lessons must be non-empty Markdown.");
  const lessons = []; let section = null;
  for (const line of markdown.split(/\r?\n/u)) {
    const heading = /^##?\s+(.+?)\s*$/u.exec(line); if (heading) { section = heading[1]; continue; }
    const bullet = /^\s*[-*]\s+(.+?)\s*$/u.exec(line); if (bullet) lessons.push({ lessonId: `lesson-${lessons.length + 1}`, section, text: text(bullet[1], "lesson") });
  }
  return lessons;
}
function normalizeApplications(value, lessons) {
  if (value === undefined) return [];
  const fields = new Set(["lessonId", "application", "missionId"]); const byId = new Map(lessons.map((lesson) => [lesson.lessonId, lesson]));
  return list(value, "lessonApplications").map((item, index) => { sealed(item, fields, `lessonApplications[${index}]`); const lesson = byId.get(item.lessonId); if (!lesson) throw new Error(`lessonApplications[${index}] references unknown lesson.`); return { lessonId: lesson.lessonId, lesson: lesson.text, application: text(item.application, `lessonApplications[${index}].application`), missionId: item.missionId === null ? null : text(item.missionId, `lessonApplications[${index}].missionId`) }; });
}
function normalizeCandidate(value, index) {
  const label = `experimentCandidates[${index}]`; sealed(value, CANDIDATE_FIELDS, label); if (!["caller", "mission"].includes(value.source)) throw new Error(`${label}.source must be caller or mission.`);
  for (const field of ["candidateId", "title", "source", "cost", "risk", "failureValue", "contributionRole"]) text(value[field], `${label}.${field}`);
  if (value.missionId !== null) text(value.missionId, `${label}.missionId`);
  for (const field of ["hypothesisRefs", "protocol", "discriminatingObservations"]) strings(value[field], `${label}.${field}`);
  return { ...clone(value), authorization: "not-granted-by-query" };
}
function normalizeModel(model, inputs) {
  sealed(model, MODEL_FIELDS, "Research model"); const workspace = normalizeWorkspace(model.workspace); const missions = records(model.missions, "missions").map(normalizeMission); const missionIds = new Set(missions.map((mission) => mission.missionId));
  if (missionIds.size !== missions.length) throw new Error("missions must not duplicate missionId.");
  for (const mission of missions) { if (mission.parentMissionId && !missionIds.has(mission.parentMissionId)) throw new Error(`Mission ${mission.missionId} references unknown parent.`); for (const id of mission.dependsOnMissionIds) if (!missionIds.has(id)) throw new Error(`Mission ${mission.missionId} references unknown dependency.`); }
  const bind = (record, label) => { if (!missionIds.has(record.missionId)) throw new Error(`${label} references unknown mission.`); return record; };
  const sources = records(model.sources, "sources").map(normalizeSource).map((record) => bind(record, `Source ${record.sourceId}`));
  const experiments = records(model.experiments, "experiments").map(normalizeExperiment).map((record) => { bind(record.plan, `Experiment ${record.plan.experimentId}`); return record; });
  const claims = records(model.claims, "claims").map(normalizeClaim).map((record) => bind(record, `Claim ${record.claimId}`));
  const reviews = records(model.reviews, "reviews").map(normalizeReview).map((record) => bind(record, `Review ${record.reviewId}`));
  const lessons = parseLessons(model.lessons);
  return { workspace, missions, sources, experiments, claims, reviews, lessons, lessonApplications: normalizeApplications(inputs.lessonApplications, lessons), experimentCandidates: inputs.experimentCandidates === undefined ? [] : list(inputs.experimentCandidates, "experimentCandidates").map(normalizeCandidate), hostAnalysis: inputs.hostAnalysis === undefined ? {} : clone(plain(inputs.hostAnalysis, "hostAnalysis")) };
}

function lessonContext(context, missionIds) {
  const selected = new Set(missionIds); const applied = context.lessonApplications.filter((item) => item.missionId === null || selected.has(item.missionId)); const appliedIds = new Set(applied.map((item) => item.lessonId));
  return { applied, available: context.lessons.filter((lesson) => !appliedIds.has(lesson.lessonId)), applicationRule: "Only explicit lessonApplications mark guidance as applied; text similarity is not used." };
}
function missionTree(context) {
  const children = new Map(context.missions.map((mission) => [mission.missionId, []])); for (const mission of context.missions) if (mission.parentMissionId) children.get(mission.parentMissionId).push(mission.missionId);
  return context.missions.map((mission) => ({ ...mission, childMissionIds: children.get(mission.missionId) }));
}
function scoped(context, missionIds) {
  const selectedMissionIds = missionIds === undefined ? context.missions.map((mission) => mission.missionId) : strings(missionIds, "missionIds"); const known = new Set(context.missions.map((mission) => mission.missionId)); for (const id of selectedMissionIds) if (!known.has(id)) throw new Error(`Unknown missionId: ${id}.`); const selected = new Set(selectedMissionIds);
  return { ...context, missions: context.missions.filter((item) => selected.has(item.missionId)), sources: context.sources.filter((item) => selected.has(item.missionId)), experiments: context.experiments.filter((item) => selected.has(item.plan.missionId)), claims: context.claims.filter((item) => selected.has(item.missionId)), reviews: context.reviews.filter((item) => selected.has(item.missionId)), experimentCandidates: context.experimentCandidates.filter((item) => item.missionId === null || selected.has(item.missionId)), selectedMissionIds };
}
function hostSection(context, name) { const section = context.hostAnalysis[name]; return section === undefined ? {} : clone(plain(section, `hostAnalysis.${name}`)); }
function hostItems(section, field) { if (section[field] === undefined) return []; return list(section[field], `hostAnalysis.${field}`).map((item) => typeof item === "string" ? { text: item, source: "host-analysis" } : { ...clone(plain(item, `hostAnalysis.${field} item`)), source: "host-analysis" }); }
function referenceState(reference, context) {
  const separator = reference.indexOf(":"); const kind = separator > 0 ? reference.slice(0, separator) : "recorded-reference"; const target = separator > 0 ? reference.slice(separator + 1) : reference;
  if (kind === "source") return { reference, kind, target, present: context.sources.some((source) => source.sourceId === target) };
  if (kind === "experiment") return { reference, kind, target, present: context.experiments.some((entry) => entry.plan.experimentId === target && entry.result) };
  if (kind === "claim") return { reference, kind, target, present: context.claims.some((claim) => claim.claimId === target) };
  return { reference, kind, target, present: true, presenceMeaning: "recorded reference only" };
}
function claimMatrix(context) {
  return context.claims.map((claim) => { const support = claim.supportRefs.map((reference) => referenceState(reference, context)); const counterEvidence = claim.counterEvidenceRefs.map((reference) => referenceState(reference, context)); return { ...claim, support, counterEvidence, unresolvedSupportRefs: support.filter((item) => !item.present), unresolvedCounterEvidenceRefs: counterEvidence.filter((item) => !item.present) }; });
}

function overview(context) {
  return { view: "overview", workspace: context.workspace, missionTree: missionTree(context), inventory: { missions: context.missions.length, sources: context.sources.length, experimentPlans: context.experiments.length, experimentResults: context.experiments.filter((entry) => entry.result).length, claims: context.claims.length, reviews: context.reviews.length }, guidance: lessonContext(context, context.selectedMissionIds), interpretationBoundary: "Records and exact lineage only; no scientific meaning is inferred." };
}
function diagnosis(context) {
  const matrix = claimMatrix(context); const host = hostSection(context, "diagnosis");
  return { view: "diagnosis", researchFrame: { researchQuestion: context.workspace.researchQuestion, mainline: context.workspace.mainline, contributionIntent: context.workspace.contributionIntent, currentFocus: context.workspace.currentFocus }, contributionClaims: [...matrix.map((claim) => ({ claimId: claim.claimId, statement: claim.statement, assessment: claim.assessment, storyRole: claim.storyRole, source: "claim-record" })), ...hostItems(host, "contributionClaims")], supportGaps: [...matrix.flatMap((claim) => [...claim.missingEvidence.map((text) => ({ claimId: claim.claimId, text, source: "claim-record" })), ...claim.unresolvedSupportRefs.map((reference) => ({ claimId: claim.claimId, text: `Unresolved support reference: ${reference.reference}`, source: "structural-derivation" }))]), ...hostItems(host, "supportGaps")], counterEvidence: [...matrix.flatMap((claim) => claim.counterEvidenceRefs.map((reference) => ({ claimId: claim.claimId, reference, source: "claim-record" }))), ...context.experiments.flatMap((entry) => (entry.result?.claimImpacts ?? []).map((impact) => ({ experimentId: entry.plan.experimentId, resultKind: entry.result.kind, impact: clone(impact), source: "experiment-result" }))), ...hostItems(host, "counterEvidence")], cannotSay: [...matrix.flatMap((claim) => claim.cannotSay.map((statement) => ({ claimId: claim.claimId, statement, source: "claim-record" }))), ...hostItems(host, "cannotSay")], openQuestions: [...context.missions.flatMap((mission) => mission.openQuestions.map((question) => ({ missionId: mission.missionId, question, source: "mission-record" }))), ...hostItems(host, "openQuestions")], assumptions: context.missions.flatMap((mission) => mission.assumptions.map((assumption) => ({ missionId: mission.missionId, assumption }))), lessonsContext: lessonContext(context, context.selectedMissionIds), hostAnalysis: host, derivationRules: ["Claim fields are context, not endorsed conclusions.", "Support gaps use explicit missingEvidence and unresolved exact refs.", "Counter evidence uses exact refs and recorded claimImpacts."] };
}
function relatedWork(context) {
  const host = hostSection(context, "relatedWork");
  return { view: "related-work", sources: context.sources.map((source) => ({ ...source, linkedClaims: context.claims.filter((claim) => [...claim.supportRefs, ...claim.counterEvidenceRefs].includes(`source:${source.sourceId}`)).map((claim) => ({ claimId: claim.claimId, statement: claim.statement, assessment: claim.assessment })) })), relationships: Object.fromEntries(unique(context.sources.map((source) => source.relationship)).map((relationship) => [relationship, context.sources.filter((source) => source.relationship === relationship).map((source) => source.sourceId)])), themes: hostItems(host, "themes"), gaps: hostItems(host, "gaps"), hostAnalysis: host, derivationRules: ["Source semantic fields and capture are copied directly.", "Claim links require exact source refs.", "No novelty or similarity inference is performed."] };
}
function hypotheses(context) {
  const host = hostSection(context, "hypotheses"); const refs = unique([...context.missions.flatMap((mission) => mission.competingHypotheses), ...context.experiments.flatMap((entry) => entry.plan.hypothesisRefs)]);
  return { view: "hypotheses", hypotheses: [...refs.map((hypothesisRef) => ({ hypothesisRef, missions: context.missions.filter((mission) => mission.competingHypotheses.includes(hypothesisRef)).map((mission) => mission.missionId), experiments: context.experiments.filter((entry) => entry.plan.hypothesisRefs.includes(hypothesisRef)).map((entry) => ({ experimentId: entry.plan.experimentId, resultKind: entry.result?.kind ?? null, impacts: (entry.result?.hypothesisImpacts ?? []).filter((impact) => impact?.hypothesisRef === hypothesisRef) })), source: "exact-reference-projection" })), ...hostItems(host, "items")], hostAnalysis: host, derivationRules: ["Hypotheses are exact identifiers.", "Only matching hypothesisImpacts are attached.", "No prose matching is used."] };
}
function option(candidate, index) {
  return { displayOrder: index + 1, ...candidate, comparison: [{ dimension: "discriminatingPower", sourceField: "discriminatingObservations", value: candidate.discriminatingObservations }, { dimension: "informationGainSource", sourceField: "hypothesisRefs", value: candidate.hypothesisRefs }, { dimension: "cost", sourceField: "cost", value: candidate.cost }, { dimension: "risk", sourceField: "risk", value: candidate.risk }, { dimension: "failureValue", sourceField: "failureValue", value: candidate.failureValue }, { dimension: "contributionRole", sourceField: "contributionRole", value: candidate.contributionRole }] };
}
function experimentOptions(context) {
  const stored = context.experiments.map((entry) => ({ candidateId: `experiment:${entry.plan.experimentId}`, title: entry.plan.title, source: "mission", missionId: entry.plan.missionId, hypothesisRefs: entry.plan.hypothesisRefs, protocol: entry.plan.protocol, discriminatingObservations: entry.plan.discriminatingObservations, cost: entry.plan.cost, risk: entry.plan.risk, failureValue: entry.plan.failureValue, contributionRole: entry.plan.contributionRole, authorization: "not-granted-by-query", recordedResultKind: entry.result?.kind ?? null }));
  return { view: "experiment-options", candidates: [...stored, ...context.experimentCandidates].map(option), scoring: null, ranking: null, authorization: "No candidate is selected, scheduled, authorized, or written.", derivationRules: ["Discriminating power exposes discriminatingObservations without scoring.", "Information gain source exposes hypothesisRefs without scoring.", "Order is not rank."] };
}
function resultSynthesis(context) {
  const host = hostSection(context, "resultSynthesis"); const results = context.experiments.filter((entry) => entry.result).map((entry) => ({ experimentId: entry.plan.experimentId, missionId: entry.plan.missionId, ...entry.result }));
  return { view: "result-synthesis", resultKinds: RESULT_KINDS, results, impactsSummary: { byKind: Object.fromEntries(RESULT_KINDS.map((kind) => [kind, results.filter((item) => item.kind === kind).length])), hypothesisImpactCount: results.reduce((sum, item) => sum + item.hypothesisImpacts.length, 0), claimImpactCount: results.reduce((sum, item) => sum + item.claimImpacts.length, 0), observationCount: results.reduce((sum, item) => sum + item.observations.length, 0), unexpectedObservationCount: results.reduce((sum, item) => sum + item.unexpectedObservations.length, 0), failureCount: results.reduce((sum, item) => sum + item.failures.length, 0), limitationCount: results.reduce((sum, item) => sum + item.limitations.length, 0), uncertaintyCount: results.reduce((sum, item) => sum + item.uncertainty.length, 0), denominatorRule: "Every denominator is returned unchanged.", meaning: "Counts and recorded impacts only; interpretation remains host-owned." }, hostAnalysis: host, derivationRules: ["Result kind is copied exactly.", "Observations, denominator, impacts, failures, limitations, and uncertainty are preserved.", "No impact creates or changes a Claim."] };
}
function claimStory(context) {
  const host = hostSection(context, "claimStory"); const matrix = claimMatrix(context); const groups = new Map(); for (const claim of matrix) { const items = groups.get(claim.statement) ?? []; items.push(claim); groups.set(claim.statement, items); }
  return { view: "claim-story", claimEvidenceMatrix: matrix, unsupported: matrix.filter((claim) => !claim.support.length || claim.unresolvedSupportRefs.length).map((claim) => ({ claimId: claim.claimId, statement: claim.statement, unresolvedSupportRefs: claim.unresolvedSupportRefs })), counterEvidence: matrix.flatMap((claim) => claim.counterEvidenceRefs.map((reference) => ({ claimId: claim.claimId, reference }))), missingEvidence: matrix.flatMap((claim) => claim.missingEvidence.map((item) => ({ claimId: claim.claimId, item }))), cannotSay: [...matrix.flatMap((claim) => claim.cannotSay.map((statement) => ({ claimId: claim.claimId, statement }))), ...hostItems(host, "cannotSay")], contributionOutline: { intent: context.workspace.contributionIntent, byStoryRole: Object.fromEntries(unique(matrix.map((claim) => claim.storyRole)).map((role) => [role, matrix.filter((claim) => claim.storyRole === role).map((claim) => claim.claimId)])), byAssessment: Object.fromEntries(unique(matrix.map((claim) => claim.assessment)).map((assessment) => [assessment, matrix.filter((claim) => claim.assessment === assessment).map((claim) => claim.claimId)])), hostAnalysis: hostItems(host, "contributionOutline") }, storyTensions: [...matrix.filter((claim) => claim.assessment === "supported" && (claim.counterEvidenceRefs.length || claim.missingEvidence.length || claim.uncertainty.length)).map((claim) => ({ kind: "supported-with-tensions", claimId: claim.claimId, counterEvidenceRefs: claim.counterEvidenceRefs, missingEvidence: claim.missingEvidence, uncertainty: claim.uncertainty })), ...[...groups.entries()].filter(([, claims]) => new Set(claims.map((claim) => claim.assessment)).size > 1).map(([statement, claims]) => ({ kind: "exact-statement-assessment-conflict", statement, assessments: claims.map((claim) => ({ claimId: claim.claimId, assessment: claim.assessment })) })), ...context.experiments.flatMap((entry) => (entry.result?.claimImpacts ?? []).map((impact) => ({ kind: "recorded-claim-impact", experimentId: entry.plan.experimentId, resultKind: entry.result.kind, impact: clone(impact) }))), ...context.reviews.filter((review) => review.verdict !== "coherent").map((review) => ({ kind: "review-tension", reviewId: review.reviewId, verdict: review.verdict, summary: review.summary })), ...hostItems(host, "storyTensions")], priorities: { figures: context.experiments.filter((entry) => entry.result && (entry.result.measurements.length || entry.result.observations.length || entry.result.unexpectedObservations.length || entry.result.failures.length)).map((entry) => ({ experimentId: entry.plan.experimentId, kind: entry.result.kind, reason: "Recorded measurements or observations are available." })), draft: matrix.map((claim) => ({ claimId: claim.claimId, statement: claim.statement, assessment: claim.assessment, storyRole: claim.storyRole, missingEvidence: claim.missingEvidence, cannotSay: claim.cannotSay, uncertainty: claim.uncertainty })), rebuttal: [...context.reviews.flatMap((review) => review.findings.map((finding) => ({ reviewId: review.reviewId, finding: clone(finding), actionItems: review.actionItems }))), ...matrix.flatMap((claim) => claim.counterEvidenceRefs.map((reference) => ({ claimId: claim.claimId, counterEvidenceRef: reference })))], hostAnalysis: host.priorities === undefined ? {} : clone(plain(host.priorities, "hostAnalysis.claimStory.priorities")) }, derivationRules: ["The matrix uses exact evidence refs.", "missingEvidence and cannotSay are copied directly.", "Story roles organize without ranking or authorization."] };
}
function branchGroup(context, branches) {
  const summaries = branches.map((mission) => ({ mission, claims: context.claims.filter((claim) => claim.missionId === mission.missionId), experiments: context.experiments.filter((entry) => entry.plan.missionId === mission.missionId) })); const statements = unique(summaries.flatMap((summary) => summary.claims.map((claim) => claim.statement)));
  const consensus = statements.flatMap((statement) => { const matches = summaries.map((summary) => summary.claims.filter((claim) => claim.statement === statement)); if (matches.some((items) => !items.length)) return []; const assessments = unique(matches.flat().map((claim) => claim.assessment)); return assessments.length === 1 ? [{ statement, assessment: assessments[0], basis: "exact statement and assessment in every sibling" }] : []; });
  const conflicts = statements.flatMap((statement) => { const matches = summaries.flatMap((summary) => summary.claims.filter((claim) => claim.statement === statement).map((claim) => ({ missionId: summary.mission.missionId, claimId: claim.claimId, assessment: claim.assessment }))); return new Set(matches.map((item) => item.assessment)).size > 1 ? [{ statement, branches: matches, basis: "exact statement with different assessments" }] : []; });
  const unknownSets = summaries.map((summary) => unique([...summary.mission.openQuestions, ...summary.claims.flatMap((claim) => [...claim.missingEvidence, ...claim.uncertainty]), ...summary.experiments.flatMap((entry) => entry.result?.uncertainty ?? [])])); const commonUnknowns = unknownSets.length ? unknownSets[0].filter((item) => unknownSets.slice(1).every((set) => set.includes(item))) : []; const anomalies = summaries.flatMap((summary) => summary.experiments.flatMap((entry) => (entry.result?.unexpectedObservations ?? []).map((observation) => ({ missionId: summary.mission.missionId, experimentId: entry.plan.experimentId, observation }))));
  return { parentMissionId: branches[0].parentMissionId, branches: summaries.map((summary) => ({ missionId: summary.mission.missionId, goal: summary.mission.goal, contributionRole: summary.mission.contributionRole, assumptions: summary.mission.assumptions, competingHypotheses: summary.mission.competingHypotheses, openQuestions: summary.mission.openQuestions, claims: summary.claims.map((claim) => ({ claimId: claim.claimId, statement: claim.statement, assessment: claim.assessment, storyRole: claim.storyRole, cannotSay: claim.cannotSay })), experiments: summary.experiments.map((entry) => ({ experimentId: entry.plan.experimentId, hypothesisRefs: entry.plan.hypothesisRefs, discriminatingObservations: entry.plan.discriminatingObservations, resultKind: entry.result?.kind ?? null, summary: entry.result?.summary ?? null, limitations: entry.result?.limitations ?? [] })) })), consensus, conflicts, conditionalDifferences: summaries.map((summary) => ({ missionId: summary.mission.missionId, assumptions: summary.mission.assumptions, experiments: summary.experiments.map((entry) => ({ experimentId: entry.plan.experimentId, inputs: entry.plan.inputs, comparisons: entry.plan.comparisons, constraints: entry.plan.constraints, limitations: entry.result?.limitations ?? [] })) })), anomalies, commonUnknowns, nextBranchSuggestions: [...conflicts.map((conflict, index) => ({ suggestionId: `conflict-${index + 1}`, branchKind: "alternative", question: `Resolve conflicting assessments for: ${conflict.statement}`, basis: "exact sibling conflict", authorization: "not-granted-by-query" })), ...commonUnknowns.map((question, index) => ({ suggestionId: `unknown-${index + 1}`, branchKind: "follow-up", question, basis: "exact unknown shared by every sibling", authorization: "not-granted-by-query" })), ...anomalies.map((item, index) => ({ suggestionId: `anomaly-${index + 1}`, branchKind: "recovery", question: `Investigate unexpected observation: ${item.observation}`, basis: `Experiment ${item.experimentId}`, authorization: "not-granted-by-query" }))] };
}
function branchSynthesis(context, options) {
  let groups;
  if (options.branchMissionIds !== undefined) { const ids = strings(options.branchMissionIds, "branchMissionIds"); const branches = ids.map((id) => context.missions.find((mission) => mission.missionId === id)); if (branches.some((mission) => !mission)) throw new Error("branchMissionIds contains an unknown Mission."); if (new Set(branches.map((mission) => mission.parentMissionId)).size !== 1 || branches[0].parentMissionId === null) throw new Error("branchMissionIds must select sibling branches with one parent."); groups = [branchGroup(context, branches)]; }
  else { const parents = unique(context.missions.filter((mission) => mission.parentMissionId !== null).map((mission) => mission.parentMissionId)); groups = parents.map((parentId) => branchGroup(context, context.missions.filter((mission) => mission.parentMissionId === parentId))).filter((group) => group.branches.length > 1); }
  const host = hostSection(context, "branchSynthesis"); return { view: "branch-synthesis", groups, lessonsContext: lessonContext(context, groups.flatMap((group) => group.branches.map((branch) => branch.missionId))), hostAnalysis: host, derivationRules: ["Siblings require one exact parent.", "Consensus, conflicts, and common unknowns use exact strings.", "Suggestions never authorize a branch."] };
}
function reviews(context) {
  const host = hostSection(context, "reviews"); return { view: "reviews", reviews: context.reviews, rubricCoverage: unique(context.reviews.flatMap((review) => review.rubric)).map((rubricItem) => ({ rubricItem, reviews: context.reviews.filter((review) => review.rubric.includes(rubricItem)).map((review) => review.reviewId) })), findings: context.reviews.flatMap((review) => review.findings.map((finding) => ({ reviewId: review.reviewId, missionId: review.missionId, finding: clone(finding) }))), actionItems: context.reviews.flatMap((review) => review.actionItems.map((actionItem) => ({ reviewId: review.reviewId, actionItem }))), reports: context.reviews.map((review) => ({ reviewId: review.reviewId, report: review.report, provenance: review.provenance, limitations: review.limitations })), hostAnalysis: host, derivationRules: ["Rubric, report, provenance, findings, and limitations are copied directly.", "Rubric coverage uses exact strings.", "No reviewer authority is established."] };
}
function project(context, view, options) { if (view === "overview") return overview(context); if (view === "diagnosis") return diagnosis(context); if (view === "related-work") return relatedWork(context); if (view === "hypotheses") return hypotheses(context); if (view === "experiment-options") return experimentOptions(context); if (view === "result-synthesis") return resultSynthesis(context); if (view === "claim-story") return claimStory(context); if (view === "branch-synthesis") return branchSynthesis(context, options); if (view === "reviews") return reviews(context); throw new Error(`Unsupported view ${view}.`); }

export function buildResearchContext(model, inputs = {}) {
  sealed(inputs, INPUT_FIELDS, "Research context inputs", false); const normalized = normalizeModel(model, inputs);
  return immutable({ kind: "research-format-1-context", zeroWrite: true, writes: [], ...normalized, boundaries: { format: "dove-research-v1", storeLoading: "caller-or-adapter", queryMutation: "none", semanticAuthority: "host-analysis-required", candidateAuthorization: "none", textSimilarity: "not-used" } });
}
export function queryResearchContext(context, options = {}) {
  sealed(options, QUERY_FIELDS, "Research query options", false); const view = text(options.view, "Research query view"); if (!VIEW_SET.has(view)) throw new Error(`Research query view must be one of: ${RESEARCH_CONTEXT_VIEWS.join(", ")}.`); if (context?.kind !== "research-format-1-context") throw new Error("queryResearchContext requires buildResearchContext output."); const selected = scoped(clone(context), options.missionIds);
  return immutable({ status: "ok", query: true, zeroWrite: true, writes: [], selectedMissionIds: selected.selectedMissionIds, ...project(selected, view, options) });
}
export function buildResearchViews(model, inputs = {}) {
  const context = buildResearchContext(model, inputs); return immutable(Object.fromEntries(RESEARCH_CONTEXT_VIEWS.map((view) => [view, queryResearchContext(context, { view })])));
}
