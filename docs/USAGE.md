# Usage

## Product model

Dove is a local-first mission workflow system for paper, engineering, experiment, review, and general research work.

- **Commands** drive the workflow and are generated for each supported host from `src/core/command-manifest.mjs`.
- **Skills** encode durable role behavior.
- **MCP** provides deterministic state queries and mutations.
- **`.dove/`** keeps the workflow resumable and auditable.
- **`.dove/manifest.json`** records Dove authority for the workspace.
- **Dove mission metadata** under the `dove` field in `.dove/workspace/index.json` keeps one shared mission lifecycle without splitting paper and engineering into separate products.

## First 10 minutes with Dove

1. Install Dove into the target project and run `dove doctor` to confirm the core, adapters, MCP entrypoint, and workspace artifacts are healthy.
2. Frame one mission with `dove orchestrate` or `dove mission`, setting the domain, lifecycle stage, target artifacts, and acceptance checks.
3. Use `project:dove.plan` and `project:dove.checklist` to turn the mission into scoped work.
4. Execute only the checklist scope, then use `dove audit` and `dove return` with declared changed-file, test-evidence, and validation-output paths.
5. If the finished task produced reusable experience, record one short lesson through `project:dove.lessons` or `record_operator_lesson`.

The lesson step is an explicit closure ritual, not automatic capture. Dove never imports raw runtime traces or turns lessons into work without a separate governed action.

## Board-first orchestration

`project:dove.orchestrate` is the single Dove routing entrypoint. It frames durable state as one mission with a domain (`paper`, `engineering`, `experiment`, `review`, or `general`) and lifecycle stage (`goal`, `design`, `checklist`, `execution`, `audit`, or `return`), then recommends one next command without updating the board, appending handoffs, refreshing packets, or applying downstream mutations.

The general Dove surfaces are generated for OpenCode, Claude Code, Codex, Cursor, and shared agent-skill hosts:

- `project:dove.orchestrate` / `dove orchestrate`
- `project:dove.mission` / `dove mission`
- `project:dove.status` / `dove status`
- `project:dove.plan`
- `project:dove.checklist`
- `project:dove.follow-through`
- `project:dove.launch` / `dove launch`
- `project:dove.approvals`
- `project:dove.lessons`
- `project:dove.onboard` / `dove onboard`
- `project:dove.autonomy-operate`
- `project:dove.audit` / `dove audit`
- `project:dove.return` / `dove return`
- `project:dove.governance-audit`

The direct query surfaces are proposal-only. They do not set phases, update roles, run tests, inspect git, execute autonomy, or create packets. `dove status` is the one public place to see the current mission, packet dependencies, paper lifecycle, open questions, decisions, version lineage, and navigation health. It may refresh derived navigation/status views, but it does not mutate source assets. `dove launch` is the governed write surface: it turns accepted proposal guidance into `.dove/task-packets`, requires `sourceType`, `sourceId`, `executeBy`, and `reviewAfter`, and does not execute the work.

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
- `.dove/workspace/artifact-map.json` is an optional onboarding map for existing paper assets, written only by explicit `dove onboard . --write-map`.
- `.dove/workspace/index.json.lifecycle` classifies work into `objective`, `structure`, `campaign`, `work-unit`, `concern`, `audit`, and `knowledge`.
- The `dove` field in `.dove/workspace/index.json` mirrors the same workspace as a unified Dove mission kernel.
- `.dove/checklists/current.md` is the active checklist for the current Dove mission.
- `.dove/meta/` records proposal-only optimization signals, ranked workflow recommendations, remediation packs, distilled operator lessons, and long-horizon workflow memory without auto-applying changes.
- `.dove/meta/operator-lessons.json` stores explicit, reference-only retrospectives: problem, decisions, pitfalls, validation, and next-time guidance.

Commands and skills provide role behavior, but there is no hidden scheduler or swarm runtime. Optional MCP helpers mutate files deterministically; they do not replace `.dove/` as the source of truth.

