import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ARTIFACT_PATHS, DOVE_AUDIO_CONTEXT_POLICY } from "./schema.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { appendText, assertGovernanceMutationRegistered, ensureWorkspace, nowIso, readJson, resolvePath, writeJson, writeText } from "./workspace.mjs";
import { readTaskPacketCatalog } from "./task-packets.mjs";

const REVIEW_VERDICTS = new Set(["coherent", "needs-revision", "needs-evidence", "blocked"]);
const HANDOFF_STATUSES = new Set(["completed", "blocked", "failed"]);

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "audio-review";
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean))) : [];
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
  return path.posix.join(ARTIFACT_PATHS.audioReviewsDir, runId, leaf);
}

function normalizeRunId(value) {
  const candidate = slugify(value ?? `audio-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(candidate)) {
    throw new Error("audio review runId must be 1-80 lowercase letters, digits, or hyphens");
  }
  return candidate;
}

function safeArtifactPath(root, relativePath) {
  const normalized = path.posix.normalize(String(relativePath).replaceAll(path.sep, "/"));
  if (normalized.startsWith("../") || normalized === ".." || path.isAbsolute(normalized)) {
    throw new Error(`Refusing unsafe audio review artifact path: ${relativePath}`);
  }
  const fullPath = path.resolve(root, normalized);
  const rootPath = path.resolve(root);
  if (fullPath !== rootPath && !fullPath.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error(`Refusing audio review artifact outside workspace: ${relativePath}`);
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

function normalizeHandoff(root, raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("audio review handoff must be a JSON object");
  }
  const runId = normalizeRunId(raw.runId);
  const verdict = REVIEW_VERDICTS.has(raw.verdict) ? raw.verdict : "needs-revision";
  const status = HANDOFF_STATUSES.has(raw.status) ? raw.status : "completed";
  const findings = Array.isArray(raw.findings) ? raw.findings.map((finding, index) => ({
    id: slugify(finding.id ?? `${finding.severity ?? "medium"}-${finding.summary ?? index}`),
    severity: ["low", "medium", "high"].includes(finding.severity) ? finding.severity : "medium",
    summary: normalizeString(finding.summary, `Audio review finding ${index + 1}`),
    linkedArtifactPaths: normalizeStringArray(finding.linkedArtifactPaths).map((item) => safeArtifactPath(root, item)),
    claimIds: normalizeStringArray(finding.claimIds),
    experimentIds: normalizeStringArray(finding.experimentIds)
  })) : [];
  return {
    version: 1,
    runId,
    status,
    verdict,
    reviewerId: normalizeString(raw.reviewerId, "audio"),
    timestamp: normalizeString(raw.timestamp, nowIso()),
    summary: normalizeString(raw.summary, `Audio reviewer returned ${verdict}.`),
    inputPath: raw.inputPath ? safeArtifactPath(root, raw.inputPath) : null,
    inputSha256: normalizeString(raw.inputSha256, null),
    reportPath: raw.reportPath ? safeArtifactPath(root, raw.reportPath) : null,
    findings,
    actionItems: normalizeStringArray(raw.actionItems ?? findings.map((finding) => finding.summary)),
    privateTranscriptImported: false
  };
}

function renderReviewLogEntry({ handoff, reportPath, reportSha256 }) {
  return [
    `## ${handoff.timestamp} — audio-review`,
    "",
    `- Run: ${handoff.runId}`,
    `- Reviewer: ${handoff.reviewerId}`,
    `- Status: ${handoff.status}`,
    `- Verdict: ${handoff.verdict}`,
    `- Summary: ${handoff.summary}`,
    `- Input: ${handoff.inputPath} (${handoff.inputSha256 ?? "missing-hash"})`,
    `- Report: ${reportPath ?? "none"}${reportSha256 ? ` (${reportSha256})` : ""}`,
    "- Findings:",
    ...(handoff.findings.length > 0 ? handoff.findings.map((item) => `  - [${item.severity}] ${item.summary}`) : ["  - None recorded"]),
    "- Action items:",
    ...(handoff.actionItems.length > 0 ? handoff.actionItems.map((item) => `  - ${item}`) : ["  - None recorded"]),
    ""
  ].join("\n");
}

