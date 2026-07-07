import path from "node:path";

import { ARTIFACT_PATHS } from "./schema.mjs";
import { resolveDoveResponseLanguage } from "./i18n.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { buildPreActionGuidance } from "./pre-action-guidance.mjs";
import { buildCommandResultCard } from "./result-cards.mjs";
import { appendText, assertGovernanceMutationRegistered, ensureWorkspace, loadState, nowIso, readJson, writeJson, writeText } from "./workspace.mjs";
import { runAudioReview } from "./audio-review.mjs";
import { runExperienceWorkflow } from "./experience-workflow.mjs";

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "review-loop";
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean))) : [];
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim();
}

function hasExperienceObjective(args = {}) {
  return [args.experimentId, args.id, args.goal, args.idea, args.title].some(hasNonEmptyString);
}

function localizedText(responseLanguage, zh, en) {
  return responseLanguage === "en" ? en : zh;
}

function reviewLoopStopSummary(status, stopReason, responseLanguage) {
  if (status === "coherent") {
    return localizedText(responseLanguage, "review-loop 已确认当前材料基本自洽。", "The review loop found the current materials coherent.");
  }
  if (stopReason === "awaiting-review-output") {
    return localizedText(responseLanguage, "review-loop 已准备审核输入，现在等独立审核结果。", "The review loop prepared review input and is waiting for independent review output.");
  }
  if (status === "blocked") {
    return localizedText(responseLanguage, "review-loop 停在需要修复的问题上。", "The review loop stopped on an issue that needs repair.");
  }
  return localizedText(responseLanguage, "review-loop 已用完本轮预算，需要人工决定下一步。", "The review loop used its iteration budget and needs an operator decision.");
}

function writeDraftPlaceholder(root, args, iteration, packetId) {
  const sectionId = slugify(args.sectionId ?? `review-loop-${iteration}`);
  const title = normalizeString(args.title, sectionId.replace(/-/g, " "));
  const draftPath = path.posix.join(ARTIFACT_PATHS.draftsDir, `${sectionId}.md`);
  const body = normalizeString(args.body, null);
  if (!body) {
    throw new Error("run_dove_review_loop draft updates require draftBody or draft.body.");
  }
  writeText(root, draftPath, body);
  const state = loadState(root);
  state.sections[sectionId] = {
    ...(state.sections[sectionId] ?? { id: sectionId, title, claimIds: [] }),
    title,
    status: "drafting",
    draftPath,
    summary: normalizeString(args.summary, `Review-loop draft placeholder for packet ${packetId}.`)
  };
  writeJson(root, ARTIFACT_PATHS.state, state);
  return { sectionId, draftPath };
}

