import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assessMissionCompletion } from "../../src/core/completion-gates.mjs";
import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { queryDoveStatus } from "../../src/core/mission-queries.mjs";
import { publicResult as createPublicEnvelope } from "../../src/core/public-reports.mjs";
import { operationForTool } from "../../src/core/operation-registry.mjs";
import { classifyInvocationOutcome } from "../../src/core/operational-outcome.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { readCurrentResearchDecision, readResearchDecisions } from "../../src/core/research-decision-store.mjs";
import { prepareResearchDecisionReevaluation, reevaluateResearchDecision } from "../../src/core/research-decision-reevaluation.mjs";
import { createResearchHandoff, validateResearchHandoff } from "../../src/core/research-handoff.mjs";
import { recordResearchOutcome } from "../../src/core/research-outcome.mjs";
import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";
import { openDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { materializeRootMission } from "../helpers/current-schema-workspace.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function materialize(root, missionId, mission = {}) {
  fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
  fs.writeFileSync(path.join(root, "outputs/result.md"), "bounded result\n", "utf8");
  return materializeRootMission(root, {
    missionId,
    goal: "Determine whether the bounded method remains viable.",
    mission: {
      requirements: ["Interpret the bounded result."],
      assumptions: ["The bounded action can return useful evidence."],
      artifacts: [{ path: "outputs/result.md", required: true, role: "output" }],
      completionCriteria: ["The current result is interpreted."],
      evidenceRequirements: ["artifact:outputs/result.md"],
      ...mission
    }
  });
}

function reevaluate(root, mission, decision, overrides = {}, options = {}) {
  return runWithMutationContext(root, {
    actionId: "reevaluate-research-decision",
    mutationMode: "direct-process",
    hostId: "test",
    ...(options.fsOps ? { fsOps: options.fsOps } : {})
  }, () => reevaluateResearchDecision(root, {
    operation: "reevaluate-research-decision",
    missionId: mission.missionId,
    decisionRevision: overrides.decisionRevision ?? decision.revision,
    requestedDisposition: overrides.requestedDisposition ?? "continue",
    synthesis: overrides.synthesis ?? "The bounded direction remains viable for one explicit next action.",
    hypotheses: overrides.hypotheses ?? decision.hypotheses,
    routes: overrides.routes ?? decision.routes,
    openQuestions: overrides.openQuestions ?? decision.openQuestions,
    evidenceRefs: overrides.evidenceRefs ?? [],
    consumedReceiptIds: overrides.consumedReceiptIds ?? [],
    reasonCodes: overrides.reasonCodes ?? [],
    nextAction: Object.hasOwn(overrides, "nextAction") ? overrides.nextAction : {
      actionId: "next-bounded-action",
      kind: "analysis",
      description: "Run the next bounded analysis.",
      rationale: "The current judgment authorizes one more bounded step.",
      targetHypothesisOrQuestionIds: [decision.hypotheses[0]?.hypothesisId ?? decision.openQuestions[0].questionId],
      successConditions: ["Return one inspectable bounded result."],
      stopConditions: ["Stop after one action."],
      expectedEvidence: ["bounded-result"],
      budget: { actions: 1, timeMinutes: 30, costUnits: 1 }
    },
    createdAt: overrides.createdAt ?? new Date(Math.max(Date.now(), Date.parse(decision.createdAt) + 1)).toISOString()
  }));
}

function recordOutcome(root, mission, decision, attemptId = "reevaluation-attempt", overrides = {}) {
  const startedAt = new Date(Math.max(Date.parse(decision.createdAt), Date.now() - 1000)).toISOString();
  return runWithMutationContext(root, { actionId: "record-research-outcome", mutationMode: "direct-process", hostId: "test" }, () => recordResearchOutcome(root, {
    missionId: mission.missionId,
    decisionRevision: decision.revision,
    attemptId,
    status: overrides.status ?? "completed",
    performedActionCount: 1,
    actualUsage: { actions: 1, timeMinutes: 1, costUnits: 1 },
    evidenceReturned: overrides.evidenceReturned ?? [...decision.nextAction.expectedEvidence],
    artifactPaths: overrides.artifactPaths ?? ["outputs/result.md"],
    validationPaths: [],
    facts: overrides.facts ?? ["The bounded action produced the declared result file."],
    startedAt,
    finishedAt: new Date(Date.parse(startedAt) + 1).toISOString()
  }));
}

