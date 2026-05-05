# dove.launch

Launch one governed Dove mission by materializing accepted proposal guidance into the authoritative Dove mission-packet store backed by `.dove/task-packets`.

## Goal

Create a real mission packet only after the operator has selected an accepted remediation pack or packet-type execution bridge candidate and provided an explicit execution/review window.

## Workflow

1. Read the selected proposal source and follow-through context from `.dove/meta/remediation-packs.json`, `.dove/meta/execution-bridge-candidates.json`, `.dove/meta/operator-follow-through.json`, and `.dove/task-packets/index.json`.
2. Confirm the mission has a bounded goal, domain, lifecycle stage, target artifacts, acceptance checks, `executeBy`, and `reviewAfter`.
3. If the `dove` MCP server is available, call `launch_dove_mission` with `sourceType`, `sourceId`, `actorRole`, `executeBy`, `reviewAfter`, and the Dove mission fields.
4. Treat launch as work creation, not execution: it may write mission packets under `.dove/task-packets/`, `.dove/meta/operator-follow-through.json`, and related `.dove` program/workspace surfaces through the governed materialization bridge.
5. Preserve role boundaries: `planner` supervises launch, `builder` performs execution work, and `reviewer` remains independent for audit/return.
6. Do not run tests, inspect git, execute autonomy, or auto-close the mission.
7. If autonomy is needed after launch, use an explicit bounded runtime surface separately after the mission packet and approval window exist.

## Rule

`dove.launch` is a governed work-creation surface, not an executor.
