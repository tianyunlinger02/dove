#!/usr/bin/env node
import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);

// src/core/dove-agent-persona.mjs
var DOVE_AGENT_FRAME = "Start from the real research question, current mainline, external context, user need, key uncertainty, and decision that matters. When the route is open, generate materially different explanations or approaches, use theory and actual use conditions to compare the serious candidates, and do not commit to the first plausible or easiest one.";
var DOVE_AGENT_HUNCH = "Use hunches and first impressions as hypotheses, not decisions; treat user preferences as tradeoff signals, not conclusions or rigid rules. Ground them in observed evidence and turn them into the smallest discriminating question or action.";
var DOVE_AGENT_CURIOSITY = "Bring research drive: do not stop at admitting limits; turn gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves that advance the mainline, while keeping exploration aimed rather than diffuse.";
var DOVE_AGENT_LAYERING = "Treat rigor, novelty, experiments, validation, engineering, writing, review, documents, and preferences as layered means rather than equal goals. Rank actions by whether they change or protect the mainline decision, and do not let lower-level artifacts simulate higher-level research progress.";
var DOVE_AGENT_PROPORTIONALITY = "Be objective and proportional: act from evidence, task risk, user preference, and the research mainline, neither rushing into aggressive execution nor over-defending with unnecessary checks.";
var DOVE_AGENT_STOPPING = "Give the judgment and stop when further action is unlikely to resolve a material uncertainty. Execute or enter multi-round autonomy only when the user explicitly asks; record only when the user asks, or when the result clearly changes the research mainline, conclusion, decision, or priority.";
var DOVE_AGENT_PERSONA_BULLETS = Object.freeze([
  DOVE_AGENT_FRAME,
  DOVE_AGENT_HUNCH,
  DOVE_AGENT_CURIOSITY,
  DOVE_AGENT_LAYERING,
  DOVE_AGENT_PROPORTIONALITY,
  DOVE_AGENT_STOPPING
]);
var DOVE_AGENT_CAPSULE_BULLETS = Object.freeze([
  "Dove is one complete research agent, not separate planning, authoring, or reviewing personas.",
  "Use host file and research tools directly. Research Markdown is ordinary researcher-owned context, not a database.",
  ...DOVE_AGENT_PERSONA_BULLETS
]);

// src/core/user-response-policy.mjs
var USER_RESPONSE_POLICY = Object.freeze([
  "Follow the user's requested language and format."
]);

// src/core/ambient-policy.mjs
var AMBIENT_CONTEXT = "Use hidden `dove-intake` for this request.";
var CONTEXT_FOLLOW_UP = /^(?:说人话|解释(?:一下|下)?|说明(?:一下|下)?|这是什么意思|什么意思|再(?:简短|简单|短|说一遍)|简短(?:一点|些)?|简单(?:一点|些)?|总结(?:一下|下)?|换个说法|重说(?:一遍)?|展开(?:一下|下)?|继续|接着来|下一步|确认|好的|明白|收到|谢谢|多谢|感谢|why|what does (?:this|that) mean|explain|summari[sz]e|shorter|simplify|say that again|continue|go on|next|ok|okay|got it|thanks)(?:[!！,.，。?？\s]*)$/iu;
var JUDGMENT_ONLY_INTENT = /(?:怎么办|接下来(?:呢|怎么办)?|下一步(?:是什么|呢|怎么办)?|继续吗|(?:要不要|该不该).*?(?:[?？]|$)|是否(?:需要|应该|要).*?(?:[?？]|$)|\bwhat now\b|\bwhat should (?:we|i) do\b|\b(?:do you think\s+)?should (?:we|i)\b|\bdo (?:we|i) need to\b)/iu;
var ENGLISH_WORK_ACTION = "(?:research|investigate|design|run|execute|benchmark|source|retrieve|read|verify|analy[sz]e|compare|draft|write|revise|plot|draw|review|rebut|respond|import|prepare|record|update|save|remember|reflect|retrospect|find|search|collect)";
var CHINESE_WORK_ACTION = "(?:\u7814\u7A76|\u8C03\u7814|\u8BBE\u8BA1|\u8FD0\u884C|\u6267\u884C|\u8DD1|\u83B7\u53D6|\u67E5\u627E|\u67E5|\u5BFB\u627E|\u627E|\u641C\u7D22|\u68C0\u7D22|\u641C\u96C6|\u6536\u96C6|\u9605\u8BFB|\u6838\u5BF9|\u9A8C\u8BC1|\u5206\u6790|\u6BD4\u8F83|\u5BA1\u67E5|\u68C0\u67E5|\u8D77\u8349|\u5199|\u4FEE\u6539|\u4FEE\u8BA2|\u7ED8\u56FE|\u753B|\u8BC4\u5BA1|\u5BA1\u7A3F|\u56DE\u590D|\u53CD\u9A73|\u5BFC\u5165|\u51C6\u5907|\u8BB0\u5F55|\u66F4\u65B0|\u4FDD\u5B58|\u8BB0\u4F4F|\u590D\u76D8|\u53CD\u601D)";
var DOVE_WORK_ACTION = new RegExp(`(?:\\b${ENGLISH_WORK_ACTION}\\b|${CHINESE_WORK_ACTION})`, "iu");
var DOVE_WORK_DIRECTIVE = new RegExp(`^(?:${ENGLISH_WORK_ACTION}\\b\\s+|${CHINESE_WORK_ACTION}.+)|(?:\\b(?:please|can you|could you|would you|help me|help us|let'?s|we need to|i need you to|i want you to|i'd like you to)\\b|(?:\u5E2E\u6211|\u8BF7|\u8BF7\u4F60|\u9EBB\u70E6|\u5E2E\u5FD9|\u9700\u8981\u4F60|\u6211\u4EEC\u6765|\u7ED9\u6211)|(?:\u628A|\u5C06).*(?:\u5199\u8FDB|\u5199\u5230|\u8BB0\u5F55\u5230|\u66F4\u65B0\u5230|\u4FDD\u5B58\u5230))`, "iu");
var DOVE_DOMAIN_OBJECT = /(?:\bdove\b|\bresearch\b|\bresearch (?:question|record|note|context|mainline|decision|claim|route|problem|result)\b|\bexperiment(?:al)?(?: result| note| plan| design| record| output)?\b|\bbenchmark(?: result| plan)?\b|\b(?:literature|papers?|manuscripts?|figures?|plots?|captions?|reviewer|review handoff|review return|review finding|review document|review prompt|review exchange|rebuttal|lessons?|claims?|missions?|hypothes(?:is|es)|citations?|evidence|sources?|source note|source material|results?)\b|(?:Dove|科研|研究|研究(?:问题|记录|主线|上下文|结论|决策)|实验(?:结果|记录|计划|文档)?|基准|文献|来源|论文|稿件|草稿|图表|绘图|(?:这|那|该|本)?张图|评审|审稿|回复审稿|反驳|经验|教训|主线|结论|决策|假设|引用|证据|结果))/iu;
function isHighConfidenceAmbientWorkPrompt(prompt) {
  if (typeof prompt !== "string") return false;
  const normalized = prompt.normalize("NFKC").trim();
  if (!normalized || normalized.startsWith("/") || CONTEXT_FOLLOW_UP.test(normalized) || JUDGMENT_ONLY_INTENT.test(normalized)) return false;
  return DOVE_WORK_DIRECTIVE.test(normalized) && DOVE_WORK_ACTION.test(normalized) && DOVE_DOMAIN_OBJECT.test(normalized);
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
