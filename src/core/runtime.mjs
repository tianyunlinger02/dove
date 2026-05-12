import crypto from "node:crypto";

import {
  ARTIFACT_PATHS,
  createMetaExecutionBridgeCandidatesIndex,
  createProgramApprovalsIndex,
  createProgramsIndex,
  createProgramRunsIndex,
  createResearchAgenda,
  normalizeAutonomyAllowedStepType,
  normalizeMetaExecutionBridgeCandidatesIndex,
  normalizeProgramApprovalsIndex,
  normalizeProgramsIndex,
  normalizeProgramRunsIndex
} from "./schema.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { assertGovernanceMutationRegistered, ensureWorkspace, nowIso, readJson, writeJson, writeText } from "./workspace.mjs";
import { materializeGuidancePacket, planCampaign, queryMetaOptimize, recordOperatorFollowThrough, reflectCampaignStepOutcome, refreshDurableSurfaces } from "./navigation.mjs";
import { refreshWiki, upsertNote } from "./artifacts.mjs";
import { persistExperimentAudit, persistExperimentResultClaimBridge } from "./orchestration.mjs";
import { persistReviewLoop } from "./reviews.mjs";
import {
  acquireLease,
  activeLeaseForPacket,
  appendEvent,
  appendResult,
  buildAutonomyRequestSnapshot,
  expireStaleLeases,
  loadRuntimeArtifacts,
  readCurrentContinuation,
  releaseLease,
  saveRuntimeArtifacts,
  updateContinuationState,
  updateControllerState
} from "./runtime-state.mjs";

const ELIGIBLE_LIFECYCLES = new Set(["waiting", "queued", "stale"]);
const RUN_ONCE_SELECTION_POLICY = "planner-materialized-guidance-v2";
const WORKER_STEP_POLICY = "planner-control-plane-worker-step-v1";
const DEFAULT_WORKER_STEP_MAX_ATTEMPTS = 3;

const ELIGIBLE_PACKET_TIE_BREAK_POLICY = ["resume-priority", "execute-by", "review-after", "packet-id", "follow-through-id"];
const MATERIALIZATION_TIE_BREAK_POLICY = ["execute-by", "review-after", "packet-id", "source-id", "follow-through-id"];
const OPERATE_SAFE_STEP_SEQUENCE = [
  { allowedStepType: "refresh-research-brief", stepPayload: null },
  { allowedStepType: "refresh-wiki", stepPayload: null },
  { allowedStepType: "run-review-loop", stepPayload: { scope: "current paper pipeline", stage: "autonomy-operate" } }
];

function uniqueStrings(items = []) {
  return Array.from(new Set(items.filter(Boolean)));
}

function buildRunId() {
  return `autonomy-run-${crypto.randomUUID()}`;
}

function normalizeOperateIdSeed(seed) {
  return String(seed ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildOperateId(prefix, seed) {
  return `${prefix}-${normalizeOperateIdSeed(seed) || crypto.randomUUID()}`;
}

function resolveOperateId(prefix, explicitId, seed) {
  return normalizeOperateIdSeed(explicitId) || buildOperateId(prefix, seed);
}

function buildReadPaths(workspaceIndex, packet) {
  const envelopeWorkerRole = packet.autonomyEnvelope?.workerRole ?? null;
  const packetActionContextPath = `${ARTIFACT_PATHS.actionContextsDir}/packet-${packet.id}.json`;
  const roleContextPath = envelopeWorkerRole ? `${ARTIFACT_PATHS.roleContextsDir}/${envelopeWorkerRole}.json` : null;
  return uniqueStrings([
    ARTIFACT_PATHS.workspaceIndex,
    ARTIFACT_PATHS.taskPacketsIndex,
    ARTIFACT_PATHS.metaOperatorFollowThrough,
    workspaceIndex.contextSurfaces?.currentActionContextPath,
    packetActionContextPath,
    roleContextPath,
    packet.packetContextPath,
    packet.packetPath,
    ...(packet.lineage?.programId || packet.materialization?.programId ? [ARTIFACT_PATHS.programsIndex, ARTIFACT_PATHS.programRuns, ARTIFACT_PATHS.programApprovals, ARTIFACT_PATHS.campaignsIndex] : []),
    ...(packet.autonomyEnvelope?.requiredReadPaths ?? []),
    ...(workspaceIndex.behaviorDiscipline?.requiredReadOrder ?? [])
  ]);
}

function resolveAutonomyEnvelope(packet = {}, followThroughItem = null, controllerRole = "planner") {
  const packetEnvelope = packet.autonomyEnvelope ?? null;
  const workerRole = packetEnvelope?.workerRole ?? null;
  const controller = packetEnvelope?.controllerRole ?? null;
  if (!workerRole || !controller) {
    return null;
  }
  if (controller !== controllerRole) {
    return null;
  }
  return {
    controllerRole: controller,
    workerRole,
    scopeType: packetEnvelope?.scopeType ?? "packet-local",
    explicitOnly: packetEnvelope?.explicitOnly ?? true,
    requiredReadPaths: packetEnvelope?.requiredReadPaths ?? [],
    localRules: packetEnvelope?.localRules ?? []
  };
}

function normalizeWorkerRetryState(value = {}) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const attemptCount = Number.isFinite(Number(raw.attemptCount)) ? Number(raw.attemptCount) : 0;
  const maxAttempts = Number.isFinite(Number(raw.maxAttempts)) ? Number(raw.maxAttempts) : DEFAULT_WORKER_STEP_MAX_ATTEMPTS;
  return {
    attemptCount: Math.max(0, attemptCount),
    maxAttempts: Math.max(1, maxAttempts),
    lastAttemptAt: raw.lastAttemptAt ?? null,
    lastError: raw.lastError ?? null,
    escalatedAt: raw.escalatedAt ?? null
  };
}

function updatePacketIndex(root, packet, timestamp) {
  const packetIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, { items: [] });
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    ...packetIndex,
    items: [...(packetIndex.items ?? []).filter((item) => item.id !== packet.id), packet],
    updatedAt: timestamp
  });
}

function persistPacketWorkerCheckpoint(root, packet, { runId, timestamp, summary, continuationStatus, lifecycleStatus }) {
  const packetFromDisk = readJson(root, packet.packetPath, packet);
  const checkpoint = {
    id: `autonomy-step-${runId}`,
    summary,
    rationale: packetFromDisk.nextAction ?? "",
    origin: packet.packetPath,
    recordedAt: timestamp
  };
  const continuationState = {
    ...(packetFromDisk.continuationState ?? {}),
    status: continuationStatus,
    lastCheckpoint: summary,
    checkpointHistory: [
      ...((packetFromDisk.continuationState?.checkpointHistory ?? []).filter(Boolean)),
      `${timestamp} ${summary}`
    ],
    updatedAt: timestamp
  };
  const nextPacket = {
    ...packetFromDisk,
    lifecycleStatus,
    continuationState,
    decisions: [...(packetFromDisk.decisions ?? []), checkpoint],
    updatedAt: timestamp
  };
  writeJson(root, nextPacket.packetPath, nextPacket);
  updatePacketIndex(root, nextPacket, timestamp);
  return nextPacket;
}

function snapshotPacket(packet) {
  return {
    id: packet.id,
    title: packet.title,
    lifecycleStatus: packet.lifecycleStatus,
    packetPath: packet.packetPath,
    packetContextPath: packet.packetContextPath,
    assignedRole: packet.assignedRole,
    autonomyEnvelope: packet.autonomyEnvelope ?? null,
    nextAction: packet.nextAction,
    continuationState: packet.continuationState
  };
}

function snapshotFollowThrough(item) {
  return {
    id: item.id,
    status: item.status,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    linkedTargetArtifact: item.linkedTargetArtifact,
    linkedTargetId: item.linkedTargetId,
    workerRole: item.workerRole ?? null,
    executeBy: item.executeBy,
    reviewAfter: item.reviewAfter,
    retryState: item.retryState ?? normalizeWorkerRetryState()
  };
}

function snapshotCheckpoint(packet, { summary, recordedAt, continuationStatus }) {
  return {
    packetId: packet.id,
    packetPath: packet.packetPath,
    lifecycleStatus: packet.lifecycleStatus,
    continuationStatus,
    summary,
    recordedAt
  };
}

function snapshotEscalation(packet, followThroughItem, { summary, recordedAt }) {
  return {
    packetId: packet.id,
    packetPath: packet.packetPath,
    followThroughId: followThroughItem?.id ?? null,
    summary,
    recordedAt,
    escalatedAt: followThroughItem?.retryState?.escalatedAt ?? null
  };
}

function snapshotEnvelope(envelope = null) {
  return envelope
    ? {
        controllerRole: envelope.controllerRole ?? null,
        workerRole: envelope.workerRole ?? null,
        scopeType: envelope.scopeType ?? "packet-local",
        explicitOnly: envelope.explicitOnly ?? true
      }
    : null;
}

function normalizeForegroundScopeFilter(args = {}) {
  const packetId = typeof args.packetId === "string" && args.packetId.trim() ? args.packetId.trim() : null;
  const programRunId = typeof args.programRunId === "string" && args.programRunId.trim() ? args.programRunId.trim() : null;
  const approvalId = typeof args.approvalId === "string" && args.approvalId.trim() ? args.approvalId.trim() : null;
  return { packetId, programRunId, approvalId };
}

function summarizeExecutionBridgeCandidates(items = []) {
  const candidateTypeCounts = items.reduce((accumulator, candidate) => {
    const type = candidate.candidateType ?? "unknown";
    accumulator[type] = (accumulator[type] ?? 0) + 1;
    return accumulator;
  }, {});
  return {
    candidateCount: items.length,
    topCandidateIds: items.slice(0, 5).map((candidate) => candidate.id),
    candidateTypeCounts,
    overview: items.length > 0
      ? `${items.length} proposal-only execution bridge candidates are available; objective-derived candidates remain explicit and no-auto-apply.`
      : "No proposal-only execution bridge candidates have been generated yet.",
    candidatesPath: ARTIFACT_PATHS.metaExecutionBridgeCandidates
  };
}

function normalizeOperateStepSequence(args = {}) {
  if (Array.isArray(args.stepSequence) && args.stepSequence.length > 0) {
    return args.stepSequence.map((step) => ({
      allowedStepType: normalizeAutonomyAllowedStepType(step?.allowedStepType, "refresh-research-brief"),
      stepPayload: step?.stepPayload ?? null
    }));
  }
  return OPERATE_SAFE_STEP_SEQUENCE.map((step) => ({ ...step, stepPayload: step.stepPayload ? { ...step.stepPayload } : null }));
}

function resolveOperateWindows(args = {}, timestamp = nowIso()) {
  return {
    executeBy: args.executeBy ?? new Date(Date.parse(timestamp) + 24 * 60 * 60 * 1000).toISOString(),
    reviewAfter: args.reviewAfter ?? new Date(Date.parse(timestamp) + 2 * 60 * 60 * 1000).toISOString(),
    expiresAt: args.expiresAt ?? new Date(Date.parse(timestamp) + 24 * 60 * 60 * 1000).toISOString()
  };
}

