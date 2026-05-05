import test from "node:test";
import assert from "node:assert/strict";

import { GOVERNANCE_EXEMPT_MUTATIONS, GOVERNANCE_GUARDED_MUTATIONS, GOVERNANCE_READONLY_TOOLS } from "../../src/core/index.mjs";
import { toolDefinitions } from "../../src/mcp/tool-definitions.mjs";

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
    "query_operator_follow_through",
    "query_paper_audit",
    "query_dove_orchestrate",
    "query_dove_mission",
    "query_dove_mission_board",
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
    "validate_figure_pipeline",
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
    "upsert_revision_plan",
    "normalize_rebuttal_issues",
    "build_rebuttal_strategy",
    "create_version_snapshot",
    "compare_versions",
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

  const followThroughTool = toolDefinitions.find((item) => item.name === "record_operator_follow_through");
  const approvalsQueryTool = toolDefinitions.find((item) => item.name === "query_program_approvals");
  const doveOrchestrateQueryTool = toolDefinitions.find((item) => item.name === "query_dove_orchestrate");
  const doveMissionQueryTool = toolDefinitions.find((item) => item.name === "query_dove_mission");
  const doveBoardQueryTool = toolDefinitions.find((item) => item.name === "query_dove_mission_board");
  const doveAuditQueryTool = toolDefinitions.find((item) => item.name === "query_dove_audit");
  const doveReturnQueryTool = toolDefinitions.find((item) => item.name === "query_dove_return");
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
  assert.ok(doveAuditQueryTool, "query_dove_audit should exist");
  assert.ok(doveReturnQueryTool, "query_dove_return should exist");
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
