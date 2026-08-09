import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);

// src/core/schema.mjs
var PACKAGE_VERSION = "0.7.0";
var DOVE_RESEARCH_FORMAT = "dove-research-v1";
var LEGACY_DOVE_SCHEMA_VERSION = 20;
var ARTIFACT_PATHS = Object.freeze({
  doveRoot: ".dove",
  installDir: ".dove/install",
  installationManifest: ".dove/install/manifest.json",
  transactionsDir: ".dove/install/transactions",
  format: ".dove/format.json",
  workspace: ".dove/workspace.json",
  missionsDir: ".dove/missions",
  sourcesDir: ".dove/sources",
  experimentsDir: ".dove/experiments",
  claimsDir: ".dove/claims",
  reviewsDir: ".dove/reviews",
  lessons: ".dove/LESSONS.md"
});
var RESEARCH_DIRECTORIES = Object.freeze([
  ARTIFACT_PATHS.missionsDir,
  ARTIFACT_PATHS.sourcesDir,
  ARTIFACT_PATHS.experimentsDir,
  ARTIFACT_PATHS.claimsDir,
  ARTIFACT_PATHS.reviewsDir
]);
var RESEARCH_REQUIRED_FILES = Object.freeze([
  ARTIFACT_PATHS.format,
  ARTIFACT_PATHS.workspace,
  ARTIFACT_PATHS.lessons
]);

// src/core/command-manifest.mjs
var PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
var PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs", "mcp/dove-state-server-package.mjs", "scripts/doctor-mcp-probe-package.mjs", "scripts/dove-user-prompt-submit-package.mjs"];
var PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents", "claude"];
var HOST_IDS = [...PROJECT_HOST_IDS];
var DOVE_MCP_CONFIG_PATH = ".mcp.json";
var DOVE_MCP_SERVER_NAME = "dove";
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
function allGeneratedCommandAdapterPaths() {
  return PROJECT_HOST_IDS.flatMap(commandAdapterPathsForHost);
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
var DOVE_CLAUDE_SETTINGS_PATH = ".claude/settings.json";
var DOVE_CLAUDE_AMBIENT_RULE_PATH = ".claude/rules/dove.md";
var DOVE_CLAUDE_AMBIENT_SKILL_PATH = ".claude/skills/dove-intake/SKILL.md";
var DOVE_CLAUDE_LESSONS_SKILL_PATH = ".claude/skills/dove-lessons-intake/SKILL.md";
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
function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function sameKeys(value, keys) {
  return plainObject(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}
function isExactManagedHook(value) {
  if (!sameKeys(value, ["hooks"]) || !Array.isArray(value.hooks) || value.hooks.length !== 1) return false;
  const hook = value.hooks[0];
  return sameKeys(hook, ["command", "timeout", "type"]) && hook.type === "command" && hook.command === DOVE_CLAUDE_AMBIENT_HOOK_COMMAND && hook.timeout === 10;
}
function referencesManagedHook(value) {
  if (!plainObject(value) || !Array.isArray(value.hooks)) return false;
  return value.hooks.some((hook) => plainObject(hook) && typeof hook.command === "string" && (hook.command.includes("dove hook user-prompt-submit") || hook.command.includes("dove-user-prompt-submit-package.mjs")));
}
function mergeClaudeAmbientSettings(settings) {
  if (!plainObject(settings)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} must contain a JSON object.`);
  if (settings.hooks !== void 0 && !plainObject(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const hooks = settings.hooks ?? {};
  const promptHooks = hooks.UserPromptSubmit;
  if (promptHooks !== void 0 && !Array.isArray(promptHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.UserPromptSubmit must be an array.`);
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
function lessonsContextForPrompt(prompt) {
  return classifyLessonsIntent(prompt) === null ? null : LESSONS_CONTEXT;
}
function ambientContextForPrompt(prompt) {
  return isHighConfidenceAmbientWorkPrompt(prompt) ? AMBIENT_CONTEXT : null;
}
function renderClaudeAmbientRule() {
  return `# Dove ambient role and Skill routing

${PUBLIC_RESPONSE_CAPSULE.join("\n")}

For a non-slash prompt selected by the project hook, apply the hidden skill named in its context. Explicit Lessons read, remember, or reflection requests use \`dove-lessons-intake\`, create no Mission, and use only \`manage_dove_lessons\`. Other selected work uses \`dove-intake\` for a second conservative, zero-write routing judgment across the flat Skills: research, status, source, experiment, draft, figure, review, rebuttal, and lessons.

Ask one zero-write clarification round only for material ambiguity. Otherwise select Planner, Builder/Author, or Reviewer responsibility and the smallest matching Skill, then continue with normal host work. Do not create an ambient Mission, emit a handoff, consume private controls, or invoke a closure callback.

Carry the Research Constitution into host work: protect truth, safety, evidence integrity, long-term value, and claim scope; use real resources and existing assets; preserve failures and uncertainty; never equate host return, tests, local review, or internal audit with completion, independent review, or scientific authority.

Slash commands retain their explicit routing. Use public Dove tools rather than direct state or CLI access.
`;
}
function renderClaudeLessonsIntakeSkill() {
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
function renderClaudeAmbientSkill() {
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

// src/core/ambient-hook.mjs
function parseHookPayload(input) {
  let payload;
  try {
    payload = JSON.parse(input);
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
function userPromptSubmitOutput(input) {
  const payload = parseHookPayload(input);
  const additionalContext = lessonsContextForPrompt(payload.prompt) ?? ambientContextForPrompt(payload.prompt);
  if (additionalContext === null) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext
    }
  };
}

// src/core/research-records.mjs
import crypto from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";

// src/core/anchored-filesystem.mjs
import fs from "node:fs";
import path from "node:path";
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function normalizeRelativePath(relativePath, label = "Filesystem path") {
  if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error(`${label} must be a non-empty relative path.`);
  const normalized = path.posix.normalize(relativePath.replace(/\\/gu, "/"));
  if (path.isAbsolute(relativePath) || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
    throw new Error(`${label} must stay inside the anchored root: ${relativePath}`);
  }
  return normalized;
}
function requiredFunction(fsOps, name) {
  if (typeof fsOps?.[name] !== "function") throw new Error(`Anchored filesystem requires fsOps.${name}().`);
  return fsOps[name].bind(fsOps);
}
function realpathNative(fsOps, targetPath) {
  const realpath = requiredFunction(fsOps, "realpathSync");
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(targetPath) : realpath(targetPath);
}
function anchoredFilesystemCapability(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const platform = options.platform ?? process.platform;
  const procFdRoot = options.procFdRoot ?? "/proc/self/fd";
  if (platform !== "linux") return { supported: false, reason: "anchored writes require Linux" };
  const constants = fsOps.constants ?? fs.constants;
  if (!Number.isInteger(constants?.O_DIRECTORY) || !Number.isInteger(constants?.O_NOFOLLOW)) {
    return { supported: false, reason: "anchored writes require O_DIRECTORY and O_NOFOLLOW" };
  }
  try {
    const stat = requiredFunction(fsOps, "statSync")(procFdRoot);
    if (!stat.isDirectory()) return { supported: false, reason: `${procFdRoot} is not a directory` };
  } catch (error) {
    return { supported: false, reason: `anchored writes require readable ${procFdRoot}: ${errorMessage(error)}` };
  }
  return { supported: true, reason: null, procFdRoot };
}
function requireAnchoredFilesystemCapability(options = {}) {
  const capability = anchoredFilesystemCapability(options);
  if (!capability.supported) throw new Error(`Anchored writes are unavailable: ${capability.reason}. Use a read-only operation on this platform.`);
  return capability;
}
var AnchoredFilesystem = class {
  constructor(root, options = {}) {
    this.fsOps = options.fsOps ?? fs;
    this.constants = this.fsOps.constants ?? fs.constants;
    this.procFdRoot = options.procFdRoot ?? "/proc/self/fd";
    requireAnchoredFilesystemCapability({ ...options, fsOps: this.fsOps, procFdRoot: this.procFdRoot });
    const openSync = requiredFunction(this.fsOps, "openSync");
    const resolvedRoot = path.resolve(root);
    try {
      this.rootFd = openSync(resolvedRoot, this.constants.O_RDONLY | this.constants.O_DIRECTORY | this.constants.O_NOFOLLOW);
    } catch (error) {
      throw new Error(`Unable to anchor workspace root without following links: ${resolvedRoot}: ${errorMessage(error)}`, { cause: error });
    }
    this.rootHandlePath = path.posix.join(this.procFdRoot, String(this.rootFd));
    try {
      this.root = realpathNative(this.fsOps, this.rootHandlePath);
    } catch (error) {
      this.close();
      throw new Error(`Unable to resolve anchored workspace root: ${errorMessage(error)}`, { cause: error });
    }
    this.closed = false;
  }
  assertOpen() {
    if (this.closed) throw new Error("Anchored filesystem is closed.");
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.rootFd !== void 0) requiredFunction(this.fsOps, "closeSync")(this.rootFd);
  }
  normalize(relativePath, label) {
    return normalizeRelativePath(relativePath, label);
  }
  displayPath(relativePath) {
    return path.join(this.root, this.normalize(relativePath));
  }
  openDirectory(relativePath = null) {
    this.assertOpen();
    if (relativePath === null || relativePath === "" || relativePath === ".") {
      return { fd: this.rootFd, handlePath: this.rootHandlePath, relativePath: "", owned: false };
    }
    const normalized = this.normalize(relativePath, "Directory path");
    let currentFd = this.rootFd;
    let owned = false;
    let currentRelative = "";
    try {
      for (const component of normalized.split("/")) {
        const currentHandle = path.posix.join(this.procFdRoot, String(currentFd));
        const candidate = path.posix.join(currentHandle, component);
        const nextFd = requiredFunction(this.fsOps, "openSync")(candidate, this.constants.O_RDONLY | this.constants.O_DIRECTORY | this.constants.O_NOFOLLOW);
        if (owned) requiredFunction(this.fsOps, "closeSync")(currentFd);
        currentFd = nextFd;
        owned = true;
        currentRelative = currentRelative ? `${currentRelative}/${component}` : component;
      }
      return { fd: currentFd, handlePath: path.posix.join(this.procFdRoot, String(currentFd)), relativePath: currentRelative, owned };
    } catch (error) {
      if (owned) requiredFunction(this.fsOps, "closeSync")(currentFd);
      throw error;
    }
  }
  closeDirectory(directory) {
    if (directory?.owned === true && directory.fd !== void 0) requiredFunction(this.fsOps, "closeSync")(directory.fd);
  }
  withParent(relativePath, callback) {
    const normalized = this.normalize(relativePath);
    const parentRelative = path.posix.dirname(normalized);
    const parent = this.openDirectory(parentRelative === "." ? null : parentRelative);
    const name = path.posix.basename(normalized);
    try {
      return callback({ normalized, parent, name, handlePath: path.posix.join(parent.handlePath, name) });
    } finally {
      this.closeDirectory(parent);
    }
  }
  lstat(relativePath) {
    return this.withParent(relativePath, ({ handlePath }) => requiredFunction(this.fsOps, "lstatSync")(handlePath));
  }
  tryLstat(relativePath) {
    try {
      return this.lstat(relativePath);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }
  exists(relativePath) {
    return this.tryLstat(relativePath) !== null;
  }
  openFile(relativePath, flags, mode) {
    return this.withParent(relativePath, ({ handlePath }) => requiredFunction(this.fsOps, "openSync")(handlePath, flags | this.constants.O_NOFOLLOW, mode));
  }
  inspectRegularFile(relativePath) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY | (this.constants.O_NONBLOCK ?? 0));
    try {
      const stat = requiredFunction(this.fsOps, "fstatSync")(fd);
      if (!stat.isFile()) throw new Error(`Anchored read target must be a regular file: ${relativePath}`);
      return stat;
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  readFile(relativePath) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY);
    try {
      const stat = requiredFunction(this.fsOps, "fstatSync")(fd);
      if (!stat.isFile()) throw new Error(`Anchored read target must be a regular file: ${relativePath}`);
      return Buffer.from(requiredFunction(this.fsOps, "readFileSync")(fd));
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  writeNewFile(relativePath, content, options = {}) {
    const mode = options.mode ?? 384;
    const fd = this.openFile(relativePath, this.constants.O_WRONLY | this.constants.O_CREAT | this.constants.O_EXCL, mode);
    try {
      requiredFunction(this.fsOps, "writeFileSync")(fd, content, options.encoding);
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  chmod(relativePath, mode) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY);
    try {
      requiredFunction(this.fsOps, "fchmodSync")(fd, mode);
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  mkdir(relativePath, options = {}) {
    const normalized = this.normalize(relativePath, "Directory path");
    if (options.recursive === true) {
      let current = "";
      for (const component of normalized.split("/")) {
        current = current ? `${current}/${component}` : component;
        const stat = this.tryLstat(current);
        if (stat) {
          if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Anchored directory component is not a real directory: ${current}`);
          continue;
        }
        this.mkdir(current, { mode: options.mode });
      }
      return;
    }
    this.withParent(normalized, ({ handlePath }) => requiredFunction(this.fsOps, "mkdirSync")(handlePath, { recursive: false, ...options.mode === void 0 ? {} : { mode: options.mode }, anchoredPath: normalized, displayPath: this.displayPath(normalized) }));
  }
  readdir(relativePath = null, options = {}) {
    const directory = this.openDirectory(relativePath);
    try {
      return requiredFunction(this.fsOps, "readdirSync")(directory.handlePath, options);
    } finally {
      this.closeDirectory(directory);
    }
  }
  rename(fromRelativePath, toRelativePath) {
    const from = this.normalize(fromRelativePath, "Rename source");
    const to = this.normalize(toRelativePath, "Rename destination");
    const fromParent = this.openDirectory(path.posix.dirname(from) === "." ? null : path.posix.dirname(from));
    const toParent = this.openDirectory(path.posix.dirname(to) === "." ? null : path.posix.dirname(to));
    try {
      const sourcePath = path.posix.join(fromParent.handlePath, path.posix.basename(from));
      const sourceStat = requiredFunction(this.fsOps, "lstatSync")(sourcePath);
      if (sourceStat.isSymbolicLink()) throw new Error(`Anchored rename source must not be a symbolic link: ${from}`);
      const destinationPath = path.posix.join(toParent.handlePath, path.posix.basename(to));
      try {
        const destinationStat = requiredFunction(this.fsOps, "lstatSync")(destinationPath);
        if (destinationStat.isSymbolicLink()) throw new Error(`Anchored rename destination must not be a symbolic link: ${to}`);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      requiredFunction(this.fsOps, "renameSync")(sourcePath, destinationPath, { anchoredFrom: from, anchoredTo: to, displayFrom: this.displayPath(from), displayTo: this.displayPath(to) });
    } finally {
      this.closeDirectory(toParent);
      this.closeDirectory(fromParent);
    }
  }
  unlink(relativePath, options = {}) {
    try {
      this.withParent(relativePath, ({ handlePath }) => {
        const stat = requiredFunction(this.fsOps, "lstatSync")(handlePath);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Anchored unlink target must be a regular file: ${relativePath}`);
        requiredFunction(this.fsOps, "unlinkSync")(handlePath, { anchoredPath: this.normalize(relativePath), displayPath: this.displayPath(relativePath) });
      });
    } catch (error) {
      if (options.force === true && error?.code === "ENOENT") return;
      throw error;
    }
  }
  rmdir(relativePath, options = {}) {
    try {
      const normalized = this.normalize(relativePath);
      this.withParent(normalized, ({ handlePath }) => requiredFunction(this.fsOps, "rmdirSync")(handlePath, { anchoredPath: normalized, displayPath: this.displayPath(normalized), recursiveCleanup: options.recursiveCleanup === true }));
    } catch (error) {
      if (options.force === true && error?.code === "ENOENT") return;
      throw error;
    }
  }
  remove(relativePath, options = {}) {
    const normalized = this.normalize(relativePath, "Removal path");
    const stat = this.tryLstat(normalized);
    if (!stat) {
      if (options.force === true) return;
      const error = new Error(`Anchored removal target does not exist: ${normalized}`);
      error.code = "ENOENT";
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Anchored removal target must not be a symbolic link: ${normalized}`);
    if (stat.isDirectory()) {
      if (options.recursive !== true) return this.rmdir(normalized);
      const directory = this.openDirectory(normalized);
      try {
        const entries = requiredFunction(this.fsOps, "readdirSync")(directory.handlePath, { withFileTypes: true });
        for (const entry of entries) {
          const childPath = `${normalized}/${entry.name}`;
          const childHandlePath = path.posix.join(directory.handlePath, entry.name);
          const childStat = requiredFunction(this.fsOps, "lstatSync")(childHandlePath);
          if (childStat.isSymbolicLink()) throw new Error(`Anchored cleanup encountered a symbolic link: ${childPath}`);
          if (childStat.isDirectory()) this.remove(childPath, { recursive: true, force: false });
          else if (childStat.isFile()) this.unlink(childPath);
          else throw new Error(`Anchored cleanup encountered an unsupported path type: ${childPath}`);
        }
      } finally {
        this.closeDirectory(directory);
      }
      return this.rmdir(normalized, { force: options.force, recursiveCleanup: true });
    }
    if (stat.isFile()) return this.unlink(normalized, { force: options.force });
    throw new Error(`Anchored removal target has an unsupported path type: ${normalized}`);
  }
};
function openAnchoredFilesystem(root, options = {}) {
  return new AnchoredFilesystem(root, options);
}

// src/core/strict-json.mjs
function duplicateKeyError(label, key, path15) {
  throw new Error(`${label} must not contain duplicate JSON object keys: ${path15 === "$" ? key : `${path15}.${key}`}.`);
}
function parseJsonWithoutDuplicateKeys(text2, label = "JSON input") {
  if (typeof text2 !== "string") throw new Error(`${label} must contain valid JSON.`);
  let index = 0;
  function skipWhitespace() {
    while (/\s/u.test(text2[index] ?? "")) index += 1;
  }
  function parseString() {
    if (text2[index] !== '"') throw new Error(`${label} must contain valid JSON.`);
    const start = index;
    index += 1;
    let escaped = false;
    while (index < text2.length) {
      const character = text2[index];
      index += 1;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') {
        return JSON.parse(text2.slice(start, index));
      }
      if (character.charCodeAt(0) < 32) throw new Error(`${label} must contain valid JSON.`);
    }
    throw new Error(`${label} must contain valid JSON.`);
  }
  function parseNumber() {
    const match = text2.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
    if (!match) throw new Error(`${label} must contain valid JSON.`);
    index += match[0].length;
  }
  function parseArray(path15) {
    index += 1;
    skipWhitespace();
    if (text2[index] === "]") {
      index += 1;
      return;
    }
    let itemIndex = 0;
    while (true) {
      parseValue(`${path15}[${itemIndex}]`);
      itemIndex += 1;
      skipWhitespace();
      if (text2[index] === "]") {
        index += 1;
        return;
      }
      if (text2[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }
  function parseObject(path15) {
    index += 1;
    skipWhitespace();
    if (text2[index] === "}") {
      index += 1;
      return;
    }
    const keys = /* @__PURE__ */ new Set();
    while (true) {
      const key = parseString();
      if (keys.has(key)) duplicateKeyError(label, key, path15);
      keys.add(key);
      skipWhitespace();
      if (text2[index] !== ":") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      parseValue(path15 === "$" ? `$.${key}` : `${path15}.${key}`);
      skipWhitespace();
      if (text2[index] === "}") {
        index += 1;
        return;
      }
      if (text2[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }
  function parseValue(path15) {
    skipWhitespace();
    const character = text2[index];
    if (character === "{") parseObject(path15);
    else if (character === "[") parseArray(path15);
    else if (character === '"') parseString();
    else if (character === "-" || /\d/u.test(character ?? "")) parseNumber();
    else if (text2.startsWith("true", index)) index += 4;
    else if (text2.startsWith("false", index)) index += 5;
    else if (text2.startsWith("null", index)) index += 4;
    else throw new Error(`${label} must contain valid JSON.`);
    skipWhitespace();
  }
  try {
    parseValue("$");
    skipWhitespace();
    if (index !== text2.length) throw new Error(`${label} must contain valid JSON.`);
    return JSON.parse(text2);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label} must not contain duplicate`)) throw error;
    throw new Error(`${label} must contain valid JSON.`);
  }
}

// src/core/research-records.mjs
var SAFE_RESEARCH_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  return value;
}
function assertFields(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  return value;
}
function researchId(value, label) {
  if (typeof value !== "string" || !SAFE_RESEARCH_ID.test(value)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return value;
}
function nonEmptyText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function exactTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value;
}
function stringArray(value, label, options = {}) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${label} must be an array of non-empty strings.`);
  const normalized = value.map((item) => item.trim());
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must not contain duplicates.`);
  if (normalized.length < (options.min ?? 0)) throw new Error(`${label} must contain at least ${options.min} item(s).`);
  return normalized;
}
function enumeration(value, values, label) {
  if (!values.includes(value)) throw new Error(`${label} must be one of: ${values.join(", ")}.`);
  return value;
}
function normalizedRelativePath(value, label, options = {}) {
  const supplied = nonEmptyText(value, label).replace(/\\/gu, "/");
  const normalized = path2.posix.normalize(supplied);
  if (path2.posix.isAbsolute(normalized) || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) throw new Error(`${label} must stay inside the project.`);
  if (supplied !== normalized) throw new Error(`${label} must be normalized.`);
  if (options.allowDove !== true && (normalized === ".dove" || normalized.startsWith(".dove/"))) throw new Error(`${label} must not reference Dove bookkeeping.`);
  return normalized;
}
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function jsonDocument(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}
function newResearchId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
function canonicalRoot(root, fsOps) {
  const resolved = path2.resolve(root);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}
function normalizedWritePath(value) {
  return normalizedRelativePath(value, "Research record path", { allowDove: true });
}
function currentFile(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return null;
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Research record target must be absent or a regular file: ${relativePath}.`);
  return { bytes: anchor.readFile(relativePath), mode: stat.mode & 4095 };
}
function readResearchText(root, relativePath, options = {}) {
  const fsOps = options.fsOps ?? fs2;
  const normalized = normalizedWritePath(relativePath);
  const anchor = openAnchoredFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
  try {
    const current = currentFile(anchor, normalized);
    return current ? current.bytes.toString("utf8") : options.fallback ?? null;
  } finally {
    anchor.close();
  }
}
function readResearchJson(root, relativePath, options = {}) {
  const text2 = readResearchText(root, relativePath, options);
  if (text2 === null) return options.fallback ?? null;
  return parseJsonWithoutDuplicateKeys(text2, options.label ?? relativePath);
}
function writeResearchFileAtomic(root, relativePath, content, options = {}) {
  const fsOps = options.fsOps ?? fs2;
  const normalized = normalizedWritePath(relativePath);
  const anchor = openAnchoredFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
  const bytes = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), options.encoding ?? "utf8");
  const transactionRoot = `.dove/install/transactions/research-${crypto.randomUUID()}`;
  const temporary = `${transactionRoot}/staged`;
  const backup = `${transactionRoot}/backup`;
  const installExisted = anchor.exists(".dove/install");
  const transactionsExisted = anchor.exists(".dove/install/transactions");
  let previous = null;
  let promoted = false;
  let backedUp = false;
  let phase = "preparing";
  try {
    previous = currentFile(anchor, normalized);
    if (options.ifAbsent === true && previous) throw new Error(`${options.label ?? "Research record"} is immutable and already exists: ${normalized}.`);
    if (options.expectedContent !== void 0) {
      const expected = Buffer.isBuffer(options.expectedContent) ? options.expectedContent : Buffer.from(String(options.expectedContent));
      if (!previous || !previous.bytes.equals(expected)) throw new Error(`${options.label ?? "Research record"} changed before replacement: ${normalized}.`);
    }
    anchor.mkdir(transactionRoot, { recursive: true });
    anchor.writeNewFile(temporary, bytes, { mode: previous?.mode ?? options.mode ?? 384 });
    const parent = path2.posix.dirname(normalized);
    if (parent !== ".") anchor.mkdir(parent, { recursive: true });
    phase = "promoting";
    if (previous) {
      anchor.rename(normalized, backup);
      backedUp = true;
    }
    anchor.rename(temporary, normalized);
    promoted = true;
    phase = "committed";
    if (backedUp) anchor.unlink(backup);
    phase = "cleanup";
    anchor.rmdir(transactionRoot);
    if (!transactionsExisted && anchor.readdir(".dove/install/transactions").length === 0) anchor.rmdir(".dove/install/transactions", { force: true });
    if (!installExisted && anchor.readdir(".dove/install").length === 0) anchor.rmdir(".dove/install", { force: true });
    return normalized;
  } catch (error) {
    if (phase === "committed" || phase === "cleanup") {
      throw new Error(`Atomic research write committed before post-commit cleanup failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    try {
      if (promoted && anchor.exists(normalized)) anchor.unlink(normalized);
      if (backedUp && anchor.exists(backup)) anchor.rename(backup, normalized);
      if (anchor.exists(transactionRoot)) anchor.remove(transactionRoot, { recursive: true, force: true });
      if (!transactionsExisted && anchor.exists(".dove/install/transactions") && anchor.readdir(".dove/install/transactions").length === 0) anchor.rmdir(".dove/install/transactions", { force: true });
      if (!installExisted && anchor.exists(".dove/install") && anchor.readdir(".dove/install").length === 0) anchor.rmdir(".dove/install", { force: true });
    } catch (rollbackError) {
      throw new Error(`Atomic research write failed and rollback also failed: ${error instanceof Error ? error.message : String(error)}; rollback: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`, { cause: error });
    }
    throw error;
  } finally {
    anchor.close();
  }
}
function writeResearchJsonAtomic(root, relativePath, value, options = {}) {
  return writeResearchFileAtomic(root, relativePath, jsonDocument(value), options);
}

// src/core/workspace-init.mjs
import fs5 from "node:fs";
import path5 from "node:path";

// src/core/workspace-schema.mjs
import fs4 from "node:fs";
import path4 from "node:path";

