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
  queryTaskGraph,
  queryWorkspaceIndex,
  readActionContextBundle,
  readArtifactContextManifest,
  readPacketContextManifest,
  readPhaseContextManifest,
  readRoleContextManifest,
  registerSource,
  summarizeSessionJournal,
  upsertClaims,
  upsertExperimentPlan,
  upsertNote,
  upsertOrchestrationBoard,
  writeJson
} from "../../src/core/index.mjs";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-trellis-"));
}

test("portable Trellis-inspired surfaces stay file-first and durable", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, {
    title: "Portable Trellis Upgrade",
    objective: "Exercise durable task packets and context manifests.",
    thesis: "Portable packetized workflow improves resumability."
  });

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
  const artifactManifest = readArtifactContextManifest(root, ".paper/orchestration/board.json");
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
  assert.ok(reviewerManifest.contextPaths.includes(".paper/task-packets/index.json"));
  assert.ok(reviewerManifest.activeTaskPacketIds.includes("task-packet-review-task"));
  assert.ok(reviewerManifest.packetContextPaths.includes(".paper/context/packets/task-packet-review-task.json"));
  assert.ok(reviewerManifest.handoffCandidateIds.includes("task-packet-review-task"));
  assert.ok(reviewerManifest.preActionReadPaths.includes(".paper/context/actions/role-reviewer.json"));
  assert.equal(packetManifest.packetId, "task-packet-review-task");
  assert.equal(packetManifest.lifecycleStatus, "ready-for-handoff");
  assert.equal(packetManifest.taskWorkspaceCoupling.workspaceIndexPath, ".paper/workspace/index.json");
  assert.ok(packetManifest.linkedIds.claims.includes("claim-packets"));
  assert.ok(packetManifest.linkedArtifacts.includes(".paper/context/packets/task-packet-review-task.json"));
  assert.ok(packetManifest.linkedArtifacts.includes(".paper/task-packets/packets/task-packet-review-task.json"));
  assert.ok(packetManifest.preActionReadPaths.includes(".paper/context/actions/packet-task-packet-review-task.json"));
  assert.equal(packetManifest.dependencyHealth.state, "clear");
  assert.equal(phaseManifest.phaseId, "research");
  assert.ok(phaseManifest.preActionReadPaths.includes(".paper/context/actions/phase-research.json"));
  assert.equal(artifactManifest.artifactPath, ".paper/orchestration/board.json");
  assert.equal(artifactManifest.category, "orchestration");
  assert.ok(artifactManifest.readBeforeMutating.includes(".paper/workspace/index.json"));
  assert.equal(currentActionBundle.scopeType, "current");
  assert.ok(currentActionBundle.requiredReadPaths.includes(".paper/context/actions/current.json"));
  assert.equal(packetActionBundle.scopeType, "packet");
  assert.equal(packetActionBundle.packetId, "task-packet-review-task");
  assert.ok(workspaceIndex.handoffObligations.some((item) => item.packetId === "task-packet-review-task"));
  assert.ok(workspaceIndex.resumeGuidance.prioritizedPacketIds.includes("task-packet-review-task"));
  assert.ok(workspaceIndex.resumeGuidance.packetContextPaths.includes(".paper/context/packets/task-packet-review-task.json"));
  assert.equal(workspaceIndex.repairFrontier.count, 1);
  assert.equal(workspaceIndex.repairFrontier.governanceIssueCount, 1);
  assert.ok(workspaceIndex.repairFrontier.prioritizedItems.some((item) => item.frontierType === "workflow-governance"));
  assert.equal(workspaceIndex.contextSurfaces.currentActionContextPath, ".paper/context/actions/current.json");
  assert.ok(workspaceIndex.contextSurfaces.prioritizedArtifactContextPaths.some((item) => item.endsWith("orchestration-board-json.json")));
  assert.ok(workspaceIndex.behaviorDiscipline.requiredReadOrder.includes(".paper/context/actions/current.json"));
  assert.ok(phaseManifest.queueSummary.handoff.includes("task-packet-review-task"));
  assert.ok(phaseManifest.contextPaths.includes(".paper/context/packets/task-packet-review-task.json"));
  assert.equal(reviewerManifest.operatorGuidance.repairFrontier.governanceIssueCount, 1);
  assert.equal(currentActionBundle.operatorGuidance.repairFrontier.governanceIssueCount, 1);
  assert.equal(sessionSummary.summaryPath, ".paper/sessions/LATEST_SUMMARY.md");
  assert.ok(fs.existsSync(path.join(root, ".paper", "wiki", "navigation.md")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "task-packets", "packets", "task-packet-review-task.json")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "context", "packets", "task-packet-review-task.json")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "context", "artifacts", "paper-orchestration-board-json.json")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "context", "actions", "current.json")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "context", "roles", "reviewer.json")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "sessions", "journal.json")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "workflow-pack", "boundaries.json")));
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
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.packCount, remediationPackFile.summary.packCount);
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.packsPath, ARTIFACT_PATHS.metaRemediationPacks);
  assert.equal(researcherManifest.operatorGuidance.remediationPack.id, remediationPackFile.packs[0].id);
  assert.equal(researcherManifest.operatorGuidance.remediationPack.manualNextActions.length > 0, true);
  assert.equal(phaseManifest.operatorGuidance.remediationPack.id, remediationPackFile.packs[0].id);
  assert.equal(currentActionBundle.operatorGuidance.remediationPack.id, remediationPackFile.packs[0].id);
  assert.match(currentActionBundle.operatorGuidance.taxonomyPressure.overview, /typed wiki taxonomy pressure/i);
  assert.match(navigation, /Remediation packs:/);
  assert.match(navigation, /Remediation packs path:/);
  assert.match(sessionSummaryText, /Remediation packs:/);
  assert.match(sessionSummaryText, /Remediation packs path:/);
  assert.ok(fs.existsSync(path.join(root, ".paper", "meta", "remediation-packs.json")));
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

  const packetPath = path.join(root, ".paper", "task-packets", "packets", "task-preserve-task.json");
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
  const boundaryPath = path.join(root, ".paper", "workflow-pack", "boundaries.json");
  fs.writeFileSync(boundaryPath, "{bad json", "utf8");

  const report = queryBoundaryReport(root);
  assert.equal(report.status, "invalid");
  assert.match(report.error, /Expected property name|Unexpected token|JSON/);
});
