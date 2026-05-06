# dove.paper.materialize

Paper-domain view of materializing accepted guidance into task packets.

## Contract

- Command id: `dove.paper.materialize`
- Domain: `paper`
- Category: `mutation`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/state.json`, `.dove/meta/operator-follow-through.json`, `.dove/meta/remediation-packs.json`, `.dove/task-packets/index.json`.
3. Prefer the `materialize_guidance_packet` MCP tool when available.
4. Only perform the governed mutation owned by this surface, scoped to the operator request.
5. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
6. Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.
7. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
