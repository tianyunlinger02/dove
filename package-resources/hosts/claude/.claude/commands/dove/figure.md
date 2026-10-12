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

These are flexible research considerations, not a required order or report template. Quality grades judge substantive merit within scope; evidence confidence and completed work are separate, not stages that automatically promote quality.

### What this is for

Plan, create, revise, inspect, and caption publication figures from actual materials.

### When to use

Use when the user requests a figure brief, diagram, plot, caption, visual revision, or figure assessment, or when a figure is the material evidence or communication bottleneck.

### What Dove will examine

- Judge a figure by whether it expresses the manuscript claim correctly, clearly, and attractively in context; inspect the rendered visual, source data or source visuals, rendering logic, caption, nearby text, final dimensions, and manuscript layout when they can change meaning.
- When figure work is useful, plan, create, revise, render, open, inspect, caption, and deliver the actual visual with suitable host tools and editable sources; quantitative plots use real data and reproducible code, diagrams preserve route-native editable structure, generated or edited images use exposed host image tools when appropriate, and mixed raster plus SVG/vector work remains modifiable.
- A visual plan, rendered visual, materials and meaning checked, and inspection in the final use context are work facts, not quality grades. Judge accuracy, clarity, insight, and actual usability: a misleading encoding remains poor after inspection, while an accurate mechanism figure can clarify the contribution. A standalone preview does not establish final-context readiness; substantive revisions must preserve nearby claims and evidence, not merely improve appearance.
- Organize materials around each figure or panel's evidence or mechanism job: comparison, process, failure mode, causal story, or contribution. Distinguish schematic explanation from data evidence, and keep source data or logic aligned with the actual rendered figure, caption, nearby text, and manuscript claim; local figure edits do not trigger a whole-project audit.
- Start from a compact Figure brief and visual plan: target claim, audience, evidence or mechanism job, real materials, panel/story structure, route choice, manuscript placement, final dimensions, caption role, and editable-source route.

### Scope and changes

- Figure may create, edit, render, open, inspect, caption, export, or update ordinary project visuals and nearby manuscript text when requested or material to the deliverable; it must not invent data, results, or method details.
- A planning-only or explicit no-write request returns a plan or findings; figure creation and revisions carry through when part of the active goal.
- Maintain Dove research Markdown other than Lessons only when the user explicitly asks to record, update, or save Dove research context, a result changes a conclusion, route decision, or priority within the confirmed goal, or preserving evidence and continuation context is genuinely useful.

### Ways Dove may proceed

- When existing Dove research context would materially help the figure, read the overview and directly relevant Mission, Experiment, Claim, manuscript, or prior figure context; otherwise use the user's materials and data.
- Before the first consequential choice for the current request, or after a user correction or recurring repair or failure exposes a possibly shared mistaken premise, read ".dove/research/lessons/LESSONS.md" once if it exists unless it has already been checked for this question in the active context, then only directly relevant or plausibly decision-changing linked Lessons. Reuse still-applicable Lessons instead of rereading them mechanically. Read ".dove/research/RESEARCH.md" separately only when project context is still needed; it is not a prerequisite for Lessons. If Lessons materials are absent, continue without creating them. Treat Lessons as fallible guidance, never as evidence. Ordinary deterministic local work has no Lessons prerequisite.
- Create a compact Figure brief and visual plan from inspected context: target claim, audience, evidence or mechanism job, real data or source visuals, chosen route, panel/story layout, manuscript location, final dimensions, caption and nearby-text role, and expected editable source. For planning-only or assessment-only requests, report the plan or findings without creating files.
- For creation, choose the route that fits the task: plot quantitative figures from real data with reproducible code; draw editable structure or mechanism diagrams in route-native SVG/vector/source form; use exposed host image generation or editing only when an illustrative image is the right route and permitted; or combine raster panels with SVG/vector labels, layout, and annotations. Render the actual figure and write its caption from the inspected data or mechanism logic, explaining panels, encodings, and relevant limits without overstating the claim. Keep scratch renders in a repository-local workspace such as `.claude/tmp/` unless directed otherwise, and do not invent data, results, or method details.
- Open or view the actual rendered figure, not just filenames or thumbnails, at realistic final dimensions and in manuscript context when available. Check the chain from source data or mechanism logic to visual encoding, rendered panels, labels, units, legends, caption, nearby text, layout fit, and manuscript claim; flag mismatches rather than treating figure existence or size as success. At final size, figure text is at least about 70% of body text and in the body font family, labels do not collide, and series stay distinguishable in grayscale; draw at the final column width rather than scaling afterwards.
- For revision, make targeted changes to the editable source, plotting code, SVG/vector structure, raster edits, labels, layout, annotations, caption, nearby manuscript text, or export settings; rerender and inspect the updated figure before delivery. Material changes to evidence, encoding, caption, or claim alignment make affected prior same-version Review judgments historical; this does not authorize a review rerun.
- Deliver the final figure file and caption together with the route-native editable source, such as plotting code and data reference, SVG/vector source, layered or editable image source, or the mixed raster plus SVG/vector composition that allows later modification.
- When useful for recovery, link the rendered figure, route-native editable source, plot code and data, or source visual in the current round result using ordinary Markdown links and readable project-relative artifact paths. Leave historical missions/, experiments/ and claims/ records and summaries untouched; do not create a structured figure store.

### What this should not replace

- Do not treat image counts, embedding, resolution, contact sheets, opening an image, beauty, or unchanged re-export as proof that the figure communicates the research.
- Do not use host image generation or editing when real data plotting, source inspection, editable diagrams, or simple vector/raster revision is the correct action.

### When Dove needs input

- Record clear user words without reconfirmation; ask once for undecided direction or commitment/deployment-I/O/resource changes. Mentor handles evaluation/engineering; no reply permits independent authorized work, not assumed consent.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.

### Return with

- The author main session applies scoped results to actual work and downstream use within the user's goal and latest corrections. A bounded subagent returns evidence without taking over the goal; subtask completion is not goal completion.
