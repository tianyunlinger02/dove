# paper.claim-gate

Promote results into claims only when the evidence supports them.

## Goal

Update `.paper/evidence/index.json` and `.paper/claims/CLAIMS_FROM_RESULTS.md` with claims that are explicitly linked to source IDs and note IDs.

## Workflow

1. Read `.paper/findings.md`, `.paper/notes/index.json`, `.paper/sources/index.json`, and the relevant draft files.
2. If `paper-factory` MCP is available, call `upsert_claims`.
3. Label weak or unsupported claims honestly and surface the gap.
4. Return the strongest supported claims plus the weakest unresolved ones.
