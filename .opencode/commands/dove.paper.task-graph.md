# dove.paper.task-graph

Inspect the paper-domain view of the durable Dove task graph.

## Goal

Use `project:dove.task-graph` semantics, scoped to paper-writing packets, claims, citations, experiments, rebuttal issues, figures, reviews, and versions.

## Workflow

1. Read `.dove/context/actions/current.json`, then `.dove/orchestration/board.json`, `.dove/task-packets/index.json`, `.dove/workspace/index.json`, and `.dove/wiki/navigation.md`.
2. If `dove` MCP is available, call `query_task_graph`.
3. Filter or highlight packets whose `doveDomain` is `paper`, `experiment`, or `review`, plus packets linked to paper artifacts.
4. When a specific packet needs action, read its `.dove/context/packets/*.json`, matching `.dove/context/actions/packet-*.json`, and linked `.dove/context/artifacts/*.json` files before mutating local state.

## Rule

This is a paper-domain view of `project:dove.task-graph`, not a separate task system. Do not mutate `.dove/` from this command.
