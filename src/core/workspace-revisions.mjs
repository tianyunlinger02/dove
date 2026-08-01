import crypto from "node:crypto";
import path from "node:path";

import { ARTIFACT_PATHS } from "./schema.mjs";

export const WORKSPACE_REVISION_SCHEMA_VERSION = 2;

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const FIELDS = new Set([
  "schemaVersion",
  "workspaceId",
  "revisionId",
  "revisionDigest",
  "revision",
  "previousRevisionId",
  "previousRevisionDigest",
  "mainline",
  "changeReason",
  "createdAt"
]);
const SCHEMA_1_FIELDS = new Set([
  "schemaVersion",
  "workspaceId",
  "revisionId",
  "revisionDigest",
  "revision",
  "previousRevisionId",
  "previousRevisionDigest",
  "projectGoal",
  "researchMainline",
  "changeReason",
  "createdAt"
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

export function stableWorkspaceRevisionSerialize(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}

function assertSealed(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}

function safeId(value, label) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return value;
}

function hash(value, label) {
  if (typeof value !== "string" || !HASH.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return value;
}

function text(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function exactIso(value, label) {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value;
}

function normalizedContent(value) {
  const workspaceId = safeId(value.workspaceId, "Workspace revision workspaceId");
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error("Workspace revision number must be a positive safe integer.");
  const previousRevisionId = value.previousRevisionId === null ? null : safeId(value.previousRevisionId, "Workspace revision previousRevisionId");
  const previousRevisionDigest = value.previousRevisionDigest === null ? null : hash(value.previousRevisionDigest, "Workspace revision previousRevisionDigest");
  if (value.revision === 1 && (previousRevisionId !== null || previousRevisionDigest !== null)) throw new Error("Workspace revision 1 requires null predecessor fields.");
  if (value.revision > 1 && (previousRevisionId === null || previousRevisionDigest === null)) throw new Error(`Workspace revision ${value.revision} requires predecessor fields.`);
  return {
    workspaceId,
    revision: value.revision,
    previousRevisionId,
    previousRevisionDigest,
    mainline: text(value.mainline, "Workspace revision mainline"),
    changeReason: text(value.changeReason, "Workspace revision changeReason"),
    createdAt: exactIso(value.createdAt, "Workspace revision createdAt")
  };
}

export function workspaceRevisionDigest(value) {
  const content = normalizedContent(value);
  return sha256(stableWorkspaceRevisionSerialize({ schemaVersion: WORKSPACE_REVISION_SCHEMA_VERSION, ...content }));
}

export function workspaceRevisionId(workspaceId, revision, digest) {
  safeId(workspaceId, "Workspace revision workspaceId");
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Workspace revision number must be positive.");
  hash(digest, "Workspace revision digest");
  return `workspace-revision-${revision}-${sha256(stableWorkspaceRevisionSerialize({ workspaceId, revision, digest })).slice(0, 20)}`;
}

export function createWorkspaceRevision(value) {
  const content = normalizedContent(value);
  const revisionDigest = workspaceRevisionDigest(content);
  const revisionId = workspaceRevisionId(content.workspaceId, content.revision, revisionDigest);
  return { schemaVersion: WORKSPACE_REVISION_SCHEMA_VERSION, revisionId, revisionDigest, ...content };
}

export function validateWorkspaceRevision(value, options = {}) {
  const label = options.label ?? "Workspace revision";
  assertSealed(value, FIELDS, label);
  if (value.schemaVersion !== WORKSPACE_REVISION_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  const content = normalizedContent(value);
  const revisionDigest = workspaceRevisionDigest(content);
  const revisionId = workspaceRevisionId(content.workspaceId, content.revision, revisionDigest);
  if (value.revisionDigest !== revisionDigest) throw new Error(`${label}.revisionDigest does not match its canonical content.`);
  if (value.revisionId !== revisionId) throw new Error(`${label}.revisionId does not match its canonical content.`);
  if (options.workspaceId !== undefined && content.workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  if (options.filename !== undefined && options.filename !== `${revisionId}.json`) throw new Error(`${label} filename must match revisionId ${revisionId}.`);
  return { schemaVersion: WORKSPACE_REVISION_SCHEMA_VERSION, revisionId, revisionDigest, ...content };
}

export function validateSchema12WorkspaceRevision(value, options = {}) {
  const label = options.label ?? "Schema 12 workspace revision";
  assertSealed(value, SCHEMA_1_FIELDS, label);
  if (value.schemaVersion !== 1) throw new Error(`${label} has an unsupported schemaVersion.`);
  const workspaceId = safeId(value.workspaceId, `${label}.workspaceId`);
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error(`${label}.revision must be a positive safe integer.`);
  const previousRevisionId = value.previousRevisionId === null ? null : safeId(value.previousRevisionId, `${label}.previousRevisionId`);
  const previousRevisionDigest = value.previousRevisionDigest === null ? null : hash(value.previousRevisionDigest, `${label}.previousRevisionDigest`);
  if (value.revision === 1 && (previousRevisionId !== null || previousRevisionDigest !== null)) throw new Error(`${label} revision 1 requires null predecessor fields.`);
  if (value.revision > 1 && (previousRevisionId === null || previousRevisionDigest === null)) throw new Error(`${label} revision ${value.revision} requires predecessor fields.`);
  const content = {
    workspaceId,
    revision: value.revision,
    previousRevisionId,
    previousRevisionDigest,
    projectGoal: text(value.projectGoal, `${label}.projectGoal`),
    researchMainline: text(value.researchMainline, `${label}.researchMainline`),
    changeReason: text(value.changeReason, `${label}.changeReason`),
    createdAt: exactIso(value.createdAt, `${label}.createdAt`)
  };
  const revisionDigest = sha256(stableWorkspaceRevisionSerialize({ schemaVersion: 1, ...content }));
  const revisionId = workspaceRevisionId(workspaceId, value.revision, revisionDigest);
  if (value.revisionDigest !== revisionDigest || value.revisionId !== revisionId) throw new Error(`${label} does not match its canonical schema 12 content.`);
  if (options.workspaceId !== undefined && workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  if (options.filename !== undefined && options.filename !== `${revisionId}.json`) throw new Error(`${label} filename must match revisionId ${revisionId}.`);
  return { schemaVersion: 1, revisionId, revisionDigest, ...content };
}

export function validateWorkspaceRevisionChain(values, project, options = {}) {
  if (!Array.isArray(values) || values.length === 0) throw new Error("Workspace revisions must contain at least one revision.");
  const validateRevision = options.schemaVersion === 1 ? validateSchema12WorkspaceRevision : validateWorkspaceRevision;
  const revisions = values.map((value) => validateRevision(value, { workspaceId: project.workspaceId }));
  const byId = new Map();
  const byNumber = new Map();
  for (const revision of revisions) {
    if (byId.has(revision.revisionId) || byNumber.has(revision.revision)) throw new Error("Workspace revision chain contains duplicate identity or revision number.");
    byId.set(revision.revisionId, revision);
    byNumber.set(revision.revision, revision);
  }
  for (const revision of revisions) {
    if (revision.revision === 1) continue;
    const previous = byNumber.get(revision.revision - 1);
    if (!previous || revision.previousRevisionId !== previous.revisionId || revision.previousRevisionDigest !== previous.revisionDigest) {
      throw new Error(`Workspace revision ${revision.revision} does not directly follow revision ${revision.revision - 1}.`);
    }
    if (Date.parse(revision.createdAt) < Date.parse(previous.createdAt)) throw new Error(`Workspace revision ${revision.revision} createdAt precedes its predecessor.`);
  }
  const ordered = [...revisions].sort((left, right) => left.revision - right.revision);
  if (ordered[0].revision !== 1 || ordered.at(-1).revision !== ordered.length) throw new Error("Workspace revisions must form one contiguous append-only chain from revision 1.");
  const current = byId.get(project.currentRevisionId);
  if (!current || current.revisionDigest !== project.currentRevisionDigest || current.revision !== ordered.length) {
    throw new Error("Dove project current revision pointer does not identify the unique workspace revision head.");
  }
  return { revisions: ordered, byId, current };
}

export function workspaceRevisionPath(revisionId) {
  safeId(revisionId, "Workspace revision id");
  return path.posix.join(ARTIFACT_PATHS.workspaceRevisionsDir, `${revisionId}.json`);
}
