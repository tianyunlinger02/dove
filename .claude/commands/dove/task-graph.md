# dove.task-graph

Inspect task packets, dependencies, blockers, and review-needed work.

## Contract

- Command id: `dove.task-graph`
- Domain: `generic`
- Category: `query`
- Policy: `query`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/task-packets/index.json`, `.dove/context/packets`.
3. Prefer the `query_task_graph` MCP tool when available.
4. Keep this surface read-only unless the named MCP tool explicitly performs a governed refresh.
5. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
6. For paper-specific work, route to the matching `dove.paper.*` surface instead of adding a second workflow branch.
7. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
