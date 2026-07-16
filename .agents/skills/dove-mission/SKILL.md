---
name: dove-mission
description: "Propose and persist one minimal mission contract, then return control to the host."
---

# Dove Mission

Propose and persist one minimal mission contract, then return control to the host.

## Daily use

- Turn one concrete goal into a minimal mission contract.
- After approval, continue substantive work with native host planning and tools.
- Targeting: The missionId is explicit or deterministically proposed; no packet target is resolved.
- Confirmation: Approve the exact proposal, adjust it, or cancel.
- Outcome: One durable mission contract exists and no orchestration route is created.

## Examples

- `/dove:mission Validate the new retrieval method`
- `/dove:mission Revise the methods draft from current evidence`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project check: `node ./bin/dove-package.mjs mission . --goal "<mission goal>" --mutation-mode direct-process --json`. Run it in the host's current working directory without changing directories or reinterpreting a parent repository as the target; `.` is the Dove workspace being operated on. Summarize its practical result instead of inspecting internal files directly.
5. After approval, run the exact confirmation command returned by the proposal, persist only that contract, and continue with native host planning and tools.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Ask for approval before making changes or spending the proposed work rounds.
12. Persist only goal, scope, out-of-scope, target and expected artifacts, completion criteria, evidence requirements, dependencies, and supersession metadata.
13. Proposal is zero-write; confirmation must exactly replay the returned contract and target artifact identities.
14. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
15. Keep the handoff brief identical to the approved contract content; do not add a next command, role, route, authority, status, or blocker-routing instruction.
