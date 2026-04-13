# paper.meta-optimize

Inspect the proposal-only outer-loop optimizer frontier.

## Goal

Read the file-first meta-optimize surfaces that summarize recurring workflow weaknesses, repair patterns, grouped optimization clusters, ranked evidence-backed recommendations, and longer-horizon workflow memory without auto-applying any change.

## Workflow

1. Read `.paper/meta/LATEST_OPTIMIZER_REPORT.md`, `.paper/meta/recommendations.json`, `.paper/meta/events.json`, `.paper/meta/optimizer-state.json`, `.paper/meta/long-horizon-memory.json`, and `.paper/workspace/index.json`.
2. If `paper-factory` MCP is available, call `query_meta_optimize`.
3. Start from the grouped frontier, persisted frontier summary, and top-ranked clusters so related workflow debt is evaluated together instead of as a flat list.
4. Use the stable ranking fields (`ranking.method`, `tieBreakOrder`, per-item `sortKey`, and `tieBreakKey`) when comparing repeated runs.
5. Use the longer-horizon memory slice to spot persistent clusters, rising recurrence families, or repeated regressions that outlast a single frontier refresh.
6. Treat the output as proposal-only guidance: convert strong recommendations into explicit board tasks, revision items, checklist steps, or artifact repairs only when an operator decides to act.
7. Do not auto-patch prompts, configs, code, or workflow files from this surface alone.