function upsertConcerns(root, handoff) {
  const current = readJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 2, items: [], updatedAt: null });
  const existing = new Map((current.items ?? []).map((item) => [item.id, item]));
  for (const finding of handoff.findings) {
    const id = `audio-${handoff.runId}-${finding.id}`;
    existing.set(id, {
      ...(existing.get(id) ?? {}),
      id,
      summary: finding.summary,
      severity: finding.severity,
      status: handoff.verdict === "coherent" ? "resolved" : "awaiting-author-response",
      raisedByRole: "reviewer",
      responseOwnerRole: "builder",
      reviewerRationale: finding.summary,
      linkedArtifactPaths: [relativeRunPath(handoff.runId, "handoff.json"), ...finding.linkedArtifactPaths],
      claimIds: finding.claimIds,
      experimentIds: finding.experimentIds,
      updatedAt: nowIso()
    });
  }
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 2, items: Array.from(existing.values()).sort((left, right) => left.id.localeCompare(right.id)), updatedAt: nowIso() });
}

export function prepareAudioReview(root, args = {}) {
  assertGovernanceMutationRegistered("prepare-audio-review", "guarded");
  const target = assertTaskScopedMutationTarget(root, "prepare-audio-review", args);
  ensureWorkspace(root);
  const runId = normalizeRunId(args.runId);
  const catalog = readTaskPacketCatalog(root);
  const task = catalog.byId.get(target.packetId) ?? target.packet;
  const finalPlanPaths = normalizeStringArray(args.finalPlanPaths ?? args.planPaths).map((item) => safeArtifactPath(root, item));
  const finalResultPaths = normalizeStringArray(args.finalResultPaths ?? args.resultPaths).map((item) => safeArtifactPath(root, item));
  const explicitArtifactPaths = normalizeStringArray(args.artifactPaths ?? args.reviewedArtifactPaths).map((item) => safeArtifactPath(root, item));
  const reviewedArtifactPaths = Array.from(new Set([...finalPlanPaths, ...finalResultPaths, ...explicitArtifactPaths]));
  const artifacts = reviewedArtifactPaths.map((relativePath) => artifactEntry(root, relativePath));
  const timestamp = nowIso();
  const input = {
    version: 1,
    reviewerKind: "audio",
    runId,
    createdAt: timestamp,
    isolationModel: "audio-final-plan-results-explicit-artifacts",
    contextPolicy: args.contextPolicy ?? DOVE_AUDIO_CONTEXT_POLICY,
    task: {
      id: task.id,
      title: task.title,
      summary: task.summary,
      stage: task.stage,
      domain: task.domain,
      status: task.status,
      level: task.level
    },
    finalPlanPaths,
    finalResultPaths,
    explicitArtifactPaths,
    artifacts,
    instructions: normalizeString(args.instructions, "Review only the supplied final plan, final result, and explicit artifacts. Do not assume access to project context."),
    outputContract: {
      handoffPath: relativeRunPath(runId, "handoff.json"),
      reportPath: relativeRunPath(runId, "report.md"),
      requiredHandoffFields: ["runId", "status", "verdict", "reviewerId", "summary", "inputPath", "inputSha256", "findings", "actionItems"]
    },
    privacyBoundary: {
      writerPrivateTranscriptShared: false,
      projectContextShared: false,
      orchestrationBoardShared: false,
      reviewerPrivateTranscriptShouldReturn: false,
      acceptedExchangeArtifacts: [relativeRunPath(runId, "input.json"), relativeRunPath(runId, "handoff.json"), relativeRunPath(runId, "report.md")]
    }
  };
  const inputText = stableJson(input);
  const inputSha256 = sha256Text(inputText);
  const manifest = {
    version: 1,
    reviewerKind: "audio",
    runId,
    packetId: target.packetId,
    status: "prepared",
    createdAt: timestamp,
    updatedAt: timestamp,
    inputPath: relativeRunPath(runId, "input.json"),
    inputSha256,
    handoffPath: relativeRunPath(runId, "handoff.json"),
    reportPath: relativeRunPath(runId, "report.md"),
    finalPlanPaths,
    finalResultPaths,
    explicitArtifactPaths,
    reviewedArtifactPaths,
    importedAt: null,
    handoffSha256: null,
    reportSha256: null
  };
  writeText(root, manifest.inputPath, inputText);
  writeJson(root, relativeRunPath(runId, "manifest.json"), manifest);
  return {
    status: "prepared",
    runId,
    packetId: target.packetId,
    inputPath: manifest.inputPath,
    inputSha256,
    handoffPath: manifest.handoffPath,
    reportPath: manifest.reportPath,
    reviewedArtifactPaths,
    privacyBoundary: input.privacyBoundary
  };
}

