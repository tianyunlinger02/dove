---
description: "Gather materials and create ordinary project figure artifacts with captions."
---

# dove.figure

Gather materials and create ordinary project figure artifacts with captions.

## Use when

- Gather materials and create ordinary project figure artifacts with captions.

## Examples

- `/dove:figure`

## Workflow

- **The user requests a figure, diagram, plot, or caption.**
  1. Call `query_dove_research` (read-only). Read the relevant evidence, source, or result synthesis when durable context exists. No durable Dove write is required.
  2. Use host tools (work; figure-creation). Gather actual project materials and data, then create or revise the ordinary figure artifact and its caption with host-native plotting, image, or editing tools. No durable Dove write is required.
  3. Use host tools (read-only; figure-validation). Validate labels, denominators, provenance, legibility, and agreement between the figure, caption, and underlying evidence. No durable Dove write is required.
  4. Call `manage_dove_sources` (bounded). Record a newly used Source only when a durable reference is needed. Persist only when: actual-source-used.
  5. Call `manage_dove_experiments` (bounded). Record an experiment result only when the figure is based on a result that needs durable preservation. Persist only when: durable-result-needed.
  - Clarification: Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary.

## Dove capsule

- Dove MCP tools: `query_dove_research`, `manage_dove_sources`, `manage_dove_experiments`.
- Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.
- Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.
- Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority.
