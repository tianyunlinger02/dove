import crypto from "node:crypto";

import {
  ARTIFACT_PATHS,
  createProgramRunsIndex,
  createRuntimeContinuationIndex,
  createRuntimeControllerState,
  createRuntimeEventsIndex,
  createRuntimeLeasesIndex,
  createRuntimeResultsIndex,
  normalizeMetaOperatorFollowThroughIndex,
  normalizeProgramRunsIndex,
  normalizeRuntimeContinuationIndex,
  normalizeRuntimeControllerState,
  normalizeRuntimeEventsIndex,
  normalizeRuntimeLeasesIndex,
  normalizeRuntimeResultsIndex
} from "./schema.mjs";
import { nowIso, readJson, writeJson } from "./workspace.mjs";

const LEASE_TTL_MS = 10 * 60 * 1000;

function uniqueStrings(items = []) {
  return Array.from(new Set(items.filter(Boolean)));
}

function buildLeaseId() {
  return `autonomy-lease-${crypto.randomUUID()}`;
}

function addMs(timestamp, durationMs) {
  return new Date(Date.parse(timestamp) + durationMs).toISOString();
}

function summarizeLeases(items = []) {
  const active = items.filter((item) => item.status === "active");
  return {
    activeLeaseCount: active.length,
    activePacketIds: uniqueStrings(active.map((item) => item.packetId)),
    activeLeaseIds: uniqueStrings(active.map((item) => item.id)),
    overview: active.length > 0
      ? `${active.length} active autonomous control-plane lease(s): ${active.map((item) => item.packetId).join(", ")}.`
      : "No autonomous control-plane leases are currently active.",
    leasesPath: ARTIFACT_PATHS.runtimeLeases
  };
}

function summarizeEvents(entries = []) {
  const last = entries.at(-1) ?? null;
  return {
    eventCount: entries.length,
    lastEventType: last?.eventType ?? null,
    lastRunId: last?.runId ?? null,
    overview: entries.length > 0
      ? `${entries.length} autonomous control-plane event(s) recorded. Latest event: ${last.eventType}.`
      : "No autonomous control-plane events have been recorded yet.",
    eventsPath: ARTIFACT_PATHS.runtimeEvents
  };
}

function summarizeResults(entries = []) {
  const last = entries.at(-1) ?? null;
  const lastCheckpointEntry = [...entries].reverse().find((entry) => entry?.checkpointSnapshot) ?? null;
  const lastEscalationEntry = [...entries].reverse().find((entry) => entry?.escalationSnapshot) ?? null;
  return {
    runCount: entries.length,
    completedCount: entries.filter((entry) => entry.status === "completed").length,
    noopCount: entries.filter((entry) => entry.status === "noop").length,
    errorCount: entries.filter((entry) => entry.status === "error").length,
    checkpointCount: entries.filter((entry) => entry?.checkpointSnapshot).length,
    escalationCount: entries.filter((entry) => entry?.escalationSnapshot).length,
    lastRunId: last?.runId ?? null,
    lastStatus: last?.status ?? "never-run",
    lastOutcome: last?.outcome ?? "not-started",
    lastCheckpointPacketId: lastCheckpointEntry?.checkpointSnapshot?.packetId ?? null,
    lastCheckpointSummary: lastCheckpointEntry?.checkpointSnapshot?.summary ?? null,
    lastCheckpointAt: lastCheckpointEntry?.checkpointSnapshot?.recordedAt ?? null,
    lastEscalationPacketId: lastEscalationEntry?.escalationSnapshot?.packetId ?? null,
    lastEscalationFollowThroughId: lastEscalationEntry?.escalationSnapshot?.followThroughId ?? null,
    lastEscalationAt: lastEscalationEntry?.escalationSnapshot?.recordedAt ?? null,
    overview: entries.length > 0
      ? `Autonomous control-plane runs: ${entries.length} total, ${entries.filter((entry) => entry.status === "completed").length} completed, ${entries.filter((entry) => entry.status === "noop").length} no-op, ${entries.filter((entry) => entry.status === "error").length} error.`
      : "No autonomous control-plane results have been recorded yet.",
    resultsPath: ARTIFACT_PATHS.runtimeResults
  };
}