// src/core/project-installation-manifest.mjs
import crypto2 from "node:crypto";
import fs3 from "node:fs";
import path3 from "node:path";
var INSTALLATION_MANIFEST_PATH = ARTIFACT_PATHS.installationManifest;
var LEGACY_INSTALLATION_MANIFEST_PATH = ".dove-install/manifest.json";
var INSTALLATION_MANIFEST_SCHEMA_VERSION = 1;
var INSTALLATION_INTEGRATION_VERSION = 2;
var INSTALLATION_OWNERSHIP_VERSION = 2;
var PREVIOUS_INSTALLATION_INTEGRATION_VERSION = 1;
var PREVIOUS_INSTALLATION_OWNERSHIP_VERSION = 1;
var INSTALLATION_RUNTIME_PROTOCOL_VERSION = 2;
var MANIFEST_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "integrationVersion",
  "ownershipVersion",
  "installationId",
  "package",
  "runtime",
  "hosts",
  "managed",
  "createdAt",
  "updatedAt"
]);
var PACKAGE_FIELDS = /* @__PURE__ */ new Set(["name", "version"]);
var RUNTIME_FIELDS = /* @__PURE__ */ new Set(["mode", "protocolVersion"]);
var MANAGED_FIELDS = /* @__PURE__ */ new Set(["path", "owner", "mode", "selector", "digest"]);
var MANAGED_MODES = /* @__PURE__ */ new Set(["exclusive-file", "json-fragment", "text-block"]);
var SHA256 = /^[a-f0-9]{64}$/u;
var INSTALLATION_ID = /^installation-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
var SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
function plainObject2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function assertPlainObject2(value, label) {
  if (!plainObject2(value)) throw new Error(`${label} must be a plain object.`);
}
function assertSealed(value, fields, label) {
  assertPlainObject2(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
  const missing = [...fields].filter((field) => !Object.hasOwn(value, field));
  if (missing.length > 0) throw new Error(`${label} is missing required fields: ${missing.join(", ")}.`);
}
function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value || value !== value.trim() || value.includes("\0")) throw new Error(`${label} must be a non-empty trimmed string.`);
  return value;
}
function exactPositiveInteger(value, expected, label) {
  if (value !== expected) throw new Error(`${label} must equal ${expected}.`);
  return value;
}
function exactIsoTimestamp(value, label) {
  nonEmptyString(value, label);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) throw new Error(`${label} must be an exact ISO timestamp.`);
  return value;
}
function canonicalProjectRelativePath(value, label) {
  nonEmptyString(value, label);
  if (value.includes("\\") || path3.posix.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
    throw new Error(`${label} must be a project-relative path without backslashes: ${value}`);
  }
  const normalized = path3.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized === ".." || normalized.startsWith("../") || value.includes("//") || value.endsWith("/")) {
    throw new Error(`${label} must be one canonical project-relative path: ${value}`);
  }
  if (value === ".dove" || value.startsWith(".dove/")) throw new Error(`${label} must not manage Dove workspace state: ${value}`);
  return value;
}
function normalizeAllowedHosts(options) {
  const allowed = options.hostIds;
  if (!Array.isArray(allowed) || allowed.length === 0 || allowed.some((hostId) => typeof hostId !== "string" || !hostId || hostId === "all")) {
    throw new Error("Project installation manifest validation requires concrete hostIds in registry order.");
  }
  if (new Set(allowed).size !== allowed.length) throw new Error("Project installation manifest hostIds must be unique.");
  return allowed;
}
function validateHosts(hosts, allowedHosts) {
  if (!Array.isArray(hosts) || hosts.length === 0) throw new Error("Project installation manifest hosts must be a non-empty array.");
  for (const hostId of hosts) {
    nonEmptyString(hostId, "Project installation manifest host");
    if (hostId === "all") throw new Error("Project installation manifest hosts must contain concrete host ids, not all.");
    if (!allowedHosts.includes(hostId)) throw new Error(`Project installation manifest contains unknown host: ${hostId}.`);
  }
  const normalized = allowedHosts.filter((hostId) => hosts.includes(hostId));
  if (normalized.length !== hosts.length || normalized.some((hostId, index) => hostId !== hosts[index])) {
    throw new Error("Project installation manifest hosts must be unique and sorted in registry order.");
  }
  return hosts;
}
function validateManagedEntry(entry, index) {
  const label = `Project installation manifest managed[${index}]`;
  assertSealed(entry, MANAGED_FIELDS, label);
  canonicalProjectRelativePath(entry.path, `${label}.path`);
  nonEmptyString(entry.owner, `${label}.owner`);
  if (!MANAGED_MODES.has(entry.mode)) throw new Error(`${label}.mode is unsupported: ${entry.mode}.`);
  if (entry.mode === "exclusive-file") {
    if (entry.selector !== null) throw new Error(`${label}.selector must be null for exclusive-file ownership.`);
  } else {
    nonEmptyString(entry.selector, `${label}.selector`);
  }
  if (typeof entry.digest !== "string" || !SHA256.test(entry.digest)) throw new Error(`${label}.digest must be a lowercase 64-character SHA-256 digest.`);
  return entry;
}
function managedKey(entry) {
  return `${entry.path}\0${entry.mode}\0${entry.selector ?? ""}\0${entry.owner}`;
}
function compareManaged(left, right) {
  return left.path.localeCompare(right.path) || left.mode.localeCompare(right.mode) || String(left.selector ?? "").localeCompare(String(right.selector ?? "")) || left.owner.localeCompare(right.owner);
}
function validateManaged(managed) {
  if (!Array.isArray(managed)) throw new Error("Project installation manifest managed must be an array.");
  managed.forEach(validateManagedEntry);
  const keys = managed.map(managedKey);
  if (new Set(keys).size !== keys.length) throw new Error("Project installation manifest managed entries must be unique.");
  const sorted = [...managed].sort(compareManaged);
  if (sorted.some((entry, index) => entry !== managed[index])) throw new Error("Project installation manifest managed entries must use stable sort order.");
  return managed;
}
function normalizeCreatedAt(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return exactIsoTimestamp(value, "Project installation manifest timestamp");
  if (value === void 0) return (/* @__PURE__ */ new Date()).toISOString();
  throw new Error("Project installation manifest timestamp must be a Date or exact ISO timestamp.");
}
function cloneManagedEntry(entry) {
  return {
    path: entry.path,
    owner: entry.owner,
    mode: entry.mode,
    selector: entry.selector ?? null,
    digest: entry.digest
  };
}
function deepFreezeManifest(manifest) {
  Object.freeze(manifest.package);
  Object.freeze(manifest.runtime);
  Object.freeze(manifest.hosts);
  manifest.managed.forEach(Object.freeze);
  Object.freeze(manifest.managed);
  return Object.freeze(manifest);
}
function validateProjectInstallationManifest(value, options = {}) {
  const allowedHosts = normalizeAllowedHosts(options);
  const acceptedVersionPairs = options.acceptedVersionPairs ?? [[INSTALLATION_INTEGRATION_VERSION, INSTALLATION_OWNERSHIP_VERSION]];
  if (!Array.isArray(acceptedVersionPairs) || acceptedVersionPairs.length === 0 || acceptedVersionPairs.some((pair) => !Array.isArray(pair) || pair.length !== 2 || pair.some((version) => !Number.isSafeInteger(version) || version < 1))) {
    throw new Error("Project installation manifest validation requires explicit positive integration/ownership version pairs.");
  }
  assertSealed(value, MANIFEST_FIELDS, "Project installation manifest");
  exactPositiveInteger(value.schemaVersion, INSTALLATION_MANIFEST_SCHEMA_VERSION, "Project installation manifest schemaVersion");
  if (!acceptedVersionPairs.some(([integrationVersion, ownershipVersion]) => value.integrationVersion === integrationVersion && value.ownershipVersion === ownershipVersion)) {
    throw new Error(`Project installation manifest integrationVersion/ownershipVersion must equal one accepted pair: ${acceptedVersionPairs.map((pair) => pair.join("/")).join(", ")}.`);
  }
  nonEmptyString(value.installationId, "Project installation manifest installationId");
  if (!INSTALLATION_ID.test(value.installationId)) throw new Error("Project installation manifest installationId must use installation-<uuid> format.");
  assertSealed(value.package, PACKAGE_FIELDS, "Project installation manifest package");
  nonEmptyString(value.package.name, "Project installation manifest package.name");
  nonEmptyString(value.package.version, "Project installation manifest package.version");
  if (!SEMVER.test(value.package.version)) throw new Error("Project installation manifest package.version must be a semantic version.");
  assertSealed(value.runtime, RUNTIME_FIELDS, "Project installation manifest runtime");
  if (value.runtime.mode !== "user-cli") throw new Error("Project installation manifest runtime.mode must be user-cli.");
  const acceptedRuntimeProtocolVersions = options.acceptedRuntimeProtocolVersions ?? [INSTALLATION_RUNTIME_PROTOCOL_VERSION];
  if (!Array.isArray(acceptedRuntimeProtocolVersions) || acceptedRuntimeProtocolVersions.length === 0 || acceptedRuntimeProtocolVersions.some((version) => !Number.isSafeInteger(version) || version < 1) || !acceptedRuntimeProtocolVersions.includes(value.runtime.protocolVersion)) {
    throw new Error(`Project installation manifest runtime.protocolVersion must equal one accepted version: ${acceptedRuntimeProtocolVersions.join(", ")}.`);
  }
  validateHosts(value.hosts, allowedHosts);
  validateManaged(value.managed);
  const createdAt = exactIsoTimestamp(value.createdAt, "Project installation manifest createdAt");
  const updatedAt = exactIsoTimestamp(value.updatedAt, "Project installation manifest updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Project installation manifest updatedAt must not precede createdAt.");
  return value;
}
function createProjectInstallationManifest(input = {}, options = {}) {
  const allowedHosts = normalizeAllowedHosts(options);
  const hosts = allowedHosts.filter((hostId) => (input.hosts ?? []).includes(hostId));
  if ((input.hosts ?? []).some((hostId) => hostId === "all" || !allowedHosts.includes(hostId))) {
    throw new Error("Project installation manifest hosts must contain only concrete known host ids.");
  }
  const managedByKey = /* @__PURE__ */ new Map();
  for (const rawEntry of input.managed ?? []) {
    const entry = cloneManagedEntry(rawEntry);
    validateManagedEntry(entry, managedByKey.size);
    const key = managedKey(entry);
    const existing = managedByKey.get(key);
    if (existing && existing.digest !== entry.digest) throw new Error(`Conflicting project installation ownership entry: ${entry.path}.`);
    managedByKey.set(key, entry);
  }
  const createdAt = normalizeCreatedAt(input.createdAt ?? input.now);
  const updatedAt = normalizeCreatedAt(input.updatedAt ?? createdAt);
  const manifest = {
    schemaVersion: INSTALLATION_MANIFEST_SCHEMA_VERSION,
    integrationVersion: INSTALLATION_INTEGRATION_VERSION,
    ownershipVersion: INSTALLATION_OWNERSHIP_VERSION,
    installationId: input.installationId ?? `installation-${crypto2.randomUUID()}`,
    package: {
      name: input.package?.name,
      version: input.package?.version
    },
    runtime: {
      mode: "user-cli",
      protocolVersion: INSTALLATION_RUNTIME_PROTOCOL_VERSION
    },
    hosts,
    managed: [...managedByKey.values()].sort(compareManaged),
    createdAt,
    updatedAt
  };
  validateProjectInstallationManifest(manifest, { hostIds: allowedHosts });
  return deepFreezeManifest(manifest);
}
function serializeProjectInstallationManifest(value, options = {}) {
  validateProjectInstallationManifest(value, options);
  return `${JSON.stringify(value, null, 2)}
`;
}
function isPreviousProjectInstallationManifest(value) {
  return value?.schemaVersion === INSTALLATION_MANIFEST_SCHEMA_VERSION && value?.integrationVersion === PREVIOUS_INSTALLATION_INTEGRATION_VERSION && value?.ownershipVersion === PREVIOUS_INSTALLATION_OWNERSHIP_VERSION;
}
function inspectManifestFile(root, fsOps, manifestRelativePath = INSTALLATION_MANIFEST_PATH) {
  const installationDirectory = path3.join(root, path3.posix.dirname(manifestRelativePath));
  const directoryStat = fsOps.lstatSync(installationDirectory);
  if (directoryStat.isSymbolicLink()) throw new Error(`Dove project installation directory must not be a symbolic link: ${installationDirectory}.`);
  if (!directoryStat.isDirectory()) throw new Error(`Dove project installation path must be a directory: ${installationDirectory}.`);
  const manifestPath = path3.join(root, manifestRelativePath);
  let stat;
  try {
    stat = fsOps.lstatSync(manifestPath);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`Dove project installation manifest is missing: ${manifestRelativePath}.`);
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error(`Dove project installation manifest must not be a symbolic link: ${manifestRelativePath}.`);
  if (!stat.isFile()) throw new Error(`Dove project installation manifest must be a regular file: ${manifestRelativePath}.`);
  return manifestPath;
}
function readInstallationManifestAt(root, manifestRelativePath, options = {}) {
  const fsOps = options.fsOps ?? fs3;
  const manifestPath = inspectManifestFile(root, fsOps, manifestRelativePath);
  let parsed;
  try {
    parsed = parseJsonWithoutDuplicateKeys(fsOps.readFileSync(manifestPath, "utf8"), "Dove project installation manifest");
    validateProjectInstallationManifest(parsed, options.allowPrevious === true ? {
      ...options,
      acceptedVersionPairs: [
        [PREVIOUS_INSTALLATION_INTEGRATION_VERSION, PREVIOUS_INSTALLATION_OWNERSHIP_VERSION],
        [INSTALLATION_INTEGRATION_VERSION, INSTALLATION_OWNERSHIP_VERSION]
      ],
      acceptedRuntimeProtocolVersions: [1, INSTALLATION_RUNTIME_PROTOCOL_VERSION]
    } : options);
  } catch (error) {
    throw new Error(`Invalid Dove project installation manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  return deepFreezeManifest(structuredClone(parsed));
}
function readProjectInstallationManifest(root, options = {}) {
  return readInstallationManifestAt(root, INSTALLATION_MANIFEST_PATH, options);
}
function readLegacyProjectInstallationManifest(root, options = {}) {
  return readInstallationManifestAt(root, LEGACY_INSTALLATION_MANIFEST_PATH, options);
}

// src/core/workspace-schema.mjs
var DEFAULT_DOVE_LESSONS_MARKDOWN = "# Dove Lessons\n";
var FORMAT_FIELDS = /* @__PURE__ */ new Set(["format"]);
var WORKSPACE_FIELDS = /* @__PURE__ */ new Set(["workspaceId", "researchQuestion", "mainline", "contributionIntent", "currentFocus", "changeHistory", "createdAt", "updatedAt"]);
var HISTORY_FIELDS = /* @__PURE__ */ new Set(["changedAt", "summary"]);
function canonicalWorkspace(root) {
  return fs4.realpathSync.native(path4.resolve(root));
}
function existsNoFollow(fullPath) {
  try {
    fs4.lstatSync(fullPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
function requiredPathProblem(root, relativePath, kind) {
  const fullPath = path4.join(root, relativePath);
  if (!existsNoFollow(fullPath)) return `${relativePath} is missing`;
  const stat = fs4.lstatSync(fullPath);
  if (stat.isSymbolicLink()) return `${relativePath} must not be a symbolic link`;
  if (kind === "directory" && !stat.isDirectory()) return `${relativePath} must be a directory`;
  if (kind === "file" && !stat.isFile()) return `${relativePath} must be a regular file`;
  return null;
}
function readStrictJson(root, relativePath) {
  const problem = requiredPathProblem(root, relativePath, "file");
  if (problem) throw new Error(problem);
  return parseJsonWithoutDuplicateKeys(fs4.readFileSync(path4.join(root, relativePath), "utf8"), relativePath);
}
function validateResearchFormat(value) {
  assertFields(value, FORMAT_FIELDS, "Dove research format marker");
  if (value.format !== DOVE_RESEARCH_FORMAT) throw new Error(`Unsupported Dove research format ${String(value.format ?? "missing")}.`);
  return value;
}
function validateWorkspaceRecord(value) {
  assertFields(value, WORKSPACE_FIELDS, "Dove Workspace");
  researchId(value.workspaceId, "Dove Workspace workspaceId");
  for (const field of ["researchQuestion", "mainline", "contributionIntent", "currentFocus"]) nonEmptyText(value[field], `Dove Workspace ${field}`);
  exactTimestamp(value.createdAt, "Dove Workspace createdAt");
  exactTimestamp(value.updatedAt, "Dove Workspace updatedAt");
  if (value.updatedAt < value.createdAt) throw new Error("Dove Workspace updatedAt must not precede createdAt.");
  if (!Array.isArray(value.changeHistory) || value.changeHistory.length === 0) throw new Error("Dove Workspace changeHistory must contain at least one human-readable change.");
  value.changeHistory.forEach((entry, index) => {
    assertFields(entry, HISTORY_FIELDS, `Dove Workspace changeHistory[${index}]`);
    exactTimestamp(entry.changedAt, `Dove Workspace changeHistory[${index}].changedAt`);
    nonEmptyText(entry.summary, `Dove Workspace changeHistory[${index}].summary`);
    if (index > 0 && entry.changedAt < value.changeHistory[index - 1].changedAt) throw new Error("Dove Workspace changeHistory must be chronological.");
  });
  if (value.changeHistory.at(-1).changedAt !== value.updatedAt) throw new Error("Dove Workspace updatedAt must match the latest changeHistory entry.");
  return value;
}
function validateLessonsMarkdown(value, label = "Dove Lessons") {
  if (typeof value !== "string" || !value.trim() || !value.endsWith("\n") || value.includes("\0")) throw new Error(`${label} must be non-empty newline-terminated Markdown without null bytes.`);
  return value;
}
function detectLegacy(root) {
  const manifestPath = path4.join(root, ".dove/manifest.json");
  if (!existsNoFollow(manifestPath)) return null;
  try {
    return parseJsonWithoutDuplicateKeys(fs4.readFileSync(manifestPath, "utf8"), ".dove/manifest.json")?.schemaVersion ?? null;
  } catch {
    return null;
  }
}
function inspectInstallOnlyWorkspace(root) {
  const doveRoot = path4.join(root, ARTIFACT_PATHS.doveRoot);
  const children = fs4.readdirSync(doveRoot).map(String).sort();
  if (!children.includes("install") || children.some((child) => !["archive", "install"].includes(child))) return null;
  if (children.includes("archive")) {
    const archiveProblem = requiredPathProblem(root, ".dove/archive", "directory");
    if (archiveProblem) return { state: "invalid-install-only", category: "invalid", healthy: false, error: archiveProblem };
  }
  if (children.includes("install")) {
    const directoryProblem = requiredPathProblem(root, ARTIFACT_PATHS.installDir, "directory");
    if (directoryProblem) return { state: "invalid-install-only", category: "invalid", healthy: false, error: directoryProblem };
    const allowedInstallChildren = /* @__PURE__ */ new Set(["manifest.json", "transactions"]);
    const installDirectory = path4.join(root, ARTIFACT_PATHS.installDir);
    const installChildren = fs4.readdirSync(installDirectory).map(String).sort();
    const unknownChildren = installChildren.filter((child) => !allowedInstallChildren.has(child));
    if (unknownChildren.length > 0) {
      return { state: "invalid-install-only", category: "invalid", healthy: false, error: `${ARTIFACT_PATHS.installDir} contains unsupported children: ${unknownChildren.join(", ")}` };
    }
    const manifestProblem = requiredPathProblem(root, INSTALLATION_MANIFEST_PATH, "file");
    if (manifestProblem) return { state: "invalid-install-only", category: "invalid", healthy: false, error: manifestProblem };
    if (installChildren.includes("transactions")) {
      const transactionsProblem = requiredPathProblem(root, ARTIFACT_PATHS.transactionsDir, "directory");
      if (transactionsProblem) return { state: "invalid-install-only", category: "invalid", healthy: false, error: transactionsProblem };
    }
  }
  return { state: "research-absent", category: "absent", healthy: true, format: null };
}
function inspectDoveWorkspace(root) {
  const workspace = canonicalWorkspace(root);
  const doveRoot = path4.join(workspace, ARTIFACT_PATHS.doveRoot);
  if (!existsNoFollow(doveRoot)) return { workspace, state: "absent", category: "absent", healthy: false, format: null };
  const rootStat = fs4.lstatSync(doveRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return { workspace, state: "invalid-root", category: "invalid", healthy: false, format: null, error: ".dove must be a real directory." };
  const formatPath = path4.join(workspace, ARTIFACT_PATHS.format);
  if (!existsNoFollow(formatPath)) {
    const detectedSchema = detectLegacy(workspace);
    if (detectedSchema !== null) return { workspace, state: "legacy-schema", category: "legacy", healthy: false, format: null, detectedSchema };
    const installOnly = inspectInstallOnlyWorkspace(workspace);
    return installOnly ? { workspace, ...installOnly } : { workspace, state: "unknown-format", category: "unknown", healthy: false, format: null };
  }
  let marker;
  try {
    marker = readStrictJson(workspace, ARTIFACT_PATHS.format);
  } catch (error) {
    return { workspace, state: "malformed-format", category: "invalid", healthy: false, format: null, error: error.message };
  }
  if (marker?.format !== DOVE_RESEARCH_FORMAT) return { workspace, state: "unsupported-format", category: "unknown", healthy: false, format: marker?.format ?? null, marker };
  try {
    validateResearchFormat(marker);
    const problems = [...RESEARCH_DIRECTORIES.map((relativePath) => requiredPathProblem(workspace, relativePath, "directory")), ...RESEARCH_REQUIRED_FILES.map((relativePath) => requiredPathProblem(workspace, relativePath, "file"))].filter(Boolean);
    if (problems.length) throw new Error(`Dove Research Format 1 layout is incomplete: ${problems.join("; ")}.`);
    const workspaceRecord2 = validateWorkspaceRecord(readStrictJson(workspace, ARTIFACT_PATHS.workspace));
    const lessons = fs4.readFileSync(path4.join(workspace, ARTIFACT_PATHS.lessons), "utf8");
    validateLessonsMarkdown(lessons, ARTIFACT_PATHS.lessons);
    return { workspace, state: "current-healthy", category: "current", healthy: true, format: DOVE_RESEARCH_FORMAT, marker, workspaceRecord: workspaceRecord2, lessons };
  } catch (error) {
    return { workspace, state: "current-unhealthy", category: "invalid", healthy: false, format: DOVE_RESEARCH_FORMAT, marker, error: error.message };
  }
}
function workspaceFormatError(inspection, operation = "Dove operation") {
  if (inspection.state === "absent" || inspection.state === "research-absent") return new Error(`${operation} requires an initialized ${DOVE_RESEARCH_FORMAT} workspace.`);
  if (inspection.category === "legacy") return new Error(`${operation} recognizes legacy Dove Schema ${inspection.detectedSchema ?? LEGACY_DOVE_SCHEMA_VERSION} read-only and refuses to write. Dove does not migrate, move, archive, reset, or replace the existing .dove directory.`);
  if (inspection.category === "unknown") return new Error(`${operation} recognizes unsupported Dove format ${inspection.format ?? "unknown"} read-only and refuses to write. No files were changed.`);
  return new Error(`${operation} refuses invalid Dove Research Format 1 state ${inspection.state}${inspection.error ? `: ${inspection.error}` : ""}. No files were changed.`);
}
function openDoveWorkspace(root, options = {}) {
  const inspection = inspectDoveWorkspace(root);
  if ((inspection.state === "absent" || inspection.state === "research-absent") && options.allowAbsent === true) return inspection;
  if (inspection.state === "research-absent") throw workspaceFormatError(inspection, options.operation);
  if (inspection.healthy) return inspection;
  throw workspaceFormatError(inspection, options.operation);
}

// src/core/workspace-init.mjs
function timestamp(value, label) {
  return value === void 0 ? (/* @__PURE__ */ new Date()).toISOString() : exactTimestamp(value, label);
}
function workspaceRecord(args, createdAt) {
  return validateWorkspaceRecord({
    workspaceId: args.workspaceId ?? newResearchId("workspace"),
    researchQuestion: nonEmptyText(args.researchQuestion, "Workspace researchQuestion"),
    mainline: nonEmptyText(args.mainline, "Workspace mainline"),
    contributionIntent: nonEmptyText(args.contributionIntent, "Workspace contributionIntent"),
    currentFocus: nonEmptyText(args.currentFocus, "Workspace currentFocus"),
    changeHistory: [{ changedAt: createdAt, summary: nonEmptyText(args.changeSummary ?? "Established the initial research direction.", "Workspace change summary") }],
    createdAt,
    updatedAt: createdAt
  });
}
function initializeResearchWorkspace(root, args = {}) {
  const inspection = inspectDoveWorkspace(root);
  if (!["absent", "research-absent"].includes(inspection.state)) throw new Error(`Workspace initialization refuses existing .dove state (${inspection.state}). Dove does not migrate, move, archive, reset, or replace it.`);
  const createdAt = timestamp(args.createdAt, "Workspace createdAt");
  const workspace = workspaceRecord(args, createdAt);
  const anchor = openAnchoredFilesystem(fs5.realpathSync.native(path5.resolve(root)), args);
  const createdPaths = [];
  try {
    if (inspection.state === "absent") {
      anchor.mkdir(ARTIFACT_PATHS.doveRoot);
      createdPaths.push(ARTIFACT_PATHS.doveRoot);
    }
    for (const directory of RESEARCH_DIRECTORIES) {
      if (anchor.exists(directory)) throw new Error(`Workspace initialization detected concurrent research state at ${directory}.`);
      anchor.mkdir(directory, { recursive: true });
      createdPaths.push(directory);
    }
    for (const [relativePath, content] of [
      [ARTIFACT_PATHS.workspace, jsonDocument(workspace)],
      [ARTIFACT_PATHS.lessons, DEFAULT_DOVE_LESSONS_MARKDOWN],
      [ARTIFACT_PATHS.format, jsonDocument({ format: DOVE_RESEARCH_FORMAT })]
    ]) {
      if (anchor.exists(relativePath)) throw new Error(`Workspace initialization detected concurrent research state at ${relativePath}.`);
      anchor.writeNewFile(relativePath, content, { mode: 384 });
      createdPaths.push(relativePath);
    }
  } catch (error) {
    for (const relativePath of [...createdPaths].reverse()) {
      if (!anchor.exists(relativePath)) continue;
      const stat = anchor.lstat(relativePath);
      if (stat.isDirectory()) anchor.rmdir(relativePath, { force: true });
      else anchor.unlink(relativePath, { force: true });
    }
    throw error;
  } finally {
    anchor.close();
  }
  return openDoveWorkspace(root, { operation: "Workspace initialization readback" });
}
function updateResearchMainline(root, args = {}) {
  const opened = openDoveWorkspace(root, { operation: "Workspace mainline update" });
  const changedAt = timestamp(args.changedAt, "Workspace changedAt");
  const next = validateWorkspaceRecord({
    ...opened.workspaceRecord,
    researchQuestion: args.researchQuestion ?? opened.workspaceRecord.researchQuestion,
    mainline: args.mainline ?? opened.workspaceRecord.mainline,
    contributionIntent: args.contributionIntent ?? opened.workspaceRecord.contributionIntent,
    currentFocus: args.currentFocus ?? opened.workspaceRecord.currentFocus,
    changeHistory: [...opened.workspaceRecord.changeHistory, { changedAt, summary: nonEmptyText(args.changeSummary, "Workspace change summary") }],
    updatedAt: changedAt
  });
  writeResearchJsonAtomic(root, ARTIFACT_PATHS.workspace, next, { expectedContent: readResearchText(root, ARTIFACT_PATHS.workspace), label: "Workspace" });
  return next;
}

// src/core/research-stores.mjs
import fs7 from "node:fs";
import path7 from "node:path";

// src/core/review-artifact-snapshot.mjs
import crypto3 from "node:crypto";
import fs6 from "node:fs";
import path6 from "node:path";
var HASH_PATTERN = /^[a-f0-9]{64}$/u;
function sha256Buffer(value) {
  return crypto3.createHash("sha256").update(value).digest("hex");
}
function canonicalRoot2(root) {
  return fs6.realpathSync.native(path6.resolve(root));
}
function containedFile(root, relativePath, label) {
  const normalized = normalizedRelativePath(relativePath, label);
  const canonical = canonicalRoot2(root);
  let current = canonical;
  for (const segment of normalized.split("/")) {
    current = path6.join(current, segment);
    const stat2 = fs6.lstatSync(current);
    if (stat2.isSymbolicLink()) throw new Error(`${label} must not contain symbolic links: ${normalized}.`);
  }
  const stat = fs6.lstatSync(current);
  if (!stat.isFile() || stat.size === 0) throw new Error(`${label} must be an existing non-empty regular file: ${normalized}.`);
  const real = fs6.realpathSync.native(current);
  const relative = path6.relative(canonical, real);
  if (relative.startsWith("..") || path6.isAbsolute(relative)) throw new Error(`${label} must stay inside the project: ${normalized}.`);
  if (relative.split(path6.sep).join("/") !== normalized) throw new Error(`${label} must use its canonical project-relative path: ${normalized}.`);
  return { fullPath: real, path: normalized, sizeBytes: stat.size };
}
function sha256File(fullPath) {
  return sha256Buffer(fs6.readFileSync(fullPath));
}
function stableSnapshotSetHash(snapshots = []) {
  const canonical = [...snapshots].map(({ path: artifactPath, sizeBytes, sha256: sha2565 }) => ({ path: artifactPath, sizeBytes, sha256: sha2565 })).sort((left, right) => left.path.localeCompare(right.path));
  return sha256Buffer(`${JSON.stringify(canonical)}
`);
}
function snapshotReviewedArtifacts(root, relativePaths, label = "reviewed artifacts") {
  if (!Array.isArray(relativePaths) || relativePaths.length === 0) throw new Error(`${label} requires at least one project-relative path.`);
  const snapshots = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, relativePath] of relativePaths.entries()) {
    const file2 = containedFile(root, relativePath, `${label}[${index}]`);
    if (seen.has(file2.path)) continue;
    seen.add(file2.path);
    snapshots.push({ path: file2.path, sizeBytes: file2.sizeBytes, sha256: sha256File(file2.fullPath) });
  }
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { reviewedArtifacts: snapshots, reviewedArtifactSetSha256: stableSnapshotSetHash(snapshots) };
}
function normalizeReviewSnapshots(value, label = "reviewedArtifacts") {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, snapshots: [], reason: `${label} must contain artifact snapshots` };
  const snapshots = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, snapshots: [], reason: `${label}[${index}] must be an object` };
    if (Object.keys(item).some((field) => !["path", "sizeBytes", "sha256"].includes(field))) return { ok: false, snapshots: [], reason: `${label}[${index}] has unknown fields` };
    let artifactPath;
    try {
      artifactPath = normalizedRelativePath(item.path, `${label}[${index}].path`);
    } catch (error) {
      return { ok: false, snapshots: [], reason: error instanceof Error ? error.message : String(error) };
    }
    if (!Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !HASH_PATTERN.test(String(item.sha256 ?? ""))) return { ok: false, snapshots: [], reason: `${label}[${index}] is invalid` };
    if (seen.has(artifactPath)) return { ok: false, snapshots: [], reason: `${label} contains duplicate paths` };
    seen.add(artifactPath);
    snapshots.push({ path: artifactPath, sizeBytes: item.sizeBytes, sha256: item.sha256 });
  }
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { ok: true, snapshots, reason: null };
}
function verifyReviewSnapshotSet(root, preparedSnapshots, expectedSetHash) {
  const normalized = normalizeReviewSnapshots(preparedSnapshots);
  if (!normalized.ok) return { ok: false, failures: [normalized.reason], reviewedArtifacts: [], reviewedArtifactSetSha256: null };
  const failures = [];
  const setHash = stableSnapshotSetHash(normalized.snapshots);
  if (setHash !== expectedSetHash) failures.push("reviewed-artifact-set-hash-mismatch");
  for (const prepared of normalized.snapshots) {
    try {
      const current = snapshotReviewedArtifacts(root, [prepared.path]).reviewedArtifacts[0];
      if (JSON.stringify(current) !== JSON.stringify(prepared)) failures.push(`reviewed-artifact-changed:${prepared.path}`);
    } catch {
      failures.push(`reviewed-artifact-unavailable:${prepared.path}`);
    }
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)], reviewedArtifacts: normalized.snapshots, reviewedArtifactSetSha256: setHash };
}

// src/core/research-stores.mjs
var EXPERIMENT_RESULT_KINDS = Object.freeze(["positive", "negative", "null", "mixed", "failed", "stopped"]);
var CLAIM_ASSESSMENTS = Object.freeze(["supported", "weakened", "refuted", "inconclusive", "blocked"]);
var SOURCE_RELATIONSHIPS = Object.freeze(["consensus", "conflict", "condition-specific", "uncovered", "testable-gap"]);
var REVIEW_STATUSES = Object.freeze(["completed", "blocked", "failed"]);
var MISSION_FIELDS = /* @__PURE__ */ new Set(["missionId", "parentMissionId", "dependsOnMissionIds", "branchKind", "branchReason", "goal", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs", "contributionRole", "createdAt"]);
var CONCLUSION_FIELDS = /* @__PURE__ */ new Set(["missionId", "synthesis", "failures", "limitations", "uncertainty", "sourceIds", "experimentIds", "claimIds", "recommendedBranches", "concludedAt"]);
var SOURCE_FIELDS = /* @__PURE__ */ new Set(["sourceId", "missionId", "citationKey", "title", "authors", "year", "locator", "sourceType", "summary", "conditions", "relationship", "conflicts", "limitations", "capture", "recordedAt"]);
var CAPTURE_FIELDS = /* @__PURE__ */ new Set(["path", "sizeBytes", "sha256"]);
var PLAN_FIELDS = /* @__PURE__ */ new Set(["experimentId", "missionId", "title", "hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts", "cost", "risk", "failureValue", "contributionRole", "plannedAt"]);
var RESULT_FIELDS = /* @__PURE__ */ new Set(["experimentId", "missionId", "kind", "summary", "observations", "measurements", "denominator", "hypothesisImpacts", "claimImpacts", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations", "recordedAt"]);
var CLAIM_FIELDS = /* @__PURE__ */ new Set(["claimId", "missionId", "statement", "supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "assessment", "storyRole", "artifactRefs", "recordedAt"]);
var REVIEW_FIELDS = /* @__PURE__ */ new Set(["reviewId", "missionId", "status", "verdict", "summary", "rubric", "reviewedArtifacts", "reviewedArtifactSetSha256", "findings", "actionItems", "report", "provenance", "limitations", "reviewedAt"]);
function file(directory, id, suffix = "") {
  return path7.posix.join(directory, `${id}${suffix}.json`);
}
function missionPath(id) {
  return file(ARTIFACT_PATHS.missionsDir, id);
}
function conclusionPath(id) {
  return file(ARTIFACT_PATHS.missionsDir, id, ".conclusion");
}
function planPath(id) {
  return file(ARTIFACT_PATHS.experimentsDir, id, ".plan");
}
function resultPath(id) {
  return file(ARTIFACT_PATHS.experimentsDir, id, ".result");
}
function now(value, label) {
  return value === void 0 ? (/* @__PURE__ */ new Date()).toISOString() : exactTimestamp(value, label);
}
function textFields(value, fields, label) {
  for (const field of fields) nonEmptyText(value[field], `${label}.${field}`);
}
function arrayFields(value, fields, label, minimum = {}) {
  for (const field of fields) stringArray(value[field], `${label}.${field}`, { min: minimum[field] ?? 0 });
}
function listJson(root, directory) {
  return fs7.readdirSync(path7.join(root, directory), { withFileTypes: true }).filter((entry) => {
    if (entry.isSymbolicLink()) throw new Error(`${directory}/${entry.name} must not be a symbolic link.`);
    return entry.isFile() && entry.name.endsWith(".json");
  }).map((entry) => path7.posix.join(directory, entry.name)).sort();
}
function ensureMission(root, missionId) {
  const mission = readMission(root, missionId);
  if (!mission) throw new Error(`Unknown Mission ${missionId}.`);
  return mission;
}
function validateMission(value, label = "Mission") {
  assertFields(value, MISSION_FIELDS, label);
  researchId(value.missionId, `${label}.missionId`);
  if (value.parentMissionId !== null) researchId(value.parentMissionId, `${label}.parentMissionId`);
  arrayFields(value, ["dependsOnMissionIds", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs"], label);
  textFields(value, ["goal", "contributionRole"], label);
  exactTimestamp(value.createdAt, `${label}.createdAt`);
  if (value.parentMissionId === null && (value.branchKind !== null || value.branchReason !== null)) throw new Error(`${label} root must not declare branch metadata.`);
  if (value.parentMissionId !== null) textFields(value, ["branchKind", "branchReason"], label);
  return value;
}
function readMission(root, missionId) {
  openDoveWorkspace(root, { operation: "Mission read" });
  return readResearchJson(root, missionPath(researchId(missionId, "missionId")), { fallback: null });
}
function validateMissionTree(missions) {
  const byId = /* @__PURE__ */ new Map();
  for (const mission of missions) {
    validateMission(mission);
    if (byId.has(mission.missionId)) throw new Error(`Duplicate Mission ${mission.missionId}.`);
    byId.set(mission.missionId, mission);
  }
  for (const mission of byId.values()) for (const target of [...mission.dependsOnMissionIds, ...mission.parentMissionId ? [mission.parentMissionId] : []]) if (!byId.has(target)) throw new Error(`Mission ${mission.missionId} references unknown Mission ${target}.`);
  const check = (edges) => {
    const active = /* @__PURE__ */ new Set();
    const done = /* @__PURE__ */ new Set();
    const visit = (id) => {
      if (active.has(id)) throw new Error(`Mission tree contains a cycle at ${id}.`);
      if (done.has(id)) return;
      active.add(id);
      edges(byId.get(id)).forEach(visit);
      active.delete(id);
      done.add(id);
    };
    [...byId.keys()].forEach(visit);
  };
  check((mission) => mission.parentMissionId ? [mission.parentMissionId] : []);
  check((mission) => mission.dependsOnMissionIds);
  return byId;
}
function readMissionTree(root) {
  openDoveWorkspace(root, { operation: "Mission tree read" });
  const missions = validateMissionTree(listJson(root, ARTIFACT_PATHS.missionsDir).filter((item) => !item.endsWith(".conclusion.json")).map((item) => readResearchJson(root, item)));
  const children = new Map([...missions.keys()].map((id) => [id, []]));
  for (const mission of missions.values()) if (mission.parentMissionId) children.get(mission.parentMissionId).push(mission.missionId);
  for (const values of children.values()) values.sort();
  return { missions, children, roots: [...missions.values()].filter((mission) => mission.parentMissionId === null).map((mission) => mission.missionId).sort() };
}
function createMission(root, args = {}) {
  const graph = readMissionTree(root);
  const mission = validateMission({
    missionId: args.missionId ?? newResearchId("mission"),
    parentMissionId: args.parentMissionId ?? null,
    dependsOnMissionIds: args.dependsOnMissionIds ?? [],
    branchKind: args.branchKind ?? null,
    branchReason: args.branchReason ?? null,
    goal: args.goal,
    requirements: args.requirements ?? [],
    assumptions: args.assumptions ?? [],
    scope: args.scope ?? [],
    outOfScope: args.outOfScope ?? [],
    evidenceRequirements: args.evidenceRequirements ?? [],
    competingHypotheses: args.competingHypotheses ?? [],
    openQuestions: args.openQuestions ?? [],
    contextRefs: args.contextRefs ?? [],
    contributionRole: args.contributionRole,
    createdAt: now(args.createdAt, "Mission createdAt")
  });
  if (graph.missions.has(mission.missionId)) throw new Error(`Mission contract is immutable and already exists: ${mission.missionId}.`);
  for (const target of [...mission.dependsOnMissionIds, ...mission.parentMissionId ? [mission.parentMissionId] : []]) if (!graph.missions.has(target)) throw new Error(`Mission ${mission.missionId} references unknown Mission ${target}.`);
  validateMissionTree([...graph.missions.values(), mission]);
  writeResearchJsonAtomic(root, missionPath(mission.missionId), mission, { ifAbsent: true, label: "Mission contract" });
  return mission;
}
function missionReadableIds(root, missionId) {
  const tree = readMissionTree(root);
  if (!tree.missions.has(missionId)) throw new Error(`Unknown Mission ${missionId}.`);
  const readable = /* @__PURE__ */ new Set();
  const visit = (id) => {
    if (readable.has(id)) return;
    readable.add(id);
    const mission = tree.missions.get(id);
    if (mission.parentMissionId) visit(mission.parentMissionId);
    mission.dependsOnMissionIds.forEach(visit);
  };
  visit(missionId);
  return readable;
}
function concludeMission(root, args = {}) {
  ensureMission(root, args.missionId);
  const conclusion = { missionId: args.missionId, synthesis: args.synthesis, failures: args.failures ?? [], limitations: args.limitations ?? [], uncertainty: args.uncertainty ?? [], sourceIds: args.sourceIds ?? [], experimentIds: args.experimentIds ?? [], claimIds: args.claimIds ?? [], recommendedBranches: args.recommendedBranches ?? [], concludedAt: now(args.concludedAt, "Mission conclusion concludedAt") };
  assertFields(conclusion, CONCLUSION_FIELDS, "Mission conclusion");
  nonEmptyText(conclusion.synthesis, "Mission conclusion synthesis");
  arrayFields(conclusion, ["failures", "limitations", "uncertainty", "sourceIds", "experimentIds", "claimIds", "recommendedBranches"], "Mission conclusion");
  writeResearchJsonAtomic(root, conclusionPath(conclusion.missionId), conclusion, { ifAbsent: true, label: "Mission conclusion" });
  return conclusion;
}
function recordSource(root, args = {}) {
  ensureMission(root, args.missionId);
  let capture = null;
  if (args.capturePath) {
    const capturePath = normalizedRelativePath(args.capturePath, "Source capturePath");
    const full = path7.join(fs7.realpathSync.native(path7.resolve(root)), capturePath);
    const stat = fs7.lstatSync(full);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Source capturePath must be a regular file without symbolic links.");
    const bytes = fs7.readFileSync(full);
    capture = { path: capturePath, sizeBytes: bytes.byteLength, sha256: sha256(bytes) };
  }
  const source = { sourceId: args.sourceId ?? newResearchId("source"), missionId: args.missionId, citationKey: args.citationKey ?? null, title: args.title ?? null, authors: args.authors ?? [], year: args.year ?? null, locator: args.locator ?? null, sourceType: args.sourceType ?? null, summary: args.summary, conditions: args.conditions ?? [], relationship: args.relationship, conflicts: args.conflicts ?? [], limitations: args.limitations ?? [], capture, recordedAt: now(args.recordedAt, "Source recordedAt") };
  assertFields(source, SOURCE_FIELDS, "Source");
  researchId(source.sourceId, "Source.sourceId");
  if (!source.title && !source.locator) throw new Error("Source requires title or locator.");
  nonEmptyText(source.summary, "Source.summary");
  enumeration(source.relationship, SOURCE_RELATIONSHIPS, "Source.relationship");
  arrayFields(source, ["authors", "conditions", "conflicts", "limitations"], "Source");
  if (capture) assertFields(capture, CAPTURE_FIELDS, "Source.capture");
  writeResearchJsonAtomic(root, file(ARTIFACT_PATHS.sourcesDir, source.sourceId), source, { ifAbsent: true, label: "Source" });
  return source;
}
function createExperimentPlan(root, args = {}) {
  ensureMission(root, args.missionId);
  const plan = { experimentId: args.experimentId ?? newResearchId("experiment"), missionId: args.missionId, title: args.title, hypothesisRefs: args.hypothesisRefs ?? [], protocol: args.protocol ?? [], inputs: args.inputs ?? [], comparisons: args.comparisons ?? [], metrics: args.metrics ?? [], discriminatingObservations: args.discriminatingObservations ?? [], successConditions: args.successConditions ?? [], stopConditions: args.stopConditions ?? [], constraints: args.constraints ?? [], expectedArtifacts: args.expectedArtifacts ?? [], cost: args.cost, risk: args.risk, failureValue: args.failureValue, contributionRole: args.contributionRole, plannedAt: now(args.plannedAt, "Experiment plan plannedAt") };
  assertFields(plan, PLAN_FIELDS, "Experiment plan");
  researchId(plan.experimentId, "Experiment plan.experimentId");
  textFields(plan, ["title", "cost", "risk", "failureValue", "contributionRole"], "Experiment plan");
  arrayFields(plan, ["hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts"], "Experiment plan", { protocol: 1, inputs: 1, metrics: 1, discriminatingObservations: 1, stopConditions: 1 });
  writeResearchJsonAtomic(root, planPath(plan.experimentId), plan, { ifAbsent: true, label: "Experiment plan" });
  return plan;
}
function recordExperimentResult(root, args = {}) {
  const experimentId = researchId(args.experimentId, "Experiment result.experimentId");
  const plan = readResearchJson(root, planPath(experimentId), { fallback: null });
  if (!plan) throw new Error("Experiment result requires a prior persisted protocol plan.");
  if (plan.missionId !== args.missionId) throw new Error("Experiment result missionId must match its plan.");
  const result = { experimentId, missionId: args.missionId, kind: args.kind, summary: args.summary, observations: args.observations ?? [], measurements: args.measurements ?? [], denominator: args.denominator, hypothesisImpacts: args.hypothesisImpacts ?? [], claimImpacts: args.claimImpacts ?? [], unexpectedObservations: args.unexpectedObservations ?? [], uncertainty: args.uncertainty ?? [], artifactRefs: args.artifactRefs ?? [], failures: args.failures ?? [], deviations: args.deviations ?? [], limitations: args.limitations ?? [], recordedAt: now(args.recordedAt, "Experiment result recordedAt") };
  assertFields(result, RESULT_FIELDS, "Experiment result");
  enumeration(result.kind, EXPERIMENT_RESULT_KINDS, "Experiment result.kind");
  nonEmptyText(result.summary, "Experiment result.summary");
  assertPlainObject(result.denominator, "Experiment result.denominator");
  if (!Array.isArray(result.measurements) || !Array.isArray(result.hypothesisImpacts) || !Array.isArray(result.claimImpacts)) throw new Error("Experiment result measurements and impacts must be arrays.");
  arrayFields(result, ["observations", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations"], "Experiment result");
  if (["failed", "stopped"].includes(result.kind) && result.failures.length + result.limitations.length === 0) throw new Error("Failed or stopped Experiment results must preserve failures or limitations.");
  writeResearchJsonAtomic(root, resultPath(experimentId), result, { ifAbsent: true, label: "Experiment result" });
  return result;
}
function recordClaim(root, args = {}) {
  ensureMission(root, args.missionId);
  const claim = { claimId: args.claimId ?? newResearchId("claim"), missionId: args.missionId, statement: args.statement, supportRefs: args.supportRefs ?? [], counterEvidenceRefs: args.counterEvidenceRefs ?? [], missingEvidence: args.missingEvidence ?? [], cannotSay: args.cannotSay ?? [], uncertainty: args.uncertainty ?? [], assessment: args.assessment, storyRole: args.storyRole, artifactRefs: args.artifactRefs ?? [], recordedAt: now(args.recordedAt, "Claim recordedAt") };
  assertFields(claim, CLAIM_FIELDS, "Claim");
  researchId(claim.claimId, "Claim.claimId");
  textFields(claim, ["statement", "storyRole"], "Claim");
  enumeration(claim.assessment, CLAIM_ASSESSMENTS, "Claim.assessment");
  arrayFields(claim, ["supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "artifactRefs"], "Claim");
  if (!claim.supportRefs.length) throw new Error("Claim requires supportRefs.");
  if (!claim.cannotSay.length) throw new Error("Claim requires an explicit cannotSay boundary.");
  writeResearchJsonAtomic(root, file(ARTIFACT_PATHS.claimsDir, claim.claimId), claim, { ifAbsent: true, label: "Claim" });
  return claim;
}
function recordReview(root, args = {}) {
  ensureMission(root, args.missionId);
  const snapshots = snapshotReviewedArtifacts(root, args.artifactPaths, "Review artifacts");
  const review = { reviewId: args.reviewId ?? newResearchId("review"), missionId: args.missionId, status: args.status, verdict: args.verdict, summary: args.summary, rubric: args.rubric ?? [], reviewedArtifacts: snapshots.reviewedArtifacts, reviewedArtifactSetSha256: snapshots.reviewedArtifactSetSha256, findings: args.findings ?? [], actionItems: args.actionItems ?? [], report: args.report, provenance: args.provenance, limitations: args.limitations ?? [], reviewedAt: now(args.reviewedAt, "Review reviewedAt") };
  assertFields(review, REVIEW_FIELDS, "Review");
  researchId(review.reviewId, "Review.reviewId");
  enumeration(review.status, REVIEW_STATUSES, "Review.status");
  textFields(review, ["verdict", "summary", "report"], "Review");
  arrayFields(review, ["rubric", "actionItems", "limitations"], "Review", { rubric: 1 });
  if (!Array.isArray(review.findings)) throw new Error("Review.findings must be an array.");
  assertPlainObject(review.provenance, "Review.provenance");
  writeResearchJsonAtomic(root, file(ARTIFACT_PATHS.reviewsDir, review.reviewId), review, { ifAbsent: true, label: "Review" });
  return review;
}
function verifyReview(root, reviewId) {
  const review = readResearchJson(root, file(ARTIFACT_PATHS.reviewsDir, researchId(reviewId, "reviewId")), { fallback: null });
  if (!review) return null;
  const verified = verifyReviewSnapshotSet(root, review.reviewedArtifacts, review.reviewedArtifactSetSha256);
  return { review, ...verified };
}
function readLessons(root) {
  return readResearchText(root, ARTIFACT_PATHS.lessons);
}
function replaceLessons(root, markdown) {
  openDoveWorkspace(root, { operation: "Lessons replacement" });
  validateLessonsMarkdown(markdown, "Lessons replacement");
  writeResearchFileAtomic(root, ARTIFACT_PATHS.lessons, markdown, { label: "Lessons" });
  return markdown;
}

// src/core/research-context.mjs
var RESEARCH_CONTEXT_VIEWS = Object.freeze([
  "overview",
  "diagnosis",
  "related-work",
  "hypotheses",
  "experiment-options",
  "result-synthesis",
  "claim-story",
  "branch-synthesis",
  "reviews"
]);
var VIEW_SET = new Set(RESEARCH_CONTEXT_VIEWS);
var RESULT_KINDS = Object.freeze(["positive", "negative", "null", "mixed", "failed", "stopped"]);
var MODEL_FIELDS = /* @__PURE__ */ new Set(["workspace", "missions", "sources", "experiments", "claims", "reviews", "lessons"]);
var INPUT_FIELDS = /* @__PURE__ */ new Set(["experimentCandidates", "lessonApplications", "hostAnalysis"]);
var QUERY_FIELDS = /* @__PURE__ */ new Set(["view", "missionIds", "branchMissionIds"]);
var WORKSPACE_FIELDS2 = /* @__PURE__ */ new Set(["workspaceId", "researchQuestion", "mainline", "contributionIntent", "currentFocus", "changeHistory", "createdAt", "updatedAt"]);
var MISSION_FIELDS2 = /* @__PURE__ */ new Set(["missionId", "parentMissionId", "dependsOnMissionIds", "branchKind", "branchReason", "goal", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs", "contributionRole", "createdAt"]);
var SOURCE_FIELDS2 = /* @__PURE__ */ new Set(["sourceId", "missionId", "citationKey", "title", "authors", "year", "locator", "sourceType", "summary", "conditions", "relationship", "conflicts", "limitations", "capture", "recordedAt"]);
var CAPTURE_FIELDS2 = /* @__PURE__ */ new Set(["path", "sizeBytes", "sha256"]);
var EXPERIMENT_FIELDS = /* @__PURE__ */ new Set(["plan", "result"]);
var PLAN_FIELDS2 = /* @__PURE__ */ new Set(["experimentId", "missionId", "title", "hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts", "cost", "risk", "failureValue", "contributionRole", "plannedAt"]);
var RESULT_FIELDS2 = /* @__PURE__ */ new Set(["experimentId", "missionId", "kind", "summary", "observations", "measurements", "denominator", "hypothesisImpacts", "claimImpacts", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations", "recordedAt"]);
var CLAIM_FIELDS2 = /* @__PURE__ */ new Set(["claimId", "missionId", "statement", "supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "assessment", "storyRole", "artifactRefs", "recordedAt"]);
var REVIEW_FIELDS2 = /* @__PURE__ */ new Set(["reviewId", "missionId", "status", "verdict", "summary", "rubric", "reviewedArtifacts", "reviewedArtifactSetSha256", "findings", "actionItems", "report", "provenance", "limitations", "reviewedAt"]);
var CANDIDATE_FIELDS = /* @__PURE__ */ new Set(["candidateId", "title", "source", "missionId", "hypothesisRefs", "protocol", "discriminatingObservations", "cost", "risk", "failureValue", "contributionRole"]);
function plain(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  return value;
}
function sealed(value, fields, label, requireAll = true) {
  plain(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
  if (requireAll) {
    for (const field of fields) if (!Object.hasOwn(value, field)) throw new Error(`${label} requires ${field}.`);
  }
  return value;
}
function text(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim().replace(/\s+/gu, " ");
}
function optionalText(value, label) {
  return value === null ? null : text(value, label);
}
function list(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}
function strings(value, label) {
  return list(value, label).map((item, index) => text(item, `${label}[${index}]`));
}
function records(value, label) {
  return value instanceof Map ? [...value.values()] : list(value, label);
}
function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
}
function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) freeze(item);
  return Object.freeze(value);
}
function immutable(value) {
  return freeze(clone(value));
}
function unique(items, keyOf = (item) => JSON.stringify(item)) {
  const seen = /* @__PURE__ */ new Set();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function normalizeWorkspace(value) {
  sealed(value, WORKSPACE_FIELDS2, "workspace");
  for (const field of ["workspaceId", "researchQuestion", "mainline", "contributionIntent", "currentFocus", "createdAt", "updatedAt"]) text(value[field], `workspace.${field}`);
  list(value.changeHistory, "workspace.changeHistory");
  return clone(value);
}
function normalizeMission(value, index) {
  const label = `missions[${index}]`;
  sealed(value, MISSION_FIELDS2, label);
  text(value.missionId, `${label}.missionId`);
  optionalText(value.parentMissionId, `${label}.parentMissionId`);
  optionalText(value.branchKind, `${label}.branchKind`);
  optionalText(value.branchReason, `${label}.branchReason`);
  for (const field of ["goal", "contributionRole", "createdAt"]) text(value[field], `${label}.${field}`);
  for (const field of ["dependsOnMissionIds", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs"]) strings(value[field], `${label}.${field}`);
  return clone(value);
}
function normalizeSource(value, index) {
  const label = `sources[${index}]`;
  sealed(value, SOURCE_FIELDS2, label);
  text(value.sourceId, `${label}.sourceId`);
  text(value.missionId, `${label}.missionId`);
  optionalText(value.citationKey, `${label}.citationKey`);
  optionalText(value.title, `${label}.title`);
  optionalText(value.locator, `${label}.locator`);
  optionalText(value.sourceType, `${label}.sourceType`);
  text(value.summary, `${label}.summary`);
  text(value.relationship, `${label}.relationship`);
  text(value.recordedAt, `${label}.recordedAt`);
  for (const field of ["authors", "conditions", "conflicts", "limitations"]) strings(value[field], `${label}.${field}`);
  if (value.capture !== null) sealed(value.capture, CAPTURE_FIELDS2, `${label}.capture`);
  return clone(value);
}
function normalizePlan(value, index) {
  const label = `experiments[${index}].plan`;
  sealed(value, PLAN_FIELDS2, label);
  for (const field of ["experimentId", "missionId", "title", "cost", "risk", "failureValue", "contributionRole", "plannedAt"]) text(value[field], `${label}.${field}`);
  for (const field of ["hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts"]) strings(value[field], `${label}.${field}`);
  return clone(value);
}
function normalizeResult(value, index) {
  const label = `experiments[${index}].result`;
  sealed(value, RESULT_FIELDS2, label);
  text(value.experimentId, `${label}.experimentId`);
  text(value.missionId, `${label}.missionId`);
  text(value.summary, `${label}.summary`);
  text(value.recordedAt, `${label}.recordedAt`);
  if (!RESULT_KINDS.includes(value.kind)) throw new Error(`${label}.kind is unsupported.`);
  for (const field of ["observations", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations"]) strings(value[field], `${label}.${field}`);
  for (const field of ["measurements", "hypothesisImpacts", "claimImpacts"]) list(value[field], `${label}.${field}`);
  plain(value.denominator, `${label}.denominator`);
  return clone(value);
}
function normalizeExperiment(value, index) {
  const label = `experiments[${index}]`;
  sealed(value, EXPERIMENT_FIELDS, label);
  const plan = normalizePlan(value.plan, index);
  const result = value.result === null ? null : normalizeResult(value.result, index);
  if (result && (result.experimentId !== plan.experimentId || result.missionId !== plan.missionId)) throw new Error(`${label} plan and result bindings differ.`);
  return { plan, result };
}
function normalizeClaim(value, index) {
  const label = `claims[${index}]`;
  sealed(value, CLAIM_FIELDS2, label);
  for (const field of ["claimId", "missionId", "statement", "assessment", "storyRole", "recordedAt"]) text(value[field], `${label}.${field}`);
  for (const field of ["supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "artifactRefs"]) strings(value[field], `${label}.${field}`);
  return clone(value);
}
function normalizeReview(value, index) {
  const label = `reviews[${index}]`;
  sealed(value, REVIEW_FIELDS2, label);
  for (const field of ["reviewId", "missionId", "status", "verdict", "summary", "reviewedArtifactSetSha256", "report", "reviewedAt"]) text(value[field], `${label}.${field}`);
  for (const field of ["rubric", "actionItems", "limitations"]) strings(value[field], `${label}.${field}`);
  list(value.reviewedArtifacts, `${label}.reviewedArtifacts`);
  list(value.findings, `${label}.findings`);
  plain(value.provenance, `${label}.provenance`);
  return clone(value);
}
function parseLessons(markdown) {
  if (typeof markdown !== "string" || !markdown.trim()) throw new Error("lessons must be non-empty Markdown.");
  const lessons = [];
  let section = null;
  for (const line of markdown.split(/\r?\n/u)) {
    const heading = /^##?\s+(.+?)\s*$/u.exec(line);
    if (heading) {
      section = heading[1];
      continue;
    }
    const bullet = /^\s*[-*]\s+(.+?)\s*$/u.exec(line);
    if (bullet) lessons.push({ lessonId: `lesson-${lessons.length + 1}`, section, text: text(bullet[1], "lesson") });
  }
  return lessons;
}
function normalizeApplications(value, lessons) {
  if (value === void 0) return [];
  const fields = /* @__PURE__ */ new Set(["lessonId", "application", "missionId"]);
  const byId = new Map(lessons.map((lesson) => [lesson.lessonId, lesson]));
  return list(value, "lessonApplications").map((item, index) => {
    sealed(item, fields, `lessonApplications[${index}]`);
    const lesson = byId.get(item.lessonId);
    if (!lesson) throw new Error(`lessonApplications[${index}] references unknown lesson.`);
    return { lessonId: lesson.lessonId, lesson: lesson.text, application: text(item.application, `lessonApplications[${index}].application`), missionId: item.missionId === null ? null : text(item.missionId, `lessonApplications[${index}].missionId`) };
  });
}
function normalizeCandidate(value, index) {
  const label = `experimentCandidates[${index}]`;
  sealed(value, CANDIDATE_FIELDS, label);
  if (!["caller", "mission"].includes(value.source)) throw new Error(`${label}.source must be caller or mission.`);
  for (const field of ["candidateId", "title", "source", "cost", "risk", "failureValue", "contributionRole"]) text(value[field], `${label}.${field}`);
  if (value.missionId !== null) text(value.missionId, `${label}.missionId`);
  for (const field of ["hypothesisRefs", "protocol", "discriminatingObservations"]) strings(value[field], `${label}.${field}`);
  return { ...clone(value), authorization: "not-granted-by-query" };
}
function normalizeModel(model, inputs) {
  sealed(model, MODEL_FIELDS, "Research model");
  const workspace = normalizeWorkspace(model.workspace);
  const missions = records(model.missions, "missions").map(normalizeMission);
  const missionIds = new Set(missions.map((mission) => mission.missionId));
  if (missionIds.size !== missions.length) throw new Error("missions must not duplicate missionId.");
  for (const mission of missions) {
    if (mission.parentMissionId && !missionIds.has(mission.parentMissionId)) throw new Error(`Mission ${mission.missionId} references unknown parent.`);
    for (const id of mission.dependsOnMissionIds) if (!missionIds.has(id)) throw new Error(`Mission ${mission.missionId} references unknown dependency.`);
  }
  const bind = (record, label) => {
    if (!missionIds.has(record.missionId)) throw new Error(`${label} references unknown mission.`);
    return record;
  };
  const sources = records(model.sources, "sources").map(normalizeSource).map((record) => bind(record, `Source ${record.sourceId}`));
  const experiments = records(model.experiments, "experiments").map(normalizeExperiment).map((record) => {
    bind(record.plan, `Experiment ${record.plan.experimentId}`);
    return record;
  });
  const claims = records(model.claims, "claims").map(normalizeClaim).map((record) => bind(record, `Claim ${record.claimId}`));
  const reviews2 = records(model.reviews, "reviews").map(normalizeReview).map((record) => bind(record, `Review ${record.reviewId}`));
  const lessons = parseLessons(model.lessons);
  return { workspace, missions, sources, experiments, claims, reviews: reviews2, lessons, lessonApplications: normalizeApplications(inputs.lessonApplications, lessons), experimentCandidates: inputs.experimentCandidates === void 0 ? [] : list(inputs.experimentCandidates, "experimentCandidates").map(normalizeCandidate), hostAnalysis: inputs.hostAnalysis === void 0 ? {} : clone(plain(inputs.hostAnalysis, "hostAnalysis")) };
}
function lessonContext(context, missionIds) {
  const selected = new Set(missionIds);
  const applied = context.lessonApplications.filter((item) => item.missionId === null || selected.has(item.missionId));
  const appliedIds = new Set(applied.map((item) => item.lessonId));
  return { applied, available: context.lessons.filter((lesson) => !appliedIds.has(lesson.lessonId)), applicationRule: "Only explicit lessonApplications mark guidance as applied; text similarity is not used." };
}
function missionTree(context) {
  const children = new Map(context.missions.map((mission) => [mission.missionId, []]));
  for (const mission of context.missions) if (mission.parentMissionId) children.get(mission.parentMissionId).push(mission.missionId);
  return context.missions.map((mission) => ({ ...mission, childMissionIds: children.get(mission.missionId) }));
}
function scoped(context, missionIds) {
  const selectedMissionIds = missionIds === void 0 ? context.missions.map((mission) => mission.missionId) : strings(missionIds, "missionIds");
  const known = new Set(context.missions.map((mission) => mission.missionId));
  for (const id of selectedMissionIds) if (!known.has(id)) throw new Error(`Unknown missionId: ${id}.`);
  const selected = new Set(selectedMissionIds);
  return { ...context, missions: context.missions.filter((item) => selected.has(item.missionId)), sources: context.sources.filter((item) => selected.has(item.missionId)), experiments: context.experiments.filter((item) => selected.has(item.plan.missionId)), claims: context.claims.filter((item) => selected.has(item.missionId)), reviews: context.reviews.filter((item) => selected.has(item.missionId)), experimentCandidates: context.experimentCandidates.filter((item) => item.missionId === null || selected.has(item.missionId)), selectedMissionIds };
}
function hostSection(context, name) {
  const section = context.hostAnalysis[name];
  return section === void 0 ? {} : clone(plain(section, `hostAnalysis.${name}`));
}
function hostItems(section, field) {
  if (section[field] === void 0) return [];
  return list(section[field], `hostAnalysis.${field}`).map((item) => typeof item === "string" ? { text: item, source: "host-analysis" } : { ...clone(plain(item, `hostAnalysis.${field} item`)), source: "host-analysis" });
}
function referenceState(reference, context) {
  const separator = reference.indexOf(":");
  const kind = separator > 0 ? reference.slice(0, separator) : "recorded-reference";
  const target = separator > 0 ? reference.slice(separator + 1) : reference;
  if (kind === "source") return { reference, kind, target, present: context.sources.some((source) => source.sourceId === target) };
  if (kind === "experiment") return { reference, kind, target, present: context.experiments.some((entry) => entry.plan.experimentId === target && entry.result) };
  if (kind === "claim") return { reference, kind, target, present: context.claims.some((claim) => claim.claimId === target) };
  return { reference, kind, target, present: true, presenceMeaning: "recorded reference only" };
}
function claimMatrix(context) {
  return context.claims.map((claim) => {
    const support = claim.supportRefs.map((reference) => referenceState(reference, context));
    const counterEvidence = claim.counterEvidenceRefs.map((reference) => referenceState(reference, context));
    return { ...claim, support, counterEvidence, unresolvedSupportRefs: support.filter((item) => !item.present), unresolvedCounterEvidenceRefs: counterEvidence.filter((item) => !item.present) };
  });
}
function overview(context) {
  return { view: "overview", workspace: context.workspace, missionTree: missionTree(context), inventory: { missions: context.missions.length, sources: context.sources.length, experimentPlans: context.experiments.length, experimentResults: context.experiments.filter((entry) => entry.result).length, claims: context.claims.length, reviews: context.reviews.length }, guidance: lessonContext(context, context.selectedMissionIds), interpretationBoundary: "Records and exact lineage only; no scientific meaning is inferred." };
}
function diagnosis(context) {
  const matrix = claimMatrix(context);
  const host2 = hostSection(context, "diagnosis");
  return { view: "diagnosis", researchFrame: { researchQuestion: context.workspace.researchQuestion, mainline: context.workspace.mainline, contributionIntent: context.workspace.contributionIntent, currentFocus: context.workspace.currentFocus }, contributionClaims: [...matrix.map((claim) => ({ claimId: claim.claimId, statement: claim.statement, assessment: claim.assessment, storyRole: claim.storyRole, source: "claim-record" })), ...hostItems(host2, "contributionClaims")], supportGaps: [...matrix.flatMap((claim) => [...claim.missingEvidence.map((text2) => ({ claimId: claim.claimId, text: text2, source: "claim-record" })), ...claim.unresolvedSupportRefs.map((reference) => ({ claimId: claim.claimId, text: `Unresolved support reference: ${reference.reference}`, source: "structural-derivation" }))]), ...hostItems(host2, "supportGaps")], counterEvidence: [...matrix.flatMap((claim) => claim.counterEvidenceRefs.map((reference) => ({ claimId: claim.claimId, reference, source: "claim-record" }))), ...context.experiments.flatMap((entry) => (entry.result?.claimImpacts ?? []).map((impact) => ({ experimentId: entry.plan.experimentId, resultKind: entry.result.kind, impact: clone(impact), source: "experiment-result" }))), ...hostItems(host2, "counterEvidence")], cannotSay: [...matrix.flatMap((claim) => claim.cannotSay.map((statement) => ({ claimId: claim.claimId, statement, source: "claim-record" }))), ...hostItems(host2, "cannotSay")], openQuestions: [...context.missions.flatMap((mission) => mission.openQuestions.map((question) => ({ missionId: mission.missionId, question, source: "mission-record" }))), ...hostItems(host2, "openQuestions")], assumptions: context.missions.flatMap((mission) => mission.assumptions.map((assumption) => ({ missionId: mission.missionId, assumption }))), lessonsContext: lessonContext(context, context.selectedMissionIds), hostAnalysis: host2, derivationRules: ["Claim fields are context, not endorsed conclusions.", "Support gaps use explicit missingEvidence and unresolved exact refs.", "Counter evidence uses exact refs and recorded claimImpacts."] };
}
function relatedWork(context) {
  const host2 = hostSection(context, "relatedWork");
  return { view: "related-work", sources: context.sources.map((source) => ({ ...source, linkedClaims: context.claims.filter((claim) => [...claim.supportRefs, ...claim.counterEvidenceRefs].includes(`source:${source.sourceId}`)).map((claim) => ({ claimId: claim.claimId, statement: claim.statement, assessment: claim.assessment })) })), relationships: Object.fromEntries(unique(context.sources.map((source) => source.relationship)).map((relationship) => [relationship, context.sources.filter((source) => source.relationship === relationship).map((source) => source.sourceId)])), themes: hostItems(host2, "themes"), gaps: hostItems(host2, "gaps"), hostAnalysis: host2, derivationRules: ["Source semantic fields and capture are copied directly.", "Claim links require exact source refs.", "No novelty or similarity inference is performed."] };
}
function hypotheses(context) {
  const host2 = hostSection(context, "hypotheses");
  const refs = unique([...context.missions.flatMap((mission) => mission.competingHypotheses), ...context.experiments.flatMap((entry) => entry.plan.hypothesisRefs)]);
  return { view: "hypotheses", hypotheses: [...refs.map((hypothesisRef) => ({ hypothesisRef, missions: context.missions.filter((mission) => mission.competingHypotheses.includes(hypothesisRef)).map((mission) => mission.missionId), experiments: context.experiments.filter((entry) => entry.plan.hypothesisRefs.includes(hypothesisRef)).map((entry) => ({ experimentId: entry.plan.experimentId, resultKind: entry.result?.kind ?? null, impacts: (entry.result?.hypothesisImpacts ?? []).filter((impact) => impact?.hypothesisRef === hypothesisRef) })), source: "exact-reference-projection" })), ...hostItems(host2, "items")], hostAnalysis: host2, derivationRules: ["Hypotheses are exact identifiers.", "Only matching hypothesisImpacts are attached.", "No prose matching is used."] };
}
function option(candidate, index) {
  return { displayOrder: index + 1, ...candidate, comparison: [{ dimension: "discriminatingPower", sourceField: "discriminatingObservations", value: candidate.discriminatingObservations }, { dimension: "informationGainSource", sourceField: "hypothesisRefs", value: candidate.hypothesisRefs }, { dimension: "cost", sourceField: "cost", value: candidate.cost }, { dimension: "risk", sourceField: "risk", value: candidate.risk }, { dimension: "failureValue", sourceField: "failureValue", value: candidate.failureValue }, { dimension: "contributionRole", sourceField: "contributionRole", value: candidate.contributionRole }] };
}
function experimentOptions(context) {
  const stored = context.experiments.map((entry) => ({ candidateId: `experiment:${entry.plan.experimentId}`, title: entry.plan.title, source: "mission", missionId: entry.plan.missionId, hypothesisRefs: entry.plan.hypothesisRefs, protocol: entry.plan.protocol, discriminatingObservations: entry.plan.discriminatingObservations, cost: entry.plan.cost, risk: entry.plan.risk, failureValue: entry.plan.failureValue, contributionRole: entry.plan.contributionRole, authorization: "not-granted-by-query", recordedResultKind: entry.result?.kind ?? null }));
  return { view: "experiment-options", candidates: [...stored, ...context.experimentCandidates].map(option), scoring: null, ranking: null, authorization: "No candidate is selected, scheduled, authorized, or written.", derivationRules: ["Discriminating power exposes discriminatingObservations without scoring.", "Information gain source exposes hypothesisRefs without scoring.", "Order is not rank."] };
}
function resultSynthesis(context) {
  const host2 = hostSection(context, "resultSynthesis");
  const results = context.experiments.filter((entry) => entry.result).map((entry) => ({ experimentId: entry.plan.experimentId, missionId: entry.plan.missionId, ...entry.result }));
  return { view: "result-synthesis", resultKinds: RESULT_KINDS, results, impactsSummary: { byKind: Object.fromEntries(RESULT_KINDS.map((kind) => [kind, results.filter((item) => item.kind === kind).length])), hypothesisImpactCount: results.reduce((sum, item) => sum + item.hypothesisImpacts.length, 0), claimImpactCount: results.reduce((sum, item) => sum + item.claimImpacts.length, 0), observationCount: results.reduce((sum, item) => sum + item.observations.length, 0), unexpectedObservationCount: results.reduce((sum, item) => sum + item.unexpectedObservations.length, 0), failureCount: results.reduce((sum, item) => sum + item.failures.length, 0), limitationCount: results.reduce((sum, item) => sum + item.limitations.length, 0), uncertaintyCount: results.reduce((sum, item) => sum + item.uncertainty.length, 0), denominatorRule: "Every denominator is returned unchanged.", meaning: "Counts and recorded impacts only; interpretation remains host-owned." }, hostAnalysis: host2, derivationRules: ["Result kind is copied exactly.", "Observations, denominator, impacts, failures, limitations, and uncertainty are preserved.", "No impact creates or changes a Claim."] };
}
function claimStory(context) {
  const host2 = hostSection(context, "claimStory");
  const matrix = claimMatrix(context);
  const groups = /* @__PURE__ */ new Map();
  for (const claim of matrix) {
    const items = groups.get(claim.statement) ?? [];
    items.push(claim);
    groups.set(claim.statement, items);
  }
  return { view: "claim-story", claimEvidenceMatrix: matrix, unsupported: matrix.filter((claim) => !claim.support.length || claim.unresolvedSupportRefs.length).map((claim) => ({ claimId: claim.claimId, statement: claim.statement, unresolvedSupportRefs: claim.unresolvedSupportRefs })), counterEvidence: matrix.flatMap((claim) => claim.counterEvidenceRefs.map((reference) => ({ claimId: claim.claimId, reference }))), missingEvidence: matrix.flatMap((claim) => claim.missingEvidence.map((item) => ({ claimId: claim.claimId, item }))), cannotSay: [...matrix.flatMap((claim) => claim.cannotSay.map((statement) => ({ claimId: claim.claimId, statement }))), ...hostItems(host2, "cannotSay")], contributionOutline: { intent: context.workspace.contributionIntent, byStoryRole: Object.fromEntries(unique(matrix.map((claim) => claim.storyRole)).map((role) => [role, matrix.filter((claim) => claim.storyRole === role).map((claim) => claim.claimId)])), byAssessment: Object.fromEntries(unique(matrix.map((claim) => claim.assessment)).map((assessment) => [assessment, matrix.filter((claim) => claim.assessment === assessment).map((claim) => claim.claimId)])), hostAnalysis: hostItems(host2, "contributionOutline") }, storyTensions: [...matrix.filter((claim) => claim.assessment === "supported" && (claim.counterEvidenceRefs.length || claim.missingEvidence.length || claim.uncertainty.length)).map((claim) => ({ kind: "supported-with-tensions", claimId: claim.claimId, counterEvidenceRefs: claim.counterEvidenceRefs, missingEvidence: claim.missingEvidence, uncertainty: claim.uncertainty })), ...[...groups.entries()].filter(([, claims]) => new Set(claims.map((claim) => claim.assessment)).size > 1).map(([statement, claims]) => ({ kind: "exact-statement-assessment-conflict", statement, assessments: claims.map((claim) => ({ claimId: claim.claimId, assessment: claim.assessment })) })), ...context.experiments.flatMap((entry) => (entry.result?.claimImpacts ?? []).map((impact) => ({ kind: "recorded-claim-impact", experimentId: entry.plan.experimentId, resultKind: entry.result.kind, impact: clone(impact) }))), ...context.reviews.filter((review) => review.verdict !== "coherent").map((review) => ({ kind: "review-tension", reviewId: review.reviewId, verdict: review.verdict, summary: review.summary })), ...hostItems(host2, "storyTensions")], priorities: { figures: context.experiments.filter((entry) => entry.result && (entry.result.measurements.length || entry.result.observations.length || entry.result.unexpectedObservations.length || entry.result.failures.length)).map((entry) => ({ experimentId: entry.plan.experimentId, kind: entry.result.kind, reason: "Recorded measurements or observations are available." })), draft: matrix.map((claim) => ({ claimId: claim.claimId, statement: claim.statement, assessment: claim.assessment, storyRole: claim.storyRole, missingEvidence: claim.missingEvidence, cannotSay: claim.cannotSay, uncertainty: claim.uncertainty })), rebuttal: [...context.reviews.flatMap((review) => review.findings.map((finding) => ({ reviewId: review.reviewId, finding: clone(finding), actionItems: review.actionItems }))), ...matrix.flatMap((claim) => claim.counterEvidenceRefs.map((reference) => ({ claimId: claim.claimId, counterEvidenceRef: reference })))], hostAnalysis: host2.priorities === void 0 ? {} : clone(plain(host2.priorities, "hostAnalysis.claimStory.priorities")) }, derivationRules: ["The matrix uses exact evidence refs.", "missingEvidence and cannotSay are copied directly.", "Story roles organize without ranking or authorization."] };
}
function branchGroup(context, branches) {
  const summaries = branches.map((mission) => ({ mission, claims: context.claims.filter((claim) => claim.missionId === mission.missionId), experiments: context.experiments.filter((entry) => entry.plan.missionId === mission.missionId) }));
  const statements = unique(summaries.flatMap((summary) => summary.claims.map((claim) => claim.statement)));
  const consensus = statements.flatMap((statement) => {
    const matches = summaries.map((summary) => summary.claims.filter((claim) => claim.statement === statement));
    if (matches.some((items) => !items.length)) return [];
    const assessments = unique(matches.flat().map((claim) => claim.assessment));
    return assessments.length === 1 ? [{ statement, assessment: assessments[0], basis: "exact statement and assessment in every sibling" }] : [];
  });
  const conflicts = statements.flatMap((statement) => {
    const matches = summaries.flatMap((summary) => summary.claims.filter((claim) => claim.statement === statement).map((claim) => ({ missionId: summary.mission.missionId, claimId: claim.claimId, assessment: claim.assessment })));
    return new Set(matches.map((item) => item.assessment)).size > 1 ? [{ statement, branches: matches, basis: "exact statement with different assessments" }] : [];
  });
  const unknownSets = summaries.map((summary) => unique([...summary.mission.openQuestions, ...summary.claims.flatMap((claim) => [...claim.missingEvidence, ...claim.uncertainty]), ...summary.experiments.flatMap((entry) => entry.result?.uncertainty ?? [])]));
  const commonUnknowns = unknownSets.length ? unknownSets[0].filter((item) => unknownSets.slice(1).every((set) => set.includes(item))) : [];
  const anomalies = summaries.flatMap((summary) => summary.experiments.flatMap((entry) => (entry.result?.unexpectedObservations ?? []).map((observation) => ({ missionId: summary.mission.missionId, experimentId: entry.plan.experimentId, observation }))));
  return { parentMissionId: branches[0].parentMissionId, branches: summaries.map((summary) => ({ missionId: summary.mission.missionId, goal: summary.mission.goal, contributionRole: summary.mission.contributionRole, assumptions: summary.mission.assumptions, competingHypotheses: summary.mission.competingHypotheses, openQuestions: summary.mission.openQuestions, claims: summary.claims.map((claim) => ({ claimId: claim.claimId, statement: claim.statement, assessment: claim.assessment, storyRole: claim.storyRole, cannotSay: claim.cannotSay })), experiments: summary.experiments.map((entry) => ({ experimentId: entry.plan.experimentId, hypothesisRefs: entry.plan.hypothesisRefs, discriminatingObservations: entry.plan.discriminatingObservations, resultKind: entry.result?.kind ?? null, summary: entry.result?.summary ?? null, limitations: entry.result?.limitations ?? [] })) })), consensus, conflicts, conditionalDifferences: summaries.map((summary) => ({ missionId: summary.mission.missionId, assumptions: summary.mission.assumptions, experiments: summary.experiments.map((entry) => ({ experimentId: entry.plan.experimentId, inputs: entry.plan.inputs, comparisons: entry.plan.comparisons, constraints: entry.plan.constraints, limitations: entry.result?.limitations ?? [] })) })), anomalies, commonUnknowns, nextBranchSuggestions: [...conflicts.map((conflict, index) => ({ suggestionId: `conflict-${index + 1}`, branchKind: "alternative", question: `Resolve conflicting assessments for: ${conflict.statement}`, basis: "exact sibling conflict", authorization: "not-granted-by-query" })), ...commonUnknowns.map((question, index) => ({ suggestionId: `unknown-${index + 1}`, branchKind: "follow-up", question, basis: "exact unknown shared by every sibling", authorization: "not-granted-by-query" })), ...anomalies.map((item, index) => ({ suggestionId: `anomaly-${index + 1}`, branchKind: "recovery", question: `Investigate unexpected observation: ${item.observation}`, basis: `Experiment ${item.experimentId}`, authorization: "not-granted-by-query" }))] };
}
function branchSynthesis(context, options) {
  let groups;
  if (options.branchMissionIds !== void 0) {
    const ids = strings(options.branchMissionIds, "branchMissionIds");
    const branches = ids.map((id) => context.missions.find((mission) => mission.missionId === id));
    if (branches.some((mission) => !mission)) throw new Error("branchMissionIds contains an unknown Mission.");
    if (new Set(branches.map((mission) => mission.parentMissionId)).size !== 1 || branches[0].parentMissionId === null) throw new Error("branchMissionIds must select sibling branches with one parent.");
    groups = [branchGroup(context, branches)];
  } else {
    const parents = unique(context.missions.filter((mission) => mission.parentMissionId !== null).map((mission) => mission.parentMissionId));
    groups = parents.map((parentId) => branchGroup(context, context.missions.filter((mission) => mission.parentMissionId === parentId))).filter((group) => group.branches.length > 1);
  }
  const host2 = hostSection(context, "branchSynthesis");
  return { view: "branch-synthesis", groups, lessonsContext: lessonContext(context, groups.flatMap((group) => group.branches.map((branch) => branch.missionId))), hostAnalysis: host2, derivationRules: ["Siblings require one exact parent.", "Consensus, conflicts, and common unknowns use exact strings.", "Suggestions never authorize a branch."] };
}
function reviews(context) {
  const host2 = hostSection(context, "reviews");
  return { view: "reviews", reviews: context.reviews, rubricCoverage: unique(context.reviews.flatMap((review) => review.rubric)).map((rubricItem) => ({ rubricItem, reviews: context.reviews.filter((review) => review.rubric.includes(rubricItem)).map((review) => review.reviewId) })), findings: context.reviews.flatMap((review) => review.findings.map((finding) => ({ reviewId: review.reviewId, missionId: review.missionId, finding: clone(finding) }))), actionItems: context.reviews.flatMap((review) => review.actionItems.map((actionItem) => ({ reviewId: review.reviewId, actionItem }))), reports: context.reviews.map((review) => ({ reviewId: review.reviewId, report: review.report, provenance: review.provenance, limitations: review.limitations })), hostAnalysis: host2, derivationRules: ["Rubric, report, provenance, findings, and limitations are copied directly.", "Rubric coverage uses exact strings.", "No reviewer authority is established."] };
}
function project(context, view, options) {
  if (view === "overview") return overview(context);
  if (view === "diagnosis") return diagnosis(context);
  if (view === "related-work") return relatedWork(context);
  if (view === "hypotheses") return hypotheses(context);
  if (view === "experiment-options") return experimentOptions(context);
  if (view === "result-synthesis") return resultSynthesis(context);
  if (view === "claim-story") return claimStory(context);
  if (view === "branch-synthesis") return branchSynthesis(context, options);
  if (view === "reviews") return reviews(context);
  throw new Error(`Unsupported view ${view}.`);
}
function buildResearchContext(model, inputs = {}) {
  sealed(inputs, INPUT_FIELDS, "Research context inputs", false);
  const normalized = normalizeModel(model, inputs);
  return immutable({ kind: "research-format-1-context", zeroWrite: true, writes: [], ...normalized, boundaries: { format: "dove-research-v1", storeLoading: "caller-or-adapter", queryMutation: "none", semanticAuthority: "host-analysis-required", candidateAuthorization: "none", textSimilarity: "not-used" } });
}
function queryResearchContext(context, options = {}) {
  sealed(options, QUERY_FIELDS, "Research query options", false);
  const view = text(options.view, "Research query view");
  if (!VIEW_SET.has(view)) throw new Error(`Research query view must be one of: ${RESEARCH_CONTEXT_VIEWS.join(", ")}.`);
  if (context?.kind !== "research-format-1-context") throw new Error("queryResearchContext requires buildResearchContext output.");
  const selected = scoped(clone(context), options.missionIds);
  return immutable({ status: "ok", query: true, zeroWrite: true, writes: [], selectedMissionIds: selected.selectedMissionIds, ...project(selected, view, options) });
}
function buildResearchViews(model, inputs = {}) {
  const context = buildResearchContext(model, inputs);
  return immutable(Object.fromEntries(RESEARCH_CONTEXT_VIEWS.map((view) => [view, queryResearchContext(context, { view })])));
}

// src/core/role-definitions.mjs
var ROLE_DEFINITIONS = Object.freeze({
  planner: Object.freeze({
    id: "planner",
    publicName: "Planner",
    title: "dove-planner",
    description: "Define a proportional mission goal, scope, dependencies, evidence needs, and completion conditions.",
    responsibility: "Frame the user's request for the three primary roles: Planner, Builder/Author, and independent Reviewer.",
    inputs: Object.freeze([
      "The user's goal, constraints, supplied context, and desired deliverable",
      "Public Dove mission or status context when durable context is needed",
      "Current external facts from visible bounded public search when they may affect the plan"
    ]),
    outputs: Object.freeze([
      "A proportional goal and clear in-scope and out-of-scope boundaries",
      "Expected deliverables, dependencies, evidence needs, assumptions, blockers, and completion conditions",
      "For research work, an explicit real problem, key unknown or hypothesis, bounded approach, discriminating evidence, resource facts, stop conditions, and claim boundary; for ordinary work, no invented research credit",
      "A handoff of substantive work to Builder/Author and frozen review scope to Reviewer"
    ])
  }),
  builder: Object.freeze({
    id: "builder",
    publicName: "Builder/Author",
    title: "dove-builder",
    description: "Produce substantive research, code, writing, experiments, figures, revisions, and author-side rebuttal.",
    responsibility: "Perform the substantive work within the approved goal and scope as Builder/Author, distinct from Planner and independent Reviewer.",
    inputs: Object.freeze([
      "The approved goal, scope, deliverables, dependencies, and completion conditions",
      "Supplied materials and public Dove context needed for the work",
      "Host tools, subagents, and visible external search when they materially advance the task"
    ]),
    outputs: Object.freeze([
      "Real user-facing research, code, writing, experiment, figure, revision, or rebuttal artifacts produced from actual resources and existing assets",
      "Raw outputs, logs, failure samples, denominator accounting, and layered validation appropriate to the task, with no unnecessary fallback or hidden post-processing path",
      "An explicit account of unsupported claims, citation gaps, integrity concerns, uncertainty, resource limits, or material scope changes; host return and passing tests are not independent acceptance",
      "Durable results recorded through public Dove surfaces, without presenting the work as independent review"
    ])
  }),
  reviewer: Object.freeze({
    id: "reviewer",
    publicName: "Reviewer",
    title: "dove-reviewer",
    description: "Assess one frozen declared artifact scope and return structured findings without edits; this native role is a convenience definition, not evidence of independence or authority.",
    responsibility: "Act as Reviewer, separate in responsibility from Planner and Builder/Author. A user-managed separate exchange establishes the review boundary; merely using this native definition does not establish independence, identity, authority, sign-off, or acceptance.",
    inputs: Object.freeze([
      "Only the declared project-relative artifact paths and their frozen fingerprints in the launch prompt",
      "The concise review rubric and structured output contract in that prompt"
    ]),
    outputs: Object.freeze([
      "One structured status and verdict with a concise summary",
      "Findings only, each with a stable finding label, severity, concise rationale, and one or more declared artifact paths",
      "Action items, explicit unknowns, and a Markdown report within the declared scope",
      "Execution, rewriting, rebuttal, and scheduling stay outside Reviewer responsibility; make no edits or Dove mutation, perform no self-fix or nested reviewer launch, and access no parent transcript, Trellis task material, undeclared Dove state, or undeclared files"
    ])
  })
});
var DOVE_PRIMARY_ROLES = ROLE_DEFINITIONS;
function frontmatter(role) {
  return `---
name: ${role.title}
description: ${role.description}
---`;
}
function bullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}
function renderOpenCodeRoleSkill(roleId) {
  const role = ROLE_DEFINITIONS[roleId];
  if (!role) throw new Error(`Unknown Dove primary role: ${roleId}.`);
  return `${frontmatter(role)}

# ${role.title}

## Responsibility

${role.responsibility}

## Inputs

${bullets(role.inputs)}

## Outputs

${bullets(role.outputs)}
`;
}
var REVIEWER_BOUNDARY = `Review only the declared paths listed in this prompt. Do not inspect directories, search the project, follow references into undeclared files, or use parent conversation context. Do not edit files or invoke Dove tools. Do not perform rebuttal, self-fix, implementation, or nested reviewer delegation.`;
function renderClaudeReviewerAgent() {
  const role = ROLE_DEFINITIONS.reviewer;
  return `---
name: dove-reviewer
description: ${role.description}
tools: Read
---

# Dove Reviewer

${role.responsibility}

${REVIEWER_BOUNDARY}

Return only the structured review object requested by the launch prompt, followed by its Markdown report.
`;
}
function renderOpenCodeReviewerAgent() {
  const role = ROLE_DEFINITIONS.reviewer;
  return `---
description: ${role.description}
mode: subagent
permission:
  read: allow
  write: deny
  edit: deny
  bash: deny
  glob: deny
  grep: deny
  task: deny
  skill: deny
---
# Dove Reviewer

${role.responsibility}

${REVIEWER_BOUNDARY}

Return only the structured review object requested by the launch prompt, followed by its Markdown report.
`;
}
function reviewerPrompt(reviewScope) {
  const declared = reviewScope.reviewedArtifacts.map((item) => `- ${item.path} (${item.sizeBytes} bytes; SHA-256 ${item.sha256})`).join("\n");
  return `You are acting in the Dove Reviewer role for a user-managed separate review exchange. This prompt and native role definition do not prove independence, identity, or authority.

Declared frozen content boundary:
${declared}

Read only those exact project-relative files. Their content must match the supplied fingerprints. Do not access the parent transcript, Trellis task or specs, Dove state, directories, or any undeclared file. Do not edit, write, self-fix, rebut, invoke Dove, launch another reviewer, or delegate.

Rubric: assess correctness and internal coherence; evidence and claim scope; omissions and material risk; reproducibility; fairness or information leakage; and preservation of failures, denominators, and uncertainty. Do not claim authority, identity, sign-off, acceptance, or independence from this prompt alone.

Return exactly one JSON object with this shape, then a Markdown report:
{
  "status": "completed|blocked|failed",
  "verdict": "coherent|needs-revision|needs-evidence|blocked",
  "summary": "concise summary",
  "rubric": ["rubric item assessed"],
  "findings": [{"findingId":"safe-label","severity":"low|medium|high","summary":"concise finding","linkedArtifactPaths":["one-or-more-declared-paths"]}],
  "actionItems": ["action"],
  "report": "complete Markdown report",
  "provenance": {"hostKind":"${reviewScope.hostKind}","provider":"optional","model":"optional"},
  "limitations": ["scope or evidence limitation"],
  "reviewedAt": "ISO-8601 UTC"
}
Do not add any other JSON fields. Completed status cannot use blocked verdict. Blocked or failed status must use blocked verdict. needs-revision and needs-evidence require at least one finding and action item.`;
}
function generatedRoleDefinitionEntries() {
  return [
    ...["planner", "builder", "reviewer"].map((roleId) => ({
      relativePath: `.opencode/skills/dove-${roleId}/SKILL.md`,
      content: renderOpenCodeRoleSkill(roleId)
    })),
    { relativePath: ".claude/agents/dove-reviewer.md", content: renderClaudeReviewerAgent() },
    { relativePath: ".opencode/agents/dove-reviewer.md", content: renderOpenCodeReviewerAgent() }
  ];
}

// src/core/project-installation.mjs
import crypto5 from "node:crypto";
import fs13 from "node:fs";
import path13 from "node:path";

// src/core/claude-project-settings.mjs
var DOVE_CLAUDE_LOCAL_SETTINGS_PATH = ".claude/settings.local.json";
var DOVE_CLAUDE_MCP_APPROVAL_SELECTOR = `/enabledMcpjsonServers[${DOVE_MCP_SERVER_NAME}]`;
function plainObject3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function stringList(value, field) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} ${field} must be an array.`);
  if (value.some((item) => typeof item !== "string" || !item || item !== item.trim())) {
    throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} ${field} must contain non-empty trimmed strings.`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} ${field} must not contain duplicate server names.`);
  }
  return value;
}
function inspectClaudeMcpApprovalSettings(settings) {
  if (!plainObject3(settings)) throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} must contain a JSON object.`);
  const enabled = stringList(settings.enabledMcpjsonServers, "enabledMcpjsonServers");
  const disabled = stringList(settings.disabledMcpjsonServers, "disabledMcpjsonServers");
  return {
    approved: enabled.includes(DOVE_MCP_SERVER_NAME),
    disabled: disabled.includes(DOVE_MCP_SERVER_NAME)
  };
}
function mergeClaudeMcpApprovalSettings(settings) {
  const state2 = inspectClaudeMcpApprovalSettings(settings);
  if (state2.disabled) {
    throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} explicitly disables the Dove MCP server; Dove will not override that decision.`);
  }
  if (state2.approved) return { settings, changed: false };
  return {
    settings: {
      ...settings,
      enabledMcpjsonServers: [
        ...settings.enabledMcpjsonServers ?? [],
        DOVE_MCP_SERVER_NAME
      ]
    },
    changed: true
  };
}
function removeClaudeMcpApprovalSettings(settings) {
  const state2 = inspectClaudeMcpApprovalSettings(settings);
  if (state2.disabled || !state2.approved) return { settings, changed: false };
  return {
    settings: {
      ...settings,
      enabledMcpjsonServers: settings.enabledMcpjsonServers.filter(
        (name) => name !== DOVE_MCP_SERVER_NAME
      )
    },
    changed: true
  };
}

