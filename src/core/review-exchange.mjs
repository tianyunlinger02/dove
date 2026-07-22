import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { inspectDeclaredPath } from "./artifact-integrity.mjs";
import {
  assertSealedDomainArgs,
  domainJson,
  domainNonEmptyText,
  domainSafeId,
  domainSha256,
  domainStringArray,
  finalizeDomainArtifacts,
  readCurrentMission
} from "./domain-artifacts.mjs";
import { assertMissionAcceptsWrites } from "./mission-graph.mjs";
import { currentMutationContext, isPatchPlanMode } from "./mutation-backend.mjs";
import { assertReceiptAppendable, deriveArtifactReferences, EXECUTION_RECEIPT_SCHEMA_VERSION } from "./receipt-ledger.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { assertGovernanceMutationRegistered, nowIso, writeJson } from "./workspace.mjs";
import {
  normalizeReviewSnapshots,
  resolveReviewArtifactSnapshots,
  snapshotArtifactBuffer,
  stableSnapshotSetHash,
  verifyReviewSnapshotSet
} from "./review-artifact-snapshot.mjs";

export const REVIEW_EXCHANGE_SCHEMA_VERSION = 8;
export const REVIEW_EXCHANGE_POLICIES = Object.freeze([
  "local-preflight",
  "isolated-selected-artifacts",
  "final-plan-results-only",
  "external"
]);

const POLICY_SET = new Set(REVIEW_EXCHANGE_POLICIES);
const PREPARE_FIELDS = new Set(["missionId", "policy", "artifactPaths", "finalPlanPaths", "finalResultPaths"]);
const IMPORT_FIELDS = new Set(["missionId", "exchangeId", "reviewId"]);
const COVERAGE_FIELDS = new Set(["missionId", "artifactPaths", "requireAuthoritative"]);
const EXPECTED_COVERAGE_FIELDS = new Set(["missionId", "expectedSnapshots", "requireAuthoritative"]);
const REVIEW_VERDICTS = new Set(["coherent", "needs-revision", "needs-evidence", "blocked"]);
const REVIEW_STATUSES = new Set(["completed", "blocked", "failed"]);
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const INPUT_FIELDS = new Set([
  "schemaVersion", "workspaceId", "missionId", "contractDigest", "exchangeId", "createdAt", "policy",
  "scopeSha256", "inputBoundary", "preparationReceiptId", "artifactPaths", "finalPlanPaths", "finalResultPaths", "reviewedArtifactPaths",
  "reviewedArtifacts", "reviewedArtifactSetSha256", "packageArtifacts", "packageArtifactSetSha256", "outputContract", "privacyBoundary"
]);
const MANIFEST_FIELDS = new Set([
  "schemaVersion", "workspaceId", "missionId", "contractDigest", "exchangeId", "status", "createdAt", "policy",
  "scopeSha256", "inputBoundary", "preparationReceiptId", "inputPath", "inputSha256", "handoffPath", "reportPath", "consumptionPath", "artifactPackagePath", "artifactPaths", "finalPlanPaths",
  "finalResultPaths", "reviewedArtifactPaths", "reviewedArtifacts", "reviewedArtifactSetSha256", "packageArtifacts", "packageArtifactSetSha256"
]);
const PACKAGE_ARTIFACT_FIELDS = new Set(["sourcePath", "sourceSha256", "sourceSizeBytes", "packagePath", "packageSha256", "packageSizeBytes"]);
const CONSUMPTION_FIELDS = new Set([
  "schemaVersion", "workspaceId", "missionId", "contractDigest", "exchangeId", "reviewId", "preparationReceiptId", "importReceiptId", "consumedAt"
]);
const HANDOFF_FIELDS = new Set([
  "schemaVersion", "workspaceId", "missionId", "contractDigest", "exchangeId", "reviewId", "policy", "scopeSha256",
  "status", "verdict", "reviewerId", "summary", "inputPath", "inputSha256", "reportPath", "reportSha256",
  "reviewedArtifactPaths", "findings", "actionItems", "reviewedAt"
]);
const FINDING_FIELDS = new Set(["findingId", "severity", "summary", "linkedArtifactPaths"]);
const IMPORTED_REVIEW_FIELDS = new Set([
  "schemaVersion", "workspaceId", "missionId", "contractDigest", "exchangeId", "reviewId", "policy", "scopeSha256",
  "status", "verdict", "reviewerId", "summary", "reviewedAt", "reviewedArtifactPaths", "reviewedArtifacts",
  "reviewedArtifactSetSha256", "packageArtifacts", "packageArtifactSetSha256", "findings", "actionItems", "preparationReceiptId", "importReceiptId", "exchange", "authority", "privateTranscriptImported"
]);
const EXCHANGE_HASH_FIELDS = new Set([
  "manifestPath", "manifestSha256", "inputPath", "inputSha256", "handoffPath", "handoffSha256", "reportPath", "reportSha256",
  "consumptionPath", "consumptionSha256", "importedReportPath", "importedReportSha256"
]);
const AUTHORITY_FIELDS = new Set(["authoritative", "callerMayMintAuthority", "issuer", "reason"]);

function sealed(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  return value;
}

function exchangePath(exchangeId, leaf) {
  return path.posix.join(".dove/reviews/exchanges", exchangeId, leaf);
}

function artifactPackagePath(exchangeId) {
  return exchangePath(exchangeId, "package/artifacts");
}

function consumptionPath(exchangeId) {
  return exchangePath(exchangeId, "consumption.json");
}

function exchangeLockPath(exchangeId) {
  return exchangePath(exchangeId, ".exchange.lock");
}

function packageArtifactPath(exchangeId, index, sourcePath) {
  const extension = path.posix.extname(sourcePath);
  return exchangePath(exchangeId, `package/artifacts/artifact-${String(index + 1).padStart(4, "0")}${extension}`);
}

function importedReviewPath(reviewId) {
  return path.posix.join(".dove/reviews", `${reviewId}.json`);
}

function importedReportPath(reviewId) {
  return path.posix.join(".dove/reviews", `${reviewId}.report.md`);
}

function exactTimestamp(value, label) {
  const text = domainNonEmptyText(value, label);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return text;
}

function exactHash(value, label) {
  const hash = String(value ?? "");
  if (!HASH_PATTERN.test(hash)) throw new Error(`${label} must be a lowercase SHA-256 hash.`);
  return hash;
}

function currentCanonicalLeaf(root, relativePath, label) {
  const inspection = inspectDeclaredPath(root, relativePath, { requireNonEmpty: true });
  if (inspection.status !== "existing") throw new Error(`${label} must be an existing non-empty regular file (${inspection.reason ?? inspection.status}).`);
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (inspection.normalizedPath !== relativePath || canonicalPath !== relativePath) throw new Error(`${label} must be the canonical realpath-contained exchange path.`);
  const context = currentMutationContext(root);
  const snapshot = context?.readFileSnapshot?.(canonicalPath);
  const content = snapshot?.exists && snapshot.type === "file" && snapshot.buffer
    ? Buffer.from(snapshot.buffer)
    : fs.readFileSync(path.resolve(root, canonicalPath));
  return { path: canonicalPath, content, sizeBytes: content.byteLength, sha256: snapshot?.sha256 ?? domainSha256(content) };
}

function snapshotContent(root, snapshot, label) {
  if (Buffer.isBuffer(snapshot?.content)) return Buffer.from(snapshot.content);
  if (Buffer.isBuffer(snapshot?.buffer)) return Buffer.from(snapshot.buffer);
  const buffered = snapshotArtifactBuffer(root, snapshot.path, label);
  if (buffered.sha256 !== snapshot.sha256 || buffered.sizeBytes !== snapshot.sizeBytes) throw new Error(`${label} changed while the review exchange was being prepared.`);
  return buffered.content;
}

