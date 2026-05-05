# dove.paper.decisions

Inspect durable decisions and workflow pivots.

## Goal

Read the decision surface that explains current role ownership, version selection, comparison steps, and explicit task-packet decisions.

## Workflow

1. Read `.dove/wiki/navigation.md`, `.dove/wiki/entities.json`, `.dove/orchestration/board.json`, `.dove/workspace/index.json`, `.dove/versions/index.json`, and related artifacts as needed.
2. If `dove` MCP is available, call `query_decisions`.
3. Record any new planning, review, or rebuttal decisions back into board tasks or durable artifacts instead of leaving them implicit.
