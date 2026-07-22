import path from "node:path";

import { isDoveLessonArtifactPath } from "./domain-artifacts.mjs";
import { assertCurrentMissionContract, missionCompletionCriteria, missionEvidenceRequirements } from "./mission-contracts.mjs";
import { terminalSuccessorMissionId } from "./mission-graph.mjs";
import { snapshotArtifactBuffer } from "./review-artifact-snapshot.mjs";
import { verifyReviewCoverage } from "./review-exchange.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { evaluateNoteReferences, evaluateSourceReferences } from "./source-trust.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const ARTIFACT_KINDS = new Set(["report", "document", "code", "data", "figure", "media", "other"]);
const VALIDATION_KINDS = new Set(["test-log", "typecheck-log", "lint-log", "build-log", "audit-log", "validation-log", "command-output"]);
const RECEIPT_FIELDS = new Set(["schemaVersion", "workspaceId", "receiptId", "ledgerSequence", "missionId", "contractDigest", "summary", "artifacts", "validations", "criteriaSatisfied", "producedAt", "recordedAt", "producer"]);
const ARTIFACT_FIELDS = new Set(["path", "kind", "sha256", "derivedReferences"]);
const VALIDATION_FIELDS = new Set(["kind", "reference", "outputHash"]);
const CRITERION_FIELDS = new Set(["criterionId", "evidenceRefs", "evidenceBindings"]);
const EVIDENCE_BINDING_FIELDS = new Set(["reference", "sha256", "receiptId"]);

function missionPath(missionId) {
  return path.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}

function sealed(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => allowed.has(key));
}

function currentHashedFile(root, relativePath, expectedHash) {
  if (isDoveLessonArtifactPath(relativePath)) return { current: false, reason: "lesson-advisory-only", path: relativePath ?? null, actualHash: null };
  if (typeof relativePath !== "string" || !relativePath.trim() || !HASH_PATTERN.test(String(expectedHash ?? ""))) {
    return { current: false, reason: "hashed-file-input-invalid", path: relativePath ?? null, actualHash: null };
  }
  try {
    const snapshot = snapshotArtifactBuffer(root, relativePath, `completion evidence ${relativePath}`);
    return {
      current: snapshot.sha256 === expectedHash,
      reason: snapshot.sha256 === expectedHash ? null : "hash-mismatch",
      path: snapshot.path,
      actualHash: snapshot.sha256,
      sizeBytes: snapshot.sizeBytes
    };
  } catch (error) {
    return { current: false, reason: error instanceof Error ? error.message : "path-invalid", path: relativePath, actualHash: null };
  }
}

function typedEvidenceEligibility(root, missionId, reference) {
  if (reference.startsWith("source:")) {
    const value = reference.slice("source:".length);
    const evaluation = evaluateSourceReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-source" };
    return { ...evaluation, evidenceSha256: evaluation.source?.capturedMaterial?.sha256 ?? null };
  }
  if (reference.startsWith("note:")) {
    const value = reference.slice("note:".length);
    const evaluation = evaluateNoteReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-note" };
    return { ...evaluation, evidenceSha256: evaluation.owner?.sha256 ?? null };
  }
  return { eligible: null, reason: null, evidenceSha256: null };
}

function assessArtifact(root, mission, artifact, currentOwnerByPath) {
  if (!sealed(artifact, ARTIFACT_FIELDS) || typeof artifact.path !== "string" || !artifact.path.trim() || !ARTIFACT_KINDS.has(artifact.kind) || !HASH_PATTERN.test(String(artifact.sha256 ?? "")) || !Array.isArray(artifact.derivedReferences)) {
    return { path: artifact?.path ?? null, current: false, reason: "artifact-schema-invalid", ownerReceiptId: null, recordedSha256: artifact?.sha256 ?? null };
  }
  const owner = currentOwnerByPath.get(artifact.path);
  if (!owner || owner.missionId !== mission.missionId) {
    return { path: artifact.path, current: false, reason: owner ? "artifact-current-owner-mission-mismatch" : "artifact-current-owner-missing", ownerReceiptId: owner?.receiptId ?? null, recordedSha256: artifact.sha256 };
  }
  if (owner.sha256 !== artifact.sha256) {
    return { path: artifact.path, current: false, reason: "artifact-superseded", ownerReceiptId: owner.receiptId, recordedSha256: artifact.sha256, ownerSha256: owner.sha256 };
  }
  return { ...currentHashedFile(root, artifact.path, owner.sha256), ownerReceiptId: owner.receiptId, recordedSha256: artifact.sha256 };
}

