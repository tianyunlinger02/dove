import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  ROLE_IDS,
  createDefaultBoard,
  createMetaEventsIndex,
  createMetaLongHorizonMemory,
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
  normalizeMetaLongHorizonMemory,
  normalizeMetaOptimizerState,
  normalizeMetaRecommendationsIndex,
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
    `- Repair frontier: ${workspaceIndex.repairFrontier?.count ?? 0} items (relations ${(workspaceIndex.repairFrontier?.relationIssueCount ?? 0)}, degraded families ${(workspaceIndex.repairFrontier?.relationFamilyIssueCount ?? 0)}, managed artifacts ${(workspaceIndex.repairFrontier?.managedArtifactIssueCount ?? 0)})`,
    `- Relation taxonomy: ${workspaceIndex.repairFrontier?.taxonomyOverview ?? "No degraded typed wiki relation families are currently summarized."}`,
    ...((workspaceIndex.repairFrontier?.relationFamilySummaries ?? []).slice(0, 3).map((family) => `  - family ${family.id}: ${family.overview}`)),
    ...((workspaceIndex.repairFrontier?.relationGroupSummaries ?? []).slice(0, 3).map((group) => `  - group ${group.id}: ${group.overview}`)),
    ...((workspaceIndex.repairFrontier?.prioritizedItems ?? []).slice(0, 4).map((item) => `  - ${item.frontierType}: ${item.summary}`)),
    ...renderMetaOptimizeOverviewLines(workspaceIndex.metaOptimize),
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
    `- Repair frontier items: ${workspaceIndex.repairFrontier?.count ?? 0} (relations ${(workspaceIndex.repairFrontier?.relationIssueCount ?? 0)}, degraded families ${(workspaceIndex.repairFrontier?.relationFamilyIssueCount ?? 0)}, managed artifacts ${(workspaceIndex.repairFrontier?.managedArtifactIssueCount ?? 0)})`,
    `- Relation taxonomy: ${workspaceIndex.repairFrontier?.taxonomyOverview ?? "No degraded typed wiki relation families are currently summarized."}`,
    ...((workspaceIndex.repairFrontier?.relationFamilySummaries ?? []).slice(0, 3).map((family) => `  - family ${family.id}: ${family.overview}`)),
    ...((workspaceIndex.repairFrontier?.relationGroupSummaries ?? []).slice(0, 3).map((group) => `  - group ${group.id}: ${group.overview}`)),
    ...((workspaceIndex.repairFrontier?.prioritizedItems ?? []).slice(0, 5).map((item) => `  - ${item.frontierType}: ${item.summary}`)),
    ...renderMetaOptimizeOverviewLines(workspaceIndex.metaOptimize),
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

function recommendationPriorityWeight(value) {
  return value === "critical" ? 40 : value === "high" ? 24 : value === "medium" ? 12 : 4;
}

const TAXONOMY_OPERATOR_PRESSURE_BY_FAMILY = {
  "evidence-grounding": {
    clusterId: "evidence-grounding-pressure",
    clusterLabel: "Evidence grounding pressure",
    clusterSummary: "Typed wiki degradation shows evidence-grounding links are slipping, so claim and idea support may be less trustworthy than the workflow expects.",
    clusterOperatorGoal: "Restore source and idea grounding before promoting claims, summaries, or revisions.",
    longHorizonFamilyId: "taxonomy-evidence-grounding",
    longHorizonLabel: "Evidence grounding pressure",
    longHorizonSummary: "Evidence-grounding relation families keep degrading across optimizer snapshots.",
    pressureArea: "evidence-grounding"
  },
  "validation-loop": {
    clusterId: "validation-loop-pressure",
    clusterLabel: "Validation-loop pressure",
    clusterSummary: "Typed wiki degradation shows claim-to-experiment validation links are drifting, so experiment-backed closure remains unstable.",
    clusterOperatorGoal: "Repair validation-loop relations before treating experiments or claims as cleanly connected.",
    longHorizonFamilyId: "taxonomy-validation-loop",
    longHorizonLabel: "Validation-loop pressure",
    longHorizonSummary: "Validation-loop relation families keep degrading across optimizer snapshots.",
    pressureArea: "validation-loop"
  },
  "review-pressure": {
    clusterId: "review-pressure",
    clusterLabel: "Review pressure",
    clusterSummary: "Typed wiki degradation shows review-pressure links are accumulating, so reviewer concerns are staying active around important claims.",
    clusterOperatorGoal: "Reduce review-pressure before treating concerns as closed or rebuttal-ready.",
    longHorizonFamilyId: "taxonomy-review-pressure",
    longHorizonLabel: "Review pressure",
    longHorizonSummary: "Review-pressure relation families keep degrading across optimizer snapshots.",
    pressureArea: "review-pressure"
  }
};

function taxonomyPressureMetadata(familyId, fallbackLabel = null) {
  const normalizedFamilyId = typeof familyId === "string" && familyId.trim() ? familyId.trim() : "uncategorized";
  const configured = TAXONOMY_OPERATOR_PRESSURE_BY_FAMILY[normalizedFamilyId];
  if (configured) {
    return configured;
  }
  const readable = fallbackLabel ?? normalizedFamilyId.replace(/-/g, " ");
  return {
    clusterId: `taxonomy-${normalizedFamilyId}`,
    clusterLabel: `${readable[0]?.toUpperCase() ?? "T"}${readable.slice(1)} pressure`,
    clusterSummary: `${readable[0]?.toUpperCase() ?? "T"}${readable.slice(1)} relation degradation remains visible in the repair frontier and should stay operator-visible until repaired.`,
    clusterOperatorGoal: `Repair ${readable} relation degradation before it compounds into broader workflow debt.`,
    longHorizonFamilyId: `taxonomy-${normalizedFamilyId}`,
    longHorizonLabel: `${readable[0]?.toUpperCase() ?? "T"}${readable.slice(1)} pressure`,
    longHorizonSummary: `${readable[0]?.toUpperCase() ?? "T"}${readable.slice(1)} relation degradation keeps appearing across optimizer snapshots.`,
    pressureArea: normalizedFamilyId
  };
}

function toLabelMap(items = []) {
  return new Map(
    (items ?? [])
      .filter((item) => item && typeof item === "object" && typeof item.id === "string" && item.id.trim())
      .map((item) => [item.id, item.label ?? item.id])
  );
}

function buildTaxonomyPressure(familyIds = [], groupIds = [], familyLabelMap = new Map(), groupLabelMap = new Map()) {
  const normalizedFamilyIds = uniqueSorted((familyIds ?? []).filter(Boolean));
  const normalizedGroupIds = uniqueSorted((groupIds ?? []).filter(Boolean));
  const pressureAreas = uniqueSorted(normalizedFamilyIds.map((familyId) => taxonomyPressureMetadata(familyId, familyLabelMap.get(familyId)).pressureArea));
  const familyLabels = normalizedFamilyIds.map((familyId) => familyLabelMap.get(familyId) ?? familyId);
  const groupLabels = normalizedGroupIds.map((groupId) => groupLabelMap.get(groupId) ?? groupId);
  const overview = normalizedFamilyIds.length > 0
    ? `Taxonomy pressure is concentrated in ${familyLabels.join(", ")}${groupLabels.length > 0 ? ` via ${groupLabels.join(", ")}` : ""}.`
    : "No typed wiki taxonomy pressure is active in this optimizer surface.";
  return {
    familyIds: normalizedFamilyIds,
    groupIds: normalizedGroupIds,
    familyLabels,
    groupLabels,
    pressureAreas,
    overview
  };
}

