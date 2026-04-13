# paper.meta-optimize

Inspect the proposal-only outer-loop optimizer frontier.

## Goal

Read the file-first meta-optimize surfaces that summarize recurring workflow weaknesses, repair patterns, and evidence-backed recommendations without auto-applying any change.

## Workflow

1. Read `.paper/meta/LATEST_OPTIMIZER_REPORT.md`, `.paper/meta/recommendations.json`, `.paper/meta/events.json`, `.paper/meta/optimizer-state.json`, and `.paper/workspace/index.json`.
2. If `paper-factory` MCP is available, call `query_meta_optimize`.
3. Treat the output as proposal-only guidance: convert strong recommendations into explicit board tasks, revision items, checklist steps, or artifact repairs only when an operator decides to act.
4. Do not auto-patch prompts, configs, code, or workflow files from this surface alone.
