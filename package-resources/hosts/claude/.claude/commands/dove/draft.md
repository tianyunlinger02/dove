---
description: "Write or revise evidence-grounded text and deliver the authoritative manuscript through its actual build or export."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.draft

Write or revise evidence-grounded text and deliver the authoritative manuscript through its actual build or export.

## Request

$ARGUMENTS

## Examples

- `/dove:draft`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Draft, assess or revise the specified manuscript, section or claim-bearing artifact.

### When to use

Use for requested writing or revision, or when the argument, expression or delivery artifact needs work.

### Scope and changes

- Assessment-only requests return findings without edits. Local writing stays local and does not require a mentor, new round or subagent merely to read the materials. Artifact preparation does not authorize submission.

### Ways Dove may proceed

- Read the target and claim evidence. Connect problem, gap, insight, method, evidence and limits; preserve certainty, causality, scope, quantitative qualifiers and novelty. Explain evidence-driven claim changes before revising. Address in-scope source, method, evidence or figure gaps rather than merely weakening prose; polished text does not establish a sound contribution.
- Use `.dove/research/papers/library.json` and `library.md` to group related work by direction, checking claim support against `papers/<id>.md`. Verify citation metadata with Source before citing or exporting BibTeX; never invent authors, venue, date or identifiers. Export only verified fields. Explicit library accumulation or a later watch run maintains the library; merely reading it does not write it.
- Write publishable findings, setup and limits plainly. Ask the author about missing material rather than putting 'not provided' into the manuscript. Follow reliable author style samples within accuracy and venue norms, and check effects on the whole argument without expanding local writing into a new research task.
- For manuscript work, preserve the user's current authoritative manuscript format, identify its source and build or export path, and follow actual venue requirements. Only for a new manuscript, default to LaTeX when the venue accepts it; otherwise use the required format. Inspect the actual submission output, including compiled output for LaTeX, keep scholarly evidence distinct from venue-facing materials, and propagate authorized changes through the authoritative source.
- Carry edits through the real build or export path and inspect the actual output before calling it current. Check compiled pages for overfull boxes, undefined references, float numbering and placement, and wide tables that need full width in two-column layouts. Measure body word count on the source without tables, captions or references against the target. Fix in-scope issues and report remaining material limits.
- If a venue template needs missing fonts or packages, obtain them with permitted tools in a project-local texmf and point the build there, rather than silently substituting fonts or changing system installations.

### Using host tools

- Use tools and materials exposed by the current host and permitted by the user and project. If something is unavailable, name the gap and continue with useful permitted alternatives.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
