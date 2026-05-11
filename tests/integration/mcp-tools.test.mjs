import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GOVERNANCE_EXEMPT_MUTATIONS, GOVERNANCE_GUARDED_MUTATIONS, GOVERNANCE_READONLY_TOOLS } from "../../src/core/index.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import { toolDefinitions } from "../../src/mcp/tool-definitions.mjs";

function extractToolJson(result) {
  assert.ok(result.content?.[0]?.text, "Expected text content in MCP tool result");
  assert.notEqual(result.isError, true, result.content[0].text);
  return JSON.parse(result.content[0].text);
}

function seedTaskPacket(root, packetId = "mcp-main-packet") {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: packetId,
    title: "MCP integration packet",
    summary: "Integration test packet for task-scoped MCP writes.",
    sourceType: "test-task",
    sourceId: packetId,
    status: "pending",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    currentFocus: "Run the MCP integration flow.",
    nextAction: "Continue the scoped MCP flow.",
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

test("MCP tool definitions include the mature workflow tools", () => {
  const names = toolDefinitions.map((tool) => tool.name);
  assert.deepEqual(names, [
    "ensure_workspace",
    "init_project",
    "read_state",
    "query_task_graph",
    "query_open_questions",
    "query_decisions",
    "query_lineage",
    "query_workspace_index",
    "query_meta_optimize",
    "query_governance_coverage_report",
    "query_operator_lessons",
    "query_operator_follow_through",
    "query_paper_audit",
    "query_dove_onboarding",
    "query_paper_pipeline",
    "query_dove_orchestrate",
    "query_dove_mission",
    "query_dove_mission_board",
    "query_dove_status",
    "query_dove_audit",
    "query_dove_return",
    "launch_dove_mission",
    "query_program_approvals",
    "query_campaigns",
    "query_boundary_report",
    "read_role_context_manifest",
    "read_phase_context_manifest",
    "read_packet_context_manifest",
    "read_artifact_context_manifest",
    "read_action_context_bundle",
    "summarize_session_journal",
    "upsert_orchestration_board",
    "append_handoff",
    "update_research_brief",
    "register_source",
    "upsert_note",
    "upsert_claims",
    "upsert_plan",
    "upsert_outline",
    "upsert_draft",
    "upsert_experiment_plan",
    "upsert_experiment_result",
    "run_experiment_audit",
    "bridge_result_to_claim",
    "run_review_loop",
    "append_review_log",
    "prepare_isolated_review",
    "import_isolated_review",
    "upsert_revision_plan",
    "set_section_status",
    "sync_checklist",
    "sync_citations",
    "refresh_wiki",
    "normalize_rebuttal_issues",
    "build_rebuttal_strategy",
    "build_rebuttal",
    "create_version_snapshot",
    "compare_versions",
    "list_artifacts",
    "upsert_figure_plan",
    "prepare_figure_generation",
    "import_figure_generation",
    "validate_figure_pipeline",
    "record_operator_lesson",
    "record_operator_follow_through",
    "issue_program_approval",
    "plan_campaign",
    "revoke_program_approval",
    "materialize_guidance_packet",
    "run_autonomy_once",
    "run_autonomy_foreground",
    "run_autonomy_operate"
  ]);
});

test("doctor MCP probe requires current Dove tools without calling mutating tools", () => {
  const probeText = fs.readFileSync(path.join(process.cwd(), "scripts", "doctor-mcp-probe.mjs"), "utf8");
  for (const requiredTool of ["query_dove_orchestrate", "query_dove_mission", "query_dove_mission_board", "query_dove_audit", "query_dove_return", "query_program_approvals", "launch_dove_mission", "materialize_guidance_packet", "run_autonomy_operate"]) {
    assert.match(probeText, new RegExp(`"${requiredTool}"`));
  }
  for (const mutatingTool of ["launch_dove_mission", "materialize_guidance_packet", "run_autonomy_once", "run_autonomy_foreground", "run_autonomy_operate"]) {
    assert.equal(probeText.includes(`tools/call", { name: "${mutatingTool}"`), false, `doctor probe must not call mutating tool ${mutatingTool}`);
  }
});

test("MCP validation scripts share bounded stdio client timeouts", () => {
  const helperText = fs.readFileSync(path.join(process.cwd(), "scripts", "mcp-stdio-client.mjs"), "utf8");
  assert.match(helperText, /CALL_TIMEOUT_MS\s*=\s*15000/);
  assert.match(helperText, /setTimeout\(\(\) => \{/);
  assert.match(helperText, /pending\.set\(id, \{ resolve, reject, timer, method, label: callLabel \}\)/);
  assert.match(helperText, /clearTimeout\(waiter\.timer\)/);
  assert.match(helperText, /server\.kill\(\)/);

  for (const scriptPath of ["scripts/validate-mcp.mjs", "scripts/doctor-mcp-probe.mjs"]) {
    const scriptText = fs.readFileSync(path.join(process.cwd(), scriptPath), "utf8");
    assert.match(scriptText, /createMcpStdioClient/);
    assert.match(scriptText, /notify\("notifications\/initialized"\)/);
    assert.doesNotMatch(scriptText, /const pending = new Map\(\)/);
  }
});

test("every MCP tool surface is classified as guarded, exempt, or read-only", () => {
  const classifiedToolNames = new Set([
    ...GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.surfaceBindings?.mcpTool).filter(Boolean),
    ...GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => entry.surfaceBindings?.mcpTool).filter(Boolean),
    ...GOVERNANCE_READONLY_TOOLS
  ]);
  for (const tool of toolDefinitions) {
    assert.equal(classifiedToolNames.has(tool.name), true, `Unclassified MCP tool: ${tool.name}`);
  }
});

test("operator lessons MCP tools query, record, and reject raw Trellis traces", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dove-mcp-lessons-"));
  try {
    const empty = extractToolJson(dispatchTool(root, "query_operator_lessons", {}));
    assert.equal(empty.explicitOnly, true);
    assert.equal(empty.noAutoCapture, true);
    assert.equal(empty.noAutoApply, true);
    assert.equal(empty.resultCount, 0);
    assert.equal(empty.lessonsPath, ".dove/meta/operator-lessons.json");

    const recorded = extractToolJson(dispatchTool(root, "record_operator_lesson", {
      title: "Keep retrospectives distilled",
      problem: "Raw traces are too noisy for future operators.",
      decisions: ["Record only reusable decisions."],
      pitfalls: ["Do not import raw runtime logs."],
      validation: ["Query lessons after recording."],
      nextTime: ["Write the lesson at task closure."],
      domain: "engineering",
      stage: "return",
      actorRole: "planner",
      tags: ["retrospective", "lessons"],
      sourceArtifacts: [".dove/meta/long-horizon-memory.json"]
    }));
    assert.equal(recorded.summary.activeLessonCount, 1);
    assert.equal(recorded.recordedLesson.title, "Keep retrospectives distilled");

    const queried = extractToolJson(dispatchTool(root, "query_operator_lessons", { tag: "lessons" }));
    assert.equal(queried.resultCount, 1);
    assert.equal(queried.lessons[0].title, "Keep retrospectives distilled");

    const rejected = dispatchTool(root, "record_operator_lesson", {
      title: "Reject raw traces",
      problem: "Raw Trellis task traces should stay ignored.",
      decisions: ["Keep source artifacts curated."],
      pitfalls: ["Do not point lessons at trace folders."],
      validation: ["Attempting to cite raw traces fails."],
      nextTime: ["Use durable Dove summaries instead."],
      sourceArtifacts: [".trellis/tasks/example/task.json"]
    });
    assert.equal(rejected.isError, true);
    assert.match(rejected.content[0].text, /\.trellis\/tasks/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("onboarding, status, and paper pipeline MCP queries stay proposal-only", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dove-mcp-query-surfaces-"));
  try {
    fs.writeFileSync(path.join(root, "main.tex"), "\\documentclass{article}\n\\begin{document}Hi\\end{document}\n", "utf8");
    const onboarding = extractToolJson(dispatchTool(root, "query_dove_onboarding", { writeMap: true }));
    assert.equal(onboarding.mode, "dove-onboarding-query");
    assert.equal(onboarding.proposalOnly, true);
    assert.equal(onboarding.writeMap, false);
    assert.deepEqual(onboarding.writes, []);
    assert.equal(onboarding.diagnostics.writeMapForcedFalse, true);
    assert.equal(fs.existsSync(path.join(root, ".dove", "workspace", "artifact-map.json")), false);

    const status = extractToolJson(dispatchTool(root, "query_dove_status", { domain: "paper" }));
    assert.equal(status.mode, "dove-status-query");
    assert.equal(status.proposalOnly, true);
    assert.equal(status.query, true);
    assert.deepEqual(status.writes, []);
    assert.ok(status.taskGraph && typeof status.taskGraph === "object");
    assert.ok(status.paperLifecycle && typeof status.paperLifecycle === "object");
    assert.ok(status.openQuestions && typeof status.openQuestions === "object");
    assert.ok(status.decisions && typeof status.decisions === "object");
    assert.ok(status.lineage && typeof status.lineage === "object");

    const pipeline = extractToolJson(dispatchTool(root, "query_paper_pipeline", {}));
    assert.equal(pipeline.mode, "paper-pipeline-query");
    assert.equal(pipeline.proposalOnly, true);
    assert.equal(pipeline.noAutoApply, true);
    assert.deepEqual(pipeline.writes, []);
    assert.equal(pipeline.diagnostics.noCommandExecution, true);
    assert.equal(pipeline.diagnostics.noExternalProcess, true);
    assert.equal(pipeline.diagnostics.noGitInspection, true);
    assert.ok(pipeline.stages.some((stage) => stage.id === "return" && stage.commandId === "project:dove.return"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("isolated review MCP tools prepare and import explicit handoff artifacts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dove-mcp-isolated-review-"));
  try {
    seedTaskPacket(root);
    const prepared = extractToolJson(dispatchTool(root, "prepare_isolated_review", { packetId: "mcp-main-packet", runId: "mcp-isolated-1", scope: "mcp validation" }));
    assert.equal(prepared.status, "prepared");
    assert.equal(prepared.runId, "mcp-isolated-1");
    assert.match(prepared.inputPath, /\.dove\/reviews\/isolated\/mcp-isolated-1\/input\.json/);

    const reportPath = path.join(root, prepared.reportPath);
    fs.writeFileSync(reportPath, "# MCP isolated report\n\nExplicit report only.\n", "utf8");
    fs.writeFileSync(path.join(root, prepared.handoffPath), `${JSON.stringify({
      version: 1,
      runId: prepared.runId,
      status: "completed",
      verdict: "coherent",
      reviewerId: "mcp-reviewer",
      summary: "MCP isolated review returned explicit artifacts only.",
      inputPath: prepared.inputPath,
      inputSha256: prepared.inputSha256,
      reportPath: prepared.reportPath,
      reviewedArtifactPaths: prepared.reviewedArtifactPaths,
      findings: [],
      actionItems: []
    }, null, 2)}\n`, "utf8");
    fs.writeFileSync(path.join(root, ".dove", "reviews", "isolated", "mcp-isolated-1", "private-transcript.md"), "PRIVATE\n", "utf8");

    const imported = extractToolJson(dispatchTool(root, "import_isolated_review", { packetId: "mcp-main-packet", runId: "mcp-isolated-1" }));
    assert.equal(imported.status, "imported");
    assert.equal(imported.privateTranscriptImported, false);
    assert.equal(imported.verdict, "coherent");
    const reviewLog = fs.readFileSync(path.join(root, ".dove", "reviews", "log.md"), "utf8");
    assert.doesNotMatch(reviewLog, /PRIVATE/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("role-bound MCP tools expose explicit override fields", () => {
  const roleBoundTools = [
    "upsert_orchestration_board",
    "append_handoff",
    "upsert_claims",
    "upsert_experiment_plan",
    "upsert_experiment_result",
    "run_experiment_audit",
    "bridge_result_to_claim",
    "run_review_loop",
    "append_review_log",
    "prepare_isolated_review",
    "import_isolated_review",
    "upsert_revision_plan",
    "normalize_rebuttal_issues",
    "build_rebuttal_strategy",
    "create_version_snapshot",
    "compare_versions",
    "record_operator_lesson",
    "record_operator_follow_through",
    "materialize_guidance_packet",
    "launch_dove_mission"
  ];

  for (const name of roleBoundTools) {
    const tool = toolDefinitions.find((item) => item.name === name);
    assert.ok(tool, `missing tool definition for ${name}`);
    assert.ok(tool.inputSchema.properties.actorRole, `${name} should expose actorRole`);
    assert.ok(tool.inputSchema.properties.policyOverrideReason, `${name} should expose policyOverrideReason`);
  }

  const taskScopedTools = [
    "update_research_brief",
    "register_source",
    "upsert_note",
    "upsert_claims",
    "upsert_plan",
    "upsert_outline",
    "upsert_draft",
    "set_section_status",
    "upsert_figure_plan",
    "prepare_figure_generation",
    "import_figure_generation",
    "build_rebuttal",
    "append_review_log",
    "run_review_loop",
    "prepare_isolated_review",
    "import_isolated_review",
    "upsert_revision_plan",
    "normalize_rebuttal_issues",
    "build_rebuttal_strategy",
    "upsert_experiment_plan",
    "upsert_experiment_result",
    "run_experiment_audit",
    "bridge_result_to_claim",
    "create_version_snapshot",
    "compare_versions"
  ];
  for (const name of taskScopedTools) {
    const tool = toolDefinitions.find((item) => item.name === name);
    assert.ok(tool, `missing task-scoped tool definition for ${name}`);
    for (const field of ["packetId", "taskPacketId", "missionPacketId", "target", "packetTarget", "taskName"]) {
      assert.ok(tool.inputSchema.properties[field], `${name} should expose ${field}`);
    }
  }

  const followThroughTool = toolDefinitions.find((item) => item.name === "record_operator_follow_through");
  const approvalsQueryTool = toolDefinitions.find((item) => item.name === "query_program_approvals");
  const doveOrchestrateQueryTool = toolDefinitions.find((item) => item.name === "query_dove_orchestrate");
  const doveMissionQueryTool = toolDefinitions.find((item) => item.name === "query_dove_mission");
  const doveBoardQueryTool = toolDefinitions.find((item) => item.name === "query_dove_mission_board");
  const doveStatusQueryTool = toolDefinitions.find((item) => item.name === "query_dove_status");
  const doveAuditQueryTool = toolDefinitions.find((item) => item.name === "query_dove_audit");
  const doveReturnQueryTool = toolDefinitions.find((item) => item.name === "query_dove_return");
  const doveOnboardingQueryTool = toolDefinitions.find((item) => item.name === "query_dove_onboarding");
  const paperPipelineQueryTool = toolDefinitions.find((item) => item.name === "query_paper_pipeline");
  const prepareIsolatedReviewTool = toolDefinitions.find((item) => item.name === "prepare_isolated_review");
  const importIsolatedReviewTool = toolDefinitions.find((item) => item.name === "import_isolated_review");
  const prepareFigureTool = toolDefinitions.find((item) => item.name === "prepare_figure_generation");
  const importFigureTool = toolDefinitions.find((item) => item.name === "import_figure_generation");
  const issueApprovalTool = toolDefinitions.find((item) => item.name === "issue_program_approval");
  const revokeApprovalTool = toolDefinitions.find((item) => item.name === "revoke_program_approval");
  const materializeTool = toolDefinitions.find((item) => item.name === "materialize_guidance_packet");
  const launchDoveTool = toolDefinitions.find((item) => item.name === "launch_dove_mission");
  const foregroundTool = toolDefinitions.find((item) => item.name === "run_autonomy_foreground");
  const operateTool = toolDefinitions.find((item) => item.name === "run_autonomy_operate");
  assert.ok(approvalsQueryTool, "query_program_approvals should exist");
  assert.ok(doveOrchestrateQueryTool, "query_dove_orchestrate should exist");
  assert.ok(doveMissionQueryTool, "query_dove_mission should exist");
  assert.ok(doveBoardQueryTool, "query_dove_mission_board should exist");
  assert.ok(doveStatusQueryTool, "query_dove_status should exist");
  assert.ok(doveAuditQueryTool, "query_dove_audit should exist");
  assert.ok(doveReturnQueryTool, "query_dove_return should exist");
  assert.ok(doveOnboardingQueryTool, "query_dove_onboarding should exist");
  assert.ok(paperPipelineQueryTool, "query_paper_pipeline should exist");
  assert.ok(prepareIsolatedReviewTool, "prepare_isolated_review should exist");
  assert.ok(importIsolatedReviewTool, "import_isolated_review should exist");
  assert.ok(prepareFigureTool, "prepare_figure_generation should exist");
  assert.ok(importFigureTool, "import_figure_generation should exist");
  assert.ok(doveOnboardingQueryTool.inputSchema.properties.maxDepth, "query_dove_onboarding should expose maxDepth");
  assert.ok(prepareIsolatedReviewTool.inputSchema.properties.reviewedArtifactPaths, "prepare_isolated_review should expose reviewedArtifactPaths");
  assert.ok(importIsolatedReviewTool.inputSchema.properties.handoffPath, "import_isolated_review should expose handoffPath");
  assert.ok(prepareFigureTool.inputSchema.properties.figureId, "prepare_figure_generation should expose figureId");
  assert.ok(prepareFigureTool.inputSchema.properties.materialHints, "prepare_figure_generation should expose materialHints");
  assert.ok(prepareFigureTool.inputSchema.properties.executeProvider, "prepare_figure_generation should expose executeProvider");
  assert.ok(importFigureTool.inputSchema.properties.outputManifestPath, "import_figure_generation should expose outputManifestPath");
  assert.ok(importFigureTool.inputSchema.properties.caption, "import_figure_generation should expose caption");
  assert.ok(doveOrchestrateQueryTool.inputSchema.properties.request, "query_dove_orchestrate should expose request");
  assert.ok(doveOrchestrateQueryTool.inputSchema.properties.domain, "query_dove_orchestrate should expose domain");
  assert.ok(doveOrchestrateQueryTool.inputSchema.properties.stage, "query_dove_orchestrate should expose stage");
  assert.ok(doveOrchestrateQueryTool.inputSchema.properties.allowAutonomy, "query_dove_orchestrate should expose allowAutonomy");
  assert.ok(doveMissionQueryTool.inputSchema.properties.domain, "query_dove_mission should expose domain");
  assert.ok(doveMissionQueryTool.inputSchema.properties.acceptanceChecks, "query_dove_mission should expose acceptanceChecks");
  assert.ok(doveBoardQueryTool.inputSchema.properties.domain, "query_dove_mission_board should expose domain");
  assert.ok(doveBoardQueryTool.inputSchema.properties.stage, "query_dove_mission_board should expose stage");
  assert.ok(doveBoardQueryTool.inputSchema.properties.packetId, "query_dove_mission_board should expose packetId");
  assert.ok(doveBoardQueryTool.inputSchema.properties.missionPacketId, "query_dove_mission_board should expose missionPacketId");
  assert.ok(doveBoardQueryTool.inputSchema.properties.status, "query_dove_mission_board should expose status");
  assert.ok(doveBoardQueryTool.inputSchema.properties.includeArchived, "query_dove_mission_board should expose includeArchived");
  assert.ok(doveStatusQueryTool.inputSchema.properties.domain, "query_dove_status should expose domain");
  assert.ok(doveStatusQueryTool.inputSchema.properties.stage, "query_dove_status should expose stage");
  assert.ok(doveStatusQueryTool.inputSchema.properties.packetId, "query_dove_status should expose packetId");
  assert.ok(doveStatusQueryTool.inputSchema.properties.status, "query_dove_status should expose status");
  assert.ok(doveStatusQueryTool.inputSchema.properties.includeArchived, "query_dove_status should expose includeArchived");
  assert.ok(doveAuditQueryTool.inputSchema.properties.scope, "query_dove_audit should expose scope");
  assert.ok(doveAuditQueryTool.inputSchema.properties.changedFilePaths, "query_dove_audit should expose changedFilePaths");
  assert.ok(doveAuditQueryTool.inputSchema.properties.validationOutputPaths, "query_dove_audit should expose validationOutputPaths");
  assert.ok(doveReturnQueryTool.inputSchema.properties.validationEvidencePaths, "query_dove_return should expose validationEvidencePaths");
  assert.ok(doveReturnQueryTool.inputSchema.properties.changedFilePaths, "query_dove_return should expose changedFilePaths");
  assert.ok(doveReturnQueryTool.inputSchema.properties.testEvidencePaths, "query_dove_return should expose testEvidencePaths");
  assert.ok(doveReturnQueryTool.inputSchema.properties.validationOutputPaths, "query_dove_return should expose validationOutputPaths");
  assert.ok(doveReturnQueryTool.inputSchema.properties.validationOutput, "query_dove_return should expose validationOutput");
  assert.ok(doveReturnQueryTool.inputSchema.properties.reviewEvidencePaths, "query_dove_return should expose reviewEvidencePaths");
  assert.ok(doveReturnQueryTool.inputSchema.properties.scope, "query_dove_return should expose scope");
  assert.ok(issueApprovalTool.inputSchema.properties.continuationFromRunId, "issue_program_approval should expose continuationFromRunId for review-to-reapproval bridging");
  assert.ok(issueApprovalTool.inputSchema.properties.noteTitle, "issue_program_approval should expose noteTitle for approved note steps");
  assert.ok(issueApprovalTool.inputSchema.properties.auditResultId, "issue_program_approval should expose auditResultId for approved experiment audit steps");
  assert.ok(issueApprovalTool.inputSchema.properties.bridgeResultId, "issue_program_approval should expose bridgeResultId for approved result bridge steps");
  assert.ok(issueApprovalTool.inputSchema.properties.reviewScope, "issue_program_approval should expose reviewScope for approved review-loop steps");
  assert.ok(issueApprovalTool.inputSchema.properties.stepSequence, "issue_program_approval should expose stepSequence for multi-step authority envelopes");
  assert.ok(issueApprovalTool.inputSchema.properties.autonomyPolicy, "issue_program_approval should expose autonomyPolicy for objective-aware step selection");
  assert.ok(issueApprovalTool.inputSchema.properties.packetId, "issue_program_approval should expose packetId");
  assert.ok(issueApprovalTool.inputSchema.properties.programRunId, "issue_program_approval should expose programRunId");
  assert.ok(issueApprovalTool.inputSchema.properties.approvalId, "issue_program_approval should expose approvalId");
  assert.ok(revokeApprovalTool.inputSchema.properties.approvalId, "revoke_program_approval should expose approvalId");
  assert.ok(followThroughTool.inputSchema.properties.workerRole, "record_operator_follow_through should expose workerRole for planner-supervised envelopes");
  assert.ok(materializeTool.inputSchema.properties.workerRole, "materialize_guidance_packet should expose workerRole for planner-supervised envelopes");
  assert.ok(followThroughTool.inputSchema.properties.programId, "record_operator_follow_through should expose programId for program-linked execution intent");
  assert.ok(materializeTool.inputSchema.properties.programId, "materialize_guidance_packet should expose programId for program-linked packets");
  assert.ok(materializeTool.inputSchema.properties.programRunId, "materialize_guidance_packet should expose programRunId for approved program runs");
  assert.ok(materializeTool.inputSchema.properties.approvalId, "materialize_guidance_packet should expose approvalId for approved program runs");
  assert.ok(materializeTool.inputSchema.properties.allowedStepType, "materialize_guidance_packet should expose allowedStepType for approved bounded program steps");
  assert.ok(materializeTool.inputSchema.properties.noteTitle, "materialize_guidance_packet should expose noteTitle for approved note steps");
  assert.ok(materializeTool.inputSchema.properties.auditResultId, "materialize_guidance_packet should expose auditResultId for approved experiment audit steps");
  assert.ok(materializeTool.inputSchema.properties.bridgeResultId, "materialize_guidance_packet should expose bridgeResultId for approved result bridge steps");
  assert.ok(materializeTool.inputSchema.properties.reviewScope, "materialize_guidance_packet should expose reviewScope for approved review-loop steps");
  assert.ok(launchDoveTool, "launch_dove_mission should exist");
  assert.ok(launchDoveTool.inputSchema.properties.actorRole, "launch_dove_mission should expose actorRole");
  assert.ok(launchDoveTool.inputSchema.properties.sourceType, "launch_dove_mission should expose sourceType");
  assert.ok(launchDoveTool.inputSchema.properties.sourceId, "launch_dove_mission should expose sourceId");
  assert.ok(launchDoveTool.inputSchema.properties.domain, "launch_dove_mission should expose domain");
  assert.ok(launchDoveTool.inputSchema.properties.stage, "launch_dove_mission should expose stage");
  assert.ok(launchDoveTool.inputSchema.properties.missionPacketId, "launch_dove_mission should expose missionPacketId");
  assert.ok(launchDoveTool.inputSchema.properties.executeBy, "launch_dove_mission should expose executeBy");
  assert.ok(launchDoveTool.inputSchema.properties.reviewAfter, "launch_dove_mission should expose reviewAfter");
  assert.ok(launchDoveTool.inputSchema.properties.policyOverrideReason, "launch_dove_mission should expose policy override fields");
  assert.ok(foregroundTool, "run_autonomy_foreground should exist");
  assert.ok(foregroundTool.inputSchema.properties.maxSteps, "run_autonomy_foreground should expose maxSteps");
  assert.ok(foregroundTool.inputSchema.properties.packetId, "run_autonomy_foreground should expose packetId");
  assert.ok(foregroundTool.inputSchema.properties.programRunId, "run_autonomy_foreground should expose programRunId");
  assert.ok(foregroundTool.inputSchema.properties.approvalId, "run_autonomy_foreground should expose approvalId");
  assert.ok(operateTool, "run_autonomy_operate should exist");
  assert.ok(operateTool.inputSchema.properties.objective, "run_autonomy_operate should expose objective");
  assert.ok(operateTool.inputSchema.properties.sourceType, "run_autonomy_operate should expose sourceType");
  assert.ok(operateTool.inputSchema.properties.sourceId, "run_autonomy_operate should expose sourceId");
  assert.ok(operateTool.inputSchema.properties.stepSequence, "run_autonomy_operate should expose stepSequence");
  assert.ok(operateTool.inputSchema.properties.campaignId, "run_autonomy_operate should expose campaignId");
});