function statusReport(root, missionId = null, options = {}) {
  const detail = options.detail ?? "compact";
  const status = queryDoveStatus(root, { ...(missionId ? { missionId } : {}), detail });
  return createPublicEnvelope("query_dove_status", status, classifyInvocationOutcome(status, operationForTool("query_dove_status")), { includeTechnicalAppendix: detail === "full" }).report;
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
  visit(path.join(root, ".dove"));
  return result;
}

test("public reevaluation preparation derives durable route ids instead of accepting them from callers", () => {
  const root = createTempRoot("dove-research-reevaluation-route-ids-");
  const mission = materialize(root, "route-ids");
  const decision = readCurrentResearchDecision(root, mission.missionId);
  const input = {
    operation: "reevaluate-research-decision",
    missionNumber: 1,
    requestedDisposition: "continue",
    synthesis: "One bounded comparison remains useful.",
    hypotheses: decision.hypotheses.map(({ hypothesisId: _hypothesisId, ...item }) => item),
    routes: [{ summary: "Run one bounded comparison.", disposition: "selected", rationale: "It discriminates the current hypothesis." }],
    openQuestions: decision.openQuestions.map(({ questionId: _questionId, ...item }) => item),
    evidenceRefs: [],
    reasonCodes: [],
    nextAction: {
      kind: "analysis",
      description: "Run the bounded comparison.",
      rationale: "The comparison addresses the current question.",
      targets: [decision.hypotheses.length > 0 ? "hypothesis:1" : "question:1"],
      successConditions: ["Return one inspectable result."],
      stopConditions: ["Stop after one comparison."],
      expectedEvidence: ["bounded-comparison"],
      budget: { actions: 1, timeMinutes: 30, costUnits: 1 }
    }
  };
  const first = prepareResearchDecisionReevaluation(root, input);
  const second = prepareResearchDecisionReevaluation(root, input);
  assert.match(first.routes[0].routeId, /^route-2-/u);
  assert.equal(first.routes[0].routeId, second.routes[0].routeId);
  assert.equal(Object.hasOwn(input.routes[0], "routeId"), false);
});

test("continue reevaluation appends one mission-bound decision and returns a new handoff", () => {
  const root = createTempRoot("dove-research-reevaluation-continue-");
  const mission = materialize(root, "continue");
  const first = readCurrentResearchDecision(root, mission.missionId);
  const result = reevaluate(root, mission, first);
  assert.equal(result.decision.revision, 2);
  assert.equal(result.decision.predecessorDecisionId, first.decisionId);
  assert.equal(result.decision.contractDigest, mission.contractDigest);
  assert.equal(result.executionHandoff.decisionDigest, result.decision.decisionDigest);
  assert.equal(result.executionHandoff.actionId, result.decision.nextAction.actionId);
  assert.equal(Object.hasOwn(result.decision, "requirementSnapshotId"), false);
  assert.deepEqual(readResearchDecisions(root, { missionId: mission.missionId }).map((item) => item.revision), [1, 2]);
  const report = statusReport(root, mission.missionId);
  assert.equal(report.progress.blockedItems, 0);
  assert.doesNotMatch(JSON.stringify(report), /requires a user decision/iu);
});

test("receipt consumption is explicit and clears derived awaiting reevaluation", () => {
  const root = createTempRoot("dove-research-reevaluation-consume-");
  const mission = materialize(root, "consume");
  const first = readCurrentResearchDecision(root, mission.missionId);
  const outcome = recordOutcome(root, mission, first);
  const before = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(before.researchOutcome.awaitingReevaluation, true);
  const awaitingStatus = statusReport(root, mission.missionId);
  assert.match(awaitingStatus.recommendation, /Reevaluate the recorded execution evidence/iu);
  assert.doesNotMatch(awaitingStatus.recommendation, new RegExp(first.nextAction.description, "u"));
  assert.deepEqual(awaitingStatus.nextActions, []);

  const result = reevaluate(root, mission, first, {
    requestedDisposition: "stop-satisfied",
    synthesis: "The current receipt and artifact satisfy the bounded research objective.",
    evidenceRefs: ["artifact:outputs/result.md"],
    consumedReceiptIds: [outcome.receipt.receiptId],
    reasonCodes: ["research-objective-satisfied"],
    nextAction: null
  });
  assert.deepEqual(result.decision.consumedReceiptIds, [outcome.receipt.receiptId]);
  const after = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(after.researchOutcome.awaitingReevaluation, false);
  assert.deepEqual(after.researchOutcome.consumedReceiptIds, [outcome.receipt.receiptId]);
  const consumedStatus = statusReport(root, mission.missionId);
  assert.equal(consumedStatus.progress.blockedItems, 0);
  assert.equal(consumedStatus.researchNarrative.nextStep, null);
  assert.equal(consumedStatus.researchNarrative.stopReason, result.decision.synthesis);
});