export function buildAutonomyRequestSnapshot(root) {
  const followThrough = normalizeMetaOperatorFollowThroughIndex(readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, { items: [], summary: {} }));
  const items = followThrough.items ?? [];
  const actionable = items.filter((item) => ["accepted-for-execution", "executing"].includes(item.status));
  const dueReviewCount = items.filter((item) => item?.dueReview).length;
  return {
    requestCount: actionable.length,
    acceptedRequestCount: followThrough.summary.acceptedForExecutionCount ?? 0,
    executingRequestCount: followThrough.summary.executingCount ?? 0,
    staleRequestCount: followThrough.summary.staleCount ?? 0,
    overdueExecutionCount: followThrough.summary.overdueExecutionCount ?? 0,
    dueReviewCount,
    requestIds: actionable.map((item) => item.id),
    topSourceIds: followThrough.summary.topSourceIds ?? [],
    overview: followThrough.summary.overview,
    followThroughPath: ARTIFACT_PATHS.metaOperatorFollowThrough
  };
}

export function loadRuntimeArtifacts(root) {
  return {
    controllerState: normalizeRuntimeControllerState(readJson(root, ARTIFACT_PATHS.runtimeControllerState, createRuntimeControllerState)),
    continuation: normalizeRuntimeContinuationIndex(readJson(root, ARTIFACT_PATHS.runtimeContinuation, createRuntimeContinuationIndex)),
    leases: normalizeRuntimeLeasesIndex(readJson(root, ARTIFACT_PATHS.runtimeLeases, createRuntimeLeasesIndex)),
    events: normalizeRuntimeEventsIndex(readJson(root, ARTIFACT_PATHS.runtimeEvents, createRuntimeEventsIndex)),
    results: normalizeRuntimeResultsIndex(readJson(root, ARTIFACT_PATHS.runtimeResults, createRuntimeResultsIndex))
  };
}

export function saveRuntimeArtifacts(root, artifacts) {
  writeJson(root, ARTIFACT_PATHS.runtimeControllerState, artifacts.controllerState);
  writeJson(root, ARTIFACT_PATHS.runtimeContinuation, artifacts.continuation);
  writeJson(root, ARTIFACT_PATHS.runtimeLeases, artifacts.leases);
  writeJson(root, ARTIFACT_PATHS.runtimeEvents, artifacts.events);
  writeJson(root, ARTIFACT_PATHS.runtimeResults, artifacts.results);
}

export function appendEvent(artifacts, entry) {
  const entries = [...(artifacts.events.entries ?? []), entry].slice(-200);
  artifacts.events = {
    ...artifacts.events,
    entries,
    summary: summarizeEvents(entries),
    updatedAt: entry.recordedAt
  };
}

export function appendResult(artifacts, entry) {
  const entries = [...(artifacts.results.entries ?? []), entry].slice(-200);
  artifacts.results = {
    ...artifacts.results,
    entries,
    summary: summarizeResults(entries),
    updatedAt: entry.recordedAt
  };
}

