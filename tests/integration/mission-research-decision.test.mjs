import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";
import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { readCurrentResearchDecision, researchDecisionPath } from "../../src/core/research-decision-store.mjs";
import { inspectDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { initializeWorkspace } from "../helpers/current-schema-workspace.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function snapshot(root) {
  const values = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(fullPath);
      else values[path.relative(root, fullPath)] = entry.isSymbolicLink() ? `link:${fs.readlinkSync(fullPath)}` : fs.readFileSync(fullPath).toString("base64");
    }
  };
  visit(root);
  return values;
}

function materialize(root, proposal, options = {}) {
  return runWithMutationContext(root, {
    actionId: "create-dove-mission",
    mutationMode: proposal.confirmation.confirmArgs.mutationMode,
    hostId: "test",
    ...(options.fsOps ? { fsOps: options.fsOps } : {})
  }, () => createDoveMission(root, proposal.confirmation.confirmArgs));
}

test("mission proposal deterministically derives one bounded analysis decision and exact research handoff with zero writes", () => {
  const root = createTempRoot("dove-mission-initial-decision-");
  initializeWorkspace(root);
  const before = snapshot(root);
  const input = {
    mode: "research",
    missionId: "initial-analysis",
    goal: "Synthesize the approved research direction.",
    requirements: ["Synthesize requirements and identify the bounded next step."],
    assumptions: ["The available observations are comparable."]
  };
  const proposal = createDoveMission(root, input);
  const repeated = createDoveMission(root, input);
  assert.deepEqual(snapshot(root), before);
  assert.equal(proposal.proposalDigest, repeated.proposalDigest);
  assert.equal(proposal.confirmation.confirmArgs.decisionCreatedAt, proposal.confirmation.confirmArgs.createdAt);
  assert.equal(proposal.confirmation.confirmArgs.handoffIssuedAt, proposal.confirmation.confirmArgs.decisionCreatedAt);
  assert.equal(Date.parse(proposal.confirmation.confirmArgs.handoffExpiresAt) - Date.parse(proposal.confirmation.confirmArgs.handoffIssuedAt), 4 * 60 * 60 * 1000);

  const result = materialize(root, proposal);
  const decision = readCurrentResearchDecision(root, result.mission.missionId);
  assert.equal(decision.revision, 1);
  assert.equal(decision.synthesis, input.goal);
  assert.equal(decision.hypotheses.length, 1);
  assert.equal(decision.openQuestions.length, 1);
  assert.equal(decision.nextAction.kind, "analysis");
  assert.equal(result.executionHandoff.decisionDigest, decision.decisionDigest);
  assert.equal(result.executionHandoff.actionId, decision.nextAction.actionId);
  assert.equal(result.executionHandoff.issuedAt, proposal.confirmation.confirmArgs.handoffIssuedAt);
  assert.equal(result.executionHandoff.expiresAt, proposal.confirmation.confirmArgs.handoffExpiresAt);
  assert.equal(inspectDoveWorkspace(root).currentResearchDecisions.get(result.mission.missionId).decisionId, decision.decisionId);
  assert.deepEqual(new Set(result.mutation.paths), new Set([
    `${ARTIFACT_PATHS.missionsDir}/${result.mission.missionId}.json`,
    researchDecisionPath(decision.decisionId)
  ]));
});

test("initial engineering work never self-authorizes and remains bounded analysis", () => {
  const explicitRoot = createTempRoot("dove-mission-initial-engineering-");
  initializeWorkspace(explicitRoot);
  const explicitProposal = createDoveMission(explicitRoot, {
    mode: "research",
    missionId: "initial-engineering",
    goal: "Produce the declared implementation artifact.",
    artifacts: [{ path: "result.md", required: true, role: "output" }],
    completionCriteria: ["The result is current."],
    evidenceRequirements: ["artifact:result.md"]
  });
  const explicit = materialize(explicitRoot, explicitProposal);
  assert.equal(explicit.currentResearchDecision.nextAction.kind, "analysis");


});

test("decision and handoff exact replay timestamps participate in proposal drift detection and remain canonically bound", () => {
  const root = createTempRoot("dove-mission-decision-replay-");
  initializeWorkspace(root);
  const proposal = createDoveMission(root, {
    mode: "research", missionId: "decision-replay", goal: "Protect exact research replay." });
  for (const field of ["decisionCreatedAt", "handoffIssuedAt", "handoffExpiresAt"]) {
    const tampered = structuredClone(proposal.confirmation.confirmArgs);
    tampered[field] = new Date(Date.parse(tampered[field]) + 1).toISOString();
    const before = snapshot(root);
    assert.throws(() => runWithMutationContext(root, {
      actionId: "create-dove-mission",
      mutationMode: "direct-process",
      hostId: "test"
    }, () => createDoveMission(root, tampered)), /canonical window|no longer matches|requires/iu);
    assert.deepEqual(snapshot(root), before);
  }

  const rebound = structuredClone(proposal.confirmation.confirmArgs);
  rebound.decisionCreatedAt = new Date(Date.parse(rebound.decisionCreatedAt) + 1).toISOString();
  rebound.handoffIssuedAt = rebound.decisionCreatedAt;
  rebound.handoffExpiresAt = new Date(Date.parse(rebound.handoffIssuedAt) + 4 * 60 * 60 * 1000).toISOString();
  assert.throws(() => createDoveMission(root, rebound), /canonical window/u);
});

test("mission patch plan and direct-process rollback include the canonical decision file", () => {
  const patchRoot = createTempRoot("dove-mission-decision-patch-");
  initializeWorkspace(patchRoot);
  const patchBefore = snapshot(patchRoot);
  const patchProposal = createDoveMission(patchRoot, {
    mode: "research",
    missionId: "decision-patch",
    goal: "Plan mission, snapshot, and initial decision atomically.",
    mutationMode: "patch-plan"
  });
  const patchResult = materialize(patchRoot, patchProposal);
  const patchPaths = new Set(patchResult.mutationPlan.operations.map((operation) => operation.relativePath));
  assert.equal(patchResult.status, "materialization-planned");
  assert.equal(patchResult.writesApplied, false);
  assert.equal(patchPaths.has(researchDecisionPath(patchResult.currentResearchDecision.decisionId)), true);
  assert.deepEqual(snapshot(patchRoot), patchBefore);

  const rollbackRoot = createTempRoot("dove-mission-decision-rollback-");
  initializeWorkspace(rollbackRoot);
  const bootstrapProposal = createDoveMission(rollbackRoot, {
    mode: "research",
    missionId: "decision-bootstrap",
    goal: "Create a baseline mission before rollback testing."
  });
  materialize(rollbackRoot, bootstrapProposal);
  const rollbackBefore = snapshot(rollbackRoot);
  const rollbackProposal = createDoveMission(rollbackRoot, {
    mode: "research",
    missionId: "decision-rollback",
    goal: "Rollback all later mission research state."
  });
  const failDecisionPromotion = {
    ...fs,
    renameSync(from, to, metadata) {
      if (metadata?.anchoredTo?.startsWith(`${ARTIFACT_PATHS.researchDecisionsDir}/`)) {
        throw new Error("injected initial decision promotion failure");
      }
      return fs.renameSync(from, to);
    }
  };
  assert.throws(() => materialize(rollbackRoot, rollbackProposal, { fsOps: failDecisionPromotion }), /all staged changes were rolled back.*injected initial decision promotion failure/u);
  assert.deepEqual(snapshot(rollbackRoot), rollbackBefore);
});
