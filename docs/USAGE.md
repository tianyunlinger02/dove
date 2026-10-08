# Usage

Dove advances a user-confirmed research goal through short round briefs and actual evaluation results. The main session executes; a fresh read-only mentor judges the result and proposes the next round. Confirmation covers core implementation, reruns, diagnosis, and engineering decisions within your resource limits. Ask once only when the goal, intended claim or deployment inputs/outputs must change, or resources would exceed those limits; evaluator corrections within the same goal do not need renewed approval. Ordinary questions and bounded requests retain their scope and existing authorization.

## Start using Dove

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove
```

The bare public npm package name `dove` is unrelated. Use an exact trusted artifact; see [Installation](INSTALL.md) for package trust, setup, lifecycle operations, and permissions.

## Entry modes

- **Ordinary Claude conversation is the primary and complete Dove entrance.** Start `claude` in the initialized project. The project rule supplies shared judgment and author stance; the main session owns clarification, execution, the confirmed mainline, and adoption of results.
- **`claude --agent dove`** is an optional explicit author-side entrance, with no higher judgment authority.
- **Bounded Dove subagents** can investigate independent questions. Work needing the full user conversation, consequential clarification, or ongoing ownership stays in the main session.
- **`dove-mentor` and `dove-review`** are native Claude subagents for independent judgment, not additional personas or Skills. Every call uses a fresh context, only `Read`/`Grep`/`Glob`, and specified materials; no execution conversation or resumed history is supplied. The mentor alone reads genuine user records from the specified host source, not executor paraphrases; paper review has no transcript access.
- **`/dove:*` commands** are nine flat capability shortcuts, not stages or permission grants. DSH receives project-local filesystem Skills only, without Claude agents or hooks. There is no Auto command.

| Skill | Use it for |
|---|---|
| `dove.research` | Start or continue the current round; call the mentor when no round is active. |
| `dove.status` | Read the identity card, latest evaluation rows, and current brief; explain progress in four plain sentences. |
| `dove.source` | Find, read, check, and use relevant sources, including bounded bibliography DOI identity checks. |
| `dove.experiment` | Develop, rerun, diagnose, and analyze within a round; reserve frozen heldout comparisons for final confirmation. |
| `dove.draft` | Draft, assess, or revise text and project artifacts from real evidence. |
| `dove.figure` | Gather materials, draw or revise figures, inspect them in context, and caption them. |
| `dove.review` | Do author-side self-check, delivery review, native paper review, or returned-review preservation and inspection. |
| `dove.rebuttal` | Analyze findings, write responses, and make requested evidence-backed revisions. |
| `dove.lessons` | Read or maintain reusable advice that may improve research judgment. |

Source, Draft, Figure, Rebuttal, and Lessons are unchanged by the mentor/round structure.

## Short core and two reference read contracts

Both hosts install four exact package-managed resources:

| Reference | Role and when to read |
|---|---|
| `.dove/install/RESEARCH_QUALITY.md` | Short Chinese quality essentials; every fresh main-agent context personally reads them before substantive work. |
| `.dove/install/RESEARCH_QUALITY_FULL.md` | Preserved full quality criteria and joint conditions; consult relevant detail for consequential judgments. |
| `.dove/install/AUTHOR_PREFERENCES.md` | Short Chinese author-side essentials; the same fresh-context read applies. |
| `.dove/install/AUTHOR_PREFERENCES_FULL.md` | Preserved full preferences, consulted as needed. [Author preferences](AUTHOR_PREFERENCES.md) remains the sole editable full source. |

Claude startup and `/clear` deliver the two-essentials bootstrap; DSH applies it on first author-side Skill use if not already read in that context. Compact/resume reuses that context's reading. Do not delegate the main agent's read or require full companions through EOF each time. Installation, hook delivery, and another agent's read do not prove application. These references are guidance, not evidence, permissions, or Lessons. Bounded subagents receive relevant constraints; DSH Status has no author stance or bootstrap. Mentor and reviewer access remains limited to their specified materials, without private author preferences; the mentor's original-user source exception does not grant access to the full execution conversation or unrelated private transcripts.

## Scope, plans, and progress

Keep the user's confirmed `Mainline` and completion meaning stable. Methods may change within that goal and its constraints; experiments change evidence-bounded claims, not the goal itself. Unknown directions stay provisional. Clarify consequential ambiguity rather than silently select a different task.

Choose work for the real problem and intended contribution, not an inherited interface, available dataset, convenient proxy, mature implementation, or easiest test. Theory, relevant sources, simpler alternatives, and distinguishing predictions inform method choice; exhaustive search or prior positive results are not prerequisites for authorized core implementation. Controls and infrastructure serve the contribution. A smoke test establishes software behavior, not completion of a research round or the whole goal.

The mentor reads raw outputs every round and judges three levels: whether this method family remains worthwhile; whether it adds general capability or a patch, using failure classes and unseen-data results; and whether the problem, method and contribution stand, including sensitivity, strong controls and realistic deployment assumptions. It distinguishes verification from genuine strengthening, does not default to narrowing the claim, and does not propose single-sample domain craft fixes. Within the confirmed goal, it can change methods or engineering choices directly, explaining why in the brief.

The main session applies material findings to affected methods, evaluation, code, claims, manuscripts, figures, and current work. A capability report or saved record is not adoption. Negative results can advance understanding and end a round without establishing an effective method. Useful engineering or delivery can complete a bounded request without producing new scientific evidence. Software checks, actual research results, and completion of the user's goal remain separate claims.

## Research Markdown

New core context has three parts under `.dove/research/`:

```text
IDENTITY.md
EVAL.md
rounds/
  NNN-brief.md
  NNN-result.md
