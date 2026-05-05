import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  ensureWorkspace,
  launchDoveMission,
  queryDoveAudit,
  queryDoveMission,
  queryDoveMissionBoard,
  queryDoveOrchestrate,
  queryDoveReturn,
  queryMetaOptimize
} from "../../src/core/index.mjs";
import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "dove.mjs");
const DOVE_CLI = path.join(ROOT, "bin", "dove.mjs");

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dove-dove-query-"));
}

function writeJson(root, relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, value, "utf8");
}

function seedDoveLaunchGuidance(root) {
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "dove-launch-gap",
      summary: "Launch a governed Dove engineering mission packet.",
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
    openItems: ["Launch the governed Dove mission packet."],
    unresolvedConcernIds: ["dove-launch-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });
  const meta = queryMetaOptimize(root);
  const pack = meta.remediationPacks.packs[0];
  const packetPath = pack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet") ?? null;
  return { pack, packetPath };
}

function snapshotArtifacts(root, relativePaths) {
  return Object.fromEntries(relativePaths.map((relativePath) => {
    const fullPath = path.join(root, relativePath);
    return [relativePath, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : null];
  }));
}

const watchedArtifacts = [
  ARTIFACT_PATHS.state,
  ARTIFACT_PATHS.orchestrationBoard,
  ARTIFACT_PATHS.workspaceIndex,
  ARTIFACT_PATHS.doveRootManifest,
  ARTIFACT_PATHS.taskPacketsIndex,
  ARTIFACT_PATHS.reviewState,
  ARTIFACT_PATHS.checklist,
  ARTIFACT_PATHS.versionsIndex,
  ARTIFACT_PATHS.versionComparisons
];

test("queryDoveMissionBoard exposes the as-read Dove mission board without writing artifacts", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  writeJson(root, ARTIFACT_PATHS.orchestrationBoard, {
    version: 2,
    currentPhase: "draft",
    currentFocus: "Ship the cache mission board slice.",
    objective: "Make Dove visible as one mission board.",
    assignedRole: "builder",
    intentType: "implementation",
    nextAction: "Inspect mission queues before returning.",
    continuationState: { status: "idle" },
    reviewRequiredBeforeFinalize: true
  });
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    version: 3,
    items: [
      {
        id: "engineering-cache",
        title: "Implement API cache",
        status: "pending",
        lifecycleStatus: "active",
        lifecycleFamily: "work-unit",
        doveDomain: "engineering",
        assignedRole: "builder",
        phase: "draft",
        nextAction: "Return changed files and tests.",
        outputPaths: ["src/cache.mjs"],
        evidenceLinks: ["tests/cache.test.mjs"]
      },
      {
        id: "paper-outline",
        title: "Refine paper outline",
        status: "done",
        lifecycleStatus: "completed",
        lifecycleFamily: "structure",
        assignedRole: "planner",
        phase: "plan",
        nextAction: "Review outline acceptance.",
        outputPaths: [".dove/outline/current-outline.md"],
        evidenceLinks: []
      },
      {
        id: "review-claims",
        title: "Audit claim support",
        status: "pending",
        lifecycleStatus: "review-needed",
        lifecycleFamily: "concern",
        assignedRole: "reviewer",
        phase: "review",
        nextAction: "Run independent review.",
        outputPaths: [],
        evidenceLinks: [".dove/reviews/log.md"]
      },
      {
        id: "old-cache",
        title: "Archived cache attempt",
        status: "done",
        lifecycleStatus: "archived",
        lifecycleFamily: "work-unit",
        doveDomain: "engineering",
        assignedRole: "builder",
        phase: "draft",
        outputPaths: ["src/old-cache.mjs"],
        evidenceLinks: []
      }
    ],
    lifecycleCounts: {},
    lifecycleFamilyCounts: {},
    dependencyHealth: {},
    updatedAt: null
  });

  const before = snapshotArtifacts(root, watchedArtifacts);
  const result = queryDoveMissionBoard(root, { domain: "engineering" });
  const after = snapshotArtifacts(root, watchedArtifacts);

  assert.equal(result.mode, "dove-mission-board-query");
  assert.equal(result.proposalOnly, true);
  assert.equal(result.noAutoApply, true);
  assert.deepEqual(result.writes, []);
  assert.equal(result.workspace.durableRoot, ".dove");
  assert.equal(result.workspace.authoritativeRoot, ".dove");
  assert.equal(result.workspace.identity.productName, "Dove");
  assert.equal(result.workspace.identity.durableRootStatus, "authoritative");
  assert.equal(result.workspace.authorityManifest.status, "authoritative");
  assert.equal(result.workspace.authorityManifest.authoritativeRoot, ".dove");
  assert.equal(result.workspace.authorityManifest.currentWriteAuthority, ".dove");
  assert.equal(result.workspace.asReadSnapshot, true);
  assert.equal(result.board.goal, "Ship the cache mission board slice.");
  assert.equal(result.board.domain, "engineering");
  assert.equal(result.board.stage, "execution");
  assert.equal(result.board.primaryRole, "builder");
  assert.deepEqual(result.missions.map((mission) => mission.id), ["engineering-cache"]);
  assert.equal(result.missions[0].missionStage, "execution");
  assert.equal(result.missions[0].source, "mission-packet");
  assert.equal(result.missions[0].packetId, "engineering-cache");
  assert.equal(result.missions[0].missionPacketId, "engineering-cache");
  assert.equal(result.missions[0].missionPacketStorePath, ARTIFACT_PATHS.taskPacketsIndex);
  assert.equal(result.missions[0].primaryRole, "builder");
  assert.deepEqual(result.queues.active.map((mission) => mission.id), ["engineering-cache"]);
  assert.equal(result.counts.missionCount, 4);
  assert.equal(result.counts.activeMissionCount, 3);
  assert.equal(result.counts.reviewNeededMissionCount, 1);
  assert.equal(result.counts.domainCounts.engineering, 2);
  assert.equal(result.counts.domainCounts.review, 1);
  assert.equal(result.diagnostics.noRefresh, true);
  assert.equal(result.diagnostics.noCommandExecution, true);
  assert.equal(result.diagnostics.noGitInspection, true);
  assert.deepEqual(after, before);

  const reviewFiltered = queryDoveMissionBoard(root, { stage: "audit", status: "review-needed" });
  assert.deepEqual(reviewFiltered.missions.map((mission) => mission.id), ["review-claims"]);

  const packetFiltered = queryDoveMissionBoard(root, { packetId: "paper-outline" });
  assert.deepEqual(packetFiltered.missions.map((mission) => mission.id), ["paper-outline"]);
  assert.equal(packetFiltered.missions[0].missionStage, "design");

  const missionPacketFiltered = queryDoveMissionBoard(root, { missionPacketId: "engineering-cache" });
  assert.deepEqual(missionPacketFiltered.missions.map((mission) => mission.id), ["engineering-cache"]);

  const archivedIncluded = queryDoveMissionBoard(root, { domain: "engineering", includeArchived: true });
  assert.deepEqual(archivedIncluded.missions.map((mission) => mission.id), ["engineering-cache", "old-cache"]);
});

