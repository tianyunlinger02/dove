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
- During development, keep code changes and diagnostic results traceable and choose tests that answer the key unknown, rather than requiring complete evaluation after every edit. Before formal comparison, result adoption or paper claims, evaluate the current method version under the full applicable protocol and all confirmed user metrics. Unmeasured effects remain unknown; a new version does not inherit an earlier version's passing conclusion.
- Use complete-task comparisons against strong same-input alternatives to assess utility, and ablations or controlled comparisons to test attribution. Keep budgets, uncertainty and failure denominators visible, including missing or invalid outputs. Follow the shared experiment contract for method versions, fresh unused test draws for formal comparisons when methods change after test use, and final heldout confirmation.
- The main executor repairs evaluator errors and immediately marks all affected results. Restore comparability for the current claim, necessary historical comparisons and strong baselines under the corrected protocol, reusing retained raw outputs before rerunning needed versions. Results not used in the current judgment may remain clearly labeled old-protocol history until needed; restore their comparability before using them again. Do not require every historical method to rerun first, mix protocols or hide valid negative evidence. Protocol repair alone is not a method-version change; ask the user if the correction changes the goal's meaning.

### Using host tools

- Use tools and materials exposed by the current host and permitted by the user and project. If something is unavailable, name the gap and continue with useful permitted alternatives.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
