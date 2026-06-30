---
description: "Convert demand like mission intake, then after confirmation run multi-round foreground autonomy until completion or a boundary is reached."
---

# dove.auto

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
10. Planner output must be executable: every new or plan-derived mission needs canonical `executionContract.action`, `implementation`, `convergence.criteria`, and `failureRoutes`; do not invent substitute child missions or infer child work from the parent title when explicit child mission details are missing.
11. Builder completion requires a result summary plus real evidence/artifact/validation/verification paths and `verifiedCriteria` that covers every `executionContract.convergence.criteria` item; read-only status, summary-only output, or unknown step status must not mark work complete.
12. Reviewer and audit work may inspect evidence and record explicit review state, but must stay read-only with respect to Builder outputs unless an operator explicitly asks to record review/revision artifacts.
13. Treat status as the project command center and mission as a durable work contract/progress object; rank missing executable contracts, missing source/material inputs, ready Builder execution, verification gaps, reviewer/audit needs, and reconciliation above optional mission details.
14. Dove `.dove/` durable state participates in host rollback only through host-tracked file edits: request `mutationMode: "patch-plan"`, inspect the returned operations, and apply them with the host's tracked file-edit mechanism. Direct CLI/MCP `direct-process` writes remain functional but rollback-unverified; git presence is not proof, and host rollback must not be routed through `reset_dove_version`.
15. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
16. Use the same demand-to-task intake and classification model as `/dove:mission` before autonomous execution starts.
17. Allow `/dove:auto` to be invoked directly on a new user demand or an existing durable task; it does not require running `/dove:mission` first.
18. Return a proposal-only auto contract first: either a converted `proposedTask` with checklist proposal and executable `executionContract`, or a `selectedTask` from durable packet selection with current contract readiness, plus compact task/auto cards, confirmation args, and max iteration budget.
19. Use interactive confirmation controls when the host supports them (for example Claude Code AskUserQuestion) before passing `confirmed: true`; options should approve and run bounded auto, adjust target/contract, or cancel.
20. When an existing task target is missing or ambiguous, present indexed packet choices through confirmation UX instead of guessing.
21. Require explicit operator confirmation before execution beyond task creation or selection.
22. Run in the current foreground call only; do not schedule background or daemon continuation after the response ends.
23. Use `.dove/state.json.settings.auto.maxIterations` as the default foreground iteration limit; the default is 3.
24. Record each foreground iteration and stop reason in `.dove/runtime/results.json`, and return a localized `resultCard` summary without persisting the UX-only card in runtime results.
25. May internally call public Dove workflows such as source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status as needed.
26. For source-research tasks, run the foreground host research pass before confirmed execution: collect concrete URLs/templates/guidelines, extract enough synthesis text, then call confirmed `run_dove_auto` once with explicit `steps` for both `dove.source` and `dove.note` so provenance and synthesis are deposited in the same auto run.
27. Do not claim source research succeeded when host search/fetch tools return zero results, safety errors, or no concrete URLs/snippets; switch to another allowed foreground retrieval path or stop at an explicit host boundary.
28. If host search/fetch/shell/MCP safety classification or tool availability fails before Dove can perform the intended workflow, call `record_dove_mission_pass` for the packet with `resultStatus: "blocked"`, `boundaryType: "host-tool-blocked"`, the failed tool in `requiredActions`, and `nextAction: "project:dove.status"`; do not leave the task in-progress.
29. Do not call confirmed `run_dove_auto` with only a packet id for source-research tasks; that only records a `source-requires-host-provenance` boundary and does not advance the research.
30. Do not auto-run source, note, draft, experience, or review-loop steps without the material they need: source needs title/locator provenance, note needs synthesis content, draft needs body content, experience needs a goal/title/idea/experimentId, and review-loop draft/experience substeps need explicit material.
31. Stop at completed, blocked, killed, authority/review boundary, missing provider credentials, conflicting packet target, or step-budget exhaustion.
32. When a boundary is reached, persist the first-class boundary with required inputs/actions, role handoff, and next command; do not continue through hidden background work.
33. Do not claim host/code/provider/experiment work was completed without real evidence, verification evidence, and `verifiedCriteria` coverage for the executable contract; stop at an awaiting-host/provider, missing-materials, or verification-failed boundary instead.
34. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
35. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
36. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
