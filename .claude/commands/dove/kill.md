# dove.kill

Terminate a non-init Dove task and record the reason.

## Contract

- Command id: `dove.kill`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`.
4. Prefer the `kill_dove_task` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. Never kill the level-0 init task.
7. Return indexed task choices when no unique task target is supplied and multiple active tasks exist, then wait for the operator to choose.
8. Mark the selected task killed instead of deleting its durable packet.
9. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
10. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
11. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
