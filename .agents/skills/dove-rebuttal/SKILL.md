---
name: dove-rebuttal
description: "Perform author-side rebuttal and revision work from current findings and evidence."
---

# Dove Rebuttal

Perform author-side rebuttal and revision work from current findings and evidence.

## Use when

- Perform author-side rebuttal and revision work from current findings and evidence.

## Examples

- `/dove:rebuttal`

## Workflow

- **The user requests author-side rebuttal or revision from review findings.**
  1. Call `query_dove_research` (read-only). Read review and claim context relevant to the requested response. No durable Dove write is required.
  2. Call `manage_dove_reviews` (read-only). Read coverage or review records needed for the response; do not present author work as independent review. No durable Dove write is required.
  3. Use host tools (work; rebuttal-and-revision). Analyze each finding against the actual artifact and evidence, then write the rebuttal and make requested ordinary project revisions with host-native tools. No durable Dove write is required.
  4. Use host tools (read-only; artifact-validation). Validate that every response maps to a finding and that revisions do not overstate evidence or erase failures and uncertainty. No durable Dove write is required.
  5. Call `manage_dove_claims` (bounded). Persist only material claim changes introduced by the author-side revision. Persist only when: material-claim-change.
  - Clarification: Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary.

## Dove capsule

- Dove MCP tools: `query_dove_research`, `manage_dove_reviews`, `manage_dove_claims`.
- Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.
- Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.
- Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority.
