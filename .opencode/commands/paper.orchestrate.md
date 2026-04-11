# paper.orchestrate

Align the durable orchestration board and decide the next role-owned step.

## Goal

Treat `.paper/orchestration/board.json` as the canonical workflow board, then update `.paper/orchestration/handoffs.md` when responsibility changes.

## Workflow

1. Read `.paper/orchestration/board.json`, `.paper/orchestration/handoffs.md`, `.paper/state.json`, and `.paper/checklists/paper.md`.
2. If `paper-factory` MCP is available, prefer `upsert_orchestration_board` for board mutations and `append_handoff` for role transitions.
3. Keep the board machine-checkable: phase, assigned role, tasks, blockers, evidence links, experiment IDs, rebuttal issue IDs, version lineage, and active comparison targets must stay explicit.
4. Return the next best role-specific command.
