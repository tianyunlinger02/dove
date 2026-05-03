import crypto from "node:crypto";

export const SCHEMA_VERSION = 5;
export const PACKAGE_VERSION = "0.2.0";

export const DEFAULT_SECTION_ORDER = [
  ["abstract", "Abstract"],
  ["introduction", "Introduction"],
  ["related-work", "Related Work"],
  ["method", "Method"],
  ["experiments", "Experiments"],
  ["limitations", "Limitations"],
  ["conclusion", "Conclusion"],
  ["rebuttal", "Rebuttal Notes"]
];

export const PIPELINE_STAGE_ORDER = [
  "init",
  "sources",
  "notes",
  "research",
  "plan",
  "outline",
  "draft",
  "experiments",
  "citations",
  "review",
  "rebuttal",
  "versions",
  "checklist"
];

export const GOVERNANCE_GUARDED_MUTATIONS = [
  { id: "upsert-orchestration-board", action: "Updating the orchestration board", artifactPath: ".paper/orchestration/board.json", surfaceBindings: { coreFunction: "upsertOrchestrationBoard", mcpTool: "upsert_orchestration_board", commandIds: ["paper.orchestrate"] } },
  { id: "append-handoff", action: "Appending a durable handoff", artifactPath: ".paper/orchestration/handoffs.md", surfaceBindings: { coreFunction: "appendHandoff", mcpTool: "append_handoff", commandIds: ["paper.orchestrate"] } },
  { id: "register-source", action: "Registering a source", artifactPath: ".paper/sources/index.json", surfaceBindings: { coreFunction: "registerSource", mcpTool: "register_source", commandIds: ["paper.source"] } },
  { id: "upsert-note", action: "Recording a structured note", artifactPath: ".paper/notes/index.json", surfaceBindings: { coreFunction: "upsertNote", mcpTool: "upsert_note", commandIds: ["paper.note"] } },
  { id: "upsert-claims", action: "Updating evidence-backed claims", artifactPath: ".paper/evidence/index.json", surfaceBindings: { coreFunction: "upsertClaims", mcpTool: "upsert_claims", commandIds: ["paper.claim-gate"] } },
  { id: "upsert-plan", action: "Updating the paper plan", artifactPath: ".paper/plans/current-plan.md", surfaceBindings: { coreFunction: "upsertPlan", mcpTool: "upsert_plan", commandIds: ["paper.plan"] } },
  { id: "upsert-outline", action: "Updating the paper outline", artifactPath: ".paper/outline/current-outline.md", surfaceBindings: { coreFunction: "upsertOutline", mcpTool: "upsert_outline", commandIds: ["paper.outline"] } },
  { id: "upsert-draft", action: "Updating a draft section", artifactPath: ".paper/drafts", surfaceBindings: { coreFunction: "upsertDraft", mcpTool: "upsert_draft", commandIds: ["paper.draft"] } },
  { id: "set-section-status", action: "Updating a section status", artifactPath: ".paper/state.json", surfaceBindings: { coreFunction: "setSectionStatus", mcpTool: "set_section_status", commandIds: ["paper.draft", "paper.revise"] } },
  { id: "upsert-figure-plan", action: "Updating the figure plan", artifactPath: ".paper/figures/index.json", surfaceBindings: { coreFunction: "upsertFigurePlan", mcpTool: "upsert_figure_plan", commandIds: ["paper.figure"] } },
  { id: "sync-citations", action: "Updating citation artifacts", artifactPath: ".paper/bibliography/citation-log.md", surfaceBindings: { coreFunction: "syncCitations", mcpTool: "sync_citations", commandIds: ["paper.citations"] } },
  { id: "refresh-wiki", action: "Refreshing the wiki", artifactPath: ".paper/wiki/index.md", surfaceBindings: { coreFunction: "refreshWiki", mcpTool: "refresh_wiki", commandIds: ["paper.wiki"] } },
  { id: "build-rebuttal", action: "Building the rebuttal draft", artifactPath: ".paper/drafts/rebuttal.md", surfaceBindings: { coreFunction: "buildRebuttal", mcpTool: "build_rebuttal", commandIds: ["paper.rebuttal"] } },
  { id: "append-review-log", action: "Recording a review log", artifactPath: ".paper/reviews/log.md", surfaceBindings: { coreFunction: "appendReviewLog", mcpTool: "append_review_log", commandIds: ["paper.review"] } },
  { id: "upsert-revision-plan", action: "Updating the revision plan", artifactPath: ".paper/revision-plans/current-plan.md", surfaceBindings: { coreFunction: "upsertRevisionPlan", mcpTool: "upsert_revision_plan", commandIds: ["paper.revise"] } },
  { id: "run-review-loop", action: "Running the review loop", artifactPath: ".paper/reviews/log.md", surfaceBindings: { coreFunction: "runReviewLoop", mcpTool: "run_review_loop", commandIds: ["paper.review-loop"] } },
  { id: "update-research-brief", action: "Updating the research brief", artifactPath: ".paper/research/brief.md", surfaceBindings: { coreFunction: "updateResearchBrief", mcpTool: "update_research_brief", commandIds: ["paper.research"] } },
  { id: "upsert-experiment-plan", action: "Updating an experiment plan", artifactPath: ".paper/experiments/plans.json", surfaceBindings: { coreFunction: "upsertExperimentPlan", mcpTool: "upsert_experiment_plan", commandIds: ["paper.experiment-plan"] } },
  { id: "upsert-experiment-result", action: "Updating an experiment result", artifactPath: ".paper/experiments/results.json", surfaceBindings: { coreFunction: "upsertExperimentResult", mcpTool: "upsert_experiment_result", commandIds: ["paper.experiment-plan"] } },
  { id: "run-experiment-audit", action: "Running an experiment audit", artifactPath: ".paper/experiments/audits.json", surfaceBindings: { coreFunction: "runExperimentAudit", mcpTool: "run_experiment_audit", commandIds: ["paper.experiment-audit"] } },
  { id: "bridge-experiment-result-to-claim", action: "Bridging an experiment result to a claim", artifactPath: ".paper/claims/bridge-log.json", surfaceBindings: { coreFunction: "bridgeExperimentResultToClaim", mcpTool: "bridge_result_to_claim", commandIds: ["paper.result-bridge"] } },
  { id: "normalize-rebuttal-issues", action: "Normalizing rebuttal issues", artifactPath: ".paper/rebuttal/issues.json", surfaceBindings: { coreFunction: "normalizeRebuttalIssues", mcpTool: "normalize_rebuttal_issues", commandIds: ["paper.rebuttal-strategy"] } },
  { id: "build-rebuttal-strategy", action: "Building the rebuttal strategy", artifactPath: ".paper/rebuttal/strategy.md", surfaceBindings: { coreFunction: "buildRebuttalStrategy", mcpTool: "build_rebuttal_strategy", commandIds: ["paper.rebuttal-strategy"] } },
  { id: "create-version-snapshot", action: "Creating a version snapshot", artifactPath: ".paper/versions/index.json", surfaceBindings: { coreFunction: "createVersionSnapshot", mcpTool: "create_version_snapshot", commandIds: ["paper.version-snapshot"] } },
  { id: "compare-versions", action: "Comparing versions", artifactPath: ".paper/versions/comparisons.json", surfaceBindings: { coreFunction: "compareVersions", mcpTool: "compare_versions", commandIds: ["paper.version-compare"] } },
  { id: "materialize-guidance-packet", action: "Materializing accepted guidance into a durable task packet", artifactPath: ".paper/task-packets", surfaceBindings: { coreFunction: "materializeGuidancePacket", mcpTool: "materialize_guidance_packet", commandIds: ["paper.materialize"] } }
];

