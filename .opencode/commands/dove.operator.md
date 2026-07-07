---
description: "Run one confirmed foreground operator pass over only safe internal steps, explicit host results, and optional blocker-investigation planning."
---

# dove.operator

Run one confirmed foreground operator pass over only safe internal steps, explicit host results, and optional blocker-investigation planning.

## Daily use

- Use this to inspect compact queueSummary/queuePreview cards plus planner preActionGuidance for the ready/in-progress queue, blocked queue, and pending queue, then run one foreground operator pass after confirmation.
- Do not claim real work happened unless the host supplies actual pass results or a safe internal step can run; otherwise leave host work awaiting host results.
- Targeting: Works over the active mission queue rather than one ad hoc target.
- Confirmation: Preview compact queue summary/cards, read-only lesson recall, Planner/Builder/Reviewer role frame, and writes: [] first; require approval before recording results or creating blocker investigation missions.
- Outcome: Runnable work is recorded from real results, blocked work gets pending investigation missions, and unresolved host work remains awaiting evidence through explicit boundaries with a localized resultCard summary.

## Examples

- `/dove:operator`
- `/dove:operator Run one confirmed queue pass and record real host pass results`

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. If neither a matching Dove capability nor a documented local Dove CLI command exists for this surface, do not emulate it by reading saved records with host tools; say the Dove runtime for this command is unavailable and ask for a capability or CLI route.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Require explicit operator approval before creating or changing saved workflow records or consuming bounded authority.
8. First call `run_dove_operator` without confirmation to return the proposal-only execution contract with compact `queueSummary`, small `queuePreview`, and `writes: []`; do not request full queue arrays unless the operator explicitly asks for `includeQueueDetails: true`.
9. Use interactive confirmation controls when the host supports them before passing `confirmed: true`.
10. Run in the current foreground call only; do not schedule background or daemon continuation after the response ends.
11. For ready and in-progress missions, run one safe internal workflow step when available or collect one real host pass result in order; pass per-task results to `run_dove_operator` with evidence, verificationEvidencePaths, and verifiedCriteria so Dove records lifecycle and runtime state only when the executable contract is covered.
12. Do not claim real engineering, paper, or experiment work happened when neither a safe internal step nor an actual host pass result exists; host-pass-required missions without taskResults must remain unchanged, and host results without convergence coverage must become explicit verification/material boundaries with no fake execution.
13. When no safe internal step, missing step material, or actual host pass result exists, do not persist an `awaiting-host-pass-result` boundary just to show activity; return the material-specific requiredActions and keep durable writes empty unless another real operator action occurred.
14. If a host-side search/fetch/shell/MCP safety classifier or tool-availability failure prevents collecting the pass result, pass a blocked task result with boundaryType `host-tool-blocked` and requiredActions naming the failed host tool instead of leaving the mission in-progress.
15. Preserve durable role handoff metadata while running queue passes; do not expose planner/builder/reviewer as separate slash commands.
16. For blocked missions, default to proposal-only blocker-investigation guidance and do not write child missions; create pending child investigation plan missions only when the operator explicitly requests `blockerInvestigationMode: "create"` or `createBlockedInvestigations: true`, then report created and reused counts separately in the localized `resultCard` summary.
17. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
18. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
19. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
