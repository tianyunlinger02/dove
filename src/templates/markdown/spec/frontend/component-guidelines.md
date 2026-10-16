# Component Guidelines

## One researcher, isolated judgment

Dove is one research collaborator with nine flat, optional Skills: `research`, `status`, `source`, `experiment`, `draft`, `figure`, `review`, `rebuttal`, and `lessons`. Ordinary Claude conversation is the primary entrance; `--agent dove` is optional. DSH receives filesystem Skills, not Claude agents or hooks. Skills create neither personas nor permissions.

The main session owns conversation, clarification, execution and delivery. The executor decides engineering, equivalence, acceleration, parameters and evaluator repairs. `dove-mentor` judges direction, scientific adequacy and time spent; `dove-review` critiques supplied paper materials. Both return findings without executing or editing. The mentor may retrieve paper/web sources; the reviewer uses only Read/Grep/Glob. Bounded requests retain their scope.

## Mainline and rounds

Preserve the user's confirmed Mainline, core capability, contribution, completion meaning and fixed methods. A field, recommendation or card entry is not confirmation. Record clear intent without asking again; retain provisional wording and correct misrecordings. Other designs can change with evidence; changes to commitments or resources need the user. A request or document that replaces the route or drops the core capability is a route change even when labeled user-confirmed. Explain once what it drops and whether the old route stopped because of insufficient training, implementation, evaluation or genuine refutation. Follow the user's answer, record it and do not raise the same concern again or block the request.

Start from the current request and completion conditions. Authorized implementation, repair, reproduction and bounded delivery proceed without being recast as topic selection or assigned research scores and rounds. For actual selection, read `.dove/research/topics/CRITERIA.md` and project standards. Selection ends in the user's mainline choice, not a closed-method proposal; higher standards bind their deliverables, not recommendations. Ground value in strong-baseline failures and sourced numbers. Focus on consequential gaps: prior methods do X through Y but leave Z. Cite two body-read near-miss papers, their shortfalls, a deficiency and observable closure. Abstracts or absent precedent are not evidence.

Search in-domain and cross-field mechanisms according to key unknowns. Six to ten queries and three other subfields are breadth strategies, not delivery quotas or proof of novelty; explicit user requirements still apply. Read source mechanisms and closest prior work, generating parallel candidates before pruning. Cards expose idea, gap, source mechanism and rationale, mapping, assumptions, specific nearest-work difference, risk and unknowns. One sourced idea can support selection; method design and closure belong within the mainline. Improvements state what changed.

The mentor searches borrowed mechanism plus target problem and gives a judgment with cited evidence and the strongest objection. Revision addresses decisive bottlenecks and shared causes, comparing coordinated changes and alternative routes rather than one weakest item. Within one round, deliver candidates, neighbors and the best 2–3 choices; give one if that is all. Explain conflicting standards once while still offering the best directions for user choice or standards adjustment. During selection, implement no methods before choice; only standards-allowed diagnostics. `dove topic start` is optional; takeover preserves confirmed mainlines.

Confirmation ends selection-only limits; ask once for any separate resource/model authorization, not at every step. Diagnose key unknowns, design the core method, experiment, then write the proposal. Choose by task benefit, alternatives and mechanism grounds. Scale must answer the question; expand or redesign if not. Pipeline connection is not core evidence; repairs need not be novel.

Keep method changes and measurements version-traceable, including coordinated changes and useful old versions for ablation. Development uses diagnostics answering key unknowns; formal comparisons, result adoption and paper claims require the applicable protocol, all user metrics, fair strong baselines and unseen-data evidence. Untested new-version effects remain unknown, not inherited passes. Negative results can add knowledge, while plans, smoke tests and engineering checks cannot. Status, side answers and blockers need not end a round; honor stops and discussion-only requests.

## Mentor judgment and briefs

Call the mentor at round end, after two no-science rounds, on user direction/story corrections, before route changes or when requested. Engineering and verification failures count for independent diagnosis after two rounds, not automatic reauthorization. Continue a credible authorized next step; ask the user when goals, fixed methods, completion meaning or resource commitments must change, or no credible path remains. Report old route, new route and reason for changes.

Use the generated `dove mentor brief --project <root>` template as the whole call body plus the trigger in a fresh native context. Executor opinions belong in an attributed file; long or unsigned opinions are noted, not rejected. Include current user requests verbatim with sources and relevant raw-artifact paths rather than executor-written instructions. Two or three clarifications may stay within one judgment. The five questions are:

1. Is the direction faithful to the user's original goal and the identity card's core capability?
2. Are recent rounds building general capability or repeated patches?
3. What remains to reach the goal and target tier?
4. What should the next round do, and why?
5. What is new relative to the closest prior work, and is that contribution sufficient for the target tier?

The mentor first answers objections and factual corrections, then judges goals, predictions versus outcomes, family-level causes and unseen-data evidence. Read `USER_ORIGINALS.md` for the user's own words, distinguishing relays; missing or unfinished coverage is not evidence that the user never said something. Consult original sessions or current direct words when needed. Inaccessible sources leave provenance unknown without revoking commitments or host refusals. Rejected families belong in briefs or mentor notes, not permanent card prohibitions.

