#!/usr/bin/env node
import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);

// src/core/user-response-policy.mjs
var USER_RESPONSE_POLICY = Object.freeze([
  "Use natural, clear Chinese unless the user requests another language or format; explain internal terms only when needed.",
  "Before sending, reorganize from the user's perspective into a faithful synthesis. Do not use the internal workflow or structured machine data as the response outline; remove repetition and preserve material failures, limits, uncertainty, and blockers.",
  "Requested research artifacts and strict machine-readable contracts take priority; otherwise fit the response to the task, not a fixed template."
]);

// src/core/ambient-policy.mjs
var AMBIENT_CONTEXT = "Use hidden `dove-intake` for zero-write role and Skill routing. Clarify material ambiguity once; otherwise choose the smallest ambient-eligible Skill and continue with ordinary host work. Auto is explicit-only and cannot be selected here. Do not create a research document merely because routing occurred or invoke a closure callback.";
var LESSONS_CONTEXT = "Use hidden `dove-lessons-intake` for this explicit Lessons request. Read or maintain `.dove/research/LESSONS.md` as one complete advisory Markdown document. Create no unrelated research document.";
var LESSONS_NEGATION = /(?:\b(?:do not|don't|dont|never|no need to|without)\b.{0,32}\b(?:remember|save|record|update|read|show|review|reflect|retrospect|summari[sz]e)\b|(?:不要|别|无需|不用|不必|禁止|莫).{0,24}(?:记住|保存|记录|更新|读取|查看|复盘|反思|总结))/iu;
var LESSONS_UNCERTAIN = /^(?:maybe|perhaps|possibly|i wonder|not sure|could we maybe|we might|也许|可能|不确定|考虑一下|要不要)/iu;
var LESSONS_QUESTION = /(?:[?？]\s*$|^(?:can|could|would|will)\s+you\b|^(?:能否|可以|能不能|是否))/iu;
var LESSONS_META_EXAMPLE = /(?:\b(?:example|e\.g\.|say|phrase|quoted?|means?|translate|rewrite)\b|(?:例子|示例|比如|这句话|引号|翻译|改写))/iu;
var LESSONS_QUOTE = /["'“”‘’「」『』]/u;
var LESSONS_READ = /^(?:(?:read|show|open|display|review|recall)\b.{0,40}\b(?:lessons?|experience|what we learned)\b|(?:读取|查看|看看|打开|展示|回顾|调取).{0,24}(?:经验|教训|Lessons|经验文档)|(?:经验|教训|Lessons|经验文档).{0,12}(?:读一下|看一下|给我看|展示))/iu;
var LESSONS_REMEMBER = /^(?:(?:remember|save|record|preserve)\b.{0,24}\b(?:this|the|our|my)?\s*(?:lesson|experience|learning|preference|practice)\b|(?:记住|保存|记录|留存|沉淀).{0,24}(?:这|该|本次|我们的|我的)?(?:条)?(?:经验|教训|心得|偏好|做法))/iu;
var LESSONS_REFLECT = /^(?:(?:reflect|retrospect|do a retrospective|summari[sz]e)\b.{0,40}\b(?:experience|lessons?|what we learned|learnings?)\b|(?:复盘|反思|回顾并总结|总结).{0,24}(?:这次|本次|我们的|项目的)?(?:经验|教训|心得|做法))/iu;
var CONVERSATIONAL_ONLY = /* @__PURE__ */ new Set([
  "hi",
  "hello",
  "hey",
  "\u4F60\u597D",
  "\u60A8\u597D",
  "\u55E8",
  "thanks",
  "thank you",
  "\u8C22\u8C22",
  "\u591A\u8C22",
  "\u611F\u8C22",
  "ok",
  "okay",
  "got it",
  "sounds good",
  "\u597D\u7684",
  "\u660E\u767D",
  "\u6536\u5230",
  "\u540C\u610F",
  "\u6279\u51C6",
  "\u786E\u8BA4",
  "continue",
  "go on",
  "proceed",
  "\u7EE7\u7EED",
  "\u63A5\u7740\u6765",
  "\u4E0B\u4E00\u6B65"
]);
function conversationalText(prompt) {
  return prompt.normalize("NFKC").trim().toLowerCase().replace(/[!！,.，。?？\s]+$/gu, "");
}
function requestBody(prompt) {
  return prompt.normalize("NFKC").trim().replace(/^(?:please\s+|please can you\s+|can you\s+|could you\s+|would you\s+|will you\s+|i need you to\s+|i want you to\s+|请(?:你|您)?\s*|麻烦(?:你|您)?\s*|请帮(?:我|忙)\s*|帮我\s*|能否\s*|可以帮我\s*)/iu, "").trimStart();
}
function classifyLessonsIntent(prompt) {
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
function isHighConfidenceAmbientWorkPrompt(prompt) {
  if (typeof prompt !== "string") return false;
  const normalized = prompt.normalize("NFKC").trim();
  if (!normalized || normalized.startsWith("/")) return false;
  return !CONVERSATIONAL_ONLY.has(conversationalText(normalized));
}
var DOVE_CLAUDE_AMBIENT_HOOK_COMMAND = 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"';
var DOVE_CLAUDE_AMBIENT_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([
    Object.freeze({
      type: "command",
      command: DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
      timeout: 10
    })
  ])
});
function lessonsContextForPrompt(prompt) {
  return classifyLessonsIntent(prompt) === null ? null : LESSONS_CONTEXT;
}
function ambientContextForPrompt(prompt) {
  return isHighConfidenceAmbientWorkPrompt(prompt) ? AMBIENT_CONTEXT : null;
}

// src/core/ambient-hook.mjs
function parseHookPayload(input2) {
  let payload;
  try {
    payload = JSON.parse(input2);
  } catch {
    throw new Error("Dove UserPromptSubmit hook received malformed JSON.");
  }
  if (payload?.hook_event_name !== "UserPromptSubmit") {
    throw new Error("Dove UserPromptSubmit hook received an unsupported or missing hook event.");
  }
  if (typeof payload?.prompt !== "string") {
    throw new Error("Dove UserPromptSubmit hook requires a string prompt.");
  }
  return payload;
}
function userPromptSubmitOutput(input2) {
  const payload = parseHookPayload(input2);
  const additionalContext = lessonsContextForPrompt(payload.prompt) ?? ambientContextForPrompt(payload.prompt);
  if (additionalContext === null) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext
    }
  };
}

// scripts/dove-user-prompt-submit.mjs
var input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;
try {
  const output = userPromptSubmitOutput(input);
  if (output !== null) process.stdout.write(JSON.stringify(output));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}
`);
  process.exit(1);
}
