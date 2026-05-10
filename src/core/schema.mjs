import crypto from "node:crypto";
import { CORE_INSTALL_PATHS, DEFAULT_HOST_ADAPTERS, HOST_IDS, MANAGED_HOST_ADAPTER_PATHS, MANAGED_PACKAGE_PATHS } from "./command-manifest.mjs";
import {
  DOVE_DOMAIN_GUIDANCE,
  DOVE_DOMAIN_IDS,
  DOVE_MISSION_LIFECYCLE_STAGES,
  DOVE_PRIMARY_ROLE_IDS,
  DOVE_PRIMARY_ROLES,
  DOVE_WORKFLOW_KERNEL_VERSION
} from "./dove-domain.mjs";

export {
  DOVE_DOMAIN_GUIDANCE,
  DOVE_DOMAIN_IDS,
  DOVE_MISSION_LIFECYCLE_STAGES,
  DOVE_PRIMARY_ROLE_IDS,
  DOVE_PRIMARY_ROLES,
  DOVE_WORKFLOW_KERNEL_VERSION
} from "./dove-domain.mjs";

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

export const PAPER_LIFECYCLE_TAXONOMY_VERSION = "paper-lifecycle-v1";

export const PAPER_LIFECYCLE_FAMILIES = [
  {
    id: "objective",
    label: "Objective",
    summary: "Research goal, thesis, venue strategy, and acceptance target.",
    roleHints: ["planner"],
    artifactPathKeys: ["state", "project", "researchContract", "researchBrief", "researchAgenda"]
  },
  {
    id: "structure",
    label: "Structure",
    summary: "Paper organization, sections, drafts, figures, checklists, and versions.",
    roleHints: ["planner", "builder"],
    artifactPathKeys: ["plan", "outline", "draftsDir", "checklist", "figuresIndex", "figureQa", "versionsIndex", "versionComparisons"]
  },
  {
    id: "campaign",
    label: "Campaign",
    summary: "Multi-cycle research programs, approvals, and explicit foreground runtime state.",
    roleHints: ["planner"],
    artifactPathKeys: ["programsIndex", "campaignsIndex", "programRuns", "programApprovals", "runtimeControllerState", "runtimeResults"]
  },
  {
    id: "work-unit",
    label: "Work Unit",
    summary: "Board, handoff, task-packet, and context/action surfaces that make work resumable.",
    roleHints: ["planner", "builder", "reviewer"],
    artifactPathKeys: ["orchestrationBoard", "orchestrationHandoffs", "taskPacketsIndex", "workspaceIndex", "workspaceArtifactMap", "actionContextsDir", "packetContextsDir"]
  },
  {
    id: "concern",
    label: "Concern",
    summary: "Reviewer concerns, revision pressure, rebuttal issues, and isolated review handoffs.",
    roleHints: ["reviewer", "builder"],
    artifactPathKeys: ["reviewState", "reviewConcerns", "reviewDebateLog", "adversarialReviewState", "revisionPlan", "rebuttalIssues", "rebuttalStrategy", "isolatedReviewsDir"]
  },
  {
    id: "audit",
    label: "Audit",
    summary: "Inspection, validation, governance proof, figure QA, version comparison, and meta reports.",
    roleHints: ["reviewer", "planner"],
    artifactPathKeys: ["experimentAudits", "reviewLog", "figureQa", "versionComparisons", "metaGovernanceCoverage", "metaRecommendations", "metaOptimizerReport"]
  },
  {
    id: "knowledge",
    label: "Knowledge",
    summary: "Sources, notes, evidence, claims, bibliography, wiki, and long-horizon memory.",
    roleHints: ["builder"],
    artifactPathKeys: ["sources", "notes", "evidence", "claims", "bibliography", "citationLog", "wiki", "wikiEntities", "wikiRelations", "metaLongHorizonMemory", "metaOperatorLessons"]
  }
];

export const PAPER_LIFECYCLE_FAMILY_IDS = PAPER_LIFECYCLE_FAMILIES.map((family) => family.id);

export const PAPER_LIFECYCLE_FAMILY_BY_ID = Object.fromEntries(PAPER_LIFECYCLE_FAMILIES.map((family) => [family.id, family]));

export const PAPER_MAJOR_CHANGE_PROTOCOL_STAGES = ["design", "checklist", "implementation", "acceptance"];

export const PAPER_MAJOR_CHANGE_SIGNALS = [
  "objective-or-thesis-change",
  "structure-or-section-change",
  "core-claim-change",
  "experiment-interpretation-change",
  "reviewer-concern-or-rebuttal-change",
  "figure-set-change",
  "version-or-finalization-change",
  "campaign-or-program-change"
];

const TASK_PACKET_TARGET_FIELDS = [
  "packetId",
  "taskPacketId",
  "missionPacketId",
  "packetIds",
  "target",
  "packetTarget",
  "taskName"
];

function governanceScopeMetadata(mutationScope, options = {}) {
  return {
    mutationScope,
    requiresPacketTarget: Boolean(options.requiresPacketTarget),
    targetFields: options.requiresPacketTarget ? TASK_PACKET_TARGET_FIELDS : [],
    artifactFields: Array.isArray(options.artifactFields) ? options.artifactFields : []
  };
}

function taskScopedMutationMetadata(artifactFields = []) {
  return governanceScopeMetadata("task-scoped-write", { requiresPacketTarget: true, artifactFields });
}

function packetExecutionMutationMetadata(artifactFields = []) {
  return governanceScopeMetadata("packet-execution", { requiresPacketTarget: true, artifactFields });
}

const GOVERNANCE_GUARDED_MUTATION_SCOPE_METADATA = {
  "upsert-orchestration-board": governanceScopeMetadata("workspace-global"),
  "append-handoff": governanceScopeMetadata("workspace-global"),
  "register-source": taskScopedMutationMetadata(["sourceId", "sourceIds", "url", "title"]),
  "upsert-note": taskScopedMutationMetadata(["id", "sourceIds", "claimIds", "sectionId"]),
  "upsert-claims": taskScopedMutationMetadata(["id", "sourceIds", "noteIds", "experimentIds", "sectionId"]),
  "upsert-plan": taskScopedMutationMetadata(["milestoneIds", "sectionIds"]),
  "upsert-outline": taskScopedMutationMetadata(["sectionId", "sectionIds"]),
  "upsert-draft": taskScopedMutationMetadata(["sectionId"]),
  "set-section-status": taskScopedMutationMetadata(["sectionId"]),
  "upsert-figure-plan": taskScopedMutationMetadata(["id", "figureId", "claimIds", "sectionId"]),
  "sync-citations": governanceScopeMetadata("derived-refresh"),
  "refresh-wiki": governanceScopeMetadata("derived-refresh"),
  "build-rebuttal": taskScopedMutationMetadata(["rebuttalIssueIds", "issueIds"]),
  "append-review-log": taskScopedMutationMetadata(["reviewId", "findingIds", "concernIds"]),
  "upsert-revision-plan": taskScopedMutationMetadata(["reviewId", "findingIds", "concernIds"]),
  "run-review-loop": taskScopedMutationMetadata(["scope", "stage"]),
  "prepare-isolated-review": taskScopedMutationMetadata(["runId", "scope", "artifactPaths"]),
  "import-isolated-review": taskScopedMutationMetadata(["runId", "handoffPath", "reportPath"]),
  "run-isolated-review": taskScopedMutationMetadata(["runId", "scope", "artifactPaths"]),
  "update-research-brief": taskScopedMutationMetadata(["sourceIds", "noteIds", "claimIds"]),
  "upsert-experiment-plan": taskScopedMutationMetadata(["id", "experimentId", "claimId"]),
  "upsert-experiment-result": taskScopedMutationMetadata(["id", "resultId", "experimentId", "claimId"]),
  "run-experiment-audit": taskScopedMutationMetadata(["resultId", "experimentId", "auditIds"]),
  "bridge-experiment-result-to-claim": taskScopedMutationMetadata(["resultId", "experimentId", "claimId", "auditIds"]),
  "normalize-rebuttal-issues": taskScopedMutationMetadata(["issueIds", "rebuttalIssueIds"]),
  "build-rebuttal-strategy": taskScopedMutationMetadata(["issueIds", "rebuttalIssueIds"]),
  "create-version-snapshot": taskScopedMutationMetadata(["id", "versionId"]),
  "compare-versions": taskScopedMutationMetadata([]),
  "materialize-guidance-packet": governanceScopeMetadata("task-materialization"),
  "launch-dove-mission": governanceScopeMetadata("task-materialization")
};

