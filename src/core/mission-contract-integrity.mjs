import crypto from "node:crypto";

import { artifactEvidenceRole, normalizeProjectRelativePath } from "./artifact-integrity.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";

export const MISSION_CONTRACT_SCHEMA_VERSION = 5;
export const MISSION_MODES = Object.freeze(["ordinary", "research"]);
export const MISSION_BRANCH_KINDS = Object.freeze(["continuation", "alternative", "follow-up", "recovery"]);
export const MISSION_CRITERION_ID_VERSION = 2;
export const MISSION_EVIDENCE_REQUIREMENT_ID_VERSION = 2;
export const MISSION_ARTIFACT_ROLES = Object.freeze(["output", "input-output", "supporting"]);

export const MISSION_CONTRACT_INPUT_FIELDS = Object.freeze([
  "missionId", "mode", "goal", "requirements", "assumptions", "scope", "outOfScope", "artifacts",
  "completionCriteria", "evidenceRequirements", "dependsOnMissionIds", "parentMissionId", "branchKind", "branchReason"
]);
export const PERSISTED_MISSION_FIELDS = Object.freeze([
  "schemaVersion", "workspaceId", "workspaceRevisionId", "workspaceRevisionDigest", "missionId", "mode",
  "contractDigest", "createdAt", "goal", "requirements", "assumptions", "scope", "outOfScope", "artifacts",
  "completionCriteria", "evidenceRequirements", "dependsOnMissionIds", "parentMissionId", "branchKind", "branchReason"
]);

const PERSISTED_FIELD_SET = new Set(PERSISTED_MISSION_FIELDS);
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const MODE_SET = new Set(MISSION_MODES);
const BRANCH_KIND_SET = new Set(MISSION_BRANCH_KINDS);
const ARTIFACT_ROLE_SET = new Set(MISSION_ARTIFACT_ROLES);
const TYPED_EVIDENCE_PATTERN = /^(artifact|validation):(.+)$/u;
const ARTIFACT_FIELDS = new Set(["path", "required", "role"]);
const CRITERION_FIELDS = new Set(["criterionId", "criterion"]);
const EVIDENCE_FIELDS = new Set(["requirementId", "requirement"]);

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  return value;
}
export function stableMissionSerialize(value) { return JSON.stringify(stableValue(value)); }
function plain(value, label) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`); }
function sealed(value, fields, label) { plain(value, label); const unknown = Object.keys(value).filter((field) => !fields.has(field)); if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`); }
function text(value, label) { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`); return value.trim(); }
function safeId(value, label) { const normalized = text(value, label); if (!SAFE_ID.test(normalized)) throw new Error(`${label} must be a safe lowercase identifier.`); return normalized; }
function hash(value, label) { const normalized = text(value, label); if (!HASH.test(normalized)) throw new Error(`${label} must be a lowercase SHA-256 digest.`); return normalized; }
function exactIso(value, label) { if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`); return value; }
function strings(value, label) { if (value === undefined) return []; if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); const result = value.map((item, index) => text(item, `${label}[${index}]`)); if (new Set(result).size !== result.length) throw new Error(`${label} must not contain duplicates.`); return result; }

function canonicalPath(rawPath, label) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok || normalized.normalizedPath !== String(rawPath).trim().replace(/\\/gu, "/")) throw new Error(`${label} must be a canonical safe project-relative path.`);
  const role = artifactEvidenceRole(normalized.normalizedPath);
  if (normalized.normalizedPath === ARTIFACT_PATHS.lessonsDocument) throw new Error(`${label} must not reference the advisory-only Lessons document.`);
  if (role === "bookkeeping" || role === "unsupported") throw new Error(`${label} must reference a substantive current-schema or external project artifact.`);
  return normalized.normalizedPath;
}

