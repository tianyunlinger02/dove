# dove.materialize

Materialize accepted proposal-only guidance into one durable Dove task packet.

## Workflow

1. Treat `.dove/` as the authoritative durable root.
2. Read remediation packs, execution bridge candidates, operator follow-through, task packets, and workspace index first.
3. Prefer the `materialize_guidance_packet` MCP tool with explicit `sourceType`, `sourceId`, `actorRole`, `executeBy`, and `reviewAfter`.
4. Create at most one packet from one accepted source; do not execute the packet.
5. Preserve provenance back to the source guidance and avoid duplicates for guidance already bound to live work.
