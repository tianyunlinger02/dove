# paper.review-loop

Run the evidence-aware review loop.

## Goal

Produce a durable review entry plus a fresh revision plan from the current paper artifacts.

## Workflow

1. Read `.paper/orchestration/board.json`, `.paper/evidence/index.json`, `.paper/drafts/`, `.paper/reviews/REVIEW_STATE.json`, `.paper/revision-plans/current-plan.md`, and `.paper/checklists/paper.md`.
2. If `paper-factory` MCP is available, call `run_review_loop`.
3. Treat unsupported claims as high severity, citation TODOs as medium severity, outline drift as actionable process debt, and unresolved blockers as board-level work.
4. Update the review artifacts so rebuttal issues can be normalized without re-inventing state in chat.
5. Return the verdict, top action items, and the next best command.
