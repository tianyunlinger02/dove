# dove-status

Inspect the current Dove mission status, task graph, paper lifecycle, open questions, decisions, and version lineage.

## Contract

- Command id: `dove.status`
- Domain: `generic`
- Category: `query`
- Policy: `query`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/orchestration/board.json`, `.dove/task-packets/index.json`, `.dove/state.json`, `.dove/checklists/current.md`, `.dove/reviews`, `.dove/experiments`, `.dove/versions`, `.dove/wiki/navigation.md`.
3. Prefer the `query_dove_status` MCP tool when available.
4. Keep this surface read-only unless the named MCP tool explicitly performs a governed refresh.
5. Use this as the shared status surface across mission board, packet dependencies, paper lifecycle, and navigation state.
6. Do not execute work, run tests, inspect git, repair state, or mutate source assets from this surface.
7. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
8. Use this shared Dove control-plane surface across paper, engineering, experiment, review, and general missions; route to `dove.paper.*` only for paper-specific artifact workflows.
9. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
