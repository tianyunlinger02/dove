---
name: dove-review
description: "Preflight, prepare, import, or verify one policy-scoped schema 8 review exchange without reviewer orchestration."
---

# Dove Review

Preflight, prepare, import, or verify one policy-scoped schema 8 review exchange without reviewer orchestration.

## Daily use

- Use local-preflight for a zero-write exact scope check.
- Prepare a policy-scoped exchange, let an independent external process or person produce the declared files, then import and verify coverage.
- Targeting: Provide missionId and explicit policy artifact paths; import also requires exchangeId and reviewId.
- Confirmation: Prepare/import are guarded mutations; preflight and coverage verification are read-only.
- Outcome: A tamper-evident mission-bound review and exact current coverage assessment exist without self-issued authority.

## Examples

- `/dove:review Preflight the current methods artifacts`
- `/dove:review Import the returned review exchange`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove-package.mjs review . --mission-id "<mission id>" --review-id "<review id>" --artifact "<artifact path>" --preflight --mutation-mode direct-process --json`. Run it in the host's current working directory without changing directories or reinterpreting a parent repository as the target; `.` is the Dove workspace being operated on. Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Use --preflight for zero-write local checks, --prepare to freeze the canonical exchange, and --import only after the reviewer writes the canonical handoff and report. Distinguish the returned operation field. For prepare, preserve actionablePaths.input, actionablePaths.manifest, actionablePaths.handoff, actionablePaths.report, and importAction exactly. For import, preserve those canonical actionable paths and nextAction exactly. Public imports never mint Reviewer authority.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Policy expresses input scope only: local-preflight, isolated-selected-artifacts, final-plan-results-only, or external.
13. local-preflight is strictly zero-write and non-authoritative; other policies freeze only current mission-owned artifact snapshots.
14. Prepare writes canonical input and manifest artifacts owned together by one preparation receipt; import validates that ledger anchor before accepting the canonical handoff and report.
15. Only completed coherent, needs-revision, or needs-evidence returns count as coverage; blocked or failed returns remain durable but ineligible, and every finding links an in-scope artifact.
16. Imported public review material remains non-authoritative; caller-supplied reviewer identity, verdict, report, handoff, or manifest fields never mint Reviewer authority.
17. Dove does not launch a reviewer, session, subagent, process, loop, board transition, or runtime continuation.
18. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
19. Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
20. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
