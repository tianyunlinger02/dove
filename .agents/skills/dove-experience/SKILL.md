---
name: dove-experience
description: "Convert an idea into experiment goals/plans/results and bridge validated outcomes into claims or conclusions."
---

# Dove Experience

Convert an idea into experiment goals/plans/results and bridge validated outcomes into claims or conclusions.

## Daily use

- Use this as the experiment/evidence workflow: turn ideas into experiment plans, results, audits, and claim impact.
- Do not treat experience as general retrospectives; use lessons for reusable operator guidance.
- Targeting: Resolve the experiment or evidence work to one durable task packet before writing.
- Confirmation: Ask for task confirmation when experiment/result/claim signals do not identify one packet.
- Outcome: Experiment artifacts, audit state, and claim bridge events are linked to the selected task.

## Examples

- `/dove:experience Design an experiment to validate retrieval quality`
- `/dove:experience Import this experiment result and bridge it to the claim`

## Contract

- Command id: `dove.experience`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/experiments`, `.dove/claims`, `.dove/evidence/index.json`, `.dove/task-packets/index.json`.
4. Prefer the `run_experience_workflow` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. Use this as the combined experiment and claim workflow; do not expose separate public experiment or claim-gate slash commands.
7. Make experiment goals, success criteria, result evidence, audit status, and claim impact explicit.
8. Do not promote unsupported results into claims.
9. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
10. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
11. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
12. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
13. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
14. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
15. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
