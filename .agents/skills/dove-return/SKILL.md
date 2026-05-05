---
name: dove-return
description: "Inspect Dove mission return readiness from authoritative .dove state without writing, fixing, refreshing, running tests, or inspecting git."
---

# Dove Return

- Treat `.dove/` as the authoritative durable root.
- Prefer `query_dove_return` through MCP, or run `dove return .`.
- For engineering missions, require declared changed files, declared test or validation evidence, and passing validation output before calling the return ready.
- Return status, missing evidence, checklist/review state, engineering evidence, and one next command.
- Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, create snapshots, or materialize mission packets.
