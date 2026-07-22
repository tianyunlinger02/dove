---
description: "Preflight, prepare, import, or verify one policy-scoped schema 9 review exchange without reviewer orchestration."
---

# dove-review

Preflight, prepare, import, or verify one policy-scoped schema 9 review exchange without reviewer orchestration.

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
4. Use only the Dove MCP tool matching the requested operation from this command's allowed tools: `prepare_review_exchange`, `import_review_exchange`, `verify_review_coverage`.
5. Pass only structured public arguments accepted by that tool. Call Dove through MCP only. If MCP is unavailable, stop instead of using another route.
6. For checkpoint operations, let the MCP tool handle its one approval and application inside the same call. Never display or request proposal, replay, workspace, digest, token, mutation-mode, confirmation payload, or generated-command data.
7. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
8. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
9. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
10. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
11. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
12. Only make the specific change requested for this command; do not bundle unrelated work.
13. Policy expresses input scope only: local-preflight, isolated-selected-artifacts, final-plan-results-only, or external.
14. local-preflight is strictly zero-write and non-authoritative; other policies freeze only current mission-owned artifact snapshots.
15. Prepare writes canonical input and manifest artifacts owned together by one preparation receipt; import validates that ledger anchor before accepting the canonical handoff and report.
16. Only completed coherent, needs-revision, or needs-evidence returns count as coverage; blocked or failed returns remain durable but ineligible, and every finding links an in-scope artifact.
17. Imported public review material remains non-authoritative; caller-supplied reviewer identity, verdict, report, handoff, or manifest fields never mint Reviewer authority.
18. Dove does not launch a reviewer, session, subagent, process, loop, or board transition.
19. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
20. Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
21. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
