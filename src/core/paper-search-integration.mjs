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
  args: Object.freeze(["--from", PAPER_SEARCH_PACKAGE_SPECIFIER, PAPER_SEARCH_PACKAGE])
});

export function renderPaperSearchSupportSkill() {
  return `---
name: dove-paper-search
description: Search, verify metadata, retrieve, and read academic papers through the pinned dove-paper-search project MCP when scholarly material is relevant and the current host exposes it and current user/project permissions permit it.
user-invocable: false
---

# Dove Paper Search

Use the pinned \`dove-paper-search\` project MCP only when academic paper discovery, metadata verification, retrieval, or full-text reading materially helps the current request and the current host exposes that MCP and current user/project permissions permit it.

- Keep searches bounded and choose relevant scholarly sources instead of querying every available index or service by default.
- When a DOI matters and the MCP exposes \`get_crossref_paper_by_doi\`, use that direct lookup before fuzzy title search. Compare DOI, title, authors, year, and venue or version, then report verified, conflict, not-found, or unknown.
- An empty result is not-found; an MCP, permission, or network failure is unknown. Do not recreate the lookup through CLI, shell, \`curl\`, ad hoc fetch, or a substitute chain.
- Metadata identity is not full-text inspection or claim support. Inspect actual paper content before saying it supports a scientific claim.
- Download or read full text only when the task needs it. Distinguish material merely found, identity-verified, downloaded, actually read, and used, and report saved paths when useful.
- Prefer source-native open download and read tools. If \`download_with_fallback\` is needed for full text, always pass \`use_scihub: false\` explicitly. Do not call Sci-Hub tools.
- Use only MCP tools that the current host actually exposes and current user/project permissions permit. If current user/project permissions do not permit it, \`uvx\` is unavailable, or the server fails, state that the academic paper discovery, metadata lookup, download, or full text was not obtained through \`dove-paper-search\`, then choose any exposed and permitted material or action that can still advance the question: \`WebSearch\` discovery snippets, Exa ordinary webpage/documentation/venue/known-URL text when exposed, local project material, user-provided material, theory, experiment, or analysis. Do not install dependencies or substitute a CLI, shell, \`curl\`, or ad hoc fetch script for this MCP, and do not follow a fixed substitute sequence.
- A bounded bibliography DOI identity check may cover the requested entries in the current manuscript; keep it within that scope. Keep DOI checks transient by default. Update an ordinary Source note or bibliography only when the result materially changes research judgment, manuscript citations, or continuation context. Do not build a database, cache, score, ledger, generated ID, or BibTeX parser around them.
- Keep \`dove-paper-search\` for scholarly paper acquisition. Use built-in \`WebSearch\` for discovery when appropriate, and the project \`exa\` MCP for ordinary webpages and known URLs when exposed and permitted.
`;
}