function upsertObjectiveExecutionBridgeCandidate(root, args, { packetId, timestamp }) {
  const objective = String(args.objective ?? "").trim();
  if (!objective) {
    throw new Error("runAutonomyOperate requires objective when sourceType/sourceId are not provided.");
  }
  const workerRole = args.workerRole ?? "researcher";
  const candidateId = resolveOperateId("objective-bridge", args.sourceId, objective);
  const existing = normalizeMetaExecutionBridgeCandidatesIndex(readJson(root, ARTIFACT_PATHS.metaExecutionBridgeCandidates, createMetaExecutionBridgeCandidatesIndex));
  const candidate = {
    id: candidateId,
    proposalOnly: true,
    noAutoApply: true,
    candidateOrigin: "operator-objective",
    objectiveDerived: true,
    candidateType: "packet-candidate",
    priority: "primary",
    rank: 0,
    globalRank: 0,
    score: 1000,
    targetArtifact: `${ARTIFACT_PATHS.taskPacketsPacketsDir}/${packetId}.json`,
    targetId: packetId,
    suggestedTitle: args.title ?? `Operate objective: ${objective}`,
    suggestedSummary: args.summary ?? `Objective-derived proposal-only execution bridge for: ${objective}`,
    rationale: args.rationale ?? "Created by an explicit autonomy-operate foreground invocation; remains proposal-only until governed materialization binds it to a packet.",
    suggestedNextStep: args.nextAction ?? "Materialize this objective-derived candidate, issue bounded approval, then run explicit foreground autonomy.",
    suggestedAcceptanceCriteria: [
      "Refresh the durable research brief for the objective.",
      "Refresh the wiki/query navigation surfaces.",
      "Run a review-loop checkpoint without inventing note, audit, bridge, or claim payloads."
    ],
    linkedEvidenceArtifactPaths: [ARTIFACT_PATHS.researchBrief, ARTIFACT_PATHS.workspaceIndex],
    linkedEvidenceIds: [packetId],
    linkedRepairItemIds: [],
    taxonomyFamilyIds: [],
    taxonomyGroupIds: [],
    sourceRemediationPackIds: [],
    sourcePlaybookIds: [],
    context: {
      operatorObjective: objective,
      linkedWorkspacePointers: [ARTIFACT_PATHS.researchBrief, ARTIFACT_PATHS.wiki, ARTIFACT_PATHS.reviewLog],
      linkedPacketPointers: [{ id: packetId, assignedRole: workerRole }],
      safeDefaultStepSequence: OPERATE_SAFE_STEP_SEQUENCE.map((step) => step.allowedStepType)
    },
    sourceConversionPath: {
      targetType: "create-new-packet",
      targetId: packetId,
      assignedRole: workerRole,
      rank: 0,
      pathScore: 1000,
      rankingBasis: ["explicit-operator-objective", "safe-default-step-sequence", "no-placeholder-payloads"]
    },
    generatedAt: timestamp,
    updatedAt: timestamp
  };
  const items = [candidate, ...(existing.candidates ?? []).filter((item) => item.id !== candidate.id)];
  const next = {
    ...existing,
    proposalOnly: true,
    noAutoApply: true,
    candidates: items,
    summary: summarizeExecutionBridgeCandidates(items),
    sourceArtifacts: uniqueStrings([...(existing.sourceArtifacts ?? []), ARTIFACT_PATHS.researchBrief, ARTIFACT_PATHS.workspaceIndex]),
    updatedAt: timestamp
  };
  writeJson(root, ARTIFACT_PATHS.metaExecutionBridgeCandidates, next);
  return candidate;
}

function nextForegroundScopeFilter(step, continuation, priorFilter = {}) {
  if (!continuation) {
    return null;
  }
  if (continuation.kind === "execute-materialized-packet") {
    return {
      packetId: continuation.packetId ?? step.packetId ?? priorFilter.packetId ?? null,
      programRunId: continuation.programRunId ?? step.programSnapshot?.programRunId ?? priorFilter.programRunId ?? null,
      approvalId: step.programSnapshot?.approvalId ?? priorFilter.approvalId ?? null
    };
  }
  if (continuation.kind === "continue-program-envelope") {
    return {
      packetId: continuation.packetId ?? step.packetId ?? priorFilter.packetId ?? null,
      programRunId: continuation.programRunId ?? step.programSnapshot?.programRunId ?? priorFilter.programRunId ?? null,
      approvalId: continuation.approvalId ?? step.programSnapshot?.approvalId ?? priorFilter.approvalId ?? null
    };
  }
  return null;
}

export function runAutonomyOperate(root, args = {}) {
  assertGovernanceMutationRegistered("run-autonomy-operate", "exempt");
  ensureWorkspace(root);
  const actorRole = args.actorRole ?? "planner";
  if (actorRole !== "planner") {
    throw new Error(`runAutonomyOperate currently supports only actorRole 'planner'. Received ${actorRole}.`);
  }
  const timestamp = nowIso();
  const objective = String(args.objective ?? args.programObjective ?? "").trim();
  const sourceFirst = Boolean(String(args.sourceType ?? "").trim() && String(args.sourceId ?? "").trim());
  if (!sourceFirst && !objective) {
    throw new Error("runAutonomyOperate requires either sourceType/sourceId or objective.");
  }
  const workerRole = args.workerRole ?? "researcher";
  const stepSequence = normalizeOperateStepSequence(args);
  const firstStep = stepSequence[0]?.allowedStepType ?? "refresh-research-brief";
  const packetId = resolveOperateId("task-operate", args.packetId, args.sourceId ?? objective);
  const programId = resolveOperateId("program-operate", args.programId, args.sourceId ?? objective);
  const programRunId = resolveOperateId("program-run-operate", args.programRunId, args.sourceId ?? `${objective}-${timestamp}`);
  const approvalId = resolveOperateId("approval-operate", args.approvalId, args.sourceId ?? `${objective}-${timestamp}`);
  const campaignId = resolveOperateId("campaign-operate", args.campaignId, args.sourceId ?? objective);
  const campaignStepId = resolveOperateId("step-operate", args.campaignStepId, firstStep);
  const windows = resolveOperateWindows(args, timestamp);
  const source = sourceFirst
    ? { sourceType: String(args.sourceType).trim(), sourceId: String(args.sourceId).trim(), candidate: null }
    : {
        sourceType: "execution-bridge",
        sourceId: upsertObjectiveExecutionBridgeCandidate(root, args, { packetId, timestamp }).id
      };

  const plannedCampaign = planCampaign(root, {
    campaignId,
    title: args.campaignTitle ?? `Autonomy operate: ${objective || source.sourceId}`,
    objective: objective || args.programObjective || `Operate on ${source.sourceType}:${source.sourceId}`,
    status: "planned",
    phase: args.phase ?? "research",
    actorRole,
    programIds: [programId],
    steps: [{
      id: campaignStepId,
      title: args.campaignStepTitle ?? `Execute bounded autonomy for ${packetId}`,
      status: "planned",
      programId,
      programRunId,
      approvalId,
      packetId,
      allowedStepType: firstStep,
      objective: objective || args.programObjective || null,
      nextAction: "Run explicit foreground autonomy for the materialized objective packet.",
      evidenceLinks: [ARTIFACT_PATHS.metaExecutionBridgeCandidates, ARTIFACT_PATHS.researchBrief],
      outputPaths: [ARTIFACT_PATHS.runtimeResults, ARTIFACT_PATHS.programRuns],
      executeBy: windows.executeBy,
      reviewAfter: windows.reviewAfter
    }],
    nextAction: "Materialize, approve, run foreground autonomy, and stop at a durable review boundary.",
    reviewPolicy: "fresh-approval-after-review-checkpoint",
    explicitApprovalRequired: true,
    noHiddenRuntime: true
  });

  const materialized = materializeGuidancePacket(root, {
    ...args,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    actorRole,
    workerRole,
    programId,
    programRunId,
    approvalId,
    campaignId,
    campaignStepId,
    packetId,
    title: args.title ?? `Autonomy operate packet: ${objective || source.sourceId}`,
    summary: args.summary ?? `Explicit foreground autonomy packet for ${objective || `${source.sourceType}:${source.sourceId}`}.`,
    phase: args.phase ?? "research",
    assignedRole: workerRole,
    nextAction: args.nextAction ?? "Execute the safe bounded research/review sequence and stop at the durable review checkpoint.",
    outputPaths: uniqueStrings([ARTIFACT_PATHS.researchBrief, ARTIFACT_PATHS.wiki, ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.runtimeResults]),
    executeBy: windows.executeBy,
    reviewAfter: windows.reviewAfter,
    autonomyPolicy: "objective-aware-default",
    stepSequence,
    allowedStepType: firstStep,
    reviewScope: args.reviewScope ?? "current paper pipeline",
    reviewStage: args.reviewStage ?? "autonomy-operate",
    programTitle: args.programTitle ?? `Autonomy operate program: ${objective || source.sourceId}`,
    programObjective: args.programObjective ?? (objective || `Operate on ${source.sourceType}:${source.sourceId}`),
    programAgenda: args.programAgenda ?? [objective || `Materialize and execute ${source.sourceType}:${source.sourceId}`],
    programEvidenceBacklog: args.programEvidenceBacklog ?? [],
    programApprovalSummary: args.programApprovalSummary ?? `Approved explicit foreground autonomy for ${packetId} with ${stepSequence.length} bounded safe default step(s).`,
    decisionSummary: args.decisionSummary ?? `Materialized autonomy-operate source ${source.sourceType}:${source.sourceId} into ${packetId}.`,
    rationale: args.rationale ?? "autonomy-operate composes proposal, planning, materialization, bounded approval, and foreground execution without hidden runtime."
  });

  const requestedSteps = Number.isInteger(args.maxSteps) ? args.maxSteps : Number(args.maxSteps);
  const maxSteps = Number.isFinite(requestedSteps) ? Math.max(1, Math.min(25, Math.trunc(requestedSteps))) : stepSequence.length + 1;
  const foreground = runAutonomyForeground(root, {
    actorRole,
    maxSteps,
    packetId: materialized.packetId,
    programRunId,
    approvalId
  });
  refreshDurableSurfaces(root, {
    type: "autonomy-operate",
    summary: `autonomy-operate stopped at ${foreground.stopReason} after ${foreground.stepCount} bounded foreground step(s).`,
    artifactPaths: [
      ARTIFACT_PATHS.metaExecutionBridgeCandidates,
      ARTIFACT_PATHS.metaOperatorFollowThrough,
      ARTIFACT_PATHS.campaignsIndex,
      ARTIFACT_PATHS.programsIndex,
      ARTIFACT_PATHS.programRuns,
      ARTIFACT_PATHS.programApprovals,
      ARTIFACT_PATHS.runtimeControllerState,
      ARTIFACT_PATHS.runtimeResults,
      ARTIFACT_PATHS.workspaceIndex
    ]
  });
  const continuation = readCurrentContinuation(root).items?.[0] ?? null;
  return {
    status: foreground.status,
    actorRole,
    workerRole,
    inputMode: sourceFirst ? "source" : "objective",
    objective: objective || null,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    campaignId,
    campaignStepId,
    programId,
    programRunId,
    approvalId,
    packetId: materialized.packetId,
    followThroughId: materialized.followThroughId,
    safeDefaultStepSequence: stepSequence.map((step) => step.allowedStepType),
    plannedCampaign,
    materialized,
    foreground,
    stopReason: foreground.stopReason,
    nextContinuation: continuation,
    artifactPaths: uniqueStrings([
      ARTIFACT_PATHS.metaExecutionBridgeCandidates,
      ARTIFACT_PATHS.metaOperatorFollowThrough,
      ARTIFACT_PATHS.campaignsIndex,
      ARTIFACT_PATHS.programsIndex,
      ARTIFACT_PATHS.programRuns,
      ARTIFACT_PATHS.programApprovals,
      ARTIFACT_PATHS.runtimeControllerState,
      ARTIFACT_PATHS.runtimeContinuation,
      ARTIFACT_PATHS.runtimeEvents,
      ARTIFACT_PATHS.runtimeResults,
      ARTIFACT_PATHS.workspaceIndex,
      materialized.packetPath
    ]),
    summary: `autonomy-operate used ${sourceFirst ? "existing proposal source" : "objective-derived proposal source"} ${source.sourceType}:${source.sourceId}, ran ${foreground.stepCount} bounded foreground step(s), and stopped at ${foreground.stopReason}.`
  };
}

