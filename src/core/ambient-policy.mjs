import { USER_RESPONSE_POLICY } from "./user-response-policy.mjs";

const AMBIENT_CONTEXT = "Use hidden `dove-intake` for this request.";

const AMBIENT_WORK_INTENT = /(?:\b(?:research|investigate|experiment|benchmark|source|literature|paper|manuscript|draft|figure|plot|review|rebuttal|revise|implement|build|fix|debug|test|validate|analy[sz]e|compare|audit|lesson|lessons|remember|reflect|retrospect)\b|(?:研究|调研|实验|基准|文献|来源|论文|稿件|草稿|图表|绘图|评审|审稿|回复审稿|反驳|修订|实现|构建|修复|调试|测试|验证|分析|比较|审查|检查|经验|教训|记住|记录|复盘|反思))/iu;
const CONTEXT_FOLLOW_UP = /^(?:说人话|解释(?:一下|下)?|说明(?:一下|下)?|这是什么意思|什么意思|再(?:简短|简单|短|说一遍)|简短(?:一点|些)?|简单(?:一点|些)?|总结(?:一下|下)?|换个说法|重说(?:一遍)?|展开(?:一下|下)?|继续|接着来|下一步|确认|好的|明白|收到|谢谢|多谢|感谢|why|what does (?:this|that) mean|explain|summari[sz]e|shorter|simplify|say that again|continue|go on|next|ok|okay|got it|thanks)(?:[!！,.，。?？\s]*)$/iu;

export function isHighConfidenceAmbientWorkPrompt(prompt) {
  if (typeof prompt !== "string") return false;
  const normalized = prompt.normalize("NFKC").trim();
  if (!normalized || normalized.startsWith("/") || CONTEXT_FOLLOW_UP.test(normalized)) return false;
  return AMBIENT_WORK_INTENT.test(normalized);
}

export const DOVE_CLAUDE_SETTINGS_PATH = ".claude/settings.json";
export const DOVE_CLAUDE_AMBIENT_RULE_PATH = ".claude/rules/dove.md";
export const DOVE_CLAUDE_AMBIENT_SKILL_PATH = ".claude/skills/dove-intake/SKILL.md";
export const DOVE_CLAUDE_AMBIENT_HOOK_COMMAND = 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"';
export const DOVE_CLAUDE_STOP_HOOK_COMMAND = 'dove hook stop --project "$CLAUDE_PROJECT_DIR"';
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
export const DOVE_CLAUDE_STOP_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([
    Object.freeze({
      type: "command",
      command: DOVE_CLAUDE_STOP_HOOK_COMMAND,
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

function referencesManagedHook(value, eventName) {
  if (!plainObject(value) || !Array.isArray(value.hooks)) return false;
  return value.hooks.some((hook) => {
    if (!plainObject(hook) || typeof hook.command !== "string") return false;
    if (eventName === "UserPromptSubmit") {
      return hook.command.includes("dove hook user-prompt-submit")
        || hook.command.includes("dove-user-prompt-submit-package.mjs");
    }
    return hook.command.includes("dove hook stop");
  });
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
  const stopHooks = hooks.Stop;
  if (promptHooks !== undefined && !Array.isArray(promptHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.UserPromptSubmit must be an array.`);
  if (stopHooks !== undefined && !Array.isArray(stopHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.Stop must be an array.`);

  const prompt = mergeManagedHook(promptHooks ?? [], "UserPromptSubmit", DOVE_CLAUDE_AMBIENT_HOOK_COMMAND, DOVE_CLAUDE_AMBIENT_HOOK_ENTRY);
  const stop = mergeManagedHook(stopHooks ?? [], "Stop", DOVE_CLAUDE_STOP_HOOK_COMMAND, DOVE_CLAUDE_STOP_HOOK_ENTRY);
  if (!prompt.changed && !stop.changed) return { settings, changed: false };

  return {
    settings: {
      ...settings,
      hooks: {
        ...hooks,
        UserPromptSubmit: prompt.entries,
        Stop: stop.entries
      }
    },
    changed: true
  };
}

export function ambientContextForPrompt(prompt) {
  return isHighConfidenceAmbientWorkPrompt(prompt) ? AMBIENT_CONTEXT : null;
}

export function renderClaudeAmbientRule() {
  return `# Dove

${USER_RESPONSE_POLICY.join("\n")}

Dove has ten flat Skills: research, status, source, experiment, draft, figure, review, rebuttal, lessons, and explicit-only auto.

The prompt hook selects hidden intake only for clear work requests. Intake routing is zero-write and never selects Auto. Slash commands keep their explicit routing.

When the user explicitly names Dove while giving feedback, criticism, correction, or an improvement request about it, or when Dove's own Skill, hook, project integration, routing, document behavior, or guidance actually fails during use, append a concise natural-language note to \`.dove/install/DOCTOR.md\`. When the user gives reusable feedback about ordinary research or collaboration without explicitly naming Dove, preserve it in the relevant Lessons Markdown instead. Preserve what happened, its user impact, and useful context. Do not create IDs, statuses, severity fields, counters, frontmatter, or a fixed template. Do not record ordinary research uncertainty, project bugs, external tool failures, or general conversation merely because Dove is active. Do not ask the user to run \`dove doctor\` for this feedback channel.
`;
}

export function renderClaudeAmbientSkill() {
  return `---
name: dove-intake
description: Route a clear work request to the smallest suitable Dove Skill.
user-invocable: false
---

# Dove intake

Select research, status, source, experiment, draft, figure, review, rebuttal, or lessons, then continue the user's request with normal host tools. Never select Auto. Routing itself is zero-write. Ask only when a material ambiguity blocks the work.
`;
}
