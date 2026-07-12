import { ARTIFACT_PATHS } from "./schema.mjs";
import { inspectDeclaredPath } from "./artifact-integrity.mjs";
import { evaluateFigurePipeline } from "./artifacts.mjs";
import { evaluateEvidence } from "./evidence.mjs";
import { resolveDoveResponseLanguage } from "./i18n.mjs";
import { refreshDurableSurfaces } from "./navigation.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { loadBoard, upsertOrchestrationBoard } from "./orchestration.mjs";
import { buildPreActionGuidance } from "./pre-action-guidance.mjs";
import { buildCommandResultCard } from "./result-cards.mjs";
import { assertReviewMaterials, buildReviewScope } from "./review-scope.mjs";
import { appendText, assertGovernanceMutationRegistered, assertFollowThroughReady, loadState, nowIso, readJson, saveState, writeJson, writeText } from "./workspace.mjs";

const UNRESOLVED_CONCERN_STATUSES = new Set(["open", "awaiting-author-response", "author-response-submitted", "escalated", "contested"]);
const AUTHOR_RESPONSE_PENDING_STATUSES = new Set(["open", "awaiting-author-response"]);
const REVIEWER_RULING_PENDING_STATUSES = new Set(["author-response-submitted", "contested"]);
const REVIEW_VERDICTS = new Set(["coherent", "needs-revision", "needs-evidence", "blocked"]);

function normalizeStringArray(value) {
  const values = Array.isArray(value) ? value : (typeof value === "string" ? [value] : []);
  return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
}

function normalizeReviewVerdict(value) {
  const verdict = typeof value === "string" ? value.trim() : "";
  if (!REVIEW_VERDICTS.has(verdict)) {
    throw new Error(`append_review_log requires verdict to be one of: ${Array.from(REVIEW_VERDICTS).join(", ")}.`);
  }
  return verdict;
}

function normalizeRequiredReviewSummary(value) {
  const summary = typeof value === "string" ? value.trim() : "";
  if (!summary) {
    throw new Error("append_review_log requires a substantive review summary; default review text is not progress.");
  }
  return summary;
}

function inspectReviewArtifact(root, rawPath, label) {
  const inspection = inspectDeclaredPath(root, rawPath, {
    requireNonEmpty: true,
    rejectBookkeeping: true
  });
  if (inspection.status !== "existing") {
    throw new Error(`${label} must be an existing non-empty non-bookkeeping file: ${inspection.normalizedPath ?? rawPath ?? "<missing>"} (${inspection.reason ?? inspection.status}).`);
  }
  return inspection.normalizedPath;
}

function normalizeReviewedArtifactPaths(root, args = {}) {
  const reviewedArtifactPaths = normalizeStringArray([
    ...normalizeStringArray(args.reviewedArtifactPaths),
    ...normalizeStringArray(args.artifactPaths),
    ...normalizeStringArray(args.linkedArtifactPaths)
  ]);
  return reviewedArtifactPaths.map((artifactPath) => inspectReviewArtifact(root, artifactPath, "reviewedArtifactPaths"));
}

function normalizeExistingReportPath(root, args = {}) {
  const reportPath = args.reportPath ?? args.reviewReportPath ?? null;
  if (!reportPath) {
    return null;
  }
  return inspectReviewArtifact(root, reportPath, "reportPath");
}

function renderReviewReport(entry) {
  return [
    "# Review report",
    "",
    `- Timestamp: ${entry.timestamp}`,
    `- Stage: ${entry.stage}`,
    `- Scope: ${entry.scope}`,
    `- Verdict: ${entry.verdict}`,
    `- Summary: ${entry.summary}`,
    "",
    "## Reviewed artifacts",
    "",
    ...(entry.reviewedArtifactPaths.length > 0 ? entry.reviewedArtifactPaths.map((artifactPath) => `- ${artifactPath}`) : ["- None"]),
    "",
    "## Findings",
    "",
    ...(entry.findings.length > 0 ? entry.findings.map((finding) => `- [${finding.severity}] ${finding.summary}`) : ["- None"]),
    "",
    "## Action items",
    "",
    ...(entry.actionItems.length > 0 ? entry.actionItems.map((item) => `- [ ] ${item}`) : ["- [ ] None"]),
    ""
  ].join("\n");
}

