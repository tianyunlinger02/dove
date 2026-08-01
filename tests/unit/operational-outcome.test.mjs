import test from "node:test";
import assert from "node:assert/strict";

import { classifyInvocationError, classifyInvocationOutcome } from "../../src/core/operational-outcome.mjs";
import { operationForTool } from "../../src/core/operation-registry.mjs";

test("ambient success returns a code-owned continuation and host outcome closure", () => {
  const outcome = classifyInvocationOutcome(
    { status: "materialized" },
    operationForTool("create_ambient_dove_mission")
  );
  assert.deepEqual(outcome, {
    kind: "continuation",
    category: "success",
    phase: "execution",
    blocking: false,
    userAction: "none",
    terminal: false,
    continuation: "resume-original",
    closure: "host-outcome",
    retry: "none"
  });
});

test("research handoff success derives the research callback mode from registry semantics", () => {
  const outcome = classifyInvocationOutcome(
    { status: "recorded", operation: "reevaluate-research-decision", executionHandoff: { authorizedAction: {} } },
    operationForTool("manage_dove_mission")
  );
  assert.equal(outcome.kind, "continuation");
  assert.equal(outcome.terminal, false);
  assert.equal(outcome.continuation, "resume-original");
  assert.equal(outcome.closure, "research-outcome");
});

test("checkpoint proposals are awaiting approval rather than successful execution", () => {
  const outcome = classifyInvocationOutcome(
    { status: "needs-confirmation", proposalOnly: true, zeroWrite: true },
    operationForTool("manage_dove_mission"),
    { operation: "create-root" }
  );
  assert.equal(outcome.kind, "continuation");
  assert.equal(outcome.category, "awaiting-approval");
  assert.equal(outcome.phase, "approval");
  assert.equal(outcome.userAction, "approve-or-cancel");
  assert.equal(outcome.terminal, true);
  assert.equal(outcome.closure, "none");
});

test("read-only success is zero-write and retains the read phase without caller hints", () => {
  const outcome = classifyInvocationOutcome(
    { status: "ok" },
    operationForTool("manage_dove_sources"),
    { operation: "query" }
  );
  assert.equal(outcome.category, "success-zero-write");
  assert.equal(outcome.phase, "read");
  assert.equal(outcome.blocking, false);
  assert.equal(outcome.userAction, "none");
});

test("operational failures carry stable public routing semantics", () => {
  const operation = operationForTool("close_host_outcome");
  const cases = [
    ["needs-completion-evidence", "evidence-incomplete", "evidence", "provide-evidence"],
    ["blocked-missing-materials", "invalid-input", "validation", "clarify-input"],
    ["missing-secret-env", "capability-unavailable", "execution", "enable-capability"],
    ["step-no-progress", "blocked", "execution", "resolve-blocker"],
    ["materialization-failed", "operational-failure", "execution", "retry-explicitly"]
  ];
  for (const [status, category, phase, userAction] of cases) {
    const outcome = classifyInvocationOutcome({ status, zeroWrite: true }, operation);
    assert.equal(outcome.kind, "failed", status);
    assert.equal(outcome.category, category, status);
    assert.equal(outcome.phase, phase, status);
    assert.equal(outcome.blocking, true, status);
    assert.equal(outcome.userAction, userAction, status);
    assert.equal(outcome.retry, "explicit-request", status);
  }
});

test("unknown operation statuses fail closed as internal failures", () => {
  const outcome = classifyInvocationOutcome(
    { status: "future-unregistered-status", zeroWrite: true },
    operationForTool("close_host_outcome")
  );
  assert.deepEqual(outcome, {
    kind: "failed",
    category: "internal-failure",
    phase: "internal",
    blocking: true,
    userAction: "retry-explicitly",
    terminal: true,
    continuation: "terminal",
    closure: "none",
    retry: "none",
    reason: "unknown-operation-status"
  });
});

test("callback replay and no-progress skips remain operationally distinct", () => {
  const operation = operationForTool("close_host_outcome");
  const replay = classifyInvocationOutcome({ status: "replayed", zeroWrite: true }, operation);
  assert.equal(replay.kind, "succeeded");
  assert.equal(replay.category, "success-zero-write");
  assert.equal(replay.blocking, false);
  assert.equal(replay.closure, "none");
  assert.equal(replay.retry, "none");

  const noProgress = classifyInvocationOutcome({ status: "no-progress-skipped", zeroWrite: true }, operation);
  assert.equal(noProgress.kind, "failed");
  assert.equal(noProgress.category, "blocked");
  assert.equal(noProgress.blocking, true);
  assert.equal(noProgress.userAction, "resolve-blocker");
  assert.equal(noProgress.retry, "explicit-request");
});

test("partial commit failure permits only read-only reassessment", () => {
  const outcome = classifyInvocationOutcome(
    { status: "partial-commit-failure", writesApplied: true },
    operationForTool("close_host_outcome")
  );
  assert.equal(outcome.kind, "failed");
  assert.equal(outcome.category, "internal-failure");
  assert.equal(outcome.phase, "internal");
  assert.equal(outcome.userAction, "reassess-read-only");
  assert.equal(outcome.closure, "none");
  assert.equal(outcome.retry, "none");
});

test("public invocation errors distinguish input, target, state, and internal failures", () => {
  const operation = operationForTool("query_dove_status");
  assert.equal(classifyInvocationError(new Error("The target is ambiguous."), operation).category, "ambiguous-target");
  assert.equal(classifyInvocationError(new Error("The selected mission does not exist."), operation).category, "not-found");
  assert.equal(classifyInvocationError(new Error("The recorded state is no longer current."), operation).category, "stale-state");
  assert.equal(classifyInvocationError(new Error("missionId must be a non-empty string."), operation).category, "invalid-input");
  assert.equal(classifyInvocationError(new Error("The review policy must be local-preflight or external."), operation).category, "invalid-input");
  assert.equal(classifyInvocationError(new Error("This Dove checkpoint requires an MCP client with elicitation support."), operation).category, "capability-unavailable");
  assert.equal(classifyInvocationError(new Error("The operation is blocked until the current lock is released."), operation).category, "blocked");
  assert.equal(classifyInvocationError(new Error("Unexpected provider parser bug."), operation).category, "internal-failure");
  assert.equal(classifyInvocationError(new Error("Unexpected fs failure."), operation).category, "internal-failure");
});
