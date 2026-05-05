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
  GOVERNANCE_READONLY_COMMANDS,
  GOVERNANCE_READONLY_TOOLS,
  ensureWorkspace,
  initProject,
  launchDoveMission,
  materializeGuidancePacket,
  issueProgramApproval,
  planCampaign,
  queryCampaigns,
  queryMetaOptimize,
  queryOperatorFollowThrough,
  queryProgramApprovals,
  queryTaskGraph,
  runAutonomyForeground,
  readState,
  readJson,
  recordOperatorFollowThrough,
  refreshWiki,
  registerSource,
  revokeProgramApproval,
  runAutonomyControlPlaneOnce,
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

function seedAutonomyGuidance(root) {
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "autonomy-gap",
      summary: "Need a governed autonomous control-plane slice.",
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
    openItems: ["Close the autonomous control-plane gap."],
    unresolvedConcernIds: ["autonomy-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });
  const meta = queryMetaOptimize(root);
  return {
    remediationPack: meta.remediationPacks.packs[0],
    executionBridgeCandidate: meta.executionBridgeCandidates.candidates.find((item) => item.candidateType === "packet-candidate")
  };
}

function seedRoleScopedAutonomyGuidance(root, responseOwnerRole = "researcher") {
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: `autonomy-gap-${responseOwnerRole}`,
      summary: `Need a governed ${responseOwnerRole}-owned autonomous control-plane slice.`,
      severity: "high",
      status: "open",
      responseOwnerRole,
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
    openItems: [`Close the ${responseOwnerRole}-owned autonomous control-plane gap.`],
    unresolvedConcernIds: [`autonomy-gap-${responseOwnerRole}`],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: [responseOwnerRole], separationMaintained: true }
  });
  return queryMetaOptimize(root).remediationPacks.packs[0];
}

function seedAcceptedAutonomyPacket(root, {
  packetId,
  sourceType,
  sourceId,
  sourceArtifactPath,
  title,
  nextAction,
  actorRole = "planner",
  packetAssignedRole = actorRole,
  workerRole = null,
  followThroughId = `follow-through-${packetId}`
}) {
  const timestamp = new Date(0).toISOString();
  const packetPath = `.paper/task-packets/packets/${packetId}.json`;
  const packetContextPath = `.paper/context/packets/${packetId}.json`;
  const packet = {
    id: packetId,
    sourceType: "materialized-guidance",
    sourceId,
    title,
    summary: `${title} should be assessed by the autonomous controller.`,
    phase: "plan",
    phaseContextId: "phase-plan",
    status: "pending",
    lifecycleStatus: "waiting",
    active: true,
    assignedRole: packetAssignedRole,
    currentFocus: title,
    nextAction,
    dependencies: [],
    evidenceLinks: [sourceArtifactPath],
    outputPaths: [ARTIFACT_PATHS.taskPacketsIndex],
    questions: [],
    decisions: [],
    lineage: {},
    continuationState: { status: "ready-to-resume", lastCheckpoint: "Awaiting autonomous control-plane assessment.", updatedAt: timestamp },
    autonomyEnvelope: workerRole
      ? {
          controllerRole: actorRole,
          workerRole,
          scopeType: "packet-local",
          explicitOnly: true,
          requiredReadPaths: [],
          localRules: ["Planner remains the supervising controller for this bounded autonomous packet step."]
        }
      : null,
    updatedAt: timestamp,
    packetPath,
    packetContextPath,
    materialization: {
      sourceType,
      sourceId,
      sourceArtifactPath,
      followThroughId,
      createdAt: timestamp,
      createdByRole: actorRole
    }
  };
  writeJson(root, packetPath, packet);
  const packetIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, { version: 3, items: [], lifecycleCounts: {}, dependencyHealth: {}, updatedAt: null });
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    ...packetIndex,
    items: [...(packetIndex.items ?? []).filter((item) => item.id !== packetId), packet],
    updatedAt: timestamp
  });
  recordOperatorFollowThrough(root, {
    id: followThroughId,
    sourceType,
    sourceId,
    status: "accepted-for-execution",
    actorRole,
    workerRole,
    decisionSummary: `Prepared ${packetId} for one bounded autonomous control-plane step.`,
    linkedTargetArtifact: packetPath,
    linkedTargetId: packetId,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });
  return { packetId, packetPath, packetContextPath, followThroughId };
}

function seedPlannedAutonomyMaterialization(root, {
  sourceType = "remediation-pack",
  sourceId,
  actorRole = "planner",
  followThroughId,
  linkedTargetId,
  linkedTargetArtifact = `.paper/task-packets/packets/${linkedTargetId}.json`,
  decisionSummary = `Autonomy may materialize ${sourceType}:${sourceId} into ${linkedTargetId}.`,
  selectedConversionPathKey = null,
  executeBy = "2099-01-01T00:00:00.000Z",
  reviewAfter = "2099-01-01T12:00:00.000Z"
}) {
  recordOperatorFollowThrough(root, {
    id: followThroughId ?? `follow-through-${linkedTargetId}`,
    sourceType,
    sourceId,
    status: "accepted-for-execution",
    actorRole,
    decisionSummary,
    selectedConversionPathKey,
    linkedTargetArtifact,
    linkedTargetId,
    plannedTarget: true,
    executeBy,
    reviewAfter
  });
}

test("planCampaign records an explicit non-executing multi-cycle campaign", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  const planned = planCampaign(root, {
    campaignId: "campaign-plan-alpha",
    title: "Evidence-to-review campaign",
    objective: "Collect evidence, refresh wiki, then review before approval.",
    actorRole: "planner",
    status: "active",
    programIds: ["program-alpha"],
    steps: [
      { id: "step-1", status: "planned", programId: "program-alpha", allowedStepType: "refresh-research-brief", nextAction: "Refresh the research brief." },
      { id: "step-2", status: "planned", programId: "program-alpha", allowedStepType: "run-review-loop", nextAction: "Run review only after explicit approval." }
    ],
    nextAction: "Issue explicit program approval for step-1."
  });

  assert.equal(planned.status, "planned");
  assert.equal(planned.campaignId, "campaign-plan-alpha");
  assert.equal(planned.stepCount, 2);
  assert.equal(planned.explicitApprovalRequired, true);
  assert.equal(planned.noHiddenRuntime, true);

  const campaigns = queryCampaigns(root, { campaignId: "campaign-plan-alpha" });
  assert.equal(campaigns.status, "ok");
  assert.equal(campaigns.items.length, 1);
  assert.equal(campaigns.items[0].status, "active");
  assert.equal(campaigns.items[0].steps[0].allowedStepType, "refresh-research-brief");
  assert.equal(campaigns.items[0].steps[1].allowedStepType, "run-review-loop");
  assert.equal(campaigns.items[0].explicitApprovalRequired, true);
  assert.equal(campaigns.items[0].noHiddenRuntime, true);

  const runtime = readJson(root, ARTIFACT_PATHS.runtimeControllerState, {});
  assert.equal(runtime.summary.lastStatus, "never-run");
  assert.equal(runtime.summary.requestCount, 0);
});

test("queryWorkspaceIndex projects campaign summary from durable campaign state", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  writeJson(root, ARTIFACT_PATHS.campaignsIndex, {
    version: 1,
    items: [{
      id: "campaign-alpha",
      status: "active",
      programIds: ["program-alpha"],
      steps: [
        { id: "step-1", status: "completed", programId: "program-alpha", nextAction: "Already closed." },
        { id: "step-2", status: "review-needed", programId: "program-alpha", nextAction: "Review evidence before issuing fresh approval." }
      ],
      nextAction: "Continue after review."
    }],
    summary: {
      campaignCount: 1,
      plannedCount: 0,
      activeCount: 1,
      reviewNeededCount: 1,
      completedCount: 0,
      blockedCount: 0,
      topCampaignIds: ["campaign-alpha"],
      overview: "1 multi-cycle campaign is active.",
      campaignsPath: ARTIFACT_PATHS.campaignsIndex
    },
    updatedAt: "2026-04-24T00:00:00.000Z"
  });
  writeJson(root, ARTIFACT_PATHS.programsIndex, {
    version: 1,
    items: [{ id: "program-alpha", status: "active" }],
    summary: { programCount: 1, activeCount: 1, blockedCount: 0, topProgramIds: ["program-alpha"], overview: "1 program", programsPath: ARTIFACT_PATHS.programsIndex },
    updatedAt: "2026-04-24T00:00:00.000Z"
  });
  writeJson(root, ARTIFACT_PATHS.programRuns, {
    version: 1,
    items: [{ id: "run-alpha", programId: "program-alpha", status: "review-needed", reviewCheckpointRequired: true }],
    summary: { runCount: 1, approvedCount: 0, activeCount: 0, reviewNeededCount: 1, blockedCount: 0, reviewCheckpointRunCount: 1, topRunIds: ["run-alpha"], overview: "1 run", runsPath: ARTIFACT_PATHS.programRuns },
    updatedAt: "2026-04-24T00:00:00.000Z"
  });

  const workspaceIndex = queryWorkspaceIndex(root);
  assert.equal(workspaceIndex.campaigns.campaignCount, 1);
  assert.equal(workspaceIndex.campaigns.activeCount, 1);
  assert.equal(workspaceIndex.campaigns.reviewNeededCount, 1);
  assert.equal(workspaceIndex.campaigns.currentCampaignId, "campaign-alpha");
  assert.equal(workspaceIndex.campaigns.currentCampaignStatus, "active");
  assert.equal(workspaceIndex.campaigns.currentCampaignStepCount, 2);
  assert.equal(workspaceIndex.campaigns.currentCampaignCompletedStepCount, 1);
  assert.equal(workspaceIndex.campaigns.currentCampaignReviewNeededStepCount, 1);
  assert.equal(workspaceIndex.campaigns.currentCampaignNextStepId, "step-2");
  assert.equal(workspaceIndex.campaigns.currentCampaignNextAction, "Review evidence before issuing fresh approval.");
  assert.equal(workspaceIndex.campaigns.linkedProgramCount, 1);
  assert.equal(workspaceIndex.campaigns.linkedRunCount, 1);
});

test("queryWorkspaceIndex treats explicit Dove engineering packets as engineering missions", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    version: 3,
    items: [{
      id: "implement-api-cache",
      title: "Implement API cache",
      summary: "Engineering mission packet for a normal implementation task.",
      sourceType: "engineering-mission",
      doveDomain: "engineering",
      phase: "draft",
      status: "pending",
      lifecycleStatus: "active",
      active: true,
      assignedRole: "author",
      nextAction: "Implement the cache and return tests plus review evidence.",
      outputPaths: ["src/cache.mjs"],
      evidenceLinks: ["tests/cache.test.mjs"]
    }],
    lifecycleCounts: {},
    dependencyHealth: {},
    updatedAt: null
  });

  const workspaceIndex = queryWorkspaceIndex(root);
  assert.equal(workspaceIndex.dove.currentDomain, "engineering");
  assert.equal(workspaceIndex.dove.domainCounts.engineering, 1);
  assert.equal(workspaceIndex.dove.domainGuidance.find((domain) => domain.id === "engineering").stageRoutes.execution, "project:paper.materialize or project:paper.autonomy-operate");
  assert.equal(workspaceIndex.activePackets[0].doveDomain, "engineering");
  assert.equal(workspaceIndex.activePackets[0].lifecycleFamily, "structure");
});

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
  assert.equal(boundaries.managedArtifacts.doveRootManifest.path, ".paper/workspace/dove-root-manifest.json");
  assert.deepEqual(boundaries.managedPaths, [".opencode", ".opencode.json", "README.md", "bin", "docs", "mcp", "scripts", "src"]);
  assert.deepEqual(boundaries.neutralCorePaths, ["README.md", "bin", "docs", "mcp", "scripts", "src"]);
  assert.deepEqual(boundaries.defaultHostAdapters, ["opencode"]);
  assert.deepEqual(boundaries.availableHostAdapters, ["opencode", "claude", "codex", "cursor", "agents"]);
  assert.deepEqual(boundaries.managedHostAdapterPaths.claude, [".claude/commands", ".claude/agents"]);
  assert.deepEqual(boundaries.managedHostAdapterPaths.agents, [".agents/skills", "AGENTS.md"]);
  assert.deepEqual(boundaries.notes, ["legacy note"]);

  assert.equal(workspaceIndex.version, 9);
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
  assert.equal(workspaceIndex.runtime.explicitInvocationOnly, true);
  assert.equal(workspaceIndex.runtime.noDaemon, true);
  assert.equal(workspaceIndex.runtime.controllerStatePath, ARTIFACT_PATHS.runtimeControllerState);
  assert.equal(workspaceIndex.runtime.leasesPath, ARTIFACT_PATHS.runtimeLeases);
  assert.equal(workspaceIndex.runtime.eventsPath, ARTIFACT_PATHS.runtimeEvents);
  assert.equal(workspaceIndex.runtime.resultsPath, ARTIFACT_PATHS.runtimeResults);
  assert.equal(workspaceIndex.runtime.lastStatus, "never-run");
  assert.equal(workspaceIndex.runtime.lastOutcome, "not-started");
  assert.equal(workspaceIndex.runtime.activeLeaseCount, 0);
  assert.equal(workspaceIndex.runtime.eventCount, 0);
  assert.equal(workspaceIndex.runtime.resultCount, 0);

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
  const workspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { version: 9 });

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
  const secondWorkspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { version: 9 });
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
  const workspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { version: 9 });
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
  assert.equal(Array.isArray(followThrough.summary.overdueExecutionIds), true);
  assert.equal(followThrough.summary.actionRequiredCount >= 3, true);
});

