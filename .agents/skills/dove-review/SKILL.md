---
name: dove-review
description: "Run an isolated audio review over final plan/results and explicitly supplied artifacts without inheriting full project context."
---

# Dove Review

Run an isolated audio review over final plan/results and explicitly supplied artifacts without inheriting full project context.

## Daily use

- Use this for an isolated audio review over final plan/results and explicitly listed artifacts.
- Do not pass broad project context or private writer/reviewer transcripts.
- Targeting: Resolve the review to one durable task packet and explicit artifact paths.
- Confirmation: Reviewer handoff/import remains explicit and artifact-bounded.
- Outcome: Audio review input/output artifacts are recorded without breaking isolation boundaries.

## Examples

- `/dove:review Review the final plan and result artifacts only`
- `/dove:review Prepare an isolated reviewer handoff for the current task`

## Contract

- Command id: `dove.review`
- Domain: `generic`
- Category: `mutation`
- Policy: `isolated-handoff`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/audio/reviews`, `.dove/task-packets/index.json`, `.dove/reviews`.
4. Prefer the `run_audio_review` MCP tool when available.
5. Use explicit handoff artifacts for reviewer isolation; do not share hidden session context.
6. The audio reviewer may read only the current task summary, final plan paths, final result paths, explicit artifact paths, artifact hashes, instructions, and output contract.
7. Do not share writer private transcript, broad project context, orchestration board context, or reviewer private transcript.
8. Import only declared handoff/report artifacts back into Dove review ledgers and return a localized `resultCard` summary for prepared/imported review states.
9. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
10. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
11. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
12. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
13. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
14. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
15. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
