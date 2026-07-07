---
name: dove-init
description: "Create or update the single project-level Dove goal as the unique level-0 task."
---

# Dove Init

Create or update the single project-level Dove goal as the unique level-0 task.

## Daily use

- Use this when the workspace needs its one global Dove goal or the goal wording needs an explicit refresh.
- Keep concrete work out of init; after init, route the actual request to mission or auto.
- Targeting: No task target is needed because init owns the unique level-0 root.
- Confirmation: Guarded mutation only; update the existing init instead of creating another root.
- Outcome: The workspace has one level-0 init task and the next practical command is mission or auto.

## Examples

- `/dove:init Make Dove a local-first research and engineering workflow`
- `/dove:init Refresh the project goal around daily Dove usability`

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. If neither a matching Dove capability nor a documented local Dove CLI command exists for this surface, do not emulate it by reading saved records with host tools; say the Dove runtime for this command is unavailable and ask for a capability or CLI route.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Only perform the governed change owned by this surface, scoped to the operator request.
8. There is exactly one level-0 init task; update it instead of creating a second root.
9. Use init only for the global project goal, then route concrete work through `/dove:mission` or `/dove:auto`.
10. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
11. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
12. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
