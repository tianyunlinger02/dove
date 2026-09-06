# State Management

## Ownership

Dove is file-first, not a research database. Substantive host work and researcher-owned context remain separate from software integration.

| Material | Owner and meaning |
|---|---|
| `.dove/research/**` | Researcher-owned overview, optional summaries and naturally named topic documents |
| Ordinary drafts, code, data, figures, papers, logs, rebuttals | Project artifacts, not Dove stores |
| Manifest-listed integration and `.dove/install/manifest.json` | Software-managed installation resources and metadata |
| `.dove/install/DOCTOR.md` | Optional host-maintained natural-language feedback about Dove itself |
| `.dove/reviews/**` | Durable explicit isolated-review exchange records, not authored Review Markdown or installed resources |
| `.dove/runs/**` | Durable local command journals/logs, not Experiment documents or scientific conclusions |
| Legacy research and archives | User-owned material preserved in place |

Research Markdown has no schema/version, fixed headings, frontmatter, generated IDs, enums, machine indexes, counts, or research hashes. Organize it through ordinary host rename, move, relink, and consolidation operations, not a migration framework or runtime fallback. There is no research-state MCP service, Research Format runtime, or Claim store.

## Maintenance triggers

- Create or revise requested artifacts when the task needs them. Maintain additional Dove research Markdown only when explicitly asked to record/update/save, when results materially change the mainline, conclusion, decision, or priority, or when evidence and continuation context are genuinely useful. Invocation alone does not justify a document.
- Read relevant notes and artifacts, not the entire research tree. Prefer an existing topic document over duplicates; use readable names and ordinary links.
- Keep `RESEARCH.md` a concise overview of the confirmed mainline, material conclusions/limits, linked work, and priorities, not a run log. Optional directory summaries and a missing overview are normal. Report broken links with their affected context, without invalidating the research area.
- Missions can preserve bounded work and branches; Sources preserve citations and what was actually inspected; Claims remain scoped prose, tables, or useful documents. Experiment recording order and Review return/author-handling boundaries are owned by [Component Guidelines](./component-guidelines.md).
- Lessons are optional fallible advisory prose, maintained for reusable value rather than routine activity. Reuse advice already in context; it is not evidence or a completion certificate.
- `DOCTOR.md` records explicit user feedback about Dove or actual Dove integration, routing, Skill, document, or guidance failures. It is not CLI-owned, a generated JSON projection, an issue lifecycle, or a general project/tool failure log; no fixed template, IDs, statuses, severity, or counters.

Read-only requests and Status do not authorize maintenance.

## Lifecycle preservation

- `init` creates integration and its manifest transactionally. It adds only the minimal researcher-owned `RESEARCH.md` bootstrap when the research directory is absent. Existing research trees remain untouched even without an overview; output must report whether a bootstrap was actually written.
- `update`, product SessionStart sync, `reinstall`, and `uninstall` preserve existing `.dove/research/**`, `.dove/reviews/**`, `.dove/runs/**`, `.dove/install/DOCTOR.md`, and ordinary project files. They do not create missing summaries, complete navigation, replace Lessons, or delete retired researcher-visible material. Reinstall rebuilds only package-managed integration.
- Legacy research data is detected read-only and left in place: no automatic conversion, deletion, normalization, or fallback reader. This is distinct from supported installation-manifest migration.
- `doctor` is a read-only software/readability diagnostic, not research repair or a scientific health score. Missing optional summaries are not corruption.

Host fragment retirement and SessionStart behavior belong in [Hook Guidelines](./hook-guidelines.md). Replacement conflicts, confirmation, containment, and transactions belong in [Type Safety](./type-safety.md).
