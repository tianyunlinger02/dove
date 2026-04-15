import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  GOVERNANCE_EXEMPT_MUTATIONS,
  GOVERNANCE_GUARDED_MUTATIONS,
  GOVERNANCE_NEGATIVE_COVERAGE,
  ensureWorkspace,
  initProject,
  queryMetaOptimize,
  queryOperatorFollowThrough,
  readState,
  readJson,
  recordOperatorFollowThrough,
  refreshWiki,
  registerSource,
  updateResearchBrief,
  appendHandoff,
  appendReviewLog,
  buildRebuttal,
  buildRebuttalStrategy,
  bridgeExperimentResultToClaim,
  compareVersions,
  createVersionSnapshot,
  normalizeRebuttalIssues,
  upsertClaims,
  upsertDraft,
  upsertExperimentPlan,
  upsertExperimentResult,
  upsertOutline,
  upsertPlan,
  upsertRevisionPlan,
  upsertNote,
  runExperimentAudit,
  runReviewLoop,
  setSectionStatus,
  syncCitations,
  upsertFigurePlan,
  queryWorkspaceIndex,
  validateFigurePipeline,
  upsertOrchestrationBoard,
  writeJson
} from "../../src/core/index.mjs";
import { toolDefinitions } from "../../src/mcp/tool-definitions.mjs";
import { createMetaExecutionBridgeCandidatesIndex, createMetaLongHorizonMemory, createMetaOperatorPlaybooksIndex, createMetaOptimizerState, createMetaRemediationPacksIndex } from "../../src/core/schema.mjs";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-phase6-"));
}

test("ensureWorkspace reconciles managed artifact metadata and structure for boundaries and workspace index", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.workflowBoundaries), JSON.stringify({
    version: 1,
    managedPaths: "bad-shape",
    userOwnedPaths: [".paper/drafts"],
    managedArtifacts: {
      workflowBoundaries: { revisionId: "legacy" }
    },
    notes: ["legacy note"]
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.workspaceIndex), JSON.stringify({
    version: 1,
    currentFocus: "Legacy focus",
    workQueues: { ready: "bad-shape" },
    managed: { revisionId: "legacy-workspace" },
    metaOptimize: {
      proposalOnly: true,
      topClusterIds: "bad-shape",
      longHorizon: "bad-shape"
    }
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaRecommendations), JSON.stringify({
    version: 1,
    items: [{ id: "legacy-rec" }],
    clusters: "bad-shape",
    ranking: { method: "legacy", tieBreakOrder: "bad-shape" },
    frontier: { recommendationCount: 1, topClusterIds: "bad-shape" },
    summary: { topClusters: "bad-shape", clusterMembership: { legacy: "bad-shape" } }
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerState), JSON.stringify({
    version: 1,
    sourceArtifacts: "bad-shape",
    frontier: { recommendationCount: 1, topClusters: "bad-shape", tieBreakOrder: "bad-shape" },
    clusters: "bad-shape",
    longHorizon: { topFamilyIds: "bad-shape" }
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaLongHorizonMemory), JSON.stringify({
    version: 1,
    historyWindowSize: "bad-shape",
    horizon: "bad-shape",
    summary: { topFamilyIds: "bad-shape" },
    history: "bad-shape",
    families: "bad-shape"
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaRemediationPacks), JSON.stringify({
    version: 1,
    proposalOnly: true,
    packs: "bad-shape",
    summary: { topPackIds: "bad-shape", topClusterIds: "bad-shape" }
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorPlaybooks), JSON.stringify({
    version: 1,
    proposalOnly: true,
    playbooks: "bad-shape",
    summary: { topPlaybookIds: "bad-shape", topTaxonomyFamilyIds: "bad-shape" }
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaExecutionBridgeCandidates), JSON.stringify({
    version: 1,
    proposalOnly: true,
    candidates: "bad-shape",
    summary: { topCandidateIds: "bad-shape" }
  }, null, 2));

  ensureWorkspace(root);

  const boundaries = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.workflowBoundaries), "utf8"));
  const workspaceIndex = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.workspaceIndex), "utf8"));
  const recommendations = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaRecommendations), "utf8"));
  const optimizerState = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerState), "utf8"));
  const longHorizonMemory = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaLongHorizonMemory), "utf8"));
  const remediationPacks = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaRemediationPacks), "utf8"));
  const operatorPlaybooks = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorPlaybooks), "utf8"));
  const executionBridgeCandidates = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaExecutionBridgeCandidates), "utf8"));

  assert.equal(boundaries.version, 3);
  assert.equal(boundaries.managedArtifacts.workflowBoundaries.revisionId, "schema-v5:bootstrap-only");
  assert.equal(boundaries.managedArtifacts.workspaceIndex.path, ".paper/workspace/index.json");
  assert.deepEqual(boundaries.managedPaths, [".opencode", ".opencode.json", "README.md", "bin", "docs", "mcp", "scripts", "src"]);
  assert.deepEqual(boundaries.notes, ["legacy note"]);

  assert.equal(workspaceIndex.version, 7);
  assert.equal(workspaceIndex.managed.revisionId, "schema-v5:bootstrap-only");
  assert.equal(workspaceIndex.currentFocus, "Legacy focus");
  assert.deepEqual(workspaceIndex.workQueues.ready, []);
  assert.deepEqual(workspaceIndex.resumeGuidance.prioritizedPacketIds, []);
  assert.equal(workspaceIndex.behaviorDiscipline.explicitOnly, true);
  assert.equal(workspaceIndex.repairFrontier.count, 0);
  assert.deepEqual(workspaceIndex.repairFrontier.topDegradedGroupIds, []);
  assert.equal(workspaceIndex.metaOptimize.proposalOnly, true);
  assert.equal(workspaceIndex.metaOptimize.reportPath, ".paper/meta/LATEST_OPTIMIZER_REPORT.md");
  assert.equal(workspaceIndex.metaOptimize.rankingMethod, "durable-signal-frontier-v1");
  assert.deepEqual(workspaceIndex.metaOptimize.tieBreakOrder, ["score-desc", "priority-rank", "cluster-rank", "cluster-id", "category", "id"]);
  assert.equal(workspaceIndex.metaOptimize.longHorizonPath, ".paper/meta/long-horizon-memory.json");
  assert.deepEqual(workspaceIndex.metaOptimize.topTaxonomyFamilyIds, []);
  assert.deepEqual(workspaceIndex.metaOptimize.topTaxonomyGroupIds, []);
  assert.deepEqual(workspaceIndex.metaOptimize.pressureAreas, []);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.memoryPath, ".paper/meta/long-horizon-memory.json");
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.packCount, 0);
  assert.deepEqual(workspaceIndex.metaOptimize.remediationPacks.topPackIds, []);
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.readinessOverview, "No proposal-only remediation packs have been generated yet.");
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.packsPath, ARTIFACT_PATHS.metaRemediationPacks);
  assert.equal(workspaceIndex.metaOptimize.operatorPlaybooks.playbookCount, 0);
  assert.deepEqual(workspaceIndex.metaOptimize.operatorPlaybooks.topPlaybookIds, []);
  assert.equal(workspaceIndex.metaOptimize.operatorPlaybooks.readinessOverview, "No proposal-only family-level operator playbooks have been generated yet.");
  assert.equal(workspaceIndex.metaOptimize.operatorPlaybooks.playbooksPath, ARTIFACT_PATHS.metaOperatorPlaybooks);
  assert.deepEqual(workspaceIndex.metaOptimize.topClusterIds, []);
  assert.deepEqual(workspaceIndex.metaOptimize.longHorizon.topFamilyIds, []);
  assert.deepEqual(workspaceIndex.metaOptimize.longHorizon.topTaxonomyFamilyIds, []);
  assert.deepEqual(workspaceIndex.metaOptimize.longHorizon.topTaxonomyGroupIds, []);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.snapshotCount, 0);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.lastAction, "unchanged");

  assert.equal(recommendations.version, 3);
  assert.equal(recommendations.items[0].id, "legacy-rec");
  assert.deepEqual(recommendations.clusters, []);
  assert.deepEqual(recommendations.ranking.tieBreakOrder, ["score-desc", "priority-rank", "cluster-rank", "cluster-id", "category", "id"]);
  assert.deepEqual(recommendations.frontier.topClusterIds, []);
  assert.deepEqual(recommendations.frontier.topTaxonomyFamilyIds, []);
  assert.deepEqual(recommendations.frontier.topTaxonomyGroupIds, []);
  assert.deepEqual(recommendations.summary.topClusters, []);
  assert.deepEqual(recommendations.summary.clusterMembership, { legacy: [] });

  assert.equal(optimizerState.version, 5);
  assert.deepEqual(optimizerState.sourceArtifacts, createMetaOptimizerState().sourceArtifacts);
  assert.deepEqual(optimizerState.frontier.topClusters, []);
  assert.deepEqual(optimizerState.frontier.tieBreakOrder, ["score-desc", "priority-rank", "cluster-rank", "cluster-id", "category", "id"]);
  assert.deepEqual(optimizerState.frontier.topTaxonomyFamilyIds, []);
  assert.deepEqual(optimizerState.frontier.topTaxonomyGroupIds, []);
  assert.deepEqual(optimizerState.clusters, []);
  assert.deepEqual(optimizerState.longHorizon.topFamilyIds, []);
  assert.deepEqual(optimizerState.longHorizon.topTaxonomyFamilyIds, []);
  assert.deepEqual(optimizerState.longHorizon.topTaxonomyGroupIds, []);
  assert.equal(optimizerState.longHorizon.snapshotCount, 0);
  assert.equal(optimizerState.longHorizon.lastAction, "unchanged");
  assert.equal(optimizerState.remediationPacks.packCount, 0);
  assert.deepEqual(optimizerState.remediationPacks.topPackIds, []);
  assert.equal(optimizerState.remediationPacks.readinessOverview, "No proposal-only remediation packs have been generated yet.");
  assert.equal(optimizerState.remediationPacks.packsPath, ARTIFACT_PATHS.metaRemediationPacks);
  assert.equal(optimizerState.operatorPlaybooks.playbookCount, 0);
  assert.deepEqual(optimizerState.operatorPlaybooks.topPlaybookIds, []);
  assert.equal(optimizerState.operatorPlaybooks.readinessOverview, "No proposal-only family-level operator playbooks have been generated yet.");
  assert.equal(optimizerState.operatorPlaybooks.playbooksPath, ARTIFACT_PATHS.metaOperatorPlaybooks);

  assert.equal(longHorizonMemory.version, 1);
  assert.equal(longHorizonMemory.historyWindowSize, 30);
  assert.deepEqual(longHorizonMemory.horizon, createMetaLongHorizonMemory().horizon);
  assert.deepEqual(longHorizonMemory.summary.topFamilyIds, []);
  assert.deepEqual(longHorizonMemory.summary.topTaxonomyFamilyIds, []);
  assert.deepEqual(longHorizonMemory.summary.topTaxonomyGroupIds, []);
  assert.equal(longHorizonMemory.summary.snapshotCount, 0);
  assert.equal(longHorizonMemory.summary.lastAction, "unchanged");
  assert.equal(longHorizonMemory.historyPolicy.mode, "deterministic-noop-drift-guard-v1");
  assert.deepEqual(longHorizonMemory.history, []);
  assert.deepEqual(longHorizonMemory.families, []);

  assert.equal(remediationPacks.version, 1);
  assert.deepEqual(remediationPacks.packs, []);
  assert.deepEqual(remediationPacks.summary.topPackIds, []);
  assert.deepEqual(remediationPacks.summary.topClusterIds, []);
  assert.equal(remediationPacks.summary.readinessOverview, "No proposal-only remediation packs have been generated yet.");
  assert.equal(remediationPacks.summary.packsPath, ARTIFACT_PATHS.metaRemediationPacks);
  assert.deepEqual(remediationPacks.sourceArtifacts, createMetaRemediationPacksIndex().sourceArtifacts);

  assert.equal(operatorPlaybooks.version, 1);
  assert.deepEqual(operatorPlaybooks.playbooks, []);
  assert.deepEqual(operatorPlaybooks.summary.topPlaybookIds, []);
  assert.equal(operatorPlaybooks.summary.readinessOverview, "No proposal-only family-level operator playbooks have been generated yet.");
  assert.equal(operatorPlaybooks.summary.playbooksPath, ARTIFACT_PATHS.metaOperatorPlaybooks);
  assert.deepEqual(operatorPlaybooks.sourceArtifacts, createMetaOperatorPlaybooksIndex().sourceArtifacts);

  assert.equal(executionBridgeCandidates.version, 1);
  assert.deepEqual(executionBridgeCandidates.candidates, []);
  assert.deepEqual(executionBridgeCandidates.summary.topCandidateIds, []);
  assert.equal(executionBridgeCandidates.summary.candidatesPath, ARTIFACT_PATHS.metaExecutionBridgeCandidates);
  assert.deepEqual(executionBridgeCandidates.sourceArtifacts, createMetaExecutionBridgeCandidatesIndex().sourceArtifacts);
});

