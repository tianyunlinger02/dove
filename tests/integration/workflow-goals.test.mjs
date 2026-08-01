import test from "node:test";
import assert from "node:assert/strict";

import { validateWorkflowGoalContracts, validateWorkflowGoals, WORKFLOW_GOAL_CONTRACTS } from "../../src/core/workflow-goals.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

async function validateGoals() {
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

test("workflow goal validation materializes mission contracts without execution", async () => {
  const result = await validateGoals();
  assert.equal(result.status, "passed");

  const missionGoal = result.results.find((goal) => goal.id === "mission-contract-materializes-without-execution");
  assert.ok(missionGoal);
  assert.equal(missionGoal.evidence.approvalCalls, 1);
  assert.equal(missionGoal.evidence.terminal, true);
  assert.equal(missionGoal.evidence.materializedStatus, "materialized");
  assert.equal(missionGoal.evidence.declineStatus, "declined");
  assert.equal(missionGoal.evidence.declineZeroWrite, true);
  assert.equal(missionGoal.evidence.unsupportedClientRejected, true);
  assert.equal(missionGoal.evidence.missionAbsentAfterRejectedCheckpoints, true);
  assert.equal(missionGoal.evidence.directMissionContractBound, true);
  assert.match(missionGoal.evidence.persistedPath, /^\.dove\/missions\/mission-[a-f0-9-]+\.json$/u);
  assert.equal(missionGoal.evidence.legacyStateAbsent, true);
});

test("workflow goal validation defaults status to a whole-workspace briefing and bounded task chain", async () => {
  const result = await validateGoals();
  assert.equal(result.status, "passed");

  const statusGoal = result.results.find((goal) => goal.id === "status-defaults-to-whole-workspace-briefing");
  assert.ok(statusGoal);
  assert.equal(statusGoal.evidence.zeroWrite, true);
  assert.equal(statusGoal.evidence.missionScope, "workspace portfolio");
  assert.equal(statusGoal.evidence.missionCount, 2);
  assert.equal(statusGoal.evidence.requirementCount, 2);
  assert.equal(statusGoal.evidence.workItemCount, 0);
  assert.equal(statusGoal.evidence.oneBasedNumbering, true);
  assert.equal(statusGoal.evidence.internalGraphHidden, true);
});

test("workflow goal validation rejects results that diverge from the frozen protocol", async () => {
  const result = await validateGoals();
  assert.equal(result.status, "passed");

  const experimentGoal = result.results.find((goal) => goal.id === "experiment-result-replays-frozen-protocol");
  assert.ok(experimentGoal);
  assert.equal(experimentGoal.evidence.zeroWrite, true);
  assert.equal(experimentGoal.evidence.resultAbsent, true);
  assert.equal(typeof experimentGoal.evidence.rejection, "string");
  assert.ok(experimentGoal.evidence.rejection.length > 0);
});

test("workflow goal validation keeps minimal status isolated from legacy packet state", async () => {
  const result = await validateGoals();
  assert.equal(result.status, "passed");

  const legacyStatusGoal = result.results.find((goal) => goal.id === "status-rejects-legacy-packet-state");
  assert.ok(legacyStatusGoal);
  assert.equal(legacyStatusGoal.evidence.staleStateRejected, true);
  assert.equal(legacyStatusGoal.evidence.zeroWrite, true);
  assert.equal(legacyStatusGoal.evidence.manifestAbsent, true);
  assert.equal(legacyStatusGoal.evidence.missionsAbsent, true);
  assert.equal(legacyStatusGoal.evidence.legacyPacketNotPresented, true);
});

test("workflow goal validation preserves the exact current-schema command inventory", async () => {
  const result = await validateGoals();
  assert.equal(result.status, "passed");

  const surfacesGoal = result.results.find((goal) => goal.id === "public-surfaces-stay-flat");
  assert.ok(surfacesGoal);
  assert.equal(surfacesGoal.evidence.surfaceCount, 12);
  assert.deepEqual(surfacesGoal.evidence.requiredPresent, [
    "dove.workspace",
    "dove.mission",
    "dove.status",
    "dove.lessons",
    "dove.source",
    "dove.note",
    "dove.experience",
    "dove.experiment",
    "dove.draft",
    "dove.figure",
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
