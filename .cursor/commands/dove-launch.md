# dove-launch

Materialize accepted guidance into a governed Dove mission packet without executing it.

## Contract

- Command id: `dove.launch`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/meta/operator-follow-through.json`, `.dove/task-packets/index.json`, `.dove/programs/approvals.json`.
3. Prefer the `launch_dove_mission` MCP tool when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Require an accepted source plus explicit `executeBy` and `reviewAfter`; create the mission packet only and do not execute autonomy.
6. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
7. For paper-specific work, route to the matching `dove.paper.*` surface instead of adding a second workflow branch.
8. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