export function runAutonomyForeground(root, args = {}) {
  assertGovernanceMutationRegistered("run-autonomy-foreground", "exempt");
  ensureWorkspace(root);
  const actorRole = args.actorRole ?? "planner";
  if (actorRole !== "planner") {
    throw new Error(`runAutonomyForeground currently supports only actorRole 'planner'. Received ${actorRole}.`);
  }
  const requestedSteps = Number.isInteger(args.maxSteps) ? args.maxSteps : Number(args.maxSteps);
  const maxSteps = Number.isFinite(requestedSteps) ? Math.max(1, Math.min(25, Math.trunc(requestedSteps))) : 5;
  const steps = [];
  let scopeFilter = normalizeForegroundScopeFilter(args);

  const first = runAutonomyControlPlaneOnce(root, { actorRole, ...scopeFilter });
  steps.push(first);

  let stopReason = first.outcome;
  let nextContinuation = readCurrentContinuation(root).items?.[0] ?? null;
  scopeFilter = nextForegroundScopeFilter(first, nextContinuation, scopeFilter);

  while (
    steps.length < maxSteps
    && steps.at(-1)?.status === "completed"
    && nextContinuation
    && scopeFilter
    && ["execute-materialized-packet", "continue-program-envelope"].includes(nextContinuation.kind)
  ) {
    const nextStep = runAutonomyControlPlaneOnce(root, { actorRole, ...scopeFilter });
    steps.push(nextStep);
    stopReason = nextStep.outcome;
    nextContinuation = readCurrentContinuation(root).items?.[0] ?? null;
    scopeFilter = nextForegroundScopeFilter(nextStep, nextContinuation, scopeFilter);
  }

  if (steps.length >= maxSteps && nextContinuation && ["execute-materialized-packet", "continue-program-envelope"].includes(nextContinuation.kind)) {
    stopReason = "max-steps-reached";
  }

  return {
    status: steps.every((step) => step.status === "completed") ? "completed" : steps.at(-1)?.status ?? "noop",
    actorRole,
    stepCount: steps.length,
    steps,
    stopReason,
    finalPacketId: steps.at(-1)?.packetId ?? null,
    nextContinuation,
    summary: `Foreground autonomy run executed ${steps.length} bounded delta${steps.length === 1 ? "" : "s"} and stopped at ${stopReason}.`
  };
}

function authorizationProgramSummary(programMutation, packetId) {
  if (programMutation?.allowedStepType === "refresh-wiki") {
    return `Executed one approved program-level wiki refresh for packet ${packetId} and wrote durable wiki surfaces before explicit review.`;
  }
  if (programMutation?.allowedStepType === "upsert-note") {
    return `Executed one approved program-level note capture for packet ${packetId} and wrote a durable source-linked note before explicit review.`;
  }
  if (programMutation?.allowedStepType === "run-experiment-audit") {
    return `Executed one approved program-level experiment audit for packet ${packetId} and wrote a durable audit record before explicit review.`;
  }
  if (programMutation?.allowedStepType === "bridge-result-to-claim") {
    return `Executed one approved program-level result-to-claim bridge for packet ${packetId} and wrote a durable bridge entry before explicit review.`;
  }
  if (programMutation?.allowedStepType === "run-review-loop") {
    return `Executed one approved program-level review loop for packet ${packetId} and wrote a durable review verdict before explicit review.`;
  }
  return `Executed one approved research program step for packet ${packetId} and refreshed the research brief before explicit review.`;
}

function authorizationProgramCheckpoint(programMutation, packetId) {
  if (programMutation?.allowedStepType === "refresh-wiki") {
    return `Program-linked wiki refreshed for ${packetId}.`;
  }
  if (programMutation?.allowedStepType === "upsert-note") {
    return `Program-linked note captured for ${packetId}.`;
  }
  if (programMutation?.allowedStepType === "run-experiment-audit") {
    return `Program-linked experiment audit completed for ${packetId}.`;
  }
  if (programMutation?.allowedStepType === "bridge-result-to-claim") {
    return `Program-linked result-to-claim bridge completed for ${packetId}.`;
  }
  if (programMutation?.allowedStepType === "run-review-loop") {
    return `Program-linked review loop completed for ${packetId}.`;
  }
  return `Program-linked research brief refreshed for ${packetId}.`;
}

function renderProgramResearchBrief(program = {}) {
  return [
    "# Research brief",
    "",
    `## Objective\n\n${program.objective ?? ""}`,
    "",
    "## Agenda",
    "",
    ...((program.agenda ?? []).length > 0 ? program.agenda.map((item) => `- ${item}`) : ["- No research agenda recorded."]),
    "",
    "## Evidence backlog",
    "",
    ...((program.evidenceBacklog ?? []).length > 0 ? program.evidenceBacklog.map((item) => `- ${item}`) : ["- No evidence backlog recorded."])
  ].join("\n");
}

function loadProgramOperatingState(root) {
  return {
    programs: normalizeProgramsIndex(readJson(root, ARTIFACT_PATHS.programsIndex, createProgramsIndex)),
    programRuns: normalizeProgramRunsIndex(readJson(root, ARTIFACT_PATHS.programRuns, createProgramRunsIndex)),
    programApprovals: normalizeProgramApprovalsIndex(readJson(root, ARTIFACT_PATHS.programApprovals, createProgramApprovalsIndex))
  };
}

function summarizeProgramItems(items = []) {
  return {
    programCount: items.length,
    activeCount: items.filter((item) => item.status === "active").length,
    blockedCount: items.filter((item) => item.status === "blocked").length,
    topProgramIds: items.slice(0, 8).map((item) => item.id),
    overview: items.length > 0
      ? `${items.length} research programs are tracked (${items.filter((item) => item.status === "active").length} active).`
      : "No research programs have been recorded yet.",
    programsPath: ARTIFACT_PATHS.programsIndex
  };
}

function summarizeProgramRunItems(items = []) {
  return {
    runCount: items.length,
    approvedCount: items.filter((item) => item.status === "approved").length,
    activeCount: items.filter((item) => item.status === "active").length,
    reviewNeededCount: items.filter((item) => item.status === "review-needed").length,
    blockedCount: items.filter((item) => item.status === "blocked").length,
    reviewCheckpointRunCount: items.filter((item) => item.reviewCheckpointRequired).length,
    topRunIds: items.slice(0, 8).map((item) => item.id),
    overview: items.length > 0
      ? `${items.length} program runs are tracked (${items.filter((item) => item.status === "approved").length} approved).`
      : "No approved program runs have been recorded yet.",
    runsPath: ARTIFACT_PATHS.programRuns
  };
}

function summarizeProgramApprovalItems(items = []) {
  return {
    approvalCount: items.length,
    approvedCount: items.filter((item) => item.status === "approved").length,
    revokedCount: items.filter((item) => item.status === "revoked").length,
    consumedCount: items.filter((item) => item.status === "consumed").length,
    topApprovalIds: items.slice(0, 8).map((item) => item.id),
    overview: items.length > 0
      ? `${items.length} program approvals are tracked (${items.filter((item) => item.status === "approved").length} approved).`
      : "No program approvals have been recorded yet.",
    approvalsPath: ARTIFACT_PATHS.programApprovals
  };
}

function writeProgramOperatingState(root, state) {
  writeJson(root, ARTIFACT_PATHS.programsIndex, {
    ...state.programs,
    summary: summarizeProgramItems(state.programs.items ?? []),
    updatedAt: nowIso()
  });
  writeJson(root, ARTIFACT_PATHS.programRuns, {
    ...state.programRuns,
    summary: summarizeProgramRunItems(state.programRuns.items ?? []),
    updatedAt: nowIso()
  });
  writeJson(root, ARTIFACT_PATHS.programApprovals, {
    ...state.programApprovals,
    summary: summarizeProgramApprovalItems(state.programApprovals.items ?? []),
    updatedAt: nowIso()
  });
}

function resolveProgramAuthorization(root, selected, actorRole) {
  const programId = selected.packet?.lineage?.programId ?? selected.packet?.materialization?.programId ?? selected.followThroughItem?.programId ?? null;
  const programRunId = selected.packet?.lineage?.programRunId ?? selected.packet?.materialization?.programRunId ?? selected.followThroughItem?.programRunId ?? null;
  const approvalId = selected.packet?.lineage?.approvalId ?? selected.packet?.materialization?.approvalId ?? selected.followThroughItem?.approvalId ?? null;
  if (!programId && !programRunId && !approvalId) {
    return null;
  }
  if (!programId || !programRunId || !approvalId) {
    return { valid: false, reason: "program-linkage-incomplete", programId, programRunId, approvalId };
  }
  const state = loadProgramOperatingState(root);
  const program = (state.programs.items ?? []).find((item) => item.id === programId) ?? null;
  const programRun = (state.programRuns.items ?? []).find((item) => item.id === programRunId && item.programId === programId) ?? null;
  const approval = (state.programApprovals.items ?? []).find((item) => item.id === approvalId && item.programId === programId && item.programRunId === programRunId) ?? null;
  if (!program || !programRun || !approval) {
    return { valid: false, reason: "program-linkage-missing", programId, programRunId, approvalId };
  }
  if (approval.status !== "approved") {
    return { valid: false, reason: "program-approval-not-approved", programId, programRunId, approvalId };
  }
  if (approval.expiresAt && String(approval.expiresAt) <= nowIso()) {
    return { valid: false, reason: "program-approval-expired", programId, programRunId, approvalId };
  }
  if (!programRun.packetIds?.includes(selected.packet.id)) {
    return { valid: false, reason: "program-run-packet-mismatch", programId, programRunId, approvalId };
  }
  if (programRun.controllerRole !== actorRole) {
    return { valid: false, reason: "program-controller-role-mismatch", programId, programRunId, approvalId };
  }
  if (programRun.workerRole !== selected.packet.assignedRole) {
    return { valid: false, reason: "program-worker-role-mismatch", programId, programRunId, approvalId };
  }
  if (programRun.reviewCheckpointRequired && programRun.status === "review-needed") {
    return { valid: false, reason: "program-run-awaiting-review", programId, programRunId, approvalId };
  }
  const authorityEnvelope = approval.authorityEnvelope ?? programRun.authorityEnvelope ?? null;
  const consumedStepCount = Math.max(
    Number(approval.authorityEnvelope?.consumedStepCount ?? 0),
    Number(programRun.authorityEnvelope?.consumedStepCount ?? 0)
  );
  const stepSequence = authorityEnvelope?.stepSequence ?? [];
  const currentStep = stepSequence[consumedStepCount] ?? null;
  const allowedStepType = normalizeAutonomyAllowedStepType(currentStep?.allowedStepType ?? approval.allowedStepType ?? programRun.allowedStepType, null);
  if (!allowedStepType) {
    return { valid: false, reason: "program-step-type-mismatch", programId, programRunId, approvalId };
  }
  if (!currentStep && (authorityEnvelope?.remainingStepCount ?? 0) <= 0) {
    return { valid: false, reason: "program-approval-exhausted", programId, programRunId, approvalId };
  }
  return {
    valid: true,
    programId,
    programRunId,
    approvalId,
    program,
    programRun,
    approval,
    authorityEnvelope,
    currentStepIndex: consumedStepCount,
    stepPayload: currentStep?.stepPayload ?? approval.stepPayload ?? programRun.stepPayload ?? null,
    state,
    allowedStepType,
    remainingStepCount: Math.max(0, Number(authorityEnvelope?.remainingStepCount ?? 1)),
    remainingStepCountAfterCurrent: Math.max(0, Number(authorityEnvelope?.remainingStepCount ?? 1) - 1)
  };
}

function resolvePlannedProgramAuthorization(root, follow, actorRole) {
  if (!follow?.programId && !follow?.programRunId && !follow?.approvalId) {
    return { valid: true, programId: null, programRunId: null, approvalId: null };
  }
  if (!follow?.programId || !follow?.programRunId || !follow?.approvalId) {
    return { valid: false };
  }
  const state = loadProgramOperatingState(root);
  const program = (state.programs.items ?? []).find((item) => item.id === follow.programId) ?? null;
  const programRun = (state.programRuns.items ?? []).find((item) => item.id === follow.programRunId && item.programId === follow.programId) ?? null;
  const approval = (state.programApprovals.items ?? []).find((item) => item.id === follow.approvalId && item.programId === follow.programId && item.programRunId === follow.programRunId) ?? null;
  if (!program || !programRun || !approval) {
    return { valid: false };
  }
  if (approval.status !== "approved" || (approval.expiresAt && String(approval.expiresAt) <= nowIso())) {
    return { valid: false };
  }
  const allowedStepType = normalizeAutonomyAllowedStepType(approval.allowedStepType ?? programRun.allowedStepType, null);
  if (programRun.controllerRole !== actorRole || !programRun.packetIds?.includes(follow.linkedTargetId) || !allowedStepType || (programRun.reviewCheckpointRequired && programRun.status === "review-needed")) {
    return { valid: false };
  }
  return { valid: true, programId: follow.programId, programRunId: follow.programRunId, approvalId: follow.approvalId };
}

