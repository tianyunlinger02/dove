---
name: dove-checklist
description: "Sync the active Dove mission checklist from the current plan and acceptance checks."
---

# Dove Checklist

Sync the active Dove mission checklist from the current plan and acceptance checks.

## Contract

- Command id: `dove.checklist`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/checklists/current.md`, `.dove/task-packets/index.json`.
3. Prefer the `sync_checklist` MCP tool when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
6. For paper-specific work, route to the matching `dove.paper.*` surface instead of adding a second workflow branch.
7. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