test("queryDoveMission frames an engineering mission without writing artifacts", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  writeJson(root, ARTIFACT_PATHS.orchestrationBoard, {
    version: 2,
    currentPhase: "draft",
    currentFocus: "Ship the API cache without regressing callers.",
    objective: "Improve API latency.",
    assignedRole: "builder",
    nextAction: "Implement cache and return validation evidence."
  });
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    version: 3,
    items: [{
      id: "engineering-cache",
      title: "Implement API cache",
      status: "pending",
      lifecycleStatus: "active",
      lifecycleFamily: "work-unit",
      doveDomain: "engineering",
      assignedRole: "builder",
      phase: "draft",
      nextAction: "Return changed files and tests.",
      outputPaths: ["src/cache.mjs"],
      evidenceLinks: ["tests/cache.test.mjs"]
    }],
    lifecycleCounts: {},
    lifecycleFamilyCounts: {},
    dependencyHealth: {},
    updatedAt: null
  });

  const before = snapshotArtifacts(root, watchedArtifacts);
  const result = queryDoveMission(root, {
    stage: "execution",
    targetArtifacts: ["src/cache.mjs"],
    acceptanceChecks: ["changed files", "tests or validation output"]
  });
  const after = snapshotArtifacts(root, watchedArtifacts);

  assert.equal(result.mode, "dove-mission-query");
  assert.equal(result.proposalOnly, true);
  assert.equal(result.noAutoApply, true);
  assert.deepEqual(result.writes, []);
  assert.equal(result.mission.goal, "Ship the API cache without regressing callers.");
  assert.equal(result.mission.domain, "engineering");
  assert.equal(result.mission.stage, "execution");
  assert.equal(result.mission.primaryRole, "builder");
  assert.equal(result.mission.nextCommand, "project:dove.paper.materialize or project:dove.paper.autonomy-operate");
  assert.deepEqual(result.mission.targetArtifacts, ["src/cache.mjs"]);
  assert.deepEqual(result.mission.acceptanceChecks, ["changed files", "tests or validation output"]);
  assert.equal(result.workspace.durableRoot, ".dove");
  assert.equal(result.workspace.identity.productName, "Dove");
  assert.equal(result.workspace.identity.publicCli, "dove");
  assert.equal(result.workspace.authorityManifest.status, "authoritative");
  assert.equal(result.packets[0].doveDomain, "engineering");
  assert.equal(result.packets[0].source, "mission-packet");
  assert.equal(result.packets[0].missionPacketId, "engineering-cache");
  assert.equal(result.packets[0].missionPacketStorePath, ARTIFACT_PATHS.taskPacketsIndex);
  assert.deepEqual(after, before);
});