function normalizeArtifacts(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("artifacts must be an array.");
  const result = value.map((item, index) => {
    const label = `artifacts[${index}]`;
    sealed(item, ARTIFACT_FIELDS, label);
    const role = text(item.role, `${label}.role`);
    if (!ARTIFACT_ROLE_SET.has(role)) throw new Error(`${label}.role must be one of: ${MISSION_ARTIFACT_ROLES.join(", ")}.`);
    if (typeof item.required !== "boolean") throw new Error(`${label}.required must be boolean.`);
    return { path: canonicalPath(item.path, `${label}.path`), required: item.required, role };
  });
  if (new Set(result.map((item) => item.path)).size !== result.length) throw new Error("artifacts must not contain duplicate paths.");
  return result;
}

export function missionCompletionCriterionId(_index, criterion) {
  return `criterion-${sha256(stableMissionSerialize({ version: MISSION_CRITERION_ID_VERSION, criterion })).slice(0, 16)}`;
}
export function missionEvidenceRequirementId(_index, requirement) {
  return `evidence-${sha256(stableMissionSerialize({ version: MISSION_EVIDENCE_REQUIREMENT_ID_VERSION, requirement })).slice(0, 16)}`;
}
function normalizeCriteria(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("completionCriteria must be an array.");
  const result = value.map((item, index) => {
    const label = `completionCriteria[${index}]`;
    if (typeof item === "string") {
      const criterion = text(item, label);
      return { criterionId: missionCompletionCriterionId(index, criterion), criterion };
    }
    sealed(item, CRITERION_FIELDS, label);
    const criterion = text(item.criterion, `${label}.criterion`);
    const criterionId = safeId(item.criterionId, `${label}.criterionId`);
    if (criterionId !== missionCompletionCriterionId(index, criterion)) throw new Error(`${label}.criterionId does not match its canonical criterion.`);
    return { criterionId, criterion };
  });
  if (new Set(result.map((item) => item.criterionId)).size !== result.length) throw new Error("completionCriteria must not contain duplicate criteria.");
  return result;
}
function normalizeEvidenceReference(value, label) {
  const requirement = text(value, label);
  if (requirement === "review:authoritative" || requirement.startsWith("source:")) throw new Error(`${label} requests authority that this mission contract cannot mint.`);
  const match = TYPED_EVIDENCE_PATTERN.exec(requirement);
  if (!match) throw new Error(`${label} must use artifact:<path> or validation:<path>.`);
  const [, kind, raw] = match;
  return `${kind}:${canonicalPath(raw, label)}`;
}
function normalizeEvidenceRequirements(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("evidenceRequirements must be an array.");
  const result = value.map((item, index) => {
    const label = `evidenceRequirements[${index}]`;
    if (typeof item === "string") {
      const requirement = normalizeEvidenceReference(item, label);
      return { requirementId: missionEvidenceRequirementId(index, requirement), requirement };
    }
    sealed(item, EVIDENCE_FIELDS, label);
    const requirement = normalizeEvidenceReference(item.requirement, `${label}.requirement`);
    const requirementId = safeId(item.requirementId, `${label}.requirementId`);
    if (requirementId !== missionEvidenceRequirementId(index, requirement)) throw new Error(`${label}.requirementId does not match its canonical requirement.`);
    return { requirementId, requirement };
  });
  if (new Set(result.map((item) => item.requirementId)).size !== result.length) throw new Error("evidenceRequirements must not contain duplicates.");
  return result;
}

