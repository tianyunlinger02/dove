import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ensureWorkspace, readJson } from "../../src/core/workspace.mjs";
import { ARTIFACT_PATHS, DOVE_DOMAIN_GUIDANCE, DOVE_DOMAIN_IDS, DOVE_MISSION_LIFECYCLE_STAGES, DOVE_PRIMARY_ROLE_IDS, DOVE_WORKFLOW_KERNEL_VERSION, PAPER_LIFECYCLE_FAMILIES, PAPER_LIFECYCLE_FAMILY_IDS, PAPER_LIFECYCLE_TAXONOMY_VERSION, PAPER_MAJOR_CHANGE_PROTOCOL_STAGES, createDefaultState, createDoveRootMigrationManifest, createWorkspaceIndex, normalizeCampaignsIndex, normalizeDoveRootMigrationManifest, normalizeState, normalizeWorkspaceIndex, SCHEMA_VERSION } from "../../src/core/schema.mjs";

test("normalizeState migrates v1 state into v2", () => {
  const migrated = normalizeState({
    version: 1,
    projectTitle: "Legacy Paper",
    venue: "NeurIPS",
    objective: "Legacy objective",
    deadline: "2026-05-01",
    currentPhase: "draft",
    updatedAt: "2026-01-01T00:00:00.000Z"
  });

  assert.equal(migrated.version, SCHEMA_VERSION);
  assert.equal(migrated.paper.title, "Legacy Paper");
  assert.equal(migrated.pipeline.currentStage, "draft");
  assert.equal(migrated.orchestration.phase, "draft");
  assert.ok(migrated.sections.introduction);
});

test("createDefaultState exposes durable artifact paths", () => {
  const state = createDefaultState();
  assert.equal(state.artifacts.plan, ".paper/plans/current-plan.md");
  assert.equal(state.artifacts.orchestrationBoard, ".paper/orchestration/board.json");
  assert.equal(state.artifacts.taskPacketsIndex, ".paper/task-packets/index.json");
  assert.equal(state.artifacts.packetContextsDir, ".paper/context/packets");
  assert.equal(state.artifacts.artifactContextsDir, ".paper/context/artifacts");
  assert.equal(state.artifacts.actionContextsDir, ".paper/context/actions");
  assert.equal(state.artifacts.sessionSummary, ".paper/sessions/LATEST_SUMMARY.md");
  assert.equal(state.artifacts.workflowBoundaries, ".paper/workflow-pack/boundaries.json");
  assert.equal(state.artifacts.workspaceArtifactMap, ".paper/workspace/artifact-map.json");
  assert.equal(state.artifacts.doveRootManifest, ".paper/workspace/dove-root-manifest.json");
  assert.equal(state.artifacts.programsIndex, ".paper/programs/index.json");
  assert.equal(state.artifacts.programRuns, ".paper/programs/runs.json");
  assert.equal(state.artifacts.programApprovals, ".paper/programs/approvals.json");
  assert.equal(state.artifacts.campaignsIndex, ".paper/programs/campaigns.json");
  assert.equal(state.artifacts.researchBrief, ".paper/research/brief.md");
  assert.equal(state.artifacts.rebuttalIssues, ".paper/rebuttal/issues.json");
  assert.equal(state.artifacts.metaLongHorizonMemory, ".paper/meta/long-horizon-memory.json");
  assert.equal(state.artifacts.versionsIndex, ".paper/versions/index.json");
  assert.equal(state.reviews.lastVerdict, "not-reviewed");
});