function hasExplicitReviewBoundary(args = {}) {
  return normalizeStringArray(args.requiredInputs).length > 0
    || normalizeStringArray(args.requiredActions).length > 0
    || typeof args.boundaryReason === "string"
    || typeof args.boundaryType === "string";
}

function localizedText(responseLanguage, zh, en) {
  return responseLanguage === "en" ? en : zh;
}

function reviewResultCard(root, args = {}, entry, command = "append_review_log") {
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const findingCount = entry.findings?.length ?? 0;
  const actionItemCount = entry.actionItems?.length ?? 0;
  return buildCommandResultCard({
    surface: "dove.review",
    command,
    title: localizedText(responseLanguage, "review 结果已记录", "Review result recorded"),
    status: entry.verdict,
    happened: entry.verdict === "coherent"
      ? localizedText(responseLanguage, "Reviewer 认为当前材料基本自洽。", "The reviewer found the current materials coherent.")
      : localizedText(responseLanguage, "Reviewer 记录了需要处理的问题。", "The reviewer recorded issues that need attention."),
    durableWrites: [localizedText(responseLanguage, "审核记录、问题状态和修订计划已更新。", "Review log, concern state, and revision plan were updated.")],
    evidence: [localizedText(responseLanguage, `发现 ${findingCount} 个问题，留下 ${actionItemCount} 个行动项。`, `Found ${findingCount} issues and left ${actionItemCount} action items.`)],
    validation: [entry.summary],
    scope: { verdict: entry.verdict, findingCount, actionItemCount },
    nextActions: [{
      title: entry.verdict === "coherent"
        ? localizedText(responseLanguage, "回到状态页决定是否收尾", "Return to status and decide whether to close")
        : localizedText(responseLanguage, "把最高优先级问题变成修订动作", "Turn the highest-priority issue into revision work"),
      why: entry.verdict === "coherent"
        ? localizedText(responseLanguage, "review 已通过，下一步应选择继续写、做版本快照或收尾。", "Review passed; next choose whether to keep drafting, snapshot, or close.")
        : localizedText(responseLanguage, "review 已指出缺口，下一步要先修材料而不是宣布完成。", "Review found gaps, so the next step is repair rather than claiming completion.")
    }]
  }, responseLanguage);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function renderReviewEntry(entry) {
  const reviewedArtifactPaths = normalizeStringArray(
    entry.reviewedArtifactPaths
  );
  const findings = Array.isArray(entry.findings)
    ? entry.findings
    : [];
  const actionItems = normalizeStringArray(
    entry.actionItems
  );
  return [
    `## ${entry.timestamp} — ${entry.stage}`,
    "",
    `- Scope: ${entry.scope}`,
    `- Verdict: ${entry.verdict}`,
    `- Summary: ${entry.summary}`,
    `- Report: ${entry.reportPath ?? "none"}`,
    `- Reviewed artifacts: ${reviewedArtifactPaths.length > 0 ? reviewedArtifactPaths.join(", ") : "none"}`,
    `- Review required before finalize: ${entry.reviewRequiredBeforeFinalize}`,
    "- Findings:",
    ...(findings.length > 0 ? findings.map((item) => `  - [${item.severity}] ${item.summary}${item.responseOwnerRole ? ` (response owner: ${item.responseOwnerRole})` : ""}`) : ["  - None recorded"]),
    "- Action items:",
    ...(actionItems.length > 0 ? actionItems.map((item) => `  - ${item}`) : ["  - None recorded"]),
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
  return slugify(`${concern.packetId ?? "unscoped"}-${summary}-${claimIds}-${experimentIds}`);
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
    packetId: concern.packetId ?? null,
    includedPacketIds: normalizeStringArray(concern.includedPacketIds),
    reviewedArtifactPaths: normalizeStringArray(concern.reviewedArtifactPaths),
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
    sourceReviewIds: normalizeStringArray(concern.sourceReviewIds),
    sourceExecutionClaimIds: normalizeStringArray(concern.sourceExecutionClaimIds),
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
    const repeatedExecutionClaim = Boolean(
      context.executionClaimId
      && existing?.sourceExecutionClaimIds?.includes(context.executionClaimId)
    );
    const recurrenceCount = concern.status === "resolved"
      ? existing?.recurrenceCount ?? 1
      : status === "resolved"
        ? existing?.recurrenceCount ?? 1
        : repeatedExecutionClaim
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
      sourceReviewIds: Array.from(new Set([...(existing?.sourceReviewIds ?? []), ...(concern.sourceReviewIds ?? []), ...[context.reviewId].filter(Boolean)])),
      sourceExecutionClaimIds: Array.from(new Set([...(existing?.sourceExecutionClaimIds ?? []), ...(concern.sourceExecutionClaimIds ?? []), ...[context.executionClaimId].filter(Boolean)])),
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

  if (touched.length > 0 && !context.isRetry) {
    appendText(root, ARTIFACT_PATHS.reviewDebateLog, `\n## ${nowIso()} — review round\n\n${touched.map((concern) => `- ${concern.id} [${concern.status}] reviewer=${concern.raisedByRole} response-owner=${concern.responseOwnerRole} recurrence=${concern.recurrenceCount}: ${concern.summary}`).join("\n")}\n`);
  }
  return { items, ...summary };
}

const SYSTEM_OWNED_REVIEW_FIELDS = new Set([
  "authorizationProvenance",
  "authorizationProvenanceHistory",
  "authorizationFingerprint",
  "authorityStepId",
  "authorityStepIndex",
  "claimId",
  "executionClaimId",
  "runtimeRunId",
  "leaseId",
  "sourceExecutionClaimId",
  "sourceExecutionClaimIds",
  "sourceReviewExecutionClaimId",
  "sourceReviewId",
  "sourceReviewIds"
]);

const INTERNAL_REVIEW_CONTROL_FIELDS = new Set([
  "skipBoardUpdate",
  "skipRefreshDurableSurfaces"
]);

function collectForbiddenPublicReviewPaths(value, path = "", seen = new WeakSet()) {
  if (!value || typeof value !== "object") {
    return [];
  }
  if (seen.has(value)) {
    return [];
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectForbiddenPublicReviewPaths(item, `${path}[${index}]`, seen)
    );
  }
  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const fieldPath = path ? `${path}.${key}` : key;
    const forbidden = key.startsWith("policyOverride")
      || INTERNAL_REVIEW_CONTROL_FIELDS.has(key)
      || SYSTEM_OWNED_REVIEW_FIELDS.has(key);
    return [
      ...(forbidden ? [fieldPath] : []),
      ...collectForbiddenPublicReviewPaths(nestedValue, fieldPath, seen)
    ];
  });
}

