# paper.checklist

Sync the execution checklist with the current workspace state.

## Goal

Refresh `.paper/checklists/paper.md` so it reflects what is actually done, what is blocked, and what the review loop still requires.

## Workflow

1. Read `.paper/state.json`, `.paper/reviews/REVIEW_STATE.json`, `.paper/revision-plans/current-plan.md`, and the draft directory.
2. If `paper-factory` MCP is available, call `sync_checklist`.
3. Never mark an item done unless the files support it.
