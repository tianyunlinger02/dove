import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import * as core from "../../src/core/index.mjs";
import { isBookkeepingArtifactPath } from "../../src/core/artifact-integrity.mjs";
import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { appendResearchDecision as appendResearchDecisionChain, createResearchDecision, createResearchDecisionAction } from "../../src/core/research-decisions.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";
import { inspectDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { initializeWorkspace } from "../helpers/current-schema-workspace.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function decisionContent(overrides = {}) {
  return {
    synthesis: overrides.synthesis ?? "The bounded research direction remains unresolved.",
    hypotheses: overrides.hypotheses ?? [],
    routes: overrides.routes ?? [],
    openQuestions: overrides.openQuestions ?? [{ questionId: "bounded-question", question: "What current evidence resolves the bounded question?" }],
    evidenceRefs: overrides.evidenceRefs ?? [],
    consumedReceiptIds: overrides.consumedReceiptIds ?? [],
    disposition: overrides.disposition ?? "continue",
    reasonCodes: overrides.reasonCodes ?? [],
    nextAction: Object.hasOwn(overrides, "nextAction")
      ? overrides.nextAction
      : createResearchDecisionAction({
          actionId: "bounded-action",
          kind: "analysis",
          description: "Run one bounded analysis.",
          rationale: "The analysis addresses the current open question.",
          targetHypothesisOrQuestionIds: ["bounded-question"],
          successConditions: ["Return one inspectable bounded result."],
          stopConditions: ["Stop after one action."],
          expectedEvidence: ["bounded-result"],
          budget: { actions: 1, timeMinutes: 30, costUnits: 1 }
        })
  };
}

function materialize(root, missionId = "decision-main") {
  initializeWorkspace(root);
  const proposal = createDoveMission(root, { mode: "research", missionId, goal: `Research mission ${missionId}.` });
  return runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, proposal.confirmation.confirmArgs)).mission;
}

function append(root, mission, predecessor, overrides = {}) {
  return runWithMutationContext(root, { actionId: "append-research-decision", mutationMode: "direct-process", hostId: "test", ...(overrides.fsOps ? { fsOps: overrides.fsOps } : {}) }, () => core.appendResearchDecision(root, {
    missionId: mission.missionId,
    predecessorDecisionId: predecessor.decisionId,
    predecessorDecisionDigest: predecessor.decisionDigest,
    createdAt: overrides.createdAt ?? new Date(Date.parse(predecessor.createdAt) + 1).toISOString(),
    content: overrides.content ?? decisionContent()
  }));
}

function snapshot(root) {
  const result = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(full);
      else result[path.relative(root, full)] = fs.readFileSync(full).toString("base64");
    }
  };
  visit(root);
  return result;
}

test("schema 18 exposes mission-bound decision reads and no retired snapshot authority", () => {
  assert.equal(core.DOVE_WORKSPACE_SCHEMA_VERSION, 18);
  assert.equal(isBookkeepingArtifactPath(path.posix.join(ARTIFACT_PATHS.researchDecisionsDir, "example.json")), true);
  const root = createTempRoot("dove-research-decisions-schema18-");
  const mission = materialize(root);
  const current = core.readCurrentResearchDecision(root, mission.missionId);
  assert.equal(current.contractDigest, mission.contractDigest);
  assert.equal(Object.hasOwn(current, "requirementSnapshotId"), false);
  assert.equal(Object.hasOwn(current, "requirementSnapshotDigest"), false);
  assert.equal(fs.existsSync(path.join(root, ".dove/requirement-snapshots")), false);
  assert.equal(inspectDoveWorkspace(root).healthy, true);
});

test("durable decision append writes one immutable id-bound JSON and advances the mission head", () => {
  const root = createTempRoot("dove-research-decisions-append-");
  const mission = materialize(root);
  const first = core.readCurrentResearchDecision(root, mission.missionId);
  const second = append(root, mission, first).decision;
  assert.deepEqual(core.readResearchDecisions(root, { missionId: mission.missionId }).map((item) => item.revision), [1, 2]);
  assert.equal(core.readCurrentResearchDecision(root, mission.missionId).decisionId, second.decisionId);
  assert.equal(fs.existsSync(path.join(root, core.researchDecisionPath(second.decisionId))), true);
});

test("decision construction and chains bind directly to mission contract digests", () => {
  const root = createTempRoot("dove-research-decisions-contract-binding-");
  const mission = materialize(root);
  const first = core.readCurrentResearchDecision(root, mission.missionId);
  const chain = appendResearchDecisionChain([first], {
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    predecessorDecisionId: first.decisionId,
    predecessorDecisionDigest: first.decisionDigest,
    createdAt: new Date(Date.parse(first.createdAt) + 1).toISOString(),
    content: decisionContent()
  });
  assert.equal(chain[1].contractDigest, mission.contractDigest);
  assert.equal(Object.hasOwn(chain[1], "requirementSnapshotId"), false);

  const crossBound = createResearchDecision({ missionId: mission.missionId, contractDigest: "0".repeat(64), revision: 1, predecessorDecisionId: null, predecessorDecisionDigest: null, createdAt: first.createdAt, content: decisionContent() });
  assert.throws(() => core.validatePersistedResearchDecision(crossBound, { contractDigest: mission.contractDigest }), /contractDigest does not match/u);
});

test("governed append rejects missing context and stale predecessors without writes", () => {
  const root = createTempRoot("dove-research-decisions-rejections-");
  const mission = materialize(root);
  const first = core.readCurrentResearchDecision(root, mission.missionId);
  const args = { missionId: mission.missionId, predecessorDecisionId: first.decisionId, predecessorDecisionDigest: first.decisionDigest, createdAt: new Date(Date.parse(first.createdAt) + 1).toISOString(), content: decisionContent() };
  const before = snapshot(root);
  assert.throws(() => core.appendResearchDecision(root, args), /active MutationContext/u);
  assert.deepEqual(snapshot(root), before);
  const second = append(root, mission, first).decision;
  const beforeStale = snapshot(root);
  assert.throws(() => append(root, mission, first, { createdAt: new Date(Date.parse(second.createdAt) + 1).toISOString() }), /stale predecessor/u);
  assert.deepEqual(snapshot(root), beforeStale);
});

test("decision append promotion failure rolls back atomically", () => {
  const root = createTempRoot("dove-research-decisions-rollback-");
  const mission = materialize(root);
  const first = core.readCurrentResearchDecision(root, mission.missionId);
  const before = snapshot(root);
  const fsOps = { ...fs, renameSync(from, to, metadata) { if (metadata?.anchoredTo?.startsWith(`${ARTIFACT_PATHS.researchDecisionsDir}/`)) throw new Error("injected decision promotion failure"); return fs.renameSync(from, to); } };
  assert.throws(() => append(root, mission, first, { fsOps }), /all staged changes were rolled back.*injected decision promotion failure/u);
  assert.deepEqual(snapshot(root), before);
});
