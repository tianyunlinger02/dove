import fs from "node:fs";
import path from "node:path";

import { artifactEvidenceRole, inspectDeclaredPath, normalizeProjectRelativePath } from "./artifact-integrity.mjs";
import { assessMissionCompletion } from "./completion-gates.mjs";
import { assertCurrentMissionContract, missionCompletionCriteria } from "./mission-contracts.mjs";
import { currentMutationContext, isPatchPlanMode } from "./mutation-backend.mjs";
import { sha256File } from "./review-artifact-snapshot.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { assertNotDoveLessonArtifactPath } from "./domain-artifacts.mjs";
import { assertReceiptAppendable, deriveArtifactReferences, EXECUTION_RECEIPT_SCHEMA_VERSION } from "./receipt-ledger.mjs";
import { evaluateNoteReferences, evaluateSourceReferences } from "./source-trust.mjs";
import { assertGovernanceMutationRegistered, readJson, writeJson } from "./workspace.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

export { EXECUTION_RECEIPT_SCHEMA_VERSION };
export const EXECUTION_RECEIPT_ARTIFACT_KINDS = Object.freeze(["report", "document", "code", "data", "figure", "media", "other"]);
export const EXECUTION_RECEIPT_VALIDATION_KINDS = Object.freeze(["test-log", "typecheck-log", "lint-log", "build-log", "audit-log", "validation-log", "command-output"]);

const ARTIFACT_KIND_SET = new Set(EXECUTION_RECEIPT_ARTIFACT_KINDS);
const VALIDATION_KIND_SET = new Set(EXECUTION_RECEIPT_VALIDATION_KINDS);
const TOP_LEVEL_FIELDS = new Set([
  "receiptId",
  "missionId",
  "contractDigest",
  "summary",
  "artifacts",
  "validations",
  "criteriaSatisfied",
  "producedAt"
]);
const ARTIFACT_FIELDS = new Set(["path", "kind", "sha256"]);
const VALIDATION_FIELDS = new Set(["kind", "reference", "outputHash"]);
const CRITERION_FIELDS = new Set(["criterionId", "evidenceRefs"]);
const RECEIPT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const EVIDENCE_REF_PATTERN = /^(artifact|validation|source|note):(.+)$/u;
const POST_COMMIT_ASSESSMENT_FIELDS = new Set(["kind", "missionId"]);
const POST_COMMIT_ASSESSMENT_KIND = "assess-mission-completion";

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}

function assertAllowedFields(value, allowed, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function hashString(value, label) {
  const hash = nonEmptyString(value, label).toLowerCase();
  if (!HASH_PATTERN.test(hash)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  }
  return hash;
}

function safeId(value, label) {
  const id = nonEmptyString(value, label);
  if (!RECEIPT_ID_PATTERN.test(id)) {
    throw new Error(`${label} must start with a lowercase letter or digit and contain only lowercase letters, digits, dot, underscore, or hyphen.`);
  }
  return id;
}

function parseProducedAt(value) {
  const producedAt = nonEmptyString(value, "producedAt");
  const timestamp = Date.parse(producedAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== producedAt) {
    throw new Error("producedAt must be an exact ISO-8601 timestamp.");
  }
  return producedAt;
}

export function executionReceiptPath(receiptId) {
  return path.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
}

export function missionContractPath(missionId) {
  return path.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}

function inspectHashedFile(root, rawPath, expectedHash, label) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    throw new Error(`${label} has an unsafe path ${JSON.stringify(rawPath)}: ${normalized.reason}.`);
  }
  if (normalized.normalizedPath !== rawPath.trim().replace(/\\/gu, "/")) {
    throw new Error(`${label} path must be canonical: ${rawPath}.`);
  }
  const inspection = inspectDeclaredPath(root, normalized.normalizedPath, { requireNonEmpty: true });
  if (inspection.status !== "existing") {
    throw new Error(`${label} must be a safe existing non-empty regular file: ${normalized.normalizedPath} (${inspection.reason ?? inspection.status}).`);
  }
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath !== normalized.normalizedPath) {
    throw new Error(`${label} must use its canonical realpath-contained path; alias ${normalized.normalizedPath} resolves to ${canonicalPath}.`);
  }
  const actualHash = sha256File(path.resolve(root, canonicalPath));
  if (actualHash !== expectedHash) {
    throw new Error(`${label} SHA-256 mismatch for ${canonicalPath}.`);
  }
  return { path: canonicalPath, sha256: actualHash };
}

