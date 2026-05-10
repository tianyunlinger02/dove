# dove.autonomy-operate

Run the primary explicit bounded foreground autonomy operating surface.

## Contract

- Command id: `dove.autonomy-operate`
- Domain: `generic`
- Category: `mutation`
- Policy: `explicit-approval`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/runtime/controller-state.json`, `.dove/programs/approvals.json`, `.dove/task-packets/index.json`.
3. Prefer the `run_autonomy_operate` MCP tool when available.
4. Require explicit operator approval and bounded authority before creating, changing, or consuming program authority.
5. Use this as the normal user-facing autonomy entrypoint; `autonomy-once` and `autonomy-foreground` are lower-level CLI/MCP controls.
6. Run only explicit bounded foreground autonomy and stop at declared review or authority boundaries.
7. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
8. Use this shared Dove control-plane surface across paper, engineering, experiment, review, and general missions; route to `dove.paper.*` only for paper-specific artifact workflows.
9. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
