import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ARTIFACT_PATHS } from "./schema.mjs";
import { inspectDeclaredPath } from "./artifact-integrity.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { appendText, assertFollowThroughReady, assertGovernanceMutationRegistered, ensureDir, ensureWorkspace, listDraftFiles, loadState, nowIso, readJson, readText, resolvePath, writeJson, writeText } from "./workspace.mjs";
import { appendHandoff, loadBoard } from "./orchestration.mjs";
import { refreshDurableSurfaces } from "./navigation.mjs";
import { resolveDoveResponseLanguage } from "./i18n.mjs";
import { buildPreActionGuidance, summarizePreActionGuidance } from "./pre-action-guidance.mjs";

const DEFAULT_REVIEWED_PATHS = [
  ARTIFACT_PATHS.project,
  ARTIFACT_PATHS.claims,
  ARTIFACT_PATHS.experimentLog,
  ARTIFACT_PATHS.reviewReport,
  ARTIFACT_PATHS.checklist
];

const REVIEW_VERDICTS = new Set(["coherent", "needs-revision", "needs-evidence", "blocked"]);
const HANDOFF_STATUSES = new Set(["completed", "blocked", "failed"]);

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "isolated-review";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function isolatedGuidanceSummary(root, args = {}, target = {}, details = {}) {
  return summarizePreActionGuidance(buildPreActionGuidance({
    surface: "dove.review",
    responseLanguage: resolveDoveResponseLanguage(root, args),
    request: args.instructions ?? args.scope ?? "isolated review",
    roleId: "reviewer",
    packet: target.packet,
    currentContext: {
      domain: target.packet?.domain ?? null,
      stage: target.packet?.stage ?? "audit",
      primaryRole: "reviewer"
    },
    operatorLessons: readJson(root, ARTIFACT_PATHS.metaOperatorLessons, { lessons: [] }),
    nextAction: details.nextAction ?? "project:dove.review",
    routeHint: "project:dove.review",
    workflowKind: "isolated-review",
    domain: target.packet?.domain ?? null,
    stage: target.packet?.stage ?? "audit",
    tags: ["review", "isolated-handoff", "independent-audit"],
    statusSummary: details.statusSummary
  }));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashFile(fullPath) {
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex");
}

function relativeRunPath(runId, leaf) {
  return path.posix.join(ARTIFACT_PATHS.isolatedReviewsDir, runId, leaf);
}

function normalizeRunId(value) {
  const candidate = slugify(value ?? `review-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(candidate)) {
    throw new Error("isolated review runId must be 1-80 lowercase letters, digits, or hyphens");
  }
  return candidate;
}

function safeArtifactPath(root, relativePath) {
  const normalized = path.posix.normalize(String(relativePath).replaceAll(path.sep, "/"));
  if (normalized.startsWith("../") || normalized === ".." || path.isAbsolute(normalized)) {
    throw new Error(`Refusing unsafe isolated review artifact path: ${relativePath}`);
  }
  const fullPath = path.resolve(root, normalized);
  const rootPath = path.resolve(root);
  if (fullPath !== rootPath && !fullPath.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error(`Refusing isolated review artifact outside workspace: ${relativePath}`);
  }
  return normalized;
}

function artifactEntry(root, relativePath) {
  const safePath = safeArtifactPath(root, relativePath);
  const inspection = inspectDeclaredPath(root, safePath, {
    requireNonEmpty: true,
    rejectBookkeeping: true
  });
  return {
    path: safePath,
    exists: inspection.exists,
    usable: inspection.status === "existing",
    status: inspection.status,
    reason: inspection.reason ?? null,
    sizeBytes: inspection.sizeBytes ?? null,
    sha256: inspection.status === "existing" ? hashFile(resolvePath(root, safePath)) : null
  };
}

function assertSubstantiveArtifactEntries(artifacts, label) {
  const usable = artifacts.filter((item) => item.usable);
  if (usable.length === 0) {
    const reasons = artifacts.map((item) => `${item.path}:${item.reason ?? item.status}`).join(", ") || "no artifact paths provided";
    throw new Error(`${label} requires at least one existing non-empty non-bookkeeping reviewed artifact (${reasons}).`);
  }
  return usable;
}

function assertUsableArtifactPath(root, relativePath, label) {
  const entry = artifactEntry(root, relativePath);
  if (!entry.usable) {
    throw new Error(`${label} is not a usable file at ${entry.path}: ${entry.reason ?? entry.status}.`);
  }
  return entry.path;
}

function defaultReviewedArtifactPaths(root) {
  const draftPaths = listDraftFiles(root).map((fileName) => path.posix.join(ARTIFACT_PATHS.draftsDir, fileName));
  return Array.from(new Set([...DEFAULT_REVIEWED_PATHS, ...draftPaths]));
}

function normalizeFinding(finding = {}, index = 0) {
  const summary = typeof finding.summary === "string" && finding.summary.trim() ? finding.summary.trim() : `Isolated review finding ${index + 1}`;
  const severity = ["low", "medium", "high"].includes(finding.severity) ? finding.severity : "medium";
  return {
    id: slugify(finding.id ?? `${severity}-${summary}`),
    severity,
    summary,
    responseOwnerRole: typeof finding.responseOwnerRole === "string" && finding.responseOwnerRole.trim() ? finding.responseOwnerRole.trim() : "planner",
    claimIds: normalizeStringArray(finding.claimIds),
    experimentIds: normalizeStringArray(finding.experimentIds),
    linkedArtifactPaths: normalizeStringArray(finding.linkedArtifactPaths)
  };
}

function requiredStringField(raw, field, label = field) {
  if (typeof raw[field] !== "string" || !raw[field].trim()) {
    throw new Error(`isolated review handoff requires ${label}`);
  }
  return raw[field].trim();
}

function normalizeHandoff(root, raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("isolated review handoff must be a JSON object");
  }
  const runId = normalizeRunId(requiredStringField(raw, "runId"));
  const verdict = requiredStringField(raw, "verdict");
  if (!REVIEW_VERDICTS.has(verdict)) {
    throw new Error(`isolated review handoff has unsupported verdict: ${verdict}`);
  }
  const status = requiredStringField(raw, "status");
  if (!HANDOFF_STATUSES.has(status)) {
    throw new Error(`isolated review handoff has unsupported status: ${status}`);
  }
  if (status !== "completed" && verdict === "coherent") {
    throw new Error(`isolated review handoff status ${status} cannot import a coherent verdict.`);
  }
  const findings = Array.isArray(raw.findings) ? raw.findings.map(normalizeFinding) : [];
  const actionItems = normalizeStringArray(raw.actionItems ?? findings.map((finding) => finding.summary));
  const reviewedArtifactPaths = normalizeStringArray(raw.reviewedArtifactPaths ?? raw.artifactPaths).map((item) => safeArtifactPath(root, item));
  if (reviewedArtifactPaths.length === 0) {
    throw new Error("isolated review handoff requires reviewedArtifactPaths.");
  }
  return {
    version: 1,
    runId,
    status,
    verdict,
    reviewerId: requiredStringField(raw, "reviewerId"),
    reviewerSessionId: typeof raw.reviewerSessionId === "string" && raw.reviewerSessionId.trim() ? raw.reviewerSessionId.trim() : null,
    timestamp: typeof raw.timestamp === "string" && raw.timestamp.trim() ? raw.timestamp.trim() : nowIso(),
    summary: requiredStringField(raw, "summary"),
    inputPath: safeArtifactPath(root, requiredStringField(raw, "inputPath")),
    inputSha256: requiredStringField(raw, "inputSha256"),
    reportPath: safeArtifactPath(root, requiredStringField(raw, "reportPath")),
    reviewedArtifactPaths,
    findings,
    actionItems,
    privateTranscriptImported: false
  };
}

function renderImportedReviewLogEntry({ handoff, reportPath, reportSha256 }) {
  return [
    `## ${handoff.timestamp} — isolated-review`,
    "",
    `- Run: ${handoff.runId}`,
    `- Reviewer: ${handoff.reviewerId}${handoff.reviewerSessionId ? ` (${handoff.reviewerSessionId})` : ""}`,
    `- Status: ${handoff.status}`,
    `- Verdict: ${handoff.verdict}`,
    `- Summary: ${handoff.summary}`,
    `- Input: ${handoff.inputPath} (${handoff.inputSha256 ?? "missing-hash"})`,
    `- Report: ${reportPath ?? "none"}${reportSha256 ? ` (${reportSha256})` : ""}`,
    "- Findings:",
    ...(handoff.findings.length > 0 ? handoff.findings.map((item) => `  - [${item.severity}] ${item.summary} (response owner: ${item.responseOwnerRole})`) : ["  - None recorded"]),
    "- Action items:",
    ...(handoff.actionItems.length > 0 ? handoff.actionItems.map((item) => `  - ${item}`) : ["  - None recorded"]),
    ""
  ].join("\n");
}

function upsertImportedConcerns(root, handoff) {
  const current = readJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 2, items: [], updatedAt: null });
  const existing = new Map((current.items ?? []).map((item) => [item.id, item]));
  for (const finding of handoff.findings) {
    const id = `isolated-${handoff.runId}-${finding.id}`;
    existing.set(id, {
      ...(existing.get(id) ?? {}),
      id,
      summary: finding.summary,
      severity: finding.severity,
      status: handoff.verdict === "coherent" ? "resolved" : "awaiting-author-response",
      raisedByRole: "reviewer",
      responseOwnerRole: finding.responseOwnerRole,
      reviewerRationale: finding.summary,
      authorRebuttalSummary: existing.get(id)?.authorRebuttalSummary ?? "",
      rulingOutcome: existing.get(id)?.rulingOutcome ?? "pending",
      reviewerDisposition: existing.get(id)?.reviewerDisposition ?? "pending",
      recurrenceCount: Number.isInteger(existing.get(id)?.recurrenceCount) ? existing.get(id).recurrenceCount + 1 : 1,
      firstSeenAt: existing.get(id)?.firstSeenAt ?? handoff.timestamp,
      lastSeenAt: handoff.timestamp,
      reviewRoundFirstSeen: existing.get(id)?.reviewRoundFirstSeen ?? 1,
      reviewRoundLastSeen: Number.isInteger(existing.get(id)?.reviewRoundLastSeen) ? existing.get(id).reviewRoundLastSeen + 1 : 1,
      escalationLevel: finding.severity === "high" ? 1 : 0,
      escalationThreshold: finding.severity === "high" ? 1 : finding.severity === "medium" ? 2 : 3,
      escalationReason: finding.severity === "high" ? "High-severity isolated reviewer finding." : "",
      linkedAuditIds: [],
      linkedBridgeIds: [],
      linkedArtifactPaths: Array.from(new Set([relativeRunPath(handoff.runId, "handoff.json"), ...(finding.linkedArtifactPaths ?? [])])),
      claimIds: finding.claimIds,
      experimentIds: finding.experimentIds,
      updatedAt: nowIso()
    });
  }
  const items = Array.from(existing.values()).sort((left, right) => left.id.localeCompare(right.id));
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 2, items, updatedAt: nowIso() });
}

