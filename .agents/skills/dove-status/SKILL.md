---
name: dove-status
description: "Show the live development situation and, only when actionable, confirmed Dove status-adjustment UX."
---

# Dove Status

Show the live development situation and, only when actionable, confirmed Dove status-adjustment UX.

## Daily use

- Use this as the quick dashboard: report the host-visible development situation first.
- Keep durable mission details actionable: only show missions that can be adjusted, and omit the mission list when none are adjustable.
- Targeting: Shows non-init adjustment targets except completed and killed missions; do not show counts or recent completed/killed recaps.
- Confirmation: Use at most one confirmation dialog for status changes; no parseable packetId-to-status adjustment means no mutation.
- Outcome: The operator sees current work, blockers, next action, and optional guarded status adjustments without hidden writes or noisy mission summaries.

## Contract

- Command id: `dove.status`
- Domain: `generic`
- Category: `mutation`
- Policy: `explicit-approval`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`, `.dove/reviews/REVIEW_STATE.json`, `.dove/reviews/concerns.json`, `.dove/versions/index.json`, `.dove/versions/comparisons.json`, `.dove/meta/operator-lessons.json`, `.dove/experiments`, `.dove/checklists/current.md`, `.dove/orchestration/board.json`.
4. Use the `query_dove_status`, `apply_dove_status_adjustments` MCP tools when available.
5. Require explicit operator approval before creating or changing durable workflow state or consuming bounded authority.
6. Use status as the unified project and task dashboard; do not expose separate plan, checklist, audit, return, or orchestration slash surfaces.
7. First call `query_dove_status` to obtain the read-only Dove durable mission dashboard, but do not treat `.dove/` context as the live development situation. Explain the live development situation from host-visible context first: current user request, current session work, known worktree state when available, latest validation/test evidence, active implementation blockers, and what was just completed or is still pending. If live context was not inspected, say so instead of inferring it from `.dove/`.
8. Keep `query_dove_status` read-only: it must return `proposalOnly: true`, `noAutoApply: true`, and `writes: []`.
9. After the live development situation, show only non-init missions that are eligible for status adjustment, excluding `completed` and `killed` missions; if there are no adjustable missions, do not print a mission list.
10. Do not print internal mission summary dumps such as mission counts, status counts, recent completed missions, or recent killed missions in the user-facing status response.
11. When the host supports interactive confirmation controls, use a single confirmation dialog to ask whether the operator wants to modify mission statuses only when there are adjustable missions or the operator clearly asks to change states; do not paginate by mission count or collect choices across multiple dialogs.
12. The single confirmation dialog must provide a no-change path and a change/provide-adjustment-details path; if the operator does not provide parseable `packetId -> status` adjustments in that single dialog, do not call a mutation tool and instead ask for a clear adjustment format.
13. For status adjustment choices, preserve exactly `["pending", "ready", "in-progress", "blocked", "completed", "killed"]` as the machine status enum.
14. Only call `apply_dove_status_adjustments` with `confirmed: true` after that single dialog yields explicit operator-confirmed status adjustments.
15. Killing a mission is now a status choice in this UX, not a standalone public slash command.
16. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
17. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
18. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
