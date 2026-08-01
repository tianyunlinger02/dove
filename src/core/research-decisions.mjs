import crypto from "node:crypto";

export const RESEARCH_DECISION_SCHEMA_VERSION = 5;
export const RESEARCH_DECISION_DISPOSITIONS = Object.freeze(["continue", "stop-satisfied", "stop-low-return", "stop-budget", "reject", "block-needs-user"]);
export const RESEARCH_DECISION_KINDS = RESEARCH_DECISION_DISPOSITIONS;
export const RESEARCH_DECISION_ACTION_KINDS = Object.freeze(["retrieval", "experiment", "analysis", "engineering"]);
export const RESEARCH_HYPOTHESIS_ASSESSMENTS = Object.freeze(["unresolved", "supported", "weakened", "falsified"]);
export const RESEARCH_ROUTE_DISPOSITIONS = Object.freeze(["considered", "selected", "rejected"]);
export const RESEARCH_DECISION_CONTENT_FIELDS = Object.freeze(["synthesis", "hypotheses", "routes", "openQuestions", "evidenceRefs", "consumedReceiptIds", "disposition", "reasonCodes", "nextAction"]);
export const PERSISTED_RESEARCH_DECISION_FIELDS = Object.freeze(["schemaVersion", "decisionId", "decisionDigest", "missionId", "contractDigest", "revision", "predecessorDecisionId", "predecessorDecisionDigest", "createdAt", ...RESEARCH_DECISION_CONTENT_FIELDS]);

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const DISPOSITION_SET = new Set(RESEARCH_DECISION_DISPOSITIONS);
const ACTION_KIND_SET = new Set(RESEARCH_DECISION_ACTION_KINDS);
const ASSESSMENT_SET = new Set(RESEARCH_HYPOTHESIS_ASSESSMENTS);
const ROUTE_DISPOSITION_SET = new Set(RESEARCH_ROUTE_DISPOSITIONS);
const CONTENT_FIELDS = new Set(RESEARCH_DECISION_CONTENT_FIELDS);
const PERSISTED_FIELDS = new Set(PERSISTED_RESEARCH_DECISION_FIELDS);
const CREATE_FIELDS = new Set(["missionId", "contractDigest", "revision", "predecessorDecisionId", "predecessorDecisionDigest", "createdAt", "content"]);
const APPEND_FIELDS = new Set(["missionId", "contractDigest", "predecessorDecisionId", "predecessorDecisionDigest", "createdAt", "content"]);
const HYPOTHESIS_FIELDS = new Set(["hypothesisId", "statement", "assessment", "supportingEvidence", "counterEvidence", "falsificationCondition"]);
const ROUTE_FIELDS = new Set(["routeId", "summary", "disposition", "rationale"]);
const QUESTION_FIELDS = new Set(["questionId", "question"]);
const ACTION_FIELDS = new Set(["actionId", "actionDigest", "kind", "description", "rationale", "targetHypothesisOrQuestionIds", "successConditions", "stopConditions", "expectedEvidence", "budget"]);

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function stableValue(value) { if (Array.isArray(value)) return value.map(stableValue); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)])); return value; }
export function stableResearchDecisionSerialize(value) { return JSON.stringify(stableValue(value)); }
function plain(value, label) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`); }
function sealed(value, fields, label) { plain(value, label); const unknown = Object.keys(value).filter((field) => !fields.has(field)); if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`); }
function exact(value, fields, label) { sealed(value, fields, label); const missing = [...fields].filter((field) => !Object.hasOwn(value, field)); if (missing.length) throw new Error(`${label} requires fields: ${missing.join(", ")}.`); }
function text(value, label) { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`); return value.trim(); }
function safeId(value, label) { const normalized = text(value, label); if (!SAFE_ID.test(normalized)) throw new Error(`${label} must be a safe lowercase identifier.`); return normalized; }
function hash(value, label) { const normalized = text(value, label); if (!HASH.test(normalized)) throw new Error(`${label} must be a lowercase SHA-256 digest.`); return normalized; }
function exactIso(value, label) { if (typeof value !== "string" || !ISO.test(value) || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`); return value; }
function array(value, label) { if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); return value; }
function strings(value, label, minItems = 0) { const result = array(value, label).map((item, index) => text(item, `${label}[${index}]`)); if (result.length < minItems) throw new Error(`${label} must contain at least ${minItems} item(s).`); if (new Set(result).size !== result.length) throw new Error(`${label} must not contain duplicates.`); return result; }
function ids(value, label) { return strings(value, label).map((item, index) => safeId(item, `${label}[${index}]`)); }
function enumValue(value, allowed, label) { const normalized = text(value, label); if (!allowed.has(normalized)) throw new Error(`${label} is unsupported.`); return normalized; }
function unique(items, field, label) { if (new Set(items.map((item) => item[field])).size !== items.length) throw new Error(`${label} identifiers must be unique.`); }
function budget(value, label) { plain(value, label); const result = {}; for (const [dimension, amount] of Object.entries(value)) { if (!/^[a-z][A-Za-z0-9._-]{0,63}$/u.test(dimension)) throw new Error(`${label} has an invalid budget dimension ${dimension}.`); if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`${label}.${dimension} must be a non-negative safe integer.`); result[dimension] = amount; } if (Object.keys(result).length === 0) throw new Error(`${label} must declare at least one dimension.`); return result; }

