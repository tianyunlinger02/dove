const PROPOSAL_STATUSES = new Set([
  "needs-confirmation",
  "needs-task-selection"
]);

const CONFIRMED_EXECUTION_FAILURE_STATUSES = new Set([
  "awaiting-host-pass",
  "awaiting-host-results",
  "needs-host-results"
]);

const OPERATIONAL_FAILURE_STATUSES = new Set([
  "auto-read-only-step-no-progress",
  "blocked",
  "blocked-boundary",
  "blocked-missing-materials",
  "failed",
  "materialization-failed",
  "missing-required-materials",
  "missing-secret-env",
  "needs-completion-evidence",
  "needs-explicit-progress-step",
  "needs-source-verification",
  "no-op",
  "noop",
  "provider-failed",
  "qa-needs-attention",
  "source-provenance-unverified",
  "step-no-progress",
  "unexpected-step-status",
  "verification-failed",
  "workflow-error-boundary"
]);

function normalizeStatus(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isProposalOnlyOutcome(result) {
  if (!result || typeof result !== "object") {
    return false;
  }
  const status = normalizeStatus(result.status ?? result.outcome);
  return result.proposalOnly === true || PROPOSAL_STATUSES.has(status);
}

export function isOperationalFailureOutcome(result, { confirmed = false } = {}) {
  if (!result || typeof result !== "object") {
    return false;
  }
  if (!confirmed && isProposalOnlyOutcome(result)) {
    return false;
  }
  const status = normalizeStatus(result.status ?? result.outcome);
  return OPERATIONAL_FAILURE_STATUSES.has(status)
    || (confirmed && CONFIRMED_EXECUTION_FAILURE_STATUSES.has(status));
}
