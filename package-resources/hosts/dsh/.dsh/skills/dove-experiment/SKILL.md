---
name: dove-experiment
description: "Use when empirical design, execution, existing-result analysis, or local run receipts can advance a research decision by resolving a real uncertainty."
---

# Dove Experiment

Use when empirical design, execution, existing-result analysis, or local run receipts can advance a research decision by resolving a real uncertainty.

## Research judgment

Start from the real research question, user need, key uncertainty, current or provisional route, and decision that matters. Compare serious mechanisms or approaches by assumptions, applicability, predictions, inspected evidence, and failure conditions. Use claim-driven experiments or diagnostics when they can distinguish the strongest alternatives, and check anomalous results before using them as evidence. State facts from inspected material, keep conclusions within the tested or read conditions, and preserve claim strength unless evidence or the user changes it. Absorb each material result into the route, paper spine, claim scope, or next action before continuing. Answer and stop for pure judgment or bounded requests; continue useful in-scope work when the user has confirmed a research goal.

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
- Design the experiment around the real problem, key uncertainty, route decision, primary prediction, strongest alternative, minimum sufficient evidence, and how different outcomes would change the judgment. For design-only work, stop with an executable plan. For retrospective recording, label the record retrospective.
- Execute only when requested and permitted, or inspect existing results when analysis is requested. For Dove-managed local executions, use the corresponding `.dove/runs/` run journal and its stdout/stderr paths as inspected execution materials rather than invented run summaries; the receipt does not replace Experiment Markdown explanation. State methods, configuration, data, metrics, run counts, and result numbers from actual code, logs, outputs, data files, user material, or run receipts. For negative, near-miss, anomalous, unusually strong, or hard-to-reproduce results, compare expected and actual behavior and check implementation, data, configuration, baselines, randomness, metrics, and analysis before using them as evidence. When recording is needed, append the actual procedure, result, interpretation-changing deviation, evidence scope, and route update to the same Experiment document used for the plan; ordinary scientific explanation still belongs in Experiment Markdown, not only in the run receipt. Separate what was observed, what it means, why it matters, and what happens next.
- When the maintenance trigger is met, record the experiment, diagnostic, result, failure, evidence scope, route decision, and useful project-relative logs, data, output, the corresponding `.dove/runs/` run journal, figure, or code paths in the relevant Experiment document, linking affected Claim, Source, or Figure context only when useful for recovery. Use ordinary Markdown links and readable project-relative artifact paths only when useful for recovery, and keep the note as human prose rather than a structured store. Update only the narrowest relevant research document. Update `.dove/research/experiments/EXPERIMENTS.md` only when its own links or synthesis materially change. Update `.dove/research/RESEARCH.md` only for a project-level mainline, conclusion, navigation, or priority change.

### What this should not replace

- Do not synthesize a prospective plan after execution or disguise retrospective notes as prior design.
- Do not run a convenient proxy experiment that cannot affect the research decision.
- Do not treat a diagnostic as evidence beyond the conditions actually tested.

### When Dove needs input

- Ask only when ambiguity in intent, target artifact, evaluation criteria, scope, or a key tradeoff would change the next useful action. If active research context implies a feasible follow-up, do that next step rather than merely suggesting it.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- In DSH, work from project-local files and whatever tools the current run actually exposes.

### Return with

- Inspected evidence, material change, unresolved limits, and the next useful action.
