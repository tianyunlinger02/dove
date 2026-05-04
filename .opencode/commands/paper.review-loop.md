# paper.review-loop

Run the evidence-aware review loop and provide acceptance evidence for major changes.

## Goal

Produce a durable review entry plus a fresh revision plan from the current paper artifacts, or validate whether a major-change implementation satisfies its design and checklist.

## Workflow

1. Read `.paper/context/actions/current.json` when present, then `.paper/orchestration/board.json`, `.paper/evidence/index.json`, `.paper/drafts/`, `.paper/reviews/REVIEW_STATE.json`, `.paper/reviews/concerns.json`, `.paper/experiments/audits.json`, `.paper/claims/bridge-log.json`, `.paper/revision-plans/current-plan.md`, and `.paper/checklists/paper.md`.
2. If `paper-factory` MCP is available, call `run_review_loop`.
3. Treat unsupported claims, audit integrity flags, blocked bridge events, and broken result-to-claim bridges as high severity; citation TODOs as medium severity; outline drift as actionable process debt; and unresolved blockers as board-level work.
4. Update persistent concerns, reviewer-vs-author response ownership, adversarial state, revision items, and rebuttal issues so the next review round can resume from files only.
5. For major changes, state whether acceptance passes, fails, or needs more implementation, and cite the design/checklist items that support the verdict.
6. Return the verdict, top action items, and the next best command.
7. When the review loop should run through bounded autonomy, carry `allowedStepType: run-review-loop` plus explicit `reviewScope` and optional `reviewStage` through materialization/approval rather than invoking a free-form reviewer pass.
