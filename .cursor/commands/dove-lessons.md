---
description: "Inspect or record global and task-bound lessons that future Dove work must obey."
---

# dove-lessons

Inspect or record global and task-bound lessons that future Dove work must obey.

## Daily use

- Use this when a closed task yields reusable guidance that future Dove work should obey; ordinary action surfaces recall lessons automatically as read-only preActionGuidance.
- Keep lesson recording explicit and short: problem, decision, pitfall, validation, and next-time guidance.
- Targeting: Can record global lessons or bind a lesson to a resolved task packet.
- Confirmation: When task binding is ambiguous, show task choices and wait for the operator.
- Outcome: Applicable lessons are automatically recalled read-only in later status, mission, auto, operator, and professional workflow preActionGuidance without importing raw traces or recording new lessons implicitly.

## Examples

- `/dove:lessons Record that status should not show completed or killed mission lists`
- `/dove:lessons Show lessons that apply to the selected task`

## Contract

- Command id: `dove.lessons`
- Domain: `generic`
- Category: `mutation`
- Policy: `governed-bookkeeping`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/meta/operator-lessons.json`.
4. Use the `query_operator_lessons`, `record_operator_lesson` MCP tools when available.
5. Record only explicit operator bookkeeping for the governed Dove workflow.
6. For ordinary prompts, first use compact `query_dove_status` and `statusHome.preActionGuidance` for intent routing before choosing a mutation command; users should not need to guess slash command names.
7. For ordinary prompts that ask to bind, save, deposit, archive, or 沉淀 results to a main task, resolve the durable packet first, register external URLs/templates/guidelines as packet-bound sources, then synthesize internal findings through `upsert_note` or `record_document_evidence` instead of treating the synthesis as an external source.
8. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
9. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
10. Treat status as the project command center and mission as a durable work contract/progress object; do not make a mission board the default UI.
11. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
12. Record only distilled lessons with problem, decision, pitfall, validation, and next-time guidance.
13. When recording a task-specific lesson and multiple tasks exist, return an indexed task list and wait for the operator to choose.
14. Allow manual global lessons when no task binding is intended.
15. Surface applicable must-obey lessons before later task mutations.
16. Do not import or cite ignored raw runtime traces.
17. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
18. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
19. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