function collectTaxonomyPressureSummary(items = []) {
  const familyCounts = {};
  const groupCounts = {};
  const familyLabelMap = new Map();
  const groupLabelMap = new Map();
  for (const item of items ?? []) {
    const taxonomyPressure = item?.taxonomyPressure ?? {};
    for (const [index, familyId] of (taxonomyPressure.familyIds ?? []).entries()) {
      incrementObjectCount(familyCounts, familyId);
      familyLabelMap.set(familyId, taxonomyPressure.familyLabels?.[index] ?? familyId);
    }
    for (const [index, groupId] of (taxonomyPressure.groupIds ?? []).entries()) {
      incrementObjectCount(groupCounts, groupId);
      groupLabelMap.set(groupId, taxonomyPressure.groupLabels?.[index] ?? groupId);
    }
  }
  const topTaxonomyFamilyIds = topFrequencyIds(Object.entries(familyCounts).flatMap(([familyId, count]) => Array(count).fill(familyId)));
  const topTaxonomyGroupIds = topFrequencyIds(Object.entries(groupCounts).flatMap(([groupId, count]) => Array(count).fill(groupId)));
  const pressureAreas = uniqueSorted(topTaxonomyFamilyIds.map((familyId) => taxonomyPressureMetadata(familyId, familyLabelMap.get(familyId)).pressureArea));
  const taxonomyOverview = topTaxonomyFamilyIds.length > 0
    ? `Taxonomy-aware optimizer pressure is led by ${topTaxonomyFamilyIds.map((familyId) => familyLabelMap.get(familyId) ?? familyId).join(", ")}${topTaxonomyGroupIds.length > 0 ? ` across ${topTaxonomyGroupIds.map((groupId) => groupLabelMap.get(groupId) ?? groupId).join(", ")}` : ""}.`
    : "No typed wiki taxonomy pressure is currently active in the optimizer frontier.";
  return {
    familyCounts,
    groupCounts,
    topTaxonomyFamilyIds,
    topTaxonomyGroupIds,
    pressureAreas,
    taxonomyOverview
  };
}

function deriveRecommendationCluster(recommendation = {}) {
  const taxonomyPressure = recommendation.taxonomyPressure ?? {};
  if (recommendation.category === "artifact-health" && (taxonomyPressure.familyIds ?? []).length > 0) {
    const primaryFamilyId = taxonomyPressure.familyIds[0];
    const metadata = taxonomyPressureMetadata(primaryFamilyId, taxonomyPressure.familyLabels?.[0]);
    return {
      id: metadata.clusterId,
      label: metadata.clusterLabel,
      summary: metadata.clusterSummary,
      operatorGoal: metadata.clusterOperatorGoal
    };
  }
  switch (recommendation.category) {
    case "review-discipline":
    case "repair-pattern":
      return {
        id: "review-closure",
        label: "Review closure",
        summary: "Recurring or escalated review debt that needs an explicit closure checkpoint.",
        operatorGoal: "Close durable reviewer concerns instead of rediscovering them in later passes."
      };
    case "experiment-integrity":
    case "claim-bridge":
      return {
        id: "evidence-integrity",
        label: "Evidence integrity",
        summary: "Blocked audits and result-to-claim transitions that should stay visible as workflow gates.",
        operatorGoal: "Repair experiment evidence and bridge trails before stronger claim promotion."
      };
    case "artifact-health":
      return {
        id: "repair-frontier",
        label: "Repair frontier",
        summary: "Typed relation and managed-artifact repair items that should remain operator-visible until cleared.",
        operatorGoal: "Treat degraded artifacts as first-class repair work, not background maintenance."
      };
    case "workflow-queue":
    case "workflow-observability":
      return {
        id: "queue-discipline",
        label: "Queue discipline",
        summary: "Queue churn and repeated workflow activity that suggest coordination debt is accumulating.",
        operatorGoal: "Reduce stale work and coordination churn before expanding concurrent work."
      };
    case "version-evolution":
      return {
        id: "version-governance",
        label: "Version governance",
        summary: "Version-comparison regressions that need explicit explanation or repair linkage.",
        operatorGoal: "Keep version movement honest by pairing regressions with concrete repair intent."
      };
    default:
      return {
        id: "workflow-governance",
        label: "Workflow governance",
        summary: "General workflow optimization guidance derived from durable signals.",
        operatorGoal: "Keep the durable workflow legible and proposal-only."
      };
  }
}

function deriveCrossSessionRecurrence(recommendation = {}, journalSignalCounts = {}) {
  const patterns = recommendation.category === "review-discipline" || recommendation.category === "repair-pattern"
    ? [/review/, /revision/]
    : recommendation.category === "experiment-integrity" || recommendation.category === "claim-bridge"
      ? [/audit/, /bridge/]
      : recommendation.category === "artifact-health"
        ? [/figure/, /workspace-index/, /wiki/]
        : recommendation.category === "workflow-queue" || recommendation.category === "workflow-observability"
          ? [/workspace-index/, /meta-optimize/, /review/, /revision/]
          : recommendation.category === "version-evolution"
            ? [/version/]
            : [];
  const total = Object.entries(journalSignalCounts).reduce((sum, [eventType, count]) => {
    return patterns.some((pattern) => pattern.test(eventType)) ? sum + count : sum;
  }, 0);
  return Math.min(total, 6);
}

function buildRecommendationScorecard(recommendation = {}, journalSignalCounts = {}) {
  const taxonomyPressure = recommendation.taxonomyPressure ?? {};
  const evidenceDensity = Math.min((recommendation.evidenceArtifactPaths?.length ?? 0) + (recommendation.evidenceIds?.length ?? 0), 8);
  const recurrenceCount = Math.min(recommendation.recurrenceCount ?? 0, 6);
  const crossSessionRecurrence = deriveCrossSessionRecurrence(recommendation, journalSignalCounts);
  const repairFrontierOverlap = Math.min(recommendation.repairFrontierOverlap ?? 0, 3);
  const auditCriticality = Math.min(recommendation.auditCriticality ?? 0, 3);
  const bridgeCriticality = Math.min(recommendation.bridgeCriticality ?? 0, 3);
  const queueChurn = Math.min(recommendation.queueChurnCount ?? 0, 6);
  const taxonomyFamilyPressure = Math.min(taxonomyPressure.familyIds?.length ?? 0, 3);
  const taxonomyGroupPressure = Math.min(taxonomyPressure.groupIds?.length ?? 0, 4);
  const score = recommendationPriorityWeight(recommendation.priority)
    + recurrenceCount * 7
    + evidenceDensity * 3
    + crossSessionRecurrence * 2
    + repairFrontierOverlap * 5
    + auditCriticality * 8
    + bridgeCriticality * 8
    + queueChurn * 2
    + taxonomyFamilyPressure * 6
    + taxonomyGroupPressure * 4;
  return {
    score,
    evidenceDensity,
    recurrenceCount,
    crossSessionRecurrence,
    repairFrontierOverlap,
    auditCriticality,
    bridgeCriticality,
    queueChurn,
    taxonomyFamilyPressure,
    taxonomyGroupPressure
  };
}

function buildFrontierSummary(recommendationCount, clusterCount, criticalCount, frontierScore, topClusterIds = [], taxonomyPressure = {}) {
  if (recommendationCount === 0) {
    return "No proposal-only optimizer recommendations are active.";
  }
  const taxonomySuffix = (taxonomyPressure.topTaxonomyFamilyIds ?? []).length > 0
    ? ` Dominant taxonomy pressure: ${(taxonomyPressure.topTaxonomyFamilyIds ?? []).join(", ")}${(taxonomyPressure.topTaxonomyGroupIds ?? []).length > 0 ? ` via ${(taxonomyPressure.topTaxonomyGroupIds ?? []).join(", ")}` : ""}.`
    : "";
  return `${recommendationCount} ranked recommendations across ${clusterCount} deterministic clusters (${criticalCount} critical, frontier score ${frontierScore}). Top clusters: ${topClusterIds.join(", ") || "none"}.${taxonomySuffix}`;
}

function longHorizonTrendRank(status) {
  const order = {
    rising: 0,
    stable: 1,
    cooling: 2,
    dormant: 3
  };
  return order[status] ?? 99;
}

function describeLongHorizonFamily(familyId) {
  if (typeof familyId === "string" && familyId.startsWith("taxonomy-")) {
    const taxonomyFamilyId = familyId.replace(/^taxonomy-/, "");
    const metadata = taxonomyPressureMetadata(taxonomyFamilyId);
    return {
      label: metadata.longHorizonLabel,
      summary: metadata.longHorizonSummary
    };
  }
  switch (familyId) {
    case "review-recurrence":
      return {
        label: "Review recurrence",
        summary: "Review and revision debt keeps coming back across optimizer refreshes."
      };
    case "audit-integrity":
      return {
        label: "Audit integrity",
        summary: "Experiment audits keep surfacing as workflow gates over time."
      };
    case "claim-bridge-regressions":
      return {
        label: "Claim bridge regressions",
        summary: "Result-to-claim transitions keep needing explicit re-review."
      };
    case "repair-frontier-persistence":
      return {
        label: "Repair frontier persistence",
        summary: "Artifact repairs remain visible across multiple optimizer snapshots."
      };
    case "workflow-churn":
      return {
        label: "Workflow churn",
        summary: "Queue and observability work keeps repeating instead of closing out cleanly."
      };
    case "version-regressions":
      return {
        label: "Version regressions",
        summary: "Version comparisons keep reintroducing unresolved concern debt."
      };
    default:
      return {
        label: "Workflow governance",
        summary: "Long-horizon workflow governance signals remain active."
      };
  }
}

