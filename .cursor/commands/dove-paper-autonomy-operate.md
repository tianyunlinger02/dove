# dove-paper-autonomy-operate

Paper-domain view of explicit bounded foreground autonomy.

## Contract

- Command id: `dove.paper.autonomy-operate`
- Domain: `paper`
- Category: `mutation`
- Policy: `explicit-approval`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/runtime/controller-state.json`, `.dove/programs/approvals.json`, `.dove/task-packets/index.json`.
3. Prefer the `run_autonomy_operate` MCP tool when available.
4. Require explicit operator approval and bounded authority before creating, changing, or consuming program authority.
5. Run only explicit bounded foreground autonomy and stop at declared review or authority boundaries.
6. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
7. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
8. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
