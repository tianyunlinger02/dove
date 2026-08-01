---
description: "Gather materials, draw a project figure, and archive it with caption and QA."
---

# dove-figure

Gather materials, draw a project figure, and archive it with caption and QA.

## Use when

- Gather current materials and draw or revise the requested figure.
- Archive the project output with caption, references, QA, and findings.

## Examples

- `/dove:figure Draw the method overview figure`
- `/dove:figure Revise the current SVG and caption`

## Workflow

- **The user asks to gather materials, draw, or revise a real project figure.**
  1. Call `query_dove_status`. Use operation=status to read the public workspace and lifecycle context. Select an existing work number only when the requested record or artifact identifies it exactly; otherwise ask one zero-write clarification and stop.
  2. Call `manage_dove_mission`. Use operation=start-skill and skill=figure. Refine one minimal goal from the request and current context. Command text is optional constraints; clarify only material ambiguity and do not impose a fixed template. Start one research Skill Mission before gathering materials and drawing with host tools; an artifact-owning mission may be selected as its parent without stopping that parent. Preserve result.selector.missionNumber for every later mission-bound tool and use the supplied research outcome closure exactly once after host work.
  3. Call `record_dove_figure`. After the substantive host work, archive the exact current mission-owned project figure with its caption, references, QA, and findings. Keep the project artifact in place and do not require Review coverage.
- **The user asks to revise an existing project figure.**
  1. Call `query_dove_status`. Use operation=status and select the exact existing work number identified by the requested lifecycle record or artifact before the figure revision. Do not call start-skill, do not guess the latest work, and ask one zero-write clarification if the owner is not unambiguous.
  2. Call `record_dove_figure`. Archive the revised current project figure only after the host work and keep QA and findings non-authoritative.

## Command guidance

- The host gathers materials and produces the figure. Archive only a real current project output with its caption, references, and available QA findings.

## Dove capsule

- Dove MCP tools: `query_dove_status`, `manage_dove_mission`, `record_dove_figure`.
- Use the listed public Dove MCP tools. If they are unavailable, stop and ask the user to re-enter the project host; do not substitute CLI, shell, or direct state access.
- Present only the human `report` when directed. Keep machine channels internal and execute a supplied typed closure once with its binding unchanged.
- Respond concisely in Chinese by default: judgment, evidence or risk, and next action.