function assessValidation(root, validation) {
  if (!sealed(validation, VALIDATION_FIELDS) || typeof validation.reference !== "string" || !validation.reference.trim() || !VALIDATION_KINDS.has(validation.kind) || !HASH_PATTERN.test(String(validation.outputHash ?? ""))) {
    return { path: validation?.reference ?? null, current: false, reason: "validation-schema-invalid", recordedSha256: validation?.outputHash ?? null };
  }
  return { ...currentHashedFile(root, validation.reference, validation.outputHash), recordedSha256: validation.outputHash };
}

function criterionAssessment(root, mission, criterion, receipt, artifactAssessments, validationAssessments, currentOwnerByPath, requiredIds, seenCriteria) {
  const failures = [];
  if (!sealed(criterion, CRITERION_FIELDS)) failures.push("criterion-schema-invalid");
  if (!requiredIds.has(criterion?.criterionId)) failures.push("criterion-unknown");
  if (seenCriteria.has(criterion?.criterionId)) failures.push("criterion-duplicate");
  seenCriteria.add(criterion?.criterionId);
  const evidenceRefs = Array.isArray(criterion?.evidenceRefs) ? criterion.evidenceRefs : [];
  const evidenceBindings = Array.isArray(criterion?.evidenceBindings) ? criterion.evidenceBindings : [];
  if (evidenceRefs.length === 0 || evidenceRefs.some((reference) => typeof reference !== "string" || !reference.trim()) || new Set(evidenceRefs).size !== evidenceRefs.length) failures.push("criterion-evidence-invalid");
  if (evidenceBindings.length !== evidenceRefs.length || evidenceBindings.some((binding) => !sealed(binding, EVIDENCE_BINDING_FIELDS) || !evidenceRefs.includes(binding.reference) || !HASH_PATTERN.test(String(binding.sha256 ?? "")) || typeof binding.receiptId !== "string" || !binding.receiptId) || new Set(evidenceBindings.map((binding) => binding.reference)).size !== evidenceBindings.length) {
    failures.push("criterion-evidence-binding-invalid");
  }
  const bindingByReference = new Map(evidenceBindings.map((binding) => [binding.reference, binding]));
  const receiptArtifactByPath = new Map((receipt.artifacts ?? []).map((artifact, index) => [artifact.path, artifactAssessments[index]]));
  const receiptValidationByPath = new Map((receipt.validations ?? []).map((validation, index) => [validation.reference, validationAssessments[index]]));
  const evidence = evidenceRefs.map((reference) => {
    const binding = bindingByReference.get(reference) ?? null;
    const boundSha256 = binding?.sha256 ?? null;
    const boundReceiptId = binding?.receiptId ?? null;
    if (reference.startsWith("artifact:")) {
      const artifactPath = reference.slice("artifact:".length);
      const owner = currentOwnerByPath.get(artifactPath);
      if (!owner) return { reference, boundSha256, eligible: false, reason: "artifact-current-owner-missing", contributingReceiptId: null };
      if (owner.missionId !== mission.missionId) return { reference, boundSha256, eligible: false, reason: "artifact-current-owner-mission-mismatch", contributingReceiptId: null };
      if (owner.sha256 !== boundSha256 || owner.receiptId !== boundReceiptId) return { reference, boundSha256, boundReceiptId, eligible: false, reason: "artifact-original-owner-superseded", contributingReceiptId: null };
      const current = currentHashedFile(root, artifactPath, owner.sha256);
      const declaration = receiptArtifactByPath.get(artifactPath);
      if (declaration && declaration.recordedSha256 !== boundSha256) return { reference, boundSha256, eligible: false, reason: "artifact-receipt-binding-mismatch", contributingReceiptId: null };
      return { reference, boundSha256, eligible: current.current, reason: current.current ? null : current.reason, contributingReceiptId: current.current ? owner.receiptId : null };
    }
    if (reference.startsWith("validation:")) {
      const validationPath = reference.slice("validation:".length);
      const declaration = receiptValidationByPath.get(validationPath);
      if (!declaration || declaration.recordedSha256 !== boundSha256 || boundReceiptId !== receipt.receiptId) return { reference, boundSha256, boundReceiptId, eligible: false, reason: "validation-receipt-binding-mismatch", contributingReceiptId: null };
      return { reference, boundSha256, eligible: declaration.current, reason: declaration.current ? null : declaration.reason, contributingReceiptId: declaration.current ? receipt.receiptId : null };
    }
    const typed = typedEvidenceEligibility(root, mission.missionId, reference);
    const currentTypedReceiptId = typed.owner?.receiptId ?? receipt.receiptId;
    const bound = HASH_PATTERN.test(String(boundSha256 ?? "")) && typed.evidenceSha256 === boundSha256 && boundReceiptId === currentTypedReceiptId;
    return { reference, boundSha256, boundReceiptId, eligible: typed.eligible === true && bound, reason: typed.eligible !== true ? typed.reason ?? "unresolved-evidence-reference" : bound ? null : "typed-evidence-original-owner-superseded", contributingReceiptId: typed.eligible === true && bound ? currentTypedReceiptId : null };
  });
  if (evidence.some((item) => !item.eligible)) failures.push("criterion-evidence-stale-or-ineligible");
  return {
    criterionId: criterion?.criterionId ?? null,
    evidence,
    failures: [...new Set(failures)],
    satisfied: failures.length === 0,
    contributingReceiptIds: [...new Set(evidence.map((item) => item.contributingReceiptId).filter(Boolean))]
  };
}

