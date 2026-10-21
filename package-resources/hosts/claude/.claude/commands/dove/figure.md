---
description: "Create and inspect figures from real materials, delivering captions and editable sources with the rendered visuals."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.figure

Create and inspect figures from real materials, delivering captions and editable sources with the rendered visuals.

## Request

$ARGUMENTS

## Examples

- `/dove:figure`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Gather materials and create, revise, inspect and caption publication-quality figures.

### When to use

Use for diagrams, plots, captions and visual revisions or assessments.

### Scope and changes

- Planning-only, assessment-only and no-write requests return plans or findings. Completion requires faithful meaning and a usable, visually sound figure, not just valid exports.

### Ways Dove may proceed

- Give the model inspected scientific content, the central message, key relations and essential labels. Use relevant paper figures as style references; let it design the complete paper illustration around the contribution, not every implementation detail, unless the user fixes a layout.
- For diagrams, use the model in dove settings --json via dove figure --project <root> --prompt-file <text> [--image <file> ...] --output <new.png>, or an exposed host image tool. Without a model, report the gap, not code boxes.
- Default to white or uniform flat backgrounds, consistent semantic colors, typography and strokes, and concise panel labels. Leave the full figure title and extended explanation to the caption; use shading to convey shape or data, not decoration.
- Gather real inputs, model outputs and plots from inspected artifacts; compose them into the design without generative redrawing. Use reproducible code for measured plots, exact geometry and local assembly. Missing required assets are gaps, not invented results.
- Edit the current model render with references and what to change or preserve. Inspect the assembled figure at final size in the manuscript: meaning, data, units, legends, caption/claim agreement, density, legibility and grayscale; fix defects. Deliver the figure, grounded caption and route-native editable source/composition, naming tools used.

### Using host tools

- Use tools and materials exposed by the current host and permitted by the user and project. If something is unavailable, name the gap and continue with useful permitted alternatives.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
