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
| Unified Dove mission kernel | Implemented | `.dove/workspace/index.json` (`dove` field), `.dove/manifest.json`, `dove orchestrate`, `dove mission`, `dove status`, `dove audit`, `dove return`, `dove launch`, `query_dove_orchestrate`, `query_dove_mission`, `query_dove_status`, `query_dove_audit`, `query_dove_return`, `launch_dove_mission` | Provides one mission lifecycle, direct Dove product identity, authoritative `.dove/` state, deterministic no-write routing, mission framing, status inspection, proposal-only audit, return-readiness inspection, engineering evidence checks, governed launch into `.dove/task-packets`, and planner/builder/reviewer role boundaries. |
| Installation ergonomics | Implemented | `bin/dove.mjs`, `scripts/generate-command-adapters.mjs` | `install`, `sync`, and `doctor` manage the neutral core plus manifest-derived adapter inventory; `release:check` verifies generated adapter drift before packaging. |
| Health checks / guardrails | Implemented | `bin/dove.mjs`, `scripts/doctor-mcp-probe.mjs` | Includes JSON parsing, authority checks, ignored stale workspace artifact warnings, and MCP probe. |
| Deterministic helper layer | Implemented | `src/mcp/*` | MCP provides deterministic state mutation and query tools over `.dove/`. |
| Explicit role inventory | Implemented | `.dove/orchestration/board.json`, role skills | Planner, builder, and reviewer are the primary durable roles; specialists are scoped subagents. |
| Board-first orchestration | Implemented | `.dove/orchestration/*`, `dove.orchestrate` | File-first contract rather than hidden runtime state; shared mission routing is not mirrored under paper-specific commands. |
| Durable mission packets | Implemented | `.dove/task-packets/*`, `dove.status` | Portable work objects linked to tasks, experiments, rebuttal issues, versions, and mission state. |
| Task-packet target guardrail | Implemented | `src/core/task-packets.mjs`, `src/core/mutation-guard.mjs`, `.dove/state.json.settings.taskTargetResolution`, task-scoped MCP tools | Task-scoped writes resolve to one existing durable packet before mutating research, notes, claims, drafts, experiments, reviews, rebuttals, versions, or isolated-review handoffs; explicit conflicts and missing packets are rejected, while ambiguous targets either auto-select the strongest packet or require `packetId` confirmation based on the global boolean setting. |
| Per-role context manifests | Implemented | `.dove/context/roles/*.json` | Narrows context by role without hidden context routing. |
| Packet-scoped context manifests | Implemented | `.dove/context/packets/*.json`, MCP packet-context reader | Adds packet-local dependency, artifact, and resume bundles without host hooks. |
| Session/workspace persistence surfaces | Implemented | `.dove/sessions/*`, `.dove/wiki/navigation.md` | File-backed summary and journal surfaces preserve resumability. |
| Explicit durable operator lessons | Implemented | `.dove/meta/operator-lessons.json`, `dove.lessons`, `query_operator_lessons`, `record_operator_lesson` | Manual reference-only retrospectives preserve problem, decisions, pitfalls, validation, and next-time guidance without importing ignored raw runtime traces or auto-materializing work. |
| Durable workspace index | Implemented | `.dove/workspace/index.json` | Top-level overview of active packets, work queues, dependency health, ownership, sessions, lifecycle state, and version state. |
| Managed-vs-user-owned update boundary | Implemented | `bin/dove.mjs`, `.dove/workflow-pack/boundaries.json` | Install/sync bootstrap `.dove` safely instead of overwriting user state. |
| Query/navigation workflow UX | Implemented | `dove.plan`, `dove.status`, `dove.checklist`, `dove.approvals`, `dove.governance-audit`, MCP query tools | Users can design shared missions, inspect current mission state, graph health, questions, decisions, lineage, and paper lifecycle readiness, sync `.dove/checklists/current.md`, manage bounded approvals, and verify governance proof directly. |
| Explicit proposal-to-work bridge | Implemented | `dove.follow-through`, `dove.launch`, `dove.approvals`, `dove.autonomy-operate`, `record_operator_follow_through`, `materialize_guidance_packet`, `query_program_approvals`, `issue_program_approval`, `revoke_program_approval`, `run_autonomy_operate`, `.dove/task-packets/*`, `.dove/programs/approvals.json`, `.dove/meta/operator-follow-through.json` | Accepted remediation guidance can be handled explicitly, materialized into one durable packet, approved for bounded continuation, and optionally advanced through explicit bounded foreground autonomy. |
| Host-specific deep hook system | Deferred | N/A | Adapter surfaces avoid pretending unsupported host hooks exist. |
| Hidden subagent interception | Deferred | N/A | Dove preserves role/subagent boundaries through files and prompts, not unsupported host interception. |

