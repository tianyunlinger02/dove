import fs from "node:fs";
import path from "node:path";

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
import { requireNativeReviewerHost } from "./host-registry.mjs";
import { assertMissionAcceptsWrites, missionCanReadMission } from "./mission-graph.mjs";
import { assertReviewMissionBinding } from "./review-mission-binding.mjs";
import { currentMutationContext } from "./mutation-backend.mjs";
import {
  normalizeReviewSnapshots,
  resolveReviewArtifactSnapshots,
  stableSnapshotSetHash,
  verifyReviewSnapshotSet
} from "./review-artifact-snapshot.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";

export const REVIEW_RECORD_SCHEMA_VERSION = 1;
export const REVIEW_STATUSES = Object.freeze(["completed", "blocked", "failed"]);
export const REVIEW_VERDICTS = Object.freeze(["coherent", "needs-revision", "needs-evidence", "blocked"]);

const SCOPE_FIELDS = new Set(["missionId", "reviewMissionBinding", "artifactPaths", "hostKind"]);
const ARCHIVE_FIELDS = new Set(["missionId", "scopeBinding", "status", "verdict", "summary", "findings", "actionItems", "report", "provenance"]);
const SCOPE_BINDING_FIELDS = new Set(["schemaVersion", "missionId", "contractDigest", "reviewMissionBinding", "hostKind", "reviewedArtifacts", "reviewedArtifactSetSha256"]);
const FINDING_FIELDS = new Set(["findingId", "severity", "summary", "linkedArtifactPaths"]);
const PROVENANCE_FIELDS = new Set(["hostKind", "reviewedAt", "provider", "model"]);
const RECORD_FIELDS = new Set([
  "schemaVersion", "reviewId", "missionId", "contractDigest", "status", "verdict", "summary", "reviewedArtifacts",
  "reviewedArtifactSetSha256", "findings", "actionItems", "reportPath", "reportSha256", "provenance", "authority", "receiptId", "archiveDigest", "archivedAt"
]);
const HASH = /^[a-f0-9]{64}$/u;

function sealed(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  return value;
}

function exactIso(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value;
}

function optionalCanonicalText(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) throw new Error(`${label} must be a canonical non-empty string when supplied.`);
  return value;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function reviewIdForMission(missionId) {
  return `review-${domainSha256(`dove-review-record\n${missionId}\n`).slice(0, 24)}`;
}

function reviewPath(reviewId) {
  return path.posix.join(ARTIFACT_PATHS.reviewsDir, `${reviewId}.json`);
}

function reportPath(reviewId) {
  return path.posix.join(ARTIFACT_PATHS.reviewsDir, `${reviewId}.report.md`);
}

function canonicalReviewRecordPath(value, label) {
  const candidate = domainNonEmptyText(value, label);
  const fileName = path.posix.basename(candidate);
  if (!/^review-[a-f0-9]{24}\.json$/u.test(fileName) || candidate !== path.posix.join(ARTIFACT_PATHS.reviewsDir, fileName)) {
    throw new Error(`${label} must be a canonical Review archive path.`);
  }
  return candidate;
}

function receiptIdForReview(reviewId) {
  return `receipt-archive-${reviewId}`;
}

function receiptPath(receiptId) {
  return path.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
}

function scopeBinding(prepared, hostKind) {
  return {
    schemaVersion: REVIEW_RECORD_SCHEMA_VERSION,
    missionId: prepared.mission.missionId,
    contractDigest: prepared.mission.contractDigest,
    reviewMissionBinding: prepared.reviewMissionBinding,
    hostKind,
    reviewedArtifacts: prepared.snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: prepared.snapshot.reviewedArtifactSetSha256
  };
}

function normalizeScopeBinding(value) {
  sealed(value, SCOPE_BINDING_FIELDS, "scopeBinding");
  if (value.schemaVersion !== REVIEW_RECORD_SCHEMA_VERSION) throw new Error(`scopeBinding.schemaVersion must be ${REVIEW_RECORD_SCHEMA_VERSION}.`);
  const missionId = domainSafeId(value.missionId, "scopeBinding.missionId");
  if (!HASH.test(String(value.contractDigest ?? ""))) throw new Error("scopeBinding.contractDigest must be a lowercase SHA-256 hash.");
  const host = requireNativeReviewerHost(value.hostKind);
  if (typeof value.reviewMissionBinding !== "string") throw new Error("scopeBinding.reviewMissionBinding must be the original opaque Review Mission binding.");
  const snapshots = normalizeReviewSnapshots(value.reviewedArtifacts, "scopeBinding.reviewedArtifacts");
  if (!snapshots.ok) throw new Error(snapshots.reason);
  const setHash = stableSnapshotSetHash(snapshots.snapshots);
  if (value.reviewedArtifactSetSha256 !== setHash) throw new Error("scopeBinding reviewed artifact set hash is invalid.");
  return {
    schemaVersion: REVIEW_RECORD_SCHEMA_VERSION,
    missionId,
    contractDigest: value.contractDigest,
    reviewMissionBinding: value.reviewMissionBinding,
    hostKind: host.id,
    reviewedArtifacts: snapshots.snapshots,
    reviewedArtifactSetSha256: setHash
  };
}

