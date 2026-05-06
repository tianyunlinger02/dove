# dove-paper-isolated-review

Prepare and import isolated reviewer handoffs through explicit artifacts.

## Contract

- Command id: `dove.paper.isolated-review`
- Domain: `paper`
- Category: `paper-workflow`
- Policy: `isolated-handoff`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/reviews/isolated`, `.dove/reviews/concerns.json`.
3. No required MCP tool; follow the command contract and route to the owning Dove surface when mutation is needed.
4. Use explicit handoff artifacts for reviewer isolation; do not share hidden session context.
5. Pass only explicit input artifacts to the reviewer and import only handoff/report artifacts back.
6. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
7. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
8. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