test("queryDoveOrchestrate routes an engineering mission without writing artifacts", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  const before = snapshotArtifacts(root, watchedArtifacts);
  const result = queryDoveOrchestrate(root, {
    request: "Implement the cache and return validation evidence.",
    goal: "Ship API cache safely.",
    domain: "engineering",
    stage: "execution",
    targetArtifacts: ["src/cache.mjs"],
    acceptanceChecks: ["changed files", "tests or validation output"]
  });
  const after = snapshotArtifacts(root, watchedArtifacts);

  assert.equal(result.mode, "dove-orchestrate-query");
  assert.equal(result.proposalOnly, true);
  assert.equal(result.noAutoApply, true);
  assert.deepEqual(result.writes, []);
  assert.equal(result.mission.domain, "engineering");
  assert.equal(result.mission.stage, "execution");
  assert.equal(result.route.recommendedCommand, "project:dove.paper.materialize");
  assert.equal(result.route.nextCommand, "project:dove.paper.materialize");
  assert.equal(result.route.roleBoundary.primaryRole, "builder");
  assert.equal(result.workspace.durableRoot, ".dove");
  assert.equal(result.workspace.authoritativeRoot, ".dove");
  assert.equal(result.workspace.identity.packageName, "dove");
  assert.equal(result.workspace.authorityManifest.currentWriteAuthority, ".dove");
  assert.equal(result.diagnostics.noRefresh, true);
  assert.equal(result.diagnostics.noCommandExecution, true);
  assert.equal(result.diagnostics.noGitInspection, true);
  assert.deepEqual(after, before);
});

