---
name: dove-review
description: "Run an isolated audio review over final plan/results and explicitly supplied artifacts without inheriting full project context."
---

# Dove Review

Run an isolated audio review over final plan/results and explicitly supplied artifacts without inheriting full project context.

## Daily use

- Use this for an isolated audio review over final plans, final results, and explicitly listed materials.
- Do not pass broad project context or private writer/reviewer transcripts.
- Targeting: Resolve the review to one task and the exact materials being reviewed.
- Confirmation: Reviewer input and import stay limited to the supplied materials.
- Outcome: The review preparation or result is ready without breaking isolation boundaries.

## Examples

- `/dove:review Review the final plan and result materials only`
- `/dove:review Prepare isolated reviewer input for the current task`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has no listed project check. Do not run status, `node ./bin/dove.mjs review --help`, the matching local surface, or any other unlisted command for it. If the target is unclear, ask the operator to choose from visible context. If this chat cannot finish the requested work directly, answer with what material is ready, what has not been added to the task, and the next user choice; do not explain why the tool is unavailable.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
8. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
9. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
10. Use only the reviewer materials the operator provides; do not share hidden session context.
11. Give the reviewer only the current task summary, final plans, final results, explicit materials, hashes, instructions, and output expectations.
12. Do not share private writer transcript, broad project context, or private reviewer transcript.
13. Report review preparation or imported review results in plain language.
14. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
15. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
16. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
