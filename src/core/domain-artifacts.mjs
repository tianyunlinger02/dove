import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { handoffAuthorizes } from "./artifact-handoffs.mjs";
import { inspectDeclaredPath, normalizeProjectRelativePath } from "./artifact-integrity.mjs";
import { readArtifactOwnership } from "./artifact-lineage.mjs";
import { assertCurrentMissionContract } from "./mission-contracts.mjs";
import { assertMissionAcceptsWrites, missionCanReadMission } from "./mission-graph.mjs";
import { currentMutationContext, isPatchPlanMode } from "./mutation-backend.mjs";
import { sha256File } from "./review-artifact-snapshot.mjs";
import { assertReceiptAppendable, deriveArtifactReferences, EXECUTION_RECEIPT_SCHEMA_VERSION } from "./receipt-ledger.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { createValidationRecord } from "./validation-records.mjs";
import { assertGovernanceMutationRegistered, nowIso, readJson, writeJson, writeText } from "./workspace.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;

export function domainSafeId(value, label) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!SAFE_ID.test(normalized)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized;
}

export function domainNonEmptyText(value, label) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${label} must be a non-empty string.`);
  return normalized;
}

export function domainStringArray(value, label, options = {}) {
  const source = value === undefined ? [] : value;
  if (!Array.isArray(source)) throw new Error(`${label} must be an array of non-empty strings.`);
  const items = source.map((item, index) => domainNonEmptyText(item, `${label}[${index}]`));
  if (new Set(items).size !== items.length) throw new Error(`${label} must not contain duplicates.`);
  if (options.minItems && items.length < options.minItems) throw new Error(`${label} must contain at least ${options.minItems} item(s).`);
  return items;
}

export function assertSealedDomainArgs(args, fields, label) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error(`${label} arguments must be a plain object.`);
  const unknown = Object.keys(args).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}

export function domainJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function domainSha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function readCurrentMission(root, missionId, operation = "Domain workflow") {
  const workspace = openDoveWorkspace(root, { operation });
  const normalizedMissionId = domainSafeId(missionId, "missionId");
  const relativePath = path.posix.join(ARTIFACT_PATHS.missionsDir, `${normalizedMissionId}.json`);
  const fullPath = path.resolve(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Mission does not exist: ${normalizedMissionId}.`);
  const mission = readJson(root, relativePath, null);
  const current = assertCurrentMissionContract(mission);
  if (mission.workspaceId !== workspace.manifest.workspaceId) throw new Error(`Mission ${normalizedMissionId} belongs to a different workspace.`);
  return { workspace, mission, current, relativePath };
}

export function canonicalDomainPath(rawPath, label, requiredPrefix = null) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) throw new Error(`${label} has an unsafe path: ${normalized.reason}.`);
  const supplied = String(rawPath).trim().replace(/\\/gu, "/");
  if (normalized.normalizedPath !== supplied) throw new Error(`${label} must use a canonical project-relative path.`);
  if (requiredPrefix && normalized.normalizedPath !== requiredPrefix && !normalized.normalizedPath.startsWith(`${requiredPrefix}/`)) {
    throw new Error(`${label} must stay under ${requiredPrefix}.`);
  }
  return normalized.normalizedPath;
}

function currentFileHash(root, relativePath, label) {
  const inspection = inspectDeclaredPath(root, relativePath, { requireNonEmpty: true });
  if (inspection.status !== "existing") throw new Error(`${label} must reference an existing non-empty regular file (${inspection.reason ?? inspection.status}).`);
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath !== relativePath) throw new Error(`${label} must use the canonical realpath-contained path.`);
  return { path: canonicalPath, sha256: sha256File(path.resolve(root, canonicalPath)) };
}

export function isDoveLessonArtifactPath(rawPath) {
  const normalized = normalizeProjectRelativePath(rawPath);
  return normalized.ok && normalized.normalizedPath === ARTIFACT_PATHS.lessonsDocument;
}

export function assertNotDoveLessonArtifactPath(rawPath, label = "artifact") {
  if (isDoveLessonArtifactPath(rawPath)) {
    throw new Error(`${label} must not use a Dove lesson as substantive artifact or evidence.`);
  }
}

