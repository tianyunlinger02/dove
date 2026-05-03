# Usage

## Product model

`paper_factory` is a local-first academic writing system for OpenCode.

- **Commands** drive the workflow.
- **Skills** encode durable role behavior.
- **MCP** provides deterministic state mutations.
- **`.paper/`** keeps the workflow resumable and auditable.

## Board-first orchestration

`paper_factory` now uses a durable board-first orchestration model:

- `.paper/orchestration/board.json` is the canonical, machine-checkable workflow board.
- `.paper/orchestration/handoffs.md` is the durable role-transition log.
- `.paper/task-packets/` stores durable task/work packets linked to claims, experiments, rebuttal issues, and versions.
- `.paper/context/roles/*.json` narrows the context surface for each durable role.
- `.paper/context/phases/*.json` keeps the current phase queue and read order explicit.
- `.paper/context/packets/*.json` adds packet-scoped context bundles with dependency health, linked artifacts, and resume coupling.
- `.paper/context/artifacts/*.json` adds artifact-scoped guidance tied to concrete durable paths.
- `.paper/context/actions/*.json` adds explicit pre-action bundles that tell commands which local context files to read first.
- `.paper/sessions/` keeps portable workspace summaries and journal entries.
- `.paper/workspace/index.json` gives a resumable top-level workspace overview, work queues, dependency health, ownership summaries, and handoff obligations.
- `.paper/workspace/index.json` now also carries a compact `repairFrontier` so degraded typed-wiki relations and related managed artifact issues stay visible in the same outer-loop surface, including relation-family taxonomy rollups when the wiki degrades.
- `.paper/meta/` adds a proposal-only meta-optimize layer that records derived signal observations, grouped optimization clusters, evidence-backed ranked workflow recommendations, durable remediation packs, and longer-horizon workflow memory without auto-applying changes.
- Commands and skills provide role behavior, but there is **no hidden scheduler or swarm runtime**.
- Optional MCP helpers mutate those files deterministically; they do not replace them as the source of truth.

## Strict mode

`init_project` supports `strictMode: true`. In strict mode, planning, outlining, and drafting enforce basic stage preconditions instead of only documenting the ideal workflow.

Strict mode is stage-based, not template-based. Starter files in `.paper/` do not count as completion by themselves; the pipeline must actually advance through source capture, notes, planning, and outlining.

## Durable pipeline

### 1. Initialize

Run `project:paper.init` to establish title, venue, thesis, audience, and the research contract.

### 2. Orchestrate the next role-owned phase

Run `project:paper.orchestrate` to set the current phase, intent type, assigned role, current focus, next action, continuation state, tasks, blockers, evidence links, experiment IDs, rebuttal issue IDs, version lineage, and active comparison targets.

### 3. Register sources and deepen research

Run `project:paper.research` and `project:paper.source` to add sources into `.paper/sources/index.json` and keep `.paper/research/brief.md` plus `.paper/research/agenda.json` current.

### 4. Capture notes

Run `project:paper.note` to store section-linked notes, quotes, candidate claims, and open questions in `.paper/notes/index.json`.

### 5. Promote claims

Run `project:paper.claim-gate` to move findings into `.paper/evidence/index.json` and `.paper/claims/CLAIMS_FROM_RESULTS.md` only when they are linked to evidence.

### 6. Plan and outline

Use `project:paper.plan` and `project:paper.outline` to convert the evidence base into a writing plan and section structure.

### 7. Draft

Use `project:paper.draft` for section-level drafting. If evidence is missing, leave `TODO[citation]` markers instead of fabricating support.

### 8. Plan experiments, record results, audit them, and bridge results to claims

Use `project:paper.experiment-plan`, `project:paper.experiment-audit`, and `project:paper.result-bridge` to keep `.paper/experiments/plans.json`, `.paper/experiments/results.json`, `.paper/experiments/audits.json`, `.paper/claims/bridge-log.json`, and `.paper/experiments/EXPERIMENT_LOG.md` claim-driven and durable.

### 9. Review loop

Use `project:paper.review-loop` to generate a durable review entry and revision plan. The review loop checks unsupported claims, weakly supported claims, citation TODOs, state/draft mismatches, experiment audit flags, and result-to-claim bridge problems.

Use `project:paper.isolated-review` when you want a parallel reviewer session that cannot see the writer/main session's private transcript. The slash command prepares `.paper/reviews/isolated/<run-id>/input.json`, invokes the configured external reviewer command, imports only `handoff.json` and `report.md`, and returns the verdict plus top concerns to the current session.

### 10. Rebuttal strategy and versioning

Use `project:paper.rebuttal-strategy` to normalize reviewer issues before `project:paper.rebuttal`. Use `project:paper.version-snapshot` and `project:paper.version-compare` to preserve paper evolution honestly.

### 11. Revise and close the loop

Use `project:paper.revise`, `project:paper.checklist`, `project:paper.citations`, and `project:paper.rebuttal` as needed.

## Query and navigation surfaces

The workflow is no longer lifecycle-only. Use these file-backed inspection commands when you need to understand the workspace before taking action:

