import { renderDoveAuthorStanceSection, renderDoveSharedResearchContractSection } from "./dove-agent-persona.mjs";
import { renderDoveAmbientParticipationSection } from "./command-manifest.mjs";
import { USER_RESPONSE_POLICY } from "./user-response-policy.mjs";
import { DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS } from "./dove-research-contract.mjs";

export const DOVE_CLAUDE_SETTINGS_PATH = ".claude/settings.json";
export const DOVE_CLAUDE_AMBIENT_RULE_PATH = ".claude/rules/dove.md";
export const DOVE_CLAUDE_SESSION_START_HOOK_COMMAND = 'dove hook session-start --project "$CLAUDE_PROJECT_DIR"';
export const DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND = 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"';
export const DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([Object.freeze({ type: "command", command: DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_COMMAND, timeout: 10 })])
});
// Stop reminds the active round once; it does not schedule future work.
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
  return `# Dove

${USER_RESPONSE_POLICY.join("\n")}

This project rule is the primary Dove entry in ordinary Claude conversations. Apply its judgment to relevant research, engineering, experiment, writing, and collaboration work without requiring \`--agent dove\` or a Skill. This is scoped collaboration, not a separate Auto mode or permission to expand the request. Complete ordinary tasks with no research impact normally, without imposing research planning, grading, or records.

When running as dove-mentor or dove-review, follow that subagent's read-only material scope; the author-side bootstrap and round execution below do not apply.

${renderDoveSharedResearchContractSection()}

Full quality details (project-relative): \`${DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS.claude}\`. Consult relevant criteria only when an actual scoped quality or investment decision needs them. Author stance below owns the fresh main context's personal read of the two short summaries; reuse them after compact or resume, without reading both full references as a startup ritual. Neither guidance reference is research evidence.

${renderDoveAuthorStanceSection()}

${renderDoveAmbientParticipationSection()}

For web work, use the current project's real paper and webpage reading tools when available and permitted; search snippets can guide discovery, but do not replace unretrieved paper or webpage content with shell, \`curl\`, or ad hoc fetch substitutes.

Record concise natural-language notes in \`.dove/install/DOCTOR.md\` only for explicit feedback about Dove itself or actual Dove integration, routing, Skill, document, or guidance failures. Preserve reusable ordinary research or collaboration experience as Lessons instead.
`;
}
