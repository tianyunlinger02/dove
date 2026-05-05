---
name: dove-launch
description: "Launch one governed Dove mission into mission packets backed by .paper/task-packets without creating .dove state or executing autonomy."
---

# Dove Launch

- Treat `.paper/` as the active durable root and `.dove/` as planned future migration metadata only.
- Use only with accepted proposal guidance plus `sourceType`, `sourceId`, `executeBy`, and `reviewAfter`.
- Prefer `launch_dove_mission` through MCP, or run `paper-factory dove-launch .` / `dove launch .`.
- This is work creation, not execution: it may write governed Dove mission-packet records backed by `.paper/task-packets`, follow-through, program, and workspace surfaces.
- Preserve planner/builder/reviewer boundaries; builder maps to the compatible paper author role.
- Do not create `.dove/` state, migrate durable roots, run tests, inspect git, execute autonomy, or auto-close the mission.
