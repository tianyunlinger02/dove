# dove-orchestrate

Route one Dove mission without mutating durable state.

- Authoritative durable root: `.dove/`.
- Prefer `query_dove_orchestrate` through MCP, or run `dove orchestrate .`.
- Return one recommended command, mission domain, mission stage, role boundary, and reason.
- Preserve planner / builder / reviewer separation.
- Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
