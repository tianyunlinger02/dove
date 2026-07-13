import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ARTIFACT_PATHS, DOVE_AUDIO_CONTEXT_POLICY } from "./schema.mjs";
import { inspectDeclaredPath } from "./artifact-integrity.mjs";
import { sha256File, snapshotReviewedArtifacts, verifyPreparedReviewSnapshot } from "./review-artifact-snapshot.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { appendText, assertFollowThroughReady, assertGovernanceMutationRegistered, nowIso, readJson, resolvePath, writeJson, writeText } from "./workspace.mjs";
import { loadBoard, upsertSystemOrchestrationBoard } from "./orchestration.mjs";
import { readTaskPacketCatalog } from "./task-packets.mjs";
import { doveText, resolveDoveResponseLanguage } from "./i18n.mjs";
import { assertReviewMaterials, buildReviewScope } from "./review-scope.mjs";
import { buildPreActionGuidance, summarizePreActionGuidance } from "./pre-action-guidance.mjs";
import { buildCommandResultCard } from "./result-cards.mjs";

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

function audioGuidanceSummary(root, args = {}, target = {}, details = {}) {
  return summarizePreActionGuidance(buildPreActionGuidance({
    surface: "dove.review",
    responseLanguage: resolveDoveResponseLanguage(root, args),
    request: args.instructions ?? args.scope ?? "audio review",
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
    workflowKind: "audio-review",
    domain: target.packet?.domain ?? null,
    stage: target.packet?.stage ?? "audit",
    tags: ["review", "audio", "isolated-handoff"],
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

function requiredStringField(raw, field, label = field) {
  if (typeof raw[field] !== "string" || !raw[field].trim()) {
    throw new Error(`audio review handoff requires ${label}`);
  }
  return raw[field].trim();
}

function normalizeHandoff(root, raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("audio review handoff must be a JSON object");
  }
  const runId = normalizeRunId(requiredStringField(raw, "runId"));
  const verdict = requiredStringField(raw, "verdict");
  if (!REVIEW_VERDICTS.has(verdict)) {
    throw new Error(`audio review handoff has unsupported verdict: ${verdict}`);
  }
  const status = requiredStringField(raw, "status");
  if (!HANDOFF_STATUSES.has(status)) {
    throw new Error(`audio review handoff has unsupported status: ${status}`);
  }
  if (status !== "completed" && verdict === "coherent") {
    throw new Error(`audio review handoff status ${status} cannot import a coherent verdict.`);
  }
  const findings = Array.isArray(raw.findings) ? raw.findings.map((finding, index) => ({
    id: slugify(finding.id ?? `${finding.severity ?? "medium"}-${finding.summary ?? index}`),
    severity: ["low", "medium", "high"].includes(finding.severity) ? finding.severity : "medium",
    summary: normalizeString(finding.summary, `Audio review finding ${index + 1}`),
    linkedArtifactPaths: normalizeStringArray(finding.linkedArtifactPaths).map((item) => safeArtifactPath(root, item)),
    claimIds: normalizeStringArray(finding.claimIds),
    experimentIds: normalizeStringArray(finding.experimentIds)
  })) : [];
  const reviewedArtifactPaths = normalizeStringArray(raw.reviewedArtifactPaths ?? raw.artifactPaths).map((item) => safeArtifactPath(root, item));
  return {
    version: 1,
    runId,
    status,
    verdict,
    reviewerId: requiredStringField(raw, "reviewerId"),
    timestamp: normalizeString(raw.timestamp, nowIso()),
    summary: requiredStringField(raw, "summary"),
    inputPath: safeArtifactPath(root, requiredStringField(raw, "inputPath")),
    inputSha256: requiredStringField(raw, "inputSha256"),
    reportPath: safeArtifactPath(root, requiredStringField(raw, "reportPath")),
    reviewedArtifactPaths,
    findings,
    actionItems: normalizeStringArray(raw.actionItems ?? findings.map((finding) => finding.summary)),
    privateTranscriptImported: false
  };
}

function audioReviewPreparedHandoffSuggestion(prepared = {}, responseLanguage = "zh") {
  const requiredInputs = normalizeStringArray([prepared.inputPath, prepared.handoffPath, prepared.reportPath]);
  return {
    presentation: "dove-handoff-suggestion",
    boundaryType: "awaiting-review-output",
    ownerRole: "builder",
    nextRole: "reviewer",
    requiredInputs,
    requiredActions: ["complete-isolated-review-handoff"],
    requires: requiredInputs,
    detail: { implementationBoundaryType: "awaiting-audio-review-output" },
    summary: doveText(responseLanguage, "resultCardHandoffImportReview")
  };
}

function audioReviewImportedHandoffSuggestion(imported = {}, responseLanguage = "zh") {
  if (imported.verdict === "coherent") {
    return null;
  }
  const requiredActions = normalizeStringArray(imported.actionItems).length > 0
    ? normalizeStringArray(imported.actionItems)
    : ["address-audio-review-findings"];
  const implementationBoundaryType = `audio-review-${imported.verdict ?? "needs-revision"}`;
  return {
    presentation: "dove-handoff-suggestion",
    boundaryType: "verification-failed",
    ownerRole: "builder",
    nextRole: "builder",
    requiredActions,
    requires: requiredActions,
    detail: {
      implementationBoundaryType,
      reviewVerdict: imported.verdict ?? null,
      reviewSummary: imported.summary ?? null
    },
    summary: doveText(responseLanguage, "resultCardHandoffAddressReview")
  };
}

function audioReviewPreparedCard(prepared = {}, responseLanguage = "zh") {
  const handoffSuggestion = audioReviewPreparedHandoffSuggestion(prepared, responseLanguage);
  return buildCommandResultCard({
    surface: "dove.review",
    command: "run_audio_review",
    packetId: prepared.packetId,
    runId: prepared.runId,
    status: prepared.status,
    outcome: "awaiting-review-output",
    summary: doveText(responseLanguage, "resultCardReviewInputPrepared"),
    evidenceLinks: [prepared.inputPath, prepared.handoffPath, prepared.reportPath, ...normalizeStringArray(prepared.reviewedArtifactPaths)],
    durableWrites: [doveText(responseLanguage, "resultCardReviewInputPrepared"), prepared.inputPath, relativeRunPath(prepared.runId, "manifest.json")],
    nextActions: [{
      title: doveText(responseLanguage, "resultCardNextImportReview"),
      command: "import_audio_review",
      packetId: prepared.packetId,
      boundaryType: handoffSuggestion.boundaryType,
      ownerRole: handoffSuggestion.ownerRole,
      nextRole: handoffSuggestion.nextRole,
      requiredInputs: handoffSuggestion.requiredInputs,
      requiredActions: handoffSuggestion.requiredActions,
      requires: handoffSuggestion.requires,
      handoffSuggestion,
      confirmationRequired: true
    }],
    preActionGuidanceSummary: prepared.preActionGuidanceSummary ?? null,
    foreground: true,
    background: false,
    daemon: false
  }, responseLanguage);
}

function audioReviewImportedCard(imported = {}, packetId = null, responseLanguage = "zh") {
  const handoffSuggestion = audioReviewImportedHandoffSuggestion(imported, responseLanguage);
  const nextActions = handoffSuggestion ? [{
    title: doveText(responseLanguage, "resultCardNextCreateFixMission"),
    command: "project:dove.mission",
    packetId,
    boundaryType: handoffSuggestion.boundaryType,
    ownerRole: handoffSuggestion.ownerRole,
    nextRole: handoffSuggestion.nextRole,
    requiredActions: handoffSuggestion.requiredActions,
    requires: handoffSuggestion.requires,
    handoffSuggestion,
    confirmationRequired: true
  }] : [{ title: doveText(responseLanguage, "resultCardNextStatus"), command: "project:dove.status", packetId }];
  return buildCommandResultCard({
    surface: "dove.review",
    command: "import_audio_review",
    packetId,
    runId: imported.runId,
    status: imported.status,
    outcome: imported.verdict,
    summary: imported.summary ?? doveText(responseLanguage, "resultCardReviewImported"),
    evidenceLinks: [imported.handoffPath, imported.reportPath, imported.inputPath].filter(Boolean),
    validationEvidence: [imported.verdict].filter(Boolean),
    durableWrites: [doveText(responseLanguage, "resultCardReviewImported"), ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewConcerns, relativeRunPath(imported.runId, "manifest.json")],
    nextActions,
    preActionGuidanceSummary: imported.preActionGuidanceSummary ?? null,
    foreground: true,
    background: false,
    daemon: false
  }, responseLanguage);
}

function audioReviewVerificationFailure(runId, failures, manifest, packetId, responseLanguage) {
  const result = {
    status: "verification-failed",
    boundaryType: "verification-failed",
    boundary: {
      type: "verification-failed",
      requiredActions: ["reprepare-review-artifacts", "rerun-audio-review"],
      failures
    },
    requiredActions: ["reprepare-review-artifacts", "rerun-audio-review"],
    runId,
    packetId,
    inputPath: manifest.inputPath,
    handoffPath: manifest.handoffPath,
    reportPath: manifest.reportPath,
    imported: false
  };
  return {
    ...result,
    resultCard: buildCommandResultCard({
      surface: "dove.review",
      command: "import_audio_review",
      packetId,
      runId,
      status: result.status,
      outcome: "verification-failed",
      summary: "Prepared review artifacts or input changed; reprepare and rerun the review.",
      evidenceLinks: [manifest.inputPath, manifest.handoffPath, manifest.reportPath],
      durableWrites: [],
      nextActions: [{
        title: "Reprepare and rerun audio review",
        command: "run_audio_review",
        packetId,
        boundaryType: "verification-failed",
        requiredActions: result.requiredActions,
        confirmationRequired: true
      }],
      foreground: true,
      background: false,
      daemon: false
    }, responseLanguage)
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

function transitionToAudioReviewer(root, args, target, runId, reviewedArtifactPaths) {
  const board = loadBoard(root);
  if (board.currentPhase === "review" && board.assignedRole === "reviewer") {
    return board;
  }
  return upsertSystemOrchestrationBoard(root, {
    ...args,
    phase: "review",
    assignedRole: "reviewer",
    intentType: "review",
    currentFocus: args.scope ?? target.packet?.title ?? `Audio review ${runId}`,
    nextAction: `Complete audio review ${runId} and return only the declared handoff and report artifacts.`,
    handoffSummary: `Handing ${target.packet?.title ?? "the current work"} to the audio reviewer for run ${runId}.`,
    evidenceLinks: Array.from(new Set([...(board.evidenceLinks ?? []), ...reviewedArtifactPaths]))
  });
}

function audioReviewReturnTransition(handoff) {
  if (handoff.verdict === "coherent") {
    return {
      phase: "plan",
      assignedRole: "planner",
      intentType: "plan",
      nextAction: "Inspect Dove status and choose the next governed finalization step."
    };
  }
  return {
    phase: "rebuttal",
    assignedRole: "builder",
    intentType: "respond",
    nextAction: handoff.actionItems[0] ?? "Address the audio review findings through governed revision work."
  };
}

function returnImportedAudioReview(root, args, handoff, handoffPath, reportPath, transition) {
  const board = loadBoard(root);
  return upsertSystemOrchestrationBoard(root, {
    ...args,
    ...transition,
    currentFocus: handoff.summary,
    handoffSummary: `Audio reviewer ${handoff.reviewerId} returned ${handoff.verdict} for ${handoff.runId}; workflow routing now returns to ${transition.assignedRole} for the recorded next action.`,
    evidenceLinks: Array.from(new Set([...(board.evidenceLinks ?? []), handoffPath, reportPath, ...handoff.reviewedArtifactPaths])),
    reviewRequiredBeforeFinalize: handoff.verdict !== "coherent"
  });
}

export function prepareAudioReview(root, args = {}) {
  assertGovernanceMutationRegistered("prepare-audio-review", "guarded");
  const target = assertTaskScopedMutationTarget(root, "prepare-audio-review", args);
  assertFollowThroughReady(root, "Preparing an isolated audio review input bundle", args);
  const runId = normalizeRunId(args.runId);
  const catalog = readTaskPacketCatalog(root);
  const task = catalog.byId.get(target.packetId) ?? target.packet;
  const finalPlanPaths = normalizeStringArray(args.finalPlanPaths ?? args.planPaths).map((item) => safeArtifactPath(root, item));
  const finalResultPaths = normalizeStringArray(args.finalResultPaths ?? args.resultPaths).map((item) => safeArtifactPath(root, item));
  const explicitArtifactPaths = normalizeStringArray(args.artifactPaths ?? args.reviewedArtifactPaths).map((item) => safeArtifactPath(root, item));
  const reviewScope = assertReviewMaterials(buildReviewScope(root, target, {
    reviewedArtifactPaths: Array.from(new Set([...finalPlanPaths, ...finalResultPaths, ...explicitArtifactPaths]))
  }), "prepare_audio_review");
  const reviewedArtifactPaths = reviewScope.substantiveArtifactPaths;
  const artifacts = reviewedArtifactPaths.map((relativePath) => artifactEntry(root, relativePath));
  const usableArtifacts = assertSubstantiveArtifactEntries(artifacts, "prepare_audio_review");
  const snapshot = snapshotReviewedArtifacts(root, usableArtifacts.map((artifact) => artifact.path), "prepare_audio_review");
  transitionToAudioReviewer(root, args, target, runId, snapshot.reviewedArtifacts.map((artifact) => artifact.path));
  const timestamp = nowIso();
  const input = {
    version: 1,
    reviewerKind: "audio",
    runId,
    packetId: reviewScope.packetId,
    includedPacketIds: reviewScope.includedPacketIds,
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
    reviewedArtifactPaths: snapshot.reviewedArtifacts.map((artifact) => artifact.path),
    reviewedArtifacts: snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: snapshot.reviewedArtifactSetSha256,
    artifacts,
    instructions: normalizeString(args.instructions, "Review only the supplied final plan, final result, and explicit artifacts. Do not assume access to project context."),
    outputContract: {
      handoffPath: relativeRunPath(runId, "handoff.json"),
      reportPath: relativeRunPath(runId, "report.md"),
      requiredHandoffFields: ["runId", "status", "verdict", "reviewerId", "summary", "inputPath", "inputSha256", "reportPath", "reviewedArtifactPaths", "findings", "actionItems"]
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
    reviewedArtifactPaths: snapshot.reviewedArtifacts.map((artifact) => artifact.path),
    reviewedArtifacts: snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: snapshot.reviewedArtifactSetSha256,
    importedAt: null,
    handoffSha256: null,
    reportSha256: null
  };
  writeText(root, manifest.inputPath, inputText);
  writeJson(root, relativeRunPath(runId, "manifest.json"), manifest);
  const prepared = {
    status: "prepared",
    runId,
    packetId: target.packetId,
    inputPath: manifest.inputPath,
    inputSha256,
    handoffPath: manifest.handoffPath,
    reportPath: manifest.reportPath,
    reviewedArtifactPaths: snapshot.reviewedArtifacts.map((artifact) => artifact.path),
    reviewedArtifacts: snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: snapshot.reviewedArtifactSetSha256,
    privacyBoundary: input.privacyBoundary,
    preActionGuidanceSummary: audioGuidanceSummary(root, args, target, {
      nextAction: "import_audio_review",
      statusSummary: {
        status: "prepared",
        runId,
        reviewedArtifactCount: usableArtifacts.length,
        contextPolicy: input.contextPolicy
      }
    })
  };
  return {
    ...prepared,
    resultCard: audioReviewPreparedCard(prepared, resolveDoveResponseLanguage(root, args))
  };
}

export function importAudioReview(root, args = {}) {
  assertGovernanceMutationRegistered("import-audio-review", "guarded");
  const target = assertTaskScopedMutationTarget(root, "import-audio-review", args);
  assertFollowThroughReady(root, "Importing an isolated audio review handoff", args);
  const runId = normalizeRunId(args.runId);
  const manifestPath = relativeRunPath(runId, "manifest.json");
  const manifest = readJson(root, manifestPath, null);
  if (!manifest || typeof manifest !== "object") {
    throw new Error(`Missing audio review manifest for ${runId}`);
  }
  if (manifest.status !== "prepared") {
    throw new Error(`Audio review ${runId} is not importable from manifest status ${manifest.status ?? "unknown"}; prepare a fresh review run.`);
  }
  if (manifest.packetId !== target.packetId) {
    throw new Error(`Audio review ${runId} belongs to packet ${manifest.packetId ?? "unknown"}, not ${target.packetId}.`);
  }
  const handoffPath = args.handoffPath ? safeArtifactPath(root, args.handoffPath) : manifest.handoffPath;
  const reportPath = args.reportPath ? safeArtifactPath(root, args.reportPath) : manifest.reportPath;
  if (handoffPath !== manifest.handoffPath || reportPath !== manifest.reportPath) {
    throw new Error(`Audio review ${runId} must import the exact handoff and report paths declared by its prepared manifest.`);
  }
  const handoffFullPath = resolvePath(root, handoffPath);
  if (!fs.existsSync(handoffFullPath)) {
    throw new Error(`Missing audio review handoff: ${handoffPath}`);
  }
  const handoff = normalizeHandoff(root, JSON.parse(fs.readFileSync(handoffFullPath, "utf8")));
  if (handoff.runId !== runId) {
    throw new Error(`Audio review handoff runId mismatch: expected ${runId}, received ${handoff.runId}`);
  }
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const inputFullPath = resolvePath(root, manifest.inputPath);
  let input;
  let actualInputSha256;
  try {
    actualInputSha256 = sha256File(inputFullPath);
    input = JSON.parse(fs.readFileSync(inputFullPath, "utf8"));
  } catch (error) {
    return audioReviewVerificationFailure(runId, [`input-unreadable:${error instanceof Error ? error.message : String(error)}`], manifest, manifest.packetId, responseLanguage);
  }
  const verification = verifyPreparedReviewSnapshot(root, {
    manifest,
    input,
    inputPath: manifest.inputPath,
    actualInputSha256,
    handoffInputPath: handoff.inputPath,
    handoffInputSha256: handoff.inputSha256,
    handoffReviewedArtifactPaths: handoff.reviewedArtifactPaths
  });
  if (!verification.ok) {
    return audioReviewVerificationFailure(runId, verification.failures, manifest, manifest.packetId, responseLanguage);
  }
  if (handoff.reportPath !== reportPath) {
    return audioReviewVerificationFailure(runId, ["report-path-mismatch"], manifest, manifest.packetId, responseLanguage);
  }
  const reportInspection = inspectDeclaredPath(root, reportPath, {
    requireNonEmpty: true,
    rejectBookkeeping: true
  });
  if (reportInspection.status !== "existing") {
    throw new Error(`Audio review report is not a usable non-empty file at ${reportPath}: ${reportInspection.reason ?? reportInspection.status}`);
  }
  const reportFullPath = resolvePath(root, reportPath);
  const handoffSha256 = hashFile(handoffFullPath);
  const reportSha256 = hashFile(reportFullPath);
  const returnTransition = audioReviewReturnTransition(handoff);
  appendText(root, ARTIFACT_PATHS.reviewLog, renderReviewLogEntry({ handoff, reportPath, reportSha256 }));
  upsertConcerns(root, handoff);
  const updatedManifest = {
    ...manifest,
    status: "imported",
    updatedAt: nowIso(),
    importedAt: nowIso(),
    handoffPath,
    reportPath,
    handoffSha256,
    reportSha256,
    verdict: handoff.verdict,
    reviewerId: handoff.reviewerId
  };
  writeJson(root, manifestPath, updatedManifest);
  returnImportedAudioReview(root, args, handoff, handoffPath, reportPath, returnTransition);
  const imported = {
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
    privateTranscriptImported: false,
    preActionGuidanceSummary: audioGuidanceSummary(root, args, target, {
      nextAction: handoff.verdict === "coherent" ? "project:dove.status" : "project:dove.mission",
      statusSummary: {
        status: "imported",
        runId,
        verdict: handoff.verdict,
        findingCount: handoff.findings.length,
        actionItemCount: handoff.actionItems.length
      }
    })
  };
  return {
    ...imported,
    resultCard: audioReviewImportedCard(imported, manifest.packetId, resolveDoveResponseLanguage(root, args))
  };
}

export function runAudioReview(root, args = {}) {
  assertGovernanceMutationRegistered("run-audio-review", "guarded");
  const target = assertTaskScopedMutationTarget(root, "run-audio-review", args);
  assertFollowThroughReady(root, "Running an isolated audio review", args);
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const runId = normalizeRunId(args.runId);
  const handoffPath = args.handoffPath
    ? safeArtifactPath(root, args.handoffPath)
    : relativeRunPath(runId, "handoff.json");
  if (fs.existsSync(resolvePath(root, handoffPath))) {
    const imported = importAudioReview(root, {
      ...args,
      runId,
      handoffPath,
      reportPath: args.reportPath
    });
    return {
      ...imported,
      packetId: target.packetId,
      imported,
      resultCard: imported.resultCard
    };
  }
  const prepared = prepareAudioReview(root, { ...args, runId });
  const awaiting = {
    ...prepared,
    status: "prepared-awaiting-audio",
    importArgs: { runId: prepared.runId, handoffPath: prepared.handoffPath, reportPath: prepared.reportPath }
  };
  return {
    ...awaiting,
    resultCard: audioReviewPreparedCard(awaiting, responseLanguage)
  };
}
