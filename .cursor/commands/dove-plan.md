# dove-plan

Create or update the shared Dove mission design plan for paper, engineering, experiment, review, and general work.

## Contract

- Command id: `dove.plan`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/research/brief.md`, `.dove/sources/index.json`, `.dove/evidence/index.json`, `.dove/plans`, `.dove/checklists/current.md`.
3. Prefer the `upsert_plan` MCP tool when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Use this as the single planning surface for every domain; do not mirror shared planning under paper-specific commands.
6. For paper missions, include manuscript structure, claims, citations, venue strategy, target artifacts, required evidence, risks, non-goals, and acceptance checks.
7. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
8. If target resolution is ambiguous, follow `.dove/state.json.settings.taskTargetResolution.autoSelect`: true auto-selects the best candidate; false stops and asks for packetId confirmation.
9. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
10. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
11. Use this shared Dove control-plane surface across paper, engineering, experiment, review, and general missions; route to `dove.paper.*` only for paper-specific artifact workflows.
12. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
