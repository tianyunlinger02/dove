# Capability matrix

This file turns the phrase “absorb the advantages of workflow-pack systems and academic research operating systems” into an auditable checklist for Dove.

## Legend

- **Implemented**: shipped in the current Dove package
- **Partial**: the idea is present, but not at the full depth of the source inspiration
- **Deferred**: intentionally not claimed as part of the current release

## Workflow-pack strengths

| Advantage | Status | Where it lives | Notes |
|---|---|---|---|
| Packaged workflow surface | Implemented | neutral core + generated optional host adapters | `src/core/command-manifest.mjs` is the canonical command inventory; OpenCode is the default adapter; Claude Code, Codex, Cursor, and shared agent-skill adapter surfaces receive the same generic and paper-domain Dove commands as Dove-only adapter files, not local development scaffolding. |
| Unified Dove mission kernel | Implemented | `.dove/workspace/index.json` (`dove` field), `.dove/manifest.json`, `dove orchestrate`, `dove mission`, `dove board`, `dove audit`, `dove return`, `dove launch`, `query_dove_orchestrate`, `query_dove_mission`, `query_dove_mission_board`, `query_dove_audit`, `query_dove_return`, `launch_dove_mission` | Provides one mission lifecycle, direct Dove product identity, authoritative `.dove/` state, deterministic no-write routing, mission framing, board inspection, proposal-only audit, return-readiness inspection, engineering evidence checks, governed launch into `.dove/task-packets`, and planner/builder/reviewer role boundaries. |
| Installation ergonomics | Implemented | `bin/dove.mjs`, `scripts/generate-command-adapters.mjs` | `install`, `sync`, and `doctor` manage the neutral core plus manifest-derived adapter inventory; `release:check` verifies generated adapter drift before packaging. |
| Health checks / guardrails | Implemented | `bin/dove.mjs`, `scripts/doctor-mcp-probe.mjs` | Includes JSON parsing, authority checks, ignored stale workspace artifact warnings, and MCP probe. |
| Deterministic helper layer | Implemented | `src/mcp/*` | MCP provides deterministic state mutation and query tools over `.dove/`. |
| Explicit role inventory | Implemented | `.dove/orchestration/board.json`, role skills | Planner, builder, and reviewer are the primary durable roles; specialists are scoped subagents. |
| Board-first orchestration | Implemented | `.dove/orchestration/*`, `dove.paper.orchestrate` | File-first contract rather than hidden runtime state. |
| Durable mission packets | Implemented | `.dove/task-packets/*`, `dove.task-graph` | Portable work objects linked to tasks, experiments, rebuttal issues, versions, and mission state. |
| Per-role context manifests | Implemented | `.dove/context/roles/*.json` | Narrows context by role without hidden context routing. |
| Packet-scoped context manifests | Implemented | `.dove/context/packets/*.json`, MCP packet-context reader | Adds packet-local dependency, artifact, and resume bundles without host hooks. |
| Session/workspace persistence surfaces | Implemented | `.dove/sessions/*`, `.dove/wiki/navigation.md` | File-backed summary and journal surfaces preserve resumability. |
| Explicit durable operator lessons | Implemented | `.dove/meta/operator-lessons.json`, `dove.lessons`, `query_operator_lessons`, `record_operator_lesson` | Manual reference-only retrospectives preserve problem, decisions, pitfalls, validation, and next-time guidance without importing ignored raw runtime traces or auto-materializing work. |
| Durable workspace index | Implemented | `.dove/workspace/index.json` | Top-level overview of active packets, work queues, dependency health, ownership, sessions, lifecycle state, and version state. |
| Managed-vs-user-owned update boundary | Implemented | `bin/dove.mjs`, `.dove/workflow-pack/boundaries.json` | Install/sync bootstrap `.dove` safely instead of overwriting user state. |
| Query/navigation workflow UX | Implemented | `dove.plan`, `dove.task-graph`, `dove.checklist`, `dove.approvals`, `dove.governance-audit`, `dove.paper.open-questions`, `dove.paper.decisions`, `dove.paper.lineage`, MCP query tools | Users can design shared missions, inspect graph/questions/decisions/lineage, sync `.dove/checklists/current.md`, manage bounded approvals, and verify governance proof directly. |
| Explicit proposal-to-work bridge | Implemented | `dove.materialize`, `dove.approvals`, `dove.autonomy-operate`, `materialize_guidance_packet`, `query_program_approvals`, `issue_program_approval`, `revoke_program_approval`, `run_autonomy_operate`, `.dove/task-packets/*`, `.dove/programs/approvals.json`, `.dove/meta/operator-follow-through.json` | Accepted remediation guidance can be materialized into one durable packet, explicitly approved for bounded continuation, and optionally advanced through explicit bounded foreground autonomy. |
| Host-specific deep hook system | Deferred | N/A | Adapter surfaces avoid pretending unsupported host hooks exist. |
| Hidden subagent interception | Deferred | N/A | Dove preserves role/subagent boundaries through files and prompts, not unsupported host interception. |