function buildArtifactPackage(root, exchangeId, snapshots) {
  const packageArtifacts = [];
  const writes = [];
  for (const [index, snapshot] of snapshots.entries()) {
    const content = snapshotContent(root, snapshot, `Review artifact ${snapshot.path}`);
    const packagePath = packageArtifactPath(exchangeId, index, snapshot.path);
    const packageSha256 = domainSha256(content);
    packageArtifacts.push({
      sourcePath: snapshot.path,
      sourceSha256: snapshot.sha256,
      sourceSizeBytes: snapshot.sizeBytes,
      packagePath,
      packageSha256,
      packageSizeBytes: content.byteLength
    });
    writes.push({ path: packagePath, kind: "data", content, derivedReferences: [`artifact:${snapshot.path}`] });
  }
  return { packageArtifacts, packageArtifactSetSha256: stablePackageArtifactSetHash(packageArtifacts), writes };
}

function stablePackageArtifactSetHash(items) {
  return domainSha256(`${JSON.stringify([...items].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath)))}\n`);
}

function normalizePackageArtifacts(value, label = "packageArtifacts") {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must contain package artifact mappings.`);
  const sourcePaths = new Set();
  const packagePaths = new Set();
  const normalized = value.map((item, index) => {
    sealed(item, PACKAGE_ARTIFACT_FIELDS, `${label}[${index}]`);
    const sourcePath = domainNonEmptyText(item.sourcePath, `${label}[${index}].sourcePath`);
    const packagePath = domainNonEmptyText(item.packagePath, `${label}[${index}].packagePath`);
    if (sourcePaths.has(sourcePath) || packagePaths.has(packagePath)) throw new Error(`${label} contains duplicate source or package paths.`);
    sourcePaths.add(sourcePath);
    packagePaths.add(packagePath);
    const sourceSizeBytes = item.sourceSizeBytes;
    const packageSizeBytes = item.packageSizeBytes;
    if (!Number.isSafeInteger(sourceSizeBytes) || sourceSizeBytes <= 0 || !Number.isSafeInteger(packageSizeBytes) || packageSizeBytes <= 0) throw new Error(`${label}[${index}] sizes must be positive safe integers.`);
    return {
      sourcePath,
      sourceSha256: exactHash(item.sourceSha256, `${label}[${index}].sourceSha256`),
      sourceSizeBytes,
      packagePath,
      packageSha256: exactHash(item.packageSha256, `${label}[${index}].packageSha256`),
      packageSizeBytes
    };
  }).sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  return normalized;
}

function assertPackageBindings(root, exchangeId, snapshots, manifest, input, ownershipByPath = null) {
  if (manifest.policy !== "isolated-selected-artifacts") {
    if (!Array.isArray(manifest.packageArtifacts) || manifest.packageArtifacts.length !== 0 || !Array.isArray(input.packageArtifacts) || input.packageArtifacts.length !== 0 || manifest.packageArtifactSetSha256 !== null || input.packageArtifactSetSha256 !== null) {
      throw new Error(`${manifest.policy} must not declare an isolated artifact package.`);
    }
    return { packageArtifacts: [], packageArtifactSetSha256: null };
  }
  const manifestPackage = normalizePackageArtifacts(manifest.packageArtifacts, "manifest.packageArtifacts");
  const inputPackage = normalizePackageArtifacts(input.packageArtifacts, "input.packageArtifacts");
  if (!same(manifestPackage, inputPackage)) throw new Error("Review exchange artifact package drifted between manifest and input.");
  if (manifest.artifactPackagePath !== artifactPackagePath(exchangeId)) throw new Error("Review exchange manifest artifact package path is noncanonical.");
  if (manifestPackage.length !== snapshots.length) throw new Error("Review exchange artifact package does not exactly map the frozen source set.");
  for (const [index, snapshot] of snapshots.entries()) {
    const item = manifestPackage[index];
    if (item.sourcePath !== snapshot.path || item.sourceSha256 !== snapshot.sha256 || item.sourceSizeBytes !== snapshot.sizeBytes) throw new Error(`Review exchange package source mapping drifted for ${snapshot.path}.`);
    if (item.packagePath !== packageArtifactPath(exchangeId, index, snapshot.path)) throw new Error(`Review exchange package path is noncanonical for ${snapshot.path}.`);
    const packageLeaf = currentCanonicalLeaf(root, item.packagePath, `Review exchange packaged artifact ${item.packagePath}`);
    if (packageLeaf.sha256 !== item.packageSha256 || packageLeaf.sizeBytes !== item.packageSizeBytes) throw new Error(`Review exchange packaged artifact changed: ${item.packagePath}.`);
    const sourceLeaf = currentCanonicalLeaf(root, snapshot.path, `Review exchange source artifact ${snapshot.path}`);
    if (sourceLeaf.sha256 !== item.sourceSha256 || sourceLeaf.sizeBytes !== item.sourceSizeBytes || sourceLeaf.sha256 !== packageLeaf.sha256 || sourceLeaf.sizeBytes !== packageLeaf.sizeBytes) throw new Error(`Review exchange source/package mapping is no longer current for ${snapshot.path}.`);
    if (ownershipByPath) {
      const sourceOwner = ownershipByPath.get(item.sourcePath);
      const packageOwner = ownershipByPath.get(item.packagePath);
      if (!sourceOwner || sourceOwner.sha256 !== item.sourceSha256) throw new Error(`Review exchange source ownership is not current for ${item.sourcePath}.`);
      if (!packageOwner || packageOwner.sha256 !== item.packageSha256) throw new Error(`Review exchange package ownership is not current for ${item.packagePath}.`);
    }
  }
  const setHash = stablePackageArtifactSetHash(manifestPackage);
  if (manifest.packageArtifactSetSha256 !== setHash || input.packageArtifactSetSha256 !== setHash) throw new Error("Review exchange package artifact-set hash drifted.");
  return { packageArtifacts: manifestPackage, packageArtifactSetSha256: setHash };
}

function normalizedPolicy(value) {
  const policy = domainNonEmptyText(value, "policy");
  if (!POLICY_SET.has(policy)) throw new Error(`policy must be one of: ${REVIEW_EXCHANGE_POLICIES.join(", ")}.`);
  return policy;
}

function normalizePolicyPaths(args, policy) {
  const artifactPaths = domainStringArray(args.artifactPaths, "artifactPaths");
  const finalPlanPaths = domainStringArray(args.finalPlanPaths, "finalPlanPaths");
  const finalResultPaths = domainStringArray(args.finalResultPaths, "finalResultPaths");
  if (policy === "final-plan-results-only") {
    if (artifactPaths.length > 0) throw new Error("final-plan-results-only does not accept artifactPaths outside its final plan and result classes.");
    if (finalPlanPaths.length === 0 || finalResultPaths.length === 0) throw new Error("final-plan-results-only requires at least one finalPlanPath and one finalResultPath.");
  } else {
    if (finalPlanPaths.length > 0 || finalResultPaths.length > 0) throw new Error(`${policy} accepts only artifactPaths.`);
    if (artifactPaths.length === 0) throw new Error(`${policy} requires at least one artifactPath.`);
  }
  return {
    artifactPaths,
    finalPlanPaths,
    finalResultPaths,
    reviewedArtifactPaths: policy === "final-plan-results-only" ? [...finalPlanPaths, ...finalResultPaths].sort() : artifactPaths
  };
}

function policyInputBoundary(policy) {
  switch (policy) {
    case "local-preflight": return "read-only-current-workspace";
    case "isolated-selected-artifacts": return "selected-artifact-isolation";
    case "final-plan-results-only": return "classified-final-plan-results";
    case "external": return "host-mediated-external-review";
    default: throw new Error(`Unsupported review policy: ${policy}.`);
  }
}

function policyScope(policy, paths) {
  const value = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    policy,
    inputBoundary: policyInputBoundary(policy),
    artifactPaths: paths.artifactPaths,
    finalPlanPaths: paths.finalPlanPaths,
    finalResultPaths: paths.finalResultPaths,
    reviewedArtifactPaths: paths.reviewedArtifactPaths
  };
  return { value, sha256: domainSha256(`${JSON.stringify(value)}\n`) };
}

function reviewPreflight(root, args, operation) {
  const { workspace, mission } = readCurrentMission(root, args.missionId, operation);
  const policy = normalizedPolicy(args.policy);
  const paths = normalizePolicyPaths(args, policy);
  let snapshot;
  let canonical;
  if (policy === "final-plan-results-only") {
    const plans = resolveReviewArtifactSnapshots(root, mission.missionId, paths.finalPlanPaths, "finalPlanPaths");
    const results = resolveReviewArtifactSnapshots(root, mission.missionId, paths.finalResultPaths, "finalResultPaths");
    const finalPlanPaths = plans.reviewedArtifacts.map((item) => item.path);
    const finalResultPaths = results.reviewedArtifacts.map((item) => item.path);
    if (finalPlanPaths.length !== paths.finalPlanPaths.length || finalResultPaths.length !== paths.finalResultPaths.length || finalPlanPaths.some((item) => finalResultPaths.includes(item))) {
      throw new Error("final-plan-results-only contains an internal alias or overlap that collapses the exact classified artifact set.");
    }
    snapshot = resolveReviewArtifactSnapshots(root, mission.missionId, [...finalPlanPaths, ...finalResultPaths], `${policy} review artifacts`);
    canonical = { artifactPaths: [], finalPlanPaths, finalResultPaths, reviewedArtifactPaths: snapshot.reviewedArtifacts.map((item) => item.path) };
  } else {
    snapshot = resolveReviewArtifactSnapshots(root, mission.missionId, paths.artifactPaths, `${policy} review artifacts`);
    const artifactPaths = snapshot.reviewedArtifacts.map((item) => item.path);
    if (artifactPaths.length !== paths.artifactPaths.length) throw new Error(`${policy} contains an internal alias that collapses the exact artifact set.`);
    canonical = { artifactPaths, finalPlanPaths: [], finalResultPaths: [], reviewedArtifactPaths: artifactPaths };
  }
  const scope = policyScope(policy, canonical);
  return { workspace, mission, policy, paths: canonical, snapshot, scope };
}

function reviewPreparationEnvelope(root, prepared) {
  return {
    workspace: fs.realpathSync.native(path.resolve(root)),
    missionId: prepared.mission.missionId,
    contractDigest: prepared.mission.contractDigest,
    policy: prepared.policy,
    inputBoundary: policyInputBoundary(prepared.policy),
    scopeSha256: prepared.scope.sha256,
    artifactPaths: prepared.paths.artifactPaths,
    finalPlanPaths: prepared.paths.finalPlanPaths,
    finalResultPaths: prepared.paths.finalResultPaths,
    reviewedArtifacts: prepared.snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: prepared.snapshot.reviewedArtifactSetSha256
  };
}

function reviewPreparationProposal(root, prepared) {
  const envelope = reviewPreparationEnvelope(root, prepared);
  return {
    envelope,
    proposalDigest: domainSha256(JSON.stringify(envelope)),
    approval: {
      required: true,
      noChangesApplied: true,
      summary: `Dove can freeze ${envelope.reviewedArtifacts.length} current artifact${envelope.reviewedArtifacts.length === 1 ? "" : "s"} for independent review.`,
      effects: [
        "Freeze the selected current artifact set for review.",
        "Create only the review input package and its integrity record.",
        "Keep writer and reviewer private transcripts outside the exchange."
      ],
      question: "Prepare this independent review exchange?"
    }
  };
}

export function previewReviewExchangePreparation(root, args = {}) {
  assertSealedDomainArgs(args, PREPARE_FIELDS, "prepare_review_exchange");
  const prepared = reviewPreflight(root, args, "Review exchange preparation preview");
  if (prepared.policy === "local-preflight") return preflightResult(prepared);
  const proposal = reviewPreparationProposal(root, prepared);
  return {
    status: "needs-confirmation",
    operation: "prepare",
    policy: prepared.policy,
    reviewedArtifactPaths: prepared.paths.reviewedArtifactPaths,
    approval: proposal.approval,
    confirmation: {
      required: true,
      exactReplay: true,
      proposalDigest: proposal.proposalDigest,
      proposalWorkspace: proposal.envelope.workspace,
      confirmArgs: { ...args }
    }
  };
}

function assertApprovedReviewPreparation(root, prepared, approvedProposal) {
  if (!approvedProposal || typeof approvedProposal !== "object" || Array.isArray(approvedProposal)) {
    throw new Error("Review exchange preparation requires the approved in-memory proposal.");
  }
  const current = reviewPreparationProposal(root, prepared);
  if (approvedProposal.proposalDigest !== current.proposalDigest || approvedProposal.proposalWorkspace !== current.envelope.workspace) {
    throw new Error("The approved review exchange no longer matches the current workspace, mission, scope, or artifact snapshots. Request fresh approval.");
  }
}

function newExchangeId(policy) {
  return domainSafeId(`exchange-${policy}-${crypto.randomUUID()}`, "exchangeId");
}

function preflightResult(prepared) {
  return {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: "ready",
    zeroWrite: true,
    missionId: prepared.mission.missionId,
    contractDigest: prepared.mission.contractDigest,
    policy: prepared.policy,
    inputBoundary: policyInputBoundary(prepared.policy),
    scopeSha256: prepared.scope.sha256,
    artifactPaths: prepared.paths.artifactPaths,
    finalPlanPaths: prepared.paths.finalPlanPaths,
    finalResultPaths: prepared.paths.finalResultPaths,
    reviewedArtifactPaths: prepared.snapshot.reviewedArtifacts.map((item) => item.path),
    reviewedArtifacts: prepared.snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: prepared.snapshot.reviewedArtifactSetSha256,
    operation: "preflight",
    nextAction: {
      command: "node ./bin/dove-package.mjs review . --mission-id \"<mission id>\" --policy \"<review policy>\" --artifact \"<artifact path>\" --prepare --mutation-mode direct-process --json",
      mcpTool: "prepare_review_exchange"
    },
    authority: { authoritative: false, callerMayMintAuthority: false, reason: "Local preflight is read-only and non-authoritative." }
  };
}

export function prepareReviewExchange(root, args = {}, options = {}) {
  assertSealedDomainArgs(args, PREPARE_FIELDS, "prepare_review_exchange");
  const prepared = reviewPreflight(root, args, "Review exchange preparation");
  if (prepared.policy === "local-preflight") return preflightResult(prepared);
  if (options.approvedProposal !== undefined) assertApprovedReviewPreparation(root, prepared, options.approvedProposal);

  const exchangeId = newExchangeId(prepared.policy);
  const inputPath = exchangePath(exchangeId, "input.json");
  const manifestPath = exchangePath(exchangeId, "manifest.json");
  const handoffPath = exchangePath(exchangeId, "handoff.json");
  const reportPath = exchangePath(exchangeId, "report.md");
  const exchangeConsumptionPath = consumptionPath(exchangeId);
  const packageRoot = artifactPackagePath(exchangeId);
  const artifactPackage = prepared.policy === "isolated-selected-artifacts"
    ? buildArtifactPackage(root, exchangeId, prepared.snapshot.reviewedArtifacts)
    : { packageArtifacts: [], packageArtifactSetSha256: null, writes: [] };
  const createdAt = new Date().toISOString();
  const preparationReceiptId = domainSafeId(`receipt-prepare-review-exchange-${crypto.randomUUID()}`, "preparationReceiptId");
  const input = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    workspaceId: prepared.workspace.manifest.workspaceId,
    missionId: prepared.mission.missionId,
    contractDigest: prepared.mission.contractDigest,
    exchangeId,
    createdAt,
    policy: prepared.policy,
    inputBoundary: policyInputBoundary(prepared.policy),
    scopeSha256: prepared.scope.sha256,
    preparationReceiptId,
    artifactPaths: prepared.paths.artifactPaths,
    finalPlanPaths: prepared.paths.finalPlanPaths,
    finalResultPaths: prepared.paths.finalResultPaths,
    reviewedArtifactPaths: prepared.snapshot.reviewedArtifacts.map((item) => item.path),
    reviewedArtifacts: prepared.snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: prepared.snapshot.reviewedArtifactSetSha256,
    packageArtifacts: artifactPackage.packageArtifacts,
    packageArtifactSetSha256: artifactPackage.packageArtifactSetSha256,
    outputContract: {
      handoffPath,
      reportPath,
      requiredHandoffFields: [...HANDOFF_FIELDS],
      actionableReturn: {
        completedVerdicts: ["coherent", "needs-revision", "needs-evidence"],
        blockedVerdict: "blocked",
        findingLinkedArtifactMinimum: 1,
        actionItemsRequiredFor: ["needs-revision", "needs-evidence"]
      }
    },
    privacyBoundary: {
      writerPrivateTranscriptShared: false,
      reviewerPrivateTranscriptShouldReturn: false,
      undeclaredContextShared: false,
      acceptedReturnArtifacts: [handoffPath, reportPath]
    }
  };
  const inputContent = domainJson(input);
  const manifest = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    workspaceId: prepared.workspace.manifest.workspaceId,
    missionId: prepared.mission.missionId,
    contractDigest: prepared.mission.contractDigest,
    exchangeId,
    status: "prepared",
    createdAt,
    policy: prepared.policy,
    inputBoundary: policyInputBoundary(prepared.policy),
    scopeSha256: prepared.scope.sha256,
    preparationReceiptId,
    inputPath,
    inputSha256: domainSha256(inputContent),
    handoffPath,
    reportPath,
    consumptionPath: exchangeConsumptionPath,
    artifactPackagePath: packageRoot,
    artifactPaths: input.artifactPaths,
    finalPlanPaths: input.finalPlanPaths,
    finalResultPaths: input.finalResultPaths,
    reviewedArtifactPaths: input.reviewedArtifactPaths,
    reviewedArtifacts: input.reviewedArtifacts,
    reviewedArtifactSetSha256: input.reviewedArtifactSetSha256,
    packageArtifacts: input.packageArtifacts,
    packageArtifactSetSha256: input.packageArtifactSetSha256
  };
  const manifestContent = domainJson(manifest);
  const result = finalizeDomainArtifacts(root, {
    actionId: "prepare-review-exchange",
    receiptId: preparationReceiptId,
    operation: "Review exchange preparation",
    missionId: prepared.mission.missionId,
    summary: `Prepared ${prepared.policy} review exchange ${exchangeId}.`,
    writes: [
      ...artifactPackage.writes,
      { path: inputPath, kind: "data", content: inputContent, derivedReferences: [...input.reviewedArtifactPaths.map((item) => `artifact:${item}`), ...artifactPackage.packageArtifacts.map((item) => `artifact:${item.packagePath}`)] },
      { path: manifestPath, kind: "data", content: manifestContent, derivedReferences: [`artifact:${inputPath}`, ...artifactPackage.packageArtifacts.map((item) => `artifact:${item.packagePath}`)] }
    ]
  });
  return {
    ...result,
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: result.status === "planned" ? "prepare-planned" : "prepared",
    exchangeId,
    policy: prepared.policy,
    scopeSha256: prepared.scope.sha256,
    preparationReceiptId,
    inputPath,
    inputSha256: manifest.inputSha256,
    manifestPath,
    manifestSha256: domainSha256(manifestContent),
    handoffPath,
    reportPath,
    consumptionPath: exchangeConsumptionPath,
    artifactPackagePath: packageRoot,
    packageArtifacts: artifactPackage.packageArtifacts,
    packageArtifactSetSha256: artifactPackage.packageArtifactSetSha256,
    reviewedArtifactPaths: input.reviewedArtifactPaths,
    reviewedArtifactSetSha256: input.reviewedArtifactSetSha256,
    operation: "prepare",
    actionablePaths: {
      input: { path: inputPath, sha256: manifest.inputSha256, role: "review-input" },
      manifest: { path: manifestPath, sha256: domainSha256(manifestContent), role: "review-manifest" },
      handoff: { path: handoffPath, sha256: null, role: "reviewer-return-handoff" },
      report: { path: reportPath, sha256: null, role: "reviewer-return-report" }
    },
    importAction: {
      command: `node ./bin/dove-package.mjs review . --mission-id "${prepared.mission.missionId}" --exchange-id "${exchangeId}" --review-id "<review id>" --import --mutation-mode direct-process --json`,
      mcpTool: "import_review_exchange"
    },
    authority: { authoritative: false, callerMayMintAuthority: false }
  };
}

function assertIdentity(value, manifest, mission, workspaceId, label) {
  if (value.schemaVersion !== REVIEW_EXCHANGE_SCHEMA_VERSION) throw new Error(`${label}.schemaVersion must be ${REVIEW_EXCHANGE_SCHEMA_VERSION}.`);
  if (value.workspaceId !== workspaceId || value.workspaceId !== manifest.workspaceId) throw new Error(`${label} workspace binding mismatch.`);
  if (value.missionId !== mission.missionId || value.missionId !== manifest.missionId) throw new Error(`${label} mission binding mismatch.`);
  if (value.contractDigest !== mission.contractDigest || value.contractDigest !== manifest.contractDigest) throw new Error(`${label} contract digest is stale.`);
  if (value.exchangeId !== manifest.exchangeId) throw new Error(`${label} exchangeId mismatch.`);
  if (value.policy !== manifest.policy) throw new Error(`${label} policy binding mismatch.`);
  if (value.scopeSha256 !== manifest.scopeSha256) throw new Error(`${label} scope binding mismatch.`);
}

function same(value, expected) {
  return JSON.stringify(value) === JSON.stringify(expected);
}

function assertPreparationReceipt(workspace, mission, manifestLeaf, inputLeaf, manifestPath, inputPath, packageArtifacts) {
  const expected = new Map([
    [inputPath, inputLeaf.sha256],
    [manifestPath, manifestLeaf.sha256],
    ...packageArtifacts.map((item) => [item.packagePath, item.packageSha256])
  ]);
  const receipt = workspace.receiptLedger.receipts.find((item) => {
    if (item.producer?.kind !== "dove-internal" || item.producer?.actionId !== "prepare-review-exchange") return false;
    const artifacts = new Map(item.artifacts.map((artifact) => [artifact.path, artifact]));
    return artifacts.size === expected.size && [...expected].every(([artifactPath, sha256]) => artifacts.get(artifactPath)?.sha256 === sha256);
  });
  if (!receipt) throw new Error("Review exchange preparation receipt does not own the exact immutable input, manifest, and package artifact paths and hashes.");
  if (receipt.missionId !== mission.missionId || receipt.contractDigest !== mission.contractDigest) throw new Error("Review exchange preparation receipt mission binding mismatch.");
  return receipt;
}

function assertPreparedScope(manifest, input) {
  const policy = normalizedPolicy(manifest.policy);
  if (policy === "local-preflight") throw new Error("local-preflight cannot create an importable exchange.");
  const expectedInputBoundary = policyInputBoundary(policy);
  if (manifest.inputBoundary !== expectedInputBoundary || input.inputBoundary !== expectedInputBoundary) throw new Error("Review exchange policy input boundary drifted.");
  const fields = ["artifactPaths", "finalPlanPaths", "finalResultPaths", "reviewedArtifactPaths"];
  for (const field of fields) if (!same(manifest[field], input[field])) throw new Error(`Review exchange ${field} drifted between manifest and input.`);
  const paths = normalizePolicyPaths(input, policy);
  if (!same(paths.reviewedArtifactPaths, input.reviewedArtifactPaths)) throw new Error("Review exchange policy scope no longer equals the exact reviewed artifact set.");
  const scope = policyScope(policy, paths);
  if (scope.sha256 !== manifest.scopeSha256 || scope.sha256 !== input.scopeSha256) throw new Error("Review exchange scope hash drifted.");
}

function finalizeReviewImport(root, options) {
  assertGovernanceMutationRegistered("import-review-exchange", "guarded");
  const context = currentMutationContext(root);
  if (!context) throw new Error("import-review-exchange requires an active MutationContext.");
  context.requireCommitPrecondition(ARTIFACT_PATHS.executionReceiptsDir);
  context.requireCommitLock(".dove/.receipt-ledger-append.lock", { label: "Execution receipt ledger append lock" });
  const writes = options.writes.map((item) => {
    const content = Buffer.isBuffer(item.content) ? Buffer.from(item.content) : Buffer.from(String(item.content ?? ""), "utf8");
    if (content.byteLength === 0) throw new Error(`import-review-exchange write ${item.path} must be non-empty.`);
    context.resolve(item.path);
    if (context.fileExists(item.path)) throw new Error(`import-review-exchange refuses to overwrite ${item.path}.`);
    return { ...item, content, sha256: domainSha256(content) };
  });
  const recordedAt = nowIso();
  const receiptArtifacts = [
    ...(options.receiptArtifacts ?? []).map((item) => ({ ...item, derivedReferences: item.derivedReferences ?? [] })),
    ...writes.map((item) => ({ path: item.path, kind: item.kind, sha256: item.sha256, derivedReferences: item.derivedReferences ?? [] }))
  ];
  const duplicateReceiptPath = receiptArtifacts.map((item) => item.path).find((item, index, items) => items.indexOf(item) !== index);
  if (duplicateReceiptPath) throw new Error(`import-review-exchange receipt contains duplicate artifact path ${duplicateReceiptPath}.`);
  const baseReceipt = {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: options.workspace.manifest.workspaceId,
    receiptId: options.receiptId,
    ledgerSequence: options.workspace.receiptLedger.nextLedgerSequence,
    missionId: options.mission.missionId,
    contractDigest: options.mission.contractDigest,
    summary: domainNonEmptyText(options.summary, "summary"),
    artifacts: receiptArtifacts.map(({ path: artifactPath, kind, sha256 }) => ({ path: artifactPath, kind, sha256 })),
    validations: [],
    criteriaSatisfied: [],
    producedAt: recordedAt,
    recordedAt,
    producer: { kind: "dove-internal", actionId: "import-review-exchange" }
  };
  const receipt = { ...baseReceipt, artifacts: deriveArtifactReferences(baseReceipt, new Map(receiptArtifacts.map((item) => [item.path, item.derivedReferences]))) };
  assertReceiptAppendable(options.workspace.receiptLedger, receipt, { missionGraph: options.workspace.missionGraph });
  for (const item of writes) {
    if (Buffer.isBuffer(item.content) && !isPatchPlanMode(root)) context.writeBinary(item.path, item.content);
    else context.writeText(item.path, item.content.toString("utf8"));
  }
  const receiptPath = path.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receipt.receiptId}.json`);
  if (context.fileExists(receiptPath)) throw new Error(`Generated execution receipt id is occupied: ${receipt.receiptId}.`);
  writeJson(root, receiptPath, receipt);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "planned" : "recorded",
    missionId: options.mission.missionId,
    contractDigest: options.mission.contractDigest,
    receipt,
    artifacts: baseReceipt.artifacts,
    completionEligible: false,
    mutation: {
      mutationMode: context.mutationMode,
      writesApplied: !plannedOnly,
      paths: [...writes.map((item) => item.path), receiptPath]
    }
  };
}

