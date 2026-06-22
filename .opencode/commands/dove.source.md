---
description: "Collect and organize external information such as web, literature, API, or operator-provided sources for the selected task."
---

# dove.source

Collect and organize external information such as web, literature, API, or operator-provided sources for the selected task.

## Daily use

- Use this to register external information such as papers, web findings, API docs, citations, or operator-provided provenance.
- Keep source intake separate from internal notes.
- Targeting: Resolve or confirm the durable task packet before recording external source metadata.
- Confirmation: If no unique task target is available, ask for packet selection instead of guessing.
- Outcome: The selected task has durable source metadata and provenance links.

## Examples

- `/dove:source Register this paper as evidence for the selected task`
- `/dove:source Save the operator-provided API notes as an external source`

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
6. For ordinary prompts, first use compact `query_dove_status` and `statusHome.preActionGuidance` for intent routing before choosing a mutation command; users should not need to guess slash command names.
7. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
8. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
9. Treat status as the project command center and mission as a durable work contract/progress object; do not make a mission board the default UI.
10. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
11. Treat source as external information intake, not internal note consolidation.
12. Use explicit configured providers or operator-provided material; do not hide network/provider calls.
13. Link each source to the resolved durable task packet.
14. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
15. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
16. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
17. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
18. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
19. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
20. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
