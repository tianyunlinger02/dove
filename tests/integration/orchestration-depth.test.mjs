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
  readRoleContextManifest,
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
  return fs.mkdtempSync(path.join(os.tmpdir(), "dove-depth-"));
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
    assignedRole: "researcher",
    tasks: [
      { title: "Research baseline", assignedRole: "researcher", status: "pending", evidenceLinks: [".dove/research/brief.md"] }
    ],
    blockers: [
      { summary: "Need comparison target", assignedRole: "planner", status: "open" }
    ],
    activeComparisonTargets: ["baseline-a"]
  });
  assert.equal(board.currentPhase, "research");

  updateResearchBrief(root, {
    agenda: ["Collect comparable workflow evidence"],
    evidenceBacklog: ["Need experiment result for baseline-a"]
  });

  fs.writeFileSync(path.join(root, ".dove", "sources", "index.json"), JSON.stringify({
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

  appendHandoff(root, {
    fromRole: "planner",
    toRole: "experiment-planner",
    phase: "experiments",
    summary: "Move into experiment planning.",
    nextActions: ["Record the comparison plan"]
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
    evidenceLinks: [".dove/versions/index.json"],
    comparisonTargets: ["baseline-a"]
  });

  appendHandoff(root, {
    fromRole: "experiment-planner",
    toRole: "reviewer",
    phase: "review",
    summary: "Move into review triage after the experiment result.",
    nextActions: ["Normalize rebuttal issues"]
  });

  normalizeRebuttalIssues(root, {
    issues: [
      { summary: "Need clearer comparison framing.", severity: "medium", responseDirection: "clarify" }
    ]
  });
  const strategy = buildRebuttalStrategy(root);
  assert.equal(strategy.issueCount, 1);

  appendHandoff(root, {
    fromRole: "rebuttal-lead",
    toRole: "reviewer",
    phase: "review",
    summary: "Return to review for signoff.",
    nextActions: ["Record the coherent review verdict"]
  });

  appendReviewLog(root, {
    stage: "depth-flow-signoff",
    scope: "orchestration-depth",
    verdict: "coherent",
    summary: "Artifacts are coherent for snapshot testing.",
    findings: [],
    actionItems: [],
    reviewRequiredBeforeFinalize: false
  });
  appendHandoff(root, {
    fromRole: "reviewer",
    toRole: "version-analyst",
    phase: "versions",
    summary: "Move into version analysis after signoff.",
    nextActions: ["Create the next version snapshot"]
  });
  const v1 = createVersionSnapshot(root, { versionId: "depth-v1", summary: "First snapshot" });
  const v2 = createVersionSnapshot(root, { versionId: "depth-v2", parentVersionId: v1.id, summary: "Second snapshot" });
  const comparison = compareVersions(root, { fromVersionId: v1.id, toVersionId: v2.id });

  const state = readState(root);
  const versionManifest = readRoleContextManifest(root, "version-analyst");
  assert.equal(state.orchestrationBoard.versionLineage.currentVersionId, v2.id);
  assert.deepEqual(state.orchestrationBoard.activeComparisonTargets, [v1.id, v2.id]);
  assert.equal(state.workspaceIndex.boardAssignedRole, "planner");
  assert.ok(state.workspaceIndex.activeRoles.includes("planner"));
  assert.equal(versionManifest.boardAssignedRole, "planner");
  assert.equal(versionManifest.isCurrentBoardOwner, true);
  assert.equal(comparison.toVersionId, v2.id);
  assert.ok(Array.isArray(comparison.addedEvidenceLinks));
  assert.ok(Array.isArray(comparison.changedDraftSections));
  const handoffs = fs.readFileSync(path.join(root, ".dove", "orchestration", "handoffs.md"), "utf8");
  assert.match(handoffs, /planner -> researcher/);
  assert.match(handoffs, /experiment-planner -> rebuttal-lead|reviewer -> version-analyst|planner -> experiment-planner/);
  assert.ok(fs.existsSync(path.join(root, ".dove", "orchestration", "handoffs.md")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "rebuttal", "strategy.md")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "versions", "LATEST_COMPARISON.md")));
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

  appendHandoff(root, {
    fromRole: "reviewer",
    toRole: "version-analyst",
    phase: "versions",
    summary: "Attempting version analysis before the finalize gate is cleared.",
    nextActions: ["Create the blocked snapshot"]
  });

  assert.throws(() => {
    createVersionSnapshot(root, { versionId: "blocked-version" });
  }, /requires a coherent review/);
});

test("board role-phase contract rejects mismatches unless an override is explicit and traceable", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, {
    title: "Role Contract",
    objective: "Verify board role enforcement.",
    thesis: "Explicit handoffs should govern role ownership."
  });

  appendHandoff(root, {
    fromRole: "planner",
    toRole: "researcher",
    phase: "research",
    summary: "Move into research."
  });

  assert.throws(() => {
    upsertOrchestrationBoard(root, {
      phase: "review",
      assignedRole: "planner"
    });
  }, /requires role reviewer for phase review/);

  const overridden = upsertOrchestrationBoard(root, {
    phase: "review",
    assignedRole: "planner",
    policyOverrideReason: "manual board repair after importing an older workspace"
  });

  const handoffs = fs.readFileSync(path.join(root, ".dove", "orchestration", "handoffs.md"), "utf8");
  assert.equal(overridden.currentPhase, "review");
  assert.equal(overridden.assignedRole, "planner");
  assert.match(handoffs, /Policy override: manual board repair after importing an older workspace/);
});
