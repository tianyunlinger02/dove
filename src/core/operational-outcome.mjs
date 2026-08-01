import {
  operationClosure,
  operationContinuation,
  operationInteraction,
  operationRequiresCheckpoint,
  operationRetry,
  operationStatus
} from "./operation-registry.mjs";

const INVOCATION_OUTCOME_KINDS = new Set(["succeeded", "declined", "cancelled", "failed", "continuation"]);
const OUTCOME_CATEGORIES = new Set([
  "success",
  "success-zero-write",
  "awaiting-approval",
  "declined",
  "cancelled",
  "invalid-input",
  "ambiguous-target",
  "not-found",
  "stale-state",
  "capability-unavailable",
  "blocked",
  "evidence-incomplete",
  "operational-failure",
  "internal-failure"
]);
const OUTCOME_PHASES = new Set(["approval", "validation", "selection", "read", "execution", "evidence", "internal"]);
const USER_ACTIONS = new Set(["none", "approve-or-cancel", "clarify-input", "select-target", "refresh-state", "enable-capability", "resolve-blocker", "provide-evidence", "retry-explicitly", "reassess-read-only"]);
const CONTINUATIONS = new Set(["terminal", "resume-original"]);
const CLOSURES = new Set(["none", "host-outcome", "research-outcome", "domain"]);
const RETRIES = new Set(["none", "explicit-request"]);

