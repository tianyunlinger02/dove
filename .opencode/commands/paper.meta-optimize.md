# paper.meta-optimize

Inspect the proposal-only outer-loop optimizer frontier.

## Goal

Read the file-first meta-optimize surfaces that summarize recurring workflow weaknesses, repair patterns, grouped optimization clusters, ranked evidence-backed recommendations, durable remediation packs, execution bridge candidate scaffolds, and longer-horizon workflow memory without auto-applying any change.

## Workflow

1. Read `.paper/meta/LATEST_OPTIMIZER_REPORT.md`, `.paper/meta/recommendations.json`, `.paper/meta/remediation-packs.json`, `.paper/meta/execution-bridge-candidates.json`, `.paper/meta/events.json`, `.paper/meta/optimizer-state.json`, `.paper/meta/long-horizon-memory.json`, and `.paper/workspace/index.json`.
2. If `paper-factory` MCP is available, call `query_meta_optimize`.
3. Start from the grouped frontier, persisted frontier summary, and top-ranked clusters so related workflow debt is evaluated together instead of as a flat list.
4. Use the stable ranking fields (`ranking.method`, `tieBreakOrder`, per-item `sortKey`, and `tieBreakKey`) when comparing repeated runs.
5. Use remediation packs when you want one grouped operator bundle that ties a frontier cluster to taxonomy anchors, review/figure evidence, long-horizon memory, packet/workspace pointers, acceptance criteria, ranked multi-path conversion guidance, readiness coverage, and manual next actions.
6. Use family-level operator playbooks when multiple taxonomy families are active and you need the most specific family-scoped guidance rather than a broad fallback pack; pay attention to readiness coverage, missing ingredients, and the artifact update map before treating a playbook as highly actionable.
7. Use the longer-horizon memory slice to spot persistent clusters, rising recurrence families, or repeated regressions that outlast a single frontier refresh.
8. Use `project:paper.follow-through` or the operator follow-through ledger when you want to record that a pack, playbook, or execution bridge candidate has been acknowledged, deferred, accepted for execution, accepted as risk, or closed.
9. Treat the output as proposal-only guidance: convert strong recommendations, ranked conversion paths, remediation packs, playbooks, or execution bridge candidates into explicit board tasks, revision items, checklist steps, or artifact repairs only when an operator decides to act.
10. Do not auto-patch prompts, configs, code, or workflow files from this surface alone.