test("campaign indexes and workspace mirrors are normalized", () => {
  const index = createWorkspaceIndex();
  assert.equal(ARTIFACT_PATHS.campaignsIndex, ".paper/programs/campaigns.json");
  assert.equal(index.campaigns.campaignCount, 0);
  assert.equal(index.campaigns.plannedCount, 0);
  assert.equal(index.campaigns.activeCount, 0);
  assert.equal(index.campaigns.reviewNeededCount, 0);
  assert.equal(index.campaigns.completedCount, 0);
  assert.equal(index.campaigns.blockedCount, 0);
  assert.deepEqual(index.campaigns.topCampaignIds, []);
  assert.equal(index.campaigns.currentCampaignId, null);
  assert.equal(index.campaigns.currentCampaignNextStepId, null);
  assert.equal(index.campaigns.campaignsPath, ".paper/programs/campaigns.json");

  const normalizedIndex = normalizeWorkspaceIndex({
    campaigns: {
      campaignCount: "bad-shape",
      plannedCount: 2,
      activeCount: 1,
      reviewNeededCount: "bad-shape",
      completedCount: 3,
      blockedCount: "bad-shape",
      topCampaignIds: "bad-shape",
      currentCampaignId: "campaign-alpha",
      currentCampaignStepCount: "bad-shape",
      currentCampaignCompletedStepCount: 1,
      currentCampaignReviewNeededStepCount: "bad-shape",
      currentCampaignNextAction: "Issue fresh approval for the next bounded cycle."
    }
  });
  assert.equal(normalizedIndex.campaigns.campaignCount, 0);
  assert.equal(normalizedIndex.campaigns.plannedCount, 2);
  assert.equal(normalizedIndex.campaigns.activeCount, 1);
  assert.equal(normalizedIndex.campaigns.reviewNeededCount, 0);
  assert.equal(normalizedIndex.campaigns.completedCount, 3);
  assert.equal(normalizedIndex.campaigns.blockedCount, 0);
  assert.deepEqual(normalizedIndex.campaigns.topCampaignIds, []);
  assert.equal(normalizedIndex.campaigns.currentCampaignId, "campaign-alpha");
  assert.equal(normalizedIndex.campaigns.currentCampaignStepCount, 0);
  assert.equal(normalizedIndex.campaigns.currentCampaignCompletedStepCount, 1);
  assert.equal(normalizedIndex.campaigns.currentCampaignReviewNeededStepCount, 0);
  assert.equal(normalizedIndex.campaigns.currentCampaignNextAction, "Issue fresh approval for the next bounded cycle.");

  const normalizedCampaigns = normalizeCampaignsIndex({
    version: 99,
    items: [{ id: "campaign-alpha" }, null, "bad-shape"],
    summary: {
      campaignCount: "bad-shape",
      activeCount: 1,
      topCampaignIds: ["campaign-alpha", ""],
      campaignsPath: "custom-path.json"
    },
    updatedAt: "2026-04-24T00:00:00.000Z"
  });
  assert.equal(normalizedCampaigns.version, 1);
  assert.deepEqual(normalizedCampaigns.items, [{ id: "campaign-alpha" }]);
  assert.equal(normalizedCampaigns.summary.campaignCount, 0);
  assert.equal(normalizedCampaigns.summary.activeCount, 1);
  assert.deepEqual(normalizedCampaigns.summary.topCampaignIds, ["campaign-alpha"]);
  assert.equal(normalizedCampaigns.summary.campaignsPath, "custom-path.json");
  assert.equal(normalizedCampaigns.updatedAt, "2026-04-24T00:00:00.000Z");
});

test("ensureWorkspace creates and repairs the campaigns artifact", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-schema-campaigns-"));
  ensureWorkspace(root);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.workspaceArtifactMap)), false);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.doveRootManifest)), true);
  assert.equal(fs.existsSync(path.join(root, ".dove")), false);

  const manifest = readJson(root, ARTIFACT_PATHS.doveRootManifest, {});
  assert.equal(manifest.status, "manifest-only");
  assert.equal(manifest.authoritativeRoot, ".paper");
  assert.equal(manifest.createsAuthoritativeDoveRoot, false);

  const campaigns = readJson(root, ARTIFACT_PATHS.campaignsIndex, {});
  assert.equal(campaigns.version, 1);
  assert.deepEqual(campaigns.items, []);
  assert.equal(campaigns.summary.campaignCount, 0);
  assert.equal(campaigns.summary.campaignsPath, ".paper/programs/campaigns.json");

  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.campaignsIndex), JSON.stringify({ version: 99, items: "bad-shape", summary: { activeCount: 2 } }), "utf8");
  ensureWorkspace(root);

  const repaired = readJson(root, ARTIFACT_PATHS.campaignsIndex, {});
  assert.equal(repaired.version, 1);
  assert.deepEqual(repaired.items, []);
  assert.equal(repaired.summary.campaignCount, 0);
  assert.equal(repaired.summary.activeCount, 2);
});

