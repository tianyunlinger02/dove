# dove-return

Inspect whether a Dove mission can return without mutating durable state.

- Authoritative durable root: `.dove/`.
- Prefer `query_dove_return` through MCP, or run `dove return .`.
- For engineering missions, require declared changed files, declared test or validation evidence, and passing validation output before calling the return ready.
- Return status, missing evidence, checklist/review state, engineering evidence, and one next command.
- Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, create snapshots, or materialize mission packets.
