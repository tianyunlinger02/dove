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

- Start from the user's question and decision, using existing source notes only when relevant. Distinguish a discovered lead, verified citation identity, inspected full text and a checked claim. Retrieval is not reading, and metadata identity does not establish claim support.
- When checking citation identity, use direct DOI lookup before fuzzy title search when available. Compare the DOI, title, authors, year and venue or version, and report verified identity, conflicts, not-found results or unknowns. A bounded bibliography check covers only the requested entries and does not create a ledger or authorize manuscript edits.
- Inspect actual content before using a source for a claim. Split compound claims into their material parts and report each as supported, contradicted, or uncovered, citing the relevant passage, formula, algorithm or code and its limits. Recommend wording supported by that material rather than treating partial support as support for the whole sentence.
- Search real near neighbors across relevant fields and compare their contributions at the same granularity. Inspect decisive overlap rather than inferring it from shared functions, titles or known components. Use the findings to identify transferable mechanisms, contradictions, missing controls and new candidates, not just to deduct novelty. Apply them to affected designs, claims, figures or wording, and stop when further retrieval would not change the decision.
- For an explicit systematic review, meta-analysis or auditable synthesis, define a structured question, search scope and eligibility criteria. Use PRISMA-style tracking and assess bias and evidence certainty when applicable; pool effects only when studies and data are comparable. Ordinary searches and fact checks do not require this machinery.
- Preserve a source note only when useful and permitted, recording the citation or URL, what was inspected, what it supports or challenges and links to affected artifacts. Update `.dove/research/sources/SOURCES.md` only when its links or synthesis change.

### Using host tools

- Use tools and materials exposed by the current host and permitted by the user and project. If something is unavailable, name the gap and continue with useful permitted alternatives.
- Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session.
- Use exposed WebSearch for discovery, dove-paper-search for DOI metadata and academic papers, and hosted exa for ordinary webpages and known URLs.
