---
description: "Loop isolated review, draft revision, and experience planning until coherent or blocked, with max iterations from global config."
---

# dove-review-loop

Loop isolated review, draft revision, and experience planning until coherent or blocked, with max iterations from global config.

## Daily use

- Use this when review, draft revision, and experience planning should iterate together within the configured max rounds.
- Stop when coherent, blocked, at provider/review boundary, or when user input is required.
- Targeting: Resolve the loop to one durable task packet before mutating review/draft/experience artifacts.
- Confirmation: Run only bounded foreground iterations; default max is 3 unless configured otherwise.
- Outcome: Each loop iteration records review, draft, and experience state until the task is coherent or blocked.

## Examples

- `/dove:review-loop Run up to three review and revision rounds for the current draft`
- `/dove:review-loop Stop when the task is coherent or reaches an evidence boundary`

## Contract

- Command id: `dove.review-loop`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/audio/reviews`, `.dove/reviews`, `.dove/drafts`, `.dove/experiments`, `.dove/task-packets/index.json`.
4. Prefer the `run_dove_review_loop` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. Use default 3 as the max iteration count unless `.dove/state.json.settings.reviewLoop.maxIterations` says otherwise.
7. Each iteration should run review, update draft work, and plan missing experience/evidence as needed.
8. Stop early when review is coherent, the task is blocked, a provider boundary is reached, or user input is required.
9. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
10. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
11. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
12. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
13. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
14. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
15. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
