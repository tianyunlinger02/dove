---
description: "Generate or modify paper draft content from prompts, existing materials, experience, figures, and review information."
---

# dove.draft

Generate or modify paper draft content from prompts, existing materials, experience, figures, and review information.

## Daily use

- Use this to generate or revise paper sections from the selected task, evidence, notes, sources, experiences, figures, and review findings.
- Write as much as current evidence supports and leave explicit placeholders for gaps.
- Targeting: Resolve the draft request to one task before changing draft content.
- Confirmation: Ask for task confirmation when the section or task target is ambiguous.
- Outcome: Draft content or section status is updated with evidence-aware placeholders where needed.

## Examples

- `/dove.draft Draft the methods section from linked evidence`
- `/dove.draft Revise the introduction using the latest review findings`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has no listed project check. Do not run status, `node ./bin/dove.mjs draft --help`, the matching local surface, or any other unlisted command for it. If the target is unclear, ask the operator to choose from visible context. If this chat cannot finish the requested work directly, answer with what material is ready, what has not been added to the task, and the next user choice; do not explain why the tool is unavailable.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
8. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
9. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
10. Only make the specific change requested for this command; do not bundle unrelated work.
11. Draft or revise only when body content or a clear section-status change is provided.
12. Use explicit placeholders for missing evidence or citations instead of fabricating support.
13. Use linked sources, notes, experience, figures, and review findings when they are available.
14. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
15. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
16. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
