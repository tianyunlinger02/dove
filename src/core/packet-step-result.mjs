import path from "node:path";

import {
  ARTIFACT_PATHS,
  DOVE_ARCHIVED_TASK_STATUSES,
  DOVE_TASK_DOMAINS,
  DOVE_TASK_STAGES,
  DOVE_TASK_STATUSES,
  createTaskPacketsIndex,
  normalizeDoveBoundary,
  normalizeDoveBoundaryType,
  normalizeDoveExecutionContract,
  normalizeDovePrimaryRoleId,
  normalizeDoveVerifiedCriteria
} from "./schema.mjs";
import { resolveDoveResponseLanguage } from "./i18n.mjs";
import { appendEvent, loadRuntimeArtifacts, saveRuntimeArtifacts } from "./runtime-state.mjs";
import { normalizeTaskPacketId, readTaskPacketCatalog } from "./task-packets.mjs";
import { loadState, nowIso, readJson, saveState, writeJson } from "./workspace.mjs";

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)))
    : [];
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function activeStatus(status) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return !["completed", "killed", ...DOVE_ARCHIVED_TASK_STATUSES].includes(normalized);
}

function normalizeStatus(value, fallback = "pending") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/_/g, "-") : "";
  return DOVE_TASK_STATUSES.includes(normalized) ? normalized : fallback;
}

function archivedTaskStatus(task) {
  return [task?.status, task?.lifecycleStatus].some((status) => DOVE_ARCHIVED_TASK_STATUSES.includes(String(status ?? "").trim().toLowerCase()));
}

function normalizeIndex(index = createTaskPacketsIndex()) {
  const base = createTaskPacketsIndex();
  const items = Array.isArray(index.items) ? index.items.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
  const activeInit = items.find((item) => item.level === 0 && activeStatus(item.status)) ?? null;
  const activeItems = items.filter((item) => item.level !== 0 && activeStatus(item.status));
  const lifecycleCounts = {};
  const stageCounts = Object.fromEntries(DOVE_TASK_STAGES.map((stage) => [stage, 0]));
  const domainCounts = Object.fromEntries(DOVE_TASK_DOMAINS.map((domain) => [domain, 0]));
  const levelCounts = {};
  for (const item of items) {
    const status = archivedTaskStatus(item) ? "archived" : normalizeStatus(item.status ?? item.lifecycleStatus, "pending");
    lifecycleCounts[status] = (lifecycleCounts[status] ?? 0) + 1;
    if (DOVE_TASK_STAGES.includes(item.stage)) stageCounts[item.stage] += 1;
    if (DOVE_TASK_DOMAINS.includes(item.domain)) domainCounts[item.domain] += 1;
    const levelKey = String(Number.isFinite(item.level) ? item.level : 3);
    levelCounts[levelKey] = (levelCounts[levelKey] ?? 0) + 1;
  }
  return {
    ...base,
    ...index,
    version: base.version,
    items,
    taskModel: {
      ...base.taskModel,
      ...(index.taskModel && typeof index.taskModel === "object" && !Array.isArray(index.taskModel) ? index.taskModel : {}),
      activeInitId: activeInit?.id ?? null,
      activeTaskIds: activeItems.map((item) => item.id)
    },
    lifecycleCounts,
    stageCounts,
    domainCounts,
    levelCounts,
    updatedAt: index.updatedAt ?? null
  };
}

function taskPacketPath(packetId) {
  return path.join(ARTIFACT_PATHS.taskPacketsPacketsDir, `${packetId}.json`);
}

function taskContextPath(packetId) {
  return path.join(ARTIFACT_PATHS.packetContextsDir, `${packetId}.json`);
}

