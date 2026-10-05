# Component Guidelines

## One researcher, isolated judgment

Dove is one research collaborator with nine flat, optional Skills: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`. Ordinary Claude conversation through the project rule is the primary entrance; `--agent dove` is optional. DSH uses its exposed Skills. Independent viewpoints come from clean contexts, not personas, extra modes or permission grants.

The author main session owns the user conversation, clarification, implementation and artifact delivery. `dove-mentor` judges rounds and supplies the next brief; `dove-review` independently critiques specified paper materials. Both use fresh read-only contexts with Read/Grep/Glob, without the execution conversation. A bounded investigation returns scoped evidence rather than taking over the mainline. Use only exposed, permitted tools; explicit read-only/design-only requests stay within scope.

## Mainline and rounds

`Mainline` is the user's confirmed goal, intended contribution and completion meaning, not the method or next action. Preserve its wording unless the user changes those commitments or the card misstates confirmed intent. Methods can change within the goal and fixed constraints; scientific claims change with evidence. Neither available assets, a convenient proxy, a surviving component nor a local success establishes a new goal. Clarify consequential ambiguity and keep unconfirmed directions provisional.

The core context is the short identity card, `EVAL.md` and `rounds/` under `.dove/research/`; ownership is in [State Management](./state-management.md). Keep `Current round: rounds/NNN-brief.md` and `Round status: ongoing|paused|completed` at the card's top, followed by Mainline, input/output/completion, restrictions, rejected approaches and Recent corrections. Keep the whole card to a few hundred words; route details and next work live in the brief, not duplicate card fields.

Research follows one loop:

1. Read the card, EVAL and current brief. Execute an ongoing round; with none active, call the mentor.
2. Save the mentor's brief verbatim as `NNN-brief.md`. Every brief starts with `Author: mentor / user / external` (导师 / 用户 / 外部); a user or external task is a human-authored round brief, not a new Mission.
3. Implement until the brief's result appears in the evaluation table. Append time, round and actual metrics to EVAL; write `NNN-result.md` with changed files, values and prediction versus actual.
4. Call the mentor with the card, recent corrections, EVAL, recent briefs/results and actual diffs or changed files; save the next brief and continue.

A round ends at an evaluation result, not a plan, smoke test or report. Status and side answers return to the round. An explicit discussion-only or stop request pauses it. The one-shot Stop reminder and host-specific behavior belong in [Hook Guidelines](./hook-guidelines.md); there is no Cron self-wake rule, durable continuation ledger or separate Auto Skill.

## Mentor and fixed evaluation

The mentor returns at most one page of plain language:

- Compare the preceding prediction with actual results. Judge target-scoped general capability versus hardcoded sample/style/category branches, whether the method family remains worthwhile and any shared cause of failure.
- Specify the next hypothesis, why its mechanism is likely to work, predicted values in named EVAL columns and completion as a table result. Keep grounded estimates distinct from uncertain predictions.
- Or conclude that the goal is achieved with evidence, or needs a user decision because the goal must change, resources exceed the user's limit or the whole mainline is judged unworkable.

The mentor may replace methods or routes within Mainline and fixed constraints without renewed approval; explain why in the brief. The main session implements that direction rather than replacing it with a self-review. A confirmed mainline covers its core implementation, reruns, diagnosis and suitable GPU work within resource limits. Outward actions and material goal/resource changes still need the user's decision. No new approval or scientific gate follows.

After mainline confirmation, the first mentor proposes the evaluation script, dev/test split and key columns, including an unseen style/category or equivalent generalization column. Reuse existing evaluation. The user confirms this completion standard once; save the script, split and metrics in the identity card's Completion field. Later changes also need confirmation. Every round adds measured values to EVAL. After important results, the mentor adds the eight-dimensional paper-quality assessment there; its weakest decisive dimension shapes the next brief. The author main session does not duplicate that self-assessment.

## Scientific judgment

Canonical guidance is `src/core/dove-research-contract.mjs`; [Research Model](../../../docs/development/RESEARCH_MODEL.md) explains it. Each fresh author main context personally reads the short Chinese quality and author-preference references under `.dove/install/`; full companions are consulted only for needed details. Compact/resume reuses those readings. Installation, hook output or another agent's read does not demonstrate application. Isolated judgment receives quality guidance, not private author preferences or extra evidence.

Use eight dimensions: problem value, novelty, mechanism/theory, method/feasibility, data/evaluation, implementation, evidence value, expression/delivery. Implementation has three grades, the others four. Separate substantive merit, evidence/confidence, current-use sufficiency and completed work. Unknown, unformed and inapplicable stay outside scores. Do not average ordinal grades, infer acceptance probabilities or let a high score compensate for decisive invalidity.

Ground facts and citations in actual inspection, derivation or execution. Compare contributions and near neighbors at the same granularity; known components do not rule out combination novelty, and no complete precedent does not prove it. Distinguish operation equivalence, expressive coverage, implementation availability and empirical parity. Mechanism grounds and distinguishing predictions guide consequential methods; unknown effects permit justified implementation. Reuse applicable evidence rather than rescanning everything.

Valid execution is not valid evaluation or mechanism support. Preserve information conditions, references, uncertainty, failure accounting and denominators; distinguish candidate generation, selection and end-to-end effect. Negative evidence can advance knowledge without making a failed method good. Apply material findings to the actual method, producer/consumer, claims and delivery artifacts; stop dependent invalid work while retaining sound evidence. Contract checks establish engineering behavior, not scientific effects. Use resources by total time to evidence/delivery, not hardware labels or local utilization; avoid unnecessary infrastructure and redundant fallbacks.

## Capability boundaries

| Skill | Responsibility |
|---|---|
| Research | Start or continue the mentor-led round loop. |
| Status | Read the card, latest EVAL rows and current brief; answer four plain sentences: what we have made, whether the core is demonstrated, what blocks it, which round is underway. Do not run new research for a report. |
| Source | Discover, retrieve, inspect and verify decision-changing sources. Citation identity, full-text reading and claim support are separate; bounded checks do not authorize editing or ledgers. |
| Experiment | Develop freely with available ground truth and reruns. Only final heldout confirmation freezes the method/comparison, registers the claim, control, data, metric and interpretation in its brief, and uses heldout once. Record results in the round and EVAL, not new experiments/. |
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
