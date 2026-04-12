# paper.open-questions

Inspect unresolved questions before pushing the workflow forward.

## Goal

Read open questions across notes, review state, and task packets so unresolved uncertainty becomes durable work instead of hidden prompt memory.

## Workflow

1. Read `.paper/notes/index.json`, `.paper/reviews/REVIEW_STATE.json`, `.paper/task-packets/index.json`, `.paper/wiki/entities.json`, and `.paper/wiki/navigation.md`.
2. If `paper-factory` MCP is available, call `query_open_questions`.
3. Convert important unanswered questions into explicit board tasks, research agenda items, persistent concerns, or rebuttal issues.
