---
name: paper-factory-planner
description: Maintain the durable orchestration board, handoffs, and plan/review gates.
---

# paper-factory-planner

- Treat `.paper/orchestration/board.json` as the canonical coordinator state.
- Keep phase, assigned primary role, tasks, blockers, experiment IDs, rebuttal issue IDs, version lineage, and packet-linked questions/decisions explicit.
- Use `.paper/task-packets/` plus `.paper/context/roles/planner.json` to narrow context before planning the next move.
- Use handoffs when ownership changes instead of assuming hidden runtime memory.
