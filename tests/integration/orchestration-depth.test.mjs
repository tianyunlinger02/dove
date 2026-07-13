import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  appendReviewLog,
  buildRebuttal,
  buildRebuttalStrategy,
  compareVersions,
  createVersionSnapshot,
  ensureWorkspace,
  initProject,
  loadBoard,
  normalizeRebuttalIssues,
  prepareIsolatedReview,
  importIsolatedReview,
  readRoleContextManifest,
  registerSource,
  readState,
  runReviewLoop,
  updateResearchBrief,
  upsertClaims,
  upsertExperimentPlan,
  upsertExperimentResult,
  upsertNote,
  upsertOrchestrationBoard,
  writeJson
} from "../../src/core/internal-api.mjs";
import {
  appendSystemHandoff,
  currentFinalizationArtifactPaths,
  upsertSystemOrchestrationBoard
} from "../../src/core/orchestration.mjs";
import { assertNoCompactPublicLeaks } from "../helpers/compact-public.mjs";
import { ensureTestWorkspace, runFixtureMutation } from "../helpers/mutation-fixture.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";
import { seedTrustedSourceVerification } from "../helpers/source-verification-fixture.mjs";

function tempRoot() {
  return createTempRoot("dove-depth-");
}

function runDepthMutation(root, callback) {
  return runFixtureMutation(root, "orchestration-depth", callback);
}

function seedTaskPacket(root, packetId = "depth-main-packet") {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: packetId,
    title: "Depth main packet",
    summary: "Integration test packet for task-scoped writes.",
    sourceType: "test-task",
    sourceId: packetId,
    status: "pending",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    currentFocus: "Run the orchestration depth flow.",
    nextAction: "Continue the scoped flow.",
    evidenceLinks: [],
    outputPaths: [],
    packetPath: `.dove/task-packets/packets/${packetId}.json`,
    packetContextPath: `.dove/context/packets/${packetId}.json`,
    updatedAt: timestamp
  };
  writeJson(root, packet.packetPath, packet);
  writeJson(root, ".dove/task-packets/index.json", { version: 3, items: [packet], lifecycleCounts: {}, dependencyHealth: {}, updatedAt: timestamp });
  return packetId;
}

