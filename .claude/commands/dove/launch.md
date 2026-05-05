# dove.launch

Launch one governed Dove mission by materializing accepted proposal guidance into the authoritative Dove mission-packet store backed by `.dove/task-packets`.

## Workflow

1. Treat `.dove/` as the authoritative durable root.
2. Use this only after an operator-selected accepted proposal source exists, with `sourceType`, `sourceId`, `executeBy`, and `reviewAfter`.
3. Prefer the `launch_dove_mission` MCP tool, or run `dove launch .` with the same bounded mission fields.
4. Treat launch as work creation, not execution: it may write governed Dove mission-packet records backed by `.dove/task-packets`, follow-through, program, and workspace surfaces.
5. Preserve planner, builder, and reviewer boundaries.
6. Do not run tests, inspect git, execute autonomy, or auto-close the mission.
