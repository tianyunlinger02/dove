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
  queryDoveStatus,
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

function writeTaskPacket(root, packet) {
  const packetPath = packet.packetPath ?? path.join(ARTIFACT_PATHS.taskPacketsPacketsDir, `${packet.id}.json`);
  const packetContextPath = packet.packetContextPath ?? path.join(ARTIFACT_PATHS.packetContextsDir, `${packet.id}.json`);
  for (const relativePath of [packetPath, packetContextPath]) {
    fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
  }
  writeJson(root, packetPath, { ...packet, packetPath, packetContextPath });
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
  return { packetPath, packetContextPath };
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
  const after = snapshotArtifacts(root, statusWatchedArtifacts);

  assert.equal(result.mode, "dove-status-query");
  assert.equal(result.query, true);
  assert.equal(result.proposalOnly, true);
  assert.equal(result.noAutoApply, true);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(after, before);
  assert.equal(result.current.domain, "engineering");
  assert.equal(result.current.stage, "execute");
  assert.equal(result.current.primaryRole, "builder");
  assert.equal(result.current.nextCommand, "project:dove.status");
  assert.equal(result.board.domain, "engineering");
  assert.equal(result.dashboard.init.id, "dove-global-init");
  assert.deepEqual(result.dashboard.tasks.activeTaskIds, ["blocked-dependency", "plain-pending", "runtime-completed", "runtime-progress", "status-packet"]);
  assert.equal(result.dashboard.tasks.counts.byStatus.ready, 4);
  assert.equal(result.dashboard.tasks.tree[0].children.some((task) => task.id === "status-packet"), true);
  assert.equal(result.dashboard.runtime.continuation.currentPacketId, "runtime-progress");
  assert.equal(result.dashboard.runtime.results.lastRunId, "runtime-completed-run");
  assert.equal(result.dashboard.runtime.events.lastEventType, "task.boundary.opened");

  const statusTask = result.dashboard.tasks.active.find((task) => task.id === "status-packet");
  assert.ok(statusTask);
  assert.deepEqual(statusTask.evidenceExpectations, ["full packet evidence", "runtime summary"]);
  assert.equal(statusTask.outputPaths.includes("src/core/dove.mjs"), true);
  assert.equal(statusTask.evidenceLinks.includes("tests/integration/dove-query.test.mjs"), true);
  assert.equal(statusTask.artifactRefs.includes("docs/USAGE.md"), true);
  assert.equal(statusTask.artifactRefs.includes("src/core/dove.mjs"), true);
  assert.equal(statusTask.packetPath, path.join(ARTIFACT_PATHS.taskPacketsPacketsDir, "status-packet.json"));
  assert.equal(statusTask.packetContextPath, path.join(ARTIFACT_PATHS.packetContextsDir, "status-packet.json"));
  assert.deepEqual(statusTask.applicableLessons.map((lesson) => lesson.id), ["global-status-lesson", "status-packet-lesson"]);

  const blockedTask = result.dashboard.tasks.active.find((task) => task.id === "blocked-dependency");
  assert.equal(blockedTask.blockedReason, "unresolved-dependencies:missing-dependency");
  assert.deepEqual(blockedTask.unresolvedDependencyIds, ["missing-dependency"]);
  assert.equal(result.dashboard.blockers.some((blocker) => blocker.taskId === "blocked-dependency" && blocker.unresolvedDependencyIds.includes("missing-dependency")), true);

  const runtimeTask = result.dashboard.tasks.active.find((task) => task.id === "runtime-progress");
  assert.equal(runtimeTask.lastRun.id, "runtime-progress-run");
  assert.equal(runtimeTask.lastEvent.type, "task.boundary.opened");
  assert.equal(runtimeTask.currentBoundary.type, "awaiting-host-pass");
  assert.equal(runtimeTask.actionableBoundary.type, "awaiting-host-pass");
  assert.equal(runtimeTask.lastStopReason, "Need host-visible implementation evidence.");
  assert.equal(runtimeTask.continuationState.command, "project:dove.auto");
  assert.equal(result.actionableBoundaries.some((boundary) => boundary.packetId === "runtime-progress" && boundary.type === "awaiting-host-pass"), true);
  assert.equal(result.dashboard.tasks.actionableBoundaries.some((boundary) => boundary.packetId === "runtime-progress"), true);

  const statusAdjustmentItems = Object.fromEntries(result.statusAdjustmentContract.items.map((item) => [item.packetId, item]));
  assert.deepEqual(result.statusAdjustmentContract.statusChoices, ["pending", "ready", "in-progress", "blocked", "completed", "killed"]);
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
  assert.equal(statusAdjustmentItems["runtime-progress"].lastEvent.type, "task.boundary.opened");
  assert.equal(statusAdjustmentItems["runtime-completed"].recommendedStatus, "completed");
  assert.equal(statusAdjustmentItems["runtime-completed"].lastStopReason, "completion-confirmed-by-mission-pass");
  assert.equal(result.dashboard.returnReadiness.status, "blocked");
  assert.equal("taskGraph" in result, false);
  assert.equal("paperLifecycle" in result, false);
  assert.equal("openQuestions" in result, false);
  assert.equal("decisions" in result, false);
  assert.equal("lineage" in result, false);
  assert.equal(result.diagnostics.derivedReports.navigationReportPath, ARTIFACT_PATHS.navigationReport);
  assert.equal(result.diagnostics.primaryStateSources.includes(ARTIFACT_PATHS.taskPacketsPacketsDir), true);
  assert.equal(result.diagnostics.primaryStateSources.includes(ARTIFACT_PATHS.runtimeContinuation), true);
  assert.equal(result.diagnostics.primaryStateSources.includes(ARTIFACT_PATHS.runtimeEvents), true);
  assert.equal(result.diagnostics.primaryStateSources.includes(ARTIFACT_PATHS.runtimeResults), true);
  assert.equal(result.diagnostics.mayRefreshDerivedSurfaces, false);
  assert.equal(result.diagnostics.noCommandExecution, true);
  assert.equal(result.diagnostics.noExternalProcess, true);
  assert.equal(result.diagnostics.noGitInspection, true);
  assert.equal(result.diagnostics.noSourceMutation, true);
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
    "--domain", "engineering"
  ], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.mode, "dove-status-query");
  assert.equal(statusPayload.proposalOnly, true);
  assert.deepEqual(statusPayload.writes, []);
  assert.equal(statusPayload.board.domain, "engineering");
  assert.ok(statusPayload.dashboard.tasks.counts.total >= 0);
  assert.equal(statusPayload.navigation, undefined);
  assert.equal(statusPayload.diagnostics.derivedReports.wikiPath, ARTIFACT_PATHS.wiki);
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
