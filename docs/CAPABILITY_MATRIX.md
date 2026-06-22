# Capability matrix

This file turns Dove's user-facing claims into an auditable checklist.

## Legend

- **Implemented**: shipped in the current Dove package
- **Partial**: present, but not yet as deep as the intended product model
- **Deferred**: intentionally not claimed as part of the current release

## Workflow-pack strengths

| Advantage | Status | Where it lives | Notes |
|---|---|---|---|
| Packaged workflow surface | Implemented | neutral core + generated optional project adapters | `src/core/command-manifest.mjs` is the canonical command inventory and includes daily-use UX metadata; generated OpenCode, Codex, Cursor, and shared agent-skill project adapters present the same top-level Dove commands with daily flow before guardrails. Claude Code uses one manifest-rendered user-level `/dove:*` command set, written by `dove install/sync --host claude`, that operates on the current project's `.dove/` state instead of project-local `.claude/commands/dove` files. |
| Task-centered Dove kernel | Implemented | `.dove/state.json`, `.dove/task-packets/*`, `.dove/runtime/results.json`, `project:dove.init`, `project:dove.mission`, `project:dove.auto`, `project:dove.status`, `project:dove.operator` | One level-0 init goal anchors classified tasks for paper, experiment, and engineering work; mission converts natural-language demand into a task contract with a compact task card, requires interactive approval when the host supports it, materializes the approved task/checklist, then records one bounded foreground pass. Completed plan passes convert supplied plan outputs into pending level-3+ missions. Any system checklist/subtask children must be deeper than their parent mission. |
| Installation ergonomics | Implemented | `bin/dove.mjs`, `scripts/generate-command-adapters.mjs` | `install`, `sync`, and `doctor` manage the neutral core plus manifest-derived adapter inventory; `release:check` verifies generated adapter drift before packaging. |
| Health checks / guardrails | Implemented | `bin/dove.mjs`, `scripts/doctor-mcp-probe.mjs` | Includes JSON parsing, authority checks, ignored stale workspace artifact warnings, and MCP probe. |
| Deterministic helper layer | Implemented | `src/mcp/*` | MCP provides deterministic state mutation and query tools over `.dove/`. |
| Explicit role inventory | Implemented | `.dove/orchestration/board.json`, role skills | Planner, builder, and reviewer are the primary durable roles; specialists are scoped subagents. |
| First-class boundaries and handoffs | Implemented | `.dove/task-packets/*`, `.dove/runtime/events.json`, `query_dove_status` | Boundaries record why work stopped, required inputs/actions, owner/next role, and optional handoff without adding stop reasons to the machine status enum. |
| Durable task packets | Implemented | `.dove/task-packets/*`, `project:dove.status` | Portable work objects linked to tasks, experiences, claims, rebuttal issues, versions, evidence state, current boundary, and handoff state. |
| Task-packet target guardrail | Implemented | `src/core/task-packets.mjs`, `src/core/mutation-guard.mjs`, `.dove/state.json.settings.taskTargetResolution`, task-scoped MCP tools | Task-scoped writes resolve to one existing durable packet before mutating sources, notes, claims, drafts, experiences, reviews, rebuttals, versions, figures, or audio-review handoffs; missing targets or tied top candidates stop for confirmation UX instead of guessing. |
| Response-language preference | Implemented | `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json.settings.responseLanguage`, generated command adapters, runtime task/checklist/status/operator/auto outputs | Dove supports `zh` and `en`, defaults to Chinese, and applies the preference to newly generated user-facing text while preserving machine tokens and public API fields in English. Existing artifacts are not migrated when the preference changes. |
| Per-role context manifests | Implemented | `.dove/context/roles/*.json` | Narrows context by role without hidden context routing. |
| Packet-scoped context manifests | Implemented | `.dove/context/packets/*.json`, MCP packet-context reader | Adds packet-local dependency, artifact, and resume bundles without host hooks. |
| Session/workspace persistence surfaces | Implemented | `.dove/sessions/*`, `.dove/wiki/navigation.md` | File-backed summary and journal surfaces preserve resumability. |
| Explicit durable operator lessons | Implemented | `.dove/meta/operator-lessons.json`, `project:dove.lessons`, `query_operator_lessons`, `record_operator_lesson` | Manual retrospectives preserve problem, decisions, pitfalls, validation, and next-time guidance without importing ignored raw runtime traces. |
| Durable workspace index | Implemented | `.dove/workspace/index.json` | Top-level overview of active packets, work queues, dependency health, ownership, sessions, lifecycle state, and version state. |
| Managed-vs-user-owned update boundary | Implemented | `bin/dove.mjs`, `.dove/workflow-pack/boundaries.json` | Install/sync bootstrap `.dove` safely instead of overwriting user state. |
| Query/navigation workflow UX | Implemented | `project:dove.status`, `query_dove_status`, `apply_dove_status_adjustments` | Users inspect the live development situation from host-visible context; status is read-only by default and returns a `dailyHome` with ranked 1-3 next action cards plus proposal-only boundary action cards. It only displays non-init missions eligible for adjustment, excluding `completed` and `killed`, omits mission counts and completed/killed recaps, and one confirmed status dialog with compact adjustment cards can adjust displayed missions with machine choices `pending`, `ready`, `in-progress`, `blocked`, `completed`, or `killed`. |
| Append-only runtime event/result log | Implemented | `.dove/runtime/events.json`, `.dove/runtime/results.json`, `.dove/runtime/continuation.json` | Foreground runs append lifecycle transitions, boundary opened/resolved events, handoff events, workflow results, and explicit continuation hints without hidden background execution. |
| Explicit bounded auto path | Implemented | `project:dove.auto`, `run_dove_auto`, `.dove/runtime/*`, `.dove/state.json.settings.auto.maxIterations` | Auto uses the same demand-to-task intake as mission, can start directly from a new demand or existing task, returns a proposal-only `proposedTask`/`selectedTask` confirmation contract with compact task/auto cards, requires explicit confirmation, runs foreground-only bounded iterations, records per-iteration runtime summaries, and stops at explicit boundaries. It does not continue as a background daemon after a response ends or claim host/provider work without evidence. |
| Operator queue pass | Implemented | `project:dove.operator`, `run_dove_operator`, `.dove/runtime/results.json`, `.dove/task-packets/*` | Operator previews compact cards for auto-runnable, host-pass-required, blocked, and pending queues; confirmed foreground passes run safe internal steps or record real host-supplied task results without pretending work happened, persist awaiting boundaries when evidence is missing, and blocked missions create pending blocker-investigation plan missions. |
| Host-specific deep hook system | Deferred | N/A | Adapter surfaces avoid pretending unsupported host hooks exist. |
| Hidden subagent interception | Deferred | N/A | Dove preserves role/subagent boundaries through files and prompts, not unsupported host interception. |

