---
description: "Show a natural Dove status home that explains the current situation, the smallest useful next action, and how to expand only when needed."
---

# dove-status

Show a natural Dove status home that explains the current situation, the smallest useful next action, and how to expand only when needed.

## Daily use

- Use this to answer the ordinary operator question: what should I do next?
- Default output should read like a project assistant: briefly explain the current situation, name the smallest useful next action, and mention expansion only when it helps. Do not impose a fixed four-line template or a numbered checklist by default.
- If the host has to inspect saved records directly, translate what it finds into user actions instead of repeating file names, ids, route strings, tool names, or storage terms.
- Default prose should avoid storage, tool, and check jargon; describe saved project state, standing guidance, available capabilities, stored records, or current-figure review issues in ordinary language.
- Targeting: Default output is not a mission board or audit report: do not enumerate ids, role names, version markers, mission lists, route names, repair queues, raw counts, low-level fields, evidence blocks, or diagnostics unless the operator explicitly asks to expand.
- Confirmation: Do not ask for status changes during default `/dove:status`; preview or apply status changes only after explicit status-change intent, and require one clear confirmation step before mutation.
- Outcome: The operator gets a short, natural status answer with an actionable next step; confirmed status adjustments still return localized resultCard summaries.

## Examples

- `/dove:status`
- `/dove:status Show what is blocked and what the next step is`

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. When a local Dove CLI is available, run `node ./bin/dove.mjs status .` from the project root before answering; summarize its compact output instead of inspecting saved records directly.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Require explicit operator approval before creating or changing saved workflow records or consuming bounded authority.
8. Start with the live situation the host can actually see, then fold in saved project state only as background guidance.
9. Answer the operator's ordinary next-step question in short natural prose: the current situation, the smallest useful action, and why it matters when helpful.
10. Default status is not a mission board or audit report; keep mission lists, ids, raw counts, route names, low-level fields, and diagnostics collapsed unless the operator asks to expand.
11. When the operator asks to show missions, expand mission details inside this status surface instead of inventing separate list, board, or mission-board commands.
12. Only preview or apply status changes after an explicit status-change request, using one confirmation step and a clear no-change path.
13. For legacy parent/child consistency issues, tell the operator to verify child evidence first, then either mark covered children done through confirmed status adjustment or reopen the parent.
14. After confirmed status changes, return the localized result card instead of a raw update log.
15. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
16. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
17. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
