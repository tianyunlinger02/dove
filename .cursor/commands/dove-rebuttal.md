# dove-rebuttal

Normalize reviewer issues, build a rebuttal strategy, and draft submission/revision responses.

## Contract

- Command id: `dove.rebuttal`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/rebuttal/issues.json`, `.dove/rebuttal/strategy.md`, `.dove/rebuttal`.
4. Use the `normalize_rebuttal_issues`, `build_rebuttal_strategy`, `build_rebuttal` MCP tools when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. Normalize reviewer issues before drafting responses.
7. Keep rebuttal and revision response work author-side.
8. Link each response to claims, draft sections, experiments, or explicit unresolved placeholders.
9. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
10. If target resolution is ambiguous, follow `.dove/state.json.settings.taskTargetResolution.autoSelect`: true auto-selects the best candidate; false stops and asks for packetId confirmation.
11. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
12. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
13. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
14. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
