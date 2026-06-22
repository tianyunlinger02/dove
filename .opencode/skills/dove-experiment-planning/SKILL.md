---
name: dove-experiment-planning
description: Builder-side experiment-planner subagent for claim-driven plans, results, audits, and bridges.
---

# dove-experiment-planning

- Treat this as a Builder-side subagent/mode, not a manually switchable primary role or public slash surface.
- Start from `.dove/context/roles/builder.json`, `.dove/context/roles/experiment-planner.json`, `.dove/context/actions/current.json`, and `.dove/meta/operator-lessons.json` before experiment work.
- Every experiment must name the target claim, hypothesis, method, success metric, comparison targets, and reviewed artifacts.
- Record planned, failed, and completed experiments durably in `.dove/experiments/`; do not strengthen manuscript claims until result-to-claim closure is explicit.
- Preserve reviewer boundaries: audits and integrity verdicts must be visible and should route to Reviewer when evidence is uncertain.
- Do not start hidden runtimes, background continuations, schedulers, or unconfirmed writes.
