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

- Read the target artifact and evidence relevant to its claims. Connect the problem and gap to the insight, method, evidence, claim and limitation so the reader can follow the argument. Keep unchecked facts unknown, preserve certainty, causality, scope, quantitative qualifiers and novelty, and explain any evidence-driven change to claim strength before revising it.
- Write as the author would publish: state findings, setup and limits plainly, and turn gaps in supplied material into author questions rather than manuscript phrases such as 'not provided'. Use reliable author samples for stable style cues, with accuracy and venue norms taking precedence. Check how substantive edits affect the whole argument without turning a local wording request into a new research task.
- For contribution-level work, address in-scope source, method, evidence or figure gaps rather than merely weakening the prose. Polished wording and a complete draft do not establish a sound contribution or supported central claim.
- For manuscript work, preserve the user's current authoritative manuscript format, identify its source and build or export path, and follow actual venue requirements. Only for a new manuscript, default to LaTeX when the venue accepts it; otherwise use the required format. Inspect the actual submission output, including compiled output for LaTeX, keep scholarly evidence distinct from venue-facing materials, and propagate authorized changes through the authoritative source.
- Carry edits through the real build or export path and inspect the actual output before calling it current. Check compiled pages for overfull boxes, undefined references, float numbering and placement, and wide tables that need full width in two-column layouts. Measure body word count on the source without tables, captions or references against the target. Fix in-scope issues and report remaining material limits.
- If a venue template needs missing fonts or packages, obtain them with permitted tools in a project-local texmf and point the build there, rather than silently substituting fonts or changing system installations.

### Using host tools

- Use tools and materials exposed by the current host and permitted by the user and project. If something is unavailable, name the gap and continue with useful permitted alternatives.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
