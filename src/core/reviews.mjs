import { ARTIFACT_PATHS } from "./schema.mjs";
import { evaluateFigurePipeline } from "./artifacts.mjs";
import { evaluateEvidence } from "./evidence.mjs";
import { refreshDurableSurfaces } from "./navigation.mjs";
import { assertRoleBoundMutation, loadBoard, normalizeRebuttalIssues, upsertOrchestrationBoard } from "./orchestration.mjs";
import { appendText, assertGovernanceMutationRegistered, assertFollowThroughReady, listDraftFiles, loadState, nowIso, readJson, saveState, writeJson, writeText } from "./workspace.mjs";

const UNRESOLVED_CONCERN_STATUSES = new Set(["open", "awaiting-author-response", "author-response-submitted", "escalated", "contested"]);
const AUTHOR_RESPONSE_PENDING_STATUSES = new Set(["open", "awaiting-author-response"]);
const REVIEWER_RULING_PENDING_STATUSES = new Set(["author-response-submitted", "contested"]);

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function renderReviewEntry(entry) {
  return [
    `## ${entry.timestamp} — ${entry.stage}`,
    "",
    `- Scope: ${entry.scope}`,
    `- Verdict: ${entry.verdict}`,
    `- Summary: ${entry.summary}`,
    `- Review required before finalize: ${entry.reviewRequiredBeforeFinalize}`,
    "- Findings:",
    ...(entry.findings.length > 0 ? entry.findings.map((item) => `  - [${item.severity}] ${item.summary}${item.responseOwnerRole ? ` (response owner: ${item.responseOwnerRole})` : ""}`) : ["  - None recorded"]),
    "- Action items:",
    ...(entry.actionItems.length > 0 ? entry.actionItems.map((item) => `  - ${item}`) : ["  - None recorded"]),
    ""
  ].join("\n");
}

function renderRevisionPlan(review) {
  return [
    "# Current revision plan",
    "",
    `- Verdict: ${review.verdict}`,
    `- Updated: ${review.timestamp}`,
    "",
    "## Action items",
    "",
    ...(review.actionItems.length > 0 ? review.actionItems.map((item) => `- [ ] ${item}`) : ["- [ ] No action items recorded."])
  ].join("\n");
}

function concernFingerprint(concern = {}, index = 0) {
  const summary = concern.summary ?? `concern-${index + 1}`;
  const claimIds = Array.isArray(concern.claimIds) ? concern.claimIds.join("-") : "";
  const experimentIds = Array.isArray(concern.experimentIds) ? concern.experimentIds.join("-") : "";
  return slugify(`${summary}-${claimIds}-${experimentIds}`);
}

function normalizeConcernStatus(status, fallback = "open") {
  const allowed = new Set(["open", "awaiting-author-response", "author-response-submitted", "escalated", "contested", "resolved", "retired"]);
  return allowed.has(status) ? status : fallback;
}

function defaultResponseOwnerRole(concern = {}) {
  if ((concern.experimentIds ?? []).length > 0) {
    return "experiment-planner";
  }
  if ((concern.claimIds ?? []).length > 0) {
    return "researcher";
  }
  return "planner";
}

function escalationThresholdForSeverity(severity = "medium") {
  return severity === "high" ? 1 : severity === "medium" ? 2 : 3;
}

function deriveConcernStatus(existing, concern, context = {}) {
  const explicitStatus = concern.status ? normalizeConcernStatus(concern.status) : null;
  if (explicitStatus && ["resolved", "retired"].includes(explicitStatus)) {
    return explicitStatus;
  }
  if (explicitStatus && explicitStatus !== "open") {
    return explicitStatus;
  }
  if (concern.authorRebuttalSummary) {
    return "author-response-submitted";
  }
  const previousRecurrence = existing?.recurrenceCount ?? 0;
  const recurrenceCount = previousRecurrence + 1;
  const threshold = concern.escalationThreshold ?? existing?.escalationThreshold ?? escalationThresholdForSeverity(concern.severity);
  const shouldEscalate = recurrenceCount >= threshold
    || concern.severity === "high"
    || (context.integrityCriticalConcernIds ?? new Set()).has(concern.id);
  if (shouldEscalate) {
    return existing?.authorRebuttalSummary ? "contested" : "escalated";
  }
  return "awaiting-author-response";
}

