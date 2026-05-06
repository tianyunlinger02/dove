# dove.paper.pipeline

Run the end-to-end Dove workflow for the current paper.

## Goal

Advance the project through the durable writing spine without skipping lifecycle routing, evidence gates, review gates, or major-change closure.

## Recommended order

1. `project:dove.paper.init`
2. `project:dove.paper.orchestrate`
3. `project:dove.paper.research`
4. `project:dove.paper.claim-gate`
5. `project:dove.paper.plan`
6. `project:dove.paper.outline`
7. `project:dove.paper.draft`
8. `project:dove.paper.experiment-plan`
9. `project:dove.paper.experiment-audit`
10. `project:dove.paper.result-bridge`
11. `project:dove.paper.review-loop`
12. `project:dove.paper.rebuttal-strategy`
13. `project:dove.paper.version-snapshot`
14. `project:dove.paper.version-compare`
15. `project:dove.task-graph`
16. `project:dove.paper.open-questions`
17. `project:dove.paper.decisions`
18. `project:dove.paper.lineage`
19. `project:dove.paper.revise`
20. `project:dove.checklist`

## Lifecycle taxonomy

Use `.dove/workspace/index.json.lifecycle` and artifact context manifests to classify work as `objective`, `structure`, `campaign`, `work-unit`, `concern`, `audit`, or `knowledge` before choosing a command.

## Major-change rule

Major paper changes must close through `design → checklist → implementation → acceptance`:

1. `project:dove.paper.plan` records design scope, non-goals, risks, target artifacts, and acceptance evidence.
2. `project:dove.checklist` turns that design into concrete implementation steps and checks.
3. `project:dove.paper.draft`, `project:dove.paper.revise`, experiment, figure, citation, rebuttal, or bridge commands implement only the scoped checklist work.
4. `project:dove.paper.review-loop`, `project:dove.checklist`, `project:dove.paper.version-snapshot`, and `project:dove.paper.version-compare` provide acceptance proof.

## Rule

Do not jump between lifecycle phases without updating `.dove/orchestration/board.json`, refreshing task packets, phase/role manifests, and `.dove/workspace/index.json`, leaving a durable handoff when responsibility changes, and keeping experiment audits plus result-to-claim bridge artifacts honest.
