---
name: dove-paper-approvals
description: "Paper-domain view of bounded program approvals."
---

# Dove Paper Approvals

Paper-domain view of bounded program approvals.

## Contract

- Command id: `dove.paper.approvals`
- Domain: `paper`
- Category: `mutation`
- Policy: `explicit-approval`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/programs/approvals.json`, `.dove/runtime/controller-state.json`.
3. Use the `query_program_approvals`, `issue_program_approval`, `revoke_program_approval` MCP tools when available.
4. Require explicit operator approval and bounded authority before creating, changing, or consuming program authority.
5. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
6. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
7. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