function summarizeConcernState(items = []) {
  const concernStatusCounts = {};
  const unresolvedConcernIds = [];
  const escalatedConcernIds = [];
  const pendingAuthorResponseIds = [];
  const pendingReviewerRulingIds = [];
  for (const item of items) {
    concernStatusCounts[item.status] = (concernStatusCounts[item.status] ?? 0) + 1;
    if (UNRESOLVED_CONCERN_STATUSES.has(item.status)) {
      unresolvedConcernIds.push(item.id);
    }
    if (item.status === "escalated") {
      escalatedConcernIds.push(item.id);
    }
    if (AUTHOR_RESPONSE_PENDING_STATUSES.has(item.status)) {
      pendingAuthorResponseIds.push(item.id);
    }
    if (REVIEWER_RULING_PENDING_STATUSES.has(item.status)) {
      pendingReviewerRulingIds.push(item.id);
    }
  }
  return {
    unresolvedConcernIds,
    escalatedConcernIds,
    pendingAuthorResponseIds,
    pendingReviewerRulingIds,
    concernStatusCounts
  };
}

function normalizeConcern(concern = {}, index = 0) {
  return {
    id: slugify(concern.id ?? concernFingerprint(concern, index)),
    summary: concern.summary ?? `Concern ${index + 1}`,
    severity: concern.severity ?? "medium",
    status: normalizeConcernStatus(concern.status ?? "open"),
    raisedByRole: concern.raisedByRole ?? "reviewer",
    responseOwnerRole: concern.responseOwnerRole ?? defaultResponseOwnerRole(concern),
    reviewerRationale: concern.reviewerRationale ?? concern.summary ?? "",
    authorRebuttalSummary: concern.authorRebuttalSummary ?? "",
    rulingOutcome: concern.rulingOutcome ?? "pending",
    reviewerDisposition: concern.reviewerDisposition ?? "pending",
    recurrenceCount: Number.isInteger(concern.recurrenceCount) ? concern.recurrenceCount : 1,
    firstSeenAt: concern.firstSeenAt ?? nowIso(),
    lastSeenAt: concern.lastSeenAt ?? nowIso(),
    reviewRoundFirstSeen: concern.reviewRoundFirstSeen ?? 1,
    reviewRoundLastSeen: concern.reviewRoundLastSeen ?? 1,
    escalationLevel: Number.isInteger(concern.escalationLevel) ? concern.escalationLevel : 0,
    escalationThreshold: concern.escalationThreshold ?? escalationThresholdForSeverity(concern.severity),
    escalationReason: concern.escalationReason ?? "",
    linkedAuditIds: Array.isArray(concern.linkedAuditIds) ? concern.linkedAuditIds : [],
    linkedBridgeIds: Array.isArray(concern.linkedBridgeIds) ? concern.linkedBridgeIds : [],
    linkedArtifactPaths: Array.isArray(concern.linkedArtifactPaths) ? concern.linkedArtifactPaths : [],
    claimIds: Array.isArray(concern.claimIds) ? concern.claimIds : [],
    experimentIds: Array.isArray(concern.experimentIds) ? concern.experimentIds : [],
    updatedAt: nowIso()
  };
}