```

### Kickoff and original-user grounding

On mainline confirmation or takeover, the first round reconstructs the project from the user's original words in date order and user-designated normative documents: actual deployment inputs/outputs, intended innovation/contribution, baseline categories, completion meaning and non-goals. Old history supplies counterexamples, not inherited constraints. Generate broad candidates before critique, and surface resource gaps early. The user confirms this reconstruction once; only then does the mentor define EVAL, without a second evaluation approval.

At kickoff/takeover and every round start, the fresh mentor reads genuine user records, not executor retellings. Main-session SessionStart/UserPromptSubmit hooks expose only the host's `transcript_path` source path; they do not read/copy transcripts or automatically parse user history. The main session supplies that path, the last-read date/range and the current user's original text, which may not yet be persisted. The mentor uses Grep/Read to select relevant user-authored bodies, in date order initially and since the preceding round thereafter. Exclude meta messages, subagent conversations, host/system injections, self-wake summaries, tool results and assistant/executor text, even if wrapped in a user event. Do not inherit or read the full parent execution conversation. Record source, dates and last-read/since-previous-round range in the brief, not a new ledger. A source that cannot be accessed leaves provenance unknown; it does not revoke confirmed restrictions or host refusals. Restrictions established to be executor-added without user grounding are explicitly revoked in the mentor's brief.

### Identity card

Keep `IDENTITY.md` to a few hundred plain-language words. Put the current round fields at the top, inside the first 4096 bytes:

```text
Current round: rounds/003-brief.md
Round status: ongoing
Mainline: <the user's confirmed wording>
```

`Round status` is `ongoing`, `paused`, or `completed`. The card also keeps deployment inputs/outputs, the confirmed completion meaning, sourced user restrictions, recent user corrections, and any hard blocker. User restrictions/corrections contain only original user quotations, dates and source references, not executor paraphrases or invented prohibitions. Current method, rejected methods and next work belong in the linked brief, not card prohibitions. Change Mainline only when the user changes those commitments or the card demonstrably misstates already-confirmed intent.

Claude shows the card on valid prompts and after compact/resume. If it exceeds 4KB, the hook presents the first 4KB and asks for shortening; it does not treat the card as absent. Missing or unreadable cards remain missing, not inferred from old records. The main session shortens the card without changing confirmed intent, leaving measurements in `EVAL.md` and round details in `rounds/`.

A user correction updates only affected card content, including during Status or assessment work, unless writing is expressly forbidden or refused. If the same type of correction appears in another registered project's identity card, ask once in plain language whether to add it to global `AUTHOR_PREFERENCES`. This is a suggestion, never an automatic global edit; package-installed preference copies are not the editable source.

### Evaluation table

After the one kickoff confirmation, the mentor defines the evaluation script, dev/test split and columns from all confirmed user requirements, reusing valid existing evaluation. The first measured row is a complete strong same-input baseline. Columns include every user-mentioned metric, unseen data, train-test gap and the paper-selling advantage, such as cases where the baseline fails and the method succeeds. Use task-general metrics rather than sample/domain exceptions. An unmeasured requirement is not satisfied. Keep a short reference to the script, split and metrics in the card's Completion field.

Each method round appends time, round, method version and measured values to `EVAL.md`; identify the protocol, split and test draw so incompatible results are not mixed. Keep predictions in briefs, retain negative results, and mark missing measurements unknown. If the executor finds evaluator problems, it reports them in the result rather than changing the protocol itself. The mentor corrects evaluation and assigns recomputation of every historical method/baseline row under the new protocol in the same columns: reuse retained raw artifacts first and rerun historical versions only where needed. Preserve old method versions as ablations and distinguish superseded protocol results from current comparisons. A protocol correction alone is not a method change; only a correction changing the goal's meaning needs the user. Once test data have been used, a changed method requires a fresh draw from data never used in development or prior tests, not a reshuffle of old tests, with all comparison rows on that common draw.

After important results, the mentor supplies a paper-level assessment in `EVAL.md`: problem value, novelty, mechanism/theory, method/feasibility, data/evaluation, implementation, experiment/evidence, and expression/delivery. The main session saves the read-only mentor's returned assessment; it does not duplicate it with another self-rating. Include scope, reasons, evidence, and unknowns. Unknown or not-applicable is not zero, and ordinal grades are not acceptance probabilities. The weakest decisive dimension shapes the next brief.

### Round briefs and results

A brief is at most one page in plain language. Start it with `Author: mentor / user / external` (导师 / 用户 / 外部), using the actual author. Direct user messages to the host count as user-authored instructions; priority is user > external > mentor. Save mentor briefs verbatim. A brief may be replaced mid-round with its actual author and reason identified, without creating another ledger.

A method brief states the diagnosed cause, hypothesis/mechanism, this version's single change with everything else fixed, controls and equal budgets, forbidden inputs, grounded numeric thresholds/predictions in named EVAL columns, and failure reporting that identifies the blocked step with one or two examples. The mentor is read-only; evaluator construction, historical recomputation and significance tests are assigned to the executor in the brief. If the project cannot learn, the first method version after kickoff is a single-example overfit test, before larger data or evaluator construction.

One method round is one method version. Code stays unchanged within that version; changing it starts a new version and requires full evaluation, not a single-sample repair result. Retain previous versions as ablations. The main session runs until a measured result, then writes `NNN-result.md` with changed files, version, values, prediction versus actual, evaluator problems and a fixed `Objections to this brief / factual corrections` section, even if empty. The next mentor first responds to that section. Append the EVAL row and continue. A negative measured result ends a method round; a plan, successful launch or smoke test does not. Kickoff instead ends at the user's confirmation and does not yet require EVAL numbers.

`RESEARCH.md` becomes a short history index. Existing `missions/`, `experiments/`, and `claims/` remain where they are, byte-preserved by installation and updates; do not migrate, delete, or add new core records there. New experiment details go in round results or their linked actual artifacts. Source documents, authored review returns, Lessons, `DOCTOR.md`, and `.dove/runs/**` keep their distinct uses. Initialization still creates only minimal `RESEARCH.md` when no research tree exists; existing trees are untouched even without an overview.

Lessons retain their separate reusable-value standard: check the index once for a consequential question when needed, read relevant links, and save only grounded transferable experience within the existing write scope. Missing Lessons do not block work or create an empty index. Reflection, resumption, routine progress, and one-off tool failures do not themselves warrant a Lesson.

### Pausing and the Stop reminder

A status or side answer returns to the active round. If the user explicitly asks for discussion only or to stop, the main session sets `Round status: paused` before ending; the hook does not write that change. Mark completed work appropriately and resume only within the user's current request and authorization.

Claude's managed read-only Stop hook blocks once when the identity card says a round is ongoing and no `dove-mentor` call occurred in the current turn. It asks the main session to write the round result and call the mentor. If `stop_hook_active` is true, it immediately allows stopping. It checks host tool-call events, not conversation meaning, and neither analyzes nor sends conversation content to the mentor. This metadata check is separate from the main hooks' source-path handoff. Missing or unreadable transcript evidence allows stopping. There is no tracking file, extra tool hook, background scheduler, or new permission.

## Tools and sources

Dove uses only tools the current host exposes and the project permits. Claude project setup declares paper-search and webpage-reading support; declaration is not approval or proof of connectivity. If a needed source or tool is unavailable, Dove names the gap and uses other available material or asks for the necessary permission. It does not replace unavailable retrieval with shell, `curl`, or custom-fetch scripts.

## Working with the nine capabilities

### Research

Use `/dove:research` to start or continue the round cycle: begin with kickoff on confirmation/takeover; otherwise read the identity card, evaluation table and current brief, execute the active method round or call `dove-mentor` if none is active. Save the result and evaluation row, obtain the next brief and continue within the confirmed goal. Engineering choices proceed directly; the mentor asks once for a goal/claim/deployment-input-output change or resources beyond your limit. Without a reply, continue only the already-authorized default portion, not the proposed departure, and do not repeatedly ask. A bounded research question still finishes at its requested answer. Mentor intervention triggers are described in the [Research Model](development/RESEARCH_MODEL.md#导师与轮次循环).

### Status

Use `/dove:status` to read `IDENTITY.md`, the last few `EVAL.md` rows, and the current brief. Answer in four plain sentences: what has been produced, whether the core is demonstrated, what blocks it, and which round is underway. Cite actual values when available; do not infer progress from a branch, latest timestamp, test pass, or missing note. Status does not run evaluation, fill gaps, or rewrite evidence. A user's simultaneous correction still updates affected card content unless writing is forbidden.

SessionStart is not Status. After compact/resume it delivers the bounded identity card and continuity guidance; the main session then reads the current evaluation and brief as needed. The hook does not reconstruct research from overview/review/run timestamps or perform the mentor's judgment.

### Source

Use `/dove:source` to turn external material into research judgment. Material found, identity-verified, retrieved, inspected, and used are different things. Citation identity is separate from support for a claim. For a composite claim, distinguish supported, contradicted, and uncovered parts; support for one part is not support for the whole. A check-only request reports that boundary without automatically editing the manuscript.

When a DOI matters and direct lookup is exposed and permitted, check it before fuzzy title search. Compare DOI, title, authors, year, and venue or version; report verified, conflict, not-found, or unknown. A requested **bounded bibliography DOI identity check** is within Source's scope: check only the selected entries. Metadata verification does not establish full-text inspection or claim support. Keep checks transient unless they change a manuscript citation, research judgment, or useful continuation context; do not build a ledger, cache, or BibTeX parser.

Ordinary source work stays proportional. Explicit systematic review, meta-analysis, evidence grading, or auditable synthesis uses an appropriate structured method.

### Experiment

Use `/dove:experiment` for experiment work within a method-version round. Development may inspect available ground truth, diagnose and rerun without per-run registration; method/code changes create a new version and full evaluation, and changing a method after test use requires a fresh test draw. Fix known causes rather than defer a repair. Only final heldout confirmation freezes and preregisters the selected method/protocol for a one-time comparison. Development observations are not independent heldout confirmation.

Design-only stays read-only and delivers a plan with unverified limits; analyze existing results directly and keep retrospective recording retrospective. Exploration can form hypotheses without a predeclared claim; reproduction/delivery checks the agreed capability without reopening novelty. Trace real inputs, outputs, references/proxies, metrics, failures, exclusions, and denominators. Inspect actual ablation changes before claiming a component or mechanism effect. Record actual outcomes in the round result and `EVAL.md`, not new `experiments/` entries.

Use a suitable available GPU for repeated compute unless the user fixes another resource or the task genuinely fits CPU better. Compare end-to-end time to useful evidence, including implementation, transfers, evaluation, downstream use, and reruns—not utilization alone. Preserve output semantics, information boundaries, and comparison basis; design-only does not authorize profiling. Resource limits remain the user's, not a receipt's budget metadata.

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

Use `/dove:review` for author-side scientific self-check, delivery review, native `dove-review`, faithful preservation of a supplied review, or read-only inspection. This Skill remains; the old `dove review` CLI and its model-launching, frozen-snapshot, and persistent-session runtime are removed. Author-side self-check is not independent review, and delivery checks do not decide scientific acceptability.

For independent paper review, the main session invokes native `dove-review` in a fresh context with only `Read`, `Grep`, and `Glob`. Specify the current manuscript, its cited results, and necessary supplied venue/literature grounding. For a whole-paper request, include the full authoritative source in its existing format, actual built/exported output, and relevant appendices or supplements. The reviewer reads the listed current files directly; no frozen copy, material hashes, project-external workspace, socket launcher, or persistent reviewer session is needed.

Do not supply author process conversation, private preferences, identity/round records, old author-side reviews, or unlisted material. The reviewer does not retrieve webpages, run commands or experiments, diagnose code, save files, or revise the paper. Missing grounding is an explicit limit, not permission to expand the read scope. Native context/tool/material isolation is not an OS sandbox.

The reviewer asks:

1. Does the method answer the research question?
2. Are mechanisms, terminology, comparisons, literature, counterexamples, and limits correct for the field?
3. Do contribution, evidence, scope, and expression fit the target venue and readers?
4. What is the strongest reasonable objection, and what evidence or revision would answer it?

The return gives the overall judgment, substantive objections, cited manuscript/result locations, and proposed author actions, plus the files actually read (and partial-read limits). The main session saves the actual return when useful and assesses each finding before responding or revising; criticism is not new empirical evidence or automatic permission. A supplied external review is preserved with its real provenance, not relabeled as a native review.

After substantive changes, a new fresh review reads the full current version. An earlier recommendation applies only to the version and evidence it judged; no timestamp or software check makes it current. Unavailable/refused native review remains a limitation, never author self-check presented as independent review.

### Rebuttal

Use `/dove:rebuttal` for author-side response and requested revision. Check which findings hold, identify useful evidence or changes, and respond from inspected material. New citations and experiment explanations require actual sources and results.

### Lessons

Use `/dove:lessons` when a focused read or maintenance request helps, but the command is not required for ordinary author-side participation. At consequential choices, corrections, or recurring failures, Dove can check the Lessons index once for the current question and apply only relevant guidance. When actual work yields transferable experience meeting the reusable-value standard, and the existing author-side write scope and authorization permit it, Dove actively preserves the narrowest Lesson even without a mainline change. Lessons retain applicability, counterexamples, and limits; routine activity and one-off failures stay unrecorded. They do not carry package-default author preferences or replace either reference, and remain fallible guidance rather than proof that a claim or project is correct.

## Submission readiness

Keep the authoritative manuscript format and actual venue requirements. A user-confirmed submission-completion goal needs author-side scientific sufficiency, a current independent `dove-review` recommendation for the same complete version, and real delivery readiness. Unavailable independent review leaves a gap; bounded local work does not become submission completion. A build pass, old review, generated file, or Markdown update alone is not readiness.

## Maintenance commands

- `dove update` refreshes valid manifest-owned integration, replaces its local edits, and reports `replacedLocalEdits`; it does not overwrite user-owned files.
- SessionStart is entirely read-only and may suggest explicit update. It does not sync resources or reload an active host context.
- `dove doctor` reports software/readability facts using `uninitialized`, `current`, `needs-update`, and `blocked`; it does not repair, adopt unknown files, or probe live tools.
- `dove reinstall` and `dove uninstall` preview scope and require default-No confirmation. Research records, historical reviews, run receipts, Doctor notes, and ordinary files remain preserved.

- `dove dashboard` starts a local read-only web view of registered projects: Mainline, current round and status, the EVAL.md tables (latest row highlighted), every round brief/result with its author (mentor / user / external), the identity card, and Doctor notes. It binds to `127.0.0.1:7788` by default (`--port`, `--bind`); from another machine use `ssh -N -L 7788:127.0.0.1:7788 <server>` and open `http://localhost:7788/`. Round texts and raw EVAL/Doctor files load on demand; the page refreshes every 30 seconds and never writes to a project. `dove dashboard --json` prints the same summary. Before exposing it through a public tunnel, start it with `--password-file <file>`: every page and API request then requires a login, the session cookie is HttpOnly and SameSite=Strict (Secure behind HTTPS), and changing the password signs everyone out.
- The dashboard Settings page manages project registration and sync, paper tracking (per-project keywords, watched authors, arXiv categories; global daily hour, lookback days, proxy and an optional Semantic Scholar key) and the dashboard password. Paper tracking needs no API key: arXiv supplies all new submissions, Hugging Face daily papers mark what the community notices, and Semantic Scholar adds venue and citations when reachable. Results go to `.dove/research/watch/DATE.md|json`; it runs daily while the dashboard is up, or on demand with `dove watch run [--project <dir>]`. The mentor reads new entries at the next round and classifies each as overlap (novelty risk), new baseline, borrowable method/data, or irrelevant.

- Paper tracking drafts its own starting point: when a project has no tracking config, Dove extracts cited arXiv papers and method names (resolved to arXiv by title) as tracked neighbours, and takes keywords from their titles and abstracts plus English prose in the project records; the mentor then proposes corrections in a 追踪建议 section. Besides keyword search it follows watched authors on arXiv, new papers citing the neighbours and keyword papers from watched institutions (via OpenAlex, no key), and rewards watched venues and papers with code or a project page. The mentor writes one line per judged paper (`- ID | 撞题/新基线/可借用/无关 | reason`), which the dashboard groups by; once a week the mentor also writes a short field scan saved as `.dove/research/watch/scan-DATE.md`. The dashboard Trends tab gathers the week across projects.
- Topic selection follows the user's own criteria document, kept at user level and edited on the dashboard Settings page. `dove topic start [--project <dir>]` copies it to `.dove/research/topics/CRITERIA.md`; mentor-led topic rounds then follow it (breadth before critique, real literature search for neighbour audits, no full method experiments) and write one card per candidate in `topics/cards/` whose first five lines give status, stage, position, one-sentence contribution and the six conclusions. The dashboard Topics tab shows the cards; the user confirms one direction, which becomes the project inception.

Claude installs its read-only two-line status display only when no project status line exists: model/context facts, optional cyan Mainline, Git branch and session duration, then the absolute project path. Mainline comes only from the bounded identity card; branch and duration are not research conclusions. Existing user/Trellis lines remain unowned. Project lifecycle commands do not repair user-level settings. The current round number is also shown when readable from the card; latest evaluation metrics are not statusline fields.

After a successful project update, an already-active Claude session with a working registered Dove prompt hook can receive current guidance on its next prompt and read the changed rule/short essentials. This is context delivery, not host rule/config hot reload or proof of adoption. `/reload-skills` reloads optional Skills only; use a fresh context when hooks, agents, tools, permissions, or complete host configuration need loading. See [Installation](INSTALL.md).

Documentation-only checks do not initialize projects or write test material into real research. Report implementation, software checks, observed behavior, and scientific outcomes separately; see [verification evidence](PACKAGING.md#verification-evidence).
