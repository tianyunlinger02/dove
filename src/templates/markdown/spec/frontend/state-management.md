# State Management

## Ownership

Dove is file-first. Research context and ordinary artifacts belong to the researcher; installation owns only declared software resources.

| Material | Meaning |
|---|---|
| `.dove/research/IDENTITY.md` | Current user goal, target tier, sourced constraints and round pointer |
| `.dove/research/EVAL.md` | One row per method version and the current mentor quality assessment |
| `.dove/research/rounds/` | One authored brief and one result per round |
| `.dove/research/MENTOR_NOTES.md` | Mentor-authored memory, saved verbatim by the main session |
| `.dove/research/watch/` | Tracking configuration, discoveries, dated impacts and field scans |
| `.dove/research/RESEARCH.md` | Short history index, not another current-state log |
| Existing `missions/`, `experiments/`, `claims/` | Preserved history, without migration, deletion or new entries |
| Sources, review returns and `lessons/` | Researcher-owned supporting material |
| Drafts, code, data, figures, papers and logs | Ordinary project artifacts, not round attachments |
| Manifest-listed integration and `.dove/install/manifest.json` | Software-managed resources and installation metadata |
| Four exact quality/preference references in `.dove/install/` | Package guidance, not evidence or Lessons |
| `.dove/install/DOCTOR.md`, existing `.dove/reviews/**`, `.dove/runs/**` and archives | Preserved feedback and user-owned history |

Research Markdown is human-readable context, not a database. Fixed fields and length limits do not call for new schemas, generated IDs, hashes, machine indexes, approval gates or migrations. Prompts own scientific meaning; [hooks](./hook-guidelines.md) deliver context only.

## Core records

### Identity card

Keep `IDENTITY.md` within 1200 characters, using these fields in this order:

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

Keep `Mainline` immediately after the round labels for the existing parser, with `Target tier` next. Ask once for a missing conference/journal target tier; do not assume one. A card entry is not user confirmation. Preserve clear user wording and provisional intent; change Mainline only when the user changes commitments or the card misstates them.

Each restriction records its quotation, date/source, original-user versus relayed provenance, and long-term versus task-specific scope. Do not promote a relay or task-specific limit into a standing restriction. Preserve correction sources and apply them to actual judgment and action. Update research state after important results. Method details, rejected families and next work belong in briefs or mentor notes, not additional card fields. The hook still shows the UTF-8-safe first 4096 bytes of an overlong card and requests shortening rather than treating it as missing.

### Round briefs and results

Each round has exactly one `NNN-brief.md` of at most 2000 characters and one `NNN-result.md` of at most 3000. Keep supporting materials in ordinary project directories and link them; do not accumulate extra files under `rounds/`.

