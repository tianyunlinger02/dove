# dove.return

Inspect whether a Dove mission can return with adequate evidence without mutating durable state.

## Goal

Read the compatibility-backed `.paper` workspace and summarize whether the current mission has enough checklist, audit, review, version, and artifact evidence to return safely.

## Workflow

1. Read `.paper/context/actions/current.json` when present, then `.paper/workspace/index.json`, `.paper/orchestration/board.json`, the mission-packet index at `.paper/task-packets/index.json`, `.paper/checklists/paper.md`, `.paper/reviews/REVIEW_STATE.json`, `.paper/versions/index.json`, `.paper/versions/comparisons.json`, and linked mission-packet or artifact manifests.
2. Treat `.paper/workspace/index.json.dove` as the mission kernel summary when present, including current domain, mission stage, role split, active mission count, and review-needed mission count.
3. If `paper-factory` MCP is available, call `query_dove_return` with the mission domain/stage, target artifacts, acceptance checks, declared changed-file paths, test/validation evidence paths, validation output paths or text, and review evidence paths; use `query_dove_mission_board` or `query_dove_audit` for additional Dove no-refresh inspection when needed.
4. For engineering missions, require declared changed source/test/docs files plus declared test or validation evidence and passing validation output before calling the return ready; use active mission packet `outputPaths` and `evidenceLinks` only as durable declared evidence, not as proof of an undeclared git diff.
5. Classify return status as `ready`, `needs-audit`, `needs-review`, `needs-execution`, or `blocked`.
6. Recommend exactly one compatible next command: `project:paper.audit` for no-fix inspection, `project:paper.review-loop` or `project:paper.isolated-review` for independent critique, `project:paper.checklist` for acceptance checklist repair, `project:paper.version-snapshot` for durable return evidence, or `project:paper.version-compare` for regression comparison.
7. Do not write, repair, refresh, sync, materialize, update the board, append handoffs, generate revision plans, run tests, run git, run review loops, create version snapshots, compare versions, or execute autonomy from this command.

## Output

Return:

```markdown
Return status: `{ready|needs-audit|needs-review|needs-execution|blocked}`
Mission domain: `{paper|engineering|experiment|review|general}`
Mission stage: `{goal|design|checklist|execution|audit|return}`
Evidence read: {short list of durable artifacts and safe declared evidence paths inspected}
Engineering evidence: {declared changed files, validation evidence, validation output status, missing evidence, and no-git/no-test-execution boundary when domain is engineering}
Acceptance verdict: {one sentence}
Compatible next command: `{command}`
Return summary: {what the agent can hand back now, or what is missing}
No-write status: inspection-only; no durable state was changed
```
