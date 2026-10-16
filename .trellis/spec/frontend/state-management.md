# State Management

## Ownership

Dove is file-first. Research and ordinary artifacts belong to the researcher; installation owns only declared software resources.

| Material | Meaning |
|---|---|
| `.dove/research/IDENTITY.md` | User goal, core capability, target tier, sourced constraints and round pointer |
| `.dove/research/EVAL.md` | Method-version rows and current mentor assessment |
| `.dove/research/rounds/` | One authored brief and result per round |
| `.dove/research/MENTOR_NOTES.md` | Mentor-authored memory, saved verbatim |
| `.dove/research/topics/` | Project standards and grounded candidate cards |
| `.dove/research/papers/` | Cumulative per-paper Q&A and direction-grouped literature library |
| `.dove/research/watch/` | Configuration, discoveries, dated impacts and scans |
| `.dove/research/RESEARCH.md` | Short history index, not another progress log |
| Existing `missions/`, `experiments/`, `claims/` | History preserved without migration, deletion or new entries |
| Sources, reviews, Lessons, drafts, code, data, figures and logs | Researcher-owned material, not round attachments |
| Manifest-listed integration and `.dove/install/manifest.json` | Managed software and ownership metadata |
| Four exact quality/preference references in `.dove/install/` | Package guidance, not evidence |
| DOCTOR, existing `.dove/reviews/`, `.dove/runs/` and archives | Preserved feedback and user history |

Fixed formats support readable context, not a database or approval system. Write records in natural Chinese full sentences, explaining unfamiliar codes and abbreviations when first used. The approximate lengths below help users read the records; they are not hard limits. Prompts own scientific meaning; [hooks](./hook-guidelines.md) deliver context only. Library files remain research outputs. Optional host migration reorganizes records separately from software installation.

## Core records

### Identity card

Keep `IDENTITY.md` short enough to read at a glance, about 1200 characters, in this order:

```text
Current round: rounds/NNN-brief.md
Round status: ongoing / paused / completed
Mainline:
Core capability:
Target tier:
Deployment inputs/outputs:
Completion:
User restrictions:
Recent corrections:
Research state:
```

Mainline follows round labels. Core capability describes what the research must demonstrate, with the user's words. Ask once for a missing target tier; card text is not confirmation. Preserve clear/provisional intent, changing Mainline only for changed commitments or misrecordings. The dashboard shows core capability beneath the mainline and the latest long-term intent comparison and its date in a collapsed section.

Check recorded user wording or confirmation against the user's own entries in `USER_ORIGINALS.md`; label relay-only sources as relays and recheck attribution during each long-term intent comparison. Missing or unfinished coverage is not evidence the user never said something; consult the original session or current direct words. Restrictions retain their quotation, date/source and long-term or task-specific scope; relays and task limits are not standing restrictions. Apply corrections and update state after results. Put method details/rejected families in briefs or mentor notes. Overlong cards supply their UTF-8-safe first 4096 bytes with a shortening prompt, not a missing-card report.

### Round briefs and results

Each round has one `NNN-brief.md` of about 2000 characters and one `NNN-result.md` of about 3000, so the plan and outcome remain readable without embedding all supporting detail. Link that material in ordinary project directories, not extra round attachments.

