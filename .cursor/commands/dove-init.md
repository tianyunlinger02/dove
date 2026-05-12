# dove-init

Create or update the single project-level Dove goal as the unique level-0 task.

## Contract

- Command id: `dove.init`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`.
4. Prefer the `init_dove_goal` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. There is exactly one level-0 init task; update it instead of creating a second root.
7. Use init only for the global project goal, then route concrete work through `/dove:mission` or `/dove:auto`.
8. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
9. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
10. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
