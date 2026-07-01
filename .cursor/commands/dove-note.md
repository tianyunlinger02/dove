---
description: "Organize packet-bound internal synthesis from registered sources, `.dove`, existing artifacts, pressure-test results, and operator notes for the selected task."
---

# dove-note

Organize packet-bound internal synthesis from registered sources, `.dove`, existing artifacts, pressure-test results, and operator notes for the selected task.

## Daily use

- Use this to consolidate internal information from registered sources, existing artifacts, `.dove/`, pressure-test results, or operator notes.
- Use source for external material; use note for project-local synthesis and writing-style/reviewer-preference summaries.
- For bind/save/deposit/沉淀 prompts, write the synthesized result here or in document evidence after source provenance is registered.
- Targeting: Resolve or confirm the durable task packet before writing notes.
- Confirmation: If the target is missing or ambiguous, ask for task confirmation before writing.
- Outcome: The selected task has packet-bound internal notes linked to relevant sources and artifacts.

## Examples

- `/dove:note Summarize what the registered venue sources imply for this task`
- `/dove:note Capture the pressure-test finding and link it to registered sources`

## Contract

- Command id: `dove.note`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/notes/index.json`, `.dove/sources/index.json`.
4. Prefer the `upsert_note` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. For ordinary prompts, first use compact `query_dove_status` and `statusHome.preActionGuidance` for intent routing before choosing a mutation command; users should not need to guess slash command names.
7. For ordinary prompts that ask to bind, save, deposit, archive, or 沉淀 results to a main task, resolve the durable packet first, register external URLs/templates/guidelines as packet-bound sources, then synthesize internal findings through `upsert_note` or `record_document_evidence` instead of treating the synthesis as an external source.
8. When reporting research or venue results, separate snapshot-backed or registered sources from candidate links, blocked retrieval candidates, and internal notes/documents; do not put unverified candidates under a generic `Sources:` list.
9. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
10. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
11. Planner output must be executable: every new or plan-derived mission needs canonical `executionContract.action`, `implementation`, `convergence.criteria`, and `failureRoutes`; do not invent substitute child missions or infer child work from the parent title when explicit child mission details are missing.
12. Builder completion requires a result summary plus real evidence/artifact/validation/verification paths and `verifiedCriteria` that covers every `executionContract.convergence.criteria` item; read-only status, summary-only output, or unknown step status must not mark work complete.
13. Reviewer and audit work may inspect evidence and record explicit review state, but must stay read-only with respect to Builder outputs unless an operator explicitly asks to record review/revision artifacts.
14. Treat status as the project command center and mission as a durable work contract/progress object; rank missing executable contracts, missing source/material inputs, ready Builder execution, verification gaps, reviewer/audit needs, and reconciliation above optional mission details.
15. Dove `.dove/` durable state participates in host rollback only through host-tracked file edits: request `mutationMode: "patch-plan"`, inspect the returned operations, and apply them with the host's tracked file-edit mechanism. Direct CLI/MCP `direct-process` writes remain functional but rollback-unverified; git presence is not proof, and host rollback must not be routed through `reset_dove_version`.
16. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
17. Treat note as internal information consolidation, not external source discovery; external URLs/templates/guidelines must already be registered as sources when they are evidence.
18. For bind/save/deposit/沉淀 requests, write the synthesized findings here or in `record_document_evidence` after source provenance is registered.
19. Do not create a new note without real synthesis content: summary, quote, claim, or open question.
20. Link notes to the resolved durable task packet through packetIds and to relevant sourceIds/artifacts.
21. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
22. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
23. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
24. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
25. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
26. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
27. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
