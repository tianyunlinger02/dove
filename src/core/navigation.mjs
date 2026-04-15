import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  GOVERNANCE_EXEMPT_MUTATIONS,
  GOVERNANCE_GUARDED_MUTATIONS,
  ROLE_IDS,
  createDefaultBoard,
  createMetaEventsIndex,
  createMetaExecutionBridgeCandidatesIndex,
  createMetaGovernanceCoverageIndex,
  createMetaGovernanceCoverageReport,
  createMetaLongHorizonMemory,
  createMetaOperatorFollowThroughIndex,
  createMetaOperatorFollowThroughTransitionsIndex,
  createMetaOperatorPlaybooksIndex,
  createMetaRemediationPacksIndex,
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
  normalizeMetaExecutionBridgeCandidatesIndex,
  normalizeMetaGovernanceCoverageIndex,
  normalizeMetaGovernanceCoverageReport,
  normalizeMetaLongHorizonMemory,
  normalizeMetaOperatorFollowThroughIndex,
  normalizeMetaOperatorFollowThroughTransitionsIndex,
  normalizeMetaOperatorPlaybooksIndex,
  normalizeMetaRemediationPacksIndex,
  normalizeMetaOptimizerState,
  normalizeMetaRecommendationsIndex,
  resolveResumeCommandForPhase
} from "./schema.mjs";
import { assertGovernanceMutationRegistered, ensureWorkspace, loadState, nowIso, overrideEvidenceRelevantToItems, readJson, resolvePath, writeJson, writeText } from "./workspace.mjs";

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

  if ([ARTIFACT_PATHS.metaEvents, ARTIFACT_PATHS.metaExecutionBridgeCandidates, ARTIFACT_PATHS.metaRemediationPacks, ARTIFACT_PATHS.metaRecommendations, ARTIFACT_PATHS.metaOptimizerState, ARTIFACT_PATHS.metaOptimizerReport].includes(normalized)) {
    return {
      category: "meta-optimize",
      summary: "Meta-optimize artifacts are proposal-only summaries built from durable workflow signals.",
      localRules: [
        "Do not auto-apply recommendations from this layer.",
        "Treat execution bridge candidates as manual scaffolds, not real work items.",
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

function buildActionContextBundle({ scopeType, scopeId, summary, board, workspaceIndex, packet = null, roleId = null, phaseId = null, artifactPath = null, requiredReadPaths = [], localRules = [], nextAction = null, operatorGuidance = null }) {
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
    operatorGuidance,
    generatedAt: nowIso()
  };
}

function isGovernanceRepairFrontierItem(item = {}) {
  return ["workflow-governance", "version-governance", "meta-optimize-drift"].includes(item.frontierType);
}

function selectTopRemediationPack(remediationPacks = {}, { roleId = null, packetId = null } = {}) {
  const packs = remediationPacks?.packs ?? [];
  if (packetId) {
    const packetMatch = packs.find((pack) => (pack.packetPointers ?? []).some((pointer) => pointer.id === packetId));
    if (packetMatch) {
      return packetMatch;
    }
  }
  if (roleId) {
    const roleMatch = packs.find((pack) => (pack.packetPointers ?? []).some((pointer) => pointer.assignedRole === roleId)
      || (pack.reviewConcerns ?? []).some((concern) => concern.responseOwnerRole === roleId));
    if (roleMatch) {
      return roleMatch;
    }
  }
  return packs[0] ?? null;
}

function conversionPathPriorityRank(value) {
  return value === "primary" ? 0 : value === "secondary" ? 1 : 2;
}

function buildRankedConversionCandidates(candidates = []) {
  return candidates
    .map((candidate, index) => ({
      ...candidate,
      priority: candidate.priority ?? "secondary",
      pathScore: Number.isFinite(candidate.pathScore) ? candidate.pathScore : 0,
      rankingBasis: normalizeStringArray(candidate.rankingBasis ?? []),
      deterministicKey: candidate.deterministicKey ?? [
        String(9999 - (Number.isFinite(candidate.pathScore) ? candidate.pathScore : 0)).padStart(4, "0"),
        String(conversionPathPriorityRank(candidate.priority ?? "secondary")).padStart(2, "0"),
        candidate.targetType ?? "path",
        candidate.targetId ?? `path-${index + 1}`
      ].join(":"),
      originalIndex: index
    }))
    .sort((left, right) => {
      const scoreDelta = (right.pathScore ?? 0) - (left.pathScore ?? 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      const priorityDelta = conversionPathPriorityRank(left.priority) - conversionPathPriorityRank(right.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return (left.deterministicKey ?? "").localeCompare(right.deterministicKey ?? "");
    })
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1
    }));
}

function operatorPlaybookSpecificityScore(playbook = {}, { roleId = null, packetId = null, packet = null, remediationPack = null, workspaceIndex = null } = {}) {
  let score = 0;
  const rankingBasis = [];
  const matchedPacketPointer = packetId ? (playbook.packetPointers ?? []).find((pointer) => pointer.id === packetId) ?? null : null;
  if (matchedPacketPointer) {
    score += 80;
    rankingBasis.push(`packet=${packetId}`);
  }
  if (packet?.id && packet.id === packetId) {
    score += 36;
    rankingBasis.push(`packetContext=${packet.id}`);
  }
  if (roleId && (playbook.responseOwnerRoles ?? []).includes(roleId)) {
    score += 40;
    rankingBasis.push(`ownerRole=${roleId}`);
  }
  if (roleId && (playbook.packetPointers ?? []).some((pointer) => pointer.assignedRole === roleId)) {
    score += 24;
    rankingBasis.push(`packetRole=${roleId}`);
  }
  if (roleId && (playbook.conversionHints ?? []).some((hint) => hint.assignedRole === roleId)) {
    score += 16;
    rankingBasis.push(`hintRole=${roleId}`);
  }
  const remediationFamilies = remediationPack?.taxonomyAnchors?.familyIds ?? [];
  const remediationGroups = remediationPack?.taxonomyAnchors?.groupIds ?? [];
  if (intersects(playbook.remediationPackIds ?? [], [remediationPack?.id].filter(Boolean))) {
    score += 36;
    rankingBasis.push(`pack=${remediationPack.id}`);
  }
  if (intersects(playbook.taxonomyFamilyId ? [playbook.taxonomyFamilyId] : [], remediationFamilies)) {
    score += 32;
    rankingBasis.push(`taxonomyFamily=${playbook.taxonomyFamilyId}`);
  }
  if (intersects(playbook.taxonomyGroupIds ?? [], remediationGroups)) {
    score += 18;
    rankingBasis.push(`taxonomyGroups=${(playbook.taxonomyGroupIds ?? []).filter((groupId) => remediationGroups.includes(groupId)).join(",")}`);
  }
  const activeFamilies = workspaceIndex?.metaOptimize?.topTaxonomyFamilyIds ?? [];
  if (intersects(playbook.taxonomyFamilyId ? [playbook.taxonomyFamilyId] : [], activeFamilies)) {
    score += 12;
    rankingBasis.push(`activeFamily=${playbook.taxonomyFamilyId}`);
  }
  const packetTextSource = matchedPacketPointer ?? packet ?? null;
  if (packetTextSource) {
    const packetText = [packetTextSource.title, packetTextSource.currentFocus, packetTextSource.nextAction]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const familyTerms = uniqueSorted([
      playbook.taxonomyFamilyId,
      playbook.taxonomyFamilyLabel,
      ...(playbook.taxonomyGroupIds ?? []),
      ...(playbook.taxonomyGroupLabels ?? [])
    ].map((value) => String(value).toLowerCase()));
    const matchedTerms = familyTerms.filter((term) => term && packetText.includes(term));
    if (matchedTerms.length > 0) {
      score += 48 + matchedTerms.length * 4;
      rankingBasis.push(`packetText=${matchedTerms.join(",")}`);
    }
  }
  score += Math.min((playbook.remediationPackIds ?? []).length, 5) * 2;
  score += Math.min((playbook.longHorizonFamilyIds ?? []).length, 5);
  rankingBasis.push(`remediationPackCount=${(playbook.remediationPackIds ?? []).length}`);
  rankingBasis.push(`longHorizonCount=${(playbook.longHorizonFamilyIds ?? []).length}`);
  return { score, rankingBasis: uniqueSorted(rankingBasis) };
}

function selectTopOperatorPlaybook(operatorPlaybooks = {}, { roleId = null, packetId = null } = {}) {
  const playbooks = operatorPlaybooks?.playbooks ?? [];
  return playbooks[0] ?? null;
}

function buildOperatorGuidance(workspaceIndex, remediationPacks = {}, operatorPlaybooks = {}, executionBridgeCandidatesIndex = {}, operatorFollowThrough = {}, { roleId = null, packetId = null, packet = null } = {}) {
  const topRepairItems = (workspaceIndex.repairFrontier?.prioritizedItems ?? []).slice(0, 3).map((item) => ({
    id: item.id,
    frontierType: item.frontierType,
    severity: item.severity ?? "medium",
    summary: item.summary,
    nextAction: item.nextAction
  }));
  const topRemediationPack = selectTopRemediationPack(remediationPacks, { roleId, packetId });
  const rankedPlaybookCandidates = (operatorPlaybooks?.playbooks ?? [])
    .map((playbook) => {
      const specificity = operatorPlaybookSpecificityScore(playbook, {
        roleId,
        packetId,
        packet,
        remediationPack: topRemediationPack,
        workspaceIndex
      });
      return {
        ...playbook,
        selectionScore: specificity.score,
        selectionRankingBasis: specificity.rankingBasis
      };
    })
    .sort((left, right) => {
      const scoreDelta = (right.selectionScore ?? 0) - (left.selectionScore ?? 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      const packDelta = (right.remediationPackIds?.length ?? 0) - (left.remediationPackIds?.length ?? 0);
      if (packDelta !== 0) {
        return packDelta;
      }
      return left.taxonomyFamilyId.localeCompare(right.taxonomyFamilyId);
    });
  const topOperatorPlaybook = rankedPlaybookCandidates[0] ?? null;
  const executionBridgeCandidates = (executionBridgeCandidatesIndex?.candidates ?? [])
    .filter((candidate) => {
      if (!candidate || typeof candidate !== "object") {
        return false;
      }
      if (topOperatorPlaybook && intersects(candidate.sourcePlaybookIds ?? [], [topOperatorPlaybook.id])) {
        return true;
      }
      if (topRemediationPack && intersects(candidate.sourceRemediationPackIds ?? [], [topRemediationPack.id])) {
        return true;
      }
      if (roleId && (candidate.sourceConversionPath?.assignedRole === roleId || (candidate.suggestedTitle ?? "").toLowerCase().includes(roleId.toLowerCase()))) {
        return true;
      }
      return false;
    })
    .slice(0, 4);
  const followThroughRecords = (operatorFollowThrough?.items ?? []).filter((record) => {
    if (topRemediationPack && record.sourceType === "remediation-pack" && record.sourceId === topRemediationPack.id) {
      return true;
    }
    if (topOperatorPlaybook && record.sourceType === "operator-playbook" && record.sourceId === topOperatorPlaybook.id) {
      return true;
    }
    if (executionBridgeCandidates.some((candidate) => record.sourceType === "execution-bridge" && record.sourceId === candidate.id)) {
      return true;
    }
    return false;
  }).slice(0, 4).map((record) => ({
    id: record.id,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    status: record.status,
    decisionSummary: record.decisionSummary,
    rationale: record.rationale,
    actorRole: record.actorRole,
    deferUntil: record.deferUntil,
    executeBy: record.executeBy,
    reviewAfter: record.reviewAfter,
    closureReason: record.closureReason,
    stale: record.stale,
    dueDeferred: record.dueDeferred,
    overdueExecution: record.overdueExecution,
    overdueExecutionSeverity: record.overdueExecutionSeverity,
    executionWindowState: record.executionWindowState,
    linkedTargetArtifact: record.linkedTargetArtifact,
    linkedTargetId: record.linkedTargetId
  }));
  return {
    repairFrontier: {
      count: workspaceIndex.repairFrontier?.count ?? 0,
      governanceIssueCount: workspaceIndex.repairFrontier?.governanceIssueCount ?? 0,
      taxonomyOverview: workspaceIndex.repairFrontier?.taxonomyOverview ?? "No degraded typed wiki relation families are currently summarized.",
      topItems: topRepairItems
    },
    taxonomyPressure: {
      overview: workspaceIndex.metaOptimize?.taxonomyOverview ?? "No typed wiki taxonomy pressure is currently active in the optimizer frontier.",
      pressureAreas: workspaceIndex.metaOptimize?.pressureAreas ?? [],
      topTaxonomyFamilyIds: workspaceIndex.metaOptimize?.topTaxonomyFamilyIds ?? [],
      topTaxonomyGroupIds: workspaceIndex.metaOptimize?.topTaxonomyGroupIds ?? []
    },
    remediationPack: topRemediationPack ? {
      id: topRemediationPack.id,
      title: topRemediationPack.title,
      clusterId: topRemediationPack.clusterId,
      summary: topRemediationPack.summary,
      readiness: topRemediationPack.readiness,
      taxonomyOverview: topRemediationPack.taxonomyAnchors?.overview ?? "No typed wiki taxonomy pressure is active in this remediation pack.",
      acceptanceCriteria: (topRemediationPack.acceptanceCriteria ?? []).slice(0, 3),
      conversionHints: (topRemediationPack.conversionHints ?? []).slice(0, 3),
      rankedConversionPaths: (topRemediationPack.rankedConversionPaths ?? []).slice(0, 4),
      manualNextActions: (topRemediationPack.manualNextActions ?? []).slice(0, 3),
      workspacePointers: (topRemediationPack.workspacePointers ?? []).slice(0, 5)
    } : null,
    followThrough: {
      summary: operatorFollowThrough.summary ?? { itemCount: 0, overview: "No operator follow-through decisions have been recorded yet." },
      topRecords: followThroughRecords,
      actionRequiredItems: (operatorFollowThrough.actionRequiredItems ?? []).slice(0, 4),
      executionWindowSummary: {
        dueSoonCount: operatorFollowThrough.summary?.dueSoonExecutionCount ?? 0,
        dueReviewCount: operatorFollowThrough.summary?.dueReviewCount ?? 0,
        overdueCount: operatorFollowThrough.summary?.overdueExecutionCount ?? 0,
        criticalOverdueCount: operatorFollowThrough.summary?.criticalOverdueExecutionCount ?? 0
      }
    },
    familyPlaybook: topOperatorPlaybook ? {
      id: topOperatorPlaybook.id,
      title: topOperatorPlaybook.title,
      taxonomyFamilyId: topOperatorPlaybook.taxonomyFamilyId,
      taxonomyFamilyLabel: topOperatorPlaybook.taxonomyFamilyLabel,
      summary: topOperatorPlaybook.summary,
      readiness: topOperatorPlaybook.readiness,
      operatorGoal: topOperatorPlaybook.operatorGoal,
      longHorizonSummary: topOperatorPlaybook.longHorizonSummary,
      selectionScore: topOperatorPlaybook.selectionScore,
      selectionRankingBasis: topOperatorPlaybook.selectionRankingBasis,
      artifactUpdateOverview: topOperatorPlaybook.artifactUpdateMap?.overview ?? `No explicit artifact targets were derived for ${topOperatorPlaybook.taxonomyFamilyLabel}.`,
      artifactUpdateTargets: (topOperatorPlaybook.artifactUpdateMap?.targets ?? []).slice(0, 5),
      artifactUpdateOrder: (topOperatorPlaybook.artifactUpdateMap?.updateOrder ?? []).slice(0, 5),
      acceptanceCriteria: (topOperatorPlaybook.acceptanceCriteria ?? []).slice(0, 4),
      conversionHints: (topOperatorPlaybook.conversionHints ?? []).slice(0, 4),
      rankedConversionPaths: (topOperatorPlaybook.rankedConversionPaths ?? []).slice(0, 4),
      manualNextActions: (topOperatorPlaybook.manualNextActions ?? []).slice(0, 4),
      remediationPackIds: (topOperatorPlaybook.remediationPackIds ?? []).slice(0, 4),
      workspacePointers: (topOperatorPlaybook.workspacePointers ?? []).slice(0, 6)
    } : null,
    executionBridgeCandidates: executionBridgeCandidates.map((candidate) => ({
      id: candidate.id,
      candidateType: candidate.candidateType,
      targetArtifact: candidate.targetArtifact,
      targetId: candidate.targetId,
      suggestedTitle: candidate.suggestedTitle,
      suggestedSummary: candidate.suggestedSummary,
      suggestedNextStep: candidate.suggestedNextStep,
      sourceRemediationPackIds: (candidate.sourceRemediationPackIds ?? []).slice(0, 3),
      sourcePlaybookIds: (candidate.sourcePlaybookIds ?? []).slice(0, 3),
      linkedRepairItemIds: (candidate.linkedRepairItemIds ?? []).slice(0, 5),
      suggestedAcceptanceCriteria: (candidate.suggestedAcceptanceCriteria ?? []).slice(0, 4),
      context: {
        linkedPacketPointers: (candidate.context?.linkedPacketPointers ?? []).slice(0, 2),
        linkedWorkspacePointers: (candidate.context?.linkedWorkspacePointers ?? []).slice(0, 4),
        linkedRemediationPacks: (candidate.context?.linkedRemediationPacks ?? []).slice(0, 2),
        linkedPlaybooks: (candidate.context?.linkedPlaybooks ?? []).slice(0, 2),
        evidenceSummary: candidate.context?.evidenceSummary ?? { artifactPaths: [], ids: [] },
        repairSummary: candidate.context?.repairSummary ?? { repairItemIds: [], reviewConcernIds: [], figureIssueIds: [] },
        bridgeNotes: (candidate.context?.bridgeNotes ?? []).slice(0, 3)
      }
    }))
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
    `- Repair frontier: ${workspaceIndex.repairFrontier?.count ?? 0} items (relations ${(workspaceIndex.repairFrontier?.relationIssueCount ?? 0)}, degraded families ${(workspaceIndex.repairFrontier?.relationFamilyIssueCount ?? 0)}, managed artifacts ${(workspaceIndex.repairFrontier?.managedArtifactIssueCount ?? 0)}, governance ${(workspaceIndex.repairFrontier?.governanceIssueCount ?? 0)})`,
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
    `- Repair frontier items: ${workspaceIndex.repairFrontier?.count ?? 0} (relations ${(workspaceIndex.repairFrontier?.relationIssueCount ?? 0)}, degraded families ${(workspaceIndex.repairFrontier?.relationFamilyIssueCount ?? 0)}, managed artifacts ${(workspaceIndex.repairFrontier?.managedArtifactIssueCount ?? 0)}, governance ${(workspaceIndex.repairFrontier?.governanceIssueCount ?? 0)})`,
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

function buildRoleManifest(role, packets, openQuestions, decisions, workspaceIndex, remediationPacks = {}, operatorPlaybooks = {}, executionBridgeCandidates = {}) {
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
    operatorGuidance: buildOperatorGuidance(workspaceIndex, remediationPacks, operatorPlaybooks, executionBridgeCandidates, { roleId: role.id }),
    generatedAt: nowIso()
  };
}

function buildPhaseManifest(board, packets, workspaceIndex, remediationPacks = {}, operatorPlaybooks = {}, executionBridgeCandidates = {}) {
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
    operatorGuidance: buildOperatorGuidance(workspaceIndex, remediationPacks, operatorPlaybooks, executionBridgeCandidates, { roleId: board.assignedRole }),
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

function buildMetaOptimizeMirror(metaRecommendations, longHorizonMemory, remediationPacks, operatorPlaybooks, executionBridgeCandidates, operatorFollowThrough, governanceCoverage) {
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
    remediationPacks: remediationPacks.summary,
    followThrough: operatorFollowThrough.summary,
    governanceCoverage: governanceCoverage.summary,
    executionBridgeCandidates: executionBridgeCandidates.summary,
    operatorPlaybooks: operatorPlaybooks.summary,
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
    `- Remediation packs: ${metaOptimize.remediationPacks?.packCount ?? 0} proposal-only packs (${(metaOptimize.remediationPacks?.topPackIds ?? []).join(", ") || "none"})`,
    `- Remediation pack focus: ${metaOptimize.remediationPacks?.overview ?? "No proposal-only remediation packs have been generated yet."}`,
    `- Remediation pack readiness: ${metaOptimize.remediationPacks?.readinessOverview ?? "No proposal-only remediation packs have been generated yet."}`,
    `- Remediation packs path: ${metaOptimize.remediationPacks?.packsPath ?? ARTIFACT_PATHS.metaRemediationPacks}`,
    `- Operator follow-through: ${metaOptimize.followThrough?.itemCount ?? 0} records (${(metaOptimize.followThrough?.topSourceIds ?? []).join(", ") || "none"})`,
    `- Operator follow-through overview: ${metaOptimize.followThrough?.overview ?? "No operator follow-through decisions have been recorded yet."}`,
    `- Operator follow-through debt: overdue=${metaOptimize.followThrough?.overdueExecutionCount ?? 0}, deferred-due=${metaOptimize.followThrough?.dueDeferredCount ?? 0}, stale=${metaOptimize.followThrough?.staleCount ?? 0}, invalid=${metaOptimize.followThrough?.invalidStatusCount ?? 0}, action-required=${metaOptimize.followThrough?.actionRequiredCount ?? 0}`,
    `- Operator follow-through execution window: due-soon=${metaOptimize.followThrough?.dueSoonExecutionCount ?? 0}, due-review=${metaOptimize.followThrough?.dueReviewCount ?? 0}, critical-overdue=${metaOptimize.followThrough?.criticalOverdueExecutionCount ?? 0}`,
    `- Operator follow-through path: ${metaOptimize.followThrough?.followThroughPath ?? ARTIFACT_PATHS.metaOperatorFollowThrough}`,
    `- Governance coverage: ${metaOptimize.governanceCoverage?.guardedCount ?? 0} guarded / ${metaOptimize.governanceCoverage?.exemptCount ?? 0} exempt`,
    `- Governance coverage overview: ${metaOptimize.governanceCoverage?.overview ?? "No governance coverage matrix has been summarized yet."}`,
    `- Governance coverage path: ${metaOptimize.governanceCoverage?.coveragePath ?? ARTIFACT_PATHS.metaGovernanceCoverage}`,
    `- Execution bridge candidates: ${metaOptimize.executionBridgeCandidates?.candidateCount ?? 0} proposal-only candidates (${(metaOptimize.executionBridgeCandidates?.topCandidateIds ?? []).join(", ") || "none"})`,
    `- Execution bridge focus: ${metaOptimize.executionBridgeCandidates?.overview ?? "No proposal-only execution bridge candidates have been generated yet."}`,
    `- Execution bridge path: ${metaOptimize.executionBridgeCandidates?.candidatesPath ?? ARTIFACT_PATHS.metaExecutionBridgeCandidates}`,
    `- Family playbooks: ${metaOptimize.operatorPlaybooks?.playbookCount ?? 0} proposal-only playbooks (${(metaOptimize.operatorPlaybooks?.topTaxonomyFamilyIds ?? []).join(", ") || "none"})`,
    `- Family playbook focus: ${metaOptimize.operatorPlaybooks?.overview ?? "No proposal-only family-level operator playbooks have been generated yet."}`,
    `- Family playbook readiness: ${metaOptimize.operatorPlaybooks?.readinessOverview ?? "No proposal-only family-level operator playbooks have been generated yet."}`,
    `- Family playbooks path: ${metaOptimize.operatorPlaybooks?.playbooksPath ?? ARTIFACT_PATHS.metaOperatorPlaybooks}`,
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

function intersects(values = [], otherValues = []) {
  const target = new Set(otherValues);
  return values.some((value) => target.has(value));
}

function summarizeConcernForPack(concern = {}) {
  return {
    id: concern.id,
    summary: concern.summary,
    severity: concern.severity ?? "medium",
    status: concern.status ?? "open",
    responseOwnerRole: concern.responseOwnerRole ?? null,
    linkedArtifactPaths: uniqueSorted(concern.linkedArtifactPaths ?? []),
    linkedAuditIds: uniqueSorted(concern.linkedAuditIds ?? []),
    linkedBridgeIds: uniqueSorted(concern.linkedBridgeIds ?? [])
  };
}

function summarizeFigureIssueForPack(issue = {}) {
  return {
    id: issue.id,
    figureId: issue.figureId ?? null,
    severity: issue.severity ?? "medium",
    code: issue.code ?? null,
    summary: issue.summary ?? `Figure issue ${issue.id}`,
    artifactPaths: uniqueSorted(issue.artifactPaths ?? [])
  };
}

function hashFollowThroughSource(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildFollowThroughSourceCatalog(remediationPacks, operatorPlaybooks, executionBridgeCandidates) {
  const catalog = new Map();
  for (const pack of remediationPacks.packs ?? []) {
    catalog.set(`remediation-pack:${pack.id}`, {
      sourceType: "remediation-pack",
      sourceId: pack.id,
      sourceArtifactPath: ARTIFACT_PATHS.metaRemediationPacks,
      sourceFingerprint: hashFollowThroughSource({
        id: pack.id,
        clusterId: pack.clusterId,
        readiness: pack.readiness,
        acceptanceCriteria: pack.acceptanceCriteria,
        rankedConversionPaths: (pack.rankedConversionPaths ?? []).map((item) => [item.targetType, item.targetId, item.rank, item.pathScore]),
        manualNextActions: pack.manualNextActions,
        reviewConcerns: (pack.reviewConcerns ?? []).map((item) => [item.id, item.summary, item.status, item.severity]),
        figureQa: (pack.figureQa ?? []).map((item) => [item.id, item.code, item.summary, item.severity])
      }),
      allowedActorRoles: uniqueSorted([...(pack.packetPointers ?? []).map((item) => item.assignedRole), ...(pack.conversionHints ?? []).map((item) => item.assignedRole)].filter(Boolean)),
      title: pack.title,
      summary: pack.summary
    });
  }
  for (const playbook of operatorPlaybooks.playbooks ?? []) {
    catalog.set(`operator-playbook:${playbook.id}`, {
      sourceType: "operator-playbook",
      sourceId: playbook.id,
      sourceArtifactPath: ARTIFACT_PATHS.metaOperatorPlaybooks,
      sourceFingerprint: hashFollowThroughSource({
        id: playbook.id,
        taxonomyFamilyId: playbook.taxonomyFamilyId,
        readiness: playbook.readiness,
        acceptanceCriteria: playbook.acceptanceCriteria,
        rankedConversionPaths: (playbook.rankedConversionPaths ?? []).map((item) => [item.targetType, item.targetId, item.rank, item.pathScore]),
        manualNextActions: playbook.manualNextActions
      }),
      allowedActorRoles: uniqueSorted(playbook.responseOwnerRoles ?? []),
      title: playbook.title,
      summary: playbook.summary
    });
  }
  for (const candidate of executionBridgeCandidates.candidates ?? []) {
    catalog.set(`execution-bridge:${candidate.id}`, {
      sourceType: "execution-bridge",
      sourceId: candidate.id,
      sourceArtifactPath: ARTIFACT_PATHS.metaExecutionBridgeCandidates,
      sourceFingerprint: hashFollowThroughSource({
        id: candidate.id,
        candidateType: candidate.candidateType,
        targetArtifact: candidate.targetArtifact,
        targetId: candidate.targetId,
        suggestedAcceptanceCriteria: candidate.suggestedAcceptanceCriteria,
        sourceRemediationPackIds: candidate.sourceRemediationPackIds,
        sourcePlaybookIds: candidate.sourcePlaybookIds
      }),
      allowedActorRoles: uniqueSorted([candidate.sourceConversionPath?.assignedRole, ...(candidate.context?.linkedPacketPointers ?? []).map((item) => item.assignedRole)].filter(Boolean)),
      title: candidate.suggestedTitle,
      summary: candidate.suggestedSummary
    });
  }
  return catalog;
}

function normalizeFollowThroughStatus(status = "acknowledged") {
  const allowed = new Set(["acknowledged", "accepted-for-execution", "executing", "deferred", "accepted-risk", "closed", "superseded"]);
  return allowed.has(status) ? status : "acknowledged";
}

function buildOperatorFollowThrough(root, existingIndex, sourceCatalog, timestamp = nowIso()) {
  const items = (existingIndex.items ?? []).map((item, index) => {
    const sourceType = item.sourceType ?? "remediation-pack";
    const sourceId = item.sourceId ?? item.id ?? `unknown-${index + 1}`;
    const key = `${sourceType}:${sourceId}`;
    const source = sourceCatalog.get(key);
    const allowed = new Set(["acknowledged", "accepted-for-execution", "executing", "deferred", "accepted-risk", "closed", "superseded"]);
    const invalidStatus = !allowed.has(item.status) || (item.status === "accepted-for-execution" && !item.reviewAfter);
    const status = invalidStatus ? "acknowledged" : item.status;
    const dueDeferred = status === "deferred" && item.deferUntil && String(item.deferUntil) <= timestamp;
    const dueReview = status === "accepted-for-execution" && item.reviewAfter && String(item.reviewAfter) <= timestamp;
    const dueSoonExecution = ["accepted-for-execution", "executing"].includes(status) && item.executeBy && String(item.executeBy) > timestamp && String(item.executeBy) <= new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const overdueExecution = ["accepted-for-execution", "executing"].includes(status) && item.executeBy && String(item.executeBy) <= timestamp;
    const overdueExecutionSeverity = overdueExecution
      ? (String(item.executeBy) <= new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() ? "critical" : "warning")
      : (dueSoonExecution ? "at-risk" : null);
    const executionWindowState = !["accepted-for-execution", "executing"].includes(status)
      ? null
      : overdueExecution
        ? (overdueExecutionSeverity === "critical" ? "critical-overdue" : "overdue")
        : dueSoonExecution
          ? "due-soon"
          : "on-track";
    const targetBound = followThroughTargetStillBound(root, {
      status,
      linkedTargetArtifact: item.linkedTargetArtifact ?? null,
      linkedTargetId: item.linkedTargetId ?? null
    });
    return {
      id: item.id ?? `follow-through-${slugify(`${sourceType}-${sourceId}`)}`,
      sourceType,
      sourceId,
      sourceArtifactPath: source?.sourceArtifactPath ?? item.sourceArtifactPath ?? null,
      sourceFingerprint: source?.sourceFingerprint ?? item.sourceFingerprint ?? null,
      sourceTitle: source?.title ?? item.sourceTitle ?? sourceId,
      sourceSummary: source?.summary ?? item.sourceSummary ?? "",
      status,
      decisionSummary: item.decisionSummary ?? "",
      rationale: item.rationale ?? "",
      selectedConversionPathKey: item.selectedConversionPathKey ?? null,
      linkedTargetArtifact: item.linkedTargetArtifact ?? null,
      linkedTargetId: item.linkedTargetId ?? null,
      deferUntil: item.deferUntil ?? null,
      executeBy: item.executeBy ?? null,
      executionStartedAt: item.executionStartedAt ?? null,
      executionCompletedAt: item.executionCompletedAt ?? null,
      reviewAfter: item.reviewAfter ?? null,
      closureReason: item.closureReason ?? null,
      closureArtifactPaths: normalizeStringArray(item.closureArtifactPaths),
      actorRole: item.actorRole ?? null,
      recordedAt: item.recordedAt ?? item.updatedAt ?? timestamp,
      updatedAt: item.updatedAt ?? timestamp,
      invalidStatus,
      stale: Boolean(source && item.sourceFingerprint && item.sourceFingerprint !== source.sourceFingerprint),
      dueDeferred,
      dueReview,
      overdueExecution,
      overdueExecutionSeverity,
      executionWindowState,
      targetBound
    };
  }).sort((left, right) => left.id.localeCompare(right.id));

  const summary = {
    itemCount: items.length,
    acknowledgedCount: items.filter((item) => item.status === "acknowledged").length,
    acceptedForExecutionCount: items.filter((item) => item.status === "accepted-for-execution").length,
    executingCount: items.filter((item) => item.status === "executing").length,
    overdueExecutionCount: items.filter((item) => item.overdueExecution).length,
    criticalOverdueExecutionCount: items.filter((item) => item.overdueExecutionSeverity === "critical").length,
    dueSoonExecutionCount: items.filter((item) => item.executionWindowState === "due-soon").length,
    deferredCount: items.filter((item) => item.status === "deferred").length,
    acceptedRiskCount: items.filter((item) => item.status === "accepted-risk").length,
    closedCount: items.filter((item) => item.status === "closed").length,
    supersededCount: items.filter((item) => item.status === "superseded").length,
    invalidStatusCount: items.filter((item) => item.invalidStatus).length,
    staleCount: items.filter((item) => item.stale).length,
    dueDeferredCount: items.filter((item) => item.dueDeferred).length,
    dueReviewCount: items.filter((item) => item.dueReview).length,
    unresolvedTargetCount: items.filter((item) => !item.targetBound).length,
    topSourceIds: items.filter((item) => !["closed", "superseded"].includes(item.status)).slice(0, 5).map((item) => item.sourceId),
    overview: items.length > 0
      ? `${items.length} operator follow-through records: ${items.filter((item) => item.status === "accepted-for-execution").length} accepted for execution, ${items.filter((item) => item.executionWindowState === "due-soon").length} due-soon, ${items.filter((item) => item.overdueExecution).length} overdue-execution (${items.filter((item) => item.overdueExecutionSeverity === "critical").length} critical), ${items.filter((item) => item.dueReview).length} due-review, ${items.filter((item) => item.status === "deferred").length} deferred, ${items.filter((item) => item.status === "accepted-risk").length} accepted-risk, ${items.filter((item) => item.stale).length} stale, ${items.filter((item) => item.invalidStatus).length} invalid-status, ${items.filter((item) => !item.targetBound).length} target-drift.`
      : "No operator follow-through decisions have been recorded yet.",
    followThroughPath: ARTIFACT_PATHS.metaOperatorFollowThrough,
    transitionsPath: ARTIFACT_PATHS.metaOperatorFollowThroughTransitions
  };

  const actionRequiredItems = items.filter((item) => item.invalidStatus || item.stale || item.dueDeferred || item.dueReview || item.overdueExecution || !item.targetBound || item.status === "accepted-for-execution" || item.status === "executing").map((item) => ({
    id: item.id,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    status: item.status,
    stale: item.stale,
    dueDeferred: item.dueDeferred,
      invalidStatus: item.invalidStatus,
      dueReview: item.dueReview,
      overdueExecution: item.overdueExecution,
      overdueExecutionSeverity: item.overdueExecutionSeverity,
      executionWindowState: item.executionWindowState,
      linkedTargetArtifact: item.linkedTargetArtifact,
    linkedTargetId: item.linkedTargetId,
    nextAction: !item.targetBound
      ? "Re-bind this follow-through record to a live target artifact/id before continuing."
      : item.overdueExecution
        ? `Escalate this ${item.overdueExecutionSeverity ?? "warning"} accepted-for-execution record or update/close it immediately.`
      : item.dueReview
        ? "Review this accepted-for-execution record now or explicitly defer/close it before the review window drifts further."
      : item.executionWindowState === "due-soon"
        ? "Schedule execution or explicitly defer this accepted-for-execution record before it goes overdue."
      : item.status === "executing"
        ? "Advance this executing record to closure or explicitly defer/accept-risk it."
      : item.status === "accepted-for-execution" && (!item.linkedTargetArtifact || !item.linkedTargetId)
        ? "Add a durable target artifact/id before keeping this record accepted-for-execution."
      : item.status === "accepted-for-execution"
        ? "Carry this accepted-for-execution decision through to closure or explicitly defer/accept-risk it."
      : item.dueDeferred
        ? "Review or reschedule this deferred follow-through now."
        : item.stale
          ? "Re-open and reassess this stale follow-through against the updated source."
          : item.invalidStatus
            ? "Repair the invalid follow-through status in the durable ledger."
            : "Review this follow-through record."
  }));

  return {
    ...createMetaOperatorFollowThroughIndex(),
    items,
    summary: {
      ...summary,
      actionRequiredCount: actionRequiredItems.length,
      actionRequiredSourceIds: actionRequiredItems.map((item) => item.sourceId)
    },
    actionRequiredItems,
    updatedAt: timestamp
  };
}

function buildGovernanceCoverage(generatedAt = nowIso()) {
  const guardedMutations = GOVERNANCE_GUARDED_MUTATIONS;
  const exemptMutations = GOVERNANCE_EXEMPT_MUTATIONS;
  return {
    ...createMetaGovernanceCoverageIndex(),
    guardedMutations,
    exemptMutations,
    summary: {
      guardedCount: guardedMutations.length,
      exemptCount: exemptMutations.length,
      overview: `${guardedMutations.length} write paths currently require clear operator follow-through; ${exemptMutations.length} paths remain explicitly exempt.`,
      coveragePath: ARTIFACT_PATHS.metaGovernanceCoverage
    },
    updatedAt: generatedAt
  };
}

function buildGovernanceCoverageReport(governanceCoverage, generatedAt = nowIso()) {
  return {
    ...createMetaGovernanceCoverageReport(),
    status: "ok",
    guardedIds: governanceCoverage.guardedMutations.map((item) => item.id),
    exemptIds: governanceCoverage.exemptMutations.map((item) => item.id),
    surfaceBindingAudit: {
      uncoveredTools: [],
      uncoveredCommands: [],
      uncoveredCoreFunctions: [],
      uncoveredNegativeCoverage: []
    },
    summary: {
      guardedCount: governanceCoverage.summary.guardedCount,
      exemptCount: governanceCoverage.summary.exemptCount,
      overview: governanceCoverage.summary.overview,
      reportPath: ARTIFACT_PATHS.metaGovernanceCoverageReport,
      markdownPath: ARTIFACT_PATHS.metaGovernanceCoverageReportMarkdown
    },
    updatedAt: generatedAt
  };
}

function validateFollowThroughPayload(record = {}) {
  const status = record.status;
  const allowed = new Set(["acknowledged", "accepted-for-execution", "executing", "deferred", "accepted-risk", "closed", "superseded"]);
  if (!allowed.has(status)) {
    throw new Error(`Invalid follow-through status: ${status}`);
  }
  if (status === "deferred" && !record.deferUntil && !record.reviewAfter) {
    throw new Error("Deferred follow-through records require deferUntil or reviewAfter.");
  }
  if (status === "accepted-risk" && !record.rationale) {
    throw new Error("Accepted-risk follow-through records require rationale.");
  }
  if (status === "accepted-for-execution" && (!record.linkedTargetArtifact || !record.linkedTargetId)) {
    throw new Error("Accepted-for-execution follow-through records require linkedTargetArtifact and linkedTargetId.");
  }
  if (status === "accepted-for-execution" && !record.executeBy) {
    throw new Error("Accepted-for-execution follow-through records require executeBy.");
  }
  if (status === "accepted-for-execution" && !record.reviewAfter) {
    throw new Error("Accepted-for-execution follow-through records require reviewAfter.");
  }
  if (status === "executing" && (!record.linkedTargetArtifact || !record.linkedTargetId || !record.executionStartedAt)) {
    throw new Error("Executing follow-through records require linkedTargetArtifact, linkedTargetId, and executionStartedAt.");
  }
  if (status === "closed" && normalizeStringArray(record.closureArtifactPaths).length === 0 && !record.closureReason) {
    throw new Error("Closed follow-through records require closureArtifactPaths or closureReason.");
  }
  if (status === "closed" && !record.executionCompletedAt) {
    throw new Error("Closed follow-through records require executionCompletedAt.");
  }
  if (!record.actorRole) {
    throw new Error("Follow-through records require actorRole.");
  }
  return status;
}

function validateFollowThroughActor(root, record, source) {
  const allowedActorRoles = normalizeStringArray(source?.allowedActorRoles ?? []);
  if (allowedActorRoles.length === 0) {
    return;
  }
  if (allowedActorRoles.includes(record.actorRole)) {
    return;
  }
  const evidencePaths = normalizeStringArray(record.policyOverrideEvidencePaths);
  const relevance = overrideEvidenceRelevantToItems(root, [{
    id: `${record.sourceType}:${record.sourceId}`,
    sourceId: record.sourceId,
    sourceArtifactPath: source?.sourceArtifactPath ?? record.sourceArtifactPath ?? null,
    linkedTargetArtifact: record.linkedTargetArtifact ?? null,
    linkedTargetId: record.linkedTargetId ?? null,
    closureArtifactPaths: normalizeStringArray(record.closureArtifactPaths)
  }], evidencePaths);
  const targetEvidencePresent = record.linkedTargetArtifact ? evidencePaths.includes(record.linkedTargetArtifact) : false;
  const sourceEvidencePresent = [source?.sourceArtifactPath, ...normalizeStringArray(record.closureArtifactPaths)].filter(Boolean).some((artifactPath) => evidencePaths.includes(artifactPath));
  if (record.policyOverrideReason && record.actorRole && relevance.ok && targetEvidencePresent && sourceEvidencePresent) {
    return;
  }
  throw new Error(`Actor role ${record.actorRole} is not allowed for ${record.sourceType}:${record.sourceId}. Allowed roles: ${allowedActorRoles.join(", ")}. Provide policyOverrideEvidencePaths that cover both the local source and target artifacts if this is intentional.`);
}

function targetArtifactContainsId(root, artifactPath, targetId) {
  const fullPath = resolvePath(root, artifactPath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  const extension = path.extname(artifactPath).toLowerCase();
  if ([".json"].includes(extension)) {
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
  const text = fs.readFileSync(fullPath, "utf8");
  return text.includes(String(targetId));
}

function followThroughTargetStillBound(root, item) {
  if (!["accepted-for-execution", "closed"].includes(item.status)) {
    return true;
  }
  if (!item.linkedTargetArtifact || !item.linkedTargetId) {
    return false;
  }
  return targetArtifactContainsId(root, item.linkedTargetArtifact, item.linkedTargetId);
}

function validateFollowThroughTargetBinding(root, record) {
  if (!["accepted-for-execution", "closed"].includes(record.status)) {
    return;
  }
  if (!record.linkedTargetArtifact || !record.linkedTargetId) {
    throw new Error(`${record.status} follow-through records require linkedTargetArtifact and linkedTargetId.`);
  }
  if (!targetArtifactContainsId(root, record.linkedTargetArtifact, record.linkedTargetId)) {
    throw new Error(`Follow-through target ${record.linkedTargetId} was not found in ${record.linkedTargetArtifact}.`);
  }
  if (record.status === "closed") {
    for (const artifactPath of normalizeStringArray(record.closureArtifactPaths)) {
      if (!fs.existsSync(resolvePath(root, artifactPath))) {
        throw new Error(`Closed follow-through artifact ${artifactPath} does not exist.`);
      }
    }
  }
}

function buildFollowThroughTransitions(existingIndex, nextRecord, previousRecord, timestamp = nowIso()) {
  const transitions = normalizeMetaOperatorFollowThroughTransitionsIndex(existingIndex).transitions;
  const transition = {
    id: `follow-through-transition-${slugify(`${nextRecord.id}-${timestamp}`)}`,
    followThroughId: nextRecord.id,
    sourceType: nextRecord.sourceType,
    sourceId: nextRecord.sourceId,
    fromStatus: previousRecord?.status ?? null,
    toStatus: nextRecord.status,
    actorRole: nextRecord.actorRole,
    decisionSummary: nextRecord.decisionSummary,
    rationale: nextRecord.rationale,
    recordedAt: timestamp,
    linkedTargetArtifact: nextRecord.linkedTargetArtifact,
    linkedTargetId: nextRecord.linkedTargetId,
    closureReason: nextRecord.closureReason ?? null,
    closureArtifactPaths: normalizeStringArray(nextRecord.closureArtifactPaths)
  };
  const nextTransitions = [...transitions, transition];
  return {
    ...createMetaOperatorFollowThroughTransitionsIndex(),
    transitions: nextTransitions,
    summary: {
      transitionCount: nextTransitions.length,
      overview: `${nextTransitions.length} operator follow-through transitions recorded.`,
      transitionsPath: ARTIFACT_PATHS.metaOperatorFollowThroughTransitions
    },
    updatedAt: timestamp
  };
}

function validateFollowThroughTransition(previousRecord, nextRecord) {
  const previous = previousRecord?.status ?? null;
  const next = nextRecord.status;
  const allowed = {
    null: ["acknowledged", "accepted-for-execution", "deferred", "accepted-risk", "closed", "superseded"],
    "acknowledged": ["accepted-for-execution", "deferred", "accepted-risk", "closed", "superseded", "acknowledged"],
    "accepted-for-execution": ["executing", "deferred", "accepted-risk", "superseded", "accepted-for-execution"],
    "executing": ["closed", "deferred", "accepted-risk", "superseded", "executing"],
    "deferred": ["acknowledged", "accepted-for-execution", "accepted-risk", "closed", "superseded", "deferred"],
    "accepted-risk": ["acknowledged", "closed", "superseded", "accepted-risk"],
    "closed": ["closed"],
    "superseded": ["superseded"]
  };
  const validNext = allowed[previous] ?? [];
  if (!validNext.includes(next)) {
    throw new Error(`Invalid follow-through transition: ${previous ?? "none"} -> ${next}`);
  }
}

function coverageLevelFromCount(count, { fullAt = 3, partialAt = 2, minimalAt = 1 } = {}) {
  if (count >= fullAt) {
    return "full";
  }
  if (count >= partialAt) {
    return "partial";
  }
  if (count >= minimalAt) {
    return "minimal";
  }
  return "none";
}

function readinessRank(value) {
  return value === "actionable" ? 0 : value === "partially-actionable" ? 1 : 2;
}

function buildGuidanceReadiness({ acceptanceCriteria = [], conversionHints = [], rankedConversionPaths = [], packetPointers = [], evidenceArtifactPaths = [], longHorizonMemory = [], repairItems = [], reviewConcerns = [], figureQa = [], remediationPackIds = [] } = {}) {
  const conversionCoverageLevel = coverageLevelFromCount(rankedConversionPaths.length, { fullAt: 3, partialAt: 2, minimalAt: 1 });
  const acceptanceCoverageLevel = coverageLevelFromCount(acceptanceCriteria.length, { fullAt: 3, partialAt: 2, minimalAt: 1 });
  const evidenceCoverageLevel = coverageLevelFromCount(evidenceArtifactPaths.length, { fullAt: 3, partialAt: 1, minimalAt: 1 });
  const packetCoverageLevel = coverageLevelFromCount(packetPointers.length, { fullAt: 2, partialAt: 1, minimalAt: 1 });
  const missingIngredients = uniqueSorted([
    rankedConversionPaths.length === 0 ? "ranked-conversion-paths" : null,
    acceptanceCriteria.length === 0 ? "acceptance-criteria" : null,
    evidenceArtifactPaths.length === 0 ? "evidence-artifacts" : null,
    packetPointers.length === 0 ? "packet-pointers" : null,
    longHorizonMemory.length === 0 ? "long-horizon-memory" : null,
    repairItems.length === 0 ? "repair-frontier-links" : null,
    conversionHints.length === 0 ? "conversion-hints" : null
  ]);
  const operatorReadiness = rankedConversionPaths.length >= 2 && acceptanceCriteria.length >= 2 && evidenceArtifactPaths.length >= 1
    ? "actionable"
    : rankedConversionPaths.length >= 1 && acceptanceCriteria.length >= 1
      ? "partially-actionable"
      : "advisory-only";
  const overview = operatorReadiness === "actionable"
    ? `Actionable guidance with ${rankedConversionPaths.length} ranked conversion paths and ${acceptanceCriteria.length} acceptance criteria.`
    : operatorReadiness === "partially-actionable"
      ? `Partially actionable guidance: ${rankedConversionPaths.length} ranked conversion paths, ${acceptanceCriteria.length} acceptance criteria, missing ${missingIngredients.join(", ") || "none"}.`
      : `Advisory-only guidance: missing ${missingIngredients.join(", ") || "ranked execution context"}.`;
  return {
    operatorReadiness,
    conversionCoverageLevel,
    acceptanceCoverageLevel,
    evidenceCoverageLevel,
    packetCoverageLevel,
    missingIngredients,
    linkedSignalCounts: {
      remediationPackCount: remediationPackIds.length,
      repairItemCount: repairItems.length,
      reviewConcernCount: reviewConcerns.length,
      figureIssueCount: figureQa.length,
      longHorizonCount: longHorizonMemory.length,
      rankedConversionPathCount: rankedConversionPaths.length,
      acceptanceCriteriaCount: acceptanceCriteria.length,
      evidenceArtifactCount: evidenceArtifactPaths.length,
      packetPointerCount: packetPointers.length
    },
    overview
  };
}

function isArtifactPathLike(value) {
  return typeof value === "string"
    && (value.startsWith(".paper/")
      || value.startsWith("docs/")
      || value.startsWith("README")
      || /\.(json|md|svg|txt|mjs|yml|yaml|tex)$/i.test(value));
}

function buildPlaybookArtifactUpdateMap({ familyId, familyLabel, matchedPacks = [], repairItems = [], packetPointers = [], workspacePointers = [], taxonomyAnchors = {} }) {
  const targetMap = new Map();
  const pushTarget = (artifactPath, details = {}) => {
    if (!isArtifactPathLike(artifactPath)) {
      return;
    }
    const existing = targetMap.get(artifactPath) ?? {
      artifactPath,
      sourceKinds: [],
      updateReasons: [],
      relatedRepairItemIds: [],
      relatedConversionTargetIds: [],
      relatedPacketIds: [],
      taxonomyFamilyIds: [],
      taxonomyGroupIds: [],
      priorityScore: 0
    };
    existing.sourceKinds.push(details.sourceKind ?? "workspace");
    existing.updateReasons.push(details.reason ?? `Review ${artifactPath} for ${familyLabel ?? familyId} pressure.`);
    existing.relatedRepairItemIds.push(...(details.relatedRepairItemIds ?? []));
    existing.relatedConversionTargetIds.push(...(details.relatedConversionTargetIds ?? []));
    existing.relatedPacketIds.push(...(details.relatedPacketIds ?? []));
    existing.taxonomyFamilyIds.push(...(details.taxonomyFamilyIds ?? []));
    existing.taxonomyGroupIds.push(...(details.taxonomyGroupIds ?? []));
    existing.priorityScore = Math.max(existing.priorityScore, details.priorityScore ?? 0);
    targetMap.set(artifactPath, existing);
  };

  for (const repairItem of repairItems) {
    pushTarget(repairItem.artifactPath, {
      sourceKind: "repair-frontier",
      reason: repairItem.nextAction ?? repairItem.summary ?? `Repair ${repairItem.id}.`,
      relatedRepairItemIds: [repairItem.id],
      taxonomyFamilyIds: uniqueSorted([repairItem.taxonomyFamilyId, ...(repairItem.taxonomyFamilyIds ?? []), familyId].filter(Boolean)),
      taxonomyGroupIds: uniqueSorted([repairItem.taxonomyGroupId, ...(repairItem.taxonomyGroupIds ?? [])].filter(Boolean)),
      priorityScore: 120
    });
    for (const relatedPath of repairItem.relatedArtifactPaths ?? []) {
      pushTarget(relatedPath, {
        sourceKind: "repair-related-artifact",
        reason: `Update alongside repair item ${repairItem.id} so related artifacts stay aligned.`,
        relatedRepairItemIds: [repairItem.id],
        taxonomyFamilyIds: [familyId].filter(Boolean),
        priorityScore: 108
      });
    }
  }

  for (const pack of matchedPacks) {
    for (const artifactPath of pack.evidence?.artifactPaths ?? []) {
      pushTarget(artifactPath, {
        sourceKind: "linked-evidence",
        reason: `Evidence linked to remediation pack ${pack.id} should stay aligned with ${familyLabel ?? familyId} updates.`,
        relatedConversionTargetIds: (pack.rankedConversionPaths ?? []).map((item) => item.targetId),
        taxonomyFamilyIds: uniqueSorted([familyId, ...(pack.taxonomyAnchors?.familyIds ?? [])].filter(Boolean)),
        taxonomyGroupIds: uniqueSorted(pack.taxonomyAnchors?.groupIds ?? []),
        priorityScore: 96
      });
    }
    for (const path of pack.workspacePointers ?? []) {
      pushTarget(path, {
        sourceKind: "workspace-pointer",
        reason: `Workspace pointer from remediation pack ${pack.id} provides update context for ${familyLabel ?? familyId}.`,
        taxonomyFamilyIds: [familyId].filter(Boolean),
        priorityScore: 60
      });
    }
    for (const conversion of pack.rankedConversionPaths ?? []) {
      pushTarget(conversion.targetId, {
        sourceKind: "conversion-target",
        reason: conversion.rationale ?? `Conversion target ${conversion.targetId} is a ranked candidate update surface.`,
        relatedConversionTargetIds: [conversion.targetId],
        taxonomyFamilyIds: [familyId].filter(Boolean),
        priorityScore: 100 - (conversion.rank ?? 0)
      });
    }
  }

  for (const packet of packetPointers) {
    pushTarget(packet.packetContextPath, {
      sourceKind: "packet-context",
      reason: packet.nextAction ?? `Inspect packet ${packet.id} before mutating durable artifacts.`,
      relatedPacketIds: [packet.id],
      taxonomyFamilyIds: [familyId].filter(Boolean),
      priorityScore: 92
    });
  }

  pushTarget(ARTIFACT_PATHS.metaOperatorPlaybooks, {
    sourceKind: "playbook-artifact",
    reason: `Update the durable family playbook layer after reviewing ${familyLabel ?? familyId} targets.`,
    taxonomyFamilyIds: [familyId].filter(Boolean),
    taxonomyGroupIds: uniqueSorted(taxonomyAnchors.groupIds ?? []),
    priorityScore: 58
  });

  const targets = Array.from(targetMap.values())
    .map((target) => ({
      ...target,
      sourceKinds: uniqueSorted(target.sourceKinds),
      updateReasons: uniqueSorted(target.updateReasons),
      relatedRepairItemIds: uniqueSorted(target.relatedRepairItemIds),
      relatedConversionTargetIds: uniqueSorted(target.relatedConversionTargetIds),
      relatedPacketIds: uniqueSorted(target.relatedPacketIds),
      taxonomyFamilyIds: uniqueSorted(target.taxonomyFamilyIds),
      taxonomyGroupIds: uniqueSorted(target.taxonomyGroupIds)
    }))
    .sort((left, right) => {
      const priorityDelta = (right.priorityScore ?? 0) - (left.priorityScore ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return left.artifactPath.localeCompare(right.artifactPath);
    })
    .map((target, index) => ({
      ...target,
      rank: index + 1
    }));

  return {
    overview: targets.length > 0
      ? `${targets.length} proposal-only artifact targets are ranked for ${familyLabel ?? familyId}; start with the highest-ranked repair and conversion-linked files before broader workspace pointers.`
      : `No explicit artifact targets were derived for ${familyLabel ?? familyId}; rely on the playbook summary and remediation pack pointers instead.`,
    targetCount: targets.length,
    targetList: targets.map((target) => target.artifactPath),
    updateOrder: targets.map((target) => target.artifactPath),
    targets
  };
}

function buildRemediationAcceptanceCriteria({ repairItems, reviewConcerns, figureQa, packetPointers, longHorizonMemory }) {
  const criteria = [];
  if (repairItems.length > 0) {
    criteria.push(`Clear or explicitly accept all ${repairItems.length} linked repair-frontier item(s) before treating this pack as complete.`);
  }
  if (reviewConcerns.length > 0) {
    criteria.push(`Resolve or explicitly retire linked review concerns (${reviewConcerns.map((item) => item.id).join(", ")}) with reviewer-visible artifact updates.`);
  }
  if (figureQa.length > 0) {
    criteria.push(`Clear linked figure QA issues (${figureQa.map((item) => item.id).join(", ")}) and rerun validate_figure_pipeline before closure.`);
  }
  if (packetPointers.length > 0) {
    criteria.push(`Advance linked packets (${packetPointers.map((item) => item.id).join(", ")}) out of stale/review-needed/handoff states, or record an explicit defer decision.`);
  }
  if (longHorizonMemory.length > 0) {
    criteria.push(`Confirm long-horizon memory pressure has stopped rising or is explicitly accepted as ongoing debt.`);
  }
  if (criteria.length === 0) {
    criteria.push("Confirm there is no remaining operator-visible debt before considering this remediation pack complete.");
  }
  return uniqueSorted(criteria);
}

function buildRemediationConversionHints({ cluster, packetPointers, repairItems, reviewConcerns, figureQa, manualNextActions, taxonomyAnchors }) {
  const responseOwnerRole = cluster.responseOwnerRoles?.[0] ?? cluster.recommendationOwnerRoles?.[0] ?? "planner";
  const candidates = [];
  if (packetPointers.length > 0) {
    const packet = packetPointers[0];
    candidates.push({
      targetType: "update-existing-packet",
      targetId: packet.id,
      assignedRole: packet.assignedRole,
      priority: "primary",
      pathScore: 120 + Math.min(packetPointers.length, 3) * 5,
      rankingBasis: ["packet-pointer", `packet=${packet.id}`, `role=${packet.assignedRole}`],
      suggestedTitle: `Update packet ${packet.id} for ${cluster.label}`,
      rationale: `This pack already maps to packet ${packet.id}, so updating the existing packet is the cleanest manual execution path.`,
      nextStep: packet.nextAction ?? manualNextActions[0] ?? `Inspect ${packet.packetContextPath ?? packet.id} and update it using this remediation pack.`
    });
  } else {
    candidates.push({
      targetType: "create-new-packet",
      targetId: `task-${cluster.id}`,
      assignedRole: responseOwnerRole,
      priority: "primary",
      pathScore: 88 + Math.min((taxonomyAnchors.familyIds ?? []).length, 3) * 4,
      rankingBasis: ["new-packet", `cluster=${cluster.id}`, `role=${responseOwnerRole}`],
      suggestedTitle: `${cluster.label} remediation work`,
      rationale: `No active packet currently owns this pack, so a new explicit packet is the cleanest manual execution path.`,
      nextStep: manualNextActions[0] ?? `Create a new packet for ${cluster.label} and attach the linked repair items and evidence.`
    });
  }
  if (repairItems.length > 0) {
    candidates.push({
      targetType: "add-checklist-entry",
      targetId: ARTIFACT_PATHS.checklist,
      assignedRole: responseOwnerRole,
      priority: packetPointers.length > 0 ? "secondary" : "fallback",
      pathScore: 72 + Math.min(repairItems.length, 4) * 4,
      rankingBasis: ["repair-frontier", `repairItems=${repairItems.length}`],
      suggestedTitle: `${cluster.label} repair checklist item`,
      rationale: `Checklist entries keep closure criteria visible for packs with explicit repair-frontier debt.`,
      nextStep: `Add a checklist item referencing ${repairItems[0].id} and taxonomy pressure (${taxonomyAnchors.familyLabels.join(", ") || "none"}).`
    });
  }
  if (reviewConcerns.length > 0 || figureQa.length > 0) {
    candidates.push({
      targetType: "add-revision-item",
      targetId: ARTIFACT_PATHS.revisionPlan,
      assignedRole: responseOwnerRole,
      priority: reviewConcerns.length > 0 ? "secondary" : "fallback",
      pathScore: 76 + Math.min(reviewConcerns.length + figureQa.length, 4) * 4,
      rankingBasis: [
        ...(reviewConcerns.length > 0 ? [`reviewConcerns=${reviewConcerns.length}`] : []),
        ...(figureQa.length > 0 ? [`figureQa=${figureQa.length}`] : [])
      ],
      suggestedTitle: `${cluster.label} remediation follow-up`,
      rationale: `Review concerns or figure QA issues in this pack should remain durable in the revision plan until they close.`,
      nextStep: `Append a revision-plan item for ${reviewConcerns[0]?.id ?? figureQa[0]?.id ?? cluster.id} with the linked manual next action.`
    });
  }
  const rankedPaths = buildRankedConversionCandidates(candidates);
  return {
    rankedPaths,
    hints: rankedPaths.map(({ rank, priority, pathScore, rankingBasis, deterministicKey, originalIndex, ...hint }) => ({
      ...hint,
      rank,
      priority,
      pathScore,
      rankingBasis,
      deterministicKey
    }))
  };
}

function buildRemediationPacks({ clusters, recommendations, longHorizonMemory, reviewConcerns, figureQa, workspaceIndex }) {
  const generatedAt = nowIso();
  const packs = clusters.map((cluster) => {
    const clusterRecommendations = recommendations.filter((item) => item.clusterId === cluster.id);
    const recommendationIds = clusterRecommendations.map((item) => item.id);
    const evidenceArtifactPaths = uniqueSorted(clusterRecommendations.flatMap((item) => item.evidenceArtifactPaths ?? []));
    const evidenceIds = uniqueSorted(clusterRecommendations.flatMap((item) => item.evidenceIds ?? []));
    const taxonomyAnchors = {
      familyIds: uniqueSorted(cluster.taxonomyPressure?.familyIds ?? []),
      familyLabels: uniqueSorted(cluster.taxonomyPressure?.familyLabels ?? []),
      groupIds: uniqueSorted(cluster.taxonomyPressure?.groupIds ?? []),
      groupLabels: uniqueSorted(cluster.taxonomyPressure?.groupLabels ?? []),
      overview: cluster.taxonomyPressure?.overview ?? "No typed wiki taxonomy pressure is active in this remediation pack."
    };
    const repairItems = (workspaceIndex.repairFrontier?.prioritizedItems ?? []).filter((item) => {
      const repairFamilyIds = uniqueSorted([item.taxonomyFamilyId, ...(item.taxonomyFamilyIds ?? [])].filter(Boolean));
      const repairGroupIds = uniqueSorted([item.taxonomyGroupId, ...(item.taxonomyGroupIds ?? [])].filter(Boolean));
      return intersects(repairFamilyIds, taxonomyAnchors.familyIds)
        || intersects(repairGroupIds, taxonomyAnchors.groupIds)
        || intersects(uniqueSorted([item.artifactPath, ...(item.relatedArtifactPaths ?? [])]), evidenceArtifactPaths);
    });
    const packReviewConcerns = (reviewConcerns.items ?? []).filter((concern) => {
      const concernEvidenceIds = uniqueSorted([concern.id, ...(concern.linkedAuditIds ?? []), ...(concern.linkedBridgeIds ?? [])]);
      return concernEvidenceIds.some((id) => evidenceIds.includes(id))
        || intersects(concern.linkedArtifactPaths ?? [], evidenceArtifactPaths);
    }).map(summarizeConcernForPack);
    const packFigureIssues = (figureQa.issues ?? []).filter((issue) => {
      const issueIds = uniqueSorted([issue.id, issue.figureId].filter(Boolean));
      return issueIds.some((id) => evidenceIds.includes(id))
        || intersects(issue.artifactPaths ?? [], evidenceArtifactPaths)
        || clusterRecommendations.some((item) => (item.signalTypes ?? []).includes("figure-qa") || (item.signalTypes ?? []).includes("figure-qa"));
    }).map(summarizeFigureIssueForPack);
    const memoryFamilies = (longHorizonMemory.families ?? []).filter((family) => intersects(family.topClusterIds ?? [], [cluster.id]) || intersects(family.topRecommendationIds ?? [], recommendationIds))
      .slice(0, 4)
      .map((family) => ({
        id: family.id,
        label: family.label,
        summary: family.summary,
        trend: family.trend?.status ?? "stable",
        relatedTaxonomyFamilyIds: uniqueSorted(family.relatedTaxonomyFamilyIds ?? []),
        relatedTaxonomyGroupIds: uniqueSorted(family.relatedTaxonomyGroupIds ?? []),
        evidenceArtifactPaths: uniqueSorted(family.evidenceArtifactPaths ?? [])
      }));
    const packetPointers = (workspaceIndex.activePackets ?? [])
      .filter((packet) => (cluster.responseOwnerRoles ?? []).includes(packet.assignedRole) || intersects(packet.evidenceLinks ?? [], evidenceArtifactPaths))
      .slice(0, 4)
      .map((packet) => ({
        id: packet.id,
        title: packet.title,
        currentFocus: packet.currentFocus,
        assignedRole: packet.assignedRole,
        lifecycleStatus: packet.lifecycleStatus,
        nextAction: packet.nextAction,
        packetContextPath: packet.packetContextPath ?? null
      }));
    const workspacePointers = uniqueSorted([
      ARTIFACT_PATHS.workspaceIndex,
      ARTIFACT_PATHS.navigationReport,
      ARTIFACT_PATHS.sessionSummary,
      ARTIFACT_PATHS.metaOptimizerReport,
      ARTIFACT_PATHS.metaRecommendations,
      ARTIFACT_PATHS.metaLongHorizonMemory,
      ARTIFACT_PATHS.metaRemediationPacks,
      workspaceIndex.contextSurfaces?.currentActionContextPath,
      workspaceIndex.contextSurfaces?.currentRoleContextPath,
      workspaceIndex.contextSurfaces?.currentPhaseContextPath,
      ...packetPointers.map((packet) => packet.packetContextPath),
      ...evidenceArtifactPaths
    ]);
    const manualNextActions = uniqueSorted([
      `Read ${ARTIFACT_PATHS.metaOptimizerReport} and inspect cluster ${cluster.id} before changing any workflow artifact.`,
      ...repairItems.slice(0, 2).map((item) => item.nextAction),
      ...clusterRecommendations.slice(0, 2).map((item) => item.nextAction),
      packReviewConcerns[0] ? `Review concern ${packReviewConcerns[0].id} and update its linked artifacts explicitly.` : null,
      packFigureIssues[0] ? `Inspect figure QA issue ${packFigureIssues[0].id} before treating the frontier as closed.` : null,
      packetPointers[0]?.nextAction ?? null
    ]);
    const acceptanceCriteria = buildRemediationAcceptanceCriteria({
      repairItems,
      reviewConcerns: packReviewConcerns,
      figureQa: packFigureIssues,
      packetPointers,
      longHorizonMemory: memoryFamilies
    });
    const conversionGuidance = buildRemediationConversionHints({
      cluster,
      packetPointers,
      repairItems,
      reviewConcerns: packReviewConcerns,
      figureQa: packFigureIssues,
      manualNextActions,
      taxonomyAnchors
    });
    const readiness = buildGuidanceReadiness({
      acceptanceCriteria,
      conversionHints: conversionGuidance.hints,
      rankedConversionPaths: conversionGuidance.rankedPaths,
      packetPointers,
      evidenceArtifactPaths,
      longHorizonMemory: memoryFamilies,
      repairItems,
      reviewConcerns: packReviewConcerns,
      figureQa: packFigureIssues
    });
    return {
      id: `remediation-pack-${cluster.id}`,
      title: `${cluster.label} remediation pack`,
      proposalOnly: true,
      explicitOnly: true,
      noAutoApply: true,
      rank: cluster.rank,
      clusterId: cluster.id,
      clusterLabel: cluster.label,
      priority: cluster.priority,
      score: cluster.score,
      summary: `${cluster.summary} This pack keeps the cluster's repair frontier, evidence links, taxonomy anchors, and manual next steps together for operator review.`,
      frontier: {
        clusterId: cluster.id,
        recommendationIds,
        repairItemIds: repairItems.map((item) => item.id),
        repairCount: repairItems.length,
        frontierSummary: workspaceIndex.metaOptimize?.frontierSummary ?? "No proposal-only optimizer recommendations have been generated yet."
      },
      taxonomyAnchors,
      evidence: {
        artifactPaths: evidenceArtifactPaths,
        ids: evidenceIds,
        longHorizonFamilyIds: memoryFamilies.map((family) => family.id),
        reviewConcernIds: packReviewConcerns.map((concern) => concern.id),
        figureIssueIds: packFigureIssues.map((issue) => issue.id)
      },
      reviewConcerns: packReviewConcerns,
      figureQa: packFigureIssues,
      longHorizonMemory: memoryFamilies,
      packetPointers,
      workspacePointers,
      readiness,
      acceptanceCriteria,
      conversionHints: conversionGuidance.hints,
      rankedConversionPaths: conversionGuidance.rankedPaths,
      manualNextActions,
      generatedAt
    };
  });
  const summary = {
    packCount: packs.length,
    topPackIds: packs.slice(0, 3).map((pack) => pack.id),
    topClusterIds: packs.slice(0, 3).map((pack) => pack.clusterId),
    actionableCount: packs.filter((pack) => pack.readiness?.operatorReadiness === "actionable").length,
    partiallyActionableCount: packs.filter((pack) => pack.readiness?.operatorReadiness === "partially-actionable").length,
    advisoryCount: packs.filter((pack) => pack.readiness?.operatorReadiness === "advisory-only").length,
    readinessOverview: packs.length > 0
      ? `${packs.filter((pack) => pack.readiness?.operatorReadiness === "actionable").length} actionable, ${packs.filter((pack) => pack.readiness?.operatorReadiness === "partially-actionable").length} partially actionable, ${packs.filter((pack) => pack.readiness?.operatorReadiness === "advisory-only").length} advisory-only remediation packs.`
      : "No proposal-only remediation packs have been generated yet.",
    overview: packs.length > 0
      ? `${packs.length} proposal-only remediation packs summarize the current repair frontier and optimizer clusters into grouped, evidence-backed operator bundles.`
      : "No proposal-only remediation packs have been generated yet.",
    packsPath: ARTIFACT_PATHS.metaRemediationPacks
  };
  return {
    ...createMetaRemediationPacksIndex(),
    packs,
    summary,
    updatedAt: generatedAt
  };
}

function buildFamilyOperatorPlaybooks({ workspaceIndex, remediationPacks, longHorizonMemory }) {
  const generatedAt = nowIso();
  const familySummaryMap = new Map((workspaceIndex.repairFrontier?.relationFamilySummaries ?? []).map((family) => [family.id, family]));
  const groupSummaryMap = new Map((workspaceIndex.repairFrontier?.relationGroupSummaries ?? []).map((group) => [group.id, group]));
  const remediationPackMap = new Map((remediationPacks.packs ?? []).map((pack) => [pack.id, pack]));
  const longHorizonByTaxonomyFamily = new Map();
  for (const family of longHorizonMemory.families ?? []) {
    for (const taxonomyFamilyId of family.relatedTaxonomyFamilyIds ?? []) {
      const bucket = longHorizonByTaxonomyFamily.get(taxonomyFamilyId) ?? [];
      bucket.push(family);
      longHorizonByTaxonomyFamily.set(taxonomyFamilyId, bucket);
    }
  }

  const candidateFamilyIds = uniqueSorted([
    ...(workspaceIndex.repairFrontier?.topDegradedFamilyIds ?? []),
    ...(workspaceIndex.metaOptimize?.topTaxonomyFamilyIds ?? []),
    ...(workspaceIndex.metaOptimize?.longHorizon?.topTaxonomyFamilyIds ?? []),
    ...(remediationPacks.packs ?? []).flatMap((pack) => pack.taxonomyAnchors?.familyIds ?? []),
    ...(longHorizonMemory.families ?? []).flatMap((family) => family.relatedTaxonomyFamilyIds ?? [])
  ]);

  const playbooks = candidateFamilyIds.map((familyId) => {
    const familySummary = familySummaryMap.get(familyId) ?? { id: familyId, label: familyId, overview: `${familyId} typed wiki pressure is active.`, topReasonCodes: [] };
    const matchedPacks = (remediationPacks.packs ?? []).filter((pack) => (pack.taxonomyAnchors?.familyIds ?? []).includes(familyId));
    const matchedMemoryFamilies = longHorizonByTaxonomyFamily.get(familyId) ?? [];
    const matchedRepairItems = (workspaceIndex.repairFrontier?.prioritizedItems ?? []).filter((item) => {
      const familyIds = uniqueSorted([item.taxonomyFamilyId, ...(item.taxonomyFamilyIds ?? [])].filter(Boolean));
      const groupIds = uniqueSorted([item.taxonomyGroupId, ...(item.taxonomyGroupIds ?? [])].filter(Boolean));
      return familyIds.includes(familyId)
        || intersects(groupIds, [...(familySummary.groupIds ?? []), ...matchedPacks.flatMap((pack) => pack.taxonomyAnchors?.groupIds ?? [])]);
    });
    const groupIds = uniqueSorted([
      ...(familySummary.groupIds ?? []),
      ...matchedPacks.flatMap((pack) => pack.taxonomyAnchors?.groupIds ?? []),
      ...matchedMemoryFamilies.flatMap((family) => family.relatedTaxonomyGroupIds ?? [])
    ]);
    const groupLabels = groupIds.map((groupId) => groupSummaryMap.get(groupId)?.label ?? groupId);
    const acceptanceCriteria = uniqueSorted(matchedPacks.flatMap((pack) => pack.acceptanceCriteria ?? [])).slice(0, 6);
    const conversionHints = matchedPacks.flatMap((pack) => pack.conversionHints ?? []).reduce((accumulator, hint) => {
      const key = `${hint.targetType}:${hint.targetId}`;
      if (!accumulator.some((item) => `${item.targetType}:${item.targetId}` === key)) {
        accumulator.push(hint);
      }
      return accumulator;
    }, []).slice(0, 6);
    const rankedConversionPaths = buildRankedConversionCandidates(
      matchedPacks.flatMap((pack) => pack.rankedConversionPaths ?? pack.conversionHints ?? []).map((hint) => ({
        ...hint,
        pathScore: (hint.pathScore ?? 0) + 8,
        rankingBasis: [...(hint.rankingBasis ?? []), `playbookFamily=${familyId}`]
      }))
    ).slice(0, 6);
    const manualNextActions = uniqueSorted([
      ...matchedPacks.flatMap((pack) => pack.manualNextActions ?? []),
      ...matchedPacks.flatMap((pack) => (pack.packetPointers ?? []).map((pointer) => pointer.nextAction)),
      ...matchedMemoryFamilies.map((family) => `Inspect long-horizon family ${family.id} (${family.trend?.status ?? "stable"}) before declaring ${familySummary.label} pressure resolved.`)
    ]).slice(0, 6);
    const responseOwnerRoles = uniqueSorted([
      ...matchedPacks.flatMap((pack) => (pack.packetPointers ?? []).map((pointer) => pointer.assignedRole)),
      ...matchedPacks.flatMap((pack) => (pack.conversionHints ?? []).map((hint) => hint.assignedRole))
    ]);
    const workspacePointers = uniqueSorted([
      ARTIFACT_PATHS.workspaceIndex,
      ARTIFACT_PATHS.navigationReport,
      ARTIFACT_PATHS.sessionSummary,
      ARTIFACT_PATHS.metaOptimizerReport,
      ARTIFACT_PATHS.metaOperatorPlaybooks,
      ARTIFACT_PATHS.metaRemediationPacks,
      ...matchedPacks.flatMap((pack) => pack.workspacePointers ?? []),
      ...matchedPacks.flatMap((pack) => pack.evidence?.artifactPaths ?? []),
      ...matchedMemoryFamilies.flatMap((family) => family.evidenceArtifactPaths ?? [])
    ]);
    const packetPointers = matchedPacks.flatMap((pack) => pack.packetPointers ?? []).slice(0, 6);
    const artifactUpdateMap = buildPlaybookArtifactUpdateMap({
      familyId,
      familyLabel: familySummary.label,
      matchedPacks,
      repairItems: matchedRepairItems,
      packetPointers,
      workspacePointers,
      taxonomyAnchors: {
        familyIds: [familyId],
        groupIds,
        groupLabels
      }
    });
    const operatorGoal = taxonomyPressureMetadata(familyId, familySummary.label).clusterOperatorGoal;
    const longHorizonSummary = matchedMemoryFamilies.length > 0
      ? `${matchedMemoryFamilies.length} linked long-horizon family entries remain active (${matchedMemoryFamilies.map((family) => `${family.id}:${family.trend?.status ?? "stable"}`).join(", ")}).`
      : "No linked long-horizon family memory is currently active for this taxonomy family.";
    const readiness = buildGuidanceReadiness({
      acceptanceCriteria,
      conversionHints,
      rankedConversionPaths,
      packetPointers,
      evidenceArtifactPaths: uniqueSorted([
        ...matchedPacks.flatMap((pack) => pack.evidence?.artifactPaths ?? []),
        ...matchedMemoryFamilies.flatMap((family) => family.evidenceArtifactPaths ?? [])
      ]),
      longHorizonMemory: matchedMemoryFamilies,
      repairItems: matchedPacks.flatMap((pack) => (pack.frontier?.repairItemIds ?? []).map((id) => ({ id }))),
      reviewConcerns: matchedPacks.flatMap((pack) => pack.reviewConcerns ?? []),
      figureQa: matchedPacks.flatMap((pack) => pack.figureQa ?? []),
      remediationPackIds: matchedPacks.map((pack) => pack.id)
    });
    return {
      id: `family-playbook-${familyId}`,
      title: `${familySummary.label} operator playbook`,
      proposalOnly: true,
      explicitOnly: true,
      noAutoApply: true,
      taxonomyFamilyId: familyId,
      taxonomyFamilyLabel: familySummary.label,
      taxonomyOverview: familySummary.overview ?? `${familySummary.label} typed wiki pressure is active.`,
      taxonomyGroupIds: groupIds,
      taxonomyGroupLabels: groupLabels,
      readiness,
      artifactUpdateMap,
      operatorGoal,
      summary: `${familySummary.overview ?? `${familySummary.label} typed wiki pressure is active.`} This playbook aggregates the current remediation packs, acceptance criteria, conversion hints, and long-horizon memory for the ${familySummary.label} family without auto-applying any change.`,
      longHorizonSummary,
      topReasonCodes: uniqueSorted([
        ...(familySummary.topReasonCodes ?? []),
        ...matchedPacks.flatMap((pack) => pack.frontier?.repairItemIds ?? []).slice(0, 3)
      ]).slice(0, 6),
      remediationPackIds: matchedPacks.map((pack) => pack.id),
      clusterIds: uniqueSorted(matchedPacks.map((pack) => pack.clusterId)),
      responseOwnerRoles,
      acceptanceCriteria,
      conversionHints,
      rankedConversionPaths,
      manualNextActions,
      longHorizonFamilyIds: matchedMemoryFamilies.map((family) => family.id),
      workspacePointers,
      packetPointers,
      generatedAt
    };
  }).sort((left, right) => {
    const readinessDelta = readinessRank(left.readiness?.operatorReadiness) - readinessRank(right.readiness?.operatorReadiness);
    if (readinessDelta !== 0) {
      return readinessDelta;
    }
    const packDelta = (right.remediationPackIds?.length ?? 0) - (left.remediationPackIds?.length ?? 0);
    if (packDelta !== 0) {
      return packDelta;
    }
    const longHorizonDelta = (right.longHorizonFamilyIds?.length ?? 0) - (left.longHorizonFamilyIds?.length ?? 0);
    if (longHorizonDelta !== 0) {
      return longHorizonDelta;
    }
    return left.taxonomyFamilyId.localeCompare(right.taxonomyFamilyId);
  });

  return {
    ...createMetaOperatorPlaybooksIndex(),
    playbooks,
    summary: {
      playbookCount: playbooks.length,
      topPlaybookIds: playbooks.slice(0, 3).map((playbook) => playbook.id),
      topTaxonomyFamilyIds: playbooks.slice(0, 3).map((playbook) => playbook.taxonomyFamilyId),
      actionableCount: playbooks.filter((playbook) => playbook.readiness?.operatorReadiness === "actionable").length,
      partiallyActionableCount: playbooks.filter((playbook) => playbook.readiness?.operatorReadiness === "partially-actionable").length,
      advisoryCount: playbooks.filter((playbook) => playbook.readiness?.operatorReadiness === "advisory-only").length,
      readinessOverview: playbooks.length > 0
        ? `${playbooks.filter((playbook) => playbook.readiness?.operatorReadiness === "actionable").length} actionable, ${playbooks.filter((playbook) => playbook.readiness?.operatorReadiness === "partially-actionable").length} partially actionable, ${playbooks.filter((playbook) => playbook.readiness?.operatorReadiness === "advisory-only").length} advisory-only family playbooks.`
        : "No proposal-only family-level operator playbooks have been generated yet.",
      overview: playbooks.length > 0
        ? `${playbooks.length} proposal-only family-level operator playbooks summarize taxonomy families using remediation packs, acceptance criteria, conversion hints, and long-horizon memory.`
        : "No proposal-only family-level operator playbooks have been generated yet.",
      playbooksPath: ARTIFACT_PATHS.metaOperatorPlaybooks
    },
    updatedAt: generatedAt
  };
}

function scaffoldCandidateType(targetType, pack = {}) {
  if (targetType === "update-existing-packet" || targetType === "create-new-packet") {
    return "packet-candidate";
  }
  if (targetType === "add-checklist-entry") {
    return "checklist-candidate";
  }
  if (targetType === "add-revision-item") {
    return (pack.reviewConcerns?.length ?? 0) > 0 ? "review-follow-up-candidate" : "revision-plan-candidate";
  }
  return "revision-plan-candidate";
}

function scaffoldTargetArtifact(targetType, targetId, pack = {}, path = {}) {
  if (targetType === "update-existing-packet") {
    const pointer = (pack.packetPointers ?? []).find((item) => item.id === targetId);
    return pointer?.packetContextPath ?? ARTIFACT_PATHS.taskPacketsIndex;
  }
  if (targetType === "create-new-packet") {
    return ARTIFACT_PATHS.taskPacketsIndex;
  }
  if (targetType === "add-checklist-entry") {
    return targetId ?? ARTIFACT_PATHS.checklist;
  }
  if (targetType === "add-revision-item") {
    return targetId ?? ARTIFACT_PATHS.revisionPlan;
  }
  return targetId ?? path.targetId ?? ARTIFACT_PATHS.workspaceIndex;
}

function summarizeCandidateContext(pack = {}, operatorPlaybooks = {}, sourcePlaybookIds = [], path = null) {
  const playbooksById = new Map((operatorPlaybooks.playbooks ?? []).map((playbook) => [playbook.id, playbook]));
  const linkedPacketPointers = (pack.packetPointers ?? []).slice(0, 3).map((pointer) => ({
    id: pointer.id,
    assignedRole: pointer.assignedRole,
    lifecycleStatus: pointer.lifecycleStatus,
    packetContextPath: pointer.packetContextPath ?? null,
    nextAction: pointer.nextAction ?? null
  }));
  const linkedWorkspacePointers = uniqueSorted(pack.workspacePointers ?? []).slice(0, 6);
  const linkedRemediationPacks = [{
    id: pack.id,
    title: pack.title,
    clusterId: pack.clusterId,
    readiness: pack.readiness?.operatorReadiness ?? "advisory-only"
  }];
  const linkedPlaybooks = sourcePlaybookIds.slice(0, 3).map((playbookId) => {
    const playbook = playbooksById.get(playbookId) ?? {};
    return {
      id: playbookId,
      taxonomyFamilyId: playbook.taxonomyFamilyId ?? null,
      title: playbook.title ?? null,
      readiness: playbook.readiness?.operatorReadiness ?? null
    };
  });
  const evidenceSummary = {
    artifactPaths: uniqueSorted(pack.evidence?.artifactPaths ?? []).slice(0, 5),
    ids: uniqueSorted(pack.evidence?.ids ?? []).slice(0, 5)
  };
  const repairSummary = {
    repairItemIds: uniqueSorted(pack.frontier?.repairItemIds ?? []).slice(0, 5),
    reviewConcernIds: uniqueSorted((pack.reviewConcerns ?? []).map((item) => item.id)).slice(0, 4),
    figureIssueIds: uniqueSorted((pack.figureQa ?? []).map((item) => item.id)).slice(0, 4)
  };
  return {
    linkedPacketPointers,
    linkedWorkspacePointers,
    linkedRemediationPacks,
    linkedPlaybooks,
    evidenceSummary,
    repairSummary,
    bridgeNotes: uniqueSorted([
      path?.rationale ?? null,
      pack.manualNextActions?.[0] ?? null,
      pack.readiness?.overview ?? null
    ]).slice(0, 3)
  };
}

function buildExecutionBridgeCandidates({ remediationPacks, operatorPlaybooks }) {
  const generatedAt = nowIso();
  const playbooksById = new Map((operatorPlaybooks.playbooks ?? []).map((playbook) => [playbook.id, playbook]));
  const playbookIdsByFamily = new Map((operatorPlaybooks.playbooks ?? []).map((playbook) => [playbook.taxonomyFamilyId, playbook.id]));
  const candidates = [];

  for (const pack of remediationPacks.packs ?? []) {
    const sourcePlaybookIds = uniqueSorted((pack.taxonomyAnchors?.familyIds ?? []).map((familyId) => playbookIdsByFamily.get(familyId)).filter(Boolean));
    const commonFields = {
      proposalOnly: true,
      noAutoApply: true,
      sourceRemediationPackIds: [pack.id],
      sourcePlaybookIds,
      linkedEvidenceArtifactPaths: uniqueSorted(pack.evidence?.artifactPaths ?? []),
      linkedEvidenceIds: uniqueSorted(pack.evidence?.ids ?? []),
      linkedRepairItemIds: uniqueSorted(pack.frontier?.repairItemIds ?? []),
      suggestedAcceptanceCriteria: uniqueSorted(pack.acceptanceCriteria ?? []),
      taxonomyFamilyIds: uniqueSorted(pack.taxonomyAnchors?.familyIds ?? []),
      taxonomyGroupIds: uniqueSorted(pack.taxonomyAnchors?.groupIds ?? []),
      generatedAt
    };

    for (const path of pack.rankedConversionPaths ?? []) {
      const candidateType = scaffoldCandidateType(path.targetType, pack);
      const targetArtifact = scaffoldTargetArtifact(path.targetType, path.targetId, pack, path);
      const context = summarizeCandidateContext(pack, operatorPlaybooks, sourcePlaybookIds, path);
      candidates.push({
        id: `candidate-${slugify(pack.id)}-${slugify(path.targetType)}-${slugify(path.targetId)}`,
        candidateType,
        priority: path.priority ?? "secondary",
        rank: path.rank ?? 1,
        score: (pack.score ?? 0) + (path.pathScore ?? 0),
        targetArtifact,
        targetId: path.targetId,
        suggestedTitle: path.suggestedTitle ?? `${pack.clusterLabel} candidate`,
        suggestedSummary: `${pack.summary} Proposed as a ${candidateType} from remediation pack ${pack.id}; review manually before creating any real work item.`,
        rationale: path.rationale ?? `Use ${path.targetType} as a manual execution bridge for ${pack.clusterLabel}.`,
        suggestedNextStep: path.nextStep ?? pack.manualNextActions?.[0] ?? `Review ${targetArtifact} before acting.`,
        context,
        sourceConversionPath: {
          targetType: path.targetType,
          targetId: path.targetId,
          rank: path.rank ?? 1,
          pathScore: path.pathScore ?? 0,
          rankingBasis: normalizeStringArray(path.rankingBasis ?? [])
        },
        ...commonFields
      });
    }

    if ((pack.reviewConcerns?.length ?? 0) > 0) {
      candidates.push({
        id: `candidate-${slugify(pack.id)}-review-follow-up`,
        candidateType: "review-follow-up-candidate",
        priority: "secondary",
        rank: 99,
        score: (pack.score ?? 0) + 50,
        targetArtifact: ARTIFACT_PATHS.reviewConcerns,
        targetId: pack.reviewConcerns[0].id,
        suggestedTitle: `${pack.clusterLabel} review follow-up`,
        suggestedSummary: `Proposal-only review follow-up candidate for remediation pack ${pack.id}; use it to convert unresolved review pressure into an explicit manual item if needed.`,
        rationale: `Review concerns remain linked to ${pack.id}, so a review-focused follow-up candidate stays useful even if no task is created automatically.`,
        suggestedNextStep: `Inspect review concern ${pack.reviewConcerns[0].id} and decide whether to record a manual follow-up item.`,
        context: summarizeCandidateContext(pack, operatorPlaybooks, sourcePlaybookIds, null),
        sourceConversionPath: null,
        ...commonFields
      });
    }
    if ((pack.figureQa?.length ?? 0) > 0) {
      candidates.push({
        id: `candidate-${slugify(pack.id)}-figure-follow-up`,
        candidateType: "figure-follow-up-candidate",
        priority: "secondary",
        rank: 100,
        score: (pack.score ?? 0) + 48,
        targetArtifact: ARTIFACT_PATHS.figureQa,
        targetId: pack.figureQa[0].id,
        suggestedTitle: `${pack.clusterLabel} figure follow-up`,
        suggestedSummary: `Proposal-only figure follow-up candidate for remediation pack ${pack.id}; use it to convert unresolved figure QA into an explicit manual item if needed.`,
        rationale: `Figure QA issues remain linked to ${pack.id}, so a figure-focused follow-up candidate keeps that work visible without auto-creating anything.`,
        suggestedNextStep: `Inspect figure QA issue ${pack.figureQa[0].id} and decide whether to record a manual follow-up item.`,
        context: summarizeCandidateContext(pack, operatorPlaybooks, sourcePlaybookIds, null),
        sourceConversionPath: null,
        ...commonFields
      });
    }
  }

  const sortedCandidates = candidates
    .sort((left, right) => {
      const scoreDelta = (right.score ?? 0) - (left.score ?? 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      const rankDelta = (left.rank ?? 999) - (right.rank ?? 999);
      if (rankDelta !== 0) {
        return rankDelta;
      }
      return left.id.localeCompare(right.id);
    })
    .map((candidate, index) => ({
      ...candidate,
      globalRank: index + 1
    }));

  const candidateTypeCounts = sortedCandidates.reduce((accumulator, candidate) => {
    accumulator[candidate.candidateType] = (accumulator[candidate.candidateType] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    ...createMetaExecutionBridgeCandidatesIndex(),
    candidates: sortedCandidates,
    summary: {
      candidateCount: sortedCandidates.length,
      topCandidateIds: sortedCandidates.slice(0, 5).map((candidate) => candidate.id),
      candidateTypeCounts,
      overview: sortedCandidates.length > 0
        ? `${sortedCandidates.length} proposal-only execution bridge candidates translate remediation packs and playbooks into likely manual work-item shapes without creating anything automatically.`
        : "No proposal-only execution bridge candidates have been generated yet.",
      candidatesPath: ARTIFACT_PATHS.metaExecutionBridgeCandidates
    },
    updatedAt: generatedAt
  };
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

function buildRepairFrontier({ wikiRelations, figureQa, stalePackets = [], handoffObligations = [], latestComparison = null, board = null }) {
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
  const governanceItems = [];
  if (stalePackets.length > 0 || handoffObligations.length > 0) {
    governanceItems.push({
      id: "repair-workflow-governance",
      frontierType: "workflow-governance",
      severity: stalePackets.length > 0 ? "high" : "medium",
      summary: `Reduce ${stalePackets.length} stale packets and ${handoffObligations.length} handoff obligations before expanding concurrent work.`,
      reasons: `The workspace already carries ${stalePackets.length} stale packets and ${handoffObligations.length} cross-role handoff obligations, so coordination debt is staying operator-visible instead of closing cleanly.`,
      reasonCodes: uniqueSorted([
        ...(stalePackets.length > 0 ? ["stale-packets"] : []),
        ...(handoffObligations.length > 0 ? ["handoff-obligations"] : [])
      ]),
      artifactPath: ARTIFACT_PATHS.workspaceIndex,
      relatedArtifactPaths: uniqueSorted([ARTIFACT_PATHS.orchestrationBoard, ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.navigationReport]),
      nextAction: stalePackets[0]?.nextAction ?? handoffObligations[0]?.nextAction ?? board?.nextAction ?? "Repair the queue governance debt before widening the active frontier."
    });
  }
  if (latestComparison && (latestComparison.unresolvedConcernsAdded ?? []).length > 0) {
    governanceItems.push({
      id: `repair-version-governance-${latestComparison.id}`,
      frontierType: "version-governance",
      severity: "medium",
      summary: `Explain or repair unresolved concern debt introduced by version comparison ${latestComparison.id}.`,
      reasons: `Comparison ${latestComparison.id} added ${(latestComparison.unresolvedConcernsAdded ?? []).length} unresolved concerns, so version movement still needs an explicit repair or acceptance trail.`,
      reasonCodes: ["version-comparison-unresolved-concerns"],
      artifactPath: ARTIFACT_PATHS.versionComparisons,
      relatedArtifactPaths: [ARTIFACT_PATHS.versionComparisonReport],
      nextAction: `Review ${ARTIFACT_PATHS.versionComparisonReport} and connect the added unresolved concerns to explicit revision or repair work before treating the newer version as stable.`
    });
  }
  const prioritizedItems = [...relationFamilyItems, ...relationItems, ...figureItems, ...governanceItems]
    .sort((left, right) => {
      const severityDelta = severityRank(left.severity) - severityRank(right.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, 12);
  return {
    count: relationFamilyItems.length + relationItems.length + figureItems.length + governanceItems.length,
    relationIssueCount: relationItems.length,
    relationFamilyIssueCount: relationFamilyItems.length,
    managedArtifactIssueCount: figureItems.length,
    governanceIssueCount: governanceItems.length,
    topDegradedFamilyIds: relationFamilySummaries.slice(0, 3).map((family) => family.id),
    topDegradedGroupIds: relationGroupSummaries.slice(0, 3).map((group) => group.id),
    taxonomyOverview: wikiRelations.summary?.taxonomy?.overview ?? "No degraded typed wiki relation families are currently summarized.",
    relationFamilySummaries,
    relationGroupSummaries,
    prioritizedItems
  };
}

function buildMetaOptimizeSurface({ root, board, workspaceIndex, journal, reviewConcerns, reviewState, adversarialState, experimentAudits, bridgeLog, figureQa, comparisons, existingLongHorizonMemory }) {
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
    if (isGovernanceRepairFrontierItem(item)) {
      continue;
    }
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
  const governanceCoverage = buildGovernanceCoverage(generatedAt);
  const governanceCoverageReport = buildGovernanceCoverageReport(governanceCoverage, generatedAt);
  const metaOptimizeMirror = buildMetaOptimizeMirror(metaRecommendations, longHorizonMemory, createMetaRemediationPacksIndex(), createMetaOperatorPlaybooksIndex(), createMetaExecutionBridgeCandidatesIndex(), createMetaOperatorFollowThroughIndex(), governanceCoverage);
  const remediationPacks = buildRemediationPacks({
    clusters,
    recommendations: rankedRecommendations,
    longHorizonMemory,
    reviewConcerns,
    figureQa,
    workspaceIndex: {
      ...workspaceIndex,
      metaOptimize: metaOptimizeMirror
    }
  });
  const operatorPlaybooks = buildFamilyOperatorPlaybooks({
    workspaceIndex: {
      ...workspaceIndex,
      metaOptimize: {
        ...metaOptimizeMirror,
        remediationPacks: remediationPacks.summary
      }
    },
    remediationPacks,
    longHorizonMemory
  });
  const executionBridgeCandidates = buildExecutionBridgeCandidates({ remediationPacks, operatorPlaybooks });
  const sourceCatalog = buildFollowThroughSourceCatalog(remediationPacks, operatorPlaybooks, executionBridgeCandidates);
  const existingFollowThrough = normalizeMetaOperatorFollowThroughIndex(readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, createMetaOperatorFollowThroughIndex));
  const operatorFollowThrough = buildOperatorFollowThrough(root, existingFollowThrough, sourceCatalog, generatedAt);
  const finalMetaOptimizeMirror = buildMetaOptimizeMirror(metaRecommendations, longHorizonMemory, remediationPacks, operatorPlaybooks, executionBridgeCandidates, operatorFollowThrough, governanceCoverage);
  const metaOptimizerState = {
    ...createMetaOptimizerState(),
    frontier: {
      recommendationCount: finalMetaOptimizeMirror.recommendationCount,
      criticalCount: finalMetaOptimizeMirror.criticalCount,
      clusterCount: finalMetaOptimizeMirror.clusterCount,
      frontierScore: finalMetaOptimizeMirror.frontierScore,
      activeSignalTypes: finalMetaOptimizeMirror.activeSignalTypes,
      topClusterIds: finalMetaOptimizeMirror.topClusterIds,
      topRecommendationIds: finalMetaOptimizeMirror.topRecommendationIds,
      topClusters: finalMetaOptimizeMirror.topClusters,
      frontierSummary: finalMetaOptimizeMirror.frontierSummary,
      rankingMethod: finalMetaOptimizeMirror.rankingMethod,
      tieBreakOrder: finalMetaOptimizeMirror.tieBreakOrder,
      reportPath: finalMetaOptimizeMirror.reportPath,
      recommendationsPath: finalMetaOptimizeMirror.recommendationsPath,
      statePath: finalMetaOptimizeMirror.statePath,
      longHorizonPath: finalMetaOptimizeMirror.longHorizonPath,
      remediationPacksPath: ARTIFACT_PATHS.metaRemediationPacks,
      topTaxonomyFamilyIds: finalMetaOptimizeMirror.topTaxonomyFamilyIds,
      topTaxonomyGroupIds: finalMetaOptimizeMirror.topTaxonomyGroupIds,
      pressureAreas: finalMetaOptimizeMirror.pressureAreas,
      taxonomyOverview: finalMetaOptimizeMirror.taxonomyOverview
    },
    clusters: finalMetaOptimizeMirror.topClusters,
    executionBridgeCandidates: executionBridgeCandidates.summary,
    followThrough: operatorFollowThrough.summary,
    governanceCoverage: governanceCoverage.summary,
    operatorPlaybooks: operatorPlaybooks.summary,
    remediationPacks: remediationPacks.summary,
    longHorizon: finalMetaOptimizeMirror.longHorizon,
    lastRefreshedAt: generatedAt,
    updatedAt: generatedAt
  };
  const reportLines = [
    "# Latest optimizer report",
    "",
    "- Proposal only: true",
    `- Generated: ${generatedAt}`,
    ...renderMetaOptimizeOverviewLines(finalMetaOptimizeMirror),
    `- Active signal types: ${signalTypes.join(", ") || "none"}`,
    `- Ranking method: ${finalMetaOptimizeMirror.rankingMethod}`,
    `- Stable tie-break order: ${finalMetaOptimizeMirror.tieBreakOrder.join(", ")}`,
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
    "## Remediation packs",
    "",
    ...(remediationPacks.packs.length > 0
      ? remediationPacks.packs.flatMap((pack) => [
          `### ${pack.rank}. ${pack.title} [${pack.priority}]`,
          `- Pack id: ${pack.id}`,
          `- Cluster: ${pack.clusterId}`,
          `- Summary: ${pack.summary}`,
          `- Taxonomy anchors: ${pack.taxonomyAnchors.overview}`,
          `- Linked review concerns: ${pack.reviewConcerns.map((item) => item.id).join(", ") || "none"}`,
          `- Linked figure QA: ${pack.figureQa.map((item) => item.id).join(", ") || "none"}`,
          `- Long-horizon memory: ${pack.longHorizonMemory.map((item) => item.id).join(", ") || "none"}`,
          `- Packet pointers: ${pack.packetPointers.map((item) => item.id).join(", ") || "none"}`,
          `- Workspace pointers: ${pack.workspacePointers.join(", ") || "none"}`,
          `- Readiness: ${pack.readiness?.operatorReadiness ?? "advisory-only"} (${pack.readiness?.overview ?? "No readiness diagnostics computed."})`,
          `- Missing ingredients: ${(pack.readiness?.missingIngredients ?? []).join(", ") || "none"}`,
          `- Acceptance criteria: ${pack.acceptanceCriteria.join(" | ") || "none"}`,
          `- Conversion hints: ${pack.conversionHints.map((item) => `${item.targetType}:${item.targetId}`).join(" | ") || "none"}`,
          `- Ranked conversion paths: ${(pack.rankedConversionPaths ?? []).map((item) => `${item.rank}:${item.priority}:${item.targetType}:${item.targetId}`).join(" | ") || "none"}`,
          `- Manual next actions: ${pack.manualNextActions.join(" | ") || "none"}`,
          ""
        ])
      : ["- No remediation packs generated from the current durable signals."]),
    "## Family-level operator playbooks",
    "",
    ...(operatorPlaybooks.playbooks.length > 0
      ? operatorPlaybooks.playbooks.flatMap((playbook, index) => [
          `### ${index + 1}. ${playbook.title}`,
          `- Playbook id: ${playbook.id}`,
          `- Taxonomy family: ${playbook.taxonomyFamilyId} (${playbook.taxonomyFamilyLabel})`,
          `- Summary: ${playbook.summary}`,
          `- Operator goal: ${playbook.operatorGoal}`,
          `- Selection basis: ${(playbook.selectionRankingBasis ?? []).join(" | ") || "none"}`,
          `- Readiness: ${playbook.readiness?.operatorReadiness ?? "advisory-only"} (${playbook.readiness?.overview ?? "No readiness diagnostics computed."})`,
          `- Missing ingredients: ${(playbook.readiness?.missingIngredients ?? []).join(", ") || "none"}`,
          `- Artifact update overview: ${playbook.artifactUpdateMap?.overview ?? "No explicit artifact targets derived."}`,
          `- Artifact update order: ${(playbook.artifactUpdateMap?.updateOrder ?? []).join(" -> ") || "none"}`,
          `- Artifact targets: ${(playbook.artifactUpdateMap?.targets ?? []).slice(0, 5).map((item) => `${item.rank}:${item.artifactPath}`).join(" | ") || "none"}`,
          `- Long-horizon summary: ${playbook.longHorizonSummary}`,
          `- Linked remediation packs: ${playbook.remediationPackIds.join(", ") || "none"}`,
          `- Acceptance criteria: ${playbook.acceptanceCriteria.join(" | ") || "none"}`,
          `- Conversion hints: ${playbook.conversionHints.map((item) => `${item.targetType}:${item.targetId}`).join(" | ") || "none"}`,
          `- Ranked conversion paths: ${(playbook.rankedConversionPaths ?? []).map((item) => `${item.rank}:${item.priority}:${item.targetType}:${item.targetId}`).join(" | ") || "none"}`,
          `- Manual next actions: ${playbook.manualNextActions.join(" | ") || "none"}`,
          ""
        ])
      : ["- No family-level operator playbooks generated from the current durable signals."]),
    "## Execution bridge candidate scaffolds",
    "",
    ...(executionBridgeCandidates.candidates.length > 0
      ? executionBridgeCandidates.candidates.slice(0, 10).flatMap((candidate, index) => [
          `### ${index + 1}. ${candidate.suggestedTitle}`,
          `- Candidate id: ${candidate.id}`,
          `- Candidate type: ${candidate.candidateType}`,
          `- Target artifact: ${candidate.targetArtifact}`,
          `- Summary: ${candidate.suggestedSummary}`,
          `- Suggested next step: ${candidate.suggestedNextStep}`,
          `- Source remediation packs: ${candidate.sourceRemediationPackIds.join(", ") || "none"}`,
          `- Source playbooks: ${candidate.sourcePlaybookIds.join(", ") || "none"}`,
          `- Linked packet pointers: ${(candidate.context?.linkedPacketPointers ?? []).map((item) => item.id).join(", ") || "none"}`,
          `- Workspace pointers: ${(candidate.context?.linkedWorkspacePointers ?? []).join(", ") || "none"}`,
          `- Evidence summary: artifacts=${(candidate.context?.evidenceSummary?.artifactPaths ?? []).join(", ") || "none"} ids=${(candidate.context?.evidenceSummary?.ids ?? []).join(", ") || "none"}`,
          `- Repair summary: repairs=${(candidate.context?.repairSummary?.repairItemIds ?? []).join(", ") || "none"} reviews=${(candidate.context?.repairSummary?.reviewConcernIds ?? []).join(", ") || "none"} figures=${(candidate.context?.repairSummary?.figureIssueIds ?? []).join(", ") || "none"}`,
          `- Linked repair items: ${candidate.linkedRepairItemIds.join(", ") || "none"}`,
          `- Acceptance criteria: ${candidate.suggestedAcceptanceCriteria.join(" | ") || "none"}`,
          ""
        ])
      : ["- No execution bridge candidates generated from the current durable signals."]),
    "## Governance coverage matrix",
    "",
    `- Overview: ${governanceCoverage.summary.overview}`,
    `- Guarded mutations: ${governanceCoverage.summary.guardedCount}`,
    `- Exempt mutations: ${governanceCoverage.summary.exemptCount}`,
    ...(governanceCoverage.guardedMutations.slice(0, 12).map((item) => `  - guarded ${item.id}: ${item.action} -> ${item.artifactPath}`)),
    ...(governanceCoverage.exemptMutations.slice(0, 6).map((item) => `  - exempt ${item.id}: ${item.action} -> ${item.artifactPath}`)),
    "",
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
    executionBridgeCandidates,
    governanceCoverage,
    governanceCoverageReport,
    operatorFollowThrough,
    operatorPlaybooks,
    remediationPacks,
    longHorizonMemory,
    metaRecommendations,
    metaOptimizerState,
    metaOptimizerReport: reportLines.join("\n"),
    metaGovernanceCoverageReport: {
      ...governanceCoverageReport,
      markdown: [
        "# Governance coverage report",
        "",
        `- Generated: ${generatedAt}`,
        `- Status: ${governanceCoverageReport.status}`,
        `- Guarded mutations: ${governanceCoverageReport.summary.guardedCount}`,
        `- Exempt mutations: ${governanceCoverageReport.summary.exemptCount}`,
        `- Overview: ${governanceCoverageReport.summary.overview}`,
        "",
        "## Guarded surfaces",
        "",
        ...governanceCoverage.guardedMutations.map((item) => `- ${item.id}: ${item.surfaceBindings.coreFunction} / ${item.surfaceBindings.mcpTool} / ${item.surfaceBindings.commandIds.join(", ")}`),
        "",
        "## Exempt surfaces",
        "",
        ...governanceCoverage.exemptMutations.map((item) => `- ${item.id}: ${item.surfaceBindings.coreFunction} / ${item.surfaceBindings.mcpTool} / ${item.surfaceBindings.commandIds.join(", ")} | owner=${item.ownerRole} | approvedBy=${item.approvedByRole} | cadence=${item.reviewCadence} | sunset=${item.sunsetAt}`),
        "",
        "## Exempt review metadata",
        "",
        ...governanceCoverage.exemptMutations.map((item) => `- ${item.id}: approvedAt=${item.approvedAt} | lastReviewedAt=${item.lastReviewedAt} | reviewCadence=${item.reviewCadence}`),
        "",
        "## Uncovered bindings",
        "",
        `- Tools: ${(governanceCoverageReport.surfaceBindingAudit.uncoveredTools ?? []).join(", ") || "none"}`,
        `- Commands: ${(governanceCoverageReport.surfaceBindingAudit.uncoveredCommands ?? []).join(", ") || "none"}`,
        `- Core functions: ${(governanceCoverageReport.surfaceBindingAudit.uncoveredCoreFunctions ?? []).join(", ") || "none"}`,
        `- Negative coverage gaps: ${(governanceCoverageReport.surfaceBindingAudit.uncoveredNegativeCoverage ?? []).join(", ") || "none"}`
      ].join("\n")
    }
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
  const handoffObligations = handoffPackets.map((packet) => ({
    packetId: packet.id,
    fromRole: board.assignedRole,
    toRole: packet.assignedRole,
    summary: `${packet.id} is active under ${packet.assignedRole} while the board owner is ${board.assignedRole}.`,
    nextAction: packet.nextAction,
    packetContextPath: packet.packetContextPath
  }));
  const latestComparison = (comparisons.items ?? []).at(-1) ?? null;
  const repairFrontier = buildRepairFrontier({
    wikiRelations,
    figureQa,
    stalePackets,
    handoffObligations,
    latestComparison,
    board
  });
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
  assertGovernanceMutationRegistered("refresh-durable-surfaces", "exempt");
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
    root,
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
    buildMetaOptimizeMirror(metaOptimize.metaRecommendations, metaOptimize.longHorizonMemory, metaOptimize.remediationPacks, metaOptimize.operatorPlaybooks, metaOptimize.executionBridgeCandidates, metaOptimize.operatorFollowThrough, metaOptimize.governanceCoverage)
  );
  writeJson(root, ARTIFACT_PATHS.workspaceIndex, workspaceIndex);
  writeJson(root, ARTIFACT_PATHS.metaEvents, metaOptimize.metaEvents);
    writeJson(root, ARTIFACT_PATHS.metaExecutionBridgeCandidates, metaOptimize.executionBridgeCandidates);
    writeJson(root, ARTIFACT_PATHS.metaGovernanceCoverage, metaOptimize.governanceCoverage);
    writeJson(root, ARTIFACT_PATHS.metaGovernanceCoverageReport, metaOptimize.metaGovernanceCoverageReport);
    writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, metaOptimize.operatorFollowThrough);
  writeJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, metaOptimize.longHorizonMemory);
  writeJson(root, ARTIFACT_PATHS.metaOperatorPlaybooks, metaOptimize.operatorPlaybooks);
  writeJson(root, ARTIFACT_PATHS.metaRemediationPacks, metaOptimize.remediationPacks);
  writeJson(root, ARTIFACT_PATHS.metaRecommendations, metaOptimize.metaRecommendations);
    writeJson(root, ARTIFACT_PATHS.metaOptimizerState, metaOptimize.metaOptimizerState);
    writeText(root, ARTIFACT_PATHS.metaOptimizerReport, metaOptimize.metaOptimizerReport);
    writeText(root, ARTIFACT_PATHS.metaGovernanceCoverageReportMarkdown, metaOptimize.metaGovernanceCoverageReport.markdown);
  const packetByIdForManifest = new Map(packetsWithHealth.map((packet) => [packet.id, packet]));
  const artifactPaths = uniqueSorted([
    ARTIFACT_PATHS.orchestrationBoard,
    ARTIFACT_PATHS.orchestrationHandoffs,
    ARTIFACT_PATHS.taskPacketsIndex,
    ARTIFACT_PATHS.workspaceIndex,
    ARTIFACT_PATHS.metaEvents,
      ARTIFACT_PATHS.metaExecutionBridgeCandidates,
      ARTIFACT_PATHS.metaGovernanceCoverage,
      ARTIFACT_PATHS.metaGovernanceCoverageReport,
      ARTIFACT_PATHS.metaGovernanceCoverageReportMarkdown,
      ARTIFACT_PATHS.metaOperatorFollowThrough,
    ARTIFACT_PATHS.metaLongHorizonMemory,
    ARTIFACT_PATHS.metaOperatorPlaybooks,
    ARTIFACT_PATHS.metaRemediationPacks,
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
      localRules: manifest.behaviorDiscipline.localRules,
      operatorGuidance: buildOperatorGuidance(workspaceIndex, metaOptimize.remediationPacks, metaOptimize.operatorPlaybooks, metaOptimize.executionBridgeCandidates, metaOptimize.operatorFollowThrough, { roleId: packet.assignedRole, packetId: packet.id, packet })
    }));
  }
  for (const role of roleRoster) {
    const manifest = buildRoleManifest(role, packetsWithHealth, openQuestions, decisions, workspaceIndex, metaOptimize.remediationPacks, metaOptimize.operatorPlaybooks, metaOptimize.executionBridgeCandidates);
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
      localRules: manifest.behaviorDiscipline.localRules,
      operatorGuidance: manifest.operatorGuidance
    }));
  }
  const phaseManifestPath = path.join(ARTIFACT_PATHS.phaseContextsDir, `${board.currentPhase}.json`);
  const phaseManifest = buildPhaseManifest(board, packetsWithHealth, workspaceIndex, metaOptimize.remediationPacks, metaOptimize.operatorPlaybooks, metaOptimize.executionBridgeCandidates);
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
    localRules: phaseManifest.behaviorDiscipline.localRules,
    operatorGuidance: phaseManifest.operatorGuidance
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
    ],
    operatorGuidance: buildOperatorGuidance(workspaceIndex, metaOptimize.remediationPacks, metaOptimize.operatorPlaybooks, metaOptimize.executionBridgeCandidates, metaOptimize.operatorFollowThrough, { roleId: board.assignedRole })
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
  assertGovernanceMutationRegistered("query-meta-optimize", "exempt");
  refreshDurableSurfaces(root, {
    type: "query-meta-optimize",
    summary: "Refreshed proposal-only meta-optimize surfaces.",
    artifactPaths: [ARTIFACT_PATHS.metaEvents, ARTIFACT_PATHS.metaExecutionBridgeCandidates, ARTIFACT_PATHS.metaGovernanceCoverage, ARTIFACT_PATHS.metaOperatorPlaybooks, ARTIFACT_PATHS.metaRemediationPacks, ARTIFACT_PATHS.metaRecommendations, ARTIFACT_PATHS.metaOptimizerState, ARTIFACT_PATHS.metaOptimizerReport, ARTIFACT_PATHS.workspaceIndex]
  });
  const events = readJson(root, ARTIFACT_PATHS.metaEvents, createMetaEventsIndex);
  const executionBridgeCandidates = normalizeMetaExecutionBridgeCandidatesIndex(readJson(root, ARTIFACT_PATHS.metaExecutionBridgeCandidates, createMetaExecutionBridgeCandidatesIndex));
  const governanceCoverage = normalizeMetaGovernanceCoverageIndex(readJson(root, ARTIFACT_PATHS.metaGovernanceCoverage, createMetaGovernanceCoverageIndex));
  const operatorFollowThrough = normalizeMetaOperatorFollowThroughIndex(readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, createMetaOperatorFollowThroughIndex));
  const longHorizonMemory = normalizeMetaLongHorizonMemory(readJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, createMetaLongHorizonMemory));
  const operatorPlaybooks = normalizeMetaOperatorPlaybooksIndex(readJson(root, ARTIFACT_PATHS.metaOperatorPlaybooks, createMetaOperatorPlaybooksIndex));
  const remediationPacks = normalizeMetaRemediationPacksIndex(readJson(root, ARTIFACT_PATHS.metaRemediationPacks, createMetaRemediationPacksIndex));
  const recommendations = normalizeMetaRecommendationsIndex(readJson(root, ARTIFACT_PATHS.metaRecommendations, createMetaRecommendationsIndex));
  const state = normalizeMetaOptimizerState(readJson(root, ARTIFACT_PATHS.metaOptimizerState, createMetaOptimizerState));
  return {
    proposalOnly: true,
    events: events.items ?? [],
    executionBridgeCandidates,
    governanceCoverage,
    governanceCoverageReport: normalizeMetaGovernanceCoverageReport(readJson(root, ARTIFACT_PATHS.metaGovernanceCoverageReport, createMetaGovernanceCoverageReport)),
    operatorFollowThrough,
    operatorPlaybooks,
    remediationPacks,
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
    executionBridgeCandidatesPath: ARTIFACT_PATHS.metaExecutionBridgeCandidates,
    governanceCoveragePath: ARTIFACT_PATHS.metaGovernanceCoverage,
    governanceCoverageReportPath: ARTIFACT_PATHS.metaGovernanceCoverageReport,
    governanceCoverageReportMarkdownPath: ARTIFACT_PATHS.metaGovernanceCoverageReportMarkdown,
    operatorFollowThroughPath: ARTIFACT_PATHS.metaOperatorFollowThrough,
    operatorPlaybooksPath: ARTIFACT_PATHS.metaOperatorPlaybooks,
    remediationPacksPath: ARTIFACT_PATHS.metaRemediationPacks,
    longHorizonPath: ARTIFACT_PATHS.metaLongHorizonMemory
  };
}

export function queryOperatorFollowThrough(root) {
  assertGovernanceMutationRegistered("record-operator-follow-through", "exempt");
  const meta = queryMetaOptimize(root);
  return {
    ...meta.operatorFollowThrough,
    reportPath: ARTIFACT_PATHS.metaOptimizerReport
  };
}

export function queryGovernanceCoverageReport(root) {
  const meta = queryMetaOptimize(root);
  return {
    ...meta.governanceCoverageReport,
    reportPath: ARTIFACT_PATHS.metaGovernanceCoverageReport,
    markdownPath: ARTIFACT_PATHS.metaGovernanceCoverageReportMarkdown
  };
}

export function recordOperatorFollowThrough(root, args = {}) {
  assertGovernanceMutationRegistered("record-operator-follow-through", "exempt");
  const meta = queryMetaOptimize(root);
  const sourceType = args.sourceType;
  const sourceId = args.sourceId;
  const sourceCatalog = buildFollowThroughSourceCatalog(meta.remediationPacks, meta.operatorPlaybooks, meta.executionBridgeCandidates);
  const source = sourceCatalog.get(`${sourceType}:${sourceId}`);
  if (!source) {
    throw new Error(`Unknown follow-through source: ${sourceType}:${sourceId}`);
  }
  const status = validateFollowThroughPayload(args);
  validateFollowThroughActor(root, args, source);
  const existing = normalizeMetaOperatorFollowThroughIndex(readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, createMetaOperatorFollowThroughIndex));
  const existingTransitions = normalizeMetaOperatorFollowThroughTransitionsIndex(readJson(root, ARTIFACT_PATHS.metaOperatorFollowThroughTransitions, createMetaOperatorFollowThroughTransitionsIndex));
  const recordId = args.id ?? `follow-through-${slugify(`${sourceType}-${sourceId}`)}`;
  const previousRecord = existing.items.find((item) => item.id === recordId) ?? null;
  const items = existing.items.filter((item) => item.id !== recordId);
  const nextRecord = {
    id: recordId,
    sourceType,
    sourceId,
    sourceArtifactPath: source.sourceArtifactPath,
    sourceFingerprint: source.sourceFingerprint,
    sourceTitle: source.title,
    sourceSummary: source.summary,
    status,
    decisionSummary: args.decisionSummary ?? "",
    rationale: args.rationale ?? "",
    selectedConversionPathKey: args.selectedConversionPathKey ?? null,
    linkedTargetArtifact: args.linkedTargetArtifact ?? null,
    linkedTargetId: args.linkedTargetId ?? null,
    deferUntil: args.deferUntil ?? null,
    executeBy: args.executeBy ?? null,
    executionStartedAt: args.executionStartedAt ?? null,
    executionCompletedAt: args.executionCompletedAt ?? null,
    reviewAfter: args.reviewAfter ?? null,
    closureReason: args.closureReason ?? null,
    closureArtifactPaths: normalizeStringArray(args.closureArtifactPaths),
    actorRole: args.actorRole,
    policyOverrideReason: args.policyOverrideReason ?? "",
    policyOverrideEvidencePaths: normalizeStringArray(args.policyOverrideEvidencePaths),
    recordedAt: args.recordedAt ?? nowIso(),
    updatedAt: nowIso()
  };
  validateFollowThroughTargetBinding(root, nextRecord);
  validateFollowThroughTransition(previousRecord, nextRecord);
  items.push(nextRecord);
  const next = buildOperatorFollowThrough(root, { ...existing, items }, sourceCatalog, nowIso());
  const nextTransitions = buildFollowThroughTransitions(existingTransitions, nextRecord, previousRecord, nowIso());
  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, next);
  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThroughTransitions, nextTransitions);
  refreshDurableSurfaces(root, {
    type: "record-operator-follow-through",
    summary: `Recorded operator follow-through for ${sourceType}:${sourceId}.`,
    artifactPaths: [ARTIFACT_PATHS.metaOperatorFollowThrough, ARTIFACT_PATHS.metaOperatorFollowThroughTransitions, ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.sessionSummary, ARTIFACT_PATHS.metaOptimizerReport]
  });
  return next;
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
  assertGovernanceMutationRegistered("summarize-session-journal", "exempt");
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
