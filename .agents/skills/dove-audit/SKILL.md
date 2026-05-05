---
name: dove-audit
description: "Inspect a Dove mission audit and return readiness without writing, fixing, refreshing, running tests, or inspecting git."
---

# Dove Audit

- Treat `.paper/` as the active durable root and `.dove/` as planned future migration metadata only.
- Prefer `query_dove_audit` through MCP, or run `paper-factory dove-audit .` / `dove audit .`.
- Return audit verdict, severity counts, category counts, findings, return readiness, engineering evidence, and one compatible next command.
- Findings are proposal-only and must not apply repairs.
- Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
