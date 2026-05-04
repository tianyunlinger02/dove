# paper.checklist

Sync the execution checklist with the current workspace state and major-change design contract.

## Goal

Refresh `.paper/checklists/paper.md` so it reflects what is actually done, what is blocked, what design/checklist/implementation/acceptance stage is active, and what the review loop still requires.

## Workflow

1. Read `.paper/context/actions/current.json` when present, then `.paper/state.json`, `.paper/plans/current-plan.md`, `.paper/reviews/REVIEW_STATE.json`, `.paper/revision-plans/current-plan.md`, `.paper/workspace/index.json`, and the draft directory.
2. For major changes, turn the design into concrete implementation steps plus acceptance checks, preserving scope, non-goals, evidence requirements, and review/version proof obligations.
3. If `paper-factory` MCP is available, call `sync_checklist`.
4. Never mark an item done unless the files support it.
5. When checklist items are ready for execution, route implementation to `project:paper.draft`, `project:paper.revise`, `project:paper.experiment-plan`, `project:paper.result-bridge`, or the specific command that owns the target artifact.
