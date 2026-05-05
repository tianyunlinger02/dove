# dove.paper.version-snapshot

Snapshot the current paper state before a major revision or submission step.

## Goal

Write a durable version snapshot under `.dove/versions/snapshots/` and update `.dove/versions/index.json` plus board lineage so acceptance and regression checks have a stable baseline.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/orchestration/board.json`, `.dove/state.json`, `.dove/plans/current-plan.md`, `.dove/checklists/paper.md`, `.dove/evidence/index.json`, `.dove/reviews/REVIEW_STATE.json`, and `.dove/versions/index.json`.
2. If `dove` MCP is available, call `create_version_snapshot`.
3. Capture the current review verdict, claims, experiment coverage, checklist status, major-change stage, and parent version honestly.
4. For major changes, treat the snapshot as acceptance evidence only when checklist and review state support closure.
5. Return the snapshot ID and whether `project:dove.paper.version-compare` should run next.
