import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const serverScriptPath = path.join(ROOT, "mcp", "paper-state-server.mjs");
const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-validate-"));

const server = spawn("node", [serverScriptPath], {
  cwd: tempWorkspace,
  stdio: ["pipe", "pipe", "inherit"]
});

let buffer = Buffer.alloc(0);
let nextId = 1;
const pending = new Map();

function sendMessage(message) {
  const body = JSON.stringify(message);
  server.stdin.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

function call(method, params = {}) {
  const id = nextId++;
  const promise = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
  sendMessage({ jsonrpc: "2.0", id, method, params });
  return promise;
}

function parseMessages() {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      return;
    }
    const headerText = buffer.slice(0, headerEnd).toString("utf8");
    const match = headerText.match(/Content-Length:\s*(\d+)/i);
    assert.ok(match, "Missing Content-Length header from MCP server");
    const length = Number(match[1]);
    const totalLength = headerEnd + 4 + length;
    if (buffer.length < totalLength) {
      return;
    }
    const body = buffer.slice(headerEnd + 4, totalLength).toString("utf8");
    buffer = buffer.slice(totalLength);
    const message = JSON.parse(body);
    const waiter = pending.get(message.id);
    if (!waiter) {
      continue;
    }
    pending.delete(message.id);
    if (message.error) {
      waiter.reject(new Error(message.error.message));
    } else {
      waiter.resolve(message.result);
    }
  }
}

server.stdout.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  parseMessages();
});

server.on("exit", (code) => {
  for (const waiter of pending.values()) {
    waiter.reject(new Error(`MCP server exited early with code ${code}`));
  }
  pending.clear();
});

function extractJson(result) {
  assert.ok(result.content?.[0]?.text, "Expected text content in MCP tool result");
  return JSON.parse(result.content[0].text);
}

