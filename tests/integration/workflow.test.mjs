import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  appendHandoff,
  compareVersions,
  createVersionSnapshot,
  ensureWorkspace,
  initProject,
  queryMetaOptimize,
  registerSource,
  runAutonomyOperate,
  runReviewLoop,
  syncChecklist,
  updateResearchBrief,
  upsertClaims,
  upsertDraft,
  upsertExperimentPlan,
  upsertExperimentResult,
  upsertNote,
  upsertOutline,
  upsertOrchestrationBoard,
  upsertPlan
} from "../../src/core/index.mjs";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-workflow-"));
}

function seedExecutionBridgeCandidate(root) {
  fs.writeFileSync(path.join(root, ".paper", "reviews", "concerns.json"), JSON.stringify({
    version: 2,
    items: [{
      id: "source-first-gap",
      summary: "Need a reusable proposal source for autonomy operate.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [".paper/reviews/log.md"],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  }, null, 2));
  fs.writeFileSync(path.join(root, ".paper", "reviews", "REVIEW_STATE.json"), JSON.stringify({
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the source-first autonomy gap."],
    unresolvedConcernIds: ["source-first-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  }, null, 2));
  return queryMetaOptimize(root).executionBridgeCandidates.candidates.find((candidate) => candidate.candidateType === "packet-candidate");
}

test("single-paper workflow creates durable artifacts", () => {
  const root = tempRoot();

  ensureWorkspace(root);
  initProject(root, {
    title: "Paper Factory Workflow",
    venue: "ICML",
    objective: "Validate the end-to-end writing pipeline.",
    thesis: "Durable workflows improve academic writing.",
    audience: "conference reviewers"
  });

  upsertOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "researcher",
    tasks: [
      { title: "Expand source coverage", assignedRole: "researcher", status: "in-progress" },
      { title: "Plan comparison experiment", assignedRole: "experiment-planner", status: "pending" }
    ]
  });
  updateResearchBrief(root, {
    objective: "Validate the end-to-end writing pipeline.",
    agenda: ["Collect supporting sources", "Promote supported claims"],
    evidenceBacklog: ["Run a comparison experiment"]
  });

  const source = registerSource(root, {
    citationKey: "lee2026durable",
    title: "Durable Writing Systems",
    authors: ["Lee"],
    year: 2026
  });

  const source2 = registerSource(root, {
    citationKey: "kim2026workflow",
    title: "Workflow Reliability in Academic Writing",
    authors: ["Kim"],
    year: 2026
  });

  const note = upsertNote(root, {
    title: "Motivation note",
    sectionId: "introduction",
    sourceIds: [source.id, source2.id],
    summary: "Durable systems reduce context loss."
  });

  upsertClaims(root, {
    claims: [
      {
        id: "claim-1",
        text: "Durable workflows reduce context loss.",
        sectionId: "introduction",
        sourceIds: [source.id, source2.id],
        noteIds: [note.id],
        status: "supported"
      }
    ]
  });

  upsertPlan(root, {
    thesis: "Durable workflows improve academic writing.",
    audience: "conference reviewers",
    sections: ["Abstract", "Introduction", "Method"]
  });

  upsertOutline(root, {
    sections: [{ id: "introduction", title: "Introduction", status: "drafting", goal: "Frame the problem." }]
  });

  upsertDraft(root, {
    sectionId: "introduction",
    title: "Introduction",
    body: "# Introduction\n\nDurable workflows reduce context loss [cite:lee2026durable].\n",
    status: "drafting"
  });

  appendHandoff(root, {
    fromRole: "researcher",
    toRole: "experiment-planner",
    phase: "experiments",
    summary: "Handing off to plan the claim-linked experiment.",
    nextActions: ["Record the experiment plan", "Capture the result and audit it"]
  });

  const experimentPlan = upsertExperimentPlan(root, {
    id: "durable-comparison",
    title: "Durable vs ad-hoc workflow comparison",
    claimId: "claim-1",
    hypothesis: "Durable workflows reduce context loss.",
    methodology: "Compare artifact completeness across runs.",
    successMetric: "Fewer unsupported claims",
    comparisonTargets: ["baseline-ad-hoc"]
  });
  upsertExperimentResult(root, {
    experimentId: experimentPlan.id,
    claimId: "claim-1",
    outcome: "supports",
    summary: "Durable workflow preserved more evidence links.",
    evidenceLinks: [".paper/experiments/EXPERIMENT_LOG.md"],
    comparisonTargets: ["baseline-ad-hoc"]
  });

  appendHandoff(root, {
    fromRole: "experiment-planner",
    toRole: "reviewer",
    phase: "review",
    summary: "Handing off for evidence-aware review.",
    nextActions: ["Run the review loop", "Triage rebuttal issues"]
  });

  const review = runReviewLoop(root, { scope: "introduction" });
  appendHandoff(root, {
    fromRole: "rebuttal-lead",
    toRole: "version-analyst",
    phase: "versions",
    summary: "Handing off for durable snapshotting after rebuttal triage.",
    nextActions: ["Create the next snapshot", "Compare the new lineage step"]
  });
  const snapshotA = createVersionSnapshot(root, {
    versionId: "v1-initial",
    label: "Initial draft",
    summary: "Before post-review edits."
  });
  upsertDraft(root, {
    sectionId: "introduction",
    title: "Introduction",
    body: "# Introduction\n\nDurable workflows reduce context loss [cite:lee2026durable] and improve review traceability [cite:kim2026workflow].\n",
    status: "drafting"
  });
  appendHandoff(root, {
    fromRole: "researcher",
    toRole: "version-analyst",
    phase: "versions",
    summary: "Handing off again after draft edits so versioning stays explicit.",
    nextActions: ["Create the revised snapshot"]
  });
  const snapshotB = createVersionSnapshot(root, {
    versionId: "v2-revised",
    label: "Revised draft",
    parentVersionId: snapshotA.id,
    summary: "After review-driven revision."
  });
  const comparison = compareVersions(root, { fromVersionId: snapshotA.id, toVersionId: snapshotB.id });
  const checklist = syncChecklist(root);

  assert.equal(review.verdict, "coherent");
  assert.equal(checklist.checklistPath, ".paper/checklists/paper.md");
  assert.equal(comparison.fromVersionId, snapshotA.id);
  assert.ok(fs.existsSync(path.join(root, ".paper", "revision-plans", "current-plan.md")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "sources", "index.json")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "orchestration", "board.json")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "rebuttal", "issues.json")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "versions", "snapshots", `${snapshotA.id}.json`)));
});

test("autonomy operate composes objective bridge, planning, approval, foreground execution, and durable stop state", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, {
    title: "Autonomy Operate Workflow",
    objective: "Validate explicit foreground autonomous research operation."
  });

  const result = runAutonomyOperate(root, {
    objective: "Refresh research context and run a bounded review checkpoint",
    maxSteps: 5,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T01:00:00.000Z"
  });

  assert.equal(result.inputMode, "objective");
  assert.equal(result.sourceType, "execution-bridge");
  assert.deepEqual(result.safeDefaultStepSequence, ["refresh-research-brief", "refresh-wiki", "run-review-loop"]);
  assert.equal(result.foreground.stepCount >= 2, true);
  assert.equal(result.stopReason, "executed-program-step");

  const candidates = JSON.parse(fs.readFileSync(path.join(root, ".paper", "meta", "execution-bridge-candidates.json"), "utf8"));
  const candidate = candidates.candidates.find((item) => item.id === result.sourceId);
  assert.ok(candidate, "objective-derived bridge candidate should be durable");
  assert.equal(candidate.proposalOnly, true);
  assert.equal(candidate.noAutoApply, true);
  assert.equal(candidate.objectiveDerived, true);

  const run = JSON.parse(fs.readFileSync(path.join(root, ".paper", "programs", "runs.json"), "utf8")).items.find((item) => item.id === result.programRunId);
  assert.ok(run, "program run should be recorded");
  assert.deepEqual(run.authorityEnvelope.stepSequence.map((step) => step.allowedStepType), ["refresh-research-brief", "refresh-wiki", "run-review-loop"]);
  assert.equal(run.authorityEnvelope.stepSequence.some((step) => ["upsert-note", "run-experiment-audit", "bridge-result-to-claim"].includes(step.allowedStepType)), false);

  const runtimeResults = JSON.parse(fs.readFileSync(path.join(root, ".paper", "runtime", "results.json"), "utf8"));
  assert.equal(runtimeResults.summary.lastStatus, "completed");
  assert.equal(runtimeResults.entries.at(-1).packetId, result.packetId);
});

test("autonomy operate reuses an existing proposal source with exact caller-provided ids", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, {
    title: "Autonomy Operate Source Reuse",
    objective: "Validate explicit source-first autonomous operation."
  });

  const source = seedExecutionBridgeCandidate(root);
  assert.ok(source, "query_meta_optimize should produce a packet execution bridge candidate");

  const result = runAutonomyOperate(root, {
    sourceType: "execution-bridge",
    sourceId: source.id,
    packetId: "operate-source-packet",
    programId: "operate-source-program",
    programRunId: "operate-source-run",
    approvalId: "operate-source-approval",
    campaignId: "operate-source-campaign",
    campaignStepId: "operate-source-step",
    workerRole: "planner",
    maxSteps: 2,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T01:00:00.000Z"
  });

  assert.equal(result.inputMode, "source");
  assert.equal(result.sourceType, "execution-bridge");
  assert.equal(result.sourceId, source.id);
  assert.equal(result.packetId, "operate-source-packet");
  assert.equal(result.programId, "operate-source-program");
  assert.equal(result.programRunId, "operate-source-run");
  assert.equal(result.approvalId, "operate-source-approval");
  assert.equal(result.campaignId, "operate-source-campaign");
  assert.equal(result.campaignStepId, "operate-source-step");

  const candidates = JSON.parse(fs.readFileSync(path.join(root, ".paper", "meta", "execution-bridge-candidates.json"), "utf8"));
  assert.equal(candidates.candidates.some((candidate) => candidate.candidateOrigin === "operator-objective" || candidate.objectiveDerived === true), false);

  const packet = JSON.parse(fs.readFileSync(path.join(root, ".paper", "task-packets", "packets", "operate-source-packet.json"), "utf8"));
  assert.equal(packet.id, "operate-source-packet");
  assert.equal(packet.materialization.sourceType, "execution-bridge");
  assert.equal(packet.materialization.sourceId, source.id);
});
