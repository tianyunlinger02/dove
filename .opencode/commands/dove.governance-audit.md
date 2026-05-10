# dove.governance-audit

Inspect governance coverage and command/tool bindings without writing state.

## Contract

- Command id: `dove.governance-audit`
- Domain: `generic`
- Category: `query`
- Policy: `proposal-only`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/meta/governance-coverage.json`.
3. Prefer the `query_governance_coverage_report` MCP tool when available.
4. Keep this surface proposal-only: inspect and route, but do not mutate durable state.
5. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
6. Use this shared Dove control-plane surface across paper, engineering, experiment, review, and general missions; route to `dove.paper.*` only for paper-specific artifact workflows.
7. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