- `project:paper.task-graph` for packet/dependency navigation
- `project:paper.open-questions` for unresolved research/review uncertainty
- `project:paper.decisions` for durable operational and comparison decisions
- `project:paper.lineage` for version/comparison lineage
- `project:paper.meta-optimize` for the proposal-only optimization frontier and recommendations
- `project:paper.follow-through` for explicit operator handling of proposal-only remediation guidance
- `project:paper.materialize` for explicit proposal-to-task-packet materialization once guidance is accepted
- `paper-factory autonomy-once` / `run_autonomy_once` for one explicit planner-owned autonomous control-plane pass after requests and materialization are in place
- `project:paper.governance-audit` for the durable governance coverage proof report

These commands refresh `.paper/wiki/navigation.md`, `.paper/task-packets/index.json`, `.paper/context/roles/*.json`, `.paper/context/phases/*.json`, `.paper/context/packets/*.json`, `.paper/workspace/index.json`, and `.paper/sessions/LATEST_SUMMARY.md` without introducing unsupported host hooks.

The meta-optimize command also refreshes `.paper/meta/events.json`, `.paper/meta/long-horizon-memory.json`, `.paper/meta/operator-playbooks.json`, `.paper/meta/remediation-packs.json`, `.paper/meta/execution-bridge-candidates.json`, `.paper/meta/recommendations.json`, `.paper/meta/optimizer-state.json`, and `.paper/meta/LATEST_OPTIMIZER_REPORT.md` from existing durable signals such as the session journal, review concerns, experiment audits, claim bridges, figure QA, version comparisons, board state, and workspace state. The resulting frontier is grouped into operator-meaningful clusters and ranked deterministically so related debt stays visible together, with a persisted frontier summary, top-cluster rollup, taxonomy-aware pressure summaries (for example evidence-grounding, validation-loop, or review-pressure), durable remediation packs that bundle linked evidence plus ranked multi-path conversion guidance, family-level operator playbooks derived from those packs plus longer-horizon memory, proposal-only execution bridge candidate scaffolds that suggest manual work-item shapes, readiness/coverage diagnostics that show how actionable each bundle is, explicit artifact update maps and target orders for the playbook layer, ranking method, and stable tie-break order.

When typed wiki relations or staged figure artifacts degrade, the repair frontier is surfaced directly through `.paper/workspace/index.json`, `.paper/wiki/navigation.md`, and `.paper/sessions/LATEST_SUMMARY.md` rather than through a hidden optimizer runtime. Typed wiki degradation now keeps family/group taxonomy summaries durable so operators can see whether evidence-grounding, validation, or review-pressure relation families are slipping. Remediation packs keep that same frontier grouped with linked review concerns, figure QA, long-horizon memory, packet/workspace/context pointers, pack-level acceptance criteria, ranked packet/checklist/revision conversion paths, readiness diagnostics, and explicit manual next actions without auto-creating tasks or applying repairs. Family-level operator playbooks then aggregate those pack-level recommendations back to the taxonomy family, use packet/role/taxonomy specificity to surface the most relevant playbook when multiple families are active, and add proposal-only artifact update maps so operators can see which files should be reviewed first and in what order. Execution bridge candidate scaffolds finally reduce the gap to concrete manual work-item formation by suggesting likely packet/checklist/revision/review/figure follow-up shapes while staying fully proposal-only, and now carry compact linked packet/workspace/remediation/evidence context so operators can act with less file hunting. When a packet path is accepted, `project:paper.materialize` / `materialize_guidance_packet` is the explicit governed bridge that creates one real task packet and records the provenance-bound follow-through linkage.

The current autonomy loop is also explicit and bounded:

1. inspect proposals and request state through follow-through and workspace surfaces
2. record or update explicit execution intent in `.paper/meta/operator-follow-through.json`
3. when a packet is program-linked, inspect or issue one explicit approval through `.paper/programs/approvals.json` before the next bounded step
4. either materialize one accepted path explicitly, or let `paper-factory autonomy-once` / `run_autonomy_once` invoke the same governed materialization bridge once when no eligible packet already exists
5. run `paper-factory autonomy-once` or `run_autonomy_once` to advance at most one bounded control-plane delta
6. or run `paper-factory autonomy-foreground` / `run_autonomy_foreground` for one explicit foreground pass that may continue the same-lineage `execute-materialized-packet` continuation or drain one bounded program-scoped authority envelope until it hits a stop condition such as review-needed, approval exhaustion, error, or `maxSteps`
7. inspect `.paper/workspace/index.json`, `.paper/runtime/*.json`, `.paper/programs/*.json`, and `project:paper.follow-through` for requests, checkpoints, consumed approvals, and review-needed handoff state

This remains an explicitly invoked control-plane pass, not a hidden background runtime. Even when `autonomy-once` materializes one planned target, it still stops after that governed bridge instead of silently draining more work. `autonomy-foreground` is still foreground-only and bounded: it may follow the same-lineage `execute-materialized-packet` continuation or continue one program-scoped bounded authority envelope in the same invocation, but it does not become a daemon, scheduler, or unbounded queue runner.

