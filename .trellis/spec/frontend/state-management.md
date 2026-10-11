# State Management

## Ownership

Dove is file-first. Research context and ordinary artifacts belong to the researcher; installation owns only its declared software resources.

| Material | Owner and meaning |
|---|---|
| `.dove/research/IDENTITY.md` | Short current goal, user constraints/corrections and round pointer |
| `.dove/research/EVAL.md` | Evaluation derived from confirmed requirements, version measurements and mentor quality assessments |
| `.dove/research/rounds/` | Mentor/user/external briefs and actual round results |
| `.dove/research/RESEARCH.md` | Short history index, not a second current-state log |
| Existing `missions/`, `experiments/`, `claims/` | Historical research kept in place; no migration, deletion or new entries |
| Sources, review returns and `lessons/` | Researcher-owned supporting material; retain useful existing documents |
| Drafts, code, data, figures, papers, logs, rebuttals | Ordinary project artifacts, not Dove stores |
| Manifest-listed integration and `.dove/install/manifest.json` | Software-managed installation resources and metadata |
| Four `.dove/install/` quality/preference references | Package-managed essentials/full detail, not evidence or Lessons |
| `.dove/install/DOCTOR.md` | Optional natural-language feedback about Dove itself |
| Existing `.dove/reviews/**`, `.dove/runs/**`, archives | Durable user-owned history/receipts, preserved by lifecycle operations |

Research Markdown is human-readable context, not a database. The few fields and round filenames needed for continuation do not justify schema validation, generated IDs, hashes, machine indexes, approval gates or a migration framework. Prompts own scientific meaning; hooks only provide their declared context/reminder behavior (see [Hook Guidelines](./hook-guidelines.md)).

## Core records

Keep the identity card to a few hundred plain-language words. Its first fields are `Current round: rounds/NNN-brief.md` and `Round status: ongoing|paused|completed` (`进行中` is also understood); then retain stable `Mainline`, deployment inputs/outputs/completion, sourced user restrictions and Recent corrections. User restrictions/corrections contain only original user quotations, dates and source references, never executor paraphrases or self-imposed prohibitions. Method details, rejected methods and next work point to the brief rather than becoming card prohibitions or duplicate route, next-action or Quality fields. An overlong card remains an existing card: the hook presents a UTF-8-safe first 4096 bytes and asks for concision, not recreation.