function recordProgramRunOutcome(root, authorization, { runId, packetId, outcome, status, programStatus = null, closure = null }) {
  if (!authorization?.valid) {
    return null;
  }
  const timestamp = nowIso();
  const consumedStepCount = Math.max(0, Number(authorization.authorityEnvelope?.consumedStepCount ?? 0)) + (outcome === "executed-program-step" ? 1 : 0);
  const maxStepCount = Math.max(1, Number(authorization.authorityEnvelope?.maxStepCount ?? 1));
  const remainingStepCount = Math.max(0, maxStepCount - consumedStepCount);
  const nextAuthorityEnvelope = {
    ...(authorization.authorityEnvelope ?? { mode: "single-step", stepSequence: [{ allowedStepType: authorization.allowedStepType, stepPayload: authorization.stepPayload }], maxStepCount: 1, consumedStepCount: 0, remainingStepCount: 1 }),
    consumedStepCount,
    remainingStepCount
  };
  const nextStep = nextAuthorityEnvelope.stepSequence?.[consumedStepCount] ?? null;
  const requiresReviewCheckpoint = status === "review-needed" || (outcome === "executed-program-step" && remainingStepCount === 0);
  const terminalClosureStates = new Set(["achieved", "completed", "accepted-risk", "blocked", "superseded"]);
  const reviewCheckpointRequired = requiresReviewCheckpoint && !terminalClosureStates.has(closure?.runClosureState ?? null);
  const consumeApproval = reviewCheckpointRequired || (outcome === "executed-program-step" && remainingStepCount === 0);
  const reviewCheckpointSummary = reviewCheckpointRequired
    ? `Program run ${authorization.programRunId} requires explicit review before a fresh approval can authorize the next bounded step.`
    : null;
  const nextPrograms = (authorization.state.programs.items ?? []).map((item) => item.id === authorization.programId
    ? {
        ...item,
        activeRunId: authorization.programRunId,
        lastOutcome: outcome,
        status: item.status === "superseded" || item.closureState === "superseded"
          ? "superseded"
          : closure?.resolvedProgramStatus ?? programStatus ?? item.status,
        closureState: item.status === "superseded" || item.closureState === "superseded"
          ? "superseded"
          : closure?.programClosureState ?? item.closureState ?? "in-progress",
        closureReason: item.status === "superseded" || item.closureState === "superseded"
          ? item.closureReason ?? "The durable program state already marked this objective as superseded."
          : closure?.programClosureReason ?? item.closureReason ?? null,
        closureRecordedAt: item.status === "superseded" || item.closureState === "superseded"
          ? item.closureRecordedAt ?? timestamp
          : closure?.programClosureState ? timestamp : item.closureRecordedAt ?? null,
        updatedAt: timestamp
      }
    : item);
  const nextRuns = (authorization.state.programRuns.items ?? []).map((item) => item.id === authorization.programRunId
    ? {
        ...item,
        status: closure?.resolvedRunStatus ?? (requiresReviewCheckpoint ? "review-needed" : status),
        allowedStepType: nextStep?.allowedStepType ?? item.allowedStepType,
        stepPayload: nextStep?.stepPayload ?? item.stepPayload,
        authorityEnvelope: nextAuthorityEnvelope,
        closureState: closure?.runClosureState ?? item.closureState ?? "in-progress",
        closureReason: closure?.runClosureReason ?? item.closureReason ?? null,
        closureRecordedAt: closure?.runClosureState ? timestamp : item.closureRecordedAt ?? null,
        lastRuntimeRunId: runId,
        lastSelectedPacketId: packetId,
        lastOutcome: outcome,
        lastExecutedAt: timestamp,
        reviewCheckpointRequired,
        reviewCheckpointSummary,
        reviewCheckpointAt: reviewCheckpointRequired ? timestamp : null,
        reviewCheckpointPacketId: reviewCheckpointRequired ? packetId : null,
        reviewCheckpointRuntimeRunId: reviewCheckpointRequired ? runId : null,
        reviewCheckpointAllowedStepType: reviewCheckpointRequired ? authorization.allowedStepType : null,
        reviewRecommendedCommand: reviewCheckpointRequired ? "project:dove.lessons" : null,
        nextApprovalIntent: reviewCheckpointRequired
          ? {
               continuationFromRunId: authorization.programRunId,
               packetId,
               workerRole: authorization.programRun.workerRole,
                allowedStepType: authorization.allowedStepType,
                stepPayload: authorization.programRun.stepPayload ?? null,
                authorityEnvelope: {
                  mode: "single-step",
                  maxStepCount: 1,
                  consumedStepCount: 0,
                  remainingStepCount: 1,
                  stepSequence: [{
                    allowedStepType: authorization.allowedStepType,
                    stepPayload: authorization.programRun.stepPayload ?? null
                  }]
                },
                suggestedProgramRunId: `${authorization.programRunId}-next`,
                suggestedApprovalId: `${authorization.approvalId}-next`,
                summary: `Issue a fresh approval for ${authorization.allowedStepType} after reviewing packet ${packetId}.`,
                readyAt: timestamp
            }
          : null,
        updatedAt: timestamp
      }
    : item);
  const nextApprovals = (authorization.state.programApprovals.items ?? []).map((item) => item.id === authorization.approvalId
    ? {
        ...item,
        status: consumeApproval ? "consumed" : item.status,
        allowedStepType: nextStep?.allowedStepType ?? item.allowedStepType,
        stepPayload: nextStep?.stepPayload ?? item.stepPayload,
        authorityEnvelope: nextAuthorityEnvelope,
        consumedAt: consumeApproval ? timestamp : item.consumedAt ?? null,
        consumedByRuntimeRunId: consumeApproval ? runId : item.consumedByRuntimeRunId ?? null,
        consumedByPacketId: consumeApproval ? packetId : item.consumedByPacketId ?? null,
        updatedAt: timestamp
      }
    : item);
  writeProgramOperatingState(root, {
    programs: { ...authorization.state.programs, items: nextPrograms },
    programRuns: { ...authorization.state.programRuns, items: nextRuns },
    programApprovals: { ...authorization.state.programApprovals, items: nextApprovals }
  });
  const campaignReflection = reflectCampaignStepOutcome(root, {
    programId: authorization.programId,
    programRunId: authorization.programRunId,
    outputPaths: [ARTIFACT_PATHS.programRuns, ARTIFACT_PATHS.runtimeResults]
  });
  return {
    programId: authorization.programId,
    programRunId: authorization.programRunId,
    approvalId: authorization.approvalId,
    status: closure?.resolvedRunStatus ?? (requiresReviewCheckpoint ? "review-needed" : status),
    outcome,
    packetId,
    recordedAt: timestamp,
    remainingStepCount,
    authorityEnvelope: nextAuthorityEnvelope,
    closureState: closure?.runClosureState ?? null,
    closureReason: closure?.runClosureReason ?? null,
    programClosureState: closure?.programClosureState ?? null,
    programClosureReason: closure?.programClosureReason ?? null,
    campaignReflection
  };
}

function classifyProgramClosure(programMutation, boundary) {
  if (!boundary?.finalStep || Number(programMutation?.authorityEnvelope?.maxStepCount ?? 1) <= 1) {
    return {
      runClosureState: boundary?.resultStatus === "review-needed" ? "review-needed" : "in-progress",
      runClosureReason: boundary?.nextManualCheckpoint ?? null,
      programClosureState: "in-progress",
      programClosureReason: null,
      resolvedProgramStatus: null,
      resolvedRunStatus: null
    };
  }

  if (programMutation?.allowedStepType === "run-review-loop") {
    if (programMutation.reviewVerdict === "coherent") {
      return {
        runClosureState: "achieved",
        runClosureReason: "The final review-loop step returned a coherent verdict.",
        programClosureState: "achieved",
        programClosureReason: "The program reached a coherent review closure at the final bounded step.",
        resolvedProgramStatus: "achieved",
        resolvedRunStatus: "completed"
      };
    }
    return {
      runClosureState: "blocked",
      runClosureReason: `The final review-loop step returned ${programMutation.reviewVerdict ?? "a non-coherent verdict"}.`,
      programClosureState: "blocked",
      programClosureReason: `The program stopped at the final review boundary with verdict ${programMutation.reviewVerdict ?? "unknown"}.`,
      resolvedProgramStatus: "blocked",
      resolvedRunStatus: "review-needed"
    };
  }

  if (programMutation?.allowedStepType === "run-experiment-audit") {
    if (programMutation.auditVerdict === "clean") {
      return {
        runClosureState: "completed",
        runClosureReason: "The final experiment-audit step completed with a clean audit verdict.",
        programClosureState: "completed",
        programClosureReason: "The program completed its bounded audit objective cleanly.",
        resolvedProgramStatus: "active",
        resolvedRunStatus: "completed"
      };
    }
    return {
      runClosureState: "blocked",
      runClosureReason: `The final experiment-audit step ended with verdict ${programMutation.auditVerdict ?? "unknown"}.`,
      programClosureState: "blocked",
      programClosureReason: `The program stopped on an audit integrity blocker (${programMutation.auditVerdict ?? "unknown"}).`,
      resolvedProgramStatus: "blocked",
      resolvedRunStatus: "review-needed"
    };
  }

  if (programMutation?.allowedStepType === "bridge-result-to-claim") {
    if (programMutation.bridgeStatus === "applied" && programMutation.bridgeMapping === "supports") {
      return {
        runClosureState: "completed",
        runClosureReason: "The final bridge step applied cleanly and promoted supporting claim state.",
        programClosureState: "completed",
        programClosureReason: "The program completed its bounded result-to-claim bridge objective.",
        resolvedProgramStatus: "active",
        resolvedRunStatus: "completed"
      };
    }
    return {
      runClosureState: "accepted-risk",
      runClosureReason: `The final bridge step stopped with status ${programMutation.bridgeStatus ?? "unknown"} and mapping ${programMutation.bridgeMapping ?? "unknown"}.`,
      programClosureState: "accepted-risk",
      programClosureReason: `The program ended with a non-supporting or held bridge outcome (${programMutation.bridgeStatus ?? "unknown"}).`,
      resolvedProgramStatus: "accepted-risk",
      resolvedRunStatus: "review-needed"
    };
  }

  if (programMutation?.programStatusBefore === "superseded") {
    return {
      runClosureState: "superseded",
      runClosureReason: "The program was already marked superseded before the final bounded step closed.",
      programClosureState: "superseded",
      programClosureReason: "The durable program state already marked this objective as superseded.",
      resolvedProgramStatus: "superseded",
      resolvedRunStatus: "superseded"
    };
  }

  const objectiveAwareAchieved = objectiveSatisfiedByProgramMutation(programMutation);
  return objectiveAwareAchieved
    ? {
        runClosureState: "achieved",
        runClosureReason: `The final bounded ${programMutation?.allowedStepType ?? "program"} step satisfied the declared program objective.`,
        programClosureState: "achieved",
        programClosureReason: `The program objective was satisfied by the final ${programMutation?.allowedStepType ?? "program"} step.`,
        resolvedProgramStatus: "achieved",
        resolvedRunStatus: "completed"
      }
    : {
        runClosureState: "objective-unsatisfied",
        runClosureReason: `The final bounded ${programMutation?.allowedStepType ?? "program"} step completed, but it did not clearly satisfy the declared program objective.`,
        programClosureState: "objective-unsatisfied",
        programClosureReason: `The program exhausted its current bounded authority envelope without a clear match between the declared objective and the final ${programMutation?.allowedStepType ?? "program"} step.`,
        resolvedProgramStatus: "accepted-risk",
        resolvedRunStatus: "completed"
      };
}

function objectiveSatisfiedByProgramMutation(programMutation = {}) {
  const objective = String(programMutation.programObjective ?? "").toLowerCase();
  if (!objective) {
    return false;
  }
  const objectiveSignalsByStep = {
    "refresh-research-brief": ["research brief", "brief", "agenda", "objective"],
    "refresh-wiki": ["wiki", "query pack", "query-pack", "navigation"],
    "upsert-note": ["note", "notes", "capture evidence", "source-linked"],
    "run-experiment-audit": ["audit", "integrity", "experiment result"],
    "bridge-result-to-claim": ["bridge", "claim state", "result-to-claim", "promote claim"],
    "run-review-loop": ["review", "review loop", "coherent", "revision"]
  };
  const expectedSignals = objectiveSignalsByStep[programMutation.allowedStepType] ?? [];
  return expectedSignals.some((signal) => objective.includes(signal));
}

