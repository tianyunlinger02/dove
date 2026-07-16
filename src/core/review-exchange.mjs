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
import {
  normalizeReviewSnapshots,
  resolveReviewArtifactSnapshots,
  stableSnapshotSetHash,
  verifyReviewSnapshotSet
} from "./review-artifact-snapshot.mjs";

export const REVIEW_EXCHANGE_SCHEMA_VERSION = 7;
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
  "scopeSha256", "inputBoundary", "artifactPaths", "finalPlanPaths", "finalResultPaths", "reviewedArtifactPaths",
  "reviewedArtifacts", "reviewedArtifactSetSha256", "outputContract", "privacyBoundary"
]);
const MANIFEST_FIELDS = new Set([
  "schemaVersion", "workspaceId", "missionId", "contractDigest", "exchangeId", "status", "createdAt", "policy",
  "scopeSha256", "inputBoundary", "inputPath", "inputSha256", "handoffPath", "reportPath", "artifactPaths", "finalPlanPaths",
  "finalResultPaths", "reviewedArtifactPaths", "reviewedArtifacts", "reviewedArtifactSetSha256"
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
  "reviewedArtifactSetSha256", "findings", "actionItems", "exchange", "authority", "privateTranscriptImported"
]);
const EXCHANGE_HASH_FIELDS = new Set([
  "manifestPath", "manifestSha256", "inputPath", "inputSha256", "handoffPath", "handoffSha256", "reportPath", "reportSha256",
  "importedReportPath", "importedReportSha256"
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
  const content = fs.readFileSync(path.resolve(root, canonicalPath));
  return { path: canonicalPath, content, sha256: domainSha256(content) };
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
    authority: { authoritative: false, callerMayMintAuthority: false, reason: "Local preflight is read-only and non-authoritative." }
  };
}

export function prepareReviewExchange(root, args = {}) {
  assertSealedDomainArgs(args, PREPARE_FIELDS, "prepare_review_exchange");
  const prepared = reviewPreflight(root, args, "Review exchange preparation");
  if (prepared.policy === "local-preflight") return preflightResult(prepared);

  const exchangeId = newExchangeId(prepared.policy);
  const inputPath = exchangePath(exchangeId, "input.json");
  const manifestPath = exchangePath(exchangeId, "manifest.json");
  const handoffPath = exchangePath(exchangeId, "handoff.json");
  const reportPath = exchangePath(exchangeId, "report.md");
  const createdAt = new Date().toISOString();
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
    artifactPaths: prepared.paths.artifactPaths,
    finalPlanPaths: prepared.paths.finalPlanPaths,
    finalResultPaths: prepared.paths.finalResultPaths,
    reviewedArtifactPaths: prepared.snapshot.reviewedArtifacts.map((item) => item.path),
    reviewedArtifacts: prepared.snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: prepared.snapshot.reviewedArtifactSetSha256,
    outputContract: {
      handoffPath,
      reportPath,
      requiredHandoffFields: [...HANDOFF_FIELDS]
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
    inputPath,
    inputSha256: domainSha256(inputContent),
    handoffPath,
    reportPath,
    artifactPaths: input.artifactPaths,
    finalPlanPaths: input.finalPlanPaths,
    finalResultPaths: input.finalResultPaths,
    reviewedArtifactPaths: input.reviewedArtifactPaths,
    reviewedArtifacts: input.reviewedArtifacts,
    reviewedArtifactSetSha256: input.reviewedArtifactSetSha256
  };
  const manifestContent = domainJson(manifest);
  const result = finalizeDomainArtifacts(root, {
    actionId: "prepare-review-exchange",
    operation: "Review exchange preparation",
    missionId: prepared.mission.missionId,
    summary: `Prepared ${prepared.policy} review exchange ${exchangeId}.`,
    writes: [
      { path: inputPath, kind: "data", content: inputContent, derivedReferences: input.reviewedArtifactPaths.map((item) => `artifact:${item}`) },
      { path: manifestPath, kind: "data", content: manifestContent, derivedReferences: [`artifact:${inputPath}`] }
    ]
  });
  return {
    ...result,
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: result.status === "planned" ? "prepare-planned" : "prepared",
    exchangeId,
    policy: prepared.policy,
    scopeSha256: prepared.scope.sha256,
    inputPath,
    inputSha256: manifest.inputSha256,
    manifestPath,
    manifestSha256: domainSha256(manifestContent),
    handoffPath,
    reportPath,
    reviewedArtifactPaths: input.reviewedArtifactPaths,
    reviewedArtifactSetSha256: input.reviewedArtifactSetSha256,
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
    const linkedArtifactPaths = domainStringArray(item.linkedArtifactPaths, `findings[${index}].linkedArtifactPaths`);
    if (linkedArtifactPaths.some((artifactPath) => !reviewed.has(artifactPath))) throw new Error(`findings[${index}] links an artifact outside the frozen review set.`);
    return { findingId, severity, summary: domainNonEmptyText(item.summary, `findings[${index}].summary`), linkedArtifactPaths };
  });
}

