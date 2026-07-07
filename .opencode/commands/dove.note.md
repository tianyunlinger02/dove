---
description: "Organize task-bound internal synthesis from registered sources, existing materials, pressure-test results, and operator notes for the selected task."
---

# dove.note

Organize task-bound internal synthesis from registered sources, existing materials, pressure-test results, and operator notes for the selected task.

## Daily use

- Use this to consolidate internal information from added sources, existing materials, pressure-test results, or operator notes.
- Use source for external material; use note for project-local synthesis and writing-style or reviewer-preference summaries.
- For bind/save/deposit/沉淀 prompts, add the synthesized result here or in document evidence after source details are available.
- Targeting: Resolve or confirm the task before writing notes.
- Confirmation: If the target is missing or ambiguous, ask for task confirmation before writing.
- Outcome: The selected task has internal notes linked to relevant sources and materials.

## Examples

- `/dove.note Summarize what the registered venue sources imply for this task`
- `/dove.note Capture the pressure-test finding and link it to registered sources`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has no listed project check. Do not run status, `node ./bin/dove.mjs note --help`, the matching local surface, or any other unlisted command for it. If the target is unclear, ask the operator to choose from visible context. If this chat cannot finish the requested work directly, answer with what material is ready, what has not been added to the task, and the next user choice; do not explain why the tool is unavailable.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
8. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
9. Only make the specific change requested for this command; do not bundle unrelated work.
10. Write notes only when there is real synthesis content: summary, quote, claim, or open question.
11. External material should be added through source first when it is used as evidence.
12. Connect the note to the selected task and relevant materials without showing raw internal identifiers.
13. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
14. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
15. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
