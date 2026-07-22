import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ingestExecutionReceipt } from "../../src/core/execution-receipts.mjs";
import { queryDoveLessons } from "../../src/core/lessons.mjs";
import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { queryDoveStatus } from "../../src/core/mission-queries.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { ARTIFACT_PATHS, DOVE_WORKSPACE_SCHEMA_VERSION } from "../../src/core/schema.mjs";
import { inspectDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function snapshot(root) {
  const values = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(fullPath);
      else values[path.relative(root, fullPath)] = fs.readFileSync(fullPath).toString("base64");
    }
  };
  visit(root);
  return values;
}

function materializeMission(root, missionId = "research-mission") {
  const proposal = createDoveMission(root, { missionId, goal: "Track research decisions.", completionCriteria: [], evidenceRequirements: [] });
  return runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, proposal.confirmation.confirmArgs)).mission;
}

function pendingNode(overrides = {}) {
  return {
    nodeId: overrides.nodeId ?? "baseline-search",
    parentNodeId: overrides.parentNodeId ?? null,
    workKind: overrides.workKind ?? "retrieval",
    questionOrHypothesis: overrides.questionOrHypothesis ?? "Does a directly comparable baseline exist?",
    workDescription: overrides.workDescription ?? "Search and analyze the scoped literature.",
    successOrStopCriterion: overrides.successOrStopCriterion ?? "Find a directly comparable baseline or exhaust the scoped corpus.",
    status: overrides.status ?? "pending",
    outcomeSummary: overrides.outcomeSummary ?? null,
    outcomeEvidenceRefs: overrides.outcomeEvidenceRefs ?? [],
    blockedReasonCode: overrides.blockedReasonCode ?? null,
    lessonId: overrides.lessonId ?? null
  };
}

function ownEvidence(root, mission, relativePath = "outputs/search-report.md", receiptId = "research-evidence") {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, "Search corpus exhausted; no directly comparable baseline was found.\n");
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex");
  runWithMutationContext(root, { actionId: "ingest-execution-receipt", mutationMode: "direct-process", hostId: "test" }, () => ingestExecutionReceipt(root, {
    receiptId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    summary: "Record current research evidence.",
    artifacts: [{ path: relativePath, kind: "report", sha256 }],
    validations: [],
    criteriaSatisfied: [],
    producedAt: new Date().toISOString()
  }));
  return relativePath;
}

function ownValidation(root, mission, relativePath = "outputs/validation.log", receiptId = "research-validation") {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, "Validation passed.\n");
  const outputHash = crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex");
  runWithMutationContext(root, { actionId: "ingest-execution-receipt", mutationMode: "direct-process", hostId: "test" }, () => ingestExecutionReceipt(root, {
    receiptId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    summary: "Record current validation evidence.",
    artifacts: [],
    validations: [{ kind: "test-log", reference: relativePath, outputHash }],
    criteriaSatisfied: [],
    producedAt: new Date().toISOString()
  }));
  return relativePath;
}

test("schema 9 research-tree proposals are zero-write and exact replay materializes the approved minimal node model", () => {
  const root = createTempRoot("dove-research-tree-");
  const mission = materializeMission(root);
  assert.equal(DOVE_WORKSPACE_SCHEMA_VERSION, 9);
  const before = snapshot(root);
  const proposal = createDoveMission(root, { operation: "reevaluate-research-tree", missionId: mission.missionId, requirement: "Investigate the baseline.", nodeUpdates: [pendingNode({ workKind: "analysis" })] });
  assert.equal(proposal.status, "needs-confirmation");
  assert.match(proposal.hostMediation, /host invokes reevaluation.*does not schedule/u);
  assert.deepEqual(proposal.diff, { fromRevision: 0, toRevision: 1, addedNodes: ["baseline-search"], completedNodes: [], blockedNodes: [], unchangedNodes: [] });
  assert.deepEqual(snapshot(root), before);
  const result = runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, proposal.confirmation.confirmArgs));
  assert.equal(result.tree.nodes[0].workKind, "analysis");
  assert.equal(inspectDoveWorkspace(root).healthy, true);
  assert.equal(queryDoveStatus(root, { missionId: mission.missionId }).currentContext.researchTree.statusCounts.pending, 1);
  assert.equal(queryDoveStatus(root, { missionId: mission.missionId, detail: "full" }).researchTree.nodes.length, 1);
  assert.throws(() => queryDoveStatus(root, { missionId: mission.missionId, full: true }), /detail|unknown/u);
});

