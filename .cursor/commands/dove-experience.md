---
description: "Conceive experiments and reason about them before formal protocol or result recording."
---

# dove-experience

Conceive experiments and reason about them before formal protocol or result recording.

## Use when

- Develop an experiment idea or compare possible designs before execution.
- Reason about feasibility, controls, measurements, risks, or interpretation without formalizing a protocol.

## Examples

- `/dove:experience Design an ablation strategy`
- `/dove:experience Assess whether this experiment can distinguish the hypotheses`

## Workflow

- **The user asks for a new bounded experiment conception or analysis.**
  1. Call `query_dove_status`. Use operation=status to read the public workspace and lifecycle context. Select an existing work number only when the requested record or artifact identifies it exactly; otherwise ask one zero-write clarification and stop.
  2. Call `manage_dove_mission`. Use operation=start-skill and skill=experience. Refine one minimal goal from the request and current context. Command text is optional constraints; clarify only material ambiguity and do not impose a fixed template. Start one research Skill Mission before experiment conception or pre-execution reasoning with host tools; an artifact-owning mission may be selected as its parent without stopping that parent. Preserve result.selector.missionNumber for every later mission-bound tool and use the supplied research outcome closure exactly once after host work.
  - Clarify only if needed: Ask once only when the experiment question or requested reasoning is materially ambiguous.
- **The user explicitly continues an existing bounded experiment analysis.**
  1. Call `query_dove_status`. Use operation=status and select the exact existing work number identified by the requested lifecycle record or artifact before the continued experiment reasoning. Do not call start-skill, do not guess the latest work, and ask one zero-write clarification if the owner is not unambiguous.
  - Clarify only if needed: Ask once if the continuation does not identify one exact existing analysis mission.

## Command guidance

- Experience is experiment conception and pre-execution reasoning. Do not freeze a formal protocol or record a result; use Experiment for those writes.

## Dove capsule

- Dove MCP tools: `query_dove_status`, `manage_dove_mission`.
- Use the listed public Dove MCP tools. If they are unavailable, stop and ask the user to re-enter the project host; do not substitute CLI, shell, or direct state access.
- Present only the human `report` when directed. Keep machine channels internal and execute a supplied typed closure once with its binding unchanged.
- Respond concisely in Chinese by default: judgment, evidence or risk, and next action.
