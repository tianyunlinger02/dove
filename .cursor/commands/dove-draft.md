# dove-draft

Generate or modify paper draft content from prompts, existing materials, experience, figures, and review information.

## Daily use

- Use this to generate or revise paper sections from the selected task, durable evidence, notes, sources, experiences, figures, and review findings.
- Write as much as current evidence supports and leave explicit placeholders for gaps.
- Targeting: Resolve the draft request to one durable task packet before changing draft artifacts.
- Confirmation: Ask for packet confirmation when the section/task target is ambiguous.
- Outcome: Draft content or section status is updated with evidence-aware placeholders where needed.

## Examples

- `/dove:draft Draft the methods section from linked evidence`
- `/dove:draft Revise the introduction using the latest review findings`

## Contract

- Command id: `dove.draft`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/drafts`, `.dove/evidence/index.json`.
4. Use the `upsert_draft`, `set_section_status` MCP tools when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. Draft as completely as current evidence allows.
7. Use explicit placeholders for missing evidence or citations instead of fabricating support.
8. Incorporate applicable source, note, experience, figure, and review context linked to the resolved task.
9. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
10. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
11. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
12. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
13. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
14. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
15. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