## Parallel task target resolution

Task-scoped writes bind to an existing durable packet before they mutate `.dove/` assets. A command or MCP call can provide `packetId`, `taskPacketId`, `missionPacketId`, or a natural-language target such as `target`, `packetTarget`, or `taskName`; Dove resolves that input against `.dove/task-packets` and linked packet context before writing research, notes, claims, plans, drafts, experiments, reviews, rebuttals, versions, or isolated-review handoffs.

Explicit conflicts are always rejected: if a packet id and linked artifact ids point at different durable packets, Dove refuses the write instead of guessing. If no durable packet exists, the write is rejected and the operator must launch or materialize a task packet first.

Ambiguous natural-language targets follow `.dove/state.json.settings.taskTargetResolution.autoSelect`. The default is `true`, so Dove selects the strongest packet candidate and records resolution evidence. Set it to `false` when you want strict confirmation mode; ambiguous task-scoped writes then stop and ask the operator to provide or confirm `packetId`.

## Strict mode

`init_project` supports `strictMode: true`. In strict mode, planning, outlining, and drafting enforce basic stage preconditions instead of only documenting the ideal workflow.

Strict mode is stage-based, not template-based. Starter files in `.dove/` do not count as completion by themselves; the pipeline must actually advance through source capture, notes, planning, and outlining.

## Durable pipeline

### 1. Initialize

Run `project:dove.paper.init` to establish title, venue, thesis, audience, and the research contract.

For an existing paper repository, run `project:dove.onboard` or `dove onboard .` before deciding what to adopt into the workflow. The host/MCP surface is proposal-only through `query_dove_onboarding`; the CLI default scan also writes nothing, and `dove onboard . --write-map` persists only `.dove/workspace/artifact-map.json` as a reference map.

### 2. Orchestrate the next role-owned phase

Run `project:dove.orchestrate` to route to exactly one next command from durable context. Use `project:dove.mission` or `dove mission .` when you want a no-write mission contract, `project:dove.status` or `dove status .` when you need to see where the workspace is, what is blocked, and what should happen next, `project:dove.audit` or `dove audit .` for proposal-only audit plus return-readiness inspection, and `project:dove.return` or `dove return .` before closure.

Use `project:dove.launch` or `dove launch .` only after accepting a proposal source and setting an execution/review window; it creates a governed mission packet but does not execute the work.

### 3. Register sources and deepen research

Run `project:dove.paper.research` and `project:dove.paper.source` to add sources into `.dove/sources/index.json` and keep `.dove/research/brief.md` plus `.dove/research/agenda.json` current.

### 4. Capture notes

Run `project:dove.paper.note` to store section-linked notes, quotes, candidate claims, and open questions in `.dove/notes/index.json`.

### 5. Promote claims

Run `project:dove.paper.claim-gate` to move findings into `.dove/evidence/index.json` and `.dove/claims/CLAIMS_FROM_RESULTS.md` only when they are linked to evidence.

### 6. Plan and outline

Use `project:dove.plan` for Dove mission design across paper, engineering, experiment, review, general, and shared workflow work.

For major paper changes, `project:dove.plan` must state manuscript structure, claims, citations, venue strategy, scope, non-goals, risks, target artifacts, required evidence, and acceptance checks before implementation starts. Use `project:dove.paper.outline` after the shared plan is clear enough to shape the manuscript.

### 7. Draft

Use `project:dove.paper.draft` for section-level drafting. If evidence is missing, leave `TODO[citation]` markers instead of fabricating support.

### 8. Plan experiments, record results, audit them, and bridge results to claims

Use `project:dove.paper.experiment` to plan experiments, record results, and audit whether the evidence supports the claim. Use `project:dove.paper.result-bridge` when a result is ready to change claim confidence or claim state. Together they keep `.dove/experiments/plans.json`, `.dove/experiments/results.json`, `.dove/experiments/audits.json`, `.dove/claims/bridge-log.json`, and `.dove/experiments/EXPERIMENT_LOG.md` claim-driven and durable.