function normalizeArtifacts(root, mission, value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("artifacts must contain at least one artifact.");
  }
  const seen = new Set();
  const artifacts = value.map((item, index) => {
    const label = `artifacts[${index}]`;
    assertAllowedFields(item, ARTIFACT_FIELDS, label);
    const rawPath = nonEmptyString(item.path, `${label}.path`);
    const kind = nonEmptyString(item.kind, `${label}.kind`);
    if (!ARTIFACT_KIND_SET.has(kind)) {
      throw new Error(`${label}.kind must be one of: ${EXECUTION_RECEIPT_ARTIFACT_KINDS.join(", ")}.`);
    }
    const sha256 = hashString(item.sha256, `${label}.sha256`);
    const inspected = inspectHashedFile(root, rawPath, sha256, label);
    assertNotDoveLessonArtifactPath(inspected.path, `${label}.path`);
    if (seen.has(inspected.path)) throw new Error(`artifacts contains duplicate canonical path ${inspected.path}.`);
    seen.add(inspected.path);
    return { path: inspected.path, kind, sha256 };
  });
  const requiredArtifacts = new Set([
    ...(Array.isArray(mission.targetArtifacts) ? mission.targetArtifacts : []),
    ...(Array.isArray(mission.expectedArtifacts) ? mission.expectedArtifacts : [])
  ]);
  const missing = [...requiredArtifacts].filter((artifactPath) => !seen.has(artifactPath));
  if (missing.length > 0) {
    throw new Error(`artifacts is missing mission target or expected artifacts: ${missing.join(", ")}.`);
  }
  return artifacts;
}

function normalizeValidations(root, value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("validations must be an array.");
  const seen = new Set();
  return value.map((item, index) => {
    const label = `validations[${index}]`;
    assertAllowedFields(item, VALIDATION_FIELDS, label);
    const kind = nonEmptyString(item.kind, `${label}.kind`);
    if (!VALIDATION_KIND_SET.has(kind)) {
      throw new Error(`${label}.kind must be one of: ${EXECUTION_RECEIPT_VALIDATION_KINDS.join(", ")}.`);
    }
    const reference = nonEmptyString(item.reference, `${label}.reference`);
    const outputHash = hashString(item.outputHash, `${label}.outputHash`);
    const inspected = inspectHashedFile(root, reference, outputHash, label);
    assertNotDoveLessonArtifactPath(inspected.path, `${label}.reference`);
    const evidenceRole = artifactEvidenceRole(inspected.path);
    if (evidenceRole === "bookkeeping") {
      throw new Error(`${label}.reference must be validation output rather than Dove bookkeeping: ${inspected.path}.`);
    }
    if (seen.has(inspected.path)) throw new Error(`validations contains duplicate canonical reference ${inspected.path}.`);
    seen.add(inspected.path);
    return { kind, reference: inspected.path, outputHash };
  });
}

function typedReferenceEvaluation(root, missionId, reference) {
  const match = EVIDENCE_REF_PATTERN.exec(reference);
  if (!match) return { eligible: false, reason: "unknown-evidence-reference-kind" };
  const [, kind, value] = match;
  if (kind === "source") {
    return evaluateSourceReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-source" };
  }
  if (kind === "note") {
    return evaluateNoteReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-note" };
  }
  return { eligible: null, kind, value };
}

