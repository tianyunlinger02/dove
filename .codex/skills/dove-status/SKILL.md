---
name: dove-status
description: "Show the whole-project situation home: live context, durable project state, blockers, reconciliation, and next steps."
---

# Dove Status

Show the whole-project situation home: live context, durable project state, blockers, reconciliation, and next steps.

## Daily use

- Use this as the whole-project situation home: report the host-visible development situation first.
- Then show durable current context, statusHome.durableContextNotice with mutationRollbackModel showing patch-plan plus host-tracked-edit requirements for `.dove/`, statusHome.preActionGuidance with automatic read-only lesson recall, the Planner/Builder/Reviewer role frame, execution guidance, project state, blockers/reconciliation, execution gaps, and ranked 1-3 next steps; expand optional mission details only when the operator asks and only request full durable details for explicit debug/expansion.
- Targeting: Default output is not a mission board: do not render a Missions section from `/dove:status`. Mission details live under statusHome.optionalMissionDetails collapsed by default as summary/counts, with mission item groups omitted unless showMissions/includeMissionDetails or a normal prompt such as show current missions asks for expansion.
- Confirmation: Do not ask for status changes during default `/dove:status`. Use compact adjustment cards and at most one confirmation dialog only after explicit status-change intent or requestStatusAdjustment/includeStatusAdjustmentPreview; no parseable packetId-to-status adjustment means no mutation.
- Outcome: The operator sees the current project situation, context, blockers, reconciliation issues, next action, optional guarded status adjustments, and localized resultCard summaries after confirmed adjustments without hidden writes or noisy raw summaries.

## Examples

- `/dove:status`
- `/dove:status Show what is blocked and what the next step is`

## Contract

