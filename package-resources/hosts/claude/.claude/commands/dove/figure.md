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

Use for a requested diagram, plot, caption, visual revision or assessment, or when a visual is needed to explain evidence or a mechanism.

### Scope and changes

- Planning-only, assessment-only and no-write requests return plans or findings without creating files. Completion needs faithful meaning, visual quality and usability, not merely successful technical checks.

### Ways Dove may proceed

- Give the image model the inspected scientific content: what the figure explains, key entities and relationships, and necessary labels. Ask it to draw the complete figure in a polished scientific-paper illustration style, using relevant paper figures as style references. Let it design the composition unless the user fixes a layout.
- For diagrams, check dove settings --json; use the configured model via dove figure --project <root> --prompt-file <text> [--image <file> ...] --output <new.png>. Host image tools are optional only if exposed. Without a model, report the gap rather than substitute code boxes.
- Use reproducible code for real-data plots, exact geometry and layout. Preserve measured evidence; generated imagery is not experimental output. Keep scratch renders in the authorized workspace.
- Inspect the render at final size and in manuscript context: hierarchy, core relationship, appearance, data, labels, units, legends, caption and claim. Keep labels legible and encodings grayscale-safe. Valid exports do not prove good design.
- Revise the model's generated figure through image editing, supplying that image, relevant references, and what to change or preserve. Deliver the inspected figure, grounded caption and route-native editable source/composition, naming the tools used.

### Using host tools

- Use tools and materials exposed by the current host and permitted by the user and project. If something is unavailable, name the gap and continue with useful permitted alternatives.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
