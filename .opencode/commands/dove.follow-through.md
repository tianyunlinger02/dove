# dove.follow-through

Record explicit operator handling of proposal-only remediation guidance across all mission domains.

## Contract

- Command id: `dove.follow-through`
- Domain: `generic`
- Category: `mutation`
- Policy: `governed-bookkeeping`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/meta/operator-follow-through.json`.
3. Use the `record_operator_follow_through`, `query_operator_follow_through` MCP tools when available.
4. Record only explicit operator bookkeeping for the governed Dove workflow.
5. Use this shared follow-through surface before launching accepted guidance; do not mirror proposal handling under paper-specific commands.
6. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
7. Use this shared Dove control-plane surface across paper, engineering, experiment, review, and general missions; route to `dove.paper.*` only for paper-specific artifact workflows.
8. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
