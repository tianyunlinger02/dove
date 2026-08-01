---
description: "Freeze one exact artifact scope, obtain one isolated host-native Reviewer return, and atomically archive its non-authoritative findings."
---

# dove-review

Freeze one exact artifact scope, obtain one isolated host-native Reviewer return, and atomically archive its non-authoritative findings.

## Use when

- Start the Review Skill Mission and freeze the explicit artifact scope without writes.
- Launch one dedicated native Reviewer, archive its structured return, then close the Review Mission exactly once.

## Examples

- `/dove:review Review the current methods and results artifacts`

## Workflow

- **The user asks for independent review of explicit project artifacts.**
  1. Call `query_dove_status`. Use operation=status to read the public workspace and lifecycle context. Select an existing work number only when the requested record or artifact identifies it exactly; otherwise ask one zero-write clarification and stop.
  2. Call `manage_dove_mission`. Use operation=start-skill and skill=review. Refine one minimal goal from the request and current context. Command text is optional constraints; clarify only material ambiguity and do not impose a fixed template. Start one research Skill Mission before independent assessment of one frozen declared artifact scope; an artifact-owning mission may be selected as its parent without stopping that parent. Preserve result.selector.missionNumber for every later mission-bound tool and use the supplied research outcome closure exactly once after host work.
  3. Call `manage_dove_review`. Call operation=scope exactly once for the new Review Skill Mission. Keep its scope binding and native Reviewer launch request machine-only; scope must be zero-write. Then launch exactly one dedicated fresh read-only Dove Reviewer through that supported native host agent surface, never through MCP, wait synchronously, and accept only its structured return.
  4. Call `manage_dove_review`. Call operation=archive exactly once with the original unchanged scope binding and the dedicated Reviewer's structured return. Then execute the original typed Review Mission closure request exactly once.
  - Clarify only if needed: Ask once only when the artifact boundary is materially ambiguous.

## Command guidance

- Start one Review Skill Mission, freeze one explicit current artifact scope with `manage_dove_review` operation=scope, launch exactly one dedicated fresh read-only `dove-reviewer` through the host-native agent surface, wait synchronously, archive its structured return with operation=archive, then execute the original typed Review Mission closure exactly once.
- Keep the scope binding and launch contract inside `hostControl`; never expose them, use MCP to launch an agent, let the main host impersonate Reviewer, or fall back to an exchange.

## Dove capsule

- Dove MCP tools: `query_dove_status`, `manage_dove_mission`, `manage_dove_review`.
- Use the listed public Dove MCP tools. If they are unavailable, stop and ask the user to re-enter the project host; do not substitute CLI, shell, or direct state access.
- Present only the human `report` when directed. Keep machine channels internal and execute a supplied typed closure once with its binding unchanged.
- Respond concisely in Chinese by default: judgment, evidence or risk, and next action.
