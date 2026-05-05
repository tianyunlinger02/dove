# dove.orchestrate

Route one Dove mission without mutating durable state.

## Workflow

1. Treat `.dove/` as the authoritative durable root.
2. Prefer the `query_dove_orchestrate` MCP tool when available, or run `dove orchestrate .` for the same proposal-only route.
3. Return exactly one next command, the mission domain, mission stage, role boundary, and reason.
4. Preserve the planner / builder / reviewer split.
5. Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