test("orchestration board, handoff, experiment, rebuttal, and version flows stay durable", () => {
  const root = tempRoot();
  return runDepthMutation(root, () => {
    ensureWorkspace(root);
  initProject(root, {
    title: "Depth Test",
    objective: "Exercise the orchestration depth model.",
    thesis: "Board-first workflows improve resumability."
  });
  const packetId = seedTaskPacket(root);

  const board = upsertSystemOrchestrationBoard(root, {
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
    packetId,
    agenda: ["Collect comparable workflow evidence"],
    evidenceBacklog: ["Need experiment result for baseline-a"]
  });

  const source = registerSource(root, {
    packetId,
    sourceId: "known-source",
    citationKey: "known-source",
    title: "Known",
    authors: [],
    year: 2026,
    locator: "https://example.org/test-source"
  });
  seedTrustedSourceVerification(root, source.id, packetId);
  upsertNote(root, {
    packetId,
    title: "Depth note",
    sectionId: "introduction",
    sourceIds: ["known-source"],
    summary: "Supports orchestration depth claim."
  });
  upsertClaims(root, {
    packetId,
    claims: [{ id: "claim-depth", text: "Board-first workflows improve resumability.", sectionId: "introduction", sourceIds: ["known-source"], noteIds: ["introduction-depth-note"] }]
  });

  appendSystemHandoff(root, {
    fromRole: "planner",
    toRole: "experiment-planner",
    phase: "experiments",
    summary: "Move into experiment planning.",
    nextActions: ["Record the comparison plan"]
  });

  const experimentPlan = upsertExperimentPlan(root, {
    packetId,
    id: "baseline-a-check",
    title: "Baseline A comparison",
    claimId: "claim-depth",
    methodology: "Compare version lineage coverage",
    successMetric: "Higher lineage completeness",
    comparisonTargets: ["baseline-a"]
  });
  const experimentEvidencePath = ".dove/evidence/baseline-a-comparison.txt";
  fs.mkdirSync(path.dirname(path.join(root, experimentEvidencePath)), { recursive: true });
  fs.writeFileSync(path.join(root, experimentEvidencePath), "Baseline A comparison inspected durable lineage coverage and found the expected gap.\n", "utf8");
  upsertExperimentResult(root, {
    experimentId: experimentPlan.id,
    claimId: "claim-depth",
    outcome: "supports",
    summary: "Baseline A lacks durable lineage state.",
    evidenceLinks: [experimentEvidencePath],
    comparisonTargets: ["baseline-a"]
  });

  appendSystemHandoff(root, {
    fromRole: "experiment-planner",
    toRole: "reviewer",
    phase: "review",
    summary: "Move into review triage after the experiment result.",
    nextActions: ["Normalize rebuttal issues"]
  });

  const normalizedIssues = normalizeRebuttalIssues(root, {
    packetId,
    issues: [
      { summary: "Need clearer comparison framing.", severity: "medium", responseDirection: "clarify" }
    ]
  });
  assertNoCompactPublicLeaks(normalizedIssues.resultCard, { ignoredKeys: ["command"] });
  const strategy = buildRebuttalStrategy(root, { packetId });
  assert.equal(strategy.issueCount, 1);
  assertNoCompactPublicLeaks(strategy.resultCard, { ignoredKeys: ["command"] });

  appendSystemHandoff(root, {
    fromRole: "rebuttal-lead",
    toRole: "reviewer",
    phase: "review",
    summary: "Return to review for signoff.",
    nextActions: ["Record the coherent review verdict"]
  });

  appendReviewLog(root, {
    packetId,
    stage: "depth-flow-signoff",
    scope: "orchestration-depth",
    verdict: "needs-revision",
    summary: "Local signoff is preflight-only until isolated Reviewer proof is imported.",
    reviewedArtifactPaths: [".dove/claims/CLAIMS_FROM_RESULTS.md"],
    autoGeneratedReviewReport: true,
    findings: [{ severity: "high", summary: "Import current-hash-bound isolated Reviewer proof before finalization." }],
    actionItems: ["Import current-hash-bound isolated Reviewer proof before finalization."]
  });
  const preparedReview = prepareIsolatedReview(root, {
    packetId,
    runId: "depth-flow-isolated-signoff",
    reviewedArtifactPaths: [".dove/claims/CLAIMS_FROM_RESULTS.md"]
  });
  fs.writeFileSync(path.join(root, preparedReview.reportPath), "# Isolated review\n\nThe current claim artifact is coherent.\n", "utf8");
  fs.writeFileSync(path.join(root, preparedReview.handoffPath), `${JSON.stringify({
    runId: preparedReview.runId,
    status: "completed",
    verdict: "coherent",
    reviewerId: "depth-isolated-reviewer",
    summary: "The current claim artifact is coherent.",
    inputPath: preparedReview.inputPath,
    inputSha256: preparedReview.inputSha256,
    reportPath: preparedReview.reportPath,
    reviewedArtifactPaths: preparedReview.reviewedArtifactPaths,
    findings: [],
    actionItems: []
  }, null, 2)}\n`, "utf8");
  const importedReview = importIsolatedReview(root, { packetId, runId: preparedReview.runId });
  assert.equal(importedReview.authoritative, false);
  assert.equal(importedReview.independentReviewProof, null);
  assert.equal(importedReview.reviewProofRequired, true);
  assert.throws(() => appendSystemHandoff(root, {
    fromRole: "reviewer",
    toRole: "version-analyst",
    phase: "versions",
    summary: "Attempt version analysis after non-authoritative isolated signoff.",
    nextActions: ["Confirm finalization remains blocked"]
  }), /review-proof-required.*authorized independent Reviewer proof/u);
  assert.throws(() => createVersionSnapshot(root, { packetId, versionId: "depth-v1", summary: "Blocked snapshot" }), /authorized independent Reviewer proof|at least one current final draft or final figure artifact/);

  const state = readState(root);
  const versionManifest = readRoleContextManifest(root, "version-analyst");
  assert.equal(state.orchestrationBoard.versionLineage.currentVersionId, null);
  assert.deepEqual(state.orchestrationBoard.activeComparisonTargets, ["baseline-a"]);
  assert.equal(state.workspaceIndex.boardAssignedRole, "reviewer");
  assert.ok(state.workspaceIndex.activeRoles.includes("reviewer"));
  assert.equal(versionManifest.boardAssignedRole, "reviewer");
  assert.equal(versionManifest.isCurrentBoardOwner, false);
  const handoffs = fs.readFileSync(path.join(root, ".dove", "orchestration", "handoffs.md"), "utf8");
  assert.match(handoffs, /planner -> researcher/);
  assert.match(handoffs, /experiment-planner -> rebuttal-lead|planner -> experiment-planner/);
  assert.doesNotMatch(handoffs, /reviewer -> version-analyst/u);
  assert.ok(fs.existsSync(path.join(root, ".dove", "orchestration", "handoffs.md")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "rebuttal", "strategy.md")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "versions", "LATEST_COMPARISON.md")));
  });
});

