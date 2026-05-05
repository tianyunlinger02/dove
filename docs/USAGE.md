# Usage

## Product model

Dove is a local-first mission workflow system for paper, engineering, experiment, review, and general research work.

- **Commands** drive the workflow.
- **Skills** encode durable role behavior.
- **MCP** provides deterministic state queries and mutations.
- **`.dove/`** keeps the workflow resumable and auditable.
- **`.dove/manifest.json`** records Dove authority for the workspace.
- **Dove mission metadata** under `.dove/workspace/index.json.dove` keeps one shared mission lifecycle without splitting paper and engineering into separate products.

## Board-first orchestration

`project:dove.paper.orchestrate` is the paper-domain routing entrypoint. It reads the current `.dove` context, classifies the request by paper lifecycle family, and recommends one next command; it does not update the board, append handoffs, refresh packets, or apply downstream mutations.

`project:dove.orchestrate` frames durable state as one Dove mission with a domain (`paper`, `engineering`, `experiment`, `review`, or `general`) and lifecycle stage (`goal`, `design`, `checklist`, `execution`, `audit`, or `return`).

The general Dove surfaces are:

- `project:dove.orchestrate` / `dove orchestrate`
- `project:dove.mission` / `dove mission`
- `project:dove.board` / `dove board`
- `project:dove.audit` / `dove audit`
- `project:dove.return` / `dove return`
- `project:dove.launch` / `dove launch`

The five query surfaces are read-only and proposal-only. They do not set phases, update roles, refresh derived workspace state, run tests, inspect git, execute autonomy, or create packets. `dove launch` is the governed write surface: it materializes accepted proposal guidance into `.dove/task-packets`, requires `sourceType`, `sourceId`, `executeBy`, and `reviewAfter`, and does not execute the work.

Normal engineering work uses the same mission fields rather than a separate product branch: mark the domain as `engineering`, list source/test/docs targets, and return declared changed-file paths plus declared test/validation evidence and validation output. Dove audit and return inspect only those declared project-local paths and durable packet links.

## Durable workspace

Dove uses a durable board-first orchestration model:

- `.dove/orchestration/board.json` is the canonical workflow board.
- `.dove/orchestration/handoffs.md` is the durable role-transition log.
- `.dove/task-packets/` stores mission/work packets linked to claims, experiments, rebuttal issues, versions, and engineering work.
- `.dove/context/roles/*.json` narrows context for each durable role.
- `.dove/context/phases/*.json` keeps phase queues and read order explicit.
- `.dove/context/packets/*.json` adds packet-scoped dependency, artifact, and resume bundles.
- `.dove/context/artifacts/*.json` adds artifact-scoped guidance tied to concrete paths.
- `.dove/context/actions/*.json` adds explicit pre-action bundles.
- `.dove/sessions/` keeps portable workspace summaries and journal entries.
- `.dove/workspace/index.json` gives a resumable top-level overview, work queues, dependency health, ownership summaries, and handoff obligations.
- `.dove/workspace/artifact-map.json` is an optional onboarding map for existing paper assets, written only by explicit `dove onboard . --write-map` or `dove migrate . --write-map`.
- `.dove/workspace/index.json.lifecycle` classifies work into `objective`, `structure`, `campaign`, `work-unit`, `concern`, `audit`, and `knowledge`.
- `.dove/workspace/index.json.dove` mirrors the same workspace as a unified Dove mission kernel.
- `.dove/meta/` records proposal-only optimization signals, ranked workflow recommendations, remediation packs, and long-horizon workflow memory without auto-applying changes.

Commands and skills provide role behavior, but there is no hidden scheduler or swarm runtime. Optional MCP helpers mutate files deterministically; they do not replace `.dove/` as the source of truth.

## Strict mode

`init_project` supports `strictMode: true`. In strict mode, planning, outlining, and drafting enforce basic stage preconditions instead of only documenting the ideal workflow.

Strict mode is stage-based, not template-based. Starter files in `.dove/` do not count as completion by themselves; the pipeline must actually advance through source capture, notes, planning, and outlining.

## Durable pipeline

### 1. Initialize

Run `project:dove.paper.init` to establish title, venue, thesis, audience, and the research contract.

For an existing paper repository, run `dove onboard .` or `dove migrate .` before importing or rewriting artifacts. The default scan is proposal-only and writes nothing; `--write-map` persists only `.dove/workspace/artifact-map.json` as a reference map.