test("workspace index exposes normalized paper lifecycle taxonomy", () => {
  const index = createWorkspaceIndex();
  assert.equal(index.lifecycle.taxonomyVersion, PAPER_LIFECYCLE_TAXONOMY_VERSION);
  assert.deepEqual(PAPER_LIFECYCLE_FAMILY_IDS, ["objective", "structure", "campaign", "work-unit", "concern", "audit", "knowledge"]);
  assert.deepEqual(index.lifecycle.familyIds, PAPER_LIFECYCLE_FAMILY_IDS);
  assert.equal(index.lifecycle.families.length, PAPER_LIFECYCLE_FAMILIES.length);
  assert.equal(index.lifecycle.families.find((family) => family.id === "concern").label, "Concern");
  assert.equal(index.lifecycle.artifactCounts.audit, 0);
  assert.equal(index.lifecycle.activePacketCounts["work-unit"], 0);
  assert.deepEqual(index.lifecycle.protocol.stages, PAPER_MAJOR_CHANGE_PROTOCOL_STAGES);

  const normalized = normalizeWorkspaceIndex({
    lifecycle: {
      taxonomyVersion: "custom-taxonomy",
      families: [{ id: "audit", artifactCount: 7, activePacketCount: 2, packetCount: 3 }],
      artifactCounts: { audit: 7, bogus: 99 },
      activePacketCounts: { audit: 2 },
      packetCounts: { audit: 3 },
      boardFamily: "audit",
      boardPhaseFamily: "bad-family",
      topFamilies: ["audit", "bad-family"],
      protocol: {
        stages: ["design", "bogus"],
        majorChangeSignals: ["core-claim-change", "bogus"],
        overview: "Custom protocol guidance."
      }
    }
  });
  assert.equal(normalized.lifecycle.taxonomyVersion, "custom-taxonomy");
  assert.equal(normalized.lifecycle.families.find((family) => family.id === "audit").artifactCount, 7);
  assert.equal(normalized.lifecycle.artifactCounts.audit, 7);
  assert.equal(normalized.lifecycle.artifactCounts.bogus, undefined);
  assert.equal(normalized.lifecycle.boardFamily, "audit");
  assert.equal(normalized.lifecycle.boardPhaseFamily, null);
  assert.deepEqual(normalized.lifecycle.topFamilies, ["audit"]);
  assert.deepEqual(normalized.lifecycle.protocol.stages, ["design"]);
  assert.deepEqual(normalized.lifecycle.protocol.majorChangeSignals, ["core-claim-change"]);
  assert.equal(normalized.lifecycle.protocol.overview, "Custom protocol guidance.");
});

