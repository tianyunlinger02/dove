# dove.orchestrate

Route the operator through the unified Dove mission model without mutating durable state.

## Goal

Use the current `.paper` context as Dove's compatibility-backed durable root, classify the user's request as one mission, and recommend exactly one next command. This command is a router, not a board updater or executor.

## Workflow

1. Read `.paper/context/actions/current.json` first when it exists, then inspect `.paper/orchestration/board.json`, `.paper/state.json`, `.paper/workspace/index.json`, `.paper/task-packets/index.json`, and the user's current request.
2. If `paper-factory` MCP is available, prefer `query_dove_orchestrate` to get the deterministic no-write route.
3. Classify the mission by Dove domain: `paper`, `engineering`, `experiment`, `review`, or `general`.
4. Map the mission onto the unified lifecycle: `goal → design → checklist → execution → audit → return`.
5. Preserve the three primary role split: `planner` sets direction, `builder` performs work, and `reviewer` independently audits returns. In paper compatibility mode, `builder` maps to the existing `author` role.
6. Recommend exactly one existing `project:dove.*`, `project:paper.*`, or `paper-factory` CLI command as the next compatible execution surface.
7. Do not mutate `.paper/`, refresh derived surfaces, update the board, append handoffs, materialize mission packets, run tests, inspect git, or run autonomy from this command.
8. If the request is paper-specific, keep using the paper-specialized command that owns the capability rather than inventing a parallel Dove branch.

## Routing table

| Mission need | Compatible route |
|---|---|
| Need project/workspace setup | `project:paper.init` |
| Need existing assets mapped | `paper-factory onboard .` |
| Need mission goal, requirement, scope, acceptance, or return protocol framed first | `project:dove.mission` |
| Need goal, requirement, objective, or research direction | `project:paper.research` |
| Need design or architecture/spec structure | `project:paper.plan` |
| Need executable steps and acceptance checks | `project:paper.checklist` |
| Need normal engineering implementation framed as one mission | `project:dove.mission` |
| Need writing or implementation execution | `project:paper.draft` or `project:paper.revise` |
| Need experiment planning or result capture | `project:paper.experiment-plan` |
| Need validation, no-fix audit, or regression inspection | `project:paper.audit` |
| Need independent critique or review loop | `project:paper.review-loop` or `project:paper.isolated-review` |
| Need return readiness before closure | `project:dove.return` |
| Need return/version evidence | `project:paper.version-snapshot` or `project:paper.version-compare` |
| Need explicit bounded autonomy | `project:paper.autonomy-operate` |

## Output

Return:

```markdown
Recommended next command: `{command}`
Mission domain: `{paper|engineering|experiment|review|general}`
Mission stage: `{goal|design|checklist|execution|audit|return}`
Role boundary: {planner/builder/reviewer mapping in one sentence}
Reason: {one sentence tying the route to the current durable state and requested mission}
```

Do not recommend multiple commands unless the user gave multiple independent missions; split those into separate routes.
