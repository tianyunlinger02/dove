#!/usr/bin/env node
import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);

// src/core/command-manifest.mjs
var PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
var PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs", "mcp/dove-state-server-package.mjs", "scripts/doctor-mcp-probe-package.mjs", "scripts/dove-user-prompt-submit-package.mjs"];
var PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents", "claude"];
var HOST_IDS = [...PROJECT_HOST_IDS];
var DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([".claude/rules/dove.md", ".claude/skills/dove-intake/SKILL.md", ".claude/skills/dove-lessons-intake/SKILL.md", ".claude/settings.json"]);
var INSTALLED_DOVE_MCP_SERVER = Object.freeze({ type: "stdio", command: "dove", args: Object.freeze(["mcp", "serve", "--project", "."]) });
var HOST_DEFINITIONS = {
  opencode: { label: "OpenCode", scope: "project", jsonChecks: [".opencode.json"] },
  codex: { label: "Codex", scope: "project", jsonChecks: [] },
  cursor: { label: "Cursor", scope: "project", jsonChecks: [] },
  agents: { label: "Shared agent skills", scope: "project", jsonChecks: [] },
  claude: { label: "Claude Code", scope: "project", jsonChecks: [] }
};
var OPENCODE_ROLE_SKILL_PATHS = [".opencode/skills/dove-planner/SKILL.md", ".opencode/skills/dove-builder/SKILL.md", ".opencode/skills/dove-reviewer/SKILL.md"];
var PUBLIC_RESPONSE_CAPSULE = Object.freeze([
  "Unless the user requests another language or format, respond in natural, clear Chinese.",
  "Use internal terms, paths, and machine identifiers only when they materially improve precision, and explain them plainly.",
  "Adapt the response structure to the task instead of forcing a fixed report template; explicit user instructions and local machine-readable contracts take priority.",
  "Access durable Dove state only through public MCP tools. Use normal host tools to read, create, edit, and validate ordinary project materials and artifacts outside `.dove`."
]);
var HOST_ADAPTER_POLICY = Object.freeze({
  toolAccess: Object.freeze({ transport: "mcp-only", unavailable: "stop", cliFallback: false, shellFallback: false, directDoveStateAccess: false }),
  publicChannels: Object.freeze({ present: "human-text-and-structured-research-projection", preserveVerbatim: false }),
  privacy: Object.freeze({ exposePrivateProtocol: false }),
  language: Object.freeze({ default: "zh", style: "natural-clear-flexible", capsule: PUBLIC_RESPONSE_CAPSULE }),
  adapterBullets: Object.freeze([
    "Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.",
    "Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.",
    "Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority."
  ])
});
var SURFACES = [
  ["research", "Route workspace and mission research, internal synthesis, and bounded project work.", ["query_dove_research", "manage_dove_workspace", "manage_dove_missions"]],
  ["status", "Read the current research projection without writes.", ["query_dove_research"]],
  ["source", "Discover external material and manage captured source candidates.", ["query_dove_research", "manage_dove_sources"]],
  ["experiment", "Design, freeze, execute with host tools, and record experiments and supported claims.", ["query_dove_research", "manage_dove_experiments", "manage_dove_claims"]],
  ["draft", "Write or revise ordinary project draft artifacts using current research evidence.", ["query_dove_research", "manage_dove_claims"]],
  ["figure", "Gather materials and create ordinary project figure artifacts with captions.", ["query_dove_research", "manage_dove_sources", "manage_dove_experiments"]],
  ["review", "Prepare and import a user-managed independent review exchange and inspect coverage.", ["query_dove_research", "manage_dove_reviews"]],
  ["rebuttal", "Perform author-side rebuttal and revision work from current findings and evidence.", ["query_dove_research", "manage_dove_reviews", "manage_dove_claims"]],
  ["lessons", "Read or explicitly replace the complete advisory Lessons document.", ["manage_dove_lessons"]]
];
var mcp = (tool, instruction, options = {}) => ({
  type: "mcp",
  tool,
  required: options.required ?? [],
  readOnly: options.readOnly === true,
  persistWhen: options.persistWhen ?? "never",
  instruction
});
var host = (instruction, options = {}) => ({
  type: "host",
  capability: options.capability ?? "ordinary-project-work",
  readOnly: options.readOnly === true,
  persistWhen: options.persistWhen ?? "never",
  instruction
});
function workflow(slug) {
  const clarification = ["Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary."];
  if (slug === "research") return {
    status: "route-or-domain-work",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests research framing, investigation, synthesis, or bounded project work.", steps: [
      mcp("query_dove_research", "Request the smallest zero-write projection, normally overview or a relevant view. Treat status=absent and an empty Mission inventory as normal branchable states.", { readOnly: true }),
      host("When the Workspace is absent, there are no Missions, or no relevant Mission exists, inspect only ordinary project material outside `.dove`\u2014such as README, docs, source, tests, configuration, results, and existing artifacts\u2014to form a provisional research frame.", { capability: "project-exploration", readOnly: true }),
      host("Continue the bounded research or project investigation with normal host tools, preserving uncertainty and recording actual evidence. Do not initialize a Workspace or create a Mission automatically.", { capability: "research-work" }),
      mcp("manage_dove_workspace", "Initialize or update the research direction only when the user explicitly requests durable Workspace maintenance and provides the required research frame.", { persistWhen: "explicit-workspace-maintenance" }),
      mcp("manage_dove_missions", "Create, branch, or conclude a Mission only when the user explicitly needs a durable research node; otherwise leave Dove state unchanged.", { persistWhen: "explicit-durable-mission" })
    ], clarification }],
    examples: ["research"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "status") return {
    status: "read-only",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests current Dove research status.", steps: [
      mcp("query_dove_research", "Read the smallest relevant projection and report it without changing Dove state or ordinary project files.", { readOnly: true })
    ], clarification: [] }],
    examples: ["status"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "source") return {
    status: "route-or-domain-work",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests source discovery, reading, comparison, or verification.", steps: [
      mcp("query_dove_research", "Read related-work or claim context only when durable context is relevant.", { readOnly: true }),
      host("Discover, retrieve, read, and verify the real material with host-native project or external research tools. Distinguish what was inspected from what was actually used.", { capability: "source-research", readOnly: true }),
      mcp("manage_dove_sources", "Record only a Source that was actually used and needs a durable citation or evidence relationship; preserve conditions, conflicts, and limitations.", { persistWhen: "actual-source-used" })
    ], clarification }],
    examples: ["source"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "experiment") return {
    status: "route-or-domain-work",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests experiment design, execution, analysis, or recording.", steps: [
      mcp("query_dove_research", "Read hypotheses, experiment options, or result context when available.", { readOnly: true }),
      host("Design the smallest discriminating experiment and execute it with normal host tools. Preserve raw outputs, failures, denominator accounting, deviations, bias, and uncertainty.", { capability: "experiment-execution" }),
      mcp("manage_dove_experiments", "Freeze a plan before execution and record the full result only when a durable experiment record is needed.", { persistWhen: "durable-experiment-record" }),
      mcp("manage_dove_claims", "Record or revise only claims supported by the observed evidence, including counter-evidence, missing evidence, and cannot-say boundaries.", { persistWhen: "durable-claim-update" })
    ], clarification }],
    examples: ["experiment"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "draft") return {
    status: "route-or-domain-work",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests drafting or revision of an ordinary project artifact.", steps: [
      mcp("query_dove_research", "Read claim-story or other relevant evidence context when durable research exists.", { readOnly: true }),
      host("Read the target and surrounding ordinary project materials, then create or revise the requested draft artifact with normal host editing tools. Keep every claim within the available evidence.", { capability: "artifact-editing" }),
      host("Run the appropriate host-native checks for the artifact and report remaining unsupported claims, citation gaps, and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      mcp("manage_dove_claims", "Persist a Claim change only when the draft work materially changes a durable claim relationship.", { persistWhen: "material-claim-change" })
    ], clarification }],
    examples: ["draft"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "figure") return {
    status: "route-or-domain-work",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests a figure, diagram, plot, or caption.", steps: [
      mcp("query_dove_research", "Read the relevant evidence, source, or result synthesis when durable context exists.", { readOnly: true }),
      host("Gather actual project materials and data, then create or revise the ordinary figure artifact and its caption with host-native plotting, image, or editing tools.", { capability: "figure-creation" }),
      host("Validate labels, denominators, provenance, legibility, and agreement between the figure, caption, and underlying evidence.", { capability: "figure-validation", readOnly: true }),
      mcp("manage_dove_sources", "Record a newly used Source only when a durable reference is needed.", { persistWhen: "actual-source-used" }),
      mcp("manage_dove_experiments", "Record an experiment result only when the figure is based on a result that needs durable preservation.", { persistWhen: "durable-result-needed" })
    ], clarification }],
    examples: ["figure"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "review") return {
    status: "user-managed-exchange",
    selectors: { mission: "semantic-id", research: "semantic-id" },
    generatedFields: [],
    modes: [{ id: "exchange", when: "The user requests independent review.", steps: [
      mcp("query_dove_research", "Read the relevant review or claim context without changing it.", { readOnly: true }),
      mcp("manage_dove_reviews", "Use operation=local-preflight, then operation=prepare for an explicit frozen artifact scope.", { required: ["operation", "missionId", "artifactPaths"], readOnly: true }),
      host("Return the frozen package to the user for a separate reviewer session that the user selects and manages. Never launch, impersonate, or silently replace that reviewer.", { capability: "review-handoff", readOnly: true }),
      mcp("manage_dove_reviews", "After the user supplies the separate review return, use operation=import with the exact strict review object.", { required: ["operation", "missionId", "exchangeId", "review"], persistWhen: "user-supplied-review-return" }),
      mcp("manage_dove_reviews", "Use operation=coverage to inspect current review coverage.", { required: ["operation", "missionId"], readOnly: true })
    ], clarification }],
    examples: ["review"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "rebuttal") return {
    status: "route-or-domain-work",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests author-side rebuttal or revision from review findings.", steps: [
      mcp("query_dove_research", "Read review and claim context relevant to the requested response.", { readOnly: true }),
      mcp("manage_dove_reviews", "Read coverage or review records needed for the response; do not present author work as independent review.", { readOnly: true }),
      host("Analyze each finding against the actual artifact and evidence, then write the rebuttal and make requested ordinary project revisions with host-native tools.", { capability: "rebuttal-and-revision" }),
      host("Validate that every response maps to a finding and that revisions do not overstate evidence or erase failures and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      mcp("manage_dove_claims", "Persist only material claim changes introduced by the author-side revision.", { persistWhen: "material-claim-change" })
    ], clarification }],
    examples: ["rebuttal"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  return {
    status: "route-or-domain-work",
    selectors: { mission: "none" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests Lessons reading, remembering, or reflection.", steps: [
      mcp("manage_dove_lessons", "For reading, use operation=read. For an explicit remember or reflection request, read the complete Markdown, preserve its current structure, integrate only supported reusable guidance, and use operation=replace with the full replacement document.", { required: ["operation"], readOnly: false, persistWhen: "explicit-replace-request" })
    ], clarification }],
    examples: ["lessons"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
}
var COMMAND_SURFACES = SURFACES.map(([slug, summary, requiredTools]) => ({
  id: `dove.${slug}`,
  title: `Dove ${slug}`,
  domain: "generic",
  category: slug === "status" ? "query" : "research",
  policy: slug === "status" ? "read-only" : "bounded",
  summary,
  operationId: `command.dove.${slug}`,
  constraints: ["Protect truth, evidence integrity, uncertainty, and claim scope.", "Do not create Missions automatically.", "Use semantic IDs rather than positional selectors."],
  adapterNotes: slug === "review" ? ["Review uses a user-managed independent exchange: local-preflight, prepare, import, coverage. Never launch or impersonate a reviewer."] : [],
  callFlow: workflow(slug),
  ux: { dailyFlow: [summary], targetingBehavior: "Use semantic IDs only when durable records must be selected.", confirmationBehavior: "Explore first; clarify material ambiguity once only if it remains, otherwise proceed within the requested boundary.", expectedOutcome: summary, examples: [`/dove:${slug}`] },
  interaction: slug === "status" ? "read" : "write",
  checkpoint: false,
  continuation: "terminal",
  closure: "none",
  presentation: "show",
  retry: { succeeded: "none", declined: "none", cancelled: "none", failed: "explicit-request" },
  publicProjector: "research-projection",
  pathInput: "workspace-file",
  statuses: { ok: { outcome: "success" } },
  requiredTools
}));
var COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));
function commandIdToSlug(commandId) {
  return commandId.replace(/^dove\./u, "");
}
function hostCommandSlug(commandId) {
  return commandIdToSlug(commandId).replace(/\./gu, "-");
}
function adapterPathForCommand(hostId, command) {
  const commandId = typeof command === "string" ? command : command.id;
  const slug = hostCommandSlug(commandId);
  if (hostId === "opencode") return `.opencode/commands/${commandId}.md`;
  if (hostId === "cursor") return `.cursor/commands/dove-${slug}.md`;
  if (hostId === "codex") return `.codex/skills/dove-${slug}/SKILL.md`;
  if (hostId === "agents") return `.agents/skills/dove-${slug}/SKILL.md`;
  if (hostId === "claude") return `.claude/commands/dove/${slug}.md`;
  throw new Error(`Unknown host adapter: ${hostId}`);
}
function commandAdapterPathsForHost(hostId) {
  return COMMAND_SURFACES.map((command) => adapterPathForCommand(hostId, command));
}
var HOST_ADAPTERS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => {
  const commandPaths = commandAdapterPathsForHost(hostId);
  const extraPaths = hostId === "opencode" ? [...OPENCODE_ROLE_SKILL_PATHS, ".opencode.json"] : hostId === "agents" ? ["AGENTS.md"] : [];
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths: [...commandPaths, ...extraPaths], requiredPaths: [...commandPaths, ...extraPaths], jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));
var CURRENT_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...PACKAGE_RUNTIME_PATHS]),
  opencode: Object.freeze([...HOST_ADAPTERS.opencode.paths]),
  codex: Object.freeze([...HOST_ADAPTERS.codex.paths]),
  cursor: Object.freeze([...HOST_ADAPTERS.cursor.paths]),
  agents: Object.freeze([...HOST_ADAPTERS.agents.paths]),
  claude: Object.freeze([...commandAdapterPathsForHost("claude"), ...DOVE_CLAUDE_AMBIENT_PROJECT_PATHS])
});
var RETIRED = ["workspace", "mission", "note", "experience"];
var RETIRED_MANAGED_PATHS = Object.freeze({
  opencode: Object.freeze(RETIRED.map((slug) => `.opencode/commands/dove.${slug}.md`)),
  codex: Object.freeze(RETIRED.flatMap((slug) => [`.codex/skills/dove-${slug}/SKILL.md`, `.codex/skills/dove-${slug}`])),
  cursor: Object.freeze(RETIRED.map((slug) => `.cursor/commands/dove-${slug}.md`)),
  agents: Object.freeze(RETIRED.flatMap((slug) => [`.agents/skills/dove-${slug}/SKILL.md`, `.agents/skills/dove-${slug}`])),
  claude: Object.freeze(RETIRED.map((slug) => `.claude/commands/dove/${slug}.md`))
});
var MANAGED_PACKAGE_PATHS = Object.freeze([...CURRENT_MANAGED_PATHS.opencode, ...CURRENT_MANAGED_PATHS.codex, ...CURRENT_MANAGED_PATHS.cursor, ...CURRENT_MANAGED_PATHS.agents, ...commandAdapterPathsForHost("claude"), ...CURRENT_MANAGED_PATHS.core, ...PACKAGE_DOCUMENTATION_PATHS]);

// src/core/ambient-policy.mjs
var AMBIENT_CONTEXT = "Use hidden `dove-intake` for zero-write role and Skill routing. Clarify material ambiguity once; otherwise choose the smallest flat Skill and continue with ordinary host work. Do not create a Mission or invoke a closure callback.";
var LESSONS_CONTEXT = "Use hidden `dove-lessons-intake` for this explicit Lessons request. Use only `manage_dove_lessons`: read by default, or replace the complete document after an explicit remember or reflection request. Create no Mission.";
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
