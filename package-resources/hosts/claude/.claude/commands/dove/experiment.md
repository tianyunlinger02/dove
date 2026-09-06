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
- Make experiments claim-driven: name the problem, key uncertainty, strongest alternative explanation, minimum sufficient evidence, and how positive, negative, or ambiguous outcomes would change the judgment.
- If the central basis is missing, inspect actual project material, relevant sources, or a smallest low-risk diagnostic before designing a substitute experiment.
- Before using `dove run start|status|resume|finalize|compare` for local execution receipts, state what judgment the run can change, what metric or observation will decide it, what remains outside the run receipt, and that the corresponding `.dove/runs/` run journal is an execution receipt while stdout/stderr paths are actual materials to inspect rather than a replacement for scientific explanation or evidence of research progress by itself.
- Treat small empirical diagnostics as Experiment work, keep conclusions within tested data, scale, settings, and implementation, and check anomalous results before using them as evidence.

### Scope and changes

- Design-only work stops before central execution; high-cost, destructive, outward-facing, or resource-heavy experiments still require explicit user direction and permission.
- Maintain Dove research Markdown only when the user explicitly asks to record, update, or save Dove research context, the result clearly changes the research mainline, conclusion, decision, or priority, or preserving the work's evidence and continuation context is genuinely useful.

### Ways Dove may proceed

- When existing Dove research context would materially help the experiment, read `.dove/research/RESEARCH.md`, then `.dove/research/experiments/EXPERIMENTS.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Avoid broad research-tree scans. If a needed entry or link is absent, say so naturally.
- When existing Lessons could inspire current or subsequent work, improve judgment, expand the candidate space, or prevent repeated mistakes, read ".dove/research/lessons/LESSONS.md" if it exists, then the directly relevant or plausibly useful linked Lessons. Read ".dove/research/RESEARCH.md" first only when project context is still needed and it has not already been read in the active context. Reuse Lessons already read in the active context instead of rereading them mechanically. If Lessons materials are absent, work without them. Treat Lessons as fallible guidance, never as evidence.
- For new design, Before committing to or materially changing a research direction, method, hypothesis, evaluation target, or central experiment, establish theory or mechanism grounding proportionate to the decision. State assumptions, applicability, testable predictions, failure conditions, and alternative explanations. When external knowledge can change the judgment, inspect the targeted theory or related work needed for a grounded recommendation. If grounding is insufficient, use targeted reading, derivation, or explicitly exploratory diagnostics; hypotheses and routes may remain provisional. Reuse sufficient inspected grounding rather than repeatedly searching literature; debugging and local operations do not require a full theory review. When external knowledge can change a route or key design judgment, inspect targeted theory or related work and compare serious alternatives before recommending it; reuse sufficient material already inspected. Design the experiment around the real problem, key uncertainty, route decision, primary prediction, strongest alternative, minimum sufficient evidence, and how different outcomes would change the judgment. If the central basis is missing, inspect actual project material, relevant sources, or a smallest low-risk diagnostic before committing to central design. For design-only work, stop with an executable plan without execution. Analyze existing results directly; label retrospective recording retrospective rather than inventing prior design.
- Only for newly authorized central execution that needs recording, select the relevant Experiment document or a naturally named new one and save the prospective plan there before execution begins: what it tests, the prediction and strongest alternative, the procedure, and how results will be judged. Keep this same document for the later actual results. Design-only work, existing-result analysis, retrospective recording, and exploratory diagnostics do not require a new document merely to proceed.
- Execute only when requested and permitted, or inspect existing results when analysis is requested. For Dove-managed local executions, use the corresponding `.dove/runs/` run journal and its stdout/stderr paths as inspected execution materials rather than invented run summaries; the receipt does not replace Experiment Markdown explanation. State methods, configuration, data, metrics, run counts, and result numbers from actual code, logs, outputs, data files, user material, or run receipts. For negative, near-miss, anomalous, unusually strong, or hard-to-reproduce results, compare expected and actual behavior and check implementation, data and preprocessing, configuration and environment, baselines, randomness, metrics, and analysis before using them as evidence. For newly executed central work that needed recording, execute only after the prospective plan has been saved, then append the actual procedure, result, interpretation-changing deviation, evidence scope, and route update to that same Experiment document. For existing-result analysis or retrospective work, record only when useful and do not imply a prior plan existed; ordinary scientific explanation belongs in Experiment Markdown when recording is needed, not only in the run receipt. Separate what was observed, what it means, why it matters, and what happens next.
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
