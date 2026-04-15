# Latest optimizer report

- Proposal only: true
- Generated: 2026-04-15T06:50:06.480Z
- Meta-optimize frontier: 1 recommendations across 1 clusters (0 critical, score 64)
- Meta-optimize frontier summary: 1 ranked recommendations across 1 deterministic clusters (0 critical, frontier score 64). Top clusters: queue-discipline.
- Meta-optimize top clusters: queue-discipline
- Meta-optimize taxonomy pressure: No typed wiki taxonomy pressure is currently active in the optimizer frontier.
- Meta-optimize top taxonomy families: none
- Meta-optimize top taxonomy groups: none
- Meta-optimize pressure areas: none
- Remediation packs: 1 proposal-only packs (remediation-pack-queue-discipline)
- Remediation pack focus: 1 proposal-only remediation packs summarize the current repair frontier and optimizer clusters into grouped, evidence-backed operator bundles.
- Remediation pack readiness: 0 actionable, 1 partially actionable, 0 advisory-only remediation packs.
- Remediation packs path: .paper/meta/remediation-packs.json
- Operator follow-through: 0 records (none)
- Operator follow-through overview: No operator follow-through decisions have been recorded yet.
- Operator follow-through debt: overdue=0, deferred-due=0, stale=0, invalid=0, action-required=0
- Operator follow-through execution window: due-soon=0, due-review=0, critical-overdue=0
- Operator follow-through path: .paper/meta/operator-follow-through.json
- Governance coverage: 25 guarded / 10 exempt
- Governance coverage overview: 25 write paths currently require clear operator follow-through; 10 paths remain explicitly exempt.
- Governance coverage path: .paper/meta/governance-coverage.json
- Execution bridge candidates: 1 proposal-only candidates (candidate-remediation-pack-queue-discipline-create-new-packet-task-queue-discipline)
- Execution bridge focus: 1 proposal-only execution bridge candidates translate remediation packs and playbooks into likely manual work-item shapes without creating anything automatically.
- Execution bridge path: .paper/meta/execution-bridge-candidates.json
- Family playbooks: 0 proposal-only playbooks (none)
- Family playbook focus: No proposal-only family-level operator playbooks have been generated yet.
- Family playbook readiness: No proposal-only family-level operator playbooks have been generated yet.
- Family playbooks path: .paper/meta/operator-playbooks.json
- Long-horizon memory: 1 long-horizon workflow families across 10 optimizer snapshots. Top families: workflow-churn.
- Long-horizon snapshots: 10
- Long-horizon last action: unchanged
- Long-horizon last observed: 2026-04-13T12:46:29.151Z
- Long-horizon top families: workflow-churn
- Long-horizon taxonomy families: none
- Long-horizon taxonomy groups: none
- Meta-optimize report: .paper/meta/LATEST_OPTIMIZER_REPORT.md
- Long-horizon memory path: .paper/meta/long-horizon-memory.json
- Active signal types: session-journal
- Ranking method: durable-signal-frontier-v1
- Stable tie-break order: score-desc, priority-rank, cluster-rank, cluster-id, category, id
- Long-horizon history policy: deterministic-noop-drift-guard-v1 (unchanged: Canonical frontier and long-horizon state were unchanged, so no new snapshot was added.)
- Board phase: init
- Board role: planner

## Optimization frontier

### 1. Queue discipline [low]
- Cluster id: queue-discipline
- Summary: Queue churn and repeated workflow activity that suggest coordination debt is accumulating.
- Operator goal: Reduce stale work and coordination churn before expanding concurrent work.
- Recommendation count: 1
- Cluster score: 64
- Cluster sort key: 03:999935:queue-discipline
- Top recommendation: meta-journal-query-workspace-index
- Response owners: planner
- Signal types: session-journal
- Taxonomy pressure: No typed wiki taxonomy pressure is active in this optimizer surface.
- Evidence artifacts: .paper/sessions/journal.json
- Membership: meta-journal-query-workspace-index