// src/core/file-set-transaction.mjs
import crypto4 from "node:crypto";
import fs8 from "node:fs";
import path8 from "node:path";
var MAX_CLEANUP_RESIDUES = 20;
function errorMessage2(error) {
  return error instanceof Error ? error.message : String(error);
}
function sha2562(content) {
  return crypto4.createHash("sha256").update(content).digest("hex");
}
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}
function treeMetadata(stat) {
  return {
    device: String(stat.dev),
    inode: String(stat.ino),
    mode: Number(stat.mode),
    ctimeNs: String(stat.ctimeNs),
    mtimeNs: String(stat.mtimeNs)
  };
}
function inspectDirectoryTreeDigest(root, relativePath, options = {}) {
  const fsOps = options.fsOps ?? fs8;
  const canonicalRoot3 = typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(path8.resolve(root)) : fsOps.realpathSync(path8.resolve(root));
  const normalized = path8.posix.normalize(String(relativePath).replace(/\\/gu, "/"));
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || path8.posix.isAbsolute(normalized)) {
    throw new Error(`Directory tree digest path must stay inside its root: ${relativePath}.`);
  }
  const directory = path8.join(canonicalRoot3, normalized);
  const rootStat = fsOps.lstatSync(directory, { bigint: true });
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error(`Directory tree digest source must be a real directory: ${normalized}.`);
  const entries = [{ path: "", kind: "directory", ...treeMetadata(rootStat) }];
  const visit = (absoluteDirectory, prefix) => {
    const names = fsOps.readdirSync(absoluteDirectory).map(String).sort((left, right) => left.localeCompare(right));
    for (const name of names) {
      const childPath = prefix ? path8.posix.join(prefix, name) : name;
      const absoluteChild = path8.join(absoluteDirectory, name);
      const stat = fsOps.lstatSync(absoluteChild, { bigint: true });
      const metadata = { path: childPath, ...treeMetadata(stat) };
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "directory" });
        visit(absoluteChild, childPath);
      } else if (stat.isFile()) {
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha2562(fsOps.readFileSync(absoluteChild)) });
      } else if (stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "symlink", target: fsOps.readlinkSync(absoluteChild) });
      } else {
        throw new Error(`Unsupported filesystem entry inside ${normalized}: ${childPath}.`);
      }
    }
  };
  visit(directory, "");
  return sha2562(canonicalJson(entries));
}
function state(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return { exists: false, type: "absent", sha256: null, mode: null };
  if (stat.isSymbolicLink()) return { exists: true, type: "symlink", sha256: null, mode: stat.mode & 4095 };
  if (stat.isDirectory()) return { exists: true, type: "directory", sha256: null, mode: stat.mode & 4095 };
  if (!stat.isFile()) return { exists: true, type: "other", sha256: null, mode: stat.mode & 4095 };
  return { exists: true, type: "file", sha256: sha2562(anchor.readFile(relativePath)), mode: stat.mode & 4095 };
}
function sameState(left, right) {
  return left.exists === right.exists && left.type === right.type && left.sha256 === right.sha256 && left.mode === right.mode;
}
function expectedState(raw, index) {
  if (raw === void 0) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Transactional write entry ${index} expectedState must be an object.`);
  }
  const keys = Object.keys(raw).sort();
  if (keys.join(",") !== "exists,mode,sha256,type") {
    throw new Error(`Transactional write entry ${index} expectedState must contain exactly exists, type, sha256, and mode.`);
  }
  if (typeof raw.exists !== "boolean" || !["absent", "directory", "file"].includes(raw.type)) {
    throw new Error(`Transactional write entry ${index} expectedState is invalid.`);
  }
  if (raw.exists !== (raw.type !== "absent")) throw new Error(`Transactional write entry ${index} expectedState existence is contradictory.`);
  if (raw.exists ? !Number.isInteger(raw.mode) || raw.mode < 0 || raw.mode > 4095 : raw.mode !== null) {
    throw new Error(`Transactional write entry ${index} expectedState mode is invalid.`);
  }
  if (raw.type === "file") {
    if (typeof raw.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(raw.sha256)) {
      throw new Error(`Transactional write entry ${index} expectedState file requires a lowercase SHA-256 digest.`);
    }
  } else if (raw.sha256 !== null) {
    throw new Error(`Transactional write entry ${index} expectedState ${raw.type} must use a null digest.`);
  }
  return { exists: raw.exists, type: raw.type, sha256: raw.sha256, mode: raw.mode };
}
function parentDirectories(relativePath) {
  const directories = [];
  let current = path8.posix.dirname(relativePath);
  while (current !== ".") {
    directories.push(current);
    current = path8.posix.dirname(current);
  }
  return directories.reverse();
}
function inspectParentDirectories(anchor, relativePath) {
  for (const directoryPath of parentDirectories(relativePath)) {
    const stat = anchor.tryLstat(directoryPath);
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
      throw new Error(`Transactional directory component must be a real directory: ${directoryPath}`);
    }
    if (!stat) break;
  }
}
function ensureParentDirectories(anchor, relativePath, createdDirectories) {
  for (const directoryPath of parentDirectories(relativePath)) {
    const stat = anchor.tryLstat(directoryPath);
    if (stat) {
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Transactional directory component must be a real directory: ${directoryPath}`);
      continue;
    }
    anchor.mkdir(directoryPath);
    createdDirectories.push(directoryPath);
  }
}
function removeNewTransactionParents(anchor, transaction) {
  if (anchor.exists(transaction.transactionBase) && anchor.readdir(transaction.transactionBase).length === 0) {
    anchor.rmdir(transaction.transactionBase, { force: true });
  }
  for (const parent of [...transaction.transactionParents].reverse()) {
    if (!parent.existed && anchor.exists(parent.relativePath) && anchor.readdir(parent.relativePath).length === 0) {
      anchor.rmdir(parent.relativePath, { force: true });
    }
  }
}
function committedResult(entries, cleanupFailures) {
  const residues = cleanupFailures.slice(0, MAX_CLEANUP_RESIDUES);
  const mutations = entries.filter((entry) => !entry.asserting);
  const movedPaths = mutations.filter((entry) => entry.movingDirectory).map((entry) => ({ from: entry.relativePath, to: entry.moveTo }));
  return {
    writtenPaths: mutations.filter((entry) => !entry.deleting && !entry.movingDirectory).map((entry) => entry.relativePath),
    removedPaths: mutations.filter((entry) => entry.deleting).map((entry) => entry.relativePath),
    movedPaths,
    changedPaths: mutations.flatMap((entry) => entry.movingDirectory ? [entry.relativePath, entry.moveTo] : [entry.relativePath]),
    transactionState: {
      phase: "committed",
      rollbackAttempted: false,
      cleanup: {
        status: cleanupFailures.length === 0 ? "clean" : "residue",
        residueCount: cleanupFailures.length,
        residues,
        omittedResidueCount: Math.max(0, cleanupFailures.length - residues.length)
      }
    }
  };
}
function writeFileSetTransaction(entries, options = {}) {
  if (!Array.isArray(entries)) throw new Error("Transactional write entries must be an array.");
  const fsOps = options.fsOps ?? fs8;
  const transactionId = (options.transactionId ?? crypto4.randomUUID()).replace(/[^a-z0-9._-]/giu, "-");
  const anchors = /* @__PURE__ */ new Map();
  const resolved = [];
  const targets = /* @__PURE__ */ new Set();
  const transactions = /* @__PURE__ */ new Map();
  const promotions = [];
  const createdDirectories = /* @__PURE__ */ new Map();
  let phase = "preparing";
  const anchorFor = (root) => {
    const canonicalRoot3 = typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(path8.resolve(root)) : fsOps.realpathSync(path8.resolve(root));
    if (!anchors.has(canonicalRoot3)) anchors.set(canonicalRoot3, openAnchoredFilesystem(canonicalRoot3, { fsOps, platform: options.platform, procFdRoot: options.procFdRoot }));
    return anchors.get(canonicalRoot3);
  };
  try {
    for (const [index, entry] of entries.entries()) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Transactional write entry ${index} must be an object.`);
      const anchor = anchorFor(entry.root);
      const relativePath = anchor.normalize(entry.relativePath, entry.label ?? "Transactional write path");
      const key = `${anchor.root}\0${relativePath}`;
      if (targets.has(key)) throw new Error(`Transactional write set contains duplicate target ${relativePath}.`);
      targets.add(key);
      const previous = state(anchor, relativePath);
      const approvedState = expectedState(entry.expectedState, index);
      if (approvedState !== null && !sameState(previous, approvedState)) {
        throw new Error(`Transactional write approved precondition changed for ${relativePath}.`);
      }
      const movingDirectory = entry.moveTo !== void 0;
      const deleting = entry.delete === true;
      const asserting = entry.assertOnly === true;
      if (asserting && (movingDirectory || deleting || entry.content !== void 0 || entry.force === true || entry.deleteEmptyDirectory === true)) {
        throw new Error(`Transactional assertion entry must not request a mutation: ${relativePath}.`);
      }
      if (asserting && approvedState === null) throw new Error(`Transactional assertion entry requires expectedState: ${relativePath}.`);
      if (movingDirectory && deleting) throw new Error(`Transactional entry cannot both move and delete: ${relativePath}.`);
      const deletingTree = deleting && entry.deleteTree === true;
      const deletingEmptyDirectory = deleting && entry.deleteEmptyDirectory === true;
      if (deletingTree && deletingEmptyDirectory) throw new Error(`Transactional entry cannot request both recursive and empty-directory deletion: ${relativePath}.`);
      let moveTo = null;
      if (movingDirectory) {
        moveTo = anchor.normalize(entry.moveTo, entry.label ?? "Transactional move destination");
        const destinationKey = `${anchor.root}\0${moveTo}`;
        if (targets.has(destinationKey)) throw new Error(`Transactional write set contains duplicate target ${moveTo}.`);
        targets.add(destinationKey);
        if (!previous.exists || previous.type !== "directory") throw new Error(`Transactional move source must be a real directory: ${relativePath}.`);
        inspectParentDirectories(anchor, moveTo);
        const destination = state(anchor, moveTo);
        if (destination.exists) throw new Error(`Transactional move destination must be absent: ${moveTo}.`);
        if (typeof entry.expectedTreeDigest !== "string" || !/^[a-f0-9]{64}$/u.test(entry.expectedTreeDigest)) {
          throw new Error(`Transactional directory move requires a lowercase SHA-256 expectedTreeDigest: ${relativePath}.`);
        }
        const actualTreeDigest = inspectDirectoryTreeDigest(anchor.root, relativePath, { fsOps });
        if (actualTreeDigest !== entry.expectedTreeDigest) throw new Error(`Transactional move source tree digest changed for ${relativePath}.`);
      } else if (previous.exists && previous.type !== "file" && !((deletingEmptyDirectory || deletingTree) && previous.type === "directory")) {
        throw new Error(`Transactional write target must be absent or a regular file${deletingTree ? " or an explicitly selected directory tree" : deletingEmptyDirectory ? " or an explicitly selected empty directory" : ""}: ${relativePath}.`);
      }
      if ((deletingEmptyDirectory || deletingTree) && previous.exists) {
        if (typeof entry.expectedTreeDigest !== "string" || !/^[a-f0-9]{64}$/u.test(entry.expectedTreeDigest)) {
          throw new Error(`Transactional directory deletion requires a lowercase SHA-256 expectedTreeDigest: ${relativePath}.`);
        }
        const actualTreeDigest = inspectDirectoryTreeDigest(anchor.root, relativePath, { fsOps });
        if (actualTreeDigest !== entry.expectedTreeDigest) throw new Error(`Transactional directory deletion tree digest changed for ${relativePath}.`);
      }
      if (asserting) {
        resolved.push({ ...entry, anchor, relativePath, moveTo, movingDirectory, deleting, asserting, content: null, previous });
        continue;
      }
      if (deleting && !previous.exists) continue;
      if (!movingDirectory && !deleting && previous.exists && entry.force !== true) continue;
      resolved.push({
        ...entry,
        anchor,
        relativePath,
        moveTo,
        movingDirectory,
        deleting,
        asserting,
        content: deleting || movingDirectory ? null : Buffer.isBuffer(entry.content) ? Buffer.from(entry.content) : Buffer.from(String(entry.content ?? ""), entry.encoding ?? "utf8"),
        previous
      });
    }
    if (resolved.length === 0) return committedResult([], []);
    const mutationEntries = resolved.filter((entry) => !entry.asserting);
    if (mutationEntries.length === 0) return committedResult(resolved, []);
    for (const anchor of new Set(mutationEntries.map((entry) => entry.anchor))) {
      const transactionBase = anchor.normalize(options.transactionBase ?? ".dove/install/transactions", "Transactional staging base");
      const transactionPath = `${transactionBase}/${transactionId}`;
      if (anchor.exists(transactionPath)) throw new Error(`Transactional staging path is already occupied: ${anchor.displayPath(transactionPath)}.`);
      const transactionParents = parentDirectories(`${transactionPath}/placeholder`).map((relativePath) => ({ relativePath, existed: anchor.exists(relativePath) }));
      anchor.mkdir(transactionPath, { recursive: true });
      anchor.mkdir(`${transactionPath}/staged`);
      anchor.mkdir(`${transactionPath}/backups`);
      transactions.set(anchor, { transactionBase, transactionPath, transactionParents, stagedRoot: `${transactionPath}/staged`, backupRoot: `${transactionPath}/backups` });
      createdDirectories.set(anchor, []);
    }
    for (const [index, entry] of resolved.entries()) {
      if (entry.asserting || entry.deleting || entry.movingDirectory) continue;
      const transaction = transactions.get(entry.anchor);
      entry.stagedPath = `${transaction.stagedRoot}/file-${index}`;
      entry.anchor.writeNewFile(entry.stagedPath, entry.content);
      if (entry.previous.mode !== null) entry.anchor.chmod(entry.stagedPath, entry.previous.mode);
    }
    for (const entry of resolved) {
      const actual = state(entry.anchor, entry.relativePath);
      if (!sameState(actual, entry.previous)) throw new Error(`Transactional write precondition changed for ${entry.relativePath}.`);
      if (entry.movingDirectory) {
        if (state(entry.anchor, entry.moveTo).exists) throw new Error(`Transactional move destination became occupied: ${entry.moveTo}.`);
        const actualTreeDigest = inspectDirectoryTreeDigest(entry.anchor.root, entry.relativePath, { fsOps });
        if (actualTreeDigest !== entry.expectedTreeDigest) throw new Error(`Transactional move source tree digest changed for ${entry.relativePath}.`);
      }
      if (entry.deleting && entry.previous.type === "directory") {
        const actualTreeDigest = inspectDirectoryTreeDigest(entry.anchor.root, entry.relativePath, { fsOps });
        if (actualTreeDigest !== entry.expectedTreeDigest) throw new Error(`Transactional directory deletion tree digest changed for ${entry.relativePath}.`);
        if (entry.deleteTree !== true) {
          const children = entry.anchor.readdir(entry.relativePath);
          const scheduledChildren = new Set(resolved.filter((candidate) => candidate.anchor === entry.anchor && candidate.deleting && path8.posix.dirname(candidate.relativePath) === entry.relativePath).map((candidate) => path8.posix.basename(candidate.relativePath)));
          if (children.some((child) => !scheduledChildren.has(typeof child === "string" ? child : child.name))) {
            throw new Error(`Transactional directory deletion requires every child to be an exact scheduled deletion: ${entry.relativePath}.`);
          }
        }
      }
    }
    phase = "promoting";
    for (const [index, entry] of resolved.entries()) {
      if (entry.asserting) continue;
      const transaction = transactions.get(entry.anchor);
      const promotion = { entry, backupPath: null, promoted: false, movedDirectory: false };
      promotions.push(promotion);
      if (entry.movingDirectory) {
        ensureParentDirectories(entry.anchor, entry.moveTo, createdDirectories.get(entry.anchor));
        if (state(entry.anchor, entry.moveTo).exists) throw new Error(`Transactional move destination became occupied: ${entry.moveTo}.`);
        const actualTreeDigest = inspectDirectoryTreeDigest(entry.anchor.root, entry.relativePath, { fsOps });
        if (actualTreeDigest !== entry.expectedTreeDigest) throw new Error(`Transactional move source tree digest changed for ${entry.relativePath}.`);
        entry.anchor.rename(entry.relativePath, entry.moveTo);
        promotion.movedDirectory = true;
        continue;
      }
      ensureParentDirectories(entry.anchor, entry.relativePath, createdDirectories.get(entry.anchor));
      if (entry.previous.type === "directory") {
        if (entry.deleteTree === true) {
          const actualTreeDigest = inspectDirectoryTreeDigest(entry.anchor.root, entry.relativePath, { fsOps });
          if (actualTreeDigest !== entry.expectedTreeDigest) throw new Error(`Transactional directory deletion tree digest changed during promotion for ${entry.relativePath}.`);
        } else {
          const scheduledChildren = new Set(resolved.filter((candidate) => candidate.anchor === entry.anchor && candidate.deleting && path8.posix.dirname(candidate.relativePath) === entry.relativePath).map((candidate) => path8.posix.basename(candidate.relativePath)));
          const unexpected = entry.anchor.readdir(entry.relativePath).map((child) => typeof child === "string" ? child : child.name).filter((child) => !scheduledChildren.has(child));
          if (unexpected.length > 0) {
            throw new Error(`Transactional directory deletion found an unscheduled child during promotion: ${entry.relativePath}/${unexpected.sort().join(`, ${entry.relativePath}/`)}.`);
          }
        }
      } else {
        const actual = state(entry.anchor, entry.relativePath);
        if (!sameState(actual, entry.previous)) throw new Error(`Transactional write precondition changed during promotion for ${entry.relativePath}.`);
      }
      if (entry.previous.exists) {
        promotion.backupPath = `${transaction.backupRoot}/file-${index}`;
        entry.anchor.rename(entry.relativePath, promotion.backupPath);
      }
      if (!entry.deleting) {
        entry.anchor.rename(entry.stagedPath, entry.relativePath);
        promotion.promoted = true;
      }
    }
    for (const entry of resolved.filter((candidate) => candidate.asserting)) {
      const actual = state(entry.anchor, entry.relativePath);
      if (!sameState(actual, entry.previous)) {
        throw new Error(`Transactional assertion changed during promotion for ${entry.relativePath}.`);
      }
    }
    phase = "committed";
    const cleanupFailures = [];
    for (const [anchor, transaction] of transactions) {
      try {
        anchor.remove(transaction.transactionPath, { recursive: true, force: true });
        removeNewTransactionParents(anchor, transaction);
      } catch (cleanupError) {
        cleanupFailures.push({ path: anchor.displayPath(transaction.transactionPath), reason: errorMessage2(cleanupError) });
      }
    }
    return committedResult(resolved, cleanupFailures);
  } catch (error) {
    if (phase === "committed") throw new Error(`Transactional write committed before post-commit cleanup failed: ${errorMessage2(error)}`, { cause: error });
    const rollbackFailures = [];
    const attempt = (callback) => {
      try {
        callback();
      } catch (rollbackError) {
        rollbackFailures.push(errorMessage2(rollbackError));
      }
    };
    for (const promotion of [...promotions].reverse()) {
      const { entry } = promotion;
      if (promotion.movedDirectory && entry.anchor.exists(entry.moveTo)) attempt(() => entry.anchor.rename(entry.moveTo, entry.relativePath));
      if (promotion.promoted) attempt(() => entry.anchor.remove(entry.relativePath, { force: true }));
      if (promotion.backupPath && entry.anchor.exists(promotion.backupPath)) attempt(() => entry.anchor.rename(promotion.backupPath, entry.relativePath));
    }
    for (const [anchor, directories] of createdDirectories) {
      for (const directoryPath of [...directories].sort((left, right) => right.length - left.length)) {
        attempt(() => anchor.rmdir(directoryPath, { force: true }));
      }
    }
    for (const [anchor, transaction] of transactions) {
      attempt(() => anchor.remove(transaction.transactionPath, { recursive: true, force: true }));
      attempt(() => removeNewTransactionParents(anchor, transaction));
    }
    if (rollbackFailures.length > 0) throw new Error(`Transactional write failed and rollback also failed: ${errorMessage2(error)}; rollback: ${rollbackFailures.join("; ")}`, { cause: error });
    throw new Error(`Transactional write failed and all staged changes were rolled back: ${errorMessage2(error)}`, { cause: error });
  } finally {
    for (const anchor of anchors.values()) anchor.close();
  }
}

// src/core/host-registry.mjs
var PROJECT_HOST_IDS2 = Object.freeze(["opencode", "codex", "cursor", "agents", "claude"]);
var HOST_DEFINITIONS2 = [
  {
    id: "opencode",
    label: "OpenCode",
    order: 0,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectMcpRegistration: false, projectHooks: false, sharedInstructions: false, nativeReviewer: true, reviewerFreshContext: true, reviewerReadOnly: true, reviewerSynchronous: true },
    legacySignatures: [".opencode.json", ".opencode/commands/dove.status.md", ".opencode/skills/dove-planner/SKILL.md"]
  },
  {
    id: "codex",
    label: "Codex",
    order: 1,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectMcpRegistration: false, projectHooks: false, sharedInstructions: false },
    legacySignatures: [".codex/skills/dove-status/SKILL.md"]
  },
  {
    id: "cursor",
    label: "Cursor",
    order: 2,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectMcpRegistration: false, projectHooks: false, sharedInstructions: false },
    legacySignatures: [".cursor/commands/dove-status.md"]
  },
  {
    id: "agents",
    label: "Shared agent skills",
    order: 3,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectMcpRegistration: false, projectHooks: false, sharedInstructions: true },
    legacySignatures: [".agents/skills/dove-status/SKILL.md", "AGENTS.md"]
  },
  {
    id: "claude",
    label: "Claude Code",
    order: 4,
    projectInitializable: true,
    capabilities: { commandAdapters: true, projectMcpRegistration: true, projectHooks: true, sharedInstructions: false, nativeReviewer: true, reviewerFreshContext: true, reviewerReadOnly: true, reviewerSynchronous: true },
    legacySignatures: [
      "mcp/dove-claude-project.json",
      ".mcp.json",
      ".claude/settings.json",
      ".claude/rules/dove.md",
      ".claude/skills/dove-intake/SKILL.md"
    ]
  }
];
function freezeHostDefinition(definition) {
  return Object.freeze({
    ...definition,
    capabilities: Object.freeze({ ...definition.capabilities }),
    legacySignatures: Object.freeze([...definition.legacySignatures])
  });
}
var HOST_REGISTRY = Object.freeze(Object.fromEntries(
  HOST_DEFINITIONS2.map((definition) => [definition.id, freezeHostDefinition(definition)])
));
var DEFAULT_INITIALIZABLE_HOSTS = Object.freeze(
  PROJECT_HOST_IDS2.filter((hostId) => HOST_REGISTRY[hostId].projectInitializable)
);
function selectionValues(raw) {
  if (raw === void 0 || raw === null) return [];
  if (typeof raw === "string") return [raw];
  if (!Array.isArray(raw)) throw new Error("Host selection must be a host id or an array of host ids.");
  return raw;
}
function defaultSelection(defaultWhenEmpty) {
  if (defaultWhenEmpty === false || defaultWhenEmpty === null) return [];
  if (defaultWhenEmpty === true || defaultWhenEmpty === void 0) return [...DEFAULT_INITIALIZABLE_HOSTS];
  return selectionValues(defaultWhenEmpty);
}
function normalizeHostSelection(raw, options = {}) {
  const requested = selectionValues(raw);
  const source = requested.length > 0 ? requested : defaultSelection(options.defaultWhenEmpty);
  for (const hostId of source) {
    if (typeof hostId !== "string" || !hostId || hostId !== hostId.trim()) {
      throw new Error(`Invalid Dove project host id: ${String(hostId)}.`);
    }
  }
  const expanded = source.includes("all") ? PROJECT_HOST_IDS2 : source;
  const unknown = [...new Set(expanded.filter((hostId) => !PROJECT_HOST_IDS2.includes(hostId)))];
  if (unknown.length > 0) throw new Error(`Unknown Dove project host(s): ${unknown.join(", ")}.`);
  const selected = PROJECT_HOST_IDS2.filter((hostId) => expanded.includes(hostId));
  if (options.requireInitializable === true) {
    const unavailable = selected.filter((hostId) => !HOST_REGISTRY[hostId].projectInitializable);
    if (unavailable.length > 0) {
      throw new Error(`Dove project initialization is not available for host(s) without complete project MCP registration: ${unavailable.join(", ")}.`);
    }
  }
  return Object.freeze(selected);
}

// src/core/project-legacy-installation.mjs
import fs9 from "node:fs";
import path9 from "node:path";
var LEGACY_PROJECT_MARKER_PATHS = Object.freeze(["mcp/dove-claude-project.json"]);
var LEGACY_PROJECT_BUNDLE_PROBES = Object.freeze([
  { path: "bin/dove-package.mjs", signatures: ["dove-state-server-package.mjs", "DOVE_MCP_SERVER_NAME", "create_ambient_dove_mission"] },
  { path: "dist/index.mjs", signatures: ["DOVE_WORKSPACE_SCHEMA_VERSION", "createDoveMission", "queryDoveStatus"] },
  { path: "mcp/dove-state-server-package.mjs", signatures: ["create_ambient_dove_mission", "query_dove_status", "Dove MCP"] },
  { path: "scripts/doctor-mcp-probe-package.mjs", signatures: ["hasCreateAmbientDoveMission", "checkpointStatus", "ambientHookBundle"] },
  { path: "scripts/dove-user-prompt-submit-package.mjs", signatures: ["create_ambient_dove_mission", "UserPromptSubmit", "closureRequest"] }
]);
var DOVE_HOOK_COMMAND = /(?:^|[\s"'])node(?:[\s"']+)[^"'\s]*dove-user-prompt-submit-package\.mjs\b/u;
var DOVE_MCP_BUNDLE_PATH = /(?:^|[/\\])mcp[/\\]dove-state-server-package\.mjs$/u;
function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function readSmallRegularFile(root, relativePath, fsOps, maxBytes = 2 * 1024 * 1024) {
  const absolutePath = path9.join(root, relativePath);
  const stat = lstatOrNull(fsOps, absolutePath);
  if (stat === null || stat.isSymbolicLink() || !stat.isFile() || stat.size > maxBytes) return null;
  return fsOps.readFileSync(absolutePath, "utf8");
}
function legacyMarkerHits(root, fsOps) {
  return LEGACY_PROJECT_MARKER_PATHS.filter((relativePath) => {
    const content = readSmallRegularFile(root, relativePath, fsOps, 64 * 1024);
    if (content === null) return false;
    try {
      const value = parseJsonWithoutDuplicateKeys(content, `Legacy Dove marker ${relativePath}`);
      return value !== null && typeof value === "object" && !Array.isArray(value) && value.host === "claude";
    } catch {
      return false;
    }
  });
}
function registrationHits(root, fsOps) {
  const hits = [];
  const mcp2 = readSmallRegularFile(root, ".mcp.json", fsOps, 512 * 1024);
  if (mcp2 !== null) {
    try {
      const value = parseJsonWithoutDuplicateKeys(mcp2, "Legacy Dove MCP configuration");
      const dove = value?.mcpServers?.dove;
      const args = Array.isArray(dove?.args) ? dove.args : [];
      if (dove?.command === "node" && args.some((argument) => typeof argument === "string" && DOVE_MCP_BUNDLE_PATH.test(argument))) {
        hits.push(".mcp.json#/mcpServers/dove");
      }
    } catch {
    }
  }
  const settings = readSmallRegularFile(root, ".claude/settings.json", fsOps, 512 * 1024);
  if (settings !== null) {
    try {
      const value = parseJsonWithoutDuplicateKeys(settings, "Legacy Dove Claude settings");
      if (DOVE_HOOK_COMMAND.test(JSON.stringify(value?.hooks?.UserPromptSubmit ?? null))) hits.push(".claude/settings.json#/hooks/UserPromptSubmit");
    } catch {
    }
  }
  return hits;
}
function bundleHits(root, fsOps) {
  return LEGACY_PROJECT_BUNDLE_PROBES.flatMap((probe) => {
    const content = readSmallRegularFile(root, probe.path, fsOps);
    if (content === null) return [];
    const signatureMatched = probe.signatures.some((signature) => content.includes(signature));
    return [{ path: probe.path, signatureMatched }];
  });
}
function deepFreeze(result) {
  Object.freeze(result.markerHits);
  Object.freeze(result.registrationHits);
  result.bundleHits.forEach(Object.freeze);
  Object.freeze(result.bundleHits);
  Object.freeze(result.evidence);
  return Object.freeze(result);
}
function inspectLegacyProjectInstallation(root, options = {}) {
  const fsOps = options.fsOps ?? fs9;
  const canonicalRoot3 = path9.resolve(root);
  const markerHits = legacyMarkerHits(canonicalRoot3, fsOps);
  const registrationHitsFound = registrationHits(canonicalRoot3, fsOps);
  const bundles = bundleHits(canonicalRoot3, fsOps);
  const reliableBundleCombination = bundles.length >= 2;
  const detected = markerHits.length > 0 || registrationHitsFound.length > 0 || reliableBundleCombination;
  const evidence = [
    ...markerHits.map((entry) => `marker:${entry}`),
    ...registrationHitsFound.map((entry) => `registration:${entry}`),
    ...reliableBundleCombination ? bundles.map((entry) => `bundle:${entry.path}${entry.signatureMatched ? ":signature" : ""}`) : []
  ];
  return deepFreeze({
    state: detected ? "unsupported-legacy" : "absent",
    detected,
    root: canonicalRoot3,
    markerHits: [...markerHits],
    registrationHits: [...registrationHitsFound],
    bundleHits: bundles.map((entry) => ({ ...entry })),
    evidence
  });
}

// src/core/project-root.mjs
import fs10 from "node:fs";
import path10 from "node:path";
var INSTALLATION_DIRECTORY = path10.posix.dirname(INSTALLATION_MANIFEST_PATH);
function realpathNative2(fsOps, targetPath) {
  return typeof fsOps.realpathSync?.native === "function" ? fsOps.realpathSync.native(targetPath) : fsOps.realpathSync(targetPath);
}
function canonicalExistingDirectory(value, label, fsOps) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error(`${label} must name an existing directory.`);
  const resolved = path10.resolve(value);
  let stat;
  try {
    stat = fsOps.statSync(resolved);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`${label} must name an existing directory: ${resolved}.`);
    throw error;
  }
  if (!stat.isDirectory()) throw new Error(`${label} must name an existing directory: ${resolved}.`);
  return realpathNative2(fsOps, resolved);
}
function parentDirectories2(start) {
  const directories = [];
  let current = start;
  while (true) {
    directories.push(current);
    const parent = path10.dirname(current);
    if (parent === current) return directories;
    current = parent;
  }
}
function lstatOrNull2(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function installationStateAt(root, options) {
  const fsOps = options.fsOps ?? fs10;
  const directoryPath = path10.join(root, INSTALLATION_DIRECTORY);
  const manifestPath = path10.join(root, INSTALLATION_MANIFEST_PATH);
  const manifestStat = lstatOrNull2(fsOps, manifestPath);
  if (manifestStat === null) {
    const directoryStat2 = lstatOrNull2(fsOps, directoryPath);
    if (directoryStat2 === null) return { state: "absent", root, manifestPath };
    return { state: "residue", root, manifestPath, directoryPath, directoryStat: directoryStat2 };
  }
  if (manifestStat.isSymbolicLink()) throw new Error(`Dove project installation manifest must not be a symbolic link: ${manifestPath}.`);
  if (!manifestStat.isFile()) throw new Error(`Dove project installation manifest must be a regular file: ${manifestPath}.`);
  const directoryStat = lstatOrNull2(fsOps, directoryPath);
  if (directoryStat === null || directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) throw new Error(`Dove installation path must be a real directory: ${directoryPath}.`);
  const manifest = readProjectInstallationManifest(root, { ...options, allowPrevious: true, hostIds: options.hostIds ?? PROJECT_HOST_IDS2 });
  return { state: "initialized", root, manifestPath, manifest };
}
function assertSafeInitCandidate(candidate, installation) {
  if (installation.state !== "residue") return;
  const stat = installation.directoryStat;
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove installation path must be a real directory: ${installation.directoryPath}.`);
  throw new Error(`Dove installation directory is incomplete because ${INSTALLATION_MANIFEST_PATH} is missing at ${candidate}.`);
}
function setupEvidenceAt(root, fsOps, options = {}) {
  const paths = [
    INSTALLATION_MANIFEST_PATH,
    LEGACY_INSTALLATION_MANIFEST_PATH,
    ...options.includeResearch === true ? [".dove/manifest.json"] : []
  ];
  for (const relativePath of paths) {
    const target = path10.join(root, relativePath);
    const stat = lstatOrNull2(fsOps, target);
    if (stat === null) continue;
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`Dove setup marker must be a regular non-symbolic-link file: ${target}.`);
    }
    return { state: "marker", relativePath };
  }
  for (const relativePath of [INSTALLATION_DIRECTORY, ".dove-install"]) {
    const target = path10.join(root, relativePath);
    const stat = lstatOrNull2(fsOps, target);
    if (stat === null) continue;
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Dove setup path must be a real directory: ${target}.`);
    }
    return { state: "residue", relativePath };
  }
  return { state: "absent", relativePath: null };
}
function legacyInitError(candidate, root, evidence) {
  if (evidence.relativePath === LEGACY_INSTALLATION_MANIFEST_PATH) {
    return new Error(`Dove found a legacy project installation at ${root}. Run 'dove upgrade' to preserve its research state, or 'dove reinstall' to delete and recreate Dove state.`);
  }
  if (evidence.relativePath === ".dove/manifest.json") {
    return new Error(`Dove found an unsupported legacy research workspace at ${root}. Run 'dove reinstall' to delete and recreate Dove state, or 'dove doctor --json' for diagnosis.`);
  }
  return new Error(`Dove found incomplete legacy Dove state at ${root}. Run 'dove doctor --json' before initializing another project.`);
}
function gitRootFrom(start, fsOps) {
  for (const directory of parentDirectories2(start)) {
    const dotGit = path10.join(directory, ".git");
    const stat = lstatOrNull2(fsOps, dotGit);
    if (stat === null) continue;
    if (stat.isSymbolicLink()) throw new Error(`Git project marker must not be a symbolic link: ${dotGit}.`);
    if (!stat.isDirectory() && !stat.isFile()) throw new Error(`Git project marker must be a file or directory: ${dotGit}.`);
    return directory;
  }
  return null;
}
function initRequiredError(start) {
  return new Error(`Dove project integration is not initialized from ${start}. Run 'dove init' from the project root, or use 'dove init --project <dir>'.`);
}
function resolveProjectRootForInit(project2, options = {}) {
  const fsOps = options.fsOps ?? fs10;
  const explicitProject = project2 !== void 0 && project2 !== null;
  const candidateInput = explicitProject ? project2 : options.cwd ?? process.cwd();
  const candidate = canonicalExistingDirectory(candidateInput, explicitProject ? "Dove project" : "Current working directory", fsOps);
  const gitRoot = gitRootFrom(candidate, fsOps);
  const allDirectories = parentDirectories2(candidate);
  const directories = gitRoot === null ? allDirectories : allDirectories.slice(0, allDirectories.indexOf(gitRoot) + 1);
  for (let index = 0; index < directories.length; index += 1) {
    const directory = directories[index];
    const installation = installationStateAt(directory, options);
    if (index === 0) assertSafeInitCandidate(candidate, installation);
    if (installation.state === "initialized") {
      if (index === 0) throw new Error(`Dove project integration is already initialized at ${directory}. Use dove sync instead.`);
      throw new Error(`Refusing nested Dove project initialization at ${candidate}; an initialized project already exists at ${directory}.`);
    }
    const evidence = setupEvidenceAt(directory, fsOps, { includeResearch: index === 0 });
    if (evidence.state !== "absent") throw legacyInitError(candidate, directory, evidence);
  }
  if (!explicitProject) {
    const gitRoot2 = gitRootFrom(candidate, fsOps);
    if (gitRoot2 !== null && gitRoot2 !== candidate) {
      throw new Error(`Refusing to initialize Dove from Git project subdirectory ${candidate}. Run dove init from the Git root ${gitRoot2}, or pass an explicit --project directory.`);
    }
  }
  return candidate;
}
function resolveInstalledProjectRoot(start, options = {}) {
  const fsOps = options.fsOps ?? fs10;
  const startingDirectory = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project search start", fsOps);
  for (const directory of parentDirectories2(startingDirectory)) {
    const installation = installationStateAt(directory, options);
    if (installation.state === "initialized") return directory;
  }
  throw initRequiredError(startingDirectory);
}
function inspectProjectRoot(start, options = {}) {
  let canonicalStart = null;
  try {
    canonicalStart = canonicalExistingDirectory(start ?? options.cwd ?? process.cwd(), "Dove project search start", options.fsOps ?? fs10);
    const root = resolveInstalledProjectRoot(canonicalStart, options);
    return Object.freeze({ state: "initialized", initialized: true, start: canonicalStart, root, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const uninitialized = message.includes("Dove project integration is not initialized");
    return Object.freeze({
      state: uninitialized ? "uninitialized" : "invalid",
      initialized: false,
      start: canonicalStart,
      root: null,
      error: message
    });
  }
}

// scripts/generate-command-adapters.mjs
import fs12 from "node:fs";
import path12 from "node:path";
import { fileURLToPath } from "node:url";

// src/core/contained-write.mjs
import fs11 from "node:fs";
import path11 from "node:path";

// scripts/generate-command-adapters.mjs
var __filename = fileURLToPath(import.meta.url);
var __dirname = path12.dirname(__filename);
var PACKAGE_ROOT = path12.resolve(__dirname, "..");
function markdownTitle(command) {
  return command.title.replace(/\b\w/g, (char) => char.toUpperCase());
}
function yamlString(value) {
  return JSON.stringify(String(value).replace(/\n/g, " "));
}
function unique2(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
function dailyUseBullets(command) {
  const dailyFlow = command.ux?.dailyFlow;
  return Array.isArray(dailyFlow) ? dailyFlow.filter(Boolean) : [];
}
function exampleBullets(command, hostId = null) {
  const examples = command.ux?.examples;
  if (!Array.isArray(examples)) {
    return [];
  }
  return examples.map((example) => {
    const text2 = String(example).trim();
    return hostId === "opencode" ? text2.replace(/^\/dove:/u, "/dove.") : text2;
  }).filter(Boolean);
}
function toolBullets(command) {
  const tools = unique2(command.requiredTools ?? []);
  return [`Dove MCP tools: ${tools.map((tool) => `\`${tool}\``).join(", ")}.`];
}
function renderBullets(bullets2) {
  return bullets2.map((bullet) => `- ${bullet}`).join("\n");
}
function renderWorkflow(command) {
  const modes = command.callFlow?.modes;
  if (!Array.isArray(modes) || modes.length === 0) return "";
  const lines = ["## Workflow", ""];
  for (const item of modes) {
    lines.push(`- **${item.when}**`);
    for (const [index, step] of item.steps.entries()) {
      const persistence = step.persistWhen && step.persistWhen !== "never" ? ` Persist only when: ${step.persistWhen}.` : " No durable Dove write is required.";
      if (step.type === "host") {
        lines.push(`  ${index + 1}. Use host tools (${step.readOnly ? "read-only" : "work"}; ${step.capability}). ${step.instruction}${persistence}`);
      } else {
        lines.push(`  ${index + 1}. Call \`${step.tool}\` (${step.readOnly ? "read-only" : "bounded"}). ${step.instruction}${persistence}`);
      }
    }
    for (const clarification of item.clarification ?? []) {
      lines.push(`  - Clarification: ${clarification}`);
    }
  }
  return lines.join("\n");
}
function renderGuidance(command) {
  const notes = Array.isArray(command.adapterNotes) ? command.adapterNotes.filter(Boolean) : [];
  return notes.length > 0 ? `## Command guidance

${renderBullets(notes)}` : "";
}
function renderCapsule(command, hostId = null) {
  const responsePreference = ["claude", "agents"].includes(hostId) ? [] : PUBLIC_RESPONSE_CAPSULE;
  return `## Dove capsule

${renderBullets([
    ...toolBullets(command),
    ...responsePreference,
    ...HOST_ADAPTER_POLICY.adapterBullets
  ])}`;
}
function renderExamples(command, hostId = null) {
  const examples = exampleBullets(command, hostId);
  return examples.length > 0 ? `

## Examples

${examples.map((example) => `- \`${example}\``).join("\n")}` : "";
}
function renderBody(command, heading, hostId = null) {
  const purpose = command.summary;
  const dailyUse = renderBullets(dailyUseBullets(command));
  const examples = renderExamples(command, hostId);
  const workflow2 = renderWorkflow(command);
  const guidance = renderGuidance(command);
  const capsule = renderCapsule(command, hostId);
  return `# ${heading}

