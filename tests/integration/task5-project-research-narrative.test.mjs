import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assessMissionCompletion } from "../../src/core/completion-gates.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { renderPublicReport } from "../../src/core/public-reports.mjs";
import { reevaluateResearchDecision } from "../../src/core/research-decision-reevaluation.mjs";
import { readCurrentResearchDecision } from "../../src/core/research-decision-store.mjs";
import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import { initializeWorkspace } from "../helpers/current-schema-workspace.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

async function invokeEnvelope(root, name, args = {}, options = {}) {
  const result = await dispatchTool(root, name, args, options);
  assert.notEqual(result.isError, true, result.content?.[0]?.text);
  return result.structuredContent;
}

async function invokeReport(root, name, args = {}, options = {}) {
  return (await invokeEnvelope(root, name, args, options)).report;
}

function privateMissionByGoal(root, goal) {
  return fs.readdirSync(path.join(root, ARTIFACT_PATHS.missionsDir))
    .map((name) => JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.missionsDir, name), "utf8")))
    .find((mission) => mission.goal === goal);
}

async function missionNumberByGoal(root, goal) {
  const status = await invokeReport(root, "query_dove_status", { operation: "status", detail: "full" });
  const number = status.technicalAppendix.workstreams.items.find((item) => item.goal === goal)?.number;
  assert.equal(Number.isSafeInteger(number), true, `Missing public workstream number for ${goal}`);
  return number;
}

async function materializeMission(root, goal, overrides = {}) {
  initializeWorkspace(root);
  let approvals = 0;
  const envelope = await invokeEnvelope(root, "manage_dove_mission", {
    operation: "create-root",
    mode: "research",
    goal,
    requirements: [],
    assumptions: [],
    scope: [],
    outOfScope: [],
    artifacts: [],
    completionCriteria: [],
    evidenceRequirements: [],
    ...overrides
  }, {
    requestCheckpointApproval: async () => {
      approvals += 1;
      return "accept";
    }
  });
  assert.equal(approvals, 1);
  assert.equal(envelope.report.status, "materialized");
  return {
    envelope,
    mission: privateMissionByGoal(root, goal),
    missionNumber: await missionNumberByGoal(root, goal)
  };
}

function publicHypotheses(decision) {
  return decision.hypotheses.map(({ statement, assessment, supportingEvidence, counterEvidence, falsificationCondition }) => ({
    statement,
    assessment,
    supportingEvidence,
    counterEvidence,
    falsificationCondition
  }));
}

function publicRoutes(decision) {
  return decision.routes.map((route) => ({ ...route }));
}

function publicOpenQuestions(decision) {
  return decision.openQuestions.map(({ question }) => ({ question }));
}

function boundedAction(overrides = {}) {
  return {
    kind: "analysis",
    description: "Run one bounded analysis of the current evidence.",
    rationale: "The analysis addresses the current explicit uncertainty.",
    targets: ["question:1"],
    successConditions: ["Return one inspectable bounded result."],
    stopConditions: ["Stop after one bounded action."],
    expectedEvidence: ["bounded-result"],
    budget: { actions: 1, timeMinutes: 30, costUnits: 1 },
    ...overrides
  };
}

function stableDecisionId(kind, revision, index) {
  return `${kind}-${revision + 1}-${index + 1}`;
}