function writePacket(root, packet) {
  const { context: _derivedContext, ...packetRecord } = packet;
  writeJson(root, taskPacketPath(packet.id), packetRecord);
  writeJson(root, taskContextPath(packet.id), {
    id: packet.id,
    parentId: packet.parentId,
    rootId: packet.rootId,
    level: packet.level,
    creatorKind: packet.creatorKind,
    stage: packet.stage,
    domain: packet.domain,
    status: packet.status,
    dependencies: packet.dependencies,
    blockedBy: packet.blockedBy,
    lessonIds: packet.lessonIds,
    artifactRefs: packet.artifactRefs,
    evidenceLinks: packet.evidenceLinks,
    sourceIds: packet.sourceIds,
    noteIds: packet.noteIds,
    claimIds: packet.claimIds,
    outputPaths: packet.outputPaths,
    validationEvidencePaths: packet.validationEvidencePaths,
    verificationEvidencePaths: packet.verificationEvidencePaths,
    verifiedCriteria: packet.verifiedCriteria,
    contextPolicy: packet.contextPolicy,
    executionContract: normalizeDoveExecutionContract(packet.executionContract, null),
    currentFocus: packet.currentFocus,
    nextAction: packet.nextAction,
    completedAt: packet.completedAt ?? null,
    blockedReason: packet.blockedReason ?? null,
    killedAt: packet.killedAt ?? null,
    killReason: packet.killReason ?? null,
    ownerRole: packet.ownerRole ?? null,
    nextRole: packet.nextRole ?? null,
    boundary: packet.boundary ?? null,
    boundaryHistory: Array.isArray(packet.boundaryHistory) ? packet.boundaryHistory : [],
    handoff: packet.handoff ?? null,
    lastTransition: packet.lastTransition ?? null,
    updatedAt: packet.updatedAt
  });
}

function indexItem(packet) {
  const { context: _derivedContext, ...item } = packet;
  return {
    ...item,
    completedAt: packet.completedAt ?? null,
    blockedReason: packet.blockedReason ?? null,
    killedAt: packet.killedAt ?? null,
    killReason: packet.killReason ?? null,
    ownerRole: packet.ownerRole ?? null,
    nextRole: packet.nextRole ?? null,
    boundary: packet.boundary ?? null,
    boundaryHistory: Array.isArray(packet.boundaryHistory) ? packet.boundaryHistory : [],
    handoff: packet.handoff ?? null,
    lastTransition: packet.lastTransition ?? null,
    executionContract: normalizeDoveExecutionContract(packet.executionContract, null)
  };
}

function ownerRoleFor(task = {}) {
  if (task.stage === "audit") return "reviewer";
  if (task.stage === "plan") return "planner";
  return "builder";
}

function transitionBoundaryFor(task, status, fields, timestamp) {
  const explicit = normalizeDoveBoundary(fields.boundary, null);
  if (explicit) return { ...explicit, packetId: explicit.packetId ?? task.id, createdAt: explicit.createdAt ?? timestamp };
  const type = normalizeString(fields.boundaryType, status === "blocked" ? "blocked-boundary" : null);
  if (!type) return null;
  return normalizeDoveBoundary({
    id: normalizeTaskPacketId(fields.boundaryId ?? `boundary-${task.id}-${type}-${Date.now().toString(36)}`),
    type,
    status: "open",
    packetId: task.id,
    runId: fields.runId ?? null,
    sourceSurface: fields.sourceSurface ?? fields.surface ?? null,
    command: fields.command ?? null,
    reason: fields.reason ?? fields.blockedReason ?? fields.stopReason ?? "",
    summary: fields.summary ?? fields.blockedReason ?? fields.reason ?? fields.stopReason ?? "",
    requiredInputs: fields.requiredInputs ?? [],
    requiredActions: fields.requiredActions ?? [],
    ownerRole: fields.ownerRole ?? task.ownerRole ?? ownerRoleFor(task),
    nextRole: fields.nextRole ?? task.nextRole ?? task.ownerRole ?? ownerRoleFor(task),
    createdAt: timestamp
  }, null);
}

