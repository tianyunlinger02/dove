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

- Establish the figure's question, takeaway, audience, evidence and relationship to the paper's other figures. Choose representations that expose the science: states and interventions for mechanisms, information flow for architectures, aligned views for comparisons, or measured positions and uncertainty for quantitative results. These are choices, not fixed layouts. Use the venue/template's actual column width and applicable artwork requirements when available; otherwise state a provisional width. Design type and line weights at that physical size, then fit canvas height and margins to the content and any venue limit. PPT is an editing surface, not a slide template; neither default slide ratios nor arbitrary preset proportions determine the figure.
- For a new composition, investigate actual published figures suited to the explanatory task, including transferable examples from other fields, using existing inspected references where they remain relevant and filling material gaps. Extract what is largest and why, the reading path, cross-view identity or quantity encoding, alignment and shared scales, close-up connections, density, spacing, typography and color. Synthesize those choices with the scientific content and material roles into the current design brief, not just a reference list or generic style adjectives. Reuse established notation and visual language across the same paper; local revisions need only revisit affected choices. Keep useful decisions with existing figure materials or code, without requiring a separate research report, fixed reference count or fresh survey for every edit.
- For composed illustrations, adapt the model brief below with that design synthesis and use the configured model via dove figure --project <root> --prompt <text> (or --prompt-file <file>) [--image <file> ...] --output <file.png>, or an exposed image tool, to design the whole composition and explanatory imagery before building PPT. Pass --size, --quality or --background when useful and supported. The model's pixel dimensions are a working surface, not the final figure ratio. Let the central relation determine focal scale and supporting detail; neither minimalist geometry nor elaborate rendering is the default. Generate quantitative plots reproducibly from real data with deliberate axes, units, scales and uncertainty; a model may suggest layout, not measurements. Plot-only work needs neither an image-model call nor a PPT wrapper.
- Carry the selected design through implementation: preserve its hierarchy, reading path, correspondence and visual language, while correcting scientific errors and replacing placeholders with real materials. Compose illustrations in PPT with separate replaceable imagery/evidence and native labels, connectors and useful vectors; editability does not require tracing rich imagery into simple shapes. Give headings, ordinary labels, mathematical notation and program tokens intentional, consistent roles, with variables and subscripts matching the manuscript's conventions. Choose typography and spacing for legibility rather than shrinking each string to fit an inherited box. No font family, size ladder, palette or layout is universal. Put the full title and extended explanation in the caption. Use dove figure --tools to find this machine's python-pptx Python and export commands.
- Open the actual export at manuscript size and compare it with the scientific explanation, synthesized reference decisions and any model design used, not merely file validity. Refine focal hierarchy, disconnected panels, ambiguous correspondence, density and unreadable labels; inspect actual glyphs, mathematical placement and font embedding. If local tweaks cannot repair a weak explanation, revisit the representation or composition rather than polishing the same layout indefinitely. Deliver the editable source, assets/creation code, caption and same-source PDF/PNG appropriate to the request; composed figures include the PPTX. Preserve the same content-fitted canvas and proportions through export, without stretching evidence or a slide-shaped image. State unavailable calls, reused designs and remaining material gaps plainly.

### Adaptable model brief

Fill the relevant placeholders from the actual task and references; this is a starting point, not a fixed layout or style.

```text
Design a publication-quality [figure kind] for [field and audience], at [target manuscript column width; maximum height if applicable]. This is a visual design reference for editable composition, not a presentation slide.
CANVAS: [actual venue/template width and relevant artwork requirements, or a stated provisional width]. Arrange the scientific relation and supporting content at readable final-size typography, then choose height and margins from that composition. The image model's supported pixel size is only a working surface, not the final figure format; do not fit content to a slide ratio or stretch imagery to fill one.
SCIENTIFIC MESSAGE: [one takeaway and the question this figure answers].
CONTENT: [inspected facts, entities, relationships and scientific distinctions the image must preserve].
MATERIALS: [each input's role: real evidence, explanatory illustration, prior design to revise, or visual reference; identify what is supplied separately].
REFERENCE SYNTHESIS: [actual figures inspected or relevant prior reference decisions reused; explain what to adopt or change for this scientific task: focal scale, reading order, cross-view encoding, alignment/scales, density, close-up connections, typography and color. Turn them into a coherent design, not a list of paper names or a copy of their subject matter].
VISUAL CONTINUITY: [notation and visual choices already established for this paper; what this figure retains, changes or needs to design anew].
Choose representations that expose the central [mechanism/state change, information flow, quantitative relation, comparison or evidence structure]. Make that relation the visual focus, allocating area and detail by explanatory importance rather than equal modules. Connect overview and detail through aligned views, repeated identities, shared coordinates or explicit links where useful. Integrate the reference decisions into the whole composition, not a stock arrangement with illustrations added afterward.
Use consistent visual identities and meaningful color. Give headings, ordinary labels, mathematical symbols/subscripts and program tokens intentional roles consistent with the manuscript. Select type, line weights, spacing and contrast for final-size legibility, not to fill inherited boxes. Use depth, texture, shading, simple geometry or boxes where they help this explanation; no fixed font, palette, layout or minimal/rich style applies to every field.
Preserve supplied evidence and its identity for separate placement. Quantitative marks come from supplied data and plotting code, not invented model-rendered values; indicate where separately rendered plots belong. Make schematics recognizable as explanatory, not measured results. Keep labels concise and close to their referents, with the full title and extended explanation in the caption. Plan separately editable labels/connectors and replaceable illustrations/evidence so the selected hierarchy, correspondence and visual language can survive implementation and be checked in the actual export.
```

### Using host tools

- Use the tools and services available on this machine, including the ones configured for Dove, for the requested work without separate approval. If one is missing or failing, say which and continue another way.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
