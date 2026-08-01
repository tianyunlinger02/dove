---
description: "Research external content and optionally register or reject captured source candidates."
---

# dove-source

Research external content and optionally register or reject captured source candidates.

## Use when

- Research external content with host-native search and visibly capture selected material before registration.
- Query, register, or reject real external source candidates when requested.

## Examples

- `/dove:source Find and register a relevant public paper`
- `/dove:source Reject the candidate after checking the captured PDF`

## Workflow

- **The user asks about an existing source collection or candidate.**
  1. Call `query_dove_status`. Use operation=status and select the exact existing work number identified by the requested lifecycle record or artifact before the source query. Do not call start-skill, do not guess the latest work, and ask one zero-write clarification if the owner is not unambiguous.
  2. Call `manage_dove_sources`. Use operation=query for the exact work that owns the requested source collection or candidate and apply only requested filters.
- **The user asks to find or register new external content.**
  1. Call `query_dove_status`. Use operation=status to read the public workspace and lifecycle context. Select an existing work number only when the requested record or artifact identifies it exactly; otherwise ask one zero-write clarification and stop.
  2. Call `manage_dove_mission`. Use operation=start-skill and skill=source. Refine one minimal goal from the request and current context. Command text is optional constraints; clarify only material ambiguity and do not impose a fixed template. Start one research Skill Mission before external discovery; an artifact-owning mission may be selected as its parent without stopping that parent. Preserve result.selector.missionNumber for every later mission-bound tool and use the supplied research outcome closure exactly once after host work.
  3. Call `manage_dove_sources`. After host-native discovery and visible capture, use operation=register for the new Skill Mission with a safe stable label and the real captured external-material path.
- **The user explicitly rejects an existing external candidate after audit.**
  1. Call `query_dove_status`. Use operation=status and select the exact existing work number identified by the requested lifecycle record or artifact before the source audit. Do not call start-skill, do not guess the latest work, and ask one zero-write clarification if the owner is not unambiguous.
  2. Call `manage_dove_sources`. Use operation=reject for the exact work that owns the candidate and record only a supported rejection; never claim positive trust.
  - Clarify only if needed: Ask once if the candidate to reject does not identify one exact work number.

## Command guidance

- Source is external-content research. Discover and visibly capture selected outside material with host tools before registration; a registered source remains a candidate, and public verification may reject but never trust it.

## Dove capsule

- Dove MCP tools: `query_dove_status`, `manage_dove_mission`, `manage_dove_sources`.
- Use the listed public Dove MCP tools. If they are unavailable, stop and ask the user to re-enter the project host; do not substitute CLI, shell, or direct state access.
- Present only the human `report` when directed. Keep machine channels internal and execute a supplied typed closure once with its binding unchanged.
- Respond concisely in Chinese by default: judgment, evidence or risk, and next action.