test("queryDoveAudit reports audit and return readiness without writing artifacts", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  writeText(root, "src/cache.mjs", "export const enabled = true;\n");
  writeText(root, "tests/cache.test.mjs", "import test from 'node:test';\n");
  writeText(root, "tmp/cache-test.log", "ok 1 cache test passed\n0 failures\nexit 0\n");
  writeText(root, ARTIFACT_PATHS.checklist, "- [x] Implement cache\n- [x] Validate cache\n");

  const before = snapshotArtifacts(root, [...watchedArtifacts, "src/cache.mjs", "tests/cache.test.mjs", "tmp/cache-test.log"]);
  const result = queryDoveAudit(root, {
    scope: "Engineering cache return audit.",
    goal: "Return an engineering cache change.",
    domain: "engineering",
    stage: "audit",
    changedFilePaths: ["src/cache.mjs"],
    testEvidencePaths: ["tests/cache.test.mjs"],
    validationOutputPaths: ["tmp/cache-test.log"]
  });
  const after = snapshotArtifacts(root, [...watchedArtifacts, "src/cache.mjs", "tests/cache.test.mjs", "tmp/cache-test.log"]);

  assert.equal(result.mode, "dove-audit-query");
  assert.equal(result.proposalOnly, true);
  assert.equal(result.noAutoApply, true);
  assert.deepEqual(result.writes, []);
  assert.equal(result.mission.domain, "engineering");
  assert.equal(result.mission.stage, "audit");
  assert.equal(result.audit.scope, "Engineering cache return audit.");
  assert.equal(result.audit.findingCount, result.findings.length);
  assert.equal(result.returnReadiness.engineeringEvidence.validationOutput.status, "passed");
  assert.equal(result.returnReadiness.engineeringEvidence.changedFiles.satisfied, true);
  assert.equal(result.workspace.durableRoot, ".dove");
  assert.equal(result.workspace.authoritativeRoot, ".dove");
  assert.equal(result.workspace.identity.durableRootStatus, "authoritative");
  assert.equal(result.workspace.authorityManifest.status, "authoritative");
  assert.equal(result.workspace.authorityManifest.dualRootInvariant.allowed, false);
  assert.equal(result.diagnostics.noRefresh, true);
  assert.equal(result.diagnostics.noCommandExecution, true);
  assert.equal(result.diagnostics.noGitInspection, true);
  assert.deepEqual(after, before);
});

test("queryDoveReturn reports missing engineering evidence without writing artifacts", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  const before = snapshotArtifacts(root, watchedArtifacts);
  const result = queryDoveReturn(root, {
    goal: "Close an engineering mission.",
    domain: "engineering",
    stage: "return",
    acceptanceChecks: ["tests or validation output"]
  });
  const after = snapshotArtifacts(root, watchedArtifacts);

  assert.equal(result.mode, "dove-return-query");
  assert.equal(result.proposalOnly, true);
  assert.equal(result.noAutoApply, true);
  assert.deepEqual(result.writes, []);
  assert.equal(result.returnStatus, "needs-audit");
  assert.equal(result.nextCommand, "project:dove.return");
  assert.equal(result.workspace.identity.productName, "Dove");
  assert.equal(result.workspace.identity.durableRootStatus, "authoritative");
  assert.equal(result.workspace.authorityManifest.currentWriteAuthority, ".dove");
  assert.equal(result.engineeringEvidence.declaredInputsOnly, true);
  assert.equal(result.engineeringEvidence.noCommandExecution, true);
  assert.equal(result.engineeringEvidence.noGitInspection, true);
  assert.equal(result.engineeringEvidence.changedFiles.satisfied, false);
  assert.equal(result.engineeringEvidence.validationEvidence.satisfied, false);
  assert.equal(result.engineeringEvidence.validationOutput.status, "missing");
  assert.equal(result.missingReturnEvidence.includes("changed files"), true);
  assert.equal(result.missingReturnEvidence.includes("tests or validation evidence"), true);
  assert.equal(result.missingReturnEvidence.includes("validation output"), true);
  assert.deepEqual(after, before);
});