function prepareScope(root, args, operation) {
  const { workspace, mission } = readCurrentMission(root, args.missionId, operation);
  assertMissionAcceptsWrites(workspace, mission);
  const host = requireNativeReviewerHost(args.hostKind);
  const reviewMissionBindingValue = assertReviewMissionBinding(workspace, mission, args.reviewMissionBinding);
  const artifactPaths = domainStringArray(args.artifactPaths, "artifactPaths", { minItems: 1 });
  const snapshot = resolveReviewArtifactSnapshots(root, mission.missionId, artifactPaths, "review artifact scope", { missionGraph: workspace.missionGraph });
  if (snapshot.reviewedArtifacts.length !== artifactPaths.length) throw new Error("Review artifact scope contains an ambiguous duplicate or alias.");
  return { workspace, mission, host, reviewMissionBinding: reviewMissionBindingValue, snapshot };
}

export function scopeReviewRecord(root, args = {}) {
  assertSealedDomainArgs(args, SCOPE_FIELDS, "review scope");
  const prepared = prepareScope(root, args, "Review scope");
  const binding = scopeBinding(prepared, prepared.host.id);
  return {
    schemaVersion: REVIEW_RECORD_SCHEMA_VERSION,
    status: "scoped",
    operation: "scope",
    zeroWrite: true,
    reviewedArtifactPaths: binding.reviewedArtifacts.map((item) => item.path),
    scopeBinding: binding,
    reviewerLaunch: {
      kind: "native-reviewer",
      hostKind: prepared.host.id,
      agent: "dove-reviewer",
      exactlyOnce: true,
      freshContext: true,
      readOnly: true,
      synchronous: true,
      mcpAgentLaunch: false
    }
  };
}

function normalizeFindings(items, reviewedArtifactPaths) {
  if (!Array.isArray(items)) throw new Error("findings must be an array.");
  const reviewed = new Set(reviewedArtifactPaths);
  const seen = new Set();
  return items.map((item, index) => {
    sealed(item, FINDING_FIELDS, `findings[${index}]`);
    const findingId = domainSafeId(item.findingId, `findings[${index}].findingId`);
    if (seen.has(findingId)) throw new Error(`findings contains duplicate findingId ${findingId}.`);
    seen.add(findingId);
    const severity = domainNonEmptyText(item.severity, `findings[${index}].severity`).toLowerCase();
    if (!["low", "medium", "high"].includes(severity)) throw new Error(`findings[${index}].severity must be low, medium, or high.`);
    const linkedArtifactPaths = domainStringArray(item.linkedArtifactPaths, `findings[${index}].linkedArtifactPaths`, { minItems: 1 });
    if (linkedArtifactPaths.some((artifactPath) => !reviewed.has(artifactPath))) throw new Error(`findings[${index}] links an artifact outside the frozen review scope.`);
    return { findingId, severity, summary: domainNonEmptyText(item.summary, `findings[${index}].summary`), linkedArtifactPaths };
  });
}

function normalizeProvenance(value, binding) {
  sealed(value, PROVENANCE_FIELDS, "provenance");
  const host = requireNativeReviewerHost(value.hostKind);
  if (host.id !== binding.hostKind) throw new Error("provenance.hostKind does not match the original review scope binding.");
  return {
    hostKind: host.id,
    reviewedAt: exactIso(value.reviewedAt, "provenance.reviewedAt"),
    ...(value.provider === undefined ? {} : { provider: optionalCanonicalText(value.provider, "provenance.provider") }),
    ...(value.model === undefined ? {} : { model: optionalCanonicalText(value.model, "provenance.model") })
  };
}

