# dove.orchestrate

Route one Dove mission without mutating durable state.

## Workflow

1. Treat `.paper/` as the active durable root and `.dove/` as planned future migration metadata only.
2. Prefer the `query_dove_orchestrate` MCP tool when available, or run `paper-factory dove-orchestrate .` / `dove orchestrate .` for the same proposal-only route.
3. Return exactly one compatible next command, the mission domain, mission stage, role boundary, and reason.
4. Preserve the planner / builder / reviewer split; in paper compatibility mode, builder maps to author.
5. Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