test("queryMetaOptimize carries forward legacy long-horizon history while rewriting normalized meta surfaces", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Legacy Meta", objective: "Normalize legacy meta artifacts through explicit refresh." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "legacy-review-gap",
      summary: "Legacy concern persists.",
      severity: "high",
      status: "escalated",
      responseOwnerRole: "researcher",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaLongHorizonMemory), JSON.stringify({
    version: 1,
    proposalOnly: true,
    historyWindowSize: 12,
    horizon: { reviewRoundsObserved: 1 },
    summary: {
      familyCount: 1,
      recurringFamilyCount: 0,
      risingFamilyCount: 0,
      stableFamilyCount: 1,
      coolingFamilyCount: 0,
      topFamilyIds: ["review-recurrence"],
      overview: "Legacy memory overview."
    },
    history: [{
      observedAt: "2026-01-01T00:00:00.000Z",
      frontierScore: 1,
      recommendationCount: 1,
      criticalCount: 0,
      clusterCount: 1,
      topClusterIds: ["review-closure"],
      topRecommendationIds: ["legacy-rec"],
      familyCounts: { "review-recurrence": 1 },
      familyTopRecommendationIds: { "review-recurrence": ["legacy-rec"] },
      familyTopClusterIds: { "review-recurrence": ["review-closure"] }
    }],
    families: [{
      id: "review-recurrence",
      label: "Review recurrence",
      summary: "Legacy family summary.",
      currentCount: 1,
      totalCount: 1,
      activeSnapshotCount: 1,
      recurring: false,
      trend: { status: "stable", recentCount: 1, previousCount: 0 },
      topRecommendationIds: ["legacy-rec"],
      topClusterIds: ["review-closure"],
      relatedRecommendationIds: ["legacy-rec"],
      evidenceArtifactPaths: [ARTIFACT_PATHS.reviewConcerns],
      signalTypes: ["review-concern"],
      firstObservedAt: "2026-01-01T00:00:00.000Z",
      lastObservedAt: "2026-01-01T00:00:00.000Z"
    }],
    updatedAt: "2026-01-01T00:00:00.000Z"
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaRecommendations), JSON.stringify({
    version: 1,
    items: [],
    ranking: { method: "legacy-ranking" },
    summary: { topClusterIds: ["legacy-cluster"] }
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerState), JSON.stringify({
    version: 1,
    frontier: { recommendationCount: 99, topClusterIds: ["legacy-cluster"] },
    longHorizon: { overview: "Legacy state overview." }
  }, null, 2));

  const result = queryMetaOptimize(root);
  const longHorizonMemory = readJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, createMetaLongHorizonMemory);
  const workspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { version: 7 });

  assert.equal(result.proposalOnly, true);
  assert.equal(longHorizonMemory.history.length >= 2, true);
  assert.equal(longHorizonMemory.historyWindowSize, 12);
  assert.equal(longHorizonMemory.history[0].observedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(longHorizonMemory.summary.topFamilyIds.includes("review-recurrence"), true);
  assert.equal(longHorizonMemory.summary.snapshotCount, longHorizonMemory.history.length);
  assert.equal(longHorizonMemory.summary.lastAction, "append");
  assert.equal(result.longHorizon.history.length, longHorizonMemory.history.length);
  assert.equal(workspaceIndex.metaOptimize.recommendationCount, result.recommendations.length);
  assert.equal(workspaceIndex.metaOptimize.clusterCount, result.clusters.length);
  assert.equal(workspaceIndex.metaOptimize.longHorizonPath, ARTIFACT_PATHS.metaLongHorizonMemory);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.snapshotCount, longHorizonMemory.summary.snapshotCount);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.lastAction, longHorizonMemory.summary.lastAction);
});

test("queryMetaOptimize avoids long-horizon history drift on repeated no-op refreshes", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Meta No-op Drift", objective: "Avoid long-horizon history churn from repeated meta refreshes." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "repeat-review-gap",
      summary: "A recurring review concern remains open.",
      severity: "high",
      status: "escalated",
      responseOwnerRole: "researcher",
      recurrenceCount: 3,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the recurring review concern."],
    unresolvedConcernIds: ["repeat-review-gap"],
    escalatedConcernIds: ["repeat-review-gap"],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 3,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["researcher"], separationMaintained: true }
  });

  const first = queryMetaOptimize(root);
  const firstMemory = readJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, createMetaLongHorizonMemory);
  const firstSnapshotCount = firstMemory.summary.snapshotCount;
  const firstObservedAt = firstMemory.summary.lastObservedAt;
  const firstOverview = firstMemory.summary.overview;
  const firstFamilyIds = firstMemory.summary.topFamilyIds;

  const second = queryMetaOptimize(root);
  const secondMemory = readJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, createMetaLongHorizonMemory);
  const secondWorkspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { version: 7 });
  const secondOptimizerState = readJson(root, ARTIFACT_PATHS.metaOptimizerState, { version: 4, frontier: {}, longHorizon: {} });

  assert.equal(firstMemory.history.length >= 1, true);
  assert.equal(secondMemory.history.length, firstMemory.history.length);
  assert.equal(secondMemory.summary.snapshotCount, firstSnapshotCount);
  assert.equal(secondMemory.summary.lastObservedAt, firstObservedAt);
  assert.equal(secondMemory.summary.overview, firstOverview);
  assert.deepEqual(secondMemory.summary.topFamilyIds, firstFamilyIds);
  assert.equal(secondMemory.summary.lastAction, "unchanged");
  assert.equal(secondMemory.historyPolicy.lastAction, "unchanged");
  assert.equal(secondMemory.historyPolicy.mode, "deterministic-noop-drift-guard-v1");
  assert.equal(second.frontier.frontierSummary, first.frontier.frontierSummary);
  assert.equal(secondOptimizerState.longHorizon.snapshotCount, secondMemory.summary.snapshotCount);
  assert.equal(secondOptimizerState.longHorizon.lastAction, secondMemory.summary.lastAction);
  assert.equal(secondWorkspaceIndex.metaOptimize.longHorizon.snapshotCount, secondMemory.summary.snapshotCount);
  assert.equal(secondWorkspaceIndex.metaOptimize.longHorizon.lastAction, secondMemory.summary.lastAction);
});

