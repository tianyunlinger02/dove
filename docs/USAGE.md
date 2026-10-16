# Usage

Dove helps choose research directions and advance a confirmed mainline through real work. The main session owns conversation, execution and delivery; isolated contexts provide independent judgment, not personas or approvals. Bounded questions, edits and discussions keep their scope.

## Start using Dove

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove
```

The bare public npm name `dove` is unrelated. Use a trusted artifact; see [Installation](INSTALL.md).

## Entry modes

Ordinary Claude conversation in an initialized project is the primary entrance; `claude --agent dove` is optional. Nine flat `/dove:*` commands are shortcuts, not stages or permission grants. DSH receives filesystem Skills and shared references, not Claude agents or hooks; independent judgment depends on its available isolated tools. There is no Auto command.

| Skill | Use it for |
|---|---|
| `dove.research` | Develop grounded candidates for the user's choice, or advance the confirmed mainline. |
| `dove.status` | Report results, core evidence, blockers and current round without starting work. |
| `dove.source` | Retrieve sources, accumulate full-text Q&A notes and check citations and claims. |
| `dove.experiment` | Develop, diagnose, evaluate and analyze actual method outputs. |
| `dove.draft` | Write from evidence and direction-grouped literature, export BibTeX and inspect delivery. |
| `dove.figure` | Gather materials, draw, inspect and deliver visuals, captions and editable sources. |
| `dove.review` | Distinguish author self-check, delivery checks, independent paper review and returned opinions. |
| `dove.rebuttal` | Verify concerns, respond as the author and make requested revisions. |
| `dove.lessons` | Read or preserve transferable advice, not another progress log. |

## Short core and two reference read contracts

Both hosts install four exact package-managed files:

| Reference under `.dove/install/` | Role |
|---|---|
| `RESEARCH_QUALITY.md` | Chinese quality essentials and shared mentor note/tracking duties. |
| `RESEARCH_QUALITY_FULL.md` | Detailed criteria, consulted when relevant. |
| `AUTHOR_PREFERENCES.md` | Author-side essentials and fresh-context reading guidance. |
| `AUTHOR_PREFERENCES_FULL.md` | Full preferences; [the source](AUTHOR_PREFERENCES.md) remains the sole editable full version. |

Fresh author contexts personally read both essentials. Claude startup and `/clear` provide the bootstrap; DSH uses first author-side Skill use, excluding Status. Compact/resume reuses readings; full references are on demand.

Mentors read quality, not private preferences; reviewers read supplied manuscript materials. Installation or another agent's reading proves neither current adoption nor evidence or permission.

## Scope, plans, and progress

Preserve the user's confirmed Mainline, intended contribution, completion meaning and fixed methods. A field, recommendation or card entry is not confirmation. Record clear intent without asking again; keep provisional intent provisional. Revise other designs with evidence. Changes to user commitments, deployment inputs/outputs or resources need the user, not routine engineering.

Confirmation ends selection-only limits; ask once for any separate resource/model authorization. Diagnose key unknowns, design the core method, experiment, then write the proposal. Scale must answer the question; pipeline connection is not core evidence.

Answer judgment questions directly, then give the evidence and key unknowns the user needs to decide. Use natural language without a fixed verdict vocabulary, sentence budget or banned opening; previously explained, unchanged boundaries need not be repeated. Report scientific progress, engineering, delivery and software checks separately.

## Research Markdown

Records under `.dove/research/` belong to the researcher. Installation does not rewrite them; optional [host migration](#submission-readiness-and-maintenance) applies new formats at a quiet point.

### Topic selection and original-user grounding

First establish the current request and completion conditions. Already-authorized implementation, repair, reproduction and bounded delivery proceed without being recast as topic selection or assigned research scores and rounds. For actual topic selection, read `topics/CRITERIA.md` and project standards. Selection ends with the user's mainline choice, not a closed-method proposal; higher standards bind their deliverables, not recommendations. Ground value in real strong-baseline failures and sourced numbers. Focus each challenge axis on consequential gaps: “prior methods do X through Y, but Y leaves Z unresolved.” Cite two body-read near-miss papers, their shortfalls, a deficiency and observable closure. Abstracts or absent precedent are not evidence.

Search in-domain and cross-field mechanisms according to key unknowns, reading the source mechanism and closest prior work. Six to ten queries and three other subfields can help broaden a search; they are not delivery quotas or proof of novelty. Explicit user requirements still apply. Generate parallel candidates before pruning. One sourced idea with key unknowns can support selection; method design and closure belong within the mainline. Cards in `topics/cards/` retain status, stage, position and these fields:

- One-sentence idea.
- Gap it attacks.
- Source papers, borrowed mechanism and why it works there.
- Mapping to this problem: what plays the role of what.
- Why it could work and the key assumption it requires.
- Specific difference from the closest in-domain work.
- Main risk; when improving a candidate, identify what changed.

The mentor searches “borrowed mechanism + target problem” and gives its judgment with cited evidence and the strongest objection. Revision addresses bottlenecks and shared causes, comparing coordinated changes or alternative routes rather than mechanically patching one weakest item. Deliver candidates, neighbors and the best 2–3 choices within one round; give just one if that is all. If conflicting standards or prohibited evidence block recommendations, explain once and still offer the best directions for user choice or standards adjustment, not another static round. Before choice, implement no methods; only standards-allowed diagnostics.

`dove topic start [--project <dir>]` optionally copies user-level criteria from Settings, not another project's settings. It does not replace reading the standards. A takeover continues an already confirmed mainline.

The mentor reads genuine user wording from the supplied host source and date/range. Hooks expose `transcript_path`, not copied contents. On takeover, read relevant history; later continue from the recorded range. Meta messages, tool returns, system injections, subagent conversations and executor summaries are not user originals. The current original may be supplied before persistence. Inaccessible sources leave provenance unknown, not commitments or permissions revoked.

### Identity card

Keep `IDENTITY.md` within **1200 characters**, in this order:

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

Mainline follows the round labels for the existing reader. Ask once for a missing conference/journal target tier. Restrictions include quotation, date/source, original-versus-relayed provenance and long-term-versus-task scope; a relay or task limit is not a standing restriction. Update research state after important results and apply corrections to action. Method details and rejected families belong in briefs or mentor notes.

Hooks show the UTF-8-safe first 4096 bytes of an overlong card and request shortening, not report it missing. Repeated cross-project corrections may prompt one question about global author guidance, never an automatic preference edit.

### Evaluation table

Begin `EVAL.md` with a short Completion reference to the script, protocol and all user metrics. Use one row per method version:

```markdown
| Date | Version/round | Protocol/split | Measurements | Unseen data/train-test gap | Conclusion | Artifacts |
|---|---|---|---|---|---|---|
```

Each cell contains numbers and at most one short sentence, within **200 characters**. Link detailed outputs and protocols; exclude engineering logs and process status. Formal comparisons retain complete strong same-input baselines and all confirmed requirements. Unknown measurements stay unknown. External comparisons test utility; ablations and causal controls test attribution.

The executor repairs evaluator errors, immediately marks affected results, and first restores comparability for the current claim, necessary historical comparisons and strong baselines, reusing raw outputs where valid. Other affected history remains clearly marked under its old protocol and is revisited when it matters. Never mix protocols or hide unfavorable evidence. Protocol repair alone is not a method-code change; changes to the goal's meaning need the user.

After important results, replace the current mentor assessment below the table in **at most 1000 characters**, with grounds and unknowns; do not add a duplicate self-rating. Implementation uses grades 1–3, the other seven dimensions 1–4. Unknown is not zero; ordinal grades are not averaged or treated as acceptance probabilities. Quality dimensions identify bottlenecks, shared causes and key unknowns. Compare whole alternatives and choose the next work by expected value, evidence and total cost; do not mechanically patch whichever dimension is lowest.

### Round briefs and results

Each round has one `rounds/NNN-brief.md` of **at most 2000 characters** and one `NNN-result.md` of **at most 3000**. Link supporting material in ordinary project directories rather than adding round attachments.

A brief names author (mentor/user/external), version and dated user-source range. User instructions take priority; save mentor text verbatim and identify replacement authors/reasons. Explain benefit, grounds, unknowns, action and decision impact, with relevant controls, inputs, budgets and predictions—not invented thresholds or exhaustive prerequisites.

Results use four fixed headings:

1. `Changes and version`
2. `Measurements and artifacts`
3. `Prediction versus actual`
4. `Objections to this brief / factual corrections`

State values, missing measurements and blockers; the next mentor answers objections first. A valid negative result can add knowledge; a plan, launch, smoke test or engineering check cannot. Engineering and verification failures count toward the no-science limit.

Keep method changes and measurements version-traceable, including coordinated changes and useful old versions for ablation. Development first uses diagnostics that answer the key unknown; formal comparison, result adoption and paper claims require the applicable protocol, all user metrics, fair strong baselines and unseen-data evidence. Unmeasured effects of a new version remain unknown, not inherited passes. After test use, formal comparison of a changed method needs a fresh draw unused in development or previous tests and same-set baselines, not reshuffled old data. Only final heldout confirmation declares claim, controls, data and metrics beforehand and uses heldout once.

`RESEARCH.md` is a short history index. Existing `missions/`, `experiments/` and `claims/` stay in place without migration, deletion or new entries. Sources, reviews, Lessons, Doctor feedback and Run receipts retain distinct uses.

### Mentor judgment and memory

Call `dove-mentor` at round end, after two consecutive rounds without scientific results, on user direction/story corrections, before route changes or when requested. Two no-science rounds call for an independent diagnosis; the count itself does not revoke authorization. Continue a credible next step within scope, and ask the user when commitments, fixed methods, completion meaning or resources must change, or no credible path remains. Report route changes with old route, new route and reason.

Each cross-round judgment uses a fresh native context; 2–3 clarifications may stay within one judgment. Use `dove mentor brief --project <root>` for the call body: it lists current materials and five questions. Add only relevant, author-labeled opinions and new raw-artifact paths as materials, not executor task instructions; long or unsigned opinions are noted rather than rejected. Supply current user requests verbatim with sources. For another call within a round, identify its trigger in the template. The questions are:

1. Is the direction faithful to the user's original goal and the identity card's core capability?
2. Are recent rounds building general capability or repeated patches?
3. What remains to the goal and target tier?
4. What should the next round do, and why?
5. What is new relative to the closest prior work, and is the contribution sufficient for the target tier?

The executor owns engineering, equivalence, acceleration, parameters and evaluator repairs. The mentor judges direction, scientific adequacy and time spent. It may retrieve papers/web sources but does not compute, edit or read private author preferences.

The mentor returns its own note of **at most 1000 characters**: judgments, predictions versus outcomes, rejected families and reasons, concerns and user-source range read. The main session appends it verbatim to `MENTOR_NOTES.md`. Above **6000 characters**, the mentor merges it to replacement text of **at most 3000**; the executor does not author this memory.

### Replies and research rounds

Status, side questions, corrections and blocker reports can end a reply without ending or pausing a round. Honor stop/discussion-only requests. Save useful evidence and continuation context, not records merely to end a response. Resume from the card, recent EVAL and current brief.

## Tools and sources

Use exposed, permitted host tools. Claude setup declares paper search and Exa; declaration is not connectivity or approval. Search snippets aid discovery, not full-text inspection. If retrieval is unavailable, report the gap and use permitted material, not shell or custom-fetch substitutes.

Source separates discovery, identity, reading and support. Prefer DOI lookup; compare title, authors, year and venue/version, retaining conflicts and unknowns. Check compound claims part by part. Bibliography-only checks need no ledger or manuscript edits; systematic-review methods apply when requested.

For body-level details, read with 1–5 concrete questions. Keep one cumulative `papers/<id>.md` under `.dove/research/`: what the paper does, then answers with full-text sections, pages or equations. Reuse answered questions; add unresolved ones rather than rereading everything. Novelty and overlap judgments cite these notes. If only an abstract or exported summary was inspected, identify that source and mark **未读全文**; it cannot support a body-grounded gap or a claim of confirmed overlap.

## Writing, figures and review

Draft groups related work from `papers/library.json` and `papers/library.md` by direction and exports BibTeX from checked metadata. Missing authors or venues stay unknown; unknown publication kind uses `@misc`, not a conference type guessed from a venue label. Summary-only claims retain their source and unread-full-text status. Preserve manuscript format and claim strength; new manuscripts default to LaTeX only where accepted. Inspect the actual build/export after authorized edits.

Figure gathers real data or mechanism materials, creates and renders the visual, inspects final-scale readability and manuscript context, and delivers captions and editable sources. Quantitative plots use reproducible code and real data; diagrams and image tools suit other materials. A standalone preview is not final-context validation.

Independent `dove-review` uses a fresh Read/Grep/Glob context on the complete current manuscript, cited results and supplied grounding. Exclude execution conversation, identity/round records, preferences and old reviews; no retrieval, execution, edits or frozen workspace. It checks question-method fit, field correctness, contribution/evidence fit and the strongest objection, citing evidence and files read. Self-check and delivery checks are distinct; missing review remains a gap.

After substantive changes, a fresh review reads the complete current version; old recommendations are historical. Rebuttal verifies objections, groups causes, responds and makes requested evidence-backed revisions. A reply is not resolution or acceptance. Preserve real returns separately from commentary.

Lessons are fallible guidance, not progress logs. For consequential questions or recurring errors, read the index and useful links. Preserve grounded insights with conditions and counterexamples; missing Lessons need no empty index.

## Run receipts

`dove run` optionally records authorized command facts; it is not required for experiments and grants no permission:

```bash
dove run start --project <dir> --id <id> --group <name> --seed <short-text> --metric-name <name> --direction min|max --timeout-ms <ms> -- <command> [args...]
dove run status --project <dir> --id <id>
dove run resume --project <dir> --id <id>
dove run finalize --project <dir> --id <id> --metric-value <number>
dove run compare --project <dir> --group <name>
```

Start uses a detached, shell-free supervisor and writes `.dove/runs/<id>/run.jsonl`, stdout and stderr. Receipts capture command, timing, outcome, metric/comparison basis, seed and minimum Git commit/dirty facts. Status is read-only; resume never reruns and reconciles only when neither supervisor nor target remains observable. Finalize adds a scalar after termination. Compare ranks compatible finalized runs. Receipts alone prove neither reproducibility nor scientific comparability.

Budget fields describe comparison conditions, not spending caps. Actual limits apply. POSIX timeouts observe the process group and retain grace-period termination after leader exit; escaped descendants are outside that claim. Windows termination is direct-child best effort. Converted timeout/grace values cannot exceed 2147483647 ms. An occupied journal lock is reported, not removed by inferred PID/age.

## Dashboard, tracking and topics

`dove dashboard` serves registered projects at `127.0.0.1:7788`. Research views and library JSON/Markdown/BibTeX exports are read-only; Settings edits registry, tracking and passwords. Use SSH forwarding remotely, or `--password-file` before public exposure so all pages/APIs require login. `--json` returns the summary without a browser.

Tracking runs daily while the dashboard is up, or with `dove watch run [--project <dir>]`. It combines paced arXiv queries, optional community/venue/citation enrichment and OpenAlex neighbor/institution searches, with bounded rate-limit retries. Discovery requires no Semantic Scholar key. Errors or incomplete retrieval are not “no relevant papers”.

Every mentor checks `watch/config.json`; draft or irrelevant tracking needs project-specific keywords, authors, venues, institutions and neighbors. The main session applies advice and sets `source: mentor`. Run now also prompts draft correction. Daily tracking and Trends share relevance criteria; one generic title term is insufficient.

Each selected paper's Chinese `line` explains what it does, not keyword matches. Missing lines show as pending, not automatic translations. The mentor returns `- ID | 撞题/新基线/可借用/无关 | 理由 | 方向 | 中文一句话`; the main session saves `watch/impact-DATE.md`. Existing brief judgments stay usable. Suspected overlap needs body-level checking and linked Q&A; missing evidence stays pending. Core overlap goes to the user; useful baselines and mechanisms affect work.

Papers judged 撞题、新基线 or 可借用 accumulate by direction in `papers/library.json` and `papers/library.md`, retaining ID, title, Chinese line, authors, venue or arXiv ID, date, links and reading provenance. Normal watch runs or the explicit “积累已有影响判断” action save this research library; viewing/exporting does not, and installation never creates it. Optional older-paper supplementation is **off by default**: when enabled with no new papers, select a few important older or conference papers (for example 3–5), retaining original dates and using the push record to avoid repeats.

If no field scan exists or the last is over seven days old, the next mentor checks recent accepted papers, surveys and discussions and returns a sourced, project-relevant scan of at most **2000 characters** for `watch/scan-DATE.md`.

## Submission readiness and maintenance

Submission completion requires scientific sufficiency, current independent review of the same complete version and delivery readiness, not a build or record update alone.

`dove update` can replace valid owned local edits; `dove projects sync` preserves them. Init adds only RESEARCH when the research tree is absent, never a library. User-level `hostMigration` is **off by default**; use Settings or `dove settings --host-migration on|off` (`--json` reports it). When enabled and a release supplies migration tasks, installation/sync writes only a software pending task; read per-project outcomes in [Installation](INSTALL.md).

SessionStart/UserPromptSubmit delivers the task; the host acts at a quiet point without interrupting jobs, recomputing results or changing conclusions or user wording. Tasks normalize existing records, defer notes/tracking to the next mentor, and apply new selection guidance on the next normal reply without rewriting standards or ongoing materials. Close each version once, with completion or non-applicability and a one-sentence report. With the switch off, records stay unchanged.

Context hooks are read-only; verified guidance files enable guidance even with preserved statusLine/MCP differences. Statusline uses session facts and card Mainline/round, not inferred progress. Disk updates do not hot-reload hosts. Report source, build, installation, loading, behavior and scientific outcomes separately. Observe normal authorized use, not test projects or test content in research.
