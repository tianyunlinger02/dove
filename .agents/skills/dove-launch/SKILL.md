---
name: dove-launch
description: "Launch one governed Dove mission into mission packets backed by .dove/task-packets without executing autonomy."
---

# Dove Launch

- Treat `.dove/` as the authoritative durable root.
- Use only with accepted proposal guidance plus `sourceType`, `sourceId`, `executeBy`, and `reviewAfter`.
- Prefer `launch_dove_mission` through MCP, or run `dove launch .`.
- This is work creation, not execution: it may write governed Dove mission-packet records backed by `.dove/task-packets`, follow-through, program, and workspace surfaces.
- Preserve planner/builder/reviewer boundaries.
- Do not run tests, inspect git, execute autonomy, or auto-close the mission.
