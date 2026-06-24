---
description: "Collect and organize external provenance such as web, literature, venue templates, reviewer guidelines, rankings, APIs, or operator-provided sources for the selected task."
---

# dove-source

Collect and organize external provenance such as web, literature, venue templates, reviewer guidelines, rankings, APIs, or operator-provided sources for the selected task.

## Daily use

- Use this to register external information such as papers, web findings, venue templates, reviewer guidelines, rankings, API docs, citations, or operator-provided provenance.
- For bind/save/deposit/沉淀 prompts, register external URLs/templates/guidelines as packet-bound sources first, then use note or document evidence for synthesis.
- Keep source intake separate from internal notes and pressure-test summaries.
- Targeting: Resolve or confirm the durable task packet before recording external source metadata; batch multiple sources with `sources: [...]` when available.
- Confirmation: If no unique task target is available, ask for packet selection instead of guessing.
- Outcome: The selected task has durable packet-bound source metadata and provenance links.

## Examples

- `/dove:source Register these CVPR author/reviewer guideline URLs for the selected task`
- `/dove:source Batch-save venue templates and ranking pages as sources before writing the synthesis note`

## Contract

- Command id: `dove.source`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/sources/index.json`.
4. Prefer the `register_source` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. For ordinary prompts, first use compact `query_dove_status` and `statusHome.preActionGuidance` for intent routing before choosing a mutation command; users should not need to guess slash command names.
7. For ordinary prompts that ask to bind, save, deposit, archive, or 沉淀 results to a main task, resolve the durable packet first, register external URLs/templates/guidelines as packet-bound sources, then synthesize internal findings through `upsert_note` or `record_document_evidence` instead of treating the synthesis as an external source.
8. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
9. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
10. Treat status as the project command center and mission as a durable work contract/progress object; do not make a mission board the default UI.
11. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
12. Treat source as external information intake, not internal note consolidation; pressure-test summaries and writing-style synthesis belong in note or document evidence.
13. Use `register_source` with `sources: [...]` for batch provenance capture when the operator provides multiple URLs/templates/guidelines at once.
14. Never call `register_source` with only a packet id; every new source must include a real title or locator, and source-research auto runs must collect those URLs/templates/guidelines before writing.
15. Use explicit configured providers or operator-provided material; do not hide network/provider calls.
16. Link each source to the resolved durable task packet through packetIds.
17. For reviewer-guideline or 审稿偏好 research, stay in Builder/researcher source intake unless the operator asks for an independent audit of an artifact.
18. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
19. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
20. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
21. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
22. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
23. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
24. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
