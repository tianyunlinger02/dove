# Hook Guidelines

> Narrow helper flows and project hook boundaries for Dove 3.0.0.

## Ordinary entry

Ordinary Claude conversations use the project rule's shared research judgment. `claude --agent dove` starts the author-side main session. Bounded independent research can use a Dove subagent when separate context helps; work needing the full conversation, important user clarification, or ongoing mainline ownership stays in the main session.

The host routes tasks and enforces permissions. The rule guides judgment, not a machine router or permission grant. Nine Skills remain flat, with no Auto. `UserPromptSubmit`, hidden intake, and any replacement per-prompt hook are retired. Stop does not schedule research, manufacture another turn, or write research state.

## SessionStart synchronization

- Invoke the user-installed `dove` on `PATH`, not a copied runtime or absolute installation path.
- Validate the exact initialized project and same-package manifest revision `2.0` before planning writes.
- Skip manifest-owned local edits, preserve their ownership metadata, synchronize remaining safe resources, and report skipped paths through `systemMessage`.
- Unsafe synchronization errors stop writes and return a `systemMessage` where possible. Stage the complete change set and recheck transaction preconditions.
- Do not write `.dove/research/**`, `.dove/reviews/**`, `.dove/runs/**`, or `DOCTOR.md`; do not adopt or migrate legacy state or perform Complete Reinstall.
- Disk synchronization does not reload already-active Claude context. Skipped files are not claimed current.

Explicit `dove update` differs: it replaces local edits to valid manifest-owned integration and reports affected paths in human output and `replacedLocalEdits` JSON. Neither path overwrites unowned files or unrelated shared configuration.

## Compact/resume facts card

Only `compact` and `resume` emit a read-only facts card:

1. `RESEARCH.md` existence and absolute mtime;
2. latest Review by `updatedAt`: id, current round, absolute update time, and material currentness;
3. latest Run by `startedAt`: id, absolute start time, status, and exit code.

Missing or unreadable facts remain `unavailable`. Use absolute timestamps, not relative age or an inferred freshness judgment. Startup/clear emits no research card; it may still emit synchronization notices.

The card does not read research Markdown bodies, review reports, or stdout/stderr logs, summarize research, interpret verdicts, choose a next action, or infer the current mainline. It reads review metadata and run journals; currentness compares the latest review round's listed project files with its snapshot receipt. Latest means record time, not research importance. The main session must use visible conversation and relevant materials to decide what to continue.

## Retired integration

Dove does not install or manage `statusLine`. The retained `dove hook statusline` helper is only for user-owned composition scripts. Lifecycle refresh releases old ownership, removes an exact old Dove status line, and preserves user-modified status lines. It removes only exact retired Dove prompt/Stop hook entries while preserving unrelated user or Trellis hooks and non-array user settings. There is no replacement prompt-hook runtime.

## Research helpers

- Resolve the real project boundary and read only relevant research notes and artifacts. Do not recursively scan the research tree.
- Status remains read-only; missing notes and broken links are ordinary document facts, not repair triggers.
- Create requested artifacts when the work needs them. Maintain additional research Markdown only when requested, when a material judgment changes, or when evidence and continuation context are genuinely useful.
- Prefer an existing relevant topic note; add ordinary links when they improve recovery. No required headings, frontmatter, generated IDs, hashes, indexes, or stored counts.
- Lessons use reusable value rather than routine activity as the maintenance trigger. Reuse active-context advice instead of mechanically rereading it.
- Plan a newly executed central experiment before execution and append actual results to the same document when recording is needed. Design-only work stops before execution; retrospective work stays retrospective.
- Source permits requested bounded bibliography DOI identity checks, not automatic bibliography scans or a ledger. Identity verification is separate from full-text inspection and claim support.

## Review helpers

Review supports author-side self-check, delivery checks, isolated handoff, faithful import, and read-only inspection. Isolated review uses the same researcher in a reviewer position: reconstruct and challenge the contribution, do not inherit the author's mainline or execute author revisions.

The runtime provides only listed frozen file copies and Read. The author supplies any necessary venue/literature grounding; missing grounding limits the judgment. Whole-paper review asks whether the method answers the question, field judgment is correct, contribution and evidence fit the venue, and what strongest reasonable objection needs answering. Return `Verdict`, `Blocking issues`, `Grounding basis`, and `Author-side next actions` as Markdown headings, not parsed acceptance state. Resume/rerun reuses the reviewer's own session history without granting access to author-side Review files or unlisted materials.

Preserve actual returns and imported provenance. Import does not automatically begin search, response, or revision. Findings inform author judgment; they are not orders to narrow claims. A hook, session label, or software check does not certify independence or scientific acceptance.

## Feedback and file safety

`DOCTOR.md` is optional natural-language feedback about explicit user comments on Dove or actual Dove failures. It is not an issue database or a place for general project problems. Doctor itself is read-only.

Use contained paths, ordinary-file and symlink checks, same-directory temporary writes, expected-state rechecks, and transactional rollback. Reinstall/uninstall previews the real scope and defaults to No. Preserve research, review, run, and ordinary project files. Keep this file byte-identical to its frontend template mirror.
