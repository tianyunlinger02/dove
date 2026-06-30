import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  createDoveTask,
  ensureWorkspace,
  launchDoveMission,
  queryDoveAudit,
  queryDoveMission,
  queryDoveMissionBoard,
  queryDoveOrchestrate,
  queryDoveReturn,
  queryDoveStatus,
  queryMetaOptimize,
  runDoveAuto
} from "../../src/core/index.mjs";
import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "dove.mjs");
const DOVE_CLI = path.join(ROOT, "bin", "dove.mjs");
const STATUS_EXECUTION_CRITERION = "Status execution criterion";
const STATUS_VERIFICATION_PATH = ".dove/evidence/status-verification.log";

function statusExecutionContract(overrides = {}) {
  const base = {
    chainType: "engineering-host-pass-verify",
    roleSequence: ["builder", "reviewer"],
    readFirst: [],
    action: "project:dove.auto",
    implementation: ["Produce status-routed workflow evidence."],
    files: [],
    materials: {
      requiredInputs: [],
      requiredArtifacts: [],
      sourceRefs: [],
      artifactRefs: []
    },
    convergence: {
      criteria: [STATUS_EXECUTION_CRITERION],
      verificationCommands: ["node --test tests/integration/dove-query.test.mjs"],
      evidenceRequired: [STATUS_VERIFICATION_PATH],
      definitionOfDone: "The status execution criterion is verified."
    },
    failureRoutes: [
      { on: "missing-required-materials", boundaryType: "missing-required-materials", nextAction: "project:dove.status", requiredActions: ["provide-required-materials"] },
      { on: "verification-failed", boundaryType: "verification-failed", nextAction: "project:dove.status", requiredActions: ["provide-verified-criteria"] }
    ]
  };
  return {
    ...base,
    ...overrides,
    roleSequence: overrides.roleSequence ?? base.roleSequence,
    readFirst: overrides.readFirst ?? base.readFirst,
    implementation: overrides.implementation ?? base.implementation,
    files: overrides.files ?? base.files,
    materials: {
      ...base.materials,
      ...(overrides.materials ?? {})
    },
    convergence: {
      ...base.convergence,
      ...(overrides.convergence ?? {})
    },
    failureRoutes: overrides.failureRoutes ?? base.failureRoutes
  };
}

function tempRoot() {
  return createTempRoot("dove-dove-query-");
}

function writeJson(root, relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, value, "utf8");
}

function assertDurableContextNotice(notice) {
  assert.ok(notice && typeof notice === "object", "expected durable context notice");
  assert.equal(notice.presentation, "dove-durable-context-notice");
  assert.equal(notice.stateSource, "filesystem-durable-state");
  assert.equal(notice.durableRoot, ".dove");
  assert.equal(notice.rollbackCoverage, "host-tracked-mutation-plan-required");
  assert.equal("nativeProjectRollbackExpected" in notice, false);
  assert.equal("nativeProjectRollbackRequiresProjectCheckpoint" in notice, false);
  assert.equal("projectCheckpointDetected" in notice, false);
  assert.equal("projectCheckpointStatus" in notice, false);
  assert.equal("projectCheckpoint" in notice, false);
  assert.equal(notice.nativeHostRollbackRequiresFileCheckpoint, true);
  assert.equal(notice.hostCheckpointDetected, false);
  assert.equal(notice.hostCheckpointStatus, "not-programmatically-verifiable");
  assert.ok(notice.hostCheckpoint && typeof notice.hostCheckpoint === "object");
  assert.equal(notice.hostCheckpoint.required, true);
  assert.equal(notice.hostCheckpoint.verificationRequired, true);
  assert.equal(notice.hostCheckpoint.externalWriteCaptureRequired, true);
  assert.ok(notice.mutationRollbackModel && typeof notice.mutationRollbackModel === "object");
  assert.equal(notice.mutationRollbackModel.patchPlanSupported, true);
  assert.equal(notice.mutationRollbackModel.hostTrackedFileEditsRequired, true);
  assert.equal(notice.mutationRollbackModel.directProcessWritesAreRollbackSafe, false);
  assert.equal(notice.mutationRollbackModel.hostCheckpointVerified, false);
  assert.equal(notice.mutationRollbackModel.externalWriteCaptureVerified, false);
  assert.equal(notice.mutationRollbackModel.doveRestoreSupported, false);
  assert.equal(notice.mutationRollbackModel.mutationProvenancePath, ".dove/mutations/index.json");
  assert.equal(notice.externalWriteCaptureRequired, true);
  assert.equal(notice.externalWriteCaptureVerified, false);
  assert.equal(notice.projectVisibilityRequired, true);
  assert.equal(notice.projectVisibilityVerified, false);
  assert.equal(notice.doveRestoreSupported, false);
  assert.equal(notice.doveRestoreCommand, null);
  assert.equal(notice.automaticRollback, false);
  assert.equal("rollbackSupported" in notice, false);
  assert.equal("rollbackCheckpointAvailable" in notice, false);
  assert.equal("latestRollbackCheckpoint" in notice, false);
  assert.deepEqual(notice.trackedDurablePaths, [".dove/state.json", ".dove/task-packets/index.json", ".dove/mutations/index.json"]);
  assert.deepEqual(notice.localOnlyIgnoredPaths, [".dove/config.local.json"]);
  assert.match(notice.summary, /\.dove/);
  assert.match(notice.summary, /mutationMode|direct-process|patch-plan/);
  assert.match(notice.recovery, /patch-plan|direct-process|回滚|rollback/);
  assert.deepEqual(notice.recoveryActions.map((action) => action.kind), ["refresh-status", "apply-mutation-plan-with-host-tracked-edits", "use-direct-process-as-unverified", "adjust-status"]);
  assert.equal(notice.recoveryActions[0].mutation, false);
  assert.equal(notice.recoveryActions[1].mutation, true);
  assert.equal(notice.recoveryActions[1].handledByHost, true);
  assert.equal(notice.recoveryActions[1].hostTrackedFileEditsRequired, true);
  assert.equal(notice.recoveryActions[2].mutation, true);
  assert.equal(notice.recoveryActions[2].hostRollbackEligible, false);
  assert.equal("requiresCheckpointKind" in notice.recoveryActions[2], false);
  assert.equal(notice.recoveryActions[3].confirmationRequired, true);
}

function writeTaskPacket(root, packet) {
  const packetPath = packet.packetPath ?? path.join(ARTIFACT_PATHS.taskPacketsPacketsDir, `${packet.id}.json`);
  const packetContextPath = packet.packetContextPath ?? path.join(ARTIFACT_PATHS.packetContextsDir, `${packet.id}.json`);
  for (const relativePath of [packetPath, packetContextPath]) {
    fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
  }
  const packetRecord = { ...packet, packetPath, packetContextPath };
  writeJson(root, packetPath, packetRecord);
  writeJson(root, packetContextPath, {
    id: packet.id,
    parentId: packet.parentId ?? null,
    rootId: packet.rootId ?? null,
    level: packet.level,
    creatorKind: packet.creatorKind,
    stage: packet.stage,
    domain: packet.domain,
    status: packet.status,
    dependencies: packet.dependencies ?? [],
    blockedBy: packet.blockedBy ?? [],
    lessonIds: packet.lessonIds ?? [],
    artifactRefs: packet.artifactRefs ?? [],
    contextPolicy: packet.contextPolicy ?? null,
    currentFocus: packet.currentFocus ?? null,
    nextAction: packet.nextAction ?? null,
    updatedAt: packet.updatedAt ?? null
  });
  const indexPath = path.join(root, ARTIFACT_PATHS.taskPacketsIndex);
  const existingIndex = fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath, "utf8"))
    : { version: 3, items: [], taskModel: { activeTaskIds: [] }, updatedAt: null };
  if (!existingIndex.items?.some((item) => item.id === packet.id)) {
    writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
      ...existingIndex,
      items: [...(existingIndex.items ?? []), packetRecord],
      taskModel: {
        ...(existingIndex.taskModel ?? {}),
        activeTaskIds: Array.from(new Set([...(existingIndex.taskModel?.activeTaskIds ?? []), packet.id]))
      }
    });
  }
  return { packetPath, packetContextPath };
}

