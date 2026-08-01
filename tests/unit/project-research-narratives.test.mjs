import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProjectResearchNarrative,
  buildProjectResearchNarrativeFromWorkspace,
  normalizeProjectResearchNarrative,
  renderProjectResearchNarrative
} from "../../src/core/project-research-narratives.mjs";
import { createResearchDecision, createResearchDecisionAction } from "../../src/core/research-decisions.mjs";

function action(description, actionId) {
  return createResearchDecisionAction({
    actionId,
    kind: "analysis",
    description,
    rationale: "This bounded action resolves the current recorded uncertainty.",
    targetHypothesisOrQuestionIds: ["live-hypothesis"],
    successConditions: ["Return one discriminating observation."],
    stopConditions: ["Stop after one bounded action."],
    expectedEvidence: ["bounded-evidence"],
    budget: { actions: 1, timeMinutes: 20, costUnits: 1 }
  });
}

function decision(missionId, overrides = {}) {
  const nextAction = Object.hasOwn(overrides, "nextAction") ? overrides.nextAction : action(`Advance ${missionId}.`, `action-${missionId}`);
  const disposition = overrides.disposition ?? (nextAction ? "continue" : "stop-low-return");
  return createResearchDecision({
    missionId,
    contractDigest: "a".repeat(64),
    revision: 1,
    predecessorDecisionId: null,
    predecessorDecisionDigest: null,
    createdAt: "2026-07-25T10:00:00.000Z",
    content: {
      synthesis: overrides.synthesis ?? `Current understanding ${missionId}.`,
      hypotheses: [{ hypothesisId: "live-hypothesis", statement: `Hypothesis ${missionId}.`, assessment: "unresolved", supportingEvidence: [], counterEvidence: [], falsificationCondition: `Observation against ${missionId}.` }],
      routes: overrides.routes ?? [],
      openQuestions: [{ questionId: "live-question", question: `Unknown ${missionId}.` }],
      evidenceRefs: overrides.evidenceRefs ?? [],
      consumedReceiptIds: overrides.consumedReceiptIds ?? [],
      disposition,
      reasonCodes: disposition === "continue" ? [] : ["bounded-stop"],
      nextAction
    }
  });
}

function mission(missionId, overrides = {}) {
  return {
    missionId,
    mode: overrides.mode ?? "research",
    goal: overrides.goal ?? `Goal ${missionId}`,
    dependsOnMissionIds: overrides.dependsOnMissionIds ?? [],
    workspaceRevisionId: overrides.workspaceRevisionId ?? "revision-current",
    createdAt: overrides.createdAt ?? "2026-07-25T10:00:00.000Z"
  };
}

function assessment(overrides = {}) {
  return {
    complete: false,
    researchOutcome: { awaitingReevaluation: false, ...overrides.researchOutcome },
    ...overrides
  };
}

function workspaceInput(overrides = {}) {
  const missions = overrides.missions ?? [mission("one"), mission("two")];
  const decisions = overrides.decisions ?? [decision("one"), decision("two")];
  return {
    mainline: "Determine the strongest evidence-backed project direction.",
    currentWorkspaceRevisionId: "revision-current",
    missions,
    currentDecisions: new Map(decisions.map((item) => [item.missionId, item])),
    assessments: new Map(missions.map((item) => [item.missionId, assessment()])),
    missionTransitions: new Map(),
    lessons: [],
    ...overrides
  };
}

const PRIVATE = /\.dove|\/home\/|\b[0-9a-f]{64}\b|\b(?:missionId|decisionId|actionId|lessonId)\b/iu;

