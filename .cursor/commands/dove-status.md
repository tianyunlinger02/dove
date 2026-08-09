---
description: "Read the current research projection without writes."
---

# dove-status

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
- Unless the user requests another language or format, respond in natural, clear Chinese.
- Use internal terms, paths, and machine identifiers only when they materially improve precision, and explain them plainly.
- Adapt the response structure to the task instead of forcing a fixed report template; explicit user instructions and local machine-readable contracts take priority.
- Access durable Dove state only through public MCP tools. Use normal host tools to read, create, edit, and validate ordinary project materials and artifacts outside `.dove`.
- Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.
- Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.
- Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority.