- Command id: `dove.status`
- Domain: `generic`
- Category: `mutation`
- Policy: `explicit-approval`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`, `.dove/reviews/REVIEW_STATE.json`, `.dove/reviews/concerns.json`, `.dove/versions/index.json`, `.dove/versions/comparisons.json`, `.dove/meta/operator-lessons.json`, `.dove/experiments`, `.dove/checklists/current.md`, `.dove/orchestration/board.json`, `.dove/runtime/continuation.json`, `.dove/runtime/events.json`, `.dove/runtime/results.json`.
4. Use the `query_dove_status`, `apply_dove_status_adjustments` MCP tools when available.
5. Require explicit operator approval before creating or changing durable workflow state or consuming bounded authority.
6. For ordinary prompts, first use compact `query_dove_status` and `statusHome.preActionGuidance` for intent routing before choosing a mutation command; users should not need to guess slash command names.
7. For ordinary prompts that ask to bind, save, deposit, archive, or 沉淀 results to a main task, resolve the durable packet first, register external URLs/templates/guidelines as packet-bound sources, then synthesize internal findings through `upsert_note` or `record_document_evidence` instead of treating the synthesis as an external source.
8. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
9. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
10. Planner output must be executable: every new or plan-derived mission needs canonical `executionContract.action`, `implementation`, `convergence.criteria`, and `failureRoutes`; do not invent substitute child missions or infer child work from the parent title when explicit child mission details are missing.
11. Builder completion requires a result summary plus real evidence/artifact/validation/verification paths and `verifiedCriteria` that covers every `executionContract.convergence.criteria` item; read-only status, summary-only output, or unknown step status must not mark work complete.
12. Reviewer and audit work may inspect evidence and record explicit review state, but must stay read-only with respect to Builder outputs unless an operator explicitly asks to record review/revision artifacts.
13. Treat status as the project command center and mission as a durable work contract/progress object; rank missing executable contracts, missing source/material inputs, ready Builder execution, verification gaps, reviewer/audit needs, and reconciliation above optional mission details.
14. Dove `.dove/` durable state participates in host rollback only through host-tracked file edits: request `mutationMode: "patch-plan"`, inspect the returned operations, and apply them with the host's tracked file-edit mechanism. Direct CLI/MCP `direct-process` writes remain functional but rollback-unverified; git presence is not proof, and host rollback must not be routed through `reset_dove_version`.
15. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
16. Use status as the unified whole-project situation home; do not expose separate plan, checklist, audit, return, orchestration, missions, board, or list slash surfaces.
17. First call `query_dove_status` without `detail: "full"` to obtain the compact read-only Dove project situation home, but do not treat `.dove/` context as the live development situation. Explain the live development situation from host-visible context first: current user request, current session work, known worktree state when available, latest validation/test evidence, active implementation blockers, and what was just completed or is still pending. If live context was not inspected, say so instead of inferring it from `.dove/`.
18. Keep `query_dove_status` read-only: it must return `proposalOnly: true`, `noAutoApply: true`, and `writes: []`.
19. Surface `statusHome.durableContextNotice`: filesystem durable state rollback eligibility requires `mutationRollbackModel.patchPlanSupported: true`, host-tracked file edits applying `mutationMode: "patch-plan"` operations, `hostCheckpointStatus: not-programmatically-verifiable`, `externalWriteCaptureVerified: false`, `directProcessWritesAreRollbackSafe: false`, and `doveRestoreSupported: false`; direct-process writes remain functional but rollback-unverified, and status adjustment is only for small state corrections, not rollback restore.
20. Use `statusHome` as the compact project situation home with this order: host-visible live development situation, `statusHome.currentContext`, `statusHome.preActionGuidance`, `statusHome.projectState`, `statusHome.blockersAndReconciliation`, `statusHome.nextSteps`, and optional mission details only when the operator asks.
21. Do not make mission lists the default body of `/dove:status`; default status must not render a `Missions` section, and `statusHome.optionalMissionDetails` is collapsed by default as a summary/count expansion handle with mission item groups omitted unless the operator explicitly asks for `show current missions`, `有哪些 mission`, `--missions`, `showMissions`, or `includeMissionDetails`.
22. For normal mission-list prompts, call compact `query_dove_status` with `showMissions: true` or `includeMissionDetails: true` and expand `statusHome.optionalMissionDetails`; do not add or require `/dove:missions`, `/dove:board`, `/dove:list`, and do not route mission-list questions to `/dove:mission`.
23. Treat `query_dove_mission_board` as a low-level MCP/debug board, not the default host route for ordinary mission-list prompts.
24. Do not read a saved full status result file or request `detail: "full"` unless the operator explicitly asks to expand/debug full details.
25. When `statusHome.blockersAndReconciliation.completionConsistency.status` is `needs-reconciliation`, present it as a legacy consistency issue: a done parent mission still has open checklist children. Do not recommend blanket-marking children done/completed; say to verify child evidence first, then either mark covered children done through confirmed status adjustment or reopen the parent mission.
26. Use `actionableBoundaries`, `boundaryActionCards`, and current boundary metadata from `query_dove_status` to explain why missions are waiting, what evidence is required, and who owns the next role handoff.
27. Use compact cards for status adjustment previews when available. Do not print raw internal dumps such as raw status-count objects, recent completed mission recaps, or recent killed mission recaps; if showing optional mission details, keep the `done` group collapsed unless the operator asks to expand it.
28. Boundary types are first-class metadata, not machine status choices; keep status choices exactly `["pending", "ready", "in-progress", "blocked", "completed", "killed"]`.
29. When the host supports interactive confirmation controls, do not ask whether to modify mission statuses during default `/dove:status`; use a single confirmation dialog only when the operator clearly asks to change states or calls `query_dove_status` with `requestStatusAdjustment`/`includeStatusAdjustmentPreview`; build compact adjustment cards from adjustable missions excluding `completed` and `killed`; do not paginate by mission count or collect choices across multiple dialogs.
30. The single confirmation dialog must provide a no-change path and a change/provide-adjustment-details path; if the operator does not provide parseable `packetId -> status` adjustments in that single dialog, do not call a mutation tool and instead ask for a clear adjustment format.
31. For status adjustment choices, preserve exactly `["pending", "ready", "in-progress", "blocked", "completed", "killed"]` as the machine status enum.
32. Only call `apply_dove_status_adjustments` with `confirmed: true` after that single dialog yields explicit operator-confirmed status adjustments, then show the localized `resultCard` summary.
33. Killing a mission is now a status choice in this UX, not a standalone public slash command.
34. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
35. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
36. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
