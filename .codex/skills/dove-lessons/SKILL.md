---
name: dove-lessons
description: "Read or explicitly replace the complete advisory Lessons document."
---

# Dove Lessons

Read or explicitly replace the complete advisory Lessons document.

## Use when

- Read or explicitly replace the complete advisory Lessons document.

## Examples

- `/dove:lessons`

## Workflow

- **The user requests Lessons reading, remembering, or reflection.**
  1. Call `manage_dove_lessons` (bounded). For reading, use operation=read. For an explicit remember or reflection request, read the complete Markdown, preserve its current structure, integrate only supported reusable guidance, and use operation=replace with the full replacement document. Persist only when: explicit-replace-request.
  - Clarification: Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary.

## Dove capsule

- Dove MCP tools: `manage_dove_lessons`.
- Unless the user requests another language or format, respond in natural, clear Chinese.
- Use internal terms, paths, and machine identifiers only when they materially improve precision, and explain them plainly.
- Adapt the response structure to the task instead of forcing a fixed report template; explicit user instructions and local machine-readable contracts take priority.
- Access durable Dove state only through public MCP tools. Use normal host tools to read, create, edit, and validate ordinary project materials and artifacts outside `.dove`.
- Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.
- Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.
- Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority.
