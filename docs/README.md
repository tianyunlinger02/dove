# Dove documentation

These guides describe Dove 3.0.0 as a local-first research agent with ordinary Markdown research context, ten flat capability Skills, generated host adapters, a lifecycle CLI, Claude prompt and stop hooks, a hidden Claude paper-search support Skill, and three runtime bundles. It has no Dove research-state MCP server or Research Format database; Claude projects may use one pinned external paper-acquisition MCP.

## Guides

- [Installation](INSTALL.md) explains trusted package installation, Claude project initialization, `.dove/install/`, lifecycle safety, Doctor, export, and Complete Reinstall.
- [Usage](USAGE.md) explains the Dove agent, ten Skills, ordinary Markdown research documents, experiments, Reviews, Status, and Auto.
- [Packaging](PACKAGING.md) defines the release inventory, generated adapters, three bundles, and release checks.
- [Capability matrix](CAPABILITY_MATRIX.md) summarizes implemented behavior and explicit limits.
- [Output samples](DOVE_COMMAND_OUTPUT_SAMPLES.md) shows natural user-facing and CLI examples without imposing response templates.

## Documentation principles

- Dove is one complete research agent. Its flat Skills are capability entrances, not separate personas.
- The host performs real retrieval, analysis, coding, experiments, writing, figure work, and validation with normal host tools.
- Dove starts from the research mainline and decision that matters, uses hunches as hypotheses, treats user preferences as tradeoff signals, and acts from evidence and task risk without rushing into aggressive execution or over-defending.
- Dove brings research drive: it turns gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves that advance the mainline, while keeping exploration aimed rather than diffuse.
- Experiments, validation, engineering, writing, review, documents, rigor, novelty, and preferences are layered means rather than equal goals; lower-level artifacts must not simulate higher-level research progress.
- Research context is ordinary Markdown under `.dove/research/`, not a runtime database.
- `dove init` creates the default research document tree: root `RESEARCH.md`, six directory summaries, and six built-in Lessons themes under `lessons/`. The overview and summaries are researcher-owned; the built-in themes are package-managed and carry a notice directing project-specific guidance to separately named Lessons linked from `lessons/LESSONS.md`.
- Human-named linked topic documents are preferred over machine records. Do not require fixed headings, frontmatter, IDs, enums, hashes, indexes, or counts.
- When newly executed central experiment work needs recording, keep prospective planning and actual results in the same Experiment document.
- Keep review purpose, exact path scope, prompt, and the actual user-obtained reviewer return in the corresponding Review document. Add author handling only when requested; substantive response and revision remain author-side Dove work.
- `status` is read-only. Missing overviews and broken links are reported naturally rather than classified as invalid research state.
- `auto` is explicit-only and treats the documented current mainline as a read-only boundary.
- `.dove/install/` contains software metadata at manifest revision `2.0` and may contain ordinary `DOCTOR.md` feedback about Dove itself. There is no Doctor JSON state or issue lifecycle. Installation safety hashes are internal and are not research evidence.
- `update` creates missing summaries, completes current standard navigation only in `RESEARCH.md` and `lessons/LESSONS.md`, and replaces each of the six package-managed built-in Lessons themes with current package content. Other research documents, including exported `imported-lessons.md`, remain researcher-owned.
- `export-research` is the explicit one-time legacy JSON research records-to-Markdown path and may add its output to an existing default tree; Complete Reinstall is the confirmed destructive reset that rebuilds the current default tree.
- Generated adapters are canonical projections, not proof of host registration or readiness. Claude Code remains the supported project initialization path.
- Tests and release checks establish software behavior only, not scientific correctness, completion, independent review, or Dove research quality.