test("executing follow-through remains a valid governed state across query and write guards", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Executing State", objective: "Keep executing state consistent across governance surfaces." });

  writeJson(root, ".paper/task-packets/packets/task-executing.json", {
    id: "task-executing",
    title: "Executing task",
    status: "in-progress"
  });

  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, {
    version: 1,
    proposalOnly: true,
    explicitOnly: true,
    items: [{
      id: "follow-through-executing",
      sourceType: "remediation-pack",
      sourceId: "executing-pack",
      sourceArtifactPath: ARTIFACT_PATHS.metaRemediationPacks,
      sourceFingerprint: "executing-fingerprint",
      sourceTitle: "Executing pack",
      sourceSummary: "Executing pack summary",
      status: "executing",
      actorRole: "planner",
      linkedTargetArtifact: ".paper/task-packets/packets/task-executing.json",
      linkedTargetId: "task-executing",
      executeBy: "2099-01-01T00:00:00.000Z",
      reviewAfter: "2099-01-01T12:00:00.000Z",
      executionStartedAt: "2098-12-31T23:00:00.000Z",
      recordedAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    }],
    summary: { itemCount: 1 },
    updatedAt: null
  });

  const followThrough = queryOperatorFollowThrough(root);
  assert.equal(followThrough.items[0].status, "executing");
  assert.equal(followThrough.items[0].invalidStatus, false);

  assert.throws(() => upsertPlan(root, { thesis: "blocked by executing state" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => upsertOrchestrationBoard(root, { phase: "review", assignedRole: "reviewer" }), /operator follow-through still requires action|Cannot advance orchestration from/);
  const doctor = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorFollowThrough), "utf8"));
  assert.equal(Array.isArray(doctor.items), true);
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
  assert.equal(typeof meta.governanceCoverageReport.summary.staleReviewCount, "number");
  assert.equal(typeof meta.governanceCoverageReport.summary.expiringSoonCount, "number");
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
      "query_meta_optimize",
      "plan_campaign",
      "materialize_guidance_packet",
      "launch_dove_mission"
  ];
  for (const toolName of expectedMutatingTools) {
    assert.equal(boundTools.has(toolName), true);
    assert.equal(toolNames.has(toolName), true);
  }

  const expectedMutatingCommands = [
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
      "paper.meta-optimize",
      "paper.materialize",
      "dove.launch"
  ];
  for (const commandId of expectedMutatingCommands) {
    assert.equal(boundCommands.has(commandId), true);
    assert.equal(fs.existsSync(path.join(commandDir, `${commandId}.md`)), true);
  }
  assert.equal(boundCommands.has("paper.orchestrate"), false);
  assert.equal(boundCommands.has("dove.launch"), true);
  assert.equal(boundCommands.has("dove.orchestrate"), false);
  assert.equal(boundCommands.has("dove.mission"), false);
  assert.equal(boundCommands.has("dove.board"), false);
  assert.equal(boundCommands.has("dove.audit"), false);
  assert.equal(boundCommands.has("dove.return"), false);
  assert.equal(GOVERNANCE_READONLY_COMMANDS.includes("paper.orchestrate"), true);
  assert.equal(GOVERNANCE_READONLY_COMMANDS.includes("dove.orchestrate"), true);
  assert.equal(GOVERNANCE_READONLY_COMMANDS.includes("dove.mission"), true);
  assert.equal(GOVERNANCE_READONLY_COMMANDS.includes("dove.board"), true);
  assert.equal(GOVERNANCE_READONLY_COMMANDS.includes("dove.audit"), true);
  assert.equal(GOVERNANCE_READONLY_COMMANDS.includes("dove.return"), true);
  assert.equal(GOVERNANCE_READONLY_TOOLS.includes("query_dove_orchestrate"), true);
  assert.equal(GOVERNANCE_READONLY_TOOLS.includes("query_dove_audit"), true);
  assert.equal(fs.existsSync(path.join(commandDir, "paper.orchestrate.md")), true);
  assert.equal(fs.existsSync(path.join(commandDir, "dove.orchestrate.md")), true);
  assert.equal(fs.existsSync(path.join(commandDir, "dove.mission.md")), true);
  assert.equal(fs.existsSync(path.join(commandDir, "dove.board.md")), true);
  assert.equal(fs.existsSync(path.join(commandDir, "dove.audit.md")), true);
  assert.equal(fs.existsSync(path.join(commandDir, "dove.return.md")), true);
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

test("materializeGuidancePacket creates a durable packet from accepted remediation guidance and binds follow-through", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Materialize Guidance", objective: "Convert accepted guidance into a real task packet." });
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "materialize-gap",
      summary: "Need an explicit packet materialization bridge.",
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
    openItems: ["Close the materialization gap."],
    unresolvedConcernIds: ["materialize-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });

  const topPack = queryMetaOptimize(root).remediationPacks.packs[0];
  const actorRole = topPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";
  const result = materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    actorRole,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  assert.equal(result.status, "materialized");
  const packet = readJson(root, result.packetPath, null);
  assert.equal(packet.sourceType, "materialized-guidance");
  assert.equal(packet.materialization.sourceType, "remediation-pack");
  assert.equal(packet.materialization.sourceId, topPack.id);
  assert.equal(packet.materialization.followThroughId.startsWith("follow-through-"), true);

  const packetIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, null);
  assert.equal(packetIndex.items.some((item) => item.id === result.packetId), true);

  const followThrough = queryOperatorFollowThrough(root);
  const record = followThrough.items.find((item) => item.sourceType === "remediation-pack" && item.sourceId === topPack.id);
  assert.equal(record.status, "accepted-for-execution");
  assert.equal(record.linkedTargetArtifact, result.packetPath);
  assert.equal(record.linkedTargetId, result.packetId);

  const workspaceIndex = queryWorkspaceIndex(root);
  const activePacket = workspaceIndex.activePackets.find((item) => item.id === result.packetId);
  assert.equal(activePacket.materializedFrom, `remediation-pack:${topPack.id}`);

  const navigation = fs.readFileSync(path.join(root, ARTIFACT_PATHS.navigationReport), "utf8");
  assert.match(navigation, new RegExp(`materialized-from=remediation-pack:${topPack.id}`));

  assert.throws(() => materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    actorRole,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }), /duplicate work/);
});

test("materializeGuidancePacket seeds durable program surfaces when program linkage is provided", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Materialize", objective: "Seed program-level operating surfaces through governed materialization." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-program-packet",
    title: "Program-linked packet",
    nextAction: "Refresh the research brief as one approved program step.",
    programId: "research-program-alpha",
    programTitle: "Research program alpha",
    programObjective: "Tighten the research brief around one governed program objective.",
    programAgenda: ["Clarify the current contribution boundary."],
    programEvidenceBacklog: ["Need a stronger source-backed motivation note."],
    programRunId: "research-program-alpha-run-1",
    approvalId: "research-program-alpha-approval-1",
    programApprovalSummary: "Approved one bounded research-brief refresh step.",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const packet = readJson(root, ".paper/task-packets/packets/task-program-packet.json", null);
  const programs = readJson(root, ARTIFACT_PATHS.programsIndex, null);
  const runs = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const approvals = readJson(root, ARTIFACT_PATHS.programApprovals, null);

  assert.equal(packet.lineage.programId, "research-program-alpha");
  assert.equal(packet.lineage.programRunId, "research-program-alpha-run-1");
  assert.equal(packet.lineage.approvalId, "research-program-alpha-approval-1");
  assert.equal(packet.materialization.programId, "research-program-alpha");
  assert.equal((programs.items ?? []).find((item) => item.id === "research-program-alpha").activeRunId, "research-program-alpha-run-1");
  assert.equal((runs.items ?? []).find((item) => item.id === "research-program-alpha-run-1").status, "approved");
  assert.equal((runs.items ?? []).find((item) => item.id === "research-program-alpha-run-1").allowedStepType, "refresh-research-brief");
  assert.equal((approvals.items ?? []).find((item) => item.id === "research-program-alpha-approval-1").status, "approved");
});

test("issueProgramApproval binds an explicit campaign step without executing runtime work", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Campaign Approval", objective: "Bind a campaign step to a fresh explicit approval." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-campaign-approval",
    title: "Campaign approval packet",
    nextAction: "Initial campaign program step.",
    programId: "program-campaign-alpha",
    programRunId: "program-campaign-alpha-run-1",
    approvalId: "program-campaign-alpha-approval-1",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });
  runAutonomyControlPlaneOnce(root, { actorRole: "planner" });

  planCampaign(root, {
    campaignId: "campaign-approval-alpha",
    actorRole: "planner",
    title: "Campaign approval alpha",
    objective: "Authorize one explicit follow-up step.",
    status: "active",
    steps: [{
      id: "step-approval-2",
      status: "planned",
      programId: "program-campaign-alpha",
      allowedStepType: "refresh-research-brief",
      nextAction: "Issue fresh approval before execution."
    }]
  });

  const runtimeBeforeApproval = readJson(root, ARTIFACT_PATHS.runtimeControllerState, {});

  const issued = issueProgramApproval(root, {
    packetId: "task-campaign-approval",
    programId: "program-campaign-alpha",
    programRunId: "program-campaign-alpha-run-2",
    approvalId: "program-campaign-alpha-approval-2",
    campaignId: "campaign-approval-alpha",
    campaignStepId: "step-approval-2",
    campaignStepNextAction: "Run explicit foreground autonomy for this approved step.",
    actorRole: "planner",
    workerRole: "researcher",
    executeBy: "2099-01-02T00:00:00.000Z",
    reviewAfter: "2099-01-02T12:00:00.000Z",
    summary: "Issued campaign-bound approval for the next step."
  });

  const campaigns = queryCampaigns(root, { campaignId: "campaign-approval-alpha" });
  const step = campaigns.items[0].steps.find((item) => item.id === "step-approval-2");
  const runtime = readJson(root, ARTIFACT_PATHS.runtimeControllerState, {});

  assert.deepEqual(issued.campaignBinding, { campaignId: "campaign-approval-alpha", campaignStepId: "step-approval-2" });
  assert.equal(step.status, "approved");
  assert.equal(step.programRunId, "program-campaign-alpha-run-2");
  assert.equal(step.approvalId, "program-campaign-alpha-approval-2");
  assert.equal(step.packetId, "task-campaign-approval");
  assert.equal(step.nextAction, "Run explicit foreground autonomy for this approved step.");
  assert.equal(campaigns.items[0].programIds.includes("program-campaign-alpha"), true);
  assert.equal(runtime.summary.lastRunId, runtimeBeforeApproval.summary.lastRunId);
  assert.equal(runtime.summary.requestCount, runtimeBeforeApproval.summary.requestCount);
});

test("explicit runtime execution reflects program outcomes into linked campaign steps", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Campaign Runtime", objective: "Reflect explicit runtime outcomes into campaign state." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-campaign-runtime",
    title: "Campaign runtime packet",
    nextAction: "Refresh the research brief for the campaign.",
    programId: "program-campaign-runtime-alpha",
    programTitle: "Program campaign runtime alpha",
    programObjective: "Refresh the research brief for the campaign objective.",
    programRunId: "program-campaign-runtime-alpha-run-1",
    approvalId: "program-campaign-runtime-alpha-approval-1",
    allowedStepType: "refresh-research-brief",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });
  runAutonomyControlPlaneOnce(root, { actorRole: "planner" });

  planCampaign(root, {
    campaignId: "campaign-runtime-alpha",
    actorRole: "planner",
    title: "Campaign runtime alpha",
    objective: "Track one explicitly executed program step.",
    status: "active",
    steps: [{
      id: "step-runtime-2",
      status: "planned",
      programId: "program-campaign-runtime-alpha",
      allowedStepType: "refresh-research-brief",
      nextAction: "Await explicit runtime execution."
    }]
  });
  issueProgramApproval(root, {
    packetId: "task-campaign-runtime",
    programId: "program-campaign-runtime-alpha",
    programRunId: "program-campaign-runtime-alpha-run-2",
    approvalId: "program-campaign-runtime-alpha-approval-2",
    campaignId: "campaign-runtime-alpha",
    campaignStepId: "step-runtime-2",
    campaignStepNextAction: "Run explicit foreground autonomy for this campaign step.",
    actorRole: "planner",
    workerRole: "researcher",
    allowedStepType: "refresh-research-brief",
    executeBy: "2099-01-02T00:00:00.000Z",
    reviewAfter: "2099-01-02T12:00:00.000Z",
    summary: "Issued campaign-bound approval for runtime reflection."
  });

  const beforeRuntime = queryCampaigns(root, { campaignId: "campaign-runtime-alpha" });
  const beforeStep = beforeRuntime.items[0].steps.find((item) => item.id === "step-runtime-2");
  assert.equal(beforeStep.status, "approved");

  const runtime = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  const campaigns = queryCampaigns(root, { campaignId: "campaign-runtime-alpha" });
  const step = campaigns.items[0].steps.find((item) => item.id === "step-runtime-2");

  assert.equal(runtime.status, "completed");
  assert.equal(runtime.programSnapshot.campaignReflection.status, "reflected");
  assert.equal(step.status, "review-needed");
  assert.equal(step.programRunId, "program-campaign-runtime-alpha-run-2");
  assert.equal(step.packetId, "task-campaign-runtime");
  assert.match(step.nextAction, /requires explicit review/);
  assert.equal(campaigns.items[0].status, "review-needed");
  assert.equal(campaigns.items[0].runs.some((item) => item.id === "program-campaign-runtime-alpha-run-2" && item.status === "review-needed"), true);
  assert.equal(runtime.artifactPaths.includes(ARTIFACT_PATHS.campaignsIndex), true);
});

test("issueProgramApproval re-arms an existing packet and surfaces the approval through queryProgramApprovals", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Issue Approval", objective: "Issue one explicit approval for an existing packet." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-issue-approval",
    title: "Approval packet",
    nextAction: "Initial program step.",
    programId: "program-issue-alpha",
    programRunId: "program-issue-alpha-run-1",
    approvalId: "program-issue-alpha-approval-1",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });
  runAutonomyControlPlaneOnce(root, { actorRole: "planner" });

  const issued = issueProgramApproval(root, {
    packetId: "task-issue-approval",
    programId: "program-issue-alpha",
    programRunId: "program-issue-alpha-run-2",
    approvalId: "program-issue-alpha-approval-2",
    actorRole: "planner",
    workerRole: "researcher",
    executeBy: "2099-01-02T00:00:00.000Z",
    reviewAfter: "2099-01-02T12:00:00.000Z",
    summary: "Issued a fresh approval for the next bounded step."
  });

  const packet = readJson(root, ".paper/task-packets/packets/task-issue-approval.json", null);
  const followThrough = readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, null);
  const approvalsView = queryProgramApprovals(root, { programId: "program-issue-alpha" });

  assert.equal(issued.status, "issued");
  assert.equal(packet.lifecycleStatus, "waiting");
  assert.equal(packet.lineage.programRunId, "program-issue-alpha-run-2");
  assert.equal(packet.materialization.followThroughId, issued.followThroughId);
  assert.equal((followThrough.items ?? []).find((item) => item.id === issued.followThroughId).status, "accepted-for-execution");
  assert.equal(approvalsView.items.some((item) => item.id === "program-issue-alpha-approval-2" && item.status === "approved"), true);
});

test("materializeGuidancePacket persists approved refresh-wiki program steps", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Wiki Materialize", objective: "Seed a wiki-refresh program step." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-program-wiki-packet",
    title: "Wiki program packet",
    nextAction: "Refresh the wiki under one approved program step.",
    programId: "research-program-wiki",
    programTitle: "Research program wiki",
    programObjective: "Refresh wiki surfaces through one approved step.",
    programAgenda: ["Carry current agenda into wiki surfaces."],
    programEvidenceBacklog: ["Need a wiki-backed query pack refresh."],
    programRunId: "research-program-wiki-run-1",
    approvalId: "research-program-wiki-approval-1",
    allowedStepType: "refresh-wiki",
    programApprovalSummary: "Approved one bounded wiki refresh step.",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const runs = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const approvals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  assert.equal((runs.items ?? []).find((item) => item.id === "research-program-wiki-run-1").allowedStepType, "refresh-wiki");
  assert.equal((approvals.items ?? []).find((item) => item.id === "research-program-wiki-approval-1").allowedStepType, "refresh-wiki");
});

test("materializeGuidancePacket persists approved upsert-note program steps and bounded payload", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Note Materialize", objective: "Seed a note-writing program step." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");
  const sourceId = registerSource(root, { title: "A source for notes", citationKey: "note-src" }).id;

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-program-note-packet",
    title: "Note program packet",
    nextAction: "Capture one source-linked note under one approved program step.",
    programId: "research-program-note",
    programTitle: "Research program note",
    programObjective: "Capture one durable source-linked note through one approved step.",
    programRunId: "research-program-note-run-1",
    approvalId: "research-program-note-approval-1",
    allowedStepType: "upsert-note",
    noteTitle: "Program note",
    noteSectionId: "introduction",
    noteSourceIds: [sourceId],
    noteSummary: "A bounded source-linked note.",
    noteOpenQuestions: ["What evidence remains missing?"],
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const runs = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const approvals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  assert.equal((runs.items ?? []).find((item) => item.id === "research-program-note-run-1").allowedStepType, "upsert-note");
  assert.equal((runs.items ?? []).find((item) => item.id === "research-program-note-run-1").stepPayload.summary, "A bounded source-linked note.");
  assert.equal((approvals.items ?? []).find((item) => item.id === "research-program-note-approval-1").allowedStepType, "upsert-note");
});

