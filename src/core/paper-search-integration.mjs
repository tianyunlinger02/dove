export const PAPER_SEARCH_MCP_SERVER_NAME = "dove-paper-search";
export const PAPER_SEARCH_MCP_PATH = ".mcp.json";
export const PAPER_SEARCH_MCP_SELECTOR = `/mcpServers/${PAPER_SEARCH_MCP_SERVER_NAME}`;
export const PAPER_SEARCH_PACKAGE = "paper-search-mcp";
export const PAPER_SEARCH_PACKAGE_VERSION = "0.1.4";
export const PAPER_SEARCH_PACKAGE_SPECIFIER = `${PAPER_SEARCH_PACKAGE}==${PAPER_SEARCH_PACKAGE_VERSION}`;
export const PAPER_SEARCH_SUPPORT_SKILL_PATH = ".claude/skills/dove-paper-search/SKILL.md";

export const PAPER_SEARCH_MCP_FRAGMENT = Object.freeze({
  type: "stdio",
  command: "uvx",
  args: Object.freeze(["--from", PAPER_SEARCH_PACKAGE_SPECIFIER, "--with", "mcp<2", PAPER_SEARCH_PACKAGE])
});

export function renderPaperSearchSupportSkill() {
  return `---
name: dove-paper-search
description: Search, verify, download and read academic papers through the pinned dove-paper-search MCP when scholarly material matters to the current work.
user-invocable: false
---

# Dove Paper Search

Use the pinned \`dove-paper-search\` MCP for academic paper discovery, metadata, download and full-text reading.

- Choose the sources that fit the question rather than querying every index.
- When a DOI matters, use \`get_crossref_paper_by_doi\` before a fuzzy title search, and compare DOI, title, authors, year and venue or version.
- Metadata is not the paper. Read the actual text before saying a paper supports a claim, and say whether you read the full text, the abstract or only metadata.
- For full text, prefer source-native open downloads; when \`download_with_fallback\` is needed, pass \`use_scihub: false\`.
- When the MCP is missing or failing, get the paper another way: the arXiv or Crossref API, the publisher or OpenReview page, or a direct PDF download with \`curl\`, then read it.
`;
}
