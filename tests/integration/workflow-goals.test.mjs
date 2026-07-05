import test from "node:test";
import assert from "node:assert/strict";

import { validateWorkflowGoalContracts, validateWorkflowGoals, WORKFLOW_GOAL_CONTRACTS } from "../../src/core/workflow-goals.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

test("workflow goal contracts require failure reflection metadata", () => {
  const result = validateWorkflowGoalContracts();
  assert.equal(result.status, "passed");
  assert.deepEqual(result.contractIds, WORKFLOW_GOAL_CONTRACTS.map((contract) => contract.id));
  for (const contract of WORKFLOW_GOAL_CONTRACTS) {
    assert.equal(contract.failureReflection.lessonCaptureRequired, true);
    assert.equal(contract.failureReflection.lessonCommand, "project:dove.lessons");
    assert.equal(contract.failureReflection.remediationRequired, true);
    assert.equal(contract.failureReflection.operatorFollowThroughRequired, true);
    assert.ok(contract.failureReflection.regressionArtifacts.includes("scripts/validate-workflow-goals.mjs"));
  }
});

test("workflow goal validation rejects fake operator progress without host results", () => {
  const result = validateWorkflowGoals({
    createRoot: (prefix) => createTempRoot(prefix),
    cleanupRoot: cleanupTempRoot,
    dispatch: dispatchTool
  });
  assert.equal(result.status, "passed");
  const operatorGoal = result.results.find((goal) => goal.id === "operator-host-pass-without-results");
  assert.ok(operatorGoal);
  assert.equal(operatorGoal.evidence.runStatus, "needs-host-results");
  assert.equal(operatorGoal.evidence.updatedTaskCount, 0);
  assert.equal(operatorGoal.evidence.runtimeRecorded, false);
  assert.equal(operatorGoal.evidence.finalTaskStatus, "ready");
  assert.equal(operatorGoal.evidence.finalBoundary, null);
  assert.equal(operatorGoal.evidence.runtimeEntryPersisted, false);
  assert.ok(operatorGoal.evidence.requiredActions.includes("collect-source-provenance"));
  assert.ok(operatorGoal.evidence.requiredActions.includes("call-register-source-with-sources-array"));
});

test("workflow goal validation rejects mission and auto fake completion", () => {
  const result = validateWorkflowGoals({
    createRoot: (prefix) => createTempRoot(prefix),
    cleanupRoot: cleanupTempRoot,
    dispatch: dispatchTool
  });
  assert.equal(result.status, "passed");

  const missionGoal = result.results.find((goal) => goal.id === "mission-completion-requires-evidence");
  assert.ok(missionGoal);
  assert.equal(missionGoal.evidence.rejectedStatus, "needs-completion-evidence");
  assert.equal(missionGoal.evidence.finalTaskStatus, "ready");
  assert.equal(missionGoal.evidence.runtimeEntryPersisted, false);
  assert.ok(missionGoal.evidence.requiredActions.includes("provide-evidence-links-or-artifact-refs-or-verification-evidence"));

  const autoGoal = result.results.find((goal) => goal.id === "auto-read-only-step-cannot-complete");
  assert.ok(autoGoal);
  assert.equal(autoGoal.evidence.runStatus, "needs-explicit-progress-step");
  assert.equal(autoGoal.evidence.iterationCount, 0);
  assert.equal(autoGoal.evidence.finalTaskStatus, "ready");
  assert.equal(autoGoal.evidence.runtimeEntryPersisted, false);
  assert.ok(autoGoal.evidence.requiredActions.includes("provide-explicit-auto-step"));
});

test("workflow goal validation rejects plan outputs without executable child contracts", () => {
  const result = validateWorkflowGoals({
    createRoot: (prefix) => createTempRoot(prefix),
    cleanupRoot: cleanupTempRoot,
    dispatch: dispatchTool
  });
  assert.equal(result.status, "passed");

  const noChildrenGoal = result.results.find((goal) => goal.id === "plan-completion-requires-executable-children");
  assert.ok(noChildrenGoal);
  assert.equal(noChildrenGoal.evidence.rejectedStatus, "plan-output-not-executable");
  assert.equal(noChildrenGoal.evidence.finalTaskStatus, "ready");
  assert.equal(noChildrenGoal.evidence.runtimeEntryPersisted, false);
  assert.ok(noChildrenGoal.evidence.requiredActions.includes("provide-executable-child-missions"));

  const childCriteriaGoal = result.results.find((goal) => goal.id === "plan-child-contract-requires-criteria");
  assert.ok(childCriteriaGoal);
  assert.equal(childCriteriaGoal.evidence.rejectedStatus, "plan-output-not-executable");
  assert.equal(childCriteriaGoal.evidence.childCreated, false);
  assert.ok(childCriteriaGoal.evidence.notExecutable[0].missing.includes("convergence.criteria"));
});

