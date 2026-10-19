# Research method

Researcher-owned, optional guidance; use the parts that change the current judgment. See [Lessons](LESSONS.md) for ownership and advice maturity.

## Problem, contribution, and route

Start from the real question, affected methods or tasks, consequences, and conditions in which an answer matters. Inspect the actual project and relevant external work, including historical terminology, nearest strong methods, recent work, counterevidence, citation chains, and genuinely relevant adjacent fields. Hunches and cross-domain analogies generate hypotheses, not conclusions; preferences guide tradeoffs, not facts.

Compare materially different routes across problem definition, representation, generation/inference/optimization mechanism, training objective, evaluation, theory, and simpler or more efficient solutions. Do not let available code or fashionable tools choose the problem. A focused or infrequent failure may matter, but neither rarity nor broad language establishes value.

Atomize candidate and nearest-work contributions at the same granularity: input/output, inference-time information, supervision, assumptions, mechanism, algorithm, objective, constraints, and claims. Check problem collisions under comparable deployment and budgets, not just similar technique names. Distinguish identity verification, relevant full-text inspection, and claim-level support or contradiction. Missing full text is unverified overlap, not no overlap. Keep actual evidence locations when useful.

Subtract already covered claims, routine combinations, model/data substitutions, and direct applications of existing theory. Then reassess the remaining difference's independent mechanism and value; a narrower title cannot preserve the broad problem's significance. A simple method can be a substantial contribution, whereas extra modules, formulas, and renamed interfaces cannot create one.

## Hypotheses and concrete mechanisms

A falsifiable hypothesis connects a proposed mechanism, reasons it may hold, observable predictions, failure conditions, alternative explanations, and evidence that separates them. Specify inputs/outputs, variables, information dependencies, and training or inference steps sufficiently to compare the method with strong neighbors and simple alternatives. A tool name or standard formula is not the missing mechanism.

Distinguish a problem lead, concrete candidate, argument-ready proposal, and evidence-supported claim within explicit scope. Unclear objects need definition; absent mechanisms need design or derivation; unknown effects need suitable validation. Argument-ready does not require prior successful experiments, and useful early authorized diagnostics need not wait for that level. A selection/design-only request still forbids execution. Full definitions and optional original N/T judgments are in the [research model](../../../docs/development/RESEARCH_MODEL.md); use N/T only when the project-provided definitions are readable and actually inspected, otherwise judge in plain language without guessing numbers. Project N/T thresholds and scores are not universal gates.

Seek the minimum sufficient mechanism, not a repair module for each failure. Before scaling a route, consider relevant ideal upper bounds, reachability, constraint legality, data coverage, proxy reliability, and minimum meaningful benefit. A diagnostic prototype serves its question, not sunk-cost promotion into the final method; its failure need not refute a higher-level hypothesis.

## Theory checks when applicable

- **Identifiability:** can available observations separate the proposed latent factors, or are supervision, interventions, or structural assumptions required? Naming branches does not identify mechanisms. [Locatello et al.](https://proceedings.mlr.press/v97/locatello19a.html), cited by the selection document, motivates checking these conditions.
- **Proxy versus target:** distinguish ranking or sign agreement, calibration, risk bounds, and sufficiency. Consistency or improved conditioning need not imply correctness or final task benefit; state conditions, counterexamples, and how the needed relationship can be checked.
- **Interactions:** individual deletion effects need not add to joint effects, correlated evidence is not independent, and expectation need not commute with nonlinear objectives. State the actual optimization target and approximation bias.
- **Optimization versus implementation:** distinguish exact solvers, relaxations, approximations, and heuristics. Check constraints, complexity, and assumptions before transferring an ideal optimizer's guarantee to code.
- **Statistical scope:** identify the controlled event, randomness, data dependence, fixed model/score, and population, subgroup, or individual scope. Marginal coverage is not conditional coverage, and expected risk is not a per-run guarantee. [Angelopoulos and Bates](https://arxiv.org/abs/2107.07511) provides the cited conformal-prediction reference; exchangeability is not arbitrary distribution-shift robustness.
- **Related mechanisms and error targets:** [CALM](https://proceedings.neurips.cc/paper_files/paper/2022/hash/6fac9e316a4ae75ea244ddcef1982c71-Abstract-Conference.html) is a cited neighbor connecting dynamic computation and quality guarantees, not a ban on statistical or frozen-model methods. [Javanmard and Montanari](https://arxiv.org/abs/1603.09000) is the cited FDR/FDX reference: expected false-discovery proportion, exceedance probability, and FWER's probability of any false discovery address different decision events.

Keep assumptions, supported conclusions, unresolved proofs, violation consequences, and alternatives where they help reuse, without a mandatory ledger. A counterexample can refute an unconditional claim without showing a frequent real-world failure. Data generalization, applicability across methods, and reusable principles are distinct; interface compatibility and potential applications do not establish them.

When theory and results disagree, inspect the premise, test, and route, then continue, change, or stop. Do not defend a story with more modules or experiments that cannot distinguish explanations.

## Basis

[Topic-selection requirements](../../../论文选题准入标准_最新版.md), §§2 and 4–9, appendices and references [3]–[6]; [general preferences](../../../通用科研工程与协作偏好(终).md), §§6–15. References above retain the original rationale, not a claim of new external verification.
