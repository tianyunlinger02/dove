---
description: "Generate or modify paper draft content from prompts, existing materials, experience, figures, and review information."
---

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

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. If neither a matching Dove capability nor a documented local Dove CLI command exists for this surface, do not emulate it by reading saved records with host tools; say the Dove runtime for this command is unavailable and ask for a capability or CLI route.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Only perform the governed change owned by this surface, scoped to the operator request.
8. Draft as completely as current evidence allows.
9. Do not create or update a draft without body content; use `set_section_status` for metadata-only updates.
10. Use explicit placeholders for missing evidence or citations inside real draft content instead of fabricating support.
11. Incorporate applicable source, note, experience, figure, and review context linked to the resolved task.
12. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
13. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
14. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
