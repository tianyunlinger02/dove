# dove-task-graph

Inspect the durable Dove task graph across all mission domains.

- Authoritative durable root: `.dove/`.
- Prefer `query_task_graph` through MCP, or read `.dove/task-packets/index.json`, `.dove/workspace/index.json`, and `.dove/wiki/navigation.md`.
- Summarize packets by domain, lifecycle stage, lifecycle status, role owner, dependencies, blockers, priority pressure, and handoff readiness.
- Read packet/action context before acting on a packet.
- Do not create packets, refresh indexes, run tests, inspect git, execute autonomy, or mutate `.dove/` from this command.