function normalizeHypothesis(value, index) {
  const label = `hypotheses[${index}]`; exact(value, HYPOTHESIS_FIELDS, label);
  return { hypothesisId: safeId(value.hypothesisId, `${label}.hypothesisId`), statement: text(value.statement, `${label}.statement`), assessment: enumValue(value.assessment, ASSESSMENT_SET, `${label}.assessment`), supportingEvidence: strings(value.supportingEvidence, `${label}.supportingEvidence`), counterEvidence: strings(value.counterEvidence, `${label}.counterEvidence`), falsificationCondition: text(value.falsificationCondition, `${label}.falsificationCondition`) };
}
function normalizeRoute(value, index) { const label = `routes[${index}]`; exact(value, ROUTE_FIELDS, label); return { routeId: safeId(value.routeId, `${label}.routeId`), summary: text(value.summary, `${label}.summary`), disposition: enumValue(value.disposition, ROUTE_DISPOSITION_SET, `${label}.disposition`), rationale: text(value.rationale, `${label}.rationale`) }; }
function normalizeQuestion(value, index) { const label = `openQuestions[${index}]`; exact(value, QUESTION_FIELDS, label); return { questionId: safeId(value.questionId, `${label}.questionId`), question: text(value.question, `${label}.question`) }; }
function actionDigest(value) { const { actionDigest: _actionDigest, ...content } = value; return sha256(stableResearchDecisionSerialize(content)); }
export function normalizeResearchDecisionAction(value, options = {}) {
  const label = options.label ?? "Research decision action"; exact(value, ACTION_FIELDS, label);
  const action = { actionId: safeId(value.actionId, `${label}.actionId`), kind: enumValue(value.kind, ACTION_KIND_SET, `${label}.kind`), description: text(value.description, `${label}.description`), rationale: text(value.rationale, `${label}.rationale`), targetHypothesisOrQuestionIds: ids(value.targetHypothesisOrQuestionIds, `${label}.targetHypothesisOrQuestionIds`), successConditions: strings(value.successConditions, `${label}.successConditions`, 1), stopConditions: strings(value.stopConditions, `${label}.stopConditions`, 1), expectedEvidence: strings(value.expectedEvidence, `${label}.expectedEvidence`, 1), budget: budget(value.budget, `${label}.budget`) };
  const suppliedDigest = hash(value.actionDigest, `${label}.actionDigest`);
  const computedDigest = actionDigest(action);
  if (suppliedDigest !== computedDigest) throw new Error(`${label}.actionDigest does not match its canonical content.`);
  return { ...action, actionDigest: computedDigest };
}
export function createResearchDecisionAction(value) { const content = { ...value }; delete content.actionDigest; const digest = actionDigest(content); return normalizeResearchDecisionAction({ ...content, actionDigest: digest }); }