function upsertConcernLedger(root, concerns = [], context = {}) {
  const current = readJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 2, items: [], updatedAt: null });
  const merged = new Map((current.items ?? []).map((item, index) => {
    const normalized = normalizeConcern(item, index);
    return [normalized.id, normalized];
  }));
  const touched = [];
  const integrityCriticalConcernIds = new Set(Array.isArray(context.integrityCriticalConcernIds) ? context.integrityCriticalConcernIds : []);
  const reviewRound = Number.isInteger(context.reviewRound) ? context.reviewRound : 1;

  for (const concern of concerns.map(normalizeConcern)) {
    const existing = merged.get(concern.id);
    const status = deriveConcernStatus(existing, concern, { ...context, integrityCriticalConcernIds });
    const recurrenceCount = concern.status === "resolved"
      ? existing?.recurrenceCount ?? 1
      : status === "resolved"
        ? existing?.recurrenceCount ?? 1
        : (existing?.recurrenceCount ?? 0) + 1;
    const escalationThreshold = concern.escalationThreshold ?? existing?.escalationThreshold ?? escalationThresholdForSeverity(concern.severity);
    const escalationLevel = ["escalated", "contested"].includes(status)
      ? Math.max(existing?.escalationLevel ?? 0, Math.max(1, recurrenceCount - escalationThreshold + 1))
      : 0;
    const escalationReason = ["escalated", "contested"].includes(status)
      ? (integrityCriticalConcernIds.has(concern.id)
          ? "Integrity-critical concern remains unresolved."
          : recurrenceCount >= escalationThreshold
            ? `Concern remained unresolved across ${recurrenceCount} review rounds.`
            : `${concern.severity} severity concern requires reviewer escalation.`)
      : "";
    const next = {
      ...(existing ?? {}),
      ...concern,
      status,
      raisedByRole: existing?.raisedByRole ?? concern.raisedByRole ?? "reviewer",
      responseOwnerRole: concern.responseOwnerRole ?? existing?.responseOwnerRole ?? defaultResponseOwnerRole(concern),
      reviewerDisposition: status === "resolved" ? "accepted" : concern.reviewerDisposition ?? existing?.reviewerDisposition ?? "pending",
      firstSeenAt: existing?.firstSeenAt ?? concern.firstSeenAt ?? nowIso(),
      lastSeenAt: nowIso(),
      reviewRoundFirstSeen: existing?.reviewRoundFirstSeen ?? reviewRound,
      reviewRoundLastSeen: reviewRound,
      recurrenceCount,
      escalationThreshold,
      escalationLevel,
      escalationReason,
      linkedAuditIds: Array.from(new Set([...(existing?.linkedAuditIds ?? []), ...(concern.linkedAuditIds ?? []), ...(context.auditIds ?? [])])),
      linkedBridgeIds: Array.from(new Set([...(existing?.linkedBridgeIds ?? []), ...(concern.linkedBridgeIds ?? []), ...(context.bridgeIds ?? [])])),
      linkedArtifactPaths: Array.from(new Set([...(existing?.linkedArtifactPaths ?? []), ...(concern.linkedArtifactPaths ?? [])])),
      updatedAt: nowIso()
    };
    merged.set(next.id, next);
    touched.push(next);
  }

  const items = Array.from(merged.values()).sort((left, right) => left.id.localeCompare(right.id));
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 2, items, updatedAt: nowIso() });

  const summary = summarizeConcernState(items);
  const adversarialState = readJson(root, ARTIFACT_PATHS.adversarialReviewState, {
    version: 2,
    round: 0,
    unresolvedConcernIds: [],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    concernStatusCounts: {},
    escalationThresholds: { high: 1, medium: 2, low: 3 },
    lastAuditIds: [],
    lastBridgeIds: [],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.adversarialReviewState, {
    ...adversarialState,
    version: 2,
    round: (adversarialState.round ?? 0) + 1,
    unresolvedConcernIds: summary.unresolvedConcernIds,
    escalatedConcernIds: summary.escalatedConcernIds,
    pendingAuthorResponseIds: summary.pendingAuthorResponseIds,
    pendingReviewerRulingIds: summary.pendingReviewerRulingIds,
    concernStatusCounts: summary.concernStatusCounts,
    escalationThresholds: { high: 1, medium: 2, low: 3 },
    lastAuditIds: Array.isArray(context.auditIds) ? context.auditIds : adversarialState.lastAuditIds,
    lastBridgeIds: Array.isArray(context.bridgeIds) ? context.bridgeIds : adversarialState.lastBridgeIds,
    updatedAt: nowIso()
  });

  if (touched.length > 0) {
    appendText(root, ARTIFACT_PATHS.reviewDebateLog, `\n## ${nowIso()} — review round\n\n${touched.map((concern) => `- ${concern.id} [${concern.status}] reviewer=${concern.raisedByRole} response-owner=${concern.responseOwnerRole} recurrence=${concern.recurrenceCount}: ${concern.summary}`).join("\n")}\n`);
  }
  return { items, ...summary };
}