function resolveProgramExecutionBoundary(authorization, recordedAt, packetId) {
  const remainingStepCountAfterCurrent = Math.max(0, Number(authorization?.remainingStepCountAfterCurrent ?? 0));
  if (remainingStepCountAfterCurrent > 0) {
    return {
      continuationStatus: "ready-to-resume",
      lifecycleStatus: "waiting",
      followThroughStatus: "executing",
      followThroughClosureReason: null,
      followThroughClosureArtifactPaths: [],
      resultStatus: "active",
      finalStep: false,
      nextManualCheckpoint: `Program-scoped autonomy envelope can continue for packet ${packetId}; ${remainingStepCountAfterCurrent} bounded approved step(s) remain in the current authority window.`,
      summary: `Executed one approved program step for packet ${packetId}; ${remainingStepCountAfterCurrent} bounded approved step(s) remain in the current program-scoped authority envelope.`
    };
  }
  return {
    continuationStatus: "review-needed",
    lifecycleStatus: "review-needed",
    followThroughStatus: "closed",
    followThroughClosureReason: "Bounded autonomous worker step completed and handed off for explicit review.",
    followThroughClosureArtifactPaths: [],
    resultStatus: "review-needed",
    finalStep: true,
    nextManualCheckpoint: `Program run exhausted its current authority envelope for packet ${packetId} and now requires explicit review before any fresh approval.`,
    summary: `Executed one approved program step for packet ${packetId} and exhausted the current authority envelope at an explicit review boundary.`
  };
}

function applyApprovedProgramStep(root, selected, authorization) {
  if (!authorization?.valid) {
    return null;
  }
  if (authorization.allowedStepType === "refresh-research-brief") {
    assertTaskScopedMutationTarget(root, "update-research-brief", { packetId: selected.packet.id });
    const timestamp = nowIso();
    const nextAgenda = {
      version: 1,
      objective: authorization.program.objective || readJson(root, ARTIFACT_PATHS.researchAgenda, createResearchAgenda).objective,
      agenda: authorization.program.agenda ?? [],
      evidenceBacklog: authorization.program.evidenceBacklog ?? [],
      updatedAt: timestamp
    };
    writeJson(root, ARTIFACT_PATHS.researchAgenda, nextAgenda);
    writeText(root, ARTIFACT_PATHS.researchBrief, renderProgramResearchBrief(nextAgenda));
    return {
      programId: authorization.programId,
      programRunId: authorization.programRunId,
      approvalId: authorization.approvalId,
      authorityEnvelope: authorization.authorityEnvelope,
      programObjective: authorization.program.objective ?? "",
      programStatusBefore: authorization.program.status ?? "active",
      allowedStepType: authorization.allowedStepType,
      researchBriefPath: ARTIFACT_PATHS.researchBrief,
      researchAgendaPath: ARTIFACT_PATHS.researchAgenda,
      packetId: selected.packet.id,
      recordedAt: timestamp
    };
  }
  if (authorization.allowedStepType === "refresh-wiki") {
    const timestamp = nowIso();
    const result = refreshWiki(root, { skipFollowThroughReady: true });
    return {
      programId: authorization.programId,
      programRunId: authorization.programRunId,
      approvalId: authorization.approvalId,
      authorityEnvelope: authorization.authorityEnvelope,
      programObjective: authorization.program.objective ?? "",
      programStatusBefore: authorization.program.status ?? "active",
      allowedStepType: authorization.allowedStepType,
      wikiPath: result.wikiPath,
      wikiEntitiesPath: ARTIFACT_PATHS.wikiEntities,
      wikiRelationsPath: ARTIFACT_PATHS.wikiRelations,
      queryPackPath: ARTIFACT_PATHS.queryPack,
      packetId: selected.packet.id,
      recordedAt: timestamp
    };
  }
  if (authorization.allowedStepType === "upsert-note") {
    const timestamp = nowIso();
    const payload = authorization.stepPayload ?? authorization.programRun.stepPayload ?? authorization.approval.stepPayload ?? null;
    if (!payload) {
      return null;
    }
    const note = upsertNote(root, {
      packetId: selected.packet.id,
      noteId: `${selected.packet.id}-program-note`,
      title: payload.title,
      sectionId: payload.sectionId,
      sourceIds: payload.sourceIds,
      summary: payload.summary,
      quotes: payload.quotes,
      claims: payload.claims,
      openQuestions: payload.openQuestions,
      skipFollowThroughReady: true,
      skipSyncPhase: true
    });
    return {
      programId: authorization.programId,
      programRunId: authorization.programRunId,
      approvalId: authorization.approvalId,
      authorityEnvelope: authorization.authorityEnvelope,
      programObjective: authorization.program.objective ?? "",
      programStatusBefore: authorization.program.status ?? "active",
      allowedStepType: authorization.allowedStepType,
      noteId: note.id,
      notesPath: ARTIFACT_PATHS.notes,
      queryPackPath: ARTIFACT_PATHS.queryPack,
      packetId: selected.packet.id,
      recordedAt: timestamp
    };
  }
  if (authorization.allowedStepType === "run-experiment-audit") {
    const timestamp = nowIso();
    const payload = authorization.stepPayload ?? null;
    if (!payload) {
      return null;
    }
    assertTaskScopedMutationTarget(root, "run-experiment-audit", { packetId: selected.packet.id });
    const audit = persistExperimentAudit(root, {
      resultId: payload.resultId,
      reviewedArtifactRefs: payload.reviewedArtifactRefs ?? []
    });
    return {
      programId: authorization.programId,
      programRunId: authorization.programRunId,
      approvalId: authorization.approvalId,
      authorityEnvelope: authorization.authorityEnvelope,
      programObjective: authorization.program.objective ?? "",
      programStatusBefore: authorization.program.status ?? "active",
      allowedStepType: authorization.allowedStepType,
      auditId: audit.id,
      auditVerdict: audit.auditVerdict ?? null,
      bridgeReadiness: audit.bridgeReadiness ?? null,
      experimentAuditsPath: ARTIFACT_PATHS.experimentAudits,
      packetId: selected.packet.id,
      recordedAt: timestamp
    };
  }
  if (authorization.allowedStepType === "bridge-result-to-claim") {
    const timestamp = nowIso();
    const payload = authorization.stepPayload ?? authorization.programRun.stepPayload ?? authorization.approval.stepPayload ?? null;
    if (!payload) {
      return null;
    }
    assertTaskScopedMutationTarget(root, "bridge-experiment-result-to-claim", { packetId: selected.packet.id });
    const bridgeEvent = persistExperimentResultClaimBridge(root, {
      resultId: payload.resultId,
      auditIds: payload.auditIds ?? [],
      reason: payload.reason
    });
    return {
      programId: authorization.programId,
      programRunId: authorization.programRunId,
      approvalId: authorization.approvalId,
      authorityEnvelope: authorization.authorityEnvelope,
      programObjective: authorization.program.objective ?? "",
      programStatusBefore: authorization.program.status ?? "active",
      allowedStepType: authorization.allowedStepType,
      claimBridgeId: bridgeEvent.id,
      bridgeStatus: bridgeEvent.bridgeStatus ?? null,
      bridgeMapping: bridgeEvent.mapping ?? null,
      auditVerdict: bridgeEvent.auditVerdict ?? null,
      claimBridgePath: ARTIFACT_PATHS.claimBridgeLog,
      packetId: selected.packet.id,
      recordedAt: timestamp
    };
  }
  if (authorization.allowedStepType === "run-review-loop") {
    const timestamp = nowIso();
    const payload = authorization.stepPayload ?? authorization.programRun.stepPayload ?? authorization.approval.stepPayload ?? null;
    if (!payload) {
      return null;
    }
    assertTaskScopedMutationTarget(root, "run-review-loop", { packetId: selected.packet.id, scope: payload.scope, stage: payload.stage });
    const reviewEntry = persistReviewLoop(root, {
      scope: payload.scope,
      stage: payload.stage,
      skipBoardUpdate: true,
      skipRefreshDurableSurfaces: true,
      skipRebuttalBoardUpdate: true
    });
    return {
      programId: authorization.programId,
      programRunId: authorization.programRunId,
      approvalId: authorization.approvalId,
      authorityEnvelope: authorization.authorityEnvelope,
      programObjective: authorization.program.objective ?? "",
      programStatusBefore: authorization.program.status ?? "active",
      allowedStepType: authorization.allowedStepType,
      reviewVerdict: reviewEntry.verdict,
      reviewLogPath: ARTIFACT_PATHS.reviewLog,
      reviewStatePath: ARTIFACT_PATHS.reviewState,
      revisionPlanPath: ARTIFACT_PATHS.revisionPlan,
      packetId: selected.packet.id,
      recordedAt: timestamp
    };
  }
  return null;
}

function selectFollowThroughItem(index, followThroughId) {
  return (index.items ?? []).find((item) => item.id === followThroughId) ?? null;
}

