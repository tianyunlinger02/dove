# paper.task-graph

Inspect the durable task graph.

## Goal

Read `.paper/task-packets/index.json` and `.paper/wiki/navigation.md` to understand active packets, hierarchy, dependencies, current focus, next action, and cross-links to experiments, rebuttal issues, and versions.

## Workflow

1. Read `.paper/context/actions/current.json`, then `.paper/orchestration/board.json`, `.paper/task-packets/index.json`, and `.paper/wiki/navigation.md`.
2. If `paper-factory` MCP is available, call `query_task_graph`.
3. When a specific packet needs action, also read its `.paper/context/packets/*.json`, the matching `.paper/context/actions/packet-*.json`, and any linked `.paper/context/artifacts/*.json` files before mutating local state.
4. Use the task graph to identify blocked work, stale packets, packets created by governed autonomy materialization, review-needed packets produced by bounded autonomy, packets carrying explicit autonomy envelopes, packets linked to approved program runs, missing parent/child linkage, and missing linkage between tasks and durable evidence artifacts.
