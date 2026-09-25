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

- **Ordinary Claude conversation is the primary and complete Dove entrance.** Start `claude` in the initialized project and describe the task. The project rule supplies shared judgment and author stance for relevant research, engineering, experiment, writing, and collaboration work, so the main session can use the same capability methods naturally without a command. It owns ongoing mainline work, result adoption, and decisions requiring the full conversation or clarification. Normal host routing remains in charge. Claude's `UserPromptSubmit` supplies a deterministic short re-anchor on every prompt, without classification, research reads/writes, permission decisions, or blocking; it is not hidden intake, a router, a mode, or workflow state.
- **`claude --agent dove`** is an optional explicit entrance for long author-side sessions, with no higher judgment authority than the ordinary installed main session.
- **A Dove subagent** can investigate a bounded research question when separate context helps. Give it a clear question, relevant materials, and a return scope. Do not delegate work that needs the full user conversation, important clarification, or continuing ownership of the author's mainline. Separate context does not create a new persona or automatically make the task an independent paper review.
- **`/dove:*` commands** are nine optional flat capability shortcuts for the same Dove, not stages, higher authorities, permission grants, or an Auto mode. DSH receives these as project-local filesystem Skills rather than Claude commands or agent integration.

| Skill | Use it for |
|---|---|
| `dove.research` | Advance a research goal and choose the next useful step. |
| `dove.status` | Read research notes, open questions, and next priorities without writing. |
| `dove.source` | Find, read, check, and use relevant sources, including bounded bibliography DOI identity checks. |
| `dove.experiment` | Design, run when authorized, analyze, or record exploration, diagnostics, confirmation, reproduction, and delivery checks. |
| `dove.draft` | Draft, assess, or revise text and project artifacts from real evidence. |
| `dove.figure` | Gather materials, draw or revise figures, inspect them in context, and caption them. |
| `dove.review` | Do author-side self-check, delivery review, isolated review handoff, returned-review import, or inspection. |
| `dove.rebuttal` | Analyze findings, write responses, and make requested evidence-backed revisions. |
| `dove.lessons` | Read or maintain reusable advice that may improve research judgment. |

## Short core and two reference read contracts

Claude's project rule and standalone DSH Skills carry a short shared research core. Both hosts install two package-managed references with separate responsibilities:

| Reference | Role and when to read |
|---|---|
| `.dove/install/RESEARCH_QUALITY.md` | Full substantive quality criteria and joint conditions for the current use. Read before consequential grading, route/investment or scale-up decisions, core/submission conclusions, and after decision-changing counterevidence, task-identity changes, or cross-dimensional tradeoffs. |
| `.dove/install/AUTHOR_PREFERENCES.md` | Full author-side research, engineering, writing, and collaboration preferences. Each fresh host main-agent context must personally read it completely before substantive work, then apply relevant preferences within the current request and project constraints. Its sole editable source is [Author preferences](AUTHOR_PREFERENCES.md). |

Claude startup and `/clear` receive a read-only SessionStart bootstrap requiring the current main agent—ordinary Claude or explicit Dove—to personally complete that full read, following offsets through EOF if needed. DSH has no SessionStart, so its first author-side Dove Skill use in a context requires the same read if the current main agent has not completed it there. Compact/resume continues using preferences already read in the same main context and does not unconditionally reread the full file. Installation, a bootstrap instruction, or another agent's read does not establish completion. Reuse active-context guidance and evidence whose conditions still hold. Neither reference is evidence, a permission grant, an optional Lesson, or a full-task checklist. Unavailable guidance limits what can be judged; do not invent grades or assume missing preferences. Bounded subagents receive relevant constraints from the main agent rather than performing the bootstrap. Isolated review receives its own quality reference only; it does not gain author-preference access. DSH Status remains inspection/reporting only, without author stance or its preference-read trigger.

## Scope, plans, and progress

Ordinary tasks with no research impact finish normally without research planning, grading, or records. Engineering that implements, diagnoses, optimizes, or delivers a research route is research work and retains relevant scientific responsibilities; calling it engineering does not exempt a consequential choice from the confirmed goal.

