---
name: dove-review
description: "Run an isolated audio review over final plan/results and explicitly supplied artifacts without inheriting full project context."
---

# Dove Review

Run an isolated audio review over final plan/results and explicitly supplied artifacts without inheriting full project context.

## Daily use

- Use this for an isolated audio review over final plan/results and explicitly listed artifacts.
- Do not pass broad project context or private writer/reviewer transcripts.
- Targeting: Resolve the review to one durable task packet and explicit artifact paths.
- Confirmation: Reviewer handoff/import remains explicit and artifact-bounded.
- Outcome: Audio review input/output artifacts are recorded without breaking isolation boundaries.

## Examples

- `/dove:review Review the final plan and result artifacts only`
- `/dove:review Prepare an isolated reviewer handoff for the current task`

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. If neither a matching Dove capability nor a documented local Dove CLI command exists for this surface, do not emulate it by reading saved records with host tools; say the Dove runtime for this command is unavailable and ask for a capability or CLI route.
5. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
6. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
7. Use explicit handoff artifacts for reviewer isolation; do not share hidden session context.
8. The audio reviewer may read only the current task summary, final plan paths, final result paths, explicit artifact paths, artifact hashes, instructions, and output contract.
9. Do not share writer private transcript, broad project context, orchestration board context, or reviewer private transcript.
10. Import only declared handoff/report artifacts back into Dove review ledgers and return a localized `resultCard` summary for prepared/imported review states.
11. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
12. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
13. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
