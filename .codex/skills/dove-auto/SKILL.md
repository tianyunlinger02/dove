---
name: dove-auto
description: "Convert demand like mission intake, then after confirmation run multi-round foreground autonomy until completion or a boundary is reached."
---

# Dove Auto

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

## Contract

- Command id: `dove.auto`
- Domain: `generic`
- Category: `mutation`
- Policy: `explicit-approval`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`, `.dove/runtime`, `.dove/meta/operator-lessons.json`.
4. Prefer the `run_dove_auto` MCP tool when available.
5. Require explicit operator approval before creating or changing durable workflow state or consuming bounded authority.
6. For ordinary prompts, first use compact `query_dove_status` and `statusHome.preActionGuidance` for intent routing before choosing a mutation command; users should not need to guess slash command names.
7. For ordinary prompts that ask to bind, save, deposit, archive, or 沉淀 results to a main task, resolve the durable packet first, register external URLs/templates/guidelines as packet-bound sources, then synthesize internal findings through `upsert_note` or `record_document_evidence` instead of treating the synthesis as an external source.
8. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
9. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
10. Treat status as the project command center and mission as a durable work contract/progress object; do not make a mission board the default UI.
11. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
12. Use the same demand-to-task intake and classification model as `/dove:mission` before autonomous execution starts.
13. Allow `/dove:auto` to be invoked directly on a new user demand or an existing durable task; it does not require running `/dove:mission` first.
14. Return a proposal-only auto contract first: either a converted `proposedTask` with checklist proposal or a `selectedTask` from durable packet selection, plus compact task/auto cards, confirmation args, and max iteration budget.
15. Use interactive confirmation controls when the host supports them (for example Claude Code AskUserQuestion) before passing `confirmed: true`; options should approve and run bounded auto, adjust target/contract, or cancel.
16. When an existing task target is missing or ambiguous, present indexed packet choices through confirmation UX instead of guessing.
17. Require explicit operator confirmation before execution beyond task creation or selection.
18. Run in the current foreground call only; do not schedule background or daemon continuation after the response ends.
19. Use `.dove/state.json.settings.auto.maxIterations` as the default foreground iteration limit; the default is 3.
20. Record each foreground iteration and stop reason in `.dove/runtime/results.json`, and return a localized `resultCard` summary without persisting the UX-only card in runtime results.
21. May internally call public Dove workflows such as source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status as needed.
22. For source-research tasks, do not call confirmed `run_dove_auto` with only a packet id; first collect real URLs/templates/guidelines in the current foreground host pass, then provide them as explicit `steps: [{ command: "dove.source", args: { sources: [...] } }]` or let Dove persist a `source-requires-host-provenance` boundary.
23. Do not auto-run source, note, draft, experience, or review-loop steps without the material they need: source needs title/locator provenance, note needs synthesis content, draft needs body content, experience needs a goal/title/idea/experimentId, and review-loop draft/experience substeps need explicit material.
24. Stop at completed, blocked, killed, authority/review boundary, missing provider credentials, conflicting packet target, or step-budget exhaustion.
25. When a boundary is reached, persist the first-class boundary with required inputs/actions, role handoff, and next command; do not continue through hidden background work.
26. Do not claim host/code/provider/experiment work was completed without real evidence; stop at an awaiting-host/provider boundary instead.
27. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
28. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
29. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
