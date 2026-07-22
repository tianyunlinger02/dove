import crypto from "node:crypto";

import { artifactEvidenceRole, normalizeProjectRelativePath } from "./artifact-integrity.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";

export const MISSION_CONTRACT_SCHEMA_VERSION = 1;
export const MISSION_CRITERION_ID_VERSION = 1;
export const MISSION_EVIDENCE_REQUIREMENT_ID_VERSION = 1;

export const MISSION_CONTRACT_ARRAY_FIELDS = Object.freeze([
  "scope",
  "outOfScope",
  "targetArtifacts",
  "expectedArtifacts",
  "completionCriteria",
  "evidenceRequirements"
]);
export const MISSION_OPTIONAL_ARRAY_FIELDS = Object.freeze(["dependsOnMissionIds"]);
export const MISSION_CONTRACT_INPUT_FIELDS = Object.freeze([
  "missionId",
  "goal",
  ...MISSION_CONTRACT_ARRAY_FIELDS,
  ...MISSION_OPTIONAL_ARRAY_FIELDS,
  "supersedesMissionId"
]);
export const PERSISTED_MISSION_FIELDS = Object.freeze([
  "schemaVersion",
  "workspaceId",
  "missionId",
  "contractDigest",
  "createdAt",
  ...MISSION_CONTRACT_ARRAY_FIELDS,
  ...MISSION_OPTIONAL_ARRAY_FIELDS,
  "goal",
  "supersedesMissionId",
  "completionCriterionIds",
  "evidenceRequirementIds"
]);

const PERSISTED_MISSION_FIELD_SET = new Set(PERSISTED_MISSION_FIELDS);
const TYPED_EVIDENCE_REQUIREMENT_PATTERN = /^(artifact|validation|note):(.+)$/u;
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableMissionValue(value) {
  if (Array.isArray(value)) return value.map(stableMissionValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableMissionValue(item)])
    );
  }
  return value;
}

export function stableMissionSerialize(value) {
  return JSON.stringify(stableMissionValue(value));
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}