function transitionHandoffFor(task, fields, boundary, timestamp) {
  const ownerRole = normalizeDovePrimaryRoleId(fields.ownerRole ?? task.ownerRole, ownerRoleFor(task));
  const nextRole = normalizeDovePrimaryRoleId(fields.nextRole ?? boundary?.nextRole, ownerRole);
  if (nextRole === ownerRole) return null;
  return {
    id: normalizeTaskPacketId(fields.handoffId ?? `handoff-${task.id}-${ownerRole}-to-${nextRole}-${Date.now().toString(36)}`),
    status: "pending",
    fromRole: ownerRole,
    toRole: nextRole,
    reason: fields.reason ?? boundary?.reason ?? "",
    summary: fields.summary ?? boundary?.summary ?? "",
    boundaryId: boundary?.id ?? null,
    sourceRunId: fields.runId ?? null,
    requestedAt: timestamp
  };
}

function persistentLifecycleFields(fields = {}) {
  const allowedKeys = ["currentFocus", "nextAction", "lessonIds", "artifactRefs", "evidenceLinks", "validationEvidencePaths", "verificationEvidencePaths", "verifiedCriteria", "executionContract", "outputPaths", "claimIds", "noteIds", "experimentIds", "resultIds", "auditIds", "versionIds", "rebuttalIssueIds", "sourceIds", "archivedAt", "archiveReason"];
  return Object.fromEntries(allowedKeys.filter((key) => fields[key] !== undefined).map((key) => [key, fields[key]]));
}

function runtimeEventId(packetId, type, count) {
  return normalizeTaskPacketId(`event-${packetId}-${type}-${Date.now().toString(36)}-${count}`);
}

function recordLifecycleEvents(root, packet, transition, openedBoundary, resolvedBoundary, handoff) {
  const artifacts = loadRuntimeArtifacts(root);
  const baseCount = artifacts.events.entries?.length ?? 0;
  const base = {
    packetId: packet.id,
    runId: transition.runId ?? null,
    surface: transition.surface ?? transition.sourceSurface ?? null,
    command: transition.command ?? null,
    fromStatus: transition.fromStatus,
    toStatus: transition.toStatus,
    summary: transition.summary ?? "",
    evidenceLinks: normalizeStringArray(transition.evidenceLinks),
    artifactRefs: normalizeStringArray(transition.artifactRefs),
    timestamp: transition.timestamp,
    recordedAt: transition.timestamp
  };
  const events = [{ ...base, id: runtimeEventId(packet.id, "task-lifecycle-transitioned", baseCount + 1), type: "task.lifecycle.transitioned", eventType: "task.lifecycle.transitioned", boundaryId: openedBoundary?.id ?? resolvedBoundary?.id ?? null, handoffId: handoff?.id ?? null }];
  if (resolvedBoundary) events.push({ ...base, id: runtimeEventId(packet.id, "task-boundary-resolved", baseCount + events.length + 1), type: "task.boundary.resolved", eventType: "task.boundary.resolved", boundaryId: resolvedBoundary.id, boundary: resolvedBoundary, handoffId: null });
  if (openedBoundary) events.push({ ...base, id: runtimeEventId(packet.id, "task-boundary-opened", baseCount + events.length + 1), type: "task.boundary.opened", eventType: "task.boundary.opened", boundaryId: openedBoundary.id, boundary: openedBoundary, handoffId: handoff?.id ?? null });
  if (handoff) events.push({ ...base, id: runtimeEventId(packet.id, "task-handoff-requested", baseCount + events.length + 1), type: "task.handoff.requested", eventType: "task.handoff.requested", boundaryId: openedBoundary?.id ?? resolvedBoundary?.id ?? null, handoffId: handoff.id, handoff });
  for (const event of events) appendEvent(artifacts, event);
  saveRuntimeArtifacts(root, artifacts);
}

