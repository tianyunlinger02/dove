# dove.mission

Frame one bounded Dove mission contract without mutating durable state.

## Goal

Turn the operator's request plus the current compatibility-backed `.paper` workspace into one explicit mission shape: goal, domain, lifecycle stage, role owner, compatible paper route, target artifacts, acceptance checks, and return protocol.

## Workflow

1. Read `.paper/context/actions/current.json` when present, then `.paper/workspace/index.json`, `.paper/orchestration/board.json`, `.paper/state.json`, the mission-packet index at `.paper/task-packets/index.json`, and any mission-packet or artifact context named by the user.
2. If `paper-factory` MCP is available, call `query_dove_mission` with the requested goal/domain/stage/artifacts/checks to get the same proposal-only mission contract.
3. Classify the mission domain as `paper`, `engineering`, `experiment`, `review`, or `general`.
4. Place the mission on the Dove lifecycle: `goal`, `design`, `checklist`, `execution`, `audit`, or `return`.
5. Preserve the primary role boundary: `planner` defines the mission and acceptance, `builder` performs writing/code/experiment/revision work, and `reviewer` independently audits the return. In paper compatibility mode, `builder` maps to `author`.
6. For normal engineering requests, use domain `engineering`, allow source/test/docs paths as target artifacts, and require changed files plus tests or validation output in the return protocol.
7. Pick exactly one compatible next command that owns the needed durable mutation, such as `project:paper.plan`, `project:paper.checklist`, `project:paper.materialize`, `project:paper.draft`, `project:paper.revise`, `project:paper.experiment-plan`, or `project:paper.autonomy-operate`.
8. Do not create mission packets, update plans, sync checklists, refresh surfaces, update the board, append handoffs, run tests, run review loops, or execute autonomy from this command.
9. If the mission is paper-specific, keep the paper-specialized command as the execution owner instead of inventing a parallel Dove implementation path.

## Output

Return:

```markdown
Mission goal: {one sentence}
Mission domain: `{paper|engineering|experiment|review|general}`
Mission stage: `{goal|design|checklist|execution|audit|return}`
Primary role: `{planner|builder|reviewer}` with paper compatibility mapping when relevant
Compatible next command: `{command}`
Target artifacts: {short list of existing `.paper/` paths or "not yet known"}
Acceptance checks: {short checklist}
Return protocol: {what evidence or handoff must come back before closure}
No-write status: proposal-only mission contract; no durable state was changed
```