test("queryMetaOptimize builds proposal-only recommendations from durable review, audit, bridge, and repair signals", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Meta Frontier", objective: "Surface optimizer recommendations from durable signals." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "review-gap-1",
      summary: "Reviewer concern keeps recurring.",
      severity: "high",
      status: "escalated",
      responseOwnerRole: "researcher",
      recurrenceCount: 3,
      linkedAuditIds: ["audit-1"],
      linkedBridgeIds: ["bridge-1"],
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.adversarialReviewState, {
    version: 2,
    round: 3,
    unresolvedConcernIds: ["review-gap-1"],
    escalatedConcernIds: ["review-gap-1"],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    concernStatusCounts: { escalated: 1 },
    escalationThresholds: { high: 1, medium: 2, low: 3 },
    lastAuditIds: ["audit-1"],
    lastBridgeIds: ["bridge-1"],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Repair the recurring review concern."],
    unresolvedConcernIds: ["review-gap-1"],
    escalatedConcernIds: ["review-gap-1"],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 3,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["researcher"], separationMaintained: true }
  });
  writeJson(root, ARTIFACT_PATHS.experimentAudits, {
    version: 1,
    items: [{
      id: "audit-1",
      experimentId: "exp-1",
      resultId: "result-1",
      integrityFlags: ["missing-reviewed-artifact-refs"],
      auditVerdict: "blocked",
      confidence: "low",
      reviewedArtifactRefs: []
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.claimBridgeLog, {
    version: 1,
    items: [{
      id: "bridge-1",
      experimentId: "exp-1",
      resultId: "result-1",
      claimId: "claim-1",
      auditIds: ["audit-1"],
      auditVerdict: "blocked",
      integrityFlags: ["missing-reviewed-artifact-refs"],
      bridgeStatus: "held-for-review",
      reason: "Audit is blocked."
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.figureQa, {
    version: 1,
    items: [],
    issues: [{
      id: "figure-issue-1",
      figureId: "figure-1",
      code: "missing-final-svg",
      severity: "high",
      summary: "Final SVG is missing.",
      artifactPaths: [ARTIFACT_PATHS.figureQa]
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.versionComparisons, {
    version: 1,
    items: [{
      id: "v1-vs-v2",
      fromVersionId: "v1",
      toVersionId: "v2",
      unresolvedConcernsAdded: ["review-gap-1"],
      unresolvedConcernsRemoved: []
    }],
    activeTargets: ["v1", "v2"],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.sessionJournal, {
    version: 1,
    entries: [
      { id: "old-1", timestamp: "2026-01-01T00:00:00.000Z", type: "append-review-log", summary: "Older review pass.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewState] },
      { id: "old-2", timestamp: "2026-01-02T00:00:00.000Z", type: "run-review-loop", summary: "Older review loop.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewLog] },
      { id: "old-3", timestamp: "2026-01-03T00:00:00.000Z", type: "query-meta-optimize", summary: "Older optimizer check.", phase: "review", assignedRole: "planner", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.metaOptimizerReport] },
      { id: "recent-1", timestamp: "2026-01-04T00:00:00.000Z", type: "append-review-log", summary: "Recent review pass.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewState] },
      { id: "recent-2", timestamp: "2026-01-05T00:00:00.000Z", type: "run-review-loop", summary: "Recent review loop.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewLog] },
      { id: "recent-3", timestamp: "2026-01-06T00:00:00.000Z", type: "append-review-log", summary: "Recent review pass again.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewState] },
      { id: "recent-4", timestamp: "2026-01-07T00:00:00.000Z", type: "run-review-loop", summary: "Recent review loop again.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewLog] },
      { id: "recent-5", timestamp: "2026-01-08T00:00:00.000Z", type: "query-meta-optimize", summary: "Recent optimizer check.", phase: "review", assignedRole: "planner", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.metaOptimizerReport] },
      { id: "recent-6", timestamp: "2026-01-09T00:00:00.000Z", type: "append-review-log", summary: "Recent review pass third.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewState] }
    ],
    updatedAt: null
  });

  const result = queryMetaOptimize(root);
  const longHorizonMemory = readJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, { version: 1, summary: {}, history: [], families: [], updatedAt: null });
  const executionBridgeCandidates = readJson(root, ARTIFACT_PATHS.metaExecutionBridgeCandidates, createMetaExecutionBridgeCandidatesIndex);
  const operatorPlaybooks = readJson(root, ARTIFACT_PATHS.metaOperatorPlaybooks, createMetaOperatorPlaybooksIndex);
  const recommendations = readJson(root, ARTIFACT_PATHS.metaRecommendations, { version: 1, items: [], summary: {}, updatedAt: null });
  const optimizerState = readJson(root, ARTIFACT_PATHS.metaOptimizerState, { version: 1, frontier: {}, updatedAt: null });
  const remediationPacks = readJson(root, ARTIFACT_PATHS.metaRemediationPacks, createMetaRemediationPacksIndex);
  const report = fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerReport), "utf8");
  const workspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { version: 7 });
  const sessionSummary = fs.readFileSync(path.join(root, ARTIFACT_PATHS.sessionSummary), "utf8");

  assert.equal(result.proposalOnly, true);
  assert.equal(result.executionBridgeCandidates.proposalOnly, true);
  assert.ok(Array.isArray(result.clusters));
  assert.equal(result.groupedFrontier.ranking.method, "durable-signal-frontier-v1");
  assert.ok(Array.isArray(result.groupedFrontier.topClusters));
  assert.equal(result.longHorizon.proposalOnly, true);
  assert.equal(result.longHorizon.families.find((item) => item.id === "review-recurrence")?.trend.status, "rising");
  assert.equal(result.groupedFrontier.clusterMembership["review-closure"].includes("meta-review-review-gap-1"), true);
  assert.equal(result.clusters[0].id, "evidence-integrity");
  assert.equal(result.recommendations[0].id, "meta-review-review-gap-1");
  assert.ok(result.recommendations.some((item) => item.category === "review-discipline"));
  assert.ok(result.recommendations.some((item) => item.category === "experiment-integrity"));
  assert.ok(result.recommendations.some((item) => item.category === "claim-bridge"));
  assert.ok(result.recommendations.some((item) => item.category === "artifact-health"));
  assert.equal(result.frontier.clusterCount, recommendations.clusters.length);
  assert.ok(recommendations.summary.criticalCount >= 1);
  assert.ok(recommendations.summary.clusterCount >= 3);
  assert.equal(recommendations.frontier.topClusterIds[0], "evidence-integrity");
  assert.equal(recommendations.frontier.rankingMethod, "durable-signal-frontier-v1");
  assert.match(recommendations.frontier.frontierSummary, /ranked recommendations across/);
  assert.equal(recommendations.summary.topClusters[0].id, "evidence-integrity");
  assert.equal(recommendations.summary.clusterMembership["review-closure"].includes("meta-review-review-gap-1"), true);
  assert.match(recommendations.items[0].sortKey, /^\d{4}:\d{2}:/);
  assert.match(recommendations.items[0].tieBreakKey, /^\d{4}:\d{2}:/);
  assert.ok(Array.isArray(recommendations.items[0].rankingBasis));
  assert.equal(optimizerState.proposalOnly, true);
  assert.equal(optimizerState.frontier.clusterCount, recommendations.clusters.length);
  assert.equal(optimizerState.frontier.reportPath, ARTIFACT_PATHS.metaOptimizerReport);
  assert.equal(optimizerState.frontier.rankingMethod, "durable-signal-frontier-v1");
  assert.equal(optimizerState.frontier.longHorizonPath, ARTIFACT_PATHS.metaLongHorizonMemory);
  assert.equal(optimizerState.frontier.topClusters[0].id, "evidence-integrity");
  assert.equal(optimizerState.longHorizon.memoryPath, ARTIFACT_PATHS.metaLongHorizonMemory);
  assert.equal(optimizerState.longHorizon.snapshotCount, longHorizonMemory.summary.snapshotCount);
  assert.equal(optimizerState.longHorizon.lastAction, longHorizonMemory.summary.lastAction);
  assert.ok(Array.isArray(longHorizonMemory.history));
  assert.equal(longHorizonMemory.history.length >= 1, true);
  assert.equal(longHorizonMemory.families.find((item) => item.id === "review-recurrence")?.trend.status, "rising");
  assert.equal(longHorizonMemory.summary.snapshotCount, longHorizonMemory.history.length);
  assert.match(report, /Proposal only: true/);
  assert.match(report, /Optimization frontier/);
  assert.match(report, /Meta-optimize frontier summary:/);
  assert.match(report, /Long-horizon workflow memory/);
  assert.match(report, /Long-horizon snapshots:/);
  assert.match(report, /Long-horizon last action:/);
  assert.match(report, /Long-horizon history policy:/);
  assert.match(report, /Cluster 1: Evidence integrity/);
  assert.match(report, /Evidence-backed recommendations/);
  assert.match(report, /Execution bridge candidate scaffolds/);
  assert.match(report, /Stable tie-break order/);
  assert.match(report, /Ranking basis:/);
  assert.equal(workspaceIndex.metaOptimize.proposalOnly, true);
  assert.equal(workspaceIndex.metaOptimize.recommendationCount, recommendations.items.length);
  assert.equal(workspaceIndex.metaOptimize.clusterCount, recommendations.clusters.length);
  assert.equal(workspaceIndex.metaOptimize.topClusterIds[0], "evidence-integrity");
  assert.equal(workspaceIndex.metaOptimize.topClusters[0].id, "evidence-integrity");
  assert.equal(workspaceIndex.metaOptimize.frontierSummary, recommendations.frontier.frontierSummary);
  assert.equal(workspaceIndex.metaOptimize.longHorizonPath, ARTIFACT_PATHS.metaLongHorizonMemory);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.familyCount >= 3, true);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.snapshotCount, longHorizonMemory.summary.snapshotCount);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.lastAction, longHorizonMemory.summary.lastAction);
  assert.equal(workspaceIndex.metaOptimize.executionBridgeCandidates.candidateCount, executionBridgeCandidates.summary.candidateCount);
  assert.equal(remediationPacks.proposalOnly, true);
  assert.equal(remediationPacks.summary.packCount >= 3, true);
  assert.equal(remediationPacks.summary.topClusterIds[0], "evidence-integrity");
  assert.equal(remediationPacks.summary.packsPath, ARTIFACT_PATHS.metaRemediationPacks);
  assert.equal(executionBridgeCandidates.summary.candidateCount > 0, true);
  assert.equal(result.executionBridgeCandidates.summary.candidateCount, executionBridgeCandidates.summary.candidateCount);
  assert.equal(executionBridgeCandidates.candidates[0].proposalOnly, true);
  assert.equal(executionBridgeCandidates.candidates[0].noAutoApply, true);
  assert.equal(Array.isArray(executionBridgeCandidates.candidates[0].context.linkedPacketPointers), true);
  assert.equal(Array.isArray(executionBridgeCandidates.candidates[0].context.linkedWorkspacePointers), true);
  assert.equal(Array.isArray(executionBridgeCandidates.candidates[0].context.linkedRemediationPacks), true);
  assert.equal(Array.isArray(executionBridgeCandidates.candidates[0].context.linkedPlaybooks), true);
  assert.ok(["packet-candidate", "checklist-candidate", "revision-plan-candidate", "review-follow-up-candidate", "figure-follow-up-candidate"].includes(executionBridgeCandidates.candidates[0].candidateType));
  assert.equal(remediationPacks.packs[0].proposalOnly, true);
  assert.equal(remediationPacks.packs[0].explicitOnly, true);
  assert.equal(remediationPacks.packs[0].noAutoApply, true);
  assert.equal(remediationPacks.packs[0].clusterId, "evidence-integrity");
  assert.equal(remediationPacks.packs[0].frontier.recommendationIds.includes("meta-bridge-bridge-1"), true);
  assert.equal(remediationPacks.packs[0].frontier.recommendationIds.includes("meta-audit-audit-1"), true);
  assert.equal(remediationPacks.packs[0].reviewConcerns.some((item) => item.id === "review-gap-1"), true);
  assert.equal(remediationPacks.packs.some((pack) => pack.figureQa.some((item) => item.id === "figure-issue-1")), true);
  assert.equal(remediationPacks.packs.some((pack) => pack.longHorizonMemory.some((item) => item.id === "review-recurrence")), true);
  assert.equal(remediationPacks.packs[0].workspacePointers.includes(ARTIFACT_PATHS.workspaceIndex), true);
  assert.equal(remediationPacks.packs[0].acceptanceCriteria.length > 0, true);
  assert.equal(remediationPacks.packs[0].conversionHints.length > 0, true);
  assert.equal(remediationPacks.packs[0].rankedConversionPaths.length > 1, true);
  assert.equal(["actionable", "partially-actionable", "advisory-only"].includes(remediationPacks.packs[0].readiness.operatorReadiness), true);
  assert.ok(Array.isArray(remediationPacks.packs[0].readiness.missingIngredients));
  assert.equal(remediationPacks.packs[0].rankedConversionPaths[0].rank, 1);
  assert.ok(remediationPacks.packs[0].rankedConversionPaths[0].pathScore >= remediationPacks.packs[0].rankedConversionPaths[1].pathScore);
  assert.equal(remediationPacks.packs[0].conversionHints.some((hint) => ["create-new-packet", "update-existing-packet", "add-checklist-entry", "add-revision-item"].includes(hint.targetType)), true);
  assert.equal(remediationPacks.packs[0].manualNextActions.length > 0, true);
  assert.equal(result.remediationPacks.summary.packCount, remediationPacks.summary.packCount);
  assert.equal(result.remediationPacks.packs[0].clusterId, remediationPacks.packs[0].clusterId);
  assert.equal(operatorPlaybooks.proposalOnly, true);
  assert.equal(operatorPlaybooks.summary.playbookCount, 0);
  assert.equal(result.operatorPlaybooks.summary.playbookCount, operatorPlaybooks.summary.playbookCount);
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.packCount, remediationPacks.summary.packCount);
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.topPackIds[0], remediationPacks.summary.topPackIds[0]);
  assert.match(workspaceIndex.metaOptimize.remediationPacks.readinessOverview, /actionable|advisory|partially/i);
  assert.equal(workspaceIndex.metaOptimize.operatorPlaybooks.playbookCount, operatorPlaybooks.summary.playbookCount);
  assert.match(workspaceIndex.metaOptimize.operatorPlaybooks.readinessOverview, /actionable|advisory|partially|No proposal-only family-level operator playbooks/i);
  assert.match(sessionSummary, /Long-horizon memory:/);
  assert.match(sessionSummary, /Meta-optimize frontier summary:/);
  assert.match(sessionSummary, /Remediation packs:/);
  assert.match(sessionSummary, /Remediation pack readiness:/);
  assert.match(sessionSummary, /Family playbooks:/);
  assert.match(sessionSummary, /Family playbook readiness:/);
  assert.match(sessionSummary, /Remediation packs path:/);
  assert.match(sessionSummary, /Family playbooks path:/);
  assert.match(sessionSummary, /Long-horizon snapshots:/);
  assert.match(sessionSummary, /Long-horizon last action:/);
  assert.match(sessionSummary, /Long-horizon memory path:/);
  assert.match(report, /Remediation packs/);
  assert.match(report, /Family-level operator playbooks/);
  assert.match(report, /Readiness:/);
  assert.match(report, /Missing ingredients:/);
  assert.match(report, /Acceptance criteria:/);
  assert.match(report, /Conversion hints:/);
  assert.match(report, /Manual next actions:/);
});

test("queryMetaOptimize uses stable id tie-breaking for equal-scored recommendations inside a cluster", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Meta Tie Breaks", objective: "Keep equal-scored optimizer recommendations deterministic." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [
      {
        id: "alpha",
        summary: "Recurring alpha concern.",
        severity: "medium",
        status: "open",
        responseOwnerRole: "researcher",
        recurrenceCount: 2,
        linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
        updatedAt: new Date(0).toISOString()
      },
      {
        id: "beta",
        summary: "Recurring beta concern.",
        severity: "medium",
        status: "open",
        responseOwnerRole: "researcher",
        recurrenceCount: 2,
        linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
        updatedAt: new Date(0).toISOString()
      }
    ],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-revision",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close recurring concerns."],
    unresolvedConcernIds: ["alpha", "beta"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 2,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["researcher"], separationMaintained: true }
  });

  const result = queryMetaOptimize(root);
  const recurring = result.recommendations.filter((item) => item.clusterId === "review-closure");

  assert.equal(recurring[0].id, "meta-recurring-review-alpha");
  assert.equal(recurring[1].id, "meta-recurring-review-beta");
  assert.equal(recurring[0].score, recurring[1].score);
  assert.ok(recurring[0].sortKey < recurring[1].sortKey);
  assert.ok(recurring[0].tieBreakKey < recurring[1].tieBreakKey);
});