## Evidence-backed recommendations

### Cluster 1: Queue discipline
#### 1. meta-journal-query-workspace-index [low]
- Cluster: Queue discipline
- Category: workflow-observability
- Scope: session/workflow observability
- Summary: Inspect whether repeated query-workspace-index actions indicate workflow churn.
- Why: The journal shows 26 recent query-workspace-index events, which can be a signal that operators are repeatedly refreshing or repairing the same surface instead of closing a durable issue.
- Next action: Inspect the newest query-workspace-index entries in .paper/sessions/journal.json and decide whether a narrower checklist, artifact rule, or review checkpoint should make the next step more explicit.
- Score: 64
- Ranking basis: priority=low, recurrence=6, evidenceDensity=2, crossSessionRecurrence=6, repairFrontierOverlap=0, auditCriticality=0, bridgeCriticality=0, queueChurn=0, taxonomyFamilyPressure=0, taxonomyGroupPressure=0
- Signal strength: recurrence=6 evidence=2 cross-session=6 repair=0 audit=0 bridge=0 queue=0 taxonomy-family=0 taxonomy-group=0
- Taxonomy pressure: No typed wiki taxonomy pressure is active in this optimizer surface.
- Evidence artifacts: .paper/sessions/journal.json
- Evidence ids: query-workspace-index
- Response owner: planner
- Stable sort key: 9935:03:01:queue-discipline:workflow-observability:meta-journal-query-workspace-index
- Stable tie-break key: 9935:03:queue-discipline:workflow-observability:meta-journal-query-workspace-index

## Remediation packs

### 1. Queue discipline remediation pack [low]
- Pack id: remediation-pack-queue-discipline
- Cluster: queue-discipline
- Summary: Queue churn and repeated workflow activity that suggest coordination debt is accumulating. This pack keeps the cluster's repair frontier, evidence links, taxonomy anchors, and manual next steps together for operator review.
- Taxonomy anchors: No typed wiki taxonomy pressure is active in this optimizer surface.
- Linked review concerns: none
- Linked figure QA: none
- Long-horizon memory: workflow-churn
- Packet pointers: none
- Workspace pointers: .paper/context/actions/current.json, .paper/context/phases/init.json, .paper/context/roles/planner.json, .paper/meta/LATEST_OPTIMIZER_REPORT.md, .paper/meta/long-horizon-memory.json, .paper/meta/recommendations.json, .paper/meta/remediation-packs.json, .paper/sessions/journal.json, .paper/sessions/LATEST_SUMMARY.md, .paper/wiki/navigation.md, .paper/workspace/index.json
- Readiness: partially-actionable (Partially actionable guidance: 1 ranked conversion paths, 1 acceptance criteria, missing packet-pointers, repair-frontier-links.)
- Missing ingredients: packet-pointers, repair-frontier-links
- Acceptance criteria: Confirm long-horizon memory pressure has stopped rising or is explicitly accepted as ongoing debt.
- Conversion hints: create-new-packet:task-queue-discipline
- Ranked conversion paths: 1:primary:create-new-packet:task-queue-discipline
- Manual next actions: Inspect the newest query-workspace-index entries in .paper/sessions/journal.json and decide whether a narrower checklist, artifact rule, or review checkpoint should make the next step more explicit. | Read .paper/meta/LATEST_OPTIMIZER_REPORT.md and inspect cluster queue-discipline before changing any workflow artifact.

## Family-level operator playbooks

- No family-level operator playbooks generated from the current durable signals.
## Execution bridge candidate scaffolds

