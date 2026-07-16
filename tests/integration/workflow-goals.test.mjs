import test from "node:test";
import assert from "node:assert/strict";

import { validateWorkflowGoalContracts, validateWorkflowGoals, WORKFLOW_GOAL_CONTRACTS } from "../../src/core/workflow-goals.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

function validateGoals() {
  return validateWorkflowGoals({
    createRoot: (prefix) => createTempRoot(prefix),
    cleanupRoot: cleanupTempRoot,
    dispatch: dispatchTool
  });
}

test("workflow goal contracts require failure reflection metadata", () => {
  const result = validateWorkflowGoalContracts();
  assert.equal(result.status, "passed");
  assert.deepEqual(result.contractIds, WORKFLOW_GOAL_CONTRACTS.map((contract) => contract.id));
  for (const contract of WORKFLOW_GOAL_CONTRACTS) {
    assert.equal(contract.failureReflection.remediationRequired, true);
    assert.ok(contract.failureReflection.regressionArtifacts.includes("scripts/validate-workflow-goals.mjs"));
    assert.ok(contract.failureReflection.remediationTargets.length > 0);
    assert.ok(contract.failureReflection.summary.length > 0);
  }
});

test("workflow goal validation materializes mission contracts without execution", () => {
  const result = validateGoals();
  assert.equal(result.status, "passed");

  const missionGoal = result.results.find((goal) => goal.id === "mission-contract-materializes-without-execution");
  assert.ok(missionGoal);
  assert.equal(missionGoal.evidence.proposalStatus, "needs-confirmation");
  assert.equal(missionGoal.evidence.materializedStatus, "materialized");
  assert.equal(missionGoal.evidence.bareConfirmationRejected, true);
  assert.equal(missionGoal.evidence.staleConfirmationRejected, true);
  assert.equal(missionGoal.evidence.missionAbsentAfterRejectedConfirmations, true);
  assert.equal(missionGoal.evidence.persistedPath, ".dove/missions/workflow-goal-mission-handoff.json");
  assert.equal(missionGoal.evidence.legacyStateAbsent, true);
  assert.equal(missionGoal.evidence.handoffBriefMatches, true);
});

test("workflow goal validation rejects blocked audit bridge claims", () => {
  const result = validateGoals();
  assert.equal(result.status, "passed");

  const experienceGoal = result.results.find((goal) => goal.id === "experience-blocked-audit-not-bridged");
  assert.ok(experienceGoal);
  assert.equal(experienceGoal.evidence.zeroWrite, true);
  assert.equal(experienceGoal.evidence.resultAbsent, true);
  assert.equal(experienceGoal.evidence.bridgeAbsent, true);
  assert.match(experienceGoal.evidence.rejection, /cannot bridge to a claim while integrity flags remain/u);
});

test("workflow goal validation keeps minimal status isolated from legacy packet state", () => {
  const result = validateGoals();
  assert.equal(result.status, "passed");

  const legacyStatusGoal = result.results.find((goal) => goal.id === "status-rejects-legacy-packet-state");
  assert.ok(legacyStatusGoal);
  assert.equal(legacyStatusGoal.evidence.errorRequiresArchiveReset, true);
  assert.equal(legacyStatusGoal.evidence.zeroWrite, true);
  assert.equal(legacyStatusGoal.evidence.manifestAbsent, true);
  assert.equal(legacyStatusGoal.evidence.missionsAbsent, true);
  assert.equal(legacyStatusGoal.evidence.legacyPacketNotPresented, true);
});

test("workflow goal validation preserves the exact schema 7 command inventory", () => {
  const result = validateGoals();
  assert.equal(result.status, "passed");

  const surfacesGoal = result.results.find((goal) => goal.id === "public-surfaces-stay-flat");
  assert.ok(surfacesGoal);
  assert.equal(surfacesGoal.evidence.surfaceCount, 12);
  assert.deepEqual(surfacesGoal.evidence.requiredPresent, [
    "dove.init",
    "dove.mission",
    "dove.status",
    "dove.lessons",
    "dove.version",
    "dove.source",
    "dove.note",
    "dove.figure",
    "dove.experience",
    "dove.draft",
    "dove.review",
    "dove.rebuttal"
  ]);
  assert.equal(surfacesGoal.evidence.forbiddenAbsent.includes("dove.lessons"), false);
  assert.equal(surfacesGoal.evidence.forbiddenAbsent.includes("dove.review"), false);
  assert.ok(surfacesGoal.evidence.forbiddenAbsent.includes("dove.auto"));
  assert.ok(surfacesGoal.evidence.forbiddenAbsent.includes("dove.operator"));
  assert.ok(surfacesGoal.evidence.forbiddenAbsent.includes("dove.review-loop"));
  assert.equal(surfacesGoal.evidence.unexpectedAbsent, true);
});