async function main() {
  const init = await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "paper-factory-validator",
      version: "0.2.0"
    }
  });
  assert.equal(init.serverInfo.name, "paper-factory");

  sendMessage({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });

  const listed = await call("tools/list");
  const toolNames = listed.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, [
    "append_handoff",
    "append_review_log",
    "bridge_result_to_claim",
    "build_rebuttal",
    "build_rebuttal_strategy",
    "compare_versions",
    "create_version_snapshot",
    "ensure_workspace",
    "init_project",
    "list_artifacts",
    "normalize_rebuttal_issues",
    "query_boundary_report",
    "query_decisions",
    "query_lineage",
    "query_open_questions",
    "query_task_graph",
    "query_workspace_index",
    "read_action_context_bundle",
    "read_artifact_context_manifest",
    "read_packet_context_manifest",
    "read_phase_context_manifest",
    "read_role_context_manifest",
    "read_state",
    "refresh_wiki",
    "register_source",
    "run_experiment_audit",
    "run_review_loop",
    "set_section_status",
    "summarize_session_journal",
    "sync_checklist",
    "sync_citations",
    "update_research_brief",
    "upsert_claims",
    "upsert_draft",
    "upsert_experiment_plan",
    "upsert_experiment_result",
    "upsert_figure_plan",
    "upsert_note",
    "upsert_orchestration_board",
    "upsert_outline",
    "upsert_plan",
    "upsert_revision_plan",
    "validate_figure_pipeline"
  ]);

  extractJson(await call("tools/call", { name: "ensure_workspace", arguments: {} }));

  const state = extractJson(await call("tools/call", {
    name: "init_project",
    arguments: {
      title: "Deterministic Paper Factory",
      venue: "ICLR",
      objective: "Verify the mature paper_factory workflow.",
      deadline: "2026-05-01",
      thesis: "A durable workflow pack can make paper writing more trustworthy.",
      audience: "ML conference reviewers"
    }
  }));
  assert.equal(state.paper.title, "Deterministic Paper Factory");

  extractJson(await call("tools/call", {
    name: "append_handoff",
    arguments: {
      fromRole: "planner",
      toRole: "researcher",
      phase: "research",
      summary: "Proceed with evidence collection.",
      nextActions: ["Update research brief"]
    }
  }));

  extractJson(await call("tools/call", {
    name: "update_research_brief",
    arguments: {
      objective: "Verify the mature paper_factory workflow.",
      agenda: ["Collect sources", "Plan experiments"],
      evidenceBacklog: ["Add comparison evidence"]
    }
  }));

  const source = extractJson(await call("tools/call", {
    name: "register_source",
    arguments: {
      citationKey: "smith2026paperfactory",
      title: "Paper Factory: Trustworthy Paper Workflows",
      authors: ["Smith", "Lee"],
      year: 2026,
      sourceType: "paper",
      origin: "validator"
    }
  }));
  assert.equal(source.citationKey, "smith2026paperfactory");

  const note = extractJson(await call("tools/call", {
    name: "upsert_note",
    arguments: {
      title: "Core contribution note",
      sectionId: "introduction",
      sourceIds: [source.id],
      summary: "The workflow is durable and provenance-aware.",
      claims: ["A file-first workflow reduces unsupported claims."],
      openQuestions: ["Need a second source for stronger support."]
    }
  }));
  assert.equal(note.sectionId, "introduction");

  extractJson(await call("tools/call", {
    name: "upsert_claims",
    arguments: {
      claims: [
        {
          id: "claim-1",
          text: "File-first workflows improve paper-writing reliability.",
          sectionId: "introduction",
          sourceIds: [source.id],
          noteIds: [note.id],
          experimentIds: [],
          evidenceLinks: [".paper/notes/index.json"],
          status: "weak",
          confidence: "medium",
          gap: "Needs a confirming source."
        }
      ]
    }
  }));

  extractJson(await call("tools/call", {
    name: "append_handoff",
    arguments: {
      fromRole: "planner",
      toRole: "experiment-planner",
      phase: "experiments",
      summary: "Proceed with the experiment plan.",
      nextActions: ["Record the experiment result"]
    }
  }));

  extractJson(await call("tools/call", {
    name: "upsert_experiment_plan",
    arguments: {
      id: "workflow-compare",
      title: "Workflow comparison",
      claimId: "claim-1",
      hypothesis: "Durable workflows are more reliable.",
      methodology: "Compare artifact completeness.",
      successMetric: "Fewer evidence gaps",
      comparisonTargets: ["baseline"]
    }
  }));

  extractJson(await call("tools/call", {
    name: "upsert_experiment_result",
    arguments: {
      experimentId: "workflow-compare",
      claimId: "claim-1",
      outcome: "supports",
      summary: "Durable workflow had fewer evidence gaps.",
      evidenceLinks: [".paper/experiments/EXPERIMENT_LOG.md"],
      comparisonTargets: ["baseline"]
    }
  }));

  const audit = extractJson(await call("tools/call", {
    name: "run_experiment_audit",
    arguments: {
      experimentId: "workflow-compare"
    }
  }));
  assert.equal(audit.experimentId, "workflow-compare");

  const bridge = extractJson(await call("tools/call", {
    name: "bridge_result_to_claim",
    arguments: {
      experimentId: "workflow-compare",
      auditIds: [audit.id],
      reason: "Validator explicitly checked the result-to-claim bridge."
    }
  }));
  assert.equal(bridge.claimId, "claim-1");

  extractJson(await call("tools/call", {
    name: "upsert_plan",
    arguments: {
      thesis: "A durable workflow pack can make paper writing more trustworthy.",
      audience: "ML conference reviewers",
      sections: ["Abstract", "Introduction", "Method", "Evaluation", "Conclusion"],
      evidenceGaps: ["Add a second source for claim-1"],
      milestones: ["Register sources", "Draft introduction", "Run review loop"]
    }
  }));

  extractJson(await call("tools/call", {
    name: "upsert_outline",
    arguments: {
      sections: [
        { id: "introduction", title: "Introduction", status: "drafting", goal: "Frame the problem." },
        { id: "method", title: "Method", status: "planned", goal: "Explain the workflow." }
      ]
    }
  }));

  extractJson(await call("tools/call", {
    name: "upsert_draft",
    arguments: {
      sectionId: "introduction",
      title: "Introduction",
      body: "# Introduction\n\nThis workflow is promising. TODO[citation]: add stronger empirical support.\n",
      status: "drafting"
    }
  }));

  const figurePlan = extractJson(await call("tools/call", {
    name: "upsert_figure_plan",
    arguments: {
      items: [{
        id: "workflow-figure",
        name: "Workflow Figure",
        sourceSections: ["method", "introduction"],
        targetClaimIds: ["claim-1"],
        relatedExperimentIds: ["workflow-compare"],
        narrativeIntent: "Show the durable workflow from evidence to review.",
        requiredVisualElements: ["board", "evidence links", "review gate"],
        reviewNotes: ["Keep labels editable."]
      }]
    }
  }));
  assert.equal(figurePlan.qaPath, ".paper/figures/qa.json");

  const figureQa = extractJson(await call("tools/call", { name: "validate_figure_pipeline", arguments: {} }));
  assert.equal(figureQa.issueCount, 0);

  extractJson(await call("tools/call", {
    name: "append_handoff",
    arguments: {
      fromRole: "researcher",
      toRole: "reviewer",
      phase: "review",
      summary: "Proceed with review.",
      nextActions: ["Run the review loop"]
    }
  }));

  const review = extractJson(await call("tools/call", {
    name: "run_review_loop",
    arguments: {
      scope: "introduction draft"
    }
  }));
  assert.notEqual(review.verdict, undefined);

  extractJson(await call("tools/call", {
    name: "append_handoff",
    arguments: {
      fromRole: "rebuttal-lead",
      toRole: "reviewer",
      phase: "review",
      summary: "Return to reviewer for validation signoff.",
      nextActions: ["Record the coherent validation verdict"]
    }
  }));

  extractJson(await call("tools/call", {
    name: "append_review_log",
    arguments: {
      stage: "validator-signoff",
      scope: "validator",
      verdict: "coherent",
      summary: "Validation signoff clears finalize gate.",
      findings: [],
      actionItems: [],
      reviewRequiredBeforeFinalize: false
    }
  }));

  const citations = extractJson(await call("tools/call", { name: "sync_citations", arguments: {} }));
  assert.equal(Array.isArray(citations.missingKeys), true);

  const wiki = extractJson(await call("tools/call", { name: "refresh_wiki", arguments: {} }));
  assert.equal(wiki.wikiPath, ".paper/wiki/index.md");

  extractJson(await call("tools/call", {
    name: "append_handoff",
    arguments: {
      fromRole: "researcher",
      toRole: "reviewer",
      phase: "review",
      summary: "Return to reviewer to finalize the rebuttal issue board.",
      nextActions: ["Normalize rebuttal issues"]
    }
  }));

  const issues = extractJson(await call("tools/call", {
    name: "normalize_rebuttal_issues",
    arguments: {
      issues: [
        { summary: "Clarify comparison protocol.", severity: "medium", evidenceLinks: [".paper/experiments/EXPERIMENT_LOG.md"] }
      ]
    }
  }));
  assert.equal(issues.items.length >= 1, true);

  const strategy = extractJson(await call("tools/call", { name: "build_rebuttal_strategy", arguments: {} }));
  assert.equal(strategy.strategyPath, ".paper/rebuttal/strategy.md");

  const rebuttal = extractJson(await call("tools/call", { name: "build_rebuttal", arguments: {} }));
  assert.equal(rebuttal.draftPath, ".paper/drafts/rebuttal.md");

  extractJson(await call("tools/call", {
    name: "append_handoff",
    arguments: {
      fromRole: "rebuttal-lead",
      toRole: "reviewer",
      phase: "review",
      summary: "Return to reviewer for post-rebuttal signoff.",
      nextActions: ["Record the final review verdict"]
    }
  }));

  extractJson(await call("tools/call", {
    name: "append_review_log",
    arguments: {
      stage: "validator-post-rebuttal-signoff",
      scope: "validator",
      verdict: "coherent",
      summary: "Post-rebuttal validation signoff clears finalize gate again.",
      findings: [],
      actionItems: [],
      reviewRequiredBeforeFinalize: false
    }
  }));

  extractJson(await call("tools/call", {
    name: "upsert_orchestration_board",
    arguments: {
      phase: "versions",
      assignedRole: "version-analyst",
      reviewRequiredBeforeFinalize: false,
      currentFocus: "Validator signoff cleared finalize gate.",
      nextAction: "Create and compare version snapshots."
    }
  }));

  const snapshotA = extractJson(await call("tools/call", {
    name: "create_version_snapshot",
    arguments: {
      versionId: "validator-v1",
      summary: "Initial validator snapshot"
    }
  }));
  assert.equal(snapshotA.id, "validator-v1");

  extractJson(await call("tools/call", {
    name: "upsert_draft",
    arguments: {
      sectionId: "method",
      title: "Method",
      body: "# Method\n\nWe keep a board-first workflow [cite:smith2026paperfactory].\n",
      status: "drafting"
    }
  }));

  extractJson(await call("tools/call", {
    name: "upsert_orchestration_board",
    arguments: {
      phase: "versions",
      assignedRole: "version-analyst",
      reviewRequiredBeforeFinalize: false,
      currentFocus: "Second validator snapshot is ready.",
      nextAction: "Create the follow-up snapshot and compare lineage."
    }
  }));

  const snapshotB = extractJson(await call("tools/call", {
    name: "create_version_snapshot",
    arguments: {
      versionId: "validator-v2",
      parentVersionId: "validator-v1",
      summary: "Second validator snapshot"
    }
  }));
  assert.equal(snapshotB.parentVersionId, "validator-v1");

  const comparison = extractJson(await call("tools/call", {
    name: "compare_versions",
    arguments: {
      fromVersionId: "validator-v1",
      toVersionId: "validator-v2"
    }
  }));
  assert.equal(comparison.fromVersionId, "validator-v1");

  const taskGraph = extractJson(await call("tools/call", { name: "query_task_graph", arguments: {} }));
  assert.equal(Array.isArray(taskGraph.nodes), true);
  assert.ok(taskGraph.nodes.length > 0);

  const packetManifest = extractJson(await call("tools/call", {
    name: "read_packet_context_manifest",
    arguments: { packetId: taskGraph.nodes[0].id }
  }));
  assert.equal(packetManifest.packetId, taskGraph.nodes[0].id);

  const boundaryReport = extractJson(await call("tools/call", { name: "query_boundary_report", arguments: {} }));
  assert.equal(Array.isArray(boundaryReport.missingBootstrapArtifacts), true);

  const questions = extractJson(await call("tools/call", { name: "query_open_questions", arguments: {} }));
  assert.equal(Array.isArray(questions.items), true);

  const decisions = extractJson(await call("tools/call", { name: "query_decisions", arguments: {} }));
  assert.equal(Array.isArray(decisions.items), true);

  const lineage = extractJson(await call("tools/call", { name: "query_lineage", arguments: {} }));
  assert.equal(Array.isArray(lineage.lineage), true);

  const workspaceIndex = extractJson(await call("tools/call", { name: "query_workspace_index", arguments: {} }));
  assert.equal(Array.isArray(workspaceIndex.activePackets), true);

  const currentActionBundle = extractJson(await call("tools/call", { name: "read_action_context_bundle", arguments: {} }));
  assert.equal(currentActionBundle.scopeType, "current");

  const phaseManifest = extractJson(await call("tools/call", { name: "read_phase_context_manifest", arguments: {} }));
  assert.ok(phaseManifest.phaseId);

  const reviewerManifest = extractJson(await call("tools/call", {
    name: "read_role_context_manifest",
    arguments: { roleId: "reviewer" }
  }));
  assert.equal(reviewerManifest.roleId, "reviewer");

  const artifactManifest = extractJson(await call("tools/call", {
    name: "read_artifact_context_manifest",
    arguments: { artifactPath: ".paper/orchestration/board.json" }
  }));
  assert.equal(artifactManifest.artifactPath, ".paper/orchestration/board.json");

  const journalSummary = extractJson(await call("tools/call", { name: "summarize_session_journal", arguments: {} }));
  assert.equal(journalSummary.summaryPath, ".paper/sessions/LATEST_SUMMARY.md");

  extractJson(await call("tools/call", { name: "sync_checklist", arguments: {} }));

  const artifacts = extractJson(await call("tools/call", { name: "list_artifacts", arguments: {} }));
  assert.equal(artifacts.state.exists, true);
  assert.equal(artifacts.revisionPlan.exists, true);

  console.log("MCP validation passed.");
}

try {
  await main();
  server.kill();
} catch (error) {
  server.kill();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempWorkspace, { recursive: true, force: true });
}
