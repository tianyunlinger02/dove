#!/usr/bin/env node

import assert from "node:assert/strict";

import { buildResearchContext, queryResearchContext } from "../src/core/research-context.mjs";
import { CLAIM_ASSESSMENTS, EXPERIMENT_RESULT_KINDS, SOURCE_RELATIONSHIPS } from "../src/core/research-stores.mjs";
import { DOVE_RESEARCH_FORMAT } from "../src/core/schema.mjs";

const timestamp = "2026-08-08T00:00:00.000Z";
const mission = {
  missionId: "semantic-gate", parentMissionId: null, dependsOnMissionIds: [], branchKind: null, branchReason: null,
  goal: "Preserve research meaning.", requirements: ["Retain adverse evidence."], assumptions: ["The fixture is bounded."],
  scope: ["One condition."], outOfScope: ["Generalization."], evidenceRequirements: ["Denominator-aware evidence."],
  competingHypotheses: ["effect", "artifact"], openQuestions: ["Which explanation survives?"], contextRefs: ["paper:results"],
  contributionRole: "hypothesis-discrimination", createdAt: timestamp
};
const plan = {
  experimentId: "semantic-run", missionId: mission.missionId, title: "Discriminating run", hypothesisRefs: ["effect", "artifact"],
  protocol: ["Run once."], inputs: ["fixture"], comparisons: ["baseline"], metrics: ["quality"],
  discriminatingObservations: ["Calibration separates the explanations."], successConditions: ["Account for every case."],
  stopConditions: ["Stop after one pass."], constraints: ["Fixed fixture."], expectedArtifacts: ["results/run.json"],
  cost: "One run.", risk: "The run may fail.", failureValue: "Failure identifies instability.", contributionRole: "hypothesis-discrimination", plannedAt: timestamp
};
const result = {
  experimentId: plan.experimentId, missionId: mission.missionId, kind: "failed", summary: "The run failed.",
  observations: ["Adverse evidence retained."], measurements: [], denominator: { total: 2, observed: 0, failed: 2, excluded: 0 },
  hypothesisImpacts: [{ hypothesisRef: "effect", impact: "weaken" }], claimImpacts: [{ claimRef: "bounded-claim", impact: "weaken" }],
  unexpectedObservations: ["Calibration failed."], uncertainty: ["Cause unresolved."], artifactRefs: [], failures: ["Both attempts crashed."],
  deviations: ["No measurement."], limitations: ["One fixture."], recordedAt: timestamp
};
const claim = {
  claimId: "bounded-claim", missionId: mission.missionId, statement: "The evidence does not establish improvement.",
  supportRefs: ["experiment:semantic-run"], counterEvidenceRefs: ["observation:calibration-failed"], missingEvidence: ["Calibrated replication."],
  cannotSay: ["Cannot infer population behavior."], uncertainty: ["Cause unresolved."], assessment: "weakened", storyRole: "bounded-adverse-result", artifactRefs: [], recordedAt: timestamp
};
const context = buildResearchContext({
  workspace: { workspaceId: "semantic-workspace", researchQuestion: "What explains the result?", mainline: "Test competing explanations.", contributionIntent: "Bound the supported claim.", currentFocus: "Preserve adverse evidence.", changeHistory: [{ changedAt: timestamp, summary: "Established direction." }], createdAt: timestamp, updatedAt: timestamp },
  missions: [mission], sources: [], experiments: [{ plan, result }], claims: [claim], reviews: [], lessons: "# Lessons\n"
});
const synthesis = queryResearchContext(context, { view: "result-synthesis" });
const story = queryResearchContext(context, { view: "claim-story" });

assert.equal(DOVE_RESEARCH_FORMAT, "dove-research-v1");
assert.deepEqual(EXPERIMENT_RESULT_KINDS, ["positive", "negative", "null", "mixed", "failed", "stopped"]);
assert.deepEqual(CLAIM_ASSESSMENTS, ["supported", "weakened", "refuted", "inconclusive", "blocked"]);
assert.deepEqual(SOURCE_RELATIONSHIPS, ["consensus", "conflict", "condition-specific", "uncovered", "testable-gap"]);
assert.equal(context.boundaries.semanticAuthority, "host-analysis-required");
assert.equal(context.boundaries.candidateAuthorization, "none");
assert.equal(synthesis.results[0].kind, "failed");
assert.deepEqual(synthesis.results[0].denominator, result.denominator);
assert.deepEqual(synthesis.results[0].failures, result.failures);
assert.deepEqual(synthesis.results[0].uncertainty, result.uncertainty);
assert.deepEqual(story.claimEvidenceMatrix[0].counterEvidenceRefs, claim.counterEvidenceRefs);
assert.deepEqual(story.claimEvidenceMatrix[0].missingEvidence, claim.missingEvidence);
assert.deepEqual(story.claimEvidenceMatrix[0].cannotSay, claim.cannotSay);

console.log(JSON.stringify({ status: "passed", format: DOVE_RESEARCH_FORMAT, resultKinds: EXPERIMENT_RESULT_KINDS.length, claimAssessments: CLAIM_ASSESSMENTS.length, sourceRelationships: SOURCE_RELATIONSHIPS.length }, null, 2));
