# dove.paper.outline

Create or revise the section outline.

## Goal

Make `.dove/outline/current-outline.md` the canonical structure for the manuscript before large drafting passes.

## Workflow

1. Read `.dove/plans/current-plan.md`, `.dove/claims/CLAIMS_FROM_RESULTS.md`, and `.dove/notes/index.json`.
2. If `dove` MCP is available, call `upsert_outline`.
3. For each section, record the goal, status, and evidence focus.
