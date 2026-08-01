---
description: "Create one minimal mission contract or reevaluate its current scientific decision."
---

# dove.mission

Create one minimal mission contract or reevaluate its current scientific decision.

## Use when

- Turn one concrete goal into a minimal mission contract.
- Reevaluate the current scientific judgment after new research evidence arrives.

## Examples

- `/dove:mission Validate the new retrieval method`
- `/dove:mission Reevaluate mission 2 using the latest research outcome`

## Workflow

- **The user asks for a new bounded task under the current workspace mainline without an existing parent.**
  1. Call `manage_dove_mission`. Use operation=create-root and pass explicit mode=research only when the work changes research understanding, experiments, evidence, or paper claims; otherwise pass mode=ordinary. Keep the direct Mission contract proportional to the request and use the in-tool approval checkpoint.
- **The user asks to continue, alter, recover, or explore an alternative from an existing mission.**
  1. Call `query_dove_status`. Use operation=status to read full status and select the exact visible parent mission number.
  2. Call `manage_dove_mission`. Use operation=branch and pass the direct Mission contract for the new child. Stop an active parent in the same checkpoint with stopParentReason, and list handoffArtifactPaths only when permission to update those artifacts must transfer.
- **Current evidence or unconsumed research receipts require a new bounded judgment within the immutable mission contract.**
  1. Call `query_dove_status`. Use operation=status to read full status and select the exact visible mission number and current evidence.
  2. Call `manage_dove_mission`. Use operation=reevaluate-research-decision. Record one current scientific judgment; Dove binds the current decision and its eligible unconsumed receipts. Authorize at most one bounded next action, and do not invent evidence or treat host execution as scientific acceptance.
  - Clarify only if needed: Ask once if the disposition, current evidence, or bounded next action cannot be determined without inventing facts.

## Command guidance

- For a simple new mission, call `manage_dove_mission` directly with the concrete goal and only complete, plainly supported requirements, scope, artifacts, completion conditions, or typed evidence details.
- For branches or reevaluation, select the exact visible mission number from status. Keep the existing mission direction intact; use a branch for a changed task and Workspace for a changed project mainline.

## Dove capsule

- Dove MCP tools: `query_dove_status`, `manage_dove_mission`.
- Use the listed public Dove MCP tools. If they are unavailable, stop and ask the user to re-enter the project host; do not substitute CLI, shell, or direct state access.
- Present only the human `report` when directed. Keep machine channels internal and execute a supplied typed closure once with its binding unchanged.
- Respond concisely in Chinese by default: judgment, evidence or risk, and next action.