A brief starts with `Author: mentor / user / external` (导师 / 用户 / 外部), identifies the method version, and records dated user-source paths and the last-read/since-previous-round range. Direct host user instructions are user-authored; priority is user > external > mentor. Save mentor briefs verbatim. A replacement names its actual author and reason. Scientific content belongs to [Component Guidelines](./component-guidelines.md#mentor-judgment-and-briefs).

Results use four fixed headings: `Changes and version`; `Measurements and artifacts`; `Prediction versus actual`; `Objections to this brief / factual corrections`. Include changed files, actual values or missing measurements, evaluator issues and concrete blockers. Keep the objections section even when empty; the next mentor answers it first. An engineering failure is recorded honestly, not turned into a scientific measurement or omitted from the no-science count.

### Evaluation

Begin `EVAL.md` with a short Completion reference to the script, protocol and all user metrics. Use one row per method version with these fixed columns:

```markdown
| Date | Version/round | Protocol/split | Measurements | Unseen data/train-test gap | Conclusion | Artifacts |
|---|---|---|---|---|---|---|
```

Each cell contains numbers and at most one short sentence, within 200 characters. Link detailed values, split/test-draw descriptions and outputs in ordinary artifacts. Keep process status and engineering logs out. Formal comparisons retain complete strong same-input baselines and every confirmed requirement; unknown measurements remain unknown. Predictions stay in briefs. Exploratory observations must answer their stated question without pretending to be full confirmation.

The executor repairs evaluator errors and recomputes all comparable historical method and baseline rows under the corrected protocol. Use retained raw outputs first, rerunning historical versions only where needed. Preserve superseded protocol results as linked historical evidence, not comparable current rows. A protocol repair alone is not a method-code change; changing the goal's meaning needs the user's decision. Retain method versions as ablations. After test use, changed methods require a fresh draw from data unused in development or earlier tests, with all comparisons on that common draw.

After important results, the mentor returns the current eight-dimensional assessment, including grounds and unknowns, in at most 1000 characters. The main session replaces the assessment below the table rather than appending a score log or duplicating it with a self-rating. The weakest decisive dimension informs the next brief.

### Mentor memory and paper tracking

After each judgment, the mentor returns a note of at most 1000 characters covering its judgment, predictions and outcomes, rejected families and reasons, remaining concerns and the user-source range read. The main session appends it verbatim to `MENTOR_NOTES.md`; it does not author the mentor's memory. Above 6000 characters, the mentor merges its old entries into replacement text of at most 3000 characters, retaining decisive predictions, reasons and unresolved concerns. Cross-round continuity uses these notes, never a resumed conversation.

Every mentor call checks `watch/config.json`, unjudged discoveries and the latest `watch/scan-DATE.md`, independently of rounds. Draft configuration or irrelevant results call for targeted tracking advice; the main session writes the advice into the config and sets `source: mentor`. The dashboard's Run now also prompts correction of a draft config.

Save new impact judgments separately as `watch/impact-DATE.md`, using `- ID | 撞题/新基线/可借用/无关 | reason`. Existing judgments in briefs remain readable and need not be repeated. Check important possible overlap against fuller sources before declaring coverage; missing evidence stays pending. Core-contribution overlap requires a user decision, while useful baselines and reusable work inform actual next actions. If no field scan exists or the last is more than seven days old, the mentor returns a sourced scan of at most 2000 characters for the main session to save as `watch/scan-DATE.md`. These returns are not extra round attachments.

## Supporting material

Maintain other notes only when requested or useful for evidence and continuation. A Skill invocation, compact/resume or elapsed time is not itself a writing trigger. Read relevant history and artifacts, not the whole tree; use ordinary project-relative links. Source notes distinguish citations, material inspected and support or contradiction. Preserve review returns with their actual provenance, materials and venue.

Lessons are fallible reusable advice. Check `lessons/LESSONS.md` once for a consequential active question or a correction exposing a shared mistaken premise, then only useful links. Missing Lessons do not block work or require an empty index. Preserve grounded transferable learning within write scope, with basis, conditions, counterexamples and limits; omit routine progress and one-off bugs.

Status is read-only. A simultaneous correction changes understanding and action without requiring a card edit to end the reply. For recurring corrections, inspect relevant cards only at registered roots from `dove projects status --json`; ask once before adding global guidance to `AUTHOR_PREFERENCES`, never edit it automatically. `docs/AUTHOR_PREFERENCES.md` remains the sole editable full source and is unchanged by this restructuring. DOCTOR records Dove-specific feedback, not general project errors or a generated issue lifecycle.

## Lifecycle preservation

- `init` creates integration and its manifest transactionally, adding only the RESEARCH bootstrap if the research directory is absent. It does not prepopulate cards, notes, evaluation or rounds.
- Update, reinstall, uninstall and registered-project sync manage owned integration, preserving research, mentor notes, watch records, review/run history, DOCTOR and ordinary artifacts. They do not convert old records, fill summaries or rewrite existing research.
- The four exact quality/preference references are owned files, not ownership of the `.dove/install/` directory. Uninstall removes still-owned resources.
- Normal sync removes a retired manifest-owned Stop only when its original digest matches. Automatic sync preserves modified or removed owned items with prior ownership and reports them; explicit update blocks on retired-item differences. Unowned/user hooks remain untouched.
- Legacy research stays in place without conversion or fallback readers. Unsupported installation manifests remain blocked. SessionStart is read-only; Doctor reports software/readability facts, not scientific health or host reload.

Transaction contracts belong in [Type Safety](./type-safety.md); source and projection ownership belongs in [Directory Structure](./directory-structure.md).