export function normalizeMissionMode(value) { const mode = text(value, "Mission mode"); if (!MODE_SET.has(mode)) throw new Error(`Mission mode must be one of: ${MISSION_MODES.join(", ")}.`); return mode; }
export function normalizeMissionContractContent(value = {}) {
  plain(value, "Mission contract");
  const content = {
    mode: normalizeMissionMode(value.mode),
    goal: text(value.goal, "Dove mission goal"),
    requirements: strings(value.requirements, "requirements"),
    assumptions: strings(value.assumptions, "assumptions"),
    scope: strings(value.scope, "scope"),
    outOfScope: strings(value.outOfScope, "outOfScope"),
    artifacts: normalizeArtifacts(value.artifacts),
    completionCriteria: normalizeCriteria(value.completionCriteria),
    evidenceRequirements: normalizeEvidenceRequirements(value.evidenceRequirements),
    dependsOnMissionIds: strings(value.dependsOnMissionIds, "dependsOnMissionIds").map((item, index) => safeId(item, `dependsOnMissionIds[${index}]`))
  };
  const parentMissionId = value.parentMissionId === undefined ? null : safeId(value.parentMissionId, "parentMissionId");
  const branchKind = value.branchKind === undefined ? null : text(value.branchKind, "branchKind");
  const branchReason = value.branchReason === undefined ? null : text(value.branchReason, "branchReason");
  if (parentMissionId) {
    if (!BRANCH_KIND_SET.has(branchKind)) throw new Error(`branchKind must be one of: ${MISSION_BRANCH_KINDS.join(", ")}.`);
    if (!branchReason) throw new Error("Child missions require branchReason.");
    Object.assign(content, { parentMissionId, branchKind, branchReason });
  } else if (branchKind || branchReason) throw new Error("Root missions must not declare branchKind or branchReason.");
  return content;
}

export function missionCompletionCriteria(content = {}) { return normalizeCriteria(content.completionCriteria); }
export function missionEvidenceRequirements(content = {}) { return normalizeEvidenceRequirements(content.evidenceRequirements); }
export function missionContractDigest(missionId, content, workspaceRevision = {}) {
  const normalizedMissionId = safeId(missionId, "missionId");
  const workspaceRevisionId = safeId(workspaceRevision.workspaceRevisionId, "workspaceRevisionId");
  const workspaceRevisionDigest = hash(workspaceRevision.workspaceRevisionDigest, "workspaceRevisionDigest");
  return sha256(stableMissionSerialize({ schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION, missionId: normalizedMissionId, workspaceRevisionId, workspaceRevisionDigest, ...normalizeMissionContractContent(content) }));
}

export function currentMissionContractMetadata(mission = {}) {
  sealed(mission, PERSISTED_FIELD_SET, "Mission contract");
  if (mission.schemaVersion !== MISSION_CONTRACT_SCHEMA_VERSION) throw new Error(`Mission contract schemaVersion ${mission.schemaVersion ?? "missing"} is unsupported.`);
  const missionId = safeId(mission.missionId, "Mission contract missionId");
  const workspaceId = safeId(mission.workspaceId, "Mission contract workspaceId");
  const workspaceRevisionId = safeId(mission.workspaceRevisionId, "Mission contract workspaceRevisionId");
  const workspaceRevisionDigest = hash(mission.workspaceRevisionDigest, "Mission contract workspaceRevisionDigest");
  const createdAt = exactIso(mission.createdAt, "Mission contract createdAt");
  const content = normalizeMissionContractContent(mission);
  const contractDigest = missionContractDigest(missionId, content, { workspaceRevisionId, workspaceRevisionDigest });
  return { missionId, workspaceId, workspaceRevisionId, workspaceRevisionDigest, createdAt, content, contractDigest, completionCriteria: content.completionCriteria, evidenceRequirements: content.evidenceRequirements };
}
export function assertCurrentMissionContract(mission = {}, options = {}) {
  const current = currentMissionContractMetadata(mission);
  const label = options.label ?? `Mission contract ${current.missionId}`;
  if (options.workspaceId !== undefined && current.workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  if (options.filename !== undefined && options.filename !== `${current.missionId}.json`) throw new Error(`${label} filename must match missionId ${current.missionId}.`);
  if (mission.contractDigest !== current.contractDigest) throw new Error(`${label}.contractDigest does not match its canonical mission content.`);
  return current;
}
export function validatePersistedMission(mission, options = {}) { assertCurrentMissionContract(mission, options); return mission; }