export function updatePacketLifecycle(root, task, status, fields = {}, options = {}) {
  const timestamp = nowIso();
  const fullTask = readTaskPacketCatalog(root).byId.get(task.id) ?? task;
  options.assertCompletionReady?.(root, fullTask, status, resolveDoveResponseLanguage(root, fields));
  const fromStatus = fullTask.status;
  const artifactRefs = fields.artifactRefs !== undefined ? normalizeStringArray(fields.artifactRefs) : fullTask.artifactRefs;
  const evidenceLinks = fields.evidenceLinks !== undefined ? normalizeStringArray(fields.evidenceLinks) : fullTask.evidenceLinks;
  const statusFields = {};
  if (status === "in-progress" && !fullTask.startedAt) statusFields.startedAt = fields.startedAt ?? timestamp;
  if (status === "completed") { statusFields.completedAt = fields.completedAt ?? timestamp; statusFields.blockedReason = null; }
  if (status === "blocked") statusFields.blockedReason = normalizeString(fields.blockedReason ?? fields.reason ?? fields.stopReason, fullTask.blockedReason ?? "");
  if (status !== "blocked" && fullTask.status === "blocked") statusFields.blockedReason = null;
  if (status === "killed") { statusFields.killedAt = fields.killedAt ?? timestamp; statusFields.killReason = normalizeString(fields.killReason ?? fields.reason, fullTask.killReason ?? ""); }
  if (status === "archived") { statusFields.archivedAt = fields.archivedAt ?? timestamp; statusFields.archiveReason = normalizeString(fields.archiveReason ?? fields.reason, fullTask.archiveReason ?? ""); statusFields.blockedReason = null; }
  const openedBoundary = status === "blocked" || fields.boundary || fields.boundaryType ? transitionBoundaryFor(fullTask, status, { ...fields, artifactRefs }, timestamp) : null;
  const resolvedBoundary = fullTask.boundary?.status === "open" && !openedBoundary && status !== "blocked" ? normalizeDoveBoundary({ ...fullTask.boundary, status: "resolved", resolvedAt: timestamp, resolution: fields.reason ?? `status:${status}` }, null) : null;
  const ownerRole = normalizeDovePrimaryRoleId(fields.ownerRole ?? fullTask.ownerRole, ownerRoleFor(fullTask));
  const nextRole = normalizeDovePrimaryRoleId(fields.nextRole ?? openedBoundary?.nextRole ?? fullTask.nextRole, ownerRole);
  const handoff = transitionHandoffFor(fullTask, { ...fields, ownerRole, nextRole }, openedBoundary, timestamp);
  const lastTransition = { fromStatus, toStatus: status, reason: normalizeString(fields.reason ?? fields.stopReason ?? fields.blockedReason, ""), summary: normalizeString(fields.summary, ""), surface: normalizeString(fields.surface ?? fields.sourceSurface, null), command: normalizeString(fields.command, null), runId: normalizeString(fields.runId, null), boundaryId: openedBoundary?.id ?? resolvedBoundary?.id ?? null, handoffId: handoff?.id ?? null, transitionedAt: timestamp };
  const packet = { ...fullTask, ...persistentLifecycleFields(fields), ...statusFields, artifactRefs, evidenceLinks, status, lifecycleStatus: status, ownerRole, nextRole, boundary: openedBoundary, boundaryHistory: [...(Array.isArray(fullTask.boundaryHistory) ? fullTask.boundaryHistory : []), ...(resolvedBoundary ? [resolvedBoundary] : []), ...(openedBoundary ? [openedBoundary] : [])].slice(-20), handoff: handoff ?? (resolvedBoundary ? null : fullTask.handoff ?? null), lastTransition, updatedAt: timestamp };
  writePacket(root, packet);
  const currentIndex = normalizeIndex(readJson(root, ARTIFACT_PATHS.taskPacketsIndex, createTaskPacketsIndex));
  const item = indexItem(packet);
  const nextIndex = normalizeIndex({ ...currentIndex, items: [...currentIndex.items.filter((existing) => existing.id !== item.id), item].sort((left, right) => (left.level ?? 3) - (right.level ?? 3) || String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? "")) || left.id.localeCompare(right.id)), updatedAt: packet.updatedAt });
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, nextIndex);
  const state = loadState(root);
  saveState(root, { ...state, orchestration: { ...state.orchestration, activeTaskIds: nextIndex.taskModel.activeTaskIds, currentFocus: packet.currentFocus ?? state.orchestration.currentFocus, nextAction: packet.nextAction ?? state.orchestration.nextAction } });
  recordLifecycleEvents(root, packet, { ...lastTransition, timestamp, evidenceLinks: fields.evidenceLinks, artifactRefs }, openedBoundary, resolvedBoundary, handoff);
  return packet;
}

