#!/usr/bin/env node
import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);

// src/core/ambient-policy.mjs
var AMBIENT_CONTEXT = "Use hidden `dove-intake` for one conservative check. Clarify material ambiguity once with zero writes. For clear work, explicitly choose research for changed understanding, experiments, evidence, or paper claims; otherwise ordinary for a clear deliverable. Call `create_ambient_dove_mission` first and continue only on success. Preserve any closure binding exactly once.";
var LESSONS_CONTEXT = "Use hidden `dove-lessons-intake` for this explicit Lessons request. Lessons maintenance creates no Mission. Follow the selected read, remember, or reflect flow using only `manage_dove_lessons`; keep the read binding and hash in their machine channel.";
var LESSONS_NEGATION = /(?:\b(?:do not|don't|dont|never|no need to|without)\b.{0,32}\b(?:remember|save|record|update|read|show|review|reflect|retrospect|summari[sz]e)\b|(?:不要|别|无需|不用|不必|禁止|莫).{0,24}(?:记住|保存|记录|更新|读取|查看|复盘|反思|总结))/iu;
var LESSONS_UNCERTAIN = /^(?:maybe|perhaps|possibly|i wonder|not sure|could we maybe|we might|也许|可能|不确定|考虑一下|要不要)/iu;
var LESSONS_QUESTION = /(?:[?？]\s*$|^(?:can|could|would|will)\s+you\b|^(?:能否|可以|能不能|是否))/iu;
var LESSONS_META_EXAMPLE = /(?:\b(?:example|e\.g\.|say|phrase|quoted?|means?|translate|rewrite)\b|(?:例子|示例|比如|这句话|引号|翻译|改写))/iu;
var LESSONS_QUOTE = /["'“”‘’「」『』]/u;
var LESSONS_READ = /^(?:(?:read|show|open|display|review|recall)\b.{0,40}\b(?:lessons?|experience|what we learned)\b|(?:读取|查看|看看|打开|展示|回顾|调取).{0,24}(?:经验|教训|Lessons|经验文档)|(?:经验|教训|Lessons|经验文档).{0,12}(?:读一下|看一下|给我看|展示))/iu;
var LESSONS_REMEMBER = /^(?:(?:remember|save|record|preserve)\b.{0,24}\b(?:this|the|our|my)?\s*(?:lesson|experience|learning|preference|practice)\b|(?:记住|保存|记录|留存|沉淀).{0,24}(?:这|该|本次|我们的|我的)?(?:条)?(?:经验|教训|心得|偏好|做法))/iu;
var LESSONS_REFLECT = /^(?:(?:reflect|retrospect|do a retrospective|summari[sz]e)\b.{0,40}\b(?:experience|lessons?|what we learned|learnings?)\b|(?:复盘|反思|回顾并总结|总结).{0,24}(?:这次|本次|我们的|项目的)?(?:经验|教训|心得|做法))/iu;
var CONVERSATIONAL_ONLY = [
  /^(?:hi|hello|hey|good (?:morning|afternoon|evening)|你好|您好|嗨|早上好|下午好|晚上好)[!！,.，。\s]*$/iu,
  /^(?:thanks?|thank you|many thanks|谢谢|多谢|感谢(?:你|您)?)[!！,.，。\s]*$/iu,
  /^(?:ok(?:ay)?|got it|sounds good|understood|yes|yep|sure|approved?|approve|confirmed?|confirm|agreed?|agree|好的?|可以|行|明白|收到|同意|批准|确认)[!！,.，。\s]*$/iu,
  /^(?:continue|go on|proceed|keep going|carry on|next|do it|make it so|继续(?:吧|一下|上一个|上一项|刚才的)?|接着(?:来|做)?|下一步|照做|就这么做|执行吧|开始吧)[!！,.，。\s]*$/iu
];
var STATUS_ONLY = [
  /^(?:what(?:'s| is) the (?:status|progress)|how(?:'s| is) (?:it|the work) going|where are we|any updates?|status\??|progress\??)/iu,
  /^(?:状态|进展|进度|当前进度|现在|目前|任务).{0,12}(?:如何|怎么样|到哪(?:了)?|完成了吗|有更新吗|呢|吗)?[?？!！,.，。\s]*$/u,
  /^(?:做到哪(?:了)?|进度如何|进展怎么样|现在怎么样|有进展吗)[?？!！,.，。\s]*$/u
];
var UNCERTAIN_ONLY = /^(?:maybe|perhaps|possibly|i wonder|i(?:'m| am) not sure|not sure|should we|could we maybe|we might|考虑一下|也许|可能|不确定|不知道要不要|要不要|是不是可以)/iu;
var CONTINUATION_FOLLOW_UP = /^(?:continue|go on|proceed|keep going|carry on|pick up|resume|do it|make it so|继续|接着|延续|沿用|按刚才|还是刚才|上一项|上一个|照做|就这么做|执行吧|开始吧)/iu;
var EXPLANATION_OR_QUESTION = /^(?:why|what|when|where|who|which|how(?:\s+(?:do|does|did|can|could|should|would|is|are|was|were))?|explain|describe|tell me (?:why|how|what|about)|can you explain|could you explain|为什么|什么是|何时|哪里|谁|哪个|怎么(?:做|用|理解|回事)?|如何(?:理解|看待|工作)?|解释|说明一下|介绍一下|告诉我(?:为什么|怎么|什么))/iu;
var READ_ONLY_REVIEW = /^(?:review|inspect|assess|evaluate|audit|look (?:at|over)|read|summari[sz]e|check|审阅|评审|检查|查看|看看|阅读|总结|评估|审计|分析)/iu;
var DIRECT_DELIVERABLE = new RegExp("^(?:implement|create|add|write|draft|build|generate|produce|modify|update|edit|fix|repair|patch|refactor|remove|delete|rename|migrate|install|configure|integrate|replace|convert|publish|deploy|export|save|\u5B9E\u73B0|\u521B\u5EFA|\u65B0\u5EFA|\u6DFB\u52A0|\u7F16\u5199|\u64B0\u5199|\u8D77\u8349|\u6784\u5EFA|\u751F\u6210|\u5236\u4F5C|\u4EA7\u51FA|\u4FEE\u6539|\u66F4\u65B0|\u7F16\u8F91|\u4FEE\u590D|\u4FEE\u8865|\u91CD\u6784|\u79FB\u9664|\u5220\u9664|\u91CD\u547D\u540D|\u8FC1\u79FB|\u5B89\u88C5|\u914D\u7F6E|\u96C6\u6210|\u66FF\u6362|\u8F6C\u6362|\u53D1\u5E03|\u90E8\u7F72|\u5BFC\u51FA|\u4FDD\u5B58)(?:\\b|(?=\\p{Script=Han}))", "iu");
var BOUNDED_EXECUTION = /^(?:(?:run|execute|perform|conduct|rerun)\b.{0,80}\b(?:test(?:s|ing)?|experiment|benchmark|ablation|migration|script|command|validation|build|suite)\b|(?:运行|执行|开展|进行|重跑).{0,40}(?:测试|实验|基准|消融|迁移|脚本|命令|验证|构建))/iu;
var ACCEPTABLE_NEW_TASK = /^(?:(?:investigate|debug|reproduce|diagnose|research)\b.{0,160}\b(?:and|then)\b.{0,80}\b(?:identify|determine|document|write|produce|fix|return|deliver|save)\b|(?:调查|排查|调试|复现|诊断|研究).{0,80}(?:并|然后|并且).{0,40}(?:确定|识别|记录|写|产出|修复|给出|交付|保存))/iu;
var COMPOUND_DELIVERABLE = /(?:\b(?:and|then)\s+(?:implement|create|add|write|draft|build|generate|produce|modify|update|edit|fix|patch|refactor|remove|delete|rename|save)\b|(?:并|然后|并且)(?:实现|创建|新建|添加|编写|撰写|生成|制作|产出|修改|更新|编辑|修复|重构|移除|删除|重命名|保存))/iu;
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
  if (CONVERSATIONAL_ONLY.some((pattern) => pattern.test(normalized))) return false;
  if (STATUS_ONLY.some((pattern) => pattern.test(normalized))) return false;
  const body = requestBody(normalized);
  if (!body || CONTINUATION_FOLLOW_UP.test(body) || UNCERTAIN_ONLY.test(body)) return false;
  if (EXPLANATION_OR_QUESTION.test(body)) return false;
  if (READ_ONLY_REVIEW.test(body) && !COMPOUND_DELIVERABLE.test(body)) return false;
  return DIRECT_DELIVERABLE.test(body) || BOUNDED_EXECUTION.test(body) || ACCEPTABLE_NEW_TASK.test(body) || COMPOUND_DELIVERABLE.test(body);
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
