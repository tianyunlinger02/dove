const AMBIENT_CONTEXT = "Use hidden `dove-intake` for one conservative check. Clarify material ambiguity once with zero writes. For clear work, explicitly choose research for changed understanding, experiments, evidence, or paper claims; otherwise ordinary for a clear deliverable. Call `create_ambient_dove_mission` first and continue only on success. Preserve any closure binding exactly once.";
const LESSONS_CONTEXT = "Use hidden `dove-lessons-intake` for this explicit Lessons request. Lessons maintenance creates no Mission. Follow the selected read, remember, or reflect flow using only `manage_dove_lessons`; keep the read binding and hash in their machine channel.";

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
  return `# Dove ambient mission entry

For a non-slash prompt selected by the project hook, apply the hidden skill named in its context. Explicit Lessons read, remember, or reflection requests use \`dove-lessons-intake\`, create no Mission, and use only \`manage_dove_lessons\`. Other selected work uses \`dove-intake\`: make a second conservative judgment, ask one zero-write clarification round only for material ambiguity, explicitly choose \`research\` when it changes research understanding, experiments, evidence, or paper claims, and choose \`ordinary\` for clear code, documentation, configuration, cleanup, or another bounded deliverable. Create only with \`create_ambient_dove_mission\` and keep the contract proportional to the user's request.

Call ambient intake before host execution. Continue the original task only after a successful create. If intake needs clarification, blocks, or fails, show its public report and stop instead of performing the work. Keep \`researchHandoff\` and \`hostControl\` in their machine channels. If a closure request is supplied after successful host work, invoke its tool exactly once with every supplied binding unchanged and the declared outcome fields and defaults.

Carry the Research Constitution into host work: protect truth, safety, evidence integrity, long-term value, and claim scope; use real resources and existing assets; preserve failures and uncertainty; never equate host return, tests, or internal audit with completion, independent review, or scientific authority.

Slash commands retain their explicit routing. Use public Dove tools rather than direct state or CLI access, and keep private mission and control data out of user-facing output.
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

1. Do not create a Mission and do not call \`create_ambient_dove_mission\`.
2. For a read request, call \`manage_dove_lessons\` once with \`operation=read\`, then present only its human \`report\`. Keep \`hostControl.lessonsDocument\` private.
3. For an explicit remember or save request, call \`manage_dove_lessons\` with \`operation=read\`; preserve the complete returned Markdown and the exact opaque \`hostControl.lessonsDocument.binding\`. Edit the complete Markdown conservatively under the existing five sections, then call \`manage_dove_lessons\` once with \`operation=update\`, the binding unchanged, and the complete replacement Markdown.
4. For an explicit reflection, retrospective, or experience-summary request, first perform the requested host reflection from the available conversation and project context without writing Dove state. Then read the current Lessons document, integrate only supported reusable guidance into the complete Markdown, and update it once with the exact read binding.
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
3. For clear new work, select one explicit \`mode\`: use \`research\` only when the work changes research understanding, experiments, evidence, or paper claims; use \`ordinary\` for clear code, documentation, configuration, cleanup, or another bounded deliverable. Ordinary work still aligns with the current Workspace mainline and is not rejected for low research value. Preserve the request and create only with \`create_ambient_dove_mission\` through Dove MCP. Keep the mission contract proportional. If evidence requirements are useful, format each as \`artifact:<path>\` or \`validation:<path>\`.
4. Call ambient intake before host execution. Resume the original task only after a successful create. If the result requests clarification, blocks, or fails, show only its public human \`report\` and stop. For success, follow \`hostControl.presentation\`, use \`researchHandoff\` as planning input, and keep both machine channels out of user-facing output.
5. Apply the Research Constitution proportionally: prioritize truth, safety, evidence integrity, and long-term value; use real resource facts and existing assets; preserve failed cases and uncertainty; keep claims within evidence; do not treat host return, tests, or internal audit as completion, independent review, or scientific authority.
6. After host execution, when \`hostControl.closureRequest\` is supplied, invoke its \`tool\` exactly once. Preserve its complete \`boundArgs\` binding unchanged, add the declared \`requiredOutcomeFields\`, apply declared \`defaults\` for omitted optional fields, and follow any supplied \`outcomeContract\` literally rather than inferring field values from prose.
7. Use public Dove MCP surfaces for this flow. Keep private mission and control data private, and leave direct Dove state and CLI access to the host integration.
`;
}