### 2. Orchestrate the next role-owned phase

Run `project:dove.paper.orchestrate` or `project:dove.orchestrate` to route to exactly one next command from durable context. Use `project:dove.mission` or `dove mission .` when you want a no-write mission contract, `project:dove.board` or `dove board .` for an as-read mission-board view, `project:dove.audit` or `dove audit .` for proposal-only audit plus return-readiness inspection, and `project:dove.return` or `dove return .` before closure.

Use `project:dove.launch` or `dove launch .` only after accepting a proposal source and setting an execution/review window; it creates a governed mission packet but does not execute the work.

### 3. Register sources and deepen research

Run `project:dove.paper.research` and `project:dove.paper.source` to add sources into `.dove/sources/index.json` and keep `.dove/research/brief.md` plus `.dove/research/agenda.json` current.

### 4. Capture notes

Run `project:dove.paper.note` to store section-linked notes, quotes, candidate claims, and open questions in `.dove/notes/index.json`.

### 5. Promote claims

Run `project:dove.paper.claim-gate` to move findings into `.dove/evidence/index.json` and `.dove/claims/CLAIMS_FROM_RESULTS.md` only when they are linked to evidence.

### 6. Plan and outline

Use `project:dove.paper.plan` and `project:dove.paper.outline` to convert the evidence base into a writing plan and section structure.

For major paper changes, `project:dove.paper.plan` is the `design` stage: it must state scope, non-goals, risks, target artifacts, required evidence, and acceptance checks before implementation starts.

### 7. Draft

Use `project:dove.paper.draft` for section-level drafting. If evidence is missing, leave `TODO[citation]` markers instead of fabricating support.

### 8. Plan experiments, record results, audit them, and bridge results to claims

Use `project:dove.paper.experiment-plan`, `project:dove.paper.experiment-audit`, and `project:dove.paper.result-bridge` to keep `.dove/experiments/plans.json`, `.dove/experiments/results.json`, `.dove/experiments/audits.json`, `.dove/claims/bridge-log.json`, and `.dove/experiments/EXPERIMENT_LOG.md` claim-driven and durable.

### 9. Review loop

Use `project:dove.paper.audit` when you want strict no-fix inspection. It reports evidence, citation, experiment, claim-bridge, review, version, figure, checklist, and artifact integrity findings with proposal-only next commands; it does not write, repair, refresh, materialize, update the board, append handoffs, generate revision plans, or run review loops.

Use `project:dove.paper.review-loop` to generate a durable review entry and revision plan. The review loop checks unsupported claims, weakly supported claims, citation TODOs, state/draft mismatches, experiment audit flags, and result-to-claim bridge problems.

Use `project:dove.paper.isolated-review` when you want a parallel reviewer session that cannot see the writer/main session's private transcript. The slash command prepares `.dove/reviews/isolated/<run-id>/input.json`, invokes the configured external reviewer command, imports only `handoff.json` and `report.md`, and returns the verdict plus top concerns.

### 10. Rebuttal strategy and versioning

Use `project:dove.paper.rebuttal-strategy` to normalize reviewer issues before `project:dove.paper.rebuttal`. Use `project:dove.paper.version-snapshot` and `project:dove.paper.version-compare` to preserve paper evolution honestly.

### 11. Revise and close the loop

Use `project:dove.paper.revise`, `project:dove.paper.checklist`, `project:dove.paper.citations`, and `project:dove.paper.rebuttal` as needed.

Major paper changes close through `design → checklist → implementation → acceptance`:

1. `project:dove.paper.plan` records the design contract.
2. `project:dove.paper.checklist` turns it into executable steps and acceptance checks.
3. Draft, revision, experiment, result-bridge, figure, citation, or rebuttal commands implement only scoped checklist work.
4. Review, checklist, snapshot, and comparison commands provide acceptance evidence.

## Query and navigation surfaces

Use these file-backed inspection commands when you need to understand the workspace before acting:

