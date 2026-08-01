import test from "node:test";
import assert from "node:assert/strict";

import { closeHostOutcome } from "../../src/core/execution-receipts.mjs";
import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { openDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { initializeWorkspace } from "../helpers/current-schema-workspace.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function mutate(root, callback) { return runWithMutationContext(root, { actionId: "close-host-outcome", mutationMode: "direct-process", hostId: "test" }, callback); }
function mission(root) { initializeWorkspace(root); const proposal = createDoveMission(root, { missionId: "ordinary-attempts", mode: "ordinary", goal: "Run one bounded ordinary task." }); return runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, proposal.confirmation.confirmArgs)).mission; }
function args(missionId, attemptId, status, summary, fact) { return { missionId, attemptId, status, summary, artifactPaths: [], validationPaths: [], facts: [{ statement: fact, criterionNumbers: [] }] }; }

test("ordinary failed attempt permits a later completed attempt and exact replay is zero-write", () => {
  const root = createTempRoot("dove-ordinary-attempts-current-"); const current = mission(root);
  const failed = args(current.missionId, "attempt-1", "failed", "The first attempt returned an execution error.", "The first attempt returned an execution error.");
  const first = mutate(root, () => closeHostOutcome(root, failed));
  const replay = mutate(root, () => closeHostOutcome(root, failed));
  const retry = mutate(root, () => closeHostOutcome(root, args(current.missionId, "attempt-2", "completed", "The retry completed the bounded task.", "The retry completed without an execution error.")));
  assert.equal(first.status, "ingested");
  assert.equal(replay.status, "replayed");
  assert.equal(replay.zeroWrite, true);
  assert.equal(retry.status, "ingested");
  assert.equal(openDoveWorkspace(root).receiptLedger.receipts.length, 2);
  assert.throws(() => mutate(root, () => closeHostOutcome(root, { ...failed, summary: "Different immutable callback content." })), /already been recorded with different immutable content/u);
});
