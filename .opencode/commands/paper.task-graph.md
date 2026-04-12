# paper.task-graph

Inspect the durable task graph.

## Goal

Read `.paper/task-packets/index.json` and `.paper/wiki/navigation.md` to understand active packets, hierarchy, dependencies, current focus, next action, and cross-links to experiments, rebuttal issues, and versions.

## Workflow

1. Read `.paper/orchestration/board.json`, `.paper/task-packets/index.json`, and `.paper/wiki/navigation.md`.
2. If `paper-factory` MCP is available, call `query_task_graph`.
3. Use the task graph to identify blocked work, stale packets, missing parent/child linkage, and missing linkage between tasks and durable evidence artifacts.