function receiptAssessment(root, mission, receipt, workspaceId, currentOwnerByPath, missionCurrent = true) {
  const failures = [];
  if (!missionCurrent) failures.push("mission-contract-invalid");
  if (!sealed(receipt, RECEIPT_FIELDS) || receipt.schemaVersion !== 3) failures.push("receipt-schema-invalid");
  if (receipt.workspaceId !== workspaceId || mission.workspaceId !== workspaceId) failures.push("workspace-binding-mismatch");
  if (receipt.missionId !== mission.missionId) failures.push("mission-binding-mismatch");
  if (receipt?.contractDigest !== mission.contractDigest || !missionCurrent) failures.push("contract-digest-stale");
  if (!Array.isArray(receipt.artifacts)) failures.push("artifacts-invalid");
  if (!Array.isArray(receipt.validations)) failures.push("validations-invalid");
  if (!Array.isArray(receipt.criteriaSatisfied)) failures.push("criteria-invalid");
  if ((receipt.artifacts?.length ?? 0) + (receipt.validations?.length ?? 0) + (receipt.criteriaSatisfied?.length ?? 0) === 0) failures.push("progress-evidence-missing");

  const artifactAssessments = (Array.isArray(receipt.artifacts) ? receipt.artifacts : []).map((artifact) => assessArtifact(root, mission, artifact, currentOwnerByPath));
  const validationAssessments = (Array.isArray(receipt.validations) ? receipt.validations : []).map((validation) => assessValidation(root, validation));
  if (artifactAssessments.some((item) => !item.current)) failures.push("artifact-drift-or-superseded");
  if (validationAssessments.some((item) => !item.current)) failures.push("validation-drift");
  const artifactPaths = (receipt.artifacts ?? []).map((artifact) => artifact?.path).filter(Boolean);
  const validationPaths = (receipt.validations ?? []).map((validation) => validation?.reference).filter(Boolean);
  if (new Set(artifactPaths).size !== artifactPaths.length) failures.push("artifact-path-duplicate");
  if (new Set(validationPaths).size !== validationPaths.length) failures.push("validation-path-duplicate");

  const requiredIds = new Set(missionCompletionCriteria(mission).map((criterion) => criterion.criterionId));
  const seenCriteria = new Set();
  const criteria = (Array.isArray(receipt.criteriaSatisfied) ? receipt.criteriaSatisfied : []).map((criterion) => criterionAssessment(root, mission, criterion, receipt, artifactAssessments, validationAssessments, currentOwnerByPath, requiredIds, seenCriteria));
  if (criteria.some((criterion) => !criterion.satisfied)) failures.push("criteria-evidence-invalid");
  const stale = failures.some((failure) => ["mission-contract-invalid", "contract-digest-stale", "artifact-drift-or-superseded", "validation-drift"].includes(failure)) || criteria.some((criterion) => criterion.failures.includes("criterion-evidence-stale-or-ineligible"));
  return {
    receiptId: receipt.receiptId ?? null,
    current: failures.length === 0,
    stale,
    failures: [...new Set(failures)],
    artifacts: artifactAssessments,
    validations: validationAssessments,
    criteria,
    producedAt: receipt.producedAt ?? null
  };
}