function normalizeCriteria(root, mission, value, artifacts, validations) {
  const requiredCriteria = missionCompletionCriteria(mission);
  if (!Array.isArray(value)) throw new Error("criteriaSatisfied must be an array.");
  const requiredIds = new Set(requiredCriteria.map((item) => item.criterionId));
  const artifactRefs = new Set(artifacts.map((artifact) => `artifact:${artifact.path}`));
  const validationRefs = new Set(validations.map((validation) => `validation:${validation.reference}`));
  const seen = new Set();
  const criteria = value.map((item, index) => {
    const label = `criteriaSatisfied[${index}]`;
    assertAllowedFields(item, CRITERION_FIELDS, label);
    const criterionId = nonEmptyString(item.criterionId, `${label}.criterionId`);
    if (!requiredIds.has(criterionId)) throw new Error(`${label}.criterionId is unknown for the current mission: ${criterionId}.`);
    if (seen.has(criterionId)) throw new Error(`criteriaSatisfied contains duplicate criterionId ${criterionId}.`);
    seen.add(criterionId);
    if (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0) {
      throw new Error(`${label}.evidenceRefs must contain at least one resolvable evidence reference; summary is not evidence.`);
    }
    const evidenceRefs = item.evidenceRefs.map((reference, evidenceIndex) => {
      const normalized = nonEmptyString(reference, `${label}.evidenceRefs[${evidenceIndex}]`);
      if (artifactRefs.has(normalized) || validationRefs.has(normalized)) return normalized;
      const evaluation = typedReferenceEvaluation(root, mission.missionId, normalized);
      if (evaluation.eligible === true) return normalized;
      throw new Error(`${label}.evidenceRefs[${evidenceIndex}] is not current eligible typed evidence: ${normalized} (${evaluation.reason ?? "unresolved"}).`);
    });
    if (new Set(evidenceRefs).size !== evidenceRefs.length) throw new Error(`${label}.evidenceRefs contains duplicates.`);
    return { criterionId, evidenceRefs };
  });
  const missing = requiredCriteria.filter((item) => !seen.has(item.criterionId));
  if (missing.length > 0) {
    throw new Error(`criteriaSatisfied is missing mission completion criteria: ${missing.map((item) => item.criterionId).join(", ")}.`);
  }
  return criteria;
}

export function validateExecutionReceipt(root, args = {}) {
  const workspace = openDoveWorkspace(root, { operation: "Execution receipt validation" });
  assertAllowedFields(args, TOP_LEVEL_FIELDS, "ingest_execution_receipt");
  const receiptId = safeId(args.receiptId, "receiptId");
  const missionId = safeId(args.missionId, "missionId");
  const contractDigest = hashString(args.contractDigest, "contractDigest");
  const summary = nonEmptyString(args.summary, "summary");
  const producedAt = parseProducedAt(args.producedAt);
  const missionRelativePath = missionContractPath(missionId);
  if (!fs.existsSync(path.resolve(root, missionRelativePath))) {
    throw new Error(`Mission does not exist: ${missionId}.`);
  }
  const mission = readJson(root, missionRelativePath, null);
  if (!mission || mission.missionId !== missionId) throw new Error(`Mission contract is malformed or mismatched: ${missionId}.`);
  const currentContract = assertCurrentMissionContract(mission);
  if (mission.workspaceId !== workspace.manifest.workspaceId) throw new Error(`Mission contract workspaceId does not match the current workspace for ${missionId}.`);
  if (contractDigest !== currentContract.contractDigest) throw new Error(`contractDigest does not match the current mission contract for ${missionId}.`);
  const receiptRelativePath = executionReceiptPath(receiptId);
  const mutationContext = currentMutationContext(root);
  if (mutationContext) {
    mutationContext.requireCommitPrecondition(ARTIFACT_PATHS.executionReceiptsDir);
    mutationContext.requireCommitLock(".dove/.receipt-ledger-append.lock", { label: "Execution receipt ledger append lock" });
  }
  if (mutationContext ? mutationContext.fileExists(receiptRelativePath) : fs.existsSync(path.resolve(root, receiptRelativePath))) {
    throw new Error(`Execution receipt id is already occupied: ${receiptId}.`);
  }
  const artifacts = normalizeArtifacts(root, mission, args.artifacts);
  const validations = normalizeValidations(root, args.validations);
  const criteriaSatisfied = normalizeCriteria(root, mission, args.criteriaSatisfied, artifacts, validations);
  const baseReceipt = {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    receiptId,
    ledgerSequence: workspace.receiptLedger.nextLedgerSequence,
    missionId,
    contractDigest,
    summary,
    artifacts,
    validations,
    criteriaSatisfied,
    producedAt,
    recordedAt: new Date().toISOString(),
    producer: { kind: "public-execution", actionId: "ingest-execution-receipt" }
  };
  const receipt = { ...baseReceipt, artifacts: deriveArtifactReferences(baseReceipt) };
  assertReceiptAppendable(workspace.receiptLedger, receipt);
  return { mission, receipt };
}

