import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  DOVE_AUDIO_CONTEXT_POLICY,
  DOVE_TASK_CREATOR_KINDS,
  DOVE_TASK_DOMAINS,
  DOVE_TASK_STAGES,
  DOVE_TASK_STATUSES,
  DOVE_PRIMARY_ROLE_IDS,
  createDefaultState,
  createTaskPacketsIndex,
  normalizeDoveBoundary,
  normalizeDoveExecutionContract,
  normalizeDoveHandoff,
  normalizeDoveVerifiedCriteria,
  normalizeSettings
} from "./schema.mjs";

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function uniqueStrings(values = []) {
  return Array.from(new Set(values.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean)));
}

function normalizeAllowed(value, allowed, fallback) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeLevel(value, fallback = 3) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function normalizeTaskStatus(value, fallback = "pending") {
  return normalizeAllowed(value, DOVE_TASK_STATUSES, fallback);
}

function normalizePrimaryRole(value, fallback = "builder") {
  return normalizeAllowed(value, DOVE_PRIMARY_ROLE_IDS, fallback);
}

function readJsonReadOnly(root, relativePath, fallback = null) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return typeof fallback === "function" ? fallback() : structuredClone(fallback);
  }
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function packetFilePath(packetId) {
  return path.join(ARTIFACT_PATHS.taskPacketsPacketsDir, `${packetId}.json`);
}

function packetContextPath(packetId) {
  return path.join(ARTIFACT_PATHS.packetContextsDir, `${packetId}.json`);
}

function readOptionalJson(root, relativePath) {
  try {
    return readJsonReadOnly(root, relativePath, null);
  } catch {
    return null;
  }
}

export function normalizeTaskPacketId(value) {
  return slugify(value);
}

export function readTaskTargetResolutionSettings(root) {
  const state = readJsonReadOnly(root, ARTIFACT_PATHS.state, createDefaultState);
  return normalizeSettings(state.settings).taskTargetResolution;
}

