# Usage

Dove helps choose research directions and advance a confirmed mainline through real work. The main session owns the user conversation, execution and delivery. Isolated contexts provide independent judgment, not extra personas or approvals. Ordinary questions, local edits and discussion-only requests keep their scope.

## Start using Dove

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove
```

The bare public npm name `dove` is unrelated. Use a trusted artifact; see [Installation](INSTALL.md).

## Entry modes

Ordinary Claude conversation in an initialized project is the complete primary entrance. `claude --agent dove` is optional. Nine flat `/dove:*` commands provide shortcuts; none is a stage or permission grant. DSH receives filesystem Skills and shared references, not Claude agents, hooks or a packaged native agent service. Independent judgment on another host depends on equivalent isolated tools actually available there. There is no Auto command.

| Skill | Use it for |
|---|---|
| `dove.research` | Explore parallel candidates for the user's choice, or develop the confirmed mainline. |
| `dove.status` | Report results, core evidence, blockers and current round without starting work. |
| `dove.source` | Discover and inspect sources, verify citation identity and claims, and improve decisions. |
| `dove.experiment` | Develop, diagnose, evaluate and analyze actual method outputs. |
| `dove.draft` | Write or revise evidence-grounded text and inspect the authoritative build/export. |
| `dove.figure` | Gather materials, create or revise visuals, inspect them and deliver captions and editable sources. |
| `dove.review` | Distinguish author self-check, delivery checks, independent paper review and returned opinions. |
| `dove.rebuttal` | Verify review concerns, respond as the author and make requested revisions. |
| `dove.lessons` | Read or preserve useful transferable advice, not another progress log. |

## Short core and two reference read contracts

Both hosts install four exact package-managed files:

| Reference under `.dove/install/` | Role |
|---|---|
| `RESEARCH_QUALITY.md` | Chinese quality essentials and common mentor note/tracking duties. |
| `RESEARCH_QUALITY_FULL.md` | Detailed substantive criteria, consulted when relevant. |
| `AUTHOR_PREFERENCES.md` | Short author-side preferences and fresh-context reading guidance. |
| `AUTHOR_PREFERENCES_FULL.md` | Full preferences, consulted as needed; [the source](AUTHOR_PREFERENCES.md) remains the sole editable full version. |

Every fresh author main context personally reads both short essentials before substantive work. Claude startup and `/clear` supply the bootstrap; DSH applies it on first author-side Skill use if needed. Compact/resume reuses the readings. DSH Status has no author bootstrap. Do not require both full references through EOF at startup or delegate the main context's reading.

Mentors on both hosts read the quality summary, not private author preferences. Paper reviewers read only supplied manuscript materials and grounding. Installation, hooks and another agent's reading do not prove the current context has read or applied guidance; references are not research evidence or permissions.

## Scope, plans, and progress

Preserve the user's confirmed Mainline, intended contribution, completion meaning and fixed methods. A field, recommendation or card entry is not confirmation. Record clear intent without asking again; keep provisional intent provisional. Other designs can change with evidence. Ask about changes to user commitments, deployment inputs/outputs or resources, not routine engineering. Without a reply, continue only independent authorized work.

Choose substantive work by full-task benefit, serious alternatives, mechanism grounds and the key unknown. Ask whether the scale and change can answer the question: expand or redesign when they cannot, and do not enlarge work needlessly when they can. Connecting a pipeline does not demonstrate a designed and tested core mechanism. Necessary repairs need not be novel and do not automatically become contributions.

For judgment questions, put only the direct conclusion in the first sentence—达到、没达到、能、不能、还不知道, or an equally direct answer. Follow with one or two sentences of evidence and at most one boundary sentence, not “可以，但是”. Report scientific progress, necessary engineering, delivery and software checks separately.

## Research Markdown

Current records live under `.dove/research/`. The following formats govern future writing; installation does not migrate or shorten existing research.

### Topic selection and original-user grounding

Until the user confirms a mainline, first read and follow existing `topics/CRITERIA.md` and project topic-selection standards. Establish a meaningful direction, then generate a broad parallel candidate pool without pruning during generation. Use real near-neighbor searches to assess and broaden it. Present 2–3 grounded recommendations for the user to choose. Before that choice, do not implement candidate methods; do only diagnostics allowed by the standards.

`dove topic start [--project <dir>]` optionally copies user-level criteria from Settings into the project's topic materials, excluding other projects' settings. Running this helper is optional; reading the standards is not. Candidate cards in `topics/cards/` keep their status, stage, position, summary and six-conclusion headers for the Topics page. A takeover continues an already confirmed mainline rather than reopening selection.

The mentor reads genuine user wording from the supplied host source and date/range. Hooks expose only `transcript_path`, not copied transcript contents. On takeover, read relevant user history; subsequently read since the last recorded range. Exclude meta messages, subagent conversations, tool returns, system injections and executor summaries. The current original message may be supplied directly before it is persisted. Unavailable originals leave provenance unknown; they do not revoke confirmed commitments or host permissions.

### Identity card

Keep `IDENTITY.md` within **1200 characters**, using these fields in order:

```text
Current round: rounds/NNN-brief.md
Round status: ongoing / paused / completed
Mainline:
Target tier:
Deployment inputs/outputs:
Completion:
User restrictions:
Recent corrections:
Research state:
```

Mainline immediately follows the round labels for the existing reader. Target tier is the conference/journal level; ask once if missing rather than invent one. Each restriction includes its quotation, date/source, original-user versus relayed provenance, and long-term versus task-specific scope. Do not turn a relay or a task limit into a standing restriction. Update research state after important results and apply corrections to action, not just to quotations. Method details and rejected families belong in briefs or mentor notes.

Hooks still show the UTF-8-safe first 4096 bytes of an overlong card and request shortening; they do not call it missing. Missing cards are not inferred from other records. Repeated cross-project corrections may prompt one question about adding global author guidance, never an automatic edit of author preferences.

### Evaluation table

Begin `EVAL.md` with a short Completion reference to the script, protocol and all user metrics. Use one row per method version:

```markdown
| Date | Version/round | Protocol/split | Measurements | Unseen data/train-test gap | Conclusion | Artifacts |
|---|---|---|---|---|---|---|
```

Each cell contains numbers and at most one short sentence, within **200 characters**. Link detailed outputs and protocol descriptions in ordinary artifacts; engineering logs and process status stay out. Formal comparisons retain complete strong same-input baselines and every confirmed requirement. Unknown measurements stay unknown. External full-task comparisons test utility; ablations and causal controls test attribution.

The executor repairs evaluator errors and recomputes all comparable historical methods and baselines under the corrected protocol. Reuse retained raw outputs before rerunning; identify superseded protocols as history rather than mix values. Protocol repair alone is not a method-code change. Only changes to the goal's meaning need the user.

After important results, save the mentor's current eight-dimensional assessment below the table in **at most 1000 characters**, replacing the previous current assessment. Give grounds and unknowns; the main session does not add a duplicate self-rating. Implementation has grades 1–3 and the other dimensions 1–4. Unknown is not zero, ordinal grades are not averaged, and scores are not acceptance probabilities. The weakest decisive dimension informs next work.

### Round briefs and results

Each round has one `rounds/NNN-brief.md` of **at most 2000 characters** and one `NNN-result.md` of **at most 3000**. Supporting material belongs in ordinary project directories, linked rather than accumulated as round attachments.

A brief identifies its actual author—mentor, user or external—method version and dated user-source range. Direct user instructions take priority over external and mentor advice. Save mentor briefs verbatim; replacements name author and reason. Explain the benefit, grounds, key unknown, actual action and how results change the decision. Use controls, input boundaries, budgets and grounded predictions appropriate to the question; do not invent thresholds or wait for a complete theory/baseline library before useful core work.

Results use four fixed headings:

1. `Changes and version`
2. `Measurements and artifacts`
3. `Prediction versus actual`
4. `Objections to this brief / factual corrections`

State real values, missing measurements and blockers. The next mentor answers objections first. A valid negative result can add scientific knowledge; a plan, launch, smoke test or engineering check does not. Engineering and verification failures still count toward the no-science limit.

A method round uses one code version and may include coordinated changes. Later method-code changes start a new version with full applicable evaluation. Keep old versions as ablations. After test data have been used, a changed method needs a fresh draw from data unused in development or previous tests, with same-set baselines; reshuffling old test data is not fresh evidence. Only final heldout confirmation states the claim, controls, data and metrics beforehand and uses heldout once.

`RESEARCH.md` is a short history index. Existing `missions/`, `experiments/` and `claims/` stay in place without migration, deletion or new entries. Sources, review returns, Lessons, Doctor feedback and Run receipts retain distinct uses.

### Mentor judgment and memory

Call `dove-mentor` at round end, after two consecutive rounds without scientific results, when the user corrects direction or questions the claim/story, before route changes, or when requested. After two no-science rounds obtain diagnosis; by the third, explain the blockage and ask the user to decide before another round. Engineering and verification failures are not exemptions. Report every route/family change with the old route, new route and reason.

Each cross-round judgment uses a fresh native context, not resumed conversation; 2–3 clarifications may stay within the same judgment. Supply a material list: user originals and source/range, standards, card and target tier, mentor notes, recent EVAL and brief/results, changes, raw artifacts and watch materials. Executor opinion may be a labeled attachment, not a framed verdict request. Ask:

1. Is the direction faithful to the user's original goal?
2. Are recent rounds building general capability or repeated patches?
3. What remains to the goal and target tier?
4. What should the next round do, and why?

The executor decides engineering, numerical equivalence, acceleration, parameters and evaluator repairs. The mentor judges direction, whether evaluation answers the scientific question and whether time is being spent well. It may use paper/web retrieval but does not compute or edit, read private author preferences, or take over engineering decisions.

The mentor returns its own note of **at most 1000 characters**, covering judgments, predictions versus actuals, rejected families and reasons, concerns and the user-source range read. The main session appends it verbatim to `MENTOR_NOTES.md`. Above **6000 characters**, the mentor merges it to replacement text of **at most 3000**. The executor does not author this memory.

### Replies and research rounds

Status, side questions, corrections and blocker reports can end a reply without completing or pausing a round. Honor explicit stop/discussion-only requests. Save useful evidence and continuation context, not extra records merely to end a response. On resume, read the card, recent EVAL and current brief, then continue authorized work.

## Tools and sources

Use exposed and permitted host tools. Claude setup declares paper search and Exa; declaration is not connectivity or approval. Search snippets guide discovery but do not replace inspected sources. If retrieval is unavailable, state the gap and use other permitted material, not shell or custom-fetch substitutes.

Source distinguishes discovery, citation identity, full-text inspection and checked claims. When available, direct DOI lookup precedes fuzzy title search. Compare DOI, title, authors, year and venue/version; retain conflicts, not-found and unknowns. For compound claims, identify supported, contradicted and uncovered parts. Bounded bibliography checks cover requested entries without a ledger or automatic manuscript edits. Explicit systematic reviews and meta-analyses use suitable structured methods; ordinary retrieval does not need that machinery.

## Writing, figures and review

Draft preserves the authoritative manuscript format and claim strength. A new manuscript defaults to LaTeX only when the venue accepts it. Propagate authorized changes through the actual build/export and inspect the output. Facts and effects come from inspected sources and measurements, not invented placeholders or stronger wording.

Figure gathers real data or mechanism materials, creates and renders the visual, opens it at realistic dimensions, checks its caption and manuscript context, and delivers editable sources. Quantitative plots use real data and reproducible code; diagrams, image tools and mixed raster/vector routes fit their material. A beautiful standalone preview is not final-context validation.

Independent `dove-review` reads the specified complete current manuscript, cited results and supplied venue/literature grounding in a fresh Read/Grep/Glob context. It does not receive execution conversation, identity/round records, private preferences or old reviews, and does not retrieve, execute or edit. No frozen copy, hashes or external workspace is needed. It asks whether the method answers the question, the field reasoning is correct, contribution/evidence fit the venue, and the strongest reasonable objection is answered. Returns cite evidence and actual files read. Author self-check and delivery checks remain distinct; unavailable independent review is a gap.

After substantive changes, a fresh review reads the complete current version; an old recommendation is historical. Rebuttal verifies objections, groups shared causes, writes author responses and makes requested evidence-backed revisions. A reply is not resolution or acceptance. Preserve real reviewer returns separately from commentary.

Lessons are optional, fallible reusable guidance. Check the index once for a consequential active question or a recurring mistaken premise; read only useful links. Preserve grounded transferable insights with basis, conditions and counterexamples when permitted. Missing Lessons do not require an empty index; routine progress and one-off failures do not qualify.

## Run receipts

`dove run` optionally records authorized command facts; it is not required for experiments and grants no permission:

```bash
dove run start --project <dir> --id <id> --group <name> --seed <short-text> --metric-name <name> --direction min|max --timeout-ms <ms> -- <command> [args...]
dove run status --project <dir> --id <id>
dove run resume --project <dir> --id <id>
dove run finalize --project <dir> --id <id> --metric-value <number>
dove run compare --project <dir> --group <name>
```

Start directly spawns the command without a shell through a detached supervisor, writing `.dove/runs/<id>/run.jsonl`, stdout and stderr. Receipts capture command, timing, outcome, metric/comparison basis, declared seed and minimum Git commit/dirty facts; they do not prove reproducibility. Status is read-only; resume never reruns, and reconciles an interrupted receipt only when neither supervisor nor target remains observable. Finalize adds one scalar after terminal completion. Compare ranks only compatible finalized runs; Git facts do not determine comparability. Execution success and receipt compatibility do not establish scientific meaning.

Budget fields describe comparison conditions, not prepaid resources or spending caps. Actual limits and timeouts apply. POSIX timeouts retain process-group observation and grace-period termination after leader exit; descendants leaving the group are outside that claim. Windows termination is direct-child best effort. Converted timeout/grace values cannot exceed 2147483647 ms. An occupied journal lock is reported, never removed by inferred PID/age; inspect before any manual cleanup.

## Dashboard, tracking and topics

`dove dashboard` serves registered projects at `127.0.0.1:7788` by default. Research views are read-only and refresh periodically; Settings can change registry, tracking and password settings. Remote access can use SSH forwarding. Before exposing a public tunnel, use `--password-file`; all pages/APIs then require login. `--json` returns the research summary without a browser.

Tracking runs daily while the dashboard is up, or with `dove watch run [--project <dir>]`. It uses arXiv discovery, optional community/venue/citation enrichment and OpenAlex neighbor/institution searches. arXiv keyword/author queries are combined and paced, with bounded rate-limit retries. Retrieval errors are shown as errors, not silently called “no relevant papers”. No Semantic Scholar key is required for discovery; enrichment can remain unavailable.

A new config is a draft, not vetted relevance. Every mentor invocation checks `watch/config.json`; draft or irrelevant tracking calls for project-specific keyword/author/venue/institution/neighbor advice. Main-session writes update the config and set `source: mentor`. Run now also exposes persistent draft guidance. Broad phrases alone do not qualify a paper; daily tracking and Trends use the same relevance owner.

Paper impact does not wait for a round. The mentor reads unjudged papers and existing impacts, returning `- ID | 撞题/新基线/可借用/无关 | reason`. Important suspected overlap needs fuller sources; missing evidence stays pending. Core overlap goes to the user; useful baselines and methods affect actual work. The main session saves `watch/impact-DATE.md`; older brief judgments remain usable. With no scan or one older than seven days, the next mentor checks recent accepted papers, surveys and discussions, returning a sourced project-relevant scan of at most **2000 characters** for `watch/scan-DATE.md`.

## Submission readiness and maintenance

Submission completion needs scientific sufficiency, current independent review of the same complete version and real delivery readiness. A build, old review or record update alone is not enough.

`dove update` explicitly refreshes owned integration and can replace valid owned local edits; `dove projects sync` preserves those edits while updating the rest of every registered project. Read per-project outcomes. Init creates only the RESEARCH bootstrap when no research tree exists. Lifecycle operations preserve research, reviews, receipts, Doctor notes and ordinary artifacts. See [Installation](INSTALL.md) for ownership and reinstall/uninstall behavior.

SessionStart/UserPromptSubmit are read-only context hooks. Statusline shows native session facts, bounded-card Mainline and round, not inferred scientific progress. Disk updates do not hot-reload an active host; complete agent/tool/hook configuration may require a fresh context. Report source, generation/build, installation, loaded context, observed behavior and scientific outcomes separately. This restructuring is observed in normal research use, not by creating test projects or writing test content into real research.