async function reevaluate(root, materialized, overrides = {}) {
  const decision = readCurrentResearchDecision(root, materialized.mission.missionId);
  const requestedDisposition = overrides.requestedDisposition ?? "continue";
  const hypotheses = (overrides.hypotheses ?? publicHypotheses(decision)).map((item, index) => ({
    ...item,
    hypothesisId: item.hypothesisId ?? stableDecisionId("hypothesis", decision.revision, index)
  }));
  const routes = (overrides.routes ?? publicRoutes(decision)).map((item, index) => ({
    ...item,
    routeId: item.routeId ?? stableDecisionId("route", decision.revision, index)
  }));
  const openQuestions = (overrides.openQuestions ?? publicOpenQuestions(decision)).map((item, index) => ({
    ...item,
    questionId: item.questionId ?? stableDecisionId("question", decision.revision, index)
  }));
  const targets = new Map([
    ...hypotheses.map((item, index) => [`hypothesis:${index + 1}`, item.hypothesisId]),
    ...openQuestions.map((item, index) => [`question:${index + 1}`, item.questionId])
  ]);
  const publicNextAction = Object.hasOwn(overrides, "nextAction")
    ? overrides.nextAction
    : requestedDisposition === "continue"
      ? boundedAction()
      : null;
  const nextAction = publicNextAction === null ? null : {
    actionId: stableDecisionId("action", decision.revision, 0),
    kind: publicNextAction.kind,
    description: publicNextAction.description,
    rationale: publicNextAction.rationale,
    targetHypothesisOrQuestionIds: publicNextAction.targets.map((target) => targets.get(target)),
    successConditions: publicNextAction.successConditions,
    stopConditions: publicNextAction.stopConditions,
    expectedEvidence: publicNextAction.expectedEvidence,
    budget: publicNextAction.budget
  };
  return runWithMutationContext(root, {
    actionId: "reevaluate-research-decision",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => reevaluateResearchDecision(root, {
    operation: "reevaluate-research-decision",
    missionId: materialized.mission.missionId,
    decisionRevision: overrides.decisionRevision ?? decision.revision,
    requestedDisposition,
    synthesis: overrides.synthesis ?? "The bounded direction remains viable for one explicit next action.",
    hypotheses,
    routes,
    openQuestions,
    evidenceRefs: overrides.evidenceRefs ?? [],
    consumedReceiptIds: overrides.consumedReceiptIds ?? [],
    reasonCodes: overrides.reasonCodes ?? [],
    nextAction,
    createdAt: new Date(Math.max(Date.now(), Date.parse(decision.createdAt) + 1)).toISOString()
  }));
}

function outcomeTimes(decision) {
  return { startedAt: decision.createdAt, finishedAt: decision.createdAt };
}

async function recordOutcome(root, materialized, overrides = {}) {
  const decision = readCurrentResearchDecision(root, materialized.mission.missionId);
  const envelope = await invokeEnvelope(root, "record_research_outcome", {
    missionNumber: materialized.missionNumber,
    decisionRevision: decision.revision,
    attemptId: overrides.attemptId ?? `attempt-${materialized.missionNumber}`,
    status: overrides.status ?? "completed",
    performedActionCount: overrides.performedActionCount ?? 1,
    actualUsage: overrides.actualUsage ?? { actions: 1, timeMinutes: 1, costUnits: 1 },
    evidenceReturned: overrides.evidenceReturned ?? [...decision.nextAction.expectedEvidence],
    artifactPaths: overrides.artifactPaths ?? [],
    validationPaths: overrides.validationPaths ?? [],
    facts: overrides.facts ?? ["The bounded action returned one concrete execution observation."],
    ...outcomeTimes(decision)
  });
  const receipt = fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir))
    .map((name) => JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir, name), "utf8")))
    .find((item) => item.missionId === materialized.mission.missionId && item.researchOutcome?.attemptId === (overrides.attemptId ?? `attempt-${materialized.missionNumber}`));
  assert.ok(receipt);
  return { envelope, receipt };
}

const PRIVATE_TEXT = /\.dove(?:-archive)?\/|\/home\/|\b[0-9a-f]{64}\b|\b(?:missionId|decisionId|actionId|receiptId|contractDigest|schemaVersion|hostControl|exactReplay)\b/iu;

function renderedStatus(report) {
  return renderPublicReport(report, { language: "zh" });
}

function assertPublicNarrative(report) {
  assert.doesNotMatch(JSON.stringify(report.researchNarrative), PRIVATE_TEXT);
  assert.doesNotMatch(renderedStatus(report), PRIVATE_TEXT);
  assert.equal(Object.hasOwn(report, "briefing"), false);
}