## Academic workflow strengths

| Advantage | Status | Where it lives | Notes |
|---|---|---|---|
| Durable research memory | Implemented | `.dove/sources`, `.dove/notes`, `.dove/wiki`, `project:dove.source`, `project:dove.note` | External and internal information have separate top-level task presets. |
| Paper lifecycle query | Implemented | `project:dove.status`, `query_paper_pipeline` | Reports ordered paper readiness, current durable stage, key artifact availability, and suggested next action without writing state or executing processes. |
| Claim-evidence discipline | Implemented | `src/core/evidence.mjs`, `project:dove.experience` | Claims validate source/note/experiment references; public experience workflow bridges results into claim state. |
| Claim-driven experiment planning | Implemented | `.dove/experiments/*`, `project:dove.experience`, `run_experience_workflow` | Plans and results stay tied to claims and comparisons. |
| Experiment audit ledger | Implemented | `.dove/experiments/audits.json`, `project:dove.experience` | Audit findings are persisted separately from raw results. |
| Result-to-claim bridge | Implemented | `.dove/claims/bridge-log.json`, `project:dove.experience` | Claim confidence/state changes are traceable to explicit bridge events. |
| Review + revision loop | Implemented | `src/core/reviews.mjs`, `project:dove.review-loop`, `.dove/revision-plans` | Produces durable findings and action items; the top-level loop composes audio review, draft updates, and experience planning. |
| Strict no-fix paper audit | Implemented | `src/core/paper-audit.mjs`, `query_paper_audit` | Remains available as an internal/read-only inspection primitive behind status/review guidance. |
| Isolated audio review | Implemented | `.dove/audio/reviews/*`, `project:dove.review`, `run_audio_review` | Audio receives only task summary, final plan/result paths, explicit artifacts, hashes, instructions, and output contract. Broad project context and private transcripts are not shared. |
| Proposal-first project onboarding | Internal support | `src/core/onboarding.mjs`, `query_dove_onboarding`, `.dove/workspace/artifact-map.json` | Existing asset mapping remains a support primitive, not a public slash command. |
| Persistent adversarial concern memory | Implemented | `.dove/reviews/concerns.json`, `.dove/reviews/adversarial-state.json` | Reviewer concerns persist across rounds instead of living only in the latest log. |
| Citation hygiene | Implemented | `sync_citations`, `.dove/bibliography/*`, `project:dove.source` | Citation support remains internal/file-backed and is surfaced through source workflows. |
| Rebuttal issue board + strategy | Implemented | `.dove/rebuttal/*`, `project:dove.rebuttal` | Issues are normalized before response drafting. |
| Version evolution/comparison | Implemented | `.dove/versions/*`, `project:dove.version` | Version reset snapshots direction changes and clears active non-init tasks. |
| Typed wiki + relations | Implemented | `.dove/wiki/entities.json`, `.dove/wiki/relations.json` | Query/status surfaces can rely on typed records instead of markdown alone. |
| Figure generation workflow | Implemented | `.dove/figures/*.json`, `.dove/figures/runs/*`, `.dove/config.json`, `project:dove.figure`, `run_figure_workflow` | Users describe the desired figure once; Dove resolves the packet, discovers materials, prepares generation input, imports safe available output, writes caption provenance, refreshes indexes, and validates QA. |
| Autonomous experiment orchestration | Deferred | N/A | No fake scheduler or daemon is claimed. |

## Current release claim

The current Dove release is intended to be described as:

> a host-neutral, task-centered, evidence-aware workflow system with optional multi-host adapters, demand-to-task mission contracts, completed-plan-to-mission conversion, status daily home screen UX, compact confirmation cards, foreground operator queue passes, first-class boundaries and role handoffs, append-only runtime event/result logs, first-class paper/experiment/engineering domains, authoritative `.dove/` state, planner/builder/reviewer separation, durable review/rebuttal/experience/version/figure workflows, explicit lessons, one-pass mission execution, and bounded foreground auto execution.

It should not be described as a host-level clone, a hidden scheduler, an OpenCode-only package, or a generic task manager that replaces research and writing discipline.