export function prepareIsolatedReview(root, args = {}) {
  assertGovernanceMutationRegistered("prepare-isolated-review", "guarded");
  const target = assertTaskScopedMutationTarget(root, "prepare-isolated-review", args);
  assertFollowThroughReady(root, "Preparing an isolated reviewer input bundle", args);
  ensureWorkspace(root);
  const runId = normalizeRunId(args.runId);
  const explicitArtifactPaths = normalizeStringArray([
    ...normalizeStringArray(args.reviewedArtifactPaths),
    ...normalizeStringArray(args.artifactPaths)
  ]);
  const reviewedArtifactPaths = explicitArtifactPaths.length > 0
    ? explicitArtifactPaths.map((item) => safeArtifactPath(root, item))
    : defaultReviewedArtifactPaths(root);
  const runDir = path.posix.join(ARTIFACT_PATHS.isolatedReviewsDir, runId);
  const timestamp = nowIso();
  const state = loadState(root);
  const board = loadBoard(root);
  const artifacts = reviewedArtifactPaths.map((relativePath) => artifactEntry(root, relativePath));
  const usableArtifacts = assertSubstantiveArtifactEntries(artifacts, "prepare_isolated_review");
  const input = {
    version: 1,
    runId,
    createdAt: timestamp,
    isolationModel: "parallel-session-file-handoff",
    mediatorRole: args.mediatorRole ?? "editor",
    reviewerRole: args.reviewerRole ?? "reviewer",
    scope: args.scope ?? "current paper pipeline",
    instructions: args.instructions ?? "Review the submitted artifact bundle independently. Do not assume access to writer-session private context.",
    paper: {
      title: state.dove.title,
      venue: state.dove.venue,
      objective: state.dove.objective,
      thesis: state.dove.thesis,
      audience: state.dove.audience
    },
    board: {
      currentPhase: board.currentPhase,
      assignedRole: board.assignedRole,
      intentType: board.intentType,
      currentFocus: board.currentFocus,
      nextAction: board.nextAction,
      reviewRequiredBeforeFinalize: board.reviewRequiredBeforeFinalize
    },
    reviewedArtifactPaths: usableArtifacts.map((artifact) => artifact.path),
    artifacts,
    outputContract: {
      handoffPath: relativeRunPath(runId, "handoff.json"),
      reportPath: relativeRunPath(runId, "report.md"),
      requiredHandoffFields: ["runId", "status", "verdict", "reviewerId", "summary", "inputPath", "inputSha256", "reportPath", "reviewedArtifactPaths", "findings", "actionItems"]
    },
    privacyBoundary: {
      writerPrivateTranscriptShared: false,
      reviewerPrivateTranscriptShouldReturn: false,
      acceptedExchangeArtifacts: [relativeRunPath(runId, "input.json"), relativeRunPath(runId, "clarifications.json"), relativeRunPath(runId, "handoff.json"), relativeRunPath(runId, "report.md")]
    }
  };
  const inputText = stableJson(input);
  const inputSha256 = sha256Text(inputText);
  const manifest = {
    version: 1,
    runId,
    status: "prepared",
    createdAt: timestamp,
    updatedAt: timestamp,
    inputPath: relativeRunPath(runId, "input.json"),
    inputSha256: inputSha256,
    handoffPath: relativeRunPath(runId, "handoff.json"),
    reportPath: relativeRunPath(runId, "report.md"),
    reviewedArtifactPaths: usableArtifacts.map((artifact) => artifact.path),
    importedAt: null,
    outputSha256: null,
    reportSha256: null
  };
  writeText(root, manifest.inputPath, inputText);
  writeJson(root, relativeRunPath(runId, "manifest.json"), manifest);
  writeJson(root, relativeRunPath(runId, "clarifications.json"), { version: 1, runId, items: [], updatedAt: timestamp });
  return {
    status: "prepared",
    runId,
    runDir,
    inputPath: manifest.inputPath,
    inputSha256: inputSha256,
    handoffPath: manifest.handoffPath,
    reportPath: manifest.reportPath,
    reviewedArtifactPaths: usableArtifacts.map((artifact) => artifact.path),
    preActionGuidanceSummary: isolatedGuidanceSummary(root, args, target, {
      nextAction: "import_isolated_review",
      statusSummary: {
        status: "prepared",
        runId,
        reviewedArtifactCount: usableArtifacts.length
      }
    })
  };
}

