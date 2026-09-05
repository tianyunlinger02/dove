# Usage

Dove helps move a research project forward. For a confirmed goal, it keeps working while another useful in-scope step can help. It asks when the next step needs your decision, permission, or a material change in direction. Pure questions and bounded requests can finish without starting a larger project.

## Start using Dove

Install an exact trusted Dove artifact once for the current user, then initialize the target project:

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove
```

The bare public npm package name `dove` is unrelated. For package trust, lifecycle operations, host setup, and permissions, see [Installation](INSTALL.md).

## Entry modes

- **Ordinary Claude conversation** uses the project rule's shared research judgment. Normal host routing remains in charge; there is no `UserPromptSubmit`, hidden intake, or replacement per-prompt hook.
- **`claude --agent dove`** starts a full author-side research session. This is the place for ongoing mainline work and decisions that need the full conversation or user clarification.
- **A Dove subagent** can investigate a bounded research question when separate context helps. Give it a clear question, relevant materials, and a return scope. Do not delegate work that needs the full user conversation, important clarification, or continuing ownership of the author's mainline. Separate context does not create a new persona or automatically make the task an independent paper review.
- **`/dove:*` commands** are nine flat capability shortcuts for the same Dove, not stages or an Auto mode. DSH receives these as project-local filesystem Skills rather than Claude commands or agent integration.

| Skill | Use it for |
|---|---|
| `dove.research` | Advance a research goal and choose the next useful step. |
| `dove.status` | Read research notes, open questions, and next priorities without writing. |
| `dove.source` | Find, read, check, and use relevant sources, including bounded bibliography DOI identity checks. |
| `dove.experiment` | Design experiments, analyze results, record findings, or explicitly run diagnostics and experiments. |
| `dove.draft` | Draft, assess, or revise text and project artifacts from real evidence. |
| `dove.figure` | Gather materials, draw or revise figures, inspect them in context, and caption them. |
| `dove.review` | Do author-side self-check, delivery review, isolated review handoff, returned-review import, or inspection. |
| `dove.rebuttal` | Analyze findings, write responses, and make requested evidence-backed revisions. |
| `dove.lessons` | Read or maintain reusable advice that may improve research judgment. |

## Tools and sources

Dove uses only tools the current host exposes and the project permits. Claude project setup declares paper-search and webpage-reading support; declaration is not approval or proof of connectivity. If a needed source or tool is unavailable, Dove names the gap and uses other available material or asks for the necessary permission. It does not replace unavailable retrieval with shell, `curl`, or custom-fetch scripts.

## Research Markdown

Research context lives under `.dove/research/` as ordinary Markdown. Fresh initialization creates only `RESEARCH.md`. Mission, Source, Experiment, Review, Claim, and Lesson documents appear when useful, not merely because a Skill ran.

Record the research direction, important conclusions, inspected evidence, experiment plans and results, review exchanges, or reusable Lessons when the user asks, a material judgment changes, or the notes have real evidence or continuation value. Use ordinary relative links and readable project-relative artifact paths when they help a future reader recover the work. There are no required headings, generated IDs, frontmatter, link parsers, backlink audits, or research databases.

Update, SessionStart sync, reinstall, and uninstall preserve existing `.dove/research/**`, `.dove/reviews/**`, and `.dove/runs/**` content. Research Markdown is not package-managed integration.

## Working with the nine capabilities

### Research

Use `/dove:research` for “advance this goal.” Dove chooses source work, analysis, experiment, coding, drafting, figures, review handling, or another useful action. It stops when the goal is reached, real investigation finds no effective in-scope path, or the next step needs a user decision or outside permission/limit. Open exploration remains explicitly provisional until the user confirms the direction.

### Status

Use `/dove:status` to read current research notes and relevant project material without writes. Missing overviews and broken links are ordinary documentation facts. Keep the visible conversation and current development work distinct from durable research notes; the newest record is not necessarily the mainline.

SessionStart is not Status. Only after **compact/resume**, its read-only facts card reports:

- `RESEARCH.md` existence and absolute modification time;
- latest Review by `updatedAt`: id, current round, absolute update time, and material currentness;
- latest Run by `startedAt`: id, absolute start time, status, and exit code.

Missing or unreadable facts stay `unavailable`. The card does not read research Markdown bodies, review reports, or stdout/stderr logs, summarize research, choose a next step, or infer the current mainline. It reads review metadata and run journals; Review currentness compares the latest round's listed project files with its internal snapshot receipt. **Startup/clear gets no research card.** Dove must still use the visible conversation and relevant materials to understand what to continue.

### Source

Use `/dove:source` to turn external material into research judgment. Material found, identity-verified, retrieved, inspected, and used are different things. Citation identity is separate from support for a claim.

When a DOI matters and direct lookup is exposed and permitted, check it before fuzzy title search. Compare DOI, title, authors, year, and venue or version; report verified, conflict, not-found, or unknown. A requested **bounded bibliography DOI identity check** is within Source's scope: check only the selected entries. Metadata verification does not establish full-text inspection or claim support. Keep checks transient unless they change a manuscript citation, research judgment, or useful continuation context; do not build a ledger, cache, or BibTeX parser.

Ordinary source work stays proportional. Explicit systematic review, meta-analysis, evidence grading, or auditable synthesis uses an appropriate structured method.

### Experiment

Use `/dove:experiment` for design-only work, requested execution, existing-result analysis, retrospective recording, or diagnostics. Before a central experiment, establish the uncertainty it should resolve, the strongest alternative explanation, and what result would matter. If that basis is missing, inspect the actual project or sources, or do a small diagnostic rather than inventing a substitute central experiment.

When newly executed central work needs recording, write the plan before execution and append actual results to the same Experiment document. Keep retrospective records retrospective. Check surprising or unstable results for implementation, data, configuration, randomness, metric, baseline, and analysis errors before using them scientifically.

### Run receipts

`dove run` keeps local execution evidence for explicit experiments or diagnostics:

```bash
dove run start --project <dir> --id <id> --group <name> --seed <short-text> --metric-name <name> --direction min|max --timeout-ms <ms> -- <command> [args...]
dove run status --project <dir> --id <id>
dove run resume --project <dir> --id <id>
dove run finalize --project <dir> --id <id> --metric-value <number>
dove run compare --project <dir> --group <name>
```

`start` launches a detached supervisor that directly spawns the target from the project root without a shell. It writes `.dove/runs/<id>/run.jsonl`, `stdout.log`, and `stderr.log`. The receipt records command, timing, outcome, metric, budget and comparison basis, plus an explicitly declared seed and minimum Git facts: commit and dirty `true`/`false`/`null`. It is not an environment inventory. Git capture failure leaves unknown facts as `null` without blocking the run; a declared seed does not prove the target used it. Do not put secrets in command arguments or basis fields.

Ordinary completion writes one `run.terminal`. `status` is read-only. `resume` never reruns: it reports terminal, live, or orphaned observations, and records interrupted reconciliation only when neither supervisor nor target is observable and the terminal event is missing. `finalize` appends one scalar metric after terminal completion, with an optional decision or note. `compare` ranks only terminal finalized runs with matching metric, budget, data, evaluator, and resource basis; otherwise it reports `comparable: false` and mismatched fields. Git commit/dirty do not affect comparability or ranking. Receipt compatibility is not a scientific comparability or reproducibility guarantee.

Budget metadata describes the comparison basis, not prepaid resources or an automatically enforced spending cap. Actual work still respects explicit user limits, permissions, and timeout controls. POSIX timeouts signal the target process group and only cover same-group descendants; Windows termination is direct-child best effort.

### Draft

Use `/dove:draft` to create, assess, or revise text from inspected evidence. Dove does not silently strengthen or weaken claims. Methods, Results, citations, samples, data, and field facts come from actual project or source material. Preserve the user's current authoritative manuscript format; for a new manuscript, default to LaTeX source and inspect its actual compiled output when the venue accepts LaTeX. If the venue does not accept LaTeX, use its required format rather than forcing a conversion.

### Figure

Use `/dove:figure` to gather materials, draw, redraw, generate, revise, inspect, and caption figures. Choose tools from what the figure must show. Quantitative figures use real data. Check important figures in their real manuscript context: inspect the rendered figure, caption, nearby claims, placement, and legibility at near-final size in the actual compiled manuscript, not just as isolated previews.

### Review

Use `/dove:review` for author-side scientific self-check, delivery review, `dove-review` handoff, faithful review import, or read-only context inspection. Author-side self-check is useful but not independent external review; delivery checks do not decide scientific acceptability.

**Isolated review is the same researcher in a reviewer position**, not a second persona. It shares evidence discipline but reconstructs and challenges the contribution from the frozen materials instead of inheriting the author's mainline or carrying out author revisions. For a complete paper it asks:

1. Does the method answer the research question?
2. Are the mechanisms, terms, comparisons, literature, counterexamples, and limits correct for the field?
3. Do the contribution, evidence, scope, and expression fit the target venue and readers?
4. What is the strongest reasonable objection, and what evidence or revision would answer it?

The requested return has four Markdown headings: `Verdict`, `Blocking issues`, `Grounding basis`, and `Author-side next actions`. These guide the review; the runtime does not parse them into an acceptance gate. Local paragraph, figure, citation, or method review stays within its requested scope.

For a near-submission paper, use `dove review handoff --project <dir> --venue <venue> --material <path>...` with the current complete paper, authoritative source, actual compiled output, supplements, and other submission materials. The runtime copies only listed files into an isolated Claude Code workspace and exposes Read only. It provides no web/MCP access or author private conversation. Obtain necessary venue rules and literature on the author side and include them explicitly; missing grounding limits the review rather than permitting unlisted retrieval.

`resume` continues the current frozen round. `rerun --material <path>...` reviews a new complete snapshot in the same reviewer session after substantive changes. That session retains its own earlier review history; it does not gain access to author-side Review files or other unlisted project files. `import --file <report.md>` preserves a supplied return as imported provenance, not a runtime-generated review.

`dove review status --id <id>` compares snapshot receipts with current project files read-only. Public human and CLI JSON results report paths, safe size/existence/type/error facts, and `current`, `changed`, `missing`, or `unavailable`, without SHA fields or interpreting report verdict text. Hashes are internal byte-comparison metadata, not research evidence. Current material bytes alone do not establish a current scientific verdict.

Preserve the actual return. Author-side analysis treats findings as evidence, not automatic orders to rewrite, narrow claims, or declare failure. A session id, a prompt, or a software check alone does not prove reviewer independence or external acceptance.

### Rebuttal

Use `/dove:rebuttal` for author-side response and requested revision. Check which findings hold, identify useful evidence or changes, and respond from inspected material. New citations and experiment explanations require actual sources and results.

### Lessons

Use `/dove:lessons` for reusable advice that may improve current or future work. Lessons are fallible guidance, not proof that a claim or project is correct.

## Submission readiness

Submission work starts from the user's current authoritative manuscript and the venue's actual format requirements. For new manuscripts, LaTeX source and actual compiled output are the default only when the venue accepts LaTeX. Readiness depends on the current complete paper, evidence, figures, required review, and real delivery requirements together. A build pass, old review, generated file, or Markdown update alone is not readiness.

## Maintenance commands

- `dove update` refreshes manifest-owned integration, **replaces its local edits**, and reports what was replaced in human output and `replacedLocalEdits` JSON. Unowned files and unrelated configuration remain protected.
- SessionStart **skips local edits**, syncs the remaining safe resources, and reminds the user through `systemMessage`. It updates disk resources, not already-loaded host context.
- `dove doctor` reports software and readability facts without repairing research content or testing live tool readiness.
- `dove reinstall` and `dove uninstall` preview their real scope and require default-No confirmation. Research Markdown, review records, run receipts, Doctor notes, and ordinary project files remain preserved.

Dove does not install or manage `statusLine`. The retained `dove hook statusline` helper is only for user-owned composition scripts. `UserPromptSubmit` and intake are retired with no replacement per-prompt hook. See [Installation](INSTALL.md) for exact ownership and retirement rules.

Software validation is separate from scientific correctness, research completion, acceptance, independent review, and Dove research quality.
