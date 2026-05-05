# dove.audit

Inspect a Dove mission without fixing or mutating durable state.

## Workflow

1. Treat `.paper/` as the active durable root and `.dove/` as planned future migration metadata only.
2. Prefer the `query_dove_audit` MCP tool when available, or run `paper-factory dove-audit .` / `dove audit .` for the same proposal-only audit.
3. Report mission audit verdict, severity counts, category counts, findings, return readiness, engineering evidence, and one compatible next command.
4. Keep strict no-fix behavior: findings may route work, but this command never applies repairs.
5. Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