test("receipt interpretation remains consumed across multiple decision revisions", () => {
  const root = createTempRoot("dove-research-reevaluation-multi-round-");
  const mission = materialize(root, "multi-round");
  const first = readCurrentResearchDecision(root, mission.missionId);
  const firstOutcome = recordOutcome(root, mission, first, "first-round-attempt");
  const continued = reevaluate(root, mission, first, {
    consumedReceiptIds: [firstOutcome.receipt.receiptId],
    evidenceRefs: ["artifact:outputs/result.md"]
  });
  const secondOutcome = recordOutcome(root, mission, continued.decision, "second-round-attempt");
  assert.equal(assessMissionCompletion(root, { missionId: mission.missionId }).researchOutcome.awaitingReevaluation, true);

  reevaluate(root, mission, continued.decision, {
    requestedDisposition: "stop-satisfied",
    synthesis: "Both bounded rounds have been interpreted and satisfy the research objective.",
    evidenceRefs: ["artifact:outputs/result.md"],
    consumedReceiptIds: [secondOutcome.receipt.receiptId],
    reasonCodes: ["research-objective-satisfied"],
    nextAction: null
  });

  const completion = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(completion.researchOutcome.awaitingReevaluation, false);
  assert.deepEqual(completion.researchOutcome.consumedReceiptIds, [firstOutcome.receipt.receiptId, secondOutcome.receipt.receiptId]);
  assert.deepEqual(completion.researchOutcome.unconsumedReceiptIds, []);
  const report = statusReport(root, mission.missionId, { detail: "full" });
  assert.equal(report.progress.blockedItems, 0);
  assert.deepEqual(report.technicalAppendix.outcomes.items.map((item) => item.interpretation), ["interpreted", "interpreted"]);
});

test("block-needs-user remains one explicit current blocker after receipt interpretation across status scopes", () => {
  const root = createTempRoot("dove-research-reevaluation-user-block-");
  const mission = materialize(root, "user-block");
  const first = readCurrentResearchDecision(root, mission.missionId);
  const outcome = recordOutcome(root, mission, first);
  const durableReceiptSummary = outcome.receipt.summary;
  const result = reevaluate(root, mission, first, {
    requestedDisposition: "block-needs-user",
    synthesis: "The bounded result is recorded, but a user-provided execution input is required before research can continue.",
    evidenceRefs: ["artifact:outputs/result.md"],
    consumedReceiptIds: [outcome.receipt.receiptId],
    reasonCodes: ["user-input-required"],
    nextAction: null
  });
  assert.equal(result.decision.disposition, "block-needs-user");
  assert.match(durableReceiptSummary, /scientific interpretation remains pending/iu);
  assert.equal(openDoveWorkspace(root).receiptLedger.receipts.find((receipt) => receipt.receiptId === outcome.receipt.receiptId)?.summary, durableReceiptSummary);

  const completion = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(completion.complete, false);
  assert.equal(completion.researchOutcome.awaitingReevaluation, false);
  assert.ok(completion.incompleteReasons.includes("research-user-decision-required"));
  assert.equal(completion.incompleteReasons.filter((reason) => reason === "research-user-decision-required").length, 1);

  const report = statusReport(root, mission.missionId, { detail: "full" });
  assert.equal(report.currentSituation.trackedWorkstreams, 1);
  assert.equal(report.progress.state, "blocked");
  assert.equal(report.progress.blockedItems, 1);
  assert.match(report.recommendation, /Resolve the recorded user decision/iu);
  assert.equal(report.technicalAppendix.workstreams.items[0].state, "blocked");
  assert.match(report.technicalAppendix.workstreams.items[0].gaps.join("\n"), /requires a user decision/iu);
  assert.equal(report.technicalAppendix.gaps.items.filter((item) => /requires a user decision/iu.test(item.description)).length, 1);
  assert.equal(report.technicalAppendix.researchItems.items.filter((item) => item.state === "blocked" && /requires a user decision/iu.test(item.blockedReason)).length, 1);
  assert.deepEqual(report.technicalAppendix.outcomes.items.map((item) => ({ summary: item.summary, interpretation: item.interpretation })), [{
    summary: "Research execution facts were recorded and interpreted by a later scientific judgment.",
    interpretation: "interpreted"
  }]);
  const publicJson = JSON.stringify(report);
  for (const privateId of [mission.missionId, first.decisionId, result.decision.decisionId, outcome.receipt.receiptId]) assert.doesNotMatch(publicJson, new RegExp(privateId, "u"));

  const unblockedMission = materialize(root, "unblocked", { artifacts: [], completionCriteria: [], evidenceRequirements: [] });
  const unblockedReport = statusReport(root, unblockedMission.missionId, { detail: "full" });
  assert.equal(unblockedReport.currentSituation.trackedWorkstreams, 1);
  assert.equal(unblockedReport.progress.blockedItems, 0);
  assert.notEqual(unblockedReport.progress.state, "blocked");
  assert.deepEqual(unblockedReport.technicalAppendix.workstreams.items.map((item) => item.number), [2]);
  assert.equal(unblockedReport.technicalAppendix.gaps.items.some((item) => /requires a user decision/iu.test(item.description)), false);

  const workspaceReport = statusReport(root, null, { detail: "full" });
  assert.equal(workspaceReport.currentSituation.trackedWorkstreams, 2);
  assert.equal(workspaceReport.progress.state, "blocked");
  assert.equal(workspaceReport.progress.blockedItems, 1);
  assert.equal(workspaceReport.technicalAppendix.gaps.items.filter((item) => /requires a user decision/iu.test(item.description)).length, 1);
});

