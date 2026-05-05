# dove.paper.isolated-review

Run an isolated parallel-session reviewer handoff.

## Goal

Start a reviewer process or session that cannot see the writer/main session's private transcript, then import only the explicit handoff/report artifacts it writes.

## Workflow

1. Read `.dove/context/actions/current.json`, `.dove/orchestration/board.json`, `.dove/reviews/concerns.json`, `.dove/evidence/index.json`, `.dove/claims/bridge-log.json`, `.dove/experiments/audits.json`, `.dove/revision-plans/current-plan.md`, and `.dove/drafts/`.
2. Treat the current session as the writer/main session and the external reviewer as a separate parallel session. Do not paste hidden writer-session reasoning into the reviewer input.
3. Invoke the one-shot runner through CLI: `node ./bin/dove.mjs isolated-review . --reviewer-command "$DOVE_ISOLATED_REVIEWER_COMMAND" --scope "current paper pipeline"`.
4. The runner writes `.dove/reviews/isolated/<run-id>/input.json`, passes only explicit input/output paths to the reviewer command, and imports only `handoff.json` plus optional `report.md`.
5. If the reviewer needs clarification, record it as an explicit artifact under the isolated run directory before continuing; do not rely on hidden transcript sharing.
6. Return the verdict, top concerns, action items, report path, handoff path, and input hash so the operator can verify the review boundary.