test("CLI status defaults to a concise human summary and keeps JSON opt-in", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  const human = spawnSync("node", [CLI, "status", root], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /^Dove current situation:/);
  assert.match(human.stdout, /Current context:/);
  assert.match(human.stdout, /Durable state:/);
  assert.match(human.stdout, /rollback coverage: host-tracked-mutation-plan-required/);
  assert.match(human.stdout, /host checkpoint: not-programmatically-verifiable/);
  assert.match(human.stdout, /patch-plan supported: yes/);
  assert.match(human.stdout, /direct-process rollback-safe: no/);
  assert.match(human.stdout, /external Dove writes captured: unverified/);
  assert.match(human.stdout, /Dove restore command: none/);
  assert.match(human.stdout, /recovery: request mutationMode: patch-plan, inspect the operations, and apply them through host-tracked file edits before relying on host rollback/);
  assert.match(human.stdout, /Pre-action guidance:/);
  assert.match(human.stdout, /guardrails: writes require confirmation; no hidden runtime/);
  assert.match(human.stdout, /Project state:/);
  assert.match(human.stdout, /Blockers and reconciliation:/);
  assert.match(human.stdout, /Next steps:/);
  assert.match(human.stdout, /Mission details: collapsed by default/);
  assert.match(human.stdout, /Use --json or --format json for compact JSON/);
  assert.doesNotMatch(human.stdout, /^\{/);
  assert.doesNotMatch(human.stdout, /Machine statuses:/);
  assert.doesNotMatch(human.stdout, /"statusAdjustmentContract"/);

  const machine = spawnSync("node", [CLI, "status", root, "--json"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(machine.status, 0, machine.stderr || machine.stdout);
  const parsed = JSON.parse(machine.stdout);
  assert.equal(parsed.mode, "dove-status-query");
  assert.equal(parsed.detail, "compact");
  assert.equal(parsed.proposalOnly, true);
  assert.ok(parsed.statusAdjustmentContract);
  assert.equal(parsed.statusAdjustmentContract.statusAdjustmentItemsIncluded, false);
  assert.deepEqual(parsed.statusAdjustmentContract.items, []);
  assert.deepEqual(parsed.statusAdjustmentContract.adjustmentCards, []);
  assert.equal(parsed.dashboard, undefined);
  assert.equal(parsed.dailyHome, undefined);
  assert.equal(parsed.statusHome.presentation, "dove-project-situation-home");
  assertDurableContextNotice(parsed.durableContextNotice);
  assert.deepEqual(parsed.statusHome.durableContextNotice, parsed.durableContextNotice);
  assert.ok(parsed.statusHome.currentContext);
  assert.equal(parsed.statusHome.currentContext.stateSource, "filesystem-durable-state");
  assert.equal("nativeProjectRollbackExpected" in parsed.statusHome.currentContext, false);
  assert.equal("nativeProjectRollbackRequiresProjectCheckpoint" in parsed.statusHome.currentContext, false);
  assert.equal("projectCheckpointDetected" in parsed.statusHome.currentContext, false);
  assert.equal("projectCheckpointStatus" in parsed.statusHome.currentContext, false);
  assert.equal(parsed.statusHome.currentContext.nativeHostRollbackRequiresFileCheckpoint, true);
  assert.equal(parsed.statusHome.currentContext.hostCheckpointDetected, false);
  assert.equal(parsed.statusHome.currentContext.hostCheckpointStatus, "not-programmatically-verifiable");
  assert.equal(parsed.statusHome.currentContext.externalWriteCaptureRequired, true);
  assert.equal(parsed.statusHome.currentContext.externalWriteCaptureVerified, false);
  assert.equal(parsed.statusHome.currentContext.doveRestoreSupported, false);
  assert.equal(parsed.statusHome.currentContext.projectVisibilityRequired, true);
  assert.deepEqual(parsed.statusHome.blockersAndReconciliation.durableContextNotice, parsed.durableContextNotice);
  assert.equal(parsed.statusHome.preActionGuidance.presentation, "dove-pre-action-guidance");
  assert.equal(parsed.statusHome.preActionGuidance.mode, "read-only-guidance");
  assert.equal(parsed.statusHome.preActionGuidance.intentFrame.ordinaryPromptFirst, true);
  assert.equal(parsed.statusHome.preActionGuidance.intentFrame.missionAsWorkContract, true);
  assert.equal(parsed.statusHome.preActionGuidance.lessonRecall.automatic, true);
  assert.equal(parsed.statusHome.preActionGuidance.lessonRecall.readOnly, true);
  assert.equal(parsed.statusHome.preActionGuidance.lessonRecall.recordingExplicitOnly, true);
  assert.equal(parsed.statusHome.preActionGuidance.lessonRecall.lessonsPath, ".dove/meta/operator-lessons.json");
  assert.equal(parsed.statusHome.preActionGuidance.guardrails.noHiddenRuntime, true);
  assert.ok(parsed.statusHome.projectState);
  assert.ok(parsed.statusHome.blockersAndReconciliation);
  assert.ok(parsed.statusHome.nextSteps);
  assert.ok(parsed.statusHome.nextSteps.ranked.every((card) => card.kind && card.title && card.command));
  assert.ok(parsed.statusHome.optionalMissionDetails);

  const fullStressPackets = Array.from({ length: 30 }, (_, index) => ({
    id: `full-status-stress-${index}`,
    title: `Full status stress packet ${index}`,
    summary: `Full status serialization payload ${index}: ${"large durable status payload ".repeat(8)}`,
    status: index === 0 ? "blocked" : "ready",
    lifecycleStatus: "active",
    lifecycleFamily: "work-unit",
    doveDomain: "engineering",
    domain: "engineering",
    phase: "execute",
    stage: "execute",
    assignedRole: "builder",
    level: 1,
    creatorKind: "operator",
    currentFocus: `Keep full CLI JSON valid for packet ${index}`,
    nextAction: "project:dove.mission",
    blockedReason: index === 0 ? "needs unblock evidence" : null,
    outputPaths: [`.dove/runtime/full-status-stress-${index}.json`],
    evidenceLinks: [`tests/full-status-stress-${index}.test.mjs`],
    workContract: {
      purpose: "Ensure full status output can exceed pipe buffer size without truncation.",
      deliverables: [`large-result-${index}`, `validation-${index}`],
      doneCriteria: [`full JSON parses for packet ${index}`]
    }
  }));
  for (const packet of fullStressPackets) {
    writeTaskPacket(root, packet);
  }
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    version: 3,
    items: fullStressPackets,
    updatedAt: null
  });

  const fullHuman = spawnSync("node", [CLI, "status", root, "--full"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024
  });
  assert.equal(fullHuman.status, 0, fullHuman.stderr || fullHuman.stdout);
  assert.match(fullHuman.stdout, /Blockers and reconciliation:/);
  assert.match(fullHuman.stdout, /status: blocked/);
  assert.match(fullHuman.stdout, /blockers: 1/);

  const fullMachine = spawnSync("node", [CLI, "status", root, "--full", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024
  });
  assert.equal(fullMachine.status, 0, fullMachine.stderr || fullMachine.stdout);
  const fullParsed = JSON.parse(fullMachine.stdout);
  assert.equal(fullParsed.mode, "dove-status-query");
  assert.equal(fullParsed.detail, "full");
  assert.ok(fullParsed.dashboard);
});

test("status reports host rollback capture as unverifiable from Dove", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  const result = queryDoveStatus(root);
  assertDurableContextNotice(result.durableContextNotice);
  assert.equal(result.durableContextNotice.hostCheckpointDetected, false);
  assert.equal(result.durableContextNotice.hostCheckpointStatus, "not-programmatically-verifiable");
  assert.equal(result.durableContextNotice.hostCheckpoint.kind, "host-file-checkpoint");
  assert.equal(result.durableContextNotice.externalWriteCaptureVerified, false);
  assert.equal(result.statusHome.currentContext.hostCheckpointDetected, false);
  assert.equal(result.statusHome.currentContext.hostCheckpointStatus, "not-programmatically-verifiable");
  assert.equal(result.statusHome.currentContext.externalWriteCaptureVerified, false);
});

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

