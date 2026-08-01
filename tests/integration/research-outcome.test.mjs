import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assessMissionCompletion } from "../../src/core/completion-gates.mjs";
import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { recordResearchOutcome } from "../../src/core/research-outcome.mjs";
import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";
import { openDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { initializeWorkspace } from "../helpers/current-schema-workspace.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function materialize(root, missionId = "research-outcome") {
  initializeWorkspace(root);
  fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
  fs.writeFileSync(path.join(root, "outputs/result.md"), "bounded result\n", "utf8");
  const proposal = createDoveMission(root, {
    missionId,
    mode: "research",
    goal: "Produce and interpret one bounded research result.",
    artifacts: [{ path: "outputs/result.md", required: true, role: "output" }],
    completionCriteria: ["The current result is scientifically interpreted."],
    evidenceRequirements: ["artifact:outputs/result.md"]
  });
  return runWithMutationContext(root, {
    actionId: "create-dove-mission",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => createDoveMission(root, proposal.confirmation.confirmArgs));
}

function outcomeArgs(result, overrides = {}) {
  const decision = result.currentResearchDecision;
  const startedAt = new Date(Math.max(Date.parse(decision.createdAt), Date.now() - 1000)).toISOString();
  return {
    missionId: result.mission.missionId,
    decisionRevision: decision.revision,
    attemptId: overrides.attemptId ?? "attempt-1",
    status: overrides.status ?? "completed",
    performedActionCount: overrides.performedActionCount ?? 1,
    actualUsage: overrides.actualUsage ?? { actions: 1, timeMinutes: 1, costUnits: 1 },
    evidenceReturned: overrides.evidenceReturned ?? [...decision.nextAction.expectedEvidence],
    artifactPaths: overrides.artifactPaths ?? ["outputs/result.md"],
    validationPaths: overrides.validationPaths ?? [],
    facts: overrides.facts ?? ["The bounded action produced the declared result file."],
    startedAt,
    finishedAt: new Date(Date.parse(startedAt) + 1).toISOString()
  };
}

function record(root, args, options = {}) {
  return runWithMutationContext(root, {
    actionId: "record-research-outcome",
    mutationMode: "direct-process",
    hostId: "test",
    ...(options.fsOps ? { fsOps: options.fsOps } : {})
  }, () => recordResearchOutcome(root, args));
}

function workspaceSnapshot(root) {
  const files = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(fullPath);
      else files[path.relative(root, fullPath)] = fs.readFileSync(fullPath).toString("base64");
    }
  };
  visit(path.join(root, ".dove"));
  return files;
}

