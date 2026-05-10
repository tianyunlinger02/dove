# dove-paper-rebuttal

Normalize reviewer issues, build a rebuttal strategy, and draft the rebuttal response.

## Contract

- Command id: `dove.paper.rebuttal`
- Domain: `paper`
- Category: `paper-workflow`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/rebuttal/issues.json`, `.dove/rebuttal/strategy.md`, `.dove/rebuttal`.
3. Use the `normalize_rebuttal_issues`, `build_rebuttal_strategy`, `build_rebuttal` MCP tools when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Normalize reviewer issues before drafting responses.
6. Keep revision/rebuttal work builder-side.
7. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
8. If target resolution is ambiguous, follow `.dove/state.json.settings.taskTargetResolution.autoSelect`: true auto-selects the best candidate; false stops and asks for packetId confirmation.
9. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
10. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
11. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
12. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
