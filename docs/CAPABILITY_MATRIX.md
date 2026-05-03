# Capability matrix

This file turns the phrase “absorb the advantages of oh-my-openagent and ARIS” into an auditable checklist.

## Legend

- **Implemented**: shipped in the current `paper_factory` package
- **Partial**: the idea is present, but not at the full depth of the source inspiration
- **Deferred**: intentionally not claimed as part of the current release

## oh-my-openagent / workflow-pack strengths

| Advantage | Status | Where it lives | Notes |
|---|---|---|---|
| Packaged workflow surface | Implemented | neutral core + optional host adapters | OpenCode remains the default adapter; Claude Code, Codex, Cursor, and shared agent-skill adapter surfaces are installable |
| Installation ergonomics | Implemented | `bin/paper-factory.mjs` | `install`, `sync`, `doctor` |
| Health checks / guardrails | Implemented | `bin/paper-factory.mjs`, `scripts/doctor-mcp-probe.mjs` | Includes JSON parsing and MCP probe |
| Deterministic helper layer | Implemented | `src/mcp/*` | MCP provides state mutation tools |
| Explicit role inventory | Implemented | `.paper/orchestration/board.json`, role skills | Planner/researcher/reviewer/rebuttal/experiment/version roles are durable and explicit |
| Board-first orchestration | Implemented | `.paper/orchestration/*`, `paper.orchestrate` | File-first contract rather than hidden runtime state |
| Durable task packets | Implemented | `.paper/task-packets/*`, `paper.task-graph` | Portable work objects linked to task, experiment, rebuttal, and version state |
| Per-role context manifests | Implemented | `.paper/context/roles/*.json` | Narrows context by role without hidden context routing |
| Packet-scoped context manifests | Implemented | `.paper/context/packets/*.json`, MCP packet-context reader | Adds packet-local dependency, artifact, and resume bundles without host hooks |
| Session/workspace persistence surfaces | Implemented | `.paper/sessions/*`, `.paper/wiki/navigation.md` | File-backed summary/journal surfaces preserve resumability |
| Durable workspace index | Implemented | `.paper/workspace/index.json` | Top-level resumable overview of active packets, work queues, dependency health, ownership, sessions, and version state |
| Managed-vs-user-owned update boundary | Implemented | `bin/paper-factory.mjs`, `.paper/workflow-pack/boundaries.json` | Install/sync bootstrap `.paper` safely instead of overwriting user state |
| Query/navigation workflow UX | Implemented | `paper.task-graph`, `paper.open-questions`, `paper.decisions`, `paper.lineage`, MCP query tools | Users can inspect graph/questions/decisions/lineage directly |
| Explicit proposal-to-work bridge | Implemented | `paper.materialize`, `materialize_guidance_packet`, `.paper/task-packets/*`, `.paper/meta/operator-follow-through.json` | Accepted remediation guidance can be materialized into one real durable task packet through an explicit governed path |
| Composable workflow packaging | Implemented | command/skill/adapter split + `.paper` artifacts | Lifecycle phases are exposed through host adapters over the same file-backed core |
| Host-specific deep hook system | Deferred | N/A | Adapter surfaces avoid pretending unsupported host hooks exist |
| Hook-heavy subagent interception | Deferred | N/A | Trellis-style host interception is intentionally out of scope |

## ARIS-style academic workflow strengths

| Advantage | Status | Where it lives | Notes |
|---|---|---|---|
| Durable research memory | Implemented | `.paper/sources`, `.paper/notes`, `.paper/wiki` | File-first persistent artifacts |
| Claim-evidence discipline | Implemented | `src/core/evidence.mjs`, `paper.claim-gate` | Claims validate source/note references |
| Claim-driven experiment planning | Implemented | `.paper/experiments/*`, `paper.experiment-plan` | Plans and results stay tied to claims and comparisons |
| Experiment audit ledger | Implemented | `.paper/experiments/audits.json`, `paper.experiment-audit` | Audit findings are persisted separately from raw results |
| Result-to-claim bridge | Implemented | `.paper/claims/bridge-log.json`, `paper.result-bridge` | Claim confidence/state changes are traceable to explicit bridge events |
| Review + revision loop | Implemented | `src/core/reviews.mjs`, `paper.review-loop`, `.paper/revision-plans` | Produces durable findings and action items |
| Persistent adversarial concern memory | Implemented | `.paper/reviews/concerns.json`, `.paper/reviews/adversarial-state.json` | Reviewer concerns persist across rounds instead of living only in the latest log |
| Citation hygiene | Implemented | `sync_citations`, `.paper/bibliography/*` | Writes BibTeX + citation log |
| Rebuttal issue board + strategy | Implemented | `.paper/rebuttal/*`, `paper.rebuttal-strategy` | Issues are normalized before response drafting |
| Version evolution/comparison | Implemented | `.paper/versions/*`, `paper.version-*` | Snapshot lineage and comparison targets are durable |
| Stronger explanatory comparisons | Implemented | `.paper/versions/LATEST_COMPARISON.md` | Comparison reports now include review delta context in addition to evidence/citation drift |
| Typed wiki + relations | Implemented | `.paper/wiki/entities.json`, `.paper/wiki/relations.json` | Query surfaces can rely on typed records instead of markdown alone |
| Figure artifact contracts | Partial | `.paper/figures/*.json`, `paper.figure`, `validate_figure_pipeline` | Durable brief → segment → template → editable → final-contract records and figure QA exist, but no render/editor backend is claimed |
| Stage discipline | Implemented | strict mode + orchestration board gates | Optional strict mode, durable board phases, and review blockers |
| Autonomous experiment orchestration | Deferred | N/A | No fake scheduler or daemon is claimed |
| Full ARIS research/reviewer subsystem parity | Deferred | N/A | Current package is inspired by ARIS, not a clone |

## Current release claim

The current `paper_factory` release is intended to be described as:

> a host-neutral, board-first, evidence-aware academic writing workflow pack with optional multi-host adapters that absorbs the strongest packaging/orchestration ideas from oh-my-openagent, the strongest durable research/experiment/rebuttal/version ideas from ARIS, and the strongest portable Trellis-style ideas around task packets, role manifests, persistence, safe workflow-pack boundaries, queryable navigation, typed workspace state, experiment audits, and result-to-claim traceability.

It should **not** be described as a full host-level clone of oh-my-openagent, a full system-level clone of ARIS, an OpenCode-only package, or a Trellis runtime clone with hidden hooks/schedulers.
