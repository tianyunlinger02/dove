---
name: dove-lessons
description: "Inspect or record global and task-bound lessons that future Dove work must obey."
---

# Dove Lessons

Inspect or record global and task-bound lessons that future Dove work must obey.

## Daily use

- Use this when a closed task yields reusable guidance that future Dove work should obey.
- Keep lessons short and explicit: problem, decision, pitfall, validation, and next-time guidance.
- Targeting: Can record global lessons or bind a lesson to a resolved task packet.
- Confirmation: When task binding is ambiguous, show task choices and wait for the operator.
- Outcome: Applicable lessons are available to later mission, auto, operator, and status surfaces without importing raw traces.

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
6. Record only distilled lessons with problem, decision, pitfall, validation, and next-time guidance.
7. When recording a task-specific lesson and multiple tasks exist, return an indexed task list and wait for the operator to choose.
8. Allow manual global lessons when no task binding is intended.
9. Surface applicable must-obey lessons before later task mutations.
10. Do not import or cite ignored raw runtime traces.
11. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
12. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
13. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
