import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { resolveDoveResponseLanguage } from "./i18n.mjs";
import { refreshDurableSurfaces } from "./navigation.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { buildPreActionGuidance, summarizePreActionGuidance } from "./pre-action-guidance.mjs";
import { buildCommandResultCard } from "./result-cards.mjs";
import { ARTIFACT_PATHS, PACKAGE_VERSION, ROLE_IDS, createContinuationState, createDefaultBoard, createMetaOperatorFollowThroughIndex, normalizeMetaOperatorFollowThroughIndex, resolveResumeCommandForPhase, roleCanActAs } from "./schema.mjs";
import { assertGovernanceMutationRegistered, assertFollowThroughReady, assertNoPolicyOverrideArgs, loadState, nowIso, readJson, readText, saveState, writeJson, writeText, appendText } from "./workspace.mjs";
import { evidencePathProblemFlags } from "./artifact-integrity.mjs";

const ALLOWED_TRANSITIONS = {
  init: ["init", "sources", "research"],
  sources: ["sources", "notes", "research"],
  notes: ["notes", "research", "plan"],
  research: ["research", "plan", "experiments", "review"],
  plan: ["plan", "outline", "research"],
  outline: ["outline", "draft", "research"],
  draft: ["draft", "experiments", "citations", "review"],
  experiments: ["experiments", "draft", "review"],
  citations: ["citations", "review", "draft"],
  review: ["review", "rebuttal", "plan", "research", "draft"],
  rebuttal: ["rebuttal", "versions", "draft"],
  versions: ["versions", "review", "checklist"],
  checklist: ["checklist", "research", "plan", "draft"]
};

const PHASE_ROLE_OWNERS = {
  init: "planner",
  sources: "builder",
  notes: "builder",
  research: "builder",
  plan: "planner",
  outline: "planner",
  draft: "builder",
  experiments: "builder",
  citations: "builder",
  review: "reviewer",
  rebuttal: "builder",
  versions: "planner",
  checklist: "planner"
};

const GOVERNANCE_LIFECYCLE_STATUSES = new Set([
  "queued",
  "active",
  "waiting",
  "blocked",
  "review-needed",
  "ready-for-handoff",
  "stale",
  "archived",
  "archived-with-lineage"
]);

const ACTIVE_WORK_STATUSES = new Set(["in-progress", "active", "current", "working"]);
const WAITING_WORK_STATUSES = new Set(["pending", "planned", "queued", "open", "paused", "blocked"]);
const REVIEW_WORK_STATUSES = new Set(["review-needed", "needs-review", "awaiting-review", "review"]);
const TERMINAL_TASK_STATUSES = new Set(["done", "cancelled"]);
const TERMINAL_BLOCKER_STATUSES = new Set(["resolved", "retired"]);

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)))
    : [];
}

function localizedText(responseLanguage, zh, en) {
  return responseLanguage === "en" ? en : zh;
}

function workflowGuidanceSummary(root, args = {}, details = {}) {
  const packet = details.packet ?? null;
  const stage = details.stage ?? packet?.stage ?? null;
  const domain = details.domain ?? packet?.domain ?? null;
  return summarizePreActionGuidance(buildPreActionGuidance({
    surface: details.surface,
    responseLanguage: resolveDoveResponseLanguage(root, args),
    request: details.request ?? args.goal ?? args.objective ?? args.title ?? args.summary ?? args.scope ?? null,
    roleId: details.roleId,
    subagentSpecialty: details.subagentSpecialty,
    packet,
    currentContext: {
      domain,
      stage,
      primaryRole: details.roleId ?? null
    },
    operatorLessons: readJson(root, ARTIFACT_PATHS.metaOperatorLessons, { lessons: [] }),
    nextAction: details.nextAction ?? null,
    routeHint: details.routeHint ?? details.nextAction ?? null,
    workflowKind: details.workflowKind,
    domain,
    stage,
    tags: details.tags ?? [],
    statusSummary: details.statusSummary
  }));
}

function openRebuttalIssueCount(items = []) {
  return items.filter((issue) => issue.status !== "resolved").length;
}

function rebuttalIssuesResultCard(root, args = {}, items = []) {
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const openIssues = openRebuttalIssueCount(items);
  return buildCommandResultCard({
    surface: "dove.review",
    command: "normalize_rebuttal_issues",
    title: localizedText(responseLanguage, "审稿问题已整理", "Review issues organized"),
    status: openIssues > 0 ? "needs-rebuttal" : "coherent",
    happened: items.length > 0
      ? localizedText(responseLanguage, `已把 ${items.length} 条审稿问题整理成回应清单。`, `Organized ${items.length} review issues into a response list.`)
      : localizedText(responseLanguage, "当前没有可整理的审稿问题。", "No review issues were available to organize."),
    durableWrites: [localizedText(responseLanguage, "审稿问题清单和下一步工作状态已更新。", "Review issue list and next-step work state were updated.")],
    evidence: items.length > 0 ? [localizedText(responseLanguage, `其中 ${openIssues} 条还需要回应或修订。`, `${openIssues} still need a response or revision.`)] : [],
    validation: [openIssues > 0
      ? localizedText(responseLanguage, "回应前还要逐条绑定证据或明确缺口。", "Each response still needs evidence or an explicit gap before finalizing.")
      : localizedText(responseLanguage, "没有新的待回应问题。", "There are no new response items.")],
    scope: { issueCount: items.length, openIssues },
    nextActions: [{
      title: openIssues > 0
        ? localizedText(responseLanguage, "整理回应策略", "Build the response strategy")
        : localizedText(responseLanguage, "回到状态页选择下一步", "Return to status for the next step"),
      why: openIssues > 0
        ? localizedText(responseLanguage, "问题已经归并，下一步要决定哪些改正文、哪些补实验、哪些只澄清。", "The issues are grouped; next decide what needs text changes, experiments, or clarification.")
        : localizedText(responseLanguage, "没有待回应问题时，应回到整体状态决定继续写作、review 或收尾。", "With no response items, return to the overall status and choose drafting, review, or closure.")
    }]
  }, responseLanguage);
}

function rebuttalStrategyResultCard(root, args = {}, issueCount = 0) {
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  return buildCommandResultCard({
    surface: "dove.rebuttal",
    command: "build_rebuttal_strategy",
    title: localizedText(responseLanguage, "回应策略已形成", "Response strategy drafted"),
    status: "drafted",
    happened: localizedText(responseLanguage, `已围绕 ${issueCount} 条问题形成回应策略和回复草稿。`, `Drafted a response strategy and reply text for ${issueCount} issues.`),
    durableWrites: [localizedText(responseLanguage, "回应策略和回复草稿已更新。", "Response strategy and reply draft were updated.")],
    evidence: [localizedText(responseLanguage, "每条回应仍需要最终核对证据和措辞。", "Each response still needs final evidence and wording checks.")],
    validation: [localizedText(responseLanguage, "最终发送前还需要独立 review。", "An independent review is still needed before finalizing.")],
    scope: { issueCount },
    nextActions: [{
      title: localizedText(responseLanguage, "送去 review 检查回应是否站得住", "Review whether the responses hold up"),
      why: localizedText(responseLanguage, "回应草稿已经有了，下一步要确认它没有过度承诺，也没有缺证据。", "The response draft exists; next confirm it does not over-promise or lack evidence.")
    }]
  }, responseLanguage);
}

export function missingRebuttalIssuesResult(root, args = {}, command = "build_rebuttal_strategy") {
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const requiredActions = ["review-or-import-rebuttal-issues", "normalize-rebuttal-issues"];
  const boundary = {
    id: "rebuttal-normalized-issues-required",
    type: "missing-required-materials",
    reason: "At least one real issue in the canonical normalized rebuttal issues index is required before rebuttal artifacts can be written.",
    requiredInputs: [ARTIFACT_PATHS.rebuttalIssues],
    requiredActions,
    artifactRefs: [],
    nextAction: "project:dove.review",
    ownerRole: "reviewer",
    nextRole: "reviewer"
  };
  return {
    status: "missing-required-materials",
    issueCount: 0,
    boundary,
    boundaryType: boundary.type,
    requiredActions,
    artifactRefs: [],
    nextAction: boundary.nextAction,
    artifacts: [],
    resultCard: buildCommandResultCard({
      surface: "dove.rebuttal",
      command,
      title: localizedText(responseLanguage, "缺少规范化审稿问题", "Normalized review issues required"),
      status: "missing-required-materials",
      happened: localizedText(responseLanguage, "未写入回应策略、回复草稿或 rebuttal draft。", "No response strategy, response draft, or rebuttal draft was written."),
      durableWrites: [],
      boundary,
      nextActions: [{
        title: localizedText(responseLanguage, "先 review 并规范化问题", "Review and normalize issues first"),
        why: localizedText(responseLanguage, "回应必须以 canonical normalized issues index 中的真实问题为前置材料。", "A rebuttal requires real issues from the canonical normalized issues index as prerequisite material.")
      }]
    }, responseLanguage)
  };
}

function versionSnapshotResultCard(root, args = {}, snapshot = {}, { sectionCount = 0, claimCount = 0, reviewVerdict = "not-reviewed" } = {}) {
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  return buildCommandResultCard({
    surface: "dove.version",
    command: "create_version_snapshot",
    title: localizedText(responseLanguage, "版本快照已创建", "Version snapshot created"),
    status: "snapshot-created",
    happened: localizedText(responseLanguage, "已保存当前论文和任务状态，作为后续比较基线。", "Saved the current paper and task state as a comparison baseline."),
    durableWrites: [localizedText(responseLanguage, "版本记录和项目导航已更新。", "Version records and project navigation were updated.")],
    evidence: [localizedText(responseLanguage, `当前纳入 ${sectionCount} 个章节和 ${claimCount} 条论点。`, `Captured ${sectionCount} sections and ${claimCount} claims.`)],
    validation: [reviewVerdict === "coherent"
      ? localizedText(responseLanguage, "最近 review 状态显示材料基本自洽。", "The latest review state says the material is coherent.")
      : localizedText(responseLanguage, "快照只是记录当前状态，不代表 review 已通过。", "The snapshot records current state; it does not mean review has passed.")],
    scope: { label: snapshot.label ?? null, sectionCount, claimCount, review: reviewVerdict },
    nextActions: [{
      title: localizedText(responseLanguage, "需要时再比较两个版本", "Compare versions when needed"),
      why: localizedText(responseLanguage, "快照已经成为基线；只有方向或材料有变化时，比较才有价值。", "The snapshot is now a baseline; comparison matters when direction or material changes.")
    }]
  }, responseLanguage);
}

function versionComparisonResultCard(root, args = {}, comparison = {}) {
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const changedSections = comparison.changedDraftSections?.length ?? 0;
  const addedClaims = comparison.addedClaimIds?.length ?? 0;
  const addedEvidence = comparison.addedEvidenceLinks?.length ?? 0;
  const addedCitations = comparison.addedCitationKeys?.length ?? 0;
  const concernDelta = (comparison.unresolvedConcernsAdded?.length ?? 0) + (comparison.unresolvedConcernsRemoved?.length ?? 0);
  const hasMaterialChanges = Boolean(comparison.objectiveChanged || comparison.thesisChanged || comparison.verdictChanged || changedSections > 0 || addedClaims > 0 || addedEvidence > 0 || addedCitations > 0 || concernDelta > 0);
  return buildCommandResultCard({
    surface: "dove.version",
    command: "compare_versions",
    title: localizedText(responseLanguage, "版本差异已整理", "Version differences summarized"),
    status: hasMaterialChanges ? "changed" : "no-material-change",
    happened: hasMaterialChanges
      ? localizedText(responseLanguage, "已整理两个版本之间的关键变化。", "Summarized the key differences between the two versions.")
      : localizedText(responseLanguage, "两个版本之间没有发现关键变化。", "No material difference was found between the two versions."),
    durableWrites: [localizedText(responseLanguage, "版本比较摘要已更新。", "Version comparison summary was updated.")],
    evidence: [localizedText(responseLanguage, `变化包括 ${changedSections} 个草稿段落、${addedClaims} 条新增论点、${addedEvidence} 条新增证据。`, `Changes include ${changedSections} draft sections, ${addedClaims} new claims, and ${addedEvidence} new evidence items.`)],
    validation: [comparison.objectiveChanged || comparison.thesisChanged
      ? localizedText(responseLanguage, "目标或核心论点发生变化，需要人工确认方向。", "The objective or thesis changed, so the direction needs operator confirmation.")
      : localizedText(responseLanguage, "目标和核心论点没有变化。", "The objective and thesis did not change.")],
    scope: { changedSections, addedClaims, addedEvidence, addedCitations, concernDelta, reviewChanged: Boolean(comparison.verdictChanged) },
    nextActions: [{
      title: hasMaterialChanges
        ? localizedText(responseLanguage, "把差异转成修订说明", "Turn the differences into a revision note")
        : localizedText(responseLanguage, "回到状态页选择下一步", "Return to status for the next step"),
      why: hasMaterialChanges
        ? localizedText(responseLanguage, "比较已经说明哪里变了，下一步要解释这些变化是否改善了论文。", "The comparison shows what changed; next explain whether those changes improved the paper.")
        : localizedText(responseLanguage, "没有关键差异时，不需要为版本比较制造额外工作。", "With no material difference, do not create extra versioning work.")
    }]
  }, responseLanguage);
}

function isIsoTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function normalizeLifecycleStatus(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return GOVERNANCE_LIFECYCLE_STATUSES.has(normalized) ? normalized : null;
}

function normalizeUpdatedAt(value) {
  return isIsoTimestamp(value) ? value : null;
}