test("queryMetaOptimize exposes operator lessons summary and path", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  const result = queryMetaOptimize(root);
  assert.equal(result.operatorLessonsPath, ARTIFACT_PATHS.metaOperatorLessons);
  assert.equal(result.operatorLessons.explicitOnly, true);
  assert.equal(result.operatorLessons.noAutoCapture, true);
  assert.equal(result.operatorLessons.noAutoApply, true);
  assert.equal(result.operatorLessons.summary.lessonCount, 0);
  assert.equal(result.operatorLessons.summary.lessonsPath, ARTIFACT_PATHS.metaOperatorLessons);

  const workspaceIndex = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.workspaceIndex), "utf8"));
  assert.equal(workspaceIndex.metaOptimize.operatorLessons.lessonCount, 0);
  assert.equal(workspaceIndex.metaOptimize.operatorLessons.lessonsPath, ARTIFACT_PATHS.metaOperatorLessons);
});

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
        doveDomain: "paper",
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
        doveDomain: "review",
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

test("queryDoveStatus returns an authoritative task dashboard without surfacing stale navigation state", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  writeJson(root, ARTIFACT_PATHS.orchestrationBoard, {
    version: 2,
    currentPhase: "draft",
    currentFocus: "Ship the consolidated status surface.",
    objective: "Make Dove status one readable entrypoint.",
    assignedRole: "builder",
    nextAction: "Inspect status before continuing."
  });
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    version: 4,
    items: [
      {
        id: "dove-global-init",
        title: "Dove goal",
        summary: "Make Dove status one readable entrypoint.",
        parentId: null,
        rootId: "dove-global-init",
        level: 0,
        creatorKind: "user",
        stage: "plan",
        domain: "engineering",
        status: "ready",
        lifecycleStatus: "ready",
        dependencies: [],
        blockedBy: [],
        nextAction: "project:dove.mission"
      },
      {
        id: "status-packet",
        title: "Consolidate status",
        summary: "Index summary intentionally omits packet evidence details.",
        parentId: "dove-global-init",
        rootId: "dove-global-init",
        level: 3,
        creatorKind: "user",
        stage: "execute",
        domain: "engineering",
        status: "ready",
        lifecycleStatus: "ready",
        dependencies: [],
        blockedBy: [],
        executionContract: statusExecutionContract({ convergence: { criteria: ["Status packet evidence verified"] } }),
        verifiedCriteria: [{ criterion: "Status packet evidence verified", status: "verified", evidencePaths: [STATUS_VERIFICATION_PATH] }],
        verificationEvidencePaths: [STATUS_VERIFICATION_PATH],
        nextAction: "project:dove.auto"
      },
      {
        id: "plain-pending",
        title: "Plain pending mission",
        summary: "Pending missions without blockers should be recommended ready.",
        parentId: "dove-global-init",
        rootId: "dove-global-init",
        level: 3,
        creatorKind: "user",
        stage: "execute",
        domain: "engineering",
        status: "pending",
        lifecycleStatus: "pending",
        dependencies: [],
        blockedBy: [],
        executionContract: statusExecutionContract({ convergence: { criteria: ["Plain pending evidence verified"] } }),
        verifiedCriteria: [{ criterion: "Plain pending evidence verified", status: "verified", evidencePaths: [STATUS_VERIFICATION_PATH] }],
        verificationEvidencePaths: [STATUS_VERIFICATION_PATH],
        nextAction: "project:dove.auto"
      },
      {
        id: "blocked-dependency",
        title: "Blocked by unresolved dependency",
        summary: "Ready task with unresolved dependency should be recommended blocked.",
        parentId: "dove-global-init",
        rootId: "dove-global-init",
        level: 3,
        creatorKind: "user",
        stage: "execute",
        domain: "engineering",
        status: "ready",
        lifecycleStatus: "ready",
        dependencies: ["missing-dependency"],
        blockedBy: [],
        executionContract: statusExecutionContract({ convergence: { criteria: ["Blocked dependency evidence verified"] } }),
        verifiedCriteria: [{ criterion: "Blocked dependency evidence verified", status: "verified", evidencePaths: [STATUS_VERIFICATION_PATH] }],
        verificationEvidencePaths: [STATUS_VERIFICATION_PATH],
        nextAction: "project:dove.status"
      },
      {
        id: "runtime-progress",
        title: "Runtime progress mission",
        summary: "Runtime continuation should recommend in-progress.",
        parentId: "dove-global-init",
        rootId: "dove-global-init",
        level: 3,
        creatorKind: "user",
        stage: "execute",
        domain: "engineering",
        status: "ready",
        lifecycleStatus: "ready",
        dependencies: [],
        blockedBy: [],
        ownerRole: "builder",
        nextRole: "builder",
        workContract: {
          purpose: "Continue runtime progress from the persisted contract.",
          deliverables: ["Runtime progress implementation evidence."],
          outOfScope: ["Do not invent host-visible evidence."],
          evidenceContract: ["implementation evidence"],
          doneCriteria: ["Host evidence is recorded on the packet."],
          practicalImpact: "Status can route the existing packet without re-running mission conversion.",
          recommendedRoutes: [{
            label: "Continue with auto",
            command: "project:dove.auto",
            copyableCommand: "project:dove.auto --packet-id runtime-progress",
            packetId: "runtime-progress",
            when: "Use this when the persisted contract already exists.",
            role: "builder",
            evidenceRequired: ["implementation evidence"],
            doneCriteria: ["Host evidence is recorded on the packet."],
            rank: 1
          }]
        },
        boundary: {
          id: "boundary-runtime-progress",
          type: "awaiting-host-pass",
          status: "open",
          packetId: "runtime-progress",
          runId: "runtime-progress-run",
          sourceSurface: "dove.auto",
          command: "run_dove_auto",
          reason: "Need host-visible implementation evidence.",
          summary: "Runtime progress is waiting for host evidence.",
          requiredInputs: ["implementation evidence"],
          requiredActions: ["provide-host-pass-result"],
          ownerRole: "builder",
          nextRole: "builder",
          createdAt: "2026-05-15T00:01:00.000Z"
        },
        nextAction: "project:dove.auto"
      },
      {
        id: "runtime-completed",
        title: "Runtime completed mission",
        summary: "Runtime completion should recommend completed even before manual status adjustment.",
        parentId: "dove-global-init",
        rootId: "dove-global-init",
        level: 3,
        creatorKind: "user",
        stage: "execute",
        domain: "engineering",
        status: "pending",
        lifecycleStatus: "pending",
        dependencies: [],
        blockedBy: [],
        executionContract: statusExecutionContract({ convergence: { criteria: ["Runtime completed evidence verified"] } }),
        verifiedCriteria: [{ criterion: "Runtime completed evidence verified", status: "verified", evidencePaths: [STATUS_VERIFICATION_PATH] }],
        verificationEvidencePaths: [STATUS_VERIFICATION_PATH],
        nextAction: "project:dove.status"
      },
      {
        id: "zz-status-completed",
        title: "Completed status mission",
        summary: "Completed missions stay out of the one-dialog status contract.",
        parentId: "dove-global-init",
        rootId: "dove-global-init",
        level: 3,
        creatorKind: "user",
        stage: "execute",
        domain: "engineering",
        status: "completed",
        lifecycleStatus: "completed",
        dependencies: [],
        blockedBy: [],
        nextAction: "project:dove.status",
        outputPaths: [],
        evidenceLinks: []
      },
      {
        id: "zz-status-killed",
        title: "Killed status mission",
        summary: "Killed missions stay out of the one-dialog status contract.",
        parentId: "dove-global-init",
        rootId: "dove-global-init",
        level: 3,
        creatorKind: "user",
        stage: "execute",
        domain: "engineering",
        status: "killed",
        lifecycleStatus: "killed",
        dependencies: [],
        blockedBy: [],
        nextAction: "project:dove.status",
        outputPaths: [],
        evidenceLinks: []
      }
    ],
    taskModel: {
      activeInitId: "dove-global-init",
      activeTaskIds: ["status-packet"]
    },
    lifecycleCounts: { ready: 4, pending: 2, completed: 1, killed: 1 },
    lifecycleFamilyCounts: {},
    dependencyHealth: {},
    updatedAt: null
  });
  writeTaskPacket(root, {
    id: "status-packet",
    title: "Consolidate status",
    summary: "Status should trust the full packet file, not stale wiki navigation.",
    parentId: "dove-global-init",
    rootId: "dove-global-init",
    level: 3,
    creatorKind: "user",
    stage: "execute",
    domain: "engineering",
    status: "ready",
    lifecycleStatus: "ready",
    dependencies: [],
    blockedBy: [],
    lessonIds: ["status-packet-lesson"],
    evidenceExpectations: ["full packet evidence", "runtime summary"],
    artifactRefs: ["docs/USAGE.md"],
    outputPaths: ["src/core/dove.mjs"],
    evidenceLinks: ["tests/integration/dove-query.test.mjs"],
    executionContract: statusExecutionContract({ convergence: { criteria: ["Status packet evidence verified"] } }),
    verifiedCriteria: [{ criterion: "Status packet evidence verified", status: "verified", evidencePaths: [STATUS_VERIFICATION_PATH] }],
    verificationEvidencePaths: [STATUS_VERIFICATION_PATH],
    currentFocus: "Use full packet catalog data in status.",
    nextAction: "project:dove.auto"
  });
  writeJson(root, ARTIFACT_PATHS.runtimeContinuation, {
    version: 1,
    explicitInvocationOnly: true,
    noDaemon: true,
    items: [{
      kind: "continue-in-progress",
      command: "project:dove.auto",
      packetId: "runtime-progress",
      programRunId: "program-run-status",
      followThroughId: "follow-status",
      summary: "A foreground runtime pass is waiting for the next explicit call.",
      requiredReadPaths: [ARTIFACT_PATHS.runtimeResults],
      readyAt: "2026-05-15T00:00:00.000Z"
    }],
    summary: {
      continuationCount: 1,
      currentKind: "continue-in-progress",
      currentPacketId: "runtime-progress",
      currentProgramRunId: "program-run-status",
      currentCommand: "project:dove.auto",
      overview: "One explicit continuation is pending.",
      continuationPath: ARTIFACT_PATHS.runtimeContinuation
    },
    updatedAt: "2026-05-15T00:00:00.000Z"
  });
  writeJson(root, ARTIFACT_PATHS.runtimeResults, {
    version: 1,
    explicitInvocationOnly: true,
    entries: [
      {
        id: "runtime-progress-run",
        surface: "dove.auto",
        packetId: "runtime-progress",
        status: "in-progress",
        outcome: "continue-in-progress",
        stopReason: "step-budget-exhausted",
        startedAt: "2026-05-15T00:00:00.000Z",
        updatedAt: "2026-05-15T00:01:00.000Z"
      },
      {
        id: "runtime-completed-run",
        surface: "dove.mission",
        packetId: "runtime-completed",
        status: "completed",
        outcome: "task-completed",
        stopReason: "completion-confirmed-by-mission-pass",
        startedAt: "2026-05-15T00:02:00.000Z",
        completedAt: "2026-05-15T00:03:00.000Z",
        updatedAt: "2026-05-15T00:03:00.000Z"
      }
    ],
    summary: {
      runCount: 2,
      completedCount: 1,
      lastRunId: "runtime-completed-run",
      lastStatus: "completed",
      lastOutcome: "task-completed",
      overview: "Two foreground runtime runs are recorded.",
      resultsPath: ARTIFACT_PATHS.runtimeResults
    },
    updatedAt: "2026-05-15T00:03:00.000Z"
  });
  writeJson(root, ARTIFACT_PATHS.runtimeEvents, {
    version: 1,
    explicitInvocationOnly: true,
    entries: [
      {
        id: "event-runtime-progress-transition",
        type: "task.lifecycle.transitioned",
        packetId: "runtime-progress",
        runId: "runtime-progress-run",
        surface: "dove.auto",
        command: "run_dove_auto",
        fromStatus: "ready",
        toStatus: "ready",
        summary: "Auto stopped at a host evidence boundary.",
        timestamp: "2026-05-15T00:01:00.000Z"
      },
      {
        id: "event-runtime-progress-boundary",
        type: "task.boundary.opened",
        packetId: "runtime-progress",
        runId: "runtime-progress-run",
        surface: "dove.auto",
        command: "run_dove_auto",
        boundaryId: "boundary-runtime-progress",
        summary: "Need host-visible implementation evidence.",
        timestamp: "2026-05-15T00:01:01.000Z"
      }
    ],
    summary: {
      eventCount: 2,
      lastEventType: "task.boundary.opened",
      lastRunId: "runtime-progress-run",
      overview: "Two runtime events are recorded.",
      eventsPath: ARTIFACT_PATHS.runtimeEvents
    },
    updatedAt: "2026-05-15T00:01:01.000Z"
  });
  writeJson(root, ARTIFACT_PATHS.metaOperatorLessons, {
    version: 1,
    referenceOnly: true,
    explicitOnly: true,
    noAutoCapture: true,
    noAutoApply: true,
    lessons: [
      {
        id: "global-status-lesson",
        title: "Explain live context first",
        problem: "Operators need live context before durable state.",
        decisions: ["Separate host-visible context from Dove durable state."],
        pitfalls: ["Do not repeat only mission status."],
        validation: ["Status output names the live context boundary."],
        nextTime: ["Start with the current development situation."],
        domain: "engineering",
        stage: "return",
        actorRole: "planner",
        tags: ["status"],
        sourceArtifacts: [ARTIFACT_PATHS.workspaceIndex],
        packetIds: [],
        status: "active"
      },
      {
        id: "status-packet-lesson",
        title: "Read full packet evidence",
        problem: "Index-only status hides evidence expectations.",
        decisions: ["Use full packet catalog data."],
        pitfalls: ["Do not rely on stale derived navigation."],
        validation: ["Status task includes packet evidence fields."],
        nextTime: ["Inspect packetPath and packetContextPath."],
        domain: "engineering",
        stage: "return",
        actorRole: "planner",
        tags: ["status"],
        sourceArtifacts: [ARTIFACT_PATHS.taskPacketsIndex],
        packetIds: ["status-packet"],
        status: "active"
      },
      {
        id: "retired-status-lesson",
        title: "Retired lesson",
        problem: "Retired lessons should not apply.",
        decisions: ["Ignore retired lessons."],
        pitfalls: ["Do not show inactive lessons."],
        validation: ["Only active lessons appear."],
        nextTime: ["Keep inactive lessons hidden."],
        domain: "engineering",
        stage: "return",
        actorRole: "planner",
        sourceArtifacts: [ARTIFACT_PATHS.taskPacketsIndex],
        packetIds: ["status-packet"],
        status: "retired"
      }
    ],
    updatedAt: "2026-05-15T00:04:00.000Z"
  });
  writeText(root, ARTIFACT_PATHS.navigationReport, "Next action: Run project:dove.auto for an already completed stale task.\n");
  const statusWatchedArtifacts = [
    ...watchedArtifacts,
    ARTIFACT_PATHS.navigationReport,
    ARTIFACT_PATHS.runtimeContinuation,
    ARTIFACT_PATHS.runtimeEvents,
    ARTIFACT_PATHS.runtimeResults,
    ARTIFACT_PATHS.metaOperatorLessons,
    path.join(ARTIFACT_PATHS.taskPacketsPacketsDir, "status-packet.json"),
    path.join(ARTIFACT_PATHS.packetContextsDir, "status-packet.json")
  ];
  const before = snapshotArtifacts(root, statusWatchedArtifacts);

  const result = queryDoveStatus(root, { domain: "engineering" });
  const expandedResult = queryDoveStatus(root, { domain: "engineering", showMissions: true, requestStatusAdjustment: true });
  const fullResult = queryDoveStatus(root, { domain: "engineering", detail: "full" });
  const after = snapshotArtifacts(root, statusWatchedArtifacts);

  assert.equal(result.mode, "dove-status-query");
  assert.equal(result.query, true);
  assert.equal(result.proposalOnly, true);
  assert.equal(result.noAutoApply, true);
  assert.deepEqual(result.writes, []);
  assert.equal(result.detail, "compact");
  assert.equal(result.dashboard, undefined);
  assert.equal(result.dailyHome, undefined);
  assert.equal(result.statusHome.presentation, "dove-project-situation-home");
  assertDurableContextNotice(result.durableContextNotice);
  assert.deepEqual(result.statusHome.durableContextNotice, result.durableContextNotice);
  assert.equal(result.statusHome.liveContextFirst, true);
  assert.equal(result.statusHome.fullDetails.args.detail, "full");
  assert.ok(result.statusHome.currentContext);
  assert.equal(result.statusHome.currentContext.stateSource, "filesystem-durable-state");
  assert.equal("nativeProjectRollbackExpected" in result.statusHome.currentContext, false);
  assert.equal("nativeProjectRollbackRequiresProjectCheckpoint" in result.statusHome.currentContext, false);
  assert.equal("projectCheckpointDetected" in result.statusHome.currentContext, false);
  assert.equal("projectCheckpointStatus" in result.statusHome.currentContext, false);
  assert.equal(result.statusHome.currentContext.nativeHostRollbackRequiresFileCheckpoint, true);
  assert.equal(result.statusHome.currentContext.hostCheckpointDetected, false);
  assert.equal(result.statusHome.currentContext.hostCheckpointStatus, "not-programmatically-verifiable");
  assert.equal(result.statusHome.currentContext.externalWriteCaptureRequired, true);
  assert.equal(result.statusHome.currentContext.externalWriteCaptureVerified, false);
  assert.equal(result.statusHome.currentContext.doveRestoreSupported, false);
  assert.equal(result.statusHome.currentContext.projectVisibilityRequired, true);
  assert.deepEqual(result.statusHome.blockersAndReconciliation.durableContextNotice, result.durableContextNotice);
  assert.equal(result.statusHome.preActionGuidance.presentation, "dove-pre-action-guidance");
  assert.equal(result.statusHome.preActionGuidance.mode, "read-only-guidance");
  assert.equal(result.statusHome.preActionGuidance.intentFrame.ordinaryPromptFirst, true);
  assert.equal(result.statusHome.preActionGuidance.intentFrame.missionAsWorkContract, true);
  assert.equal(result.statusHome.preActionGuidance.intentFrame.noDedicatedMissionListCommand, true);
  assert.equal(result.statusHome.preActionGuidance.lessonRecall.automatic, true);
  assert.equal(result.statusHome.preActionGuidance.lessonRecall.readOnly, true);
  assert.equal(result.statusHome.preActionGuidance.lessonRecall.recordingExplicitOnly, true);
  assert.equal(result.statusHome.preActionGuidance.lessonRecall.lessonsPath, ".dove/meta/operator-lessons.json");
  assert.equal(result.statusHome.preActionGuidance.guardrails.explicitOnly, true);
  assert.equal(result.statusHome.preActionGuidance.guardrails.noHiddenRuntime, true);
  assert.equal(result.statusHome.preActionGuidance.guardrails.noAutoApply, true);
  assert.equal(result.statusHome.preActionGuidance.guardrails.requiresConfirmationForWrites, true);
  assert.equal(result.statusHome.preActionGuidance.guardrails.boundedForegroundOnly, true);
  assert.ok(result.statusHome.preActionGuidance.lessonRecall.topLessons.some((lesson) => lesson.id === "status-packet-lesson"));
  assert.equal(result.statusHome.preActionGuidance.lessonRecall.topLessons.some((lesson) => lesson.id === "retired-status-lesson"), false);
  assert.ok(result.statusHome.projectState);
  assert.ok(result.statusHome.blockersAndReconciliation);
  assert.ok(result.statusHome.nextSteps);
  assert.equal(result.statusHome.optionalMissionDetails.defaultCollapsed, true);
  assert.equal(fullResult.detail, "full");
  assertDurableContextNotice(fullResult.durableContextNotice);
  assert.deepEqual(fullResult.dashboard.project.durableContextNotice, fullResult.durableContextNotice);
  assert.deepEqual(fullResult.diagnostics.durableContextNotice, fullResult.durableContextNotice);
  assert.ok(fullResult.dashboard);
  assert.equal(result.statusHome.currentContext.domain, "engineering");
  assert.equal(result.statusHome.currentContext.stage, "execute");
  assert.equal(result.statusHome.currentContext.primaryRole, "builder");
  assert.equal(result.statusHome.projectState.missionCounts.open, 4);
  assert.equal(result.statusHome.projectState.missionCounts.todo, 2);
  assert.equal(result.statusHome.projectState.missionCounts.doing, 1);
  assert.equal(result.statusHome.projectState.missionCounts.blocked, 1);
  assert.equal(result.statusHome.projectState.missionCounts.done, 3);
  assert.ok(result.statusHome.nextSteps.ranked.length <= 3);
  assert.ok(result.statusHome.nextSteps.ranked.every((card) => card.kind && card.title && card.command));
  assert.ok(result.statusHome.nextSteps.ranked.every((card) => card.proposalOnly === true && card.noAutoApply === true));
  assert.ok(result.statusHome.blockersAndReconciliation.boundaryActionCards.every((card) => card.proposalOnly === true && card.noAutoApply === true));
  const optionalMissionDetails = result.statusHome.optionalMissionDetails;
  assert.equal(optionalMissionDetails.presentation, "dove-mission-list");
  assert.equal(optionalMissionDetails.detail, "summary");
  assert.equal(optionalMissionDetails.missionItemsIncluded, false);
  assert.equal(optionalMissionDetails.groupsOmitted, true);
  assert.equal("groups" in optionalMissionDetails, false);
  assert.deepEqual(optionalMissionDetails.statusModel.userGroups, ["todo", "doing", "blocked", "done"]);
  assert.deepEqual(optionalMissionDetails.statusModel.machineStatuses, ["pending", "ready", "in-progress", "blocked", "completed", "killed"]);
  assert.equal(optionalMissionDetails.groupCounts.todo.itemCount, 2);
  assert.equal(optionalMissionDetails.groupCounts.doing.itemCount, 1);
  assert.equal(optionalMissionDetails.groupCounts.blocked.itemCount, 1);
  assert.equal(optionalMissionDetails.groupCounts.done.itemCount, 3);
  assert.equal(optionalMissionDetails.requestArgs.showMissions, true);
  const expandedMissionDetails = expandedResult.statusHome.optionalMissionDetails;
  assert.equal(expandedMissionDetails.detail, "compact");
  assert.equal(expandedMissionDetails.missionItemsIncluded, true);
  assert.deepEqual(expandedMissionDetails.groups.todo.items.map((item) => item.packetId), ["plain-pending", "status-packet"]);
  assert.deepEqual(expandedMissionDetails.groups.doing.items.map((item) => item.packetId), ["runtime-progress"]);
  assert.deepEqual(expandedMissionDetails.groups.blocked.items.map((item) => item.packetId), ["blocked-dependency"]);
  assert.deepEqual(expandedMissionDetails.groups.done.items.map((item) => item.packetId), []);
  assert.equal(expandedMissionDetails.groups.done.itemCount, 3);
  assert.equal(expandedMissionDetails.groups.done.hiddenCount, 3);
  assert.deepEqual(fullResult.dailyHome.missionList.groups.done.items.map((item) => item.packetId), ["runtime-completed", "zz-status-completed", "zz-status-killed"]);
  assert.equal(optionalMissionDetails.summary.openCount, 4);
  assert.equal(optionalMissionDetails.summary.todoCount, 2);
  assert.equal(optionalMissionDetails.summary.doingCount, 1);
  assert.equal(optionalMissionDetails.summary.blockedCount, 1);
  assert.equal(optionalMissionDetails.summary.doneCount, 3);
  assert.deepEqual(fullResult.dashboard.dailyHome, fullResult.dailyHome);
  assert.deepEqual(fullResult.dashboard.tasks.grouped, fullResult.dailyHome.missionList);
  assert.deepEqual(after, before);
  assert.equal(result.current.domain, "engineering");
  assert.equal(result.current.stage, "execute");
  assert.equal(result.current.primaryRole, "builder");
  assert.equal(result.current.nextCommand, result.statusHome.nextSteps.primary.command);
  assert.equal(result.current.nextCommand, "project:dove.auto");
  assert.equal(result.board.nextCommand, result.statusHome.nextSteps.primary.command);
  assert.equal(fullResult.dashboard.project.nextAction, fullResult.dailyHome.nextActions[0].command);
  assert.equal(fullResult.dashboard.nextAction, fullResult.dailyHome.nextActions[0].command);
  assert.equal(result.suggestedNextCommand, result.statusHome.nextSteps.primary.command);
  assert.equal(result.board.domain, "engineering");
  assert.equal(result.projectSummary.openMissionCount, 4);
  assert.equal(result.projectSummary.todoMissionCount, 2);
  assert.equal(result.projectSummary.doingMissionCount, 1);
  assert.equal(result.projectSummary.blockedMissionCount, 1);
  assert.equal(fullResult.dashboard.init.id, "dove-global-init");
  assert.deepEqual(fullResult.dashboard.tasks.activeTaskIds, ["blocked-dependency", "plain-pending", "runtime-completed", "runtime-progress", "status-packet"]);
  assert.equal(fullResult.dashboard.tasks.counts.byStatus.ready, 4);
  assert.equal(fullResult.dashboard.tasks.tree[0].children.some((task) => task.id === "status-packet"), true);
  assert.equal(fullResult.dashboard.runtime.continuation.currentPacketId, "runtime-progress");
  assert.equal(fullResult.dashboard.runtime.results.lastRunId, "runtime-completed-run");
  assert.equal(fullResult.dashboard.runtime.events.lastEventType, "task.boundary.opened");

  const statusTask = fullResult.dashboard.tasks.active.find((task) => task.id === "status-packet");
  assert.ok(statusTask);
  assert.deepEqual(statusTask.evidenceExpectations, ["full packet evidence", "runtime summary"]);
  assert.equal(statusTask.outputPaths.includes("src/core/dove.mjs"), true);
  assert.equal(statusTask.evidenceLinks.includes("tests/integration/dove-query.test.mjs"), true);
  assert.equal(statusTask.artifactRefs.includes("docs/USAGE.md"), true);
  assert.equal(statusTask.artifactRefs.includes("src/core/dove.mjs"), true);
  assert.equal(statusTask.packetPath, path.join(ARTIFACT_PATHS.taskPacketsPacketsDir, "status-packet.json"));
  assert.equal(statusTask.packetContextPath, path.join(ARTIFACT_PATHS.packetContextsDir, "status-packet.json"));
  assert.deepEqual(statusTask.applicableLessons.map((lesson) => lesson.id), ["global-status-lesson", "status-packet-lesson"]);
  assert.equal(statusTask.workContract, null);

  const blockedTask = fullResult.dashboard.tasks.active.find((task) => task.id === "blocked-dependency");
  assert.equal(blockedTask.blockedReason, "unresolved-dependencies:missing-dependency");
  assert.deepEqual(blockedTask.unresolvedDependencyIds, ["missing-dependency"]);
  assert.equal(fullResult.dashboard.blockers.some((blocker) => blocker.taskId === "blocked-dependency" && blocker.unresolvedDependencyIds.includes("missing-dependency")), true);

  const runtimeTask = fullResult.dashboard.tasks.active.find((task) => task.id === "runtime-progress");
  assert.equal(runtimeTask.lastRun.id, "runtime-progress-run");
  assert.equal(runtimeTask.lastEvent.type, "task.boundary.opened");
  assert.equal(runtimeTask.currentBoundary.type, "awaiting-host-pass");
  assert.equal(runtimeTask.actionableBoundary.type, "awaiting-host-pass");
  assert.equal(runtimeTask.lastStopReason, "Need host-visible implementation evidence.");
  assert.equal(runtimeTask.continuationState.command, "project:dove.auto");
  assert.equal(result.actionableBoundaries.some((boundary) => boundary.packetId === "runtime-progress" && boundary.type === "awaiting-host-pass"), true);
  assert.equal(fullResult.dashboard.tasks.actionableBoundaries.some((boundary) => boundary.packetId === "runtime-progress"), true);
  const runtimeBoundaryCard = result.boundaryActionCards.find((card) => card.packetId === "runtime-progress");
  assert.ok(runtimeBoundaryCard);
  assert.equal(runtimeBoundaryCard.kind, "provide-evidence-or-result");
  assert.equal(runtimeBoundaryCard.command, "project:dove.auto");
  assert.deepEqual(runtimeBoundaryCard.requires, ["implementation evidence", "provide-host-pass-result"]);
  assert.equal(runtimeBoundaryCard.options.some((option) => option.kind === "kill-through-status" && option.tool === "apply_dove_status_adjustments"), true);
  assert.deepEqual(fullResult.dashboard.tasks.boundaryActionCards, fullResult.boundaryActionCards);
  const runtimeNextAction = fullResult.dailyHome.nextActions.find((card) => card.packetId === "runtime-progress");
  assert.ok(runtimeNextAction);
  assert.equal(runtimeNextAction.kind, "provide-evidence");
  assert.equal(runtimeNextAction.command, "project:dove.auto");
  assert.equal(runtimeNextAction.rank, 1);
  const runtimeContinuationAction = fullResult.dailyHome.nextActions.find((card) => card.packetId === "runtime-progress" && card.kind === "continue-task");
  assert.ok(runtimeContinuationAction);
  assert.equal(runtimeContinuationAction.copyableCommand, "project:dove.auto --packet-id runtime-progress");
  assert.equal(runtimeContinuationAction.firstAction, "project:dove.auto --packet-id runtime-progress");
  assert.ok(runtimeContinuationAction.workContract.deliverables.length > 0);
  assert.ok(runtimeContinuationAction.evidenceRequired.length > 0);
  assert.ok(runtimeContinuationAction.doneCriteria.length > 0);
  assert.equal(runtimeContinuationAction.route.copyableCommand, "project:dove.auto --packet-id runtime-progress");

  const humanStatus = spawnSync("node", [CLI, "status", root], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(humanStatus.status, 0, humanStatus.stderr || humanStatus.stdout);
  assert.match(humanStatus.stdout, /Dove current situation:/);
  assert.match(humanStatus.stdout, /Current context:/);
  assert.match(humanStatus.stdout, /Pre-action guidance:/);
  assert.match(humanStatus.stdout, /guardrails: writes require confirmation; no hidden runtime/);
  assert.match(humanStatus.stdout, /Project state:/);
  assert.match(humanStatus.stdout, /missions: open 4, todo 2, doing 1, blocked 1, done 3/);
  assert.match(humanStatus.stdout, /Blockers and reconciliation:/);
  assert.match(humanStatus.stdout, /Next steps:/);
  assert.match(humanStatus.stdout, /Mission details: collapsed by default/);
  assert.doesNotMatch(humanStatus.stdout, /Machine statuses:/);
  assert.doesNotMatch(humanStatus.stdout, /runtime-progress: Runtime progress mission \[ready->in-progress\]/);
  assert.match(humanStatus.stdout, /command: project:dove\.auto --packet-id runtime-progress/);
  assert.match(humanStatus.stdout, /deliver:/);
  assert.match(humanStatus.stdout, /done:/);

  const humanStatusWithMissions = spawnSync("node", [CLI, "status", root, "--missions"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(humanStatusWithMissions.status, 0, humanStatusWithMissions.stderr || humanStatusWithMissions.stdout);
  assert.match(humanStatusWithMissions.stdout, /Mission details:/);
  assert.match(humanStatusWithMissions.stdout, /doing: 1/);
  assert.match(humanStatusWithMissions.stdout, /runtime-progress: Runtime progress mission \[ready->in-progress\]/);
  assert.match(humanStatusWithMissions.stdout, /blocked: 1/);
  assert.match(humanStatusWithMissions.stdout, /blocked-dependency: Blocked by unresolved dependency \[ready->blocked\]/);
  assert.match(humanStatusWithMissions.stdout, /todo: 2/);
  assert.match(humanStatusWithMissions.stdout, /plain-pending: Plain pending mission \[pending->ready\]/);
  assert.match(humanStatusWithMissions.stdout, /done: 3/);

  const beforeStatusline = snapshotArtifacts(root, statusWatchedArtifacts);
  const humanStatusline = spawnSync("node", [CLI, "statusline", root, "--domain", "engineering"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const machineStatusline = spawnSync("node", [CLI, "statusline", root, "--domain", "engineering", "--json"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const afterStatusline = snapshotArtifacts(root, statusWatchedArtifacts);
  assert.equal(humanStatusline.status, 0, humanStatusline.stderr || humanStatusline.stdout);
  assert.match(humanStatusline.stdout, /^Dove: /);
  assert.match(humanStatusline.stdout, /open 4/);
  assert.match(humanStatusline.stdout, /todo 2/);
  assert.match(humanStatusline.stdout, /doing 1/);
  assert.match(humanStatusline.stdout, /blocked 1/);
  assert.doesNotMatch(humanStatusline.stdout, /active \d+/);
  assert.doesNotMatch(humanStatusline.stdout, /boundaries \d+/);
  assert.doesNotMatch(humanStatusline.stdout, /next/i);
  assert.doesNotMatch(humanStatusline.stdout, /project:dove\./);
  assert.doesNotMatch(humanStatusline.stdout, /^\{/);
  assert.doesNotMatch(humanStatusline.stdout, /Status adjustments:/);
  assert.equal(machineStatusline.status, 0, machineStatusline.stderr || machineStatusline.stdout);
  const parsedStatusline = JSON.parse(machineStatusline.stdout);
  assert.equal(parsedStatusline.mode, "dove-statusline");
  assert.equal(parsedStatusline.proposalOnly, true);
  assert.equal(parsedStatusline.noAutoApply, true);
  assert.deepEqual(parsedStatusline.writes, []);
  assert.equal(parsedStatusline.summary.openMissionCount, 4);
  assert.equal(parsedStatusline.summary.todoMissionCount, 2);
  assert.equal(parsedStatusline.summary.doingMissionCount, 1);
  assert.equal(parsedStatusline.summary.blockedMissionCount, 1);
  assert.equal("nextActions" in parsedStatusline, false);
  assert.equal("nextActionCount" in parsedStatusline.summary, false);
  assert.equal("activeMissionCount" in parsedStatusline.summary, false);
  assert.doesNotMatch(parsedStatusline.text, /next/i);
  assert.doesNotMatch(parsedStatusline.text, /active \d+/);
  assert.doesNotMatch(parsedStatusline.text, /boundaries \d+/);
  assert.doesNotMatch(parsedStatusline.text, /project:dove\./);
  assert.deepEqual(afterStatusline, beforeStatusline);

  const statusAdjustmentItems = Object.fromEntries(fullResult.statusAdjustmentContract.items.map((item) => [item.packetId, item]));
  assert.deepEqual(result.statusAdjustmentContract.statusChoices, ["pending", "ready", "in-progress", "blocked", "completed", "killed"]);
  assert.equal(result.statusAdjustmentContract.statusAdjustmentItemsIncluded, false);
  assert.deepEqual(result.statusAdjustmentContract.items, []);
  assert.deepEqual(result.statusAdjustmentContract.adjustmentCards, []);
  assert.equal(result.statusHome.statusAdjustmentPreview.requestArgs.requestStatusAdjustment, true);
  assert.equal(expandedResult.statusAdjustmentContract.statusAdjustmentItemsIncluded, true);
  assert.equal(expandedResult.statusAdjustmentContract.adjustmentCards.length, expandedResult.statusAdjustmentContract.items.length);
  assert.ok(expandedResult.statusAdjustmentContract.adjustmentCards.every((card) => card.presentation === "compact-status-adjustment-card"));
  assert.equal(Boolean(statusAdjustmentItems["status-packet"]), true);
  assert.equal(Boolean(statusAdjustmentItems["plain-pending"]), true);
  assert.equal(Boolean(statusAdjustmentItems["blocked-dependency"]), true);
  assert.equal(Boolean(statusAdjustmentItems["runtime-progress"]), true);
  assert.equal(Boolean(statusAdjustmentItems["runtime-completed"]), true);
  assert.equal(Boolean(statusAdjustmentItems["zz-status-completed"]), false);
  assert.equal(Boolean(statusAdjustmentItems["zz-status-killed"]), false);
  assert.equal(Boolean(statusAdjustmentItems["dove-global-init"]), false);
  assert.equal(statusAdjustmentItems["plain-pending"].recommendedStatus, "ready");
  assert.equal(statusAdjustmentItems["blocked-dependency"].recommendedStatus, "blocked");
  assert.equal(statusAdjustmentItems["runtime-progress"].recommendedStatus, "in-progress");
  assert.equal(statusAdjustmentItems["runtime-progress"].currentBoundary.type, "awaiting-host-pass");
  assert.equal(statusAdjustmentItems["runtime-progress"].actionableBoundary.type, "awaiting-host-pass");
  assert.equal(statusAdjustmentItems["runtime-progress"].adjustmentCard.presentation, "compact-status-adjustment-card");
  assert.equal(statusAdjustmentItems["runtime-progress"].adjustmentCard.proposalOnly, true);
  assert.equal(statusAdjustmentItems["runtime-progress"].lastEvent.type, "task.boundary.opened");
  assert.equal(statusAdjustmentItems["runtime-completed"].recommendedStatus, "completed");
  assert.equal(statusAdjustmentItems["runtime-completed"].lastStopReason, "completion-confirmed-by-mission-pass");
  assert.equal(fullResult.dashboard.returnReadiness.status, "blocked");
  assert.equal("taskGraph" in result, false);
  assert.equal("paperLifecycle" in result, false);
  assert.equal("openQuestions" in result, false);
  assert.equal("decisions" in result, false);
  assert.equal("lineage" in result, false);
  assert.equal(result.diagnostics.omittedSections.includes("dashboard"), true);
  assert.deepEqual(result.diagnostics.fullDetails, { detail: "full" });
  assert.equal(fullResult.diagnostics.derivedReports.navigationReportPath, ARTIFACT_PATHS.navigationReport);
  assert.equal(fullResult.diagnostics.primaryStateSources.includes(ARTIFACT_PATHS.taskPacketsPacketsDir), true);
  assert.equal(fullResult.diagnostics.primaryStateSources.includes(ARTIFACT_PATHS.runtimeContinuation), true);
  assert.equal(fullResult.diagnostics.primaryStateSources.includes(ARTIFACT_PATHS.runtimeEvents), true);
  assert.equal(fullResult.diagnostics.primaryStateSources.includes(ARTIFACT_PATHS.runtimeResults), true);
  assert.equal(result.diagnostics.mayRefreshDerivedSurfaces, false);
  assert.equal(result.diagnostics.noCommandExecution, true);
  assert.equal(result.diagnostics.noExternalProcess, true);
  assert.equal(result.diagnostics.noGitInspection, true);
  assert.equal("gitInspection" in result.diagnostics, false);
  assert.equal(result.diagnostics.noSourceMutation, true);
});

test("queryDoveStatus routes executable workflow gaps before mission details", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  writeTaskPacket(root, {
    id: "dove-global-init",
    title: "Dove goal",
    summary: "Route executable workflow gaps before mission display.",
    parentId: null,
    rootId: "dove-global-init",
    level: 0,
    creatorKind: "user",
    stage: "plan",
    domain: "engineering",
    status: "ready",
    lifecycleStatus: "ready",
    dependencies: [],
    blockedBy: [],
    nextAction: "project:dove.status"
  });
  writeTaskPacket(root, {
    id: "aa-missing-contract",
    title: "Missing contract task",
    summary: "Planner must produce an executable contract before Builder can run.",
    parentId: "dove-global-init",
    rootId: "dove-global-init",
    level: 3,
    creatorKind: "user",
    stage: "execute",
    domain: "engineering",
    status: "ready",
    lifecycleStatus: "ready",
    dependencies: [],
    blockedBy: [],
    nextAction: "project:dove.auto"
  });
  writeTaskPacket(root, {
    id: "bb-missing-material",
    title: "Missing materials task",
    summary: "The contract requires source material before execution.",
    parentId: "dove-global-init",
    rootId: "dove-global-init",
    level: 3,
    creatorKind: "user",
    stage: "execute",
    domain: "engineering",
    status: "ready",
    lifecycleStatus: "ready",
    dependencies: [],
    blockedBy: [],
    executionContract: statusExecutionContract({
      materials: { requiredInputs: ["sources/cvpr-template.md"] },
      convergence: { criteria: ["Missing materials criterion"] }
    }),
    nextAction: "project:dove.auto"
  });
  writeTaskPacket(root, {
    id: "cc-verification-gap",
    title: "Verification gap task",
    summary: "Evidence exists but verifiedCriteria does not cover convergence.",
    parentId: "dove-global-init",
    rootId: "dove-global-init",
    level: 3,
    creatorKind: "user",
    stage: "execute",
    domain: "engineering",
    status: "ready",
    lifecycleStatus: "ready",
    dependencies: [],
    blockedBy: [],
    executionContract: statusExecutionContract({
      convergence: { criteria: ["Verification gap criterion"], evidenceRequired: [STATUS_VERIFICATION_PATH] }
    }),
    artifactRefs: ["drafts/status-gap.md"],
    verificationEvidencePaths: [STATUS_VERIFICATION_PATH],
    verifiedCriteria: [{ criterion: "Unrelated criterion", status: "verified", evidencePaths: [STATUS_VERIFICATION_PATH] }],
    nextAction: "project:dove.auto"
  });

  const result = queryDoveStatus(root, { domain: "engineering" });
  const fullResult = queryDoveStatus(root, { domain: "engineering", detail: "full" });

  assert.equal(result.projectSummary.returnStatus, "blocked");
  assert.equal(result.statusHome.blockersAndReconciliation.status, "blocked");
  assert.deepEqual(result.statusHome.projectState.executionGaps, {
    missingContract: 1,
    missingMaterials: 1,
    verificationGaps: 1,
    readyBuilder: 0,
    blocking: 3
  });
  assert.deepEqual(fullResult.dailyHome.executionGaps.missingContractTaskIds, ["aa-missing-contract"]);
  assert.deepEqual(fullResult.dailyHome.executionGaps.missingMaterialTaskIds, ["bb-missing-material"]);
  assert.deepEqual(fullResult.dailyHome.executionGaps.verificationGapTaskIds, ["cc-verification-gap"]);
  assert.deepEqual(result.statusHome.nextSteps.ranked.map((card) => card.kind), [
    "missing-executable-contract",
    "missing-required-materials",
    "verification-failed"
  ]);
  assert.deepEqual(result.statusHome.nextSteps.ranked.map((card) => card.packetId), [
    "aa-missing-contract",
    "bb-missing-material",
    "cc-verification-gap"
  ]);
  assert.equal(result.statusHome.nextSteps.ranked[0].command, "project:dove.mission");
  assert.equal(result.statusHome.nextSteps.ranked[0].nextRole, "planner");
  assert.deepEqual(result.statusHome.nextSteps.ranked[0].evidenceRequired, ["executionContract"]);
  assert.equal(result.statusHome.nextSteps.ranked[1].nextRole, "planner");
  assert.deepEqual(result.statusHome.nextSteps.ranked[1].requiredMaterials, ["sources/cvpr-template.md"]);
  assert.equal(result.statusHome.nextSteps.ranked[2].nextRole, "reviewer");
  assert.deepEqual(result.statusHome.nextSteps.ranked[2].criteriaCoverage.missing, ["Verification gap criterion"]);
  assert.equal(result.statusHome.optionalMissionDetails.defaultCollapsed, true);
  assert.equal(result.statusHome.optionalMissionDetails.missionItemsIncluded, false);
  assert.equal(result.statusHome.preActionGuidance.mode, "read-only-guidance");
  assert.equal(result.statusHome.preActionGuidance.workflowFrame.executionGuidance.nextRole, "planner");
  assert.deepEqual(result.statusHome.preActionGuidance.workflowFrame.executionGuidance.missingContractTaskIds, ["aa-missing-contract"]);
  assert.deepEqual(result.statusHome.preActionGuidance.workflowFrame.executionGuidance.missingMaterialTaskIds, ["bb-missing-material"]);
  assert.deepEqual(result.statusHome.preActionGuidance.workflowFrame.executionGuidance.verificationGapTaskIds, ["cc-verification-gap"]);
  assert.equal(result.statusHome.preActionGuidance.lessonRecall.readOnly, true);
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
  assert.equal(result.mission.nextCommand, "project:dove.mission or project:dove.auto");
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
  const engineeringDesign = queryDoveMission(root, { domain: "engineering", stage: "design" });
  assert.equal(engineeringDesign.mission.nextCommand, "project:dove.mission");
  const engineeringAudit = queryDoveMission(root, { domain: "engineering", stage: "audit" });
  assert.equal(engineeringAudit.mission.nextCommand, "project:dove.review");
  const generalDesign = queryDoveMission(root, { domain: "general", stage: "design" });
  assert.equal(generalDesign.mission.nextCommand, "project:dove.mission");
  const generalAudit = queryDoveMission(root, { domain: "general", stage: "audit" });
  assert.equal(generalAudit.mission.nextCommand, "project:dove.review");
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
  assert.equal(result.route.recommendedCommand, "project:dove.mission");
  assert.equal(result.route.nextCommand, "project:dove.mission");
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

test("createDoveTask routes venue source research ahead of reviewer audit", () => {
  const root = tempRoot();
  ensureWorkspace(root);

  const sourceResearch = createDoveTask(root, {
    id: "venue-source-research",
    title: "调研计算机 venue 模板与审稿偏好",
    goal: "调查 CVPR author kit, reviewer guidelines, 文献, 模板, 写作风格和审稿偏好，并沉淀来源。",
    checklist: false
  });

  assert.equal(sourceResearch.status, "needs-confirmation");
  assert.equal(sourceResearch.proposedTask.nextAction, "project:dove.source");
  assert.equal(sourceResearch.recommendedNextCommand, "project:dove.source");
  assert.equal(sourceResearch.classification.workflowCommand, "dove.source");
  assert.equal(sourceResearch.classification.stage, "execute");
  assert.equal(sourceResearch.classification.domain, "paper");

  const trueAudit = createDoveTask(root, {
    id: "draft-review-audit",
    title: "审查这份草稿",
    goal: "Review and audit this draft, verify evidence integrity, and report reviewer findings.",
    checklist: false
  });

  assert.equal(trueAudit.status, "needs-confirmation");
  assert.equal(trueAudit.proposedTask.nextAction, "project:dove.review");
  assert.equal(trueAudit.recommendedNextCommand, "project:dove.review");
  assert.equal(trueAudit.classification.workflowCommand, "dove.review");
  assert.equal(trueAudit.classification.stage, "audit");
});

test("runDoveAuto treats project continuation routes as host triage, not concrete steps", () => {
  const statusRoot = tempRoot();
  ensureWorkspace(statusRoot);
  writeTaskPacket(statusRoot, {
    id: "status-continuation",
    title: "Status continuation",
    summary: "Needs command-center triage before work continues.",
    status: "ready",
    lifecycleStatus: "active",
    stage: "execute",
    domain: "paper",
    level: 1,
    creatorKind: "operator",
    nextAction: "project:dove.status"
  });

  const statusAuto = runDoveAuto(statusRoot, { packetId: "status-continuation" });
  assert.equal(statusAuto.status, "needs-confirmation");
  assert.deepEqual(statusAuto.proposedSteps, []);
  assert.equal(statusAuto.safeToRun, false);
  assert.equal(statusAuto.requiresHostPass, true);
  assert.equal(statusAuto.whyThisStep, "project-continuation-requires-status-triage:dove.status");

  const autoRoot = tempRoot();
  ensureWorkspace(autoRoot);
  writeTaskPacket(autoRoot, {
    id: "auto-continuation",
    title: "Auto continuation",
    summary: "Needs ordinary-prompt status triage before selecting concrete work.",
    status: "ready",
    lifecycleStatus: "active",
    stage: "execute",
    domain: "paper",
    level: 1,
    creatorKind: "operator",
    nextAction: "project:dove.auto"
  });

  const autoContinuation = runDoveAuto(autoRoot, { packetId: "auto-continuation" });
  assert.equal(autoContinuation.status, "needs-confirmation");
  assert.deepEqual(autoContinuation.proposedSteps, []);
  assert.equal(autoContinuation.safeToRun, false);
  assert.equal(autoContinuation.requiresHostPass, true);
  assert.equal(autoContinuation.whyThisStep, "project-continuation-requires-status-triage:dove.auto");
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
  assert.equal(result.nextCommand, "project:dove.status");
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
  assert.equal(result.lessonRitual.command, "project:dove.lessons");
  assert.equal(result.lessonRitual.optional, true);
  assert.deepEqual(result.lessonRitual.requiredFields, ["title", "problem", "decisions", "pitfalls", "validation", "nextTime"]);
  assert.equal(result.lessonRitual.noAutoCapture, true);
  assert.equal(result.lessonRitual.noAutoApply, true);
  assert.equal(result.lessonRitual.noExecution, true);
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
  assert.equal(result.nextCommand, "project:dove.status");
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

test("CLI Dove orchestrate, mission, status, audit, and return commands expose proposal-only JSON", () => {
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
  assert.equal(orchestratePayload.route.recommendedCommand, "project:dove.mission");

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

  const status = spawnSync("node", [
    CLI,
    "status",
    root,
    "--domain", "engineering",
    "--json"
  ], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.mode, "dove-status-query");
  assert.equal(statusPayload.detail, "compact");
  assert.equal(statusPayload.proposalOnly, true);
  assert.deepEqual(statusPayload.writes, []);
  assert.equal(statusPayload.board.domain, "engineering");
  assert.equal(statusPayload.dashboard, undefined);
  assert.equal(statusPayload.statusHome.presentation, "dove-project-situation-home");
  assert.equal(statusPayload.navigation, undefined);
  assert.equal(statusPayload.diagnostics.omittedSections.includes("dashboard"), true);
  assert.equal(statusPayload.diagnostics.mayRefreshDerivedSurfaces, false);

  const removedBoard = spawnSync("node", [CLI, "board", root], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.notEqual(removedBoard.status, 0);

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
