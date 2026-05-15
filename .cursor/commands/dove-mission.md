# dove-mission

Convert a user demand into a Dove task contract, then after approval run one bounded foreground mission pass.

## Daily use

- Use this for one concrete user demand that should become a durable task and receive one bounded foreground pass.
- Describe the desired outcome in normal language; Dove converts it into title, stage, domain, level, checklist, evidence expectations, and execution route.
- Targeting: Creates a new mission under the init goal; first-run hosts may propose the init goal and mission together before writing.
- Confirmation: Show the converted contract first, then ask whether to approve and run one pass, adjust, or cancel.
- Outcome: After approval, the task packet exists and the host either records the pass result or explicitly reports that host pass evidence is still required.

## Contract

- Command id: `dove.mission`
- Domain: `generic`
- Category: `mutation`
- Policy: `explicit-approval`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`, `.dove/meta/operator-lessons.json`, `.dove/runtime`.
4. Use the `create_dove_task`, `record_dove_mission_pass` MCP tools when available.
5. Require explicit operator approval before creating or changing durable workflow state or consuming bounded authority.
6. Require an existing init goal before converting user demand into a mission task contract.
7. Treat the operator input as natural-language demand, not as an already-created task.
8. Return a proposal-only mission contract first: title, stage, domain, level, dependencies, blockers, evidence expectations, autonomous checklist proposal, and recommended execution route.
9. After returning the proposal, use interactive confirmation controls when the host supports them (for example Claude Code AskUserQuestion) with options: approve conversion and run one pass, adjust conversion, or cancel; only pass `confirmed: true` to `create_dove_task` after the operator approves the converted contract.
10. Classify each task as `plan`, `execute`, or `audit` and as `paper`, `experiment`, or `engineering` before writing.
11. User-created mission tasks default to level 3, while explicit operator-created levels 1, 2, 3, or deeper are allowed under the level-0 init goal.
12. Autonomously decide whether a checklist is needed; system-created checklist/subtask packets must be children of their mission and must have level greater than the parent mission level.
13. After materialization, immediately execute one bounded foreground pass in the same command invocation, using the appropriate host tools or top-level Dove workflow.
14. Do not tell the operator to run `/dove:auto` for the first execution pass.
15. After the pass, call `record_dove_mission_pass` to persist the mission result, task status, evidence, blockers, and next action.
16. When a completed mission pass has stage `plan`, pass explicit plan outputs to `record_dove_mission_pass` through `plannedMissions`, `resultingMissions`, `missions`, `childMissions`, or `planConversion` so Dove converts the plan into pending durable missions.
17. Default the converted user-level mission to level 3 and `pending`; any converted child missions may be level 4, 5, or deeper and must also default to `pending`.
18. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
19. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
20. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
21. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
22. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
23. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
24. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
