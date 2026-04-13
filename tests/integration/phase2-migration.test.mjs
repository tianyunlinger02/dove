import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  appendHandoff,
  ensureWorkspace,
  initProject,
  readState,
  queryTaskGraph,
  queryWorkspaceIndex,
  refreshWiki,
  registerSource,
  runExperimentAudit,
  runReviewLoop,
  upsertClaims,
  upsertExperimentPlan,
  upsertExperimentResult,
  upsertFigurePlan,
  upsertNote,
  upsertOrchestrationBoard
} from "../../src/core/index.mjs";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-phase2-"));
}

test("continuation focus and next action remain durable across refresh", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Continuation Test", objective: "Verify durable next-step state." });

  upsertOrchestrationBoard(root, {
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
  const board = JSON.parse(fs.readFileSync(path.join(root, ".paper", "orchestration", "board.json"), "utf8"));

  assert.equal(board.currentFocus, "Resolve the evaluation plan.");
  assert.equal(board.nextAction, "Add the comparison milestone to the plan.");
  assert.equal(board.continuationState.status, "ready-to-resume");
  assert.equal(graph.nodes.find((node) => node.id === "task-plan-eval").nextAction, "Link the evaluation packet to the comparison experiment.");
  assert.equal(workspaceIndex.currentFocus, "Resolve the evaluation plan.");
  assert.equal(workspaceIndex.resumeGuidance.command, state.pipeline.resumeCommand);
  assert.ok(workspaceIndex.workQueues.waiting.some((packet) => packet.id === "task-plan-eval"));
  assert.ok(workspaceIndex.resumeGuidance.prioritizedPacketIds.includes("task-plan-eval"));
  assert.ok(workspaceIndex.resumeGuidance.packetContextPaths.includes(".paper/context/packets/task-plan-eval.json"));
  assert.equal(graph.nodes.find((node) => node.id === "task-plan-eval").packetContextPath, ".paper/context/packets/task-plan-eval.json");
  assert.ok(fs.existsSync(path.join(root, ".paper", "context", "packets", "task-plan-eval.json")));
});

test("experiment audits and claim bridge records persist separately from raw results", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Audit Bridge Test", objective: "Exercise audit and bridge persistence." });

  const source = registerSource(root, { citationKey: "audit-source", title: "Audit Source", authors: ["Ng"], year: 2026 });
  const note = upsertNote(root, { title: "Audit note", sectionId: "method", sourceIds: [source.id], summary: "Method note." });
  upsertClaims(root, {
    claims: [{ id: "claim-audit", text: "Audited experiment improves trust.", sectionId: "method", sourceIds: [source.id], noteIds: [note.id] }]
  });
  appendHandoff(root, {
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
    evidenceLinks: [".paper/experiments/EXPERIMENT_LOG.md"],
    comparisonTargets: ["baseline-audit"]
  });
  const audit = runExperimentAudit(root, { resultId: result.id });

  const audits = JSON.parse(fs.readFileSync(path.join(root, ".paper", "experiments", "audits.json"), "utf8"));
  const bridgeLog = JSON.parse(fs.readFileSync(path.join(root, ".paper", "claims", "bridge-log.json"), "utf8"));
  const evidence = JSON.parse(fs.readFileSync(path.join(root, ".paper", "evidence", "index.json"), "utf8"));

  assert.ok(audits.items.some((item) => item.id === audit.id));
  assert.ok(bridgeLog.items.some((item) => item.claimId === "claim-audit" && item.resultId === result.id));
  assert.equal(evidence.claims.find((item) => item.id === "claim-audit").latestBridgeId !== null, true);
});