test("queryDoveReturn accepts declared engineering evidence without writing artifacts", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  writeText(root, "src/cache.mjs", "export const enabled = true;\n");
  writeText(root, "tests/cache.test.mjs", "import test from 'node:test';\n");
  writeText(root, "tmp/cache-test.log", "ok 1 cache test passed\n0 failing\nexit 0\n");
  writeText(root, ARTIFACT_PATHS.checklist, "- [x] Implement cache\n- [x] Validate cache\n");

  const before = snapshotArtifacts(root, [...watchedArtifacts, "src/cache.mjs", "tests/cache.test.mjs", "tmp/cache-test.log"]);
  const result = queryDoveReturn(root, {
    goal: "Return an engineering cache change.",
    domain: "engineering",
    stage: "return",
    acceptanceChecks: ["changed files", "tests or validation output"],
    changedFilePaths: ["src/cache.mjs"],
    testEvidencePaths: ["tests/cache.test.mjs"],
    validationOutputPaths: ["tmp/cache-test.log"]
  });
  const after = snapshotArtifacts(root, [...watchedArtifacts, "src/cache.mjs", "tests/cache.test.mjs", "tmp/cache-test.log"]);

  assert.equal(result.returnStatus, "ready");
  assert.equal(result.engineeringEvidence.changedFiles.satisfied, true);
  assert.deepEqual(result.engineeringEvidence.changedFiles.existingPaths, ["src/cache.mjs"]);
  assert.equal(result.engineeringEvidence.validationEvidence.satisfied, true);
  assert.equal(result.engineeringEvidence.validationOutput.status, "passed");
  assert.equal(result.engineeringEvidence.readiness.ready, true);
  assert.deepEqual(result.engineeringEvidence.missingEvidence, []);
  assert.equal(result.evidenceRead.includes("src/cache.mjs"), true);
  assert.equal(result.evidenceRead.includes("tests/cache.test.mjs"), true);
  assert.equal(result.evidenceRead.includes("tmp/cache-test.log"), true);
  assert.deepEqual(after, before);
});

test("queryDoveReturn reports failing validation output as needs-execution", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  writeText(root, "src/cache.mjs", "export const enabled = false;\n");
  writeText(root, "tests/cache.test.mjs", "import test from 'node:test';\n");
  writeText(root, "tmp/cache-test.log", "not ok 1 cache test failed\nError: cache regression\nexit 1\n");

  const result = queryDoveReturn(root, {
    goal: "Return an engineering cache change.",
    domain: "engineering",
    acceptanceChecks: ["changed files", "tests or validation output"],
    changedFiles: ["src/cache.mjs"],
    testEvidencePaths: ["tests/cache.test.mjs"],
    validationOutputPaths: ["tmp/cache-test.log"]
  });

  assert.equal(result.returnStatus, "needs-execution");
  assert.equal(result.nextCommand, "project:dove.paper.checklist");
  assert.equal(result.engineeringEvidence.validationOutput.status, "failed");
  assert.equal(result.engineeringEvidence.readiness.hasFailedValidationOutput, true);
  assert.equal(result.engineeringEvidence.missingEvidence.some((item) => item.category === "validation-output"), true);
});

test("queryDoveReturn rejects unsafe engineering evidence paths", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  writeText(root, "tests/cache.test.mjs", "import test from 'node:test';\n");
  writeText(root, "tmp/cache-test.log", "ok 1 cache test passed\nexit 0\n");

  const result = queryDoveReturn(root, {
    goal: "Return an engineering cache change.",
    domain: "engineering",
    acceptanceChecks: ["changed files", "tests or validation output"],
    changedFiles: ["../outside.mjs"],
    testEvidencePaths: ["tests/cache.test.mjs"],
    validationOutputPaths: ["tmp/cache-test.log"]
  });

  assert.equal(result.returnStatus, "needs-audit");
  assert.equal(result.engineeringEvidence.changedFiles.unsafePaths.includes("../outside.mjs"), true);
  assert.equal(result.engineeringEvidence.readiness.pathProblemCount > 0, true);
  assert.equal(result.missingReturnEvidence.includes("changed files"), true);
});

