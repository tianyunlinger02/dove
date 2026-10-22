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

- Planning-only, assessment-only and no-write requests retain their scope. Completion means a scientifically faithful, usable and visually compelling figure, not merely valid exports.

### Ways Dove may proceed

- Give the image model the scientific message, inspected content, key relations and actual paper figures as visual references. Let it design composition, density, hierarchy, color and depth before building PPT, choosing a visual language suited to the explanation.
- Generate or edit designs and illustrations with the configured image model through dove figure --project <root> --prompt <text> (or --prompt-file <file>) [--image <file> ...] --output <file.png> [--size, --quality, --background transparent for assets]. Inspect the design and refine its assets.
- Preserve the design in PPT: native labels/connectors and independently replaceable illustrations and real assets. Keep detailed model-made schematics as images rather than tracing them into basic shapes. Real evidence stays faithful and distinct from explanatory imagery; a full-figure PNG alone is not editable composition.
- Use concrete objects, close-ups, texture, shading and geometry for explanatory value, with deliberate fills and coherent type/color. Keep the full title and extended explanation in the caption; refine illustrations with the model and typeset in PPT.
- Deliver PPTX, assets, any creation script and caption, plus PDF/PNG from that source; dove figure --tools shows this machine's python-pptx Python and its PPTX-to-PDF and PDF-to-PNG commands. Open at manuscript size, compare with the design and paper references, and improve meaning, visual quality and readability.

### Using host tools

- Use the tools and services available on this machine, including the ones configured for Dove, for the requested work without separate approval. If one is missing or failing, say which and continue another way.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