test("workflow goal validation rejects completion without criteria coverage", () => {
  const result = validateWorkflowGoals({
    createRoot: (prefix) => createTempRoot(prefix),
    cleanupRoot: cleanupTempRoot,
    dispatch: dispatchTool
  });
  assert.equal(result.status, "passed");

  const statusGoal = result.results.find((goal) => goal.id === "status-adjust-completion-requires-criteria");
  assert.ok(statusGoal);
  assert.equal(statusGoal.evidence.adjustmentStatus, "rejected");
  assert.equal(statusGoal.evidence.rejectionStatus, "verification-failed");
  assert.equal(statusGoal.evidence.finalTaskStatus, "ready");
  assert.ok(statusGoal.evidence.requiredActions.includes("provide-verified-criteria"));

  const operatorGoal = result.results.find((goal) => goal.id === "operator-host-result-requires-criteria");
  assert.ok(operatorGoal);
  assert.equal(operatorGoal.evidence.iterationStatus, "verification-failed");
  assert.equal(operatorGoal.evidence.finalTaskStatus, "blocked");
  assert.equal(operatorGoal.evidence.boundaryType, "verification-failed");
  assert.ok(operatorGoal.evidence.requiredActions.includes("provide-verified-criteria"));

  const autoGoal = result.results.find((goal) => goal.id === "auto-completion-requires-criteria");
  assert.ok(autoGoal);
  assert.equal(autoGoal.evidence.runStatus, "verification-failed");
  assert.equal(autoGoal.evidence.finalTaskStatus, "blocked");
  assert.equal(autoGoal.evidence.boundaryType, "verification-failed");
  assert.ok(autoGoal.evidence.requiredActions.includes("provide-verified-criteria"));
});

test("workflow goal validation routes missing contracts and preserves flat public surfaces", () => {
  const result = validateWorkflowGoals({
    createRoot: (prefix) => createTempRoot(prefix),
    cleanupRoot: cleanupTempRoot,
    dispatch: dispatchTool
  });
  assert.equal(result.status, "passed");

  const missingContractGoal = result.results.find((goal) => goal.id === "status-routes-missing-execution-contract");
  assert.ok(missingContractGoal);
  assert.equal(missingContractGoal.evidence.returnStatus, "blocked");
  assert.equal(missingContractGoal.evidence.missingContractCount, 1);
  assert.equal(missingContractGoal.evidence.firstActionKind, "recover-current-work");
  assert.equal(missingContractGoal.evidence.recoveryPrimaryKind, "missing-executable-contract");
  assert.equal(missingContractGoal.evidence.executionNextRole, "planner");

  const surfacesGoal = result.results.find((goal) => goal.id === "public-surfaces-stay-flat");
  assert.ok(surfacesGoal);
  assert.ok(surfacesGoal.evidence.requiredPresent.includes("dove.status"));
  assert.ok(surfacesGoal.evidence.forbiddenAbsent.includes("dove.planner"));
});

test("workflow goal validation rejects blocked audit bridge claims", () => {
  const result = validateWorkflowGoals({
    createRoot: (prefix) => createTempRoot(prefix),
    cleanupRoot: cleanupTempRoot,
    dispatch: dispatchTool
  });
  assert.equal(result.status, "passed");
  const experienceGoal = result.results.find((goal) => goal.id === "experience-blocked-audit-not-bridged");
  assert.ok(experienceGoal);
  assert.equal(experienceGoal.evidence.runStatus, "needs-review");
  assert.equal(experienceGoal.evidence.auditVerdict, "blocked");
  assert.ok(experienceGoal.evidence.integrityFlags.length > 0);
  assert.notEqual(experienceGoal.evidence.bridgeStatus, "applied");
});