export function ingestExecutionReceipt(root, args = {}) {
  assertGovernanceMutationRegistered("ingest-execution-receipt", "guarded");
  const mutationContext = currentMutationContext(root);
  if (!mutationContext) throw new Error("ingest_execution_receipt requires an active MutationContext.");
  const { receipt } = validateExecutionReceipt(root, args);
  writeJson(root, executionReceiptPath(receipt.receiptId), receipt);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "ingest-planned" : "ingested",
    receipt,
    completion: { missionId: receipt.missionId, assessWith: "assess_mission_completion", assessment: null },
    postCommit: plannedOnly ? null : { kind: POST_COMMIT_ASSESSMENT_KIND, missionId: receipt.missionId },
    mutation: {
      mutationMode: mutationContext.mutationMode,
      writesApplied: !plannedOnly,
      paths: [executionReceiptPath(receipt.receiptId)]
    }
  };
}

export function resolveExecutionReceiptPostCommit(root, result, options = {}) {
  if (!result || typeof result !== "object" || Array.isArray(result) || !Object.hasOwn(result, "postCommit")) return result;
  const unknownOptions = Object.keys(options).filter((field) => field !== "committed");
  if (unknownOptions.length > 0) throw new Error(`Execution receipt post-commit resolution does not accept unknown options: ${unknownOptions.join(", ")}.`);
  const committed = options.committed !== false;
  const { postCommit, ...publicResult } = result;
  if (postCommit === null) return publicResult;
  assertAllowedFields(postCommit, POST_COMMIT_ASSESSMENT_FIELDS, "execution receipt postCommit");
  if (postCommit.kind !== POST_COMMIT_ASSESSMENT_KIND) throw new Error(`Unsupported execution receipt postCommit kind: ${postCommit.kind}.`);
  const missionId = safeId(postCommit.missionId, "execution receipt postCommit.missionId");
  if (!publicResult.completion || publicResult.completion.missionId !== missionId || publicResult.completion.assessment !== null) {
    throw new Error("Execution receipt postCommit descriptor does not match its sealed completion result.");
  }
  if (!committed) return publicResult;
  if (publicResult.mutationMode === "patch-plan" || publicResult.writesApplied !== true || publicResult.mutationSummary?.transactionState?.phase !== "committed") {
    throw new Error("Execution receipt post-commit assessment requires a successfully committed direct-process mutation result.");
  }
  return {
    ...publicResult,
    completion: {
      ...publicResult.completion,
      assessment: assessMissionCompletion(root, { missionId })
    }
  };
}

export function readExecutionReceipts(root, missionId = null) {
  const workspace = openDoveWorkspace(root, { operation: "Execution receipt read" });
  return workspace.receiptLedger.receipts.filter((receipt) => !missionId || receipt.missionId === missionId);
}
