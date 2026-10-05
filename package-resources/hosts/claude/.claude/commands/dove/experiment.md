---
description: "Develop with ground truth and quick reruns; freeze and register only the final heldout confirmation."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.experiment

Develop with ground truth and quick reruns; freeze and register only the final heldout confirmation.

## Request

$ARGUMENTS

## Examples

- `/dove:experiment`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template. Quality grades judge substantive merit within scope; evidence confidence and completed work are separate, not stages that automatically promote quality.

### What this is for

Run and interpret experiments within a round.

### When to use

Use for development, diagnostics, confirmation, reproduction or existing-result analysis.

### Scope and changes

- Read-only or design-only requests do not execute. Heldout used for tuning is no longer independent final evidence.

### Ways Dove may proceed

- Use actual outputs and failure denominators; fix known causes and use suitable available compute. Put results in the round result and EVAL.md, preserving predictions; do not add experiments/ records.

### When Dove needs input

- Ask when unresolved ambiguity in the goal, artifact, evaluation, scope or key tradeoff would materially change the next action; otherwise use reasonable in-scope defaults.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.

### Return with

- The author main session applies scoped results to actual work and downstream use within the user's goal and latest corrections. A bounded subagent returns evidence without taking over the goal; subtask completion is not goal completion.