function normalizePacketCandidate(root, packet = {}) {
  const id = normalizeTaskPacketId(packet.id ?? packet.packetId ?? packet.sourceId ?? packet.title);
  const filePacket = readOptionalJson(root, packet.packetPath ?? packetFilePath(id));
  const context = readOptionalJson(root, packet.packetContextPath ?? packetContextPath(id));
  const merged = { ...packet, ...normalizeObject(filePacket) };
  const contextObject = normalizeObject(context);
  const creatorKind = normalizeAllowed(merged.creatorKind ?? contextObject.creatorKind, DOVE_TASK_CREATOR_KINDS, "user");
  const levelFallback = creatorKind === "system" ? 2 : 3;
  const level = normalizeLevel(merged.level ?? contextObject.level, levelFallback);
  const status = normalizeTaskStatus(merged.status ?? merged.lifecycleStatus ?? contextObject.status, "pending");
  return {
    ...merged,
    id,
    title: merged.title ?? id,
    summary: merged.summary ?? "",
    parentId: merged.parentId ?? contextObject.parentId ?? null,
    rootId: merged.rootId ?? contextObject.rootId ?? (level === 0 ? id : null),
    level,
    creatorKind,
    stage: normalizeAllowed(merged.stage ?? merged.missionStage ?? contextObject.stage, DOVE_TASK_STAGES, "plan"),
    domain: normalizeAllowed(merged.domain ?? merged.doveDomain ?? contextObject.domain, DOVE_TASK_DOMAINS, "engineering"),
    status,
    lifecycleStatus: merged.lifecycleStatus ?? status,
    dependencies: uniqueStrings([...normalizeStringArray(merged.dependencies), ...normalizeStringArray(contextObject.dependencies)]),
    blockedBy: uniqueStrings([...normalizeStringArray(merged.blockedBy), ...normalizeStringArray(contextObject.blockedBy)]),
    completedAt: merged.completedAt ?? contextObject.completedAt ?? null,
    blockedReason: merged.blockedReason ?? merged.blockerReason ?? contextObject.blockedReason ?? contextObject.blockerReason ?? null,
    killedAt: merged.killedAt ?? contextObject.killedAt ?? null,
    killReason: merged.killReason ?? contextObject.killReason ?? null,
    ownerRole: normalizePrimaryRole(merged.ownerRole ?? contextObject.ownerRole, "builder"),
    nextRole: normalizePrimaryRole(merged.nextRole ?? contextObject.nextRole, merged.ownerRole ?? contextObject.ownerRole ?? "builder"),
    boundary: normalizeDoveBoundary(merged.boundary ?? contextObject.boundary, null),
    boundaryHistory: Array.isArray(merged.boundaryHistory ?? contextObject.boundaryHistory) ? (merged.boundaryHistory ?? contextObject.boundaryHistory).map((item) => normalizeDoveBoundary(item, null)).filter(Boolean) : [],
    handoff: normalizeDoveHandoff(merged.handoff ?? contextObject.handoff, null),
    lastTransition: normalizeObject(merged.lastTransition ?? contextObject.lastTransition),
    lessonIds: uniqueStrings([...normalizeStringArray(merged.lessonIds), ...normalizeStringArray(contextObject.lessonIds)]),
    artifactRefs: uniqueStrings([...normalizeStringArray(merged.artifactRefs), ...normalizeStringArray(contextObject.artifactRefs)]),
    contextPolicy: merged.contextPolicy ?? contextObject.contextPolicy ?? DOVE_AUDIO_CONTEXT_POLICY,
    sourceType: merged.sourceType ?? contextObject.sourceType ?? null,
    sourceId: merged.sourceId ?? contextObject.sourceId ?? id,
    currentFocus: merged.currentFocus ?? contextObject.currentFocus ?? "",
    nextAction: merged.nextAction ?? contextObject.nextAction ?? "",
    packetPath: merged.packetPath ?? packetFilePath(id),
    packetContextPath: merged.packetContextPath ?? packetContextPath(id),
    claimIds: uniqueStrings([...normalizeStringArray(merged.claimIds), ...normalizeStringArray(contextObject.claimIds)]),
    noteIds: uniqueStrings([...normalizeStringArray(merged.noteIds), ...normalizeStringArray(contextObject.noteIds)]),
    experimentIds: uniqueStrings([...normalizeStringArray(merged.experimentIds), ...normalizeStringArray(contextObject.experiments), ...normalizeStringArray(contextObject.experimentIds)]),
    rebuttalIssueIds: uniqueStrings([...normalizeStringArray(merged.rebuttalIssueIds), ...normalizeStringArray(contextObject.rebuttalIssueIds)]),
    versionIds: uniqueStrings([...normalizeStringArray(merged.versionIds), ...normalizeStringArray(contextObject.versionIds)]),
    resultIds: uniqueStrings([...normalizeStringArray(merged.resultIds), ...normalizeStringArray(contextObject.resultIds)]),
    auditIds: uniqueStrings([...normalizeStringArray(merged.auditIds), ...normalizeStringArray(contextObject.auditIds)]),
    outputPaths: uniqueStrings([...normalizeStringArray(merged.outputPaths), ...normalizeStringArray(contextObject.outputPaths)]),
    evidenceLinks: uniqueStrings([...normalizeStringArray(merged.evidenceLinks), ...normalizeStringArray(contextObject.evidenceLinks)]),
    validationEvidencePaths: uniqueStrings([...normalizeStringArray(merged.validationEvidencePaths), ...normalizeStringArray(contextObject.validationEvidencePaths)]),
    verificationEvidencePaths: uniqueStrings([...normalizeStringArray(merged.verificationEvidencePaths), ...normalizeStringArray(contextObject.verificationEvidencePaths)]),
    verifiedCriteria: normalizeDoveVerifiedCriteria(merged.verifiedCriteria ?? contextObject.verifiedCriteria),
    executionContract: normalizeDoveExecutionContract(merged.executionContract, null),
    context: contextObject
  };
}

