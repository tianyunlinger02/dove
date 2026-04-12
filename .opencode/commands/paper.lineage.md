# paper.lineage

Inspect task, review, and version lineage.

## Goal

Understand how the current workspace evolved across snapshots, comparisons, and packet-linked work items.

## Workflow

1. Read `.paper/versions/index.json`, `.paper/versions/comparisons.json`, `.paper/claims/bridge-log.json`, `.paper/experiments/audits.json`, `.paper/wiki/navigation.md`, and `.paper/task-packets/index.json`.
2. If `paper-factory` MCP is available, call `query_lineage`.
3. Use the lineage surface to explain what changed, why it changed, and which durable artifacts justify the change, including audit and bridge records when claims moved.
