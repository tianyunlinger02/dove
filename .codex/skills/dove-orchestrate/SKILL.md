---
name: dove-orchestrate
description: "Route one Dove mission across paper, engineering, experiment, review, and general domains without writing state."
---

# Dove Orchestrate

Route one Dove mission across paper, engineering, experiment, review, and general domains without writing state.

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
5. Use this as the single mission routing surface for every domain; do not mirror shared routing under paper-specific commands.
6. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
7. Use this shared Dove control-plane surface across paper, engineering, experiment, review, and general missions; route to `dove.paper.*` only for paper-specific artifact workflows.
8. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
