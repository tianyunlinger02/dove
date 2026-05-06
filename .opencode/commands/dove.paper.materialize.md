# dove.paper.materialize

Materialize accepted paper-domain proposal guidance into one durable Dove task packet.

## Goal

Use `project:dove.materialize` semantics, scoped to paper remediation packs, paper execution bridge candidates, review concerns, figure QA, claims/citations, experiments, rebuttal, or version work.

## Workflow

1. Read `.dove/meta/remediation-packs.json`, `.dove/meta/execution-bridge-candidates.json`, `.dove/meta/operator-follow-through.json`, `.dove/task-packets/index.json`, and `.dove/workspace/index.json` first.
2. Choose one narrow paper-domain path only: create a new task packet from an accepted remediation pack or packet-type execution bridge candidate that points to `create-new-packet`.
3. If `dove` MCP is available, call `materialize_guidance_packet` with `sourceType`, `sourceId`, `actorRole`, `executeBy`, and `reviewAfter`.
4. Treat materialization as explicit work creation, not execution: the new packet should become visible in the generic task graph, paper task-graph view, packet context, workspace index, runtime status surfaces, and follow-through ledger.
5. Preserve worker-role and program approval envelopes when the packet is intended for bounded autonomy.

## Rule

This is a paper-domain view of `project:dove.materialize`. Do not create duplicate work for guidance already bound to live packets or explicitly superseded.
