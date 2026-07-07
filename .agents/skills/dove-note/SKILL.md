---
name: dove-note
description: "Organize packet-bound internal synthesis from registered sources, `.dove`, existing artifacts, pressure-test results, and operator notes for the selected task."
---

# Dove Note

Organize packet-bound internal synthesis from registered sources, `.dove`, existing artifacts, pressure-test results, and operator notes for the selected task.

## Daily use

- Use this to consolidate internal information from registered sources, existing artifacts, `.dove/`, pressure-test results, or operator notes.
- Use source for external material; use note for project-local synthesis and writing-style/reviewer-preference summaries.
- For bind/save/deposit/沉淀 prompts, write the synthesized result here or in document evidence after source provenance is registered.
- Targeting: Resolve or confirm the durable task packet before writing notes.
- Confirmation: If the target is missing or ambiguous, ask for task confirmation before writing.
- Outcome: The selected task has packet-bound internal notes linked to relevant sources and artifacts.

## Examples

- `/dove:note Summarize what the registered venue sources imply for this task`
- `/dove:note Capture the pressure-test finding and link it to registered sources`

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. If neither a matching Dove capability nor a documented local Dove CLI command exists for this surface, do not emulate it by reading saved records with host tools; say the Dove runtime for this command is unavailable and ask for a capability or CLI route.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Only perform the governed change owned by this surface, scoped to the operator request.
8. Treat note as internal information consolidation, not external source discovery; external URLs/templates/guidelines must already be registered as sources when they are evidence.
9. For bind/save/deposit/沉淀 requests, write the synthesized findings here or in `record_document_evidence` after source provenance is registered.
10. Do not create a new note without real synthesis content: summary, quote, claim, or open question.
11. Link notes to the resolved durable task packet through packetIds and to relevant sourceIds/artifacts.
12. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
13. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
14. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
