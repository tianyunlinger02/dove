---
name: dove-orchestrate
description: "Route one Dove mission to the next command without writing state."
---

# Dove Orchestrate

Route one Dove mission to the next command without writing state.

## Contract

- Command id: `dove.orchestrate`
- Domain: `generic`
- Category: `query`
- Policy: `proposal-only`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/orchestration/board.json`.
3. Prefer the `query_dove_orchestrate` MCP tool when available.
4. Keep this surface proposal-only: inspect and route, but do not mutate durable state.
5. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
6. For paper-specific work, route to the matching `dove.paper.*` surface instead of adding a second workflow branch.
7. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
