# dove.return

Inspect whether a Dove mission can return with adequate evidence without mutating durable state.

## Goal

Read authoritative `.dove/` state and declared evidence paths to summarize whether the current mission has enough checklist, audit, review, version, and artifact evidence to return safely.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/workspace/index.json`, `.dove/orchestration/board.json`, `.dove/task-packets/index.json`, `.dove/checklists/current.md`, `.dove/reviews/REVIEW_STATE.json`, `.dove/versions/index.json`, `.dove/versions/comparisons.json`, and linked mission-packet or artifact manifests.
2. If the `dove` MCP server is available, call `query_dove_return` with the mission domain/stage, target artifacts, acceptance checks, declared changed-file paths, test/validation evidence paths, validation output paths or text, and review evidence paths.
3. For engineering missions, require declared changed source/test/docs files plus declared test or validation evidence and passing validation output before calling the return ready; use packet `outputPaths` and `evidenceLinks` only as durable declared evidence.
4. Classify return status as `ready`, `needs-audit`, `needs-review`, `needs-execution`, or `blocked`.
5. Recommend exactly one next command.
6. Do not write, repair, refresh, sync, materialize, update the board, append handoffs, generate revision plans, run tests, run git, run review loops, create version snapshots, compare versions, or execute autonomy from this command.

## Output

Return:

```markdown
Return status: `{ready|needs-audit|needs-review|needs-execution|blocked}`
Mission domain: `{paper|engineering|experiment|review|general}`
Mission stage: `{goal|design|checklist|execution|audit|return}`
Evidence read: {short list of durable artifacts and safe declared evidence paths inspected}
Engineering evidence: {declared changed files, validation evidence, validation output status, missing evidence, and no-git/no-test-execution boundary when domain is engineering}
Acceptance verdict: {one sentence}
Next command: `{command}`
Return summary: {what the agent can hand back now, or what is missing}
No-write status: inspection-only; no durable state was changed
```