export const GOVERNANCE_EXEMPT_MUTATIONS = [
  { id: "record-operator-follow-through", action: "Recording follow-through decisions remains explicitly exempt so the governance system can be updated while debt exists.", artifactPath: ".paper/meta/operator-follow-through.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-24T00:00:00.000Z", reasonCode: "governance-ledger-maintenance", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "recordOperatorFollowThrough", mcpTool: "record_operator_follow_through", commandIds: ["paper.follow-through"] } },
  { id: "issue-program-approval", action: "Issuing a fresh program approval remains exempt because it is explicit governance bookkeeping that authorizes later bounded execution but does not itself execute work.", artifactPath: ".paper/programs/approvals.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-24T00:00:00.000Z", reasonCode: "approval-bookkeeping", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "issueProgramApproval", mcpTool: "issue_program_approval", commandIds: ["paper.approvals"] } },
  { id: "plan-campaign", action: "Recording a multi-cycle campaign plan remains exempt because it only records planner-supervised campaign intent and does not approve or execute bounded program work.", artifactPath: ".paper/programs/campaigns.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-25T00:00:00.000Z", lastReviewedAt: "2026-04-25T00:00:00.000Z", reasonCode: "campaign-planning-bookkeeping", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "planCampaign", mcpTool: "plan_campaign", commandIds: [] } },
  { id: "revoke-program-approval", action: "Revoking a program approval remains exempt because it withdraws authority rather than executing new work.", artifactPath: ".paper/programs/approvals.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-24T00:00:00.000Z", reasonCode: "approval-withdrawal", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "revokeProgramApproval", mcpTool: "revoke_program_approval", commandIds: ["paper.approvals"] } },
  { id: "run-autonomy-control-plane-once", action: "A manually invoked autonomous control-plane pass may advance one explicitly accepted planner-supervised packet or materialize one governed planned target through one bounded execution delta with durable runtime audit artifacts.", artifactPath: ".paper/runtime/controller-state.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-24T00:00:00.000Z", reasonCode: "single-turn-control-plane-execution", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "runAutonomyControlPlaneOnce", mcpTool: "run_autonomy_once", commandIds: [] } },
  { id: "run-autonomy-foreground", action: "A manually invoked explicit foreground autonomy run may continue one program-scoped bounded authority envelope or the same-lineage execute-materialized-packet continuation until a declared stop condition is reached.", artifactPath: ".paper/runtime/controller-state.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-24T00:00:00.000Z", reasonCode: "foreground-bounded-runner", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "runAutonomyForeground", mcpTool: "run_autonomy_foreground", commandIds: [] } },
  { id: "run-autonomy-operate", action: "A manually invoked explicit autonomy operating surface may compose objective/source proposal selection, campaign planning, materialization, bounded approval, foreground execution, and durable stop summaries without hidden scheduling.", artifactPath: ".paper/runtime/controller-state.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-25T00:00:00.000Z", lastReviewedAt: "2026-05-03T00:00:00.000Z", reasonCode: "foreground-research-operating-surface", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "runAutonomyOperate", mcpTool: "run_autonomy_operate", commandIds: ["paper.autonomy-operate"] } },
  { id: "query-meta-optimize", action: "Refreshing proposal-only optimizer surfaces remains exempt because it is part of debt detection, not debt execution.", artifactPath: ".paper/meta/LATEST_OPTIMIZER_REPORT.md", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-24T00:00:00.000Z", reasonCode: "proposal-frontier-refresh", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "queryMetaOptimize", mcpTool: "query_meta_optimize", commandIds: ["paper.meta-optimize"] } },
  { id: "init-project", action: "Project initialization bootstraps the workspace and is explicitly exempt from follow-through gating.", artifactPath: ".paper/state.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "workspace-bootstrap", reviewCadence: "per-project", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "initProject", mcpTool: "init_project", commandIds: ["paper.init"] } },
  { id: "sync-checklist", action: "Checklist syncing remains exempt because it summarizes debt instead of executing it.", artifactPath: ".paper/checklists/paper.md", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-24T00:00:00.000Z", reasonCode: "summary-sync", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "syncChecklist", mcpTool: "sync_checklist", commandIds: ["paper.checklist"] } },
  { id: "validate-figure-pipeline", action: "Figure validation is an inspection path and remains exempt from follow-through execution gating.", artifactPath: ".paper/figures/qa.json", ownerRole: "researcher", approvedByRole: "researcher", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-24T00:00:00.000Z", reasonCode: "inspection-only", reviewCadence: "per-change", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "validateFigurePipeline", mcpTool: "validate_figure_pipeline", commandIds: ["paper.figure"] } },
  { id: "classify-workflow-intent", action: "Workflow intent classification is analytical and remains exempt.", artifactPath: ".paper/meta/recommendations.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-24T00:00:00.000Z", reasonCode: "analysis-only", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "classifyWorkflowIntent", mcpTool: "query_meta_optimize", commandIds: ["paper.meta-optimize"] } },
  { id: "load-board", action: "Board loading is a read helper and is explicitly exempt.", artifactPath: ".paper/orchestration/board.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "read-helper", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "loadBoard", mcpTool: "query_workspace_index", commandIds: ["paper.orchestrate"] } },
  { id: "save-board", action: "Board persistence is an internal helper already covered by guarded orchestration updates and is explicitly exempt as a standalone mutation entrypoint.", artifactPath: ".paper/orchestration/board.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "internal-helper", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "saveBoard", mcpTool: "upsert_orchestration_board", commandIds: ["paper.orchestrate"] } },
  { id: "persist-experiment-audit", action: "Experiment audit persistence is an internal helper used by guarded experiment-audit flows and bounded runtime execution, and is explicitly exempt as a standalone mutation entrypoint.", artifactPath: ".paper/experiments/audits.json", ownerRole: "experiment-planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "internal-helper", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "persistExperimentAudit", mcpTool: "run_experiment_audit", commandIds: ["paper.experiment-audit"] } },
  { id: "persist-experiment-result-claim-bridge", action: "Result-to-claim bridge persistence is an internal helper used by guarded bridge flows and bounded runtime execution, and is explicitly exempt as a standalone mutation entrypoint.", artifactPath: ".paper/claims/bridge-log.json", ownerRole: "experiment-planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "internal-helper", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "persistExperimentResultClaimBridge", mcpTool: "bridge_result_to_claim", commandIds: ["paper.result-bridge"] } },
  { id: "persist-review-log", action: "Review log persistence is an internal helper used by guarded review flows and bounded runtime review execution, and is explicitly exempt as a standalone mutation entrypoint.", artifactPath: ".paper/reviews/log.md", ownerRole: "reviewer", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "internal-helper", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "persistReviewLog", mcpTool: "run_review_loop", commandIds: ["paper.review-loop"] } },
  { id: "persist-rebuttal-issues", action: "Rebuttal issue persistence is an internal helper used by guarded review/rebuttal flows and bounded runtime review execution, and is explicitly exempt as a standalone mutation entrypoint.", artifactPath: ".paper/rebuttal/issues.json", ownerRole: "reviewer", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "internal-helper", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "persistRebuttalIssues", mcpTool: "normalize_rebuttal_issues", commandIds: ["paper.review-loop"] } },
  { id: "refresh-durable-surfaces", action: "Durable surface refresh is a proposal-only summarization step and remains exempt.", artifactPath: ".paper/workspace/index.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-24T00:00:00.000Z", reasonCode: "summary-refresh", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "refreshDurableSurfaces", mcpTool: "query_workspace_index", commandIds: ["paper.meta-optimize", "paper.task-graph", "paper.open-questions", "paper.decisions", "paper.lineage"] } },
  { id: "summarize-session-journal", action: "Session summarization is reflective and remains exempt from execution gating.", artifactPath: ".paper/sessions/LATEST_SUMMARY.md", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-24T00:00:00.000Z", reasonCode: "reflective-summary", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "summarizeSessionJournal", mcpTool: "query_meta_optimize", commandIds: ["paper.meta-optimize"] } }
];

export const GOVERNANCE_READONLY_COMMANDS = [
  "paper.pipeline",
  "paper.task-graph",
  "paper.open-questions",
  "paper.decisions",
  "paper.lineage",
  "paper.governance-audit"
];

export const GOVERNANCE_READONLY_TOOLS = [
  "ensure_workspace",
  "read_state",
  "query_task_graph",
  "query_open_questions",
  "query_decisions",
  "query_lineage",
  "query_workspace_index",
  "query_meta_optimize",
  "query_governance_coverage_report",
  "query_operator_follow_through",
  "query_program_approvals",
  "query_campaigns",
  "query_boundary_report",
  "read_role_context_manifest",
  "read_phase_context_manifest",
  "read_packet_context_manifest",
  "read_artifact_context_manifest",
  "read_action_context_bundle",
  "summarize_session_journal",
  "list_artifacts"
];

export const GOVERNANCE_NEGATIVE_COVERAGE = [
  { id: "upsert-orchestration-board", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "append-handoff", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "register-source", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "upsert-note", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "upsert-claims", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "upsert-plan", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "upsert-outline", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "upsert-draft", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "set-section-status", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "upsert-figure-plan", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "sync-citations", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "refresh-wiki", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "build-rebuttal", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "append-review-log", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt", "a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "upsert-revision-plan", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "run-review-loop", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "update-research-brief", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "upsert-experiment-plan", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "upsert-experiment-result", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "run-experiment-audit", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "bridge-experiment-result-to-claim", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "normalize-rebuttal-issues", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "build-rebuttal-strategy", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "create-version-snapshot", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "compare-versions", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "materialize-guidance-packet", level: "dynamic", tests: ["materializeGuidancePacket creates a durable packet from accepted remediation guidance and binds follow-through"] }
];

export function resolveResumeCommandForPhase(phase) {
  switch (phase) {
    case "sources":
      return "project:paper.research";
    case "notes":
    case "research":
      return "project:paper.claim-gate";
    case "plan":
      return "project:paper.outline";
    case "outline":
      return "project:paper.draft";
    case "draft":
    case "experiments":
      return "project:paper.review-loop";
    case "review":
      return "project:paper.rebuttal-strategy";
    case "rebuttal":
      return "project:paper.version-snapshot";
    case "versions":
      return "project:paper.version-compare";
    case "checklist":
      return "project:paper.checklist";
    default:
      return "project:paper.orchestrate";
  }
}

export const ROLE_IDS = [
  "planner",
  "researcher",
  "reviewer",
  "rebuttal-lead",
  "experiment-planner",
  "version-analyst"
];

export const ARTIFACT_PATHS = {
  paperRoot: ".paper",
  state: ".paper/state.json",
  readme: ".paper/README.md",
  project: ".paper/project.md",
  researchContract: ".paper/contracts/research-contract.md",
  orchestrationBoard: ".paper/orchestration/board.json",
  orchestrationHandoffs: ".paper/orchestration/handoffs.md",
  taskPacketsDir: ".paper/task-packets",
  taskPacketsPacketsDir: ".paper/task-packets/packets",
  taskPacketsIndex: ".paper/task-packets/index.json",
  roleContextsDir: ".paper/context/roles",
  phaseContextsDir: ".paper/context/phases",
  packetContextsDir: ".paper/context/packets",
  artifactContextsDir: ".paper/context/artifacts",
  actionContextsDir: ".paper/context/actions",
  sessionJournal: ".paper/sessions/journal.json",
  sessionSummary: ".paper/sessions/LATEST_SUMMARY.md",
  workspaceDir: ".paper/workspace",
  workspaceIndex: ".paper/workspace/index.json",
  programsDir: ".paper/programs",
  programsIndex: ".paper/programs/index.json",
  programRuns: ".paper/programs/runs.json",
  programApprovals: ".paper/programs/approvals.json",
  campaignsIndex: ".paper/programs/campaigns.json",
  workflowPackDir: ".paper/workflow-pack",
  workflowBoundaries: ".paper/workflow-pack/boundaries.json",
  researchBrief: ".paper/research/brief.md",
  researchAgenda: ".paper/research/agenda.json",
  plan: ".paper/plans/current-plan.md",
  outline: ".paper/outline/current-outline.md",
  findings: ".paper/findings.md",
  experimentLog: ".paper/experiments/EXPERIMENT_LOG.md",
  experimentPlans: ".paper/experiments/plans.json",
  experimentResults: ".paper/experiments/results.json",
  experimentAudits: ".paper/experiments/audits.json",
  sources: ".paper/sources/index.json",
  notes: ".paper/notes/index.json",
  evidence: ".paper/evidence/index.json",
  claims: ".paper/claims/CLAIMS_FROM_RESULTS.md",
  claimBridgeLog: ".paper/claims/bridge-log.json",
  draftsDir: ".paper/drafts",
  reviewLog: ".paper/reviews/log.md",
  reviewState: ".paper/reviews/REVIEW_STATE.json",
  reviewConcerns: ".paper/reviews/concerns.json",
  reviewDebateLog: ".paper/reviews/debate-log.md",
  adversarialReviewState: ".paper/reviews/adversarial-state.json",
  revisionPlan: ".paper/revision-plans/current-plan.md",
  wiki: ".paper/wiki/index.md",
  queryPack: ".paper/wiki/query_pack.md",
  navigationReport: ".paper/wiki/navigation.md",
  wikiEntities: ".paper/wiki/entities.json",
  wikiRelations: ".paper/wiki/relations.json",
  checklist: ".paper/checklists/paper.md",
  bibliography: ".paper/bibliography/references.bib",
  citationLog: ".paper/bibliography/citation-log.md",
  figuresReadme: ".paper/figures/README.md",
  figuresIndex: ".paper/figures/index.json",
  figureBriefs: ".paper/figures/briefs.json",
  figureSegments: ".paper/figures/segments.json",
  figureTemplates: ".paper/figures/templates.json",
  figureEditableIndex: ".paper/figures/editable-index.json",
  figureFinalIndex: ".paper/figures/final-index.json",
  figureQa: ".paper/figures/qa.json",
  rebuttalIssues: ".paper/rebuttal/issues.json",
  rebuttalStrategy: ".paper/rebuttal/strategy.md",
  rebuttalResponseDraft: ".paper/rebuttal/response-draft.md",
  versionsIndex: ".paper/versions/index.json",
  versionComparisons: ".paper/versions/comparisons.json",
  versionComparisonReport: ".paper/versions/LATEST_COMPARISON.md",
  versionSnapshotsDir: ".paper/versions/snapshots",
  runtimeDir: ".paper/runtime",
  runtimeControllerState: ".paper/runtime/controller-state.json",
  runtimeContinuation: ".paper/runtime/continuation.json",
  runtimeLeases: ".paper/runtime/leases.json",
  runtimeEvents: ".paper/runtime/events.json",
  runtimeResults: ".paper/runtime/results.json",
  metaDir: ".paper/meta",
  metaEvents: ".paper/meta/events.json",
  metaExecutionBridgeCandidates: ".paper/meta/execution-bridge-candidates.json",
  metaGovernanceCoverage: ".paper/meta/governance-coverage.json",
  metaGovernanceCoverageReport: ".paper/meta/governance-coverage-report.json",
  metaGovernanceCoverageReportMarkdown: ".paper/meta/LATEST_GOVERNANCE_COVERAGE_REPORT.md",
  metaLongHorizonMemory: ".paper/meta/long-horizon-memory.json",
  metaOperatorFollowThrough: ".paper/meta/operator-follow-through.json",
  metaOperatorFollowThroughTransitions: ".paper/meta/operator-follow-through-transitions.json",
  metaOperatorPlaybooks: ".paper/meta/operator-playbooks.json",
  metaRemediationPacks: ".paper/meta/remediation-packs.json",
  metaRecommendations: ".paper/meta/recommendations.json",
  metaOptimizerState: ".paper/meta/optimizer-state.json",
  metaOptimizerReport: ".paper/meta/LATEST_OPTIMIZER_REPORT.md"
};

export const AUTONOMY_ALLOWED_STEP_TYPES = [
  "refresh-research-brief",
  "refresh-wiki",
  "upsert-note",
  "run-experiment-audit",
  "bridge-result-to-claim",
  "run-review-loop"
];

export function normalizeAutonomyAllowedStepType(value, fallback = "refresh-research-brief") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/_/g, "-") : "";
  if (AUTONOMY_ALLOWED_STEP_TYPES.includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function digestText(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function createManagedArtifactMeta(kind, relativePath) {
  const seed = JSON.stringify({ kind, relativePath, schema: SCHEMA_VERSION, pack: PACKAGE_VERSION });
  return {
    revisionId: `schema-v${SCHEMA_VERSION}:${kind}`,
    templateHash: digestText(seed),
    generatedByVersion: PACKAGE_VERSION,
    managedKind: kind,
    path: relativePath
  };
}

export function createContinuationState(overrides = {}) {
  return {
    status: "ready-to-resume",
    lastCheckpoint: "Workspace bootstrapped.",
    checkpointHistory: [],
    updatedAt: null,
    ...overrides,
    checkpointHistory: Array.isArray(overrides.checkpointHistory) ? overrides.checkpointHistory : []
  };
}

function defaultSections() {
  return Object.fromEntries(
    DEFAULT_SECTION_ORDER.map(([id, title]) => [
      id,
      {
        id,
        title,
        status: "planned",
        summary: "",
        draftPath: `.paper/drafts/${id}.md`,
        claimIds: []
      }
    ])
  );
}

function defaultRoleRoster() {
  return [
    {
      id: "planner",
      label: "Planner",
      charter: "Keeps the board current, sequences work, and maintains plan/review gates."
    },
    {
      id: "researcher",
      label: "Researcher",
      charter: "Expands sources, notes, claims, and durable research briefs."
    },
    {
      id: "reviewer",
      label: "Reviewer",
      charter: "Runs evidence-aware review and records blockers or revision items."
    },
    {
      id: "rebuttal-lead",
      label: "Rebuttal Lead",
      charter: "Normalizes reviewer issues, writes strategy, and keeps responses factual."
    },
    {
      id: "experiment-planner",
      label: "Experiment Planner",
      charter: "Defines claim-driven experiments and tracks results-to-claim closure."
    },
    {
      id: "version-analyst",
      label: "Version Analyst",
      charter: "Snapshots versions, tracks lineage, and compares changes honestly."
    }
  ];
}

export function createDefaultBoard(stateOverrides = {}) {
  const objective = stateOverrides.paper?.objective ?? "Capture the paper's goal and contribution.";
  const phase = stateOverrides.pipeline?.currentStage ?? "init";
  return {
    version: 2,
    paperObjective: objective,
    currentPhase: phase,
    intentType: "plan",
    assignedRole: "planner",
    currentFocus: "Align the board and choose the next durable step.",
    nextAction: "Run project:paper.orchestrate and record the next role-owned task.",
    continuationState: createContinuationState(),
    reviewRequiredBeforeFinalize: false,
    tasks: [],
    blockers: [],
    evidenceLinks: [],
    experimentIds: [],
    rebuttalIssueIds: [],
    unresolvedBlockersByRole: {},
    versionLineage: {
      currentVersionId: null,
      parentVersionId: null,
      snapshotIds: []
    },
    activeComparisonTargets: [],
    roleRoster: defaultRoleRoster(),
    updatedAt: new Date(0).toISOString()
  };
}

export function createDefaultState(overrides = {}) {
  const base = {
    version: SCHEMA_VERSION,
    paper: {
      title: "Untitled Paper",
      venue: "Unspecified",
      objective: "Capture the paper's goal and contribution.",
      deadline: "",
      thesis: "Describe the paper's core claim in one sentence.",
      audience: "TBD"
    },
    pipeline: {
      currentStage: "init",
      lastCompletedStage: null,
      resumeCommand: "project:paper.orchestrate",
      updatedAt: new Date(0).toISOString()
    },
    orchestration: {
      boardPath: ARTIFACT_PATHS.orchestrationBoard,
      handoffPath: ARTIFACT_PATHS.orchestrationHandoffs,
      phase: "init",
      intentType: "plan",
      assignedRole: "planner",
      currentFocus: "Align the board and choose the next durable step.",
      nextAction: "Run project:paper.orchestrate and record the next role-owned task.",
      continuationState: createContinuationState(),
      reviewRequiredBeforeFinalize: false,
      activeTaskIds: [],
      blockerIds: [],
      evidenceLinks: [],
      experimentIds: [],
      rebuttalIssueIds: [],
      currentVersionId: null,
      activeComparisonTargets: []
    },
    sections: defaultSections(),
    artifacts: {
      ...ARTIFACT_PATHS
    },
    reviews: {
      lastVerdict: "not-reviewed",
      lastReviewedAt: null,
      openItems: [],
      unresolvedConcernIds: []
    },
    settings: {
      strictMode: false
    }
  };

  return {
    ...base,
    ...overrides,
    paper: {
      ...base.paper,
      ...(overrides.paper ?? {})
    },
    pipeline: {
      ...base.pipeline,
      ...(overrides.pipeline ?? {})
    },
    orchestration: normalizeOrchestration(overrides.orchestration, base.orchestration),
    sections: normalizeSections(overrides.sections),
    artifacts: {
      ...ARTIFACT_PATHS,
      ...(overrides.artifacts ?? {})
    },
    reviews: {
      ...base.reviews,
      ...(overrides.reviews ?? {}),
      openItems: Array.isArray(overrides.reviews?.openItems) ? overrides.reviews.openItems : [],
      unresolvedConcernIds: Array.isArray(overrides.reviews?.unresolvedConcernIds) ? overrides.reviews.unresolvedConcernIds : []
    },
    settings: {
      ...base.settings,
      ...(overrides.settings ?? {})
    }
  };
}

export function normalizeSections(rawSections) {
  const merged = defaultSections();
  if (!rawSections || typeof rawSections !== "object") {
    return merged;
  }

  for (const [id, section] of Object.entries(rawSections)) {
    merged[id] = {
      ...(merged[id] ?? {
        id,
        title: id,
        status: "planned",
        summary: "",
        draftPath: `.paper/drafts/${id}.md`,
        claimIds: []
      }),
      ...section,
      id,
      draftPath: section?.draftPath ?? `.paper/drafts/${id}.md`,
      claimIds: Array.isArray(section?.claimIds) ? section.claimIds : []
    };
  }

  return merged;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeStringArray(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return source.filter((item) => typeof item === "string" && item.trim());
}

function normalizeObjectArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
}

function normalizeObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeStringArrayRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, items]) => [key, normalizeStringArray(items)])
  );
}

function normalizeContinuation(value) {
  if (!value || typeof value !== "object") {
    return createContinuationState();
  }
  return createContinuationState(value);
}

function normalizeOrchestration(raw = {}, defaults = {}) {
  return {
    ...defaults,
    ...raw,
    continuationState: normalizeContinuation(raw.continuationState ?? defaults.continuationState),
    activeTaskIds: normalizeArray(raw.activeTaskIds),
    blockerIds: normalizeArray(raw.blockerIds),
    evidenceLinks: normalizeArray(raw.evidenceLinks),
    experimentIds: normalizeArray(raw.experimentIds),
    rebuttalIssueIds: normalizeArray(raw.rebuttalIssueIds),
    activeComparisonTargets: normalizeArray(raw.activeComparisonTargets)
  };
}

export function normalizeState(raw = {}) {
  if (!raw || typeof raw !== "object") {
    return createDefaultState();
  }

  if (raw.version === 1) {
    return createDefaultState({
      paper: {
        title: raw.projectTitle ?? "Untitled Paper",
        venue: raw.venue ?? "Unspecified",
        objective: raw.objective ?? "Capture the paper's goal and contribution.",
        deadline: raw.deadline ?? "",
        thesis: "Describe the paper's core claim in one sentence.",
        audience: "TBD"
      },
      pipeline: {
        currentStage: raw.currentPhase ?? "init",
        lastCompletedStage: null,
        resumeCommand: "project:paper.orchestrate",
        updatedAt: raw.updatedAt ?? new Date(0).toISOString()
      },
      orchestration: {
        phase: raw.currentPhase ?? "init"
      }
    });
  }

  if (raw.version === 2) {
    return createDefaultState({
      ...raw,
      version: SCHEMA_VERSION,
      orchestration: {
        phase: raw.pipeline?.currentStage ?? "init",
        assignedRole: raw.pipeline?.currentStage === "review" ? "reviewer" : "planner",
        activeTaskIds: [],
        blockerIds: [],
        evidenceLinks: [],
        experimentIds: [],
        rebuttalIssueIds: [],
        currentVersionId: null,
        activeComparisonTargets: []
      },
      pipeline: {
        ...(raw.pipeline ?? {}),
        resumeCommand: raw.pipeline?.resumeCommand ?? "project:paper.orchestrate"
      }
    });
  }

  const defaults = createDefaultState();
  return {
    ...defaults,
    ...raw,
    version: SCHEMA_VERSION,
    paper: {
      ...defaults.paper,
      ...(raw.paper ?? {})
    },
    pipeline: {
      ...defaults.pipeline,
      ...(raw.pipeline ?? {})
    },
    orchestration: normalizeOrchestration(raw.orchestration, defaults.orchestration),
    sections: normalizeSections(raw.sections),
    artifacts: {
      ...ARTIFACT_PATHS,
      ...(raw.artifacts ?? {})
    },
    reviews: {
      ...defaults.reviews,
      ...(raw.reviews ?? {}),
      openItems: Array.isArray(raw.reviews?.openItems) ? raw.reviews.openItems : [],
      unresolvedConcernIds: Array.isArray(raw.reviews?.unresolvedConcernIds) ? raw.reviews.unresolvedConcernIds : []
    },
    settings: {
      ...defaults.settings,
      ...(raw.settings ?? {})
    }
  };
}

