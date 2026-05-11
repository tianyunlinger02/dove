import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createMcpStdioClient } from "./mcp-stdio-client.mjs";

const ROOT = process.cwd();
const serverScriptPath = path.join(ROOT, "mcp", "dove-state-server.mjs");
const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "dove-validate-"));
const { call, notify, kill } = createMcpStdioClient({ args: [serverScriptPath], cwd: tempWorkspace });

function extractJson(result) {
  assert.ok(result.content?.[0]?.text, "Expected text content in MCP tool result");
  assert.notEqual(result.isError, true, result.content[0].text);
  return JSON.parse(result.content[0].text);
}

function seedTaskPacket(root, packetId = "validator-main-packet") {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: packetId,
    title: "Validator main packet",
    summary: "MCP validator packet for task-scoped writes.",
    sourceType: "test-task",
    sourceId: packetId,
    status: "pending",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    currentFocus: "Run the MCP validator workflow.",
    nextAction: "Continue the scoped validator workflow.",
    evidenceLinks: [],
    outputPaths: [],
    packetPath: `.dove/task-packets/packets/${packetId}.json`,
    packetContextPath: `.dove/context/packets/${packetId}.json`,
    updatedAt: timestamp
  };
  const indexPath = path.join(root, ".dove", "task-packets", "index.json");
  const existingIndex = fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath, "utf8"))
    : { version: 3, items: [], lifecycleCounts: {}, dependencyHealth: {}, updatedAt: null };
  fs.mkdirSync(path.join(root, ".dove", "task-packets", "packets"), { recursive: true });
  fs.writeFileSync(path.join(root, packet.packetPath), `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  fs.writeFileSync(indexPath, `${JSON.stringify({ ...existingIndex, items: [...(existingIndex.items ?? []).filter((item) => item.id !== packetId), packet], updatedAt: timestamp }, null, 2)}\n`, "utf8");
  return packetId;
}

async function main() {
  const init = await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "dove-validator",
      version: "0.2.0"
    }
  });
  assert.equal(init.serverInfo.name, "dove");

  notify("notifications/initialized");

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
    "import_figure_generation",
    "import_isolated_review",
    "init_project",
    "issue_program_approval",
    "launch_dove_mission",
    "list_artifacts",
    "materialize_guidance_packet",
    "normalize_rebuttal_issues",
    "plan_campaign",
    "prepare_figure_generation",
    "prepare_isolated_review",
    "query_boundary_report",
    "query_campaigns",
    "query_decisions",
    "query_dove_audit",
    "query_dove_mission",
    "query_dove_mission_board",
    "query_dove_onboarding",
    "query_dove_orchestrate",
    "query_dove_return",
    "query_dove_status",
    "query_governance_coverage_report",
    "query_lineage",
    "query_meta_optimize",
    "query_open_questions",
    "query_operator_follow_through",
    "query_operator_lessons",
    "query_paper_audit",
    "query_paper_pipeline",
    "query_program_approvals",
    "query_task_graph",
    "query_workspace_index",
    "read_action_context_bundle",
    "read_artifact_context_manifest",
    "read_packet_context_manifest",
    "read_phase_context_manifest",
    "read_role_context_manifest",
    "read_state",
    "record_operator_follow_through",
    "record_operator_lesson",
    "refresh_wiki",
    "register_source",
    "revoke_program_approval",
    "run_autonomy_foreground",
    "run_autonomy_once",
    "run_autonomy_operate",
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
      title: "Deterministic Dove Workspace",
      venue: "ICLR",
      objective: "Verify the mature Dove workflow.",
      deadline: "2026-05-01",
      thesis: "A durable workflow pack can make paper writing more trustworthy.",
      audience: "ML conference reviewers"
    }
  }));
  assert.equal(state.dove.title, "Deterministic Dove Workspace");

  const metaOptimize = extractJson(await call("tools/call", {
    name: "query_meta_optimize",
    arguments: {}
  }));
  assert.equal(metaOptimize.proposalOnly, true);
  assert.ok(Array.isArray(metaOptimize.clusters));
  assert.ok(metaOptimize.frontier && typeof metaOptimize.frontier === "object");
  assert.ok(metaOptimize.groupedFrontier && typeof metaOptimize.groupedFrontier === "object");
  assert.equal(metaOptimize.groupedFrontier.ranking.method, "durable-signal-frontier-v1");
  assert.ok(Array.isArray(metaOptimize.groupedFrontier.topClusters));
  assert.ok(metaOptimize.longHorizon && typeof metaOptimize.longHorizon === "object");
  assert.equal(metaOptimize.longHorizon.proposalOnly, true);
  assert.equal(metaOptimize.reportPath, ".dove/meta/LATEST_OPTIMIZER_REPORT.md");
  assert.equal(metaOptimize.longHorizonPath, ".dove/meta/long-horizon-memory.json");

  const approvals = extractJson(await call("tools/call", {
    name: "query_program_approvals",
    arguments: {}
  }));
  assert.equal(approvals.status, "ok");
  assert.equal(approvals.summary.approvalCount, 0);

  const foreground = extractJson(await call("tools/call", {
    name: "run_autonomy_foreground",
    arguments: {}
  }));
  assert.equal(foreground.stepCount >= 1, true);

  const validationPacketId = seedTaskPacket(tempWorkspace);

  extractJson(await call("tools/call", {
    name: "append_handoff",
    arguments: {
      fromRole: "planner",
      toRole: "builder",
      phase: "research",
      summary: "Proceed with evidence collection.",
      nextActions: ["Update research brief"]
    }
  }));

  extractJson(await call("tools/call", {
    name: "update_research_brief",
    arguments: {
      packetId: validationPacketId,
      objective: "Verify the mature Dove workflow.",
      agenda: ["Collect sources", "Plan experiments"],
      evidenceBacklog: ["Add comparison evidence"]
    }
  }));

  const source = extractJson(await call("tools/call", {
    name: "register_source",
    arguments: {
      packetId: validationPacketId,
      citationKey: "smith2026dove",
      title: "Dove: Trustworthy Mission Workflows",
      authors: ["Smith", "Lee"],
      year: 2026,
      sourceType: "paper",
      origin: "validator"
    }
  }));
  assert.equal(source.citationKey, "smith2026dove");

  const note = extractJson(await call("tools/call", {
    name: "upsert_note",
    arguments: {
      packetId: validationPacketId,
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
      packetId: validationPacketId,
      claims: [
        {
          id: "claim-1",
          text: "File-first workflows improve paper-writing reliability.",
          sectionId: "introduction",
          sourceIds: [source.id],
          noteIds: [note.id],
          experimentIds: [],
          evidenceLinks: [".dove/notes/index.json"],
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
      toRole: "builder",
      phase: "experiments",
      summary: "Proceed with the experiment plan.",
      nextActions: ["Record the experiment result"]
    }
  }));

  extractJson(await call("tools/call", {
    name: "upsert_experiment_plan",
    arguments: {
      packetId: validationPacketId,
      id: "workflow-compare",
      title: "Workflow comparison",
      claimId: "claim-1",
      hypothesis: "Durable workflows are more reliable.",
      methodology: "Compare artifact completeness.",
      successMetric: "Fewer evidence gaps",
      comparisonTargets: ["baseline"]
    }
  }));
  const experimentPacketId = "experiment-workflow-compare";

  const experimentResult = extractJson(await call("tools/call", {
    name: "upsert_experiment_result",
    arguments: {
      packetId: experimentPacketId,
      experimentId: "workflow-compare",
      claimId: "claim-1",
      outcome: "supports",
      summary: "Durable workflow had fewer evidence gaps.",
      evidenceLinks: [".dove/experiments/EXPERIMENT_LOG.md"],
      comparisonTargets: ["baseline"]
    }
  }));

  const audit = extractJson(await call("tools/call", {
    name: "run_experiment_audit",
    arguments: {
      packetId: experimentPacketId,
      resultId: experimentResult.id,
      experimentId: "workflow-compare"
    }
  }));
  assert.equal(audit.experimentId, "workflow-compare");

  const bridge = extractJson(await call("tools/call", {
    name: "bridge_result_to_claim",
    arguments: {
      packetId: experimentPacketId,
      resultId: experimentResult.id,
      experimentId: "workflow-compare",
      auditIds: [audit.id],
      reason: "Validator explicitly checked the result-to-claim bridge."
    }
  }));
  assert.equal(bridge.claimId, "claim-1");

  extractJson(await call("tools/call", {
    name: "upsert_plan",
    arguments: {
      packetId: validationPacketId,
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
      packetId: validationPacketId,
      sections: [
        { id: "introduction", title: "Introduction", status: "drafting", goal: "Frame the problem." },
        { id: "method", title: "Method", status: "planned", goal: "Explain the workflow." }
      ]
    }
  }));

  extractJson(await call("tools/call", {
    name: "upsert_draft",
    arguments: {
      packetId: validationPacketId,
      sectionId: "introduction",
      title: "Introduction",
      body: "# Introduction\n\nThis workflow is promising. TODO[citation]: add stronger empirical support.\n",
      status: "drafting"
    }
  }));

  const figurePlan = extractJson(await call("tools/call", {
    name: "upsert_figure_plan",
    arguments: {
      packetId: validationPacketId,
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
  assert.equal(figurePlan.qaPath, ".dove/figures/qa.json");

  fs.writeFileSync(path.join(tempWorkspace, ".dove", "figures", "workflow-figure.template.svg"), "<svg />\n", "utf8");
  fs.writeFileSync(path.join(tempWorkspace, ".dove", "figures", "workflow-figure.editable.svg"), "<svg />\n", "utf8");

  const preparedFigure = extractJson(await call("tools/call", {
    name: "prepare_figure_generation",
    arguments: {
      packetId: validationPacketId,
      figureId: "workflow-figure",
      runId: "workflow-figure-run"
    }
  }));
  assert.equal(preparedFigure.runId, "workflow-figure-run");

  const importedFigure = extractJson(await call("tools/call", {
    name: "import_figure_generation",
    arguments: {
      packetId: validationPacketId,
      figureId: "workflow-figure",
      runId: "workflow-figure-run",
      svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Workflow</text></svg>",
      caption: "Workflow figure shows how evidence, claims, and review gates connect."
    }
  }));
  assert.equal(importedFigure.finalSvgPath, ".dove/figures/workflow-figure.final.svg");

  const figureQa = extractJson(await call("tools/call", { name: "validate_figure_pipeline", arguments: {} }));
  assert.equal(figureQa.issueCount, 0);

  extractJson(await call("tools/call", {
    name: "append_handoff",
    arguments: {
      fromRole: "builder",
      toRole: "reviewer",
      phase: "review",
      summary: "Proceed with review.",
      nextActions: ["Run the review loop"]
    }
  }));

  const review = extractJson(await call("tools/call", {
    name: "run_review_loop",
    arguments: {
      packetId: validationPacketId,
      scope: "introduction draft"
    }
  }));
  assert.notEqual(review.verdict, undefined);

  extractJson(await call("tools/call", {
    name: "append_handoff",
    arguments: {
      fromRole: "builder",
      toRole: "reviewer",
      phase: "review",
      summary: "Return to reviewer for validation signoff.",
      nextActions: ["Record the coherent validation verdict"]
    }
  }));

  extractJson(await call("tools/call", {
    name: "append_review_log",
    arguments: {
      packetId: validationPacketId,
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
  assert.equal(wiki.wikiPath, ".dove/wiki/index.md");

  extractJson(await call("tools/call", {
    name: "append_handoff",
    arguments: {
      fromRole: "builder",
      toRole: "reviewer",
      phase: "review",
      summary: "Return to reviewer to finalize the rebuttal issue board.",
      nextActions: ["Normalize rebuttal issues"]
    }
  }));

  const issues = extractJson(await call("tools/call", {
    name: "normalize_rebuttal_issues",
    arguments: {
      packetId: validationPacketId,
      issues: [
        { summary: "Clarify comparison protocol.", severity: "medium", evidenceLinks: [".dove/experiments/EXPERIMENT_LOG.md"] }
      ]
    }
  }));
  assert.equal(issues.items.length >= 1, true);

  const strategy = extractJson(await call("tools/call", { name: "build_rebuttal_strategy", arguments: { packetId: validationPacketId } }));
  assert.equal(strategy.strategyPath, ".dove/rebuttal/strategy.md");

  const rebuttal = extractJson(await call("tools/call", { name: "build_rebuttal", arguments: { packetId: validationPacketId } }));
  assert.equal(rebuttal.draftPath, ".dove/drafts/rebuttal.md");

  extractJson(await call("tools/call", {
    name: "append_handoff",
    arguments: {
      fromRole: "builder",
      toRole: "reviewer",
      phase: "review",
      summary: "Return to reviewer for post-rebuttal signoff.",
      nextActions: ["Record the final review verdict"]
    }
  }));

  extractJson(await call("tools/call", {
    name: "append_review_log",
    arguments: {
      packetId: validationPacketId,
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
      assignedRole: "planner",
      reviewRequiredBeforeFinalize: false,
      currentFocus: "Validator signoff cleared finalize gate.",
      nextAction: "Create and compare version snapshots."
    }
  }));

  const snapshotA = extractJson(await call("tools/call", {
    name: "create_version_snapshot",
    arguments: {
      packetId: validationPacketId,
      versionId: "validator-v1",
      summary: "Initial validator snapshot"
    }
  }));
  assert.equal(snapshotA.id, "validator-v1");

  extractJson(await call("tools/call", {
    name: "upsert_draft",
    arguments: {
      packetId: validationPacketId,
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
      assignedRole: "planner",
      reviewRequiredBeforeFinalize: false,
      currentFocus: "Second validator snapshot is ready.",
      nextAction: "Create the follow-up snapshot and compare lineage."
    }
  }));

  const snapshotB = extractJson(await call("tools/call", {
    name: "create_version_snapshot",
    arguments: {
      packetId: validationPacketId,
      versionId: "validator-v2",
      parentVersionId: "validator-v1",
      summary: "Second validator snapshot"
    }
  }));
  assert.equal(snapshotB.parentVersionId, "validator-v1");

  const comparison = extractJson(await call("tools/call", {
    name: "compare_versions",
    arguments: {
      packetId: validationPacketId,
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

  const initialFollowThrough = extractJson(await call("tools/call", { name: "query_operator_follow_through", arguments: {} }));
  assert.equal(initialFollowThrough.summary.itemCount, 0);

  const initialLessons = extractJson(await call("tools/call", { name: "query_operator_lessons", arguments: {} }));
  assert.equal(initialLessons.explicitOnly, true);
  assert.equal(initialLessons.noAutoCapture, true);
  assert.equal(initialLessons.noAutoApply, true);
  assert.equal(initialLessons.summary.activeLessonCount, 0);
  assert.equal(initialLessons.lessonsPath, ".dove/meta/operator-lessons.json");

  const recordedLesson = extractJson(await call("tools/call", {
    name: "record_operator_lesson",
    arguments: {
      title: "Keep MCP validator retrospectives distilled",
      problem: "Validator experience should be reusable without reading raw runtime traces.",
      decisions: ["Record a concise lesson through the explicit MCP tool."],
      pitfalls: ["Do not cite raw Trellis task logs as lesson sources."],
      validation: ["Query lessons by tag after recording."],
      nextTime: ["Close validation tasks with a short retrospective."],
      domain: "engineering",
      stage: "return",
      actorRole: "planner",
      tags: ["validator", "retrospective"],
      sourceArtifacts: [".dove/sessions/LATEST_SUMMARY.md"]
    }
  }));
  assert.equal(recordedLesson.summary.activeLessonCount, 1);
  assert.equal(recordedLesson.recordedLesson.title, "Keep MCP validator retrospectives distilled");

  const queriedLessons = extractJson(await call("tools/call", { name: "query_operator_lessons", arguments: { tag: "validator" } }));
  assert.equal(queriedLessons.resultCount, 1);
  assert.equal(queriedLessons.lessons[0].title, "Keep MCP validator retrospectives distilled");

  const rejectedLesson = await call("tools/call", {
    name: "record_operator_lesson",
    arguments: {
      title: "Reject raw task traces",
      problem: "Lessons must not depend on ignored raw task traces.",
      decisions: ["Reject Trellis task source artifacts."],
      pitfalls: ["Raw runtime logs are not portable knowledge."],
      validation: ["The MCP call returns an error."],
      nextTime: ["Use durable Dove summaries as source context."],
      sourceArtifacts: [".trellis/tasks/example/task.json"]
    }
  });
  assert.equal(rejectedLesson.isError, true);
  assert.match(rejectedLesson.content[0].text, /\.trellis\/tasks/);

  const questions = extractJson(await call("tools/call", { name: "query_open_questions", arguments: {} }));
  assert.equal(Array.isArray(questions.items), true);

  const decisions = extractJson(await call("tools/call", { name: "query_decisions", arguments: {} }));
  assert.equal(Array.isArray(decisions.items), true);

  const lineage = extractJson(await call("tools/call", { name: "query_lineage", arguments: {} }));
  assert.equal(Array.isArray(lineage.lineage), true);

  fs.writeFileSync(path.join(tempWorkspace, "main.tex"), "\\documentclass{article}\n\\begin{document}Validator\\end{document}\n", "utf8");
  const onboarding = extractJson(await call("tools/call", { name: "query_dove_onboarding", arguments: { writeMap: true } }));
  assert.equal(onboarding.mode, "dove-onboarding-query");
  assert.equal(onboarding.proposalOnly, true);
  assert.equal(onboarding.writeMap, false);
  assert.deepEqual(onboarding.writes, []);
  assert.equal(onboarding.diagnostics.writeMapForcedFalse, true);

  const paperPipeline = extractJson(await call("tools/call", { name: "query_paper_pipeline", arguments: {} }));
  assert.equal(paperPipeline.mode, "paper-pipeline-query");
  assert.equal(paperPipeline.proposalOnly, true);
  assert.deepEqual(paperPipeline.writes, []);
  assert.equal(paperPipeline.diagnostics.noCommandExecution, true);
  assert.equal(paperPipeline.diagnostics.noExternalProcess, true);
  assert.equal(paperPipeline.diagnostics.noGitInspection, true);

  const preparedIsolatedReview = extractJson(await call("tools/call", {
    name: "prepare_isolated_review",
    arguments: { packetId: validationPacketId, runId: "validator-isolated-review", scope: "validator MCP smoke" }
  }));
  assert.equal(preparedIsolatedReview.status, "prepared");
  fs.writeFileSync(path.join(tempWorkspace, preparedIsolatedReview.reportPath), "# Validator isolated report\n\nNo private transcript.\n", "utf8");
  fs.writeFileSync(path.join(tempWorkspace, preparedIsolatedReview.handoffPath), `${JSON.stringify({
    version: 1,
    runId: preparedIsolatedReview.runId,
    status: "completed",
    verdict: "coherent",
    reviewerId: "validator-mcp-reviewer",
    summary: "Validator MCP isolated handoff imported explicit artifacts only.",
    inputPath: preparedIsolatedReview.inputPath,
    inputSha256: preparedIsolatedReview.inputSha256,
    reportPath: preparedIsolatedReview.reportPath,
    reviewedArtifactPaths: preparedIsolatedReview.reviewedArtifactPaths,
    findings: [],
    actionItems: []
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(tempWorkspace, ".dove", "reviews", "isolated", "validator-isolated-review", "private-transcript.md"), "PRIVATE\n", "utf8");
  const importedIsolatedReview = extractJson(await call("tools/call", {
    name: "import_isolated_review",
    arguments: { packetId: validationPacketId, runId: "validator-isolated-review" }
  }));
  assert.equal(importedIsolatedReview.status, "imported");
  assert.equal(importedIsolatedReview.privateTranscriptImported, false);

  const paperAudit = extractJson(await call("tools/call", { name: "query_paper_audit", arguments: { scope: "validator" } }));
  assert.equal(paperAudit.mode, "audit-only");
  assert.equal(paperAudit.proposalOnly, true);
  assert.equal(paperAudit.noAutoApply, true);
  assert.deepEqual(paperAudit.writes, []);

  const doveOrchestrate = extractJson(await call("tools/call", {
    name: "query_dove_orchestrate",
    arguments: {
      request: "Validate the Dove orchestrate query surface.",
      domain: "engineering",
      stage: "execution",
      targetArtifacts: ["src/core/dove.mjs"],
      acceptanceChecks: ["tests or validation output"]
    }
  }));
  assert.equal(doveOrchestrate.mode, "dove-orchestrate-query");
  assert.equal(doveOrchestrate.proposalOnly, true);
  assert.equal(doveOrchestrate.noAutoApply, true);
  assert.deepEqual(doveOrchestrate.writes, []);
  assert.equal(doveOrchestrate.route.recommendedCommand, "project:dove.launch");
  assert.equal(doveOrchestrate.diagnostics.noRefresh, true);
  assert.equal(doveOrchestrate.diagnostics.noCommandExecution, true);
  assert.equal(doveOrchestrate.diagnostics.noGitInspection, true);

  const doveMission = extractJson(await call("tools/call", {
    name: "query_dove_mission",
    arguments: {
      goal: "Validate the Dove mission query surface.",
      domain: "engineering",
      stage: "execution",
      targetArtifacts: ["src/core/dove.mjs"],
      acceptanceChecks: ["tests or validation output"]
    }
  }));
  assert.equal(doveMission.mode, "dove-mission-query");
  assert.equal(doveMission.proposalOnly, true);
  assert.equal(doveMission.noAutoApply, true);
  assert.deepEqual(doveMission.writes, []);
  assert.equal(doveMission.mission.domain, "engineering");
  assert.equal(doveMission.mission.primaryRole, "builder");

  const doveBoard = extractJson(await call("tools/call", {
    name: "query_dove_mission_board",
    arguments: {
      domain: "engineering",
      stage: "execution"
    }
  }));
  assert.equal(doveBoard.mode, "dove-mission-board-query");
  assert.equal(doveBoard.proposalOnly, true);
  assert.equal(doveBoard.noAutoApply, true);
  assert.deepEqual(doveBoard.writes, []);
  assert.equal(doveBoard.workspace.durableRoot, ".dove");
  assert.equal(doveBoard.workspace.authoritativeRoot, ".dove");
  assert.equal(doveBoard.workspace.authorityManifest.status, "authoritative");
  assert.equal(doveBoard.workspace.authorityManifest.authoritativeRoot, ".dove");
  assert.equal(doveBoard.workspace.authorityManifest.currentWriteAuthority, ".dove");
  assert.equal(doveBoard.diagnostics.noRefresh, true);

  fs.mkdirSync(path.join(tempWorkspace, "src", "core"), { recursive: true });
  fs.mkdirSync(path.join(tempWorkspace, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempWorkspace, "tmp"), { recursive: true });
  fs.writeFileSync(path.join(tempWorkspace, "src", "core", "dove.mjs"), "export const validator = true;\n", "utf8");
  fs.writeFileSync(path.join(tempWorkspace, "scripts", "validate-mcp.mjs"), "console.log('validator');\n", "utf8");
  fs.writeFileSync(path.join(tempWorkspace, "tmp", "mcp-validation.log"), "ok 1 mcp validation passed\nexit 0\n", "utf8");

  const doveAudit = extractJson(await call("tools/call", {
    name: "query_dove_audit",
    arguments: {
      goal: "Validate the Dove audit query surface.",
      domain: "engineering",
      changedFilePaths: ["src/core/dove.mjs"],
      testEvidencePaths: ["scripts/validate-mcp.mjs"],
      validationOutputPaths: ["tmp/mcp-validation.log"]
    }
  }));
  assert.equal(doveAudit.mode, "dove-audit-query");
  assert.equal(doveAudit.proposalOnly, true);
  assert.equal(doveAudit.noAutoApply, true);
  assert.deepEqual(doveAudit.writes, []);
  assert.equal(doveAudit.diagnostics.noRefresh, true);
  assert.equal(doveAudit.diagnostics.noCommandExecution, true);
  assert.equal(doveAudit.diagnostics.noGitInspection, true);

  const doveReturn = extractJson(await call("tools/call", {
    name: "query_dove_return",
    arguments: {
      goal: "Validate the Dove return query surface.",
      domain: "engineering",
      changedFilePaths: ["src/core/dove.mjs"],
      testEvidencePaths: ["scripts/validate-mcp.mjs"],
      validationOutputPaths: ["tmp/mcp-validation.log"]
    }
  }));
  assert.equal(doveReturn.mode, "dove-return-query");
  assert.equal(doveReturn.proposalOnly, true);
  assert.equal(doveReturn.noAutoApply, true);
  assert.deepEqual(doveReturn.writes, []);
  assert.equal(doveReturn.mission.domain, "engineering");
  assert.equal(["ready", "needs-audit", "needs-review", "needs-execution", "blocked"].includes(doveReturn.returnStatus), true);
  assert.equal(doveReturn.engineeringEvidence.declaredInputsOnly, true);
  assert.equal(doveReturn.engineeringEvidence.noCommandExecution, true);
  assert.equal(doveReturn.engineeringEvidence.noGitInspection, true);
  assert.equal(doveReturn.engineeringEvidence.changedFiles.existingPaths.includes("src/core/dove.mjs"), true);
  assert.equal(doveReturn.engineeringEvidence.validationEvidence.existingPaths.includes("scripts/validate-mcp.mjs"), true);
  assert.equal(doveReturn.engineeringEvidence.validationOutput.status, "passed");

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

  fs.writeFileSync(path.join(tempWorkspace, ".dove", "reviews", "concerns.json"), `${JSON.stringify({
    version: 2,
    items: [{
      id: "validator-materialize-gap",
      summary: "Need a governed proposal-to-packet bridge.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [".dove/reviews/log.md"],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(tempWorkspace, ".dove", "reviews", "REVIEW_STATE.json"), `${JSON.stringify({
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the validator materialization gap."],
    unresolvedConcernIds: ["validator-materialize-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  }, null, 2)}\n`, "utf8");

  const refreshedMetaOptimize = extractJson(await call("tools/call", {
    name: "query_meta_optimize",
    arguments: {}
  }));
  const governanceCoverage = extractJson(await call("tools/call", {
    name: "query_governance_coverage_report",
    arguments: {}
  }));
  assert.equal(governanceCoverage.status, "ok");
  assert.equal(Array.isArray(governanceCoverage.guardedIds), true);
  const topPack = refreshedMetaOptimize.remediationPacks.packs[0];
  const packetMaterializationPath = topPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet") ?? null;
  const followThroughActorRole = packetMaterializationPath?.assignedRole ?? topPack.packetPointers?.[0]?.assignedRole ?? topPack.conversionHints?.[0]?.assignedRole ?? "planner";
  const materializedPacket = extractJson(await call("tools/call", {
    name: "launch_dove_mission",
    arguments: {
      sourceType: "remediation-pack",
      sourceId: topPack.id,
      actorRole: followThroughActorRole,
      goal: "Launch the validator remediation mission through Dove.",
      domain: "engineering",
      stage: "execution",
      targetArtifacts: ["src/core/dove.mjs"],
      acceptanceChecks: ["changed files", "tests or validation output"],
      decisionSummary: "Launch the top remediation pack into a real Dove mission packet.",
      selectedConversionPathKey: packetMaterializationPath?.deterministicKey ?? null,
      packetId: packetMaterializationPath?.targetId ?? "task-validator-follow-through",
      executeBy: "2099-01-01T00:00:00.000Z",
      reviewAfter: "2099-01-01T12:00:00.000Z"
    }
  }));
  assert.equal(materializedPacket.mode, "dove-launch-mission");
  assert.equal(materializedPacket.status, "materialized");
  assert.equal(materializedPacket.governance.currentWriteAuthority, ".dove");
  assert.equal(materializedPacket.governance.noAutonomyExecution, true);
  assert.equal(typeof materializedPacket.materialization.packetId, "string");
  assert.equal(materializedPacket.materialization.missionPacketId, materializedPacket.materialization.packetId);
  assert.equal(materializedPacket.missionPacket.id, materializedPacket.materialization.packetId);
  assert.equal(materializedPacket.missionPacket.storePath, ".dove/task-packets/index.json");

  const autonomyRun = extractJson(await call("tools/call", {
    name: "run_autonomy_once",
    arguments: { packetId: materializedPacket.materialization.packetId, actorRole: "planner" }
  }));
  assert.equal(autonomyRun.status, "completed");
  assert.equal(autonomyRun.packetId, materializedPacket.materialization.packetId);

  const artifactManifest = extractJson(await call("tools/call", {
    name: "read_artifact_context_manifest",
    arguments: { artifactPath: ".dove/orchestration/board.json" }
  }));
  assert.equal(artifactManifest.artifactPath, ".dove/orchestration/board.json");

  const journalSummary = extractJson(await call("tools/call", { name: "summarize_session_journal", arguments: {} }));
  assert.equal(journalSummary.summaryPath, ".dove/sessions/LATEST_SUMMARY.md");

  const finalWorkspaceIndex = extractJson(await call("tools/call", { name: "query_workspace_index", arguments: {} }));
  assert.equal(finalWorkspaceIndex.runtime.lastStatus, "completed");
  assert.equal(finalWorkspaceIndex.runtime.lastSelectedPacketId, materializedPacket.materialization.packetId);

  extractJson(await call("tools/call", { name: "sync_checklist", arguments: {} }));

  const artifacts = extractJson(await call("tools/call", { name: "list_artifacts", arguments: {} }));
  assert.equal(artifacts.state.exists, true);
  assert.equal(artifacts.revisionPlan.exists, true);

  console.log("MCP validation passed.");
}

try {
  await main();
  kill();
} catch (error) {
  kill();
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempWorkspace, { recursive: true, force: true });
}