test("research outcome records one receipt without changing the scientific decision", () => {
  const root = createTempRoot("dove-research-outcome-receipt-only-");
  const created = materialize(root);
  const beforeDecision = created.currentResearchDecision;
  const result = record(root, outcomeArgs(created));
  const workspace = openDoveWorkspace(root, { operation: "Schema 18 receipt-only outcome assertion" });

  assert.equal(result.status, "recorded");
  assert.equal(result.awaitingReevaluation, true);
  assert.equal(result.receipt.researchOutcome.decisionId, beforeDecision.decisionId);
  assert.equal(result.receipt.researchOutcome.actionId, beforeDecision.nextAction.actionId);
  assert.deepEqual(result.writes, [path.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${result.receipt.receiptId}.json`)]);
  assert.equal(workspace.receiptLedger.receipts.length, 1);
  assert.equal(workspace.currentResearchDecisions.get(created.mission.missionId).decisionId, beforeDecision.decisionId);
  assert.equal(fs.readdirSync(path.join(root, ARTIFACT_PATHS.researchDecisionsDir)).length, 1);
  assert.equal(fs.existsSync(path.join(root, ".dove/research-trees")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove/requirement-snapshots")), false);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.lessonsDocument)), true);
  assert.equal(fs.readdirSync(path.join(root, ARTIFACT_PATHS.experimentsDir)).length, 0);
});

test("completion derives an unconsumed research outcome from the receipt ledger", () => {
  const root = createTempRoot("dove-research-outcome-derived-status-");
  const created = materialize(root, "derived-status");
  const result = record(root, outcomeArgs(created));
  const completion = assessMissionCompletion(root, { missionId: created.mission.missionId });

  assert.deepEqual(completion.researchOutcome.receiptIds, [result.receipt.receiptId]);
  assert.deepEqual(completion.researchOutcome.consumedReceiptIds, []);
  assert.deepEqual(completion.researchOutcome.unconsumedReceiptIds, [result.receipt.receiptId]);
  assert.equal(completion.researchOutcome.awaitingReevaluation, true);
  assert.equal(completion.complete, false);
  assert.ok(completion.incompleteReasons.includes("research-outcome-awaiting-reevaluation"));
  assert.equal(completion.lifecycle, null);
});

test("outcomes without returned files still record the immutable research attempt receipt", () => {
  const root = createTempRoot("dove-research-outcome-no-files-");
  const created = materialize(root, "no-files");
  const result = record(root, outcomeArgs(created, {
    status: "stopped",
    performedActionCount: 0,
    actualUsage: { actions: 0, timeMinutes: 1, costUnits: 0 },
    evidenceReturned: [],
    artifactPaths: [],
    validationPaths: [],
    facts: []
  }));

  assert.equal(result.receipt.researchOutcome.status, "stopped");
  assert.deepEqual(result.receipt.artifacts, []);
  assert.deepEqual(result.receipt.validations, []);
  assert.equal(openDoveWorkspace(root).receiptLedger.receipts.length, 1);
  assert.equal(openDoveWorkspace(root).currentResearchDecisions.get(created.mission.missionId).revision, 1);
});

test("research outcomes fail closed before claiming malformed Dove domain files", () => {
  const root = createTempRoot("dove-research-outcome-domain-ownership-");
  const created = materialize(root, "domain-ownership");
  const forgedPath = path.join(root, ARTIFACT_PATHS.claimsDir, "forged.txt");
  fs.mkdirSync(path.dirname(forgedPath), { recursive: true });
  fs.writeFileSync(forgedPath, "unowned internal domain content\n", "utf8");
  const before = workspaceSnapshot(root);

  assert.throws(() => record(root, outcomeArgs(created, {
    artifactPaths: [path.posix.join(ARTIFACT_PATHS.claimsDir, "forged.txt")]
  })), /refuses invalid Dove workspace state current-unhealthy.*must be a regular JSON claim record/u);
  assert.deepEqual(workspaceSnapshot(root), before);
  assert.throws(() => openDoveWorkspace(root), /must be a regular JSON claim record/u);
});

test("same research attempt replays zero-write and changed content is rejected", () => {
  const root = createTempRoot("dove-research-outcome-replay-");
  const created = materialize(root, "replay");
  const args = outcomeArgs(created);
  const first = record(root, args);
  const beforeReplay = workspaceSnapshot(root);
  const replay = record(root, args);

  assert.equal(replay.status, "replayed");
  assert.equal(replay.zeroWrite, true);
  assert.deepEqual(workspaceSnapshot(root), beforeReplay);
  assert.throws(() => record(root, { ...args, facts: ["The bounded action produced a different reported fact."] }), /attemptId was already recorded with different immutable content/u);
  assert.equal(openDoveWorkspace(root).receiptLedger.receipts[0].receiptId, first.receipt.receiptId);
});

test("stale decision revisions and receipt promotion failures are zero-write", () => {
  const staleRoot = createTempRoot("dove-research-outcome-stale-");
  const staleMission = materialize(staleRoot, "stale");
  const beforeStale = workspaceSnapshot(staleRoot);
  assert.throws(() => record(staleRoot, { ...outcomeArgs(staleMission), decisionRevision: 2 }), /current research decision is stale|does not authorize/u);
  assert.deepEqual(workspaceSnapshot(staleRoot), beforeStale);

  const rollbackRoot = createTempRoot("dove-research-outcome-rollback-");
  const rollbackMission = materialize(rollbackRoot, "rollback");
  const beforeRollback = workspaceSnapshot(rollbackRoot);
  const fsOps = {
    ...fs,
    renameSync(from, to, metadata) {
      if (metadata?.anchoredTo?.startsWith(`${ARTIFACT_PATHS.executionReceiptsDir}/`)) throw new Error("injected research receipt promotion failure");
      return fs.renameSync(from, to);
    }
  };
  assert.throws(() => record(rollbackRoot, outcomeArgs(rollbackMission), { fsOps }), /all staged changes were rolled back.*injected research receipt promotion failure/u);
  assert.deepEqual(workspaceSnapshot(rollbackRoot), beforeRollback);
});
