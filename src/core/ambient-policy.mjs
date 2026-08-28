import {
  DOVE_RESEARCH_AUTO_EXPLICIT_ONLY,
  DOVE_RESEARCH_DIRECT_JUDGMENT,
  DOVE_RESEARCH_FLAT_SKILL_SENTENCE,
  DOVE_RESEARCH_ONE_AGENT,
  DOVE_RESEARCH_ROUTABLE_SKILL_INVENTORY_TEXT
} from "./dove-research-contract.mjs";
import { USER_RESPONSE_POLICY } from "./user-response-policy.mjs";

const AMBIENT_CONTEXT = "Use hidden `dove-intake` for this request.";

const CONTEXT_FOLLOW_UP = /^(?:说人话|解释(?:一下|下)?|说明(?:一下|下)?|这是什么意思|什么意思|再(?:简短|简单|短|说一遍)|简短(?:一点|些)?|简单(?:一点|些)?|总结(?:一下|下)?|换个说法|重说(?:一遍)?|展开(?:一下|下)?|继续|接着来|下一步|确认|好的|明白|收到|谢谢|多谢|感谢|why|what does (?:this|that) mean|explain|summari[sz]e|shorter|simplify|say that again|continue|go on|next|ok|okay|got it|thanks)(?:[!！,.，。?？\s]*)$/iu;
const JUDGMENT_ONLY_INTENT = /(?:怎么办|接下来(?:呢|怎么办)?|下一步(?:是什么|呢|怎么办)?|继续吗|(?:要不要|该不该).*?(?:[?？]|$)|是否(?:需要|应该|要).*?(?:[?？]|$)|\bwhat now\b|\bwhat should (?:we|i) do\b|\b(?:do you think\s+)?should (?:we|i)\b|\bdo (?:we|i) need to\b)/iu;
const JUDGMENT_WITH_WORK_INTENT = /(?:如果(?:需要|值得|有用|应该|该).*?(?:就|直接)?(?:做|跑|执行|查|检索|验证|检查|测试|修改|修订|记录|写|画|实现)|需要(?:的话|就).*?(?:做|跑|执行|查|检索|验证|检查|测试|修改|修订|记录|写|画|实现)|判断.*?(?:需要|值得|应该|该).*?(?:就|直接)?(?:做|跑|执行|查|检索|验证|检查|测试|修改|修订|记录|写|画|实现)|\b(?:if|when)\s+(?:needed|useful|worthwhile|appropriate|yes)\b.*?\b(?:do|run|execute|check|verify|test|search|retrieve|write|record|fix|revise|implement|plot|draw)\b|\b(?:judge|decide|determine)\b.*?\b(?:then|and)\b.*?\b(?:do|run|execute|check|verify|test|search|retrieve|write|record|fix|revise|implement|plot|draw)\b)/iu;
const ENGLISH_WORK_ACTION = "(?:research|investigate|design|run|execute|benchmark|source|retrieve|read|verify|test|diagnose|audit|critique|review|evaluate|replicate|reproduce|ablate|derive|prove|model|optimi[sz]e|implement|analy[sz]e|compare|draft|write|revise|plot|draw|rebut|respond|import|prepare|record|update|save|remember|reflect|retrospect|find|search|collect)";
const CHINESE_WORK_ACTION = "(?:研究|调研|设计|运行|执行|跑|获取|查找|查|寻找|找|搜索|检索|搜集|收集|阅读|核对|验证|测试|诊断|审查|检查|审阅|批判|分析|比较|评估|复现|重复|消融|推导|证明|建模|实现|优化|起草|写|修改|修订|绘图|画|评审|审稿|回复|反驳|导入|准备|记录|更新|保存|记住|复盘|反思)";
const DOVE_WORK_ACTION = new RegExp(`(?:\\b${ENGLISH_WORK_ACTION}\\b|${CHINESE_WORK_ACTION})`, "iu");
const DOVE_WORK_DIRECTIVE = new RegExp(`^(?:${ENGLISH_WORK_ACTION}\\b\\s+|${CHINESE_WORK_ACTION}.+)|(?:\\b(?:please|can you|could you|would you|help me|help us|let'?s|we need to|i need you to|i want you to|i'd like you to)\\b|(?:帮我|请|请你|麻烦|帮忙|需要你|我们来|给我)|(?:把|将).*(?:写进|写到|记录到|更新到|保存到))`, "iu");
const DOVE_DOMAIN_OBJECT = /(?:\bdove\b|\bresearch\b|\bresearch (?:question|record|note|context|mainline|decision|claim|route|problem|result)\b|\bexperiment(?:al)?(?: result| note| plan| design| record| output)?\b|\bbenchmark(?: result| plan)?\b|\b(?:literature|papers?|manuscripts?|figures?|plots?|captions?|reviewer|review handoff|review return|review finding|review document|review prompt|review exchange|rebuttal|lessons?|claims?|missions?|hypothes(?:is|es)|citations?|evidence|sources?|source note|source material|results?|methods?|protocols?|baselines?|datasets?|metrics?|algorithms?|models?|ablations?|evaluations?)\b|(?:Dove|科研|研究|研究(?:问题|记录|主线|上下文|结论|决策)|实验(?:结果|记录|计划|文档)?|基准|文献|来源|论文|稿件|草稿|图表|绘图|(?:这|那|该|本)?张图|评审|审稿|回复审稿|反驳|经验|教训|主线|结论|决策|假设|引用|证据|结果|方法|协议|数据集|指标|算法|模型|消融|评估|复现))/iu;

