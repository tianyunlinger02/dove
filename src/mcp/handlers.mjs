import {
  appendHandoff,
  appendReviewLog,
  buildRebuttal,
  buildRebuttalStrategy,
  compareVersions,
  createVersionSnapshot,
  ensureWorkspace,
  initProject,
  listWorkspaceArtifacts,
  normalizeRebuttalIssues,
  readState,
  refreshWiki,
  registerSource,
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
  upsertRevisionPlan
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
      default:
        return makeErrorResult(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return makeErrorResult(error instanceof Error ? error.message : String(error));
  }
}
