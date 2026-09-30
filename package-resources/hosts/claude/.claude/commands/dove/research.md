---
description: "Use when a confirmed or provisional research goal needs Dove to choose and carry out the next substantive in-scope action."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.research

Use when a confirmed or provisional research goal needs Dove to choose and carry out the next substantive in-scope action.

## Request

$ARGUMENTS

## Examples

- `/dove:research`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template. Quality grades judge substantive merit within scope; evidence confidence and completed work are separate, not stages that automatically promote quality.

### What this is for

Advance the user's real research goal through method, implementation, evidence and delivery.

### When to use

Use for an open research goal or a bounded research question; keep their completion conditions distinct.

### What Dove will examine

- For a user-confirmed open goal, keep doing core work until the goal is met or a hard blocker remains: missing user resources, a material user decision, or an actual error that cannot be repaired. A diagnosis, record, low-information interval, or failed local attempt is not completion. A separate bounded or read-only request finishes at its requested answer; it does not cancel an existing goal.
- Read the short project identity card and current user correction before planning or delegating. Do not substitute a convenient component or a developer test prompt for the actual goal. When adopting a new method, design its mechanism, public baselines and data, training and evaluation route, and a concrete predicted example; reason whether it could beat the baseline before investing. Revisit after repeated no-signal rounds.
- Development may use available ground truth and rapid reruns without a frozen bank or prior Experiment document; save a prospective protocol and keep heldout independent only for final confirmation. Known root cause calls for a method change, missing prerequisite calls for solving it. A diagnostic is for choosing between actual repairs.
- After important results, rate the eight applicable quality dimensions and write one short Quality line in the card; act on the weakest decision-changing gap, not an arbitrary lowest grade or unknown. With a submission goal, work backwards from the paper claim and periodically use Review to drop work that cannot support it. Answer progress questions plainly and return to the active goal.

### Scope and changes

- Maintain Dove research Markdown other than Lessons only when the user explicitly asks to record, update, or save Dove research context, the result clearly changes a conclusion, route decision, or priority within the confirmed goal, or preserving the work's evidence and continuation context is genuinely useful.

### Ways Dove may proceed

- Before the first consequential choice for the current request, or after a user correction or recurring repair or failure exposes a possibly shared mistaken premise, read ".dove/research/lessons/LESSONS.md" once if it exists unless it has already been checked for this question in the active context, then only directly relevant or plausibly decision-changing linked Lessons. Reuse still-applicable Lessons instead of rereading them mechanically. Read ".dove/research/RESEARCH.md" separately only when project context is still needed; it is not a prerequisite for Lessons. If Lessons materials are absent, continue without creating them. Treat Lessons as fallible guidance, never as evidence. Ordinary deterministic local work has no Lessons prerequisite.
- Check the project identity card against the user's latest words; correct only affected fields without replacing an explicitly no-write request. Route and next-action updates do not rewrite the confirmed Mainline. Rejudge affected work after results, change the real method, artifact and downstream use, then carry out the next core action. A saved old plan or local test green light does not choose the route.
- Preserve useful work and evidence in ordinary project files; keep RESEARCH.md a short entry and the identity card a short current anchor. Stop the open goal only at its completion, a missing user resource or decision, or an actual error that cannot be repaired; do not delete a user-created goal or loop. For a bounded question, answer it within scope.

### What this should not replace

- Do not treat status, a diagnosis, a Lesson, or a running training job as completion of the open goal.
- Do not create a separate autonomy Skill, mandatory research ledger, or one-chance development experiment.

### When Dove needs input

- Ask only when ambiguity in intent, target artifact, evaluation criteria, scope, or a key tradeoff cannot be resolved from available context or reasonable in-scope defaults that leave the core research judgment unchanged and would materially change the next useful action. If active research context implies a feasible follow-up, do that next step rather than merely suggesting it.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- When a run is active, use the wait for real completion while pursuing an independent core dependency.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.
- Keep the main session's native goal and loop; its wake acts on a core task rather than merely waiting.

### Return with

- The main session checks capability and subagent results against the user’s original goal, actual evidence, and latest corrections. Apply material findings to the real working artifact and downstream use, then do the next core action; a completed subtask is not a completed goal. A bounded subagent reports its scoped evidence and does not expand the task.
