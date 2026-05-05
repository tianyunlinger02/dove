# dove.paper.open-questions

Inspect unresolved questions before pushing the workflow forward.

## Goal

Read open questions across notes, review state, and task packets so unresolved uncertainty becomes durable work instead of hidden prompt memory.

## Workflow

1. Read `.dove/notes/index.json`, `.dove/reviews/REVIEW_STATE.json`, `.dove/task-packets/index.json`, `.dove/wiki/entities.json`, and `.dove/wiki/navigation.md`.
2. If `dove` MCP is available, call `query_open_questions`.
3. Convert important unanswered questions into explicit board tasks, research agenda items, persistent concerns, or rebuttal issues.
