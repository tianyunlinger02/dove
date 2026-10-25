# Usage

Dove helps choose research directions and push a confirmed mainline forward through real work. The host pushes on by itself and stops only for decisions that are the user's, for an overrun or a stall, or when the user says stop — not to write reports. Dove computes facts from the records, asks at fixed moments and quotes the user's own words when the work drifts; the mentor judges at decision points. Bounded questions, edits and discussions keep their scope.

## Start using Dove

```bash
npm install --global <exact-dove-package-specifier>
cd <target-project>
dove
```

The bare public npm name `dove` is unrelated. Use a trusted artifact; see [Installation](INSTALL.md).

## Entry modes

Ordinary Claude conversation in an initialized project is the primary entrance; `claude --agent dove` is optional. Seven flat `/dove:*` commands are shortcuts, not stages or permission grants. There is no Auto command.

| Skill | Use it for |
|---|---|
| `dove.research` | Develop grounded candidates for the user's choice, or advance the confirmed mainline. |
| `dove.status` | Report results, the main metric, the current round and blockers without starting work. |
| `dove.source` | Retrieve sources, accumulate full-text Q&A notes and check citations and claims. |
| `dove.experiment` | Develop, diagnose, evaluate and analyze actual method outputs. |
| `dove.draft` | Write from evidence and direction-grouped literature, respond to reviews with evidence-backed revisions, export BibTeX and inspect delivery. |
| `dove.figure` | Gather materials, draw, inspect and deliver visuals, captions and editable sources. |
| `dove.review` | Distinguish author self-check, delivery checks, independent paper review and returned opinions. |

## What the host reads, and when

