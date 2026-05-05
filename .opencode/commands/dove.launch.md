# dove.launch

Launch one governed Dove mission by materializing accepted proposal guidance into the authoritative Dove mission-packet store backed by `.paper/task-packets`.

## Goal

Create a real mission packet only after the operator has selected an accepted remediation pack or packet-type execution bridge candidate, while preserving Dove's staged compatibility boundary: `.paper/` is authoritative and `.dove/` remains planned only.

## Workflow

1. Read the selected proposal source and follow-through context from `.paper/meta/remediation-packs.json`, `.paper/meta/execution-bridge-candidates.json`, `.paper/meta/operator-follow-through.json`, and `.paper/task-packets/index.json`.
2. Confirm the mission has a bounded goal, domain, lifecycle stage, target artifacts, acceptance checks, `executeBy`, and `reviewAfter`.
3. If `paper-factory` MCP is available, call `launch_dove_mission` with `sourceType`, `sourceId`, `actorRole`, `executeBy`, `reviewAfter`, and the Dove mission fields.
4. Treat launch as work creation, not execution: it may write mission packets under `.paper/task-packets/`, `.paper/meta/operator-follow-through.json`, and related `.paper` program/workspace surfaces through the governed materialization bridge.
5. Preserve role boundaries: `planner` supervises launch, `builder` maps to the compatible paper `author` role, and `reviewer` remains independent for audit/return.
6. Do not create `.dove/` state, migrate durable roots, run tests, inspect git, execute autonomy, or auto-close the mission.
7. If autonomy is needed after launch, use an explicit bounded runtime surface separately after the mission packet and approval window exist.

## Rule

Do not use this command to bypass `paper.materialize`; `dove.launch` is a Dove-facing governed wrapper over the same authoritative `.paper` materialization path.
