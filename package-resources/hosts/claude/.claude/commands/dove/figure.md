---
description: "Use when data or mechanism logic must become an actual checked figure with caption, text, and claim alignment."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.figure

Use when data or mechanism logic must become an actual checked figure with caption, text, and claim alignment.

## Request

$ARGUMENTS

## Examples

- `/dove:figure`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Plan, create, revise, inspect, and caption publication figures from actual materials.

### When to use

Use when the user requests a figure brief, diagram, plot, caption, visual revision, or figure assessment, or when a figure is the material evidence or communication bottleneck.

### What Dove will examine

- Judge a figure by whether it expresses the manuscript claim correctly, clearly, and attractively in context; inspect the rendered visual, source data or source visuals, rendering logic, caption, nearby text, final dimensions, and manuscript layout when they can change meaning.
- When figure work is useful, plan, create, revise, render, open, inspect, caption, and deliver the actual visual with suitable host tools and editable sources; quantitative plots use real data and reproducible code, diagrams preserve route-native editable structure, generated or edited images use exposed host image tools when appropriate, and mixed raster plus SVG/vector work remains modifiable.
- Make the figure serve a clear evidence or mechanism job: comparison, process, failure mode, causal story, or contribution, and keep source data or logic aligned with the actual rendered figure, caption, nearby text, and manuscript claim.
- Start from a compact Figure brief and visual plan: target claim, audience, evidence or mechanism job, real materials, panel/story structure, route choice, manuscript placement, final dimensions, caption role, and editable-source route.

### Scope and changes

- Figure may create, edit, render, open, inspect, caption, export, or update ordinary project visuals and nearby manuscript text when requested or material to the deliverable; it must not invent data, results, or method details.
- Pure context reading, planning, and inspection are read-only; creation, revision, caption insertion, export, delivery, and research-document maintenance are write-capable only within the authorized task scope.
- Maintain Dove research Markdown only when the user explicitly asks to record, update, or save Dove research context, the result clearly changes the research mainline, conclusion, decision, or priority, or preserving the work's evidence and continuation context is genuinely useful.

### Ways Dove may proceed

- When existing Dove research context would materially help the figure, read the overview and directly relevant Mission, Experiment, Claim, manuscript, or prior figure context; otherwise use the user's materials and data.
- When existing Lessons could inspire current or subsequent work, improve judgment, expand the candidate space, or prevent repeated mistakes, read ".dove/research/lessons/LESSONS.md" if it exists, then the directly relevant or plausibly useful linked Lessons. Read ".dove/research/RESEARCH.md" first only when project context is still needed and it has not already been read in the active context. Reuse Lessons already read in the active context instead of rereading them mechanically. If Lessons materials are absent, work without them. Treat Lessons as fallible guidance, never as evidence.
- Create a compact Figure brief and visual plan from inspected context: target claim, audience, evidence or mechanism job, real data or source visuals, chosen route, panel/story layout, manuscript location, final dimensions, caption and nearby-text role, and expected editable source. For planning-only or assessment-only requests, report the plan or findings without creating files.
- For creation, choose the route that fits the task: plot quantitative figures from real data with reproducible code; draw editable structure or mechanism diagrams in route-native SVG/vector/source form; use exposed host image generation or editing only when an illustrative image is the right route and permitted; or combine raster panels with SVG/vector labels, layout, and annotations. Render the actual figure, keep scratch renders in a repository-local workspace such as `.claude/tmp/` unless directed otherwise, and do not invent data, results, or method details.
- Open or view the actual rendered figure, not just filenames or thumbnails, at realistic final dimensions and in manuscript context when available. Check the chain from source data or mechanism logic to visual encoding, rendered panels, labels, units, legends, caption, nearby text, layout fit, and manuscript claim; flag mismatches rather than treating figure existence or size as success.
- For revision, make targeted changes to the editable source, plotting code, SVG/vector structure, raster edits, labels, layout, annotations, caption, nearby manuscript text, or export settings; rerender and inspect the updated figure before delivery.
- Deliver the final figure file together with the route-native editable source, such as plotting code and data reference, SVG/vector source, layered or editable image source, or the mixed raster plus SVG/vector composition that allows later modification.
- When useful for recovery, use ordinary Markdown links and readable project-relative artifact paths to link the rendered figure, route-native editable source, plot code and data, or source visual from the relevant Mission, Experiment, or Claim. Keep these as human-readable notes, not a structured figure store. Update summaries only for material synthesis or priority changes.

### What this should not replace

- Do not treat image counts, embedding, resolution, contact sheets, opening an image, beauty, or unchanged re-export as proof that the figure communicates the research.
- Do not use host image generation or editing when real data plotting, source inspection, editable diagrams, or simple vector/raster revision is the correct action.

### When Dove needs input

- Ask only when ambiguity in intent, target artifact, evaluation criteria, scope, or a key tradeoff would change the next useful action. If active research context implies a feasible follow-up, do that next step rather than merely suggesting it.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.

### Return with

- Inspected evidence, material change, unresolved limits, and the next useful action.
