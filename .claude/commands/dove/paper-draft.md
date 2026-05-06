# dove.paper.draft

Draft or update paper sections without fabricating evidence.

## Contract

- Command id: `dove.paper.draft`
- Domain: `paper`
- Category: `paper-workflow`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/drafts`, `.dove/evidence/index.json`.
3. Use the `upsert_draft`, `set_section_status` MCP tools when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Leave `TODO[citation]` markers when support is missing instead of inventing evidence.
6. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
7. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
8. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
