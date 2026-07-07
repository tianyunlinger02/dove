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

function compactResultList(values = [], fallback, internalFallback = fallback) {
  const normalized = normalizeStringArray(values);
  const publicValues = compactPublicStringArray(normalized);
  if (publicValues.length > 0) {
    return publicValues;
  }
  return normalized.length > 0 ? [internalFallback] : [fallback];
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

const COMPACT_INTERNAL_FIELD_PATTERN = /^(?:id|packetId|packetIds|taskPacketId|missionPacketId|runId|receiptId|boundaryId|boundaryType|implementationBoundaryType|implementationReason|ownerRole|nextRole|handoff|handoffSuggestion|providerId|providerStatus|providerError|apiKeyEnv|sourceSvgPath|targetFinalSvgPath|finalSvgPath|outputManifestPath|svgContent|qaPath|resultPath|mutationMode|operatorRoute|queueSummary|queuePreview|preActionGuidance|preActionGuidanceSummary|executionReceipt|fullResult|diagnostics)$/u;
const COMPACT_INTERNAL_STRING_PATTERN = /\.dove\/|\bproject:dove\.[a-z0-9.-]+|--packet-id\b|\b(?:packetId|taskPacketId|missionPacketId|runId|receiptId|boundaryId|boundaryType|mutationMode|patch-plan|direct-process|ownerRole|nextRole|handoff|providerId|sourceSvgPath|targetFinalSvgPath|finalSvgPath|outputManifestPath|svgContent|queueSummary|queuePreview|preActionGuidance|resultCard)\b|\b(?:query_dove_status|run_dove_auto|record_dove_mission_pass|run_figure_workflow|run_dove_operator|record_document_evidence|upsert_note|upsert_draft|register_source)\b/u;

function isCompactInternalFieldName(value) {
  const key = String(value ?? "");
  return COMPACT_INTERNAL_FIELD_PATTERN.test(key) || /(?:^|[A-Za-z])Ids?$/u.test(key);
}

function isCompactInternalReference(value) {
  const text = normalizeString(value, "") ?? "";
  return COMPACT_INTERNAL_STRING_PATTERN.test(text) || /source-svg|output-manifest|figure-qa/u.test(text);
}

function compactPublicValue(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => compactPublicValue(item)).filter((item) => item !== null && item !== undefined && item !== "")));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([key]) => !isCompactInternalFieldName(key))
      .map(([key, item]) => [key, compactPublicValue(item)])
      .filter(([, item]) => {
        if (item === null || item === undefined || item === "") {
          return false;
        }
        if (Array.isArray(item)) {
          return item.length > 0;
        }
        if (item && typeof item === "object") {
          return Object.keys(item).length > 0;
        }
        return true;
      });
    return compactPlainObject(Object.fromEntries(entries));
  }
  if (typeof value === "string") {
    const text = normalizeString(value, null);
    return text && !isCompactInternalReference(text) ? text : null;
  }
  return value === null || value === undefined ? null : value;
}

function compactPublicObject(value) {
  const object = normalizePlainObject(value);
  if (!object) {
    return null;
  }
  return compactPublicValue(object);
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
  return compactPublicObject(value?.detail) ?? null;
}

function sanitizeBoundary(value) {
  const boundary = normalizePlainObject(value);
  if (!boundary) {
    return null;
  }
  const detail = publicBoundaryDetail(boundary);
  return compactPlainObject({
    type: publicBoundaryType(boundary.type ?? boundary.boundaryType),
    title: compactPublicValue(boundary.title ?? boundary.label),
    summary: compactPublicValue(boundary.summary ?? boundary.message),
    why: compactPublicValue(boundary.why),
    nextAction: compactPublicValue(boundary.nextAction ?? boundary.action),
    requiredInputs: compactPublicStringArray(boundary.requiredInputs),
    requiredActions: compactPublicStringArray(boundary.requiredActions),
    requires: compactPublicStringArray(boundary.requires),
    confirmationRequired: boundary.confirmationRequired === true ? true : undefined,
    detail
  });
}