export function normalizeResearchDecisionContent(value = {}) {
  exact(value, CONTENT_FIELDS, "Research decision content");
  const hypotheses = array(value.hypotheses, "hypotheses").map(normalizeHypothesis);
  const routes = array(value.routes, "routes").map(normalizeRoute);
  const openQuestions = array(value.openQuestions, "openQuestions").map(normalizeQuestion);
  unique(hypotheses, "hypothesisId", "Hypothesis"); unique(routes, "routeId", "Route"); unique(openQuestions, "questionId", "Open question");
  const evidenceRefs = strings(value.evidenceRefs, "evidenceRefs");
  const consumedReceiptIds = ids(value.consumedReceiptIds, "consumedReceiptIds");
  const disposition = enumValue(value.disposition, DISPOSITION_SET, "disposition");
  const reasonCodes = ids(value.reasonCodes, "reasonCodes");
  const nextAction = value.nextAction === null ? null : normalizeResearchDecisionAction(value.nextAction, { label: "nextAction" });
  const targetIds = new Set([...hypotheses.map((item) => item.hypothesisId), ...openQuestions.map((item) => item.questionId)]);
  if (nextAction && nextAction.targetHypothesisOrQuestionIds.length === 0) throw new Error("nextAction must target at least one open question or hypothesis.");
  if (nextAction?.targetHypothesisOrQuestionIds.some((id) => !targetIds.has(id))) throw new Error("nextAction targets an unknown hypothesis or open question.");
  if (disposition === "continue" && nextAction === null) throw new Error("A continue decision requires one nextAction.");
  if (disposition !== "continue" && nextAction !== null) throw new Error(`Decision disposition ${disposition} must not retain nextAction.`);
  if (disposition !== "continue" && reasonCodes.length === 0) throw new Error(`Decision disposition ${disposition} requires reasonCodes.`);
  if (routes.filter((route) => route.disposition === "selected").length > 1) throw new Error("Research decision may select at most one route.");
  const changedHypotheses = hypotheses.filter((hypothesis) => hypothesis.assessment !== "unresolved");
  for (const hypothesis of changedHypotheses) {
    const refs = [...hypothesis.supportingEvidence, ...hypothesis.counterEvidence];
    if (refs.length === 0 || refs.some((reference) => !evidenceRefs.includes(reference))) throw new Error(`Hypothesis ${hypothesis.hypothesisId} assessment requires current decision evidenceRefs.`);
  }
  if (disposition === "stop-satisfied" && (evidenceRefs.length === 0 || consumedReceiptIds.length === 0)) throw new Error("stop-satisfied requires current evidence and consumed receipts.");
  return { synthesis: text(value.synthesis, "synthesis"), hypotheses, routes, openQuestions, evidenceRefs, consumedReceiptIds, disposition, reasonCodes, nextAction };
}

