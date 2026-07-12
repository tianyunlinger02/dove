---
name: dove-version
description: "Create a direction-change point and clear active non-init work with confirmation."
---

# Dove Version

Create a direction-change point and clear active non-init work with confirmation.

## Daily use

- Use this when the project direction changes enough that active non-root work should be cleared.
- Treat it as a direction reset, not as a general undo command.
- Targeting: Operates on the current workspace direction and active tasks.
- Confirmation: Require a reason before clearing active work.
- Outcome: A direction reset stores the old direction, clears active non-root work, and points the next step at a fresh mission.

## Examples

- `/dove:version Change direction to focus on result-card usability`
- `/dove:version Reset active tasks after a major project direction change`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove-package.mjs version . --reason "<direction change reason>" --mutation-mode direct-process` from the project root; Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Use version only for a deliberate direction reset with a short reason, not as a general undo path.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Treat this as a direction reset, not as a general undo command.
13. Require a short reason before clearing active work.
14. Preserve the project goal and reusable lessons, then point the operator to the next mission.
15. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
16. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
17. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
