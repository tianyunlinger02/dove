# Capability matrix

Dove has one research agent and nine flat optional entrances, with no Auto command. Ordinary Claude conversations share research judgment through the project rule. Use `claude --agent dove` for the author-side main session, or `/dove:*` for a specific capability. Bounded independent investigations may use a Dove subagent; work needing the full conversation, important user clarification, or ongoing mainline ownership stays in the main session.

## Nine capabilities

| Skill | Claude Code | DSH | What it helps with |
|---|---|---|---|
| `dove.research` | Agent and command | Skill | Move a research goal forward and choose the next useful step. |
| `dove.status` | Command | Skill | Read current research notes, open questions, and next priorities without writing. |
| `dove.source` | Command | Skill | Find, read, check, and use relevant sources, including requested bounded bibliography DOI identity checks. |
| `dove.experiment` | Command | Skill | Design experiments, analyze existing results, record useful findings, or explicitly run diagnostics and experiments with local run receipts when useful. |
| `dove.draft` | Command | Skill | Draft, assess, or revise manuscripts, responses, methods, results, and other project text from real evidence. |
| `dove.figure` | Command | Skill | Gather materials, draw or revise figures, check them in manuscript context, and write captions. |
| `dove.review` | Command | Skill | Do author-side self-check, delivery review, `dove-review` handoff, returned-review import, or review inspection. |
| `dove.rebuttal` | Command | Skill | Analyze review findings, write responses, and make requested evidence-backed revisions. |
| `dove.lessons` | Command | Skill | Read or maintain reusable lessons that may improve current or future research judgment. |

Claude Code receives the Dove agent, commands, shared rule, read-only SessionStart integration inspection and compact/resume facts card, configured paper/web reading support, the `dove review ...` CLI handoff runtime, and the `dove run ...` local execution receipt helper. DSH receives project-local filesystem Skills only and no equivalent recoverable isolated Claude Code reviewer context.

Important route, method, hypothesis, evaluation, and central-experiment decisions use proportionate theory or mechanism grounding before commitment; exploratory diagnostics can establish missing foundations. Source separates supported, contradicted, and uncovered parts of composite claims. Central execution that needs recording saves a plan before running and appends results to the same document. Draft and Review preserve the current authoritative manuscript format.

Both hosts carry a short research core and proactively read the shared `.dove/install/RESEARCH_QUALITY.md` before consequential quality and route decisions. The complete reference is package guidance, not a Lesson or research evidence. Isolated review receives a separate canonical copy without additional user-material access.

## Research Markdown

Research context is ordinary Markdown under `.dove/research/`. Fresh initialization creates only `RESEARCH.md`. Mission, Source, Experiment, Review, Claim, and Lesson documents are optional and appear when useful.

Dove records Markdown when the user asks, when a result changes the research direction or conclusion, or when saving evidence and continuation context will help future work. Local run receipts live separately under `.dove/runs/**` and do not replace Experiment Markdown. Missing overview files and broken links are reported naturally.

## Review

Author-side self-check is Dove reviewing its own current work for scientific and delivery problems. It is useful but not independent external review.

`dove-review` applies the same research judgment from an isolated reviewer position for near-submission papers. It reconstructs and challenges the contribution rather than inheriting the author's mainline. The four whole-paper questions and four Markdown headings are described in [Usage](USAGE.md#review). `dove review handoff` freezes the current complete paper and listed submission materials for an isolated Claude Code reviewer session with only those files and Read; author-side venue or literature grounding must be included in that frozen handoff when it matters. `status` compares the frozen material receipt with current project files read-only while public output reports paths, safe size/existence/type/error facts, and `current`, `changed`, `missing`, or `unavailable` without hash fields; `resume` continues the current frozen round, `rerun` creates a new complete-material round in the same session, and `import` preserves a user-provided return as imported. The returned review is preserved and treated as evidence for author-side response or revision.

## Completion

A bounded request may finish locally. A larger research goal is complete only when it has been achieved. Real investigation finding no effective in-scope path, or a next step needing the user's decision or an outside permission/limit, can stop progression without completing that goal. For a user-confirmed submission-completion goal, the same current complete version needs author-side scientific sufficiency, a current independent `dove-review` scientific-acceptability recommendation, and actual delivery readiness.
