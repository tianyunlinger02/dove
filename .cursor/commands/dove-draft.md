---
description: "Write or revise a substantive project draft and archive its current evidence-backed path."
---

# dove-draft

Write or revise a substantive project draft and archive its current evidence-backed path.

## Use when

- Write or revise the requested substantive project draft from current evidence.
- Archive its current project path, references, QA, and findings.

## Examples

- `/dove:draft Write the methods section`
- `/dove:draft Revise the current draft from the latest evidence`

## Workflow

- **The user asks to write a new substantive project draft.**
  1. Call `query_dove_status`. Use operation=status to read the public workspace and lifecycle context. Select an existing work number only when the requested record or artifact identifies it exactly; otherwise ask one zero-write clarification and stop.
  2. Call `manage_dove_mission`. Use operation=start-skill and skill=draft. Refine one minimal goal from the request and current context. Command text is optional constraints; clarify only material ambiguity and do not impose a fixed template. Start one research Skill Mission before drafting with host tools; an artifact-owning mission may be selected as its parent without stopping that parent. Preserve result.selector.missionNumber for every later mission-bound tool and use the supplied research outcome closure exactly once after host work.
  3. Call `record_dove_draft`. After substantive host writing, archive the exact current mission-owned project draft and current references. Keep the project artifact in place and do not impose a writing template.
- **The user asks to revise an existing project draft.**
  1. Call `query_dove_status`. Use operation=status and select the exact existing work number identified by the requested lifecycle record or artifact before the draft revision. Do not call start-skill, do not guess the latest work, and ask one zero-write clarification if the owner is not unambiguous.
  2. Call `record_dove_draft`. Archive the revised project draft only after substantive host work; QA and findings remain non-authoritative annotations.

## Command guidance

- The host writes or revises the substantive project draft, then archives its current project path and references.

## Dove capsule

- Dove MCP tools: `query_dove_status`, `manage_dove_mission`, `record_dove_draft`.
- Use the listed public Dove MCP tools. If they are unavailable, stop and ask the user to re-enter the project host; do not substitute CLI, shell, or direct state access.
- Present only the human `report` when directed. Keep machine channels internal and execute a supplied typed closure once with its binding unchanged.
- Respond concisely in Chinese by default: judgment, evidence or risk, and next action.
