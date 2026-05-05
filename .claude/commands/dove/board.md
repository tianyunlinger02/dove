# dove.board

Read the Dove mission board without mutating durable state.

## Workflow

1. Treat `.dove/` as the authoritative durable root.
2. Prefer the `query_dove_mission_board` MCP tool when available, or run `dove board .` for the same proposal-only board snapshot.
3. Summarize the current board goal, domain, stage, role boundary, mission queues, counts, filters, and return protocol.
4. Use packet fields only as declared durable mission evidence, not as proof of a hidden git diff.
5. Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
