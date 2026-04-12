# paper.decisions

Inspect durable decisions and workflow pivots.

## Goal

Read the decision surface that explains current role ownership, version selection, comparison steps, and explicit task-packet decisions.

## Workflow

1. Read `.paper/wiki/navigation.md`, `.paper/wiki/entities.json`, `.paper/orchestration/board.json`, `.paper/workspace/index.json`, `.paper/versions/index.json`, and related artifacts as needed.
2. If `paper-factory` MCP is available, call `query_decisions`.
3. Record any new planning, review, or rebuttal decisions back into board tasks or durable artifacts instead of leaving them implicit.
