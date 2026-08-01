import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { handoffAuthorizes } from "./artifact-handoffs.mjs";
import { normalizeProjectRelativePath } from "./artifact-integrity.mjs";
import { executionFactHash, readStoredExecutionFact } from "./execution-facts.mjs";
import { missionCompletionCriteria } from "./mission-contract-integrity.mjs";
import { ARTIFACT_PATHS, GOVERNANCE_GUARDED_MUTATIONS } from "./schema.mjs";
import { createValidationRecord, VALIDATION_FIELDS } from "./validation-records.mjs";

export const EXECUTION_RECEIPT_SCHEMA_VERSION = 5;
export const EXECUTION_RECEIPT_PRODUCER_KINDS = Object.freeze(["public-execution", "dove-internal"]);
export const ORDINARY_HOST_OUTCOME_STATUSES = Object.freeze(["completed", "stopped", "blocked", "failed"]);
export const ORDINARY_HOST_OUTCOME_MODES = Object.freeze(["artifact-backed", "observation-only"]);

const RECEIPT_FIELDS = new Set([
  "schemaVersion",
  "workspaceId",
  "receiptId",
  "ledgerSequence",
  "missionId",
  "contractDigest",
  "summary",
  "artifacts",
  "validations",
  "criteriaSatisfied",
  "producedAt",
  "recordedAt",
  "producer",
  "ordinaryHostOutcome",
  "researchOutcome"
]);
const ARTIFACT_FIELDS = new Set(["path", "kind", "sha256", "derivedReferences"]);
const STORED_VALIDATION_FIELDS = new Set(VALIDATION_FIELDS);
const CRITERION_FIELDS = new Set(["criterionId", "evidenceRefs", "evidenceBindings"]);
const EVIDENCE_BINDING_FIELDS = new Set(["reference", "sha256", "receiptId"]);
const PRODUCER_FIELDS = new Set(["kind", "actionId"]);
const ORDINARY_HOST_OUTCOME_FIELDS = new Set(["attemptId", "mode", "status", "facts", "callbackDigest"]);
const RESEARCH_OUTCOME_FIELDS = new Set(["attemptId", "decisionId", "decisionDigest", "actionId", "actionDigest", "envelopeId", "status", "evidenceReturned", "actualUsage", "facts", "startedAt", "finishedAt", "callbackDigest"]);
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const PRODUCER_KIND_SET = new Set(EXECUTION_RECEIPT_PRODUCER_KINDS);
const ORDINARY_HOST_OUTCOME_STATUS_SET = new Set(ORDINARY_HOST_OUTCOME_STATUSES);
const ORDINARY_HOST_OUTCOME_MODE_SET = new Set(ORDINARY_HOST_OUTCOME_MODES);
const INTERNAL_ACTION_IDS = new Set(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.id));

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

export function ordinaryHostOutcomeCallbackDigest(value) {
  return sha256({
    attemptId: value.attemptId,
    missionId: value.missionId,
    contractDigest: value.contractDigest,
    summary: value.summary,
    mode: value.mode,
    status: value.status,
    facts: value.facts,
    artifacts: value.artifacts.map(({ path: artifactPath, sha256: artifactSha256 }) => ({ path: artifactPath, sha256: artifactSha256 })),
    validations: value.validations.map(({ kind, result, level, producerKind, producerOperation, observedExitStatus, targetReference, targetHash, reference, outputHash }) => ({ kind, result, level, producerKind, producerOperation, observedExitStatus, targetReference, targetHash, reference, outputHash }))
  });
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}

function assertSealed(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}

function exactString(value, label) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) throw new Error(`${label} must be a canonical non-empty string.`);
  return value;
}

