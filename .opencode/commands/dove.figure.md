---
description: "Turn one user-described figure intent into materials, optional generation/import, caption support, checks, and a clear answer about whether this figure is usable now."
---

# dove.figure

Turn one user-described figure intent into materials, optional generation/import, caption support, checks, and a clear answer about whether this figure is usable now.

## Daily use

- Use this when the user describes the figure they want once, including where it should help the paper or task.
- Dove should gather linked materials, prepare generation or import, draft caption support, check only the current figure for the compact verdict, and say whether this figure is usable now.
- By default, prepare a hand-drawn SVG plan and tell the operator when SVG output is needed.
- Use OpenAI image generation only for an explicit drawing request with OPENAI_API_KEY supplied through the environment.
- Targeting: Resolve the figure request to one task before writing; do not make the user reason about paths or workspace-wide extra details unless they explicitly ask for details.
- Confirmation: Ask for task confirmation when the figure target is unclear; external drawing calls require explicit safe configuration.
- Outcome: The operator gets a clear current-figure result: ready for review, missing materials, awaiting SVG or drawing output, or needing current-figure fixes.

## Examples

- `/dove.figure Draw a workflow diagram for the mission-auto-status loop`
- `/dove.figure Prepare the main results figure and caption support`

## Operating rules

1. For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check below; do not construct default answers by manually reading or listing internal files.
2. If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.
3. If an explicitly listed project check fails, report that message in ordinary language and stop; do not recover by manually reading internal files.
4. This request has one listed project check: `node ./bin/dove.mjs figure . --intent "<figure request>"` from the project root; summarize its practical result instead of inspecting internal files directly.
5. For figure requests, use the CLI result as the source of truth, say the practical figure state in ordinary language, and do not apply returned file changes unless the operator explicitly approves. If the CLI says a task must be selected and the operator confirms one, rerun `node ./bin/dove.mjs figure . --target "<confirmed task title>" --intent "<figure request>"` instead of putting the task title inside the intent.
6. Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.
7. Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.
8. When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.
9. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
10. When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.
11. Only make the specific change requested for this command; do not bundle unrelated work.
12. Treat the user request as one figure intent and answer whether this figure is ready, waiting for SVG output, missing materials, missing drawing configuration, or needs current-figure fixes.
13. Use the hand-drawn SVG plan as the normal default path and tell the operator when SVG output is needed.
14. Use OpenAI image generation only when explicitly selected or configured; the OpenAI key must come from the OPENAI_API_KEY environment variable, never inline text.
15. Resolve the target task before updating figure state, then gather linked sections, claims, experiments, sources, notes, review concerns, and material hints automatically.
16. Do not mark a figure ready until imported output has source support, caption, and a clean current-figure check.
17. Captions must explain the figure purpose and linked evidence; default replies should not make the operator reason about paths or workspace-wide extra details.
18. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
19. Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.
20. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
