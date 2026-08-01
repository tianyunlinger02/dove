import crypto from "node:crypto";

export const EXPERIMENT_RECORD_SCHEMA_VERSION = 3;
export const CLAIM_RECORD_SCHEMA_VERSION = 3;

export const CLAIM_ASSESSMENTS = Object.freeze(["supported", "weakened", "refuted", "inconclusive", "blocked"]);
export const EXPERIMENT_RESULT_STATUSES = Object.freeze(["completed", "stopped", "failed", "blocked"]);

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
}
export function evidenceDigest(value) {
  return crypto.createHash("sha256").update(`${JSON.stringify(stable(value))}\n`).digest("hex");
}
function object(value, label) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`); return value; }
function sealed(value, fields, label) { object(value, label); const unknown = Object.keys(value).filter((field) => !fields.has(field)); if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`); return value; }
function text(value, label) { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`); return value.trim(); }
function id(value, label) { const normalized = text(value, label); if (!SAFE_ID.test(normalized)) throw new Error(`${label} must be a safe lowercase identifier.`); return normalized; }
function timestamp(value, label) { const normalized = text(value, label); if (!Number.isFinite(Date.parse(normalized)) || new Date(Date.parse(normalized)).toISOString() !== normalized) throw new Error(`${label} must be an exact ISO-8601 timestamp.`); return normalized; }
function strings(value, label, min = 0) { if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${label} must be an array of non-empty strings.`); const normalized = value.map((item) => item.trim()); if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must not contain duplicates.`); if (normalized.length < min) throw new Error(`${label} must contain at least ${min} item(s).`); return normalized; }
function enumeration(value, values, label) { const normalized = text(value, label); if (!values.includes(normalized)) throw new Error(`${label} is unsupported.`); return normalized; }
function number(value, label) { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`); return value; }

const PROTOCOL_FIELDS = new Set([
  "question", "hypothesis", "procedure", "inputs", "comparisons", "metrics", "successConditions",
  "stopConditions", "constraints", "expectedArtifacts", "frozenAt"
]);
export function normalizeExperimentProtocol(value, label = "protocol") {
  sealed(value, PROTOCOL_FIELDS, label);
  return {
    question: text(value.question, `${label}.question`),
    hypothesis: text(value.hypothesis, `${label}.hypothesis`),
    procedure: strings(value.procedure, `${label}.procedure`, 1),
    inputs: strings(value.inputs, `${label}.inputs`, 1),
    comparisons: strings(value.comparisons, `${label}.comparisons`),
    metrics: strings(value.metrics, `${label}.metrics`, 1),
    successConditions: strings(value.successConditions, `${label}.successConditions`, 1),
    stopConditions: strings(value.stopConditions, `${label}.stopConditions`, 1),
    constraints: strings(value.constraints, `${label}.constraints`),
    expectedArtifacts: strings(value.expectedArtifacts, `${label}.expectedArtifacts`, 1),
    frozenAt: timestamp(value.frozenAt, `${label}.frozenAt`)
  };
}

