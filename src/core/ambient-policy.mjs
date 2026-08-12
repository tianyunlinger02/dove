import { USER_RESPONSE_POLICY } from "./user-response-policy.mjs";

const AMBIENT_CONTEXT = "Use hidden `dove-intake` for zero-write role and Skill routing. Clarify material ambiguity once; otherwise choose the smallest ambient-eligible Skill and continue with ordinary host work. Auto is explicit-only and cannot be selected here. Do not create a research document merely because routing occurred or invoke a closure callback.";
const LESSONS_CONTEXT = "Use hidden `dove-lessons-intake` for this explicit Lessons request. Read or maintain `.dove/research/LESSONS.md` as one complete advisory Markdown document. Create no unrelated research document.";

const LESSONS_NEGATION = /(?:\b(?:do not|don't|dont|never|no need to|without)\b.{0,32}\b(?:remember|save|record|update|read|show|review|reflect|retrospect|summari[sz]e)\b|(?:不要|别|无需|不用|不必|禁止|莫).{0,24}(?:记住|保存|记录|更新|读取|查看|复盘|反思|总结))/iu;
const LESSONS_UNCERTAIN = /^(?:maybe|perhaps|possibly|i wonder|not sure|could we maybe|we might|也许|可能|不确定|考虑一下|要不要)/iu;
const LESSONS_QUESTION = /(?:[?？]\s*$|^(?:can|could|would|will)\s+you\b|^(?:能否|可以|能不能|是否))/iu;
const LESSONS_META_EXAMPLE = /(?:\b(?:example|e\.g\.|say|phrase|quoted?|means?|translate|rewrite)\b|(?:例子|示例|比如|这句话|引号|翻译|改写))/iu;
const LESSONS_QUOTE = /["'“”‘’「」『』]/u;
const LESSONS_READ = /^(?:(?:read|show|open|display|review|recall)\b.{0,40}\b(?:lessons?|experience|what we learned)\b|(?:读取|查看|看看|打开|展示|回顾|调取).{0,24}(?:经验|教训|Lessons|经验文档)|(?:经验|教训|Lessons|经验文档).{0,12}(?:读一下|看一下|给我看|展示))/iu;
const LESSONS_REMEMBER = /^(?:(?:remember|save|record|preserve)\b.{0,24}\b(?:this|the|our|my)?\s*(?:lesson|experience|learning|preference|practice)\b|(?:记住|保存|记录|留存|沉淀).{0,24}(?:这|该|本次|我们的|我的)?(?:条)?(?:经验|教训|心得|偏好|做法))/iu;
const LESSONS_REFLECT = /^(?:(?:reflect|retrospect|do a retrospective|summari[sz]e)\b.{0,40}\b(?:experience|lessons?|what we learned|learnings?)\b|(?:复盘|反思|回顾并总结|总结).{0,24}(?:这次|本次|我们的|项目的)?(?:经验|教训|心得|做法))/iu;

const CONVERSATIONAL_ONLY = new Set([
  "hi", "hello", "hey", "你好", "您好", "嗨",
  "thanks", "thank you", "谢谢", "多谢", "感谢",
  "ok", "okay", "got it", "sounds good", "好的", "明白", "收到", "同意", "批准", "确认",
  "continue", "go on", "proceed", "继续", "接着来", "下一步"
]);

function conversationalText(prompt) {
  return prompt.normalize("NFKC").trim().toLowerCase().replace(/[!！,.，。?？\s]+$/gu, "");
}

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
  return !CONVERSATIONAL_ONLY.has(conversationalText(normalized));
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

${USER_RESPONSE_POLICY.join("\n")}

Dove exposes 10 flat Skills: research, status, source, experiment, draft, figure, review, rebuttal, lessons, and auto. Auto is explicit-only; hidden intake cannot select it.

For selected non-slash prompts, apply the named hidden skill. Lessons requests use \`dove-lessons-intake\` and create no unrelated research document. Other work uses \`dove-intake\` for one conservative, zero-write choice among the nine ambient-eligible Skills: research, status, source, experiment, draft, figure, review, rebuttal, and lessons.

Ask one zero-write clarification round only for material ambiguity. Otherwise choose Planner, Builder/Author, or Reviewer responsibility and the smallest eligible Skill, then continue normal host work. Do not create a research document merely because routing occurred, emit a handoff, use private controls, invoke a closure callback, or route to Auto.

Carry the Research Constitution into host work: protect truth, safety, evidence integrity, long-term value, and claim scope; use real resources and existing assets; preserve failures and uncertainty; never equate host return, tests, local review, or internal audit with completion, independent review, or scientific authority.

Slash commands retain their explicit routing. Use host file and research tools directly; treat \`.dove/research/RESEARCH.md\` and linked Markdown as researcher-owned documents, not a database.
`;
}

export function renderClaudeLessonsIntakeSkill() {
  return `---
name: dove-lessons-intake
description: Read, remember, or reflect on the advisory Dove Lessons Markdown without creating unrelated research documents.
user-invocable: false
---

# Dove Lessons ambient entry

Use this hidden skill only for the current non-slash Lessons prompt selected by the project hook.

1. Do not create unrelated research documents.
2. Use \`.dove/research/LESSONS.md\` as one complete, ordinary advisory Markdown document.
3. For a read request, read the document directly and present the relevant content. If it is absent, say so naturally without creating it.
4. For an explicit remember or save request, read the complete Markdown when present, preserve its useful structure, integrate conservatively, and write the complete updated document. If no structure exists, organize it naturally for the content.
5. For an explicit reflection, retrospective, or experience-summary request, first perform the requested reflection, then integrate only supported reusable guidance into the complete Lessons document.
6. Lessons are advisory only. They are not evidence, authority, completion proof, research artifacts, or scientific judgment. Preserve uncertainty and do not invent experience.
7. Use host file tools directly. Do not introduce IDs, an application ledger, a schema, a database, or a hidden state service.
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

1. Route this selected non-slash prompt without reimplementing natural-language admission rules. The project hook already excludes empty, slash, and obvious pure-conversation prompts.
2. For material ambiguity in the goal, boundary, deliverable, or acceptance evidence, ask one concise zero-write clarification round. If the request remains unclear, explain that no work was started and stop.
3. Select the smallest ambient-eligible Skill: research, status, source, experiment, draft, figure, review, rebuttal, or lessons. Auto is explicit-only; never select it here. Use Planner for framing, Builder/Author for substantive work, and Reviewer only for a user-managed independent review exchange.
4. This routing is zero-write. Do not create a research document merely because a prompt was selected, and do not call any ambient-create, handoff, completion, Outcome, or closure surface.
5. Continue the original task with normal host behavior after routing. Draft, Figure, and Rebuttal produce ordinary project artifacts; they do not archive an Outcome.
6. Apply the Research Constitution proportionally: prioritize truth, safety, evidence integrity, and long-term value; use real resource facts and existing assets; preserve failed cases and uncertainty; keep claims within evidence; do not treat host return, tests, local review, or internal audit as completion, independent review, or scientific authority.
7. Use host file and research tools directly. When research context is useful, read \`.dove/research/RESEARCH.md\` and only the relevant linked documents. Do not introduce IDs, fixed schemas, a database, or a hidden state service.
`;
}