test("ProjectResearchNarrative is sealed, bounded, locale-neutral, and rendered only at the language boundary", () => {
  const narrative = buildProjectResearchNarrative({
    mainline: "Evaluate the project mechanism.",
    activeDirections: [{ direction: "Test the bounded mechanism.", currentUnderstanding: "The current result is promising but limited." }],
    evidence: ["One bounded comparison is directionally positive."],
    unknowns: ["Whether the effect generalizes."],
    rejectedDirections: [{ direction: "Broad refactoring", reason: "It does not improve the evidence chain." }],
    historicalWorkWithoutJudgment: ["An older exploratory workstream"],
    currentValueJudgment: "One bounded experiment remains worth running.",
    recommendation: "Run the bounded experiment.",
    recommendationReason: "It resolves the largest current unknown.",
    applicableLessons: [{ lesson: "Fix the metric first", application: "the next comparison" }]
  });
  assert.deepEqual(normalizeProjectResearchNarrative(narrative), narrative);
  assert.equal(Object.isFrozen(narrative), true);
  const zh = renderProjectResearchNarrative(narrative, { language: "zh" });
  const en = renderProjectResearchNarrative(narrative, { language: "en" });
  for (const fact of [narrative.mainline, narrative.activeDirections[0].direction, narrative.evidence[0], narrative.unknowns[0], narrative.currentValueJudgment, narrative.recommendation]) {
    assert.match(zh, new RegExp(fact, "u"));
    assert.match(en, new RegExp(fact, "u"));
  }
  assert.throws(() => buildProjectResearchNarrative({ ...narrative, missionId: "private" }), /unknown fields.*missionId/iu);
  assert.doesNotMatch(zh, PRIVATE);
  assert.doesNotMatch(en, PRIVATE);
});

test("awaiting reevaluation is the sole recommendation priority over repeating an authorized action", () => {
  const missions = [
    mission("ready", { goal: "Run the still-authorized comparison." }),
    mission("awaiting", { goal: "Interpret the returned bounded outcome." })
  ];
  const decisions = [
    decision("ready", { nextAction: action("Repeat the ready comparison.", "action-ready-repeat") }),
    decision("awaiting", { nextAction: action("Repeat the awaiting comparison.", "action-awaiting-repeat") })
  ];
  const narrative = buildProjectResearchNarrativeFromWorkspace(workspaceInput({
    missions,
    decisions,
    assessments: new Map([
      ["ready", assessment()],
      ["awaiting", assessment({ researchOutcome: { awaitingReevaluation: true } })]
    ])
  }));
  assert.match(narrative.recommendation, /Reevaluate the recorded execution evidence.*Interpret the returned bounded outcome/iu);
  assert.doesNotMatch(narrative.recommendation, /Repeat the awaiting comparison|Repeat the ready comparison/iu);
  assert.match(narrative.recommendationReason, /scientific judgment has not consumed/iu);
});

test("without reevaluation the canonical current decision supplies the recommendation without a second priority policy", () => {
  const input = workspaceInput({
    missions: [mission("first", { goal: "First current direction." }), mission("second", { goal: "Second current direction." })],
    decisions: [
      decision("first", { nextAction: action("Run the first bounded action.", "action-first") }),
      decision("second", { nextAction: action("Run the second bounded action.", "action-second") })
    ]
  });
  const first = buildProjectResearchNarrativeFromWorkspace(input);
  const second = buildProjectResearchNarrativeFromWorkspace(input);
  assert.equal(first.recommendation, "Run the first bounded action.");
  assert.deepEqual(first, second);
});

test("historical and stopped directions remain context while Lessons stay outside status narrative", () => {
  const old = decision("old", { nextAction: null, disposition: "stop-low-return", synthesis: "The old direction no longer justifies further work." });
  const current = decision("current", { nextAction: action("Run the current bounded comparison.", "action-current") });
  const narrative = buildProjectResearchNarrativeFromWorkspace(workspaceInput({
    missions: [mission("old", { goal: "Obsolete direction" }), mission("historical", { goal: "Historical exploration" }), mission("current", { goal: "Current direction" })],
    decisions: [old, current],
    currentDecisions: new Map([["old", old], ["current", current]]),
    assessments: new Map([["old", assessment()], ["historical", assessment()], ["current", assessment()]]),
    missionTransitions: new Map([["old", { status: "stopped", reason: "Continue through the explicit current direction." }]])
  }));
  assert.equal(narrative.recommendation, "Run the current bounded comparison.");
  assert.deepEqual(narrative.historicalWorkWithoutJudgment, ["Historical exploration"]);
  assert.match(narrative.rejectedDirections.map((item) => `${item.direction} ${item.reason}`).join("\n"), /Obsolete direction|explicit current direction/u);
  assert.deepEqual(narrative.applicableLessons, []);
  assert.equal(buildProjectResearchNarrativeFromWorkspace(workspaceInput({ decisions: [], currentDecisions: new Map() })), null);
});
