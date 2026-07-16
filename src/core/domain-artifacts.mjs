import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { inspectDeclaredPath, normalizeProjectRelativePath } from "./artifact-integrity.mjs";
import { readArtifactOwnership } from "./artifact-lineage.mjs";
import { assertCurrentMissionContract } from "./mission-contracts.mjs";
import { currentMutationContext, isPatchPlanMode } from "./mutation-backend.mjs";
import { sha256File } from "./review-artifact-snapshot.mjs";
import { assertReceiptAppendable, deriveArtifactReferences, EXECUTION_RECEIPT_SCHEMA_VERSION } from "./receipt-ledger.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
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
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of non-empty strings.`);
  const items = value.map((item, index) => domainNonEmptyText(item, `${label}[${index}]`));
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
  return normalized.ok && (
    normalized.normalizedPath === ARTIFACT_PATHS.lessonsDir
    || normalized.normalizedPath.startsWith(`${ARTIFACT_PATHS.lessonsDir}/`)
  );
}

export function assertNotDoveLessonArtifactPath(rawPath, label = "artifact") {
  if (isDoveLessonArtifactPath(rawPath)) {
    throw new Error(`${label} must not use a Dove lesson as substantive artifact or evidence.`);
  }
}

export function resolveMissionArtifactReferences(root, missionId, references = [], label = "artifactRefs") {
  const normalized = domainStringArray(references, label);
  if (normalized.length === 0) return [];
  const ownership = readArtifactOwnership(root);
  const byPath = new Map(ownership.artifacts.map((item) => [item.path, item]));
  return normalized.map((rawPath, index) => {
    const artifactPath = canonicalDomainPath(rawPath, `${label}[${index}]`);
    assertNotDoveLessonArtifactPath(artifactPath, `${label}[${index}]`);
    const owner = byPath.get(artifactPath);
    if (!owner) throw new Error(`${label}[${index}] is not a registered schema 8 artifact: ${artifactPath}.`);
    if (owner.missionId !== missionId) throw new Error(`${label}[${index}] belongs to mission ${owner.missionId}, not ${missionId}.`);
    const current = currentFileHash(root, artifactPath, `${label}[${index}]`);
    if (current.sha256 !== owner.sha256) throw new Error(`${label}[${index}] has changed since its latest ownership receipt: ${artifactPath}.`);
    return { ...owner, ...current };
  });
}

function normalizeWrite(root, missionId, item, index, options = {}) {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`domainWrites[${index}] must be an object.`);
  const relativePath = canonicalDomainPath(item.path, `domainWrites[${index}].path`, ".dove");
  if (isDoveLessonArtifactPath(relativePath) && options.allowLessonArtifacts !== true) {
    throw new Error(`domainWrites[${index}].path may create a Dove lesson only through record_dove_lesson.`);
  }
  if (options.allowLessonArtifacts === true && !isDoveLessonArtifactPath(relativePath)) {
    throw new Error(`domainWrites[${index}].path must stay under ${ARTIFACT_PATHS.lessonsDir} for lesson recording.`);
  }
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

export function finalizeDomainArtifacts(root, options = {}) {
  const actionId = domainNonEmptyText(options.actionId, "actionId");
  assertGovernanceMutationRegistered(actionId, options.governanceMode ?? "guarded");
  const context = currentMutationContext(root);
  if (!context) throw new Error(`${actionId} requires an active MutationContext.`);
  const { workspace, mission } = readCurrentMission(root, options.missionId, options.operation ?? actionId);
  context.requireCommitPrecondition(ARTIFACT_PATHS.executionReceiptsDir);
  context.requireCommitLock(".dove/.receipt-ledger-append.lock", { label: "Execution receipt ledger append lock" });
  if (!Array.isArray(options.writes) || options.writes.length === 0) throw new Error(`${actionId} requires at least one real domain artifact write.`);
  const writes = options.writes.map((item, index) => normalizeWrite(root, mission.missionId, item, index, {
    allowLessonArtifacts: options.allowLessonArtifacts === true && actionId === "record-dove-lesson"
  }));
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
    if (ownerReceipt?.producer?.kind === "dove-internal" && ["prepare-review-exchange", "import-review-exchange"].includes(ownerReceipt.producer.actionId)) {
      throw new Error(`${actionId} refuses to overwrite immutable review ${ownerReceipt.producer.actionId === "prepare-review-exchange" ? "preparation control" : "import record"} ${item.path}.`);
    }
    if (owner.missionId !== mission.missionId) throw new Error(`${actionId} refuses to overwrite artifact ${item.path} owned by mission ${owner.missionId}.`);
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
  assertReceiptAppendable(workspace.receiptLedger, receipt);

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