${purpose}

## Use when

${dailyUse}${examples}

${workflow2}${guidance ? `

${guidance}` : ""}

${capsule}
`;
}
function renderFrontmatter(command, fields = {}) {
  const lines = ["---"];
  if (fields.name) {
    lines.push(`name: ${fields.name}`);
  }
  lines.push(`description: ${yamlString(command.summary)}`);
  lines.push("---", "");
  return lines.join("\n");
}
function renderMarkdownCommand(command, heading, hostId = null) {
  return `${renderFrontmatter(command)}
${renderBody(command, heading, hostId)}`;
}
function renderSkill(command, hostId = null) {
  const name = `dove-${hostCommandSlug(command.id)}`;
  return `${renderFrontmatter(command, { name })}
${renderBody(command, markdownTitle(command), hostId)}`;
}
function renderCommandAdapter(hostId, command) {
  switch (hostId) {
    case "opencode":
    case "claude":
      return renderMarkdownCommand(command, command.id, hostId);
    case "cursor":
      return renderMarkdownCommand(command, `dove-${hostCommandSlug(command.id)}`, hostId);
    case "codex":
    case "agents":
      return renderSkill(command, hostId);
    default:
      throw new Error(`Unknown host adapter: ${hostId}`);
  }
}
function generatedAdapterEntries() {
  return PROJECT_HOST_IDS.flatMap((hostId) => COMMAND_SURFACES.map((command) => ({
    hostId,
    command,
    relativePath: adapterPathForCommand(hostId, command),
    content: renderCommandAdapter(hostId, command)
  })));
}
function generatedClaudeAmbientProjectEntries() {
  return [
    { relativePath: DOVE_CLAUDE_AMBIENT_RULE_PATH, content: renderClaudeAmbientRule() },
    { relativePath: DOVE_CLAUDE_AMBIENT_SKILL_PATH, content: renderClaudeAmbientSkill() },
    { relativePath: DOVE_CLAUDE_LESSONS_SKILL_PATH, content: renderClaudeLessonsIntakeSkill() }
  ];
}

// src/core/project-installation.mjs
var MCP_PATH = ".mcp.json";
var MCP_SELECTOR = "/mcpServers/dove";
var SETTINGS_SELECTOR = "/hooks/UserPromptSubmit[dove-user-prompt-submit]";
var MCP_APPROVAL_DIGEST = semanticDigest("dove");
var CLAUDE_HOST = "claude";
var MANIFEST_OWNER = "integration:manifest";
var FORBIDDEN_RESOURCE_PREFIXES = [".dove/", "bin/", "dist/", "mcp/", "scripts/"];
var PREVIOUS_CLAUDE_INIT_PATH = ".claude/commands/dove/init.md";
var RETIRED_DOMAIN_COMMAND_PATHS = Object.freeze([
  ".claude/commands/dove/version.md"
]);
var UPGRADE_PREVIEW_TYPE = "project-upgrade";
var UPGRADE_PREVIEW_VERSION = 1;
var COMPLETE_REINSTALL_PREVIEW_TYPE = "project-complete-reinstall";
var COMPLETE_REINSTALL_PREVIEW_VERSION = 1;
var LIFECYCLE_SHARED_JSON_PATHS = Object.freeze([
  MCP_PATH,
  DOVE_CLAUDE_SETTINGS_PATH,
  DOVE_CLAUDE_LOCAL_SETTINGS_PATH,
  ".opencode.json"
]);
var LEGACY_DOVE_MCP_BUNDLE_ARGS = Object.freeze(/* @__PURE__ */ new Set([
  "./mcp/dove-state-server-package.mjs",
  "${CLAUDE_PROJECT_DIR:-.}/mcp/dove-state-server-package.mjs"
]));
var PREVIOUS_CLAUDE_INIT_DIGESTS = Object.freeze(/* @__PURE__ */ new Set([
  "8bc54cb154048273c4e6f8b5c77ae76453d2cff788c98bab6fc4882bc2a7dc5e"
]));
function plainObject4(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function sha2563(content) {
  return crypto5.createHash("sha256").update(content).digest("hex");
}
function canonicalJson2(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson2).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson2(value[key])}`).join(",")}}`;
}
function semanticDigest(value) {
  return sha2563(canonicalJson2(value));
}
function normalizedGeneratedContent(content) {
  return `${String(content).trimEnd()}