The confirmed mainline determines what is most worth doing now, seeking the shortest total problem–method–contribution path rather than the fewest local steps. Repeated user corrections require changing the mistaken interpretation and dependent plan, not another acknowledgment followed by the same work. Controls and baselines serve the question and contribution; they must not become a substitute objective. The scientific core is the valuable problem, task-matched proposition, and intended contribution; the engineering core is the necessary capability and actual producer-consumer behavior that realizes the method—not the largest backlog, an inherited executable plan, a mature module, or the easiest acceptance target. When forming or adopting plans, completing meaningful work, adopting delegated results, or expanding investment, choose the most valuable unfinished core gap using the user's current goal and completion meaning—not the branch, latest task, or last completed item. Compare direct core work with support by benefit, total cost, and dependencies. Support earns priority by removing a real blocker, avoiding grounded rework, or improving an agreed result, not by being easier to complete, check, or report.

Check consequential choices against necessary capabilities, permitted information, evaluation, resources, and fixed conditions; reuse settled context rather than rescan every step. Known conflicts stop dependent investment until correction or a necessary user decision, not independent useful work. If a stretch of work neither advances the core, removes a necessary dependency, nor yields decision-changing information, reprioritize instead of extending the same peripheral backlog. Necessary implementation may span multiple work units; no per-round quota, mainline report, or automatic research record is required. Explain tradeoffs briefly when deviation is plausible or a real choice needs explanation.

New-route or intended-contribution investment needs proportionate scientific admission. A requested interface or input-output capability is an engineering boundary, not proof of scientific value. Treat available data, supervision, teacher outputs, supplied solutions, prototypes, and inherited implementations as constraints, evidence, or candidates rather than definitions of the goal, reference truth, success, or default method; teacher agreement establishes agreement, not correctness. Reconstruct the unmet phenomenon, knowledge gap, or practical need independently, allowing the conclusion that a simpler existing solution suffices or no research contribution remains. For a new claimed contribution, use targeted near-neighbor subtraction before consequential implementation when it can change the core design or investment, without making exhaustive search a prerequisite for an informative prototype or confirmed bounded work.

For a consequential new method, first say what its mechanism predicts relative to a same-information simple alternative: expected direction, conditions and a meaningful magnitude only if grounded, plus what observation would challenge it. Before scaling a test, check that the selected objects have the required target/reference, comparable control, identifying metric, failure accounting, and permission to execute. Compare actual results with the original expectation and investigate consequential mismatch in implementation, data, evaluation, control, or mechanism before extending investment. Once the proposition, method obligations, necessary capability, evaluation route, constraints, and resources are clear enough for authorized work, stop broad search and abstract reassessment. Translate the selected mechanism, information flow, and distinguishing prediction into necessary operations, one authoritative producer-consumer path, invariants, visible failures, and the observation that can identify the claim, then implement iteratively through decision-relevant complete slices connecting actual production, downstream consumption, and proportionate checks. Inspect the feedback, fix shared causes or revise the design, and extend toward the agreed capability and effective scale; the slice need not be small or follow fixed rounds, and local success is not whole-goal completion. Contract tests establish implementation behavior; claim-matched controls and evaluation establish only the scientific claim they identify. Neither substitutes for the other, and an executable prototype or sunk effort does not promote a candidate into the main method. This is ordinary research-to-engineering reasoning, not another stage, schema, or gate.

Complete explicit reproduction, implementation, repair, installation, review, or delivery requests within their agreed scope and with task-matched checks; mainline priority neither rejects nor expands them or automatically reopens novelty. Unknown effects alone do not block authorized implementation when the current scientific contract is clear enough to guide it. Concrete threats to correctness or feasibility require reassessment; prior approval does not erase a current conflict.

Separate **research participation**, **completion of the requested work**, and **scientific progress**. A bounded engineering or delivery task can finish without new science. Scientific progress needs evidence of changed understanding, target research capability against a valid reference, or a defensible research decision; coding, running, searching, or recording alone is insufficient. A component effect or local metric supports only the local claim it identifies and warrants deepening only when it materially strengthens a still-worthwhile whole contribution. Reliable negative findings can advance knowledge without improving the rejected method. Judge continued investment prospectively from remaining value, information, future and opportunity costs, alternatives, and stopping value; past effort matters only through reusable capability or evidence, changed remaining cost, switching cost, or future options.

