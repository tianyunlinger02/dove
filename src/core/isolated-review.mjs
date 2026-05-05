import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ARTIFACT_PATHS } from "./schema.mjs";
import { appendText, ensureDir, ensureWorkspace, listDraftFiles, loadState, nowIso, readJson, readText, resolvePath, writeJson, writeText } from "./workspace.mjs";
import { appendHandoff, loadBoard } from "./orchestration.mjs";
import { refreshDurableSurfaces } from "./navigation.mjs";

const DEFAULT_REVIEWED_PATHS = [
  ARTIFACT_PATHS.orchestrationBoard,
  ARTIFACT_PATHS.evidence,
  ARTIFACT_PATHS.claimBridgeLog,
  ARTIFACT_PATHS.experimentAudits,
  ARTIFACT_PATHS.reviewConcerns,
  ARTIFACT_PATHS.revisionPlan,
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
  const fullPath = resolvePath(root, safePath);
  const exists = fs.existsSync(fullPath);
  return {
    path: safePath,
    exists,
    sha256: exists && fs.statSync(fullPath).isFile() ? hashFile(fullPath) : null
  };
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

function normalizeHandoff(root, raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("isolated review handoff must be a JSON object");
  }
  const runId = normalizeRunId(raw.runId);
  const verdict = REVIEW_VERDICTS.has(raw.verdict) ? raw.verdict : "needs-revision";
  const status = HANDOFF_STATUSES.has(raw.status) ? raw.status : "completed";
  const findings = Array.isArray(raw.findings) ? raw.findings.map(normalizeFinding) : [];
  const actionItems = normalizeStringArray(raw.actionItems ?? findings.map((finding) => finding.summary));
  return {
    version: 1,
    runId,
    status,
    verdict,
    reviewerId: typeof raw.reviewerId === "string" && raw.reviewerId.trim() ? raw.reviewerId.trim() : "isolated-reviewer",
    reviewerSessionId: typeof raw.reviewerSessionId === "string" && raw.reviewerSessionId.trim() ? raw.reviewerSessionId.trim() : null,
    timestamp: typeof raw.timestamp === "string" && raw.timestamp.trim() ? raw.timestamp.trim() : nowIso(),
    summary: typeof raw.summary === "string" && raw.summary.trim() ? raw.summary.trim() : `Isolated reviewer returned ${verdict}.`,
    inputPath: typeof raw.inputPath === "string" ? safeArtifactPath(root, raw.inputPath) : null,
    inputSha256: typeof raw.inputSha256 === "string" ? raw.inputSha256 : null,
    reportPath: typeof raw.reportPath === "string" ? safeArtifactPath(root, raw.reportPath) : null,
    reviewedArtifactPaths: normalizeStringArray(raw.reviewedArtifactPaths).map((item) => safeArtifactPath(root, item)),
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
  ensureWorkspace(root);
  const runId = normalizeRunId(args.runId);
  const reviewedArtifactPaths = normalizeStringArray(args.reviewedArtifactPaths).length > 0
    ? normalizeStringArray(args.reviewedArtifactPaths).map((item) => safeArtifactPath(root, item))
    : defaultReviewedArtifactPaths(root);
  const runDir = path.posix.join(ARTIFACT_PATHS.isolatedReviewsDir, runId);
  const timestamp = nowIso();
  const state = loadState(root);
  const board = loadBoard(root);
  const artifacts = reviewedArtifactPaths.map((relativePath) => artifactEntry(root, relativePath));
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
    reviewedArtifactPaths,
    artifacts,
    outputContract: {
      handoffPath: relativeRunPath(runId, "handoff.json"),
      reportPath: relativeRunPath(runId, "report.md"),
      requiredHandoffFields: ["runId", "status", "verdict", "reviewerId", "summary", "inputPath", "inputSha256", "findings", "actionItems"]
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
    reviewedArtifactPaths,
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
    reviewedArtifactPaths
  };
}

export function importIsolatedReview(root, args = {}) {
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
  const handoffSha256 = hashFile(handoffFullPath);
  const reportFullPath = resolvePath(root, reportPath);
  const reportSha256 = fs.existsSync(reportFullPath) ? hashFile(reportFullPath) : null;
  appendText(root, ARTIFACT_PATHS.reviewLog, renderImportedReviewLogEntry({ handoff, reportPath: fs.existsSync(reportFullPath) ? reportPath : null, reportSha256 }));
  upsertImportedConcerns(root, handoff);
  appendHandoff(root, {
    fromRole: "reviewer",
    toRole: "reviewer",
    phase: "review",
    intentType: "review",
    summary: `Isolated reviewer ${handoff.reviewerId} returned ${handoff.verdict} for ${runId}; planner mediation should triage the imported handoff next.`,
    currentFocus: handoff.summary,
    nextAction: handoff.actionItems[0] ?? "Planner should triage isolated review findings.",
    evidenceLinks: [handoffPath, ...(fs.existsSync(reportFullPath) ? [reportPath] : [])],
    actorRole: "planner",
    policyOverrideReason: "Importing an isolated reviewer handoff from a parallel session boundary."
  });
  const updatedManifest = {
    ...manifest,
    status: "imported",
    updatedAt: nowIso(),
    importedAt: nowIso(),
    handoffPath,
    reportPath: fs.existsSync(reportFullPath) ? reportPath : null,
    outputSha256: handoffSha256,
    reportSha256,
    verdict: handoff.verdict,
    reviewerId: handoff.reviewerId
  };
  writeJson(root, manifestPath, updatedManifest);
  refreshDurableSurfaces(root, {
    type: "isolated-review-import",
    summary: `Imported isolated review ${runId} with verdict ${handoff.verdict}.`,
    artifactPaths: [ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.orchestrationHandoffs, ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.sessionSummary]
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
    reportPath: fs.existsSync(reportFullPath) ? reportPath : null,
    inputPath: manifest.inputPath,
    inputSha256: manifest.inputSha256,
    handoffSha256,
    reportSha256,
    privateTranscriptImported: false
  };
}

export function runIsolatedReview(root, args = {}) {
  const prepared = prepareIsolatedReview(root, args);
  return { ...prepared, importArgs: { runId: prepared.runId, handoffPath: prepared.handoffPath, reportPath: prepared.reportPath } };
}