function normalizeFindings(items, reviewedArtifactPaths) {
  if (!Array.isArray(items)) throw new Error("Review handoff findings must be an array.");
  const reviewed = new Set(reviewedArtifactPaths);
  const seen = new Set();
  return items.map((item, index) => {
    sealed(item, FINDING_FIELDS, `Review handoff findings[${index}]`);
    const findingId = domainSafeId(item.findingId, `findings[${index}].findingId`);
    if (seen.has(findingId)) throw new Error(`Review handoff contains duplicate findingId ${findingId}.`);
    seen.add(findingId);
    const severity = domainNonEmptyText(item.severity, `findings[${index}].severity`).toLowerCase();
    if (!["low", "medium", "high"].includes(severity)) throw new Error(`findings[${index}].severity must be low, medium, or high.`);
    const linkedArtifactPaths = domainStringArray(item.linkedArtifactPaths, `findings[${index}].linkedArtifactPaths`, { minItems: 1 });
    if (linkedArtifactPaths.some((artifactPath) => !reviewed.has(artifactPath))) throw new Error(`findings[${index}] links an artifact outside the frozen review set.`);
    return { findingId, severity, summary: domainNonEmptyText(item.summary, `findings[${index}].summary`), linkedArtifactPaths };
  });
}

export function importReviewExchange(root, args = {}) {
  assertSealedDomainArgs(args, IMPORT_FIELDS, "import_review_exchange");
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Review exchange import");
  assertMissionAcceptsWrites(workspace, mission);
  const exchangeId = domainSafeId(args.exchangeId, "exchangeId");
  const reviewId = domainSafeId(args.reviewId, "reviewId");
  const inputPath = exchangePath(exchangeId, "input.json");
  const manifestPath = exchangePath(exchangeId, "manifest.json");
  const handoffPath = exchangePath(exchangeId, "handoff.json");
  const reportPath = exchangePath(exchangeId, "report.md");
  const exchangeConsumptionPath = consumptionPath(exchangeId);
  const reviewPath = importedReviewPath(reviewId);
  const finalReportPath = importedReportPath(reviewId);
  const context = currentMutationContext(root);
  if (!context) throw new Error("import_review_exchange requires an active MutationContext.");
  context.requireCommitLock(exchangeLockPath(exchangeId), { label: "Review exchange import lock" });
  if (context.fileExists(exchangeConsumptionPath)) throw new Error(`Review exchange ${exchangeId} has already been consumed.`);
  if (context.fileExists(reviewPath) || context.fileExists(finalReportPath)) throw new Error(`Review ${reviewId} has already been imported.`);

  const manifestLeaf = currentCanonicalLeaf(root, manifestPath, "Review exchange manifest");
  let manifest;
  try {
    manifest = sealed(JSON.parse(manifestLeaf.content.toString("utf8")), MANIFEST_FIELDS, "Review exchange manifest");
  } catch (error) {
    throw new Error(`Review exchange manifest is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (manifest.status !== "prepared") throw new Error(`Review exchange ${exchangeId} is not importable from status ${manifest.status ?? "unknown"}.`);
  domainSafeId(manifest.preparationReceiptId, "manifest.preparationReceiptId");
  if (manifest.exchangeId !== exchangeId) throw new Error("Review exchange manifest exchangeId mismatch.");
  assertIdentity(manifest, manifest, mission, workspace.manifest.workspaceId, "Review exchange manifest");
  if (manifest.inputPath !== inputPath || manifest.handoffPath !== handoffPath || manifest.reportPath !== reportPath || manifest.consumptionPath !== exchangeConsumptionPath) throw new Error("Review exchange manifest contains noncanonical exchange paths.");
  exactHash(manifest.inputSha256, "manifest.inputSha256");

  const inputLeaf = currentCanonicalLeaf(root, inputPath, "Review exchange input");
  let input;
  try {
    input = sealed(JSON.parse(inputLeaf.content.toString("utf8")), INPUT_FIELDS, "Review exchange input");
  } catch (error) {
    throw new Error(`Review exchange input is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
  assertIdentity(input, manifest, mission, workspace.manifest.workspaceId, "Review exchange input");
  domainSafeId(input.preparationReceiptId, "input.preparationReceiptId");
  if (inputLeaf.sha256 !== manifest.inputSha256) throw new Error("Review exchange input hash does not match the prepared manifest.");
  if (input.outputContract?.handoffPath !== handoffPath || input.outputContract?.reportPath !== reportPath) throw new Error("Review exchange input output contract is noncanonical.");
  if (!same(input.outputContract?.requiredHandoffFields, [...HANDOFF_FIELDS])) throw new Error("Review exchange handoff contract drifted.");
  if (!same(input.outputContract?.actionableReturn, {
    completedVerdicts: ["coherent", "needs-revision", "needs-evidence"],
    blockedVerdict: "blocked",
    findingLinkedArtifactMinimum: 1,
    actionItemsRequiredFor: ["needs-revision", "needs-evidence"]
  })) throw new Error("Review exchange actionable return contract drifted.");
  if (input.privacyBoundary?.writerPrivateTranscriptShared !== false || input.privacyBoundary?.reviewerPrivateTranscriptShouldReturn !== false || input.privacyBoundary?.undeclaredContextShared !== false) throw new Error("Review exchange privacy boundary is invalid.");
  assertPreparedScope(manifest, input);

  const manifestSnapshots = normalizeReviewSnapshots(manifest.reviewedArtifacts, "manifest.reviewedArtifacts");
  const inputSnapshots = normalizeReviewSnapshots(input.reviewedArtifacts, "input.reviewedArtifacts");
  if (!manifestSnapshots.ok || !inputSnapshots.ok || !same(manifestSnapshots.snapshots, inputSnapshots.snapshots)) throw new Error("Review exchange artifact snapshot contract drifted.");
  const exactSetHash = stableSnapshotSetHash(manifestSnapshots.snapshots);
  if (manifest.reviewedArtifactSetSha256 !== exactSetHash || input.reviewedArtifactSetSha256 !== exactSetHash) throw new Error("Review exchange artifact-set hash drifted.");
  if (!same(manifest.reviewedArtifactPaths, manifestSnapshots.snapshots.map((item) => item.path))) throw new Error("Review exchange artifact paths do not equal the exact frozen snapshot set.");
  const snapshotVerification = verifyReviewSnapshotSet(root, manifestSnapshots.snapshots, exactSetHash);
  if (!snapshotVerification.ok) throw new Error(`Review exchange artifacts changed before import: ${snapshotVerification.failures.join(", ")}.`);
  const ownershipByPath = new Map(workspace.receiptLedger.currentOwnership.map((item) => [item.path, item]));
  for (const snapshot of manifestSnapshots.snapshots) {
    const owner = ownershipByPath.get(snapshot.path);
    if (!owner || owner.missionId !== mission.missionId || owner.contractDigest !== mission.contractDigest || owner.sha256 !== snapshot.sha256) {
      throw new Error(`Review exchange source ownership is not current for ${snapshot.path}.`);
    }
  }
  const packageBinding = assertPackageBindings(root, exchangeId, manifestSnapshots.snapshots, manifest, input, ownershipByPath);
  const preparationReceipt = assertPreparationReceipt(workspace, mission, manifestLeaf, inputLeaf, manifestPath, inputPath, packageBinding.packageArtifacts);
  if (manifest.preparationReceiptId !== preparationReceipt.receiptId || input.preparationReceiptId !== preparationReceipt.receiptId) throw new Error("Review exchange preparation receipt anchor does not match the ledger owner.");

  const handoffLeaf = currentCanonicalLeaf(root, handoffPath, "Review exchange handoff");
  const reportLeaf = currentCanonicalLeaf(root, reportPath, "Review exchange report");
  const handoff = sealed(JSON.parse(handoffLeaf.content.toString("utf8")), HANDOFF_FIELDS, "Review exchange handoff");
  assertIdentity(handoff, manifest, mission, workspace.manifest.workspaceId, "Review exchange handoff");
  if (handoff.reviewId !== reviewId) throw new Error("Review exchange handoff reviewId mismatch.");
  if (!REVIEW_STATUSES.has(handoff.status)) throw new Error(`Review exchange handoff status is unsupported: ${handoff.status}.`);
  if (!REVIEW_VERDICTS.has(handoff.verdict)) throw new Error(`Review exchange handoff verdict is unsupported: ${handoff.verdict}.`);
  if (handoff.status === "completed" && handoff.verdict === "blocked") throw new Error("A completed review handoff must return coherent, needs-revision, or needs-evidence.");
  if (handoff.status !== "completed" && handoff.verdict !== "blocked") throw new Error("A blocked or failed review handoff must return verdict blocked.");
  if (handoff.inputPath !== inputPath || handoff.reportPath !== reportPath) throw new Error("Review exchange handoff paths do not match the canonical exchange.");
  if (exactHash(handoff.inputSha256, "handoff.inputSha256") !== inputLeaf.sha256) throw new Error("Review exchange handoff input hash mismatch.");
  if (exactHash(handoff.reportSha256, "handoff.reportSha256") !== reportLeaf.sha256) throw new Error("Review exchange report hash mismatch.");
  if (!same(handoff.reviewedArtifactPaths, manifest.reviewedArtifactPaths)) throw new Error("Review exchange handoff scope drifted from the exact frozen artifact set.");

  const findings = normalizeFindings(handoff.findings, manifest.reviewedArtifactPaths);
  const actionItems = domainStringArray(handoff.actionItems, "Review handoff actionItems");
  if (["needs-revision", "needs-evidence"].includes(handoff.verdict) && actionItems.length === 0) throw new Error(`Review handoff verdict ${handoff.verdict} requires at least one actionable action item.`);
  const importReceiptId = domainSafeId(`receipt-import-review-exchange-${crypto.randomUUID()}`, "importReceiptId");
  const consumedAt = nowIso();
  const consumption = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    exchangeId,
    reviewId,
    preparationReceiptId: preparationReceipt.receiptId,
    importReceiptId,
    consumedAt
  };
  sealed(consumption, CONSUMPTION_FIELDS, "Review exchange consumption");
  const consumptionContent = domainJson(consumption);
  const consumptionSha256 = domainSha256(consumptionContent);
  const review = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    exchangeId,
    reviewId,
    policy: manifest.policy,
    scopeSha256: manifest.scopeSha256,
    status: handoff.status,
    verdict: handoff.verdict,
    reviewerId: domainNonEmptyText(handoff.reviewerId, "reviewerId"),
    summary: domainNonEmptyText(handoff.summary, "summary"),
    reviewedAt: exactTimestamp(handoff.reviewedAt, "reviewedAt"),
    reviewedArtifactPaths: manifest.reviewedArtifactPaths,
    reviewedArtifacts: manifestSnapshots.snapshots,
    reviewedArtifactSetSha256: exactSetHash,
    packageArtifacts: packageBinding.packageArtifacts,
    packageArtifactSetSha256: packageBinding.packageArtifactSetSha256,
    findings,
    actionItems,
    preparationReceiptId: preparationReceipt.receiptId,
    importReceiptId,
    exchange: {
      manifestPath,
      manifestSha256: manifestLeaf.sha256,
      inputPath,
      inputSha256: inputLeaf.sha256,
      handoffPath,
      handoffSha256: handoffLeaf.sha256,
      reportPath,
      reportSha256: reportLeaf.sha256,
      consumptionPath: exchangeConsumptionPath,
      consumptionSha256,
      importedReportPath: finalReportPath,
      importedReportSha256: reportLeaf.sha256
    },
    authority: {
      authoritative: false,
      callerMayMintAuthority: false,
      issuer: null,
      reason: "No trusted Reviewer issuer is connected; public handoff, reviewerId, verdict, and report material are non-authoritative."
    },
    privateTranscriptImported: false
  };
  const result = finalizeReviewImport(root, {
    workspace,
    mission,
    receiptId: importReceiptId,
    summary: `Imported non-authoritative review ${reviewId} from exchange ${exchangeId}.`,
    receiptArtifacts: [
      { path: handoffPath, kind: "data", sha256: handoffLeaf.sha256, derivedReferences: [`artifact:${inputPath}`] },
      { path: reportPath, kind: "report", sha256: reportLeaf.sha256, derivedReferences: review.reviewedArtifactPaths.map((item) => `artifact:${item}`) }
    ],
    writes: [
      { path: exchangeConsumptionPath, kind: "data", content: consumptionContent, derivedReferences: [`artifact:${manifestPath}`, `artifact:${inputPath}`] },
      { path: finalReportPath, kind: "report", content: reportLeaf.content, derivedReferences: review.reviewedArtifactPaths.map((item) => `artifact:${item}`) },
      { path: reviewPath, kind: "data", content: domainJson(review), derivedReferences: [`artifact:${exchangeConsumptionPath}`, `artifact:${handoffPath}`, `artifact:${reportPath}`, `artifact:${finalReportPath}`, ...review.reviewedArtifactPaths.map((item) => `artifact:${item}`)] }
    ]
  });
  return {
    ...result,
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: result.status === "planned" ? "import-planned" : "imported",
    exchangeId,
    reviewId,
    review,
    reviewPath,
    reportPath: finalReportPath,
    operation: "import",
    actionablePaths: {
      input: { path: inputPath, sha256: inputLeaf.sha256, role: "review-input" },
      manifest: { path: manifestPath, sha256: manifestLeaf.sha256, role: "review-manifest" },
      handoff: { path: handoffPath, sha256: handoffLeaf.sha256, role: "reviewer-return-handoff" },
      report: { path: finalReportPath, sha256: reportLeaf.sha256, role: "imported-review-report" },
      consumption: { path: exchangeConsumptionPath, sha256: consumptionSha256, role: "review-exchange-consumption" },
      review: { path: reviewPath, sha256: result.artifacts?.find((item) => item.path === reviewPath)?.sha256 ?? null, role: "imported-review-record" }
    },
    nextAction: {
      command: `node ./bin/dove-package.mjs review . --mission-id "${mission.missionId}" --artifact "<reviewed artifact path>" --verify-coverage --json`,
      mcpTool: "verify_review_coverage"
    },
    authoritative: false,
    privateTranscriptImported: false
  };
}

