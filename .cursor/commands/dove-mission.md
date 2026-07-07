---
description: "Convert a user demand into a Dove task contract, then after approval run one bounded foreground mission pass."
---

# dove-mission

Convert a user demand into a Dove task contract, then after approval run one bounded foreground mission pass.

## Daily use

- Use this for one concrete user demand that should become a durable task and receive one bounded foreground pass.
- Describe the desired outcome in normal language; Dove converts it into title, stage, domain, level, checklist, evidence expectations, compact task card, preActionGuidance with read-only lesson recall, and execution route.
- Targeting: Creates a new mission under the init goal; first-run hosts may propose the init goal and mission together before writing.
- Confirmation: Show the compact task card, role-framed preActionGuidance, and converted contract first, then ask whether to approve and run one pass, adjust, or cancel.
- Outcome: After approval, the task packet exists and the host either records the pass result or persists an explicit boundary with evidence requirements, role handoff, and a localized resultCard summary.

## Examples

- `/dove:mission Fix the status dashboard next-action mismatch`
- `/dove:mission Turn the latest review feedback into one executable task`

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. When a local Dove CLI is available, run `node ./bin/dove.mjs mission .` from the project root before answering; summarize its compact output instead of inspecting saved records directly.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Require explicit operator approval before creating or changing saved workflow records or consuming bounded authority.
8. Require an existing init goal before converting user demand into a mission task contract.
9. Treat the operator input as natural-language demand, not as an already-created task.
10. Return a proposal-only mission contract first: title, stage, domain, level, dependencies, blockers, autonomous checklist proposal, compact task card, durable `workContract`, and canonical `executionContract` with action, implementation, materials/readFirst requirements, convergence criteria, evidence requirements, and failure routes.
11. After returning the proposal, use interactive confirmation controls when the host supports them (for example Claude Code AskUserQuestion) with options: approve conversion and run one pass, adjust conversion, or cancel; only pass `confirmed: true` to `create_dove_task` after the operator approves the converted contract.
12. Classify each task as `plan`, `execute`, or `audit` and as `paper`, `experiment`, or `engineering` before writing.
13. User-created mission tasks default to level 3, while explicit operator-created levels 1, 2, 3, or deeper are allowed under the level-0 init goal.
14. Autonomously decide whether a checklist is needed; system-created checklist/subtask packets must be children of their mission and must have level greater than the parent mission level.
15. After materialization, immediately execute one bounded foreground pass in the same command invocation, using the appropriate host tools or top-level Dove workflow.
16. Do not tell the operator to run `/dove:auto` for the first execution pass.
17. After the pass, call `record_dove_mission_pass` to persist the mission result, task status, evidence, blockers, next action, localized `resultCard` summary, `verificationEvidencePaths`, and `verifiedCriteria`; completed results must satisfy the task's `executionContract.convergence.criteria`.
18. If the bounded pass cannot be completed with real host/provider evidence, record a first-class boundary such as `awaiting-host-pass`, `host-tool-blocked`, `missing-required-materials`, or `needs-review` with ownerRole, nextRole, handoff, and evidence requirements instead of claiming completion.
19. When a completed mission pass has stage `plan`, pass explicit child mission outputs to `record_dove_mission_pass` through `plannedMissions`, `resultingMissions`, `missions`, `childMissions`, or `planConversion`; each child must include its own explicit title/goal/objective/summary and executable `executionContract`, otherwise record a planning boundary instead of completing the plan.
20. Default the converted user-level mission to level 3 and `pending`; any converted child missions may be level 4, 5, or deeper and must also default to `pending`.
21. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
22. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
23. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
