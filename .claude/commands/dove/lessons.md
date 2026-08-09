---
description: "Read or explicitly replace the complete advisory Lessons document."
---

# dove.lessons

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
- Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.
- Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.
- Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority.