export function resolveMissionArtifactReferences(root, missionId, references = [], label = "artifactRefs") {
  const normalized = domainStringArray(references, label);
  if (normalized.length === 0) return [];
  const { workspace, mission } = readCurrentMission(root, missionId, label);
  const byPath = new Map(workspace.receiptLedger.currentOwnership.map((item) => [item.path, item]));
  return normalized.map((rawPath, index) => {
    const artifactPath = canonicalDomainPath(rawPath, `${label}[${index}]`);
    assertNotDoveLessonArtifactPath(artifactPath, `${label}[${index}]`);
    const owner = byPath.get(artifactPath);
    if (!owner) throw new Error(`${label}[${index}] is not a registered current-schema artifact: ${artifactPath}.`);
    if (!missionCanReadMission(workspace.missionGraph, mission.missionId, owner.missionId)) {
      throw new Error(`${label}[${index}] belongs to mission ${owner.missionId}, which is not this mission or an ancestor of ${mission.missionId}.`);
    }
    const current = currentFileHash(root, artifactPath, `${label}[${index}]`);
    if (current.sha256 !== owner.sha256) throw new Error(`${label}[${index}] has changed since its latest ownership receipt: ${artifactPath}.`);
    return { ...owner, ...current };
  });
}

export function resolveMissionValidationReference(root, missionId, rawPath, label = "validation reference") {
  const { workspace, mission } = readCurrentMission(root, missionId, label);
  const validationPath = canonicalDomainPath(rawPath, label);
  const receipt = workspace.receiptLedger.receipts.toReversed().find((item) =>
    missionCanReadMission(workspace.missionGraph, mission.missionId, item.missionId)
    && item.validations.some((validation) => validation.reference === validationPath)
  );
  const validation = receipt?.validations.find((item) => item.reference === validationPath);
  if (!validation) throw new Error(`${label} is not current mission-bound validation evidence: ${validationPath}.`);
  const current = currentFileHash(root, validationPath, label);
  if (current.sha256 !== validation.outputHash) throw new Error(`${label} has changed since its validation receipt: ${validationPath}.`);
  return { reference: validationPath, outputHash: validation.outputHash, receiptId: receipt.receiptId };
}

function normalizeWrite(root, missionId, item, index, options = {}) {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`domainWrites[${index}] must be an object.`);
  const relativePath = canonicalDomainPath(item.path, `domainWrites[${index}].path`, ".dove");
  const isLesson = isDoveLessonArtifactPath(relativePath);
  if (isLesson) throw new Error(`domainWrites[${index}].path must not use the advisory Lessons document as a domain artifact.`);
  const kind = domainNonEmptyText(item.kind, `domainWrites[${index}].kind`);
  if (!["report", "document", "code", "data", "figure", "media", "other"].includes(kind)) throw new Error(`domainWrites[${index}].kind is unsupported.`);
  const content = Buffer.isBuffer(item.content) ? item.content : Buffer.from(String(item.content ?? ""), "utf8");
  if (content.byteLength === 0) throw new Error(`domainWrites[${index}].content must be non-empty.`);
  const context = currentMutationContext(root);
  context.resolve(relativePath);
  if (Buffer.isBuffer(item.content) && isPatchPlanMode(root) && path.extname(relativePath).toLowerCase() !== ".svg") {
    throw new Error(`domainWrites[${index}] patch-plan cannot safely represent binary artifact ${relativePath}; import PNG, JPEG, or PDF output in direct-process mode.`);
  }
  const derivedReferences = domainStringArray(item.derivedReferences, `domainWrites[${index}].derivedReferences`);
  return {
    path: relativePath,
    kind,
    content,
    encoding: Buffer.isBuffer(item.content) ? "binary" : "utf8",
    sha256: domainSha256(content),
    missionId,
    derivedReferences
  };
}

function assertWritableOwnedArtifacts(root, workspace, mission, actionId, writes, options = {}) {
  const context = currentMutationContext(root);
  const ownershipBeforeWrite = readArtifactOwnership(root);
  const ownerByPath = new Map(ownershipBeforeWrite.artifacts.map((item) => [item.path, item]));
  for (const item of writes) {
    if (!context.fileExists(item.path)) continue;
    if (isDoveLessonArtifactPath(item.path)) {
      throw new Error(`${actionId} refuses to overwrite immutable lesson artifact ${item.path}.`);
    }
    const owner = ownerByPath.get(item.path);
    if (!owner && options.allowUnownedBookkeepingPaths?.has(item.path)) continue;
    if (!owner) throw new Error(`${actionId} refuses to overwrite unowned existing artifact ${item.path}.`);
    const ownerReceipt = workspace.receiptLedger.receipts.find((receipt) => receipt.receiptId === owner.receiptId);
    if (ownerReceipt?.producer?.kind === "dove-internal" && ownerReceipt.producer.actionId === "archive-review-record") {
      throw new Error(`${actionId} refuses to overwrite immutable review archive ${item.path}.`);
    }
    if (
      owner.missionId !== mission.missionId
      && !handoffAuthorizes(workspace.artifactHandoffs, item.path, owner.missionId, mission.missionId, owner.receiptId, owner.sha256)
    ) {
      throw new Error(`${actionId} refuses to overwrite artifact ${item.path} without an explicit handoff from mission ${owner.missionId}.`);
    }
    const current = currentFileHash(root, item.path, item.path);
    if (current.sha256 !== owner.sha256) throw new Error(`${actionId} refuses to overwrite drifted artifact ${item.path}.`);
  }
}

