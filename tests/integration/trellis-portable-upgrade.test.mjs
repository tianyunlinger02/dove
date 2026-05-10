import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  appendHandoff,
  ensureWorkspace,
  initProject,
  queryBoundaryReport,
  queryDecisions,
  queryLineage,
  queryMetaOptimize,
  queryOpenQuestions,
  queryOperatorLessons,
  queryTaskGraph,
  queryWorkspaceIndex,
  refreshWiki,
  readActionContextBundle,
  readArtifactContextManifest,
  readPacketContextManifest,
  readPhaseContextManifest,
  readRoleContextManifest,
  recordOperatorLesson,
  registerSource,
  summarizeSessionJournal,
  upsertClaims,
  upsertExperimentPlan,
  upsertNote,
  upsertOrchestrationBoard,
  writeJson
} from "../../src/core/index.mjs";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dove-trellis-"));
}

function seedTaskPacket(root, packetId = "trellis-main-packet") {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: packetId,
    title: "Portable Trellis integration packet",
    summary: "Integration test packet for task-scoped writes.",
    sourceType: "test-task",
    sourceId: packetId,
    status: "pending",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    currentFocus: "Run the portable Trellis integration flow.",
    nextAction: "Continue the scoped Trellis flow.",
    evidenceLinks: [],
    outputPaths: [],
    packetPath: `.dove/task-packets/packets/${packetId}.json`,
    packetContextPath: `.dove/context/packets/${packetId}.json`,
    updatedAt: timestamp
  };
  fs.mkdirSync(path.join(root, ".dove", "task-packets", "packets"), { recursive: true });
  fs.writeFileSync(path.join(root, packet.packetPath), `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(root, ".dove", "task-packets", "index.json"), `${JSON.stringify({ version: 3, items: [packet], lifecycleCounts: {}, dependencyHealth: {}, updatedAt: timestamp }, null, 2)}\n`, "utf8");
  return packetId;
}

test("portable Trellis-inspired surfaces stay file-first and durable", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, {
    title: "Portable Trellis Upgrade",
    objective: "Exercise durable task packets and context manifests.",
    thesis: "Portable packetized workflow improves resumability."
  });
  seedTaskPacket(root);

  const source = registerSource(root, {
    citationKey: "packet-source",
    title: "Task Packet Paper",
    authors: ["Ng"],
    year: 2026
  });
  const note = upsertNote(root, {
    title: "Packet note",
    sectionId: "introduction",
    sourceIds: [source.id],
    summary: "Task packets keep work portable.",
    openQuestions: ["Which role should own follow-up validation?"]
  });
  upsertClaims(root, {
    claims: [{
      id: "claim-packets",
      text: "Task packets improve resumability.",
      sectionId: "introduction",
      sourceIds: [source.id],
      noteIds: [note.id]
    }]
  });
  appendHandoff(root, {
    fromRole: "planner",
    toRole: "experiment-planner",
    phase: "experiments",
    summary: "Move into experiment planning for the packet validation flow.",
    nextActions: ["Write the packet validation experiment"]
  });
  upsertExperimentPlan(root, {
    id: "packet-exp",
    title: "Packet validation experiment",
    claimId: "claim-packets",
    methodology: "Inspect durable packet lineage",
    successMetric: "Linked packets remain queryable"
  });
  upsertOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "researcher",
    tasks: [{
      id: "packet-review-task",
      title: "Validate packet linkage",
      assignedRole: "reviewer",
      status: "in-progress",
      claimIds: ["claim-packets"],
      noteIds: [note.id],
      experimentIds: ["packet-exp"],
      questions: ["Do the query surfaces expose packet lineage cleanly?"],
      decisions: [{ summary: "Keep packet artifacts file-first.", rationale: "Hidden runtime state is out of scope." }]
    }]
  });

  const taskGraph = queryTaskGraph(root);
  const questions = queryOpenQuestions(root);
  const decisions = queryDecisions(root);
  const lineage = queryLineage(root);
  const boundaryReport = queryBoundaryReport(root);
  const workspaceIndex = queryWorkspaceIndex(root);
  const reviewerManifest = readRoleContextManifest(root, "reviewer");
  const phaseManifest = readPhaseContextManifest(root, "research");
  const packetManifest = readPacketContextManifest(root, "task-packet-review-task");
  const artifactManifest = readArtifactContextManifest(root, ".dove/orchestration/board.json");
  const currentActionBundle = readActionContextBundle(root);
  const packetActionBundle = readActionContextBundle(root, { scopeType: "packet", packetId: "task-packet-review-task" });
  const sessionSummary = summarizeSessionJournal(root);

  assert.ok(taskGraph.nodes.some((node) => node.id === "task-packet-review-task"));
  assert.equal(taskGraph.nodes.find((node) => node.id === "task-packet-review-task").lifecycleStatus, "ready-for-handoff");
  assert.ok(questions.items.some((item) => /follow-up validation|packet lineage/i.test(item.summary)));
  assert.ok(decisions.items.some((item) => /file-first/i.test(item.summary) || /Current role owner/i.test(item.summary)));
  assert.ok(Array.isArray(lineage.lineage));
  assert.ok(Array.isArray(boundaryReport.missingBootstrapArtifacts));
  assert.ok(Array.isArray(boundaryReport.userOwnedExistingPaths));
  assert.ok(reviewerManifest.contextPaths.includes(".dove/task-packets/index.json"));
  assert.ok(reviewerManifest.activeTaskPacketIds.includes("task-packet-review-task"));
  assert.ok(reviewerManifest.packetContextPaths.includes(".dove/context/packets/task-packet-review-task.json"));
  assert.ok(reviewerManifest.handoffCandidateIds.includes("task-packet-review-task"));
  assert.ok(reviewerManifest.preActionReadPaths.includes(".dove/context/actions/role-reviewer.json"));
  assert.equal(packetManifest.packetId, "task-packet-review-task");
  assert.equal(packetManifest.lifecycleStatus, "ready-for-handoff");
  assert.equal(packetManifest.lifecycleFamily, "concern");
  assert.equal(packetManifest.taskWorkspaceCoupling.workspaceIndexPath, ".dove/workspace/index.json");
  assert.ok(packetManifest.linkedIds.claims.includes("claim-packets"));
  assert.ok(packetManifest.linkedArtifacts.includes(".dove/context/packets/task-packet-review-task.json"));
  assert.ok(packetManifest.linkedArtifacts.includes(".dove/task-packets/packets/task-packet-review-task.json"));
  assert.ok(packetManifest.preActionReadPaths.includes(".dove/context/actions/packet-task-packet-review-task.json"));
  assert.equal(packetManifest.dependencyHealth.state, "clear");
  assert.equal(phaseManifest.phaseId, "research");
  assert.ok(phaseManifest.preActionReadPaths.includes(".dove/context/actions/phase-research.json"));
  assert.equal(artifactManifest.artifactPath, ".dove/orchestration/board.json");
  assert.equal(artifactManifest.category, "orchestration");
  assert.equal(artifactManifest.lifecycleFamily, "work-unit");
  assert.equal(artifactManifest.doveLifecycle.familyId, "work-unit");
  assert.ok(artifactManifest.readBeforeMutating.includes(".dove/workspace/index.json"));
  assert.equal(currentActionBundle.scopeType, "current");
  assert.ok(currentActionBundle.requiredReadPaths.includes(".dove/context/actions/current.json"));
  assert.equal(packetActionBundle.scopeType, "packet");
  assert.equal(packetActionBundle.packetId, "task-packet-review-task");
  assert.ok(workspaceIndex.handoffObligations.some((item) => item.packetId === "task-packet-review-task"));
  assert.ok(workspaceIndex.resumeGuidance.prioritizedPacketIds.includes("task-packet-review-task"));
  assert.ok(workspaceIndex.resumeGuidance.packetContextPaths.includes(".dove/context/packets/task-packet-review-task.json"));
  assert.equal(workspaceIndex.lifecycle.boardFamily, "objective");
  assert.equal(workspaceIndex.lifecycle.packetCounts.concern >= 1, true);
  assert.equal(workspaceIndex.lifecycle.topFamilies.includes("concern"), true);
  assert.equal(workspaceIndex.repairFrontier.count, 1);
  assert.equal(workspaceIndex.repairFrontier.governanceIssueCount, 1);
  assert.ok(workspaceIndex.repairFrontier.prioritizedItems.some((item) => item.frontierType === "workflow-governance"));
  assert.equal(workspaceIndex.contextSurfaces.currentActionContextPath, ".dove/context/actions/current.json");
  assert.ok(workspaceIndex.contextSurfaces.prioritizedArtifactContextPaths.some((item) => item.endsWith("orchestration-board-json.json")));
  assert.ok(workspaceIndex.behaviorDiscipline.requiredReadOrder.includes(".dove/context/actions/current.json"));
  assert.ok(phaseManifest.queueSummary.handoff.includes("task-packet-review-task"));
  assert.ok(phaseManifest.contextPaths.includes(".dove/context/packets/task-packet-review-task.json"));
  assert.equal(reviewerManifest.operatorGuidance.repairFrontier.governanceIssueCount, 1);
  assert.equal(currentActionBundle.operatorGuidance.repairFrontier.governanceIssueCount, 1);
  assert.equal(sessionSummary.summaryPath, ".dove/sessions/LATEST_SUMMARY.md");
  assert.ok(fs.existsSync(path.join(root, ".dove", "wiki", "navigation.md")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "task-packets", "packets", "task-packet-review-task.json")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "context", "packets", "task-packet-review-task.json")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "context", "artifacts", "dove-orchestration-board-json.json")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "context", "actions", "current.json")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "context", "roles", "reviewer.json")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "sessions", "journal.json")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "workflow-pack", "boundaries.json")));
});

test("operator lessons persist durable retrospectives without importing raw Trellis traces", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, {
    title: "Portable Lessons",
    objective: "Preserve reusable task experience without raw task traces.",
    thesis: "Distilled lessons are more portable than raw runtime logs."
  });
  fs.mkdirSync(path.join(root, ".trellis", "tasks", "raw-example"), { recursive: true });
  fs.writeFileSync(path.join(root, ".trellis", "tasks", "raw-example", "task.json"), "{\"raw\":true}\n", "utf8");

  const recorded = recordOperatorLesson(root, {
    title: "Prefer durable Dove summaries over raw traces",
    problem: "Raw Trellis task traces are too verbose and local to reuse directly.",
    decisions: ["Store a concise retrospective in Dove."],
    pitfalls: ["Do not cite ignored raw task traces."],
    validation: ["Query the lessons index and inspect surfaced summaries."],
    nextTime: ["Record lessons at task return before cleanup."],
    domain: "engineering",
    stage: "return",
    actorRole: "planner",
    tags: ["portable", "retrospective"],
    sourceArtifacts: [ARTIFACT_PATHS.sessionSummary, ARTIFACT_PATHS.workspaceIndex]
  });

  assert.equal(recorded.summary.activeLessonCount, 1);
  assert.throws(() => recordOperatorLesson(root, {
    title: "Bad raw trace lesson",
    problem: "Raw traces should not be lesson sources.",
    decisions: ["Reject trace paths."],
    pitfalls: ["Trace logs are not durable knowledge."],
    validation: ["Recording fails."],
    nextTime: ["Use curated Dove surfaces."],
    sourceArtifacts: [".trellis/tasks/raw-example/task.json"]
  }), /\.trellis\/tasks/);

  const queried = queryOperatorLessons(root, { tag: "portable" });
  const workspaceIndex = queryWorkspaceIndex(root);
  const metaOptimize = queryMetaOptimize(root);
  const currentActionBundle = readActionContextBundle(root);
  const sessionSummary = summarizeSessionJournal(root);
  const lessonsFileText = fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorLessons), "utf8");
  const navigation = fs.readFileSync(path.join(root, ARTIFACT_PATHS.navigationReport), "utf8");
  const sessionSummaryText = fs.readFileSync(path.join(root, ARTIFACT_PATHS.sessionSummary), "utf8");

  assert.equal(queried.resultCount, 1);
  assert.equal(queried.lessons[0].title, "Prefer durable Dove summaries over raw traces");
  assert.equal(workspaceIndex.metaOptimize.operatorLessons.activeLessonCount, 1);
  assert.equal(workspaceIndex.metaOptimize.operatorLessons.lessonsPath, ARTIFACT_PATHS.metaOperatorLessons);
  assert.equal(metaOptimize.operatorLessons.summary.activeLessonCount, 1);
  assert.equal(metaOptimize.operatorLessonsPath, ARTIFACT_PATHS.metaOperatorLessons);
  assert.equal(currentActionBundle.operatorGuidance.operatorLessons.summary.activeLessonCount, 1);
  assert.equal(currentActionBundle.operatorGuidance.operatorLessons.topLessons.length >= 1, true);
  assert.equal(sessionSummary.summaryPath, ARTIFACT_PATHS.sessionSummary);
  assert.match(navigation, /Operator lessons:/);
  assert.match(sessionSummaryText, /Operator lessons:/);
  assert.doesNotMatch(lessonsFileText, /\.trellis\/tasks/);
});

test("remediation packs stay durable and visible through operator-facing surfaces", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, {
    title: "Remediation Pack Visibility",
    objective: "Expose durable remediation packs through workspace and meta surfaces.",
    thesis: "Proposal-only remediation packs should stay file-first."
  });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "pack-review-gap",
      summary: "A review concern remains unresolved.",
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
    openItems: ["Close the remediation pack review gap."],
    unresolvedConcernIds: ["pack-review-gap"],
    escalatedConcernIds: ["pack-review-gap"],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 3,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["researcher"], separationMaintained: true }
  });
  writeJson(root, ARTIFACT_PATHS.figureQa, {
    version: 1,
    items: [],
    issues: [{
      id: "pack-figure-issue",
      figureId: "figure-pack",
      code: "missing-final-svg",
      severity: "high",
      summary: "Final SVG is still missing.",
      artifactPaths: [ARTIFACT_PATHS.figureQa]
    }],
    updatedAt: null
  });

  const metaOptimize = queryMetaOptimize(root);
  const workspaceIndex = queryWorkspaceIndex(root);
  const navigation = fs.readFileSync(path.join(root, ARTIFACT_PATHS.navigationReport), "utf8");
  const sessionSummaryText = fs.readFileSync(path.join(root, ARTIFACT_PATHS.sessionSummary), "utf8");
  const operatorPlaybooksFile = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorPlaybooks), "utf8"));
  const remediationPackFile = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaRemediationPacks), "utf8"));
  const researcherManifest = readRoleContextManifest(root, "researcher");
  const phaseManifest = readPhaseContextManifest(root, workspaceIndex.boardPhase);
  const currentActionBundle = readActionContextBundle(root);

  assert.equal(metaOptimize.remediationPacks.proposalOnly, true);
  assert.equal(metaOptimize.remediationPacks.summary.packCount >= 1, true);
  assert.equal(remediationPackFile.summary.packCount, metaOptimize.remediationPacks.summary.packCount);
  assert.equal(remediationPackFile.packs[0].proposalOnly, true);
  assert.equal(remediationPackFile.packs[0].noAutoApply, true);
  assert.equal(remediationPackFile.packs[0].reviewConcerns.some((item) => item.id === "pack-review-gap"), true);
  assert.equal(remediationPackFile.packs.some((pack) => pack.figureQa.some((item) => item.id === "pack-figure-issue")), true);
  assert.equal(remediationPackFile.packs[0].workspacePointers.includes(ARTIFACT_PATHS.workspaceIndex), true);
  assert.equal(remediationPackFile.packs[0].manualNextActions.length > 0, true);
  assert.equal(operatorPlaybooksFile.summary.playbookCount, 0);
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.packCount, remediationPackFile.summary.packCount);
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.packsPath, ARTIFACT_PATHS.metaRemediationPacks);
  assert.equal(workspaceIndex.metaOptimize.operatorPlaybooks.playbookCount, operatorPlaybooksFile.summary.playbookCount);
  assert.equal(researcherManifest.operatorGuidance.remediationPack.id, remediationPackFile.packs[0].id);
  assert.equal(researcherManifest.operatorGuidance.remediationPack.acceptanceCriteria.length > 0, true);
  assert.equal(researcherManifest.operatorGuidance.remediationPack.conversionHints.length > 0, true);
  assert.equal(researcherManifest.operatorGuidance.remediationPack.rankedConversionPaths.length > 0, true);
  assert.equal(["actionable", "partially-actionable", "advisory-only"].includes(researcherManifest.operatorGuidance.remediationPack.readiness.operatorReadiness), true);
  assert.equal(researcherManifest.operatorGuidance.remediationPack.manualNextActions.length > 0, true);
  assert.equal(researcherManifest.operatorGuidance.familyPlaybook, null);
  assert.equal(phaseManifest.operatorGuidance.remediationPack.id, remediationPackFile.packs[0].id);
  assert.equal(phaseManifest.operatorGuidance.familyPlaybook, null);
  assert.equal(currentActionBundle.operatorGuidance.remediationPack.id, remediationPackFile.packs[0].id);
  assert.equal(currentActionBundle.operatorGuidance.familyPlaybook, null);
  assert.match(currentActionBundle.operatorGuidance.taxonomyPressure.overview, /typed wiki taxonomy pressure/i);
  assert.match(navigation, /Remediation packs:/);
  assert.match(navigation, /Remediation pack readiness:/);
  assert.match(navigation, /Family playbooks:/);
  assert.match(navigation, /Family playbook readiness:/);
  assert.match(navigation, /Remediation packs path:/);
  assert.match(navigation, /Family playbooks path:/);
  assert.match(sessionSummaryText, /Remediation packs:/);
  assert.match(sessionSummaryText, /Remediation pack readiness:/);
  assert.match(sessionSummaryText, /Family playbooks:/);
  assert.match(sessionSummaryText, /Family playbook readiness:/);
  assert.match(sessionSummaryText, /Remediation packs path:/);
  assert.match(sessionSummaryText, /Family playbooks path:/);
  assert.ok(fs.existsSync(path.join(root, ".dove", "meta", "remediation-packs.json")));
  assert.ok(fs.existsSync(path.join(root, ".dove", "meta", "operator-playbooks.json")));
});

test("playbook artifact update maps stay durable and visible through operator-facing surfaces", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Artifact Update Maps", objective: "Expose playbook-driven artifact target lists without auto-applying updates." });
  seedTaskPacket(root);

  registerSource(root, { citationKey: "artifact-map-source", title: "Artifact Map Source", authors: ["Kim"], year: 2026 });
  upsertNote(root, { noteId: "artifact-map-note", title: "Artifact map note", sectionId: "method", sourceIds: ["artifact-map-source"], summary: "Artifact target maps should be explicit." });
  writeJson(root, ARTIFACT_PATHS.sources, {
    version: 1,
    items: [{ id: "experiment-artifact-map-exp", citationKey: "artifact-map-exp-source", title: "Wrong endpoint type", authors: [], year: 2026, sourceType: "paper", abstract: "", origin: "manual", addedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{
      id: "claim-artifact-map",
      text: "Artifact update maps should surface concrete targets for validation-loop repair.",
      sectionId: "experiments",
      status: "supported",
      confidence: "medium",
      sourceIds: ["missing-source"],
      noteIds: ["missing-note"],
      experimentIds: ["artifact-map-exp"]
    }],
    updatedAt: null
  });

  refreshWiki(root);

  const metaOptimize = queryMetaOptimize(root);
  const executionBridgeFile = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaExecutionBridgeCandidates), "utf8"));
  const operatorPlaybooksFile = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorPlaybooks), "utf8"));
  const currentActionBundle = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.actionContextsDir, "current.json"), "utf8"));
  const report = fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerReport), "utf8");

  const validationPlaybook = operatorPlaybooksFile.playbooks.find((item) => item.taxonomyFamilyId === "validation-loop");
  assert.ok(validationPlaybook);
  assert.equal(executionBridgeFile.summary.candidateCount > 0, true);
  assert.equal(executionBridgeFile.candidates[0].proposalOnly, true);
  assert.equal(executionBridgeFile.candidates[0].noAutoApply, true);
  assert.equal(Array.isArray(executionBridgeFile.candidates[0].context.linkedWorkspacePointers), true);
  assert.equal(Array.isArray(executionBridgeFile.candidates[0].context.linkedRemediationPacks), true);
  assert.equal(validationPlaybook.artifactUpdateMap.targetCount > 0, true);
  assert.equal(validationPlaybook.artifactUpdateMap.updateOrder.length > 0, true);
  assert.equal(validationPlaybook.artifactUpdateMap.targets[0].rank, 1);
  assert.equal(currentActionBundle.operatorGuidance.executionBridgeCandidates.length > 0, true);
  assert.equal(Array.isArray(currentActionBundle.operatorGuidance.executionBridgeCandidates[0].context.linkedWorkspacePointers), true);
  assert.equal(currentActionBundle.operatorGuidance.familyPlaybook.artifactUpdateTargets.length > 0, true);
  assert.equal(currentActionBundle.operatorGuidance.familyPlaybook.artifactUpdateOrder.length > 0, true);
  assert.match(report, /Artifact update overview:/);
  assert.match(report, /Artifact update order:/);
  assert.match(report, /Execution bridge candidate scaffolds/);
});

test("task packet refresh preserves user-added fields and invalid role manifests fail fast", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, {
    title: "Packet Preservation",
    objective: "Verify packet preservation semantics.",
    thesis: "Preserving user packet fields avoids silent data loss."
  });

  upsertOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "researcher",
    tasks: [{ id: "preserve-task", title: "Preserve metadata", assignedRole: "researcher", status: "pending" }]
  });

  const packetPath = path.join(root, ".dove", "task-packets", "packets", "task-preserve-task.json");
  const packet = JSON.parse(fs.readFileSync(packetPath, "utf8"));
  packet.userMetadata = { owner: "human", tags: ["custom"] };
  fs.writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");

  const refreshed = queryTaskGraph(root);
  const preserved = refreshed.nodes.find((node) => node.id === "task-preserve-task");
  assert.deepEqual(preserved.userMetadata, { owner: "human", tags: ["custom"] });

  assert.throws(() => readRoleContextManifest(root, "ghost-role"), /Unknown roleId/);
});

test("boundary report exposes malformed boundary metadata instead of silently healing it", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  const boundaryPath = path.join(root, ".dove", "workflow-pack", "boundaries.json");
  fs.writeFileSync(boundaryPath, "{bad json", "utf8");

  const report = queryBoundaryReport(root);
  assert.equal(report.status, "invalid");
  assert.match(report.error, /Expected property name|Unexpected token|JSON/);
});
