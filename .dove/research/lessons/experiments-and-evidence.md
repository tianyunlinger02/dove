# Experiments and evidence

Researcher-owned, optional guidance; choose evidence by the claim and actual authority. See [Lessons](LESSONS.md) for ownership and advice maturity.

## Design for a decision

Before treating an experiment as central, establish the real problem, uncertainty, or route decision. Inspect relevant project materials and sources when the basis is missing; use a smaller diagnostic only when useful and authorized, not as a substitute research goal. Design-only work delivers a plan and unverified limits without execution; analysis of existing results and retrospective recording remain distinct from a prospective plan.

For new execution, specify the claim, falsifiable hypothesis, changed variable, controls, primary and auxiliary metrics, supporting/refuting outcomes, minimum meaningful benefit, and stopping implications. A new central experiment needing a record saves the plan before execution and appends actual results and interpretation-changing deviations afterward. Routine diagnostics do not automatically require a document.

Use external strong, close, fair baselines and competitive simple alternatives, not only internal old versions. Match data, splits, inference information, supervision, model/compute budget, training and inference counts, postprocessing, evaluation, and failure accounting; disclose unavoidable differences. Before scaling, inspect the relevant upper bound, reachability, legality, coverage, evaluator reliability, or useful benefit rather than mechanically running every diagnostic.

## Evidence answers different questions

Distinguish design specified, chain executed, comparison valid, and the corresponding claim supported. A negative result can be a complete, valid experiment; do not chase positive results to advance a level. Theoretical feasibility, successful execution, fair comparison, mechanism support, and final task benefit cannot substitute for one another.

For claims of real task capability, the general preferences prioritize end-to-end final results over mechanism controls, intermediate diagnostics, isolated cases, and software logs. Preserve that evidential boundary without imposing one universal ranking: final results test task benefit, mechanism controls test explanations, and proofs test stated mathematical claims. A successful end-to-end run alone need not identify a mechanism; loss reduction, gradients, hidden-state changes, proxy gains, and a few attractive cases cannot establish final task ability.

Distinguish output feasibility from correctness, direction and useful magnitude of change, locality, collateral damage, preserved structure, and actual downstream effect. Legal, parseable, or unchanged output is not necessarily a successful task result.

Use discriminating ablations, counterfactuals, genuinely broken random/shuffled/mismatched controls, ideal upper and reference lower bounds, same-sample paired comparisons, and compute-matched simple replacements where relevant. Inspect actual code, configuration, and outputs for extra changes in information, preprocessing, budget, numerical scale, or postprocessing. An implementation win, component gain under a given control, and identified mechanism are different conclusions.

Trace input, actual method output, suitable reference or proxy, metric, and comparison. Report differences, uncertainty, and dependence where appropriate, not a fixed statistical template. A few diagnostic samples can expose chain errors but not prove population sufficiency. Without labels or pairing, choose a suitable alternative rather than fabricating them.

## Preserve independent and complete evidence

Separate training/development, search or method selection, confirmation, calibration when applicable, and final testing by their actual roles. Do not repeatedly select policies on calibration data and then treat it as untouched without addressing selection bias. Freeze the method, scoring, budget, thresholds, and selection/postprocessing rules for formal comparison; later changes form a new version or diagnostic protocol. Freezing rules does not prove the metrics, budget, or method scientifically valid.

Retain inputs/configurations, raw outputs, parsing and candidate results, scores, accept/reject reasons, final artifacts, logs, versions/seeds, source provenance, visualizations, and genuine human inspection when they are needed to interpret or recover evidence. Account for timeouts, parse errors, invalid or empty outputs, and rejected cases in outcomes and denominators; do not silently report only successful intersections or force every failure into an unjustified zero. An automatically filled field is not human review.

When results disappoint, locate the failure in evaluator, task/supervision, coverage, reachability, condition use, optimization, inference, fairness, or hypothesis. Inspect suspiciously strong results too. Repair the affected cause, preserve valid work and negatives, and change the route based on evidence rather than filtering away failures or redefining success. More runs, audits, and records are not progress when they cannot change a decision.

## Basis

[General preferences](../../../通用科研工程与协作偏好(终).md), §§11 and 14–23; [topic-selection requirements](../../../论文选题准入标准_最新版.md), §§6–9. The latter's selection phase plans validation but does not execute it; its project restrictions do not become universal experiment rules.
