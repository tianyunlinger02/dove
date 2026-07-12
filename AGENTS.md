# Dove Agent Instructions

These instructions are for AI assistants working in a Dove workspace.

- Treat `.dove/` as Dove-owned durable project state, but do not read, grep, list, or edit saved-record files directly for ordinary answers.
- Use `node ./bin/dove-package.mjs status .` first only when the user asks about Dove state, the next step, blockers, task choice, or whether work should bind to a tracked task.
- When the user needs task choices or asks what a request should bind to, use `node ./bin/dove-package.mjs status . --missions`; do not use full/debug JSON unless the user explicitly asks for debug internals.
- For requests to fix, implement, research, verify, write, review, experiment, or draw, start with visible substantive work: inspect the relevant code/material, run bounded search or validation when needed, produce or revise the requested artifact, or return the specific missing material boundary. Use status only as supporting context.
- Status panels, task packets, saved runtime records, and evidence ledgers are not progress by themselves; do not substitute navigation or bookkeeping for research, development, writing, experiment, figure, or review work.
- For current external facts, provider/tool documentation, venue rules, API behavior, ecosystem changes, or scholarly discovery, run a visible bounded public search/retrieval step when available. Treat search snippets as candidates only; verify useful candidates before recording them as sources, notes, evidence, or claims.
- For figure requests, run `node ./bin/dove-package.mjs figure . --intent "<figure request>"` and summarize the compact result in natural language.
- If a figure needs a target task, use compact status or `--missions` to recommend a task, then ask for or use the user's confirmation before continuing.
- Do not apply returned file changes, write `.dove/` records, call providers, or run autonomy unless the user explicitly approves that action.
- Public Dove surfaces are: `dove.init`, `dove.mission`, `dove.auto`, `dove.status`, `dove.operator`, `dove.lessons`, `dove.version`, `dove.source`, `dove.note`, `dove.figure`, `dove.experience`, `dove.draft`, `dove.review`, `dove.review-loop`, and `dove.rebuttal`.
- Explain results as practical next actions in Chinese by default; keep packet ids, boundary codes, route strings, provider internals, raw paths, and schema/debug fields out of default answers.
- Preserve Planner, Builder, and Reviewer separation; use explicit handoff artifacts instead of hidden context sharing.
- Keep autonomy explicit, foreground-only, bounded, approval-aware, and auditable.