| File | Content | Who reads it, when |
|---|---|---|
| `.claude/rules/dove.md` (operating manual) | The one place operating rules are written: three records, six moments and what to answer at each, what belongs to the user and the three reasons to stop, reporting, tools, restrictions only from the user's words | The main session, at session start (Claude loads project rules) |
| `.dove/install/AUTHOR_PREFERENCES.md` (the user's most frequent sayings) | Twelve verbatim quotes with dates, each followed by what to do | The main session reads it personally at the start of every new main context |
| `.dove/install/RESEARCH_QUALITY.md` (research standard) | Researcher stance, from problem to method, eight dimensions with definitions, evidence and experiments, topic selection and novelty | The mentor and reviewer every time; the main session at the moments the manual names |
| `.dove/install/AUTHOR_PREFERENCES_FULL.md` | The user's full preferences, unchanged | On demand |
| `.dove/install/TOPIC_CRITERIA.md` | Topic-selection standard | During topic selection |

Compaction and resume reuse what was read. After an update, each open session gets one notice with its next message to re-read the manual and the sayings. Installation or another agent's reading proves neither current adoption nor evidence or permission.

## The six moments

The operating manual names six moments and what to answer at each:

1. **After the mainline is confirmed** — build the real evaluation first (official metric, real development set, strongest available external method) and write the main metric at the top of EVAL for the user to confirm once.
2. **Before a new method or core module** — write the method design (how far it must go, judged by accepted papers of the target tier; what experts in this field and other fields do; when the first real result is expected; why this step improves the original problem and by how much), say how it differs from method families the mentor notes rejected, look at `.dove/install/CROSS_PROJECT_EXPERIENCE.md`, and start only after the user has seen it.
3. **Each round's start** — write the aim (the dimension the latest mentor judgment found most holding the work back), how it counts as done, the scale and why it is enough, and the due date.
4. **Each round's end** — write the verdict, what judgment changed, what the next step changes because of it and how much closer the final result is; then ask the mentor.
5. **Overrun or stall** — answer Dove's quoted question, then stop with a one-page decision memo for the user: continue the current method (with reasons), change the method (including at least one family not derived from it) or change direction.
6. **After a user correction** — change the next step and write what changes into the next brief; do not invent causes or turn it into a rule.

## Scope, plans, and progress

Preserve the user's confirmed Mainline, intended contribution, completion meaning and fixed methods. A field, recommendation or card entry is not confirmation. Record clear intent without asking again; keep provisional intent provisional. Revise other designs with evidence. Changes to user commitments, deployment inputs/outputs or resources need the user, not routine engineering.

Confirmation ends selection-only limits; ask once for any separate resource/model authorization. Diagnose key unknowns, design the core method, experiment, then write the proposal. Scale must answer the question; pipeline connection is not core evidence.

Answer judgment questions directly, then give the evidence and key unknowns the user needs to decide. Use natural language without a fixed verdict vocabulary, sentence budget or banned opening; previously explained, unchanged boundaries need not be repeated. Report scientific progress, engineering, delivery and software checks separately.

## Research Markdown

Records under `.dove/research/` belong to the researcher. Installation does not rewrite them; optional [host migration](#submission-readiness-and-maintenance) applies new formats at a quiet point.

### Topic selection and original-user grounding

First establish the current request and completion conditions. Already-authorized implementation, repair, reproduction and bounded delivery proceed without being recast as topic selection or assigned research scores and rounds. For actual topic selection, read Dove's topic-selection standard (`.dove/install/TOPIC_CRITERIA.md`, revised only in Dove) and the project's settings in `.dove/research/topics/PROJECT.md`. Selection ends with the user's mainline choice, not a closed-method proposal; higher standards bind their deliverables, not recommendations. Ground value in real strong-baseline failures and sourced numbers. Focus each challenge axis on consequential gaps: “prior methods do X through Y, but Y leaves Z unresolved.” Cite two body-read near-miss papers, their shortfalls, a deficiency and observable closure. Abstracts or absent precedent are not evidence.

Search in-domain and cross-field mechanisms according to key unknowns, reading the source mechanism and closest prior work. Six to ten queries and three other subfields can help broaden a search; they are not delivery quotas or proof of novelty. Explicit user requirements still apply. Generate parallel candidates before pruning. One sourced idea with key unknowns can support selection; method design and closure belong within the mainline. Cards in `topics/cards/` retain status, stage, position and these fields:

- One-sentence idea.
- Gap it attacks.
- Source papers, borrowed mechanism and why it works there.
- Mapping to this problem: what plays the role of what.
- Why it could work and the key assumption it requires.
- Specific difference from the closest in-domain work.
- Main risk; when improving a candidate, identify what changed.

The mentor searches “borrowed mechanism + target problem” and gives its judgment with cited evidence and the strongest objection. Revision addresses bottlenecks and shared causes, comparing coordinated changes or alternative routes rather than mechanically patching one weakest item. Deliver candidates, neighbors and the best 2–3 choices within one round; give just one if that is all. If conflicting standards or prohibited evidence block recommendations, explain once and still offer the best directions for user choice or standards adjustment, not another static round. Before choice, implement no methods; only standards-allowed diagnostics.

`dove topic start [--project <dir>]` creates `.dove/research/topics/` with a README, a `PROJECT.md` for this project's own settings and an empty `cards/` directory. The standard stays in `.dove/install/TOPIC_CRITERIA.md`; Dove maintains it and the project keeps no copy. The tool does not replace reading the standard. A takeover continues an already confirmed mainline.

The mentor reads genuine user wording from the supplied host source and date/range. Hooks expose `transcript_path`, not copied contents. On takeover, read relevant history; later continue from the recorded range. Meta messages, tool returns, system injections, subagent conversations and executor summaries are not user originals. The current original may be supplied before persistence. Inaccessible sources leave provenance unknown, not commitments or permissions revoked.

### Identity card

Keep `IDENTITY.md` short enough to read at a glance, roughly 1200 characters. Its research state is about 300 characters of plain Chinese written by the mentor; the main session copies the mentor's text onto the card unchanged:

```text
Current round: rounds/NNN-brief.md
Round status: ongoing / paused / completed
Mainline:
Research state:
Method design: rounds/NNN-brief.md
Core capability:
Target tier:
Deployment inputs/outputs:
Completion:
User restrictions:
Recent corrections:
```

Completion states the effect to reach: on which real task, how well, and by how much over the strongest existing method; papers, tables and code carry it rather than constitute it, and a user-confirmed completion is not rewritten. Ask once for a missing conference/journal target tier. Restrictions include quotation, date/source, original-versus-relayed provenance and long-term-versus-task scope; a relay or task limit is not a standing restriction. Method details and rejected families belong in briefs or mentor notes.

Hooks place the recorded research state first, even when it occurs after a long card prefix, then show the bounded card without repeating that state. They do not summarize or rewrite research.

### Evaluation table

After mainline confirmation, first make official metrics run on a real development set, not a synthetic training-distribution slice, and reproduce the strongest available external method or at least match its reported figures. Report missing resources or blocked evaluation immediately. Build the method's first version complete enough to run on that evaluation, using mature libraries, code and standard training recipes outside the core idea, then attack the largest bottleneck the numbers show rather than perfecting one component first. Synthetic/training results are development signals.

`EVAL.md` has three parts:

```markdown
主指标：<name>（<data and protocol>）；当前最好：<value>（<date>，第 N 轮）

| 日期 | 轮次 | 问题价值 | 创新 | 机制与理论 | 方法质量与可行性 | 数据与评价 | 实现 | 实验与证据价值 | 表达与交付 | 最卡的一维 |
|---|---|---|---|---|---|---|---|---|---|---|

| Date | Version/round | Protocol/split | Measurements | Unseen data/train-test gap | Conclusion | Artifacts |
|---|---|---|---|---|---|---|
```

- The **main metric** is the one number on the real task that best represents the final goal. The user confirms it once; it shows progress and is never a gate; it can change with the user's agreement. Below it, link the scripts, protocols and all user metrics the completion needs.
- The **eight-dimension trend table** gets one row per mentor judgment; the last column names the dimension most holding the work back, which becomes the next round's aim. The latest detailed grounds sit below the table. Implementation uses grades 1–3, the other seven dimensions 1–4; unknown is not zero; ordinal grades are not averaged.
- The **method-version table** records only versions tested on the real evaluation, one row each, numbers written as value/denominator plus unit, each row linking its result file. Cells hold numbers and short sentences, not engineering logs.

The executor repairs evaluator errors, immediately marks affected results, and first restores comparability for the current claim, necessary historical comparisons and strong baselines, reusing raw outputs where valid. Other affected history remains clearly marked under its old protocol and is revisited when it matters. Never mix protocols or hide unfavorable evidence. Changes to the goal's meaning need the user.

### Round briefs and results

A round is one complete test of a method version on the real evaluation, or one decision on the core method; the diagnostics, fixes and small experiments it needs happen inside the round and are recorded in ordinary project files, not as rounds or mentor calls of their own. Each round has one `rounds/NNN-brief.md` (about 2000 characters) and one `NNN-result.md` (about 3000).

A brief opens with five lines, then `一句话：` and `## 预期结果`:

```text
Author: mentor / user / external（method version; dated user source）
对准：<one of the eight dimensions — the latest mentor judgment's bottleneck>
见分晓：YYYY-MM-DD（开始：YYYY-MM-DD）
规模：<samples, training and compute, and why that is enough to tell the result>
预测：<one quantity> <its value now, or 未测> → <the range you are 80% sure of>
```

`## 预期结果` says how the targeted dimension counts as done, how the end-to-end metric of the original task should move, which link it depends on and what result would change the decision. User instructions take priority; save mentor text verbatim and identify replacement authors/reasons.

Before implementing a new method or core module, show the user the method design below. Save it in the brief and point `IDENTITY.md`'s `Method design` at that brief; the dashboard reads the same text. Later repairs keep the reference rather than copying a design into every round. User replies are actual quoted words with date/source, never inferred from a card or an ongoing round. Ordinary fixes and evaluation repairs do not repeat this step.

```markdown
## 方法设计
### 要解决什么问题
Specific real-data failure and evidence, and how far a solution must go (judged by accepted papers of the target tier: which benchmark, by how much over the strongest method).
### 外部方法为什么不行
Named paper, mechanism and evidence of the gap, including the default approach experts in this field would take and approaches to the same structure in other fields; say why we do not use them.
### 我们的改法为什么能修
Proposed fix, predicted outcome, success/failure criteria, why the scale can separate outcomes, and when the first real result is expected.
### 用户答复
Actual user words after seeing the rationale, with date/source; absent means unknown.
```

A result opens with `判定：兑现 / 未兑现 / 方法取舍（采纳或放弃什么）`, judged only against what the brief wrote in advance, and `实测：<the same quantity> <its value>`, then `一句话：` and four headings: `## 改了什么`, `## 测到了什么`, `## 预期与实际` (including what judgment changed, what the next step changes and how much closer the final result is) and `## 对本轮说明的反驳与事实更正`.

The prediction names one quantity — the main metric, or the most telling number in the targeted dimension — and an 80% range, for example `预测：事件 F1 12.7 → 14–17`: of five such predictions about four should land inside. Uncertainty goes into the width of the range, not into conditions ("若……否则……") or caveats ("低置信度", "不是保证"). The result writes `实测：` with the same quantity. A clearly stated miss is scientific information about which link was weaker than expected, not a failure.

Dove reconciles each round's `预测` with its `实测`: whether the measurement fell inside the range, the interval score (width plus ten times any miss, so a wide range cannot buy hits), the width against the real change, and how large the predicted change was against the real one. Lines written otherwise still parse; conditional wording, one-sided bounds, points without a range and several quantities are marked as unscored. Over the recent rounds Dove gives the mentor a conclusion with its grounds — conservative (nearly every range hit and much wider than the real change), optimistic (misses short of the predicted change, or predicted change at least twice the real one), vague (most predictions cannot be scored) or calibrated — which the mentor uses when writing the next prediction. It also checks whether the numbers under `## 测到了什么` appear in the text artifacts the result links. These are statistics for the mentor and the dashboard, counted per round; the host is not prompted about them.

A scientific result is a change in the real-task metrics or a clear decision on the core method (adopting or dropping a method family). A negative result that settles such a decision counts; a diagnostic that only rules out one local variant, parameter or implementation hypothesis does not, nor does a plan, launch, smoke test or engineering check.

Keep method changes and measurements version-traceable, including coordinated changes and useful old versions for ablation. Development first uses diagnostics that answer the key unknown; formal comparison, result adoption and paper claims require the applicable protocol, all user metrics, fair strong baselines and unseen-data evidence. Unmeasured effects of a new version remain unknown, not inherited passes. After test use, formal comparison of a changed method needs a fresh draw unused in development or previous tests and same-set baselines, not reshuffled old data. Only final heldout confirmation declares claim, controls, data and metrics beforehand and uses heldout once.

`RESEARCH.md` is a short history index. Existing `missions/`, `experiments/` and `claims/` stay in place without migration, deletion or new entries. Old rounds are never rewritten.

### What Dove computes

Dove reads the records itself and computes:

- the current round's aim, due date, scale and how it counts as done, from the brief's opening lines and `## 预期结果`;
- each round's verdict, from the result's `判定：` line;
- **overrun**: the current round has no result and its due date has passed by as long again as the planned span (start to due date, at least a day);
- **stall**: the two latest results are both `未兑现`, with no method decision between them;
- the main metric line and the eight-dimension trend from `EVAL.md`;
- what waits for the user: a method design without a recorded reply, an overrun or stall decision, and the latest mentor note's `### 待用户决定` items;
- per-day subagent calls and context compactions, counted incrementally from the session transcripts with the user-originals scan.

These facts go into every user message's context, the three-line status line, the mentor handoff and the dashboard.

When the host ends a turn, the Stop hook checks overrun and stall. Each condition is asked once: an overrun quotes the user's 10-11 words about reaching the final goal fastest and asks where the work is stuck and whether there is a faster path; a stall quotes the user's 10-23 "先整理一下……" and asks the host to sort the work that way, then stop and ask the user. The prompt is labeled as Dove quoting the user, is never collected as the user's own words, and does not fire while the host is already answering a Stop prompt. `dove settings --stop-prompts off` (or the dashboard's Settings) turns it off.

### Mentor judgment and memory

Call the independent mentor (the native `dove-mentor` agent) when a round has a verdict, on an overrun or stall, for a new method design and when the user asks. Use a fresh native context with the body from `dove mentor brief --project <root>` plus one sentence of trigger; the same judgment may be asked two or three follow-ups. The handoff places user-original excerpts, bounded raw text from explicitly supplied `--artifact` files and the facts Dove computed before the host's records; EVAL, briefs and opinions are navigation, not the conclusion frame. Paper-watch materials are attached once a week, or with `--watch` when the user asks. The long-term intent comparison is due when there is none yet, three rounds after the last one, or after a round that decided on the core method.

The mentor first answers:
1. If asked what substantive research progress occurred, what is the honest one-sentence answer?
2. Did recent work test the core method, or repair engineering/evaluation and build systems?
3. On the current approach, what still separates the work from the user's final result, how long will it take, and is there a more direct or faster path?

Then it checks the verdict against the brief, checks the method design against raw results, raises real questions about direction and novelty (considering at least one option not derived from the current approach), and returns: the eight-dimension judgment as one trend-table row with the bottleneck dimension; the next brief in the manual's format; the plain-language research state; and its notes — judgments, predictions versus outcomes, rejected method families and reasons, concerns, `可迁移：` lessons for other projects and `### 待用户决定`. The main session appends the notes verbatim to `MENTOR_NOTES.md` and copies the research state and trend row onto the card and EVAL unchanged. Main-session research judgment stays with the main session.

### Replies and research rounds

Status, side questions, corrections and blocker reports can end a reply without ending or pausing a round. Honor stop/discussion-only requests. Save useful evidence and continuation context, not records merely to end a response. Resume from the card, recent EVAL and current brief.

## Tools and sources

Use the host's available tools and configured services for the requested work. Claude setup declares paper search and Exa; declaration alone does not establish connectivity. Read the actual paper or page through these integrations, WebFetch, scholarly APIs or direct downloads as available. Search snippets aid discovery, not full-text inspection; say when only snippets or abstracts support a judgment and report material that could not be retrieved.

Source separates discovery, identity, reading and support. Prefer DOI lookup; compare title, authors, year and venue/version, retaining conflicts and unknowns. Check compound claims part by part. Bibliography-only checks need no ledger or manuscript edits; systematic-review methods apply when requested.

For body-level details, read with 1–5 concrete questions. Keep one cumulative `papers/<id>.md` under `.dove/research/`: what the paper does, then answers with full-text sections, pages or equations. Reuse answered questions; add unresolved ones rather than rereading everything. Novelty and overlap judgments cite these notes. If only an abstract or exported summary was inspected, identify that source and mark **未读全文**; it cannot support a body-grounded gap or a claim of confirmed overlap.

## Writing, figures and review

Draft groups related work from `papers/library.json` and `papers/library.md` by direction and exports BibTeX from checked metadata. Missing authors or venues stay unknown; unknown publication kind uses `@misc`, not a conference type guessed from a venue label. Summary-only claims retain their source and unread-full-text status. Preserve manuscript format; a rewrite neither strengthens nor weakens a claim beyond its evidence. New manuscripts default to LaTeX only where accepted. Write a paper, not an experiment report, and play to the work's strengths: state contributions and strong results positively with their key numbers; say each needed qualification once, gathered in a limitations paragraph that lists only the boundaries that matter, rather than ending the abstract on limits or repeating disclaimers in the text and captions; mention weak points in a sentence or two with the direction for improvement and leave details to the supplement. An abstract usually runs problem → what existing methods lack → the core idea → the capability it gives → one or two key results → the mechanistic conclusion, with a number or two; each experiments paragraph opens with its conclusion and then points to the figure or table; full numbers, denominators, protocols and settings go to tables, the experiments section and the supplement. Keep terms and notation consistent and defined at first use, and keep project-internal language — round numbers, method version names, internal file names, protocol code names, debug states — out of the paper. Each group of related work ends with how this work differs.

Before writing or a major revision, inspect the full PDFs of two or three accepted papers from the last two years in the same direction and submission format, preferably strong related work already cited. Compare section space and the first figure's page; the argumentative job of each introduction paragraph and the conclusion–figure/table–explanation order of experiments; each visual's evidence and placement; and wording for contributions, main results, ablations and limitations. Save page references and the choices adopted for this manuscript beside it, for example in `paper/REFERENCE_LAYOUT.md`, and reuse those notes. Learn argument structure and sentence function rather than copying sentences or visual counts.

Draft and Figure share one **claim–evidence–placement–size** table beside the manuscript: which figure or table supports each claim, main text or supplement, nearby section, single- or double-column width, actual width and target height. Draft budgets it before writing; Figure draws to that budget and brings any request for more space back to Draft. Use the allowed main-text pages fully (for example CVPR's eight pages excluding references): when short, add motivation, intuition, examples and analysis or bring the strongest supplementary evidence into the body; when over, move secondary visuals and content before compressing prose. Draft places the returned figure, checks its caption, body description and cross-references, and rebuilds; if it does not fit, adjust placement and selection first, then ask Figure to resize if needed, updating the same table. Figure's handoff lists composition, size, label or evidence changes affecting the text, such as a removed panel or changed legend color.

After any figure change and before delivery, inspect the actual build/export page by page for empty or float-only columns, large blank areas, underused pages, figures or tables more than a page from first mention, and visuals pushed past the conclusion or onto reference pages. Check captions and references against the revised figures and inspect the whole figure set's style. For LaTeX, where the venue template allows, default to `\topfraction=0.9`, `\dbltopfraction=0.9`, `\textfraction=0.08`, `\floatpagefraction=0.9` (via `\renewcommand`) and `topnumber=3` (via `\setcounter`). Fix remaining placement in source order or content selection, not with negative spacing or smaller type. `dove figure --pages <manuscript.pdf> --body-pages <limit> --output <sheet.png>` lays every page out in one sheet, marks blank column space, large gaps and columns holding almost no running text, and computes from the references heading how many pages the body uses.

Before handing over or submitting, check that each number agrees everywhere it appears — abstract, introduction, body, tables, captions and supplement — and traces to the result files, rechecking the whole text after results change; that every pointer into the supplement resolves, with the supplement built and inspected on its own; and, for double-blind venues, anonymity: author information, acknowledgments, links naming users or institutions, first-person self-citations, PDF metadata and supplementary files.

Figure is cross-domain scientific visual explanation, not a subject-specific illustration style. For a paper's figure set, first give each figure its job: the claim it carries, the evidence only it can show, what tables or text already carry, and whether it belongs in the main text or the supplement within the page limit. When a claim is about what a method produces, the main text shows real outputs readers can judge themselves (fixed-order or random, not best-picked, diverse, including failures); rates and errors stay in tables. Mechanism figures explain why a method works; result figures show whether it does, and neither replaces the other. The first figure lets readers see at a glance the problem and the paper's core result or idea. Compared methods share the same inputs, viewpoints and rendering settings. Start from the question, takeaway, audience, the paper's existing visual language, target manuscript column width and real materials. Choose representations by what the reader needs to understand: states and interventions can explain mechanisms, boxes and connections can explain information flow, aligned panels can expose differences, and measured positions with uncertainty can support quantitative conclusions. These are choices, not prescribed layouts. Neither minimalist flowcharts nor rich 3D objects define publication quality.

Tell a redraw from a revision. When the user asks for a redraw, design from the claim–evidence–size table and references without looking at, or showing the model, the old figure, and compare with the old one only at the end with `dove figure --compare`; a local revision starts from the existing figure and revisits only the affected choices. For key figures such as the first figure or the method overview, have the image model propose two or three distinct compositions and choose one or merge their strengths. When a new figure replaces an old one, say where it is better and where the old one was better, and let the user choose or combine.

For a new composition, inspect actual published figures suited to its explanatory task, including useful references from other fields, and use applicable venue/artwork guidance when it matters. Reuse established choices from the same paper when they still fit; investigate only the gaps for a follow-up or local revision. Turn the references into a concrete synthesis: what gets the most area, where reading starts and continues, how identities or quantities correspond across views, which panels share alignment or scales, how close-ups connect, and how density, spacing, typography and color support the explanation at manuscript size. The synthesis must guide the model brief, asset selection, editable composition and final inspection—not remain a list of paper names or generic style words. Discovery snippets or figure captions are not visual inspection, and this does not require a fixed reference count or a fresh survey for every edit.

PPT is the editing surface, not the figure format. Use the venue/template's actual single- or double-column width when available, otherwise state a provisional width. Choose fonts, mathematical notation, program-token treatment and line weights for that final physical size — at print size no text below about 6–7 pt and no line thinner than about 0.5 pt unless the venue says otherwise; use a few intentional semantic roles rather than per-label micro-adjustments. Arrange the content, then fit the canvas height and margins to its explanatory structure and any venue limit. Do not inherit 16:9, 4:3 or another preset slide ratio, fill a large frame for its own sake, or force all material into uniform horizontal bands. Keep deliberate grouping space while removing unused canvas. The image model's supported pixel dimensions are a working surface, not a requirement on the final PPT aspect ratio. PPTX/PDF/PNG use the same content-fitted canvas and proportions; do not stretch the exported figure or its evidence to fit the paper. No font family, size ladder, palette or layout is universal: follow the venue, manuscript notation and the current figure's explanation.

For composed figures, implement the synthesized design by combining model-led explanatory imagery, real evidence, native vectors and reproducible data plots as appropriate. Figure's generated host guidance includes an adaptable model brief for the message, facts, materials, reference synthesis and visual continuity; it is not tied to a field or a fixed visual style. Give the model that filled brief and actual reference images when available before building PPT. Preserve the selected hierarchy, reading path, correspondence and visual language through implementation, correcting model errors and replacing placeholders with real materials. Detailed illustrations and real evidence remain separate replaceable media, with native PPT labels, connectors and useful vector elements. Editability does not mean tracing rich imagery into simple geometry. Quantitative plots come from real data and reproducible plotting code, with deliberate axes, units, scales and uncertainty; an image model can propose placement, not invent measurements. Plot-only work needs no image-model call or PPT wrapper; deliver its plotting code and vector/raster exports.

Inside a figure, put only short labels close to their referents: no qualifications, disclaimers or exceptions, and no internal terms such as vertex ids, version numbers, debug states or file names. The caption's first sentence is the figure's takeaway, followed by how to read it and any needed qualification, stated once; error bars name what they show (standard deviation, standard error or confidence interval) and the sample size, and result examples say how they were chosen; protocol details, sample identities and render records belong in the supplement or the figure's source notes. Render real outputs so the structure readers must judge is visible, with one convention across the set (lighting, material, view, color by meaning); 3D meshes show their edges and are colored by part or semantics by default. Close-ups are re-rendered from the source data, never enlarged crops. The image model designs composition and explanatory imagery only; real outputs are never generated, redrawn or altered by it, and any evidence in a model design is replaced by the original files in the PPTX. Keep a shared style per paper — size ladder, palette and what each color means, line weights, evidence rendering — used by the plotting code and the PPTX alike. Colors that carry meaning stay distinguishable in grayscale and for color-blind readers (pair them with shape, line style or lightness), and one color keeps one meaning across the paper. Embedded images and evidence keep their aspect ratio in composition as well as export. A local structure a figure argues about must be visible at the final column width; if it is not, reframe, enlarge or add a re-rendered close-up rather than explaining it in text. Open the actual export at manuscript size and compare it with the scientific explanation, synthesized reference decisions, established paper language and any model design used; refine focal hierarchy, panel relationships, correspondence, density, glyphs and legibility, not just export validity. If local edits cannot repair a weak explanation, revisit the representation or composition instead of polishing the same layout indefinitely. Deliver the appropriate editable source, assets/creation code, caption and same-source PDF/PNG; composed figures include the PPTX. The main session uses available authoring/export tools; `dove figure` generates/edits image designs and assets, not PPTX/PDF. `dove figure --tools` shows the machine's python-pptx Python and its PPTX-to-PDF and PDF-to-PNG commands. Check the whole set with `dove figure --proof`, which lays every figure out at its printed width (single-column figures in pairs, full-width ones on their own row) to compare size ladders, palettes and shading; when revising a figure, look at `dove figure --compare` (before and after at the printed width) before calling it done. Both also flag raster figures too small to print sharply at 300 dpi. Report missing materials or tools, failed model calls and reused designs plainly.

Configure the image model in `$XDG_CONFIG_HOME/dove/settings.json` (default `$HOME/.config/dove/settings.json`), keeping the existing fields:

```json
{
  "figure": {
    "baseURL": "http://127.0.0.1:8317/v1",
    "model": "gpt-image-2.5"
  }
}
```

`baseURL` is the API root of an OpenAI Images-compatible service. The key is read from `figure-api-key` in the same Dove configuration directory, or from the environment variable named in `figure.apiKeyEnv`; when `baseURL` is the host's own model gateway, the key the host already uses for that gateway works too. `dove settings --json` reports the current settings; changing `hostMigration` in CLI or dashboard preserves `figure` and other fields.

```bash
# Inspect available composition/export tools without calling the image model.
dove figure --tools
# A brief may be supplied directly or read from a file.
dove figure --project <root> --prompt "<filled scientific design brief>" \
  --output figures/design.png --quality high --json
# Design from paper figures; the prompt explains each reference's role.
dove figure --project <root> --prompt-file figures/prompt.txt \
  --image ~/papers/reference-fig2.png --output figures/design-v1.png --json
# Before/after of a revised figure, and the whole set, at printed widths.
dove figure --project <root> --compare --before checks/old/fig4.png \
  --after figures/fig4.pdf --width 83.34mm --output checks/fig4-before-after.png
dove figure --project <root> --proof --figure figures/fig1.pdf@174.63mm \
  --figure figures/fig2.png@83.34mm --figure figures/fig4.pdf@83.34mm \
  --output checks/figure-set.png
# Edit that design/asset, not the real evidence embedded in the final PPTX.
dove figure --project <root> --prompt-file figures/revision.txt \
  --image figures/design-v1.png --image figures/style.png \
  --output figures/design-v2.png --size 1536x1024 --json
```

Paths may be anywhere; relative paths resolve against `--project` (default current directory). The prompt identifies each image's role and what to change or preserve. Inputs may be PNG, JPEG or WebP. Without `--image` the request goes to `{baseURL}/images/generations`; with images it goes to `{baseURL}/images/edits` with ordered `image[]` inputs. `--size`, `--quality` and `--background` are passed through when given. Rate limits and gateway errors are retried a few times; a rejected key falls through to the next available key; other failures show the service's own message. The image is saved with the extension of what the service returned, and an existing output name gets a numbered suffix instead of being overwritten.

Independent `dove-review` uses a fresh Read/Grep/Glob context on the complete current manuscript, cited results and supplied grounding. Exclude execution conversation, identity/round records, preferences and old reviews; no retrieval, execution, edits or frozen workspace. It checks question-method fit, field correctness, contribution/evidence fit and the strongest objection, citing evidence and files read. Self-check and delivery checks are distinct; missing review remains a gap.

After substantive changes, a fresh review reads the complete current version; old recommendations are historical. Responding to reviews belongs to Draft: verify objections, group causes, respond and make requested evidence-backed revisions. A reply is not resolution or acceptance. Preserve real returns separately from commentary.

## Dashboard, tracking and topics

`dove dashboard` serves registered projects at `127.0.0.1:7788`. Each project page shows the main metric, the eight-dimension trend, each round's aim, verdict and scale, overrun and stall flags, a ledger with one row per round (days taken, subagent, compaction and mentor counts, the user's corrections, verdict, prediction against measurement), a per-round bias table (reconciliation, how many reported numbers the linked artifacts back, hedging per thousand characters of replies, newly written gate words, claims that something was verified or passed in a turn that neither ran nor read anything), and what waits for the user. **经验** collects the mentors' `可迁移：` lessons across projects (also written into each project as `.dove/install/CROSS_PROJECT_EXPERIENCE.md`); **纠正** groups the user's own words of the last 30 days by topic with counts and recent wording, and counts corrections per round in each project, as input for Dove's development and for updating the sayings with the user's agreement. Research views and library exports are read-only; Settings edits registry, tracking, host settings and passwords. Use SSH forwarding remotely, or `--password-file` before public exposure so all pages/APIs require login. `--json` returns the summary without a browser.

Tracking runs daily while the dashboard is up, or with `dove watch run [--project <dir>]`. It combines paced arXiv queries, optional community/venue/citation enrichment and OpenAlex neighbor/institution searches, with bounded rate-limit retries. Recent arXiv retrieval pages through a fixed submission-date window with a finite page budget; a later-page failure or unfinished window preserves discovered items, reports partial retrieval and keeps the previous successful waterline. Discovery requires no Semantic Scholar key. Errors or incomplete retrieval are not “no relevant papers”.

The weekly mentor watch review checks `watch/config.json`; draft or irrelevant tracking needs project-specific keywords, authors, venues, institutions and neighbors. The main session applies advice and sets `source: mentor`. Run now also prompts draft correction. Daily tracking and Trends share relevance criteria; one generic title term is insufficient.

Each selected paper's Chinese `line` explains what it does, not keyword matches. Missing lines show as pending, not automatic translations. The mentor returns `- ID | 撞题/新基线/可借用/无关 | 理由 | 方向 | 中文一句话`; the main session saves `watch/impact-DATE.md`. Existing brief judgments stay usable. Only complete labels in the category cell count as judgments; uncertain suffixes such as `无关？待核实` remain pending. Trends excludes a paper only for projects that judged it irrelevant, preserving its use in other projects. Suspected overlap needs body-level checking and linked Q&A; missing evidence stays pending. Core overlap goes to the user; useful baselines and mechanisms affect work.

Papers judged 撞题、新基线 or 可借用 accumulate by direction in `papers/library.json` and `papers/library.md`, retaining ID, title, Chinese line, authors, venue or arXiv ID, date, links and reading provenance. Normal watch runs or the explicit “积累已有影响判断” action save this research library; viewing/exporting does not, and installation never creates it. Optional older-paper supplementation is **off by default**: when enabled with no new papers, select a few important older or conference papers (for example 3–5), retaining original dates and using the push record to avoid repeats.

If no field scan exists or the last is over seven days old, the next mentor checks recent accepted papers, surveys and discussions and returns a sourced, project-relevant scan of at most **2000 characters** for `watch/scan-DATE.md`.

## Submission readiness and maintenance

Submission completion requires scientific sufficiency, current independent review of the same complete version and delivery readiness, not a build or record update alone.

`dove update` can replace valid owned local edits; `dove projects sync` preserves them. Init adds only RESEARCH when the research tree is absent, never a library. User-level `hostMigration` is **off by default**; use Settings or `dove settings --host-migration on|off` (`--json` reports it). When enabled and a release supplies migration tasks, installation/sync writes only a software pending task, once per task; read per-project outcomes in [Installation](INSTALL.md).

Claude SessionStart/UserPromptSubmit delivers the task. Init/update also reports an enabled pending task in text and JSON, including unchanged updates. The host acts at a quiet point without interrupting jobs, recomputing results or changing conclusions, old rounds or user wording. With the switch off, records stay unchanged.

Context hooks never change research records. They write only Dove's derived files: on compact or resume the user-originals summary and activity counts, and a small `.dove/install/hook-state.json` remembering which session saw which guidance version and which Stop prompts were asked. The status line has three lines: session facts and the mainline; this round, its aim and due date, overrun or stall, and the main metric; the project path. Disk updates do not hot-reload hosts. Report source, build, installation, loading, behavior and scientific outcomes separately. Dove is checked by replaying real decision points on copies of real projects, not test projects or test content in research.
