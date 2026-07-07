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
import { buildOperatorUnblock } from "../core/operator-ux.mjs";
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

const MCP_COMPACT_INTERNAL_KEY_PATTERN = /^(?:id|packetId|packetIds|taskPacketId|missionPacketId|taskId|runId|receiptId|figureId|boundaryId|boundaryType|implementationBoundaryType|implementationReason|command|copyableCommand|operatorRoute|ownerRole|nextRole|handoff|providerId|providerStatus|providerError|apiKeyEnv|artifactRefs|artifactPaths|evidencePaths|validationEvidencePaths|requiredEvidence|resultPath|qaPath|path|paths|documentPath|packetPath|packetContextPath|sourceSvgPath|targetFinalSvgPath|finalSvgPath|outputManifestPath|svgContent|mutationMode|queueSummary|queuePreview|preActionGuidance|preActionGuidanceSummary|fullDetails|fullResult|diagnostics)$/u;
const MCP_COMPACT_INTERNAL_TEXT_PATTERN = /\.dove\/|\bproject:dove\.[a-z0-9.-]+|--packet-id\b|\b(?:packetId|taskPacketId|missionPacketId|taskId|runId|receiptId|boundaryId|boundaryType|mutationMode|patch-plan|direct-process|ownerRole|nextRole|handoff|providerId|sourceSvgPath|targetFinalSvgPath|finalSvgPath|outputManifestPath|svgContent|queueSummary|queuePreview|preActionGuidance|resultCard)\b|\b(?:missing-secret-env|provider-failed|host-tool-blocked|needs-host-results|awaiting-host-pass|awaiting-host-results|audio-review-[a-z-]+)\b|\b(?:query_dove_status|run_dove_auto|record_dove_mission_pass|run_figure_workflow|run_dove_operator|record_document_evidence|upsert_note|upsert_draft|register_source)\b/u;

function isMcpCompactInternalKey(key) {
  return MCP_COMPACT_INTERNAL_KEY_PATTERN.test(String(key ?? "")) || /(?:^|[A-Za-z])Ids?$/u.test(String(key ?? ""));
}

function publicCompactString(value, fallback = null) {
  const text = normalizeString(value, null);
  if (!text || MCP_COMPACT_INTERNAL_TEXT_PATTERN.test(text)) {
    return fallback;
  }
  return text;
}

function publicCompactValue(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => publicCompactValue(item)).filter((item) => item !== null && item !== undefined && item !== "")));
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .filter(([key]) => !isMcpCompactInternalKey(key))
      .map(([key, item]) => [key, publicCompactValue(item)])
      .filter(([, item]) => {
        if (item === null || item === undefined || item === "") {
          return false;
        }
        if (Array.isArray(item)) {
          return item.length > 0;
        }
        if (isPlainObject(item)) {
          return Object.keys(item).length > 0;
        }
        return true;
      });
    return compactObject(Object.fromEntries(entries));
  }
  if (typeof value === "string") {
    return publicCompactString(value);
  }
  return value === null || value === undefined ? null : value;
}

function publicCompactObject(value) {
  return isPlainObject(value) ? publicCompactValue(value) : null;
}

function publicCompactStringArray(values) {
  return uniqueStrings(values).filter((value) => publicCompactString(value));
}

