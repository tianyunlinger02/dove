# dove-review-loop

Loop isolated review, draft revision, and experience planning until coherent or blocked, with max iterations from global config.

## Contract

- Command id: `dove.review-loop`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Workflow

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/audio/reviews`, `.dove/reviews`, `.dove/drafts`, `.dove/experiments`, `.dove/task-packets/index.json`.
4. Prefer the `run_dove_review_loop` MCP tool when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. Use default 3 as the max iteration count unless `.dove/state.json.settings.reviewLoop.maxIterations` says otherwise.
7. Each iteration should run review, update draft work, and plan missing experience/evidence as needed.
8. Stop early when review is coherent, the task is blocked, a provider boundary is reached, or user input is required.
9. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
10. If target resolution is ambiguous, follow `.dove/state.json.settings.taskTargetResolution.autoSelect`: true auto-selects the best candidate; false stops and asks for packetId confirmation.
11. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
12. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
13. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
14. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
