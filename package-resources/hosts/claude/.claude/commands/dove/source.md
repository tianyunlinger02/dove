---
description: "Find and inspect sources, verify citation identities and claims, and use the findings to improve research decisions."
argument-hint: "optional request, artifact path, venue, constraint, or follow-up context"
---

# dove.source

Find and inspect sources, verify citation identities and claims, and use the findings to improve research decisions.

## Request

$ARGUMENTS

## Examples

- `/dove:source`

## How Dove approaches this work

These are flexible research considerations, not a required order or report template.

### What this is for

Discover, retrieve, inspect and verify sources that can change a research decision or answer a specified question.

### When to use

Use for literature discovery, source reading, citation identity checks, claim verification, related-work comparison or systematic synthesis.

### Scope and changes

- Search snippets, abstracts, metadata and absent search results do not establish full-text inspection or absence of overlap. If retrieval is unavailable, state the gap and use other permitted material rather than shell fetching or substitute retrieval chains.

### Ways Dove may proceed

- Start from the user's question and relevant existing notes. Distinguish discovery, verified citation identity, full-text inspection and claim support; none substitutes for the next. For citation identity, use direct DOI lookup before fuzzy title search, checking title, authors, year and venue/version. Report conflicts, missing entries and unknowns.
- For body-level details, read the full text with 1–5 concrete questions, using `.dove/research/papers/<id>.md` and the cumulative note format in RESEARCH_QUALITY.md. Reuse answered questions rather than rereading; append only new answers with section, page or equation locations, preserving earlier ones. Check-only work returns answers without creating notes or editing manuscripts.
- Split compound claims and mark each supported, contradicted, or uncovered, with the relevant passage, formula, algorithm or code and its limits. Use the cumulative notes for novelty and overlap judgments, link affected artifacts and recommend wording matching actual support, not support for only part of a sentence.
- Search real neighbors across fields at equal contribution granularity, following the shared topic guidance when selecting ideas. Inspect decisive overlap and use findings to develop mechanisms, candidates and controls, not just deduct novelty. Apply findings to designs or claims; stop when retrieval would not change the decision.
- For explicit systematic reviews or meta-analysis, define the question, search scope and eligibility. Use applicable PRISMA tracking, bias and certainty assessment; pool only comparable effects. Ordinary searches need no such machinery. Update `sources/SOURCES.md` only when useful links or synthesis change.

### Using host tools

- Use tools and materials exposed by the current host and permitted by the user and project. If something is unavailable, name the gap and continue with useful permitted alternatives.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
- Use exposed WebSearch for discovery, dove-paper-search for DOI metadata and academic papers, and hosted exa for ordinary webpages and known URLs.