test("completed research nodes require a persisted pending state and current mission-owned evidence", () => {
  const root = createTempRoot("dove-research-completed-");
  const mission = materializeMission(root);
  assert.throws(() => createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Record an immediate result.",
    nodeUpdates: [pendingNode({
      status: "completed",
      outcomeSummary: "The analysis is complete.",
      outcomeEvidenceRefs: ["artifact:outputs/result.md"]
    })]
  }), /must start as pending/u);

  const create = createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Investigate.",
    nodeUpdates: [pendingNode()]
  });
  runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, create.confirmation.confirmArgs));
  assert.throws(() => createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Record completion.",
    nodeUpdates: [pendingNode({ status: "completed", outcomeSummary: "A comparable baseline exists." })]
  }), /completed nodes require at least one current outcomeEvidenceRef/u);

  const evidencePath = ownEvidence(root, mission);
  const completed = createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Record completion.",
    nodeUpdates: [pendingNode({
      status: "completed",
      outcomeSummary: "The scoped search reached a supported conclusion.",
      outcomeEvidenceRefs: [`artifact:${evidencePath}`]
    })]
  });
  assert.deepEqual(completed.diff.completedNodes, ["baseline-search"]);
  assert.equal(completed.lessons.length, 0);
  const result = runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, completed.confirmation.confirmArgs));
  assert.equal(result.tree.nodes[0].status, "completed");
  assert.deepEqual(result.tree.nodes[0].outcomeEvidenceRefs, [`artifact:${evidencePath}`]);
});

test("completed research nodes accept current validation evidence and reject validation drift without writes", () => {
  const root = createTempRoot("dove-research-validation-evidence-");
  const mission = materializeMission(root);
  const create = createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Validate the result.",
    nodeUpdates: [pendingNode({ workKind: "experiment" })]
  });
  runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, create.confirmation.confirmArgs));
  const validationPath = ownValidation(root, mission);
  const completed = createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Record validated completion.",
    nodeUpdates: [pendingNode({
      workKind: "experiment",
      status: "completed",
      outcomeSummary: "The current validation passed.",
      outcomeEvidenceRefs: [`validation:${validationPath}`]
    })]
  });
  const applied = runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, completed.confirmation.confirmArgs));
  assert.deepEqual(applied.tree.nodes[0].outcomeEvidenceRefs, [`validation:${validationPath}`]);

  const second = createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Start another validation decision.",
    nodeUpdates: [pendingNode({ nodeId: "second-validation", workKind: "experiment" })]
  });
  runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, second.confirmation.confirmArgs));
  fs.appendFileSync(path.join(root, validationPath), "Drifted.\n");
  const before = snapshot(root);
  assert.throws(() => createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Reject stale validation evidence.",
    nodeUpdates: [pendingNode({
      nodeId: "second-validation",
      workKind: "experiment",
      status: "completed",
      outcomeSummary: "This must not be accepted.",
      outcomeEvidenceRefs: [`validation:${validationPath}`]
    })]
  }), /changed since its validation receipt/u);
  assert.deepEqual(snapshot(root), before);
});

test("completed research nodes reject foreign and stale artifact evidence without writes", () => {
  const root = createTempRoot("dove-research-completed-evidence-");
  const mission = materializeMission(root);
  const foreignMission = materializeMission(root, "foreign-mission");
  const create = createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Investigate.",
    nodeUpdates: [pendingNode()]
  });
  runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, create.confirmation.confirmArgs));

  const foreignPath = ownEvidence(root, foreignMission, "outputs/foreign-report.md", "foreign-evidence");
  const beforeForeign = snapshot(root);
  assert.throws(() => createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Use foreign evidence.",
    nodeUpdates: [pendingNode({ status: "completed", outcomeSummary: "Done.", outcomeEvidenceRefs: [`artifact:${foreignPath}`] })]
  }), /belongs to mission foreign-mission/u);
  assert.deepEqual(snapshot(root), beforeForeign);

  const ownPath = ownEvidence(root, mission);
  fs.appendFileSync(path.join(root, ownPath), "Drifted after receipt.\n");
  const beforeStale = snapshot(root);
  assert.throws(() => createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Use stale evidence.",
    nodeUpdates: [pendingNode({ status: "completed", outcomeSummary: "Done.", outcomeEvidenceRefs: [`artifact:${ownPath}`] })]
  }), /changed since its latest ownership receipt/u);
  assert.deepEqual(snapshot(root), beforeStale);
});

