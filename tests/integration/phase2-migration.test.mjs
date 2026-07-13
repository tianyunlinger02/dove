import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ensureWorkspace,
  initProject,
  readState,
  queryTaskGraph,
  queryWorkspaceIndex,
  refreshWiki,
  registerSource,
  prepareFigureGeneration,
  importFigureGeneration,
  runExperimentAudit,
  runReviewLoop,
  upsertClaims,
  upsertExperimentPlan,
  upsertExperimentResult,
  upsertFigurePlan,
  upsertNote,
} from "../../src/core/internal-api.mjs";
import { appendSystemHandoff, upsertSystemOrchestrationBoard } from "../../src/core/orchestration.mjs";
import { writeJson } from "../../src/core/workspace.mjs";
import { ensureTestWorkspace, runFixtureMutation } from "../helpers/mutation-fixture.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";
import { seedTrustedSourceVerification } from "../helpers/source-verification-fixture.mjs";

function tempRoot() {
  return createTempRoot("dove-phase2-");
}

function verifyFixtureSource(root, sourceId, packetId = "phase2-main-packet") {
  return seedTrustedSourceVerification(root, sourceId, packetId);
}

function seedTaskPacket(root, packetId = "phase2-main-packet") {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: packetId,
    title: "Phase 2 integration packet",
    summary: "Integration test packet for task-scoped writes.",
    sourceType: "test-task",
    sourceId: packetId,
    status: "pending",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    currentFocus: "Run the phase 2 integration flow.",
    nextAction: "Continue the scoped phase 2 flow.",
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

test("continuation focus and next action remain durable across refresh", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "continuation-focus-and-next-action-remain-durable-across-refresh", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Continuation Test", objective: "Verify durable next-step state." });

  upsertSystemOrchestrationBoard(root, {
    phase: "plan",
    assignedRole: "planner",
    currentFocus: "Resolve the evaluation plan.",
    nextAction: "Add the comparison milestone to the plan.",
    continuationState: {
      status: "ready-to-resume",
      lastCheckpoint: "Planning paused after milestone review.",
      checkpointHistory: [{ summary: "Planning paused after milestone review.", recordedAt: new Date(0).toISOString() }]
    },
    tasks: [{
      id: "plan-eval",
      title: "Plan evaluation section",
      assignedRole: "planner",
      status: "pending",
      currentFocus: "Define evaluation scope.",
      nextAction: "Link the evaluation packet to the comparison experiment."
    }]
  });

  const graph = queryTaskGraph(root);
  const workspaceIndex = queryWorkspaceIndex(root);
  const state = readState(root);
  const board = JSON.parse(fs.readFileSync(path.join(root, ".dove", "orchestration", "board.json"), "utf8"));

  assert.equal(board.currentFocus, "Resolve the evaluation plan.");
  assert.equal(board.nextAction, "Add the comparison milestone to the plan.");
  assert.equal(board.continuationState.status, "ready-to-resume");
  assert.equal(graph.nodes.find((node) => node.id === "task-plan-eval").nextAction, "Link the evaluation packet to the comparison experiment.");
  assert.equal(workspaceIndex.currentFocus, "Resolve the evaluation plan.");
  assert.equal(workspaceIndex.resumeGuidance.command, state.pipeline.resumeCommand);
  assert.ok(workspaceIndex.workQueues.waiting.some((packet) => packet.id === "task-plan-eval"));
  assert.ok(workspaceIndex.resumeGuidance.prioritizedPacketIds.includes("task-plan-eval"));
  assert.ok(workspaceIndex.resumeGuidance.packetContextPaths.includes(".dove/context/packets/task-plan-eval.json"));
  assert.equal(graph.nodes.find((node) => node.id === "task-plan-eval").packetContextPath, ".dove/context/packets/task-plan-eval.json");
  assert.ok(fs.existsSync(path.join(root, ".dove", "context", "packets", "task-plan-eval.json")));
  });
});