A mentor brief is saved verbatim as `rounds/NNN-brief.md`; a user or external task uses the same location. Every brief starts with `Author: mentor / user / external` (导师 / 用户 / 外部). Record the original-user source path, dates and last-read/since-previous-round range in the brief, not a new transcript/continuation ledger. Preserve direct host user instructions as user-authored material, with user > external > mentor priority. Brief contents and method-version rules are in [Component Guidelines](./component-guidelines.md#mentor-judgment-and-briefs). A mid-round replacement identifies its actual author and reason.

The result names actual changed files, method version, EVAL values, prediction versus actual, evaluator problems and a fixed `Objections to this brief / factual corrections` section, even when there are none. Report a blocked step with one or two examples when thresholds are missed. The next mentor first responds to that section. Existing Mission, Experiment and Claim histories remain untouched; new work goes into rounds instead.

After the one user-confirmed kickoff reconstruction, the mentor defines EVAL from the confirmed requirements; do not request a second protocol approval. Reuse valid existing evaluation and keep a short Completion reference in the card. The first measured row is the complete result of a strong same-input baseline. Columns cover every user-mentioned metric, unseen data, train-test gap and the paper-selling advantage (for example, cases where the baseline fails and the method succeeds). Use task-general metrics rather than sample/domain exceptions. Unmeasured requirements are unknown, not satisfied. Record the script, dev/test split, test draw, protocol, time, round and method version with measured values; predictions remain in briefs.

The executor reports evaluator problems in the result rather than changing the protocol independently. The mentor can correct evaluation without asking the user unless the correction changes the goal's meaning, and directs the executor to recompute every historical method/baseline row under the new protocol in the same columns, using retained raw outputs first and rerunning historical versions only where outputs are missing. A protocol correction alone is not a method-code version change. Retain old method versions as ablations and identify previous protocol/split results as historical, not comparable current rows. A method changed after any test use requires a fresh test draw from data never used in development or prior tests, not a reshuffle of old test data, with all comparison rows evaluated on that common draw. Only the mentor supplies important-result eight-dimensional paper-quality assessments; the main session faithfully saves them, not another self-rating.

Apply user corrections to current judgment and action. Record affected card content only when it has lasting value and writing is allowed, preserving original words, dates, sources and unchanged Mainline wording. Status is read-only; ending a reply does not complete or pause a round. When preserving a recurring correction, use registered roots from `dove projects status --json` and relevant Recent corrections only; ask once about adding cross-project guidance to AUTHOR_PREFERENCES, never edit it automatically.

## Supporting material

Create/edit ordinary requested artifacts when needed. Beyond the core round records, preserve notes only when explicitly requested or useful for evidence and continuation; a Skill invocation alone is not a maintenance trigger. Read relevant history and actual artifacts, not the whole tree. Use ordinary links and project-relative paths; update RESEARCH only when its short history navigation changes.

Source notes retain citations, what was inspected and what it supports or challenges. Actual reviewer returns remain faithful, with known materials and venue; distinguish user-pasted opinions from independent work. New useful source material or reviewer returns may remain ordinary project files or supporting notes, but do not recreate a parallel core ledger or review-runtime store. Existing topic histories may still be read; their existence does not require extending them.

Lessons are optional, fallible reusable guidance. Before a consequential choice, or after a correction/recurring failure exposes a shared mistaken premise, check `lessons/LESSONS.md` once for the active question and only useful links; deterministic local work has no prerequisite. Missing Lessons do not block work or require an empty index. Preserve a grounded insight within author write scope when it could improve future choices or prevent recurrence, including its basis, conditions, counterexamples and limits. Omit routine progress, transient status, one-off failures and non-transferable bugs. A Lesson is not evidence, a fix or a completion certificate. Compact/resume and elapsed time do not themselves trigger writing.

DOCTOR records explicit Dove feedback or actual integration, routing, Skill, guidance or document failures. It is not a general project error log, issue lifecycle or generated JSON store. Default preferences remain in the unchanged sole editable `docs/AUTHOR_PREFERENCES.md`, projected into package-managed references; do not copy them into Lessons. Read triggers belong in Component Guidelines.

## Lifecycle preservation

- `init` creates integration and its manifest transactionally. It adds only the minimal researcher-owned RESEARCH bootstrap if the research directory is absent; report whether it was written. Do not bootstrap an empty evaluation or round tree before actual research.
- Update, reinstall, uninstall and registered-project sync preserve all existing research, review/run history, DOCTOR and ordinary artifacts. They manage only owned integration; they do not convert missions into rounds, move experiments/claims, fill missing summaries or overwrite identity/evaluation/round files.
- The four exact essentials/full references are owned files, not ownership of `.dove/install/` as a directory. Explicit update/reinstall manages them; uninstall removes still-owned resources. They are not evidence or user Lessons.
- Normal sync removes an old manifest-owned Stop only when its original digest matches. Automatic sync preserves locally modified or removed Stop items and their prior ownership, reporting them; explicit update blocks on those differences. Unowned/user hooks remain untouched. Exact retired-selector recognition serves installation cleanup only.
- Legacy research remains in place without automatic conversion, normalization or fallback readers. Unsupported installation manifests remain blocked.
- SessionStart is read-only and does not update, migrate, clean up or reload a live session. Doctor diagnoses software/readability, not scientific health; missing optional summaries are not corruption.

Replacement and transaction contracts belong in [Type Safety](./type-safety.md); generation ownership belongs in [Directory Structure](./directory-structure.md).