### 1. Queue discipline remediation work
- Candidate id: candidate-remediation-pack-queue-discipline-create-new-packet-task-queue-discipline
- Candidate type: packet-candidate
- Target artifact: .paper/task-packets/index.json
- Summary: Queue churn and repeated workflow activity that suggest coordination debt is accumulating. This pack keeps the cluster's repair frontier, evidence links, taxonomy anchors, and manual next steps together for operator review. Proposed as a packet-candidate from remediation pack remediation-pack-queue-discipline; review manually before creating any real work item.
- Suggested next step: Inspect the newest query-workspace-index entries in .paper/sessions/journal.json and decide whether a narrower checklist, artifact rule, or review checkpoint should make the next step more explicit.
- Source remediation packs: remediation-pack-queue-discipline
- Source playbooks: none
- Linked packet pointers: none
- Workspace pointers: .paper/context/actions/current.json, .paper/context/phases/init.json, .paper/context/roles/planner.json, .paper/meta/LATEST_OPTIMIZER_REPORT.md, .paper/meta/long-horizon-memory.json, .paper/meta/recommendations.json
- Evidence summary: artifacts=.paper/sessions/journal.json ids=query-workspace-index
- Repair summary: repairs=none reviews=none figures=none
- Linked repair items: none
- Acceptance criteria: Confirm long-horizon memory pressure has stopped rising or is explicitly accepted as ongoing debt.

## Governance coverage matrix

- Overview: 25 write paths currently require clear operator follow-through; 10 paths remain explicitly exempt.
- Guarded mutations: 25
- Exempt mutations: 10
  - guarded upsert-orchestration-board: Updating the orchestration board -> .paper/orchestration/board.json
  - guarded append-handoff: Appending a durable handoff -> .paper/orchestration/handoffs.md
  - guarded register-source: Registering a source -> .paper/sources/index.json
  - guarded upsert-note: Recording a structured note -> .paper/notes/index.json
  - guarded upsert-claims: Updating evidence-backed claims -> .paper/evidence/index.json
  - guarded upsert-plan: Updating the paper plan -> .paper/plans/current-plan.md
  - guarded upsert-outline: Updating the paper outline -> .paper/outline/current-outline.md
  - guarded upsert-draft: Updating a draft section -> .paper/drafts
  - guarded set-section-status: Updating a section status -> .paper/state.json
  - guarded upsert-figure-plan: Updating the figure plan -> .paper/figures/index.json
  - guarded sync-citations: Updating citation artifacts -> .paper/bibliography/citation-log.md
  - guarded refresh-wiki: Refreshing the wiki -> .paper/wiki/index.md
  - exempt record-operator-follow-through: Recording follow-through decisions remains explicitly exempt so the governance system can be updated while debt exists. -> .paper/meta/operator-follow-through.json
  - exempt query-meta-optimize: Refreshing proposal-only optimizer surfaces remains exempt because it is part of debt detection, not debt execution. -> .paper/meta/LATEST_OPTIMIZER_REPORT.md
  - exempt init-project: Project initialization bootstraps the workspace and is explicitly exempt from follow-through gating. -> .paper/state.json
  - exempt sync-checklist: Checklist syncing remains exempt because it summarizes debt instead of executing it. -> .paper/checklists/paper.md
  - exempt validate-figure-pipeline: Figure validation is an inspection path and remains exempt from follow-through execution gating. -> .paper/figures/qa.json
  - exempt classify-workflow-intent: Workflow intent classification is analytical and remains exempt. -> .paper/meta/recommendations.json

## Long-horizon workflow memory

### Workflow churn [rising]
- Family id: workflow-churn
- Summary: Queue and observability work keeps repeating instead of closing out cleanly.
- Current recommendation count: 1
- Total observations: 14
- Active snapshots: 10
- Trend: recent=9 previous=5
- Taxonomy families: none
- Taxonomy groups: none
- Pressure areas: none
- Top recommendations: meta-journal-query-workspace-index, meta-journal-query-meta-optimize
- Top clusters: queue-discipline
- Evidence artifacts: .paper/sessions/journal.json

## Signal observations

- [low] session-journal: Recent session journal repeated query-workspace-index 26 times.

## Explicit non-goals

- This layer does not auto-apply workflow, prompt, code, or config changes.
- This layer only summarizes durable signals and recommends explicit next steps.
- Operators must choose whether to act on any recommendation.