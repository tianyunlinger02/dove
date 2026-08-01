---
name: dove-intake
description: Enter a clear ordinary or research work request into Dove without requiring a slash command.
user-invocable: false
---

# Dove ambient entry

Use this hidden skill only for the current non-slash prompt selected by the project hook.

1. Make a second conservative judgment. Continue with normal host behavior unless the prompt clearly starts new work with an identifiable outcome.
2. For material ambiguity in the goal, boundary, deliverable, or acceptance evidence, ask one concise zero-write clarification round. If the request remains unclear, explain that no work was started and stop.
3. For clear new work, select one explicit `mode`: use `research` only when the work changes research understanding, experiments, evidence, or paper claims; use `ordinary` for clear code, documentation, configuration, cleanup, or another bounded deliverable. Ordinary work still aligns with the current Workspace mainline and is not rejected for low research value. Preserve the request and create only with `create_ambient_dove_mission` through Dove MCP. Keep the mission contract proportional. If evidence requirements are useful, format each as `artifact:<path>` or `validation:<path>`.
4. Call ambient intake before host execution. Resume the original task only after a successful create. If the result requests clarification, blocks, or fails, show only its public human `report` and stop. For success, follow `hostControl.presentation`, use `researchHandoff` as planning input, and keep both machine channels out of user-facing output.
5. Apply the Research Constitution proportionally: prioritize truth, safety, evidence integrity, and long-term value; use real resource facts and existing assets; preserve failed cases and uncertainty; keep claims within evidence; do not treat host return, tests, or internal audit as completion, independent review, or scientific authority.
6. After host execution, when `hostControl.closureRequest` is supplied, invoke its `tool` exactly once. Preserve its complete `boundArgs` binding unchanged, add the declared `requiredOutcomeFields`, apply declared `defaults` for omitted optional fields, and follow any supplied `outcomeContract` literally rather than inferring field values from prose.
7. Use public Dove MCP surfaces for this flow. Keep private mission and control data private, and leave direct Dove state and CLI access to the host integration.
