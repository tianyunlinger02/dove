# dove-mission

Frame one Dove mission without mutating durable state.

- Authoritative durable root: `.dove/`.
- Prefer `query_dove_mission` through MCP, or run `dove mission .`.
- Return goal, domain, stage, primary role, target artifacts, acceptance checks, and return protocol.
- Keep paper-domain execution on `project:dove.paper.*` owner commands.
- Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
