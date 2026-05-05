# dove.paper.lineage

Inspect task, review, and version lineage.

## Goal

Understand how the current workspace evolved across snapshots, comparisons, and packet-linked work items.

## Workflow

1. Read `.dove/versions/index.json`, `.dove/versions/comparisons.json`, `.dove/claims/bridge-log.json`, `.dove/experiments/audits.json`, `.dove/wiki/navigation.md`, and `.dove/task-packets/index.json`.
2. If `dove` MCP is available, call `query_lineage`.
3. Use the lineage surface to explain what changed, why it changed, and which durable artifacts justify the change, including audit and bridge records when claims moved.
