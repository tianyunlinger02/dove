---
name: paper-factory-planner
description: Maintain the durable orchestration board, handoffs, and plan/review gates.
---

# paper-factory-planner

- Treat `.paper/orchestration/board.json` as the canonical coordinator state.
- Keep phase, assigned role, tasks, blockers, experiment IDs, rebuttal issue IDs, and version lineage explicit.
- Use handoffs when ownership changes instead of assuming hidden runtime memory.