test("materializeGuidancePacket persists approved run-experiment-audit steps and bounded payload", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Audit Materialize", objective: "Seed an experiment-audit program step." });
  const { remediationPack } = seedAutonomyGuidance(root);

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    packetId: "task-program-audit-packet",
    title: "Audit program packet",
    nextAction: "Run one bounded experiment audit.",
    programId: "research-program-audit",
    programTitle: "Research program audit",
    programObjective: "Run one durable experiment audit through one approved step.",
    programRunId: "research-program-audit-run-1",
    approvalId: "research-program-audit-approval-1",
    allowedStepType: "run-experiment-audit",
    auditResultId: "result-audit-1",
    auditReviewedArtifactRefs: [ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentLog],
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const runs = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const approvals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  assert.equal((runs.items ?? []).find((item) => item.id === "research-program-audit-run-1").allowedStepType, "run-experiment-audit");
  assert.equal((runs.items ?? []).find((item) => item.id === "research-program-audit-run-1").stepPayload.resultId, "result-audit-1");
  assert.equal((approvals.items ?? []).find((item) => item.id === "research-program-audit-approval-1").allowedStepType, "run-experiment-audit");
});

test("materializeGuidancePacket persists approved bridge-result-to-claim steps and bounded payload", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Bridge Materialize", objective: "Seed a result-bridge program step." });
  const { remediationPack } = seedAutonomyGuidance(root);

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "planner",
    packetId: "task-program-bridge-packet",
    title: "Bridge program packet",
    nextAction: "Bridge one result into claim state through one approved step.",
    programId: "research-program-bridge",
    programTitle: "Research program bridge",
    programObjective: "Bridge one audited result into explicit claim state.",
    programRunId: "research-program-bridge-run-1",
    approvalId: "research-program-bridge-approval-1",
    allowedStepType: "bridge-result-to-claim",
    bridgeResultId: "result-bridge-1",
    bridgeAuditIds: ["audit-bridge-1"],
    bridgeReason: "Promote one audited result into claim state.",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const runs = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const approvals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  assert.equal((runs.items ?? []).find((item) => item.id === "research-program-bridge-run-1").allowedStepType, "bridge-result-to-claim");
  assert.equal((runs.items ?? []).find((item) => item.id === "research-program-bridge-run-1").stepPayload.resultId, "result-bridge-1");
  assert.deepEqual((runs.items ?? []).find((item) => item.id === "research-program-bridge-run-1").stepPayload.auditIds, ["audit-bridge-1"]);
  assert.equal((approvals.items ?? []).find((item) => item.id === "research-program-bridge-approval-1").allowedStepType, "bridge-result-to-claim");
});

test("materializeGuidancePacket persists approved run-review-loop steps and bounded payload", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Review Materialize", objective: "Seed a review-loop program step." });
  const { remediationPack } = seedAutonomyGuidance(root);

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "planner",
    packetId: "task-program-review-packet",
    title: "Review program packet",
    nextAction: "Run one bounded review loop.",
    programId: "research-program-review",
    programTitle: "Research program review",
    programObjective: "Run one durable review loop through one approved step.",
    programRunId: "research-program-review-run-1",
    approvalId: "research-program-review-approval-1",
    allowedStepType: "run-review-loop",
    reviewScope: "current paper pipeline",
    reviewStage: "review-loop",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const runs = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const approvals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  assert.equal((runs.items ?? []).find((item) => item.id === "research-program-review-run-1").allowedStepType, "run-review-loop");
  assert.equal((runs.items ?? []).find((item) => item.id === "research-program-review-run-1").stepPayload.scope, "current paper pipeline");
  assert.equal((approvals.items ?? []).find((item) => item.id === "research-program-review-approval-1").allowedStepType, "run-review-loop");
});

test("materializeGuidancePacket rejects unsupported program step types", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Step Reject", objective: "Reject unsupported program step types." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  assert.throws(() => materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-program-invalid-step",
    title: "Invalid program packet",
    nextAction: "This should be rejected.",
    programId: "research-program-invalid",
    programRunId: "research-program-invalid-run-1",
    approvalId: "research-program-invalid-approval-1",
    allowedStepType: "unknown-step",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }), /Unsupported allowedStepType/);
});

test("materializeGuidancePacket blocks unrelated follow-through debt and superseded guidance", () => {
  const blockedRoot = tempRoot();
  ensureWorkspace(blockedRoot);
  initProject(blockedRoot, { title: "Blocked Materialization", objective: "Respect follow-through governance before creating work." });
  writeJson(blockedRoot, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "blocked-materialize-gap",
      summary: "Need an explicit packet materialization bridge.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(blockedRoot, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the blocked materialization gap."],
    unresolvedConcernIds: ["blocked-materialize-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });

  const blockedMeta = queryMetaOptimize(blockedRoot);
  const blockedPack = blockedMeta.remediationPacks.packs[0];
  const blockedCandidate = blockedMeta.executionBridgeCandidates.candidates.find((item) => item.candidateType === "packet-candidate");
  const candidateActorRole = blockedCandidate.sourceConversionPath?.assignedRole ?? "planner";
  writeJson(blockedRoot, ".paper/task-packets/packets/task-blocking-guidance.json", { id: "task-blocking-guidance", title: "Blocking task", status: "pending" });
  recordOperatorFollowThrough(blockedRoot, {
    sourceType: "execution-bridge",
    sourceId: blockedCandidate.id,
    status: "accepted-for-execution",
    actorRole: candidateActorRole,
    decisionSummary: "Keep this candidate open as unrelated follow-through debt.",
    linkedTargetArtifact: ".paper/task-packets/packets/task-blocking-guidance.json",
    linkedTargetId: "task-blocking-guidance",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const packActorRole = blockedPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";
  assert.throws(() => materializeGuidancePacket(blockedRoot, {
    sourceType: "remediation-pack",
    sourceId: blockedPack.id,
    actorRole: packActorRole,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }), /unrelated operator follow-through/);

  const supersededRoot = tempRoot();
  ensureWorkspace(supersededRoot);
  initProject(supersededRoot, { title: "Superseded Materialization", objective: "Refuse superseded guidance materialization." });
  writeJson(supersededRoot, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "superseded-materialize-gap",
      summary: "Need an explicit packet materialization bridge.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(supersededRoot, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the superseded materialization gap."],
    unresolvedConcernIds: ["superseded-materialize-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });

  const supersededPack = queryMetaOptimize(supersededRoot).remediationPacks.packs[0];
  recordOperatorFollowThrough(supersededRoot, {
    sourceType: "remediation-pack",
    sourceId: supersededPack.id,
    status: "superseded",
    actorRole: supersededPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner",
    decisionSummary: "This guidance was superseded by a newer path."
  });

  assert.throws(() => materializeGuidancePacket(supersededRoot, {
    sourceType: "remediation-pack",
    sourceId: supersededPack.id,
    actorRole: supersededPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }), /superseded guidance/);
});

test("runAutonomyControlPlaneOnce records a deterministic no-op when no safe packet exists", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy No-op", objective: "Exit safely when there is no eligible packet." });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });

  assert.equal(result.status, "noop");
  assert.equal(result.outcome, "no-eligible-packet");

  const runtimeResults = readJson(root, ARTIFACT_PATHS.runtimeResults, null);
  const runtimeEvents = readJson(root, ARTIFACT_PATHS.runtimeEvents, null);
  const workspaceIndex = queryWorkspaceIndex(root);

  assert.equal(runtimeResults.entries.length >= 1, true);
  assert.equal(runtimeResults.summary.noopCount >= 1, true);
  assert.equal(runtimeEvents.summary.eventCount >= 2, true);
  assert.equal(workspaceIndex.runtime.lastStatus, "noop");
  assert.equal(workspaceIndex.runtime.lastOutcome, "no-eligible-packet");
  assert.equal(workspaceIndex.runtime.activeLeaseCount, 0);
});

test("runAutonomyForeground materializes then executes the same packet in one explicit foreground invocation", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Foreground", objective: "Chain materialize then execute in one foreground run." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";

  recordOperatorFollowThrough(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    status: "accepted-for-execution",
    actorRole,
    decisionSummary: "Allow one planned packet to materialize and then execute in the same foreground invocation.",
    linkedTargetArtifact: ".paper/task-packets/packets/task-queue-discipline.json",
    linkedTargetId: "task-queue-discipline",
    plannedTarget: true,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const result = runAutonomyForeground(root, { actorRole: "planner", maxSteps: 2 });
  assert.equal(result.status, "completed");
  assert.equal(result.stepCount, 2);
  assert.equal(result.steps[0].outcome, "materialized-one-packet");
  assert.equal(result.steps[1].outcome, "executed-one-packet-step");
  assert.equal(result.finalPacketId, "task-queue-discipline");
  assert.equal(result.stopReason, "executed-one-packet-step");

  const continuation = readJson(root, ARTIFACT_PATHS.runtimeContinuation, null);
  assert.equal(continuation.summary.currentKind, "review-follow-through");
  assert.equal(continuation.summary.currentPacketId, "task-queue-discipline");
});

test("runAutonomyControlPlaneOnce leaves a multi-step program authority envelope active after a non-final approved step", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Envelope Active", objective: "Keep a bounded authority envelope active across multiple explicit steps." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-program-envelope-active",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Program envelope packet",
    nextAction: "Run a bounded multi-step program envelope.",
    actorRole: "planner",
    packetAssignedRole: "researcher",
    workerRole: "researcher",
    followThroughId: "follow-through-task-program-envelope-active"
  });

  issueProgramApproval(root, {
    packetId: seeded.packetId,
    programId: "program-envelope-active",
    programTitle: "Program envelope active",
    programObjective: "Advance two explicit bounded steps before review.",
    programRunId: "program-envelope-active-run-1",
    approvalId: "program-envelope-active-approval-1",
    actorRole: "planner",
    workerRole: "researcher",
    stepSequence: [
      { allowedStepType: "refresh-research-brief", stepPayload: null },
      { allowedStepType: "refresh-wiki", stepPayload: null }
    ],
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z",
    summary: "Approve two bounded program-scoped steps before review."
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const programApprovals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const packet = readJson(root, seeded.packetPath, null);
  const continuation = readJson(root, ARTIFACT_PATHS.runtimeContinuation, null);

  assert.equal(result.outcome, "executed-program-step");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-envelope-active-run-1").status, "active");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-envelope-active-run-1").authorityEnvelope.remainingStepCount, 1);
  assert.equal((programApprovals.items ?? []).find((item) => item.id === "program-envelope-active-approval-1").status, "approved");
  assert.equal((programApprovals.items ?? []).find((item) => item.id === "program-envelope-active-approval-1").authorityEnvelope.remainingStepCount, 1);
  assert.equal(packet.lifecycleStatus, "waiting");
  assert.equal(packet.continuationState.status, "ready-to-resume");
  assert.equal(continuation.summary.currentKind, "continue-program-envelope");
  assert.equal(continuation.summary.currentProgramRunId, "program-envelope-active-run-1");
});

test("runAutonomyForeground can exhaust a bounded multi-step program authority envelope in one explicit invocation", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Envelope Foreground", objective: "Drain one bounded program-scoped authority envelope in the foreground." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");
  registerSource(root, { title: "Foreground review source", citationKey: "foreground-envelope-src" });
  upsertNote(root, {
    title: "Foreground review note",
    sectionId: "introduction",
    sourceIds: ["foreground-envelope-src"],
    summary: "A note that gives the review loop concrete evidence to inspect.",
    skipFollowThroughReady: true,
    skipSyncPhase: true
  });

  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-program-envelope-foreground",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Program envelope foreground packet",
    nextAction: "Run the full bounded program envelope in one foreground invocation.",
    actorRole: "planner",
    packetAssignedRole: "researcher",
    workerRole: "researcher",
    followThroughId: "follow-through-task-program-envelope-foreground"
  });

  issueProgramApproval(root, {
    packetId: seeded.packetId,
    programId: "program-envelope-foreground",
    programTitle: "Program envelope foreground",
    programObjective: "Refresh the brief, refresh the wiki, and finish with one review loop before stopping.",
    programRunId: "program-envelope-foreground-run-1",
    approvalId: "program-envelope-foreground-approval-1",
    actorRole: "planner",
    workerRole: "researcher",
    stepSequence: [
      { allowedStepType: "refresh-research-brief", stepPayload: null },
      { allowedStepType: "refresh-wiki", stepPayload: null },
      { allowedStepType: "run-review-loop", stepPayload: { scope: "current paper pipeline", stage: "review-loop" } }
    ],
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z",
    summary: "Approve a three-step foreground program envelope."
  });

  const result = runAutonomyForeground(root, { actorRole: "planner", maxSteps: 5, packetId: seeded.packetId });
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const programApprovals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const continuation = readJson(root, ARTIFACT_PATHS.runtimeContinuation, null);
  const wiki = fs.readFileSync(path.join(root, ARTIFACT_PATHS.wiki), "utf8");
  const reviewState = readJson(root, ARTIFACT_PATHS.reviewState, null);

  assert.equal(result.status, "completed");
  assert.equal(result.stepCount, 3);
  assert.deepEqual(result.steps.map((item) => item.outcome), ["executed-program-step", "executed-program-step", "executed-program-step"]);
  assert.equal(result.finalPacketId, seeded.packetId);
  assert.match(wiki, /Research brief|Objective/);
  assert.equal(reviewState.lastVerdict != null, true);
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-envelope-foreground-run-1").status, "completed");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-envelope-foreground-run-1").closureState, "achieved");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-envelope-foreground-run-1").authorityEnvelope.remainingStepCount, 0);
  assert.equal((programApprovals.items ?? []).find((item) => item.id === "program-envelope-foreground-approval-1").status, "consumed");
  assert.equal(continuation.summary.continuationCount, 0);
});

test("runAutonomyForeground marks a final coherent review-loop closure as achieved", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Closure Achieved", objective: "Reach a coherent final review closure." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "reviewer");

  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-program-closure-achieved",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Closure achieved packet",
    nextAction: "Run one coherent review loop as the final bounded step.",
    actorRole: "planner",
    packetAssignedRole: "reviewer",
    workerRole: "reviewer",
    followThroughId: "follow-through-task-program-closure-achieved"
  });

  issueProgramApproval(root, {
    packetId: seeded.packetId,
    programId: "program-closure-achieved",
    programTitle: "Program closure achieved",
    programObjective: "Close the program with a coherent review verdict.",
    programRunId: "program-closure-achieved-run-1",
    approvalId: "program-closure-achieved-approval-1",
    actorRole: "planner",
    workerRole: "reviewer",
    stepSequence: [
      { allowedStepType: "refresh-wiki", stepPayload: null },
      { allowedStepType: "run-review-loop", stepPayload: { scope: "current paper pipeline", stage: "review-loop" } }
    ],
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z",
    summary: "Approve one final coherent review step."
  });

  const result = runAutonomyForeground(root, { actorRole: "planner", maxSteps: 3, packetId: seeded.packetId });
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const programs = readJson(root, ARTIFACT_PATHS.programsIndex, null);
  const approvals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const continuation = readJson(root, ARTIFACT_PATHS.runtimeContinuation, null);

  assert.equal(result.stepCount, 2);
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-closure-achieved-run-1").status, "completed");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-closure-achieved-run-1").closureState, "achieved");
  assert.equal((programs.items ?? []).find((item) => item.id === "program-closure-achieved").status, "achieved");
  assert.equal((programs.items ?? []).find((item) => item.id === "program-closure-achieved").closureState, "achieved");
  assert.equal((approvals.items ?? []).find((item) => item.id === "program-closure-achieved-approval-1").status, "consumed");
  assert.equal(continuation.summary.continuationCount, 0);
});