export const GOVERNANCE_GUARDED_MUTATIONS = [
  { id: "upsert-orchestration-board", action: "Updating the orchestration board", artifactPath: ".dove/orchestration/board.json", surfaceBindings: { coreFunction: "upsertOrchestrationBoard", mcpTool: "upsert_orchestration_board", commandIds: [] } },
  { id: "append-handoff", action: "Appending a durable handoff", artifactPath: ".dove/orchestration/handoffs.md", surfaceBindings: { coreFunction: "appendHandoff", mcpTool: "append_handoff", commandIds: [] } },
  { id: "register-source", action: "Registering a source", artifactPath: ".dove/sources/index.json", surfaceBindings: { coreFunction: "registerSource", mcpTool: "register_source", commandIds: ["dove.paper.source"] } },
  { id: "upsert-note", action: "Recording a structured note", artifactPath: ".dove/notes/index.json", surfaceBindings: { coreFunction: "upsertNote", mcpTool: "upsert_note", commandIds: ["dove.paper.note"] } },
  { id: "upsert-claims", action: "Updating evidence-backed claims", artifactPath: ".dove/evidence/index.json", surfaceBindings: { coreFunction: "upsertClaims", mcpTool: "upsert_claims", commandIds: ["dove.paper.claim-gate"] } },
  { id: "upsert-plan", action: "Updating the Dove mission plan", artifactPath: ".dove/plans/current-plan.md", surfaceBindings: { coreFunction: "upsertPlan", mcpTool: "upsert_plan", commandIds: ["dove.plan"] } },
  { id: "upsert-outline", action: "Updating the paper outline", artifactPath: ".dove/outline/current-outline.md", surfaceBindings: { coreFunction: "upsertOutline", mcpTool: "upsert_outline", commandIds: ["dove.paper.outline"] } },
  { id: "upsert-draft", action: "Updating a draft section", artifactPath: ".dove/drafts", surfaceBindings: { coreFunction: "upsertDraft", mcpTool: "upsert_draft", commandIds: ["dove.paper.draft"] } },
  { id: "set-section-status", action: "Updating a section status", artifactPath: ".dove/state.json", surfaceBindings: { coreFunction: "setSectionStatus", mcpTool: "set_section_status", commandIds: ["dove.paper.draft", "dove.paper.revise"] } },
  { id: "upsert-figure-plan", action: "Updating the figure plan", artifactPath: ".dove/figures/index.json", surfaceBindings: { coreFunction: "upsertFigurePlan", mcpTool: "upsert_figure_plan", commandIds: ["dove.paper.figure"] } },
  { id: "sync-citations", action: "Updating citation artifacts", artifactPath: ".dove/bibliography/citation-log.md", surfaceBindings: { coreFunction: "syncCitations", mcpTool: "sync_citations", commandIds: ["dove.paper.citations"] } },
  { id: "refresh-wiki", action: "Refreshing the wiki", artifactPath: ".dove/wiki/index.md", surfaceBindings: { coreFunction: "refreshWiki", mcpTool: "refresh_wiki", commandIds: [] } },
  { id: "build-rebuttal", action: "Building the rebuttal draft", artifactPath: ".dove/drafts/rebuttal.md", surfaceBindings: { coreFunction: "buildRebuttal", mcpTool: "build_rebuttal", commandIds: ["dove.paper.rebuttal"] } },
  { id: "append-review-log", action: "Recording a review log", artifactPath: ".dove/reviews/log.md", surfaceBindings: { coreFunction: "appendReviewLog", mcpTool: "append_review_log", commandIds: ["dove.paper.review"] } },
  { id: "upsert-revision-plan", action: "Updating the revision plan", artifactPath: ".dove/revision-plans/current-plan.md", surfaceBindings: { coreFunction: "upsertRevisionPlan", mcpTool: "upsert_revision_plan", commandIds: ["dove.paper.revise"] } },
  { id: "run-review-loop", action: "Running the review loop", artifactPath: ".dove/reviews/log.md", surfaceBindings: { coreFunction: "runReviewLoop", mcpTool: "run_review_loop", commandIds: ["dove.paper.review"] } },
  { id: "prepare-isolated-review", action: "Preparing an isolated reviewer input bundle", artifactPath: ".dove/reviews/isolated", surfaceBindings: { coreFunction: "prepareIsolatedReview", mcpTool: "prepare_isolated_review", commandIds: ["dove.paper.isolated-review"] } },
  { id: "import-isolated-review", action: "Importing an isolated reviewer handoff", artifactPath: ".dove/reviews/isolated", surfaceBindings: { coreFunction: "importIsolatedReview", mcpTool: "import_isolated_review", commandIds: ["dove.paper.isolated-review"] } },
  { id: "run-isolated-review", action: "Running an isolated parallel-session reviewer handoff", artifactPath: ".dove/reviews/isolated", surfaceBindings: { coreFunction: "runIsolatedReview", mcpTool: null, commandIds: ["dove.paper.isolated-review"] } },
  { id: "update-research-brief", action: "Updating the research brief", artifactPath: ".dove/research/brief.md", surfaceBindings: { coreFunction: "updateResearchBrief", mcpTool: "update_research_brief", commandIds: ["dove.paper.research"] } },
  { id: "upsert-experiment-plan", action: "Updating an experiment plan", artifactPath: ".dove/experiments/plans.json", surfaceBindings: { coreFunction: "upsertExperimentPlan", mcpTool: "upsert_experiment_plan", commandIds: ["dove.paper.experiment"] } },
  { id: "upsert-experiment-result", action: "Updating an experiment result", artifactPath: ".dove/experiments/results.json", surfaceBindings: { coreFunction: "upsertExperimentResult", mcpTool: "upsert_experiment_result", commandIds: ["dove.paper.experiment"] } },
  { id: "run-experiment-audit", action: "Running an experiment audit", artifactPath: ".dove/experiments/audits.json", surfaceBindings: { coreFunction: "runExperimentAudit", mcpTool: "run_experiment_audit", commandIds: ["dove.paper.experiment"] } },
  { id: "bridge-experiment-result-to-claim", action: "Bridging an experiment result to a claim", artifactPath: ".dove/claims/bridge-log.json", surfaceBindings: { coreFunction: "bridgeExperimentResultToClaim", mcpTool: "bridge_result_to_claim", commandIds: ["dove.paper.result-bridge"] } },
  { id: "normalize-rebuttal-issues", action: "Normalizing rebuttal issues", artifactPath: ".dove/rebuttal/issues.json", surfaceBindings: { coreFunction: "normalizeRebuttalIssues", mcpTool: "normalize_rebuttal_issues", commandIds: ["dove.paper.rebuttal"] } },
  { id: "build-rebuttal-strategy", action: "Building the rebuttal strategy", artifactPath: ".dove/rebuttal/strategy.md", surfaceBindings: { coreFunction: "buildRebuttalStrategy", mcpTool: "build_rebuttal_strategy", commandIds: ["dove.paper.rebuttal"] } },
  { id: "create-version-snapshot", action: "Creating a version snapshot", artifactPath: ".dove/versions/index.json", surfaceBindings: { coreFunction: "createVersionSnapshot", mcpTool: "create_version_snapshot", commandIds: ["dove.paper.version"] } },
  { id: "compare-versions", action: "Comparing versions", artifactPath: ".dove/versions/comparisons.json", surfaceBindings: { coreFunction: "compareVersions", mcpTool: "compare_versions", commandIds: ["dove.paper.version"] } },
  { id: "materialize-guidance-packet", action: "Materializing accepted guidance into a durable task packet", artifactPath: ".dove/task-packets", surfaceBindings: { coreFunction: "materializeGuidancePacket", mcpTool: "materialize_guidance_packet", commandIds: ["dove.launch"] } },
  { id: "launch-dove-mission", action: "Launching a governed Dove mission by materializing accepted guidance into the authoritative .dove task-packet store", artifactPath: ".dove/task-packets", surfaceBindings: { coreFunction: "launchDoveMission", mcpTool: "launch_dove_mission", commandIds: ["dove.launch"] } }
].map((entry) => ({
  ...entry,
  ...(GOVERNANCE_GUARDED_MUTATION_SCOPE_METADATA[entry.id] ?? governanceScopeMetadata("workspace-global"))
}));