test("refreshWiki writes typed wiki indexes and workspace summary surfaces", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Typed Wiki Test", objective: "Generate typed wiki artifacts." });

  const source = registerSource(root, { citationKey: "wiki-source", title: "Wiki Source", authors: ["Lee"], year: 2026 });
  const note = upsertNote(root, { title: "Wiki note", sectionId: "introduction", sourceIds: [source.id], summary: "Question-bearing note.", openQuestions: ["How should the bridge affect confidence?"] });
  upsertClaims(root, {
    claims: [{ id: "claim-wiki", text: "Typed wiki records improve resumability.", sectionId: "introduction", sourceIds: [source.id], noteIds: [note.id] }]
  });
  appendHandoff(root, {
    fromRole: "planner",
    toRole: "reviewer",
    phase: "review",
    summary: "Move into review to populate the wiki review surfaces.",
    nextActions: ["Run the review loop"]
  });
  runReviewLoop(root, { scope: "typed wiki" });
  const wiki = refreshWiki(root);

  const entities = JSON.parse(fs.readFileSync(path.join(root, ".paper", "wiki", "entities.json"), "utf8"));
  const relations = JSON.parse(fs.readFileSync(path.join(root, ".paper", "wiki", "relations.json"), "utf8"));
  const workspaceIndex = JSON.parse(fs.readFileSync(path.join(root, ".paper", "workspace", "index.json"), "utf8"));

  assert.equal(wiki.wikiPath, ".paper/wiki/index.md");
  assert.ok(entities.items.some((item) => item.entityType === "claim" && item.id === "claim-wiki"));
  assert.ok(relations.items.some((item) => item.fromId === "claim-wiki"));
  assert.equal(relations.version, 2);
  assert.ok(relations.items.every((item) => item.semantics?.relationType === item.relationType));
  assert.ok(relations.items.every((item) => Array.isArray(item.integrity?.endpointChecks)));
  assert.equal(relations.summary.degradedCount, 0);
  assert.ok(Array.isArray(workspaceIndex.activePackets));
  assert.equal(workspaceIndex.repairFrontier.count, 0);
});

test("figure artifact planning writes staged contract files without claiming render backend", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  initProject(root, { title: "Figure Contract Test", objective: "Plan a durable figure contract." });
  registerSource(root, {
    citationKey: "figure-source",
    title: "Figure Source",
    authors: ["Doe"],
    year: 2026,
    sourceType: "paper"
  });
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

  fs.writeFileSync(path.join(root, ".paper", "figures", "main-figure.template.svg"), "<svg />\n", "utf8");
  fs.writeFileSync(path.join(root, ".paper", "figures", "main-figure.editable.svg"), "<svg />\n", "utf8");
  fs.writeFileSync(path.join(root, ".paper", "figures", "main-figure.final.svg"), "<svg />\n", "utf8");

  const figurePlan = upsertFigurePlan(root, {
    items: [{
      id: "main-figure",
      name: "Main Figure",
      sourceSections: ["method", "experiments"],
      targetClaimIds: ["claim-main"],
      narrativeIntent: "Explain the method-to-result flow.",
      requiredVisualElements: ["pipeline boxes", "comparison chart"],
      templateSvgPath: ".paper/figures/main-figure.template.svg",
      finalSvgPath: ".paper/figures/main-figure.final.svg",
      reviewNotes: ["Keep labels editable."]
    }]
  });

  const briefs = JSON.parse(fs.readFileSync(path.join(root, ".paper", "figures", "briefs.json"), "utf8"));
  const segments = JSON.parse(fs.readFileSync(path.join(root, ".paper", "figures", "segments.json"), "utf8"));
  const templates = JSON.parse(fs.readFileSync(path.join(root, ".paper", "figures", "templates.json"), "utf8"));
  const editable = JSON.parse(fs.readFileSync(path.join(root, ".paper", "figures", "editable-index.json"), "utf8"));
  const finalIndex = JSON.parse(fs.readFileSync(path.join(root, ".paper", "figures", "final-index.json"), "utf8"));
  const qa = JSON.parse(fs.readFileSync(path.join(root, ".paper", "figures", "qa.json"), "utf8"));
  const readme = fs.readFileSync(path.join(root, ".paper", "figures", "README.md"), "utf8");

  assert.equal(figurePlan.figureCount, 1);
  assert.equal(figurePlan.qaPath, ".paper/figures/qa.json");
  assert.equal(briefs.items[0].figureId, "main-figure");
  assert.ok(Array.isArray(segments.items[0].placeholderSegments));
  assert.equal(templates.items[0].templateSvgPath, ".paper/figures/main-figure.template.svg");
  assert.equal(editable.items[0].finalSvgPath, ".paper/figures/main-figure.final.svg");
  assert.equal(finalIndex.items[0].figureId, "main-figure");
  assert.equal(qa.items[0].qaStatus, "ready");
  assert.match(readme, /does not claim to ship a render backend/i);
  assert.match(readme, /Stage contract/i);
});