## Academic workflow strengths

| Advantage | Status | Where it lives | Notes |
|---|---|---|---|
| Durable research memory | Implemented | `.dove/sources`, `.dove/notes`, `.dove/wiki` | File-first persistent artifacts. |
| Paper lifecycle query | Implemented | `dove.status`, `query_paper_pipeline` | Reports ordered paper pipeline readiness, current durable stage, key artifact availability, and the suggested next command without writing state or executing processes. |
| Claim-evidence discipline | Implemented | `src/core/evidence.mjs`, `dove.paper.claim-gate` | Claims validate source/note references. |
| Claim-driven experiment planning | Implemented | `.dove/experiments/*`, `dove.paper.experiment` | Plans and results stay tied to claims and comparisons. |
| Experiment audit ledger | Implemented | `.dove/experiments/audits.json`, `dove.paper.experiment` | Audit findings are persisted separately from raw results. |
| Result-to-claim bridge | Implemented | `.dove/claims/bridge-log.json`, `dove.paper.result-bridge` | Claim confidence/state changes are traceable to explicit bridge events. |
| Review + revision loop | Implemented | `src/core/reviews.mjs`, `dove.paper.review`, `.dove/revision-plans` | Produces durable findings and action items. |
| Strict no-fix paper audit | Implemented | `src/core/paper-audit.mjs`, `dove.paper.audit`, `query_paper_audit` | Reports proposal-only findings without writing, repairing, refreshing, or auto-applying fixes. |
| Isolated reviewer handoff | Implemented | `.dove/reviews/isolated/*`, `dove.paper.isolated-review`, `prepare_isolated_review`, `import_isolated_review`, `dove isolated-review` | MCP/host surfaces prepare and import explicit artifacts; CLI can invoke an external reviewer command; private reviewer transcripts are not imported. |
| Proposal-first project onboarding | Implemented | `src/core/onboarding.mjs`, `dove.onboard`, `query_dove_onboarding`, `dove onboard`, `.dove/workspace/artifact-map.json` | Existing manuscripts, bibliographies, figures, tables, results, reviews, notes, and submission files are mapped without moving or overwriting source assets; host/MCP onboarding stays proposal-only and CLI `--write-map` is the only persistence path. |
| Persistent adversarial concern memory | Implemented | `.dove/reviews/concerns.json`, `.dove/reviews/adversarial-state.json` | Reviewer concerns persist across rounds instead of living only in the latest log. |
| Citation hygiene | Implemented | `sync_citations`, `.dove/bibliography/*` | Writes BibTeX plus citation log. |
| Rebuttal issue board + strategy | Implemented | `.dove/rebuttal/*`, `dove.paper.rebuttal` | Issues are normalized before response drafting. |
| Version evolution/comparison | Implemented | `.dove/versions/*`, `dove.paper.version` | Snapshot lineage and comparison targets are durable. |
| Typed wiki + relations | Implemented | `.dove/wiki/entities.json`, `.dove/wiki/relations.json` | Query surfaces can rely on typed records instead of markdown alone. |
| Figure generation workflow | Implemented | `.dove/figures/*.json`, `.dove/figures/runs/*`, `.dove/config.json`, `dove.paper.figure`, `prepare_figure_generation`, `import_figure_generation`, `validate_figure_pipeline` | Durable figure plans now flow through material discovery, generation input bundles, explicit local/external provider handoff, safe SVG import, caption provenance, final indexes, and QA. Provider config stores only non-secret settings and uses env-var references such as `apiKeyEnv` for secrets. |
| Autonomous experiment orchestration | Deferred | N/A | No fake scheduler or daemon is claimed. |

## Current release claim

The current Dove release is intended to be described as:

> a host-neutral, board-first, evidence-aware mission workflow system with optional multi-host adapters, first-class paper and engineering domains, authoritative `.dove/` state, planner/builder/reviewer separation, durable review/rebuttal/experiment/version workflows, and explicit governed autonomy.

It should not be described as a host-level clone, a hidden scheduler, an OpenCode-only package, or a generic task manager that replaces paper-specific research and writing capabilities.
