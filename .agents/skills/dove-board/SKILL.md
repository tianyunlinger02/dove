---
name: dove-board
description: "Read the Dove mission board from authoritative .dove state without writing, refreshing, running tests, or inspecting git."
---

# Dove Board

- Treat `.dove/` as the authoritative durable root.
- Prefer `query_dove_mission_board` through MCP, or run `dove board .`.
- Return board goal, domain, stage, role boundary, mission queues, counts, filters, and return protocol.
- Treat packet paths as declared durable evidence, not as hidden git inspection.
- Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