export function normalizeWorkspaceIndex(raw = {}) {
  const base = createWorkspaceIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }

  const workQueues = normalizeObject(raw.workQueues);
  const resumeGuidance = normalizeObject(raw.resumeGuidance);
  const contextSurfaces = normalizeObject(raw.contextSurfaces);
  const behaviorDiscipline = normalizeObject(raw.behaviorDiscipline);
  const dependencyHealth = normalizeObject(raw.dependencyHealth);
  const repairFrontier = normalizeObject(raw.repairFrontier);
  const metaOptimize = normalizeObject(raw.metaOptimize);
  const runtime = normalizeObject(raw.runtime);
  const programs = normalizeObject(raw.programs);
  const campaigns = normalizeObject(raw.campaigns);
  const autonomyLoops = normalizeObject(raw.autonomyLoops);
  const latestVersions = normalizeObject(raw.latestVersions);

  return {
    ...base,
    ...raw,
    version: base.version,
    managed: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workspaceIndex),
    boardPhase: normalizeString(raw.boardPhase, base.boardPhase),
    boardAssignedRole: normalizeString(raw.boardAssignedRole, base.boardAssignedRole),
    boardIntentType: normalizeString(raw.boardIntentType, base.boardIntentType),
    currentFocus: normalizeString(raw.currentFocus, base.currentFocus),
    nextAction: normalizeString(raw.nextAction, base.nextAction),
    continuationState: normalizeContinuation(raw.continuationState),
    activePackets: normalizeObjectArray(raw.activePackets),
    workQueues: {
      ready: normalizeObjectArray(workQueues.ready),
      waiting: normalizeObjectArray(workQueues.waiting),
      reviewNeeded: normalizeObjectArray(workQueues.reviewNeeded),
      handoff: normalizeObjectArray(workQueues.handoff),
      stale: normalizeObjectArray(workQueues.stale),
      archived: normalizeObjectArray(workQueues.archived)
    },
    ownershipSummary: normalizeObjectArray(raw.ownershipSummary),
    packetLifecycleCounts: normalizeObject(raw.packetLifecycleCounts),
    handoffObligations: normalizeObjectArray(raw.handoffObligations),
    resumeGuidance: {
      ...base.resumeGuidance,
      ...resumeGuidance,
      command: normalizeString(resumeGuidance.command, base.resumeGuidance.command),
      summary: normalizeString(resumeGuidance.summary, base.resumeGuidance.summary),
      prioritizedPacketIds: normalizeStringArray(resumeGuidance.prioritizedPacketIds),
      packetContextPaths: normalizeStringArray(resumeGuidance.packetContextPaths),
      handoffCandidateIds: normalizeStringArray(resumeGuidance.handoffCandidateIds)
    },
    contextSurfaces: {
      ...base.contextSurfaces,
      ...contextSurfaces,
      currentRoleContextPath: normalizeString(contextSurfaces.currentRoleContextPath, base.contextSurfaces.currentRoleContextPath),
      currentPhaseContextPath: normalizeString(contextSurfaces.currentPhaseContextPath, base.contextSurfaces.currentPhaseContextPath),
      currentActionContextPath: normalizeString(contextSurfaces.currentActionContextPath, base.contextSurfaces.currentActionContextPath),
      prioritizedArtifactContextPaths: normalizeStringArray(contextSurfaces.prioritizedArtifactContextPaths),
      prioritizedPacketActionContextPaths: normalizeStringArray(contextSurfaces.prioritizedPacketActionContextPaths)
    },
    behaviorDiscipline: {
      ...base.behaviorDiscipline,
      ...behaviorDiscipline,
      summary: normalizeString(behaviorDiscipline.summary, base.behaviorDiscipline.summary),
      explicitOnly: normalizeBoolean(behaviorDiscipline.explicitOnly, base.behaviorDiscipline.explicitOnly),
      noHiddenRuntime: normalizeBoolean(behaviorDiscipline.noHiddenRuntime, base.behaviorDiscipline.noHiddenRuntime),
      requiredReadOrder: normalizeStringArray(behaviorDiscipline.requiredReadOrder)
    },
    dependencyHealth: {
      blockedPacketIds: normalizeStringArray(dependencyHealth.blockedPacketIds),
      healthyPacketIds: normalizeStringArray(dependencyHealth.healthyPacketIds),
      waitingPacketIds: normalizeStringArray(dependencyHealth.waitingPacketIds),
      stalePacketIds: normalizeStringArray(dependencyHealth.stalePacketIds),
      missingDependencyIds: normalizeStringArray(dependencyHealth.missingDependencyIds),
      orphanPacketIds: normalizeStringArray(dependencyHealth.orphanPacketIds)
    },
    repairFrontier: {
      ...base.repairFrontier,
      ...repairFrontier,
      count: Number.isFinite(repairFrontier.count) ? repairFrontier.count : base.repairFrontier.count,
      relationIssueCount: Number.isFinite(repairFrontier.relationIssueCount) ? repairFrontier.relationIssueCount : base.repairFrontier.relationIssueCount,
      relationFamilyIssueCount: Number.isFinite(repairFrontier.relationFamilyIssueCount) ? repairFrontier.relationFamilyIssueCount : base.repairFrontier.relationFamilyIssueCount,
      managedArtifactIssueCount: Number.isFinite(repairFrontier.managedArtifactIssueCount) ? repairFrontier.managedArtifactIssueCount : base.repairFrontier.managedArtifactIssueCount,
      governanceIssueCount: Number.isFinite(repairFrontier.governanceIssueCount) ? repairFrontier.governanceIssueCount : base.repairFrontier.governanceIssueCount,
      topDegradedFamilyIds: normalizeStringArray(repairFrontier.topDegradedFamilyIds),
      topDegradedGroupIds: normalizeStringArray(repairFrontier.topDegradedGroupIds),
      taxonomyOverview: normalizeString(repairFrontier.taxonomyOverview, base.repairFrontier.taxonomyOverview),
      relationFamilySummaries: normalizeObjectArray(repairFrontier.relationFamilySummaries),
      relationGroupSummaries: normalizeObjectArray(repairFrontier.relationGroupSummaries),
      prioritizedItems: normalizeObjectArray(repairFrontier.prioritizedItems)
    },
    metaOptimize: normalizeWorkspaceMetaOptimize(metaOptimize, base.metaOptimize),
    runtime: normalizeWorkspaceRuntime(runtime, base.runtime),
    programs: normalizeWorkspacePrograms(programs, base.programs),
    campaigns: normalizeWorkspaceCampaigns(campaigns, base.campaigns),
    autonomyLoops: normalizeWorkspaceAutonomyLoops(autonomyLoops, base.autonomyLoops),
    activeRoles: normalizeStringArray(raw.activeRoles),
    unresolvedConcernIds: normalizeStringArray(raw.unresolvedConcernIds),
    mostRecentSessions: normalizeObjectArray(raw.mostRecentSessions),
    latestVersions: {
      ...base.latestVersions,
      ...latestVersions,
      currentVersionId: latestVersions.currentVersionId ?? base.latestVersions.currentVersionId,
      activeTargets: normalizeStringArray(latestVersions.activeTargets),
      latestSnapshotIds: normalizeStringArray(latestVersions.latestSnapshotIds)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeRuntimeControllerState(raw = {}) {
  const base = createRuntimeControllerState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  const lastRun = normalizeObject(raw.lastRun);
  return {
    ...base,
    ...raw,
    version: base.version,
    explicitInvocationOnly: normalizeBoolean(raw.explicitInvocationOnly, base.explicitInvocationOnly),
    noDaemon: normalizeBoolean(raw.noDaemon, base.noDaemon),
    selectionPolicy: normalizeString(raw.selectionPolicy, base.selectionPolicy),
    boundedStepPolicy: normalizeString(raw.boundedStepPolicy, base.boundedStepPolicy),
    lastRun: Object.keys(lastRun).length === 0 ? null : {
      runId: normalizeString(lastRun.runId, null),
      status: normalizeString(lastRun.status, null),
      outcome: normalizeString(lastRun.outcome, null),
      selectedPacketId: normalizeString(lastRun.selectedPacketId, null),
      leaseId: normalizeString(lastRun.leaseId, null),
      actorRole: normalizeString(lastRun.actorRole, null),
      envelopeWorkerRole: normalizeString(lastRun.envelopeWorkerRole, null),
      programId: normalizeString(lastRun.programId, null),
      programRunId: normalizeString(lastRun.programRunId, null),
      approvalId: normalizeString(lastRun.approvalId, null),
      startedAt: lastRun.startedAt ?? null,
      completedAt: lastRun.completedAt ?? null,
      summary: normalizeString(lastRun.summary, "")
    },
    summary: {
      ...base.summary,
      ...summary,
      lastRunId: normalizeString(summary.lastRunId, base.summary.lastRunId),
      lastStatus: normalizeString(summary.lastStatus, base.summary.lastStatus),
      lastOutcome: normalizeString(summary.lastOutcome, base.summary.lastOutcome),
      lastSelectedPacketId: normalizeString(summary.lastSelectedPacketId, base.summary.lastSelectedPacketId),
      lastEnvelopeWorkerRole: normalizeString(summary.lastEnvelopeWorkerRole, base.summary.lastEnvelopeWorkerRole),
      lastProgramId: normalizeString(summary.lastProgramId, base.summary.lastProgramId),
      lastProgramRunId: normalizeString(summary.lastProgramRunId, base.summary.lastProgramRunId),
      lastApprovalId: normalizeString(summary.lastApprovalId, base.summary.lastApprovalId),
      lastProgramOutcome: normalizeString(summary.lastProgramOutcome, base.summary.lastProgramOutcome),
      requestCount: normalizeNumber(summary.requestCount, base.summary.requestCount),
      acceptedRequestCount: normalizeNumber(summary.acceptedRequestCount, base.summary.acceptedRequestCount),
      executingRequestCount: normalizeNumber(summary.executingRequestCount, base.summary.executingRequestCount),
      staleRequestCount: normalizeNumber(summary.staleRequestCount, base.summary.staleRequestCount),
      overdueExecutionCount: normalizeNumber(summary.overdueExecutionCount, base.summary.overdueExecutionCount),
      dueReviewCount: normalizeNumber(summary.dueReviewCount, base.summary.dueReviewCount),
      checkpointCount: normalizeNumber(summary.checkpointCount, base.summary.checkpointCount),
      escalationCount: normalizeNumber(summary.escalationCount, base.summary.escalationCount),
      lastCheckpointPacketId: normalizeString(summary.lastCheckpointPacketId, base.summary.lastCheckpointPacketId),
      lastCheckpointSummary: normalizeString(summary.lastCheckpointSummary, base.summary.lastCheckpointSummary),
      lastCheckpointAt: summary.lastCheckpointAt ?? base.summary.lastCheckpointAt,
      lastEscalationPacketId: normalizeString(summary.lastEscalationPacketId, base.summary.lastEscalationPacketId),
      lastEscalationFollowThroughId: normalizeString(summary.lastEscalationFollowThroughId, base.summary.lastEscalationFollowThroughId),
      lastEscalationAt: summary.lastEscalationAt ?? base.summary.lastEscalationAt,
      overview: normalizeString(summary.overview, base.summary.overview),
      controllerStatePath: normalizeString(summary.controllerStatePath, base.summary.controllerStatePath),
      leasesPath: normalizeString(summary.leasesPath, base.summary.leasesPath),
      eventsPath: normalizeString(summary.eventsPath, base.summary.eventsPath),
      resultsPath: normalizeString(summary.resultsPath, base.summary.resultsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeRuntimeLeasesIndex(raw = {}) {
  const base = createRuntimeLeasesIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    explicitInvocationOnly: normalizeBoolean(raw.explicitInvocationOnly, base.explicitInvocationOnly),
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      activeLeaseCount: normalizeNumber(summary.activeLeaseCount, base.summary.activeLeaseCount),
      activePacketIds: normalizeStringArray(summary.activePacketIds),
      activeLeaseIds: normalizeStringArray(summary.activeLeaseIds),
      overview: normalizeString(summary.overview, base.summary.overview),
      leasesPath: normalizeString(summary.leasesPath, base.summary.leasesPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeRuntimeContinuationIndex(raw = {}) {
  const base = createRuntimeContinuationIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    explicitInvocationOnly: normalizeBoolean(raw.explicitInvocationOnly, base.explicitInvocationOnly),
    noDaemon: normalizeBoolean(raw.noDaemon, base.noDaemon),
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      continuationCount: normalizeNumber(summary.continuationCount, base.summary.continuationCount),
      currentKind: normalizeString(summary.currentKind, base.summary.currentKind),
      currentPacketId: normalizeString(summary.currentPacketId, base.summary.currentPacketId),
      currentProgramRunId: normalizeString(summary.currentProgramRunId, base.summary.currentProgramRunId),
      currentCommand: normalizeString(summary.currentCommand, base.summary.currentCommand),
      overview: normalizeString(summary.overview, base.summary.overview),
      continuationPath: normalizeString(summary.continuationPath, base.summary.continuationPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeRuntimeEventsIndex(raw = {}) {
  const base = createRuntimeEventsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    explicitInvocationOnly: normalizeBoolean(raw.explicitInvocationOnly, base.explicitInvocationOnly),
    entries: normalizeObjectArray(raw.entries),
    summary: {
      ...base.summary,
      ...summary,
      eventCount: normalizeNumber(summary.eventCount, base.summary.eventCount),
      lastEventType: normalizeString(summary.lastEventType, base.summary.lastEventType),
      lastRunId: normalizeString(summary.lastRunId, base.summary.lastRunId),
      overview: normalizeString(summary.overview, base.summary.overview),
      eventsPath: normalizeString(summary.eventsPath, base.summary.eventsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeRuntimeResultsIndex(raw = {}) {
  const base = createRuntimeResultsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    explicitInvocationOnly: normalizeBoolean(raw.explicitInvocationOnly, base.explicitInvocationOnly),
    entries: normalizeObjectArray(raw.entries),
    summary: {
      ...base.summary,
      ...summary,
      runCount: normalizeNumber(summary.runCount, base.summary.runCount),
      completedCount: normalizeNumber(summary.completedCount, base.summary.completedCount),
      noopCount: normalizeNumber(summary.noopCount, base.summary.noopCount),
      errorCount: normalizeNumber(summary.errorCount, base.summary.errorCount),
      checkpointCount: normalizeNumber(summary.checkpointCount, base.summary.checkpointCount),
      escalationCount: normalizeNumber(summary.escalationCount, base.summary.escalationCount),
      lastRunId: normalizeString(summary.lastRunId, base.summary.lastRunId),
      lastStatus: normalizeString(summary.lastStatus, base.summary.lastStatus),
      lastOutcome: normalizeString(summary.lastOutcome, base.summary.lastOutcome),
      lastCheckpointPacketId: normalizeString(summary.lastCheckpointPacketId, base.summary.lastCheckpointPacketId),
      lastCheckpointSummary: normalizeString(summary.lastCheckpointSummary, base.summary.lastCheckpointSummary),
      lastCheckpointAt: summary.lastCheckpointAt ?? base.summary.lastCheckpointAt,
      lastEscalationPacketId: normalizeString(summary.lastEscalationPacketId, base.summary.lastEscalationPacketId),
      lastEscalationFollowThroughId: normalizeString(summary.lastEscalationFollowThroughId, base.summary.lastEscalationFollowThroughId),
      lastEscalationAt: summary.lastEscalationAt ?? base.summary.lastEscalationAt,
      overview: normalizeString(summary.overview, base.summary.overview),
      resultsPath: normalizeString(summary.resultsPath, base.summary.resultsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeProgramsIndex(raw = {}) {
  const base = createProgramsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      programCount: normalizeNumber(summary.programCount, base.summary.programCount),
      activeCount: normalizeNumber(summary.activeCount, base.summary.activeCount),
      blockedCount: normalizeNumber(summary.blockedCount, base.summary.blockedCount),
      topProgramIds: normalizeStringArray(summary.topProgramIds),
      overview: normalizeString(summary.overview, base.summary.overview),
      programsPath: normalizeString(summary.programsPath, base.summary.programsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeCampaignsIndex(raw = {}) {
  const base = createCampaignsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      campaignCount: normalizeNumber(summary.campaignCount, base.summary.campaignCount),
      plannedCount: normalizeNumber(summary.plannedCount, base.summary.plannedCount),
      activeCount: normalizeNumber(summary.activeCount, base.summary.activeCount),
      reviewNeededCount: normalizeNumber(summary.reviewNeededCount, base.summary.reviewNeededCount),
      completedCount: normalizeNumber(summary.completedCount, base.summary.completedCount),
      blockedCount: normalizeNumber(summary.blockedCount, base.summary.blockedCount),
      topCampaignIds: normalizeStringArray(summary.topCampaignIds),
      overview: normalizeString(summary.overview, base.summary.overview),
      campaignsPath: normalizeString(summary.campaignsPath, base.summary.campaignsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeProgramRunsIndex(raw = {}) {
  const base = createProgramRunsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      runCount: normalizeNumber(summary.runCount, base.summary.runCount),
      approvedCount: normalizeNumber(summary.approvedCount, base.summary.approvedCount),
      activeCount: normalizeNumber(summary.activeCount, base.summary.activeCount),
      reviewNeededCount: normalizeNumber(summary.reviewNeededCount, base.summary.reviewNeededCount),
      blockedCount: normalizeNumber(summary.blockedCount, base.summary.blockedCount),
      reviewCheckpointRunCount: normalizeNumber(summary.reviewCheckpointRunCount, base.summary.reviewCheckpointRunCount),
      topRunIds: normalizeStringArray(summary.topRunIds),
      overview: normalizeString(summary.overview, base.summary.overview),
      runsPath: normalizeString(summary.runsPath, base.summary.runsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeProgramApprovalsIndex(raw = {}) {
  const base = createProgramApprovalsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      approvalCount: normalizeNumber(summary.approvalCount, base.summary.approvalCount),
      approvedCount: normalizeNumber(summary.approvedCount, base.summary.approvedCount),
      revokedCount: normalizeNumber(summary.revokedCount, base.summary.revokedCount),
      consumedCount: normalizeNumber(summary.consumedCount, base.summary.consumedCount),
      topApprovalIds: normalizeStringArray(summary.topApprovalIds),
      overview: normalizeString(summary.overview, base.summary.overview),
      approvalsPath: normalizeString(summary.approvalsPath, base.summary.approvalsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeWorkflowBoundaries(raw = {}) {
  const base = createWorkflowBoundaries();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }

  const managedArtifacts = normalizeObject(raw.managedArtifacts);

  return {
    ...base,
    ...raw,
    version: base.version,
    managedPaths: normalizeStringArray(raw.managedPaths, base.managedPaths),
    paperBootstrapOnlyPaths: normalizeStringArray(raw.paperBootstrapOnlyPaths, base.paperBootstrapOnlyPaths),
    userOwnedPaths: normalizeStringArray(raw.userOwnedPaths, base.userOwnedPaths),
    managedArtifacts: {
      codePack: {
        ...createManagedArtifactMeta("managed-replaceable", "src"),
        ...normalizeObject(managedArtifacts.codePack)
      },
      workflowBoundaries: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workflowBoundaries),
      workspaceIndex: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workspaceIndex),
      executionBridgeCandidates: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.metaExecutionBridgeCandidates),
      remediationPacks: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.metaRemediationPacks)
    },
    notes: normalizeStringArray(raw.notes, base.notes),
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function createSourcesIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createNotesIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createEvidenceIndex() {
  return { version: 3, claims: [], updatedAt: null };
}

export function createTaskPacketsIndex() {
  return {
    version: 3,
    items: [],
    lifecycleCounts: {},
    dependencyHealth: {
      blockedPacketIds: [],
      readyPacketIds: [],
      stalePacketIds: [],
      missingDependencyIds: []
    },
    updatedAt: null
  };
}

export function createRuntimeControllerState() {
  return {
    version: 1,
    explicitInvocationOnly: true,
    noDaemon: true,
    selectionPolicy: "planner-materialized-guidance-v2",
    boundedStepPolicy: "planner-control-plane-worker-step-v1",
    lastRun: null,
    summary: {
      lastRunId: null,
      lastStatus: "never-run",
      lastOutcome: "not-started",
      lastSelectedPacketId: null,
      lastEnvelopeWorkerRole: null,
      lastProgramId: null,
      lastProgramRunId: null,
      lastApprovalId: null,
      lastProgramOutcome: "not-started",
      requestCount: 0,
      acceptedRequestCount: 0,
      executingRequestCount: 0,
      staleRequestCount: 0,
      overdueExecutionCount: 0,
      dueReviewCount: 0,
      checkpointCount: 0,
      escalationCount: 0,
      lastCheckpointPacketId: null,
      lastCheckpointSummary: null,
      lastCheckpointAt: null,
      lastEscalationPacketId: null,
      lastEscalationFollowThroughId: null,
      lastEscalationAt: null,
      overview: "No autonomous control-plane run has been executed yet.",
      controllerStatePath: ARTIFACT_PATHS.runtimeControllerState,
      leasesPath: ARTIFACT_PATHS.runtimeLeases,
      eventsPath: ARTIFACT_PATHS.runtimeEvents,
      resultsPath: ARTIFACT_PATHS.runtimeResults
    },
    updatedAt: null
  };
}

export function createRuntimeContinuationIndex() {
  return {
    version: 1,
    explicitInvocationOnly: true,
    noDaemon: true,
    items: [],
    summary: {
      continuationCount: 0,
      currentKind: null,
      currentPacketId: null,
      currentProgramRunId: null,
      currentCommand: null,
      overview: "No explicit autonomy continuation is currently pending.",
      continuationPath: ARTIFACT_PATHS.runtimeContinuation
    },
    updatedAt: null
  };
}

export function createRuntimeLeasesIndex() {
  return {
    version: 1,
    explicitInvocationOnly: true,
    items: [],
    summary: {
      activeLeaseCount: 0,
      activePacketIds: [],
      activeLeaseIds: [],
      overview: "No autonomous control-plane leases are currently active.",
      leasesPath: ARTIFACT_PATHS.runtimeLeases
    },
    updatedAt: null
  };
}

export function createRuntimeEventsIndex() {
  return {
    version: 1,
    explicitInvocationOnly: true,
    entries: [],
    summary: {
      eventCount: 0,
      lastEventType: null,
      lastRunId: null,
      overview: "No autonomous control-plane events have been recorded yet.",
      eventsPath: ARTIFACT_PATHS.runtimeEvents
    },
    updatedAt: null
  };
}

export function createRuntimeResultsIndex() {
  return {
    version: 1,
    explicitInvocationOnly: true,
    entries: [],
    summary: {
      runCount: 0,
      completedCount: 0,
      noopCount: 0,
      errorCount: 0,
      checkpointCount: 0,
      escalationCount: 0,
      lastRunId: null,
      lastStatus: "never-run",
      lastOutcome: "not-started",
      lastCheckpointPacketId: null,
      lastCheckpointSummary: null,
      lastCheckpointAt: null,
      lastEscalationPacketId: null,
      lastEscalationFollowThroughId: null,
      lastEscalationAt: null,
      overview: "No autonomous control-plane results have been recorded yet.",
      resultsPath: ARTIFACT_PATHS.runtimeResults
    },
    updatedAt: null
  };
}

export function createReviewState() {
  return {
    version: 3,
    lastVerdict: "not-reviewed",
    lastReviewedAt: null,
    history: [],
    openItems: [],
    unresolvedConcernIds: [],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 0,
    reviewerIndependence: {
      reviewerRole: "reviewer",
      responseOwnerRoles: [],
      separationMaintained: true
    }
  };
}

export function createReviewConcernsIndex() {
  return { version: 2, items: [], updatedAt: null };
}

export function createAdversarialReviewState() {
  return {
    version: 2,
    round: 0,
    unresolvedConcernIds: [],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    concernStatusCounts: {},
    escalationThresholds: { high: 1, medium: 2, low: 3 },
    lastAuditIds: [],
    lastBridgeIds: [],
    updatedAt: null
  };
}

export function createFiguresIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createFigureBriefsIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createFigureSegmentsIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createFigureTemplatesIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createFigureEditableIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createFigureFinalIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createFigureQaIndex() {
  return { version: 1, items: [], issues: [], updatedAt: null };
}

export function createResearchAgenda() {
  return {
    version: 1,
    objective: "Capture the paper's goal and contribution.",
    agenda: [],
    evidenceBacklog: [],
    updatedAt: null
  };
}

export function createProgramsIndex() {
  return {
    version: 1,
    items: [],
    summary: {
      programCount: 0,
      activeCount: 0,
      blockedCount: 0,
      topProgramIds: [],
      overview: "No research programs have been recorded yet.",
      programsPath: ARTIFACT_PATHS.programsIndex
    },
    updatedAt: null
  };
}

export function createCampaignsIndex() {
  return {
    version: 1,
    items: [],
    summary: {
      campaignCount: 0,
      plannedCount: 0,
      activeCount: 0,
      reviewNeededCount: 0,
      completedCount: 0,
      blockedCount: 0,
      topCampaignIds: [],
      overview: "No multi-cycle research campaigns have been recorded yet.",
      campaignsPath: ARTIFACT_PATHS.campaignsIndex
    },
    updatedAt: null
  };
}

export function createProgramRunsIndex() {
  return {
    version: 1,
    items: [],
    summary: {
      runCount: 0,
      approvedCount: 0,
      activeCount: 0,
      reviewNeededCount: 0,
      blockedCount: 0,
      reviewCheckpointRunCount: 0,
      topRunIds: [],
      overview: "No approved program runs have been recorded yet.",
      runsPath: ARTIFACT_PATHS.programRuns
    },
    updatedAt: null
  };
}

export function createProgramApprovalsIndex() {
  return {
    version: 1,
    items: [],
    summary: {
      approvalCount: 0,
      approvedCount: 0,
      revokedCount: 0,
      consumedCount: 0,
      topApprovalIds: [],
      overview: "No program approvals have been recorded yet.",
      approvalsPath: ARTIFACT_PATHS.programApprovals
    },
    updatedAt: null
  };
}

export function createSessionJournal() {
  return { version: 1, entries: [], updatedAt: null };
}

export function createExperimentPlansIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createExperimentResultsIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createExperimentAuditsIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createClaimBridgeLog() {
  return { version: 1, items: [], updatedAt: null };
}

export function createMetaEventsIndex() {
  return {
    version: 1,
    proposalOnly: true,
    items: [],
    updatedAt: null
  };
}

export function createMetaLongHorizonMemory() {
  return {
    version: 1,
    proposalOnly: true,
    historyWindowSize: 30,
    horizon: {
      sessionEntriesAnalyzed: 0,
      reviewRoundsObserved: 0,
      versionComparisonsAnalyzed: 0,
      auditRecordsAnalyzed: 0,
      bridgeRecordsAnalyzed: 0
    },
    summary: {
      familyCount: 0,
      recurringFamilyCount: 0,
      risingFamilyCount: 0,
      stableFamilyCount: 0,
      coolingFamilyCount: 0,
      snapshotCount: 0,
      lastObservedAt: null,
      lastAction: "unchanged",
      topFamilyIds: [],
      topTaxonomyFamilyIds: [],
      topTaxonomyGroupIds: [],
      pressureAreas: [],
      overview: "No long-horizon workflow memory has been summarized yet."
    },
    historyPolicy: {
      mode: "deterministic-noop-drift-guard-v1",
      lastAction: "unchanged",
      reason: "No long-horizon snapshots have been recorded yet.",
      comparedAt: null,
      lastMeaningfulChangeAt: null
    },
    history: [],
    families: [],
    updatedAt: null
  };
}

export function normalizeMetaLongHorizonMemory(raw = {}) {
  const base = createMetaLongHorizonMemory();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }

  const horizon = normalizeObject(raw.horizon);
  const summary = normalizeObject(raw.summary);
  const historyPolicy = normalizeObject(raw.historyPolicy);

  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    historyWindowSize: normalizeNumber(raw.historyWindowSize, base.historyWindowSize),
    horizon: {
      ...base.horizon,
      ...horizon,
      sessionEntriesAnalyzed: normalizeNumber(horizon.sessionEntriesAnalyzed, base.horizon.sessionEntriesAnalyzed),
      reviewRoundsObserved: normalizeNumber(horizon.reviewRoundsObserved, base.horizon.reviewRoundsObserved),
      versionComparisonsAnalyzed: normalizeNumber(horizon.versionComparisonsAnalyzed, base.horizon.versionComparisonsAnalyzed),
      auditRecordsAnalyzed: normalizeNumber(horizon.auditRecordsAnalyzed, base.horizon.auditRecordsAnalyzed),
      bridgeRecordsAnalyzed: normalizeNumber(horizon.bridgeRecordsAnalyzed, base.horizon.bridgeRecordsAnalyzed)
    },
    summary: {
      ...base.summary,
      ...summary,
      familyCount: normalizeNumber(summary.familyCount, base.summary.familyCount),
      recurringFamilyCount: normalizeNumber(summary.recurringFamilyCount, base.summary.recurringFamilyCount),
      risingFamilyCount: normalizeNumber(summary.risingFamilyCount, base.summary.risingFamilyCount),
      stableFamilyCount: normalizeNumber(summary.stableFamilyCount, base.summary.stableFamilyCount),
      coolingFamilyCount: normalizeNumber(summary.coolingFamilyCount, base.summary.coolingFamilyCount),
      snapshotCount: normalizeNumber(summary.snapshotCount, base.summary.snapshotCount),
      lastObservedAt: summary.lastObservedAt ?? base.summary.lastObservedAt,
      lastAction: normalizeString(summary.lastAction, base.summary.lastAction),
      topFamilyIds: normalizeStringArray(summary.topFamilyIds),
      topTaxonomyFamilyIds: normalizeStringArray(summary.topTaxonomyFamilyIds),
      topTaxonomyGroupIds: normalizeStringArray(summary.topTaxonomyGroupIds),
      pressureAreas: normalizeStringArray(summary.pressureAreas),
      overview: normalizeString(summary.overview, base.summary.overview)
    },
    historyPolicy: {
      ...base.historyPolicy,
      ...historyPolicy,
      mode: normalizeString(historyPolicy.mode, base.historyPolicy.mode),
      lastAction: normalizeString(historyPolicy.lastAction, base.historyPolicy.lastAction),
      reason: normalizeString(historyPolicy.reason, base.historyPolicy.reason),
      comparedAt: historyPolicy.comparedAt ?? base.historyPolicy.comparedAt,
      lastMeaningfulChangeAt: historyPolicy.lastMeaningfulChangeAt ?? base.historyPolicy.lastMeaningfulChangeAt
    },
    history: normalizeObjectArray(raw.history),
    families: normalizeObjectArray(raw.families),
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function createMetaRemediationPacksIndex() {
  return {
    version: 1,
    proposalOnly: true,
    packs: [],
    summary: {
      packCount: 0,
      topPackIds: [],
      topClusterIds: [],
      actionableCount: 0,
      partiallyActionableCount: 0,
      advisoryCount: 0,
      readinessOverview: "No proposal-only remediation packs have been generated yet.",
      overview: "No proposal-only remediation packs have been generated yet.",
      packsPath: ARTIFACT_PATHS.metaRemediationPacks
    },
    sourceArtifacts: [
      ARTIFACT_PATHS.metaRecommendations,
      ARTIFACT_PATHS.metaLongHorizonMemory,
      ARTIFACT_PATHS.reviewConcerns,
      ARTIFACT_PATHS.figureQa,
      ARTIFACT_PATHS.workspaceIndex,
      ARTIFACT_PATHS.navigationReport,
      ARTIFACT_PATHS.sessionSummary
    ],
    updatedAt: null
  };
}

export function normalizeMetaRemediationPacksIndex(raw = {}) {
  const base = createMetaRemediationPacksIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }

  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    packs: normalizeObjectArray(raw.packs),
    summary: {
      ...base.summary,
      ...summary,
      packCount: normalizeNumber(summary.packCount, base.summary.packCount),
      topPackIds: normalizeStringArray(summary.topPackIds),
      topClusterIds: normalizeStringArray(summary.topClusterIds),
      actionableCount: normalizeNumber(summary.actionableCount, base.summary.actionableCount),
      partiallyActionableCount: normalizeNumber(summary.partiallyActionableCount, base.summary.partiallyActionableCount),
      advisoryCount: normalizeNumber(summary.advisoryCount, base.summary.advisoryCount),
      readinessOverview: normalizeString(summary.readinessOverview, base.summary.readinessOverview),
      overview: normalizeString(summary.overview, base.summary.overview),
      packsPath: normalizeString(summary.packsPath, base.summary.packsPath)
    },
    sourceArtifacts: normalizeStringArray(raw.sourceArtifacts, base.sourceArtifacts),
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function createMetaOperatorPlaybooksIndex() {
  return {
    version: 1,
    proposalOnly: true,
    playbooks: [],
    summary: {
      playbookCount: 0,
      topPlaybookIds: [],
      topTaxonomyFamilyIds: [],
      actionableCount: 0,
      partiallyActionableCount: 0,
      advisoryCount: 0,
      readinessOverview: "No proposal-only family-level operator playbooks have been generated yet.",
      overview: "No proposal-only family-level operator playbooks have been generated yet.",
      playbooksPath: ARTIFACT_PATHS.metaOperatorPlaybooks
    },
    sourceArtifacts: [
      ARTIFACT_PATHS.wikiRelations,
      ARTIFACT_PATHS.workspaceIndex,
      ARTIFACT_PATHS.metaRecommendations,
      ARTIFACT_PATHS.metaLongHorizonMemory,
      ARTIFACT_PATHS.metaRemediationPacks,
      ARTIFACT_PATHS.metaOptimizerReport
    ],
    updatedAt: null
  };
}

export function createMetaExecutionBridgeCandidatesIndex() {
  return {
    version: 1,
    proposalOnly: true,
    noAutoApply: true,
    candidates: [],
    summary: {
      candidateCount: 0,
      topCandidateIds: [],
      candidateTypeCounts: {},
      overview: "No proposal-only execution bridge candidates have been generated yet.",
      candidatesPath: ARTIFACT_PATHS.metaExecutionBridgeCandidates
    },
    sourceArtifacts: [
      ARTIFACT_PATHS.metaOperatorPlaybooks,
      ARTIFACT_PATHS.metaRemediationPacks,
      ARTIFACT_PATHS.workspaceIndex,
      ARTIFACT_PATHS.metaOptimizerReport
    ],
    updatedAt: null
  };
}

export function createMetaGovernanceCoverageIndex() {
  return {
    version: 1,
    proposalOnly: true,
    guardedMutations: [],
    exemptMutations: [],
    summary: {
      guardedCount: 0,
      exemptCount: 0,
      overview: "No governance coverage matrix has been generated yet.",
      coveragePath: ARTIFACT_PATHS.metaGovernanceCoverage
    },
    updatedAt: null
  };
}

export function createMetaGovernanceCoverageReport() {
  return {
    version: 1,
    status: "pending",
    guardedIds: [],
    exemptIds: [],
    surfaceBindingAudit: {
      uncoveredTools: [],
      uncoveredCommands: [],
      uncoveredCoreFunctions: [],
      uncoveredNegativeCoverage: []
    },
    summary: {
      guardedCount: 0,
      exemptCount: 0,
      overview: "No governance coverage proof has been generated yet.",
      reportPath: ARTIFACT_PATHS.metaGovernanceCoverageReport,
      markdownPath: ARTIFACT_PATHS.metaGovernanceCoverageReportMarkdown
    },
    updatedAt: null
  };
}

export function normalizeMetaGovernanceCoverageReport(raw = {}) {
  const base = createMetaGovernanceCoverageReport();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const audit = normalizeObject(raw.surfaceBindingAudit);
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    status: normalizeString(raw.status, base.status),
    guardedIds: normalizeStringArray(raw.guardedIds),
    exemptIds: normalizeStringArray(raw.exemptIds),
    surfaceBindingAudit: {
      ...base.surfaceBindingAudit,
      ...audit,
      uncoveredTools: normalizeStringArray(audit.uncoveredTools),
      uncoveredCommands: normalizeStringArray(audit.uncoveredCommands),
      uncoveredCoreFunctions: normalizeStringArray(audit.uncoveredCoreFunctions),
      uncoveredNegativeCoverage: normalizeStringArray(audit.uncoveredNegativeCoverage)
    },
    summary: {
      ...base.summary,
      ...summary,
      guardedCount: normalizeNumber(summary.guardedCount, base.summary.guardedCount),
      exemptCount: normalizeNumber(summary.exemptCount, base.summary.exemptCount),
      overview: normalizeString(summary.overview, base.summary.overview),
      reportPath: normalizeString(summary.reportPath, base.summary.reportPath),
      markdownPath: normalizeString(summary.markdownPath, base.summary.markdownPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeMetaGovernanceCoverageIndex(raw = {}) {
  const base = createMetaGovernanceCoverageIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    guardedMutations: normalizeObjectArray(raw.guardedMutations),
    exemptMutations: normalizeObjectArray(raw.exemptMutations),
    summary: {
      ...base.summary,
      ...summary,
      guardedCount: normalizeNumber(summary.guardedCount, base.summary.guardedCount),
      exemptCount: normalizeNumber(summary.exemptCount, base.summary.exemptCount),
      overview: normalizeString(summary.overview, base.summary.overview),
      coveragePath: normalizeString(summary.coveragePath, base.summary.coveragePath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function createMetaOperatorFollowThroughIndex() {
  return {
    version: 1,
    proposalOnly: true,
    explicitOnly: true,
    items: [],
    summary: {
      itemCount: 0,
      acknowledgedCount: 0,
      acceptedForExecutionCount: 0,
      executingCount: 0,
      overdueExecutionCount: 0,
      criticalOverdueExecutionCount: 0,
      deferredCount: 0,
      acceptedRiskCount: 0,
      closedCount: 0,
      supersededCount: 0,
      invalidStatusCount: 0,
      staleCount: 0,
      dueDeferredCount: 0,
      topSourceIds: [],
      overview: "No operator follow-through decisions have been recorded yet.",
      followThroughPath: ARTIFACT_PATHS.metaOperatorFollowThrough
    },
    sourceArtifacts: [
      ARTIFACT_PATHS.metaRemediationPacks,
      ARTIFACT_PATHS.metaOperatorPlaybooks,
      ARTIFACT_PATHS.metaExecutionBridgeCandidates,
      ARTIFACT_PATHS.metaOptimizerReport,
      ARTIFACT_PATHS.workspaceIndex
    ],
    updatedAt: null
  };
}

export function createMetaOperatorFollowThroughTransitionsIndex() {
  return {
    version: 1,
    proposalOnly: true,
    explicitOnly: true,
    transitions: [],
    summary: {
      transitionCount: 0,
      overview: "No operator follow-through transitions have been recorded yet.",
      transitionsPath: ARTIFACT_PATHS.metaOperatorFollowThroughTransitions
    },
    updatedAt: null
  };
}

export function normalizeMetaOperatorFollowThroughTransitionsIndex(raw = {}) {
  const base = createMetaOperatorFollowThroughTransitionsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    explicitOnly: normalizeBoolean(raw.explicitOnly, base.explicitOnly),
    transitions: normalizeObjectArray(raw.transitions),
    summary: {
      ...base.summary,
      ...summary,
      transitionCount: normalizeNumber(summary.transitionCount, base.summary.transitionCount),
      overview: normalizeString(summary.overview, base.summary.overview),
      transitionsPath: normalizeString(summary.transitionsPath, base.summary.transitionsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeMetaOperatorFollowThroughIndex(raw = {}) {
  const base = createMetaOperatorFollowThroughIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    explicitOnly: normalizeBoolean(raw.explicitOnly, base.explicitOnly),
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      itemCount: normalizeNumber(summary.itemCount, base.summary.itemCount),
      acknowledgedCount: normalizeNumber(summary.acknowledgedCount, base.summary.acknowledgedCount),
      acceptedForExecutionCount: normalizeNumber(summary.acceptedForExecutionCount, base.summary.acceptedForExecutionCount),
      executingCount: normalizeNumber(summary.executingCount, base.summary.executingCount),
      overdueExecutionCount: normalizeNumber(summary.overdueExecutionCount, base.summary.overdueExecutionCount),
      criticalOverdueExecutionCount: normalizeNumber(summary.criticalOverdueExecutionCount, base.summary.criticalOverdueExecutionCount),
      deferredCount: normalizeNumber(summary.deferredCount, base.summary.deferredCount),
      acceptedRiskCount: normalizeNumber(summary.acceptedRiskCount, base.summary.acceptedRiskCount),
      closedCount: normalizeNumber(summary.closedCount, base.summary.closedCount),
      supersededCount: normalizeNumber(summary.supersededCount, base.summary.supersededCount),
      invalidStatusCount: normalizeNumber(summary.invalidStatusCount, base.summary.invalidStatusCount),
      staleCount: normalizeNumber(summary.staleCount, base.summary.staleCount),
      dueDeferredCount: normalizeNumber(summary.dueDeferredCount, base.summary.dueDeferredCount),
      topSourceIds: normalizeStringArray(summary.topSourceIds),
      overview: normalizeString(summary.overview, base.summary.overview),
      followThroughPath: normalizeString(summary.followThroughPath, base.summary.followThroughPath)
    },
    sourceArtifacts: normalizeStringArray(raw.sourceArtifacts, base.sourceArtifacts),
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeMetaExecutionBridgeCandidatesIndex(raw = {}) {
  const base = createMetaExecutionBridgeCandidatesIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    noAutoApply: normalizeBoolean(raw.noAutoApply, base.noAutoApply),
    candidates: normalizeObjectArray(raw.candidates),
    summary: {
      ...base.summary,
      ...summary,
      candidateCount: normalizeNumber(summary.candidateCount, base.summary.candidateCount),
      topCandidateIds: normalizeStringArray(summary.topCandidateIds),
      candidateTypeCounts: normalizeObject(summary.candidateTypeCounts),
      overview: normalizeString(summary.overview, base.summary.overview),
      candidatesPath: normalizeString(summary.candidatesPath, base.summary.candidatesPath)
    },
    sourceArtifacts: normalizeStringArray(raw.sourceArtifacts, base.sourceArtifacts),
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeMetaOperatorPlaybooksIndex(raw = {}) {
  const base = createMetaOperatorPlaybooksIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }

  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    playbooks: normalizeObjectArray(raw.playbooks),
    summary: {
      ...base.summary,
      ...summary,
      playbookCount: normalizeNumber(summary.playbookCount, base.summary.playbookCount),
      topPlaybookIds: normalizeStringArray(summary.topPlaybookIds),
      topTaxonomyFamilyIds: normalizeStringArray(summary.topTaxonomyFamilyIds),
      actionableCount: normalizeNumber(summary.actionableCount, base.summary.actionableCount),
      partiallyActionableCount: normalizeNumber(summary.partiallyActionableCount, base.summary.partiallyActionableCount),
      advisoryCount: normalizeNumber(summary.advisoryCount, base.summary.advisoryCount),
      readinessOverview: normalizeString(summary.readinessOverview, base.summary.readinessOverview),
      overview: normalizeString(summary.overview, base.summary.overview),
      playbooksPath: normalizeString(summary.playbooksPath, base.summary.playbooksPath)
    },
    sourceArtifacts: normalizeStringArray(raw.sourceArtifacts, base.sourceArtifacts),
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function createMetaRecommendationsIndex() {
  return {
    version: 3,
    proposalOnly: true,
    items: [],
    clusters: [],
    ranking: {
      method: "durable-signal-frontier-v1",
      signals: [
        "priority",
        "recurrenceCount",
        "evidenceDensity",
        "crossSessionRecurrence",
        "repairFrontierOverlap",
        "auditCriticality",
        "bridgeCriticality",
        "queueChurn",
        "taxonomyFamilyPressure",
        "taxonomyGroupPressure"
      ],
      tieBreakOrder: ["score-desc", "priority-rank", "cluster-rank", "cluster-id", "category", "id"]
    },
    frontier: {
      recommendationCount: 0,
      criticalCount: 0,
      clusterCount: 0,
      frontierScore: 0,
      topClusterIds: [],
      topRecommendationIds: [],
      activeSignalTypes: [],
      topTaxonomyFamilyIds: [],
      topTaxonomyGroupIds: [],
      pressureAreas: [],
      taxonomyOverview: "No typed wiki taxonomy pressure is currently active in the optimizer frontier.",
      frontierSummary: "No proposal-only optimizer recommendations have been generated yet.",
      rankingMethod: "durable-signal-frontier-v1"
    },
    summary: {
      recommendationCount: 0,
      criticalCount: 0,
      clusterCount: 0,
      frontierScore: 0,
      categories: {},
      signalTypes: [],
      topClusterIds: [],
      topRecommendationIds: [],
      topTaxonomyFamilyIds: [],
      topTaxonomyGroupIds: [],
      pressureAreas: [],
      taxonomyOverview: "No typed wiki taxonomy pressure is currently active in the optimizer frontier.",
      clusterMembership: {},
      topClusters: []
    },
    updatedAt: null
  };
}

export function normalizeMetaRecommendationsIndex(raw = {}) {
  const base = createMetaRecommendationsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }

  const ranking = normalizeObject(raw.ranking);
  const frontier = normalizeObject(raw.frontier);
  const summary = normalizeObject(raw.summary);

  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    items: normalizeObjectArray(raw.items),
    clusters: normalizeObjectArray(raw.clusters),
    ranking: {
      ...base.ranking,
      ...ranking,
      method: normalizeString(ranking.method, base.ranking.method),
      signals: normalizeStringArray(ranking.signals, base.ranking.signals),
      tieBreakOrder: normalizeStringArray(ranking.tieBreakOrder, base.ranking.tieBreakOrder)
    },
    frontier: {
      ...base.frontier,
      ...frontier,
      recommendationCount: normalizeNumber(frontier.recommendationCount, base.frontier.recommendationCount),
      criticalCount: normalizeNumber(frontier.criticalCount, base.frontier.criticalCount),
      clusterCount: normalizeNumber(frontier.clusterCount, base.frontier.clusterCount),
      frontierScore: normalizeNumber(frontier.frontierScore, base.frontier.frontierScore),
      topClusterIds: normalizeStringArray(frontier.topClusterIds),
      topRecommendationIds: normalizeStringArray(frontier.topRecommendationIds),
      activeSignalTypes: normalizeStringArray(frontier.activeSignalTypes),
      topTaxonomyFamilyIds: normalizeStringArray(frontier.topTaxonomyFamilyIds),
      topTaxonomyGroupIds: normalizeStringArray(frontier.topTaxonomyGroupIds),
      pressureAreas: normalizeStringArray(frontier.pressureAreas),
      taxonomyOverview: normalizeString(frontier.taxonomyOverview, base.frontier.taxonomyOverview),
      frontierSummary: normalizeString(frontier.frontierSummary, base.frontier.frontierSummary),
      rankingMethod: normalizeString(frontier.rankingMethod, base.frontier.rankingMethod)
    },
    summary: {
      ...base.summary,
      ...summary,
      recommendationCount: normalizeNumber(summary.recommendationCount, base.summary.recommendationCount),
      criticalCount: normalizeNumber(summary.criticalCount, base.summary.criticalCount),
      clusterCount: normalizeNumber(summary.clusterCount, base.summary.clusterCount),
      frontierScore: normalizeNumber(summary.frontierScore, base.summary.frontierScore),
      categories: normalizeObject(summary.categories),
      signalTypes: normalizeStringArray(summary.signalTypes),
      topClusterIds: normalizeStringArray(summary.topClusterIds),
      topRecommendationIds: normalizeStringArray(summary.topRecommendationIds),
      topTaxonomyFamilyIds: normalizeStringArray(summary.topTaxonomyFamilyIds),
      topTaxonomyGroupIds: normalizeStringArray(summary.topTaxonomyGroupIds),
      pressureAreas: normalizeStringArray(summary.pressureAreas),
      taxonomyOverview: normalizeString(summary.taxonomyOverview, base.summary.taxonomyOverview),
      clusterMembership: normalizeStringArrayRecord(summary.clusterMembership),
      topClusters: normalizeObjectArray(summary.topClusters)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function createMetaOptimizerState() {
  return {
    version: 5,
    proposalOnly: true,
    sourceArtifacts: [
      ARTIFACT_PATHS.sessionJournal,
      ARTIFACT_PATHS.reviewConcerns,
      ARTIFACT_PATHS.adversarialReviewState,
      ARTIFACT_PATHS.experimentAudits,
      ARTIFACT_PATHS.claimBridgeLog,
      ARTIFACT_PATHS.figureQa,
      ARTIFACT_PATHS.versionComparisons,
      ARTIFACT_PATHS.metaLongHorizonMemory,
      ARTIFACT_PATHS.metaExecutionBridgeCandidates,
      ARTIFACT_PATHS.metaOperatorFollowThrough,
      ARTIFACT_PATHS.metaOperatorFollowThroughTransitions,
      ARTIFACT_PATHS.metaOperatorPlaybooks,
      ARTIFACT_PATHS.metaRemediationPacks,
      ARTIFACT_PATHS.orchestrationBoard,
      ARTIFACT_PATHS.workspaceIndex
    ],
    frontier: {
      recommendationCount: 0,
      criticalCount: 0,
      clusterCount: 0,
      frontierScore: 0,
      activeSignalTypes: [],
      topClusterIds: [],
      topRecommendationIds: [],
      topClusters: [],
      topTaxonomyFamilyIds: [],
      topTaxonomyGroupIds: [],
      pressureAreas: [],
      taxonomyOverview: "No typed wiki taxonomy pressure is currently active in the optimizer frontier.",
      frontierSummary: "No proposal-only optimizer recommendations have been generated yet.",
      rankingMethod: "durable-signal-frontier-v1",
      tieBreakOrder: ["score-desc", "priority-rank", "cluster-rank", "cluster-id", "category", "id"],
      reportPath: ARTIFACT_PATHS.metaOptimizerReport,
      recommendationsPath: ARTIFACT_PATHS.metaRecommendations,
      statePath: ARTIFACT_PATHS.metaOptimizerState,
       longHorizonPath: ARTIFACT_PATHS.metaLongHorizonMemory,
       remediationPacksPath: ARTIFACT_PATHS.metaRemediationPacks
     },
     clusters: [],
      remediationPacks: {
        packCount: 0,
        topPackIds: [],
        topClusterIds: [],
        actionableCount: 0,
        partiallyActionableCount: 0,
        advisoryCount: 0,
        readinessOverview: "No proposal-only remediation packs have been generated yet.",
        overview: "No proposal-only remediation packs have been generated yet.",
        packsPath: ARTIFACT_PATHS.metaRemediationPacks
      },
      followThrough: {
        itemCount: 0,
        acknowledgedCount: 0,
        acceptedForExecutionCount: 0,
        executingCount: 0,
        overdueExecutionCount: 0,
        criticalOverdueExecutionCount: 0,
        deferredCount: 0,
        acceptedRiskCount: 0,
        closedCount: 0,
        supersededCount: 0,
        invalidStatusCount: 0,
        staleCount: 0,
        dueDeferredCount: 0,
        topSourceIds: [],
        overview: "No operator follow-through decisions have been recorded yet.",
        followThroughPath: ARTIFACT_PATHS.metaOperatorFollowThrough
      },
      executionBridgeCandidates: {
        candidateCount: 0,
        topCandidateIds: [],
        overview: "No proposal-only execution bridge candidates have been generated yet.",
        candidatesPath: ARTIFACT_PATHS.metaExecutionBridgeCandidates
      },
      governanceCoverage: {
        guardedCount: 0,
        exemptCount: 0,
        overview: "No governance coverage matrix has been summarized yet.",
        coveragePath: ARTIFACT_PATHS.metaGovernanceCoverage
      },
      operatorPlaybooks: {
        playbookCount: 0,
        topPlaybookIds: [],
        topTaxonomyFamilyIds: [],
        actionableCount: 0,
        partiallyActionableCount: 0,
        advisoryCount: 0,
        readinessOverview: "No proposal-only family-level operator playbooks have been generated yet.",
        overview: "No proposal-only family-level operator playbooks have been generated yet.",
        playbooksPath: ARTIFACT_PATHS.metaOperatorPlaybooks
      },
      longHorizon: {
      familyCount: 0,
      recurringFamilyCount: 0,
      risingFamilyCount: 0,
      stableFamilyCount: 0,
      coolingFamilyCount: 0,
      snapshotCount: 0,
      lastObservedAt: null,
      lastAction: "unchanged",
      topFamilyIds: [],
      topTaxonomyFamilyIds: [],
      topTaxonomyGroupIds: [],
      pressureAreas: [],
      overview: "No long-horizon workflow memory has been summarized yet.",
      memoryPath: ARTIFACT_PATHS.metaLongHorizonMemory
    },
    lastRefreshedAt: null,
    updatedAt: null
  };
}

export function normalizeMetaOptimizerState(raw = {}) {
  const base = createMetaOptimizerState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }

  const frontier = normalizeObject(raw.frontier);
  const longHorizon = normalizeObject(raw.longHorizon);

  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    sourceArtifacts: normalizeStringArray(raw.sourceArtifacts, base.sourceArtifacts),
    frontier: {
      ...base.frontier,
      ...frontier,
      recommendationCount: normalizeNumber(frontier.recommendationCount, base.frontier.recommendationCount),
      criticalCount: normalizeNumber(frontier.criticalCount, base.frontier.criticalCount),
      clusterCount: normalizeNumber(frontier.clusterCount, base.frontier.clusterCount),
      frontierScore: normalizeNumber(frontier.frontierScore, base.frontier.frontierScore),
      activeSignalTypes: normalizeStringArray(frontier.activeSignalTypes),
      topClusterIds: normalizeStringArray(frontier.topClusterIds),
      topRecommendationIds: normalizeStringArray(frontier.topRecommendationIds),
      topClusters: normalizeObjectArray(frontier.topClusters),
      topTaxonomyFamilyIds: normalizeStringArray(frontier.topTaxonomyFamilyIds),
      topTaxonomyGroupIds: normalizeStringArray(frontier.topTaxonomyGroupIds),
      pressureAreas: normalizeStringArray(frontier.pressureAreas),
      taxonomyOverview: normalizeString(frontier.taxonomyOverview, base.frontier.taxonomyOverview),
      frontierSummary: normalizeString(frontier.frontierSummary, base.frontier.frontierSummary),
      rankingMethod: normalizeString(frontier.rankingMethod, base.frontier.rankingMethod),
      tieBreakOrder: normalizeStringArray(frontier.tieBreakOrder, base.frontier.tieBreakOrder),
      reportPath: normalizeString(frontier.reportPath, base.frontier.reportPath),
       recommendationsPath: normalizeString(frontier.recommendationsPath, base.frontier.recommendationsPath),
       statePath: normalizeString(frontier.statePath, base.frontier.statePath),
       longHorizonPath: normalizeString(frontier.longHorizonPath, base.frontier.longHorizonPath),
       remediationPacksPath: normalizeString(frontier.remediationPacksPath, base.frontier.remediationPacksPath)
      },
      clusters: normalizeObjectArray(raw.clusters),
      operatorPlaybooks: {
        ...base.operatorPlaybooks,
        ...normalizeObject(raw.operatorPlaybooks),
        playbookCount: normalizeNumber(raw.operatorPlaybooks?.playbookCount, base.operatorPlaybooks.playbookCount),
        topPlaybookIds: normalizeStringArray(raw.operatorPlaybooks?.topPlaybookIds),
        topTaxonomyFamilyIds: normalizeStringArray(raw.operatorPlaybooks?.topTaxonomyFamilyIds),
        actionableCount: normalizeNumber(raw.operatorPlaybooks?.actionableCount, base.operatorPlaybooks.actionableCount),
        partiallyActionableCount: normalizeNumber(raw.operatorPlaybooks?.partiallyActionableCount, base.operatorPlaybooks.partiallyActionableCount),
        advisoryCount: normalizeNumber(raw.operatorPlaybooks?.advisoryCount, base.operatorPlaybooks.advisoryCount),
        readinessOverview: normalizeString(raw.operatorPlaybooks?.readinessOverview, base.operatorPlaybooks.readinessOverview),
        overview: normalizeString(raw.operatorPlaybooks?.overview, base.operatorPlaybooks.overview),
        playbooksPath: normalizeString(raw.operatorPlaybooks?.playbooksPath, base.operatorPlaybooks.playbooksPath)
      },
      executionBridgeCandidates: {
        ...base.executionBridgeCandidates,
        ...normalizeObject(raw.executionBridgeCandidates),
        candidateCount: normalizeNumber(raw.executionBridgeCandidates?.candidateCount, base.executionBridgeCandidates.candidateCount),
        topCandidateIds: normalizeStringArray(raw.executionBridgeCandidates?.topCandidateIds),
        overview: normalizeString(raw.executionBridgeCandidates?.overview, base.executionBridgeCandidates.overview),
        candidatesPath: normalizeString(raw.executionBridgeCandidates?.candidatesPath, base.executionBridgeCandidates.candidatesPath)
      },
      governanceCoverage: {
        ...base.governanceCoverage,
        ...normalizeObject(raw.governanceCoverage),
        guardedCount: normalizeNumber(raw.governanceCoverage?.guardedCount, base.governanceCoverage.guardedCount),
        exemptCount: normalizeNumber(raw.governanceCoverage?.exemptCount, base.governanceCoverage.exemptCount),
        overview: normalizeString(raw.governanceCoverage?.overview, base.governanceCoverage.overview),
        coveragePath: normalizeString(raw.governanceCoverage?.coveragePath, base.governanceCoverage.coveragePath)
      },
      remediationPacks: {
       ...base.remediationPacks,
       ...normalizeObject(raw.remediationPacks),
        packCount: normalizeNumber(raw.remediationPacks?.packCount, base.remediationPacks.packCount),
        topPackIds: normalizeStringArray(raw.remediationPacks?.topPackIds),
        topClusterIds: normalizeStringArray(raw.remediationPacks?.topClusterIds),
        actionableCount: normalizeNumber(raw.remediationPacks?.actionableCount, base.remediationPacks.actionableCount),
        partiallyActionableCount: normalizeNumber(raw.remediationPacks?.partiallyActionableCount, base.remediationPacks.partiallyActionableCount),
        advisoryCount: normalizeNumber(raw.remediationPacks?.advisoryCount, base.remediationPacks.advisoryCount),
        readinessOverview: normalizeString(raw.remediationPacks?.readinessOverview, base.remediationPacks.readinessOverview),
        overview: normalizeString(raw.remediationPacks?.overview, base.remediationPacks.overview),
        packsPath: normalizeString(raw.remediationPacks?.packsPath, base.remediationPacks.packsPath)
      },
      followThrough: {
        ...base.followThrough,
        ...normalizeObject(raw.followThrough),
        itemCount: normalizeNumber(raw.followThrough?.itemCount, base.followThrough.itemCount),
        acknowledgedCount: normalizeNumber(raw.followThrough?.acknowledgedCount, base.followThrough.acknowledgedCount),
        acceptedForExecutionCount: normalizeNumber(raw.followThrough?.acceptedForExecutionCount, base.followThrough.acceptedForExecutionCount),
        executingCount: normalizeNumber(raw.followThrough?.executingCount, base.followThrough.executingCount),
        overdueExecutionCount: normalizeNumber(raw.followThrough?.overdueExecutionCount, base.followThrough.overdueExecutionCount),
        criticalOverdueExecutionCount: normalizeNumber(raw.followThrough?.criticalOverdueExecutionCount, base.followThrough.criticalOverdueExecutionCount),
        deferredCount: normalizeNumber(raw.followThrough?.deferredCount, base.followThrough.deferredCount),
        acceptedRiskCount: normalizeNumber(raw.followThrough?.acceptedRiskCount, base.followThrough.acceptedRiskCount),
        closedCount: normalizeNumber(raw.followThrough?.closedCount, base.followThrough.closedCount),
        supersededCount: normalizeNumber(raw.followThrough?.supersededCount, base.followThrough.supersededCount),
        invalidStatusCount: normalizeNumber(raw.followThrough?.invalidStatusCount, base.followThrough.invalidStatusCount),
        staleCount: normalizeNumber(raw.followThrough?.staleCount, base.followThrough.staleCount),
        dueDeferredCount: normalizeNumber(raw.followThrough?.dueDeferredCount, base.followThrough.dueDeferredCount),
        topSourceIds: normalizeStringArray(raw.followThrough?.topSourceIds),
        overview: normalizeString(raw.followThrough?.overview, base.followThrough.overview),
        followThroughPath: normalizeString(raw.followThrough?.followThroughPath, base.followThrough.followThroughPath)
      },
      longHorizon: {
      ...base.longHorizon,
      ...longHorizon,
      familyCount: normalizeNumber(longHorizon.familyCount, base.longHorizon.familyCount),
      recurringFamilyCount: normalizeNumber(longHorizon.recurringFamilyCount, base.longHorizon.recurringFamilyCount),
      risingFamilyCount: normalizeNumber(longHorizon.risingFamilyCount, base.longHorizon.risingFamilyCount),
      stableFamilyCount: normalizeNumber(longHorizon.stableFamilyCount, base.longHorizon.stableFamilyCount),
      coolingFamilyCount: normalizeNumber(longHorizon.coolingFamilyCount, base.longHorizon.coolingFamilyCount),
      snapshotCount: normalizeNumber(longHorizon.snapshotCount, base.longHorizon.snapshotCount),
      lastObservedAt: longHorizon.lastObservedAt ?? base.longHorizon.lastObservedAt,
      lastAction: normalizeString(longHorizon.lastAction, base.longHorizon.lastAction),
      topFamilyIds: normalizeStringArray(longHorizon.topFamilyIds),
      topTaxonomyFamilyIds: normalizeStringArray(longHorizon.topTaxonomyFamilyIds),
      topTaxonomyGroupIds: normalizeStringArray(longHorizon.topTaxonomyGroupIds),
      pressureAreas: normalizeStringArray(longHorizon.pressureAreas),
      overview: normalizeString(longHorizon.overview, base.longHorizon.overview),
      memoryPath: normalizeString(longHorizon.memoryPath, base.longHorizon.memoryPath)
    },
    lastRefreshedAt: raw.lastRefreshedAt ?? base.lastRefreshedAt,
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}

export function normalizeWorkspaceAutonomyLoops(raw = {}, fallback = null) {
  const base = fallback ?? createWorkspaceIndex().autonomyLoops;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  return {
    ...base,
    ...raw,
    contractVersion: normalizeString(raw.contractVersion, base.contractVersion),
    activeLifecycleState: normalizeString(raw.activeLifecycleState, base.activeLifecycleState),
    loopCount: normalizeNumber(raw.loopCount, base.loopCount),
    blockedCount: normalizeNumber(raw.blockedCount, base.blockedCount),
    readyCount: normalizeNumber(raw.readyCount, base.readyCount),
    closedCount: normalizeNumber(raw.closedCount, base.closedCount),
    currentLoopId: normalizeString(raw.currentLoopId, base.currentLoopId),
    nextSafeAction: normalizeString(raw.nextSafeAction, base.nextSafeAction),
    explicitOnly: normalizeBoolean(raw.explicitOnly, base.explicitOnly),
    noHiddenRuntime: normalizeBoolean(raw.noHiddenRuntime, base.noHiddenRuntime),
    families: normalizeStringArray(raw.families),
    loops: normalizeObjectArray(raw.loops),
    approvalPointers: normalizeStringArray(raw.approvalPointers),
    runtimePointers: normalizeStringArray(raw.runtimePointers),
    followThroughPointers: normalizeStringArray(raw.followThroughPointers),
    blockerIds: normalizeStringArray(raw.blockerIds),
    closureStates: normalizeStringArray(raw.closureStates),
    lifecycleStates: normalizeStringArray(raw.lifecycleStates),
    safeExecutionPath: normalizeString(raw.safeExecutionPath, base.safeExecutionPath),
    overview: normalizeString(raw.overview, base.overview)
  };
}

export function normalizeWorkspaceMetaOptimize(raw = {}, fallback = null) {
  const base = fallback ?? createWorkspaceIndex().metaOptimize;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }

  const longHorizon = normalizeObject(raw.longHorizon);
  const remediationPacks = normalizeObject(raw.remediationPacks);
  const operatorPlaybooks = normalizeObject(raw.operatorPlaybooks);
  const executionBridgeCandidates = normalizeObject(raw.executionBridgeCandidates);
  const governanceCoverage = normalizeObject(raw.governanceCoverage);
  const followThrough = normalizeObject(raw.followThrough);
  const autonomyLoops = normalizeObject(raw.autonomyLoops);
  const baseGovernanceCoverage = normalizeObject(base.governanceCoverage, {
    guardedCount: 0,
    exemptCount: 0,
    overview: "No governance coverage matrix has been summarized yet.",
    coveragePath: ARTIFACT_PATHS.metaGovernanceCoverage
  });

  return {
    ...base,
    ...raw,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    recommendationCount: normalizeNumber(raw.recommendationCount, base.recommendationCount),
    criticalCount: normalizeNumber(raw.criticalCount, base.criticalCount),
    clusterCount: normalizeNumber(raw.clusterCount, base.clusterCount),
    frontierScore: normalizeNumber(raw.frontierScore, base.frontierScore),
    activeSignalTypes: normalizeStringArray(raw.activeSignalTypes),
    topClusterIds: normalizeStringArray(raw.topClusterIds),
    topRecommendationIds: normalizeStringArray(raw.topRecommendationIds),
    topClusters: normalizeObjectArray(raw.topClusters),
    topTaxonomyFamilyIds: normalizeStringArray(raw.topTaxonomyFamilyIds),
    topTaxonomyGroupIds: normalizeStringArray(raw.topTaxonomyGroupIds),
    pressureAreas: normalizeStringArray(raw.pressureAreas),
    taxonomyOverview: normalizeString(raw.taxonomyOverview, base.taxonomyOverview),
    frontierSummary: normalizeString(raw.frontierSummary, base.frontierSummary),
    rankingMethod: normalizeString(raw.rankingMethod, base.rankingMethod),
    tieBreakOrder: normalizeStringArray(raw.tieBreakOrder, base.tieBreakOrder),
    reportPath: normalizeString(raw.reportPath, base.reportPath),
     recommendationsPath: normalizeString(raw.recommendationsPath, base.recommendationsPath),
     statePath: normalizeString(raw.statePath, base.statePath),
     longHorizonPath: normalizeString(raw.longHorizonPath, base.longHorizonPath),
      remediationPacks: {
        ...base.remediationPacks,
        ...remediationPacks,
        packCount: normalizeNumber(remediationPacks.packCount, base.remediationPacks.packCount),
        topPackIds: normalizeStringArray(remediationPacks.topPackIds),
        topClusterIds: normalizeStringArray(remediationPacks.topClusterIds),
        actionableCount: normalizeNumber(remediationPacks.actionableCount, base.remediationPacks.actionableCount),
        partiallyActionableCount: normalizeNumber(remediationPacks.partiallyActionableCount, base.remediationPacks.partiallyActionableCount),
        advisoryCount: normalizeNumber(remediationPacks.advisoryCount, base.remediationPacks.advisoryCount),
        readinessOverview: normalizeString(remediationPacks.readinessOverview, base.remediationPacks.readinessOverview),
        overview: normalizeString(remediationPacks.overview, base.remediationPacks.overview),
        packsPath: normalizeString(remediationPacks.packsPath, base.remediationPacks.packsPath)
      },
      executionBridgeCandidates: {
        ...base.executionBridgeCandidates,
        ...executionBridgeCandidates,
        candidateCount: normalizeNumber(executionBridgeCandidates.candidateCount, base.executionBridgeCandidates.candidateCount),
        topCandidateIds: normalizeStringArray(executionBridgeCandidates.topCandidateIds),
        overview: normalizeString(executionBridgeCandidates.overview, base.executionBridgeCandidates.overview),
        candidatesPath: normalizeString(executionBridgeCandidates.candidatesPath, base.executionBridgeCandidates.candidatesPath)
      },
      governanceCoverage: {
        ...baseGovernanceCoverage,
        ...governanceCoverage,
        guardedCount: normalizeNumber(governanceCoverage.guardedCount, baseGovernanceCoverage.guardedCount),
        exemptCount: normalizeNumber(governanceCoverage.exemptCount, baseGovernanceCoverage.exemptCount),
        overview: normalizeString(governanceCoverage.overview, baseGovernanceCoverage.overview),
        coveragePath: normalizeString(governanceCoverage.coveragePath, baseGovernanceCoverage.coveragePath)
      },
      followThrough: {
        ...base.followThrough,
        ...followThrough,
        itemCount: normalizeNumber(followThrough.itemCount, base.followThrough.itemCount),
        acknowledgedCount: normalizeNumber(followThrough.acknowledgedCount, base.followThrough.acknowledgedCount),
        acceptedForExecutionCount: normalizeNumber(followThrough.acceptedForExecutionCount, base.followThrough.acceptedForExecutionCount),
        deferredCount: normalizeNumber(followThrough.deferredCount, base.followThrough.deferredCount),
        acceptedRiskCount: normalizeNumber(followThrough.acceptedRiskCount, base.followThrough.acceptedRiskCount),
        closedCount: normalizeNumber(followThrough.closedCount, base.followThrough.closedCount),
        supersededCount: normalizeNumber(followThrough.supersededCount, base.followThrough.supersededCount),
        staleCount: normalizeNumber(followThrough.staleCount, base.followThrough.staleCount),
        dueDeferredCount: normalizeNumber(followThrough.dueDeferredCount, base.followThrough.dueDeferredCount),
        topSourceIds: normalizeStringArray(followThrough.topSourceIds),
        overview: normalizeString(followThrough.overview, base.followThrough.overview),
        followThroughPath: normalizeString(followThrough.followThroughPath, base.followThrough.followThroughPath)
      },
      operatorPlaybooks: {
        ...base.operatorPlaybooks,
        ...operatorPlaybooks,
        playbookCount: normalizeNumber(operatorPlaybooks.playbookCount, base.operatorPlaybooks.playbookCount),
        topPlaybookIds: normalizeStringArray(operatorPlaybooks.topPlaybookIds),
        topTaxonomyFamilyIds: normalizeStringArray(operatorPlaybooks.topTaxonomyFamilyIds),
        actionableCount: normalizeNumber(operatorPlaybooks.actionableCount, base.operatorPlaybooks.actionableCount),
        partiallyActionableCount: normalizeNumber(operatorPlaybooks.partiallyActionableCount, base.operatorPlaybooks.partiallyActionableCount),
        advisoryCount: normalizeNumber(operatorPlaybooks.advisoryCount, base.operatorPlaybooks.advisoryCount),
        readinessOverview: normalizeString(operatorPlaybooks.readinessOverview, base.operatorPlaybooks.readinessOverview),
        overview: normalizeString(operatorPlaybooks.overview, base.operatorPlaybooks.overview),
        playbooksPath: normalizeString(operatorPlaybooks.playbooksPath, base.operatorPlaybooks.playbooksPath)
      },
      autonomyLoops: normalizeWorkspaceAutonomyLoops(autonomyLoops, base.autonomyLoops),
      longHorizon: {
      ...base.longHorizon,
      ...longHorizon,
      familyCount: normalizeNumber(longHorizon.familyCount, base.longHorizon.familyCount),
      recurringFamilyCount: normalizeNumber(longHorizon.recurringFamilyCount, base.longHorizon.recurringFamilyCount),
      risingFamilyCount: normalizeNumber(longHorizon.risingFamilyCount, base.longHorizon.risingFamilyCount),
      stableFamilyCount: normalizeNumber(longHorizon.stableFamilyCount, base.longHorizon.stableFamilyCount),
      coolingFamilyCount: normalizeNumber(longHorizon.coolingFamilyCount, base.longHorizon.coolingFamilyCount),
      snapshotCount: normalizeNumber(longHorizon.snapshotCount, base.longHorizon.snapshotCount),
      lastObservedAt: longHorizon.lastObservedAt ?? base.longHorizon.lastObservedAt,
      lastAction: normalizeString(longHorizon.lastAction, base.longHorizon.lastAction),
      topFamilyIds: normalizeStringArray(longHorizon.topFamilyIds),
      topTaxonomyFamilyIds: normalizeStringArray(longHorizon.topTaxonomyFamilyIds),
      topTaxonomyGroupIds: normalizeStringArray(longHorizon.topTaxonomyGroupIds),
      pressureAreas: normalizeStringArray(longHorizon.pressureAreas),
      overview: normalizeString(longHorizon.overview, base.longHorizon.overview),
      memoryPath: normalizeString(longHorizon.memoryPath, base.longHorizon.memoryPath)
    }
  };
}

export function createRebuttalIssuesIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createVersionsIndex() {
  return {
    version: 1,
    currentVersionId: null,
    items: [],
    lineage: [],
    updatedAt: null
  };
}

export function createVersionComparisonsIndex() {
  return { version: 1, items: [], activeTargets: [], updatedAt: null };
}

export function createWikiEntitiesIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createWikiRelationsIndex() {
  return {
    version: 3,
    items: [],
    summary: {
      totalRelations: 0,
      healthyCount: 0,
      degradedCount: 0,
      relationTypeCounts: {},
      integrityReasonCounts: {},
      repairFrontier: [],
      taxonomyRepairFrontier: [],
      taxonomy: {
        familyCount: 0,
        groupCount: 0,
        degradedFamilyCount: 0,
        degradedGroupCount: 0,
        familyCounts: {},
        groupCounts: {},
        topDegradedFamilyIds: [],
        topDegradedGroupIds: [],
        families: [],
        groups: [],
        overview: "No typed wiki relation taxonomy has been summarized yet."
      }
    },
    updatedAt: null
  };
}

export function createWorkspaceIndex() {
  return {
    version: 8,
    managed: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workspaceIndex),
    boardPhase: "init",
    boardAssignedRole: "planner",
    boardIntentType: "plan",
    currentFocus: "Align the durable workflow state.",
    nextAction: "Refresh the board and choose the next role-owned step.",
    continuationState: createContinuationState(),
    activePackets: [],
    workQueues: {
      ready: [],
      waiting: [],
      reviewNeeded: [],
      handoff: [],
      stale: [],
      archived: []
    },
    ownershipSummary: [],
    packetLifecycleCounts: {},
    handoffObligations: [],
    resumeGuidance: {
      command: "project:paper.orchestrate",
      summary: "Refresh the board and choose the next role-owned step.",
      prioritizedPacketIds: [],
      packetContextPaths: [],
      handoffCandidateIds: []
    },
    contextSurfaces: {
      currentRoleContextPath: `${ARTIFACT_PATHS.roleContextsDir}/planner.json`,
      currentPhaseContextPath: `${ARTIFACT_PATHS.phaseContextsDir}/init.json`,
      currentActionContextPath: `${ARTIFACT_PATHS.actionContextsDir}/current.json`,
      prioritizedArtifactContextPaths: [],
      prioritizedPacketActionContextPaths: []
    },
    behaviorDiscipline: {
      summary: "Read the closest role, phase, packet, and artifact context before mutating durable workflow state.",
      explicitOnly: true,
      noHiddenRuntime: true,
      requiredReadOrder: []
    },
    dependencyHealth: {
      blockedPacketIds: [],
      healthyPacketIds: [],
      waitingPacketIds: [],
      stalePacketIds: [],
      missingDependencyIds: [],
      orphanPacketIds: []
    },
    repairFrontier: {
      count: 0,
      relationIssueCount: 0,
      relationFamilyIssueCount: 0,
      managedArtifactIssueCount: 0,
      governanceIssueCount: 0,
      topDegradedFamilyIds: [],
      topDegradedGroupIds: [],
      taxonomyOverview: "No degraded typed wiki relation families are currently summarized.",
      relationFamilySummaries: [],
      relationGroupSummaries: [],
      prioritizedItems: []
    },
    metaOptimize: {
      proposalOnly: true,
      recommendationCount: 0,
      criticalCount: 0,
      clusterCount: 0,
      frontierScore: 0,
      activeSignalTypes: [],
      topClusterIds: [],
      topRecommendationIds: [],
      topClusters: [],
      topTaxonomyFamilyIds: [],
      topTaxonomyGroupIds: [],
      pressureAreas: [],
      taxonomyOverview: "No typed wiki taxonomy pressure is currently active in the optimizer frontier.",
      frontierSummary: "No proposal-only optimizer recommendations have been generated yet.",
      rankingMethod: "durable-signal-frontier-v1",
      tieBreakOrder: ["score-desc", "priority-rank", "cluster-rank", "cluster-id", "category", "id"],
       reportPath: ARTIFACT_PATHS.metaOptimizerReport,
       recommendationsPath: ARTIFACT_PATHS.metaRecommendations,
       statePath: ARTIFACT_PATHS.metaOptimizerState,
       longHorizonPath: ARTIFACT_PATHS.metaLongHorizonMemory,
      remediationPacks: {
        packCount: 0,
        topPackIds: [],
        topClusterIds: [],
        actionableCount: 0,
        partiallyActionableCount: 0,
        advisoryCount: 0,
        readinessOverview: "No proposal-only remediation packs have been generated yet.",
        overview: "No proposal-only remediation packs have been generated yet.",
        packsPath: ARTIFACT_PATHS.metaRemediationPacks
      },
      governanceCoverage: {
        guardedCount: 0,
        exemptCount: 0,
        overview: "No governance coverage matrix has been summarized yet.",
        coveragePath: ARTIFACT_PATHS.metaGovernanceCoverage
      },
      followThrough: {
        itemCount: 0,
        acknowledgedCount: 0,
        acceptedForExecutionCount: 0,
        deferredCount: 0,
        acceptedRiskCount: 0,
        closedCount: 0,
        supersededCount: 0,
        staleCount: 0,
        dueDeferredCount: 0,
        topSourceIds: [],
        overview: "No operator follow-through decisions have been recorded yet.",
        followThroughPath: ARTIFACT_PATHS.metaOperatorFollowThrough
      },
      executionBridgeCandidates: {
          candidateCount: 0,
          topCandidateIds: [],
          overview: "No proposal-only execution bridge candidates have been generated yet.",
          candidatesPath: ARTIFACT_PATHS.metaExecutionBridgeCandidates
        },
        operatorPlaybooks: {
          playbookCount: 0,
          topPlaybookIds: [],
          topTaxonomyFamilyIds: [],
          actionableCount: 0,
          partiallyActionableCount: 0,
          advisoryCount: 0,
          readinessOverview: "No proposal-only family-level operator playbooks have been generated yet.",
          overview: "No proposal-only family-level operator playbooks have been generated yet.",
          playbooksPath: ARTIFACT_PATHS.metaOperatorPlaybooks
        },
         longHorizon: {
         familyCount: 0,
         recurringFamilyCount: 0,
         risingFamilyCount: 0,
         stableFamilyCount: 0,
         coolingFamilyCount: 0,
         snapshotCount: 0,
          lastObservedAt: null,
          lastAction: "unchanged",
          topFamilyIds: [],
          topTaxonomyFamilyIds: [],
          topTaxonomyGroupIds: [],
          pressureAreas: [],
          overview: "No long-horizon workflow memory has been summarized yet.",
          memoryPath: ARTIFACT_PATHS.metaLongHorizonMemory
        }
    },
    runtime: {
      explicitInvocationOnly: true,
      noDaemon: true,
      selectionPolicy: "planner-materialized-guidance-v2",
      boundedStepPolicy: "planner-control-plane-worker-step-v1",
      controllerStatePath: ARTIFACT_PATHS.runtimeControllerState,
      leasesPath: ARTIFACT_PATHS.runtimeLeases,
      eventsPath: ARTIFACT_PATHS.runtimeEvents,
      resultsPath: ARTIFACT_PATHS.runtimeResults,
      lastRunId: null,
      lastStatus: "never-run",
      lastOutcome: "not-started",
      lastSelectedPacketId: null,
      lastEnvelopeWorkerRole: null,
      lastProgramId: null,
      lastProgramRunId: null,
      lastApprovalId: null,
      lastProgramOutcome: "not-started",
      requestCount: 0,
      acceptedRequestCount: 0,
      executingRequestCount: 0,
      staleRequestCount: 0,
      overdueExecutionCount: 0,
      dueReviewCount: 0,
      checkpointCount: 0,
      escalationCount: 0,
      lastCheckpointPacketId: null,
      lastCheckpointSummary: null,
      lastCheckpointAt: null,
      lastEscalationPacketId: null,
      lastEscalationFollowThroughId: null,
      lastEscalationAt: null,
      continuationCount: 0,
      currentContinuationKind: null,
      currentContinuationPacketId: null,
      currentContinuationProgramRunId: null,
      currentContinuationCommand: null,
      activeLeaseCount: 0,
      activeLeasePacketIds: [],
      eventCount: 0,
      resultCount: 0,
      lastEventType: null,
      overview: "No autonomous control-plane run has been executed yet."
    },
    programs: {
      programCount: 0,
      activeCount: 0,
      blockedCount: 0,
      approvedRunCount: 0,
      reviewNeededRunCount: 0,
      reviewCheckpointRunCount: 0,
      consumedApprovalCount: 0,
      topProgramIds: [],
      topRunIds: [],
      topApprovalIds: [],
      currentProgramId: null,
      currentProgramRunId: null,
      currentApprovalId: null,
      currentReviewCheckpointRunId: null,
      currentReviewCheckpointPacketId: null,
      currentReviewCheckpointSummary: null,
      lastProgramOutcome: "not-started",
      overview: "No program-level research operating surfaces are active yet.",
      programsPath: ARTIFACT_PATHS.programsIndex,
      runsPath: ARTIFACT_PATHS.programRuns,
      approvalsPath: ARTIFACT_PATHS.programApprovals
    },
    campaigns: {
      campaignCount: 0,
      plannedCount: 0,
      activeCount: 0,
      reviewNeededCount: 0,
      completedCount: 0,
      blockedCount: 0,
      topCampaignIds: [],
      currentCampaignId: null,
      currentCampaignStatus: null,
      currentCampaignStepCount: 0,
      currentCampaignCompletedStepCount: 0,
      currentCampaignReviewNeededStepCount: 0,
      currentCampaignNextStepId: null,
      currentCampaignNextAction: null,
      overview: "No multi-cycle research campaigns have been recorded yet.",
      campaignsPath: ARTIFACT_PATHS.campaignsIndex
    },
    autonomyLoops: {
      contractVersion: "unified-autonomy-loop-v1",
      activeLifecycleState: "board-ready",
      loopCount: 4,
      blockedCount: 0,
      readyCount: 0,
      closedCount: 0,
      currentLoopId: "board-role-artifact-handoff",
      nextSafeAction: "Refresh the board and choose the next explicit operator action.",
      explicitOnly: true,
      noHiddenRuntime: true,
      families: [],
      loops: [],
      approvalPointers: [],
      runtimePointers: [ARTIFACT_PATHS.runtimeControllerState],
      followThroughPointers: [ARTIFACT_PATHS.metaOperatorFollowThrough],
      blockerIds: [],
      closureStates: [],
      lifecycleStates: [],
      safeExecutionPath: "project:paper.follow-through -> project:paper.materialize -> node ./bin/paper-factory.mjs autonomy-foreground . --max-steps 5",
      overview: "Unified autonomy loop skeleton is explicit, file-first, and foreground-only."
    },
    activeRoles: [],
    unresolvedConcernIds: [],
    mostRecentSessions: [],
    latestVersions: {
      currentVersionId: null,
      activeTargets: []
    },
    updatedAt: null
  };
}

export function normalizeWorkspaceRuntime(raw = {}, fallback = null) {
  const base = fallback ?? createWorkspaceIndex().runtime;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  return {
    ...base,
    ...raw,
    explicitInvocationOnly: normalizeBoolean(raw.explicitInvocationOnly, base.explicitInvocationOnly),
    noDaemon: normalizeBoolean(raw.noDaemon, base.noDaemon),
    selectionPolicy: normalizeString(raw.selectionPolicy, base.selectionPolicy),
    boundedStepPolicy: normalizeString(raw.boundedStepPolicy, base.boundedStepPolicy),
    controllerStatePath: normalizeString(raw.controllerStatePath, base.controllerStatePath),
    leasesPath: normalizeString(raw.leasesPath, base.leasesPath),
    eventsPath: normalizeString(raw.eventsPath, base.eventsPath),
    resultsPath: normalizeString(raw.resultsPath, base.resultsPath),
    lastRunId: normalizeString(raw.lastRunId, base.lastRunId),
    lastStatus: normalizeString(raw.lastStatus, base.lastStatus),
    lastOutcome: normalizeString(raw.lastOutcome, base.lastOutcome),
    lastSelectedPacketId: normalizeString(raw.lastSelectedPacketId, base.lastSelectedPacketId),
    lastEnvelopeWorkerRole: normalizeString(raw.lastEnvelopeWorkerRole, base.lastEnvelopeWorkerRole),
    lastProgramId: normalizeString(raw.lastProgramId, base.lastProgramId),
    lastProgramRunId: normalizeString(raw.lastProgramRunId, base.lastProgramRunId),
    lastApprovalId: normalizeString(raw.lastApprovalId, base.lastApprovalId),
    lastProgramOutcome: normalizeString(raw.lastProgramOutcome, base.lastProgramOutcome),
    requestCount: normalizeNumber(raw.requestCount, base.requestCount),
    acceptedRequestCount: normalizeNumber(raw.acceptedRequestCount, base.acceptedRequestCount),
    executingRequestCount: normalizeNumber(raw.executingRequestCount, base.executingRequestCount),
    staleRequestCount: normalizeNumber(raw.staleRequestCount, base.staleRequestCount),
    overdueExecutionCount: normalizeNumber(raw.overdueExecutionCount, base.overdueExecutionCount),
    dueReviewCount: normalizeNumber(raw.dueReviewCount, base.dueReviewCount),
    checkpointCount: normalizeNumber(raw.checkpointCount, base.checkpointCount),
    escalationCount: normalizeNumber(raw.escalationCount, base.escalationCount),
    continuationCount: normalizeNumber(raw.continuationCount, base.continuationCount),
    lastCheckpointPacketId: normalizeString(raw.lastCheckpointPacketId, base.lastCheckpointPacketId),
    lastCheckpointSummary: normalizeString(raw.lastCheckpointSummary, base.lastCheckpointSummary),
    lastCheckpointAt: raw.lastCheckpointAt ?? base.lastCheckpointAt,
    lastEscalationPacketId: normalizeString(raw.lastEscalationPacketId, base.lastEscalationPacketId),
    lastEscalationFollowThroughId: normalizeString(raw.lastEscalationFollowThroughId, base.lastEscalationFollowThroughId),
    lastEscalationAt: raw.lastEscalationAt ?? base.lastEscalationAt,
    currentContinuationKind: normalizeString(raw.currentContinuationKind, base.currentContinuationKind),
    currentContinuationPacketId: normalizeString(raw.currentContinuationPacketId, base.currentContinuationPacketId),
    currentContinuationProgramRunId: normalizeString(raw.currentContinuationProgramRunId, base.currentContinuationProgramRunId),
    currentContinuationCommand: normalizeString(raw.currentContinuationCommand, base.currentContinuationCommand),
    activeLeaseCount: normalizeNumber(raw.activeLeaseCount, base.activeLeaseCount),
    activeLeasePacketIds: normalizeStringArray(raw.activeLeasePacketIds),
    eventCount: normalizeNumber(raw.eventCount, base.eventCount),
    resultCount: normalizeNumber(raw.resultCount, base.resultCount),
    lastEventType: normalizeString(raw.lastEventType, base.lastEventType),
    overview: normalizeString(raw.overview, base.overview)
  };
}

export function normalizeWorkspacePrograms(raw = {}, fallback = null) {
  const base = fallback ?? createWorkspaceIndex().programs;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  return {
    ...base,
    ...raw,
    programCount: normalizeNumber(raw.programCount, base.programCount),
    activeCount: normalizeNumber(raw.activeCount, base.activeCount),
    blockedCount: normalizeNumber(raw.blockedCount, base.blockedCount),
    approvedRunCount: normalizeNumber(raw.approvedRunCount, base.approvedRunCount),
    reviewNeededRunCount: normalizeNumber(raw.reviewNeededRunCount, base.reviewNeededRunCount),
    reviewCheckpointRunCount: normalizeNumber(raw.reviewCheckpointRunCount, base.reviewCheckpointRunCount),
    consumedApprovalCount: normalizeNumber(raw.consumedApprovalCount, base.consumedApprovalCount),
    topProgramIds: normalizeStringArray(raw.topProgramIds),
    topRunIds: normalizeStringArray(raw.topRunIds),
    topApprovalIds: normalizeStringArray(raw.topApprovalIds),
    currentProgramId: normalizeString(raw.currentProgramId, base.currentProgramId),
    currentProgramRunId: normalizeString(raw.currentProgramRunId, base.currentProgramRunId),
    currentApprovalId: normalizeString(raw.currentApprovalId, base.currentApprovalId),
    currentReviewCheckpointRunId: normalizeString(raw.currentReviewCheckpointRunId, base.currentReviewCheckpointRunId),
    currentReviewCheckpointPacketId: normalizeString(raw.currentReviewCheckpointPacketId, base.currentReviewCheckpointPacketId),
    currentReviewCheckpointSummary: normalizeString(raw.currentReviewCheckpointSummary, base.currentReviewCheckpointSummary),
    lastProgramOutcome: normalizeString(raw.lastProgramOutcome, base.lastProgramOutcome),
    overview: normalizeString(raw.overview, base.overview),
    programsPath: normalizeString(raw.programsPath, base.programsPath),
    runsPath: normalizeString(raw.runsPath, base.runsPath),
    approvalsPath: normalizeString(raw.approvalsPath, base.approvalsPath)
  };
}

export function normalizeWorkspaceCampaigns(raw = {}, fallback = null) {
  const base = fallback ?? createWorkspaceIndex().campaigns;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  return {
    ...base,
    ...raw,
    campaignCount: normalizeNumber(raw.campaignCount, base.campaignCount),
    plannedCount: normalizeNumber(raw.plannedCount, base.plannedCount),
    activeCount: normalizeNumber(raw.activeCount, base.activeCount),
    reviewNeededCount: normalizeNumber(raw.reviewNeededCount, base.reviewNeededCount),
    completedCount: normalizeNumber(raw.completedCount, base.completedCount),
    blockedCount: normalizeNumber(raw.blockedCount, base.blockedCount),
    topCampaignIds: normalizeStringArray(raw.topCampaignIds),
    currentCampaignId: normalizeString(raw.currentCampaignId, base.currentCampaignId),
    currentCampaignStatus: normalizeString(raw.currentCampaignStatus, base.currentCampaignStatus),
    currentCampaignStepCount: normalizeNumber(raw.currentCampaignStepCount, base.currentCampaignStepCount),
    currentCampaignCompletedStepCount: normalizeNumber(raw.currentCampaignCompletedStepCount, base.currentCampaignCompletedStepCount),
    currentCampaignReviewNeededStepCount: normalizeNumber(raw.currentCampaignReviewNeededStepCount, base.currentCampaignReviewNeededStepCount),
    currentCampaignNextStepId: normalizeString(raw.currentCampaignNextStepId, base.currentCampaignNextStepId),
    currentCampaignNextAction: normalizeString(raw.currentCampaignNextAction, base.currentCampaignNextAction),
    overview: normalizeString(raw.overview, base.overview),
    campaignsPath: normalizeString(raw.campaignsPath, base.campaignsPath)
  };
}

export function createWorkflowBoundaries() {
  const paperBootstrapOnlyPaths = [
    ".paper/README.md",
    ".paper/project.md",
    ".paper/contracts/research-contract.md",
    ".paper/orchestration/board.json",
    ".paper/orchestration/handoffs.md",
    ".paper/task-packets/index.json",
    ".paper/research/brief.md",
    ".paper/research/agenda.json",
    ".paper/plans/current-plan.md",
    ".paper/outline/current-outline.md",
    ".paper/findings.md",
    ".paper/experiments/EXPERIMENT_LOG.md",
    ".paper/experiments/plans.json",
    ".paper/experiments/results.json",
    ".paper/experiments/audits.json",
    ".paper/sources/index.json",
    ".paper/notes/index.json",
    ".paper/evidence/index.json",
    ".paper/claims/CLAIMS_FROM_RESULTS.md",
    ".paper/claims/bridge-log.json",
    ".paper/reviews/log.md",
    ".paper/reviews/REVIEW_STATE.json",
    ".paper/reviews/concerns.json",
    ".paper/reviews/debate-log.md",
    ".paper/reviews/adversarial-state.json",
    ".paper/revision-plans/current-plan.md",
    ".paper/wiki/index.md",
    ".paper/wiki/query_pack.md",
    ".paper/wiki/navigation.md",
    ".paper/wiki/entities.json",
    ".paper/wiki/relations.json",
    ".paper/checklists/paper.md",
    ".paper/bibliography/references.bib",
    ".paper/bibliography/citation-log.md",
    ".paper/figures/README.md",
    ".paper/figures/index.json",
    ".paper/figures/briefs.json",
    ".paper/figures/segments.json",
    ".paper/figures/templates.json",
    ".paper/figures/editable-index.json",
    ".paper/figures/final-index.json",
    ".paper/figures/qa.json",
    ".paper/rebuttal/issues.json",
    ".paper/rebuttal/strategy.md",
    ".paper/rebuttal/response-draft.md",
    ".paper/versions/index.json",
    ".paper/versions/comparisons.json",
    ".paper/versions/LATEST_COMPARISON.md",
     ".paper/meta/events.json",
     ".paper/meta/long-horizon-memory.json",
      ".paper/meta/operator-playbooks.json",
     ".paper/meta/remediation-packs.json",
     ".paper/meta/recommendations.json",
    ".paper/meta/optimizer-state.json",
    ".paper/meta/LATEST_OPTIMIZER_REPORT.md",
    ".paper/runtime/controller-state.json",
    ".paper/runtime/leases.json",
    ".paper/runtime/events.json",
    ".paper/runtime/results.json",
    ".paper/programs/index.json",
    ".paper/programs/runs.json",
    ".paper/programs/approvals.json",
    ".paper/sessions/journal.json",
    ".paper/sessions/LATEST_SUMMARY.md",
    ".paper/workspace/index.json",
    ".paper/workflow-pack/boundaries.json"
  ];
  return {
    version: 3,
    neutralCorePaths: ["README.md", "bin", "docs", "mcp", "scripts", "src"],
    defaultHostAdapters: ["opencode"],
    availableHostAdapters: ["opencode", "claude", "codex", "cursor", "agents"],
    managedHostAdapterPaths: {
      opencode: [".opencode", ".opencode.json"],
      claude: [".claude/commands", ".claude/agents"],
      codex: [".codex/agents", ".codex/skills", ".codex/config.toml"],
      cursor: [".cursor/commands"],
      agents: [".agents/skills", "AGENTS.md"]
    },
    managedPaths: [
      ".opencode",
      ".opencode.json",
      "README.md",
      "bin",
      "docs",
      "mcp",
      "scripts",
      "src"
    ],
    paperBootstrapOnlyPaths,
    userOwnedPaths: [
      ".paper/drafts",
      ".paper/sources",
      ".paper/notes",
      ".paper/evidence",
      ".paper/experiments",
      ".paper/reviews",
      ".paper/rebuttal",
      ".paper/versions/snapshots",
      ".paper/task-packets/packets",
    ".paper/context/roles",
    ".paper/context/phases",
    ".paper/context/packets",
      ".paper/context/artifacts",
      ".paper/context/actions",
      ".paper/sessions"
    ],
    managedArtifacts: {
      codePack: createManagedArtifactMeta("managed-replaceable", "src"),
      workflowBoundaries: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workflowBoundaries),
      workspaceIndex: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workspaceIndex),
      programsIndex: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.programsIndex),
      programRuns: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.programRuns),
      programApprovals: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.programApprovals)
    },
    notes: [
      "Pack installs and syncs should bootstrap missing .paper artifacts but should not overwrite user-authored workspace state.",
      ".paper remains the durable source of truth and is treated as workspace data, not a managed code payload.",
      "Managed replaceable code and bootstrap-only workspace artifacts now advertise revision/template metadata for clearer reconciliation."
    ],
    updatedAt: null
  };
}
