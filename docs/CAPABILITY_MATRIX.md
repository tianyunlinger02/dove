# Capability matrix

Dove has one research agent and nine optional entrances. Use the direct Dove agent when you want Dove to choose the next step; use `/dove:*` when you want to start from a specific capability.

## Nine capabilities

| Skill | Claude Code | DSH | What it helps with |
|---|---|---|---|
| `dove.research` | Agent and command | Skill | Move a research goal forward and choose the next useful step. |
| `dove.status` | Command | Skill | Read current research notes, open questions, and next priorities without writing. |
| `dove.source` | Command | Skill | Find, read, check, and use papers, webpages, or other sources that matter to the question. |
| `dove.experiment` | Command | Skill | Design experiments, analyze existing results, record useful findings, or explicitly run diagnostics and experiments with local run receipts when useful. |
| `dove.draft` | Command | Skill | Draft, assess, or revise manuscripts, responses, methods, results, and other project text from real evidence. |
| `dove.figure` | Command | Skill | Gather materials, draw or revise figures, check them in manuscript context, and write captions. |
| `dove.review` | Command | Skill | Do author-side self-check, delivery review, `dove-review` handoff, returned-review import, or review inspection. |
| `dove.rebuttal` | Command | Skill | Analyze review findings, write responses, and make requested evidence-backed revisions. |
| `dove.lessons` | Command | Skill | Read or maintain reusable lessons that may improve current or future research judgment. |

Claude Code receives the full Dove agent, commands, ambient context support, configured paper/web reading support, the `dove review ...` CLI handoff runtime, and the `dove run ...` local execution receipt helper. DSH receives project-local filesystem Skills only and no equivalent recoverable isolated Claude Code reviewer context.

## Research Markdown

Research context is ordinary Markdown under `.dove/research/`. Fresh initialization creates only `RESEARCH.md`. Mission, Source, Experiment, Review, Claim, and Lesson documents are optional and appear when useful.

Dove records Markdown when the user asks, when a result changes the research direction or conclusion, or when saving evidence and continuation context will help future work. Local run receipts live separately under `.dove/runs/**` and do not replace Experiment Markdown. Missing overview files and broken links are reported naturally.

## Review

Author-side self-check is Dove reviewing its own current work for scientific and delivery problems. It is useful but not independent external review.

`dove-review` is the separate review path for near-submission papers. `dove review handoff` freezes the current complete paper and listed submission materials for an isolated Claude Code reviewer session, while `resume` continues the current frozen round, `rerun` creates a new complete-material round in the same session, and `import` preserves a user-provided return as imported. The returned review is preserved and treated as evidence for author-side response or revision.

## Completion

A bounded request may finish locally. A larger research goal is complete only when the goal has been achieved, no effective in-scope path remains after real investigation, or the next step needs the user's decision or an outside permission/limit.
