import fs from "node:fs";
import path from "node:path";

import { inspectDeclaredPath, normalizeProjectRelativePath } from "./artifact-integrity.mjs";
import { sha256File, verifyPreparedReviewSnapshot } from "./review-artifact-snapshot.mjs";
import { ARTIFACT_PATHS, DOVE_AUDIO_CONTEXT_POLICY } from "./schema.mjs";
import { nowIso, readJson, writeJson } from "./workspace.mjs";

const UNRESOLVED_CONCERN_STATUSES = new Set([
  "open",
  "awaiting-author-response",
  "author-response-submitted",
  "escalated",
  "contested"
]);

function readJsonFile(fullPath) {
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeExpectedPaths(relativePaths = []) {
  const paths = [];
  for (const relativePath of relativePaths) {
    const normalized = normalizeProjectRelativePath(relativePath);
    if (!normalized.ok) return { ok: false, paths: [], reason: `unsafe-expected-artifact:${relativePath}` };
    paths.push(normalized.normalizedPath);
  }
  return { ok: true, paths: Array.from(new Set(paths)).sort(), reason: null };
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean)))
    : [];
}

function sameStringSet(left, right) {
  return JSON.stringify(normalizeStringArray(left).sort()) === JSON.stringify(normalizeStringArray(right).sort());
}

function proofFailure(manifestPath, failures, details = {}) {
  return {
    ok: false,
    authoritative: false,
    proof: null,
    manifestPath,
    failures: Array.from(new Set(failures)),
    ...details
  };
}

function workspaceReviewVerdict(perPacket = {}) {
  const packetStates = Object.values(perPacket);
  if (packetStates.some((item) => item?.verdict === "blocked")) return "blocked";
  if (packetStates.some((item) => item?.verdict === "needs-evidence")) return "needs-evidence";
  if (packetStates.some((item) => item?.verdict === "needs-revision")) return "needs-revision";
  return packetStates.length > 0 ? "coherent" : "not-reviewed";
}

function isOpenReviewProofConcern(item) {
  if (!item || typeof item !== "object" || ["resolved", "retired"].includes(item.status)) {
    return false;
  }
  return String(item.id ?? "").endsWith("-review-proof-required")
    || item.responseOwnerRole === "reviewer"
      && /Reviewer runtime execution claim|Reviewer proof/u.test(String(item.summary ?? ""));
}

export function openReviewProofRequiredBoundaries(root) {
  const concerns = readJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 2, items: [], updatedAt: null });
  return (concerns.items ?? []).filter(isOpenReviewProofConcern);
}

export function assertReviewProofBoundaryTransition(root, currentBoard, nextPhase = currentBoard?.currentPhase, nextAssignedRole = currentBoard?.assignedRole, actionLabel = "Updating workflow ownership") {
  const boundaries = openReviewProofRequiredBoundaries(root);
  if (
    boundaries.length > 0
    && (nextPhase !== "review" || nextAssignedRole !== "reviewer")
  ) {
    const boundaryIds = boundaries.map((item) => item.id).filter(Boolean).join(", ");
    throw new Error(`${actionLabel} cannot leave review/reviewer while review-proof-required remains open (${boundaryIds || "open Reviewer proof boundary"}); only authorized independent Reviewer proof can resolve this boundary.`);
  }
  return boundaries;
}

