---
name: dove-lessons
description: "Inspect or record global and task-bound lessons that future Dove work must obey."
---

# Dove Lessons

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

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. If neither a matching Dove capability nor a documented local Dove CLI command exists for this surface, do not emulate it by reading saved records with host tools; say the Dove runtime for this command is unavailable and ask for a capability or CLI route.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Record only explicit operator bookkeeping for the governed Dove workflow.
8. Record only distilled lessons with problem, decision, pitfall, validation, and next-time guidance.
9. When recording a task-specific lesson and multiple tasks exist, return an indexed task list and wait for the operator to choose.
10. Allow manual global lessons when no task binding is intended.
11. Surface applicable must-obey lessons before later task mutations.
12. Do not import or cite ignored raw runtime traces.
13. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
14. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
15. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
