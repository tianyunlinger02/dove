import test from "node:test";
import assert from "node:assert/strict";

import { createResearchDecision, createResearchDecisionAction } from "../../src/core/research-decisions.mjs";
import {
  buildResearchNarrative,
  buildResearchNarrativeFromDecision,
  normalizeResearchNarrative,
  renderResearchNarrative
} from "../../src/core/research-narratives.mjs";

function narrative(overrides = {}) {
  return {
    researchDirection: "Determine whether sparse attention remains worth pursuing.",
    currentUnderstanding: ["The bounded results are directionally consistent, but the sample remains small."],
    evidence: ["Three bounded comparisons point in the same direction."],
    unknowns: ["Whether the result generalizes to multi-turn tool use."],
    currentValueJudgment: "One bounded discriminating action remains worthwhile.",
    nextStep: "Run the bounded multi-turn comparison.",
    stopReason: null,
    rejectedDirections: [{ direction: "Compare only mean accuracy.", reason: "That would hide long-tail evidence omissions." }],
    applicableLessons: [{ lesson: "Freeze the metric first.", application: "the next bounded comparison" }],
    ...overrides
  };
}

function persistedDecision(overrides = {}) {
  const hypothesisId = "sparse-attention";
  const nextAction = Object.hasOwn(overrides, "nextAction") ? overrides.nextAction : createResearchDecisionAction({
    actionId: "run-multi-turn",
    kind: "experiment",
    description: "Run the bounded multi-turn comparison.",
    rationale: "The comparison directly resolves the largest recorded uncertainty.",
    targetHypothesisOrQuestionIds: [hypothesisId],
    successConditions: ["Return one discriminating observation."],
    stopConditions: ["Stop after the bounded sample."],
    expectedEvidence: ["bounded-comparison"],
    budget: { actions: 1, timeMinutes: 60, costUnits: 1 }
  });
  const disposition = overrides.disposition ?? (nextAction ? "continue" : "stop-low-return");
  return createResearchDecision({
    missionId: "mission-research",
    contractDigest: "a".repeat(64),
    revision: 1,
    predecessorDecisionId: null,
    predecessorDecisionDigest: null,
    createdAt: "2026-07-25T10:00:00.000Z",
    content: {
      synthesis: overrides.synthesis ?? "The bounded results are directionally consistent, but the sample remains small.",
      hypotheses: [{
        hypothesisId,
        statement: "Sparse attention can lower cost without reducing quality.",
        assessment: "unresolved",
        supportingEvidence: [],
        counterEvidence: [],
        falsificationCondition: "Quality degrades on the bounded comparison."
      }],
      routes: overrides.routes ?? [{ routeId: "bounded-route", summary: "Run one bounded comparison.", disposition: "selected", rationale: "It directly discriminates the live hypothesis." }],
      openQuestions: overrides.openQuestions ?? [{ questionId: "generalization", question: "Does the result generalize to multi-turn tool use?" }],
      evidenceRefs: overrides.evidenceRefs ?? [],
      consumedReceiptIds: overrides.consumedReceiptIds ?? [],
      disposition,
      reasonCodes: disposition === "continue" ? [] : (overrides.reasonCodes ?? ["low-return"]),
      nextAction
    }
  });
}

const PRIVATE_TEXT = /\.dove|\/home\/|[A-Za-z]:\\|\b[0-9a-f]{32,128}\b|\b(?:schema|format)[-_ ]?version\b|\b(?:proposalDigest|confirmArgs|exactReplay|mutationMode|hostControl|missionId|decisionId|actionId)\b/iu;

function assertFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  for (const field of ["currentUnderstanding", "evidence", "unknowns", "rejectedDirections", "applicableLessons"]) assert.equal(Object.isFrozen(value[field]), true);
}

test("ResearchNarrative is one sealed locale-neutral canonical projection", () => {
  const built = buildResearchNarrative(narrative({ currentUnderstanding: ["  One result\nremains bounded.  "] }));
  assert.equal(built.currentUnderstanding[0], "One result remains bounded.");
  assert.deepEqual(normalizeResearchNarrative(built), built);
  assertFrozen(built);
  assert.throws(() => buildResearchNarrative({ ...narrative(), hostControl: {} }), /unknown fields.*hostControl/iu);
  assert.throws(() => buildResearchNarrative(narrative({ stopReason: "Stop now." })), /exactly one/u);
  assert.throws(() => buildResearchNarrative(narrative({ nextStep: null, stopReason: null })), /exactly one/u);
});