export function updateControllerState(artifacts, entry, recordedAt) {
  const requestSnapshot = entry.requestSnapshot ?? {
    requestCount: 0,
    acceptedRequestCount: 0,
    executingRequestCount: 0,
    staleRequestCount: 0,
    overdueExecutionCount: 0,
    dueReviewCount: 0
  };
  artifacts.controllerState = {
    ...artifacts.controllerState,
    lastRun: {
      runId: entry.runId,
      status: entry.status,
      outcome: entry.outcome,
      selectedPacketId: entry.packetId ?? null,
      leaseId: entry.leaseId ?? null,
      actorRole: entry.actorRole,
      envelopeWorkerRole: entry.envelopeSnapshot?.workerRole ?? null,
      programId: entry.programSnapshot?.programId ?? null,
      programRunId: entry.programSnapshot?.programRunId ?? null,
      approvalId: entry.programSnapshot?.approvalId ?? null,
      startedAt: entry.startedAt ?? recordedAt,
      completedAt: entry.recordedAt,
      summary: entry.summary
    },
    summary: {
      ...artifacts.controllerState.summary,
      lastRunId: entry.runId,
      lastStatus: entry.status,
      lastOutcome: entry.outcome,
      lastSelectedPacketId: entry.packetId ?? null,
      requestCount: requestSnapshot.requestCount ?? 0,
      acceptedRequestCount: requestSnapshot.acceptedRequestCount ?? 0,
      executingRequestCount: requestSnapshot.executingRequestCount ?? 0,
      staleRequestCount: requestSnapshot.staleRequestCount ?? 0,
      overdueExecutionCount: requestSnapshot.overdueExecutionCount ?? 0,
      dueReviewCount: requestSnapshot.dueReviewCount ?? 0,
      lastEnvelopeWorkerRole: entry.envelopeSnapshot?.workerRole ?? null,
      lastProgramId: entry.programSnapshot?.programId ?? null,
      lastProgramRunId: entry.programSnapshot?.programRunId ?? null,
      lastApprovalId: entry.programSnapshot?.approvalId ?? null,
      lastProgramOutcome: entry.programSnapshot?.outcome ?? "not-started",
      continuationCount: artifacts.continuation.summary.continuationCount ?? 0,
      currentContinuationKind: artifacts.continuation.summary.currentKind ?? null,
      currentContinuationPacketId: artifacts.continuation.summary.currentPacketId ?? null,
      currentContinuationProgramRunId: artifacts.continuation.summary.currentProgramRunId ?? null,
      currentContinuationCommand: artifacts.continuation.summary.currentCommand ?? null,
      checkpointCount: artifacts.results.summary.checkpointCount ?? 0,
      escalationCount: artifacts.results.summary.escalationCount ?? 0,
      lastCheckpointPacketId: artifacts.results.summary.lastCheckpointPacketId ?? null,
      lastCheckpointSummary: artifacts.results.summary.lastCheckpointSummary ?? null,
      lastCheckpointAt: artifacts.results.summary.lastCheckpointAt ?? null,
      lastEscalationPacketId: artifacts.results.summary.lastEscalationPacketId ?? null,
      lastEscalationFollowThroughId: artifacts.results.summary.lastEscalationFollowThroughId ?? null,
      lastEscalationAt: artifacts.results.summary.lastEscalationAt ?? null,
      overview: entry.summary,
      controllerStatePath: ARTIFACT_PATHS.runtimeControllerState,
      leasesPath: ARTIFACT_PATHS.runtimeLeases,
      eventsPath: ARTIFACT_PATHS.runtimeEvents,
      resultsPath: ARTIFACT_PATHS.runtimeResults
    },
    updatedAt: recordedAt
  };
}

export function expireStaleLeases(artifacts, timestamp) {
  const nextItems = (artifacts.leases.items ?? []).map((item) => {
    if (item.status === "active" && item.expiresAt && String(item.expiresAt) <= timestamp) {
      return {
        ...item,
        status: "expired",
        releasedAt: timestamp,
        releaseReason: "lease-ttl-expired"
      };
    }
    return item;
  });
  artifacts.leases = {
    ...artifacts.leases,
    items: nextItems,
    summary: summarizeLeases(nextItems),
    updatedAt: timestamp
  };
}

export function acquireLease(artifacts, { runId, packetId, actorRole, acquiredAt }) {
  const lease = {
    id: buildLeaseId(),
    runId,
    packetId,
    actorRole,
    status: "active",
    acquiredAt,
    expiresAt: addMs(acquiredAt, LEASE_TTL_MS),
    releasedAt: null,
    releaseReason: null
  };
  const items = [...(artifacts.leases.items ?? []), lease];
  artifacts.leases = {
    ...artifacts.leases,
    items,
    summary: summarizeLeases(items),
    updatedAt: acquiredAt
  };
  return lease;
}

export function releaseLease(artifacts, leaseId, timestamp, reason) {
  const items = (artifacts.leases.items ?? []).map((item) => item.id === leaseId
    ? { ...item, status: "released", releasedAt: timestamp, releaseReason: reason }
    : item);
  artifacts.leases = {
    ...artifacts.leases,
    items,
    summary: summarizeLeases(items),
    updatedAt: timestamp
  };
}

export function activeLeaseForPacket(artifacts, packetId) {
  return (artifacts.leases.items ?? []).find((item) => item.packetId === packetId && item.status === "active") ?? null;
}

