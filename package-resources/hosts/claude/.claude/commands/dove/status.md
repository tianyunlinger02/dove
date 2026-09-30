---
description: "Use when the user asks where the research stands, without turning software health, receipts, or navigation into research progress."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.status

Use when the user asks where the research stands, without turning software health, receipts, or navigation into research progress.

## Request

$ARGUMENTS

## Examples

- `/dove:status`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template. Quality grades judge substantive merit within scope; evidence confidence and completed work are separate, not stages that automatically promote quality.

### What this is for

Explain the current research position in plain language.

### When to use

Use when the user asks where the research stands, why it stopped, or what is being done next.

### What Dove will examine

- Answer plainly: what are we trying to make, is the core claim proved, what blocks it, and what core work is underway. Use actual evidence, not internal IDs or completion counts; give an evidence caveat briefly when needed.

### Scope and changes

- A material user correction updates only affected identity-card fields even during assessment, not an unchanged Mainline; an explicit no-write instruction or host refusal still prohibits that write.

### Ways Dove may proceed

- Read the short project identity card when present, then only directly relevant evidence and the user's latest corrections. Note a conflict rather than silently promoting an old note or a test prompt to user confirmation. Return control to the ongoing mainline after answering; do not alter a user-created goal or loop.

### What this should not replace

- Do not turn a status question into a new scientific route, or count a run receipt as proof of the core.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.

### Return with

- The main session checks capability and subagent results against the user’s original goal, actual evidence, and latest corrections. Apply material findings to the real working artifact and downstream use, then do the next core action; a completed subtask is not a completed goal. A bounded subagent reports its scoped evidence and does not expand the task.
