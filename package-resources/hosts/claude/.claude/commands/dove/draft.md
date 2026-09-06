---
description: "Use when the user names a draft/artifact to write or revise, with available evidence prioritized over polishing."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.draft

Use when the user names a draft/artifact to write or revise, with available evidence prioritized over polishing.

## Request

$ARGUMENTS

## Examples

- `/dove:draft`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Draft, assess, or revise the user-specified project text or artifact from the available evidence.

### When to use

Use when the user specifies a manuscript, section, claim-bearing artifact, draft, assessment, or revision target, or when expression, argument, or an authoritative delivery artifact is the limiting deficiency.

### What Dove will examine

- Prioritize the user-specified manuscript or artifact and the evidence needed for its material claims; leave unchecked methods, results, citations, samples, data, and field facts unknown.
- Preserve certainty, causality, scope, generality, quantitative qualifiers, and novelty unless evidence or the user changes them; say what changed before changing the text.
- Build or repair the paper spine: problem → gap → insight/mechanism → method → evidence → claim → limitation → reader takeaway.
- Use reliable author samples only for stable style cues such as rhythm, paragraphing, hedging, transitions, reporting verbs, and citation integration; keep accuracy and venue norms above voice imitation.
- If the intended contribution still needs method, source, experiment, figure, artifact propagation, or argument work, do that before merely weakening prose.

### Scope and changes

- Draft may create or edit ordinary project artifacts requested by the user or needed for the bounded deliverable; destructive, outward-facing, or submission actions still need explicit authorization.
- Maintain Dove research Markdown only when the user explicitly asks to record, update, or save Dove research context, the result clearly changes the research mainline, conclusion, decision, or priority, or preserving the work's evidence and continuation context is genuinely useful.

### Ways Dove may proceed

- When an existing Claim note is directly relevant to the user-specified draft or material claim, read `.dove/research/RESEARCH.md`, then `.dove/research/claims/CLAIMS.md`, then only directly relevant linked details. Otherwise work from the target artifact and specified evidence without reading Claims merely because Draft was invoked.
- When existing Lessons could inspire current or subsequent work, improve judgment, expand the candidate space, or prevent repeated mistakes, read ".dove/research/lessons/LESSONS.md" if it exists, then the directly relevant or plausibly useful linked Lessons. Read ".dove/research/RESEARCH.md" first only when project context is still needed and it has not already been read in the active context. Reuse Lessons already read in the active context instead of rereading them mechanically. If Lessons materials are absent, work without them. Treat Lessons as fallible guidance, never as evidence.
- Read the target and relevant material, then draft, assess, create, or revise the ordinary artifact when the deliverable requires it. For manuscript work, preserve the user's current authoritative manuscript format, identify its source and build or export path, and follow actual venue requirements. Only for a new manuscript, default to LaTeX when the venue accepts it; otherwise use the required format. Inspect the actual submission output, including compiled output for LaTeX, keep scholarly evidence distinct from venue-facing materials, and propagate authorized changes through the authoritative source. Propagate authorized edits through the real build or export path and inspect the actual output before claiming the artifact is current; assessment-only requests return findings without edits.
- Run the checks needed for the requested artifact, fix in-scope issues, and report remaining material issues, scope limits, or user choices.
- Create or revise a naturally named Claim document only when an important research claim needs durable treatment; when useful for recovery, link supporting or challenging Source, Experiment, Figure, and manuscript locations without copying evidence into a claim store. Use ordinary Markdown links and readable project-relative artifact paths only when useful for recovery, and keep the note as human prose rather than a structured store. Update only the narrowest relevant research document. Update `.dove/research/claims/CLAIMS.md` only when its own links or synthesis materially change. Update `.dove/research/RESEARCH.md` only for a project-level mainline, conclusion, navigation, or priority change.

### What this should not replace

- Do not let polished wording, export, or local checks replace missing evidence for a claim.
- Do not create Claim records merely because drafting occurred.

### When Dove needs input

- Ask only when ambiguity in intent, target artifact, evaluation criteria, scope, or a key tradeoff would change the next useful action. If active research context implies a feasible follow-up, do that next step rather than merely suggesting it.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.

### Return with

- Inspected evidence, material change, unresolved limits, and the next useful action.