const GOVERNANCE_EXEMPT_MUTATION_SCOPE_METADATA = {
  "record-operator-lesson": governanceScopeMetadata("governance-bookkeeping"),
  "record-operator-follow-through": governanceScopeMetadata("governance-bookkeeping"),
  "issue-program-approval": governanceScopeMetadata("governance-bookkeeping"),
  "plan-campaign": governanceScopeMetadata("governance-bookkeeping"),
  "revoke-program-approval": governanceScopeMetadata("governance-bookkeeping"),
  "run-autonomy-control-plane-once": packetExecutionMutationMetadata(["packetId", "programId", "runId"]),
  "run-autonomy-foreground": packetExecutionMutationMetadata(["packetId", "programId", "runId"]),
  "run-autonomy-operate": packetExecutionMutationMetadata(["packetId", "programId", "runId", "objective"]),
  "query-meta-optimize": governanceScopeMetadata("derived-refresh"),
  "init-project": governanceScopeMetadata("bootstrap"),
  "sync-checklist": governanceScopeMetadata("derived-refresh"),
  "validate-figure-pipeline": governanceScopeMetadata("inspection-only"),
  "classify-workflow-intent": governanceScopeMetadata("inspection-only"),
  "load-board": governanceScopeMetadata("read-helper"),
  "save-board": governanceScopeMetadata("workspace-global"),
  "persist-experiment-audit": governanceScopeMetadata("internal-helper"),
  "persist-experiment-result-claim-bridge": governanceScopeMetadata("internal-helper"),
  "persist-review-log": governanceScopeMetadata("internal-helper"),
  "persist-rebuttal-issues": governanceScopeMetadata("internal-helper"),
  "refresh-durable-surfaces": governanceScopeMetadata("derived-refresh"),
  "summarize-session-journal": governanceScopeMetadata("governance-bookkeeping")
};

