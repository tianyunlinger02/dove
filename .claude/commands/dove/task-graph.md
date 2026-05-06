# dove.task-graph

Inspect the durable Dove task graph across all mission domains.

## Workflow

1. Treat `.dove/` as the authoritative durable root.
2. Prefer the `query_task_graph` MCP tool when available; otherwise read `.dove/task-packets/index.json`, `.dove/workspace/index.json`, and `.dove/wiki/navigation.md`.
3. Summarize active packets by domain, lifecycle stage, lifecycle status, role owner, dependencies, blockers, priority pressure, and handoff readiness.
4. Before acting on a packet, read its packet context and action context.
5. Do not create packets, refresh indexes, run tests, inspect git, execute autonomy, or mutate `.dove/` from this command.