function assertNoPublicReviewBypassControls(args = {}) {
  const forbidden = collectForbiddenPublicReviewPaths(args);
  if (forbidden.length > 0) {
    throw new Error(
      `Public review mutations do not accept system-owned provenance or internal control fields: ${forbidden.join(", ")}.`
    );
  }
}

export function appendReviewLog(root, args = {}) {
  assertGovernanceMutationRegistered("append-review-log", "guarded");
  assertNoPublicReviewBypassControls(args);
  assertTaskScopedMutationTarget(root, "append-review-log", args);
  assertFollowThroughReady(root, "Recording a review log", args);
  return persistReviewLog(root, args);
}

function persistReviewLog(root, args = {}, runtimeContext = {}) {
  const timestamp = args.timestamp ?? nowIso();
  const verdict = normalizeReviewVerdict(args.verdict);
  const summary = normalizeRequiredReviewSummary(args.summary);
  const reviewedArtifactPaths = normalizeReviewedArtifactPaths(root, args);
  let reportPath = normalizeExistingReportPath(root, args);
  const findings = Array.isArray(args.findings)
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
    : [];
  const actionItems = Array.isArray(args.actionItems) ? args.actionItems : [];
  if (verdict === "coherent") {
    if (reviewedArtifactPaths.length === 0) {
      throw new Error("append_review_log cannot record a coherent review without at least one existing non-empty reviewed artifact.");
    }
    if (!reportPath && args.autoGeneratedReviewReport !== true) {
      throw new Error("append_review_log cannot record a coherent review without an existing non-empty review report file.");
    }
  } else if (findings.length === 0 && actionItems.length === 0 && !hasExplicitReviewBoundary(args)) {
    throw new Error("append_review_log requires findings, actionItems, or an explicit material boundary for non-coherent reviews.");
  }
  const entry = {
    id: runtimeContext.executionClaimId ?? args.id ?? `review-${slugify(`${args.packetId ?? "unscoped"}-${args.stage ?? "manual-review"}-${timestamp}`)}`,
    packetId: args.packetId ?? null,
    includedPacketIds: normalizeStringArray(args.includedPacketIds ?? [args.packetId].filter(Boolean)),
    timestamp,
    stage: args.stage ?? "manual-review",
    scope: args.scope ?? "current paper materials",
    verdict,
    summary,
    reviewRequiredBeforeFinalize: Boolean(args.reviewRequiredBeforeFinalize ?? true),
    reportPath,
    reviewedArtifactPaths,
    resolvedConcernIds: normalizeStringArray(args.resolvedConcernIds),
    findings,
    actionItems,
    ...(runtimeContext.authorizationProvenance ? { authorizationProvenance: runtimeContext.authorizationProvenance } : {})
  };
  if (!entry.reportPath && args.autoGeneratedReviewReport === true) {
    writeText(root, ARTIFACT_PATHS.reviewReport, renderReviewReport(entry));
    entry.reportPath = ARTIFACT_PATHS.reviewReport;
  }

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
  const existingHistoryIndex = (reviewState.history ?? []).findIndex((item) => item.id === entry.id);
  const isRetry = existingHistoryIndex >= 0;
  const reviewRound = isRetry
    ? reviewState.history[existingHistoryIndex].reviewRound ?? reviewState.reviewRound ?? 1
    : (reviewState.reviewRound ?? 0) + 1;
  entry.reviewRound = reviewRound;
  const integrityCriticalConcernIds = entry.findings
    .filter((finding) => finding.severity === "high" || finding.methodologicalCategory === "integrity")
    .map((finding, index) => concernFingerprint({
      id: `review-${entry.stage}-${index + 1}`,
      packetId: entry.packetId,
      summary: finding.summary,
      claimIds: finding.claimIds,
      experimentIds: finding.experimentIds
    }));
  const currentConcerns = readJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 2, items: [], updatedAt: null });
  const concernInputs = entry.verdict === "coherent"
    ? (currentConcerns.items ?? [])
      .filter((item) => entry.resolvedConcernIds.includes(item.id) && UNRESOLVED_CONCERN_STATUSES.has(item.status))
      .map((item) => ({
        ...item,
        status: "resolved",
        rulingOutcome: "accepted",
        reviewerDisposition: "accepted",
        linkedArtifactPaths: Array.from(new Set([...(item.linkedArtifactPaths ?? []), ARTIFACT_PATHS.reviewLog, entry.reportPath, ...entry.reviewedArtifactPaths].filter(Boolean)))
      }))
    : entry.findings.map((finding, index) => ({
        id: concernFingerprint({
          id: `review-${entry.stage}-${index + 1}`,
          packetId: entry.packetId,
          summary: finding.summary,
          claimIds: finding.claimIds,
          experimentIds: finding.experimentIds
        }),
        packetId: entry.packetId,
        includedPacketIds: entry.includedPacketIds,
        reviewedArtifactPaths: entry.reviewedArtifactPaths,
        summary: finding.summary,
        severity: finding.severity,
        responseOwnerRole: finding.responseOwnerRole,
        reviewerRationale: finding.summary,
        linkedAuditIds: finding.linkedAuditIds,
        linkedBridgeIds: finding.linkedBridgeIds,
        linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.revisionPlan, entry.reportPath, ...entry.reviewedArtifactPaths, ...finding.linkedArtifactPaths].filter(Boolean),
        claimIds: finding.claimIds,
        experimentIds: finding.experimentIds
      }));
  const concernLedger = upsertConcernLedger(root, concernInputs, {
    reviewRound,
    integrityCriticalConcernIds,
    reviewId: entry.id,
    executionClaimId: runtimeContext.executionClaimId ?? null,
    isRetry
  });
  const nextHistory = [...(reviewState.history ?? [])];
  if (existingHistoryIndex >= 0) {
    nextHistory[existingHistoryIndex] = entry;
  } else {
    nextHistory.push(entry);
  }
  writeText(root, ARTIFACT_PATHS.reviewLog, [
    "# Review log",
    "",
    ...nextHistory.flatMap((item) => [renderReviewEntry(item), ""])
  ].join("\n"));
  const previousPerPacket = reviewState.perPacket && typeof reviewState.perPacket === "object" ? reviewState.perPacket : {};
  const nextPerPacket = entry.packetId ? {
    ...previousPerPacket,
    [entry.packetId]: {
      packetId: entry.packetId,
      includedPacketIds: entry.includedPacketIds,
      verdict: entry.verdict,
      reviewedAt: timestamp,
      reviewId: entry.id,
      reviewedArtifactPaths: entry.reviewedArtifactPaths,
      unresolvedConcernIds: concernLedger.items.filter((item) => item.packetId === entry.packetId && UNRESOLVED_CONCERN_STATUSES.has(item.status)).map((item) => item.id)
    }
  } : previousPerPacket;
  const workspaceVerdict = Object.values(nextPerPacket).some((item) => item.verdict === "blocked") ? "blocked"
    : Object.values(nextPerPacket).some((item) => item.verdict === "needs-evidence") ? "needs-evidence"
      : Object.values(nextPerPacket).some((item) => item.verdict === "needs-revision") ? "needs-revision"
        : Object.values(nextPerPacket).length > 0 ? "coherent" : "not-reviewed";
  const nextReviewState = {
    ...reviewState,
    version: 4,
    perPacket: nextPerPacket,
    lastVerdict: workspaceVerdict,
    lastReviewedAt: timestamp,
    reviewRound: Math.max(reviewState.reviewRound ?? 0, reviewRound),
    history: nextHistory,
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
      resumeCommand: "project:dove.draft",
      updatedAt: timestamp
    },
    reviews: {
      lastVerdict: workspaceVerdict,
      perPacket: nextPerPacket,
      lastReviewedAt: timestamp,
      openItems: entry.actionItems,
      unresolvedConcernIds: concernLedger.unresolvedConcernIds
    }
  });
  if (runtimeContext.skipBoardUpdate !== true) {
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
  }
  if (runtimeContext.skipRefreshDurableSurfaces !== true) {
    refreshDurableSurfaces(root, {
      type: "append-review-log",
      summary: `Recorded review verdict ${entry.verdict}.`,
      artifactPaths: [ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.adversarialReviewState, ARTIFACT_PATHS.revisionPlan, entry.reportPath].filter(Boolean)
    });
  }
  return {
    ...entry,
    resultCard: reviewResultCard(root, args, entry)
  };
}

