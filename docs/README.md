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

- Users talk to one Dove. The nine flat Skills are optional shortcuts, not personas or stages.
- A confirmed research goal keeps moving while Dove can take another useful in-scope step. There is no Auto Skill or Auto command.
- Research context lives in ordinary `.dove/research/**` Markdown. Fresh initialization creates only `RESEARCH.md`; other notes appear when useful.
- Author-side self-check is not independent external review.
- `dove-review` is separate: `dove review handoff` freezes listed near-submission materials for an isolated Claude Code reviewer context, and `resume`/`rerun` reuse that reviewer session.
- `dove run` keeps local experiment receipts under `.dove/runs/**`; status is read-only, resume never reruns, finalize records one scalar metric, and compare only ranks compatible finalized runs.
- Status only reads and reports. Missing notes and broken links are reported plainly.
- Software checks and installed support files do not prove scientific correctness, completion, acceptance, or reviewer independence.
