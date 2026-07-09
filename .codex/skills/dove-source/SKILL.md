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

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has no listed project check. Do not run status, `node ./bin/dove.mjs source --help`, the matching local surface, or any other unlisted command for it. If the target is unclear, ask the operator to choose from visible context. If this chat cannot finish the requested work directly, answer with what material is ready, what has not been added to the task, and the next user choice; do not explain why the tool is unavailable.
5. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
6. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
7. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
8. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
9. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
10. Only make the specific change requested for this command; do not bundle unrelated work.
11. Only add external material when it has a real title, locator, citation, URL, or operator-provided links or material.
12. Use public no-key network search or visible retrieval for candidate discovery when current outside information is needed, but register only verified candidates.
13. If search, fetch, or verification finds no trustworthy material, say no source was added and explain the next retrieval step.
14. When the target task is unclear, ask the operator to choose from visible context instead of inspecting project state.
15. When source work cannot finish here, say the source material is ready and has not yet been added to the task; the natural Chinese phrasing is `这条来源还没加入任务`.
16. Batch multiple sources when the operator provides them together.
17. Keep source intake separate from synthesis; use note or document evidence for summaries and conclusions.
18. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
19. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
20. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