export function upsertRevisionPlan(root, args = {}) {
  assertGovernanceMutationRegistered("upsert-revision-plan", "guarded");
  assertTaskScopedMutationTarget(root, "upsert-revision-plan", args);
  assertFollowThroughReady(root, "Updating the revision plan", args);
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
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  return {
    updatedAt: timestamp,
    itemCount: items.length,
    resultCard: buildCommandResultCard({
      surface: "dove.draft",
      command: "upsert_revision_plan",
      title: localizedText(responseLanguage, "修订计划已更新", "Revision plan updated"),
      status: items.length > 0 ? "needs-revision" : "updated",
      happened: localizedText(responseLanguage, `已整理 ${items.length} 个修订动作。`, `Organized ${items.length} revision actions.`),
      durableWrites: [localizedText(responseLanguage, "修订计划和任务看板已更新。", "Revision plan and task board were updated.")],
      scope: { itemCount: items.length, summary },
      nextActions: [{
        title: localizedText(responseLanguage, "完成修订后重新 review", "Run review again after revisions"),
        why: localizedText(responseLanguage, "修订计划只是待办，只有重新 review 通过后才能说材料闭环。", "A revision plan is only pending work; the material is closed only after review passes again.")
      }]
    }, responseLanguage)
  };
}

function normalizeReviewIssue(issue = {}, index = 0) {
  return {
    id: slugify(issue.id ?? issue.summary ?? `review-issue-${index + 1}`),
    reviewer: issue.reviewer ?? "review-loop",
    summary: issue.summary ?? `Issue ${index + 1}`,
    severity: issue.severity ?? "medium",
    status: issue.status ?? "open",
    evidenceLinks: normalizeStringArray(issue.evidenceLinks),
    claimIds: normalizeStringArray(issue.claimIds),
    experimentIds: normalizeStringArray(issue.experimentIds),
    responseDirection: issue.responseDirection ?? "clarify",
    ...(issue.authorizationProvenance
      ? { authorizationProvenance: issue.authorizationProvenance }
      : {}),
    authorizationProvenanceHistory: Array.isArray(issue.authorizationProvenanceHistory)
      ? issue.authorizationProvenanceHistory
      : [],
    sourceReviewIds: normalizeStringArray(issue.sourceReviewIds),
    sourceReviewExecutionClaimId: issue.sourceReviewExecutionClaimId ?? null,
    updatedAt: nowIso()
  };
}

