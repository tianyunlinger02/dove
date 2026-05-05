# dove-audit

Inspect a Dove mission without fixing or mutating durable state.

- Authoritative durable root: `.dove/`.
- Prefer `query_dove_audit` through MCP, or run `dove audit .`.
- Return audit verdict, severity counts, category counts, findings, return readiness, engineering evidence, and one next command.
- Findings are proposal-only and must not apply repairs.
- Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