export function appendReviewLog(root, args = {}) {
  assertGovernanceMutationRegistered("append-review-log", "guarded");
  assertFollowThroughReady(root, "Recording a review log", args);
  assertRoleBoundMutation(root, args, {
    actionLabel: "Appending a review log entry",
    expectedRole: "reviewer"
  });
  const timestamp = args.timestamp ?? nowIso();
  const entry = {
    timestamp,
    stage: args.stage ?? "manual-review",
    scope: args.scope ?? "current paper materials",
    verdict: args.verdict ?? "needs-work",
    summary: args.summary ?? "No summary provided.",
    reviewRequiredBeforeFinalize: Boolean(args.reviewRequiredBeforeFinalize ?? true),
    findings: Array.isArray(args.findings)
      ? args.findings.map((item) => ({
          severity: item.severity ?? "medium",
          summary: item.summary ?? String(item),
          claimIds: item.claimIds ?? [],
          experimentIds: item.experimentIds ?? [],
          responseOwnerRole: item.responseOwnerRole,
          reviewerAction: item.reviewerAction,
          linkedAuditIds: item.linkedAuditIds ?? [],
          linkedBridgeIds: item.linkedBridgeIds ?? [],
          linkedArtifactPaths: item.linkedArtifactPaths ?? [],
          methodologicalCategory: item.methodologicalCategory ?? null
        }))
      : [],
    actionItems: Array.isArray(args.actionItems) ? args.actionItems : []
  };

  appendText(root, ARTIFACT_PATHS.reviewLog, `\n${renderReviewEntry(entry)}`);
  const reviewState = readJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    history: [],
    openItems: [],
    lastVerdict: "not-reviewed",
    lastReviewedAt: null,
    unresolvedConcernIds: [],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 0,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: [], separationMaintained: true }
  });
  const reviewRound = (reviewState.reviewRound ?? 0) + 1;
  const integrityCriticalConcernIds = entry.findings
    .filter((finding) => finding.severity === "high" || finding.methodologicalCategory === "integrity")
    .map((finding, index) => concernFingerprint({
      id: `review-${entry.stage}-${index + 1}`,
      summary: finding.summary,
      claimIds: finding.claimIds,
      experimentIds: finding.experimentIds
    }));
  const currentConcerns = readJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 2, items: [], updatedAt: null });
  const concernInputs = entry.verdict === "coherent"
    ? (currentConcerns.items ?? [])
      .filter((item) => UNRESOLVED_CONCERN_STATUSES.has(item.status))
      .map((item) => ({
        ...item,
        status: "resolved",
        rulingOutcome: "accepted",
        reviewerDisposition: "accepted",
        linkedArtifactPaths: Array.from(new Set([...(item.linkedArtifactPaths ?? []), ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.revisionPlan]))
      }))
    : entry.findings.map((finding, index) => ({
        id: concernFingerprint({
          id: `review-${entry.stage}-${index + 1}`,
          summary: finding.summary,
          claimIds: finding.claimIds,
          experimentIds: finding.experimentIds
        }),
        summary: finding.summary,
        severity: finding.severity,
        responseOwnerRole: finding.responseOwnerRole,
        reviewerRationale: finding.summary,
        linkedAuditIds: finding.linkedAuditIds,
        linkedBridgeIds: finding.linkedBridgeIds,
        linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.revisionPlan, ...finding.linkedArtifactPaths],
        claimIds: finding.claimIds,
        experimentIds: finding.experimentIds
      }));
  const concernLedger = upsertConcernLedger(root, concernInputs, { reviewRound, integrityCriticalConcernIds });
  const nextReviewState = {
    ...reviewState,
    version: 3,
    lastVerdict: entry.verdict,
    lastReviewedAt: timestamp,
    reviewRound,
    history: [...reviewState.history, entry],
    openItems: entry.actionItems,
    unresolvedConcernIds: concernLedger.unresolvedConcernIds,
    escalatedConcernIds: concernLedger.escalatedConcernIds,
    pendingAuthorResponseIds: concernLedger.pendingAuthorResponseIds,
    pendingReviewerRulingIds: concernLedger.pendingReviewerRulingIds,
    reviewerIndependence: {
      reviewerRole: "reviewer",
      responseOwnerRoles: Array.from(new Set(concernLedger.items.filter((item) => UNRESOLVED_CONCERN_STATUSES.has(item.status)).map((item) => item.responseOwnerRole))),
      separationMaintained: concernLedger.items.every((item) => item.raisedByRole === "reviewer" && item.responseOwnerRole !== "reviewer")
    }
  };
  writeJson(root, ARTIFACT_PATHS.reviewState, nextReviewState);
  writeText(root, ARTIFACT_PATHS.revisionPlan, renderRevisionPlan(entry));
  const state = loadState(root);
  saveState(root, {
    ...state,
    pipeline: {
      ...state.pipeline,
      currentStage: "review",
      lastCompletedStage: "review",
      resumeCommand: "project:paper.revise",
      updatedAt: timestamp
    },
    reviews: {
      lastVerdict: entry.verdict,
      lastReviewedAt: timestamp,
      openItems: entry.actionItems,
      unresolvedConcernIds: concernLedger.unresolvedConcernIds
    }
  });
  upsertOrchestrationBoard(root, {
    phase: "review",
    assignedRole: "reviewer",
    intentType: entry.verdict === "coherent" ? "review" : "repair",
    currentFocus: entry.summary,
    nextAction: entry.verdict === "coherent"
      ? "Refresh downstream artifacts before finalization claims."
      : "Turn the highest-severity review findings into concrete revision work.",
    reviewRequiredBeforeFinalize: entry.reviewRequiredBeforeFinalize,
    blockers: entry.actionItems.map((item, index) => ({
      id: `review-blocker-${index + 1}`,
      summary: item,
      status: entry.verdict === "coherent" ? "resolved" : "open",
      assignedRole: "reviewer",
      currentFocus: item,
      nextAction: "Resolve the review blocker and re-run review."
    })),
    continuationState: {
      status: entry.verdict === "coherent" ? "ready-to-resume" : "blocked",
      lastCheckpoint: `Review verdict recorded: ${entry.verdict}.`,
      checkpointHistory: [{ summary: `Review verdict recorded: ${entry.verdict}.`, recordedAt: timestamp }]
    }
  });
  refreshDurableSurfaces(root, {
    type: "append-review-log",
    summary: `Recorded review verdict ${entry.verdict}.`,
    artifactPaths: [ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.adversarialReviewState, ARTIFACT_PATHS.revisionPlan]
  });
  return entry;
}

