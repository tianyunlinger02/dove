---
description: "Use author-side self-check, delivery review, `dove-review`, returned-review import, or context inspection."
---

# dove.review

Use author-side self-check, delivery review, `dove-review`, returned-review import, or context inspection.

## Examples

- `/dove:review`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Use Review for author-side scientific self-check, delivery readiness, independent `dove-review` handoff, returned-review import, or existing context inspection.

### When it helps

Use when review can improve the paper, delivery facts matter, a near-submission paper is ready for `dove-review`, a returned review should be preserved, or existing Review context should be inspected.

### Scope and changes

- Review findings inform Dove's author-side judgment; Dove verifies material findings and chooses the next useful Source, Experiment, Draft, Figure, Rebuttal, delivery, or clarification work.
- Independent `dove-review` requires a real isolated, persistent, recoverable host context with a frozen near-submission material list.

### Return to Dove's research judgment

- Return with what was inspected, what changed, what remains unresolved, and the next useful action.

### Author-side scientific self-check

Author-side scientific self-check critiques the current paper inside Dove's author context and returns concrete evidence, consequence, and feasible research action without claiming independent external review.

- Ground author-side self-check in actually inspected scholarly context and official venue sources when they can change novelty, positioning, evidence norms, experiment coverage, reader expectations, or formal requirements; distinguish found material from material retrieved, inspected, and used.
- For the complete paper, ask four questions: does the method answer the research question; are the mechanisms, terms, comparisons, literature, counterexamples, and limits correct for the field; do the contribution, evidence, scope, and expression fit the target venue and its readers; and what is the strongest informed objection, with what would answer it. Also check citation identity, claim support, changes in claim strength, unsupported facts, and anomalous results when relevant.
- For author-side self-check, inspect the current full paper and the venue or literature context that can change the judgment. Distinguish material merely found from material retrieved, inspected, and used. Import or context inspection does not trigger venue or paper search by itself.
- Critique the current paper from the established grounding through the stated review views. For local review, stay inside the requested scope. Return concrete findings with evidence, consequence, useful response, and delivery readiness kept separate.
- Author-side self-check critiques and advises; later changes remain Dove author-side work.

### Delivery readiness

Conditional delivery review checks official venue rules, build output, required materials, formatting, anonymity, packaging, and access limits, while keeping delivery readiness separate from scientific acceptability.

- When delivery review is requested or genuinely limiting, inspect official venue requirements, current build output, required materials, formatting, anonymity, packaging, and access limits. Report delivery readiness separately from scientific acceptability.
- Delivery readiness is separate from scientific acceptability.

### Independent `dove-review`

Submission completion needs author-side scientific sufficiency, a current `dove-review` scientific-acceptability recommendation for the same full version, and real delivery readiness.

- Independent `dove-review` requires a genuinely isolated, persistent, recoverable reviewer context; if the host cannot provide it, say so and continue other feasible author-side work without counting it as independent review.
- When `dove-review` raises objections, Treat Review findings as scientific evidence to analyze: diagnose the underlying deficiency, then act, rebut with inspected evidence, honestly bound on a real limit, or defer only because another mainline action is more material. After substantive change, return to the same isolated reviewer context and review the complete paper again.
- Author-side and `dove-review` judgments apply only to the current complete manuscript and submitted materials; after substantive changes, earlier recommendations are historical evidence.
- Preserve an actual reviewer return faithfully together with the known reviewer context, review round, target venue, and materials reviewed; mark user-pasted or unverifiable returns as such.
- Start `dove-review` only for a highly complete near-submission paper. Preserve the purpose, target venue, complete frozen material list, reviewer prompt, known host limits, and real runtime paths in the Review context and `.dove/reviews/<id>/review.json`. Give the reviewer only those listed materials. Use the real runtime when the host provides a genuinely isolated, persistent, recoverable reviewer context; resume or rerun later whole-paper rounds through the recorded reviewer session for the same review id. Record only the actual session id and report path returned by the runtime. If the runtime is unavailable, say so and continue feasible author-side work without counting it as independent review.
- For each `dove-review` round, provide only the frozen near-submission materials listed for that round: normally the complete paper, actual submission appendices or supplements, authoritative LaTeX source and compiled output, and other files that will accompany the submission. Code, raw experiment outputs, working figure materials, internal research notes, private author conversations, earlier reviews, and earlier handoffs remain outside the reviewer context unless the current list explicitly includes them.
- Do not claim independent `dove-review` or external acceptance unless a real isolated persistent reviewer context judged the current frozen handoff.

### Returned review or existing context

Import a returned review, preserve a user-pasted opinion, or inspect existing Review context without creating a new exchange.

- For import, preserve the actual return faithfully with known context, round, venue, and material scope; for inspection, read only the Review context needed for the question.
- When the user supplies a `dove-review` return, user-pasted review opinion, clarification, rebuttal exchange, or asks to preserve self-check or handoff context, append the actual text faithfully to the corresponding Review document and associate it with the same review id and round when known. When useful for recovery, link the real `.dove/reviews/<id>/rounds/<round>/report.md` return, frozen materials, and affected Claim, Experiment, Figure, Source, or manuscript locations. Do not revise author artifacts, start a new review, rewrite the return, or add author interpretation unless asked. Use ordinary Markdown links and readable project-relative artifact paths only when useful for recovery; do not add databases, generated IDs, frontmatter, backlink audits, or consistency matrices. Update only the narrowest relevant research document. Update `.dove/research/reviews/REVIEWS.md` only when its own links or synthesis materially change. Update `.dove/research/RESEARCH.md` only for a project-level mainline, conclusion, navigation, or priority change.
- When existing Dove research context would materially help the review work, read `.dove/research/RESEARCH.md`, then `.dove/research/reviews/REVIEWS.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally.
- Import and inspection do not automatically begin author response, revision, venue search, paper search, or a new handoff.

### When Dove needs input

- Ask only when ambiguity in intent, target artifact, evaluation criteria, scope, or a key tradeoff would change the next useful action. If active research context implies a feasible follow-up, do that next step rather than merely suggesting it.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.
- For `dove-review`, call the real CLI surface: `dove review handoff --project <project> --venue <venue> --material <path>...`, then `dove review resume --project <project> --id <id>` or `dove review rerun --project <project> --id <id> --material <path>...` for the same review id and reviewer session. Import user-provided returns with `dove review import --project <project> --id <id> --file <report.md>`. The runtime copies only listed materials into its isolated workspace, gives Claude Code only Read, and records the actual `session_id`.