function executeBoundedPacketStep(root, selected, { runId, actorRole }) {
  const attemptStartedAt = nowIso();
  const envelope = resolveAutonomyEnvelope(selected.packet, selected.followThroughItem, actorRole);
  const programMutation = selected.programAuthorization?.valid && selected.packet.lifecycleStatus !== "stale"
    ? applyApprovedProgramStep(root, selected, selected.programAuthorization)
    : null;
  const previousRetryState = normalizeWorkerRetryState(selected.followThroughItem.retryState);
  const nextRetryState = {
    ...previousRetryState,
    attemptCount: previousRetryState.attemptCount + 1,
    lastAttemptAt: attemptStartedAt,
    lastError: null,
    escalatedAt: previousRetryState.escalatedAt ?? null
  };

  recordOperatorFollowThrough(root, {
    id: selected.followThroughItem.id,
    sourceType: selected.followThroughItem.sourceType,
    sourceId: selected.followThroughItem.sourceId,
    actorRole,
    workerRole: envelope?.workerRole ?? null,
    status: "executing",
    decisionSummary: `Started bounded autonomous worker step for packet ${selected.packet.id}.`,
    rationale: selected.followThroughItem.rationale ?? "",
    selectedConversionPathKey: selected.followThroughItem.selectedConversionPathKey,
    linkedTargetArtifact: selected.packet.packetPath,
    linkedTargetId: selected.packet.id,
    executeBy: selected.followThroughItem.executeBy,
    reviewAfter: selected.followThroughItem.reviewAfter,
    executionStartedAt: selected.followThroughItem.executionStartedAt ?? attemptStartedAt,
    retryState: nextRetryState
  });

  if (selected.packet.lifecycleStatus === "stale") {
    const recordedAt = nowIso();
    const shouldEscalate = nextRetryState.attemptCount >= nextRetryState.maxAttempts;
    const failureSummary = shouldEscalate
      ? `Autonomous worker step exhausted retry budget for packet ${selected.packet.id}; human escalation is now required.`
      : `Autonomous worker step deferred packet ${selected.packet.id} because its context is stale and needs refresh before the next attempt.`;
    const nextPacket = persistPacketWorkerCheckpoint(root, selected.packet, {
      runId,
      timestamp: recordedAt,
      summary: failureSummary,
      continuationStatus: shouldEscalate ? "blocked" : "retry-pending",
      lifecycleStatus: selected.packet.lifecycleStatus
    });
    const followThrough = recordOperatorFollowThrough(root, {
      id: selected.followThroughItem.id,
      sourceType: selected.followThroughItem.sourceType,
      sourceId: selected.followThroughItem.sourceId,
      actorRole,
      workerRole: envelope?.workerRole ?? null,
      status: shouldEscalate ? "deferred" : "executing",
      decisionSummary: failureSummary,
      rationale: selected.followThroughItem.rationale ?? "",
      selectedConversionPathKey: selected.followThroughItem.selectedConversionPathKey,
      linkedTargetArtifact: nextPacket.packetPath,
      linkedTargetId: nextPacket.id,
      executeBy: selected.followThroughItem.executeBy,
      reviewAfter: selected.followThroughItem.reviewAfter,
      executionStartedAt: attemptStartedAt,
      deferUntil: shouldEscalate ? recordedAt : null,
      retryState: {
        ...nextRetryState,
        lastError: "Packet remains stale and needs refreshed context before bounded autonomous execution can continue.",
        escalatedAt: shouldEscalate ? recordedAt : nextRetryState.escalatedAt
      }
    });
    const followThroughItem = selectFollowThroughItem(followThrough, selected.followThroughItem.id);
    const programSnapshot = selected.programAuthorization?.valid
      ? recordProgramRunOutcome(root, selected.programAuthorization, {
          runId,
          packetId: selected.packet.id,
          outcome: shouldEscalate ? "worker-step-escalated" : "worker-step-retry-pending",
          status: shouldEscalate ? "blocked" : "active",
          programStatus: shouldEscalate ? "blocked" : null
        })
      : null;
    return {
      outcome: shouldEscalate ? "worker-step-escalated" : "worker-step-retry-pending",
      eventType: shouldEscalate ? "step-escalated" : "step-retry-pending",
      recordedAt,
      summary: failureSummary,
      packetSnapshot: snapshotPacket(nextPacket),
      followThroughSnapshot: snapshotFollowThrough(followThroughItem),
      programSnapshot,
      checkpointSnapshot: snapshotCheckpoint(nextPacket, {
        summary: nextPacket.continuationState?.lastCheckpoint ?? failureSummary,
        recordedAt,
        continuationStatus: nextPacket.continuationState?.status ?? null
      }),
      escalationSnapshot: shouldEscalate
        ? snapshotEscalation(nextPacket, followThroughItem, { summary: failureSummary, recordedAt })
        : null,
      retryState: followThroughItem.retryState,
      nextManualCheckpoint: nextPacket.continuationState?.lastCheckpoint ?? failureSummary
    };
  }

  const recordedAt = nowIso();
  const successSummary = `Executed one bounded autonomous worker step for packet ${selected.packet.id} and wrote a review checkpoint for the next explicit handoff.`;
  const programBoundary = programMutation
    ? resolveProgramExecutionBoundary(selected.programAuthorization, recordedAt, selected.packet.id)
    : null;
  const closure = programMutation ? classifyProgramClosure(programMutation, programBoundary) : null;
  const nextPacket = persistPacketWorkerCheckpoint(root, selected.packet, {
    runId,
    timestamp: recordedAt,
    summary: closure?.runClosureReason ?? programBoundary?.nextManualCheckpoint ?? successSummary,
    continuationStatus: programBoundary?.continuationStatus ?? "review-needed",
    lifecycleStatus: programBoundary?.lifecycleStatus ?? "review-needed"
  });
  const resolvedFollowThroughStatus = programBoundary?.followThroughStatus ?? "closed";
  const followThrough = recordOperatorFollowThrough(root, {
    id: selected.followThroughItem.id,
    sourceType: selected.followThroughItem.sourceType,
    sourceId: selected.followThroughItem.sourceId,
    actorRole,
    workerRole: envelope?.workerRole ?? null,
    status: resolvedFollowThroughStatus,
    decisionSummary: closure?.runClosureReason ?? programBoundary?.summary ?? successSummary,
    rationale: selected.followThroughItem.rationale ?? "",
    selectedConversionPathKey: selected.followThroughItem.selectedConversionPathKey,
    linkedTargetArtifact: nextPacket.packetPath,
    linkedTargetId: nextPacket.id,
    executeBy: selected.followThroughItem.executeBy,
    reviewAfter: selected.followThroughItem.reviewAfter,
    executionStartedAt: attemptStartedAt,
    executionCompletedAt: resolvedFollowThroughStatus === "closed" ? recordedAt : null,
    closureReason: programBoundary?.followThroughClosureReason ?? "Bounded autonomous worker step completed and handed off for explicit review.",
    closureArtifactPaths: resolvedFollowThroughStatus === "closed"
      ? [nextPacket.packetPath, ARTIFACT_PATHS.taskPacketsIndex].concat(programBoundary?.followThroughClosureArtifactPaths ?? [])
      : [],
    retryState: nextRetryState
  });
  const followThroughItem = selectFollowThroughItem(followThrough, selected.followThroughItem.id);
  const programSnapshot = selected.programAuthorization?.valid
      ? recordProgramRunOutcome(root, selected.programAuthorization, {
          runId,
          packetId: selected.packet.id,
          outcome: programMutation ? "executed-program-step" : "executed-one-packet-step",
          status: programBoundary?.resultStatus ?? "review-needed",
          programStatus: closure?.resolvedProgramStatus ?? "active",
          closure
        })
    : null;
  return {
    outcome: programMutation ? "executed-program-step" : "executed-one-packet-step",
    eventType: "step-executed",
    recordedAt,
    summary: programMutation
      ? closure?.runClosureReason ?? programBoundary?.summary ?? authorizationProgramSummary(programMutation, selected.packet.id)
      : successSummary,
    packetSnapshot: snapshotPacket(nextPacket),
    followThroughSnapshot: snapshotFollowThrough(followThroughItem),
    programSnapshot,
    checkpointSnapshot: snapshotCheckpoint(nextPacket, {
      summary: nextPacket.continuationState?.lastCheckpoint ?? (programMutation ? authorizationProgramCheckpoint(programMutation, selected.packet.id) : successSummary),
      recordedAt,
      continuationStatus: nextPacket.continuationState?.status ?? null
    }),
    escalationSnapshot: null,
    retryState: followThroughItem.retryState,
    nextManualCheckpoint: nextPacket.continuationState?.lastCheckpoint ?? (programMutation ? authorizationProgramCheckpoint(programMutation, selected.packet.id) : successSummary),
    programMutation
  };
}

function compareNullableIso(a, b) {
  if (!a && !b) {
    return 0;
  }
  if (!a) {
    return 1;
  }
  if (!b) {
    return -1;
  }
  return a.localeCompare(b);
}

function compareStrings(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function buildArbitrationSnapshot({
  candidateFamily,
  tieBreakPolicy,
  rankedCandidates,
  selectedCandidate,
  selectionReason,
  leaseSkippedPacketIds = []
}) {
  return {
    candidateFamily,
    rankingPolicy: RUN_ONCE_SELECTION_POLICY,
    tieBreakPolicy,
    candidateCount: rankedCandidates.length,
    rankedPacketIds: rankedCandidates.map((candidate) => candidate.packet?.id ?? candidate.packetId ?? null).filter(Boolean),
    selectedPacketId: selectedCandidate?.packet?.id ?? selectedCandidate?.packetId ?? null,
    selectedFollowThroughId: selectedCandidate?.followThroughItem?.id ?? selectedCandidate?.followThroughId ?? null,
    selectedEnvelopeRole: selectedCandidate?.envelope?.workerRole ?? null,
    leaseSkippedPacketIds,
    selectionReason
  };
}

function rankEligibleCandidates(workspaceIndex, eligible) {
  const priorityIndex = new Map(uniqueStrings(workspaceIndex.resumeGuidance?.prioritizedPacketIds ?? []).map((packetId, index) => [packetId, index]));
  return [...eligible].sort((left, right) => {
    const leftPriority = priorityIndex.get(left.packet.id) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priorityIndex.get(right.packet.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    const executeByComparison = compareNullableIso(left.followThroughItem?.executeBy ?? null, right.followThroughItem?.executeBy ?? null);
    if (executeByComparison !== 0) {
      return executeByComparison;
    }
    const reviewAfterComparison = compareNullableIso(left.followThroughItem?.reviewAfter ?? null, right.followThroughItem?.reviewAfter ?? null);
    if (reviewAfterComparison !== 0) {
      return reviewAfterComparison;
    }
    const packetComparison = compareStrings(left.packet?.id, right.packet?.id);
    if (packetComparison !== 0) {
      return packetComparison;
    }
    return compareStrings(left.followThroughItem?.id, right.followThroughItem?.id);
  });
}

function rankMaterializationCandidates(materializationCandidates) {
  return [...materializationCandidates].sort((left, right) => {
    const executeByComparison = compareNullableIso(left.executeBy ?? null, right.executeBy ?? null);
    if (executeByComparison !== 0) {
      return executeByComparison;
    }
    const reviewAfterComparison = compareNullableIso(left.reviewAfter ?? null, right.reviewAfter ?? null);
    if (reviewAfterComparison !== 0) {
      return reviewAfterComparison;
    }
    const packetComparison = compareStrings(left.packetId, right.packetId);
    if (packetComparison !== 0) {
      return packetComparison;
    }
    const sourceComparison = compareStrings(left.sourceId, right.sourceId);
    if (sourceComparison !== 0) {
      return sourceComparison;
    }
    return compareStrings(left.followThroughId, right.followThroughId);
  });
}

function selectStableSameSourceCandidates(candidates = []) {
  const bestBySource = new Map();
  const sourceKeyFor = (candidate) => candidate.packet?.materialization?.sourceType && candidate.packet?.materialization?.sourceId
    ? `${candidate.packet.materialization.sourceType}:${candidate.packet.materialization.sourceId}`
    : null;
  for (const candidate of candidates) {
    const sourceKey = sourceKeyFor(candidate);
    if (!sourceKey || !candidate.eligible) {
      continue;
    }
    const existing = bestBySource.get(sourceKey);
    if (!existing) {
      bestBySource.set(sourceKey, candidate);
      continue;
    }
    const createdComparison = compareNullableIso(
      existing.followThroughItem?.createdAt ?? existing.followThroughItem?.recordedAt ?? existing.packet?.updatedAt ?? null,
      candidate.followThroughItem?.createdAt ?? candidate.followThroughItem?.recordedAt ?? candidate.packet?.updatedAt ?? null
    );
    if (createdComparison < 0 || (createdComparison === 0 && compareStrings(existing.followThroughItem?.id, candidate.followThroughItem?.id) < 0)) {
      bestBySource.set(sourceKey, candidate);
    }
  }
  const selectedBySource = new Set(Array.from(bestBySource.values()).map((candidate) => candidate.packet.id));
  return candidates.map((candidate) => {
    const sourceKey = sourceKeyFor(candidate);
    if (!sourceKey || !candidate.eligible || selectedBySource.has(candidate.packet.id)) {
      return candidate;
    }
    return {
      ...candidate,
      reasons: [...candidate.reasons, "same-source-candidate-superseded"],
      eligible: false
    };
  });
}

function buildSelectionSet(root, actorRole, filters = {}) {
  const workspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, null);
  const taskPacketIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, { items: [] });
  const followThrough = readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, { items: [] });
  const packetsById = new Map((taskPacketIndex.items ?? []).map((packet) => [packet.id, packet]));
  const followThroughById = new Map((followThrough.items ?? []).map((item) => [item.id, item]));
  const prioritizedIds = uniqueStrings([
    ...(workspaceIndex.resumeGuidance?.prioritizedPacketIds ?? []),
    ...(taskPacketIndex.items ?? []).map((packet) => packet.id)
  ]);

  const candidates = selectStableSameSourceCandidates(prioritizedIds.map((packetId) => {
    const packet = packetsById.get(packetId);
    const followThroughId = packet?.materialization?.followThroughId ?? null;
    const followThroughItem = followThroughId ? followThroughById.get(followThroughId) ?? null : null;
    const envelope = resolveAutonomyEnvelope(packet ?? {}, followThroughItem, actorRole);
    const programAuthorization = packet && followThroughItem ? resolveProgramAuthorization(root, { packet, followThroughItem }, actorRole) : null;
    const reasons = [];

    if (!packet) {
      reasons.push("missing-packet");
    }
    if (packet?.sourceType !== "materialized-guidance") {
      reasons.push("source-type-mismatch");
    }
    if (envelope) {
      if (envelope.controllerRole !== actorRole) {
        reasons.push("envelope-controller-role-mismatch");
      }
      if (packet?.assignedRole !== envelope.workerRole) {
        reasons.push("envelope-worker-role-mismatch");
      }
      if (followThroughItem?.actorRole && followThroughItem.actorRole !== actorRole) {
        reasons.push("follow-through-controller-role-mismatch");
      }
      if (followThroughItem?.workerRole && followThroughItem.workerRole !== envelope.workerRole) {
        reasons.push("follow-through-worker-role-mismatch");
      }
    } else if (packet?.assignedRole !== actorRole) {
      reasons.push("assigned-role-mismatch");
    } else if (followThroughItem?.actorRole && followThroughItem.actorRole !== actorRole) {
      reasons.push("follow-through-controller-role-mismatch");
    }
    if (!packet?.active) {
      reasons.push("inactive-packet");
    }
    if (packet && !ELIGIBLE_LIFECYCLES.has(packet.lifecycleStatus)) {
      reasons.push("lifecycle-not-eligible");
    }
    if ((packet?.dependencyHealth?.state ?? "clear") !== "clear") {
      reasons.push("dependency-blocked");
    }
    if (!followThroughId) {
      reasons.push("missing-follow-through-link");
    }
    if (!followThroughItem) {
      reasons.push("missing-follow-through-record");
    }
    if (followThroughItem && !["accepted-for-execution", "executing"].includes(followThroughItem.status)) {
      reasons.push("follow-through-not-executable");
    }
    if (followThroughItem && !followThroughItem.targetBound) {
      reasons.push("follow-through-target-unbound");
    }
    if (followThroughItem?.stale) {
      reasons.push("follow-through-stale");
    }
    if (followThroughItem?.invalidStatus) {
      reasons.push("follow-through-invalid");
    }
    const retryState = normalizeWorkerRetryState(followThroughItem?.retryState);
    if (followThroughItem?.retryState && (retryState.escalatedAt || retryState.attemptCount >= retryState.maxAttempts)) {
      reasons.push("follow-through-retry-exhausted");
    }
    if (programAuthorization && !programAuthorization.valid) {
      reasons.push(programAuthorization.reason);
    }

    return {
      packet,
      followThroughItem,
      envelope,
      programAuthorization,
      reasons,
      eligible: reasons.length === 0
    };
  })).filter((candidate) => candidate.packet)
    .filter((candidate) => !filters.packetId || candidate.packet.id === filters.packetId)
    .filter((candidate) => !filters.programRunId || candidate.programAuthorization?.programRunId === filters.programRunId || candidate.packet.lineage?.programRunId === filters.programRunId)
    .filter((candidate) => !filters.approvalId || candidate.programAuthorization?.approvalId === filters.approvalId || candidate.packet.lineage?.approvalId === filters.approvalId);

  return { workspaceIndex, candidates };
}

