---
name: dove-paper-note
description: "Record structured paper notes linked to sources, sections, and claims."
---

# Dove Paper Note

Record structured paper notes linked to sources, sections, and claims.

## Contract

- Command id: `dove.paper.note`
- Domain: `paper`
- Category: `paper-workflow`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/notes/index.json`, `.dove/sources/index.json`.
3. Prefer the `upsert_note` MCP tool when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
6. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
7. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