function currentHash(root, relativePath, expectedHash, label) {
  try {
    const leaf = currentCanonicalLeaf(root, relativePath, label);
    return { current: leaf.sha256 === expectedHash, actualSha256: leaf.sha256, reason: leaf.sha256 === expectedHash ? null : "hash-mismatch" };
  } catch (error) {
    return { current: false, actualSha256: null, reason: error instanceof Error ? error.message : String(error) };
  }
}

function readImportedReviews(root, missionId) {
  const directory = path.resolve(root, ".dove/reviews");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const reviewPath = path.posix.join(".dove/reviews", entry.name);
      try {
        const review = sealed(JSON.parse(fs.readFileSync(path.resolve(root, reviewPath), "utf8")), IMPORTED_REVIEW_FIELDS, `Imported review ${reviewPath}`);
        return review.missionId === missionId ? { reviewPath, review } : null;
      } catch (error) {
        return { reviewPath, review: null, readFailure: error instanceof Error ? error.message : String(error) };
      }
    })
    .filter(Boolean);
}

function requestedCoverageSnapshot(root, missionId, requestedPaths) {
  if (requestedPaths.length === 0) return { snapshot: null, failures: [] };
  try {
    return {
      snapshot: resolveReviewArtifactSnapshots(root, missionId, requestedPaths, "review coverage artifacts"),
      failures: []
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/is not a usable file .*path does not exist|is not a registered schema 9 artifact|has changed since its latest ownership receipt/u.test(message)) {
      return { snapshot: null, failures: [`requested-artifact-unavailable:${message}`] };
    }
    throw error;
  }
}

