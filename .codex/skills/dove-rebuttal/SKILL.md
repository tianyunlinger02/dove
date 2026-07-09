---
name: dove-rebuttal
description: "Normalize reviewer issues, build a rebuttal strategy, and draft submission/revision responses."
---

# Dove Rebuttal

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

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has no listed project check. Do not run status, `node ./bin/dove.mjs rebuttal --help`, the matching local surface, or any other unlisted command for it. If the target is unclear, ask the operator to choose from visible context. If this chat cannot finish the requested work directly, answer with what material is ready, what has not been added to the task, and the next user choice; do not explain why the tool is unavailable.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
8. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
9. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
10. Only make the specific change requested for this command; do not bundle unrelated work.
11. Organize reviewer issues before drafting responses.
12. Keep rebuttal work on the author side.
13. Link each response to evidence, draft sections, experiments, or explicit unresolved gaps.
14. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
15. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
16. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
