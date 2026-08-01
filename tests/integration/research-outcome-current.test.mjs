import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assessMissionCompletion } from "../../src/core/completion-gates.mjs";
import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { recordResearchOutcome } from "../../src/core/research-outcome.mjs";
import { openDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { initializeWorkspace } from "../helpers/current-schema-workspace.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function materialize(root) {
  initializeWorkspace(root);
  fs.writeFileSync(path.join(root, "result.md"), "bounded result\n");
  const proposal = createDoveMission(root, {
    missionId: "research-outcome-current",
    mode: "research",
    goal: "Produce and interpret one bounded research result.",
    artifacts: [{ path: "result.md", required: true, role: "output" }],
    completionCriteria: ["The current result is scientifically interpreted."],
    evidenceRequirements: ["artifact:result.md"]
  });
  return runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, proposal.confirmation.confirmArgs));
}

function outcomeArgs(result, overrides = {}) {
  const decision = result.currentResearchDecision;
  const startedAt = new Date(Math.max(Date.parse(decision.createdAt), Date.now() - 1000)).toISOString();
  return {
    missionId: result.mission.missionId,
    decisionRevision: decision.revision,
    attemptId: "attempt-1",
    status: "completed",
    performedActionCount: 1,
    actualUsage: { actions: 1, timeMinutes: 1, costUnits: 1 },
    evidenceReturned: [...decision.nextAction.expectedEvidence],
    artifactPaths: ["result.md"],
    validationPaths: [],
    facts: ["The bounded action produced the declared result file."],
    startedAt,
    finishedAt: new Date(Date.parse(startedAt) + 1).toISOString(),
    ...overrides
  };
}

function record(root, args) {
  return runWithMutationContext(root, { actionId: "record-research-outcome", mutationMode: "direct-process", hostId: "test" }, () => recordResearchOutcome(root, args));
}

test("research outcome writes one receipt only and completion derives awaiting reevaluation", () => {
  const root = createTempRoot("dove-schema18-research-outcome-");
  const mission = materialize(root);
  const beforeDecision = mission.currentResearchDecision;
  const result = record(root, outcomeArgs(mission));
  const workspace = openDoveWorkspace(root, { operation: "Schema 18 outcome assertion" });
  assert.equal(result.awaitingReevaluation, true);
  assert.equal(workspace.receiptLedger.receipts.length, 1);
  assert.equal(workspace.currentResearchDecisions.get(mission.mission.missionId).decisionId, beforeDecision.decisionId);
  assert.equal(fs.readdirSync(path.join(root, ".dove/research-decisions")).length, 1);
  assert.equal(fs.existsSync(path.join(root, ".dove/research-trees")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove/requirement-snapshots")), false);
  const completion = assessMissionCompletion(root, { missionId: mission.mission.missionId });
  assert.equal(completion.complete, false);
  assert.ok(completion.incompleteReasons.includes("research-outcome-awaiting-reevaluation"));
});

test("same research attempt replays zero-write and changed content is rejected", () => {
  const root = createTempRoot("dove-research-current-replay-");
  const mission = materialize(root);
  const args = outcomeArgs(mission);
  const first = record(root, args);
  const replay = record(root, args);
  assert.equal(replay.status, "replayed");
  assert.equal(replay.zeroWrite, true);
  assert.equal(openDoveWorkspace(root).receiptLedger.receipts.length, 1);
  assert.throws(() => record(root, { ...args, facts: ["The bounded action produced a different reported fact."] }), /attemptId was already recorded with different immutable content/u);
  assert.equal(openDoveWorkspace(root).receiptLedger.receipts[0].receiptId, first.receipt.receiptId);
});