test("direct Mission artifacts define scope and unrelated returned files do not satisfy declared output or evidence coverage", async () => {
  const root = createTempRoot("dove-task5-direct-artifacts-");
  try {
    const declaredArtifact = { path: "outputs/declared.md", required: true, role: "output" };
    const supportingArtifact = { path: "inputs/context.md", required: false, role: "supporting" };
    const materialized = await materializeMission(root, "Produce only the declared bounded research result.", {
      requirements: ["Interpret the declared bounded result."],
      scope: ["Only the declared output belongs to the delivery contract."],
      outOfScope: ["Unrelated outputs are not completion evidence."],
      artifacts: [declaredArtifact, supportingArtifact],
      completionCriteria: ["The declared result is interpreted from current evidence."],
      evidenceRequirements: ["artifact:outputs/declared.md"]
    });

    assert.deepEqual(materialized.mission.artifacts, [declaredArtifact, supportingArtifact]);

    fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
    fs.writeFileSync(path.join(root, "outputs/unrelated.md"), "unrelated result\n", "utf8");
    const recorded = await recordOutcome(root, materialized, {
      evidenceReturned: [],
      artifactPaths: ["outputs/unrelated.md"]
    });
    assert.equal(recorded.envelope.report.outcome.evidenceComplete, false);

    const completion = assessMissionCompletion(root, { missionId: materialized.mission.missionId });
    assert.equal(completion.complete, false);
    assert.deepEqual(completion.artifactCoverage.map(({ path: artifactPath, covered }) => ({ path: artifactPath, covered })), [
      { path: "outputs/declared.md", covered: false }
    ]);
    assert.deepEqual(completion.evidenceRequirements.map(({ requirement, satisfied }) => ({ requirement, satisfied })), [
      { requirement: "artifact:outputs/declared.md", satisfied: false }
    ]);

    const status = await invokeReport(root, "query_dove_status", { operation: "status", missionNumber: materialized.missionNumber, detail: "full" });
    const workstream = status.technicalAppendix.workstreams.items[0];
    assert.equal(workstream.complete, false);
    const workItems = status.technicalAppendix.workItems.items.filter((item) => item.workstreamNumber === materialized.missionNumber);
    assert.deepEqual(workItems.find((item) => item.label === "outputs/declared.md"), {
      number: workItems.find((item) => item.label === "outputs/declared.md").number,
      workstreamNumber: materialized.missionNumber,
      label: "outputs/declared.md",
      kind: "artifact",
      state: "pending",
      dependencyNumbers: []
    });
    assert.equal(workItems.find((item) => item.label === "artifact:outputs/declared.md").state, "pending");
    assert.match(workstream.gaps.join("\n"), /artifact|required|research-outcome-awaiting-reevaluation/iu);
  } finally {
    cleanupTempRoot(root);
  }
});

test("recorded research outcomes preserve the decision and status derives awaiting reevaluation", async () => {
  const root = createTempRoot("dove-task5-awaiting-reevaluation-");
  try {
    const materialized = await materializeMission(root, "Interpret one bounded result before authorizing more work.", {
      requirements: ["Interpret the bounded result."],
      artifacts: [{ path: "outputs/result.md", required: true, role: "output" }],
      completionCriteria: ["The current result is scientifically interpreted."],
      evidenceRequirements: ["artifact:outputs/result.md"]
    });
    fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
    fs.writeFileSync(path.join(root, "outputs/result.md"), "bounded observation\n", "utf8");

    const before = readCurrentResearchDecision(root, materialized.mission.missionId);
    const recorded = await recordOutcome(root, materialized, { artifactPaths: ["outputs/result.md"] });
    assert.equal(recorded.envelope.report.outcome.accepted, true);
    assert.equal(recorded.envelope.report.research.awaitingReevaluation, true);
    assert.equal(recorded.envelope.report.research.decisionUnchanged, true);
    assert.equal(readCurrentResearchDecision(root, materialized.mission.missionId).decisionId, before.decisionId);

    const completion = assessMissionCompletion(root, { missionId: materialized.mission.missionId });
    assert.equal(completion.researchOutcome.awaitingReevaluation, true);
    assert.deepEqual(completion.researchOutcome.unconsumedReceiptIds, [recorded.receipt.receiptId]);
    assert.equal(completion.complete, false);
    assert.ok(completion.incompleteReasons.includes("research-outcome-awaiting-reevaluation"));

    const status = await invokeReport(root, "query_dove_status", { operation: "status", missionNumber: materialized.missionNumber, language: "zh" });
    assert.equal(status.narrativeState, "available");
    assert.match(status.researchNarrative.nextStep, /Reevaluate the recorded execution evidence/iu);
    assert.equal(status.researchNarrative.stopReason, null);
    assert.match(status.recommendation, /Reevaluate the recorded execution evidence/iu);
    assert.deepEqual(status.nextActions, []);
    assert.match(renderedStatus(status), /下一步/u);
    assertPublicNarrative(status);
  } finally {
    cleanupTempRoot(root);
  }
});

