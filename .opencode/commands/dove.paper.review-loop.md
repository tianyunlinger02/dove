# dove.paper.review-loop

Run the evidence-aware review loop and provide acceptance evidence for major changes.

## Goal

Produce a durable review entry plus a fresh revision plan from the current paper artifacts, or validate whether a major-change implementation satisfies its design and checklist.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/orchestration/board.json`, `.dove/evidence/index.json`, `.dove/drafts/`, `.dove/reviews/REVIEW_STATE.json`, `.dove/reviews/concerns.json`, `.dove/experiments/audits.json`, `.dove/claims/bridge-log.json`, `.dove/revision-plans/current-plan.md`, and `.dove/checklists/paper.md`.
2. If `dove` MCP is available, call `run_review_loop`.
3. Treat unsupported claims, audit integrity flags, blocked bridge events, and broken result-to-claim bridges as high severity; citation TODOs as medium severity; outline drift as actionable process debt; and unresolved blockers as board-level work.
4. Update persistent concerns, reviewer-vs-author response ownership, adversarial state, revision items, and rebuttal issues so the next review round can resume from files only.
5. For major changes, state whether acceptance passes, fails, or needs more implementation, and cite the design/checklist items that support the verdict.
6. Return the verdict, top action items, and the next best command.
7. When the review loop should run through bounded autonomy, carry `allowedStepType: run-review-loop` plus explicit `reviewScope` and optional `reviewStage` through materialization/approval rather than invoking a free-form reviewer pass.