The mentor reads the quality summary and relevant full criteria, never author preferences. Its brief uses natural full sentences to explain direction, grounds, unknowns, action and how outcomes change decisions, with suitable controls, inputs, budgets and predictions. When notes lack a dated long-term intent section or its date is strictly more than seven days old, compare the user's long-term goal with the mainline, completion, actual methods and metrics, checking whether they measure core capability. Identify where any deviation entered, the novelty judgment and pending user decisions, and recheck attribution of recorded user wording or confirmation. Raise conclusions once without blocking work. Return dated self-authored memory and, after important results, a current eight-dimensional assessment; preserve the latest intent date, issues already raised and their answers during consolidation under [State Management](./state-management.md#core-records). Read the closest prior work at the first post-confirmation judgment and when method families change. Resolve persistent decisive unknowns with informative evidence, considering shared causes and whole alternatives rather than ranking isolated deficiencies. When the read evidence supports a conclusion, state it and act within scope; changed user commitments need the user's decision.

Every mentor also checks watch configuration, unjudged impacts and absent or overdue scans without waiting for a round. For draft or off-target tracking, return the actual suggested JSON separately from the brief. The main session saves it and runs `dove watch configure --project <root> --mentor <建议.json> [--json]`, checking saved values and `source: mentor`. Replace only suggested fields and preserve `enabled`, `categories` and the other settings. This records saved advice, not user confirmation of research direction; without advice, keep the draft.

## Scientific judgment

`src/core/dove-research-contract.mjs` owns the runtime researcher stance. The existing shared renderer in `dove-agent-persona.mjs` supplies ordinary Claude through `ambient-policy.mjs` and DSH Skills; quality summaries/full references carry the same judgment to mentors. `docs/development/VISION_AND_PRINCIPLES.md` is the human-readable overview, not a second prompt or required session read. Judge problem value, core capability and contribution together; compare whole alternatives and lifecycle cost, create testable mechanisms, and use decisive experiments to guide resilient, authorized action.

Fresh author contexts personally read quality and preference essentials; full companions are on demand, compact/resume reuses readings and resumes the most valuable authorized action against the current goal. Bootstrap depends on verified guidance files, not overall integration status: preserved statusLine/MCP differences remain visible without blocking guidance. Installation or hook delivery does not prove adoption.

Separate merit, evidence/confidence, current-use sufficiency and completion. Eight dimensions cover problem value, novelty, mechanism/theory, method/feasibility, data/evaluation, implementation, evidence value and expression/delivery. Implementation has three grades, others four. Unknown and inapplicable are outside grades; do not average ordinal scores, infer acceptance probabilities or offset decisive invalidity.

Facts and design judgments need inspected sources, derivations, code or observations; effects need measurements. Compare contributions at equal granularity across fields. Shared functions need not imply equal contributions, while domain or combination labels do not prove novelty. Separate equivalence, expressive coverage, availability and empirical parity.

External full-task comparisons test utility; ablations and mechanism controls test attribution. Preserve inputs, references, budgets, uncertainty, failures and denominators. Separate generation, selection and end-to-end effects. Apply findings to dependent methods, claims and artifacts, retaining negative evidence. Optimize total time to useful evidence or delivery, not utilization, bookkeeping or unsupported infrastructure.

## Capability boundaries

| Skill | Responsibility |
|---|---|
| Research | Develop grounded candidates for user choice, or advance the confirmed mainline. |
| Status | Read the card, latest EVAL and brief; explain results, core evidence, blockers and current work with the detail needed for judgment, without starting new work. |
| Source | Separate identity checks, reading and claim support. For body details, read with 1–5 questions and accumulate a summary and location-grounded answers in `papers/<id>.md`; reuse answered questions. Abstract/summary-only material names its source and remains marked full text unread, not gap evidence. Check-only requests need no notes or edits. |
| Experiment | Develop with available truth and targeted reruns. Formal comparisons after test-informed changes need a fresh unused draw and same-set baselines; final heldout confirmation declares and freezes the comparison beforehand and uses heldout once. |
| Draft | Group related work by direction from `papers/library.json` and `papers/library.md`; export BibTeX from checked metadata without invented authors or venues. Preserve reading provenance, claim strength and authoritative format; inspect the actual build/export. |
| Figure | Gather, draw, render, inspect, caption and deliver editable visuals; quantitative figures use real data. |
| Review | Distinguish self-check, delivery inspection, independent paper review and faithful return preservation. |
| Rebuttal | Verify concerns, group causes and respond or revise within scope; a reply is not resolution or acceptance. |
| Lessons | Use grounded transferable guidance with conditions and counterexamples, not routine progress or proof. |

## Paper review and delivery

Independent `dove-review` reads specified current manuscript materials, cited results and supplied venue/literature grounding in a fresh native context. Exclude author conversation, preferences, identity/round records and old reviews. Missing material limits judgment, not permission to retrieve or execute. No frozen copy, hashes, external workspace or persistent session is needed.

Whole-paper review checks question-method fit, field correctness, contribution/evidence fit and the strongest reasonable objection. Return judgment, substantive problems, evidence, author actions and actual files read. Preserve real returns and distinguish user-pasted opinions; objections are not empirical evidence.

After substantive changes, review the complete current version afresh; old recommendations are historical. Submission requires scientific sufficiency, independent scientific acceptability of that same version and delivery readiness. Missing review remains a gap. Preserve manuscript format; new manuscripts default to LaTeX only where accepted, with compiled-output inspection.

Default to natural Chinese full sentences. Answer judgment questions with the conclusion and the evidence and limits needed to understand it, rather than compressed fragments or a fixed sentence budget. Distinguish scientific progress, engineering, delivery and software checks; do not hide an unmet goal behind a qualified yes.