test("workspace index exposes normalized Dove mission kernel", () => {
  const index = createWorkspaceIndex();
  assert.equal(index.dove.kernelVersion, DOVE_WORKFLOW_KERNEL_VERSION);
  assert.equal(index.dove.unified, true);
  assert.equal(index.dove.identity.productName, "Dove");
  assert.equal(index.dove.identity.packageName, "paper-factory");
  assert.equal(index.dove.identity.publicCli, "dove");
  assert.equal(index.dove.identity.compatibilityCli, "paper-factory");
  assert.equal(index.dove.identity.activeDurableRoot, ".paper");
  assert.equal(index.dove.identity.plannedDurableRoot, ".dove");
  assert.equal(index.dove.identity.namingStrategy, "staged-dual-name");
  assert.equal(index.dove.identity.packageRenameStatus, "deferred");
  assert.equal(index.dove.identity.durableRootMigrationStatus, "manifest-only");
  assert.equal(index.dove.identity.breakingRenameRequiresExplicitApproval, true);
  assert.equal(index.dove.durableRootMigration.status, "manifest-only");
  assert.equal(index.dove.durableRootMigration.activeDurableRoot, ".paper");
  assert.equal(index.dove.durableRootMigration.authoritativeRoot, ".paper");
  assert.equal(index.dove.durableRootMigration.plannedDurableRoot, ".dove");
  assert.equal(index.dove.durableRootMigration.manifestPath, ".paper/workspace/dove-root-manifest.json");
  assert.equal(index.dove.durableRootMigration.createsAuthoritativeDoveRoot, false);
  assert.equal(index.dove.durableRootMigration.dualRootInvariant.allowed, false);
  assert.equal(index.dove.currentDomain, "paper");
  assert.deepEqual(index.dove.domainIds, DOVE_DOMAIN_IDS);
  assert.equal(index.dove.domainGuidance.length, DOVE_DOMAIN_GUIDANCE.length);
  assert.equal(index.dove.domainGuidance.find((domain) => domain.id === "engineering").stageRoutes.execution, "project:paper.materialize or project:paper.autonomy-operate");
  assert.deepEqual(index.dove.primaryRoleIds, DOVE_PRIMARY_ROLE_IDS);
  assert.equal(index.dove.primaryRoles.find((role) => role.id === "builder").compatiblePaperRole, "author");
  assert.deepEqual(index.dove.missionLifecycle.stages, DOVE_MISSION_LIFECYCLE_STAGES);
  assert.equal(index.dove.missionLifecycle.currentStage, "goal");
  assert.deepEqual(index.dove.missionLifecycle.paperProtocolStages, PAPER_MAJOR_CHANGE_PROTOCOL_STAGES);
  assert.equal(index.dove.missionModel.domainField, "doveDomain");
  assert.equal(index.dove.compatibility.paperFactory, true);
  assert.equal(index.dove.compatibility.paperRoot, ".paper");
  assert.equal(index.dove.compatibility.plannedDoveRoot, ".dove");
  assert.equal(index.dove.compatibility.migrationMode, "compatibility-manifest");

  const normalized = normalizeWorkspaceIndex({
    dove: {
      kernelVersion: "custom-dove",
      unified: "bad-shape",
      currentDomain: "engineering",
      domainIds: ["bad-domain"],
      primaryRoleIds: ["bad-role"],
      primaryRoles: [{ id: "builder", label: "Maker", compatiblePaperRole: "author" }],
      domainGuidance: [{ id: "engineering", label: "Build", stageRoutes: { execution: "custom-engineering-route" }, returnEvidence: ["tests"] }, { id: "bad-domain", label: "Bad" }],
      identity: {
        productName: "Custom Dove",
        packageName: "custom-package",
        publicCli: "custom-dove",
        breakingRenameRequiresExplicitApproval: "bad-shape"
      },
      durableRootMigration: {
        status: "custom-manifest",
        activeDurableRoot: ".custom-paper",
        createsAuthoritativeDoveRoot: "bad-shape",
        dualRootInvariant: { allowed: "bad-shape" },
        phases: "bad-shape"
      },
      missionLifecycle: {
        stages: ["goal", "bogus"],
        currentStage: "execution",
        paperProtocolStages: ["design", "bogus"]
      },
      missionCount: "bad-shape",
      activeMissionCount: 2,
      reviewNeededMissionCount: "bad-shape",
      domainCounts: { engineering: 3, bogus: 99 },
      currentMissionFamily: "structure"
    }
  });
  assert.equal(normalized.dove.kernelVersion, "custom-dove");
  assert.equal(normalized.dove.unified, true);
  assert.equal(normalized.dove.currentDomain, "engineering");
  assert.deepEqual(normalized.dove.domainIds, DOVE_DOMAIN_IDS);
  assert.equal(normalized.dove.domainGuidance.find((domain) => domain.id === "engineering").label, "Build");
  assert.equal(normalized.dove.domainGuidance.find((domain) => domain.id === "engineering").stageRoutes.execution, "custom-engineering-route");
  assert.equal(normalized.dove.domainGuidance.find((domain) => domain.id === "bad-domain"), undefined);
  assert.deepEqual(normalized.dove.primaryRoleIds, DOVE_PRIMARY_ROLE_IDS);
  assert.equal(normalized.dove.identity.productName, "Custom Dove");
  assert.equal(normalized.dove.identity.packageName, "custom-package");
  assert.equal(normalized.dove.identity.publicCli, "custom-dove");
  assert.equal(normalized.dove.identity.breakingRenameRequiresExplicitApproval, true);
  assert.equal(normalized.dove.durableRootMigration.status, "custom-manifest");
  assert.equal(normalized.dove.durableRootMigration.activeDurableRoot, ".custom-paper");
  assert.equal(normalized.dove.durableRootMigration.createsAuthoritativeDoveRoot, false);
  assert.equal(normalized.dove.durableRootMigration.dualRootInvariant.allowed, false);
  assert.equal(normalized.dove.durableRootMigration.phases.length, createDoveRootMigrationManifest().phases.length);
  assert.equal(normalized.dove.primaryRoles.find((role) => role.id === "builder").label, "Maker");
  assert.deepEqual(normalized.dove.missionLifecycle.stages, ["goal"]);
  assert.equal(normalized.dove.missionLifecycle.currentStage, "execution");
  assert.deepEqual(normalized.dove.missionLifecycle.paperProtocolStages, ["design"]);
  assert.equal(normalized.dove.missionCount, 0);
  assert.equal(normalized.dove.activeMissionCount, 2);
  assert.equal(normalized.dove.reviewNeededMissionCount, 0);
  assert.equal(normalized.dove.domainCounts.engineering, 3);
  assert.equal(normalized.dove.domainCounts.bogus, undefined);
  assert.equal(normalized.dove.currentMissionFamily, "structure");
});

