# dove.mission

Frame one Dove mission contract without mutating durable state.

## Workflow

1. Treat `.paper/` as the active durable root and `.dove/` as planned future migration metadata only.
2. Prefer the `query_dove_mission` MCP tool when available, or run `paper-factory dove-mission .` / `dove mission .` for the same proposal-only mission frame.
3. Report the goal, domain, stage, primary role, compatible paper role, target artifacts, acceptance checks, and return protocol.
4. Keep paper-specific work on existing `paper.*` owner commands instead of creating a parallel Dove branch.
5. Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