function normalizeArchiveInput(root, args) {
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Review archive");
  const binding = normalizeScopeBinding(args.scopeBinding);
  if (binding.missionId !== mission.missionId || binding.contractDigest !== mission.contractDigest) throw new Error("The original review scope binding does not select the current Review Mission contract.");
  assertReviewMissionBinding(workspace, mission, binding.reviewMissionBinding);
  const current = resolveReviewArtifactSnapshots(root, mission.missionId, binding.reviewedArtifacts.map((item) => item.path), "archived review scope", { missionGraph: workspace.missionGraph });
  if (!same(current.reviewedArtifacts, binding.reviewedArtifacts) || current.reviewedArtifactSetSha256 !== binding.reviewedArtifactSetSha256) {
    throw new Error("The frozen review scope is stale or no longer current.");
  }
  const status = domainNonEmptyText(args.status, "status").toLowerCase();
  const verdict = domainNonEmptyText(args.verdict, "verdict").toLowerCase();
  if (!REVIEW_STATUSES.includes(status)) throw new Error(`status must be one of: ${REVIEW_STATUSES.join(", ")}.`);
  if (!REVIEW_VERDICTS.includes(verdict)) throw new Error(`verdict must be one of: ${REVIEW_VERDICTS.join(", ")}.`);
  if (status === "completed" && verdict === "blocked") throw new Error("A completed review must return coherent, needs-revision, or needs-evidence.");
  if (status !== "completed" && verdict !== "blocked") throw new Error("A blocked or failed review must return verdict blocked.");
  const findings = normalizeFindings(args.findings, binding.reviewedArtifacts.map((item) => item.path));
  const actionItems = domainStringArray(args.actionItems, "actionItems");
  if (["needs-revision", "needs-evidence"].includes(verdict) && (findings.length === 0 || actionItems.length === 0)) {
    throw new Error(`${verdict} requires at least one linked finding and one action item.`);
  }
  const report = domainNonEmptyText(args.report, "report");
  const provenance = normalizeProvenance(args.provenance, binding);
  return {
    workspace,
    mission,
    binding,
    status,
    verdict,
    summary: domainNonEmptyText(args.summary, "summary"),
    findings,
    actionItems,
    report: report.endsWith("\n") ? report : `${report}\n`,
    provenance
  };
}

function archiveContent(input) {
  return {
    status: input.status,
    verdict: input.verdict,
    summary: input.summary,
    reviewedArtifacts: input.binding.reviewedArtifacts,
    reviewedArtifactSetSha256: input.binding.reviewedArtifactSetSha256,
    findings: input.findings,
    actionItems: input.actionItems,
    reportSha256: domainSha256(input.report),
    provenance: input.provenance
  };
}

