# Dove documentation

These guides describe Dove 3.0.0 as one local-first research agent with ordinary Markdown research context, default autonomous multi-round progression for confirmed goals, nine optional specialist Skills, generated host adapters, a lifecycle CLI, Claude SessionStart and prompt hooks, hidden Claude paper-search and web-reader support Skills, and three runtime bundles. It has no Auto Skill or Dove research-state MCP server; Claude projects may use one pinned external paper-acquisition MCP plus the hosted Exa MCP for ordinary webpage bodies and known URLs.

## Guides

- [Installation](INSTALL.md) explains trusted package installation, Claude Code and DSH project initialization, `.dove/install/`, lifecycle safety, Doctor, export, and Complete Reinstall.
- [Usage](USAGE.md) explains the Dove agent, default multi-round progression, nine optional Skills, ordinary Markdown research documents, experiments, Reviews, Status, and `dove-review`.
- [Packaging](PACKAGING.md) defines the release inventory, generated adapters, three bundles, and release checks.
- [Capability matrix](CAPABILITY_MATRIX.md) summarizes implemented behavior and explicit limits.
- [Output samples](DOVE_COMMAND_OUTPUT_SAMPLES.md) shows natural user-facing and CLI examples without imposing response templates.
- [Dove 开发纲领](development/README.md) 记录稳定的开发理论、产品需求、研究模型和最终期望；实时开发研究仍保留在 `.dove/research/`。

## Documentation principles

- Dove is one complete research agent. Users tell Dove the goal directly; its nine flat Skills are optional specialist shortcuts, not separate personas or stages.
- The host performs real retrieval, analysis, coding, experiments, writing, figure work, and validation with available and approved host tools. In Claude projects, `WebSearch` remains available for discovery, built-in `WebFetch` is project-denied, `dove-paper-search` handles scholarly papers, and Exa handles ordinary webpage bodies and known URLs without CLI/shell/fetch fallback.
- Autonomous multi-round research progression is Dove's default behavior for a confirmed goal: Dove anchors on the user-confirmed Workspace mainline, identifies the highest-level active limit, keeps candidate explanations explicit, chooses a discriminating action, absorbs the result, and continues while useful in-scope action remains.
- Dove brings research drive: it turns gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves that advance the mainline, while keeping exploration aimed rather than diffuse.
- Contribution, mechanism, novelty, and positioning sit above method, evidence, experiment analysis, baselines, and failure analysis; those sit above argument, writing, and figures; delivery remains last.
- Lower-level artifacts, including completed bounded tasks, must not simulate higher-level research progress.
- Research context is ordinary Markdown under `.dove/research/`, not a runtime database.
- `dove init` creates only the minimal researcher-owned `.dove/research/RESEARCH.md` entry. Mission, Experiment, Source, Review, Claim, and Lesson materials are optional researcher-owned Markdown created naturally when useful.
- Human-named linked topic documents are preferred over machine records. Do not require fixed headings, frontmatter, IDs, enums, hashes, indexes, or counts.
- When newly executed central experiment work needs recording, keep prospective planning and actual results in the same Experiment document.
- Keep author-side scientific self-checks, `dove-review` handoff purpose, target venue, exact frozen material scope, self-contained prompt, known host limits, real exposed resume provenance, clarifications, rebuttals, and the actual reviewer return in the corresponding ordinary Review document. Unverifiable pasted returns remain explicitly unverified; direct self-check is author-side and not independent.
- `dove-review` is a genuinely isolated persistent and recoverable external-review context for a near-submission paper only when the host can restrict material visibility. Each round sees only the explicit frozen submission-shaped materials for that round; old Reviews, historical returns, author private transcript, and unlisted materials are not visible by default. Reviewer findings are evidence to analyze rather than direct rewrite or claim-narrowing triggers.
- `status` is read-only. Missing overviews and broken links are reported naturally rather than classified as invalid research state.
- There is no Auto Skill or command. A confirmed goal-shaped request invokes Dove's default foreground multi-round progression; Dove asks only when a material direction, scope, or real boundary would change the work.
- `.dove/install/` contains software metadata at manifest revision `2.0` and may contain ordinary `DOCTOR.md` feedback about Dove itself. There is no Doctor JSON state or issue lifecycle. Installation safety hashes are internal and are not research evidence.
- `update` refreshes package-managed integration and preserves existing `.dove/research/**`; it does not create missing summaries, complete navigation, or replace Lessons materials.
- `export-research` is the explicit one-time legacy JSON research records-to-Markdown path and may add its output to an existing tree when authorized; Complete Reinstall rebuilds package-managed integration while preserving `.dove/research/**` and `DOCTOR.md`.
- Generated adapters are canonical projections, not proof of host registration, readiness, or `dove-review` independence. Claude Code and DeepSeek Harness are the supported project initialization paths; DSH receives filesystem Skills only.
- Tests and release checks establish software behavior only, not scientific correctness, completion, independent review, or Dove research quality.
