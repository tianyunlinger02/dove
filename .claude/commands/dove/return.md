# dove.return

Inspect whether a Dove mission can return without mutating durable state.

## Workflow

1. Treat `.dove/` as the authoritative durable root.
2. Prefer the `query_dove_return` MCP tool when available, or run `dove return .` for the same proposal-only return readiness check.
3. For engineering missions, require declared changed files, declared test or validation evidence, and passing validation output before calling the return ready.
4. Report return status, missing evidence, checklist/review state, engineering evidence, and one next command.
5. Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, create snapshots, or materialize mission packets.
