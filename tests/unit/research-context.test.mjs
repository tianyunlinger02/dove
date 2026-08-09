import test from "node:test";
import assert from "node:assert/strict";

import { RESEARCH_CONTEXT_VIEWS, buildResearchContext, buildResearchViews, queryResearchContext } from "../../src/core/research-context.mjs";

function mission(missionId, parentMissionId = null) {
  return {
    missionId, parentMissionId, dependsOnMissionIds: [], branchKind: parentMissionId ? "alternative" : null,
    branchReason: parentMissionId ? `Test ${missionId}.` : null, goal: `Resolve ${missionId}.`,
    requirements: ["Preserve adverse evidence."], assumptions: ["The benchmark represents only itself."],
    scope: ["One benchmark."], outOfScope: ["Deployment."], evidenceRequirements: ["One frozen experiment."],
    competingHypotheses: ["optimization-effect", "measurement-artifact"],
    openQuestions: ["Which hypothesis explains the null cases?"], contextRefs: ["paper:introduction"],
    contributionRole: parentMissionId ? "alternative-explanation" : "mechanism-evidence",
    createdAt: `2026-08-08T00:00:0${parentMissionId ? missionId === "branch-a" ? "1" : "2" : "0"}.000Z`
  };
}

function plan(experimentId, missionId) {
  return {
    experimentId, missionId, title: experimentId, hypothesisRefs: ["optimization-effect", "measurement-artifact"],
    protocol: ["Run the bounded comparison."], inputs: ["fixed fixture"], comparisons: ["baseline"], metrics: ["quality"],
    discriminatingObservations: ["Calibration removes the effect only under the artifact hypothesis."],
    successConditions: ["Account for every case."], stopConditions: ["Stop after one run."], constraints: ["Fixed seed."],
    expectedArtifacts: ["results/result.json"], cost: "One GPU-hour.", risk: "Calibration may fail.",
    failureValue: "A crash identifies an unstable path.", contributionRole: "hypothesis-discrimination",
    plannedAt: "2026-08-08T00:01:00.000Z"
  };
}

function experimentResult(experimentId, missionId, kind, extras = {}) {
  return {
    experimentId, missionId, kind, summary: `${kind} bounded evidence.`, observations: ["The adverse observation was retained."],
    measurements: [{ metric: "quality", value: kind === "positive" ? 1 : -1 }],
    denominator: { total: 3, observed: kind === "failed" ? 0 : 3, failed: kind === "failed" ? 3 : 0, excluded: 0 },
    hypothesisImpacts: [{ hypothesisRef: "optimization-effect", impact: kind }],
    claimImpacts: [{ claimRef: "claim-shared", impact: kind === "positive" ? "support" : "weaken" }],
    unexpectedObservations: extras.unexpectedObservations ?? [], uncertainty: ["Only the bounded fixture was tested."],
    artifactRefs: [`results/${experimentId}.json`], failures: kind === "failed" ? ["All runs crashed."] : [],
    deviations: ["One diagnostic changed."], limitations: ["No generalization."], recordedAt: "2026-08-08T00:02:00.000Z"
  };
}

function claim(claimId, missionId, assessment, experimentId) {
  return {
    claimId, missionId, statement: "The mechanism improves bounded quality.",
    supportRefs: [`experiment:${experimentId}`], counterEvidenceRefs: ["source:paper-a"],
    missingEvidence: ["Calibrated replication."], cannotSay: ["Cannot claim population-level behavior."],
    uncertainty: ["Only the bounded fixture was tested."], assessment, storyRole: "bounded-mechanism-result",
    artifactRefs: ["paper:results"], recordedAt: "2026-08-08T00:03:00.000Z"
  };
}

