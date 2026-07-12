---
description: "Normalize reviewer issues, build a rebuttal strategy, and draft submission/revision responses."
---

# dove-rebuttal

Normalize reviewer issues, build a rebuttal strategy, and draft submission/revision responses.

## Daily use

- Use this to organize reviewer issues, build response strategy, and draft evidence-backed rebuttal or revision text.
- Keep rebuttal work author-side and linked to claims, sections, experiments, or explicit gaps.
- Targeting: Resolve the rebuttal work to one task and the reviewer issues being answered.
- Confirmation: Do not draft final responses from unsupported issues or missing evidence.
- Outcome: Reviewer issues, strategy, and response drafts are ready with usable evidence links.

## Examples

- `/dove:rebuttal Normalize reviewer issues and build the response strategy`
- `/dove:rebuttal Draft an evidence-backed response for the missing-experiment concern`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove-package.mjs rebuttal . --target "<task title>" --issue "<reviewer issue>" --mutation-mode direct-process` from the project root; Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Use rebuttal for reviewer issues and author-side response strategy; keep unsupported gaps explicit instead of drafting around them.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Organize reviewer issues before drafting responses.
13. Keep rebuttal work on the author side.
14. Link each response to evidence, draft sections, experiments, or explicit unresolved gaps.
15. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
16. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
17. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