A brief starts with `Author: mentor / user / external`, method version and dated user-source paths/range. User instructions outrank external advice, which outranks mentor advice. Save mentor briefs verbatim; replacements name the actual author and reason. Scientific content belongs in [Component Guidelines](./component-guidelines.md#mentor-judgment-and-briefs).

Results start with `一句话：` and use `改了什么`, `测到了什么`, `预期与实际`, and `对本轮说明的反驳与事实更正` (older results use the English equivalents). Briefs carry `一句话：` and `## 预期结果` so the dashboard can show the research trajectory. Include files, actual or missing measurements, evaluator issues and blockers. Keep the last heading even when empty; the next mentor responds first. Engineering failures are neither scientific measurements nor exemptions from the no-science count.

### Evaluation

Begin `EVAL.md` with a Completion reference to the script, protocol and all user metrics. Use one row per method version with Chinese headers; existing English headers may stay:

```markdown
| 日期 | 版本/轮次 | 协议与数据 | 测量结果 | 未见数据与泛化差距 | 结论 | 产物 |
|---|---|---|---|---|---|---|
```

Cells contain numbers and a short sentence, about 200 characters, so comparisons remain easy to read. Link details and raw outputs; keep engineering status out and predictions in briefs. Formal comparisons retain complete strong same-input baselines and all requirements. Unknown stays unknown; diagnostics do not pretend to be full confirmation.

On evaluator repair, immediately mark affected results and restore comparability for the current claim, necessary historical comparisons and strong baselines, reusing valid raw outputs first. Other results remain clearly labeled old-protocol history until needed; do not mix protocols or hide unfavorable evidence. Goal changes still need the user. Development and formal comparison follow [Component Guidelines](./component-guidelines.md#mainline-and-rounds).

After important results, replace the current mentor assessment below the table with about 1000 characters explaining grades, grounds and unknowns. Do not append score logs or duplicate self-ratings. Use the dimensions to identify bottlenecks, shared causes and key unknowns; choose coordinated work or alternatives by their overall value, evidence and lifecycle cost.

### Mentor memory and paper tracking

The mentor returns its own note of about 1000 characters covering judgment, predictions and outcomes, rejected families and reasons, concerns and user-source range. If notes lack a dated long-term intent section or its date is strictly more than seven days old, read `USER_ORIGINALS.md` and return `## 长期意图（YYYY-MM-DD）`. Explain the user's long-term goal, whether the mainline, completion, actual methods and metrics measure core capability, where deviations entered, the novelty judgment and pending user decisions; recheck recorded user wording or confirmation. Raise conclusions once without blocking work. The main session appends notes verbatim to `MENTOR_NOTES.md`. Above about 6000 characters, the mentor consolidates to about 3000 for readable continuity, retaining key reasons, the latest intent section and date, issues already raised and their answers. Notes, not resumed conversations, provide cross-round continuity.

`USER_ORIGINALS.md` is derived under `.dove/install/`, not a mentor-authored research record. Mentor-material generation refreshes it incrementally; the resident dashboard also prewarms it for every registered project in the daily paper-watch schedule, including projects with tracking disabled. Each project uses the existing scan budget, and unfinished work resumes later. Coverage currently includes Claude Code sessions only, not DSH.

Every mentor checks `watch/config.json`, unjudged discoveries and the latest scan, independently of rounds. For draft or off-target tracking, it returns actual suggested JSON with the `keywords`, `authors`, `venues`, `institutions` or `seedPapers` string arrays that need changing; an empty array clears that field, and reasons stay outside the JSON. The main session saves the JSON verbatim to a file and runs `dove watch configure --project <root> --mentor <建议.json> [--json]` during that call. Only suggested fields are replaced, preserving `enabled`, `categories` and all other settings. Check saved values and `source: mentor` in the receipt; this means advice was actually saved, not that the user confirmed research direction. Without advice, keep the draft. Dashboard Run now also prompts draft correction.

New `watch/impact-DATE.md` entries use `- ID | 撞题/新基线/可借用/无关 | 理由 | 方向 | 中文一句话`. The last field explains what the paper does; existing brief judgments remain readable without migration or repeated review. Important suspected overlap needs body-level checking with linked Q&A; absent evidence stays pending. Core overlap goes to the user, useful baselines and mechanisms affect actual work. An absent or over-seven-day-old field scan calls for a sourced `watch/scan-DATE.md` of about 2000 characters explaining the project's implications.

Selected papers judged overlap, new baseline or reusable work accumulate by direction in `papers/library.json` and `papers/library.md`. Retain ID, title, Chinese `line`, authors, venue or arXiv ID, original date, links and reading provenance; missing metadata stays missing. A pending Chinese line is shown as pending, not passed off as an automatic translation. Normal watch runs and the explicit dashboard accumulation action can save existing judgments; library reads/exports are read-only, and installation creates no library.

Optional older-paper supplementation is off by default. When enabled and no new papers are found, select a few important older or conference papers, for example 3–5. Use the push record to avoid repeats and keep original dates rather than presenting them as new releases.

## Supporting material

For needed body details, read with 1–5 concrete questions and accumulate `papers/<id>.md`: a short account of what the paper does, then answers citing sections, pages or equations. Reuse answered questions and add new answers without discarding prior ones. Novelty and overlap judgments cite these notes. Abstract/summary-only material identifies its source and full-text-unread status; it cannot ground a body-level gap. Citation-only checks do not automatically create notes or edit manuscripts.

Draft groups the direction library into related work and exports BibTeX from verified metadata. Do not invent authors or venues, infer conference type from a venue label, or turn summary text into a full-text claim. Unknown publication kind uses `@misc`; retain missing metadata as unknown. Preserve review returns with actual provenance and materials read.

Other notes need a request or useful evidence/continuation purpose, not merely a Skill invocation, compact/resume or elapsed time. Read relevant history rather than whole trees. Topic cards retain status, stage and position and the substantive fields in [Component Guidelines](./component-guidelines.md#mainline-and-rounds); old cards are not rewritten during installation.

Lessons are fallible guidance. Check the index for a consequential question or shared mistaken premise, then useful links only. Preserve insights with basis, conditions and counterexamples within write scope; omit routine progress. Missing Lessons need no empty index.

Status is read-only; corrections need no card edit merely to end a reply. Repeated corrections across registered projects may prompt a question about global guidance, never an automatic edit. `docs/AUTHOR_PREFERENCES.md` is the sole full source. DOCTOR holds Dove feedback, not general issues.

## Lifecycle preservation

- Init adds only RESEARCH when the research tree is absent, not cards, Q&A or a library. Installation/lifecycle operations preserve research and ordinary artifacts.
- User-level `hostMigration` defaults off; Settings or `dove settings --host-migration on|off` changes it. When enabled and a release has a task, install/sync registers only software pending work. The next applicable hook delivers it; neither CLI nor hooks migrate research.
- The host acts when current work settles, without stopping/restarting jobs, recomputing results or changing conclusions/user wording. The current task normalizes card fields and provenance, preserves long EVAL content verbatim in linked same-directory history, and leaves note consolidation and draft-watch correction to the next mentor. Completion or stated non-applicability closes that version's task once and gets a brief report; the same version is not repeated.
- Guidance files are owned individually, not the entire install directory. Sync preserves modified/missing owned items and user hooks; a retired owned Stop is removed only when its digest matches. Explicit update blocks on retired-item conflicts. Uninstall removes still-owned resources.
- Unsupported manifests remain blocked. Verified guidance files supply context despite reported statusLine/MCP differences. Doctor reports software facts, not scientific health or reload. Detailed hook and transaction behavior belongs to its owning specifications.

Transaction contracts belong in [Type Safety](./type-safety.md); sources and projections in [Directory Structure](./directory-structure.md).
