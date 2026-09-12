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

## Short core and on-demand quality reference

Claude's project rule and standalone DSH Skills carry a short shared research core. Both hosts install the full package-managed guidance at `.dove/install/RESEARCH_QUALITY.md`; it is not a Lesson or research evidence. Dove proactively reads it before substantive grading, consequential route selection, major investment or experiment scale-up, core-claim or submission-completion judgments, and after decisive counterevidence, task-identity changes, or cross-dimensional tradeoffs that may change the decision. Apply the relevant criteria and joint conditions, reuse already-read guidance and still-applicable evidence, and keep local work local. If the reference is unavailable, report the limitation rather than invent grades or equate checks with scientific acceptance. Reading guidance grants no new tool, execution, or material access.

## Tools and sources

Dove uses only tools the current host exposes and the project permits. Claude project setup declares paper-search and webpage-reading support; declaration is not approval or proof of connectivity. If a needed source or tool is unavailable, Dove names the gap and uses other available material or asks for the necessary permission. It does not replace unavailable retrieval with shell, `curl`, or custom-fetch scripts.

## Research Markdown

Research context lives under `.dove/research/` as ordinary Markdown. Initialization creates only `RESEARCH.md` when the research directory is absent. If that directory already exists, it stays untouched even when the overview is missing. Mission, Source, Experiment, Review, Claim, and Lesson documents appear when useful, not merely because a Skill ran.

Record the research direction, important conclusions, inspected evidence, experiment plans and results, review exchanges, or reusable Lessons when the user asks, a material judgment changes, or the notes have real evidence or continuation value. Use ordinary relative links and readable project-relative artifact paths when they help a future reader recover the work. There are no required headings, generated IDs, frontmatter, link parsers, backlink audits, or research databases.

Update, read-only SessionStart, reinstall, and uninstall preserve existing `.dove/research/**`, `.dove/reviews/**`, and `.dove/runs/**` content. Research Markdown is not package-managed integration.

## Working with the nine capabilities

### Research

Use `/dove:research` for “advance this goal.” Dove chooses source work, analysis, experiment, coding, drafting, figures, review handling, or another useful action. It stops when the goal is reached, real investigation finds no effective in-scope path, or the next step needs a user decision or outside permission/limit. Open exploration remains explicitly provisional until the user confirms the direction.

Before committing to or materially changing an important route, method, hypothesis, evaluation target, or central experiment, identify the core proposition, assumptions, simple alternatives, and distinguishing outcomes. Use derivation, counterexamples, or small diagnostics as needed to confirm or revise method, baseline, metric, and investment decisions—not to add a fixed theory preamble or force changes to an already sound design. Inspect targeted external knowledge when it can change the decision; reuse checked evidence while its conditions still hold, revisiting material changes, contradictions, or decision-relevant gaps.

After delegation, the main session synthesizes decisive evidence, subtask scope, unresolved limits, and contradictions before choosing the next action; completion notices, majority opinion, or stitched reports are not scientific judgment. Distinguish support, refutation, insufficient evidence, and a comparison that cannot identify the claim. Further investigation must not indefinitely defer accepting counterevidence, and success on a new route does not erase failure of the original proposition. Recognizing refutation needs no approval; materially changing the confirmed mainline or completion meaning does.

### Status

Use `/dove:status` to read current research notes and relevant project material without writes. Missing overviews and broken links are ordinary documentation facts. Keep the visible conversation and current development work distinct from durable research notes; the newest record is not necessarily the mainline.

SessionStart is not Status. Only after **compact/resume**, its read-only facts card reports:

- `RESEARCH.md` existence and absolute modification time;
- latest Review by `updatedAt`: id, current round, absolute update time, and material currentness;
- latest Run by `startedAt`: id, absolute start time, status, and exit code.

Missing or unreadable facts stay `unavailable`. The card does not read research Markdown bodies, review reports, or stdout/stderr logs, summarize research, choose a next step, or infer the current mainline. It reads review metadata and run journals; Review currentness compares the latest round's listed project files with its internal snapshot receipt. **Startup/clear gets no research card.** Dove must still use the visible conversation and relevant materials to understand what to continue.

