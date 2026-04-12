import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  appendHandoff,
  appendReviewLog,
  buildRebuttalStrategy,
  compareVersions,
  createVersionSnapshot,
  ensureWorkspace,
  initProject,
  normalizeRebuttalIssues,
  readState,
  runReviewLoop,
  updateResearchBrief,
  upsertClaims,
  upsertExperimentPlan,
  upsertExperimentResult,
  upsertNote,
  upsertOrchestrationBoard
} from "../../src/core/index.mjs";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-depth-"));
}

test("orchestration board, handoff, experiment, rebuttal, and version flows stay durable", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, {
    title: "Depth Test",
    objective: "Exercise the orchestration depth model.",
    thesis: "Board-first workflows improve resumability."
  });

  const board = upsertOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "planner",
    tasks: [
      { title: "Research baseline", assignedRole: "researcher", status: "pending", evidenceLinks: [".paper/research/brief.md"] }
    ],
    blockers: [
      { summary: "Need comparison target", assignedRole: "planner", status: "open" }
    ],
    activeComparisonTargets: ["baseline-a"]
  });
  assert.equal(board.currentPhase, "research");

  appendHandoff(root, {
    fromRole: "planner",
    toRole: "researcher",
    summary: "Move into evidence collection.",
    nextActions: ["Refresh agenda"]
  });
  updateResearchBrief(root, {
    agenda: ["Collect comparable workflow evidence"],
    evidenceBacklog: ["Need experiment result for baseline-a"]
  });

  fs.writeFileSync(path.join(root, ".paper", "sources", "index.json"), JSON.stringify({
    version: 1,
    items: [{ id: "known-source", citationKey: "known-source", title: "Known", authors: [], year: 2026 }],
    updatedAt: null
  }, null, 2));
  upsertNote(root, {
    title: "Depth note",
    sectionId: "introduction",
    sourceIds: ["known-source"],
    summary: "Supports orchestration depth claim."
  });
  upsertClaims(root, {
    claims: [{ id: "claim-depth", text: "Board-first workflows improve resumability.", sectionId: "introduction", sourceIds: ["known-source"], noteIds: ["introduction-depth-note"] }]
  });

  const experimentPlan = upsertExperimentPlan(root, {
    id: "baseline-a-check",
    title: "Baseline A comparison",
    claimId: "claim-depth",
    methodology: "Compare version lineage coverage",
    successMetric: "Higher lineage completeness",
    comparisonTargets: ["baseline-a"]
  });
  upsertExperimentResult(root, {
    experimentId: experimentPlan.id,
    claimId: "claim-depth",
    outcome: "supports",
    summary: "Baseline A lacks durable lineage state.",
    evidenceLinks: [".paper/versions/index.json"],
    comparisonTargets: ["baseline-a"]
  });

  normalizeRebuttalIssues(root, {
    issues: [
      { summary: "Need clearer comparison framing.", severity: "medium", responseDirection: "clarify" }
    ]
  });
  const strategy = buildRebuttalStrategy(root);
  assert.equal(strategy.issueCount, 1);

  appendReviewLog(root, {
    stage: "depth-flow-signoff",
    scope: "orchestration-depth",
    verdict: "coherent",
    summary: "Artifacts are coherent for snapshot testing.",
    findings: [],
    actionItems: [],
    reviewRequiredBeforeFinalize: false
  });
  const v1 = createVersionSnapshot(root, { versionId: "depth-v1", summary: "First snapshot" });
  upsertOrchestrationBoard(root, { phase: "versions", assignedRole: "version-analyst" });
  const v2 = createVersionSnapshot(root, { versionId: "depth-v2", parentVersionId: v1.id, summary: "Second snapshot" });
  const comparison = compareVersions(root, { fromVersionId: v1.id, toVersionId: v2.id });

  const state = readState(root);
  assert.equal(state.orchestrationBoard.versionLineage.currentVersionId, v2.id);
  assert.deepEqual(state.orchestrationBoard.activeComparisonTargets, [v1.id, v2.id]);
  assert.equal(comparison.toVersionId, v2.id);
  assert.ok(Array.isArray(comparison.addedEvidenceLinks));
  assert.ok(Array.isArray(comparison.changedDraftSections));
  const handoffs = fs.readFileSync(path.join(root, ".paper", "orchestration", "handoffs.md"), "utf8");
  assert.match(handoffs, /planner -> researcher/);
  assert.match(handoffs, /experiment-planner -> rebuttal-lead|reviewer -> version-analyst|planner -> experiment-planner/);
  assert.ok(fs.existsSync(path.join(root, ".paper", "orchestration", "handoffs.md")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "rebuttal", "strategy.md")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "versions", "LATEST_COMPARISON.md")));
});

test("version actions are blocked until coherent review clears finalize gate", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, {
    title: "Finalize Gate",
    objective: "Verify finalize review gate.",
    thesis: "Review gate should block premature version snapshots."
  });

  upsertOrchestrationBoard(root, {
    phase: "review",
    assignedRole: "reviewer",
    reviewRequiredBeforeFinalize: true,
    blockers: [{ summary: "Need coherent review before snapshot.", status: "open", assignedRole: "reviewer" }]
  });

  assert.throws(() => {
    createVersionSnapshot(root, { versionId: "blocked-version" });
  }, /requires a coherent review/);
});
