---
name: dove-onboard
description: "Map existing project paper artifacts without moving, rewriting, or overwriting source assets."
---

# Dove Onboard

Map existing project paper artifacts without moving, rewriting, or overwriting source assets.

## Contract

- Command id: `dove.onboard`
- Domain: `generic`
- Category: `query`
- Policy: `proposal-only`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `project root`, `.dove/workspace/artifact-map.json`.
3. Prefer the `query_dove_onboarding` MCP tool when available.
4. Keep this surface proposal-only: inspect and route, but do not mutate durable state.
5. Default to proposal-only mapping; persist only through the CLI `dove onboard --write-map` path.
6. Never move, delete, import, rewrite, or overwrite source assets from this surface.
7. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
8. Use this shared Dove control-plane surface across paper, engineering, experiment, review, and general missions; route to `dove.paper.*` only for paper-specific artifact workflows.
9. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
