# paper.orchestrate

Route the operator to the next paper_factory command without mutating durable state.

## Goal

Use the current `.paper` context and the user's request to recommend exactly one next command. This command is a router, not a board updater.

## Workflow

1. Read `.paper/context/actions/current.json` first when it exists, then inspect `.paper/orchestration/board.json`, `.paper/state.json`, `.paper/workspace/index.json`, `.paper/task-packets/index.json`, and the user's current request.
2. Classify the request by paper lifecycle family: `objective`, `structure`, `campaign`, `work-unit`, `concern`, `audit`, or `knowledge`.
3. Route to one concrete command and explain why that command matches the current focus, lifecycle family, role boundary, and next action.
4. Prefer the three primary manual agents (`planner`, `author`, `reviewer`); treat research, experiment planning, revision/rebuttal, and version analysis as automatic subagent capabilities unless compatibility with existing artifacts requires a legacy role ID.
5. Do not mutate `.paper/`, do not refresh derived surfaces, do not update the board, and do not append handoffs from this command. If the next step needs a mutation, route to the command that owns that mutation.
6. If the user asks to find issues without fixing them, route to `project:paper.audit`.
7. If existing manuscript assets are present but no artifact map exists, route to `paper-factory onboard .` / `paper-factory migrate .` before normal workflow work.
8. If the request is a major paper change, route into the `design → checklist → implementation → acceptance` flow instead of treating it as a direct edit.

## Routing table

| Situation | Route |
|---|---|
| Workspace or project metadata is missing | `project:paper.init` |
| Existing paper assets need adoption/mapping | `paper-factory onboard .` |
| Objective, venue, thesis, or research direction is unclear | `project:paper.research` |
| Need source/note/evidence work | `project:paper.research`, `project:paper.source`, or `project:paper.note` |
| Need claim/evidence gate | `project:paper.claim-gate` |
| Need structure design | `project:paper.plan` |
| Need outline-level structure | `project:paper.outline` |
| Need drafting or section implementation | `project:paper.draft` |
| Need experiment planning or result capture | `project:paper.experiment-plan` |
| Need experiment audit or claim bridge | `project:paper.experiment-audit` or `project:paper.result-bridge` |
| Need issues only, no fixes | `project:paper.audit` |
| Need adversarial review with durable revision loop | `project:paper.review-loop` |
| Need isolated independent reviewer session | `project:paper.isolated-review` |
| Need author-side rebuttal/revision strategy | `project:paper.rebuttal-strategy` |
| Need version snapshot or comparison | `project:paper.version-snapshot` or `project:paper.version-compare` |
| Need task queue/navigation | `project:paper.task-graph` |
| Need governance proof | `project:paper.governance-audit` |
| Need explicit foreground autonomy | `project:paper.autonomy-operate` |

## Output

Return:

```markdown
Recommended next command: `{command}`
Reason: {one sentence tying the route to lifecycle family, current focus, and role boundary}
What it will do: {one sentence about the routed command's responsibility}
```

Do not recommend multiple commands unless the user gave multiple independent requests; split those into separate routes.
