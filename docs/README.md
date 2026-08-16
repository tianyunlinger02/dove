# Dove documentation

These guides describe the Dove 3.0.0 Markdown document architecture. Dove provides ten flat Skills, three roles, generated host adapters, a lifecycle CLI, Claude prompt and stop hooks, a hidden Claude paper-search support Skill, and three runtime bundles. It has no Dove research-state MCP server or Research Format database; Claude projects may use one pinned external paper-acquisition MCP.

## Guides

- [Installation](INSTALL.md) explains trusted package installation, Claude project initialization, `.dove/install/`, lifecycle safety, Doctor, export, and Complete Reinstall.
- [Usage](USAGE.md) explains the ten Skills, ordinary Markdown research documents, experiments, Reviews, Status, and Auto.
- [Packaging](PACKAGING.md) defines the release inventory, generated adapters, three bundles, and release checks.
- [Capability matrix](CAPABILITY_MATRIX.md) summarizes implemented behavior and explicit limits.
- [Output samples](DOVE_COMMAND_OUTPUT_SAMPLES.md) shows natural user-facing and CLI examples without imposing response templates.

## Documentation principles

- The host performs real retrieval, analysis, coding, experiments, writing, figure work, and validation with normal host tools.
- Research context is ordinary Markdown under `.dove/research/`, not a runtime database.
- `dove init` creates the default research document tree: root `RESEARCH.md`, six directory summaries, and six general Lessons themes under `lessons/`. These are ordinary researcher-maintained Markdown, not generated indexes or evidence.
- Human-named linked topic documents are preferred over machine records. Do not require fixed headings, frontmatter, IDs, enums, hashes, indexes, or counts.
- Keep prospective experiment planning and actual results in the same Experiment document.
- Keep review purpose, exact path scope, prompt, and the actual user-obtained reviewer return in the corresponding Review document. Add author handling only when requested; substantive response and revision remain Rebuttal work.
- Treat Missions and Sources as natural documents. Use careful prose or documents for Claims only when useful; do not create a Claim store.
- Reviewer work is user-managed, read-only, limited to exact declared paths, and returned as Markdown. A native role does not prove independence.
- `status` is read-only. Missing overviews and broken links are reported naturally rather than classified as invalid research state.
- `auto` is explicit-only and treats the documented current mainline as a read-only boundary.
- `.dove/install/` contains software metadata at manifest revision `2.0` and may contain ordinary `DOCTOR.md` feedback about Dove itself. There is no Doctor JSON state or issue lifecycle. Installation safety hashes are internal and are not research evidence.
- `update` creates every missing default document from its complete package content. For an existing default document it exactly appends missing canonical paragraphs or navigation lines while preserving existing bytes and ordinary topic documents. Exact matching is intentionally not semantic deduplication.
- `export-research` is the explicit one-time legacy JSON research records-to-Markdown path and may add its output to an existing default tree; Complete Reinstall is the confirmed destructive reset that rebuilds the current default tree.
- Generated adapters are canonical projections, not proof of host registration or readiness. Claude Code remains the supported project initialization path.
- Tests and release checks establish software behavior only, not scientific correctness, completion, or independent review.
