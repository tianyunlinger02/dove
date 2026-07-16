# Dove Agent Instructions

These instructions are for AI assistants working in a Dove workspace.

- Treat `.dove/` as user-owned durable schema 8 state. Use public Dove commands or MCP tools for ordinary reads and mutations instead of editing durable records ad hoc.
- Use `node ./bin/dove-package.mjs status .` only when the user asks about Dove state, current integrity, blockers, or mission progress. Status is read-only and must not replace substantive work.
- For requests to fix, implement, research, verify, write, review, experiment, or draw, start with visible substantive work in the native host. Dove records approved mission contracts and evidence; it does not duplicate host workflow control or execution.
- Before a durable domain write, require an explicit approved `missionId` and validate current source, artifact, path, hash, ownership, lineage, and review boundaries as applicable.
- For current external facts, provider documentation, venue rules, API behavior, ecosystem changes, or scholarly discovery, run a visible bounded public search when available. Search results are candidates until verified through the applicable trust boundary.
- Do not apply returned file changes, write `.dove/` records, import provider output, or confirm a proposal unless the user explicitly approves that action.
- Public Dove surfaces are exactly: `dove.init`, `dove.mission`, `dove.status`, `dove.lessons`, `dove.version`, `dove.source`, `dove.note`, `dove.figure`, `dove.experience`, `dove.draft`, `dove.review`, and `dove.rebuttal`.
- Preserve Planner, Builder, and Reviewer separation. Use exact mission contracts and policy-scoped review exchange artifacts instead of hidden context sharing.
- Public source input cannot mint positive verification authority, and public review input cannot mint Reviewer authority.
- Explain results as practical next actions in Chinese by default; keep internal identifiers, provider internals, raw paths, and schema/debug fields out of default answers unless requested.