function normalizeExpectedCoverageSnapshots(value) {
  if (value === undefined) return null;
  const normalized = normalizeReviewSnapshots(value, "expectedSnapshots");
  if (!normalized.ok) throw new Error(normalized.reason);
  return {
    reviewedArtifacts: normalized.snapshots,
    reviewedArtifactSetSha256: stableSnapshotSetHash(normalized.snapshots)
  };
}

function receiptArtifactMap(receipt) {
  return new Map(Array.isArray(receipt?.artifacts) ? receipt.artifacts.map((artifact) => [artifact.path, artifact]) : []);
}

function assessImportedReview(root, workspace, mission, { reviewPath, review, readFailure }, requestedSnapshot) {
  const failures = [];
  if (readFailure || !review) return { reviewId: null, reviewPath, current: false, authoritative: false, failures: [readFailure ?? "review-unreadable"] };
  if (review.schemaVersion !== REVIEW_EXCHANGE_SCHEMA_VERSION) {
    return { reviewId: review.reviewId ?? null, reviewPath, current: false, authoritative: false, failures: ["review-schema-invalid"] };
  }
  if (review.contractDigest !== mission.contractDigest) failures.push("contract-digest-stale");
  if (!POLICY_SET.has(review.policy) || review.policy === "local-preflight") failures.push("review-policy-invalid");
  if (review.status !== "completed") failures.push(`review-status-ineligible:${review.status ?? "unknown"}`);
  if (!["coherent", "needs-revision", "needs-evidence"].includes(review.verdict)) failures.push(`review-verdict-ineligible:${review.verdict ?? "unknown"}`);
  const snapshots = normalizeReviewSnapshots(review.reviewedArtifacts, "review.reviewedArtifacts");
  if (!snapshots.ok) failures.push(snapshots.reason);
  const setHash = snapshots.ok ? stableSnapshotSetHash(snapshots.snapshots) : null;
  if (!setHash || review.reviewedArtifactSetSha256 !== setHash || !same(review.reviewedArtifactPaths, snapshots.snapshots.map((item) => item.path))) failures.push("reviewed-artifact-set-hash-mismatch");
  if (snapshots.ok) failures.push(...verifyReviewSnapshotSet(root, snapshots.snapshots, setHash).failures);
  if (requestedSnapshot && (!snapshots.ok || !same(requestedSnapshot.reviewedArtifacts, snapshots.snapshots))) failures.push("requested-artifact-set-not-exactly-covered");
  const importReceipt = workspace.receiptLedger.receipts.find((receipt) => receipt.receiptId === review.importReceiptId);
  const preparationReceipt = workspace.receiptLedger.receipts.find((receipt) => receipt.receiptId === review.preparationReceiptId);
  if (importReceipt?.producer?.kind !== "dove-internal" || importReceipt?.producer?.actionId !== "import-review-exchange") failures.push("import-review-receipt-missing");
  if (preparationReceipt?.producer?.kind !== "dove-internal" || preparationReceipt?.producer?.actionId !== "prepare-review-exchange") failures.push("preparation-review-receipt-missing");
  if (importReceipt && (importReceipt.missionId !== mission.missionId || importReceipt.contractDigest !== mission.contractDigest)) failures.push("import-review-receipt-binding-mismatch");
  if (preparationReceipt && (preparationReceipt.missionId !== mission.missionId || preparationReceipt.contractDigest !== mission.contractDigest)) failures.push("preparation-review-receipt-binding-mismatch");
  try {
    const exchange = sealed(review.exchange, EXCHANGE_HASH_FIELDS, `Imported review ${review.reviewId} exchange`);
    const importArtifacts = receiptArtifactMap(importReceipt);
    const preparationArtifacts = receiptArtifactMap(preparationReceipt);
    const reviewLeaf = currentHash(root, reviewPath, importArtifacts.get(reviewPath)?.sha256, "imported review record");
    if (!importArtifacts.has(reviewPath) || !reviewLeaf.current) failures.push("imported-review-receipt-hash-stale");
    if (importArtifacts.get(exchange.importedReportPath)?.sha256 !== exchange.importedReportSha256) failures.push("imported-report-receipt-hash-mismatch");
    if (preparationArtifacts.get(exchange.manifestPath)?.sha256 !== exchange.manifestSha256) failures.push("manifest-receipt-hash-mismatch");
    if (preparationArtifacts.get(exchange.inputPath)?.sha256 !== exchange.inputSha256) failures.push("input-receipt-hash-mismatch");
    if (importArtifacts.get(exchange.handoffPath)?.sha256 !== exchange.handoffSha256) failures.push("handoff-receipt-hash-mismatch");
    if (importArtifacts.get(exchange.reportPath)?.sha256 !== exchange.reportSha256) failures.push("exchange-report-receipt-hash-mismatch");
    if (importArtifacts.get(exchange.consumptionPath)?.sha256 !== exchange.consumptionSha256) failures.push("consumption-receipt-hash-mismatch");
    let manifest = null;
    let input = null;
    try {
      manifest = sealed(JSON.parse(fs.readFileSync(path.resolve(root, exchange.manifestPath), "utf8")), MANIFEST_FIELDS, `Imported review ${review.reviewId} manifest`);
      input = sealed(JSON.parse(fs.readFileSync(path.resolve(root, exchange.inputPath), "utf8")), INPUT_FIELDS, `Imported review ${review.reviewId} input`);
    } catch (error) {
      failures.push(`prepared-review-control-invalid:${error instanceof Error ? error.message : String(error)}`);
    }
    if (manifest && input) {
      if (manifest.preparationReceiptId !== review.preparationReceiptId || input.preparationReceiptId !== review.preparationReceiptId) failures.push("preparation-receipt-anchor-mismatch");
      const preparedSnapshots = normalizeReviewSnapshots(manifest.reviewedArtifacts, "manifest.reviewedArtifacts");
      const inputSnapshots = normalizeReviewSnapshots(input.reviewedArtifacts, "input.reviewedArtifacts");
      if (!preparedSnapshots.ok || !inputSnapshots.ok || !same(preparedSnapshots.snapshots, inputSnapshots.snapshots)) failures.push("prepared-reviewed-artifact-set-invalid");
      else {
        const preparedSetHash = stableSnapshotSetHash(preparedSnapshots.snapshots);
        if (manifest.reviewedArtifactSetSha256 !== preparedSetHash || input.reviewedArtifactSetSha256 !== preparedSetHash) failures.push("prepared-reviewed-artifact-set-hash-mismatch");
        if (!same(review.reviewedArtifacts, preparedSnapshots.snapshots) || review.reviewedArtifactSetSha256 !== preparedSetHash || !same(review.reviewedArtifactPaths, preparedSnapshots.snapshots.map((item) => item.path))) failures.push("reviewed-set-not-receipt-anchored");
      }
    }
    for (const [pathField, hashField, label] of [
      ["manifestPath", "manifestSha256", "review manifest"],
      ["inputPath", "inputSha256", "review input"],
      ["handoffPath", "handoffSha256", "review handoff"],
      ["reportPath", "reportSha256", "review report"],
      ["importedReportPath", "importedReportSha256", "imported review report"]
    ]) {
      if (!HASH_PATTERN.test(String(exchange[hashField] ?? ""))) failures.push(`${hashField}-invalid`);
      else if (!currentHash(root, exchange[pathField], exchange[hashField], label).current) failures.push(`${hashField}-stale`);
    }
  } catch (error) {
    failures.push(`review-exchange-invalid:${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    const authority = sealed(review.authority, AUTHORITY_FIELDS, `Imported review ${review.reviewId} authority`);
    if (
      authority.authoritative !== false
      || authority.callerMayMintAuthority !== false
      || authority.issuer !== null
      || typeof authority.reason !== "string"
      || !authority.reason.trim()
    ) failures.push("public-review-authority-invalid");
  } catch (error) {
    failures.push(`public-review-authority-invalid:${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    reviewId: review.reviewId,
    exchangeId: review.exchangeId,
    reviewPath,
    policy: review.policy,
    verdict: review.verdict,
    current: failures.length === 0,
    authoritative: false,
    reviewedArtifactPaths: review.reviewedArtifactPaths,
    reviewedArtifactSetSha256: review.reviewedArtifactSetSha256,
    failures: [...new Set(failures)]
  };
}

function verifyReviewCoverageInput(root, args, fields, operation) {
  assertSealedDomainArgs(args, fields, operation);
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Review coverage verification");
  const requestedPaths = args.artifactPaths === undefined ? [] : domainStringArray(args.artifactPaths, "artifactPaths");
  const expected = normalizeExpectedCoverageSnapshots(args.expectedSnapshots);
  const requested = expected
    ? { snapshot: expected, failures: [] }
    : requestedCoverageSnapshot(root, mission.missionId, requestedPaths);
  const assessments = readImportedReviews(root, mission.missionId)
    .map((item) => assessImportedReview(root, workspace, mission, item, requested.snapshot));
  const currentReviews = assessments.filter((item) => item.current);
  const failures = [...requested.failures];
  const exactCoverageRequested = requestedPaths.length > 0 || expected !== null;
  if (currentReviews.length === 0) failures.push(exactCoverageRequested ? "current-exact-review-coverage-missing" : "current-review-coverage-missing");
  if (args.requireAuthoritative === true) failures.push("trusted-review-issuer-missing");
  return {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: failures.length === 0 ? "covered" : "not-covered",
    zeroWrite: true,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    requestedArtifactPaths: requested.snapshot?.reviewedArtifacts.map((item) => item.path) ?? requestedPaths,
    requestedArtifactSetSha256: requested.snapshot?.reviewedArtifactSetSha256 ?? null,
    covered: requested.failures.length === 0 && currentReviews.length > 0,
    authoritative: false,
    issuer: null,
    failures: [...new Set(failures)],
    reviews: assessments
  };
}

export function verifyExpectedReviewCoverage(root, args = {}) {
  return verifyReviewCoverageInput(root, args, EXPECTED_COVERAGE_FIELDS, "verify expected review coverage");
}

export function verifyReviewCoverage(root, args = {}) {
  return verifyReviewCoverageInput(root, args, COVERAGE_FIELDS, "verify_review_coverage");
}