test("experiment audits and claim bridge records persist separately from raw results", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "experiment-audits-and-claim-bridge-records-persist-separately-from-raw-r", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Audit Bridge Test", objective: "Exercise audit and bridge persistence." });
  seedTaskPacket(root);

  const source = registerSource(root, { citationKey: "audit-source", title: "Audit Source", authors: ["Ng"], year: 2026, locator: "https://example.org/paper" });
  verifyFixtureSource(root, source.id);
  const note = upsertNote(root, { title: "Audit note", sectionId: "method", sourceIds: [source.id], summary: "Method note." });
  upsertClaims(root, {
    claims: [{ id: "claim-audit", text: "Audited experiment improves trust.", sectionId: "method", sourceIds: [source.id], noteIds: [note.id] }]
  });
  appendSystemHandoff(root, {
    fromRole: "planner",
    toRole: "experiment-planner",
    phase: "experiments",
    summary: "Move into experiment planning for the audit flow.",
    nextActions: ["Write the experiment plan"]
  });
  upsertExperimentPlan(root, {
    id: "audit-exp",
    title: "Audit experiment",
    claimId: "claim-audit",
    methodology: "Check durable audit trail",
    successMetric: "Audit and bridge files are coherent",
    comparisonTargets: ["baseline-audit"]
  });
  const result = upsertExperimentResult(root, {
    experimentId: "audit-exp",
    claimId: "claim-audit",
    outcome: "supports",
    summary: "Audit trail is durable.",
    evidenceLinks: [".dove/experiments/EXPERIMENT_LOG.md"],
    comparisonTargets: ["baseline-audit"]
  });
  const audit = runExperimentAudit(root, { resultId: result.id });

  const audits = JSON.parse(fs.readFileSync(path.join(root, ".dove", "experiments", "audits.json"), "utf8"));
  const bridgeLog = JSON.parse(fs.readFileSync(path.join(root, ".dove", "claims", "bridge-log.json"), "utf8"));
  const evidence = JSON.parse(fs.readFileSync(path.join(root, ".dove", "evidence", "index.json"), "utf8"));

  assert.ok(audits.items.some((item) => item.id === audit.id));
  assert.ok(bridgeLog.items.some((item) => item.claimId === "claim-audit" && item.resultId === result.id));
  assert.equal(evidence.claims.find((item) => item.id === "claim-audit").latestBridgeId !== null, true);
  });
});

test("refreshWiki writes typed wiki indexes and workspace summary surfaces", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "refreshwiki-writes-typed-wiki-indexes-and-workspace-summary-surfaces", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Typed Wiki Test", objective: "Generate typed wiki artifacts." });
  seedTaskPacket(root);

  const source = registerSource(root, { citationKey: "wiki-source", title: "Wiki Source", authors: ["Lee"], year: 2026, locator: "https://example.org/paper" });
  verifyFixtureSource(root, source.id);
  const note = upsertNote(root, { title: "Wiki note", sectionId: "introduction", sourceIds: [source.id], summary: "Question-bearing note.", openQuestions: ["How should the bridge affect confidence?"] });
  upsertClaims(root, {
    claims: [{ id: "claim-wiki", text: "Typed wiki records improve resumability.", sectionId: "introduction", sourceIds: [source.id], noteIds: [note.id] }]
  });
  appendSystemHandoff(root, {
    fromRole: "planner",
    toRole: "reviewer",
    phase: "review",
    summary: "Move into review to populate the wiki review surfaces.",
    nextActions: ["Run the review loop"]
  });
  runReviewLoop(root, { scope: "typed wiki" });
  const wiki = refreshWiki(root);

  const entities = JSON.parse(fs.readFileSync(path.join(root, ".dove", "wiki", "entities.json"), "utf8"));
  const relations = JSON.parse(fs.readFileSync(path.join(root, ".dove", "wiki", "relations.json"), "utf8"));
  const workspaceIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "workspace", "index.json"), "utf8"));

  assert.equal(wiki.wikiPath, ".dove/wiki/index.md");
  assert.ok(entities.items.some((item) => item.entityType === "claim" && item.id === "claim-wiki"));
  assert.ok(relations.items.some((item) => item.fromId === "claim-wiki"));
  assert.equal(relations.version, 3);
  assert.ok(relations.items.every((item) => item.semantics?.relationType === item.relationType));
  assert.ok(relations.items.every((item) => typeof item.taxonomy?.familyId === "string" && typeof item.taxonomy?.groupId === "string"));
  assert.ok(relations.items.every((item) => typeof item.semantics?.directionalMeaning?.forward === "string"));
  assert.ok(relations.items.every((item) => Array.isArray(item.integrity?.endpointChecks)));
  assert.equal(relations.summary.degradedCount, 0);
  assert.equal(relations.summary.taxonomy.familyCount >= 2, true);
  assert.equal(relations.summary.taxonomy.degradedFamilyCount, 0);
  assert.ok(Array.isArray(workspaceIndex.activePackets));
  assert.equal(workspaceIndex.repairFrontier.count, 0);
  assert.equal(workspaceIndex.repairFrontier.relationFamilyIssueCount, 0);
  });
});

