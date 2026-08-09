export const PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
export const PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs", "mcp/dove-state-server-package.mjs", "scripts/doctor-mcp-probe-package.mjs", "scripts/dove-user-prompt-submit-package.mjs"];
export const DEFAULT_HOST_ADAPTERS = ["opencode"];
export const PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents", "claude"];
export const HOST_IDS = [...PROJECT_HOST_IDS];
export const DOVE_MCP_CONFIG_PATH = ".mcp.json";
export const DOVE_MCP_SERVER_NAME = "dove";
export const DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([".claude/rules/dove.md", ".claude/skills/dove-intake/SKILL.md", ".claude/skills/dove-lessons-intake/SKILL.md", ".claude/settings.json"]);
export const INSTALLED_DOVE_MCP_SERVER = Object.freeze({ type: "stdio", command: "dove", args: Object.freeze(["mcp", "serve", "--project", "."]) });
export const HOST_DEFINITIONS = {
  opencode: { label: "OpenCode", scope: "project", jsonChecks: [".opencode.json"] },
  codex: { label: "Codex", scope: "project", jsonChecks: [] },
  cursor: { label: "Cursor", scope: "project", jsonChecks: [] },
  agents: { label: "Shared agent skills", scope: "project", jsonChecks: [] },
  claude: { label: "Claude Code", scope: "project", jsonChecks: [] }
};
export const OPENCODE_ROLE_SKILL_PATHS = [".opencode/skills/dove-planner/SKILL.md", ".opencode/skills/dove-builder/SKILL.md", ".opencode/skills/dove-reviewer/SKILL.md"];

export const PUBLIC_RESPONSE_CAPSULE = Object.freeze([
  "Unless the user requests another language or format, respond in natural, clear Chinese.",
  "Use internal terms, paths, and machine identifiers only when they materially improve precision, and explain them plainly.",
  "Adapt the response structure to the task instead of forcing a fixed report template; explicit user instructions and local machine-readable contracts take priority.",
  "Access durable Dove state only through public MCP tools. Use normal host tools to read, create, edit, and validate ordinary project materials and artifacts outside `.dove`."
]);

