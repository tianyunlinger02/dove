# paper.figure

Plan the figure and table backlog for `$FIGURE_SCOPE`.

## Goal

Keep figure planning durable and reproducible without making heavy generation tooling mandatory.

## Workflow

1. Read `.paper/plans/current-plan.md`, `.paper/outline/current-outline.md`, `.paper/figures/README.md`, `.paper/figures/briefs.json`, `.paper/figures/segments.json`, `.paper/figures/templates.json`, and `.paper/figures/editable-index.json`.
2. If `paper-factory` MCP is available, call `upsert_figure_plan`.
3. For each figure, record source sections, target claims, narrative intent, required visual elements, segmentation placeholders, template/final SVG paths, review notes, owner, mode, and status.

## Constraint

This command plans figures and their artifact contracts; it does not claim to generate them automatically or ship a render backend.