test("refreshWiki records typed relation integrity failures and exposes them through the workspace repair frontier", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Relation Frontier", objective: "Track degraded typed wiki relations." });

  registerSource(root, { citationKey: "relation-source", title: "Relation Source", authors: ["Lee"], year: 2026 });
  upsertNote(root, { noteId: "note-main", title: "Frontier note", sectionId: "introduction", sourceIds: ["relation-source"], summary: "Source-backed note." });
  writeJson(root, ARTIFACT_PATHS.sources, {
    version: 1,
    items: [{ id: "experiment-bad-exp", citationKey: "bad-exp-source", title: "Wrong endpoint type", authors: [], year: 2026, sourceType: "paper", abstract: "", origin: "manual", addedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{
      id: "claim-frontier",
      text: "Relation integrity should surface repair work.",
      sectionId: "introduction",
      status: "supported",
      confidence: "medium",
      sourceIds: ["missing-source"],
      noteIds: ["missing-note"],
      experimentIds: ["bad-exp"]
    }],
    updatedAt: null
  });

  refreshWiki(root);

  const relations = readJson(root, ARTIFACT_PATHS.wikiRelations, { version: 3, items: [], summary: {}, updatedAt: null });
  const workspaceIndex = queryWorkspaceIndex(root);
  const degradedRelation = relations.items.find((item) => item.id === "claim-frontier-tested-by-bad-exp");
  const degradedFamily = relations.summary.taxonomy?.families?.find((item) => item.id === "validation-loop");
  const degradedReasonCodes = new Set(relations.items.flatMap((item) => (item.integrity?.reasons ?? []).map((reason) => reason.code)));

  assert.equal(relations.version, 3);
  assert.equal(relations.summary.degradedCount > 0, true);
  assert.equal(degradedRelation.integrity.status, "degraded");
  assert.equal(degradedRelation.semantics.expectedToEntityType, "experiment");
  assert.equal(degradedRelation.taxonomy.familyId, "validation-loop");
  assert.equal(degradedRelation.taxonomy.groupId, "claim-experiment-validation");
  assert.match(degradedRelation.semantics.directionalMeaning.forward, /Claim is tested by experiment/);
  assert.equal(degradedRelation.toEntityType, "source");
  assert.ok(degradedReasonCodes.has("dangling-to-entity"));
  assert.ok(degradedReasonCodes.has("invalid-to-entity-type"));
  assert.equal(relations.summary.taxonomy.degradedFamilyCount > 0, true);
  assert.equal(relations.summary.taxonomy.topDegradedFamilyIds.includes("validation-loop"), true);
  assert.equal(degradedFamily.degradedCount > 0, true);
  assert.ok(Array.isArray(relations.summary.taxonomyRepairFrontier));
  assert.equal(workspaceIndex.repairFrontier.relationIssueCount > 0, true);
  assert.equal(workspaceIndex.repairFrontier.relationFamilyIssueCount > 0, true);
  assert.match(workspaceIndex.repairFrontier.taxonomyOverview, /families currently degraded/);
  assert.equal(workspaceIndex.repairFrontier.topDegradedFamilyIds.includes("validation-loop"), true);
  assert.equal(workspaceIndex.repairFrontier.relationFamilySummaries.some((item) => item.id === "validation-loop"), true);
  assert.ok(workspaceIndex.repairFrontier.prioritizedItems.some((item) => item.frontierType === "typed-wiki-relation"));
  assert.ok(workspaceIndex.repairFrontier.prioritizedItems.some((item) => item.frontierType === "typed-wiki-relation-family"));
});

