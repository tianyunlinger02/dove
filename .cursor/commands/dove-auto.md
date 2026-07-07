---
description: "Convert demand like mission intake, then after confirmation run multi-round foreground autonomy until completion or a boundary is reached."
---

# dove-auto

Convert demand like mission intake, then after confirmation run multi-round foreground autonomy until completion or a boundary is reached.

## Daily use

- Use this when the user wants Dove to continue through bounded foreground iterations after the same demand-to-task intake as mission.
- Start from a new demand or an existing durable task; auto should propose compact task/auto cards, preActionGuidance, recalled lessons, role frame, and concrete safe steps before consuming the iteration budget.
- Targeting: Selects an existing packet when the target is clear, otherwise proposes a new task contract.
- Confirmation: Require explicit approval of the compact task/auto cards, selected/proposed task, max iteration budget, and concrete foreground steps.
- Outcome: Each foreground iteration is recorded in runtime results and stops at completion, blocker, review/provider boundary, or budget exhaustion with an explicit boundary and localized resultCard summary.

## Examples

- `/dove:auto Continue the current Dove UX improvement task for up to three foreground rounds`
- `/dove:auto Run the selected task until completion or an explicit boundary`

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. If neither a matching Dove capability nor a documented local Dove CLI command exists for this surface, do not emulate it by reading saved records with host tools; say the Dove runtime for this command is unavailable and ask for a capability or CLI route.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Require explicit operator approval before creating or changing saved workflow records or consuming bounded authority.
8. Use the same demand-to-task intake and classification model as `/dove:mission` before autonomous execution starts.
9. Allow `/dove:auto` to be invoked directly on a new user demand or an existing durable task; it does not require running `/dove:mission` first.
10. Return a proposal-only auto contract first: either a converted `proposedTask` with checklist proposal and executable `executionContract`, or a `selectedTask` from durable packet selection with current contract readiness, plus compact task/auto cards, confirmation args, and max iteration budget.
11. Use interactive confirmation controls when the host supports them (for example Claude Code AskUserQuestion) before passing `confirmed: true`; options should approve and run bounded auto, adjust target/contract, or cancel.
12. When an existing task target is missing or ambiguous, present indexed packet choices through confirmation UX instead of guessing.
13. Require explicit operator confirmation before execution beyond task creation or selection.
14. Run in the current foreground call only; do not schedule background or daemon continuation after the response ends.
15. Use `.dove/state.json.settings.auto.maxIterations` as the default foreground iteration limit; the default is 3.
16. Record each foreground iteration and stop reason in `.dove/runtime/results.json`, and return a localized `resultCard` summary without persisting the UX-only card in runtime results.
17. May internally call public Dove workflows such as source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status as needed.
18. For source-research tasks, run the foreground host research pass before confirmed execution: collect concrete URLs/templates/guidelines, extract enough synthesis text, then call confirmed `run_dove_auto` once with explicit `steps` for both `dove.source` and `dove.note` so provenance and synthesis are deposited in the same auto run.
19. Do not claim source research succeeded when host search/fetch tools return zero results, safety errors, or no concrete URLs/snippets; switch to another allowed foreground retrieval path or stop at an explicit host boundary.
20. If host search/fetch/shell/MCP safety classification or tool availability fails before Dove can perform the intended workflow, call `record_dove_mission_pass` for the packet with `resultStatus: "blocked"`, `boundaryType: "host-tool-blocked"`, the failed tool in `requiredActions`, and `nextAction: "project:dove.status"`; do not leave the task in-progress.
21. Do not call confirmed `run_dove_auto` with only a packet id for source-research tasks; that only records a `source-requires-host-provenance` boundary and does not advance the research.
22. Do not auto-run source, note, draft, experience, or review-loop steps without the material they need: source needs title/locator provenance, note needs synthesis content, draft needs body content, experience needs a goal/title/idea/experimentId, and review-loop draft/experience substeps need explicit material.
23. Stop at completed, blocked, killed, authority/review boundary, missing provider credentials, conflicting packet target, or step-budget exhaustion.
24. When a boundary is reached, persist the first-class boundary with required inputs/actions, role handoff, and next command; do not continue through hidden background work.
25. Do not claim host/code/provider/experiment work was completed without real evidence, verification evidence, and `verifiedCriteria` coverage for the executable contract; stop at an awaiting-host/provider, missing-materials, or verification-failed boundary instead.
26. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
27. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
28. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
