---
description: "Show a natural Dove status home that explains the current situation, the smallest useful next action, and how to expand only when needed."
---

# dove.status

Show a natural Dove status home that explains the current situation, the smallest useful next action, and how to expand only when needed.

## Daily use

- Use this to answer the ordinary operator question: what should I do next?
- Default output should read like a project assistant: briefly explain the current situation, name the smallest useful next action, and mention expansion only when it helps. Do not impose a fixed four-line template or a numbered checklist by default.
- If saved project facts have to be inspected directly, translate them into user actions instead of repeating file names, ids, route names, tool names, or storage terms.
- Targeting: Default output is not a mission board or audit report; keep mission lists, raw counts, and extra details collapsed unless the operator asks to expand.
- Confirmation: Do not ask for status changes during default status; preview or apply changes only after an explicit status-change request and one clear confirmation step.
- Outcome: The operator gets a short, natural status answer with one useful next step and enough context to decide whether to expand.

## Examples

- `/dove.status`
- `/dove.status Show what is blocked and what the next step is`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project check: `node ./bin/dove.mjs status .` from the project root; summarize its practical result instead of inspecting internal files directly.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
8. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
9. Ask for approval before making changes or spending the proposed work rounds.
10. Start with the live situation the current session can actually see, then fold in saved project state only as background guidance.
11. Answer the operator's ordinary next-step question in short natural prose: the current situation, the smallest useful action, and why it matters when helpful.
12. Default status is not a mission board or audit report; keep mission lists, raw identifiers, raw counts, route names, low-level fields, and extra details collapsed unless the operator asks to expand.
13. When the operator asks to show missions, expand mission details inside this status surface instead of inventing separate list, board, or mission-board commands.
14. Only preview or apply status changes after an explicit status-change request, using one confirmation step and a clear no-change path.
15. For legacy parent/child consistency issues, tell the operator to verify child evidence first, then either mark covered children done through confirmed status adjustment or reopen the parent.
16. After confirmed status changes, return a localized human summary instead of a raw update log.
17. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
18. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
19. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