function createNoopResult({ runId, actorRole, outcome, summary, startedAt, packetId = null, leaseId = null, details = {} }) {
  return {
    runId,
    status: "noop",
    outcome,
    actorRole,
    packetId,
    leaseId,
    summary,
    startedAt,
    ...details
  };
}

function buildMaterializationCandidates(root, actorRole, filters = {}) {
  const meta = queryMetaOptimize(root);
  const existingPacketIds = new Set((readJson(root, ARTIFACT_PATHS.taskPacketsIndex, { items: [] }).items ?? []).map((packet) => packet.id));

  const canonicalPacketPath = (packetId) => `${ARTIFACT_PATHS.taskPacketsPacketsDir}/${packetId}.json`;
  const resolvePlannedIntent = (follow) => {
    if (follow.sourceType === "remediation-pack") {
      const pack = (meta.remediationPacks.packs ?? []).find((item) => item.id === follow.sourceId);
      if (!pack) {
        return null;
      }
      const selectedPath = follow.selectedConversionPathKey
        ? (pack.rankedConversionPaths ?? []).find((item) => item.deterministicKey === follow.selectedConversionPathKey)
        : null;
      if (follow.selectedConversionPathKey && !selectedPath) {
        return null;
      }
      const selectedCreateNewPacketPath = selectedPath?.targetType === "create-new-packet"
        ? selectedPath
        : null;
      if (follow.selectedConversionPathKey && !selectedCreateNewPacketPath) {
        return null;
      }
      const packetPath = selectedCreateNewPacketPath
        ?? (pack.rankedConversionPaths ?? []).find((item) => item.targetType === "create-new-packet")
        ?? null;
      if (!packetPath) {
        return null;
      }
      return {
        packetId: follow.linkedTargetId,
        selectedConversionPathKey: packetPath.deterministicKey ?? follow.selectedConversionPathKey ?? null
      };
    }
    if (follow.sourceType === "execution-bridge") {
      const candidate = (meta.executionBridgeCandidates.candidates ?? []).find((item) => item.id === follow.sourceId);
      if (!candidate) {
        return null;
      }
      if (candidate.candidateType !== "packet-candidate" || candidate.sourceConversionPath?.targetType !== "create-new-packet") {
        return null;
      }
      if (candidate.targetId !== follow.linkedTargetId) {
        return null;
      }
      return {
        packetId: follow.linkedTargetId,
        selectedConversionPathKey: follow.selectedConversionPathKey ?? null
      };
    }
    return null;
  };

  return (meta.operatorFollowThrough.items ?? []).flatMap((follow) => {
    if (!follow || follow.status !== "accepted-for-execution" || follow.actorRole !== actorRole || !follow.plannedTarget || follow.targetBound) {
      return [];
    }
    if (follow.stale || follow.invalidStatus) {
      return [];
    }
    if (!follow.linkedTargetId || !follow.linkedTargetArtifact || !follow.executeBy || !follow.reviewAfter) {
      return [];
    }
    if (follow.linkedTargetArtifact !== canonicalPacketPath(follow.linkedTargetId) || existingPacketIds.has(follow.linkedTargetId)) {
      return [];
    }
    const intent = resolvePlannedIntent(follow);
    if (!intent) {
      return [];
    }
    const plannedProgramAuthorization = resolvePlannedProgramAuthorization(root, follow, actorRole);
    if (!plannedProgramAuthorization.valid) {
      return [];
    }
    return [{
      sourceType: follow.sourceType,
      sourceId: follow.sourceId,
      actorRole,
      packetId: intent.packetId,
      followThroughId: follow.id,
      programId: plannedProgramAuthorization.programId,
      programRunId: plannedProgramAuthorization.programRunId,
      approvalId: plannedProgramAuthorization.approvalId,
      selectedConversionPathKey: intent.selectedConversionPathKey,
      executeBy: follow.executeBy,
      reviewAfter: follow.reviewAfter,
      summary: `Materialize accepted ${follow.sourceType} ${follow.sourceId} into packet ${intent.packetId}.`
    }].filter((candidate) => !filters.packetId || candidate.packetId === filters.packetId)
      .filter((candidate) => !filters.programRunId || candidate.programRunId === filters.programRunId)
      .filter((candidate) => !filters.approvalId || candidate.approvalId === filters.approvalId);
  });
}

