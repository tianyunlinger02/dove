# dove.paper.decisions

Inspect durable operational and comparison decisions.

## Contract

- Command id: `dove.paper.decisions`
- Domain: `paper`
- Category: `query`
- Policy: `query`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/wiki/navigation.md`, `.dove/versions`.
3. Prefer the `query_decisions` MCP tool when available.
4. Keep this surface read-only unless the named MCP tool explicitly performs a governed refresh.
5. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
6. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
7. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
