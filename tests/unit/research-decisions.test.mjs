import test from "node:test";
import assert from "node:assert/strict";

import {
  appendResearchDecision,
  createResearchDecision,
  createResearchDecisionAction,
  normalizeResearchDecisionContent,
  validatePersistedResearchDecision,
  validateResearchDecisionChain
} from "../../src/core/research-decisions.mjs";

const CONTRACT_DIGEST = "a".repeat(64);
const CREATED_AT = "2026-07-30T00:00:00.000Z";

function action(overrides = {}) {
  return createResearchDecisionAction({
    actionId: overrides.actionId ?? "bounded-action",
    kind: overrides.kind ?? "analysis",
    description: overrides.description ?? "Run one bounded analysis.",
    rationale: overrides.rationale ?? "The analysis addresses the current open question.",
    targetHypothesisOrQuestionIds: overrides.targetHypothesisOrQuestionIds ?? ["question-one"],
    successConditions: overrides.successConditions ?? ["Return one inspectable result."],
    stopConditions: overrides.stopConditions ?? ["Stop after one action."],
    expectedEvidence: overrides.expectedEvidence ?? ["bounded-result"],
    budget: overrides.budget ?? { actions: 1, timeMinutes: 30, costUnits: 1 }
  });
}

function content(overrides = {}) {
  return {
    synthesis: overrides.synthesis ?? "The bounded question remains unresolved.",
    hypotheses: overrides.hypotheses ?? [{
      hypothesisId: "hypothesis-one",
      statement: "The bounded mechanism explains the current result.",
      assessment: "unresolved",
      supportingEvidence: [],
      counterEvidence: [],
      falsificationCondition: "A controlled result contradicts the mechanism."
    }],
    routes: overrides.routes ?? [{
      routeId: "route-one",
      summary: "Run the bounded analysis.",
      disposition: "selected",
      rationale: "It directly distinguishes the current explanation."
    }],
    openQuestions: overrides.openQuestions ?? [{ questionId: "question-one", question: "What evidence resolves the bounded question?" }],
    evidenceRefs: overrides.evidenceRefs ?? [],
    consumedReceiptIds: overrides.consumedReceiptIds ?? [],
    disposition: overrides.disposition ?? "continue",
    reasonCodes: overrides.reasonCodes ?? [],
    nextAction: Object.hasOwn(overrides, "nextAction") ? overrides.nextAction : action()
  };
}

function decision(overrides = {}) {
  return createResearchDecision({
    missionId: overrides.missionId ?? "mission-one",
    contractDigest: overrides.contractDigest ?? CONTRACT_DIGEST,
    revision: overrides.revision ?? 1,
    predecessorDecisionId: overrides.predecessorDecisionId ?? null,
    predecessorDecisionDigest: overrides.predecessorDecisionDigest ?? null,
    createdAt: overrides.createdAt ?? CREATED_AT,
    content: overrides.content ?? content()
  });
}

test("minimal decision content keeps one current scientific judgment and action", () => {
  const normalized = normalizeResearchDecisionContent(content());
  assert.equal(normalized.disposition, "continue");
  assert.equal(normalized.nextAction.actionId, "bounded-action");
  assert.equal(Object.hasOwn(normalized, "candidateActions"), false);
  assert.equal(Object.hasOwn(normalized, "researchFrame"), false);
  assert.equal(Object.hasOwn(normalized, "engineeringGate"), false);
});

test("decision identity and digest bind the exact mission contract and content", () => {
  const created = decision();
  assert.equal(validatePersistedResearchDecision(created).decisionId, created.decisionId);
  assert.equal(Object.hasOwn(created, "requirementSnapshotId"), false);
  assert.throws(() => validatePersistedResearchDecision({ ...created, synthesis: "tampered" }), /canonical content/u);
  assert.throws(() => validatePersistedResearchDecision(created, { contractDigest: "b".repeat(64) }), /contractDigest does not match/u);
});

test("decision chain is append-only, contiguous, and predecessor-bound", () => {
  const first = decision();
  const chain = appendResearchDecision([first], {
    missionId: first.missionId,
    contractDigest: first.contractDigest,
    predecessorDecisionId: first.decisionId,
    predecessorDecisionDigest: first.decisionDigest,
    createdAt: "2026-07-30T00:00:00.001Z",
    content: content({ synthesis: "One more bounded action is justified." })
  });
  assert.deepEqual(chain.map((item) => item.revision), [1, 2]);
  assert.equal(chain[1].predecessorDecisionId, first.decisionId);
  assert.equal(validateResearchDecisionChain(chain).at(-1).decisionId, chain[1].decisionId);
  assert.throws(() => appendResearchDecision(chain, {
    missionId: first.missionId,
    contractDigest: first.contractDigest,
    predecessorDecisionId: first.decisionId,
    predecessorDecisionDigest: first.decisionDigest,
    createdAt: "2026-07-30T00:00:00.002Z",
    content: content()
  }), /stale predecessor/u);
});

test("next action must target a current hypothesis or question", () => {
  assert.throws(() => normalizeResearchDecisionContent(content({
    nextAction: action({ targetHypothesisOrQuestionIds: ["missing-question"] })
  })), /unknown hypothesis or open question/u);
});

test("terminal decisions cannot retain an action and stop-satisfied consumes evidence", () => {
  assert.throws(() => normalizeResearchDecisionContent(content({
    disposition: "stop-low-return",
    reasonCodes: ["low-return"],
    nextAction: action()
  })), /must not retain nextAction/u);
  assert.throws(() => normalizeResearchDecisionContent(content({
    disposition: "stop-satisfied",
    reasonCodes: ["objective-satisfied"],
    nextAction: null
  })), /requires current evidence and consumed receipts/u);

  const stopped = normalizeResearchDecisionContent(content({
    disposition: "stop-satisfied",
    reasonCodes: ["objective-satisfied"],
    evidenceRefs: ["artifact:outputs/result.md"],
    consumedReceiptIds: ["receipt-one"],
    nextAction: null
  }));
  assert.equal(stopped.disposition, "stop-satisfied");
});

test("hypothesis assessment changes require evidence in the same decision", () => {
  const assessed = [{
    hypothesisId: "hypothesis-one",
    statement: "The bounded mechanism explains the current result.",
    assessment: "supported",
    supportingEvidence: ["artifact:outputs/result.md"],
    counterEvidence: [],
    falsificationCondition: "A controlled result contradicts the mechanism."
  }];
  assert.throws(() => normalizeResearchDecisionContent(content({ hypotheses: assessed })), /requires current decision evidenceRefs/u);
  assert.equal(normalizeResearchDecisionContent(content({
    hypotheses: assessed,
    evidenceRefs: ["artifact:outputs/result.md"]
  })).hypotheses[0].assessment, "supported");
});