test("figure workflow prepares materials, imports generated output, and writes caption QA", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "figure-workflow-prepares-materials-imports-generated-output-and-writes-c", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Figure Contract Test", objective: "Plan a durable figure contract." });
  const packetId = seedTaskPacket(root);
  const source = registerSource(root, {
    citationKey: "figure-source",
    title: "Figure Source",
    authors: ["Doe"],
    year: 2026,
    locator: "https://example.org/paper",
    sourceType: "paper"
  });
  verifyFixtureSource(root, source.id);
  upsertNote(root, {
    noteId: "figure-note",
    title: "Figure note",
    sectionId: "method",
    sourceIds: ["figure-source"],
    summary: "Supports the main figure claim."
  });
  upsertClaims(root, {
    claims: [{
      id: "claim-main",
      text: "The main figure explains the method-to-result flow.",
      sectionId: "method",
      sourceIds: ["figure-source"],
      noteIds: ["figure-note"]
    }]
  });

  fs.writeFileSync(path.join(root, ".dove", "figures", "main-figure.template.svg"), "<svg />\n", "utf8");
  fs.writeFileSync(path.join(root, ".dove", "figures", "main-figure.editable.svg"), "<svg />\n", "utf8");

  const figurePlan = upsertFigurePlan(root, {
    packetId,
    items: [{
      id: "main-figure",
      name: "Main Figure",
      sourceSections: ["method", "experiments"],
      targetClaimIds: ["claim-main"],
      narrativeIntent: "Explain the method-to-result flow.",
      requiredVisualElements: ["pipeline boxes", "comparison chart"],
      templateSvgPath: ".dove/figures/main-figure.template.svg",
      finalSvgPath: ".dove/figures/main-figure.final.svg",
      reviewNotes: ["Keep labels editable."]
    }]
  });
  const prepared = prepareFigureGeneration(root, { packetId, figureId: "main-figure", runId: "main-figure-run" });
  const imported = importFigureGeneration(root, {
    packetId,
    figureId: "main-figure",
    runId: "main-figure-run",
    svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Pipeline boxes show the method-to-result flow beside a comparison chart for the linked claim.</text></svg>",
    caption: "Main Figure explains the source-backed method-to-result flow with pipeline boxes and a comparison chart for the linked claim."
  });

  const briefs = JSON.parse(fs.readFileSync(path.join(root, ".dove", "figures", "briefs.json"), "utf8"));
  const segments = JSON.parse(fs.readFileSync(path.join(root, ".dove", "figures", "segments.json"), "utf8"));
  const templates = JSON.parse(fs.readFileSync(path.join(root, ".dove", "figures", "templates.json"), "utf8"));
  const editable = JSON.parse(fs.readFileSync(path.join(root, ".dove", "figures", "editable-index.json"), "utf8"));
  const finalIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "figures", "final-index.json"), "utf8"));
  const qa = JSON.parse(fs.readFileSync(path.join(root, ".dove", "figures", "qa.json"), "utf8"));
  const materials = JSON.parse(fs.readFileSync(path.join(root, ".dove", "figures", "materials.json"), "utf8"));
  const generations = JSON.parse(fs.readFileSync(path.join(root, ".dove", "figures", "generations.json"), "utf8"));
  const captions = JSON.parse(fs.readFileSync(path.join(root, ".dove", "figures", "captions.json"), "utf8"));
  const readme = fs.readFileSync(path.join(root, ".dove", "figures", "README.md"), "utf8");

  assert.equal(figurePlan.figureCount, 1);
  assert.equal(figurePlan.qaPath, ".dove/figures/qa.json");
  assert.equal(prepared.materialStatus, "ready");
  assert.equal(imported.finalSvgPath, ".dove/figures/main-figure.final.svg");
  assert.equal(briefs.items[0].figureId, "main-figure");
  assert.equal(briefs.items[0].captionIntent, "Explain the method-to-result flow.");
  assert.ok(Array.isArray(segments.items[0].placeholderSegments));
  assert.equal(templates.items[0].templateSvgPath, ".dove/figures/main-figure.template.svg");
  assert.equal(editable.items[0].finalSvgPath, ".dove/figures/main-figure.final.svg");
  assert.equal(finalIndex.items[0].figureId, "main-figure");
  assert.equal(materials.items[0].figureId, "main-figure");
  assert.equal(generations.items[0].status, "imported");
  assert.equal(captions.items[0].figureId, "main-figure");
  assert.equal(qa.items[0].qaStatus, "ready");
  assert.match(readme, /Generation workflow/i);
  assert.doesNotMatch(readme, /does not claim to ship a render backend/i);
  });
});