export const GOVERNANCE_EXEMPT_MUTATIONS = [
  { id: "record-operator-lesson", action: "Recording distilled operator lessons remains explicitly exempt because it is reflective bookkeeping and does not approve, materialize, or execute work.", artifactPath: ".dove/meta/operator-lessons.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-05-07T00:00:00.000Z", lastReviewedAt: "2026-05-07T00:00:00.000Z", reasonCode: "retrospective-bookkeeping", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "recordOperatorLesson", mcpTool: "record_operator_lesson", commandIds: ["dove.lessons"] } },
  { id: "record-operator-follow-through", action: "Recording follow-through decisions remains explicitly exempt so the governance system can be updated while debt exists.", artifactPath: ".dove/meta/operator-follow-through.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "governance-ledger-maintenance", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "recordOperatorFollowThrough", mcpTool: "record_operator_follow_through", commandIds: ["dove.follow-through"] } },
  { id: "issue-program-approval", action: "Issuing a fresh program approval remains exempt because it is explicit governance bookkeeping that authorizes later bounded execution but does not itself execute work.", artifactPath: ".dove/programs/approvals.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "approval-bookkeeping", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "issueProgramApproval", mcpTool: "issue_program_approval", commandIds: ["dove.approvals"] } },
  { id: "plan-campaign", action: "Recording a multi-cycle campaign plan remains exempt because it only records planner-supervised campaign intent and does not approve or execute bounded program work.", artifactPath: ".dove/programs/campaigns.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-25T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "campaign-planning-bookkeeping", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "planCampaign", mcpTool: "plan_campaign", commandIds: [] } },
  { id: "revoke-program-approval", action: "Revoking a program approval remains exempt because it withdraws authority rather than executing new work.", artifactPath: ".dove/programs/approvals.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "approval-withdrawal", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "revokeProgramApproval", mcpTool: "revoke_program_approval", commandIds: ["dove.approvals"] } },
  { id: "run-autonomy-control-plane-once", action: "A manually invoked autonomous control-plane pass may advance one explicitly accepted planner-supervised packet or materialize one governed planned target through one bounded execution delta with durable runtime audit artifacts.", artifactPath: ".dove/runtime/controller-state.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "single-turn-control-plane-execution", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "runAutonomyControlPlaneOnce", mcpTool: "run_autonomy_once", commandIds: [] } },
  { id: "run-autonomy-foreground", action: "A manually invoked explicit foreground autonomy run may continue one program-scoped bounded authority envelope or the same-lineage execute-materialized-packet continuation until a declared stop condition is reached.", artifactPath: ".dove/runtime/controller-state.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "foreground-bounded-runner", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "runAutonomyForeground", mcpTool: "run_autonomy_foreground", commandIds: [] } },
  { id: "run-autonomy-operate", action: "A manually invoked explicit autonomy operating surface may compose objective/source proposal selection, campaign planning, materialization, bounded approval, foreground execution, and durable stop summaries without hidden scheduling.", artifactPath: ".dove/runtime/controller-state.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-25T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "foreground-research-operating-surface", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "runAutonomyOperate", mcpTool: "run_autonomy_operate", commandIds: ["dove.autonomy-operate"] } },
  { id: "query-meta-optimize", action: "Refreshing proposal-only optimizer surfaces remains exempt because it is part of debt detection, not debt execution.", artifactPath: ".dove/meta/LATEST_OPTIMIZER_REPORT.md", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "proposal-frontier-refresh", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "queryMetaOptimize", mcpTool: "query_meta_optimize", commandIds: ["dove.paper.meta-optimize"] } },
  { id: "init-project", action: "Project initialization bootstraps the workspace and is explicitly exempt from follow-through gating.", artifactPath: ".dove/state.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "workspace-bootstrap", reviewCadence: "per-project", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "initProject", mcpTool: "init_project", commandIds: ["dove.paper.init"] } },
  { id: "sync-checklist", action: "Checklist syncing remains exempt because it summarizes debt instead of executing it.", artifactPath: ".dove/checklists/current.md", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "summary-sync", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "syncChecklist", mcpTool: "sync_checklist", commandIds: ["dove.checklist"] } },
  { id: "validate-figure-pipeline", action: "Figure validation is an inspection path and remains exempt from follow-through execution gating.", artifactPath: ".dove/figures/qa.json", ownerRole: "researcher", approvedByRole: "researcher", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "inspection-only", reviewCadence: "per-change", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "validateFigurePipeline", mcpTool: "validate_figure_pipeline", commandIds: ["dove.paper.figure"] } },
  { id: "classify-workflow-intent", action: "Workflow intent classification is analytical and remains exempt.", artifactPath: ".dove/meta/recommendations.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "analysis-only", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "classifyWorkflowIntent", mcpTool: "query_meta_optimize", commandIds: ["dove.paper.meta-optimize"] } },
  { id: "load-board", action: "Board loading is a read helper and is explicitly exempt.", artifactPath: ".dove/orchestration/board.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "read-helper", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "loadBoard", mcpTool: "query_workspace_index", commandIds: [] } },
  { id: "save-board", action: "Board persistence is an internal helper already covered by guarded orchestration updates and is explicitly exempt as a standalone mutation entrypoint.", artifactPath: ".dove/orchestration/board.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "internal-helper", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "saveBoard", mcpTool: "upsert_orchestration_board", commandIds: [] } },
  { id: "persist-experiment-audit", action: "Experiment audit persistence is an internal helper used by guarded experiment-audit flows and bounded runtime execution, and is explicitly exempt as a standalone mutation entrypoint.", artifactPath: ".dove/experiments/audits.json", ownerRole: "experiment-planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "internal-helper", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "persistExperimentAudit", mcpTool: "run_experiment_audit", commandIds: ["dove.paper.experiment"] } },
  { id: "persist-experiment-result-claim-bridge", action: "Result-to-claim bridge persistence is an internal helper used by guarded bridge flows and bounded runtime execution, and is explicitly exempt as a standalone mutation entrypoint.", artifactPath: ".dove/claims/bridge-log.json", ownerRole: "experiment-planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "internal-helper", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "persistExperimentResultClaimBridge", mcpTool: "bridge_result_to_claim", commandIds: ["dove.paper.result-bridge"] } },
  { id: "persist-review-log", action: "Review log persistence is an internal helper used by guarded review flows and bounded runtime review execution, and is explicitly exempt as a standalone mutation entrypoint.", artifactPath: ".dove/reviews/log.md", ownerRole: "reviewer", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "internal-helper", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "persistReviewLog", mcpTool: "run_review_loop", commandIds: ["dove.paper.review"] } },
  { id: "persist-rebuttal-issues", action: "Rebuttal issue persistence is an internal helper used by guarded review/rebuttal flows and bounded runtime review execution, and is explicitly exempt as a standalone mutation entrypoint.", artifactPath: ".dove/rebuttal/issues.json", ownerRole: "reviewer", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "internal-helper", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "persistRebuttalIssues", mcpTool: "normalize_rebuttal_issues", commandIds: ["dove.paper.rebuttal"] } },
  { id: "refresh-durable-surfaces", action: "Durable surface refresh is a proposal-only summarization step and remains exempt.", artifactPath: ".dove/workspace/index.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "summary-refresh", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "refreshDurableSurfaces", mcpTool: "query_workspace_index", commandIds: ["dove.status", "dove.paper.meta-optimize"] } },
  { id: "summarize-session-journal", action: "Session summarization is reflective and remains exempt from execution gating.", artifactPath: ".dove/sessions/LATEST_SUMMARY.md", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "reflective-summary", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "summarizeSessionJournal", mcpTool: "query_meta_optimize", commandIds: ["dove.paper.meta-optimize"] } }
].map((entry) => ({
  ...entry,
  ...(GOVERNANCE_EXEMPT_MUTATION_SCOPE_METADATA[entry.id] ?? governanceScopeMetadata("governance-bookkeeping"))
}));

export const GOVERNANCE_READONLY_COMMANDS = [
  "dove.orchestrate",
  "dove.mission",
  "dove.status",
  "dove.onboard",
  "dove.paper.audit",
  "dove.audit",
  "dove.return",
  "dove.governance-audit"
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
  { id: "prepare-isolated-review", level: "binding-only", tests: ["isolated review imports only handoff/report artifacts from an external reviewer command"] },
  { id: "import-isolated-review", level: "binding-only", tests: ["isolated review imports only handoff/report artifacts from an external reviewer command"] },
  { id: "run-isolated-review", level: "binding-only", tests: ["isolated review imports only handoff/report artifacts from an external reviewer command"] },
  { id: "update-research-brief", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "upsert-experiment-plan", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "upsert-experiment-result", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "run-experiment-audit", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "bridge-experiment-result-to-claim", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "normalize-rebuttal-issues", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "build-rebuttal-strategy", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "create-version-snapshot", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "compare-versions", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "materialize-guidance-packet", level: "dynamic", tests: ["materializeGuidancePacket creates a durable packet from accepted remediation guidance and binds follow-through"] },
  { id: "launch-dove-mission", level: "dynamic", tests: ["launchDoveMission materializes accepted guidance through the .dove mission packet store and refuses dual-root Dove authority"] }
];

export function resolveResumeCommandForPhase(phase) {
  switch (phase) {
    case "sources":
      return "project:dove.paper.research";
    case "notes":
    case "research":
      return "project:dove.paper.claim-gate";
    case "plan":
      return "project:dove.paper.outline";
    case "outline":
      return "project:dove.paper.draft";
    case "draft":
      return "project:dove.paper.review";
    case "experiments":
      return "project:dove.paper.experiment";
    case "review":
      return "project:dove.paper.rebuttal";
    case "rebuttal":
    case "versions":
      return "project:dove.paper.version";
    case "checklist":
      return "project:dove.checklist";
    default:
      return "project:dove.orchestrate";
  }
}

export const PRIMARY_ROLE_IDS = ["planner", "builder", "reviewer"];

export const SUBAGENT_ROLE_IDS = [
  "researcher",
  "experiment-planner",
  "revision-lead",
  "rebuttal-lead",
  "version-analyst"
];

export const ROLE_HIERARCHY = {
  planner: {
    id: "planner",
    label: "Planner",
    kind: "primary",
    manuallySwitchable: true,
    parentRole: null,
    charter: "Acts as mentor, PI, and editor: sets direction, prioritizes work, coordinates handoffs, and supervises governance.",
    subagents: ["task-planner", "orchestration-manager", "governance-checker", "priority-ranker", "version-analyst"]
  },
  builder: {
    id: "builder",
    label: "Builder",
    kind: "primary",
    manuallySwitchable: true,
    parentRole: null,
    charter: "Acts as the mission builder: writes, implements, revises, gathers evidence, plans experiments, interprets results, and prepares responses.",
    subagents: ["researcher", "experiment-planner", "result-analyst", "paper-writer", "revision-lead"]
  },
  reviewer: {
    id: "reviewer",
    label: "Reviewer",
    kind: "primary",
    manuallySwitchable: true,
    parentRole: null,
    charter: "Acts as the independent critic: attacks claims, checks evidence and methods, records concerns, and issues verdicts.",
    subagents: ["claim-critic", "evidence-auditor", "experiment-auditor", "methodology-critic", "novelty-critic"]
  },
  researcher: {
    id: "researcher",
    label: "Researcher",
    kind: "subagent",
    manuallySwitchable: false,
    parentRole: "builder",
    charter: "Builder-side specialist for sources, notes, claims, evidence maps, and durable research briefs."
  },
  "experiment-planner": {
    id: "experiment-planner",
    label: "Experiment Planner",
    kind: "subagent",
    manuallySwitchable: false,
    parentRole: "builder",
    charter: "Builder-side specialist for claim-driven experiment plans, baselines, metrics, ablations, and result-to-claim closure."
  },
  "revision-lead": {
    id: "revision-lead",
    label: "Revision Lead",
    kind: "subagent",
    manuallySwitchable: false,
    parentRole: "builder",
    aliasOf: "rebuttal-lead",
    charter: "Builder-side specialist for turning reviewer concerns into revision plans, response matrices, and rebuttal drafts."
  },
  "rebuttal-lead": {
    id: "rebuttal-lead",
    label: "Rebuttal Lead",
    kind: "legacy-subagent",
    manuallySwitchable: false,
    parentRole: "builder",
    canonicalRole: "revision-lead",
    charter: "Legacy name for builder-side revision and rebuttal response work."
  },
  "version-analyst": {
    id: "version-analyst",
    label: "Version Analyst",
    kind: "subagent",
    manuallySwitchable: false,
    parentRole: "planner",
    charter: "Planner-side audit specialist for version diffs, regression checks, and concern-resolution evidence."
  }
};

export const ROLE_IDS = [
  ...PRIMARY_ROLE_IDS,
  ...SUBAGENT_ROLE_IDS
];

export function roleCanActAs(actorRole, expectedRole) {
  if (actorRole === expectedRole) {
    return true;
  }
  const actor = ROLE_HIERARCHY[actorRole];
  const expected = ROLE_HIERARCHY[expectedRole];
  return expected?.parentRole === actorRole || actor?.parentRole === expectedRole;
}

export const ARTIFACT_PATHS = {
  doveRoot: ".dove",
  state: ".dove/state.json",
  readme: ".dove/README.md",
  project: ".dove/project.md",
  researchContract: ".dove/contracts/research-contract.md",
  orchestrationBoard: ".dove/orchestration/board.json",
  orchestrationHandoffs: ".dove/orchestration/handoffs.md",
  taskPacketsDir: ".dove/task-packets",
  taskPacketsPacketsDir: ".dove/task-packets/packets",
  taskPacketsIndex: ".dove/task-packets/index.json",
  roleContextsDir: ".dove/context/roles",
  phaseContextsDir: ".dove/context/phases",
  packetContextsDir: ".dove/context/packets",
  artifactContextsDir: ".dove/context/artifacts",
  actionContextsDir: ".dove/context/actions",
  sessionJournal: ".dove/sessions/journal.json",
  sessionSummary: ".dove/sessions/LATEST_SUMMARY.md",
  workspaceDir: ".dove/workspace",
  workspaceIndex: ".dove/workspace/index.json",
  workspaceArtifactMap: ".dove/workspace/artifact-map.json",
  doveRootManifest: ".dove/manifest.json",
  programsDir: ".dove/programs",
  programsIndex: ".dove/programs/index.json",
  programRuns: ".dove/programs/runs.json",
  programApprovals: ".dove/programs/approvals.json",
  campaignsIndex: ".dove/programs/campaigns.json",
  workflowPackDir: ".dove/workflow-pack",
  workflowBoundaries: ".dove/workflow-pack/boundaries.json",
  researchBrief: ".dove/research/brief.md",
  researchAgenda: ".dove/research/agenda.json",
  plan: ".dove/plans/current-plan.md",
  outline: ".dove/outline/current-outline.md",
  findings: ".dove/findings.md",
  experimentLog: ".dove/experiments/EXPERIMENT_LOG.md",
  experimentPlans: ".dove/experiments/plans.json",
  experimentResults: ".dove/experiments/results.json",
  experimentAudits: ".dove/experiments/audits.json",
  sources: ".dove/sources/index.json",
  notes: ".dove/notes/index.json",
  evidence: ".dove/evidence/index.json",
  claims: ".dove/claims/CLAIMS_FROM_RESULTS.md",
  claimBridgeLog: ".dove/claims/bridge-log.json",
  draftsDir: ".dove/drafts",
  reviewLog: ".dove/reviews/log.md",
  reviewState: ".dove/reviews/REVIEW_STATE.json",
  reviewConcerns: ".dove/reviews/concerns.json",
  reviewDebateLog: ".dove/reviews/debate-log.md",
  adversarialReviewState: ".dove/reviews/adversarial-state.json",
  isolatedReviewsDir: ".dove/reviews/isolated",
  revisionPlan: ".dove/revision-plans/current-plan.md",
  wiki: ".dove/wiki/index.md",
  queryPack: ".dove/wiki/query_pack.md",
  navigationReport: ".dove/wiki/navigation.md",
  wikiEntities: ".dove/wiki/entities.json",
  wikiRelations: ".dove/wiki/relations.json",
  checklist: ".dove/checklists/current.md",
  bibliography: ".dove/bibliography/references.bib",
  citationLog: ".dove/bibliography/citation-log.md",
  figuresReadme: ".dove/figures/README.md",
  figuresIndex: ".dove/figures/index.json",
  figureBriefs: ".dove/figures/briefs.json",
  figureSegments: ".dove/figures/segments.json",
  figureTemplates: ".dove/figures/templates.json",
  figureEditableIndex: ".dove/figures/editable-index.json",
  figureFinalIndex: ".dove/figures/final-index.json",
  figureQa: ".dove/figures/qa.json",
  rebuttalIssues: ".dove/rebuttal/issues.json",
  rebuttalStrategy: ".dove/rebuttal/strategy.md",
  rebuttalResponseDraft: ".dove/rebuttal/response-draft.md",
  versionsIndex: ".dove/versions/index.json",
  versionComparisons: ".dove/versions/comparisons.json",
  versionComparisonReport: ".dove/versions/LATEST_COMPARISON.md",
  versionSnapshotsDir: ".dove/versions/snapshots",
  runtimeDir: ".dove/runtime",
  runtimeControllerState: ".dove/runtime/controller-state.json",
  runtimeContinuation: ".dove/runtime/continuation.json",
  runtimeLeases: ".dove/runtime/leases.json",
  runtimeEvents: ".dove/runtime/events.json",
  runtimeResults: ".dove/runtime/results.json",
  metaDir: ".dove/meta",
  metaEvents: ".dove/meta/events.json",
  metaExecutionBridgeCandidates: ".dove/meta/execution-bridge-candidates.json",
  metaGovernanceCoverage: ".dove/meta/governance-coverage.json",
  metaGovernanceCoverageReport: ".dove/meta/governance-coverage-report.json",
  metaGovernanceCoverageReportMarkdown: ".dove/meta/LATEST_GOVERNANCE_COVERAGE_REPORT.md",
  metaLongHorizonMemory: ".dove/meta/long-horizon-memory.json",
  metaOperatorLessons: ".dove/meta/operator-lessons.json",
  metaOperatorFollowThrough: ".dove/meta/operator-follow-through.json",
  metaOperatorFollowThroughTransitions: ".dove/meta/operator-follow-through-transitions.json",
  metaOperatorPlaybooks: ".dove/meta/operator-playbooks.json",
  metaRemediationPacks: ".dove/meta/remediation-packs.json",
  metaRecommendations: ".dove/meta/recommendations.json",
  metaOptimizerState: ".dove/meta/optimizer-state.json",
  metaOptimizerReport: ".dove/meta/LATEST_OPTIMIZER_REPORT.md"
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
        draftPath: `.dove/drafts/${id}.md`,
        claimIds: []
      }
    ])
  );
}

function defaultRoleRoster() {
  return PRIMARY_ROLE_IDS.map((roleId) => {
    const role = ROLE_HIERARCHY[roleId];
    return {
      id: role.id,
      label: role.label,
      kind: role.kind,
      manuallySwitchable: role.manuallySwitchable,
      parentRole: role.parentRole,
      charter: role.charter,
      subagents: role.subagents ?? []
    };
  });
}

export function createDefaultBoard(stateOverrides = {}) {
  const objective = stateOverrides.dove?.objective ?? "Capture the paper's goal and contribution.";
  const phase = stateOverrides.pipeline?.currentStage ?? "init";
  return {
    version: 2,
    paperObjective: objective,
    currentPhase: phase,
    intentType: "plan",
    assignedRole: "planner",
    currentFocus: "Align the board and choose the next durable step.",
    nextAction: "Run project:dove.orchestrate and record the next role-owned task.",
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

export function normalizeTaskTargetResolutionSettings(raw = {}, base = { autoSelect: true, autoSelectMinScore: 0.55, recordResolution: true }) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const rawScore = source.autoSelectMinScore;
  const autoSelectMinScore = typeof rawScore === "number" && Number.isFinite(rawScore)
    ? Math.min(1, Math.max(0, rawScore))
    : base.autoSelectMinScore;
  return {
    autoSelect: typeof source.autoSelect === "boolean" ? source.autoSelect : base.autoSelect,
    autoSelectMinScore,
    recordResolution: typeof source.recordResolution === "boolean" ? source.recordResolution : base.recordResolution
  };
}

export function normalizeSettings(raw = {}, base = null) {
  const defaults = base ?? {
    strictMode: false,
    taskTargetResolution: normalizeTaskTargetResolutionSettings()
  };
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    ...defaults,
    ...source,
    strictMode: Boolean(source.strictMode ?? defaults.strictMode),
    taskTargetResolution: normalizeTaskTargetResolutionSettings(source.taskTargetResolution, defaults.taskTargetResolution)
  };
}

export function createDefaultSettings(overrides = {}) {
  return normalizeSettings(overrides);
}

export function createDefaultState(overrides = {}) {
  const base = {
    version: SCHEMA_VERSION,
    dove: {
      title: "Untitled Mission Workspace",
      venue: "Unspecified",
      objective: "Capture the Dove mission goal and contribution.",
      deadline: "",
      thesis: "Describe the paper-domain claim or mission outcome in one sentence.",
      audience: "TBD"
    },
    pipeline: {
      currentStage: "init",
      lastCompletedStage: null,
      resumeCommand: "project:dove.orchestrate",
      updatedAt: new Date(0).toISOString()
    },
    orchestration: {
      boardPath: ARTIFACT_PATHS.orchestrationBoard,
      handoffPath: ARTIFACT_PATHS.orchestrationHandoffs,
      phase: "init",
      intentType: "plan",
      assignedRole: "planner",
      currentFocus: "Align the board and choose the next durable step.",
      nextAction: "Run project:dove.orchestrate and record the next role-owned task.",
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
    settings: createDefaultSettings()
  };

  const incomingDove = overrides.dove ?? overrides.paper ?? {};
  return {
    ...base,
    ...overrides,
    dove: {
      ...base.dove,
      ...incomingDove
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
    settings: normalizeSettings(overrides.settings, base.settings),
    paper: undefined
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
        draftPath: `.dove/drafts/${id}.md`,
        claimIds: []
      }),
      ...section,
      id,
      draftPath: section?.draftPath ?? `.dove/drafts/${id}.md`,
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

function createLifecycleFamilySummary(overrides = {}) {
  return PAPER_LIFECYCLE_FAMILIES.map((family) => {
    const incoming = overrides[family.id] && typeof overrides[family.id] === "object" && !Array.isArray(overrides[family.id])
      ? overrides[family.id]
      : {};
    return {
      id: family.id,
      label: family.label,
      summary: family.summary,
      roleHints: normalizeStringArray(incoming.roleHints, family.roleHints),
      artifactPathKeys: normalizeStringArray(incoming.artifactPathKeys, family.artifactPathKeys),
      artifactCount: normalizeNumber(incoming.artifactCount, 0),
      activePacketCount: normalizeNumber(incoming.activePacketCount, 0),
      packetCount: normalizeNumber(incoming.packetCount, 0)
    };
  });
}

export function normalizeLifecycleFamilyId(value, fallback = null) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return PAPER_LIFECYCLE_FAMILY_IDS.includes(normalized) ? normalized : fallback;
}

export function normalizeDoveDomainId(value, fallback = "paper") {
  const normalized = typeof value === "string" ? value.trim() : "";
  return DOVE_DOMAIN_IDS.includes(normalized) ? normalized : fallback;
}

export function normalizeDoveMissionLifecycleStage(value, fallback = "goal") {
  const normalized = typeof value === "string" ? value.trim() : "";
  return DOVE_MISSION_LIFECYCLE_STAGES.includes(normalized) ? normalized : fallback;
}

function createDoveRoleSummary(overrides = {}) {
  const roleOverrides = Object.fromEntries(normalizeObjectArray(overrides).map((role) => [role.id, role]));
  return DOVE_PRIMARY_ROLES.map((role) => ({
    ...role,
    ...normalizeObject(roleOverrides[role.id]),
    id: role.id,
    label: normalizeString(roleOverrides[role.id]?.label, role.label),
    summary: normalizeString(roleOverrides[role.id]?.summary, role.summary)
  }));
}

function createDoveDomainGuidance(overrides = {}) {
  const domainOverrides = Object.fromEntries(normalizeObjectArray(overrides).map((domain) => [domain.id, domain]));
  return DOVE_DOMAIN_GUIDANCE.map((domain) => {
    const incoming = normalizeObject(domainOverrides[domain.id]);
    const incomingStageRoutes = normalizeObject(incoming.stageRoutes);
    return {
      ...domain,
      ...incoming,
      id: domain.id,
      label: normalizeString(incoming.label, domain.label),
      summary: normalizeString(incoming.summary, domain.summary),
      stageRoutes: Object.fromEntries(DOVE_MISSION_LIFECYCLE_STAGES.map((stage) => [stage, normalizeString(incomingStageRoutes[stage], domain.stageRoutes[stage])])),
      returnEvidence: normalizeStringArray(incoming.returnEvidence, domain.returnEvidence)
    };
  });
}

export function createDoveAuthorityManifest() {
  return {
    version: 1,
    status: "authoritative",
    strategy: "dove-direct",
    activeDurableRoot: ARTIFACT_PATHS.doveRoot,
    authoritativeRoot: ARTIFACT_PATHS.doveRoot,
    manifestPath: ARTIFACT_PATHS.doveRootManifest,
    currentWriteAuthority: ARTIFACT_PATHS.doveRoot,
    legacyRoot: ".paper",
    dualRootInvariant: {
      allowed: false,
      doveRootAuthoritative: true,
      legacyRootAuthoritative: false,
      reason: ".dove is the only authoritative durable root for Dove."
    },
    phases: [
      {
        id: "dove-direct-authority",
        status: "active",
        summary: "Dove owns the package identity, command language, MCP identity, and .dove durable root."
      }
    ],
    nextDecision: "Use Dove surfaces directly; old .paper state is not read as runtime authority."
  };
}

export function normalizeDoveAuthorityManifest(raw = {}, fallback = null) {
  const base = fallback ?? createDoveAuthorityManifest();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const dualRootInvariant = normalizeObject(raw.dualRootInvariant);
  return {
    ...base,
    ...raw,
    version: 1,
    status: normalizeString(raw.status, base.status),
    strategy: normalizeString(raw.strategy, base.strategy),
    activeDurableRoot: normalizeString(raw.activeDurableRoot, base.activeDurableRoot),
    authoritativeRoot: normalizeString(raw.authoritativeRoot, base.authoritativeRoot),
    manifestPath: normalizeString(raw.manifestPath, base.manifestPath),
    currentWriteAuthority: normalizeString(raw.currentWriteAuthority, base.currentWriteAuthority),
    legacyRoot: normalizeString(raw.legacyRoot, base.legacyRoot),
    dualRootInvariant: {
      ...base.dualRootInvariant,
      ...dualRootInvariant,
      allowed: normalizeBoolean(dualRootInvariant.allowed, base.dualRootInvariant.allowed),
      doveRootAuthoritative: normalizeBoolean(dualRootInvariant.doveRootAuthoritative, base.dualRootInvariant.doveRootAuthoritative),
      legacyRootAuthoritative: normalizeBoolean(dualRootInvariant.legacyRootAuthoritative, base.dualRootInvariant.legacyRootAuthoritative),
      reason: normalizeString(dualRootInvariant.reason, base.dualRootInvariant.reason)
    },
    phases: normalizeObjectArray(raw.phases).length > 0 ? normalizeObjectArray(raw.phases).map((phase) => ({
      id: normalizeString(phase.id, "unknown"),
      status: normalizeString(phase.status, "unknown"),
      summary: normalizeString(phase.summary, "No summary provided.")
    })) : base.phases,
    nextDecision: normalizeString(raw.nextDecision, base.nextDecision)
  };
}

export function createDoveWorkspaceKernel() {
  return {
    kernelVersion: DOVE_WORKFLOW_KERNEL_VERSION,
    unified: true,
    explicitOnly: true,
    noHiddenRuntime: true,
    identity: {
      productName: "Dove",
      packageName: "dove",
      publicCli: "dove",
      commandPrefix: "project:dove.",
      activeDurableRoot: ARTIFACT_PATHS.doveRoot,
      durableRootStatus: "authoritative",
      overview: "Dove is the product, CLI, MCP identity, command language, and durable workspace authority."
    },
    authorityManifest: createDoveAuthorityManifest(),
    currentDomain: "paper",
    domainIds: DOVE_DOMAIN_IDS,
    primaryRoleIds: DOVE_PRIMARY_ROLE_IDS,
    primaryRoles: createDoveRoleSummary(),
    domainGuidance: createDoveDomainGuidance(),
    missionLifecycle: {
      stages: DOVE_MISSION_LIFECYCLE_STAGES,
      currentStage: "goal",
      paperProtocolStages: PAPER_MAJOR_CHANGE_PROTOCOL_STAGES,
      overview: "Dove missions close through goal, design, checklist, execution, audit, and return."
    },
    missionModel: {
      workUnitName: "mission",
      sourcePacketName: "mission-packet",
      domainField: "doveDomain",
      goalField: "goal",
      returnArtifactName: "handoff",
      acceptanceField: "acceptance",
      durableRoot: ARTIFACT_PATHS.doveRoot
    },
    missionCount: 0,
    activeMissionCount: 0,
    reviewNeededMissionCount: 0,
    domainCounts: Object.fromEntries(DOVE_DOMAIN_IDS.map((domainId) => [domainId, 0])),
    currentMissionFamily: null,
    overview: "Dove is active: paper-domain workflows and engineering missions share one authoritative mission kernel."
  };
}

function normalizeWorkspaceDove(raw = {}, fallback = null) {
  const base = fallback ?? createDoveWorkspaceKernel();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const identity = normalizeObject(raw.identity);
  const authorityManifest = normalizeObject(raw.authorityManifest);
  const missionLifecycle = normalizeObject(raw.missionLifecycle);
  const missionModel = normalizeObject(raw.missionModel);
  const domainCounts = normalizeObject(raw.domainCounts);
  return {
    ...base,
    ...raw,
    kernelVersion: normalizeString(raw.kernelVersion, base.kernelVersion),
    unified: normalizeBoolean(raw.unified, base.unified),
    explicitOnly: normalizeBoolean(raw.explicitOnly, base.explicitOnly),
    noHiddenRuntime: normalizeBoolean(raw.noHiddenRuntime, base.noHiddenRuntime),
    identity: {
      ...base.identity,
      ...identity,
      productName: normalizeString(identity.productName, base.identity.productName),
      packageName: normalizeString(identity.packageName, base.identity.packageName),
      publicCli: normalizeString(identity.publicCli, base.identity.publicCli),
      commandPrefix: normalizeString(identity.commandPrefix, base.identity.commandPrefix),
      activeDurableRoot: normalizeString(identity.activeDurableRoot, base.identity.activeDurableRoot),
      durableRootStatus: normalizeString(identity.durableRootStatus, base.identity.durableRootStatus),
      overview: normalizeString(identity.overview, base.identity.overview)
    },
    authorityManifest: normalizeDoveAuthorityManifest(authorityManifest, base.authorityManifest),
    currentDomain: normalizeDoveDomainId(raw.currentDomain, base.currentDomain),
    domainIds: DOVE_DOMAIN_IDS,
    primaryRoleIds: DOVE_PRIMARY_ROLE_IDS,
    primaryRoles: createDoveRoleSummary(raw.primaryRoles),
    domainGuidance: createDoveDomainGuidance(raw.domainGuidance),
    missionLifecycle: {
      ...base.missionLifecycle,
      ...missionLifecycle,
      stages: normalizeStringArray(missionLifecycle.stages, DOVE_MISSION_LIFECYCLE_STAGES).filter((stage) => DOVE_MISSION_LIFECYCLE_STAGES.includes(stage)),
      currentStage: normalizeDoveMissionLifecycleStage(missionLifecycle.currentStage, base.missionLifecycle.currentStage),
      paperProtocolStages: normalizeStringArray(missionLifecycle.paperProtocolStages, PAPER_MAJOR_CHANGE_PROTOCOL_STAGES).filter((stage) => PAPER_MAJOR_CHANGE_PROTOCOL_STAGES.includes(stage)),
      overview: normalizeString(missionLifecycle.overview, base.missionLifecycle.overview)
    },
    missionModel: {
      ...base.missionModel,
      ...missionModel,
      workUnitName: normalizeString(missionModel.workUnitName, base.missionModel.workUnitName),
      sourcePacketName: normalizeString(missionModel.sourcePacketName, base.missionModel.sourcePacketName),
      domainField: normalizeString(missionModel.domainField, base.missionModel.domainField),
      goalField: normalizeString(missionModel.goalField, base.missionModel.goalField),
      returnArtifactName: normalizeString(missionModel.returnArtifactName, base.missionModel.returnArtifactName),
      acceptanceField: normalizeString(missionModel.acceptanceField, base.missionModel.acceptanceField),
      durableRoot: normalizeString(missionModel.durableRoot, base.missionModel.durableRoot)
    },
    missionCount: normalizeNumber(raw.missionCount, base.missionCount),
    activeMissionCount: normalizeNumber(raw.activeMissionCount, base.activeMissionCount),
    reviewNeededMissionCount: normalizeNumber(raw.reviewNeededMissionCount, base.reviewNeededMissionCount),
    domainCounts: Object.fromEntries(DOVE_DOMAIN_IDS.map((domainId) => [domainId, normalizeNumber(domainCounts[domainId], base.domainCounts[domainId] ?? 0)])),
    currentMissionFamily: normalizeLifecycleFamilyId(raw.currentMissionFamily, base.currentMissionFamily),
    overview: normalizeString(raw.overview, base.overview)
  };
}

function normalizeWorkspaceLifecycle(raw = {}, fallback = null) {
  const base = fallback ?? {
    taxonomyVersion: PAPER_LIFECYCLE_TAXONOMY_VERSION,
    familyIds: PAPER_LIFECYCLE_FAMILY_IDS,
    families: createLifecycleFamilySummary(),
    artifactCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, 0])),
    activePacketCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, 0])),
    packetCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, 0])),
    boardFamily: null,
    boardPhaseFamily: null,
    topFamilies: [],
    protocol: {
      stages: PAPER_MAJOR_CHANGE_PROTOCOL_STAGES,
      majorChangeSignals: PAPER_MAJOR_CHANGE_SIGNALS,
      overview: "Major paper changes should close through design, checklist, implementation, and acceptance."
    }
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const familyOverrides = Object.fromEntries(normalizeObjectArray(raw.families).map((family) => [family.id, family]));
  const artifactCounts = normalizeObject(raw.artifactCounts);
  const activePacketCounts = normalizeObject(raw.activePacketCounts);
  const packetCounts = normalizeObject(raw.packetCounts);
  const protocol = normalizeObject(raw.protocol);
  return {
    ...base,
    ...raw,
    taxonomyVersion: normalizeString(raw.taxonomyVersion, PAPER_LIFECYCLE_TAXONOMY_VERSION),
    familyIds: PAPER_LIFECYCLE_FAMILY_IDS,
    families: createLifecycleFamilySummary(familyOverrides),
    artifactCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, normalizeNumber(artifactCounts[familyId], 0)])),
    activePacketCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, normalizeNumber(activePacketCounts[familyId], 0)])),
    packetCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, normalizeNumber(packetCounts[familyId], 0)])),
    boardFamily: normalizeLifecycleFamilyId(raw.boardFamily, base.boardFamily),
    boardPhaseFamily: normalizeLifecycleFamilyId(raw.boardPhaseFamily, base.boardPhaseFamily),
    topFamilies: normalizeStringArray(raw.topFamilies).filter((familyId) => PAPER_LIFECYCLE_FAMILY_IDS.includes(familyId)),
    protocol: {
      ...base.protocol,
      ...protocol,
      stages: normalizeStringArray(protocol.stages, PAPER_MAJOR_CHANGE_PROTOCOL_STAGES).filter((stage) => PAPER_MAJOR_CHANGE_PROTOCOL_STAGES.includes(stage)),
      majorChangeSignals: normalizeStringArray(protocol.majorChangeSignals, PAPER_MAJOR_CHANGE_SIGNALS).filter((signal) => PAPER_MAJOR_CHANGE_SIGNALS.includes(signal)),
      overview: normalizeString(protocol.overview, base.protocol.overview)
    }
  };
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
      dove: {
        title: raw.projectTitle ?? "Untitled Mission Workspace",
        venue: raw.venue ?? "Unspecified",
        objective: raw.objective ?? "Capture the Dove mission goal and contribution.",
        deadline: raw.deadline ?? "",
        thesis: "Describe the paper-domain claim or mission outcome in one sentence.",
        audience: "TBD"
      },
      pipeline: {
        currentStage: raw.currentPhase ?? "init",
        lastCompletedStage: null,
        resumeCommand: "project:dove.orchestrate",
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
        resumeCommand: raw.pipeline?.resumeCommand ?? "project:dove.orchestrate"
      }
    });
  }

  const defaults = createDefaultState();
  return {
    ...defaults,
    ...raw,
    version: SCHEMA_VERSION,
    dove: {
      ...defaults.dove,
      ...(raw.dove ?? raw.paper ?? {})
    },
    paper: undefined,
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
    settings: normalizeSettings(raw.settings, defaults.settings)
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
  const lifecycle = normalizeObject(raw.lifecycle);
  const dove = normalizeObject(raw.dove);
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
    lifecycle: normalizeWorkspaceLifecycle(lifecycle, base.lifecycle),
    dove: normalizeWorkspaceDove(dove, base.dove),
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
    doveBootstrapOnlyPaths: normalizeStringArray(raw.doveBootstrapOnlyPaths, base.doveBootstrapOnlyPaths),
    userOwnedPaths: normalizeStringArray(raw.userOwnedPaths, base.userOwnedPaths),
    managedArtifacts: {
      codePack: {
        ...createManagedArtifactMeta("managed-replaceable", "src"),
        ...normalizeObject(managedArtifacts.codePack)
      },
      workflowBoundaries: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workflowBoundaries),
      workspaceIndex: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workspaceIndex),
      doveRootManifest: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.doveRootManifest),
      executionBridgeCandidates: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.metaExecutionBridgeCandidates),
      operatorLessons: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.metaOperatorLessons),
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
    lifecycleFamilyCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, 0])),
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

