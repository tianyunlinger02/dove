---
name: dove-review
description: "Run an isolated audio review over final plan/results and explicitly supplied artifacts without inheriting full project context."
---

# Dove Review

Run an isolated audio review over final plan/results and explicitly supplied artifacts without inheriting full project context.

## Contract

- Command id: `dove.review`
- Domain: `generic`
- Category: `mutation`
- Policy: `isolated-handoff`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/audio/reviews`, `.dove/task-packets/index.json`, `.dove/reviews`.
4. Prefer the `run_audio_review` MCP tool when available.
5. Use explicit handoff artifacts for reviewer isolation; do not share hidden session context.
6. The audio reviewer may read only the current task summary, final plan paths, final result paths, explicit artifact paths, artifact hashes, instructions, and output contract.
7. Do not share writer private transcript, broad project context, orchestration board context, or reviewer private transcript.
8. Import only declared handoff/report artifacts back into Dove review ledgers.
9. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
10. If target resolution is ambiguous, follow `.dove/state.json.settings.taskTargetResolution.autoSelect`: true auto-selects the best candidate; false stops and asks for packetId confirmation.
11. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
12. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
13. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
14. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
