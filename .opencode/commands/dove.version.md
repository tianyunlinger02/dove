---
description: "Snapshot, compare, or finalize current mission artifacts."
---

# dove.version

Snapshot, compare, or finalize current mission artifacts.

## Daily use

- Snapshot current mission artifacts before a meaningful revision.
- Compare two snapshots or request fail-closed finalization.
- Targeting: Provide missionId and version ids explicitly.
- Confirmation: Finalization succeeds only from current completion and Reviewer proof.
- Outcome: Version lineage and a real hash comparison are durable.

## Examples

- `/dove.version Snapshot the current draft`
- `/dove.version Compare the previous and current snapshots`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove-package.mjs version . --mission-id "<mission id>" --version-id "<version id>" --artifact "<artifact path>" --mutation-mode direct-process --json`. Run it in the host's current working directory without changing directories or reinterpreting a parent repository as the target; `.` is the Dove workspace being operated on. Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Snapshots and comparisons are mission-bound and hash-current; finalization fails closed without completion and trusted review proof.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Snapshots are immutable ids and contain current hashes and receipt lineage.
13. Comparison rejects stale snapshots; finalization requires complete current receipts and authoritative review proof.
14. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
15. Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
16. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
