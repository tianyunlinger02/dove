# State Management

## Ownership

Dove is file-first. Research context and ordinary artifacts belong to the researcher; installation owns only its declared software resources.

| Material | Owner and meaning |
|---|---|
| `.dove/research/IDENTITY.md` | Short current goal, user constraints/corrections and round pointer |
| `.dove/research/EVAL.md` | Confirmed evaluation definition, per-round measurements and mentor quality assessments |
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

Keep the identity card to a few hundred plain-language words. Its first fields are `Current round: rounds/NNN-brief.md` and `Round status: ongoing|paused|completed` (`进行中` is also understood); then retain stable `Mainline`, inputs/outputs/completion, restrictions, rejected approaches and Recent corrections. Method detail and next work point to the brief rather than duplicating route, next-action or Quality fields. An overlong card remains an existing card: the hook presents a UTF-8-safe first 4096 bytes and asks for concision, not recreation.

A mentor brief is saved verbatim as `rounds/NNN-brief.md`; a user or external task uses the same location. Every brief starts with `Author: mentor / user / external` (导师 / 用户 / 外部). The result names actual changed files, EVAL values and prediction versus actual in a few lines. This distinguishes authorship without a separate test project or mission ledger. Existing Mission, Experiment and Claim histories remain untouched; new work goes into rounds instead.

The first mentor proposes the evaluation script, dev/test split and columns, including generalization to unseen styles/categories or its task equivalent. Reuse existing evaluation. The user confirms the completion standard once; write its script, split and metrics in the identity card's Completion field. Changes need confirmation too. Each round appends time, round and measured values to EVAL; only the mentor supplies important-result eight-dimensional paper-quality assessments. The main session faithfully saves that assessment, not another self-rating. Round and evaluation semantics belong in [Component Guidelines](./component-guidelines.md#mainline-and-rounds).

Update only affected identity-card content when the user confirms or corrects something, including during Status or assessment, unless writing is expressly forbidden. Preserve unchanged Mainline wording. When recording a recurring correction, use `dove projects status --json` for registered roots and read only relevant Recent corrections in their cards. If it recurs across projects, ask in one sentence whether the user wants it in AUTHOR_PREFERENCES. Do not scan unregistered projects or automatically edit global preferences. An explicit stop/discussion-only request marks the round paused.

## Supporting material

Create/edit ordinary requested artifacts when needed. Beyond the core round records, preserve notes only when explicitly requested or useful for evidence and continuation; a Skill invocation alone is not a maintenance trigger. Read relevant history and actual artifacts, not the whole tree. Use ordinary links and project-relative paths; update RESEARCH only when its short history navigation changes.

Source notes retain citations, what was inspected and what it supports or challenges. Actual reviewer returns remain faithful, with known materials and venue; distinguish user-pasted opinions from independent work. New useful source material or reviewer returns may remain ordinary project files or supporting notes, but do not recreate a parallel core ledger or review-runtime store. Existing topic histories may still be read; their existence does not require extending them.

Lessons are optional, fallible reusable guidance. Before a consequential choice, or after a correction/recurring failure exposes a shared mistaken premise, check `lessons/LESSONS.md` once for the active question and only useful links; deterministic local work has no prerequisite. Missing Lessons do not block work or require an empty index. Preserve a grounded insight within author write scope when it could improve future choices or prevent recurrence, including its basis, conditions, counterexamples and limits. Omit routine progress, transient status, one-off failures and non-transferable bugs. A Lesson is not evidence, a fix or a completion certificate. Compact/resume and elapsed time do not themselves trigger writing.

DOCTOR records explicit Dove feedback or actual integration, routing, Skill, guidance or document failures. It is not a general project error log, issue lifecycle or generated JSON store. Default preferences remain in the unchanged sole editable `docs/AUTHOR_PREFERENCES.md`, projected into package-managed references; do not copy them into Lessons. Read triggers belong in Component Guidelines.

## Lifecycle preservation

- `init` creates integration and its manifest transactionally. It adds only the minimal researcher-owned RESEARCH bootstrap if the research directory is absent; report whether it was written. Do not bootstrap an empty evaluation or round tree before actual research.
- Update, reinstall, uninstall and registered-project sync preserve all existing research, review/run history, DOCTOR and ordinary artifacts. They manage only owned integration; they do not convert missions into rounds, move experiments/claims, fill missing summaries or overwrite identity/evaluation/round files.
- The four exact essentials/full references are owned files, not ownership of `.dove/install/` as a directory. Explicit update/reinstall manages them; uninstall removes still-owned resources. They are not evidence or user Lessons.
- Legacy research remains in place without automatic conversion, normalization or fallback readers. Unsupported installation manifests remain blocked.
- SessionStart is read-only and does not update, migrate, clean up or reload a live session. Doctor diagnoses software/readability, not scientific health; missing optional summaries are not corruption.

Replacement and transaction contracts belong in [Type Safety](./type-safety.md); generation ownership belongs in [Directory Structure](./directory-structure.md).
