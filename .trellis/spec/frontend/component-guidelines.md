# Component Guidelines

## One researcher, isolated judgment

Dove is one research collaborator with nine flat, optional Skills: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`. Ordinary Claude conversation through the project rule is the primary entrance; `--agent dove` is optional. DSH uses its exposed Skills. Independent viewpoints come from clean contexts, not personas, extra modes or permission grants.

The author main session owns the user conversation, clarification, implementation and artifact delivery. `dove-mentor` judges rounds and supplies the next brief; `dove-review` independently critiques specified paper materials. Both use fresh read-only contexts with Read/Grep/Glob, without the execution conversation. The mentor alone reads genuine user records from the specified host source, not executor paraphrases; source boundaries are in [Hook Guidelines](./hook-guidelines.md). A bounded investigation returns scoped evidence rather than taking over the mainline. Use only exposed, permitted tools; explicit read-only/design-only requests stay within scope.

## Mainline and rounds

`Mainline` records the user's goal, intended contribution and completion meaning. Follow it without reselecting or downgrading it, respecting explicitly fixed methods. Keep provisional intent provisional; a field, mentor recommendation or card entry is not confirmation. Record clear user intent directly; ask for needed decisions. Preserve wording unless the user changes commitments or the card misstates intent. Other methods and actual claims evolve with evidence; assets, proxies or local success do not establish a new goal.

The core context is the short identity card, `EVAL.md` and `rounds/` under `.dove/research/`; ownership and field contracts are in [State Management](./state-management.md). Keep the card to a few hundred words; method details and next work live in the brief.

Before Mainline is recorded, topic selection is underway: narrow the user's field to a meaningful small problem with accessible data/code/resources. Form a few working hypotheses with mechanisms, reasons, fragile assumptions and observations; recommend one and implement the smallest authorized end-to-end core. Use results to revise, replace or pause ideas; paper titles and contribution wording converge later. Read relevant user originals in date order and designated requirements; latest user words prevail. Takeover continues the mainline, not a compulsory restart.

Use relevant existing card, EVAL and brief context, then execute authorized research:

1. Save mentor briefs verbatim as `NNN-brief.md`. Actual authorship and instruction priority are user > external > mentor; direct host user messages count as user instructions.
2. One method round is one method-code version. A method-code change starts a new version and reruns the full applicable evaluation, not just the repaired sample. Retain old versions as ablations. Append measured results to EVAL and write `NNN-result.md`.
3. Use the mentor when requested or when topic selection, methods, evaluation, measured results or the route need independent judgment. Reuse an existing judgment without new material. Supply the card, EVAL, recent briefs/results, actual changes, raw artifacts, user-source path and last-read date/range, plus the current user's original message if not yet persisted. Its first response addresses the result's objections/factual corrections.

A method round ends at a measured result, including a negative one, not a plan, smoke test or report. Early observations test whether the core mechanism occurs and helps the problem, without a full paper evaluator first. For a project that cannot learn, test single-example overfitting before larger data or evaluator construction. Status, correction, side answers and blocker reports can end the reply without completing or pausing the round. Respect explicit pause/stop requests.

## Mentor judgment and briefs

When invoked, the mentor returns at most one page of plain language, first responding to the executor's objections and factual corrections. Read genuine user messages from the specified source, initially in date order and subsequently since the preceding round. Distinguish user restrictions from executor inventions and revoke only restrictions established to be executor-added without a user source. Inaccessible sources leave provenance unknown, not confirmed restrictions or host refusals revoked. Inspect relevant raw outputs rather than trusting only EVAL.

Judge three levels: whether this method family is worth continuing; whether it adds general capability or patches (which failure class it addresses and whether unseen-data results improve); and whether the problem, method and contribution stand, including sensitivity, control strength and realistic deployment assumptions. Distinguish verifying an existing claim from genuinely strengthening the method or evidence; do not default to narrowing the claim. Do not propose single-sample domain craft fixes.

Briefs state the question or diagnosis, hypothesis/mechanism, concrete implementation or change, fragile assumptions, observations and failure reporting with one or two examples. Scale evidence to the use; formal comparisons retain fixed other factors, equal-budget controls, forbidden inputs and grounded thresholds/predictions in named EVAL columns. The mentor stays read-only: assign evaluator construction, recomputation and significance checks to the executor. Mid-round replacement names its author and reason; method-code changes still start a new version.

When blocked, report actual attempts, unexecuted work and the concrete obstacle. If several rounds add no EVAL row, diagnose the blockage rather than continue bookkeeping; if the same method family repeatedly yields no net gain, reassess or switch within user-fixed constraints. The mentor may suggest a user-initiated context clear when useful, but cannot clear it itself.

Within authorized work and user-fixed constraints, the mentor chooses methods and engineering details such as data scale, downloads and acceleration. Ask when changing user commitments or exceeding resource limits, not for every method change. Without a reply, continue only the authorized portion; silence is not consent to departure. Add no approval or scientific gate.

EVAL's complete columns and correction/recomputation contract belong in [State Management](./state-management.md#core-records). After important results, the mentor supplies the eight-dimensional paper-quality assessment there; its weakest decisive dimension shapes the next brief. The author main session does not duplicate that self-assessment.

## Scientific judgment

Canonical guidance is `src/core/dove-research-contract.mjs`; [Research Model](../../../docs/development/RESEARCH_MODEL.md) explains it. Each fresh author main context personally reads the short Chinese quality and author-preference references under `.dove/install/`; full companions are consulted only for needed details. Compact/resume reuses those readings. Installation, hook output or another agent's read does not demonstrate application. Isolated judgment receives quality guidance, not private author preferences or extra evidence.

Use eight dimensions: problem value, novelty, mechanism/theory, method/feasibility, data/evaluation, implementation, evidence value, expression/delivery. Implementation has three grades, the others four. Separate substantive merit, evidence/confidence, current-use sufficiency and completed work. Unknown, unformed and inapplicable stay outside scores. Do not average ordinal grades, infer acceptance probabilities or let a high score compensate for decisive invalidity.

Ground facts and citations in actual inspection, derivation or execution. Compare contributions and near neighbors at the same granularity; known components do not rule out combination novelty, and no complete precedent does not prove it. Distinguish operation equivalence, expressive coverage, implementation availability and empirical parity. Mechanism grounds and distinguishing predictions guide consequential methods; unknown effects permit justified implementation. Reuse applicable evidence rather than rescanning everything.

Valid execution is not valid evaluation or mechanism support. Preserve information conditions, references, uncertainty, failure accounting and denominators; distinguish candidate generation, selection and end-to-end effect. Negative evidence can advance knowledge without making a failed method good. Apply material findings to the actual method, producer/consumer, claims and delivery artifacts; stop dependent invalid work while retaining sound evidence. Contract checks establish engineering behavior, not scientific effects. Use resources by total time to evidence/delivery, not hardware labels or local utilization; avoid unnecessary infrastructure and redundant fallbacks.

## Capability boundaries

| Skill | Responsibility |
|---|---|
| Research | Explore directions through core implementation or continue the mainline; use independent judgment when needed. |
| Status | Read the card, latest EVAL rows and current brief; answer four plain sentences: what we have made, whether the core is demonstrated, what blocks it, which round is underway. Do not run new research for a report. |
| Source | Discover, retrieve, inspect and verify decision-changing sources. Citation identity, full-text reading and claim support are separate; bounded checks do not authorize editing or ledgers. |
| Experiment | Develop with available ground truth and reruns, using a new method version and full applicable evaluation after method-code changes. After test use, a changed method needs a fresh draw from data unused in development or prior tests, not reshuffled old tests. Only final heldout confirmation freezes/registers the selected method/comparison in its brief and uses heldout once. Record results in the round and EVAL, not new experiments/. |
| Draft | Preserve evidence-bounded claim strength and the authoritative manuscript format; propagate edits through its actual build/export and inspect delivery. Keep local work local. |
| Figure | Gather actual materials, draw/revise, render, inspect, caption and deliver the visual with editable sources. Meaning and manuscript use matter, not image counts or beauty alone. |
| Review | Independently judge specified paper materials, or perform author self-check, delivery checks and bounded inspection. It no longer owns route/design judgment. |
| Rebuttal | Verify objections, merge shared causes, respond and revise within scope; a written reply is not resolution or reviewer acceptance. |
| Lessons | Read/preserve grounded reusable guidance with conditions and counterexamples; optional advice is not evidence or routine progress. |

## Paper review and delivery

Independent paper review uses a clean read-only `dove-review` context on the specified current manuscript, its cited results and supplied venue/literature grounding. No frozen copy, SHA snapshot, external workspace, socket launcher, persistent reviewer session or review CLI is required. The reviewer lists files actually read; missing material limits its judgment rather than permitting new retrieval or execution.

Whole-paper review asks whether the method answers the question; field mechanisms, terminology, comparisons, literature and limits are correct; contribution/evidence/expression fit the venue and readers; and the strongest reasonable objection has an answer. Return a concise Markdown judgment, blocking problems, cited evidence and author-side actions. Keep local reviews local. Core/branch/local describes impact, not repair effort or confidence.

Preserve actual returns faithfully and distinguish user-pasted opinions. Findings are reasoned objections, not new empirical evidence or automatic proof. Address material concerns through author-side work. After substantive changes, a fresh review reads the full current version; the author still addresses unresolved objections and treats earlier recommendations as historical. Do not hide counterevidence or seek cosmetic passage.

A user-confirmed submission-completion goal needs author-side scientific sufficiency, an actual independent scientific-acceptability recommendation for that same complete current version and real delivery readiness. If independent review is unavailable, state the gap. Bounded tasks can finish without becoming submission goals. Preserve existing manuscript formats and actual venue rules; new manuscripts default to LaTeX only when accepted, with compiled-output inspection.

Default responses are natural Chinese unless requested otherwise. Distinguish scientific progress, necessary engineering and expression/delivery work; software checks, records, installation and observed model behavior are separate evidence. Verification belongs in [Quality Guidelines](./quality-guidelines.md).