test("queryDoveReturn uses packet output and evidence links as declared engineering evidence", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  writeText(root, "src/cache.mjs", "export const enabled = true;\n");
  writeText(root, "tests/cache.test.mjs", "import test from 'node:test';\n");
  writeText(root, "tmp/cache-test.log", "ok 1 cache test passed\n0 failures\nexit 0\n");
  writeText(root, ARTIFACT_PATHS.checklist, "- [x] Implement cache\n- [x] Validate cache\n");
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    version: 3,
    items: [{
      id: "engineering-cache-return",
      title: "Return cache implementation",
      status: "done",
      lifecycleStatus: "completed",
      lifecycleFamily: "work-unit",
      doveDomain: "engineering",
      assignedRole: "builder",
      phase: "review",
      outputPaths: ["src/cache.mjs"],
      evidenceLinks: ["tests/cache.test.mjs"]
    }],
    lifecycleCounts: {},
    lifecycleFamilyCounts: {},
    dependencyHealth: {},
    updatedAt: null
  });

  const result = queryDoveReturn(root, {
    goal: "Return packet-backed cache work.",
    domain: "engineering",
    acceptanceChecks: ["changed files", "tests or validation output"],
    validationOutputPaths: ["tmp/cache-test.log"]
  });

  assert.equal(result.returnStatus, "ready");
  assert.deepEqual(result.engineeringEvidence.packetEvidence.packetIds, ["engineering-cache-return"]);
  assert.deepEqual(result.engineeringEvidence.packetEvidence.missionPacketIds, ["engineering-cache-return"]);
  assert.deepEqual(result.engineeringEvidence.packetEvidence.missionPacketPaths, [path.join(ARTIFACT_PATHS.taskPacketsPacketsDir, "engineering-cache-return.json")]);
  assert.equal(result.engineeringEvidence.packetEvidence.missionPacketStorePath, ARTIFACT_PATHS.taskPacketsIndex);
  assert.deepEqual(result.engineeringEvidence.changedFiles.existingPaths, ["src/cache.mjs"]);
  assert.deepEqual(result.engineeringEvidence.validationEvidence.existingPaths, ["tests/cache.test.mjs"]);
});

test("queryDoveReturn does not repair malformed durable JSON", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  const malformedPath = path.join(root, ARTIFACT_PATHS.reviewState);
  fs.writeFileSync(malformedPath, "{ broken json", "utf8");
  const before = fs.readFileSync(malformedPath, "utf8");

  const result = queryDoveReturn(root, { domain: "engineering" });
  const after = fs.readFileSync(malformedPath, "utf8");

  assert.equal(result.returnStatus, "blocked");
  assert.equal(after, before);
  assert.ok(result.diagnostics.readErrors.some((item) => item.path === ARTIFACT_PATHS.reviewState));
  assert.equal(fs.readdirSync(path.dirname(malformedPath)).some((fileName) => fileName.includes(".broken-")), false);
});

test("queryDoveReturn treats a malformed Dove root manifest as read-only input", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  const malformedPath = path.join(root, ARTIFACT_PATHS.doveRootManifest);
  fs.writeFileSync(malformedPath, "{ broken json", "utf8");
  const before = fs.readFileSync(malformedPath, "utf8");

  const result = queryDoveReturn(root, { domain: "engineering" });
  const after = fs.readFileSync(malformedPath, "utf8");

  assert.equal(result.returnStatus, "blocked");
  assert.equal(result.workspace.authorityManifest.status, "authoritative");
  assert.equal(after, before);
  assert.ok(result.diagnostics.readErrors.some((item) => item.path === ARTIFACT_PATHS.doveRootManifest));
  assert.equal(fs.readdirSync(path.dirname(malformedPath)).some((fileName) => fileName.includes(".broken-")), false);
});