export function readTaskPacketCatalog(root) {
  const index = readJsonReadOnly(root, ARTIFACT_PATHS.taskPacketsIndex, createTaskPacketsIndex);
  const items = Array.isArray(index.items) ? index.items : [];
  const resultsIndex = readOptionalJson(root, ARTIFACT_PATHS.experimentResults);
  const auditsIndex = readOptionalJson(root, ARTIFACT_PATHS.experimentAudits);
  const results = Array.isArray(resultsIndex?.items) ? resultsIndex.items : [];
  const audits = Array.isArray(auditsIndex?.items) ? auditsIndex.items : [];
  const byId = new Map();
  for (const item of items) {
    const packet = normalizePacketCandidate(root, item);
    if (packet.id) {
      const packetExperimentIds = new Set(packet.experimentIds);
      packet.resultIds = uniqueStrings([
        ...packet.resultIds,
        ...results.filter((result) => packetExperimentIds.has(result.experimentId)).map((result) => result.id)
      ]);
      packet.auditIds = uniqueStrings([
        ...packet.auditIds,
        ...audits.filter((audit) => packetExperimentIds.has(audit.experimentId) || packet.resultIds.includes(audit.resultId)).map((audit) => audit.id)
      ]);
      byId.set(packet.id, packet);
    }
  }
  return {
    index,
    packets: Array.from(byId.values()),
    byId
  };
}

