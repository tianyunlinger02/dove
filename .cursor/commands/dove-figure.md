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
7. Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.
8. Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.
9. Treat status as the project command center and mission as a durable work contract/progress object; do not make a mission board the default UI.
10. Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work.
11. Treat the user request as one figure intent; do not ask the user to manually sequence material preparation, result import, or validation.
12. Resolve the durable task packet before any figure workflow write, then analyze linked sections, claims, experiments, sources, notes, review concerns, and material hints automatically.
13. Use redacted Dove config and env-var secret references for external drawing providers; never store inline API keys, tokens, or secrets.
14. Do not mark a final figure ready unless it comes from a validated generation import with durable provenance and caption.
15. Captions must explain the figure purpose and linked evidence.
16. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
17. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
18. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
19. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
20. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
21. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
22. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