test("rebuttal builders return a no-write boundary without normalized issues", () => {
  const root = tempRoot();
  return runDepthMutation(root, () => {
    ensureWorkspace(root);
  initProject(root, {
    title: "Empty Rebuttal Boundary",
    objective: "Reject placeholder rebuttal artifacts.",
    thesis: "Real normalized issues are required."
  });
  const packetId = seedTaskPacket(root, "empty-rebuttal-packet");
  const artifactPaths = [
    ".dove/rebuttal/strategy.md",
    ".dove/rebuttal/response-draft.md",
    ".dove/drafts/rebuttal.md"
  ];
  const beforeState = fs.readFileSync(path.join(root, ".dove", "state.json"), "utf8");
  const beforeArtifacts = artifactPaths.map((artifactPath) => {
    const absolutePath = path.join(root, artifactPath);
    return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : null;
  });

  const strategy = buildRebuttalStrategy(root, { packetId });
  assert.equal(strategy.status, "missing-required-materials");
  assert.deepEqual(strategy.requiredActions, ["review-or-import-rebuttal-issues", "normalize-rebuttal-issues"]);
  assert.equal(strategy.boundary.type, "missing-required-materials");
  assert.deepEqual(artifactPaths.map((artifactPath) => {
    const absolutePath = path.join(root, artifactPath);
    return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : null;
  }), beforeArtifacts);
  assert.equal(fs.readFileSync(path.join(root, ".dove", "state.json"), "utf8"), beforeState);

  const draft = buildRebuttal(root, { packetId });
  assert.equal(draft.status, "missing-required-materials");
  assert.deepEqual(draft.requiredActions, ["review-or-import-rebuttal-issues", "normalize-rebuttal-issues"]);
  assert.deepEqual(artifactPaths.map((artifactPath) => {
    const absolutePath = path.join(root, artifactPath);
    return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : null;
  }), beforeArtifacts);
  assert.equal(readState(root).sections.rebuttal.status, "planned");
  });
});

