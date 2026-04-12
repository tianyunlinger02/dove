import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  ROLE_IDS,
  createDefaultBoard,
  createSessionJournal,
  createTaskPacketsIndex,
  createVersionComparisonsIndex,
  createVersionsIndex,
  createWorkflowBoundaries,
  createWorkspaceIndex,
  createWikiEntitiesIndex,
  createWikiRelationsIndex
} from "./schema.mjs";
import { ensureWorkspace, loadState, nowIso, readJson, resolvePath, writeJson, writeText } from "./workspace.mjs";

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)))
    : [];
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
    lifecycleStatus: packet.lifecycleStatus ?? packet.status ?? "pending",
    active: packet.active ?? true,
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
    updatedAt: packet.updatedAt ?? nowIso(),
    packetPath: packet.packetPath ?? packetFilePath(packet.id)
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
    ARTIFACT_PATHS.wikiEntities,
    ARTIFACT_PATHS.wikiRelations
  ];

  switch (roleId) {
    case "researcher":
      return [...shared, ARTIFACT_PATHS.researchBrief, ARTIFACT_PATHS.researchAgenda, ARTIFACT_PATHS.sources, ARTIFACT_PATHS.notes, ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.queryPack];
    case "reviewer":
      return [...shared, ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.adversarialReviewState, ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.claimBridgeLog, ARTIFACT_PATHS.revisionPlan, ARTIFACT_PATHS.checklist];
    case "rebuttal-lead":
      return [...shared, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.rebuttalStrategy, ARTIFACT_PATHS.rebuttalResponseDraft];
    case "experiment-planner":
      return [...shared, ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.claimBridgeLog, ARTIFACT_PATHS.experimentLog];
    case "version-analyst":
      return [...shared, ARTIFACT_PATHS.versionsIndex, ARTIFACT_PATHS.versionComparisons, ARTIFACT_PATHS.versionComparisonReport];
    default:
      return [...shared, ARTIFACT_PATHS.plan, ARTIFACT_PATHS.outline, ARTIFACT_PATHS.revisionPlan, ARTIFACT_PATHS.checklist];
  }
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
      return { ...packet, active: false };
    }
    return packet;
  });
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
  const activePackets = packets.filter((packet) => packet.active && !["done", "resolved", "archived", "cancelled"].includes(packet.status));
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
    `- Current version: ${board.versionLineage?.currentVersionId ?? "none"}`,
    "",
    "## Active task packets",
    "",
    ...(activePackets.length > 0
      ? activePackets.map((packet) => `- ${packet.id}: ${packet.title} [${packet.status}] (${packet.assignedRole}) → next: ${packet.nextAction}`)
      : ["- No active task packets."]),
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
    "",
    "## Role context manifests",
    "",
    ...roleRoster.map((role) => `- ${role.id}: ${path.join(ARTIFACT_PATHS.roleContextsDir, `${role.id}.json`)}`)
  ].join("\n");
}

function renderNavigationReport(board, taskGraph, openQuestions, decisions, versionsIndex, comparisons) {
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
      ? taskGraph.nodes.map((packet) => `- ${packet.id}: ${packet.title} [${packet.status}] parent=${packet.parentPacketId || "none"} depends on ${packet.dependencies.join(", ") || "none"} → next ${packet.nextAction}`)
      : ["- No task packets generated yet."]),
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
  return {
    version: 1,
    roleId: role.id,
    label: role.label,
    charter: role.charter,
    contextPaths: roleContextPaths(role.id),
    activeTaskPacketIds: rolePackets.map((packet) => packet.id),
    openQuestionIds: Array.from(new Set(roleQuestionIds.concat(openQuestions.filter((item) => item.origin === "review-state" && role.id === "reviewer").map((item) => item.id)))),
    decisionIds: Array.from(new Set(roleDecisionIds)),
    workspaceIndexPath: ARTIFACT_PATHS.workspaceIndex,
    currentFocus: rolePackets[0]?.currentFocus ?? workspaceIndex.currentFocus ?? null,
    generatedAt: nowIso()
  };
}