function persistReviewRebuttalIssues(root, reviewEntry, findings = [], context = {}) {
  const current = readJson(root, ARTIFACT_PATHS.rebuttalIssues, {
    version: 1,
    items: [],
    updatedAt: null
  });
  const merged = new Map((current.items ?? []).map((issue, index) => {
    const normalized = normalizeReviewIssue(issue, index);
    return [normalized.id, normalized];
  }));
  for (const [index, finding] of findings.entries()) {
    const id = slugify(`${reviewEntry.id}-${concernFingerprint({
      summary: finding.summary,
      claimIds: finding.claimIds,
      experimentIds: finding.experimentIds
    }, index)}`);
    const existing = merged.get(id) ?? null;
    const provenanceHistory = context.authorizationProvenance
      ? [...(existing?.authorizationProvenanceHistory ?? []), context.authorizationProvenance]
        .filter((item, itemIndex, items) => items.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(item)) === itemIndex)
      : existing?.authorizationProvenanceHistory ?? [];
    merged.set(id, normalizeReviewIssue({
      ...existing,
      id,
      reviewer: context.reviewer,
      summary: finding.summary,
      severity: finding.severity,
      status: reviewEntry.verdict === "coherent" ? "resolved" : "open",
      evidenceLinks: loadBoard(root).evidenceLinks,
      claimIds: finding.claimIds,
      experimentIds: finding.experimentIds,
      responseDirection: finding.severity === "high" ? "fix" : "clarify",
      ...(context.authorizationProvenance
        ? {
            authorizationProvenance: context.authorizationProvenance,
            authorizationProvenanceHistory: provenanceHistory
          }
        : {}),
      sourceReviewIds: Array.from(new Set([...(existing?.sourceReviewIds ?? []), reviewEntry.id])),
      sourceReviewExecutionClaimId: context.executionClaimId ?? existing?.sourceReviewExecutionClaimId ?? null
    }, index));
  }
  const items = Array.from(merged.values()).sort((left, right) => left.id.localeCompare(right.id));
  const next = { version: 1, items, updatedAt: nowIso() };
  writeJson(root, ARTIFACT_PATHS.rebuttalIssues, next);
  return next;
}