function summarizeContinuationItems(items = []) {
  const first = items[0] ?? null;
  return {
    continuationCount: items.length,
    currentKind: first?.kind ?? null,
    currentPacketId: first?.packetId ?? null,
    currentProgramRunId: first?.programRunId ?? null,
    currentCommand: first?.command ?? null,
    overview: first
      ? `Next explicit autonomy continuation: ${first.command} for ${first.packetId ?? first.programRunId ?? first.kind}.`
      : "No explicit autonomy continuation is currently pending.",
    continuationPath: ARTIFACT_PATHS.runtimeContinuation
  };
}

function buildContinuationItems(root, entry) {
  if (!entry?.packetId) {
    return [];
  }
  const packet = readJson(root, `${ARTIFACT_PATHS.taskPacketsPacketsDir}/${entry.packetId}.json`, null);
  const programRun = entry.programSnapshot?.programRunId
    ? (normalizeProgramRunsIndex(readJson(root, ARTIFACT_PATHS.programRuns, createProgramRunsIndex)).items ?? []).find((item) => item.id === entry.programSnapshot.programRunId) ?? null
    : null;
  const commonReadPaths = [ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.runtimeResults, ARTIFACT_PATHS.metaOperatorFollowThrough, packet?.packetPath].filter(Boolean);

  if (entry.outcome === "materialized-one-packet") {
    return [{
      kind: "execute-materialized-packet",
      command: "dove autonomy-once",
      packetId: entry.packetId,
      programRunId: entry.programSnapshot?.programRunId ?? null,
      followThroughId: entry.followThroughId ?? null,
      summary: `A packet was materialized and is ready for the next explicit autonomy pass.`,
      requiredReadPaths: commonReadPaths,
      readyAt: entry.recordedAt ?? nowIso()
    }];
  }

  if (programRun?.reviewCheckpointRequired) {
    return [{
      kind: "issue-fresh-approval",
      command: "project:dove.approvals",
      packetId: entry.packetId,
      programRunId: programRun.id,
      followThroughId: entry.followThroughId ?? null,
      summary: programRun.reviewCheckpointSummary ?? `Issue a fresh approval before the next bounded step.`,
      requiredReadPaths: [...commonReadPaths, ARTIFACT_PATHS.programRuns, ARTIFACT_PATHS.programApprovals],
      readyAt: programRun.reviewCheckpointAt ?? entry.recordedAt ?? nowIso()
    }];
  }

  if (entry.outcome === "executed-program-step" && (programRun?.authorityEnvelope?.remainingStepCount ?? 0) > 0) {
    return [{
      kind: "continue-program-envelope",
      command: "dove autonomy-foreground",
      packetId: entry.packetId,
      programRunId: programRun.id,
      approvalId: entry.programSnapshot?.approvalId ?? null,
      followThroughId: entry.followThroughId ?? null,
      summary: `Program-scoped authority envelope still has ${(programRun.authorityEnvelope?.remainingStepCount ?? 0)} bounded approved step(s) available for packet ${entry.packetId}.`,
      requiredReadPaths: [...commonReadPaths, ARTIFACT_PATHS.programRuns, ARTIFACT_PATHS.programApprovals],
      readyAt: entry.recordedAt ?? nowIso()
    }];
  }

  if (["worker-step-retry-pending", "worker-step-escalated", "executed-one-packet-step"].includes(entry.outcome)) {
    return [{
      kind: entry.outcome === "worker-step-escalated" ? "manual-escalation" : "review-follow-through",
      command: "project:dove.paper.follow-through",
      packetId: entry.packetId,
      programRunId: null,
      followThroughId: entry.followThroughId ?? null,
      summary: entry.nextManualCheckpoint ?? entry.summary,
      requiredReadPaths: commonReadPaths,
      readyAt: entry.recordedAt ?? nowIso()
    }];
  }

  return [];
}

export function updateContinuationState(root, artifacts, entry) {
  const items = buildContinuationItems(root, entry);
  artifacts.continuation = {
    ...artifacts.continuation,
    items,
    summary: summarizeContinuationItems(items),
    updatedAt: entry.recordedAt ?? nowIso()
  };
}

export function readCurrentContinuation(root) {
  return normalizeRuntimeContinuationIndex(readJson(root, ARTIFACT_PATHS.runtimeContinuation, createRuntimeContinuationIndex));
}
