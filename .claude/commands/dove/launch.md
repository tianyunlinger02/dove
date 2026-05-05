# dove.launch

Launch one governed Dove mission by materializing accepted proposal guidance into the authoritative Dove mission-packet store backed by `.paper/task-packets`.

## Workflow

1. Treat `.paper/` as the active durable root and `.dove/` as planned future migration metadata only.
2. Use this only after an operator-selected accepted proposal source exists, with `sourceType`, `sourceId`, `executeBy`, and `reviewAfter`.
3. Prefer the `launch_dove_mission` MCP tool, or run `paper-factory dove-launch .` / `dove launch .` with the same bounded mission fields.
4. Treat launch as work creation, not execution: it may write governed Dove mission-packet records backed by `.paper/task-packets`, follow-through, program, and workspace surfaces.
5. Preserve role boundaries: planner supervises launch, builder maps to paper author, and reviewer stays independent for audit/return.
6. Do not create `.dove/` state, migrate durable roots, run tests, inspect git, execute autonomy, or auto-close the mission.
