import crypto from "node:crypto";

import { assertExecutionFactText } from "./execution-facts.mjs";
import { validatePersistedResearchDecision } from "./research-decisions.mjs";

export const RESEARCH_HANDOFF_SCHEMA_VERSION = 2;
export const RESEARCH_HANDOFF_BINDING_FIELDS = Object.freeze(["missionId", "contractDigest", "decisionDigest"]);
export const RESEARCH_HOST_OUTCOME_STATUSES = Object.freeze(["completed", "stopped", "aborted", "blocked", "failed"]);

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const OUTCOME_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const STATUS_SET = new Set(RESEARCH_HOST_OUTCOME_STATUSES);
const ENVELOPE_FIELDS = new Set(["schemaVersion", "envelopeId", ...RESEARCH_HANDOFF_BINDING_FIELDS, "actionId", "actionDigest", "budget", "expectedEvidence", "issuedAt", "expiresAt", "supersedesEnvelopeId", "seal"]);
const OUTCOME_FIELDS = new Set(["status", "performedActionCount", "actualUsage", "evidenceReturned", "facts", "claims", "startedAt", "finishedAt"]);
const CURRENT_FIELDS = new Set([...RESEARCH_HANDOFF_BINDING_FIELDS, "currentEnvelopeId", "supersededEnvelopeIds", "now"]);

function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])); return value; }
function sha256(value) { return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex"); }
function plain(value, label) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`); }
function sealed(value, fields, label) { plain(value, label); const unknown = Object.keys(value).filter((field) => !fields.has(field)); if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`); }
function text(value, label) { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`); return value.trim(); }
function safeId(value, label) { const result = text(value, label); if (!SAFE_ID.test(result)) throw new Error(`${label} must be a safe lowercase identifier.`); return result; }
function hash(value, label) { const result = text(value, label); if (!HASH.test(result)) throw new Error(`${label} must be a lowercase SHA-256 digest.`); return result; }
function exactIso(value, label) { if (typeof value !== "string" || !ISO.test(value) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`); return value; }
function outcomeIso(value, label) { if (typeof value !== "string" || !OUTCOME_TIME.test(value)) throw new Error(`${label} must be an ISO-8601 UTC timestamp with seconds and optional milliseconds.`); const result = new Date(Date.parse(value)).toISOString(); if (result !== (value.includes(".") ? value : value.replace("Z", ".000Z"))) throw new Error(`${label} must be an ISO-8601 UTC timestamp.`); return result; }
function strings(value, label) { if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); const result = value.map((item, index) => text(item, `${label}[${index}]`)); if (new Set(result).size !== result.length) throw new Error(`${label} must not contain duplicates.`); return result; }
function budget(value, label, allowEmpty = false) { plain(value, label); const result = {}; for (const [dimension, amount] of Object.entries(value)) { if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`${label}.${dimension} must be a non-negative safe integer.`); result[dimension] = amount; } if (!allowEmpty && Object.keys(result).length === 0) throw new Error(`${label} must declare at least one dimension.`); return result; }

function normalizeEnvelope(value) {
  sealed(value, ENVELOPE_FIELDS, "Research handoff");
  if (value.schemaVersion !== RESEARCH_HANDOFF_SCHEMA_VERSION) throw new Error("Research handoff has an unsupported schemaVersion.");
  const result = { schemaVersion: RESEARCH_HANDOFF_SCHEMA_VERSION, envelopeId: safeId(value.envelopeId, "Research handoff envelopeId"), missionId: safeId(value.missionId, "Research handoff missionId"), contractDigest: hash(value.contractDigest, "Research handoff contractDigest"), decisionDigest: hash(value.decisionDigest, "Research handoff decisionDigest"), actionId: safeId(value.actionId, "Research handoff actionId"), actionDigest: hash(value.actionDigest, "Research handoff actionDigest"), budget: budget(value.budget, "Research handoff budget"), expectedEvidence: strings(value.expectedEvidence, "Research handoff expectedEvidence"), issuedAt: exactIso(value.issuedAt, "Research handoff issuedAt"), expiresAt: exactIso(value.expiresAt, "Research handoff expiresAt"), supersedesEnvelopeId: value.supersedesEnvelopeId === null ? null : safeId(value.supersedesEnvelopeId, "Research handoff supersedesEnvelopeId"), seal: hash(value.seal, "Research handoff seal") };
  if (Date.parse(result.expiresAt) <= Date.parse(result.issuedAt)) throw new Error("Research handoff expiresAt must be later than issuedAt.");
  const { seal, ...payload } = result; if (seal !== sha256(payload)) throw new Error("Research handoff seal does not match its content."); return result;
}