function publicMcpToolSurface(tool) {
  const surfaces = {
    query_dove_status: "status",
    query_dove_orchestrate: "routing",
    query_document_ledger: "evidence",
    query_operator_lessons: "lessons",
    create_dove_task: "mission",
    init_dove_goal: "mission",
    record_dove_mission_pass: "mission",
    run_dove_auto: "auto",
    run_dove_operator: "operator",
    register_source: "source",
    upsert_note: "note",
    upsert_draft: "draft",
    record_document_evidence: "document",
    run_figure_workflow: "figure",
    run_experience_workflow: "experience",
    run_review_loop: "review",
    run_dove_review_loop: "review-loop",
    build_rebuttal_strategy: "rebuttal",
    build_rebuttal: "rebuttal",
    create_version_snapshot: "version",
    compare_versions: "version",
    query_dove_return: "verification"
  };
  return surfaces[tool] ?? (MUTATING_TOOL_NAMES.has(tool) ? "workflow" : "read-only");
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

function extractScope(data) {
  if (!isPlainObject(data)) {
    return null;
  }
  const statusScope = isPlainObject(data.statusHome?.scope) ? data.statusHome.scope : {};
  const statusContext = isPlainObject(data.statusHome?.currentContext) ? data.statusHome.currentContext : {};
  return compactObject({
    kind: publicCompactString(statusScope.kind ?? (data.figureId ? "figure" : data.packetId || data.taskPacketId || data.missionPacketId ? "task" : "workspace")),
    domain: publicCompactString(statusScope.domain ?? statusContext.domain ?? data.domain ?? data.doveDomain ?? data.missionDomain),
    stage: publicCompactString(statusScope.stage ?? statusContext.stage ?? data.stage ?? data.missionStage),
    currentFocus: publicCompactString(statusContext.currentFocus ?? data.currentFocus),
    title: publicCompactString(statusContext.title ?? data.projectTitle),
    status: publicCompactString(extractStatus(data), "ok")
  });
}

function extractArtifactWritePaths(artifactWrites) {
  if (!isPlainObject(artifactWrites)) {
    return [];
  }
  return uniqueStrings([
    ...normalizeStringArray(artifactWrites.primaryArtifactPaths),
    ...normalizeStringArray(artifactWrites.synthesisArtifactPaths),
    ...normalizeStringArray(artifactWrites.refreshOnlyArtifactPaths),
    ...normalizeStringArray(artifactWrites.artifactPaths),
    ...normalizeStringArray(artifactWrites.paths)
  ]);
}

function extractWrites(data, args = {}) {
  if (!isPlainObject(data)) {
    return { applied: false, count: 0, paths: [], writeIntent: "none", rollbackEligible: "not-applicable" };
  }
  const mutationSummaryPaths = isPlainObject(data.mutationSummary) ? data.mutationSummary.paths : null;
  const paths = uniqueStrings([
    ...normalizeStringArray(data.writes),
    ...normalizeStringArray(data.durableWrites),
    ...normalizeStringArray(data.outputPaths),
    ...normalizeStringArray(mutationSummaryPaths),
    ...extractArtifactWritePaths(data.artifactWrites),
    ...extractArtifactWritePaths(data.resultCard?.artifactWrites)
  ]);
  const operationCount = Array.isArray(data.mutationPlan?.operations) ? data.mutationPlan.operations.length : 0;
  const mutationMode = normalizeString(data.mutationMode ?? args?.mutationMode);
  const writesApplied = typeof data.writesApplied === "boolean" ? data.writesApplied : paths.length > 0;
  const hasProposedPatch = !writesApplied && (operationCount > 0 || (mutationMode === "patch-plan" && paths.length > 0));
  const writeIntent = writesApplied ? "applied" : hasProposedPatch ? "proposed" : "none";
  const rollbackEligible = writeIntent === "none"
    ? "not-applicable"
    : normalizeString(data.rollbackEligible ?? data.mutationSummary?.rollbackEligible, mutationMode === "patch-plan" ? "host-tracked" : "unverified");
  return compactObject({
    applied: writesApplied,
    count: paths.length || operationCount,
    paths: paths.slice(0, 10),
    writeIntent,
    rollbackEligible,
    mutationMode: writeIntent === "none" ? null : mutationMode
  });
}

function extractSummary(data) {
  if (!isPlainObject(data)) {
    return "ok";
  }
  return publicCompactString(
    data.summary
      ?? data.headline
      ?? data.statusHome?.headline
      ?? data.resultCard?.happened
      ?? data.resultSummary
      ?? data.outcome,
    extractStatus(data)
  );
}

function publicNextStep(value) {
  if (!isPlainObject(value)) {
    return null;
  }
  return compactObject({
    label: publicCompactString(value.label ?? value.title ?? value.summary ?? value.message),
    why: publicCompactString(value.why ?? value.summary ?? value.reason),
    requiredInputs: publicCompactStringArray(value.requiredInputs),
    requiredActions: publicCompactStringArray(value.requiredActions),
    confirmationRequired: value.confirmationRequired === true ? true : undefined
  });
}

function extractNextStep(data) {
  if (!isPlainObject(data)) {
    return null;
  }
  const statusNextStep = isPlainObject(data.statusHome?.nextStep) ? data.statusHome.nextStep : null;
  if (statusNextStep) {
    return publicNextStep(statusNextStep);
  }
  const explicitNextStep = isPlainObject(data.nextStep) ? data.nextStep : null;
  if (explicitNextStep) {
    return publicNextStep(explicitNextStep);
  }
  const resultCardAction = Array.isArray(data.resultCard?.nextActions) ? data.resultCard.nextActions[0] : null;
  return publicNextStep(resultCardAction);
}

function buildChangesContract(writes) {
  return compactObject({
    intent: writes.writeIntent,
    applied: writes.applied === true,
    count: writes.count ?? 0,
    rollback: writes.rollbackEligible
  });
}

function extractNeedsAttention(data, operatorUnblock) {
  if (!isPlainObject(data)) {
    return null;
  }
  const statusNeedsAttention = isPlainObject(data.statusHome?.needsAttention) ? data.statusHome.needsAttention : null;
  if (statusNeedsAttention) {
    return publicCompactObject(statusNeedsAttention);
  }
  const explicitNeedsAttention = isPlainObject(data.needsAttention) ? data.needsAttention : null;
  if (explicitNeedsAttention) {
    return publicCompactObject(explicitNeedsAttention);
  }
  if (!operatorUnblock) {
    return null;
  }
  return compactObject({
    status: "blocked",
    summary: publicCompactString(operatorUnblock.summary ?? operatorUnblock.blockedSummary),
    why: publicCompactString(operatorUnblock.why ?? operatorUnblock.cannotContinueBecause),
    needs: publicCompactStringArray(operatorUnblock.needs ?? operatorUnblock.requiredEvidence).slice(0, 8)
  });
}

function extractShowMore(data) {
  const source = isPlainObject(data?.statusHome?.showMore)
    ? data.statusHome.showMore
    : isPlainObject(data?.showMore)
      ? data.showMore
      : null;
  return {
    text: publicCompactString(source?.text, "Ask for full details or diagnostics only when you need the audit view.")
  };
}

function buildMcpResultContract(tool, resultMode, data, args = {}) {
  const writes = extractWrites(data, args);
  const operatorUnblock = buildOperatorUnblock(data);
  return compactObject({
    presentation: "dove-mcp-result-contract",
    tool: publicMcpToolSurface(tool),
    resultMode,
    summary: extractSummary(data),
    scope: extractScope(data),
    nextStep: extractNextStep(data),
    needsAttention: extractNeedsAttention(data, operatorUnblock),
    changes: buildChangesContract(writes),
    showMore: extractShowMore(data),
    detailsAvailable: true
  });
}

function shapeMcpResult(tool, args, data) {
  const resultMode = normalizeMcpResultMode(args);
  const compact = buildMcpResultContract(tool, resultMode, data, args);
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