test("CLI rebuttal exits nonzero and writes nothing without normalized issues", () => {
  const root = tempRoot();
  return runDepthMutation(root, () => {
    ensureWorkspace(root);
  initProject(root, {
    title: "CLI Empty Rebuttal Boundary",
    objective: "Expose empty issues as an operational failure.",
    thesis: "CLI must preserve the no-write boundary."
  });
  const packetId = seedTaskPacket(root, "cli-empty-rebuttal-packet");
  const artifactPaths = [
    ".dove/rebuttal/strategy.md",
    ".dove/rebuttal/response-draft.md",
    ".dove/drafts/rebuttal.md"
  ];
  const beforeState = fs.readFileSync(path.join(root, ".dove", "state.json"), "utf8");
  const beforeArtifacts = artifactPaths.map((artifactPath) => {
    const absolutePath = path.join(root, artifactPath);
    return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : null;
  });
  const cli = spawnSync(process.execPath, [path.join(process.cwd(), "bin", "dove.mjs"), "rebuttal", root, "--packet-id", packetId, "--mutation-mode", "direct-process", "--json"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(cli.status, 1, cli.stderr || cli.stdout);
  assert.equal(JSON.parse(cli.stdout).status, "missing-required-materials");
  assert.deepEqual(artifactPaths.map((artifactPath) => {
    const absolutePath = path.join(root, artifactPath);
    return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : null;
  }), beforeArtifacts);
  assert.equal(fs.readFileSync(path.join(root, ".dove", "state.json"), "utf8"), beforeState);
  });
});

test("rebuttal builders still write substantive artifacts for normalized issues", () => {
  const root = tempRoot();
  return runDepthMutation(root, () => {
    ensureWorkspace(root);
  initProject(root, {
    title: "Positive Rebuttal Path",
    objective: "Preserve the issue-backed rebuttal path.",
    thesis: "Normalized issues produce durable responses."
  });
  const packetId = seedTaskPacket(root, "positive-rebuttal-packet");
  normalizeRebuttalIssues(root, {
    packetId,
    issues: [{ id: "real-issue", summary: "Clarify the comparison baseline.", responseDirection: "clarify" }]
  });

  const result = buildRebuttal(root, { packetId });
  assert.equal(result.draftPath, ".dove/drafts/rebuttal.md");
  for (const artifactPath of [result.draftPath, ".dove/rebuttal/strategy.md", ".dove/rebuttal/response-draft.md"]) {
    assert.equal(fs.existsSync(path.join(root, artifactPath)), true, artifactPath);
    assert.match(fs.readFileSync(path.join(root, artifactPath), "utf8"), /real-issue|Rebuttal Notes/u);
  }
  });
});

test("version actions are blocked until coherent review clears finalize gate", () => {
  const root = tempRoot();
  return runDepthMutation(root, () => {
    ensureWorkspace(root);
  initProject(root, {
    title: "Finalize Gate",
    objective: "Verify finalize review gate.",
    thesis: "Review gate should block premature version snapshots."
  });
  seedTaskPacket(root, "finalize-gate-packet");

  const reviewedArtifact = ".dove/drafts/finalize-gate.md";
  fs.mkdirSync(path.dirname(path.join(root, reviewedArtifact)), { recursive: true });
  fs.writeFileSync(path.join(root, reviewedArtifact), "# Finalize gate review material\n", "utf8");
  const packetPath = ".dove/task-packets/packets/finalize-gate-packet.json";
  const packet = JSON.parse(fs.readFileSync(path.join(root, packetPath), "utf8"));
  packet.outputPaths = [reviewedArtifact];
  writeJson(root, packetPath, packet);
  const state = readState(root);
  state.sections.introduction = {
    ...state.sections.introduction,
    status: "drafting",
    draftPath: reviewedArtifact
  };
  writeJson(root, ".dove/state.json", state);
  appendReviewLog(root, {
    packetId: "finalize-gate-packet",
    verdict: "needs-revision",
    summary: "Need coherent review before snapshot.",
    reviewedArtifactPaths: [reviewedArtifact],
    findings: [{ severity: "high", summary: "Review remains unresolved." }],
    actionItems: ["Resolve the review before finalization."]
  });

  appendSystemHandoff(root, {
    fromRole: "reviewer",
    toRole: "version-analyst",
    phase: "versions",
    summary: "Attempting version analysis before the finalize gate is cleared.",
    nextActions: ["Create the blocked snapshot"]
  });

  assert.throws(() => {
    createVersionSnapshot(root, { versionId: "blocked-version" });
  }, /requires a coherent review|final artifact scope|not a usable file|authorized independent Reviewer proof/);
  });
});

test("finalization scope ignores planned targets and includes formed current artifacts", () => {
  const root = tempRoot();
  return runDepthMutation(root, () => {
    ensureWorkspace(root);
    initProject(root, {
      title: "Finalization artifact scope",
      objective: "Review only formed current artifacts.",
      thesis: "Planned paths must not masquerade as final artifacts."
    });

    assert.deepEqual(currentFinalizationArtifactPaths(root), []);

    const draftPath = ".dove/drafts/introduction.md";
    fs.mkdirSync(path.dirname(path.join(root, draftPath)), { recursive: true });
    fs.writeFileSync(path.join(root, draftPath), "# Current introduction\n", "utf8");

    const state = readState(root);
    state.sections.introduction = {
      ...state.sections.introduction,
      status: "drafting",
      draftPath
    };
    writeJson(root, ".dove/state.json", state);

    const plannedFigurePath = ".dove/figures/planned-only.final.svg";
    writeJson(root, ".dove/figures/final-index.json", {
      version: 1,
      items: [{
        id: "planned-only-final",
        figureId: "planned-only",
        finalSvgPath: plannedFigurePath,
        readinessStatus: "needs-review"
      }]
    });

    assert.deepEqual(currentFinalizationArtifactPaths(root), [draftPath]);

    fs.mkdirSync(path.dirname(path.join(root, plannedFigurePath)), {
      recursive: true
    });
    fs.writeFileSync(
      path.join(root, plannedFigurePath),
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>\n',
      "utf8"
    );

    assert.deepEqual(currentFinalizationArtifactPaths(root), [
      draftPath,
      plannedFigurePath
    ]);
  });
});

test("finalization scope rejects missing artifacts already declared final", () => {
  const root = tempRoot();
  return runDepthMutation(root, () => {
    ensureWorkspace(root);
    initProject(root, {
      title: "Finalization artifact integrity",
      objective: "Reject missing formed artifacts.",
      thesis: "Final declarations must remain backed by usable files."
    });

    const state = readState(root);
    state.sections.introduction = {
      ...state.sections.introduction,
      status: "approved",
      draftPath: ".dove/drafts/missing-approved.md"
    };
    writeJson(root, ".dove/state.json", state);

    assert.throws(
      () => currentFinalizationArtifactPaths(root),
      /Current final section introduction has no usable draft artifact/
    );

    state.sections.introduction.status = "planned";
    writeJson(root, ".dove/state.json", state);
    writeJson(root, ".dove/figures/final-index.json", {
      version: 1,
      items: [{
        id: "missing-final",
        figureId: "missing-final",
        finalSvgPath: ".dove/figures/missing-final.svg",
        readinessStatus: "ready-for-finalization"
      }]
    });

    assert.throws(
      () => currentFinalizationArtifactPaths(root),
      /Current final figure missing-final has no usable final artifact/
    );
  });
});

test("public board callers cannot set or clear the system-owned finalize review gate", () => {
  const root = tempRoot();
  return runDepthMutation(root, () => {
    ensureWorkspace(root);
  initProject(root, {
    title: "System-owned review gate",
    objective: "Reject public review gate mutation.",
    thesis: "Only internal review paths control finalization gating."
  });

  for (const value of [true, false]) {
    assert.throws(() => upsertOrchestrationBoard(root, {
      phase: "plan",
      assignedRole: "planner",
      reviewRequiredBeforeFinalize: value
    }), /system-owned field reviewRequiredBeforeFinalize/);
  }
  assert.equal(loadBoard(root).reviewRequiredBeforeFinalize, false);
  });
});

test("board role-phase contract rejects mismatches and retired overrides fail closed", () => {
  const root = tempRoot();
  return runDepthMutation(root, () => {
    ensureWorkspace(root);
  initProject(root, {
    title: "Role Contract",
    objective: "Verify board routing-state validation.",
    thesis: "Explicit handoffs should validate workflow routing transitions without granting mutation authority."
  });

  const handedOffBoard = appendSystemHandoff(root, {
    fromRole: "planner",
    toRole: "researcher",
    phase: "research",
    summary: "Move into research."
  });
  assert.equal(handedOffBoard.currentPhase, "research");
  assert.equal(handedOffBoard.assignedRole, "researcher");

  const updatedBoard = upsertSystemOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "builder",
    currentFocus: "Continue legal research work."
  });
  assert.equal(updatedBoard.currentPhase, "research");
  assert.equal(updatedBoard.assignedRole, "builder");

  assert.throws(() => {
    upsertOrchestrationBoard(root, {
      phase: "review",
      assignedRole: "planner"
    });
  }, /cannot transfer board ownership/);

  assert.throws(() => upsertOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "builder",
    policyOverrideReason: "manual board repair after importing an older workspace"
  }), /does not accept retired policy override fields/);

  const handoffs = fs.readFileSync(path.join(root, ".dove", "orchestration", "handoffs.md"), "utf8");
  assert.doesNotMatch(handoffs, /Policy override:/);
  });
});