function normalizeString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeStringArray(value, label = "Mission contract array field") {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of non-empty strings.`);
  const normalized = value.map((item) => normalizeString(item, null));
  if (normalized.some((item) => item === null)) throw new Error(`${label} must contain only non-empty strings.`);
  return Array.from(new Set(normalized));
}

function canonicalContractPath(rawPath, label) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) throw new Error(`${label} has an unsafe project-relative path ${JSON.stringify(rawPath)}: ${normalized.reason}.`);
  const supplied = String(rawPath).trim().replace(/\\/gu, "/");
  if (normalized.normalizedPath !== supplied) throw new Error(`${label} path must be canonical: ${rawPath}.`);
  const evidenceRole = artifactEvidenceRole(normalized.normalizedPath);
  if (normalized.normalizedPath === ARTIFACT_PATHS.lessonsDir || normalized.normalizedPath.startsWith(`${ARTIFACT_PATHS.lessonsDir}/`)) {
    throw new Error(`${label} must not reference advisory-only Dove lessons: ${rawPath}.`);
  }
  if (normalized.normalizedPath === ARTIFACT_PATHS.researchTreesDir || normalized.normalizedPath.startsWith(`${ARTIFACT_PATHS.researchTreesDir}/`)) {
    throw new Error(`${label} must not reference Dove research-tree bookkeeping: ${rawPath}.`);
  }
  if (evidenceRole === "bookkeeping" || evidenceRole === "unsupported") {
    throw new Error(`${label} must reference a substantive current-schema artifact or an external project artifact, not Dove bookkeeping: ${rawPath}.`);
  }
  return normalized.normalizedPath;
}

function normalizeContractPaths(value, label) {
  return normalizeStringArray(value, label).map((item, index) => canonicalContractPath(item, `${label}[${index}]`));
}

function normalizeEvidenceRequirements(value) {
  return normalizeStringArray(value, "evidenceRequirements").map((requirement, index) => {
    if (requirement === "review:authoritative" || requirement.startsWith("source:")) {
      throw new Error(`evidenceRequirements[${index}] requests ${requirement}, but this local-first Dove schema has no public authority path that can satisfy source:<id> or review:authoritative requirements.`);
    }
    const match = TYPED_EVIDENCE_REQUIREMENT_PATTERN.exec(requirement);
    if (!match) throw new Error(`evidenceRequirements[${index}] must use artifact:<path>, validation:<path>, or note:<id>.`);
    const [, kind, rawValue] = match;
    const normalizedValue = normalizeString(rawValue, null);
    if (!normalizedValue) throw new Error(`evidenceRequirements[${index}] must contain a non-empty typed reference.`);
    if (kind === "artifact" || kind === "validation") return `${kind}:${canonicalContractPath(normalizedValue, `evidenceRequirements[${index}]`)}`;
    if (!SAFE_ID.test(normalizedValue)) throw new Error(`evidenceRequirements[${index}] note reference must be a safe lowercase identifier.`);
    return `${kind}:${normalizedValue}`;
  });
}

export function normalizeMissionContractContent(value = {}) {
  assertPlainObject(value, "Mission contract");
  const goal = normalizeString(value.goal, null);
  if (!goal) throw new Error("Dove mission requires a non-empty goal.");
  const content = { goal };
  for (const field of MISSION_CONTRACT_ARRAY_FIELDS) {
    if (field === "targetArtifacts" || field === "expectedArtifacts") content[field] = normalizeContractPaths(value[field], field);
    else if (field === "evidenceRequirements") content[field] = normalizeEvidenceRequirements(value[field]);
    else content[field] = normalizeStringArray(value[field], field);
  }
  const dependsOnMissionIds = normalizeStringArray(value.dependsOnMissionIds, "dependsOnMissionIds");
  for (const [index, missionId] of dependsOnMissionIds.entries()) {
    if (!SAFE_ID.test(missionId)) throw new Error(`dependsOnMissionIds[${index}] must be a safe lowercase identifier.`);
  }
  if (dependsOnMissionIds.length > 0) content.dependsOnMissionIds = dependsOnMissionIds;
  const supersedesMissionId = normalizeString(value.supersedesMissionId, null);
  if (supersedesMissionId) {
    if (!SAFE_ID.test(supersedesMissionId)) throw new Error("supersedesMissionId must be a safe lowercase identifier.");
    content.supersedesMissionId = supersedesMissionId;
  }
  return content;
}

export function missionCompletionCriterionId(_index, criterion) {
  return `criterion-${sha256(stableMissionSerialize({ version: MISSION_CRITERION_ID_VERSION, criterion })).slice(0, 16)}`;
}

export function missionEvidenceRequirementId(_index, requirement) {
  return `evidence-${sha256(stableMissionSerialize({ version: MISSION_EVIDENCE_REQUIREMENT_ID_VERSION, requirement })).slice(0, 16)}`;
}

export function missionCompletionCriteria(content = {}) {
  return (Array.isArray(content.completionCriteria) ? content.completionCriteria : []).map((criterion, index) => ({
    criterionId: missionCompletionCriterionId(index, criterion),
    criterion
  }));
}

export function missionEvidenceRequirements(content = {}) {
  return (Array.isArray(content.evidenceRequirements) ? content.evidenceRequirements : []).map((requirement, index) => ({
    requirementId: missionEvidenceRequirementId(index, requirement),
    requirement
  }));
}

export function missionContractDigest(missionId, content) {
  return sha256(stableMissionSerialize({
    schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION,
    missionId,
    ...content,
    completionCriterionIds: missionCompletionCriteria(content).map(({ criterionId }) => criterionId),
    evidenceRequirementIds: missionEvidenceRequirements(content).map(({ requirementId }) => requirementId)
  }));
}

export function currentMissionContractMetadata(mission = {}) {
  assertPlainObject(mission, "Mission contract");
  const unknown = Object.keys(mission).filter((field) => !PERSISTED_MISSION_FIELD_SET.has(field));
  if (unknown.length > 0) throw new Error(`Mission contract does not accept unknown persisted fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  if (mission.schemaVersion !== MISSION_CONTRACT_SCHEMA_VERSION) throw new Error(`Mission contract schemaVersion ${mission.schemaVersion ?? "missing"} is unsupported.`);
  const missionId = normalizeString(mission.missionId, null);
  if (!missionId || !SAFE_ID.test(missionId)) throw new Error("Mission contract has an invalid missionId.");
  const workspaceId = normalizeString(mission.workspaceId, null);
  if (!workspaceId || !SAFE_ID.test(workspaceId)) throw new Error(`Mission contract has an invalid workspaceId for ${missionId}.`);
  for (const field of ["contractDigest", "createdAt", "goal", ...MISSION_CONTRACT_ARRAY_FIELDS, "completionCriterionIds", "evidenceRequirementIds"]) {
    if (!Object.hasOwn(mission, field)) throw new Error(`Mission contract is missing required persisted field $.${field}.`);
  }
  if (!HASH.test(String(mission.contractDigest ?? ""))) throw new Error(`Mission contract has an invalid contractDigest for ${missionId}.`);
  const createdAt = normalizeString(mission.createdAt, null);
  if (!createdAt || !Number.isFinite(Date.parse(createdAt)) || new Date(Date.parse(createdAt)).toISOString() !== createdAt) {
    throw new Error(`Mission contract has an invalid createdAt timestamp for ${missionId}.`);
  }
  const content = normalizeMissionContractContent(mission);
  const completionCriterionIds = missionCompletionCriteria(content).map(({ criterionId }) => criterionId);
  const evidenceRequirementIds = missionEvidenceRequirements(content).map(({ requirementId }) => requirementId);
  return { missionId, workspaceId, createdAt, content, contractDigest: missionContractDigest(missionId, content), completionCriterionIds, evidenceRequirementIds };
}

export function assertCurrentMissionContract(mission = {}, options = {}) {
  const current = currentMissionContractMetadata(mission);
  const label = options.label ?? `Mission contract ${current.missionId}`;
  if (options.workspaceId !== undefined && current.workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  if (options.filename !== undefined && options.filename !== `${current.missionId}.json`) throw new Error(`${label} filename must match missionId ${current.missionId}.`);
  if (mission.contractDigest !== current.contractDigest) throw new Error(`${label}.contractDigest does not match its canonical mission content.`);
  if (!Array.isArray(mission.completionCriterionIds) || stableMissionSerialize(mission.completionCriterionIds) !== stableMissionSerialize(current.completionCriterionIds)) {
    throw new Error(`${label}.completionCriterionIds do not match canonical mission content.`);
  }
  if (!Array.isArray(mission.evidenceRequirementIds) || stableMissionSerialize(mission.evidenceRequirementIds) !== stableMissionSerialize(current.evidenceRequirementIds)) {
    throw new Error(`${label}.evidenceRequirementIds do not match canonical mission content.`);
  }
  return current;
}

export function validatePersistedMission(mission, options = {}) {
  assertCurrentMissionContract(mission, options);
  return mission;
}