function fixture() {
  return {
    workspace: {
      workspaceId: "workspace-one", researchQuestion: "Why does the mechanism behave differently?",
      mainline: "Test competing explanations.", contributionIntent: "Identify the bounded mechanism and claim boundary.",
      currentFocus: "Run one discriminating experiment.",
      changeHistory: [{ changedAt: "2026-08-08T00:00:00.000Z", summary: "Established the research direction." }],
      createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z"
    },
    missions: [mission("root"), mission("branch-a", "root"), mission("branch-b", "root")],
    sources: [{
      sourceId: "paper-a", missionId: "root", citationKey: "PaperA", title: "Prior mechanism", authors: ["A. Author"],
      year: 2025, locator: "https://example.test/paper", sourceType: "paper",
      summary: "Reports improvement under a narrower condition.", conditions: ["Small-data regime."],
      relationship: "condition-specific", conflicts: ["Uses a different denominator."], limitations: ["No large-scale test."],
      capture: { path: "materials/paper.txt", sizeBytes: 20, sha256: "a".repeat(64) }, recordedAt: "2026-08-08T00:01:00.000Z"
    }],
    experiments: [
      { plan: plan("exp-a", "branch-a"), result: experimentResult("exp-a", "branch-a", "positive", { unexpectedObservations: ["Latency increased unexpectedly."] }) },
      { plan: plan("exp-b", "branch-b"), result: experimentResult("exp-b", "branch-b", "negative") }
    ],
    claims: [claim("claim-a", "branch-a", "supported", "exp-a"), claim("claim-b", "branch-b", "refuted", "exp-b")],
    reviews: [{
      reviewId: "review-a", missionId: "branch-a", status: "completed", verdict: "needs-evidence", summary: "Narrow the claim.",
      rubric: ["Evidence sufficiency", "Claim scope"], reviewedArtifacts: [{ path: "paper.md", sizeBytes: 12, sha256: "b".repeat(64) }],
      reviewedArtifactSetSha256: "c".repeat(64), findings: [{ severity: "high", summary: "Evidence is narrow." }],
      actionItems: ["State cannotSay explicitly."], report: "# Review The claim is too broad.",
      provenance: { host: "isolated-reviewer", model: "review-model" }, limitations: ["Non-authoritative review."],
      reviewedAt: "2026-08-08T00:04:00.000Z"
    }],
    lessons: "# Free-form Lessons\n\n- Preserve failed runs.\n- Match claim scope to evidence.\n"
  };
}

const inputs = {
  lessonApplications: [{ lessonId: "lesson-1", application: "Keep adverse evidence.", missionId: "branch-a" }],
  experimentCandidates: [{
    candidateId: "candidate-a", title: "Run calibrated replication", source: "caller", missionId: null,
    hypothesisRefs: ["optimization-effect", "measurement-artifact"], protocol: ["Run calibration."],
    discriminatingObservations: ["Calibration separates the hypotheses."], cost: "Two GPU-hours.", risk: "Calibration drift.",
    failureValue: "Failure identifies unstable instrumentation.", contributionRole: "boundary-condition"
  }],
  hostAnalysis: { diagnosis: { openQuestions: ["Which condition explains the conflict?"] } }
};

test("all nine views are zero-write projections of final Research Format 1 fields", () => {
  const context = buildResearchContext(fixture(), inputs);
  const views = buildResearchViews(fixture(), inputs);
  assert.equal(context.workspace.researchQuestion, fixture().workspace.researchQuestion);
  assert.equal(context.missions[0].contributionRole, "mechanism-evidence");
  assert.equal(context.boundaries.format, "dove-research-v1");
  assert.equal(Object.isFrozen(context), true);
  assert.deepEqual(Object.keys(views), RESEARCH_CONTEXT_VIEWS);
  for (const view of Object.values(views)) { assert.equal(view.zeroWrite, true); assert.deepEqual(view.writes, []); }
});

test("diagnosis, related work, and hypotheses use explicit final semantic fields", () => {
  const context = buildResearchContext(fixture(), inputs);
  const diagnosis = queryResearchContext(context, { view: "diagnosis" });
  assert.equal(diagnosis.researchFrame.contributionIntent, "Identify the bounded mechanism and claim boundary.");
  assert.ok(diagnosis.supportGaps.some((item) => item.text === "Calibrated replication."));
  assert.ok(diagnosis.cannotSay.some((item) => /population-level/u.test(item.statement)));
  assert.ok(diagnosis.openQuestions.some((item) => item.source === "host-analysis"));
  assert.equal(diagnosis.lessonsContext.applied[0].lesson, "Preserve failed runs.");

  const related = queryResearchContext(context, { view: "related-work" });
  assert.equal(related.sources[0].relationship, "condition-specific");
  assert.deepEqual(related.sources[0].conditions, ["Small-data regime."]);
  assert.equal(related.sources[0].capture.path, "materials/paper.txt");

  const hypotheses = queryResearchContext(context, { view: "hypotheses" });
  const optimization = hypotheses.hypotheses.find((item) => item.hypothesisRef === "optimization-effect");
  assert.equal(optimization.experiments.length, 2);
  assert.equal(optimization.experiments[0].impacts[0].hypothesisRef, "optimization-effect");
});