## Academic workflow strengths

| Advantage | Status | Where it lives | Notes |
|---|---|---|---|
| Durable research memory | Implemented | `.dove/sources`, `.dove/notes`, `.dove/wiki` | File-first persistent artifacts. |
| Claim-evidence discipline | Implemented | `src/core/evidence.mjs`, `dove.paper.claim-gate` | Claims validate source/note references. |
| Claim-driven experiment planning | Implemented | `.dove/experiments/*`, `dove.paper.experiment-plan` | Plans and results stay tied to claims and comparisons. |
| Experiment audit ledger | Implemented | `.dove/experiments/audits.json`, `dove.paper.experiment-audit` | Audit findings are persisted separately from raw results. |
| Result-to-claim bridge | Implemented | `.dove/claims/bridge-log.json`, `dove.paper.result-bridge` | Claim confidence/state changes are traceable to explicit bridge events. |
| Review + revision loop | Implemented | `src/core/reviews.mjs`, `dove.paper.review-loop`, `.dove/revision-plans` | Produces durable findings and action items. |
| Strict no-fix paper audit | Implemented | `src/core/paper-audit.mjs`, `dove.paper.audit`, `query_paper_audit` | Reports proposal-only findings without writing, repairing, refreshing, or auto-applying fixes. |
| Isolated reviewer handoff | Implemented | `.dove/reviews/isolated/*`, `dove.paper.isolated-review`, `dove isolated-review` | Reviewer receives only explicit input artifacts and returns only handoff/report artifacts. |
| Proposal-first project onboarding | Implemented | `src/core/onboarding.mjs`, `dove.paper.onboard`, `dove onboard`, `.dove/workspace/artifact-map.json` | Existing manuscripts, bibliographies, figures, tables, results, reviews, notes, and submission files are mapped without moving or overwriting source assets. |
| Persistent adversarial concern memory | Implemented | `.dove/reviews/concerns.json`, `.dove/reviews/adversarial-state.json` | Reviewer concerns persist across rounds instead of living only in the latest log. |
| Citation hygiene | Implemented | `sync_citations`, `.dove/bibliography/*` | Writes BibTeX plus citation log. |
| Rebuttal issue board + strategy | Implemented | `.dove/rebuttal/*`, `dove.paper.rebuttal-strategy` | Issues are normalized before response drafting. |
| Version evolution/comparison | Implemented | `.dove/versions/*`, `dove.paper.version-*` | Snapshot lineage and comparison targets are durable. |
| Typed wiki + relations | Implemented | `.dove/wiki/entities.json`, `.dove/wiki/relations.json` | Query surfaces can rely on typed records instead of markdown alone. |
| Figure artifact contracts | Partial | `.dove/figures/*.json`, `dove.paper.figure`, `validate_figure_pipeline` | Durable brief → segment → template → editable → final-contract records and figure QA exist, but no render/editor backend is claimed. |
| Autonomous experiment orchestration | Deferred | N/A | No fake scheduler or daemon is claimed. |

## Current release claim

The current Dove release is intended to be described as:

> a host-neutral, board-first, evidence-aware mission workflow system with optional multi-host adapters, first-class paper and engineering domains, authoritative `.dove/` state, planner/builder/reviewer separation, durable review/rebuttal/experiment/version workflows, and explicit governed autonomy.

It should not be described as a host-level clone, a hidden scheduler, an OpenCode-only package, or a generic task manager that replaces paper-specific research and writing capabilities.