export function importAudioReview(root, args = {}) {
  assertGovernanceMutationRegistered("import-audio-review", "guarded");
  assertTaskScopedMutationTarget(root, "import-audio-review", args);
  ensureWorkspace(root);
  const runId = normalizeRunId(args.runId);
  const manifestPath = relativeRunPath(runId, "manifest.json");
  const manifest = readJson(root, manifestPath, null);
  if (!manifest || typeof manifest !== "object") {
    throw new Error(`Missing audio review manifest for ${runId}`);
  }
  const handoffPath = args.handoffPath ? safeArtifactPath(root, args.handoffPath) : manifest.handoffPath;
  const handoffFullPath = resolvePath(root, handoffPath);
  if (!fs.existsSync(handoffFullPath)) {
    throw new Error(`Missing audio review handoff: ${handoffPath}`);
  }
  const handoff = normalizeHandoff(root, JSON.parse(fs.readFileSync(handoffFullPath, "utf8")));
  if (handoff.runId !== runId) {
    throw new Error(`Audio review handoff runId mismatch: expected ${runId}, received ${handoff.runId}`);
  }
  if (handoff.inputPath !== manifest.inputPath) {
    throw new Error(`Audio review handoff inputPath mismatch: expected ${manifest.inputPath}, received ${handoff.inputPath}`);
  }
  if (handoff.inputSha256 !== manifest.inputSha256) {
    throw new Error(`Audio review input hash mismatch for ${runId}`);
  }
  const reportPath = args.reportPath ? safeArtifactPath(root, args.reportPath) : manifest.reportPath;
  const reportFullPath = resolvePath(root, reportPath);
  const handoffSha256 = hashFile(handoffFullPath);
  const reportSha256 = fs.existsSync(reportFullPath) ? hashFile(reportFullPath) : null;
  appendText(root, ARTIFACT_PATHS.reviewLog, renderReviewLogEntry({ handoff, reportPath: fs.existsSync(reportFullPath) ? reportPath : null, reportSha256 }));
  upsertConcerns(root, handoff);
  const updatedManifest = {
    ...manifest,
    status: "imported",
    updatedAt: nowIso(),
    importedAt: nowIso(),
    handoffPath,
    reportPath: fs.existsSync(reportFullPath) ? reportPath : null,
    handoffSha256,
    reportSha256,
    verdict: handoff.verdict,
    reviewerId: handoff.reviewerId
  };
  writeJson(root, manifestPath, updatedManifest);
  return {
    status: "imported",
    runId,
    verdict: handoff.verdict,
    reviewerId: handoff.reviewerId,
    summary: handoff.summary,
    topConcerns: handoff.findings.slice(0, 5).map((finding) => finding.summary),
    actionItems: handoff.actionItems,
    handoffPath,
    reportPath: updatedManifest.reportPath,
    inputPath: manifest.inputPath,
    inputSha256: manifest.inputSha256,
    handoffSha256,
    reportSha256,
    privateTranscriptImported: false
  };
}

export function runAudioReview(root, args = {}) {
  assertGovernanceMutationRegistered("run-audio-review", "guarded");
  const prepared = prepareAudioReview(root, args);
  const handoffPath = args.handoffPath ?? prepared.handoffPath;
  if (fs.existsSync(resolvePath(root, handoffPath))) {
    return {
      ...prepared,
      imported: importAudioReview(root, { ...args, runId: prepared.runId, handoffPath, reportPath: args.reportPath ?? prepared.reportPath })
    };
  }
  return {
    ...prepared,
    status: "prepared-awaiting-audio",
    importArgs: { runId: prepared.runId, handoffPath: prepared.handoffPath, reportPath: prepared.reportPath }
  };
}