function sanitizeHandoffSuggestion(value) {
  const handoff = normalizePlainObject(value);
  if (!handoff) {
    return null;
  }
  return compactPlainObject({
    title: compactPublicValue(handoff.title ?? handoff.label),
    summary: compactPublicValue(handoff.summary ?? handoff.message),
    why: compactPublicValue(handoff.why),
    type: publicBoundaryType(handoff.type ?? handoff.boundaryType),
    requiredInputs: compactPublicStringArray(handoff.requiredInputs),
    requiredActions: compactPublicStringArray(handoff.requiredActions),
    detail: publicBoundaryDetail(handoff)
  });
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
  return compactPlainObject({
    status: normalizeString(receipt.status, null),
    outcome: publicOutcome(receipt.outcome),
    resultSummary: compactPublicValue(receipt.publicSafeSummary ?? receipt.resultSummary),
    evidenceCount: normalizeStringArray([
      ...normalizeStringArray(receipt.evidenceLinks),
      ...normalizeStringArray(receipt.evidencePaths),
      ...normalizeStringArray(receipt.artifactRefs),
      ...normalizeStringArray(receipt.artifactPaths),
      ...normalizeStringArray(receipt.validationEvidencePaths),
      ...normalizeStringArray(receipt.verificationEvidencePaths)
    ]).length,
    criteriaCoverage: compactPublicObject(receipt.criteriaCoverage)
  });
}

function publicActionTitle(value, responseLanguage) {
  const text = normalizeString(value, null);
  if (!text || isCompactInternalReference(text)) {
    return doveText(responseLanguage, "resultCardNextStatus");
  }
  return text;
}

function resultAction(action, responseLanguage = "zh") {
  if (typeof action === "string" && action.trim()) {
    return {
      title: publicActionTitle(action, responseLanguage),
      proposalOnly: true,
      noAutoApply: true
    };
  }
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    return null;
  }
  const command = normalizeString(action.command ?? action.nextAction, null);
  const title = normalizeString(action.title ?? action.label, null) ?? publicActionTitle(command, responseLanguage) ?? doveText(responseLanguage, "compactCardFirstActionFallback");
  return compactPlainObject({
    title,
    why: compactPublicValue(action.why),
    requiredInputs: compactPublicStringArray(action.requiredInputs),
    requiredActions: compactPublicStringArray(action.requiredActions),
    proposalOnly: true,
    noAutoApply: true,
    confirmationRequired: action.confirmationRequired === true ? true : undefined
  });
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
  const happened = compactPublicValue(details.happened ?? details.summary) ?? doveText(responseLanguage, "resultCardHappenedFallback");
  return compactPlainObject({
    presentation: "compact-result-summary-card",
    surface: normalizeString(details.surface, null),
    command: normalizeString(details.command, null),
    executionReceipt,
    title: compactPublicValue(details.title),
    status,
    outcome: publicOutcome(details.outcome),
    happened,
    durableWrites: compactResultList(details.durableWrites, doveText(responseLanguage, "resultCardNoDurableWrites"), doveText(responseLanguage, "resultCardDurableWritesHidden")),
    evidence: compactResultList(evidence, doveText(responseLanguage, "resultCardNoEvidence"), doveText(responseLanguage, "resultCardEvidenceHidden")),
    evidenceExplanation: compactPublicObject(details.evidenceExplanation),
    validation: compactResultList(validation, doveText(responseLanguage, "resultCardNoValidation"), doveText(responseLanguage, "resultCardValidationHidden")),
    codeChanges: compactResultList(details.codeChanges, doveText(responseLanguage, "resultCardCodeNotInspected"), doveText(responseLanguage, "resultCardDetailsAvailable")),
    boundary,
    scope: compactPublicObject(details.scope),
    taskStatusBefore: normalizeString(details.taskStatusBefore, null),
    taskStatusAfter: normalizeString(details.taskStatusAfter, null),
    nextActions: resultActions(details.nextActions, details.nextAction, responseLanguage),
    completed: status === "completed",
    stopped: Boolean(stopReason || boundary || ["blocked", "blocked-boundary", "awaiting-host-pass", "awaiting-host-results", "needs-host-results", "needs-completion-evidence", "needs-explicit-progress-step", "needs-review", "prepared-awaiting-output", "step-budget-exhausted", "max-iterations-exhausted", "stopped-killed"].includes(status ?? "")),
    requiresAction: requiresAction(status, boundary, stopReason),
    detailsAvailable: true,
    showMore: {
      text: doveText(responseLanguage, "resultCardDetailsAvailable")
    }
  });
}