function transitionToLocalReviewer(root, args = {}, target = {}) {
  const board = loadBoard(root);
  if (board.currentPhase === "review" && board.assignedRole === "reviewer") {
    return null;
  }
  return upsertOrchestrationBoard(root, {
    phase: "review",
    assignedRole: "reviewer",
    intentType: "review",
    currentFocus: args.scope ?? target.packet?.title ?? board.currentFocus,
    nextAction: "Run the local evidence-aware review pass.",
    handoffSummary: `Handing ${target.packet?.title ?? "the current work"} to the local reviewer for an evidence-aware review.`,
    evidenceLinks: board.evidenceLinks
  });
}

export function runReviewLoop(root, args = {}) {
  assertGovernanceMutationRegistered("run-review-loop", "guarded");
  assertNoPublicReviewBypassControls(args);
  const target = assertTaskScopedMutationTarget(root, "run-review-loop", args);
  assertFollowThroughReady(root, "Running the review pass", args);
  const reviewScope = assertReviewMaterials(buildReviewScope(root, target, args), "run_review_loop");
  transitionToLocalReviewer(root, args, target);
  const entry = persistReviewLoop(root, args, {}, reviewScope);
  const preActionGuidance = buildPreActionGuidance({
    surface: "dove.review",
    responseLanguage: resolveDoveResponseLanguage(root, args),
    request: args.scope ?? args.stage ?? "current paper pipeline",
    roleId: "reviewer",
    packet: target.packet,
    currentContext: {
      domain: target.packet?.domain ?? null,
      stage: args.stage ?? target.packet?.stage ?? "audit",
      primaryRole: "reviewer"
    },
    operatorLessons: readJson(root, ARTIFACT_PATHS.metaOperatorLessons, { lessons: [] }),
    nextAction: entry.verdict === "coherent" ? "project:dove.status" : "project:dove.rebuttal",
    routeHint: "project:dove.review",
    workflowKind: "review",
    domain: target.packet?.domain ?? null,
    stage: args.stage ?? target.packet?.stage ?? "audit",
    tags: ["review", "independent-audit", "evidence"],
    statusSummary: {
      verdict: entry.verdict,
      findingCount: entry.findings?.length ?? 0,
      actionItemCount: entry.actionItems?.length ?? 0
    }
  });
  return {
    ...entry,
    reviewStatePath: ARTIFACT_PATHS.reviewState,
    reviewLogPath: ARTIFACT_PATHS.reviewLog,
    reviewConcernsPath: ARTIFACT_PATHS.reviewConcerns,
    revisionPlanPath: ARTIFACT_PATHS.revisionPlan,
    preActionGuidance,
    resultCard: reviewResultCard(root, args, entry, "run_review_loop")
  };
}

