# paper.figure

Plan the figure and table backlog for `$FIGURE_SCOPE`.

## Goal

Keep figure planning durable and reproducible without making heavy generation tooling mandatory.

## Workflow

1. Read `.paper/plans/current-plan.md`, `.paper/outline/current-outline.md`, `.paper/figures/README.md`, `.paper/figures/briefs.json`, `.paper/figures/segments.json`, `.paper/figures/templates.json`, `.paper/figures/editable-index.json`, `.paper/figures/final-index.json`, and `.paper/figures/qa.json`.
2. If `paper-factory` MCP is available, call `upsert_figure_plan` and then `validate_figure_pipeline`.
3. For each figure, record source sections, source artifact paths, target claims, related experiments, review concerns, rebuttal issues, narrative intent, required visual elements, segmentation placeholders, template/editable/final SVG paths, review notes, owner, mode, and status.
4. Keep the staged progression durable: brief -> segment placeholders -> template -> editable -> final contract -> QA.
5. Treat missing stage artifacts, missing claim linkage, inconsistent figure paths, and unresolved review-note gaps as durable QA issues rather than hidden TODOs.

## Constraint

This command plans figures and their artifact contracts; it does not claim to generate them automatically or ship a render backend.
