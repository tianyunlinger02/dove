# Dove documentation

These guides describe the Dove 3.0.0 Markdown document architecture. Dove provides ten flat Skills, three roles, generated host adapters, a lifecycle CLI, a prompt hook, and three runtime bundles. It has no research MCP server or Research Format database.

## Guides

- [Installation](INSTALL.md) explains trusted package installation, Claude project initialization, `.dove/install/`, lifecycle safety, Doctor, export, and Complete Reinstall.
- [Usage](USAGE.md) explains the ten Skills, ordinary Markdown research documents, experiments, Reviews, Status, and Auto.
- [Packaging](PACKAGING.md) defines the release inventory, generated adapters, three bundles, and release checks.
- [Capability matrix](CAPABILITY_MATRIX.md) summarizes implemented behavior and explicit limits.
- [Output samples](DOVE_COMMAND_OUTPUT_SAMPLES.md) shows natural user-facing and CLI examples without imposing response templates.

## Documentation principles

- The host performs real retrieval, analysis, coding, experiments, writing, figure work, and validation with normal host tools.
- Research context is ordinary Markdown under `.dove/research/`, not a runtime database.
- `RESEARCH.md` is recommended overview and navigation; its absence is normal. `LESSONS.md` is optional.
- Human-named linked topic documents are preferred over machine records. Do not require fixed headings, frontmatter, IDs, enums, hashes, indexes, or counts.
- Keep prospective experiment planning and actual results in the same Experiment document.
- Keep review purpose, exact path scope, prompt, actual user-obtained reviewer return, and author handling in the same Review document.
- Treat Missions and Sources as natural documents. Use careful prose or documents for Claims only when useful; do not create a Claim store.
- Reviewer work is user-managed, read-only, limited to exact declared paths, and returned as Markdown. A native role does not prove independence.
- `status` is read-only. Missing overviews and broken links are reported naturally rather than classified as invalid research state.
- `auto` is explicit-only and treats the documented current mainline as a read-only boundary.
- `.dove/install/` contains software metadata at manifest revision `2.0` and Doctor machine state plus readable `DOCTOR.md`. Installation safety hashes are internal and are not research evidence.
- `sync` and `upgrade` do not change research documents. `export-research` is the explicit one-time legacy JSON research records-to-Markdown path; Complete Reinstall is the confirmed destructive reset.
- Generated adapters are canonical projections, not proof of host registration or readiness. Claude Code remains the supported project initialization path.
- Tests and release checks establish software behavior only, not scientific correctness, completion, or independent review.
