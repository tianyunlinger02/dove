import { ARTIFACT_PATHS } from "./schema.mjs";
import { resolveDoveResponseLanguage } from "./i18n.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { buildPreActionGuidance } from "./pre-action-guidance.mjs";
import { buildCommandResultCard } from "./result-cards.mjs";
import { appendText, assertGovernanceMutationRegistered, ensureWorkspace, loadState, nowIso, readJson, writeJson } from "./workspace.mjs";
import { runReviewLoop } from "./reviews.mjs";

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "review-loop";
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean)))
    : [];
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim();
}

const RETIRED_REVIEW_LOOP_FIELDS = new Set(["maxIterations", "draft", "draftBody", "sectionId", "experience", "experienceGoal", "finalPlanPaths", "finalResultPaths"]);

function assertNoRetiredReviewLoopControls(value, inputPath = "$", seen = new WeakSet()) {
  if (!value || typeof value !== "object") {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  for (const [key, item] of Object.entries(value)) {
    const itemPath = Array.isArray(value)
      ? `${inputPath}[${key}]`
      : `${inputPath}.${key}`;
    if (
      RETIRED_REVIEW_LOOP_FIELDS.has(key)
      || key.startsWith("policyOverride")
      || key === "skipBoardUpdate"
      || key === "skipRefreshDurableSurfaces"
      || key === "skipFollowThroughReady"
      || key === "skipSyncPhase"
    ) {
      throw new Error(
        `run_dove_review_loop no longer accepts retired governance input ${key} at ${itemPath}.`
      );
    }
    assertNoRetiredReviewLoopControls(item, itemPath, seen);
  }
}

function localizedText(responseLanguage, zh, en) {
  return responseLanguage === "en" ? en : zh;
}

function reviewLoopStopSummary(status, stopReason, responseLanguage) {
  if (status === "coherent") {
    return localizedText(responseLanguage, "review-loop 已确认当前材料基本自洽。", "The review loop found the current materials coherent.");
  }
  if (stopReason === "builder-revision-required") {
    return localizedText(responseLanguage, "review-loop 已完成 Reviewer 检查，并停在显式 Builder 修订边界；没有改写草稿或实验材料。", "The review loop completed the Reviewer pass and stopped at an explicit Builder revision boundary without changing draft or experiment material.");
  }
  if (status === "blocked") {
    return localizedText(responseLanguage, "review-loop 停在需要修复的问题上。", "The review loop stopped on an issue that needs repair.");
  }
  return localizedText(responseLanguage, "review-loop 已用完本轮预算，需要人工决定下一步。", "The review loop used its iteration budget and needs an operator decision.");
}

function buildBuilderRevisionBoundary({ runId, packetId, review, draftRequested, experienceRequested }) {
  if (review.verdict === "coherent" && !draftRequested && !experienceRequested) {
    return null;
  }
  const reviewActions = review.verdict === "coherent" ? [] : normalizeStringArray(review.actionItems);
  const requiredActions = normalizeStringArray([
    "transfer-reviewer-owned-board-to-builder-before-revision",
    ...reviewActions,
    draftRequested ? "apply-supplied-draft-in-builder-owned-pass" : "",
    experienceRequested ? "run-supplied-experience-in-builder-owned-pass" : "",
    "return-revised-material-for-review"
  ]);
  const requestedWork = [draftRequested ? "draft" : null, experienceRequested ? "experience" : null].filter(Boolean);
  const reason = requestedWork.length > 0
    ? `Reviewer pass completed before the requested ${requestedWork.join(" and ")} work. No builder-owned material was changed while the board remained reviewer-owned.`
    : `Reviewer pass found ${reviewActions.length} action item(s) and stopped before any builder revision.`;
  return {
    id: `${runId}-builder-revision`,
    type: "fix-required",
    status: "open",
    packetId,
    runId,
    sourceSurface: "dove.review-loop",
    command: "run_dove_review_loop",
    reason,
    summary: "Explicitly transfer ownership to a Builder revision pass, apply the required changes there, and return the revised material for another Reviewer pass.",
    requiredInputs: [],
    requiredActions,
    ownerRole: "reviewer",
    nextRole: "builder",
    nextAction: "project:dove.mission",
    requestedWork,
    writes: []
  };
}

function publicBuilderRevisionActions({ draftRequested, experienceRequested }, responseLanguage) {
  return [
    localizedText(responseLanguage, "先显式把修订工作交给 Builder。", "Explicitly hand the revision work to a Builder first."),
    draftRequested ? localizedText(responseLanguage, "在 Builder pass 中应用提供的草稿内容。", "Apply the supplied draft content in the Builder pass.") : null,
    experienceRequested ? localizedText(responseLanguage, "在 Builder/experiment pass 中运行提供的实验工作。", "Run the supplied experiment work in the Builder/experiment pass.") : null,
    localizedText(responseLanguage, "修订完成后把材料交回 Reviewer 再检查。", "Return the revised material to the Reviewer for another pass.")
  ].filter(Boolean);
}

export function runDoveReviewLoop(root, args = {}) {
  assertGovernanceMutationRegistered("run-dove-review-loop", "guarded");
  assertNoRetiredReviewLoopControls(args);
  const target = assertTaskScopedMutationTarget(root, "run-dove-review-loop", args);
  ensureWorkspace(root);
  loadState(root);
  const runId = slugify(args.runId ?? `review-pass-${target.packetId}-${Date.now().toString(36)}`);
  const draftRequested = false;
  const experienceRequested = false;

  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const reviewArgs = {
    packetId: target.packetId,
    scope: args.scope ?? args.instructions ?? "review-loop material check",
    stage: args.stage ?? target.packet?.stage ?? "audit",
    artifactPaths: normalizeStringArray(args.artifactPaths),
    reviewedArtifactPaths: normalizeStringArray(args.reviewedArtifactPaths)
  };
  if (hasNonEmptyString(args.responseLanguage)) {
    reviewArgs.responseLanguage = args.responseLanguage;
  } else if (hasNonEmptyString(args.language)) {
    reviewArgs.language = args.language;
  }
  const reviewEntry = runReviewLoop(root, reviewArgs);
  const boundary = buildBuilderRevisionBoundary({
    runId,
    packetId: target.packetId,
    review: reviewEntry,
    draftRequested,
    experienceRequested
  });
  const status = boundary ? "needs-review" : "coherent";
  const stopReason = boundary ? "builder-revision-required" : "review-coherent";
  const review = {
    ...reviewEntry,
    preActionGuidance: buildPreActionGuidance({
      surface: "dove.review",
      responseLanguage,
      request: args.scope ?? args.instructions ?? "review-loop material check",
      roleId: "reviewer",
      packet: target.packet,
      currentContext: {
        domain: target.packet?.domain ?? null,
        stage: target.packet?.stage ?? "audit",
        primaryRole: "reviewer"
      },
      operatorLessons: readJson(root, ARTIFACT_PATHS.metaOperatorLessons, { lessons: [] }),
      nextAction: boundary?.nextAction ?? "project:dove.status",
      routeHint: boundary?.nextAction ?? "project:dove.status",
      nextHumanAction: boundary
        ? localizedText(responseLanguage, "显式交接给 Builder 完成修订，再交回 Reviewer。", "Explicitly hand off to a Builder for revision, then return to the Reviewer.")
        : localizedText(responseLanguage, "回到状态页选择下一步。", "Return to status and choose the next step."),
      workflowKind: "review",
      domain: target.packet?.domain ?? null,
      stage: target.packet?.stage ?? "audit",
      tags: ["review", "independent-audit", "evidence", "builder-boundary"],
      statusSummary: {
        verdict: reviewEntry.verdict,
        findingCount: reviewEntry.findings?.length ?? 0,
        actionItemCount: reviewEntry.actionItems?.length ?? 0,
        boundaryType: boundary?.type ?? null
      }
    })
  };
  const pass = {
    review,
    boundary
  };

  const timestamp = nowIso();
  const loopRecord = {
    id: runId,
    packetId: target.packetId,
    status,
    stopReason,
    boundaryType: boundary?.type ?? null,
    requiredActions: boundary?.requiredActions ?? [],
    ownerRole: boundary?.ownerRole ?? "reviewer",
    nextRole: boundary?.nextRole ?? null,
    passCount: 1,
    reviewStatus: review.verdict,
    reviewRunId: review.timestamp ?? null,
    verdict: review.verdict ?? null,
    findingCount: review.findings?.length ?? 0,
    actionItemCount: review.actionItems?.length ?? 0,
    createdAt: timestamp
  };
  const stateIndex = readJson(root, ARTIFACT_PATHS.reviewState, { version: 2, history: [], openItems: [], lastVerdict: "not-reviewed", lastReviewedAt: null, unresolvedConcernIds: [] });
  stateIndex.history = [...(Array.isArray(stateIndex.history) ? stateIndex.history : []), loopRecord];
  stateIndex.lastVerdict = status;
  stateIndex.lastReviewedAt = timestamp;
  writeJson(root, ARTIFACT_PATHS.reviewState, stateIndex);
  appendText(root, ARTIFACT_PATHS.reviewLog, `## ${timestamp} — dove-review-loop\n\n- Run: ${runId}\n- Packet: ${target.packetId}\n- Status: ${status}\n- Stop reason: ${stopReason}\n- Boundary: ${boundary?.type ?? "none"}\n- Review pass: single independent pass\n- Builder mutation: none; revision requires a new explicit handoff call\n\n`);
  const preActionGuidance = buildPreActionGuidance({
    surface: "dove.review",
    responseLanguage,
    request: args.instructions ?? args.scope ?? args.summary ?? "review loop",
    roleId: "reviewer",
    packet: target.packet,
    currentContext: {
      domain: target.packet?.domain ?? null,
      stage: target.packet?.stage ?? "audit",
      primaryRole: "reviewer"
    },
    operatorLessons: readJson(root, ARTIFACT_PATHS.metaOperatorLessons, { lessons: [] }),
    nextAction: boundary?.nextAction ?? "project:dove.status",
    routeHint: boundary?.nextAction ?? "project:dove.status",
    nextHumanAction: boundary
      ? localizedText(responseLanguage, "显式交接给 Builder 完成修订，再交回 Reviewer。", "Explicitly hand off to a Builder for revision, then return to the Reviewer.")
      : localizedText(responseLanguage, "回到状态页选择下一步。", "Return to status and choose the next step."),
    workflowKind: "review-loop",
    domain: target.packet?.domain ?? null,
    stage: target.packet?.stage ?? "audit",
    tags: ["review", "evidence", "builder-boundary", "iteration"],
    statusSummary: {
      status,
      stopReason,
      passCount: 1,
      boundaryType: boundary?.type ?? null,
      requiredActions: boundary?.requiredActions ?? []
    }
  });
  const publicRequiredActions = boundary
    ? publicBuilderRevisionActions({ draftRequested, experienceRequested }, responseLanguage)
    : [];
  const resultCard = buildCommandResultCard({
    surface: "dove.review-loop",
    command: "run_dove_review_loop",
    title: boundary
      ? localizedText(responseLanguage, "review-loop 已停在 Builder 修订边界", "Review loop stopped at the Builder revision boundary")
      : localizedText(responseLanguage, "review-loop 已停止", "Review loop stopped"),
    status,
    stopReason,
    happened: reviewLoopStopSummary(status, stopReason, responseLanguage),
    durableWrites: [localizedText(responseLanguage, "审核状态和审核日志已更新；草稿和实验材料未改动。", "Review state and review log were updated; draft and experiment material were not changed.")],
    evidence: [localizedText(responseLanguage, "本次调用完成一次独立 Reviewer 检查。", "This call completed one independent Reviewer pass.")],
    validation: [reviewLoopStopSummary(status, stopReason, responseLanguage)],
    boundary: boundary ? {
      type: boundary.type,
      summary: localizedText(responseLanguage, "当前 board 仍由 Reviewer 持有；必须显式交接给 Builder 后才能修订。", "The board remains Reviewer-owned; revision requires an explicit handoff to a Builder."),
      nextAction: boundary.nextAction,
      requiredActions: publicRequiredActions
    } : null,
    scope: {
      reviewPasses: 1,
      status,
      builderMutationApplied: false
    },
    nextActions: [{
      title: boundary
        ? localizedText(responseLanguage, "显式交接给 Builder 修订", "Explicitly hand off to a Builder for revision")
        : localizedText(responseLanguage, "回到状态页选择下一步", "Return to status for the next step"),
      why: boundary
        ? localizedText(responseLanguage, "这次调用只完成 Reviewer pass，不会启动 mission、auto、rebuttal，也不会在 Reviewer ownership 下写草稿或实验。", "This call completes only the Reviewer pass; it does not start mission, auto, or rebuttal, and it does not write draft or experiment material under Reviewer ownership.")
        : localizedText(responseLanguage, "当前材料已经通过这一轮检查，可以决定继续写作、归档或进入版本快照。", "This pass is coherent, so the next decision can be drafting, closure, or versioning."),
      requiredActions: publicRequiredActions
    }]
  }, responseLanguage);
  return {
    status,
    preActionGuidance,
    resultCard,
    stopReason,
    packetId: target.packetId,
    runId,
    pass,
    review,
    boundary,
    boundaryType: boundary?.type ?? null,
    requiredActions: boundary?.requiredActions ?? [],
    ownerRole: boundary?.ownerRole ?? "reviewer",
    nextRole: boundary?.nextRole ?? null,
    nextAction: boundary?.nextAction ?? "project:dove.status",
    deferredBuilderWork: boundary ? {
      draftRequested,
      experienceRequested,
      writes: [],
      requiredActions: boundary.requiredActions
    } : null,
    reviewStatePath: ARTIFACT_PATHS.reviewState,
    reviewLogPath: ARTIFACT_PATHS.reviewLog
  };
}
