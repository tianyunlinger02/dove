import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  assertResolvedTaskPacket,
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
  runDoveAuto,
  runDoveReviewLoop
} from "../../src/core/internal-api.mjs";
import { upsertSystemOrchestrationBoard } from "../../src/core/orchestration.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";
import { assertNoCompactPublicLeaks } from "../helpers/compact-public.mjs";
import { ensureTestWorkspace, runFixtureMutation } from "../helpers/mutation-fixture.mjs";
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
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, value, "utf8");
}

function listRelativeFiles(root) {
  const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(fullPath) : [path.relative(root, fullPath)];
    });
  return fs.existsSync(root) ? walk(root).sort() : [];
}

function snapshotRelativeFileContents(root) {
  return Object.fromEntries(listRelativeFiles(root).map((relativePath) => [
    relativePath,
    fs.readFileSync(path.join(root, relativePath)).toString("base64")
  ]));
}

function decodeMissionProposalTokenForTest(token) {
  return JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
}

function encodeMissionProposalTokenForTest(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function withoutProposalTimestamps(value) {
  if (Array.isArray(value)) {
    return value.map(withoutProposalTimestamps);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !["createdAt", "updatedAt", "completedAt"].includes(key))
      .map(([key, item]) => [key, withoutProposalTimestamps(item)]));
  }
  return value;
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

function assertPublicCompactStatus(result) {
  assert.equal(result.detail, "compact");
  assert.equal(result.detailsAvailable, true);
  assert.equal(result.statusHome.presentation, "dove-project-situation-home");
  assert.equal(result.statusHome.detail, "compact");
  assert.equal(result.statusHome.liveContextFirst, true);
  assert.equal(result.statusHome.detailsAvailable, true);
  assert.ok(result.statusHome.headline);
  assert.ok(result.statusHome.scope && typeof result.statusHome.scope === "object");
  assert.equal(result.statusHome.scope.kind, "workspace");
  assert.ok(result.statusHome.currentContext && typeof result.statusHome.currentContext === "object");
  assert.ok(result.statusHome.nextStep && typeof result.statusHome.nextStep === "object");
  assert.ok(result.statusHome.needsAttention && typeof result.statusHome.needsAttention === "object");
  assert.deepEqual(result.statusHome.changes, {
    intent: "none",
    applied: false,
    count: 0,
    rollback: "not-applicable"
  });
  assert.deepEqual(result.changes, result.statusHome.changes);
  assert.ok(result.statusHome.showMore?.text);
  assert.doesNotMatch(result.statusHome.showMore.text, /--missions|--full|--json/);
  assert.equal(result.statusHome.showMore.detailsAvailable, true);
  assert.equal("fullDetails" in result.statusHome.showMore, false);
  assert.equal("missionDetails" in result.statusHome.showMore, false);
  assert.equal("statusAdjustments" in result.statusHome.showMore, false);
  assert.equal(result.showMore.noWriteSummary, result.statusHome.showMore.noWriteSummary);
  assertNoCompactPublicLeaks(result);

  for (const key of [
    "boundary",
    "boundaryType",
    "operatorRoute",
    "operatorUnblock",
    "gaps",
    "executionGaps",
    "requiredEvidence",
    "projectBacklogRequiredEvidence",
    "projectBacklogNextAction",
    "nextAction",
    "nextSteps",
    "writes",
    "writeIntent",
    "rollbackEligible",
    "fullDetails",
    "expansion",
    "durableRoot",
    "stateSource",
    "runtimeContinuation",
    "contractHealth"
  ]) {
    assert.equal(key in result.statusHome, false, `compact statusHome leaked ${key}`);
  }
  for (const key of [
    "boundary",
    "boundaryType",
    "operatorRoute",
    "operatorUnblock",
    "gaps",
    "executionGaps",
    "requiredEvidence",
    "nextAction",
    "writes",
    "writeIntent",
    "rollbackEligible",
    "current",
    "suggestedNextCommand",
    "fullDetails",
    "expansion"
  ]) {
    assert.equal(key in result, false, `compact status result leaked ${key}`);
  }
  for (const key of ["durableRoot", "stateSource", "hostCheckpointDetected", "hostCheckpointStatus", "externalWriteCaptureVerified"]) {
    assert.equal(key in result.statusHome.currentContext, false, `compact currentContext leaked ${key}`);
  }
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

function seedReviewLoopPacket(root, {
  id,
  title,
  assignedRole = "builder",
  stage = "execute",
  boardPhase = "draft",
  boardRole = "builder"
}) {
  ensureTestWorkspace(root);
  runFixtureMutation(root, "seed-review-loop-board", () => upsertSystemOrchestrationBoard(root, {
    phase: boardPhase,
    assignedRole: boardRole,
    currentFocus: "Prepare the current work for review.",
    nextAction: "Hand the current work to the reviewer."
  }));
  const timestamp = new Date(0).toISOString();
  const draftPath = `${ARTIFACT_PATHS.draftsDir}/${id}.md`;
  const packet = {
    id,
    title,
    summary: "Exercise the ordinary direct-process review-loop transition.",
    status: "ready",
    lifecycleStatus: "active",
    active: true,
    assignedRole,
    level: 1,
    creatorKind: "operator",
    domain: "paper",
    stage,
    artifactRefs: [draftPath],
    updatedAt: timestamp
  };
  writeTaskPacket(root, packet);
  writeText(root, draftPath, `# ${title}\n\nThis packet-owned draft contains substantive material for independent review.\n`);
  writeText(root, ARTIFACT_PATHS.claims, "# Claims\n\nNo claims recorded.\n");
  writeText(root, ARTIFACT_PATHS.experimentLog, "# Experiment log\n\nNo experiments recorded.\n");
  writeJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: timestamp });
  return packet;
}