function packetHasLineageLinks(item = {}) {
  return [
    item.parentPacketId,
    ...(item.childPacketIds ?? []),
    ...(item.claimIds ?? []),
    ...(item.noteIds ?? []),
    ...(item.experimentIds ?? []),
    ...(item.rebuttalIssueIds ?? []),
    ...(item.versionIds ?? []),
    ...(item.outputPaths ?? []),
    ...(item.evidenceLinks ?? [])
  ].filter(Boolean).length > 0;
}

function deriveGovernanceLifecycle({
  kind,
  status,
  explicitLifecycleStatus,
  blockedBy = [],
  continuationState = {},
  updatedAt,
  assignedRole,
  boardAssignedRole,
  hasLineage = false
} = {}) {
  const explicit = normalizeLifecycleStatus(explicitLifecycleStatus);
  if (explicit) {
    return explicit;
  }

  const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : "pending";
  const continuationStatus = typeof continuationState?.status === "string"
    ? continuationState.status.trim().toLowerCase()
    : "";
  const normalizedUpdatedAt = normalizeUpdatedAt(updatedAt) ?? normalizeUpdatedAt(continuationState?.updatedAt);
  const ageMs = normalizedUpdatedAt ? Date.now() - Date.parse(normalizedUpdatedAt) : 0;
  const isStale = ageMs > 1000 * 60 * 60 * 24 * 7;
  const terminalStatuses = kind === "blocker" ? TERMINAL_BLOCKER_STATUSES : TERMINAL_TASK_STATUSES;

  if (terminalStatuses.has(normalizedStatus) || continuationStatus === "completed") {
    return hasLineage ? "archived-with-lineage" : "archived";
  }
  if (REVIEW_WORK_STATUSES.has(normalizedStatus) || continuationStatus === "review-needed") {
    return "review-needed";
  }
  if (blockedBy.length > 0 || continuationStatus === "blocked") {
    return normalizedStatus === "blocked" ? "blocked" : "waiting";
  }
  if (assignedRole && boardAssignedRole && assignedRole !== boardAssignedRole && !WAITING_WORK_STATUSES.has(normalizedStatus)) {
    return "ready-for-handoff";
  }
  if (isStale) {
    return "stale";
  }
  if (ACTIVE_WORK_STATUSES.has(normalizedStatus) || continuationStatus === "in-progress") {
    return "active";
  }
  if (WAITING_WORK_STATUSES.has(normalizedStatus) || continuationStatus === "ready-to-resume") {
    return "waiting";
  }
  return "queued";
}

function hashText(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function transitionAllowed(fromPhase, toPhase) {
  const allowed = ALLOWED_TRANSITIONS[fromPhase] ?? [fromPhase];
  return allowed.includes(toPhase);
}

function expectedRoleForPhase(phase) {
  return PHASE_ROLE_OWNERS[phase] ?? "planner";
}

function targetArtifactContainsId(root, artifactPath, targetId) {
  if (!artifactPath || !targetId) {
    return false;
  }
  const fullPath = path.join(root, artifactPath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  const extension = path.extname(artifactPath).toLowerCase();
  if (extension === ".json") {
    try {
      const value = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      const queue = [value];
      while (queue.length > 0) {
        const current = queue.shift();
        if (current === targetId) {
          return true;
        }
        if (Array.isArray(current)) {
          queue.push(...current);
          continue;
        }
        if (current && typeof current === "object") {
          queue.push(...Object.values(current));
        }
      }
      return false;
    } catch {
      return false;
    }
  }
  return fs.readFileSync(fullPath, "utf8").includes(String(targetId));
}

function assertNoBlockingFollowThrough(root, currentPhase, nextPhase, currentAssignedRole, nextAssignedRole) {
  const changingGovernance = currentPhase !== nextPhase || currentAssignedRole !== nextAssignedRole;
  if (!changingGovernance) {
    return;
  }
  const followThrough = normalizeMetaOperatorFollowThroughIndex(readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, createMetaOperatorFollowThroughIndex));
  const items = Array.isArray(followThrough.items) ? followThrough.items : [];
  const actionRequired = items.filter((item) => {
    const status = item.status;
    const invalidStatus = Boolean(item.invalidStatus) || !["acknowledged", "accepted-for-execution", "executing", "deferred", "accepted-risk", "closed", "superseded"].includes(status);
    const dueDeferred = status === "deferred" && item.deferUntil && String(item.deferUntil) <= nowIso();
    const targetBound = !["accepted-for-execution", "executing", "closed"].includes(status)
      ? true
      : targetArtifactContainsId(root, item.linkedTargetArtifact, item.linkedTargetId);
    const acceptedExecutionOpen = status === "accepted-for-execution" || status === "executing";
    return invalidStatus || Boolean(item.stale) || dueDeferred || !targetBound || acceptedExecutionOpen;
  }).map((item) => ({
    id: item.id,
    status: item.status,
    linkedTargetArtifact: item.linkedTargetArtifact,
    linkedTargetId: item.linkedTargetId
  }));
  if (actionRequired.length > 0) {
    throw new Error(`Cannot advance orchestration from ${currentPhase} to ${nextPhase} while operator follow-through still requires action: ${actionRequired.map((item) => item.id).join(", ")}.`);
  }
}

function formatExpectedRoleMessage(actionLabel, phase, role) {
  return `${actionLabel} requires routing role ${role} for phase ${phase}. Use appendHandoff or upsertOrchestrationBoard to record a valid workflow state transition.`;
}

function assertPhaseRoleOwnership(phase, role, actionLabel) {
  const expectedRole = expectedRoleForPhase(phase);
  if (!roleCanActAs(role, expectedRole)) {
    throw new Error(formatExpectedRoleMessage(actionLabel, phase, expectedRole));
  }
}

function assertLegalTransition(currentPhase, nextPhase, strictMode) {
  if (!strictMode || !currentPhase || !nextPhase) {
    return;
  }
  if (!transitionAllowed(currentPhase, nextPhase)) {
    throw new Error(`Illegal orchestration phase transition: ${currentPhase} -> ${nextPhase}`);
  }
}

function validateBoardMutation(currentBoard, nextPhase, nextAssignedRole, strictMode, actionLabel) {
  assertLegalTransition(currentBoard.currentPhase, nextPhase, strictMode);
  assertPhaseRoleOwnership(nextPhase, nextAssignedRole, actionLabel);
}

export function classifyWorkflowIntent({ phase, tasks = [], blockers = [] } = {}) {
  const hasOpenBlockers = blockers.some((blocker) => blocker.status !== "resolved" && blocker.status !== "retired");
  if (hasOpenBlockers) {
    return "repair";
  }
  switch (phase) {
    case "sources":
    case "notes":
    case "research":
      return "research";
    case "plan":
    case "outline":
      return "plan";
    case "draft":
      return tasks.some((task) => task.status === "done") ? "review" : "write";
    case "experiments":
      return "experiment";
    case "review":
      return "review";
    case "rebuttal":
      return "respond";
    case "versions":
      return "version";
    case "checklist":
      return "finalize";
    default:
      return "plan";
  }
}

function defaultFocusForPhase(phase, board = {}) {
  const firstActiveTask = (board.tasks ?? []).find((task) => !["done", "cancelled"].includes(task.status));
  const firstOpenBlocker = (board.blockers ?? []).find((blocker) => blocker.status !== "resolved");
  if (firstOpenBlocker) {
    return `Resolve blocker: ${firstOpenBlocker.summary}`;
  }
  if (firstActiveTask) {
    return firstActiveTask.title;
  }
  switch (phase) {
    case "research":
      return "Build the evidence base before stronger claims.";
    case "plan":
      return "Convert evidence into a concrete paper plan.";
    case "outline":
      return "Turn the plan into section-level structure.";
    case "draft":
      return "Draft the next section without inventing support.";
    case "experiments":
      return "Run or audit claim-linked experiments.";
    case "review":
      return "Stress-test claims, citations, and draft integrity.";
    case "rebuttal":
      return "Address reviewer concerns with evidence-backed responses.";
    case "versions":
      return "Snapshot and compare the paper honestly.";
    default:
      return "Align the durable workflow state.";
  }
}

function defaultNextActionForPhase(phase) {
  switch (phase) {
    case "sources":
      return "Register or update the next durable source.";
    case "notes":
      return "Capture a structured note tied to sources.";
    case "research":
      return "Refresh the research brief and evidence backlog.";
    case "plan":
      return "Update the plan with evidence gaps and milestones.";
    case "outline":
      return "Update the outline before drafting.";
    case "draft":
      return "Draft the next section and leave explicit citation TODOs where support is missing.";
    case "experiments":
      return "Record the next experiment result, then audit it.";
    case "review":
      return "Run or refresh the review loop before finalizing claims.";
    case "rebuttal":
      return "Normalize reviewer concerns and draft the response plan.";
    case "versions":
      return "Create or compare a version snapshot.";
    case "checklist":
      return "Run verification and refresh the checklist.";
    default:
      return "Refresh the board and choose the next role-owned step.";
  }
}

function normalizeCheckpoint(checkpoint, index = 0) {
  if (typeof checkpoint === "string") {
    return {
      id: `checkpoint-${index + 1}`,
      summary: checkpoint,
      recordedAt: nowIso()
    };
  }
  return {
    id: slugify(checkpoint?.id ?? checkpoint?.summary ?? `checkpoint-${index + 1}`),
    summary: checkpoint?.summary ?? `Checkpoint ${index + 1}`,
    recordedAt: checkpoint?.recordedAt ?? nowIso()
  };
}

function mergeContinuationState(current, incoming, defaults = {}) {
  const base = createContinuationState(current);
  if (!incoming || typeof incoming !== "object") {
    return {
      ...base,
      status: defaults.status ?? base.status,
      lastCheckpoint: defaults.lastCheckpoint ?? base.lastCheckpoint,
      updatedAt: nowIso()
    };
  }
  const history = Array.isArray(incoming.checkpointHistory)
    ? incoming.checkpointHistory.map(normalizeCheckpoint)
    : base.checkpointHistory;
  return {
    ...base,
    ...incoming,
    checkpointHistory: history,
    status: incoming.status ?? defaults.status ?? base.status,
    lastCheckpoint: incoming.lastCheckpoint ?? defaults.lastCheckpoint ?? base.lastCheckpoint,
    updatedAt: nowIso()
  };
}

function normalizeTask(task = {}, index = 0, boardAssignedRole = null) {
  const id = slugify(task.id ?? task.title ?? `task-${index + 1}`);
  const updatedAt = normalizeUpdatedAt(task.updatedAt) ?? nowIso();
  const hasLineage = packetHasLineageLinks(task);
  return {
    id,
    packetId: task.packetId ? slugify(task.packetId) : undefined,
    parentPacketId: task.parentPacketId ? slugify(task.parentPacketId) : null,
    childPacketIds: normalizeStringArray(task.childPacketIds),
    phaseContextId: task.phaseContextId ?? null,
    title: task.title ?? `Task ${index + 1}`,
    status: task.status ?? "pending",
    lifecycleStatus: deriveGovernanceLifecycle({
      kind: "task",
      status: task.status,
      explicitLifecycleStatus: task.lifecycleStatus,
      blockedBy: normalizeStringArray(task.blockedBy),
      continuationState: task.continuationState,
      updatedAt: task.updatedAt,
      assignedRole: task.assignedRole,
      boardAssignedRole,
      hasLineage
    }),
    assignedRole: ROLE_IDS.includes(task.assignedRole) ? task.assignedRole : "planner",
    currentFocus: task.currentFocus ?? task.title ?? `Task ${index + 1}`,
    nextAction: task.nextAction ?? "Continue the assigned task and refresh durable state.",
    continuationState: mergeContinuationState(task.continuationState, task.continuationState, {
      status: task.status === "done" ? "completed" : task.status === "blocked" ? "blocked" : "in-progress",
      lastCheckpoint: task.notes || task.title || `Task ${index + 1}`
    }),
    evidenceLinks: normalizeStringArray(task.evidenceLinks),
    claimIds: normalizeStringArray(task.claimIds),
    noteIds: normalizeStringArray(task.noteIds),
    experimentIds: normalizeStringArray(task.experimentIds),
    rebuttalIssueIds: normalizeStringArray(task.rebuttalIssueIds),
    versionIds: normalizeStringArray(task.versionIds),
    blockedBy: normalizeStringArray(task.blockedBy),
    outputPaths: normalizeStringArray(task.outputPaths),
    questions: Array.isArray(task.questions) ? task.questions : [],
    decisions: Array.isArray(task.decisions) ? task.decisions : [],
    notes: task.notes ?? "",
    updatedAt
  };
}

function normalizeBlocker(blocker = {}, index = 0, boardAssignedRole = null) {
  const id = slugify(blocker.id ?? blocker.summary ?? `blocker-${index + 1}`);
  const updatedAt = normalizeUpdatedAt(blocker.updatedAt) ?? nowIso();
  const hasLineage = packetHasLineageLinks(blocker);
  return {
    id,
    packetId: blocker.packetId ? slugify(blocker.packetId) : undefined,
    parentPacketId: blocker.parentPacketId ? slugify(blocker.parentPacketId) : null,
    childPacketIds: normalizeStringArray(blocker.childPacketIds),
    phaseContextId: blocker.phaseContextId ?? null,
    summary: blocker.summary ?? `Blocker ${index + 1}`,
    status: blocker.status ?? "open",
    lifecycleStatus: deriveGovernanceLifecycle({
      kind: "blocker",
      status: blocker.status,
      explicitLifecycleStatus: blocker.lifecycleStatus,
      blockedBy: normalizeStringArray(blocker.blockedBy),
      continuationState: blocker.continuationState,
      updatedAt: blocker.updatedAt,
      assignedRole: blocker.assignedRole,
      boardAssignedRole,
      hasLineage
    }),
    assignedRole: ROLE_IDS.includes(blocker.assignedRole) ? blocker.assignedRole : "planner",
    currentFocus: blocker.currentFocus ?? blocker.summary ?? `Blocker ${index + 1}`,
    nextAction: blocker.nextAction ?? "Resolve the blocker before moving downstream.",
    continuationState: mergeContinuationState(blocker.continuationState, blocker.continuationState, {
      status: blocker.status === "resolved" ? "completed" : "blocked",
      lastCheckpoint: blocker.summary ?? `Blocker ${index + 1}`
    }),
    evidenceLinks: normalizeStringArray(blocker.evidenceLinks),
    claimIds: normalizeStringArray(blocker.claimIds),
    noteIds: normalizeStringArray(blocker.noteIds),
    experimentIds: normalizeStringArray(blocker.experimentIds),
    rebuttalIssueIds: normalizeStringArray(blocker.rebuttalIssueIds),
    versionIds: normalizeStringArray(blocker.versionIds),
    blockedBy: normalizeStringArray(blocker.blockedBy),
    outputPaths: normalizeStringArray(blocker.outputPaths),
    questions: Array.isArray(blocker.questions) ? blocker.questions : [],
    decisions: Array.isArray(blocker.decisions) ? blocker.decisions : [],
    updatedAt
  };
}

function computeUnresolvedBlockersByRole(blockers = []) {
  const grouped = {};
  for (const blocker of blockers.filter((item) => item.status !== "resolved" && item.status !== "retired")) {
    grouped[blocker.assignedRole] ??= [];
    grouped[blocker.assignedRole].push(blocker.id);
  }
  return grouped;
}

function renderHandoffEntry({ timestamp, fromRole, toRole, phase, intentType, summary, currentFocus, nextAction, nextActions, evidenceLinks, blockerIds }) {
  return [
    `\n## ${timestamp} — ${fromRole} -> ${toRole}`,
    "",
    `- Phase: ${phase}`,
    `- Intent: ${intentType}`,
    `- Summary: ${summary}`,
    `- Current focus: ${currentFocus}`,
    `- Next action: ${nextAction}`,
    "- Next actions:",
    ...(nextActions.length > 0 ? nextActions.map((item) => `  - ${item}`) : ["  - None recorded"]),
    `- Evidence links: ${evidenceLinks.join(", ") || "none"}`,
    `- Blockers: ${blockerIds.join(", ") || "none"}`,
    ""
  ].filter(Boolean).join("\n");
}

function appendHandoffEntry(root, payload) {
  const existing = readText(root, ARTIFACT_PATHS.orchestrationHandoffs, "");
  writeText(root, ARTIFACT_PATHS.orchestrationHandoffs, `${existing}${renderHandoffEntry(payload)}`.replace(/^\n+/, ""));
}

function collectDraftSnapshot(root, sections) {
  return Object.fromEntries(
    Object.entries(sections).map(([sectionId, section]) => {
      const relativePath = section.draftPath ?? `${ARTIFACT_PATHS.draftsDir}/${sectionId}.md`;
      const content = readText(root, relativePath, "");
      return [sectionId, {
        draftPath: relativePath,
        contentHash: content ? hashText(content) : null,
        citedKeys: Array.from(new Set(content.match(/\[cite:[^\]]+\]/g)?.map((item) => item.slice(6, -1).trim()) ?? []))
      }];
    })
  );
}

