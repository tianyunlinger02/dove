---
description: "Convert an idea into experiment goals/plans/results and bridge validated outcomes into claims or conclusions."
---

# dove-experience

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
6. For ordinary prompts, first use compact `query_dove_status` and `statusHome.preActionGuidance` for intent routing before choosing a mutation command; users should not need to guess slash command names.
7. For ordinary prompts that ask to bind, save, deposit, archive, or 沉淀 results to a main task, resolve the durable packet first, register external URLs/templates/guidelines as packet-bound sources, then synthesize internal findings through `upsert_note` or `record_document_evidence` instead of treating the synthesis as an external source.
8. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
9. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
10. Treat status as the project command center and mission as a durable work contract/progress object; do not make a mission board the default UI.
11. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
12. Use this as the combined experiment and claim workflow; do not expose separate public experiment or claim-gate slash commands.
13. Make experiment goals, success criteria, result evidence, audit status, and claim impact explicit.
14. Do not create a placeholder experience plan without a real goal, title, idea, or experimentId.
15. Do not promote unsupported results into claims.
16. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
17. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
18. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
19. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
20. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
21. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
22. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
