# dove.paper.pipeline

Show the paper-domain lifecycle from initialization through return.

## Contract

- Command id: `dove.paper.pipeline`
- Domain: `paper`
- Category: `paper-workflow`
- Policy: `guidance`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/wiki/navigation.md`.
3. No required MCP tool; follow the command contract and route to the owning Dove surface when mutation is needed.
4. Provide workflow guidance only; route to another Dove surface for durable changes.
5. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
6. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
7. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
