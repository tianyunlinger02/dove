---
name: dove-operator
description: "Run one approved operator pass over safe built-in steps, explicit results, and optional blocker-investigation planning."
---

# Dove Operator

Run one approved operator pass over safe built-in steps, explicit results, and optional blocker-investigation planning.

## Daily use

- Use this to see which tracked work can move now and run one approved operator pass.
- Do not claim real work happened unless a safe built-in step ran or a canonical `taskResults[]` entry supplied the real pass result.
- Targeting: Works over the active work queue rather than one ad hoc target.
- Confirmation: Preview the practical queue situation first; require approval before accepting canonical results or creating blocker-investigation work.
- Outcome: Runnable work moves with evidence; a task waiting for an external pass remains unchanged when no canonical result is supplied, and blocked work gets a concrete investigation option only when requested.

## Examples

- `/dove:operator`
- `/dove:operator Run one confirmed queue pass with real results`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove-package.mjs operator . --confirmed --mutation-mode direct-process` from the project root; Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Run operator only after approval. Supply real externally performed work results only through the canonical `taskResults[]` contract via `--task-results-json '<JSON array>'` and use `--run-id "<run id>"` when the pass needs a stable run identifier; a task awaiting that work must remain unchanged when no matching result is supplied.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Ask for approval before making changes or spending the proposed work rounds.
12. Preview the practical queue situation before asking for approval.
13. Run one operator pass only after confirmation.
14. Accept externally performed work results only through canonical taskResults[]; a task awaiting that work remains unchanged when no matching result is supplied.
15. Do not claim work without real results; leave it waiting for evidence instead.
16. Create blocker-investigation tasks only when the operator explicitly asks for them.
17. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
18. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
19. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
