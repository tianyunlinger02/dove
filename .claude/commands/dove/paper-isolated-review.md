# dove.paper.isolated-review

Prepare and import isolated reviewer handoffs through explicit artifacts.

## Contract

- Command id: `dove.paper.isolated-review`
- Domain: `paper`
- Category: `paper-workflow`
- Policy: `isolated-handoff`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/reviews/isolated`, `.dove/reviews/concerns.json`, `.dove/orchestration/board.json`, `.dove/reviews/log.md`, `.dove/orchestration/handoffs.md`.
3. Use the `prepare_isolated_review`, `import_isolated_review` MCP tools when available.
4. Use explicit handoff artifacts for reviewer isolation; do not share hidden session context.
5. Prepare and import explicit artifacts through MCP; external reviewer process execution remains CLI-only.
6. Pass only explicit input artifacts to the reviewer and import only handoff/report artifacts back.
7. Never import a private reviewer transcript.
8. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
9. If target resolution is ambiguous, follow `.dove/state.json.settings.taskTargetResolution.autoSelect`: true auto-selects the best candidate; false stops and asks for packetId confirmation.
10. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
11. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
12. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
13. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
