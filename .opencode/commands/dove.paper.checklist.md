# dove.paper.checklist

Sync the execution checklist with the current workspace state and major-change design contract.

## Goal

Refresh `.dove/checklists/paper.md` so it reflects what is actually done, what is blocked, what design/checklist/implementation/acceptance stage is active, and what the review loop still requires.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/state.json`, `.dove/plans/current-plan.md`, `.dove/reviews/REVIEW_STATE.json`, `.dove/revision-plans/current-plan.md`, `.dove/workspace/index.json`, and the draft directory.
2. For major changes, turn the design into concrete implementation steps plus acceptance checks, preserving scope, non-goals, evidence requirements, and review/version proof obligations.
3. If `dove` MCP is available, call `sync_checklist`.
4. Never mark an item done unless the files support it.
5. When checklist items are ready for execution, route implementation to `project:dove.paper.draft`, `project:dove.paper.revise`, `project:dove.paper.experiment-plan`, `project:dove.paper.result-bridge`, or the specific command that owns the target artifact.
