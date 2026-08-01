---
name: dove-note
description: "Research and synthesize internal project material without creating note state."
---

# Dove Note

Research and synthesize internal project material without creating note state.

## Use when

- Investigate an internal project question from current files and context.
- Synthesize project reasoning, gaps, decisions, or implications into the requested host output.

## Examples

- `/dove:note Analyze the current retrieval design`
- `/dove:note Synthesize the unresolved project questions`

## Workflow

- **The user asks for a new bounded internal analysis.**
  1. Call `query_dove_status`. Use operation=status to read the public workspace and lifecycle context. Select an existing work number only when the requested record or artifact identifies it exactly; otherwise ask one zero-write clarification and stop.
  2. Call `manage_dove_mission`. Use operation=start-skill and skill=note. Refine one minimal goal from the request and current context. Command text is optional constraints; clarify only material ambiguity and do not impose a fixed template. Start one research Skill Mission before reading or analyzing project material with host tools; an artifact-owning mission may be selected as its parent without stopping that parent. Preserve result.selector.missionNumber for every later mission-bound tool and use the supplied research outcome closure exactly once after host work.
  - Clarify only if needed: Ask once only when the intended internal research question or output is materially ambiguous.
- **The user explicitly continues an existing bounded note analysis.**
  1. Call `query_dove_status`. Use operation=status and select the exact existing work number identified by the requested lifecycle record or artifact before the continued internal analysis. Do not call start-skill, do not guess the latest work, and ask one zero-write clarification if the owner is not unambiguous.
  - Clarify only if needed: Ask once if the continuation does not identify one exact existing analysis mission.

## Command guidance

- Note is internal-project research and synthesis. Use project files and context, but do not create a Dove note store or treat note output as evidence.

## Dove capsule

- Dove MCP tools: `query_dove_status`, `manage_dove_mission`.
- Use the listed public Dove MCP tools. If they are unavailable, stop and ask the user to re-enter the project host; do not substitute CLI, shell, or direct state access.
- Present only the human `report` when directed. Keep machine channels internal and execute a supplied typed closure once with its binding unchanged.
- Respond concisely in Chinese by default: judgment, evidence or risk, and next action.
