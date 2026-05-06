# dove.paper.plan

Create or refresh the durable paper plan, including the design stage for major paper changes.

## Goal

Write `.dove/plans/current-plan.md` so it reflects the thesis, audience, section strategy, evidence gaps, milestones, figure needs, and any major-change design contract.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/state.json`, `.dove/orchestration/board.json`, `.dove/claims/CLAIMS_FROM_RESULTS.md`, `.dove/wiki/index.md`, `.dove/findings.md`, and `.dove/workspace/index.json`.
2. If the request changes objective, thesis, venue strategy, section structure, core claims, experiment interpretation, reviewer-concern strategy, figure set, version/finalization lineage, or campaign/program scope, treat this command as the `design` stage of `design → checklist → implementation → acceptance`.
3. In major-change design, make scope, non-goals, target artifacts, risks, required evidence, acceptance checks, and next owner explicit before any implementation command runs.
4. If `dove` MCP is available, call `upsert_plan` after preparing the plan/design content.
5. Keep the plan evidence-aware: gaps, blockers, and role-owned board tasks stay explicit instead of being smoothed over.
6. Point major changes to `project:dove.checklist`; point ordinary planning work to the next drafting, experiment, or review command.
