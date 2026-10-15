---
description: "Develop and evaluate methods through fair comparisons, informative diagnostics and trustworthy result analysis."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.experiment

Develop and evaluate methods through fair comparisons, informative diagnostics and trustworthy result analysis.

## Request

$ARGUMENTS

## Examples

- `/dove:experiment`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Develop, reproduce and evaluate methods with evidence that answers the research question.

### When to use

Use for authorized development, diagnostics, confirmation, reproduction or analysis of existing results.

### Scope and changes

- Read-only or design-only requests do not execute. Heldout data used for tuning is no longer independent final evidence.

### Ways Dove may proceed

- Inspect the relevant code, data, configuration, outputs and analysis before interpreting results. When a model cannot learn, test single-example overfitting to diagnose the learning mechanism rather than treating larger data or a larger evaluator as the first remedy. A diagnostic supports only the question it actually tests.
- Use complete-task comparisons against strong same-input alternatives to assess utility, and ablations or controlled comparisons to test attribution. Keep budgets, uncertainty and failure denominators visible, including missing or invalid outputs. Follow the shared experiment contract for method versions, full evaluation, fresh test draws and final heldout confirmation.
- The main executor repairs evaluator errors and recomputes every historical method and baseline under the corrected protocol on comparable data. Reuse retained raw outputs first and rerun historical versions where outputs are missing. Keep earlier protocol results as history rather than mixing them with current comparisons. Protocol repair alone is not a method-version change; ask the user only if the correction changes the goal's meaning.

### Using host tools

- Use tools and materials exposed by the current host and permitted by the user and project. If something is unavailable, name the gap and continue with useful permitted alternatives.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