test("runAutonomyForeground marks a non-supporting final bridge closure as accepted-risk", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Closure Accepted Risk", objective: "Classify a non-supporting final bridge outcome honestly." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "experiment-planner");

  writeJson(root, ARTIFACT_PATHS.experimentResults, {
    version: 1,
    items: [{ id: "result-closure-risk", experimentId: "exp-closure-risk", claimId: "claim-closure-risk", outcome: "refutes", summary: "Refuting result", evidenceLinks: [ARTIFACT_PATHS.experimentLog], comparisonTargets: [], latestAuditId: null, latestBridgeId: null }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.experimentAudits, {
    version: 1,
    items: [{ id: "audit-closure-risk", experimentId: "exp-closure-risk", resultId: "result-closure-risk", claimId: "claim-closure-risk", reviewedArtifactRefs: [ARTIFACT_PATHS.experimentResults], requiredArtifactRefs: [ARTIFACT_PATHS.experimentResults], missingArtifactRefs: [], auditFindings: [], integrityFlags: [], confidence: "high", outcomeMapping: "refutes", auditVerdict: "clean", bridgeReadiness: "ready", resultOutcome: "refutes", evidenceLinkCount: 1, comparisonTargetCount: 0, claimStateBefore: { status: "draft", confidence: "medium" }, updatedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-closure-risk", text: "Claim closure risk", status: "draft", confidence: "medium", sectionId: "results", sourceIds: [], noteIds: [], experimentIds: ["exp-closure-risk"], evidenceLinks: [], gap: "" }],
    updatedAt: null
  });

  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-program-closure-risk",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Closure accepted-risk packet",
    nextAction: "Run a final non-supporting bridge step.",
    actorRole: "planner",
    packetAssignedRole: "experiment-planner",
    workerRole: "experiment-planner",
    followThroughId: "follow-through-task-program-closure-risk"
  });

  issueProgramApproval(root, {
    packetId: seeded.packetId,
    programId: "program-closure-risk",
    programTitle: "Program closure risk",
    programObjective: "Stop with an accepted-risk bridge outcome.",
    programRunId: "program-closure-risk-run-1",
    approvalId: "program-closure-risk-approval-1",
    actorRole: "planner",
    workerRole: "experiment-planner",
    stepSequence: [
      { allowedStepType: "refresh-research-brief", stepPayload: null },
      { allowedStepType: "bridge-result-to-claim", stepPayload: { resultId: "result-closure-risk", auditIds: ["audit-closure-risk"], reason: "Record the non-supporting outcome honestly." } }
    ],
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z",
    summary: "Approve one final bridge step with a non-supporting result."
  });

  const result = runAutonomyForeground(root, { actorRole: "planner", maxSteps: 3, packetId: seeded.packetId });
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const programs = readJson(root, ARTIFACT_PATHS.programsIndex, null);
  const approvals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const continuation = readJson(root, ARTIFACT_PATHS.runtimeContinuation, null);

  assert.equal(result.stepCount, 2);
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-closure-risk-run-1").closureState, "accepted-risk");
  assert.equal((programs.items ?? []).find((item) => item.id === "program-closure-risk").closureState, "accepted-risk");
  assert.equal((programs.items ?? []).find((item) => item.id === "program-closure-risk").status, "accepted-risk");
  assert.equal((approvals.items ?? []).find((item) => item.id === "program-closure-risk-approval-1").status, "consumed");
  assert.equal(continuation.summary.continuationCount, 0);
});

test("runAutonomyForeground upgrades a final non-review closure to achieved when the objective is explicitly satisfied", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Objective Achieved", objective: "Finish with an explicit objective-aware achieved closure." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-program-objective-achieved",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Objective achieved packet",
    nextAction: "Refresh the wiki as the final goal-bounded step.",
    actorRole: "planner",
    packetAssignedRole: "researcher",
    workerRole: "researcher",
    followThroughId: "follow-through-task-program-objective-achieved"
  });

  issueProgramApproval(root, {
    packetId: seeded.packetId,
    programId: "program-objective-achieved",
    programTitle: "Program objective achieved",
    programObjective: "Refresh wiki surfaces and query pack for this objective-aware closure.",
    programRunId: "program-objective-achieved-run-1",
    approvalId: "program-objective-achieved-approval-1",
    actorRole: "planner",
    workerRole: "researcher",
    stepSequence: [
      { allowedStepType: "refresh-research-brief", stepPayload: null },
      { allowedStepType: "refresh-wiki", stepPayload: null }
    ],
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z",
    summary: "Approve a final wiki closure that explicitly matches the objective."
  });

  const result = runAutonomyForeground(root, { actorRole: "planner", maxSteps: 4, packetId: seeded.packetId });
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const programs = readJson(root, ARTIFACT_PATHS.programsIndex, null);

  assert.equal(result.stepCount, 2);
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-objective-achieved-run-1").closureState, "achieved");
  assert.equal((programs.items ?? []).find((item) => item.id === "program-objective-achieved").closureState, "achieved");
});

test("runAutonomyForeground marks a final non-review closure as objective-unsatisfied when the objective is not clearly satisfied", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Objective Unsatisfied", objective: "Stop honestly when the final step does not satisfy the objective." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-program-objective-unsatisfied",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Objective unsatisfied packet",
    nextAction: "End on a final step that does not clearly satisfy the objective.",
    actorRole: "planner",
    packetAssignedRole: "researcher",
    workerRole: "researcher",
    followThroughId: "follow-through-task-program-objective-unsatisfied"
  });

  issueProgramApproval(root, {
    packetId: seeded.packetId,
    programId: "program-objective-unsatisfied",
    programTitle: "Program objective unsatisfied",
    programObjective: "Capture one source-linked note before stopping.",
    programRunId: "program-objective-unsatisfied-run-1",
    approvalId: "program-objective-unsatisfied-approval-1",
    actorRole: "planner",
    workerRole: "researcher",
    stepSequence: [
      { allowedStepType: "refresh-research-brief", stepPayload: null },
      { allowedStepType: "refresh-wiki", stepPayload: null }
    ],
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z",
    summary: "Approve a final step sequence that does not match the objective."
  });

  const result = runAutonomyForeground(root, { actorRole: "planner", maxSteps: 4, packetId: seeded.packetId });
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const programs = readJson(root, ARTIFACT_PATHS.programsIndex, null);

  assert.equal(result.stepCount, 2);
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-objective-unsatisfied-run-1").closureState, "objective-unsatisfied");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-objective-unsatisfied-run-1").status, "completed");
  assert.equal((programs.items ?? []).find((item) => item.id === "program-objective-unsatisfied").closureState, "objective-unsatisfied");
  assert.equal((programs.items ?? []).find((item) => item.id === "program-objective-unsatisfied").status, "accepted-risk");
});

test("runAutonomyForeground preserves superseded closure when the durable program state is already superseded", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Superseded Closure", objective: "Keep superseded durable state honest at final closure." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-program-superseded-closure",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Superseded closure packet",
    nextAction: "Finish one superseded program envelope honestly.",
    actorRole: "planner",
    packetAssignedRole: "researcher",
    workerRole: "researcher",
    followThroughId: "follow-through-task-program-superseded-closure"
  });

  issueProgramApproval(root, {
    packetId: seeded.packetId,
    programId: "program-superseded-closure",
    programTitle: "Program superseded closure",
    programObjective: "Refresh wiki surfaces for a superseded lineage.",
    programRunId: "program-superseded-closure-run-1",
    approvalId: "program-superseded-closure-approval-1",
    actorRole: "planner",
    workerRole: "researcher",
    stepSequence: [
      { allowedStepType: "refresh-research-brief", stepPayload: null },
      { allowedStepType: "refresh-wiki", stepPayload: null }
    ],
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z",
    summary: "Approve a superseded program envelope."
  });

  const programsBefore = readJson(root, ARTIFACT_PATHS.programsIndex, null);
  writeJson(root, ARTIFACT_PATHS.programsIndex, {
    ...programsBefore,
    items: (programsBefore.items ?? []).map((item) => item.id === "program-superseded-closure"
      ? { ...item, status: "superseded", closureState: "superseded", closureReason: "A newer program replaced this objective." }
      : item)
  });

  const result = runAutonomyForeground(root, { actorRole: "planner", maxSteps: 4, packetId: seeded.packetId });
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const programs = readJson(root, ARTIFACT_PATHS.programsIndex, null);

  assert.equal(result.stepCount, 2);
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-superseded-closure-run-1").closureState, "superseded");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-superseded-closure-run-1").status, "superseded");
  assert.equal((programs.items ?? []).find((item) => item.id === "program-superseded-closure").closureState, "superseded");
  assert.equal((programs.items ?? []).find((item) => item.id === "program-superseded-closure").status, "superseded");
});

test("runAutonomyControlPlaneOnce reports lease conflicts without executing work", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Lease Conflict", objective: "Respect an existing runtime lease." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";
  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-autonomy-lease",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Lease conflict packet",
    nextAction: "Resolve the lease before attempting another run.",
    actorRole
  });

  writeJson(root, ARTIFACT_PATHS.runtimeLeases, {
    version: 1,
    explicitInvocationOnly: true,
    items: [{
      id: "lease-existing",
      runId: "existing-run",
      packetId: seeded.packetId,
      actorRole,
      status: "active",
      acquiredAt: "2099-01-01T00:00:00.000Z",
      expiresAt: "2099-01-01T00:10:00.000Z",
      releasedAt: null,
      releaseReason: null
    }],
    summary: {
      activeLeaseCount: 1,
      activePacketIds: [seeded.packetId],
      activeLeaseIds: ["lease-existing"],
      overview: "1 active autonomous control-plane lease.",
      leasesPath: ARTIFACT_PATHS.runtimeLeases
    },
    updatedAt: "2099-01-01T00:00:00.000Z"
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });

  assert.equal(result.status, "noop");
  assert.equal(result.outcome, "lease-conflict");
  assert.equal(result.packetId, seeded.packetId);

  const runtimeResults = readJson(root, ARTIFACT_PATHS.runtimeResults, null);
  assert.equal(runtimeResults.entries.at(-1).outcome, "lease-conflict");
});

test("runAutonomyControlPlaneOnce executes one bounded packet step and writes durable runtime output", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Single Packet", objective: "Assess one packet and stop." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";
  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-autonomy-single",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Single autonomy packet",
    nextAction: "Review the controller assessment and choose the next manual command.",
    actorRole
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });

  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "executed-one-packet-step");
  assert.equal(result.packetId, seeded.packetId);
  assert.equal(result.followThroughId, seeded.followThroughId);
  assert.equal(result.nextRecommendedCommand, "project:paper.follow-through");

  const runtimeResults = readJson(root, ARTIFACT_PATHS.runtimeResults, null);
  const runtimeEvents = readJson(root, ARTIFACT_PATHS.runtimeEvents, null);
  const runtimeLeases = readJson(root, ARTIFACT_PATHS.runtimeLeases, null);
  const runtimeControllerState = readJson(root, ARTIFACT_PATHS.runtimeControllerState, null);
  const workspaceIndex = queryWorkspaceIndex(root);
  const packet = readJson(root, seeded.packetPath, null);
  const followThrough = readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, null);
  const followThroughItem = (followThrough.items ?? []).find((item) => item.id === seeded.followThroughId);

  assert.equal(runtimeResults.summary.completedCount, 1);
  assert.equal(runtimeResults.entries.at(-1).packetSnapshot.id, seeded.packetId);
  assert.equal(runtimeResults.entries.at(-1).checkpointSnapshot.packetId, seeded.packetId);
  assert.equal(runtimeResults.entries.at(-1).retryState.attemptCount, 1);
  assert.equal(runtimeEvents.entries.some((entry) => entry.eventType === "lease-acquired" && entry.packetId === seeded.packetId), true);
  assert.equal(runtimeEvents.entries.some((entry) => entry.eventType === "step-executed" && entry.packetId === seeded.packetId), true);
  assert.equal(runtimeLeases.items.some((item) => item.packetId === seeded.packetId && item.status === "released"), true);
  assert.equal(runtimeControllerState.summary.requestCount, 0);
  assert.equal(runtimeControllerState.summary.checkpointCount, 1);
  assert.equal(runtimeControllerState.summary.escalationCount, 0);
  assert.equal(runtimeControllerState.summary.lastCheckpointPacketId, seeded.packetId);
  assert.equal(runtimeControllerState.summary.continuationCount, 1);
  assert.equal(runtimeControllerState.summary.currentContinuationKind, "review-follow-through");
  assert.equal(runtimeControllerState.summary.currentContinuationPacketId, seeded.packetId);
  assert.equal(runtimeControllerState.summary.currentContinuationCommand, "project:paper.follow-through");
  assert.equal(packet.lifecycleStatus, "review-needed");
  assert.equal(packet.continuationState.status, "review-needed");
  assert.equal(packet.decisions.some((item) => item.id === `autonomy-step-${result.runId}`), true);
  assert.equal(followThroughItem.status, "closed");
  assert.equal(followThroughItem.retryState.attemptCount, 1);
  assert.equal(followThroughItem.closureArtifactPaths.includes(seeded.packetPath), true);
  assert.equal(workspaceIndex.runtime.lastStatus, "completed");
  assert.equal(workspaceIndex.runtime.lastOutcome, "executed-one-packet-step");
  assert.equal(workspaceIndex.runtime.lastSelectedPacketId, seeded.packetId);
  assert.equal(workspaceIndex.runtime.requestCount, 0);
  assert.equal(workspaceIndex.runtime.checkpointCount, 1);
  assert.equal(workspaceIndex.runtime.escalationCount, 0);
  assert.equal(workspaceIndex.runtime.lastCheckpointPacketId, seeded.packetId);
  assert.equal(workspaceIndex.runtime.continuationCount, 1);
  assert.equal(workspaceIndex.runtime.currentContinuationKind, "review-follow-through");
  assert.equal(workspaceIndex.runtime.currentContinuationPacketId, seeded.packetId);
  assert.equal(workspaceIndex.runtime.activeLeaseCount, 0);
});

test("runAutonomyControlPlaneOnce executes one bounded researcher envelope under planner supervision", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Researcher Envelope", objective: "Advance one researcher-owned packet under planner supervision." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  const materialized = materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-research-envelope",
    title: "Researcher envelope packet",
    nextAction: "Refresh the research brief under bounded autonomy supervision.",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "executed-one-packet-step");
  assert.equal(result.packetId, materialized.packetId);
  assert.equal(result.envelopeSnapshot.workerRole, "researcher");

  const packet = readJson(root, ".paper/task-packets/packets/task-research-envelope.json", null);
  const packetContext = readJson(root, ".paper/context/packets/task-research-envelope.json", null);
  const packetActionBundle = readJson(root, ".paper/context/actions/packet-task-research-envelope.json", null);
  const followThrough = readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, null);
  const followThroughItem = (followThrough.items ?? []).find((item) => item.id === materialized.followThroughId);
  const workspaceIndex = queryWorkspaceIndex(root);

  assert.equal(packet.assignedRole, "researcher");
  assert.equal(packet.autonomyEnvelope.workerRole, "researcher");
  assert.equal(packet.autonomyEnvelope.controllerRole, "planner");
  assert.equal(packet.lifecycleStatus, "review-needed");
  assert.equal(packetContext.autonomyEnvelope.workerRole, "researcher");
  assert.equal(packetActionBundle.autonomyEnvelope.workerRole, "researcher");
  assert.equal(packetActionBundle.requiredReadPaths.includes(".paper/context/roles/researcher.json"), true);
  assert.equal(followThroughItem.actorRole, "planner");
  assert.equal(followThroughItem.workerRole, "researcher");
  assert.equal(workspaceIndex.runtime.lastEnvelopeWorkerRole, "researcher");
});

