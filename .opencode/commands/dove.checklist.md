# dove.checklist

Sync the active Dove mission checklist with workspace state and acceptance evidence.

## Goal

Refresh the active checklist so it reflects what is done, what is blocked, which design/checklist/implementation/acceptance stage is active, and what return evidence is still missing across paper, engineering, experiment, review, or general Dove missions.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/state.json`, `.dove/plans/current-plan.md`, `.dove/orchestration/board.json`, `.dove/task-packets/index.json`, `.dove/reviews/REVIEW_STATE.json`, `.dove/revision-plans/current-plan.md`, `.dove/workspace/index.json`, and the relevant artifact paths named by the current mission.
2. For major changes, turn the design into concrete implementation steps plus acceptance checks, preserving scope, non-goals, evidence requirements, and review/version proof obligations.
3. If `dove` MCP is available, call `sync_checklist`.
4. Never mark an item done unless durable files or explicit return evidence support it.
5. When checklist items are ready for execution, route to the command that owns the target artifact: use generic Dove surfaces for mission/task work and `project:dove.paper.*` only for paper-specific drafting, citations, figures, rebuttal, experiment, or review-loop artifacts.

## Rule

Checklist sync summarizes and organizes work; it must not execute the checklist items itself.
