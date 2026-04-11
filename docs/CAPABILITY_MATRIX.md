# Capability matrix

This file turns the phrase “absorb the advantages of oh-my-openagent and ARIS” into an auditable checklist.

## Legend

- **Implemented**: shipped in the current `paper_factory` package
- **Partial**: the idea is present, but not at the full depth of the source inspiration
- **Deferred**: intentionally not claimed as part of the current release

## oh-my-openagent / workflow-pack strengths

| Advantage | Status | Where it lives | Notes |
|---|---|---|---|
| Packaged workflow surface | Implemented | `.opencode/commands`, `.opencode/skills` | OpenCode-native command + skill pack |
| Installation ergonomics | Implemented | `bin/paper-factory.mjs` | `install`, `sync`, `doctor` |
| Health checks / guardrails | Implemented | `bin/paper-factory.mjs`, `scripts/doctor-mcp-probe.mjs` | Includes JSON parsing and MCP probe |
| Deterministic helper layer | Implemented | `src/mcp/*` | MCP provides state mutation tools |
| Explicit role inventory | Implemented | `.paper/orchestration/board.json`, role skills | Planner/researcher/reviewer/rebuttal/experiment/version roles are durable and explicit |
| Board-first orchestration | Implemented | `.paper/orchestration/*`, `paper.orchestrate` | File-first contract rather than hidden runtime state |
| Composable workflow packaging | Implemented | command/skill split + `.paper` artifacts | Lifecycle phases are exposed as honest commands |
| Host-specific deep hook system | Deferred | N/A | OpenCode-native pack avoids pretending unsupported host hooks exist |

## ARIS-style academic workflow strengths

| Advantage | Status | Where it lives | Notes |
|---|---|---|---|
| Durable research memory | Implemented | `.paper/sources`, `.paper/notes`, `.paper/wiki` | File-first persistent artifacts |
| Claim-evidence discipline | Implemented | `src/core/evidence.mjs`, `paper.claim-gate` | Claims validate source/note references |
| Claim-driven experiment planning | Implemented | `.paper/experiments/*`, `paper.experiment-plan` | Plans and results stay tied to claims and comparisons |
| Review + revision loop | Implemented | `src/core/reviews.mjs`, `paper.review-loop`, `.paper/revision-plans` | Produces durable findings and action items |
| Citation hygiene | Implemented | `sync_citations`, `.paper/bibliography/*` | Writes BibTeX + citation log |
| Rebuttal issue board + strategy | Implemented | `.paper/rebuttal/*`, `paper.rebuttal-strategy` | Issues are normalized before response drafting |
| Version evolution/comparison | Implemented | `.paper/versions/*`, `paper.version-*` | Snapshot lineage and comparison targets are durable |
| Stage discipline | Implemented | strict mode + orchestration board gates | Optional strict mode, durable board phases, and review blockers |
| Autonomous experiment orchestration | Deferred | N/A | No fake scheduler or daemon is claimed |
| Full ARIS research/reviewer subsystem parity | Deferred | N/A | Current package is inspired by ARIS, not a clone |

## Current release claim

The current `paper_factory` release is intended to be described as:

> an OpenCode-native, board-first, evidence-aware academic writing workflow pack that absorbs the strongest packaging/orchestration ideas from oh-my-openagent and the strongest durable research/experiment/rebuttal/version ideas from ARIS.

It should **not** be described as a full host-level clone of oh-my-openagent or a full system-level clone of ARIS.
