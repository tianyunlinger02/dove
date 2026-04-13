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
  registerSource,
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