function normalizeStatus(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function assertEnum(value, allowed, label) {
  if (!allowed.has(value)) throw new Error(`Unsupported invocation ${label}: ${value}`);
  return value;
}

function deriveOutcomeSemantics(kind, reason, { zeroWrite = false } = {}) {
  if (kind === "declined") return { category: "declined", phase: "approval", blocking: false, userAction: "none" };
  if (kind === "cancelled") return { category: "cancelled", phase: "approval", blocking: false, userAction: "none" };
  if (kind === "succeeded" || kind === "continuation") return { category: zeroWrite ? "success-zero-write" : "success", phase: "execution", blocking: false, userAction: "none" };
  return { category: reason === "internal-failure" || reason === "unknown-operation-status" ? "internal-failure" : "operational-failure", phase: reason === "internal-failure" || reason === "unknown-operation-status" ? "internal" : "execution", blocking: true, userAction: "retry-explicitly" };
}

export function createInvocationOutcome({
  kind,
  category,
  phase,
  blocking,
  userAction,
  continuation = "terminal",
  closure = "none",
  retry = "none",
  terminal,
  reason = null,
  zeroWrite = false
}) {
  assertEnum(kind, INVOCATION_OUTCOME_KINDS, "outcome kind");
  assertEnum(continuation, CONTINUATIONS, "continuation");
  assertEnum(closure, CLOSURES, "closure");
  assertEnum(retry, RETRIES, "retry policy");
  const semantics = deriveOutcomeSemantics(kind, reason, { zeroWrite });
  const selectedCategory = category ?? semantics.category;
  const selectedPhase = phase ?? semantics.phase;
  const selectedUserAction = userAction ?? semantics.userAction;
  assertEnum(selectedCategory, OUTCOME_CATEGORIES, "category");
  assertEnum(selectedPhase, OUTCOME_PHASES, "phase");
  assertEnum(selectedUserAction, USER_ACTIONS, "user action");
  return Object.freeze({
    kind,
    category: selectedCategory,
    phase: selectedPhase,
    blocking: blocking ?? semantics.blocking,
    userAction: selectedUserAction,
    terminal: terminal ?? continuation === "terminal",
    continuation,
    closure,
    retry,
    ...(typeof reason === "string" && reason.trim() ? { reason: reason.trim() } : {})
  });
}

function registeredStatus(result, operation) {
  const status = normalizeStatus(result?.status ?? result?.outcome);
  return { status, semantics: operationStatus(operation, status) };
}

export function classifyInvocationOutcome(result, operation, invocationArgs = result) {
  const { status, semantics } = registeredStatus(result, operation);
  const readOnly = operationInteraction(operation, invocationArgs) === "read";
  if (!semantics) {
    return createInvocationOutcome({
      kind: "failed",
      category: "internal-failure",
      phase: "internal",
      blocking: true,
      userAction: "retry-explicitly",
      continuation: "terminal",
      closure: "none",
      retry: "none",
      reason: "unknown-operation-status",
      zeroWrite: result?.zeroWrite === true
    });
  }
  if (semantics.outcome === "proposal") {
    if (!operationRequiresCheckpoint(operation, invocationArgs)) {
      return createInvocationOutcome({ kind: "failed", category: "internal-failure", phase: "internal", blocking: true, userAction: "retry-explicitly", continuation: "terminal", closure: "none", retry: "none", reason: "unexpected-proposal-status", zeroWrite: true });
    }
    return createInvocationOutcome({ kind: "continuation", category: semantics.category, phase: semantics.phase, blocking: false, userAction: semantics.userAction, continuation: "terminal", closure: "none", retry: semantics.retry ?? "none", reason: "checkpoint-approval-required", zeroWrite: true });
  }
  if (semantics.outcome === "declined" || semantics.outcome === "cancelled") {
    return createInvocationOutcome({
      kind: semantics.outcome,
      category: semantics.category,
      phase: semantics.phase,
      blocking: false,
      userAction: semantics.userAction,
      continuation: "terminal",
      closure: "none",
      retry: semantics.retry ?? operationRetry(operation, semantics.outcome),
      reason: semantics.outcome === "declined" ? "checkpoint-declined" : "checkpoint-cancelled",
      zeroWrite: true
    });
  }
  if (semantics.outcome === "failure") {
    return createInvocationOutcome({
      kind: "failed",
      category: semantics.category,
      phase: semantics.phase,
      blocking: true,
      userAction: semantics.userAction,
      continuation: "terminal",
      closure: "none",
      retry: semantics.retry ?? operationRetry(operation, "failed"),
      reason: status,
      zeroWrite: result?.zeroWrite === true
    });
  }
  if (semantics.outcome === "replay") {
    return createInvocationOutcome({
      kind: "succeeded",
      category: semantics.category,
      phase: readOnly ? "read" : semantics.phase,
      blocking: false,
      userAction: semantics.userAction,
      continuation: "terminal",
      closure: "none",
      retry: semantics.retry ?? "none",
      reason: status,
      zeroWrite: true
    });
  }
  const continuation = operationContinuation(operation, result);
  return createInvocationOutcome({
    kind: continuation === "terminal" ? "succeeded" : "continuation",
    category: semantics.category,
    phase: readOnly ? "read" : semantics.phase,
    blocking: false,
    userAction: semantics.userAction,
    continuation,
    closure: operationClosure(operation, result),
    retry: semantics.retry ?? operationRetry(operation, "succeeded"),
    zeroWrite: readOnly || result?.zeroWrite === true
  });
}

export function classifyInvocationError(error, operation) {
  const message = normalizeStatus(error instanceof Error ? error.message : String(error));
  let reason = "internal-failure";
  let category = "internal-failure";
  let phase = "internal";
  let userAction = "retry-explicitly";

  if (/ambiguous|conflict|choose|select.*explicit/u.test(message)) {
    reason = "ambiguous-target";
    category = "ambiguous-target";
    phase = "selection";
    userAction = "select-target";
  } else if (/not found|does not exist|unknown (?:mission|source|note|claim|experiment|figure|review|exchange|version|lesson|receipt|criterion)/u.test(message)) {
    reason = "not-found";
    category = "not-found";
    phase = "selection";
    userAction = "select-target";
  } else if (/stale|no longer current|no longer accepts|changed|mismatch|superseded/u.test(message)) {
    reason = "stale-state";
    category = "stale-state";
    phase = "validation";
    userAction = "refresh-state";
  } else if (/elicitation support|capability unavailable|provider unavailable|missing secret/u.test(message)) {
    reason = "capability-unavailable";
    category = "capability-unavailable";
    phase = "execution";
    userAction = "enable-capability";
  } else if (/evidence|coverage|source provenance|review (?:coverage|authority|evidence|issuer)/u.test(message)) {
    reason = "evidence-incomplete";
    category = "evidence-incomplete";
    phase = "evidence";
    userAction = "provide-evidence";
  } else if (/invalid|unsafe|does not accept|must\b|may report .* only|cannot declare|requires?\b|references unknown requirement|references unknown mission reference|regular file|future file|unsupported action|plain object/u.test(message)) {
    reason = "invalid-input";
    category = "invalid-input";
    phase = "validation";
    userAction = "clarify-input";
  } else if (/blocked|cannot proceed|could not complete/u.test(message)) {
    reason = "blocked";
    category = "blocked";
    phase = "execution";
    userAction = "resolve-blocker";
  }

  return createInvocationOutcome({
    kind: "failed",
    category,
    phase,
    blocking: true,
    userAction,
    continuation: "terminal",
    closure: "none",
    retry: operationRetry(operation, "failed"),
    reason
  });
}