### Source

Use `/dove:source` to turn external material into research judgment. Material found, identity-verified, retrieved, inspected, and used are different things. Citation identity is separate from support for a claim. For a composite claim, distinguish supported, contradicted, and uncovered parts; support for one part is not support for the whole. A check-only request reports that boundary without automatically editing the manuscript.

When a DOI matters and direct lookup is exposed and permitted, check it before fuzzy title search. Compare DOI, title, authors, year, and venue or version; report verified, conflict, not-found, or unknown. A requested **bounded bibliography DOI identity check** is within Source's scope: check only the selected entries. Metadata verification does not establish full-text inspection or claim support. Keep checks transient unless they change a manuscript citation, research judgment, or useful continuation context; do not build a ledger, cache, or BibTeX parser.

Ordinary source work stays proportional. Explicit systematic review, meta-analysis, evidence grading, or auditable synthesis uses an appropriate structured method.

### Experiment

Use `/dove:experiment` for design-only work, requested execution, existing-result analysis, retrospective recording, or diagnostics. Before a central experiment, establish the uncertainty, strongest alternative, and distinguishing result. Trace actual inputs → method outputs → suitable evaluation basis → metrics → comparison, including failures, exclusions, and denominators. Use pairing, uncertainty, dependence, and final-test independence where applicable. Check ablations against actual code, configuration, and outputs: a whole implementation winning is not automatically a component gain or mechanism evidence. If the comparison cannot identify the contribution, compare a suitable repair, evaluation redesign, alternative route, further evidence, or stopping; keep current conclusions within the evidence rather than defaulting to small controls, claim narrowing, or more runs.

Reuse inspected evidence while its conditions hold; new data, methods, evaluation chains, or decision-relevant gaps call for targeted checks, not a full rescan. Run a representative diagnostic only when needed and authorized; small samples check chain semantics and implementation, not population-level statistical sufficiency. Design-only stays read-only apart from delivering the plan and unverified limits, without executing diagnostics. Analyze existing results directly and keep retrospective records retrospective. For authorized new central work that needs recording, successfully save the plan before execution and append actual results and interpretation-changing deviations to that same document—no new template or gate. Check surprising or unstable results for implementation, data, configuration, randomness, metric, baseline, and analysis errors before using them scientifically.

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

Only `start` uses the hidden supervisor. `resume` and `finalize` append in the current process under the same bounded directory lock. If a journal lock remains occupied, Dove reports its absolute path; it never removes a lock based on PID, ownership metadata, or age. Inspect the reported path and confirm no writer is active before manually removing a leftover lock.

Budget metadata describes the comparison basis, not prepaid resources or an automatically enforced spending cap. Actual work still respects explicit user limits, permissions, and timeout controls. For POSIX Runs with an explicit timeout, leader exit does not complete the receipt while the process group remains observable: the original deadline stays active, and timeout termination retains the grace-period SIGKILL escalation. This does not cover descendants that leave that group; process-group observation is not proof of every descendant's outcome. Windows termination is direct-child best effort. Timeout and kill-grace values, including converted `--wall-time`, cannot exceed 2147483647 milliseconds; larger values are rejected before a Run is created.

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

For a near-submission paper, use `dove review handoff --project <dir> --venue <venue> --material <path>...` with the current complete paper, authoritative source in its existing format, actual built or exported output, supplements, and other submission materials. The runtime copies only listed user files into an isolated Claude Code workspace and exposes Read only. It also supplies the canonical package quality reference at `.dove-package/RESEARCH_QUALITY.md`, separate from user materials and snapshots; this guidance is not evidence and grants no additional access. It provides no web/MCP access or author private conversation. Obtain necessary venue rules and literature on the author side and include them explicitly; missing grounding limits the review rather than permitting unlisted retrieval.

