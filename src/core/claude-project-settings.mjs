const RETIRED_DOVE_SERVER_NAME = "dove";

export const DOVE_CLAUDE_LOCAL_SETTINGS_PATH = ".claude/settings.local.json";
export const LEGACY_DOVE_CLAUDE_ENABLED_MCP_SELECTOR = `/enabledMcpjsonServers[${RETIRED_DOVE_SERVER_NAME}]`;

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringList(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} ${field} must be an array.`);
  if (value.some((item) => typeof item !== "string" || !item || item !== item.trim())) {
    throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} ${field} must contain non-empty trimmed strings.`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} ${field} must not contain duplicate server names.`);
  }
  return value;
}

export function inspectLegacyClaudeEnabledMcpSettings(settings) {
  if (!plainObject(settings)) throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} must contain a JSON object.`);
  const enabled = stringList(settings.enabledMcpjsonServers, "enabledMcpjsonServers");
  const disabled = stringList(settings.disabledMcpjsonServers, "disabledMcpjsonServers");
  const declaredEnabled = enabled.includes(RETIRED_DOVE_SERVER_NAME);
  const declaredDisabled = disabled.includes(RETIRED_DOVE_SERVER_NAME);
  return {
    declaredEnabled,
    declaredDisabled,
    conflicted: declaredEnabled && declaredDisabled
  };
}
