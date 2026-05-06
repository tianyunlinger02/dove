---
name: dove-paper-figure
description: "Manage figure artifact contracts and validation state."
---

# Dove Paper Figure

Manage figure artifact contracts and validation state.

## Contract

- Command id: `dove.paper.figure`
- Domain: `paper`
- Category: `paper-workflow`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/figures`, `.dove/figures/qa.json`.
3. Use the `upsert_figure_plan`, `validate_figure_pipeline` MCP tools when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Keep figure records as artifact contracts and QA state; do not claim a render/editor backend.
6. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
7. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
8. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