function recommendationLongHorizonFamilyId(recommendation = {}) {
  if (recommendation.category === "artifact-health" && (recommendation.taxonomyPressure?.familyIds ?? []).length > 0) {
    return taxonomyPressureMetadata(recommendation.taxonomyPressure.familyIds[0], recommendation.taxonomyPressure.familyLabels?.[0]).longHorizonFamilyId;
  }
  switch (recommendation.category) {
    case "review-discipline":
    case "repair-pattern":
      return "review-recurrence";
    case "experiment-integrity":
      return "audit-integrity";
    case "claim-bridge":
      return "claim-bridge-regressions";
    case "artifact-health":
      return "repair-frontier-persistence";
    case "workflow-queue":
    case "workflow-observability":
      return "workflow-churn";
    case "version-evolution":
      return "version-regressions";
    default:
      return "workflow-governance";
  }
}

function incrementObjectCount(target, key, amount = 1) {
  if (!key) {
    return;
  }
  target[key] = (target[key] ?? 0) + amount;
}

function topFrequencyIds(items = [], limit = 3) {
  const counts = items.reduce((accumulator, item) => {
    if (item) {
      accumulator[item] = (accumulator[item] ?? 0) + 1;
    }
    return accumulator;
  }, {});
  return Object.entries(counts)
    .sort((left, right) => {
      const countDelta = right[1] - left[1];
      if (countDelta !== 0) {
        return countDelta;
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([id]) => id);
}

function normalizeLongHorizonFamilyCounts(record = {}) {
  return Object.fromEntries(
    Object.entries(record ?? {})
      .map(([key, value]) => [String(key).trim(), Number(value)])
      .filter(([key, value]) => key && Number.isFinite(value) && value > 0)
      .sort((left, right) => left[0].localeCompare(right[0]))
  );
}

function normalizeLongHorizonStringArrayRecord(record = {}) {
  return Object.fromEntries(
    Object.entries(record ?? {})
      .map(([key, value]) => [String(key).trim(), uniqueSorted(Array.isArray(value) ? value.map((item) => String(item).trim()) : [])])
      .filter(([key, value]) => key && value.length > 0)
      .sort((left, right) => left[0].localeCompare(right[0]))
  );
}

function buildLongHorizonHistoryEntry(rankedRecommendations, clusters, frontier, observedAt) {
  const taxonomyPressure = collectTaxonomyPressureSummary(rankedRecommendations);
  const recommendationsByFamily = rankedRecommendations.reduce((accumulator, recommendation) => {
    const familyId = recommendationLongHorizonFamilyId(recommendation);
    const existing = accumulator.get(familyId) ?? {
      recommendationIds: [],
      clusterIds: [],
      taxonomyFamilyIds: [],
      taxonomyGroupIds: [],
      operatorPressureAreas: [],
      evidenceArtifactPaths: [],
      signalTypes: []
    };
    existing.recommendationIds.push(recommendation.id);
    existing.clusterIds.push(recommendation.clusterId);
    existing.taxonomyFamilyIds.push(...(recommendation.taxonomyPressure?.familyIds ?? []));
    existing.taxonomyGroupIds.push(...(recommendation.taxonomyPressure?.groupIds ?? []));
    existing.operatorPressureAreas.push(...(recommendation.taxonomyPressure?.pressureAreas ?? []));
    existing.evidenceArtifactPaths.push(...(recommendation.evidenceArtifactPaths ?? []));
    existing.signalTypes.push(...(recommendation.signalTypes ?? []));
    accumulator.set(familyId, existing);
    return accumulator;
  }, new Map());
  const familyCounts = Object.fromEntries(Array.from(recommendationsByFamily.entries()).map(([familyId, value]) => [familyId, value.recommendationIds.length]));
  const familyTopRecommendationIds = Object.fromEntries(Array.from(recommendationsByFamily.entries()).map(([familyId, value]) => [familyId, value.recommendationIds.slice(0, 3)]));
  const familyTopClusterIds = Object.fromEntries(Array.from(recommendationsByFamily.entries()).map(([familyId, value]) => [familyId, uniqueSorted(value.clusterIds).slice(0, 3)]));
  return {
    observedAt,
    frontierScore: frontier.frontierScore ?? 0,
    recommendationCount: frontier.recommendationCount ?? rankedRecommendations.length,
    criticalCount: frontier.criticalCount ?? rankedRecommendations.filter((item) => item.priority === "critical").length,
    clusterCount: frontier.clusterCount ?? clusters.length,
    topClusterIds: frontier.topClusterIds ?? [],
    topRecommendationIds: frontier.topRecommendationIds ?? [],
    familyCounts,
    familyTopRecommendationIds,
    familyTopClusterIds,
    taxonomyFamilyCounts: taxonomyPressure.familyCounts,
    taxonomyGroupCounts: taxonomyPressure.groupCounts,
    topTaxonomyFamilyIds: taxonomyPressure.topTaxonomyFamilyIds,
    topTaxonomyGroupIds: taxonomyPressure.topTaxonomyGroupIds
  };
}

function comparableLongHorizonHistoryEntry(entry = {}) {
  return {
    frontierScore: Number(entry.frontierScore ?? 0),
    recommendationCount: Number(entry.recommendationCount ?? 0),
    criticalCount: Number(entry.criticalCount ?? 0),
    clusterCount: Number(entry.clusterCount ?? 0),
    topClusterIds: uniqueSorted(entry.topClusterIds ?? []),
    topRecommendationIds: uniqueSorted(entry.topRecommendationIds ?? []),
    familyCounts: normalizeLongHorizonFamilyCounts(entry.familyCounts),
    familyTopRecommendationIds: normalizeLongHorizonStringArrayRecord(entry.familyTopRecommendationIds),
    familyTopClusterIds: normalizeLongHorizonStringArrayRecord(entry.familyTopClusterIds),
    taxonomyFamilyCounts: normalizeLongHorizonFamilyCounts(entry.taxonomyFamilyCounts),
    taxonomyGroupCounts: normalizeLongHorizonFamilyCounts(entry.taxonomyGroupCounts),
    topTaxonomyFamilyIds: uniqueSorted(entry.topTaxonomyFamilyIds ?? []),
    topTaxonomyGroupIds: uniqueSorted(entry.topTaxonomyGroupIds ?? [])
  };
}

function resolveLongHorizonHistoryMutation(previousHistory, nextEntry, historyWindowSize) {
  const lastEntry = previousHistory.at(-1) ?? null;
  if (!lastEntry) {
    return {
      action: "append",
      reason: "Recorded the first long-horizon snapshot.",
      history: [...previousHistory.slice(-(historyWindowSize - 1)), nextEntry]
    };
  }

  const nextComparable = comparableLongHorizonHistoryEntry(nextEntry);
  const lastComparable = comparableLongHorizonHistoryEntry(lastEntry);
  if (JSON.stringify(lastComparable) !== JSON.stringify(nextComparable)) {
    return {
      action: "append",
      reason: "Frontier or family state changed in a meaningful way.",
      history: [...previousHistory.slice(-(historyWindowSize - 1)), nextEntry]
    };
  }

  const refreshedObservedAt = isIsoTimestamp(lastEntry.observedAt) ? lastEntry.observedAt : nextEntry.observedAt;
  const refreshedLastEntry = {
    ...lastEntry,
    ...nextComparable,
    observedAt: refreshedObservedAt
  };
  const normalizedLastEntry = {
    ...lastEntry,
    ...lastComparable,
    observedAt: isIsoTimestamp(lastEntry.observedAt) ? lastEntry.observedAt : null
  };
  if (JSON.stringify(normalizedLastEntry) !== JSON.stringify(refreshedLastEntry)) {
    return {
      action: "refresh",
      reason: "Canonical state stayed the same, so the current snapshot was normalized in place.",
      history: [...previousHistory.slice(0, -1), refreshedLastEntry]
    };
  }

  return {
    action: "unchanged",
    reason: "Canonical frontier and long-horizon state were unchanged, so no new snapshot was added.",
    history: previousHistory
  };
}

function buildLongHorizonMemory(existingMemory, rankedRecommendations, clusters, frontier, observedAt) {
  const base = createMetaLongHorizonMemory();
  const previousHistory = Array.isArray(existingMemory?.history) ? existingMemory.history : [];
  const currentTaxonomyPressure = collectTaxonomyPressureSummary(rankedRecommendations);
  const recommendationsByFamily = rankedRecommendations.reduce((accumulator, recommendation) => {
    const familyId = recommendationLongHorizonFamilyId(recommendation);
    const existing = accumulator.get(familyId) ?? {
      recommendationIds: [],
      clusterIds: [],
      taxonomyFamilyIds: [],
      taxonomyGroupIds: [],
      operatorPressureAreas: [],
      evidenceArtifactPaths: [],
      signalTypes: []
    };
    existing.recommendationIds.push(recommendation.id);
    existing.clusterIds.push(recommendation.clusterId);
    existing.taxonomyFamilyIds.push(...(recommendation.taxonomyPressure?.familyIds ?? []));
    existing.taxonomyGroupIds.push(...(recommendation.taxonomyPressure?.groupIds ?? []));
    existing.operatorPressureAreas.push(...(recommendation.taxonomyPressure?.pressureAreas ?? []));
    existing.evidenceArtifactPaths.push(...(recommendation.evidenceArtifactPaths ?? []));
    existing.signalTypes.push(...(recommendation.signalTypes ?? []));
    accumulator.set(familyId, existing);
    return accumulator;
  }, new Map());
  const historyWindowSize = Number.isFinite(existingMemory?.historyWindowSize) ? existingMemory.historyWindowSize : base.historyWindowSize;
  const historyEntry = buildLongHorizonHistoryEntry(rankedRecommendations, clusters, frontier, observedAt);
  const historyDecision = resolveLongHorizonHistoryMutation(previousHistory, historyEntry, historyWindowSize);
  const history = historyDecision.history;
  const recentWindow = history.slice(-5);
  const previousWindow = history.slice(-10, -5);
  const familyIds = uniqueSorted(history.flatMap((entry) => Object.keys(entry.familyCounts ?? {})));
  const families = familyIds.map((familyId) => {
    const metadata = describeLongHorizonFamily(familyId);
    const totalCount = history.reduce((sum, entry) => sum + (entry.familyCounts?.[familyId] ?? 0), 0);
    const recentCount = recentWindow.reduce((sum, entry) => sum + (entry.familyCounts?.[familyId] ?? 0), 0);
    const previousCount = previousWindow.reduce((sum, entry) => sum + (entry.familyCounts?.[familyId] ?? 0), 0);
    const activeSnapshots = history.filter((entry) => (entry.familyCounts?.[familyId] ?? 0) > 0);
    const current = recommendationsByFamily.get(familyId) ?? {
      recommendationIds: [],
      clusterIds: [],
      taxonomyFamilyIds: [],
      taxonomyGroupIds: [],
      operatorPressureAreas: [],
      evidenceArtifactPaths: [],
      signalTypes: []
    };
    const trendStatus = recentCount > previousCount
      ? "rising"
      : recentCount < previousCount
        ? "cooling"
        : recentCount > 0
          ? "stable"
          : "dormant";
    return {
      id: familyId,
      label: metadata.label,
      summary: metadata.summary,
      currentCount: current.recommendationIds.length,
      totalCount,
      activeSnapshotCount: activeSnapshots.length,
      recurring: activeSnapshots.length >= 2,
      trend: {
        status: trendStatus,
        recentCount,
        previousCount
      },
      topRecommendationIds: topFrequencyIds(history.flatMap((entry) => entry.familyTopRecommendationIds?.[familyId] ?? [])),
      topClusterIds: topFrequencyIds(history.flatMap((entry) => entry.familyTopClusterIds?.[familyId] ?? [])),
      relatedRecommendationIds: current.recommendationIds.slice(0, 5),
      relatedTaxonomyFamilyIds: uniqueSorted(current.taxonomyFamilyIds ?? []),
      relatedTaxonomyGroupIds: uniqueSorted(current.taxonomyGroupIds ?? []),
      operatorPressureAreas: uniqueSorted(current.operatorPressureAreas ?? []),
      evidenceArtifactPaths: uniqueSorted(current.evidenceArtifactPaths),
      signalTypes: uniqueSorted(current.signalTypes),
      firstObservedAt: activeSnapshots[0]?.observedAt ?? null,
      lastObservedAt: activeSnapshots.at(-1)?.observedAt ?? null
    };
  }).sort((left, right) => {
    const recurringDelta = Number(right.recurring) - Number(left.recurring);
    if (recurringDelta !== 0) {
      return recurringDelta;
    }
    const trendDelta = longHorizonTrendRank(left.trend.status) - longHorizonTrendRank(right.trend.status);
    if (trendDelta !== 0) {
      return trendDelta;
    }
    const recentDelta = right.trend.recentCount - left.trend.recentCount;
    if (recentDelta !== 0) {
      return recentDelta;
    }
    const totalDelta = right.totalCount - left.totalCount;
    if (totalDelta !== 0) {
      return totalDelta;
    }
    return left.id.localeCompare(right.id);
  });
  const summary = {
    familyCount: families.length,
      recurringFamilyCount: families.filter((item) => item.recurring).length,
      risingFamilyCount: families.filter((item) => item.trend.status === "rising").length,
      stableFamilyCount: families.filter((item) => item.trend.status === "stable").length,
      coolingFamilyCount: families.filter((item) => item.trend.status === "cooling").length,
      snapshotCount: history.length,
      lastObservedAt: history.at(-1)?.observedAt ?? null,
      lastAction: historyDecision.action,
      topFamilyIds: families.slice(0, 3).map((item) => item.id),
      topTaxonomyFamilyIds: currentTaxonomyPressure.topTaxonomyFamilyIds,
      topTaxonomyGroupIds: currentTaxonomyPressure.topTaxonomyGroupIds,
      pressureAreas: currentTaxonomyPressure.pressureAreas,
      overview: families.length > 0
        ? `${families.length} long-horizon workflow families across ${history.length} optimizer snapshots. Top families: ${families.slice(0, 3).map((item) => item.id).join(", ") || "none"}.${currentTaxonomyPressure.topTaxonomyFamilyIds.length > 0 ? ` Dominant taxonomy pressure: ${currentTaxonomyPressure.topTaxonomyFamilyIds.join(", ")}${currentTaxonomyPressure.topTaxonomyGroupIds.length > 0 ? ` via ${currentTaxonomyPressure.topTaxonomyGroupIds.join(", ")}` : ""}.` : ""}`
        : "No long-horizon workflow memory has been summarized yet."
    };
  return {
    ...base,
    historyWindowSize,
    horizon: {
      sessionEntriesAnalyzed: Math.min(history.length, historyWindowSize),
      reviewRoundsObserved: history.length,
      versionComparisonsAnalyzed: history.length,
      auditRecordsAnalyzed: history.reduce((sum, entry) => sum + (entry.familyCounts?.["audit-integrity"] ?? 0), 0),
      bridgeRecordsAnalyzed: history.reduce((sum, entry) => sum + (entry.familyCounts?.["claim-bridge-regressions"] ?? 0), 0)
    },
    summary,
    historyPolicy: {
      mode: "deterministic-noop-drift-guard-v1",
      lastAction: historyDecision.action,
      reason: historyDecision.reason,
      comparedAt: observedAt,
      lastMeaningfulChangeAt: historyDecision.action === "append"
        ? observedAt
        : (existingMemory?.historyPolicy?.lastMeaningfulChangeAt ?? history.at(-1)?.observedAt ?? null)
    },
    history,
    families,
    updatedAt: observedAt
  };
}

function buildMetaOptimizeMirror(metaRecommendations, longHorizonMemory) {
  return {
    proposalOnly: true,
    recommendationCount: metaRecommendations.items.length,
    criticalCount: metaRecommendations.summary.criticalCount,
    clusterCount: metaRecommendations.summary.clusterCount,
    frontierScore: metaRecommendations.summary.frontierScore,
    activeSignalTypes: metaRecommendations.summary.signalTypes,
    topClusterIds: metaRecommendations.summary.topClusterIds,
    topRecommendationIds: metaRecommendations.summary.topRecommendationIds,
    topClusters: metaRecommendations.summary.topClusters,
    topTaxonomyFamilyIds: metaRecommendations.summary.topTaxonomyFamilyIds ?? [],
    topTaxonomyGroupIds: metaRecommendations.summary.topTaxonomyGroupIds ?? [],
    pressureAreas: metaRecommendations.summary.pressureAreas ?? [],
    taxonomyOverview: metaRecommendations.summary.taxonomyOverview ?? "No typed wiki taxonomy pressure is currently active in the optimizer frontier.",
    frontierSummary: metaRecommendations.frontier.frontierSummary,
    rankingMethod: metaRecommendations.frontier.rankingMethod,
    tieBreakOrder: metaRecommendations.ranking.tieBreakOrder,
    reportPath: ARTIFACT_PATHS.metaOptimizerReport,
    recommendationsPath: ARTIFACT_PATHS.metaRecommendations,
    statePath: ARTIFACT_PATHS.metaOptimizerState,
    longHorizonPath: ARTIFACT_PATHS.metaLongHorizonMemory,
    longHorizon: {
      ...longHorizonMemory.summary,
      memoryPath: ARTIFACT_PATHS.metaLongHorizonMemory
    }
  };
}

function renderMetaOptimizeOverviewLines(metaOptimize = {}) {
  return [
    `- Meta-optimize frontier: ${metaOptimize.recommendationCount ?? 0} recommendations across ${metaOptimize.clusterCount ?? 0} clusters (${metaOptimize.criticalCount ?? 0} critical, score ${metaOptimize.frontierScore ?? 0})`,
    `- Meta-optimize frontier summary: ${metaOptimize.frontierSummary ?? "No proposal-only optimizer recommendations have been generated yet."}`,
    `- Meta-optimize top clusters: ${(metaOptimize.topClusterIds ?? []).join(", ") || "none"}`,
    `- Meta-optimize taxonomy pressure: ${metaOptimize.taxonomyOverview ?? "No typed wiki taxonomy pressure is currently active in the optimizer frontier."}`,
    `- Meta-optimize top taxonomy families: ${(metaOptimize.topTaxonomyFamilyIds ?? []).join(", ") || "none"}`,
    `- Meta-optimize top taxonomy groups: ${(metaOptimize.topTaxonomyGroupIds ?? []).join(", ") || "none"}`,
    `- Meta-optimize pressure areas: ${(metaOptimize.pressureAreas ?? []).join(", ") || "none"}`,
    `- Long-horizon memory: ${metaOptimize.longHorizon?.overview ?? "No long-horizon workflow memory has been summarized yet."}`,
    `- Long-horizon snapshots: ${metaOptimize.longHorizon?.snapshotCount ?? 0}`,
    `- Long-horizon last action: ${metaOptimize.longHorizon?.lastAction ?? "unchanged"}`,
    `- Long-horizon last observed: ${metaOptimize.longHorizon?.lastObservedAt ?? "none"}`,
    `- Long-horizon top families: ${(metaOptimize.longHorizon?.topFamilyIds ?? []).join(", ") || "none"}`,
    `- Long-horizon taxonomy families: ${(metaOptimize.longHorizon?.topTaxonomyFamilyIds ?? []).join(", ") || "none"}`,
    `- Long-horizon taxonomy groups: ${(metaOptimize.longHorizon?.topTaxonomyGroupIds ?? []).join(", ") || "none"}`,
    `- Meta-optimize report: ${metaOptimize.reportPath ?? ARTIFACT_PATHS.metaOptimizerReport}`,
    `- Long-horizon memory path: ${metaOptimize.longHorizonPath ?? ARTIFACT_PATHS.metaLongHorizonMemory}`
  ];
}

function clusterSortKey(cluster = {}) {
  return [
    String(recommendationSortRank(cluster.priority)).padStart(2, "0"),
    String(999999 - (cluster.score ?? 0)).padStart(6, "0"),
    cluster.id ?? "cluster"
  ].join(":");
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
    recurrenceCount: recommendation.recurrenceCount ?? 0,
    repairFrontierOverlap: recommendation.repairFrontierOverlap ?? 0,
    auditCriticality: recommendation.auditCriticality ?? 0,
    bridgeCriticality: recommendation.bridgeCriticality ?? 0,
    queueChurnCount: recommendation.queueChurnCount ?? 0,
    taxonomyPressure: recommendation.taxonomyPressure ?? buildTaxonomyPressure(),
    score: recommendation.score ?? 0,
    rankingBasis: normalizeStringArray(recommendation.rankingBasis ?? []),
    tieBreakKey: recommendation.tieBreakKey ?? null,
    generatedAt: recommendation.generatedAt ?? nowIso()
  });
}

