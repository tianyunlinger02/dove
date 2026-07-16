import fs from "node:fs";
import path from "node:path";

import { inspectDeclaredPath } from "./artifact-integrity.mjs";
import { isDoveLessonArtifactPath } from "./domain-artifacts.mjs";
import { readExecutionReceipts } from "./execution-receipts.mjs";
import { assertCurrentMissionContract, missionCompletionCriteria, missionEvidenceRequirements } from "./mission-contracts.mjs";
import { sha256File } from "./review-artifact-snapshot.mjs";
import { verifyReviewCoverage } from "./review-exchange.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { evaluateNoteReferences, evaluateSourceReferences } from "./source-trust.mjs";
import { readJson } from "./workspace.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const ARTIFACT_KINDS = new Set(["report", "document", "code", "data", "figure", "media", "other"]);
const VALIDATION_KINDS = new Set(["test-log", "typecheck-log", "lint-log", "build-log", "audit-log", "validation-log", "command-output"]);
const RECEIPT_FIELDS = new Set(["schemaVersion", "workspaceId", "receiptId", "ledgerSequence", "missionId", "contractDigest", "summary", "artifacts", "validations", "criteriaSatisfied", "producedAt", "recordedAt", "producer"]);
const ARTIFACT_FIELDS = new Set(["path", "kind", "sha256", "derivedReferences"]);
const VALIDATION_FIELDS = new Set(["kind", "reference", "outputHash"]);
const CRITERION_FIELDS = new Set(["criterionId", "evidenceRefs"]);

function missionPath(missionId) {
  return path.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}

function sealed(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => allowed.has(key));
}

function currentHashedFile(root, relativePath, expectedHash) {
  if (isDoveLessonArtifactPath(relativePath)) {
    return { current: false, reason: "lesson-advisory-only", path: relativePath ?? null, actualHash: null };
  }
  if (typeof relativePath !== "string" || !relativePath.trim() || !HASH_PATTERN.test(String(expectedHash ?? ""))) {
    return { current: false, reason: "hashed-file-input-invalid", path: relativePath ?? null, actualHash: null };
  }
  const suppliedPath = relativePath.trim().replace(/\\/gu, "/");
  const inspection = inspectDeclaredPath(root, suppliedPath, { requireNonEmpty: true });
  if (inspection.status !== "existing") {
    return { current: false, reason: inspection.reason ?? inspection.status, path: relativePath, actualHash: null };
  }
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (inspection.normalizedPath !== suppliedPath || canonicalPath !== suppliedPath) {
    return { current: false, reason: "canonical-path-changed", path: suppliedPath, canonicalPath, actualHash: null };
  }
  const actualHash = sha256File(path.resolve(root, canonicalPath));
  return {
    current: actualHash === expectedHash,
    reason: actualHash === expectedHash ? null : "hash-mismatch",
    path: canonicalPath,
    actualHash
  };
}

function typedEvidenceEligibility(root, missionId, reference) {
  if (reference.startsWith("source:")) {
    const value = reference.slice("source:".length);
    return evaluateSourceReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-source" };
  }
  if (reference.startsWith("note:")) {
    const value = reference.slice("note:".length);
    return evaluateNoteReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-note" };
  }
  return { eligible: null, reason: null };
}

