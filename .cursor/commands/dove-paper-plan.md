# dove-paper-plan

Plan paper structure, claims, citations, venue strategy, and acceptance checks.

## Contract

- Command id: `dove.paper.plan`
- Domain: `paper`
- Category: `paper-workflow`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/plans`, `.dove/checklists/current.md`.
3. Prefer the `upsert_plan` MCP tool when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
6. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
7. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
