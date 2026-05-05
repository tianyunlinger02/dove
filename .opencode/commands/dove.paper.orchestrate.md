# dove.paper.orchestrate

Route the operator to the next Dove command without mutating durable state.

## Goal

Use the current `.dove` context and the user's request to recommend exactly one next command. This command is a router, not a board updater.

## Workflow

1. Read `.dove/context/actions/current.json` first when it exists, then inspect `.dove/orchestration/board.json`, `.dove/state.json`, `.dove/workspace/index.json`, `.dove/task-packets/index.json`, and the user's current request.
2. Classify the request by paper lifecycle family: `objective`, `structure`, `campaign`, `work-unit`, `concern`, `audit`, or `knowledge`.
3. Route to one concrete command and explain why that command matches the current focus, lifecycle family, role boundary, and next action.
4. Prefer the three primary manual agents (`planner`, `builder`, `reviewer`); treat research, experiment planning, revision/rebuttal, and version analysis as automatic subagent capabilities.
5. Do not mutate `.dove/`, do not refresh derived surfaces, do not update the board, and do not append handoffs from this command. If the next step needs a mutation, route to the command that owns that mutation.
6. If the user asks to find issues without fixing them, route to `project:dove.paper.audit`.
7. If existing manuscript assets are present but no artifact map exists, route to `dove onboard .` / `dove migrate .` before normal workflow work.
8. If the request is a major paper change, route into the `design → checklist → implementation → acceptance` flow instead of treating it as a direct edit.

## Routing table

| Situation | Route |
|---|---|
| Workspace or project metadata is missing | `project:dove.paper.init` |
| Existing paper assets need adoption/mapping | `dove onboard .` |
| Objective, venue, thesis, or research direction is unclear | `project:dove.paper.research` |
| Need source/note/evidence work | `project:dove.paper.research`, `project:dove.paper.source`, or `project:dove.paper.note` |
| Need claim/evidence gate | `project:dove.paper.claim-gate` |
| Need structure design | `project:dove.paper.plan` |
| Need outline-level structure | `project:dove.paper.outline` |
| Need drafting or section implementation | `project:dove.paper.draft` |
| Need experiment planning or result capture | `project:dove.paper.experiment-plan` |
| Need experiment audit or claim bridge | `project:dove.paper.experiment-audit` or `project:dove.paper.result-bridge` |
| Need issues only, no fixes | `project:dove.paper.audit` |
| Need adversarial review with durable revision loop | `project:dove.paper.review-loop` |
| Need isolated independent reviewer session | `project:dove.paper.isolated-review` |
| Need author-side rebuttal/revision strategy | `project:dove.paper.rebuttal-strategy` |
| Need version snapshot or comparison | `project:dove.paper.version-snapshot` or `project:dove.paper.version-compare` |
| Need task queue/navigation | `project:dove.paper.task-graph` |
| Need governance proof | `project:dove.paper.governance-audit` |
| Need explicit foreground autonomy | `project:dove.paper.autonomy-operate` |

## Output

Return:

```markdown
Recommended next command: `{command}`
Reason: {one sentence tying the route to lifecycle family, current focus, and role boundary}
What it will do: {one sentence about the routed command's responsibility}
```

Do not recommend multiple commands unless the user gave multiple independent requests; split those into separate routes.