function buildRepairFrontier(wikiRelations, figureQa) {
  const relationGroupSummaries = (wikiRelations.summary?.taxonomy?.groups ?? [])
    .filter((group) => group.degradedCount > 0)
    .map((group) => ({
      id: group.id,
      label: group.label,
      degradedCount: group.degradedCount,
      totalRelations: group.totalRelations,
      severity: group.severity ?? "medium",
      topReasonCodes: uniqueSorted(group.topReasonCodes ?? []),
      overview: group.overview ?? `${group.label} has degraded typed wiki relations.`
    }));
  const relationFamilySummaries = (wikiRelations.summary?.taxonomy?.families ?? [])
    .filter((family) => family.degradedCount > 0)
    .map((family) => ({
      id: family.id,
      label: family.label,
      degradedCount: family.degradedCount,
      totalRelations: family.totalRelations,
      severity: family.severity ?? "medium",
      topReasonCodes: uniqueSorted(family.topReasonCodes ?? []),
      overview: family.overview ?? `${family.label} has degraded typed wiki relations.`
    }));
  const relationFamilyItems = (wikiRelations.summary?.taxonomyRepairFrontier ?? []).map((item) => ({
    ...item,
    taxonomyFamilyId: item.taxonomyFamilyId ?? null,
    taxonomyGroupIds: uniqueSorted(item.taxonomyGroupIds ?? [])
  }));
  const relationItems = (wikiRelations.items ?? [])
    .filter((relation) => relation.integrity?.status === "degraded")
    .map((relation) => ({
      id: `repair-${relation.id}`,
      frontierType: "typed-wiki-relation",
      severity: relation.integrity?.severity ?? "medium",
      taxonomyFamilyId: relation.taxonomy?.familyId ?? null,
      taxonomyGroupId: relation.taxonomy?.groupId ?? null,
      summary: `Repair typed wiki relation ${relation.id} (${relation.relationType}, ${relation.taxonomy?.familyLabel ?? "uncategorized"} / ${relation.taxonomy?.groupLabel ?? "uncategorized"}).`,
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
  const prioritizedItems = [...relationFamilyItems, ...relationItems, ...figureItems]
    .sort((left, right) => {
      const severityDelta = severityRank(left.severity) - severityRank(right.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, 12);
  return {
    count: relationFamilyItems.length + relationItems.length + figureItems.length,
    relationIssueCount: relationItems.length,
    relationFamilyIssueCount: relationFamilyItems.length,
    managedArtifactIssueCount: figureItems.length,
    topDegradedFamilyIds: relationFamilySummaries.slice(0, 3).map((family) => family.id),
    topDegradedGroupIds: relationGroupSummaries.slice(0, 3).map((group) => group.id),
    taxonomyOverview: wikiRelations.summary?.taxonomy?.overview ?? "No degraded typed wiki relation families are currently summarized.",
    relationFamilySummaries,
    relationGroupSummaries,
    prioritizedItems
  };
}

function buildMetaOptimizeSurface({ board, workspaceIndex, journal, reviewConcerns, reviewState, adversarialState, experimentAudits, bridgeLog, figureQa, comparisons, existingLongHorizonMemory }) {
  const generatedAt = nowIso();
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
  const repairFamilyLabelMap = toLabelMap(workspaceIndex.repairFrontier?.relationFamilySummaries ?? []);
  const repairGroupLabelMap = toLabelMap(workspaceIndex.repairFrontier?.relationGroupSummaries ?? []);
  const repeatedRepairishEvents = recentEntries.reduce((accumulator, entry) => {
    if (entry.type === "query-meta-optimize") {
      return accumulator;
    }
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
      signalTypes: ["review-concern", "adversarial-review"],
      recurrenceCount: concern.recurrenceCount ?? 0,
      auditCriticality: (concern.linkedAuditIds ?? []).length > 0 ? 1 : 0,
      bridgeCriticality: (concern.linkedBridgeIds ?? []).length > 0 ? 1 : 0
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
      signalTypes: ["review-concern"],
      recurrenceCount: concern.recurrenceCount ?? 0
    });
  }

  for (const item of repairItems.slice(0, 5)) {
    const recommendationId = `meta-repair-${slugify(item.id)}`;
    const taxonomyPressure = buildTaxonomyPressure(
      [item.taxonomyFamilyId, ...(item.taxonomyFamilyIds ?? [])].filter(Boolean),
      [item.taxonomyGroupId, ...(item.taxonomyGroupIds ?? [])].filter(Boolean),
      repairFamilyLabelMap,
      repairGroupLabelMap
    );
    const primaryPressure = taxonomyPressure.pressureAreas[0] ?? item.frontierType;
    const primaryFamilyLabel = taxonomyPressure.familyLabels[0] ?? item.frontierType;
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
      summary: taxonomyPressure.familyIds.length > 0
        ? `Keep ${primaryPressure} visible as explicit repair work, not background maintenance.`
        : `Keep ${item.frontierType} visible as explicit repair work, not background maintenance.`,
      rationale: taxonomyPressure.familyIds.length > 0
        ? `${item.reasons || `The repair frontier still carries ${item.frontierType} debt.`} This is now explicit ${primaryPressure} pressure in the typed wiki taxonomy (${primaryFamilyLabel}${taxonomyPressure.groupLabels.length > 0 ? ` via ${taxonomyPressure.groupLabels.join(", ")}` : ""}), so operators can see exactly whether the weakness is in evidence-grounding, validation-loop, review-pressure, or another relation family.`
        : (item.reasons || `The repair frontier still carries ${item.frontierType} debt, so the workflow should preserve an explicit repair surface until it clears.`),
      nextAction: item.nextAction,
      scope: taxonomyPressure.familyIds.length > 0 ? `${primaryPressure} / artifact health` : "artifact health",
      evidenceArtifactPaths: [item.artifactPath, ...(item.relatedArtifactPaths ?? [])],
      evidenceIds: [item.id, ...(item.reasonCodes ?? [])],
      signalTypes: [item.frontierType],
      repairFrontierOverlap: 1,
      recurrenceCount: Math.min(item.degradedCount ?? 1, 6),
      taxonomyPressure
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
      signalTypes: ["experiment-audit"],
      auditCriticality: audit.auditVerdict === "blocked" ? 2 : 1
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
      signalTypes: ["claim-bridge", "experiment-audit"],
      auditCriticality: bridge.auditVerdict === "blocked" ? 1 : 0,
      bridgeCriticality: bridge.bridgeStatus === "held-for-review" || bridge.auditVerdict === "blocked" ? 2 : 1
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
      signalTypes: ["workspace-queue"],
      queueChurnCount: stalePackets.length + handoffObligations.length
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
      signalTypes: ["version-comparison"],
      recurrenceCount: (latestComparison.unresolvedConcernsAdded ?? []).length
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
      signalTypes: ["session-journal"],
      recurrenceCount: count
    });
  }

  const rankedRecommendations = recommendations
    .map((recommendation) => {
      const cluster = deriveRecommendationCluster(recommendation);
      const scorecard = buildRecommendationScorecard(recommendation, repeatedRepairishEvents);
      const rankingBasis = [
        `priority=${recommendation.priority}`,
        `recurrence=${scorecard.recurrenceCount}`,
        `evidenceDensity=${scorecard.evidenceDensity}`,
        `crossSessionRecurrence=${scorecard.crossSessionRecurrence}`,
        `repairFrontierOverlap=${scorecard.repairFrontierOverlap}`,
        `auditCriticality=${scorecard.auditCriticality}`,
        `bridgeCriticality=${scorecard.bridgeCriticality}`,
        `queueChurn=${scorecard.queueChurn}`,
        `taxonomyFamilyPressure=${scorecard.taxonomyFamilyPressure}`,
        `taxonomyGroupPressure=${scorecard.taxonomyGroupPressure}`
      ];
      return {
        ...recommendation,
        clusterId: cluster.id,
        clusterLabel: cluster.label,
        clusterSummary: cluster.summary,
        clusterOperatorGoal: cluster.operatorGoal,
        score: scorecard.score,
        rankingBasis,
        signalStrength: {
          evidenceDensity: scorecard.evidenceDensity,
          recurrenceCount: scorecard.recurrenceCount,
          crossSessionRecurrence: scorecard.crossSessionRecurrence,
          repairFrontierOverlap: scorecard.repairFrontierOverlap,
          auditCriticality: scorecard.auditCriticality,
          bridgeCriticality: scorecard.bridgeCriticality,
          queueChurn: scorecard.queueChurn,
          taxonomyFamilyPressure: scorecard.taxonomyFamilyPressure,
          taxonomyGroupPressure: scorecard.taxonomyGroupPressure
        }
      };
    })
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      const priorityDelta = recommendationSortRank(left.priority) - recommendationSortRank(right.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const clusterDelta = left.clusterId.localeCompare(right.clusterId);
      if (clusterDelta !== 0) {
        return clusterDelta;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, 12)
    .map((recommendation, index) => ({
      ...recommendation,
      rank: index + 1,
      sortKey: [
        String(9999 - recommendation.score).padStart(4, "0"),
        String(recommendationSortRank(recommendation.priority)).padStart(2, "0"),
        String(index + 1).padStart(2, "0"),
        recommendation.clusterId,
        recommendation.category,
        recommendation.id
      ].join(":"),
      tieBreakKey: [
        String(9999 - recommendation.score).padStart(4, "0"),
        String(recommendationSortRank(recommendation.priority)).padStart(2, "0"),
        recommendation.clusterId,
        recommendation.category,
        recommendation.id
      ].join(":")
    }));
  const clusterMap = new Map();
  for (const recommendation of rankedRecommendations) {
    const existing = clusterMap.get(recommendation.clusterId) ?? {
      id: recommendation.clusterId,
      label: recommendation.clusterLabel,
      summary: recommendation.clusterSummary,
      operatorGoal: recommendation.clusterOperatorGoal,
      priority: recommendation.priority,
      score: 0,
      recommendationCount: 0,
      criticalCount: 0,
      topRecommendationId: recommendation.id,
      recommendationIds: [],
      categories: {},
      responseOwnerRoles: [],
      evidenceArtifactPaths: [],
      evidenceIds: [],
      signalTypes: [],
      maxRecommendationScore: 0,
      maxRecurrenceCount: 0,
      queueChurnCount: 0,
      repairFrontierOverlap: 0,
      auditCriticality: 0,
      bridgeCriticality: 0,
      taxonomyPressure: buildTaxonomyPressure()
    };
    existing.priority = recommendationSortRank(recommendation.priority) < recommendationSortRank(existing.priority)
      ? recommendation.priority
      : existing.priority;
    existing.score += recommendation.score;
    existing.recommendationCount += 1;
    existing.criticalCount += recommendation.priority === "critical" ? 1 : 0;
    existing.topRecommendationId = existing.topRecommendationId === recommendation.id || recommendation.score > existing.maxRecommendationScore
      ? recommendation.id
      : existing.topRecommendationId;
    existing.recommendationIds.push(recommendation.id);
    existing.categories[recommendation.category] = (existing.categories[recommendation.category] ?? 0) + 1;
    if (recommendation.responseOwnerRole) {
      existing.responseOwnerRoles.push(recommendation.responseOwnerRole);
    }
    existing.evidenceArtifactPaths.push(...recommendation.evidenceArtifactPaths);
    existing.evidenceIds.push(...recommendation.evidenceIds);
    existing.signalTypes.push(...recommendation.signalTypes);
    existing.maxRecommendationScore = Math.max(existing.maxRecommendationScore, recommendation.score);
    existing.maxRecurrenceCount = Math.max(existing.maxRecurrenceCount, recommendation.signalStrength.recurrenceCount);
    existing.queueChurnCount += recommendation.signalStrength.queueChurn;
    existing.repairFrontierOverlap += recommendation.signalStrength.repairFrontierOverlap;
    existing.auditCriticality += recommendation.signalStrength.auditCriticality;
    existing.bridgeCriticality += recommendation.signalStrength.bridgeCriticality;
    existing.taxonomyPressure = buildTaxonomyPressure(
      [...(existing.taxonomyPressure.familyIds ?? []), ...(recommendation.taxonomyPressure?.familyIds ?? [])],
      [...(existing.taxonomyPressure.groupIds ?? []), ...(recommendation.taxonomyPressure?.groupIds ?? [])],
      new Map([
        ...(existing.taxonomyPressure.familyIds ?? []).map((familyId, index) => [familyId, existing.taxonomyPressure.familyLabels?.[index] ?? familyId]),
        ...(recommendation.taxonomyPressure?.familyIds ?? []).map((familyId, index) => [familyId, recommendation.taxonomyPressure.familyLabels?.[index] ?? familyId])
      ]),
      new Map([
        ...(existing.taxonomyPressure.groupIds ?? []).map((groupId, index) => [groupId, existing.taxonomyPressure.groupLabels?.[index] ?? groupId]),
        ...(recommendation.taxonomyPressure?.groupIds ?? []).map((groupId, index) => [groupId, recommendation.taxonomyPressure.groupLabels?.[index] ?? groupId])
      ])
    );
    clusterMap.set(recommendation.clusterId, existing);
  }
  const taxonomyPressure = collectTaxonomyPressureSummary(rankedRecommendations);
  const clusters = Array.from(clusterMap.values())
    .map((cluster) => ({
      ...cluster,
      recommendationIds: uniqueSorted(cluster.recommendationIds),
      responseOwnerRoles: uniqueSorted(cluster.responseOwnerRoles),
      evidenceArtifactPaths: uniqueSorted(cluster.evidenceArtifactPaths),
      evidenceIds: uniqueSorted(cluster.evidenceIds),
      signalTypes: uniqueSorted(cluster.signalTypes),
      taxonomyPressure: cluster.taxonomyPressure,
      summaryLine: `${cluster.recommendationCount} recommendations, ${cluster.criticalCount} critical, score ${cluster.score}`,
      membershipPreview: rankedRecommendations.filter((item) => item.clusterId === cluster.id).slice(0, 3).map((item) => ({
        id: item.id,
        rank: item.rank,
        priority: item.priority,
        score: item.score,
        summary: item.summary,
        tieBreakKey: item.tieBreakKey
      }))
    }))
    .sort((left, right) => {
      const priorityDelta = recommendationSortRank(left.priority) - recommendationSortRank(right.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return left.id.localeCompare(right.id);
    })
    .map((cluster, index) => ({ ...cluster, rank: index + 1, sortKey: clusterSortKey(cluster) }));
  const clusterMembership = Object.fromEntries(clusters.map((cluster) => [cluster.id, cluster.recommendationIds]));
  const keptRecommendationIds = new Set(rankedRecommendations.map((item) => item.id));
  const sortedEvents = events
    .filter((item) => item.recommendationIds.some((id) => keptRecommendationIds.has(id)))
    .sort((left, right) => {
      const severityDelta = severityRank(left.severity) - severityRank(right.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return left.id.localeCompare(right.id);
    });
  const categoryCounts = rankedRecommendations.reduce((accumulator, item) => {
    accumulator[item.category] = (accumulator[item.category] ?? 0) + 1;
    return accumulator;
  }, {});
  const signalTypes = uniqueSorted(rankedRecommendations.flatMap((item) => item.signalTypes));
  const criticalCount = rankedRecommendations.filter((item) => item.priority === "critical").length;
  const clusterCount = clusters.length;
  const frontierScore = rankedRecommendations.reduce((sum, item) => sum + item.score, 0);
  const topClusterIds = clusters.slice(0, 3).map((cluster) => cluster.id);
  const topRecommendationIds = rankedRecommendations.slice(0, 5).map((item) => item.id);
  const frontierSummary = buildFrontierSummary(rankedRecommendations.length, clusterCount, criticalCount, frontierScore, topClusterIds, taxonomyPressure);
  const topClusters = clusters.slice(0, 3).map((cluster) => ({
    id: cluster.id,
    label: cluster.label,
    rank: cluster.rank,
    priority: cluster.priority,
    score: cluster.score,
    recommendationCount: cluster.recommendationCount,
    criticalCount: cluster.criticalCount,
    summary: cluster.summary,
    operatorGoal: cluster.operatorGoal,
    topRecommendationId: cluster.topRecommendationId,
    taxonomyPressure: cluster.taxonomyPressure,
    sortKey: cluster.sortKey
  }));
  const metaEvents = {
    ...createMetaEventsIndex(),
    items: sortedEvents,
    updatedAt: generatedAt
  };
  const metaRecommendations = {
    ...createMetaRecommendationsIndex(),
    items: rankedRecommendations,
    clusters,
    ranking: {
      method: "durable-signal-frontier-v1",
      signals: [
        "priority",
        "recurrenceCount",
        "evidenceDensity",
        "crossSessionRecurrence",
        "repairFrontierOverlap",
        "auditCriticality",
        "bridgeCriticality",
        "queueChurn",
        "taxonomyFamilyPressure",
        "taxonomyGroupPressure"
      ],
      tieBreakOrder: ["score-desc", "priority-rank", "cluster-rank", "cluster-id", "category", "id"]
    },
    frontier: {
      recommendationCount: rankedRecommendations.length,
      criticalCount,
      clusterCount,
      frontierScore,
      topClusterIds,
      topRecommendationIds,
      activeSignalTypes: signalTypes,
      topTaxonomyFamilyIds: taxonomyPressure.topTaxonomyFamilyIds,
      topTaxonomyGroupIds: taxonomyPressure.topTaxonomyGroupIds,
      pressureAreas: taxonomyPressure.pressureAreas,
      taxonomyOverview: taxonomyPressure.taxonomyOverview,
      frontierSummary,
      rankingMethod: "durable-signal-frontier-v1"
    },
    summary: {
      recommendationCount: rankedRecommendations.length,
      criticalCount,
      clusterCount,
      frontierScore,
      categories: categoryCounts,
      signalTypes,
      topClusterIds,
      topRecommendationIds,
      topTaxonomyFamilyIds: taxonomyPressure.topTaxonomyFamilyIds,
      topTaxonomyGroupIds: taxonomyPressure.topTaxonomyGroupIds,
      pressureAreas: taxonomyPressure.pressureAreas,
      taxonomyOverview: taxonomyPressure.taxonomyOverview,
      clusterMembership,
      topClusters
    },
    updatedAt: generatedAt
  };
  const longHorizonMemory = buildLongHorizonMemory(existingLongHorizonMemory, rankedRecommendations, clusters, metaRecommendations.frontier, generatedAt);
  const metaOptimizeMirror = buildMetaOptimizeMirror(metaRecommendations, longHorizonMemory);
  const metaOptimizerState = {
    ...createMetaOptimizerState(),
    frontier: {
      recommendationCount: metaOptimizeMirror.recommendationCount,
      criticalCount: metaOptimizeMirror.criticalCount,
      clusterCount: metaOptimizeMirror.clusterCount,
      frontierScore: metaOptimizeMirror.frontierScore,
      activeSignalTypes: metaOptimizeMirror.activeSignalTypes,
      topClusterIds: metaOptimizeMirror.topClusterIds,
      topRecommendationIds: metaOptimizeMirror.topRecommendationIds,
      topClusters: metaOptimizeMirror.topClusters,
      frontierSummary: metaOptimizeMirror.frontierSummary,
      rankingMethod: metaOptimizeMirror.rankingMethod,
      tieBreakOrder: metaOptimizeMirror.tieBreakOrder,
      reportPath: metaOptimizeMirror.reportPath,
      recommendationsPath: metaOptimizeMirror.recommendationsPath,
      statePath: metaOptimizeMirror.statePath,
      longHorizonPath: metaOptimizeMirror.longHorizonPath,
      topTaxonomyFamilyIds: metaOptimizeMirror.topTaxonomyFamilyIds,
      topTaxonomyGroupIds: metaOptimizeMirror.topTaxonomyGroupIds,
      pressureAreas: metaOptimizeMirror.pressureAreas,
      taxonomyOverview: metaOptimizeMirror.taxonomyOverview
    },
    clusters: metaOptimizeMirror.topClusters,
    longHorizon: metaOptimizeMirror.longHorizon,
    lastRefreshedAt: generatedAt,
    updatedAt: generatedAt
  };
  const reportLines = [
    "# Latest optimizer report",
    "",
    "- Proposal only: true",
    `- Generated: ${generatedAt}`,
    ...renderMetaOptimizeOverviewLines(metaOptimizeMirror),
    `- Active signal types: ${signalTypes.join(", ") || "none"}`,
    `- Ranking method: ${metaOptimizeMirror.rankingMethod}`,
    `- Stable tie-break order: ${metaOptimizeMirror.tieBreakOrder.join(", ")}`,
    `- Long-horizon history policy: ${longHorizonMemory.historyPolicy.mode} (${longHorizonMemory.historyPolicy.lastAction}: ${longHorizonMemory.historyPolicy.reason})`,
    `- Board phase: ${board.currentPhase}`,
    `- Board role: ${board.assignedRole}`,
    "",
    "## Optimization frontier",
    "",
    ...(clusters.length > 0
      ? clusters.flatMap((cluster) => [
          `### ${cluster.rank}. ${cluster.label} [${cluster.priority}]`,
          `- Cluster id: ${cluster.id}`,
          `- Summary: ${cluster.summary}`,
          `- Operator goal: ${cluster.operatorGoal}`,
          `- Recommendation count: ${cluster.recommendationCount}`,
          `- Cluster score: ${cluster.score}`,
          `- Cluster sort key: ${cluster.sortKey}`,
          `- Top recommendation: ${cluster.topRecommendationId}`,
          `- Response owners: ${cluster.responseOwnerRoles.join(", ") || "none"}`,
          `- Signal types: ${cluster.signalTypes.join(", ") || "none"}`,
          `- Taxonomy pressure: ${cluster.taxonomyPressure?.overview ?? "No typed wiki taxonomy pressure is active in this cluster."}`,
          `- Evidence artifacts: ${cluster.evidenceArtifactPaths.join(", ") || "none"}`,
          `- Membership: ${cluster.recommendationIds.join(", ") || "none"}`,
          ""
        ])
      : ["- No clusters generated from the current durable signals."]),
    "## Evidence-backed recommendations",
    "",
    ...(clusters.length > 0
      ? clusters.flatMap((cluster) => [
          `### Cluster ${cluster.rank}: ${cluster.label}`,
          ...rankedRecommendations
            .filter((item) => item.clusterId === cluster.id)
            .flatMap((item) => [
              `#### ${item.rank}. ${item.id} [${item.priority}]`,
              `- Cluster: ${item.clusterLabel}`,
              `- Category: ${item.category}`,
              `- Scope: ${item.scope}`,
              `- Summary: ${item.summary}`,
              `- Why: ${item.rationale}`,
              `- Next action: ${item.nextAction}`,
              `- Score: ${item.score}`,
              `- Ranking basis: ${item.rankingBasis.join(", ")}`,
              `- Signal strength: recurrence=${item.signalStrength.recurrenceCount} evidence=${item.signalStrength.evidenceDensity} cross-session=${item.signalStrength.crossSessionRecurrence} repair=${item.signalStrength.repairFrontierOverlap} audit=${item.signalStrength.auditCriticality} bridge=${item.signalStrength.bridgeCriticality} queue=${item.signalStrength.queueChurn} taxonomy-family=${item.signalStrength.taxonomyFamilyPressure} taxonomy-group=${item.signalStrength.taxonomyGroupPressure}`,
              `- Taxonomy pressure: ${item.taxonomyPressure?.overview ?? "No typed wiki taxonomy pressure is active in this recommendation."}`,
              `- Evidence artifacts: ${item.evidenceArtifactPaths.join(", ") || "none"}`,
              `- Evidence ids: ${item.evidenceIds.join(", ") || "none"}`,
              `- Response owner: ${item.responseOwnerRole ?? "none"}`,
              `- Stable sort key: ${item.sortKey}`,
              `- Stable tie-break key: ${item.tieBreakKey}`,
              ""
            ])
        ])
      : ["- No recommendations generated from the current durable signals."]),
    "## Long-horizon workflow memory",
    "",
    ...(longHorizonMemory.families.length > 0
      ? longHorizonMemory.families.flatMap((family) => [
          `### ${family.label} [${family.trend.status}]`,
          `- Family id: ${family.id}`,
          `- Summary: ${family.summary}`,
          `- Current recommendation count: ${family.currentCount}`,
          `- Total observations: ${family.totalCount}`,
          `- Active snapshots: ${family.activeSnapshotCount}`,
          `- Trend: recent=${family.trend.recentCount} previous=${family.trend.previousCount}`,
          `- Taxonomy families: ${family.relatedTaxonomyFamilyIds.join(", ") || "none"}`,
          `- Taxonomy groups: ${family.relatedTaxonomyGroupIds.join(", ") || "none"}`,
          `- Pressure areas: ${family.operatorPressureAreas.join(", ") || "none"}`,
          `- Top recommendations: ${family.topRecommendationIds.join(", ") || "none"}`,
          `- Top clusters: ${family.topClusterIds.join(", ") || "none"}`,
          `- Evidence artifacts: ${family.evidenceArtifactPaths.join(", ") || "none"}`,
          ""
        ])
      : ["- No long-horizon memory families have been observed yet."]),
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
    longHorizonMemory,
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
  const existingLongHorizonMemory = normalizeMetaLongHorizonMemory(readJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, createMetaLongHorizonMemory));
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
    comparisons,
    existingLongHorizonMemory
  });
  const workspaceIndex = buildWorkspaceIndex(
    state,
    board,
    packetsWithHealth,
    reviewState,
    { entries },
    versionsIndex,
    comparisons,
    wikiRelations,
    figureQa,
    buildMetaOptimizeMirror(metaOptimize.metaRecommendations, metaOptimize.longHorizonMemory)
  );
  writeJson(root, ARTIFACT_PATHS.workspaceIndex, workspaceIndex);
  writeJson(root, ARTIFACT_PATHS.metaEvents, metaOptimize.metaEvents);
  writeJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, metaOptimize.longHorizonMemory);
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
    ARTIFACT_PATHS.metaLongHorizonMemory,
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
  const longHorizonMemory = normalizeMetaLongHorizonMemory(readJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, createMetaLongHorizonMemory));
  const recommendations = normalizeMetaRecommendationsIndex(readJson(root, ARTIFACT_PATHS.metaRecommendations, createMetaRecommendationsIndex));
  const state = normalizeMetaOptimizerState(readJson(root, ARTIFACT_PATHS.metaOptimizerState, createMetaOptimizerState));
  return {
    proposalOnly: true,
    events: events.items ?? [],
    longHorizon: longHorizonMemory,
    recommendations: recommendations.items ?? [],
    clusters: recommendations.clusters ?? [],
    groupedFrontier: {
      ranking: recommendations.ranking ?? state.frontier?.ranking ?? null,
      frontier: recommendations.frontier ?? state.frontier,
      topClusters: recommendations.summary?.topClusters ?? state.frontier?.topClusters ?? [],
      clusterMembership: recommendations.summary?.clusterMembership ?? {}
    },
    frontier: recommendations.frontier ?? state.frontier,
    summary: recommendations.summary ?? state.frontier,
    state,
    reportPath: ARTIFACT_PATHS.metaOptimizerReport,
    recommendationsPath: ARTIFACT_PATHS.metaRecommendations,
    eventsPath: ARTIFACT_PATHS.metaEvents,
    longHorizonPath: ARTIFACT_PATHS.metaLongHorizonMemory
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
