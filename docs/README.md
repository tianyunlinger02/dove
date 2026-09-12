# Dove documentation

Dove is one research agent with nine optional entrances and ordinary Markdown research notes. These guides explain how to install it, use it, and maintain the package without turning support machinery into research progress.

## Guides

- [Installation](INSTALL.md) explains trusted package installation, Claude Code and DSH setup, permissions, update, reinstall, uninstall, and Doctor.
- [Usage](USAGE.md) explains how to use Dove, the nine Skills, research Markdown, local run receipts, Review, and `dove-review`.
- [Capability matrix](CAPABILITY_MATRIX.md) summarizes the nine research capabilities and host availability.
- [Output samples](DOVE_COMMAND_OUTPUT_SAMPLES.md) shows output shapes without imposing response templates.
- [Packaging](PACKAGING.md) defines package inventory and release checks.
- [Development docs](development/README.md) index the stable Dove vision, research model, product requirements, and expected behavior.

## Shared principles

- Ordinary Claude conversations share research judgment through the project rule; `claude --agent dove` starts the author-side main session. Bounded independent investigations may use a Dove subagent, but full-conversation work, important user clarification, and ongoing mainline ownership stay in the main session. The nine flat Skills are optional shortcuts, not personas or stages.
- A confirmed research goal keeps moving while Dove can take another useful in-scope step. There is no Auto Skill or Auto command.
- Research context lives in ordinary `.dove/research/**` Markdown. Fresh initialization creates only `RESEARCH.md`; other notes appear when useful.
- Author-side self-check is not independent external review.
- `dove-review` is the same researcher in an isolated reviewer position: `dove review handoff` freezes listed near-submission materials for an isolated Claude Code reviewer context, `status` compares those frozen materials with current project files read-only, and `resume`/`rerun` reuse that reviewer session.
- `dove run` keeps local experiment receipts under `.dove/runs/**`; status is read-only, resume never reruns, finalize records one scalar metric, start records explicit seed plus Git commit/dirty facts, and compare only ranks compatible finalized runs by metric, budget, data, evaluator, and resource basis.
- Status only reads and reports. Compact/resume receives a small facts card, not the current research direction; startup/clear receives no research card. Missing notes and broken links are reported plainly.
- Explicit update replaces local edits to manifest-owned integration with a notice. SessionStart only inspects read-only and may suggest explicit `dove update` through `systemMessage`; it never synchronizes files or reloads active context. Neither rewrites research records.
- `UserPromptSubmit` and intake are retired without a replacement per-prompt hook. When no user status line already exists, Claude integration installs a read-only Dove `statusLine` showing native model/context/session facts and the Git branch; it never reads research notes or turns the branch or session duration into scientific state.
- Software checks and installed support files do not prove scientific correctness, completion, acceptance, or reviewer independence.
