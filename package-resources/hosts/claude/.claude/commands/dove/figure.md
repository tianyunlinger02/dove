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

Create, revise, inspect and caption publication-quality scientific figures across research fields.

### When to use

Use for method and mechanism diagrams, architectures, quantitative plots, comparisons, evidence assemblies and visual assessments.

### Scope and changes

- Planning-only, assessment-only and no-write requests retain their scope. Completion requires scientific fidelity and a visually effective figure, not merely valid exports.

### Ways Dove may proceed

- Establish the figure's question, takeaway, audience, final dimensions and available evidence. Choose a representation that reveals the relevant relation: states and interventions for mechanisms, information flow for architectures, aligned views for comparisons, or measured positions and uncertainty for quantitative results. These are choices, not fixed layouts; concrete objects, boxes, coordinates and illustrations are useful when they explain the science.
- Inspect actual published figures suited to that explanatory task, including transferable examples from other fields. Extract usable design decisions: what is largest and why, where reading starts and proceeds, how identities or quantities are encoded across views, which panels share alignment or scales, where close-ups connect, and how density, spacing, type and color support the explanation. Adapt those decisions to the whole new composition, rather than copying a reference's subject or adding decorative illustrations to an unchanged diagram.
- Adapt the model brief below with inspected scientific content, material roles and the reference decisions. Use the configured model via dove figure --project <root> --prompt <text> (or --prompt-file <file>) [--image <file> ...] --output <file.png>, or an exposed image tool, to design the composition and explanatory imagery before building PPT. Pass --size, --quality or --background when useful and supported by the selected model. Let the central relation determine focal scale, reading order and supporting detail; neither minimalist geometry nor elaborate rendering is the default style.
- Implement composed figures in PPT while preserving the design's hierarchy, proportions and visual language. Keep detailed illustrations and real evidence as separate replaceable media, with native labels, connectors and useful vector elements; editability does not require tracing rich imagery into simple shapes. Generate quantitative plots reproducibly from real data with deliberate axes, units, scales and uncertainty; the image model may suggest their layout, not invent their measurements. Place the full title and extended explanation in the caption. Use dove figure --tools to find this machine's python-pptx Python and PPTX-to-PDF / PDF-to-PNG commands.
- Open the actual export at manuscript size and compare it with the intended explanation, model design and paper references. Refine weak focal hierarchy, crowded or disconnected panels, ambiguous correspondence and unreadable labels, not just file validity. Deliver the editable source, assets/creation code, caption and same-source PDF/PNG as appropriate to the request; composed figures include the PPTX. State unavailable calls, reused designs and remaining material gaps plainly.

### Adaptable model brief

Fill the relevant placeholders from the actual task and references; this is a starting point, not a fixed layout or style.

```text
Design a publication-quality [figure kind] for [field, audience and final manuscript dimensions]. This is a visual design reference for editable composition, not a presentation slide.
SCIENTIFIC MESSAGE: [one takeaway and the question this figure answers].
CONTENT: [inspected facts, entities, relationships and scientific distinctions the image must preserve].
MATERIALS: [each input's role: real evidence, explanatory illustration, prior design to revise, or visual reference; identify what is supplied separately].
REFERENCE DECISIONS: [figures actually inspected and what to transfer: focal scale, reading order, cross-view encoding, panel alignment/density, close-up connections, typography and color; not their subject matter].
Choose visual representations that expose the central [mechanism/state change, information flow, quantitative relation, comparison or evidence structure]. Make that relation the visual focus, allocating area and detail by explanatory importance rather than giving every module equal weight. Connect overview and detail through aligned views, repeated identities, shared coordinates or explicit links where useful. Design the whole composition around this explanation, not a stock arrangement with illustrations added afterward.
Use consistent visual identities and meaningful color; distinguish quantities, categories and annotations. Select type sizes, line weights, spacing and contrast for the final manuscript size. Use depth, texture, shading, simple geometry or boxes where they help this particular explanation; there is no fixed minimal or richly illustrated style.
Preserve supplied evidence and its identity for separate placement. Quantitative marks must come from the supplied data and plotting code, not invented model-rendered values; indicate where separately rendered plots belong when needed. Make schematics recognizable as explanatory, not measured results. Keep labels concise and close to their referents, with the full title and extended explanation outside the artwork in the caption. Plan for separately editable labels/connectors and replaceable illustrations/evidence in the final composition.
```

### Using host tools

- Use the tools and services available on this machine, including the ones configured for Dove, for the requested work without separate approval. If one is missing or failing, say which and continue another way.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
