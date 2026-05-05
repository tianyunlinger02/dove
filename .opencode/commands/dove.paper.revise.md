# dove.paper.revise

Execute the current revision plan as an implementation-stage command.

## Goal

Turn `.dove/revision-plans/current-plan.md` into concrete edits across plans, claims, drafts, figures, experiments, and checklist state without bypassing the design/checklist/implementation/acceptance closure model.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/revision-plans/current-plan.md`, `.dove/plans/current-plan.md`, `.dove/checklists/paper.md`, `.dove/reviews/log.md`, `.dove/reviews/concerns.json`, and the affected artifacts.
2. Resolve one actionable item at a time and keep each edit tied to the checklist or reviewer concern that justified it.
3. Do not introduce new major paper changes while revising; route those back to `project:dove.paper.plan` for a fresh design stage.
4. Update the touched artifacts and keep the checklist honest.
5. Route acceptance proof to `project:dove.paper.review-loop`, `project:dove.paper.checklist`, `project:dove.paper.version-snapshot`, or `project:dove.paper.version-compare`.
