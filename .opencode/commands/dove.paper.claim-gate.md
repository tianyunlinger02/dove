# dove.paper.claim-gate

Promote results into claims only when the evidence supports them.

## Goal

Update `.dove/evidence/index.json` and `.dove/claims/CLAIMS_FROM_RESULTS.md` with claims that are explicitly linked to source IDs and note IDs.

## Workflow

1. Read `.dove/findings.md`, `.dove/notes/index.json`, `.dove/sources/index.json`, and the relevant draft files.
2. If `dove` MCP is available, call `upsert_claims`.
3. Label weak or unsupported claims honestly and surface the gap.
4. Return the strongest supported claims plus the weakest unresolved ones.
