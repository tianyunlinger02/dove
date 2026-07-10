---
description: "Generate or modify paper draft content from prompts, existing materials, experience, figures, and review information."
---

# dove-draft

Generate or modify paper draft content from prompts, existing materials, experience, figures, and review information.

## Daily use

- Use this to generate or revise paper sections from the selected task, evidence, notes, sources, experiences, figures, and review findings.
- Write as much as current evidence supports and leave explicit placeholders for gaps.
- Targeting: Resolve the draft request to one task before changing draft content.
- Confirmation: Ask for task confirmation when the section or task target is ambiguous.
- Outcome: Draft content or section status is updated with evidence-aware placeholders where needed.

## Examples

- `/dove:draft Draft the methods section from linked evidence`
- `/dove:draft Revise the introduction using the latest review findings`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove.mjs draft . --target "<task title>" --section-id "<section>" --body "<draft text>"` from the project root; Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Use draft only for real section text; status-only section changes need an explicit status request.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Draft or revise only when body content or a clear section-status change is provided.
13. Use explicit placeholders for missing evidence or citations instead of fabricating support.
14. Use linked sources, notes, experience, figures, and review findings when they are available.
15. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
16. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
17. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
