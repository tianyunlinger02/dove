import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  ROLE_IDS,
  createDefaultBoard,
  createMetaEventsIndex,
  createMetaOptimizerState,
  createMetaRecommendationsIndex,
  createSessionJournal,
  createTaskPacketsIndex,
  createVersionComparisonsIndex,
  createVersionsIndex,
  createWorkflowBoundaries,
  createWorkspaceIndex,
  createWikiEntitiesIndex,
  createWikiRelationsIndex,
  resolveResumeCommandForPhase
} from "./schema.mjs";
import { ensureWorkspace, loadState, nowIso, readJson, resolvePath, writeJson, writeText } from "./workspace.mjs";

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)))
    : [];
}

const GOVERNANCE_TERMINAL_LIFECYCLES = new Set(["archived", "archived-with-lineage"]);
const GOVERNANCE_ACTIVE_LIFECYCLES = new Set(["active", "ready-for-handoff", "review-needed", "stale"]);

function isIsoTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function normalizeUpdatedAt(value) {
  return isIsoTimestamp(value) ? value : null;
}

function uniqueSorted(items = []) {
  return Array.from(new Set(items.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function lifecycleSortRank(packet) {
  const order = {
    stale: 0,
    "review-needed": 1,
    "ready-for-handoff": 2,
    blocked: 3,
    waiting: 4,
    active: 5,
    queued: 6,
    "archived-with-lineage": 7,
    archived: 8
  };
  return order[packet.lifecycleStatus] ?? 99;
}

function sortPacketsForQueue(items = []) {
  return [...items].sort((left, right) => {
    const lifecycleDelta = lifecycleSortRank(left) - lifecycleSortRank(right);
    if (lifecycleDelta !== 0) {
      return lifecycleDelta;
    }
    return (left.id ?? "").localeCompare(right.id ?? "");
  });
}

function hasLineageLinks(packet = {}) {
  return [
    packet.parentPacketId,
    ...(packet.childPacketIds ?? []),
    ...(packet.claimIds ?? []),
    ...(packet.noteIds ?? []),
    ...(packet.experimentIds ?? []),
    ...(packet.rebuttalIssueIds ?? []),
    ...(packet.versionIds ?? []),
    ...(packet.outputPaths ?? []),
    ...(packet.evidenceLinks ?? [])
  ].filter(Boolean).length > 0;
}

function derivePacketLifecycle(packet = {}, existing = {}) {
  const explicit = typeof packet.lifecycleStatus === "string" ? packet.lifecycleStatus.trim().toLowerCase() : "";
  if (explicit) {
    return explicit;
  }
  const normalizedStatus = typeof packet.status === "string" ? packet.status.trim().toLowerCase() : "pending";
  const continuationStatus = typeof packet.continuationState?.status === "string"
    ? packet.continuationState.status.trim().toLowerCase()
    : "";
  const updatedAt = normalizeUpdatedAt(packet.updatedAt) ?? normalizeUpdatedAt(existing.updatedAt) ?? normalizeUpdatedAt(packet.continuationState?.updatedAt);
  const isStale = updatedAt ? Date.now() - Date.parse(updatedAt) > 1000 * 60 * 60 * 24 * 7 : false;
  const dependencyCount = normalizeStringArray(packet.dependencies).length;
  const lineageLinked = hasLineageLinks({ ...existing, ...packet });

  if (["done", "resolved", "cancelled", "retired", "archived"].includes(normalizedStatus) || continuationStatus === "completed") {
    return lineageLinked ? "archived-with-lineage" : "archived";
  }
  if (["review-needed", "needs-review", "awaiting-review", "review"].includes(normalizedStatus) || continuationStatus === "review-needed") {
    return "review-needed";
  }
  if (dependencyCount > 0 || continuationStatus === "blocked") {
    return normalizedStatus === "blocked" ? "blocked" : "waiting";
  }
  if (packet.assignedRole && packet.boardAssignedRole && packet.assignedRole !== packet.boardAssignedRole && !["pending", "planned", "queued", "open"].includes(normalizedStatus)) {
    return "ready-for-handoff";
  }
  if (isStale) {
    return "stale";
  }
  if (["in-progress", "active", "current", "working"].includes(normalizedStatus) || continuationStatus === "in-progress") {
    return "active";
  }
  if (["pending", "planned", "queued", "open", "paused", "blocked"].includes(normalizedStatus) || continuationStatus === "ready-to-resume") {
    return "waiting";
  }
  return "queued";
}

function buildPacketDependencyHealth(packet, packetById) {
  const dependencies = normalizeStringArray(packet.dependencies);
  const missingDependencyIds = dependencies.filter((dependencyId) => !packetById.has(dependencyId));
  const blockingPacketIds = dependencies.filter((dependencyId) => {
    const dependency = packetById.get(dependencyId);
    return dependency && !GOVERNANCE_TERMINAL_LIFECYCLES.has(dependency.lifecycleStatus);
  });
  return {
    state: missingDependencyIds.length > 0
      ? "missing-dependencies"
      : blockingPacketIds.length > 0
        ? "blocked-by-dependencies"
        : dependencies.length > 0
          ? "ready-after-dependencies"
          : "clear",
    dependencyIds: dependencies,
    missingDependencyIds,
    blockingPacketIds
  };
}

function summarizePacket(packet) {
  return {
    id: packet.id,
    title: packet.title,
    status: packet.status,
    lifecycleStatus: packet.lifecycleStatus,
    assignedRole: packet.assignedRole,
    phase: packet.phase,
    nextAction: packet.nextAction,
    dependencyState: packet.dependencyHealth?.state ?? "clear",
    packetContextPath: packet.packetContextPath ?? null
  };
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function normalizeQuestion(question, fallbackPrefix, index) {
  if (typeof question === "string") {
    return {
      id: `${fallbackPrefix}-question-${index + 1}`,
      summary: question,
      status: "open",
      origin: fallbackPrefix
    };
  }
  return {
    id: slugify(question?.id ?? `${fallbackPrefix}-question-${index + 1}`),
    summary: question?.summary ?? question?.text ?? `Question ${index + 1}`,
    status: question?.status ?? "open",
    origin: question?.origin ?? fallbackPrefix
  };
}

function normalizeDecision(decision, fallbackPrefix, index) {
  if (typeof decision === "string") {
    return {
      id: `${fallbackPrefix}-decision-${index + 1}`,
      summary: decision,
      rationale: "",
      origin: fallbackPrefix,
      recordedAt: null
    };
  }
  return {
    id: slugify(decision?.id ?? `${fallbackPrefix}-decision-${index + 1}`),
    summary: decision?.summary ?? `Decision ${index + 1}`,
    rationale: decision?.rationale ?? "",
    origin: decision?.origin ?? fallbackPrefix,
    recordedAt: decision?.recordedAt ?? null
  };
}

function packetFilePath(packetId) {
  return path.join(ARTIFACT_PATHS.taskPacketsPacketsDir, `${packetId}.json`);
}

function loadExistingPacketMap(root, packets = []) {
  return new Map((packets ?? []).map((packet) => {
    const packetId = packet.id;
    const packetPath = packet.packetPath ?? packetFilePath(packetId);
    const fileValue = readJson(root, packetPath, packet);
    return [packetId, { ...packet, ...fileValue, packetPath }];
  }));
}

function mergeQuestions(incoming, existing) {
  const merged = new Map((existing ?? []).map((question) => [question.id, question]));
  for (const question of incoming ?? []) {
    merged.set(question.id, question);
  }
  return Array.from(merged.values());
}

function mergeDecisions(incoming, existing) {
  const merged = new Map((existing ?? []).map((decision) => [decision.id, decision]));
  for (const decision of incoming ?? []) {
    merged.set(decision.id, decision);
  }
  return Array.from(merged.values());
}

function normalizePacket(packet = {}) {
  const lifecycleStatus = derivePacketLifecycle(packet);
  const updatedAt = normalizeUpdatedAt(packet.updatedAt) ?? nowIso();
  return {
    ...packet,
    id: slugify(packet.id),
    sourceType: packet.sourceType ?? "task",
    sourceId: packet.sourceId ?? packet.id,
    title: packet.title ?? packet.id,
    summary: packet.summary ?? "",
    phase: packet.phase ?? "init",
    phaseContextId: packet.phaseContextId ?? `phase-${packet.phase ?? "init"}`,
    status: packet.status ?? "pending",
    lifecycleStatus,
    active: packet.active ?? !GOVERNANCE_TERMINAL_LIFECYCLES.has(lifecycleStatus),
    assignedRole: ROLE_IDS.includes(packet.assignedRole) ? packet.assignedRole : "planner",
    parentPacketId: packet.parentPacketId ? slugify(packet.parentPacketId) : null,
    childPacketIds: normalizeStringArray(packet.childPacketIds),
    currentFocus: packet.currentFocus ?? packet.title ?? packet.id,
    nextAction: packet.nextAction ?? "Continue the durable workflow.",
    dependencies: normalizeStringArray(packet.dependencies),
    evidenceLinks: normalizeStringArray(packet.evidenceLinks),
    claimIds: normalizeStringArray(packet.claimIds),
    noteIds: normalizeStringArray(packet.noteIds),
    experimentIds: normalizeStringArray(packet.experimentIds),
    rebuttalIssueIds: normalizeStringArray(packet.rebuttalIssueIds),
    versionIds: normalizeStringArray(packet.versionIds),
    outputPaths: normalizeStringArray(packet.outputPaths),
    questions: Array.isArray(packet.questions) ? packet.questions : [],
    decisions: Array.isArray(packet.decisions) ? packet.decisions : [],
    lineage: packet.lineage ?? {},
    continuationState: packet.continuationState ?? { status: packet.active ? "in-progress" : "ready-to-resume", lastCheckpoint: packet.summary ?? packet.title ?? packet.id },
    updatedAt,
    packetPath: packet.packetPath ?? packetFilePath(packet.id),
    packetContextPath: packet.packetContextPath ?? path.join(ARTIFACT_PATHS.packetContextsDir, `${slugify(packet.id)}.json`)
  };
}

function roleContextPaths(roleId) {
  const shared = [
    ARTIFACT_PATHS.state,
    ARTIFACT_PATHS.orchestrationBoard,
    ARTIFACT_PATHS.orchestrationHandoffs,
    ARTIFACT_PATHS.taskPacketsIndex,
    ARTIFACT_PATHS.sessionSummary,
    ARTIFACT_PATHS.navigationReport,
    ARTIFACT_PATHS.workspaceIndex,
    path.join(ARTIFACT_PATHS.phaseContextsDir, `${roleId === "researcher" ? "research" : roleId === "reviewer" ? "review" : roleId === "rebuttal-lead" ? "rebuttal" : roleId === "experiment-planner" ? "experiments" : roleId === "version-analyst" ? "versions" : "plan"}.json`),
    ARTIFACT_PATHS.wikiEntities,
    ARTIFACT_PATHS.wikiRelations
  ];

  switch (roleId) {
    case "researcher":
      return [...shared, ARTIFACT_PATHS.researchBrief, ARTIFACT_PATHS.researchAgenda, ARTIFACT_PATHS.sources, ARTIFACT_PATHS.notes, ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.queryPack];
    case "reviewer":
      return [...shared, ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.adversarialReviewState, ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.claimBridgeLog, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureSegments, ARTIFACT_PATHS.figureTemplates, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa, ARTIFACT_PATHS.revisionPlan, ARTIFACT_PATHS.checklist];
    case "rebuttal-lead":
      return [...shared, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa, ARTIFACT_PATHS.rebuttalStrategy, ARTIFACT_PATHS.rebuttalResponseDraft];
    case "experiment-planner":
      return [...shared, ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.claimBridgeLog, ARTIFACT_PATHS.experimentLog];
    case "version-analyst":
      return [...shared, ARTIFACT_PATHS.versionsIndex, ARTIFACT_PATHS.versionComparisons, ARTIFACT_PATHS.versionComparisonReport];
    default:
      return [...shared, ARTIFACT_PATHS.plan, ARTIFACT_PATHS.outline, ARTIFACT_PATHS.revisionPlan, ARTIFACT_PATHS.checklist];
  }
}

function artifactContextPath(relativePath) {
  return path.join(ARTIFACT_PATHS.artifactContextsDir, `${slugify(relativePath)}.json`);
}

function actionContextPath(scopeId) {
  return path.join(ARTIFACT_PATHS.actionContextsDir, `${slugify(scopeId)}.json`);
}

function normalizeArtifactPath(relativePath) {
  return String(relativePath ?? "").replace(/^\.\//, "").replace(/\\/g, "/");
}

function artifactGuidance(relativePath) {
  const normalized = normalizeArtifactPath(relativePath);

  if ([ARTIFACT_PATHS.orchestrationBoard, ARTIFACT_PATHS.orchestrationHandoffs, ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.sessionSummary, ARTIFACT_PATHS.navigationReport].includes(normalized)) {
    return {
      category: "orchestration",
      summary: "Treat this artifact as workflow control state and refresh the nearest role/phase/packet context before mutating it.",
      localRules: [
        "Preserve explicit role ownership, currentFocus, nextAction, and continuation checkpoints.",
        "Prefer durable handoffs and packet updates over implicit intent changes.",
        "Refresh query/navigation surfaces after changes so downstream commands read the same file state."
      ],
      readBeforeMutating: [ARTIFACT_PATHS.orchestrationBoard, ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.navigationReport]
    };
  }

  if ([ARTIFACT_PATHS.researchBrief, ARTIFACT_PATHS.researchAgenda, ARTIFACT_PATHS.sources, ARTIFACT_PATHS.notes, ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.queryPack, ARTIFACT_PATHS.claims].includes(normalized)) {
    return {
      category: "evidence",
      summary: "Research artifacts should stay provenance-aware and only promote evidence-backed claims.",
      localRules: [
        "Do not cite from memory or invent support that is not present in durable artifacts.",
        "Keep source, note, claim, and query surfaces aligned when evidence changes.",
        "Escalate uncertainty into open questions instead of hiding it in prose."
      ],
      readBeforeMutating: [ARTIFACT_PATHS.researchBrief, ARTIFACT_PATHS.sources, ARTIFACT_PATHS.notes, ARTIFACT_PATHS.evidence]
    };
  }

  if ([ARTIFACT_PATHS.wiki, ARTIFACT_PATHS.wikiEntities, ARTIFACT_PATHS.wikiRelations, ARTIFACT_PATHS.queryPack].includes(normalized)) {
    return {
      category: "wiki",
      summary: "Wiki artifacts should keep typed entity and relation integrity explicit so repair work stays file-backed and review-visible.",
      localRules: [
        "Keep entity and relation ids stable enough for downstream navigation surfaces to reuse them.",
        "Treat dangling relation endpoints and invalid endpoint typing as explicit repair work, not hidden cleanup.",
        "Refresh workspace and navigation surfaces after wiki changes so the same repair frontier is visible everywhere."
      ],
      readBeforeMutating: [ARTIFACT_PATHS.wikiEntities, ARTIFACT_PATHS.wikiRelations, ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.navigationReport]
    };
  }

  if ([ARTIFACT_PATHS.plan, ARTIFACT_PATHS.outline, ARTIFACT_PATHS.checklist].includes(normalized) || normalized.startsWith(`${ARTIFACT_PATHS.draftsDir}/`)) {
    return {
      category: "writing",
      summary: "Writing artifacts should follow the current plan and preserve evidence/review gates before completion claims.",
      localRules: [
        "Use durable plan and outline state to scope edits before drafting.",
        "Leave explicit citation TODO markers instead of fabricating support.",
        "Treat review-before-finalize as a workflow gate, not a suggestion."
      ],
      readBeforeMutating: [ARTIFACT_PATHS.plan, ARTIFACT_PATHS.outline, ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.reviewState]
    };
  }

  if ([ARTIFACT_PATHS.experimentLog, ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.claimBridgeLog].includes(normalized)) {
    return {
      category: "experiments",
      summary: "Experiment artifacts should keep plans, results, audits, and claim bridges distinct and traceable.",
      localRules: [
        "Record results separately from audits and bridge events.",
        "Keep reviewed artifact refs and audit flags explicit.",
        "Update claim state only through durable result-to-claim linkage."
      ],
      readBeforeMutating: [ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.claimBridgeLog]
    };
  }

  if ([ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.reviewDebateLog, ARTIFACT_PATHS.adversarialReviewState, ARTIFACT_PATHS.revisionPlan, ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.rebuttalStrategy, ARTIFACT_PATHS.rebuttalResponseDraft].includes(normalized)) {
    return {
      category: "review",
      summary: "Review and rebuttal artifacts should preserve reviewer independence, blocker visibility, and response traceability.",
      localRules: [
        "Keep reviewer-raised concerns durable and assign responses to non-reviewer roles when needed.",
        "Turn findings into explicit blockers, revision items, or rebuttal issues.",
        "Do not collapse review state into a single prose summary when structured state exists."
      ],
      readBeforeMutating: [ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.revisionPlan, ARTIFACT_PATHS.rebuttalIssues]
    };
  }

  if ([ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureSegments, ARTIFACT_PATHS.figureTemplates, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa, ARTIFACT_PATHS.figuresReadme].includes(normalized)) {
    return {
      category: "figures",
      summary: "Figure artifacts should preserve staged progression, claim linkage, and durable QA without inventing a render runtime.",
      localRules: [
        "Keep figure briefs, segment placeholders, templates, editable records, final contracts, and QA outputs in sync.",
        "Link figures to source sections, target claims, experiments, and review/rebuttal context when those relationships exist.",
        "Treat missing staged artifacts or broken figure linkage as review-visible issues, not informal notes."
      ],
      readBeforeMutating: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa, ARTIFACT_PATHS.reviewState]
    };
  }

  if ([ARTIFACT_PATHS.versionsIndex, ARTIFACT_PATHS.versionComparisons, ARTIFACT_PATHS.versionComparisonReport].includes(normalized) || normalized.startsWith(`${ARTIFACT_PATHS.versionSnapshotsDir}/`)) {
    return {
      category: "versions",
      summary: "Version artifacts should preserve honest lineage and explicit comparison targets.",
      localRules: [
        "Snapshot before major revisions and keep parent lineage explicit.",
        "Record comparison deltas instead of relying on memory.",
        "Do not finalize around an uncleared review gate."
      ],
      readBeforeMutating: [ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.versionsIndex, ARTIFACT_PATHS.versionComparisons]
    };
  }

  if ([ARTIFACT_PATHS.metaEvents, ARTIFACT_PATHS.metaRecommendations, ARTIFACT_PATHS.metaOptimizerState, ARTIFACT_PATHS.metaOptimizerReport].includes(normalized)) {
    return {
      category: "meta-optimize",
      summary: "Meta-optimize artifacts are proposal-only summaries built from durable workflow signals.",
      localRules: [
        "Do not auto-apply recommendations from this layer.",
        "Keep every recommendation tied to concrete evidence artifacts and ids.",
        "Use this layer to surface workflow/process/artifact health, not hidden self-modification."
      ],
      readBeforeMutating: [ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.claimBridgeLog, ARTIFACT_PATHS.figureQa, ARTIFACT_PATHS.versionComparisons]
    };
  }

  return {
    category: "general",
    summary: "Read the nearest local context surfaces before mutating this durable artifact.",
    localRules: [
      "Prefer explicit file-backed guidance over broad top-level instructions.",
      "Keep related artifacts in sync when this path changes.",
      "Avoid hidden state; make the next action legible in durable files."
    ],
    readBeforeMutating: [ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.navigationReport]
  };
}

function buildArtifactContextManifest(root, relativePath, board, packets, workspaceIndex) {
  const normalized = normalizeArtifactPath(relativePath);
  const guidance = artifactGuidance(normalized);
  const relatedPackets = packets.filter((packet) => [packet.packetPath, packet.packetContextPath, ...(packet.outputPaths ?? []), ...(packet.evidenceLinks ?? [])].includes(normalized));
  const relatedRoles = ROLE_IDS.filter((roleId) => roleContextPaths(roleId).includes(normalized));
  return {
    version: 1,
    artifactPath: normalized,
    exists: fs.existsSync(resolvePath(root, normalized)),
    category: guidance.category,
    summary: guidance.summary,
    boardPhase: board.currentPhase,
    boardAssignedRole: board.assignedRole,
    currentFocus: board.currentFocus,
    nextAction: board.nextAction,
    localRules: guidance.localRules,
    readBeforeMutating: uniqueSorted([
      ...guidance.readBeforeMutating,
      path.join(ARTIFACT_PATHS.roleContextsDir, `${board.assignedRole}.json`),
      path.join(ARTIFACT_PATHS.phaseContextsDir, `${board.currentPhase}.json`),
      ARTIFACT_PATHS.workspaceIndex,
      ARTIFACT_PATHS.navigationReport
    ]),
    relatedPacketIds: relatedPackets.map((packet) => packet.id),
    relatedPacketContextPaths: relatedPackets.map((packet) => packet.packetContextPath),
    relatedRoleIds: relatedRoles,
    relatedRoleContextPaths: relatedRoles.map((roleId) => path.join(ARTIFACT_PATHS.roleContextsDir, `${roleId}.json`)),
    workspaceCoupling: {
      workspaceIndexPath: ARTIFACT_PATHS.workspaceIndex,
      navigationReportPath: ARTIFACT_PATHS.navigationReport,
      currentActionContextPath: actionContextPath("current")
    },
    generatedAt: nowIso()
  };
}

function buildActionContextBundle({ scopeType, scopeId, summary, board, workspaceIndex, packet = null, roleId = null, phaseId = null, artifactPath = null, requiredReadPaths = [], localRules = [], nextAction = null }) {
  return {
    version: 1,
    scopeType,
    scopeId,
    summary,
    boardPhase: board.currentPhase,
    boardAssignedRole: board.assignedRole,
    currentFocus: packet?.currentFocus ?? workspaceIndex.currentFocus ?? board.currentFocus,
    nextAction: nextAction ?? packet?.nextAction ?? workspaceIndex.nextAction ?? board.nextAction,
    roleId,
    phaseId,
    packetId: packet?.id ?? null,
    artifactPath,
    explicitOnly: true,
    noHiddenRuntime: true,
    requiredReadPaths: uniqueSorted(requiredReadPaths),
    localRules: uniqueSorted(localRules),
    generatedAt: nowIso()
  };
}

function deriveBoardPackets(board, existingById) {
  const packets = [];

  for (const task of board.tasks ?? []) {
    const packetId = slugify(task.packetId ?? `task-${task.id}`);
    const previous = existingById.get(packetId);
    packets.push(normalizePacket({
      ...(previous ?? {}),
      id: packetId,
      sourceType: "task",
      sourceId: task.id,
      title: task.title,
      summary: task.notes ?? previous?.summary ?? "",
      phase: board.currentPhase,
      phaseContextId: task.phaseContextId ?? `phase-${board.currentPhase}`,
      status: task.status,
      lifecycleStatus: task.lifecycleStatus ?? task.status,
      active: !["done", "cancelled"].includes(task.status),
      assignedRole: task.assignedRole,
      parentPacketId: task.parentPacketId,
      childPacketIds: task.childPacketIds,
      currentFocus: task.currentFocus ?? task.title,
      nextAction: task.nextAction,
      dependencies: task.blockedBy,
      boardAssignedRole: board.assignedRole,
      evidenceLinks: task.evidenceLinks,
      claimIds: task.claimIds,
      noteIds: task.noteIds,
      experimentIds: task.experimentIds,
      rebuttalIssueIds: task.rebuttalIssueIds,
      versionIds: task.versionIds,
      outputPaths: task.outputPaths,
      questions: mergeQuestions((task.questions ?? []).map((item, index) => normalizeQuestion(item, packetId, index)), previous?.questions),
      decisions: mergeDecisions((task.decisions ?? []).map((item, index) => normalizeDecision(item, packetId, index)), previous?.decisions),
      lineage: {
        ...(previous?.lineage ?? {}),
        boardPhase: board.currentPhase,
        intentType: board.intentType,
        currentVersionId: board.versionLineage?.currentVersionId ?? null,
        activeComparisonTargets: normalizeStringArray(board.activeComparisonTargets)
      },
      continuationState: task.continuationState ?? previous?.continuationState,
      updatedAt: nowIso()
    }));
  }

  for (const blocker of board.blockers ?? []) {
    const packetId = slugify(blocker.packetId ?? `blocker-${blocker.id}`);
    const previous = existingById.get(packetId);
    packets.push(normalizePacket({
      ...(previous ?? {}),
      id: packetId,
      sourceType: "blocker",
      sourceId: blocker.id,
      title: blocker.summary,
      summary: blocker.summary,
      phase: board.currentPhase,
      phaseContextId: blocker.phaseContextId ?? `phase-${board.currentPhase}`,
      status: blocker.status,
      lifecycleStatus: blocker.lifecycleStatus ?? blocker.status,
      active: blocker.status !== "resolved",
      assignedRole: blocker.assignedRole,
      parentPacketId: blocker.parentPacketId,
      childPacketIds: blocker.childPacketIds,
      currentFocus: blocker.currentFocus ?? blocker.summary,
      nextAction: blocker.nextAction,
      dependencies: blocker.blockedBy,
      boardAssignedRole: board.assignedRole,
      evidenceLinks: blocker.evidenceLinks,
      claimIds: blocker.claimIds,
      noteIds: blocker.noteIds,
      experimentIds: blocker.experimentIds,
      rebuttalIssueIds: blocker.rebuttalIssueIds,
      versionIds: blocker.versionIds,
      outputPaths: blocker.outputPaths,
      questions: mergeQuestions((blocker.questions ?? []).map((item, index) => normalizeQuestion(item, packetId, index)), previous?.questions),
      decisions: mergeDecisions((blocker.decisions ?? []).map((item, index) => normalizeDecision(item, packetId, index)), previous?.decisions),
      lineage: {
        ...(previous?.lineage ?? {}),
        boardPhase: board.currentPhase,
        intentType: board.intentType,
        currentVersionId: board.versionLineage?.currentVersionId ?? null
      },
      continuationState: blocker.continuationState ?? previous?.continuationState,
      updatedAt: nowIso()
    }));
  }

  return packets;
}

function deriveExperimentPackets(plansIndex) {
  return (plansIndex.items ?? []).map((plan) => normalizePacket({
    id: `experiment-${plan.id}`,
    sourceType: "experiment",
    sourceId: plan.id,
    title: plan.title,
    summary: plan.hypothesis ?? plan.methodology ?? "",
    phase: "experiments",
    phaseContextId: "phase-experiments",
    status: plan.status,
    lifecycleStatus: plan.status,
    active: plan.status !== "done",
    assignedRole: plan.owner ?? "experiment-planner",
    currentFocus: plan.title,
    nextAction: "Record or audit the experiment result.",
    dependencies: [],
    boardAssignedRole: "experiment-planner",
    evidenceLinks: [],
    claimIds: plan.claimId ? [plan.claimId] : [],
    noteIds: [],
    experimentIds: [plan.id],
    rebuttalIssueIds: [],
    versionIds: [],
    outputPaths: [ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentLog, ARTIFACT_PATHS.experimentAudits],
    questions: [],
    decisions: [],
    lineage: { comparisonTargets: normalizeStringArray(plan.comparisonTargets) },
    updatedAt: plan.updatedAt ?? nowIso()
  }));
}

function deriveIssuePackets(issuesIndex) {
  return (issuesIndex.items ?? []).map((issue) => normalizePacket({
    id: `rebuttal-${issue.id}`,
    sourceType: "rebuttal-issue",
    sourceId: issue.id,
    title: issue.summary,
    summary: issue.summary,
    phase: "rebuttal",
    phaseContextId: "phase-rebuttal",
    status: issue.status,
    lifecycleStatus: issue.status,
    active: issue.status !== "resolved",
    assignedRole: "rebuttal-lead",
    currentFocus: issue.summary,
    nextAction: issue.responseDirection === "fix" ? "Revise the evidence or experiment record first." : "Clarify the response with the strongest durable evidence.",
    dependencies: [],
    boardAssignedRole: "rebuttal-lead",
    evidenceLinks: issue.evidenceLinks,
    claimIds: issue.claimIds,
    noteIds: [],
    experimentIds: issue.experimentIds,
    rebuttalIssueIds: [issue.id],
    versionIds: [],
    outputPaths: [ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.rebuttalStrategy],
    questions: [],
    decisions: [],
    lineage: { responseDirection: issue.responseDirection },
    updatedAt: issue.updatedAt ?? nowIso()
  }));
}

function deriveVersionPackets(versionsIndex) {
  return (versionsIndex.items ?? []).map((item) => normalizePacket({
    id: `version-${item.id}`,
    sourceType: "version",
    sourceId: item.id,
    title: item.label ?? item.id,
    summary: item.summary ?? "",
    phase: "versions",
    phaseContextId: "phase-versions",
    status: versionsIndex.currentVersionId === item.id ? "current" : "archived",
    lifecycleStatus: versionsIndex.currentVersionId === item.id ? "current" : "archived",
    active: versionsIndex.currentVersionId === item.id,
    assignedRole: "version-analyst",
    currentFocus: item.label ?? item.id,
    nextAction: "Compare this version with the active target when claims move.",
    dependencies: item.parentVersionId ? [`version-${item.parentVersionId}`] : [],
    boardAssignedRole: "version-analyst",
    evidenceLinks: [],
    claimIds: [],
    noteIds: [],
    experimentIds: [],
    rebuttalIssueIds: [],
    versionIds: [item.id],
    outputPaths: [ARTIFACT_PATHS.versionsIndex, path.join(ARTIFACT_PATHS.versionSnapshotsDir, `${item.id}.json`)],
    questions: [],
    decisions: [],
    lineage: { parentVersionId: item.parentVersionId ?? null },
    updatedAt: item.createdAt ?? nowIso()
  }));
}

function markInactiveLegacyPackets(items, activeIds) {
  return items.map((packet) => {
    if (!activeIds.has(packet.id) && ["task", "blocker"].includes(packet.sourceType)) {
      const lifecycleStatus = GOVERNANCE_TERMINAL_LIFECYCLES.has(packet.lifecycleStatus) ? packet.lifecycleStatus : hasLineageLinks(packet) ? "archived-with-lineage" : "archived";
      return { ...packet, active: false, lifecycleStatus };
    }
    return packet;
  });
}

function buildOwnershipSummary(board, packets) {
  const packetByRole = new Map();
  for (const roleId of ROLE_IDS) {
    packetByRole.set(roleId, []);
  }
  for (const packet of packets.filter((item) => item.active)) {
    packetByRole.get(packet.assignedRole)?.push(packet);
  }
  return ROLE_IDS.map((roleId) => {
    const owned = sortPacketsForQueue(packetByRole.get(roleId) ?? []);
    return {
      roleId,
      isBoardOwner: board.assignedRole === roleId,
      packetIds: owned.map((packet) => packet.id),
      activeCount: owned.length,
      waitingCount: owned.filter((packet) => ["waiting", "blocked"].includes(packet.lifecycleStatus)).length,
      reviewNeededCount: owned.filter((packet) => packet.lifecycleStatus === "review-needed").length,
      handoffReadyCount: owned.filter((packet) => packet.lifecycleStatus === "ready-for-handoff").length,
      staleCount: owned.filter((packet) => packet.lifecycleStatus === "stale").length
    };
  });
}

function buildPacketContextManifest(root, board, packet, packetById, workspaceIndex) {
  const dependencyHealth = packet.dependencyHealth ?? buildPacketDependencyHealth(packet, packetById);
  const preferredPhaseContextPath = path.join(ARTIFACT_PATHS.phaseContextsDir, `${packet.phase}.json`);
  const fallbackPhaseContextPath = path.join(ARTIFACT_PATHS.phaseContextsDir, `${board.currentPhase}.json`);
  const phaseContextPath = fs.existsSync(resolvePath(root, preferredPhaseContextPath))
    ? preferredPhaseContextPath
    : fallbackPhaseContextPath;
  const upstreamPackets = dependencyHealth.dependencyIds.map((dependencyId) => summarizePacket(packetById.get(dependencyId) ?? { id: dependencyId, title: dependencyId, status: "missing", lifecycleStatus: "waiting", assignedRole: "planner", phase: packet.phase, nextAction: "Repair missing dependency reference." }));
  const downstreamPackets = Array.from(packetById.values())
    .filter((candidate) => (candidate.dependencies ?? []).includes(packet.id))
    .map(summarizePacket);
  const artifactContextPaths = uniqueSorted([
    ...[packet.packetPath, ...(packet.outputPaths ?? []), ...(packet.evidenceLinks ?? [])].filter(Boolean).map(artifactContextPath),
    artifactContextPath(ARTIFACT_PATHS.workspaceIndex),
    artifactContextPath(ARTIFACT_PATHS.navigationReport)
  ]);
  const actionBundlePath = actionContextPath(`packet-${packet.id}`);
  return {
    version: 1,
    packetId: packet.id,
    title: packet.title,
    sourceType: packet.sourceType,
    sourceId: packet.sourceId,
    phase: packet.phase,
    lifecycleStatus: packet.lifecycleStatus,
    assignedRole: packet.assignedRole,
    boardPhase: board.currentPhase,
    boardAssignedRole: board.assignedRole,
    currentFocus: packet.currentFocus,
    nextAction: packet.nextAction,
    continuationState: packet.continuationState,
    taskWorkspaceCoupling: {
      packetPath: packet.packetPath,
      packetContextPath: packet.packetContextPath,
      phaseContextPath,
      workspaceIndexPath: ARTIFACT_PATHS.workspaceIndex,
      sessionSummaryPath: ARTIFACT_PATHS.sessionSummary,
      navigationReportPath: ARTIFACT_PATHS.navigationReport
    },
    dependencyHealth,
    upstreamPackets,
    downstreamPackets,
    linkedArtifacts: uniqueSorted([
      packet.packetPath,
      packet.packetContextPath,
      phaseContextPath,
      ARTIFACT_PATHS.workspaceIndex,
      ARTIFACT_PATHS.taskPacketsIndex,
      ARTIFACT_PATHS.sessionSummary,
      ARTIFACT_PATHS.navigationReport,
      ...(packet.outputPaths ?? []),
      ...(packet.evidenceLinks ?? [])
    ]),
    artifactContextPaths,
    actionContextPath: actionBundlePath,
    preActionReadPaths: uniqueSorted([
      actionBundlePath,
      packet.packetContextPath,
      phaseContextPath,
      path.join(ARTIFACT_PATHS.roleContextsDir, `${packet.assignedRole}.json`),
      ...artifactContextPaths
    ]),
    behaviorDiscipline: {
      summary: "Read the packet, phase, and linked artifact context before advancing this packet.",
      localRules: [
        "Preserve explicit dependency and handoff state.",
        "Use linked artifact paths as the source of truth for local guidance.",
        "Refresh durable surfaces after packet state changes."
      ]
    },
    linkedIds: {
      dependencies: dependencyHealth.dependencyIds,
      claims: uniqueSorted(packet.claimIds),
      notes: uniqueSorted(packet.noteIds),
      experiments: uniqueSorted(packet.experimentIds),
      rebuttalIssues: uniqueSorted(packet.rebuttalIssueIds),
      versions: uniqueSorted(packet.versionIds),
      children: uniqueSorted(packet.childPacketIds),
      parentPacketId: packet.parentPacketId ?? null
    },
    ownershipSummary: workspaceIndex.ownershipSummary?.find((entry) => entry.roleId === packet.assignedRole) ?? null,
    generatedAt: nowIso()
  };
}

function buildOpenQuestions(notesIndex, packets, reviewState, wikiEntities) {
  const questions = [];
  for (const note of notesIndex.items ?? []) {
    for (const [index, item] of (note.openQuestions ?? []).entries()) {
      const question = normalizeQuestion(item, note.id, index);
      questions.push({ ...question, packetId: null, sectionId: note.sectionId ?? null, sourcePath: ARTIFACT_PATHS.notes });
    }
  }
  for (const packet of packets) {
    for (const question of packet.questions ?? []) {
      questions.push({ ...question, packetId: packet.id, sectionId: null, sourcePath: packet.packetPath });
    }
  }
  for (const [index, item] of (reviewState.openItems ?? []).entries()) {
    questions.push({ id: `review-open-item-${index + 1}`, summary: item, status: "open", origin: "review-state", packetId: null, sectionId: null, sourcePath: ARTIFACT_PATHS.reviewState });
  }
  for (const entity of (wikiEntities.items ?? []).filter((item) => item.entityType === "question")) {
    questions.push({ id: entity.id, summary: entity.label, status: entity.status ?? "open", origin: "wiki-entity", packetId: entity.packetId ?? null, sectionId: entity.sectionId ?? null, sourcePath: ARTIFACT_PATHS.wikiEntities });
  }
  return questions;
}

function buildDecisions(board, versionsIndex, comparisons, packets, wikiEntities) {
  const decisions = [];
  decisions.push({
    id: "board-current-role",
    summary: `Current role owner is ${board.assignedRole}.`,
    rationale: `Board phase is ${board.currentPhase}. Current focus is ${board.currentFocus}.`,
    origin: ARTIFACT_PATHS.orchestrationBoard,
    recordedAt: board.updatedAt ?? null
  });
  decisions.push({
    id: "board-next-action",
    summary: `Next action: ${board.nextAction}`,
    rationale: `Intent type is ${board.intentType}.`,
    origin: ARTIFACT_PATHS.orchestrationBoard,
    recordedAt: board.updatedAt ?? null
  });
  if (versionsIndex.currentVersionId) {
    decisions.push({
      id: "current-version",
      summary: `Current paper version is ${versionsIndex.currentVersionId}.`,
      rationale: "The versions index marks this snapshot as the live version lineage head.",
      origin: ARTIFACT_PATHS.versionsIndex,
      recordedAt: versionsIndex.updatedAt ?? null
    });
  }
  for (const comparison of comparisons.items ?? []) {
    decisions.push({
      id: `comparison-${comparison.id}`,
      summary: `Compared ${comparison.fromVersionId} -> ${comparison.toVersionId}.`,
      rationale: comparison.objectiveChanged || comparison.thesisChanged
        ? "The paper objective or thesis changed across this lineage step."
        : "The comparison tracks evidence, citation, review, audit, and bridge deltas across versions.",
      origin: ARTIFACT_PATHS.versionComparisons,
      recordedAt: comparison.createdAt ?? null
    });
  }
  for (const packet of packets) {
    for (const decision of packet.decisions ?? []) {
      decisions.push({ ...decision, packetId: packet.id, origin: packet.packetPath, recordedAt: decision.recordedAt ?? packet.updatedAt ?? null });
    }
  }
  for (const entity of (wikiEntities.items ?? []).filter((item) => item.entityType === "decision")) {
    decisions.push({ id: entity.id, summary: entity.label, rationale: entity.summary ?? "", packetId: entity.packetId ?? null, origin: ARTIFACT_PATHS.wikiEntities, recordedAt: entity.updatedAt ?? null });
  }
  return decisions;
}

function buildTaskGraph(packets) {
  const nodeIds = new Set(packets.map((packet) => packet.id));
  const edges = [];
  for (const packet of packets) {
    for (const dependency of packet.dependencies) {
      if (nodeIds.has(dependency)) {
        edges.push({ from: packet.id, to: dependency, type: "depends-on" });
      }
    }
    if (packet.parentPacketId && nodeIds.has(packet.parentPacketId)) {
      edges.push({ from: packet.id, to: packet.parentPacketId, type: "child-of" });
    }
    for (const childId of packet.childPacketIds) {
      if (nodeIds.has(childId)) {
        edges.push({ from: packet.id, to: childId, type: "parent-of" });
      }
    }
    for (const versionId of packet.versionIds) {
      const target = `version-${versionId}`;
      if (packet.id !== target && nodeIds.has(target)) {
        edges.push({ from: packet.id, to: target, type: "version-link" });
      }
    }
    for (const issueId of packet.rebuttalIssueIds) {
      const target = `rebuttal-${issueId}`;
      if (packet.id !== target && nodeIds.has(target)) {
        edges.push({ from: packet.id, to: target, type: "rebuttal-link" });
      }
    }
    for (const experimentId of packet.experimentIds) {
      const target = `experiment-${experimentId}`;
      if (packet.id !== target && nodeIds.has(target)) {
        edges.push({ from: packet.id, to: target, type: "experiment-link" });
      }
    }
  }
  return { nodes: packets, edges };
}

function renderSessionSummary(state, board, packets, openQuestions, decisions, roleRoster, workspaceIndex) {
  const activePackets = sortPacketsForQueue(packets.filter((packet) => packet.active));
  return [
    "# Latest session summary",
    "",
    `- Updated: ${nowIso()}`,
    `- Phase: ${board.currentPhase}`,
    `- Intent: ${board.intentType}`,
    `- Assigned role: ${board.assignedRole}`,
    `- Resume command: ${state.pipeline.resumeCommand}`,
    `- Current focus: ${board.currentFocus}`,
    `- Next action: ${board.nextAction}`,
    `- Continuation state: ${board.continuationState?.status ?? "unknown"}`,
      `- Resume guidance: ${workspaceIndex.resumeGuidance?.command ?? state.pipeline.resumeCommand ?? resolveResumeCommandForPhase(board.currentPhase)}`,
    `- Current version: ${board.versionLineage?.currentVersionId ?? "none"}`,
    "",
    "## Active task packets",
    "",
    ...(activePackets.length > 0
      ? activePackets.map((packet) => `- ${packet.id}: ${packet.title} [${packet.status} | ${packet.lifecycleStatus}] (${packet.assignedRole}) → next: ${packet.nextAction}`)
      : ["- No active task packets."]),
    "",
    "## Work queues",
    "",
    `- Ready: ${(workspaceIndex.workQueues?.ready ?? []).map((packet) => packet.id).join(", ") || "none"}`,
    `- Waiting: ${(workspaceIndex.workQueues?.waiting ?? []).map((packet) => packet.id).join(", ") || "none"}`,
    `- Review needed: ${(workspaceIndex.workQueues?.reviewNeeded ?? []).map((packet) => packet.id).join(", ") || "none"}`,
    `- Ready for handoff: ${(workspaceIndex.workQueues?.handoff ?? []).map((packet) => packet.id).join(", ") || "none"}`,
    `- Stale: ${(workspaceIndex.workQueues?.stale ?? []).map((packet) => packet.id).join(", ") || "none"}`,
    "",
    "## Open questions",
    "",
    ...(openQuestions.length > 0
      ? openQuestions.filter((item) => item.status !== "answered").map((question) => `- ${question.id}: ${question.summary}`)
      : ["- No open questions recorded."]),
    "",
    "## Recent decisions",
    "",
    ...(decisions.length > 0
      ? decisions.slice(-10).reverse().map((decision) => `- ${decision.id}: ${decision.summary}`)
      : ["- No decisions recorded."]),
    "",
    "## Workspace overview",
    "",
    `- Active roles: ${(workspaceIndex.activeRoles ?? []).join(", ") || "none"}`,
    `- Unresolved concerns: ${(workspaceIndex.unresolvedConcernIds ?? []).join(", ") || "none"}`,
    `- Dependency health: blocked=${workspaceIndex.dependencyHealth?.blockedPacketIds?.length ?? 0} waiting=${workspaceIndex.dependencyHealth?.waitingPacketIds?.length ?? 0} stale=${workspaceIndex.dependencyHealth?.stalePacketIds?.length ?? 0} missing=${workspaceIndex.dependencyHealth?.missingDependencyIds?.length ?? 0}`,
    `- Handoff obligations: ${(workspaceIndex.handoffObligations ?? []).map((item) => item.packetId).join(", ") || "none"}`,
    `- Repair frontier: ${workspaceIndex.repairFrontier?.count ?? 0} items`,
    ...((workspaceIndex.repairFrontier?.prioritizedItems ?? []).slice(0, 4).map((item) => `  - ${item.frontierType}: ${item.summary}`)),
    `- Meta-optimize frontier: ${workspaceIndex.metaOptimize?.recommendationCount ?? 0} recommendations (${workspaceIndex.metaOptimize?.criticalCount ?? 0} critical)`,
    `- Meta-optimize report: ${workspaceIndex.metaOptimize?.reportPath ?? ARTIFACT_PATHS.metaOptimizerReport}`,
    "",
    "## Role context manifests",
    "",
    ...roleRoster.map((role) => `- ${role.id}: ${path.join(ARTIFACT_PATHS.roleContextsDir, `${role.id}.json`)}`)
  ].join("\n");
}

function renderNavigationReport(board, taskGraph, openQuestions, decisions, versionsIndex, comparisons, workspaceIndex) {
  const readyForHandoff = sortPacketsForQueue(taskGraph.nodes.filter((packet) => packet.lifecycleStatus === "ready-for-handoff"));
  const stalePackets = sortPacketsForQueue(taskGraph.nodes.filter((packet) => packet.lifecycleStatus === "stale"));
  return [
    "# Navigation",
    "",
    `- Phase: ${board.currentPhase}`,
    `- Intent: ${board.intentType}`,
    `- Assigned role: ${board.assignedRole}`,
    `- Current focus: ${board.currentFocus}`,
    `- Next action: ${board.nextAction}`,
    "",
    "## Task graph",
    "",
    ...(taskGraph.nodes.length > 0
      ? taskGraph.nodes.map((packet) => `- ${packet.id}: ${packet.title} [${packet.status} | ${packet.lifecycleStatus}] parent=${packet.parentPacketId || "none"} depends on ${packet.dependencies.join(", ") || "none"} dependency-health=${packet.dependencyHealth?.state ?? "clear"} → next ${packet.nextAction}`)
      : ["- No task packets generated yet."]),
    "",
    "## Operating queues",
    "",
    `- Ready for handoff: ${readyForHandoff.map((packet) => packet.id).join(", ") || "none"}`,
    `- Stale packets: ${stalePackets.map((packet) => packet.id).join(", ") || "none"}`,
    `- Repair frontier items: ${workspaceIndex.repairFrontier?.count ?? 0}`,
    ...((workspaceIndex.repairFrontier?.prioritizedItems ?? []).slice(0, 5).map((item) => `  - ${item.frontierType}: ${item.summary}`)),
    `- Meta-optimize recommendations: ${workspaceIndex.metaOptimize?.recommendationCount ?? 0}`,
    `- Meta-optimize critical items: ${workspaceIndex.metaOptimize?.criticalCount ?? 0}`,
    `- Meta-optimize report: ${workspaceIndex.metaOptimize?.reportPath ?? ARTIFACT_PATHS.metaOptimizerReport}`,
    "",
    "## Open questions",
    "",
    ...(openQuestions.length > 0
      ? openQuestions.filter((item) => item.status !== "answered").map((question) => `- ${question.id}: ${question.summary}`)
      : ["- No open questions recorded yet."]),
    "",
    "## Decisions",
    "",
    ...(decisions.length > 0
      ? decisions.slice(-12).reverse().map((decision) => `- ${decision.id}: ${decision.summary}`)
      : ["- No durable decisions recorded yet."]),
    "",
    "## Lineage",
    "",
    `- Current version: ${versionsIndex.currentVersionId ?? "none"}`,
    `- Snapshots: ${(versionsIndex.items ?? []).map((item) => item.id).join(", ") || "none"}`,
    `- Active comparison targets: ${(comparisons.activeTargets ?? []).join(", ") || "none"}`
  ].join("\n");
}

function buildRoleManifest(role, packets, openQuestions, decisions, workspaceIndex) {
  const rolePackets = packets.filter((packet) => packet.assignedRole === role.id && packet.active);
  const roleQuestionIds = rolePackets.flatMap((packet) => (packet.questions ?? []).filter((item) => item.status !== "answered").map((item) => item.id));
  const roleDecisionIds = decisions.filter((item) => item.packetId ? rolePackets.some((packet) => packet.id === item.packetId) : ["board-current-role", "board-next-action"].includes(item.id)).map((item) => item.id);
  const localArtifactContextPaths = uniqueSorted(roleContextPaths(role.id).map(artifactContextPath));
  const actionBundlePath = actionContextPath(`role-${role.id}`);
  return {
    version: 1,
    roleId: role.id,
    label: role.label,
    charter: role.charter,
    contextPaths: roleContextPaths(role.id),
    localArtifactContextPaths,
    activeTaskPacketIds: rolePackets.map((packet) => packet.id),
    packetContextPaths: rolePackets.map((packet) => packet.packetContextPath),
    actionContextPath: actionBundlePath,
    preActionReadPaths: uniqueSorted([
      actionBundlePath,
      path.join(ARTIFACT_PATHS.roleContextsDir, `${role.id}.json`),
      path.join(ARTIFACT_PATHS.phaseContextsDir, `${workspaceIndex.boardPhase}.json`),
      ...rolePackets.map((packet) => packet.packetContextPath),
      ...localArtifactContextPaths
    ]),
    behaviorDiscipline: {
      summary: `Read the nearest role, packet, and artifact context before acting as ${role.id}.`,
      localRules: [
        "Prefer the narrowest durable guidance surface that matches the task.",
        "Do not treat board ownership as permission to skip packet or artifact-local guidance.",
        "Keep role decisions and handoffs explicit in durable artifacts."
      ]
    },
    openQuestionIds: Array.from(new Set(roleQuestionIds.concat(openQuestions.filter((item) => item.origin === "review-state" && role.id === "reviewer").map((item) => item.id)))),
    decisionIds: Array.from(new Set(roleDecisionIds)),
    workspaceIndexPath: ARTIFACT_PATHS.workspaceIndex,
    isCurrentBoardOwner: workspaceIndex.boardAssignedRole === role.id,
    boardPhase: workspaceIndex.boardPhase,
    boardAssignedRole: workspaceIndex.boardAssignedRole,
    boardIntentType: workspaceIndex.boardIntentType,
    currentFocus: rolePackets[0]?.currentFocus ?? workspaceIndex.currentFocus ?? null,
    queueSummary: workspaceIndex.ownershipSummary?.find((entry) => entry.roleId === role.id) ?? null,
    handoffCandidateIds: (workspaceIndex.handoffObligations ?? []).filter((item) => item.toRole === role.id || item.fromRole === role.id).map((item) => item.packetId),
    generatedAt: nowIso()
  };
}

function buildPhaseManifest(board, packets, workspaceIndex) {
  const phasePackets = sortPacketsForQueue(packets.filter((packet) => packet.phase === board.currentPhase && packet.active));
  const artifactContextPaths = uniqueSorted([
    artifactContextPath(ARTIFACT_PATHS.orchestrationBoard),
    artifactContextPath(ARTIFACT_PATHS.workspaceIndex),
    artifactContextPath(ARTIFACT_PATHS.navigationReport),
    ...phasePackets.flatMap((packet) => [packet.packetPath, ...(packet.outputPaths ?? []), ...(packet.evidenceLinks ?? [])].filter(Boolean).map(artifactContextPath))
  ]);
  const actionBundlePath = actionContextPath(`phase-${board.currentPhase}`);
  return {
    version: 1,
    phaseId: board.currentPhase,
    intentType: board.intentType,
    currentFocus: board.currentFocus,
    nextAction: board.nextAction,
    assignedRole: board.assignedRole,
    activePacketIds: phasePackets.map((packet) => packet.id),
    blockerIds: packets.filter((packet) => packet.sourceType === "blocker" && packet.active).map((packet) => packet.id),
    queueSummary: {
      ready: phasePackets.filter((packet) => ["active", "queued"].includes(packet.lifecycleStatus)).map((packet) => packet.id),
      waiting: phasePackets.filter((packet) => ["waiting", "blocked"].includes(packet.lifecycleStatus)).map((packet) => packet.id),
      reviewNeeded: phasePackets.filter((packet) => packet.lifecycleStatus === "review-needed").map((packet) => packet.id),
      handoff: phasePackets.filter((packet) => packet.lifecycleStatus === "ready-for-handoff").map((packet) => packet.id),
      stale: phasePackets.filter((packet) => packet.lifecycleStatus === "stale").map((packet) => packet.id)
    },
    contextPaths: uniqueSorted([
      ARTIFACT_PATHS.orchestrationBoard,
      ARTIFACT_PATHS.orchestrationHandoffs,
      ARTIFACT_PATHS.taskPacketsIndex,
      ARTIFACT_PATHS.workspaceIndex,
      ARTIFACT_PATHS.sessionSummary,
      ARTIFACT_PATHS.navigationReport,
      ...phasePackets.map((packet) => packet.packetContextPath)
    ]),
    artifactContextPaths,
    actionContextPath: actionBundlePath,
    preActionReadPaths: uniqueSorted([
      actionBundlePath,
      path.join(ARTIFACT_PATHS.roleContextsDir, `${board.assignedRole}.json`),
      path.join(ARTIFACT_PATHS.phaseContextsDir, `${board.currentPhase}.json`),
      ...phasePackets.map((packet) => packet.packetContextPath),
      ...artifactContextPaths
    ]),
    behaviorDiscipline: {
      summary: "Use this phase manifest to narrow local guidance before phase-scoped work.",
      localRules: [
        "Start with the board owner and queue state, then drop into packet and artifact context.",
        "Treat stale, review-needed, and handoff packets as higher-priority than general queue work.",
        "Keep phase guidance explicit and file-backed."
      ]
    },
    resumeGuidance: workspaceIndex.resumeGuidance,
    generatedAt: nowIso()
  };
}

function severityRank(value) {
  return value === "high" ? 0 : value === "medium" ? 1 : 2;
}

function recommendationSortRank(value) {
  return value === "critical" ? 0 : value === "high" ? 1 : value === "medium" ? 2 : 3;
}

function summarizeLinkedEvidence(paths = [], ids = []) {
  return uniqueSorted([...(paths ?? []), ...(ids ?? [])]);
}

function pushMetaEvent(collection, event = {}) {
  collection.push({
    id: event.id,
    signalType: event.signalType,
    severity: event.severity ?? "medium",
    summary: event.summary,
    evidenceArtifactPaths: uniqueSorted(event.evidenceArtifactPaths ?? []),
    evidenceIds: uniqueSorted(event.evidenceIds ?? []),
    recommendationIds: uniqueSorted(event.recommendationIds ?? []),
    observedAt: event.observedAt ?? nowIso()
  });
}

function pushRecommendation(collection, recommendation = {}) {
  collection.push({
    id: recommendation.id,
    category: recommendation.category,
    priority: recommendation.priority ?? "medium",
    proposalOnly: true,
    summary: recommendation.summary,
    rationale: recommendation.rationale,
    nextAction: recommendation.nextAction,
    scope: recommendation.scope ?? "workflow",
    responseOwnerRole: recommendation.responseOwnerRole ?? null,
    evidenceArtifactPaths: uniqueSorted(recommendation.evidenceArtifactPaths ?? []),
    evidenceIds: uniqueSorted(recommendation.evidenceIds ?? []),
    signalTypes: uniqueSorted(recommendation.signalTypes ?? []),
    relatedRecommendationIds: uniqueSorted(recommendation.relatedRecommendationIds ?? []),
    generatedAt: recommendation.generatedAt ?? nowIso()
  });
}

function buildRepairFrontier(wikiRelations, figureQa) {
  const relationItems = (wikiRelations.items ?? [])
    .filter((relation) => relation.integrity?.status === "degraded")
    .map((relation) => ({
      id: `repair-${relation.id}`,
      frontierType: "typed-wiki-relation",
      severity: relation.integrity?.severity ?? "medium",
      summary: `Repair typed wiki relation ${relation.id} (${relation.relationType}).`,
      reasons: (relation.integrity?.reasons ?? []).map((reason) => reason.message).join(" "),
      reasonCodes: uniqueSorted((relation.integrity?.reasons ?? []).map((reason) => reason.code)),
      artifactPath: ARTIFACT_PATHS.wikiRelations,
      relatedArtifactPaths: uniqueSorted([ARTIFACT_PATHS.wikiEntities, ...(relation.sourceArtifactPaths ?? [])]),
      nextAction: `Repair the local artifacts for ${relation.id}, then rerun project:paper.wiki or refresh_wiki.`
    }));
  const figureItems = (figureQa.issues ?? []).map((issue) => ({
    id: `repair-${issue.id}`,
    frontierType: "figure-qa",
    severity: issue.severity ?? "medium",
    summary: `Repair figure artifact issue ${issue.id}.`,
    reasons: issue.summary ?? `Figure issue ${issue.code}.`,
    reasonCodes: uniqueSorted([issue.code]),
    artifactPath: ARTIFACT_PATHS.figureQa,
    relatedArtifactPaths: uniqueSorted([ARTIFACT_PATHS.figuresIndex, ...(issue.artifactPaths ?? [])]),
    nextAction: `Repair the staged figure artifacts for ${issue.figureId ?? issue.id}, then rerun validate_figure_pipeline.`
  }));
  const prioritizedItems = [...relationItems, ...figureItems]
    .sort((left, right) => {
      const severityDelta = severityRank(left.severity) - severityRank(right.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, 12);
  return {
    count: relationItems.length + figureItems.length,
    relationIssueCount: relationItems.length,
    managedArtifactIssueCount: figureItems.length,
    prioritizedItems
  };
}

function buildMetaOptimizeSurface({ board, workspaceIndex, journal, reviewConcerns, reviewState, adversarialState, experimentAudits, bridgeLog, figureQa, comparisons }) {
  const events = [];
  const recommendations = [];
  const recentEntries = [...(journal.entries ?? [])].slice(-40);
  const unresolvedConcerns = (reviewConcerns.items ?? []).filter((item) => !["resolved", "retired"].includes(item.status));
  const escalatedConcerns = unresolvedConcerns.filter((item) => ["escalated", "contested"].includes(item.status));
  const recurringConcerns = unresolvedConcerns.filter((item) => (item.recurrenceCount ?? 0) >= 2);
  const blockedAudits = (experimentAudits.items ?? []).filter((item) => item.auditVerdict === "blocked" || (item.integrityFlags ?? []).length > 0);
  const heldBridges = (bridgeLog.items ?? []).filter((item) => item.bridgeStatus === "held-for-review" || item.auditVerdict === "blocked" || (item.auditIds ?? []).length === 0);
  const figureIssues = figureQa.issues ?? [];
  const stalePackets = workspaceIndex.workQueues?.stale ?? [];
  const handoffObligations = workspaceIndex.handoffObligations ?? [];
  const latestComparison = (comparisons.items ?? []).at(-1) ?? null;
  const repairItems = workspaceIndex.repairFrontier?.prioritizedItems ?? [];
  const repeatedRepairishEvents = recentEntries.reduce((accumulator, entry) => {
    if (!/(review|revision|audit|bridge|figure|version|workspace-index|meta-optimize)/.test(entry.type ?? "")) {
      return accumulator;
    }
    accumulator[entry.type] = (accumulator[entry.type] ?? 0) + 1;
    return accumulator;
  }, {});

  for (const concern of escalatedConcerns) {
    const recommendationId = `meta-review-${concern.id}`;
    pushMetaEvent(events, {
      id: `event-${recommendationId}`,
      signalType: "review-concern",
      severity: concern.severity === "high" ? "high" : "medium",
      summary: `Concern ${concern.id} remains ${concern.status} after ${concern.recurrenceCount} review rounds.`,
      evidenceArtifactPaths: [ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.adversarialReviewState, ARTIFACT_PATHS.reviewState],
      evidenceIds: [concern.id],
      recommendationIds: [recommendationId]
    });
    pushRecommendation(recommendations, {
      id: recommendationId,
      category: "review-discipline",
      priority: concern.severity === "high" ? "critical" : "high",
      summary: `Escalate durable workflow attention to review concern ${concern.id}.`,
      rationale: `The concern is still ${concern.status} with recurrence count ${concern.recurrenceCount}, so the workflow is repeatedly revisiting the same review debt without closure.`,
      nextAction: `Resolve concern ${concern.id}, update the linked artifacts, then rerun project:paper.review-loop before finalization claims.`,
      scope: "review-artifact health",
      responseOwnerRole: concern.responseOwnerRole,
      evidenceArtifactPaths: summarizeLinkedEvidence([ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.adversarialReviewState, ARTIFACT_PATHS.reviewState], concern.linkedArtifactPaths),
      evidenceIds: [concern.id, ...(concern.linkedAuditIds ?? []), ...(concern.linkedBridgeIds ?? [])],
      signalTypes: ["review-concern", "adversarial-review"]
    });
  }

  for (const concern of recurringConcerns.filter((item) => !escalatedConcerns.some((other) => other.id === item.id)).slice(0, 4)) {
    const recommendationId = `meta-recurring-review-${concern.id}`;
    pushMetaEvent(events, {
      id: `event-${recommendationId}`,
      signalType: "recurring-review-concern",
      severity: "medium",
      summary: `Concern ${concern.id} has recurred across ${concern.recurrenceCount} review rounds.`,
      evidenceArtifactPaths: [ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.reviewState],
      evidenceIds: [concern.id],
      recommendationIds: [recommendationId]
    });
    pushRecommendation(recommendations, {
      id: recommendationId,
      category: "repair-pattern",
      priority: "high",
      summary: `Turn recurring concern ${concern.id} into a more explicit workflow checkpoint.`,
      rationale: `The same concern has been seen ${concern.recurrenceCount} times, which suggests the current workflow guidance is not forcing a durable close-out step.`,
      nextAction: `Add an explicit checklist or revision-plan item tied to ${concern.id} so future passes verify closure instead of rediscovering the same issue.`,
      scope: "workflow checkpointing",
      responseOwnerRole: concern.responseOwnerRole,
      evidenceArtifactPaths: summarizeLinkedEvidence([ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.reviewState], concern.linkedArtifactPaths),
      evidenceIds: [concern.id],
      signalTypes: ["review-concern"]
    });
  }

  for (const item of repairItems.slice(0, 5)) {
    const recommendationId = `meta-repair-${slugify(item.id)}`;
    pushMetaEvent(events, {
      id: `event-${recommendationId}`,
      signalType: item.frontierType,
      severity: item.severity ?? "medium",
      summary: item.summary,
      evidenceArtifactPaths: [item.artifactPath, ...(item.relatedArtifactPaths ?? [])],
      evidenceIds: [item.id],
      recommendationIds: [recommendationId]
    });
    pushRecommendation(recommendations, {
      id: recommendationId,
      category: "artifact-health",
      priority: item.severity === "high" ? "critical" : "high",
      summary: `Keep ${item.frontierType} visible as explicit repair work, not background maintenance.`,
      rationale: item.reasons || `The repair frontier still carries ${item.frontierType} debt, so the workflow should preserve an explicit repair surface until it clears.`,
      nextAction: item.nextAction,
      scope: "artifact health",
      evidenceArtifactPaths: [item.artifactPath, ...(item.relatedArtifactPaths ?? [])],
      evidenceIds: [item.id, ...(item.reasonCodes ?? [])],
      signalTypes: [item.frontierType]
    });
  }

  for (const audit of blockedAudits.slice(0, 4)) {
    const recommendationId = `meta-audit-${audit.id}`;
    pushMetaEvent(events, {
      id: `event-${recommendationId}`,
      signalType: "experiment-audit",
      severity: audit.auditVerdict === "blocked" ? "high" : "medium",
      summary: `Audit ${audit.id} is ${audit.auditVerdict} with integrity flags: ${(audit.integrityFlags ?? []).join(", ") || "none"}.`,
      evidenceArtifactPaths: [ARTIFACT_PATHS.experimentAudits],
      evidenceIds: [audit.id, ...(audit.integrityFlags ?? [])],
      recommendationIds: [recommendationId]
    });
    pushRecommendation(recommendations, {
      id: recommendationId,
      category: "experiment-integrity",
      priority: audit.auditVerdict === "blocked" ? "critical" : "high",
      summary: `Treat audit ${audit.id} as a workflow gate before more claim promotion.`,
      rationale: `This audit is not clean, so downstream claim updates or review closure would be relying on unstable experiment evidence.`,
      nextAction: `Repair the experiment artifacts referenced by ${audit.id}, rerun project:paper.experiment-audit, and only then bridge results into claims.`,
      scope: "experiment integrity",
      responseOwnerRole: "experiment-planner",
      evidenceArtifactPaths: [ARTIFACT_PATHS.experimentAudits, ...(audit.reviewedArtifactRefs ?? [])],
      evidenceIds: [audit.id, audit.resultId, audit.experimentId, ...(audit.integrityFlags ?? [])],
      signalTypes: ["experiment-audit"]
    });
  }

  for (const bridge of heldBridges.slice(0, 4)) {
    const recommendationId = `meta-bridge-${bridge.id}`;
    pushMetaEvent(events, {
      id: `event-${recommendationId}`,
      signalType: "claim-bridge",
      severity: bridge.auditVerdict === "blocked" ? "high" : "medium",
      summary: `Bridge ${bridge.id} is ${bridge.bridgeStatus} with audit verdict ${bridge.auditVerdict ?? "missing"}.`,
      evidenceArtifactPaths: [ARTIFACT_PATHS.claimBridgeLog],
      evidenceIds: [bridge.id, bridge.resultId, bridge.experimentId],
      recommendationIds: [recommendationId]
    });
    pushRecommendation(recommendations, {
      id: recommendationId,
      category: "claim-bridge",
      priority: bridge.auditVerdict === "blocked" ? "critical" : "high",
      summary: `Keep claim bridge ${bridge.id} in proposal-only review until its audit trail is clean.`,
      rationale: bridge.reason ?? `The bridge is not safely applied, which means the workflow still needs an explicit review step before stronger claim status changes.`,
      nextAction: `Resolve the blocked or missing audits for ${bridge.id}, then rerun project:paper.result-bridge with the repaired evidence trail.`,
      scope: "result-to-claim transition health",
      responseOwnerRole: "experiment-planner",
      evidenceArtifactPaths: [ARTIFACT_PATHS.claimBridgeLog, ARTIFACT_PATHS.experimentAudits],
      evidenceIds: [bridge.id, bridge.resultId, bridge.experimentId, ...(bridge.auditIds ?? []), ...(bridge.integrityFlags ?? [])],
      signalTypes: ["claim-bridge", "experiment-audit"]
    });
  }

  if (stalePackets.length > 0 || handoffObligations.length > 0) {
    const recommendationId = "meta-work-queue-discipline";
    pushMetaEvent(events, {
      id: `event-${recommendationId}`,
      signalType: "workspace-queue",
      severity: stalePackets.length > 0 ? "medium" : "low",
      summary: `Workspace has ${stalePackets.length} stale packets and ${handoffObligations.length} handoff obligations.`,
      evidenceArtifactPaths: [ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.orchestrationBoard],
      evidenceIds: [...stalePackets.map((packet) => packet.id), ...handoffObligations.map((item) => item.packetId)],
      recommendationIds: [recommendationId]
    });
    pushRecommendation(recommendations, {
      id: recommendationId,
      category: "workflow-queue",
      priority: stalePackets.length > 0 ? "high" : "medium",
      summary: "Reduce stale or cross-role queue churn before adding more concurrent work.",
      rationale: `The workspace index already shows stale packets or unresolved handoffs, so more work will likely amplify coordination debt instead of closing it.`,
      nextAction: stalePackets[0]?.nextAction ?? handoffObligations[0]?.nextAction ?? board.nextAction,
      scope: "orchestration discipline",
      responseOwnerRole: board.assignedRole,
      evidenceArtifactPaths: [ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.orchestrationBoard],
      evidenceIds: [...stalePackets.map((packet) => packet.id), ...handoffObligations.map((item) => item.packetId)],
      signalTypes: ["workspace-queue"]
    });
  }

  if (latestComparison && (latestComparison.unresolvedConcernsAdded ?? []).length > 0) {
    const recommendationId = `meta-version-${latestComparison.id}`;
    pushMetaEvent(events, {
      id: `event-${recommendationId}`,
      signalType: "version-comparison",
      severity: "medium",
      summary: `Comparison ${latestComparison.id} introduced ${(latestComparison.unresolvedConcernsAdded ?? []).length} unresolved concerns.`,
      evidenceArtifactPaths: [ARTIFACT_PATHS.versionComparisons, ARTIFACT_PATHS.versionComparisonReport],
      evidenceIds: [latestComparison.id, ...(latestComparison.unresolvedConcernsAdded ?? [])],
      recommendationIds: [recommendationId]
    });
    pushRecommendation(recommendations, {
      id: recommendationId,
      category: "version-evolution",
      priority: "medium",
      summary: `Explain newly introduced concern debt in version comparison ${latestComparison.id}.`,
      rationale: `The latest comparison added unresolved concerns, so the version report should stay coupled to an explicit explanation of why those regressions were accepted or how they will be repaired.`,
      nextAction: `Review ${ARTIFACT_PATHS.versionComparisonReport} and connect the added unresolved concerns to concrete revision tasks before treating the newer version as stable.`,
      scope: "version comparison discipline",
      responseOwnerRole: "version-analyst",
      evidenceArtifactPaths: [ARTIFACT_PATHS.versionComparisons, ARTIFACT_PATHS.versionComparisonReport],
      evidenceIds: [latestComparison.id, ...(latestComparison.unresolvedConcernsAdded ?? [])],
      signalTypes: ["version-comparison"]
    });
  }

  for (const [eventType, count] of Object.entries(repeatedRepairishEvents).filter(([, count]) => count >= 4).slice(0, 3)) {
    const recommendationId = `meta-journal-${slugify(eventType)}`;
    pushMetaEvent(events, {
      id: `event-${recommendationId}`,
      signalType: "session-journal",
      severity: "low",
      summary: `Recent session journal repeated ${eventType} ${count} times.`,
      evidenceArtifactPaths: [ARTIFACT_PATHS.sessionJournal],
      evidenceIds: [eventType],
      recommendationIds: [recommendationId]
    });
    pushRecommendation(recommendations, {
      id: recommendationId,
      category: "workflow-observability",
      priority: "low",
      summary: `Inspect whether repeated ${eventType} actions indicate workflow churn.`,
      rationale: `The journal shows ${count} recent ${eventType} events, which can be a signal that operators are repeatedly refreshing or repairing the same surface instead of closing a durable issue.`,
      nextAction: `Inspect the newest ${eventType} entries in ${ARTIFACT_PATHS.sessionJournal} and decide whether a narrower checklist, artifact rule, or review checkpoint should make the next step more explicit.`,
      scope: "session/workflow observability",
      responseOwnerRole: board.assignedRole,
      evidenceArtifactPaths: [ARTIFACT_PATHS.sessionJournal],
      evidenceIds: [eventType],
      signalTypes: ["session-journal"]
    });
  }

  const sortedRecommendations = recommendations
    .sort((left, right) => {
      const priorityDelta = recommendationSortRank(left.priority) - recommendationSortRank(right.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, 12);
  const keptRecommendationIds = new Set(sortedRecommendations.map((item) => item.id));
  const sortedEvents = events
    .filter((item) => item.recommendationIds.some((id) => keptRecommendationIds.has(id)))
    .sort((left, right) => {
      const severityDelta = severityRank(left.severity) - severityRank(right.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return left.id.localeCompare(right.id);
    });
  const categoryCounts = sortedRecommendations.reduce((accumulator, item) => {
    accumulator[item.category] = (accumulator[item.category] ?? 0) + 1;
    return accumulator;
  }, {});
  const signalTypes = uniqueSorted(sortedRecommendations.flatMap((item) => item.signalTypes));
  const criticalCount = sortedRecommendations.filter((item) => item.priority === "critical").length;
  const metaEvents = {
    ...createMetaEventsIndex(),
    items: sortedEvents,
    updatedAt: nowIso()
  };
  const metaRecommendations = {
    ...createMetaRecommendationsIndex(),
    items: sortedRecommendations,
    summary: {
      recommendationCount: sortedRecommendations.length,
      criticalCount,
      categories: categoryCounts,
      signalTypes
    },
    updatedAt: nowIso()
  };
  const metaOptimizerState = {
    ...createMetaOptimizerState(),
    frontier: {
      recommendationCount: sortedRecommendations.length,
      criticalCount,
      activeSignalTypes: signalTypes,
      reportPath: ARTIFACT_PATHS.metaOptimizerReport,
      recommendationsPath: ARTIFACT_PATHS.metaRecommendations
    },
    lastRefreshedAt: nowIso(),
    updatedAt: nowIso()
  };
  const reportLines = [
    "# Latest optimizer report",
    "",
    "- Proposal only: true",
    `- Generated: ${nowIso()}`,
    `- Recommendation count: ${sortedRecommendations.length}`,
    `- Critical recommendations: ${criticalCount}`,
    `- Active signal types: ${signalTypes.join(", ") || "none"}`,
    `- Board phase: ${board.currentPhase}`,
    `- Board role: ${board.assignedRole}`,
    "",
    "## Evidence-backed recommendations",
    "",
    ...(sortedRecommendations.length > 0
      ? sortedRecommendations.flatMap((item) => [
          `### ${item.id} [${item.priority}]`,
          `- Category: ${item.category}`,
          `- Scope: ${item.scope}`,
          `- Summary: ${item.summary}`,
          `- Why: ${item.rationale}`,
          `- Next action: ${item.nextAction}`,
          `- Evidence artifacts: ${item.evidenceArtifactPaths.join(", ") || "none"}`,
          `- Evidence ids: ${item.evidenceIds.join(", ") || "none"}`,
          `- Response owner: ${item.responseOwnerRole ?? "none"}`,
          ""
        ])
      : ["- No recommendations generated from the current durable signals."]),
    "## Signal observations",
    "",
    ...(sortedEvents.length > 0
      ? sortedEvents.map((item) => `- [${item.severity}] ${item.signalType}: ${item.summary}`)
      : ["- No signal observations captured."]),
    "",
    "## Explicit non-goals",
    "",
    "- This layer does not auto-apply workflow, prompt, code, or config changes.",
    "- This layer only summarizes durable signals and recommends explicit next steps.",
    "- Operators must choose whether to act on any recommendation."
  ];

  return {
    metaEvents,
    metaRecommendations,
    metaOptimizerState,
    metaOptimizerReport: reportLines.join("\n")
  };
}

function buildWorkspaceIndex(state, board, packets, reviewState, journal, versionsIndex, comparisons, wikiRelations, figureQa, metaOptimize = null) {
  const base = createWorkspaceIndex();
  const packetById = new Map(packets.map((packet) => [packet.id, packet]));
  const enrichedPackets = sortPacketsForQueue(packets.map((packet) => ({
    ...packet,
    dependencyHealth: buildPacketDependencyHealth(packet, packetById)
  })));
  const lifecycleCounts = enrichedPackets.reduce((accumulator, packet) => {
    accumulator[packet.lifecycleStatus] = (accumulator[packet.lifecycleStatus] ?? 0) + 1;
    return accumulator;
  }, {});
  const readyPackets = enrichedPackets.filter((packet) => packet.active && ["queued", "active"].includes(packet.lifecycleStatus));
  const waitingPackets = enrichedPackets.filter((packet) => packet.lifecycleStatus === "waiting" || packet.lifecycleStatus === "blocked");
  const reviewNeededPackets = enrichedPackets.filter((packet) => packet.lifecycleStatus === "review-needed");
  const handoffPackets = enrichedPackets.filter((packet) => packet.lifecycleStatus === "ready-for-handoff");
  const stalePackets = enrichedPackets.filter((packet) => packet.lifecycleStatus === "stale");
  const archivedPackets = enrichedPackets.filter((packet) => GOVERNANCE_TERMINAL_LIFECYCLES.has(packet.lifecycleStatus));
  const ownershipSummary = buildOwnershipSummary(board, enrichedPackets);
  const dependencyHealth = {
    blockedPacketIds: uniqueSorted(enrichedPackets.filter((packet) => packet.dependencyHealth.state === "blocked-by-dependencies").map((packet) => packet.id)),
    healthyPacketIds: uniqueSorted(enrichedPackets.filter((packet) => packet.dependencyHealth.state === "clear").map((packet) => packet.id)),
    waitingPacketIds: uniqueSorted(waitingPackets.map((packet) => packet.id)),
    stalePacketIds: uniqueSorted(stalePackets.map((packet) => packet.id)),
      missingDependencyIds: uniqueSorted(enrichedPackets.flatMap((packet) => packet.dependencyHealth.missingDependencyIds)),
      orphanPacketIds: uniqueSorted(enrichedPackets.filter((packet) => packet.parentPacketId && !packetById.has(packet.parentPacketId)).map((packet) => packet.id))
  };
  const repairFrontier = buildRepairFrontier(wikiRelations, figureQa);
  const handoffObligations = handoffPackets.map((packet) => ({
    packetId: packet.id,
    fromRole: board.assignedRole,
    toRole: packet.assignedRole,
    summary: `${packet.id} is active under ${packet.assignedRole} while the board owner is ${board.assignedRole}.`,
    nextAction: packet.nextAction,
    packetContextPath: packet.packetContextPath
  }));
  const prioritizedPackets = [
    ...stalePackets,
    ...reviewNeededPackets,
    ...handoffPackets,
    ...waitingPackets,
    ...readyPackets
  ];
  const prioritizedArtifactContextPaths = uniqueSorted([
    artifactContextPath(ARTIFACT_PATHS.orchestrationBoard),
    artifactContextPath(ARTIFACT_PATHS.workspaceIndex),
    artifactContextPath(ARTIFACT_PATHS.navigationReport),
    ...repairFrontier.prioritizedItems.flatMap((item) => [item.artifactPath, ...(item.relatedArtifactPaths ?? [])].filter(Boolean).map(artifactContextPath)),
    ...prioritizedPackets.flatMap((packet) => [packet.packetPath, ...(packet.outputPaths ?? []), ...(packet.evidenceLinks ?? [])].filter(Boolean).map(artifactContextPath))
  ]);
  return {
    ...base,
    currentFocus: board.currentFocus,
    nextAction: board.nextAction,
    boardPhase: board.currentPhase,
    boardAssignedRole: board.assignedRole,
    boardIntentType: board.intentType,
    continuationState: board.continuationState,
    activePackets: enrichedPackets.filter((packet) => packet.active).map(summarizePacket),
    workQueues: {
      ready: readyPackets.map(summarizePacket),
      waiting: waitingPackets.map(summarizePacket),
      reviewNeeded: reviewNeededPackets.map(summarizePacket),
      handoff: handoffPackets.map(summarizePacket),
      stale: stalePackets.map(summarizePacket),
      archived: archivedPackets.map(summarizePacket)
    },
    ownershipSummary,
    packetLifecycleCounts: lifecycleCounts,
    handoffObligations,
    resumeGuidance: {
      command: state.pipeline.resumeCommand ?? resolveResumeCommandForPhase(board.currentPhase),
      summary: repairFrontier.prioritizedItems[0]?.nextAction ?? prioritizedPackets[0]?.nextAction ?? board.nextAction,
      prioritizedPacketIds: prioritizedPackets.map((packet) => packet.id),
      packetContextPaths: prioritizedPackets.slice(0, 8).map((packet) => packet.packetContextPath),
      handoffCandidateIds: handoffPackets.map((packet) => packet.id)
    },
    contextSurfaces: {
      currentRoleContextPath: path.join(ARTIFACT_PATHS.roleContextsDir, `${board.assignedRole}.json`),
      currentPhaseContextPath: path.join(ARTIFACT_PATHS.phaseContextsDir, `${board.currentPhase}.json`),
      currentActionContextPath: actionContextPath("current"),
      prioritizedArtifactContextPaths,
      prioritizedPacketActionContextPaths: prioritizedPackets.slice(0, 8).map((packet) => actionContextPath(`packet-${packet.id}`))
    },
    behaviorDiscipline: {
      summary: "Read the current action bundle, then the role/phase/packet/artifact context surfaces before mutating durable state.",
      explicitOnly: true,
      noHiddenRuntime: true,
      requiredReadOrder: uniqueSorted([
        actionContextPath("current"),
        path.join(ARTIFACT_PATHS.roleContextsDir, `${board.assignedRole}.json`),
        path.join(ARTIFACT_PATHS.phaseContextsDir, `${board.currentPhase}.json`),
        ...prioritizedPackets.slice(0, 3).map((packet) => packet.packetContextPath),
        ...prioritizedArtifactContextPaths.slice(0, 6)
      ])
    },
    dependencyHealth,
    repairFrontier,
    metaOptimize: metaOptimize ?? base.metaOptimize,
    activeRoles: Array.from(new Set([board.assignedRole, ...enrichedPackets.filter((packet) => packet.active).map((packet) => packet.assignedRole)])),
    unresolvedConcernIds: reviewState.unresolvedConcernIds ?? [],
    mostRecentSessions: [...(journal.entries ?? [])].slice(-10).reverse().map((entry) => ({
      id: entry.id,
      type: entry.type,
      phase: entry.phase,
      summary: entry.summary,
      timestamp: entry.timestamp
    })),
    latestVersions: {
      currentVersionId: versionsIndex.currentVersionId,
      activeTargets: comparisons.activeTargets ?? [],
      latestSnapshotIds: (versionsIndex.items ?? []).slice(-5).map((item) => item.id)
    },
    updatedAt: nowIso()
  };
}

export function refreshDurableSurfaces(root, event = {}) {
  ensureWorkspace(root);
  const state = loadState(root);
  const board = readJson(root, ARTIFACT_PATHS.orchestrationBoard, () => createDefaultBoard(state));
  const notesIndex = readJson(root, ARTIFACT_PATHS.notes, { version: 1, items: [], updatedAt: null });
  const reviewState = readJson(root, ARTIFACT_PATHS.reviewState, { version: 2, history: [], openItems: [], lastVerdict: "not-reviewed", lastReviewedAt: null, unresolvedConcernIds: [] });
  const reviewConcerns = readJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 2, items: [], updatedAt: null });
  const adversarialState = readJson(root, ARTIFACT_PATHS.adversarialReviewState, { version: 2, unresolvedConcernIds: [], escalatedConcernIds: [], pendingAuthorResponseIds: [], pendingReviewerRulingIds: [], concernStatusCounts: {}, updatedAt: null });
  const plansIndex = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const experimentAudits = readJson(root, ARTIFACT_PATHS.experimentAudits, { version: 1, items: [], updatedAt: null });
  const bridgeLog = readJson(root, ARTIFACT_PATHS.claimBridgeLog, { version: 1, items: [], updatedAt: null });
  const issuesIndex = readJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null });
  const versionsIndex = readJson(root, ARTIFACT_PATHS.versionsIndex, createVersionsIndex);
  const comparisons = readJson(root, ARTIFACT_PATHS.versionComparisons, createVersionComparisonsIndex);
  const taskPacketIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, createTaskPacketsIndex);
  const wikiEntities = readJson(root, ARTIFACT_PATHS.wikiEntities, createWikiEntitiesIndex);
  const wikiRelations = readJson(root, ARTIFACT_PATHS.wikiRelations, createWikiRelationsIndex);
  const figureQa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [], updatedAt: null });

  const existingById = loadExistingPacketMap(root, taskPacketIndex.items ?? []);
  const refreshed = [
    ...deriveBoardPackets(board, existingById),
    ...deriveExperimentPackets(plansIndex),
    ...deriveIssuePackets(issuesIndex),
    ...deriveVersionPackets(versionsIndex)
  ].map((packet) => ({
    ...(existingById.get(packet.id) ?? {}),
    ...packet,
    questions: packet.questions,
    decisions: packet.decisions,
    lineage: packet.lineage,
    continuationState: packet.continuationState,
    updatedAt: packet.updatedAt
  }));

  const activeIds = new Set(refreshed.map((packet) => packet.id));
  const preserved = (taskPacketIndex.items ?? []).filter((packet) => !activeIds.has(packet.id) && !["task", "blocker", "experiment", "rebuttal-issue", "version"].includes(packet.sourceType));
  const packets = markInactiveLegacyPackets([...refreshed, ...preserved].map(normalizePacket), activeIds).sort((left, right) => left.id.localeCompare(right.id));
  const packetById = new Map(packets.map((packet) => [packet.id, packet]));
  const packetsWithHealth = packets.map((packet) => ({ ...packet, dependencyHealth: buildPacketDependencyHealth(packet, packetById) }));
  const lifecycleCounts = packetsWithHealth.reduce((accumulator, packet) => {
    accumulator[packet.lifecycleStatus] = (accumulator[packet.lifecycleStatus] ?? 0) + 1;
    return accumulator;
  }, {});
  const packetIndex = {
    version: 3,
    items: packetsWithHealth,
    lifecycleCounts,
    dependencyHealth: {
      blockedPacketIds: uniqueSorted(packetsWithHealth.filter((packet) => packet.dependencyHealth.state === "blocked-by-dependencies").map((packet) => packet.id)),
      readyPacketIds: uniqueSorted(packetsWithHealth.filter((packet) => packet.active && GOVERNANCE_ACTIVE_LIFECYCLES.has(packet.lifecycleStatus)).map((packet) => packet.id)),
      stalePacketIds: uniqueSorted(packetsWithHealth.filter((packet) => packet.lifecycleStatus === "stale").map((packet) => packet.id)),
      missingDependencyIds: uniqueSorted(packetsWithHealth.flatMap((packet) => packet.dependencyHealth.missingDependencyIds))
    },
    updatedAt: nowIso()
  };
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, packetIndex);
  for (const packet of packetsWithHealth) {
    writeJson(root, packetFilePath(packet.id), packet);
  }

  const openQuestions = buildOpenQuestions(notesIndex, packetsWithHealth, reviewState, wikiEntities).sort((left, right) => left.id.localeCompare(right.id));
  const decisions = buildDecisions(board, versionsIndex, comparisons, packetsWithHealth, wikiEntities);
  const taskGraph = buildTaskGraph(packetsWithHealth);
  const roleRoster = Array.isArray(board.roleRoster) ? board.roleRoster : [];

  const journal = readJson(root, ARTIFACT_PATHS.sessionJournal, createSessionJournal);
  const entry = {
    id: `${nowIso()}-${slugify(event.type ?? event.summary ?? "workspace-refresh")}`,
    timestamp: nowIso(),
    type: event.type ?? "workspace-refresh",
    summary: event.summary ?? `Refreshed durable surfaces during ${board.currentPhase}.`,
    phase: board.currentPhase,
    assignedRole: board.assignedRole,
     taskPacketIds: packetsWithHealth.filter((packet) => packet.active).map((packet) => packet.id),
     artifactPaths: normalizeStringArray(event.artifactPaths ?? [ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.sessionSummary, ARTIFACT_PATHS.navigationReport, ARTIFACT_PATHS.workspaceIndex])
   };
  const entries = [...(journal.entries ?? []).slice(-199), entry];
  writeJson(root, ARTIFACT_PATHS.sessionJournal, { version: 1, entries, updatedAt: nowIso() });

  const preliminaryWorkspaceIndex = buildWorkspaceIndex(state, board, packetsWithHealth, reviewState, { entries }, versionsIndex, comparisons, wikiRelations, figureQa);
  const metaOptimize = buildMetaOptimizeSurface({
    board,
    workspaceIndex: preliminaryWorkspaceIndex,
    journal: { entries },
    reviewConcerns,
    reviewState,
    adversarialState,
    experimentAudits,
    bridgeLog,
    figureQa,
    comparisons
  });
  const workspaceIndex = buildWorkspaceIndex(state, board, packetsWithHealth, reviewState, { entries }, versionsIndex, comparisons, wikiRelations, figureQa, {
    proposalOnly: true,
    recommendationCount: metaOptimize.metaRecommendations.items.length,
    criticalCount: metaOptimize.metaRecommendations.summary.criticalCount,
    activeSignalTypes: metaOptimize.metaRecommendations.summary.signalTypes,
    reportPath: ARTIFACT_PATHS.metaOptimizerReport,
    recommendationsPath: ARTIFACT_PATHS.metaRecommendations,
    statePath: ARTIFACT_PATHS.metaOptimizerState
  });
  writeJson(root, ARTIFACT_PATHS.workspaceIndex, workspaceIndex);
  writeJson(root, ARTIFACT_PATHS.metaEvents, metaOptimize.metaEvents);
  writeJson(root, ARTIFACT_PATHS.metaRecommendations, metaOptimize.metaRecommendations);
  writeJson(root, ARTIFACT_PATHS.metaOptimizerState, metaOptimize.metaOptimizerState);
  writeText(root, ARTIFACT_PATHS.metaOptimizerReport, metaOptimize.metaOptimizerReport);
  const packetByIdForManifest = new Map(packetsWithHealth.map((packet) => [packet.id, packet]));
  const artifactPaths = uniqueSorted([
    ARTIFACT_PATHS.orchestrationBoard,
    ARTIFACT_PATHS.orchestrationHandoffs,
    ARTIFACT_PATHS.taskPacketsIndex,
    ARTIFACT_PATHS.workspaceIndex,
    ARTIFACT_PATHS.metaEvents,
    ARTIFACT_PATHS.metaRecommendations,
    ARTIFACT_PATHS.metaOptimizerState,
    ARTIFACT_PATHS.metaOptimizerReport,
    ARTIFACT_PATHS.sessionSummary,
    ARTIFACT_PATHS.navigationReport,
    ...packetsWithHealth.flatMap((packet) => [packet.packetPath, ...(packet.outputPaths ?? []), ...(packet.evidenceLinks ?? [])].filter(Boolean))
  ]);
  for (const relativePath of artifactPaths) {
    writeJson(root, artifactContextPath(relativePath), buildArtifactContextManifest(root, relativePath, board, packetsWithHealth, workspaceIndex));
  }
  for (const packet of packetsWithHealth) {
    const manifest = buildPacketContextManifest(root, board, packet, packetByIdForManifest, workspaceIndex);
    writeJson(root, packet.packetContextPath, manifest);
    writeJson(root, actionContextPath(`packet-${packet.id}`), buildActionContextBundle({
      scopeType: "packet",
      scopeId: packet.id,
      summary: `Packet-scoped pre-action bundle for ${packet.id}.`,
      board,
      workspaceIndex,
      packet,
      roleId: packet.assignedRole,
      phaseId: packet.phase,
      requiredReadPaths: [
        packet.packetContextPath,
        path.join(ARTIFACT_PATHS.roleContextsDir, `${packet.assignedRole}.json`),
        path.join(ARTIFACT_PATHS.phaseContextsDir, `${packet.phase}.json`),
        ...manifest.artifactContextPaths
      ],
      localRules: manifest.behaviorDiscipline.localRules
    }));
  }
  for (const role of roleRoster) {
    const manifest = buildRoleManifest(role, packetsWithHealth, openQuestions, decisions, workspaceIndex);
    writeJson(root, path.join(ARTIFACT_PATHS.roleContextsDir, `${role.id}.json`), manifest);
    writeJson(root, actionContextPath(`role-${role.id}`), buildActionContextBundle({
      scopeType: "role",
      scopeId: role.id,
      summary: `Role-scoped pre-action bundle for ${role.id}.`,
      board,
      workspaceIndex,
      roleId: role.id,
      phaseId: workspaceIndex.boardPhase,
      requiredReadPaths: manifest.preActionReadPaths,
      localRules: manifest.behaviorDiscipline.localRules
    }));
  }
  const phaseManifestPath = path.join(ARTIFACT_PATHS.phaseContextsDir, `${board.currentPhase}.json`);
  const phaseManifest = buildPhaseManifest(board, packetsWithHealth, workspaceIndex);
  writeJson(root, phaseManifestPath, phaseManifest);
  writeJson(root, actionContextPath(`phase-${board.currentPhase}`), buildActionContextBundle({
    scopeType: "phase",
    scopeId: board.currentPhase,
    summary: `Phase-scoped pre-action bundle for ${board.currentPhase}.`,
    board,
    workspaceIndex,
    roleId: board.assignedRole,
    phaseId: board.currentPhase,
    requiredReadPaths: phaseManifest.preActionReadPaths,
    localRules: phaseManifest.behaviorDiscipline.localRules
  }));
  writeJson(root, actionContextPath("current"), buildActionContextBundle({
    scopeType: "current",
    scopeId: "current",
    summary: "Current workspace pre-action bundle. Read this before mutating durable workflow state.",
    board,
    workspaceIndex,
    roleId: board.assignedRole,
    phaseId: board.currentPhase,
    artifactPath: workspaceIndex.contextSurfaces?.prioritizedArtifactContextPaths?.[0] ?? null,
    requiredReadPaths: workspaceIndex.behaviorDiscipline.requiredReadOrder,
    localRules: [
      "Start from the current action bundle, then follow the required read order.",
      "Use packet and artifact-local guidance instead of broad top-level rules when available.",
      "Do not assume hidden rule loading; read the surfaced files explicitly before acting."
    ]
  }));

  writeText(root, ARTIFACT_PATHS.sessionSummary, renderSessionSummary(state, board, packetsWithHealth, openQuestions, decisions, roleRoster, workspaceIndex));
  writeText(root, ARTIFACT_PATHS.navigationReport, renderNavigationReport(board, taskGraph, openQuestions, decisions, versionsIndex, comparisons, workspaceIndex));

  return { packetIndex, openQuestions, decisions, taskGraph, workspaceIndex, metaOptimize: metaOptimize.metaOptimizerState };
}

export function queryTaskGraph(root) {
  const { taskGraph } = refreshDurableSurfaces(root, {
    type: "query-task-graph",
    summary: "Refreshed task graph query surface.",
    artifactPaths: [ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.navigationReport, ARTIFACT_PATHS.workspaceIndex]
  });
  return taskGraph;
}

export function queryOpenQuestions(root) {
  const { openQuestions } = refreshDurableSurfaces(root, {
    type: "query-open-questions",
    summary: "Refreshed open questions query surface.",
    artifactPaths: [ARTIFACT_PATHS.navigationReport, ARTIFACT_PATHS.sessionSummary]
  });
  return { items: openQuestions, count: openQuestions.length, reportPath: ARTIFACT_PATHS.navigationReport };
}

export function queryDecisions(root) {
  const { decisions } = refreshDurableSurfaces(root, {
    type: "query-decisions",
    summary: "Refreshed decisions query surface.",
    artifactPaths: [ARTIFACT_PATHS.navigationReport, ARTIFACT_PATHS.sessionSummary]
  });
  return { items: decisions, count: decisions.length, reportPath: ARTIFACT_PATHS.navigationReport };
}

export function queryLineage(root) {
  refreshDurableSurfaces(root, {
    type: "query-lineage",
    summary: "Refreshed lineage query surface.",
    artifactPaths: [ARTIFACT_PATHS.versionComparisons, ARTIFACT_PATHS.versionComparisonReport, ARTIFACT_PATHS.navigationReport, ARTIFACT_PATHS.workspaceIndex]
  });
  const versions = readJson(root, ARTIFACT_PATHS.versionsIndex, createVersionsIndex);
  const comparisons = readJson(root, ARTIFACT_PATHS.versionComparisons, createVersionComparisonsIndex);
  return {
    currentVersionId: versions.currentVersionId,
    lineage: versions.lineage ?? [],
    comparisons: comparisons.items ?? [],
    activeTargets: comparisons.activeTargets ?? [],
    reportPath: ARTIFACT_PATHS.navigationReport
  };
}

export function queryWorkspaceIndex(root) {
  const { workspaceIndex } = refreshDurableSurfaces(root, {
    type: "query-workspace-index",
    summary: "Refreshed workspace index query surface.",
    artifactPaths: [ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.sessionSummary]
  });
  return workspaceIndex;
}

export function queryMetaOptimize(root) {
  refreshDurableSurfaces(root, {
    type: "query-meta-optimize",
    summary: "Refreshed proposal-only meta-optimize surfaces.",
    artifactPaths: [ARTIFACT_PATHS.metaEvents, ARTIFACT_PATHS.metaRecommendations, ARTIFACT_PATHS.metaOptimizerState, ARTIFACT_PATHS.metaOptimizerReport, ARTIFACT_PATHS.workspaceIndex]
  });
  const events = readJson(root, ARTIFACT_PATHS.metaEvents, createMetaEventsIndex);
  const recommendations = readJson(root, ARTIFACT_PATHS.metaRecommendations, createMetaRecommendationsIndex);
  const state = readJson(root, ARTIFACT_PATHS.metaOptimizerState, createMetaOptimizerState);
  return {
    proposalOnly: true,
    events: events.items ?? [],
    recommendations: recommendations.items ?? [],
    summary: recommendations.summary ?? state.frontier,
    state,
    reportPath: ARTIFACT_PATHS.metaOptimizerReport,
    recommendationsPath: ARTIFACT_PATHS.metaRecommendations,
    eventsPath: ARTIFACT_PATHS.metaEvents
  };
}

export function readPhaseContextManifest(root, phaseId = null) {
  refreshDurableSurfaces(root, {
    type: "read-phase-context-manifest",
    summary: `Refreshed phase context manifest for ${phaseId ?? "current phase"}.`,
    artifactPaths: [path.join(ARTIFACT_PATHS.phaseContextsDir, `${phaseId ?? "current"}.json`), ARTIFACT_PATHS.workspaceIndex]
  });
  const board = readJson(root, ARTIFACT_PATHS.orchestrationBoard, createDefaultBoard);
  const resolvedPhaseId = phaseId ?? board.currentPhase;
  return readJson(root, path.join(ARTIFACT_PATHS.phaseContextsDir, `${resolvedPhaseId}.json`), null);
}

export function readRoleContextManifest(root, roleId) {
  if (!ROLE_IDS.includes(roleId)) {
    throw new Error(`Unknown roleId: ${roleId}`);
  }
  refreshDurableSurfaces(root, {
    type: "read-role-context-manifest",
    summary: `Refreshed role context manifest for ${roleId}.`,
    artifactPaths: [path.join(ARTIFACT_PATHS.roleContextsDir, `${roleId}.json`)]
  });
  return readJson(root, path.join(ARTIFACT_PATHS.roleContextsDir, `${roleId}.json`), null);
}

export function readPacketContextManifest(root, packetId) {
  const normalizedPacketId = slugify(packetId);
  refreshDurableSurfaces(root, {
    type: "read-packet-context-manifest",
    summary: `Refreshed packet context manifest for ${normalizedPacketId}.`,
    artifactPaths: [path.join(ARTIFACT_PATHS.packetContextsDir, `${normalizedPacketId}.json`), ARTIFACT_PATHS.workspaceIndex]
  });
  return readJson(root, path.join(ARTIFACT_PATHS.packetContextsDir, `${normalizedPacketId}.json`), null);
}

export function readArtifactContextManifest(root, artifactPath) {
  const normalizedArtifactPath = normalizeArtifactPath(artifactPath);
  refreshDurableSurfaces(root, {
    type: "read-artifact-context-manifest",
    summary: `Refreshed artifact context manifest for ${normalizedArtifactPath}.`,
    artifactPaths: [artifactContextPath(normalizedArtifactPath), ARTIFACT_PATHS.workspaceIndex]
  });
  return readJson(root, artifactContextPath(normalizedArtifactPath), null);
}

export function readActionContextBundle(root, args = {}) {
  const scopeType = args.scopeType ?? "current";
  let scopeId = "current";
  if (scopeType === "role") {
    scopeId = `role-${args.roleId}`;
  } else if (scopeType === "packet") {
    scopeId = `packet-${args.packetId}`;
  } else if (scopeType === "phase") {
    scopeId = `phase-${args.phaseId}`;
  } else if (scopeType === "artifact") {
    scopeId = `artifact-${normalizeArtifactPath(args.artifactPath)}`;
  }
  refreshDurableSurfaces(root, {
    type: "read-action-context-bundle",
    summary: `Refreshed action context bundle for ${scopeType}.`,
    artifactPaths: [actionContextPath(scopeId), ARTIFACT_PATHS.workspaceIndex]
  });

  if (scopeType === "artifact") {
    const artifactManifest = readArtifactContextManifest(root, args.artifactPath);
    return buildActionContextBundle({
      scopeType: "artifact",
      scopeId,
      summary: `Artifact-scoped pre-action bundle for ${artifactManifest?.artifactPath ?? normalizeArtifactPath(args.artifactPath)}.`,
      board: readJson(root, ARTIFACT_PATHS.orchestrationBoard, createDefaultBoard),
      workspaceIndex: readJson(root, ARTIFACT_PATHS.workspaceIndex, createWorkspaceIndex),
      artifactPath: artifactManifest?.artifactPath ?? normalizeArtifactPath(args.artifactPath),
      requiredReadPaths: [artifactContextPath(artifactManifest?.artifactPath ?? normalizeArtifactPath(args.artifactPath)), ...(artifactManifest?.readBeforeMutating ?? [])],
      localRules: artifactManifest?.localRules ?? []
    });
  }

  return readJson(root, actionContextPath(scopeId), null);
}

export function summarizeSessionJournal(root) {
  refreshDurableSurfaces(root, {
    type: "summarize-session-journal",
    summary: "Refreshed session summary surface.",
    artifactPaths: [ARTIFACT_PATHS.sessionJournal, ARTIFACT_PATHS.sessionSummary, ARTIFACT_PATHS.workspaceIndex]
  });
  const journal = readJson(root, ARTIFACT_PATHS.sessionJournal, createSessionJournal);
  return {
    entryCount: journal.entries?.length ?? 0,
    latestEntry: journal.entries?.at(-1) ?? null,
    summaryPath: ARTIFACT_PATHS.sessionSummary
  };
}

export function readBoundaryReport(root) {
  const boundaryPath = resolvePath(root, ARTIFACT_PATHS.workflowBoundaries);
  if (!fs.existsSync(boundaryPath)) {
    return {
      status: "missing",
      error: "Boundary policy file is missing.",
      boundaries: null,
      missingBootstrapArtifacts: [],
      userOwnedExistingPaths: []
    };
  }

  let boundaries;
  try {
    boundaries = JSON.parse(fs.readFileSync(boundaryPath, "utf8"));
  } catch (error) {
    return {
      status: "invalid",
      error: error instanceof Error ? error.message : String(error),
      boundaries: null,
      missingBootstrapArtifacts: [],
      userOwnedExistingPaths: []
    };
  }

  const missingBootstrapArtifacts = (boundaries.paperBootstrapOnlyPaths ?? []).filter((relativePath) => !fs.existsSync(resolvePath(root, relativePath)));
  return {
    status: "ok",
    boundaries,
    missingBootstrapArtifacts,
    userOwnedExistingPaths: (boundaries.userOwnedPaths ?? []).filter((relativePath) => fs.existsSync(resolvePath(root, relativePath)))
  };
}