test("unified autonomy loop skeleton is visible through workspace, task graph, navigation, and meta optimize surfaces", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Unified Loop Skeleton", objective: "Expose explicit autonomy loops without hidden execution." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-unified-loop",
    title: "Unified autonomy loop packet",
    nextAction: "Review one bounded foreground autonomy step.",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });
  runAutonomyControlPlaneOnce(root, { actorRole: "planner" });

  const workspaceIndex = queryWorkspaceIndex(root);
  const taskGraph = queryTaskGraph(root);
  const metaOptimize = queryMetaOptimize(root);
  const navigation = fs.readFileSync(path.join(root, ARTIFACT_PATHS.navigationReport), "utf8");
  const optimizerReport = fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerReport), "utf8");

  const packetLoop = workspaceIndex.autonomyLoops.loops.find((loop) => loop.id === "packet-approval-run-follow-through");

  assert.equal(workspaceIndex.autonomyLoops.contractVersion, "unified-autonomy-loop-v1");
  assert.equal(workspaceIndex.autonomyLoops.loopCount, 4);
  assert.equal(workspaceIndex.autonomyLoops.explicitOnly, true);
  assert.equal(workspaceIndex.autonomyLoops.noHiddenRuntime, true);
  assert.equal(packetLoop.currentStage, "runtime-result");
  assert.equal(packetLoop.lifecycleState, "runtime-result-and-follow-through-closed");
  assert.equal(packetLoop.approvalState, "approval-missing");
  assert.equal(packetLoop.runtimeState, "runtime-result-recorded");
  assert.equal(packetLoop.followThroughState, "follow-through-closed");
  assert.equal(packetLoop.runtimePointers.includes("task-unified-loop"), true);
  assert.equal(workspaceIndex.autonomyLoops.lifecycleStates.includes("runtime-result-and-follow-through-closed"), true);
  assert.equal(workspaceIndex.autonomyLoops.runtimePointers.includes("task-unified-loop"), true);
  assert.match(workspaceIndex.autonomyLoops.safeExecutionPath, /autonomy-foreground/);
  assert.deepEqual(taskGraph.autonomyLoops.loops.map((loop) => loop.id), workspaceIndex.autonomyLoops.loops.map((loop) => loop.id));
  assert.equal(metaOptimize.autonomyLoops.currentLoopId, "question-evidence-claim");
  assert.equal(metaOptimize.autonomyLoops.loops.find((loop) => loop.id === "packet-approval-run-follow-through").lifecycleState, "runtime-result-and-follow-through-closed");
  assert.match(navigation, /Unified autonomy lifecycle state:/);
  assert.match(navigation, /runtime-result-and-follow-through-closed/);
  assert.match(optimizerReport, /Unified autonomy lifecycle state:/);
  assert.match(optimizerReport, /runtime-result-awaiting-follow-through/);
});

test("runAutonomyControlPlaneOnce executes one approved program-level research brief step and leaves board ownership unchanged", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Step", objective: "Run one approved research-brief program step." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");
  const boardBefore = readJson(root, ARTIFACT_PATHS.orchestrationBoard, null);

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-program-step",
    title: "Program step packet",
    nextAction: "Refresh the research brief under approved program supervision.",
    programId: "program-step-alpha",
    programTitle: "Program step alpha",
    programObjective: "Refresh the research brief through one explicit approved program step.",
    programAgenda: ["Record the program-level research objective explicitly."],
    programEvidenceBacklog: ["Need one source-backed note after the refresh."],
    programRunId: "program-step-alpha-run-1",
    approvalId: "program-step-alpha-approval-1",
    programApprovalSummary: "Approved one bounded research brief refresh.",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "executed-program-step");
  assert.equal(result.programSnapshot.programId, "program-step-alpha");
  assert.equal(result.programSnapshot.programRunId, "program-step-alpha-run-1");

  const researchAgenda = readJson(root, ARTIFACT_PATHS.researchAgenda, null);
  const researchBrief = fs.readFileSync(path.join(root, ARTIFACT_PATHS.researchBrief), "utf8");
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const programApprovals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const approvalsView = queryProgramApprovals(root, { programId: "program-step-alpha" });
  const packetActionBundle = readJson(root, ".paper/context/actions/packet-task-program-step.json", null);
  const packetContext = readJson(root, ".paper/context/packets/task-program-step.json", null);
  const workspaceIndex = queryWorkspaceIndex(root);
  const boardAfter = readJson(root, ARTIFACT_PATHS.orchestrationBoard, null);

  assert.equal(researchAgenda.objective, "Refresh the research brief through one explicit approved program step.");
  assert.deepEqual(researchAgenda.agenda, ["Record the program-level research objective explicitly."]);
  assert.match(researchBrief, /Refresh the research brief through one explicit approved program step\./);
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-step-alpha-run-1").status, "review-needed");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-step-alpha-run-1").lastOutcome, "executed-program-step");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-step-alpha-run-1").reviewCheckpointRequired, true);
  assert.match((programRuns.items ?? []).find((item) => item.id === "program-step-alpha-run-1").reviewCheckpointSummary, /requires explicit review/);
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-step-alpha-run-1").nextApprovalIntent.suggestedProgramRunId, "program-step-alpha-run-1-next");
  assert.equal((programApprovals.items ?? []).find((item) => item.id === "program-step-alpha-approval-1").status, "consumed");
  assert.equal(packetContext.programLinkage.programId, "program-step-alpha");
  assert.equal(packetActionBundle.programLinkage.programRunId, "program-step-alpha-run-1");
  assert.equal(packetActionBundle.requiredReadPaths.includes(ARTIFACT_PATHS.programsIndex), true);
  assert.equal(workspaceIndex.programs.currentProgramId, "program-step-alpha");
  assert.equal(workspaceIndex.programs.currentProgramRunId, "program-step-alpha-run-1");
  assert.equal(workspaceIndex.programs.lastProgramOutcome, "executed-program-step");
  assert.equal(workspaceIndex.programs.reviewCheckpointRunCount, 1);
  assert.equal(workspaceIndex.programs.currentReviewCheckpointRunId, "program-step-alpha-run-1");
  const packetLoop = workspaceIndex.autonomyLoops.loops.find((loop) => loop.id === "packet-approval-run-follow-through");
  assert.equal(packetLoop.currentStage, "review-checkpoint");
  assert.equal(packetLoop.lifecycleState, "review-checkpoint-awaiting-fresh-approval");
  assert.equal(packetLoop.approvalState, "fresh-approval-required");
  assert.equal(packetLoop.runtimeState, "review-checkpoint-recorded");
  assert.equal(packetLoop.blockers.includes("program-step-alpha-run-1"), true);
  assert.equal(workspaceIndex.autonomyLoops.activeLifecycleState, "review-checkpoint-awaiting-fresh-approval");
  assert.match(workspaceIndex.autonomyLoops.nextSafeAction, /project:paper\.approvals/);
  assert.equal(workspaceIndex.runtime.continuationCount, 1);
  assert.equal(workspaceIndex.runtime.currentContinuationKind, "issue-fresh-approval");
  assert.equal(workspaceIndex.runtime.currentContinuationProgramRunId, "program-step-alpha-run-1");
  assert.equal(workspaceIndex.runtime.currentContinuationCommand, "project:paper.approvals");
  assert.equal(approvalsView.continuationIntents[0].suggestedProgramRunId, "program-step-alpha-run-1-next");
  assert.equal(boardAfter.assignedRole, boardBefore.assignedRole);
  assert.equal(boardAfter.currentPhase, boardBefore.currentPhase);
});

test("issueProgramApproval can consume a review-to-reapproval intent for note capture", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Note Continuation", objective: "Continue a note-capture lineage from a review checkpoint." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");
  const sourceId = registerSource(root, { title: "A continuation source", citationKey: "note-cont-src" }).id;

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-program-note-continuation",
    title: "Note continuation packet",
    nextAction: "Capture one note, then continue from the review checkpoint.",
    programId: "program-note-continuation",
    programRunId: "program-note-continuation-run-1",
    approvalId: "program-note-continuation-approval-1",
    allowedStepType: "upsert-note",
    noteTitle: "Continuation note",
    noteSectionId: "introduction",
    noteSourceIds: [sourceId],
    noteSummary: "The first note in a continuation lineage.",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });
  const first = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(first.outcome, "executed-program-step");

  const issued = issueProgramApproval(root, {
    continuationFromRunId: "program-note-continuation-run-1",
    actorRole: "planner",
    executeBy: "2099-01-02T00:00:00.000Z",
    reviewAfter: "2099-01-02T12:00:00.000Z"
  });
  const approvalsView = queryProgramApprovals(root, { programId: "program-note-continuation" });

  assert.equal(issued.status, "issued");
  assert.equal(issued.programRunId, "program-note-continuation-run-1-next");
  assert.equal(approvalsView.continuationIntents[0].allowedStepType, "upsert-note");
  assert.equal(approvalsView.continuationIntents[0].stepPayload.title, "Continuation note");
});

test("issueProgramApproval can derive an objective-aware bounded step sequence when no explicit sequence is provided", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Objective Aware Approval", objective: "Derive a bounded program step sequence from the declared objective." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "reviewer");

  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-objective-aware-approval",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Objective aware approval packet",
    nextAction: "Let the system infer the bounded sequence.",
    actorRole: "planner",
    packetAssignedRole: "reviewer",
    workerRole: "reviewer",
    followThroughId: "follow-through-task-objective-aware-approval"
  });

  const issued = issueProgramApproval(root, {
    packetId: seeded.packetId,
    programId: "program-objective-aware-approval",
    programTitle: "Program objective aware approval",
    programObjective: "Refresh wiki surfaces and finish with a coherent review loop.",
    programRunId: "program-objective-aware-approval-run-1",
    approvalId: "program-objective-aware-approval-1",
    actorRole: "planner",
    workerRole: "reviewer",
    autonomyPolicy: "objective-aware-default",
    reviewScope: "current paper pipeline",
    reviewStage: "review-loop",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z",
    summary: "Derive the sequence automatically from the objective."
  });

  const approvals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const approval = (approvals.items ?? []).find((item) => item.id === issued.approvalId);

  assert.deepEqual(approval.authorityEnvelope.stepSequence.map((item) => item.allowedStepType), ["refresh-research-brief", "refresh-wiki", "run-review-loop"]);
});

test("materializeGuidancePacket can persist an objective-aware bounded step sequence without an explicit sequence", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Objective Aware Materialization", objective: "Persist inferred bounded program envelopes during materialization." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");
  const sourceId = registerSource(root, { title: "Objective aware note source", citationKey: "objective-aware-note-src" }).id;

  const materialized = materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    programId: "program-objective-aware-materialization",
    programTitle: "Program objective aware materialization",
    programObjective: "Capture one source-linked note for the introduction.",
    programRunId: "program-objective-aware-materialization-run-1",
    approvalId: "program-objective-aware-materialization-approval-1",
    autonomyPolicy: "objective-aware-default",
    noteTitle: "Objective aware note",
    noteSectionId: "introduction",
    noteSourceIds: [sourceId],
    noteSummary: "A note payload used by the inferred final step.",
    packetId: "task-objective-aware-materialization",
    title: "Objective aware materialized packet",
    nextAction: "Let the runtime consume the inferred note-capture sequence.",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const approvals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const approval = (approvals.items ?? []).find((item) => item.id === "program-objective-aware-materialization-approval-1");

  assert.equal(materialized.packetId, "task-objective-aware-materialization");
  assert.deepEqual(approval.authorityEnvelope.stepSequence.map((item) => item.allowedStepType), ["upsert-note"]);
  assert.equal(approval.authorityEnvelope.stepSequence.at(-1).stepPayload.title, "Objective aware note");
});

test("issueProgramApproval derives a shorter review sequence when the board is already in review phase", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Phase Aware Review Approval", objective: "Derive a shorter review sequence in late phases." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "reviewer");

  upsertOrchestrationBoard(root, {
    phase: "review",
    assignedRole: "reviewer",
    intentType: "review",
    currentFocus: "Already in review.",
    nextAction: "Run the next review step directly."
  });

  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-phase-aware-review-approval",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Phase aware review approval packet",
    nextAction: "Infer a late-phase review sequence.",
    actorRole: "planner",
    packetAssignedRole: "reviewer",
    workerRole: "reviewer",
    followThroughId: "follow-through-task-phase-aware-review-approval"
  });

  const issued = issueProgramApproval(root, {
    packetId: seeded.packetId,
    programId: "program-phase-aware-review-approval",
    programTitle: "Program phase aware review approval",
    programObjective: "Finish with a coherent review loop.",
    programRunId: "program-phase-aware-review-approval-run-1",
    approvalId: "program-phase-aware-review-approval-1",
    actorRole: "planner",
    workerRole: "reviewer",
    autonomyPolicy: "objective-aware-default",
    reviewScope: "current paper pipeline",
    reviewStage: "review-loop",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z",
    summary: "Derive a review-phase-aware sequence automatically."
  });

  const approvals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const approval = (approvals.items ?? []).find((item) => item.id === issued.approvalId);

  assert.deepEqual(approval.authorityEnvelope.stepSequence.map((item) => item.allowedStepType), ["run-review-loop"]);
});

test("materializeGuidancePacket derives a shorter note sequence when the board is already in research phase", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Phase Aware Note Materialization", objective: "Derive a shorter note sequence in research phase." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");
  const sourceId = registerSource(root, { title: "Phase aware note source", citationKey: "phase-aware-note-src" }).id;

  upsertOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "researcher",
    intentType: "research",
    currentFocus: "Already in research.",
    nextAction: "Capture the next note directly."
  });

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    programId: "program-phase-aware-note-materialization",
    programTitle: "Program phase aware note materialization",
    programObjective: "Capture one source-linked note for the introduction.",
    programRunId: "program-phase-aware-note-materialization-run-1",
    approvalId: "program-phase-aware-note-materialization-approval-1",
    autonomyPolicy: "objective-aware-default",
    noteTitle: "Phase aware note",
    noteSectionId: "introduction",
    noteSourceIds: [sourceId],
    noteSummary: "A note payload in research phase.",
    packetId: "task-phase-aware-note-materialization",
    title: "Phase aware note packet",
    nextAction: "Run the inferred note step.",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const approvals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const approval = (approvals.items ?? []).find((item) => item.id === "program-phase-aware-note-materialization-approval-1");

  assert.deepEqual(approval.authorityEnvelope.stepSequence.map((item) => item.allowedStepType), ["upsert-note"]);
});

