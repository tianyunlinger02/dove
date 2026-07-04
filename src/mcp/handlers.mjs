import {
  appendHandoff,
  appendReviewLog,
  applyDoveStatusAdjustments,
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
  publishDoveGlobalStatus,
  publishDoveStatus,
  normalizeRebuttalIssues,
  queryDocumentLedger,
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
  recordDocumentEvidence,
  recordDoveMissionPass,
  recordOperatorFollowThrough,
  recordOperatorLesson,
  refreshWiki,
  registerSource,
  resetDoveVersion,
  revokeProgramApproval,
  runAudioReview,
  runDoveAuto,
  runDoveOperator,
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
  summarizeSessionJournal,
  currentMutationContext,
  runWithMutationContext
} from "../core/index.mjs";
import { MUTATING_TOOL_NAMES } from "./tool-definitions.mjs";

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

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value, fallback = null) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((value) => normalizeString(value)).filter(Boolean);
}

function uniqueStrings(values) {
  return [...new Set(normalizeStringArray(values))];
}

function compactObject(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (isPlainObject(value)) {
      return Object.keys(value).length > 0;
    }
    return true;
  }));
}

function stripMcpControlArgs(args = {}) {
  if (!isPlainObject(args)) {
    return {};
  }
  const { mutationMode, resultMode, ...rest } = args;
  return rest;
}

function normalizeMcpResultMode(args = {}) {
  const mode = normalizeString(args?.resultMode, "compact").toLowerCase();
  return ["compact", "full", "debug"].includes(mode) ? mode : "compact";
}

function extractPacketId(args = {}) {
  return args.packetId ?? args.taskPacketId ?? args.missionPacketId ?? args.taskId ?? null;
}

function extractStatus(data) {
  if (!isPlainObject(data)) {
    return "ok";
  }
  return normalizeString(data.status ?? data.resultStatus ?? data.taskStatus ?? data.mode, "ok");
}

function extractBoundaryType(data) {
  if (!isPlainObject(data)) {
    return null;
  }
  return normalizeString(data.boundaryType ?? data.boundary?.type ?? data.resultCard?.boundaryType ?? data.resultCard?.boundary?.type);
}

function extractNextAction(data) {
  if (!isPlainObject(data)) {
    return null;
  }
  const primary = data.statusHome?.nextSteps?.primary;
  const resultCardAction = Array.isArray(data.resultCard?.nextActions) ? data.resultCard.nextActions[0] : null;
  return normalizeString(
    data.nextAction
      ?? data.nextCommand
      ?? data.current?.nextCommand
      ?? data.board?.nextCommand
      ?? primary?.command
      ?? primary?.title
      ?? resultCardAction?.command
      ?? resultCardAction?.title
  );
}

function extractCurrentContext(data) {
  if (!isPlainObject(data)) {
    return null;
  }
  const statusContext = isPlainObject(data.statusHome?.currentContext) ? data.statusHome.currentContext : {};
  return compactObject({
    stateSource: normalizeString(statusContext.stateSource ?? data.stateSource),
    surface: normalizeString(data.surface ?? data.resultCard?.surface),
    command: normalizeString(data.command ?? data.resultCard?.command),
    mode: normalizeString(data.mode),
    packetId: normalizeString(data.packetId ?? data.taskPacketId ?? data.missionPacketId ?? data.resultCard?.packetId),
    runId: normalizeString(data.runId ?? data.id ?? data.resultCard?.runId),
    domain: normalizeString(data.domain ?? data.doveDomain ?? data.missionDomain),
    stage: normalizeString(data.stage ?? data.missionStage),
    currentFocus: normalizeString(data.currentFocus ?? data.statusHome?.projectState?.currentFocus),
    projectTitle: normalizeString(data.projectTitle ?? data.statusHome?.projectState?.title),
    status: extractStatus(data)
  });
}

function extractWrites(data) {
  if (!isPlainObject(data)) {
    return { applied: false, count: 0, paths: [] };
  }
  const paths = uniqueStrings([
    ...normalizeStringArray(data.writes),
    ...normalizeStringArray(data.durableWrites),
    ...normalizeStringArray(data.outputPaths)
  ]);
  const operationCount = Array.isArray(data.mutationPlan?.operations) ? data.mutationPlan.operations.length : 0;
  const writesApplied = typeof data.writesApplied === "boolean" ? data.writesApplied : paths.length > 0;
  return compactObject({
    applied: writesApplied,
    count: paths.length || operationCount,
    paths: paths.slice(0, 10),
    mutationMode: normalizeString(data.mutationMode)
  });
}

function extractRequiredEvidence(data) {
  if (!isPlainObject(data)) {
    return [];
  }
  return uniqueStrings([
    ...normalizeStringArray(data.requiredEvidence),
    ...normalizeStringArray(data.evidenceRequired),
    ...normalizeStringArray(data.executionContract?.convergence?.evidenceRequired),
    ...normalizeStringArray(data.statusSummary?.executionGaps?.evidenceRequired),
    ...normalizeStringArray(data.workflowFrame?.executionGuidance?.evidenceRequired)
  ]).slice(0, 10);
}

