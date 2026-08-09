import { PUBLIC_RESPONSE_CAPSULE } from "./command-manifest.mjs";

const AMBIENT_CONTEXT = "Use hidden `dove-intake` for zero-write role and Skill routing. Clarify material ambiguity once; otherwise choose the smallest flat Skill and continue with ordinary host work. Do not create a Mission or invoke a closure callback.";
const LESSONS_CONTEXT = "Use hidden `dove-lessons-intake` for this explicit Lessons request. Use only `manage_dove_lessons`: read by default, or replace the complete document after an explicit remember or reflection request. Create no Mission.";

const LESSONS_NEGATION = /(?:\b(?:do not|don't|dont|never|no need to|without)\b.{0,32}\b(?:remember|save|record|update|read|show|review|reflect|retrospect|summari[sz]e)\b|(?:不要|别|无需|不用|不必|禁止|莫).{0,24}(?:记住|保存|记录|更新|读取|查看|复盘|反思|总结))/iu;
const LESSONS_UNCERTAIN = /^(?:maybe|perhaps|possibly|i wonder|not sure|could we maybe|we might|也许|可能|不确定|考虑一下|要不要)/iu;
const LESSONS_QUESTION = /(?:[?？]\s*$|^(?:can|could|would|will)\s+you\b|^(?:能否|可以|能不能|是否))/iu;
const LESSONS_META_EXAMPLE = /(?:\b(?:example|e\.g\.|say|phrase|quoted?|means?|translate|rewrite)\b|(?:例子|示例|比如|这句话|引号|翻译|改写))/iu;
const LESSONS_QUOTE = /["'“”‘’「」『』]/u;
const LESSONS_READ = /^(?:(?:read|show|open|display|review|recall)\b.{0,40}\b(?:lessons?|experience|what we learned)\b|(?:读取|查看|看看|打开|展示|回顾|调取).{0,24}(?:经验|教训|Lessons|经验文档)|(?:经验|教训|Lessons|经验文档).{0,12}(?:读一下|看一下|给我看|展示))/iu;
const LESSONS_REMEMBER = /^(?:(?:remember|save|record|preserve)\b.{0,24}\b(?:this|the|our|my)?\s*(?:lesson|experience|learning|preference|practice)\b|(?:记住|保存|记录|留存|沉淀).{0,24}(?:这|该|本次|我们的|我的)?(?:条)?(?:经验|教训|心得|偏好|做法))/iu;
const LESSONS_REFLECT = /^(?:(?:reflect|retrospect|do a retrospective|summari[sz]e)\b.{0,40}\b(?:experience|lessons?|what we learned|learnings?)\b|(?:复盘|反思|回顾并总结|总结).{0,24}(?:这次|本次|我们的|项目的)?(?:经验|教训|心得|做法))/iu;

const CONVERSATIONAL_ONLY = [
  /^(?:hi|hello|hey|good (?:morning|afternoon|evening)|你好|您好|嗨|早上好|下午好|晚上好)[!！,.，。\s]*$/iu,
  /^(?:thanks?|thank you|many thanks|谢谢|多谢|感谢(?:你|您)?)[!！,.，。\s]*$/iu,
  /^(?:ok(?:ay)?|got it|sounds good|understood|yes|yep|sure|approved?|approve|confirmed?|confirm|agreed?|agree|好的?|可以|行|明白|收到|同意|批准|确认)[!！,.，。\s]*$/iu,
  /^(?:continue|go on|proceed|keep going|carry on|next|do it|make it so|继续(?:吧|一下|上一个|上一项|刚才的)?|接着(?:来|做)?|下一步|照做|就这么做|执行吧|开始吧)[!！,.，。\s]*$/iu
];

const STATUS_ONLY = [
  /^(?:what(?:'s| is) the (?:status|progress)|how(?:'s| is) (?:it|the work) going|where are we|any updates?|status\??|progress\??)/iu,
  /^(?:状态|进展|进度|当前进度|现在|目前|任务).{0,12}(?:如何|怎么样|到哪(?:了)?|完成了吗|有更新吗|呢|吗)?[?？!！,.，。\s]*$/u,
  /^(?:做到哪(?:了)?|进度如何|进展怎么样|现在怎么样|有进展吗)[?？!！,.，。\s]*$/u
];

const UNCERTAIN_ONLY = /^(?:maybe|perhaps|possibly|i wonder|i(?:'m| am) not sure|not sure|should we|could we maybe|we might|考虑一下|也许|可能|不确定|不知道要不要|要不要|是不是可以)/iu;
const CONTINUATION_FOLLOW_UP = /^(?:continue|go on|proceed|keep going|carry on|pick up|resume|do it|make it so|继续|接着|延续|沿用|按刚才|还是刚才|上一项|上一个|照做|就这么做|执行吧|开始吧)/iu;
const EXPLANATION_OR_QUESTION = /^(?:why|what|when|where|who|which|how(?:\s+(?:do|does|did|can|could|should|would|is|are|was|were))?|explain|describe|tell me (?:why|how|what|about)|can you explain|could you explain|为什么|什么是|何时|哪里|谁|哪个|怎么(?:做|用|理解|回事)?|如何(?:理解|看待|工作)?|解释|说明一下|介绍一下|告诉我(?:为什么|怎么|什么))/iu;
const READ_ONLY_REVIEW = /^(?:review|inspect|assess|evaluate|audit|look (?:at|over)|read|summari[sz]e|check|审阅|评审|检查|查看|看看|阅读|总结|评估|审计|分析)/iu;

const DIRECT_DELIVERABLE = /^(?:implement|create|add|write|draft|build|generate|produce|modify|update|edit|fix|repair|patch|refactor|remove|delete|rename|migrate|install|configure|integrate|replace|convert|publish|deploy|export|save|实现|创建|新建|添加|编写|撰写|起草|构建|生成|制作|产出|修改|更新|编辑|修复|修补|重构|移除|删除|重命名|迁移|安装|配置|集成|替换|转换|发布|部署|导出|保存)(?:\b|(?=\p{Script=Han}))/iu;
const BOUNDED_EXECUTION = /^(?:(?:run|execute|perform|conduct|rerun)\b.{0,80}\b(?:test(?:s|ing)?|experiment|benchmark|ablation|migration|script|command|validation|build|suite)\b|(?:运行|执行|开展|进行|重跑).{0,40}(?:测试|实验|基准|消融|迁移|脚本|命令|验证|构建))/iu;
const ACCEPTABLE_NEW_TASK = /^(?:(?:investigate|debug|reproduce|diagnose|research)\b.{0,160}\b(?:and|then)\b.{0,80}\b(?:identify|determine|document|write|produce|fix|return|deliver|save)\b|(?:调查|排查|调试|复现|诊断|研究).{0,80}(?:并|然后|并且).{0,40}(?:确定|识别|记录|写|产出|修复|给出|交付|保存))/iu;
const COMPOUND_DELIVERABLE = /(?:\b(?:and|then)\s+(?:implement|create|add|write|draft|build|generate|produce|modify|update|edit|fix|patch|refactor|remove|delete|rename|save)\b|(?:并|然后|并且)(?:实现|创建|新建|添加|编写|撰写|生成|制作|产出|修改|更新|编辑|修复|重构|移除|删除|重命名|保存))/iu;

function requestBody(prompt) {
  return prompt
    .normalize("NFKC")
    .trim()
    .replace(/^(?:please\s+|please can you\s+|can you\s+|could you\s+|would you\s+|will you\s+|i need you to\s+|i want you to\s+|请(?:你|您)?\s*|麻烦(?:你|您)?\s*|请帮(?:我|忙)\s*|帮我\s*|能否\s*|可以帮我\s*)/iu, "")
    .trimStart();
}

export function classifyLessonsIntent(prompt) {
  if (typeof prompt !== "string") return null;
  const normalized = prompt.normalize("NFKC").trim();
  if (!normalized || normalized.startsWith("/") || LESSONS_QUESTION.test(normalized)) return null;
  const body = requestBody(normalized);
  if (!body || LESSONS_NEGATION.test(body) || LESSONS_UNCERTAIN.test(body)) return null;
  if (LESSONS_META_EXAMPLE.test(body) || LESSONS_QUOTE.test(body)) return null;
  if (LESSONS_REMEMBER.test(body)) return "remember";
  if (LESSONS_REFLECT.test(body)) return "reflect";
  if (LESSONS_READ.test(body)) return "read";
  return null;
}

export function isHighConfidenceAmbientWorkPrompt(prompt) {
  if (typeof prompt !== "string") return false;
  const normalized = prompt.normalize("NFKC").trim();
  if (!normalized || normalized.startsWith("/")) return false;
  if (CONVERSATIONAL_ONLY.some((pattern) => pattern.test(normalized))) return false;
  if (STATUS_ONLY.some((pattern) => pattern.test(normalized))) return false;

  const body = requestBody(normalized);
  if (!body || CONTINUATION_FOLLOW_UP.test(body) || UNCERTAIN_ONLY.test(body)) return false;
  if (EXPLANATION_OR_QUESTION.test(body)) return false;
  if (READ_ONLY_REVIEW.test(body) && !COMPOUND_DELIVERABLE.test(body)) return false;
  return DIRECT_DELIVERABLE.test(body)
    || BOUNDED_EXECUTION.test(body)
    || ACCEPTABLE_NEW_TASK.test(body)
    || COMPOUND_DELIVERABLE.test(body);
}

export const DOVE_CLAUDE_SETTINGS_PATH = ".claude/settings.json";
export const DOVE_CLAUDE_AMBIENT_RULE_PATH = ".claude/rules/dove.md";
export const DOVE_CLAUDE_AMBIENT_SKILL_PATH = ".claude/skills/dove-intake/SKILL.md";
export const DOVE_CLAUDE_LESSONS_SKILL_PATH = ".claude/skills/dove-lessons-intake/SKILL.md";
export const DOVE_CLAUDE_AMBIENT_HOOK_COMMAND = 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"';
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

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameKeys(value, keys) {
  return plainObject(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function isExactManagedHook(value) {
  if (!sameKeys(value, ["hooks"]) || !Array.isArray(value.hooks) || value.hooks.length !== 1) return false;
  const hook = value.hooks[0];
  return sameKeys(hook, ["command", "timeout", "type"])
    && hook.type === "command"
    && hook.command === DOVE_CLAUDE_AMBIENT_HOOK_COMMAND
    && hook.timeout === 10;
}

function referencesManagedHook(value) {
  if (!plainObject(value) || !Array.isArray(value.hooks)) return false;
  return value.hooks.some((hook) => plainObject(hook)
    && typeof hook.command === "string"
    && (hook.command.includes("dove hook user-prompt-submit")
      || hook.command.includes("dove-user-prompt-submit-package.mjs")));
}

export function mergeClaudeAmbientSettings(settings) {
  if (!plainObject(settings)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} must contain a JSON object.`);
  if (settings.hooks !== undefined && !plainObject(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const hooks = settings.hooks ?? {};
  const promptHooks = hooks.UserPromptSubmit;
  if (promptHooks !== undefined && !Array.isArray(promptHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.UserPromptSubmit must be an array.`);

  const entries = promptHooks ?? [];
  const exactEntries = entries.filter(isExactManagedHook);
  const conflictingEntries = entries.filter((entry) => referencesManagedHook(entry) && !isExactManagedHook(entry));
  if (exactEntries.length > 1 || conflictingEntries.length > 0) {
    throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} already defines a conflicting Dove-managed UserPromptSubmit hook.`);
  }
  if (exactEntries.length === 1) return { settings, changed: false };

  return {
    settings: {
      ...settings,
      hooks: {
        ...hooks,
        UserPromptSubmit: [...entries, DOVE_CLAUDE_AMBIENT_HOOK_ENTRY]
      }
    },
    changed: true
  };
}

export function lessonsContextForPrompt(prompt) {
  return classifyLessonsIntent(prompt) === null ? null : LESSONS_CONTEXT;
}

export function ambientContextForPrompt(prompt) {
  return isHighConfidenceAmbientWorkPrompt(prompt) ? AMBIENT_CONTEXT : null;
}

export function renderClaudeAmbientRule() {
  return `# Dove ambient role and Skill routing

${PUBLIC_RESPONSE_CAPSULE.join("\n")}

For a non-slash prompt selected by the project hook, apply the hidden skill named in its context. Explicit Lessons read, remember, or reflection requests use \`dove-lessons-intake\`, create no Mission, and use only \`manage_dove_lessons\`. Other selected work uses \`dove-intake\` for a second conservative, zero-write routing judgment across the flat Skills: research, status, source, experiment, draft, figure, review, rebuttal, and lessons.

Ask one zero-write clarification round only for material ambiguity. Otherwise select Planner, Builder/Author, or Reviewer responsibility and the smallest matching Skill, then continue with normal host work. Do not create an ambient Mission, emit a handoff, consume private controls, or invoke a closure callback.

Carry the Research Constitution into host work: protect truth, safety, evidence integrity, long-term value, and claim scope; use real resources and existing assets; preserve failures and uncertainty; never equate host return, tests, local review, or internal audit with completion, independent review, or scientific authority.

Slash commands retain their explicit routing. Use public Dove tools rather than direct state or CLI access.
`;
}

export function renderClaudeLessonsIntakeSkill() {
  return `---
name: dove-lessons-intake
description: Read, remember, or reflect on the canonical Dove Lessons document without creating a Mission.
user-invocable: false
---

# Dove Lessons ambient entry

Use this hidden skill only for the current non-slash Lessons prompt selected by the project hook.

1. Do not create a Mission.
2. For a read request, call \`manage_dove_lessons\` once with \`operation=read\` and present its human text.
3. For an explicit remember or save request, read the complete Markdown, preserve its existing structure and integrate conservatively, then call \`manage_dove_lessons\` once with \`operation=replace\` and the complete replacement Markdown. If no structure exists, organize the document naturally for the content.
4. For an explicit reflection, retrospective, or experience-summary request, first perform the requested host reflection without writing Dove state. Then read the current Lessons document, integrate only supported reusable guidance, and replace it once.
5. Lessons are advisory only. They are not evidence, authority, completion proof, Mission artifacts, or scientific judgment. Preserve uncertainty and do not invent experience.
6. Use only public Dove MCP surfaces for Lessons maintenance. Keep machine channels private; do not use CLI, shell, or direct Dove state access as a fallback.
`;
}

export function renderClaudeAmbientSkill() {
  return `---
name: dove-intake
description: Enter a clear ordinary or research work request into Dove without requiring a slash command.
user-invocable: false
---

# Dove ambient entry

Use this hidden skill only for the current non-slash prompt selected by the project hook.

1. Make a second conservative judgment. Continue with normal host behavior unless the prompt clearly starts new work with an identifiable outcome.
2. For material ambiguity in the goal, boundary, deliverable, or acceptance evidence, ask one concise zero-write clarification round. If the request remains unclear, explain that no work was started and stop.
3. For clear work, select the smallest flat Skill: research, status, source, experiment, draft, figure, review, rebuttal, or lessons. Select Planner for framing, Builder/Author for substantive work, and Reviewer only for a user-managed independent review exchange.
4. This routing is zero-write. Do not create a Mission merely because a prompt was selected, and do not call any ambient-create, handoff, completion, Outcome, or closure surface.
5. Continue the original task with normal host behavior after routing. Draft, Figure, and Rebuttal produce ordinary project artifacts; they do not archive an Outcome.
6. Apply the Research Constitution proportionally: prioritize truth, safety, evidence integrity, and long-term value; use real resource facts and existing assets; preserve failed cases and uncertainty; keep claims within evidence; do not treat host return, tests, local review, or internal audit as completion, independent review, or scientific authority.
7. Use public Dove MCP research surfaces only when durable research state is actually needed. Do not use CLI, shell, or direct Dove state access as a fallback.
`;
}