function packetContinuationAction(task = {}, output = {}) {
  const outputAction = normalizeString(output?.nextAction ?? output?.boundary?.nextAction, null);
  if (outputAction && outputAction !== "project:dove.mission") return outputAction;
  const packetAction = normalizeString(task.nextAction, null);
  return packetAction && packetAction !== "project:dove.mission" ? packetAction : "project:dove.auto";
}

export function applyPacketStepResult(root, task, options = {}) {
  const fullTask = readTaskPacketCatalog(root).byId.get(task.id) ?? task;
  const output = plainObject(options.output);
  if (output.packetLifecycleApplied === true && output.task?.id === fullTask.id) return readTaskPacketCatalog(root).byId.get(fullTask.id) ?? output.task;
  const classified = options.classified;
  if (!classified) throw new Error("applyPacketStepResult requires a classified step result.");
  const artifactRefs = normalizeStringArray([...normalizeStringArray(fullTask.artifactRefs), ...normalizeStringArray(classified.artifactRefs), ...normalizeStringArray(output.artifactRefs ?? output.artifactPaths)]);
  const evidenceLinks = normalizeStringArray([...normalizeStringArray(fullTask.evidenceLinks), ...normalizeStringArray(classified.evidenceLinks), ...normalizeStringArray(output.evidenceLinks ?? output.evidencePaths)]);
  const fields = {
    runId: options.runId ?? output.runId ?? null,
    surface: options.surface ?? "dove.auto",
    command: options.command ?? null,
    summary: normalizeString(options.summary ?? output.summary ?? classified.outcome, classified.outcome),
    reason: normalizeString(options.reason ?? classified.stopReason, ""),
    stopReason: classified.stopReason,
    currentFocus: normalizeString(options.currentFocus ?? output.summary ?? output.review?.summary ?? classified.outcome, fullTask.currentFocus ?? fullTask.title),
    nextAction: normalizeString(options.nextAction, packetContinuationAction(fullTask, output)),
    artifactRefs,
    evidenceLinks,
    validationEvidencePaths: normalizeStringArray(output.validationEvidencePaths),
    verificationEvidencePaths: normalizeStringArray(classified.verificationEvidencePaths),
    verifiedCriteria: normalizeDoveVerifiedCriteria(classified.verifiedCriteria),
    executionContract: output.executionContract ?? fullTask.executionContract,
    sourceIds: normalizeStringArray(output.sourceIds ?? fullTask.sourceIds),
    noteIds: normalizeStringArray(output.noteIds ?? fullTask.noteIds),
    claimIds: normalizeStringArray(output.claimIds ?? fullTask.claimIds),
    outputPaths: normalizeStringArray(output.outputPaths ?? fullTask.outputPaths)
  };
  if (classified.terminal) {
    const boundary = normalizeDoveBoundary(output.boundary, null);
    return updatePacketLifecycle(root, fullTask, "blocked", { ...fields, boundary, boundaryType: boundary?.type ?? normalizeDoveBoundaryType(classified.outcome, "blocked-boundary"), requiredInputs: boundary?.requiredInputs ?? output.requiredInputs ?? [], requiredActions: boundary?.requiredActions ?? classified.requiredActions ?? output.requiredActions ?? [], ownerRole: boundary?.ownerRole ?? output.ownerRole, nextRole: boundary?.nextRole ?? output.nextRole });
  }
  const nextStatus = ["ready", "blocked"].includes(fullTask.status) ? "in-progress" : fullTask.status;
  return updatePacketLifecycle(root, fullTask, nextStatus, fields);
}
