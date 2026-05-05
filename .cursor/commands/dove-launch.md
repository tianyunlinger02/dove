# dove-launch

Launch one governed Dove mission into the authoritative Dove mission-packet store backed by `.dove/task-packets`.

- Authoritative durable root: `.dove/`.
- Use only with accepted proposal guidance plus `sourceType`, `sourceId`, `executeBy`, and `reviewAfter`.
- Prefer `launch_dove_mission` through MCP, or run `dove launch .`.
- This is work creation, not execution: it may write governed Dove mission-packet records backed by `.dove/task-packets`, follow-through, program, and workspace surfaces.
- Preserve planner/builder/reviewer boundaries.
- Do not run tests, inspect git, execute autonomy, or auto-close the mission.