function buildPhaseManifest(board, packets) {
  return {
    version: 1,
    phaseId: board.currentPhase,
    intentType: board.intentType,
    currentFocus: board.currentFocus,
    nextAction: board.nextAction,
    assignedRole: board.assignedRole,
    activePacketIds: packets.filter((packet) => packet.phase === board.currentPhase && packet.active).map((packet) => packet.id),
    blockerIds: packets.filter((packet) => packet.sourceType === "blocker" && packet.active).map((packet) => packet.id),
    generatedAt: nowIso()
  };
}

function buildWorkspaceIndex(board, packets, reviewState, journal, versionsIndex, comparisons) {
  const base = createWorkspaceIndex();
  return {
    ...base,
    currentFocus: board.currentFocus,
    nextAction: board.nextAction,
    continuationState: board.continuationState,
    activePackets: packets.filter((packet) => packet.active && !["done", "resolved", "archived", "cancelled"].includes(packet.status)).map((packet) => ({
      id: packet.id,
      title: packet.title,
      status: packet.status,
      assignedRole: packet.assignedRole,
      phase: packet.phase,
      nextAction: packet.nextAction
    })),
    activeRoles: Array.from(new Set(packets.filter((packet) => packet.active).map((packet) => packet.assignedRole))),
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
  const plansIndex = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const issuesIndex = readJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null });
  const versionsIndex = readJson(root, ARTIFACT_PATHS.versionsIndex, createVersionsIndex);
  const comparisons = readJson(root, ARTIFACT_PATHS.versionComparisons, createVersionComparisonsIndex);
  const taskPacketIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, createTaskPacketsIndex);
  const wikiEntities = readJson(root, ARTIFACT_PATHS.wikiEntities, createWikiEntitiesIndex);

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
  const packetIndex = { version: 2, items: packets, updatedAt: nowIso() };
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, packetIndex);
  for (const packet of packets) {
    writeJson(root, packetFilePath(packet.id), packet);
  }

  const openQuestions = buildOpenQuestions(notesIndex, packets, reviewState, wikiEntities).sort((left, right) => left.id.localeCompare(right.id));
  const decisions = buildDecisions(board, versionsIndex, comparisons, packets, wikiEntities);
  const taskGraph = buildTaskGraph(packets);
  const roleRoster = Array.isArray(board.roleRoster) ? board.roleRoster : [];

  const journal = readJson(root, ARTIFACT_PATHS.sessionJournal, createSessionJournal);
  const entry = {
    id: `${nowIso()}-${slugify(event.type ?? event.summary ?? "workspace-refresh")}`,
    timestamp: nowIso(),
    type: event.type ?? "workspace-refresh",
    summary: event.summary ?? `Refreshed durable surfaces during ${board.currentPhase}.`,
    phase: board.currentPhase,
    assignedRole: board.assignedRole,
    taskPacketIds: packets.filter((packet) => packet.active).map((packet) => packet.id),
    artifactPaths: normalizeStringArray(event.artifactPaths ?? [ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.sessionSummary, ARTIFACT_PATHS.navigationReport, ARTIFACT_PATHS.workspaceIndex])
  };
  const entries = [...(journal.entries ?? []).slice(-199), entry];
  writeJson(root, ARTIFACT_PATHS.sessionJournal, { version: 1, entries, updatedAt: nowIso() });

  const workspaceIndex = buildWorkspaceIndex(board, packets, reviewState, { entries }, versionsIndex, comparisons);
  writeJson(root, ARTIFACT_PATHS.workspaceIndex, workspaceIndex);
  for (const role of roleRoster) {
    const manifest = buildRoleManifest(role, packets, openQuestions, decisions, workspaceIndex);
    writeJson(root, path.join(ARTIFACT_PATHS.roleContextsDir, `${role.id}.json`), manifest);
  }
  writeJson(root, path.join(ARTIFACT_PATHS.phaseContextsDir, `${board.currentPhase}.json`), buildPhaseManifest(board, packets));

  writeText(root, ARTIFACT_PATHS.sessionSummary, renderSessionSummary(state, board, packets, openQuestions, decisions, roleRoster, workspaceIndex));
  writeText(root, ARTIFACT_PATHS.navigationReport, renderNavigationReport(board, taskGraph, openQuestions, decisions, versionsIndex, comparisons));

  return { packetIndex, openQuestions, decisions, taskGraph, workspaceIndex };
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
