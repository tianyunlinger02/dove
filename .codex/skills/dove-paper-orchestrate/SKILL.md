---
name: dove-paper-orchestrate
description: "Route paper-domain work to one next command without mutating the board."
---

# Dove Paper Orchestrate

Route paper-domain work to one next command without mutating the board.

## Contract

- Command id: `dove.paper.orchestrate`
- Domain: `paper`
- Category: `query`
- Policy: `proposal-only`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/orchestration/board.json`.
3. Prefer the `query_dove_orchestrate` MCP tool when available.
4. Keep this surface proposal-only: inspect and route, but do not mutate durable state.
5. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
6. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
7. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
