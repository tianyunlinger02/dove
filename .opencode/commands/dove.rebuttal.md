# dove.rebuttal

Normalize reviewer issues, build a rebuttal strategy, and draft submission/revision responses.

## Daily use

- Use this to normalize reviewer issues, build response strategy, and draft evidence-backed rebuttal or revision text.
- Keep rebuttal work author-side and linked to claims, sections, experiments, or explicit gaps.
- Targeting: Resolve the rebuttal work to one durable task packet and linked reviewer issues.
- Confirmation: Do not draft final responses from unnormalized issues or unsupported evidence.
- Outcome: Normalized issues, strategy, and response drafts are stored with durable evidence links.

## Contract

- Command id: `dove.rebuttal`
- Domain: `generic`
- Category: `mutation`
- Policy: `guarded-mutation`

## Guardrails

1. Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.
2. Follow Dove's response language preference from `.dove/config.json`, `.dove/config.local.json`, or `.dove/state.json.settings.responseLanguage`; supported values are `zh` for Chinese and `en` for English, and the default is `zh`.
3. Read the narrow durable context first when present: `.dove/context/actions/current.json`, `.dove/workspace/index.json`, `.dove/config.json`, `.dove/config.local.json`, `.dove/state.json`, `.dove/rebuttal/issues.json`, `.dove/rebuttal/strategy.md`, `.dove/rebuttal`.
4. Use the `normalize_rebuttal_issues`, `build_rebuttal_strategy`, `build_rebuttal` MCP tools when available.
5. Only perform the governed mutation owned by this surface, scoped to the operator request.
6. Normalize reviewer issues before drafting responses.
7. Keep rebuttal and revision response work author-side.
8. Link each response to claims, draft sections, experiments, or explicit unresolved placeholders.
9. Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.
10. If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.
11. If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.
12. Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets.
13. Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence.
14. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
15. Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.
