---
name: dove-orchestrate
description: "Route one Dove mission from authoritative .dove state without writing, refreshing, running tests, inspecting git, or executing autonomy."
---

# Dove Orchestrate

- Treat `.dove/` as the authoritative durable root.
- Prefer `query_dove_orchestrate` through MCP, or run `dove orchestrate .`.
- Return exactly one next command, mission domain, mission stage, role boundary, and reason.
- Preserve the planner / builder / reviewer split.
- Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