export function runDoveReviewLoop(root, args = {}) {
  assertGovernanceMutationRegistered("run-dove-review-loop", "guarded");
  const target = assertTaskScopedMutationTarget(root, "run-dove-review-loop", args);
  ensureWorkspace(root);
  const state = loadState(root);
  const configuredMax = state.settings?.reviewLoop?.maxIterations ?? 3;
  const requestedMax = Number.isFinite(args.maxIterations) ? Math.max(1, Math.floor(args.maxIterations)) : configuredMax;
  const maxIterations = Math.min(requestedMax, configuredMax);
  const runId = slugify(args.runId ?? `review-loop-${target.packetId}-${Date.now().toString(36)}`);
  const draftArgs = {
    ...(args.draft && typeof args.draft === "object" ? args.draft : {}),
    body: args.draftBody ?? args.draft?.body,
    sectionId: args.sectionId,
    title: args.title,
    summary: args.summary
  };
  const draftRequested = Boolean(args.draft || args.draftBody);
  if (draftRequested && !hasNonEmptyString(draftArgs.body)) {
    throw new Error("run_dove_review_loop draft updates require draftBody or draft.body.");
  }
  const experienceArgs = {
    ...(args.experience && typeof args.experience === "object" ? args.experience : {}),
    packetId: target.packetId,
    goal: args.experienceGoal ?? args.experience?.goal
  };
  const experienceRequested = Boolean(args.experience || args.experienceGoal);
  if (experienceRequested && !hasExperienceObjective(experienceArgs)) {
    throw new Error("run_dove_review_loop experience updates require experienceGoal or an experience goal, title, idea, or experimentId.");
  }
  const iterations = [];
  let status = "max-iterations-exhausted";
  let stopReason = "max-iterations-reached";

  for (let index = 0; index < maxIterations; index += 1) {
    const iterationNumber = index + 1;
    const review = runAudioReview(root, {
      ...args,
      packetId: target.packetId,
      runId: `${runId}-${iterationNumber}`,
      artifactPaths: normalizeStringArray(args.artifactPaths),
      finalPlanPaths: normalizeStringArray(args.finalPlanPaths),
      finalResultPaths: normalizeStringArray(args.finalResultPaths)
    });
    const draft = draftRequested ? writeDraftPlaceholder(root, draftArgs, iterationNumber, target.packetId) : null;
    const experience = experienceRequested ? runExperienceWorkflow(root, experienceArgs) : null;
    iterations.push({ iteration: iterationNumber, review, draft, experience });
    const verdict = review.imported?.verdict;
    if (verdict === "coherent") {
      status = "coherent";
      stopReason = "review-coherent";
      break;
    }
    if (review.status === "prepared-awaiting-audio") {
      status = "blocked";
      stopReason = "awaiting-review-output";
      break;
    }
    if (verdict === "blocked") {
      status = "blocked";
      stopReason = "verification-failed";
      break;
    }
  }

  const timestamp = nowIso();
  const loopRecord = {
    id: runId,
    packetId: target.packetId,
    status,
    stopReason,
    maxIterations,
    iterationCount: iterations.length,
    iterations: iterations.map((iteration) => ({
      iteration: iteration.iteration,
      reviewStatus: iteration.review.status,
      reviewRunId: iteration.review.runId,
      verdict: iteration.review.imported?.verdict ?? null,
      draftPath: iteration.draft?.draftPath ?? null,
      experiencePlanId: iteration.experience?.plan?.id ?? null
    })),
    createdAt: timestamp
  };
  const stateIndex = readJson(root, ARTIFACT_PATHS.reviewState, { version: 2, history: [], openItems: [], lastVerdict: "not-reviewed", lastReviewedAt: null, unresolvedConcernIds: [] });
  stateIndex.history = [...(Array.isArray(stateIndex.history) ? stateIndex.history : []), loopRecord];
  stateIndex.lastVerdict = status;
  stateIndex.lastReviewedAt = timestamp;
  writeJson(root, ARTIFACT_PATHS.reviewState, stateIndex);
  appendText(root, ARTIFACT_PATHS.reviewLog, `## ${timestamp} — dove-review-loop\n\n- Run: ${runId}\n- Packet: ${target.packetId}\n- Status: ${status}\n- Stop reason: ${stopReason}\n- Iterations: ${iterations.length}/${maxIterations}\n\n`);
  const responseLanguage = resolveDoveResponseLanguage(root, args);
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
    nextAction: status === "coherent" ? "project:dove.status" : "project:dove.review",
    routeHint: "project:dove.review",
    workflowKind: "review-loop",
    domain: target.packet?.domain ?? null,
    stage: target.packet?.stage ?? "audit",
    tags: ["review", "audio", "experience", "iteration"],
    statusSummary: { status, stopReason, iterationCount: iterations.length, maxIterations }
  });
  const resultCard = buildCommandResultCard({
    surface: "dove.review-loop",
    command: "run_dove_review_loop",
    title: localizedText(responseLanguage, "review-loop 已停止", "Review loop stopped"),
    status,
    stopReason,
    happened: reviewLoopStopSummary(status, stopReason, responseLanguage),
    durableWrites: [localizedText(responseLanguage, "审核状态和审核日志已更新。", "Review state and review log were updated.")],
    evidence: iterations.length > 0 ? [localizedText(responseLanguage, `本轮完成 ${iterations.length} 次检查。`, `Completed ${iterations.length} checks in this pass.`)] : [],
    validation: [reviewLoopStopSummary(status, stopReason, responseLanguage)],
    scope: { iterations: iterations.length, maxIterations, status },
    nextActions: [{
      title: status === "coherent"
        ? localizedText(responseLanguage, "回到状态页选择下一步", "Return to status for the next step")
        : stopReason === "awaiting-review-output"
          ? localizedText(responseLanguage, "导入审核结果", "Import the review result")
          : localizedText(responseLanguage, "先修复 review 指出的缺口", "Fix the review gaps first"),
      why: status === "coherent"
        ? localizedText(responseLanguage, "当前材料已经通过这一轮检查，可以决定继续写作、归档或进入版本快照。", "This pass is coherent, so the next decision can be drafting, closure, or versioning.")
        : localizedText(responseLanguage, "review-loop 不会隐藏继续跑，卡住时要先补材料或导入审核结果。", "The review loop does not continue in the background; blocked work needs material fixes or review import first.")
    }]
  }, responseLanguage);
  return {
    status,
    preActionGuidance,
    resultCard,
    stopReason,
    packetId: target.packetId,
    runId,
    maxIterations,
    iterations,
    reviewStatePath: ARTIFACT_PATHS.reviewState,
    reviewLogPath: ARTIFACT_PATHS.reviewLog
  };
}
