# paper.draft

Draft or revise the section `$SECTION_NAME`.

## Goal

Write evidence-aware manuscript text into `.paper/drafts/$SECTION_SLUG.md`.

## Workflow

1. Read `.paper/state.json`, `.paper/plans/current-plan.md`, `.paper/outline/current-outline.md`, `.paper/notes/index.json`, and `.paper/claims/CLAIMS_FROM_RESULTS.md`.
2. If `paper-factory` MCP is available, call `upsert_draft` after preparing the section body.
3. Keep citation gaps explicit using `TODO[citation]` markers when support is missing.
4. Update section status if the draft materially progresses.
