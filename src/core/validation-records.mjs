export const VALIDATION_RESULTS = Object.freeze(["passed", "failed", "incomplete"]);
export const VALIDATION_LEVELS = Object.freeze(["static", "unit", "contract", "integration", "e2e"]);
export const VALIDATION_PRODUCER_KINDS = Object.freeze(["host-observed", "dove-internal"]);
export const VALIDATION_KINDS = Object.freeze(["test-log", "typecheck-log", "lint-log", "build-log", "audit-log", "validation-log", "command-output"]);
export const VALIDATION_FIELDS = Object.freeze(["kind", "result", "level", "producerKind", "producerOperation", "observedExitStatus", "targetReference", "targetHash", "reference", "outputHash"]);

const RESULT_SET = new Set(VALIDATION_RESULTS);
const LEVEL_SET = new Set(VALIDATION_LEVELS);
const PRODUCER_KIND_SET = new Set(VALIDATION_PRODUCER_KINDS);
const KIND_SET = new Set(VALIDATION_KINDS);
const HASH = /^[0-9a-f]{64}$/u;
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;

function exactString(value, label) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) throw new Error(`${label} must be a canonical non-empty string.`);
  return value;
}

function exactHash(value, label) {
  const normalized = exactString(value, label);
  if (!HASH.test(normalized)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return normalized;
}

function exactSafeId(value, label) {
  const normalized = exactString(value, label);
  if (!SAFE_ID.test(normalized)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized;
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}

function assertFields(value, fields, label) {
  assertObject(value, label);
  const allowed = new Set(fields);
  const unknown = Object.keys(value).filter((field) => !allowed.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}

function exactExitStatus(value, label) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > 255) throw new Error(`${label} must be an integer from 0 through 255, or null when no exit status was observed.`);
  return value;
}

export function createValidationRecord(value, options = {}) {
  const label = options.label ?? "validation";
  assertFields(value, VALIDATION_FIELDS, label);
  const kind = exactString(value.kind, `${label}.kind`);
  if (!KIND_SET.has(kind)) throw new Error(`${label}.kind must be one of: ${VALIDATION_KINDS.join(", ")}.`);
  const result = exactString(value.result, `${label}.result`);
  if (!RESULT_SET.has(result)) throw new Error(`${label}.result must be one of: ${VALIDATION_RESULTS.join(", ")}.`);
  const level = exactString(value.level, `${label}.level`);
  if (!LEVEL_SET.has(level)) throw new Error(`${label}.level must be one of: ${VALIDATION_LEVELS.join(", ")}.`);
  const producerKind = exactString(value.producerKind, `${label}.producerKind`);
  if (!PRODUCER_KIND_SET.has(producerKind)) throw new Error(`${label}.producerKind must be one of: ${VALIDATION_PRODUCER_KINDS.join(", ")}.`);
  const producerOperation = exactSafeId(value.producerOperation, `${label}.producerOperation`);
  const observedExitStatus = exactExitStatus(value.observedExitStatus, `${label}.observedExitStatus`);
  const targetReference = exactString(value.targetReference, `${label}.targetReference`);
  const targetHash = exactHash(value.targetHash, `${label}.targetHash`);
  const reference = exactString(value.reference, `${label}.reference`);
  const outputHash = exactHash(value.outputHash, `${label}.outputHash`);
  if (result === "passed" && observedExitStatus !== null && observedExitStatus !== 0) throw new Error(`${label}.result passed conflicts with a non-zero observedExitStatus.`);
  if (result === "failed" && observedExitStatus === 0) throw new Error(`${label}.result failed conflicts with observedExitStatus 0.`);
  return Object.freeze({ kind, result, level, producerKind, producerOperation, observedExitStatus, targetReference, targetHash, reference, outputHash });
}

export function validationContributesToCompletion(validation) {
  return validation?.result === "passed";
}