test("launchDoveMission materializes accepted guidance through the .dove mission packet store", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  const { pack, packetPath } = seedDoveLaunchGuidance(root);

  const result = launchDoveMission(root, {
    sourceType: "remediation-pack",
    sourceId: pack.id,
    actorRole: "planner",
    goal: "Ship a governed Dove engineering mission.",
    domain: "engineering",
    stage: "execution",
    targetArtifacts: ["src/cache.mjs"],
    acceptanceChecks: ["changed files", "tests or validation output"],
    selectedConversionPathKey: packetPath?.deterministicKey ?? null,
    packetId: packetPath?.targetId ?? "task-dove-launch",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  assert.equal(result.mode, "dove-launch-mission");
  assert.equal(result.status, "materialized");
  assert.equal(result.proposalOnly, false);
  assert.equal(result.noAutoApply, false);
  assert.equal(result.mission.domain, "engineering");
  assert.equal(result.mission.stage, "execution");
  assert.equal(result.mission.launchedMissionPacketId, result.materialization.packetId);
  assert.equal(result.missionPacket.id, result.materialization.packetId);
  assert.equal(result.missionPacket.storePath, ARTIFACT_PATHS.taskPacketsIndex);
  assert.equal(result.materialization.missionPacketId, result.materialization.packetId);
  assert.equal(result.materialization.missionPacketPath, result.materialization.packetPath);
  assert.equal(result.materialization.missionPacketContextPath, result.materialization.packetContextPath);
  assert.equal(result.governance.registeredMutation, "launch-dove-mission");
  assert.equal(result.governance.delegatedGuardedMutation, "materialize-guidance-packet");
  assert.equal(result.governance.currentWriteAuthority, ".dove");
  assert.equal(result.governance.noAutonomyExecution, true);
  assert.equal(result.workspace.durableRoot, ".dove");
  assert.equal(result.workspace.authoritativeRoot, ".dove");
  assert.equal(result.packet.doveDomain, "engineering");
  assert.equal(result.packet.missionStage, "execution");
  assert.equal(result.packet.source, "mission-packet");
  assert.equal(result.packet.missionPacketId, result.materialization.packetId);
  assert.equal(result.packet.outputPaths.includes("src/cache.mjs"), true);
  assert.equal(result.packet.materialization.acceptanceCriteria.includes("tests or validation output"), true);
  assert.equal(result.writes.some((artifactPath) => artifactPath.startsWith(".dove/task-packets/")), true);
  assert.equal(result.writes.some((artifactPath) => artifactPath.startsWith(".dove/")), true);
  assert.equal(fs.existsSync(path.join(root, ".dove")), true);

  const board = queryDoveMissionBoard(root, { domain: "engineering", missionPacketId: result.materialization.packetId, includeArchived: true });
  assert.deepEqual(board.missions.map((mission) => mission.id), [result.materialization.packetId]);
  assert.deepEqual(result.board.missionPacketIds, [result.materialization.packetId]);
});

test("launchDoveMission reports stale legacy .paper artifacts without importing them", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  const { pack, packetPath } = seedDoveLaunchGuidance(root);
  fs.mkdirSync(path.join(root, ".paper", "workspace"), { recursive: true });
  fs.writeFileSync(path.join(root, ".paper", "workspace", "index.json"), "{}\n", "utf8");

  const result = launchDoveMission(root, {
    sourceType: "remediation-pack",
    sourceId: pack.id,
    actorRole: "planner",
    domain: "engineering",
    stage: "execution",
    selectedConversionPathKey: packetPath?.deterministicKey ?? null,
    packetId: packetPath?.targetId ?? "task-dove-launch",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  assert.equal(result.status, "materialized");
  assert.deepEqual(result.diagnostics.staleLegacyAuthorityArtifacts, [".paper/workspace/index.json"]);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.taskPacketsPacketsDir, `${packetPath?.targetId ?? "task-dove-launch"}.json`)), true);
});

