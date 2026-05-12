# dove-mission

Create a task under the init goal after classifying stage, domain, level, dependencies, blockers, and evidence expectations.

## Contract

- Command id: `dove.mission`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`, `.dove/meta/operator-lessons.json`.
4. Prefer the `create_dove_task` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. Require an existing init goal before creating mission tasks.
7. Classify each task as `plan`, `execute`, or `audit` and as `paper`, `experiment`, or `engineering` before writing.
8. User-created tasks default to level 3; only system-created prerequisite/controller tasks may be level 1 or 2.
9. Do not execute the task from this surface; return the created task, blockers, evidence expectations, and recommended next command.
10. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
11. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
12. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
