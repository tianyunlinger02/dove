---
name: dove-operator
description: "Run one confirmed foreground operator pass over only safe internal steps, explicit host results, and optional blocker-investigation planning."
---

# Dove Operator

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

## Contract

- Command id: `dove.operator`
- Domain: `generic`
- Category: `mutation`
- Policy: `explicit-approval`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`, `.dove/runtime`, `.dove/meta/operator-lessons.json`.
4. Prefer the `run_dove_operator` MCP tool when available.
5. Require explicit operator approval before creating or changing durable workflow state or consuming bounded authority.
6. For ordinary prompts, first use compact `query_dove_status` and `statusHome.preActionGuidance` for intent routing before choosing a mutation command; users should not need to guess slash command names.
7. For ordinary prompts that ask to bind, save, deposit, archive, or 沉淀 results to a main task, resolve the durable packet first, register external URLs/templates/guidelines as packet-bound sources, then synthesize internal findings through `upsert_note` or `record_document_evidence` instead of treating the synthesis as an external source.
8. When reporting research or venue results, separate snapshot-backed or registered sources from candidate links, blocked retrieval candidates, and internal notes/documents; do not put unverified candidates under a generic `Sources:` list.
9. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
10. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
11. Planner output must be executable: every new or plan-derived mission needs canonical `executionContract.action`, `implementation`, `convergence.criteria`, and `failureRoutes`; do not invent substitute child missions or infer child work from the parent title when explicit child mission details are missing.
12. Builder completion requires a result summary plus real evidence/artifact/validation/verification paths and `verifiedCriteria` that covers every `executionContract.convergence.criteria` item; read-only status, summary-only output, or unknown step status must not mark work complete.
13. Reviewer and audit work may inspect evidence and record explicit review state, but must stay read-only with respect to Builder outputs unless an operator explicitly asks to record review/revision artifacts.
14. Treat status as the project command center and mission as a durable work contract/progress object; rank missing executable contracts, missing source/material inputs, ready Builder execution, verification gaps, reviewer/audit needs, and reconciliation above optional mission details.
15. Dove `.dove/` durable state participates in host rollback only through host-tracked file edits: request `mutationMode: "patch-plan"`, inspect the returned operations, and apply them with the host's tracked file-edit mechanism. Direct CLI/MCP `direct-process` writes remain functional but rollback-unverified; git presence is not proof, and host rollback must not be routed through `reset_dove_version`.
16. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
17. First call `run_dove_operator` without confirmation to return the proposal-only execution contract with compact `queueSummary`, small `queuePreview`, and `writes: []`; do not request full queue arrays unless the operator explicitly asks for `includeQueueDetails: true`.
18. Use interactive confirmation controls when the host supports them before passing `confirmed: true`.
19. Run in the current foreground call only; do not schedule background or daemon continuation after the response ends.
20. For ready and in-progress missions, run one safe internal workflow step when available or collect one real host pass result in order; pass per-task results to `run_dove_operator` with evidence, verificationEvidencePaths, and verifiedCriteria so Dove records lifecycle and runtime state only when the executable contract is covered.
21. Do not claim real engineering, paper, or experiment work happened when neither a safe internal step nor an actual host pass result exists; host-pass-required missions without taskResults must remain unchanged, and host results without convergence coverage must become explicit verification/material boundaries with no fake execution.
22. When no safe internal step, missing step material, or actual host pass result exists, do not persist an `awaiting-host-pass-result` boundary just to show activity; return the material-specific requiredActions and keep durable writes empty unless another real operator action occurred.
23. If a host-side search/fetch/shell/MCP safety classifier or tool-availability failure prevents collecting the pass result, pass a blocked task result with boundaryType `host-tool-blocked` and requiredActions naming the failed host tool instead of leaving the mission in-progress.
24. Preserve durable role handoff metadata while running queue passes; do not expose planner/builder/reviewer as separate slash commands.
25. For blocked missions, default to proposal-only blocker-investigation guidance and do not write child missions; create pending child investigation plan missions only when the operator explicitly requests `blockerInvestigationMode: "create"` or `createBlockedInvestigations: true`, then report created and reused counts separately in the localized `resultCard` summary.
26. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
27. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
28. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