function envelope(value, label) {
  const missionId = safeId(value.missionId, `${label}.missionId`); const contractDigest = hash(value.contractDigest, `${label}.contractDigest`);
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error(`${label}.revision must be a positive safe integer.`);
  const predecessorDecisionId = value.predecessorDecisionId === null ? null : safeId(value.predecessorDecisionId, `${label}.predecessorDecisionId`);
  const predecessorDecisionDigest = value.predecessorDecisionDigest === null ? null : hash(value.predecessorDecisionDigest, `${label}.predecessorDecisionDigest`);
  if ((value.revision === 1) !== (predecessorDecisionId === null && predecessorDecisionDigest === null)) throw new Error(`${label} predecessor binding does not match revision.`);
  return { missionId, contractDigest, revision: value.revision, predecessorDecisionId, predecessorDecisionDigest, createdAt: exactIso(value.createdAt, `${label}.createdAt`), content: normalizeResearchDecisionContent(value.content ?? Object.fromEntries(RESEARCH_DECISION_CONTENT_FIELDS.map((field) => [field, value[field]]))) };
}
export function researchDecisionDigest(value) { const normalized = envelope(value, "Research decision digest input"); return sha256(stableResearchDecisionSerialize({ schemaVersion: RESEARCH_DECISION_SCHEMA_VERSION, missionId: normalized.missionId, contractDigest: normalized.contractDigest, revision: normalized.revision, predecessorDecisionId: normalized.predecessorDecisionId, predecessorDecisionDigest: normalized.predecessorDecisionDigest, createdAt: normalized.createdAt, ...normalized.content })); }
export function researchDecisionId(missionId, revision, decisionDigest) { return `research-decision-${sha256(stableResearchDecisionSerialize({ missionId: safeId(missionId, "missionId"), revision, decisionDigest: hash(decisionDigest, "decisionDigest") })).slice(0, 24)}`; }
export function createResearchDecision(args = {}) { exact(args, CREATE_FIELDS, "createResearchDecision"); const normalized = envelope(args, "Research decision"); const decisionDigest = researchDecisionDigest({ ...normalized, content: normalized.content }); return { schemaVersion: RESEARCH_DECISION_SCHEMA_VERSION, decisionId: researchDecisionId(normalized.missionId, normalized.revision, decisionDigest), decisionDigest, missionId: normalized.missionId, contractDigest: normalized.contractDigest, revision: normalized.revision, predecessorDecisionId: normalized.predecessorDecisionId, predecessorDecisionDigest: normalized.predecessorDecisionDigest, createdAt: normalized.createdAt, ...normalized.content }; }
export function validatePersistedResearchDecision(value, options = {}) { exact(value, PERSISTED_FIELDS, options.label ?? "Research decision"); if (value.schemaVersion !== RESEARCH_DECISION_SCHEMA_VERSION) throw new Error(`${options.label ?? "Research decision"} has an unsupported schemaVersion.`); const normalized = envelope(value, options.label ?? "Research decision"); const computedDigest = researchDecisionDigest({ ...normalized, content: normalized.content }); if (value.decisionDigest !== computedDigest || value.decisionId !== researchDecisionId(normalized.missionId, normalized.revision, computedDigest)) throw new Error(`${options.label ?? "Research decision"} does not match its canonical content.`); for (const field of ["missionId", "contractDigest"]) if (options[field] !== undefined && normalized[field] !== options[field]) throw new Error(`${options.label ?? "Research decision"}.${field} does not match the expected binding.`); return { schemaVersion: RESEARCH_DECISION_SCHEMA_VERSION, decisionId: value.decisionId, decisionDigest: computedDigest, missionId: normalized.missionId, contractDigest: normalized.contractDigest, revision: normalized.revision, predecessorDecisionId: normalized.predecessorDecisionId, predecessorDecisionDigest: normalized.predecessorDecisionDigest, createdAt: normalized.createdAt, ...normalized.content }; }
export function validateResearchDecisionChain(decisions, options = {}) {
  const normalized = array(decisions, "Research decision chain").map((decision, index) => validatePersistedResearchDecision(decision, { label: `${options.label ?? "Research decision chain"}[${index}]`, missionId: options.missionId, contractDigest: options.contractDigest }));
  if (normalized.length === 0) return [];
  unique(normalized, "decisionId", "Research decision"); unique(normalized, "revision", "Research decision revision");
  const byId = new Map(normalized.map((item) => [item.decisionId, item])); const successors = new Set();
  for (const item of normalized) { if (item.revision === 1) continue; const predecessor = byId.get(item.predecessorDecisionId); if (!predecessor || predecessor.decisionDigest !== item.predecessorDecisionDigest || item.revision !== predecessor.revision + 1) throw new Error("Research decision chain has an invalid predecessor binding."); if (successors.has(predecessor.decisionId)) throw new Error("Research decision chain must not fork."); successors.add(predecessor.decisionId); }
  const sorted = [...normalized].sort((a, b) => a.revision - b.revision); if (sorted[0].revision !== 1 || sorted.at(-1).revision !== sorted.length) throw new Error("Research decision revisions must be contiguous from 1."); return sorted;
}
export function currentResearchDecisionHead(decisions, options = {}) { return validateResearchDecisionChain(decisions, options).at(-1) ?? null; }
export function appendResearchDecision(decisions, args = {}) { exact(args, APPEND_FIELDS, "appendResearchDecision"); const chain = validateResearchDecisionChain(decisions, { missionId: args.missionId, contractDigest: args.contractDigest }); const head = chain.at(-1) ?? null; if ((args.predecessorDecisionId ?? null) !== (head?.decisionId ?? null) || (args.predecessorDecisionDigest ?? null) !== (head?.decisionDigest ?? null)) throw new Error("Research decision append rejected a stale predecessor."); const decision = createResearchDecision({ missionId: args.missionId, contractDigest: args.contractDigest, revision: (head?.revision ?? 0) + 1, predecessorDecisionId: head?.decisionId ?? null, predecessorDecisionDigest: head?.decisionDigest ?? null, createdAt: args.createdAt, content: args.content }); return validateResearchDecisionChain([...chain, decision]); }
export function researchDecisionNarrativeDirective(value) { const decision = validatePersistedResearchDecision(value); if (decision.nextAction) return Object.freeze({ mode: "authorized-action" }); if (decision.disposition === "stop-satisfied") return Object.freeze({ mode: "stop-reason", text: decision.synthesis }); return Object.freeze({ mode: "next-step", text: decision.disposition === "block-needs-user" ? "Resolve the recorded user decision before continuing." : "Reevaluate the current evidence before authorizing another action." }); }