test("Dove durable-root migration manifest stays manifest-only", () => {
  const manifest = createDoveRootMigrationManifest();
  assert.equal(manifest.status, "manifest-only");
  assert.equal(manifest.activeDurableRoot, ".paper");
  assert.equal(manifest.authoritativeRoot, ".paper");
  assert.equal(manifest.plannedDurableRoot, ".dove");
  assert.equal(manifest.manifestPath, ARTIFACT_PATHS.doveRootManifest);
  assert.equal(manifest.createsAuthoritativeDoveRoot, false);
  assert.equal(manifest.dualRootInvariant.allowed, false);
  assert.deepEqual(manifest.prohibitedAuthoritativeArtifacts, [".dove/state.json", ".dove/workspace/index.json", ".dove/task-packets/index.json"]);

  const normalized = normalizeDoveRootMigrationManifest({
    status: "custom-status",
    authoritativeRoot: ".custom-paper",
    plannedDurableRoot: "custom-dove",
    createsAuthoritativeDoveRoot: "bad-shape",
    dualRootInvariant: { allowed: "bad-shape", reason: "custom reason" },
    phases: [{ id: "custom", status: "active", summary: "Custom phase." }, "bad-shape"]
  });
  assert.equal(normalized.status, "custom-status");
  assert.equal(normalized.authoritativeRoot, ".custom-paper");
  assert.equal(normalized.plannedDurableRoot, "custom-dove");
  assert.equal(normalized.createsAuthoritativeDoveRoot, false);
  assert.equal(normalized.dualRootInvariant.allowed, false);
  assert.equal(normalized.dualRootInvariant.reason, "custom reason");
  assert.deepEqual(normalized.phases, [{ id: "custom", status: "active", summary: "Custom phase." }]);
});

test("workspace index exposes normalized unified autonomy loop skeleton", () => {
  const index = createWorkspaceIndex();
  assert.equal(index.autonomyLoops.contractVersion, "unified-autonomy-loop-v1");
  assert.equal(index.autonomyLoops.activeLifecycleState, "board-ready");
  assert.equal(index.autonomyLoops.loopCount, 4);
  assert.equal(index.autonomyLoops.explicitOnly, true);
  assert.equal(index.autonomyLoops.noHiddenRuntime, true);
  assert.equal(index.autonomyLoops.currentLoopId, "board-role-artifact-handoff");
  assert.equal(index.autonomyLoops.runtimePointers.includes(".paper/runtime/controller-state.json"), true);
  assert.equal(index.autonomyLoops.followThroughPointers.includes(".paper/meta/operator-follow-through.json"), true);
  assert.match(index.autonomyLoops.safeExecutionPath, /autonomy-foreground/);

  const normalized = normalizeWorkspaceIndex({
    autonomyLoops: {
      contractVersion: "custom-contract",
      activeLifecycleState: "runtime-result-awaiting-follow-through",
      loopCount: "bad-shape",
      explicitOnly: "bad-shape",
      loops: "bad-shape",
      approvalPointers: "bad-shape",
      lifecycleStates: "bad-shape",
      nextSafeAction: "Use explicit follow-through."
    }
  });
  assert.equal(normalized.autonomyLoops.contractVersion, "custom-contract");
  assert.equal(normalized.autonomyLoops.activeLifecycleState, "runtime-result-awaiting-follow-through");
  assert.equal(normalized.autonomyLoops.loopCount, 4);
  assert.equal(normalized.autonomyLoops.explicitOnly, true);
  assert.deepEqual(normalized.autonomyLoops.loops, []);
  assert.deepEqual(normalized.autonomyLoops.approvalPointers, []);
  assert.deepEqual(normalized.autonomyLoops.lifecycleStates, []);
  assert.equal(normalized.autonomyLoops.nextSafeAction, "Use explicit follow-through.");
});
