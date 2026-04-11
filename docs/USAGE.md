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
- Commands and skills provide role behavior, but there is **no hidden scheduler or swarm runtime**.
- Optional MCP helpers mutate those files deterministically; they do not replace them as the source of truth.

## Strict mode

`init_project` supports `strictMode: true`. In strict mode, planning, outlining, and drafting enforce basic stage preconditions instead of only documenting the ideal workflow.

Strict mode is stage-based, not template-based. Starter files in `.paper/` do not count as completion by themselves; the pipeline must actually advance through source capture, notes, planning, and outlining.

## Durable pipeline

### 1. Initialize

Run `project:paper.init` to establish title, venue, thesis, audience, and the research contract.

### 2. Orchestrate the next role-owned phase

Run `project:paper.orchestrate` to set the current phase, assigned role, tasks, blockers, evidence links, experiment IDs, rebuttal issue IDs, version lineage, and active comparison targets.

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

### 8. Plan experiments and record results

Use `project:paper.experiment-plan` to keep `.paper/experiments/plans.json`, `.paper/experiments/results.json`, and `.paper/experiments/EXPERIMENT_LOG.md` claim-driven and durable.

### 9. Review loop

Use `project:paper.review-loop` to generate a durable review entry and revision plan. The review loop checks unsupported claims, weakly supported claims, citation TODOs, and state/draft mismatches.

### 10. Rebuttal strategy and versioning

Use `project:paper.rebuttal-strategy` to normalize reviewer issues before `project:paper.rebuttal`. Use `project:paper.version-snapshot` and `project:paper.version-compare` to preserve paper evolution honestly.

### 11. Revise and close the loop

Use `project:paper.revise`, `project:paper.checklist`, `project:paper.citations`, and `project:paper.rebuttal` as needed.

## MCP tools

The optional MCP layer exposes deterministic helpers:

- `ensure_workspace`
- `init_project`
- `read_state`
- `upsert_orchestration_board`
- `append_handoff`
- `update_research_brief`
- `register_source`
- `upsert_note`
- `upsert_claims`
- `upsert_experiment_plan`
- `upsert_experiment_result`
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