test("runAutonomyControlPlaneOnce executes one approved program-level wiki refresh step", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Wiki Step", objective: "Run one approved wiki-refresh program step." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-program-wiki-step",
    title: "Wiki step packet",
    nextAction: "Refresh the wiki through one approved program step.",
    programId: "program-wiki-alpha",
    programTitle: "Program wiki alpha",
    programObjective: "Refresh wiki surfaces through one explicit approved program step.",
    programAgenda: ["Expose the current objective through wiki and query surfaces."],
    programEvidenceBacklog: ["Need refreshed query-pack guidance."],
    programRunId: "program-wiki-alpha-run-1",
    approvalId: "program-wiki-alpha-approval-1",
    allowedStepType: "refresh-wiki",
    programApprovalSummary: "Approved one bounded wiki refresh.",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "executed-program-step");
  assert.equal(result.programSnapshot.programId, "program-wiki-alpha");

  const wiki = fs.readFileSync(path.join(root, ARTIFACT_PATHS.wiki), "utf8");
  const queryPack = fs.readFileSync(path.join(root, ARTIFACT_PATHS.queryPack), "utf8");
  const wikiEntities = readJson(root, ARTIFACT_PATHS.wikiEntities, null);
  const wikiRelations = readJson(root, ARTIFACT_PATHS.wikiRelations, null);
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const programApprovals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const workspaceIndex = queryWorkspaceIndex(root);

  assert.match(wiki, /Research brief|Objective/);
  assert.match(queryPack, /Research agenda|Objective|Agenda/);
  assert.ok(Array.isArray(wikiEntities.items));
  assert.ok(Array.isArray(wikiRelations.items));
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-wiki-alpha-run-1").status, "review-needed");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-wiki-alpha-run-1").lastOutcome, "executed-program-step");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-wiki-alpha-run-1").reviewCheckpointRequired, true);
  assert.equal((programApprovals.items ?? []).find((item) => item.id === "program-wiki-alpha-approval-1").status, "consumed");
  assert.equal(workspaceIndex.programs.currentProgramId, "program-wiki-alpha");
  assert.equal(workspaceIndex.programs.lastProgramOutcome, "executed-program-step");
  assert.equal(workspaceIndex.programs.reviewCheckpointRunCount, 1);
});

test("runAutonomyControlPlaneOnce executes one approved program-level note capture step", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Note Step", objective: "Run one approved note-capture program step." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");
  const sourceId = registerSource(root, { title: "A note source", citationKey: "note-step-src" }).id;

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-program-note-step",
    title: "Note step packet",
    nextAction: "Capture one source-linked note through one approved program step.",
    programId: "program-note-alpha",
    programTitle: "Program note alpha",
    programObjective: "Capture one durable source-linked note.",
    programRunId: "program-note-alpha-run-1",
    approvalId: "program-note-alpha-approval-1",
    allowedStepType: "upsert-note",
    noteTitle: "Autonomy note",
    noteSectionId: "introduction",
    noteSourceIds: [sourceId],
    noteSummary: "A source-linked note captured by one approved step.",
    noteOpenQuestions: ["What claim might this note support next?"],
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "executed-program-step");
  assert.equal(result.programSnapshot.programId, "program-note-alpha");

  const notes = readJson(root, ARTIFACT_PATHS.notes, null);
  const queryPack = fs.readFileSync(path.join(root, ARTIFACT_PATHS.queryPack), "utf8");
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const programApprovals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const workspaceIndex = queryWorkspaceIndex(root);

  assert.equal((notes.items ?? []).some((item) => item.title === "Autonomy note" && item.summary === "A source-linked note captured by one approved step."), true);
  assert.match(queryPack, /task-program-note-step-program-note/);
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-note-alpha-run-1").status, "review-needed");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-note-alpha-run-1").nextApprovalIntent.allowedStepType, "upsert-note");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-note-alpha-run-1").nextApprovalIntent.stepPayload.title, "Autonomy note");
  assert.equal((programApprovals.items ?? []).find((item) => item.id === "program-note-alpha-approval-1").status, "consumed");
  assert.equal(workspaceIndex.programs.lastProgramOutcome, "executed-program-step");
});

test("runAutonomyControlPlaneOnce executes one approved program-level experiment audit step", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Audit Step", objective: "Run one approved experiment-audit program step." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "experiment-planner");

  writeJson(root, ARTIFACT_PATHS.experimentPlans, {
    version: 1,
    items: [{ id: "exp-audit-2", title: "Experiment 2", claimId: "claim-2", hypothesis: "H", methodology: "M", successMetric: "S", comparisonTargets: [], status: "planned", owner: "experiment-planner" }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.experimentResults, {
    version: 1,
    items: [{ id: "result-audit-2", experimentId: "exp-audit-2", claimId: "claim-2", outcome: "supports", summary: "Audit me", evidenceLinks: [ARTIFACT_PATHS.experimentLog], comparisonTargets: [], latestAuditId: null, latestBridgeId: null }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-2", text: "Claim 2", status: "draft", confidence: "medium", sectionId: "results", sourceIds: [], noteIds: [], experimentIds: ["exp-audit-2"], evidenceLinks: [], gap: "" }],
    updatedAt: null
  });
  seedAcceptedAutonomyPacket(root, {
    packetId: "task-program-audit-step",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Audit step packet",
    nextAction: "Run one approved experiment audit.",
    actorRole: "planner",
    packetAssignedRole: "experiment-planner",
    workerRole: "experiment-planner",
    followThroughId: "follow-through-task-program-audit-step"
  });

  issueProgramApproval(root, {
    packetId: "task-program-audit-step",
    programId: "program-audit-alpha",
    programTitle: "Program audit alpha",
    programObjective: "Audit one experiment result through one approved step.",
    programRunId: "program-audit-alpha-run-1",
    approvalId: "program-audit-alpha-approval-1",
    actorRole: "planner",
    workerRole: "experiment-planner",
    allowedStepType: "run-experiment-audit",
    auditResultId: "result-audit-2",
    auditReviewedArtifactRefs: [ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentLog],
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z",
    summary: "Approved one bounded experiment audit."
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "executed-program-step");
  assert.equal(result.programSnapshot.programId, "program-audit-alpha");

  const audits = readJson(root, ARTIFACT_PATHS.experimentAudits, null);
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const programApprovals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const workspaceIndex = queryWorkspaceIndex(root);

  assert.equal((audits.items ?? []).some((item) => item.resultId === "result-audit-2"), true);
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-audit-alpha-run-1").status, "review-needed");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-audit-alpha-run-1").nextApprovalIntent.allowedStepType, "run-experiment-audit");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-audit-alpha-run-1").nextApprovalIntent.stepPayload.resultId, "result-audit-2");
  assert.equal((programApprovals.items ?? []).find((item) => item.id === "program-audit-alpha-approval-1").status, "consumed");
  assert.equal(workspaceIndex.programs.lastProgramOutcome, "executed-program-step");
});

test("runAutonomyControlPlaneOnce executes one approved program-level result bridge step", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Bridge Step", objective: "Run one approved result-to-claim bridge step." });
  const { remediationPack } = seedAutonomyGuidance(root);

  writeJson(root, ARTIFACT_PATHS.experimentResults, {
    version: 1,
    items: [{ id: "result-bridge-2", experimentId: "exp-bridge-2", claimId: "claim-bridge-2", outcome: "supports", summary: "Bridge me", evidenceLinks: [ARTIFACT_PATHS.experimentLog], comparisonTargets: [], latestAuditId: null, latestBridgeId: null }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.experimentAudits, {
    version: 1,
    items: [{ id: "audit-bridge-2", experimentId: "exp-bridge-2", resultId: "result-bridge-2", claimId: "claim-bridge-2", reviewedArtifactRefs: [ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentResults], requiredArtifactRefs: [ARTIFACT_PATHS.experimentResults], missingArtifactRefs: [], auditFindings: [], integrityFlags: [], confidence: "high", outcomeMapping: "supports", auditVerdict: "clean", bridgeReadiness: "ready", resultOutcome: "supports", evidenceLinkCount: 1, comparisonTargetCount: 0, claimStateBefore: { status: "draft", confidence: "medium" }, updatedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-bridge-2", text: "Claim bridge", status: "draft", confidence: "medium", sectionId: "results", sourceIds: [], noteIds: [], experimentIds: ["exp-bridge-2"], evidenceLinks: [], gap: "" }],
    updatedAt: null
  });

  seedAcceptedAutonomyPacket(root, {
    packetId: "task-program-bridge-step",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Bridge step packet",
    nextAction: "Run one approved result bridge.",
    actorRole: "planner",
    packetAssignedRole: "experiment-planner",
    workerRole: "experiment-planner",
    followThroughId: "follow-through-task-program-bridge-step"
  });

  issueProgramApproval(root, {
    packetId: "task-program-bridge-step",
    programId: "program-bridge-alpha",
    programTitle: "Program bridge alpha",
    programObjective: "Bridge one audited result into explicit claim state.",
    programRunId: "program-bridge-alpha-run-1",
    approvalId: "program-bridge-alpha-approval-1",
    actorRole: "planner",
    workerRole: "experiment-planner",
    allowedStepType: "bridge-result-to-claim",
    bridgeResultId: "result-bridge-2",
    bridgeAuditIds: ["audit-bridge-2"],
    bridgeReason: "Promote one audited result into claim state.",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z",
    summary: "Approved one bounded result bridge."
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "executed-program-step");
  assert.equal(result.programSnapshot.programId, "program-bridge-alpha");

  const bridgeLog = readJson(root, ARTIFACT_PATHS.claimBridgeLog, null);
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, null);
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const programApprovals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const workspaceIndex = queryWorkspaceIndex(root);

  assert.equal((bridgeLog.items ?? []).some((item) => item.resultId === "result-bridge-2" && item.claimId === "claim-bridge-2"), true);
  assert.equal((evidence.claims ?? []).find((item) => item.id === "claim-bridge-2").latestBridgeId != null, true);
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-bridge-alpha-run-1").status, "review-needed");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-bridge-alpha-run-1").nextApprovalIntent.allowedStepType, "bridge-result-to-claim");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-bridge-alpha-run-1").nextApprovalIntent.stepPayload.resultId, "result-bridge-2");
  assert.equal((programApprovals.items ?? []).find((item) => item.id === "program-bridge-alpha-approval-1").status, "consumed");
  assert.equal(workspaceIndex.programs.lastProgramOutcome, "executed-program-step");
});

test("runAutonomyControlPlaneOnce executes one approved program-level review loop step", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Review Step", objective: "Run one approved review-loop program step." });
  const { remediationPack } = seedAutonomyGuidance(root);

  registerSource(root, { title: "Review source", citationKey: "review-src" });
  upsertNote(root, {
    title: "Review note",
    sectionId: "introduction",
    sourceIds: ["review-src"],
    summary: "A note that still leaves the paper unsupported enough for review findings.",
    skipFollowThroughReady: true,
    skipSyncPhase: true
  });

  seedAcceptedAutonomyPacket(root, {
    packetId: "task-program-review-step",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Review step packet",
    nextAction: "Run one approved review loop.",
    actorRole: "planner",
    packetAssignedRole: "reviewer",
    workerRole: "reviewer",
    followThroughId: "follow-through-task-program-review-step"
  });

  issueProgramApproval(root, {
    packetId: "task-program-review-step",
    programId: "program-review-alpha",
    programTitle: "Program review alpha",
    programObjective: "Run one review loop through one approved step.",
    programRunId: "program-review-alpha-run-1",
    approvalId: "program-review-alpha-approval-1",
    actorRole: "planner",
    workerRole: "reviewer",
    allowedStepType: "run-review-loop",
    reviewScope: "current paper pipeline",
    reviewStage: "review-loop",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z",
    summary: "Approved one bounded review loop."
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "executed-program-step");
  assert.equal(result.programSnapshot.programId, "program-review-alpha");

  const reviewState = readJson(root, ARTIFACT_PATHS.reviewState, null);
  const reviewConcerns = readJson(root, ARTIFACT_PATHS.reviewConcerns, null);
  const revisionPlan = fs.readFileSync(path.join(root, ARTIFACT_PATHS.revisionPlan), "utf8");
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  const programApprovals = readJson(root, ARTIFACT_PATHS.programApprovals, null);
  const workspaceIndex = queryWorkspaceIndex(root);

  assert.equal(reviewState.lastVerdict != null, true);
  assert.ok(Array.isArray(reviewConcerns.items));
  assert.match(revisionPlan, /Current revision plan/);
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-review-alpha-run-1").status, "review-needed");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-review-alpha-run-1").nextApprovalIntent.allowedStepType, "run-review-loop");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-review-alpha-run-1").nextApprovalIntent.stepPayload.scope, "current paper pipeline");
  assert.equal((programApprovals.items ?? []).find((item) => item.id === "program-review-alpha-approval-1").status, "consumed");
  assert.equal(workspaceIndex.programs.lastProgramOutcome, "executed-program-step");
});

test("runAutonomyControlPlaneOnce does not reuse a consumed approval after review-needed even if packet state is reset", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Approval Replay", objective: "Reject replay of consumed approvals after review-needed." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  const materialized = materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-program-replay",
    title: "Replay packet",
    nextAction: "Run once, then attempt replay with the same approval.",
    programId: "program-replay-alpha",
    programRunId: "program-replay-alpha-run-1",
    approvalId: "program-replay-alpha-approval-1",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const first = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(first.outcome, "executed-program-step");

  const packetPath = ".paper/task-packets/packets/task-program-replay.json";
  const packet = readJson(root, packetPath, null);
  writeJson(root, packetPath, {
    ...packet,
    lifecycleStatus: "waiting",
    continuationState: { ...(packet.continuationState ?? {}), status: "ready-to-resume" }
  });
  const packetIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, null);
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    ...packetIndex,
    items: (packetIndex.items ?? []).map((item) => item.id === materialized.packetId
      ? { ...item, lifecycleStatus: "waiting", continuationState: { ...(item.continuationState ?? {}), status: "ready-to-resume" } }
      : item)
  });
  const followThrough = readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, null);
  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, {
    ...followThrough,
    items: (followThrough.items ?? []).map((item) => item.id === materialized.followThroughId
      ? {
          ...item,
          status: "accepted-for-execution",
          executeBy: "2099-01-01T00:00:00.000Z",
          reviewAfter: "2099-01-01T12:00:00.000Z"
        }
      : item)
  });

  const replay = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(replay.status, "noop");
  assert.equal(replay.outcome, "no-eligible-packet");
});