The current controller is also planner-supervised rather than planner-exclusive. When a packet carries an explicit autonomy envelope, planner may supervise one bounded packet-local step for a different worker role (for example researcher or reviewer) while preserving explicit follow-through, packet-local checkpoints, and review handoff. It does not become a general multi-agent executor or a free-form cross-role mutator.

Phase C adds the first program-level operating surface on top of that kernel:

- programs, program runs, and approvals are durable files under `.paper/programs/`
- program-linked packets can carry `programId`, `programRunId`, and `approvalId`
- one approved program run may authorize either one bounded step or one bounded multi-step authority envelope for one selected packet; the current allowlist is `refresh-research-brief`, `refresh-wiki`, `upsert-note`, `run-experiment-audit`, `bridge-result-to-claim`, and `run-review-loop`
- `autonomy-once` still executes at most one bounded delta, while `autonomy-foreground` may continue the same approved packet/run envelope across multiple bounded deltas until a declared stop condition is hit
- when a multi-step program envelope reaches its final bounded step, the runtime now records an explicit closure classification (`achieved`, `accepted-risk`, `blocked`, or `completed`) on the durable program/program-run state instead of only leaving a generic stop outcome
- that final closure is now also goal-aware in a minimal explicit way: if the declared `programObjective` clearly matches the final bounded step category, the runtime upgrades a generic final completion to `achieved` rather than leaving it at `completed`
- if a final bounded envelope completes without a clear objective match, the durable closure now records `objective-unsatisfied`; if the durable program state was already marked `superseded`, the final closure preserves `superseded` instead of pretending a fresh success state

Program-scoped autonomy can now also derive a bounded step sequence automatically when approvals or materialization requests set `autonomyPolicy=objective-aware-default` and omit `stepSequence`. In that mode the runtime builds a small explicit plan from `programObjective` plus any supplied step payload fields, then still executes it only through the normal explicit foreground path.

That derived plan is now phase-aware as well: the same objective can yield a shorter late-phase sequence when the board is already in `research`, `draft`, or `review`, instead of always prepending the same early-phase setup step.

After a successful approved program step, the run either stays active with remaining bounded authority or lands on a durable review checkpoint. Once the current authority envelope is exhausted, the approval is consumed and continuing the same program lineage after that `review-needed` boundary still requires a fresh approval/run path rather than silent reuse.

The next operator surface is therefore not a hidden loop but an explicit approval workflow: inspect approvals, issue one fresh approval for one bounded step, invoke `autonomy-once`, then inspect the resulting checkpoint before issuing the next approval. Program runs that land in `review-needed` now also carry a durable next approval intent so the next fresh approval can reuse the same lineage without manual restitching.

That means program state is now inspectable and durable, but it is not a background program scheduler.

For deeper local-context discipline, read the nearest generated surfaces before acting:

- `.paper/context/actions/current.json` for the current workspace-level pre-action bundle
- `.paper/context/actions/role-*.json` for role-scoped behavior guidance
- `.paper/context/actions/packet-*.json` for packet-scoped pre-action read order
- `.paper/context/artifacts/*.json` for artifact-local rules tied to actual paths

These files are explicit helper surfaces. They do not imply automatic host-side loading.

## MCP tools

The optional MCP layer exposes deterministic helpers:

- `ensure_workspace`
- `init_project`
- `read_state`
- `query_task_graph`
- `query_open_questions`
- `query_decisions`
- `query_lineage`
- `query_workspace_index`
- `query_meta_optimize`
- `query_governance_coverage_report`
- `query_operator_follow_through`
- `read_role_context_manifest`
- `read_phase_context_manifest`
- `read_packet_context_manifest`
- `read_artifact_context_manifest`
- `read_action_context_bundle`
- `summarize_session_journal`
- `upsert_orchestration_board`
- `append_handoff`
- `update_research_brief`
- `register_source`
- `upsert_note`
- `upsert_claims`
- `upsert_experiment_plan`
- `upsert_experiment_result`
- `run_experiment_audit`
- `bridge_result_to_claim`
- `upsert_plan`
- `upsert_outline`
- `upsert_draft`
- `run_review_loop`
- `append_review_log`
- `upsert_revision_plan`
- `set_section_status`
- `sync_checklist`
- `sync_citations`
- `refresh_wiki`
- `normalize_rebuttal_issues`
- `build_rebuttal_strategy`
- `build_rebuttal`
- `create_version_snapshot`
- `compare_versions`
- `list_artifacts`
- `upsert_figure_plan`
- `validate_figure_pipeline`
- `record_operator_follow_through`
- `materialize_guidance_packet`
- `run_autonomy_once`

## Skills

The bundled skills are intentionally small and portable:

- `paper-factory-pipeline`
- `paper-factory-planner`
- `paper-factory-researcher`
- `paper-factory-reviewer`
- `paper-factory-rebuttal-strategist`
- `paper-factory-experiment-planning`
- `paper-factory-version-analyst`
- `paper-factory-claim-gate`
- `paper-factory-review-loop`
- `paper-factory-citation-discipline`
- `paper-factory-rebuttal`

They exist to reinforce the workflow, not to replace the `.paper/` artifacts or pretend there is a hidden orchestrator.
