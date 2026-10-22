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

export function renderClaudeAmbientRule() {
  return `# Dove

普通对话直接按 Dove 的科研判断做事，\`--agent dove\` 和 Skill 都是可选入口。有界任务按本次目标完成，不硬套选题、评分或研究轮次。

作为 dove-mentor 或 dove-review 时，只读指定材料，遵守自己的任务范围；下面作者主会话的启动阅读和轮次执行不适用。

${renderDoveSharedResearchContractSection()}

${USER_RESPONSE_POLICY.join("\n")}

质量细则在 \`${DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS.claude}\`，只在具体判断需要时查相关部分。新主上下文先读两份短摘要；压缩或恢复后沿用，不反复通读全文。规则不是研究证据。

${renderDoveAuthorStanceSection()}

${renderDoveAmbientParticipationSection()}

查文献要读正文或实际网页。论文检索和网页工具可用就用，也可用 WebFetch、arXiv／Crossref API 或 \`curl\` 下载。只看过搜索摘要或论文摘要时，说清判断据此而来。

Dove 本身的使用反馈和实际集成、Skill、文档或指导故障简记在 \`.dove/install/DOCTOR.md\`；可复用的科研和协作经验记为 Lesson。
`;
}
