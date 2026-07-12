---
name: dove-source
description: "Collect and organize external material such as web pages, papers, venue templates, reviewer guidelines, rankings, APIs, or operator-provided sources for the selected task."
---

# Dove Source

Collect and organize external material such as web pages, papers, venue templates, reviewer guidelines, rankings, APIs, or operator-provided sources for the selected task.

## Daily use

- Use this to add external information such as papers, web findings, venue templates, reviewer guidelines, rankings, API docs, citations, or operator-provided links or material.
- When the user asks for current outside information or scholarly material, run read-only public no-key network search or visible retrieval as candidate discovery, then verify useful candidates before registration.
- For bind/save/deposit/沉淀 prompts, add external material first, then use note or document evidence for synthesis.
- Keep source intake separate from internal notes and pressure-test summaries.
- Targeting: Resolve or confirm the task before adding external source details; batch multiple sources when the operator provides them together.
- Confirmation: If no unique task target is available, ask for task selection instead of guessing.
- Outcome: The selected task has verified source details, or the request stops clearly because retrieval or verification failed.

## Examples

- `/dove:source Add these CVPR author/reviewer guideline URLs to the selected task`
- `/dove:source Add venue templates and ranking pages before writing the synthesis note`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project action: `node ./bin/dove-package.mjs source . --target "<task title>" --title "<source title>" --locator "<url or doi>" --mutation-mode direct-process` from the project root; Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly.
5. Use this only after the source material is verified; if retrieval or verification fails, say no source was added and name the missing material.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Only add external material when it has a real title, locator, citation, URL, or operator-provided links or material.
13. Use public no-key network search or visible retrieval for candidate discovery when current outside information is needed, but register only verified candidates.
14. If search, fetch, or verification finds no trustworthy material, say no source was added and explain the next retrieval step.
15. When the target task is unclear, ask the operator to choose from visible context instead of inspecting project state.
16. When source work cannot finish here, say the source material is ready and has not yet been added to the task; the natural Chinese phrasing is `这条来源还没加入任务`.
17. Batch multiple sources when the operator provides them together.
18. Keep source intake separate from synthesis; use note or document evidence for summaries and conclusions.
19. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
20. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
21. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