test("runAutonomyControlPlaneOnce requires a fresh program run and approval after a review-needed checkpoint", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Reapproval", objective: "Require fresh run/approval after review-needed." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-program-reapproval-a",
    title: "First program packet",
    nextAction: "Create a review-needed checkpoint.",
    programId: "program-reauthorize-alpha",
    programRunId: "program-reauthorize-alpha-run-1",
    approvalId: "program-reauthorize-alpha-approval-1",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });
  const first = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(first.outcome, "executed-program-step");

  const reused = seedAcceptedAutonomyPacket(root, {
    packetId: "task-program-reapproval-bad",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Reused run packet",
    nextAction: "This should fail because the run is awaiting review.",
    actorRole: "planner",
    packetAssignedRole: "researcher",
    workerRole: "researcher",
    followThroughId: "follow-through-task-program-reapproval-bad"
  });

  const reusedPacket = readJson(root, reused.packetPath, null);
  writeJson(root, reused.packetPath, {
    ...reusedPacket,
    lineage: {
      ...(reusedPacket.lineage ?? {}),
      programId: "program-reauthorize-alpha",
      programRunId: "program-reauthorize-alpha-run-1",
      approvalId: "program-reauthorize-alpha-approval-1"
    },
    materialization: {
      ...(reusedPacket.materialization ?? {}),
      programId: "program-reauthorize-alpha",
      programRunId: "program-reauthorize-alpha-run-1",
      approvalId: "program-reauthorize-alpha-approval-1"
    }
  });
  const reusedIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, null);
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    ...reusedIndex,
    items: (reusedIndex.items ?? []).map((item) => item.id === reused.packetId
      ? {
          ...item,
          lineage: { ...(item.lineage ?? {}), programId: "program-reauthorize-alpha", programRunId: "program-reauthorize-alpha-run-1", approvalId: "program-reauthorize-alpha-approval-1" },
          materialization: { ...(item.materialization ?? {}), programId: "program-reauthorize-alpha", programRunId: "program-reauthorize-alpha-run-1", approvalId: "program-reauthorize-alpha-approval-1" }
        }
      : item)
  });
  recordOperatorFollowThrough(root, {
    id: reused.followThroughId,
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    status: "accepted-for-execution",
    actorRole: "planner",
    workerRole: "researcher",
    programId: "program-reauthorize-alpha",
    programRunId: "program-reauthorize-alpha-run-1",
    approvalId: "program-reauthorize-alpha-approval-1",
    decisionSummary: "Reusing the old consumed approval should fail.",
    linkedTargetArtifact: reused.packetPath,
    linkedTargetId: reused.packetId,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const blocked = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(blocked.status, "noop");
  assert.equal(blocked.outcome, "no-eligible-packet");

  const issued = issueProgramApproval(root, {
    continuationFromRunId: "program-reauthorize-alpha-run-1",
    actorRole: "planner",
    executeBy: "2099-01-02T00:00:00.000Z",
    reviewAfter: "2099-01-02T12:00:00.000Z"
  });
  assert.equal(issued.status, "issued");
  assert.equal(issued.programRunId, "program-reauthorize-alpha-run-1-next");

  const continued = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(continued.outcome, "executed-program-step");
  assert.equal(continued.programSnapshot.programRunId, "program-reauthorize-alpha-run-1-next");
});

test("runAutonomyControlPlaneOnce blocks program-linked execution when approval is revoked", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Program Approval Gate", objective: "Reject revoked program approvals." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-program-revoked",
    title: "Revoked program packet",
    nextAction: "This should not run because approval is revoked.",
    programId: "program-revoked",
    programTitle: "Program revoked",
    programObjective: "This objective should never reach the brief.",
    programAgenda: ["This agenda should stay pending."],
    programEvidenceBacklog: ["This backlog should stay pending."],
    programRunId: "program-revoked-run-1",
    approvalId: "program-revoked-approval-1",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const revoked = revokeProgramApproval(root, {
    approvalId: "program-revoked-approval-1",
    actorRole: "planner",
    summary: "Revoked before the next bounded step.",
    revokeReason: "manual-stop"
  });
  assert.equal(revoked.status, "revoked");

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "noop");
  assert.equal(result.outcome, "no-eligible-packet");

  const researchAgenda = readJson(root, ARTIFACT_PATHS.researchAgenda, null);
  const programRuns = readJson(root, ARTIFACT_PATHS.programRuns, null);
  assert.notEqual(researchAgenda.objective, "This objective should never reach the brief.");
  assert.equal((programRuns.items ?? []).find((item) => item.id === "program-revoked-run-1").lastOutcome, "approval-revoked");
});

test("runAutonomyControlPlaneOnce rejects envelope packets whose worker role does not match packet ownership", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Envelope Mismatch", objective: "Reject invalid role-envelope ownership mismatches." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  seedAcceptedAutonomyPacket(root, {
    packetId: "task-envelope-mismatch",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Envelope mismatch packet",
    nextAction: "This packet should not execute because the envelope worker role is wrong.",
    actorRole: "planner",
    packetAssignedRole: "reviewer",
    workerRole: "researcher"
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "noop");
  assert.equal(result.outcome, "no-eligible-packet");
  assert.equal(result.inspectedPacketIds.includes("task-envelope-mismatch"), true);

  const packet = readJson(root, ".paper/task-packets/packets/task-envelope-mismatch.json", null);
  const workspaceIndex = queryWorkspaceIndex(root);
  assert.equal(packet.lifecycleStatus, "waiting");
  assert.equal(workspaceIndex.runtime.lastOutcome, "no-eligible-packet");
});

test("runAutonomyControlPlaneOnce requires an explicit envelope before planner can supervise a non-planner packet", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Missing Envelope", objective: "Reject non-planner packet execution without an explicit autonomy envelope." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-missing-envelope",
    title: "Missing envelope packet",
    nextAction: "This packet should not execute once the explicit envelope is removed.",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const packetPath = ".paper/task-packets/packets/task-missing-envelope.json";
  const packet = readJson(root, packetPath, null);
  writeJson(root, packetPath, {
    ...packet,
    autonomyEnvelope: null
  });
  const packetIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, null);
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    ...packetIndex,
    items: (packetIndex.items ?? []).map((item) => item.id === "task-missing-envelope"
      ? { ...item, autonomyEnvelope: null }
      : item)
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "noop");
  assert.equal(result.outcome, "no-eligible-packet");
  assert.equal(result.inspectedPacketIds.includes("task-missing-envelope"), true);

  const refreshedPacket = readJson(root, packetPath, null);
  assert.equal(refreshedPacket.lifecycleStatus, "waiting");
});

test("runAutonomyControlPlaneOnce does not adopt a non-planner accepted follow-through without planner authority", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Controller Mismatch", objective: "Reject non-planner accepted follow-through during planner-supervised selection." });
  const remediationPack = seedRoleScopedAutonomyGuidance(root, "researcher");

  seedAcceptedAutonomyPacket(root, {
    packetId: "task-controller-mismatch",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Controller mismatch packet",
    nextAction: "This packet should not execute because follow-through authority belongs to researcher.",
    actorRole: "researcher",
    packetAssignedRole: "planner"
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "noop");
  assert.equal(result.outcome, "no-eligible-packet");
  assert.equal(result.inspectedPacketIds.includes("task-controller-mismatch"), true);
});

test("runAutonomyControlPlaneOnce deterministically selects the stable eligible packet when same-source candidates drift", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Multi Packet", objective: "Select the stable eligible packet when same-source competition drifts." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const remediationActorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";

  seedAcceptedAutonomyPacket(root, {
    packetId: "task-autonomy-a",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "First autonomy packet",
    nextAction: "Inspect the first eligible packet.",
    actorRole: remediationActorRole
  });
  seedAcceptedAutonomyPacket(root, {
    packetId: "task-autonomy-b",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Second autonomy packet",
    nextAction: "Inspect the second eligible packet.",
    actorRole: remediationActorRole,
    followThroughId: "follow-through-task-autonomy-b"
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });

  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "executed-one-packet-step");
  assert.equal(result.packetId, "task-autonomy-b");
  assert.equal(result.arbitration.candidateFamily, "eligible-packets");
  assert.equal(result.arbitration.candidateCount, 1);
  assert.deepEqual(result.arbitration.rankedPacketIds, ["task-autonomy-b"]);
  assert.equal(result.arbitration.selectedPacketId, "task-autonomy-b");

  const runtimeLeases = readJson(root, ARTIFACT_PATHS.runtimeLeases, null);
  const runtimeResults = readJson(root, ARTIFACT_PATHS.runtimeResults, null);
  const workspaceIndex = queryWorkspaceIndex(root);
  assert.equal(runtimeLeases.items.some((item) => item.packetId === "task-autonomy-b" && item.status === "released"), true);
  assert.equal(runtimeLeases.items.some((item) => item.packetId === "task-autonomy-a"), false);
  assert.equal(runtimeResults.entries.at(-1).arbitration.selectedPacketId, "task-autonomy-b");
  assert.equal(workspaceIndex.runtime.lastSelectedPacketId, "task-autonomy-b");
});

test("runAutonomyControlPlaneOnce keeps retryable worker failures in executing state with durable retry metadata", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Retry Pending", objective: "Keep retryable worker failures open with durable retry metadata." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";
  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-autonomy-retry",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Retryable autonomy packet",
    nextAction: "Refresh stale context before retrying the bounded worker step.",
    actorRole
  });

  const packet = readJson(root, seeded.packetPath, null);
  writeJson(root, seeded.packetPath, {
    ...packet,
    lifecycleStatus: "stale"
  });
  const packetIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, null);
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    ...packetIndex,
    items: (packetIndex.items ?? []).map((item) => item.id === seeded.packetId
      ? { ...item, lifecycleStatus: "stale" }
      : item)
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "worker-step-retry-pending");
  assert.equal(result.retryState.attemptCount, 1);

  const updatedPacket = readJson(root, seeded.packetPath, null);
  const followThrough = readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, null);
  const followThroughItem = (followThrough.items ?? []).find((item) => item.id === seeded.followThroughId);
  const runtimeControllerState = readJson(root, ARTIFACT_PATHS.runtimeControllerState, null);
  const workspaceIndex = queryWorkspaceIndex(root);

  assert.equal(updatedPacket.lifecycleStatus, "stale");
  assert.equal(updatedPacket.continuationState.status, "retry-pending");
  assert.equal(followThroughItem.status, "executing");
  assert.equal(followThroughItem.retryState.attemptCount, 1);
  assert.match(followThroughItem.retryState.lastError, /stale/);
  assert.equal(runtimeControllerState.summary.requestCount, 1);
  assert.equal(runtimeControllerState.summary.executingRequestCount, 1);
  assert.equal(runtimeControllerState.summary.checkpointCount, 1);
  assert.equal(runtimeControllerState.summary.escalationCount, 0);
  assert.equal(workspaceIndex.runtime.executingRequestCount, 1);
  assert.equal(workspaceIndex.runtime.checkpointCount, 1);
});

test("runAutonomyControlPlaneOnce escalates bounded worker failures once retry budget is exhausted", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Escalation", objective: "Escalate bounded worker failures after the retry budget is exhausted." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";
  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-autonomy-escalate",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Escalating autonomy packet",
    nextAction: "Escalate after repeated stale retries.",
    actorRole
  });

  const packet = readJson(root, seeded.packetPath, null);
  writeJson(root, seeded.packetPath, {
    ...packet,
    lifecycleStatus: "stale"
  });
  const packetIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, null);
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    ...packetIndex,
    items: (packetIndex.items ?? []).map((item) => item.id === seeded.packetId
      ? { ...item, lifecycleStatus: "stale" }
      : item)
  });

  recordOperatorFollowThrough(root, {
    id: seeded.followThroughId,
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    status: "executing",
    actorRole,
    decisionSummary: "Previous bounded worker attempts already started.",
    linkedTargetArtifact: seeded.packetPath,
    linkedTargetId: seeded.packetId,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z",
    executionStartedAt: "2099-01-01T00:00:00.000Z",
    retryState: {
      attemptCount: 2,
      maxAttempts: 3,
      lastAttemptAt: "2099-01-01T00:30:00.000Z",
      lastError: "Packet remains stale.",
      escalatedAt: null
    }
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "worker-step-escalated");
  assert.equal(result.retryState.attemptCount, 3);

  const updatedPacket = readJson(root, seeded.packetPath, null);
  const followThrough = readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, null);
  const followThroughItem = (followThrough.items ?? []).find((item) => item.id === seeded.followThroughId);
  const runtimeControllerState = readJson(root, ARTIFACT_PATHS.runtimeControllerState, null);
  const workspaceIndex = queryWorkspaceIndex(root);

  assert.equal(updatedPacket.continuationState.status, "blocked");
  assert.equal(followThroughItem.status, "deferred");
  assert.ok(followThroughItem.deferUntil);
  assert.ok(followThroughItem.retryState.escalatedAt);
  assert.equal(followThroughItem.retryState.attemptCount, 3);
  assert.equal(runtimeControllerState.summary.escalationCount, 1);
  assert.equal(runtimeControllerState.summary.lastEscalationPacketId, seeded.packetId);
  assert.equal(workspaceIndex.runtime.escalationCount, 1);
  assert.equal(workspaceIndex.runtime.lastEscalationPacketId, seeded.packetId);
});

test("runAutonomyControlPlaneOnce still prioritizes eligible packet assessment over planned materialization", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Eligibility Precedence", objective: "Prefer assessing an eligible packet before materializing a planned target." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";
  const seeded = seedAcceptedAutonomyPacket(root, {
    packetId: "task-autonomy-existing",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    sourceArtifactPath: remediationPack.sourceArtifactPath,
    title: "Existing autonomy packet",
    nextAction: "Inspect the already materialized packet first.",
    actorRole
  });

  recordOperatorFollowThrough(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    status: "accepted-for-execution",
    actorRole,
    decisionSummary: "Autonomy may materialize this pack into one future packet if no eligible packet exists.",
    linkedTargetArtifact: ".paper/task-packets/packets/task-queue-discipline.json",
    linkedTargetId: "task-queue-discipline",
    plannedTarget: true,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });

  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "executed-one-packet-step");
  assert.equal(result.packetId, seeded.packetId);
  assert.equal(fs.existsSync(path.join(root, ".paper/task-packets/packets/task-queue-discipline.json")), false);
});

test("runAutonomyControlPlaneOnce materializes one accepted remediation path when no packet exists yet", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Materialize", objective: "Materialize one accepted guidance path autonomously." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";
  const defaultPacketId = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.targetId;
  assert.notEqual(defaultPacketId, "task-queue-discipline");
  recordOperatorFollowThrough(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    status: "accepted-for-execution",
    actorRole,
    decisionSummary: "Autonomy may materialize this pack into one packet.",
    selectedConversionPathKey: remediationPack.rankedConversionPaths?.[0]?.deterministicKey ?? null,
    linkedTargetArtifact: ".paper/task-packets/packets/task-queue-discipline.json",
    linkedTargetId: "task-queue-discipline",
    plannedTarget: true,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "materialized-one-packet");
  assert.equal(result.packetId, "task-queue-discipline");
  assert.equal(result.requestSnapshot.requestCount, 1);
  const packet = readJson(root, ".paper/task-packets/packets/task-queue-discipline.json", null);
  const runtimeControllerState = readJson(root, ARTIFACT_PATHS.runtimeControllerState, null);
  const workspaceIndex = queryWorkspaceIndex(root);
  assert.equal(packet.id, "task-queue-discipline");
  assert.equal(packet.materialization.sourceId, remediationPack.id);
  assert.equal(runtimeControllerState.summary.requestCount, 1);
  assert.equal(runtimeControllerState.summary.acceptedRequestCount, 1);
  assert.equal(runtimeControllerState.summary.checkpointCount, 0);
  assert.equal(workspaceIndex.runtime.requestCount, 1);
  assert.equal(workspaceIndex.runtime.checkpointCount, 0);
});

test("runAutonomyControlPlaneOnce preserves the selected planned follow-through id during materialization", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Materialize Follow-Through", objective: "Reuse the selected planned follow-through record during materialization." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";

  recordOperatorFollowThrough(root, {
    id: "follow-through-custom-materialization",
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    status: "accepted-for-execution",
    actorRole,
    decisionSummary: "Autonomy may materialize this pack into one packet using the existing planned follow-through record.",
    linkedTargetArtifact: ".paper/task-packets/packets/task-custom-materialization.json",
    linkedTargetId: "task-custom-materialization",
    plannedTarget: true,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "materialized-one-packet");
  assert.equal(result.followThroughId, "follow-through-custom-materialization");

  const packet = readJson(root, ".paper/task-packets/packets/task-custom-materialization.json", null);
  const followThrough = readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, null);
  const matchingItems = (followThrough.items ?? []).filter((item) => item.sourceType === "remediation-pack" && item.sourceId === remediationPack.id);

  assert.equal(packet.materialization.followThroughId, "follow-through-custom-materialization");
  assert.equal(matchingItems.length, 1);
  assert.equal(matchingItems[0].id, "follow-through-custom-materialization");
  assert.equal(matchingItems[0].plannedTarget, false);
  assert.equal(matchingItems[0].targetBound, true);
  assert.equal(matchingItems[0].linkedTargetId, "task-custom-materialization");
});

