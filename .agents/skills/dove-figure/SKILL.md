---
name: dove-figure
description: "Turn one user-described figure intent into materials, optional generation/import, caption provenance, and QA status."
---

# Dove Figure

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
6. Treat the user request as one figure intent; do not ask the user to manually sequence material preparation, result import, or validation.
7. Resolve the durable task packet before any figure workflow write, then analyze linked sections, claims, experiments, sources, notes, review concerns, and material hints automatically.
8. Use redacted Dove config and env-var secret references for external drawing providers; never store inline API keys, tokens, or secrets.
9. Do not mark a final figure ready unless it comes from a validated generation import with durable provenance and caption.
10. Captions must explain the figure purpose and linked evidence.
11. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
12. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
13. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
14. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
15. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
16. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
17. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
