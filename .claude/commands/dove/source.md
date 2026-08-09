---
description: "Discover external material and manage captured source candidates."
---

# dove.source

Discover external material and manage captured source candidates.

## Use when

- Discover external material and manage captured source candidates.

## Examples

- `/dove:source`

## Workflow

- **The user requests source discovery, reading, comparison, or verification.**
  1. Call `query_dove_research` (read-only). Read related-work or claim context only when durable context is relevant. No durable Dove write is required.
  2. Use host tools (read-only; source-research). Discover, retrieve, read, and verify the real material with host-native project or external research tools. Distinguish what was inspected from what was actually used. No durable Dove write is required.
  3. Call `manage_dove_sources` (bounded). Record only a Source that was actually used and needs a durable citation or evidence relationship; preserve conditions, conflicts, and limitations. Persist only when: actual-source-used.
  - Clarification: Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary.

## Dove capsule

- Dove MCP tools: `query_dove_research`, `manage_dove_sources`.
- Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.
- Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.
- Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority.
