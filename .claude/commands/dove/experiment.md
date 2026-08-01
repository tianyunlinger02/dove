---
description: "Freeze one mission-bound experiment protocol or record its evidence-backed result."
---

# dove.experiment

Freeze one mission-bound experiment protocol or record its evidence-backed result.

## Use when

- Freeze a concrete general protocol before execution.
- Add the real full-denominator result with failures and limitations when available.

## Examples

- `/dove:experiment Freeze the ablation protocol`
- `/dove:experiment Record the completed ablation result`

## Workflow

- **The user asks to freeze a new formal experiment protocol.**
  1. Call `query_dove_status`. Use operation=status to read the public workspace and lifecycle context. Select an existing work number only when the requested record or artifact identifies it exactly; otherwise ask one zero-write clarification and stop.
  2. Call `manage_dove_mission`. Use operation=start-skill and skill=experiment. Refine one minimal goal from the request and current context. Command text is optional constraints; clarify only material ambiguity and do not impose a fixed template. Start one research Skill Mission before the formal protocol write; an artifact-owning mission may be selected as its parent without stopping that parent. Preserve result.selector.missionNumber for every later mission-bound tool and use the supplied research outcome closure exactly once after host work.
  3. Call `record_dove_experiment`. For the new Skill Mission, generate a safe experiment label and provide the complete general protocol before execution.
- **The user asks to record the evidence-backed result for an existing frozen protocol.**
  1. Call `query_dove_status`. Use operation=status and select the exact existing work number identified by the requested lifecycle record or artifact before the experiment result write. Do not call start-skill, do not guess the latest work, and ask one zero-write clarification if the owner is not unambiguous.
  2. Call `record_dove_experiment`. Use the exact protocol work number and experiment label, replay the frozen protocol unchanged, and add the status, outcome, measurements, current evidence references, full denominator, failures, deviations, and limitations from real execution evidence.
- **The user separately asks to record evidence-backed claims from an existing experiment.**
  1. Call `query_dove_status`. Use operation=status and select the exact existing work number identified by the requested lifecycle record or artifact before the experiment claim write. Do not call start-skill, do not guess the latest work, and ask one zero-write clarification if the owner is not unambiguous.
  2. Call `record_dove_claims`. Use the exact protocol work number, generate safe claim labels, and include only claims with current evidence lineage and exact experiment bindings.

## Command guidance

- Freeze one concrete general protocol before execution. Record the full-denominator result only from current execution evidence; record any matching claim separately.

## Dove capsule

- Dove MCP tools: `query_dove_status`, `manage_dove_mission`, `record_dove_experiment`, `record_dove_claims`.
- Use the listed public Dove MCP tools. If they are unavailable, stop and ask the user to re-enter the project host; do not substitute CLI, shell, or direct state access.
- Present only the human `report` when directed. Keep machine channels internal and execute a supplied typed closure once with its binding unchanged.
- Respond concisely in Chinese by default: judgment, evidence or risk, and next action.
