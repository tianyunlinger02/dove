# Usage

Dove helps move a research project forward. Tell it the goal directly, or use a `/dove:*` command when you want a specific entrance. For a confirmed goal, Dove keeps working while another useful in-scope step can still help; it asks when the next step needs your decision, permission, or a change in direction.

## Start using Dove

Install an exact trusted Dove artifact once for the current user, then run Dove in the target project:

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove
```

The bare public npm package name `dove` is unrelated. For package trust, lifecycle operations, host setup, and permissions, see [Installation](INSTALL.md).

## Entry modes

### Direct Dove agent

Claude projects receive a direct Dove agent. Use it when you want Dove to choose the next research action itself.

### Ordinary prompt

For normal non-slash prompts, the host handles general routing. In initialized Claude projects, Dove context is added only for clearly research-related requests. It does not write notes or force a Skill; Dove uses the visible conversation, project facts, research notes, and available tools to answer, clarify, or work.

### Slash commands

Use `/dove:*` when you want to enter through a specific capability:

| Skill | Use it for |
|---|---|
| `dove.research` | Advance a research goal and let Dove choose the next useful step. |
| `dove.status` | Read current research notes, open questions, and next priorities without writing. |
| `dove.source` | Find, read, check, save when useful, and use sources that matter to the question. |
| `dove.experiment` | Design experiments, analyze results, record useful findings, or explicitly run diagnostics and experiments. |
| `dove.draft` | Draft, assess, or revise manuscripts, responses, methods, results, and other text from real evidence. |
| `dove.figure` | Gather materials, draw or revise figures, check them in manuscript context, and write captions. |
| `dove.review` | Do author-side self-check, delivery review, `dove-review` handoff, returned-review import, or review inspection. |
| `dove.rebuttal` | Analyze review findings, write responses, and make requested evidence-backed revisions. |
| `dove.lessons` | Read or maintain reusable lessons that may improve current or future research judgment. |

The Skills are shortcuts for the same Dove, not separate personas, fixed stages, or an Auto mode.

## Tools and sources

Dove uses the tools the current host exposes and the current project permits. In Claude projects, search discovery, scholarly paper reading, and ordinary webpage reading are configured during setup; details are in [Installation](INSTALL.md). If a needed tool or source is unavailable, Dove says what is missing and either continues with useful available material or asks for the needed permission.

## Research Markdown

Research context lives under `.dove/research/` as ordinary Markdown. Fresh initialization creates only `RESEARCH.md`. Mission, Source, Experiment, Review, Claim, and Lesson documents are optional notes created when useful.

Use research Markdown to preserve:

- the current research direction, important conclusions, and next priorities;
- sources actually inspected and what they support or contradict;
- experiment plans and actual results when a newly executed experiment needs recording;
- review handoffs, returned reviews, and author handling when requested;
- reusable Lessons that can improve future judgment.

Dove writes or updates notes when you ask, when results clearly change the research direction or conclusion, or when saving evidence and continuation context will help future work. It does not create documents merely to show that a Skill ran. `dove update`, SessionStart sync, reinstall, and uninstall preserve existing `.dove/research/**` content, `.dove/reviews/**` review records, and `.dove/runs/**` local run receipts. `UserPromptSubmit` does not write; it only validates and routes hidden intake for clearly research-related prompts.

Use ordinary Markdown relative links between research documents, and use readable project-relative artifact paths for drafts, data, logs, rendered figures, editable sources, run receipts, and review returns. Add those links or paths only when they help a future reader recover evidence or continue work. Dove does not add generated IDs, frontmatter, a link parser, backlink audit, consistency matrix, or research database around them; a broken link remains an ordinary documentation problem.

## Working with the nine capabilities

### Research

Use `/dove:research` for “advance this goal.” Dove may choose source work, analysis, experiment, coding, drafting, figure work, review handling, or another useful action. It stops when the goal is reached, when real investigation finds no effective in-scope path, or when the next step needs your decision or an outside permission/limit.

### Status

Use `/dove:status` to read current research notes and priorities without writes. Missing overview files and broken links are reported plainly.

### Source

Use `/dove:source` to turn external material into research judgment. Dove distinguishes material found from material actually read and used. It also checks citation identity separately from whether the source supports a specific claim.

Ordinary source work stays proportional to the question. Systematic review, meta-analysis, evidence grading, or auditable synthesis requests use a structured method appropriate to the field.

### Experiment

Use `/dove:experiment` for design-only work, requested execution, existing-result analysis, retrospective recording, and diagnostic checks. Before a central experiment, Dove clarifies what uncertainty the experiment should resolve and what result would matter.

When newly executed central work needs recording, the same Experiment document should contain the plan and later the actual results. For local command-based work, Dove may use `dove run start -- <command> [args...]` after first stating what judgment the run can change and how the result will be judged. Surprising or unstable results are checked first for implementation, data, configuration, randomness, metric, baseline, or analysis errors before being used as scientific evidence.

### Run receipts

`dove run` is a local execution receipt helper for explicit experiments or diagnostics:

```bash
dove run start --project <dir> --id <id> --group <name> --metric-name <name> --direction min|max --timeout-ms <ms> -- <command> [args...]
dove run status --project <dir> --id <id>
dove run resume --project <dir> --id <id>
dove run finalize --project <dir> --id <id> --metric-value <number>
dove run compare --project <dir> --group <name>
```

`start` launches a detached Dove supervisor, which is the only writer for the run journal while it directly spawns the target command from the project root without a shell. It stores `.dove/runs/<id>/run.jsonl`, `stdout.log`, and `stderr.log`; the journal intentionally records the explicit argv and comparison basis, so do not put secrets in run command arguments or basis fields. Ordinary completion writes one `run.terminal` event. `status` is strictly read-only. `resume` never reruns the target: it reports terminal or live runs without writing, reports orphaned target observations without writing, and only records one interrupted `run.reconciled` event when neither supervisor nor target is observable and the terminal event is missing. `finalize` appends one scalar metric after terminal completion, with optional decision or note. `compare` only ranks terminal and finalized runs whose metric definition, budget, data, evaluator, and resource basis are identical; otherwise it returns `comparable: false` and the mismatched fields. POSIX timeouts signal the target process group and only promise same-group descendants; Windows termination is direct-child best effort.

### Draft

Use `/dove:draft` to create, assess, or revise text from inspected evidence. Dove does not silently strengthen or weaken claims. Methods, Results, citations, samples, data, and field facts come from actual project or source material.

### Figure

Use `/dove:figure` for drawing, redrawing, generation, revision, checking, and captioning. Dove starts from what the figure needs to show, gathers the relevant data or visual material, uses the best available tool, and checks the result in its real manuscript context when relevant.

### Review

Use `/dove:review` for five operations:

1. author-side scientific self-check;
2. conditional delivery review;
3. `dove-review` handoff preparation;
4. returned-review import;
5. review-context inspection.

Author-side self-check is Dove checking the current work from the author side. It can inspect the paper, target venue, evidence, likely reader objections, and source support, then return concrete findings and a recommendation. It is not independent external review.

`dove-review` is the separate review path. For a near-submission paper, Dove can run `dove review handoff --project <dir> --venue <venue> --material <path>...` to freeze the current paper and listed submission materials for an isolated Claude Code reviewer context. Use `dove review resume --id <id>` to continue the current frozen round, `dove review rerun --id <id> --material <path>...` after substantive changes to review a new full snapshot in the same reviewer session, and `dove review import --id <id> --file <report.md>` to preserve a user-provided return without claiming runtime provenance. The returned review is preserved as evidence for author-side analysis, rebuttal, or revision.

### Rebuttal

Use `/dove:rebuttal` for author-side response and revision. Dove reads the review and artifacts, checks which findings hold, identifies needed evidence or edits, drafts responses, and makes requested changes. New citations and new experiment explanations must come from actual checked material.

### Lessons

Use `/dove:lessons` to read or maintain reusable advice when it may improve current or future work. Lessons are not proof that a claim, review, or project is correct.

## Submission readiness

For a paper submission goal, Dove normally treats LaTeX source and the compiled output as the working paper unless the target venue requires another format. Readiness depends on the current full paper, evidence, figures, review findings when required, and the venue's real delivery requirements together. A build pass, old review, generated file, or Markdown update does not by itself prove readiness.

## Maintenance commands

From an initialized project:

- `dove update` refreshes package-managed integration and preserves `.dove/research/**`, `.dove/reviews/**`, and `.dove/runs/**`.
- `dove doctor` reports software and local readability facts without repairing research content. Old legacy research data is reported and left in place; Dove does not automatically convert or delete it.
- `dove reinstall` previews its deletion and replacement scope and defaults to No.
- `dove uninstall` removes Dove-owned integration after confirmation while preserving research Markdown, `.dove/reviews/**` review records, `.dove/runs/**` run receipts, and ordinary project files.

Maintainer source-checkout checks are documented in the development and packaging guides. Software checks do not prove scientific correctness, research completion, acceptance, independent review, or Dove research quality.