function flattenFieldValues(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenFieldValues(item));
  }
  if (value && typeof value === "object") {
    return [];
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function collectValuesFromObjects(objects, fields = []) {
  const values = [];
  for (const object of objects) {
    if (!object || typeof object !== "object" || Array.isArray(object)) {
      continue;
    }
    for (const field of fields) {
      values.push(...flattenFieldValues(object[field]));
    }
  }
  return uniqueStrings(values);
}

function requestObjects(args = {}) {
  return [args, args.plan, args.result, args.audit, args.payload].filter((item) => item && typeof item === "object" && !Array.isArray(item));
}

function explicitPacketIds(objects = []) {
  const values = collectValuesFromObjects(objects, ["packetId", "taskPacketId", "missionPacketId", "taskId"]);
  const packetIds = collectValuesFromObjects(objects, ["packetIds", "taskPacketIds", "missionPacketIds", "taskIds"]);
  return uniqueStrings([...values, ...packetIds].map((value) => normalizeTaskPacketId(value)));
}

function targetTexts(objects = [], fields = []) {
  return collectValuesFromObjects(objects, fields).filter((value) => !explicitPacketIds(objects).includes(normalizeTaskPacketId(value)));
}

function artifactValues(objects = [], fields = []) {
  return collectValuesFromObjects(objects, fields);
}

function packetArtifactSet(packet) {
  return new Set(uniqueStrings([
    packet.id,
    packet.sourceId,
    packet.packetPath,
    packet.packetContextPath,
    packet.parentId,
    packet.rootId,
    ...normalizeStringArray(packet.dependencies),
    ...normalizeStringArray(packet.blockedBy),
    ...normalizeStringArray(packet.lessonIds),
    ...normalizeStringArray(packet.artifactRefs),
    ...normalizeStringArray(packet.claimIds),
    ...normalizeStringArray(packet.noteIds),
    ...normalizeStringArray(packet.experimentIds),
    ...normalizeStringArray(packet.rebuttalIssueIds),
    ...normalizeStringArray(packet.versionIds),
    ...normalizeStringArray(packet.resultIds),
    ...normalizeStringArray(packet.auditIds),
    ...normalizeStringArray(packet.outputPaths),
    ...normalizeStringArray(packet.evidenceLinks),
    ...normalizeStringArray(packet.validationEvidencePaths),
    ...normalizeStringArray(packet.verificationEvidencePaths),
    ...normalizeStringArray(packet.verifiedCriteria?.flatMap((item) => item.evidencePaths ?? []))
  ]));
}

function packetTextValues(packet) {
  return uniqueStrings([
    packet.id,
    packet.title,
    packet.summary,
    packet.currentFocus,
    packet.nextAction,
    packet.stage,
    packet.domain,
    packet.creatorKind,
    packet.sourceId,
    packet.sourceType ? `${packet.sourceType}:${packet.sourceId}` : null
  ].filter(Boolean));
}

function textScore(packet, targets = []) {
  let score = 0;
  const values = packetTextValues(packet);
  for (const target of targets) {
    const normalizedTarget = slugify(target);
    for (const value of values) {
      const normalizedValue = slugify(value);
      if (normalizedValue === normalizedTarget) {
        score = Math.max(score, 1);
      } else if (normalizedValue.includes(normalizedTarget) || normalizedTarget.includes(normalizedValue)) {
        score = Math.max(score, 0.75);
      } else if (String(value).toLowerCase().includes(String(target).toLowerCase())) {
        score = Math.max(score, 0.6);
      }
    }
  }
  return score;
}

function artifactScore(packet, values = []) {
  if (values.length === 0) {
    return 0;
  }
  const artifactSet = packetArtifactSet(packet);
  let matches = 0;
  for (const value of values) {
    if (artifactSet.has(value) || artifactSet.has(slugify(value))) {
      matches += 1;
    }
  }
  return matches > 0 ? Math.min(1, 0.7 + (matches / values.length) * 0.3) : 0;
}

function lifecycleScore(packet) {
  if (["active", "in-progress", "current"].includes(packet.lifecycleStatus) || ["active", "in-progress", "current"].includes(packet.status)) {
    return 0.4;
  }
  if (["waiting", "queued", "pending", "planned", "open"].includes(packet.lifecycleStatus) || ["waiting", "queued", "pending", "planned", "open"].includes(packet.status)) {
    return 0.25;
  }
  return 0.1;
}

function scorePackets(packets, targets, artifacts) {
  return packets.map((packet) => {
    const targetText = textScore(packet, targets);
    const artifact = artifactScore(packet, artifacts);
    const lifecycle = targets.length === 0 ? lifecycleScore(packet) : 0;
    const score = Math.max(targetText, artifact, lifecycle);
    return {
      packet,
      packetId: packet.id,
      score,
      matchedBy: {
        targetText,
        artifact,
        lifecycle
      }
    };
  }).filter((candidate) => candidate.score > 0).sort((left, right) => right.score - left.score || left.packetId.localeCompare(right.packetId));
}

function candidateScoreText(score) {
  return Number.isFinite(score) ? score.toFixed(2) : "0.00";
}

function candidateSummary(candidate = {}) {
  const packet = candidate.packet ?? {};
  return {
    packetId: candidate.packetId,
    title: packet.title ?? candidate.title ?? candidate.packetId,
    status: packet.status ?? candidate.status,
    level: packet.level ?? candidate.level,
    score: Number.isFinite(candidate.score) ? candidate.score : 0,
    matchedBy: candidate.matchedBy ?? {}
  };
}

function resolutionError(reason, candidates = [], details = {}) {
  const summaries = candidates.map((candidate) => candidateSummary(candidate));
  const candidateText = summaries.length > 0
    ? ` Candidates: ${summaries.map((candidate) => `${candidate.packetId}(${candidate.title ?? candidate.packetId}, score=${candidateScoreText(candidate.score)})`).join(", ")}.`
    : "";
  const error = new Error(`${reason}${candidateText} Provide packetId or confirm one candidate explicitly before writing.`);
  error.code = "TASK_PACKET_RESOLUTION_REQUIRED";
  error.reason = reason;
  error.candidates = summaries;
  if (details.artifactResolution) {
    error.artifactResolution = details.artifactResolution;
  }
  if (details.resolutionErrorCode) {
    error.resolutionErrorCode = details.resolutionErrorCode;
  }
  return error;
}

function hasResolutionSignal(targets = [], artifacts = []) {
  return targets.length > 0 || artifacts.length > 0;
}

function hasTiedTopCandidate(candidates = []) {
  return candidates.length > 1 && candidates[0].score === candidates[1].score;
}

function normalizeRelationId(value) {
  return typeof value === "string" && value.trim() ? normalizeTaskPacketId(value) : null;
}

function buildPacketRelationMap(packets = []) {
  const relationMap = new Map();
  for (const packet of packets) {
    const packetId = normalizeRelationId(packet?.id);
    if (packetId) {
      relationMap.set(packetId, packet);
    }
  }
  return relationMap;
}

function isDescendantPacket(ancestor, candidate, packetsById) {
  const ancestorId = normalizeRelationId(ancestor?.id);
  let parentId = normalizeRelationId(candidate?.parentId);
  const seen = new Set();
  while (ancestorId && parentId && !seen.has(parentId)) {
    if (parentId === ancestorId) {
      return true;
    }
    seen.add(parentId);
    const parent = packetsById.get(parentId);
    parentId = normalizeRelationId(parent?.parentId);
  }
  return false;
}

function packetRelation(selected, candidate, packetsById) {
  const selectedId = normalizeRelationId(selected?.id);
  const candidateId = normalizeRelationId(candidate?.id);
  if (!selectedId || !candidateId) {
    return "unrelated";
  }
  if (candidateId === selectedId) {
    return "self";
  }
  if (isDescendantPacket(selected, candidate, packetsById)) {
    return "descendant";
  }
  if (isDescendantPacket(candidate, selected, packetsById)) {
    return "ancestor";
  }
  const selectedParentId = normalizeRelationId(selected?.parentId);
  const candidateParentId = normalizeRelationId(candidate?.parentId);
  if (selectedParentId && candidateParentId && selectedParentId === candidateParentId) {
    return "sibling";
  }
  const selectedRootId = normalizeRelationId(selected?.rootId);
  const candidateRootId = normalizeRelationId(candidate?.rootId);
  if (selectedRootId && candidateRootId && selectedRootId !== candidateRootId) {
    return "other-root";
  }
  return "unrelated";
}

function matchedArtifactsForPacket(packet, artifacts = []) {
  const artifactSet = packetArtifactSet(packet);
  return uniqueStrings(artifacts.filter((artifact) => artifactSet.has(artifact) || artifactSet.has(slugify(artifact))));
}

function artifactMatchSummary(packet, artifacts = [], relation = null) {
  const score = artifactScore(packet, artifacts);
  return {
    packetId: packet.id,
    title: packet.title ?? packet.id,
    status: packet.status,
    level: packet.level,
    relation,
    score,
    matchedBy: { artifact: score },
    matchedArtifacts: matchedArtifactsForPacket(packet, artifacts)
  };
}

export function analyzeArtifactConsistency(packet, packets, artifacts = []) {
  const requestedArtifacts = uniqueStrings(artifacts);
  const selectedPacketId = normalizeRelationId(packet?.id);
  if (!packet || requestedArtifacts.length === 0) {
    return {
      selectedPacketId,
      requestedArtifacts,
      matchingPackets: [],
      acceptedMatches: [],
      conflictingMatches: [],
      hasConflict: false,
      explanationCode: requestedArtifacts.length === 0 ? "no-artifacts" : "no-selected-packet"
    };
  }
  const packetsById = buildPacketRelationMap(packets);
  const matchingPackets = packets
    .filter((candidate) => artifactScore(candidate, requestedArtifacts) > 0)
    .map((candidate) => artifactMatchSummary(candidate, requestedArtifacts, packetRelation(packet, candidate, packetsById)));
  const acceptedMatches = matchingPackets.filter((match) => ["self", "descendant"].includes(match.relation));
  const conflictingMatches = matchingPackets.filter((match) => !["self", "descendant"].includes(match.relation));
  const hasConflict = conflictingMatches.length > 0;
  const explanationCode = hasConflict
    ? "artifact-conflict"
    : acceptedMatches.some((match) => match.relation === "descendant")
      ? "accepted-descendant-artifacts"
      : acceptedMatches.some((match) => match.relation === "self")
        ? "accepted-self-artifacts"
        : "no-existing-artifact-owner";
  return {
    selectedPacketId,
    requestedArtifacts,
    matchingPackets,
    acceptedMatches,
    conflictingMatches,
    hasConflict,
    explanationCode
  };
}

function ensureArtifactConsistency(packet, packets, artifacts = []) {
  const artifactResolution = analyzeArtifactConsistency(packet, packets, artifacts);
  if (artifactResolution.hasConflict) {
    throw resolutionError(`Task target artifact ids conflict with packet ${packet.id}.`, artifactResolution.conflictingMatches.map((match) => ({
      packetId: match.packetId,
      title: match.title,
      status: match.status,
      level: match.level,
      score: match.score,
      matchedBy: match.matchedBy
    })), {
      artifactResolution,
      resolutionErrorCode: artifactResolution.explanationCode
    });
  }
  return artifactResolution;
}

export function resolveDurableTaskPacket(root, args = {}, options = {}) {
  const settings = options.settings ?? readTaskTargetResolutionSettings(root);
  const catalog = readTaskPacketCatalog(root);
  const objects = requestObjects(args);
  const explicitIds = explicitPacketIds(objects);
  const targets = targetTexts(objects, options.targetFields ?? []);
  const artifacts = artifactValues(objects, options.artifactFields ?? []);

  if (explicitIds.length > 1) {
    throw resolutionError(`Task target fields point to multiple packet ids: ${explicitIds.join(", ")}.`);
  }

  if (explicitIds.length === 1) {
    const packet = catalog.byId.get(explicitIds[0]);
    if (!packet) {
      throw resolutionError(`Task target packet ${explicitIds[0]} does not exist in ${ARTIFACT_PATHS.taskPacketsIndex}.`);
    }
    const artifactResolution = ensureArtifactConsistency(packet, catalog.packets, artifacts);
    return {
      packet,
      packetId: packet.id,
      resolution: {
        mode: "explicit-packet-id",
        autoSelect: settings.autoSelect,
        candidates: [{ packetId: packet.id, score: 1 }],
        artifactResolution
      },
      artifactIds: artifacts,
      artifactResolution
    };
  }

  if (catalog.packets.length === 0) {
    throw new Error(`Task-scoped write requires a durable task packet before writing. No packets exist in ${ARTIFACT_PATHS.taskPacketsIndex}. Launch or materialize a Dove mission packet first.`);
  }

  const candidates = scorePackets(catalog.packets, targets, artifacts);
  if (candidates.length === 0) {
    throw resolutionError("Task-scoped write could not resolve a durable task packet.");
  }

  const top = candidates[0];
  const explicitResolutionSignal = hasResolutionSignal(targets, artifacts);
  if (!explicitResolutionSignal && candidates.length > 1) {
    throw resolutionError("Task target requires confirmation because no packetId, natural-language target, or linked artifact was provided.", candidates);
  }
  if (!settings.autoSelect && candidates.length > 1) {
    throw resolutionError("Task target is ambiguous and autoSelect is false.", candidates);
  }
  if (settings.autoSelect && hasTiedTopCandidate(candidates)) {
    throw resolutionError("Task target requires confirmation because multiple durable packets have the same top confidence.", candidates);
  }
  if (settings.autoSelect && top.matchedBy.targetText > 0 && top.score < settings.autoSelectMinScore) {
    throw resolutionError(`Task target confidence ${top.score.toFixed(2)} is below autoSelectMinScore ${settings.autoSelectMinScore}.`, candidates);
  }
  const artifactResolution = ensureArtifactConsistency(top.packet, catalog.packets, artifacts);

  return {
    packet: top.packet,
    packetId: top.packet.id,
    resolution: {
      mode: settings.autoSelect ? "auto-selected" : "unique-candidate",
      autoSelect: settings.autoSelect,
      candidates: candidates.map((candidate) => ({
        packetId: candidate.packetId,
        score: candidate.score,
        matchedBy: candidate.matchedBy
      })),
      selectedScore: top.score,
      artifactResolution
    },
    artifactIds: artifacts,
    artifactResolution
  };
}

export function assertResolvedTaskPacket(root, args = {}, options = {}) {
  return resolveDurableTaskPacket(root, args, options);
}
