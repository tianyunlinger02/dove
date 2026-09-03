---
name: dove-source
description: "Discover, retrieve when available, read, verify, and document useful sources that materially inform the research."
---

# Dove Source

Discover, retrieve when available, read, verify, and document useful sources that materially inform the research.

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Find, retrieve when possible, read, verify, and document sources that can change the research judgment.

### When it helps

Use for source discovery, reading, comparison, verification, source-backed positioning, or route changes that depend on external theory or related work.

### What Dove will examine

- Return with what was inspected, what changed, what remains unresolved, and the next useful action.
- Start from the user's source question and current project need, not a fixed tool order or paper count.
- Separate citation identity from claim support, and distinguish material merely found from material retrieved, inspected, and used.
- Extract consensus, contradictions, assumptions, missing controls, transferable mechanisms, and research opportunities from inspected material.
- For explicit systematic review, meta-analysis, evidence grading, or auditable synthesis, use a suitable structured question, search scope, eligibility criteria, PRISMA-style tracking, risk-of-bias and evidence-certainty judgments when applicable, and pool effects only when studies and data are comparable.

### Scope and changes

- Save retrieved source material or source notes only when useful and permitted.
- Maintain Dove research Markdown only when the user explicitly asks to record, update, or save Dove research context, the result clearly changes the research mainline, conclusion, decision, or priority, or preserving the work's evidence and continuation context is genuinely useful.

### Ways Dove may proceed

- When existing Dove research context would materially help the source question, read `.dove/research/RESEARCH.md`, then `.dove/research/sources/SOURCES.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally.
- When existing Lessons could inspire current or subsequent work, improve judgment, expand the candidate space, or prevent repeated mistakes, read ".dove/research/lessons/LESSONS.md" if it exists, then the directly relevant or plausibly useful linked Lessons. Read ".dove/research/RESEARCH.md" first only when project context is still needed and it has not already been read in the active context. Reuse Lessons already read in the active context instead of rereading them mechanically. If Lessons materials are absent, work without them. Treat Lessons as fallible guidance, never as evidence.
- Discover, retrieve when available, read, and verify external material with permitted host tools. State project methods, experiment procedures, result numbers, citation content, and source facts only from material actually read, retrieved, executed, or inspected; use general knowledge only for hypotheses and search directions. For citation checks, verify identity and metadata first, then whether inspected content supports the specific claim and to what strength. For explicit systematic work, use the structured method stated above; ordinary paper finding, related-work scans, and single fact checks stay proportional. If needed material is unavailable, say what is missing and continue with any other material that can still inform the question.
- When a used source deserves durable context, create or update a naturally named source note with the citation or URL, what was inspected and learned, and, when useful for recovery, ordinary links to the Claim, Experiment, Figure artifact, or manuscript location that the inspected source actually supports or challenges. Use ordinary Markdown links and readable project-relative artifact paths only when useful for recovery; do not add databases, generated IDs, frontmatter, backlink audits, or consistency matrices. Update only the narrowest relevant research document. Update `.dove/research/sources/SOURCES.md` only when its own links or synthesis materially change. Update `.dove/research/RESEARCH.md` only for a project-level mainline, conclusion, navigation, or priority change.

### What this should not replace

- Do not treat search snippets, titles, abstracts, or missing results as papers read.
- Do not create source databases, trust scores, or research hashes.
- Do not substitute CLI, shell, curl, or ad hoc fetch scripts when web or MCP retrieval is unavailable.

### When Dove needs input

- Ask only when ambiguity in intent, target artifact, evaluation criteria, scope, or a key tradeoff would change the next useful action. If active research context implies a feasible follow-up, do that next step rather than merely suggesting it.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- DSH adapters are project-local filesystem Skills; use only affordances that the current DSH run actually exposes.
- DSH receives filesystem Skills only. Use only DSH-exposed search, reading, file, and project tools; if a material class is missing, say so and proceed with available local or user-provided material, theory, experiment, or analysis.
