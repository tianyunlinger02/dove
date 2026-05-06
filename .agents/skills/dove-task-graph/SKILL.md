---
name: dove-task-graph
description: "Inspect the durable Dove task graph from authoritative .dove state without writing, refreshing, running tests, or inspecting git."
---

# Dove Task Graph

- Treat `.dove/` as the authoritative durable root.
- Prefer `query_task_graph` through MCP, or read `.dove/task-packets/index.json`, `.dove/workspace/index.json`, and `.dove/wiki/navigation.md`.
- Return packets by domain, lifecycle stage, lifecycle status, role owner, dependencies, blockers, priority pressure, and handoff readiness.
- Read packet/action context before acting on a packet.
- Do not create packets, refresh indexes, run tests, inspect git, execute autonomy, or mutate `.dove/` from this skill.
