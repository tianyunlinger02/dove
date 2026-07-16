import crypto from "node:crypto";

export const MISSION_CONTRACT_SCHEMA_VERSION = 1;
export const MISSION_CRITERION_ID_VERSION = 1;
export const MISSION_EVIDENCE_REQUIREMENT_ID_VERSION = 1;

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

export function missionCompletionCriterionId(_index, criterion) {
  return `criterion-${sha256(stableMissionSerialize({
    version: MISSION_CRITERION_ID_VERSION,
    criterion
  })).slice(0, 16)}`;
}

export function missionEvidenceRequirementId(_index, requirement) {
  return `evidence-${sha256(stableMissionSerialize({
    version: MISSION_EVIDENCE_REQUIREMENT_ID_VERSION,
    requirement
  })).slice(0, 16)}`;
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