### 9. Review loop

Use `project:dove.paper.audit` when you want strict no-fix inspection. It reports evidence, citation, experiment, claim-bridge, review, version, figure, checklist, and artifact integrity findings with proposal-only next commands; it does not write, repair, refresh, materialize, update the board, append handoffs, generate revision plans, or run review loops.

Use `project:dove.paper.review` to generate a durable review entry and revision plan. The review loop checks unsupported claims, weakly supported claims, citation TODOs, state/draft mismatches, experiment audit flags, and result-to-claim bridge problems.

Use `project:dove.paper.isolated-review` when you want a parallel reviewer session that cannot see the writer/main session's private transcript. The host/MCP surface prepares `.dove/reviews/isolated/<run-id>/input.json` and imports only `handoff.json` plus `report.md`; arbitrary external reviewer process execution remains CLI-only through `dove isolated-review --reviewer-command ...`.

### 10. Rebuttal strategy and versioning

Use `project:dove.paper.rebuttal` to normalize reviewer issues, choose a response strategy, and draft the rebuttal. Use `project:dove.paper.version` to snapshot manuscript state, compare versions, and inspect lineage so paper evolution stays honest.

### 11. Revise and close the loop

Use `project:dove.paper.revise`, `project:dove.checklist`, `project:dove.paper.citations`, and `project:dove.paper.rebuttal` as needed.

Major paper changes close through `design → checklist → implementation → acceptance`:

1. `project:dove.plan` records the mission design contract, including paper-specific manuscript, evidence, venue, and acceptance constraints when the domain is `paper`.
2. `project:dove.checklist` writes the active checklist at `.dove/checklists/current.md` and turns the design into executable steps and acceptance checks.
3. Draft, revision, experiment, result-bridge, figure, citation, or rebuttal commands implement only scoped checklist work.
4. Review, checklist, version, audit, and return commands provide acceptance evidence.

## Query and navigation surfaces

Use these file-backed inspection commands when you need to understand the workspace before acting:

- `project:dove.status` / `dove status` tells you where the mission is, which packets or dependencies are blocking progress, what paper lifecycle stage is ready, which questions and decisions are open, how versions relate, and which command is likely next.
- `project:dove.orchestrate` / `dove orchestrate` routes a new request to one next command without changing state.
- `project:dove.mission` / `dove mission` frames one no-write mission contract with artifacts and acceptance checks.
- `project:dove.paper.audit` runs strict no-fix paper inspection.
- `project:dove.audit` and `project:dove.return` inspect declared engineering or mission evidence before closure.
- `project:dove.paper.meta-optimize` reports proposal-only workflow optimization recommendations.
- `project:dove.onboard` / `query_dove_onboarding` plus `dove onboard` maps existing artifacts without moving or overwriting them.
- `project:dove.follow-through` records explicit operator handling of proposal-only remediation guidance.
- `project:dove.lessons` plus `query_operator_lessons` / `record_operator_lesson` preserves distilled retrospectives.
- `project:dove.launch` / `launch_dove_mission` turns accepted guidance into one governed mission packet under `.dove/task-packets`.
- `project:dove.approvals` inspects, issues, and revokes bounded program approvals.
- `project:dove.autonomy-operate` / `run_autonomy_operate` is the primary explicit bounded foreground operating surface.
- `dove autonomy-once` / `run_autonomy_once` runs one lower-level planner-owned control-plane pass when you need a single delta instead of the full operating surface.
- `project:dove.governance-audit` produces the durable governance coverage proof report.

Status and paper navigation helpers may refresh derived files such as `.dove/wiki/navigation.md`, `.dove/task-packets/index.json`, `.dove/context/roles/*.json`, `.dove/context/phases/*.json`, `.dove/context/packets/*.json`, `.dove/workspace/index.json`, and `.dove/sessions/LATEST_SUMMARY.md`. Those refreshes keep navigation current; they do not mutate source assets, execute work, run tests, or create mission packets.

