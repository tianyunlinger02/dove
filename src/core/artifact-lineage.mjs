import { ARTIFACT_PATHS } from "./schema.mjs";
import { nowIso, readJson } from "./workspace.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

export const ARTIFACT_OWNERSHIP_SCHEMA_VERSION = 1;
export const ARTIFACT_LINEAGE_SCHEMA_VERSION = 1;

const OWNERSHIP_FIELDS = new Set(["schemaVersion", "workspaceId", "artifacts", "updatedAt"]);
const LINEAGE_FIELDS = new Set(["schemaVersion", "workspaceId", "artifacts", "updatedAt"]);
const OWNERSHIP_ITEM_FIELDS = new Set(["path", "kind", "sha256", "missionId", "contractDigest", "receiptId"]);
const LINEAGE_ITEM_FIELDS = new Set([...OWNERSHIP_ITEM_FIELDS, "derivedReferences"]);
const HASH_PATTERN = /^[0-9a-f]{64}$/u;

export function createArtifactOwnershipIndex(workspaceId = null) {
  return {
    schemaVersion: ARTIFACT_OWNERSHIP_SCHEMA_VERSION,
    workspaceId,
    artifacts: [],
    updatedAt: null
  };
}

export function createArtifactLineageIndex(workspaceId = null) {
  return {
    schemaVersion: ARTIFACT_LINEAGE_SCHEMA_VERSION,
    workspaceId,
    artifacts: [],
    updatedAt: null
  };
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}

function assertAllowedFields(value, allowed, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function normalizeIndex(value, { label, schemaVersion, workspaceId, fields, itemFields, lineage = false }) {
  assertAllowedFields(value, fields, label);
  if (value.schemaVersion !== schemaVersion) {
    throw new Error(`${label} has an unsupported schemaVersion.`);
  }
  if (typeof value.workspaceId !== "string" || value.workspaceId !== workspaceId) {
    throw new Error(`${label}.workspaceId does not match the current manifest workspaceId.`);
  }
  if (!Array.isArray(value.artifacts)) throw new Error(`${label}.artifacts must be an array.`);
  if (value.updatedAt !== null && typeof value.updatedAt !== "string") throw new Error(`${label}.updatedAt must be a string or null.`);
  const seen = new Set();
  const artifacts = value.artifacts.map((item, index) => {
    const itemLabel = `${label}.artifacts[${index}]`;
    assertAllowedFields(item, itemFields, itemLabel);
    const normalized = {
      path: assertString(item.path, `${itemLabel}.path`),
      kind: assertString(item.kind, `${itemLabel}.kind`),
      sha256: assertString(item.sha256, `${itemLabel}.sha256`).toLowerCase(),
      missionId: assertString(item.missionId, `${itemLabel}.missionId`),
      contractDigest: assertString(item.contractDigest, `${itemLabel}.contractDigest`).toLowerCase(),
      receiptId: assertString(item.receiptId, `${itemLabel}.receiptId`)
    };
    if (!HASH_PATTERN.test(normalized.sha256) || !HASH_PATTERN.test(normalized.contractDigest)) {
      throw new Error(`${itemLabel} contains an invalid SHA-256 digest.`);
    }
    if (seen.has(normalized.path)) throw new Error(`${label}.artifacts contains duplicate path ${normalized.path}.`);
    seen.add(normalized.path);
    if (lineage) {
      if (!Array.isArray(item.derivedReferences) || item.derivedReferences.some((reference) => typeof reference !== "string" || !reference.trim())) {
        throw new Error(`${itemLabel}.derivedReferences must be an array of non-empty strings.`);
      }
      const derivedReferences = item.derivedReferences.map((reference) => reference.trim());
      if (new Set(derivedReferences).size !== derivedReferences.length) {
        throw new Error(`${itemLabel}.derivedReferences contains duplicates.`);
      }
      normalized.derivedReferences = derivedReferences;
    }
    return normalized;
  });
  return { schemaVersion, workspaceId, artifacts, updatedAt: value.updatedAt };
}

export function readArtifactOwnership(root) {
  const workspace = openDoveWorkspace(root, { operation: "Artifact ownership read" });
  return normalizeIndex(readJson(root, ARTIFACT_PATHS.artifactOwnership, () => createArtifactOwnershipIndex(workspace.manifest.workspaceId)), {
    label: "Artifact ownership index",
    schemaVersion: ARTIFACT_OWNERSHIP_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    fields: OWNERSHIP_FIELDS,
    itemFields: OWNERSHIP_ITEM_FIELDS
  });
}

export function readArtifactLineage(root) {
  const workspace = openDoveWorkspace(root, { operation: "Artifact lineage read" });
  return normalizeIndex(readJson(root, ARTIFACT_PATHS.artifactLineage, () => createArtifactLineageIndex(workspace.manifest.workspaceId)), {
    label: "Artifact lineage index",
    schemaVersion: ARTIFACT_LINEAGE_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    fields: LINEAGE_FIELDS,
    itemFields: LINEAGE_ITEM_FIELDS,
    lineage: true
  });
}

function mergeOwnedPaths(items, additions) {
  const next = new Map(items.map((item) => [item.path, item]));
  for (const item of additions) {
    const existing = next.get(item.path);
    if (existing && existing.missionId !== item.missionId) {
      throw new Error(`Artifact path ${item.path} is already owned by mission ${existing.missionId}; mission ${item.missionId} cannot overwrite it.`);
    }
    next.set(item.path, item);
  }
  return [...next.values()].sort((left, right) => left.path.localeCompare(right.path));
}

export function prepareArtifactLineageUpdate(root, receipt) {
  const timestamp = nowIso();
  const ownership = readArtifactOwnership(root);
  const lineage = readArtifactLineage(root);
  const ownershipItems = receipt.artifacts.map((artifact) => ({
    path: artifact.path,
    kind: artifact.kind,
    sha256: artifact.sha256,
    missionId: receipt.missionId,
    contractDigest: receipt.contractDigest,
    receiptId: receipt.receiptId
  }));
  const criterionRefsByArtifact = new Map(receipt.artifacts.map((artifact) => [artifact.path, new Set()]));
  for (const criterion of receipt.criteriaSatisfied) {
    for (const evidenceRef of criterion.evidenceRefs) {
      if (!evidenceRef.startsWith("artifact:")) continue;
      const artifactPath = evidenceRef.slice("artifact:".length);
      criterionRefsByArtifact.get(artifactPath)?.add(`criterion:${criterion.criterionId}`);
    }
  }
  const lineageItems = ownershipItems.map((item) => ({
    ...item,
    derivedReferences: [...(criterionRefsByArtifact.get(item.path) ?? [])].sort()
  }));
  return {
    ownership: {
      schemaVersion: ARTIFACT_OWNERSHIP_SCHEMA_VERSION,
      workspaceId: ownership.workspaceId,
      artifacts: mergeOwnedPaths(ownership.artifacts, ownershipItems),
      updatedAt: timestamp
    },
    lineage: {
      schemaVersion: ARTIFACT_LINEAGE_SCHEMA_VERSION,
      workspaceId: lineage.workspaceId,
      artifacts: mergeOwnedPaths(lineage.artifacts, lineageItems),
      updatedAt: timestamp
    },
    ownershipPaths: ownershipItems.map((item) => item.path),
    lineagePaths: lineageItems.map((item) => item.path)
  };
}