Use evaluation to decide, not to decorate a report: connect decision-relevant quality reasons to the affected proposition, candidate, and dependencies, then change an authorized action, dependent investment, claim, or deliverable—or explain from inspected grounds why no change follows and close the bounded evaluation. Capability and delegated returns remain scoped candidate results until the ordinary main session adopts, limits, or rejects them. Cross-capability handoffs carry only the result, evidence, scope, unknowns, dependency impact, and needed action; they do not automatically invoke another Skill or authorize execution, writes, isolated review, or outward action. For an active research goal, the main session applies a consequential Source, Experiment, Draft, Figure, or Review result to affected work and performs the next effective permitted action in the same session instead of stopping at the capability report. After a correction invalidates a premise, stop dependent work and revise active tasks, delegations, resource choice, and downstream artifacts before continuing; a restriction on one run does not automatically settle the best future method. Where a necessary next experiment lacks permission, explain its concrete authorization scope without executing it. Bounded tasks still end at their agreed result.

## Tools and sources

Dove uses only tools the current host exposes and the project permits. Claude project setup declares paper-search and webpage-reading support; declaration is not approval or proof of connectivity. If a needed source or tool is unavailable, Dove names the gap and uses other available material or asks for the necessary permission. It does not replace unavailable retrieval with shell, `curl`, or custom-fetch scripts.

## Research Markdown

Research context lives under `.dove/research/` as ordinary Markdown. Initialization creates only `RESEARCH.md` when the research directory is absent. If that directory already exists, it stays untouched even when the overview is missing. Mission, Source, Experiment, Review, Claim, and Lesson documents appear when useful, not merely because a Skill ran.

Record the research direction, important conclusions, inspected evidence, experiment plans and results, or review exchanges when the user asks, a material judgment changes, or the notes have real evidence or continuation value. Lessons use a separate reusable-value standard: at an important choice or after a correction or recurring failure, the ordinary author-side session checks `lessons/LESSONS.md` once for the current question when it has not already done so, then reads only decision-relevant links. Missing Lessons do not block work or create an empty index. When actual work yields experience meeting that reusable-value standard, and the existing author-side write scope and authorization permit it, Dove actively preserves the narrowest Lesson without requiring `/dove:lessons` or a mainline change. Routine progress, transient status, one-off tool failures, non-transferable bugs, read-only work, Status, and isolated review do not write Lessons. Use ordinary relative links and readable project-relative artifact paths when they help a future reader recover the work. There are no required headings, generated IDs, frontmatter, link parsers, backlink audits, research databases, or Research Spine schema/ledger.

The project has a current research mainline confirmed by the user. The overview may include one ordinary top-level line `Mainline: <text>` near its beginning as the statusline source, not a heading, list, quote, code block, frontmatter, or schema. Research maintains this concise line only on first user confirmation or a user-confirmed material mainline change, and only when overview maintenance is already warranted. Missing lines, routine invocations, local method changes, and provisional results do not trigger backfilling. Status remains read-only: it reports explicit decisions and conflicts without inferring the mainline from a Git branch or latest Mission, Run, or Review.

Update, read-only SessionStart, reinstall, and uninstall preserve existing `.dove/research/**`, `.dove/reviews/**`, and `.dove/runs/**` content. Fresh bootstrap remains unchanged; existing research trees are not migrated for display. Research Markdown is not package-managed integration.

## Working with the nine capabilities

### Research

Use `/dove:research` for “advance this goal.” Choose work that implements, tests, or strengthens evidence for the core contribution, including necessary engineering and validity checks. A credible positive signal is preliminary support for a key part of that contribution from actual observations, valid derivation, or inspected material—not passing tests, a successful run, arbitrary metric gain, or final sufficient evidence. With a signal, test its credibility and contribution meaning, address important alternatives, then deepen or proportionately scale investment when justified. Without one, distinguish not yet implemented or validly tested, implementation/evaluation problems, and an unsupported hypothesis; choose work that can change that judgment, without requiring positive evidence before authorized core implementation. Reliable negative findings and counterexamples can contribute knowledge; never chase positive signals by selecting samples, changing criteria, or hiding counterevidence. Open exploration stays provisional. Stop at completion, no effective in-scope path, or a required user decision or external boundary.

Before committing to or materially changing an important route, method, hypothesis, evaluation target, or central experiment, identify the core proposition, assumptions, simple alternatives, and distinguishing outcomes. Use derivation, counterexamples, or small diagnostics as needed to confirm or revise method, baseline, metric, and investment decisions—not to add a fixed theory preamble or force changes to an already sound design. Inspect targeted external knowledge when it can change the decision; reuse checked evidence while its conditions still hold, revisiting material changes, contradictions, or decision-relevant gaps.

