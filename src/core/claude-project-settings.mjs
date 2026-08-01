import { DOVE_MCP_SERVER_NAME } from "./command-manifest.mjs";

export const DOVE_CLAUDE_LOCAL_SETTINGS_PATH = ".claude/settings.local.json";
export const DOVE_CLAUDE_MCP_APPROVAL_SELECTOR = `/enabledMcpjsonServers[${DOVE_MCP_SERVER_NAME}]`;

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

export function inspectClaudeMcpApprovalSettings(settings) {
  if (!plainObject(settings)) throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} must contain a JSON object.`);
  const enabled = stringList(settings.enabledMcpjsonServers, "enabledMcpjsonServers");
  const disabled = stringList(settings.disabledMcpjsonServers, "disabledMcpjsonServers");
  return {
    approved: enabled.includes(DOVE_MCP_SERVER_NAME),
    disabled: disabled.includes(DOVE_MCP_SERVER_NAME)
  };
}

export function mergeClaudeMcpApprovalSettings(settings) {
  const state = inspectClaudeMcpApprovalSettings(settings);
  if (state.disabled) {
    throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} explicitly disables the Dove MCP server; Dove will not override that decision.`);
  }
  if (state.approved) return { settings, changed: false };
  return {
    settings: {
      ...settings,
      enabledMcpjsonServers: [
        ...(settings.enabledMcpjsonServers ?? []),
        DOVE_MCP_SERVER_NAME
      ]
    },
    changed: true
  };
}

export function removeClaudeMcpApprovalSettings(settings) {
  const state = inspectClaudeMcpApprovalSettings(settings);
  if (state.disabled || !state.approved) return { settings, changed: false };
  return {
    settings: {
      ...settings,
      enabledMcpjsonServers: settings.enabledMcpjsonServers.filter(
        (name) => name !== DOVE_MCP_SERVER_NAME
      )
    },
    changed: true
  };
}
