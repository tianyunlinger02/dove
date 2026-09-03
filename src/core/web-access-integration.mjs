export const EXA_MCP_SERVER_NAME = "exa";
export const EXA_MCP_PATH = ".mcp.json";
export const EXA_MCP_SELECTOR = `/mcpServers/${EXA_MCP_SERVER_NAME}`;
export const EXA_MCP_URL = "https://mcp.exa.ai/mcp";
export const EXA_WEB_SUPPORT_SKILL_PATH = ".claude/skills/dove-web-reader/SKILL.md";

export const WEB_FETCH_DENY_PERMISSION = "WebFetch";
export const WEB_FETCH_DENY_SELECTOR = "/permissions/deny[WebFetch]";

export const EXA_MCP_FRAGMENT = Object.freeze({
  url: EXA_MCP_URL,
  type: "http"
});

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function webFetchDenyFragmentState(settings) {
  if (settings.permissions !== undefined && !plainObject(settings.permissions)) {
    throw new Error(".claude/settings.json permissions must be a JSON object.");
  }
  const deny = settings.permissions?.deny;
  if (deny !== undefined && !Array.isArray(deny)) {
    throw new Error(".claude/settings.json permissions.deny must be an array.");
  }
  if (!Array.isArray(deny) || !deny.includes(WEB_FETCH_DENY_PERMISSION)) {
    return { exists: false, digest: null, fragment: null };
  }
  return { exists: true, digest: null, fragment: WEB_FETCH_DENY_PERMISSION };
}

export function mergeWebFetchDenyPermission(settings) {
  if (!plainObject(settings)) throw new Error(".claude/settings.json must contain a JSON object.");
  const permissions = settings.permissions;
  if (permissions !== undefined && !plainObject(permissions)) throw new Error(".claude/settings.json permissions must be a JSON object.");
  const deny = permissions?.deny;
  if (deny !== undefined && !Array.isArray(deny)) throw new Error(".claude/settings.json permissions.deny must be an array.");
  const currentDeny = deny ?? [];
  if (currentDeny.includes(WEB_FETCH_DENY_PERMISSION)) return { settings, changed: false };
  return {
    settings: {
      ...settings,
      permissions: {
        ...(permissions ?? {}),
        deny: [...currentDeny, WEB_FETCH_DENY_PERMISSION]
      }
    },
    changed: true
  };
}

export function removeWebFetchDenyPermission(settings) {
  if (!plainObject(settings)) throw new Error(".claude/settings.json must contain a JSON object.");
  const permissions = settings.permissions;
  if (permissions === undefined) return { settings, changed: false };
  if (!plainObject(permissions)) throw new Error(".claude/settings.json permissions must be a JSON object.");
  const deny = permissions.deny;
  if (deny === undefined) return { settings, changed: false };
  if (!Array.isArray(deny)) throw new Error(".claude/settings.json permissions.deny must be an array.");
  const index = deny.indexOf(WEB_FETCH_DENY_PERMISSION);
  if (index < 0) return { settings, changed: false };
  const nextDeny = [...deny.slice(0, index), ...deny.slice(index + 1)];
  const nextPermissions = { ...permissions };
  if (nextDeny.length > 0) nextPermissions.deny = nextDeny;
  else delete nextPermissions.deny;
  const nextSettings = { ...settings };
  if (Object.keys(nextPermissions).length > 0) nextSettings.permissions = nextPermissions;
  else delete nextSettings.permissions;
  return { settings: nextSettings, changed: true };
}

export function renderExaWebSupportSkill() {
  return `---
name: dove-web-reader
description: Read ordinary webpages and known URLs through the hosted Exa project MCP when webpage content is relevant and the current host exposes it and current user/project permissions permit it.
user-invocable: false
---

# Dove Web Reader

Use the \`exa\` hosted project MCP only when ordinary webpage body retrieval, documentation page reading, venue page reading, crawling, or a known URL materially helps the current request and the current host exposes Exa and current user/project permissions permit it.

- Keep built-in \`WebSearch\` available for web discovery and search-result triage; do not substitute webpage retrieval for search.
- Use the pinned \`dove-paper-search\` project MCP for academic paper discovery, download, and full-text reading when that MCP is exposed and current user/project permissions permit it. Use \`exa\` for ordinary webpage bodies, documentation pages, venue pages, and known URLs outside academic paper acquisition when Exa is exposed and current user/project permissions permit it.
- Do not use built-in \`WebFetch\`; Claude project permissions deny it so webpage body retrieval goes through \`exa\`.
- Use only MCP tools that the current host actually exposes and current user/project permissions permit. If current user/project permissions do not permit it, Exa is unavailable, or the server fails, state that the ordinary webpage body, documentation page, venue page, or known URL was not obtained through Exa, then choose any exposed and permitted material or action that can still advance the question: \`WebSearch\` discovery snippets, \`dove-paper-search\` academic paper discovery/download/full text when exposed, local project material, user-provided material, theory, experiment, or analysis. Do not use CLI, shell, \`curl\`, Node/Python fetch scripts, or built-in \`WebFetch\` instead, and do not follow a fixed substitute sequence.
- Do not turn URLs into Dove IDs, hashes, trust scores, ledgers, or database records.
`;
}
