---
description: "Create a direction-change point and clear active non-init work with confirmation."
---

# dove.version

Create a direction-change point and clear active non-init work with confirmation.

## Daily use

- Use this when the project direction changes enough that active non-init work should be cleared.
- For host/context rollback, use patch-plan and apply the returned `.dove/` file operations through host-tracked file edits before relying on the host native checkpoint; `/dove:version` is not a `.dove` restore command.
- Targeting: Operates on the workspace task set for direction reset.
- Confirmation: Guarded reset; require a reason before clearing active non-init tasks.
- Outcome: A direction reset stores a version snapshot, clears active non-init tasks, and points the next command at mission.

## Examples

- `/dove:version Change direction to focus on result-card usability`
- `/dove:version Reset active tasks after a major project direction change`

## Contract

- Command id: `dove.version`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/task-packets/index.json`, `.dove/versions`, `.dove/meta/operator-lessons.json`.
4. Prefer the `reset_dove_version` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. For ordinary prompts, first use compact `query_dove_status` and `statusHome.preActionGuidance` for intent routing before choosing a mutation command; users should not need to guess slash command names.
7. For ordinary prompts that ask to bind, save, deposit, archive, or 沉淀 results to a main task, resolve the durable packet first, register external URLs/templates/guidelines as packet-bound sources, then synthesize internal findings through `upsert_note` or `record_document_evidence` instead of treating the synthesis as an external source.
8. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
9. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
10. Planner output must be executable: every new or plan-derived mission needs canonical `executionContract.action`, `implementation`, `convergence.criteria`, and `failureRoutes`; do not invent substitute child missions or infer child work from the parent title when explicit child mission details are missing.
11. Builder completion requires a result summary plus real evidence/artifact/validation/verification paths and `verifiedCriteria` that covers every `executionContract.convergence.criteria` item; read-only status, summary-only output, or unknown step status must not mark work complete.
12. Reviewer and audit work may inspect evidence and record explicit review state, but must stay read-only with respect to Builder outputs unless an operator explicitly asks to record review/revision artifacts.
13. Treat status as the project command center and mission as a durable work contract/progress object; rank missing executable contracts, missing source/material inputs, ready Builder execution, verification gaps, reviewer/audit needs, and reconciliation above optional mission details.
14. Dove `.dove/` durable state participates in host rollback only through host-tracked file edits: request `mutationMode: "patch-plan"`, inspect the returned operations, and apply them with the host's tracked file-edit mechanism. Direct CLI/MCP `direct-process` writes remain functional but rollback-unverified; git presence is not proof, and host rollback must not be routed through `reset_dove_version`.
15. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
16. For direction changes, snapshot the current direction before resetting active tasks.
17. Do not use `/dove:version` as a `.dove` rollback restore entrypoint; host/context rollback belongs to the host and can cover Dove workflow artifacts only when patch-plan operations are applied through host-tracked file edits.
18. Preserve the level-0 init goal and required global or task lessons during direction-change resets.
19. Return a clean status summary and recommend `/dove:mission` for the next direction after direction reset.
20. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
21. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
22. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