// Public handoff files can prove snapshot integrity, but cannot authenticate a Reviewer principal.
// There is currently no trusted private runtime caller that can safely consume an execution claim
// and issue proof, so this module deliberately exposes no authorizer.
export function verifyImportedReviewProofIntegrity(root, manifestPath, options = {}) {
  const manifest = readJsonFile(manifestPath);
  if (!manifest || typeof manifest !== "object") return proofFailure(manifestPath, ["manifest-unreadable"]);
  const failures = [];
  if (manifest.status !== "imported") failures.push("manifest-not-imported");
  if (manifest.verdict !== "coherent") failures.push("manifest-verdict-not-coherent");
  if (options.packetId && manifest.packetId !== options.packetId) failures.push("packet-mismatch");
  if (!options.isolationModel) failures.push("expected-isolation-model-missing");
  if (!options.handoffSha256Field) failures.push("handoff-hash-field-missing");

  const inputPath = normalizeProjectRelativePath(manifest.inputPath);
  const handoffPath = normalizeProjectRelativePath(manifest.handoffPath);
  const reportPath = normalizeProjectRelativePath(manifest.reportPath);
  if (!inputPath.ok) failures.push("unsafe-input-path");
  if (!handoffPath.ok) failures.push("unsafe-handoff-path");
  if (!reportPath.ok) failures.push("unsafe-report-path");
  if (failures.length > 0) return proofFailure(manifestPath, failures, { runId: manifest.runId ?? null });

  const inputFullPath = path.resolve(root, inputPath.normalizedPath);
  const handoffFullPath = path.resolve(root, handoffPath.normalizedPath);
  const reportFullPath = path.resolve(root, reportPath.normalizedPath);
  const input = readJsonFile(inputFullPath);
  const handoff = readJsonFile(handoffFullPath);
  if (!input) failures.push("input-unreadable");
  if (!handoff) failures.push("handoff-unreadable");
  const reportInspection = inspectDeclaredPath(root, reportPath.normalizedPath, { requireNonEmpty: true, rejectBookkeeping: true });
  if (reportInspection.status !== "existing") failures.push(`report-${reportInspection.status}`);
  if (failures.length > 0) return proofFailure(manifestPath, failures, { runId: manifest.runId ?? null });

  const actualInputSha256 = sha256File(inputFullPath);
  const verification = verifyPreparedReviewSnapshot(root, {
    manifest,
    input,
    inputPath: inputPath.normalizedPath,
    actualInputSha256,
    handoffInputPath: handoff.inputPath,
    handoffInputSha256: handoff.inputSha256,
    handoffReviewedArtifactPaths: handoff.reviewedArtifactPaths
  });
  failures.push(...verification.failures);
  if (input.runId !== manifest.runId) failures.push("input-run-id-mismatch");
  if (input.packetId !== manifest.packetId) failures.push("input-packet-mismatch");
  if (!sameStringSet(input.includedPacketIds, manifest.includedPacketIds)) failures.push("included-packet-set-mismatch");
  if (handoff.runId !== manifest.runId) failures.push("handoff-run-id-mismatch");
  if (handoff.status !== "completed") failures.push("handoff-not-completed");
  if (handoff.verdict !== "coherent") failures.push("handoff-verdict-not-coherent");
  if (input.outputContract?.handoffPath !== handoffPath.normalizedPath || manifest.handoffPath !== input.outputContract?.handoffPath) failures.push("output-contract-handoff-path-mismatch");
  if (input.outputContract?.reportPath !== reportPath.normalizedPath || handoff.reportPath !== reportPath.normalizedPath || manifest.reportPath !== input.outputContract?.reportPath) failures.push("output-contract-report-path-mismatch");
  if (!sameStringSet(manifest.reviewedArtifactPaths, input.reviewedArtifactPaths)) failures.push("manifest-input-reviewed-path-set-mismatch");
  if (!sameStringSet(input.reviewedArtifactPaths, verification.reviewedArtifacts.map((item) => item.path))) failures.push("input-snapshot-reviewed-path-set-mismatch");
  if (input.isolationModel !== options.isolationModel) failures.push("isolation-model-mismatch");
  if (input.privacyBoundary?.writerPrivateTranscriptShared !== false || input.privacyBoundary?.reviewerPrivateTranscriptShouldReturn !== false) failures.push("privacy-boundary-mismatch");
  if (options.isolationModel === "audio-final-plan-results-explicit-artifacts") {
    if (input.contextPolicy !== DOVE_AUDIO_CONTEXT_POLICY) failures.push("audio-context-policy-mismatch");
    if (input.privacyBoundary?.projectContextShared !== false || input.privacyBoundary?.orchestrationBoardShared !== false) failures.push("audio-context-boundary-mismatch");
  }
  const actualHandoffSha256 = sha256File(handoffFullPath);
  const actualReportSha256 = sha256File(reportFullPath);
  if (manifest[options.handoffSha256Field] !== actualHandoffSha256) failures.push("handoff-hash-mismatch");
  if (manifest.reportSha256 !== actualReportSha256) failures.push("report-hash-mismatch");

  const expected = normalizeExpectedPaths(options.reviewedArtifactPaths ?? []);
  if (!expected.ok) failures.push(expected.reason);
  const reviewedPaths = verification.reviewedArtifacts.map((item) => item.path).sort();
  if (expected.ok && expected.paths.length > 0 && JSON.stringify(expected.paths) !== JSON.stringify(reviewedPaths)) failures.push("expected-artifact-set-mismatch");
  if (failures.length > 0) return proofFailure(manifestPath, failures, { runId: manifest.runId ?? null });

  return {
    ok: false,
    authoritative: false,
    proof: null,
    failures: ["reviewer-runtime-authorization-required"],
    manifestPath: path.relative(root, manifestPath).split(path.sep).join("/"),
    runId: manifest.runId,
    packetId: manifest.packetId ?? null,
    snapshotIntegrityVerified: true,
    inputSha256: actualInputSha256,
    handoffSha256: actualHandoffSha256,
    reportSha256: actualReportSha256,
    reviewedArtifacts: verification.reviewedArtifacts,
    reviewedArtifactSetSha256: verification.reviewedArtifactSetSha256
  };
}