test("experiment options expose discriminating observations, hypothesis refs, cost, risk, failure value, and contribution role", () => {
  const view = queryResearchContext(buildResearchContext(fixture(), inputs), { view: "experiment-options" });
  assert.equal(view.scoring, null);
  assert.equal(view.ranking, null);
  assert.ok(view.candidates.every((item) => item.authorization === "not-granted-by-query"));
  assert.deepEqual(view.candidates[0].comparison.map((item) => item.dimension), ["discriminatingPower", "informationGainSource", "cost", "risk", "failureValue", "contributionRole"]);
  assert.deepEqual(view.candidates[0].comparison[0].value, ["Calibration removes the effect only under the artifact hypothesis."]);
});

test("result synthesis preserves observations, denominator, impacts, adverse evidence, and recorded kinds", () => {
  const view = queryResearchContext(buildResearchContext(fixture(), inputs), { view: "result-synthesis" });
  assert.deepEqual(view.results.map((item) => item.kind), ["positive", "negative"]);
  assert.equal(view.results[0].observations[0], "The adverse observation was retained.");
  assert.deepEqual(view.results[0].denominator, { total: 3, observed: 3, failed: 0, excluded: 0 });
  assert.equal(view.impactsSummary.hypothesisImpactCount, 2);
  assert.equal(view.impactsSummary.claimImpactCount, 2);
  assert.equal(view.impactsSummary.unexpectedObservationCount, 1);
});

test("claim story, branch synthesis, and reviews expose final records transparently", () => {
  const context = buildResearchContext(fixture(), inputs);
  const story = queryResearchContext(context, { view: "claim-story" });
  assert.ok(story.storyTensions.some((item) => item.kind === "exact-statement-assessment-conflict"));
  assert.equal(story.missingEvidence[0].item, "Calibrated replication.");
  assert.ok(story.priorities.rebuttal.some((item) => item.reviewId === "review-a"));

  const branches = queryResearchContext(context, { view: "branch-synthesis", branchMissionIds: ["branch-a", "branch-b"] });
  assert.equal(branches.groups[0].conflicts.length, 1);
  assert.ok(branches.groups[0].nextBranchSuggestions.every((item) => item.authorization === "not-granted-by-query"));
  assert.equal(branches.lessonsContext.applied[0].lesson, "Preserve failed runs.");

  const reviews = queryResearchContext(context, { view: "reviews" });
  assert.equal(reviews.rubricCoverage[0].rubricItem, "Evidence sufficiency");
  assert.equal(reviews.reports[0].provenance.host, "isolated-reviewer");
  assert.equal(reviews.reports[0].limitations[0], "Non-authoritative review.");
});

test("superseded workspace, mission, source, experiment, claim, and review fields fail closed", () => {
  const oldWorkspace = fixture(); oldWorkspace.workspace.currentMainline = "old";
  assert.throws(() => buildResearchContext(oldWorkspace), /unknown fields.*currentMainline/iu);

  const oldMission = fixture(); oldMission.missions[0].mode = "research";
  assert.throws(() => buildResearchContext(oldMission), /unknown fields.*mode/iu);

  const oldSource = fixture(); oldSource.sources[0].relatedWork = {};
  assert.throws(() => buildResearchContext(oldSource), /unknown fields.*relatedWork/iu);

  const oldPlan = fixture(); oldPlan.experiments[0].plan.question = "old";
  assert.throws(() => buildResearchContext(oldPlan), /unknown fields.*question/iu);

  const oldResult = fixture(); oldResult.experiments[0].result.status = "completed";
  assert.throws(() => buildResearchContext(oldResult), /unknown fields.*status/iu);

  const oldClaim = fixture(); oldClaim.claims[0].text = oldClaim.claims[0].statement;
  assert.throws(() => buildResearchContext(oldClaim), /unknown fields.*text/iu);

  const oldReview = fixture(); oldReview.reviews[0].authority = "not-established";
  assert.throws(() => buildResearchContext(oldReview), /unknown fields.*authority/iu);
});
