---
description: "Perform author-side rebuttal and revision work from current findings and evidence."
---

# dove-rebuttal

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
- Unless the user requests another language or format, respond in natural, clear Chinese.
- Use internal terms, paths, and machine identifiers only when they materially improve precision, and explain them plainly.
- Adapt the response structure to the task instead of forcing a fixed report template; explicit user instructions and local machine-readable contracts take priority.
- Access durable Dove state only through public MCP tools. Use normal host tools to read, create, edit, and validate ordinary project materials and artifacts outside `.dove`.
- Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.
- Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.
- Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority.
