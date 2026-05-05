# dove.mission

Frame one Dove mission contract without mutating durable state.

## Workflow

1. Treat `.dove/` as the authoritative durable root.
2. Prefer the `query_dove_mission` MCP tool when available, or run `dove mission .` for the same proposal-only mission frame.
3. Report the goal, domain, stage, primary role, target artifacts, acceptance checks, and return protocol.
4. Keep paper-domain work on `project:dove.paper.*` commands instead of creating a separate product branch.
5. Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