export function isHighConfidenceAmbientWorkPrompt(prompt) {
  if (typeof prompt !== "string") return false;
  const normalized = prompt.normalize("NFKC").trim();
  if (!normalized || normalized.startsWith("/") || CONTEXT_FOLLOW_UP.test(normalized)) return false;
  const hasWork = DOVE_WORK_ACTION.test(normalized) && DOVE_DOMAIN_OBJECT.test(normalized);
  if (JUDGMENT_ONLY_INTENT.test(normalized) && !JUDGMENT_WITH_WORK_INTENT.test(normalized)) return false;
  if (JUDGMENT_WITH_WORK_INTENT.test(normalized)) return hasWork;
  return DOVE_WORK_DIRECTIVE.test(normalized) && hasWork;
}

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
  return isHighConfidenceAmbientWorkPrompt(prompt) ? AMBIENT_CONTEXT : null;
}

export function renderClaudeAmbientRule() {
  return `# Dove

${USER_RESPONSE_POLICY.join("\n")}

${DOVE_RESEARCH_ONE_AGENT} ${DOVE_RESEARCH_FLAT_SKILL_SENTENCE}

The prompt hook selects hidden intake only when the original user prompt is a clear Dove work request involving research, papers, sources, experiments, drafts, figures, reviews, rebuttals, lessons, or research-adjacent project work. Intake routing is zero-write, may choose no Dove Skill for contextual follow-ups or judgment-only prompts, and never selects Auto. Before routing, the PATH-installed Dove CLI may transactionally hot-sync package-managed project integration only; it never touches \`.dove/research/\`. Dove does not install or rely on a Stop hook; Stop does not drive research continuity, routing, tools, writes, scheduling, or plain-language second turns. Slash commands keep their explicit routing. ${DOVE_RESEARCH_DIRECT_JUDGMENT}

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

Select the smallest suitable Dove Skill only for a clear Dove work request involving research, papers, sources, experiments, drafts, figures, reviews, rebuttals, lessons, or research-adjacent project work: ${DOVE_RESEARCH_ROUTABLE_SKILL_INVENTORY_TEXT}. For contextual follow-ups, explanations, confirmations, or pure judgment-only prompts, choose no Dove Skill and answer directly; do not expand a short follow-up into a new research or experiment task. If the prompt asks Dove to judge and then perform the bounded action when useful, route the bounded work instead of treating it as pure judgment. ${DOVE_RESEARCH_DIRECT_JUDGMENT} ${DOVE_RESEARCH_AUTO_EXPLICIT_ONLY} Routing itself is zero-write. Ask only when a material ambiguity blocks the work.
`;
}
