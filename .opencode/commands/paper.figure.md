# paper.figure

Plan the figure and table backlog for `$FIGURE_SCOPE`.

## Goal

Keep figure planning durable and reproducible without making heavy generation tooling mandatory.

## Workflow

1. Read `.paper/plans/current-plan.md`, `.paper/outline/current-outline.md`, and `.paper/figures/README.md`.
2. If `paper-factory` MCP is available, call `upsert_figure_plan`.
3. For each figure, record purpose, inputs, owner, mode, and status.

## Constraint

This command plans figures; it does not claim to generate them automatically.
