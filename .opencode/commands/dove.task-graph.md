# dove.task-graph

Inspect the durable Dove task graph across mission domains.

## Goal

Read `.dove/task-packets/index.json` and `.dove/wiki/navigation.md` to understand active packets, hierarchy, dependencies, priority pressure, current focus, next action, and cross-links to experiments, reviews, rebuttal issues, versions, and engineering evidence.

## Workflow

1. Read `.dove/context/actions/current.json`, then `.dove/orchestration/board.json`, `.dove/task-packets/index.json`, `.dove/workspace/index.json`, and `.dove/wiki/navigation.md`.
2. If `dove` MCP is available, call `query_task_graph`.
3. Group packets by Dove domain, lifecycle stage, lifecycle status, role owner, dependency health, blocker state, and handoff readiness.
4. When a specific packet needs action, read its `.dove/context/packets/*.json`, the matching `.dove/context/actions/packet-*.json`, and any linked `.dove/context/artifacts/*.json` files before mutating local state.
5. Use the task graph to identify blocked work, stale packets, review-needed packets, governed autonomy packets, explicit autonomy envelopes, approved program-run links, missing parent/child linkage, and missing durable evidence links.

## Rule

This command is inspection/navigation only. Do not create packets, refresh indexes, run autonomy, run tests, inspect git, or mutate `.dove/` from this command.