function cleanUniqueStrings(value, fallback = []) {
  return Array.from(new Set(normalizeStringArray(value, fallback).map((item) => item.trim()).filter(Boolean)));
}

function cleanOptionalString(value, fallback = null) {
  const normalized = normalizeString(value, fallback);
  return typeof normalized === "string" ? normalized.trim() : normalized;
}

function isTrellisTaskSourceArtifact(value) {
  const normalized = String(value ?? "").trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
  return normalized === ".trellis/tasks" || normalized.startsWith(".trellis/tasks/") || normalized === "trellis/tasks" || normalized.startsWith("trellis/tasks/");
}

function normalizeOperatorLessonStatus(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["active", "retired", "superseded", "archived"].includes(normalized) ? normalized : "active";
}

function summarizeOperatorLessons(lessons = []) {
  const activeLessons = lessons.filter((lesson) => lesson.status === "active");
  const countBy = (items) => items.reduce((accumulator, item) => {
    accumulator[item] = (accumulator[item] ?? 0) + 1;
    return accumulator;
  }, {});
  const topKeys = (items) => Object.entries(countBy(items))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([key]) => key);
  const sortedActive = [...activeLessons].sort((left, right) => String(right.updatedAt ?? right.createdAt ?? "").localeCompare(String(left.updatedAt ?? left.createdAt ?? "")) || left.id.localeCompare(right.id));
  return {
    lessonCount: lessons.length,
    activeLessonCount: activeLessons.length,
    topLessonIds: sortedActive.slice(0, 8).map((lesson) => lesson.id),
    topTags: topKeys(activeLessons.flatMap((lesson) => lesson.tags ?? [])),
    topDomains: topKeys(activeLessons.map((lesson) => lesson.domain).filter(Boolean)),
    overview: activeLessons.length > 0
      ? `${activeLessons.length} active distilled operator lessons are available for reuse.`
      : "No distilled operator lessons have been recorded yet.",
    lessonsPath: ARTIFACT_PATHS.metaOperatorLessons
  };
}

