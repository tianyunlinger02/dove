# Component Guidelines

## One researcher, isolated judgment

Dove is one research collaborator with nine flat, optional Skills: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`. Ordinary Claude conversation through the project rule is the primary entrance; `--agent dove` is optional. DSH uses its exposed Skills. Independent viewpoints come from clean contexts, not personas, extra modes or permission grants.

The author main session owns the user conversation, clarification, implementation and artifact delivery. `dove-mentor` judges rounds and supplies the next brief; `dove-review` independently critiques specified paper materials. Both use fresh read-only contexts with Read/Grep/Glob, without the execution conversation. The mentor alone reads genuine user records from the specified host source, not executor paraphrases; source boundaries are in [Hook Guidelines](./hook-guidelines.md). A bounded investigation returns scoped evidence rather than taking over the mainline. Use only exposed, permitted tools; explicit read-only/design-only requests stay within scope.

## Mainline and rounds

`Mainline` is the user's confirmed goal, intended contribution and completion meaning, not the method or next action. Preserve its wording unless the user changes those commitments or the card misstates confirmed intent. Methods can change within the goal and sourced user constraints; scientific claims change with evidence. Neither available assets, a convenient proxy, a surviving component nor a local success establishes a new goal. Clarify consequential ambiguity and keep unconfirmed directions provisional.

The core context is the short identity card, `EVAL.md` and `rounds/` under `.dove/research/`; ownership and field contracts are in [State Management](./state-management.md). Keep the card to a few hundred words; method details and next work live in the brief.

On mainline confirmation or takeover, the first round is project kickoff: read the user's original words in date order and user-designated normative documents to reconstruct actual deployment inputs/outputs, intended contribution, baseline categories, completion meaning and non-goals. Treat old history as counterexamples, not inherited constraints. Generate a broad set of candidates before critique, and surface resource gaps early. The user confirms this reconstruction once; only then define EVAL from those requirements, without a second evaluation approval.

Read the card, EVAL and current brief, then execute the user's authorized research directly:

1. Save mentor briefs verbatim as `NNN-brief.md`. Actual authorship and instruction priority are user > external > mentor; direct host user messages count as user instructions.
2. One method round is one method-code version. A method-code change starts a new version and reruns the full evaluation, not just the repaired sample. Retain old versions as ablations. Append measured results to EVAL and write `NNN-result.md`.
3. Use the mentor when requested or when kickoff, methods, evaluation, measured results or the route need independent judgment. Reuse an existing judgment without new material. Supply the card, EVAL, recent briefs/results, actual changes, raw artifacts, user-source path and last-read date/range, plus the current user's original message if not yet persisted. Its first response addresses the result's objections/factual corrections.

A method round ends at an evaluation result, including a negative result, not a plan, smoke test or report; kickoff ends at the one user confirmation. For a project that cannot learn, the first method version after kickoff tests single-example overfitting before larger data or evaluator construction. Status, correction, side answers and blocker reports can end the reply without completing or pausing the research round. Respect explicit pause/stop requests.

## Mentor judgment and briefs

When invoked, the mentor returns at most one page of plain language, first responding to the executor's objections and factual corrections. Read genuine user messages from the specified source, initially in date order and subsequently since the preceding round. Distinguish user restrictions from executor inventions and revoke only restrictions established to be executor-added without a user source. Inaccessible sources leave provenance unknown, not confirmed restrictions or host refusals revoked. Inspect relevant raw outputs rather than trusting only EVAL.

Judge three levels: whether this method family is worth continuing; whether it adds general capability or patches (which failure class it addresses and whether unseen-data results improve); and whether the problem, method and contribution stand, including sensitivity, control strength and realistic deployment assumptions. Distinguish verifying an existing claim from genuinely strengthening the method or evidence; do not default to narrowing the claim. Do not propose single-sample domain craft fixes.

Each brief contains cause diagnosis, the hypothesis and mechanism, one concrete change with everything else held fixed, controls with equal budgets, forbidden inputs, grounded numeric thresholds/predictions in named EVAL columns, and failure reporting that names the blocked step with one or two examples. The mentor remains read-only: evaluator construction, recomputation and significance checks go into the brief for the executor. A brief may be replaced mid-round with its actual author and a stated reason; method-code changes still create a new version.

When blocked, report actual attempts, unexecuted work and the concrete obstacle. If several rounds add no EVAL row, diagnose the blockage rather than continue bookkeeping; if the same method family repeatedly yields no net gain, switch families. The mentor may suggest a user-initiated context clear when useful, but cannot clear it itself.

Within already-authorized work, the mentor directly chooses methods and engineering details such as data scale, downloads and acceleration. Ask once only for a change to the goal, intended claim or deployment inputs/outputs, or resources beyond the user's limit. Without a reply, continue the already-authorized default portion; silence is not consent to the requested departure. No new approval or scientific gate follows.

EVAL's complete columns and correction/recomputation contract belong in [State Management](./state-management.md#core-records). After important results, the mentor supplies the eight-dimensional paper-quality assessment there; its weakest decisive dimension shapes the next brief. The author main session does not duplicate that self-assessment.

## Scientific judgment

Canonical guidance is `src/core/dove-research-contract.mjs`; [Research Model](../../../docs/development/RESEARCH_MODEL.md) explains it. Each fresh author main context personally reads the short Chinese quality and author-preference references under `.dove/install/`; full companions are consulted only for needed details. Compact/resume reuses those readings. Installation, hook output or another agent's read does not demonstrate application. Isolated judgment receives quality guidance, not private author preferences or extra evidence.

Use eight dimensions: problem value, novelty, mechanism/theory, method/feasibility, data/evaluation, implementation, evidence value, expression/delivery. Implementation has three grades, the others four. Separate substantive merit, evidence/confidence, current-use sufficiency and completed work. Unknown, unformed and inapplicable stay outside scores. Do not average ordinal grades, infer acceptance probabilities or let a high score compensate for decisive invalidity.

Ground facts and citations in actual inspection, derivation or execution. Compare contributions and near neighbors at the same granularity; known components do not rule out combination novelty, and no complete precedent does not prove it. Distinguish operation equivalence, expressive coverage, implementation availability and empirical parity. Mechanism grounds and distinguishing predictions guide consequential methods; unknown effects permit justified implementation. Reuse applicable evidence rather than rescanning everything.

Valid execution is not valid evaluation or mechanism support. Preserve information conditions, references, uncertainty, failure accounting and denominators; distinguish candidate generation, selection and end-to-end effect. Negative evidence can advance knowledge without making a failed method good. Apply material findings to the actual method, producer/consumer, claims and delivery artifacts; stop dependent invalid work while retaining sound evidence. Contract checks establish engineering behavior, not scientific effects. Use resources by total time to evidence/delivery, not hardware labels or local utilization; avoid unnecessary infrastructure and redundant fallbacks.

## Capability boundaries

| Skill | Responsibility |
|---|---|
| Research | Start or continue authorized research, using independent judgment when needed. |
| Status | Read the card, latest EVAL rows and current brief; answer four plain sentences: what we have made, whether the core is demonstrated, what blocks it, which round is underway. Do not run new research for a report. |
| Source | Discover, retrieve, inspect and verify decision-changing sources. Citation identity, full-text reading and claim support are separate; bounded checks do not authorize editing or ledgers. |
| Experiment | Develop with available ground truth and reruns, using a new method version and full evaluation after method-code changes. After test use, a changed method needs a fresh draw from data unused in development or prior tests, not reshuffled old tests. Only final heldout confirmation freezes/registers the selected method/comparison in its brief and uses heldout once. Record results in the round and EVAL, not new experiments/. |
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