export function verifyImportedIsolatedReviewProof(root, manifestPath, options = {}) {
  return verifyImportedReviewProofIntegrity(root, manifestPath, {
    ...options,
    isolationModel: "parallel-session-file-handoff",
    handoffSha256Field: "outputSha256"
  });
}

export function recordReviewProofRequiredBoundary(root, {
  reviewKind,
  runId,
  packetId,
  includedPacketIds = [packetId],
  timestamp,
  handoffPath,
  reportPath,
  reviewedArtifactPaths = []
}) {
  const normalizedKind = String(reviewKind ?? "review").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "review";
  const label = normalizedKind === "audio" ? "audio review" : "isolated review";
  const recordedAt = timestamp ?? nowIso();
  const summary = `Imported coherent ${label} material is non-authoritative until an approved Reviewer runtime execution claim submits proof through the private capability.`;
  const proofBoundary = {
    id: `${normalizedKind}-${runId}-review-proof-required`,
    packetId,
    summary,
    severity: "high",
    status: "open",
    raisedByRole: "reviewer",
    responseOwnerRole: "reviewer",
    reviewerRationale: "Public prepare/import, caller-supplied reviewerId, and caller-written report or manifest cannot authenticate Reviewer authority.",
    rulingOutcome: "pending",
    reviewerDisposition: "pending",
    recurrenceCount: 1,
    firstSeenAt: recordedAt,
    lastSeenAt: recordedAt,
    linkedArtifactPaths: Array.from(new Set([handoffPath, reportPath, ...reviewedArtifactPaths].filter(Boolean))),
    claimIds: [],
    experimentIds: [],
    updatedAt: nowIso()
  };
  const concerns = readJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 2, items: [], updatedAt: null });
  const concernItems = [...(concerns.items ?? []).filter((item) => item.id !== proofBoundary.id), proofBoundary];
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    ...concerns,
    version: 2,
    items: concernItems,
    updatedAt: nowIso()
  });

  const reviewState = readJson(root, ARTIFACT_PATHS.reviewState, { version: 4, history: [], perPacket: {}, lastVerdict: "not-reviewed", unresolvedConcernIds: [] });
  const reviewEntry = {
    id: `${normalizedKind}-${runId}`,
    packetId,
    includedPacketIds,
    timestamp: recordedAt,
    stage: `${normalizedKind}-review-import`,
    scope: summary,
    verdict: "needs-evidence",
    importedVerdict: "coherent",
    authoritative: false,
    summary,
    reviewRequiredBeforeFinalize: true,
    reportPath,
    reviewedArtifactPaths,
    resolvedConcernIds: [],
    findings: [{ severity: "high", summary, responseOwnerRole: "reviewer", methodologicalCategory: "review-proof" }],
    actionItems: ["Submit proof from an approved Reviewer runtime execution claim through the private capability."],
    independentReviewProof: null
  };
  const history = [...(reviewState.history ?? []).filter((item) => item.id !== reviewEntry.id), reviewEntry];
  const unresolvedConcernIds = concernItems
    .filter((item) => UNRESOLVED_CONCERN_STATUSES.has(item.status))
    .map((item) => item.id);
  const packetUnresolvedConcernIds = concernItems
    .filter((item) => item.packetId === packetId && UNRESOLVED_CONCERN_STATUSES.has(item.status))
    .map((item) => item.id);
  const perPacket = {
    ...(reviewState.perPacket ?? {}),
    [packetId]: {
      packetId,
      includedPacketIds,
      verdict: "needs-evidence",
      reviewedAt: recordedAt,
      reviewId: reviewEntry.id,
      reviewedArtifactPaths,
      unresolvedConcernIds: packetUnresolvedConcernIds
    }
  };
  const workspaceVerdict = workspaceReviewVerdict(perPacket);
  const openItems = Array.from(new Set([
    ...normalizeStringArray(reviewState.openItems),
    ...reviewEntry.actionItems
  ]));
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    ...reviewState,
    version: 4,
    history,
    perPacket,
    lastVerdict: workspaceVerdict,
    lastReviewedAt: recordedAt,
    openItems,
    unresolvedConcernIds
  });
  return { proofBoundary, reviewEntry };
}

export function findCurrentIndependentReviewProof() {
  return {
    ok: false,
    authoritative: false,
    proof: null,
    failures: ["current-authorized-hash-bound-isolated-review-proof-missing"]
  };
}

export function reviewProofCoversCurrentArtifact() {
  return false;
}

export function isolatedReviewProofAuthorityStatus(root) {
  const reviewsRoot = path.resolve(root, ARTIFACT_PATHS.isolatedReviewsDir);
  return {
    available: false,
    reason: "trusted-private-reviewer-runtime-capability-not-connected",
    importedRunCount: fs.existsSync(reviewsRoot)
      ? fs.readdirSync(reviewsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length
      : 0
  };
}
