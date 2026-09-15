# Capability matrix

Dove has one research agent. Ordinary Claude conversation is the primary and complete entrance through the project rule's shared judgment and author stance, and may use the same capability methods naturally without a command. `claude --agent dove` and nine flat `/dove:*` shortcuts are optional, with no higher judgment authority, prerequisite role, workflow stage, permission grant, or Auto command. The ordinary main session retains full-conversation work, important clarification, mainline ownership, and result adoption before and after bounded delegation. Ordinary tasks with no research impact finish without an imposed research workflow.

## Nine capabilities

| Skill | Claude Code | DSH | What it helps with |
|---|---|---|---|
| `dove.research` | Command | Skill | Move a research goal forward and choose the next useful step. |
| `dove.status` | Command | Skill | Read current research notes, open questions, and next priorities without writing. |
| `dove.source` | Command | Skill | Find, read, check, and use relevant sources, including requested bounded bibliography DOI identity checks. |
| `dove.experiment` | Command | Skill | Design, execute when authorized, analyze existing results, or record retrospectively; purposes include exploration, diagnostics, confirmation, reproduction, and delivery checks. |
| `dove.draft` | Command | Skill | Draft, assess, or revise manuscripts, responses, methods, results, and other project text from real evidence. |
| `dove.figure` | Command | Skill | Gather materials, draw or revise figures, check them in manuscript context, and write captions. |
| `dove.review` | Command | Skill | Do author-side self-check, delivery review, `dove-review` handoff, returned-review import, or review inspection. |
| `dove.rebuttal` | Command | Skill | Analyze review findings, write responses, and make requested evidence-backed revisions. |
| `dove.lessons` | Command | Skill | Read or maintain reusable lessons that may improve current or future research judgment. |

Claude Code receives the Dove agent, commands, shared rule, read-only SessionStart integration inspection, startup/clear author-preference bootstrap, compact/resume facts card, deterministic short `UserPromptSubmit` re-anchor on every prompt (no classification, research reads/writes, permission decisions, or blocking), configured paper/web reading support, the `dove review ...` CLI handoff runtime, and the `dove run ...` local execution receipt helper. DSH receives project-local filesystem Skills only and no equivalent session hook or recoverable isolated Claude Code reviewer context.

These are optional shortcuts, not exclusive access to capabilities; the Claude agent is not reserved for Research. [Usage](USAGE.md#scope-plans-and-progress) defines the shortest total problem–method–contribution path, correction uptake, subordinate controls, narrow status conflicts, and the boundaries for confirmed implementation and unknown effects. It also prevents supplied interfaces, data, solutions, or mature code from defining the scientific problem by availability, then carries a sufficiently clear scientific contract into one necessary producer-consumer path and claim-matched evidence without an extra stage or gate. Capability and delegated returns remain scoped until the ordinary main session adopts, limits, or rejects them; a material evaluation changes affected claims, dependencies, investment, artifacts, or next action, or explains why no change follows, without an automatic capability chain. [Experiment](USAGE.md#experiment) separates request modes from purposes and explains end-to-end resource choices.

Both hosts install a short core plus two references with distinct read contracts: `.dove/install/RESEARCH_QUALITY.md` is consulted for substantive quality and joint conditions at consequential decision triggers, while each fresh host main-agent context personally reads the complete `.dove/install/AUTHOR_PREFERENCES.md` before substantive work. Claude supplies that requirement on startup and `/clear`; DSH applies it on first author-side Skill use if the current main agent has not completed the read in that context. Neither is a Lesson, evidence, or permission, and installation itself is not proof of reading. See [reference roles](USAGE.md#short-core-and-two-reference-read-contracts). Isolated review receives only separate canonical quality guidance; DSH Status does not carry author stance or its preference trigger.

## Research Markdown

Research context is ordinary Markdown under `.dove/research/`. Fresh initialization creates only `RESEARCH.md`. Mission, Source, Experiment, Review, Claim, and Lesson documents are optional and appear when useful.

Dove records Markdown when the user asks, when a result changes the research direction or conclusion, or when saving evidence and continuation context will help future work. Local run receipts live separately under `.dove/runs/**` and do not replace Experiment Markdown. Missing overview files and broken links are reported naturally.

## Review

Author-side self-check is Dove reviewing its own current work for scientific and delivery problems. It is useful but not independent external review.

`dove-review` applies the same research judgment from an isolated reviewer position for near-submission papers. It reconstructs and challenges the contribution rather than inheriting the author's mainline. The four whole-paper questions and four Markdown headings are described in [Usage](USAGE.md#review). `dove review handoff` freezes the current complete paper and listed submission materials for an isolated Claude Code reviewer session with only those files and Read; author-side venue or literature grounding must be included in that frozen handoff when it matters. `status` compares the frozen material receipt with current project files read-only while public output reports paths, safe size/existence/type/error facts, and `current`, `changed`, `missing`, or `unavailable` without hash fields; `resume` continues the current frozen round, `rerun` creates a new complete-material round in the same session, and `import` preserves a user-provided return as imported. The returned review is preserved and treated as evidence for author-side response or revision.

## Completion

Research participation, requested-work completion, and scientific progress are separate. Research engineering retains relevant scientific responsibilities, but useful engineering or delivery may finish without new scientific evidence. The [verification evidence boundaries](PACKAGING.md#verification-evidence) also separate source, generated, installed, currently loaded, and actual behavior facts.

A bounded request may finish locally. A larger research goal is complete only when it has been achieved. Real investigation finding no effective in-scope path, or a next step needing the user's decision or an outside permission/limit, can stop progression without completing that goal. For a user-confirmed submission-completion goal, the same current complete version needs author-side scientific sufficiency, a current independent `dove-review` scientific-acceptability recommendation, and actual delivery readiness.