After delegation, the main session synthesizes decisive evidence, subtask scope, unresolved limits, and contradictions before choosing the next action; completion notices, majority opinion, or stitched reports are not scientific judgment. Distinguish support, refutation, insufficient evidence, and a comparison that cannot identify the claim. Further investigation must not indefinitely defer accepting counterevidence, and success on a new route does not erase failure of the original proposition. Recognizing refutation needs no approval; materially changing the confirmed mainline or completion meaning does.

### Status

Use `/dove:status` to read current research notes and relevant project material without writes. Missing overviews and broken links are ordinary documentation facts. Keep the visible conversation and current development work distinct from durable research notes; the newest record is not necessarily the mainline. For a narrow status request, report a visible conflict with its sources and affected scope, without silently reconciling files, broadening investigation, or choosing a new mainline.

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

Experiment separates **request mode** from **purpose**. Design-only, requested execution, existing-result analysis, and retrospective recording determine what work is authorized; exploration, diagnostics, confirmation, and reproduction/delivery determine what it must establish.

- **Exploration** may discover phenomena, test feasibility, or form explanations without a predeclared claim or predetermined code change.
- **Diagnostics** locate a specific capability, correctness, information, or resource bottleneck; act once enough is known rather than repeat low-information checks.
- **Confirmation** specifies the claim or question, relevant predictions, comparisons, alternatives, and judgment criteria before testing. Keeping implementation and protocol unchanged can add necessary evidence.
- **Reproduction/delivery** checks agreed behavior, conditions, references, and actual use without reopening novelty by default.

Temporary versus final use is separate from exploratory versus confirmatory evidence. Accurately bounded exploratory findings may be final results, but later explanations are not retroactive independent confirmation. A useful run need not change code or select a new route.

Trace actual inputs → method outputs → suitable evaluation basis → metrics → comparison, including failures, exclusions, and denominators. Use pairing, uncertainty, dependence, and final-test independence where applicable. Check ablations against actual code, configuration, and outputs: a whole implementation winning is not automatically a component gain or mechanism evidence. If the comparison cannot identify the contribution, compare a suitable repair, evaluation redesign, alternative route, further evidence, or stopping; keep current conclusions within the evidence rather than defaulting to small controls, claim narrowing, or more runs.

Reuse inspected evidence while its conditions hold; new data, methods, evaluation chains, or decision-relevant gaps call for targeted checks, not a full rescan. Run a representative diagnostic only when needed and authorized; small samples check chain semantics and implementation, not population-level statistical sufficiency. Design-only stays read-only apart from delivering the plan and unverified limits, without executing diagnostics. Analyze existing results directly and keep retrospective records retrospective. For authorized new central work that needs recording, successfully save the plan before execution and append actual results and interpretation-changing deviations to that same document—no new template or gate. Check surprising or unstable results for implementation, data, configuration, randomness, metric, baseline, and analysis errors before using them scientifically.

For consequential CPU/GPU/accelerator choices, inspect the representative end-to-end route: loading and transfers, core computation, synchronization, evaluation, outputs, and required downstream use. Reuse applicable measurements or profile only when execution is authorized. Compare total time to useful evidence or delivery, including implementation, repeated runs, and known recovery costs—not one utilization signal, kernel timing, or convenient code path. Use suitable available acceleration without forcing every stage onto it or maintaining a redundant full CPU fallback; preserve necessary capability and effective scale. After optimization, recheck affected numerical/output semantics, information boundaries, evaluation, and budget comparability. Design-only permits inspection and estimates, not profiling execution; unrelated local work needs no profiling ritual.

### Run receipts

`dove run` is an optional receipt helper for explicit, authorized experiments or diagnostics. It is not required to execute or adopt research work and does not grant execution permission:

```bash
dove run start --project <dir> --id <id> --group <name> --seed <short-text> --metric-name <name> --direction min|max --timeout-ms <ms> -- <command> [args...]
dove run status --project <dir> --id <id>
dove run resume --project <dir> --id <id>
dove run finalize --project <dir> --id <id> --metric-value <number>
dove run compare --project <dir> --group <name>
```

`start` launches a detached supervisor that directly spawns the target from the project root without a shell. It writes `.dove/runs/<id>/run.jsonl`, `stdout.log`, and `stderr.log`. The receipt records command, timing, outcome, metric, budget and comparison basis, plus an explicitly declared seed and minimum Git facts: commit and dirty `true`/`false`/`null`. It is not an environment inventory. Git capture failure leaves unknown facts as `null` without blocking the run; a declared seed does not prove the target used it. Do not put secrets in command arguments or basis fields.