test("blocked reevaluation requires current evidence and reason code, then atomically writes an ordinary failure Lesson", () => {
  const root = createTempRoot("dove-research-blocked-");
  const mission = materializeMission(root);
  const create = createDoveMission(root, { operation: "reevaluate-research-tree", missionId: mission.missionId, requirement: "Investigate.", nodeUpdates: [pendingNode()] });
  runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, create.confirmation.confirmArgs));
  assert.throws(() => createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Record failure.",
    nodeUpdates: [pendingNode({ status: "blocked", outcomeSummary: "No baseline.", blockedReasonCode: "corpus-exhausted" })]
  }), /outcomeEvidenceRef/u);
  const evidencePath = ownEvidence(root, mission);
  const before = snapshot(root);
  const blocked = createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Record the failed result.",
    nodeUpdates: [pendingNode({
      status: "blocked",
      outcomeSummary: "No comparable baseline was found.",
      outcomeEvidenceRefs: [`artifact:${evidencePath}`],
      blockedReasonCode: "corpus-exhausted"
    })]
  });
  assert.equal(blocked.lessons[0].kind, "failure");
  assert.equal(Object.hasOwn(blocked.lessons[0], "state"), false);
  assert.equal(Object.hasOwn(blocked.lessons[0], "origin"), false);
  assert.equal(blocked.tree.nodes[0].lessonId, blocked.lessons[0].lessonId);
  assert.deepEqual(snapshot(root), before);
  const result = runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, blocked.confirmation.confirmArgs));
  assert.equal(result.receipt.artifacts.length, 2);
  const lessons = queryDoveLessons(root, { missionId: mission.missionId });
  assert.equal(lessons.lessonCount, 1);
  assert.equal(lessons.items[0].kind, "failure");
  assert.equal(Object.hasOwn(lessons.items[0], "state"), false);
  assert.equal(lessons.items[0].researchTreeOrigin.blockedReasonCode, "corpus-exhausted");
});

test("blocked nodes cannot add an autonomous alternative and exact replay remains single-use", () => {
  const root = createTempRoot("dove-research-guard-");
  const mission = materializeMission(root);
  const initial = createDoveMission(root, { operation: "reevaluate-research-tree", missionId: mission.missionId, requirement: "Investigate.", nodeUpdates: [pendingNode()] });
  runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, initial.confirmation.confirmArgs));
  const evidencePath = ownEvidence(root, mission);
  assert.throws(() => createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Record failure and switch direction.",
    nodeUpdates: [
      pendingNode({ status: "blocked", outcomeSummary: "No baseline.", outcomeEvidenceRefs: [`artifact:${evidencePath}`], blockedReasonCode: "corpus-exhausted" }),
      pendingNode({ nodeId: "alternative", workKind: "experiment", questionOrHypothesis: "Try another direction?", workDescription: "Run an alternative experiment.", successOrStopCriterion: "Improve the result." })
    ]
  }), /must not add alternative or replacement nodes/u);
  const blocked = createDoveMission(root, {
    operation: "reevaluate-research-tree",
    missionId: mission.missionId,
    requirement: "Record failure.",
    nodeUpdates: [pendingNode({ status: "blocked", outcomeSummary: "No baseline.", outcomeEvidenceRefs: [`artifact:${evidencePath}`], blockedReasonCode: "corpus-exhausted" })]
  });
  runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, blocked.confirmation.confirmArgs));
  const before = snapshot(root);
  assert.throws(() => runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, blocked.confirmation.confirmArgs)), /no durable decision changes|no longer matches|terminal/u);
  assert.deepEqual(snapshot(root), before);
});