export function runAutonomyControlPlaneOnce(root, args = {}) {
  assertGovernanceMutationRegistered("run-autonomy-control-plane-once", "exempt");
  ensureWorkspace(root);

  const actorRole = String(args.actorRole ?? "planner").trim() || "planner";
  if (actorRole !== "planner") {
    throw new Error("runAutonomyControlPlaneOnce currently supports only actorRole 'planner'.");
  }

  const runId = buildRunId();
  const startedAt = nowIso();
  const artifacts = loadRuntimeArtifacts(root);
  expireStaleLeases(artifacts, startedAt);
  appendEvent(artifacts, {
    id: `runtime-event-${crypto.randomUUID()}`,
    runId,
    eventType: "run-invoked",
    actorRole,
    packetId: null,
    leaseId: null,
    summary: "Invoked the autonomous control-plane run-once controller.",
    recordedAt: startedAt
  });
  saveRuntimeArtifacts(root, artifacts);

  refreshDurableSurfaces(root, {
    type: "autonomy-control-plane-preflight",
    summary: "Refreshed durable surfaces before autonomous control-plane selection.",
    artifactPaths: [ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.runtimeControllerState, ARTIFACT_PATHS.runtimeLeases, ARTIFACT_PATHS.runtimeEvents, ARTIFACT_PATHS.runtimeResults]
  });

  const scopeFilter = normalizeForegroundScopeFilter(args);
  const { workspaceIndex, candidates } = buildSelectionSet(root, actorRole, scopeFilter);
  const eligible = candidates.filter((candidate) => candidate.eligible);
  if (eligible.length === 0) {
    const materializationCandidates = buildMaterializationCandidates(root, actorRole, scopeFilter);
    if (materializationCandidates.length >= 1) {
      const rankedMaterializationCandidates = rankMaterializationCandidates(materializationCandidates);
      const candidate = rankedMaterializationCandidates[0];
      const arbitration = buildArbitrationSnapshot({
        candidateFamily: "planned-materializations",
        tieBreakPolicy: MATERIALIZATION_TIE_BREAK_POLICY,
        rankedCandidates: rankedMaterializationCandidates,
        selectedCandidate: candidate,
        selectionReason: rankedMaterializationCandidates.length > 1
          ? `Selected packet ${candidate.packetId} deterministically from ${rankedMaterializationCandidates.length} planned materialization candidates.`
          : `Selected the only planned materialization candidate for packet ${candidate.packetId}.`
      });
      try {
        const materialized = materializeGuidancePacket(root, candidate);
        assertTaskScopedMutationTarget(root, "run-autonomy-control-plane-once", { packetId: materialized.packetId });
        const requestSnapshot = buildAutonomyRequestSnapshot(root);
        const recordedAt = nowIso();
        const resultEntry = {
          runId,
          status: "completed",
          outcome: "materialized-one-packet",
          actorRole,
          packetId: materialized.packetId,
          followThroughId: materialized.followThroughId,
          leaseId: null,
          selectionPolicy: RUN_ONCE_SELECTION_POLICY,
          boundedStepPolicy: "planner-control-plane-materialize-v1",
          artifactPaths: materialized.packet?.lineage?.programId
            ? [...materialized.artifactPaths, ARTIFACT_PATHS.programsIndex, ARTIFACT_PATHS.programRuns, ARTIFACT_PATHS.programApprovals, ARTIFACT_PATHS.campaignsIndex]
            : materialized.artifactPaths,
          nextRecommendedCommand: "project:dove.lessons",
          nextManualCheckpoint: materialized.summary,
          summary: `Materialized one accepted guidance path into packet ${materialized.packetId}.`,
          startedAt,
          recordedAt,
          requestSnapshot,
          envelopeSnapshot: snapshotEnvelope(materialized.packet?.autonomyEnvelope ?? null),
          programSnapshot: materialized.packet?.lineage?.programId
            ? {
                programId: materialized.packet.lineage.programId,
                programRunId: materialized.packet.lineage.programRunId ?? null,
                approvalId: materialized.packet.lineage.approvalId ?? null,
                outcome: "materialized-one-packet",
                packetId: materialized.packetId,
                recordedAt
              }
            : null,
          checkpointSnapshot: null,
          escalationSnapshot: null,
          arbitration,
          materializationSnapshot: materialized
        };
        appendEvent(artifacts, {
          id: `runtime-event-${crypto.randomUUID()}`,
          runId,
          eventType: "guidance-materialized",
          actorRole,
          packetId: materialized.packetId,
          leaseId: null,
          summary: resultEntry.summary,
          recordedAt
        });
        appendResult(artifacts, resultEntry);
        updateContinuationState(root, artifacts, resultEntry);
        updateControllerState(artifacts, resultEntry, recordedAt);
        saveRuntimeArtifacts(root, artifacts);
        refreshDurableSurfaces(root, {
          type: "autonomy-control-plane-once",
          summary: resultEntry.summary,
          artifactPaths: resultEntry.artifactPaths
        });
        return resultEntry;
      } catch (error) {
        const recordedAt = nowIso();
        const message = error instanceof Error ? error.message : String(error);
        const requestSnapshot = buildAutonomyRequestSnapshot(root);
        const resultEntry = {
          runId,
          status: "error",
          outcome: "materialization-failed",
          actorRole,
          packetId: candidate.packetId,
          followThroughId: candidate.followThroughId ?? null,
          leaseId: null,
          selectionPolicy: RUN_ONCE_SELECTION_POLICY,
          boundedStepPolicy: "planner-control-plane-materialize-v1",
          artifactPaths: [ARTIFACT_PATHS.runtimeControllerState, ARTIFACT_PATHS.runtimeEvents, ARTIFACT_PATHS.runtimeResults, ARTIFACT_PATHS.workspaceIndex],
          summary: `Autonomous control-plane materialization failed for packet ${candidate.packetId}: ${message}`,
          startedAt,
          recordedAt,
          requestSnapshot,
          envelopeSnapshot: null,
          programSnapshot: null,
          checkpointSnapshot: null,
          escalationSnapshot: null,
          arbitration,
          error: message
        };
        appendEvent(artifacts, {
          id: `runtime-event-${crypto.randomUUID()}`,
          runId,
          eventType: "run-error",
          actorRole,
          packetId: candidate.packetId,
          leaseId: null,
          summary: resultEntry.summary,
          recordedAt
        });
        appendResult(artifacts, resultEntry);
        updateContinuationState(root, artifacts, resultEntry);
        updateControllerState(artifacts, resultEntry, recordedAt);
        saveRuntimeArtifacts(root, artifacts);
        refreshDurableSurfaces(root, {
          type: "autonomy-control-plane-once",
          summary: resultEntry.summary,
          artifactPaths: resultEntry.artifactPaths
        });
        throw error;
      }
    }
    const recordedAt = nowIso();
    const requestSnapshot = buildAutonomyRequestSnapshot(root);
    const result = createNoopResult({
      runId,
      actorRole,
      outcome: "no-eligible-packet",
      summary: "No planner-owned materialized guidance packet was safe to assess, so the controller exited without work.",
      startedAt,
      details: {
        candidateCount: candidates.length,
        materializationCandidateCount: materializationCandidates.length,
        inspectedPacketIds: candidates.map((candidate) => candidate.packet.id),
        artifactPaths: [ARTIFACT_PATHS.runtimeControllerState, ARTIFACT_PATHS.runtimeEvents, ARTIFACT_PATHS.runtimeResults, ARTIFACT_PATHS.workspaceIndex]
      }
    });
    appendEvent(artifacts, {
      id: `runtime-event-${crypto.randomUUID()}`,
      runId,
      eventType: "run-noop",
      actorRole,
      packetId: null,
      leaseId: null,
      summary: result.summary,
      recordedAt
    });
    const resultEntry = { ...result, recordedAt, requestSnapshot, envelopeSnapshot: null, programSnapshot: null, checkpointSnapshot: null, escalationSnapshot: null };
    appendResult(artifacts, resultEntry);
    updateContinuationState(root, artifacts, resultEntry);
    updateControllerState(artifacts, resultEntry, recordedAt);
    saveRuntimeArtifacts(root, artifacts);
    refreshDurableSurfaces(root, {
      type: "autonomy-control-plane-once",
      summary: result.summary,
      artifactPaths: resultEntry.artifactPaths
    });
    return resultEntry;
  }

  const rankedEligible = rankEligibleCandidates(workspaceIndex, eligible);
  const availableEligible = rankedEligible.filter((candidate) => !activeLeaseForPacket(artifacts, candidate.packet.id));
  const selected = availableEligible[0] ?? rankedEligible[0];
  assertTaskScopedMutationTarget(root, "run-autonomy-control-plane-once", { packetId: selected.packet.id });
  const arbitration = buildArbitrationSnapshot({
    candidateFamily: "eligible-packets",
    tieBreakPolicy: ELIGIBLE_PACKET_TIE_BREAK_POLICY,
    rankedCandidates: rankedEligible,
    selectedCandidate: selected,
    leaseSkippedPacketIds: rankedEligible.filter((candidate) => activeLeaseForPacket(artifacts, candidate.packet.id)).map((candidate) => candidate.packet.id),
    selectionReason: rankedEligible.length > 1
      ? `Selected packet ${selected.packet.id} deterministically from ${rankedEligible.length} eligible planner-owned packets.`
      : `Selected the only eligible planner-owned packet ${selected.packet.id}.`
  });
  const existingLease = activeLeaseForPacket(artifacts, selected.packet.id);
  if (existingLease) {
    const recordedAt = nowIso();
    const requestSnapshot = buildAutonomyRequestSnapshot(root);
    const result = createNoopResult({
      runId,
      actorRole,
      outcome: "lease-conflict",
      summary: `Packet ${selected.packet.id} is already leased by ${existingLease.runId}; the controller exited safely without work.`,
      startedAt,
      packetId: selected.packet.id,
      details: {
        followThroughId: selected.followThroughItem.id,
        arbitration,
        conflictingLeaseId: existingLease.id,
        artifactPaths: [ARTIFACT_PATHS.runtimeControllerState, ARTIFACT_PATHS.runtimeLeases, ARTIFACT_PATHS.runtimeEvents, ARTIFACT_PATHS.runtimeResults, ARTIFACT_PATHS.workspaceIndex]
      }
    });
    appendEvent(artifacts, {
      id: `runtime-event-${crypto.randomUUID()}`,
      runId,
      eventType: "run-noop",
      actorRole,
      packetId: selected.packet.id,
      leaseId: existingLease.id,
      summary: result.summary,
      recordedAt
    });
    const resultEntry = { ...result, recordedAt, requestSnapshot, envelopeSnapshot: snapshotEnvelope(selected.envelope), programSnapshot: selected.programAuthorization?.valid ? { programId: selected.programAuthorization.programId, programRunId: selected.programAuthorization.programRunId, approvalId: selected.programAuthorization.approvalId, outcome: "lease-conflict", packetId: selected.packet.id, recordedAt } : null, checkpointSnapshot: null, escalationSnapshot: null };
    appendResult(artifacts, resultEntry);
    updateContinuationState(root, artifacts, resultEntry);
    updateControllerState(artifacts, resultEntry, recordedAt);
    saveRuntimeArtifacts(root, artifacts);
    refreshDurableSurfaces(root, {
      type: "autonomy-control-plane-once",
      summary: result.summary,
      artifactPaths: resultEntry.artifactPaths
    });
    return resultEntry;
  }

  const lease = acquireLease(artifacts, {
    runId,
    packetId: selected.packet.id,
    actorRole,
    acquiredAt: nowIso()
  });
  appendEvent(artifacts, {
    id: `runtime-event-${crypto.randomUUID()}`,
    runId,
    eventType: "lease-acquired",
    actorRole,
    packetId: selected.packet.id,
    leaseId: lease.id,
    summary: `Acquired exclusive lease for packet ${selected.packet.id}.`,
    recordedAt: lease.acquiredAt
  });
  saveRuntimeArtifacts(root, artifacts);

  try {
    const workerStep = executeBoundedPacketStep(root, selected, { runId, actorRole });
    const requestSnapshot = buildAutonomyRequestSnapshot(root);
    const resultEntry = {
      runId,
      status: "completed",
      outcome: workerStep.outcome,
      actorRole,
      packetId: selected.packet.id,
      followThroughId: selected.followThroughItem.id,
      leaseId: lease.id,
      selectionPolicy: RUN_ONCE_SELECTION_POLICY,
      boundedStepPolicy: WORKER_STEP_POLICY,
      readPaths: buildReadPaths(workspaceIndex, selected.packet),
      artifactPaths: [
        ARTIFACT_PATHS.runtimeControllerState,
        ARTIFACT_PATHS.runtimeLeases,
        ARTIFACT_PATHS.runtimeEvents,
        ARTIFACT_PATHS.runtimeResults,
        ARTIFACT_PATHS.workspaceIndex,
        selected.packet.packetPath,
        ARTIFACT_PATHS.taskPacketsIndex,
        ARTIFACT_PATHS.metaOperatorFollowThrough,
        ARTIFACT_PATHS.sessionSummary,
        ARTIFACT_PATHS.navigationReport
      ].concat(workerStep.programMutation?.allowedStepType === "refresh-wiki"
        ? [ARTIFACT_PATHS.wiki, ARTIFACT_PATHS.queryPack, ARTIFACT_PATHS.wikiEntities, ARTIFACT_PATHS.wikiRelations, ARTIFACT_PATHS.programsIndex, ARTIFACT_PATHS.programRuns, ARTIFACT_PATHS.programApprovals, ARTIFACT_PATHS.campaignsIndex]
        : workerStep.programMutation?.allowedStepType === "upsert-note"
          ? [ARTIFACT_PATHS.notes, ARTIFACT_PATHS.queryPack, ARTIFACT_PATHS.programsIndex, ARTIFACT_PATHS.programRuns, ARTIFACT_PATHS.programApprovals, ARTIFACT_PATHS.campaignsIndex]
        : workerStep.programMutation?.allowedStepType === "run-experiment-audit"
          ? [ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.programsIndex, ARTIFACT_PATHS.programRuns, ARTIFACT_PATHS.programApprovals, ARTIFACT_PATHS.campaignsIndex]
        : workerStep.programMutation?.allowedStepType === "run-review-loop"
          ? [ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.adversarialReviewState, ARTIFACT_PATHS.revisionPlan, ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.programsIndex, ARTIFACT_PATHS.programRuns, ARTIFACT_PATHS.programApprovals, ARTIFACT_PATHS.campaignsIndex]
        : workerStep.programSnapshot
          ? [ARTIFACT_PATHS.researchBrief, ARTIFACT_PATHS.researchAgenda, ARTIFACT_PATHS.programsIndex, ARTIFACT_PATHS.programRuns, ARTIFACT_PATHS.programApprovals, ARTIFACT_PATHS.campaignsIndex]
          : []),
      nextRecommendedCommand: "project:dove.lessons",
      nextManualCheckpoint: workerStep.nextManualCheckpoint,
      summary: workerStep.summary,
      startedAt,
      recordedAt: workerStep.recordedAt,
      requestSnapshot,
      envelopeSnapshot: snapshotEnvelope(selected.envelope),
      programSnapshot: workerStep.programSnapshot ?? null,
      arbitration,
      packetSnapshot: workerStep.packetSnapshot,
      followThroughSnapshot: workerStep.followThroughSnapshot,
      checkpointSnapshot: workerStep.checkpointSnapshot,
      escalationSnapshot: workerStep.escalationSnapshot,
      retryState: workerStep.retryState
    };
    appendEvent(artifacts, {
      id: `runtime-event-${crypto.randomUUID()}`,
      runId,
      eventType: workerStep.eventType,
      actorRole,
      packetId: selected.packet.id,
      leaseId: lease.id,
      summary: resultEntry.summary,
      recordedAt: workerStep.recordedAt
    });
    appendResult(artifacts, resultEntry);
    updateContinuationState(root, artifacts, resultEntry);
    releaseLease(artifacts, lease.id, workerStep.recordedAt, `completed-${workerStep.outcome}`);
    appendEvent(artifacts, {
      id: `runtime-event-${crypto.randomUUID()}`,
      runId,
      eventType: "lease-released",
      actorRole,
      packetId: selected.packet.id,
      leaseId: lease.id,
      summary: `Released lease for packet ${selected.packet.id} after the bounded worker step.`,
      recordedAt: workerStep.recordedAt
    });
    updateControllerState(artifacts, resultEntry, workerStep.recordedAt);
    saveRuntimeArtifacts(root, artifacts);
    refreshDurableSurfaces(root, {
      type: "autonomy-control-plane-once",
      summary: resultEntry.summary,
      artifactPaths: resultEntry.artifactPaths
    });
    return resultEntry;
  } catch (error) {
    const recordedAt = nowIso();
    const message = error instanceof Error ? error.message : String(error);
    const requestSnapshot = buildAutonomyRequestSnapshot(root);
    const resultEntry = {
      runId,
      status: "error",
      outcome: "assessment-failed",
      actorRole,
      packetId: selected.packet.id,
      followThroughId: selected.followThroughItem.id,
      leaseId: lease.id,
      selectionPolicy: RUN_ONCE_SELECTION_POLICY,
      boundedStepPolicy: WORKER_STEP_POLICY,
      artifactPaths: [ARTIFACT_PATHS.runtimeControllerState, ARTIFACT_PATHS.runtimeLeases, ARTIFACT_PATHS.runtimeEvents, ARTIFACT_PATHS.runtimeResults, ARTIFACT_PATHS.workspaceIndex],
      summary: `Autonomous control-plane worker step failed for packet ${selected.packet.id}: ${message}`,
      startedAt,
      recordedAt,
      requestSnapshot,
      envelopeSnapshot: snapshotEnvelope(selected.envelope),
      programSnapshot: null,
      checkpointSnapshot: null,
      escalationSnapshot: null,
      arbitration,
      error: message
    };
    appendEvent(artifacts, {
      id: `runtime-event-${crypto.randomUUID()}`,
      runId,
      eventType: "run-error",
      actorRole,
      packetId: selected.packet.id,
      leaseId: lease.id,
      summary: resultEntry.summary,
      recordedAt
    });
    appendResult(artifacts, resultEntry);
    updateContinuationState(root, artifacts, resultEntry);
    releaseLease(artifacts, lease.id, recordedAt, "error");
    updateControllerState(artifacts, resultEntry, recordedAt);
    saveRuntimeArtifacts(root, artifacts);
    refreshDurableSurfaces(root, {
      type: "autonomy-control-plane-once",
      summary: resultEntry.summary,
      artifactPaths: resultEntry.artifactPaths
    });
    throw error;
  }
}
