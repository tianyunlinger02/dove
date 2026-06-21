---
name: dove-status
description: "Show the live development situation, then a daily home screen with ranked Dove actions and guarded status-adjustment UX."
---

# Dove Status

Show the live development situation, then a daily home screen with ranked Dove actions and guarded status-adjustment UX.

## Daily use

- Use this as the daily home screen: report the host-visible development situation first.
- Then show compact statusHome/dailyHome.missionList grouped as todo/doing/blocked with done collapsed, followed by ranked 1-3 next action cards, actionable boundaries, and boundary action cards; only request full durable details when the operator explicitly asks to expand/debug.
- Targeting: Shows non-init missions grouped as todo/doing/blocked with done collapsed by default; no raw status-count dumps or completed/killed recaps unless the operator asks to expand done.
- Confirmation: Use compact adjustment cards and at most one confirmation dialog for status changes; no parseable packetId-to-status adjustment means no mutation.
- Outcome: The operator sees current work, grouped missions, actionable boundaries, blockers, next action, optional guarded status adjustments, and localized resultCard summaries after confirmed adjustments without hidden writes or noisy raw summaries.

## Examples

- `/dove:status`
- `/dove:status Show what is blocked and whether any mission status should change`

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
6. Use status as the unified project and task dashboard; do not expose separate plan, checklist, audit, return, or orchestration slash surfaces.
7. First call `query_dove_status` without `detail: "full"` to obtain the compact read-only Dove status home, but do not treat `.dove/` context as the live development situation. Explain the live development situation from host-visible context first: current user request, current session work, known worktree state when available, latest validation/test evidence, active implementation blockers, and what was just completed or is still pending. If live context was not inspected, say so instead of inferring it from `.dove/`.
8. Keep `query_dove_status` read-only: it must return `proposalOnly: true`, `noAutoApply: true`, and `writes: []`.
9. Use `statusHome` and compact `dailyHome` as the daily home screen: after live context first, present `dailyHome.missionList` grouped as `todo`, `doing`, and `blocked`, with `done` collapsed by default, before ranked 1-3 next action cards and proposal-only boundary action cards.
10. Use `dailyHome.missionList` as the default in-host task list so the operator can inspect missions without leaving Claude/OpenCode to run a shell command; do not read a saved full status result file or request `detail: "full"` unless the operator explicitly asks to expand/debug full details.
11. When `dailyHome.completionConsistency.status` is `needs-reconciliation`, present it as a legacy consistency issue: a done parent mission still has open checklist children. Do not recommend blanket-marking children done/completed; say to verify child evidence first, then either mark covered children done through confirmed status adjustment or reopen the parent mission.
12. Use `actionableBoundaries`, `boundaryActionCards`, and current boundary metadata from `query_dove_status` to explain why missions are waiting, what evidence is required, and who owns the next role handoff.
13. Use compact cards for status adjustment previews when available. Do not print raw internal dumps such as raw status-count objects, recent completed mission recaps, or recent killed mission recaps; if showing done missions, keep the `done` group collapsed unless the operator asks to expand it.
14. Boundary types are first-class metadata, not machine status choices; keep status choices exactly `["pending", "ready", "in-progress", "blocked", "completed", "killed"]`.
15. When the host supports interactive confirmation controls, use a single confirmation dialog to ask whether the operator wants to modify mission statuses only when there are adjustable missions or the operator clearly asks to change states; build compact adjustment cards from adjustable missions excluding `completed` and `killed`; do not paginate by mission count or collect choices across multiple dialogs.
16. The single confirmation dialog must provide a no-change path and a change/provide-adjustment-details path; if the operator does not provide parseable `packetId -> status` adjustments in that single dialog, do not call a mutation tool and instead ask for a clear adjustment format.
17. For status adjustment choices, preserve exactly `["pending", "ready", "in-progress", "blocked", "completed", "killed"]` as the machine status enum.
18. Only call `apply_dove_status_adjustments` with `confirmed: true` after that single dialog yields explicit operator-confirmed status adjustments, then show the localized `resultCard` summary.
19. Killing a mission is now a status choice in this UX, not a standalone public slash command.
20. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
21. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
22. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
