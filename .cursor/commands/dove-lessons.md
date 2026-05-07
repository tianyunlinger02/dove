# dove-lessons

Record or inspect concise operator lessons and retrospectives without importing raw runtime traces.

## Contract

- Command id: `dove.lessons`
- Domain: `generic`
- Category: `mutation`
- Policy: `governed-bookkeeping`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/meta/operator-lessons.json`.
3. Use the `query_operator_lessons`, `record_operator_lesson` MCP tools when available.
4. Record only explicit operator bookkeeping for the governed Dove workflow.
5. Record only distilled lessons with problem, decisions, pitfalls, validation, and next-time guidance.
6. Do not import or cite ignored raw runtime traces.
7. Do not materialize, approve, launch, or execute work from lessons.
8. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
9. For paper-specific work, route to the matching `dove.paper.*` surface instead of adding a second workflow branch.
10. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
