---
description: "Turn one user-described figure intent into materials, optional generation/import, caption provenance, and QA status."
---

# dove-figure

Turn one user-described figure intent into materials, optional generation/import, caption provenance, and QA status.

## Daily use

- Use this when the user describes the figure they want once, including where it should help the paper or task.
- Dove should gather linked materials, prepare generation/import, write caption provenance, and validate QA without exposing low-level figure tools.
- Targeting: Resolve the figure request to one durable task packet before any figure write.
- Confirmation: Ask for packet confirmation when the figure target is unclear; provider calls require explicit safe configuration.
- Outcome: A figure plan/run, safe import when available, caption provenance, and QA status are recorded.

## Examples

- `/dove:figure Draw a workflow diagram for the mission-auto-status loop`
- `/dove:figure Prepare the main results figure and caption provenance`

## Contract

- Command id: `dove.figure`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/figures`, `.dove/figures/materials.json`, `.dove/figures/generations.json`, `.dove/figures/captions.json`, `.dove/figures/qa.json`, `.dove/task-packets/index.json`.
4. Prefer the `run_figure_workflow` MCP tool when available.
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
16. Treat the user request as one figure intent; do not ask the user to manually sequence material preparation, result import, or validation.
17. Resolve the durable task packet before any figure workflow write, then analyze linked sections, claims, experiments, sources, notes, review concerns, and material hints automatically.
18. Use redacted Dove config and env-var secret references for external drawing providers; never store inline API keys, tokens, or secrets.
19. Do not mark a final figure ready unless it comes from a validated generation import with durable provenance and caption.
20. Captions must explain the figure purpose and linked evidence.
21. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
22. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
23. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
24. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
25. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
26. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
27. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
