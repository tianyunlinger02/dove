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
description: 当前工作需要网页正文时，用 Exa、WebFetch 或直接下载读取实际内容。
user-invocable: false
---

# Dove 网页阅读

内容会影响判断时，读实际页面。

- \`WebSearch\` 用于发现；正文可用 \`exa\` 或 \`WebFetch\`。工具缺失、额度用完或失败时，换可用方式；无法渲染的页面或 PDF 用 \`curl\`／\`wget\` 下载后读。
- 论文优先用 \`dove-paper-search\`，不可用时同样换来源。
- 说清实际读到的是全文、PDF 还是搜索摘要，不把摘要判断说成全文依据。
`;
}