test("CLI Dove orchestrate, mission, board, audit, and return commands expose proposal-only JSON", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  const orchestrate = spawnSync("node", [
    CLI,
    "orchestrate",
    root,
    "--request", "Ship a CLI-visible Dove mission.",
    "--goal", "Ship a CLI-visible Dove mission.",
    "--domain", "engineering",
    "--stage", "execution",
    "--artifact", "bin/dove.mjs",
    "--acceptance-check", "tests or validation output"
  ], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(orchestrate.status, 0, orchestrate.stderr || orchestrate.stdout);
  const orchestratePayload = JSON.parse(orchestrate.stdout);
  assert.equal(orchestratePayload.mode, "dove-orchestrate-query");
  assert.equal(orchestratePayload.proposalOnly, true);
  assert.deepEqual(orchestratePayload.writes, []);
  assert.equal(orchestratePayload.route.recommendedCommand, "project:dove.paper.materialize");

  const mission = spawnSync("node", [
    CLI,
    "mission",
    root,
    "--goal", "Ship a CLI-visible Dove mission.",
    "--domain", "engineering",
    "--stage", "execution",
    "--artifact", "bin/dove.mjs",
    "--acceptance-check", "tests or validation output"
  ], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(mission.status, 0, mission.stderr || mission.stdout);
  const missionPayload = JSON.parse(mission.stdout);
  assert.equal(missionPayload.mode, "dove-mission-query");
  assert.equal(missionPayload.proposalOnly, true);
  assert.deepEqual(missionPayload.writes, []);
  assert.equal(missionPayload.mission.domain, "engineering");
  assert.equal(missionPayload.mission.stage, "execution");
  assert.deepEqual(missionPayload.mission.targetArtifacts, ["bin/dove.mjs"]);

  const board = spawnSync("node", [
    CLI,
    "board",
    root,
    "--domain", "engineering"
  ], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(board.status, 0, board.stderr || board.stdout);
  const boardPayload = JSON.parse(board.stdout);
  assert.equal(boardPayload.mode, "dove-mission-board-query");
  assert.equal(boardPayload.proposalOnly, true);
  assert.deepEqual(boardPayload.writes, []);
  assert.equal(boardPayload.board.domain, "engineering");
  assert.equal(boardPayload.workspace.authoritativeRoot, ".dove");

  writeText(root, "bin/dove.mjs", "#!/usr/bin/env node\n");
  writeText(root, "tests/integration/dove-query.test.mjs", "import test from 'node:test';\n");
  writeText(root, "tmp/dove-query.log", "ok 1 dove return validation passed\nexit 0\n");

  const audit = spawnSync("node", [
    CLI,
    "audit",
    root,
    "--scope", "CLI Dove audit.",
    "--goal", "Close a CLI-visible Dove mission.",
    "--domain", "engineering",
    "--changed-file", "bin/dove.mjs",
    "--test-evidence", "tests/integration/dove-query.test.mjs",
    "--validation-output", "tmp/dove-query.log"
  ], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(audit.status, 0, audit.stderr || audit.stdout);
  const auditPayload = JSON.parse(audit.stdout);
  assert.equal(auditPayload.mode, "dove-audit-query");
  assert.equal(auditPayload.proposalOnly, true);
  assert.deepEqual(auditPayload.writes, []);
  assert.equal(auditPayload.mission.domain, "engineering");

  const returned = spawnSync("node", [
    CLI,
    "return",
    root,
    "--goal", "Close a CLI-visible Dove mission.",
    "--domain", "engineering",
    "--changed-file", "bin/dove.mjs",
    "--test-evidence", "tests/integration/dove-query.test.mjs",
    "--validation-output", "tmp/dove-query.log"
  ], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(returned.status, 0, returned.stderr || returned.stdout);
  const returnPayload = JSON.parse(returned.stdout);
  assert.equal(returnPayload.mode, "dove-return-query");
  assert.equal(returnPayload.proposalOnly, true);
  assert.deepEqual(returnPayload.writes, []);
  assert.equal(returnPayload.mission.domain, "engineering");
  assert.equal(returnPayload.engineeringEvidence.changedFiles.existingPaths.includes("bin/dove.mjs"), true);
  assert.equal(returnPayload.engineeringEvidence.validationEvidence.existingPaths.includes("tests/integration/dove-query.test.mjs"), true);
  assert.equal(returnPayload.engineeringEvidence.validationOutput.status, "passed");
  assert.equal(returnPayload.evidenceRead.includes("tests/integration/dove-query.test.mjs"), true);
});
