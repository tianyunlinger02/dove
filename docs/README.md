# Dove documentation

<img src="../dove.png" alt="Dove pixel-art pigeon carrying a branch" width="320">

Dove is one research agent. Ordinary Claude conversation in an initialized project is its primary entrance; `claude --agent dove` and nine flat Skills are optional. Authorized work proceeds directly; a fresh read-only mentor provides independent judgment when requested or substantively needed. Ordinary and bounded tasks retain their scope.

## Guides

- [Installation](INSTALL.md) owns trusted package installation, Claude Code and DSH setup, hooks, permissions, managed-file ownership, lifecycle operations, and Doctor.
- [Usage](USAGE.md) owns the mentor/round cycle, three core research records, evaluation, nine Skills, native paper review, and local run receipts.
- [Capability matrix](CAPABILITY_MATRIX.md) summarizes capabilities and host availability, not another workflow or grading rubric.
- [Output samples](DOVE_COMMAND_OUTPUT_SAMPLES.md) shows output shapes without imposing response templates.
- [Packaging](PACKAGING.md) owns source-to-resource relationships, package inventory, and release checks.
- [Author preferences](AUTHOR_PREFERENCES.md) is the sole editable source for full cross-project preferences; installed copies are generated references, not Lessons. Generation belongs in [Packaging](PACKAGING.md#runtime-bundles).
- [Development docs](development/README.md) index the Dove vision, research model, and product requirements; current public behavior is described in Usage.

## Keep these boundaries clear

- New core records are `IDENTITY.md`, `EVAL.md`, and round briefs/results. Historical `missions/`, `experiments/`, and `claims/` remain in place without migration or deletion. Lifecycle operations preserve researcher-owned files.
- Evaluation is a user-confirmed completion standard with a generalization column, not a software test gate. Mentor quality assessments and actual measurements belong in `EVAL.md`.
- `dove-mentor` and `dove-review` are fresh native Claude contexts limited to `Read`/`Grep`/`Glob` on specified materials, not new personas or a CLI review runtime. Self-check is not independent paper review.
- The [quality and preference references](USAGE.md#short-core-and-two-reference-read-contracts) have short essentials and on-demand full companions. Fresh main contexts personally read the essentials; installation does not prove reading.
- Status, correction and blocker answers can end the current reply without completing a research round. Claude installs read-only SessionStart/UserPromptSubmit context hooks and an optional status line; [installation ownership](INSTALL.md#registered-projects-and-global-upgrades) governs retired Stop removal.
- Source, Draft, Figure, Rebuttal, and Lessons are unchanged by this structure. Requested-work completion, scientific progress, and [software verification evidence](PACKAGING.md#verification-evidence) remain separate claims.
