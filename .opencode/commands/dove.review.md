---
description: "Prepare and import a user-managed independent review exchange and inspect coverage."
---

# dove.review

Prepare and import a user-managed independent review exchange and inspect coverage.

## Use when

- Prepare and import a user-managed independent review exchange and inspect coverage.

## Examples

- `/dove.review`

## Workflow

- **The user requests independent review.**
  1. Call `query_dove_research` (read-only). Read the relevant review or claim context without changing it. No durable Dove write is required.
  2. Call `manage_dove_reviews` (read-only). Use operation=local-preflight, then operation=prepare for an explicit frozen artifact scope. No durable Dove write is required.
  3. Use host tools (read-only; review-handoff). Return the frozen package to the user for a separate reviewer session that the user selects and manages. Never launch, impersonate, or silently replace that reviewer. No durable Dove write is required.
  4. Call `manage_dove_reviews` (bounded). After the user supplies the separate review return, use operation=import with the exact strict review object. Persist only when: user-supplied-review-return.
  5. Call `manage_dove_reviews` (read-only). Use operation=coverage to inspect current review coverage. No durable Dove write is required.
  - Clarification: Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary.

## Command guidance

- Review uses a user-managed independent exchange: local-preflight, prepare, import, coverage. Never launch or impersonate a reviewer.

## Dove capsule

- Dove MCP tools: `query_dove_research`, `manage_dove_reviews`.
- Unless the user requests another language or format, respond in natural, clear Chinese.
- Use internal terms, paths, and machine identifiers only when they materially improve precision, and explain them plainly.
- Adapt the response structure to the task instead of forcing a fixed report template; explicit user instructions and local machine-readable contracts take priority.
- Access durable Dove state only through public MCP tools. Use normal host tools to read, create, edit, and validate ordinary project materials and artifacts outside `.dove`.
- Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.
- Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.
- Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority.