function extractEvidencePaths(data) {
  if (!isPlainObject(data)) {
    return [];
  }
  return uniqueStrings([
    ...normalizeStringArray(data.evidencePaths),
    ...normalizeStringArray(data.validationEvidencePaths),
    ...normalizeStringArray(data.verificationEvidencePaths),
    ...normalizeStringArray(data.resultCard?.evidencePaths)
  ]).slice(0, 10);
}

function extractResultPath(data) {
  if (!isPlainObject(data)) {
    return null;
  }
  return normalizeString(data.resultPath ?? data.reportPath ?? data.outputPath ?? data.resultCard?.resultPath);
}

function buildMcpResultContract(tool, resultMode, data) {
  const writes = extractWrites(data);
  return {
    presentation: "dove-mcp-result-contract",
    tool,
    resultMode,
    status: extractStatus(data),
    writes,
    writesApplied: writes.applied === true,
    boundaryType: extractBoundaryType(data),
    currentContext: extractCurrentContext(data),
    nextAction: extractNextAction(data),
    requiredEvidence: extractRequiredEvidence(data),
    evidencePaths: extractEvidencePaths(data),
    resultPath: extractResultPath(data),
    detailsAvailable: true,
    fullDetails: "Pass resultMode: full or resultMode: debug to include fullResult."
  };
}

function shapeMcpResult(tool, args, data) {
  const resultMode = normalizeMcpResultMode(args);
  const compact = buildMcpResultContract(tool, resultMode, data);
  if (resultMode === "full") {
    return { ...compact, fullResult: data };
  }
  if (resultMode === "debug") {
    return { ...compact, fullResult: data, diagnostics: isPlainObject(data) ? data.diagnostics ?? null : null };
  }
  return compact;
}

