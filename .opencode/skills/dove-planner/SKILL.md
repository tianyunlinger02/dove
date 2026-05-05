---
name: dove-planner
description: Maintain the durable orchestration board, handoffs, and plan/review gates.
---

# dove-planner

- Treat `.dove/orchestration/board.json` as the canonical coordinator state.
- Keep phase, assigned primary role, tasks, blockers, experiment IDs, rebuttal issue IDs, version lineage, and packet-linked questions/decisions explicit.
- Use `.dove/task-packets/` plus `.dove/context/roles/planner.json` to narrow context before planning the next move.
- Use handoffs when ownership changes instead of assuming hidden runtime memory.
