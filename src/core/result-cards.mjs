import { doveText } from "./i18n.mjs";
import { normalizeDoveExecutionReceipt } from "./schema.mjs";

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

function compactPlainObject(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (value && typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return true;
  }));
}

function isCompactInternalReference(value) {
  const text = normalizeString(value, "") ?? "";
  return text.startsWith(".dove/") || /sourceSvgPath|finalSvgPath|outputManifestPath|svgContent|qaPath|source-svg|output-manifest|figure-qa/u.test(text);
}

function compactPublicStringArray(value) {
  return normalizeStringArray(value).filter((item) => !isCompactInternalReference(item));
}

function publicBoundaryType(value) {
  const boundaryType = normalizeString(value, null);
  if (!boundaryType) {
    return null;
  }
  if (["awaiting-audio-review-output"].includes(boundaryType)) {
    return "awaiting-review-output";
  }
  if (["missing-secret-env", "provider-failed"].includes(boundaryType)) {
    return "awaiting-provider-output";
  }
  if (boundaryType.startsWith("audio-review-") || boundaryType === "needs-review") {
    return "verification-failed";
  }
  return boundaryType;
}

function publicOutcome(value) {
  const outcome = normalizeString(value, null);
  if (!outcome) {
    return null;
  }
  return publicBoundaryType(outcome) ?? outcome;
}

function publicBoundaryDetail(value) {
  const detail = { ...(normalizePlainObject(value?.detail) ?? {}) };
  for (const key of ["implementationBoundaryType", "implementationReason", "providerStatus", "providerError", "reason"]) {
    delete detail[key];
  }
  return compactPlainObject(detail);
}

function sanitizeBoundary(value) {
  const boundary = normalizePlainObject(value);
  if (!boundary) {
    return null;
  }
  const publicType = publicBoundaryType(boundary.type ?? boundary.boundaryType);
  const sanitized = { ...boundary };
  if (publicType) {
    sanitized.type = publicType;
  }
  if (sanitized.boundaryType) {
    sanitized.boundaryType = publicBoundaryType(sanitized.boundaryType) ?? sanitized.boundaryType;
  }
  delete sanitized.id;
  delete sanitized.reason;
  for (const key of ["artifactRefs", "artifactPaths", "evidenceLinks", "evidencePaths", "validationEvidencePaths", "validationOutputPaths", "resultPath", "qaPath"]) {
    delete sanitized[key];
  }
  for (const key of ["requiredInputs", "requiredActions", "requires"]) {
    if (Array.isArray(sanitized[key])) {
      sanitized[key] = compactPublicStringArray(sanitized[key]);
      if (sanitized[key].length === 0) {
        delete sanitized[key];
      }
    }
  }
  const detail = publicBoundaryDetail(boundary);
  if (Object.keys(detail).length > 0) {
    sanitized.detail = detail;
  } else {
    delete sanitized.detail;
  }
  return sanitized;
}