export function upsertRevisionPlan(root, args = {}) {
  assertGovernanceMutationRegistered("upsert-revision-plan", "guarded");
  assertFollowThroughReady(root, "Updating the revision plan", args);
  assertRoleBoundMutation(root, args, {
    actionLabel: "Updating the revision plan",
    expectedRole: "planner"
  });
  const timestamp = args.updatedAt ?? nowIso();
  const summary = args.summary ?? "Manual revision plan update.";
  const items = Array.isArray(args.items) ? args.items : [];
  const content = [
    "# Current revision plan",
    "",
    `- Updated: ${timestamp}`,
    `- Summary: ${summary}`,
    "",
    "## Action items",
    "",
    ...(items.length > 0 ? items.map((item) => `- [ ] ${item}`) : ["- [ ] No action items recorded."])
  ].join("\n");
  writeText(root, ARTIFACT_PATHS.revisionPlan, content);
  upsertOrchestrationBoard(root, {
    phase: "review",
    assignedRole: "planner",
    intentType: "repair",
    currentFocus: summary,
    nextAction: items[0] ?? "Refresh the review loop once revisions land.",
    tasks: items.map((item, index) => ({
      id: `revision-task-${index + 1}`,
      title: item,
      status: "pending",
      assignedRole: "planner",
      currentFocus: item,
      nextAction: "Complete the revision and refresh review surfaces."
    })),
    blockers: items.map((item, index) => ({
      id: `revision-blocker-${index + 1}`,
      summary: item,
      status: "open",
      assignedRole: "planner",
      currentFocus: item,
      nextAction: "Resolve the revision blocker before finalization."
    })),
    reviewRequiredBeforeFinalize: true
  });
  refreshDurableSurfaces(root, {
    type: "upsert-revision-plan",
    summary: `Updated revision plan with ${items.length} items.`,
    artifactPaths: [ARTIFACT_PATHS.revisionPlan, ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.sessionSummary]
  });
  return { updatedAt: timestamp, itemCount: items.length };
}