export function importReviewExchange(root, args = {}) {
  assertSealedDomainArgs(args, IMPORT_FIELDS, "import_review_exchange");
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Review exchange import");
  const exchangeId = domainSafeId(args.exchangeId, "exchangeId");
  const reviewId = domainSafeId(args.reviewId, "reviewId");
  const inputPath = exchangePath(exchangeId, "input.json");
  const manifestPath = exchangePath(exchangeId, "manifest.json");
  const handoffPath = exchangePath(exchangeId, "handoff.json");
  const reportPath = exchangePath(exchangeId, "report.md");
  const reviewPath = importedReviewPath(reviewId);
  const finalReportPath = importedReportPath(reviewId);
  if (fs.existsSync(path.resolve(root, reviewPath)) || fs.existsSync(path.resolve(root, finalReportPath))) throw new Error(`Review ${reviewId} has already been imported.`);

  const manifestLeaf = currentCanonicalLeaf(root, manifestPath, "Review exchange manifest");
  const manifest = sealed(JSON.parse(manifestLeaf.content.toString("utf8")), MANIFEST_FIELDS, "Review exchange manifest");
  if (manifest.status !== "prepared") throw new Error(`Review exchange ${exchangeId} is not importable from status ${manifest.status ?? "unknown"}.`);
  if (manifest.exchangeId !== exchangeId) throw new Error("Review exchange manifest exchangeId mismatch.");
  assertIdentity(manifest, manifest, mission, workspace.manifest.workspaceId, "Review exchange manifest");
  if (manifest.inputPath !== inputPath || manifest.handoffPath !== handoffPath || manifest.reportPath !== reportPath) throw new Error("Review exchange manifest contains noncanonical exchange paths.");
  exactHash(manifest.inputSha256, "manifest.inputSha256");

  const inputLeaf = currentCanonicalLeaf(root, inputPath, "Review exchange input");
  const input = sealed(JSON.parse(inputLeaf.content.toString("utf8")), INPUT_FIELDS, "Review exchange input");
  assertIdentity(input, manifest, mission, workspace.manifest.workspaceId, "Review exchange input");
  if (inputLeaf.sha256 !== manifest.inputSha256) throw new Error("Review exchange input hash does not match the prepared manifest.");
  if (input.outputContract?.handoffPath !== handoffPath || input.outputContract?.reportPath !== reportPath) throw new Error("Review exchange input output contract is noncanonical.");
  if (!same(input.outputContract?.requiredHandoffFields, [...HANDOFF_FIELDS])) throw new Error("Review exchange handoff contract drifted.");
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

  const handoffLeaf = currentCanonicalLeaf(root, handoffPath, "Review exchange handoff");
  const reportLeaf = currentCanonicalLeaf(root, reportPath, "Review exchange report");
  const handoff = sealed(JSON.parse(handoffLeaf.content.toString("utf8")), HANDOFF_FIELDS, "Review exchange handoff");
  assertIdentity(handoff, manifest, mission, workspace.manifest.workspaceId, "Review exchange handoff");
  if (handoff.reviewId !== reviewId) throw new Error("Review exchange handoff reviewId mismatch.");
  if (!REVIEW_STATUSES.has(handoff.status)) throw new Error(`Review exchange handoff status is unsupported: ${handoff.status}.`);
  if (!REVIEW_VERDICTS.has(handoff.verdict)) throw new Error(`Review exchange handoff verdict is unsupported: ${handoff.verdict}.`);
  if (handoff.status !== "completed" && handoff.verdict === "coherent") throw new Error("A non-completed review handoff cannot return a coherent verdict.");
  if (handoff.inputPath !== inputPath || handoff.reportPath !== reportPath) throw new Error("Review exchange handoff paths do not match the canonical exchange.");
  if (exactHash(handoff.inputSha256, "handoff.inputSha256") !== inputLeaf.sha256) throw new Error("Review exchange handoff input hash mismatch.");
  if (exactHash(handoff.reportSha256, "handoff.reportSha256") !== reportLeaf.sha256) throw new Error("Review exchange report hash mismatch.");
  if (!same(handoff.reviewedArtifactPaths, manifest.reviewedArtifactPaths)) throw new Error("Review exchange handoff scope drifted from the exact frozen artifact set.");

  const findings = normalizeFindings(handoff.findings, manifest.reviewedArtifactPaths);
  const actionItems = domainStringArray(handoff.actionItems, "Review handoff actionItems");
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
    findings,
    actionItems,
    exchange: {
      manifestPath,
      manifestSha256: manifestLeaf.sha256,
      inputPath,
      inputSha256: inputLeaf.sha256,
      handoffPath,
      handoffSha256: handoffLeaf.sha256,
      reportPath,
      reportSha256: reportLeaf.sha256,
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
  const result = finalizeDomainArtifacts(root, {
    actionId: "import-review-exchange",
    operation: "Review exchange import",
    missionId: mission.missionId,
    summary: `Imported non-authoritative review ${reviewId} from exchange ${exchangeId}.`,
    writes: [
      { path: finalReportPath, kind: "report", content: reportLeaf.content, derivedReferences: review.reviewedArtifactPaths.map((item) => `artifact:${item}`) },
      { path: reviewPath, kind: "data", content: domainJson(review), derivedReferences: [`artifact:${finalReportPath}`, ...review.reviewedArtifactPaths.map((item) => `artifact:${item}`)] }
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
    if (/is not a usable file .*path does not exist|is not a registered schema 7 artifact|has changed since its latest ownership receipt/u.test(message)) {
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

function assessImportedReview(root, mission, { reviewPath, review, readFailure }, requestedSnapshot) {
  const failures = [];
  if (readFailure || !review) return { reviewId: null, reviewPath, current: false, authoritative: false, failures: [readFailure ?? "review-unreadable"] };
  if (review.schemaVersion !== REVIEW_EXCHANGE_SCHEMA_VERSION) {
    return { reviewId: review.reviewId ?? null, reviewPath, current: false, authoritative: false, failures: ["review-schema-invalid"] };
  }
  if (review.contractDigest !== mission.contractDigest) failures.push("contract-digest-stale");
  if (!POLICY_SET.has(review.policy) || review.policy === "local-preflight") failures.push("review-policy-invalid");
  const snapshots = normalizeReviewSnapshots(review.reviewedArtifacts, "review.reviewedArtifacts");
  if (!snapshots.ok) failures.push(snapshots.reason);
  const setHash = snapshots.ok ? stableSnapshotSetHash(snapshots.snapshots) : null;
  if (!setHash || review.reviewedArtifactSetSha256 !== setHash || !same(review.reviewedArtifactPaths, snapshots.snapshots.map((item) => item.path))) failures.push("reviewed-artifact-set-hash-mismatch");
  if (snapshots.ok) failures.push(...verifyReviewSnapshotSet(root, snapshots.snapshots, setHash).failures);
  if (requestedSnapshot && (!snapshots.ok || !same(requestedSnapshot.reviewedArtifacts, snapshots.snapshots))) failures.push("requested-artifact-set-not-exactly-covered");
  try {
    const exchange = sealed(review.exchange, EXCHANGE_HASH_FIELDS, `Imported review ${review.reviewId} exchange`);
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
  const { mission } = readCurrentMission(root, args.missionId, "Review coverage verification");
  const requestedPaths = args.artifactPaths === undefined ? [] : domainStringArray(args.artifactPaths, "artifactPaths");
  const expected = normalizeExpectedCoverageSnapshots(args.expectedSnapshots);
  const requested = expected
    ? { snapshot: expected, failures: [] }
    : requestedCoverageSnapshot(root, mission.missionId, requestedPaths);
  const assessments = readImportedReviews(root, mission.missionId)
    .map((item) => assessImportedReview(root, mission, item, requested.snapshot));
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