test("consuming a receipt restores a canonical mission narrative with current evidence and one bounded next step", async () => {
  const root = createTempRoot("dove-task5-consumed-narrative-");
  try {
    const materialized = await materializeMission(root, "Determine whether the bounded mechanism remains viable.", {
      assumptions: ["The bounded mechanism explains the observation."],
      artifacts: [{ path: "outputs/mechanism.md", required: true, role: "output" }],
      evidenceRequirements: ["artifact:outputs/mechanism.md"]
    });
    fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
    fs.writeFileSync(path.join(root, "outputs/mechanism.md"), "mechanism observation\n", "utf8");
    const { receipt } = await recordOutcome(root, materialized, { artifactPaths: ["outputs/mechanism.md"] });

    const envelope = await reevaluate(root, materialized, {
      synthesis: "Current bounded evidence supports the mechanism, while generalization remains unresolved.",
      hypotheses: [{
        statement: "The bounded mechanism explains the observation.",
        assessment: "supported",
        supportingEvidence: ["artifact:outputs/mechanism.md"],
        counterEvidence: [],
        falsificationCondition: "A controlled comparison fails to reproduce the observation."
      }],
      routes: [{ routeId: "bounded-comparison", summary: "Run a bounded comparison.", disposition: "selected", rationale: "It directly tests generalization." }],
      openQuestions: [{ question: "Whether the mechanism generalizes beyond the bounded observation." }],
      evidenceRefs: ["artifact:outputs/mechanism.md"],
      consumedReceiptIds: [receipt.receiptId],
      nextAction: boundedAction({
        kind: "experiment",
        description: "Run one bounded comparison of the supported mechanism.",
        rationale: "The comparison resolves the remaining generalization question.",
        targets: ["question:1"],
        expectedEvidence: ["bounded-comparison-result"]
      })
    });
    assert.equal(envelope.status, "recorded");
    assert.equal(envelope.researchDisposition, "continue");
    assert.equal(envelope.executionHandoff.actionId, envelope.decision.nextAction.actionId);

    const completion = assessMissionCompletion(root, { missionId: materialized.mission.missionId });
    assert.equal(completion.researchOutcome.awaitingReevaluation, false);
    assert.deepEqual(completion.researchOutcome.consumedReceiptIds, [receipt.receiptId]);

    const status = await invokeReport(root, "query_dove_status", { operation: "status", missionNumber: materialized.missionNumber });
    assert.equal(status.researchNarrative.researchDirection, "Current bounded evidence supports the mechanism, while generalization remains unresolved.");
    assert.deepEqual(status.researchNarrative.evidence, ["artifact:outputs/mechanism.md"]);
    assert.deepEqual(status.researchNarrative.unknowns, ["Whether the mechanism generalizes beyond the bounded observation."]);
    assert.equal(status.researchNarrative.nextStep, "Run one bounded comparison of the supported mechanism.");
    assert.equal(status.recommendation, "Run one bounded comparison of the supported mechanism.");
    assertPublicNarrative(status);
  } finally {
    cleanupTempRoot(root);
  }
});

