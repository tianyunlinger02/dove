---
description: "Independently review the specified current paper or inspect local artifacts, delivery readiness and returned opinions."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.review

Independently review the specified current paper or inspect local artifacts, delivery readiness and returned opinions.

## Request

$ARGUMENTS

## Examples

- `/dove:review`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Assess the scientific quality of a paper, a local artifact, delivery readiness or an existing reviewer return.

### When to use

Use for paper judgment and review inspection rather than mentor direction decisions.

### What Dove will examine

- Author-side self-check critiques the current paper with concrete evidence and feasible action; it is not independent review.
- Delivery review checks actual venue rules, build/export output and required materials; delivery readiness is separate from scientific acceptability.

### Scope and changes

- Review findings are reasoned objections, not empirical evidence or automatic acceptance. The author assesses their grounds and addresses material concerns; author self-check cannot certify independent review.

### Ways Dove may proceed

- For the complete paper, ask four questions: does the method answer the research question; are the mechanisms, terms, comparisons, literature, counterexamples, and limits correct for the field; do the contribution, evidence, scope, and expression fit the target venue and its readers; and what is the strongest reasonable objection, with the evidence or revision needed to answer it.
- For independent review, call dove-review in a fresh read-only context with the current manuscript, cited results and relevant inspected venue or literature material. It uses Read/Grep/Glob on specified files, not the author's execution conversation. Use an equivalent clean context on other hosts and report the limitation if none is available; no frozen snapshot, review CLI or persistent reviewer session is needed.
- Request a concise judgment with blocking issues, cited evidence, author-side actions and the files actually read. Missing grounding limits the judgment. Whole-paper review reads the complete current version, while local review stays local; after substantive changes, obtain a fresh full-version review before treating a previous recommendation as current.
- Preserve actual reviewer returns faithfully and distinguish user-pasted opinions from independent work performed. Store useful returns as ordinary project material, not a runtime exchange store. Reading or preserving a return does not itself authorize revisions or another review.

### Using host tools

- Use tools and materials exposed by the current host and permitted by the user and project. If something is unavailable, name the gap and continue with useful permitted alternatives.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
