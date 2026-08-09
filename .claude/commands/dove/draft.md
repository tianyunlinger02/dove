---
description: "Write or revise ordinary project draft artifacts using current research evidence."
---

# dove.draft

Write or revise ordinary project draft artifacts using current research evidence.

## Use when

- Write or revise ordinary project draft artifacts using current research evidence.

## Examples

- `/dove:draft`

## Workflow

- **The user requests drafting or revision of an ordinary project artifact.**
  1. Call `query_dove_research` (read-only). Read claim-story or other relevant evidence context when durable research exists. No durable Dove write is required.
  2. Use host tools (work; artifact-editing). Read the target and surrounding ordinary project materials, then create or revise the requested draft artifact with normal host editing tools. Keep every claim within the available evidence. No durable Dove write is required.
  3. Use host tools (read-only; artifact-validation). Run the appropriate host-native checks for the artifact and report remaining unsupported claims, citation gaps, and uncertainty. No durable Dove write is required.
  4. Call `manage_dove_claims` (bounded). Persist a Claim change only when the draft work materially changes a durable claim relationship. Persist only when: material-claim-change.
  - Clarification: Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary.

## Dove capsule

- Dove MCP tools: `query_dove_research`, `manage_dove_claims`.
- Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.
- Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.
- Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority.