test("workspace status composes decisions and evidence while canonical Lessons remain separate", async () => {
  const root = createTempRoot("dove-task5-project-status-");
  try {
    const active = await materializeMission(root, "Advance the evidence-backed active mechanism.", {
      assumptions: ["The active mechanism explains the bounded observation."],
      artifacts: [{ path: "outputs/project-evidence.md", required: true, role: "output" }],
      evidenceRequirements: ["artifact:outputs/project-evidence.md"]
    });
    const rejected = await materializeMission(root, "Evaluate an unrelated engineering detour.");

    fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
    fs.writeFileSync(path.join(root, "outputs/project-evidence.md"), "bounded project evidence\n", "utf8");
    const { receipt } = await recordOutcome(root, active, { artifactPaths: ["outputs/project-evidence.md"] });
    await reevaluate(root, active, {
      synthesis: "Current evidence supports the active mechanism, but generalization remains unknown.",
      hypotheses: [{
        statement: "The active mechanism explains the bounded observation.",
        assessment: "supported",
        supportingEvidence: ["artifact:outputs/project-evidence.md"],
        counterEvidence: [],
        falsificationCondition: "A bounded comparison fails to reproduce the effect."
      }],
      routes: [{ routeId: "unrelated-harness", summary: "Build an unrelated parallel harness.", disposition: "rejected", rationale: "The harness does not improve the active evidence chain." }],
      openQuestions: [{ question: "Whether the active mechanism generalizes." }],
      evidenceRefs: ["artifact:outputs/project-evidence.md"],
      consumedReceiptIds: [receipt.receiptId],
      nextAction: boundedAction({
        kind: "experiment",
        description: "Run one bounded comparison of the active mechanism.",
        rationale: "The comparison directly addresses the largest current unknown.",
        targets: ["question:1"],
        expectedEvidence: ["bounded-comparison"]
      })
    });
    await reevaluate(root, rejected, {
      requestedDisposition: "reject",
      synthesis: "The unrelated engineering detour does not improve the project evidence chain.",
      reasonCodes: ["low-research-value"],
      nextAction: null
    });

    const lessonRead = await invokeEnvelope(root, "manage_dove_lessons", { operation: "read" });
    const lessonMarkdown = lessonRead.report.markdown.replace("## 研究方向与方法\n\n- 暂无。", "## 研究方向与方法\n\n- 下一项比较应限定在活跃机制内。\n");
    const lesson = await invokeReport(root, "manage_dove_lessons", {
      operation: "update",
      binding: lessonRead.hostControl.lessonsDocument.binding,
      markdown: lessonMarkdown
    });
    assert.equal(lesson.status, "updated");

    const status = await invokeReport(root, "query_dove_status", { operation: "status", language: "zh" });
    assert.equal(status.currentSituation.scope, "workspace portfolio");
    assert.equal(status.narrativeState, "available");
    assert.equal(status.researchNarrative.mainline, "Advance the bounded test research program.");
    assert.deepEqual(status.researchNarrative.activeDirections, [{
      direction: "Advance the evidence-backed active mechanism.",
      currentUnderstanding: "Current evidence supports the active mechanism, but generalization remains unknown."
    }]);
    assert.deepEqual(status.researchNarrative.evidence, ["Current recorded artifact evidence supports the project judgment."]);
    assert.deepEqual(status.researchNarrative.unknowns, ["Whether the active mechanism generalizes."]);
    const rejectedText = status.researchNarrative.rejectedDirections.map((item) => `${item.direction} ${item.reason}`).join("\n");
    assert.match(rejectedText, /Build an unrelated parallel harness.*does not improve the active evidence chain/isu);
    assert.match(rejectedText, /Evaluate an unrelated engineering detour.*does not improve the project evidence chain/isu);
    assert.deepEqual(status.researchNarrative.applicableLessons, []);
    assert.equal(status.recommendation, "Run one bounded comparison of the active mechanism.");
    assert.match(renderedStatus(status), /当前科研主线是/u);
    assert.match(renderedStatus(status), /关键证据/u);
    assert.match(renderedStatus(status), /最大未知/u);
    assert.match(renderedStatus(status), /已经停止、拒绝或转向的方向/u);
    assert.doesNotMatch(renderedStatus(status), /适用经验|下一项比较应限定/u);
    assert.match(renderedStatus(status), /最值得做的下一步/u);
    assertPublicNarrative(status);
  } finally {
    cleanupTempRoot(root);
  }
});
