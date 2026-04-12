# paper.result-bridge

Bridge an experiment result into explicit claim state changes.

## Goal

Persist a result-to-claim bridge event in `.paper/claims/bridge-log.json` so confidence and status updates are reviewable instead of implicit side effects.

## Workflow

1. Read `.paper/experiments/results.json`, `.paper/experiments/audits.json`, `.paper/evidence/index.json`, and `.paper/claims/bridge-log.json`.
2. If `paper-factory` MCP is available, call `bridge_result_to_claim`.
3. Record whether the result supports, refutes, or remains inconclusive for the claim.
4. If the bridge outcome weakens the claim, convert that change into a board blocker, review concern, or revision task before finalization.
