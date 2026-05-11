---
name: dove-paper-figure
description: "Plan, prepare, generate/import, caption, and validate paper figures."
---

# Dove Paper Figure

Plan, prepare, generate/import, caption, and validate paper figures.

## Contract

- Command id: `dove.paper.figure`
- Domain: `paper`
- Category: `paper-workflow`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/figures`, `.dove/figures/materials.json`, `.dove/figures/generations.json`, `.dove/task-packets/index.json`, `.dove/figures/captions.json`, `.dove/figures/qa.json`.
3. Use the `upsert_figure_plan`, `prepare_figure_generation`, `import_figure_generation`, `validate_figure_pipeline` MCP tools when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Bind every figure plan, generation prepare, and import write to a resolved durable task packet before mutating state.
6. Use redacted Dove config and env-var secret references for external drawing providers; never store inline API keys, tokens, or secrets.
7. Do not mark a final figure ready unless it comes from a validated generation import with durable provenance and caption.
8. Captions must explain the figure purpose and linked evidence.
9. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
10. If target resolution is ambiguous, follow `.dove/state.json.settings.taskTargetResolution.autoSelect`: true auto-selects the best candidate; false stops and asks for packetId confirmation.
11. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
12. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
13. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
14. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
