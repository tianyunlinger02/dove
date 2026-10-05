---
description: "Review a specified paper in a clean read-only context, or inspect author self-check, delivery or returned opinions."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.review

Review a specified paper in a clean read-only context, or inspect author self-check, delivery or returned opinions.

## Request

$ARGUMENTS

## Examples

- `/dove:review`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template. Quality grades judge substantive merit within scope; evidence confidence and completed work are separate, not stages that automatically promote quality.

### What this is for

Assess a paper, local artifact, delivery readiness or an existing reviewer return.

### When to use

Use for paper judgment or review context, not mentor-led round decisions.

### What Dove will examine

- Author-side self-check critiques the current paper with concrete evidence and feasible action; it is not independent review.
- Delivery review checks actual venue rules, build/export output and required materials; delivery readiness is separate from scientific acceptability.

### Scope and changes

- Findings are reasoned objections, not empirical evidence or automatic acceptance. Assess cited grounds and address material concerns through author-side work; self-check does not certify independent review.
- Use an exposed equivalent clean read-only context on other hosts; if unavailable, report the limitation. Do not add hashes, frozen gates, persistent reviewer sessions or approval steps.

### Ways Dove may proceed

- For the complete paper, ask four questions: does the method answer the research question; are the mechanisms, terms, comparisons, literature, counterexamples, and limits correct for the field; do the contribution, evidence, scope, and expression fit the target venue and its readers; and what is the strongest reasonable objection, with the evidence or revision needed to answer it.
- For independent review, call dove-review in a clean read-only context with the current manuscript, its cited results and relevant inspected venue/literature material. It reads only specified files with Read/Grep/Glob, not the author's execution conversation; no frozen snapshot or review CLI is needed. Whole-paper review reads the full current version; local review stays local.
- Request a concise Markdown judgment, blocking issues, cited evidence and author-side next actions, listing the files actually read. Missing grounding limits the judgment. After substantive changes, request a fresh full-version review; an old recommendation remains historical.
- Keep actual reviewer returns faithful, with known venue and materials; distinguish user-pasted opinions from independent work actually performed. Preserve useful returns in the current round result or ordinary project files, not a runtime exchange store. Inspection or preservation alone does not start revision or another review.

### When Dove needs input

- Ask when unresolved ambiguity in the goal, artifact, evaluation, scope or key tradeoff would materially change the next action; otherwise use reasonable in-scope defaults.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.

### Return with

- The author main session applies scoped results to actual work and downstream use within the user's goal and latest corrections. A bounded subagent returns evidence without taking over the goal; subtask completion is not goal completion.
