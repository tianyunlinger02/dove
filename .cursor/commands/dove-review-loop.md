---
description: "Run one independent local Reviewer pass and return an explicit Builder handoff when revision is required."
---

# dove-review-loop

Run one independent local Reviewer pass and return an explicit Builder handoff when revision is required.

## Daily use

- Use this for one independent Reviewer pass over the selected packet materials.
- The pass records concrete findings or a material-backed coherent verdict, but never edits Builder-owned draft or experience material.
- When revision is required, hand the requiredActions to a Builder and invoke review again only after that separate revision call.
- Targeting: Resolve the pass to one task and its packet-owned materials before reviewing.
- Confirmation: This command performs one visible Reviewer pass only; there is no implicit Reviewer-to-Builder-to-Reviewer cycle.
- Outcome: One packet-scoped review result plus an explicit Builder handoff when changes are required.

## Examples

- `/dove:review-loop Run one independent evidence-aware review pass`
- `/dove:review-loop Review this packet and hand required revisions to Builder`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove-package.mjs review-loop . --target "<task title>" --mutation-mode direct-process` from the project root; Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Use this for limited local review iterations; provide draft or experiment material before asking it to revise or plan those substeps.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Run only limited visible local review, revision, and experience-planning iterations.
13. Use three rounds by default unless the project config says otherwise.
14. Do not start a draft or experiment substep without the needed material.
15. Stop early when the task is coherent, blocked, waiting on material, or waiting on user input.
16. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
17. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
18. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