function persistReviewLoop(root, args = {}, runtimeContext = {}, reviewScope = null) {
  const scope = reviewScope ?? assertReviewMaterials(buildReviewScope(root, assertTaskScopedMutationTarget(root, "run-review-loop", args), args), "run_review_loop");
  const evidence = evaluateEvidence(root);
  const claimIds = new Set(scope.claimIds);
  const experimentIds = new Set(scope.experimentIds);
  const resultIds = new Set(scope.resultIds);
  const auditIds = new Set(scope.auditIds);
  const reviewedPaths = new Set(scope.substantiveArtifactPaths);
  const inScopeClaim = (claim) => claimIds.has(claim?.id);
  const inScopeDraft = (item) => {
    const fileName = item?.draftFile ?? (item?.claim?.sectionId ? `${item.claim.sectionId}.md` : null);
    return Boolean(fileName) && reviewedPaths.has(`${ARTIFACT_PATHS.draftsDir}/${fileName}`);
  };
  const findings = [];

  for (const claim of evidence.unsupportedClaims.filter(inScopeClaim)) findings.push({ severity: "high", summary: `Claim ${claim.id} has no source support.`, claimIds: [claim.id], responseOwnerRole: "researcher", methodologicalCategory: "evidence" });
  for (const claim of evidence.weakClaims.filter(inScopeClaim)) findings.push({ severity: "medium", summary: `Claim ${claim.id} is weakly supported and should be strengthened.`, claimIds: [claim.id], responseOwnerRole: "researcher", methodologicalCategory: "evidence" });
  for (const item of evidence.missingSourceRefs.filter((item) => inScopeClaim(item.claim))) findings.push({ severity: "high", summary: `Claim ${item.claim.id} references missing sources: ${item.missing.join(", ")}.`, claimIds: [item.claim.id], responseOwnerRole: "researcher", methodologicalCategory: "evidence" });
  for (const item of evidence.missingNoteRefs.filter((item) => inScopeClaim(item.claim))) findings.push({ severity: "medium", summary: `Claim ${item.claim.id} references missing notes: ${item.missing.join(", ")}.`, claimIds: [item.claim.id], responseOwnerRole: "researcher", methodologicalCategory: "evidence" });
  for (const item of evidence.missingCitationRefs.filter(inScopeDraft)) findings.push({ severity: "high", summary: `${item.draftFile} cites unknown source key ${item.key}.`, responseOwnerRole: "researcher", methodologicalCategory: "citation" });

  const experimentResults = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  for (const result of (experimentResults.items ?? []).filter((item) => resultIds.has(item.id) || experimentIds.has(item.experimentId))) {
    if (["failed", "refutes"].includes(result.outcome)) findings.push({ severity: "high", summary: `Experiment ${result.experimentId} returned ${result.outcome} and needs claim/rebuttal follow-up.`, experimentIds: [result.experimentId], claimIds: result.claimId ? [result.claimId] : [], responseOwnerRole: "experiment-planner", methodologicalCategory: "integrity", linkedAuditIds: result.latestAuditId ? [result.latestAuditId] : [], linkedBridgeIds: result.latestBridgeId ? [result.latestBridgeId] : [] });
    if (result.outcome === "inconclusive") findings.push({ severity: "medium", summary: `Experiment ${result.experimentId} is inconclusive and weakens claim confidence.`, experimentIds: [result.experimentId], claimIds: result.claimId ? [result.claimId] : [], responseOwnerRole: "experiment-planner", methodologicalCategory: "integrity", linkedAuditIds: result.latestAuditId ? [result.latestAuditId] : [], linkedBridgeIds: result.latestBridgeId ? [result.latestBridgeId] : [] });
  }
  for (const audit of evidence.auditIntegrityFlags.filter((item) => auditIds.has(item.id) || experimentIds.has(item.experimentId))) findings.push({ severity: "high", summary: `Experiment audit ${audit.id} raised integrity flags: ${audit.integrityFlags.join(", ")}.`, experimentIds: audit.experimentId ? [audit.experimentId] : [], claimIds: audit.claimId ? [audit.claimId] : [], responseOwnerRole: "experiment-planner", methodologicalCategory: "integrity", linkedAuditIds: [audit.id], linkedArtifactPaths: [ARTIFACT_PATHS.experimentAudits] });
  for (const bridgeProblem of evidence.claimBridgeProblems.filter((item) => inScopeClaim(item.claim))) findings.push({ severity: "high", summary: `Claim ${bridgeProblem.claim.id} has a result-to-claim bridge problem (${bridgeProblem.reason}).`, claimIds: [bridgeProblem.claim.id], experimentIds: bridgeProblem.claim.experimentIds ?? [], responseOwnerRole: "experiment-planner", methodologicalCategory: "integrity", linkedBridgeIds: bridgeProblem.bridgeId ? [bridgeProblem.bridgeId] : [], linkedAuditIds: bridgeProblem.auditIds ?? [], linkedArtifactPaths: [ARTIFACT_PATHS.claimBridgeLog] });
  for (const item of evidence.draftClaimMismatches.filter((candidate) => inScopeClaim(candidate.claim))) findings.push({ severity: "medium", summary: item.reason === "missing-draft" ? `Claim ${item.claim.id} targets section ${item.claim.sectionId} but no draft exists for that section.` : `Draft for ${item.claim.sectionId} does not cite any expected source for claim ${item.claim.id}.`, claimIds: [item.claim.id], responseOwnerRole: "researcher", methodologicalCategory: item.reason === "missing-draft" ? "draft" : "citation" });
  for (const todo of evidence.citationTodos.filter(inScopeDraft)) findings.push({ severity: "medium", summary: `${todo.draftFile}:${todo.line} still has a citation TODO.`, responseOwnerRole: "researcher", methodologicalCategory: "citation" });

  const figureIds = new Set(scope.figureIds ?? []);
  const figureQa = evaluateFigurePipeline(root);
  for (const issue of (figureQa.issues ?? []).filter((item) => figureIds.has(item.figureId) || (item.artifactPaths ?? []).some((artifactPath) => reviewedPaths.has(artifactPath)) || (item.claimIds ?? []).some((id) => claimIds.has(id)) || (item.experimentIds ?? []).some((id) => experimentIds.has(id)))) {
    findings.push({ severity: issue.severity, summary: issue.summary, claimIds: issue.claimIds, experimentIds: issue.experimentIds, responseOwnerRole: issue.responseOwnerRole, methodologicalCategory: "figure", linkedArtifactPaths: issue.artifactPaths });
  }

  const scopedFindings = findings.map((finding) => ({ ...finding, packetId: scope.packetId, includedPacketIds: scope.includedPacketIds, reviewedArtifactPaths: scope.substantiveArtifactPaths }));
  const actionItems = scopedFindings.map((finding) => finding.summary);
  const verdict = scopedFindings.some((finding) => finding.severity === "high") ? "needs-evidence" : scopedFindings.length > 0 ? "needs-revision" : "coherent";
  const entry = persistReviewLog(root, {
    ...args,
    packetId: scope.packetId,
    includedPacketIds: scope.includedPacketIds,
    stage: args.stage ?? "review-pass",
    scope: args.scope ?? `packet ${scope.packetId} and descendants`,
    verdict,
    summary: verdict === "coherent" ? "The selected packet scope is internally consistent for this review pass." : "The selected packet scope requires explicit Builder follow-up before another review pass.",
    findings: scopedFindings,
    actionItems,
    reviewedArtifactPaths: scope.substantiveArtifactPaths,
    autoGeneratedReviewReport: true,
    reviewRequiredBeforeFinalize: true
  }, runtimeContext);
  entry.packetId = scope.packetId;
  entry.includedPacketIds = scope.includedPacketIds;
  entry.reviewedArtifactSet = scope.substantiveArtifactPaths;
  persistReviewRebuttalIssues(root, entry, scopedFindings, { reviewer: args.reviewer ?? "review-pass", authorizationProvenance: runtimeContext.authorizationProvenance ?? null, executionClaimId: runtimeContext.executionClaimId ?? null });
  upsertConcernLedger(root, [], { auditIds: scope.auditIds, bridgeIds: [] });
  return entry;
}
