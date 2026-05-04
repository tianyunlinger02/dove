# paper.pipeline

Run the end-to-end paper_factory workflow for the current paper.

## Goal

Advance the project through the durable writing spine without skipping lifecycle routing, evidence gates, review gates, or major-change closure.

## Recommended order

1. `project:paper.init`
2. `project:paper.orchestrate`
3. `project:paper.research`
4. `project:paper.claim-gate`
5. `project:paper.plan`
6. `project:paper.outline`
7. `project:paper.draft`
8. `project:paper.experiment-plan`
9. `project:paper.experiment-audit`
10. `project:paper.result-bridge`
11. `project:paper.review-loop`
12. `project:paper.rebuttal-strategy`
13. `project:paper.version-snapshot`
14. `project:paper.version-compare`
15. `project:paper.task-graph`
16. `project:paper.open-questions`
17. `project:paper.decisions`
18. `project:paper.lineage`
19. `project:paper.revise`
20. `project:paper.checklist`

## Lifecycle taxonomy

Use `.paper/workspace/index.json.lifecycle` and artifact context manifests to classify work as `objective`, `structure`, `campaign`, `work-unit`, `concern`, `audit`, or `knowledge` before choosing a command.

## Major-change rule

Major paper changes must close through `design → checklist → implementation → acceptance`:

1. `project:paper.plan` records design scope, non-goals, risks, target artifacts, and acceptance evidence.
2. `project:paper.checklist` turns that design into concrete implementation steps and checks.
3. `project:paper.draft`, `project:paper.revise`, experiment, figure, citation, rebuttal, or bridge commands implement only the scoped checklist work.
4. `project:paper.review-loop`, `project:paper.checklist`, `project:paper.version-snapshot`, and `project:paper.version-compare` provide acceptance proof.

## Rule

Do not jump between lifecycle phases without updating `.paper/orchestration/board.json`, refreshing task packets, phase/role manifests, and `.paper/workspace/index.json`, leaving a durable handoff when responsibility changes, and keeping experiment audits plus result-to-claim bridge artifacts honest.
