# dove.paper.autonomy-operate

Run the paper-domain view of the explicit Dove autonomous operating surface.

## Goal

Use `project:dove.autonomy-operate` semantics, scoped to paper research, review, experiment, rebuttal, or revision objectives that need bounded foreground autonomy.

## Workflow

1. Read `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/meta/execution-bridge-candidates.json`, `.dove/meta/operator-follow-through.json`, `.dove/programs/campaigns.json`, `.dove/programs/approvals.json`, and `.dove/runtime/controller-state.json` first.
2. Choose the input mode explicitly: provide `sourceType`/`sourceId` to reuse an accepted paper-domain proposal source, or provide a paper objective so the surface creates/selects an objective-derived proposal-only execution bridge candidate.
3. If `dove` MCP is available, prefer `run_autonomy_operate` with `actorRole: "planner"`, explicit objective or source pair, and any needed `workerRole`, `maxSteps`, `executeBy`, or `reviewAfter` bounds.
4. If MCP is unavailable, run `dove autonomy-operate . --objective "..."` or `dove autonomy-operate . --source-type execution-bridge --source-id <id>`.
5. Resume from the returned stop summary, `.dove/runtime/continuation.json`, `.dove/runtime/results.json`, and `.dove/programs/runs.json`.

## Rule

This is a paper-domain view of `project:dove.autonomy-operate`. It remains explicit, foreground-only, planner-supervised, bounded, durable, and governance-auditable.
