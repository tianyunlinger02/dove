# dove.paper.checklist

Sync the paper-domain view of the active Dove mission checklist.

## Goal

Use `project:dove.checklist` semantics, scoped to paper writing, research, citations, experiments, figures, review, rebuttal, and version acceptance proof.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/state.json`, `.dove/plans/current-plan.md`, `.dove/reviews/REVIEW_STATE.json`, `.dove/revision-plans/current-plan.md`, `.dove/workspace/index.json`, paper-domain task packets, and the draft directory.
2. For major paper changes, turn the design into concrete implementation steps plus acceptance checks, preserving scope, non-goals, evidence requirements, and review/version proof obligations.
3. If `dove` MCP is available, call `sync_checklist`.
4. Never mark an item done unless durable files support it.
5. Route ready paper work to `project:dove.paper.draft`, `project:dove.paper.revise`, `project:dove.paper.experiment-plan`, `project:dove.paper.result-bridge`, or the specific paper command that owns the target artifact.

## Rule

This is a paper-domain view of `project:dove.checklist`; it should not execute checklist items itself.
