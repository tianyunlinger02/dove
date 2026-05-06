# dove.paper.experiment-plan

Plan or record claim-driven experiments and results.

## Contract

- Command id: `dove.paper.experiment-plan`
- Domain: `paper`
- Category: `paper-workflow`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/experiments/plans.json`, `.dove/experiments/results.json`.
3. Use the `upsert_experiment_plan`, `upsert_experiment_result` MCP tools when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
6. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
7. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
