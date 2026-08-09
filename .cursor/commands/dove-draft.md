---
description: "Write or revise ordinary project draft artifacts using current research evidence."
---

# dove-draft

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
- Unless the user requests another language or format, respond in natural, clear Chinese.
- Use internal terms, paths, and machine identifiers only when they materially improve precision, and explain them plainly.
- Adapt the response structure to the task instead of forcing a fixed report template; explicit user instructions and local machine-readable contracts take priority.
- Access durable Dove state only through public MCP tools. Use normal host tools to read, create, edit, and validate ordinary project materials and artifacts outside `.dove`.
- Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.
- Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.
- Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority.
