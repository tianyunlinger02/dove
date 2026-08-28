# Dove documentation

These guides describe Dove 3.0.0 as a local-first research agent with ordinary Markdown research context, ten flat capability Skills, generated host adapters, a lifecycle CLI, Claude SessionStart and prompt hooks, a hidden Claude paper-search support Skill, and three runtime bundles. It has no Dove research-state MCP server or Research Format database; Claude projects may use one pinned external paper-acquisition MCP.

## Guides

- [Installation](INSTALL.md) explains trusted package installation, Claude project initialization, `.dove/install/`, lifecycle safety, Doctor, export, and Complete Reinstall.
- [Usage](USAGE.md) explains the Dove agent, ten Skills, ordinary Markdown research documents, experiments, Reviews, Status, and explicit foreground Auto work on the user-confirmed Workspace mainline.
- [Packaging](PACKAGING.md) defines the release inventory, generated adapters, three bundles, and release checks.
- [Capability matrix](CAPABILITY_MATRIX.md) summarizes implemented behavior and explicit limits.
- [Output samples](DOVE_COMMAND_OUTPUT_SAMPLES.md) shows natural user-facing and CLI examples without imposing response templates.
- [Dove 开发纲领](development/README.md) 记录稳定的开发理论、产品需求、研究模型和最终期望；实时开发研究仍保留在 `.dove/research/`。

## Documentation principles

- Dove is one complete research agent. Its flat Skills are capability entrances, not separate personas.
- The host performs real retrieval, analysis, coding, experiments, writing, figure work, and validation with available and approved host tools.
- Dove starts from the research mainline and decision that matters, uses hunches as hypotheses, treats user preferences as tradeoff signals, and acts from evidence and task risk without rushing into aggressive execution or over-defending.
- Dove brings research drive: it turns gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves that advance the mainline, while keeping exploration aimed rather than diffuse.
- Experiments, validation, engineering, writing, review, documents, rigor, novelty, and preferences are layered means rather than equal goals; lower-level artifacts must not simulate higher-level research progress.
- Research context is ordinary Markdown under `.dove/research/`, not a runtime database.
- `dove init` creates only the minimal researcher-owned `.dove/research/RESEARCH.md` entry. Mission, Experiment, Source, Review, Claim, and Lesson materials are optional researcher-owned Markdown created naturally when useful.
- Human-named linked topic documents are preferred over machine records. Do not require fixed headings, frontmatter, IDs, enums, hashes, indexes, or counts.
- When newly executed central experiment work needs recording, keep prospective planning and actual results in the same Experiment document.
- Keep Direct Scientific Review self-checks, independent Reviewer handoff purpose, frozen material scope, prompt, clarifications, rebuttals, and the actual reviewer return in the corresponding Review document. Direct self-check is author-side and not independent; substantive response and revision remain author-side Dove work.
- `status` is read-only. Missing overviews and broken links are reported naturally rather than classified as invalid research state.
- `auto` is explicit-only foreground multi-round work: it reads and preserves the user-confirmed Workspace mainline from research context, conversation, and project artifacts, keeps acting while feasible in-scope work can advance or protect it, and asks only when a material direction or real boundary would change the work.
- `.dove/install/` contains software metadata at manifest revision `2.0` and may contain ordinary `DOCTOR.md` feedback about Dove itself. There is no Doctor JSON state or issue lifecycle. Installation safety hashes are internal and are not research evidence.
- `update` refreshes package-managed integration and preserves existing `.dove/research/**`; it does not create missing summaries, complete navigation, or replace Lessons materials.
- `export-research` is the explicit one-time legacy JSON research records-to-Markdown path and may add its output to an existing tree when authorized; Complete Reinstall rebuilds package-managed integration while preserving `.dove/research/**` and `DOCTOR.md`.
- Generated adapters are canonical projections, not proof of host registration or readiness. Claude Code remains the supported project initialization path.
- Tests and release checks establish software behavior only, not scientific correctness, completion, independent review, or Dove research quality.