function normalizeOperatorLesson(raw = {}, index = 0) {
  const title = cleanOptionalString(raw.title, `Operator lesson ${index + 1}`);
  const actorRole = cleanOptionalString(raw.actorRole, "planner");
  const createdAt = cleanOptionalString(raw.createdAt, null);
  const updatedAt = cleanOptionalString(raw.updatedAt, createdAt);
  const sourceArtifacts = cleanUniqueStrings(raw.sourceArtifacts).filter((artifactPath) => !isTrellisTaskSourceArtifact(artifactPath));
  return {
    ...raw,
    id: cleanOptionalString(raw.id, `lesson-${index + 1}`),
    title,
    problem: cleanOptionalString(raw.problem, "No problem statement recorded."),
    decisions: cleanUniqueStrings(raw.decisions),
    pitfalls: cleanUniqueStrings(raw.pitfalls),
    validation: cleanUniqueStrings(raw.validation),
    nextTime: cleanUniqueStrings(raw.nextTime),
    domain: normalizeDoveDomainId(raw.domain, "engineering"),
    stage: normalizeDoveMissionLifecycleStage(raw.stage, "return"),
    actorRole: ROLE_IDS.includes(actorRole) ? actorRole : "planner",
    tags: cleanUniqueStrings(raw.tags),
    sourceType: cleanOptionalString(raw.sourceType, "manual-retrospective"),
    sourceId: cleanOptionalString(raw.sourceId, null),
    sourceArtifacts,
    packetIds: cleanUniqueStrings(raw.packetIds),
    recommendationIds: cleanUniqueStrings(raw.recommendationIds),
    playbookIds: cleanUniqueStrings(raw.playbookIds),
    remediationPackIds: cleanUniqueStrings(raw.remediationPackIds),
    status: normalizeOperatorLessonStatus(raw.status),
    createdAt,
    updatedAt
  };
}

