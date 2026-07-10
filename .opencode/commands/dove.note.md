---
description: "Organize task-bound internal synthesis from registered sources, existing materials, pressure-test results, and operator notes for the selected task."
---

# dove.note

Organize task-bound internal synthesis from registered sources, existing materials, pressure-test results, and operator notes for the selected task.

## Daily use

- Use this to consolidate internal information from added sources, existing materials, pressure-test results, or operator notes.
- Use source for external material; use note for project-local synthesis, candidate comparison, open questions, and writing-style or reviewer-preference summaries.
- For bind/save/deposit/沉淀 prompts, add the synthesized result here or in document evidence after source details are available.
- Targeting: Resolve or confirm the task before writing notes.
- Confirmation: If the target is missing or ambiguous, ask for task confirmation before writing.
- Outcome: The selected task has internal notes linked to relevant sources and materials.

## Examples

- `/dove.note Summarize what the registered venue sources imply for this task`
- `/dove.note Capture the pressure-test finding and link it to registered sources`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove.mjs note . --target "<task title>" --summary "<synthesis>"` from the project root; Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Use this only when there is real synthesis content such as a summary, quote, claim, or open question.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Write notes only when there is real synthesis content: summary, quote, claim, or open question.
13. External material should be added through source first when it is used as evidence.
14. Connect the note to the selected task and relevant materials without showing raw internal identifiers.
15. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
16. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
17. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
