import fs from "node:fs";
import path from "node:path";

import { normalizeProjectRelativePath } from "./artifact-integrity.mjs";
import { ARTIFACT_PATHS, GOVERNANCE_GUARDED_MUTATIONS } from "./schema.mjs";

export const EXECUTION_RECEIPT_SCHEMA_VERSION = 2;
export const EXECUTION_RECEIPT_PRODUCER_KINDS = Object.freeze(["public-execution", "dove-internal"]);

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
  "producer"
]);
const ARTIFACT_FIELDS = new Set(["path", "kind", "sha256", "derivedReferences"]);
const VALIDATION_FIELDS = new Set(["kind", "reference", "outputHash"]);
const CRITERION_FIELDS = new Set(["criterionId", "evidenceRefs"]);
const PRODUCER_FIELDS = new Set(["kind", "actionId"]);
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const PRODUCER_KIND_SET = new Set(EXECUTION_RECEIPT_PRODUCER_KINDS);
const INTERNAL_ACTION_IDS = new Set(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.id));

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
  if (value.kind === "public-execution" && actionId !== "ingest-execution-receipt") {
    throw new Error(`${label} public-execution producer must use actionId ingest-execution-receipt.`);
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

  if (!Array.isArray(value.artifacts) || value.artifacts.length === 0) throw new Error(`${label}.artifacts must contain at least one item.`);
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

  if (!Array.isArray(value.validations)) throw new Error(`${label}.validations must be an array.`);
  const validationPaths = new Set();
  for (const [index, validation] of value.validations.entries()) {
    const itemLabel = `${label}.validations[${index}]`;
    assertSealed(validation, VALIDATION_FIELDS, itemLabel);
    exactString(validation.kind, `${itemLabel}.kind`);
    const reference = canonicalPath(validation.reference, `${itemLabel}.reference`);
    if (validationPaths.has(reference)) throw new Error(`${label}.validations contains duplicate reference ${reference}.`);
    validationPaths.add(reference);
    hash(validation.outputHash, `${itemLabel}.outputHash`);
  }

  if (!Array.isArray(value.criteriaSatisfied)) throw new Error(`${label}.criteriaSatisfied must be an array.`);
  const criterionIds = new Set();
  const missionCriterionIds = new Set(Array.isArray(mission.completionCriterionIds) ? mission.completionCriterionIds : []);
  for (const [index, criterion] of value.criteriaSatisfied.entries()) {
    const itemLabel = `${label}.criteriaSatisfied[${index}]`;
    assertSealed(criterion, CRITERION_FIELDS, itemLabel);
    const criterionId = safeId(criterion.criterionId, `${itemLabel}.criterionId`);
    if (!missionCriterionIds.has(criterionId)) throw new Error(`${itemLabel}.criterionId is unknown for mission ${missionId}.`);
    if (criterionIds.has(criterionId)) throw new Error(`${label}.criteriaSatisfied contains duplicate criterionId ${criterionId}.`);
    criterionIds.add(criterionId);
    const references = canonicalStringArray(criterion.evidenceRefs, `${itemLabel}.evidenceRefs`);
    for (const [referenceIndex, reference] of references.entries()) {
      const separator = reference.indexOf(":");
      if (separator <= 0 || separator === reference.length - 1) throw new Error(`${itemLabel}.evidenceRefs[${referenceIndex}] must be a typed evidence reference.`);
      const kind = reference.slice(0, separator);
      const target = reference.slice(separator + 1);
      if ((kind === "artifact" || kind === "validation") && canonicalPath(target, `${itemLabel}.evidenceRefs[${referenceIndex}]`) !== target) {
        throw new Error(`${itemLabel}.evidenceRefs[${referenceIndex}] must be canonical.`);
      }
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

function derivedState(manifest, receipts) {
  const currentByPath = new Map();
  const artifactHistory = [];
  for (const receipt of receipts) {
    for (const artifact of receipt.artifacts) {
      const previous = currentByPath.get(artifact.path);
      if (previous && previous.missionId !== receipt.missionId) {
        throw new Error(`Execution receipt ledger assigns artifact path ${artifact.path} to mission ${receipt.missionId} after ownership by mission ${previous.missionId}.`);
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
    currentLineage: current.map(({ ledgerSequence: _ledgerSequence, recordedAt: _recordedAt, producer: _producer, ...item }) => item),
    updatedAt,
    nextLedgerSequence: receipts.length + 1
  };
}

export function readExecutionReceiptLedger(root, options = {}) {
  const manifest = options.manifest;
  const missions = options.missions;
  if (!manifest || !(missions instanceof Map)) throw new Error("Execution receipt ledger read requires the validated manifest and mission map.");
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
  for (const [index, receipt] of receipts.entries()) {
    const expectedSequence = index + 1;
    if (receipt.ledgerSequence !== expectedSequence) {
      throw new Error(`Execution receipt ledgerSequence must be contiguous from 1; expected ${expectedSequence}, found ${receipt.ledgerSequence} in ${receipt.receiptId}.`);
    }
    if (receiptIds.has(receipt.receiptId)) throw new Error(`Execution receipt ledger contains duplicate receiptId ${receipt.receiptId}.`);
    receiptIds.add(receipt.receiptId);
  }
  return derivedState(manifest, receipts);
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

export function assertReceiptAppendable(ledger, receipt) {
  if (receipt.ledgerSequence !== ledger.nextLedgerSequence) {
    throw new Error(`Execution receipt ledgerSequence must be ${ledger.nextLedgerSequence}.`);
  }
  if (ledger.receipts.some((item) => item.receiptId === receipt.receiptId)) throw new Error(`Execution receipt id is already occupied: ${receipt.receiptId}.`);
  const currentByPath = new Map(ledger.currentOwnership.map((item) => [item.path, item]));
  const receiptById = new Map(ledger.receipts.map((item) => [item.receiptId, item]));
  for (const artifact of receipt.artifacts) {
    const current = currentByPath.get(artifact.path);
    const currentReceipt = current ? receiptById.get(current.receiptId) : null;
    if (currentReceipt?.producer?.kind === "dove-internal" && ["prepare-review-exchange", "import-review-exchange"].includes(currentReceipt.producer.actionId)) {
      throw new Error(`Artifact path ${artifact.path} is an immutable review ${currentReceipt.producer.actionId === "prepare-review-exchange" ? "preparation control" : "import record"} and cannot be overwritten.`);
    }
    if (current && current.missionId !== receipt.missionId) {
      throw new Error(`Artifact path ${artifact.path} is already owned by mission ${current.missionId}; mission ${receipt.missionId} cannot overwrite it.`);
    }
  }
}
