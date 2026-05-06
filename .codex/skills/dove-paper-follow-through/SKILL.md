---
name: dove-paper-follow-through
description: "Record explicit operator handling of remediation guidance."
---

# Dove Paper Follow Through

Record explicit operator handling of remediation guidance.

## Contract

- Command id: `dove.paper.follow-through`
- Domain: `paper`
- Category: `mutation`
- Policy: `governed-bookkeeping`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/meta/operator-follow-through.json`.
3. Use the `record_operator_follow_through`, `query_operator_follow_through` MCP tools when available.
4. Record only explicit operator bookkeeping for the governed Dove workflow.
5. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
6. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
7. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
