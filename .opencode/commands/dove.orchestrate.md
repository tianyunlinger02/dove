# dove.orchestrate

Route one Dove mission without mutating durable state.

## Goal

Use authoritative `.dove/` context and the operator request to recommend exactly one next Dove command. This command is a router, not a board updater or executor.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/workspace/index.json`, `.dove/orchestration/board.json`, `.dove/state.json`, and `.dove/task-packets/index.json`.
2. If the `dove` MCP server is available, call `query_dove_orchestrate` with the requested goal, domain, stage, artifacts, and acceptance checks.
3. Classify the mission domain as `paper`, `engineering`, `experiment`, `review`, or `general`.
4. Place the mission on the lifecycle: `goal`, `design`, `checklist`, `execution`, `audit`, or `return`.
5. Preserve the planner / builder / reviewer role boundary.
6. Return exactly one next command and the reason.
7. Do not write, repair, refresh, run tests, inspect git, execute autonomy, update the board, append handoffs, or materialize mission packets.
