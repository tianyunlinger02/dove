# dove.paper.draft

Draft or revise the section `$SECTION_NAME` as an implementation-stage writing command.

## Goal

Write evidence-aware manuscript text into `.dove/drafts/$SECTION_SLUG.md` while respecting the current plan, outline, checklist, and any major-change design contract.

## Workflow

1. Read `.dove/context/actions/current.json` when present, then `.dove/state.json`, `.dove/plans/current-plan.md`, `.dove/outline/current-outline.md`, `.dove/checklists/paper.md`, `.dove/notes/index.json`, and `.dove/claims/CLAIMS_FROM_RESULTS.md`.
2. If this is part of a major change, only implement checklist-scoped writing work; do not expand the design, claims, figure set, or experiment interpretation silently.
3. If `dove` MCP is available, call `upsert_draft` after preparing the section body.
4. Keep citation gaps explicit using `TODO[citation]` markers when support is missing.
5. Update section status if the draft materially progresses, and leave the acceptance path visible through checklist/review/version commands.
