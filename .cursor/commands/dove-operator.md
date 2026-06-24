---
description: "Run all ready and in-progress Dove missions once, and create blocker-investigation plan missions for blocked work."
---

# dove-operator

Run all ready and in-progress Dove missions once, and create blocker-investigation plan missions for blocked work.

## Daily use

- Use this to inspect compact queue cards plus planner preActionGuidance for the ready/in-progress queue, blocked queue, and pending queue, then run one foreground operator pass after confirmation.
- Do not claim real work happened unless the host supplies actual pass results or a safe internal step can run.
- Targeting: Works over the active mission queue rather than one ad hoc target.
- Confirmation: Preview compact queue cards, read-only lesson recall, Planner/Builder/Reviewer role frame, and writes: [] first; require approval before recording results or creating blocker investigation missions.
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
8. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
9. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
10. Treat status as the project command center and mission as a durable work contract/progress object; do not make a mission board the default UI.
11. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
12. First call `run_dove_operator` without confirmation to return the proposal-only execution contract, including compact queue cards, `autoRunnableTasks`, `hostPassRequiredTasks`, blocked missions, pending skipped missions, and `writes: []`.
13. Use interactive confirmation controls when the host supports them before passing `confirmed: true`.
14. Run in the current foreground call only; do not schedule background or daemon continuation after the response ends.
15. For ready and in-progress missions, run one safe internal workflow step when available or collect one real host pass result in order; pass per-task results to `run_dove_operator` so Dove records lifecycle and runtime state.
16. Do not claim real engineering, paper, or experiment work happened when neither a safe internal step nor an actual host pass result exists; let `run_dove_operator` record awaiting host results instead.
17. When no safe internal step or actual host pass result exists, persist an `awaiting-host-pass-result` boundary rather than marking work complete.
18. Preserve durable role handoff metadata while running queue passes; do not expose planner/builder/reviewer as separate slash commands.
19. For blocked missions, create pending child plan missions that investigate the blocker reason and link back to the blocked mission, then return a localized `resultCard` summary of updated, awaiting, and created work.
20. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
21. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
22. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