function ensureTask(tasks, task) {
  const normalized = normalizeTask(task);
  const existingIndex = tasks.findIndex((item) => item.id === normalized.id);
  if (existingIndex >= 0) {
    const next = [...tasks];
    next[existingIndex] = { ...next[existingIndex], ...normalized };
    return next;
  }
  return [...tasks, normalized];
}

function ensureBlocker(blockers, blocker) {
  const normalized = normalizeBlocker(blocker);
  const existingIndex = blockers.findIndex((item) => item.id === normalized.id);
  if (existingIndex >= 0) {
    const next = [...blockers];
    next[existingIndex] = { ...next[existingIndex], ...normalized };
    return next;
  }
  return [...blockers, normalized];
}

function renderClaimsMarkdown(claims) {
  return [
    "# Claims from results",
    "",
    ...claims.flatMap((claim) => [
      `## ${claim.id}`,
      "",
      `- Text: ${claim.text}`,
      `- Section: ${claim.sectionId}`,
      `- Source IDs: ${claim.sourceIds.join(", ") || "none"}`,
      `- Note IDs: ${claim.noteIds.join(", ") || "none"}`,
      `- Experiment IDs: ${claim.experimentIds.join(", ") || "none"}`,
      `- Evidence links: ${claim.evidenceLinks.join(", ") || "none"}`,
      `- Status: ${claim.status}`,
      `- Confidence: ${claim.confidence}`,
      claim.latestAuditId ? `- Latest audit: ${claim.latestAuditId}` : null,
      claim.latestAuditVerdict ? `- Latest audit verdict: ${claim.latestAuditVerdict}` : null,
      claim.latestBridgeId ? `- Latest bridge event: ${claim.latestBridgeId}` : null,
      claim.bridgeStatus ? `- Bridge status: ${claim.bridgeStatus}` : null,
      claim.gap ? `- Gap: ${claim.gap}` : null,
      ""
    ].filter(Boolean))
  ].join("\n");
}

function collectFinalizeBlockersFromClaims(root) {
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
  const bridgeLog = readJson(root, ARTIFACT_PATHS.claimBridgeLog, { version: 1, items: [], updatedAt: null });
  const bridgeById = new Map((bridgeLog.items ?? []).map((item) => [item.id, item]));
  const heldBridgeClaimIds = new Set((bridgeLog.items ?? [])
    .filter((bridge) => bridge.bridgeStatus === "held-for-review" || bridge.auditVerdict === "blocked")
    .map((bridge) => bridge.claimId)
    .filter(Boolean));
  const blockedClaimIds = new Set();

  for (const claim of evidence.claims ?? []) {
    if (!claim || typeof claim !== "object") {
      continue;
    }
    if (claim.bridgeStatus === "held-for-review" || claim.latestAuditVerdict === "blocked" || heldBridgeClaimIds.has(claim.id)) {
      blockedClaimIds.add(claim.id);
      continue;
    }
    const bridge = claim.latestBridgeId ? bridgeById.get(claim.latestBridgeId) : null;
    if ((claim.experimentIds ?? []).length > 0 && !bridge) {
      blockedClaimIds.add(claim.id);
      continue;
    }
    if (!bridge) {
      continue;
    }
    if (bridge.bridgeStatus === "held-for-review" || bridge.auditVerdict === "blocked") {
      blockedClaimIds.add(claim.id);
    }
  }

  return Array.from(blockedClaimIds);
}

function assertFinalizeReviewGate(root, actionLabel) {
  const board = loadBoard(root);
  if (!board.reviewRequiredBeforeFinalize) {
    return;
  }
  const reviewState = readJson(root, ARTIFACT_PATHS.reviewState, { version: 3, history: [], openItems: [], lastVerdict: "not-reviewed", lastReviewedAt: null, unresolvedConcernIds: [] });
  const concerns = readJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 2, items: [], updatedAt: null });
  const unresolvedConcernIds = new Set((reviewState.unresolvedConcernIds ?? []).concat((concerns.items ?? []).filter((item) => !["resolved", "retired"].includes(item.status)).map((item) => item.id)));
  const reviewIsClear = reviewState.lastVerdict === "coherent" && unresolvedConcernIds.size === 0;
  const blockedClaimIds = collectFinalizeBlockersFromClaims(root);
  if (!reviewIsClear) {
    throw new Error(`${actionLabel} requires a coherent review with no unresolved concerns while reviewRequiredBeforeFinalize is true.`);
  }
  if (blockedClaimIds.length > 0) {
    throw new Error(`${actionLabel} is blocked by experiment integrity: claim(s) ${blockedClaimIds.join(", ")} are held for review. Resolve bridge/audit issues before finalization.`);
  }
}

export function loadBoard(root) {
  return readJson(root, ARTIFACT_PATHS.orchestrationBoard, () => createDefaultBoard(loadState(root)));
}

function syncStateWithBoard(root, board, state = loadState(root)) {
  const nextState = {
    ...state,
    pipeline: {
      ...state.pipeline,
      currentStage: board.currentPhase,
      lastCompletedStage: board.currentPhase,
      updatedAt: board.updatedAt ?? nowIso(),
      resumeCommand: resolveResumeCommandForPhase(board.currentPhase)
    },
    orchestration: {
      ...state.orchestration,
      phase: board.currentPhase,
      intentType: board.intentType,
      assignedRole: board.assignedRole,
      currentFocus: board.currentFocus,
      nextAction: board.nextAction,
      continuationState: board.continuationState,
      reviewRequiredBeforeFinalize: Boolean(board.reviewRequiredBeforeFinalize),
      activeTaskIds: board.tasks.filter((task) => !["done", "cancelled"].includes(task.status)).map((task) => task.id),
      blockerIds: board.blockers.filter((blocker) => blocker.status !== "resolved").map((blocker) => blocker.id),
      evidenceLinks: normalizeStringArray(board.evidenceLinks),
      experimentIds: normalizeStringArray(board.experimentIds),
      rebuttalIssueIds: normalizeStringArray(board.rebuttalIssueIds),
      currentVersionId: board.versionLineage?.currentVersionId ?? null,
      activeComparisonTargets: normalizeStringArray(board.activeComparisonTargets)
    }
  };
  saveState(root, nextState);
  return nextState;
}

function persistBoard(root, board) {
  const state = loadState(root);
  const withDefaults = { ...createDefaultBoard(state), ...board };
  const tasks = Array.isArray(withDefaults.tasks) ? withDefaults.tasks.map((task, index) => normalizeTask(task, index, withDefaults.assignedRole)) : [];
  const blockers = Array.isArray(withDefaults.blockers) ? withDefaults.blockers.map((blocker, index) => normalizeBlocker(blocker, index, withDefaults.assignedRole)) : [];
  const intentType = withDefaults.intentType ?? classifyWorkflowIntent({ phase: withDefaults.currentPhase, tasks, blockers });
  const currentFocus = withDefaults.currentFocus ?? defaultFocusForPhase(withDefaults.currentPhase, { ...withDefaults, tasks, blockers });
  const nextAction = withDefaults.nextAction ?? defaultNextActionForPhase(withDefaults.currentPhase);
  const continuationState = mergeContinuationState(withDefaults.continuationState, withDefaults.continuationState, {
    status: blockers.some((item) => item.status !== "resolved") ? "blocked" : "ready-to-resume",
    lastCheckpoint: nextAction
  });
  const normalized = {
    ...withDefaults,
    version: 2,
    assignedRole: ROLE_IDS.includes(withDefaults.assignedRole) ? withDefaults.assignedRole : "planner",
    intentType,
    currentFocus,
    nextAction,
    continuationState,
    reviewRequiredBeforeFinalize: Boolean(withDefaults.reviewRequiredBeforeFinalize),
    tasks,
    blockers,
    evidenceLinks: normalizeStringArray(withDefaults.evidenceLinks),
    experimentIds: normalizeStringArray(withDefaults.experimentIds),
    rebuttalIssueIds: normalizeStringArray(withDefaults.rebuttalIssueIds),
    activeComparisonTargets: normalizeStringArray(withDefaults.activeComparisonTargets),
    unresolvedBlockersByRole: computeUnresolvedBlockersByRole(blockers),
    versionLineage: {
      currentVersionId: withDefaults.versionLineage?.currentVersionId ?? null,
      parentVersionId: withDefaults.versionLineage?.parentVersionId ?? null,
      snapshotIds: normalizeStringArray(withDefaults.versionLineage?.snapshotIds)
    },
    updatedAt: nowIso()
  };
  writeJson(root, ARTIFACT_PATHS.orchestrationBoard, normalized);
  syncStateWithBoard(root, normalized);
  refreshDurableSurfaces(root, {
    type: "persist-board",
    summary: `Updated board phase ${normalized.currentPhase} for ${normalized.assignedRole}.`,
    artifactPaths: [ARTIFACT_PATHS.orchestrationBoard, ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.sessionSummary, ARTIFACT_PATHS.workspaceIndex]
  });
  return normalized;
}

