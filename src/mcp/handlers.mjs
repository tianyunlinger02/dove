import {
  appendHandoff,
  appendReviewLog,
  bridgeExperimentResultToClaim,
  buildRebuttal,
  buildRebuttalStrategy,
  compareVersions,
  createVersionSnapshot,
  ensureWorkspace,
  initProject,
  listWorkspaceArtifacts,
  normalizeRebuttalIssues,
  readBoundaryReport,
  queryDecisions,
  queryGovernanceCoverageReport,
  queryLineage,
  queryMetaOptimize,
  queryOpenQuestions,
  queryOperatorFollowThrough,
  queryTaskGraph,
  queryWorkspaceIndex,
  readActionContextBundle,
  readArtifactContextManifest,
  readPacketContextManifest,
  readPhaseContextManifest,
  readState,
  readRoleContextManifest,
  recordOperatorFollowThrough,
  refreshWiki,
  registerSource,
  runExperimentAudit,
  runReviewLoop,
  setSectionStatus,
  syncChecklist,
  syncCitations,
  updateResearchBrief,
  upsertClaims,
  upsertDraft,
  upsertExperimentPlan,
  upsertExperimentResult,
  upsertFigurePlan,
  upsertNote,
  upsertOutline,
  upsertOrchestrationBoard,
  upsertPlan,
  upsertRevisionPlan,
  validateFigurePipeline,
  summarizeSessionJournal
} from "../core/index.mjs";

function makeTextResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
  };
}

function makeErrorResult(message) {
  return {
    content: [{ type: "text", text: message }],
    isError: true
  };
}

export function dispatchTool(root, name, args = {}) {
  try {
    switch (name) {
      case "ensure_workspace":
        return makeTextResult(ensureWorkspace(root));
      case "init_project":
        return makeTextResult(initProject(root, args));
      case "read_state":
        return makeTextResult(readState(root));
      case "query_task_graph":
        return makeTextResult(queryTaskGraph(root));
      case "query_open_questions":
        return makeTextResult(queryOpenQuestions(root));
      case "query_decisions":
        return makeTextResult(queryDecisions(root));
      case "query_lineage":
        return makeTextResult(queryLineage(root));
      case "query_workspace_index":
        return makeTextResult(queryWorkspaceIndex(root));
      case "query_meta_optimize":
        return makeTextResult(queryMetaOptimize(root));
      case "query_governance_coverage_report":
        return makeTextResult(queryGovernanceCoverageReport(root));
      case "query_operator_follow_through":
        return makeTextResult(queryOperatorFollowThrough(root));
      case "query_boundary_report":
        return makeTextResult(readBoundaryReport(root));
      case "read_role_context_manifest":
        return makeTextResult(readRoleContextManifest(root, args.roleId));
      case "read_phase_context_manifest":
        return makeTextResult(readPhaseContextManifest(root, args.phaseId));
      case "read_packet_context_manifest":
        return makeTextResult(readPacketContextManifest(root, args.packetId));
      case "read_artifact_context_manifest":
        return makeTextResult(readArtifactContextManifest(root, args.artifactPath));
      case "read_action_context_bundle":
        return makeTextResult(readActionContextBundle(root, args));
      case "summarize_session_journal":
        return makeTextResult(summarizeSessionJournal(root));
      case "upsert_orchestration_board":
        return makeTextResult(upsertOrchestrationBoard(root, args));
      case "append_handoff":
        return makeTextResult(appendHandoff(root, args));
      case "update_research_brief":
        return makeTextResult(updateResearchBrief(root, args));
      case "register_source":
        return makeTextResult(registerSource(root, args));
      case "upsert_note":
        return makeTextResult(upsertNote(root, args));
      case "upsert_claims":
        return makeTextResult(upsertClaims(root, args));
      case "upsert_experiment_plan":
        return makeTextResult(upsertExperimentPlan(root, args));
      case "upsert_experiment_result":
        return makeTextResult(upsertExperimentResult(root, args));
      case "run_experiment_audit":
        return makeTextResult(runExperimentAudit(root, args));
      case "bridge_result_to_claim":
        return makeTextResult(bridgeExperimentResultToClaim(root, args));
      case "upsert_plan":
        return makeTextResult(upsertPlan(root, args));
      case "upsert_outline":
        return makeTextResult(upsertOutline(root, args));
      case "upsert_draft":
        return makeTextResult(upsertDraft(root, args));
      case "run_review_loop":
        return makeTextResult(runReviewLoop(root, args));
      case "append_review_log":
        return makeTextResult(appendReviewLog(root, args));
      case "upsert_revision_plan":
        return makeTextResult(upsertRevisionPlan(root, args));
      case "set_section_status":
        return makeTextResult(setSectionStatus(root, args));
      case "sync_checklist":
        return makeTextResult(syncChecklist(root));
      case "sync_citations":
        return makeTextResult(syncCitations(root, args));
      case "refresh_wiki":
        return makeTextResult(refreshWiki(root));
      case "normalize_rebuttal_issues":
        return makeTextResult(normalizeRebuttalIssues(root, args));
      case "build_rebuttal_strategy":
        return makeTextResult(buildRebuttalStrategy(root, args));
      case "build_rebuttal":
        return makeTextResult(buildRebuttal(root));
      case "create_version_snapshot":
        return makeTextResult(createVersionSnapshot(root, args));
      case "compare_versions":
        return makeTextResult(compareVersions(root, args));
      case "list_artifacts":
        return makeTextResult(listWorkspaceArtifacts(root));
      case "upsert_figure_plan":
        return makeTextResult(upsertFigurePlan(root, args));
      case "validate_figure_pipeline":
        return makeTextResult(validateFigurePipeline(root));
      case "record_operator_follow_through":
        return makeTextResult(recordOperatorFollowThrough(root, args));
      default:
        return makeErrorResult(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return makeErrorResult(error instanceof Error ? error.message : String(error));
  }
}