function receiptAssessment(root, mission, receipt, workspaceId, missionCurrent = true) {
  const failures = [];
  if (receipt?.__readFailure) failures.push("receipt-json-malformed");
  if (!missionCurrent) failures.push("mission-contract-invalid");
  if (!sealed(receipt, RECEIPT_FIELDS) || receipt.schemaVersion !== 2) failures.push("receipt-schema-invalid");
  if (receipt.workspaceId !== workspaceId || mission.workspaceId !== workspaceId) failures.push("workspace-binding-mismatch");
  if (receipt.missionId !== mission.missionId) failures.push("mission-binding-mismatch");
  if (receipt?.contractDigest !== mission.contractDigest || !missionCurrent) failures.push("contract-digest-stale");
  if (!Array.isArray(receipt.artifacts) || receipt.artifacts.length === 0) failures.push("artifacts-missing");
  if (!Array.isArray(receipt.validations)) failures.push("validations-invalid");
  if (!Array.isArray(receipt.criteriaSatisfied)) failures.push("criteria-invalid");

  const artifactAssessments = (Array.isArray(receipt.artifacts) ? receipt.artifacts : []).map((artifact) => {
    if (!sealed(artifact, ARTIFACT_FIELDS) || typeof artifact.path !== "string" || !artifact.path.trim() || !ARTIFACT_KINDS.has(artifact.kind) || !HASH_PATTERN.test(String(artifact.sha256 ?? "")) || !Array.isArray(artifact.derivedReferences)) {
      return { path: artifact?.path ?? null, current: false, reason: "artifact-schema-invalid" };
    }
    return currentHashedFile(root, artifact.path, artifact.sha256);
  });
  const validationAssessments = (Array.isArray(receipt.validations) ? receipt.validations : []).map((validation) => {
    if (!sealed(validation, VALIDATION_FIELDS) || typeof validation.reference !== "string" || !validation.reference.trim() || !VALIDATION_KINDS.has(validation.kind) || !HASH_PATTERN.test(String(validation.outputHash ?? ""))) {
      return { path: validation?.reference ?? null, current: false, reason: "validation-schema-invalid" };
    }
    return currentHashedFile(root, validation.reference, validation.outputHash);
  });
  if (artifactAssessments.some((item) => !item.current)) failures.push("artifact-drift");
  if (validationAssessments.some((item) => !item.current)) failures.push("validation-drift");
  const artifactPaths = (Array.isArray(receipt.artifacts) ? receipt.artifacts : []).map((artifact) => artifact?.path).filter(Boolean);
  const validationPaths = (Array.isArray(receipt.validations) ? receipt.validations : []).map((validation) => validation?.reference).filter(Boolean);
  if (new Set(artifactPaths).size !== artifactPaths.length) failures.push("artifact-path-duplicate");
  if (new Set(validationPaths).size !== validationPaths.length) failures.push("validation-path-duplicate");
  const requiredArtifactPaths = new Set([
    ...(Array.isArray(mission.targetArtifacts) ? mission.targetArtifacts : []),
    ...(Array.isArray(mission.expectedArtifacts) ? mission.expectedArtifacts : [])
  ]);
  if ([...requiredArtifactPaths].some((requiredPath) => !artifactPaths.includes(requiredPath))) {
    failures.push("mission-artifact-coverage-missing");
  }

  const requiredCriteria = missionCompletionCriteria(mission);
  const requiredIds = new Set(requiredCriteria.map((criterion) => criterion.criterionId));
  const artifactRefs = new Set((receipt.artifacts ?? []).map((artifact) => `artifact:${artifact.path}`));
  const validationRefs = new Set((receipt.validations ?? []).map((validation) => `validation:${validation.reference}`));
  const seenCriteria = new Set();
  const criteria = (Array.isArray(receipt.criteriaSatisfied) ? receipt.criteriaSatisfied : []).map((criterion) => {
    const criterionFailures = [];
    if (!sealed(criterion, CRITERION_FIELDS)) criterionFailures.push("criterion-schema-invalid");
    if (!requiredIds.has(criterion?.criterionId)) criterionFailures.push("criterion-unknown");
    if (seenCriteria.has(criterion?.criterionId)) criterionFailures.push("criterion-duplicate");
    seenCriteria.add(criterion?.criterionId);
    const evidenceRefs = Array.isArray(criterion?.evidenceRefs) ? criterion.evidenceRefs : [];
    if (
      evidenceRefs.length === 0
      || evidenceRefs.some((reference) => typeof reference !== "string" || !reference.trim())
      || new Set(evidenceRefs).size !== evidenceRefs.length
    ) criterionFailures.push("criterion-evidence-invalid");
    const evidence = evidenceRefs.map((reference) => {
      if (artifactRefs.has(reference)) {
        const artifactPath = reference.slice("artifact:".length);
        const current = artifactAssessments.find((item) => item.path === artifactPath)?.current === true;
        return { reference, eligible: current, reason: current ? null : "artifact-not-current" };
      }
      if (validationRefs.has(reference)) {
        const validationPath = reference.slice("validation:".length);
        const current = validationAssessments.find((item) => item.path === validationPath)?.current === true;
        return { reference, eligible: current, reason: current ? null : "validation-not-current" };
      }
      const typed = typedEvidenceEligibility(root, mission.missionId, reference);
      return { reference, eligible: typed.eligible === true, reason: typed.reason ?? "unresolved-evidence-reference" };
    });
    if (evidence.some((item) => !item.eligible)) criterionFailures.push("criterion-evidence-stale-or-ineligible");
    return { criterionId: criterion?.criterionId ?? null, evidence, failures: criterionFailures, satisfied: criterionFailures.length === 0 };
  });
  const missingCriteria = requiredCriteria.filter((criterion) => !seenCriteria.has(criterion.criterionId));
  if (missingCriteria.length > 0) failures.push("criteria-coverage-missing");
  if (criteria.some((criterion) => !criterion.satisfied)) failures.push("criteria-evidence-invalid");
  const typedEvidenceStale = criteria.some((criterion) => criterion.failures.includes("criterion-evidence-stale-or-ineligible"));
  return {
    receiptId: receipt.receiptId ?? null,
    current: failures.length === 0,
    stale: typedEvidenceStale || failures.some((failure) => ["mission-contract-invalid", "contract-digest-stale", "artifact-drift", "validation-drift"].includes(failure)),
    failures: [...new Set(failures)],
    artifacts: artifactAssessments,
    validations: validationAssessments,
    criteria,
    missingCriterionIds: missingCriteria.map((criterion) => criterion.criterionId),
    producedAt: receipt.producedAt ?? null
  };
}