export function runReviewLoop(root, args = {}) {
  assertGovernanceMutationRegistered("run-review-loop", "guarded");
  assertFollowThroughReady(root, "Running the review loop", args);
  assertRoleBoundMutation(root, args, {
    actionLabel: "Running the review loop",
    expectedRole: "reviewer"
  });
  const state = loadState(root);
  const board = loadBoard(root);
  const evidence = evaluateEvidence(root);
  const auditIndex = readJson(root, ARTIFACT_PATHS.experimentAudits, { version: 1, items: [], updatedAt: null });
  const bridgeLog = readJson(root, ARTIFACT_PATHS.claimBridgeLog, { version: 1, items: [], updatedAt: null });
  const figureQa = evaluateFigurePipeline(root);
  const findings = [];

  for (const claim of evidence.unsupportedClaims) {
    findings.push({ severity: "high", summary: `Claim ${claim.id} has no source support.`, claimIds: [claim.id], responseOwnerRole: "researcher", methodologicalCategory: "evidence" });
  }

  for (const claim of evidence.weakClaims) {
    findings.push({ severity: "medium", summary: `Claim ${claim.id} is weakly supported and should be strengthened.`, claimIds: [claim.id], responseOwnerRole: "researcher", methodologicalCategory: "evidence" });
  }

  for (const item of evidence.missingSourceRefs) {
    findings.push({ severity: "high", summary: `Claim ${item.claim.id} references missing sources: ${item.missing.join(", ")}.`, claimIds: [item.claim.id], responseOwnerRole: "researcher", methodologicalCategory: "evidence" });
  }

  for (const item of evidence.missingNoteRefs) {
    findings.push({ severity: "medium", summary: `Claim ${item.claim.id} references missing notes: ${item.missing.join(", ")}.`, claimIds: [item.claim.id], responseOwnerRole: "researcher", methodologicalCategory: "evidence" });
  }

  for (const item of evidence.missingCitationRefs) {
    findings.push({ severity: "high", summary: `${item.draftFile} cites unknown source key ${item.key}.`, responseOwnerRole: "researcher", methodologicalCategory: "citation" });
  }

  const experimentResults = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  for (const result of experimentResults.items) {
    if (result.outcome === "failed" || result.outcome === "refutes") {
      findings.push({ severity: "high", summary: `Experiment ${result.experimentId} returned ${result.outcome} and needs claim/rebuttal follow-up.`, experimentIds: [result.experimentId], claimIds: result.claimId ? [result.claimId] : [], responseOwnerRole: "experiment-planner", methodologicalCategory: "integrity", linkedAuditIds: result.latestAuditId ? [result.latestAuditId] : [], linkedBridgeIds: result.latestBridgeId ? [result.latestBridgeId] : [] });
    }
    if (result.outcome === "inconclusive") {
      findings.push({ severity: "medium", summary: `Experiment ${result.experimentId} is inconclusive and weakens claim confidence.`, experimentIds: [result.experimentId], claimIds: result.claimId ? [result.claimId] : [], responseOwnerRole: "experiment-planner", methodologicalCategory: "integrity", linkedAuditIds: result.latestAuditId ? [result.latestAuditId] : [], linkedBridgeIds: result.latestBridgeId ? [result.latestBridgeId] : [] });
    }
  }

  for (const audit of evidence.auditIntegrityFlags) {
    findings.push({ severity: "high", summary: `Experiment audit ${audit.id} raised integrity flags: ${audit.integrityFlags.join(", ")}.`, experimentIds: audit.experimentId ? [audit.experimentId] : [], claimIds: audit.claimId ? [audit.claimId] : [], responseOwnerRole: "experiment-planner", methodologicalCategory: "integrity", linkedAuditIds: [audit.id], linkedArtifactPaths: [ARTIFACT_PATHS.experimentAudits] });
  }

  for (const bridgeProblem of evidence.claimBridgeProblems) {
    findings.push({ severity: "high", summary: `Claim ${bridgeProblem.claim.id} has a result-to-claim bridge problem (${bridgeProblem.reason}).`, claimIds: [bridgeProblem.claim.id], experimentIds: bridgeProblem.claim.experimentIds ?? [], responseOwnerRole: "experiment-planner", methodologicalCategory: "integrity", linkedBridgeIds: bridgeProblem.bridgeId ? [bridgeProblem.bridgeId] : [], linkedAuditIds: bridgeProblem.auditIds ?? [], linkedArtifactPaths: [ARTIFACT_PATHS.claimBridgeLog] });
  }

  for (const item of evidence.draftClaimMismatches) {
    if (item.reason === "missing-draft") {
      findings.push({ severity: "medium", summary: `Claim ${item.claim.id} targets section ${item.claim.sectionId} but no draft exists for that section.`, claimIds: [item.claim.id], responseOwnerRole: "researcher", methodologicalCategory: "draft" });
      continue;
    }
    findings.push({ severity: "medium", summary: `Draft for ${item.claim.sectionId} does not cite any expected source for claim ${item.claim.id}.`, claimIds: [item.claim.id], responseOwnerRole: "researcher", methodologicalCategory: "citation" });
  }

  for (const todo of evidence.citationTodos) {
    findings.push({ severity: "medium", summary: `${todo.draftFile}:${todo.line} still has a citation TODO.`, responseOwnerRole: "researcher", methodologicalCategory: "citation" });
  }

  const draftedSections = new Set(listDraftFiles(root).map((fileName) => fileName.replace(/\.md$/, "")));
  for (const section of Object.values(state.sections)) {
    if (section.status !== "planned" && !draftedSections.has(section.id)) {
      findings.push({ severity: "medium", summary: `Section ${section.title} is marked ${section.status} but has no draft file.`, responseOwnerRole: "planner", methodologicalCategory: "process" });
    }
  }

  for (const issue of figureQa.issues) {
    findings.push({
      severity: issue.severity,
      summary: issue.summary,
      claimIds: issue.claimIds,
      experimentIds: issue.experimentIds,
      responseOwnerRole: issue.responseOwnerRole,
      methodologicalCategory: "figure",
      linkedArtifactPaths: issue.artifactPaths
    });
  }

  const actionItems = findings.map((finding) => finding.summary);
  const verdict = findings.some((finding) => finding.severity === "high")
    ? "needs-evidence"
    : findings.length > 0
      ? "needs-revision"
      : "coherent";

  const entry = appendReviewLog(root, {
    stage: args.stage ?? "review-loop",
    scope: args.scope ?? "current paper pipeline",
    verdict,
    summary: verdict === "coherent"
      ? "The current paper artifacts are internally consistent."
      : "The current paper artifacts need another revision pass.",
    findings,
    actionItems,
    reviewRequiredBeforeFinalize: true
  });

  normalizeRebuttalIssues(root, {
    issues: findings.map((finding, index) => ({
      id: `review-issue-${index + 1}`,
      reviewer: args.reviewer ?? "review-loop",
      summary: finding.summary,
      severity: finding.severity,
      status: verdict === "coherent" ? "resolved" : "open",
      evidenceLinks: board.evidenceLinks,
      claimIds: finding.claimIds,
      experimentIds: finding.experimentIds,
      responseDirection: finding.severity === "high" ? "fix" : "clarify"
    }))
  });

  const latestAuditIds = (auditIndex.items ?? []).slice(-5).map((item) => item.id);
  const latestBridgeIds = (bridgeLog.items ?? []).slice(-5).map((item) => item.id);
  upsertConcernLedger(root, [], { auditIds: latestAuditIds, bridgeIds: latestBridgeIds });

  return entry;
}
