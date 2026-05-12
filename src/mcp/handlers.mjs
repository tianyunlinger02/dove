import {
  appendHandoff,
  appendReviewLog,
  bridgeExperimentResultToClaim,
  buildRebuttal,
  buildRebuttalStrategy,
  compareVersions,
  createDoveTask,
  createVersionSnapshot,
  ensureWorkspace,
  importAudioReview,
  importFigureGeneration,
  importIsolatedReview,
  initDoveGoal,
  initProject,
  killDoveTask,
  listWorkspaceArtifacts,
  materializeGuidancePacket,
  issueProgramApproval,
  planCampaign,
  prepareAudioReview,
  prepareFigureGeneration,
  prepareIsolatedReview,
  normalizeRebuttalIssues,
  readBoundaryReport,
  queryDecisions,
  launchDoveMission,
  queryDoveAudit,
  queryDoveMission,
  queryDoveMissionBoard,
  queryDoveOnboarding,
  queryDoveOrchestrate,
  queryDoveReturn,
  queryDoveStatus,
  queryGovernanceCoverageReport,
  queryLineage,
  queryMetaOptimize,
  queryOpenQuestions,
  queryOperatorLessons,
  queryOperatorFollowThrough,
  queryPaperAudit,
  queryPaperPipeline,
  queryProgramApprovals,
  queryCampaigns,
  queryTaskGraph,
  queryWorkspaceIndex,
  readActionContextBundle,
  readArtifactContextManifest,
  readPacketContextManifest,
  readPhaseContextManifest,
  readState,
  readRoleContextManifest,
  recordOperatorFollowThrough,
  recordOperatorLesson,
  refreshWiki,
  registerSource,
  resetDoveVersion,
  revokeProgramApproval,
  runAudioReview,
  runDoveAuto,
  runDoveReviewLoop,
  runExperienceWorkflow,
  runFigureWorkflow,
  runAutonomyControlPlaneOnce,
  runAutonomyForeground,
  runAutonomyOperate,
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
      case "query_operator_lessons":
        return makeTextResult(queryOperatorLessons(root, args));
      case "query_operator_follow_through":
        return makeTextResult(queryOperatorFollowThrough(root));
      case "query_paper_audit":
        return makeTextResult(queryPaperAudit(root, args));
      case "query_dove_onboarding":
        return makeTextResult(queryDoveOnboarding(root, args));
      case "query_paper_pipeline":
        return makeTextResult(queryPaperPipeline(root, args));
      case "query_dove_orchestrate":
        return makeTextResult(queryDoveOrchestrate(root, args));
      case "query_dove_mission":
        return makeTextResult(queryDoveMission(root, args));
      case "query_dove_mission_board":
        return makeTextResult(queryDoveMissionBoard(root, args));
      case "query_dove_status":
        return makeTextResult(queryDoveStatus(root, args));
      case "query_dove_audit":
        return makeTextResult(queryDoveAudit(root, args));
      case "query_dove_return":
        return makeTextResult(queryDoveReturn(root, args));
      case "init_dove_goal":
        return makeTextResult(initDoveGoal(root, args));
      case "create_dove_task":
        return makeTextResult(createDoveTask(root, args));
      case "run_dove_auto":
        return makeTextResult(runDoveAuto(root, args));
      case "kill_dove_task":
        return makeTextResult(killDoveTask(root, args));
      case "reset_dove_version":
        return makeTextResult(resetDoveVersion(root, args));
      case "run_experience_workflow":
        return makeTextResult(runExperienceWorkflow(root, args));
      case "prepare_audio_review":
        return makeTextResult(prepareAudioReview(root, args));
      case "import_audio_review":
        return makeTextResult(importAudioReview(root, args));
      case "run_audio_review":
        return makeTextResult(runAudioReview(root, args));
      case "run_dove_review_loop":
        return makeTextResult(runDoveReviewLoop(root, args));
      case "launch_dove_mission":
        return makeTextResult(launchDoveMission(root, args));
      case "query_program_approvals":
        return makeTextResult(queryProgramApprovals(root, args));
      case "query_campaigns":
        return makeTextResult(queryCampaigns(root, args));
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
      case "prepare_isolated_review":
        return makeTextResult(prepareIsolatedReview(root, args));
      case "import_isolated_review":
        return makeTextResult(importIsolatedReview(root, args));
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
        return makeTextResult(buildRebuttal(root, args));
      case "create_version_snapshot":
        return makeTextResult(createVersionSnapshot(root, args));
      case "compare_versions":
        return makeTextResult(compareVersions(root, args));
      case "list_artifacts":
        return makeTextResult(listWorkspaceArtifacts(root));
      case "upsert_figure_plan":
        return makeTextResult(upsertFigurePlan(root, args));
      case "run_figure_workflow":
        return makeTextResult(runFigureWorkflow(root, args));
      case "prepare_figure_generation":
        return makeTextResult(prepareFigureGeneration(root, args));
      case "import_figure_generation":
        return makeTextResult(importFigureGeneration(root, args));
      case "validate_figure_pipeline":
        return makeTextResult(validateFigurePipeline(root));
      case "record_operator_follow_through":
        return makeTextResult(recordOperatorFollowThrough(root, args));
      case "record_operator_lesson":
        return makeTextResult(recordOperatorLesson(root, args));
      case "issue_program_approval":
        return makeTextResult(issueProgramApproval(root, args));
      case "plan_campaign":
        return makeTextResult(planCampaign(root, args));
      case "revoke_program_approval":
        return makeTextResult(revokeProgramApproval(root, args));
      case "materialize_guidance_packet":
        return makeTextResult(materializeGuidancePacket(root, args));
      case "run_autonomy_once":
        return makeTextResult(runAutonomyControlPlaneOnce(root, args));
      case "run_autonomy_foreground":
        return makeTextResult(runAutonomyForeground(root, args));
      case "run_autonomy_operate":
        return makeTextResult(runAutonomyOperate(root, args));
      default:
        return makeErrorResult(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return makeErrorResult(error instanceof Error ? error.message : String(error));
  }
}
