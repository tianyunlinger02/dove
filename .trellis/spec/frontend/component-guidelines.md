# Component Guidelines

## One researcher, isolated judgment

Dove is one research collaborator with nine flat, optional Skills: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`. Ordinary Claude conversation is the primary entrance; `--agent dove` is optional. DSH receives filesystem Skills, not Claude agents or hooks. Skills create neither personas nor permissions.

The main session owns conversation, clarification, execution and delivery. The executor decides engineering, equivalence, acceleration, parameters and evaluator repairs. `dove-mentor` judges direction, scientific adequacy and time spent; `dove-review` critiques supplied paper materials. Both return findings without executing or editing. The mentor may retrieve paper/web sources; the reviewer uses only Read/Grep/Glob. Bounded requests retain their scope.

## Mainline and rounds

Preserve the user's confirmed Mainline, contribution, completion meaning and fixed methods. A field, recommendation or card entry is not confirmation. Record clear intent without asking again; retain provisional wording and correct misrecordings. Other designs can change with evidence; changes to commitments or resources need the user.

Before selection, read `.dove/research/topics/CRITERIA.md` and project standards. Identify a meaningful direction and challenge axes; investigate at most two gaps per axis. State each gap as prior approaches achieving X through Y while leaving Z unresolved. Cite at least two body-read near-miss papers, explain each shortfall, name the deficiency and the observation that could show closure. Mechanism, algorithm, inductive bias, credit assignment, objective, representation and scaling are useful deficiency types, not a universal method-only contribution gate. Unread papers or mere absence of prior work cannot ground a gap.

For each gap, use 6–10 mechanism queries spanning at least three other subfields. Seek solutions to structurally similar problems; in-domain sources are valid when not merely rediscovering the closest work. Generate parallel candidates before pruning. Cards state the idea, attacked gap, source papers and mechanism with its original rationale, mapping to the target, plausibility and key assumption, specific in-domain novelty difference, and main risk. Improvements identify what changed.

The mentor searches borrowed mechanism plus target problem to falsify novelty. Per candidate, return keep, revise or reject; revision names only the weakest focus among novelty, coherence, feasibility, clarity, mapping and grounding, while rejection gives a reason. Include paper IDs with one or two sentences of evidence and one strongest objection. Offer 2–3 grounded recommendations for the user's choice. Before selection, implement no candidate methods; only standards-allowed diagnostics. `dove topic start` is an optional materials helper, not a substitute for reading standards. Continue an already confirmed mainline on takeover.

After selection, choose work by full-task benefit, alternatives, mechanism grounds and key unknowns. Expand or redesign when the scale cannot answer the question; otherwise avoid needless work. Pipeline connection does not demonstrate the core mechanism. Useful core work need not await exhaustive theory or baselines; necessary repairs need not be novel.

A method round uses one code version, possibly with coordinated changes. Later method changes require a new version and full applicable evaluation; retain old versions as ablations. Negative results can add knowledge, while plans, smoke tests and engineering checks cannot. Status, side answers and blockers need not end a round; honor stops and discussion-only requests.

## Mentor judgment and briefs

Call the mentor at round end, after two no-science rounds, on user direction/story corrections, before route changes or when requested. Engineering and verification failures count. Obtain diagnosis after two rounds; before the third, explain the blockage and ask the user to decide. Report old route, new route and reason for changes.

Use `dove mentor brief --project <root>` for the call body in a fresh native context. It lists actual materials and four questions; add only a capped, author-labeled opinion file and new raw-artifact paths. Include current user requests verbatim with sources, not executor-written instructions. Repeat calls within a round identify their trigger in the template; 2–3 clarifications may stay within one judgment. The questions are:

1. Is the direction faithful to the user's original goal?
2. Are recent rounds building general capability or repeated patches?
3. What remains to reach the goal and target tier?
4. What should the next round do, and why?

The mentor first answers objections and factual corrections, then judges goals, predictions versus outcomes, family-level causes and unseen-data evidence. Read genuine user bodies under [Hook Guidelines](./hook-guidelines.md), not executor paraphrases. Inaccessible sources leave provenance unknown without revoking commitments or host refusals. Rejected families belong in briefs or mentor notes, not permanent card prohibitions.

The mentor reads the quality summary and relevant full criteria, never author preferences. Its brief explains direction, benefit, grounds, unknowns, action and how results change decisions, using appropriate controls, inputs, budgets and grounded predictions. Return self-authored memory and, after important results, a current eight-dimensional assessment. The main session saves them under [State Management](./state-management.md#core-records).

Every mentor also checks draft watch configuration, unjudged impacts and absent or overdue weekly scans. Return advice and tracking judgments separately from the brief; the main session applies and saves them. This does not wait for a round.

## Scientific judgment

Canonical guidance is `src/core/dove-research-contract.mjs`. Fresh author contexts personally read quality and preference essentials; full companions are on demand, compact/resume reuses readings. Bootstrap depends on verified guidance files, not overall integration status: preserved statusLine/MCP differences remain visible without blocking guidance. Installation or hook delivery does not prove adoption.

Separate merit, evidence/confidence, current-use sufficiency and completion. Eight dimensions cover problem value, novelty, mechanism/theory, method/feasibility, data/evaluation, implementation, evidence value and expression/delivery. Implementation has three grades, others four. Unknown and inapplicable are outside grades; do not average ordinal scores, infer acceptance probabilities or offset decisive invalidity.

Facts and design judgments need inspected sources, derivations, code or observations; effects need measurements. Compare contributions at equal granularity across fields. Shared functions need not imply equal contributions, while domain or combination labels do not prove novelty. Separate equivalence, expressive coverage, availability and empirical parity.

External full-task comparisons test utility; ablations and mechanism controls test attribution. Preserve inputs, references, budgets, uncertainty, failures and denominators. Separate generation, selection and end-to-end effects. Apply findings to dependent methods, claims and artifacts, retaining negative evidence. Optimize total time to useful evidence or delivery, not utilization, bookkeeping or unsupported infrastructure.

## Capability boundaries

| Skill | Responsibility |
|---|---|
| Research | Develop grounded candidates for user choice, or advance the confirmed mainline. |
| Status | Read the card, latest EVAL and brief; report results, core evidence, blockers and round in four plain sentences without new work. |
| Source | Separate identity checks, reading and claim support. For body details, read with 1–5 questions and accumulate a summary and location-grounded answers in `papers/<id>.md`; reuse answered questions. Abstract/summary-only material names its source and remains marked full text unread, not gap evidence. Check-only requests need no notes or edits. |
| Experiment | Develop with available truth and reruns. After test use, changed methods need a fresh unused draw and same-set baselines. Only final heldout confirmation declares the comparison beforehand and uses heldout once. |
| Draft | Group related work by direction from `papers/library.json` and `papers/library.md`; export BibTeX from checked metadata without invented authors or venues. Preserve reading provenance, claim strength and authoritative format; inspect the actual build/export. |
| Figure | Gather, draw, render, inspect, caption and deliver editable visuals; quantitative figures use real data. |
| Review | Distinguish self-check, delivery inspection, independent paper review and faithful return preservation. |
| Rebuttal | Verify concerns, group causes and respond or revise within scope; a reply is not resolution or acceptance. |
| Lessons | Use grounded transferable guidance with conditions and counterexamples, not routine progress or proof. |

## Paper review and delivery

Independent `dove-review` reads specified current manuscript materials, cited results and supplied venue/literature grounding in a fresh native context. Exclude author conversation, preferences, identity/round records and old reviews. Missing material limits judgment, not permission to retrieve or execute. No frozen copy, hashes, external workspace or persistent session is needed.

Whole-paper review checks question-method fit, field correctness, contribution/evidence fit and the strongest reasonable objection. Return judgment, substantive problems, evidence, author actions and actual files read. Preserve real returns and distinguish user-pasted opinions; objections are not empirical evidence.

After substantive changes, review the complete current version afresh; old recommendations are historical. Submission requires scientific sufficiency, independent scientific acceptability of that same version and delivery readiness. Missing review remains a gap. Preserve manuscript format; new manuscripts default to LaTeX only where accepted, with compiled-output inspection.

Default to natural Chinese. Judgment questions start with the conclusion, then one or two evidence sentences and at most one boundary sentence. Distinguish scientific progress, engineering, delivery and software checks; do not hide an unmet goal behind a qualified yes.
