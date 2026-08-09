---
description: "Read the current research projection without writes."
---

# dove.status

Read the current research projection without writes.

## Use when

- Read the current research projection without writes.

## Examples

- `/dove:status`

## Workflow

- **The user requests current Dove research status.**
  1. Call `query_dove_research` (read-only). Read the smallest relevant projection and report it without changing Dove state or ordinary project files. No durable Dove write is required.

## Dove capsule

- Dove MCP tools: `query_dove_research`.
- Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.
- Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.
- Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority.