function persistOrchestrationBoardUpdate(root, args = {}, { systemOwned = false } = {}) {
  assertNoPolicyOverrideArgs(args, "Updating the orchestration board");
  if (!systemOwned && Object.hasOwn(args, "reviewRequiredBeforeFinalize")) {
    throw new Error("Updating the orchestration board does not accept system-owned field reviewRequiredBeforeFinalize.");
  }
  const state = loadState(root);
  const current = loadBoard(root);
  const nextPhase = args.phase ?? current.currentPhase;
  const nextAssignedRole = args.assignedRole ?? current.assignedRole;
  validateBoardMutation(current, nextPhase, nextAssignedRole, state.settings?.strictMode, "Updating the orchestration board");
  assertNoBlockingFollowThrough(root, current.currentPhase, nextPhase, current.assignedRole, nextAssignedRole);
  const tasks = Array.isArray(args.tasks) ? args.tasks.map((task, index) => normalizeTask(task, index, nextAssignedRole)) : current.tasks;
  const blockers = Array.isArray(args.blockers) ? args.blockers.map((blocker, index) => normalizeBlocker(blocker, index, nextAssignedRole)) : current.blockers;
  const intentType = args.intentType ?? classifyWorkflowIntent({ phase: nextPhase, tasks, blockers });
  const currentFocus = args.currentFocus ?? current.currentFocus ?? defaultFocusForPhase(nextPhase, { tasks, blockers });
  const nextAction = args.nextAction ?? current.nextAction ?? defaultNextActionForPhase(nextPhase);
  const continuationState = mergeContinuationState(current.continuationState, args.continuationState, {
    status: blockers.some((item) => item.status !== "resolved") ? "blocked" : "ready-to-resume",
    lastCheckpoint: nextAction
  });

  if (nextAssignedRole !== current.assignedRole && !args.skipAutoHandoff) {
    appendHandoffEntry(root, {
      timestamp: args.timestamp ?? nowIso(),
      fromRole: current.assignedRole,
      toRole: nextAssignedRole,
      phase: nextPhase,
      intentType,
      summary: args.handoffSummary ?? `Workflow routing moved from ${current.assignedRole} to ${nextAssignedRole}.`,
      currentFocus,
      nextAction,
      nextActions: normalizeStringArray(args.nextActions ?? [nextAction]),
      evidenceLinks: normalizeStringArray(args.evidenceLinks ?? current.evidenceLinks),
      blockerIds: normalizeStringArray(blockers.filter((item) => item.status !== "resolved").map((item) => item.id))
    });
  }

  return persistBoard(root, {
    ...current,
    paperObjective: args.doveObjective ?? args.objective ?? current.doveObjective ?? state.dove.objective,
    currentPhase: nextPhase,
    assignedRole: nextAssignedRole,
    intentType,
    currentFocus,
    nextAction,
    continuationState,
    reviewRequiredBeforeFinalize: Object.hasOwn(args, "reviewRequiredBeforeFinalize")
      ? Boolean(args.reviewRequiredBeforeFinalize)
      : current.reviewRequiredBeforeFinalize,
    tasks,
    blockers,
    evidenceLinks: args.evidenceLinks ? normalizeStringArray(args.evidenceLinks) : current.evidenceLinks,
    experimentIds: args.experimentIds ? normalizeStringArray(args.experimentIds) : current.experimentIds,
    rebuttalIssueIds: args.rebuttalIssueIds ? normalizeStringArray(args.rebuttalIssueIds) : current.rebuttalIssueIds,
    activeComparisonTargets: args.activeComparisonTargets ? normalizeStringArray(args.activeComparisonTargets) : current.activeComparisonTargets,
    versionLineage: {
      currentVersionId: args.versionLineage?.currentVersionId ?? current.versionLineage?.currentVersionId ?? null,
      parentVersionId: args.versionLineage?.parentVersionId ?? current.versionLineage?.parentVersionId ?? null,
      snapshotIds: args.versionLineage?.snapshotIds ? normalizeStringArray(args.versionLineage.snapshotIds) : (current.versionLineage?.snapshotIds ?? [])
    }
  });
}

export function upsertOrchestrationBoard(root, args = {}) {
  return persistOrchestrationBoardUpdate(root, args);
}

export function upsertSystemOrchestrationBoard(root, args = {}) {
  return persistOrchestrationBoardUpdate(root, args, { systemOwned: true });
}

export function appendHandoff(root, args = {}) {
  assertNoPolicyOverrideArgs(args, "Appending a handoff");
  const board = loadBoard(root);
  const state = loadState(root);
  const timestamp = args.timestamp ?? nowIso();
  const fromRole = args.fromRole ?? board.assignedRole;
  const toRole = args.toRole ?? board.assignedRole;
  const phase = args.phase ?? board.currentPhase;
  validateBoardMutation(board, phase, toRole, state.settings?.strictMode, "Appending a handoff");
  if (!roleCanActAs(fromRole, board.assignedRole)) {
    throw new Error(`Appending a handoff requires fromRole ${board.assignedRole}, but received ${fromRole}.`);
  }
  const intentType = args.intentType ?? board.intentType ?? classifyWorkflowIntent({ phase, tasks: board.tasks, blockers: board.blockers });
  const currentFocus = args.currentFocus ?? board.currentFocus;
  const nextAction = args.nextAction ?? board.nextAction;
  appendHandoffEntry(root, {
    timestamp,
    fromRole,
    toRole,
    phase,
    intentType,
    summary: args.summary ?? "No summary provided.",
    currentFocus,
    nextAction,
    nextActions: Array.isArray(args.nextActions) ? args.nextActions : [nextAction],
    evidenceLinks: normalizeStringArray(args.evidenceLinks ?? board.evidenceLinks),
    blockerIds: normalizeStringArray(args.blockerIds ?? board.blockers.filter((item) => item.status !== "resolved").map((item) => item.id))
  });

  return upsertSystemOrchestrationBoard(root, {
    phase,
    assignedRole: toRole,
    intentType,
    currentFocus,
    nextAction,
    evidenceLinks: args.evidenceLinks ?? board.evidenceLinks,
    tasks: board.tasks,
    blockers: board.blockers,
    skipAutoHandoff: true
  });
}

function renderResearchBrief(agenda) {
  return [
    "# Research brief",
    "",
    `## Objective\n\n${agenda.objective}`,
    "",
    "## Agenda",
    "",
    ...(agenda.agenda.length > 0 ? agenda.agenda.map((item) => `- ${item}`) : ["- No research agenda recorded."]),
    "",
    "## Evidence backlog",
    "",
    ...(agenda.evidenceBacklog.length > 0 ? agenda.evidenceBacklog.map((item) => `- ${item}`) : ["- No evidence backlog recorded."])
  ].join("\n");
}

export function updateResearchBrief(root, args = {}) {
  assertGovernanceMutationRegistered("update-research-brief", "guarded");
  assertTaskScopedMutationTarget(root, "update-research-brief", args);
  assertFollowThroughReady(root, "Updating the research brief", args);
  const state = loadState(root);
  const current = readJson(root, ARTIFACT_PATHS.researchAgenda, { version: 1, objective: state.dove.objective, agenda: [], evidenceBacklog: [], updatedAt: null });
  const next = {
    version: 1,
    objective: args.objective ?? current.objective ?? state.dove.objective,
    agenda: args.agenda ? normalizeStringArray(args.agenda) : current.agenda,
    evidenceBacklog: args.evidenceBacklog ? normalizeStringArray(args.evidenceBacklog) : current.evidenceBacklog,
    updatedAt: nowIso()
  };
  writeJson(root, ARTIFACT_PATHS.researchAgenda, next);
  writeText(root, ARTIFACT_PATHS.researchBrief, renderResearchBrief(next));
  upsertSystemOrchestrationBoard(root, {
    objective: next.objective,
    phase: args.phase ?? "research",
    assignedRole: args.assignedRole ?? "builder",
    intentType: "research",
    currentFocus: args.currentFocus ?? "Tighten the research agenda and evidence backlog.",
    nextAction: args.nextAction ?? "Turn backlog items into sources, notes, or experiments.",
    continuationState: {
      status: "in-progress",
      lastCheckpoint: "Research brief refreshed.",
      checkpointHistory: [{ summary: "Research brief refreshed.", recordedAt: nowIso() }]
    }
  });
  refreshDurableSurfaces(root, {
    type: "update-research-brief",
    summary: "Updated research brief and agenda.",
    artifactPaths: [ARTIFACT_PATHS.researchBrief, ARTIFACT_PATHS.researchAgenda, ARTIFACT_PATHS.queryPack]
  });
  return next;
}

function normalizeExperimentPlan(plan = {}, index = 0) {
  return {
    id: slugify(plan.id ?? plan.title ?? `experiment-${index + 1}`),
    title: plan.title ?? `Experiment ${index + 1}`,
    claimId: plan.claimId ?? "",
    hypothesis: plan.hypothesis ?? "",
    methodology: plan.methodology ?? "",
    successMetric: plan.successMetric ?? "",
    comparisonTargets: normalizeStringArray(plan.comparisonTargets),
    status: plan.status ?? "planned",
    owner: ROLE_IDS.includes(plan.owner) ? plan.owner : "builder",
    updatedAt: nowIso()
  };
}

function renderExperimentLog(plans, results, audits = []) {
  return [
    "# Experiment log",
    "",
    "## Planned experiments",
    "",
    ...(plans.length > 0 ? plans.flatMap((plan) => [
      `### ${plan.id} — ${plan.title}`,
      "",
      `- Claim ID: ${plan.claimId || "none"}`,
      `- Hypothesis: ${plan.hypothesis || "TBD"}`,
      `- Methodology: ${plan.methodology || "TBD"}`,
      `- Success metric: ${plan.successMetric || "TBD"}`,
      `- Comparison targets: ${plan.comparisonTargets.join(", ") || "none"}`,
      `- Status: ${plan.status}`,
      ""
    ]) : ["No experiment plans recorded.", ""]),
    "## Recorded results",
    "",
    ...(results.length > 0 ? results.flatMap((result) => [
      `### ${result.id}`,
      "",
      `- Experiment ID: ${result.experimentId}`,
      `- Claim ID: ${result.claimId || "none"}`,
      `- Outcome: ${result.outcome}`,
      `- Summary: ${result.summary || "No summary provided."}`,
      `- Evidence links: ${result.evidenceLinks.join(", ") || "none"}`,
      result.latestAuditId ? `- Latest audit: ${result.latestAuditId}` : null,
      result.latestBridgeId ? `- Latest bridge: ${result.latestBridgeId}` : null,
      ""
    ].filter(Boolean)) : ["No experiment results recorded."]),
    "",
    "## Experiment audits",
    "",
    ...(audits.length > 0 ? audits.slice(-10).reverse().flatMap((audit) => [
      `- ${audit.id}: ${audit.experimentId} [verdict=${audit.auditVerdict ?? "concern"} confidence=${audit.confidence}] flags=${audit.integrityFlags.join(", ") || "none"}`
    ]) : ["- No audits recorded."])
  ].join("\n");
}

function normalizeExperimentResult(result = {}, index = 0) {
  return {
    id: slugify(result.id ?? `${result.experimentId ?? "experiment"}-result-${index + 1}`),
    experimentId: result.experimentId ?? "",
    claimId: result.claimId ?? "",
    outcome: result.outcome ?? "pending",
    summary: result.summary ?? "",
    evidenceLinks: normalizeStringArray(result.evidenceLinks),
    comparisonTargets: normalizeStringArray(result.comparisonTargets),
    latestAuditId: result.latestAuditId ?? null,
    latestBridgeId: result.latestBridgeId ?? null,
    updatedAt: nowIso()
  };
}

function normalizeExperimentAudit(audit = {}, index = 0) {
  return {
    id: slugify(audit.id ?? `${audit.experimentId ?? "experiment"}-audit-${index + 1}`),
    experimentId: audit.experimentId ?? "",
    resultId: audit.resultId ?? "",
    claimId: audit.claimId ?? "",
    reviewedArtifactRefs: normalizeStringArray(audit.reviewedArtifactRefs),
    requiredArtifactRefs: normalizeStringArray(audit.requiredArtifactRefs),
    missingArtifactRefs: normalizeStringArray(audit.missingArtifactRefs),
    auditFindings: Array.isArray(audit.auditFindings) ? audit.auditFindings : [],
    integrityFlags: normalizeStringArray(audit.integrityFlags),
    evidencePathIntegrity: audit.evidencePathIntegrity ?? null,
    confidence: audit.confidence ?? "medium",
    outcomeMapping: audit.outcomeMapping ?? "inconclusive",
    auditVerdict: audit.auditVerdict ?? "concern",
    bridgeReadiness: audit.bridgeReadiness ?? "blocked",
    resultOutcome: audit.resultOutcome ?? "pending",
    evidenceLinkCount: Number.isInteger(audit.evidenceLinkCount) ? audit.evidenceLinkCount : 0,
    comparisonTargetCount: Number.isInteger(audit.comparisonTargetCount) ? audit.comparisonTargetCount : 0,
    claimStateBefore: audit.claimStateBefore ?? null,
    updatedAt: nowIso()
  };
}

function confidenceAfterSupport(current) {
  if (current === "low") return "medium";
  if (current === "medium") return "high";
  return "high";
}

const SYSTEM_OWNED_EXPERIMENT_PROVENANCE_FIELDS = new Set([
  "authorizationProvenance",
  "authorizationProvenanceHistory",
  "authorizationFingerprint",
  "authorityStepId",
  "authorityStepIndex",
  "executionClaimId",
  "runtimeRunId",
  "leaseId"
]);

function collectForbiddenExperimentProvenancePaths(value, path = "", seen = new WeakSet()) {
  if (!value || typeof value !== "object") {
    return [];
  }
  if (seen.has(value)) {
    return [];
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectForbiddenExperimentProvenancePaths(item, `${path}[${index}]`, seen)
    );
  }
  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const fieldPath = path ? `${path}.${key}` : key;
    return [
      ...(SYSTEM_OWNED_EXPERIMENT_PROVENANCE_FIELDS.has(key) ? [fieldPath] : []),
      ...collectForbiddenExperimentProvenancePaths(nestedValue, fieldPath, seen)
    ];
  });
}

function assertNoPublicExperimentProvenance(args = {}, actionLabel) {
  const forbidden = collectForbiddenExperimentProvenancePaths(args);
  if (forbidden.length > 0) {
    throw new Error(
      `${actionLabel} does not accept system-owned runtime provenance fields: ${forbidden.join(", ")}.`
    );
  }
}

