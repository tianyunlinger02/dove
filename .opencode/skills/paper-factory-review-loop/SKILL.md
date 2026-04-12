---
name: paper-factory-review-loop
description: Run a strict evidence-aware review and produce a durable revision plan.
---

# paper-factory-review-loop

- Treat unsupported claims, audit integrity flags, and broken result-to-claim bridges as high severity.
- Treat unresolved citation TODOs as medium severity.
- Convert findings into explicit revision items and persistent concerns.
- Append reviews to `.paper/reviews/log.md`, keep `.paper/revision-plans/current-plan.md` current, refresh `.paper/reviews/concerns.json` plus `.paper/reviews/adversarial-state.json`, and reflect open blockers on the orchestration board.
