---
name: dove-paper-rebuttal
description: "Build a rebuttal draft from normalized issues and strategy."
---

# Dove Paper Rebuttal

Build a rebuttal draft from normalized issues and strategy.

## Contract

- Command id: `dove.paper.rebuttal`
- Domain: `paper`
- Category: `paper-workflow`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/rebuttal`.
3. Prefer the `build_rebuttal` MCP tool when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Draft responses from normalized rebuttal issues and strategy; keep revision/rebuttal work builder-side.
6. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
7. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
8. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
