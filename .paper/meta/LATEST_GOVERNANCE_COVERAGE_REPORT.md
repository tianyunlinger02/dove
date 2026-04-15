# Governance coverage report

- Generated: 2026-04-15T06:50:06.480Z
- Status: ok
- Guarded mutations: 25
- Exempt mutations: 10
- Overview: 25 write paths currently require clear operator follow-through; 10 paths remain explicitly exempt.

## Guarded surfaces

- upsert-orchestration-board: upsertOrchestrationBoard / upsert_orchestration_board / paper.orchestrate
- append-handoff: appendHandoff / append_handoff / paper.orchestrate
- register-source: registerSource / register_source / paper.source
- upsert-note: upsertNote / upsert_note / paper.note
- upsert-claims: upsertClaims / upsert_claims / paper.claim-gate
- upsert-plan: upsertPlan / upsert_plan / paper.plan
- upsert-outline: upsertOutline / upsert_outline / paper.outline
- upsert-draft: upsertDraft / upsert_draft / paper.draft
- set-section-status: setSectionStatus / set_section_status / paper.draft, paper.revise
- upsert-figure-plan: upsertFigurePlan / upsert_figure_plan / paper.figure
- sync-citations: syncCitations / sync_citations / paper.citations
- refresh-wiki: refreshWiki / refresh_wiki / paper.wiki
- build-rebuttal: buildRebuttal / build_rebuttal / paper.rebuttal
- append-review-log: appendReviewLog / append_review_log / paper.review
- upsert-revision-plan: upsertRevisionPlan / upsert_revision_plan / paper.revise
- run-review-loop: runReviewLoop / run_review_loop / paper.review-loop
- update-research-brief: updateResearchBrief / update_research_brief / paper.research
- upsert-experiment-plan: upsertExperimentPlan / upsert_experiment_plan / paper.experiment-plan
- upsert-experiment-result: upsertExperimentResult / upsert_experiment_result / paper.experiment-plan
- run-experiment-audit: runExperimentAudit / run_experiment_audit / paper.experiment-audit
- bridge-experiment-result-to-claim: bridgeExperimentResultToClaim / bridge_result_to_claim / paper.result-bridge
- normalize-rebuttal-issues: normalizeRebuttalIssues / normalize_rebuttal_issues / paper.rebuttal-strategy
- build-rebuttal-strategy: buildRebuttalStrategy / build_rebuttal_strategy / paper.rebuttal-strategy
- create-version-snapshot: createVersionSnapshot / create_version_snapshot / paper.version-snapshot
- compare-versions: compareVersions / compare_versions / paper.version-compare

## Exempt surfaces

- record-operator-follow-through: recordOperatorFollowThrough / record_operator_follow_through / paper.follow-through | owner=planner | approvedBy=planner | cadence=per-session | sunset=2099-12-31T00:00:00.000Z
- query-meta-optimize: queryMetaOptimize / query_meta_optimize / paper.meta-optimize | owner=planner | approvedBy=planner | cadence=per-session | sunset=2099-12-31T00:00:00.000Z
- init-project: initProject / init_project / paper.init | owner=planner | approvedBy=planner | cadence=per-project | sunset=2099-12-31T00:00:00.000Z
- sync-checklist: syncChecklist / sync_checklist / paper.checklist | owner=planner | approvedBy=planner | cadence=per-session | sunset=2099-12-31T00:00:00.000Z
- validate-figure-pipeline: validateFigurePipeline / validate_figure_pipeline / paper.figure | owner=researcher | approvedBy=researcher | cadence=per-change | sunset=2099-12-31T00:00:00.000Z
- classify-workflow-intent: classifyWorkflowIntent / query_meta_optimize / paper.meta-optimize | owner=planner | approvedBy=planner | cadence=per-session | sunset=2099-12-31T00:00:00.000Z
- load-board: loadBoard / query_workspace_index / paper.orchestrate | owner=planner | approvedBy=planner | cadence=per-release | sunset=2099-12-31T00:00:00.000Z
- save-board: saveBoard / upsert_orchestration_board / paper.orchestrate | owner=planner | approvedBy=planner | cadence=per-release | sunset=2099-12-31T00:00:00.000Z
- refresh-durable-surfaces: refreshDurableSurfaces / query_workspace_index / paper.meta-optimize, paper.task-graph, paper.open-questions, paper.decisions, paper.lineage | owner=planner | approvedBy=planner | cadence=per-session | sunset=2099-12-31T00:00:00.000Z
- summarize-session-journal: summarizeSessionJournal / query_meta_optimize / paper.meta-optimize | owner=planner | approvedBy=planner | cadence=per-session | sunset=2099-12-31T00:00:00.000Z

## Exempt review metadata

- record-operator-follow-through: approvedAt=2026-04-15T00:00:00.000Z | lastReviewedAt=2026-04-15T00:00:00.000Z | reviewCadence=per-session
- query-meta-optimize: approvedAt=2026-04-15T00:00:00.000Z | lastReviewedAt=2026-04-15T00:00:00.000Z | reviewCadence=per-session
- init-project: approvedAt=2026-04-15T00:00:00.000Z | lastReviewedAt=2026-04-15T00:00:00.000Z | reviewCadence=per-project
- sync-checklist: approvedAt=2026-04-15T00:00:00.000Z | lastReviewedAt=2026-04-15T00:00:00.000Z | reviewCadence=per-session
- validate-figure-pipeline: approvedAt=2026-04-15T00:00:00.000Z | lastReviewedAt=2026-04-15T00:00:00.000Z | reviewCadence=per-change
- classify-workflow-intent: approvedAt=2026-04-15T00:00:00.000Z | lastReviewedAt=2026-04-15T00:00:00.000Z | reviewCadence=per-session
- load-board: approvedAt=2026-04-15T00:00:00.000Z | lastReviewedAt=2026-04-15T00:00:00.000Z | reviewCadence=per-release
- save-board: approvedAt=2026-04-15T00:00:00.000Z | lastReviewedAt=2026-04-15T00:00:00.000Z | reviewCadence=per-release
- refresh-durable-surfaces: approvedAt=2026-04-15T00:00:00.000Z | lastReviewedAt=2026-04-15T00:00:00.000Z | reviewCadence=per-session
- summarize-session-journal: approvedAt=2026-04-15T00:00:00.000Z | lastReviewedAt=2026-04-15T00:00:00.000Z | reviewCadence=per-session

## Uncovered bindings

- Tools: none
- Commands: none
- Core functions: none
- Negative coverage gaps: none