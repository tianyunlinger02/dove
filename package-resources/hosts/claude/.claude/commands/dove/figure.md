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

- Use one route: model-led visual design and schematics, real evidence, and editable PPT composition. Give the model inspected content, the central message and key relations; let it design the overall visual language and composition using relevant paper figures.
- Generate/edit references and schematics with the model in dove settings --json via dove figure --project <root> --prompt-file <text> [--image <file> ...] --output <new.png>, or an exposed image tool. State what to change or preserve.
- Realize the design with an available PPT tool/library: native text, shapes, connectors and separate images. Embed real inputs, model outputs and reproducible data plots/geometry without generative redrawing. A full-figure PNG pasted into PPT is not editable composition.
- Use uniform backgrounds, semantic colors and consistent type/strokes; shade for shape/data. Keep labels short; the full title and long explanations belong in the caption. Replace evidence and typeset in PPT; edit schematics with the model.
- Deliver editable PPTX, assets, any creation script and caption, with PDF/PNG exported from that source. Inspect exports at manuscript size and in context: meaning, data, units, legends, density, legibility, grayscale and caption/claims; fix defects. Missing assets, models or PPT/export tools remain gaps.

### Using host tools

- Use tools and materials exposed by the current host and permitted by the user and project. If something is unavailable, name the gap and continue with useful permitted alternatives.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
