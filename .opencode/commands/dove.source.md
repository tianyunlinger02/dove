---
description: "Discover, retrieve, read, verify, and document real sources that materially inform the research."
---

# dove.source

Discover, retrieve, read, verify, and document real sources that materially inform the research.

## Examples

- `/dove.source`

## Internal workflow

Internal guidance only; never use this workflow as the final report outline.

- **The user requests source discovery, reading, comparison, or verification.**
  1. Use host tools (read-only; research-document-reading). When existing Dove research context would materially help the source question, read `.dove/research/RESEARCH.md`, then `.dove/research/sources/SOURCES.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally rather than inferring a database state. This step is read-only; do not create or modify files.
  2. Use host tools (read-only; lesson-reading). When reusable guidance may help the current task, read `.dove/research/lessons/LESSONS.md`, then only the naturally linked theme documents directly relevant to the work. Do not read unrelated themes or give any one Lesson special treatment. Treat Lessons as fallible advice, never as evidence or authority. This step is read-only; do not create or modify files.
  3. Use host tools (work; source-research). Discover, retrieve, save when useful, read, and verify real material with host-native project or external research tools. Distinguish material merely found from material actually retrieved, inspected, and used; preserve saved paths, failures, conflicts, conditions, and limitations.
  4. Use host tools (work; research-document-maintenance). When a used source deserves durable context, create or update one naturally named source note under `sources/` with the citation or URL, what was actually inspected and learned, conditions, conflicts, limitations, and useful related links. A source explanation is useful when available but is not mandatory. Do not generate a Source ID, fingerprint, or byte hash. Keep the readable links and synthesis in `.dove/research/sources/SOURCES.md` current when a detail document is created or materially changed. Update `.dove/research/RESEARCH.md` only for a material mainline, important conclusion, navigation, or priority change. Maintain Dove research Markdown only when the work creates durable research value.
  - Clarification: Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation.

## Dove capsule

- Use host file and research tools directly. Research Markdown is ordinary researcher-owned context, not a database.
- Keep material failures, limitations, and uncertainty visible; model output, tests, and review are bounded evidence rather than scientific authority.
