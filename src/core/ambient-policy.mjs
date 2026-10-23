import { renderDoveAmbientParticipationSection } from "./command-manifest.mjs";
import { USER_RESPONSE_POLICY } from "./user-response-policy.mjs";
import { renderDoveOperatingManual } from "./dove-research-contract.mjs";
import { DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATH, DOVE_AUTHOR_PREFERENCES_REFERENCE_PATH } from "./dove-author-preferences.mjs";

export const DOVE_CLAUDE_SETTINGS_PATH = ".claude/settings.json";
export const DOVE_CLAUDE_AMBIENT_RULE_PATH = ".claude/rules/dove.md";
export const DOVE_CLAUDE_SESSION_START_HOOK_COMMAND = 'dove hook session-start --project "$CLAUDE_PROJECT_DIR"';
export const DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND = 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"';
export const DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([Object.freeze({ type: "command", command: DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND, timeout: 10 })])
});
export const DOVE_CLAUDE_STOP_HOOK_COMMAND = 'dove hook stop --project "$CLAUDE_PROJECT_DIR"';
export const DOVE_CLAUDE_STOP_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([Object.freeze({ type: "command", command: DOVE_CLAUDE_STOP_HOOK_COMMAND, timeout: 10 })])
});
export const DOVE_CLAUDE_STATUS_LINE_COMMAND = 'dove hook statusline --project "$CLAUDE_PROJECT_DIR"';
export const DOVE_CLAUDE_STATUS_LINE = Object.freeze({
  type: "command",
  command: DOVE_CLAUDE_STATUS_LINE_COMMAND
});
export const DOVE_CLAUDE_SESSION_START_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([
    Object.freeze({
      type: "command",
      command: DOVE_CLAUDE_SESSION_START_HOOK_COMMAND,
      timeout: 10
    })
  ])
});
function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameKeys(value, keys) {
  return plainObject(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function exactManagedHook(value, command) {
  if (!sameKeys(value, ["hooks"]) || !Array.isArray(value.hooks) || value.hooks.length !== 1) return false;
  const hook = value.hooks[0];
  return sameKeys(hook, ["command", "timeout", "type"])
    && hook.type === "command"
    && hook.command === command
    && hook.timeout === 10;
}

function hookCommandMarkers(eventName) {
  if (eventName === "SessionStart") return ["dove hook session-start"];
  if (eventName === "UserPromptSubmit") return ["dove hook user-prompt-submit"];
  if (eventName === "Stop") return ["dove hook stop"];
  throw new Error(`Unsupported Dove Claude hook event: ${eventName}.`);
}

function referencesManagedHook(value, eventName) {
  if (!plainObject(value) || !Array.isArray(value.hooks)) return false;
  const markers = hookCommandMarkers(eventName);
  return value.hooks.some((hook) => plainObject(hook)
    && typeof hook.command === "string"
    && markers.some((marker) => hook.command.includes(marker)));
}

function mergeManagedHook(entries, eventName, command, managedEntry) {
  const exactEntries = entries.filter((entry) => exactManagedHook(entry, command));
  const conflictingEntries = entries.filter((entry) => referencesManagedHook(entry, eventName) && !exactManagedHook(entry, command));
  if (exactEntries.length > 1 || conflictingEntries.length > 0) {
    throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} already defines a conflicting Dove-managed ${eventName} hook.`);
  }
  return exactEntries.length === 1 ? { entries, changed: false } : { entries: [...entries, managedEntry], changed: true };
}

function assertClaudeSettingsShape(settings) {
  if (!plainObject(settings)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} must contain a JSON object.`);
  if (settings.hooks !== undefined && !plainObject(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  return settings.hooks ?? {};
}

export function mergeClaudeSessionStartSettings(settings) {
  const hooks = assertClaudeSettingsShape(settings);
  const sessionStartHooks = hooks.SessionStart;
  if (sessionStartHooks !== undefined && !Array.isArray(sessionStartHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.SessionStart must be an array.`);
  const sessionStart = mergeManagedHook(sessionStartHooks ?? [], "SessionStart", DOVE_CLAUDE_SESSION_START_HOOK_COMMAND, DOVE_CLAUDE_SESSION_START_HOOK_ENTRY);
  if (!sessionStart.changed) return { settings, changed: false };
  return {
    settings: {
      ...settings,
      hooks: {
        ...hooks,
        SessionStart: sessionStart.entries
      }
    },
    changed: true
  };
}

export function mergeClaudeUserPromptSubmitSettings(settings) {
  const hooks = assertClaudeSettingsShape(settings);
  const entries = hooks.UserPromptSubmit;
  if (entries !== undefined && !Array.isArray(entries)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.UserPromptSubmit must be an array.`);
  const merged = mergeManagedHook(entries ?? [], "UserPromptSubmit", DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND, DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_ENTRY);
  if (!merged.changed) return { settings, changed: false };
  return { settings: { ...settings, hooks: { ...hooks, UserPromptSubmit: merged.entries } }, changed: true };
}

export function mergeClaudeStopSettings(settings) {
  const hooks = assertClaudeSettingsShape(settings);
  const entries = hooks.Stop;
  if (entries !== undefined && !Array.isArray(entries)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.Stop must be an array.`);
  const merged = mergeManagedHook(entries ?? [], "Stop", DOVE_CLAUDE_STOP_HOOK_COMMAND, DOVE_CLAUDE_STOP_HOOK_ENTRY);
  if (!merged.changed) return { settings, changed: false };
  return { settings: { ...settings, hooks: { ...hooks, Stop: merged.entries } }, changed: true };
}

export function renderClaudeAmbientRule() {
  return renderDoveOperatingManual({
    responsePolicy: USER_RESPONSE_POLICY,
    participation: renderDoveAmbientParticipationSection(),
    preferencesPath: DOVE_AUTHOR_PREFERENCES_REFERENCE_PATH,
    preferencesFullPath: DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATH
  });
}
