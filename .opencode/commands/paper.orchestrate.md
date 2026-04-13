# paper.orchestrate

Align the durable orchestration board and decide the next role-owned step.

## Goal

Treat `.paper/orchestration/board.json` as the canonical workflow board, then update `.paper/orchestration/handoffs.md` when responsibility changes.

## Workflow

1. Read `.paper/context/actions/current.json`, then `.paper/orchestration/board.json`, `.paper/orchestration/handoffs.md`, `.paper/state.json`, `.paper/checklists/paper.md`, and `.paper/workspace/index.json`.
2. If `paper-factory` MCP is available, prefer `upsert_orchestration_board` for board mutations and `append_handoff` for role transitions.
3. Keep the board machine-checkable: phase, intent type, assigned role, current focus, next action, continuation state, review-before-finalize status, tasks, blockers, evidence links, experiment IDs, rebuttal issue IDs, version lineage, active comparison targets, and any packet-linked questions/decisions must stay explicit.
4. Surface the nearest local guidance before acting: prefer the current action bundle, then the active role/phase manifest, then any packet or artifact context manifest tied to the work you are about to change.
5. Refresh task packets, phase manifests, role context manifests, artifact context manifests, action bundles, and the workspace index so the next step is resumable from files only.
6. Return the next best role-specific command and explain why that command matches the current focus plus next action.
