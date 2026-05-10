# dove-paper-claim-gate

Promote supported findings into evidence-backed claims.

## Contract

- Command id: `dove.paper.claim-gate`
- Domain: `paper`
- Category: `paper-workflow`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/evidence/index.json`, `.dove/claims/CLAIMS_FROM_RESULTS.md`.
3. Prefer the `upsert_claims` MCP tool when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Promote claims only when linked source or note evidence exists.
6. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
7. If target resolution is ambiguous, follow `.dove/state.json.settings.taskTargetResolution.autoSelect`: true auto-selects the best candidate; false stops and asks for packetId confirmation.
8. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
9. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
10. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
11. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