test("canonical persisted decisions project without a second prompt or fact model", () => {
  const projected = buildResearchNarrativeFromDecision(persistedDecision());
  assert.equal(projected.researchDirection, "The bounded results are directionally consistent, but the sample remains small.");
  assert.deepEqual(projected.currentUnderstanding, [projected.researchDirection]);
  assert.deepEqual(projected.unknowns, ["Does the result generalize to multi-turn tool use?"]);
  assert.equal(projected.nextStep, "Run the bounded multi-turn comparison.");
  assert.equal(projected.stopReason, null);
});

test("awaiting reevaluation overrides repetition of an already authorized action", () => {
  const decision = persistedDecision();
  const ordinary = buildResearchNarrativeFromDecision(decision);
  const awaiting = buildResearchNarrativeFromDecision(decision, { awaitingReevaluation: true });
  assert.equal(ordinary.nextStep, "Run the bounded multi-turn comparison.");
  assert.match(awaiting.nextStep, /Reevaluate the recorded execution evidence/iu);
  assert.doesNotMatch(awaiting.nextStep, /Run the bounded multi-turn comparison/iu);
});

test("terminal decisions expose a stop reason and no next step", () => {
  const decision = persistedDecision({
    disposition: "stop-satisfied",
    nextAction: null,
    evidenceRefs: ["public bounded comparison"],
    consumedReceiptIds: ["receipt-one"],
    reasonCodes: ["objective-satisfied"]
  });
  const projected = buildResearchNarrativeFromDecision(decision);
  assert.equal(projected.currentValueJudgment, decision.synthesis);
  assert.equal(projected.nextStep, null);
  assert.equal(projected.stopReason, decision.synthesis);
});

test("unsafe durable wording is replaced conservatively rather than leaked", () => {
  const decision = persistedDecision({ synthesis: "Private result at /home/user/result.md" });
  const projected = buildResearchNarrativeFromDecision(decision);
  assert.match(projected.researchDirection, /wording cannot be shown safely/iu);
  assert.doesNotMatch(JSON.stringify(projected), PRIVATE_TEXT);
});

test("Chinese is the default renderer and English renders the same canonical facts", () => {
  const built = buildResearchNarrative(narrative());
  const zh = renderResearchNarrative(built);
  const en = renderResearchNarrative(built, { language: "en" });
  for (const fact of [
    built.researchDirection,
    ...built.currentUnderstanding,
    ...built.evidence,
    ...built.unknowns,
    built.currentValueJudgment,
    built.nextStep,
    ...built.rejectedDirections.flatMap((item) => [item.direction, item.reason]),
    ...built.applicableLessons.flatMap((item) => [item.lesson, item.application])
  ]) {
    assert.ok(zh.includes(fact), `Chinese rendering lost: ${fact}`);
    assert.ok(en.includes(fact), `English rendering lost: ${fact}`);
  }
  assert.match(zh, /当前任务的研究方向是|目前的认识是|下一步/u);
  assert.match(en, /This mission is centered on|Current understanding|Next/u);
  assert.doesNotMatch(zh, PRIVATE_TEXT);
  assert.doesNotMatch(en, PRIVATE_TEXT);
});

test("renderers state absent evidence and stop semantics without inventing facts", () => {
  const stopped = buildResearchNarrative(narrative({ evidence: [], unknowns: [], nextStep: null, stopReason: "Another action would not change the judgment." }));
  const zh = renderResearchNarrative(stopped);
  const en = renderResearchNarrative(stopped, { language: "en" });
  assert.match(zh, /还没有足以支撑判断的直接证据|没有明确的关键未知|现在可以停止/u);
  assert.match(en, /not yet direct evidence|no clearly identified critical unknowns|stop here because/iu);
  assert.doesNotMatch(zh, /下一步/u);
});

test("render boundaries reject unsupported locale and private source text", () => {
  assert.throws(() => renderResearchNarrative(narrative(), { language: "fr" }), /language must be zh or en/u);
  assert.throws(() => renderResearchNarrative(narrative(), { language: "zh", hostControl: {} }), /unknown fields.*hostControl/iu);
  assert.throws(() => buildResearchNarrative(narrative({ evidence: ["Read .dove/private.json"] })), /must not contain private or control metadata/u);
});