test("runAutonomyControlPlaneOnce deterministically ranks multiple planned materialization candidates by executeBy and reviewAfter", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Planned Arbitration", objective: "Rank multiple planned materialization candidates deterministically." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";

  seedPlannedAutonomyMaterialization(root, {
    sourceId: remediationPack.id,
    actorRole,
    followThroughId: "follow-through-planned-late",
    linkedTargetId: "task-planned-late",
    executeBy: "2099-01-03T00:00:00.000Z",
    reviewAfter: "2099-01-03T12:00:00.000Z"
  });
  seedPlannedAutonomyMaterialization(root, {
    sourceId: remediationPack.id,
    actorRole,
    followThroughId: "follow-through-planned-review-earlier",
    linkedTargetId: "task-planned-review-earlier",
    executeBy: "2099-01-02T00:00:00.000Z",
    reviewAfter: "2099-01-02T06:00:00.000Z"
  });
  seedPlannedAutonomyMaterialization(root, {
    sourceId: remediationPack.id,
    actorRole,
    followThroughId: "follow-through-planned-earliest",
    linkedTargetId: "task-planned-earliest",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-02T12:00:00.000Z"
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "materialized-one-packet");
  assert.equal(result.packetId, "task-planned-earliest");
  assert.equal(result.followThroughId, "follow-through-planned-earliest");
  assert.equal(result.arbitration.candidateFamily, "planned-materializations");
  assert.equal(result.arbitration.candidateCount, 3);
  assert.deepEqual(result.arbitration.rankedPacketIds, [
    "task-planned-earliest",
    "task-planned-review-earlier",
    "task-planned-late"
  ]);
  assert.equal(result.arbitration.selectedFollowThroughId, "follow-through-planned-earliest");

  const runtimeResults = readJson(root, ARTIFACT_PATHS.runtimeResults, null);
  assert.equal(runtimeResults.entries.at(-1).arbitration.selectedFollowThroughId, "follow-through-planned-earliest");
});

test("runAutonomyControlPlaneOnce uses packet id as the planned materialization tie-break when timing matches", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Planned Tie-Break", objective: "Use packet id as the deterministic tie-break for planned materialization." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";

  seedPlannedAutonomyMaterialization(root, {
    sourceId: remediationPack.id,
    actorRole,
    followThroughId: "follow-through-planned-zeta",
    linkedTargetId: "task-zeta"
  });
  seedPlannedAutonomyMaterialization(root, {
    sourceId: remediationPack.id,
    actorRole,
    followThroughId: "follow-through-planned-alpha",
    linkedTargetId: "task-alpha"
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "materialized-one-packet");
  assert.equal(result.packetId, "task-alpha");
  assert.deepEqual(result.arbitration.rankedPacketIds, ["task-alpha", "task-zeta"]);
});

test("runAutonomyControlPlaneOnce excludes planned materialization guidance with a non-packet selected conversion path", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Planned Invalid Path", objective: "Reject invalid planned materialization path bindings." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";
  const nonPacketPath = remediationPack.rankedConversionPaths?.find((item) => item.targetType !== "create-new-packet");
  assert.ok(nonPacketPath);

  seedPlannedAutonomyMaterialization(root, {
    sourceId: remediationPack.id,
    actorRole,
    followThroughId: "follow-through-planned-invalid-path",
    linkedTargetId: "task-planned-invalid-path",
    selectedConversionPathKey: nonPacketPath.deterministicKey
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "noop");
  assert.equal(result.outcome, "no-eligible-packet");
  assert.equal(result.materializationCandidateCount, 0);
  assert.equal(fs.existsSync(path.join(root, ".paper/task-packets/packets/task-planned-invalid-path.json")), false);
});

test("runAutonomyControlPlaneOnce excludes stale planned remediation guidance after source drift", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Planned Stale", objective: "Exclude stale planned remediation guidance after source drift." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";

  seedPlannedAutonomyMaterialization(root, {
    sourceId: remediationPack.id,
    actorRole,
    followThroughId: "follow-through-planned-stale",
    linkedTargetId: "task-planned-stale"
  });

  const followThrough = readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, null);
  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, {
    ...followThrough,
    items: (followThrough.items ?? []).map((item) => item.id === "follow-through-planned-stale"
      ? { ...item, sourceFingerprint: "stale-source-fingerprint" }
      : item)
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "noop");
  assert.equal(result.outcome, "no-eligible-packet");
  assert.equal(result.materializationCandidateCount, 0);

  const refreshedFollowThrough = queryMetaOptimize(root).operatorFollowThrough;
  const item = (refreshedFollowThrough.items ?? []).find((entry) => entry.id === "follow-through-planned-stale");
  assert.equal(item?.stale, true);
});

test("materializeGuidancePacket rejects stale planned remediation guidance before writing a packet even without followThroughId", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Direct Remediation Stale Guard", objective: "Reject stale remediation guidance before direct packet writes." });
  const { remediationPack } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";

  seedPlannedAutonomyMaterialization(root, {
    sourceId: remediationPack.id,
    actorRole,
    followThroughId: "follow-through-remediation-stale-direct",
    linkedTargetId: "task-remediation-stale-direct"
  });

  const followThrough = readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, null);
  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, {
    ...followThrough,
    items: (followThrough.items ?? []).map((item) => item.id === "follow-through-remediation-stale-direct"
      ? { ...item, sourceFingerprint: "stale-remediation-direct-fingerprint" }
      : item)
  });

  assert.throws(() => materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole,
    packetId: "task-remediation-stale-direct",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }), /planned follow-through is stale/);

  assert.equal(fs.existsSync(path.join(root, ".paper/task-packets/packets/task-remediation-stale-direct.json")), false);
});

test("runAutonomyControlPlaneOnce materializes one accepted execution-bridge packet candidate when no eligible packet exists", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Execution Bridge", objective: "Materialize one accepted execution-bridge packet candidate autonomously." });
  const { executionBridgeCandidate } = seedAutonomyGuidance(root);
  assert.ok(executionBridgeCandidate);
  assert.equal(executionBridgeCandidate.candidateType, "packet-candidate");
  assert.equal(executionBridgeCandidate.sourceConversionPath?.targetType, "create-new-packet");

  seedPlannedAutonomyMaterialization(root, {
    sourceType: "execution-bridge",
    sourceId: executionBridgeCandidate.id,
    actorRole: executionBridgeCandidate.sourceConversionPath?.assignedRole ?? "planner",
    followThroughId: "follow-through-execution-bridge",
    linkedTargetId: executionBridgeCandidate.targetId
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "materialized-one-packet");
  assert.equal(result.packetId, executionBridgeCandidate.targetId);
  assert.equal(result.followThroughId, "follow-through-execution-bridge");

  const packet = readJson(root, `.paper/task-packets/packets/${executionBridgeCandidate.targetId}.json`, null);
  const followThrough = readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, null);
  const matchingItems = (followThrough.items ?? []).filter((item) => item.sourceType === "execution-bridge" && item.sourceId === executionBridgeCandidate.id);
  assert.equal(packet.materialization.sourceType, "execution-bridge");
  assert.equal(packet.materialization.sourceId, executionBridgeCandidate.id);
  assert.equal(packet.materialization.followThroughId, "follow-through-execution-bridge");
  assert.equal(packet.assignedRole, executionBridgeCandidate.sourceConversionPath?.assignedRole ?? "planner");
  assert.equal(matchingItems.length, 1);
  assert.equal(matchingItems[0].id, "follow-through-execution-bridge");
  assert.equal(matchingItems[0].plannedTarget, false);
  assert.equal(matchingItems[0].targetBound, true);
  assert.equal(matchingItems[0].linkedTargetId, executionBridgeCandidate.targetId);
  assert.equal(matchingItems[0].sourceArtifactPath, ARTIFACT_PATHS.metaExecutionBridgeCandidates);
});

test("materializeGuidancePacket rejects an execution-bridge follow-through id that does not match the planned packet target before writing a packet", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Execution Bridge Rebind Guard", objective: "Reject mismatched execution-bridge follow-through rebinding before packet writes." });
  const { executionBridgeCandidate } = seedAutonomyGuidance(root);
  assert.ok(executionBridgeCandidate);

  seedPlannedAutonomyMaterialization(root, {
    sourceType: "execution-bridge",
    sourceId: executionBridgeCandidate.id,
    actorRole: executionBridgeCandidate.sourceConversionPath?.assignedRole ?? "planner",
    followThroughId: "follow-through-execution-bridge-wrong-target",
    linkedTargetId: "task-wrong-target"
  });

  assert.throws(() => materializeGuidancePacket(root, {
    sourceType: "execution-bridge",
    sourceId: executionBridgeCandidate.id,
    actorRole: executionBridgeCandidate.sourceConversionPath?.assignedRole ?? "planner",
    followThroughId: "follow-through-execution-bridge-wrong-target",
    packetId: executionBridgeCandidate.targetId,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }), /does not match intended packet target/);

  assert.equal(fs.existsSync(path.join(root, `.paper/task-packets/packets/${executionBridgeCandidate.targetId}.json`)), false);
});

test("materializeGuidancePacket rejects stale planned execution-bridge guidance before writing a packet", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Execution Bridge Stale Guard", objective: "Reject stale execution-bridge guidance before packet writes." });
  const { executionBridgeCandidate } = seedAutonomyGuidance(root);
  assert.ok(executionBridgeCandidate);

  seedPlannedAutonomyMaterialization(root, {
    sourceType: "execution-bridge",
    sourceId: executionBridgeCandidate.id,
    actorRole: executionBridgeCandidate.sourceConversionPath?.assignedRole ?? "planner",
    followThroughId: "follow-through-execution-bridge-stale",
    linkedTargetId: executionBridgeCandidate.targetId
  });

  const followThrough = readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, null);
  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, {
    ...followThrough,
    items: (followThrough.items ?? []).map((item) => item.id === "follow-through-execution-bridge-stale"
      ? { ...item, sourceFingerprint: "stale-execution-bridge-fingerprint" }
      : item)
  });

  assert.throws(() => materializeGuidancePacket(root, {
    sourceType: "execution-bridge",
    sourceId: executionBridgeCandidate.id,
    actorRole: executionBridgeCandidate.sourceConversionPath?.assignedRole ?? "planner",
    packetId: executionBridgeCandidate.targetId,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }), /planned follow-through is stale/);

  assert.equal(fs.existsSync(path.join(root, `.paper/task-packets/packets/${executionBridgeCandidate.targetId}.json`)), false);
});

test("runAutonomyControlPlaneOnce ignores planned execution-bridge guidance for non-packet candidates", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Execution Bridge Reject", objective: "Ignore planned execution-bridge guidance that is not a packet candidate." });
  const meta = seedAutonomyGuidance(root);
  const nonPacketCandidate = queryMetaOptimize(root).executionBridgeCandidates.candidates.find((item) => item.candidateType !== "packet-candidate");
  assert.ok(nonPacketCandidate);

  seedPlannedAutonomyMaterialization(root, {
    sourceType: "execution-bridge",
    sourceId: nonPacketCandidate.id,
    actorRole: "planner",
    followThroughId: "follow-through-execution-bridge-non-packet",
    linkedTargetId: nonPacketCandidate.targetId,
    linkedTargetArtifact: `.paper/task-packets/packets/${nonPacketCandidate.targetId}.json`
  });

  const result = runAutonomyControlPlaneOnce(root, { actorRole: "planner" });
  assert.equal(result.status, "noop");
  assert.equal(result.outcome, "no-eligible-packet");
  assert.equal(result.materializationCandidateCount, 0);
  assert.equal(fs.existsSync(path.join(root, `.paper/task-packets/packets/${nonPacketCandidate.targetId}.json`)), false);
});

test("runAutonomyControlPlaneOnce records a durable runtime error when planned materialization fails", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Autonomy Materialize Error", objective: "Record runtime errors when a planned materialization fails." });
  const { remediationPack, executionBridgeCandidate } = seedAutonomyGuidance(root);
  const actorRole = remediationPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";

  writeJson(root, ".paper/task-packets/packets/task-blocking-guidance.json", { id: "task-blocking-guidance", title: "Blocking task", status: "pending" });
  recordOperatorFollowThrough(root, {
    sourceType: "execution-bridge",
    sourceId: executionBridgeCandidate.id,
    status: "accepted-for-execution",
    actorRole: executionBridgeCandidate.sourceConversionPath?.assignedRole ?? "planner",
    decisionSummary: "Keep this unrelated guidance open so materialization must fail with a durable runtime error.",
    linkedTargetArtifact: ".paper/task-packets/packets/task-blocking-guidance.json",
    linkedTargetId: "task-blocking-guidance",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  recordOperatorFollowThrough(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    status: "accepted-for-execution",
    actorRole,
    decisionSummary: "Autonomy may materialize this pack into one packet.",
    linkedTargetArtifact: ".paper/task-packets/packets/task-queue-discipline.json",
    linkedTargetId: "task-queue-discipline",
    plannedTarget: true,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  assert.throws(() => runAutonomyControlPlaneOnce(root, { actorRole: "planner" }), /unrelated operator follow-through/);

  const runtimeResults = readJson(root, ARTIFACT_PATHS.runtimeResults, null);
  const runtimeEvents = readJson(root, ARTIFACT_PATHS.runtimeEvents, null);
  const workspaceIndex = queryWorkspaceIndex(root);

  assert.equal(runtimeResults.entries.at(-1).status, "error");
  assert.equal(runtimeResults.entries.at(-1).outcome, "materialization-failed");
  assert.equal(runtimeResults.entries.at(-1).packetId, "task-queue-discipline");
  assert.match(runtimeResults.entries.at(-1).error, /unrelated operator follow-through/);
  assert.equal(runtimeEvents.entries.at(-1).eventType, "run-error");
  assert.equal(workspaceIndex.runtime.lastStatus, "error");
  assert.equal(workspaceIndex.runtime.lastOutcome, "materialization-failed");
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

test("every governance registry entry binds to real command or MCP surfaces plus core surfaces", () => {
  const registry = [...GOVERNANCE_GUARDED_MUTATIONS, ...GOVERNANCE_EXEMPT_MUTATIONS];
  const toolNames = new Set(toolDefinitions.map((tool) => tool.name));
  const commandDir = path.join(process.cwd(), ".opencode", "commands");
  const coreFiles = [
    fs.readFileSync(path.join(process.cwd(), "src/core/artifacts.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/evidence.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/reviews.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/isolated-review.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/orchestration.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/navigation.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/dove.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/runtime.mjs"), "utf8")
  ];

  for (const entry of registry) {
    const bindings = entry.surfaceBindings ?? {};
    assert.equal(typeof bindings.coreFunction, "string");
    assert.equal(Array.isArray(bindings.commandIds), true);
    if (bindings.mcpTool) {
      assert.equal(typeof bindings.mcpTool, "string");
      assert.equal(toolNames.has(bindings.mcpTool), true, `${entry.id} missing bound MCP tool ${bindings.mcpTool}`);
    } else {
      assert.equal(bindings.commandIds.length > 0, true, `${entry.id} without MCP tool must bind at least one command surface`);
    }
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
