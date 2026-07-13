import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
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
  upsertPlan,
  verifySource
} from "../../src/core/internal-api.mjs";
import { appendSystemHandoff, upsertSystemOrchestrationBoard } from "../../src/core/orchestration.mjs";
import { assertNoCompactPublicLeaks } from "../helpers/compact-public.mjs";
import { writeJson } from "../../src/core/workspace.mjs";
import { ensureTestWorkspace, runFixtureMutation } from "../helpers/mutation-fixture.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function tempRoot() {
  return createTempRoot("dove-workflow-");
}

function seedTaskPacket(root, packetId = "workflow-main-packet") {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: packetId,
    title: "Workflow main packet",
    summary: "Integration test packet for task-scoped writes.",
    sourceType: "test-task",
    sourceId: packetId,
    status: "pending",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    currentFocus: "Run the integration workflow.",
    nextAction: "Continue the scoped workflow.",
    evidenceLinks: [],
    outputPaths: [],
    packetPath: `.dove/task-packets/packets/${packetId}.json`,
    packetContextPath: `.dove/context/packets/${packetId}.json`,
    updatedAt: timestamp
  };
  writeJson(root, packet.packetPath, packet);
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, { version: 3, items: [packet], lifecycleCounts: {}, dependencyHealth: {}, updatedAt: timestamp });
  return packetId;
}

test("single-paper workflow creates durable artifacts", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "single-paper-workflow-creates-durable-artifacts", () => {

  ensureTestWorkspace(root);
  initProject(root, {
    title: "Dove Workflow",
    venue: "ICML",
    objective: "Validate the end-to-end writing pipeline.",
    thesis: "Durable workflows improve academic writing.",
    audience: "conference reviewers"
  });
  const packetId = seedTaskPacket(root);

  upsertSystemOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "researcher",
    tasks: [
      { title: "Expand source coverage", assignedRole: "researcher", status: "in-progress" },
      { title: "Plan comparison experiment", assignedRole: "experiment-planner", status: "pending" }
    ]
  });
  updateResearchBrief(root, {
    packetId,
    objective: "Validate the end-to-end writing pipeline.",
    agenda: ["Collect supporting sources", "Promote supported claims"],
    evidenceBacklog: ["Run a comparison experiment"]
  });

  const source = registerSource(root, {
    packetId,
    citationKey: "lee2026durable",
    title: "Durable Writing Systems",
    authors: ["Lee"],
    year: 2026,
    locator: "https://example.org/durable-writing-systems"
  });

  const source2 = registerSource(root, {
    packetId,
    citationKey: "kim2026workflow",
    title: "Workflow Reliability in Academic Writing",
    authors: ["Kim"],
    year: 2026,
    locator: "https://example.org/workflow-reliability"
  });
  for (const registeredSource of [source, source2]) {
    verifySource(root, {
      packetId,
      sourceId: registeredSource.id,
      decision: "verified",
      method: "test fixture inspected the canonical publication record",
      checkedMaterial: "source title, authors, year, and publication metadata",
      auditEvidence: [{ reference: registeredSource.locator, kind: "source", observation: `Verified fixture identity for ${registeredSource.id}.` }]
    });
  }

  const note = upsertNote(root, {
    packetId,
    title: "Motivation note",
    sectionId: "introduction",
    sourceIds: [source.id, source2.id],
    summary: "Durable systems reduce context loss."
  });
  assertNoCompactPublicLeaks(source.resultCard, { ignoredKeys: ["command"] });
  assertNoCompactPublicLeaks(source2.resultCard, { ignoredKeys: ["command"] });
  assertNoCompactPublicLeaks(note.resultCard, { ignoredKeys: ["command"] });

  upsertClaims(root, {
    packetId,
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

  const plan = upsertPlan(root, {
    packetId,
    thesis: "Durable workflows improve academic writing.",
    audience: "conference reviewers",
    sections: ["Abstract", "Introduction", "Method"]
  });

  const outline = upsertOutline(root, {
    packetId,
    sections: [{ id: "introduction", title: "Introduction", status: "drafting", goal: "Frame the problem." }]
  });

  const draft = upsertDraft(root, {
    packetId,
    sectionId: "introduction",
    title: "Introduction",
    body: "# Introduction\n\nDurable workflows reduce context loss [cite:lee2026durable].\n",
    status: "drafting"
  });
  assertNoCompactPublicLeaks(plan.resultCard, { ignoredKeys: ["command"] });
  assertNoCompactPublicLeaks(outline.resultCard, { ignoredKeys: ["command"] });
  assertNoCompactPublicLeaks(draft.resultCard, { ignoredKeys: ["command"] });

  appendSystemHandoff(root, {
    fromRole: "researcher",
    toRole: "experiment-planner",
    phase: "experiments",
    summary: "Handing off to plan the claim-linked experiment.",
    nextActions: ["Record the experiment plan", "Capture the result and audit it"]
  });

  const experimentPlan = upsertExperimentPlan(root, {
    packetId,
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
    evidenceLinks: [".dove/experiments/EXPERIMENT_LOG.md"],
    comparisonTargets: ["baseline-ad-hoc"]
  });

  appendSystemHandoff(root, {
    fromRole: "experiment-planner",
    toRole: "reviewer",
    phase: "review",
    summary: "Handing off for evidence-aware review.",
    nextActions: ["Run the review loop", "Triage rebuttal issues"]
  });

  const review = runReviewLoop(root, { packetId, scope: "introduction" });
  appendSystemHandoff(root, {
    fromRole: "reviewer",
    toRole: "version-analyst",
    phase: "versions",
    summary: "Handing off for durable snapshotting after review.",
    nextActions: ["Create the next snapshot", "Compare the new lineage step"]
  });
  const snapshotA = createVersionSnapshot(root, {
    packetId,
    versionId: "v1-initial",
    label: "Initial draft",
    summary: "Before post-review edits."
  });
  upsertDraft(root, {
    packetId,
    sectionId: "introduction",
    title: "Introduction",
    body: "# Introduction\n\nDurable workflows reduce context loss [cite:lee2026durable] and improve review traceability [cite:kim2026workflow].\n",
    status: "drafting"
  });
  appendSystemHandoff(root, {
    fromRole: "researcher",
    toRole: "version-analyst",
    phase: "versions",
    summary: "Handing off again after draft edits so versioning stays explicit.",
    nextActions: ["Create the revised snapshot"]
  });
  const snapshotB = createVersionSnapshot(root, {
    packetId,
    versionId: "v2-revised",
    label: "Revised draft",
    parentVersionId: snapshotA.id,
    summary: "After review-driven revision."
  });
  const comparison = compareVersions(root, { packetId, fromVersionId: snapshotA.id, toVersionId: snapshotB.id });
  const checklist = syncChecklist(root);

  assert.equal(review.verdict, "coherent");
  assert.equal(checklist.checklistPath, ".dove/checklists/current.md");
  assert.equal(comparison.fromVersionId, snapshotA.id);
  assert.ok(fs.existsSync(path.join(root, ".dove", "revision-plans", "current-plan.md")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "sources", "index.json")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "orchestration", "board.json")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "rebuttal", "issues.json")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "versions", "snapshots", `${snapshotA.id}.json`)));
  });
});