function resolveDurableExperimentResult(resultsIndex, args = {}, actionLabel = "Experiment result lookup") {
  if (args.result) {
    const resultId = args.result.id ?? args.resultId;
    if (!resultId) {
      throw new Error(`${actionLabel} requires args.result to include a durable id.`);
    }
    const durable = resultsIndex.items.find((item) => item.id === resultId);
    if (!durable) {
      throw new Error(`${actionLabel} received non-durable result ${resultId}.`);
    }
    for (const field of ["experimentId", "claimId", "outcome"]) {
      if (args.result[field] && durable[field] !== args.result[field]) {
        throw new Error(`${actionLabel} result ${resultId} ${field} does not match durable state.`);
      }
    }
    return durable;
  }
  if (args.resultId) {
    const durable = resultsIndex.items.find((item) => item.id === args.resultId);
    if (!durable) {
      throw new Error(`${actionLabel} could not find result ${args.resultId}.`);
    }
    return durable;
  }
  if (args.experimentId) {
    const matches = resultsIndex.items.filter((item) => item.experimentId === args.experimentId);
    if (matches.length === 1) {
      return matches[0];
    }
    if (matches.length > 1) {
      throw new Error(`${actionLabel} found multiple results for experiment ${args.experimentId}; provide resultId.`);
    }
  }
  throw new Error(`${actionLabel} requires an existing durable resultId.`);
}

export function runExperimentAudit(root, args = {}) {
  assertGovernanceMutationRegistered("run-experiment-audit", "guarded");
  assertNoPublicExperimentProvenance(args, "Public experiment audit mutations");
  const target = assertTaskScopedMutationTarget(root, "run-experiment-audit", args);
  assertFollowThroughReady(root, "Running an experiment audit", args);
  const audit = persistExperimentAudit(root, args);
  return {
    ...audit,
    preActionGuidanceSummary: workflowGuidanceSummary(root, args, {
      surface: "dove.experience",
      roleId: "reviewer",
      packet: target.packet,
      stage: target.packet?.stage ?? "audit",
      workflowKind: "experiment-audit",
      nextAction: audit.bridgeReadiness === "ready" ? "project:dove.experience" : "project:dove.review",
      tags: ["experiment", "audit", "review"],
      statusSummary: { auditId: audit.id, auditVerdict: audit.auditVerdict, bridgeReadiness: audit.bridgeReadiness }
    })
  };
}

function persistExperimentAudit(root, args = {}, runtimeContext = {}) {
  const resultsIndex = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  const plansIndex = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
  const auditsIndex = readJson(root, ARTIFACT_PATHS.experimentAudits, { version: 1, items: [], updatedAt: null });
  const rawResult = resolveDurableExperimentResult(resultsIndex, args, "Experiment audit");
  const linkedPlan = plansIndex.items.find((item) => item.id === rawResult.experimentId);
  const linkedClaim = rawResult.claimId ? evidence.claims.find((item) => item.id === rawResult.claimId) : null;
  const integrityFlags = [];
  const auditFindings = [];
  const requiredArtifactRefs = [ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentLog, ...(rawResult.evidenceLinks ?? [])];
  if (linkedPlan) {
    requiredArtifactRefs.unshift(ARTIFACT_PATHS.experimentPlans);
  }
  const missingArtifactRefs = [];
  if (!linkedPlan) {
    integrityFlags.push("missing-plan");
    auditFindings.push("No linked experiment plan was found.");
  }
  if (!rawResult.claimId) {
    integrityFlags.push("missing-claim-link");
    auditFindings.push("Result is missing an explicit claim link.");
  }
  const evidenceIntegrity = evidencePathProblemFlags(root, rawResult.evidenceLinks ?? []);
  for (const flag of evidenceIntegrity.flags) {
    integrityFlags.push(flag);
  }
  if (evidenceIntegrity.flags.includes("missing-evidence-links")) {
    auditFindings.push("Result has no durable evidence links.");
  }
  if (evidenceIntegrity.flags.includes("missing-evidence-file")) {
    auditFindings.push("Result evidence links do not resolve to an existing local evidence file.");
  }
  if (evidenceIntegrity.flags.includes("empty-evidence-file")) {
    auditFindings.push("Result evidence links include an empty evidence file.");
  }
  if (evidenceIntegrity.flags.includes("directory-evidence-file")) {
    auditFindings.push("Result evidence links include a directory instead of a file.");
  }
  if (evidenceIntegrity.flags.includes("unsafe-evidence-path")) {
    auditFindings.push("Result evidence links include an unsafe path.");
  }
  if (evidenceIntegrity.flags.includes("bookkeeping-evidence-file")) {
    auditFindings.push("Result evidence links cite status, navigation, runtime, task, or ledger bookkeeping rather than experiment output.");
  }
  if (!(rawResult.summary ?? "").trim()) {
    integrityFlags.push("missing-result-summary");
    auditFindings.push("Result summary is empty, making downstream review harder.");
  }
  if (!linkedPlan?.methodology?.trim()) {
    integrityFlags.push("missing-methodology");
    auditFindings.push("Experiment plan is missing methodology details.");
  }
  if (!linkedPlan?.successMetric?.trim()) {
    integrityFlags.push("missing-success-metric");
    auditFindings.push("Experiment plan is missing a success metric.");
  }
  if ((linkedPlan?.comparisonTargets ?? []).length > 0 && (rawResult.comparisonTargets ?? []).length === 0) {
    integrityFlags.push("missing-comparison-context");
    auditFindings.push("Result omitted comparison targets declared in the plan.");
  }
  if (rawResult.outcome === "pending") {
    integrityFlags.push("pending-outcome");
    auditFindings.push("Result is still pending and cannot strongly support a claim yet.");
  }
  const reviewedArtifactRefs = args.reviewedArtifactRefs
    ?? [
      ...(linkedPlan ? [ARTIFACT_PATHS.experimentPlans] : []),
      ARTIFACT_PATHS.experimentResults,
      ARTIFACT_PATHS.experimentLog,
      ...rawResult.evidenceLinks
    ];
  for (const ref of requiredArtifactRefs) {
    if (!reviewedArtifactRefs.includes(ref)) {
      missingArtifactRefs.push(ref);
    }
  }
  if (missingArtifactRefs.length > 0) {
    integrityFlags.push("missing-reviewed-artifact-refs");
    auditFindings.push(`Audit omitted required artifact refs: ${missingArtifactRefs.join(", ")}.`);
  }
  const confidence = integrityFlags.length > 0 ? "low" : rawResult.outcome === "supports" ? "high" : "medium";
  const outcomeMapping = rawResult.outcome === "supports"
    ? "supports"
    : rawResult.outcome === "refutes" || rawResult.outcome === "failed"
      ? "refutes"
      : "inconclusive";
  const auditVerdict = integrityFlags.length === 0
    ? "clean"
    : integrityFlags.some((flag) => ["missing-plan", "missing-claim-link", "missing-evidence-links", "missing-evidence-file", "empty-evidence-file", "directory-evidence-file", "unsafe-evidence-path", "bookkeeping-evidence-file", "unsupported-evidence-file", "unreadable-evidence-file", "missing-methodology", "missing-success-metric", "missing-reviewed-artifact-refs", "pending-outcome"].includes(flag))
      ? "blocked"
      : "concern";
  const audit = normalizeExperimentAudit({
    ...args,
    experimentId: rawResult.experimentId,
    resultId: rawResult.id,
    claimId: rawResult.claimId,
    reviewedArtifactRefs,
    requiredArtifactRefs,
    missingArtifactRefs,
    auditFindings,
    integrityFlags,
    evidencePathIntegrity: evidenceIntegrity.pathEvidence,
    confidence,
    outcomeMapping,
    auditVerdict,
    bridgeReadiness: auditVerdict === "clean" ? "ready" : "blocked",
    resultOutcome: rawResult.outcome,
    evidenceLinkCount: (rawResult.evidenceLinks ?? []).length,
    comparisonTargetCount: (rawResult.comparisonTargets ?? []).length,
    claimStateBefore: linkedClaim ? { status: linkedClaim.status, confidence: linkedClaim.confidence } : null,
    ...(runtimeContext.authorizationProvenance ? { authorizationProvenance: runtimeContext.authorizationProvenance } : {})
  }, auditsIndex.items.length);
  if (runtimeContext.authorizationProvenance) {
    audit.authorizationProvenance = runtimeContext.authorizationProvenance;
  }
  const existingIndex = auditsIndex.items.findIndex((item) => item.id === audit.id);
  if (existingIndex >= 0) {
    const existingAudit = auditsIndex.items[existingIndex];
    const existingProvenance = existingAudit.authorizationProvenance ?? null;
    const nextProvenance = runtimeContext.authorizationProvenance ?? null;
    if ((existingProvenance || nextProvenance) && JSON.stringify(existingProvenance) !== JSON.stringify(nextProvenance)) {
      throw new Error(`Experiment audit ${audit.id} authorization provenance conflicts with durable state.`);
    }
    auditsIndex.items[existingIndex] = audit;
  } else {
    auditsIndex.items.push(audit);
  }
  auditsIndex.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.experimentAudits, auditsIndex);
  return audit;
}

export function bridgeExperimentResultToClaim(root, args = {}) {
  assertGovernanceMutationRegistered("bridge-experiment-result-to-claim", "guarded");
  assertNoPublicExperimentProvenance(args, "Public experiment bridge mutations");
  const target = assertTaskScopedMutationTarget(root, "bridge-experiment-result-to-claim", args);
  assertFollowThroughReady(root, "Bridging an experiment result to a claim", args);
  const bridge = persistExperimentResultClaimBridge(root, args);
  return {
    ...bridge,
    preActionGuidanceSummary: workflowGuidanceSummary(root, args, {
      surface: "dove.experience",
      roleId: "builder",
      subagentSpecialty: "experiment-planner",
      packet: target.packet,
      stage: target.packet?.stage ?? "execute",
      workflowKind: "claim-bridge",
      nextAction: bridge.bridgeStatus === "applied" ? "project:dove.review" : "project:dove.experience",
      tags: ["experiment", "claim-bridge", "evidence"],
      statusSummary: { bridgeId: bridge.id, bridgeStatus: bridge.bridgeStatus, claimId: bridge.claimId }
    })
  };
}

