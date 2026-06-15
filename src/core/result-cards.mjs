import { doveText } from "./i18n.mjs";

function normalizeString(value, fallback = null) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean)));
}

function compactResultList(values = [], fallback) {
  const normalized = normalizeStringArray(values);
  return normalized.length > 0 ? normalized : [fallback];
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeMatchArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item) => ({
    packetId: normalizeString(item.packetId, null),
    title: normalizeString(item.title, null),
    status: normalizeString(item.status, null),
    level: Number.isFinite(item.level) ? item.level : null,
    relation: normalizeString(item.relation, null),
    score: Number.isFinite(item.score) ? item.score : null,
    matchedBy: normalizePlainObject(item.matchedBy) ?? {},
    matchedArtifacts: normalizeStringArray(item.matchedArtifacts)
  }));
}

function resultAction(action, responseLanguage = "zh") {
  if (typeof action === "string" && action.trim()) {
    return {
      title: doveText(responseLanguage, "resultCardNextStatus"),
      command: action.trim(),
      proposalOnly: true,
      noAutoApply: true
    };
  }
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    return null;
  }
  const command = normalizeString(action.command ?? action.nextAction, null);
  return {
    kind: normalizeString(action.kind, null),
    title: normalizeString(action.title ?? action.label, command ? doveText(responseLanguage, "resultCardNextStatus") : doveText(responseLanguage, "compactCardFirstActionFallback")),
    why: normalizeString(action.why, null),
    command,
    packetId: normalizeString(action.packetId, null),
    requires: normalizeStringArray(action.requires),
    requiredInputs: normalizeStringArray(action.requiredInputs),
    requiredActions: normalizeStringArray(action.requiredActions),
    boundary: normalizePlainObject(action.boundary),
    boundaryId: normalizeString(action.boundaryId, null),
    boundaryType: normalizeString(action.boundaryType, null),
    ownerRole: normalizeString(action.ownerRole, null),
    nextRole: normalizeString(action.nextRole, null),
    handoff: normalizePlainObject(action.handoff),
    handoffSuggestion: normalizePlainObject(action.handoffSuggestion),
    proposalOnly: true,
    noAutoApply: true,
    confirmationRequired: action.confirmationRequired === true ? true : undefined
  };
}

function resultActions(actions = [], nextAction = null, responseLanguage = "zh") {
  const sourceActions = Array.isArray(actions) && actions.length > 0
    ? actions
    : (nextAction ? [{ title: doveText(responseLanguage, "resultCardNextStatus"), command: nextAction }] : []);
  return sourceActions.map((action) => resultAction(action, responseLanguage)).filter(Boolean);
}

function requiresAction(status, boundary, stopReason) {
  const statusText = normalizeString(status, "") ?? "";
  return Boolean(boundary)
    || ["blocked", "blocked-boundary", "awaiting-host-pass", "awaiting-host-results", "prepared-awaiting-audio", "step-budget-exhausted", "stopped-killed"].includes(statusText)
    || /awaiting|missing|required|blocked|failed|exhausted/u.test(String(stopReason ?? ""));
}

export function buildCommandResultCard(details = {}, responseLanguage = "zh") {
  const evidence = [
    ...normalizeStringArray(details.evidenceLinks),
    ...normalizeStringArray(details.evidencePaths),
    ...normalizeStringArray(details.artifactRefs),
    ...normalizeStringArray(details.artifactPaths),
    ...normalizeStringArray(details.evidence),
    ...normalizeStringArray(details.artifacts)
  ];
  const validation = [
    ...normalizeStringArray(details.validationEvidence),
    ...normalizeStringArray(details.validationEvidencePaths),
    ...normalizeStringArray(details.validation),
    ...normalizeStringArray(details.validationOutputPaths)
  ];
  const status = normalizeString(details.status, null);
  const boundary = details.boundary ?? null;
  const stopReason = normalizeString(details.stopReason, null);
  const artifactResolution = normalizePlainObject(details.artifactResolution);
  const evidenceExplanation = normalizePlainObject(details.evidenceExplanation);
  const evidenceSelection = artifactResolution ? {
    selectedPacketId: normalizeString(artifactResolution.selectedPacketId, null),
    requestedArtifacts: normalizeStringArray(artifactResolution.requestedArtifacts),
    explanationCode: normalizeString(artifactResolution.explanationCode, null),
    acceptedMatches: normalizeMatchArray(artifactResolution.acceptedMatches),
    matchingPackets: normalizeMatchArray(artifactResolution.matchingPackets)
  } : null;
  const artifactConflicts = normalizeMatchArray(artifactResolution?.conflictingMatches);
  return {
    presentation: "compact-result-summary-card",
    surface: normalizeString(details.surface, null),
    command: normalizeString(details.command, null),
    packetId: normalizeString(details.packetId, null),
    packetIds: normalizeStringArray(details.packetIds),
    runId: normalizeString(details.runId ?? details.id, null),
    title: normalizeString(details.title, null),
    status,
    outcome: normalizeString(details.outcome, null),
    happened: normalizeString(details.happened ?? details.summary, doveText(responseLanguage, "resultCardHappenedFallback")),
    durableWrites: compactResultList(details.durableWrites, doveText(responseLanguage, "resultCardNoDurableWrites")),
    evidence: compactResultList(evidence, doveText(responseLanguage, "resultCardNoEvidence")),
    evidenceExplanation,
    evidenceSelection,
    artifactConflicts,
    validation: compactResultList(validation, doveText(responseLanguage, "resultCardNoValidation")),
    codeChanges: compactResultList(details.codeChanges, doveText(responseLanguage, "resultCardCodeNotInspected")),
    stopReason,
    boundary,
    taskStatusBefore: normalizeString(details.taskStatusBefore, null),
    taskStatusAfter: normalizeString(details.taskStatusAfter, null),
    nextActions: resultActions(details.nextActions, details.nextAction, responseLanguage),
    foreground: details.foreground === undefined ? null : Boolean(details.foreground),
    background: details.background === undefined ? null : Boolean(details.background),
    daemon: details.daemon === undefined ? null : Boolean(details.daemon),
    completed: status === "completed",
    stopped: Boolean(stopReason || boundary || ["blocked", "blocked-boundary", "awaiting-host-pass", "awaiting-host-results", "step-budget-exhausted", "stopped-killed"].includes(status ?? "")),
    requiresAction: requiresAction(status, boundary, stopReason),
    proposalOnly: false,
    confirmationRequired: false
  };
}
