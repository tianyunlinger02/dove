# dove.board

Inspect the compatibility-backed Dove mission board without mutating durable state.

## Goal

Read the current `.paper` board, workspace index, and mission packets backed by `.paper/task-packets` as one Dove mission board so the operator can see mission domains, lifecycle stages, role ownership, queues, and the next compatible route.

## Workflow

1. Read `.paper/orchestration/board.json`, `.paper/workspace/index.json`, `.paper/task-packets/index.json`, `.paper/reviews/state.json`, `.paper/versions/index.json`, `.paper/versions/comparisons.json`, and `.paper/checklist.md` as available.
2. If `paper-factory` MCP is available, call `query_dove_mission_board` with any requested domain, stage, mission packet, status, or archived filters.
3. Treat `.paper/` as the active durable root and `.dove/` as planned compatibility metadata only.
4. Group visible missions by Dove domain, lifecycle stage, lifecycle status, and planner/builder/reviewer role boundary.
5. Recommend one compatible next command using existing `project:dove.*` or `project:paper.*` surfaces.
6. Do not refresh workspace indexes, update the board, materialize mission packets, append handoffs, run tests, run git, run autonomy, repair JSON, or mutate `.paper/` from this command.

## Output

Return:

```markdown
Mission board status: `{summary}`
Durable root: `.paper` compatibility mode; planned root `.dove`
Current mission: `{domain}` / `{stage}` / `{planner|builder|reviewer}`
Queues: `{active/waiting/review-needed/blocked/stale/ready/archive counts}`
Recommended next command: `{one command}`
Reason: {one sentence tied to the as-read durable state}
```