export function importIsolatedReview(root, args = {}) {
  assertGovernanceMutationRegistered("import-isolated-review", "guarded");
  const target = assertTaskScopedMutationTarget(root, "import-isolated-review", args);
  assertFollowThroughReady(root, "Importing an isolated reviewer handoff", args);
  const runId = normalizeRunId(args.runId);
  const manifestPath = relativeRunPath(runId, "manifest.json");
  const handoffPath = args.handoffPath ? safeArtifactPath(root, args.handoffPath) : relativeRunPath(runId, "handoff.json");
  const reportPath = args.reportPath ? safeArtifactPath(root, args.reportPath) : relativeRunPath(runId, "report.md");
  const manifest = readJson(root, manifestPath, null);
  if (!manifest || typeof manifest !== "object") {
    throw new Error(`Missing isolated review manifest for ${runId}`);
  }
  const handoffFullPath = resolvePath(root, handoffPath);
  if (!fs.existsSync(handoffFullPath)) {
    throw new Error(`Missing isolated review handoff: ${handoffPath}`);
  }
  const handoff = normalizeHandoff(root, JSON.parse(fs.readFileSync(handoffFullPath, "utf8")));
  if (handoff.runId !== runId) {
    throw new Error(`Isolated review handoff runId mismatch: expected ${runId}, received ${handoff.runId}`);
  }
  if (handoff.inputPath !== manifest.inputPath) {
    throw new Error(`Isolated review handoff inputPath mismatch: expected ${manifest.inputPath}, received ${handoff.inputPath}`);
  }
  if (handoff.inputSha256 !== manifest.inputSha256) {
    throw new Error(`Isolated review handoff input hash mismatch for ${runId}`);
  }
  if (handoff.reportPath !== reportPath) {
    throw new Error(`Isolated review reportPath mismatch: expected ${reportPath}, received ${handoff.reportPath}`);
  }
  const manifestReviewed = new Set(normalizeStringArray(manifest.reviewedArtifactPaths));
  const handoffReviewed = new Set(handoff.reviewedArtifactPaths);
  const missingReviewed = Array.from(manifestReviewed).filter((artifactPath) => !handoffReviewed.has(artifactPath));
  if (missingReviewed.length > 0) {
    throw new Error(`Isolated review handoff does not cover prepared reviewed artifacts: ${missingReviewed.join(", ")}`);
  }
  for (const artifactPath of handoff.reviewedArtifactPaths) {
    assertUsableArtifactPath(root, artifactPath, "isolated review reviewedArtifactPaths");
  }
  const reportInspection = inspectDeclaredPath(root, reportPath, {
    requireNonEmpty: true,
    rejectBookkeeping: true
  });
  if (reportInspection.status !== "existing") {
    throw new Error(`Isolated review report is not a usable non-empty file at ${reportPath}: ${reportInspection.reason ?? reportInspection.status}`);
  }
  const handoffSha256 = hashFile(handoffFullPath);
  const reportFullPath = resolvePath(root, reportPath);
  const reportSha256 = hashFile(reportFullPath);
  appendText(root, ARTIFACT_PATHS.reviewLog, renderImportedReviewLogEntry({ handoff, reportPath, reportSha256 }));
  upsertImportedConcerns(root, handoff);
  appendHandoff(root, {
    fromRole: "reviewer",
    toRole: "reviewer",
    phase: "review",
    intentType: "review",
    summary: `Isolated reviewer ${handoff.reviewerId} returned ${handoff.verdict} for ${runId}; planner mediation should triage the imported handoff next.`,
    currentFocus: handoff.summary,
    nextAction: handoff.actionItems[0] ?? "Planner should triage isolated review findings.",
    evidenceLinks: [handoffPath, reportPath, ...handoff.reviewedArtifactPaths],
    actorRole: "planner",
    policyOverrideReason: "Importing an isolated reviewer handoff from a parallel session boundary."
  });
  const updatedManifest = {
    ...manifest,
    status: "imported",
    updatedAt: nowIso(),
    importedAt: nowIso(),
    handoffPath,
    reportPath,
    outputSha256: handoffSha256,
    reportSha256,
    verdict: handoff.verdict,
    reviewerId: handoff.reviewerId
  };
  writeJson(root, manifestPath, updatedManifest);
  refreshDurableSurfaces(root, {
    type: "isolated-review-import",
    summary: `Imported isolated review ${runId} with verdict ${handoff.verdict}.`,
    artifactPaths: [ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.orchestrationHandoffs, reportPath, ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.sessionSummary]
  });
  return {
    status: "imported",
    runId,
    verdict: handoff.verdict,
    reviewerId: handoff.reviewerId,
    summary: handoff.summary,
    topConcerns: handoff.findings.slice(0, 5).map((finding) => finding.summary),
    actionItems: handoff.actionItems,
    handoffPath,
    reportPath,
    inputPath: manifest.inputPath,
    inputSha256: manifest.inputSha256,
    handoffSha256,
    reportSha256,
    privateTranscriptImported: false,
    preActionGuidanceSummary: isolatedGuidanceSummary(root, args, target, {
      nextAction: handoff.verdict === "coherent" ? "project:dove.status" : "project:dove.rebuttal",
      statusSummary: {
        status: "imported",
        runId,
        verdict: handoff.verdict,
        findingCount: handoff.findings.length,
        actionItemCount: handoff.actionItems.length
      }
    })
  };
}

export function runIsolatedReview(root, args = {}) {
  assertGovernanceMutationRegistered("run-isolated-review", "guarded");
  assertTaskScopedMutationTarget(root, "run-isolated-review", args);
  assertFollowThroughReady(root, "Running an isolated parallel-session reviewer handoff", args);
  const prepared = prepareIsolatedReview(root, args);
  return { ...prepared, importArgs: { runId: prepared.runId, handoffPath: prepared.handoffPath, reportPath: prepared.reportPath } };
}