`resume` continues the current frozen round. `rerun --material <path>...` reviews a new complete snapshot in the same reviewer session after substantive changes. Workspaces and mutation locks are project-scoped, so different projects may use the same review id without replacing each other's materials. A recorded workspace must match its project-scoped location; old unscoped or mismatched locations are rejected, not moved or silently reused. That session retains its own earlier review history; it does not gain access to author-side Review files or other unlisted project files. `import --file <report.md>` preserves a supplied return as imported provenance, not a runtime-generated review.

Before calling the reviewer, Dove saves the frozen round and a pending exchange. If the call times out or its return cannot be saved, `resume` attempts the original requested session with those same materials; it does not open a replacement session or recover an unsaved response. This also applies to a first-round timeout: the requested ID remains a candidate until a matching backend response confirms it. Resolve a pending exchange with `resume` before `rerun` or `import`. Materials already presented to the reviewer are not rolled back to an earlier version after a save failure. A forcibly terminated host can still leave a stale operation lock; automatic recovery of that lock is not provided.

`dove review status --id <id>` compares snapshot receipts with current project files read-only. Public human and CLI JSON results report paths, safe size/existence/type/error facts, and `current`, `changed`, `missing`, or `unavailable`, without SHA fields or interpreting report verdict text. Hashes are internal byte-comparison metadata, not research evidence. Current material bytes alone do not establish a current scientific verdict. Failed handoff/resume/rerun execution reports failure and exits nonzero; a successful read-only status query still exits zero when the stored review failed. A negative scientific recommendation is not a runtime failure.

Preserve the actual return. Author-side analysis treats findings as evidence, not automatic orders to rewrite, narrow claims, or declare failure. A session id, a prompt, or a software check alone does not prove reviewer independence or external acceptance.

### Rebuttal

Use `/dove:rebuttal` for author-side response and requested revision. Check which findings hold, identify useful evidence or changes, and respond from inspected material. New citations and experiment explanations require actual sources and results.

### Lessons

Use `/dove:lessons` for reusable advice that may improve current or future work. Lessons are fallible guidance, not proof that a claim or project is correct.

## Submission readiness

Submission work starts from the user's current authoritative manuscript and the venue's actual format requirements. For new manuscripts, LaTeX source and actual compiled output are the default only when the venue accepts LaTeX. For a user-confirmed submission-completion goal, the same current complete version needs author-side scientific sufficiency, a current `dove-review` scientific-acceptability recommendation, and real delivery readiness. An unavailable independent-review runtime leaves that requirement unmet, not waived. Finishing a local review, figure edit, or polish request does not expand it into submission completion. A build pass, old review, generated file, or Markdown update alone is not readiness.

## Maintenance commands

- `dove update` refreshes manifest-owned integration, **replaces its local edits**, and reports what was replaced in human output and `replacedLocalEdits` JSON. Unowned files and unrelated configuration remain protected.
- SessionStart is **entirely read-only**. Non-current integration can produce a `systemMessage` suggesting explicit `dove update`; it never synchronizes resources or reloads already-active context.
- `dove doctor` reports software and readability facts without repair or live tool probes. Integration uses four states: `uninitialized`, `current`, `needs-update`, and `blocked`. Absent or unsupported manifests are not adopted or migrated; unknown files remain untouched.
- `dove reinstall` and `dove uninstall` preview their real scope and require default-No confirmation. Research Markdown, review records, run receipts, Doctor notes, and ordinary project files remain preserved.

When `.claude/settings.json` has no existing `statusLine`, Claude integration installs the read-only `dove hook statusline` display. It uses Claude Code's native model, total context capacity, remaining-context percentage and current-session duration, while preserving the absolute project path and adding the Git branch. It does not read research Markdown, Review, Run, or transcripts; the branch is not a confirmed scientific mainline and session duration is not cumulative research time. An existing user or Trellis status line remains user-owned and is not replaced or adopted. `UserPromptSubmit` and intake remain retired with no replacement per-prompt hook. See [Installation](INSTALL.md) for exact ownership rules.

Software validation is separate from scientific correctness, research completion, acceptance, independent review, and Dove research quality.
