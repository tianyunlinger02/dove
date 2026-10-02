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

Claude Code receives the Dove agent, commands, shared rule, read-only SessionStart inspection, startup/clear two-essentials bootstrap, compact/resume identity card, and read-only `UserPromptSubmit` verification and short identity/current guidance when current, or nonblocking diagnostics otherwise (no prompt classification, research writes, permission decisions, or blocking). It also receives paper/web reading support, the existing `dove review ...` runtime, and local `dove run ...` receipts. DSH receives project-local filesystem Skills only and no equivalent session hook or recoverable isolated Claude Code reviewer context.

These are optional shortcuts, not exclusive access to capabilities; the Claude agent is not reserved for Research. [Usage](USAGE.md#scope-plans-and-progress) defines the shortest total problem–method–contribution path, correction uptake, subordinate controls, narrow status conflicts, and the boundaries for confirmed implementation and unknown effects. It also prevents supplied interfaces, data, solutions, or mature code from defining the scientific problem by availability, then carries a sufficiently clear scientific contract into one necessary producer-consumer path and claim-matched evidence without an extra stage or gate. Capability and delegated returns remain scoped until the ordinary main session adopts, limits, or rejects them; a material evaluation changes affected claims, dependencies, investment, artifacts, or next action, or explains why no change follows, without an automatic capability chain. [Experiment](USAGE.md#experiment) separates request modes from purposes and explains end-to-end resource choices.

Both hosts share four exact resources: short Chinese quality and preference essentials at `.dove/install/RESEARCH_QUALITY.md` and `.dove/install/AUTHOR_PREFERENCES.md`, plus preserved `_FULL.md` companions for relevant detail on demand. Every fresh host main-agent context personally reads both essentials before substantive work: Claude startup/clear supplies the bootstrap, and DSH applies it on first author-side Skill use if needed. Installation does not prove reading; guidance is not Lessons, evidence, or permission. See [reference roles](USAGE.md#short-core-and-two-reference-read-contracts). Isolated review receives separate quality essentials and full detail only; DSH Status has no author stance or bootstrap.

## Research Markdown

Research context is ordinary Markdown under `.dove/research/`. Fresh initialization creates only `RESEARCH.md`. Mission, Source, Experiment, Review, Claim, and Lesson documents are optional and appear when useful.

Dove records Markdown when the user asks, when a result changes the research direction or conclusion, or when saving evidence and continuation context will help future work. Local run receipts live separately under `.dove/runs/**` and do not replace Experiment Markdown. Missing overview files and broken links are reported naturally.

## Review

Author-side self-check is Dove reviewing its own current work for scientific and delivery problems. It is useful but not independent external review.

`dove-review` uses the same Dove role, not another persona or Skill. Existing `dove review handoff --project P --scope route|design --material path... --json` automatically freezes the exact `.dove/research/IDENTITY.md`; route adds only actual diff since the last review and actual run results, design only a one-page design. No process conversation is supplied. Every route/design call, including resume/rerun, starts a brand-new Read-only Claude session. Material findings change actual next work and invalid patches, with rejected approaches retained in the card; no runtime means an honest limitation, not self-check called isolated review.

Default paper review remains a persistent isolated context for the current complete near-submission paper and listed submission/grounding files. Paper resume/rerun retain that reviewer's own history. All scopes receive separate quality essentials/full detail, not author preferences or unlisted files; session/tool/material isolation is not an OS sandbox. `status` compares receipts read-only without public hashes, and `import` preserves supplied provenance. Returns are criticism, not scientific PASS or permission. [Usage](USAGE.md#review) owns scope triggers, design contents, and paper-review questions.

## Completion

Research participation, requested-work completion, and scientific progress are separate. Research engineering retains relevant scientific responsibilities, but useful engineering or delivery may finish without new scientific evidence. The [verification evidence boundaries](PACKAGING.md#verification-evidence) also separate source, generated, installed, currently loaded, and actual behavior facts.

A bounded request may finish locally. A larger research goal is complete only when it has been achieved. Real investigation finding no effective in-scope path, or a next step needing the user's decision or an outside permission/limit, can stop progression without completing that goal. For a user-confirmed submission-completion goal, the same current complete version needs author-side scientific sufficiency, a current independent `dove-review` scientific-acceptability recommendation, and actual delivery readiness.
