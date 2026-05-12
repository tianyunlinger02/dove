# dove-status

Show the project goal, active task tree, task states, blockers, versions, lessons, review state, and return readiness.

## Contract

- Command id: `dove.status`
- Domain: `generic`
- Category: `query`
- Policy: `query`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`, `.dove/reviews/REVIEW_STATE.json`, `.dove/reviews/concerns.json`, `.dove/versions/index.json`, `.dove/versions/comparisons.json`, `.dove/meta/operator-lessons.json`, `.dove/experiments`, `.dove/checklists/current.md`, `.dove/orchestration/board.json`.
4. Prefer the `query_dove_status` MCP tool when available.
5. Keep this surface read-only unless the named MCP tool explicitly performs a governed refresh.
6. Use status as the unified project and task dashboard; do not expose separate plan, checklist, audit, return, or orchestration slash surfaces.
7. Build the main dashboard from authoritative state, task packet, review, version, lesson, and experiment indexes; treat workspace/wiki/navigation reports only as diagnostics.
8. Do not execute work, run tests, inspect git, repair state, or mutate artifacts from this surface.
9. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
10. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
11. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
