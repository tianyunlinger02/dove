# dove.paper.materialize

Materialize accepted proposal-only guidance into one real durable task packet.

## Goal

Use the explicit materialization path to convert a remediation pack or packet-type execution bridge candidate into a real task packet under `.dove/task-packets/` while recording governed provenance back to the source guidance.

## Workflow

1. Read `.dove/meta/remediation-packs.json`, `.dove/meta/execution-bridge-candidates.json`, `.dove/meta/operator-follow-through.json`, `.dove/task-packets/index.json`, and `.dove/workspace/index.json` first.
2. Choose one narrow path only: create a new task packet from a remediation pack or a packet-type execution bridge candidate that points to `create-new-packet`.
3. If `dove` MCP is available, call `materialize_guidance_packet` with `sourceType`, `sourceId`, `actorRole`, `executeBy`, and `reviewAfter`.
4. Treat materialization as explicit work creation, not execution: the new packet should become visible in the task graph, packet context, workspace index, runtime status surfaces, and follow-through ledger, but it should not be auto-run. `dove autonomy-once` / `run_autonomy_once` may invoke this same governed bridge once when an accepted planned target exists and no eligible packet is already present.
5. If you want planner to supervise a bounded non-planner packet step later, stamp the packet with an explicit worker role envelope during materialization rather than relying on implicit role inference.
6. If the packet should participate in a program-level research operating surface, also stamp `programId`, `programRunId`, `approvalId`, and (when needed) `allowedStepType` during materialization so the runtime can verify an approved program run before any program-linked execution step occurs. The current bounded program-step allowlist is `refresh-research-brief`, `refresh-wiki`, `upsert-note`, `run-experiment-audit`, `bridge-result-to-claim`, and `run-review-loop`.
7. Do not silently reuse a `review-needed` program run after a bounded approved step. Mint a fresh `programRunId` and `approvalId` for the next bounded continuation step.
8. If the packet already exists and you only need to re-arm approval state, use the explicit approval surface instead of materializing another packet.

## Rule

Do not use this command to create duplicate work for guidance that is already bound to a live packet or has been explicitly superseded.
