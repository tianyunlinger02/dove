---
description: "Create a direction-change point and clear active non-init work with confirmation."
---

# dove-version

Create a direction-change point and clear active non-init work with confirmation.

## Daily use

- Use this when the project direction changes enough that active non-init work should be cleared.
- For host/context rollback, use patch-plan and apply the returned `.dove/` file operations through host-tracked file edits before relying on the host native checkpoint; `/dove:version` is not a `.dove` restore command.
- Targeting: Operates on the workspace task set for direction reset.
- Confirmation: Guarded reset; require a reason before clearing active non-init tasks.
- Outcome: A direction reset stores a version snapshot, clears active non-init tasks, and points the next command at mission.

## Examples

- `/dove:version Change direction to focus on result-card usability`
- `/dove:version Reset active tasks after a major project direction change`

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. If neither a matching Dove capability nor a documented local Dove CLI command exists for this surface, do not emulate it by reading saved records with host tools; say the Dove runtime for this command is unavailable and ask for a capability or CLI route.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Only perform the governed change owned by this surface, scoped to the operator request.
8. For direction changes, snapshot the current direction before resetting active tasks.
9. Do not use `/dove:version` as a `.dove` rollback restore entrypoint; host/context rollback belongs to the host and can cover Dove workflow artifacts only when patch-plan operations are applied through host-tracked file edits.
10. Preserve the level-0 init goal and required global or task lessons during direction-change resets.
11. Return a clean status summary and recommend `/dove:mission` for the next direction after direction reset.
12. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
13. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
14. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
