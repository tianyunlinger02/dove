# dove-paper-onboard

Map existing paper artifacts without moving or overwriting source assets.

## Contract

- Command id: `dove.paper.onboard`
- Domain: `paper`
- Category: `query`
- Policy: `proposal-only`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `project root`, `.dove/workspace/artifact-map.json`.
3. No required MCP tool; follow the command contract and route to the owning Dove surface when mutation is needed.
4. Keep this surface proposal-only: inspect and route, but do not mutate durable state.
5. Default to proposal-only mapping; never move, delete, import, rewrite, or overwrite source assets.
6. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
7. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
8. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