export const HOST_ADAPTER_POLICY = Object.freeze({
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

const SURFACES = [
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

const mcp = (tool, instruction, options = {}) => ({
  type: "mcp",
  tool,
  required: options.required ?? [],
  readOnly: options.readOnly === true,
  persistWhen: options.persistWhen ?? "never",
  instruction
});
const host = (instruction, options = {}) => ({
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
      host("When the Workspace is absent, there are no Missions, or no relevant Mission exists, inspect only ordinary project material outside `.dove`—such as README, docs, source, tests, configuration, results, and existing artifacts—to form a provisional research frame.", { capability: "project-exploration", readOnly: true }),
      host("Continue the bounded research or project investigation with normal host tools, preserving uncertainty and recording actual evidence. Do not initialize a Workspace or create a Mission automatically.", { capability: "research-work" }),
      mcp("manage_dove_workspace", "Initialize or update the research direction only when the user explicitly requests durable Workspace maintenance and provides the required research frame.", { persistWhen: "explicit-workspace-maintenance" }),
      mcp("manage_dove_missions", "Create, branch, or conclude a Mission only when the user explicitly needs a durable research node; otherwise leave Dove state unchanged.", { persistWhen: "explicit-durable-mission" })
    ], clarification }],
    examples: ["research"], channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "status") return {
    status: "read-only",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests current Dove research status.", steps: [
      mcp("query_dove_research", "Read the smallest relevant projection and report it without changing Dove state or ordinary project files.", { readOnly: true })
    ], clarification: [] }],
    examples: ["status"], channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "source") return {
    status: "route-or-domain-work", selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" }, generatedFields: [],
    modes: [{ id: "default", when: "The user requests source discovery, reading, comparison, or verification.", steps: [
      mcp("query_dove_research", "Read related-work or claim context only when durable context is relevant.", { readOnly: true }),
      host("Discover, retrieve, read, and verify the real material with host-native project or external research tools. Distinguish what was inspected from what was actually used.", { capability: "source-research", readOnly: true }),
      mcp("manage_dove_sources", "Record only a Source that was actually used and needs a durable citation or evidence relationship; preserve conditions, conflicts, and limitations.", { persistWhen: "actual-source-used" })
    ], clarification }], examples: ["source"], channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "experiment") return {
    status: "route-or-domain-work", selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" }, generatedFields: [],
    modes: [{ id: "default", when: "The user requests experiment design, execution, analysis, or recording.", steps: [
      mcp("query_dove_research", "Read hypotheses, experiment options, or result context when available.", { readOnly: true }),
      host("Design the smallest discriminating experiment and execute it with normal host tools. Preserve raw outputs, failures, denominator accounting, deviations, bias, and uncertainty.", { capability: "experiment-execution" }),
      mcp("manage_dove_experiments", "Freeze a plan before execution and record the full result only when a durable experiment record is needed.", { persistWhen: "durable-experiment-record" }),
      mcp("manage_dove_claims", "Record or revise only claims supported by the observed evidence, including counter-evidence, missing evidence, and cannot-say boundaries.", { persistWhen: "durable-claim-update" })
    ], clarification }], examples: ["experiment"], channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "draft") return {
    status: "route-or-domain-work", selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" }, generatedFields: [],
    modes: [{ id: "default", when: "The user requests drafting or revision of an ordinary project artifact.", steps: [
      mcp("query_dove_research", "Read claim-story or other relevant evidence context when durable research exists.", { readOnly: true }),
      host("Read the target and surrounding ordinary project materials, then create or revise the requested draft artifact with normal host editing tools. Keep every claim within the available evidence.", { capability: "artifact-editing" }),
      host("Run the appropriate host-native checks for the artifact and report remaining unsupported claims, citation gaps, and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      mcp("manage_dove_claims", "Persist a Claim change only when the draft work materially changes a durable claim relationship.", { persistWhen: "material-claim-change" })
    ], clarification }], examples: ["draft"], channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "figure") return {
    status: "route-or-domain-work", selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" }, generatedFields: [],
    modes: [{ id: "default", when: "The user requests a figure, diagram, plot, or caption.", steps: [
      mcp("query_dove_research", "Read the relevant evidence, source, or result synthesis when durable context exists.", { readOnly: true }),
      host("Gather actual project materials and data, then create or revise the ordinary figure artifact and its caption with host-native plotting, image, or editing tools.", { capability: "figure-creation" }),
      host("Validate labels, denominators, provenance, legibility, and agreement between the figure, caption, and underlying evidence.", { capability: "figure-validation", readOnly: true }),
      mcp("manage_dove_sources", "Record a newly used Source only when a durable reference is needed.", { persistWhen: "actual-source-used" }),
      mcp("manage_dove_experiments", "Record an experiment result only when the figure is based on a result that needs durable preservation.", { persistWhen: "durable-result-needed" })
    ], clarification }], examples: ["figure"], channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
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
    examples: ["review"], channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "rebuttal") return {
    status: "route-or-domain-work", selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" }, generatedFields: [],
    modes: [{ id: "default", when: "The user requests author-side rebuttal or revision from review findings.", steps: [
      mcp("query_dove_research", "Read review and claim context relevant to the requested response.", { readOnly: true }),
      mcp("manage_dove_reviews", "Read coverage or review records needed for the response; do not present author work as independent review.", { readOnly: true }),
      host("Analyze each finding against the actual artifact and evidence, then write the rebuttal and make requested ordinary project revisions with host-native tools.", { capability: "rebuttal-and-revision" }),
      host("Validate that every response maps to a finding and that revisions do not overstate evidence or erase failures and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      mcp("manage_dove_claims", "Persist only material claim changes introduced by the author-side revision.", { persistWhen: "material-claim-change" })
    ], clarification }], examples: ["rebuttal"], channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  return {
    status: "route-or-domain-work", selectors: { mission: "none" }, generatedFields: [],
    modes: [{ id: "default", when: "The user requests Lessons reading, remembering, or reflection.", steps: [
      mcp("manage_dove_lessons", "For reading, use operation=read. For an explicit remember or reflection request, read the complete Markdown, preserve its current structure, integrate only supported reusable guidance, and use operation=replace with the full replacement document.", { required: ["operation"], readOnly: false, persistWhen: "explicit-replace-request" })
    ], clarification }], examples: ["lessons"], channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
}

export const COMMAND_SURFACES = SURFACES.map(([slug, summary, requiredTools]) => ({
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
export const COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));

export function commandIdToSlug(commandId) { return commandId.replace(/^dove\./u, ""); }
export function hostCommandSlug(commandId) { return commandIdToSlug(commandId).replace(/\./gu, "-"); }
export function adapterPathForCommand(hostId, command) {
  const commandId = typeof command === "string" ? command : command.id;
  const slug = hostCommandSlug(commandId);
  if (hostId === "opencode") return `.opencode/commands/${commandId}.md`;
  if (hostId === "cursor") return `.cursor/commands/dove-${slug}.md`;
  if (hostId === "codex") return `.codex/skills/dove-${slug}/SKILL.md`;
  if (hostId === "agents") return `.agents/skills/dove-${slug}/SKILL.md`;
  if (hostId === "claude") return `.claude/commands/dove/${slug}.md`;
  throw new Error(`Unknown host adapter: ${hostId}`);
}
export function commandAdapterPathsForHost(hostId) { return COMMAND_SURFACES.map((command) => adapterPathForCommand(hostId, command)); }
export function allGeneratedCommandAdapterPaths() { return PROJECT_HOST_IDS.flatMap(commandAdapterPathsForHost); }
export const HOST_ADAPTERS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => {
  const commandPaths = commandAdapterPathsForHost(hostId);
  const extraPaths = hostId === "opencode" ? [...OPENCODE_ROLE_SKILL_PATHS, ".opencode.json"] : hostId === "agents" ? ["AGENTS.md"] : [];
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths: [...commandPaths, ...extraPaths], requiredPaths: [...commandPaths, ...extraPaths], jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));
export const CURRENT_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...PACKAGE_RUNTIME_PATHS]),
  opencode: Object.freeze([...HOST_ADAPTERS.opencode.paths]),
  codex: Object.freeze([...HOST_ADAPTERS.codex.paths]),
  cursor: Object.freeze([...HOST_ADAPTERS.cursor.paths]),
  agents: Object.freeze([...HOST_ADAPTERS.agents.paths]),
  claude: Object.freeze([...commandAdapterPathsForHost("claude"), ...DOVE_CLAUDE_AMBIENT_PROJECT_PATHS])
});
const RETIRED = ["workspace", "mission", "note", "experience"];
export const RETIRED_MANAGED_PATHS = Object.freeze({
  opencode: Object.freeze(RETIRED.map((slug) => `.opencode/commands/dove.${slug}.md`)),
  codex: Object.freeze(RETIRED.flatMap((slug) => [`.codex/skills/dove-${slug}/SKILL.md`, `.codex/skills/dove-${slug}`])),
  cursor: Object.freeze(RETIRED.map((slug) => `.cursor/commands/dove-${slug}.md`)),
  agents: Object.freeze(RETIRED.flatMap((slug) => [`.agents/skills/dove-${slug}/SKILL.md`, `.agents/skills/dove-${slug}`])),
  claude: Object.freeze(RETIRED.map((slug) => `.claude/commands/dove/${slug}.md`))
});
export const MANAGED_PACKAGE_PATHS = Object.freeze([...CURRENT_MANAGED_PATHS.opencode, ...CURRENT_MANAGED_PATHS.codex, ...CURRENT_MANAGED_PATHS.cursor, ...CURRENT_MANAGED_PATHS.agents, ...commandAdapterPathsForHost("claude"), ...CURRENT_MANAGED_PATHS.core, ...PACKAGE_DOCUMENTATION_PATHS]);
