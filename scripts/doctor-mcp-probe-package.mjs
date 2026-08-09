#!/usr/bin/env node
import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);

// scripts/doctor-mcp-probe.mjs
import assert2 from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// src/core/command-manifest.mjs
var PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
var PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs", "mcp/dove-state-server-package.mjs", "scripts/doctor-mcp-probe-package.mjs", "scripts/dove-user-prompt-submit-package.mjs"];
var PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents", "claude"];
var HOST_IDS = [...PROJECT_HOST_IDS];
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

// src/core/mcp-runtime-identity.mjs
var DOVE_MCP_PROTOCOL_VERSIONS = Object.freeze([
  "2025-06-18",
  "2025-11-25"
]);
var DOVE_MCP_PROBE_PROTOCOL_VERSION = DOVE_MCP_PROTOCOL_VERSIONS[0];

// src/core/schema.mjs
var PACKAGE_VERSION = "0.7.0";
var DOVE_RESEARCH_FORMAT = "dove-research-v1";
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

// scripts/mcp-stdio-client.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import process2 from "node:process";
var CALL_TIMEOUT_MS = 15e3;
function createMcpStdioClient({ args, cwd, command = process2.execPath, env = process2.env, timeoutMs = CALL_TIMEOUT_MS, onRequest = null, framing = "content-length" }) {
  const server = spawn(command, args, {
    cwd,
    env,
    stdio: ["pipe", "pipe", "inherit"]
  });
  let buffer = Buffer.alloc(0);
  let nextId = 1;
  const pending = /* @__PURE__ */ new Map();
  function sendMessage(message) {
    const body = JSON.stringify(message);
    if (framing === "jsonl") {
      server.stdin.write(`${body}
`);
      return;
    }
    server.stdin.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r
\r
${body}`);
  }
  function call(method, params = {}, label = null) {
    const id = nextId++;
    const callLabel = label ?? (method === "tools/call" && params?.name ? `${method}:${params.name}` : method);
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        server.kill();
        reject(new Error(`MCP call timed out after ${timeoutMs}ms: ${callLabel}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer, method, label: callLabel });
    });
    sendMessage({ jsonrpc: "2.0", id, method, params });
    return promise;
  }
  function notify(method, params = {}) {
    sendMessage({ jsonrpc: "2.0", method, params });
  }
  function handleMessage(message) {
    if (message.method && message.id !== void 0) {
      Promise.resolve().then(() => typeof onRequest === "function" ? onRequest(message.method, message.params) : null).then(
        (result) => sendMessage({ jsonrpc: "2.0", id: message.id, result }),
        (error) => sendMessage({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } })
      );
      return;
    }
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    clearTimeout(waiter.timer);
    if (message.error) waiter.reject(new Error(`${waiter.label}: ${message.error.message}`));
    else waiter.resolve(message.result);
  }
  function parseMessages() {
    while (true) {
      if (framing === "jsonl") {
        const lineEnd = buffer.indexOf("\n");
        if (lineEnd === -1) return;
        const body2 = buffer.slice(0, lineEnd).toString("utf8").trim();
        buffer = buffer.slice(lineEnd + 1);
        if (body2) handleMessage(JSON.parse(body2));
        continue;
      }
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const headerText = buffer.slice(0, headerEnd).toString("utf8");
      const match = headerText.match(/Content-Length:\s*(\d+)/i);
      assert.ok(match, "Missing Content-Length header from MCP server");
      const length = Number(match[1]);
      const totalLength = headerEnd + 4 + length;
      if (buffer.length < totalLength) return;
      const body = buffer.slice(headerEnd + 4, totalLength).toString("utf8");
      buffer = buffer.slice(totalLength);
      handleMessage(JSON.parse(body));
    }
  }
  server.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    parseMessages();
  });
  server.on("exit", (code) => {
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(`MCP server exited early during ${waiter.label} with code ${code}`));
    }
    pending.clear();
  });
  return {
    call,
    notify,
    kill: () => server.kill(),
    server
  };
}

