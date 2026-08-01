---
description: "Analyze findings, revise project artifacts, and archive an author-side response."
---

# dove.rebuttal

Analyze findings, revise project artifacts, and archive an author-side response.

## Use when

- Analyze current findings and make the requested author-side revisions.
- Archive the project response with preserved finding references and remaining uncertainty.

## Examples

- `/dove.rebuttal Address the archived reviewer findings`
- `/dove.rebuttal Revise the response with current evidence`

## Workflow

- **The user asks for author-side rebuttal or revision work from archived findings.**
  1. Call `query_dove_status`. Use operation=status to read the public workspace and lifecycle context. Select an existing work number only when the requested record or artifact identifies it exactly; otherwise ask one zero-write clarification and stop.
  2. Call `manage_dove_mission`. Use operation=start-skill and skill=rebuttal. Refine one minimal goal from the request and current context. Command text is optional constraints; clarify only material ambiguity and do not impose a fixed template. Start one research Skill Mission before author-side rebuttal work with host tools; an artifact-owning mission may be selected as its parent without stopping that parent. Preserve result.selector.missionNumber for every later mission-bound tool and use the supplied research outcome closure exactly once after host work.
  3. Call `record_dove_rebuttal`. After substantive host work, archive the exact current mission-owned rebuttal and preserved current findings. Findings may be non-authoritative; never mint reviewer sign-off.
- **The user asks to revise an existing author-side rebuttal.**
  1. Call `query_dove_status`. Use operation=status and select the exact existing work number identified by the requested lifecycle record or artifact before the rebuttal revision. Do not call start-skill, do not guess the latest work, and ask one zero-write clarification if the owner is not unambiguous.
  2. Call `record_dove_rebuttal`. Archive the revised project rebuttal while preserving finding references and remaining uncertainty.
  - Clarify only if needed: Ask once if the rebuttal artifact or preserved finding cannot be identified exactly.

## Command guidance

- Keep the substantive response and revisions author-side, preserve current finding references, and never claim independent reviewer sign-off.

## Dove capsule

- Dove MCP tools: `query_dove_status`, `manage_dove_mission`, `record_dove_rebuttal`.
- Use the listed public Dove MCP tools. If they are unavailable, stop and ask the user to re-enter the project host; do not substitute CLI, shell, or direct state access.
- Present only the human `report` when directed. Keep machine channels internal and execute a supplied typed closure once with its binding unchanged.
- Respond concisely in Chinese by default: judgment, evidence or risk, and next action.
