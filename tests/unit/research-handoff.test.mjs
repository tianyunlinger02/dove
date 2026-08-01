import test from "node:test";
import assert from "node:assert/strict";

import { createResearchDecision, createResearchDecisionAction } from "../../src/core/research-decisions.mjs";
import {
  createResearchHandoff,
  validateResearchHandoff,
  validateResearchHostOutcome
} from "../../src/core/research-handoff.mjs";

const CONTRACT_DIGEST = "2".repeat(64);
const ISSUED_AT = "2026-07-30T10:00:00.000Z";
const EXPIRES_AT = "2026-07-30T14:00:00.000Z";

function decision() {
  const nextAction = createResearchDecisionAction({
    actionId: "bounded-experiment",
    kind: "experiment",
    description: "Run one bounded experiment.",
    rationale: "The experiment distinguishes the current hypothesis.",
    targetHypothesisOrQuestionIds: ["question-one"],
    successConditions: ["Return one controlled metric."],
    stopConditions: ["Stop after one run."],
    expectedEvidence: ["controlled-metric"],
    budget: { actions: 1, timeMinutes: 60, costUnits: 5 }
  });
  return createResearchDecision({
    missionId: "mission-one",
    contractDigest: CONTRACT_DIGEST,
    revision: 1,
    predecessorDecisionId: null,
    predecessorDecisionDigest: null,
    createdAt: ISSUED_AT,
    content: {
      synthesis: "One controlled experiment is warranted.",
      hypotheses: [],
      routes: [],
      openQuestions: [{ questionId: "question-one", question: "Does the controlled effect persist?" }],
      evidenceRefs: [],
      consumedReceiptIds: [],
      disposition: "continue",
      reasonCodes: [],
      nextAction
    }
  });
}

function envelope() {
  return createResearchHandoff(decision(), { issuedAt: ISSUED_AT, expiresAt: EXPIRES_AT });
}

function bindings(value = envelope(), overrides = {}) {
  return {
    missionId: overrides.missionId ?? value.missionId,
    contractDigest: overrides.contractDigest ?? value.contractDigest,
    decisionDigest: overrides.decisionDigest ?? value.decisionDigest,
    currentEnvelopeId: overrides.currentEnvelopeId ?? value.envelopeId,
    supersededEnvelopeIds: overrides.supersededEnvelopeIds ?? [],
    now: overrides.now ?? "2026-07-30T11:00:00.000Z"
  };
}

function outcome(overrides = {}) {
  return {
    status: overrides.status ?? "completed",
    performedActionCount: overrides.performedActionCount ?? 1,
    actualUsage: overrides.actualUsage ?? { actions: 1, timeMinutes: 30, costUnits: 2 },
    evidenceReturned: overrides.evidenceReturned ?? ["controlled-metric"],
    facts: overrides.facts ?? ["The bounded experiment returned one controlled metric."],
    claims: overrides.claims ?? [],
    startedAt: overrides.startedAt ?? "2026-07-30T10:30:00.000Z",
    finishedAt: overrides.finishedAt ?? "2026-07-30T10:45:00.000Z"
  };
}

test("research handoff stores only decision and action bindings plus execution boundaries", () => {
  const value = envelope();
  assert.equal(value.schemaVersion, 2);
  assert.equal(value.actionId, "bounded-experiment");
  assert.equal(value.decisionDigest, decision().decisionDigest);
  assert.equal(Object.hasOwn(value, "decisionId"), false);
  assert.equal(Object.hasOwn(value, "action"), false);
  assert.equal(Object.hasOwn(value, "requirementSnapshotId"), false);
  assert.match(value.seal, /^[0-9a-f]{64}$/u);
});

test("handoff validation fails closed on tampering, stale decisions, supersession, and expiry", () => {
  const value = envelope();
  assert.throws(() => validateResearchHandoff({ ...value, budget: { ...value.budget, actions: 2 } }, bindings(value)), /seal does not match/u);
  assert.throws(() => validateResearchHandoff(value, bindings(value, { decisionDigest: "4".repeat(64) })), /stale: decisionDigest changed/u);
  assert.throws(() => validateResearchHandoff(value, bindings(value, { supersededEnvelopeIds: [value.envelopeId] })), /superseded/u);
  assert.throws(() => validateResearchHandoff(value, bindings(value, { now: EXPIRES_AT })), /expired/u);
});

test("host outcome validates one bounded execution without granting scientific conclusions", () => {
  const value = envelope();
  const result = validateResearchHostOutcome(value, outcome(), bindings(value));
  assert.equal(result.valid, true);
  assert.equal(result.scopeDeviation, false);
  assert.equal(result.scientificConclusionAuthorized, false);
  assert.deepEqual(result.missingRequiredEvidence, []);
});

test("host outcome reports budget, action-count, and unexpected-evidence deviations", () => {
  const value = envelope();
  const result = validateResearchHostOutcome(value, outcome({
    performedActionCount: 2,
    actualUsage: { actions: 2, timeMinutes: 90, costUnits: 8 },
    evidenceReturned: ["controlled-metric", "undeclared-output"]
  }), bindings(value));
  assert.equal(result.valid, false);
  assert.ok(result.scopeDeviationReasons.includes("performed-action-count-exceeded"));
  assert.ok(result.scopeDeviationReasons.includes("budget-exceeded:actions"));
  assert.ok(result.scopeDeviationReasons.includes("unexpected-evidence:undeclared-output"));
});

test("host outcome cannot mint claims or execute outside the sealed window", () => {
  const value = envelope();
  assert.throws(() => validateResearchHostOutcome(value, outcome({ claims: ["The method is superior."] }), bindings(value)), /cannot declare scientific claims/u);
  assert.throws(() => validateResearchHostOutcome(value, outcome({ startedAt: "2026-07-30T09:59:59.000Z" }), bindings(value)), /outside the sealed handoff window/u);
});

test("host outcome accepts canonical UTC second precision", () => {
  const value = envelope();
  const result = validateResearchHostOutcome(value, outcome({
    startedAt: "2026-07-30T10:30:00Z",
    finishedAt: "2026-07-30T10:45:00Z"
  }), bindings(value));
  assert.equal(result.startedAt, "2026-07-30T10:30:00.000Z");
  assert.equal(result.finishedAt, "2026-07-30T10:45:00.000Z");
});
