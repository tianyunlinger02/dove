# paper.version-compare

Compare two durable paper snapshots.

## Goal

Use `.paper/versions/comparisons.json` and `.paper/versions/LATEST_COMPARISON.md` to make version evolution explicit and auditable.

## Workflow

1. Read `.paper/orchestration/board.json`, `.paper/versions/index.json`, `.paper/versions/comparisons.json`, and the relevant snapshot files in `.paper/versions/snapshots/`.
2. If `paper-factory` MCP is available, call `compare_versions`.
3. Report claim, verdict, experiment, and section-status differences honestly.
4. Return what changed materially and what still needs review.
