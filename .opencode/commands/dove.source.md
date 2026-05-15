# dove.source

Collect and organize external information such as web, literature, API, or operator-provided sources for the selected task.

## Daily use

- Use this to register external information such as papers, web findings, API docs, citations, or operator-provided provenance.
- Keep source intake separate from internal notes.
- Targeting: Resolve or confirm the durable task packet before recording external source metadata.
- Confirmation: If no unique task target is available, ask for packet selection instead of guessing.
- Outcome: The selected task has durable source metadata and provenance links.

## Contract

- Command id: `dove.source`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/sources/index.json`.
4. Prefer the `register_source` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. Treat source as external information intake, not internal note consolidation.
7. Use explicit configured providers or operator-provided material; do not hide network/provider calls.
8. Link each source to the resolved durable task packet.
9. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
10. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
11. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
12. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
13. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
14. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
15. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