`;
}
function managedKey2(entry) {
  return `${entry.path}\0${entry.mode}\0${entry.selector ?? ""}\0${entry.owner}`;
}
function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function samePackage(left, right) {
  return left.name === right.name && left.version === right.version;
}
function sameManaged(left, right) {
  return left.length === right.length && left.every((entry, index) => managedKey2(entry) === managedKey2(right[index]) && entry.digest === right[index].digest);
}
function exactTimestamp2(value) {
  if (value === void 0) return (/* @__PURE__ */ new Date()).toISOString();
  const timestamp2 = value instanceof Date ? value.toISOString() : value;
  if (typeof timestamp2 !== "string" || new Date(timestamp2).toISOString() !== timestamp2) {
    throw new Error("Project integration now must be a Date or exact ISO timestamp.");
  }
  return timestamp2;
}
function assertPackageInput(packageName, packageVersion, { required }) {
  if (!required && packageName === void 0 && packageVersion === void 0) return;
  if (typeof packageName !== "string" || !packageName || packageName !== packageName.trim() || packageName.includes("\0")) {
    throw new Error("Project integration packageName must be a non-empty trimmed string.");
  }
  if (typeof packageVersion !== "string" || !packageVersion || packageVersion !== packageVersion.trim()) {
    throw new Error("Project integration packageVersion must be a semantic version string.");
  }
}
function normalizeSelectedHosts(raw, { defaultWhenEmpty }) {
  if (Array.isArray(raw) && raw.length === 0) throw new Error("Dove project integration requires at least one host.");
  const hosts = normalizeHostSelection(raw, { defaultWhenEmpty, requireInitializable: true });
  if (hosts.length === 0) throw new Error("Dove project integration requires at least one host.");
  return [...hosts];
}
function assertManagedResourcePath(relativePath) {
  if (relativePath === ".dove" || relativePath.startsWith(".dove/")) {
    throw new Error(`Project integration resources must not manage Dove workspace state: ${relativePath}.`);
  }
  if (FORBIDDEN_RESOURCE_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) {
    throw new Error(`Project integration resources must not install runtime bundles: ${relativePath}.`);
  }
}
function claudeResources() {
  const claudeRoleEntries = generatedRoleDefinitionEntries().filter((entry) => entry.relativePath.startsWith(".claude/agents/"));
  const exclusiveEntries = [
    ...generatedAdapterEntries().filter((entry) => entry.hostId === CLAUDE_HOST),
    ...generatedClaudeAmbientProjectEntries(),
    ...claudeRoleEntries
  ].map((entry) => {
    assertManagedResourcePath(entry.relativePath);
    const content = normalizedGeneratedContent(entry.content);
    return {
      hostId: CLAUDE_HOST,
      kind: "exclusive",
      path: entry.relativePath,
      owner: `host:${CLAUDE_HOST}:file:${entry.relativePath}`,
      mode: "exclusive-file",
      selector: null,
      content,
      digest: sha2563(content)
    };
  });
  const fragments = [
    {
      hostId: CLAUDE_HOST,
      kind: "mcp-fragment",
      path: MCP_PATH,
      owner: `host:${CLAUDE_HOST}:mcp:dove`,
      mode: "json-fragment",
      selector: MCP_SELECTOR,
      fragment: INSTALLED_DOVE_MCP_SERVER,
      digest: semanticDigest(INSTALLED_DOVE_MCP_SERVER)
    },
    {
      hostId: CLAUDE_HOST,
      kind: "settings-fragment",
      path: DOVE_CLAUDE_SETTINGS_PATH,
      owner: `host:${CLAUDE_HOST}:ambient-hook`,
      mode: "json-fragment",
      selector: SETTINGS_SELECTOR,
      fragment: DOVE_CLAUDE_AMBIENT_HOOK_ENTRY,
      digest: semanticDigest(DOVE_CLAUDE_AMBIENT_HOOK_ENTRY)
    },
    {
      hostId: CLAUDE_HOST,
      kind: "mcp-approval-fragment",
      path: DOVE_CLAUDE_LOCAL_SETTINGS_PATH,
      owner: `host:${CLAUDE_HOST}:mcp-approval:dove`,
      mode: "json-fragment",
      selector: DOVE_CLAUDE_MCP_APPROVAL_SELECTOR,
      fragment: "dove",
      digest: MCP_APPROVAL_DIGEST
    }
  ];
  fragments.forEach((entry) => assertManagedResourcePath(entry.path));
  const resources = [...exclusiveEntries, ...fragments];
  const keys = resources.map(managedKey2);
  if (new Set(keys).size !== keys.length) throw new Error("Generated project integration resources contain duplicate ownership entries.");
  return resources;
}
function resourcesForHosts(hosts) {
  const resources = claudeResources().filter((entry) => hosts.includes(entry.hostId));
  return resources.sort((left, right) => managedKey2(left).localeCompare(managedKey2(right)));
}
function retiredExclusiveResource(oldEntry) {
  return {
    hostId: CLAUDE_HOST,
    kind: "exclusive",
    path: oldEntry.path,
    owner: oldEntry.owner,
    mode: oldEntry.mode,
    selector: oldEntry.selector,
    content: null,
    digest: oldEntry.digest
  };
}
function previousManifestRetiredResources(manifest) {
  if (!isPreviousProjectInstallationManifest(manifest)) return [];
  return manifest.managed.flatMap((entry) => {
    if (entry.path !== PREVIOUS_CLAUDE_INIT_PATH || entry.mode !== "exclusive-file" || entry.selector !== null) return [];
    if (!PREVIOUS_CLAUDE_INIT_DIGESTS.has(entry.digest)) {
      throw new Error(`Previous Dove project installation manifest has an unrecognized retired resource digest at ${entry.path}.`);
    }
    return [retiredExclusiveResource(entry)];
  });
}
function currentManifestRetiredDomainResources(manifest) {
  if (isPreviousProjectInstallationManifest(manifest)) return [];
  const retiredEntries = manifest.managed.filter((entry) => RETIRED_DOMAIN_COMMAND_PATHS.includes(entry.path));
  if (retiredEntries.length === 0) return [];
  if (retiredEntries.length !== RETIRED_DOMAIN_COMMAND_PATHS.length || RETIRED_DOMAIN_COMMAND_PATHS.some((retiredPath) => !retiredEntries.some((entry) => entry.path === retiredPath))) {
    throw new Error("Dove project installation manifest contains an incomplete retired domain command inventory.");
  }
  for (const entry of retiredEntries) {
    if (entry.mode !== "exclusive-file" || entry.selector !== null || entry.owner !== `host:${CLAUDE_HOST}:file:${entry.path}`) {
      throw new Error(`Dove project installation manifest contains invalid retired domain command ownership at ${entry.path}.`);
    }
  }
  return retiredEntries.map(retiredExclusiveResource);
}
function manifestRetiredResources(manifest) {
  return [
    ...previousManifestRetiredResources(manifest),
    ...currentManifestRetiredDomainResources(manifest)
  ];
}
function lstatOrNull3(fsOps, absolutePath) {
  try {
    return fsOps.lstatSync(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function inspectRegularProjectFile(root, relativePath, fsOps) {
  let current = root;
  const components = relativePath.split("/");
  for (let index = 0; index < components.length; index += 1) {
    current = path13.join(current, components[index]);
    const stat = lstatOrNull3(fsOps, current);
    if (stat === null) return { exists: false, bytes: null, digest: null, mode: null };
    if (stat.isSymbolicLink()) throw new Error(`Dove project integration path must not be a symbolic link: ${relativePath}.`);
    if (index < components.length - 1) {
      if (!stat.isDirectory()) throw new Error(`Dove project integration parent must be a directory: ${relativePath}.`);
      continue;
    }
    if (!stat.isFile()) throw new Error(`Dove project integration path must be absent or a regular file: ${relativePath}.`);
    const bytes = fsOps.readFileSync(current);
    return { exists: true, bytes, digest: sha2563(bytes), mode: stat.mode & 4095 };
  }
  throw new Error(`Invalid Dove project integration path: ${relativePath}.`);
}
function parseSharedJson(state2, relativePath) {
  if (!state2.exists) return {};
  const value = parseJsonWithoutDuplicateKeys(state2.bytes.toString("utf8"), relativePath);
  if (!plainObject4(value)) throw new Error(`${relativePath} must contain a JSON object.`);
  return value;
}
function serializeSharedJson(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}
function referencesDoveHook(entry) {
  if (!plainObject4(entry) || !Array.isArray(entry.hooks)) return false;
  return entry.hooks.some((hook) => plainObject4(hook) && typeof hook.command === "string" && (hook.command.includes("dove hook user-prompt-submit") || hook.command.includes("dove-user-prompt-submit-package.mjs")));
}
function recognizedLifecycleDoveHookEntry(entry) {
  if (!plainObject4(entry) || Object.keys(entry).length !== 1 || !Array.isArray(entry.hooks) || entry.hooks.length !== 1) return false;
  const hook = entry.hooks[0];
  if (!plainObject4(hook) || hook.type !== "command" || typeof hook.command !== "string") return false;
  if (Object.keys(hook).some((key) => !["type", "command", "timeout"].includes(key))) return false;
  if (hook.command === DOVE_CLAUDE_AMBIENT_HOOK_COMMAND) return hook.timeout === 10;
  return hook.command === "node ./scripts/dove-user-prompt-submit-package.mjs" && (hook.timeout === void 0 || hook.timeout === 10);
}
function mcpApprovalFragmentState(settings) {
  const approval = inspectClaudeMcpApprovalSettings(settings);
  return {
    exists: approval.approved,
    disabled: approval.disabled,
    digest: approval.approved ? MCP_APPROVAL_DIGEST : null
  };
}
function settingsFragmentState(settings) {
  if (settings.hooks !== void 0 && !plainObject4(settings.hooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks must be a JSON object.`);
  const promptHooks = settings.hooks?.UserPromptSubmit;
  if (promptHooks !== void 0 && !Array.isArray(promptHooks)) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} hooks.UserPromptSubmit must be an array.`);
  const entries = promptHooks ?? [];
  const candidates = entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => referencesDoveHook(entry));
  if (candidates.length > 1) throw new Error(`${DOVE_CLAUDE_SETTINGS_PATH} defines multiple Dove-managed UserPromptSubmit hooks.`);
  if (candidates.length === 0) return { exists: false, digest: null, index: -1, entry: null };
  return { exists: true, digest: semanticDigest(candidates[0].entry), index: candidates[0].index, entry: candidates[0].entry };
}
function mcpFragmentState(config) {
  if (config.mcpServers !== void 0 && !plainObject4(config.mcpServers)) throw new Error(`${MCP_PATH} mcpServers must be a JSON object.`);
  if (!Object.hasOwn(config.mcpServers ?? {}, "dove")) return { exists: false, digest: null, fragment: null };
  const fragment = config.mcpServers.dove;
  return { exists: true, digest: semanticDigest(fragment), fragment };
}
function driftError(resource, currentDigest) {
  const current = currentDigest ?? "absent";
  return new Error(`Dove project integration ownership drift at ${resource.path}${resource.selector ? `#${resource.selector}` : ""}; current digest ${current} matches neither the manifest nor the expected resource.`);
}
function conflictError(resource) {
  return new Error(`Dove project integration cannot claim conflicting content at ${resource.path}${resource.selector ? `#${resource.selector}` : ""}.`);
}
function transactionWrite(root, resource, content) {
  return { root, relativePath: resource.path, content, encoding: "utf8", force: true, label: `Dove project integration resource ${resource.path}` };
}
function transactionDelete(root, resource) {
  return { root, relativePath: resource.path, delete: true, force: true, label: `Dove project integration resource ${resource.path}` };
}
function planExclusive(root, resource, oldEntry, selected, fsOps) {
  const state2 = inspectRegularProjectFile(root, resource.path, fsOps);
  if (!oldEntry) {
    if (!selected) throw new Error(`Cannot remove unowned project integration resource: ${resource.path}.`);
    if (!state2.exists) return { entry: transactionWrite(root, resource, resource.content), changed: true };
    if (state2.digest === resource.digest) return { entry: null, changed: false };
    throw conflictError(resource);
  }
  if (selected) {
    if (state2.digest !== oldEntry.digest && state2.digest !== resource.digest) throw driftError(resource, state2.digest);
    if (state2.digest === resource.digest) return { entry: null, changed: oldEntry.digest !== resource.digest };
    return { entry: transactionWrite(root, resource, resource.content), changed: true };
  }
  if (state2.digest !== oldEntry.digest) throw driftError(resource, state2.digest);
  return { entry: transactionDelete(root, resource), changed: true };
}
function planMcpFragment(root, resource, oldEntry, selected, fsOps) {
  const state2 = inspectRegularProjectFile(root, resource.path, fsOps);
  const config = parseSharedJson(state2, resource.path);
  const current = mcpFragmentState(config);
  if (!oldEntry) {
    if (!selected) throw new Error(`Cannot remove unowned project integration fragment: ${resource.path}#${resource.selector}.`);
    if (current.exists) {
      if (current.digest === resource.digest) return { entry: null, changed: false };
      throw conflictError(resource);
    }
    const merged = { ...config, mcpServers: { ...config.mcpServers ?? {}, dove: INSTALLED_DOVE_MCP_SERVER } };
    return { entry: transactionWrite(root, resource, serializeSharedJson(merged)), changed: true };
  }
  if (!current.exists || current.digest !== oldEntry.digest && current.digest !== resource.digest) throw driftError(resource, current.digest);
  if (selected) {
    if (current.digest === resource.digest) return { entry: null, changed: oldEntry.digest !== resource.digest };
    const merged = { ...config, mcpServers: { ...config.mcpServers, dove: INSTALLED_DOVE_MCP_SERVER } };
    return { entry: transactionWrite(root, resource, serializeSharedJson(merged)), changed: true };
  }
  const servers = { ...config.mcpServers };
  delete servers.dove;
  return { entry: transactionWrite(root, resource, serializeSharedJson({ ...config, mcpServers: servers })), changed: true };
}
function planMcpApprovalFragment(root, resource, oldEntry, selected, fsOps) {
  const state2 = inspectRegularProjectFile(root, resource.path, fsOps);
  const settings = parseSharedJson(state2, resource.path);
  const current = mcpApprovalFragmentState(settings);
  if (current.disabled) {
    throw new Error(`${DOVE_CLAUDE_LOCAL_SETTINGS_PATH} explicitly disables the Dove MCP server; Dove will not override that decision.`);
  }
  if (!oldEntry) {
    if (!selected) throw new Error(`Cannot remove unowned project integration fragment: ${resource.path}#${resource.selector}.`);
    if (current.exists) return { entry: null, changed: false };
    const merged2 = mergeClaudeMcpApprovalSettings(settings);
    return { entry: transactionWrite(root, resource, serializeSharedJson(merged2.settings)), changed: true };
  }
  if (!current.exists || current.digest !== oldEntry.digest && current.digest !== resource.digest) {
    throw driftError(resource, current.digest);
  }
  if (selected) return { entry: null, changed: oldEntry.digest !== resource.digest };
  const merged = removeClaudeMcpApprovalSettings(settings);
  return merged.changed ? { entry: transactionWrite(root, resource, serializeSharedJson(merged.settings)), changed: true } : { entry: null, changed: false };
}
function planSettingsFragment(root, resource, oldEntry, selected, fsOps) {
  const state2 = inspectRegularProjectFile(root, resource.path, fsOps);
  const settings = parseSharedJson(state2, resource.path);
  const current = settingsFragmentState(settings);
  if (!oldEntry) {
    if (!selected) throw new Error(`Cannot remove unowned project integration fragment: ${resource.path}#${resource.selector}.`);
    if (current.exists) {
      if (current.digest === resource.digest) return { entry: null, changed: false };
      throw conflictError(resource);
    }
    const merged2 = mergeClaudeAmbientSettings(settings);
    if (!merged2.changed) return { entry: null, changed: false };
    return { entry: transactionWrite(root, resource, serializeSharedJson(merged2.settings)), changed: true };
  }
  if (!current.exists || current.digest !== oldEntry.digest && current.digest !== resource.digest) throw driftError(resource, current.digest);
  if (selected) {
    if (current.digest === resource.digest) return { entry: null, changed: oldEntry.digest !== resource.digest };
    const promptHooks2 = [...settings.hooks.UserPromptSubmit];
    promptHooks2[current.index] = DOVE_CLAUDE_AMBIENT_HOOK_ENTRY;
    const merged2 = { ...settings, hooks: { ...settings.hooks, UserPromptSubmit: promptHooks2 } };
    return { entry: transactionWrite(root, resource, serializeSharedJson(merged2)), changed: true };
  }
  const promptHooks = settings.hooks.UserPromptSubmit.filter((_, index) => index !== current.index);
  const merged = { ...settings, hooks: { ...settings.hooks, UserPromptSubmit: promptHooks } };
  return { entry: transactionWrite(root, resource, serializeSharedJson(merged)), changed: true };
}
function planResource(root, resource, oldEntry, selected, fsOps) {
  if (resource.kind === "exclusive") return planExclusive(root, resource, oldEntry, selected, fsOps);
  if (resource.kind === "mcp-fragment") return planMcpFragment(root, resource, oldEntry, selected, fsOps);
  if (resource.kind === "mcp-approval-fragment") return planMcpApprovalFragment(root, resource, oldEntry, selected, fsOps);
  if (resource.kind === "settings-fragment") return planSettingsFragment(root, resource, oldEntry, selected, fsOps);
  throw new Error(`Unsupported project integration resource kind: ${resource.kind}.`);
}
function rejectLegacy(root, fsOps) {
  const legacy = inspectLegacyProjectInstallation(root, { fsOps });
  if (legacy.detected) {
    throw new Error(`Unsupported legacy Dove project installation detected at ${root}: ${legacy.evidence.join(", ")}. Remove or migrate the legacy installation before continuing.`);
  }
}
function assertManifestInventory(manifest, allResources) {
  const retired = manifestRetiredResources(manifest);
  const selectedResources = resourcesForHosts(manifest.hosts);
  const expectedKeys = new Set([...selectedResources, ...retired].map(managedKey2));
  const actualKeys = new Set(manifest.managed.map(managedKey2));
  if (expectedKeys.size !== actualKeys.size || [...actualKeys].some((key) => !expectedKeys.has(key))) {
    throw new Error("Dove project installation manifest ownership inventory does not match its selected hosts and versioned migration inventory.");
  }
  const knownKeys = new Set([...allResources, ...retired].map(managedKey2));
  if (manifest.managed.some((entry) => !knownKeys.has(managedKey2(entry)))) {
    throw new Error("Dove project installation manifest contains unknown managed ownership entries.");
  }
}
function preparePlan({ root, hosts, packageName, packageVersion, now: now2, fsOps, manifest = null }) {
  const currentResources = claudeResources();
  const allResources = manifest ? [...currentResources, ...manifestRetiredResources(manifest)] : currentResources;
  if (manifest) assertManifestInventory(manifest, currentResources);
  const oldByKey = new Map((manifest?.managed ?? []).map((entry) => [managedKey2(entry), entry]));
  const desiredResources = resourcesForHosts(hosts);
  const desiredKeys = new Set(desiredResources.map(managedKey2));
  const resourceByKey = new Map(allResources.map((entry) => [managedKey2(entry), entry]));
  const keys = /* @__PURE__ */ new Set([...oldByKey.keys(), ...desiredKeys]);
  const entries = [];
  let resourcesChanged = false;
  for (const key of [...keys].sort()) {
    const resource = resourceByKey.get(key);
    if (!resource) throw new Error("Dove project installation manifest references an unknown resource.");
    const planned = planResource(root, resource, oldByKey.get(key) ?? null, desiredKeys.has(key), fsOps);
    if (planned.entry) entries.push(planned.entry);
    if (planned.changed) resourcesChanged = true;
  }
  const managed = desiredResources.map((resource) => ({
    path: resource.path,
    owner: resource.owner,
    mode: resource.mode,
    selector: resource.selector,
    digest: resource.digest
  }));
  const packageInfo = { name: packageName, version: packageVersion };
  const selectionChanged = manifest ? !sameArray(manifest.hosts, hosts) : true;
  const packageChanged = manifest ? !samePackage(manifest.package, packageInfo) : true;
  const ownershipChanged = manifest ? !sameManaged(manifest.managed, [...managed].sort((left, right) => managedKey2(left).localeCompare(managedKey2(right)))) : true;
  const manifestChanged = manifest === null || resourcesChanged || selectionChanged || packageChanged || ownershipChanged;
  const nextManifest = manifestChanged ? createProjectInstallationManifest({
    ...manifest ? { installationId: manifest.installationId, createdAt: manifest.createdAt } : {},
    package: packageInfo,
    hosts,
    managed,
    updatedAt: now2,
    ...!manifest ? { createdAt: now2 } : {}
  }, { hostIds: PROJECT_HOST_IDS2 }) : manifest;
  if (manifestChanged) {
    entries.push({
      root,
      relativePath: INSTALLATION_MANIFEST_PATH,
      content: serializeProjectInstallationManifest(nextManifest, { hostIds: PROJECT_HOST_IDS2 }),
      encoding: "utf8",
      force: true,
      label: MANIFEST_OWNER
    });
  }
  return { entries, manifest: nextManifest, manifestChanged };
}
function resultFromTransaction(status, target, hosts, manifest, transaction) {
  return {
    status,
    target,
    hosts: [...hosts],
    writtenPaths: [...transaction.writtenPaths],
    removedPaths: [...transaction.removedPaths],
    changedPaths: [...transaction.changedPaths],
    transactionState: transaction.transactionState,
    manifest
  };
}
function initializeProjectIntegration(rootOrProject, options = {}) {
  const fsOps = options.fsOps ?? fs13;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const hosts = normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: true });
  const now2 = exactTimestamp2(options.now);
  const root = resolveProjectRootForInit(rootOrProject, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  rejectLegacy(root, fsOps);
  const plan = preparePlan({
    root,
    hosts,
    packageName: options.packageName,
    packageVersion: options.packageVersion,
    now: now2,
    fsOps
  });
  const transaction = writeFileSetTransaction(plan.entries, { fsOps });
  return resultFromTransaction("initialized", root, hosts, plan.manifest, transaction);
}
function prepareInstalledPlan(start, options) {
  const fsOps = options.fsOps ?? fs13;
  const root = resolveInstalledProjectRoot(start, { fsOps, hostIds: PROJECT_HOST_IDS2 });
  rejectLegacy(root, fsOps);
  const manifest = readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2, allowPrevious: true });
  const hosts = options.hosts === void 0 ? [...manifest.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const packageName = options.packageName ?? manifest.package.name;
  const packageVersion = options.packageVersion ?? manifest.package.version;
  assertPackageInput(packageName, packageVersion, { required: true });
  const now2 = exactTimestamp2(options.now);
  const plan = preparePlan({ root, hosts, packageName, packageVersion, now: now2, fsOps, manifest });
  return { fsOps, root, hosts, currentManifest: manifest, ...plan };
}
function syncProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, options);
  const transaction = writeFileSetTransaction(prepared.entries, { fsOps: prepared.fsOps });
  const status = transaction.changedPaths.length === 0 ? "unchanged" : "synchronized";
  return resultFromTransaction(status, prepared.root, prepared.hosts, prepared.manifest, transaction);
}
function inspectProjectIntegration(start, options = {}) {
  const prepared = prepareInstalledPlan(start, options);
  const writtenPaths = prepared.entries.filter((entry) => entry.delete !== true).map((entry) => entry.relativePath);
  const removedPaths = prepared.entries.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  return {
    status: prepared.entries.length === 0 ? "current" : "needs-sync",
    target: prepared.root,
    hosts: [...prepared.hosts],
    writtenPaths,
    removedPaths,
    changedPaths: prepared.entries.map((entry) => entry.relativePath),
    transactionState: null,
    manifest: prepared.currentManifest
  };
}
function canonicalLifecycleRoot(start, fsOps) {
  const resolved = path13.resolve(start ?? process.cwd());
  const stat = fsOps.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove lifecycle project root must be a real directory: ${resolved}.`);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}
function lifecyclePathState(root, relativePath, fsOps) {
  const state2 = inspectRegularProjectFile(root, relativePath, fsOps);
  return { ...state2, relativePath };
}
function expectedLifecycleFileState(state2) {
  return state2.exists ? { exists: true, type: "file", sha256: state2.digest, mode: state2.mode } : { exists: false, type: "absent", sha256: null, mode: null };
}
function bindLifecycleFileState(root, relativePath, state2, entry = null) {
  const expectedState2 = expectedLifecycleFileState(state2);
  return entry === null ? { root, relativePath, assertOnly: true, expectedState: expectedState2, label: `Dove lifecycle replay assertion ${relativePath}` } : { ...entry, expectedState: expectedState2 };
}
function lifecycleReservedPaths() {
  return [.../* @__PURE__ */ new Set([
    ...Object.values(CURRENT_MANAGED_PATHS).flat(),
    ...Object.values(RETIRED_MANAGED_PATHS).flat(),
    PREVIOUS_CLAUDE_INIT_PATH,
    ...RETIRED_DOMAIN_COMMAND_PATHS,
    "mcp/dove-claude-project.json"
  ])];
}
function lifecycleExclusiveCleanupPaths() {
  return lifecycleReservedPaths().filter((relativePath) => !LIFECYCLE_SHARED_JSON_PATHS.includes(relativePath)).filter((relativePath) => relativePath !== "AGENTS.md").filter((relativePath) => !PACKAGE_RUNTIME_PATHS.includes(relativePath)).filter((relativePath) => /(?:\.md|SKILL\.md|\.json)$/u.test(relativePath)).sort();
}
function lifecycleDirectoryCleanupPaths() {
  return lifecycleReservedPaths().filter((relativePath) => !path13.posix.extname(relativePath)).filter((relativePath) => ![".dove", ".dove/install"].includes(relativePath)).sort((left, right) => right.split("/").length - left.split("/").length || left.localeCompare(right));
}
function inspectRealLifecycleDirectory(root, relativePath, fsOps) {
  let current = root;
  for (const component of relativePath.split("/")) {
    current = path13.join(current, component);
    const stat = lstatOrNull3(fsOps, current);
    if (stat === null) return false;
    if (stat.isSymbolicLink()) throw new Error(`Dove lifecycle reserved directory must not be a symbolic link: ${relativePath}.`);
    if (!stat.isDirectory()) throw new Error(`Dove lifecycle reserved directory path must be a real directory: ${relativePath}.`);
  }
  return true;
}
function assertLifecycleDirectoryCleanupExact(root, relativePath, entries, fsOps) {
  const scheduledChildren = new Set(entries.filter((entry) => entry.delete === true && path13.posix.dirname(entry.relativePath) === relativePath).map((entry) => path13.posix.basename(entry.relativePath)));
  const unexpected = fsOps.readdirSync(path13.join(root, relativePath)).map(String).filter((child) => !scheduledChildren.has(child));
  if (unexpected.length > 0) {
    throw new Error(`Dove lifecycle reserved directory contains unowned entries and cannot be removed: ${relativePath}/${unexpected.sort().join(`, ${relativePath}/`)}.`);
  }
}
function recognizedLifecycleMcpFragment(fragment) {
  if (!plainObject4(fragment) || !sameArray(Object.keys(fragment).sort(), ["args", "command", "type"])) return false;
  if (fragment.type !== "stdio") return false;
  if (fragment.command === "dove") return sameArray(fragment.args ?? [], ["mcp", "serve", "--project", "."]);
  return fragment.command === "node" && Array.isArray(fragment.args) && fragment.args.length === 1 && LEGACY_DOVE_MCP_BUNDLE_ARGS.has(fragment.args[0]);
}
function planLifecycleSharedJson(root, relativePath, fsOps, { installClaude }) {
  const state2 = lifecyclePathState(root, relativePath, fsOps);
  const value = parseSharedJson(state2, relativePath);
  let next = value;
  if (relativePath === MCP_PATH || relativePath === ".opencode.json") {
    if (value.mcpServers !== void 0 && !plainObject4(value.mcpServers)) throw new Error(`${relativePath} mcpServers must be a JSON object.`);
    const servers = value.mcpServers ?? {};
    const hasDove = Object.hasOwn(servers, "dove");
    if (hasDove && !recognizedLifecycleMcpFragment(servers.dove)) throw new Error(`${relativePath} contains an ambiguous non-Dove fragment at /mcpServers/dove.`);
    if (hasDove || relativePath === MCP_PATH && installClaude) {
      const nextServers = { ...servers };
      delete nextServers.dove;
      if (relativePath === MCP_PATH && installClaude) nextServers.dove = INSTALLED_DOVE_MCP_SERVER;
      next = { ...value, mcpServers: nextServers };
    }
  } else if (relativePath === DOVE_CLAUDE_SETTINGS_PATH) {
    if (value.hooks !== void 0 && !plainObject4(value.hooks)) throw new Error(`${relativePath} hooks must be a JSON object.`);
    const promptHooks = value.hooks?.UserPromptSubmit;
    if (promptHooks !== void 0 && !Array.isArray(promptHooks)) throw new Error(`${relativePath} hooks.UserPromptSubmit must be an array.`);
    const doveHooks = (promptHooks ?? []).filter(referencesDoveHook);
    if (doveHooks.length > 1 || doveHooks.some((entry) => !recognizedLifecycleDoveHookEntry(entry))) {
      throw new Error(`${relativePath} contains an ambiguous Dove UserPromptSubmit hook.`);
    }
    if (doveHooks.length === 1) {
      next = { ...value, hooks: { ...value.hooks, UserPromptSubmit: promptHooks.filter((entry) => !referencesDoveHook(entry)) } };
    }
    if (installClaude) next = mergeClaudeAmbientSettings(next).settings;
  } else if (relativePath === DOVE_CLAUDE_LOCAL_SETTINGS_PATH) {
    inspectClaudeMcpApprovalSettings(value);
    if ((value.enabledMcpjsonServers ?? []).includes("dove")) {
      next = { ...value, enabledMcpjsonServers: value.enabledMcpjsonServers.filter((name) => name !== "dove") };
    }
    if (installClaude) next = mergeClaudeMcpApprovalSettings(next).settings;
  }
  if (canonicalJson2(next) === canonicalJson2(value)) return { state: state2, entry: null };
  return {
    state: state2,
    entry: { root, relativePath, content: serializeSharedJson(next), encoding: "utf8", force: true, label: `Dove lifecycle shared JSON ${relativePath}` }
  };
}
function assertLifecycleRuntimeOwned(root, relativePath, fsOps) {
  const state2 = lifecyclePathState(root, relativePath, fsOps);
  if (!state2.exists) return state2;
  const probe = LEGACY_PROJECT_BUNDLE_PROBES.find((entry) => entry.path === relativePath);
  const content = state2.bytes.toString("utf8");
  if ((probe?.signatures ?? []).filter((signature) => content.includes(signature)).length < 2) {
    throw new Error(`Dove lifecycle cannot safely remove copied runtime without affirmative Dove signatures: ${relativePath}.`);
  }
  return state2;
}
function lifecycleManifest(root, options, hosts, now2, replay = null) {
  const desiredResources = resourcesForHosts(hosts);
  const managed = desiredResources.map((resource) => ({
    path: resource.path,
    owner: resource.owner,
    mode: resource.mode,
    selector: resource.selector,
    digest: resource.digest
  }));
  return replay ?? createProjectInstallationManifest({
    package: { name: options.packageName, version: options.packageVersion },
    hosts,
    managed,
    createdAt: now2,
    updatedAt: now2
  }, { hostIds: PROJECT_HOST_IDS2 });
}
function assertLegacyInstallationRoot(root, fsOps) {
  const legacyRoot = path13.join(root, ".dove-install");
  const stat = lstatOrNull3(fsOps, legacyRoot);
  if (stat === null || stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error("Dove Upgrade requires .dove-install to be a real directory.");
  }
  const children = fsOps.readdirSync(legacyRoot).map(String).sort();
  if (!sameArray(children, ["manifest.json"])) {
    throw new Error("Dove Upgrade requires .dove-install to contain only its legacy manifest.");
  }
  return { mode: stat.mode & 4095, treeDigest: inspectDirectoryTreeDigest(root, ".dove-install", { fsOps }) };
}
function installationSource(root, fsOps) {
  const currentState = lifecyclePathState(root, INSTALLATION_MANIFEST_PATH, fsOps);
  const legacyState = lifecyclePathState(root, LEGACY_INSTALLATION_MANIFEST_PATH, fsOps);
  if (currentState.exists && legacyState.exists) {
    throw new Error("Dove Upgrade found both current and legacy project installation manifests.");
  }
  if (currentState.exists) {
    return { kind: "current", state: currentState, manifest: readProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2, allowPrevious: true }) };
  }
  if (legacyState.exists) {
    return {
      kind: "legacy",
      state: legacyState,
      rootState: assertLegacyInstallationRoot(root, fsOps),
      manifest: readLegacyProjectInstallationManifest(root, { fsOps, hostIds: PROJECT_HOST_IDS2, allowPrevious: true })
    };
  }
  throw new Error("Dove Upgrade requires an installed project manifest.");
}
function prepareLifecycleIntegration(root, options, { hosts, manifest, removeOnly }) {
  const fsOps = options.fsOps ?? fs13;
  const desiredResources = removeOnly ? [] : resourcesForHosts(hosts);
  const desiredExclusivePaths = new Set(desiredResources.filter((resource) => resource.kind === "exclusive").map((resource) => resource.path));
  const entries = [];
  const operations = [];
  const observed = /* @__PURE__ */ new Map();
  const remember = (relativePath, state2) => {
    const previous = observed.get(relativePath);
    if (previous && (previous.exists !== state2.exists || previous.digest !== state2.digest || previous.mode !== state2.mode)) {
      throw new Error(`Dove lifecycle observed inconsistent file state while preparing ${relativePath}.`);
    }
    observed.set(relativePath, state2);
  };
  for (const relativePath of LIFECYCLE_SHARED_JSON_PATHS) {
    const planned = planLifecycleSharedJson(root, relativePath, fsOps, { installClaude: !removeOnly && hosts.includes(CLAUDE_HOST) });
    remember(relativePath, planned.state);
    operations.push({ path: relativePath, action: planned.entry ? "write" : "unchanged", observedDigest: planned.state.digest, observedMode: planned.state.mode });
    if (planned.entry) entries.push(planned.entry);
  }
  for (const relativePath of lifecycleExclusiveCleanupPaths()) {
    const state2 = lifecyclePathState(root, relativePath, fsOps);
    remember(relativePath, state2);
    if (!state2.exists) continue;
    if (relativePath === "mcp/dove-claude-project.json") {
      const marker = parseJsonWithoutDuplicateKeys(state2.bytes.toString("utf8"), "Legacy Dove project marker");
      if (!plainObject4(marker) || !sameArray(Object.keys(marker).sort(), ["host", "version"]) || marker.host !== "claude" || marker.version !== 1) {
        throw new Error(`Dove lifecycle cannot safely remove an ambiguous project marker: ${relativePath}.`);
      }
    }
    operations.push({ path: relativePath, action: desiredExclusivePaths.has(relativePath) ? "replace" : "remove", observedDigest: state2.digest, observedMode: state2.mode });
    if (!desiredExclusivePaths.has(relativePath)) {
      entries.push(bindLifecycleFileState(root, relativePath, state2, { root, relativePath, delete: true, force: true, label: `Dove lifecycle reserved resource ${relativePath}` }));
    }
  }
  for (const relativePath of PACKAGE_RUNTIME_PATHS) {
    const state2 = assertLifecycleRuntimeOwned(root, relativePath, fsOps);
    remember(relativePath, state2);
    if (!state2.exists) continue;
    operations.push({ path: relativePath, action: "remove", observedDigest: state2.digest, observedMode: state2.mode });
    entries.push(bindLifecycleFileState(root, relativePath, state2, { root, relativePath, delete: true, force: true, label: `Dove lifecycle copied runtime ${relativePath}` }));
  }
  for (const relativePath of lifecycleDirectoryCleanupPaths()) {
    if (!inspectRealLifecycleDirectory(root, relativePath, fsOps)) continue;
    assertLifecycleDirectoryCleanupExact(root, relativePath, entries, fsOps);
    const stat = fsOps.lstatSync(path13.join(root, relativePath));
    const treeDigest = inspectDirectoryTreeDigest(root, relativePath, { fsOps });
    operations.push({ path: relativePath, action: "remove-empty-directory", treeDigest });
    entries.push({
      root,
      relativePath,
      delete: true,
      deleteEmptyDirectory: true,
      expectedState: { exists: true, type: "directory", sha256: null, mode: stat.mode & 4095 },
      expectedTreeDigest: treeDigest,
      force: true,
      label: `Dove lifecycle retired directory ${relativePath}`
    });
  }
  if (!removeOnly) {
    for (const resource of desiredResources.filter((entry) => entry.kind === "exclusive")) {
      const state2 = lifecyclePathState(root, resource.path, fsOps);
      remember(resource.path, state2);
      operations.push({ path: resource.path, action: state2.digest === resource.digest ? "claim" : "write", observedDigest: state2.digest, observedMode: state2.mode, nextDigest: resource.digest });
      if (state2.digest !== resource.digest) entries.push(transactionWrite(root, resource, resource.content));
    }
  }
  return { entries, operations, observed, manifest };
}
function bindLifecycleObservedFiles(root, prepared) {
  const entryPaths = new Set(prepared.entries.map((entry) => entry.relativePath));
  prepared.entries = prepared.entries.map((entry) => {
    const state2 = prepared.observed.get(entry.relativePath);
    return state2 ? bindLifecycleFileState(root, entry.relativePath, state2, entry) : entry;
  });
  for (const [relativePath, state2] of prepared.observed) {
    if (!entryPaths.has(relativePath)) prepared.entries.push(bindLifecycleFileState(root, relativePath, state2));
  }
}
function lifecyclePreviewShape(plan) {
  const mutations = plan.entries.filter((entry) => entry.assertOnly !== true);
  const writtenPaths = mutations.filter((entry) => entry.delete !== true && entry.moveTo === void 0).map((entry) => entry.relativePath);
  const removedPaths = mutations.filter((entry) => entry.delete === true).map((entry) => entry.relativePath);
  const movedPaths = mutations.filter((entry) => entry.moveTo !== void 0).map((entry) => ({ from: entry.relativePath, to: entry.moveTo }));
  return Object.freeze({
    status: "ready",
    previewType: plan.previewType,
    previewVersion: plan.previewVersion,
    target: plan.root,
    hosts: Object.freeze([...plan.hosts]),
    writtenPaths: Object.freeze(writtenPaths),
    removedPaths: Object.freeze(removedPaths),
    movedPaths: Object.freeze(movedPaths.map(Object.freeze)),
    changedPaths: Object.freeze([.../* @__PURE__ */ new Set([...writtenPaths, ...removedPaths, ...movedPaths.flatMap((move) => [move.from, move.to])])]),
    manifest: plan.manifest,
    confirmation: Object.freeze({ required: plan.confirmationRequired, default: false, exactReplay: true, previewDigest: plan.previewDigest })
  });
}
function lifecycleBinding(plan) {
  return semanticDigest({
    previewType: plan.previewType,
    previewVersion: plan.previewVersion,
    target: plan.root,
    hosts: plan.hosts,
    manifest: plan.manifest,
    operations: plan.operations
  });
}
function prepareUpgrade(start, options = {}, replay = null) {
  const fsOps = options.fsOps ?? fs13;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  const source = installationSource(root, fsOps);
  const hosts = options.hosts === void 0 ? [...source.manifest.hosts] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const now2 = replay?.manifest?.createdAt ?? exactTimestamp2(options.now);
  const manifest = lifecycleManifest(root, options, hosts, now2, replay?.manifest);
  const prepared = prepareLifecycleIntegration(root, options, { hosts, manifest, removeOnly: false });
  if (source.kind === "legacy") {
    prepared.entries.push(bindLifecycleFileState(root, LEGACY_INSTALLATION_MANIFEST_PATH, source.state, {
      root,
      relativePath: LEGACY_INSTALLATION_MANIFEST_PATH,
      delete: true,
      force: true,
      label: "Legacy Dove installation manifest migration"
    }));
    prepared.entries.push({
      root,
      relativePath: ".dove-install",
      delete: true,
      deleteEmptyDirectory: true,
      expectedState: { exists: true, type: "directory", sha256: null, mode: source.rootState.mode },
      expectedTreeDigest: source.rootState.treeDigest,
      force: true,
      label: "Legacy Dove installation root cleanup"
    });
    prepared.operations.push({ path: ".dove-install", action: "remove-empty-directory", treeDigest: source.rootState.treeDigest });
    prepared.operations.push({ path: LEGACY_INSTALLATION_MANIFEST_PATH, action: "remove", observedDigest: source.state.digest, observedMode: source.state.mode });
  }
  const manifestState = lifecyclePathState(root, INSTALLATION_MANIFEST_PATH, fsOps);
  const manifestContent = serializeProjectInstallationManifest(manifest, { hostIds: PROJECT_HOST_IDS2 });
  prepared.entries.push(bindLifecycleFileState(root, INSTALLATION_MANIFEST_PATH, manifestState, {
    root,
    relativePath: INSTALLATION_MANIFEST_PATH,
    content: manifestContent,
    encoding: "utf8",
    force: true,
    label: MANIFEST_OWNER
  }));
  prepared.operations.push({ path: INSTALLATION_MANIFEST_PATH, action: "write", observedDigest: manifestState.digest, observedMode: manifestState.mode, nextDigest: sha2563(manifestContent) });
  const legacyArchiveStat = lstatOrNull3(fsOps, path13.join(root, ".dove-archive"));
  if (legacyArchiveStat !== null) {
    if (legacyArchiveStat.isSymbolicLink() || !legacyArchiveStat.isDirectory()) throw new Error("Dove Upgrade requires .dove-archive to be a real directory.");
    const archiveTarget = ".dove/archive";
    if (lstatOrNull3(fsOps, path13.join(root, archiveTarget)) !== null) throw new Error(`Dove Upgrade archive destination is already occupied: ${archiveTarget}.`);
    const treeDigest = inspectDirectoryTreeDigest(root, ".dove-archive", { fsOps });
    prepared.entries.unshift({ root, relativePath: ".dove-archive", moveTo: archiveTarget, expectedTreeDigest: treeDigest, label: "Dove legacy archive migration" });
    prepared.operations.unshift({ path: ".dove-archive", action: "move", destination: archiveTarget, treeDigest });
  } else {
    prepared.entries.push({ root, relativePath: ".dove-archive", assertOnly: true, expectedState: { exists: false, type: "absent", sha256: null, mode: null }, label: "Dove Upgrade legacy archive assertion" });
  }
  bindLifecycleObservedFiles(root, prepared);
  prepared.operations.sort((left, right) => left.path.localeCompare(right.path) || left.action.localeCompare(right.action));
  const plan = { ...prepared, fsOps, root, hosts, previewType: UPGRADE_PREVIEW_TYPE, previewVersion: UPGRADE_PREVIEW_VERSION, confirmationRequired: false };
  plan.previewDigest = lifecycleBinding(plan);
  return plan;
}
function previewProjectUpgrade(start, options = {}) {
  return lifecyclePreviewShape(prepareUpgrade(start, options));
}
function upgradeProjectIntegration(start, options = {}) {
  const preview = options.preview;
  if (!plainObject4(preview) || preview.previewType !== UPGRADE_PREVIEW_TYPE || preview.previewVersion !== UPGRADE_PREVIEW_VERSION) {
    throw new Error("Dove Upgrade requires the exact project-upgrade preview.");
  }
  const prepared = prepareUpgrade(start, options, preview);
  if (preview.target !== prepared.root || !sameArray(preview.hosts ?? [], prepared.hosts) || preview.confirmation?.previewDigest !== prepared.previewDigest) {
    throw new Error("Dove Upgrade preview is stale or does not match the approved project state.");
  }
  const transaction = writeFileSetTransaction(prepared.entries, { fsOps: prepared.fsOps });
  return { ...resultFromTransaction("upgraded", prepared.root, prepared.hosts, prepared.manifest, transaction), movedPaths: [...transaction.movedPaths] };
}
function prepareCompleteReinstall(start, options = {}, replay = null) {
  const fsOps = options.fsOps ?? fs13;
  assertPackageInput(options.packageName, options.packageVersion, { required: true });
  const root = canonicalLifecycleRoot(start, fsOps);
  const hosts = options.hosts === void 0 ? [CLAUDE_HOST] : normalizeSelectedHosts(options.hosts, { defaultWhenEmpty: false });
  const now2 = replay?.manifest?.createdAt ?? exactTimestamp2(options.now);
  const manifest = lifecycleManifest(root, options, hosts, now2, replay?.manifest);
  const prepared = prepareLifecycleIntegration(root, options, { hosts, manifest, removeOnly: false });
  const manifestState = lifecyclePathState(root, INSTALLATION_MANIFEST_PATH, fsOps);
  const manifestContent = serializeProjectInstallationManifest(manifest, { hostIds: PROJECT_HOST_IDS2 });
  prepared.entries.push(bindLifecycleFileState(root, INSTALLATION_MANIFEST_PATH, manifestState, {
    root,
    relativePath: INSTALLATION_MANIFEST_PATH,
    content: manifestContent,
    encoding: "utf8",
    force: true,
    label: MANIFEST_OWNER
  }));
  prepared.operations.push({
    path: INSTALLATION_MANIFEST_PATH,
    action: "write",
    observedDigest: manifestState.digest,
    observedMode: manifestState.mode,
    nextDigest: sha2563(manifestContent)
  });
  const legacyInstallStat = lstatOrNull3(fsOps, path13.join(root, ".dove-install"));
  if (legacyInstallStat !== null) {
    if (legacyInstallStat.isSymbolicLink() || !legacyInstallStat.isDirectory()) {
      throw new Error("Complete Reinstall requires .dove-install to be a real directory.");
    }
    const treeDigest = inspectDirectoryTreeDigest(root, ".dove-install", { fsOps });
    prepared.entries.unshift({
      root,
      relativePath: ".dove-install",
      delete: true,
      deleteTree: true,
      expectedState: { exists: true, type: "directory", sha256: null, mode: legacyInstallStat.mode & 4095 },
      expectedTreeDigest: treeDigest,
      force: true,
      label: "Complete Reinstall legacy installation deletion"
    });
    prepared.operations.unshift({ path: ".dove-install", action: "remove-tree", treeDigest });
  } else {
    prepared.entries.push({
      root,
      relativePath: ".dove-install",
      assertOnly: true,
      expectedState: { exists: false, type: "absent", sha256: null, mode: null },
      label: "Complete Reinstall legacy installation assertion"
    });
  }
  const doveStat = lstatOrNull3(fsOps, path13.join(root, ".dove"));
  if (doveStat !== null) {
    if (doveStat.isSymbolicLink() || !doveStat.isDirectory()) throw new Error("Complete Reinstall requires .dove to be a real directory.");
    for (const child of fsOps.readdirSync(path13.join(root, ".dove")).map(String).sort()) {
      if (child === "install") continue;
      const relativePath = `.dove/${child}`;
      const stat = fsOps.lstatSync(path13.join(root, relativePath));
      if (stat.isSymbolicLink()) throw new Error(`Complete Reinstall refuses symbolic links in project-private Dove state: ${relativePath}.`);
      if (stat.isFile()) {
        const state2 = lifecyclePathState(root, relativePath, fsOps);
        prepared.entries.unshift(bindLifecycleFileState(root, relativePath, state2, { root, relativePath, delete: true, force: true, label: `Complete Reinstall deletion ${relativePath}` }));
        prepared.operations.unshift({ path: relativePath, action: "remove", observedDigest: state2.digest, observedMode: state2.mode });
      } else if (stat.isDirectory()) {
        const treeDigest = inspectDirectoryTreeDigest(root, relativePath, { fsOps });
        prepared.entries.unshift({ root, relativePath, delete: true, deleteTree: true, expectedState: { exists: true, type: "directory", sha256: null, mode: stat.mode & 4095 }, expectedTreeDigest: treeDigest, force: true, label: `Complete Reinstall tree deletion ${relativePath}` });
        prepared.operations.unshift({ path: relativePath, action: "remove-tree", treeDigest });
      } else {
        throw new Error(`Complete Reinstall found unsupported project-private Dove state: ${relativePath}.`);
      }
    }
  }
  const archiveStat = lstatOrNull3(fsOps, path13.join(root, ".dove-archive"));
  if (archiveStat !== null) {
    if (archiveStat.isSymbolicLink() || !archiveStat.isDirectory()) throw new Error("Complete Reinstall requires .dove-archive to be a real directory.");
    const treeDigest = inspectDirectoryTreeDigest(root, ".dove-archive", { fsOps });
    prepared.entries.unshift({ root, relativePath: ".dove-archive", delete: true, deleteTree: true, expectedState: { exists: true, type: "directory", sha256: null, mode: archiveStat.mode & 4095 }, expectedTreeDigest: treeDigest, force: true, label: "Complete Reinstall legacy archive deletion" });
    prepared.operations.unshift({ path: ".dove-archive", action: "remove-tree", treeDigest });
  }
  bindLifecycleObservedFiles(root, prepared);
  prepared.operations.sort((left, right) => left.path.localeCompare(right.path) || left.action.localeCompare(right.action));
  const plan = { ...prepared, fsOps, root, hosts, previewType: COMPLETE_REINSTALL_PREVIEW_TYPE, previewVersion: COMPLETE_REINSTALL_PREVIEW_VERSION, confirmationRequired: true };
  plan.previewDigest = lifecycleBinding(plan);
  return plan;
}
function previewProjectCompleteReinstall(start, options = {}) {
  return lifecyclePreviewShape(prepareCompleteReinstall(start, options));
}
function completeReinstallProjectIntegration(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true.");
  const preview = options.preview;
  if (!plainObject4(preview) || preview.previewType !== COMPLETE_REINSTALL_PREVIEW_TYPE || preview.previewVersion !== COMPLETE_REINSTALL_PREVIEW_VERSION) {
    throw new Error("Complete Reinstall requires the exact project-complete-reinstall preview.");
  }
  const prepared = prepareCompleteReinstall(start, options, preview);
  if (preview.target !== prepared.root || !sameArray(preview.hosts ?? [], prepared.hosts) || preview.confirmation?.previewDigest !== prepared.previewDigest) {
    throw new Error("Complete Reinstall preview is stale or does not match the approved project state.");
  }
  const transaction = writeFileSetTransaction(prepared.entries, { fsOps: prepared.fsOps });
  return { ...resultFromTransaction("reinstalled", prepared.root, prepared.hosts, prepared.manifest, transaction), movedPaths: [...transaction.movedPaths] };
}
var PROJECT_INTEGRATION_MANAGED_PATHS = Object.freeze(
  claudeResources().map((resource) => resource.path).sort()
);

// src/core/dove-lifecycle.mjs
function upgradeDoveLifecycle(start, options = {}) {
  const preview = previewProjectUpgrade(start, options);
  return upgradeProjectIntegration(start, { ...options, preview });
}
function completeReinstallDoveLifecycle(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Complete Reinstall requires confirmed: true.");
  const preview = previewProjectCompleteReinstall(start, options);
  return completeReinstallProjectIntegration(start, { ...options, preview });
}

// src/core/project-doctor.mjs
import crypto6 from "node:crypto";
import fs14 from "node:fs";
import { spawnSync } from "node:child_process";
import path14 from "node:path";
import process2 from "node:process";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/core/project-setup-classification.mjs
var ACTIONS = Object.freeze({
  init: Object.freeze(["init", "exit"]),
  upgrade: Object.freeze(["upgrade", "reinstall", "exit"]),
  reinstall: Object.freeze(["reinstall", "exit"]),
  blocked: Object.freeze(["exit"])
});
function setup(mode, reason) {
  return Object.freeze({ mode, reason, allowedActions: ACTIONS[mode] });
}
function classifyProjectSetup(result) {
  const integration = result?.projectIntegration ?? {};
  const migration = result?.migrationInstallation ?? { state: "absent", upgrade: { ready: false }, reinstall: { ready: false } };
  const workspace = result?.workspaceState ?? { mode: "unavailable", healthy: false };
  const copiedRuntime = result?.legacyCopiedRuntime?.detected === true;
  const reinstallReady = migration.reinstall?.ready === true;
  if (migration.state === "conflicting-manifests") {
    return reinstallReady ? setup("reinstall", "conflicting-manifests") : setup("blocked", "conflicting-manifests");
  }
  if (migration.state === "valid-legacy") return setup("upgrade", "valid-legacy");
  if (migration.state === "invalid-legacy") {
    return reinstallReady ? setup("reinstall", "invalid-legacy") : setup("blocked", "invalid-legacy");
  }
  if (["invalid", "drifted"].includes(integration.state)) return setup("blocked", integration.state);
  if (copiedRuntime) return setup("blocked", "legacy-copied-runtime");
  if (["current", "needs-sync"].includes(integration.state)) return setup("upgrade", integration.state);
  if (workspace.mode !== "absent") {
    return reinstallReady ? setup("reinstall", "unsupported-workspace") : setup("blocked", "unsupported-workspace");
  }
  return setup("init", "clean-uninitialized");
}

// src/core/mcp-runtime-identity.mjs
var DOVE_MCP_PROTOCOL_VERSIONS = Object.freeze([
  "2025-06-18",
  "2025-11-25"
]);
var DOVE_MCP_PROBE_PROTOCOL_VERSION = DOVE_MCP_PROTOCOL_VERSIONS[0];

// src/core/project-doctor.mjs
var MODULE_DIRECTORY = path14.dirname(fileURLToPath2(import.meta.url));
var DEFAULT_PACKAGE_ROOT = path14.resolve(MODULE_DIRECTORY, "../..");
var SHA2562 = /^[a-f0-9]{64}$/u;
function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}
function plainObject5(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function sha2564(content) {
  return crypto6.createHash("sha256").update(content).digest("hex");
}
function lstatOrNull4(targetPath) {
  try {
    return fs14.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function regularNonSymlink(targetPath) {
  try {
    const stat = fs14.lstatSync(targetPath);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}
function containedPackagePath(packageRoot, relativePath) {
  const absolutePath = path14.resolve(packageRoot, relativePath);
  const relative = path14.relative(packageRoot, absolutePath);
  return relative !== "" && !relative.startsWith("..") && !path14.isAbsolute(relative);
}
function defaultInspectPathExecutable() {
  const result = spawnSync("which", ["dove"], {
    encoding: "utf8",
    shell: false,
    timeout: 5e3,
    maxBuffer: 64 * 1024
  });
  if (result.error?.code === "ENOENT" || result.status !== 0) {
    return { found: false, path: null, usable: false, state: "unavailable" };
  }
  const executablePath = String(result.stdout ?? "").split(/\r?\n/u).map((item) => item.trim()).find(Boolean) ?? null;
  return { found: executablePath !== null, path: executablePath, usable: executablePath !== null, state: executablePath ? "found" : "unavailable" };
}
function normalizeExecutableInspection(value) {
  if (typeof value === "string") return { found: true, path: value, usable: true, state: "found", message: null };
  if (!plainObject5(value)) return { found: false, path: null, usable: false, state: "invalid-result", message: "PATH executable inspection returned an invalid result." };
  const executablePath = typeof value.path === "string" && value.path ? value.path : null;
  const found = value.found === true || executablePath !== null;
  return {
    found,
    path: executablePath,
    usable: value.usable === void 0 ? found : value.usable === true,
    state: typeof value.state === "string" && value.state ? value.state : found ? "found" : "unavailable",
    message: typeof value.message === "string" ? value.message : null
  };
}
function inspectUserCli(options) {
  const packageRoot = path14.resolve(options.packageRoot ?? DEFAULT_PACKAGE_ROOT);
  const runtimePaths = (options.packageRuntimePaths ?? PACKAGE_RUNTIME_PATHS).map((relativePath) => {
    const absolutePath = path14.resolve(packageRoot, relativePath);
    const contained = containedPackagePath(packageRoot, relativePath);
    const healthy2 = contained && regularNonSymlink(absolutePath);
    return { path: relativePath, absolutePath, healthy: healthy2, state: healthy2 ? "current" : contained ? "missing-or-invalid" : "outside-package-root" };
  });
  const executablePath = path14.resolve(options.executablePath ?? path14.join(packageRoot, "bin/dove-package.mjs"));
  const executableRelative = path14.relative(packageRoot, executablePath);
  const executableContained = executableRelative === "" || !executableRelative.startsWith("..") && !path14.isAbsolute(executableRelative);
  const executable = {
    path: executablePath,
    healthy: executableContained && regularNonSymlink(executablePath),
    state: executableContained && regularNonSymlink(executablePath) ? "current" : executableContained ? "missing-or-invalid" : "outside-package-root"
  };
  let pathExecutable;
  try {
    const inspected = options.inspectPathExecutable ? options.inspectPathExecutable({ command: "dove", packageRoot, executablePath }) : options.commandResolver ? options.commandResolver("dove") : defaultInspectPathExecutable();
    pathExecutable = normalizeExecutableInspection(inspected);
  } catch (error) {
    pathExecutable = { found: false, path: null, usable: false, state: "failed", message: messageFor(error) };
  }
  const registry = options.inspectStaticRuntime ? options.inspectStaticRuntime({ packageRoot }) : { healthy: true, state: "loadable" };
  const staticRuntime = plainObject5(registry) ? { healthy: registry.healthy === true, state: registry.state ?? (registry.healthy === true ? "loadable" : "invalid"), message: registry.message ?? null } : { healthy: false, state: "invalid-result", message: "Static runtime inspection returned an invalid result." };
  const healthy = runtimePaths.every((entry) => entry.healthy) && executable.healthy && pathExecutable.usable && staticRuntime.healthy;
  return {
    healthy,
    state: healthy ? "healthy" : "unhealthy",
    package: { name: options.packageName ?? null, version: options.packageVersion ?? null, root: packageRoot },
    runtimePaths,
    executable,
    pathExecutable,
    staticRuntime,
    missing: runtimePaths.filter((entry) => !entry.healthy).map((entry) => entry.path)
  };
}
function decodePointerToken(value) {
  return value.replaceAll("~1", "/").replaceAll("~0", "~");
}
function referencesDovePromptHook(value) {
  return plainObject5(value) && Array.isArray(value.hooks) && value.hooks.some((hook) => plainObject5(hook) && typeof hook.command === "string" && (hook.command.includes("dove hook user-prompt-submit") || hook.command.includes("dove-user-prompt-submit-package.mjs")));
}
function extractJsonPointer(value, selector) {
  if (selector === "") return value;
  if (selector === "/hooks/UserPromptSubmit[dove-user-prompt-submit]") {
    const entries = value?.hooks?.UserPromptSubmit;
    if (!Array.isArray(entries)) throw new Error(`JSON fragment selector does not exist: ${selector}.`);
    const matches = entries.filter(referencesDovePromptHook);
    if (matches.length !== 1) throw new Error(`JSON fragment selector must resolve exactly once: ${selector}.`);
    return matches[0];
  }
  if (selector === DOVE_CLAUDE_MCP_APPROVAL_SELECTOR) {
    const approval = inspectClaudeMcpApprovalSettings(value);
    if (!approval.approved) throw new Error(`JSON fragment selector does not exist: ${selector}.`);
    return DOVE_MCP_SERVER_NAME;
  }
  if (typeof selector !== "string" || !selector.startsWith("/")) throw new Error(`Unsupported JSON fragment selector: ${String(selector)}.`);
  let current = value;
  for (const rawToken of selector.slice(1).split("/")) {
    const token = decodePointerToken(rawToken);
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9]\d*)$/u.test(token) || Number(token) >= current.length) throw new Error(`JSON fragment selector does not exist: ${selector}.`);
      current = current[Number(token)];
    } else if (plainObject5(current) && Object.hasOwn(current, token)) {
      current = current[token];
    } else {
      throw new Error(`JSON fragment selector does not exist: ${selector}.`);
    }
  }
  return current;
}
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (plainObject5(value)) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}
function managedContentDigest(root, entry) {
  const absolutePath = path14.join(root, entry.path);
  const stat = lstatOrNull4(absolutePath);
  if (stat === null) return { state: "missing", digest: null, message: null };
  if (stat.isSymbolicLink() || !stat.isFile()) return { state: "drifted", digest: null, message: `${entry.path} must be a regular non-symbolic-link file.` };
  if (entry.mode === "exclusive-file") return { state: "current", digest: sha2564(fs14.readFileSync(absolutePath)), message: null };
  if (entry.mode === "json-fragment") {
    try {
      const value = parseJsonWithoutDuplicateKeys(fs14.readFileSync(absolutePath, "utf8"), entry.path);
      const fragment = extractJsonPointer(value, entry.selector);
      return { state: "current", digest: sha2564(JSON.stringify(stableValue(fragment))), message: null };
    } catch (error) {
      return { state: "drifted", digest: null, message: messageFor(error) };
    }
  }
  return { state: "drifted", digest: null, message: `Managed mode ${entry.mode} is not inspectable by project doctor.` };
}
function inspectIntegrationManifest(start, options) {
  const project2 = inspectProjectRoot(start, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS2 });
  if (!project2.initialized) {
    return {
      healthy: false,
      state: project2.state,
      start: project2.start,
      root: project2.root,
      error: project2.error,
      manifest: null,
      missing: [],
      drifted: []
    };
  }
  let manifest;
  try {
    manifest = options.readInstallationManifest ? options.readInstallationManifest(project2.root) : readProjectInstallationManifest(project2.root, { fsOps: options.fsOps, hostIds: PROJECT_HOST_IDS2, allowPrevious: true });
  } catch (error) {
    return invalidIntegration(project2, error);
  }
  try {
    const ownership = inspectManifestOwnership(project2, manifest);
    if (!ownership.healthy) return ownership;
    const inspectCurrentIntegration = options.inspectCurrentIntegration ?? inspectProjectIntegration;
    const canonical = inspectCurrentIntegration(project2.root, {
      packageName: options.packageName ?? manifest.package.name,
      packageVersion: options.packageVersion ?? manifest.package.version,
      fsOps: options.fsOps
    });
    if (canonical.status === "needs-sync") {
      return {
        ...ownership,
        healthy: false,
        state: "needs-sync",
        error: null,
        needsSync: true,
        syncPaths: [...canonical.changedPaths]
      };
    }
    return {
      ...ownership,
      state: "current",
      needsSync: false,
      syncPaths: []
    };
  } catch (error) {
    return {
      healthy: false,
      state: "invalid",
      start: project2.start,
      root: project2.root,
      error: messageFor(error),
      manifest: {
        path: INSTALLATION_MANIFEST_PATH,
        schemaVersion: manifest.schemaVersion,
        integrationVersion: manifest.integrationVersion,
        ownershipVersion: manifest.ownershipVersion,
        installationId: manifest.installationId,
        package: manifest.package,
        runtime: manifest.runtime,
        hosts: [...manifest.hosts]
      },
      managed: [],
      missing: [],
      drifted: []
    };
  }
}
function invalidIntegration(project2, error) {
  return {
    healthy: false,
    state: "invalid",
    start: project2.start,
    root: project2.root,
    error: messageFor(error),
    manifest: null,
    missing: [],
    drifted: []
  };
}
function inspectManifestOwnership(project2, manifest, manifestPath = INSTALLATION_MANIFEST_PATH) {
  const managed = manifest.managed.map((entry) => {
    try {
      const inspected = managedContentDigest(project2.root, entry);
      const healthy2 = inspected.state === "current" && SHA2562.test(entry.digest) && inspected.digest === entry.digest;
      return {
        path: entry.path,
        owner: entry.owner,
        mode: entry.mode,
        selector: entry.selector,
        expectedDigest: entry.digest,
        actualDigest: inspected.digest,
        healthy: healthy2,
        state: inspected.state === "missing" ? "missing" : healthy2 ? "current" : "drifted",
        message: inspected.message
      };
    } catch (error) {
      return {
        path: entry.path,
        owner: entry.owner,
        mode: entry.mode,
        selector: entry.selector,
        expectedDigest: entry.digest,
        actualDigest: null,
        healthy: false,
        state: "drifted",
        message: messageFor(error)
      };
    }
  });
  const missing = managed.filter((entry) => entry.state === "missing").map((entry) => entry.path);
  const drifted = managed.filter((entry) => entry.state === "drifted").map((entry) => entry.path);
  const healthy = missing.length === 0 && drifted.length === 0;
  return {
    healthy,
    state: healthy ? "healthy" : "drifted",
    start: project2.start,
    root: project2.root,
    error: null,
    manifest: {
      path: manifestPath,
      schemaVersion: manifest.schemaVersion,
      integrationVersion: manifest.integrationVersion,
      ownershipVersion: manifest.ownershipVersion,
      installationId: manifest.installationId,
      package: manifest.package,
      runtime: manifest.runtime,
      hosts: [...manifest.hosts]
    },
    managed,
    missing,
    drifted
  };
}
function previewState(callback) {
  try {
    const preview = callback();
    return { ready: preview.status === "ready", error: null, preview };
  } catch (error) {
    return { ready: false, error: messageFor(error), preview: null };
  }
}
function inspectMigrationInstallation(root, options = {}) {
  const currentPath = path14.join(root, INSTALLATION_MANIFEST_PATH);
  const legacyPath = path14.join(root, LEGACY_INSTALLATION_MANIFEST_PATH);
  const current = lstatOrNull4(currentPath);
  const legacy = lstatOrNull4(legacyPath);
  const legacyDirectory = lstatOrNull4(path14.join(root, ".dove-install"));
  const currentDirectory = lstatOrNull4(path14.join(root, ".dove/install"));
  const legacyResearch = lstatOrNull4(path14.join(root, ".dove/manifest.json"));
  const requiresReinstallPreview = legacy !== null || legacyDirectory !== null || legacyResearch !== null;
  const reinstall = requiresReinstallPreview ? previewState(() => previewProjectCompleteReinstall(root, { ...options, fsOps: options.fsOps ?? fs14 })) : { ready: false, error: null, preview: null };
  const result = (state2, fields = {}) => ({
    state: state2,
    root,
    markerPath: legacy === null ? null : LEGACY_INSTALLATION_MANIFEST_PATH,
    upgrade: { ready: false, error: null, preview: null },
    reinstall,
    ...fields
  });
  if (current !== null && legacy !== null) {
    return result("conflicting-manifests", {
      error: "Dove found both current and legacy project installation manifests."
    });
  }
  if (legacy === null) {
    if (legacyDirectory !== null || current === null && currentDirectory !== null) {
      return result("invalid-legacy", {
        error: "Dove found an incomplete current or legacy installation directory without its manifest."
      });
    }
    return result("absent", { error: null });
  }
  if (legacy.isSymbolicLink() || !legacy.isFile()) {
    return result("invalid-legacy", {
      error: `Dove legacy project installation manifest must be a regular non-symbolic-link file: ${legacyPath}.`
    });
  }
  try {
    const manifest = readLegacyProjectInstallationManifest(root, {
      fsOps: options.fsOps,
      hostIds: PROJECT_HOST_IDS2,
      allowPrevious: true
    });
    const ownership = inspectManifestOwnership({ start: root, root }, manifest, LEGACY_INSTALLATION_MANIFEST_PATH);
    if (!ownership.healthy) {
      return result("invalid-legacy", {
        error: "Dove legacy project installation ownership has missing or drifted resources.",
        manifest: ownership.manifest,
        managed: ownership.managed,
        missing: ownership.missing,
        drifted: ownership.drifted
      });
    }
    const upgrade = previewState(() => previewProjectUpgrade(root, { ...options, fsOps: options.fsOps ?? fs14 }));
    if (!upgrade.ready) {
      return result("invalid-legacy", {
        error: upgrade.error,
        manifest: ownership.manifest,
        managed: ownership.managed,
        missing: [],
        drifted: []
      });
    }
    return result("valid-legacy", {
      error: null,
      manifest: ownership.manifest,
      managed: ownership.managed,
      missing: [],
      drifted: [],
      upgrade
    });
  } catch (error) {
    return result("invalid-legacy", { error: messageFor(error) });
  }
}
function workspaceResult(fields) {
  return { format: null, error: null, zeroWrite: true, ...fields };
}
function inspectWorkspace(root, options = {}) {
  if (!root) return workspaceResult({ healthy: false, state: "unavailable", mode: "unavailable", category: "invalid", error: "Project root is unavailable." });
  const fsOps = options.fsOps ?? fs14;
  const statOrNull = (targetPath) => {
    try {
      return fsOps.lstatSync(targetPath);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  };
  const doveRoot = path14.join(root, ARTIFACT_PATHS.doveRoot);
  const formatPath = path14.join(root, ARTIFACT_PATHS.format);
  try {
    const rootStat = statOrNull(doveRoot);
    if (rootStat === null) return workspaceResult({ healthy: true, state: "absent", mode: "absent", category: "absent" });
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      return workspaceResult({ healthy: false, state: "invalid-root", mode: "invalid", category: "invalid", error: `${ARTIFACT_PATHS.doveRoot} must be a real directory.` });
    }
    const formatStat = statOrNull(formatPath);
    if (formatStat === null) {
      const legacyManifest = statOrNull(path14.join(root, ".dove/manifest.json"));
      if (legacyManifest !== null) return workspaceResult({ healthy: false, state: "unsupported-legacy-format", mode: "unsupported", category: "legacy", error: "unsupported-legacy-format" });
      const doveChildren = fsOps.readdirSync(doveRoot).map(String).sort();
      const allowedDoveChildren = /* @__PURE__ */ new Set(["archive", "install"]);
      if (doveChildren.length > 0 && doveChildren.every((child) => allowedDoveChildren.has(child))) {
        const installDirectory = doveChildren.includes("install") ? statOrNull(path14.join(root, ARTIFACT_PATHS.installDir)) : null;
        const archiveStat = doveChildren.includes("archive") ? statOrNull(path14.join(root, ".dove/archive")) : null;
        let installHealthy = installDirectory === null;
        if (installDirectory !== null && installDirectory.isDirectory() && !installDirectory.isSymbolicLink()) {
          const installChildren = fsOps.readdirSync(path14.join(root, ARTIFACT_PATHS.installDir)).map(String).sort();
          const allowedInstallChildren = /* @__PURE__ */ new Set(["manifest.json", "transactions"]);
          const installManifest = installChildren.includes("manifest.json") ? statOrNull(path14.join(root, INSTALLATION_MANIFEST_PATH)) : null;
          const transactionsStat = installChildren.includes("transactions") ? statOrNull(path14.join(root, ARTIFACT_PATHS.transactionsDir)) : null;
          installHealthy = installChildren.every((child) => allowedInstallChildren.has(child)) && (installManifest === null || installManifest.isFile() && !installManifest.isSymbolicLink()) && (transactionsStat === null || transactionsStat.isDirectory() && !transactionsStat.isSymbolicLink());
        }
        if (installHealthy && (archiveStat === null || archiveStat.isDirectory() && !archiveStat.isSymbolicLink())) {
          return workspaceResult({ healthy: true, state: "absent", mode: "absent", category: "absent" });
        }
      }
      return workspaceResult({ healthy: false, state: "unknown-format", mode: "invalid", category: "unknown", error: "unknown-format" });
    }
    if (formatStat.isSymbolicLink() || !formatStat.isFile()) {
      return workspaceResult({ healthy: false, state: "invalid-format", mode: "invalid", category: "invalid", error: `${ARTIFACT_PATHS.format} must be a regular file.` });
    }
    const marker = parseJsonWithoutDuplicateKeys(fsOps.readFileSync(formatPath, "utf8"), ARTIFACT_PATHS.format);
    if (!plainObject5(marker) || Object.keys(marker).length !== 1 || typeof marker.format !== "string" || marker.format.length === 0) {
      return workspaceResult({ healthy: false, state: "invalid-format", mode: "invalid", category: "invalid", error: `${ARTIFACT_PATHS.format} must contain only a non-empty format discriminator.` });
    }
    if (marker.format !== DOVE_RESEARCH_FORMAT) {
      return workspaceResult({ healthy: false, state: "unsupported-format", mode: "unsupported", category: "unknown", format: marker.format, error: "unsupported-format" });
    }
    const layoutProblems = [];
    for (const relativePath of RESEARCH_DIRECTORIES) {
      const stat = statOrNull(path14.join(root, relativePath));
      if (stat === null) layoutProblems.push(`${relativePath} is missing`);
      else if (stat.isSymbolicLink() || !stat.isDirectory()) layoutProblems.push(`${relativePath} must be a real directory`);
    }
    for (const relativePath of RESEARCH_REQUIRED_FILES.filter((item) => item !== ARTIFACT_PATHS.format)) {
      const stat = statOrNull(path14.join(root, relativePath));
      if (stat === null) layoutProblems.push(`${relativePath} is missing`);
      else if (stat.isSymbolicLink() || !stat.isFile()) layoutProblems.push(`${relativePath} must be a regular file`);
    }
    if (layoutProblems.length > 0) {
      return workspaceResult({ healthy: false, state: "incomplete-current-format", mode: "invalid", category: "invalid", format: marker.format, error: layoutProblems.join("; ") });
    }
    return workspaceResult({ healthy: true, state: "readable-current-format", mode: "current", category: "current", format: marker.format });
  } catch (error) {
    return workspaceResult({ healthy: false, state: "invalid-format", mode: "invalid", category: "invalid", error: messageFor(error) });
  }
}
function sameMcpServer(value) {
  return plainObject5(value) && Object.keys(value).sort().join(",") === "args,command,type" && value.type === INSTALLED_DOVE_MCP_SERVER.type && value.command === INSTALLED_DOVE_MCP_SERVER.command && Array.isArray(value.args) && value.args.length === INSTALLED_DOVE_MCP_SERVER.args.length && value.args.every((item, index) => item === INSTALLED_DOVE_MCP_SERVER.args[index]);
}
function inspectClaudeRegistration(root, integration) {
  if (!root || !integration.manifest?.hosts?.includes("claude")) {
    return { healthy: false, state: root ? "not-registered" : "unavailable", host: "claude", mcp: { healthy: false, state: "missing" }, approval: { healthy: false, state: "missing" }, ambient: { healthy: false, state: "missing", missing: [], drifted: [] }, missing: [], drifted: [] };
  }
  const missing = [];
  const drifted = [];
  let mcp2 = { healthy: false, state: "missing", message: null };
  try {
    const mcpPath = path14.join(root, DOVE_MCP_CONFIG_PATH);
    const stat = lstatOrNull4(mcpPath);
    if (stat === null) missing.push(DOVE_MCP_CONFIG_PATH);
    else if (stat.isSymbolicLink() || !stat.isFile()) drifted.push(DOVE_MCP_CONFIG_PATH);
    else {
      const value = parseJsonWithoutDuplicateKeys(fs14.readFileSync(mcpPath, "utf8"), DOVE_MCP_CONFIG_PATH);
      mcp2 = sameMcpServer(value?.mcpServers?.[DOVE_MCP_SERVER_NAME]) ? { healthy: true, state: "registered", message: null } : { healthy: false, state: "drifted", message: `${DOVE_MCP_CONFIG_PATH} does not contain the current Dove user-CLI registration.` };
      if (!mcp2.healthy) drifted.push(DOVE_MCP_CONFIG_PATH);
    }
  } catch (error) {
    mcp2 = { healthy: false, state: "invalid", message: messageFor(error) };
    drifted.push(DOVE_MCP_CONFIG_PATH);
  }
  let approval = { healthy: false, state: "missing", message: null };
  try {
    const approvalPath = path14.join(root, DOVE_CLAUDE_LOCAL_SETTINGS_PATH);
    const stat = lstatOrNull4(approvalPath);
    if (stat === null) missing.push(DOVE_CLAUDE_LOCAL_SETTINGS_PATH);
    else if (stat.isSymbolicLink() || !stat.isFile()) drifted.push(DOVE_CLAUDE_LOCAL_SETTINGS_PATH);
    else {
      const settings = parseJsonWithoutDuplicateKeys(fs14.readFileSync(approvalPath, "utf8"), DOVE_CLAUDE_LOCAL_SETTINGS_PATH);
      const inspected = inspectClaudeMcpApprovalSettings(settings);
      approval = inspected.disabled ? { healthy: false, state: "disabled", message: "Dove MCP is explicitly disabled in Claude project-local settings." } : inspected.approved ? { healthy: true, state: "approved", message: null } : { healthy: false, state: "missing", message: "Dove MCP is not approved in Claude project-local settings." };
      if (!approval.healthy) drifted.push(DOVE_CLAUDE_LOCAL_SETTINGS_PATH);
    }
  } catch (error) {
    approval = { healthy: false, state: "invalid", message: messageFor(error) };
    drifted.push(DOVE_CLAUDE_LOCAL_SETTINGS_PATH);
  }
  for (const relativePath of [DOVE_CLAUDE_AMBIENT_RULE_PATH, DOVE_CLAUDE_AMBIENT_SKILL_PATH]) {
    if (!regularNonSymlink(path14.join(root, relativePath))) missing.push(relativePath);
  }
  let ambientMessage = null;
  try {
    const settingsPath = path14.join(root, DOVE_CLAUDE_SETTINGS_PATH);
    const stat = lstatOrNull4(settingsPath);
    if (stat === null) missing.push(DOVE_CLAUDE_SETTINGS_PATH);
    else if (stat.isSymbolicLink() || !stat.isFile()) drifted.push(DOVE_CLAUDE_SETTINGS_PATH);
    else {
      const settings = parseJsonWithoutDuplicateKeys(fs14.readFileSync(settingsPath, "utf8"), DOVE_CLAUDE_SETTINGS_PATH);
      const merged = mergeClaudeAmbientSettings(settings);
      if (merged.changed) {
        drifted.push(DOVE_CLAUDE_SETTINGS_PATH);
        ambientMessage = `${DOVE_CLAUDE_SETTINGS_PATH} does not contain ${DOVE_CLAUDE_AMBIENT_HOOK_COMMAND}.`;
      }
    }
  } catch (error) {
    drifted.push(DOVE_CLAUDE_SETTINGS_PATH);
    ambientMessage = messageFor(error);
  }
  const uniqueMissing = [...new Set(missing)];
  const uniqueDrifted = [...new Set(drifted)];
  const ambientHealthy = uniqueMissing.filter((item) => item !== DOVE_MCP_CONFIG_PATH).length === 0 && uniqueDrifted.filter((item) => item !== DOVE_MCP_CONFIG_PATH).length === 0;
  const healthy = mcp2.healthy && approval.healthy && ambientHealthy;
  return {
    healthy,
    state: healthy ? "registered" : "unhealthy",
    host: "claude",
    mcp: mcp2,
    approval,
    ambient: { healthy: ambientHealthy, state: ambientHealthy ? "configured" : uniqueMissing.length > 0 ? "missing" : "drifted", missing: uniqueMissing.filter((item) => ![DOVE_MCP_CONFIG_PATH, DOVE_CLAUDE_LOCAL_SETTINGS_PATH].includes(item)), drifted: uniqueDrifted.filter((item) => ![DOVE_MCP_CONFIG_PATH, DOVE_CLAUDE_LOCAL_SETTINGS_PATH].includes(item)), message: ambientMessage },
    missing: uniqueMissing,
    drifted: uniqueDrifted
  };
}
function stripAnsi(value) {
  return String(value ?? "").replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, "");
}
function parseClaudeMcpStatus(output) {
  const statusLines = stripAnsi(output).replaceAll("\r\n", "\n").split("\n").filter((line) => /^\s*Status\s*:/iu.test(line));
  if (statusLines.length !== 1) return "unknown";
  const value = statusLines[0].replace(/^\s*Status\s*:\s*/iu, "").trim();
  if (/Pending approval/iu.test(value)) return "pending-approval";
  if (/Failed to connect/iu.test(value)) return "failed";
  if (/Connected/iu.test(value)) return "connected";
  return "unknown";
}
function inspectClaudeMcpConnection(root, options = {}) {
  const result = (options.spawnSync ?? spawnSync)(options.claudeCommand ?? "claude", ["mcp", "get", DOVE_MCP_SERVER_NAME], {
    cwd: root,
    env: { ...process2.env, ...options.env, CLAUDE_PROJECT_DIR: root },
    encoding: "utf8",
    shell: false,
    timeout: options.timeout ?? 15e3,
    maxBuffer: 1024 * 1024
  });
  if (result.error?.code === "ENOENT") return { state: "unavailable", ready: false, message: "Claude Code is unavailable." };
  if (result.error?.code === "ETIMEDOUT") return { state: "timeout", ready: false, message: "Claude Code MCP status timed out." };
  const state2 = parseClaudeMcpStatus(`${result.stdout ?? ""}
${result.stderr ?? ""}`);
  return { state: state2, ready: state2 === "connected", message: state2 === "connected" ? null : `Claude Code MCP state is ${state2}.` };
}
function normalizeReadiness(value) {
  if (!plainObject5(value)) return { healthy: false, ready: false, state: "invalid-result", message: "Claude connection inspection returned an invalid result." };
  const state2 = typeof value.state === "string" && value.state ? value.state : "unknown";
  const ready = state2 === "connected";
  return { healthy: ready, ready, state: state2, message: typeof value.message === "string" ? value.message : null };
}
function defaultInspectMcpProbe({ packageRoot, projectRoot, packageVersion }) {
  const sourceProbePath = path14.join(packageRoot, "scripts/doctor-mcp-probe.mjs");
  const packagedProbePath = path14.join(packageRoot, "scripts/doctor-mcp-probe-package.mjs");
  const probePath = regularNonSymlink(sourceProbePath) ? sourceProbePath : packagedProbePath;
  if (!regularNonSymlink(probePath)) return { state: "not-run", healthy: true, message: "The MCP self-probe is not present in this package root." };
  const result = spawnSync(process2.execPath, [probePath, packageRoot, "--identity"], {
    cwd: packageRoot,
    env: { ...process2.env, CLAUDE_PROJECT_DIR: projectRoot },
    encoding: "utf8",
    shell: false,
    timeout: 3e4,
    maxBuffer: 1024 * 1024
  });
  if (result.error?.code === "ENOENT") return { state: "unavailable", healthy: false, message: "The Dove MCP probe is unavailable." };
  if (result.error?.code === "ETIMEDOUT") return { state: "timeout", healthy: false, message: "The Dove MCP probe timed out." };
  if (result.status !== 0) return { state: "failed", healthy: false, message: String(result.stderr || result.stdout || "The Dove MCP probe failed.").trim() };
  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch (error) {
    return { state: "invalid", healthy: false, message: `The Dove MCP probe returned invalid JSON: ${messageFor(error)}` };
  }
  const serverName = payload.serverName ?? null;
  const serverVersion = payload.serverVersion ?? null;
  const protocolVersion = payload.protocolVersion ?? null;
  const expectedVersion = packageVersion ?? null;
  const healthy = payload.ok === true && serverName === DOVE_MCP_SERVER_NAME && payload.packageVersion === expectedVersion && serverVersion === expectedVersion && expectedVersion !== null && protocolVersion === DOVE_MCP_PROBE_PROTOCOL_VERSION;
  return {
    healthy,
    state: healthy ? "current" : serverName !== DOVE_MCP_SERVER_NAME ? "server-name-mismatch" : serverVersion !== expectedVersion ? "server-version-mismatch" : protocolVersion !== DOVE_MCP_PROBE_PROTOCOL_VERSION ? "protocol-incompatible" : "invalid",
    serverName,
    serverVersion,
    expectedVersion,
    protocolVersion,
    expectedProtocolVersion: DOVE_MCP_PROBE_PROTOCOL_VERSION,
    scope: "launched-package-runtime",
    runningHostInspected: false,
    message: healthy ? null : "The launched package MCP self-probe did not match the current Dove server identity, package version, or protocol."
  };
}
function normalizeMcpProbe(value) {
  if (!plainObject5(value)) return { healthy: false, state: "invalid-result", message: "MCP self-probe returned an invalid result." };
  return {
    healthy: value.healthy === true,
    state: typeof value.state === "string" && value.state ? value.state : "unknown",
    serverName: typeof value.serverName === "string" ? value.serverName : null,
    serverVersion: typeof value.serverVersion === "string" ? value.serverVersion : null,
    expectedVersion: typeof value.expectedVersion === "string" ? value.expectedVersion : null,
    protocolVersion: typeof value.protocolVersion === "string" ? value.protocolVersion : null,
    expectedProtocolVersion: typeof value.expectedProtocolVersion === "string" ? value.expectedProtocolVersion : DOVE_MCP_PROBE_PROTOCOL_VERSION,
    scope: typeof value.scope === "string" ? value.scope : "launched-package-runtime",
    runningHostInspected: false,
    message: typeof value.message === "string" ? value.message : null
  };
}
function inspectMcpProbe(packageRoot, projectRoot, options) {
  if (options.runMcpProbe !== true && options.packageRoot === void 0 && typeof options.inspectMcpProbe !== "function") {
    return { healthy: true, state: "not-run", serverName: null, serverVersion: null, expectedVersion: options.packageVersion ?? null, protocolVersion: null, expectedProtocolVersion: DOVE_MCP_PROBE_PROTOCOL_VERSION, scope: "launched-package-runtime", runningHostInspected: false, message: "The package MCP self-probe was not requested." };
  }
  try {
    const inspected = options.inspectMcpProbe ? options.inspectMcpProbe({ packageRoot, projectRoot, packageVersion: options.packageVersion }) : defaultInspectMcpProbe({ packageRoot, projectRoot, packageVersion: options.packageVersion });
    return normalizeMcpProbe(inspected);
  } catch (error) {
    return { healthy: false, state: "failed", serverName: null, serverVersion: null, expectedVersion: options.packageVersion ?? null, protocolVersion: null, expectedProtocolVersion: DOVE_MCP_PROBE_PROTOCOL_VERSION, scope: "launched-package-runtime", runningHostInspected: false, message: messageFor(error) };
  }
}
function inspectRunningMcpSelfComparison(options) {
  if (typeof options.inspectRunningMcpSelfComparison !== "function") {
    return {
      healthy: true,
      state: "inaccessible",
      inspected: false,
      serverInfo: null,
      protocolVersion: null,
      message: "A standalone CLI cannot inspect the already-running host MCP process. Query full Dove status inside the host for MCP self-comparison."
    };
  }
  try {
    const value = options.inspectRunningMcpSelfComparison();
    if (!plainObject5(value)) throw new Error("Running MCP self-comparison returned an invalid result.");
    return {
      healthy: value.state === "current",
      state: typeof value.state === "string" ? value.state : "unknown",
      inspected: true,
      serverInfo: plainObject5(value.serverInfo) ? { name: value.serverInfo.name ?? null, version: value.serverInfo.version ?? null } : null,
      protocolVersion: typeof value.protocolVersion === "string" ? value.protocolVersion : null,
      message: typeof value.message === "string" ? value.message : null
    };
  } catch (error) {
    return { healthy: false, state: "failed", inspected: true, serverInfo: null, protocolVersion: null, message: messageFor(error) };
  }
}
function inspectReadiness(root, registration, options, integration = null) {
  if (integration?.state === "needs-sync") return { healthy: false, ready: false, state: "blocked", message: "Claude readiness is blocked until the project integration is synchronized with the current Dove package." };
  if (!registration.healthy) return { healthy: false, ready: false, state: "blocked", message: "Claude readiness is blocked until project registration is current." };
  try {
    const inspector = options.inspectClaudeConnection ?? ((target) => inspectClaudeMcpConnection(target, options));
    return normalizeReadiness(inspector(root));
  } catch (error) {
    return { healthy: false, ready: false, state: "failed", message: messageFor(error) };
  }
}
function inspectLegacy(root) {
  if (!root) return { state: "unavailable", detected: false, healthy: true, root: null, markerHits: [], registrationHits: [], bundleHits: [], evidence: [] };
  try {
    const result = inspectLegacyProjectInstallation(root);
    return { ...result, healthy: !result.detected };
  } catch (error) {
    return { state: "invalid", detected: false, healthy: false, root, markerHits: [], registrationHits: [], bundleHits: [], evidence: [], error: messageFor(error) };
  }
}
function inspectProjectDoctor(start, options = {}) {
  const userCli = inspectUserCli(options);
  const projectIntegration = inspectIntegrationManifest(start, options);
  const safeRoot = projectIntegration.root ?? projectIntegration.start;
  const workspaceState = inspectWorkspace(safeRoot, options);
  const migrationInstallation = safeRoot ? inspectMigrationInstallation(safeRoot, options) : { state: "absent", root: null, markerPath: null, upgrade: { ready: false, error: null, preview: null }, reinstall: { ready: false, error: null, preview: null }, error: "Project root is unavailable." };
  const mcpProbe = inspectMcpProbe(userCli.package.root, safeRoot, options);
  const runningMcpSelfComparison = inspectRunningMcpSelfComparison(options);
  const hostRegistration = inspectClaudeRegistration(projectIntegration.root, projectIntegration);
  const readiness = inspectReadiness(projectIntegration.root, hostRegistration, options, projectIntegration);
  const legacyCopiedRuntime = inspectLegacy(safeRoot);
  const setup2 = classifyProjectSetup({ projectIntegration, migrationInstallation, workspaceState, legacyCopiedRuntime });
  const healthy = userCli.healthy && projectIntegration.healthy && workspaceState.healthy && mcpProbe.healthy && runningMcpSelfComparison.healthy && hostRegistration.healthy && readiness.healthy && legacyCopiedRuntime.healthy;
  const diagnosticProbe = projectIntegration.state === "needs-sync" ? { ...mcpProbe, healthy: false, state: "integration-mismatch", message: "Project integration must be synchronized with the current Dove package." } : mcpProbe;
  return {
    healthy,
    state: healthy ? "healthy" : "unhealthy",
    target: safeRoot ?? (typeof start === "string" ? path14.resolve(start) : null),
    userCli,
    projectIntegration,
    migrationInstallation,
    setup: setup2,
    mcpProbe: diagnosticProbe,
    runningMcpSelfComparison,
    workspaceState,
    hostRegistration,
    readiness,
    legacyCopiedRuntime,
    zeroWrite: true,
    writes: []
  };
}
export {
  ARTIFACT_PATHS,
  CLAIM_ASSESSMENTS,
  COMMAND_SURFACES,
  COMMAND_SURFACE_BY_ID,
  DEFAULT_DOVE_LESSONS_MARKDOWN,
  DOVE_PRIMARY_ROLES,
  DOVE_RESEARCH_FORMAT,
  EXPERIMENT_RESULT_KINDS,
  HOST_ADAPTERS,
  HOST_ADAPTER_POLICY,
  LEGACY_DOVE_SCHEMA_VERSION,
  PACKAGE_VERSION,
  PROJECT_HOST_IDS,
  RESEARCH_CONTEXT_VIEWS,
  RESEARCH_DIRECTORIES,
  RESEARCH_REQUIRED_FILES,
  REVIEW_STATUSES,
  allGeneratedCommandAdapterPaths,
  ambientContextForPrompt,
  buildResearchContext,
  buildResearchViews,
  classifyLessonsIntent,
  commandAdapterPathsForHost,
  completeReinstallDoveLifecycle,
  completeReinstallProjectIntegration,
  concludeMission,
  createExperimentPlan,
  createMission,
  generatedRoleDefinitionEntries,
  initializeProjectIntegration,
  initializeResearchWorkspace,
  inspectDoveWorkspace,
  inspectProjectDoctor,
  inspectProjectIntegration,
  isHighConfidenceAmbientWorkPrompt,
  lessonsContextForPrompt,
  missionReadableIds,
  openDoveWorkspace,
  previewProjectCompleteReinstall,
  previewProjectUpgrade,
  queryResearchContext,
  readLessons,
  readMission,
  readMissionTree,
  readResearchJson,
  readResearchText,
  recordClaim,
  recordExperimentResult,
  recordReview,
  recordSource,
  renderClaudeAmbientRule,
  renderClaudeAmbientSkill,
  renderClaudeLessonsIntakeSkill,
  renderClaudeReviewerAgent,
  renderOpenCodeReviewerAgent,
  renderOpenCodeRoleSkill,
  replaceLessons,
  reviewerPrompt,
  syncProjectIntegration,
  updateResearchMainline,
  upgradeDoveLifecycle,
  upgradeProjectIntegration,
  userPromptSubmitOutput,
  validateLessonsMarkdown,
  validateMission,
  validateMissionTree,
  validateResearchFormat,
  validateWorkspaceRecord,
  verifyReview,
  workspaceFormatError,
  writeResearchFileAtomic,
  writeResearchJsonAtomic
};