// scripts/doctor-mcp-probe.mjs
var target = path.resolve(process.argv[2] ?? process.cwd());
var identityOnly = process.argv.includes("--identity");
var sourceServerScriptPath = path.join(target, "mcp", "dove-state-server.mjs");
var packagedServerScriptPath = path.join(target, "mcp", "dove-state-server-package.mjs");
var sourceAmbientHookPath = path.join(target, "scripts", "dove-user-prompt-submit.mjs");
var packagedAmbientHookPath = path.join(target, "scripts", "dove-user-prompt-submit-package.mjs");
var usingSourceRuntime = fs.existsSync(sourceServerScriptPath);
var serverScriptPath = usingSourceRuntime ? sourceServerScriptPath : packagedServerScriptPath;
var ambientHookPath = fs.existsSync(sourceAmbientHookPath) ? sourceAmbientHookPath : packagedAmbientHookPath;
var EXPECTED_TOOL_NAMES = [
  "query_dove_research",
  "manage_dove_workspace",
  "manage_dove_missions",
  "manage_dove_sources",
  "manage_dove_experiments",
  "manage_dove_claims",
  "manage_dove_reviews",
  "manage_dove_lessons"
];
var EXPECTED_OPERATIONS = {
  query_dove_research: ["overview", "diagnosis", "related-work", "hypotheses", "experiment-options", "result-synthesis", "claim-story", "branch-synthesis", "reviews"],
  manage_dove_workspace: ["initialize", "set-mainline"],
  manage_dove_missions: ["query", "create", "branch", "conclude"],
  manage_dove_sources: ["query", "record"],
  manage_dove_experiments: ["query", "freeze", "record-result"],
  manage_dove_claims: ["query", "record"],
  manage_dove_reviews: ["local-preflight", "prepare", "import", "coverage"],
  manage_dove_lessons: ["read", "replace"]
};
var probeWorkspace = null;
var probeBase = null;
var createdProbeDirectories = [];
var client = null;
function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}
function snapshotTree(root) {
  const result = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        result[relativePath] = { type: "symlink", target: fs.readlinkSync(absolutePath) };
      } else if (stat.isDirectory()) {
        result[`${relativePath}/`] = { type: "directory", mode: stat.mode & 4095 };
        visit(absolutePath);
      } else if (stat.isFile()) {
        result[relativePath] = { type: "file", mode: stat.mode & 4095, size: stat.size, sha256: sha256File(absolutePath) };
      } else {
        result[relativePath] = { type: "other", mode: stat.mode & 4095 };
      }
    }
  };
  visit(root);
  return result;
}
function nearestRepositoryRoot(start) {
  let current = fs.realpathSync.native(start);
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
function createProbeWorkspace() {
  const repositoryRoot = nearestRepositoryRoot(target);
  probeBase = repositoryRoot ? path.join(repositoryRoot, ".tmp", "dove-workspaces") : path.join(target, ".tmp", "dove-workspaces");
  let current = probeBase;
  while (!fs.existsSync(current)) {
    createdProbeDirectories.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  fs.mkdirSync(probeBase, { recursive: true });
  probeWorkspace = fs.mkdtempSync(path.join(probeBase, "doctor-mcp-probe-"));
}
function cleanupProbeWorkspace() {
  if (probeWorkspace) fs.rmSync(probeWorkspace, { recursive: true, force: true });
  probeWorkspace = null;
  for (const directory of createdProbeDirectories) {
    try {
      fs.rmdirSync(directory);
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTEMPTY") throw error;
    }
  }
  createdProbeDirectories = [];
  probeBase = null;
}
function assertRegularFile(filePath, label) {
  const stat = fs.lstatSync(filePath);
  assert2.equal(stat.isFile() && !stat.isSymbolicLink(), true, `${label} must be a regular file`);
}
function assertHumanText(content) {
  assert2.equal(content?.[0]?.type, "text");
  assert2.ok(content[0].text.trim(), "MCP tools must return human-readable text");
  let parsed = false;
  try {
    JSON.parse(content[0].text);
    parsed = true;
  } catch {
    parsed = false;
  }
  assert2.equal(parsed, false, "MCP text must not be a raw JSON projection");
}
function parseToolPayload(name, result) {
  assert2.notEqual(result.isError, true, result.content?.[0]?.text ?? `${name} failed`);
  assert2.deepEqual(Object.keys(result.structuredContent ?? {}).sort(), ["operation", "research", "status"]);
  assert2.equal(result.structuredContent.operation, name);
  assert2.ok(result.structuredContent.research && typeof result.structuredContent.research === "object");
  assertHumanText(result.content);
  return result.structuredContent.research;
}
function runAmbientHook(input) {
  return spawnSync(process.execPath, [ambientHookPath], {
    cwd: probeWorkspace,
    encoding: "utf8",
    input: JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: probeWorkspace }
  });
}
async function callTool(name, arguments_) {
  return parseToolPayload(name, await client.call("tools/call", { name, arguments: arguments_ }));
}
async function callZeroWriteTool(name, arguments_) {
  const before = snapshotTree(probeWorkspace);
  const research = await callTool(name, arguments_);
  assert2.equal(research.zeroWrite, true, `${name}.${arguments_.operation} must declare zeroWrite`);
  assert2.deepEqual(snapshotTree(probeWorkspace), before, `${name}.${arguments_.operation} must be zero-write`);
  return research;
}
async function main() {
  assertRegularFile(serverScriptPath, "Dove MCP server entry");
  assertRegularFile(ambientHookPath, "Dove ambient hook entry");
  const targetBefore = identityOnly ? null : snapshotTree(target);
  createProbeWorkspace();
  client = createMcpStdioClient({
    args: [serverScriptPath],
    cwd: probeWorkspace,
    env: { ...process.env, CLAUDE_PROJECT_DIR: probeWorkspace }
  });
  const initialized = await client.call("initialize", {
    protocolVersion: DOVE_MCP_PROBE_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "dove-doctor", version: PACKAGE_VERSION }
  });
  assert2.equal(initialized.serverInfo.name, DOVE_MCP_SERVER_NAME, "MCP server name must be the canonical Dove name");
  assert2.equal(initialized.serverInfo.version, PACKAGE_VERSION, "MCP server version must match the package version");
  assert2.equal(initialized.protocolVersion, DOVE_MCP_PROBE_PROTOCOL_VERSION);
  client.notify("notifications/initialized");
  if (identityOnly) {
    client.kill();
    client = null;
    cleanupProbeWorkspace();
    console.log(JSON.stringify({
      ok: true,
      serverName: initialized.serverInfo.name,
      serverVersion: initialized.serverInfo.version,
      protocolVersion: initialized.protocolVersion,
      packageVersion: PACKAGE_VERSION,
      identityOnly: true,
      zeroWrite: true
    }));
    return;
  }
  const listed = await client.call("tools/list");
  const toolNames = listed.tools.map((tool) => tool.name);
  assert2.deepEqual(toolNames, EXPECTED_TOOL_NAMES, "MCP discovery must expose exactly the eight Research Format 1 tools");
  for (const definition of listed.tools) {
    assert2.deepEqual(definition.inputSchema?.properties?.operation?.enum, EXPECTED_OPERATIONS[definition.name], `${definition.name} operations must match Research Format 1`);
    assert2.equal(definition.inputSchema?.additionalProperties, false, `${definition.name} input must be sealed`);
  }
  const workspace = await callTool("manage_dove_workspace", {
    operation: "initialize",
    researchQuestion: "Does the packaged or source MCP runtime preserve the Dove 0.7.0 Research Format 1 contract?",
    mainline: "Probe the exact eight-tool stdio surface with contained representative research records.",
    contributionIntent: "Provide bounded release evidence for the installed MCP runtime.",
    currentFocus: "Verify real persistence, zero-write queries, and ambient routing.",
    changeReason: "Initialized the isolated doctor probe workspace."
  });
  assert2.equal(workspace.state, "current-healthy");
  assert2.equal(workspace.format, DOVE_RESEARCH_FORMAT);
  assert2.equal(workspace.workspaceRecord.researchQuestion.startsWith("Does the packaged or source MCP runtime"), true);
  assert2.equal(workspace.workspaceRecord.mainline.startsWith("Probe the exact eight-tool"), true);
  assert2.equal(workspace.workspaceRecord.contributionIntent.startsWith("Provide bounded release evidence"), true);
  assert2.equal(workspace.workspaceRecord.currentFocus.startsWith("Verify real persistence"), true);
  const mission = await callTool("manage_dove_missions", {
    operation: "create",
    missionId: "doctor-probe",
    dependsOnMissionIds: [],
    goal: "Verify the current stdio MCP research surface without changing the target package tree.",
    requirements: ["Exercise representative durable research records.", "Preserve explicit evidence limits."],
    assumptions: ["The isolated probe workspace is disposable and contains no user research."],
    scope: ["The eight Research Format 1 MCP tools.", "The installed ambient hook route."],
    outOfScope: ["Scientific review authority.", "Generated package bundle regeneration."],
    evidenceRequirements: ["Successful stdio tool results.", "Identical snapshots around read operations and of the target tree."],
    competingHypotheses: ["The runtime matches Research Format 1.", "The runtime still exposes a stale surface."],
    openQuestions: ["Does every representative query preserve an identical workspace snapshot?"],
    contextRefs: ["probe:doctor-mcp"],
    contributionRole: "release-probe"
  });
  assert2.equal(mission.missionId, "doctor-probe");
  fs.mkdirSync(path.join(probeWorkspace, "materials"), { recursive: true });
  fs.writeFileSync(path.join(probeWorkspace, "materials", "source.txt"), "Captured material for the isolated Dove doctor probe.\n");
  const source = await callTool("manage_dove_sources", {
    operation: "record",
    missionId: "doctor-probe",
    sourceId: "doctor-source",
    citationKey: "dove-doctor-probe",
    title: "Dove Doctor Probe Fixture",
    authors: ["Dove maintainers"],
    year: 2026,
    locator: "repository-local fixture",
    sourceType: "validation-fixture",
    summary: "A captured local fixture used only to verify Source persistence and query projection.",
    conditions: ["Repository-local isolated probe workspace."],
    relationship: "testable-gap",
    conflicts: [],
    limitations: ["Synthetic validation material, not external research evidence."],
    capturePath: "materials/source.txt",
    recordedAt: "2026-08-08T00:01:00.000Z"
  });
  assert2.equal(source.sourceId, "doctor-source");
  await callZeroWriteTool("manage_dove_sources", { operation: "query", missionId: "doctor-probe" });
  const experimentPlan = await callTool("manage_dove_experiments", {
    operation: "freeze",
    missionId: "doctor-probe",
    experimentId: "doctor-experiment",
    title: "Stdio persistence and zero-write discrimination",
    hypothesisRefs: ["The runtime matches Research Format 1.", "The runtime still exposes a stale surface."],
    protocol: ["Record one contained fixture through stdio.", "Snapshot the workspace before and after each representative query."],
    inputs: ["The isolated probe workspace and current MCP registry."],
    comparisons: ["Pre-query tree snapshot versus post-query tree snapshot."],
    metrics: ["Changed tree entries."],
    discriminatingObservations: ["A zero changed-entry count supports the declared read-only behavior."],
    successConditions: ["All representative records round-trip and all queries preserve the tree."],
    stopConditions: ["Stop on the first failed assertion."],
    constraints: ["Do not change the target package tree."],
    expectedArtifacts: ["probe-artifacts/result.json"],
    cost: "One local stdio probe pass.",
    risk: "A stale runtime may reject current fields.",
    failureValue: "A failure identifies the exact packaging or source drift.",
    contributionRole: "runtime-discrimination",
    plannedAt: "2026-08-08T00:02:00.000Z"
  });
  assert2.equal(experimentPlan.experimentId, "doctor-experiment");
  fs.mkdirSync(path.join(probeWorkspace, "probe-artifacts"), { recursive: true });
  fs.writeFileSync(path.join(probeWorkspace, "probe-artifacts", "result.json"), '{"changedEntries":0}\n');
  const experimentResult = await callTool("manage_dove_experiments", {
    operation: "record-result",
    missionId: "doctor-probe",
    experimentId: "doctor-experiment",
    kind: "positive",
    summary: "Representative records round-tripped through the current stdio surface.",
    observations: ["The current registry exposed the expected eight tools."],
    measurements: [{ metric: "tool-count", value: 8 }],
    denominator: { total: 8, observed: 8, failed: 0, excluded: 0 },
    hypothesisImpacts: [{ hypothesisRef: "The runtime matches Research Format 1.", impact: "supported-by-probe" }],
    claimImpacts: [],
    unexpectedObservations: [],
    uncertainty: ["This focused probe does not replace broader release validation."],
    artifactRefs: ["probe-artifacts/result.json"],
    failures: [],
    deviations: [],
    limitations: ["The fixture is synthetic and repository-local."],
    recordedAt: "2026-08-08T00:03:00.000Z"
  });
  assert2.equal(experimentResult.kind, "positive");
  await callZeroWriteTool("manage_dove_experiments", { operation: "query", view: "result-synthesis", missionId: "doctor-probe" });
  const claims = await callTool("manage_dove_claims", {
    operation: "record",
    missionId: "doctor-probe",
    claims: [{
      claimId: "doctor-claim",
      statement: "This runtime exposed exactly eight Research Format 1 tools during the focused stdio probe.",
      supportRefs: ["experiment:doctor-experiment"],
      counterEvidenceRefs: [],
      missingEvidence: ["Broader release validation remains separate."],
      cannotSay: ["This probe does not establish scientific authority or complete release readiness."],
      uncertainty: ["Only the focused source-runtime or packaged-runtime path was exercised."],
      assessment: "supported",
      storyRole: "bounded-runtime-validation",
      artifactRefs: ["probe-artifacts/result.json"],
      recordedAt: "2026-08-08T00:04:00.000Z"
    }]
  });
  assert2.equal(claims.claims[0].claimId, "doctor-claim");
  await callZeroWriteTool("manage_dove_claims", { operation: "query", missionId: "doctor-probe" });
  const lessonsMarkdown = "# Dove Lessons\n\n- Keep runtime probes aligned with the exact public research surface.\n- Treat focused validation as bounded evidence.\n";
  const lessonsWrite = await callTool("manage_dove_lessons", { operation: "replace", markdown: lessonsMarkdown });
  assert2.equal(lessonsWrite.markdown, lessonsMarkdown);
  const lessonsRead = await callZeroWriteTool("manage_dove_lessons", { operation: "read" });
  assert2.equal(lessonsRead.markdown, lessonsMarkdown);
  fs.writeFileSync(path.join(probeWorkspace, "review-scope.md"), "# Doctor Probe Review Scope\n");
  const review = await callZeroWriteTool("manage_dove_reviews", {
    operation: "local-preflight",
    missionId: "doctor-probe",
    exchangeId: "doctor-review",
    artifactPaths: ["review-scope.md"]
  });
  assert2.equal(review.status, "ready");
  assert2.equal(review.authority, "not-established");
  const overview = await callZeroWriteTool("query_dove_research", { operation: "overview", missionId: "doctor-probe", language: "en" });
  assert2.deepEqual(overview.inventory, { missions: 1, sources: 1, experimentPlans: 1, experimentResults: 1, claims: 1, reviews: 0 });
  const missionQuery = await callZeroWriteTool("manage_dove_missions", { operation: "query", missionId: "doctor-probe" });
  assert2.equal(missionQuery.inventory.missions, 1);
  const beforeHooks = snapshotTree(probeWorkspace);
  const slash = runAmbientHook({ hook_event_name: "UserPromptSubmit", prompt: "  /dove:status" });
  assert2.equal(slash.status, 0, slash.stderr);
  assert2.equal(slash.stdout, "");
  const ordinary = runAmbientHook({ hook_event_name: "UserPromptSubmit", prompt: "Implement the bounded package probe and add regression checks." });
  assert2.equal(ordinary.status, 0, ordinary.stderr);
  const ambientPayload = JSON.parse(ordinary.stdout);
  assert2.equal(ambientPayload.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert2.match(ambientPayload.hookSpecificOutput.additionalContext, /dove-intake/u);
  assert2.match(ambientPayload.hookSpecificOutput.additionalContext, /zero-write/u);
  assert2.doesNotMatch(ordinary.stdout, /Implement the bounded package probe/u);
  assert2.deepEqual(snapshotTree(probeWorkspace), beforeHooks, "Ambient hook routing must be zero-write");
  client.kill();
  client = null;
  cleanupProbeWorkspace();
  assert2.deepEqual(snapshotTree(target), targetBefore, "The target package tree changed during the MCP probe");
  console.log(JSON.stringify({
    ok: true,
    runtime: usingSourceRuntime ? "source" : "packaged",
    researchFormat: DOVE_RESEARCH_FORMAT,
    toolCount: toolNames.length,
    workspaceInitialized: true,
    missionCreated: true,
    sourceRoundTrip: true,
    experimentRoundTrip: true,
    claimRoundTrip: true,
    lessonsRoundTrip: true,
    reviewPreflightZeroWrite: true,
    queryZeroWrite: true,
    ambientRoutingZeroWrite: true,
    targetTreeUnchanged: true
  }));
}
try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  client?.kill();
  cleanupProbeWorkspace();
}
