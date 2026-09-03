---
description: "Analyze review findings, draft author-side responses, and make requested evidence-backed revisions."
---

# dove.rebuttal

Analyze review findings, draft author-side responses, and make requested evidence-backed revisions.

## Examples

- `/dove:rebuttal`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Analyze review findings, draft author-side responses, and make requested evidence-backed revisions.

### When it helps

Use when the user requests rebuttal, response, revision, or follow-up work from review findings.

### What Dove will examine

- Return with what was inspected, what changed, what remains unresolved, and the next useful action.
- Analyze each material finding against actual evidence, decide whether to accept, rebut, qualify, or investigate it, and revise artifacts when that is the useful response.
- Name the deficiency, needed evidence, research action, and manuscript or rebuttal response for each material finding.
- Compare original claim, reviewer interpretation, planned response, and revised claim so certainty, causality, scope, quantitative qualifiers, novelty, and contribution do not change silently.
- Use Source for new citations and Experiment for new results; leave unchecked source content, project facts, methods, results, and field facts unconfirmed.
- When fixable deficiencies are in scope, improve evidence, analysis, manuscript text, figures, captions, tables, supplements, highlights, or venue-facing files—not just response tone.

### Scope and changes

- Rebuttal may modify ordinary project artifacts and research documents when requested or when revisions are the in-scope response; outward-facing submission or destructive action still requires explicit authorization.
- Maintain Dove research Markdown only when the user explicitly asks to record, update, or save Dove research context, the result clearly changes the research mainline, conclusion, decision, or priority, or preserving the work's evidence and continuation context is genuinely useful.

### Ways Dove may proceed

- When existing Dove research context would materially help the relevant returned review, read `.dove/research/RESEARCH.md`, then `.dove/research/reviews/REVIEWS.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally.
- When existing Lessons could inspire current or subsequent work, improve judgment, expand the candidate space, or prevent repeated mistakes, read ".dove/research/lessons/LESSONS.md" if it exists, then the directly relevant or plausibly useful linked Lessons. Read ".dove/research/RESEARCH.md" first only when project context is still needed and it has not already been read in the active context. Reuse Lessons already read in the active context instead of rereading them mechanically. If Lessons materials are absent, work without them. Treat Lessons as fallible guidance, never as evidence.
- Read the Review document, same review id and round when available, and actual artifacts. For each material finding, identify the source, experiment, method, analysis, expression, figure, or venue-fit problem; then draft the response and make requested revisions that resolve, reduce, or honestly bound it while preserving accurate claim strength and professional author voice. Ordinary author-side revisions do not trigger a full re-review unless the user asks or the submission-readiness decision needs a fresh `dove review rerun`.
- Check that each response and requested revision addresses a real finding; fix in-scope issues or report remaining material limits and user choices.
- When worth preserving, append the author response, requested revisions, resulting decisions, unresolved issues, and follow-up to the same Review document or directly affected research document, and, when useful for recovery, link the originating Review return plus any newly used Source, Experiment, Figure, or ordinary artifact paths. Use ordinary Markdown links and readable project-relative artifact paths only when useful for recovery; do not add databases, generated IDs, frontmatter, backlink audits, or consistency matrices. Update only the narrowest relevant research document. Update `.dove/research/reviews/REVIEWS.md` only when its own links or synthesis materially change. Update `.dove/research/RESEARCH.md` only for a project-level mainline, conclusion, navigation, or priority change.

### What this should not replace

- Do not let reviewer findings replace Dove's author-side judgment.
- Preserve only actual reviewer returns; do not overwrite original returns with author summaries.

### When Dove needs input

- Ask only when ambiguity in intent, target artifact, evaluation criteria, scope, or a key tradeoff would change the next useful action. If active research context implies a feasible follow-up, do that next step rather than merely suggesting it.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.
