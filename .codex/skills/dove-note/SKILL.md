---
name: dove-note
description: "Organize internal information from the repository, `.dove`, existing artifacts, and operator notes for the selected task."
---

# Dove Note

Organize internal information from the repository, `.dove`, existing artifacts, and operator notes for the selected task.

## Daily use

- Use this to consolidate internal information from the repository, existing artifacts, `.dove/`, or operator notes.
- Use source for external material; use note for project-local understanding.
- Targeting: Resolve or confirm the durable task packet before writing notes.
- Confirmation: If the target is missing or ambiguous, ask for task confirmation before writing.
- Outcome: The selected task has internal notes linked to relevant artifacts.

## Examples

- `/dove:note Summarize how the status dashboard chooses its next action`
- `/dove:note Record the boundary case found during this validation run`

## Contract

- Command id: `dove.note`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/notes/index.json`, `.dove/sources/index.json`.
4. Prefer the `upsert_note` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. For ordinary prompts, first use compact `query_dove_status` and `statusHome.preActionGuidance` for intent routing before choosing a mutation command; users should not need to guess slash command names.
7. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
8. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
9. Treat status as the project command center and mission as a durable work contract/progress object; do not make a mission board the default UI.
10. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
11. Treat note as internal information consolidation, not external source discovery.
12. Link notes to the resolved durable task packet and relevant artifacts.
13. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
14. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
15. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
16. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
17. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
18. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
19. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
