---
description: "Use for whole-paper author self-check, delivery review, isolated `dove-review`, returned-review import, or bounded local review."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.review

Use for whole-paper author self-check, delivery review, isolated `dove-review`, returned-review import, or bounded local review.

## Request

$ARGUMENTS

## Examples

- `/dove:review`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template. Named levels describe the relevant object's scope and evidence, not mandatory stages to complete.

### What this is for

Use Review for author-side scientific self-check, delivery readiness, independent `dove-review` handoff, returned-review import, or existing context inspection.

### When to use

Use when review can improve the paper, delivery facts matter, a near-submission paper is ready for `dove-review`, a returned review should be preserved, or existing Review context should be inspected.

### Scope and changes

- Review findings inform Dove's author-side judgment; Dove verifies material findings and chooses the next useful Source, Experiment, Draft, Figure, Rebuttal, delivery, or clarification work.
- Independent `dove-review` requires a real isolated, persistent, recoverable host context with a frozen near-submission material list.

### Author-side scientific self-check

Author-side scientific self-check critiques the current paper inside Dove's author context and returns concrete evidence, consequence, and feasible research action without claiming independent external review.

- For whole-paper author-side self-check or `dove-review` handoff preparation, inspect the current full paper and the venue or literature context that can change the judgment. Use current official venue sources for formal requirements and inspected relevant published work for novelty, positioning, evidence norms, experiment presentation, and reader expectations; published practice does not replace official rules. Distinguish material merely found from material retrieved, inspected, and used. Import, context inspection, or bounded local review does not trigger venue or paper search by itself.
- For the complete paper, ask four questions: does the method answer the research question; are the mechanisms, terms, comparisons, literature, counterexamples, and limits correct for the field; do the contribution, evidence, scope, and expression fit the target venue and its readers; and what is the strongest reasonable objection, with the evidence or revision needed to answer it. Also check citation identity, claim support, changes in claim strength, unsupported facts, and anomalous results when relevant. For local paragraph, figure, citation, or method review, stay inside the requested scope and do not force the full-paper four questions or start an independent handoff. Return concrete findings with evidence, consequence, useful response, and delivery readiness kept separate. Classify impact as ‘核心问题’ (constrains the core goal), ‘分支问题’ (constrains affected dependent work), or ‘局部问题’ (local quality); state evidence sufficiency separately rather than equating missing evidence with refutation or repair effort with severity.
- Author-side self-check critiques and advises; later changes remain Dove author-side work.

### Delivery readiness

Conditional delivery review checks official venue rules, build output, required materials, formatting, anonymity, packaging, and access limits, while keeping delivery readiness separate from scientific acceptability.

- When delivery review is requested or genuinely limiting, inspect the actual venue-facing package against those requirements and report remaining delivery gaps.

### Independent `dove-review`

For a user-confirmed submission-completion goal, completion needs author-side scientific sufficiency, a current independent `dove-review` scientific-acceptability recommendation for the same full version, and real delivery readiness. Unavailable isolated review leaves that requirement unmet, not waived. A bounded local review, edit, figure, or other task can finish without becoming a submission-completion goal.

- Independent `dove-review` requires a genuinely isolated, persistent, recoverable reviewer context; if the host cannot provide it, say so and continue other feasible author-side work without counting it as independent review.
- Each isolated runtime round reviews the whole current frozen paper, not only a diff, with the same four full-paper questions above. The reviewer returns Markdown under Verdict, Blocking issues, Grounding basis, and Author-side next actions.
- When `dove-review` raises objections, Treat Review findings as scientific evidence to analyze: diagnose the underlying deficiency, then act, rebut with inspected evidence, honestly bound on a real limit, or defer only because another mainline action is more material. After substantive change, return to the same isolated reviewer context and review the complete paper again.
- Author-side and `dove-review` judgments apply only to the current complete manuscript and submitted materials; after substantive changes, earlier recommendations are historical evidence.
- Preserve an actual reviewer return faithfully together with the known reviewer context, review round, target venue, and materials reviewed; mark user-pasted or unverifiable returns as such.
- Start `dove-review` only from a frozen near-submission handoff: current complete paper, authoritative manuscript source in its existing format and actual submission output, actual appendices or supplements, target venue, and other real venue-facing files. Include the compiled output for LaTeX and any author-retrieved venue or literature grounding needed for frozen-material judgment. Include the grounding inspected above for the intended frozen-material judgment. Preserve the purpose, target venue, complete frozen material list, reviewer prompt, known host limits, and returned report location in the Review context. Give the reviewer only those listed materials, with Read-only access and no web, MCP, private author conversations, or unlisted files. Use an isolated, persistent, recoverable reviewer context when the host provides one; resume or rerun later whole-paper rounds for the same review id and reviewer session. If grounding is missing, the reviewer should limit venue or literature conclusions to the listed materials; if the runtime is unavailable, say so and continue feasible author-side work without counting it as independent review.
- Earlier author-side Reviews, handoffs, code, raw outputs, and working figures are not supplied automatically; a resumed reviewer context retains its own review history. Do not restart it to avoid prior objections.
- Do not claim independent `dove-review` or external acceptance unless a real isolated persistent reviewer context judged the current frozen handoff.

### Returned review or existing context

Import a returned review, preserve a user-pasted opinion, or inspect existing Review context without creating a new exchange.

- For import, preserve the actual return faithfully with known context, round, venue, and material scope; for inspection, read only the Review context needed for the question.
- When the user supplies a `dove-review` return, user-pasted review opinion, clarification, rebuttal exchange, or asks to preserve self-check or handoff context, append the actual text faithfully to the corresponding Review document and associate it with the same review id and round when known. When useful for recovery, link the corresponding `.dove/reviews/` round report, frozen materials, and affected Claim, Experiment, Figure, Source, or manuscript locations. Do not revise author artifacts, start a new review, rewrite the return, or add author interpretation unless asked. Use ordinary Markdown links and readable project-relative artifact paths only when useful for recovery, and keep the note as human prose rather than a structured store. Update only the narrowest relevant research document. Update `.dove/research/reviews/REVIEWS.md` only when its own links or synthesis materially change. Update `.dove/research/RESEARCH.md` only for a project-level mainline, conclusion, navigation, or priority change.
- When existing Dove research context would materially help the review work, read `.dove/research/RESEARCH.md`, then `.dove/research/reviews/REVIEWS.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Avoid broad research-tree scans. If a needed entry or link is absent, say so naturally.
- Import and inspection do not automatically begin author response, revision, venue search, paper search, or a new handoff.

### When Dove needs input

- Ask only when ambiguity in intent, target artifact, evaluation criteria, scope, or a key tradeoff cannot be resolved from available context or reasonable in-scope defaults that leave the core research judgment unchanged and would materially change the next useful action. If active research context implies a feasible follow-up, do that next step rather than merely suggesting it.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.
- For `dove-review`, use `dove review handoff --project <project> --venue <venue> --material <path>...`, then `dove review resume --project <project> --id <id>` or `dove review rerun --project <project> --id <id> --material <path>...` for the same review id and reviewer session. Import user-provided returns with `dove review import --project <project> --id <id> --file <report.md>`. Only listed materials are copied into the isolated reviewer workspace, and Claude Code receives Read only.

### Return with

- Inspected evidence, material change, and unresolved limits; include the next useful action only when it helps the current request.
