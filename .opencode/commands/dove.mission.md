# dove.mission

Frame one bounded Dove mission contract without mutating durable state.

## Goal

Turn the operator request plus authoritative `.dove/` workspace context into one explicit mission shape: goal, domain, lifecycle stage, role owner, target artifacts, acceptance checks, and return protocol.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/workspace/index.json`, `.dove/orchestration/board.json`, `.dove/state.json`, `.dove/task-packets/index.json`, and any mission-packet or artifact context named by the user.
2. If the `dove` MCP server is available, call `query_dove_mission` with the requested goal, domain, stage, artifacts, and checks.
3. Classify the mission domain as `paper`, `engineering`, `experiment`, `review`, or `general`.
4. Place the mission on the lifecycle: `goal`, `design`, `checklist`, `execution`, `audit`, or `return`.
5. Preserve the primary role boundary: `planner` defines the mission and acceptance, `builder` performs writing/code/experiment/revision work, and `reviewer` independently audits the return.
6. For engineering requests, use domain `engineering`, allow source/test/docs paths as target artifacts, and require changed files plus tests or validation output in the return protocol.
7. Pick exactly one next command that owns the needed durable mutation.
8. Do not create mission packets, update plans, sync checklists, refresh surfaces, update the board, append handoffs, run tests, run review loops, or execute autonomy from this command.

## Output

Return:

```markdown
Mission goal: {one sentence}
Mission domain: `{paper|engineering|experiment|review|general}`
Mission stage: `{goal|design|checklist|execution|audit|return}`
Primary role: `{planner|builder|reviewer}`
Next command: `{command}`
Target artifacts: {short list of existing `.dove/` paths or "not yet known"}
Acceptance checks: {short checklist}
Return protocol: {what evidence or handoff must come back before closure}
No-write status: proposal-only mission contract; no durable state was changed
```