## Lessons / retrospectives

Use `project:dove.lessons` or the MCP tools when a task closes and the reusable experience is worth preserving. Lessons are manual and explicit: they are not generated from hidden chat history, imported from raw task traces, or applied automatically to future work.

A lesson must include:

- `title`
- `problem`
- at least one `decisions` entry
- at least one `pitfalls` entry
- at least one `validation` entry
- at least one `nextTime` entry

The durable artifact is `.dove/meta/operator-lessons.json`. It is `referenceOnly`, `explicitOnly`, `noAutoCapture`, and `noAutoApply`. Dove surfaces its summary in workspace, session, navigation, meta-optimize, and operator-guidance bundles, but recording a lesson does not create packets, approvals, launches, or autonomy work.

Example MCP mutation payload:

```json
{
  "title": "Close tasks with distilled lessons",
  "problem": "Raw task traces are too noisy for future operators.",
  "decisions": ["Capture only reusable decisions."],
  "pitfalls": ["Do not cite ignored runtime trace folders."],
  "validation": ["Query lessons after recording."],
  "nextTime": ["Write the retrospective during return."],
  "domain": "engineering",
  "stage": "return",
  "actorRole": "planner",
  "tags": ["retrospective"],
  "sourceArtifacts": [".dove/sessions/LATEST_SUMMARY.md"]
}
```

`sourceArtifacts` must point at curated durable surfaces. Ignored raw runtime traces are rejected so local execution logs can stay disposable.

## Bounded autonomy

The autonomy loop is explicit and bounded:

1. inspect proposals and request state through follow-through and workspace surfaces
2. record or update explicit execution intent in `.dove/meta/operator-follow-through.json`
3. inspect, issue, or revoke explicit approvals through `project:dove.approvals` and `.dove/programs/approvals.json` when a packet is program-linked
4. use `project:dove.autonomy-operate` as the normal bounded autonomy entrypoint when you want Dove to compose planning, materialization, approval, execution, and stop summaries
5. use `dove autonomy-once` only for one lower-level control-plane delta
6. use `dove autonomy-foreground` only for an explicit lower-level foreground pass that continues an existing bounded packet/run envelope until it hits a stop condition
7. inspect `.dove/workspace/index.json`, `.dove/runtime/*.json`, `.dove/programs/*.json`, and follow-through surfaces for checkpoints and review-needed handoff state

This is not a hidden background runtime. Program state is durable and inspectable, but it is not a scheduler; `dove.autonomy-operate` is the ordinary user-facing surface, while `autonomy-once` and `autonomy-foreground` are lower-level CLI/MCP controls.

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
- `query_operator_lessons`
- `query_paper_audit`
- `query_paper_pipeline`
- `query_dove_onboarding`
- `query_dove_orchestrate`
- `query_dove_mission`
- `query_dove_mission_board`
- `query_dove_audit`
- `query_dove_return`
- `query_program_approvals`
- `sync_checklist`
- `prepare_isolated_review`
- `import_isolated_review`
- `record_operator_lesson`
- `record_operator_follow_through`
- `materialize_guidance_packet`
- `launch_dove_mission`
- `issue_program_approval`
- `revoke_program_approval`
- `run_autonomy_once`
- `run_autonomy_foreground`
- `run_autonomy_operate`
- `read_role_context_manifest`
- `read_phase_context_manifest`
- `read_packet_context_manifest`
- `read_artifact_context_manifest`
- `read_action_context_bundle`
- `summarize_session_journal`
- paper-domain mutation tools for research, notes, claims, experiments, drafts, review, rebuttal, versions, figures, and citations
- generic Dove mutation tools for checklist sync, materialization, launch, approvals, and bounded autonomy

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