function persistExperimentResultClaimBridge(root, args = {}, runtimeContext = {}) {
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
  const resultsIndex = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  const auditsIndex = readJson(root, ARTIFACT_PATHS.experimentAudits, { version: 1, items: [], updatedAt: null });
  const bridgeLog = readJson(root, ARTIFACT_PATHS.claimBridgeLog, { version: 1, items: [], updatedAt: null });
  const result = resolveDurableExperimentResult(resultsIndex, args, "Result bridge");
  if (!result.claimId) {
    throw new Error(`Claim bridge requires result ${result.id} to include claimId.`);
  }
  if (!(result.summary ?? "").trim()) {
    throw new Error(`Claim bridge requires result ${result.id} to include a durable result summary.`);
  }
  if ((result.evidenceLinks ?? []).length === 0) {
    throw new Error(`Claim bridge requires result ${result.id} to include durable evidence links.`);
  }
  const evidenceIntegrity = evidencePathProblemFlags(root, result.evidenceLinks ?? []);
  if (!evidenceIntegrity.satisfied) {
    throw new Error(`Claim bridge requires substantive local experiment evidence for result ${result.id}; evidence problems: ${evidenceIntegrity.flags.join(", ") || "missing-substantive-evidence"}.`);
  }
  const claimIndex = evidence.claims.findIndex((item) => item.id === result.claimId);
  if (claimIndex === -1) {
    throw new Error(`Claim bridge could not find claim ${result.claimId}`);
  }
  const currentClaim = evidence.claims[claimIndex];
  const currentClaimState = { status: currentClaim.status, confidence: currentClaim.confidence };
  const requestedAuditIds = normalizeStringArray(args.auditIds);
  const auditById = new Map((auditsIndex.items ?? []).map((item) => [item.id, item]));
  const missingAuditIds = requestedAuditIds.filter((id) => !auditById.has(id));
  if (missingAuditIds.length > 0) {
    throw new Error(`Claim bridge requires durable experiment audit records; missing auditIds: ${missingAuditIds.join(", ")}.`);
  }
  const candidateAudits = requestedAuditIds.length > 0
    ? requestedAuditIds.map((id) => auditById.get(id))
    : (auditsIndex.items ?? []).filter((item) => item.resultId === result.id);
  if (candidateAudits.length === 0) {
    throw new Error(`Claim bridge requires at least one durable experiment audit for result ${result.id}.`);
  }
  const mismatchedAudits = candidateAudits.filter((audit) => audit.resultId !== result.id || audit.claimId !== result.claimId);
  if (mismatchedAudits.length > 0) {
    throw new Error(`Claim bridge audit records do not match result ${result.id}: ${mismatchedAudits.map((audit) => audit.id).join(", ")}.`);
  }
  const candidateAuditVerdict = candidateAudits.some((audit) => audit.auditVerdict === "blocked")
    ? "blocked"
    : candidateAudits.some((audit) => audit.auditVerdict === "concern")
      ? "concern"
      : "clean";
  const candidateMapping = candidateAuditVerdict !== "clean"
    ? "integrity-hold"
    : result.outcome === "supports"
      ? "supports"
      : result.outcome === "refutes" || result.outcome === "failed"
        ? "refutes"
        : "inconclusive";
  const candidateBridgeId = slugify(args.id ?? `${result.id}-${candidateMapping}-bridge`);
  const candidateBridge = (bridgeLog.items ?? []).find((item) => item.id === candidateBridgeId) ?? null;
  const resultLinkedBridge = !args.id && result.latestBridgeId
    ? (bridgeLog.items ?? []).find(
        (item) =>
          item.id === result.latestBridgeId
          && item.resultId === result.id
      ) ?? null
    : null;
  if (!args.id && result.latestBridgeId && !resultLinkedBridge) {
    throw new Error(`Claim bridge retry for result ${result.id} cannot find linked bridge ${result.latestBridgeId}.`);
  }
  const existingBridge = candidateBridge ?? resultLinkedBridge;
  const bridgeId = existingBridge?.id ?? candidateBridgeId;
  const implicitResultRetry = Boolean(
    existingBridge
    && !args.id
    && resultLinkedBridge?.id === existingBridge.id
  );
  const existingAuditIds = existingBridge
    ? normalizeStringArray(existingBridge.auditIds)
    : [];
  const audits = implicitResultRetry || (existingBridge && !Object.hasOwn(args, "auditIds"))
    ? existingAuditIds.map((id) => auditById.get(id)).filter(Boolean)
    : candidateAudits;
  if ((implicitResultRetry || (existingBridge && !Object.hasOwn(args, "auditIds"))) && audits.length !== existingAuditIds.length) {
    throw new Error(`Claim bridge ${existingBridge.id} references missing durable experiment audit records.`);
  }
  const auditIds = audits.map((audit) => audit.id);
  const auditVerdict = audits.some((audit) => audit.auditVerdict === "blocked")
    ? "blocked"
    : audits.some((audit) => audit.auditVerdict === "concern")
      ? "concern"
      : "clean";
  const aggregatedIntegrityFlags = Array.from(new Set(audits.flatMap((audit) => audit.integrityFlags ?? [])));
  const mapping = auditVerdict !== "clean"
    ? "integrity-hold"
    : result.outcome === "supports"
      ? "supports"
      : result.outcome === "refutes" || result.outcome === "failed"
        ? "refutes"
        : "inconclusive";
  const before = existingBridge?.claimStateBefore ?? currentClaimState;
  const bridgeStatus = auditVerdict === "clean" ? "applied" : "held-for-review";
  let after = { ...before };
  let stateChange = "hold";
  if (auditVerdict !== "clean") {
    stateChange = "hold";
  } else if (result.outcome === "supports") {
    after = { status: "supported", confidence: confidenceAfterSupport(before.confidence) };
    stateChange = "promote";
  } else if (result.outcome === "refutes") {
    after = { status: "refuted", confidence: "low" };
    stateChange = "downgrade";
  } else if (result.outcome === "failed") {
    after = { status: "challenged", confidence: "low" };
    stateChange = "downgrade";
  } else {
    after = { status: "inconclusive", confidence: "low" };
    stateChange = "downgrade";
  }
  const bridgeEvent = {
    id: bridgeId,
    experimentId: result.experimentId,
    resultId: result.id,
    claimId: result.claimId,
    mapping,
    confidenceBefore: before.confidence,
    confidenceAfter: after.confidence,
    statusBefore: before.status,
    statusAfter: after.status,
    claimStateBefore: before,
    claimStateAfter: after,
    auditIds,
    auditVerdict,
    integrityFlags: aggregatedIntegrityFlags,
    bridgeStatus,
    stateChange,
    reviewRequiredBeforeFinalize: auditVerdict !== "clean" || mapping !== "supports",
    reason: implicitResultRetry
      ? existingBridge.reason
      : args.reason ?? (auditVerdict !== "clean"
        ? `Experiment ${result.experimentId} cannot update claim ${result.claimId} cleanly because audit verdict is ${auditVerdict}.`
        : result.summary ?? `Experiment ${result.experimentId} returned ${result.outcome}.`),
    ...(runtimeContext.authorizationProvenance
      ? { authorizationProvenance: runtimeContext.authorizationProvenance }
      : {}),
    updatedAt: nowIso()
  };
  if (existingBridge) {
    const stableExisting = {
      ...existingBridge,
      updatedAt: null
    };
    const stableNext = {
      ...bridgeEvent,
      updatedAt: null
    };
    if (
      JSON.stringify(stableExisting)
      !== JSON.stringify(stableNext)
    ) {
      throw new Error(
        `Claim bridge ${bridgeEvent.id} already exists with different durable content.`
      );
    }
    const claimAtBeforeState =
      currentClaimState.status === existingBridge.claimStateBefore?.status
      && currentClaimState.confidence === existingBridge.claimStateBefore?.confidence
      && (currentClaim.latestBridgeId ?? null) !== existingBridge.id;
    if (existingBridge.bridgeStatus !== "applied") {
      if (!claimAtBeforeState) {
        throw new Error(
          `Claim bridge ${existingBridge.id} durable claim state conflicts with its recorded held state.`
        );
      }
      return existingBridge;
    }
    const expectedLatestAuditId = audits[0]?.id ?? null;
    const claimAtAppliedState =
      currentClaimState.status === existingBridge.claimStateAfter?.status
      && currentClaimState.confidence === existingBridge.claimStateAfter?.confidence
      && currentClaim.latestBridgeId === existingBridge.id
      && currentClaim.bridgeStatus === existingBridge.bridgeStatus
      && currentClaim.latestAuditVerdict === existingBridge.auditVerdict
      && (currentClaim.latestAuditId ?? null) === expectedLatestAuditId
      && (currentClaim.experimentIds ?? []).includes(existingBridge.experimentId);
    if (!claimAtBeforeState && !claimAtAppliedState) {
      throw new Error(
        `Claim bridge ${existingBridge.id} durable claim state conflicts with both its recorded before and applied states.`
      );
    }
    if (claimAtAppliedState) {
      writeText(root, ARTIFACT_PATHS.claims, renderClaimsMarkdown(evidence.claims));
      return existingBridge;
    }
  } else {
    bridgeLog.items.push(bridgeEvent);
    bridgeLog.updatedAt = nowIso();
    writeJson(root, ARTIFACT_PATHS.claimBridgeLog, bridgeLog);
  }

  if (bridgeStatus !== "applied") {
    return bridgeEvent;
  }

  const durableBridge = existingBridge ?? bridgeEvent;
  evidence.claims[claimIndex] = {
    ...currentClaim,
    status: durableBridge.claimStateAfter.status,
    confidence: durableBridge.claimStateAfter.confidence,
    latestAuditId: audits[0]?.id ?? currentClaim.latestAuditId ?? null,
    latestAuditVerdict: durableBridge.auditVerdict,
    latestBridgeId: durableBridge.id,
    bridgeStatus: durableBridge.bridgeStatus,
    experimentIds: Array.from(new Set([...(currentClaim.experimentIds ?? []), durableBridge.experimentId]))
  };
  evidence.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.evidence, evidence);
  writeText(root, ARTIFACT_PATHS.claims, renderClaimsMarkdown(evidence.claims));
  return durableBridge;
}

export function upsertExperimentPlan(root, args = {}) {
  assertGovernanceMutationRegistered("upsert-experiment-plan", "guarded");
  const target = assertTaskScopedMutationTarget(root, "upsert-experiment-plan", args);
  assertFollowThroughReady(root, "Updating an experiment plan", args);
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
  const plansIndex = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const rawPlan = args.plan ?? args;
  const plan = normalizeExperimentPlan(rawPlan, plansIndex.items.length);
  const existingIndex = plansIndex.items.findIndex((item) => item.id === plan.id);
  const existingPlan = existingIndex >= 0 ? plansIndex.items[existingIndex] : null;
  const nextPlan = {
    ...(existingPlan ?? {}),
    ...plan,
    claimId: Object.hasOwn(rawPlan, "claimId") ? plan.claimId : (existingPlan?.claimId ?? plan.claimId),
    updatedAt: nowIso()
  };
  if (nextPlan.claimId && !evidence.claims.some((claim) => claim.id === nextPlan.claimId)) {
    throw new Error(`Experiment plan ${nextPlan.id} references unknown claim ${nextPlan.claimId}`);
  }
  if (existingIndex >= 0) {
    plansIndex.items[existingIndex] = nextPlan;
  } else {
    plansIndex.items.push(nextPlan);
  }
  plansIndex.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.experimentPlans, plansIndex);

  const resultsIndex = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  const audits = readJson(root, ARTIFACT_PATHS.experimentAudits, { version: 1, items: [], updatedAt: null });
  writeText(root, ARTIFACT_PATHS.experimentLog, renderExperimentLog(plansIndex.items, resultsIndex.items, audits.items));
  const board = loadBoard(root);
  upsertSystemOrchestrationBoard(root, {
    phase: "experiments",
    assignedRole: "builder",
    intentType: "experiment",
    currentFocus: `Advance experiment ${nextPlan.id}.`,
    nextAction: `Record results for ${nextPlan.id}, then audit the outcome.`,
    experimentIds: Array.from(new Set([...board.experimentIds, nextPlan.id])),
    activeComparisonTargets: Array.from(new Set([...board.activeComparisonTargets, ...nextPlan.comparisonTargets])),
    continuationState: {
      status: "in-progress",
      lastCheckpoint: `Experiment plan ${nextPlan.id} updated.`,
      checkpointHistory: [{ summary: `Experiment plan ${nextPlan.id} updated.`, recordedAt: nowIso() }]
    },
    reviewRequiredBeforeFinalize: true
  });
  refreshDurableSurfaces(root, {
    type: "upsert-experiment-plan",
    summary: `Updated experiment plan ${nextPlan.id}.`,
    artifactPaths: [ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentLog, ARTIFACT_PATHS.taskPacketsIndex]
  });
  return {
    ...nextPlan,
    preActionGuidanceSummary: workflowGuidanceSummary(root, args, {
      surface: "dove.experience",
      roleId: "builder",
      subagentSpecialty: "experiment-planner",
      packet: target.packet,
      stage: target.packet?.stage ?? "execute",
      workflowKind: "experience",
      nextAction: "project:dove.experience",
      tags: ["experiment", "plan"],
      statusSummary: { experimentId: nextPlan.id, status: nextPlan.status }
    })
  };
}

export function upsertExperimentResult(root, args = {}) {
  assertGovernanceMutationRegistered("upsert-experiment-result", "guarded");
  const taskTarget = assertTaskScopedMutationTarget(root, "upsert-experiment-result", args);
  assertFollowThroughReady(root, "Updating an experiment result", args);
  const plansIndex = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
  const resultsIndex = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  const result = normalizeExperimentResult(args.result ?? args, resultsIndex.items.length);
  const allowedOutcomes = new Set(["supports", "refutes", "inconclusive", "failed", "pending"]);
  if (!allowedOutcomes.has(result.outcome)) {
    throw new Error(`Experiment result ${result.id} has invalid outcome ${result.outcome}`);
  }
  const linkedPlan = plansIndex.items.find((item) => item.id === result.experimentId);
  if (!linkedPlan) {
    throw new Error(`Experiment result ${result.id} references unknown experiment ${result.experimentId}`);
  }
  if (linkedPlan.claimId && !result.claimId) {
    throw new Error(`Experiment result ${result.id} must include claimId ${linkedPlan.claimId} from its plan`);
  }
  if (result.claimId && !evidence.claims.some((claim) => claim.id === result.claimId)) {
    throw new Error(`Experiment result ${result.id} references unknown claim ${result.claimId}`);
  }
  if (linkedPlan.claimId && result.claimId && linkedPlan.claimId !== result.claimId) {
    throw new Error(`Experiment result ${result.id} claim ${result.claimId} does not match plan claim ${linkedPlan.claimId}`);
  }
  const existingIndex = resultsIndex.items.findIndex((item) => item.id === result.id);
  if (existingIndex >= 0) {
    resultsIndex.items[existingIndex] = { ...resultsIndex.items[existingIndex], ...result, updatedAt: nowIso() };
  } else {
    resultsIndex.items.push(result);
  }
  resultsIndex.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.experimentResults, resultsIndex);

  const audit = runExperimentAudit(root, {
    resultId: result.id,
    packetId: taskTarget.packetId ?? args.packetId,
    actorRole: args.actorRole
  });
  let bridgeEvent;
  if (audit.auditVerdict === "clean" && result.claimId) {
    bridgeEvent = bridgeExperimentResultToClaim(root, {
      resultId: result.id,
      packetId: taskTarget.packetId ?? args.packetId,
      auditIds: [audit.id],
      actorRole: args.actorRole
    });
  } else {
    const claim = result.claimId ? evidence.claims.find((item) => item.id === result.claimId) : null;
    const before = { status: claim?.status ?? null, confidence: claim?.confidence ?? null };
    bridgeEvent = {
      id: slugify(`${result.id}-integrity-hold-bridge`),
      experimentId: result.experimentId,
      resultId: result.id,
      claimId: result.claimId,
      mapping: "integrity-hold",
      confidenceBefore: before.confidence,
      confidenceAfter: before.confidence,
      statusBefore: before.status,
      statusAfter: before.status,
      claimStateBefore: before,
      claimStateAfter: before,
      auditIds: [audit.id],
      auditVerdict: audit.auditVerdict,
      integrityFlags: audit.integrityFlags ?? [],
      bridgeStatus: "held-for-review",
      stateChange: "hold",
      reviewRequiredBeforeFinalize: true,
      reason: `Experiment ${result.experimentId} cannot update claim ${result.claimId ?? "unlinked"} until audit integrity gaps are resolved: ${(audit.integrityFlags ?? []).join(", ") || audit.auditVerdict}.`,
      updatedAt: nowIso()
    };
    const bridgeLog = readJson(root, ARTIFACT_PATHS.claimBridgeLog, { version: 1, items: [], updatedAt: null });
    bridgeLog.items = [...(bridgeLog.items ?? []).filter((item) => item.id !== bridgeEvent.id), bridgeEvent];
    bridgeLog.updatedAt = nowIso();
    writeJson(root, ARTIFACT_PATHS.claimBridgeLog, bridgeLog);
  }
  const resultIndex = resultsIndex.items.findIndex((item) => item.id === result.id);
  resultsIndex.items[resultIndex] = {
    ...resultsIndex.items[resultIndex],
    latestAuditId: audit.id,
    latestBridgeId: bridgeEvent.id,
    updatedAt: nowIso()
  };
  writeJson(root, ARTIFACT_PATHS.experimentResults, resultsIndex);

  const audits = readJson(root, ARTIFACT_PATHS.experimentAudits, { version: 1, items: [], updatedAt: null });
  writeText(root, ARTIFACT_PATHS.experimentLog, renderExperimentLog(plansIndex.items, resultsIndex.items, audits.items));
  const board = loadBoard(root);
  const blockers = (result.outcome === "failed" || result.outcome === "refutes" || bridgeEvent.mapping !== "supports")
    ? ensureBlocker(board.blockers, {
        id: `${result.experimentId}-needs-followup`,
        summary: bridgeEvent.mapping === "integrity-hold"
          ? `Experiment ${result.experimentId} cannot cleanly update claim ${result.claimId} until audit integrity gaps are resolved.`
          : `Experiment ${result.experimentId} produced ${result.outcome}; reconcile the linked claim before finalization.`,
        status: "open",
        assignedRole: "reviewer",
        evidenceLinks: result.evidenceLinks,
        experimentIds: [result.experimentId],
        currentFocus: `Review the claim impact of ${result.experimentId}.`,
        nextAction: "Use the audit and bridge logs to decide whether the claim should be strengthened, weakened, or rewritten."
      })
    : board.blockers;
  upsertSystemOrchestrationBoard(root, {
    phase: "experiments",
    assignedRole: "builder",
    intentType: bridgeEvent.mapping === "supports" ? "experiment" : "repair",
    currentFocus: bridgeEvent.mapping === "supports"
      ? `Experiment ${result.experimentId} now supports ${result.claimId}.`
      : bridgeEvent.mapping === "integrity-hold"
        ? `Experiment ${result.experimentId} is held for review until audit gaps are closed.`
        : `Experiment ${result.experimentId} needs claim reconciliation.`,
    nextAction: bridgeEvent.mapping === "supports"
      ? "Refresh the review surfaces before making stronger claims."
      : bridgeEvent.mapping === "integrity-hold"
        ? "Repair the experiment audit provenance, then re-run review before finalization."
        : "Run the review loop and resolve the concern before finalization.",
    blockers,
    evidenceLinks: Array.from(new Set([...board.evidenceLinks, ...result.evidenceLinks, ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.claimBridgeLog])),
    activeComparisonTargets: Array.from(new Set([...board.activeComparisonTargets, ...result.comparisonTargets])),
    continuationState: {
      status: bridgeEvent.mapping === "supports" ? "ready-to-resume" : "blocked",
      lastCheckpoint: `Experiment result ${result.id} recorded, audited, and bridged to claim ${result.claimId}.`,
      checkpointHistory: [{ summary: `Experiment result ${result.id} recorded.`, recordedAt: nowIso() }]
    },
    reviewRequiredBeforeFinalize: true
  });
  refreshDurableSurfaces(root, {
    type: "upsert-experiment-result",
    summary: `Updated experiment result ${result.id}.`,
    artifactPaths: [ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.claimBridgeLog, ARTIFACT_PATHS.experimentLog, ARTIFACT_PATHS.taskPacketsIndex]
  });
  return {
    ...resultsIndex.items[resultIndex],
    preActionGuidanceSummary: workflowGuidanceSummary(root, args, {
      surface: "dove.experience",
      roleId: "builder",
      subagentSpecialty: "experiment-planner",
      packet: taskTarget.packet,
      stage: taskTarget.packet?.stage ?? "execute",
      workflowKind: "experience-result",
      nextAction: "project:dove.review",
      tags: ["experiment", "result", "claim-bridge", "audit"],
      statusSummary: {
        experimentId: result.experimentId,
        resultId: result.id,
        outcome: result.outcome,
        auditId: audit.id,
        bridgeStatus: bridgeEvent.bridgeStatus
      }
    })
  };
}