function evidenceRequirementAssessment(root, mission, receiptAssessments) {
  const requirements = missionEvidenceRequirements(mission);
  const currentReceipts = receiptAssessments.filter((receipt) => receipt.current);
  const artifactRefs = new Set(currentReceipts.flatMap((receipt) => receipt.artifacts.filter((item) => item.current).map((item) => `artifact:${item.path}`)));
  const validationRefs = new Set(currentReceipts.flatMap((receipt) => receipt.validations.filter((item) => item.current).map((item) => `validation:${item.path}`)));
  return requirements.map(({ requirementId, requirement }) => {
    if (requirement === "review:authoritative") {
      const coverage = verifyReviewCoverage(root, { missionId: mission.missionId, requireAuthoritative: true });
      return { requirementId, requirement, satisfied: coverage.authoritative === true && coverage.failures.length === 0, reason: coverage.authoritative === true && coverage.failures.length === 0 ? null : "authoritative-review-proof-missing" };
    }
    if (requirement.startsWith("source:")) {
      const evaluation = typedEvidenceEligibility(root, mission.missionId, requirement);
      return { requirementId, requirement, satisfied: evaluation.eligible === true, reason: evaluation.eligible === true ? null : evaluation.reason };
    }
    if (requirement.startsWith("note:")) {
      const evaluation = typedEvidenceEligibility(root, mission.missionId, requirement);
      return { requirementId, requirement, satisfied: evaluation.eligible === true, reason: evaluation.eligible === true ? null : evaluation.reason };
    }
    if (requirement.startsWith("artifact:")) {
      return { requirementId, requirement, satisfied: artifactRefs.has(requirement), reason: artifactRefs.has(requirement) ? null : "required-artifact-not-current" };
    }
    if (requirement.startsWith("validation:")) {
      return { requirementId, requirement, satisfied: validationRefs.has(requirement), reason: validationRefs.has(requirement) ? null : "required-validation-not-current" };
    }
    return { requirementId, requirement, satisfied: false, reason: "unsupported-evidence-requirement-syntax" };
  });
}

export function assessMissionCompletion(root, args = {}) {
  const workspace = openDoveWorkspace(root, { operation: "Mission completion assessment" });
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("assess_mission_completion arguments must be a plain object.");
  const unknown = Object.keys(args).filter((field) => field !== "missionId");
  if (unknown.length > 0) throw new Error(`assess_mission_completion does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const missionId = typeof args.missionId === "string" ? args.missionId.trim() : "";
  if (!missionId) throw new Error("assess_mission_completion requires missionId.");
  const relativePath = missionPath(missionId);
  if (!fs.existsSync(path.resolve(root, relativePath))) throw new Error(`Mission does not exist: ${missionId}.`);
  const mission = readJson(root, relativePath, null);
  let missionContractFailure = null;
  try {
    assertCurrentMissionContract(mission);
  } catch (error) {
    missionContractFailure = error instanceof Error ? error.message : String(error);
  }
  const receipts = readExecutionReceipts(root, missionId);
  const receiptAssessments = receipts.map((receipt) => receiptAssessment(root, mission, receipt, workspace.manifest.workspaceId, missionContractFailure === null));
  const requirements = evidenceRequirementAssessment(root, mission, receiptAssessments);
  const currentReceipt = [...receiptAssessments].reverse().find((receipt) => receipt.current) ?? null;
  const incompleteReasons = [];
  if (missionContractFailure) incompleteReasons.push("mission-contract-invalid");
  if (!currentReceipt) incompleteReasons.push(receipts.length === 0 ? "execution-receipt-missing" : "execution-receipts-stale-or-invalid");
  const unmetRequirements = requirements.filter((requirement) => !requirement.satisfied);
  if (unmetRequirements.length > 0) incompleteReasons.push("evidence-requirements-unmet");
  return {
    status: incompleteReasons.length === 0 ? "complete" : "incomplete",
    complete: incompleteReasons.length === 0,
    missionId,
    contractDigest: mission.contractDigest,
    currentReceiptId: currentReceipt?.receiptId ?? null,
    receiptCount: receipts.length,
    staleReceiptIds: receiptAssessments.filter((receipt) => receipt.stale).map((receipt) => receipt.receiptId),
    receipts: receiptAssessments,
    completionCriteria: missionCompletionCriteria(mission),
    evidenceRequirements: requirements,
    incompleteReasons,
    diagnostics: {
      zeroWrite: true,
      missionContractFailure,
      missionPath: relativePath,
      receiptRoot: ARTIFACT_PATHS.executionReceiptsDir,
      artifactAuthority: "execution-receipt-ledger"
    }
  };
}