test("reevaluation invalidates the previous decision-bound handoff without snapshot bindings", () => {
  const root = createTempRoot("dove-research-reevaluation-handoff-");
  const mission = materialize(root, "handoff");
  const first = readCurrentResearchDecision(root, mission.missionId);
  const oldHandoff = createResearchHandoff(first, { issuedAt: first.createdAt, expiresAt: new Date(Date.parse(first.createdAt) + 4 * 60 * 60 * 1000).toISOString() });
  const result = reevaluate(root, mission, first);
  assert.throws(() => validateResearchHandoff(oldHandoff, {
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    decisionDigest: result.decision.decisionDigest,
    currentEnvelopeId: oldHandoff.envelopeId,
    supersededEnvelopeIds: [],
    now: result.decision.createdAt
  }), /stale.*decisionDigest/iu);
});

test("stale revisions and cross-mission receipt consumption are zero-write", () => {
  const root = createTempRoot("dove-research-reevaluation-zero-write-");
  const firstMission = materialize(root, "first");
  const secondMission = materialize(root, "second", { artifacts: [] });
  const firstDecision = readCurrentResearchDecision(root, firstMission.missionId);
  const secondDecision = readCurrentResearchDecision(root, secondMission.missionId);
  recordOutcome(root, firstMission, firstDecision, "first-mission-attempt");
  const foreign = recordOutcome(root, secondMission, secondDecision, "second-mission-attempt", {
    status: "failed",
    evidenceReturned: [],
    artifactPaths: [],
    facts: ["The bounded action returned no usable material."]
  });

  for (const overrides of [
    { decisionRevision: firstDecision.revision + 1 },
    { consumedReceiptIds: [] },
    { consumedReceiptIds: [foreign.receipt.receiptId] }
  ]) {
    const before = snapshot(root);
    assert.throws(() => reevaluate(root, firstMission, firstDecision, overrides), /stale|eligible unconsumed receipt|current mission/u);
    assert.deepEqual(snapshot(root), before);
  }
});

test("decision promotion failure rolls back the reevaluation", () => {
  const root = createTempRoot("dove-research-reevaluation-rollback-");
  const mission = materialize(root, "rollback");
  const decision = readCurrentResearchDecision(root, mission.missionId);
  const before = snapshot(root);
  const fsOps = { ...fs, renameSync(from, to, metadata) { if (metadata?.anchoredTo?.startsWith(`${ARTIFACT_PATHS.researchDecisionsDir}/`)) throw new Error("injected reevaluation promotion failure"); return fs.renameSync(from, to); } };
  assert.throws(() => reevaluate(root, mission, decision, {}, { fsOps }), /all staged changes were rolled back.*injected reevaluation promotion failure/u);
  assert.deepEqual(snapshot(root), before);
  assert.equal(openDoveWorkspace(root).currentResearchDecisions.get(mission.missionId).revision, 1);
});
