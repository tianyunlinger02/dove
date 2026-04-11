# paper.outline

Create or revise the section outline.

## Goal

Make `.paper/outline/current-outline.md` the canonical structure for the manuscript before large drafting passes.

## Workflow

1. Read `.paper/plans/current-plan.md`, `.paper/claims/CLAIMS_FROM_RESULTS.md`, and `.paper/notes/index.json`.
2. If `paper-factory` MCP is available, call `upsert_outline`.
3. For each section, record the goal, status, and evidence focus.