function writeNormalizedDomainArtifacts(root, writes) {
  const context = currentMutationContext(root);
  for (const item of writes) {
    if (item.encoding === "binary") {
      if (isPatchPlanMode(root)) writeText(root, item.path, item.content.toString("utf8"));
      else context.writeBinary(item.path, item.content);
    } else writeText(root, item.path, item.content.toString("utf8"));
  }
}

export function stageConsolidatedDomainMutation(root, options = {}) {
  const actionId = domainNonEmptyText(options.actionId, "actionId");
  assertGovernanceMutationRegistered(actionId, options.governanceMode ?? "guarded");
  const context = currentMutationContext(root);
  if (!context) throw new Error(`${actionId} requires an active MutationContext.`);
  if (context.mutationMode !== "direct-process") throw new Error(`${actionId} consolidated staging requires direct-process transaction semantics.`);
  const { workspace, mission } = readCurrentMission(root, options.missionId, options.operation ?? actionId);
  assertMissionAcceptsWrites(workspace, mission, { receipt: true });
  const rawWrites = Array.isArray(options.writes) ? options.writes : [];
  const writes = rawWrites.map((item, index) => normalizeWrite(root, mission.missionId, item, index));
  const externalArtifacts = Array.isArray(options.externalArtifacts) ? options.externalArtifacts : [];
  const validations = (Array.isArray(options.validations) ? options.validations : []).map((item, index) => createValidationRecord(item, { label: `${actionId}.validations[${index}]` }));
  const allArtifactPaths = [...externalArtifacts.map((item) => item.path), ...writes.map((item) => item.path)];
  const duplicatePath = allArtifactPaths.find((item, index, items) => items.indexOf(item) !== index);
  if (duplicatePath) throw new Error(`${actionId} contains duplicate artifact path ${duplicatePath}.`);
  const validationPaths = validations.map((item) => item.reference);
  const duplicateValidation = validationPaths.find((item, index, items) => items.indexOf(item) !== index);
  if (duplicateValidation) throw new Error(`${actionId} contains duplicate validation path ${duplicateValidation}.`);
  const overlap = validationPaths.find((item) => allArtifactPaths.includes(item));
  if (overlap) throw new Error(`${actionId} artifact and validation paths must be canonically distinct: ${overlap}.`);
  assertWritableOwnedArtifacts(root, workspace, mission, actionId, writes);

  if (allArtifactPaths.length === 0 && validations.length === 0) {
    return { receipt: null, artifacts: [], writes: [] };
  }
  context.requireCommitPrecondition(ARTIFACT_PATHS.executionReceiptsDir);
  context.requireCommitLock(".dove/.receipt-ledger-append.lock", { label: "Execution receipt ledger append lock" });
  const receiptId = domainSafeId(options.receiptId, "receiptId");
  const receiptPath = path.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
  if (context.fileExists(receiptPath)) throw new Error(`Execution receipt id is already occupied: ${receiptId}.`);
  const producedAt = domainNonEmptyText(options.producedAt, "producedAt");
  const recordedAt = nowIso();
  const baseReceipt = {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    receiptId,
    ledgerSequence: workspace.receiptLedger.nextLedgerSequence,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    summary: domainNonEmptyText(options.summary, "summary"),
    artifacts: [
      ...externalArtifacts.map((item) => ({ path: item.path, kind: item.kind ?? "other", sha256: item.sha256 })),
      ...writes.map((item) => ({ path: item.path, kind: item.kind, sha256: item.sha256 }))
    ],
    validations,
    criteriaSatisfied: [],
    producedAt,
    recordedAt,
    producer: { kind: "dove-internal", actionId }
  };
  const explicitReferences = new Map([
    ...externalArtifacts.map((item) => [item.path, item.derivedReferences ?? []]),
    ...writes.map((item) => [item.path, item.derivedReferences])
  ]);
  const receipt = { ...baseReceipt, artifacts: deriveArtifactReferences(baseReceipt, explicitReferences) };
  assertReceiptAppendable(workspace.receiptLedger, receipt, { artifactHandoffs: workspace.artifactHandoffs });
  writeNormalizedDomainArtifacts(root, writes);
  writeJson(root, receiptPath, receipt);
  return {
    receipt,
    artifacts: receipt.artifacts,
    writes: [...writes.map((item) => item.path), receiptPath]
  };
}

