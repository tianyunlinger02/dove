# paper.pipeline

Run the end-to-end paper_factory workflow for the current paper.

## Goal

Advance the project through the durable writing spine without skipping the evidence and review gates.

## Recommended order

1. `project:paper.init`
2. `project:paper.orchestrate`
3. `project:paper.research`
4. `project:paper.claim-gate`
5. `project:paper.plan`
6. `project:paper.outline`
7. `project:paper.draft`
8. `project:paper.experiment-plan`
9. `project:paper.review-loop`
10. `project:paper.rebuttal-strategy`
11. `project:paper.version-snapshot`
12. `project:paper.version-compare`
13. `project:paper.revise`
14. `project:paper.checklist`

## Rule

Do not jump between lifecycle phases without updating `.paper/orchestration/board.json`, leaving a durable handoff when responsibility changes, and keeping experiments/rebuttal/version artifacts honest.