export function dispatchToolData(root, name, args = {}) {
  const result = (data) => data;
  switch (name) {
      case "ensure_workspace":
        return result(ensureWorkspace(root));
      case "init_project":
        return result(initProject(root, args));
      case "read_state":
        return result(readState(root));
      case "query_task_graph":
        return result(queryTaskGraph(root));
      case "query_open_questions":
        return result(queryOpenQuestions(root));
      case "query_decisions":
        return result(queryDecisions(root));
      case "query_lineage":
        return result(queryLineage(root));
      case "query_workspace_index":
        return result(queryWorkspaceIndex(root));
      case "query_meta_optimize":
        return result(queryMetaOptimize(root));
      case "query_governance_coverage_report":
        return result(queryGovernanceCoverageReport(root));
      case "query_operator_lessons":
        return result(queryOperatorLessons(root, args));
      case "query_operator_follow_through":
        return result(queryOperatorFollowThrough(root));
      case "query_paper_audit":
        return result(queryPaperAudit(root, args));
      case "query_dove_onboarding":
        return result(queryDoveOnboarding(root, args));
      case "query_paper_pipeline":
        return result(queryPaperPipeline(root, args));
      case "query_dove_orchestrate":
        return result(queryDoveOrchestrate(root, args));
      case "query_dove_mission":
        return result(queryDoveMission(root, args));
      case "query_dove_mission_board":
        return result(queryDoveMissionBoard(root, args));
      case "query_dove_status":
        return result(queryDoveStatus(root, args));
      case "publish_dove_status":
        return result(publishDoveStatus(root, args));
      case "publish_dove_global_status":
        return result(publishDoveGlobalStatus(root, args));
      case "query_document_ledger":
        return result(queryDocumentLedger(root, args));
      case "record_document_evidence":
        return result(recordDocumentEvidence(root, args));
      case "query_dove_audit":
        return result(queryDoveAudit(root, args));
      case "query_dove_return":
        return result(queryDoveReturn(root, args));
      case "init_dove_goal":
        return result(initDoveGoal(root, args));
      case "create_dove_task":
        return result(createDoveTask(root, args));
      case "record_dove_mission_pass":
        return result(recordDoveMissionPass(root, args));
      case "run_dove_auto":
        return result(runDoveAuto(root, args));
      case "apply_dove_status_adjustments":
        return result(applyDoveStatusAdjustments(root, args));
      case "run_dove_operator":
        return result(runDoveOperator(root, args));
      case "kill_dove_task":
        return result(killDoveTask(root, args));
      case "reset_dove_version":
        return result(resetDoveVersion(root, args));
      case "run_experience_workflow":
        return result(runExperienceWorkflow(root, args));
      case "prepare_audio_review":
        return result(prepareAudioReview(root, args));
      case "import_audio_review":
        return result(importAudioReview(root, args));
      case "run_audio_review":
        return result(runAudioReview(root, args));
      case "run_dove_review_loop":
        return result(runDoveReviewLoop(root, args));
      case "launch_dove_mission":
        return result(launchDoveMission(root, args));
      case "query_program_approvals":
        return result(queryProgramApprovals(root, args));
      case "query_campaigns":
        return result(queryCampaigns(root, args));
      case "query_boundary_report":
        return result(readBoundaryReport(root));
      case "read_role_context_manifest":
        return result(readRoleContextManifest(root, args.roleId));
      case "read_phase_context_manifest":
        return result(readPhaseContextManifest(root, args.phaseId));
      case "read_packet_context_manifest":
        return result(readPacketContextManifest(root, args.packetId));
      case "read_artifact_context_manifest":
        return result(readArtifactContextManifest(root, args.artifactPath));
      case "read_action_context_bundle":
        return result(readActionContextBundle(root, args));
      case "summarize_session_journal":
        return result(summarizeSessionJournal(root));
      case "upsert_orchestration_board":
        return result(upsertOrchestrationBoard(root, args));
      case "append_handoff":
        return result(appendHandoff(root, args));
      case "update_research_brief":
        return result(updateResearchBrief(root, args));
      case "register_source":
        return result(registerSource(root, args));
      case "upsert_note":
        return result(upsertNote(root, args));
      case "upsert_claims":
        return result(upsertClaims(root, args));
      case "upsert_experiment_plan":
        return result(upsertExperimentPlan(root, args));
      case "upsert_experiment_result":
        return result(upsertExperimentResult(root, args));
      case "run_experiment_audit":
        return result(runExperimentAudit(root, args));
      case "bridge_result_to_claim":
        return result(bridgeExperimentResultToClaim(root, args));
      case "upsert_plan":
        return result(upsertPlan(root, args));
      case "upsert_outline":
        return result(upsertOutline(root, args));
      case "upsert_draft":
        return result(upsertDraft(root, args));
      case "run_review_loop":
        return result(runReviewLoop(root, args));
      case "append_review_log":
        return result(appendReviewLog(root, args));
      case "prepare_isolated_review":
        return result(prepareIsolatedReview(root, args));
      case "import_isolated_review":
        return result(importIsolatedReview(root, args));
      case "upsert_revision_plan":
        return result(upsertRevisionPlan(root, args));
      case "set_section_status":
        return result(setSectionStatus(root, args));
      case "sync_checklist":
        return result(syncChecklist(root));
      case "sync_citations":
        return result(syncCitations(root, args));
      case "refresh_wiki":
        return result(refreshWiki(root));
      case "normalize_rebuttal_issues":
        return result(normalizeRebuttalIssues(root, args));
      case "build_rebuttal_strategy":
        return result(buildRebuttalStrategy(root, args));
      case "build_rebuttal":
        return result(buildRebuttal(root, args));
      case "create_version_snapshot":
        return result(createVersionSnapshot(root, args));
      case "compare_versions":
        return result(compareVersions(root, args));
      case "list_artifacts":
        return result(listWorkspaceArtifacts(root));
      case "upsert_figure_plan":
        return result(upsertFigurePlan(root, args));
      case "run_figure_workflow":
        return result(runFigureWorkflow(root, args));
      case "prepare_figure_generation":
        return result(prepareFigureGeneration(root, args));
      case "import_figure_generation":
        return result(importFigureGeneration(root, args));
      case "validate_figure_pipeline":
        return result(validateFigurePipeline(root));
      case "record_operator_follow_through":
        return result(recordOperatorFollowThrough(root, args));
      case "record_operator_lesson":
        return result(recordOperatorLesson(root, args));
      case "issue_program_approval":
        return result(issueProgramApproval(root, args));
      case "plan_campaign":
        return result(planCampaign(root, args));
      case "revoke_program_approval":
        return result(revokeProgramApproval(root, args));
      case "materialize_guidance_packet":
        return result(materializeGuidancePacket(root, args));
      case "run_autonomy_once":
        return result(runAutonomyControlPlaneOnce(root, args));
      case "run_autonomy_foreground":
        return result(runAutonomyForeground(root, args));
      case "run_autonomy_operate":
        return result(runAutonomyOperate(root, args));
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
}

export function dispatchTool(root, name, args = {}) {
  try {
    const cleanArgs = stripMcpControlArgs(args);
    const data = MUTATING_TOOL_NAMES.has(name) && !currentMutationContext(root)
      ? runWithMutationContext(root, {
        actionId: name,
        mutationMode: args?.mutationMode,
        hostId: "mcp",
        packetId: extractPacketId(args)
      }, () => dispatchToolData(root, name, cleanArgs))
      : dispatchToolData(root, name, cleanArgs);
    return makeTextResult(shapeMcpResult(name, args, data));
  } catch (error) {
    return makeErrorResult(error instanceof Error ? error.message : String(error));
  }
}
