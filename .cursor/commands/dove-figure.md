---
description: "Gather real materials and create or revise figures and captions."
---

# dove-figure

Gather real materials and create or revise figures and captions.

## Use when

- Gather real materials and create or revise figures and captions.

## Examples

- `/dove:figure`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user requests a figure, diagram, plot, or caption.**
  1. Use host tools (read-only; research-document-reading). If `.dove/research/RESEARCH.md` exists, read it first and follow only the most relevant Markdown links. If it is absent, treat that as normal and inspect ordinary project material instead. Do not require fixed headings, frontmatter, IDs, or a machine index. No file write is required.
  2. Use host tools (work; figure-creation). Gather actual project materials and data, then create or revise the ordinary figure and caption with host-native plotting, image, or editing tools. No file write is required.
  3. Use host tools (read-only; figure-validation). Validate labels, denominators, provenance, legibility, and agreement between the figure, caption, and underlying evidence. No file write is required.
  4. Use host tools (work; research-document-maintenance). Link the figure from the relevant experiment, mission, or overview document only when that link improves future research recovery. Persist only when: research-context-worth-preserving.
  - Clarification: Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary.

## Dove capsule

- Treat `.dove/research/RESEARCH.md` and its linked Markdown as ordinary researcher-owned documents, not a database or machine authority.
- Use host file and research tools directly. Read the overview first when it exists, then only the linked documents and project artifacts relevant to the task.
- Keep failures, adverse evidence, limitations, and uncertainty visible; tests, host output, and any review remain bounded evidence rather than scientific authority.

## Response policy

- Use natural, clear Chinese unless the user requests another language or format; explain internal terms only when needed.
- Before sending, reorganize from the user's perspective into a faithful synthesis. Do not use the internal workflow or structured machine data as the response outline; remove repetition and preserve material failures, limits, uncertainty, and blockers.
- Requested research artifacts and strict machine-readable contracts take priority; otherwise fit the response to the task, not a fixed template.