- `project:dove.paper.task-graph` for packet/dependency navigation
- `project:dove.paper.open-questions` for unresolved research/review uncertainty
- `project:dove.paper.decisions` for durable operational and comparison decisions
- `project:dove.paper.lineage` for version/comparison lineage
- `project:dove.paper.meta-optimize` for the proposal-only optimization frontier and recommendations
- `project:dove.paper.audit` for strict no-fix paper inspection
- `project:dove.orchestrate`, `project:dove.mission`, `project:dove.board`, `project:dove.audit`, and `project:dove.return` for proposal-only Dove routing, mission, board, audit, and return JSON queries
- `project:dove.launch` / `launch_dove_mission` for governed launch of one accepted Dove mission into `.dove/task-packets`
- `project:dove.paper.onboard` plus `dove onboard` / `dove migrate` for proposal-first artifact mapping
- `project:dove.paper.follow-through` for explicit operator handling of proposal-only remediation guidance
- `project:dove.paper.materialize` for explicit proposal-to-task-packet materialization once guidance is accepted
- `dove autonomy-once` / `run_autonomy_once` for one explicit planner-owned autonomous control-plane pass
- `project:dove.paper.governance-audit` for the durable governance coverage proof report

Paper navigation commands refresh `.dove/wiki/navigation.md`, `.dove/task-packets/index.json`, `.dove/context/roles/*.json`, `.dove/context/phases/*.json`, `.dove/context/packets/*.json`, `.dove/workspace/index.json`, and `.dove/sessions/LATEST_SUMMARY.md`. General Dove query surfaces stay no-refresh and proposal-only.

## Bounded autonomy

The autonomy loop is explicit and bounded:

1. inspect proposals and request state through follow-through and workspace surfaces
2. record or update explicit execution intent in `.dove/meta/operator-follow-through.json`
3. inspect or issue explicit approvals through `.dove/programs/approvals.json` when a packet is program-linked
4. materialize one accepted path explicitly, or let `dove autonomy-once` invoke the same governed materialization bridge once when eligible
5. run `dove autonomy-once` to advance at most one bounded control-plane delta
6. run `dove autonomy-foreground` for one explicit foreground pass that may continue a same-lineage approved packet/run envelope until it hits a stop condition
7. inspect `.dove/workspace/index.json`, `.dove/runtime/*.json`, `.dove/programs/*.json`, and follow-through surfaces for checkpoints and review-needed handoff state

This is not a hidden background runtime. Program state is durable and inspectable, but it is not a scheduler.

For deeper local-context discipline, read the nearest generated surfaces before acting:

- `.dove/context/actions/current.json`
- `.dove/context/actions/role-*.json`
- `.dove/context/actions/packet-*.json`
- `.dove/context/artifacts/*.json`

These files are explicit helper surfaces. They do not imply automatic host-side loading.

## MCP tools

The optional MCP layer exposes deterministic helpers, including:

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
- `query_paper_audit`
- `query_dove_orchestrate`
- `query_dove_mission`
- `query_dove_mission_board`
- `query_dove_audit`
- `query_dove_return`
- `launch_dove_mission`
- `read_role_context_manifest`
- `read_phase_context_manifest`
- `read_packet_context_manifest`
- `read_artifact_context_manifest`
- `read_action_context_bundle`
- `summarize_session_journal`
- paper-domain mutation tools for research, notes, claims, experiments, drafts, review, rebuttal, versions, figures, citations, checklists, follow-through, materialization, and autonomy

## Role model

The user-facing role model has three primary manual agents:

- `planner` owns direction, priority, orchestration, governance, and autonomy boundaries.
- `builder` owns writing, research, experiments, results, revision, rebuttal drafting, implementation, and evidence work.
- `reviewer` owns independent concerns, weaknesses, evidence/method attacks, code review, QA, and verdicts.

Specialists such as `researcher`, `experiment-planner`, `revision-lead` / `rebuttal-lead`, and `version-analyst` are automatic subagents under those primary agents. They are useful for scoped context, but they should not be treated as peer manual identities.

## Skills

The bundled skills are intentionally small and portable:

- `dove-pipeline`
- `dove-planner`
- `dove-researcher` (builder-side subagent)
- `dove-reviewer`
- `dove-rebuttal-strategist` (builder-side revision/rebuttal subagent)
- `dove-experiment-planning` (builder-side subagent)
- `dove-version-analyst` (planner-side audit subagent)
- `dove-claim-gate`
- `dove-review-loop`
- `dove-citation-discipline`
- `dove-rebuttal`

They reinforce the workflow; they do not replace `.dove/` artifacts or imply a hidden orchestrator.
