import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ensureWorkspace,
  initProject,
  queryBoundaryReport,
  queryDecisions,
  queryLineage,
  queryOpenQuestions,
  queryTaskGraph,
  readRoleContextManifest,
  registerSource,
  summarizeSessionJournal,
  upsertClaims,
  upsertExperimentPlan,
  upsertNote,
  upsertOrchestrationBoard
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
  upsertExperimentPlan(root, {
    id: "packet-exp",
    title: "Packet validation experiment",
    claimId: "claim-packets",
    methodology: "Inspect durable packet lineage",
    successMetric: "Linked packets remain queryable"
  });
  upsertOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "planner",
    tasks: [{
      id: "packet-review-task",
      title: "Validate packet linkage",
      assignedRole: "reviewer",
      status: "pending",
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
  const reviewerManifest = readRoleContextManifest(root, "reviewer");
  const sessionSummary = summarizeSessionJournal(root);

  assert.ok(taskGraph.nodes.some((node) => node.id === "task-packet-review-task"));
  assert.ok(questions.items.some((item) => /follow-up validation|packet lineage/i.test(item.summary)));
  assert.ok(decisions.items.some((item) => /file-first/i.test(item.summary) || /Current role owner/i.test(item.summary)));
  assert.ok(Array.isArray(lineage.lineage));
  assert.ok(Array.isArray(boundaryReport.missingBootstrapArtifacts));
  assert.ok(Array.isArray(boundaryReport.userOwnedExistingPaths));
  assert.ok(reviewerManifest.contextPaths.includes(".paper/task-packets/index.json"));
  assert.ok(reviewerManifest.activeTaskPacketIds.includes("task-packet-review-task"));
  assert.equal(sessionSummary.summaryPath, ".paper/sessions/LATEST_SUMMARY.md");
  assert.ok(fs.existsSync(path.join(root, ".paper", "wiki", "navigation.md")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "task-packets", "packets", "task-packet-review-task.json")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "context", "roles", "reviewer.json")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "sessions", "journal.json")));
  assert.ok(fs.existsSync(path.join(root, ".paper", "workflow-pack", "boundaries.json")));
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
