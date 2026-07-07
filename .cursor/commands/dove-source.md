---
description: "Collect and organize external provenance such as web, literature, venue templates, reviewer guidelines, rankings, APIs, or operator-provided sources for the selected task."
---

# dove-source

Collect and organize external provenance such as web, literature, venue templates, reviewer guidelines, rankings, APIs, or operator-provided sources for the selected task.

## Daily use

- Use this to register external information such as papers, web findings, venue templates, reviewer guidelines, rankings, API docs, citations, or operator-provided provenance.
- For bind/save/deposit/沉淀 prompts, register external URLs/templates/guidelines as packet-bound sources first, then use note or document evidence for synthesis.
- Keep source intake separate from internal notes and pressure-test summaries.
- Targeting: Resolve or confirm the durable task packet before recording external source metadata; batch multiple sources with `sources: [...]` when available.
- Confirmation: If no unique task target is available, ask for packet selection instead of guessing.
- Outcome: The selected task has durable packet-bound source metadata when provenance is verified; failed search/fetch returns or surfaces a host-tool-blocked no-write boundary instead of source metadata.

## Examples

- `/dove:source Register these CVPR author/reviewer guideline URLs for the selected task`
- `/dove:source Batch-save venue templates and ranking pages as sources before writing the synthesis note`

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. If neither a matching Dove capability nor a documented local Dove CLI command exists for this surface, do not emulate it by reading saved records with host tools; say the Dove runtime for this command is unavailable and ask for a capability or CLI route.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Only perform the governed change owned by this surface, scoped to the operator request.
8. Treat source as external information intake, not internal note consolidation; pressure-test summaries and writing-style synthesis belong in note or document evidence.
9. Use `register_source` with `sources: [...]` for batch provenance capture when the operator provides multiple URLs/templates/guidelines at once.
10. Never call `register_source` with only a packet id; every new source must include a real title or locator, and source-research auto runs must collect those URLs/templates/guidelines before writing.
11. Treat host search output such as `Did 0 searches`, zero results, empty result sets, or unavailable search as a hard retrieval failure; do not describe it as finding official sources, and do not infer locators from memory or prior transcript context.
12. Do not call `register_source` when search/fetch returned zero results, safe-domain verification failed, or retrieval was blocked; record or surface a `host-tool-blocked` boundary until verifiable source evidence exists.
13. If the host denies or blocks the boundary-recording mutation, stop and report that no durable source or boundary update was written; do not retry another mutating Dove call such as patch-plan without explicit operator approval.
14. Use explicit configured providers or operator-provided material; do not hide network/provider calls.
15. Link each source to the resolved durable task packet through packetIds.
16. For reviewer-guideline or 审稿偏好 research, stay in Builder/researcher source intake unless the operator asks for an independent audit of an artifact.
17. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
18. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
19. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
