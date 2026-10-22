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
description: Read webpages and known URLs whose content matters to the current work, through the hosted Exa MCP when it is available and otherwise through WebFetch or a direct download.
user-invocable: false
---

# Dove Web Reader

Read the actual page when its content matters to the current work.

- Use \`WebSearch\` to find pages, then read the ones that matter. Use the \`exa\` MCP for page bodies when it is available; when it is missing, out of quota or failing, use \`WebFetch\`, and for PDFs or pages WebFetch cannot render, download them with \`curl\` or \`wget\` and read the file.
- For academic papers, prefer the \`dove-paper-search\` MCP; the same fallbacks apply when it fails.
- Say what you actually read: the full page, a downloaded PDF, or only a search snippet. A judgment that rests on a snippet or an abstract says so.
`;
}
