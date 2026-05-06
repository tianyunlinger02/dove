# dove.board

Inspect the Dove mission board without mutating durable state.

## Goal

Read the current `.dove` board, workspace index, and mission packets as one Dove mission board so the operator can see domains, lifecycle stages, role ownership, queues, and next routes.

## Workflow

1. Read `.dove/orchestration/board.json`, `.dove/workspace/index.json`, `.dove/task-packets/index.json`, `.dove/reviews/state.json`, `.dove/versions/index.json`, `.dove/versions/comparisons.json`, and `.dove/checklists/current.md` as available.
2. If the `dove` MCP server is available, call `query_dove_mission_board` with any requested domain, stage, mission packet, status, or archived filters.
3. Treat `.dove/` as the authoritative durable root.
4. Group visible missions by Dove domain, lifecycle stage, lifecycle status, and planner/builder/reviewer role boundary.
5. Recommend one next command using existing `project:dove.*` or `project:dove.paper.*` surfaces.
6. Do not refresh workspace indexes, update the board, materialize mission packets, append handoffs, run tests, run git, run autonomy, repair JSON, or mutate `.dove/` from this command.

## Output

Return:

```markdown
Mission board status: `{summary}`
Durable root: `.dove`
Current mission: `{domain}` / `{stage}` / `{planner|builder|reviewer}`
Queues: `{active/waiting/review-needed/blocked/stale/ready/archive counts}`
Recommended next command: `{one command}`
Reason: {one sentence tied to the as-read durable state}
```