function normalizeIssue(issue = {}, index = 0) {
  return {
    id: slugify(issue.id ?? issue.summary ?? `issue-${index + 1}`),
    reviewer: issue.reviewer ?? `reviewer-${index + 1}`,
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
    authorizationProvenanceHistory:
      Array.isArray(
        issue.authorizationProvenanceHistory
      )
        ? issue.authorizationProvenanceHistory
        : [],
    sourceReviewIds: normalizeStringArray(
      issue.sourceReviewIds
    ),
    sourceReviewExecutionClaimId:
      issue.sourceReviewExecutionClaimId
      ?? null,
    updatedAt: nowIso()
  };
}

function assertNoReservedRebuttalFields(args = {}) {
  const reservedFields = new Set([
    "authorizationProvenance",
    "authorizationProvenanceHistory",
    "sourceReviewId",
    "sourceReviewIds",
    "sourceReviewExecutionClaimId",
    "executionClaimId",
    "updateBoard",
    "refreshDurableSurfaces"
  ]);
  const invalid = [
    ...Object.keys(args ?? {})
      .filter((key) => reservedFields.has(key)),
    ...(args.issues ?? []).flatMap(
      (issue, index) =>
        Object.keys(issue ?? {})
          .filter((key) =>
            reservedFields.has(key)
          )
          .map(
            (key) =>
              `issues[${index}].${key}`
          )
    )
  ];
  if (invalid.length > 0) {
    throw new Error(`Public rebuttal mutations do not accept runtime provenance fields: ${invalid.join(", ")}.`);
  }
}

export function normalizeRebuttalIssues(root, args = {}) {
  assertGovernanceMutationRegistered("normalize-rebuttal-issues", "guarded");
  assertNoReservedRebuttalFields(args);
  const target = assertTaskScopedMutationTarget(root, "normalize-rebuttal-issues", args);
  assertFollowThroughReady(root, "Normalizing rebuttal issues", args);
  const next = persistRebuttalIssues(root, args);
  return {
    ...next,
    resultCard: rebuttalIssuesResultCard(root, args, next.items ?? []),
    preActionGuidanceSummary: workflowGuidanceSummary(root, args, {
      surface: "dove.review",
      roleId: "reviewer",
      packet: target.packet,
      stage: args.stage ?? target.packet?.stage ?? "audit",
      workflowKind: "review",
      nextAction: "project:dove.rebuttal",
      tags: ["review", "rebuttal", "issue-normalization"],
      statusSummary: { issueCount: next.items?.length ?? 0 }
    })
  };
}

function persistRebuttalIssues(root, args = {}) {
  const issuesIndex = readJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null });
  const provided = Array.isArray(args.issues)
    ? args.issues.map((issue, index) => {
        const existing = (issuesIndex.items ?? []).find(
          (item) => item.id === issue.id
        ) ?? null;
        return normalizeIssue({
          ...existing,
          ...issue
        }, index);
      })
    : [];
  const merged = new Map((issuesIndex.items ?? []).map((issue, index) => {
    const normalized = normalizeIssue(issue, index);
    return [normalized.id, normalized];
  }));
  for (const issue of provided) {
    merged.set(issue.id, issue);
  }
  const items = Array.from(merged.values()).sort((left, right) => left.id.localeCompare(right.id));
  const next = { version: 1, items, updatedAt: nowIso() };
  writeJson(root, ARTIFACT_PATHS.rebuttalIssues, next);
  if (args.updateBoard !== false) {
    upsertSystemOrchestrationBoard(root, {
      phase: "rebuttal",
      assignedRole: "builder",
      intentType: "respond",
      currentFocus: items.length > 0 ? items[0].summary : "Prepare the rebuttal strategy.",
      nextAction: "Turn issues into strategy and response drafts without over-claiming.",
      rebuttalIssueIds: items.map((issue) => issue.id),
      evidenceLinks: Array.from(new Set(items.flatMap((issue) => issue.evidenceLinks))),
      continuationState: {
        status: items.some((issue) => issue.status !== "resolved") ? "in-progress" : "ready-to-resume",
        lastCheckpoint: `Normalized ${items.length} rebuttal issues.`,
        checkpointHistory: [{ summary: `Normalized ${items.length} rebuttal issues.`, recordedAt: nowIso() }]
      },
      reviewRequiredBeforeFinalize: true
    });
  }
  if (args.refreshDurableSurfaces !== false) {
    refreshDurableSurfaces(root, {
      type: "normalize-rebuttal-issues",
      summary: `Normalized ${items.length} rebuttal issues.`,
      artifactPaths: [ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.navigationReport]
    });
  }
  return next;
}

export function buildRebuttalStrategy(root, args = {}) {
  assertGovernanceMutationRegistered("build-rebuttal-strategy", "guarded");
  const target = assertTaskScopedMutationTarget(root, "build-rebuttal-strategy", args);
  assertFollowThroughReady(root, "Building the rebuttal strategy", args);
  const issues = readJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null });
  if (!Array.isArray(issues.items) || issues.items.length === 0) {
    return missingRebuttalIssuesResult(root, args);
  }
  const board = loadBoard(root);
  const strategy = [
    "# Rebuttal strategy",
    "",
    `- Phase: ${board.currentPhase}`,
    `- Assigned role: ${board.assignedRole}`,
    "",
    "## Issue board",
    "",
    ...(issues.items.length > 0 ? issues.items.flatMap((issue) => [
      `### ${issue.id}`,
      "",
      `- Reviewer: ${issue.reviewer}`,
      `- Severity: ${issue.severity}`,
      `- Status: ${issue.status}`,
      `- Response direction: ${issue.responseDirection}`,
      `- Evidence links: ${issue.evidenceLinks.join(", ") || "none"}`,
      `- Claim IDs: ${issue.claimIds.join(", ") || "none"}`,
      `- Experiment IDs: ${issue.experimentIds.join(", ") || "none"}`,
      `- Recommended owner: ${issue.responseDirection === "fix" ? "planner + builder/researcher" : "builder/revision-lead"}`,
      `- Required action: ${issue.responseDirection === "fix" ? "Update evidence or experiment coverage before final response." : "Clarify scope and cite the strongest existing evidence."}`,
      ""
    ]) : ["No rebuttal issues recorded."])
  ].join("\n");
  const responseDraft = [
    "# Rebuttal response draft",
    "",
    ...(issues.items.length > 0 ? issues.items.flatMap((issue) => [
      `## ${issue.id}`,
      "",
      `Reviewer concern: ${issue.summary}`,
      "",
      `Planned response: ${issue.responseDirection === "fix" ? "Describe the concrete revision and point to the updated evidence." : "Clarify the evidence and scope without over-claiming."}`,
      "",
      `Evidence links: ${issue.evidenceLinks.join(", ") || "none"}`,
      ""
    ]) : ["No issues available for rebuttal drafting."])
  ].join("\n");
  writeText(root, ARTIFACT_PATHS.rebuttalStrategy, strategy);
  writeText(root, ARTIFACT_PATHS.rebuttalResponseDraft, responseDraft);
  upsertSystemOrchestrationBoard(root, {
    phase: "rebuttal",
    assignedRole: "builder",
    intentType: "respond",
    currentFocus: issues.items.length > 0 ? issues.items[0].summary : "Prepare the rebuttal.",
    nextAction: "Draft concise evidence-backed responses.",
    rebuttalIssueIds: issues.items.map((issue) => issue.id),
    reviewRequiredBeforeFinalize: true
  });
  refreshDurableSurfaces(root, {
    type: "build-rebuttal-strategy",
    summary: `Built rebuttal strategy for ${issues.items.length} issues.`,
    artifactPaths: [ARTIFACT_PATHS.rebuttalStrategy, ARTIFACT_PATHS.rebuttalResponseDraft, ARTIFACT_PATHS.navigationReport]
  });
  return {
    strategyPath: ARTIFACT_PATHS.rebuttalStrategy,
    responseDraftPath: ARTIFACT_PATHS.rebuttalResponseDraft,
    issueCount: issues.items.length,
    resultCard: rebuttalStrategyResultCard(root, args, issues.items.length),
    preActionGuidanceSummary: workflowGuidanceSummary(root, args, {
      surface: "dove.rebuttal",
      roleId: "builder",
      subagentSpecialty: "revision-lead",
      packet: target.packet,
      stage: target.packet?.stage ?? "execute",
      workflowKind: "rebuttal",
      nextAction: "project:dove.review",
      tags: ["rebuttal", "revision", "evidence"],
      statusSummary: { issueCount: issues.items.length }
    })
  };
}

function readSnapshot(root, snapshotId) {
  const snapshotPath = path.join(ARTIFACT_PATHS.versionSnapshotsDir, `${snapshotId}.json`);
  const raw = readJson(root, snapshotPath, null);
  if (!raw) {
    return null;
  }
  return {
    id: raw.id ?? snapshotId,
    label: raw.label ?? snapshotId,
    parentVersionId: raw.parentVersionId ?? null,
    summary: raw.summary ?? "",
    createdAt: raw.createdAt ?? null,
    dove: {
      title: raw.dove?.title ?? raw.paper?.title ?? "",
      venue: raw.dove?.venue ?? raw.paper?.venue ?? "",
      objective: raw.dove?.objective ?? raw.paper?.objective ?? "",
      thesis: raw.dove?.thesis ?? raw.paper?.thesis ?? "",
      audience: raw.dove?.audience ?? raw.paper?.audience ?? ""
    },
    board: {
      currentPhase: raw.board?.currentPhase ?? "versions",
      assignedRole: raw.board?.assignedRole ?? "planner",
      intentType: raw.board?.intentType ?? "version",
      currentFocus: raw.board?.currentFocus ?? "",
      nextAction: raw.board?.nextAction ?? "",
      continuationState: raw.board?.continuationState ?? createContinuationState(),
      experimentIds: Array.isArray(raw.board?.experimentIds) ? raw.board.experimentIds : [],
      rebuttalIssueIds: Array.isArray(raw.board?.rebuttalIssueIds) ? raw.board.rebuttalIssueIds : [],
      activeComparisonTargets: Array.isArray(raw.board?.activeComparisonTargets) ? raw.board.activeComparisonTargets : []
    },
    sections: raw.sections && typeof raw.sections === "object" ? raw.sections : {},
    draftSnapshot: raw.draftSnapshot && typeof raw.draftSnapshot === "object" ? raw.draftSnapshot : {},
    claimIds: Array.isArray(raw.claimIds) ? raw.claimIds : [],
    evidenceLinks: Array.isArray(raw.evidenceLinks) ? raw.evidenceLinks : [],
    reviewVerdict: raw.reviewVerdict ?? "not-reviewed",
    openReviewItems: Array.isArray(raw.openReviewItems) ? raw.openReviewItems : [],
    unresolvedConcernIds: Array.isArray(raw.unresolvedConcernIds) ? raw.unresolvedConcernIds : [],
    experimentPlanIds: Array.isArray(raw.experimentPlanIds) ? raw.experimentPlanIds : [],
    experimentResultIds: Array.isArray(raw.experimentResultIds) ? raw.experimentResultIds : [],
    experimentAuditIds: Array.isArray(raw.experimentAuditIds) ? raw.experimentAuditIds : [],
    claimBridgeIds: Array.isArray(raw.claimBridgeIds) ? raw.claimBridgeIds : []
  };
}

