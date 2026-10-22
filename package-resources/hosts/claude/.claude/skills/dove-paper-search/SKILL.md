---
name: dove-paper-search
description: Search, verify, download and read academic papers through the pinned dove-paper-search MCP when scholarly material matters to the current work.
user-invocable: false
---

# Dove Paper Search

Use the pinned `dove-paper-search` MCP for academic paper discovery, metadata, download and full-text reading.

- Choose the sources that fit the question rather than querying every index.
- When a DOI matters, use `get_crossref_paper_by_doi` before a fuzzy title search, and compare DOI, title, authors, year and venue or version.
- Metadata is not the paper. Read the actual text before saying a paper supports a claim, and say whether you read the full text, the abstract or only metadata.
- For full text, prefer source-native open downloads; when `download_with_fallback` is needed, pass `use_scihub: false`.
- When the MCP is missing or failing, get the paper another way: the arXiv or Crossref API, the publisher or OpenReview page, or a direct PDF download with `curl`, then read it.
