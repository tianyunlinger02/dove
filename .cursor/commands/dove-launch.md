# dove-launch

Launch one governed Dove mission into the authoritative Dove mission-packet store backed by `.paper/task-packets`.

- Active durable root: `.paper/`; planned future root: `.dove/`.
- Use only with accepted proposal guidance plus `sourceType`, `sourceId`, `executeBy`, and `reviewAfter`.
- Prefer `launch_dove_mission` through MCP, or run `paper-factory dove-launch .` / `dove launch .`.
- This is work creation, not execution: it may write governed Dove mission-packet records backed by `.paper/task-packets`, follow-through, program, and workspace surfaces.
- Preserve planner/builder/reviewer boundaries; builder maps to the compatible paper author role.
- Do not create `.dove/` state, migrate durable roots, run tests, inspect git, execute autonomy, or auto-close the mission.
