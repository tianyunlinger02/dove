# dove-version

Create a direction-change point, clear active non-init tasks, and preserve the init goal plus necessary lessons.

## Contract

- Command id: `dove.version`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`, `.dove/versions`, `.dove/meta/operator-lessons.json`.
4. Prefer the `reset_dove_version` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. Snapshot the current direction before resetting active tasks.
7. Clear active non-init tasks so only the level-0 init task remains active.
8. Preserve the level-0 init goal and required global or task lessons that still apply to future work.
9. Return a clean status summary and recommend `/dove:mission` for the next direction.
10. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
11. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
12. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