test("figure CLI returns non-zero for an operational missing-materials boundary", () => {
  const root = tempRoot();
  try {
    ensureTestWorkspace(root);
    writeTaskPacket(root, {
      id: "cli-figure-blocked",
      title: "CLI figure blocked boundary",
      summary: "Require real figure materials before planning.",
      status: "ready",
      lifecycleStatus: "active",
      active: true,
      assignedRole: "builder",
      level: 1,
      creatorKind: "operator",
      domain: "paper",
      stage: "execute",
      updatedAt: new Date(0).toISOString()
    });

    const blocked = spawnSync("node", [
      CLI,
      "figure",
      root,
      "--packet-id",
      "cli-figure-blocked",
      "--intent",
      "Draw a figure without any claim, experiment, caption, visual, or source material.",
      "--mutation-mode",
      "direct-process",
      "--json"
    ], { cwd: ROOT, encoding: "utf8" });

    assert.notEqual(blocked.status, 0, blocked.stderr || blocked.stdout);
    const result = JSON.parse(blocked.stdout);
    assert.equal(result.status, "blocked-missing-materials");
    assert.equal(result.writesApplied, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("task target resolver prefers full Unicode task titles over short ASCII fragments", () => {
  const root = tempRoot();
  try {
    ensureTestWorkspace(root);
    const timestamp = new Date(0).toISOString();
    writeTaskPacket(root, {
      id: "venue-main",
      title: "调研计算机高水平 venue 模板与写作偏好",
      summary: "Main venue writing preference task.",
      status: "in-progress",
      lifecycleStatus: "active",
      active: true,
      assignedRole: "builder",
      level: 3,
      creatorKind: "operator",
      domain: "paper",
      stage: "execute",
      updatedAt: timestamp
    });
    writeTaskPacket(root, {
      id: "venue-fields",
      title: "设计信息表字段：venue、方向、官网/模板、格式要求、代表论文、写作风格、审稿关注点。",
      summary: "A related checklist item that shares the ASCII word venue.",
      status: "pending",
      lifecycleStatus: "ready",
      active: true,
      assignedRole: "builder",
      level: 4,
      creatorKind: "operator",
      domain: "paper",
      stage: "execute",
      updatedAt: timestamp
    });

    const resolved = assertResolvedTaskPacket(root, {
      target: "调研计算机高水平 venue 模板与写作偏好"
    }, {
      targetFields: ["target"],
      mutationScope: "task-scoped-write"
    });

    assert.equal(resolved.packetId, "venue-main");
    assert.equal(resolved.packet.title, "调研计算机高水平 venue 模板与写作偏好");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI figure defaults to a governed patch-plan without writing figure records", () => {
  const root = tempRoot();
  try {
    ensureTestWorkspace(root);
    const timestamp = new Date(0).toISOString();
    writeTaskPacket(root, {
      id: "figure-cli-packet",
      title: "Figure CLI packet",
      summary: "Packet for figure CLI regression coverage.",
      status: "pending",
      lifecycleStatus: "active",
      active: true,
      assignedRole: "builder",
      level: 1,
      creatorKind: "operator",
      domain: "paper",
      stage: "execute",
      updatedAt: timestamp
    });
    const figuresIndexPath = path.join(root, ARTIFACT_PATHS.figuresIndex);
    const beforeFigures = fs.readFileSync(figuresIndexPath, "utf8");
    const args = [
      CLI,
      "figure",
      root,
      "--packet-id",
      "figure-cli-packet",
      "--figure-id",
      "cli-figure",
      "--intent",
      "Draw the research question to evidence, experiment, writing, and review loop.",
      "--required-visual-element",
      "research question node",
      "--material-hint",
      "The method section describes the evidence and review loop.",
      "--allow-missing-materials"
    ];

    const human = spawnSync("node", args, { cwd: ROOT, encoding: "utf8" });
    assert.equal(human.status, 1, human.stderr || human.stdout);
    assert.match(human.stdout, /SVG|待确认方案/);
    assert.doesNotMatch(human.stdout, /\.dove\//);
    assert.doesNotMatch(human.stdout, /sourceSvgPath|finalSvgPath|outputManifestPath|qaPath|mutationPlan|packetId|providerId|mutationMode|patch-plan/u);
    assert.equal(fs.readFileSync(figuresIndexPath, "utf8"), beforeFigures);
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "cli-figure.template.svg")), false);

    const machine = spawnSync("node", [...args, "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024
    });
    assert.equal(machine.status, 1, machine.stderr || machine.stdout);
    const parsed = JSON.parse(machine.stdout);
    assert.equal(parsed.mutationMode, "patch-plan");
    assert.equal(parsed.writesApplied, false);
    assert.ok(parsed.mutationPlan.operations.length > 0);
    assert.equal(parsed.resultCard.presentation, "compact-result-summary-card");
    assert.match(parsed.resultCard.durableWrites[0], /没有声明新的持久写入|no new durable writes/i);
    assert.doesNotMatch(parsed.resultCard.durableWrites[0], /已更新图表计划|Updated the figure plan/i);
    assertNoCompactPublicLeaks(parsed.resultCard, { ignoredKeys: ["command"] });
    assert.equal("finalSvgPath" in parsed.resultCard, false);
    assert.equal("qaPath" in parsed.resultCard, false);
    assert.equal(fs.readFileSync(figuresIndexPath, "utf8"), beforeFigures);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI mission proposes without writes and materializes the approved contract", () => {
  const root = tempRoot();

  const human = spawnSync("node", [CLI, "mission", root, "--goal", "Turn review feedback into an executable task"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Dove/);
  assert.match(human.stdout, /待确认任务|task proposal/u);
  assert.doesNotMatch(human.stdout, /^\{/);
  assert.doesNotMatch(human.stdout, /\.dove\/|project:dove\.|packetId|taskPacketId|missionPacketId|boundaryType|workContract|executionContract|preActionGuidance|proposalOnly|noAutoApply|targetArtifacts|domainGuidance/u);
  assert.equal(fs.existsSync(path.join(root, ".dove")), false);

  const machine = spawnSync("node", [CLI, "mission", root, "--goal", "Turn review feedback into an executable task", "--json"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(machine.status, 0, machine.stderr || machine.stdout);
  const parsed = JSON.parse(machine.stdout);
  assert.equal(parsed.status, "needs-confirmation");
  assert.equal(parsed.proposalOnly, true);
  assert.equal(parsed.writes.length, 0);
  assert.equal(fs.existsSync(path.join(root, ".dove")), false);

  assert.match(parsed.proposalDigest, /^[0-9a-f]{64}$/u);
  assert.equal(parsed.proposalMutationMode, "direct-process");
  assert.equal(typeof parsed.proposalToken, "string");
  assert.match(parsed.exactConfirmationCommand, /--proposal-token/u);

  const bareConfirmed = spawnSync("node", [CLI, "mission", root, "--goal", "Turn review feedback into an executable task", "--confirmed", "--json"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(bareConfirmed.status, 1);
  assert.match(bareConfirmed.stdout, /exact proposalDigest|精确/u);
  assert.equal(fs.existsSync(path.join(root, ".dove")), false);

  const confirmed = spawnSync("node", [CLI, "mission", root, "--proposal-token", parsed.proposalToken, "--confirmed", "--mutation-mode", "direct-process", "--json"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(confirmed.status, 0, confirmed.stderr || confirmed.stdout);
  const materialized = JSON.parse(confirmed.stdout);
  assert.equal(materialized.status, "materialized");
  assert.equal(materialized.executionMode, "contract-handoff");
  assert.equal(materialized.writesApplied, true);
  assert.equal(materialized.createdTask.id, parsed.proposedTask.id);
  assert.deepEqual(materialized.createdTask.workContract, parsed.workContract);
  assert.deepEqual(materialized.createdTask.executionContract, parsed.executionContract);
  assert.deepEqual(materialized.createdChecklistTasks.map((item) => item.id), parsed.checklistProposal.items.map((item) => item.id));
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.taskPacketsIndex)), true);

  const reusedElsewhere = tempRoot();
  try {
    const crossWorkspace = spawnSync("node", [CLI, "mission", reusedElsewhere, "--proposal-token", parsed.proposalToken, "--confirmed", "--mutation-mode", "direct-process", "--json"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(crossWorkspace.status, 1);
    assert.equal(fs.existsSync(path.join(reusedElsewhere, ".dove")), false);
  } finally {
    fs.rmSync(reusedElsewhere, { recursive: true, force: true });
  }

  const plannedRoot = tempRoot();
  try {
    const planProposalProcess = spawnSync("node", [CLI, "mission", plannedRoot, "--goal", "Plan a contract without applying it", "--mutation-mode", "patch-plan", "--json"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(planProposalProcess.status, 0, planProposalProcess.stderr || planProposalProcess.stdout);
    const planProposal = JSON.parse(planProposalProcess.stdout);
    assert.equal(planProposal.proposalMutationMode, "patch-plan");
    assert.equal(fs.existsSync(path.join(plannedRoot, ".dove")), false);

    const modeDrift = spawnSync("node", [CLI, "mission", plannedRoot, "--proposal-token", planProposal.proposalToken, "--confirmed", "--mutation-mode", "direct-process", "--json"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(modeDrift.status, 1);
    assert.equal(fs.existsSync(path.join(plannedRoot, ".dove")), false);

    const planned = spawnSync("node", [CLI, "mission", plannedRoot, "--proposal-token", planProposal.proposalToken, "--confirmed", "--mutation-mode", "patch-plan", "--json"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(planned.status, 0, planned.stderr || planned.stdout);
    const plannedResult = JSON.parse(planned.stdout);
    assert.equal(plannedResult.status, "materialization-planned");
    assert.equal(plannedResult.contractMaterialized, false);
    assert.equal(plannedResult.writesApplied, false);
    assert.ok(plannedResult.mutationPlan.operations.length > 0);
    assert.equal(fs.existsSync(path.join(plannedRoot, ".dove")), false);

    const missingMode = spawnSync("node", [CLI, "mission", plannedRoot, "--proposal-token", planProposal.proposalToken, "--confirmed", "--json"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(missingMode.status, 1, missingMode.stderr || missingMode.stdout);
    assert.match(missingMode.stdout, /different mutation mode|no longer matches|写入模式|不再匹配/u);
    assert.equal(fs.existsSync(path.join(plannedRoot, ".dove")), false);
  } finally {
    fs.rmSync(plannedRoot, { recursive: true, force: true });
  }
});

test("CLI work commands reject retired governance flags before workspace writes", () => {
  const cases = [
    ["auto", "--skip-board-update"],
    ["review", "--skip-refresh"],
    ["review-loop", "--skip-refresh-durable-surfaces"],
    ["auto", "--skip-follow-through-ready"],
    ["review", "--skip-sync-phase"],
    ["review-loop", "--policy-override-reason=legacy"]
  ];

  for (const [command, retiredFlag] of cases) {
    const root = tempRoot();
    try {
      const rejected = spawnSync(
        "node",
        [CLI, command, root, retiredFlag, "--json"],
        { cwd: ROOT, encoding: "utf8" }
      );
      assert.equal(rejected.status, 1, rejected.stderr || rejected.stdout);
      assert.match(
        `${rejected.stdout}\n${rejected.stderr}`,
        /Dove CLI no longer accepts retired governance flags/u
      );
      assert.equal(fs.existsSync(path.join(root, ".dove")), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("CLI mission rejects malformed proposal tokens without writing", () => {
  const root = tempRoot();
  try {
    const malformedTokens = [
      "",
      "not.a.base64url.token",
      Buffer.from("{", "utf8").toString("base64url"),
      encodeMissionProposalTokenForTest({ version: 2, mutationMode: "direct-process", confirmArgs: {} }),
      encodeMissionProposalTokenForTest({ version: 1, mutationMode: "direct-process", confirmArgs: [] })
    ];

    for (const proposalToken of malformedTokens) {
      const before = snapshotRelativeFileContents(root);
      const rejected = spawnSync("node", [CLI, "mission", root, "--proposal-token", proposalToken, "--confirmed", "--json"], {
        cwd: ROOT,
        encoding: "utf8"
      });
      assert.equal(rejected.status, 1, rejected.stderr || rejected.stdout);
      assert.deepEqual(snapshotRelativeFileContents(root), before);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI mission rejects duplicate proposal safety flags without writing", () => {
  const root = tempRoot();
  try {
    const proposalProcess = spawnSync("node", [CLI, "mission", root, "--id", "duplicate-flag-task", "--goal", "Reject ambiguous confirmation flags.", "--json"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(proposalProcess.status, 0, proposalProcess.stderr || proposalProcess.stdout);
    const proposal = JSON.parse(proposalProcess.stdout);
    const before = snapshotRelativeFileContents(root);

    for (const duplicateArgs of [
      ["--proposal-token", proposal.proposalToken, "--proposal-token", proposal.proposalToken, "--confirmed"],
      ["--proposal-token", proposal.proposalToken, "--confirmed", "--mutation-mode", "direct-process", "--mutation-mode", "direct-process"]
    ]) {
      const rejected = spawnSync("node", [CLI, "mission", root, ...duplicateArgs, "--json"], {
        cwd: ROOT,
        encoding: "utf8"
      });
      assert.equal(rejected.status, 1, rejected.stderr || rejected.stdout);
      assert.match(rejected.stdout, /may be provided only once/u);
      assert.deepEqual(snapshotRelativeFileContents(root), before);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI mission rejects tampered and semantically altered proposal token replays without writing", () => {
  const root = tempRoot();
  try {
    const proposalProcess = spawnSync("node", [CLI, "mission", root, "--id", "exact-token-task", "--goal", "Preserve the approved mission contract exactly.", "--json"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(proposalProcess.status, 0, proposalProcess.stderr || proposalProcess.stdout);
    const proposal = JSON.parse(proposalProcess.stdout);
    const tokenPayload = decodeMissionProposalTokenForTest(proposal.proposalToken);
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);

    const alterations = [
      (payload) => {
        payload.confirmArgs.proposalDigest = "0".repeat(64);
      },
      (payload) => {
        payload.confirmArgs.title = "Semantically altered mission title";
      },
      (payload) => {
        payload.confirmArgs.goal = "Semantically altered redundant mission goal";
      },
      (payload) => {
        payload.confirmArgs.boundary = { createdAt: "2040-01-01T00:00:00.000Z" };
      },
      (payload) => {
        payload.confirmArgs.workContract.purpose = "Semantically altered work contract purpose.";
      },
      (payload) => {
        payload.confirmArgs.executionContract.convergence.definitionOfDone = "Semantically altered definition of done.";
      }
    ];

    for (const alter of alterations) {
      const alteredPayload = structuredClone(tokenPayload);
      alter(alteredPayload);
      const before = snapshotRelativeFileContents(root);
      const rejected = spawnSync("node", [
        CLI,
        "mission",
        root,
        "--proposal-token",
        encodeMissionProposalTokenForTest(alteredPayload),
        "--confirmed",
        "--json"
      ], {
        cwd: ROOT,
        encoding: "utf8"
      });
      assert.equal(rejected.status, 1, rejected.stderr || rejected.stdout);
      assert.match(rejected.stdout, /no longer matches|不再匹配/u);
      assert.deepEqual(snapshotRelativeFileContents(root), before);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("mission replay preserves explicit false and empty checklist decisions", () => {
  const root = tempRoot();
  try {
    for (const [suffix, checklistArgs] of [
      ["false", { checklist: false }],
      ["empty", { checklistItems: [] }]
    ]) {
      const request = {
        id: `explicit-checklist-${suffix}`,
        goal: "Implement and validate a multi-step workflow with documentation.",
        ...checklistArgs
      };
      const proposal = createDoveTask(root, request);
      assert.equal(proposal.checklistProposal.itemCount, 0);
      assert.equal(proposal.confirmArgs.checklist, false);
      assert.equal(proposal.confirmArgs.autoChecklist, false);
      assert.deepEqual(proposal.confirmArgs.checklistItems, []);
      const materialized = runWithMutationContext(root, {
        actionId: "create-dove-task",
        mutationMode: proposal.confirmArgs.mutationMode,
        hostId: "test"
      }, () => createDoveTask(root, proposal.confirmArgs));
      assert.equal(materialized.createdChecklistTasks.length, 0);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("mission proposal canonical workspace rejects symlink retarget before writes", () => {
  const container = tempRoot();
  const workspaceA = path.join(container, "workspace-a");
  const workspaceB = path.join(container, "workspace-b");
  const alias = path.join(container, "workspace-link");
  fs.mkdirSync(workspaceA);
  fs.mkdirSync(workspaceB);
  fs.symlinkSync(workspaceA, alias, "dir");
  try {
    const proposal = createDoveTask(alias, {
      id: "symlink-bound-task",
      goal: "Bind this proposal to one canonical workspace.",
      checklist: false
    });
    assert.equal(proposal.proposalWorkspace, fs.realpathSync.native(workspaceA));
    fs.unlinkSync(alias);
    fs.symlinkSync(workspaceB, alias, "dir");
    const before = snapshotRelativeFileContents(workspaceB);
    assert.throws(() => runWithMutationContext(alias, {
      actionId: "create-dove-task",
      mutationMode: proposal.confirmArgs.mutationMode,
      hostId: "test"
    }, () => createDoveTask(alias, proposal.confirmArgs)), /different canonical workspace/);
    assert.deepEqual(snapshotRelativeFileContents(workspaceB), before);
  } finally {
    fs.rmSync(container, { recursive: true, force: true });
  }
});

test("mission replay rejects target id collisions without overwriting", () => {
  const root = tempRoot();
  try {
    const proposal = createDoveTask(root, {
      id: "collision-task",
      goal: "Do not overwrite a task created after proposal time.",
      checklist: false
    });
    ensureTestWorkspace(root);
    const packetPath = path.join(root, ARTIFACT_PATHS.taskPacketsPacketsDir, "collision-task.json");
    fs.mkdirSync(path.dirname(packetPath), { recursive: true });
    fs.writeFileSync(packetPath, '{"id":"collision-task","title":"Concurrent task"}\n', "utf8");
    const before = snapshotRelativeFileContents(root);
    assert.throws(() => runWithMutationContext(root, {
      actionId: "create-dove-task",
      mutationMode: proposal.confirmArgs.mutationMode,
      hostId: "test"
    }, () => createDoveTask(root, proposal.confirmArgs)), /target task id already exists or changed/);
    assert.deepEqual(snapshotRelativeFileContents(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("mission proposal digest ignores timestamp drift without sleeping", (t) => {
  const root = tempRoot();
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-01T00:00:00.000Z") });
  try {
    const request = {
      id: "timestamp-stable-task",
      title: "Timestamp stable task",
      goal: "Keep exact mission confirmation stable across timestamp-only drift.",
      checklist: false
    };
    const first = createDoveTask(root, request);
    t.mock.timers.setTime(new Date("2036-12-31T23:59:59.000Z").getTime());
    const second = createDoveTask(root, request);

    assert.notEqual(first.proposedInit.createdAt, second.proposedInit.createdAt);
    assert.notEqual(first.proposedTask.createdAt, second.proposedTask.createdAt);
    assert.equal(first.proposalDigest, second.proposalDigest);
    assert.deepEqual(first.confirmArgs, second.confirmArgs);
    assert.deepEqual(withoutProposalTimestamps(first.proposedInit), withoutProposalTimestamps(second.proposedInit));
    assert.deepEqual(withoutProposalTimestamps(first.proposedTask), withoutProposalTimestamps(second.proposedTask));
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  } finally {
    t.mock.timers.reset();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI mission exact replay materializes its first-run init and rejects live init drift", () => {
  const exactRoot = tempRoot();
  const driftRoot = tempRoot();
  try {
    const exactProposalProcess = spawnSync("node", [CLI, "mission", exactRoot, "--id", "first-run-exact-task", "--goal", "Materialize the approved first-run init and task.", "--json"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(exactProposalProcess.status, 0, exactProposalProcess.stderr || exactProposalProcess.stdout);
    const exactProposal = JSON.parse(exactProposalProcess.stdout);
    assert.equal(exactProposal.initMaterializationRequired, true);
    assert.ok(exactProposal.proposedInit);
    assert.equal(fs.existsSync(path.join(exactRoot, ".dove")), false);

    const exactReplay = spawnSync("node", [CLI, "mission", exactRoot, "--proposal-token", exactProposal.proposalToken, "--confirmed", "--mutation-mode", "direct-process", "--json"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(exactReplay.status, 0, exactReplay.stderr || exactReplay.stdout);
    const materialized = JSON.parse(exactReplay.stdout);
    assert.equal(materialized.status, "materialized");
    assert.equal(materialized.initMaterializationRequired, true);
    assert.deepEqual(withoutProposalTimestamps(materialized.createdInit), withoutProposalTimestamps(exactProposal.proposedInit));
    assert.deepEqual(withoutProposalTimestamps(materialized.createdTask), withoutProposalTimestamps(exactProposal.proposedTask));

    const driftProposalProcess = spawnSync("node", [CLI, "mission", driftRoot, "--id", "first-run-drift-task", "--goal", "Reject replay after the live init changes.", "--json"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(driftProposalProcess.status, 0, driftProposalProcess.stderr || driftProposalProcess.stdout);
    const driftProposal = JSON.parse(driftProposalProcess.stdout);
    assert.equal(driftProposal.initMaterializationRequired, true);

    const liveInit = spawnSync("node", [CLI, "init", driftRoot, "--goal", "A different live init now owns this workspace.", "--mutation-mode", "direct-process", "--json"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(liveInit.status, 0, liveInit.stderr || liveInit.stdout);
    const beforeReplay = snapshotRelativeFileContents(driftRoot);
    const rejectedReplay = spawnSync("node", [CLI, "mission", driftRoot, "--proposal-token", driftProposal.proposalToken, "--confirmed", "--mutation-mode", "direct-process", "--json"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(rejectedReplay.status, 1, rejectedReplay.stderr || rejectedReplay.stdout);
    assert.match(rejectedReplay.stdout, /no longer matches|不再匹配/u);
    assert.deepEqual(snapshotRelativeFileContents(driftRoot), beforeReplay);
  } finally {
    fs.rmSync(exactRoot, { recursive: true, force: true });
    fs.rmSync(driftRoot, { recursive: true, force: true });
  }
});

test("CLI mission returned confirmation command safely preserves shell-sensitive target and goal text", () => {
  const runnerRoot = tempRoot();
  const targetBacktickSentinel = path.join(runnerRoot, "target-backtick-ran");
  const goalBacktickSentinel = path.join(runnerRoot, "goal-backtick-ran");
  const target = path.join(runnerRoot, "--target value with spaces ' $DOVE_TARGET_SENTINEL `touch target-backtick-ran`\nsecond target line");
  const goal = "--goal-looking value with spaces, apostrophe's, $DOVE_GOAL_SENTINEL, `touch goal-backtick-ran`\n--proposal-token\n--mutation-mode";
  try {
    fs.mkdirSync(target, { recursive: true });
    fs.symlinkSync(path.join(ROOT, "bin"), path.join(runnerRoot, "bin"), "dir");
    const proposalProcess = spawnSync("node", [CLI, "mission", target, "--id", "shell-safe-exact-task", "--goal", goal, "--json"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(proposalProcess.status, 0, proposalProcess.stderr || proposalProcess.stdout);
    const proposal = JSON.parse(proposalProcess.stdout);
    assert.equal(proposal.proposedTask.summary, goal);
    assert.equal(fs.existsSync(path.join(target, ".dove")), false);

    const confirmed = spawnSync("/bin/sh", ["-c", proposal.exactConfirmationCommand], {
      cwd: runnerRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        DOVE_TARGET_SENTINEL: "expanded-target-value",
        DOVE_GOAL_SENTINEL: "expanded-goal-value"
      }
    });
    assert.equal(confirmed.status, 0, confirmed.stderr || confirmed.stdout);
    assert.equal(fs.existsSync(targetBacktickSentinel), false);
    assert.equal(fs.existsSync(goalBacktickSentinel), false);
    assert.equal(fs.existsSync(path.join(runnerRoot, ".dove")), false);
    assert.equal(fs.existsSync(path.join(target, ".dove")), true);

    const createdTask = JSON.parse(fs.readFileSync(path.join(target, proposal.proposedTask.packetPath), "utf8"));
    assert.equal(createdTask.title, goal);
    assert.equal(createdTask.summary, goal);
    assert.equal(createdTask.currentFocus, goal);
    assert.match(createdTask.summary, /\$DOVE_GOAL_SENTINEL/u);
    assert.match(target, /\$DOVE_TARGET_SENTINEL/u);
  } finally {
    fs.rmSync(runnerRoot, { recursive: true, force: true });
  }
});

test("CLI auto emits a canonical proposal token and safely replays its exact confirmation", () => {
  const directRoot = tempRoot();
  const patchRoot = tempRoot();
  const selectionRoot = tempRoot();
  const goal = "Carry out the approved CLI auto replay task through one bounded foreground pass.";
  try {
    const directProposalProcess = spawnSync("node", [
      CLI,
      "auto",
      directRoot,
      "--goal",
      goal,
      "--max-iterations",
      "1",
      "--mutation-mode",
      "direct-process",
      "--json"
    ], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    assert.equal(directProposalProcess.status, 0, directProposalProcess.stderr || directProposalProcess.stdout);
    const directProposal = JSON.parse(directProposalProcess.stdout);
    assert.equal(directProposal.status, "needs-confirmation");
    assert.equal(directProposal.proposalOnly, true);
    assert.deepEqual(directProposal.writes, []);
    assert.equal(directProposal.proposalKind, "demand");
    assert.equal(directProposal.proposalWorkspace, fs.realpathSync.native(directRoot));
    assert.equal(directProposal.proposalMutationMode, "direct-process");
    assert.equal(typeof directProposal.proposalToken, "string");
    assert.match(directProposal.exactConfirmationCommand, new RegExp(`${path.basename(CLI).replace(/\./g, "\\.")}['\"]? auto`, "u"));
    assert.match(directProposal.exactConfirmationCommand, /--proposal-token/u);
    assert.match(directProposal.exactConfirmationCommand, /--confirmed/u);
    assert.match(directProposal.exactConfirmationCommand, /--mutation-mode 'direct-process'/u);
    const directTokenPayload = decodeMissionProposalTokenForTest(directProposal.proposalToken);
    assert.equal(directTokenPayload.version, directProposal.proposalVersion);
    assert.equal(directTokenPayload.action, "run-dove-auto");
    assert.equal(directTokenPayload.mutationMode, directProposal.proposalMutationMode);
    assert.deepEqual(directTokenPayload.confirmArgs, directProposal.confirmArgs);
    assert.equal(fs.existsSync(path.join(directRoot, ".dove")), false);

    const directReplay = spawnSync("/bin/sh", ["-c", directProposal.exactConfirmationCommand], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    assert.equal(directReplay.status, 1, directReplay.stderr || directReplay.stdout);
    assert.match(directReplay.stderr || directReplay.stdout, /host-pass-required|补真实结果或证据/u);
    assert.equal(fs.existsSync(path.join(directRoot, directProposal.proposedTask.packetPath)), true);
    const directTask = JSON.parse(fs.readFileSync(path.join(directRoot, directProposal.proposedTask.packetPath), "utf8"));
    assert.equal(directTask.id, directProposal.proposedTask.id);

    const patchProposalProcess = spawnSync("node", [
      CLI,
      "auto",
      patchRoot,
      "--goal",
      goal,
      "--max-iterations",
      "1",
      "--json"
    ], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    assert.equal(patchProposalProcess.status, 0, patchProposalProcess.stderr || patchProposalProcess.stdout);
    const patchProposal = JSON.parse(patchProposalProcess.stdout);
    assert.equal(patchProposal.proposalMutationMode, "patch-plan");
    assert.match(patchProposal.exactConfirmationCommand, /--mutation-mode 'patch-plan'/u);
    assert.equal(fs.existsSync(path.join(patchRoot, ".dove")), false);

    const patchReplayProcess = spawnSync("node", [
      CLI,
      "auto",
      patchRoot,
      "--proposal-token",
      patchProposal.proposalToken,
      "--confirmed",
      "--mutation-mode",
      "patch-plan",
      "--json"
    ], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    assert.equal(patchReplayProcess.status, 1, patchReplayProcess.stderr || patchReplayProcess.stdout);
    assert.match(patchReplayProcess.stderr || patchReplayProcess.stdout, /host-pass-required|补真实结果或证据/u);
    assert.equal(fs.existsSync(path.join(patchRoot, ".dove")), false);

    ensureTestWorkspace(selectionRoot);
    writeTaskPacket(selectionRoot, {
      id: "cli-auto-selection",
      title: "CLI auto selection replay",
      summary: "Exercise the existing-task proposal token path.",
      status: "ready",
      lifecycleStatus: "active",
      active: true,
      level: 1,
      creatorKind: "operator",
      domain: "engineering",
      stage: "execute",
      nextAction: "project:dove.auto",
      updatedAt: new Date(0).toISOString()
    });
    const beforeSelectionProposal = snapshotRelativeFileContents(selectionRoot);
    const selectionProposalProcess = spawnSync("node", [
      CLI,
      "auto",
      selectionRoot,
      "--target",
      "cli-auto-selection",
      "--max-iterations",
      "1",
      "--mutation-mode",
      "direct-process",
      "--json"
    ], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    assert.equal(selectionProposalProcess.status, 0, selectionProposalProcess.stderr || selectionProposalProcess.stdout);
    const selectionProposal = JSON.parse(selectionProposalProcess.stdout);
    assert.equal(selectionProposal.proposalKind, "selection");
    assert.equal(selectionProposal.confirmArgs.packetId, "cli-auto-selection");
    assert.deepEqual(snapshotRelativeFileContents(selectionRoot), beforeSelectionProposal);

    const selectionReplayProcess = spawnSync("node", [
      CLI,
      "auto",
      selectionRoot,
      "--proposal-token",
      selectionProposal.proposalToken,
      "--confirmed",
      "--mutation-mode",
      "direct-process",
      "--json"
    ], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    assert.equal(selectionReplayProcess.status, 1, selectionReplayProcess.stderr || selectionReplayProcess.stdout);
    assert.match(selectionReplayProcess.stderr || selectionReplayProcess.stdout, /host-pass-required|补真实结果或证据/u);
    const selectionTask = JSON.parse(fs.readFileSync(path.join(selectionRoot, ".dove/task-packets/packets/cli-auto-selection.json"), "utf8"));
    assert.equal(selectionTask.id, "cli-auto-selection");
  } finally {
    fs.rmSync(directRoot, { recursive: true, force: true });
    fs.rmSync(patchRoot, { recursive: true, force: true });
    fs.rmSync(selectionRoot, { recursive: true, force: true });
  }
});

test("CLI auto rejects unknown, malformed, tampered, cross-workspace, and mode-drift proposal tokens without writing", () => {
  const root = tempRoot();
  const otherRoot = tempRoot();
  try {
    const proposalProcess = spawnSync("node", [
      CLI,
      "auto",
      root,
      "--goal",
      "Keep this CLI auto replay bound to its exact local proposal.",
      "--max-iterations",
      "1",
      "--mutation-mode",
      "direct-process",
      "--json"
    ], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    assert.equal(proposalProcess.status, 0, proposalProcess.stderr || proposalProcess.stdout);
    const proposal = JSON.parse(proposalProcess.stdout);
    const tokenPayload = decodeMissionProposalTokenForTest(proposal.proposalToken);
    const before = snapshotRelativeFileContents(root);
    assert.deepEqual(before, {});

    const unknownReplayFieldPayload = structuredClone(tokenPayload);
    unknownReplayFieldPayload.confirmArgs.unknownReplayField = "not-canonical";
    const malformedTokens = [
      "",
      "not.a.base64url.token",
      Buffer.from("{", "utf8").toString("base64url"),
      encodeMissionProposalTokenForTest({ ...tokenPayload, version: 2 }),
      encodeMissionProposalTokenForTest({ ...tokenPayload, action: "create-dove-task" }),
      encodeMissionProposalTokenForTest({ ...tokenPayload, confirmArgs: [] }),
      encodeMissionProposalTokenForTest({ ...tokenPayload, unknown: true }),
      encodeMissionProposalTokenForTest(unknownReplayFieldPayload)
    ];
    for (const proposalToken of malformedTokens) {
      const rejected = spawnSync("node", [
        CLI,
        "auto",
        root,
        "--proposal-token",
        proposalToken,
        "--confirmed",
        "--mutation-mode",
        "direct-process",
        "--json"
      ], {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024
      });
      assert.equal(rejected.status, 1, rejected.stderr || rejected.stdout);
      assert.deepEqual(snapshotRelativeFileContents(root), before);
    }

    for (const duplicateArgs of [
      ["--proposal-token", proposal.proposalToken, "--proposal-token", proposal.proposalToken, "--confirmed", "--mutation-mode", "direct-process"],
      ["--proposal-token", proposal.proposalToken, "--confirmed", "--mutation-mode", "direct-process", "--mutation-mode", "direct-process"],
      ["--proposal-token", proposal.proposalToken, "--confirmed", "--yes", "--mutation-mode", "direct-process"],
      ["--proposal-token", proposal.proposalToken, "--yes", "--mutation-mode", "direct-process"],
      ["--proposal-token", proposal.proposalToken, "--confirmed"]
    ]) {
      const rejected = spawnSync("node", [CLI, "auto", root, ...duplicateArgs, "--json"], {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024
      });
      assert.equal(rejected.status, 1, rejected.stderr || rejected.stdout);
      assert.deepEqual(snapshotRelativeFileContents(root), before);
    }

    for (const extraArgs of [
      ["--goal", "Override the approved goal."],
      ["--max-iterations", "2"],
      ["--steps-json", JSON.stringify([{ command: "dove.status" }])]
    ]) {
      const rejected = spawnSync("node", [
        CLI,
        "auto",
        root,
        "--proposal-token",
        proposal.proposalToken,
        "--confirmed",
        "--mutation-mode",
        "direct-process",
        ...extraArgs,
        "--json"
      ], {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024
      });
      assert.equal(rejected.status, 1, rejected.stderr || rejected.stdout);
      assert.deepEqual(snapshotRelativeFileContents(root), before);
    }

    for (const alter of [
      (payload) => {
        payload.confirmArgs.proposalDigest = "0".repeat(64);
      },
      (payload) => {
        payload.confirmArgs.goal = "Semantically altered auto replay goal.";
      }
    ]) {
      const tamperedPayload = structuredClone(tokenPayload);
      alter(tamperedPayload);
      const tampered = spawnSync("node", [
        CLI,
        "auto",
        root,
        "--proposal-token",
        encodeMissionProposalTokenForTest(tamperedPayload),
        "--confirmed",
        "--mutation-mode",
        "direct-process",
        "--json"
      ], {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024
      });
      assert.equal(tampered.status, 1, tampered.stderr || tampered.stdout);
      assert.deepEqual(snapshotRelativeFileContents(root), before);
    }

    const modeDrift = spawnSync("node", [
      CLI,
      "auto",
      root,
      "--proposal-token",
      proposal.proposalToken,
      "--confirmed",
      "--mutation-mode",
      "patch-plan",
      "--json"
    ], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    assert.equal(modeDrift.status, 1, modeDrift.stderr || modeDrift.stdout);
    assert.deepEqual(snapshotRelativeFileContents(root), before);

    const crossWorkspace = spawnSync("node", [
      CLI,
      "auto",
      otherRoot,
      "--proposal-token",
      proposal.proposalToken,
      "--confirmed",
      "--mutation-mode",
      "direct-process",
      "--json"
    ], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    assert.equal(crossWorkspace.status, 1, crossWorkspace.stderr || crossWorkspace.stdout);
    assert.deepEqual(snapshotRelativeFileContents(otherRoot), {});
    assert.deepEqual(snapshotRelativeFileContents(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(otherRoot, { recursive: true, force: true });
  }
});

test("CLI auto proposal replay rejects canonical workspace symlink retarget without writing", (t) => {
  const container = tempRoot();
  const workspaceA = path.join(container, "workspace-a");
  const workspaceB = path.join(container, "workspace-b");
  const alias = path.join(container, "workspace-link");
  fs.mkdirSync(workspaceA);
  fs.mkdirSync(workspaceB);
  try {
    fs.symlinkSync(workspaceA, alias, "dir");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) {
      t.skip(`symlinks are unavailable: ${error.code}`);
      fs.rmSync(container, { recursive: true, force: true });
      return;
    }
    throw error;
  }
  try {
    const proposalProcess = spawnSync("node", [
      CLI,
      "auto",
      alias,
      "--goal",
      "Keep this auto replay bound to one canonical workspace.",
      "--mutation-mode",
      "direct-process",
      "--json"
    ], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    assert.equal(proposalProcess.status, 0, proposalProcess.stderr || proposalProcess.stdout);
    const proposal = JSON.parse(proposalProcess.stdout);
    assert.equal(proposal.proposalWorkspace, fs.realpathSync.native(workspaceA));
    assert.deepEqual(snapshotRelativeFileContents(workspaceA), {});

    fs.unlinkSync(alias);
    fs.symlinkSync(workspaceB, alias, "dir");
    const beforeB = snapshotRelativeFileContents(workspaceB);
    const rejected = spawnSync("node", [
      CLI,
      "auto",
      alias,
      "--proposal-token",
      proposal.proposalToken,
      "--confirmed",
      "--mutation-mode",
      "direct-process",
      "--json"
    ], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    assert.equal(rejected.status, 1, rejected.stderr || rejected.stdout);
    assert.deepEqual(snapshotRelativeFileContents(workspaceA), {});
    assert.deepEqual(snapshotRelativeFileContents(workspaceB), beforeB);
  } finally {
    fs.rmSync(container, { recursive: true, force: true });
  }
});

test("CLI review performs the local reviewer pass without requiring a hidden handoff command", () => {
  const root = tempRoot();
  ensureTestWorkspace(root);
  const timestamp = new Date(0).toISOString();
  const draftPath = `${ARTIFACT_PATHS.draftsDir}/cli-review.md`;
  const packet = {
    id: "cli-review-packet",
    title: "CLI review packet",
    summary: "Review real local artifacts.",
    status: "ready",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    level: 1,
    creatorKind: "operator",
    domain: "paper",
    stage: "execute",
    artifactRefs: [draftPath],
    updatedAt: timestamp
  };
  writeJson(root, `.dove/task-packets/packets/${packet.id}.json`, packet);
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, { version: 3, items: [packet], updatedAt: timestamp });
  writeText(root, draftPath, "# Review material\n\nThis packet-owned draft contains substantive content for local review.\n");
  writeText(root, ARTIFACT_PATHS.claims, "# Claims\n\nNo claims recorded.\n");
  writeText(root, ARTIFACT_PATHS.experimentLog, "# Experiment log\n\nNo experiments recorded.\n");
  writeJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: timestamp });

  const review = spawnSync("node", [CLI, "review", root, "--packet-id", packet.id, "--mutation-mode", "patch-plan", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024
  });
  assert.equal(review.status, 0, review.stderr || review.stdout);
  const parsed = JSON.parse(review.stdout);
  assert.equal(parsed.verdict, "coherent");
  assert.equal(parsed.writesApplied, false);
  const boardOperationIndex = parsed.mutationPlan.operations.findIndex((operation) => operation.relativePath === ARTIFACT_PATHS.orchestrationBoard);
  const handoffOperationIndex = parsed.mutationPlan.operations.findIndex((operation) => operation.relativePath === ARTIFACT_PATHS.orchestrationHandoffs);
  const reviewOperationIndex = parsed.mutationPlan.operations.findIndex((operation) => operation.relativePath === ARTIFACT_PATHS.reviewState);
  assert.ok(boardOperationIndex >= 0);
  assert.ok(handoffOperationIndex >= 0);
  assert.ok(reviewOperationIndex >= 0);
  assert.ok(boardOperationIndex < reviewOperationIndex);
  assert.ok(handoffOperationIndex < reviewOperationIndex);
});

test("direct-process review-loop transfers ordinary work to one reviewer handoff without a policy override", () => {
  const root = tempRoot();
  const packet = seedReviewLoopPacket(root, {
    id: "direct-review-loop-packet",
    title: "Direct review-loop packet"
  });
  const handoffsBefore = fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationHandoffs), "utf8");

  const review = spawnSync("node", [CLI, "review-loop", root, "--packet-id", packet.id, "--mutation-mode", "direct-process", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024
  });

  assert.equal(review.status, 0, review.stderr || review.stdout);
  const result = JSON.parse(review.stdout);
  assert.equal(result.mutationMode, "direct-process");
  assert.equal(result.writesApplied, true);
  const board = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationBoard), "utf8"));
  assert.equal(board.currentPhase, "review");
  assert.equal(board.assignedRole, "reviewer");
  const appendedHandoffs = fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationHandoffs), "utf8").slice(handoffsBefore.length);
  assert.equal((appendedHandoffs.match(/^## /gm) ?? []).length, 1);
  assert.match(appendedHandoffs, /builder -> reviewer/u);
  assert.doesNotMatch(appendedHandoffs, /Policy override:/u);
  const mutationPaths = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.mutationsIndex), "utf8")).entries.at(-1).paths;
  const boardMutationIndex = mutationPaths.indexOf(ARTIFACT_PATHS.orchestrationBoard);
  const handoffMutationIndex = mutationPaths.indexOf(ARTIFACT_PATHS.orchestrationHandoffs);
  const reviewMutationIndex = mutationPaths.indexOf(ARTIFACT_PATHS.reviewState);
  assert.ok(boardMutationIndex >= 0);
  assert.ok(handoffMutationIndex >= 0);
  assert.ok(reviewMutationIndex >= 0);
  assert.ok(boardMutationIndex < reviewMutationIndex);
  assert.ok(handoffMutationIndex < reviewMutationIndex);
});

test("direct-process review-loop does not duplicate a handoff when reviewer already owns the board", () => {
  const root = tempRoot();
  const packet = seedReviewLoopPacket(root, {
    id: "reviewer-owned-loop-packet",
    title: "Reviewer-owned review-loop packet",
    assignedRole: "reviewer",
    stage: "review"
  });
  runFixtureMutation(root, "seed-reviewer-owned-board", () => upsertSystemOrchestrationBoard(root, {
    phase: "review",
    assignedRole: "reviewer",
    currentFocus: "Continue the existing reviewer pass.",
    nextAction: "Run the bounded local review loop."
  }));
  const handoffsBefore = fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationHandoffs), "utf8");

  const review = spawnSync("node", [CLI, "review-loop", root, "--packet-id", packet.id, "--mutation-mode", "direct-process", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024
  });

  assert.equal(review.status, 0, review.stderr || review.stdout);
  const result = JSON.parse(review.stdout);
  assert.equal(result.mutationMode, "direct-process");
  const board = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationBoard), "utf8"));
  assert.equal(board.currentPhase, "review");
  assert.equal(board.assignedRole, "reviewer");
  assert.equal(fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationHandoffs), "utf8"), handoffsBefore);
});

test("direct-process review-loop cannot bypass reviewer transition with skipBoardUpdate", () => {
  const root = tempRoot();
  const packet = seedReviewLoopPacket(root, {
    id: "skip-board-review-loop-packet",
    title: "Skip-board review-loop packet"
  });
  const handoffsBefore = fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationHandoffs), "utf8");

  assert.throws(() => runWithMutationContext(root, {
    actionId: "run-dove-review-loop",
    mutationMode: "direct-process",
    hostId: "test",
    packetId: packet.id
  }, () => runDoveReviewLoop(root, {
    packetId: packet.id,
    skipBoardUpdate: true
  })), /retired governance input skipBoardUpdate at \$\.skipBoardUpdate/u);

  const board = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationBoard), "utf8"));
  assert.equal(board.currentPhase, "draft");
  assert.equal(board.assignedRole, "builder");
  assert.equal(fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationHandoffs), "utf8"), handoffsBefore);
});

test("direct-process review-loop leaves draft content untouched at the builder revision boundary", () => {
  const root = tempRoot();
  const packet = seedReviewLoopPacket(root, {
    id: "review-loop-no-draft-mutation",
    title: "Review-loop no draft mutation"
  });
  const draftPath = packet.artifactRefs[0];
  const originalDraft = fs.readFileSync(path.join(root, draftPath), "utf8");

  const result = runWithMutationContext(root, {
    actionId: "run-dove-review-loop",
    mutationMode: "direct-process",
    hostId: "test",
    packetId: packet.id
  }, () => runDoveReviewLoop(root, {
    packetId: packet.id,
    runId: "review-loop-no-draft-mutation",
    artifactPaths: [draftPath]
  }));

  assert.ok(["coherent", "needs-review"].includes(result.status));
  assert.equal(result.pass.review.verdict, result.review.verdict);
  assert.equal(fs.readFileSync(path.join(root, draftPath), "utf8"), originalDraft);
  const board = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationBoard), "utf8"));
  assert.equal(board.currentPhase, "review");
  assert.equal(board.assignedRole, "reviewer");
});

test("direct-process review-loop leaves experience artifacts untouched at the builder revision boundary", () => {
  const root = tempRoot();
  const packet = seedReviewLoopPacket(root, {
    id: "review-loop-no-experience-mutation",
    title: "Review-loop no experience mutation"
  });
  const experiencePaths = [
    ARTIFACT_PATHS.experimentPlans,
    ARTIFACT_PATHS.experimentResults,
    ARTIFACT_PATHS.experimentAudits,
    ARTIFACT_PATHS.claimBridgeLog
  ];
  const snapshotExperienceArtifacts = () => Object.fromEntries(experiencePaths.map((relativePath) => {
    const fullPath = path.join(root, relativePath);
    return [relativePath, fs.existsSync(fullPath) ? fs.readFileSync(fullPath).toString("base64") : null];
  }));
  const before = snapshotExperienceArtifacts();

  const result = runWithMutationContext(root, {
    actionId: "run-dove-review-loop",
    mutationMode: "direct-process",
    hostId: "test",
    packetId: packet.id
  }, () => runDoveReviewLoop(root, {
    packetId: packet.id,
    runId: "review-loop-no-experience-mutation",
    artifactPaths: packet.artifactRefs
  }));

  assert.ok(["coherent", "needs-review"].includes(result.status));
  assert.equal(result.pass.review.verdict, result.review.verdict);
  assert.deepEqual(snapshotExperienceArtifacts(), before);
  const board = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationBoard), "utf8"));
  assert.equal(board.currentPhase, "review");
  assert.equal(board.assignedRole, "reviewer");
});

test("direct-process review-loop rejects retired governance controls recursively before writes", () => {
  const cases = [
    [{ policyOverrideReason: "legacy" }, "$.policyOverrideReason"],
    [{ skipBoardUpdate: false }, "$.skipBoardUpdate"],
    [{ draft: { policyOverrideFutureMode: null } }, "$.draft"],
    [{ experience: { nested: [{ skipRefreshDurableSurfaces: true }] } }, "$.experience"]
  ];

  for (const [index, [retiredInput, expectedPath]] of cases.entries()) {
    const root = tempRoot();
    const packet = seedReviewLoopPacket(root, {
      id: `review-loop-retired-${index}`,
      title: "Review-loop retired governance input"
    });
    const boardBefore = fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationBoard), "utf8");
    const handoffsBefore = fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationHandoffs), "utf8");

    assert.throws(() => runWithMutationContext(root, {
      actionId: "run-dove-review-loop",
      mutationMode: "direct-process",
      hostId: "test",
      packetId: packet.id
    }, () => runDoveReviewLoop(root, {
      packetId: packet.id,
      ...retiredInput
    })), (error) => error instanceof Error && error.message.includes(expectedPath));

    assert.equal(fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationBoard), "utf8"), boardBefore);
    assert.equal(fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationHandoffs), "utf8"), handoffsBefore);
  }
});

test("read-only status query does not bootstrap an empty workspace", () => {
  const root = tempRoot();
  try {
    const before = snapshotRelativeFileContents(root);
    const result = queryDoveStatus(root);

    assert.equal(result.mode, "dove-status-query");
    assert.equal(result.proposalOnly, true);
    assert.deepEqual(result.changes, {
      intent: "none",
      applied: false,
      count: 0,
      rollback: "not-applicable"
    });
    assert.deepEqual(snapshotRelativeFileContents(root), before);
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI status defaults to a concise human summary and keeps JSON opt-in", () => {
  const root = tempRoot();
  ensureTestWorkspace(root);

  const human = spawnSync("node", [CLI, "status", root], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /Dove/);
  assert.match(human.stdout, /dove\.init/);
  assert.doesNotMatch(human.stdout, /project:dove\.init/);
  assert.doesNotMatch(human.stdout, /^Dove: /m);
  assert.doesNotMatch(human.stdout, /^Next: /m);
  assert.doesNotMatch(human.stdout, /^Why: /m);
  assert.doesNotMatch(human.stdout, /^More: /m);
  assert.doesNotMatch(human.stdout, /Dove current situation:/);
  assert.doesNotMatch(human.stdout, /Current context:/);
  assert.doesNotMatch(human.stdout, /Next action:/);
  assert.doesNotMatch(human.stdout, /Boundary\/gap:/);
  assert.doesNotMatch(human.stdout, /Required evidence:/);
  assert.doesNotMatch(human.stdout, /Writes:/);
  assert.doesNotMatch(human.stdout, /blocked \d+/);
  assert.doesNotMatch(human.stdout, /execution gaps:/);
  assert.doesNotMatch(human.stdout, /Durable state:/);
  assert.doesNotMatch(human.stdout, /rollback coverage:/);
  assert.doesNotMatch(human.stdout, /host checkpoint:/);
  assert.doesNotMatch(human.stdout, /patch-plan supported:/);
  assert.doesNotMatch(human.stdout, /direct-process rollback-safe:/);
  assert.doesNotMatch(human.stdout, /Pre-action guidance:/);
  assert.doesNotMatch(human.stdout, /Recent execution receipts:/);
  assert.doesNotMatch(human.stdout, /Project state:/);
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
  assert.equal(parsed.statusAdjustmentContract, undefined);
  assert.equal(parsed.durableContextNotice, undefined);
  assert.equal(parsed.dashboard, undefined);
  assert.equal(parsed.dailyHome, undefined);
  assert.equal(parsed.diagnostics, undefined);
  assertPublicCompactStatus(parsed);
  assert.match(parsed.summary, /Dove/);
  assert.equal(parsed.headline, parsed.statusHome.headline);
  assert.equal(parsed.statusHome.nextStep.copyableCommand, "dove.init");
  assert.equal(parsed.nextStep.copyableCommand, "dove.init");
  assert.equal(parsed.statusHome.needsAttention.status, "clear");
  assert.equal(parsed.needsAttention.status, "clear");
  assert.equal("preActionGuidance" in parsed.statusHome, false);
  assert.equal("projectState" in parsed.statusHome, false);
  assert.equal("blockersAndReconciliation" in parsed.statusHome, false);
  assert.equal("optionalMissionDetails" in parsed.statusHome, false);

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
  assert.match(fullHuman.stdout, /Dove/);
  assert.doesNotMatch(fullHuman.stdout, /^Dove: /m);
  assert.doesNotMatch(fullHuman.stdout, /^Next: /m);
  assert.doesNotMatch(fullHuman.stdout, /^Why: /m);
  assert.doesNotMatch(fullHuman.stdout, /^More: /m);
  assert.doesNotMatch(fullHuman.stdout, /Boundary\/gap:/);
  assert.doesNotMatch(fullHuman.stdout, /execution gaps:/);
  assert.doesNotMatch(fullHuman.stdout, /Gaps and boundaries:/);

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

test("CLI status help stays focused on status expansion", () => {
  const help = spawnSync("node", [CLI, "status", ".", "--help"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(help.status, 0, help.stderr || help.stdout);
  assert.match(help.stdout, /dove status/);
  assert.match(help.stdout, /--missions/);
  assert.doesNotMatch(help.stdout, /dove install/);
  assert.doesNotMatch(help.stdout, /mutation-mode|patch-plan|direct-process|serve-global-status/u);
});

test("CLI work surface help stays public without executing writes", () => {
  for (const surface of ["source", "note", "draft", "experience", "review", "review-loop"]) {
    const help = spawnSync("node", [CLI, surface, "--help"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(help.status, 0, help.stderr || help.stdout);
    assert.match(help.stdout, /Usage:/u);
    assert.match(help.stdout, new RegExp(`dove ${surface} \\[target\\]`, "u"));
    assert.match(help.stdout, /For work requests, use the matching action with real material/u);
    assert.doesNotMatch(help.stdout, /This shell can only give guidance for this Dove request|Next: run \/dove\.|cannot save|save changes/u);
    assertNoCompactPublicLeaks(help.stdout);
    assert.doesNotMatch(help.stdout, /--packet-id|mutation-mode|patch-plan|direct-process|source-svg-path|output-manifest-path|svg-content|host command|MCP capability|local CLI|Dove runtime|CLI route|direct subcommand/u);
  }
});

test("CLI source and note default to governed patch-plans without writing records", () => {
  const root = tempRoot();
  try {
    ensureTestWorkspace(root);
    const timestamp = new Date(0).toISOString();
    writeTaskPacket(root, {
      id: "cli-work-packet",
      title: "CLI real work packet",
      summary: "Packet for source and note CLI regression coverage.",
      status: "pending",
      lifecycleStatus: "active",
      active: true,
      assignedRole: "builder",
      level: 1,
      creatorKind: "operator",
      domain: "paper",
      stage: "execute",
      updatedAt: timestamp
    });
    writeJson(root, ARTIFACT_PATHS.sources, {
      version: 1,
      items: [{ id: "cli-known-source", citationKey: "cliKnownSource", title: "CLI Known Source", locator: "integration-test:cli-known-source", authors: [], year: 2026 }],
      updatedAt: null
    });
    const beforeSources = fs.readFileSync(path.join(root, ARTIFACT_PATHS.sources), "utf8");
    const beforeNotes = fs.readFileSync(path.join(root, ARTIFACT_PATHS.notes), "utf8");

    const sourceArgs = [CLI, "source", root, "--packet-id", "cli-work-packet", "--title", "Verified source", "--locator", "https://example.com/source"];
    const sourceHuman = spawnSync("node", sourceArgs, { cwd: ROOT, encoding: "utf8" });
    assert.equal(sourceHuman.status, 0, sourceHuman.stderr || sourceHuman.stdout);
    assert.match(sourceHuman.stdout, /来源|source|待确认方案/u);
    assertNoCompactPublicLeaks(sourceHuman.stdout);
    assert.doesNotMatch(sourceHuman.stdout, /\.dove\/|packetId|mutationMode|patch-plan|direct-process|register_source/u);
    assert.equal(fs.readFileSync(path.join(root, ARTIFACT_PATHS.sources), "utf8"), beforeSources);

    const sourceMachine = spawnSync("node", [...sourceArgs, "--json"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(sourceMachine.status, 0, sourceMachine.stderr || sourceMachine.stdout);
    const sourceParsed = JSON.parse(sourceMachine.stdout);
    assert.equal(sourceParsed.mutationMode, "patch-plan");
    assert.equal(sourceParsed.writesApplied, false);
    assert.ok(sourceParsed.mutationPlan.operations.length > 0);
    assert.equal(fs.readFileSync(path.join(root, ARTIFACT_PATHS.sources), "utf8"), beforeSources);

    const noteArgs = [CLI, "note", root, "--packet-id", "cli-work-packet", "--source-id", "cli-known-source", "--summary", "This is real synthesis from verified material."];
    const noteHuman = spawnSync("node", noteArgs, { cwd: ROOT, encoding: "utf8" });
    assert.equal(noteHuman.status, 0, noteHuman.stderr || noteHuman.stdout);
    assert.match(noteHuman.stdout, /笔记|note|待确认方案/u);
    assertNoCompactPublicLeaks(noteHuman.stdout);
    assert.doesNotMatch(noteHuman.stdout, /\.dove\/|packetId|mutationMode|patch-plan|direct-process|upsert_note/u);
    assert.equal(fs.readFileSync(path.join(root, ARTIFACT_PATHS.notes), "utf8"), beforeNotes);

    const noteMachine = spawnSync("node", [...noteArgs, "--json"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(noteMachine.status, 0, noteMachine.stderr || noteMachine.stdout);
    const noteParsed = JSON.parse(noteMachine.stdout);
    assert.equal(noteParsed.mutationMode, "patch-plan");
    assert.equal(noteParsed.writesApplied, false);
    assert.ok(noteParsed.mutationPlan.operations.length > 0);
    assert.equal(fs.readFileSync(path.join(root, ARTIFACT_PATHS.notes), "utf8"), beforeNotes);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI draft requires real body or explicit section status", () => {
  const root = tempRoot();
  try {
    ensureTestWorkspace(root);
    writeTaskPacket(root, {
      id: "cli-draft-packet",
      title: "CLI draft packet",
      summary: "Packet for draft CLI regression coverage.",
      status: "pending",
      lifecycleStatus: "active",
      active: true,
      assignedRole: "builder",
      level: 1,
      creatorKind: "operator",
      domain: "paper",
      stage: "execute",
      updatedAt: new Date(0).toISOString()
    });

    const missingBody = spawnSync("node", [CLI, "draft", root, "--packet-id", "cli-draft-packet", "--section-id", "methods"], { cwd: ROOT, encoding: "utf8" });
    assert.notEqual(missingBody.status, 0, missingBody.stderr || missingBody.stdout);
    assert.match(missingBody.stdout, /草稿更新/u);
    assert.match(missingBody.stdout, /body|status|正文|状态/u);
    assertNoCompactPublicLeaks(missingBody.stdout);

    const draftPath = path.join(root, ARTIFACT_PATHS.draftsDir, "methods.md");
    const bodyArgs = [CLI, "draft", root, "--packet-id", "cli-draft-packet", "--section-id", "methods", "--body", "A concrete methods draft paragraph with an explicit evidence placeholder."];
    const bodyHuman = spawnSync("node", bodyArgs, { cwd: ROOT, encoding: "utf8" });
    assert.equal(bodyHuman.status, 0, bodyHuman.stderr || bodyHuman.stdout);
    assertNoCompactPublicLeaks(bodyHuman.stdout);
    assert.equal(fs.existsSync(draftPath), false);

    const bodyMachine = spawnSync("node", [...bodyArgs, "--json"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(bodyMachine.status, 0, bodyMachine.stderr || bodyMachine.stdout);
    const parsed = JSON.parse(bodyMachine.stdout);
    assert.equal(parsed.mutationMode, "patch-plan");
    assert.equal(parsed.writesApplied, false);
    assert.ok(parsed.mutationPlan.operations.length > 0);
    assert.equal(fs.existsSync(draftPath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI status hides internal packet ids and expansion commands by default", () => {
  const root = tempRoot();
  ensureTestWorkspace(root);
  const timestamp = new Date(0).toISOString();

  writeTaskPacket(root, {
    id: "task-root-status-regression",
    title: "Root status regression",
    summary: "Root task for status CLI regression coverage.",
    status: "completed",
    lifecycleStatus: "completed",
    active: false,
    assignedRole: "planner",
    level: 0,
    creatorKind: "init",
    domain: "paper",
    stage: "plan",
    updatedAt: timestamp
  });
  writeTaskPacket(root, {
    id: "task-host-pass-result-regression",
    title: "Host pass result regression",
    summary: "Regression packet for CLI status output.",
    status: "blocked",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    level: 1,
    creatorKind: "operator",
    domain: "paper",
    stage: "execute",
    currentFocus: "Need real host-side evidence.",
    nextAction: "project:dove.source",
    boundary: {
      id: "boundary-host-pass-result-regression",
      type: "awaiting-host-pass-result",
      status: "open",
      reason: "awaiting-host-pass-result",
      summary: "需要主机侧真实执行结果。",
      requiredInputs: ["真实来源 URL", "来源标题", "locator 或可访问出处"],
      requiredActions: ["provide-host-result"],
      command: "project:dove.source"
    },
    updatedAt: timestamp
  });

  const human = spawnSync("node", [CLI, "status", root], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(human.status, 0, human.stderr || human.stdout);
  assert.match(human.stdout, /当前任务|真实执行结果/);
  assert.doesNotMatch(human.stdout, /\btask-[a-z0-9][a-z0-9-]*\b/iu);
  assert.doesNotMatch(human.stdout, /--packet-id\b/u);
  assert.doesNotMatch(human.stdout, /--missions|--full|--json/u);

  const machine = spawnSync("node", [CLI, "status", root, "--json"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(machine.status, 0, machine.stderr || machine.stdout);
  assertPublicCompactStatus(JSON.parse(machine.stdout));
});

test("status reports host rollback capture as unverifiable from Dove", () => {
  const root = tempRoot();
  ensureTestWorkspace(root);
  const compactResult = queryDoveStatus(root);
  const result = queryDoveStatus(root, { detail: "full" });
  assertDurableContextNotice(result.durableContextNotice);
  assert.equal(result.durableContextNotice.hostCheckpointDetected, false);
  assert.equal(result.durableContextNotice.hostCheckpointStatus, "not-programmatically-verifiable");
  assert.equal(result.durableContextNotice.hostCheckpoint.kind, "host-file-checkpoint");
  assert.equal(result.durableContextNotice.externalWriteCaptureVerified, false);
  assertPublicCompactStatus(compactResult);
  assert.equal("durableContextNotice" in compactResult, false);
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
  const meta = runFixtureMutation(root, "refresh-meta-optimize-guidance", () => queryMetaOptimize(root));
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
  ensureTestWorkspace(root);

  const result = runFixtureMutation(root, "query-meta-optimize", () => queryMetaOptimize(root));
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
  ensureTestWorkspace(root);

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
  ensureTestWorkspace(root);

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
      },
      {
        id: "zz-status-archived",
        title: "Archived dogfood mission",
        summary: "Archived dogfood noise should stay hidden unless requested.",
        parentId: "dove-global-init",
        rootId: "dove-global-init",
        level: 3,
        creatorKind: "user",
        stage: "execute",
        domain: "engineering",
        status: "archived",
        lifecycleStatus: "archived-with-lineage",
        dependencies: [],
        blockedBy: [],
        archivedAt: "2026-05-14T23:59:00.000Z",
        archiveReason: "Retired visible dogfood attempt.",
        nextAction: "project:dove.status",
        outputPaths: [],
        evidenceLinks: []
      }
    ],
    taskModel: {
      activeInitId: "dove-global-init",
      activeTaskIds: ["status-packet"]
    },
    lifecycleCounts: { ready: 4, pending: 2, completed: 1, killed: 1, archived: 1 },
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
  const archivedExpandedResult = queryDoveStatus(root, { domain: "engineering", showMissions: true, requestStatusAdjustment: true, includeArchived: true });
  const archivedFullResult = queryDoveStatus(root, { domain: "engineering", detail: "full", requestStatusAdjustment: true, includeArchived: true });
  const after = snapshotArtifacts(root, statusWatchedArtifacts);

  assert.equal(result.mode, "dove-status-query");
  assert.equal(result.query, true);
  assert.equal(result.proposalOnly, true);
  assert.equal(result.noAutoApply, true);
  assertPublicCompactStatus(result);
  assert.equal(result.dashboard, undefined);
  assert.equal(result.dailyHome, undefined);
  assert.equal("durableContextNotice" in result, false);
  assert.equal("preActionGuidance" in result.statusHome, false);
  assert.equal("projectState" in result.statusHome, false);
  assert.equal("blockersAndReconciliation" in result.statusHome, false);
  assert.equal("optionalMissionDetails" in result.statusHome, false);
  assert.equal(fullResult.detail, "full");
  assertDurableContextNotice(fullResult.durableContextNotice);
  assert.deepEqual(fullResult.dashboard.project.durableContextNotice, fullResult.durableContextNotice);
  assert.deepEqual(fullResult.diagnostics.durableContextNotice, fullResult.durableContextNotice);
  assert.ok(fullResult.dashboard);
  assert.equal(result.statusHome.currentContext.domain, "engineering");
  assert.equal(result.statusHome.currentContext.stage, "execute");
  assert.equal(result.statusHome.currentContext.primaryRole, "builder");
  assert.equal(fullResult.projectSummary.openMissionCount, 4);
  assert.equal(fullResult.projectSummary.todoMissionCount, 2);
  assert.equal(fullResult.projectSummary.doingMissionCount, 1);
  assert.equal(fullResult.projectSummary.blockedMissionCount, 1);
  assert.equal(fullResult.projectSummary.archivedMissionCount, 0);
  assert.equal(fullResult.projectSummary.archivedHiddenCount, 1);
  assert.equal(result.statusHome.nextStep.command, "dove.auto");
  assert.equal(result.statusHome.nextStep.copyableCommand, "dove.auto");
  assert.equal(fullResult.dailyHome.nextActions[0].command, "project:dove.auto");
  assert.equal(fullResult.boundaryActionCards.every((card) => card.proposalOnly === true && card.noAutoApply === true), true);
  const collapsedMissionDetails = fullResult.dailyHome.missionList;
  assert.equal(collapsedMissionDetails.presentation, "dove-mission-list");
  assert.deepEqual(collapsedMissionDetails.statusModel.userGroups, ["todo", "doing", "blocked", "done", "archived"]);
  assert.deepEqual(collapsedMissionDetails.statusModel.machineStatuses, ["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"]);
  assert.equal(collapsedMissionDetails.summary.openCount, 4);
  assert.equal(collapsedMissionDetails.summary.todoCount, 2);
  assert.equal(collapsedMissionDetails.summary.doingCount, 1);
  assert.equal(collapsedMissionDetails.summary.blockedCount, 1);
  assert.equal(collapsedMissionDetails.summary.doneCount, 3);
  assert.equal(collapsedMissionDetails.summary.archivedCount, 0);
  assert.equal(collapsedMissionDetails.summary.archivedHiddenCount, 1);
  const expandedMissionDetails = expandedResult.statusHome.optionalMissionDetails;
  assert.equal(expandedMissionDetails.detail, "compact");
  assert.equal(expandedMissionDetails.missionItemsIncluded, true);
  assert.equal(expandedMissionDetails.priorityLane.presentation, "dove-mission-priority-lane");
  assert.equal(expandedMissionDetails.priorityLane.focus.packetId, "runtime-progress");
  assert.equal(expandedMissionDetails.priorityLane.action.copyableCommand, "project:dove.auto --packet-id runtime-progress");
  assert.equal(expandedMissionDetails.priorityLane.needs.includes("implementation evidence"), true);
  assert.equal(expandedMissionDetails.priorityLane.needs.includes("provide-host-pass-result"), true);
  assert.deepEqual(expandedMissionDetails.groups.todo.items.map((item) => item.packetId), ["plain-pending", "status-packet"]);
  assert.deepEqual(expandedMissionDetails.groups.doing.items.map((item) => item.packetId), ["runtime-progress"]);
  assert.deepEqual(expandedMissionDetails.groups.blocked.items.map((item) => item.packetId), ["blocked-dependency"]);
  assert.deepEqual(expandedMissionDetails.groups.done.items.map((item) => item.packetId), []);
  assert.equal(expandedMissionDetails.groups.done.itemCount, 3);
  assert.equal(expandedMissionDetails.groups.done.hiddenCount, 3);
  assert.equal(expandedMissionDetails.groups.archived.itemCount, 0);
  assert.deepEqual(expandedMissionDetails.groups.archived.items.map((item) => item.packetId), []);
  assert.deepEqual(fullResult.dailyHome.missionList.groups.done.items.map((item) => item.packetId), ["runtime-completed", "zz-status-completed", "zz-status-killed"]);
  assert.equal(fullResult.dailyHome.missionList.groups.archived.items.length, 0);
  const archivedMissionDetails = archivedExpandedResult.statusHome.optionalMissionDetails;
  assert.equal(archivedFullResult.projectSummary.archivedMissionCount, 1);
  assert.equal(archivedFullResult.projectSummary.archivedHiddenCount, 0);
  assert.equal(archivedExpandedResult.statusHome.showMore.missionDetailsAvailable, true);
  assert.equal(archivedMissionDetails.groups.archived.itemCount, 1);
  assert.equal(archivedMissionDetails.groups.archived.hiddenCount, 1);
  assert.deepEqual(archivedMissionDetails.groups.archived.items.map((item) => item.packetId), []);
  assert.deepEqual(archivedFullResult.dailyHome.missionList.groups.archived.items.map((item) => item.packetId), ["zz-status-archived"]);
  assert.equal(archivedFullResult.dashboard.tasks.tree[0].children.some((task) => task.id === "zz-status-archived"), true);
  const archivedTask = archivedFullResult.dashboard.tasks.tree[0].children.find((task) => task.id === "zz-status-archived");
  assert.equal(archivedTask.status, "archived");
  assert.equal(archivedTask.lifecycleStatus, "archived-with-lineage");
  assert.equal(archivedTask.archivedAt, "2026-05-14T23:59:00.000Z");
  assert.equal(archivedTask.archiveReason, "Retired visible dogfood attempt.");
  assert.equal(collapsedMissionDetails.summary.openCount, 4);
  assert.equal(collapsedMissionDetails.summary.todoCount, 2);
  assert.equal(collapsedMissionDetails.summary.doingCount, 1);
  assert.equal(collapsedMissionDetails.summary.blockedCount, 1);
  assert.equal(collapsedMissionDetails.summary.doneCount, 3);
  assert.equal(collapsedMissionDetails.summary.archivedCount, 0);
  assert.equal(collapsedMissionDetails.summary.archivedHiddenCount, 1);
  assert.equal(archivedMissionDetails.summary.archivedCount, 1);
  assert.equal(archivedMissionDetails.summary.archivedHiddenCount, 0);
  assert.deepEqual(fullResult.dashboard.dailyHome, fullResult.dailyHome);
  assert.deepEqual(fullResult.dashboard.tasks.grouped, fullResult.dailyHome.missionList);
  assert.deepEqual(after, before);
  assert.equal(result.scope.domain, "engineering");
  assert.equal(result.scope.stage, "execute");
  assert.equal(result.scope.primaryRole, "builder");
  assert.equal(result.currentContext.domain, "engineering");
  assert.equal(result.currentContext.stage, "execute");
  assert.equal(result.currentContext.primaryRole, "builder");
  assert.equal(result.nextStep.command, "dove.auto");
  assert.equal(fullResult.board.nextCommand, "project:dove.auto");
  assert.equal(fullResult.dashboard.project.nextAction, fullResult.dailyHome.nextActions[0].command);
  assert.equal(fullResult.dashboard.nextAction, fullResult.dailyHome.nextActions[0].command);
  assert.equal(fullResult.board.domain, "engineering");
  assert.equal(fullResult.projectSummary.openMissionCount, 4);
  assert.equal(fullResult.projectSummary.todoMissionCount, 2);
  assert.equal(fullResult.projectSummary.doingMissionCount, 1);
  assert.equal(fullResult.projectSummary.blockedMissionCount, 1);
  assert.equal(fullResult.dashboard.init.id, "dove-global-init");
  assert.deepEqual(fullResult.dashboard.tasks.activeTaskIds, ["blocked-dependency", "plain-pending", "runtime-completed", "runtime-progress", "status-packet"]);
  assert.equal(fullResult.dashboard.tasks.counts.archived, 0);
  assert.equal(fullResult.dashboard.tasks.counts.archivedHidden, 1);
  assert.equal(archivedFullResult.dashboard.tasks.counts.archived, 1);
  assert.equal(archivedFullResult.dashboard.tasks.counts.archivedHidden, 0);
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
  assert.equal(fullResult.actionableBoundaries.some((boundary) => boundary.packetId === "runtime-progress" && boundary.type === "awaiting-host-pass"), true);
  assert.equal(fullResult.dashboard.tasks.actionableBoundaries.some((boundary) => boundary.packetId === "runtime-progress"), true);
  const runtimeBoundaryCard = fullResult.boundaryActionCards.find((card) => card.packetId === "runtime-progress");
  assert.ok(runtimeBoundaryCard);
  assert.equal(runtimeBoundaryCard.kind, "provide-evidence-or-result");
  assert.equal(runtimeBoundaryCard.command, "project:dove.auto");
  assert.deepEqual(runtimeBoundaryCard.requires, ["implementation evidence", "provide-host-pass-result"]);
  assert.equal(runtimeBoundaryCard.options.some((option) => option.kind === "kill-through-status" && option.tool === "apply_dove_status_adjustments"), true);
  assert.deepEqual(fullResult.dashboard.tasks.boundaryActionCards, fullResult.boundaryActionCards);
  const runtimeNextAction = fullResult.dailyHome.nextActions.find((card) => card.packetId === "runtime-progress" && card.kind === "recover-current-work");
  assert.ok(runtimeNextAction);
  assert.equal(runtimeNextAction.recoveryPrimaryKind, "provide-evidence");
  assert.equal(runtimeNextAction.command, "project:dove.auto");
  assert.equal(runtimeNextAction.copyableCommand, "project:dove.auto --packet-id runtime-progress");
  assert.equal(runtimeNextAction.title, "先为当前任务补真实结果：implementation evidence");
  assert.equal(result.statusHome.nextStep.label, "先为当前任务补真实结果：implementation evidence");
  assert.equal(result.statusHome.nextStep.copyableCommand, "dove.auto");
  assert.equal(runtimeNextAction.rank, 1);
  assert.ok(runtimeNextAction.relatedActionCount >= 1);
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
  assert.match(humanStatus.stdout, /Dove/);
  assert.doesNotMatch(humanStatus.stdout, /^Dove: /m);
  assert.doesNotMatch(humanStatus.stdout, /^Next: /m);
  assert.doesNotMatch(humanStatus.stdout, /^Why: /m);
  assert.doesNotMatch(humanStatus.stdout, /^More: /m);
  assert.match(humanStatus.stdout, /真实结果|implementation evidence/);
  assert.doesNotMatch(humanStatus.stdout, /\bruntime-progress\b/);
  assert.doesNotMatch(humanStatus.stdout, /--packet-id\b/);
  assert.doesNotMatch(humanStatus.stdout, /Dove current situation:/);
  assert.doesNotMatch(humanStatus.stdout, /Current context:/);
  assert.doesNotMatch(humanStatus.stdout, /Boundary\/gap:/);
  assert.doesNotMatch(humanStatus.stdout, /Required evidence:/);
  assert.doesNotMatch(humanStatus.stdout, /Writes:/);
  assert.doesNotMatch(humanStatus.stdout, /packet: runtime-progress/);
  assert.doesNotMatch(humanStatus.stdout, /boundary: awaiting-host-pass/);
  assert.doesNotMatch(humanStatus.stdout, /boundary: host-tool-blocked/);
  assert.doesNotMatch(humanStatus.stdout, /boundary: awaiting-host-pass-result/);

  const healthStatus = spawnSync("node", [CLI, "status", root, "--health"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(healthStatus.status, 0, healthStatus.stderr || healthStatus.stdout);
  assert.match(healthStatus.stdout, /Dove/);
  assert.doesNotMatch(healthStatus.stdout, /^Dove: /m);
  assert.doesNotMatch(healthStatus.stdout, /^Next: /m);
  assert.doesNotMatch(healthStatus.stdout, /^Why: /m);
  assert.doesNotMatch(healthStatus.stdout, /^More: /m);
  assert.match(healthStatus.stdout, /健康检查|health check/);
  assert.doesNotMatch(healthStatus.stdout, /Intent: health-check/);
  assert.doesNotMatch(healthStatus.stdout, /Health-check required evidence:/);
  assert.doesNotMatch(healthStatus.stdout, /backlog boundary requires:/);
  assert.doesNotMatch(healthStatus.stdout, /boundary: host-tool-blocked/);
  assert.doesNotMatch(healthStatus.stdout, /boundary: awaiting-host-pass-result/);
  assert.doesNotMatch(healthStatus.stdout, /\nRequired evidence:/);

  assert.doesNotMatch(humanStatus.stdout, /Pre-action guidance:/);
  assert.doesNotMatch(humanStatus.stdout, /guardrails: writes require confirmation; no hidden runtime/);
  assert.doesNotMatch(humanStatus.stdout, /Next steps:/);
  assert.doesNotMatch(humanStatus.stdout, /Recent execution receipts:/);
  assert.doesNotMatch(humanStatus.stdout, /Gaps and boundaries:/);
  assert.doesNotMatch(humanStatus.stdout, /Project state:/);
  assert.doesNotMatch(humanStatus.stdout, /mission summary:/);
  assert.doesNotMatch(humanStatus.stdout, /Mission details:|任务选择：/);
  assert.doesNotMatch(humanStatus.stdout, /Priority lane:|优先处理：/);
  assert.doesNotMatch(humanStatus.stdout, /Machine statuses:/);
  assert.doesNotMatch(humanStatus.stdout, /runtime-progress: Runtime progress mission \[doing\]/);
  assert.doesNotMatch(humanStatus.stdout, /deliver:/);
  assert.doesNotMatch(humanStatus.stdout, /done:/);

  const humanStatusWithMissions = spawnSync("node", [CLI, "status", root, "--missions"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(humanStatusWithMissions.status, 0, humanStatusWithMissions.stderr || humanStatusWithMissions.stdout);
  assert.match(humanStatusWithMissions.stdout, /任务选择：/);
  assert.match(humanStatusWithMissions.stdout, /优先处理：/);
  assert.match(humanStatusWithMissions.stdout, /队列概览：doing 1，blocked 1，todo 2，done 3/);
  assert.match(humanStatusWithMissions.stdout, /任务预览：/);
  assert.match(humanStatusWithMissions.stdout, /Runtime progress mission \[doing\]/);
  assert.match(humanStatusWithMissions.stdout, /需要：.*implementation evidence.*provide-host-pass-result/);
  assert.match(humanStatusWithMissions.stdout, /下一步：.*先为当前任务补/);
  assert.match(humanStatusWithMissions.stdout, /doing: 1/);
  assert.match(humanStatusWithMissions.stdout, /Runtime progress mission \[doing\]/);
  assert.match(humanStatusWithMissions.stdout, /blocked: 1/);
  assert.match(humanStatusWithMissions.stdout, /Blocked by unresolved dependency \[blocked\]/);
  assert.match(humanStatusWithMissions.stdout, /受阻：等待前置任务/);
  assert.match(humanStatusWithMissions.stdout, /todo: 2/);
  assert.match(humanStatusWithMissions.stdout, /Plain pending mission \[todo\]/);
  assert.match(humanStatusWithMissions.stdout, /done: 3（另有 3 个）/);
  assert.match(humanStatusWithMissions.stdout, /如果还要完整治理细节，请明确提出。/);
  assert.doesNotMatch(humanStatusWithMissions.stdout, /boundary: awaiting-host-pass/);
  assert.doesNotMatch(humanStatusWithMissions.stdout, /unresolved-dependencies:/);
  assert.doesNotMatch(humanStatusWithMissions.stdout, /runtime-progress:|blocked-dependency:|plain-pending:/);
  assert.doesNotMatch(humanStatusWithMissions.stdout, /--packet-id|--full --json|project:dove/);

  for (const extraArgs of [["--include-mission-details"], ["--detail", "missions"], ["--detail", "mission-details"], ["--detail", "mission-list"]]) {
    const expandedHumanStatus = spawnSync("node", [CLI, "status", root, ...extraArgs], {
      cwd: ROOT,
      encoding: "utf8"
    });
    assert.equal(expandedHumanStatus.status, 0, expandedHumanStatus.stderr || expandedHumanStatus.stdout);
    assert.match(expandedHumanStatus.stdout, /任务选择：/);
    assert.match(expandedHumanStatus.stdout, /Runtime progress mission \[doing\]/);
    assert.doesNotMatch(expandedHumanStatus.stdout, /runtime-progress:|--packet-id|--full --json|project:dove/);
  }

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
  assert.match(humanStatusline.stdout, /gaps /);
  assert.doesNotMatch(humanStatusline.stdout, /missions open/);
  assert.doesNotMatch(humanStatusline.stdout, /receipt/);
  assert.doesNotMatch(humanStatusline.stdout, /active \d+/);
  assert.doesNotMatch(humanStatusline.stdout, /^\{/);
  assert.doesNotMatch(humanStatusline.stdout, /Status adjustments:/);
  assert.equal(machineStatusline.status, 0, machineStatusline.stderr || machineStatusline.stdout);
  const parsedStatusline = JSON.parse(machineStatusline.stdout);
  assert.equal(parsedStatusline.mode, "dove-statusline");
  assert.equal(parsedStatusline.proposalOnly, true);
  assert.equal(parsedStatusline.noAutoApply, true);
  assert.deepEqual(parsedStatusline.writes, []);
  assert.equal("openMissionCount" in parsedStatusline.summary, false);
  assert.equal("todoMissionCount" in parsedStatusline.summary, false);
  assert.equal("doingMissionCount" in parsedStatusline.summary, false);
  assert.equal("blockedMissionCount" in parsedStatusline.summary, false);
  assert.equal("archivedMissionCount" in parsedStatusline.summary, false);
  assert.equal("archivedHiddenMissionCount" in parsedStatusline.summary, false);
  assert.equal("nextActions" in parsedStatusline, false);
  assert.equal("nextActionCount" in parsedStatusline.summary, false);
  assert.equal("activeMissionCount" in parsedStatusline.summary, false);
  assert.ok(parsedStatusline.summary.gaps);
  assert.match(parsedStatusline.text, /gaps /);
  assert.doesNotMatch(parsedStatusline.text, /missions open/);
  assert.doesNotMatch(parsedStatusline.text, /receipt/);
  assert.doesNotMatch(parsedStatusline.text, /active \d+/);
  assert.deepEqual(afterStatusline, beforeStatusline);

  const statusAdjustmentItems = Object.fromEntries(archivedFullResult.statusAdjustmentContract.items.map((item) => [item.packetId, item]));
  assert.equal("statusAdjustmentContract" in result, false);
  assert.equal("statusAdjustmentPreview" in result.statusHome, false);
  assert.equal(result.statusHome.showMore.statusAdjustmentsAvailable, true);
  const expandedStatusAdjustmentPreview = expandedResult.statusHome.statusAdjustmentPreview;
  assert.deepEqual(expandedStatusAdjustmentPreview.statusChoices, ["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"]);
  assert.equal(expandedStatusAdjustmentPreview.statusAdjustmentItemsIncluded, true);
  assert.equal(expandedStatusAdjustmentPreview.adjustmentCards.length, expandedStatusAdjustmentPreview.items.length);
  assert.ok(expandedStatusAdjustmentPreview.adjustmentCards.every((card) => card.presentation === "compact-status-adjustment-card"));
  assert.equal(Boolean(statusAdjustmentItems["status-packet"]), true);
  assert.equal(Boolean(statusAdjustmentItems["plain-pending"]), true);
  assert.equal(Boolean(statusAdjustmentItems["blocked-dependency"]), true);
  assert.equal(Boolean(statusAdjustmentItems["runtime-progress"]), true);
  assert.equal(Boolean(statusAdjustmentItems["runtime-completed"]), true);
  assert.equal(Boolean(statusAdjustmentItems["zz-status-completed"]), false);
  assert.equal(Boolean(statusAdjustmentItems["zz-status-killed"]), false);
  assert.equal(Boolean(statusAdjustmentItems["zz-status-archived"]), false);
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
  assert.equal("diagnostics" in result, false);
  assert.equal(fullResult.diagnostics.derivedReports.navigationReportPath, ARTIFACT_PATHS.navigationReport);
  assert.equal(fullResult.diagnostics.primaryStateSources.includes(ARTIFACT_PATHS.taskPacketsPacketsDir), true);
  assert.equal(fullResult.diagnostics.primaryStateSources.includes(ARTIFACT_PATHS.runtimeContinuation), true);
  assert.equal(fullResult.diagnostics.primaryStateSources.includes(ARTIFACT_PATHS.runtimeEvents), true);
  assert.equal(fullResult.diagnostics.primaryStateSources.includes(ARTIFACT_PATHS.runtimeResults), true);
  assert.equal(fullResult.diagnostics.mayRefreshDerivedSurfaces, false);
  assert.equal(fullResult.diagnostics.noCommandExecution, true);
  assert.equal(fullResult.diagnostics.noExternalProcess, true);
  assert.equal(fullResult.diagnostics.noGitInspection, true);
  assert.equal("gitInspection" in fullResult.diagnostics, false);
  assert.equal(fullResult.diagnostics.noSourceMutation, true);
});

test("queryDoveStatus routes executable workflow gaps before mission details", () => {
  const root = tempRoot();
  ensureTestWorkspace(root);

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

  assert.equal(fullResult.projectSummary.returnStatus, "blocked");
  assertPublicCompactStatus(result);
  assert.equal(result.statusHome.needsAttention.status, "blocked");
  assert.equal(result.statusHome.needsAttention.needs.includes("executionContract"), true);
  assert.deepEqual(fullResult.dailyHome.executionGaps.counts, {
    missingContract: 1,
    missingMaterials: 1,
    verificationGaps: 1,
    readyBuilder: 0,
    blocking: 3
  });
  assert.deepEqual(fullResult.dailyHome.executionGaps.missingContractTaskIds, ["aa-missing-contract"]);
  assert.deepEqual(fullResult.dailyHome.executionGaps.missingMaterialTaskIds, ["bb-missing-material"]);
  assert.deepEqual(fullResult.dailyHome.executionGaps.verificationGapTaskIds, ["cc-verification-gap"]);
  const recoveryAction = fullResult.dailyHome.nextActions[0];
  assert.equal(recoveryAction.kind, "recover-current-work");
  assert.equal(recoveryAction.recoveryPrimaryKind, "missing-executable-contract");
  assert.equal(recoveryAction.packetId, "aa-missing-contract");
  assert.deepEqual(recoveryAction.relatedActionKinds, [
    "missing-executable-contract",
    "missing-required-materials",
    "verification-failed"
  ]);
  assert.equal(recoveryAction.relatedActionCount, 3);
  assert.deepEqual(recoveryAction.detail.candidates.map((card) => card.packetId), [
    "aa-missing-contract",
    "bb-missing-material",
    "cc-verification-gap"
  ]);
  assert.equal(result.statusHome.nextStep.command, "dove.mission");
  assert.equal(result.statusHome.nextStep.copyableCommand, "dove.mission");
  assert.equal("nextRole" in result.statusHome.nextStep, false);
  assert.equal("evidenceRequired" in result.statusHome.nextStep, false);
  assert.equal(recoveryAction.detail.candidates[1].nextRole, "planner");
  assert.deepEqual(recoveryAction.detail.candidates[1].requiredMaterials, ["sources/cvpr-template.md"]);
  assert.equal(recoveryAction.detail.candidates[2].nextRole, "reviewer");
  assert.deepEqual(recoveryAction.detail.candidates[2].criteriaCoverage.missing, ["Verification gap criterion"]);
  assert.equal("optionalMissionDetails" in result.statusHome, false);
  assert.equal("preActionGuidance" in result.statusHome, false);
  assert.equal(fullResult.preActionGuidance.mode, "read-only-guidance");
  assert.equal(fullResult.preActionGuidance.workflowFrame.executionGuidance.nextRole, "planner");
  assert.deepEqual(fullResult.preActionGuidance.workflowFrame.executionGuidance.missingContractTaskIds, ["aa-missing-contract"]);
  assert.deepEqual(fullResult.preActionGuidance.workflowFrame.executionGuidance.missingMaterialTaskIds, ["bb-missing-material"]);
  assert.deepEqual(fullResult.preActionGuidance.workflowFrame.executionGuidance.verificationGapTaskIds, ["cc-verification-gap"]);
  assert.equal(fullResult.preActionGuidance.lessonRecall.readOnly, true);
});

test("CLI status omits fallback status command for material recovery", () => {
  const root = tempRoot();
  ensureTestWorkspace(root);

  writeTaskPacket(root, {
    id: "dove-global-init",
    title: "Dove goal",
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
    id: "material-only",
    title: "Material only task",
    summary: "The operator must provide source material before execution.",
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
      materials: { requiredInputs: ["sources/template.md"] },
      convergence: { criteria: ["Material criterion"] }
    }),
    nextAction: "project:dove.status"
  });

  const result = queryDoveStatus(root, { domain: "engineering" });
  const fullResult = queryDoveStatus(root, { domain: "engineering", detail: "full" });
  const recoveryAction = fullResult.dailyHome.nextActions[0];
  assert.equal(recoveryAction.kind, "recover-current-work");
  assert.equal(recoveryAction.recoveryPrimaryKind, "missing-required-materials");
  assert.equal(recoveryAction.command, null);
  assert.equal(recoveryAction.copyableCommand, null);
  assert.equal(result.statusHome.nextStep.label, "先为当前任务补材料：sources/template.md");
  assert.equal("copyableCommand" in result.statusHome.nextStep, false);

  const humanStatus = spawnSync("node", [CLI, "status", root], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(humanStatus.status, 0, humanStatus.stderr || humanStatus.stdout);
  assert.match(humanStatus.stdout, /先为当前任务补材料：sources\/template\.md/);
  assert.doesNotMatch(humanStatus.stdout, /\bmaterial-only\b/);
  assert.doesNotMatch(humanStatus.stdout, /^Next: /m);
  assert.doesNotMatch(humanStatus.stdout, /project:dove\.status/);
});

test("queryDoveMission frames an engineering mission without writing artifacts", () => {
  const root = tempRoot();
  ensureTestWorkspace(root);

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
  ensureTestWorkspace(root);

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
  ensureTestWorkspace(root);

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
  ensureTestWorkspace(statusRoot);
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
  ensureTestWorkspace(autoRoot);
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
  ensureTestWorkspace(root);
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
  ensureTestWorkspace(root);

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
  ensureTestWorkspace(root);
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
  ensureTestWorkspace(root);
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
  ensureTestWorkspace(root);
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
  ensureTestWorkspace(root);
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
  ensureTestWorkspace(root);
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
  ensureTestWorkspace(root);
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
  ensureTestWorkspace(root);
  const { pack, packetPath } = seedDoveLaunchGuidance(root);

  const result = runFixtureMutation(root, "launch-dove-mission", () => launchDoveMission(root, {
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
  }));

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
  ensureTestWorkspace(root);
  const { pack, packetPath } = seedDoveLaunchGuidance(root);
  fs.mkdirSync(path.join(root, ".paper", "workspace"), { recursive: true });
  fs.writeFileSync(path.join(root, ".paper", "workspace", "index.json"), "{}\n", "utf8");

  const result = runFixtureMutation(root, "launch-dove-mission", () => launchDoveMission(root, {
    sourceType: "remediation-pack",
    sourceId: pack.id,
    actorRole: "planner",
    domain: "engineering",
    stage: "execution",
    selectedConversionPathKey: packetPath?.deterministicKey ?? null,
    packetId: packetPath?.targetId ?? "task-dove-launch",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }));

  assert.equal(result.status, "materialized");
  assert.deepEqual(result.diagnostics.staleLegacyAuthorityArtifacts, [".paper/workspace/index.json"]);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.taskPacketsPacketsDir, `${packetPath?.targetId ?? "task-dove-launch"}.json`)), true);
});

test("CLI Dove orchestrate, mission, status, audit, and return commands expose proposal-only JSON", () => {
  const root = tempRoot();
  ensureTestWorkspace(root);

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
    "--acceptance-check", "tests or validation output",
    "--json"
  ], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(mission.status, 0, mission.stderr || mission.stdout);
  const missionPayload = JSON.parse(mission.stdout);
  assert.equal(missionPayload.status, "needs-confirmation");
  assert.equal(missionPayload.workflowMode, "mission-contract");
  assert.equal(missionPayload.proposalOnly, true);
  assert.deepEqual(missionPayload.writes, []);
  assert.equal(missionPayload.proposedTask.domain, "engineering");
  assert.equal(missionPayload.proposedTask.stage, "execute");
  assert.deepEqual(missionPayload.proposedTask.artifactRefs, ["bin/dove.mjs"]);

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
  assertPublicCompactStatus(statusPayload);
  assert.equal(statusPayload.scope.domain, "engineering");
  assert.equal(statusPayload.currentContext.domain, "engineering");
  assert.equal(statusPayload.dashboard, undefined);
  assert.equal(statusPayload.board, undefined);
  assert.equal(statusPayload.navigation, undefined);
  assert.equal(statusPayload.diagnostics, undefined);
  assert.equal(statusPayload.showMore.detailsAvailable, true);

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