Ordinary completion writes one `run.terminal`. `status` is read-only. `resume` never reruns: it reports terminal, live, or orphaned observations, and records interrupted reconciliation only when neither supervisor nor target is observable and the terminal event is missing. `finalize` appends one scalar metric after terminal completion, with an optional decision or note. `compare` ranks only terminal finalized runs with matching metric, budget, data, evaluator, and resource basis; otherwise it reports `comparable: false` and mismatched fields. Git commit/dirty do not affect comparability or ranking. Receipt compatibility is not a scientific comparability or reproducibility guarantee; terminal, finalized, compared, or successful records do not interpret scientific meaning, adopt a result, or trigger another capability.

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

A Review remains scientifically current only for the complete version, frozen materials, venue grounding, scope, and unresolved issues it actually judged. Material changes to contribution, evidence, claims, figures, or delivery require a new complete round in the same isolated context; unaffected local findings may remain useful only in their original scope. Latest timestamp, successful runtime status, or unchanged bytes alone do not make an old recommendation current for submission.

Preserve the actual return. Author-side analysis treats findings as reasoned objections, not empirical evidence or automatic orders to rewrite, narrow claims, or declare failure. A session id, a prompt, or a software check alone does not prove reviewer independence or external acceptance.

### Rebuttal

Use `/dove:rebuttal` for author-side response and requested revision. Check which findings hold, identify useful evidence or changes, and respond from inspected material. New citations and experiment explanations require actual sources and results.

### Lessons

Use `/dove:lessons` when a focused read or maintenance request helps, but the command is not required for ordinary author-side participation. At consequential choices, corrections, or recurring failures, Dove can check the Lessons index once for the current question and apply only relevant guidance. When actual work yields transferable experience meeting the reusable-value standard, and the existing author-side write scope and authorization permit it, Dove actively preserves the narrowest Lesson even without a mainline change. Lessons retain applicability, counterexamples, and limits; routine activity and one-off failures stay unrecorded. They do not carry package-default author preferences or replace either reference, and remain fallible guidance rather than proof that a claim or project is correct.

## Submission readiness

Submission work starts from the user's current authoritative manuscript and the venue's actual format requirements. For new manuscripts, LaTeX source and actual compiled output are the default only when the venue accepts LaTeX. For a user-confirmed submission-completion goal, the same current complete version needs author-side scientific sufficiency, a current `dove-review` scientific-acceptability recommendation, and real delivery readiness. An unavailable independent-review runtime leaves that requirement unmet, not waived. Finishing a local review, figure edit, or polish request does not expand it into submission completion. A build pass, old review, generated file, or Markdown update alone is not readiness.

## Maintenance commands

- `dove update` refreshes manifest-owned integration, **replaces its local edits**, and reports what was replaced in human output and `replacedLocalEdits` JSON. Unowned files and unrelated configuration remain protected.
- SessionStart is **entirely read-only**. Non-current integration can produce a `systemMessage` suggesting explicit `dove update`; it never synchronizes resources or reloads already-active context.
- `dove doctor` reports software and readability facts without repair or live tool probes. Integration uses four states: `uninitialized`, `current`, `needs-update`, and `blocked`. Absent or unsupported manifests are not adopted or migrated; unknown files remain untouched.
- `dove reinstall` and `dove uninstall` preview their real scope and require default-No confirmation. Research Markdown, review records, run receipts, Doctor notes, and ordinary project files remain preserved.

When `.claude/settings.json` has no existing `statusLine`, Claude integration installs the read-only `dove hook statusline` display. The first line shows Claude Code's native model, total context capacity, remaining-context percentage, the mainline text in cyan without a label, Git branch, and current-session duration; the second line contains only the absolute project path. Only a nonempty `NO_COLOR` disables color. The only research read is the root `.dove/research/RESEARCH.md`, limited to 64 KiB, for its unique ordinary `Mainline: <text>` line. Missing, empty, duplicate, oversized, or unreadable sources omit the mainline, without guessing from other prose or records. No research-tree scan, Mission, Review, Run, or transcript read is used; the branch is not a confirmed scientific mainline and session duration is not cumulative research time. An existing user or Trellis status line remains user-owned and is not replaced or adopted. The short prompt re-anchor does not change SessionStart; hidden intake, routing hooks, Stop scheduling, and per-tool scientific approval remain prohibited. Reload an active host session after integration installation or update; disk changes do not establish live loading. See [Installation](INSTALL.md) for exact ownership rules.

Software validation is separate from scientific correctness, research completion, acceptance, independent review, and Dove research quality.
