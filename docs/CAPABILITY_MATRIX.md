# Capability matrix

This file turns Dove's current public schema 8 claims into an auditable checklist.

## Legend

- **Implemented**: shipped and reachable through the current package.
- **Deferred**: intentionally unavailable until a sealed authority contract exists.

## Public schema 8 strengths

| Capability | Status | Where it lives | Contract |
|---|---|---|---|
| Minimal project and mission contracts | Implemented | `.dove/manifest.json`, `.dove/project.json`, `.dove/missions/*`, `project:dove.init`, `project:dove.mission` | Proposal is zero-write and exact-replay bound. Confirmation persists only sealed schema identity and one minimal mission contract. |
| Mission-bound domain writes | Implemented | `project:dove.source`, `project:dove.note`, `project:dove.experience`, `project:dove.draft`, `project:dove.figure`, `project:dove.review`, `project:dove.rebuttal`, `project:dove.version` | Every domain mutation requires explicit `missionId`; packet, target, domain, stage, status, role, and policy-override authority are rejected. |
| First-write atomic preflight | Implemented | `src/core/domain-artifacts.mjs`, `src/core/artifact-integrity.mjs` | Imported material, hashes, evidence, findings, results, ownership, and overwrite eligibility are validated before the first durable write. |
| Canonical receipts, ownership, and lineage | Implemented | `.dove/receipts/execution/*`, receipt-derived artifact queries | Every domain write records immutable receipt evidence. Current mission ownership and lineage are derived from the ledger rather than persisted as mirror files. Drifted, unowned, or cross-mission overwrites fail closed. |
| Pure live completion and status | Implemented | `assess_mission_completion`, `query_dove_status`, `project:dove.status` | Reads are zero-write. One mission scopes automatically; multiple missions require explicit `missionId`. Completion, source, domain, and review gaps are stable and actionable. |
| Sealed public CLI/MCP schemas | Implemented | `src/cli/command-parser.mjs`, `src/mcp/tool-definitions.mjs`, generated adapters | Unknown fields are rejected. MCP object schemas use `additionalProperties: false`; public domain tools require `missionId`. |
| Public bundle isolation | Implemented | `src/core/index.mjs`, `scripts/validate-commands.mjs`, package bundles | Public core, CLI, and MCP entrypoints do not import packet guard, orchestration, navigation, runtime-state, legacy governance, or legacy source-trust modules. |
| Public inventory and adapters | Implemented | OpenCode, Codex, Cursor, shared agent skills, Claude user commands, CLI, MCP | Exactly 12 host workflows; separately 16 top-level CLI subcommands, 27 MCP tools, and 60 adapters: 48 checked-in project adapters plus 12 Claude user commands. Every generated CLI action uses `--json`. |
| Advisory lessons | Implemented | `.dove/lessons/*`, `project:dove.lessons`, `query_dove_lessons`, `record_dove_lesson` | Explicit query is zero-write; explicit record requires exact proposal confirmation. Lessons retain recording-mission provenance, may be mission-scoped or globally applicable, use exactly five kinds, and never grant authority or completion credit. |

## Research and paper workflows

| Capability | Status | Contract |
|---|---|---|
| Source capture and trust | Implemented | Search returns a non-authoritative registration draft and requires visible host capture. Registration requires `capturePath`, imports and hashes the captured material as a mission-bound candidate, then query reports candidate state. Public verification can reject but never claims positive trust. |
| Evidence notes and claims | Implemented | Notes can synthesize current mission-owned artifacts or current mission notes. `sourceIds` remain ineligible until a trusted positive source verifier exists. Claims require current eligible typed note/artifact or audited experiment evidence. |
| Canonical experiment workflow | Implemented | Protocol, result evidence, audit, and claim bridge are written through one atomic canonical implementation. |
| Draft workflow | Implemented | Writes a substantive body or explicit metadata for an existing mission-owned draft; evidence references are revalidated before mutation. |
| Figure workflow | Implemented | Providers execute on the host side. Dove binds materials, imports and hashes declared output, records caption/provenance and QA, and cannot self-issue authoritative validation. |
| Rebuttal workflow | Implemented | Every issue and response links to a concrete `<review-artifact-path>#<finding-id>` reference. Strategy and response remain author-side. |
| Immutable versions | Implemented | Snapshots copy actual artifact contents, comparisons verify immutable copies, and finalization requires live mission completion plus authoritative review proof. |
| Public review command | Implemented | `project:dove.review`, CLI `dove review`, MCP `prepare_review_exchange` / `import_review_exchange` / `verify_review_coverage`, and `.dove/reviews/exchanges/*` implement one policy-scoped contract. `local-preflight` is zero-write; `isolated-selected-artifacts`, `final-plan-results-only`, and `external` freeze declared input scope only. Public imports remain non-authoritative and cannot mint Reviewer proof. |

## Removed legacy architecture

Task-packet resolution, packet-bound source trust, mutation guards, orchestration, navigation, runtime state, onboarding, public-status publishing, operator ledgers, retired operator lesson storage and tools, isolated/audio review implementations, and review-loop implementations are physically removed. Schema 8 core, CLI, MCP, and generated bundles are statically checked against those modules and callable surfaces. The replacement lesson surface has no automatic capture, automatic recall, transcript ingestion, Trellis integration, or runtime integration.

## Current release claim

> Dove is a host-neutral, mission-bound, evidence-aware workflow system with sealed schema 8 contracts, substantive research and paper artifacts, atomic preflight, canonical execution receipts, artifact ownership and lineage, immutable versions, fail-closed source and Reviewer authority, read-only live integrity status, and no public packet/board/runtime/navigation compatibility path.
