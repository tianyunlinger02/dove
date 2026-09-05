---
description: "Use when external sources, citation identity, DOI checks, or bounded bibliography verification can change the research judgment."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.source

Use when external sources, citation identity, DOI checks, or bounded bibliography verification can change the research judgment.

## Request

$ARGUMENTS

## Examples

- `/dove:source`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Find, retrieve when possible, read, verify, and document sources that can change the research judgment.

### When to use

Use for source discovery, reading, comparison, verification, bounded bibliography DOI identity checks, source-backed positioning, or route changes that depend on external theory or related work.

### What Dove will examine

- Start from the user's source question and current project need, not a fixed tool order or paper count.
- Separate citation identity from claim support, and distinguish material merely found, identity-verified, retrieved, inspected, and used. When a DOI matters and direct lookup is available, check it before fuzzy title matching; compare DOI, title, authors, year, and venue or version, then report verified, conflict, not-found, or unknown. For a bounded bibliography DOI identity check, verify only the requested entries and do not create a ledger.
- Extract consensus, contradictions, assumptions, missing controls, transferable mechanisms, and research opportunities from inspected material.
- For explicit systematic review, meta-analysis, evidence grading, or auditable synthesis, use a suitable structured question, search scope, eligibility criteria, PRISMA-style tracking, risk-of-bias and evidence-certainty judgments when applicable, and pool effects only when studies and data are comparable.

### Scope and changes

- Save retrieved source material or source notes only when useful and permitted.
- Keep DOI identity checks transient by default; update ordinary Source notes or bibliography entries only when identity results materially affect research judgment, manuscript citations, or continuation context.
- Maintain Dove research Markdown only when the user explicitly asks to record, update, or save Dove research context, the result clearly changes the research mainline, conclusion, decision, or priority, or preserving the work's evidence and continuation context is genuinely useful.

### Ways Dove may proceed

- When existing Dove research context would materially help the source question, read `.dove/research/RESEARCH.md`, then `.dove/research/sources/SOURCES.md`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Avoid broad research-tree scans. If a needed entry or link is absent, say so naturally.
- When existing Lessons could inspire current or subsequent work, improve judgment, expand the candidate space, or prevent repeated mistakes, read ".dove/research/lessons/LESSONS.md" if it exists, then the directly relevant or plausibly useful linked Lessons. Read ".dove/research/RESEARCH.md" first only when project context is still needed and it has not already been read in the active context. Reuse Lessons already read in the active context instead of rereading them mechanically. If Lessons materials are absent, work without them. Treat Lessons as fallible guidance, never as evidence.
- Discover, retrieve when available, read, and verify external material with permitted host tools. State project methods, experiment procedures, result numbers, citation content, and source facts only from material actually read, retrieved, executed, or inspected; use general knowledge only for hypotheses and search directions. For citation checks, verify identity and metadata first, using direct DOI lookup before fuzzy title search when available. A failed lookup is unknown, not permission to recreate retrieval through shell tools. Metadata identity is not full-text inspection or claim support; inspect actual content before using the source for a claim. For explicit systematic work, use the structured method stated above; ordinary paper finding, related-work scans, and single fact checks stay proportional. If needed material is unavailable, say what is missing and continue with any other material that can still inform the question.
- When a used source deserves durable context, create or update a naturally named source note with the citation or URL, what was inspected and learned, and, when useful for recovery, ordinary links to the Claim, Experiment, Figure artifact, or manuscript location that the inspected source actually supports or challenges. Use ordinary Markdown links and readable project-relative artifact paths only when useful for recovery, and keep the note as human prose rather than a structured store. Update only the narrowest relevant research document. Update `.dove/research/sources/SOURCES.md` only when its own links or synthesis materially change. Update `.dove/research/RESEARCH.md` only for a project-level mainline, conclusion, navigation, or priority change.

### What this should not replace

- Do not treat search snippets, titles, abstracts, verified metadata identity, or missing results as papers read.
- Do not create source databases, caches, trust scores, research hashes, DOI ledgers, or BibTeX parsers.
- Do not substitute CLI, shell, curl, ad hoc fetch scripts, or multi-step substitute chains when web or MCP retrieval is unavailable.

### When Dove needs input

- Ask only when ambiguity in intent, target artifact, evaluation criteria, scope, or a key tradeoff would change the next useful action. If active research context implies a feasible follow-up, do that next step rather than merely suggesting it.

### Using host tools

- Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request.
- Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive.
- In initialized Claude projects, use WebSearch for discovery, dove-paper-search for DOI metadata lookup and academic paper retrieval/full text when exposed, and hosted exa for ordinary webpages and known URLs when exposed; if a material class is missing or not permitted, say so and use other available evidence rather than shell fetching.

### Return with

- Inspected evidence, material change, unresolved limits, and the next useful action.
