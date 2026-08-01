---
description: "Read one bounded whole-workspace status projection without refreshing state."
---

# dove.status

Read one bounded whole-workspace status projection without refreshing state.

## Use when

- Inspect the bounded whole-workspace graph and current integrity without writes.
- Use the exact one-based mission number shown by status only when detailed context for one mission is needed.

## Examples

- `/dove:status`
- `/dove:status Show detailed integrity for mission 2`

## Workflow

- **The user asks for current status.**
  1. Call `query_dove_status`. Use operation=status. Omit missionNumber for the whole workspace; include it only when the user explicitly selected a visible work number. Return report.briefing verbatim.

## Command guidance

- Return `report.briefing` verbatim as the whole answer, including every heading and line break. Do not answer from another envelope field or summarize, translate, paraphrase, shorten, or reformat it. Omit the mission number for the whole workspace; include an exact visible mission number only when the user selects that mission.

## Dove capsule

- Dove MCP tools: `query_dove_status`.
- Use the listed public Dove MCP tools. If they are unavailable, stop and ask the user to re-enter the project host; do not substitute CLI, shell, or direct state access.
- Present only the human `report` when directed. Keep machine channels internal and execute a supplied typed closure once with its binding unchanged.
- Respond concisely in Chinese by default: judgment, evidence or risk, and next action.