export function createMetaOperatorLessonsIndex() {
  return {
    version: 1,
    referenceOnly: true,
    explicitOnly: true,
    noAutoCapture: true,
    noAutoApply: true,
    lessons: [],
    summary: summarizeOperatorLessons([]),
    sourceArtifacts: [
      ARTIFACT_PATHS.sessionSummary,
      ARTIFACT_PATHS.workspaceIndex,
      ARTIFACT_PATHS.metaOperatorPlaybooks,
      ARTIFACT_PATHS.metaRemediationPacks,
      ARTIFACT_PATHS.metaLongHorizonMemory
    ],
    updatedAt: null
  };
}

export function normalizeMetaOperatorLessonsIndex(raw = {}) {
  const base = createMetaOperatorLessonsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const lessons = normalizeObjectArray(raw.lessons).map(normalizeOperatorLesson);
  const sourceArtifacts = cleanUniqueStrings(raw.sourceArtifacts, base.sourceArtifacts).filter((artifactPath) => !isTrellisTaskSourceArtifact(artifactPath));
  return {
    ...base,
    ...raw,
    version: base.version,
    referenceOnly: base.referenceOnly,
    explicitOnly: base.explicitOnly,
    noAutoCapture: base.noAutoCapture,
    noAutoApply: base.noAutoApply,
    lessons,
    summary: summarizeOperatorLessons(lessons),
    sourceArtifacts: sourceArtifacts.length > 0 ? sourceArtifacts : base.sourceArtifacts,
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
      ARTIFACT_PATHS.metaOperatorLessons,
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
      operatorLessons: summarizeOperatorLessons([]),
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
  const operatorLessons = normalizeObject(raw.operatorLessons);

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
      operatorLessons: {
        ...base.operatorLessons,
        ...operatorLessons,
        lessonCount: normalizeNumber(operatorLessons.lessonCount, base.operatorLessons.lessonCount),
        activeLessonCount: normalizeNumber(operatorLessons.activeLessonCount, base.operatorLessons.activeLessonCount),
        topLessonIds: normalizeStringArray(operatorLessons.topLessonIds),
        topTags: normalizeStringArray(operatorLessons.topTags),
        topDomains: normalizeStringArray(operatorLessons.topDomains),
        overview: normalizeString(operatorLessons.overview, base.operatorLessons.overview),
        lessonsPath: normalizeString(operatorLessons.lessonsPath, base.operatorLessons.lessonsPath)
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
  const operatorLessons = normalizeObject(raw.operatorLessons);
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
      operatorLessons: {
        ...base.operatorLessons,
        ...operatorLessons,
        lessonCount: normalizeNumber(operatorLessons.lessonCount, base.operatorLessons.lessonCount),
        activeLessonCount: normalizeNumber(operatorLessons.activeLessonCount, base.operatorLessons.activeLessonCount),
        topLessonIds: normalizeStringArray(operatorLessons.topLessonIds),
        topTags: normalizeStringArray(operatorLessons.topTags),
        topDomains: normalizeStringArray(operatorLessons.topDomains),
        overview: normalizeString(operatorLessons.overview, base.operatorLessons.overview),
        lessonsPath: normalizeString(operatorLessons.lessonsPath, base.operatorLessons.lessonsPath)
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
    version: 9,
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
      command: "project:dove.orchestrate",
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
      operatorLessons: summarizeOperatorLessons([]),
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
      safeExecutionPath: "project:dove.follow-through -> project:dove.launch -> node ./bin/dove.mjs autonomy-foreground . --max-steps 5",
      overview: "Unified autonomy loop skeleton is explicit, file-first, and foreground-only."
    },
    lifecycle: normalizeWorkspaceLifecycle(),
    dove: createDoveWorkspaceKernel(),
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
  const doveBootstrapOnlyPaths = [
    ".dove/README.md",
    ".dove/project.md",
    ".dove/contracts/research-contract.md",
    ".dove/orchestration/board.json",
    ".dove/orchestration/handoffs.md",
    ".dove/task-packets/index.json",
    ".dove/research/brief.md",
    ".dove/research/agenda.json",
    ".dove/plans/current-plan.md",
    ".dove/outline/current-outline.md",
    ".dove/findings.md",
    ".dove/experiments/EXPERIMENT_LOG.md",
    ".dove/experiments/plans.json",
    ".dove/experiments/results.json",
    ".dove/experiments/audits.json",
    ".dove/sources/index.json",
    ".dove/notes/index.json",
    ".dove/evidence/index.json",
    ".dove/claims/CLAIMS_FROM_RESULTS.md",
    ".dove/claims/bridge-log.json",
    ".dove/reviews/log.md",
    ".dove/reviews/REVIEW_STATE.json",
    ".dove/reviews/concerns.json",
    ".dove/reviews/debate-log.md",
    ".dove/reviews/adversarial-state.json",
    ".dove/revision-plans/current-plan.md",
    ".dove/wiki/index.md",
    ".dove/wiki/query_pack.md",
    ".dove/wiki/navigation.md",
    ".dove/wiki/entities.json",
    ".dove/wiki/relations.json",
    ".dove/checklists/current.md",
    ".dove/bibliography/references.bib",
    ".dove/bibliography/citation-log.md",
    ".dove/figures/README.md",
    ".dove/figures/index.json",
    ".dove/figures/briefs.json",
    ".dove/figures/segments.json",
    ".dove/figures/templates.json",
    ".dove/figures/editable-index.json",
    ".dove/figures/final-index.json",
    ".dove/figures/qa.json",
    ".dove/rebuttal/issues.json",
    ".dove/rebuttal/strategy.md",
    ".dove/rebuttal/response-draft.md",
    ".dove/versions/index.json",
    ".dove/versions/comparisons.json",
    ".dove/versions/LATEST_COMPARISON.md",
     ".dove/meta/events.json",
     ".dove/meta/long-horizon-memory.json",
      ".dove/meta/operator-lessons.json",
      ".dove/meta/operator-playbooks.json",
     ".dove/meta/remediation-packs.json",
     ".dove/meta/recommendations.json",
    ".dove/meta/optimizer-state.json",
    ".dove/meta/LATEST_OPTIMIZER_REPORT.md",
    ".dove/runtime/controller-state.json",
    ".dove/runtime/leases.json",
    ".dove/runtime/events.json",
    ".dove/runtime/results.json",
    ".dove/programs/index.json",
    ".dove/programs/runs.json",
    ".dove/programs/approvals.json",
    ".dove/sessions/journal.json",
    ".dove/sessions/LATEST_SUMMARY.md",
    ".dove/workspace/index.json",
    ".dove/manifest.json",
    ".dove/workflow-pack/boundaries.json"
  ];
  return {
    version: 3,
    primaryRoleIds: PRIMARY_ROLE_IDS,
    subagentRoleIds: SUBAGENT_ROLE_IDS,
    roleHierarchy: ROLE_HIERARCHY,
    neutralCorePaths: CORE_INSTALL_PATHS,
    defaultHostAdapters: DEFAULT_HOST_ADAPTERS,
    availableHostAdapters: HOST_IDS,
    managedHostAdapterPaths: MANAGED_HOST_ADAPTER_PATHS,
    managedPaths: MANAGED_PACKAGE_PATHS,
    doveBootstrapOnlyPaths,
    userOwnedPaths: [
      ".dove/drafts",
      ".dove/sources",
      ".dove/notes",
      ".dove/evidence",
      ".dove/experiments",
      ".dove/reviews",
      ".dove/rebuttal",
      ".dove/versions/snapshots",
      ".dove/task-packets/packets",
    ".dove/context/roles",
    ".dove/context/phases",
    ".dove/context/packets",
      ".dove/context/artifacts",
      ".dove/context/actions",
      ".dove/sessions",
      ARTIFACT_PATHS.metaOperatorLessons,
      ARTIFACT_PATHS.workspaceArtifactMap
    ],
    managedArtifacts: {
      codePack: createManagedArtifactMeta("managed-replaceable", "src"),
      workflowBoundaries: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workflowBoundaries),
      workspaceIndex: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workspaceIndex),
      doveRootManifest: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.doveRootManifest),
      operatorLessons: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.metaOperatorLessons),
      programsIndex: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.programsIndex),
      programRuns: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.programRuns),
      programApprovals: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.programApprovals)
    },
    notes: [
      "Pack installs and syncs should bootstrap missing .dove artifacts but should not overwrite user-authored workspace state.",
      ".dove remains the durable source of truth and is treated as workspace data, not a managed code payload.",
      "Managed replaceable code and bootstrap-only workspace artifacts now advertise revision/template metadata for clearer reconciliation."
    ],
    updatedAt: null
  };
}
