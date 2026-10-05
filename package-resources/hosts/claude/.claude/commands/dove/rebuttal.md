---
description: "Use when review findings require current evidence, possible reruns, author response, or evidence-backed revision."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.rebuttal

Use when review findings require current evidence, possible reruns, author response, or evidence-backed revision.

## Request

$ARGUMENTS

## Examples

- `/dove:rebuttal`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template. Quality grades judge substantive merit within scope; evidence confidence and completed work are separate, not stages that automatically promote quality.

### What this is for

Analyze review findings, draft author-side responses, and make requested evidence-backed revisions.

### When to use

Use when the user requests rebuttal, response, revision, or follow-up work from review findings.

### What Dove will examine

- Group findings with the same root cause, locate definition, mechanism, evidence, or expression gaps, and verify them against actual evidence rather than automatically accepting or acting on them. Prioritize follow-through by material consequence. Decide whether to accept, rebut, qualify, or investigate, naming the needed evidence, research action, and manuscript or rebuttal response while preserving coverage of each material finding.
- Finding understood, response path grounded, needed revisions implemented, and effect checked are processing facts, not resolution grades. Judge whether the underlying concern is resolved, reduced, or still limiting, and whether the response improves the whole argument without new scientific defects. Compare local repair, shared-cause redesign, alternative routes, or further evidence when appropriate rather than defaulting to the smallest reply. A written response does not establish that the issue is resolved, and author self-check does not mean reviewer acceptance.
- Compare original claim, reviewer interpretation, planned response, and revised claim so certainty, causality, scope, quantitative qualifiers, novelty, contribution, problem, output, baseline, real goal, proxy, and success meaning do not change silently. Reviewer objections can reveal a better task, but they do not automatically authorize a succession of easier tasks; preserve the original proposition's disposition and independently judge any materially different candidate before mainline promotion.
- Use Source for new citations and Experiment for new results; leave unchecked source content, project facts, methods, results, and field facts unconfirmed.
- When fixable deficiencies are in scope, improve evidence, analysis, manuscript text, figures, captions, tables, supplements, highlights, or venue-facing files—not just response tone. Treat a review as current only for the same complete manuscript and listed materials; after substantive evidence, claim, method, figure, or venue-facing changes, decide whether a fresh read-only paper review is needed before relying on the old recommendation.

### Scope and changes

- Rebuttal may modify ordinary project artifacts and research documents when requested or when revisions are the in-scope response; outward-facing submission or destructive action still requires explicit authorization.
- Maintain Dove research Markdown other than Lessons only when the user explicitly asks to record, update, or save Dove research context, a result changes a conclusion, route decision, or priority within the confirmed goal, or preserving evidence and continuation context is genuinely useful.

### Ways Dove may proceed

- When existing Dove research context would materially help the relevant returned review, check the short identity card when present, then `.dove/research/reviews/REVIEWS.md` and directly relevant linked details. Use `.dove/research/RESEARCH.md` only if its short navigation is needed. Otherwise work directly from the user's request and specified materials; avoid broad research-tree scans.
- Before the first consequential choice for the current request, or after a user correction or recurring repair or failure exposes a possibly shared mistaken premise, read ".dove/research/lessons/LESSONS.md" once if it exists unless it has already been checked for this question in the active context, then only directly relevant or plausibly decision-changing linked Lessons. Reuse still-applicable Lessons instead of rereading them mechanically. Read ".dove/research/RESEARCH.md" separately only when project context is still needed; it is not a prerequisite for Lessons. If Lessons materials are absent, continue without creating them. Treat Lessons as fallible guidance, never as evidence. Ordinary deterministic local work has no Lessons prerequisite.
- Read the Review document, same review id and round when available, the reviewed material list, current material state, and actual artifacts. For each material finding, identify the source, experiment, method, analysis, expression, figure, venue-fit, or scientific-task identity problem. For new citations, verify identity and inspected-content support through Source; for new results, inspect actual Experiment materials before using them in the response. Then draft the response and make requested revisions that resolve, reduce, or honestly bound it while preserving accurate claim strength and professional author voice. Do not chase acceptance through cosmetic-only changes, selective evidence, hidden counterevidence, unjustified narrowing, or a sequence of unacknowledged task changes. If the warranted response materially changes the confirmed mainline, intended contribution, or completion meaning, preserve the old proposition's conclusion, independently assess the candidate, and obtain the user's decision before adopting it. Do not rerun review for cosmetic or response-only edits; use read-only paper review when substantive evidence, claim scope, method, figure, result interpretation, venue-facing materials, or completion judgment changed enough that the old recommendation no longer covers the current full version.
- Check that each response and requested revision addresses a real finding. For manuscript work, preserve the user's current authoritative manuscript format, identify its source and build or export path, and follow actual venue requirements. Only for a new manuscript, default to LaTeX when the venue accepts it; otherwise use the required format. Inspect the actual submission output, including compiled output for LaTeX, keep scholarly evidence distinct from venue-facing materials, and propagate authorized changes through the authoritative source. Propagate requested revisions through the real build or export path and inspect the output before claiming the revised artifact is current; fix in-scope issues or report remaining material limits and user choices.
- When worth preserving, append the author response, requested revisions, resulting decisions, unresolved issues, and follow-up to the same Review document or directly affected research document, and, when useful for recovery, link the originating Review return plus any newly used Source, Experiment, Figure, or ordinary artifact paths. Use ordinary Markdown links and readable artifact paths, not a structured store. Keep new core records in the identity card, EVAL and rounds; preserve useful source material, reviewer returns and Lessons under their own existing scope. Update `.dove/research/reviews/REVIEWS.md` only when its links or synthesis change, and RESEARCH.md only as a short history index.

### What this should not replace

- Do not let reviewer findings replace Dove's author-side judgment.
- Preserve only actual reviewer returns; do not overwrite original returns with author summaries.

### When Dove needs input

- Ask when unresolved ambiguity in the goal, artifact, evaluation, scope or key tradeoff would materially change the next action; otherwise use reasonable in-scope defaults.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.

### Return with

- The author main session applies scoped results to actual work and downstream use within the user's goal and latest corrections. A bounded subagent returns evidence without taking over the goal; subtask completion is not goal completion.