function artifactCoverageAssessment(root, mission, currentOwnerByPath) {
  const requiredPaths = [...new Set([...(mission.targetArtifacts ?? []), ...(mission.expectedArtifacts ?? [])])].sort();
  return requiredPaths.map((artifactPath) => {
    const owner = currentOwnerByPath.get(artifactPath) ?? null;
    if (!owner) return { path: artifactPath, covered: false, reason: "artifact-current-owner-missing", receiptId: null, sha256: null };
    if (owner.missionId !== mission.missionId) return { path: artifactPath, covered: false, reason: "artifact-current-owner-mission-mismatch", receiptId: owner.receiptId, sha256: owner.sha256 };
    const current = currentHashedFile(root, artifactPath, owner.sha256);
    return { path: artifactPath, covered: current.current, reason: current.current ? null : current.reason, receiptId: current.current ? owner.receiptId : null, sha256: owner.sha256 };
  });
}

function criterionCoverageAssessment(mission, receiptAssessments) {
  return missionCompletionCriteria(mission).map(({ criterionId, criterion }) => {
    const proofs = receiptAssessments.flatMap((receipt) => receipt.criteria.filter((item) => item.criterionId === criterionId && item.satisfied).map((item) => ({ receiptId: receipt.receiptId, evidence: item.evidence, contributingReceiptIds: [...new Set([receipt.receiptId, ...item.contributingReceiptIds])] })));
    return { criterionId, criterion, covered: proofs.length > 0, contributingReceiptIds: [...new Set(proofs.flatMap((item) => item.contributingReceiptIds))], proofs };
  });
}

function evidenceRequirementAssessment(root, mission, receiptAssessments, artifactCoverage) {
  const requirements = missionEvidenceRequirements(mission);
  const artifactByReference = new Map(artifactCoverage.map((item) => [`artifact:${item.path}`, item]));
  const validationProofs = new Map();
  for (const receipt of receiptAssessments) {
    for (const validation of receipt.validations) {
      if (validation.current) validationProofs.set(`validation:${validation.path}`, receipt.receiptId);
    }
  }
  return requirements.map(({ requirementId, requirement }) => {
    if (requirement === "review:authoritative") {
      const coverage = verifyReviewCoverage(root, { missionId: mission.missionId, requireAuthoritative: true });
      const satisfied = coverage.authoritative === true && coverage.failures.length === 0;
      return { requirementId, requirement, satisfied, reason: satisfied ? null : "authoritative-review-proof-missing", contributingReceiptIds: [] };
    }
    if (requirement.startsWith("source:") || requirement.startsWith("note:")) {
      const evaluation = typedEvidenceEligibility(root, mission.missionId, requirement);
      return { requirementId, requirement, satisfied: evaluation.eligible === true, reason: evaluation.eligible === true ? null : evaluation.reason, contributingReceiptIds: evaluation.eligible === true && evaluation.owner?.receiptId ? [evaluation.owner.receiptId] : [] };
    }
    if (requirement.startsWith("artifact:")) {
      const coverage = artifactByReference.get(requirement);
      return { requirementId, requirement, satisfied: coverage?.covered === true, reason: coverage?.covered === true ? null : coverage?.reason ?? "required-artifact-not-current", contributingReceiptIds: coverage?.covered ? [coverage.receiptId] : [] };
    }
    if (requirement.startsWith("validation:")) {
      const receiptId = validationProofs.get(requirement) ?? null;
      return { requirementId, requirement, satisfied: Boolean(receiptId), reason: receiptId ? null : "required-validation-not-current", contributingReceiptIds: receiptId ? [receiptId] : [] };
    }
    return { requirementId, requirement, satisfied: false, reason: "unsupported-evidence-requirement-syntax", contributingReceiptIds: [] };
  });
}

