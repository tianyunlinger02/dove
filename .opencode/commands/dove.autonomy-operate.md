# dove.autonomy-operate

Run the maximum-allowed explicit Dove autonomous operating surface.

## Goal

Use `autonomy-operate` to compose objective/source proposal selection, campaign planning, materialization, bounded approval, foreground autonomy execution, and a durable stop summary in one explicit operator invocation.

## Workflow

1. Read `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/meta/execution-bridge-candidates.json`, `.dove/meta/operator-follow-through.json`, `.dove/programs/campaigns.json`, `.dove/programs/approvals.json`, and `.dove/runtime/controller-state.json` first.
2. Choose the input mode explicitly: provide `sourceType`/`sourceId` to reuse an existing proposal source, or provide an operator `objective` so the surface creates/selects an objective-derived proposal-only execution bridge candidate under `.dove/meta/execution-bridge-candidates.json`.
3. If `dove` MCP is available, prefer `run_autonomy_operate` with `actorRole: "planner"`, an explicit `objective` or source pair, and any needed `workerRole`, `maxSteps`, `executeBy`, or `reviewAfter` bounds.
4. If MCP is unavailable, run `dove autonomy-operate . --objective "..."` or `dove autonomy-operate . --source-type execution-bridge --source-id <id>`.
5. Treat the result as foreground-only and bounded: the command may plan a campaign, materialize one packet, stamp program approval, run explicit foreground autonomy, and stop at a durable continuation/review boundary.
6. For objective-derived incomplete input, use the safe sequence `refresh-research-brief -> refresh-wiki -> run-review-loop`; do not invent note, audit, result-bridge, or claim payloads.
7. Resume from the returned stop summary, `.dove/runtime/continuation.json`, `.dove/runtime/results.json`, and `.dove/programs/runs.json`. Issue fresh approvals explicitly before any next bounded authority window.

## Rule

Do not turn this surface into a hidden daemon, scheduler, host hook, or automatic executor for arbitrary `.dove/meta/*` proposals. It remains explicit, foreground-only, planner-supervised, bounded, durable, and governance-auditable.