function safeId(value, label) {
  const normalized = exactString(value, label);
  if (!SAFE_ID.test(normalized)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized;
}

function hash(value, label) {
  const normalized = exactString(value, label);
  if (!HASH.test(normalized)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return normalized;
}

function exactIso(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value;
}

function canonicalPath(value, label) {
  const normalized = normalizeProjectRelativePath(value);
  if (!normalized.ok) throw new Error(`${label} has an unsafe path: ${normalized.reason}.`);
  if (value !== normalized.normalizedPath) throw new Error(`${label} must use a canonical project-relative path.`);
  return value;
}

function canonicalStringArray(value, label, options = {}) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const items = value.map((item, index) => exactString(item, `${label}[${index}]`));
  if (new Set(items).size !== items.length) throw new Error(`${label} must not contain duplicates.`);
  if (options.sorted === true && items.some((item, index) => index > 0 && items[index - 1].localeCompare(item) > 0)) {
    throw new Error(`${label} must use canonical lexical order.`);
  }
  return items;
}

function validateProducer(value, label) {
  assertSealed(value, PRODUCER_FIELDS, label);
  if (!PRODUCER_KIND_SET.has(value.kind)) throw new Error(`${label}.kind is unsupported.`);
  const actionId = safeId(value.actionId, `${label}.actionId`);
  if (value.kind === "public-execution" && !["ingest-execution-receipt", "close-host-outcome"].includes(actionId)) {
    throw new Error(`${label} public-execution producer must use actionId ingest-execution-receipt or close-host-outcome.`);
  }
  if (value.kind === "dove-internal" && (!INTERNAL_ACTION_IDS.has(actionId) || actionId === "ingest-execution-receipt")) {
    throw new Error(`${label} dove-internal producer actionId is not a registered internal Dove mutation.`);
  }
  return value;
}

function validateStoredReceipt(value, context) {
  const { manifest, missions, label, filename } = context;
  assertSealed(value, RECEIPT_FIELDS, label);
  if (value.schemaVersion !== EXECUTION_RECEIPT_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  if (value.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  safeId(value.workspaceId, `${label}.workspaceId`);
  const receiptId = safeId(value.receiptId, `${label}.receiptId`);
  if (filename !== `${receiptId}.json`) throw new Error(`${label} filename must match receiptId ${receiptId}.`);
  if (!Number.isSafeInteger(value.ledgerSequence) || value.ledgerSequence < 1) throw new Error(`${label}.ledgerSequence must be a positive safe integer.`);
  const missionId = safeId(value.missionId, `${label}.missionId`);
  const mission = missions.get(missionId);
  if (!mission) throw new Error(`${label} references unknown mission ${missionId}.`);
  hash(value.contractDigest, `${label}.contractDigest`);
  if (value.contractDigest !== mission.contractDigest) throw new Error(`${label}.contractDigest does not match mission ${missionId}.`);
  exactString(value.summary, `${label}.summary`);
  exactIso(value.producedAt, `${label}.producedAt`);
  exactIso(value.recordedAt, `${label}.recordedAt`);
  validateProducer(value.producer, `${label}.producer`);

  if (!Array.isArray(value.artifacts)) throw new Error(`${label}.artifacts must be an array.`);
  if (!Array.isArray(value.validations)) throw new Error(`${label}.validations must be an array.`);
  if (!Array.isArray(value.criteriaSatisfied)) throw new Error(`${label}.criteriaSatisfied must be an array.`);
  const ordinaryHostOutcome = value.ordinaryHostOutcome;
  if (ordinaryHostOutcome !== undefined) {
    assertSealed(ordinaryHostOutcome, ORDINARY_HOST_OUTCOME_FIELDS, `${label}.ordinaryHostOutcome`);
    safeId(ordinaryHostOutcome.attemptId, `${label}.ordinaryHostOutcome.attemptId`);
    if (!ORDINARY_HOST_OUTCOME_MODE_SET.has(ordinaryHostOutcome.mode)) throw new Error(`${label}.ordinaryHostOutcome.mode is unsupported.`);
    if (!ORDINARY_HOST_OUTCOME_STATUS_SET.has(ordinaryHostOutcome.status)) throw new Error(`${label}.ordinaryHostOutcome.status is unsupported.`);
    if (!Array.isArray(ordinaryHostOutcome.facts)) throw new Error(`${label}.ordinaryHostOutcome.facts must be an array.`);
    const facts = ordinaryHostOutcome.facts.map((fact, index) => readStoredExecutionFact(fact, `${label}.ordinaryHostOutcome.facts[${index}]`));
    if (new Set(facts.map((fact) => fact.factId)).size !== facts.length) throw new Error(`${label}.ordinaryHostOutcome.facts must not contain duplicates.`);
    ordinaryHostOutcome.facts = facts;
    hash(ordinaryHostOutcome.callbackDigest, `${label}.ordinaryHostOutcome.callbackDigest`);
    if (ordinaryHostOutcome.mode === "observation-only" && facts.length === 0) throw new Error(`${label}.ordinaryHostOutcome observation-only mode requires at least one execution fact.`);
    if (ordinaryHostOutcome.mode === "observation-only" && (value.artifacts.length > 0 || value.validations.length > 0)) {
      throw new Error(`${label}.ordinaryHostOutcome observation-only mode cannot own artifacts or claim validations.`);
    }
    if (ordinaryHostOutcome.mode === "artifact-backed" && value.artifacts.length === 0) throw new Error(`${label}.ordinaryHostOutcome artifact-backed mode requires at least one artifact.`);
  }
  const researchOutcome = value.researchOutcome;
  if (researchOutcome !== undefined) {
    assertSealed(researchOutcome, RESEARCH_OUTCOME_FIELDS, `${label}.researchOutcome`);
    safeId(researchOutcome.attemptId, `${label}.researchOutcome.attemptId`);
    safeId(researchOutcome.decisionId, `${label}.researchOutcome.decisionId`);
    hash(researchOutcome.decisionDigest, `${label}.researchOutcome.decisionDigest`);
    safeId(researchOutcome.actionId, `${label}.researchOutcome.actionId`);
    hash(researchOutcome.actionDigest, `${label}.researchOutcome.actionDigest`);
    safeId(researchOutcome.envelopeId, `${label}.researchOutcome.envelopeId`);
    exactString(researchOutcome.status, `${label}.researchOutcome.status`);
    canonicalStringArray(researchOutcome.evidenceReturned, `${label}.researchOutcome.evidenceReturned`);
    assertPlainObject(researchOutcome.actualUsage, `${label}.researchOutcome.actualUsage`);
    for (const [dimension, amount] of Object.entries(researchOutcome.actualUsage)) {
      exactString(dimension, `${label}.researchOutcome.actualUsage dimension`);
      if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`${label}.researchOutcome.actualUsage.${dimension} must be a non-negative safe integer.`);
    }
    canonicalStringArray(researchOutcome.facts, `${label}.researchOutcome.facts`);
    exactIso(researchOutcome.startedAt, `${label}.researchOutcome.startedAt`);
    exactIso(researchOutcome.finishedAt, `${label}.researchOutcome.finishedAt`);
    hash(researchOutcome.callbackDigest, `${label}.researchOutcome.callbackDigest`);
    const expectedResearchDigest = sha256({
      attemptId: researchOutcome.attemptId,
      missionId: value.missionId,
      decisionDigest: researchOutcome.decisionDigest,
      actionId: researchOutcome.actionId,
      actionDigest: researchOutcome.actionDigest,
      status: researchOutcome.status,
      performedActionCount: researchOutcome.actualUsage.actions,
      actualUsage: researchOutcome.actualUsage,
      evidenceReturned: researchOutcome.evidenceReturned,
      artifacts: value.artifacts.map(({ path: artifactPath, sha256: artifactSha256 }) => ({ path: artifactPath, sha256: artifactSha256 })),
      validations: value.validations.map(({ reference, outputHash }) => ({ path: reference, sha256: outputHash })),
      facts: researchOutcome.facts,
      startedAt: researchOutcome.startedAt,
      finishedAt: researchOutcome.finishedAt
    });
    if (researchOutcome.callbackDigest !== expectedResearchDigest) throw new Error(`${label}.researchOutcome.callbackDigest does not match its immutable callback content.`);
    if (value.producer.kind !== "dove-internal" || value.producer.actionId !== "record-research-outcome") throw new Error(`${label}.researchOutcome requires the record-research-outcome producer.`);
  }
  if (ordinaryHostOutcome !== undefined && researchOutcome !== undefined) throw new Error(`${label} cannot contain both ordinaryHostOutcome and researchOutcome.`);
  if (value.artifacts.length === 0 && value.validations.length === 0 && value.criteriaSatisfied.length === 0 && ordinaryHostOutcome === undefined && researchOutcome === undefined) {
    throw new Error(`${label} must contain an artifact, validation, satisfied criterion, ordinary outcome, or research outcome.`);
  }
  const artifactPaths = new Set();
  for (const [index, artifact] of value.artifacts.entries()) {
    const itemLabel = `${label}.artifacts[${index}]`;
    assertSealed(artifact, ARTIFACT_FIELDS, itemLabel);
    const artifactPath = canonicalPath(artifact.path, `${itemLabel}.path`);
    if (artifactPaths.has(artifactPath)) throw new Error(`${label}.artifacts contains duplicate path ${artifactPath}.`);
    artifactPaths.add(artifactPath);
    exactString(artifact.kind, `${itemLabel}.kind`);
    hash(artifact.sha256, `${itemLabel}.sha256`);
    canonicalStringArray(artifact.derivedReferences, `${itemLabel}.derivedReferences`, { sorted: true });
  }

  const validationPaths = new Set();
  value.validations = value.validations.map((validation, index) => {
    const itemLabel = `${label}.validations[${index}]`;
    assertSealed(validation, STORED_VALIDATION_FIELDS, itemLabel);
    const normalized = createValidationRecord(validation, { label: itemLabel });
    const reference = canonicalPath(normalized.reference, `${itemLabel}.reference`);
    if (validationPaths.has(reference)) throw new Error(`${label}.validations contains duplicate reference ${reference}.`);
    if (artifactPaths.has(reference)) throw new Error(`${label} artifact and validation paths must be canonically distinct: ${reference}.`);
    validationPaths.add(reference);
    hash(normalized.outputHash, `${itemLabel}.outputHash`);
    const separator = normalized.targetReference.indexOf(":");
    const targetKind = normalized.targetReference.slice(0, separator);
    const target = normalized.targetReference.slice(separator + 1);
    if (!["artifact", "validation"].includes(targetKind) || !target) throw new Error(`${itemLabel}.targetReference must be an exact typed file binding.`);
    canonicalPath(target, `${itemLabel}.targetReference`);
    return normalized;
  });

  const artifactHashByReference = new Map(value.artifacts.map((artifact) => [`artifact:${artifact.path}`, artifact.sha256]));
  const validationHashByReference = new Map(value.validations.map((validation) => [`validation:${validation.reference}`, validation.outputHash]));
  const factHashByReference = new Map((ordinaryHostOutcome?.facts ?? []).map((fact) => [`fact:${fact.factId}`, executionFactHash(fact.statement)]));
  const criterionIds = new Set();
  const missionCriterionIds = new Set(missionCompletionCriteria(mission).map((item) => item.criterionId));
  for (const [index, criterion] of value.criteriaSatisfied.entries()) {
    const itemLabel = `${label}.criteriaSatisfied[${index}]`;
    assertSealed(criterion, CRITERION_FIELDS, itemLabel);
    const criterionId = safeId(criterion.criterionId, `${itemLabel}.criterionId`);
    if (!missionCriterionIds.has(criterionId)) throw new Error(`${itemLabel}.criterionId is unknown for mission ${missionId}.`);
    if (criterionIds.has(criterionId)) throw new Error(`${label}.criteriaSatisfied contains duplicate criterionId ${criterionId}.`);
    criterionIds.add(criterionId);
    const references = canonicalStringArray(criterion.evidenceRefs, `${itemLabel}.evidenceRefs`);
    if (references.length === 0) throw new Error(`${itemLabel}.evidenceRefs must contain at least one item.`);
    if (!Array.isArray(criterion.evidenceBindings) || criterion.evidenceBindings.length !== references.length) {
      throw new Error(`${itemLabel}.evidenceBindings must bind every evidence reference to its original hash.`);
    }
    const bindingByReference = new Map();
    for (const [bindingIndex, binding] of criterion.evidenceBindings.entries()) {
      const bindingLabel = `${itemLabel}.evidenceBindings[${bindingIndex}]`;
      assertSealed(binding, EVIDENCE_BINDING_FIELDS, bindingLabel);
      const reference = exactString(binding.reference, `${bindingLabel}.reference`);
      if (bindingByReference.has(reference)) throw new Error(`${itemLabel}.evidenceBindings contains duplicate reference ${reference}.`);
      const receiptId = safeId(binding.receiptId, `${bindingLabel}.receiptId`);
      bindingByReference.set(reference, { sha256: hash(binding.sha256, `${bindingLabel}.sha256`), receiptId });
    }
    for (const [referenceIndex, reference] of references.entries()) {
      const separator = reference.indexOf(":");
      if (separator <= 0 || separator === reference.length - 1) throw new Error(`${itemLabel}.evidenceRefs[${referenceIndex}] must be a typed evidence reference.`);
      const kind = reference.slice(0, separator);
      const target = reference.slice(separator + 1);
      if ((kind === "artifact" || kind === "validation") && canonicalPath(target, `${itemLabel}.evidenceRefs[${referenceIndex}]`) !== target) {
        throw new Error(`${itemLabel}.evidenceRefs[${referenceIndex}] must be canonical.`);
      }
      if (!bindingByReference.has(reference)) throw new Error(`${itemLabel}.evidenceBindings is missing ${reference}.`);
      const binding = bindingByReference.get(reference);
      const declaredHash = kind === "artifact" ? artifactHashByReference.get(reference) : kind === "validation" ? validationHashByReference.get(reference) : kind === "fact" ? factHashByReference.get(reference) : null;
      if (kind === "fact" && !declaredHash) throw new Error(`${itemLabel}.evidenceRefs[${referenceIndex}] references an unknown execution fact.`);
      if (declaredHash && (binding.sha256 !== declaredHash || binding.receiptId !== receiptId)) throw new Error(`${itemLabel}.evidenceBindings does not match the receipt declaration for ${reference}.`);
    }
  }
  if (ordinaryHostOutcome !== undefined) {
    const currentDigest = ordinaryHostOutcomeCallbackDigest({
      attemptId: ordinaryHostOutcome.attemptId,
      missionId: value.missionId,
      contractDigest: value.contractDigest,
      summary: value.summary,
      mode: ordinaryHostOutcome.mode,
      status: ordinaryHostOutcome.status,
      facts: ordinaryHostOutcome.facts,
      artifacts: value.artifacts,
      validations: value.validations
    });
    if (ordinaryHostOutcome.callbackDigest !== currentDigest) {
      throw new Error(`${label}.ordinaryHostOutcome.callbackDigest does not match its canonical callback content.`);
    }
  }
  return value;
}

function readJsonStrict(fullPath, label) {
  let text;
  try {
    text = fs.readFileSync(fullPath, "utf8");
  } catch (error) {
    throw new Error(`${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Malformed durable JSON in ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function derivedState(manifest, receipts, artifactHandoffs) {
  const currentByPath = new Map();
  const artifactHistory = [];
  for (const receipt of receipts) {
    for (const artifact of receipt.artifacts) {
      const previous = currentByPath.get(artifact.path);
      if (
        previous
        && previous.missionId !== receipt.missionId
        && !handoffAuthorizes(artifactHandoffs, artifact.path, previous.missionId, receipt.missionId, previous.receiptId, previous.sha256)
      ) {
        throw new Error(`Execution receipt ledger assigns artifact path ${artifact.path} to mission ${receipt.missionId} without an explicit artifact handoff from mission ${previous.missionId}.`);
      }
      const entry = {
        path: artifact.path,
        kind: artifact.kind,
        sha256: artifact.sha256,
        missionId: receipt.missionId,
        contractDigest: receipt.contractDigest,
        receiptId: receipt.receiptId,
        ledgerSequence: receipt.ledgerSequence,
        recordedAt: receipt.recordedAt,
        producer: receipt.producer,
        derivedReferences: artifact.derivedReferences
      };
      artifactHistory.push(entry);
      currentByPath.set(artifact.path, entry);
    }
  }
  const current = [...currentByPath.values()].sort((left, right) => left.path.localeCompare(right.path));
  const updatedAt = receipts.at(-1)?.recordedAt ?? null;
  return {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: manifest.workspaceId,
    receipts,
    artifactHistory,
    currentOwnership: current.map(({ derivedReferences: _derivedReferences, ledgerSequence: _ledgerSequence, recordedAt: _recordedAt, producer: _producer, ...item }) => item),
    updatedAt,
    nextLedgerSequence: receipts.length + 1
  };
}

export function readExecutionReceiptLedger(root, options = {}) {
  const manifest = options.manifest;
  const missions = options.missions;
  const missionGraph = options.missionGraph;
  const artifactHandoffs = options.artifactHandoffs;
  if (!manifest || !(missions instanceof Map) || !missionGraph || !artifactHandoffs) throw new Error("Execution receipt ledger read requires the validated manifest, mission map, mission graph, and artifact handoffs.");
  const directory = path.resolve(root, ARTIFACT_PATHS.executionReceiptsDir);
  const receipts = fs.readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const relativePath = path.posix.join(ARTIFACT_PATHS.executionReceiptsDir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON file.`);
    return validateStoredReceipt(readJsonStrict(path.join(directory, entry.name), relativePath), {
      manifest,
      missions,
      label: relativePath,
      filename: entry.name
    });
  }).sort((left, right) => left.ledgerSequence - right.ledgerSequence);

  const receiptIds = new Set();
  const researchAttemptIds = new Set();
  const ordinaryAttemptIds = new Set();
  for (const [index, receipt] of receipts.entries()) {
    const expectedSequence = index + 1;
    if (receipt.ledgerSequence !== expectedSequence) {
      throw new Error(`Execution receipt ledgerSequence must be contiguous from 1; expected ${expectedSequence}, found ${receipt.ledgerSequence} in ${receipt.receiptId}.`);
    }
    if (receiptIds.has(receipt.receiptId)) throw new Error(`Execution receipt ledger contains duplicate receiptId ${receipt.receiptId}.`);
    receiptIds.add(receipt.receiptId);
    if (receipt.researchOutcome) {
      if (researchAttemptIds.has(receipt.researchOutcome.attemptId)) throw new Error(`Execution receipt ledger contains duplicate research attemptId ${receipt.researchOutcome.attemptId}.`);
      researchAttemptIds.add(receipt.researchOutcome.attemptId);
    }
    if (receipt.ordinaryHostOutcome) {
      if (ordinaryAttemptIds.has(receipt.ordinaryHostOutcome.attemptId)) throw new Error(`Execution receipt ledger contains duplicate ordinary attemptId ${receipt.ordinaryHostOutcome.attemptId}.`);
      ordinaryAttemptIds.add(receipt.ordinaryHostOutcome.attemptId);
    }
  }
  return derivedState(manifest, receipts, artifactHandoffs);
}

export function deriveArtifactReferences(receipt, explicitByPath = new Map()) {
  const criterionReferences = new Map(receipt.artifacts.map((artifact) => [artifact.path, []]));
  for (const criterion of receipt.criteriaSatisfied) {
    for (const reference of criterion.evidenceRefs) {
      if (!reference.startsWith("artifact:")) continue;
      const artifactPath = reference.slice("artifact:".length);
      criterionReferences.get(artifactPath)?.push(`criterion:${criterion.criterionId}`);
    }
  }
  return receipt.artifacts.map((artifact) => ({
    ...artifact,
    derivedReferences: [...new Set([...(explicitByPath.get(artifact.path) ?? []), ...(criterionReferences.get(artifact.path) ?? [])])].sort()
  }));
}

export function assertReceiptAppendable(ledger, receipt, options = {}) {
  const artifactHandoffs = options.artifactHandoffs;
  if (receipt.ledgerSequence !== ledger.nextLedgerSequence) {
    throw new Error(`Execution receipt ledgerSequence must be ${ledger.nextLedgerSequence}.`);
  }
  if (ledger.receipts.some((item) => item.receiptId === receipt.receiptId)) throw new Error(`Execution receipt id is already occupied: ${receipt.receiptId}.`);
  const currentByPath = new Map(ledger.currentOwnership.map((item) => [item.path, item]));
  const receiptById = new Map(ledger.receipts.map((item) => [item.receiptId, item]));
  for (const artifact of receipt.artifacts) {
    const current = currentByPath.get(artifact.path);
    const currentReceipt = current ? receiptById.get(current.receiptId) : null;
    if (currentReceipt?.producer?.kind === "dove-internal" && currentReceipt.producer.actionId === "archive-review-record") {
      throw new Error(`Artifact path ${artifact.path} is an immutable review archive and cannot be overwritten.`);
    }
    if (
      current
      && current.missionId !== receipt.missionId
      && !handoffAuthorizes(artifactHandoffs, artifact.path, current.missionId, receipt.missionId, current.receiptId, current.sha256)
    ) {
      throw new Error(`Artifact path ${artifact.path} is already owned by mission ${current.missionId}; mission ${receipt.missionId} requires an explicit artifact handoff before overwriting it.`);
    }
  }
}
