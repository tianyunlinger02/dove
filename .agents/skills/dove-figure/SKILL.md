---
name: dove-figure
description: "Turn one user-described figure intent into materials, optional generation/import, caption provenance, checks, and a clear answer about whether this figure is usable now."
---

# Dove Figure

Turn one user-described figure intent into materials, optional generation/import, caption provenance, checks, and a clear answer about whether this figure is usable now.

## Daily use

- Use this when the user describes the figure they want once, including where it should help the paper or task.
- Dove should gather linked materials, prepare generation/import, write caption provenance, validate only the current figure for the compact verdict, and return a resultCard that says whether this figure is ready now.
- By default, prepare a hand-drawn SVG plan and tell the operator when SVG output is needed.
- Use the built-in OpenAI image provider only for explicit foreground image generation with OPENAI_API_KEY supplied through the environment.
- Default figure replies should translate drawing-service state and review records into the current figure's practical state: ready, waiting for an SVG, missing material, provider configuration needed, or current-figure review issues.
- Targeting: Resolve the figure request to one task before any figure write; do not make the user reason about path fields, check files, or workspace-wide diagnostics unless they explicitly ask for full/debug detail.
- Confirmation: Ask for task confirmation when the figure target is unclear; provider calls require explicit safe configuration, while plan-only figure preparation stays inside the same confirmed workflow call.
- Outcome: The operator gets a clear current-figure result: ready for review, missing materials, awaiting SVG/provider output, or current-figure review issues; detailed paths and diagnostics stay in full/debug data.

## Examples

- `/dove:figure Draw a workflow diagram for the mission-auto-status loop`
- `/dove:figure Prepare the main results figure and caption provenance`

## Operating rules

1. For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.
2. If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.
3. If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.
4. When a local Dove CLI is available, run `node ./bin/dove.mjs figure . --intent "<figure request>"` from the project root before answering; summarize its compact output instead of inspecting saved records directly.
5. For figure requests, use the CLI result as the source of truth, say the practical figure state in ordinary language, and do not apply returned file changes unless the operator explicitly approves. If the CLI says a task must be selected and the operator confirms one, rerun `node ./bin/dove.mjs figure . --target "<confirmed task title>" --intent "<figure request>"` instead of putting the task title inside the intent.
6. Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.
7. Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.
8. Only perform the governed change owned by this surface, scoped to the operator request.
9. Treat the user request as one figure intent and answer whether this figure is ready, waiting for SVG output, missing materials, missing provider configuration, or needs current-figure fixes.
10. Use the hand-drawn SVG plan as the normal default path and tell the operator when SVG output is needed.
11. Use the built-in OpenAI image provider only when explicitly selected or configured; the OpenAI key must come from the OPENAI_API_KEY environment variable, never inline text.
12. Resolve the target task before writing figure records, then gather linked sections, claims, experiments, sources, notes, review concerns, and material hints automatically.
13. Do not mark a figure ready until an imported generation has provenance, caption, and a clean current-figure check.
14. Captions must explain the figure purpose and linked evidence; default replies should not make the operator reason about source/target paths or workspace-wide diagnostics.
15. Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended.
16. Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.
17. Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.
