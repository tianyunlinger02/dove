---
name: dove-review-loop
description: "Loop isolated review, draft revision, and experience planning until coherent or blocked, with max iterations from global config."
---

# Dove Review Loop

Loop isolated review, draft revision, and experience planning until coherent or blocked, with max iterations from global config.

## Daily use

- Use this when review, draft revision, and experience planning should iterate together within the configured max rounds.
- Stop when coherent, blocked, at provider/review boundary, or when user input is required.
- Targeting: Resolve the loop to one durable task packet before mutating review/draft/experience artifacts.
- Confirmation: Run only bounded foreground iterations; default max is 3 unless configured otherwise.
- Outcome: Each loop iteration records review, draft, and experience state until the task is coherent or blocked.

## Examples

- `/dove:review-loop Run up to three review and revision rounds for the current draft`
- `/dove:review-loop Stop when the task is coherent or reaches an evidence boundary`

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. If neither a matching Dove capability nor a documented local Dove CLI command exists for this surface, do not emulate it by reading saved records with host tools; say the Dove runtime for this command is unavailable and ask for a capability or CLI route.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Only perform the governed change owned by this surface, scoped to the operator request.
8. Use default 3 as the max iteration count unless `.dove/state.json.settings.reviewLoop.maxIterations` says otherwise.
9. Each iteration should run review, update draft work, and plan missing experience/evidence as needed.
10. If a draft substep is requested, provide draftBody or draft.body before the loop starts; if an experience substep is requested, provide a goal, title, idea, or experimentId before the loop starts.
11. Stop early when review is coherent, the task is blocked, a provider boundary is reached, or user input is required.
12. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
13. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
14. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
