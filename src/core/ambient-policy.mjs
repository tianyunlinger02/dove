import { DOVE_AGENT_DIRECT_JUDGMENT } from "./dove-agent-persona.mjs";
import { USER_RESPONSE_POLICY } from "./user-response-policy.mjs";

const AMBIENT_CONTEXT = "Use hidden `dove-intake` for this request.";

const CONTEXT_FOLLOW_UP = /^(?:说人话|解释(?:一下|下)?|说明(?:一下|下)?|这是什么意思|什么意思|再(?:简短|简单|短|说一遍)|简短(?:一点|些)?|简单(?:一点|些)?|总结(?:一下|下)?|换个说法|重说(?:一遍)?|展开(?:一下|下)?|继续|接着来|下一步|确认|好的|明白|收到|谢谢|多谢|感谢|why|what does (?:this|that) mean|explain|summari[sz]e|shorter|simplify|say that again|continue|go on|next|ok|okay|got it|thanks)(?:[!！,.，。?？\s]*)$/iu;
const JUDGMENT_ONLY_INTENT = /(?:怎么办|接下来(?:呢|怎么办)?|下一步(?:是什么|呢|怎么办)?|继续吗|(?:要不要|该不该).*?(?:[?？]|$)|是否(?:需要|应该|要).*?(?:[?？]|$)|\bwhat now\b|\bwhat should (?:we|i) do\b|\b(?:do you think\s+)?should (?:we|i)\b|\bdo (?:we|i) need to\b)/iu;
const ENGLISH_WORK_ACTION = "(?:research|investigate|design|run|execute|benchmark|source|retrieve|read|verify|analy[sz]e|compare|draft|write|revise|plot|draw|review|rebut|respond|import|prepare|record|update|save|remember|reflect|retrospect|find|search|collect)";
const CHINESE_WORK_ACTION = "(?:研究|调研|设计|运行|执行|跑|获取|查找|查|寻找|找|搜索|检索|搜集|收集|阅读|核对|验证|分析|比较|审查|检查|起草|写|修改|修订|绘图|画|评审|审稿|回复|反驳|导入|准备|记录|更新|保存|记住|复盘|反思)";
const DOVE_WORK_ACTION = new RegExp(`(?:\\b${ENGLISH_WORK_ACTION}\\b|${CHINESE_WORK_ACTION})`, "iu");
const DOVE_WORK_DIRECTIVE = new RegExp(`^(?:${ENGLISH_WORK_ACTION}\\b\\s+|${CHINESE_WORK_ACTION}.+)|(?:\\b(?:please|can you|could you|would you|help me|help us|let'?s|we need to|i need you to|i want you to|i'd like you to)\\b|(?:帮我|请|请你|麻烦|帮忙|需要你|我们来|给我)|(?:把|将).*(?:写进|写到|记录到|更新到|保存到))`, "iu");
const DOVE_DOMAIN_OBJECT = /(?:\bdove\b|\bresearch\b|\bresearch (?:question|record|note|context|mainline|decision|claim|route|problem|result)\b|\bexperiment(?:al)?(?: result| note| plan| design| record| output)?\b|\bbenchmark(?: result| plan)?\b|\b(?:literature|papers?|manuscripts?|figures?|plots?|captions?|reviewer|review handoff|review return|review finding|review document|review prompt|review exchange|rebuttal|lessons?|claims?|missions?|hypothes(?:is|es)|citations?|evidence|sources?|source note|source material|results?)\b|(?:Dove|科研|研究|研究(?:问题|记录|主线|上下文|结论|决策)|实验(?:结果|记录|计划|文档)?|基准|文献|来源|论文|稿件|草稿|图表|绘图|(?:这|那|该|本)?张图|评审|审稿|回复审稿|反驳|经验|教训|主线|结论|决策|假设|引用|证据|结果))/iu;

export function isHighConfidenceAmbientWorkPrompt(prompt) {
  if (typeof prompt !== "string") return false;
  const normalized = prompt.normalize("NFKC").trim();
  if (!normalized || normalized.startsWith("/") || CONTEXT_FOLLOW_UP.test(normalized) || JUDGMENT_ONLY_INTENT.test(normalized)) return false;
  return DOVE_WORK_DIRECTIVE.test(normalized) && DOVE_WORK_ACTION.test(normalized) && DOVE_DOMAIN_OBJECT.test(normalized);
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

Dove is one complete research agent. Its ten flat Skills — research, status, source, experiment, draft, figure, review, rebuttal, lessons, and explicit-only auto — are capability entrances, not separate personas.

The prompt hook selects hidden intake only when the original user prompt is a clear Dove research work request. Intake routing is zero-write, may choose no Dove Skill for contextual follow-ups or judgment-only prompts, and never selects Auto. Slash commands keep their explicit routing. ${DOVE_AGENT_DIRECT_JUDGMENT}

When the user explicitly names Dove while giving feedback, criticism, correction, or an improvement request about it, or when Dove's own Skill, hook, project integration, routing, document behavior, or guidance actually fails during use, append a concise natural-language note to \`.dove/install/DOCTOR.md\`. When the user gives reusable feedback about ordinary research or collaboration without explicitly naming Dove, preserve it in the relevant Lessons Markdown instead. Do not write \`.dove/install/DOCTOR.md\` during a Stop-hook continuation. Preserve what happened, its user impact, and useful context. Do not create IDs, statuses, severity fields, counters, frontmatter, or a fixed template. Do not record ordinary research uncertainty, project bugs, external tool failures, or general conversation merely because Dove is active. Do not ask the user to run \`dove doctor\` for this feedback channel.
`;
}

export function renderClaudeAmbientSkill() {
  return `---
name: dove-intake
description: Route a clear work request to the smallest suitable Dove Skill.
user-invocable: false
---

# Dove intake

Select the smallest suitable Dove Skill only for a clear Dove research work request: research, status, source, experiment, draft, figure, review, rebuttal, or lessons. For contextual follow-ups, explanations, confirmations, or judgment-only prompts, choose no Dove Skill and answer directly; do not expand a short follow-up into a new research or experiment task. ${DOVE_AGENT_DIRECT_JUDGMENT} Never select Auto. Routing itself is zero-write. Ask only when a material ambiguity blocks the work.
`;
}
