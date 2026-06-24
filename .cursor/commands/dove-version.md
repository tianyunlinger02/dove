---
description: "Create a direction-change point, clear active non-init tasks, and preserve the init goal plus necessary lessons."
---

# dove-version

Create a direction-change point, clear active non-init tasks, and preserve the init goal plus necessary lessons.

## Daily use

- Use this when the project direction changes enough that active non-init work should be cleared.
- Snapshot the old direction before starting a fresh set of missions.
- Targeting: Operates on the workspace task set and preserves the init root.
- Confirmation: Guarded reset; require a reason before clearing active non-init tasks.
- Outcome: A version snapshot is stored, active non-init tasks are cleared, and the next command is mission.

## Examples

- `/dove:version Change direction to focus on result-card usability`
- `/dove:version Start a fresh figure workflow direction while preserving the init goal`

## Contract

- Command id: `dove.version`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`, `.dove/versions`, `.dove/meta/operator-lessons.json`.
4. Prefer the `reset_dove_version` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. For ordinary prompts, first use compact `query_dove_status` and `statusHome.preActionGuidance` for intent routing before choosing a mutation command; users should not need to guess slash command names.
7. For ordinary prompts that ask to bind, save, deposit, archive, or 沉淀 results to a main task, resolve the durable packet first, register external URLs/templates/guidelines as packet-bound sources, then synthesize internal findings through `upsert_note` or `record_document_evidence` instead of treating the synthesis as an external source.
8. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
9. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
10. Treat status as the project command center and mission as a durable work contract/progress object; do not make a mission board the default UI.
11. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
12. Snapshot the current direction before resetting active tasks.
13. Clear active non-init tasks so only the level-0 init task remains active.
14. Preserve the level-0 init goal and required global or task lessons that still apply to future work.
15. Return a clean status summary and recommend `/dove:mission` for the next direction.
16. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
17. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
18. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
