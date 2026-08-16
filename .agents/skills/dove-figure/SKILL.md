---
name: dove-figure
description: "Gather real materials and create or revise figures and captions."
---

# Dove Figure

Gather real materials and create or revise figures and captions.

## Examples

- `/dove:figure`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user requests a figure, diagram, plot, or caption.**
  1. Use host tools (read-only; research-document-reading). When existing Dove research context would materially help the requested figure, read `.dove/research/RESEARCH.md`, then the directly relevant Mission or Experiment summary, then only needed linked details. Otherwise work directly from the user's requested materials and data. Do not recursively scan the research tree. This step is read-only; do not create or modify files.
  2. Use host tools (read-only; lesson-reading). When reusable guidance may help the current task, read `.dove/research/lessons/LESSONS.md`, then only the naturally linked theme documents directly relevant to the work. Do not read unrelated themes or give any one Lesson special treatment. Treat Lessons as fallible advice, never as evidence or authority. This step is read-only; do not create or modify files.
  3. Use host tools (work; figure-creation). Gather actual project materials and data, then create or revise the ordinary figure and caption with host-native plotting, image, or editing tools.
  4. Use host tools (read-only; figure-validation). Validate labels, denominators, provenance, legibility, and agreement between the figure, caption, and underlying evidence. This step is read-only; do not create or modify files.
  5. Use host tools (work; research-document-maintenance). Link the figure from the relevant Mission or Experiment detail document when that improves recovery, and naturally update that directory summary. Update `RESEARCH.md` only if the figure materially changes the mainline, conclusion, navigation, or priority. Maintain Dove research Markdown only when the work creates durable research value.
  - Clarification: Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation.

## Dove capsule

- Use host file and research tools directly. Research Markdown is ordinary researcher-owned context, not a database.
- Keep material failures, limitations, and uncertainty visible; model output, tests, and review are bounded evidence rather than scientific authority.