const DENOMINATOR_FIELDS = new Set(["total", "successful", "failed", "excluded"]);
const FAILURE_FIELDS = new Set(["failureId", "count", "reason", "evidenceRefs"]);
const MEASUREMENT_FIELDS = new Set(["metric", "value", "comparison"]);
const RESULT_FIELDS = new Set([
  "status", "outcome", "measurements", "artifactRefs", "validationRefs", "denominator", "failures",
  "deviations", "limitations", "recordedAt"
]);
export function normalizeExperimentResult(value, label = "result") {
  sealed(value, RESULT_FIELDS, label);
  sealed(value.denominator, DENOMINATOR_FIELDS, `${label}.denominator`);
  const denominator = Object.fromEntries([...DENOMINATOR_FIELDS].map((field) => [field, number(value.denominator[field], `${label}.denominator.${field}`)]));
  if (![...DENOMINATOR_FIELDS].every((field) => Number.isSafeInteger(denominator[field]) && denominator[field] >= 0)) throw new Error(`${label}.denominator counts must be non-negative safe integers.`);
  if (denominator.successful + denominator.failed + denominator.excluded !== denominator.total) throw new Error(`${label}.denominator must account for the full total.`);
  if (!Array.isArray(value.failures)) throw new Error(`${label}.failures must be an array.`);
  const failures = value.failures.map((item, index) => {
    const itemLabel = `${label}.failures[${index}]`; sealed(item, FAILURE_FIELDS, itemLabel);
    const count = number(item.count, `${itemLabel}.count`); if (!Number.isSafeInteger(count) || count < 1) throw new Error(`${itemLabel}.count must be a positive safe integer.`);
    return { failureId: id(item.failureId, `${itemLabel}.failureId`), count, reason: text(item.reason, `${itemLabel}.reason`), evidenceRefs: strings(item.evidenceRefs, `${itemLabel}.evidenceRefs`) };
  });
  if (failures.reduce((sum, item) => sum + item.count, 0) !== denominator.failed + denominator.excluded) throw new Error(`${label}.failures must preserve every failed and excluded item.`);
  if (!Array.isArray(value.measurements)) throw new Error(`${label}.measurements must be an array.`);
  const measurements = value.measurements.map((item, index) => {
    const itemLabel = `${label}.measurements[${index}]`; sealed(item, MEASUREMENT_FIELDS, itemLabel);
    return { metric: text(item.metric, `${itemLabel}.metric`), value: number(item.value, `${itemLabel}.value`), comparison: item.comparison === null ? null : text(item.comparison, `${itemLabel}.comparison`) };
  });
  const keys = measurements.map((item) => `${item.metric}::${item.comparison ?? ""}`);
  if (new Set(keys).size !== keys.length) throw new Error(`${label}.measurements must not duplicate a metric/comparison binding.`);
  const status = enumeration(value.status, EXPERIMENT_RESULT_STATUSES, `${label}.status`);
  const artifactRefs = strings(value.artifactRefs, `${label}.artifactRefs`);
  const validationRefs = strings(value.validationRefs, `${label}.validationRefs`);
  if (denominator.successful > 0 && artifactRefs.length + validationRefs.length === 0) throw new Error(`${label} requires artifactRefs or validationRefs for successful observations.`);
  return {
    status,
    outcome: text(value.outcome, `${label}.outcome`),
    measurements,
    artifactRefs,
    validationRefs,
    denominator,
    failures,
    deviations: strings(value.deviations, `${label}.deviations`),
    limitations: strings(value.limitations, `${label}.limitations`, 1),
    recordedAt: timestamp(value.recordedAt, `${label}.recordedAt`)
  };
}

const EXPERIMENT_EVIDENCE_FIELDS = new Set(["experimentId", "metric", "value", "comparison"]);
const CLAIM_FIELDS = new Set(["experimentEvidence", "uncertainty", "unsupportedExtensions", "currentAssessment"]);
export function normalizeClaimContract(value, label = "claim") {
  sealed(value, CLAIM_FIELDS, label);
  if (!Array.isArray(value.experimentEvidence)) throw new Error(`${label}.experimentEvidence must be an array.`);
  const experimentEvidence = value.experimentEvidence.map((item, index) => {
    const itemLabel = `${label}.experimentEvidence[${index}]`; sealed(item, EXPERIMENT_EVIDENCE_FIELDS, itemLabel);
    return { experimentId: id(item.experimentId, `${itemLabel}.experimentId`), metric: text(item.metric, `${itemLabel}.metric`), value: number(item.value, `${itemLabel}.value`), comparison: item.comparison === null ? null : text(item.comparison, `${itemLabel}.comparison`) };
  });
  const keys = experimentEvidence.map((item) => `${item.experimentId}::${item.metric}::${item.comparison ?? ""}`);
  if (new Set(keys).size !== keys.length) throw new Error(`${label}.experimentEvidence must not duplicate an experiment measurement binding.`);
  const uncertainty = strings(value.uncertainty, `${label}.uncertainty`);
  const unsupportedExtensions = strings(value.unsupportedExtensions, `${label}.unsupportedExtensions`);
  const currentAssessment = enumeration(value.currentAssessment, CLAIM_ASSESSMENTS, `${label}.currentAssessment`);
  return { experimentEvidence, uncertainty, unsupportedExtensions, currentAssessment };
}
