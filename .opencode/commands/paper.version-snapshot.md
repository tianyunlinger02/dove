# paper.version-snapshot

Snapshot the current paper state before a major revision or submission step.

## Goal

Write a durable version snapshot under `.paper/versions/snapshots/` and update `.paper/versions/index.json` plus board lineage.

## Workflow

1. Read `.paper/orchestration/board.json`, `.paper/state.json`, `.paper/evidence/index.json`, `.paper/reviews/REVIEW_STATE.json`, and `.paper/versions/index.json`.
2. If `paper-factory` MCP is available, call `create_version_snapshot`.
3. Capture the current review verdict, claims, experiment coverage, and parent version honestly.
4. Return the snapshot ID and whether a comparison should run next.
