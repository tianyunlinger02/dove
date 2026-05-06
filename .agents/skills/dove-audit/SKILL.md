---
name: dove-audit
description: "Inspect mission audit findings and readiness without writing or fixing anything."
---

# Dove Audit

Inspect mission audit findings and readiness without writing or fixing anything.

## Contract

- Command id: `dove.audit`
- Domain: `generic`
- Category: `query`
- Policy: `proposal-only`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/task-packets/index.json`, `.dove/runtime/controller-state.json`.
3. Prefer the `query_dove_audit` MCP tool when available.
4. Keep this surface proposal-only: inspect and route, but do not mutate durable state.
5. Inspect only declared evidence and durable packet links; do not fix, refresh, run tests, or inspect git.
6. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
7. For paper-specific work, route to the matching `dove.paper.*` surface instead of adding a second workflow branch.
8. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
