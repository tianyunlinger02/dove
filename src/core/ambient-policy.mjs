import {
  DOVE_RESEARCH_CLARIFICATION,
  DOVE_RESEARCH_DIRECT_JUDGMENT,
  DOVE_RESEARCH_FLAT_SKILL_SENTENCE,
  DOVE_RESEARCH_ONE_AGENT
} from "./dove-research-contract.mjs";
import { USER_RESPONSE_POLICY } from "./user-response-policy.mjs";

const AMBIENT_CONTEXT = "Use hidden `dove-intake` as a zero-write research-context bridge for this request.";

const NON_RESEARCH_RESEARCH_PHRASE = /(?:\bresearch\s+(?:travel|trip|hotel|flight|laptop|phone|product|price|shopping|purchase|job|career|school|program|application|email)\b|研究生(?:申请|邮件|简历|文书|项目|学校)?|研究(?:旅行|旅游|酒店|航班|电脑|手机|商品|价格|购物|求职|职业|申请))/iu;
const RESEARCH_RELEVANCE = /(?:\bresearch (?:question|problem|goal|project|mainline|claim|route|result|record|note|context|decision)\b|\b(?:papers?|manuscripts?|experiments?|hypotheses|hypothesis|literature|citations?|peer review|reviewer|review handoff|review return|rebuttal|submission venue)\b|科研|研究(?:问题|目标|主线|主张|路线|结果|记录|上下文|决策)|论文|稿件|实验|假设|文献|引用|同行评审|审稿|审稿人|审稿交接|审稿返回|回复审稿|反驳|投稿(?:期刊|会议|要求)?)/iu;

export function isResearchRelatedWakeupPrompt(prompt) {
  if (typeof prompt !== "string") return false;
  const normalized = prompt.normalize("NFKC").trim();
  if (!normalized || normalized.startsWith("/") || NON_RESEARCH_RESEARCH_PHRASE.test(normalized)) return false;
  return RESEARCH_RELEVANCE.test(normalized);
}

export const isHighConfidenceAmbientWorkPrompt = isResearchRelatedWakeupPrompt;

export const DOVE_CLAUDE_SETTINGS_PATH = ".claude/settings.json";
export const DOVE_CLAUDE_AMBIENT_RULE_PATH = ".claude/rules/dove.md";
export const DOVE_CLAUDE_AMBIENT_SKILL_PATH = ".claude/skills/dove-intake/SKILL.md";
export const DOVE_CLAUDE_AMBIENT_HOOK_COMMAND = 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"';
export const DOVE_CLAUDE_SESSION_START_HOOK_COMMAND = 'dove hook session-start --project "$CLAUDE_PROJECT_DIR"';
export const DOVE_CLAUDE_STATUS_LINE_COMMAND = 'dove hook statusline --project "$CLAUDE_PROJECT_DIR"';
export const DOVE_CLAUDE_STATUS_LINE = Object.freeze({
  type: "command",
  command: DOVE_CLAUDE_STATUS_LINE_COMMAND
});
export const LEGACY_DOVE_CLAUDE_AMBIENT_HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/scripts/dove-user-prompt-submit-package.mjs"';
export const DOVE_CLAUDE_AMBIENT_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([
    Object.freeze({
      type: "command",
      command: DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
      timeout: 10
    })
  ])
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
  if (eventName === "UserPromptSubmit") return ["dove hook user-prompt-submit", "dove-user-prompt-submit-package.mjs"];
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

export function mergeClaudeAmbientSettings(settings) {
  if (!plainObject(settings)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} must contain a JSON object.`);
  if (settings.hooks !== undefined && !plainObject(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const hooks = settings.hooks ?? {};
  const promptHooks = hooks.UserPromptSubmit;
  const sessionStartHooks = hooks.SessionStart;
  if (promptHooks !== undefined && !Array.isArray(promptHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.UserPromptSubmit must be an array.`);
  if (sessionStartHooks !== undefined && !Array.isArray(sessionStartHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.SessionStart must be an array.`);

  const prompt = mergeManagedHook(promptHooks ?? [], "UserPromptSubmit", DOVE_CLAUDE_AMBIENT_HOOK_COMMAND, DOVE_CLAUDE_AMBIENT_HOOK_ENTRY);
  const sessionStart = mergeManagedHook(sessionStartHooks ?? [], "SessionStart", DOVE_CLAUDE_SESSION_START_HOOK_COMMAND, DOVE_CLAUDE_SESSION_START_HOOK_ENTRY);
  if (!prompt.changed && !sessionStart.changed) return { settings, changed: false };

  return {
    settings: {
      ...settings,
      hooks: {
        ...hooks,
        UserPromptSubmit: prompt.entries,
        SessionStart: sessionStart.entries
      }
    },
    changed: true
  };
}

export function ambientContextForPrompt(prompt) {
  return isResearchRelatedWakeupPrompt(prompt) ? AMBIENT_CONTEXT : null;
}

export function renderClaudeAmbientRule() {
  return `# Dove

${USER_RESPONSE_POLICY.join("\n")}

${DOVE_RESEARCH_ONE_AGENT} ${DOVE_RESEARCH_FLAT_SKILL_SENTENCE}

The host handles general task routing. For clearly research-related non-slash requests, hidden \`dove-intake\` is only a thin zero-write bridge into the same Dove judgment; it does not choose a Skill, authorize work, decide continuation or completion, or narrow claims. Slash commands keep their explicit routing. Ask only when a consequential ambiguity would change the next useful action. ${DOVE_RESEARCH_DIRECT_JUDGMENT}

For web work, use the current project's real paper and webpage reading tools when available and permitted; search snippets can guide discovery, but do not replace unretrieved paper or webpage content with shell, \`curl\`, or ad hoc fetch substitutes.

Record concise natural-language notes in \`.dove/install/DOCTOR.md\` only for explicit feedback about Dove itself or actual Dove integration, routing, Skill, document, or guidance failures. Preserve reusable ordinary research or collaboration experience as Lessons instead.
`;
}

export function renderClaudeAmbientSkill() {
  return `---
name: dove-intake
description: Add Dove's research context to a likely research-related request without performing work.
user-invocable: false
---

# Dove intake

This request is likely research-related. Use the current conversation, project facts, authoritative artifacts, confirmed mainline, and available host capabilities to decide how Dove should respond. The model may answer directly, ask one consequential clarification, or use one or more optional specialist capabilities when materially useful; do not make the user coordinate Skills. Loading this intake is zero-write: do not read, search, execute, modify files, maintain research documents, publish, or perform external actions as part of intake itself. Intake does not select a Skill, grant authorization, decide continuation or completion, or narrow claims. Substantive capability results return to the same Dove mainline judgment. ${DOVE_RESEARCH_DIRECT_JUDGMENT} ${DOVE_RESEARCH_CLARIFICATION}
`;
}