function sanitizeHandoffSuggestion(value) {
  const handoff = normalizePlainObject(value);
  if (!handoff) {
    return null;
  }
  const publicType = publicBoundaryType(handoff.boundaryType ?? handoff.type);
  const sanitized = { ...handoff };
  if (publicType) {
    sanitized.boundaryType = publicType;
  }
  if (sanitized.type) {
    sanitized.type = publicBoundaryType(sanitized.type) ?? sanitized.type;
  }
  delete sanitized.reason;
  const detail = publicBoundaryDetail(handoff);
  if (Object.keys(detail).length > 0) {
    sanitized.detail = detail;
  } else {
    delete sanitized.detail;
  }
  return sanitized;
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

function compactExecutionReceipt(value) {
  const receipt = normalizeDoveExecutionReceipt(value, null);
  if (!receipt) {
    return null;
  }
  return {
    receiptId: receipt.receiptId ?? null,
    runId: receipt.runId ?? null,
    packetId: receipt.packetId ?? null,
    surface: receipt.surface ?? null,
    command: receipt.command ?? null,
    actionType: receipt.actionType ?? null,
    status: receipt.status ?? null,
    outcome: receipt.outcome ?? null,
    resultSummary: receipt.publicSafeSummary ?? receipt.resultSummary ?? null,
    lifecycleTransition: receipt.lifecycleTransition ?? null,
    evidenceCount: normalizeStringArray([
      ...normalizeStringArray(receipt.evidenceLinks),
      ...normalizeStringArray(receipt.evidencePaths),
      ...normalizeStringArray(receipt.artifactRefs),
      ...normalizeStringArray(receipt.artifactPaths),
      ...normalizeStringArray(receipt.validationEvidencePaths),
      ...normalizeStringArray(receipt.verificationEvidencePaths)
    ]).length,
    criteriaCoverage: receipt.criteriaCoverage ?? null,
    nextAction: receipt.nextAction ?? null
  };
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
  const boundary = sanitizeBoundary(action.boundary);
  const handoffSuggestion = sanitizeHandoffSuggestion(action.handoffSuggestion);
  return {
    kind: normalizeString(action.kind, null),
    title: normalizeString(action.title ?? action.label, command ? doveText(responseLanguage, "resultCardNextStatus") : doveText(responseLanguage, "compactCardFirstActionFallback")),
    why: normalizeString(action.why, null),
    command,
    packetId: normalizeString(action.packetId, null),
    requires: compactPublicStringArray(action.requires),
    requiredInputs: compactPublicStringArray(action.requiredInputs),
    requiredActions: compactPublicStringArray(action.requiredActions),
    boundary,
    boundaryId: normalizeString(action.boundaryId, null),
    boundaryType: publicBoundaryType(action.boundaryType) ?? boundary?.type ?? null,
    ownerRole: normalizeString(action.ownerRole, null),
    nextRole: normalizeString(action.nextRole, null),
    handoff: normalizePlainObject(action.handoff),
    handoffSuggestion,
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
    || ["blocked", "blocked-boundary", "awaiting-host-pass", "awaiting-host-results", "needs-host-results", "needs-completion-evidence", "needs-explicit-progress-step", "needs-review", "prepared-awaiting-audio", "prepared-awaiting-output", "step-budget-exhausted", "max-iterations-exhausted", "stopped-killed"].includes(statusText)
    || /awaiting|missing|required|blocked|failed|exhausted|needs-/u.test(String(stopReason ?? ""));
}

export function buildCommandResultCard(details = {}, responseLanguage = "zh") {
  const receipt = normalizeDoveExecutionReceipt(details.executionReceipt, null);
  const executionReceipt = compactExecutionReceipt(receipt);
  const evidence = [
    ...normalizeStringArray(details.evidenceLinks),
    ...normalizeStringArray(details.evidencePaths),
    ...normalizeStringArray(details.artifactRefs),
    ...normalizeStringArray(details.artifactPaths),
    ...normalizeStringArray(details.evidence),
    ...normalizeStringArray(details.artifacts),
    ...normalizeStringArray(receipt?.evidenceLinks),
    ...normalizeStringArray(receipt?.evidencePaths),
    ...normalizeStringArray(receipt?.artifactRefs),
    ...normalizeStringArray(receipt?.artifactPaths)
  ];
  const validation = [
    ...normalizeStringArray(details.validationEvidence),
    ...normalizeStringArray(details.validationEvidencePaths),
    ...normalizeStringArray(details.validation),
    ...normalizeStringArray(details.validationOutputPaths),
    ...normalizeStringArray(receipt?.validationEvidencePaths),
    ...normalizeStringArray(receipt?.verificationEvidencePaths)
  ];
  const status = normalizeString(details.status, null);
  const boundary = sanitizeBoundary(details.boundary);
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
    executionReceipt,
    title: normalizeString(details.title, null),
    status,
    outcome: publicOutcome(details.outcome),
    happened: normalizeString(details.happened ?? details.summary, doveText(responseLanguage, "resultCardHappenedFallback")),
    durableWrites: compactResultList(details.durableWrites, doveText(responseLanguage, "resultCardNoDurableWrites")),
    evidence: compactResultList(evidence, doveText(responseLanguage, "resultCardNoEvidence")),
    evidenceExplanation,
    evidenceSelection,
    artifactConflicts,
    validation: compactResultList(validation, doveText(responseLanguage, "resultCardNoValidation")),
    codeChanges: compactResultList(details.codeChanges, doveText(responseLanguage, "resultCardCodeNotInspected")),
    boundary,
    scope: normalizePlainObject(details.scope),
    taskStatusBefore: normalizeString(details.taskStatusBefore, null),
    taskStatusAfter: normalizeString(details.taskStatusAfter, null),
    nextActions: resultActions(details.nextActions, details.nextAction, responseLanguage),
    preActionGuidanceSummary: normalizePlainObject(details.preActionGuidanceSummary),
    foreground: details.foreground === undefined ? null : Boolean(details.foreground),
    background: details.background === undefined ? null : Boolean(details.background),
    daemon: details.daemon === undefined ? null : Boolean(details.daemon),
    completed: status === "completed",
    stopped: Boolean(stopReason || boundary || ["blocked", "blocked-boundary", "awaiting-host-pass", "awaiting-host-results", "needs-host-results", "needs-completion-evidence", "needs-explicit-progress-step", "needs-review", "prepared-awaiting-output", "step-budget-exhausted", "max-iterations-exhausted", "stopped-killed"].includes(status ?? "")),
    requiresAction: requiresAction(status, boundary, stopReason),
    proposalOnly: false,
    confirmationRequired: false
  };
}
