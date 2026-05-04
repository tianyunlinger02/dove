# paper.version-snapshot

Snapshot the current paper state before a major revision or submission step.

## Goal

Write a durable version snapshot under `.paper/versions/snapshots/` and update `.paper/versions/index.json` plus board lineage so acceptance and regression checks have a stable baseline.

## Workflow

1. Read `.paper/context/actions/current.json` when present, then `.paper/orchestration/board.json`, `.paper/state.json`, `.paper/plans/current-plan.md`, `.paper/checklists/paper.md`, `.paper/evidence/index.json`, `.paper/reviews/REVIEW_STATE.json`, and `.paper/versions/index.json`.
2. If `paper-factory` MCP is available, call `create_version_snapshot`.
3. Capture the current review verdict, claims, experiment coverage, checklist status, major-change stage, and parent version honestly.
4. For major changes, treat the snapshot as acceptance evidence only when checklist and review state support closure.
5. Return the snapshot ID and whether `project:paper.version-compare` should run next.
