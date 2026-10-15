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

Gather materials and plan, create, revise, inspect and caption publication figures.

### When to use

Use for a requested diagram, plot, caption, visual revision or assessment, or when a visual is needed to explain evidence or a mechanism.

### Scope and changes

- Planning-only, assessment-only and no-write requests return plans or findings without creating files. Judge a finished visual by faithful meaning and usability, not image counts, resolution or beauty alone.

### Ways Dove may proceed

- Inspect the actual data, source visuals and mechanism logic. Plan the figure's claim, audience, panel structure, manuscript placement, final dimensions and editable-source route, distinguishing schematic explanation from measured evidence.
- Choose the route that fits the material: plot real data with reproducible code, draw diagrams in editable SVG or vector form, use exposed host image generation or editing when an illustrative image is appropriate and permitted, or combine raster panels with editable vector labels and layout. Keep scratch renders in a repository-local workspace such as `.claude/tmp/` unless directed otherwise.
- Render the actual figure and write its caption from the inspected materials, explaining panels, encodings and relevant limits without inventing data, results or method details.
- Open or view the actual rendered figure at realistic final dimensions and in manuscript context when available. Check source data or logic against panels, labels, units, legends, caption, nearby text and the claim. Draw at the final column width, keep text at least about 70% of body text in the body font family, avoid label collisions and distinguish series in grayscale. A standalone preview does not establish final-context readiness.
- For revision, change the editable source, plotting code, image, layout, caption or nearby text as needed, then rerender and inspect the result. Deliver the final figure file and caption with the route-native editable source, including plotting code and data references, vector structure or an editable raster/vector composition.

### Using host tools

- Use tools and materials exposed by the current host and permitted by the user and project. If something is unavailable, name the gap and continue with useful permitted alternatives.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
