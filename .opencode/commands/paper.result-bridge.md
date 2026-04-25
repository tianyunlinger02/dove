# paper.result-bridge

Bridge an experiment result into explicit claim state changes.

## Goal

Persist a result-to-claim bridge event in `.paper/claims/bridge-log.json` so confidence and status updates are reviewable instead of implicit side effects.

## Workflow

1. Read `.paper/experiments/results.json`, `.paper/experiments/audits.json`, `.paper/evidence/index.json`, and `.paper/claims/bridge-log.json`.
2. If `paper-factory` MCP is available, call `bridge_result_to_claim`.
3. Record whether the result supports, refutes, remains inconclusive, or is held for review because audit integrity is still incomplete.
4. If the bridge outcome weakens the claim or is held for review, convert that change into a board blocker, review concern, or revision task before finalization.
5. When this step is run through bounded autonomy, carry `allowedStepType: bridge-result-to-claim` plus an explicit `resultId` payload and optional `auditIds` through materialization/approval rather than invoking a free-form bridge.