test("queryMetaOptimize carries typed wiki taxonomy pressure through clusters, summaries, and long-horizon memory", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Taxonomy-aware Meta", objective: "Make optimizer recommendations explicitly aware of typed wiki taxonomy pressure." });

  registerSource(root, { citationKey: "taxonomy-source", title: "Taxonomy Source", authors: ["Chen"], year: 2026 });
  upsertNote(root, { noteId: "taxonomy-note", title: "Taxonomy note", sectionId: "method", sourceIds: ["taxonomy-source"], summary: "Ground a note in a source." });
  writeJson(root, ARTIFACT_PATHS.sources, {
    version: 1,
    items: [{ id: "experiment-wrong-exp", citationKey: "wrong-exp-source", title: "Wrong endpoint type", authors: [], year: 2026, sourceType: "paper", abstract: "", origin: "manual", addedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{
      id: "claim-taxonomy",
      text: "Taxonomy pressure should reach the optimizer frontier.",
      sectionId: "experiments",
      status: "supported",
      confidence: "medium",
      sourceIds: ["missing-source"],
      noteIds: ["missing-note"],
      experimentIds: ["wrong-exp"]
    }],
    updatedAt: null
  });

  refreshWiki(root);

  const result = queryMetaOptimize(root);
  const recommendations = readJson(root, ARTIFACT_PATHS.metaRecommendations, { items: [], frontier: {}, summary: {}, clusters: [], updatedAt: null });
  const optimizerState = readJson(root, ARTIFACT_PATHS.metaOptimizerState, { frontier: {}, longHorizon: {}, updatedAt: null });
  const longHorizonMemory = readJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, { summary: {}, families: [], history: [], updatedAt: null });
  const workspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { repairFrontier: {}, metaOptimize: {} });
  const report = fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerReport), "utf8");

  const taxonomyRecommendation = result.recommendations.find((item) => item.taxonomyPressure?.familyIds?.includes("validation-loop"));
  const taxonomyCluster = result.clusters.find((item) => item.id === "validation-loop-pressure");
  const taxonomyFamily = longHorizonMemory.families.find((item) => item.id === "taxonomy-validation-loop");

  assert.ok(taxonomyRecommendation);
  assert.equal(taxonomyRecommendation.scope, "validation-loop / artifact health");
  assert.equal(taxonomyRecommendation.taxonomyPressure.familyIds.includes("validation-loop"), true);
  assert.equal(taxonomyRecommendation.taxonomyPressure.groupIds.includes("claim-experiment-validation"), true);
  assert.equal(taxonomyRecommendation.signalStrength.taxonomyFamilyPressure > 0, true);
  assert.equal(taxonomyRecommendation.signalStrength.taxonomyGroupPressure > 0, true);
  assert.ok(taxonomyRecommendation.rankingBasis.some((item) => item.startsWith("taxonomyFamilyPressure=")));
  assert.ok(taxonomyRecommendation.rankingBasis.some((item) => item.startsWith("taxonomyGroupPressure=")));

  assert.ok(taxonomyCluster);
  assert.equal(taxonomyCluster.taxonomyPressure.familyIds.includes("validation-loop"), true);
  assert.equal(taxonomyCluster.taxonomyPressure.groupIds.includes("claim-experiment-validation"), true);
  assert.equal(recommendations.frontier.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.match(recommendations.frontier.taxonomyOverview, /Validation loop/i);
  assert.equal(recommendations.summary.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(recommendations.summary.topClusters.some((item) => item.taxonomyPressure?.familyIds?.includes("validation-loop")), true);
  assert.match(recommendations.frontier.frontierSummary, /Dominant taxonomy pressure/);

  assert.equal(optimizerState.frontier.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.match(optimizerState.frontier.taxonomyOverview, /validation loop/i);

  assert.equal(workspaceIndex.repairFrontier.topDegradedGroupIds.includes("claim-experiment-validation"), true);
  assert.equal(workspaceIndex.repairFrontier.relationGroupSummaries.some((item) => item.id === "claim-experiment-validation"), true);
  assert.equal(workspaceIndex.metaOptimize.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.match(workspaceIndex.metaOptimize.taxonomyOverview, /Validation loop/i);

  assert.ok(taxonomyFamily);
  assert.equal(taxonomyFamily.relatedTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(taxonomyFamily.relatedTaxonomyGroupIds.includes("claim-experiment-validation"), true);
  assert.equal(longHorizonMemory.summary.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.match(longHorizonMemory.summary.overview, /Dominant taxonomy pressure/);
  assert.equal(longHorizonMemory.history.at(-1).topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(longHorizonMemory.history.at(-1).taxonomyGroupCounts["claim-experiment-validation"] > 0, true);

  assert.match(report, /Meta-optimize taxonomy pressure:/);
  assert.match(report, /Long-horizon taxonomy families:/);
  assert.match(report, /Taxonomy pressure:/);
});

test("queryMetaOptimize derives family-level operator playbooks from taxonomy, remediation packs, and long-horizon memory", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Family Playbooks", objective: "Surface family-level operator playbooks without auto-applying anything." });

  registerSource(root, { citationKey: "playbook-source", title: "Playbook Source", authors: ["Ng"], year: 2026 });
  upsertNote(root, { noteId: "playbook-note", title: "Playbook note", sectionId: "method", sourceIds: ["playbook-source"], summary: "Family playbooks should stay file-first." });
  writeJson(root, ARTIFACT_PATHS.sources, {
    version: 1,
    items: [{ id: "experiment-playbook-exp", citationKey: "playbook-exp-source", title: "Wrong endpoint type", authors: [], year: 2026, sourceType: "paper", abstract: "", origin: "manual", addedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{
      id: "claim-playbook",
      text: "Validation-loop playbooks should be derived from durable artifacts.",
      sectionId: "experiments",
      status: "supported",
      confidence: "medium",
      sourceIds: ["missing-source"],
      noteIds: ["missing-note"],
      experimentIds: ["playbook-exp"]
    }],
    updatedAt: null
  });

  refreshWiki(root);

  const result = queryMetaOptimize(root);
  const playbooks = readJson(root, ARTIFACT_PATHS.metaOperatorPlaybooks, createMetaOperatorPlaybooksIndex);
  const workspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { metaOptimize: {} });
  const reviewerManifest = readJson(root, `${ARTIFACT_PATHS.roleContextsDir}/researcher.json`, {});
  const currentActionBundle = readJson(root, `${ARTIFACT_PATHS.actionContextsDir}/current.json`, {});
  const report = fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerReport), "utf8");

  const validationPlaybook = playbooks.playbooks.find((item) => item.taxonomyFamilyId === "validation-loop");

  assert.ok(validationPlaybook);
  assert.equal(validationPlaybook.proposalOnly, true);
  assert.equal(validationPlaybook.noAutoApply, true);
  assert.equal(["actionable", "partially-actionable", "advisory-only"].includes(validationPlaybook.readiness.operatorReadiness), true);
  assert.equal(validationPlaybook.acceptanceCriteria.length > 0, true);
  assert.equal(validationPlaybook.conversionHints.length > 0, true);
  assert.equal(validationPlaybook.rankedConversionPaths.length > 1, true);
  assert.equal(validationPlaybook.artifactUpdateMap.targetCount > 0, true);
  assert.equal(validationPlaybook.artifactUpdateMap.updateOrder[0], validationPlaybook.artifactUpdateMap.targets[0].artifactPath);
  assert.equal(validationPlaybook.rankedConversionPaths[0].rank, 1);
  assert.ok(validationPlaybook.rankedConversionPaths[0].pathScore >= validationPlaybook.rankedConversionPaths[1].pathScore);
  assert.equal(validationPlaybook.manualNextActions.length > 0, true);
  assert.equal(validationPlaybook.remediationPackIds.length > 0, true);
  assert.equal(validationPlaybook.longHorizonFamilyIds.includes("taxonomy-validation-loop"), true);
  assert.equal(playbooks.summary.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(result.operatorPlaybooks.summary.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(workspaceIndex.metaOptimize.operatorPlaybooks.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.ok(reviewerManifest.operatorGuidance.familyPlaybook);
  assert.ok(currentActionBundle.operatorGuidance.familyPlaybook);
  assert.equal(["actionable", "partially-actionable", "advisory-only"].includes(reviewerManifest.operatorGuidance.familyPlaybook.readiness.operatorReadiness), true);
  assert.equal(reviewerManifest.operatorGuidance.familyPlaybook.rankedConversionPaths.length > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.familyPlaybook.artifactUpdateTargets.length > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.familyPlaybook.artifactUpdateOrder.length > 0, true);
  assert.equal(currentActionBundle.operatorGuidance.familyPlaybook.rankedConversionPaths.length > 0, true);
  assert.equal(playbooks.summary.topTaxonomyFamilyIds.includes(reviewerManifest.operatorGuidance.familyPlaybook.taxonomyFamilyId), true);
  assert.equal(playbooks.summary.topTaxonomyFamilyIds.includes(currentActionBundle.operatorGuidance.familyPlaybook.taxonomyFamilyId), true);
  assert.match(report, /Family-level operator playbooks/);
  assert.match(report, /Validation loop operator playbook/);
  assert.match(report, /Artifact update overview:/);
  assert.match(report, /Artifact update order:/);
  assert.match(report, /Artifact targets:/);
});

test("workspace repair frontier and operator manifests surface governance repair plus remediation guidance", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Governance Repair", objective: "Surface governance repair in the same operator guidance loop." });

  registerSource(root, { citationKey: "gov-source", title: "Governance Source", authors: ["Patel"], year: 2026 });
  upsertNote(root, { noteId: "gov-note", title: "Governance note", sectionId: "method", sourceIds: ["gov-source"], summary: "Governance drift should stay proposal-only and explicit." });
  writeJson(root, ARTIFACT_PATHS.sources, {
    version: 1,
    items: [{ id: "experiment-gov-exp", citationKey: "gov-exp-source", title: "Governance mismatch experiment", authors: [], year: 2026, sourceType: "paper", abstract: "", origin: "manual", addedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{
      id: "claim-governance",
      text: "Governance drift should remain operator-visible.",
      sectionId: "method",
      status: "supported",
      confidence: "medium",
      sourceIds: ["missing-source"],
      noteIds: ["missing-note"],
      experimentIds: ["gov-exp"]
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.versionComparisons, {
    version: 1,
    activeTargets: ["v-next"],
    items: [{
      id: "cmp-governance",
      fromVersionId: "v-prev",
      toVersionId: "v-next",
      unresolvedConcernsAdded: ["concern-governance"],
      createdAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-revision",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: [],
    unresolvedConcernIds: [],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["researcher"], separationMaintained: true }
  });
  upsertOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "researcher",
    intentType: "advance-paper",
    currentFocus: "Close governance-visible drift.",
    nextAction: "Review repair frontier guidance before continuing.",
    activeComparisonTargets: ["v-next"],
    tasks: [{
      id: "handoff-task",
      title: "Cross-role governance follow-up",
      assignedRole: "reviewer",
      status: "in-progress",
      lifecycleStatus: "ready-for-handoff",
      nextAction: "Hand off the governance repair packet to the reviewer.",
      evidenceLinks: [],
      outputPaths: []
    }]
  });

  refreshWiki(root);

  const metaOptimize = queryMetaOptimize(root);
  const workspaceIndex = queryWorkspaceIndex(root);
  const reviewerManifest = readJson(root, `${ARTIFACT_PATHS.roleContextsDir}/reviewer.json`, {});
  const phaseManifest = readJson(root, `${ARTIFACT_PATHS.phaseContextsDir}/research.json`, {});
  const currentActionBundle = readJson(root, `${ARTIFACT_PATHS.actionContextsDir}/current.json`, {});

  assert.equal(metaOptimize.remediationPacks.summary.packCount >= 1, true);
  assert.equal(workspaceIndex.repairFrontier.governanceIssueCount, 2);
  assert.ok(workspaceIndex.repairFrontier.prioritizedItems.some((item) => item.frontierType === "workflow-governance"));
  assert.ok(workspaceIndex.repairFrontier.prioritizedItems.some((item) => item.frontierType === "version-governance"));
  assert.equal(reviewerManifest.operatorGuidance.repairFrontier.governanceIssueCount, 2);
  assert.equal(reviewerManifest.operatorGuidance.remediationPack.manualNextActions.length > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.remediationPack.rankedConversionPaths.length > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.familyPlaybook.manualNextActions.length > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.familyPlaybook.selectionScore > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.familyPlaybook.artifactUpdateTargets.length > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.taxonomyPressure.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(phaseManifest.operatorGuidance.remediationPack.manualNextActions.length > 0, true);
  assert.equal(phaseManifest.operatorGuidance.familyPlaybook.manualNextActions.length > 0, true);
  assert.equal(currentActionBundle.operatorGuidance.remediationPack.manualNextActions.length > 0, true);
  assert.equal(currentActionBundle.operatorGuidance.familyPlaybook.manualNextActions.length > 0, true);
  assert.equal(currentActionBundle.operatorGuidance.familyPlaybook.artifactUpdateOrder.length > 0, true);
  assert.equal(currentActionBundle.operatorGuidance.taxonomyPressure.topTaxonomyFamilyIds.includes("validation-loop"), true);
});

test("queryMetaOptimize surfaces durable operator follow-through and marks stale source fingerprints", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Follow Through", objective: "Track explicit operator follow-through decisions." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "follow-gap",
      summary: "Need explicit operator handling.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the follow-through gap."],
    unresolvedConcernIds: ["follow-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });

  const meta = queryMetaOptimize(root);
  const topPack = meta.remediationPacks.packs[0];
  const allowedActorRole = topPack.packetPointers?.[0]?.assignedRole ?? topPack.conversionHints?.[0]?.assignedRole ?? "planner";
  assert.ok(topPack);

  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    version: 1,
    items: [{
      id: "task-follow-through",
      title: "Follow-through execution task",
      status: "pending",
      lifecycleStatus: "waiting",
      assignedRole: "planner",
      phase: "research",
      nextAction: "Take the top remediation pack into execution.",
      packetPath: ".paper/task-packets/packets/task-follow-through.json",
      packetContextPath: ".paper/context/packets/task-follow-through.json"
    }],
    clusterMembership: {},
    dependencyMap: {},
    summary: {
      itemCount: 1,
      staleCount: 0,
      reviewNeededCount: 0,
      handoffReadyCount: 0,
      rootPacketIds: ["task-follow-through"],
      topPacketIds: ["task-follow-through"]
    },
    updatedAt: null
  });
  writeJson(root, ".paper/task-packets/packets/task-follow-through.json", {
    id: "task-follow-through",
    title: "Follow-through execution task",
    status: "pending"
  });

  recordOperatorFollowThrough(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    status: "accepted-for-execution",
    actorRole: "planner",
    decisionSummary: "Promote top remediation pack into manual execution.",
    selectedConversionPathKey: topPack.rankedConversionPaths?.[0]?.deterministicKey ?? null,
    linkedTargetArtifact: ".paper/task-packets/packets/task-follow-through.json",
    linkedTargetId: "task-follow-through",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  let followThrough = queryOperatorFollowThrough(root);
  assert.equal(followThrough.summary.acceptedForExecutionCount, 1);
  assert.equal(followThrough.summary.staleCount, 0);
  assert.equal(followThrough.items[0].sourceType, "remediation-pack");
  assert.equal(followThrough.items[0].linkedTargetArtifact, ".paper/task-packets/packets/task-follow-through.json");

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "follow-gap",
      summary: "Need explicit operator handling after source change.",
      severity: "critical",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 3,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });

  followThrough = queryOperatorFollowThrough(root);
  assert.equal(followThrough.summary.staleCount, 1);
  assert.equal(followThrough.items[0].stale, true);
  assert.equal(followThrough.summary.topSourceIds.includes(topPack.id), true);

  const followThroughPath = path.join(root, ARTIFACT_PATHS.metaOperatorFollowThrough);
  const rawLedger = JSON.parse(fs.readFileSync(followThroughPath, "utf8"));
  rawLedger.items[0].status = "totally-invalid";
  fs.writeFileSync(followThroughPath, `${JSON.stringify(rawLedger, null, 2)}\n`, "utf8");

  followThrough = queryOperatorFollowThrough(root);
  assert.equal(followThrough.summary.invalidStatusCount, 1);
  assert.equal(followThrough.items[0].invalidStatus, true);

  assert.throws(() => {
    recordOperatorFollowThrough(root, {
      sourceType: "remediation-pack",
      sourceId: topPack.id,
      status: "not-a-real-status",
      actorRole: "planner"
    });
  }, /Invalid follow-through status/);

  assert.throws(() => {
    recordOperatorFollowThrough(root, {
      sourceType: "remediation-pack",
      sourceId: topPack.id,
      status: "accepted-for-execution",
      actorRole: "reviewer",
      linkedTargetArtifact: ".paper/task-packets/packets/task-follow-through.json",
      linkedTargetId: "task-follow-through",
      executeBy: "2099-01-01T00:00:00.000Z",
      reviewAfter: "2099-01-01T12:00:00.000Z"
    });
  }, /not allowed/);

  assert.throws(() => {
    recordOperatorFollowThrough(root, {
      sourceType: "remediation-pack",
      sourceId: topPack.id,
      status: "accepted-for-execution",
      actorRole: "planner",
      linkedTargetArtifact: ".paper/task-packets/packets/task-follow-through.json",
      linkedTargetId: "missing-target",
      executeBy: "2099-01-01T00:00:00.000Z",
      reviewAfter: "2099-01-01T12:00:00.000Z"
    });
  }, /was not found/);

  assert.throws(() => {
    recordOperatorFollowThrough(root, {
      sourceType: "remediation-pack",
      sourceId: topPack.id,
      status: "executing",
      actorRole: allowedActorRole,
      linkedTargetArtifact: ".paper/task-packets/packets/task-follow-through.json",
      linkedTargetId: "task-follow-through"
    });
  }, /executionStartedAt/);

  fs.rmSync(path.join(root, ".paper/task-packets/packets/task-follow-through.json"), { force: true });
  followThrough = queryOperatorFollowThrough(root);
  assert.equal(followThrough.summary.itemCount > 0, true);
});

test("queryOperatorFollowThrough summarizes combined deferred, stale, and invalid follow-through debt", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  const now = new Date().toISOString();
  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, {
    version: 1,
    proposalOnly: true,
    explicitOnly: true,
    items: [
      {
        id: "ft-deferred",
        sourceType: "remediation-pack",
        sourceId: "pack-a",
        sourceArtifactPath: ARTIFACT_PATHS.metaRemediationPacks,
        sourceFingerprint: "a",
        sourceTitle: "A",
        sourceSummary: "A",
        status: "deferred",
        actorRole: "planner",
        deferUntil: "2000-01-01T00:00:00.000Z",
        recordedAt: now,
        updatedAt: now
      },
      {
        id: "ft-invalid",
        sourceType: "operator-playbook",
        sourceId: "playbook-a",
        sourceArtifactPath: ARTIFACT_PATHS.metaOperatorPlaybooks,
        sourceFingerprint: "b",
        sourceTitle: "B",
        sourceSummary: "B",
        status: "not-real",
        actorRole: "planner",
        recordedAt: now,
        updatedAt: now
      },
      {
        id: "ft-overdue",
        sourceType: "remediation-pack",
        sourceId: "pack-b",
        sourceArtifactPath: ARTIFACT_PATHS.metaRemediationPacks,
        sourceFingerprint: "c",
        sourceTitle: "C",
        sourceSummary: "C",
        status: "accepted-for-execution",
        actorRole: "planner",
        linkedTargetArtifact: ".paper/task-packets/packets/task-overdue.json",
        linkedTargetId: "task-overdue",
        executeBy: "2000-01-01T00:00:00.000Z",
        reviewAfter: "2000-01-01T12:00:00.000Z",
        recordedAt: now,
        updatedAt: now
      }
    ],
    summary: { itemCount: 2 },
    updatedAt: now
  });

  const followThrough = queryOperatorFollowThrough(root);
  assert.equal(followThrough.summary.itemCount, 3);
  assert.equal(followThrough.summary.dueDeferredCount, 1);
  assert.equal(followThrough.summary.dueReviewCount, 1);
  assert.equal(followThrough.summary.invalidStatusCount, 1);
  assert.equal(followThrough.summary.overdueExecutionCount, 1);
  assert.equal(followThrough.summary.criticalOverdueExecutionCount, 1);
  assert.equal(followThrough.summary.actionRequiredCount >= 3, true);
});

test("queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Governance Coverage", objective: "Audit guarded mutation coverage." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "coverage-gap",
      summary: "Coverage debt should block key writes.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the governance coverage gap."],
    unresolvedConcernIds: ["coverage-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });

  const meta = queryMetaOptimize(root);
  const governanceCoveragePath = meta.governanceCoverage.coveragePath ?? meta.governanceCoverage.summary?.coveragePath;
  assert.equal(typeof governanceCoveragePath, "string");
  assert.equal(governanceCoveragePath, ARTIFACT_PATHS.metaGovernanceCoverage);
  assert.equal(meta.governanceCoverageReport.summary.reportPath, ARTIFACT_PATHS.metaGovernanceCoverageReport);
  assert.equal(meta.governanceCoverageReport.summary.markdownPath, ARTIFACT_PATHS.metaGovernanceCoverageReportMarkdown);
  const guardedIds = new Set(meta.governanceCoverage.guardedMutations.map((item) => item.id));
  for (const required of ["upsert-orchestration-board", "append-handoff", "upsert-plan", "append-review-log", "update-research-brief", "upsert-experiment-plan", "run-experiment-audit", "upsert-claims", "bridge-experiment-result-to-claim", "compare-versions"]) {
    assert.equal(guardedIds.has(required), true);
  }
  const claimBridgeCoverage = meta.governanceCoverage.guardedMutations.find((item) => item.id === "bridge-experiment-result-to-claim");
  assert.equal(claimBridgeCoverage.surfaceBindings.coreFunction, "bridgeExperimentResultToClaim");
  assert.equal(claimBridgeCoverage.surfaceBindings.mcpTool, "bridge_result_to_claim");
  assert.equal(claimBridgeCoverage.surfaceBindings.commandIds.includes("paper.result-bridge"), true);
  const followThroughExempt = meta.governanceCoverage.exemptMutations.find((item) => item.id === "record-operator-follow-through");
  assert.equal(followThroughExempt.surfaceBindings.mcpTool, "record_operator_follow_through");
  assert.equal(followThroughExempt.surfaceBindings.commandIds.includes("paper.follow-through"), true);
  assert.equal(typeof followThroughExempt.ownerRole, "string");
  assert.equal(typeof followThroughExempt.approvedByRole, "string");
  assert.equal(typeof followThroughExempt.approvedAt, "string");
  assert.equal(typeof followThroughExempt.lastReviewedAt, "string");
  assert.equal(typeof followThroughExempt.reasonCode, "string");
  assert.equal(typeof followThroughExempt.reviewCadence, "string");
  assert.equal(typeof followThroughExempt.sunsetAt, "string");
  const guardedCoreFunctions = new Set(meta.governanceCoverage.guardedMutations.map((item) => item.surfaceBindings.coreFunction));
  for (const requiredCore of ["upsertOrchestrationBoard", "upsertClaims", "appendReviewLog", "runExperimentAudit", "bridgeExperimentResultToClaim", "compareVersions"]) {
    assert.equal(guardedCoreFunctions.has(requiredCore), true);
  }
  const exemptCoreFunctions = new Set(meta.governanceCoverage.exemptMutations.map((item) => item.surfaceBindings.coreFunction));
  assert.equal(exemptCoreFunctions.has("recordOperatorFollowThrough"), true);
  assert.equal(exemptCoreFunctions.has("queryMetaOptimize"), true);

  const topPack = meta.remediationPacks.packs[0];
  writeJson(root, ".paper/task-packets/packets/task-coverage.json", { id: "task-coverage", title: "Coverage task", status: "pending" });
  recordOperatorFollowThrough(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    status: "accepted-for-execution",
    actorRole: "planner",
    decisionSummary: "Take coverage pack into execution.",
    selectedConversionPathKey: topPack.rankedConversionPaths?.[0]?.deterministicKey ?? null,
    linkedTargetArtifact: ".paper/task-packets/packets/task-coverage.json",
    linkedTargetId: "task-coverage",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  assert.throws(() => upsertPlan(root, { thesis: "blocked plan" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => upsertClaims(root, {
    claims: [{ id: "claim-blocked", text: "blocked", sectionId: "introduction", sourceIds: ["known-source"] }]
  }), /blocked while operator follow-through still requires action/);
  assert.throws(() => updateResearchBrief(root, { objective: "blocked brief" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => upsertExperimentPlan(root, { id: "blocked-exp", title: "Blocked experiment", methodology: "Method" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => appendReviewLog(root, { actorRole: "reviewer", stage: "blocked", summary: "blocked", findings: [], actionItems: [] }), /blocked while operator follow-through still requires action|requires board role reviewer/);
  assert.throws(() => upsertExperimentResult(root, { id: "blocked-result", experimentId: "blocked-exp", outcome: "supports" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => runExperimentAudit(root, { experimentId: "blocked-exp" }), /blocked while operator follow-through still requires action|requires board role experiment-planner/);
  assert.throws(() => normalizeRebuttalIssues(root, { issues: [] }), /blocked while operator follow-through still requires action/);
  assert.throws(() => buildRebuttalStrategy(root, {}), /blocked while operator follow-through still requires action/);
  assert.throws(() => createVersionSnapshot(root, { versionId: "guard-v1" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => compareVersions(root, { fromVersionId: "guard-v1", toVersionId: "guard-v2" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => runReviewLoop(root, { actorRole: "reviewer" }), /blocked while operator follow-through still requires action|requires board role reviewer/);
  assert.throws(() => bridgeExperimentResultToClaim(root, { resultId: "blocked-result" }), /blocked while operator follow-through still requires action/);
});

test("governance registry completely binds the expected mutating command and MCP surfaces", () => {
  const toolNames = new Set(toolDefinitions.map((tool) => tool.name));
  const commandDir = path.join(process.cwd(), ".opencode", "commands");
  const registry = [...GOVERNANCE_GUARDED_MUTATIONS, ...GOVERNANCE_EXEMPT_MUTATIONS];
  const boundTools = new Set(registry.map((entry) => entry.surfaceBindings?.mcpTool).filter(Boolean));
  const boundCommands = new Set(registry.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []));

  const expectedMutatingTools = [
    "upsert_orchestration_board",
    "append_handoff",
    "update_research_brief",
    "register_source",
    "upsert_note",
    "upsert_claims",
    "upsert_plan",
    "upsert_outline",
    "upsert_draft",
    "upsert_experiment_plan",
    "upsert_experiment_result",
    "run_experiment_audit",
    "bridge_result_to_claim",
    "run_review_loop",
    "append_review_log",
    "upsert_revision_plan",
    "sync_citations",
    "refresh_wiki",
    "normalize_rebuttal_issues",
    "build_rebuttal_strategy",
    "create_version_snapshot",
    "compare_versions",
    "upsert_figure_plan",
    "record_operator_follow_through",
    "query_meta_optimize"
  ];
  for (const toolName of expectedMutatingTools) {
    assert.equal(boundTools.has(toolName), true);
    assert.equal(toolNames.has(toolName), true);
  }

  const expectedMutatingCommands = [
    "paper.orchestrate",
    "paper.research",
    "paper.source",
    "paper.note",
    "paper.claim-gate",
    "paper.plan",
    "paper.outline",
    "paper.draft",
    "paper.experiment-plan",
    "paper.experiment-audit",
    "paper.review",
    "paper.review-loop",
    "paper.result-bridge",
    "paper.revise",
    "paper.rebuttal-strategy",
    "paper.version-snapshot",
    "paper.version-compare",
    "paper.citations",
    "paper.figure",
    "paper.rebuttal",
    "paper.follow-through",
    "paper.meta-optimize"
  ];
  for (const commandId of expectedMutatingCommands) {
    assert.equal(boundCommands.has(commandId), true);
    assert.equal(fs.existsSync(path.join(commandDir, `${commandId}.md`)), true);
  }
});

test("a broader set of guarded write paths all reject unresolved follow-through debt", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Guard Matrix", objective: "Verify broader guarded write coverage." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "guard-matrix-gap",
      summary: "Guard matrix debt should block multiple write paths.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the guard matrix gap."],
    unresolvedConcernIds: ["guard-matrix-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });

  const topPack = queryMetaOptimize(root).remediationPacks.packs[0];
  writeJson(root, ".paper/task-packets/packets/task-guard-matrix.json", { id: "task-guard-matrix", title: "Guard matrix task", status: "pending" });
  recordOperatorFollowThrough(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    status: "accepted-for-execution",
    actorRole: "planner",
    decisionSummary: "Take this remediation pack into execution.",
    selectedConversionPathKey: topPack.rankedConversionPaths?.[0]?.deterministicKey ?? null,
    linkedTargetArtifact: ".paper/task-packets/packets/task-guard-matrix.json",
    linkedTargetId: "task-guard-matrix",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const guardedCalls = [
    () => upsertOrchestrationBoard(root, { phase: "review", assignedRole: "reviewer" }),
    () => appendHandoff(root, { fromRole: "researcher", toRole: "reviewer", summary: "Blocked handoff" }),
    () => registerSource(root, { title: "Blocked source" }),
    () => upsertNote(root, { title: "Blocked note", sectionId: "introduction" }),
    () => upsertPlan(root, { thesis: "Blocked plan" }),
    () => upsertOutline(root, { sections: [{ id: "intro", title: "Introduction" }] }),
    () => upsertDraft(root, { sectionId: "intro", body: "# Intro" }),
    () => setSectionStatus(root, { sectionId: "intro", status: "drafting" }),
    () => upsertFigurePlan(root, { items: [] }),
    () => updateResearchBrief(root, { objective: "Blocked brief" }),
    () => upsertExperimentPlan(root, { id: "guard-exp", title: "Guard experiment", methodology: "Method" }),
    () => upsertExperimentResult(root, { id: "guard-result", experimentId: "guard-exp", outcome: "supports" }),
    () => runExperimentAudit(root, { experimentId: "guard-exp" }),
    () => bridgeExperimentResultToClaim(root, { resultId: "guard-result" }),
    () => appendReviewLog(root, { actorRole: "reviewer", stage: "blocked", summary: "blocked", findings: [], actionItems: [] }),
    () => upsertRevisionPlan(root, { summary: "Blocked revision", items: ["One"] }),
    () => syncCitations(root, {}),
    () => refreshWiki(root),
    () => buildRebuttal(root),
    () => normalizeRebuttalIssues(root, { issues: [] }),
    () => buildRebuttalStrategy(root, {}),
    () => runReviewLoop(root, { actorRole: "reviewer" }),
    () => createVersionSnapshot(root, { versionId: "guard-v1" }),
    () => compareVersions(root, { fromVersionId: "guard-v1", toVersionId: "guard-v2" })
  ];

  for (const call of guardedCalls) {
    assert.throws(call, /blocked while operator follow-through still requires action|Cannot advance orchestration from|requires board role reviewer|requires board role experiment-planner|requires role planner for phase init/);
  }
});

test("follow-through overrides require expiry and exact target binding", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Override Guard", objective: "Validate override semantics." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{ id: "override-gap", summary: "Need explicit handling.", severity: "high", status: "open", responseOwnerRole: "planner", recurrenceCount: 1, linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog], updatedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close override gap."],
    unresolvedConcernIds: ["override-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });
  upsertOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "researcher",
    intentType: "advance-paper",
    currentFocus: "Resolve override-gap governance debt.",
    nextAction: "Inspect the remediation frontier before creating new work.",
    tasks: [{
      id: "override-stale-task",
      title: "Override stale task",
      assignedRole: "researcher",
      status: "in-progress",
      lifecycleStatus: "stale",
      nextAction: "Move this stale task into explicit remediation handling.",
      evidenceLinks: [],
      outputPaths: []
    }]
  });
  const topPack = queryMetaOptimize(root).remediationPacks.packs[0];
  const currentState = readState(root);
  const currentBoard = currentState.orchestrationBoard;
  const allowedActorRole = currentBoard?.assignedRole ?? "planner";
  const currentPhase = currentState.pipeline?.currentStage ?? currentBoard?.currentPhase ?? "init";
  writeJson(root, ".paper/task-packets/packets/task-override.json", { id: "task-override", title: "Override task", status: "pending" });
  recordOperatorFollowThrough(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    status: "accepted-for-execution",
    actorRole: allowedActorRole,
    decisionSummary: "Take this remediation pack into execution.",
    selectedConversionPathKey: topPack.rankedConversionPaths?.[0]?.deterministicKey ?? null,
    linkedTargetArtifact: ".paper/task-packets/packets/task-override.json",
    linkedTargetId: "task-override",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  assert.throws(() => upsertPlan(root, {
    thesis: "override without full guard",
    actorRole: allowedActorRole,
    policyOverrideReason: "manual",
    policyOverrideReasonCode: "manual-reconciliation",
    policyOverrideEvidencePaths: [ARTIFACT_PATHS.metaRemediationPacks, ".paper/task-packets/packets/task-override.json"],
    policyOverrideSourceId: topPack.id
  }), /future policyOverrideExpiresAt/);

  assert.throws(() => upsertPlan(root, {
    thesis: "override with wrong code",
    actorRole: allowedActorRole,
    policyOverrideReason: "manual",
    policyOverrideReasonCode: "not-allowed",
    policyOverrideEvidencePaths: [ARTIFACT_PATHS.metaRemediationPacks, ".paper/task-packets/packets/task-override.json"],
    policyOverrideSourceId: topPack.id,
    policyOverrideTargetArtifact: ".paper/task-packets/packets/task-override.json",
    policyOverrideTargetId: "task-override",
    policyOverridePhase: currentPhase,
    policyOverrideExpiresAt: "2099-01-02T00:00:00.000Z"
  }), /allowed policyOverrideReasonCode/);

  assert.throws(() => upsertPlan(root, {
    thesis: "override with long window",
    actorRole: allowedActorRole,
    policyOverrideReason: "manual",
    policyOverrideReasonCode: "manual-reconciliation",
    policyOverrideEvidencePaths: [ARTIFACT_PATHS.metaRemediationPacks, ".paper/task-packets/packets/task-override.json"],
    policyOverrideSourceId: topPack.id,
    policyOverrideTargetArtifact: ".paper/task-packets/packets/task-override.json",
    policyOverrideTargetId: "task-override",
    policyOverridePhase: currentPhase,
    policyOverrideExpiresAt: "2099-12-31T00:00:00.000Z"
  }), /short future policyOverrideExpiresAt/);

  assert.throws(() => upsertPlan(root, {
    thesis: "override with wrong source",
    actorRole: allowedActorRole,
    policyOverrideReason: "manual",
    policyOverrideReasonCode: "manual-reconciliation",
    policyOverrideEvidencePaths: [ARTIFACT_PATHS.metaRemediationPacks, ".paper/task-packets/packets/task-override.json"],
    policyOverrideSourceId: "wrong-source",
    policyOverrideTargetArtifact: ".paper/task-packets/packets/task-override.json",
    policyOverrideTargetId: "task-override",
    policyOverridePhase: currentPhase,
    policyOverrideExpiresAt: "2099-01-02T00:00:00.000Z"
  }), /matching policyOverrideSourceId/);

});

test("guarded core mutation implementations explicitly call assertFollowThroughReady", () => {
  const files = {
    artifacts: fs.readFileSync(path.join(process.cwd(), "src/core/artifacts.mjs"), "utf8"),
    evidence: fs.readFileSync(path.join(process.cwd(), "src/core/evidence.mjs"), "utf8"),
    reviews: fs.readFileSync(path.join(process.cwd(), "src/core/reviews.mjs"), "utf8"),
    orchestration: fs.readFileSync(path.join(process.cwd(), "src/core/orchestration.mjs"), "utf8")
  };

  const guardedFunctionAssertions = [
    [files.artifacts, "registerSource"],
    [files.artifacts, "upsertNote"],
    [files.artifacts, "upsertPlan"],
    [files.artifacts, "upsertOutline"],
    [files.artifacts, "upsertDraft"],
    [files.artifacts, "setSectionStatus"],
    [files.artifacts, "upsertFigurePlan"],
    [files.artifacts, "syncCitations"],
    [files.artifacts, "refreshWiki"],
    [files.artifacts, "buildRebuttal"],
    [files.evidence, "upsertClaims"],
    [files.reviews, "appendReviewLog"],
    [files.reviews, "upsertRevisionPlan"],
    [files.reviews, "runReviewLoop"],
    [files.orchestration, "updateResearchBrief"],
    [files.orchestration, "upsertExperimentPlan"],
    [files.orchestration, "upsertExperimentResult"],
    [files.orchestration, "runExperimentAudit"],
    [files.orchestration, "bridgeExperimentResultToClaim"],
    [files.orchestration, "normalizeRebuttalIssues"],
    [files.orchestration, "buildRebuttalStrategy"],
    [files.orchestration, "createVersionSnapshot"],
    [files.orchestration, "compareVersions"]
  ];

  for (const [content, fnName] of guardedFunctionAssertions) {
    assert.match(content, new RegExp(`export function ${fnName}\\([^)]*\\) {[^]*?assertFollowThroughReady\\(`));
  }
});

test("every governance registry entry binds to real command, MCP, and core surfaces", () => {
  const registry = [...GOVERNANCE_GUARDED_MUTATIONS, ...GOVERNANCE_EXEMPT_MUTATIONS];
  const toolNames = new Set(toolDefinitions.map((tool) => tool.name));
  const commandDir = path.join(process.cwd(), ".opencode", "commands");
  const coreFiles = [
    fs.readFileSync(path.join(process.cwd(), "src/core/artifacts.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/evidence.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/reviews.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/orchestration.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/navigation.mjs"), "utf8")
  ];

  for (const entry of registry) {
    const bindings = entry.surfaceBindings ?? {};
    assert.equal(typeof bindings.coreFunction, "string");
    assert.equal(typeof bindings.mcpTool, "string");
    assert.equal(Array.isArray(bindings.commandIds), true);
    assert.equal(toolNames.has(bindings.mcpTool), true, `${entry.id} missing bound MCP tool ${bindings.mcpTool}`);
    for (const commandId of bindings.commandIds) {
      assert.equal(fs.existsSync(path.join(commandDir, `${commandId}.md`)), true, `${entry.id} missing command surface ${commandId}`);
    }
    assert.equal(coreFiles.some((content) => content.includes(`export function ${bindings.coreFunction}`) || content.includes(`function ${bindings.coreFunction}`)), true, `${entry.id} missing core function ${bindings.coreFunction}`);
  }
});

test("every guarded governance mutation has an explicit negative coverage mapping", () => {
  const guardedIds = new Set(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.id));
  const coveredIds = new Set(GOVERNANCE_NEGATIVE_COVERAGE.map((entry) => entry.id));
  for (const id of guardedIds) {
    assert.equal(coveredIds.has(id), true, `Missing negative coverage mapping for ${id}`);
  }
});

test("playbook selection prefers packet and taxonomy specific matches over broad role-only fallbacks", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Playbook Specificity", objective: "Prefer the most specific family playbook under mixed guidance signals." });

  registerSource(root, { citationKey: "specificity-source", title: "Specificity Source", authors: ["Rao"], year: 2026 });
  upsertNote(root, { noteId: "specificity-note", title: "Specificity note", sectionId: "method", sourceIds: ["specificity-source"], summary: "Specificity should remain deterministic." });
  writeJson(root, ARTIFACT_PATHS.sources, {
    version: 1,
    items: [{ id: "experiment-specificity-exp", citationKey: "specificity-exp-source", title: "Wrong endpoint type", authors: [], year: 2026, sourceType: "paper", abstract: "", origin: "manual", addedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{
      id: "claim-specificity",
      text: "Specific family playbooks should beat broad fallbacks.",
      sectionId: "experiments",
      status: "supported",
      confidence: "medium",
      sourceIds: ["missing-source"],
      noteIds: ["missing-note"],
      experimentIds: ["specificity-exp"]
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "specificity-review-gap",
      summary: "A broad review concern is still open.",
      severity: "high",
      status: "escalated",
      responseOwnerRole: "researcher",
      claimIds: ["claim-specificity"],
      recurrenceCount: 3,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the broad review concern."],
    unresolvedConcernIds: ["specificity-review-gap"],
    escalatedConcernIds: ["specificity-review-gap"],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 3,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["researcher"], separationMaintained: true }
  });
  upsertOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "researcher",
    intentType: "advance-paper",
    currentFocus: "Prefer the packet-specific validation playbook.",
    nextAction: "Use the packet-specific guidance next.",
    tasks: [{
      id: "specific-validation-task",
      title: "Close validation-loop packet",
      assignedRole: "researcher",
      status: "in-progress",
      lifecycleStatus: "review-needed",
      nextAction: "Repair the validation-loop relation explicitly.",
      evidenceLinks: [ARTIFACT_PATHS.wikiRelations],
      outputPaths: []
    }]
  });

  refreshWiki(root);

  const metaOptimize = queryMetaOptimize(root);
  const packetBundle = readJson(root, `${ARTIFACT_PATHS.actionContextsDir}/packet-task-specific-validation-task.json`, {});
  const roleManifest = readJson(root, `${ARTIFACT_PATHS.roleContextsDir}/researcher.json`, {});

  assert.equal(metaOptimize.operatorPlaybooks.playbooks.some((item) => item.taxonomyFamilyId === "validation-loop"), true);
  assert.equal(metaOptimize.operatorPlaybooks.playbooks.some((item) => item.taxonomyFamilyId === "evidence-grounding"), true);
  assert.equal(packetBundle.operatorGuidance.familyPlaybook.taxonomyFamilyId, "validation-loop");
  assert.equal(packetBundle.operatorGuidance.familyPlaybook.selectionRankingBasis.some((item) => item.startsWith("packet") || item.startsWith("packetText=")), true);
  assert.equal(roleManifest.operatorGuidance.familyPlaybook.selectionScore > 0, true);
});

test("figure QA records missing staged files and source artifacts in qa.json", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-main", text: "Main claim" }],
    updatedAt: null
  });

  fs.writeFileSync(path.join(root, ".paper", "figures", "main-figure.template.svg"), "<svg />\n", "utf8");

  upsertFigurePlan(root, {
    items: [{
      id: "main-figure",
      sourceSections: ["introduction"],
      sourceArtifactPaths: [ARTIFACT_PATHS.findings, ".paper/research/missing-source.md"],
      targetClaimIds: ["claim-main"],
      templateSvgPath: ".paper/figures/main-figure.template.svg",
      editableSvgPath: ".paper/figures/main-figure.editable.svg",
      finalSvgPath: ".paper/figures/main-figure.final.svg"
    }]
  });

  const qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [], updatedAt: null });
  const issueCodes = new Set(qa.issues.map((issue) => issue.code));

  assert.ok(issueCodes.has("missing-editableSvgPath-file"));
  assert.ok(issueCodes.has("missing-finalSvgPath-file"));
  assert.ok(issueCodes.has("missing-source-artifact-2"));
  assert.equal(qa.items[0].fileChecks.stagedArtifacts.templateSvgPath.exists, true);
  assert.equal(qa.items[0].fileChecks.stagedArtifacts.editableSvgPath.exists, false);
  assert.equal(qa.items[0].fileChecks.sourceArtifacts[0].exists, true);
  assert.equal(qa.items[0].fileChecks.sourceArtifacts[1].exists, false);
});

test("validateFigurePipeline catches colliding stage paths and malformed stage contract drift", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-shared", text: "Shared claim" }],
    updatedAt: null
  });

  fs.writeFileSync(path.join(root, ".paper", "figures", "shared.svg"), "<svg />\n", "utf8");

  upsertFigurePlan(root, {
    items: [{
      id: "figure-a",
      sourceSections: ["introduction"],
      targetClaimIds: ["claim-shared"],
      templateSvgPath: ".paper/figures/shared.svg",
      editableSvgPath: ".paper/figures/shared.svg",
      finalSvgPath: ".paper/figures/shared.svg"
    }]
  });

  writeJson(root, ARTIFACT_PATHS.figureTemplates, {
    version: 1,
    items: [{
      ...readJson(root, ARTIFACT_PATHS.figureTemplates, { version: 1, items: [], updatedAt: null }).items[0],
      finalSvgPath: ".paper/figures/drifted.final.svg"
    }],
    updatedAt: null
  });

  validateFigurePipeline(root);

  const qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [], updatedAt: null });
  const issueCodes = new Set(qa.issues.map((issue) => issue.code));

  assert.ok(issueCodes.has("colliding-stage-paths"));
  assert.ok(issueCodes.has("inconsistent-template-stage-paths"));
});

