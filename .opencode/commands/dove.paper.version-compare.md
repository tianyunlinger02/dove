# dove.paper.version-compare

Compare two durable paper snapshots.

## Goal

Use `.dove/versions/comparisons.json` and `.dove/versions/LATEST_COMPARISON.md` to make version evolution explicit and auditable.

## Workflow

1. Read `.dove/orchestration/board.json`, `.dove/versions/index.json`, `.dove/versions/comparisons.json`, and the relevant snapshot files in `.dove/versions/snapshots/`.
2. If `dove` MCP is available, call `compare_versions`.
3. Report claim, verdict, experiment, and section-status differences honestly.
4. Return what changed materially and what still needs review.