export function createVersionSnapshot(root, args = {}) {
  assertGovernanceMutationRegistered("create-version-snapshot", "guarded");
  assertTaskScopedMutationTarget(root, "create-version-snapshot", args);
  assertFollowThroughReady(root, "Creating a version snapshot", args);
  assertFinalizeReviewGate(root, "Creating a version snapshot");
  const state = loadState(root);
  const board = loadBoard(root);
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
  const reviews = readJson(root, ARTIFACT_PATHS.reviewState, { version: 2, history: [], openItems: [], lastVerdict: "not-reviewed", lastReviewedAt: null, unresolvedConcernIds: [] });
  const plans = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const results = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  const audits = readJson(root, ARTIFACT_PATHS.experimentAudits, { version: 1, items: [], updatedAt: null });
  const bridgeLog = readJson(root, ARTIFACT_PATHS.claimBridgeLog, { version: 1, items: [], updatedAt: null });
  const versions = readJson(root, ARTIFACT_PATHS.versionsIndex, { version: 1, currentVersionId: null, items: [], lineage: [], updatedAt: null });

  const versionId = slugify(args.versionId ?? args.label ?? `${state.dove.title}-${versions.items.length + 1}`);
  const snapshot = {
    id: versionId,
    label: args.label ?? versionId,
    parentVersionId: args.parentVersionId ?? versions.currentVersionId ?? null,
    summary: args.summary ?? "Manual paper snapshot.",
    createdAt: nowIso(),
    dove: state.dove,
    board: {
      currentPhase: board.currentPhase,
      assignedRole: board.assignedRole,
      intentType: board.intentType,
      currentFocus: board.currentFocus,
      nextAction: board.nextAction,
      continuationState: board.continuationState,
      experimentIds: board.experimentIds,
      rebuttalIssueIds: board.rebuttalIssueIds,
      activeComparisonTargets: board.activeComparisonTargets
    },
    sections: state.sections,
    draftSnapshot: collectDraftSnapshot(root, state.sections),
    claimIds: evidence.claims.map((claim) => claim.id),
    evidenceLinks: Array.from(new Set(evidence.claims.flatMap((claim) => claim.evidenceLinks ?? []))),
    reviewVerdict: reviews.lastVerdict,
    openReviewItems: reviews.openItems,
    unresolvedConcernIds: reviews.unresolvedConcernIds ?? [],
    experimentPlanIds: plans.items.map((item) => item.id),
    experimentResultIds: results.items.map((item) => item.id),
    experimentAuditIds: audits.items.map((item) => item.id),
    claimBridgeIds: bridgeLog.items.map((item) => item.id)
  };

  writeJson(root, path.join(ARTIFACT_PATHS.versionSnapshotsDir, `${versionId}.json`), snapshot);
  const existingIndex = versions.items.findIndex((item) => item.id === versionId);
  const summaryEntry = {
    id: versionId,
    label: snapshot.label,
    parentVersionId: snapshot.parentVersionId,
    summary: snapshot.summary,
    createdAt: snapshot.createdAt
  };
  if (existingIndex >= 0) {
    versions.items[existingIndex] = summaryEntry;
  } else {
    versions.items.push(summaryEntry);
  }
  versions.currentVersionId = versionId;
  versions.lineage = versions.items.map((item) => ({ id: item.id, parentVersionId: item.parentVersionId ?? null }));
  versions.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.versionsIndex, versions);

  const snapshotIds = Array.from(new Set([...(board.versionLineage?.snapshotIds ?? []), versionId]));
  upsertSystemOrchestrationBoard(root, {
    phase: "versions",
    assignedRole: "planner",
    intentType: "version",
    currentFocus: `Snapshot ${versionId} recorded.`,
    nextAction: "Compare it to the previous version if the paper changed materially.",
    versionLineage: {
      currentVersionId: versionId,
      parentVersionId: snapshot.parentVersionId,
      snapshotIds
    },
    continuationState: {
      status: "ready-to-resume",
      lastCheckpoint: `Version snapshot ${versionId} created.`,
      checkpointHistory: [{ summary: `Version snapshot ${versionId} created.`, recordedAt: nowIso() }]
    }
  });
  refreshDurableSurfaces(root, {
    type: "create-version-snapshot",
    summary: `Created version snapshot ${versionId}.`,
    artifactPaths: [ARTIFACT_PATHS.versionsIndex, path.join(ARTIFACT_PATHS.versionSnapshotsDir, `${versionId}.json`), ARTIFACT_PATHS.taskPacketsIndex]
  });
  return {
    ...snapshot,
    resultCard: versionSnapshotResultCard(root, args, snapshot, {
      sectionCount: Object.keys(state.sections).length,
      claimCount: evidence.claims.length,
      reviewVerdict: reviews.lastVerdict
    })
  };
}

export function compareVersions(root, args = {}) {
  assertGovernanceMutationRegistered("compare-versions", "guarded");
  assertTaskScopedMutationTarget(root, "compare-versions", args);
  assertFollowThroughReady(root, "Comparing versions", args);
  assertFinalizeReviewGate(root, "Comparing versions");
  const fromId = args.fromVersionId;
  const toId = args.toVersionId;
  const fromSnapshot = readSnapshot(root, fromId);
  const toSnapshot = readSnapshot(root, toId);
  if (!fromSnapshot || !toSnapshot) {
    throw new Error(`Both snapshots must exist before comparison. Missing: ${!fromSnapshot ? fromId : toId}`);
  }

  const comparison = {
    id: slugify(`${fromId}-vs-${toId}`),
    fromVersionId: fromId,
    toVersionId: toId,
    createdAt: nowIso(),
    objectiveChanged: fromSnapshot.dove.objective !== toSnapshot.dove.objective,
    thesisChanged: fromSnapshot.dove.thesis !== toSnapshot.dove.thesis,
    addedClaimIds: toSnapshot.claimIds.filter((id) => !fromSnapshot.claimIds.includes(id)),
    removedClaimIds: fromSnapshot.claimIds.filter((id) => !toSnapshot.claimIds.includes(id)),
    addedExperimentResultIds: toSnapshot.experimentResultIds.filter((id) => !fromSnapshot.experimentResultIds.includes(id)),
    addedAuditIds: (toSnapshot.experimentAuditIds ?? []).filter((id) => !(fromSnapshot.experimentAuditIds ?? []).includes(id)),
    addedBridgeIds: (toSnapshot.claimBridgeIds ?? []).filter((id) => !(fromSnapshot.claimBridgeIds ?? []).includes(id)),
    openReviewItemsAdded: toSnapshot.openReviewItems.filter((item) => !fromSnapshot.openReviewItems.includes(item)),
    openReviewItemsRemoved: fromSnapshot.openReviewItems.filter((item) => !toSnapshot.openReviewItems.includes(item)),
    unresolvedConcernsAdded: (toSnapshot.unresolvedConcernIds ?? []).filter((id) => !(fromSnapshot.unresolvedConcernIds ?? []).includes(id)),
    unresolvedConcernsRemoved: (fromSnapshot.unresolvedConcernIds ?? []).filter((id) => !(toSnapshot.unresolvedConcernIds ?? []).includes(id)),
    addedEvidenceLinks: toSnapshot.evidenceLinks.filter((item) => !fromSnapshot.evidenceLinks.includes(item)),
    removedEvidenceLinks: fromSnapshot.evidenceLinks.filter((item) => !toSnapshot.evidenceLinks.includes(item)),
    addedCitationKeys: Array.from(new Set(Object.values(toSnapshot.draftSnapshot ?? {}).flatMap((item) => item.citedKeys ?? []))).filter((item) => !Array.from(new Set(Object.values(fromSnapshot.draftSnapshot ?? {}).flatMap((entry) => entry.citedKeys ?? []))).includes(item)),
    removedCitationKeys: Array.from(new Set(Object.values(fromSnapshot.draftSnapshot ?? {}).flatMap((item) => item.citedKeys ?? []))).filter((item) => !Array.from(new Set(Object.values(toSnapshot.draftSnapshot ?? {}).flatMap((entry) => entry.citedKeys ?? []))).includes(item)),
    verdictChanged: fromSnapshot.reviewVerdict !== toSnapshot.reviewVerdict,
    changedDraftSections: Object.keys({ ...(fromSnapshot.draftSnapshot ?? {}), ...(toSnapshot.draftSnapshot ?? {}) }).flatMap((sectionId) => {
      const before = fromSnapshot.draftSnapshot?.[sectionId]?.contentHash ?? null;
      const after = toSnapshot.draftSnapshot?.[sectionId]?.contentHash ?? null;
      return before === after ? [] : [{ sectionId, from: before, to: after }];
    }),
    sectionStatusChanges: Object.keys({ ...fromSnapshot.sections, ...toSnapshot.sections }).flatMap((sectionId) => {
      const before = fromSnapshot.sections[sectionId]?.status ?? null;
      const after = toSnapshot.sections[sectionId]?.status ?? null;
      return before === after ? [] : [{ sectionId, from: before, to: after }];
    })
  };

  const comparisons = readJson(root, ARTIFACT_PATHS.versionComparisons, { version: 1, items: [], activeTargets: [], updatedAt: null });
  const existingIndex = comparisons.items.findIndex((item) => item.id === comparison.id);
  if (existingIndex >= 0) {
    comparisons.items[existingIndex] = comparison;
  } else {
    comparisons.items.push(comparison);
  }
  comparisons.activeTargets = [fromId, toId];
  comparisons.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.versionComparisons, comparisons);
  writeText(root, ARTIFACT_PATHS.versionComparisonReport, [
    "# Latest version comparison",
    "",
    `- From: ${fromId}`,
    `- To: ${toId}`,
    `- Objective changed: ${comparison.objectiveChanged}`,
    `- Thesis changed: ${comparison.thesisChanged}`,
    `- Verdict changed: ${comparison.verdictChanged}`,
    "",
    "## Added audits",
    "",
    ...(comparison.addedAuditIds.length > 0 ? comparison.addedAuditIds.map((id) => `- ${id}`) : ["- None"]),
    "",
    "## Added claim-bridge events",
    "",
    ...(comparison.addedBridgeIds.length > 0 ? comparison.addedBridgeIds.map((id) => `- ${id}`) : ["- None"]),
    "",
    "## Added evidence links",
    "",
    ...(comparison.addedEvidenceLinks.length > 0 ? comparison.addedEvidenceLinks.map((id) => `- ${id}`) : ["- None"]),
    "",
    "## Removed evidence links",
    "",
    ...(comparison.removedEvidenceLinks.length > 0 ? comparison.removedEvidenceLinks.map((id) => `- ${id}`) : ["- None"]),
    "",
    "## Added citation keys",
    "",
    ...(comparison.addedCitationKeys.length > 0 ? comparison.addedCitationKeys.map((id) => `- ${id}`) : ["- None"]),
    "",
    "## Added claims",
    "",
    ...(comparison.addedClaimIds.length > 0 ? comparison.addedClaimIds.map((id) => `- ${id}`) : ["- None"]),
    "",
    "## Unresolved concern delta",
    "",
    ...(comparison.unresolvedConcernsAdded.length > 0 ? comparison.unresolvedConcernsAdded.map((id) => `- Added: ${id}`) : ["- No newly added unresolved concerns."]),
    ...(comparison.unresolvedConcernsRemoved.length > 0 ? comparison.unresolvedConcernsRemoved.map((id) => `- Removed: ${id}`) : ["- No resolved concerns removed from the set."]),
    "",
    "## Section status changes",
    "",
    ...(comparison.sectionStatusChanges.length > 0 ? comparison.sectionStatusChanges.map((change) => `- ${change.sectionId}: ${change.from} -> ${change.to}`) : ["- None"]),
    "",
    "## Changed draft sections",
    "",
    ...(comparison.changedDraftSections.length > 0 ? comparison.changedDraftSections.map((change) => `- ${change.sectionId}: content hash changed`) : ["- None"])
  ].join("\n"));

  upsertSystemOrchestrationBoard(root, {
    phase: "versions",
    assignedRole: "planner",
    intentType: "version",
    currentFocus: `Compare ${fromId} to ${toId}.`,
    nextAction: "Use the comparison report to explain what changed and why.",
    activeComparisonTargets: [fromId, toId]
  });
  refreshDurableSurfaces(root, {
    type: "compare-versions",
    summary: `Compared versions ${fromId} and ${toId}.`,
    artifactPaths: [ARTIFACT_PATHS.versionComparisons, ARTIFACT_PATHS.versionComparisonReport, ARTIFACT_PATHS.navigationReport]
  });
  return {
    ...comparison,
    resultCard: versionComparisonResultCard(root, args, comparison)
  };
}
