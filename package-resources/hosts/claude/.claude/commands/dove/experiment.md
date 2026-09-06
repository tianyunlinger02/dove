---
description: "Use when empirical design, execution, existing-result analysis, or local run receipts can advance a research decision by resolving a real uncertainty."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.experiment

Use when empirical design, execution, existing-result analysis, or local run receipts can advance a research decision by resolving a real uncertainty.

## Request

$ARGUMENTS

## Examples

- `/dove:experiment`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Design, execute, inspect, interpret, or record experiments and diagnostics that can change a research decision.

### When to use

Use for experiment design, execution, analysis of existing results, retrospective recording, or when empirical work is the material way to resolve a contribution or evidence deficiency.

### What Dove will examine

- Follow the actual request: design-only, execution, existing-result analysis, and retrospective recording are different tasks.
- Make experiments claim-driven: name the real problem, key uncertainty, primary prediction, strongest alternative explanation, minimum sufficient evidence, and how positive, negative, or ambiguous outcomes would change the judgment.
- Trace the evaluation chain from input through each method's actual output, the basis it is compared against, what the metric measures, and the final between-method comparison. When a reference is used, establish its applicability to the target object and granularity; justify any proxy or method's own output used as an evaluation basis, not merely the file's existence.
- Explain how failed, missing, invalid, or excluded outputs enter results and denominators, without silently retaining only the successful intersection or automatically assigning every failure zero. Where applicable, align the same evaluation units for paired comparisons, inspect differences and uncertainty, and account for sample dependence. Protect final-test independence when training, tuning, calibration, or method selection occurs.
- Judge ablations from actual code, configuration, and outputs: beyond the named component, did information access, preprocessing, training budget, numerical scale, edit magnitude, or postprocessing also change? Distinguish the full implementation winning, a component's gain under the given control, and support for a scientific mechanism. If controls cannot identify the core contribution, repair the minimum necessary comparison or explicitly limit the conclusion; more runs do not repair identification, though authorized useful exploration may continue.
- Use `dove run start|status|resume|finalize|compare` when local execution tracking helps; state the judgment and metric or observation it can inform and what remains outside the receipt. The `.dove/runs/` journal and stdout/stderr are execution materials, not scientific explanation or research progress by themselves.

### Scope and changes

- Design-only work does not authorize diagnostic or experiment execution; high-cost, destructive, outward-facing, or resource-heavy experiments still require explicit user direction and permission.
- Apply reference, pairing, and data-split reasoning only where it fits the study; do not impose ground truth, paired designs, or train/test splits on no-ground-truth, non-paired, or purely theoretical work.
- Maintain Dove research Markdown only when the user explicitly asks to record, update, or save Dove research context, the result clearly changes the research mainline, conclusion, decision, or priority, or preserving the work's evidence and continuation context is genuinely useful.

### Ways Dove may proceed

- When existing Dove research context would materially help the experiment, read `.dove/research/RESEARCH.md`, then `.dove/research/experiments/EXPERIMENTS.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Avoid broad research-tree scans. If a needed entry or link is absent, say so naturally.
- When existing Lessons could inspire current or subsequent work, improve judgment, expand the candidate space, or prevent repeated mistakes, read ".dove/research/lessons/LESSONS.md" if it exists, then the directly relevant or plausibly useful linked Lessons. Read ".dove/research/RESEARCH.md" first only when project context is still needed and it has not already been read in the active context. Reuse Lessons already read in the active context instead of rereading them mechanically. If Lessons materials are absent, work without them. Treat Lessons as fallible guidance, never as evidence.
- For new design, establish the claim-driven comparison and evaluation chain above. If the central basis is missing, pause central design and inspect actual project material or relevant sources rather than inventing a substitute experiment. Check new data, methods, evaluation chains, or decision-relevant gaps using existing code, samples, and outputs where sufficient; run a smallest representative low-risk diagnostic only when necessary and authorized. Small samples check chain semantics and implementation, not population-level statistical sufficiency. For design-only work, trace materials read-only and deliver an executable plan with unverified parts, without running diagnostics or experiments. Analyze existing results directly; label retrospective recording retrospective rather than inventing prior design.
- Only for newly authorized central execution that needs recording, select the relevant Experiment document or a naturally named new one and save the prospective plan there before execution begins: what it tests, the prediction and strongest alternative, the procedure, and how results will be judged. Keep this same document for the later actual results. Design-only work, existing-result analysis, retrospective recording, and exploratory diagnostics do not require a new document merely to proceed.
- Execute only when requested and permitted, or inspect existing results when analysis is requested. State methods, configuration, data, metrics, run counts, and result numbers from actual code, logs, outputs, data files, user material, or run receipts. Interpret results against the evaluation chain and actual control differences above, checking decision-relevant anomalies before treating them as evidence. For newly executed central work that needed recording, execute only after the prospective plan has been successfully saved, then append the actual procedure, result, interpretation-changing deviation, evidence scope, and route update to that same Experiment document. For existing-result analysis or retrospective work, record only when useful and do not imply a prior plan existed; run receipts do not replace this scientific explanation. Separate what was observed, what it means, why it matters, and what happens next.
- When the maintenance trigger is met, record the experiment, diagnostic, result, failure, evidence scope, route decision, and useful project-relative logs, data, output, the corresponding `.dove/runs/` run journal, figure, or code paths in the relevant Experiment document, linking affected Claim, Source, or Figure context only when useful for recovery. Use ordinary Markdown links and readable project-relative artifact paths only when useful for recovery, and keep the note as human prose rather than a structured store. Update only the narrowest relevant research document. Update `.dove/research/experiments/EXPERIMENTS.md` only when its own links or synthesis materially change. Update `.dove/research/RESEARCH.md` only for a project-level mainline, conclusion, navigation, or priority change.

### What this should not replace

- Do not synthesize a prospective plan after execution or disguise retrospective notes as prior design.
- Do not run a convenient proxy experiment that cannot affect the research decision.
- Do not treat a diagnostic as evidence beyond the conditions actually tested.

### When Dove needs input

- Ask only when ambiguity in intent, target artifact, evaluation criteria, scope, or a key tradeoff would change the next useful action. If active research context implies a feasible follow-up, do that next step rather than merely suggesting it.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.

### Return with

- Inspected evidence, material change, unresolved limits, and the next useful action.
