---
description: "Normalize reviewer issues, build a rebuttal strategy, and draft submission/revision responses."
---

# dove-rebuttal

Normalize reviewer issues, build a rebuttal strategy, and draft submission/revision responses.

## Daily use

- Use this to normalize reviewer issues, build response strategy, and draft evidence-backed rebuttal or revision text.
- Keep rebuttal work author-side and linked to claims, sections, experiments, or explicit gaps.
- Targeting: Resolve the rebuttal work to one durable task packet and linked reviewer issues.
- Confirmation: Do not draft final responses from unnormalized issues or unsupported evidence.
- Outcome: Normalized issues, strategy, and response drafts are stored with durable evidence links.

## Examples

- `/dove:rebuttal Normalize reviewer issues and build the response strategy`
- `/dove:rebuttal Draft an evidence-backed response for the missing-experiment concern`

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. If neither a matching Dove capability nor a documented local Dove CLI command exists for this surface, do not emulate it by reading saved records with host tools; say the Dove runtime for this command is unavailable and ask for a capability or CLI route.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Only perform the governed change owned by this surface, scoped to the operator request.
8. Normalize reviewer issues before drafting responses.
9. Keep rebuttal and revision response work author-side.
10. Link each response to claims, draft sections, experiments, or explicit unresolved placeholders.
11. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
12. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
13. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