function readJsonFile(root, relativePath, label) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(root, relativePath), "utf8"));
  } catch (error) {
    throw new Error(`${label} is unreadable or malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function exactReplay(root, input, paths, digest) {
  const presence = [paths.record, paths.report, paths.receipt].map((relativePath) => fs.existsSync(path.resolve(root, relativePath)));
  if (!presence.some(Boolean)) return null;
  if (!presence.every(Boolean)) throw new Error("The archived review output set is incomplete and cannot be replayed.");
  const record = sealed(readJsonFile(root, paths.record, "Archived review record"), RECORD_FIELDS, "Archived review record");
  const report = fs.readFileSync(path.resolve(root, paths.report), "utf8");
  const receipt = readJsonFile(root, paths.receipt, "Archived review receipt");
  const expectedContent = archiveContent(input);
  const valid = record.schemaVersion === REVIEW_RECORD_SCHEMA_VERSION
    && record.archiveDigest === digest
    && record.reviewId === paths.reviewId
    && record.missionId === input.mission.missionId
    && record.contractDigest === input.mission.contractDigest
    && record.status === expectedContent.status
    && record.verdict === expectedContent.verdict
    && record.summary === expectedContent.summary
    && same(record.reviewedArtifacts, expectedContent.reviewedArtifacts)
    && record.reviewedArtifactSetSha256 === expectedContent.reviewedArtifactSetSha256
    && same(record.findings, expectedContent.findings)
    && same(record.actionItems, expectedContent.actionItems)
    && same(record.provenance, expectedContent.provenance)
    && record.authority === "not-established"
    && record.reportPath === paths.report
    && record.reportSha256 === domainSha256(input.report)
    && report === input.report
    && record.receiptId === paths.receiptId
    && receipt.receiptId === paths.receiptId
    && receipt.missionId === input.mission.missionId
    && receipt.contractDigest === input.mission.contractDigest
    && receipt.producer?.kind === "dove-internal"
    && receipt.producer?.actionId === "archive-review-record"
    && same(receipt.artifacts?.map(({ path: artifactPath, kind, sha256 }) => ({ path: artifactPath, kind, sha256 })), [
      { path: paths.record, kind: "data", sha256: domainSha256(domainJson(record)) },
      { path: paths.report, kind: "report", sha256: domainSha256(input.report) }
    ]);
  if (!valid) throw new Error("This Review Mission already has a different immutable archive and cannot be changed or replayed.");
  return { schemaVersion: REVIEW_RECORD_SCHEMA_VERSION, status: "replayed", operation: "archive", zeroWrite: true, review: record, reviewPath: paths.record, reportPath: paths.report, receipt };
}

export function archiveReviewRecord(root, args = {}) {
  assertSealedDomainArgs(args, ARCHIVE_FIELDS, "review archive");
  const input = normalizeArchiveInput(root, args);
  const reviewId = reviewIdForMission(input.mission.missionId);
  const paths = {
    reviewId,
    record: reviewPath(reviewId),
    report: reportPath(reviewId),
    receiptId: receiptIdForReview(reviewId)
  };
  paths.receipt = receiptPath(paths.receiptId);
  const content = archiveContent(input);
  const archiveDigest = domainSha256(domainJson({ missionId: input.mission.missionId, contractDigest: input.mission.contractDigest, ...content }));
  const replay = exactReplay(root, input, paths, archiveDigest);
  if (replay) return replay;
  if (!currentMutationContext(root)) throw new Error("Review archive requires an active MutationContext.");
  const archivedAt = new Date().toISOString();
  const record = {
    schemaVersion: REVIEW_RECORD_SCHEMA_VERSION,
    reviewId,
    missionId: input.mission.missionId,
    contractDigest: input.mission.contractDigest,
    status: input.status,
    verdict: input.verdict,
    summary: input.summary,
    reviewedArtifacts: input.binding.reviewedArtifacts,
    reviewedArtifactSetSha256: input.binding.reviewedArtifactSetSha256,
    findings: input.findings,
    actionItems: input.actionItems,
    reportPath: paths.report,
    reportSha256: content.reportSha256,
    provenance: input.provenance,
    authority: "not-established",
    receiptId: paths.receiptId,
    archiveDigest,
    archivedAt
  };
  const finalized = finalizeDomainArtifacts(root, {
    actionId: "archive-review-record",
    missionId: input.mission.missionId,
    receiptId: paths.receiptId,
    summary: `Archived non-authoritative Review findings for the exact frozen artifact scope.`,
    writes: [
      { path: paths.record, kind: "data", content: domainJson(record), derivedReferences: [`artifact:${paths.report}`, ...record.reviewedArtifacts.map((item) => `artifact:${item.path}`)] },
      { path: paths.report, kind: "report", content: input.report, derivedReferences: record.reviewedArtifacts.map((item) => `artifact:${item.path}`) }
    ]
  });
  return {
    ...finalized,
    schemaVersion: REVIEW_RECORD_SCHEMA_VERSION,
    status: finalized.status === "planned" ? "archive-planned" : "archived",
    operation: "archive",
    review: record,
    reviewPath: paths.record,
    reportPath: paths.report
  };
}

function assessRecord(root, workspace, requestedMissionId, relativePath) {
  const failures = [];
  let record;
  try {
    record = sealed(readJsonFile(root, relativePath, `Review record ${relativePath}`), RECORD_FIELDS, `Review record ${relativePath}`);
    if (record.schemaVersion !== REVIEW_RECORD_SCHEMA_VERSION) failures.push("review-record-schema-invalid");
    const reviewMission = workspace.missions.get(record.missionId);
    if (!reviewMission || !missionCanReadMission(workspace.missionGraph, requestedMissionId, record.missionId)) failures.push("review-mission-not-readable");
    if (!reviewMission || reviewMission.contractDigest !== record.contractDigest) failures.push("review-contract-stale");
    if (record.authority !== "not-established") failures.push("review-authority-invalid");
    for (const forbidden of ["identity", "reviewerId", "issuer", "signoff", "authoritative"]) if (Object.hasOwn(record, forbidden)) failures.push("review-authority-field-forbidden");
    const snapshots = normalizeReviewSnapshots(record.reviewedArtifacts, "review.reviewedArtifacts");
    if (!snapshots.ok) failures.push(snapshots.reason);
    const setHash = snapshots.ok ? stableSnapshotSetHash(snapshots.snapshots) : null;
    if (!setHash || setHash !== record.reviewedArtifactSetSha256) failures.push("reviewed-artifact-set-hash-mismatch");
    if (snapshots.ok) {
      failures.push(...verifyReviewSnapshotSet(root, snapshots.snapshots, setHash).failures);
      if (reviewMission) {
        try {
          const current = resolveReviewArtifactSnapshots(root, reviewMission.missionId, snapshots.snapshots.map((item) => item.path), "archived review currentness", { missionGraph: workspace.missionGraph });
          if (!same(current.reviewedArtifacts, snapshots.snapshots) || current.reviewedArtifactSetSha256 !== setHash) failures.push("reviewed-artifact-current-ownership-mismatch");
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error));
        }
      }
    }
    const reportFullPath = path.resolve(root, record.reportPath ?? "");
    if (record.reportPath !== reportPath(record.reviewId) || !fs.existsSync(reportFullPath) || domainSha256(fs.readFileSync(reportFullPath)) !== record.reportSha256) failures.push("review-report-stale");
    const receipt = workspace.receiptLedger.receipts.find((item) => item.receiptId === record.receiptId);
    const owner = workspace.receiptLedger.currentOwnership.find((item) => item.path === relativePath);
    const reportOwner = workspace.receiptLedger.currentOwnership.find((item) => item.path === record.reportPath);
    const expectedReceiptArtifacts = [
      { path: relativePath, kind: "data", sha256: domainSha256(domainJson(record)) },
      { path: record.reportPath, kind: "report", sha256: record.reportSha256 }
    ];
    if (!receipt
      || receipt.missionId !== record.missionId
      || receipt.contractDigest !== record.contractDigest
      || receipt.producer?.kind !== "dove-internal"
      || receipt.producer?.actionId !== "archive-review-record"
      || owner?.receiptId !== receipt.receiptId
      || owner?.sha256 !== expectedReceiptArtifacts[0].sha256
      || reportOwner?.receiptId !== receipt.receiptId
      || reportOwner?.sha256 !== record.reportSha256
      || !same(receipt.artifacts?.map(({ path: artifactPath, kind, sha256 }) => ({ path: artifactPath, kind, sha256 })), expectedReceiptArtifacts)) failures.push("review-receipt-stale");
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
    record = null;
  }
  return {
    reviewPath: relativePath,
    current: failures.length === 0,
    authority: "not-established",
    status: record?.status ?? null,
    verdict: record?.verdict ?? null,
    reviewedArtifactPaths: record?.reviewedArtifacts?.map((item) => item.path) ?? [],
    findingCount: record?.findings?.length ?? 0,
    failures: [...new Set(failures)],
    record
  };
}

export function queryReviewRecords(root, args = {}) {
  assertSealedDomainArgs(args, new Set(["missionId"]), "review record query");
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Review record query");
  const directory = path.resolve(root, ARTIFACT_PATHS.reviewsDir);
  const assessments = fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^review-[a-f0-9]{24}\.json$/u.test(entry.name))
    .map((entry) => assessRecord(root, workspace, mission.missionId, path.posix.join(ARTIFACT_PATHS.reviewsDir, entry.name)))
    .filter((item) => item.record && missionCanReadMission(workspace.missionGraph, mission.missionId, item.record.missionId)) : [];
  return {
    status: "ok",
    zeroWrite: true,
    authority: "not-established",
    currentCount: assessments.filter((item) => item.current).length,
    staleCount: assessments.filter((item) => !item.current).length,
    reviews: assessments.map(({ record: _record, ...item }) => item)
  };
}

export function resolveCurrentReviewFinding(root, args = {}) {
  assertSealedDomainArgs(args, new Set(["missionId", "reviewPath", "findingId"]), "review finding resolution");
  const reviewPathValue = canonicalReviewRecordPath(args.reviewPath, "reviewPath");
  const findingId = domainSafeId(args.findingId, "findingId");
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Review finding resolution");
  const assessment = assessRecord(root, workspace, mission.missionId, reviewPathValue);
  if (!assessment.current || !assessment.record || !missionCanReadMission(workspace.missionGraph, mission.missionId, assessment.record.missionId)) return null;
  const finding = assessment.record.findings.find((item) => item.findingId === findingId) ?? null;
  return finding ? { reviewPath: reviewPathValue, review: assessment.record, finding, authority: "not-established" } : null;
}
