# paper.draft

Draft or revise the section `$SECTION_NAME` as an implementation-stage writing command.

## Goal

Write evidence-aware manuscript text into `.paper/drafts/$SECTION_SLUG.md` while respecting the current plan, outline, checklist, and any major-change design contract.

## Workflow

1. Read `.paper/context/actions/current.json` when present, then `.paper/state.json`, `.paper/plans/current-plan.md`, `.paper/outline/current-outline.md`, `.paper/checklists/paper.md`, `.paper/notes/index.json`, and `.paper/claims/CLAIMS_FROM_RESULTS.md`.
2. If this is part of a major change, only implement checklist-scoped writing work; do not expand the design, claims, figure set, or experiment interpretation silently.
3. If `paper-factory` MCP is available, call `upsert_draft` after preparing the section body.
4. Keep citation gaps explicit using `TODO[citation]` markers when support is missing.
5. Update section status if the draft materially progresses, and leave the acceptance path visible through checklist/review/version commands.
