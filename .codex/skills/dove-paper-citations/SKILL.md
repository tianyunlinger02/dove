---
name: dove-paper-citations
description: "Sync citation artifacts and bibliography state."
---

# Dove Paper Citations

Sync citation artifacts and bibliography state.

## Contract

- Command id: `dove.paper.citations`
- Domain: `paper`
- Category: `paper-workflow`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/bibliography`, `.dove/sources/index.json`.
3. Prefer the `sync_citations` MCP tool when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Never fabricate citation data; sync only explicit source and bibliography records.
6. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
7. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
8. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
