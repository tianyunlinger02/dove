---
name: dove-orchestrate
description: "Route one Dove mission through the compatibility-backed .paper workflow without writing, refreshing, running tests, inspecting git, or executing autonomy."
---

# Dove Orchestrate

- Treat `.paper/` as the active durable root and `.dove/` as planned future migration metadata only.
- Prefer `query_dove_orchestrate` through MCP, or run `paper-factory dove-orchestrate .` / `dove orchestrate .`.
- Return exactly one compatible next command, mission domain, mission stage, role boundary, and reason.
- Preserve the planner / builder / reviewer split.
- Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