export function finalizeDomainArtifacts(root, options = {}) {
  const actionId = domainNonEmptyText(options.actionId, "actionId");
  assertGovernanceMutationRegistered(actionId, options.governanceMode ?? "guarded");
  const context = currentMutationContext(root);
  if (!context) throw new Error(`${actionId} requires an active MutationContext.`);
  const { workspace, mission } = readCurrentMission(root, options.missionId, options.operation ?? actionId);
  assertMissionAcceptsWrites(workspace, mission);
  context.requireCommitPrecondition(ARTIFACT_PATHS.executionReceiptsDir);
  context.requireCommitLock(".dove/.receipt-ledger-append.lock", { label: "Execution receipt ledger append lock" });
  if (!Array.isArray(options.writes) || options.writes.length === 0) throw new Error(`${actionId} requires at least one real domain artifact write.`);
  const writes = options.writes.map((item, index) => normalizeWrite(root, mission.missionId, item, index));
  const duplicatePath = writes.map((item) => item.path).find((item, index, items) => items.indexOf(item) !== index);
  if (duplicatePath) throw new Error(`${actionId} contains duplicate artifact path ${duplicatePath}.`);

  const receiptId = options.receiptId === undefined ? `receipt-${actionId}-${crypto.randomUUID()}` : domainSafeId(options.receiptId, "receiptId");
  const receiptPath = path.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
  if (context.fileExists(receiptPath)) throw new Error(`Generated execution receipt id is occupied: ${receiptId}.`);
  const ownershipBeforeWrite = readArtifactOwnership(root);
  const ownerByPath = new Map(ownershipBeforeWrite.artifacts.map((item) => [item.path, item]));
  for (const item of writes) {
    if (!context.fileExists(item.path)) continue;
    if (isDoveLessonArtifactPath(item.path)) {
      throw new Error(`${actionId} refuses to overwrite immutable lesson artifact ${item.path}.`);
    }
    const owner = ownerByPath.get(item.path);
    if (!owner) throw new Error(`${actionId} refuses to overwrite unowned existing artifact ${item.path}.`);
    const ownerReceipt = workspace.receiptLedger.receipts.find((receipt) => receipt.receiptId === owner.receiptId);
    if (ownerReceipt?.producer?.kind === "dove-internal" && ownerReceipt.producer.actionId === "archive-review-record") {
      throw new Error(`${actionId} refuses to overwrite immutable review archive ${item.path}.`);
    }
    if (
      owner.missionId !== mission.missionId
      && !handoffAuthorizes(workspace.artifactHandoffs, item.path, owner.missionId, mission.missionId, owner.receiptId, owner.sha256)
    ) {
      throw new Error(`${actionId} refuses to overwrite artifact ${item.path} without an explicit handoff from mission ${owner.missionId}.`);
    }
    const current = currentFileHash(root, item.path, item.path);
    if (current.sha256 !== owner.sha256) throw new Error(`${actionId} refuses to overwrite drifted artifact ${item.path}.`);
  }
  const artifacts = writes.map(({ path: artifactPath, kind, sha256 }) => ({ path: artifactPath, kind, sha256 }));
  const completionEligible = false;
  const criteriaSatisfied = [];
  const recordedAt = nowIso();
  const baseReceipt = {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    receiptId,
    ledgerSequence: workspace.receiptLedger.nextLedgerSequence,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    summary: domainNonEmptyText(options.summary, "summary"),
    artifacts,
    validations: [],
    criteriaSatisfied,
    producedAt: recordedAt,
    recordedAt,
    producer: { kind: "dove-internal", actionId }
  };
  const receipt = {
    ...baseReceipt,
    artifacts: deriveArtifactReferences(baseReceipt, new Map(writes.map((item) => [item.path, item.derivedReferences])))
  };
  assertReceiptAppendable(workspace.receiptLedger, receipt, { artifactHandoffs: workspace.artifactHandoffs });

  for (const item of writes) {
    if (item.encoding === "binary") {
      if (isPatchPlanMode(root)) {
        writeText(root, item.path, item.content.toString("utf8"));
      } else {
        context.writeBinary(item.path, item.content);
      }
    } else writeText(root, item.path, item.content.toString("utf8"));
  }
  writeJson(root, receiptPath, receipt);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "planned" : "recorded",
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    receipt,
    artifacts,
    completionEligible,
    mutation: {
      mutationMode: context.mutationMode,
      writesApplied: !plannedOnly,
      paths: [...writes.map((item) => item.path), receiptPath]
    }
  };
}