test("validateFigurePipeline records malformed stage paths instead of throwing on non-string values", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-malformed", text: "Malformed path claim" }],
    updatedAt: null
  });

  upsertFigurePlan(root, {
    items: [{
      id: "figure-malformed",
      sourceSections: ["introduction"],
      targetClaimIds: ["claim-malformed"],
      templateSvgPath: ".paper/figures/figure-malformed.template.svg",
      editableSvgPath: ".paper/figures/figure-malformed.editable.svg",
      finalSvgPath: ".paper/figures/figure-malformed.final.svg"
    }]
  });

  const figuresIndex = readJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: null });
  figuresIndex.items[0].templateSvgPath = null;
  writeJson(root, ARTIFACT_PATHS.figuresIndex, figuresIndex);

  assert.doesNotThrow(() => validateFigurePipeline(root));

  const qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [], updatedAt: null });
  const issueCodes = new Set(qa.issues.map((issue) => issue.code));
  assert.ok(issueCodes.has("malformed-templateSvgPath"));
});

test("validateFigurePipeline records malformed non-array figure linkage fields instead of throwing", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-array", text: "Array claim" }],
    updatedAt: null
  });

  upsertFigurePlan(root, {
    items: [{
      id: "figure-array-malformed",
      sourceSections: ["introduction"],
      targetClaimIds: ["claim-array"],
      templateSvgPath: ".paper/figures/figure-array-malformed.template.svg",
      editableSvgPath: ".paper/figures/figure-array-malformed.editable.svg",
      finalSvgPath: ".paper/figures/figure-array-malformed.final.svg"
    }]
  });

  const figuresIndex = readJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: null });
  figuresIndex.items[0].sourceSections = "introduction";
  figuresIndex.items[0].targetClaimIds = { bad: true };
  figuresIndex.items[0].reviewConcernIds = "review-1";
  writeJson(root, ARTIFACT_PATHS.figuresIndex, figuresIndex);

  assert.doesNotThrow(() => validateFigurePipeline(root));

  const qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [], updatedAt: null });
  const issueCodes = new Set(qa.issues.map((issue) => issue.code));
  assert.ok(issueCodes.has("malformed-sourceSections"));
  assert.ok(issueCodes.has("malformed-targetClaimIds"));
  assert.ok(issueCodes.has("malformed-reviewConcernIds"));
});
