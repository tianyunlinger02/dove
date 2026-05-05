---
name: dove-review-loop
description: Run a strict evidence-aware review and produce a durable revision plan.
---

# dove-review-loop

- Treat unsupported claims, audit integrity flags, and broken result-to-claim bridges as high severity.
- Treat unresolved citation TODOs as medium severity.
- Convert findings into explicit revision items and persistent concerns.
- Append reviews to `.dove/reviews/log.md`, keep `.dove/revision-plans/current-plan.md` current, refresh `.dove/reviews/concerns.json` plus `.dove/reviews/adversarial-state.json`, and reflect open blockers on the orchestration board.
