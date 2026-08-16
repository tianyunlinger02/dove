#!/usr/bin/env node
import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);

// src/core/user-response-policy.mjs
var USER_RESPONSE_POLICY = Object.freeze([
  "Follow the user's requested language and format.",
  "Keep material failures, limitations, and uncertainty visible; do not present software checks or model output as scientific proof."
]);

// src/core/ambient-policy.mjs
var AMBIENT_CONTEXT = "Use hidden `dove-intake` for this request.";
var AMBIENT_WORK_INTENT = /(?:\b(?:research|investigate|experiment|benchmark|source|literature|paper|manuscript|draft|figure|plot|review|rebuttal|revise|implement|build|fix|debug|test|validate|analy[sz]e|compare|audit|lesson|lessons|remember|reflect|retrospect)\b|(?:研究|调研|实验|基准|文献|来源|论文|稿件|草稿|图表|绘图|评审|审稿|回复审稿|反驳|修订|实现|构建|修复|调试|测试|验证|分析|比较|审查|检查|经验|教训|记住|记录|复盘|反思))/iu;
var CONTEXT_FOLLOW_UP = /^(?:说人话|解释(?:一下|下)?|说明(?:一下|下)?|这是什么意思|什么意思|再(?:简短|简单|短|说一遍)|简短(?:一点|些)?|简单(?:一点|些)?|总结(?:一下|下)?|换个说法|重说(?:一遍)?|展开(?:一下|下)?|继续|接着来|下一步|确认|好的|明白|收到|谢谢|多谢|感谢|why|what does (?:this|that) mean|explain|summari[sz]e|shorter|simplify|say that again|continue|go on|next|ok|okay|got it|thanks)(?:[!！,.，。?？\s]*)$/iu;
function isHighConfidenceAmbientWorkPrompt(prompt) {
  if (typeof prompt !== "string") return false;
  const normalized = prompt.normalize("NFKC").trim();
  if (!normalized || normalized.startsWith("/") || CONTEXT_FOLLOW_UP.test(normalized)) return false;
  return AMBIENT_WORK_INTENT.test(normalized);
}
var DOVE_CLAUDE_AMBIENT_HOOK_COMMAND = 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"';
var DOVE_CLAUDE_STOP_HOOK_COMMAND = 'dove hook stop --project "$CLAUDE_PROJECT_DIR"';
var DOVE_CLAUDE_AMBIENT_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([
    Object.freeze({
      type: "command",
      command: DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
      timeout: 10
    })
  ])
});
var DOVE_CLAUDE_STOP_HOOK_ENTRY = Object.freeze({
  hooks: Object.freeze([
    Object.freeze({
      type: "command",
      command: DOVE_CLAUDE_STOP_HOOK_COMMAND,
      timeout: 10
    })
  ])
});
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
  const additionalContext = ambientContextForPrompt(payload.prompt);
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
