---
name: dove-return
description: "Inspect return readiness from declared evidence and durable state."
---

# Dove Return

Inspect return readiness from declared evidence and durable state.

## Contract

- Command id: `dove.return`
- Domain: `generic`
- Category: `query`
- Policy: `proposal-only`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/task-packets/index.json`, `.dove/runtime/controller-state.json`.
3. Prefer the `query_dove_return` MCP tool when available.
4. Keep this surface proposal-only: inspect and route, but do not mutate durable state.
5. Use declared changed-file, test-evidence, and validation-output paths; do not run tests, inspect git, or repair state from this surface.
6. At closure, decide explicitly whether reusable experience is worth recording through Dove lessons; do not record automatically.
7. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
8. For paper-specific work, route to the matching `dove.paper.*` surface instead of adding a second workflow branch.
9. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