function assessMissionFromWorkspace(root, workspace, missionId, state) {
  if (state.memo.has(missionId)) return state.memo.get(missionId);
  if (state.visiting.has(missionId)) throw new Error(`Mission dependency assessment contains a cycle at ${missionId}.`);
  const mission = workspace.missions.get(missionId);
  if (!mission) throw new Error(`Mission does not exist: ${missionId}.`);
  state.visiting.add(missionId);
  try {
    const relativePath = missionPath(missionId);
    let missionContractFailure = null;
    try {
      assertCurrentMissionContract(mission);
    } catch (error) {
      missionContractFailure = error instanceof Error ? error.message : String(error);
    }
    const receipts = workspace.receiptLedger.receipts.filter((receipt) => receipt.missionId === missionId);
    const receiptAssessments = receipts.map((receipt) => receiptAssessment(root, mission, receipt, workspace.manifest.workspaceId, state.currentOwnerByPath, missionContractFailure === null));
    const artifactCoverage = artifactCoverageAssessment(root, mission, state.currentOwnerByPath);
    const criterionCoverage = criterionCoverageAssessment(mission, receiptAssessments);
    const requirements = evidenceRequirementAssessment(root, mission, receiptAssessments, artifactCoverage);
    const dependencyCoverage = (workspace.missionGraph.dependenciesByMission.get(missionId) ?? []).map((dependencyMissionId) => {
      const assessment = assessMissionFromWorkspace(root, workspace, dependencyMissionId, state);
      return {
        missionId: dependencyMissionId,
        status: assessment.status,
        complete: assessment.complete,
        supersededByMissionId: assessment.supersededByMissionId,
        incompleteReasons: assessment.incompleteReasons
      };
    });
    const supersededByMissionId = terminalSuccessorMissionId(workspace.missionGraph, missionId);
    const incompleteReasons = [];
    if (supersededByMissionId) incompleteReasons.push("mission-superseded");
    if (missionContractFailure) incompleteReasons.push("mission-contract-invalid");
    if (receipts.length === 0) incompleteReasons.push("execution-receipt-missing");
    if (artifactCoverage.some((item) => !item.covered)) incompleteReasons.push("mission-artifact-coverage-missing");
    if (criterionCoverage.some((item) => !item.covered)) incompleteReasons.push("criteria-coverage-missing");
    if (requirements.some((requirement) => !requirement.satisfied)) incompleteReasons.push("evidence-requirements-unmet");
    if (dependencyCoverage.some((dependency) => !dependency.complete)) incompleteReasons.push("mission-dependency-incomplete");
    const contributingReceiptIds = [...new Set([
      ...artifactCoverage.filter((item) => item.covered).map((item) => item.receiptId),
      ...criterionCoverage.flatMap((item) => item.contributingReceiptIds),
      ...requirements.flatMap((item) => item.contributingReceiptIds)
    ].filter(Boolean))].sort((left, right) => {
      const leftSequence = receipts.find((receipt) => receipt.receiptId === left)?.ledgerSequence ?? 0;
      const rightSequence = receipts.find((receipt) => receipt.receiptId === right)?.ledgerSequence ?? 0;
      return leftSequence - rightSequence;
    });
    if (receipts.length > 0 && contributingReceiptIds.length === 0 && !receiptAssessments.some((receipt) => receipt.current)) incompleteReasons.push("execution-receipts-stale-or-invalid");
    const assessment = {
      status: supersededByMissionId ? "superseded" : incompleteReasons.length === 0 ? "complete" : "incomplete",
      complete: incompleteReasons.length === 0,
      missionId,
      contractDigest: mission.contractDigest,
      supersededByMissionId,
      dependencyCoverage,
      contributingReceiptIds,
      artifactCoverage,
      criterionCoverage,
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
        artifactAuthority: "execution-receipt-ledger-current-ownership"
      }
    };
    state.memo.set(missionId, assessment);
    return assessment;
  } finally {
    state.visiting.delete(missionId);
  }
}

export function assessMissionCompletion(root, args = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("assess_mission_completion arguments must be a plain object.");
  const unknown = Object.keys(args).filter((field) => field !== "missionId");
  if (unknown.length > 0) throw new Error(`assess_mission_completion does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const missionId = typeof args.missionId === "string" ? args.missionId.trim() : "";
  if (!missionId) throw new Error("assess_mission_completion requires missionId.");
  const workspace = openDoveWorkspace(root, { operation: "Mission completion assessment" });
  return assessMissionFromWorkspace(root, workspace, missionId, {
    memo: new Map(),
    visiting: new Set(),
    currentOwnerByPath: new Map(workspace.receiptLedger.currentOwnership.map((item) => [item.path, item]))
  });
}