export function createResearchHandoff(value, options = {}) {
  const decision = validatePersistedResearchDecision(value, { label: "Research handoff decision" });
  if (!decision.nextAction) throw new Error("Research handoff decision must contain one nextAction.");
  const issuedAt = exactIso(options.issuedAt, "Research handoff issuedAt"); const expiresAt = exactIso(options.expiresAt, "Research handoff expiresAt");
  const envelope = { schemaVersion: RESEARCH_HANDOFF_SCHEMA_VERSION, envelopeId: options.envelopeId ?? `research-handoff-${sha256({ decisionDigest: decision.decisionDigest, issuedAt, expiresAt }).slice(0, 24)}`, missionId: decision.missionId, contractDigest: decision.contractDigest, decisionDigest: decision.decisionDigest, actionId: decision.nextAction.actionId, actionDigest: decision.nextAction.actionDigest, budget: decision.nextAction.budget, expectedEvidence: decision.nextAction.expectedEvidence, issuedAt, expiresAt, supersedesEnvelopeId: options.supersedesEnvelopeId ?? null };
  return Object.freeze({ ...envelope, seal: sha256(envelope) });
}
export function validateResearchHandoff(value, current = {}) {
  const envelope = normalizeEnvelope(value); sealed(current, CURRENT_FIELDS, "Current research bindings"); const now = exactIso(current.now, "Current research bindings.now");
  for (const field of RESEARCH_HANDOFF_BINDING_FIELDS) if (current[field] !== envelope[field]) throw new Error(`Research handoff is stale: ${field} changed.`);
  if (current.currentEnvelopeId !== envelope.envelopeId || (current.supersededEnvelopeIds ?? []).includes(envelope.envelopeId)) throw new Error("Research handoff is superseded.");
  if (Date.parse(now) < Date.parse(envelope.issuedAt) || Date.parse(now) >= Date.parse(envelope.expiresAt)) throw new Error("Research handoff is expired.");
  return Object.freeze(envelope);
}
export function validateResearchHostOutcome(envelopeValue, outcomeValue, current = {}) {
  const envelope = validateResearchHandoff(envelopeValue, current); sealed(outcomeValue, OUTCOME_FIELDS, "Host outcome");
  const status = text(outcomeValue.status, "Host outcome status"); if (!STATUS_SET.has(status)) throw new Error("Host outcome status is unsupported.");
  if (!Number.isSafeInteger(outcomeValue.performedActionCount) || outcomeValue.performedActionCount < 0) throw new Error("performedActionCount must be a non-negative safe integer.");
  const actualUsage = budget(outcomeValue.actualUsage, "Host outcome actualUsage", true); if (actualUsage.actions !== outcomeValue.performedActionCount) throw new Error("actualUsage.actions must equal performedActionCount.");
  const missingDimensions = Object.keys(envelope.budget).filter((dimension) => !Object.hasOwn(actualUsage, dimension)); if (missingDimensions.length) throw new Error(`actualUsage must report every budget dimension: ${missingDimensions.join(", ")}.`);
  const evidenceReturned = strings(outcomeValue.evidenceReturned, "Host outcome evidenceReturned"); const expected = new Set(envelope.expectedEvidence);
  const unexpectedEvidence = evidenceReturned.filter((item) => !expected.has(item)); const missingRequiredEvidence = envelope.expectedEvidence.filter((item) => !evidenceReturned.includes(item));
  const facts = strings(outcomeValue.facts, "Host outcome facts").map((fact, index) => assertExecutionFactText(fact, `Host outcome facts[${index}]`));
  if ((outcomeValue.claims ?? []).length) throw new Error("Host outcome cannot declare scientific claims.");
  const startedAt = outcomeIso(outcomeValue.startedAt, "Host outcome startedAt"); const finishedAt = outcomeIso(outcomeValue.finishedAt, "Host outcome finishedAt");
  if (Date.parse(finishedAt) < Date.parse(startedAt) || Date.parse(startedAt) < Date.parse(envelope.issuedAt) || Date.parse(finishedAt) >= Date.parse(envelope.expiresAt) || Date.parse(finishedAt) > Date.parse(current.now)) throw new Error("Host outcome execution interval falls outside the sealed handoff window.");
  const scopeDeviationReasons = [...(outcomeValue.performedActionCount > 1 ? ["performed-action-count-exceeded"] : []), ...Object.entries(actualUsage).filter(([dimension, amount]) => !Object.hasOwn(envelope.budget, dimension) || amount > envelope.budget[dimension]).map(([dimension]) => `budget-exceeded:${dimension}`), ...unexpectedEvidence.map((item) => `unexpected-evidence:${item}`)];
  return Object.freeze({ valid: scopeDeviationReasons.length === 0, status, performedActionCount: outcomeValue.performedActionCount, actualUsage: Object.freeze(actualUsage), evidenceReturned: Object.freeze(evidenceReturned), facts: Object.freeze(facts), claims: Object.freeze([]), startedAt, finishedAt, scopeDeviation: scopeDeviationReasons.length > 0, scopeDeviationReasons: Object.freeze(scopeDeviationReasons), missingRequiredEvidence: Object.freeze(missingRequiredEvidence), scientificConclusionAuthorized: false });
}
