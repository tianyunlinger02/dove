#!/usr/bin/env node

// bin/dove.mjs
import fs19 from "node:fs";
import path19 from "node:path";
import process2 from "node:process";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/core/claude-code-gateway.mjs
import fs2 from "node:fs";
import os from "node:os";
import path2 from "node:path";
import process from "node:process";

// src/core/contained-write.mjs
import fs from "node:fs";
import path from "node:path";
function pathEscapesRoot(relativePath) {
  return relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath);
}
function existingAncestor(candidatePath) {
  let currentPath = candidatePath;
  while (!fs.existsSync(currentPath)) {
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }
  return currentPath;
}
function resolveCanonicalContainedWrite(root, candidatePath, options = {}) {
  const label = options.label ?? "Write path";
  const resolvedRoot = path.resolve(root);
  const canonicalRoot = fs.realpathSync.native(resolvedRoot);
  const requestedPath = path.isAbsolute(candidatePath) ? path.resolve(candidatePath) : path.resolve(resolvedRoot, candidatePath);
  const requestedRelative = path.relative(resolvedRoot, requestedPath);
  if (!requestedRelative || pathEscapesRoot(requestedRelative)) {
    throw new Error(`${label} must stay inside the canonical root: ${candidatePath}`);
  }
  let currentPath = resolvedRoot;
  for (const component of requestedRelative.split(path.sep)) {
    currentPath = path.join(currentPath, component);
    let stat;
    try {
      stat = fs.lstatSync(currentPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        break;
      }
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`${label} must not contain symbolic links: ${candidatePath}`);
    }
  }
  const canonicalAncestor = fs.realpathSync.native(existingAncestor(requestedPath));
  const canonicalRelative = path.relative(canonicalRoot, canonicalAncestor);
  if (pathEscapesRoot(canonicalRelative)) {
    throw new Error(`${label} must stay inside the canonical root: ${candidatePath}`);
  }
  return {
    root: canonicalRoot,
    relativePath: requestedRelative.split(path.sep).join("/"),
    fullPath: path.join(canonicalRoot, requestedRelative)
  };
}

// src/core/claude-code-gateway.mjs
var CLAUDE_CODE_GATEWAY_ENV_DEFAULTS = Object.freeze({
  CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: "1",
  CLAUDE_CODE_MAX_CONTEXT_TOKENS: "220000",
  CLAUDE_CODE_AUTO_COMPACT_WINDOW: "220000",
  CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "70",
  CLAUDE_CODE_MAX_OUTPUT_TOKENS: "64000",
  CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS: "1",
  CLAUDE_CODE_ENABLE_OPUS_4_7_FAST_MODE: "1"
});
var CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START = "# >>> dove claude-code gateway defaults >>>";
var CLAUDE_CODE_GATEWAY_SHELL_BLOCK_END = "# <<< dove claude-code gateway defaults <<<";
var EARLY_RETURN_PATTERN = /^\s*\[\s*-z\s+"\$PS1"\s*\]\s*&&\s*return\s*$/mu;
function isPlainObject(value2) {
  return Boolean(value2) && typeof value2 === "object" && !Array.isArray(value2);
}
function escapeRegExp(value2) {
  return String(value2).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function readJsonObject(filePath2) {
  if (!fs2.existsSync(filePath2)) {
    return {};
  }
  const parsed2 = JSON.parse(fs2.readFileSync(filePath2, "utf8"));
  if (!isPlainObject(parsed2)) {
    throw new Error(`${path2.basename(filePath2)} must contain a JSON object.`);
  }
  return parsed2;
}
function renderSettings(settings) {
  return `${JSON.stringify(settings, null, 2)}
`;
}
function resolveClaudeConfigRoot(env = process.env) {
  return path2.resolve(env.DOVE_CLAUDE_CONFIG_DIR || path2.join(os.homedir(), ".claude"));
}
function resolveClaudeShellStartupFile(env = process.env) {
  return path2.resolve(env.DOVE_CLAUDE_SHELL_RC || path2.join(os.homedir(), ".bashrc"));
}
function renderClaudeCodeGatewayShellBlock(envDefaults = CLAUDE_CODE_GATEWAY_ENV_DEFAULTS) {
  return [
    CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START,
    "# Managed by Dove. Non-secret Claude Code compatibility settings only.",
    ...Object.entries(envDefaults).map(([key, value2]) => `export ${key}=${JSON.stringify(value2)}`),
    CLAUDE_CODE_GATEWAY_SHELL_BLOCK_END
  ].join("\n");
}
function removeManagedShellBlock(content) {
  const blockPattern = new RegExp(`${escapeRegExp(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START)}[\\s\\S]*?${escapeRegExp(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_END)}\\n?`, "u");
  return String(content ?? "").replace(blockPattern, "").replace(/\n{3,}/gu, "\n\n");
}
function insertShellBlock(content, block) {
  const stripped = removeManagedShellBlock(content);
  const earlyReturn = EARLY_RETURN_PATTERN.exec(stripped);
  if (earlyReturn) {
    const prefix2 = stripped.slice(0, earlyReturn.index).replace(/\n*$/u, "\n");
    const suffix = stripped.slice(earlyReturn.index).replace(/^\n*/u, "");
    return `${prefix2}${block}

${suffix}`;
  }
  const prefix = stripped.replace(/\n*$/u, "");
  return `${prefix}${prefix ? "\n\n" : ""}${block}
`;
}
function extractManagedShellBlock(content) {
  const start = String(content ?? "").indexOf(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START);
  const end = String(content ?? "").indexOf(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_END);
  if (start === -1 || end === -1 || end < start) {
    return "";
  }
  return String(content).slice(start, end + CLAUDE_CODE_GATEWAY_SHELL_BLOCK_END.length);
}
function inspectSettings(settingsPath, envDefaults = CLAUDE_CODE_GATEWAY_ENV_DEFAULTS) {
  if (!fs2.existsSync(settingsPath)) {
    return {
      ok: false,
      exists: false,
      fastMode: false,
      ensuredEnvKeys: Object.keys(envDefaults),
      missingEnvKeys: Object.keys(envDefaults),
      mismatchedEnvKeys: [],
      message: "Claude Code settings are missing; run dove sync . --host claude."
    };
  }
  try {
    const settings = readJsonObject(settingsPath);
    const env = isPlainObject(settings.env) ? settings.env : {};
    const missingEnvKeys = Object.keys(envDefaults).filter((key) => !(key in env));
    const mismatchedEnvKeys = Object.entries(envDefaults).filter(([key, value2]) => key in env && String(env[key]) !== value2).map(([key]) => key);
    const fastMode = settings.fastMode === true;
    const ok = fastMode && missingEnvKeys.length === 0 && mismatchedEnvKeys.length === 0;
    return {
      ok,
      exists: true,
      fastMode,
      ensuredEnvKeys: Object.keys(envDefaults),
      missingEnvKeys,
      mismatchedEnvKeys,
      message: ok ? "Claude Code settings are configured." : "Claude Code settings need Dove gateway defaults; run dove sync . --host claude."
    };
  } catch (error) {
    return {
      ok: false,
      exists: true,
      fastMode: false,
      ensuredEnvKeys: Object.keys(envDefaults),
      missingEnvKeys: Object.keys(envDefaults),
      mismatchedEnvKeys: [],
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
function inspectShellStartup(shellStartupFile, envDefaults = CLAUDE_CODE_GATEWAY_ENV_DEFAULTS) {
  if (!fs2.existsSync(shellStartupFile)) {
    return {
      ok: false,
      exists: false,
      hasManagedBlock: false,
      beforeEarlyReturn: false,
      ensuredEnvKeys: Object.keys(envDefaults),
      missingEnvKeys: Object.keys(envDefaults),
      message: "Claude Code shell startup defaults are missing; run dove sync . --host claude."
    };
  }
  const content = fs2.readFileSync(shellStartupFile, "utf8");
  const block = extractManagedShellBlock(content);
  const earlyReturn = EARLY_RETURN_PATTERN.exec(content);
  const blockIndex = content.indexOf(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START);
  const beforeEarlyReturn = Boolean(block) && (earlyReturn === null || blockIndex < earlyReturn.index);
  const missingEnvKeys = Object.entries(envDefaults).filter(([key, value2]) => !block.includes(`export ${key}=${JSON.stringify(value2)}`)).map(([key]) => key);
  const ok = Boolean(block) && beforeEarlyReturn && missingEnvKeys.length === 0;
  return {
    ok,
    exists: true,
    hasManagedBlock: Boolean(block),
    beforeEarlyReturn,
    ensuredEnvKeys: Object.keys(envDefaults),
    missingEnvKeys,
    message: ok ? "Claude Code shell startup defaults are configured." : "Claude Code shell startup defaults need refresh; run dove sync . --host claude."
  };
}
function configureClaudeCodeGatewayDefaults(options = {}) {
  const claudeConfigRoot = path2.resolve(options.claudeConfigRoot ?? resolveClaudeConfigRoot());
  const shellStartupFile = path2.resolve(options.shellStartupFile ?? resolveClaudeShellStartupFile());
  const envDefaults = options.envDefaults ?? CLAUDE_CODE_GATEWAY_ENV_DEFAULTS;
  fs2.mkdirSync(claudeConfigRoot, { recursive: true });
  const { fullPath: settingsPath } = resolveCanonicalContainedWrite(claudeConfigRoot, "settings.json", { label: "Claude Code settings path" });
  const shellRoot = path2.dirname(shellStartupFile);
  fs2.mkdirSync(shellRoot, { recursive: true });
  const { fullPath: safeShellStartupFile } = resolveCanonicalContainedWrite(shellRoot, path2.basename(shellStartupFile), { label: "Claude shell startup path" });
  const settings = readJsonObject(settingsPath);
  const env = isPlainObject(settings.env) ? { ...settings.env } : {};
  for (const [key, value2] of Object.entries(envDefaults)) {
    env[key] = value2;
  }
  const nextSettings = { ...settings, env, fastMode: true };
  const nextSettingsContent = renderSettings(nextSettings);
  const previousSettingsContent = fs2.existsSync(settingsPath) ? fs2.readFileSync(settingsPath, "utf8") : "";
  const settingsWritten = previousSettingsContent !== nextSettingsContent;
  if (settingsWritten) {
    fs2.writeFileSync(settingsPath, nextSettingsContent, "utf8");
  }
  const previousShellContent = fs2.existsSync(safeShellStartupFile) ? fs2.readFileSync(safeShellStartupFile, "utf8") : "";
  const nextShellContent = insertShellBlock(previousShellContent, renderClaudeCodeGatewayShellBlock(envDefaults));
  const shellWritten = previousShellContent !== nextShellContent;
  if (shellWritten) {
    fs2.writeFileSync(safeShellStartupFile, nextShellContent, "utf8");
  }
  return {
    ok: true,
    settings: {
      ok: true,
      written: settingsWritten,
      fastMode: true,
      ensuredEnvKeys: Object.keys(envDefaults)
    },
    shell: {
      ok: true,
      written: shellWritten,
      beforeEarlyReturn: inspectShellStartup(safeShellStartupFile, envDefaults).beforeEarlyReturn,
      ensuredEnvKeys: Object.keys(envDefaults)
    },
    restartRequired: true,
    message: "Claude Code Fast mode and gateway context defaults are configured; restart Claude Code or source the shell startup file before launching from an existing shell."
  };
}
function inspectClaudeCodeGatewayDefaults(options = {}) {
  const claudeConfigRoot = path2.resolve(options.claudeConfigRoot ?? resolveClaudeConfigRoot());
  const shellStartupFile = path2.resolve(options.shellStartupFile ?? resolveClaudeShellStartupFile());
  const envDefaults = options.envDefaults ?? CLAUDE_CODE_GATEWAY_ENV_DEFAULTS;
  const settings = inspectSettings(path2.join(claudeConfigRoot, "settings.json"), envDefaults);
  const shell = inspectShellStartup(shellStartupFile, envDefaults);
  const issues = [settings, shell].filter((item) => !item.ok).map((item) => item.message);
  return {
    ok: settings.ok && shell.ok,
    settings,
    shell,
    issues
  };
}

// src/cli/command-parser.mjs
var value = (name, options = {}) => ({ name, kind: "value", ...options });
var boolean = (name, options = {}) => ({ name, kind: "boolean", ...options });
var outputOptions = [boolean("--json"), value("--format")];
var mutationOptions = [value("--mutation-mode"), ...outputOptions];
var missionOptions = [
  value("--proposal-token"),
  value("--proposal-digest"),
  value("--mutation-mode"),
  ...outputOptions,
  value("--mission-id"),
  value("--goal"),
  value("--scope", { repeatable: true }),
  value("--out-of-scope", { repeatable: true }),
  value("--target-artifact", { repeatable: true }),
  value("--expected-artifact", { repeatable: true }),
  value("--completion-criterion", { repeatable: true }),
  value("--evidence-requirement", { repeatable: true }),
  value("--depends-on-mission-id", { repeatable: true }),
  value("--supersedes-mission-id"),
  boolean("--confirmed")
];
var receiptOptions = [
  value("--input"),
  value("--receipt-id"),
  value("--mission-id"),
  value("--contract-digest"),
  value("--summary"),
  value("--artifact-json", { repeatable: true }),
  value("--validation-json", { repeatable: true }),
  value("--criterion-json", { repeatable: true }),
  value("--produced-at"),
  ...mutationOptions
];
function command(options = [], positional = { min: 0, max: 1 }) {
  return { options, positional };
}
var CLI_COMMAND_SPECS = {
  install: command([boolean("--force"), value("--host", { repeatable: true }), value("--platform", { repeatable: true }), value("--mutation-mode"), ...outputOptions]),
  sync: command([boolean("--force"), value("--host", { repeatable: true }), value("--platform", { repeatable: true }), value("--mutation-mode"), ...outputOptions]),
  doctor: command([...outputOptions]),
  init: command([value("--goal"), boolean("--archive-reset"), boolean("--confirmed"), value("--proposal-token"), value("--proposal-digest"), ...mutationOptions]),
  mission: command(missionOptions),
  receipt: command(receiptOptions),
  status: command([value("--detail"), value("--result-mode"), value("--format"), boolean("--full"), boolean("--missions"), boolean("--json"), boolean("--help", { key: "help" }), boolean("-h", { key: "help" })]),
  lessons: command([value("--lesson-id"), value("--mission-id"), value("--scope"), value("--kind"), value("--summary"), value("--details"), value("--next-time-guidance", { repeatable: true }), value("--source-id", { repeatable: true }), value("--note-id", { repeatable: true }), value("--artifact", { repeatable: true }), value("--applies-to-artifact", { repeatable: true }), value("--tag", { repeatable: true }), value("--supersedes-lesson-id"), boolean("--include-superseded"), boolean("--include-unscoped"), value("--limit"), value("--proposal-token"), value("--mutation-mode"), boolean("--confirmed"), ...outputOptions], { min: 0, max: 2 }),
  version: command([value("--mission-id"), value("--version-id"), value("--label"), value("--artifact", { repeatable: true }), value("--supersedes-version-id"), value("--from-version-id"), value("--to-version-id"), boolean("--finalize"), ...mutationOptions]),
  source: command([value("--mission-id"), value("--source-id"), value("--citation-key"), value("--title"), value("--locator"), value("--source-type"), value("--origin"), value("--abstract"), value("--year"), value("--author", { repeatable: true }), value("--capture-path"), value("--method"), value("--checked-material"), value("--audit-evidence-json"), ...mutationOptions], { min: 0, max: 2 }),
  note: command([value("--mission-id"), value("--note-id"), value("--title"), value("--summary"), value("--quote", { repeatable: true }), value("--claim", { repeatable: true }), value("--open-question", { repeatable: true }), value("--source-id", { repeatable: true }), value("--artifact", { repeatable: true }), ...mutationOptions]),
  draft: command([value("--mission-id"), value("--draft-id"), value("--title"), value("--body"), value("--summary"), value("--evidence", { repeatable: true }), value("--artifact", { repeatable: true }), boolean("--metadata-only"), ...mutationOptions]),
  experience: command([value("--mission-id"), value("--experiment-id"), value("--title"), value("--goal"), value("--hypothesis"), value("--protocol"), value("--success-criterion", { repeatable: true }), value("--comparison-target", { repeatable: true }), value("--result"), value("--result-evidence", { repeatable: true }), value("--audit-finding", { repeatable: true }), value("--integrity-flag", { repeatable: true }), value("--claim-id"), value("--bridge-reason"), ...mutationOptions]),
  figure: command([value("--mission-id"), value("--figure-id"), value("--intent"), value("--purpose"), value("--material", { repeatable: true }), value("--prompt"), value("--output-path"), value("--output-sha256"), value("--caption"), value("--qa-finding", { repeatable: true }), ...mutationOptions]),
  review: command([value("--mission-id"), value("--exchange-id"), value("--review-id"), value("--policy"), value("--artifact", { repeatable: true }), value("--final-plan", { repeatable: true }), value("--final-result", { repeatable: true }), boolean("--preflight"), boolean("--prepare"), boolean("--import"), boolean("--verify-coverage"), boolean("--require-authoritative"), ...mutationOptions]),
  rebuttal: command([value("--mission-id"), value("--issue-json", { repeatable: true }), value("--strategy"), value("--response-json", { repeatable: true }), boolean("--issues-only"), boolean("--strategy-only"), ...mutationOptions])
};
function optionMap(spec) {
  const map = /* @__PURE__ */ new Map();
  for (const option of spec.options) {
    if (map.has(option.name)) throw new Error(`Duplicate CLI option spec: ${option.name}`);
    map.set(option.name, option);
  }
  return map;
}
function parseDoveCli(argv, specs = CLI_COMMAND_SPECS) {
  const tokens = Array.from(argv ?? [], (item) => String(item));
  if (tokens.length === 0) return { command: null, positionals: [], args: [] };
  const commandName = tokens.shift();
  if (["help", "--help", "-h"].includes(commandName)) return { command: commandName, positionals: [], args: [] };
  const spec = specs[commandName];
  if (spec && tokens.some((token) => token === "--help" || token === "-h")) return { command: commandName, positionals: [], args: ["--help"] };
  if (!spec) return { command: commandName, positionals: tokens, args: [] };
  const options = optionMap(spec);
  const args2 = [];
  const positionals = [];
  const seen = /* @__PURE__ */ new Map();
  let separated = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const raw = tokens[index];
    if (!separated && raw === "--") {
      separated = true;
      continue;
    }
    if (separated || !raw.startsWith("-")) {
      positionals.push(raw);
      continue;
    }
    const equalsIndex = raw.indexOf("=");
    const name = equalsIndex > 0 ? raw.slice(0, equalsIndex) : raw;
    const inlineValue = equalsIndex > 0 ? raw.slice(equalsIndex + 1) : null;
    const option = options.get(name);
    if (!option) throw new Error(`Unknown or unsupported CLI argument: ${name}.`);
    const key = option.key ?? option.name;
    const count = seen.get(key) ?? 0;
    if (count > 0 && !option.repeatable) throw new Error(`${name} may be provided only once.`);
    seen.set(key, count + 1);
    if (option.kind === "boolean") {
      if (inlineValue !== null) throw new Error(`${name} does not accept a value.`);
      args2.push(name);
      continue;
    }
    let optionValue = inlineValue;
    if (optionValue === null) {
      const next = tokens[index + 1];
      const nextName = next?.split("=", 1)[0];
      if (next === void 0 || next === "--" || options.has(nextName)) throw new Error(`${name} requires a value.`);
      optionValue = next;
      index += 1;
    }
    if (optionValue === "") throw new Error(`${name} requires a value.`);
    args2.push(name, optionValue);
  }
  const { min = 0, max = 0 } = spec.positional ?? {};
  if (positionals.length < min) throw new Error(`${commandName} requires ${min} positional argument(s).`);
  if (positionals.length > max) throw new Error(`${commandName} accepts at most ${max} positional argument(s).`);
  return { command: commandName, positionals, args: args2 };
}

// src/core/command-manifest.mjs
var CORE_INSTALL_PATHS = [
  "README.md",
  "docs/README.md",
  "docs/INSTALL.md",
  "docs/USAGE.md",
  "docs/PACKAGING.md",
  "docs/CAPABILITY_MATRIX.md",
  "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md",
  "dist/index.mjs",
  "bin/dove-package.mjs",
  "mcp/dove-state-server-package.mjs",
  "scripts/doctor-mcp-probe-package.mjs"
];
var DEFAULT_HOST_ADAPTERS = ["opencode"];
var PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents"];
var USER_HOST_IDS = ["claude"];
var HOST_IDS = [...PROJECT_HOST_IDS, ...USER_HOST_IDS];
var HOST_DEFINITIONS = {
  opencode: { label: "OpenCode", scope: "project", jsonChecks: [".opencode.json"] },
  codex: { label: "Codex", scope: "project", jsonChecks: [] },
  cursor: { label: "Cursor", scope: "project", jsonChecks: [] },
  agents: { label: "Shared agent skills", scope: "project", jsonChecks: [] },
  claude: { label: "Claude Code user commands", scope: "user", jsonChecks: [] }
};
var MANAGED_PACKAGE_PATHS = [
  ".opencode/commands/dove*.md",
  ".opencode/skills/dove-*",
  ".opencode.json",
  ".codex/skills/dove-*",
  ".cursor/commands/dove-*.md",
  ".agents/skills/dove-*",
  "AGENTS.md",
  ...CORE_INSTALL_PATHS
];
var OPENCODE_ROLE_SKILL_PATHS = [
  ".opencode/skills/dove-planner/SKILL.md",
  ".opencode/skills/dove-builder/SKILL.md",
  ".opencode/skills/dove-reviewer/SKILL.md"
];
var COMMON_CONSTRAINTS = [
  "Every mutation requires an explicit missionId and writes only mission-bound artifacts, canonical receipts, ownership, and lineage.",
  "Validate every imported path, hash, source, note, finding, experiment result, and artifact reference before the first write.",
  "Do not create task packets, boards, runtime state, navigation refreshes, hidden schedulers, policy overrides, role authority, or lifecycle mirrors.",
  "Every read is zero-write and must not repair, refresh, bootstrap, or convert durable state.",
  "Keep Planner, Builder, and Reviewer responsibilities separate; Reviewer authority must fail closed when no trusted proof capability exists."
];
var surface = (id, title, category, policy, summary, requiredTools, constraints, ux) => ({
  id,
  title,
  domain: "generic",
  category,
  policy,
  summary,
  requiredTools,
  constraints: [...COMMON_CONSTRAINTS, ...constraints],
  adapterConstraints: constraints,
  ux
});
var COMMAND_SURFACES = [
  surface("dove.init", "Dove init", "mutation", "guarded-mutation", "Propose and exactly confirm sealed schema 7 workspace initialization.", ["init_dove_goal"], [
    "Proposal is strictly zero-write; exact confirmation creates only manifest, project identity, ownership/lineage indexes, and required directories.",
    "Legacy or invalid state requires explicit direct-process archive-reset with no import, repair, fallback, or alias."
  ], { dailyFlow: ["Request a zero-write schema 7 initialization proposal.", "Inspect and replay the exact confirmation data only when approved."], targetingBehavior: "Initialization is bound to the canonical workspace, not a task target.", confirmationBehavior: "Replay the exact proposal digest and workspace identity.", expectedOutcome: "A sealed minimal schema 7 workspace exists without workflow side effects.", examples: ["/dove:init Initialize this research workspace", "/dove:init Archive invalid Dove state and initialize schema 7"] }),
  surface("dove.mission", "Dove mission", "mutation", "explicit-approval", "Propose and persist one minimal mission contract, then return control to the host.", ["create_dove_mission"], [
    "Persist only goal, scope, out-of-scope, target and expected artifacts, completion criteria, evidence requirements, dependencies, and supersession metadata.",
    "Proposal is zero-write; confirmation must exactly replay the returned contract and target artifact identities."
  ], { dailyFlow: ["Turn one concrete goal into a minimal mission contract.", "After approval, continue substantive work with native host planning and tools."], targetingBehavior: "The missionId is explicit or deterministically proposed; no packet target is resolved.", confirmationBehavior: "Approve the exact proposal, adjust it, or cancel.", expectedOutcome: "One durable mission contract exists and no orchestration route is created.", examples: ["/dove:mission Validate the new retrieval method", "/dove:mission Revise the methods draft from current evidence"] }),
  surface("dove.status", "Dove status", "query", "read-only", "Read schema 7 mission and evidence integrity without refreshing state.", ["query_dove_status"], [
    "Absent state returns needs-init; malformed, legacy, contradictory, or future state fails closed.",
    "Compact status reports only schema health, mission count, receipt count, source count, and live integrity."
  ], { dailyFlow: ["Inspect current schema and integrity without writes.", "Expand details only when the operator explicitly asks."], targetingBehavior: "Status aggregates real current artifacts across missions without selecting a task.", confirmationBehavior: "No confirmation is applicable because status is read-only.", expectedOutcome: "The operator sees current integrity and one safe next step.", examples: ["/dove:status", "/dove:status Show full mission integrity"] }),
  surface("dove.lessons", "Dove lessons", "mutation", "guarded-mutation", "Query advisory lessons by default or explicitly record one exact-confirmation mission-provenanced lesson.", ["query_dove_lessons", "record_dove_lesson"], [
    "Default behavior is an explicit read-only query; never auto-capture a lesson and never auto-recall lessons from another command.",
    "Every lesson retains its recording mission as provenance; global scope means broad applicability, not provenance detached from that mission.",
    "The only lesson kinds are preference, constraint, method, failure, and review-insight.",
    "Recording is advisory-only: proposal is strictly zero-write, and only the exact returned proposal token may be replayed with --confirmed inside a MutationContext.",
    "Lessons never grant authority, satisfy completion, replace current evidence checks, become mission output artifacts, import transcripts, write Trellis state, or create runtime memory."
  ], { dailyFlow: ["Query only the lessons explicitly requested for the current mission, kind, tags, or artifact scope.", "Use record only when the operator explicitly asks to preserve a specific lesson, then inspect and replay the exact confirmation command."], targetingBehavior: "Query may include globally applicable lessons and current mission-scoped lessons while preserving each recording mission; artifact filters require an explicit missionId.", confirmationBehavior: "Query never confirms. Record proposes with zero writes and accepts only the exact proposal token plus --confirmed; there is no confirmation alias.", expectedOutcome: "The operator receives current advisory guidance or one immutable advisory lesson with evidence lineage.", examples: ["/dove:lessons Query method lessons for the current mission", "/dove:lessons Record this explicit review insight"] }),
  surface("dove.version", "Dove version", "mutation", "guarded-mutation", "Snapshot, compare, or finalize current mission artifacts.", ["create_version_snapshot", "compare_versions"], [
    "Snapshots are immutable ids and contain current hashes and receipt lineage.",
    "Comparison rejects stale snapshots; finalization requires complete current receipts and authoritative review proof."
  ], { dailyFlow: ["Snapshot current mission artifacts before a meaningful revision.", "Compare two snapshots or request fail-closed finalization."], targetingBehavior: "Provide missionId and version ids explicitly.", confirmationBehavior: "Finalization succeeds only from current completion and Reviewer proof.", expectedOutcome: "Version lineage and a real hash comparison are durable.", examples: ["/dove:version Snapshot the current draft", "/dove:version Compare the previous and current snapshots"] }),
  surface("dove.source", "Dove source", "mutation", "guarded-mutation", "Register mission-bound source candidates or record a rejection.", ["query_sources", "register_source", "verify_source"], [
    "Registration always creates a candidate and imports captured material under mission-owned source artifacts.",
    "Public verification is rejection-only; positive verification requires a trusted internal receipt bound to current material and fingerprint."
  ], { dailyFlow: ["Register real external material with title or locator.", "Query eligibility or reject a candidate after an explicit audit."], targetingBehavior: "Provide missionId and sourceId explicitly.", confirmationBehavior: "No candidate becomes trusted through public input.", expectedOutcome: "The source has current identity, material fingerprint, lifecycle, and eligibility.", examples: ["/dove:source Register this paper for the mission", "/dove:source Reject the candidate after checking the captured PDF"] }),
  surface("dove.note", "Dove note", "mutation", "guarded-mutation", "Write substantive mission-bound synthesis from current trusted evidence.", ["upsert_note"], [
    "A note requires summary, quote, claim, or open question plus at least one current verified source or mission artifact.",
    "Source trust and artifact hashes are reassessed before writing."
  ], { dailyFlow: ["Synthesize verified source material or current artifacts.", "Record claims, quotes, and open questions rather than empty bookkeeping."], targetingBehavior: "Provide missionId and noteId explicitly.", confirmationBehavior: "Ineligible or cross-mission evidence stops the write.", expectedOutcome: "A substantive note with current evidence lineage exists.", examples: ["/dove:note Summarize the verified sources", "/dove:note Record the open methodological question"] }),
  surface("dove.figure", "Dove figure", "mutation", "guarded-mutation", "Prepare or import a mission-bound figure with caption, provenance, QA, and review boundary.", ["run_figure_workflow"], [
    "Provider execution stays host-side; Dove accepts only current imported output with a matching hash.",
    "Clean QA is diagnostic only; validated requires authoritative proof for the exact final artifact hash."
  ], { dailyFlow: ["Gather current mission materials and record a drawing prompt.", "Import host-produced output with caption and QA when available."], targetingBehavior: "Provide missionId, figureId, and material artifact paths explicitly.", confirmationBehavior: "Binary imports use direct-process; patch-plan supports SVG only.", expectedOutcome: "The figure is planned, awaiting review, needs fixes, or validated by trusted proof.", examples: ["/dove:figure Prepare the method overview figure", "/dove:figure Import the generated SVG with its caption"] }),
  surface("dove.experience", "Dove experience", "mutation", "guarded-mutation", "Record one mission-bound experiment protocol, result, audit, and optional claim bridge.", ["run_experience_workflow", "upsert_claims"], [
    "The protocol, result, audit, and claim bridge use one implementation and one preflighted write set.",
    "Results require current evidence; claim bridges require a clean audit and a current mission claim."
  ], { dailyFlow: ["Record a concrete protocol and success criteria.", "Add current result evidence, audit findings, and claim impact when available."], targetingBehavior: "Provide missionId and experimentId explicitly.", confirmationBehavior: "Integrity flags prevent claim bridging.", expectedOutcome: "Experiment evidence and claim impact are linked without scheduling execution.", examples: ["/dove:experience Record the ablation protocol", "/dove:experience Audit the result and bridge it to the claim"] }),
  surface("dove.draft", "Dove draft", "mutation", "guarded-mutation", "Write a real mission-bound draft body or metadata for an existing draft.", ["upsert_draft", "upsert_draft_metadata"], [
    "Body writes require non-empty substantive text and current evidence lineage.",
    "Metadata-only updates require an existing current mission-owned draft."
  ], { dailyFlow: ["Write or revise real draft text from current evidence.", "Use metadata-only mode only for an existing draft."], targetingBehavior: "Provide missionId and draftId explicitly.", confirmationBehavior: "Cross-mission or stale evidence stops the write.", expectedOutcome: "A real draft artifact and canonical receipt exist.", examples: ["/dove:draft Write the methods section", "/dove:draft Update metadata for the current draft"] }),
  surface("dove.review", "Dove review", "mutation", "guarded-mutation", "Preflight, prepare, import, or verify one policy-scoped schema 7 review exchange without reviewer orchestration.", ["prepare_review_exchange", "import_review_exchange", "verify_review_coverage"], [
    "Policy expresses input scope only: local-preflight, isolated-selected-artifacts, final-plan-results-only, or external.",
    "local-preflight is strictly zero-write and non-authoritative; other policies freeze only current mission-owned artifact snapshots.",
    "Prepare writes canonical input and manifest artifacts; import accepts only the canonical handoff and report after all path, identity, scope, and hash checks pass.",
    "Imported public review material remains non-authoritative; caller-supplied reviewer identity, verdict, report, handoff, or manifest fields never mint Reviewer authority.",
    "Dove does not launch a reviewer, session, subagent, process, loop, board transition, runtime continuation, or navigation refresh."
  ], { dailyFlow: ["Use local-preflight for a zero-write exact scope check.", "Prepare a policy-scoped exchange, let an independent external process or person produce the declared files, then import and verify coverage."], targetingBehavior: "Provide missionId and explicit policy artifact paths; import also requires exchangeId and reviewId.", confirmationBehavior: "Prepare/import are guarded mutations; preflight and coverage verification are read-only.", expectedOutcome: "A tamper-evident mission-bound review and exact current coverage assessment exist without self-issued authority.", examples: ["/dove:review Preflight the current methods artifacts", "/dove:review Import the returned review exchange"] }),
  surface("dove.rebuttal", "Dove rebuttal", "mutation", "guarded-mutation", "Normalize reviewer findings and write author-side evidence-linked responses.", ["normalize_rebuttal_issues", "build_rebuttal_strategy", "build_rebuttal"], [
    "Every issue must link to a current mission-owned review artifact and concrete finding id.",
    "Strategy and responses remain author-side and reject stale issues, stale strategy, or missing evidence."
  ], { dailyFlow: ["Normalize concrete reviewer findings before strategy.", "Write evidence-linked author responses without claiming Reviewer authority."], targetingBehavior: "Provide missionId and finding references explicitly.", confirmationBehavior: "Unsupported findings or responses stop before writing.", expectedOutcome: "Issues, strategy, and response text retain current finding and evidence lineage.", examples: ["/dove:rebuttal Normalize the reviewer findings", "/dove:rebuttal Draft evidence-backed responses"] })
];
var COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));
var DIRECT_PROCESS_ADAPTER_COMMAND_IDS = COMMAND_SURFACES.filter((item) => item.category === "mutation").map((item) => item.id);
function commandIdToSlug(commandId) {
  return commandId.replace(/^dove\./u, "");
}
function hostCommandSlug(commandId) {
  return commandIdToSlug(commandId).replace(/\./gu, "-");
}
function adapterPathForCommand(hostId, command3) {
  const commandId = typeof command3 === "string" ? command3 : command3.id;
  const hostSlug = hostCommandSlug(commandId);
  switch (hostId) {
    case "opencode":
      return `.opencode/commands/${commandId}.md`;
    case "cursor":
      return `.cursor/commands/dove-${hostSlug}.md`;
    case "codex":
      return `.codex/skills/dove-${hostSlug}/SKILL.md`;
    case "agents":
      return `.agents/skills/dove-${hostSlug}/SKILL.md`;
    case "claude":
      return `commands/dove/${hostSlug}.md`;
    default:
      throw new Error(`Unknown host adapter: ${hostId}`);
  }
}
function commandAdapterPathsForHost(hostId) {
  return COMMAND_SURFACES.map((command3) => adapterPathForCommand(hostId, command3));
}
var HOST_ADAPTERS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => {
  const commandPaths = commandAdapterPathsForHost(hostId);
  const extraPaths = hostId === "opencode" ? [...OPENCODE_ROLE_SKILL_PATHS, ".opencode.json"] : hostId === "agents" ? ["AGENTS.md"] : [];
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths: [...commandPaths, ...extraPaths], requiredPaths: [...commandPaths, ...extraPaths], jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));

// src/core/execution-receipts.mjs
import fs12 from "node:fs";
import path12 from "node:path";

// src/core/artifact-integrity.mjs
import fs3 from "node:fs";
import path3 from "node:path";

// src/core/schema.mjs
var DOVE_WORKSPACE_SCHEMA_VERSION = 7;
var PACKAGE_VERSION = "0.2.0";
var DOVE_RESPONSE_LANGUAGES = Object.freeze(["zh", "en"]);
var ARTIFACT_PATHS = Object.freeze({
  doveRoot: ".dove",
  doveRootManifest: ".dove/manifest.json",
  projectIdentity: ".dove/project.json",
  missionsDir: ".dove/missions",
  lessonsDir: ".dove/lessons",
  receiptsDir: ".dove/receipts",
  executionReceiptsDir: ".dove/receipts/execution",
  completionReceiptsDir: ".dove/receipts/completion",
  authorityReceiptsDir: ".dove/receipts/authority",
  artifactsDir: ".dove/artifacts",
  artifactOwnership: ".dove/artifacts/ownership.json",
  artifactLineage: ".dove/artifacts/lineage.json",
  sourcesDir: ".dove/sources",
  notesDir: ".dove/notes",
  claimsDir: ".dove/claims",
  experimentsDir: ".dove/experiments",
  draftsDir: ".dove/drafts",
  figuresDir: ".dove/figures",
  reviewsDir: ".dove/reviews",
  reviewExchangesDir: ".dove/reviews/exchanges",
  rebuttalDir: ".dove/rebuttal",
  versionsDir: ".dove/versions"
});
function governanceScopeMetadata(mutationScope) {
  return Object.freeze({
    mutationScope,
    requiresMissionId: mutationScope !== "project-identity",
    artifactFields: []
  });
}
var GUARDED_MUTATIONS = [
  ["init-dove-goal", "Creating minimal Dove project identity", ARTIFACT_PATHS.projectIdentity, "initDoveGoal", "init_dove_goal", ["dove.init"], "project-identity"],
  ["create-dove-mission", "Persisting one minimal mission contract", ARTIFACT_PATHS.missionsDir, "createDoveMission", "create_dove_mission", ["dove.mission"], "mission-contract"],
  ["record-dove-lesson", "Recording an immutable mission-provenanced lesson", ARTIFACT_PATHS.lessonsDir, "recordDoveLesson", "record_dove_lesson", ["dove.lessons"], "mission-domain"],
  ["ingest-execution-receipt", "Ingesting an immutable execution receipt", ARTIFACT_PATHS.executionReceiptsDir, "ingestExecutionReceipt", "ingest_execution_receipt", [], "mission-receipt"],
  ["register-source", "Registering a mission-bound source candidate", ARTIFACT_PATHS.sourcesDir, "registerSource", "register_source", ["dove.source"], "mission-domain"],
  ["verify-source", "Rejecting a mission-bound source candidate", ARTIFACT_PATHS.sourcesDir, "verifySource", "verify_source", ["dove.source"], "mission-domain"],
  ["upsert-note", "Recording a mission-bound evidence note", ARTIFACT_PATHS.notesDir, "upsertNote", "upsert_note", ["dove.note"], "mission-domain"],
  ["upsert-claims", "Recording mission-bound evidence-backed claims", ARTIFACT_PATHS.claimsDir, "upsertClaims", "upsert_claims", ["dove.experience"], "mission-domain"],
  ["run-experience-workflow", "Recording a mission-bound experiment", ARTIFACT_PATHS.experimentsDir, "runExperienceWorkflow", "run_experience_workflow", ["dove.experience"], "mission-domain"],
  ["upsert-draft", "Writing a mission-bound draft", ARTIFACT_PATHS.draftsDir, "upsertDraft", "upsert_draft", ["dove.draft"], "mission-domain"],
  ["upsert-draft-metadata", "Writing metadata for a mission-bound draft", ARTIFACT_PATHS.draftsDir, "upsertDraftMetadata", "upsert_draft_metadata", ["dove.draft"], "mission-domain"],
  ["run-figure-workflow", "Preparing or importing a mission-bound figure", ARTIFACT_PATHS.figuresDir, "runFigureWorkflow", "run_figure_workflow", ["dove.figure"], "mission-domain"],
  ["prepare-review-exchange", "Preparing a frozen mission-bound review exchange", ARTIFACT_PATHS.reviewExchangesDir, "prepareReviewExchange", "prepare_review_exchange", ["dove.review"], "mission-review"],
  ["import-review-exchange", "Importing a verified mission-bound review exchange", ARTIFACT_PATHS.reviewsDir, "importReviewExchange", "import_review_exchange", ["dove.review"], "mission-review"],
  ["normalize-rebuttal-issues", "Normalizing mission-bound review findings", ARTIFACT_PATHS.rebuttalDir, "normalizeRebuttalIssues", "normalize_rebuttal_issues", ["dove.rebuttal"], "mission-domain"],
  ["build-rebuttal-strategy", "Recording an author-side rebuttal strategy", ARTIFACT_PATHS.rebuttalDir, "buildRebuttalStrategy", "build_rebuttal_strategy", ["dove.rebuttal"], "mission-domain"],
  ["build-rebuttal", "Writing evidence-linked author responses", ARTIFACT_PATHS.rebuttalDir, "buildRebuttal", "build_rebuttal", ["dove.rebuttal"], "mission-domain"],
  ["create-version-snapshot", "Snapshotting current mission artifacts", ARTIFACT_PATHS.versionsDir, "createVersionSnapshot", "create_version_snapshot", ["dove.version"], "mission-domain"],
  ["compare-versions", "Comparing mission artifact snapshots", ARTIFACT_PATHS.versionsDir, "compareVersions", "compare_versions", ["dove.version"], "mission-domain"]
];
var GOVERNANCE_GUARDED_MUTATIONS = Object.freeze(GUARDED_MUTATIONS.map(([id, action, artifactPath, coreFunction, mcpTool, commandIds, scope]) => Object.freeze({
  id,
  action,
  artifactPath,
  surfaceBindings: Object.freeze({ coreFunction, mcpTool, commandIds: Object.freeze(commandIds) }),
  ...governanceScopeMetadata(scope)
})));
var GOVERNANCE_EXEMPT_MUTATIONS = Object.freeze([]);
var GOVERNANCE_READONLY_COMMANDS = Object.freeze(["dove.status"]);
var GOVERNANCE_READONLY_TOOLS = Object.freeze([
  "query_dove_mission",
  "query_dove_status",
  "assess_mission_completion",
  "search_network",
  "query_network_search_providers",
  "query_sources",
  "query_dove_lessons",
  "verify_review_coverage"
]);
var NEGATIVE_TESTS = Object.freeze({
  "init-dove-goal": "initialization rejects stale or mismatched confirmation without writing",
  "create-dove-mission": "mission confirmation rejects replay drift without writing",
  "record-dove-lesson": "lesson confirmation rejects workspace, contract, mutation mode, content, supersession, and reference drift without writing",
  "ingest-execution-receipt": "receipt ingestion validates current contracts, paths, hashes, and evidence before writing",
  "register-source": "source registration requires an explicit mission and creates candidate evidence only",
  "verify-source": "public source verification cannot mint positive trust authority",
  "upsert-note": "notes reject stale, cross-mission, or ineligible evidence before writing",
  "upsert-claims": "claims reject missing, stale, or cross-mission evidence before writing",
  "run-experience-workflow": "experiment result, audit, and claim bridge preflight one atomic write set",
  "upsert-draft": "drafts require explicit mission binding and current evidence",
  "upsert-draft-metadata": "draft metadata requires a current mission-owned draft",
  "run-figure-workflow": "figure import validates current materials, output hash, and review coverage before writing",
  "prepare-review-exchange": "review preparation rejects unsafe or cross-mission paths before writing",
  "import-review-exchange": "review import rejects tampering, drift, symlinks, and caller-minted authority before writing",
  "normalize-rebuttal-issues": "rebuttal issues require current mission-bound findings and evidence",
  "build-rebuttal-strategy": "rebuttal strategy requires current normalized issues",
  "build-rebuttal": "author responses preflight issues, strategy, and evidence before writing",
  "create-version-snapshot": "version snapshots reject stale or cross-mission artifacts and finalization fails closed",
  "compare-versions": "version comparison rejects stale snapshots before writing"
});
var GOVERNANCE_NEGATIVE_COVERAGE = Object.freeze(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => Object.freeze({
  id: entry.id,
  level: "dynamic",
  tests: Object.freeze([NEGATIVE_TESTS[entry.id]])
})));

// src/core/artifact-integrity.mjs
var BOOKKEEPING_PREFIXES = Object.freeze([
  `${ARTIFACT_PATHS.missionsDir}/`,
  `${ARTIFACT_PATHS.lessonsDir}/`,
  `${ARTIFACT_PATHS.receiptsDir}/`,
  `${ARTIFACT_PATHS.artifactsDir}/`
]);
var BOOKKEEPING_FILES = /* @__PURE__ */ new Set([ARTIFACT_PATHS.doveRootManifest, ARTIFACT_PATHS.projectIdentity]);
var DOMAIN_PREFIXES = Object.freeze([
  ARTIFACT_PATHS.sourcesDir,
  ARTIFACT_PATHS.notesDir,
  ARTIFACT_PATHS.claimsDir,
  ARTIFACT_PATHS.experimentsDir,
  ARTIFACT_PATHS.draftsDir,
  ARTIFACT_PATHS.figuresDir,
  ARTIFACT_PATHS.reviewsDir,
  ARTIFACT_PATHS.rebuttalDir,
  ARTIFACT_PATHS.versionsDir
]);
function normalizeProjectRelativePath(rawPath) {
  const original = typeof rawPath === "string" ? rawPath.trim() : String(rawPath ?? "").trim();
  if (!original) return { ok: false, path: original, reason: "empty path" };
  if (original.includes("\0")) return { ok: false, path: original, reason: "path contains a null byte" };
  if (path3.isAbsolute(original) || /^[A-Za-z]:[\\/]/u.test(original)) {
    return { ok: false, path: original, reason: "absolute paths are not inspected" };
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(original)) {
    return { ok: false, path: original, reason: "unsupported or malformed external reference scheme" };
  }
  const normalizedPath = path3.posix.normalize(original.replace(/\\/gu, "/"));
  if (normalizedPath === "." || normalizedPath === ".." || normalizedPath.startsWith("../")) {
    return { ok: false, path: original, normalizedPath, reason: "path escapes the project root" };
  }
  return { ok: true, path: original, normalizedPath };
}
function artifactEvidenceRole(relativePath) {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) return "unsupported";
  const value2 = normalized.normalizedPath;
  if (!value2.startsWith(`${ARTIFACT_PATHS.doveRoot}/`)) return "external-project";
  if (BOOKKEEPING_FILES.has(value2) || BOOKKEEPING_PREFIXES.some((prefix) => value2.startsWith(prefix))) return "bookkeeping";
  if (DOMAIN_PREFIXES.some((prefix) => value2 === prefix || value2.startsWith(`${prefix}/`))) return "substantive";
  return "unsupported";
}
function inspectDeclaredPath(root, rawPath, options = {}) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath ?? null, status: "unsafe", exists: false, file: false, reason: normalized.reason };
  }
  const rootPath = path3.resolve(root);
  const fullPath = path3.resolve(rootPath, normalized.normalizedPath);
  const relativeToRoot = path3.relative(rootPath, fullPath);
  if (relativeToRoot === ".." || relativeToRoot.startsWith(`..${path3.sep}`) || path3.isAbsolute(relativeToRoot)) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "unsafe", exists: false, file: false, reason: "resolved path escapes the project root" };
  }
  let realRootPath;
  let realFullPath;
  let canonicalRelativePath;
  let stat;
  try {
    realRootPath = fs3.realpathSync.native(rootPath);
    realFullPath = fs3.realpathSync.native(fullPath);
    const relativeToRealRoot = path3.relative(realRootPath, realFullPath);
    if (relativeToRealRoot === ".." || relativeToRealRoot.startsWith(`..${path3.sep}`) || path3.isAbsolute(relativeToRealRoot)) {
      return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "unsafe", exists: true, file: false, reason: "real path escapes the project root" };
    }
    canonicalRelativePath = relativeToRealRoot.split(path3.sep).join("/");
    stat = fs3.statSync(realFullPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "missing", exists: false, file: false, reason: "path does not exist" };
    }
    return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "unreadable", exists: false, file: false, reason: error instanceof Error ? error.message : String(error) };
  }
  if (stat.isDirectory()) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath, canonicalRelativePath, status: "directory", exists: true, file: false, sizeBytes: stat.size, reason: "path is a directory" };
  }
  if (!stat.isFile()) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath, canonicalRelativePath, status: "unsupported", exists: true, file: false, sizeBytes: stat.size, reason: "path is not a regular file" };
  }
  const evidenceRole = artifactEvidenceRole(normalized.normalizedPath);
  const canonicalEvidenceRole = artifactEvidenceRole(canonicalRelativePath);
  const base = { path: normalized.path, normalizedPath: normalized.normalizedPath, canonicalRelativePath, evidenceRole, canonicalEvidenceRole, status: "existing", exists: true, file: true, sizeBytes: stat.size };
  if (options.rejectBookkeeping === true) {
    const rejected = [evidenceRole, canonicalEvidenceRole].find((role) => role === "bookkeeping" || role === "unsupported");
    if (rejected) {
      return { ...base, status: rejected, reason: rejected === "bookkeeping" ? "path is Dove bookkeeping rather than substantive evidence" : "path is not an approved schema 7 evidence artifact" };
    }
  }
  if (options.requireNonEmpty === true && stat.size === 0) return { ...base, status: "empty", reason: "path is an empty file" };
  if (options.readText !== true) return base;
  try {
    const maxBytes = Number.isInteger(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : 24 * 1024;
    const descriptor = fs3.openSync(realFullPath, "r");
    try {
      const buffer = Buffer.alloc(Math.min(maxBytes, stat.size));
      const bytesRead = fs3.readSync(descriptor, buffer, 0, buffer.length, 0);
      return { ...base, text: buffer.subarray(0, bytesRead).toString("utf8"), bytesRead, truncated: stat.size > bytesRead };
    } finally {
      fs3.closeSync(descriptor);
    }
  } catch (error) {
    return { ...base, status: "unreadable", reason: error instanceof Error ? error.message : String(error) };
  }
}

// src/core/workspace.mjs
import fs5 from "node:fs";
import path5 from "node:path";

// src/core/mutation-backend.mjs
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import fs4 from "node:fs";
import path4 from "node:path";
var mutationStorage = new AsyncLocalStorage();
var DIRECT_PROCESS_ROLLBACK_REASON = "direct-process writes are performed by the Dove process, not by host-tracked file edits; native programming-terminal rollback cannot be verified for those writes.";
var PATCH_PLAN_ROLLBACK_ADVICE = "Use mutationMode: patch-plan and apply the returned operations through host-tracked file edits before relying on host rollback.";
function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}
function normalizeMutationMode(value2) {
  if (value2 === void 0) {
    return "direct-process";
  }
  if (value2 === "patch-plan" || value2 === "direct-process") {
    return value2;
  }
  throw new Error("mutationMode must be either patch-plan or direct-process when explicitly provided.");
}
function normalizeRelativePath(relativePath) {
  if (typeof relativePath !== "string" || !relativePath.trim()) {
    throw new Error("Mutation path must be a non-empty relative path.");
  }
  const normalized = path4.posix.normalize(relativePath.replace(/\\/g, "/"));
  if (path4.isAbsolute(relativePath) || normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw new Error(`Mutation path must stay inside the project: ${relativePath}`);
  }
  return normalized;
}
function classifyScope(relativePath) {
  if (relativePath === ".dove" || relativePath.startsWith(".dove/")) {
    return ".dove";
  }
  if (relativePath.startsWith(".opencode/") || relativePath.startsWith(".cursor/") || relativePath.startsWith(".codex/") || relativePath.startsWith(".agents/")) {
    return "generated-adapter";
  }
  return "explicit-external-output";
}
function serializeJson(value2) {
  return `${JSON.stringify(value2, null, 2)}
`;
}
function resultDeclaresWrites(value2) {
  return Boolean(value2) && typeof value2 === "object" && !Array.isArray(value2) && Array.isArray(value2.writes) && value2.writes.length > 0;
}
function readDiskText(root, relativePath, fallback = "") {
  const fullPath = path4.join(root, relativePath);
  if (!fs4.existsSync(fullPath)) {
    return fallback;
  }
  return fs4.readFileSync(fullPath, "utf8");
}
function diskFileState(root, relativePath) {
  const fullPath = path4.join(root, relativePath);
  if (!fs4.existsSync(fullPath)) {
    return { exists: false, sha256: null };
  }
  return { exists: true, sha256: sha256(fs4.readFileSync(fullPath)) };
}
function buildMutationId() {
  return `mutation-${crypto.randomUUID()}`;
}
var MutationContext = class {
  constructor(root, options = {}) {
    const resolvedRoot = path4.resolve(root);
    this.root = fs4.realpathSync.native(resolvedRoot);
    this.id = options.id ?? buildMutationId();
    this.actionId = options.actionId ?? "unspecified";
    this.mutationMode = normalizeMutationMode(options.mutationMode);
    this.mutationModeSource = options.mutationMode === "patch-plan" || options.mutationMode === "direct-process" ? "explicit" : "default";
    this.hostId = options.hostId ?? "unknown";
    this.createdAt = options.createdAt ?? (/* @__PURE__ */ new Date()).toISOString();
    this.overlay = /* @__PURE__ */ new Map();
    this.operationsByPath = /* @__PURE__ */ new Map();
    this.operationOrder = [];
    this.lifecycle = "active";
  }
  get patchPlanMode() {
    return this.mutationMode === "patch-plan";
  }
  assertActive(operation = "MutationContext operation") {
    if (this.lifecycle !== "active") {
      throw new Error(`${operation} cannot use a ${this.lifecycle} MutationContext.`);
    }
  }
  resolve(relativePath) {
    this.assertActive("Mutation path resolution");
    const normalized = normalizeRelativePath(relativePath);
    return resolveCanonicalContainedWrite(this.root, normalized, { label: "Mutation path" });
  }
  fileExists(relativePath) {
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    return this.overlay.has(normalized) || fs4.existsSync(fullPath);
  }
  readText(relativePath, fallback = "") {
    const { relativePath: normalized } = this.resolve(relativePath);
    if (this.overlay.has(normalized)) {
      return this.overlay.get(normalized);
    }
    return readDiskText(this.root, normalized, fallback);
  }
  readJson(relativePath, fallback) {
    const text = this.readText(relativePath, null);
    if (text === null) {
      return typeof fallback === "function" ? fallback() : structuredClone(fallback);
    }
    return JSON.parse(text);
  }
  writeJson(relativePath, value2) {
    return this.writeText(relativePath, serializeJson(value2), "write-json");
  }
  writeJsonIfChanged(relativePath, value2) {
    const nextContent = serializeJson(value2);
    const currentContent = this.readText(relativePath, null);
    if (currentContent === nextContent) {
      return false;
    }
    this.writeText(relativePath, nextContent, "write-json");
    return true;
  }
  writeText(relativePath, content, kind = "write-text") {
    return this.writeContent(relativePath, String(content ?? ""), { kind, encoding: "utf8" });
  }
  writeBinary(relativePath, content, kind = "write-binary") {
    if (this.patchPlanMode) {
      throw new Error("Binary mutations require direct-process mode; patch-plan cannot safely represent binary output.");
    }
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    return this.writeContent(relativePath, buffer, { kind, encoding: "binary" });
  }
  writeContent(relativePath, content, { kind, encoding }) {
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    const existing = this.operationsByPath.get(normalized);
    const initial = existing ? { exists: existing.previousExists, sha256: existing.previousSha256 } : diskFileState(this.root, normalized);
    const operation = {
      operationId: existing?.operationId ?? `op-${crypto.randomUUID()}`,
      mutationId: this.id,
      actionId: this.actionId,
      relativePath: normalized,
      kind,
      encoding,
      ...encoding === "utf8" ? { content } : { byteLength: content.byteLength },
      previousExists: initial.exists,
      previousSha256: initial.sha256,
      expectedPreviousSha256: initial.sha256,
      nextSha256: sha256(content),
      scope: classifyScope(normalized),
      rollbackEligibility: this.patchPlanMode ? "host-tracked-file-edits-required" : "direct-process-unverified"
    };
    if (!existing) {
      this.operationOrder.push(normalized);
    }
    this.operationsByPath.set(normalized, operation);
    if (encoding === "utf8") {
      this.overlay.set(normalized, content);
    }
    if (!this.patchPlanMode) {
      fs4.mkdirSync(path4.dirname(fullPath), { recursive: true });
      fs4.writeFileSync(fullPath, content, encoding === "utf8" ? "utf8" : void 0);
    }
    return operation;
  }
  appendText(relativePath, content) {
    const previous = this.readText(relativePath, "");
    return this.writeText(relativePath, `${previous}${String(content ?? "")}`, "append-as-write");
  }
  ensureFile(relativePath, content) {
    if (this.fileExists(relativePath)) {
      return false;
    }
    this.writeText(relativePath, content, "ensure-file");
    return true;
  }
  ensureDirectory(relativePath) {
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    if (fs4.existsSync(fullPath) || this.operationsByPath.has(normalized)) {
      return false;
    }
    const operation = {
      operationId: `op-${crypto.randomUUID()}`,
      mutationId: this.id,
      actionId: this.actionId,
      relativePath: normalized,
      kind: "ensure-directory",
      encoding: null,
      previousExists: false,
      previousSha256: null,
      expectedPreviousSha256: null,
      nextSha256: null,
      scope: classifyScope(normalized),
      rollbackEligibility: this.patchPlanMode ? "host-tracked-file-edits-required" : "direct-process-unverified"
    };
    this.operationOrder.push(normalized);
    this.operationsByPath.set(normalized, operation);
    if (!this.patchPlanMode) {
      fs4.mkdirSync(fullPath, { recursive: true });
    }
    return true;
  }
  operations() {
    return this.operationOrder.map((relativePath) => this.operationsByPath.get(relativePath)).filter(Boolean);
  }
  summary(options = {}) {
    const operations = this.operations();
    const writesApplied = options.writesApplied ?? (!this.patchPlanMode && operations.length > 0);
    return {
      mutationId: this.id,
      actionId: this.actionId,
      mutationMode: this.mutationMode,
      mutationModeSource: this.mutationModeSource,
      writesApplied,
      operationCount: operations.length,
      paths: operations.map((operation) => operation.relativePath),
      directoryEffectCount: operations.filter((operation) => operation.kind === "ensure-directory").length,
      directoryPaths: operations.filter((operation) => operation.kind === "ensure-directory").map((operation) => operation.relativePath),
      hostRollbackEligible: this.patchPlanMode,
      hostRollbackIneligibleReason: this.patchPlanMode ? null : DIRECT_PROCESS_ROLLBACK_REASON,
      recommendedMutationMode: this.patchPlanMode ? null : "patch-plan",
      rollbackAdvice: this.patchPlanMode ? null : PATCH_PLAN_ROLLBACK_ADVICE,
      externalWriteCaptureVerified: false,
      doveRestoreSupported: false
    };
  }
  finish(result = {}) {
    this.assertActive("MutationContext finish");
    const operations = this.operations();
    const writesApplied = !this.patchPlanMode && (operations.length > 0 || resultDeclaresWrites(result));
    const metadata = {
      mutationId: this.id,
      mutationMode: this.mutationMode,
      mutationModeSource: this.mutationModeSource,
      writesApplied,
      hostRollbackEligible: this.patchPlanMode,
      hostTrackedFileEditsRequired: this.patchPlanMode,
      directProcessWritesAreRollbackSafe: false,
      externalWriteCaptureVerified: false,
      doveRestoreSupported: false,
      hostRollbackIneligibleReason: this.patchPlanMode ? null : DIRECT_PROCESS_ROLLBACK_REASON,
      recommendedMutationMode: this.patchPlanMode ? null : "patch-plan",
      rollbackAdvice: this.patchPlanMode ? null : PATCH_PLAN_ROLLBACK_ADVICE,
      mutationSummary: this.summary({ writesApplied })
    };
    if (this.patchPlanMode) {
      metadata.mutationPlan = {
        presentation: "dove-mutation-plan",
        mutationId: this.id,
        actionId: this.actionId,
        hostId: this.hostId,
        workspaceRealpath: fs4.realpathSync.native(this.root),
        mutationModeSource: this.mutationModeSource,
        createdAt: this.createdAt,
        writesApplied: false,
        hostTrackedFileEditsRequired: true,
        directProcessWritesAreRollbackSafe: false,
        externalWriteCaptureVerified: false,
        doveRestoreSupported: false,
        operations
      };
    }
    this.lifecycle = "finished";
    if (result && typeof result === "object" && !Array.isArray(result)) {
      return { ...result, ...metadata };
    }
    return { result, ...metadata };
  }
  abort() {
    if (this.lifecycle === "active") {
      this.lifecycle = "aborted";
    }
  }
};
function createMutationContext(root, options = {}) {
  return new MutationContext(root, options);
}
function runWithMutationContext(root, options, callback) {
  const context = createMutationContext(root, options);
  return mutationStorage.run(context, () => {
    try {
      const result = callback(context);
      if (result && typeof result.then === "function") {
        return result.then(
          (resolved) => context.finish(resolved),
          (error) => {
            context.abort();
            throw error;
          }
        );
      }
      return context.finish(result);
    } catch (error) {
      context.abort();
      throw error;
    }
  });
}
function currentMutationContext(root) {
  const context = mutationStorage.getStore();
  if (!context || context.lifecycle !== "active") {
    return null;
  }
  if (root) {
    try {
      if (fs4.realpathSync.native(path4.resolve(root)) !== context.root) {
        return null;
      }
    } catch {
      return null;
    }
  }
  return context;
}
function isPatchPlanMode(root) {
  return currentMutationContext(root)?.patchPlanMode === true;
}

// src/core/workspace.mjs
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function resolvePath(root, relativePath) {
  return path5.join(root, relativePath);
}
function cloneFallback(fallback) {
  return typeof fallback === "function" ? fallback() : structuredClone(fallback);
}
function requireMutationContext(root, operation) {
  const context = currentMutationContext(root);
  if (!context) throw new Error(`${operation} requires an active MutationContext.`);
  return context;
}
function readJson(root, relativePath, fallback) {
  const context = currentMutationContext(root);
  if (context) return context.readJson(relativePath, fallback);
  const fullPath = resolvePath(root, relativePath);
  if (!fs5.existsSync(fullPath)) return cloneFallback(fallback);
  try {
    return JSON.parse(fs5.readFileSync(fullPath, "utf8"));
  } catch (error) {
    throw new Error(`Malformed JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function writeJson(root, relativePath, value2) {
  return requireMutationContext(root, "writeJson").writeJson(relativePath, value2);
}
function writeText(root, relativePath, content) {
  return requireMutationContext(root, "writeText").writeText(relativePath, content);
}
function assertGovernanceMutationRegistered(actionId, expectedMode) {
  const guarded = new Set(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.id));
  const exempt = new Map(GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => [entry.id, entry]));
  if (expectedMode === "guarded") {
    if (!guarded.has(actionId)) throw new Error(`Governance registry missing guarded mutation entry: ${actionId}`);
    return;
  }
  if (expectedMode === "exempt") {
    const entry = exempt.get(actionId);
    if (!entry) throw new Error(`Governance registry missing exempt mutation entry: ${actionId}`);
    if (entry.sunsetAt && entry.sunsetAt <= nowIso()) throw new Error(`Governance exempt entry expired: ${actionId}`);
    return;
  }
  throw new Error(`Unknown governance mutation mode: ${expectedMode}`);
}

// src/core/workspace-schema.mjs
import crypto2 from "node:crypto";
import fs6 from "node:fs";
import path6 from "node:path";
var DOVE_MANIFEST_SCHEMA_VERSION = 1;
var DOVE_PROJECT_SCHEMA_VERSION = 1;
var DOVE_TRUST_SCHEMA_VERSION = 1;
var MINIMAL_WORKSPACE_DIRECTORIES = Object.freeze([
  ".dove/missions",
  ".dove/artifacts",
  ".dove/receipts",
  ".dove/receipts/execution",
  ".dove/receipts/completion",
  ".dove/receipts/authority",
  ".dove/sources",
  ".dove/notes",
  ".dove/claims",
  ".dove/experiments",
  ".dove/drafts",
  ".dove/figures",
  ".dove/reviews",
  ".dove/reviews/exchanges",
  ".dove/rebuttal",
  ".dove/versions"
]);
var MINIMAL_WORKSPACE_REQUIRED_FILES = Object.freeze([
  ".dove/manifest.json",
  ".dove/project.json",
  ".dove/artifacts/ownership.json",
  ".dove/artifacts/lineage.json"
]);
var CURRENT_SCHEMA_FORBIDDEN_LEGACY_PATHS = Object.freeze([
  ".dove/state.json",
  ".dove/task-packets",
  ".dove/orchestration",
  ".dove/runtime",
  ".dove/workspace",
  ".dove/mutations",
  ".dove/programs",
  ".dove/meta",
  ".dove/context",
  ".dove/wiki"
]);
var MANIFEST_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "manifestVersion", "workspaceId", "createdAt", "packageVersion"]);
var PROJECT_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "projectId", "goal", "trust", "createdAt", "updatedAt"]);
var TRUST_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "entries"]);
var INDEX_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "artifacts", "updatedAt"]);
var INDEX_ITEM_FIELDS = /* @__PURE__ */ new Set(["path", "kind", "sha256", "missionId", "contractDigest", "receiptId"]);
var LINEAGE_ITEM_FIELDS = /* @__PURE__ */ new Set([...INDEX_ITEM_FIELDS, "derivedReferences"]);
var MISSION_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "missionId", "contractDigest", "createdAt", "scope", "outOfScope", "targetArtifacts", "expectedArtifacts", "completionCriteria", "evidenceRequirements", "dependsOnMissionIds", "goal", "supersedesMissionId", "completionCriterionIds", "evidenceRequirementIds"]);
var RECEIPT_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "receiptId", "missionId", "contractDigest", "summary", "artifacts", "validations", "criteriaSatisfied", "producedAt"]);
var RECEIPT_ARTIFACT_FIELDS = /* @__PURE__ */ new Set(["path", "kind", "sha256"]);
var RECEIPT_VALIDATION_FIELDS = /* @__PURE__ */ new Set(["kind", "reference", "outputHash"]);
var RECEIPT_CRITERION_FIELDS = /* @__PURE__ */ new Set(["criterionId", "evidenceRefs"]);
var LESSON_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "lessonId", "missionId", "contractDigest", "scope", "kind", "summary", "details", "nextTimeGuidance", "sourceIds", "noteIds", "artifactRefs", "appliesToArtifactRefs", "tags", "supersedesLessonId", "createdAt"]);
var LESSON_REF_FIELDS = /* @__PURE__ */ new Set(["path", "sha256"]);
var LESSON_SCOPES = /* @__PURE__ */ new Set(["global", "mission"]);
var LESSON_KINDS = /* @__PURE__ */ new Set(["preference", "constraint", "method", "failure", "review-insight"]);
var SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH = /^[0-9a-f]{64}$/u;
var ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
function sha2562(value2) {
  return crypto2.createHash("sha256").update(value2).digest("hex");
}
function stableValue(value2) {
  if (Array.isArray(value2)) return value2.map(stableValue);
  if (value2 && typeof value2 === "object") {
    return Object.fromEntries(Object.entries(value2).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value2;
}
function stableWorkspaceSerialize(value2) {
  return JSON.stringify(stableValue(value2));
}
function workspaceDigest(value2) {
  return sha2562(stableWorkspaceSerialize(value2));
}
function canonicalWorkspacePath(root) {
  return fs6.realpathSync.native(path6.resolve(root));
}
function assertPlainObject(value2, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertSealed(value2, fields, label) {
  assertPlainObject(value2, label);
  const unknown = Object.keys(value2).filter((field) => !fields.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function exactIso(value2, label) {
  if (typeof value2 !== "string" || !ISO_TIMESTAMP.test(value2) || !Number.isFinite(Date.parse(value2)) || new Date(Date.parse(value2)).toISOString() !== value2) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value2;
}
function safeId(value2, label) {
  if (typeof value2 !== "string" || !SAFE_ID.test(value2)) {
    throw new Error(`${label} must be a safe lowercase identifier.`);
  }
  return value2;
}
function pathExistsNoFollow(fullPath) {
  try {
    fs6.lstatSync(fullPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
function readJsonStrict(fullPath, label) {
  let text;
  try {
    text = fs6.readFileSync(fullPath, "utf8");
  } catch (error) {
    throw new Error(`${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Malformed durable JSON in ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function validateDoveManifest(value2) {
  assertSealed(value2, MANIFEST_FIELDS, "Dove manifest");
  if (value2.schemaVersion !== DOVE_WORKSPACE_SCHEMA_VERSION) {
    throw new Error(`Dove manifest schemaVersion ${value2.schemaVersion ?? "missing"} is unsupported; expected ${DOVE_WORKSPACE_SCHEMA_VERSION}.`);
  }
  if (value2.manifestVersion !== DOVE_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Dove manifest manifestVersion ${value2.manifestVersion ?? "missing"} is unsupported.`);
  }
  safeId(value2.workspaceId, "Dove manifest workspaceId");
  exactIso(value2.createdAt, "Dove manifest createdAt");
  if (typeof value2.packageVersion !== "string" || !value2.packageVersion.trim()) {
    throw new Error("Dove manifest packageVersion must be a non-empty string.");
  }
  return value2;
}
function validateDoveTrustConfig(value2) {
  assertSealed(value2, TRUST_FIELDS, "Dove project trust config");
  if (value2.schemaVersion !== DOVE_TRUST_SCHEMA_VERSION) {
    throw new Error(`Dove project trust schemaVersion ${value2.schemaVersion ?? "missing"} is unsupported.`);
  }
  if (!Array.isArray(value2.entries) || value2.entries.length !== 0) {
    throw new Error("Dove project trust entries must be an empty sealed array until a trust schema is explicitly introduced.");
  }
  return value2;
}
function validateDoveProject(value2, manifest) {
  assertSealed(value2, PROJECT_FIELDS, "Dove project identity");
  if (value2.schemaVersion !== DOVE_PROJECT_SCHEMA_VERSION) {
    throw new Error(`Dove project schemaVersion ${value2.schemaVersion ?? "missing"} is unsupported.`);
  }
  safeId(value2.workspaceId, "Dove project workspaceId");
  safeId(value2.projectId, "Dove project projectId");
  if (value2.workspaceId !== manifest.workspaceId) {
    throw new Error("Dove project workspaceId does not match the manifest workspaceId.");
  }
  if (value2.projectId !== `project-${manifest.workspaceId}`) {
    throw new Error("Dove project projectId does not match the manifest identity.");
  }
  if (typeof value2.goal !== "string" || !value2.goal.trim()) {
    throw new Error("Dove project goal must be a non-empty string.");
  }
  exactIso(value2.createdAt, "Dove project createdAt");
  exactIso(value2.updatedAt, "Dove project updatedAt");
  if (value2.createdAt !== manifest.createdAt) {
    throw new Error("Dove project createdAt must match the manifest createdAt.");
  }
  validateDoveTrustConfig(value2.trust);
  return value2;
}
function exactOptionalIso(value2, label) {
  if (value2 === null) return null;
  return exactIso(value2, label);
}
function hash(value2, label) {
  if (typeof value2 !== "string" || !HASH.test(value2)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return value2;
}
function nonEmptyString(value2, label) {
  if (typeof value2 !== "string" || !value2.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value2;
}
function stringArray(value2, label) {
  if (!Array.isArray(value2) || value2.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  if (new Set(value2).size !== value2.length) throw new Error(`${label} must not contain duplicates.`);
  return value2;
}
function validateOwnershipShape(value2, label, manifest, lineage = false) {
  assertSealed(value2, INDEX_FIELDS, label);
  if (value2.schemaVersion !== 1) throw new Error(`${label} has an unsupported schemaVersion.`);
  safeId(value2.workspaceId, `${label}.workspaceId`);
  if (value2.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  if (!Array.isArray(value2.artifacts)) throw new Error(`${label}.artifacts must be an array.`);
  exactOptionalIso(value2.updatedAt, `${label}.updatedAt`);
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of value2.artifacts.entries()) {
    const itemLabel = `${label}.artifacts[${index}]`;
    assertSealed(item, lineage ? LINEAGE_ITEM_FIELDS : INDEX_ITEM_FIELDS, itemLabel);
    nonEmptyString(item.path, `${itemLabel}.path`);
    nonEmptyString(item.kind, `${itemLabel}.kind`);
    hash(item.sha256, `${itemLabel}.sha256`);
    safeId(item.missionId, `${itemLabel}.missionId`);
    hash(item.contractDigest, `${itemLabel}.contractDigest`);
    safeId(item.receiptId, `${itemLabel}.receiptId`);
    if (seen.has(item.path)) throw new Error(`${label}.artifacts contains duplicate path ${item.path}.`);
    seen.add(item.path);
    if (lineage) stringArray(item.derivedReferences, `${itemLabel}.derivedReferences`);
  }
  return value2;
}
function validateMissionShape(value2, manifest, label) {
  assertSealed(value2, MISSION_FIELDS, label);
  if (value2.schemaVersion !== 1) throw new Error(`${label} has an unsupported schemaVersion.`);
  safeId(value2.workspaceId, `${label}.workspaceId`);
  if (value2.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  safeId(value2.missionId, `${label}.missionId`);
  hash(value2.contractDigest, `${label}.contractDigest`);
  exactIso(value2.createdAt, `${label}.createdAt`);
  nonEmptyString(value2.goal, `${label}.goal`);
  for (const field of ["scope", "outOfScope", "targetArtifacts", "expectedArtifacts", "completionCriteria", "evidenceRequirements", "completionCriterionIds", "evidenceRequirementIds"]) {
    stringArray(value2[field], `${label}.${field}`);
  }
  if (value2.dependsOnMissionIds !== void 0) stringArray(value2.dependsOnMissionIds, `${label}.dependsOnMissionIds`);
  if (value2.supersedesMissionId !== void 0) safeId(value2.supersedesMissionId, `${label}.supersedesMissionId`);
  return value2;
}
function validateLessonReferenceArray(value2, label) {
  if (!Array.isArray(value2)) throw new Error(`${label} must be an array.`);
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of value2.entries()) {
    const itemLabel = `${label}[${index}]`;
    assertSealed(item, LESSON_REF_FIELDS, itemLabel);
    nonEmptyString(item.path, `${itemLabel}.path`);
    hash(item.sha256, `${itemLabel}.sha256`);
    if (seen.has(item.path)) throw new Error(`${label} contains duplicate path ${item.path}.`);
    seen.add(item.path);
  }
  return value2;
}
function validateLessonShape(value2, manifest, label, context = {}) {
  assertSealed(value2, LESSON_FIELDS, label);
  if (value2.schemaVersion !== 1) throw new Error(`${label} has an unsupported schemaVersion.`);
  safeId(value2.workspaceId, `${label}.workspaceId`);
  if (value2.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  const lessonId = safeId(value2.lessonId, `${label}.lessonId`);
  const expectedFilename = `${lessonId}.json`;
  if (path6.posix.basename(label) !== expectedFilename) throw new Error(`${label} filename must match lessonId ${lessonId}.`);
  const missionId = safeId(value2.missionId, `${label}.missionId`);
  hash(value2.contractDigest, `${label}.contractDigest`);
  if (!LESSON_SCOPES.has(value2.scope)) throw new Error(`${label}.scope must be global or mission.`);
  if (!LESSON_KINDS.has(value2.kind)) throw new Error(`${label}.kind is unsupported.`);
  nonEmptyString(value2.summary, `${label}.summary`);
  if (value2.details !== void 0) nonEmptyString(value2.details, `${label}.details`);
  stringArray(value2.nextTimeGuidance, `${label}.nextTimeGuidance`);
  if (value2.nextTimeGuidance.length === 0) throw new Error(`${label}.nextTimeGuidance must contain at least one item.`);
  stringArray(value2.sourceIds, `${label}.sourceIds`);
  stringArray(value2.noteIds, `${label}.noteIds`);
  validateLessonReferenceArray(value2.artifactRefs, `${label}.artifactRefs`);
  validateLessonReferenceArray(value2.appliesToArtifactRefs, `${label}.appliesToArtifactRefs`);
  stringArray(value2.tags, `${label}.tags`);
  if (value2.supersedesLessonId !== void 0) {
    safeId(value2.supersedesLessonId, `${label}.supersedesLessonId`);
    if (value2.supersedesLessonId === lessonId) throw new Error(`${label} must not supersede itself.`);
  }
  exactIso(value2.createdAt, `${label}.createdAt`);
  const mission = context.missions?.get(missionId);
  if (!mission) throw new Error(`${label} references unknown mission ${missionId}.`);
  if (mission.contractDigest !== value2.contractDigest) throw new Error(`${label}.contractDigest does not match mission ${missionId}.`);
  return value2;
}
function validateLessonSupersession(lessons) {
  const successorByLesson = /* @__PURE__ */ new Map();
  for (const lesson of lessons.values()) {
    if (!lesson.supersedesLessonId) continue;
    const previous = lessons.get(lesson.supersedesLessonId);
    if (!previous) throw new Error(`Lesson ${lesson.lessonId} supersedes unknown lesson ${lesson.supersedesLessonId}.`);
    if (previous.scope !== lesson.scope || previous.kind !== lesson.kind) throw new Error(`Lesson ${lesson.lessonId} must supersede a lesson with the same scope and kind.`);
    if (lesson.scope === "mission" && previous.missionId !== lesson.missionId) throw new Error(`Mission-scoped lesson ${lesson.lessonId} must supersede a lesson from the same mission.`);
    if (successorByLesson.has(previous.lessonId)) throw new Error(`Lesson supersession forks at ${previous.lessonId}.`);
    successorByLesson.set(previous.lessonId, lesson.lessonId);
  }
  for (const lessonId of lessons.keys()) {
    const seen = /* @__PURE__ */ new Set();
    let current = lessonId;
    while (current) {
      if (seen.has(current)) throw new Error(`Lesson supersession contains a cycle at ${current}.`);
      seen.add(current);
      current = lessons.get(current)?.supersedesLessonId ?? null;
    }
  }
}
function validateReceiptShape(value2, manifest, label) {
  assertSealed(value2, RECEIPT_FIELDS, label);
  if (value2.schemaVersion !== 1) throw new Error(`${label} has an unsupported schemaVersion.`);
  safeId(value2.workspaceId, `${label}.workspaceId`);
  if (value2.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  safeId(value2.receiptId, `${label}.receiptId`);
  safeId(value2.missionId, `${label}.missionId`);
  hash(value2.contractDigest, `${label}.contractDigest`);
  nonEmptyString(value2.summary, `${label}.summary`);
  exactIso(value2.producedAt, `${label}.producedAt`);
  if (!Array.isArray(value2.artifacts) || value2.artifacts.length === 0) throw new Error(`${label}.artifacts must contain at least one item.`);
  if (!Array.isArray(value2.validations)) throw new Error(`${label}.validations must be an array.`);
  if (!Array.isArray(value2.criteriaSatisfied)) throw new Error(`${label}.criteriaSatisfied must be an array.`);
  for (const [index, item] of value2.artifacts.entries()) {
    const itemLabel = `${label}.artifacts[${index}]`;
    assertSealed(item, RECEIPT_ARTIFACT_FIELDS, itemLabel);
    nonEmptyString(item.path, `${itemLabel}.path`);
    nonEmptyString(item.kind, `${itemLabel}.kind`);
    hash(item.sha256, `${itemLabel}.sha256`);
  }
  for (const [index, item] of value2.validations.entries()) {
    const itemLabel = `${label}.validations[${index}]`;
    assertSealed(item, RECEIPT_VALIDATION_FIELDS, itemLabel);
    nonEmptyString(item.kind, `${itemLabel}.kind`);
    nonEmptyString(item.reference, `${itemLabel}.reference`);
    hash(item.outputHash, `${itemLabel}.outputHash`);
  }
  for (const [index, item] of value2.criteriaSatisfied.entries()) {
    const itemLabel = `${label}.criteriaSatisfied[${index}]`;
    assertSealed(item, RECEIPT_CRITERION_FIELDS, itemLabel);
    nonEmptyString(item.criterionId, `${itemLabel}.criterionId`);
    stringArray(item.evidenceRefs, `${itemLabel}.evidenceRefs`);
  }
  return value2;
}
function validateJsonDirectory(root, relativeDirectory, manifest, validate, context = {}) {
  const directory = path6.join(root, relativeDirectory);
  const values = [];
  for (const entry of fs6.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) throw new Error(`${path6.posix.join(relativeDirectory, entry.name)} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${path6.posix.join(relativeDirectory, entry.name)} must be a regular JSON file.`);
    const relativePath = path6.posix.join(relativeDirectory, entry.name);
    values.push(validate(readJsonStrict(path6.join(root, relativePath), relativePath), manifest, relativePath, context));
  }
  return values;
}
function requiredPathProblem(root, relativePath, kind) {
  const fullPath = path6.join(root, relativePath);
  if (!fs6.existsSync(fullPath)) return `${relativePath} is missing`;
  const stat = fs6.lstatSync(fullPath);
  if (stat.isSymbolicLink()) return `${relativePath} must not be a symbolic link`;
  if (kind === "directory" && !stat.isDirectory()) return `${relativePath} must be a directory`;
  if (kind === "file" && !stat.isFile()) return `${relativePath} must be a regular file`;
  return null;
}
function sourceIdentity(doveRoot) {
  const stat = fs6.lstatSync(doveRoot, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(".dove must be a real directory; symbolic-link workspace roots are not accepted.");
  }
  return {
    kind: "directory",
    device: String(stat.dev),
    inode: String(stat.ino),
    mode: Number(stat.mode),
    ctimeNs: String(stat.ctimeNs),
    mtimeNs: String(stat.mtimeNs)
  };
}
function treeEntries(doveRoot) {
  const entries = [];
  const visit = (directory, prefix = "") => {
    for (const entry of fs6.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? path6.posix.join(prefix, entry.name) : entry.name;
      const fullPath = path6.join(directory, entry.name);
      const stat = fs6.lstatSync(fullPath, { bigint: true });
      const metadata = {
        path: relativePath,
        device: String(stat.dev),
        inode: String(stat.ino),
        mode: Number(stat.mode),
        ctimeNs: String(stat.ctimeNs),
        mtimeNs: String(stat.mtimeNs)
      };
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "directory" });
        visit(fullPath, relativePath);
      } else if (stat.isFile()) {
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha2562(fs6.readFileSync(fullPath)) });
      } else if (stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "symlink", target: fs6.readlinkSync(fullPath) });
      } else {
        throw new Error(`Unsupported filesystem entry inside .dove: ${relativePath}.`);
      }
    }
  };
  visit(doveRoot);
  return entries;
}
function inspectDoveSourceTree(root) {
  const workspace = canonicalWorkspacePath(root);
  const doveRoot = path6.join(workspace, ".dove");
  if (!pathExistsNoFollow(doveRoot)) return null;
  const identity = sourceIdentity(doveRoot);
  const entries = treeEntries(doveRoot);
  return {
    identity,
    entryCount: entries.length,
    treeDigest: workspaceDigest(entries)
  };
}
function detectedVersionLabel(value2) {
  if (Number.isInteger(value2)) return String(value2);
  if (value2 === void 0) return "missing";
  return "invalid";
}
function inspectDoveWorkspace(root) {
  const workspace = canonicalWorkspacePath(root);
  const doveRoot = path6.join(workspace, ".dove");
  if (!pathExistsNoFollow(doveRoot)) {
    return { workspace, state: "absent", category: "absent", healthy: false, schemaVersion: null, detectedSchema: "absent" };
  }
  let source;
  try {
    source = { identity: sourceIdentity(doveRoot) };
  } catch (error) {
    return { workspace, state: "invalid-root", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: "invalid-root", error: error instanceof Error ? error.message : String(error) };
  }
  const manifestPath = path6.join(doveRoot, "manifest.json");
  if (!fs6.existsSync(manifestPath)) {
    return { workspace, state: "legacy-missing-manifest", category: "legacy", healthy: false, schemaVersion: null, detectedSchema: "missing-manifest", source };
  }
  let manifest;
  try {
    manifest = readJsonStrict(manifestPath, ".dove/manifest.json");
  } catch (error) {
    return { workspace, state: "malformed-manifest", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: "malformed", source, error: error instanceof Error ? error.message : String(error) };
  }
  const version = manifest?.schemaVersion;
  const retainedLegacyAuthorityManifest = version === void 0 && Number.isInteger(manifest?.version);
  if (retainedLegacyAuthorityManifest) {
    return { workspace, state: "legacy-authority-manifest", category: "legacy", healthy: false, schemaVersion: manifest.version, detectedSchema: `legacy-authority-${manifest.version}`, source, manifest };
  }
  if (!Number.isInteger(version)) {
    return { workspace, state: "invalid-manifest-version", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: detectedVersionLabel(version), source, manifest };
  }
  if (version < DOVE_WORKSPACE_SCHEMA_VERSION) {
    return { workspace, state: "legacy-version", category: "legacy", healthy: false, schemaVersion: version, detectedSchema: String(version), source, manifest };
  }
  if (version > DOVE_WORKSPACE_SCHEMA_VERSION) {
    return { workspace, state: "future-version", category: "future", healthy: false, schemaVersion: version, detectedSchema: String(version), source, manifest };
  }
  try {
    validateDoveManifest(manifest);
    const problems = [
      ...MINIMAL_WORKSPACE_DIRECTORIES.map((relativePath) => requiredPathProblem(workspace, relativePath, "directory")),
      ...MINIMAL_WORKSPACE_REQUIRED_FILES.map((relativePath) => requiredPathProblem(workspace, relativePath, "file")),
      ...CURRENT_SCHEMA_FORBIDDEN_LEGACY_PATHS.filter((relativePath) => fs6.existsSync(path6.join(workspace, relativePath))).map((relativePath) => `${relativePath} is a retained legacy artifact and must not coexist with current schema ${DOVE_WORKSPACE_SCHEMA_VERSION}`)
    ].filter(Boolean);
    if (problems.length > 0) throw new Error(`Dove schema declaration contradicts required layout: ${problems.join("; ")}.`);
    const project = validateDoveProject(readJsonStrict(path6.join(doveRoot, "project.json"), ".dove/project.json"), manifest);
    validateOwnershipShape(readJsonStrict(path6.join(doveRoot, "artifacts", "ownership.json"), ".dove/artifacts/ownership.json"), "Artifact ownership index", manifest);
    validateOwnershipShape(readJsonStrict(path6.join(doveRoot, "artifacts", "lineage.json"), ".dove/artifacts/lineage.json"), "Artifact lineage index", manifest, true);
    const missions = new Map(validateJsonDirectory(workspace, ".dove/missions", manifest, validateMissionShape).map((mission) => [mission.missionId, mission]));
    validateJsonDirectory(workspace, ".dove/receipts/execution", manifest, validateReceiptShape);
    const lessonsDirectory = path6.join(workspace, ".dove/lessons");
    if (pathExistsNoFollow(lessonsDirectory)) {
      const stat = fs6.lstatSync(lessonsDirectory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(".dove/lessons must be a real directory when present.");
      const lessons = new Map(validateJsonDirectory(workspace, ".dove/lessons", manifest, validateLessonShape, { missions }).map((lesson) => [lesson.lessonId, lesson]));
      validateLessonSupersession(lessons);
    }
    for (const relativeDirectory of [".dove/receipts/completion", ".dove/receipts/authority"]) {
      const entries = fs6.readdirSync(path6.join(workspace, relativeDirectory));
      if (entries.length > 0) {
        throw new Error(`${relativeDirectory} must remain empty until its sealed schema is introduced.`);
      }
    }
    return { workspace, state: "current-healthy", category: "current", healthy: true, schemaVersion: version, detectedSchema: String(version), source, manifest, project };
  } catch (error) {
    return { workspace, state: "current-unhealthy", category: "invalid", healthy: false, schemaVersion: version, detectedSchema: String(version), source, manifest, error: error instanceof Error ? error.message : String(error) };
  }
}
function workspaceSchemaError(inspection, operation = "Dove operation") {
  if (inspection.state === "absent") {
    return new Error(`${operation} requires a current Dove workspace. Run confirmed dove init first.`);
  }
  if (inspection.category === "legacy") {
    return new Error(`${operation} cannot open legacy Dove schema state (${inspection.state}, detected ${inspection.detectedSchema}). Run dove init --archive-reset and confirm the exact proposal.`);
  }
  if (inspection.category === "future") {
    return new Error(`${operation} refuses future Dove schema ${inspection.detectedSchema}; install a compatible Dove version. No files were changed.`);
  }
  return new Error(`${operation} refuses invalid Dove workspace state ${inspection.state}${inspection.error ? `: ${inspection.error}` : ""}. Run dove init --archive-reset and confirm the exact proposal. No files were changed.`);
}
function openDoveWorkspace(root, options = {}) {
  const inspection = inspectDoveWorkspace(root);
  if (inspection.healthy) return inspection;
  if (inspection.state === "absent" && options.allowAbsent === true) return inspection;
  throw workspaceSchemaError(inspection, options.operation);
}
function createMinimalWorkspaceDocuments({ workspaceId, goal, createdAt }) {
  safeId(workspaceId, "workspaceId");
  exactIso(createdAt, "createdAt");
  if (typeof goal !== "string" || !goal.trim()) throw new Error("Dove init requires a non-empty goal.");
  const manifest = {
    schemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION,
    manifestVersion: DOVE_MANIFEST_SCHEMA_VERSION,
    workspaceId,
    createdAt,
    packageVersion: PACKAGE_VERSION
  };
  const project = {
    schemaVersion: DOVE_PROJECT_SCHEMA_VERSION,
    workspaceId,
    projectId: `project-${workspaceId}`,
    goal: goal.trim(),
    trust: { schemaVersion: DOVE_TRUST_SCHEMA_VERSION, entries: [] },
    createdAt,
    updatedAt: createdAt
  };
  return {
    manifest,
    project,
    ownership: { schemaVersion: 1, workspaceId, artifacts: [], updatedAt: null },
    lineage: { schemaVersion: 1, workspaceId, artifacts: [], updatedAt: null }
  };
}
function newWorkspaceId() {
  return `workspace-${crypto2.randomUUID()}`;
}
function writeJsonAtomicContent(targetPath, value2, ops) {
  ops.writeFileSync(targetPath, `${JSON.stringify(value2, null, 2)}
`, "utf8");
}
function materializeMinimalWorkspaceDirectory(directory, documents, options = {}) {
  const ops = options.fsOps ?? fs6;
  ops.mkdirSync(directory, { recursive: false });
  for (const relativePath of MINIMAL_WORKSPACE_DIRECTORIES.map((item) => item.slice(".dove/".length))) {
    ops.mkdirSync(path6.join(directory, relativePath), { recursive: true });
  }
  writeJsonAtomicContent(path6.join(directory, "manifest.json"), documents.manifest, ops);
  writeJsonAtomicContent(path6.join(directory, "project.json"), documents.project, ops);
  writeJsonAtomicContent(path6.join(directory, "artifacts", "ownership.json"), documents.ownership, ops);
  writeJsonAtomicContent(path6.join(directory, "artifacts", "lineage.json"), documents.lineage, ops);
}
function archiveTargetFor({ workspace, detectedSchema, treeDigest }) {
  const schemaLabel = String(detectedSchema ?? "invalid").replace(/[^a-z0-9._-]+/giu, "-").toLowerCase();
  return path6.join(workspace, ".dove-archive", `schema-${schemaLabel}-${String(treeDigest).slice(0, 24)}`);
}

// src/core/artifact-lineage.mjs
var ARTIFACT_OWNERSHIP_SCHEMA_VERSION = 1;
var ARTIFACT_LINEAGE_SCHEMA_VERSION = 1;
var OWNERSHIP_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "artifacts", "updatedAt"]);
var LINEAGE_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "artifacts", "updatedAt"]);
var OWNERSHIP_ITEM_FIELDS = /* @__PURE__ */ new Set(["path", "kind", "sha256", "missionId", "contractDigest", "receiptId"]);
var LINEAGE_ITEM_FIELDS2 = /* @__PURE__ */ new Set([...OWNERSHIP_ITEM_FIELDS, "derivedReferences"]);
var HASH_PATTERN = /^[0-9a-f]{64}$/u;
function createArtifactOwnershipIndex(workspaceId = null) {
  return {
    schemaVersion: ARTIFACT_OWNERSHIP_SCHEMA_VERSION,
    workspaceId,
    artifacts: [],
    updatedAt: null
  };
}
function createArtifactLineageIndex(workspaceId = null) {
  return {
    schemaVersion: ARTIFACT_LINEAGE_SCHEMA_VERSION,
    workspaceId,
    artifacts: [],
    updatedAt: null
  };
}
function assertPlainObject2(value2, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertAllowedFields(value2, allowed, label) {
  assertPlainObject2(value2, label);
  const unknown = Object.keys(value2).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function assertString(value2, label) {
  if (typeof value2 !== "string" || !value2.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value2.trim();
}
function normalizeIndex(value2, { label, schemaVersion, workspaceId, fields, itemFields, lineage = false }) {
  assertAllowedFields(value2, fields, label);
  if (value2.schemaVersion !== schemaVersion) {
    throw new Error(`${label} has an unsupported schemaVersion.`);
  }
  if (typeof value2.workspaceId !== "string" || value2.workspaceId !== workspaceId) {
    throw new Error(`${label}.workspaceId does not match the current manifest workspaceId.`);
  }
  if (!Array.isArray(value2.artifacts)) throw new Error(`${label}.artifacts must be an array.`);
  if (value2.updatedAt !== null && typeof value2.updatedAt !== "string") throw new Error(`${label}.updatedAt must be a string or null.`);
  const seen = /* @__PURE__ */ new Set();
  const artifacts = value2.artifacts.map((item, index) => {
    const itemLabel = `${label}.artifacts[${index}]`;
    assertAllowedFields(item, itemFields, itemLabel);
    const normalized = {
      path: assertString(item.path, `${itemLabel}.path`),
      kind: assertString(item.kind, `${itemLabel}.kind`),
      sha256: assertString(item.sha256, `${itemLabel}.sha256`).toLowerCase(),
      missionId: assertString(item.missionId, `${itemLabel}.missionId`),
      contractDigest: assertString(item.contractDigest, `${itemLabel}.contractDigest`).toLowerCase(),
      receiptId: assertString(item.receiptId, `${itemLabel}.receiptId`)
    };
    if (!HASH_PATTERN.test(normalized.sha256) || !HASH_PATTERN.test(normalized.contractDigest)) {
      throw new Error(`${itemLabel} contains an invalid SHA-256 digest.`);
    }
    if (seen.has(normalized.path)) throw new Error(`${label}.artifacts contains duplicate path ${normalized.path}.`);
    seen.add(normalized.path);
    if (lineage) {
      if (!Array.isArray(item.derivedReferences) || item.derivedReferences.some((reference) => typeof reference !== "string" || !reference.trim())) {
        throw new Error(`${itemLabel}.derivedReferences must be an array of non-empty strings.`);
      }
      const derivedReferences = item.derivedReferences.map((reference) => reference.trim());
      if (new Set(derivedReferences).size !== derivedReferences.length) {
        throw new Error(`${itemLabel}.derivedReferences contains duplicates.`);
      }
      normalized.derivedReferences = derivedReferences;
    }
    return normalized;
  });
  return { schemaVersion, workspaceId, artifacts, updatedAt: value2.updatedAt };
}
function readArtifactOwnership(root) {
  const workspace = openDoveWorkspace(root, { operation: "Artifact ownership read" });
  return normalizeIndex(readJson(root, ARTIFACT_PATHS.artifactOwnership, () => createArtifactOwnershipIndex(workspace.manifest.workspaceId)), {
    label: "Artifact ownership index",
    schemaVersion: ARTIFACT_OWNERSHIP_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    fields: OWNERSHIP_FIELDS,
    itemFields: OWNERSHIP_ITEM_FIELDS
  });
}
function readArtifactLineage(root) {
  const workspace = openDoveWorkspace(root, { operation: "Artifact lineage read" });
  return normalizeIndex(readJson(root, ARTIFACT_PATHS.artifactLineage, () => createArtifactLineageIndex(workspace.manifest.workspaceId)), {
    label: "Artifact lineage index",
    schemaVersion: ARTIFACT_LINEAGE_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    fields: LINEAGE_FIELDS,
    itemFields: LINEAGE_ITEM_FIELDS2,
    lineage: true
  });
}
function mergeOwnedPaths(items, additions) {
  const next = new Map(items.map((item) => [item.path, item]));
  for (const item of additions) {
    const existing = next.get(item.path);
    if (existing && existing.missionId !== item.missionId) {
      throw new Error(`Artifact path ${item.path} is already owned by mission ${existing.missionId}; mission ${item.missionId} cannot overwrite it.`);
    }
    next.set(item.path, item);
  }
  return [...next.values()].sort((left, right) => left.path.localeCompare(right.path));
}
function prepareArtifactLineageUpdate(root, receipt) {
  const timestamp = nowIso();
  const ownership = readArtifactOwnership(root);
  const lineage = readArtifactLineage(root);
  const ownershipItems = receipt.artifacts.map((artifact) => ({
    path: artifact.path,
    kind: artifact.kind,
    sha256: artifact.sha256,
    missionId: receipt.missionId,
    contractDigest: receipt.contractDigest,
    receiptId: receipt.receiptId
  }));
  const criterionRefsByArtifact = new Map(receipt.artifacts.map((artifact) => [artifact.path, /* @__PURE__ */ new Set()]));
  for (const criterion of receipt.criteriaSatisfied) {
    for (const evidenceRef of criterion.evidenceRefs) {
      if (!evidenceRef.startsWith("artifact:")) continue;
      const artifactPath = evidenceRef.slice("artifact:".length);
      criterionRefsByArtifact.get(artifactPath)?.add(`criterion:${criterion.criterionId}`);
    }
  }
  const lineageItems = ownershipItems.map((item) => ({
    ...item,
    derivedReferences: [...criterionRefsByArtifact.get(item.path) ?? []].sort()
  }));
  return {
    ownership: {
      schemaVersion: ARTIFACT_OWNERSHIP_SCHEMA_VERSION,
      workspaceId: ownership.workspaceId,
      artifacts: mergeOwnedPaths(ownership.artifacts, ownershipItems),
      updatedAt: timestamp
    },
    lineage: {
      schemaVersion: ARTIFACT_LINEAGE_SCHEMA_VERSION,
      workspaceId: lineage.workspaceId,
      artifacts: mergeOwnedPaths(lineage.artifacts, lineageItems),
      updatedAt: timestamp
    },
    ownershipPaths: ownershipItems.map((item) => item.path),
    lineagePaths: lineageItems.map((item) => item.path)
  };
}

// src/core/mission-contracts.mjs
import crypto3 from "node:crypto";
import fs8 from "node:fs";
import path8 from "node:path";

// src/core/workspace-init.mjs
import fs7 from "node:fs";
import path7 from "node:path";
var DOVE_INIT_PROPOSAL_VERSION = 1;
var INIT_FIELDS = /* @__PURE__ */ new Set([
  "goal",
  "archiveReset",
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "mutationMode",
  "workspaceId",
  "createdAt",
  "detectedState",
  "detectedSchema",
  "sourceIdentity",
  "sourceTreeDigest",
  "archiveTarget"
]);
function assertPlainObject3(value2, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) throw new Error(`${label} must be a plain object.`);
}
function assertAllowed(args2) {
  assertPlainObject3(args2, "dove init arguments");
  const unknown = Object.keys(args2).filter((field) => !INIT_FIELDS.has(field));
  if (unknown.length > 0) throw new Error(`dove init does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function goalFrom(args2) {
  const goal = typeof args2.goal === "string" ? args2.goal.trim() : "";
  if (!goal) throw new Error("Dove init requires a non-empty goal.");
  return goal;
}
function mutationModeFor(root, args2) {
  const explicit = Object.hasOwn(args2, "mutationMode") ? normalizeMutationMode(args2.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (explicit && active && explicit !== active) throw new Error(`Dove init mutationMode ${explicit} does not match the active MutationContext mode ${active}.`);
  return active ?? explicit ?? "direct-process";
}
function optionalReplayString(value2, label) {
  if (value2 === null || value2 === void 0) return null;
  if (typeof value2 !== "string" || !value2) throw new Error(`${label} must be a non-empty string or null.`);
  return value2;
}
function exactReplayInput(args2) {
  return {
    goal: goalFrom(args2),
    archiveReset: args2.archiveReset === true,
    confirmed: true,
    proposalVersion: args2.proposalVersion,
    proposalWorkspace: optionalReplayString(args2.proposalWorkspace, "proposalWorkspace"),
    proposalDigest: optionalReplayString(args2.proposalDigest, "proposalDigest"),
    mutationMode: Object.hasOwn(args2, "mutationMode") ? normalizeMutationMode(args2.mutationMode) : "direct-process",
    workspaceId: optionalReplayString(args2.workspaceId, "workspaceId"),
    createdAt: optionalReplayString(args2.createdAt, "createdAt"),
    detectedState: optionalReplayString(args2.detectedState, "detectedState"),
    detectedSchema: optionalReplayString(args2.detectedSchema, "detectedSchema"),
    sourceIdentity: args2.sourceIdentity ?? null,
    sourceTreeDigest: optionalReplayString(args2.sourceTreeDigest, "sourceTreeDigest"),
    archiveTarget: optionalReplayString(args2.archiveTarget, "archiveTarget")
  };
}
function proposalEnvelope({ workspace, mutationMode: mutationMode2, workspaceId, createdAt, goal, inspection, archiveReset, archiveTarget }) {
  return {
    proposalVersion: DOVE_INIT_PROPOSAL_VERSION,
    workspace,
    mutationMode: mutationMode2,
    workspaceId,
    createdAt,
    goal,
    archiveReset,
    detectedState: inspection.state,
    detectedSchema: inspection.detectedSchema,
    sourceIdentity: inspection.source?.identity ?? null,
    sourceTreeDigest: inspection.source?.treeDigest ?? null,
    archiveTarget: archiveTarget ?? null,
    newSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION
  };
}
function assertArchiveTargetSafe(workspace, archiveTarget) {
  const archiveParent = path7.join(workspace, ".dove-archive");
  if (path7.dirname(archiveTarget) !== archiveParent) {
    throw new Error("Dove archive target must be the deterministic workspace-local .dove-archive target.");
  }
  if (!fs7.existsSync(archiveParent)) return;
  const parentStat = fs7.lstatSync(archiveParent);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    throw new Error("Dove archive parent .dove-archive must be a real workspace-local directory, not a symbolic link or file.");
  }
}
function proposalOperations(envelope) {
  const initialize = [
    ...MINIMAL_WORKSPACE_DIRECTORIES.map((relativePath) => ({ type: "create-directory", path: relativePath })),
    ...MINIMAL_WORKSPACE_REQUIRED_FILES.map((relativePath) => ({ type: "write-sealed-json", path: relativePath }))
  ];
  return envelope.archiveReset ? [
    { type: "atomic-directory-rename", from: ".dove", to: path7.relative(envelope.workspace, envelope.archiveTarget).split(path7.sep).join("/") },
    ...initialize
  ] : initialize;
}
function confirmArgs(envelope, proposalDigest) {
  return {
    goal: envelope.goal,
    archiveReset: envelope.archiveReset,
    confirmed: true,
    proposalVersion: envelope.proposalVersion,
    proposalWorkspace: envelope.workspace,
    proposalDigest,
    mutationMode: envelope.mutationMode,
    workspaceId: envelope.workspaceId,
    createdAt: envelope.createdAt,
    detectedState: envelope.detectedState,
    detectedSchema: envelope.detectedSchema,
    sourceIdentity: envelope.sourceIdentity,
    sourceTreeDigest: envelope.sourceTreeDigest,
    archiveTarget: envelope.archiveTarget
  };
}
function buildProposal(root, args2 = {}) {
  const workspace = canonicalWorkspacePath(root);
  const replay = args2.confirmed === true ? exactReplayInput(args2) : null;
  if (replay && replay.proposalVersion !== DOVE_INIT_PROPOSAL_VERSION) {
    throw new Error("The selected Dove init proposal version is unsupported. Request a fresh proposal.");
  }
  if (replay && replay.proposalWorkspace !== workspace) {
    throw new Error("The selected Dove init proposal belongs to a different canonical workspace. Request a fresh proposal.");
  }
  const inspection = inspectDoveWorkspace(workspace);
  const archiveReset = args2.archiveReset === true;
  if (archiveReset && inspection.state !== "absent") {
    inspection.source = inspectDoveSourceTree(workspace);
  }
  if (archiveReset) {
    if (inspection.state === "absent" || inspection.healthy) {
      throw new Error("dove init --archive-reset applies only when an existing legacy or invalid .dove directory requires explicit replacement.");
    }
  } else if (inspection.state !== "absent") {
    if (inspection.healthy) throw new Error("Dove workspace is already initialized with the current schema.");
    throw workspaceSchemaError(inspection, "dove init");
  }
  const goal = goalFrom(args2);
  const mutationMode2 = mutationModeFor(workspace, args2);
  if (archiveReset && mutationMode2 === "patch-plan") {
    throw new Error("dove init --archive-reset cannot run in patch-plan mode because a patch plan cannot express the required atomic directory rename and rollback semantics. Use direct-process and an exact confirmation replay.");
  }
  const workspaceId = replay?.workspaceId ?? (typeof args2.workspaceId === "string" && args2.workspaceId ? args2.workspaceId : newWorkspaceId());
  const createdAt = replay?.createdAt ?? (typeof args2.createdAt === "string" && args2.createdAt ? args2.createdAt : (/* @__PURE__ */ new Date()).toISOString());
  const archiveTarget = archiveReset ? archiveTargetFor({ workspace, detectedSchema: inspection.detectedSchema, treeDigest: inspection.source.treeDigest }) : null;
  if (archiveReset) assertArchiveTargetSafe(workspace, archiveTarget);
  const envelope = proposalEnvelope({ workspace, mutationMode: mutationMode2, workspaceId, createdAt, goal, inspection, archiveReset, archiveTarget });
  const proposalDigest = workspaceDigest(envelope);
  return { envelope, proposalDigest, inspection, documents: createMinimalWorkspaceDocuments({ workspaceId, goal, createdAt }) };
}
function mutationMetadata(proposal, writesApplied) {
  return {
    mutationMode: proposal.envelope.mutationMode,
    writesApplied,
    paths: writesApplied ? [
      ...proposal.envelope.archiveReset ? [".dove", path7.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path7.sep).join("/")] : [],
      ...MINIMAL_WORKSPACE_REQUIRED_FILES
    ] : []
  };
}
function proposalResult(proposal) {
  const args2 = confirmArgs(proposal.envelope, proposal.proposalDigest);
  return {
    status: "needs-confirmation",
    kind: proposal.envelope.archiveReset ? "archive-reset" : "init",
    workspace: proposal.envelope.workspace,
    detectedSchemaState: {
      state: proposal.envelope.detectedState,
      detectedSchema: proposal.envelope.detectedSchema
    },
    source: proposal.envelope.archiveReset ? {
      path: ".dove",
      identity: proposal.envelope.sourceIdentity,
      treeDigest: proposal.envelope.sourceTreeDigest
    } : null,
    archiveTarget: proposal.envelope.archiveTarget,
    newSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION,
    operations: proposalOperations(proposal.envelope),
    proposalDigest: proposal.proposalDigest,
    confirmation: {
      required: true,
      exactReplay: true,
      proposalVersion: DOVE_INIT_PROPOSAL_VERSION,
      proposalWorkspace: proposal.envelope.workspace,
      proposalDigest: proposal.proposalDigest,
      mutationMode: proposal.envelope.mutationMode,
      confirmArgs: args2,
      proposalToken: Buffer.from(JSON.stringify({ version: DOVE_INIT_PROPOSAL_VERSION, confirmArgs: args2 }), "utf8").toString("base64url")
    },
    mutation: mutationMetadata(proposal, false)
  };
}
function assertExactReplay(proposal, args2) {
  if (args2.confirmed !== true) return;
  const replay = exactReplayInput(args2);
  const expectedArgs = confirmArgs(proposal.envelope, proposal.proposalDigest);
  if (stableWorkspaceSerialize(replay) !== stableWorkspaceSerialize(expectedArgs)) {
    throw new Error("The selected Dove init proposal no longer matches the approved proposal replay fields exactly. Request a fresh proposal.");
  }
  if (replay.proposalDigest !== proposal.proposalDigest) throw new Error("The selected Dove init proposal no longer matches the exact workspace, source tree, archive target, goal, schema version, or mutation mode. Request a fresh proposal.");
  if (proposal.envelope.archiveReset) {
    const archiveTarget = proposal.envelope.archiveTarget;
    if (fs7.existsSync(archiveTarget)) throw new Error(`Archive target is already occupied: ${archiveTarget}. Request a fresh proposal.`);
    const source = inspectDoveSourceTree(proposal.envelope.workspace);
    if (!source || stableWorkspaceSerialize(source.identity) !== stableWorkspaceSerialize(proposal.envelope.sourceIdentity) || source.treeDigest !== proposal.envelope.sourceTreeDigest) {
      throw new Error("The .dove source identity or tree digest changed after proposal. Request a fresh archive-reset proposal.");
    }
  }
}
function materializeDoveInitDirect(root, proposal, options = {}) {
  const ops = options.fsOps ?? fs7;
  const workspace = proposal.envelope.workspace;
  const doveRoot = path7.join(workspace, ".dove");
  if (!proposal.envelope.archiveReset) {
    try {
      materializeMinimalWorkspaceDirectory(doveRoot, proposal.documents, { fsOps: ops });
    } catch (error) {
      let rollbackError = null;
      try {
        if (ops.existsSync(doveRoot)) ops.rmSync(doveRoot, { recursive: true, force: true });
      } catch (rollbackFailure) {
        rollbackError = rollbackFailure;
      }
      if (rollbackError) {
        throw new Error(`Dove initialization failed and cleanup also failed: ${error instanceof Error ? error.message : String(error)}; cleanup: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
      }
      throw new Error(`Dove initialization failed; no .dove workspace was retained: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }
  const archiveTarget = proposal.envelope.archiveTarget;
  const archiveParent = path7.dirname(archiveTarget);
  const archiveParentExisted = ops.existsSync(archiveParent);
  let renamed = false;
  try {
    if (!archiveParentExisted) ops.mkdirSync(archiveParent, { recursive: false });
    ops.renameSync(doveRoot, archiveTarget);
    renamed = true;
    materializeMinimalWorkspaceDirectory(doveRoot, proposal.documents, { fsOps: ops });
  } catch (error) {
    let rollbackError = null;
    try {
      if (renamed && ops.existsSync(doveRoot)) ops.rmSync(doveRoot, { recursive: true, force: true });
      if (renamed && ops.existsSync(archiveTarget)) ops.renameSync(archiveTarget, doveRoot);
      if (!archiveParentExisted && ops.existsSync(archiveParent) && ops.readdirSync(archiveParent).length === 0) ops.rmdirSync(archiveParent);
    } catch (rollbackFailure) {
      rollbackError = rollbackFailure;
    }
    if (rollbackError) {
      throw new Error(`Dove archive-reset failed and rollback also failed: ${error instanceof Error ? error.message : String(error)}; rollback: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
    }
    throw new Error(`Dove archive-reset failed; the original .dove directory was restored: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function initDoveWorkspace(root, args2 = {}, options = {}) {
  assertAllowed(args2);
  const proposal = buildProposal(root, args2);
  if (args2.confirmed !== true) return proposalResult(proposal);
  assertExactReplay(proposal, args2);
  if (!currentMutationContext(root)) throw new Error("Confirmed Dove init requires an active MutationContext.");
  if (proposal.envelope.archiveReset && proposal.envelope.mutationMode === "patch-plan") {
    throw new Error("Confirmed Dove archive-reset cannot claim patch-plan writes: the required atomic directory rename and rollback are direct-process only.");
  }
  if (proposal.envelope.mutationMode === "patch-plan") {
    const context = currentMutationContext(root);
    for (const relativePath of MINIMAL_WORKSPACE_DIRECTORIES) context.ensureDirectory(relativePath);
    context.writeJson(".dove/manifest.json", proposal.documents.manifest);
    context.writeJson(".dove/project.json", proposal.documents.project);
    context.writeJson(".dove/artifacts/ownership.json", proposal.documents.ownership);
    context.writeJson(".dove/artifacts/lineage.json", proposal.documents.lineage);
    return {
      status: "initialization-planned",
      kind: "init",
      manifest: proposal.documents.manifest,
      project: proposal.documents.project,
      archiveTarget: null,
      mutation: mutationMetadata(proposal, false),
      writes: []
    };
  }
  materializeDoveInitDirect(root, proposal, options);
  const opened = openDoveWorkspace(root, { operation: "confirmed Dove init" });
  return {
    status: proposal.envelope.archiveReset ? "archive-reset-complete" : "initialized",
    kind: proposal.envelope.archiveReset ? "archive-reset" : "init",
    manifest: opened.manifest,
    project: opened.project,
    archiveTarget: proposal.envelope.archiveTarget,
    mutation: mutationMetadata(proposal, true),
    writes: MINIMAL_WORKSPACE_REQUIRED_FILES
  };
}

// src/core/mission-contracts.mjs
var MISSION_CONTRACT_SCHEMA_VERSION = 1;
var MISSION_PROPOSAL_VERSION = 1;
var MISSION_CRITERION_ID_VERSION = 1;
var MISSION_EVIDENCE_REQUIREMENT_ID_VERSION = 1;
var MISSION_CONTRACT_ARRAY_FIELDS = [
  "scope",
  "outOfScope",
  "targetArtifacts",
  "expectedArtifacts",
  "completionCriteria",
  "evidenceRequirements"
];
var MISSION_OPTIONAL_ARRAY_FIELDS = ["dependsOnMissionIds"];
var MISSION_CONTRACT_INPUT_FIELDS = /* @__PURE__ */ new Set([
  "missionId",
  "goal",
  ...MISSION_CONTRACT_ARRAY_FIELDS,
  ...MISSION_OPTIONAL_ARRAY_FIELDS,
  "supersedesMissionId"
]);
var MISSION_REPLAY_CONTROL_FIELDS = /* @__PURE__ */ new Set([
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "mutationMode",
  "workspaceId",
  "createdAt"
]);
var PERSISTED_MISSION_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "missionId",
  "contractDigest",
  "createdAt",
  ...MISSION_CONTRACT_ARRAY_FIELDS,
  ...MISSION_OPTIONAL_ARRAY_FIELDS,
  "goal",
  "supersedesMissionId",
  "completionCriterionIds",
  "evidenceRequirementIds"
]);
var TYPED_EVIDENCE_REQUIREMENT_PATTERN = /^(artifact|validation|source|note):(.+)$/u;
var INIT_INPUT_FIELDS = /* @__PURE__ */ new Set(["goal", "archiveReset", "confirmed", "proposalVersion", "proposalWorkspace", "proposalDigest", "mutationMode", "workspaceId", "createdAt", "detectedState", "detectedSchema", "sourceIdentity", "sourceTreeDigest", "archiveTarget"]);
function sha2563(value2) {
  return crypto3.createHash("sha256").update(value2).digest("hex");
}
function normalizeString(value2, fallback = null) {
  if (typeof value2 !== "string") {
    return fallback;
  }
  const normalized = value2.trim();
  return normalized || fallback;
}
function normalizeStringArray(value2) {
  if (value2 === void 0) {
    return [];
  }
  if (!Array.isArray(value2)) {
    throw new Error("Mission contract array fields must be arrays of non-empty strings.");
  }
  const normalized = value2.map((item) => normalizeString(item, null));
  if (normalized.some((item) => item === null)) {
    throw new Error("Mission contract array fields must contain only non-empty strings.");
  }
  return Array.from(new Set(normalized));
}
function canonicalContractPath(rawPath, label) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    throw new Error(`${label} has an unsafe project-relative path ${JSON.stringify(rawPath)}: ${normalized.reason}.`);
  }
  const supplied = String(rawPath).trim().replace(/\\/gu, "/");
  if (normalized.normalizedPath !== supplied) {
    throw new Error(`${label} path must be canonical: ${rawPath}.`);
  }
  const evidenceRole = artifactEvidenceRole(normalized.normalizedPath);
  if (normalized.normalizedPath === ARTIFACT_PATHS.lessonsDir || normalized.normalizedPath.startsWith(`${ARTIFACT_PATHS.lessonsDir}/`)) {
    throw new Error(`${label} must not reference advisory-only Dove lessons: ${rawPath}.`);
  }
  if (evidenceRole === "bookkeeping" || evidenceRole === "unsupported") {
    throw new Error(`${label} must reference a substantive schema 7 artifact or an external project artifact, not Dove bookkeeping: ${rawPath}.`);
  }
  return normalized.normalizedPath;
}
function normalizeContractPaths(value2, label) {
  return normalizeStringArray(value2).map((item, index) => canonicalContractPath(item, `${label}[${index}]`));
}
function normalizeEvidenceRequirements(value2) {
  return normalizeStringArray(value2).map((requirement, index) => {
    if (requirement === "review:authoritative") return requirement;
    const match = TYPED_EVIDENCE_REQUIREMENT_PATTERN.exec(requirement);
    if (!match) {
      throw new Error(`evidenceRequirements[${index}] must use artifact:<path>, validation:<path>, source:<id>, note:<id>, or review:authoritative.`);
    }
    const [, kind, rawValue] = match;
    const normalizedValue = normalizeString(rawValue, null);
    if (!normalizedValue) {
      throw new Error(`evidenceRequirements[${index}] must contain a non-empty typed reference.`);
    }
    if (kind === "artifact" || kind === "validation") {
      return `${kind}:${canonicalContractPath(normalizedValue, `evidenceRequirements[${index}]`)}`;
    }
    return `${kind}:${normalizedValue}`;
  });
}
function assertPlainObject4(value2, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertAllowedFields2(args2, allowed, label) {
  assertPlainObject4(args2, `${label} arguments`);
  const unknown = Object.keys(args2).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function stableMissionValue(value2) {
  if (Array.isArray(value2)) {
    return value2.map(stableMissionValue);
  }
  if (value2 && typeof value2 === "object") {
    return Object.fromEntries(
      Object.entries(value2).filter(([, item]) => item !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableMissionValue(item)])
    );
  }
  return value2;
}
function stableMissionSerialize(value2) {
  return JSON.stringify(stableMissionValue(value2));
}
function canonicalWorkspace(root) {
  return fs8.realpathSync.native(path8.resolve(root));
}
function slugify(value2) {
  return String(value2 ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "mission";
}
function normalizeMissionId(value2, goal) {
  const fallback = `mission-${slugify(goal)}-${sha2563(goal).slice(0, 10)}`;
  const missionId = normalizeString(value2, fallback);
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(missionId)) {
    throw new Error("missionId must start with a lowercase letter or digit and contain only lowercase letters, digits, dot, underscore, or hyphen.");
  }
  return missionId;
}
function missionContractContent(args2 = {}) {
  const goal = normalizeString(args2.goal, null);
  if (!goal) {
    throw new Error("Dove mission requires a non-empty goal.");
  }
  const content = { goal };
  for (const field of MISSION_CONTRACT_ARRAY_FIELDS) {
    if (field === "targetArtifacts" || field === "expectedArtifacts") {
      content[field] = normalizeContractPaths(args2[field], field);
    } else if (field === "evidenceRequirements") {
      content[field] = normalizeEvidenceRequirements(args2[field]);
    } else {
      content[field] = normalizeStringArray(args2[field]);
    }
  }
  const dependsOnMissionIds = normalizeStringArray(args2.dependsOnMissionIds);
  if (dependsOnMissionIds.length > 0) {
    content.dependsOnMissionIds = dependsOnMissionIds;
  }
  const supersedesMissionId = normalizeString(args2.supersedesMissionId, null);
  if (supersedesMissionId) {
    content.supersedesMissionId = supersedesMissionId;
  }
  return content;
}
function missionCompletionCriterionId(_index, criterion) {
  return `criterion-${sha2563(stableMissionSerialize({
    version: MISSION_CRITERION_ID_VERSION,
    criterion
  })).slice(0, 16)}`;
}
function missionEvidenceRequirementId(_index, requirement) {
  return `evidence-${sha2563(stableMissionSerialize({
    version: MISSION_EVIDENCE_REQUIREMENT_ID_VERSION,
    requirement
  })).slice(0, 16)}`;
}
function missionCompletionCriteria(content = {}) {
  return (Array.isArray(content.completionCriteria) ? content.completionCriteria : []).map((criterion, index) => ({
    criterionId: missionCompletionCriterionId(index, criterion),
    criterion
  }));
}
function missionEvidenceRequirements(content = {}) {
  return (Array.isArray(content.evidenceRequirements) ? content.evidenceRequirements : []).map((requirement, index) => ({
    requirementId: missionEvidenceRequirementId(index, requirement),
    requirement
  }));
}
function contractDigestFor(missionId, content) {
  return sha2563(stableMissionSerialize({
    schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION,
    missionId,
    ...content,
    completionCriterionIds: missionCompletionCriteria(content).map(({ criterionId }) => criterionId),
    evidenceRequirementIds: missionEvidenceRequirements(content).map(({ requirementId }) => requirementId)
  }));
}
function currentMissionContractMetadata(mission = {}) {
  assertPlainObject4(mission, "Mission contract");
  const unknown = Object.keys(mission).filter((field) => !PERSISTED_MISSION_FIELDS.has(field));
  if (unknown.length > 0) {
    throw new Error(`Mission contract does not accept unknown persisted fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
  const missionId = normalizeString(mission.missionId, null);
  if (!missionId || !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(missionId)) {
    throw new Error("Mission contract has an invalid missionId.");
  }
  if (mission.schemaVersion !== MISSION_CONTRACT_SCHEMA_VERSION) {
    throw new Error(`Mission contract schemaVersion ${mission.schemaVersion ?? "missing"} is unsupported.`);
  }
  const workspaceId = normalizeString(mission.workspaceId, null);
  if (!workspaceId || !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(workspaceId)) {
    throw new Error(`Mission contract has an invalid workspaceId for ${missionId}.`);
  }
  for (const field of ["contractDigest", "createdAt", "goal", ...MISSION_CONTRACT_ARRAY_FIELDS, "completionCriterionIds", "evidenceRequirementIds"]) {
    if (!Object.hasOwn(mission, field)) {
      throw new Error(`Mission contract is missing required persisted field $.${field}.`);
    }
  }
  if (!/^[0-9a-f]{64}$/u.test(String(mission.contractDigest ?? ""))) {
    throw new Error(`Mission contract has an invalid contractDigest for ${missionId}.`);
  }
  const createdAt = normalizeString(mission.createdAt, null);
  if (!createdAt || !Number.isFinite(Date.parse(createdAt)) || new Date(Date.parse(createdAt)).toISOString() !== createdAt) {
    throw new Error(`Mission contract has an invalid createdAt timestamp for ${missionId}.`);
  }
  const content = missionContractContent(mission);
  const completionCriterionIds = missionCompletionCriteria(content).map(({ criterionId }) => criterionId);
  const evidenceRequirementIds = missionEvidenceRequirements(content).map(({ requirementId }) => requirementId);
  return {
    missionId,
    content,
    contractDigest: contractDigestFor(missionId, content),
    completionCriterionIds,
    evidenceRequirementIds
  };
}
function assertCurrentMissionContract(mission = {}) {
  const current = currentMissionContractMetadata(mission);
  if (mission.contractDigest !== current.contractDigest) {
    throw new Error(`Mission contract digest is stale or malformed for ${current.missionId}.`);
  }
  if (mission.completionCriterionIds !== void 0 && (!Array.isArray(mission.completionCriterionIds) || mission.completionCriterionIds.length !== current.completionCriterionIds.length || mission.completionCriterionIds.some((criterionId, index) => criterionId !== current.completionCriterionIds[index]))) {
    throw new Error(`Mission completion criterion ids are stale or malformed for ${current.missionId}.`);
  }
  if (mission.evidenceRequirementIds !== void 0 && (!Array.isArray(mission.evidenceRequirementIds) || mission.evidenceRequirementIds.length !== current.evidenceRequirementIds.length || mission.evidenceRequirementIds.some((requirementId, index) => requirementId !== current.evidenceRequirementIds[index]))) {
    throw new Error(`Mission evidence requirement ids are stale or malformed for ${current.missionId}.`);
  }
  return current;
}
function missionPath(missionId) {
  return path8.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}
function fileExists(root, relativePath) {
  const context = currentMutationContext(root);
  return context ? context.fileExists(relativePath) : fs8.existsSync(path8.join(root, relativePath));
}
function projectIdentitySnapshot(root, workspace, args2 = {}, mutationMode2 = "direct-process") {
  const inspection = inspectDoveWorkspace(root);
  if (inspection.healthy) {
    return {
      required: false,
      workspaceBootstrapRequired: false,
      identityDigest: workspaceDigest(inspection.project),
      identity: inspection.project,
      manifest: inspection.manifest,
      workspaceId: inspection.manifest.workspaceId,
      createdAt: inspection.manifest.createdAt,
      documents: null
    };
  }
  if (inspection.state !== "absent") {
    throw workspaceSchemaError(inspection, "Dove mission");
  }
  const goal = normalizeString(args2.goal, null);
  const workspaceId = normalizeString(args2.workspaceId, null) ?? newWorkspaceId();
  const createdAt = normalizeString(args2.createdAt, null) ?? nowIso();
  const documents = createMinimalWorkspaceDocuments({ workspaceId, goal, createdAt });
  const initProposal = initDoveWorkspace(root, {
    goal,
    mutationMode: mutationMode2,
    workspaceId,
    createdAt
  });
  return {
    required: true,
    workspaceBootstrapRequired: true,
    identityDigest: workspaceDigest({ manifest: documents.manifest, project: documents.project }),
    identity: documents.project,
    manifest: documents.manifest,
    workspaceId,
    createdAt,
    documents,
    initConfirmArgs: initProposal.confirmation.confirmArgs
  };
}
function fileArtifactIdentity(relativePath, fullPath, stat) {
  return {
    path: relativePath,
    exists: true,
    kind: "file",
    mode: Number(stat.mode),
    sizeBytes: String(stat.size),
    ctimeNs: String(stat.ctimeNs),
    mtimeNs: String(stat.mtimeNs),
    sha256: sha2563(fs8.readFileSync(fullPath))
  };
}
function directoryArtifactIdentity(relativePath, fullPath) {
  const entries = [];
  const visit = (directoryPath, directoryRelativePath) => {
    for (const entry of fs8.readdirSync(directoryPath, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path8.join(directoryPath, entry.name);
      const entryRelativePath = path8.posix.join(directoryRelativePath, entry.name);
      const stat = fs8.lstatSync(entryPath, { bigint: true });
      const metadata = { path: entryRelativePath, mode: Number(stat.mode), ctimeNs: String(stat.ctimeNs), mtimeNs: String(stat.mtimeNs) };
      if (stat.isSymbolicLink()) {
        throw new Error(`Mission target artifact directories must not contain symbolic links: ${path8.posix.join(relativePath, entryRelativePath)}.`);
      } else if (stat.isDirectory()) {
        entries.push({ ...metadata, kind: "directory" });
        visit(entryPath, entryRelativePath);
      } else if (stat.isFile()) {
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha2563(fs8.readFileSync(entryPath)) });
      } else {
        entries.push({ ...metadata, kind: "other", sizeBytes: String(stat.size) });
      }
    }
  };
  visit(fullPath, "");
  return {
    path: relativePath,
    exists: true,
    kind: "directory",
    mode: Number(fs8.lstatSync(fullPath, { bigint: true }).mode),
    entryCount: entries.length,
    treeDigest: sha2563(stableMissionSerialize(entries))
  };
}
function artifactIdentity(root, rawPath) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    throw new Error(`Invalid target artifact ${JSON.stringify(rawPath)}: ${normalized.reason}.`);
  }
  const relativePath = normalized.normalizedPath;
  if (relativePath === ".dove-archive" || relativePath.startsWith(".dove-archive/")) {
    throw new Error("Mission target artifacts must not include preserved .dove-archive state.");
  }
  const fullPath = path8.join(root, relativePath);
  if (!fs8.existsSync(fullPath)) {
    resolveCanonicalContainedWrite(root, relativePath, { label: "Mission target artifact path" });
    return { path: relativePath, exists: false };
  }
  const stat = fs8.lstatSync(fullPath, { bigint: true });
  if (stat.isSymbolicLink()) {
    throw new Error(`Mission target artifacts must not be symbolic links: ${relativePath}.`);
  }
  resolveCanonicalContainedWrite(root, relativePath, { label: "Mission target artifact path" });
  if (stat.isFile()) {
    return fileArtifactIdentity(relativePath, fullPath, stat);
  }
  if (stat.isDirectory()) {
    return directoryArtifactIdentity(relativePath, fullPath);
  }
  return {
    path: relativePath,
    exists: true,
    kind: "other",
    mode: stat.mode,
    sizeBytes: stat.size
  };
}
function targetArtifactIdentities(root, targetArtifacts, expectedArtifacts = []) {
  const identities = /* @__PURE__ */ new Map();
  for (const artifactPath of [...targetArtifacts, ...expectedArtifacts]) {
    identities.set(artifactPath, artifactIdentity(root, artifactPath));
  }
  return [...identities.values()];
}
function missionMutationMode(root, args2 = {}) {
  const explicitMode = Object.hasOwn(args2, "mutationMode") ? normalizeMutationMode(args2.mutationMode) : null;
  const activeMode = currentMutationContext(root)?.mutationMode ?? null;
  if (activeMode && explicitMode && activeMode !== explicitMode) {
    throw new Error(`Dove mission mutationMode ${explicitMode} does not match the active mutation context mode ${activeMode}.`);
  }
  return activeMode ?? explicitMode ?? "direct-process";
}
function hasConfirmation(args2 = {}) {
  return args2.confirmed === true;
}
function buildMissionProposal(root, args2 = {}) {
  const workspace = canonicalWorkspace(root);
  const content = missionContractContent(args2);
  const missionId = normalizeMissionId(args2.missionId, content.goal);
  const contractDigest = contractDigestFor(missionId, content);
  const mutationMode2 = missionMutationMode(root, args2);
  const projectIdentity = projectIdentitySnapshot(root, workspace, {
    goal: content.goal,
    workspaceId: args2.workspaceId,
    createdAt: args2.createdAt
  }, mutationMode2);
  if (!projectIdentity.required) {
    const suppliedWorkspaceId = normalizeString(args2.workspaceId, projectIdentity.workspaceId);
    const suppliedCreatedAt = normalizeString(args2.createdAt, projectIdentity.createdAt);
    if (suppliedWorkspaceId !== projectIdentity.workspaceId || suppliedCreatedAt !== projectIdentity.createdAt) {
      throw new Error("Dove mission replay no longer matches the current manifest workspace identity.");
    }
  }
  const targetIdentities = targetArtifactIdentities(root, content.targetArtifacts, content.expectedArtifacts);
  const mission = {
    schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION,
    proposalVersion: MISSION_PROPOSAL_VERSION,
    missionId,
    contractDigest,
    ...content,
    completionCriterionIds: missionCompletionCriteria(content).map(({ criterionId }) => criterionId),
    evidenceRequirementIds: missionEvidenceRequirements(content).map(({ requirementId }) => requirementId)
  };
  const envelope = {
    proposalVersion: MISSION_PROPOSAL_VERSION,
    workspace,
    mutationMode: mutationMode2,
    workspaceSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION,
    projectIdentityRequired: projectIdentity.required,
    workspaceBootstrapRequired: projectIdentity.workspaceBootstrapRequired,
    workspaceId: projectIdentity.workspaceId,
    workspaceCreatedAt: projectIdentity.createdAt,
    projectIdentityDigest: projectIdentity.identityDigest,
    targetArtifactIdentities: targetIdentities,
    mission
  };
  const proposalDigest = sha2563(stableMissionSerialize(envelope));
  return {
    workspace,
    mutationMode: mutationMode2,
    projectIdentity,
    targetIdentities,
    mission,
    content,
    contractDigest,
    proposalDigest
  };
}
function confirmArgsFor(proposal) {
  return {
    confirmed: true,
    proposalVersion: MISSION_PROPOSAL_VERSION,
    proposalWorkspace: proposal.workspace,
    proposalDigest: proposal.proposalDigest,
    mutationMode: proposal.mutationMode,
    workspaceId: proposal.projectIdentity.workspaceId,
    createdAt: proposal.projectIdentity.createdAt,
    missionId: proposal.mission.missionId,
    ...proposal.content
  };
}
function confirmationMetadata(proposal) {
  return {
    required: true,
    proposalVersion: MISSION_PROPOSAL_VERSION,
    proposalDigest: proposal.proposalDigest,
    proposalWorkspace: proposal.workspace,
    mutationMode: proposal.mutationMode,
    trustBoundary: "trusted-local-exact-replay-data",
    proofOfHumanApproval: false,
    tamperProof: false,
    confirmArgs: confirmArgsFor(proposal)
  };
}
function missionMutationMetadata(proposal, applied) {
  return {
    mutationMode: proposal.mutationMode,
    writesApplied: applied,
    paths: applied ? [
      ...proposal.projectIdentity.required ? [
        ARTIFACT_PATHS.doveRootManifest,
        ARTIFACT_PATHS.projectIdentity,
        ARTIFACT_PATHS.artifactOwnership,
        ARTIFACT_PATHS.artifactLineage
      ] : [],
      missionPath(proposal.mission.missionId)
    ] : []
  };
}
function assertReplayHeader(proposal, args2) {
  const suppliedDigest = normalizeString(args2.proposalDigest, "");
  if (!/^[0-9a-f]{64}$/u.test(suppliedDigest) || !normalizeString(args2.missionId, null)) {
    throw new Error("Confirmed Dove mission materialization requires the exact proposalDigest and missionId returned by the selected local proposal replay data.");
  }
  if (!currentMutationContext(proposal.workspace)) {
    throw new Error("Confirmed Dove mission materialization requires an active MutationContext; direct core replay cannot write outside the selected mutation mode.");
  }
  if (args2.proposalVersion !== MISSION_PROPOSAL_VERSION) {
    throw new Error("The selected local Dove mission proposal replay version is not supported. Request a fresh proposal.");
  }
  if (normalizeString(args2.proposalWorkspace, "") !== proposal.workspace) {
    throw new Error("The selected local Dove mission proposal replay belongs to a different canonical workspace. Request a fresh proposal.");
  }
  if (suppliedDigest !== proposal.proposalDigest) {
    throw new Error("The selected local Dove mission proposal replay no longer matches the current contract, target artifact identities, project identity, or exact replay fields. Request a fresh proposal before materialization.");
  }
}
function assertMissionIdAvailable(root, missionId) {
  if (fileExists(root, missionPath(missionId))) {
    throw new Error(`Dove mission id already exists or changed: ${missionId}. Request a fresh proposal.`);
  }
}
function materializeProjectIdentity(root, proposal) {
  if (!proposal.projectIdentity.required) {
    openDoveWorkspace(root, { operation: "Dove mission materialization" });
    return proposal.projectIdentity.identity;
  }
  initDoveWorkspace(root, proposal.projectIdentity.initConfirmArgs);
  return proposal.projectIdentity.identity;
}
function persistedMission(proposal) {
  return {
    schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION,
    workspaceId: proposal.projectIdentity.workspaceId,
    missionId: proposal.mission.missionId,
    contractDigest: proposal.contractDigest,
    createdAt: proposal.projectIdentity.required ? proposal.projectIdentity.createdAt : nowIso(),
    ...proposal.content,
    completionCriterionIds: missionCompletionCriteria(proposal.content).map(({ criterionId }) => criterionId),
    evidenceRequirementIds: missionEvidenceRequirements(proposal.content).map(({ requirementId }) => requirementId)
  };
}
function createDoveMission(root, args2 = {}) {
  assertGovernanceMutationRegistered("create-dove-mission", "guarded");
  assertAllowedFields2(args2, /* @__PURE__ */ new Set([...MISSION_CONTRACT_INPUT_FIELDS, ...MISSION_REPLAY_CONTROL_FIELDS]), "create_dove_mission");
  const confirmed = hasConfirmation(args2);
  const proposal = buildMissionProposal(root, args2);
  if (!confirmed) {
    return {
      status: "needs-confirmation",
      mission: proposal.mission,
      contractDigest: proposal.contractDigest,
      handoffBrief: proposal.content,
      confirmation: confirmationMetadata(proposal),
      mutation: missionMutationMetadata(proposal, false)
    };
  }
  assertReplayHeader(proposal, args2);
  assertMissionIdAvailable(root, proposal.mission.missionId);
  const mission = persistedMission(proposal);
  try {
    materializeProjectIdentity(root, proposal);
    writeJson(root, missionPath(mission.missionId), mission);
  } catch (error) {
    if (proposal.projectIdentity.required && proposal.mutationMode === "direct-process") {
      try {
        fs8.rmSync(path8.join(root, ARTIFACT_PATHS.doveRoot), { recursive: true, force: true });
      } catch (cleanupError) {
        throw new Error(`First Dove mission materialization failed and cleanup also failed: ${error instanceof Error ? error.message : String(error)}; cleanup: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
      }
    }
    throw error;
  }
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "materialization-planned" : "materialized",
    mission,
    contractDigest: proposal.contractDigest,
    handoffBrief: proposal.content,
    mutation: missionMutationMetadata(proposal, !plannedOnly)
  };
}
function initDoveGoal(root, args2 = {}) {
  assertGovernanceMutationRegistered("init-dove-goal", "guarded");
  assertAllowedFields2(args2, INIT_INPUT_FIELDS, "init_dove_goal");
  return initDoveWorkspace(root, args2);
}

// src/core/review-artifact-snapshot.mjs
import crypto4 from "node:crypto";
import fs9 from "node:fs";
import path9 from "node:path";
var HASH_PATTERN2 = /^[a-f0-9]{64}$/u;
function sha256Buffer(value2) {
  return crypto4.createHash("sha256").update(value2).digest("hex");
}
function sha256File(fullPath) {
  return sha256Buffer(fs9.readFileSync(fullPath));
}
function stableSnapshotSetHash(snapshots = []) {
  const canonical = [...snapshots].map(({ path: artifactPath, sizeBytes, sha256: sha2564 }) => ({ path: artifactPath, sizeBytes, sha256: sha2564 })).sort((left, right) => left.path.localeCompare(right.path));
  return sha256Buffer(`${JSON.stringify(canonical)}
`);
}
function canonicalReviewArtifactPath(root, relativePath, label = "review artifact") {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) throw new Error(`${label} has an unsafe path ${relativePath}: ${normalized.reason}.`);
  const suppliedPath = String(relativePath).trim().replace(/\\/gu, "/");
  if (normalized.normalizedPath !== suppliedPath) throw new Error(`${label} must use a normalized project-relative path.`);
  const inspection = inspectDeclaredPath(root, normalized.normalizedPath, { requireNonEmpty: true, rejectBookkeeping: true });
  if (inspection.status !== "existing") throw new Error(`${label} is not a usable file at ${normalized.normalizedPath}: ${inspection.reason ?? inspection.status}.`);
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath !== normalized.normalizedPath) throw new Error(`${label} must use its canonical realpath and cannot use an internal alias.`);
  return canonicalPath;
}
function resolveReviewArtifactSnapshots(root, missionId, relativePaths, label = "reviewed artifacts", options = {}) {
  if (!Array.isArray(relativePaths)) throw new Error(`${label} must be an array of project-relative paths.`);
  const ownership = readArtifactOwnership(root);
  const ownerByPath = new Map(ownership.artifacts.map((item) => [item.path, item]));
  const snapshots = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, relativePath] of relativePaths.entries()) {
    if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error(`${label}[${index}] must be a non-empty path.`);
    const canonicalPath = canonicalReviewArtifactPath(root, relativePath, `${label}[${index}]`);
    if (seen.has(canonicalPath)) continue;
    seen.add(canonicalPath);
    const owner = ownerByPath.get(canonicalPath);
    if (!owner) throw new Error(`${label}[${index}] is not a registered schema 7 artifact: ${canonicalPath}.`);
    if (owner.missionId !== missionId) throw new Error(`${label}[${index}] belongs to mission ${owner.missionId}, not ${missionId}.`);
    const inspection = inspectDeclaredPath(root, canonicalPath, { requireNonEmpty: true, rejectBookkeeping: true });
    const snapshot = {
      path: canonicalPath,
      sizeBytes: inspection.sizeBytes,
      sha256: sha256File(path9.resolve(root, canonicalPath))
    };
    if (options.requireOwnershipCurrent !== false && snapshot.sha256 !== owner.sha256) {
      throw new Error(`${label}[${index}] has changed since its latest ownership receipt: ${canonicalPath}.`);
    }
    snapshots.push(snapshot);
  }
  if (snapshots.length === 0) throw new Error(`${label} requires at least one existing non-empty non-bookkeeping mission-owned artifact.`);
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { reviewedArtifacts: snapshots, reviewedArtifactSetSha256: stableSnapshotSetHash(snapshots) };
}
function normalizeReviewSnapshots(value2, label = "reviewedArtifacts") {
  if (!Array.isArray(value2) || value2.length === 0) return { ok: false, snapshots: [], reason: `${label} must contain artifact snapshots` };
  const snapshots = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of value2.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, snapshots: [], reason: `${label}[${index}] must be an object` };
    if (Object.keys(item).some((field) => !["path", "sizeBytes", "sha256"].includes(field))) return { ok: false, snapshots: [], reason: `${label}[${index}] has unknown fields` };
    const normalized = normalizeProjectRelativePath(item.path);
    if (!normalized.ok || normalized.normalizedPath !== item.path || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !HASH_PATTERN2.test(String(item.sha256 ?? ""))) {
      return { ok: false, snapshots: [], reason: `${label}[${index}] is invalid` };
    }
    if (seen.has(item.path)) return { ok: false, snapshots: [], reason: `${label} contains duplicate paths` };
    seen.add(item.path);
    snapshots.push({ path: item.path, sizeBytes: item.sizeBytes, sha256: item.sha256 });
  }
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { ok: true, snapshots, reason: null };
}
function verifyReviewSnapshotSet(root, preparedSnapshots, expectedSetHash) {
  const normalized = normalizeReviewSnapshots(preparedSnapshots);
  const failures = [];
  if (!normalized.ok) return { ok: false, failures: [normalized.reason], reviewedArtifacts: [], reviewedArtifactSetSha256: null };
  const setHash = stableSnapshotSetHash(normalized.snapshots);
  if (setHash !== expectedSetHash) failures.push("reviewed-artifact-set-hash-mismatch");
  for (const prepared of normalized.snapshots) {
    const inspection = inspectDeclaredPath(root, prepared.path, { requireNonEmpty: true, rejectBookkeeping: true });
    if (inspection.status !== "existing") {
      failures.push(`reviewed-artifact-${inspection.status}:${prepared.path}`);
      continue;
    }
    const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
    if (inspection.normalizedPath !== prepared.path || canonicalPath !== prepared.path) {
      failures.push(`reviewed-artifact-path-changed:${prepared.path}`);
      continue;
    }
    const current = { path: canonicalPath, sizeBytes: inspection.sizeBytes, sha256: sha256File(path9.resolve(root, canonicalPath)) };
    if (JSON.stringify(current) !== JSON.stringify(prepared)) failures.push(`reviewed-artifact-changed:${prepared.path}`);
  }
  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    reviewedArtifacts: normalized.snapshots,
    reviewedArtifactSetSha256: setHash
  };
}

// src/core/domain-artifacts.mjs
import crypto5 from "node:crypto";
import fs10 from "node:fs";
import path10 from "node:path";
var SAFE_ID2 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
function domainSafeId(value2, label) {
  const normalized = typeof value2 === "string" ? value2.trim() : "";
  if (!SAFE_ID2.test(normalized)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized;
}
function domainNonEmptyText(value2, label) {
  const normalized = typeof value2 === "string" ? value2.trim() : "";
  if (!normalized) throw new Error(`${label} must be a non-empty string.`);
  return normalized;
}
function domainStringArray(value2, label, options = {}) {
  if (value2 === void 0) return [];
  if (!Array.isArray(value2)) throw new Error(`${label} must be an array of non-empty strings.`);
  const items = value2.map((item, index) => domainNonEmptyText(item, `${label}[${index}]`));
  if (new Set(items).size !== items.length) throw new Error(`${label} must not contain duplicates.`);
  if (options.minItems && items.length < options.minItems) throw new Error(`${label} must contain at least ${options.minItems} item(s).`);
  return items;
}
function assertSealedDomainArgs(args2, fields, label) {
  if (!args2 || typeof args2 !== "object" || Array.isArray(args2)) throw new Error(`${label} arguments must be a plain object.`);
  const unknown = Object.keys(args2).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function domainJson(value2) {
  return `${JSON.stringify(value2, null, 2)}
`;
}
function domainSha256(value2) {
  return crypto5.createHash("sha256").update(value2).digest("hex");
}
function readCurrentMission(root, missionId, operation = "Domain workflow") {
  const workspace = openDoveWorkspace(root, { operation });
  const normalizedMissionId = domainSafeId(missionId, "missionId");
  const relativePath = path10.posix.join(ARTIFACT_PATHS.missionsDir, `${normalizedMissionId}.json`);
  const fullPath = path10.resolve(root, relativePath);
  if (!fs10.existsSync(fullPath)) throw new Error(`Mission does not exist: ${normalizedMissionId}.`);
  const mission = readJson(root, relativePath, null);
  const current = assertCurrentMissionContract(mission);
  if (mission.workspaceId !== workspace.manifest.workspaceId) throw new Error(`Mission ${normalizedMissionId} belongs to a different workspace.`);
  return { workspace, mission, current, relativePath };
}
function canonicalDomainPath(rawPath, label, requiredPrefix = null) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) throw new Error(`${label} has an unsafe path: ${normalized.reason}.`);
  const supplied = String(rawPath).trim().replace(/\\/gu, "/");
  if (normalized.normalizedPath !== supplied) throw new Error(`${label} must use a canonical project-relative path.`);
  if (requiredPrefix && normalized.normalizedPath !== requiredPrefix && !normalized.normalizedPath.startsWith(`${requiredPrefix}/`)) {
    throw new Error(`${label} must stay under ${requiredPrefix}.`);
  }
  return normalized.normalizedPath;
}
function currentFileHash(root, relativePath, label) {
  const inspection = inspectDeclaredPath(root, relativePath, { requireNonEmpty: true });
  if (inspection.status !== "existing") throw new Error(`${label} must reference an existing non-empty regular file (${inspection.reason ?? inspection.status}).`);
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath !== relativePath) throw new Error(`${label} must use the canonical realpath-contained path.`);
  return { path: canonicalPath, sha256: sha256File(path10.resolve(root, canonicalPath)) };
}
function isDoveLessonArtifactPath(rawPath) {
  const normalized = normalizeProjectRelativePath(rawPath);
  return normalized.ok && (normalized.normalizedPath === ARTIFACT_PATHS.lessonsDir || normalized.normalizedPath.startsWith(`${ARTIFACT_PATHS.lessonsDir}/`));
}
function assertNotDoveLessonArtifactPath(rawPath, label = "artifact") {
  if (isDoveLessonArtifactPath(rawPath)) {
    throw new Error(`${label} must not use a Dove lesson as substantive artifact or evidence.`);
  }
}
function resolveMissionArtifactReferences(root, missionId, references = [], label = "artifactRefs") {
  const normalized = domainStringArray(references, label);
  if (normalized.length === 0) return [];
  const ownership = readArtifactOwnership(root);
  const byPath = new Map(ownership.artifacts.map((item) => [item.path, item]));
  return normalized.map((rawPath, index) => {
    const artifactPath = canonicalDomainPath(rawPath, `${label}[${index}]`);
    assertNotDoveLessonArtifactPath(artifactPath, `${label}[${index}]`);
    const owner = byPath.get(artifactPath);
    if (!owner) throw new Error(`${label}[${index}] is not a registered schema 7 artifact: ${artifactPath}.`);
    if (owner.missionId !== missionId) throw new Error(`${label}[${index}] belongs to mission ${owner.missionId}, not ${missionId}.`);
    const current = currentFileHash(root, artifactPath, `${label}[${index}]`);
    if (current.sha256 !== owner.sha256) throw new Error(`${label}[${index}] has changed since its latest ownership receipt: ${artifactPath}.`);
    return { ...owner, ...current };
  });
}
function normalizeWrite(root, missionId, item, index, options = {}) {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`domainWrites[${index}] must be an object.`);
  const relativePath = canonicalDomainPath(item.path, `domainWrites[${index}].path`, ".dove");
  if (isDoveLessonArtifactPath(relativePath) && options.allowLessonArtifacts !== true) {
    throw new Error(`domainWrites[${index}].path may create a Dove lesson only through record_dove_lesson.`);
  }
  if (options.allowLessonArtifacts === true && !isDoveLessonArtifactPath(relativePath)) {
    throw new Error(`domainWrites[${index}].path must stay under ${ARTIFACT_PATHS.lessonsDir} for lesson recording.`);
  }
  const kind = domainNonEmptyText(item.kind, `domainWrites[${index}].kind`);
  if (!["report", "document", "code", "data", "figure", "media", "other"].includes(kind)) throw new Error(`domainWrites[${index}].kind is unsupported.`);
  const content = Buffer.isBuffer(item.content) ? item.content : Buffer.from(String(item.content ?? ""), "utf8");
  if (content.byteLength === 0) throw new Error(`domainWrites[${index}].content must be non-empty.`);
  const context = currentMutationContext(root);
  context.resolve(relativePath);
  if (Buffer.isBuffer(item.content) && isPatchPlanMode(root) && path10.extname(relativePath).toLowerCase() !== ".svg") {
    throw new Error(`domainWrites[${index}] patch-plan cannot safely represent binary artifact ${relativePath}; import PNG, JPEG, or PDF output in direct-process mode.`);
  }
  const derivedReferences = domainStringArray(item.derivedReferences, `domainWrites[${index}].derivedReferences`);
  return {
    path: relativePath,
    kind,
    content,
    encoding: Buffer.isBuffer(item.content) ? "binary" : "utf8",
    sha256: domainSha256(content),
    missionId,
    derivedReferences
  };
}
function mergeDerivedReferences(lineageUpdate, writes, receipt) {
  const byPath = new Map(writes.map((item) => [item.path, item.derivedReferences]));
  const criterionRefs = new Map(receipt.artifacts.map((artifact) => [artifact.path, []]));
  for (const criterion of receipt.criteriaSatisfied) {
    for (const reference of criterion.evidenceRefs) {
      if (!reference.startsWith("artifact:")) continue;
      const artifactPath = reference.slice("artifact:".length);
      criterionRefs.get(artifactPath)?.push(`criterion:${criterion.criterionId}`);
    }
  }
  lineageUpdate.lineage.artifacts = lineageUpdate.lineage.artifacts.map((item) => {
    if (!byPath.has(item.path)) return item;
    return {
      ...item,
      derivedReferences: [.../* @__PURE__ */ new Set([...byPath.get(item.path) ?? [], ...criterionRefs.get(item.path) ?? []])].sort()
    };
  });
  return lineageUpdate;
}
function finalizeDomainArtifacts(root, options = {}) {
  const actionId = domainNonEmptyText(options.actionId, "actionId");
  assertGovernanceMutationRegistered(actionId, options.governanceMode ?? "guarded");
  const context = currentMutationContext(root);
  if (!context) throw new Error(`${actionId} requires an active MutationContext.`);
  const { workspace, mission } = readCurrentMission(root, options.missionId, options.operation ?? actionId);
  if (!Array.isArray(options.writes) || options.writes.length === 0) throw new Error(`${actionId} requires at least one real domain artifact write.`);
  const writes = options.writes.map((item, index) => normalizeWrite(root, mission.missionId, item, index, {
    allowLessonArtifacts: options.allowLessonArtifacts === true && actionId === "record-dove-lesson"
  }));
  const duplicatePath = writes.map((item) => item.path).find((item, index, items) => items.indexOf(item) !== index);
  if (duplicatePath) throw new Error(`${actionId} contains duplicate artifact path ${duplicatePath}.`);
  const receiptId = `receipt-${actionId}-${crypto5.randomUUID()}`;
  const receiptPath = path10.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
  if (context.fileExists(receiptPath)) throw new Error(`Generated execution receipt id is occupied: ${receiptId}.`);
  const ownershipBeforeWrite = readArtifactOwnership(root);
  const ownerByPath = new Map(ownershipBeforeWrite.artifacts.map((item) => [item.path, item]));
  for (const item of writes) {
    if (!context.fileExists(item.path)) continue;
    if (isDoveLessonArtifactPath(item.path)) {
      throw new Error(`${actionId} refuses to overwrite immutable lesson artifact ${item.path}.`);
    }
    const owner = ownerByPath.get(item.path);
    if (!owner) throw new Error(`${actionId} refuses to overwrite unowned existing artifact ${item.path}.`);
    if (owner.missionId !== mission.missionId) throw new Error(`${actionId} refuses to overwrite artifact ${item.path} owned by mission ${owner.missionId}.`);
    const current = currentFileHash(root, item.path, item.path);
    if (current.sha256 !== owner.sha256) throw new Error(`${actionId} refuses to overwrite drifted artifact ${item.path}.`);
  }
  const artifacts = writes.map(({ path: artifactPath, kind, sha256: sha2564 }) => ({ path: artifactPath, kind, sha256: sha2564 }));
  const completionEligible = false;
  const criteriaSatisfied = [];
  const receipt = {
    schemaVersion: 1,
    workspaceId: workspace.manifest.workspaceId,
    receiptId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    summary: domainNonEmptyText(options.summary, "summary"),
    artifacts,
    validations: [],
    criteriaSatisfied,
    producedAt: nowIso()
  };
  const lineageUpdate = mergeDerivedReferences(prepareArtifactLineageUpdate(root, receipt), writes, receipt);
  for (const item of writes) {
    if (item.encoding === "binary") {
      if (isPatchPlanMode(root)) {
        writeText(root, item.path, item.content.toString("utf8"));
      } else {
        context.writeBinary(item.path, item.content);
      }
    } else writeText(root, item.path, item.content.toString("utf8"));
  }
  writeJson(root, receiptPath, receipt);
  writeJson(root, ARTIFACT_PATHS.artifactOwnership, lineageUpdate.ownership);
  writeJson(root, ARTIFACT_PATHS.artifactLineage, lineageUpdate.lineage);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "planned" : "recorded",
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    receipt,
    artifacts,
    completionEligible,
    mutation: {
      mutationMode: context.mutationMode,
      writesApplied: !plannedOnly,
      paths: [...writes.map((item) => item.path), receiptPath, ARTIFACT_PATHS.artifactOwnership, ARTIFACT_PATHS.artifactLineage]
    }
  };
}

// src/core/source-trust.mjs
import fs11 from "node:fs";
import path11 from "node:path";
var SOURCE_LIFECYCLE_STATES = Object.freeze(["candidate", "verified", "rejected"]);
var REGISTER_FIELDS = /* @__PURE__ */ new Set(["missionId", "sourceId", "citationKey", "title", "authors", "year", "locator", "sourceType", "abstract", "origin", "capturePath"]);
var REJECT_FIELDS = /* @__PURE__ */ new Set(["missionId", "sourceId", "method", "checkedMaterial", "auditEvidence"]);
var QUERY_FIELDS = /* @__PURE__ */ new Set(["missionId", "sourceId", "lifecycle", "limit"]);
function normalizeText(value2) {
  return typeof value2 === "string" ? value2.trim().replace(/\s+/gu, " ") : "";
}
function normalizeIdentityText(value2) {
  return normalizeText(value2).normalize("NFKC").toLowerCase();
}
function normalizeDoi(value2) {
  const text = normalizeIdentityText(value2).replace(/^https?:\/\/(?:dx\.)?doi\.org\//u, "");
  return text.startsWith("10.") ? text : "";
}
function normalizeUrl(value2) {
  const text = normalizeText(value2);
  if (!text) return "";
  try {
    const parsed2 = new URL(text);
    if (!["http:", "https:"].includes(parsed2.protocol)) return "";
    parsed2.hash = "";
    parsed2.hostname = parsed2.hostname.toLowerCase();
    if (parsed2.protocol === "https:" && parsed2.port === "443" || parsed2.protocol === "http:" && parsed2.port === "80") parsed2.port = "";
    return parsed2.toString();
  } catch {
    return "";
  }
}
function canonicalSourceIdentity(source = {}) {
  return {
    doi: normalizeDoi(source.doi) || normalizeDoi(source.locator),
    url: normalizeUrl(source.url) || normalizeUrl(source.locator),
    locator: normalizeIdentityText(source.locator),
    title: normalizeIdentityText(source.title),
    authors: (Array.isArray(source.authors) ? source.authors : []).map(normalizeIdentityText).filter(Boolean).sort()
  };
}
function sourceIdentityFingerprint(source = {}) {
  return domainSha256(JSON.stringify(canonicalSourceIdentity(source)));
}
function sourcePath(sourceId) {
  return path11.posix.join(".dove/sources", `${sourceId}.json`);
}
function notePath(noteId) {
  return path11.posix.join(".dove/notes", `${noteId}.json`);
}
function readSourceFiles(root) {
  openDoveWorkspace(root, { operation: "Source query" });
  const directory = path11.resolve(root, ".dove/sources");
  return fs11.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => readJson(root, path11.posix.join(".dove/sources", entry.name), null)).filter((item) => item && item.schemaVersion === 1 && item.sourceId).sort((left, right) => String(left.sourceId).localeCompare(String(right.sourceId)));
}
function capturedMaterial(root, capturePath) {
  if (!capturePath) return null;
  const canonicalPath = canonicalDomainPath(capturePath, "capturePath");
  const inspection = inspectDeclaredPath(root, canonicalPath, { requireNonEmpty: true });
  if (inspection.status !== "existing") throw new Error(`capturePath must reference an existing non-empty regular file (${inspection.reason ?? inspection.status}).`);
  const resolved = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (resolved !== canonicalPath) throw new Error("capturePath must use its canonical realpath-contained path.");
  return { path: resolved, sha256: domainSha256(fs11.readFileSync(path11.resolve(root, resolved))) };
}
function sourceRecord(root, args2, capturedMaterial2, current = null) {
  const missionId = domainSafeId(args2.missionId, "missionId");
  const sourceId = domainSafeId(args2.sourceId, "sourceId");
  const title = normalizeText(args2.title);
  const locator = normalizeText(args2.locator);
  if (!title && !locator) throw new Error("register_source requires a real title or locator.");
  const authors = domainStringArray(args2.authors, "authors");
  const identityFields = { title, authors, locator };
  const fingerprint = sourceIdentityFingerprint(identityFields);
  return {
    schemaVersion: 1,
    sourceId,
    missionId,
    citationKey: normalizeText(args2.citationKey) || null,
    title: title || null,
    authors,
    year: args2.year === void 0 || args2.year === null || String(args2.year).trim() === "" ? null : String(args2.year).trim(),
    locator: locator || null,
    sourceType: normalizeText(args2.sourceType) || null,
    abstract: normalizeText(args2.abstract) || null,
    origin: normalizeText(args2.origin) || null,
    identityFingerprint: fingerprint,
    capturedMaterial: capturedMaterial2,
    lifecycle: "candidate",
    currentDecision: {
      decision: "candidate",
      decidedAt: (/* @__PURE__ */ new Date()).toISOString(),
      reason: current ? "source-registration-refreshed" : "source-registered"
    }
  };
}
function registerSource(root, args2 = {}) {
  assertSealedDomainArgs(args2, REGISTER_FIELDS, "register_source");
  const { mission } = readCurrentMission(root, args2.missionId, "Source registration");
  const sourceId = domainSafeId(args2.sourceId, "sourceId");
  const relativePath = sourcePath(sourceId);
  const existing = fs11.existsSync(path11.resolve(root, relativePath)) ? readJson(root, relativePath, null) : null;
  if (existing && existing.missionId !== mission.missionId) throw new Error(`Source ${args2.sourceId} belongs to mission ${existing.missionId}.`);
  const captured = capturedMaterial(root, args2.capturePath);
  const materialPath = captured ? path11.posix.join(".dove/sources/materials", `${sourceId}${path11.extname(captured.path).toLowerCase() || ".bin"}`) : null;
  const sourceMaterial = captured ? { path: materialPath, sha256: captured.sha256 } : null;
  const source = sourceRecord(root, args2, sourceMaterial, existing);
  const writes = [{ path: relativePath, kind: "data", content: domainJson(source), derivedReferences: source.capturedMaterial ? [`artifact:${source.capturedMaterial.path}`] : [] }];
  if (captured) writes.unshift({ path: materialPath, kind: "document", content: fs11.readFileSync(path11.resolve(root, captured.path)), derivedReferences: [] });
  return {
    ...finalizeDomainArtifacts(root, {
      actionId: "register-source",
      operation: "Source registration",
      missionId: mission.missionId,
      summary: `Registered source candidate ${source.sourceId}.`,
      completionEligible: false,
      writes
    }),
    source
  };
}
function normalizeAuditEvidence(value2) {
  if (!Array.isArray(value2) || value2.length === 0) throw new Error("verify_source requires at least one auditEvidence item.");
  return value2.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`auditEvidence[${index}] must be an object.`);
    const unknown = Object.keys(item).filter((field) => !["reference", "kind", "observation"].includes(field));
    if (unknown.length) throw new Error(`auditEvidence[${index}] does not accept unknown fields: ${unknown.join(", ")}.`);
    return {
      reference: domainNonEmptyText(item.reference, `auditEvidence[${index}].reference`),
      kind: domainNonEmptyText(item.kind, `auditEvidence[${index}].kind`),
      observation: domainNonEmptyText(item.observation, `auditEvidence[${index}].observation`)
    };
  });
}
function verifySource(root, args2 = {}) {
  assertSealedDomainArgs(args2, REJECT_FIELDS, "verify_source");
  const { mission } = readCurrentMission(root, args2.missionId, "Source rejection");
  const sourceId = domainSafeId(args2.sourceId, "sourceId");
  const relativePath = sourcePath(sourceId);
  const source = readJson(root, relativePath, null);
  if (!source) throw new Error(`Unknown source: ${sourceId}.`);
  if (source.missionId !== mission.missionId) throw new Error(`Source ${sourceId} belongs to mission ${source.missionId}.`);
  const next = {
    ...source,
    lifecycle: "rejected",
    currentDecision: {
      decision: "rejected",
      method: domainNonEmptyText(args2.method, "method"),
      checkedMaterial: domainNonEmptyText(args2.checkedMaterial, "checkedMaterial"),
      auditEvidence: normalizeAuditEvidence(args2.auditEvidence),
      decidedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  };
  return {
    ...finalizeDomainArtifacts(root, {
      actionId: "verify-source",
      operation: "Source rejection",
      missionId: mission.missionId,
      summary: `Rejected source ${sourceId}.`,
      completionEligible: false,
      writes: [{ path: relativePath, kind: "data", content: domainJson(next), derivedReferences: [] }]
    }),
    source: next
  };
}
function sourceEligibility(source, _verifications = [], options = {}) {
  if (!source) return { eligible: false, reason: "unknown-source", source: null, verification: null };
  const missionId = normalizeText(options.missionId);
  if (!missionId || source.missionId !== missionId) return { eligible: false, reason: "source-mission-binding-mismatch", source, verification: source.currentDecision ?? null };
  if (source.identityFingerprint !== sourceIdentityFingerprint(source)) return { eligible: false, reason: "source-identity-changed", source, verification: source.currentDecision ?? null };
  if (source.lifecycle !== "verified" || source.currentDecision?.decision !== "verified") return { eligible: false, reason: `source-${source.lifecycle ?? "candidate"}`, source, verification: source.currentDecision ?? null };
  if (!source.capturedMaterial) return { eligible: false, reason: "source-captured-material-missing", source, verification: source.currentDecision };
  const material = capturedMaterial(options.root, source.capturedMaterial.path);
  if (!material || material.sha256 !== source.capturedMaterial.sha256 || source.currentDecision.materialHash !== material.sha256) return { eligible: false, reason: "source-verification-material-changed", source, verification: source.currentDecision };
  const receipt = readJson(options.root, executionReceiptPath(source.currentDecision.receiptId), null);
  if (!receipt || receipt.missionId !== missionId || !receipt.artifacts.some((item) => item.path === material.path && item.sha256 === material.sha256)) return { eligible: false, reason: "source-verification-receipt-invalid", source, verification: source.currentDecision };
  return { eligible: true, reason: "verified-source", source, verification: source.currentDecision };
}
function evaluateSourceReferences(root, references = [], missionId = null) {
  const sources = readSourceFiles(root);
  const byReference = new Map(sources.flatMap((source) => [source.sourceId, source.citationKey, source.locator].filter(Boolean).map((reference) => [reference, source])));
  return references.map((reference) => ({ reference, ...sourceEligibility(byReference.get(reference) ?? null, [], { root, missionId }) }));
}
function evaluateNoteReferences(root, references = [], missionId = null) {
  return references.map((reference) => {
    const note = readJson(root, notePath(reference), null);
    if (!note) return { reference, eligible: false, reason: "unknown-note", note: null, sources: [], artifacts: [] };
    if (!missionId || note.missionId !== missionId) return { reference, eligible: false, reason: "note-mission-binding-mismatch", note, sources: [], artifacts: [] };
    const sourceIds = Array.isArray(note.sourceIds) ? note.sourceIds : [];
    const artifactRefs = Array.isArray(note.artifactRefs) ? note.artifactRefs : [];
    if (sourceIds.length === 0 && artifactRefs.length === 0) return { reference, eligible: false, reason: "note-evidence-missing", note, sources: [], artifacts: [] };
    const sources = evaluateSourceReferences(root, sourceIds, missionId);
    const sourceFailure = sources.find((item) => !item.eligible);
    const ownership = readJson(root, ARTIFACT_PATHS.artifactOwnership, { artifacts: [] });
    const owned = new Map((ownership.artifacts ?? []).map((item) => [item.path, item]));
    const artifacts = artifactRefs.map((artifactPath) => {
      const owner = owned.get(artifactPath);
      if (!owner) return { path: artifactPath, current: false, reason: "artifact-ownership-missing" };
      if (owner.missionId !== missionId) return { path: artifactPath, current: false, reason: "artifact-mission-binding-mismatch" };
      const inspection = inspectDeclaredPath(root, artifactPath, { requireNonEmpty: true });
      if (inspection.status !== "existing") return { path: artifactPath, current: false, reason: inspection.reason ?? inspection.status };
      const currentHash2 = domainSha256(fs11.readFileSync(path11.resolve(root, artifactPath)));
      return { path: artifactPath, current: currentHash2 === owner.sha256, reason: currentHash2 === owner.sha256 ? "current-artifact" : "artifact-hash-drift" };
    });
    const artifactFailure = artifacts.find((item) => !item.current);
    const failure = sourceFailure?.reason ?? artifactFailure?.reason ?? null;
    return { reference, eligible: !failure, reason: failure ?? "verified-note", note, sources, artifacts };
  });
}
function querySources(root, args2 = {}) {
  assertSealedDomainArgs(args2, QUERY_FIELDS, "query_sources");
  const { mission } = readCurrentMission(root, args2.missionId, "Source query");
  const sourceId = normalizeText(args2.sourceId);
  const lifecycle = normalizeText(args2.lifecycle).toLowerCase();
  const limit = Math.min(200, Math.max(1, Number.isFinite(Number(args2.limit)) ? Math.trunc(Number(args2.limit)) : 50));
  const items = readSourceFiles(root).filter((source) => source.missionId === mission.missionId).filter((source) => !sourceId || [source.sourceId, source.citationKey, source.locator].includes(sourceId)).filter((source) => !lifecycle || source.lifecycle === lifecycle).slice(0, limit).map((source) => {
    const eligibility = sourceEligibility(source, [], { root, missionId: mission.missionId });
    return { ...source, eligibility: { eligible: eligibility.eligible, reason: eligibility.reason } };
  });
  return { status: items.length ? "ok" : "empty", missionId: mission.missionId, sourceCount: items.length, items, writes: [] };
}

// src/core/execution-receipts.mjs
var EXECUTION_RECEIPT_SCHEMA_VERSION = 1;
var EXECUTION_RECEIPT_ARTIFACT_KINDS = Object.freeze(["report", "document", "code", "data", "figure", "media", "other"]);
var EXECUTION_RECEIPT_VALIDATION_KINDS = Object.freeze(["test-log", "typecheck-log", "lint-log", "build-log", "audit-log", "validation-log", "command-output"]);
var ARTIFACT_KIND_SET = new Set(EXECUTION_RECEIPT_ARTIFACT_KINDS);
var VALIDATION_KIND_SET = new Set(EXECUTION_RECEIPT_VALIDATION_KINDS);
var TOP_LEVEL_FIELDS = /* @__PURE__ */ new Set([
  "receiptId",
  "missionId",
  "contractDigest",
  "summary",
  "artifacts",
  "validations",
  "criteriaSatisfied",
  "producedAt"
]);
var ARTIFACT_FIELDS = /* @__PURE__ */ new Set(["path", "kind", "sha256"]);
var VALIDATION_FIELDS = /* @__PURE__ */ new Set(["kind", "reference", "outputHash"]);
var CRITERION_FIELDS = /* @__PURE__ */ new Set(["criterionId", "evidenceRefs"]);
var RECEIPT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH_PATTERN3 = /^[0-9a-f]{64}$/u;
var EVIDENCE_REF_PATTERN = /^(artifact|validation|source|note):(.+)$/u;
function assertPlainObject5(value2, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertAllowedFields3(value2, allowed, label) {
  assertPlainObject5(value2, label);
  const unknown = Object.keys(value2).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function nonEmptyString2(value2, label) {
  if (typeof value2 !== "string" || !value2.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value2.trim();
}
function hashString(value2, label) {
  const hash2 = nonEmptyString2(value2, label).toLowerCase();
  if (!HASH_PATTERN3.test(hash2)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  }
  return hash2;
}
function safeId2(value2, label) {
  const id = nonEmptyString2(value2, label);
  if (!RECEIPT_ID_PATTERN.test(id)) {
    throw new Error(`${label} must start with a lowercase letter or digit and contain only lowercase letters, digits, dot, underscore, or hyphen.`);
  }
  return id;
}
function parseProducedAt(value2) {
  const producedAt = nonEmptyString2(value2, "producedAt");
  const timestamp = Date.parse(producedAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== producedAt) {
    throw new Error("producedAt must be an exact ISO-8601 timestamp.");
  }
  return producedAt;
}
function executionReceiptPath(receiptId) {
  return path12.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
}
function missionContractPath(missionId) {
  return path12.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}
function inspectHashedFile(root, rawPath, expectedHash, label) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    throw new Error(`${label} has an unsafe path ${JSON.stringify(rawPath)}: ${normalized.reason}.`);
  }
  if (normalized.normalizedPath !== rawPath.trim().replace(/\\/gu, "/")) {
    throw new Error(`${label} path must be canonical: ${rawPath}.`);
  }
  const inspection = inspectDeclaredPath(root, normalized.normalizedPath, { requireNonEmpty: true });
  if (inspection.status !== "existing") {
    throw new Error(`${label} must be a safe existing non-empty regular file: ${normalized.normalizedPath} (${inspection.reason ?? inspection.status}).`);
  }
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath !== normalized.normalizedPath) {
    throw new Error(`${label} must use its canonical realpath-contained path; alias ${normalized.normalizedPath} resolves to ${canonicalPath}.`);
  }
  const actualHash = sha256File(path12.resolve(root, canonicalPath));
  if (actualHash !== expectedHash) {
    throw new Error(`${label} SHA-256 mismatch for ${canonicalPath}.`);
  }
  return { path: canonicalPath, sha256: actualHash };
}
function normalizeArtifacts(root, mission, value2) {
  if (!Array.isArray(value2) || value2.length === 0) {
    throw new Error("artifacts must contain at least one artifact.");
  }
  const seen = /* @__PURE__ */ new Set();
  const artifacts = value2.map((item, index) => {
    const label = `artifacts[${index}]`;
    assertAllowedFields3(item, ARTIFACT_FIELDS, label);
    const rawPath = nonEmptyString2(item.path, `${label}.path`);
    const kind = nonEmptyString2(item.kind, `${label}.kind`);
    if (!ARTIFACT_KIND_SET.has(kind)) {
      throw new Error(`${label}.kind must be one of: ${EXECUTION_RECEIPT_ARTIFACT_KINDS.join(", ")}.`);
    }
    const sha2564 = hashString(item.sha256, `${label}.sha256`);
    const inspected = inspectHashedFile(root, rawPath, sha2564, label);
    assertNotDoveLessonArtifactPath(inspected.path, `${label}.path`);
    if (seen.has(inspected.path)) throw new Error(`artifacts contains duplicate canonical path ${inspected.path}.`);
    seen.add(inspected.path);
    return { path: inspected.path, kind, sha256: sha2564 };
  });
  const requiredArtifacts = /* @__PURE__ */ new Set([
    ...Array.isArray(mission.targetArtifacts) ? mission.targetArtifacts : [],
    ...Array.isArray(mission.expectedArtifacts) ? mission.expectedArtifacts : []
  ]);
  const missing = [...requiredArtifacts].filter((artifactPath) => !seen.has(artifactPath));
  if (missing.length > 0) {
    throw new Error(`artifacts is missing mission target or expected artifacts: ${missing.join(", ")}.`);
  }
  return artifacts;
}
function normalizeValidations(root, value2) {
  if (value2 === void 0) return [];
  if (!Array.isArray(value2)) throw new Error("validations must be an array.");
  const seen = /* @__PURE__ */ new Set();
  return value2.map((item, index) => {
    const label = `validations[${index}]`;
    assertAllowedFields3(item, VALIDATION_FIELDS, label);
    const kind = nonEmptyString2(item.kind, `${label}.kind`);
    if (!VALIDATION_KIND_SET.has(kind)) {
      throw new Error(`${label}.kind must be one of: ${EXECUTION_RECEIPT_VALIDATION_KINDS.join(", ")}.`);
    }
    const reference = nonEmptyString2(item.reference, `${label}.reference`);
    const outputHash = hashString(item.outputHash, `${label}.outputHash`);
    const inspected = inspectHashedFile(root, reference, outputHash, label);
    assertNotDoveLessonArtifactPath(inspected.path, `${label}.reference`);
    const evidenceRole = artifactEvidenceRole(inspected.path);
    if (evidenceRole === "bookkeeping") {
      throw new Error(`${label}.reference must be validation output rather than Dove bookkeeping: ${inspected.path}.`);
    }
    if (seen.has(inspected.path)) throw new Error(`validations contains duplicate canonical reference ${inspected.path}.`);
    seen.add(inspected.path);
    return { kind, reference: inspected.path, outputHash };
  });
}
function typedReferenceEvaluation(root, missionId, reference) {
  const match = EVIDENCE_REF_PATTERN.exec(reference);
  if (!match) return { eligible: false, reason: "unknown-evidence-reference-kind" };
  const [, kind, value2] = match;
  if (kind === "source") {
    return evaluateSourceReferences(root, [value2], missionId)[0] ?? { eligible: false, reason: "unknown-source" };
  }
  if (kind === "note") {
    return evaluateNoteReferences(root, [value2], missionId)[0] ?? { eligible: false, reason: "unknown-note" };
  }
  return { eligible: null, kind, value: value2 };
}
function normalizeCriteria(root, mission, value2, artifacts, validations) {
  const requiredCriteria = missionCompletionCriteria(mission);
  if (!Array.isArray(value2)) throw new Error("criteriaSatisfied must be an array.");
  const requiredIds = new Set(requiredCriteria.map((item) => item.criterionId));
  const artifactRefs = new Set(artifacts.map((artifact) => `artifact:${artifact.path}`));
  const validationRefs = new Set(validations.map((validation) => `validation:${validation.reference}`));
  const seen = /* @__PURE__ */ new Set();
  const criteria = value2.map((item, index) => {
    const label = `criteriaSatisfied[${index}]`;
    assertAllowedFields3(item, CRITERION_FIELDS, label);
    const criterionId = nonEmptyString2(item.criterionId, `${label}.criterionId`);
    if (!requiredIds.has(criterionId)) throw new Error(`${label}.criterionId is unknown for the current mission: ${criterionId}.`);
    if (seen.has(criterionId)) throw new Error(`criteriaSatisfied contains duplicate criterionId ${criterionId}.`);
    seen.add(criterionId);
    if (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0) {
      throw new Error(`${label}.evidenceRefs must contain at least one resolvable evidence reference; summary is not evidence.`);
    }
    const evidenceRefs = item.evidenceRefs.map((reference, evidenceIndex) => {
      const normalized = nonEmptyString2(reference, `${label}.evidenceRefs[${evidenceIndex}]`);
      if (artifactRefs.has(normalized) || validationRefs.has(normalized)) return normalized;
      const evaluation = typedReferenceEvaluation(root, mission.missionId, normalized);
      if (evaluation.eligible === true) return normalized;
      throw new Error(`${label}.evidenceRefs[${evidenceIndex}] is not current eligible typed evidence: ${normalized} (${evaluation.reason ?? "unresolved"}).`);
    });
    if (new Set(evidenceRefs).size !== evidenceRefs.length) throw new Error(`${label}.evidenceRefs contains duplicates.`);
    return { criterionId, evidenceRefs };
  });
  const missing = requiredCriteria.filter((item) => !seen.has(item.criterionId));
  if (missing.length > 0) {
    throw new Error(`criteriaSatisfied is missing mission completion criteria: ${missing.map((item) => item.criterionId).join(", ")}.`);
  }
  return criteria;
}
function validateExecutionReceipt(root, args2 = {}) {
  const workspace = openDoveWorkspace(root, { operation: "Execution receipt validation" });
  assertAllowedFields3(args2, TOP_LEVEL_FIELDS, "ingest_execution_receipt");
  const receiptId = safeId2(args2.receiptId, "receiptId");
  const missionId = safeId2(args2.missionId, "missionId");
  const contractDigest = hashString(args2.contractDigest, "contractDigest");
  const summary = nonEmptyString2(args2.summary, "summary");
  const producedAt = parseProducedAt(args2.producedAt);
  const missionRelativePath = missionContractPath(missionId);
  if (!fs12.existsSync(path12.resolve(root, missionRelativePath))) {
    throw new Error(`Mission does not exist: ${missionId}.`);
  }
  const mission = readJson(root, missionRelativePath, null);
  if (!mission || mission.missionId !== missionId) throw new Error(`Mission contract is malformed or mismatched: ${missionId}.`);
  const currentContract = assertCurrentMissionContract(mission);
  if (mission.workspaceId !== workspace.manifest.workspaceId) throw new Error(`Mission contract workspaceId does not match the current workspace for ${missionId}.`);
  if (contractDigest !== currentContract.contractDigest) throw new Error(`contractDigest does not match the current mission contract for ${missionId}.`);
  const receiptRelativePath = executionReceiptPath(receiptId);
  const mutationContext = currentMutationContext(root);
  if (mutationContext ? mutationContext.fileExists(receiptRelativePath) : fs12.existsSync(path12.resolve(root, receiptRelativePath))) {
    throw new Error(`Execution receipt id is already occupied: ${receiptId}.`);
  }
  const artifacts = normalizeArtifacts(root, mission, args2.artifacts);
  const validations = normalizeValidations(root, args2.validations);
  const criteriaSatisfied = normalizeCriteria(root, mission, args2.criteriaSatisfied, artifacts, validations);
  const receipt = {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    receiptId,
    missionId,
    contractDigest,
    summary,
    artifacts,
    validations,
    criteriaSatisfied,
    producedAt
  };
  const lineageUpdate = prepareArtifactLineageUpdate(root, receipt);
  return {
    mission,
    receipt,
    lineageUpdate
  };
}
function ingestExecutionReceipt(root, args2 = {}) {
  assertGovernanceMutationRegistered("ingest-execution-receipt", "guarded");
  if (!currentMutationContext(root)) throw new Error("ingest_execution_receipt requires an active MutationContext.");
  const { receipt, lineageUpdate } = validateExecutionReceipt(root, args2);
  writeJson(root, executionReceiptPath(receipt.receiptId), receipt);
  writeJson(root, ARTIFACT_PATHS.artifactOwnership, lineageUpdate.ownership);
  writeJson(root, ARTIFACT_PATHS.artifactLineage, lineageUpdate.lineage);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "ingest-planned" : "ingested",
    receipt,
    completion: { missionId: receipt.missionId, assessWith: "assess_mission_completion" },
    mutation: {
      mutationMode: currentMutationContext(root).mutationMode,
      writesApplied: !plannedOnly,
      paths: [executionReceiptPath(receipt.receiptId), ARTIFACT_PATHS.artifactOwnership, ARTIFACT_PATHS.artifactLineage]
    }
  };
}
function readExecutionReceipts(root, missionId = null) {
  openDoveWorkspace(root, { operation: "Execution receipt read" });
  const receiptsRoot = path12.resolve(root, ARTIFACT_PATHS.executionReceiptsDir);
  if (!fs12.existsSync(receiptsRoot)) return [];
  return fs12.readdirSync(receiptsRoot, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => {
    const relativePath = path12.posix.join(ARTIFACT_PATHS.executionReceiptsDir, entry.name);
    try {
      return readJson(root, relativePath, null);
    } catch (error) {
      return {
        schemaVersion: null,
        receiptId: entry.name.slice(0, -".json".length),
        missionId,
        __readFailure: error instanceof Error ? error.message : String(error)
      };
    }
  }).filter((receipt) => receipt && (!missionId || receipt.missionId === missionId || receipt.__readFailure)).sort((left, right) => String(left.producedAt).localeCompare(String(right.producedAt)) || String(left.receiptId).localeCompare(String(right.receiptId)));
}

// src/core/lessons.mjs
import fs13 from "node:fs";
import path13 from "node:path";
var DOVE_LESSON_SCHEMA_VERSION = 1;
var DOVE_LESSON_PROPOSAL_VERSION = 1;
var DOVE_LESSON_SCOPES = Object.freeze(["global", "mission"]);
var DOVE_LESSON_KINDS = Object.freeze(["preference", "constraint", "method", "failure", "review-insight"]);
var LESSON_SCOPE_SET = new Set(DOVE_LESSON_SCOPES);
var LESSON_KIND_SET = new Set(DOVE_LESSON_KINDS);
var RECORD_FIELDS = /* @__PURE__ */ new Set([
  "missionId",
  "lessonId",
  "scope",
  "kind",
  "summary",
  "details",
  "nextTimeGuidance",
  "sourceIds",
  "noteIds",
  "artifactRefs",
  "appliesToArtifactRefs",
  "tags",
  "supersedesLessonId"
]);
var REPLAY_FIELDS = /* @__PURE__ */ new Set([
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "proposalToken",
  "mutationMode",
  "workspaceId",
  "contractDigest",
  "createdAt"
]);
var QUERY_FIELDS2 = /* @__PURE__ */ new Set([
  "lessonId",
  "missionId",
  "scope",
  "kind",
  "tags",
  "artifactRefs",
  "includeSuperseded",
  "includeUnscoped",
  "limit"
]);
function lessonPath(lessonId) {
  return path13.posix.join(ARTIFACT_PATHS.lessonsDir, `${lessonId}.json`);
}
function normalizeOptionalText(value2, label) {
  if (value2 === void 0) return void 0;
  return domainNonEmptyText(value2, label);
}
function normalizeEnum(value2, allowed, label) {
  const normalized = domainNonEmptyText(value2, label).toLowerCase();
  if (!allowed.has(normalized)) throw new Error(`${label} must be one of: ${[...allowed].join(", ")}.`);
  return normalized;
}
function normalizeMutationModeForLesson(root, args2) {
  const explicit = Object.hasOwn(args2, "mutationMode") ? normalizeMutationMode(args2.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (active && explicit && active !== explicit) {
    throw new Error(`record_dove_lesson mutationMode ${explicit} does not match the active mutation context mode ${active}.`);
  }
  return active ?? explicit ?? "direct-process";
}
function readLessons(root) {
  openDoveWorkspace(root, { operation: "Dove lesson read" });
  const directory = path13.resolve(root, ARTIFACT_PATHS.lessonsDir);
  if (!fs13.existsSync(directory)) return [];
  return fs13.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).sort((left, right) => left.name.localeCompare(right.name)).map((entry) => readJson(root, path13.posix.join(ARTIFACT_PATHS.lessonsDir, entry.name), null));
}
function validateEligibleReferences(root, missionId, sourceIds, noteIds) {
  const sources = evaluateSourceReferences(root, sourceIds, missionId);
  const sourceFailure = sources.find((item) => item.eligible !== true);
  if (sourceFailure) throw new Error(`sourceIds contains ineligible current source ${sourceFailure.reference}: ${sourceFailure.reason}.`);
  const notes = evaluateNoteReferences(root, noteIds, missionId);
  const noteFailure = notes.find((item) => item.eligible !== true);
  if (noteFailure) throw new Error(`noteIds contains ineligible current note ${noteFailure.reference}: ${noteFailure.reason}.`);
  return {
    sources: sources.map((item) => ({ reference: item.reference, snapshotDigest: domainSha256(stableWorkspaceSerialize(item.source)) })),
    notes: notes.map((item) => ({ reference: item.reference, snapshotDigest: domainSha256(stableWorkspaceSerialize(item.note)) }))
  };
}
function referenceSnapshots(references) {
  return references.map((reference) => ({ path: reference.path, sha256: reference.sha256 }));
}
function assertSupersession(lessons, candidate) {
  if (!candidate.supersedesLessonId) return null;
  if (candidate.supersedesLessonId === candidate.lessonId) throw new Error("A Dove lesson must not supersede itself.");
  const previous = lessons.find((lesson) => lesson.lessonId === candidate.supersedesLessonId);
  if (!previous) throw new Error(`Cannot supersede unknown lesson ${candidate.supersedesLessonId}.`);
  if (previous.scope !== candidate.scope || previous.kind !== candidate.kind) {
    throw new Error("A Dove lesson may supersede only a lesson with the same scope and kind.");
  }
  if (candidate.scope === "mission" && previous.missionId !== candidate.missionId) {
    throw new Error("A mission-scoped Dove lesson may supersede only a lesson from the same mission.");
  }
  const successor = lessons.find((lesson) => lesson.supersedesLessonId === previous.lessonId);
  if (successor) throw new Error(`Lesson ${previous.lessonId} already has successor ${successor.lessonId}; supersession must not fork.`);
  const seen = /* @__PURE__ */ new Set([candidate.lessonId]);
  let cursor = previous;
  while (cursor) {
    if (seen.has(cursor.lessonId)) throw new Error("Dove lesson supersession must not contain a cycle.");
    seen.add(cursor.lessonId);
    cursor = cursor.supersedesLessonId ? lessons.find((lesson) => lesson.lessonId === cursor.supersedesLessonId) : null;
  }
  return { lessonId: previous.lessonId, createdAt: previous.createdAt };
}
function normalizedRecordInput(args2) {
  const content = {
    lessonId: domainSafeId(args2.lessonId, "lessonId"),
    missionId: domainSafeId(args2.missionId, "missionId"),
    scope: normalizeEnum(args2.scope, LESSON_SCOPE_SET, "scope"),
    kind: normalizeEnum(args2.kind, LESSON_KIND_SET, "kind"),
    summary: domainNonEmptyText(args2.summary, "summary"),
    nextTimeGuidance: domainStringArray(args2.nextTimeGuidance, "nextTimeGuidance", { minItems: 1 }),
    sourceIds: domainStringArray(args2.sourceIds, "sourceIds"),
    noteIds: domainStringArray(args2.noteIds, "noteIds"),
    artifactRefs: domainStringArray(args2.artifactRefs, "artifactRefs"),
    appliesToArtifactRefs: domainStringArray(args2.appliesToArtifactRefs, "appliesToArtifactRefs"),
    tags: domainStringArray(args2.tags, "tags")
  };
  const details = normalizeOptionalText(args2.details, "details");
  if (details !== void 0) content.details = details;
  if (args2.supersedesLessonId !== void 0) content.supersedesLessonId = domainSafeId(args2.supersedesLessonId, "supersedesLessonId");
  return content;
}
function createdAtFor(args2) {
  if (args2.confirmed !== true) return nowIso();
  const createdAt = domainNonEmptyText(args2.createdAt, "createdAt");
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== createdAt) {
    throw new Error("createdAt replay data must be an exact ISO-8601 timestamp.");
  }
  return createdAt;
}
function buildProposal2(root, args2) {
  const content = normalizedRecordInput(args2);
  const { workspace, mission } = readCurrentMission(root, content.missionId, "Dove lesson proposal");
  const mutationMode2 = normalizeMutationModeForLesson(root, args2);
  if (args2.confirmed === true) {
    if (args2.workspaceId !== workspace.manifest.workspaceId) throw new Error("Confirmed Dove lesson replay no longer matches the workspace identity.");
    if (args2.contractDigest !== mission.contractDigest) throw new Error("Confirmed Dove lesson replay no longer matches the mission contract digest.");
  }
  const relativePath = lessonPath(content.lessonId);
  const context = currentMutationContext(root);
  const occupied = context ? context.fileExists(relativePath) : fs13.existsSync(path13.resolve(root, relativePath));
  if (occupied) throw new Error(`Dove lesson id is already occupied: ${content.lessonId}.`);
  const lessons = readLessons(root);
  const evidenceSnapshots = validateEligibleReferences(root, mission.missionId, content.sourceIds, content.noteIds);
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, content.artifactRefs, "artifactRefs");
  const applicability = resolveMissionArtifactReferences(root, mission.missionId, content.appliesToArtifactRefs, "appliesToArtifactRefs");
  const supersession = assertSupersession(lessons, content);
  const createdAt = createdAtFor(args2);
  const lesson = {
    schemaVersion: DOVE_LESSON_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    lessonId: content.lessonId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    scope: content.scope,
    kind: content.kind,
    summary: content.summary,
    ...content.details === void 0 ? {} : { details: content.details },
    nextTimeGuidance: content.nextTimeGuidance,
    sourceIds: content.sourceIds,
    noteIds: content.noteIds,
    artifactRefs: referenceSnapshots(artifacts),
    appliesToArtifactRefs: referenceSnapshots(applicability),
    tags: content.tags,
    ...content.supersedesLessonId === void 0 ? {} : { supersedesLessonId: content.supersedesLessonId },
    createdAt
  };
  const proposalWorkspace = canonicalWorkspacePath(root);
  const envelope = {
    proposalVersion: DOVE_LESSON_PROPOSAL_VERSION,
    proposalWorkspace,
    workspaceId: workspace.manifest.workspaceId,
    mutationMode: mutationMode2,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    lesson,
    evidenceSnapshots,
    supersession
  };
  const proposalDigest = domainSha256(stableWorkspaceSerialize(envelope));
  const proposalToken2 = Buffer.from(JSON.stringify({
    version: DOVE_LESSON_PROPOSAL_VERSION,
    proposalWorkspace,
    proposalDigest,
    lessonId: lesson.lessonId
  }), "utf8").toString("base64url");
  return { content, lesson, envelope, proposalDigest, proposalToken: proposalToken2, relativePath, mutationMode: mutationMode2 };
}
function confirmArgsFor2(proposal) {
  return {
    confirmed: true,
    proposalVersion: DOVE_LESSON_PROPOSAL_VERSION,
    proposalWorkspace: proposal.envelope.proposalWorkspace,
    proposalDigest: proposal.proposalDigest,
    proposalToken: proposal.proposalToken,
    mutationMode: proposal.mutationMode,
    workspaceId: proposal.envelope.workspaceId,
    contractDigest: proposal.envelope.contractDigest,
    createdAt: proposal.lesson.createdAt,
    missionId: proposal.content.missionId,
    lessonId: proposal.content.lessonId,
    scope: proposal.content.scope,
    kind: proposal.content.kind,
    summary: proposal.content.summary,
    ...proposal.content.details === void 0 ? {} : { details: proposal.content.details },
    nextTimeGuidance: proposal.content.nextTimeGuidance,
    sourceIds: proposal.content.sourceIds,
    noteIds: proposal.content.noteIds,
    artifactRefs: proposal.content.artifactRefs,
    appliesToArtifactRefs: proposal.content.appliesToArtifactRefs,
    tags: proposal.content.tags,
    ...proposal.content.supersedesLessonId === void 0 ? {} : { supersedesLessonId: proposal.content.supersedesLessonId }
  };
}
function assertExactReplay2(root, proposal, args2) {
  if (!currentMutationContext(root)) throw new Error("Confirmed Dove lesson recording requires an active MutationContext.");
  if (args2.proposalVersion !== DOVE_LESSON_PROPOSAL_VERSION) throw new Error("The selected Dove lesson proposal version is unsupported. Request a fresh proposal.");
  const expected = confirmArgsFor2(proposal);
  const supplied = Object.fromEntries(Object.entries(args2).filter(([field]) => REPLAY_FIELDS.has(field) || RECORD_FIELDS.has(field)));
  if (stableWorkspaceSerialize(supplied) !== stableWorkspaceSerialize(expected)) {
    throw new Error("The selected Dove lesson proposal no longer matches the exact replay fields, workspace, contract, mutation mode, supersession, or references. Request a fresh proposal.");
  }
}
function mutationMetadata2(proposal, writesApplied, paths = []) {
  return { mutationMode: proposal.mutationMode, writesApplied, paths };
}
function recordDoveLesson(root, args2 = {}) {
  assertSealedDomainArgs(args2, /* @__PURE__ */ new Set([...RECORD_FIELDS, ...REPLAY_FIELDS]), "record_dove_lesson");
  if (args2.confirmed !== true) {
    const replayOnly = Object.keys(args2).filter((field) => REPLAY_FIELDS.has(field) && field !== "mutationMode");
    if (replayOnly.length > 0) {
      throw new Error(`record_dove_lesson proposal does not accept caller replay fields: ${replayOnly.map((field) => `$.${field}`).join(", ")}.`);
    }
  }
  const proposal = buildProposal2(root, args2);
  if (args2.confirmed !== true) {
    const confirmArgs2 = confirmArgsFor2(proposal);
    return {
      status: "needs-confirmation",
      lesson: proposal.lesson,
      proposalDigest: proposal.proposalDigest,
      confirmation: {
        required: true,
        exactReplay: true,
        proposalVersion: DOVE_LESSON_PROPOSAL_VERSION,
        proposalWorkspace: proposal.envelope.proposalWorkspace,
        proposalDigest: proposal.proposalDigest,
        proposalToken: proposal.proposalToken,
        mutationMode: proposal.mutationMode,
        confirmArgs: confirmArgs2
      },
      advisoryOnly: true,
      authority: false,
      completionEligible: false,
      mutation: mutationMetadata2(proposal, false)
    };
  }
  assertExactReplay2(root, proposal, args2);
  const derivedReferences = [
    ...proposal.lesson.sourceIds.map((id) => `source:${id}`),
    ...proposal.lesson.noteIds.map((id) => `note:${id}`),
    ...proposal.lesson.artifactRefs.map((item) => `artifact:${item.path}`),
    ...proposal.lesson.appliesToArtifactRefs.map((item) => `applies-to:${item.path}`),
    ...proposal.lesson.supersedesLessonId ? [`lesson:${proposal.lesson.supersedesLessonId}`] : []
  ];
  const recorded = finalizeDomainArtifacts(root, {
    actionId: "record-dove-lesson",
    operation: "Dove lesson recording",
    missionId: proposal.lesson.missionId,
    summary: `Recorded advisory lesson ${proposal.lesson.lessonId}.`,
    allowLessonArtifacts: true,
    writes: [{
      path: proposal.relativePath,
      kind: "data",
      content: domainJson(proposal.lesson),
      derivedReferences
    }]
  });
  return {
    ...recorded,
    lesson: proposal.lesson,
    advisoryOnly: true,
    authority: false,
    completionEligible: false
  };
}
function assessPinnedArtifacts(root, missionId, references) {
  const ownership = readArtifactOwnership(root);
  const byPath = new Map(ownership.artifacts.map((item) => [item.path, item]));
  return references.map((reference) => {
    const owner = byPath.get(reference.path);
    if (!owner) return { ...reference, current: false, reason: "artifact-ownership-missing" };
    const inspection = inspectDeclaredPath(root, reference.path, { requireNonEmpty: true });
    if (inspection.status !== "existing") return { ...reference, current: false, reason: inspection.reason ?? inspection.status };
    const currentHash2 = sha256File(path13.resolve(root, reference.path));
    const current = currentHash2 === reference.sha256 && owner.sha256 === reference.sha256 && owner.missionId === missionId;
    return { ...reference, current, reason: current ? null : "artifact-hash-or-ownership-drift", actualHash: currentHash2 };
  });
}
function lessonAssessment(root, lesson, successorId, matchedArtifactRefs) {
  const sources = evaluateSourceReferences(root, lesson.sourceIds, lesson.missionId).map((item) => ({ reference: item.reference, current: item.eligible === true, reason: item.reason }));
  const notes = evaluateNoteReferences(root, lesson.noteIds, lesson.missionId).map((item) => ({ reference: item.reference, current: item.eligible === true, reason: item.reason }));
  const artifacts = assessPinnedArtifacts(root, lesson.missionId, lesson.artifactRefs);
  const applicability = assessPinnedArtifacts(root, lesson.missionId, lesson.appliesToArtifactRefs);
  const current = [...sources, ...notes, ...artifacts, ...applicability].every((item) => item.current === true);
  return {
    current,
    superseded: Boolean(successorId),
    successorLessonId: successorId ?? null,
    evidence: { sources, notes, artifacts },
    applicability,
    matchedArtifactRefs
  };
}
function queryDoveLessons(root, args2 = {}) {
  assertSealedDomainArgs(args2, QUERY_FIELDS2, "query_dove_lessons");
  const workspace = openDoveWorkspace(root, { operation: "Dove lesson query" });
  const lessonId = args2.lessonId === void 0 ? null : domainSafeId(args2.lessonId, "lessonId");
  const missionId = args2.missionId === void 0 ? null : domainSafeId(args2.missionId, "missionId");
  const scope = args2.scope === void 0 ? null : normalizeEnum(args2.scope, LESSON_SCOPE_SET, "scope");
  const kind = args2.kind === void 0 ? null : normalizeEnum(args2.kind, LESSON_KIND_SET, "kind");
  const tags = domainStringArray(args2.tags, "tags");
  const artifactRefs = domainStringArray(args2.artifactRefs, "artifactRefs");
  if (artifactRefs.length > 0 && !missionId) throw new Error("Artifact-scoped Dove lesson queries require missionId.");
  if (missionId) readCurrentMission(root, missionId, "Dove lesson query");
  const queryArtifacts = artifactRefs.length > 0 ? resolveMissionArtifactReferences(root, missionId, artifactRefs, "artifactRefs") : [];
  const queryArtifactPaths = new Set(queryArtifacts.map((item) => item.path));
  const includeSuperseded = args2.includeSuperseded === true;
  const includeUnscoped = args2.includeUnscoped === true;
  const limitNumber = args2.limit === void 0 ? 50 : Number(args2.limit);
  if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 200) throw new Error("limit must be an integer from 1 to 200.");
  const lessons = readLessons(root);
  const successorByLesson = new Map(lessons.filter((lesson) => lesson.supersedesLessonId).map((lesson) => [lesson.supersedesLessonId, lesson.lessonId]));
  const items = lessons.filter((lesson) => !lessonId || lesson.lessonId === lessonId).filter((lesson) => missionId ? lesson.scope === "global" || lesson.scope === "mission" && lesson.missionId === missionId : lesson.scope === "global").filter((lesson) => !scope || lesson.scope === scope).filter((lesson) => !kind || lesson.kind === kind).filter((lesson) => tags.every((tag) => lesson.tags.includes(tag))).filter((lesson) => includeSuperseded || !successorByLesson.has(lesson.lessonId)).map((lesson) => {
    const matchedArtifactRefs = lesson.appliesToArtifactRefs.map((item) => item.path).filter((item) => queryArtifactPaths.has(item));
    return { lesson, matchedArtifactRefs };
  }).filter(({ lesson, matchedArtifactRefs }) => queryArtifactPaths.size === 0 || matchedArtifactRefs.length > 0 || includeUnscoped && lesson.appliesToArtifactRefs.length === 0).map(({ lesson, matchedArtifactRefs }) => ({
    lessonId: lesson.lessonId,
    missionId: lesson.missionId,
    contractDigest: lesson.contractDigest,
    scope: lesson.scope,
    kind: lesson.kind,
    summary: lesson.summary,
    ...lesson.details === void 0 ? {} : { details: lesson.details },
    nextTimeGuidance: lesson.nextTimeGuidance,
    sourceIds: lesson.sourceIds,
    noteIds: lesson.noteIds,
    artifactRefs: lesson.artifactRefs,
    appliesToArtifactRefs: lesson.appliesToArtifactRefs,
    tags: lesson.tags,
    ...lesson.supersedesLessonId === void 0 ? {} : { supersedesLessonId: lesson.supersedesLessonId },
    createdAt: lesson.createdAt,
    assessment: lessonAssessment(root, lesson, successorByLesson.get(lesson.lessonId), matchedArtifactRefs)
  })).sort((left, right) => right.assessment.matchedArtifactRefs.length - left.assessment.matchedArtifactRefs.length || Number(right.scope === "mission") - Number(left.scope === "mission") || String(right.createdAt).localeCompare(String(left.createdAt)) || left.lessonId.localeCompare(right.lessonId)).slice(0, limitNumber);
  return {
    status: items.length > 0 ? "ok" : "empty",
    workspaceId: workspace.manifest.workspaceId,
    missionId,
    lessonCount: items.length,
    items,
    advisoryOnly: true,
    authority: false,
    writes: []
  };
}

// src/core/mission-queries.mjs
import fs17 from "node:fs";
import path17 from "node:path";

// src/core/completion-gates.mjs
import fs15 from "node:fs";
import path15 from "node:path";

// src/core/review-exchange.mjs
import crypto6 from "node:crypto";
import fs14 from "node:fs";
import path14 from "node:path";
var REVIEW_EXCHANGE_SCHEMA_VERSION = 7;
var REVIEW_EXCHANGE_POLICIES = Object.freeze([
  "local-preflight",
  "isolated-selected-artifacts",
  "final-plan-results-only",
  "external"
]);
var POLICY_SET = new Set(REVIEW_EXCHANGE_POLICIES);
var PREPARE_FIELDS = /* @__PURE__ */ new Set(["missionId", "policy", "artifactPaths", "finalPlanPaths", "finalResultPaths"]);
var IMPORT_FIELDS = /* @__PURE__ */ new Set(["missionId", "exchangeId", "reviewId"]);
var COVERAGE_FIELDS = /* @__PURE__ */ new Set(["missionId", "artifactPaths", "requireAuthoritative"]);
var EXPECTED_COVERAGE_FIELDS = /* @__PURE__ */ new Set(["missionId", "expectedSnapshots", "requireAuthoritative"]);
var REVIEW_VERDICTS = /* @__PURE__ */ new Set(["coherent", "needs-revision", "needs-evidence", "blocked"]);
var REVIEW_STATUSES = /* @__PURE__ */ new Set(["completed", "blocked", "failed"]);
var HASH_PATTERN4 = /^[0-9a-f]{64}$/u;
var INPUT_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "missionId",
  "contractDigest",
  "exchangeId",
  "createdAt",
  "policy",
  "scopeSha256",
  "inputBoundary",
  "artifactPaths",
  "finalPlanPaths",
  "finalResultPaths",
  "reviewedArtifactPaths",
  "reviewedArtifacts",
  "reviewedArtifactSetSha256",
  "outputContract",
  "privacyBoundary"
]);
var MANIFEST_FIELDS2 = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "missionId",
  "contractDigest",
  "exchangeId",
  "status",
  "createdAt",
  "policy",
  "scopeSha256",
  "inputBoundary",
  "inputPath",
  "inputSha256",
  "handoffPath",
  "reportPath",
  "artifactPaths",
  "finalPlanPaths",
  "finalResultPaths",
  "reviewedArtifactPaths",
  "reviewedArtifacts",
  "reviewedArtifactSetSha256"
]);
var HANDOFF_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "missionId",
  "contractDigest",
  "exchangeId",
  "reviewId",
  "policy",
  "scopeSha256",
  "status",
  "verdict",
  "reviewerId",
  "summary",
  "inputPath",
  "inputSha256",
  "reportPath",
  "reportSha256",
  "reviewedArtifactPaths",
  "findings",
  "actionItems",
  "reviewedAt"
]);
var FINDING_FIELDS = /* @__PURE__ */ new Set(["findingId", "severity", "summary", "linkedArtifactPaths"]);
var IMPORTED_REVIEW_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "missionId",
  "contractDigest",
  "exchangeId",
  "reviewId",
  "policy",
  "scopeSha256",
  "status",
  "verdict",
  "reviewerId",
  "summary",
  "reviewedAt",
  "reviewedArtifactPaths",
  "reviewedArtifacts",
  "reviewedArtifactSetSha256",
  "findings",
  "actionItems",
  "exchange",
  "authority",
  "privateTranscriptImported"
]);
var EXCHANGE_HASH_FIELDS = /* @__PURE__ */ new Set([
  "manifestPath",
  "manifestSha256",
  "inputPath",
  "inputSha256",
  "handoffPath",
  "handoffSha256",
  "reportPath",
  "reportSha256",
  "importedReportPath",
  "importedReportSha256"
]);
var AUTHORITY_FIELDS = /* @__PURE__ */ new Set(["authoritative", "callerMayMintAuthority", "issuer", "reason"]);
function sealed(value2, fields, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) throw new Error(`${label} must be a plain object.`);
  const unknown = Object.keys(value2).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  return value2;
}
function exchangePath(exchangeId, leaf) {
  return path14.posix.join(".dove/reviews/exchanges", exchangeId, leaf);
}
function importedReviewPath(reviewId) {
  return path14.posix.join(".dove/reviews", `${reviewId}.json`);
}
function importedReportPath(reviewId) {
  return path14.posix.join(".dove/reviews", `${reviewId}.report.md`);
}
function exactTimestamp(value2, label) {
  const text = domainNonEmptyText(value2, label);
  const parsed2 = Date.parse(text);
  if (!Number.isFinite(parsed2) || new Date(parsed2).toISOString() !== text) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return text;
}
function exactHash(value2, label) {
  const hash2 = String(value2 ?? "");
  if (!HASH_PATTERN4.test(hash2)) throw new Error(`${label} must be a lowercase SHA-256 hash.`);
  return hash2;
}
function currentCanonicalLeaf(root, relativePath, label) {
  const inspection = inspectDeclaredPath(root, relativePath, { requireNonEmpty: true });
  if (inspection.status !== "existing") throw new Error(`${label} must be an existing non-empty regular file (${inspection.reason ?? inspection.status}).`);
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (inspection.normalizedPath !== relativePath || canonicalPath !== relativePath) throw new Error(`${label} must be the canonical realpath-contained exchange path.`);
  const content = fs14.readFileSync(path14.resolve(root, canonicalPath));
  return { path: canonicalPath, content, sha256: domainSha256(content) };
}
function normalizedPolicy(value2) {
  const policy = domainNonEmptyText(value2, "policy");
  if (!POLICY_SET.has(policy)) throw new Error(`policy must be one of: ${REVIEW_EXCHANGE_POLICIES.join(", ")}.`);
  return policy;
}
function normalizePolicyPaths(args2, policy) {
  const artifactPaths = domainStringArray(args2.artifactPaths, "artifactPaths");
  const finalPlanPaths = domainStringArray(args2.finalPlanPaths, "finalPlanPaths");
  const finalResultPaths = domainStringArray(args2.finalResultPaths, "finalResultPaths");
  if (policy === "final-plan-results-only") {
    if (artifactPaths.length > 0) throw new Error("final-plan-results-only does not accept artifactPaths outside its final plan and result classes.");
    if (finalPlanPaths.length === 0 || finalResultPaths.length === 0) throw new Error("final-plan-results-only requires at least one finalPlanPath and one finalResultPath.");
  } else {
    if (finalPlanPaths.length > 0 || finalResultPaths.length > 0) throw new Error(`${policy} accepts only artifactPaths.`);
    if (artifactPaths.length === 0) throw new Error(`${policy} requires at least one artifactPath.`);
  }
  return {
    artifactPaths,
    finalPlanPaths,
    finalResultPaths,
    reviewedArtifactPaths: policy === "final-plan-results-only" ? [...finalPlanPaths, ...finalResultPaths].sort() : artifactPaths
  };
}
function policyInputBoundary(policy) {
  switch (policy) {
    case "local-preflight":
      return "read-only-current-workspace";
    case "isolated-selected-artifacts":
      return "selected-artifact-isolation";
    case "final-plan-results-only":
      return "classified-final-plan-results";
    case "external":
      return "host-mediated-external-review";
    default:
      throw new Error(`Unsupported review policy: ${policy}.`);
  }
}
function policyScope(policy, paths) {
  const value2 = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    policy,
    inputBoundary: policyInputBoundary(policy),
    artifactPaths: paths.artifactPaths,
    finalPlanPaths: paths.finalPlanPaths,
    finalResultPaths: paths.finalResultPaths,
    reviewedArtifactPaths: paths.reviewedArtifactPaths
  };
  return { value: value2, sha256: domainSha256(`${JSON.stringify(value2)}
`) };
}
function reviewPreflight(root, args2, operation) {
  const { workspace, mission } = readCurrentMission(root, args2.missionId, operation);
  const policy = normalizedPolicy(args2.policy);
  const paths = normalizePolicyPaths(args2, policy);
  let snapshot;
  let canonical;
  if (policy === "final-plan-results-only") {
    const plans = resolveReviewArtifactSnapshots(root, mission.missionId, paths.finalPlanPaths, "finalPlanPaths");
    const results = resolveReviewArtifactSnapshots(root, mission.missionId, paths.finalResultPaths, "finalResultPaths");
    const finalPlanPaths = plans.reviewedArtifacts.map((item) => item.path);
    const finalResultPaths = results.reviewedArtifacts.map((item) => item.path);
    if (finalPlanPaths.length !== paths.finalPlanPaths.length || finalResultPaths.length !== paths.finalResultPaths.length || finalPlanPaths.some((item) => finalResultPaths.includes(item))) {
      throw new Error("final-plan-results-only contains an internal alias or overlap that collapses the exact classified artifact set.");
    }
    snapshot = resolveReviewArtifactSnapshots(root, mission.missionId, [...finalPlanPaths, ...finalResultPaths], `${policy} review artifacts`);
    canonical = { artifactPaths: [], finalPlanPaths, finalResultPaths, reviewedArtifactPaths: snapshot.reviewedArtifacts.map((item) => item.path) };
  } else {
    snapshot = resolveReviewArtifactSnapshots(root, mission.missionId, paths.artifactPaths, `${policy} review artifacts`);
    const artifactPaths = snapshot.reviewedArtifacts.map((item) => item.path);
    if (artifactPaths.length !== paths.artifactPaths.length) throw new Error(`${policy} contains an internal alias that collapses the exact artifact set.`);
    canonical = { artifactPaths, finalPlanPaths: [], finalResultPaths: [], reviewedArtifactPaths: artifactPaths };
  }
  const scope = policyScope(policy, canonical);
  return { workspace, mission, policy, paths: canonical, snapshot, scope };
}
function newExchangeId(policy) {
  return domainSafeId(`exchange-${policy}-${crypto6.randomUUID()}`, "exchangeId");
}
function preflightResult(prepared) {
  return {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: "ready",
    zeroWrite: true,
    missionId: prepared.mission.missionId,
    contractDigest: prepared.mission.contractDigest,
    policy: prepared.policy,
    inputBoundary: policyInputBoundary(prepared.policy),
    scopeSha256: prepared.scope.sha256,
    artifactPaths: prepared.paths.artifactPaths,
    finalPlanPaths: prepared.paths.finalPlanPaths,
    finalResultPaths: prepared.paths.finalResultPaths,
    reviewedArtifactPaths: prepared.snapshot.reviewedArtifacts.map((item) => item.path),
    reviewedArtifacts: prepared.snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: prepared.snapshot.reviewedArtifactSetSha256,
    authority: { authoritative: false, callerMayMintAuthority: false, reason: "Local preflight is read-only and non-authoritative." }
  };
}
function prepareReviewExchange(root, args2 = {}) {
  assertSealedDomainArgs(args2, PREPARE_FIELDS, "prepare_review_exchange");
  const prepared = reviewPreflight(root, args2, "Review exchange preparation");
  if (prepared.policy === "local-preflight") return preflightResult(prepared);
  const exchangeId = newExchangeId(prepared.policy);
  const inputPath = exchangePath(exchangeId, "input.json");
  const manifestPath = exchangePath(exchangeId, "manifest.json");
  const handoffPath = exchangePath(exchangeId, "handoff.json");
  const reportPath = exchangePath(exchangeId, "report.md");
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const input = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    workspaceId: prepared.workspace.manifest.workspaceId,
    missionId: prepared.mission.missionId,
    contractDigest: prepared.mission.contractDigest,
    exchangeId,
    createdAt,
    policy: prepared.policy,
    inputBoundary: policyInputBoundary(prepared.policy),
    scopeSha256: prepared.scope.sha256,
    artifactPaths: prepared.paths.artifactPaths,
    finalPlanPaths: prepared.paths.finalPlanPaths,
    finalResultPaths: prepared.paths.finalResultPaths,
    reviewedArtifactPaths: prepared.snapshot.reviewedArtifacts.map((item) => item.path),
    reviewedArtifacts: prepared.snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: prepared.snapshot.reviewedArtifactSetSha256,
    outputContract: {
      handoffPath,
      reportPath,
      requiredHandoffFields: [...HANDOFF_FIELDS]
    },
    privacyBoundary: {
      writerPrivateTranscriptShared: false,
      reviewerPrivateTranscriptShouldReturn: false,
      undeclaredContextShared: false,
      acceptedReturnArtifacts: [handoffPath, reportPath]
    }
  };
  const inputContent = domainJson(input);
  const manifest = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    workspaceId: prepared.workspace.manifest.workspaceId,
    missionId: prepared.mission.missionId,
    contractDigest: prepared.mission.contractDigest,
    exchangeId,
    status: "prepared",
    createdAt,
    policy: prepared.policy,
    inputBoundary: policyInputBoundary(prepared.policy),
    scopeSha256: prepared.scope.sha256,
    inputPath,
    inputSha256: domainSha256(inputContent),
    handoffPath,
    reportPath,
    artifactPaths: input.artifactPaths,
    finalPlanPaths: input.finalPlanPaths,
    finalResultPaths: input.finalResultPaths,
    reviewedArtifactPaths: input.reviewedArtifactPaths,
    reviewedArtifacts: input.reviewedArtifacts,
    reviewedArtifactSetSha256: input.reviewedArtifactSetSha256
  };
  const manifestContent = domainJson(manifest);
  const result = finalizeDomainArtifacts(root, {
    actionId: "prepare-review-exchange",
    operation: "Review exchange preparation",
    missionId: prepared.mission.missionId,
    summary: `Prepared ${prepared.policy} review exchange ${exchangeId}.`,
    writes: [
      { path: inputPath, kind: "data", content: inputContent, derivedReferences: input.reviewedArtifactPaths.map((item) => `artifact:${item}`) },
      { path: manifestPath, kind: "data", content: manifestContent, derivedReferences: [`artifact:${inputPath}`] }
    ]
  });
  return {
    ...result,
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: result.status === "planned" ? "prepare-planned" : "prepared",
    exchangeId,
    policy: prepared.policy,
    scopeSha256: prepared.scope.sha256,
    inputPath,
    inputSha256: manifest.inputSha256,
    manifestPath,
    manifestSha256: domainSha256(manifestContent),
    handoffPath,
    reportPath,
    reviewedArtifactPaths: input.reviewedArtifactPaths,
    reviewedArtifactSetSha256: input.reviewedArtifactSetSha256,
    authority: { authoritative: false, callerMayMintAuthority: false }
  };
}
function assertIdentity(value2, manifest, mission, workspaceId, label) {
  if (value2.schemaVersion !== REVIEW_EXCHANGE_SCHEMA_VERSION) throw new Error(`${label}.schemaVersion must be ${REVIEW_EXCHANGE_SCHEMA_VERSION}.`);
  if (value2.workspaceId !== workspaceId || value2.workspaceId !== manifest.workspaceId) throw new Error(`${label} workspace binding mismatch.`);
  if (value2.missionId !== mission.missionId || value2.missionId !== manifest.missionId) throw new Error(`${label} mission binding mismatch.`);
  if (value2.contractDigest !== mission.contractDigest || value2.contractDigest !== manifest.contractDigest) throw new Error(`${label} contract digest is stale.`);
  if (value2.exchangeId !== manifest.exchangeId) throw new Error(`${label} exchangeId mismatch.`);
  if (value2.policy !== manifest.policy) throw new Error(`${label} policy binding mismatch.`);
  if (value2.scopeSha256 !== manifest.scopeSha256) throw new Error(`${label} scope binding mismatch.`);
}
function same(value2, expected) {
  return JSON.stringify(value2) === JSON.stringify(expected);
}
function assertPreparedScope(manifest, input) {
  const policy = normalizedPolicy(manifest.policy);
  if (policy === "local-preflight") throw new Error("local-preflight cannot create an importable exchange.");
  const expectedInputBoundary = policyInputBoundary(policy);
  if (manifest.inputBoundary !== expectedInputBoundary || input.inputBoundary !== expectedInputBoundary) throw new Error("Review exchange policy input boundary drifted.");
  const fields = ["artifactPaths", "finalPlanPaths", "finalResultPaths", "reviewedArtifactPaths"];
  for (const field of fields) if (!same(manifest[field], input[field])) throw new Error(`Review exchange ${field} drifted between manifest and input.`);
  const paths = normalizePolicyPaths(input, policy);
  if (!same(paths.reviewedArtifactPaths, input.reviewedArtifactPaths)) throw new Error("Review exchange policy scope no longer equals the exact reviewed artifact set.");
  const scope = policyScope(policy, paths);
  if (scope.sha256 !== manifest.scopeSha256 || scope.sha256 !== input.scopeSha256) throw new Error("Review exchange scope hash drifted.");
}
function normalizeFindings(items, reviewedArtifactPaths) {
  if (!Array.isArray(items)) throw new Error("Review handoff findings must be an array.");
  const reviewed = new Set(reviewedArtifactPaths);
  const seen = /* @__PURE__ */ new Set();
  return items.map((item, index) => {
    sealed(item, FINDING_FIELDS, `Review handoff findings[${index}]`);
    const findingId = domainSafeId(item.findingId, `findings[${index}].findingId`);
    if (seen.has(findingId)) throw new Error(`Review handoff contains duplicate findingId ${findingId}.`);
    seen.add(findingId);
    const severity = domainNonEmptyText(item.severity, `findings[${index}].severity`).toLowerCase();
    if (!["low", "medium", "high"].includes(severity)) throw new Error(`findings[${index}].severity must be low, medium, or high.`);
    const linkedArtifactPaths = domainStringArray(item.linkedArtifactPaths, `findings[${index}].linkedArtifactPaths`);
    if (linkedArtifactPaths.some((artifactPath) => !reviewed.has(artifactPath))) throw new Error(`findings[${index}] links an artifact outside the frozen review set.`);
    return { findingId, severity, summary: domainNonEmptyText(item.summary, `findings[${index}].summary`), linkedArtifactPaths };
  });
}
function importReviewExchange(root, args2 = {}) {
  assertSealedDomainArgs(args2, IMPORT_FIELDS, "import_review_exchange");
  const { workspace, mission } = readCurrentMission(root, args2.missionId, "Review exchange import");
  const exchangeId = domainSafeId(args2.exchangeId, "exchangeId");
  const reviewId = domainSafeId(args2.reviewId, "reviewId");
  const inputPath = exchangePath(exchangeId, "input.json");
  const manifestPath = exchangePath(exchangeId, "manifest.json");
  const handoffPath = exchangePath(exchangeId, "handoff.json");
  const reportPath = exchangePath(exchangeId, "report.md");
  const reviewPath = importedReviewPath(reviewId);
  const finalReportPath = importedReportPath(reviewId);
  if (fs14.existsSync(path14.resolve(root, reviewPath)) || fs14.existsSync(path14.resolve(root, finalReportPath))) throw new Error(`Review ${reviewId} has already been imported.`);
  const manifestLeaf = currentCanonicalLeaf(root, manifestPath, "Review exchange manifest");
  const manifest = sealed(JSON.parse(manifestLeaf.content.toString("utf8")), MANIFEST_FIELDS2, "Review exchange manifest");
  if (manifest.status !== "prepared") throw new Error(`Review exchange ${exchangeId} is not importable from status ${manifest.status ?? "unknown"}.`);
  if (manifest.exchangeId !== exchangeId) throw new Error("Review exchange manifest exchangeId mismatch.");
  assertIdentity(manifest, manifest, mission, workspace.manifest.workspaceId, "Review exchange manifest");
  if (manifest.inputPath !== inputPath || manifest.handoffPath !== handoffPath || manifest.reportPath !== reportPath) throw new Error("Review exchange manifest contains noncanonical exchange paths.");
  exactHash(manifest.inputSha256, "manifest.inputSha256");
  const inputLeaf = currentCanonicalLeaf(root, inputPath, "Review exchange input");
  const input = sealed(JSON.parse(inputLeaf.content.toString("utf8")), INPUT_FIELDS, "Review exchange input");
  assertIdentity(input, manifest, mission, workspace.manifest.workspaceId, "Review exchange input");
  if (inputLeaf.sha256 !== manifest.inputSha256) throw new Error("Review exchange input hash does not match the prepared manifest.");
  if (input.outputContract?.handoffPath !== handoffPath || input.outputContract?.reportPath !== reportPath) throw new Error("Review exchange input output contract is noncanonical.");
  if (!same(input.outputContract?.requiredHandoffFields, [...HANDOFF_FIELDS])) throw new Error("Review exchange handoff contract drifted.");
  if (input.privacyBoundary?.writerPrivateTranscriptShared !== false || input.privacyBoundary?.reviewerPrivateTranscriptShouldReturn !== false || input.privacyBoundary?.undeclaredContextShared !== false) throw new Error("Review exchange privacy boundary is invalid.");
  assertPreparedScope(manifest, input);
  const manifestSnapshots = normalizeReviewSnapshots(manifest.reviewedArtifacts, "manifest.reviewedArtifacts");
  const inputSnapshots = normalizeReviewSnapshots(input.reviewedArtifacts, "input.reviewedArtifacts");
  if (!manifestSnapshots.ok || !inputSnapshots.ok || !same(manifestSnapshots.snapshots, inputSnapshots.snapshots)) throw new Error("Review exchange artifact snapshot contract drifted.");
  const exactSetHash = stableSnapshotSetHash(manifestSnapshots.snapshots);
  if (manifest.reviewedArtifactSetSha256 !== exactSetHash || input.reviewedArtifactSetSha256 !== exactSetHash) throw new Error("Review exchange artifact-set hash drifted.");
  if (!same(manifest.reviewedArtifactPaths, manifestSnapshots.snapshots.map((item) => item.path))) throw new Error("Review exchange artifact paths do not equal the exact frozen snapshot set.");
  const snapshotVerification = verifyReviewSnapshotSet(root, manifestSnapshots.snapshots, exactSetHash);
  if (!snapshotVerification.ok) throw new Error(`Review exchange artifacts changed before import: ${snapshotVerification.failures.join(", ")}.`);
  const handoffLeaf = currentCanonicalLeaf(root, handoffPath, "Review exchange handoff");
  const reportLeaf = currentCanonicalLeaf(root, reportPath, "Review exchange report");
  const handoff = sealed(JSON.parse(handoffLeaf.content.toString("utf8")), HANDOFF_FIELDS, "Review exchange handoff");
  assertIdentity(handoff, manifest, mission, workspace.manifest.workspaceId, "Review exchange handoff");
  if (handoff.reviewId !== reviewId) throw new Error("Review exchange handoff reviewId mismatch.");
  if (!REVIEW_STATUSES.has(handoff.status)) throw new Error(`Review exchange handoff status is unsupported: ${handoff.status}.`);
  if (!REVIEW_VERDICTS.has(handoff.verdict)) throw new Error(`Review exchange handoff verdict is unsupported: ${handoff.verdict}.`);
  if (handoff.status !== "completed" && handoff.verdict === "coherent") throw new Error("A non-completed review handoff cannot return a coherent verdict.");
  if (handoff.inputPath !== inputPath || handoff.reportPath !== reportPath) throw new Error("Review exchange handoff paths do not match the canonical exchange.");
  if (exactHash(handoff.inputSha256, "handoff.inputSha256") !== inputLeaf.sha256) throw new Error("Review exchange handoff input hash mismatch.");
  if (exactHash(handoff.reportSha256, "handoff.reportSha256") !== reportLeaf.sha256) throw new Error("Review exchange report hash mismatch.");
  if (!same(handoff.reviewedArtifactPaths, manifest.reviewedArtifactPaths)) throw new Error("Review exchange handoff scope drifted from the exact frozen artifact set.");
  const findings = normalizeFindings(handoff.findings, manifest.reviewedArtifactPaths);
  const actionItems = domainStringArray(handoff.actionItems, "Review handoff actionItems");
  const review = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    exchangeId,
    reviewId,
    policy: manifest.policy,
    scopeSha256: manifest.scopeSha256,
    status: handoff.status,
    verdict: handoff.verdict,
    reviewerId: domainNonEmptyText(handoff.reviewerId, "reviewerId"),
    summary: domainNonEmptyText(handoff.summary, "summary"),
    reviewedAt: exactTimestamp(handoff.reviewedAt, "reviewedAt"),
    reviewedArtifactPaths: manifest.reviewedArtifactPaths,
    reviewedArtifacts: manifestSnapshots.snapshots,
    reviewedArtifactSetSha256: exactSetHash,
    findings,
    actionItems,
    exchange: {
      manifestPath,
      manifestSha256: manifestLeaf.sha256,
      inputPath,
      inputSha256: inputLeaf.sha256,
      handoffPath,
      handoffSha256: handoffLeaf.sha256,
      reportPath,
      reportSha256: reportLeaf.sha256,
      importedReportPath: finalReportPath,
      importedReportSha256: reportLeaf.sha256
    },
    authority: {
      authoritative: false,
      callerMayMintAuthority: false,
      issuer: null,
      reason: "No trusted Reviewer issuer is connected; public handoff, reviewerId, verdict, and report material are non-authoritative."
    },
    privateTranscriptImported: false
  };
  const result = finalizeDomainArtifacts(root, {
    actionId: "import-review-exchange",
    operation: "Review exchange import",
    missionId: mission.missionId,
    summary: `Imported non-authoritative review ${reviewId} from exchange ${exchangeId}.`,
    writes: [
      { path: finalReportPath, kind: "report", content: reportLeaf.content, derivedReferences: review.reviewedArtifactPaths.map((item) => `artifact:${item}`) },
      { path: reviewPath, kind: "data", content: domainJson(review), derivedReferences: [`artifact:${finalReportPath}`, ...review.reviewedArtifactPaths.map((item) => `artifact:${item}`)] }
    ]
  });
  return {
    ...result,
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: result.status === "planned" ? "import-planned" : "imported",
    exchangeId,
    reviewId,
    review,
    reviewPath,
    reportPath: finalReportPath,
    authoritative: false,
    privateTranscriptImported: false
  };
}
function currentHash(root, relativePath, expectedHash, label) {
  try {
    const leaf = currentCanonicalLeaf(root, relativePath, label);
    return { current: leaf.sha256 === expectedHash, actualSha256: leaf.sha256, reason: leaf.sha256 === expectedHash ? null : "hash-mismatch" };
  } catch (error) {
    return { current: false, actualSha256: null, reason: error instanceof Error ? error.message : String(error) };
  }
}
function readImportedReviews(root, missionId) {
  const directory = path14.resolve(root, ".dove/reviews");
  if (!fs14.existsSync(directory)) return [];
  return fs14.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => {
    const reviewPath = path14.posix.join(".dove/reviews", entry.name);
    try {
      const review = sealed(JSON.parse(fs14.readFileSync(path14.resolve(root, reviewPath), "utf8")), IMPORTED_REVIEW_FIELDS, `Imported review ${reviewPath}`);
      return review.missionId === missionId ? { reviewPath, review } : null;
    } catch (error) {
      return { reviewPath, review: null, readFailure: error instanceof Error ? error.message : String(error) };
    }
  }).filter(Boolean);
}
function requestedCoverageSnapshot(root, missionId, requestedPaths) {
  if (requestedPaths.length === 0) return { snapshot: null, failures: [] };
  try {
    return {
      snapshot: resolveReviewArtifactSnapshots(root, missionId, requestedPaths, "review coverage artifacts"),
      failures: []
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/is not a usable file .*path does not exist|is not a registered schema 7 artifact|has changed since its latest ownership receipt/u.test(message)) {
      return { snapshot: null, failures: [`requested-artifact-unavailable:${message}`] };
    }
    throw error;
  }
}
function normalizeExpectedCoverageSnapshots(value2) {
  if (value2 === void 0) return null;
  const normalized = normalizeReviewSnapshots(value2, "expectedSnapshots");
  if (!normalized.ok) throw new Error(normalized.reason);
  return {
    reviewedArtifacts: normalized.snapshots,
    reviewedArtifactSetSha256: stableSnapshotSetHash(normalized.snapshots)
  };
}
function assessImportedReview(root, mission, { reviewPath, review, readFailure }, requestedSnapshot) {
  const failures = [];
  if (readFailure || !review) return { reviewId: null, reviewPath, current: false, authoritative: false, failures: [readFailure ?? "review-unreadable"] };
  if (review.schemaVersion !== REVIEW_EXCHANGE_SCHEMA_VERSION) {
    return { reviewId: review.reviewId ?? null, reviewPath, current: false, authoritative: false, failures: ["review-schema-invalid"] };
  }
  if (review.contractDigest !== mission.contractDigest) failures.push("contract-digest-stale");
  if (!POLICY_SET.has(review.policy) || review.policy === "local-preflight") failures.push("review-policy-invalid");
  const snapshots = normalizeReviewSnapshots(review.reviewedArtifacts, "review.reviewedArtifacts");
  if (!snapshots.ok) failures.push(snapshots.reason);
  const setHash = snapshots.ok ? stableSnapshotSetHash(snapshots.snapshots) : null;
  if (!setHash || review.reviewedArtifactSetSha256 !== setHash || !same(review.reviewedArtifactPaths, snapshots.snapshots.map((item) => item.path))) failures.push("reviewed-artifact-set-hash-mismatch");
  if (snapshots.ok) failures.push(...verifyReviewSnapshotSet(root, snapshots.snapshots, setHash).failures);
  if (requestedSnapshot && (!snapshots.ok || !same(requestedSnapshot.reviewedArtifacts, snapshots.snapshots))) failures.push("requested-artifact-set-not-exactly-covered");
  try {
    const exchange = sealed(review.exchange, EXCHANGE_HASH_FIELDS, `Imported review ${review.reviewId} exchange`);
    for (const [pathField, hashField, label] of [
      ["manifestPath", "manifestSha256", "review manifest"],
      ["inputPath", "inputSha256", "review input"],
      ["handoffPath", "handoffSha256", "review handoff"],
      ["reportPath", "reportSha256", "review report"],
      ["importedReportPath", "importedReportSha256", "imported review report"]
    ]) {
      if (!HASH_PATTERN4.test(String(exchange[hashField] ?? ""))) failures.push(`${hashField}-invalid`);
      else if (!currentHash(root, exchange[pathField], exchange[hashField], label).current) failures.push(`${hashField}-stale`);
    }
  } catch (error) {
    failures.push(`review-exchange-invalid:${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    const authority = sealed(review.authority, AUTHORITY_FIELDS, `Imported review ${review.reviewId} authority`);
    if (authority.authoritative !== false || authority.callerMayMintAuthority !== false || authority.issuer !== null || typeof authority.reason !== "string" || !authority.reason.trim()) failures.push("public-review-authority-invalid");
  } catch (error) {
    failures.push(`public-review-authority-invalid:${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    reviewId: review.reviewId,
    exchangeId: review.exchangeId,
    reviewPath,
    policy: review.policy,
    verdict: review.verdict,
    current: failures.length === 0,
    authoritative: false,
    reviewedArtifactPaths: review.reviewedArtifactPaths,
    reviewedArtifactSetSha256: review.reviewedArtifactSetSha256,
    failures: [...new Set(failures)]
  };
}
function verifyReviewCoverageInput(root, args2, fields, operation) {
  assertSealedDomainArgs(args2, fields, operation);
  const { mission } = readCurrentMission(root, args2.missionId, "Review coverage verification");
  const requestedPaths = args2.artifactPaths === void 0 ? [] : domainStringArray(args2.artifactPaths, "artifactPaths");
  const expected = normalizeExpectedCoverageSnapshots(args2.expectedSnapshots);
  const requested = expected ? { snapshot: expected, failures: [] } : requestedCoverageSnapshot(root, mission.missionId, requestedPaths);
  const assessments = readImportedReviews(root, mission.missionId).map((item) => assessImportedReview(root, mission, item, requested.snapshot));
  const currentReviews = assessments.filter((item) => item.current);
  const failures = [...requested.failures];
  const exactCoverageRequested = requestedPaths.length > 0 || expected !== null;
  if (currentReviews.length === 0) failures.push(exactCoverageRequested ? "current-exact-review-coverage-missing" : "current-review-coverage-missing");
  if (args2.requireAuthoritative === true) failures.push("trusted-review-issuer-missing");
  return {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: failures.length === 0 ? "covered" : "not-covered",
    zeroWrite: true,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    requestedArtifactPaths: requested.snapshot?.reviewedArtifacts.map((item) => item.path) ?? requestedPaths,
    requestedArtifactSetSha256: requested.snapshot?.reviewedArtifactSetSha256 ?? null,
    covered: requested.failures.length === 0 && currentReviews.length > 0,
    authoritative: false,
    issuer: null,
    failures: [...new Set(failures)],
    reviews: assessments
  };
}
function verifyExpectedReviewCoverage(root, args2 = {}) {
  return verifyReviewCoverageInput(root, args2, EXPECTED_COVERAGE_FIELDS, "verify expected review coverage");
}
function verifyReviewCoverage(root, args2 = {}) {
  return verifyReviewCoverageInput(root, args2, COVERAGE_FIELDS, "verify_review_coverage");
}

// src/core/completion-gates.mjs
var HASH_PATTERN5 = /^[0-9a-f]{64}$/u;
var ARTIFACT_KINDS = /* @__PURE__ */ new Set(["report", "document", "code", "data", "figure", "media", "other"]);
var VALIDATION_KINDS = /* @__PURE__ */ new Set(["test-log", "typecheck-log", "lint-log", "build-log", "audit-log", "validation-log", "command-output"]);
var RECEIPT_FIELDS2 = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "receiptId", "missionId", "contractDigest", "summary", "artifacts", "validations", "criteriaSatisfied", "producedAt"]);
var ARTIFACT_FIELDS2 = /* @__PURE__ */ new Set(["path", "kind", "sha256"]);
var VALIDATION_FIELDS2 = /* @__PURE__ */ new Set(["kind", "reference", "outputHash"]);
var CRITERION_FIELDS2 = /* @__PURE__ */ new Set(["criterionId", "evidenceRefs"]);
function missionPath2(missionId) {
  return path15.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}
function sealed2(value2, allowed) {
  return value2 && typeof value2 === "object" && !Array.isArray(value2) && Object.keys(value2).every((key) => allowed.has(key));
}
function currentHashedFile(root, relativePath, expectedHash) {
  if (isDoveLessonArtifactPath(relativePath)) {
    return { current: false, reason: "lesson-advisory-only", path: relativePath ?? null, actualHash: null };
  }
  if (typeof relativePath !== "string" || !relativePath.trim() || !HASH_PATTERN5.test(String(expectedHash ?? ""))) {
    return { current: false, reason: "hashed-file-input-invalid", path: relativePath ?? null, actualHash: null };
  }
  const suppliedPath = relativePath.trim().replace(/\\/gu, "/");
  const inspection = inspectDeclaredPath(root, suppliedPath, { requireNonEmpty: true });
  if (inspection.status !== "existing") {
    return { current: false, reason: inspection.reason ?? inspection.status, path: relativePath, actualHash: null };
  }
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (inspection.normalizedPath !== suppliedPath || canonicalPath !== suppliedPath) {
    return { current: false, reason: "canonical-path-changed", path: suppliedPath, canonicalPath, actualHash: null };
  }
  const actualHash = sha256File(path15.resolve(root, canonicalPath));
  return {
    current: actualHash === expectedHash,
    reason: actualHash === expectedHash ? null : "hash-mismatch",
    path: canonicalPath,
    actualHash
  };
}
function typedEvidenceEligibility(root, missionId, reference) {
  if (reference.startsWith("source:")) {
    const value2 = reference.slice("source:".length);
    return evaluateSourceReferences(root, [value2], missionId)[0] ?? { eligible: false, reason: "unknown-source" };
  }
  if (reference.startsWith("note:")) {
    const value2 = reference.slice("note:".length);
    return evaluateNoteReferences(root, [value2], missionId)[0] ?? { eligible: false, reason: "unknown-note" };
  }
  return { eligible: null, reason: null };
}
function receiptAssessment(root, mission, receipt, workspaceId, missionCurrent = true) {
  const failures = [];
  if (receipt?.__readFailure) failures.push("receipt-json-malformed");
  if (!missionCurrent) failures.push("mission-contract-invalid");
  if (!sealed2(receipt, RECEIPT_FIELDS2) || receipt.schemaVersion !== 1) failures.push("receipt-schema-invalid");
  if (receipt.workspaceId !== workspaceId || mission.workspaceId !== workspaceId) failures.push("workspace-binding-mismatch");
  if (receipt.missionId !== mission.missionId) failures.push("mission-binding-mismatch");
  if (receipt?.contractDigest !== mission.contractDigest || !missionCurrent) failures.push("contract-digest-stale");
  if (!Array.isArray(receipt.artifacts) || receipt.artifacts.length === 0) failures.push("artifacts-missing");
  if (!Array.isArray(receipt.validations)) failures.push("validations-invalid");
  if (!Array.isArray(receipt.criteriaSatisfied)) failures.push("criteria-invalid");
  const artifactAssessments = (Array.isArray(receipt.artifacts) ? receipt.artifacts : []).map((artifact) => {
    if (!sealed2(artifact, ARTIFACT_FIELDS2) || typeof artifact.path !== "string" || !artifact.path.trim() || !ARTIFACT_KINDS.has(artifact.kind) || !HASH_PATTERN5.test(String(artifact.sha256 ?? ""))) {
      return { path: artifact?.path ?? null, current: false, reason: "artifact-schema-invalid" };
    }
    return currentHashedFile(root, artifact.path, artifact.sha256);
  });
  const validationAssessments = (Array.isArray(receipt.validations) ? receipt.validations : []).map((validation) => {
    if (!sealed2(validation, VALIDATION_FIELDS2) || typeof validation.reference !== "string" || !validation.reference.trim() || !VALIDATION_KINDS.has(validation.kind) || !HASH_PATTERN5.test(String(validation.outputHash ?? ""))) {
      return { path: validation?.reference ?? null, current: false, reason: "validation-schema-invalid" };
    }
    return currentHashedFile(root, validation.reference, validation.outputHash);
  });
  if (artifactAssessments.some((item) => !item.current)) failures.push("artifact-drift");
  if (validationAssessments.some((item) => !item.current)) failures.push("validation-drift");
  const artifactPaths = (Array.isArray(receipt.artifacts) ? receipt.artifacts : []).map((artifact) => artifact?.path).filter(Boolean);
  const validationPaths = (Array.isArray(receipt.validations) ? receipt.validations : []).map((validation) => validation?.reference).filter(Boolean);
  if (new Set(artifactPaths).size !== artifactPaths.length) failures.push("artifact-path-duplicate");
  if (new Set(validationPaths).size !== validationPaths.length) failures.push("validation-path-duplicate");
  const requiredArtifactPaths = /* @__PURE__ */ new Set([
    ...Array.isArray(mission.targetArtifacts) ? mission.targetArtifacts : [],
    ...Array.isArray(mission.expectedArtifacts) ? mission.expectedArtifacts : []
  ]);
  if ([...requiredArtifactPaths].some((requiredPath) => !artifactPaths.includes(requiredPath))) {
    failures.push("mission-artifact-coverage-missing");
  }
  const requiredCriteria = missionCompletionCriteria(mission);
  const requiredIds = new Set(requiredCriteria.map((criterion) => criterion.criterionId));
  const artifactRefs = new Set((receipt.artifacts ?? []).map((artifact) => `artifact:${artifact.path}`));
  const validationRefs = new Set((receipt.validations ?? []).map((validation) => `validation:${validation.reference}`));
  const seenCriteria = /* @__PURE__ */ new Set();
  const criteria = (Array.isArray(receipt.criteriaSatisfied) ? receipt.criteriaSatisfied : []).map((criterion) => {
    const criterionFailures = [];
    if (!sealed2(criterion, CRITERION_FIELDS2)) criterionFailures.push("criterion-schema-invalid");
    if (!requiredIds.has(criterion?.criterionId)) criterionFailures.push("criterion-unknown");
    if (seenCriteria.has(criterion?.criterionId)) criterionFailures.push("criterion-duplicate");
    seenCriteria.add(criterion?.criterionId);
    const evidenceRefs = Array.isArray(criterion?.evidenceRefs) ? criterion.evidenceRefs : [];
    if (evidenceRefs.length === 0 || evidenceRefs.some((reference) => typeof reference !== "string" || !reference.trim()) || new Set(evidenceRefs).size !== evidenceRefs.length) criterionFailures.push("criterion-evidence-invalid");
    const evidence = evidenceRefs.map((reference) => {
      if (artifactRefs.has(reference)) {
        const artifactPath = reference.slice("artifact:".length);
        const current = artifactAssessments.find((item) => item.path === artifactPath)?.current === true;
        return { reference, eligible: current, reason: current ? null : "artifact-not-current" };
      }
      if (validationRefs.has(reference)) {
        const validationPath = reference.slice("validation:".length);
        const current = validationAssessments.find((item) => item.path === validationPath)?.current === true;
        return { reference, eligible: current, reason: current ? null : "validation-not-current" };
      }
      const typed = typedEvidenceEligibility(root, mission.missionId, reference);
      return { reference, eligible: typed.eligible === true, reason: typed.reason ?? "unresolved-evidence-reference" };
    });
    if (evidence.some((item) => !item.eligible)) criterionFailures.push("criterion-evidence-stale-or-ineligible");
    return { criterionId: criterion?.criterionId ?? null, evidence, failures: criterionFailures, satisfied: criterionFailures.length === 0 };
  });
  const missingCriteria = requiredCriteria.filter((criterion) => !seenCriteria.has(criterion.criterionId));
  if (missingCriteria.length > 0) failures.push("criteria-coverage-missing");
  if (criteria.some((criterion) => !criterion.satisfied)) failures.push("criteria-evidence-invalid");
  const typedEvidenceStale = criteria.some((criterion) => criterion.failures.includes("criterion-evidence-stale-or-ineligible"));
  return {
    receiptId: receipt.receiptId ?? null,
    current: failures.length === 0,
    stale: typedEvidenceStale || failures.some((failure) => ["mission-contract-invalid", "contract-digest-stale", "artifact-drift", "validation-drift"].includes(failure)),
    failures: [...new Set(failures)],
    artifacts: artifactAssessments,
    validations: validationAssessments,
    criteria,
    missingCriterionIds: missingCriteria.map((criterion) => criterion.criterionId),
    producedAt: receipt.producedAt ?? null
  };
}
function evidenceRequirementAssessment(root, mission, receiptAssessments) {
  const requirements = missionEvidenceRequirements(mission);
  const currentReceipts = receiptAssessments.filter((receipt) => receipt.current);
  const artifactRefs = new Set(currentReceipts.flatMap((receipt) => receipt.artifacts.filter((item) => item.current).map((item) => `artifact:${item.path}`)));
  const validationRefs = new Set(currentReceipts.flatMap((receipt) => receipt.validations.filter((item) => item.current).map((item) => `validation:${item.path}`)));
  return requirements.map(({ requirementId, requirement }) => {
    if (requirement === "review:authoritative") {
      const coverage = verifyReviewCoverage(root, { missionId: mission.missionId, requireAuthoritative: true });
      return { requirementId, requirement, satisfied: coverage.authoritative === true && coverage.failures.length === 0, reason: coverage.authoritative === true && coverage.failures.length === 0 ? null : "authoritative-review-proof-missing" };
    }
    if (requirement.startsWith("source:")) {
      const evaluation = typedEvidenceEligibility(root, mission.missionId, requirement);
      return { requirementId, requirement, satisfied: evaluation.eligible === true, reason: evaluation.eligible === true ? null : evaluation.reason };
    }
    if (requirement.startsWith("note:")) {
      const evaluation = typedEvidenceEligibility(root, mission.missionId, requirement);
      return { requirementId, requirement, satisfied: evaluation.eligible === true, reason: evaluation.eligible === true ? null : evaluation.reason };
    }
    if (requirement.startsWith("artifact:")) {
      return { requirementId, requirement, satisfied: artifactRefs.has(requirement), reason: artifactRefs.has(requirement) ? null : "required-artifact-not-current" };
    }
    if (requirement.startsWith("validation:")) {
      return { requirementId, requirement, satisfied: validationRefs.has(requirement), reason: validationRefs.has(requirement) ? null : "required-validation-not-current" };
    }
    return { requirementId, requirement, satisfied: false, reason: "unsupported-evidence-requirement-syntax" };
  });
}
function assessMissionCompletion(root, args2 = {}) {
  const workspace = openDoveWorkspace(root, { operation: "Mission completion assessment" });
  if (!args2 || typeof args2 !== "object" || Array.isArray(args2)) throw new Error("assess_mission_completion arguments must be a plain object.");
  const unknown = Object.keys(args2).filter((field) => field !== "missionId");
  if (unknown.length > 0) throw new Error(`assess_mission_completion does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const missionId = typeof args2.missionId === "string" ? args2.missionId.trim() : "";
  if (!missionId) throw new Error("assess_mission_completion requires missionId.");
  const relativePath = missionPath2(missionId);
  if (!fs15.existsSync(path15.resolve(root, relativePath))) throw new Error(`Mission does not exist: ${missionId}.`);
  const mission = readJson(root, relativePath, null);
  let missionContractFailure = null;
  try {
    assertCurrentMissionContract(mission);
  } catch (error) {
    missionContractFailure = error instanceof Error ? error.message : String(error);
  }
  const receipts = readExecutionReceipts(root, missionId);
  const receiptAssessments = receipts.map((receipt) => receiptAssessment(root, mission, receipt, workspace.manifest.workspaceId, missionContractFailure === null));
  const requirements = evidenceRequirementAssessment(root, mission, receiptAssessments);
  const currentReceipt = [...receiptAssessments].reverse().find((receipt) => receipt.current) ?? null;
  const incompleteReasons = [];
  if (missionContractFailure) incompleteReasons.push("mission-contract-invalid");
  if (!currentReceipt) incompleteReasons.push(receipts.length === 0 ? "execution-receipt-missing" : "execution-receipts-stale-or-invalid");
  const unmetRequirements = requirements.filter((requirement) => !requirement.satisfied);
  if (unmetRequirements.length > 0) incompleteReasons.push("evidence-requirements-unmet");
  return {
    status: incompleteReasons.length === 0 ? "complete" : "incomplete",
    complete: incompleteReasons.length === 0,
    missionId,
    contractDigest: mission.contractDigest,
    currentReceiptId: currentReceipt?.receiptId ?? null,
    receiptCount: receipts.length,
    staleReceiptIds: receiptAssessments.filter((receipt) => receipt.stale).map((receipt) => receipt.receiptId),
    receipts: receiptAssessments,
    completionCriteria: missionCompletionCriteria(mission),
    evidenceRequirements: requirements,
    incompleteReasons,
    diagnostics: {
      zeroWrite: true,
      missionContractFailure,
      missionPath: relativePath,
      receiptRoot: ARTIFACT_PATHS.executionReceiptsDir,
      artifactOwnershipPath: ARTIFACT_PATHS.artifactOwnership,
      artifactLineagePath: ARTIFACT_PATHS.artifactLineage
    }
  };
}

// src/core/retained-domain-workflows.mjs
import fs16 from "node:fs";
import path16 from "node:path";
var NOTE_FIELDS = /* @__PURE__ */ new Set(["missionId", "noteId", "title", "summary", "quotes", "claims", "openQuestions", "sourceIds", "artifactRefs"]);
var DRAFT_FIELDS = /* @__PURE__ */ new Set(["missionId", "draftId", "title", "body", "summary", "evidenceRefs", "artifactRefs"]);
var DRAFT_META_FIELDS = /* @__PURE__ */ new Set(["missionId", "draftId", "title", "summary", "evidenceRefs", "artifactRefs"]);
var EXPERIMENT_FIELDS = /* @__PURE__ */ new Set(["missionId", "experimentId", "title", "goal", "hypothesis", "protocol", "successCriteria", "comparisonTargets", "result", "resultEvidenceRefs", "auditFindings", "integrityFlags", "claimId", "bridgeReason"]);
var FIGURE_FIELDS = /* @__PURE__ */ new Set(["missionId", "figureId", "intent", "purpose", "materials", "prompt", "outputPath", "outputSha256", "caption", "qaFindings"]);
var REBUTTAL_FIELDS = /* @__PURE__ */ new Set(["missionId", "issues", "strategy", "responses"]);
var VERSION_FIELDS = /* @__PURE__ */ new Set(["missionId", "versionId", "label", "artifactRefs", "supersedesVersionId", "finalize"]);
var COMPARE_FIELDS = /* @__PURE__ */ new Set(["missionId", "fromVersionId", "toVersionId"]);
function filePath(directory, id, extension = "json") {
  return path16.posix.join(directory, `${id}.${extension}`);
}
function existingBoundRecord(root, relativePath, missionId, label) {
  const current = fs16.existsSync(path16.resolve(root, relativePath)) ? readJson(root, relativePath, null) : null;
  if (current && current.missionId !== missionId) throw new Error(`${label} belongs to mission ${current.missionId}, not ${missionId}.`);
  return current;
}
function currentBoundRecord(root, relativePath, missionId, label) {
  resolveMissionArtifactReferences(root, missionId, [relativePath], `${label} artifact`);
  const current = readJson(root, relativePath, null);
  if (!current || current.missionId !== missionId) throw new Error(`${label} is not a current record for mission ${missionId}.`);
  return current;
}
function normalizeFindingRefs(root, missionId, values, label) {
  return domainStringArray(values, label, { minItems: 1 }).map((reference, index) => {
    const separator = reference.lastIndexOf("#");
    if (separator <= 0 || separator === reference.length - 1) throw new Error(`${label}[${index}] must use <review-artifact-path>#<finding-id>.`);
    const artifactPath = reference.slice(0, separator);
    const findingId = domainSafeId(reference.slice(separator + 1), `${label}[${index}] finding id`);
    const [artifact] = resolveMissionArtifactReferences(root, missionId, [artifactPath], `${label}[${index}]`);
    let review;
    try {
      review = readJson(root, artifact.path, null);
    } catch {
      throw new Error(`${label}[${index}] must reference a JSON review artifact.`);
    }
    const findings = Array.isArray(review?.findings) ? review.findings : [];
    const finding = findings.find((item) => item && typeof item === "object" && (item.findingId === findingId || item.id === findingId));
    if (review?.missionId !== missionId || !finding) throw new Error(`${label}[${index}] does not resolve to a mission-bound review finding.`);
    return `${artifact.path}#${findingId}`;
  });
}
function normalizeEvidenceRefs(root, missionId, values, label = "evidenceRefs") {
  const references = domainStringArray(values, label);
  return references.map((reference, index) => {
    if (reference.startsWith("source:")) {
      const id = reference.slice("source:".length);
      const evaluation = evaluateSourceReferences(root, [id], missionId)[0];
      if (!evaluation?.eligible) throw new Error(`${label}[${index}] is not eligible source evidence: ${evaluation?.reason ?? "unknown-source"}.`);
      return reference;
    }
    if (reference.startsWith("note:")) {
      const id = reference.slice("note:".length);
      const evaluation = evaluateNoteReferences(root, [id], missionId)[0];
      if (!evaluation?.eligible) throw new Error(`${label}[${index}] is not eligible note evidence: ${evaluation?.reason ?? "unknown-note"}.`);
      return reference;
    }
    const artifactPath = reference.startsWith("artifact:") ? reference.slice("artifact:".length) : reference;
    const [artifact] = resolveMissionArtifactReferences(root, missionId, [artifactPath], `${label}[${index}]`);
    return `artifact:${artifact.path}`;
  });
}
function normalizeRebuttalIssueItems(root, missionId, items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("normalize_rebuttal_issues requires at least one issue.");
  return items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`issues[${index}] must be an object.`);
    const unknown = Object.keys(item).filter((field) => !["issueId", "summary", "findingRefs", "evidenceRefs"].includes(field));
    if (unknown.length) throw new Error(`issues[${index}] does not accept unknown input: ${unknown.join(", ")}.`);
    return { issueId: domainSafeId(item.issueId, `issues[${index}].issueId`), summary: domainNonEmptyText(item.summary, `issues[${index}].summary`), findingRefs: normalizeFindingRefs(root, missionId, item.findingRefs, `issues[${index}].findingRefs`), evidenceRefs: normalizeEvidenceRefs(root, missionId, item.evidenceRefs, `issues[${index}].evidenceRefs`) };
  });
}
function rebuttalIssuesRecord(missionId, issues) {
  return { schemaVersion: 1, missionId, issues, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function rebuttalStrategyRecord(missionId, issues, strategy) {
  return { schemaVersion: 1, missionId, strategy: domainNonEmptyText(strategy, "strategy"), issueIds: issues.map((item) => item.issueId), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function upsertNote(root, args2 = {}) {
  assertSealedDomainArgs(args2, NOTE_FIELDS, "upsert_note");
  const { mission } = readCurrentMission(root, args2.missionId, "Note workflow");
  const noteId = domainSafeId(args2.noteId, "noteId");
  const summary = typeof args2.summary === "string" ? args2.summary.trim() : "";
  const quotes = domainStringArray(args2.quotes, "quotes");
  const claims = domainStringArray(args2.claims, "claims");
  const openQuestions = domainStringArray(args2.openQuestions, "openQuestions");
  if (!summary && quotes.length === 0 && claims.length === 0 && openQuestions.length === 0) throw new Error("upsert_note requires substantive synthesis content.");
  const sourceIds = domainStringArray(args2.sourceIds, "sourceIds");
  if (sourceIds.length > 0) {
    const failures = evaluateSourceReferences(root, sourceIds, mission.missionId).filter((item) => !item.eligible);
    if (failures.length) throw new Error(`upsert_note rejects ineligible sources: ${failures.map((item) => `${item.reference} (${item.reason})`).join(", ")}.`);
  }
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, args2.artifactRefs, "artifactRefs");
  if (sourceIds.length === 0 && artifacts.length === 0) throw new Error("upsert_note requires at least one verified source or current mission artifact reference.");
  const relativePath = filePath(".dove/notes", noteId);
  existingBoundRecord(root, relativePath, mission.missionId, `Note ${noteId}`);
  const note = {
    schemaVersion: 1,
    noteId,
    missionId: mission.missionId,
    title: typeof args2.title === "string" && args2.title.trim() ? args2.title.trim() : noteId,
    summary: summary || null,
    quotes,
    claims,
    openQuestions,
    sourceIds,
    artifactRefs: artifacts.map((item) => item.path),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return { ...finalizeDomainArtifacts(root, { actionId: "upsert-note", missionId: mission.missionId, summary: `Recorded note ${noteId}.`, completionEligible: false, writes: [{ path: relativePath, kind: "data", content: domainJson(note), derivedReferences: [...sourceIds.map((id) => `source:${id}`), ...note.artifactRefs.map((item) => `artifact:${item}`)] }] }), note };
}
function draftContent(draft) {
  return `# ${draft.title}

${draft.body}

---
Mission: ${draft.missionId}
Evidence: ${draft.evidenceRefs.join(", ") || "none"}
`;
}
function upsertDraft(root, args2 = {}) {
  assertSealedDomainArgs(args2, DRAFT_FIELDS, "upsert_draft");
  const { mission } = readCurrentMission(root, args2.missionId, "Draft workflow");
  const draftId = domainSafeId(args2.draftId, "draftId");
  const evidenceRefs = normalizeEvidenceRefs(root, mission.missionId, [...domainStringArray(args2.evidenceRefs, "evidenceRefs"), ...domainStringArray(args2.artifactRefs, "artifactRefs").map((value2) => `artifact:${value2}`)]);
  const draft = { schemaVersion: 1, draftId, missionId: mission.missionId, title: typeof args2.title === "string" && args2.title.trim() ? args2.title.trim() : draftId, body: domainNonEmptyText(args2.body, "body"), summary: typeof args2.summary === "string" && args2.summary.trim() ? args2.summary.trim() : null, evidenceRefs, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  const relativePath = filePath(".dove/drafts", draftId, "md");
  return { ...finalizeDomainArtifacts(root, { actionId: "upsert-draft", missionId: mission.missionId, summary: `Recorded draft ${draftId}.`, completionEligible: true, writes: [{ path: relativePath, kind: "document", content: draftContent(draft), derivedReferences: evidenceRefs }] }), draft };
}
function upsertDraftMetadata(root, args2 = {}) {
  assertSealedDomainArgs(args2, DRAFT_META_FIELDS, "upsert_draft_metadata");
  const { mission } = readCurrentMission(root, args2.missionId, "Draft metadata workflow");
  const draftId = domainSafeId(args2.draftId, "draftId");
  const draftPath = filePath(".dove/drafts", draftId, "md");
  resolveMissionArtifactReferences(root, mission.missionId, [draftPath], "draftPath");
  const evidenceRefs = normalizeEvidenceRefs(root, mission.missionId, [...domainStringArray(args2.evidenceRefs, "evidenceRefs"), ...domainStringArray(args2.artifactRefs, "artifactRefs").map((value2) => `artifact:${value2}`)]);
  const metadataPath = filePath(".dove/drafts", `${draftId}.metadata`);
  const metadata = { schemaVersion: 1, draftId, missionId: mission.missionId, title: typeof args2.title === "string" && args2.title.trim() ? args2.title.trim() : draftId, summary: typeof args2.summary === "string" && args2.summary.trim() ? args2.summary.trim() : null, evidenceRefs, draftPath, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  return finalizeDomainArtifacts(root, { actionId: "upsert-draft-metadata", missionId: mission.missionId, summary: `Recorded metadata for draft ${draftId}.`, completionEligible: false, writes: [{ path: metadataPath, kind: "data", content: domainJson(metadata), derivedReferences: [`artifact:${draftPath}`, ...evidenceRefs] }] });
}
function runExperienceWorkflow(root, args2 = {}) {
  assertSealedDomainArgs(args2, EXPERIMENT_FIELDS, "run_experience_workflow");
  const { mission } = readCurrentMission(root, args2.missionId, "Experiment workflow");
  const experimentId = domainSafeId(args2.experimentId, "experimentId");
  const protocol = domainNonEmptyText(args2.protocol, "protocol");
  const successCriteria = domainStringArray(args2.successCriteria, "successCriteria", { minItems: 1 });
  const plan = { schemaVersion: 1, experimentId, missionId: mission.missionId, title: typeof args2.title === "string" && args2.title.trim() ? args2.title.trim() : experimentId, goal: domainNonEmptyText(args2.goal, "goal"), hypothesis: domainNonEmptyText(args2.hypothesis, "hypothesis"), protocol, successCriteria, comparisonTargets: domainStringArray(args2.comparisonTargets, "comparisonTargets"), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  const writes = [{ path: filePath(".dove/experiments", `${experimentId}.plan`), kind: "data", content: domainJson(plan), derivedReferences: [] }];
  let result = null;
  let audit = null;
  let bridge = null;
  if (args2.result !== void 0) {
    const resultEvidenceRefs = normalizeEvidenceRefs(root, mission.missionId, args2.resultEvidenceRefs, "resultEvidenceRefs");
    if (resultEvidenceRefs.length === 0) throw new Error("Experiment result requires current mission-bound evidence.");
    result = { schemaVersion: 1, resultId: experimentId, experimentId, missionId: mission.missionId, outcome: domainNonEmptyText(args2.result, "result"), evidenceRefs: resultEvidenceRefs, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    writes.push({ path: filePath(".dove/experiments", `${experimentId}.result`), kind: "data", content: domainJson(result), derivedReferences: resultEvidenceRefs });
    const auditFindings = domainStringArray(args2.auditFindings, "auditFindings");
    const integrityFlags = domainStringArray(args2.integrityFlags, "integrityFlags");
    if (auditFindings.length === 0) throw new Error("Experiment result requires an explicit audit before claim bridging.");
    audit = { schemaVersion: 1, auditId: experimentId, experimentId, resultId: experimentId, missionId: mission.missionId, findings: auditFindings, integrityFlags, passed: integrityFlags.length === 0, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    result.audit = { passed: audit.passed, auditId: audit.auditId };
    writes[writes.length - 1] = { ...writes.at(-1), content: domainJson(result) };
    writes.push({ path: filePath(".dove/experiments", `${experimentId}.audit`), kind: "data", content: domainJson(audit), derivedReferences: [`experiment-result:${experimentId}`] });
    if (args2.claimId !== void 0) {
      if (!audit.passed) throw new Error("Experiment result cannot bridge to a claim while integrity flags remain.");
      const claimId = domainSafeId(args2.claimId, "claimId");
      currentBoundRecord(root, filePath(".dove/claims", claimId), mission.missionId, `Claim ${claimId}`);
      bridge = { schemaVersion: 1, bridgeId: `${experimentId}-${claimId}`, missionId: mission.missionId, experimentId, resultId: experimentId, auditId: experimentId, claimId, reason: domainNonEmptyText(args2.bridgeReason, "bridgeReason"), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      writes.push({ path: filePath(".dove/claims", `${experimentId}-${claimId}.bridge`), kind: "data", content: domainJson(bridge), derivedReferences: [`experiment-result:${experimentId}`, `claim:${claimId}`] });
    }
  } else if (args2.auditFindings !== void 0 || args2.integrityFlags !== void 0 || args2.claimId !== void 0) {
    throw new Error("Experiment audit or claim bridge requires a real result and result evidence.");
  }
  return { ...finalizeDomainArtifacts(root, { actionId: "run-experience-workflow", missionId: mission.missionId, summary: result ? `Recorded experiment ${experimentId} plan, result, and audit.` : `Recorded experiment ${experimentId} protocol.`, completionEligible: Boolean(result && audit?.passed), writes }), plan, result, audit, bridge, hostBoundary: { executesExperiment: false, providerScheduling: false } };
}
function currentOutput(root, outputPath, expectedHash) {
  const canonical = canonicalDomainPath(outputPath, "outputPath");
  if (!fs16.existsSync(path16.resolve(root, canonical))) throw new Error("Figure outputPath does not exist.");
  const actual = domainSha256(fs16.readFileSync(path16.resolve(root, canonical)));
  if (expectedHash && expectedHash !== actual) throw new Error("Figure output hash does not match the imported file.");
  return { path: canonical, sha256: actual };
}
function runFigureWorkflow(root, args2 = {}) {
  assertSealedDomainArgs(args2, FIGURE_FIELDS, "run_figure_workflow");
  const { mission } = readCurrentMission(root, args2.missionId, "Figure workflow");
  const figureId = domainSafeId(args2.figureId, "figureId");
  const materials = resolveMissionArtifactReferences(root, mission.missionId, args2.materials, "materials");
  if (materials.length === 0) throw new Error("Figure workflow requires current mission-bound materials.");
  const prompt = domainNonEmptyText(args2.prompt, "prompt");
  const writes = [];
  const plan = { schemaVersion: 1, figureId, missionId: mission.missionId, intent: domainNonEmptyText(args2.intent, "intent"), purpose: domainNonEmptyText(args2.purpose, "purpose"), materialRefs: materials.map((item) => item.path), prompt, hostBoundary: "provider-execution-outside-dove", updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  writes.push({ path: filePath(".dove/figures", `${figureId}.plan`), kind: "data", content: domainJson(plan), derivedReferences: plan.materialRefs.map((item) => `artifact:${item}`) });
  let imported = null;
  let qa = null;
  if (args2.outputPath !== void 0) {
    const output = currentOutput(root, args2.outputPath, args2.outputSha256);
    const sourceContent = fs16.readFileSync(path16.resolve(root, output.path));
    const extension = path16.extname(output.path).toLowerCase() || ".bin";
    const finalPath = filePath(".dove/figures", `${figureId}.final`, extension.slice(1));
    const caption = domainNonEmptyText(args2.caption, "caption");
    const qaFindings = domainStringArray(args2.qaFindings, "qaFindings");
    const coverage = verifyExpectedReviewCoverage(root, {
      missionId: mission.missionId,
      expectedSnapshots: [{ path: finalPath, sizeBytes: sourceContent.length, sha256: output.sha256 }],
      requireAuthoritative: true
    });
    imported = { schemaVersion: 1, figureId, missionId: mission.missionId, importedFrom: output.path, finalPath, finalSha256: output.sha256, caption, provenance: { materialRefs: plan.materialRefs, promptSha256: domainSha256(prompt) }, validated: false, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    qa = { schemaVersion: 1, figureId, missionId: mission.missionId, finalPath, finalSha256: output.sha256, findings: qaFindings, reviewCoverage: coverage, status: imported.validated ? "validated" : qaFindings.length ? "needs-fix" : "ready-for-independent-review", updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    writes.push({ path: finalPath, kind: "figure", content: sourceContent, derivedReferences: plan.materialRefs.map((item) => `artifact:${item}`) });
    writes.push({ path: filePath(".dove/figures", `${figureId}.caption`, "md"), kind: "document", content: `${caption}
`, derivedReferences: [`artifact:${finalPath}`] });
    writes.push({ path: filePath(".dove/figures", `${figureId}.provenance`), kind: "data", content: domainJson(imported), derivedReferences: [`artifact:${finalPath}`, ...plan.materialRefs.map((item) => `artifact:${item}`)] });
    writes.push({ path: filePath(".dove/figures", `${figureId}.qa`), kind: "data", content: domainJson(qa), derivedReferences: [`artifact:${finalPath}`] });
  } else if (args2.caption !== void 0 || args2.qaFindings !== void 0 || args2.outputSha256 !== void 0) {
    throw new Error("Figure caption, QA, or hash import requires outputPath.");
  }
  return { ...finalizeDomainArtifacts(root, { actionId: "run-figure-workflow", missionId: mission.missionId, summary: imported ? `Imported figure ${figureId} with provenance and QA.` : `Prepared figure ${figureId} materials and prompt.`, completionEligible: imported?.validated === true, writes }), plan, imported, qa, hostBoundary: { executesProvider: false, acceptsImportedOutput: true } };
}
function normalizeRebuttalIssues(root, args2 = {}) {
  assertSealedDomainArgs(args2, /* @__PURE__ */ new Set(["missionId", "issues"]), "normalize_rebuttal_issues");
  const { mission } = readCurrentMission(root, args2.missionId, "Rebuttal issue normalization");
  const issues = normalizeRebuttalIssueItems(root, mission.missionId, args2.issues);
  const record = rebuttalIssuesRecord(mission.missionId, issues);
  return finalizeDomainArtifacts(root, { actionId: "normalize-rebuttal-issues", missionId: mission.missionId, summary: `Normalized ${issues.length} rebuttal issue(s).`, completionEligible: false, writes: [{ path: filePath(".dove/rebuttal", `${mission.missionId}.issues`), kind: "data", content: domainJson(record), derivedReferences: issues.flatMap((item) => [...item.findingRefs.map((id) => `finding:${id}`), ...item.evidenceRefs]) }] });
}
function buildRebuttalStrategy(root, args2 = {}) {
  assertSealedDomainArgs(args2, /* @__PURE__ */ new Set(["missionId", "strategy"]), "build_rebuttal_strategy");
  const { mission } = readCurrentMission(root, args2.missionId, "Rebuttal strategy");
  const issuesPath = filePath(".dove/rebuttal", `${mission.missionId}.issues`);
  const issues = currentBoundRecord(root, issuesPath, mission.missionId, "Rebuttal issues");
  if (!issues?.issues?.length) throw new Error("build_rebuttal_strategy requires normalized mission-bound issues.");
  const strategy = rebuttalStrategyRecord(mission.missionId, issues.issues, args2.strategy);
  return finalizeDomainArtifacts(root, { actionId: "build-rebuttal-strategy", missionId: mission.missionId, summary: "Recorded author-side rebuttal strategy.", completionEligible: false, writes: [{ path: filePath(".dove/rebuttal", `${mission.missionId}.strategy`), kind: "data", content: domainJson(strategy), derivedReferences: [`artifact:${issuesPath}`] }] });
}
function buildRebuttal(root, args2 = {}) {
  assertSealedDomainArgs(args2, REBUTTAL_FIELDS, "build_rebuttal");
  const { mission } = readCurrentMission(root, args2.missionId, "Rebuttal workflow");
  const issuesPath = filePath(".dove/rebuttal", `${mission.missionId}.issues`);
  const strategyPath = filePath(".dove/rebuttal", `${mission.missionId}.strategy`);
  const writes = [];
  const issues = args2.issues !== void 0 ? rebuttalIssuesRecord(mission.missionId, normalizeRebuttalIssueItems(root, mission.missionId, args2.issues)) : currentBoundRecord(root, issuesPath, mission.missionId, "Rebuttal issues");
  if (!issues?.issues?.length) throw new Error("build_rebuttal requires normalized mission-bound issues.");
  if (args2.issues !== void 0) {
    writes.push({ path: issuesPath, kind: "data", content: domainJson(issues), derivedReferences: issues.issues.flatMap((item) => [...item.findingRefs.map((id) => `finding:${id}`), ...item.evidenceRefs]) });
  }
  const strategy = args2.strategy !== void 0 ? rebuttalStrategyRecord(mission.missionId, issues.issues, args2.strategy) : currentBoundRecord(root, strategyPath, mission.missionId, "Rebuttal strategy");
  if (!strategy?.strategy || strategy.missionId !== mission.missionId) throw new Error("build_rebuttal requires an author-side strategy for the requested mission.");
  if (args2.strategy !== void 0) {
    writes.push({ path: strategyPath, kind: "data", content: domainJson(strategy), derivedReferences: [`artifact:${issuesPath}`] });
  }
  if (!Array.isArray(args2.responses) || args2.responses.length === 0) throw new Error("build_rebuttal requires evidence-linked responses.");
  const responses = args2.responses.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`responses[${index}] must be an object.`);
    const unknown = Object.keys(item).filter((field) => !["issueId", "response", "evidenceRefs"].includes(field));
    if (unknown.length) throw new Error(`responses[${index}] does not accept unknown input: ${unknown.join(", ")}.`);
    const issueId = domainSafeId(item.issueId, `responses[${index}].issueId`);
    if (!issues.issues.some((issue) => issue.issueId === issueId)) throw new Error(`responses[${index}] references unknown issue ${issueId}.`);
    const evidenceRefs = normalizeEvidenceRefs(root, mission.missionId, item.evidenceRefs, `responses[${index}].evidenceRefs`);
    if (evidenceRefs.length === 0) throw new Error(`responses[${index}] requires evidence.`);
    return { issueId, response: domainNonEmptyText(item.response, `responses[${index}].response`), evidenceRefs };
  });
  const content = responses.map((item) => `## ${item.issueId}

${item.response}

Evidence: ${item.evidenceRefs.join(", ")}
`).join("\n");
  writes.push({ path: filePath(".dove/rebuttal", `${mission.missionId}.response`, "md"), kind: "document", content, derivedReferences: [`artifact:${issuesPath}`, `artifact:${strategyPath}`, ...responses.flatMap((item) => item.evidenceRefs)] });
  return finalizeDomainArtifacts(root, { actionId: "build-rebuttal", missionId: mission.missionId, summary: "Recorded author-side rebuttal responses.", completionEligible: true, writes });
}
function versionPath(versionId) {
  return filePath(".dove/versions", versionId);
}
function createVersionSnapshot(root, args2 = {}) {
  assertSealedDomainArgs(args2, VERSION_FIELDS, "create_version_snapshot");
  const { mission } = readCurrentMission(root, args2.missionId, "Version snapshot");
  const versionId = domainSafeId(args2.versionId, "versionId");
  if (fs16.existsSync(path16.resolve(root, versionPath(versionId)))) throw new Error(`Version snapshot id is already occupied: ${versionId}.`);
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, args2.artifactRefs, "artifactRefs");
  if (artifacts.length === 0) throw new Error("create_version_snapshot requires current mission artifacts.");
  const supersedesVersionId = args2.supersedesVersionId === void 0 ? null : domainSafeId(args2.supersedesVersionId, "supersedesVersionId");
  if (supersedesVersionId) {
    currentBoundRecord(root, versionPath(supersedesVersionId), mission.missionId, `Superseded version ${supersedesVersionId}`);
  }
  const completion = assessMissionCompletion(root, { missionId: mission.missionId });
  const reviewCoverage = verifyReviewCoverage(root, { missionId: mission.missionId, artifactPaths: artifacts.map((item) => item.path), requireAuthoritative: true });
  const finalization = args2.finalize === true ? { eligible: completion.complete && reviewCoverage.authoritative === true && reviewCoverage.failures.length === 0, completion, reviewCoverage } : null;
  if (args2.finalize === true && !finalization.eligible) throw new Error("Version finalization requires current mission completion and current authoritative review proof.");
  const copiedArtifacts = artifacts.map(({ path: artifactPath, kind, sha256: sha2564, receiptId }) => {
    const extension = path16.extname(artifactPath);
    const snapshotPath = filePath(path16.posix.join(".dove/versions", versionId, "artifacts"), domainSha256(artifactPath).slice(0, 20), extension ? extension.slice(1) : "bin");
    return { path: artifactPath, kind, sha256: sha2564, receiptId, snapshotPath };
  });
  const snapshot = { schemaVersion: 1, versionId, missionId: mission.missionId, label: typeof args2.label === "string" && args2.label.trim() ? args2.label.trim() : versionId, artifacts: copiedArtifacts, supersedesVersionId, finalization, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  const writes = [
    ...copiedArtifacts.map((item) => ({ path: item.snapshotPath, kind: item.kind, content: fs16.readFileSync(path16.resolve(root, item.path)), derivedReferences: [`artifact:${item.path}`] })),
    { path: versionPath(versionId), kind: "data", content: domainJson(snapshot), derivedReferences: snapshot.artifacts.map((item) => `artifact:${item.path}`) }
  ];
  return finalizeDomainArtifacts(root, { actionId: "create-version-snapshot", missionId: mission.missionId, summary: `Created version snapshot ${versionId}.`, completionEligible: false, writes });
}
function compareVersions(root, args2 = {}) {
  assertSealedDomainArgs(args2, COMPARE_FIELDS, "compare_versions");
  const { mission } = readCurrentMission(root, args2.missionId, "Version comparison");
  const fromVersionId = domainSafeId(args2.fromVersionId, "fromVersionId");
  const toVersionId = domainSafeId(args2.toVersionId, "toVersionId");
  const from = currentBoundRecord(root, versionPath(fromVersionId), mission.missionId, `Version ${fromVersionId}`);
  const to = currentBoundRecord(root, versionPath(toVersionId), mission.missionId, `Version ${toVersionId}`);
  const stale = [...from.artifacts, ...to.artifacts].filter((item) => {
    if (typeof item.snapshotPath !== "string") return true;
    const [snapshotArtifact] = resolveMissionArtifactReferences(root, mission.missionId, [item.snapshotPath], `Version snapshot ${item.snapshotPath}`);
    return snapshotArtifact.sha256 !== item.sha256;
  });
  if (stale.length) throw new Error(`Version comparison refuses stale artifact snapshots: ${[...new Set(stale.map((item) => item.snapshotPath ?? item.path))].join(", ")}.`);
  const fromMap = new Map(from.artifacts.map((item) => [item.path, item.sha256]));
  const toMap = new Map(to.artifacts.map((item) => [item.path, item.sha256]));
  const paths = [.../* @__PURE__ */ new Set([...fromMap.keys(), ...toMap.keys()])].sort();
  const comparison = { schemaVersion: 1, missionId: mission.missionId, fromVersionId, toVersionId, added: paths.filter((item) => !fromMap.has(item)), removed: paths.filter((item) => !toMap.has(item)), changed: paths.filter((item) => fromMap.has(item) && toMap.has(item) && fromMap.get(item) !== toMap.get(item)), comparedAt: (/* @__PURE__ */ new Date()).toISOString() };
  return finalizeDomainArtifacts(root, { actionId: "compare-versions", missionId: mission.missionId, summary: `Compared versions ${fromVersionId} and ${toVersionId}.`, completionEligible: false, writes: [{ path: filePath(".dove/versions", `${fromVersionId}--${toVersionId}.comparison`), kind: "data", content: domainJson(comparison), derivedReferences: [`version:${fromVersionId}`, `version:${toVersionId}`] }] });
}
function queryDomainIntegrity(root) {
  const workspace = openDoveWorkspace(root, { operation: "Domain integrity query" });
  const ownership = readArtifactOwnership(root);
  const domainPrefixes = [".dove/sources/", ".dove/notes/", ".dove/claims/", ".dove/experiments/", ".dove/drafts/", ".dove/figures/", ".dove/rebuttal/", ".dove/versions/"];
  const domainArtifacts = ownership.artifacts.filter((item) => domainPrefixes.some((prefix) => item.path.startsWith(prefix)));
  const stale = domainArtifacts.filter((item) => !fs16.existsSync(path16.resolve(root, item.path)) || domainSha256(fs16.readFileSync(path16.resolve(root, item.path))) !== item.sha256);
  return { workspaceId: workspace.manifest.workspaceId, artifactCount: domainArtifacts.length, staleArtifactCount: stale.length, stalePaths: stale.map((item) => item.path) };
}

// src/core/mission-queries.mjs
function wantsFullStatus(args2 = {}) {
  return args2.full === true || args2.includeDetails === true || args2.includeMissionDetails === true || args2.showMissions === true || args2.detail === "full" || args2.view === "full";
}
function responseLanguage(args2 = {}) {
  return args2.responseLanguage === "en" || args2.language === "en" ? "en" : "zh";
}
function compactDomainIntegrity(integrity) {
  return {
    artifactCount: integrity.artifactCount,
    staleArtifactCount: integrity.staleArtifactCount,
    stalePaths: integrity.stalePaths
  };
}
function readCurrentMissions(root, options = {}) {
  const workspace = openDoveWorkspace(root, { allowAbsent: options.allowAbsent === true, operation: options.operation ?? "Dove mission query" });
  if (workspace.state === "absent") return { workspace, missions: [] };
  const missionsRoot = path17.resolve(root, ARTIFACT_PATHS.missionsDir);
  const missions = fs17.readdirSync(missionsRoot, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => {
    const relativePath = path17.posix.join(ARTIFACT_PATHS.missionsDir, entry.name);
    let mission;
    try {
      mission = JSON.parse(fs17.readFileSync(path17.resolve(root, relativePath), "utf8"));
    } catch (error) {
      throw new Error(`Malformed durable JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    assertCurrentMissionContract(mission);
    return mission;
  }).sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || left.missionId.localeCompare(right.missionId));
  return { workspace, missions };
}
function emptyStatus(args2, language) {
  const headline = language === "en" ? "Dove is not initialized in this workspace." : "\u5F53\u524D workspace \u5C1A\u672A\u521D\u59CB\u5316 Dove\u3002";
  const result = {
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    intent: typeof args2.intent === "string" ? args2.intent.trim() || null : null,
    responseLanguage: language,
    detail: "compact",
    detailsAvailable: true,
    summary: headline,
    headline,
    scope: { kind: "minimal-mission-workspace", schemaVersion: null, state: "absent" },
    currentContext: { missionCount: 0, receiptCount: 0, sourceCount: 0, integrityAssessment: null, domainIntegrity: null, reviewValidity: null },
    nextStep: { label: language === "en" ? "Run dove init, inspect the proposal, and confirm the exact replay data." : "\u8FD0\u884C dove init\uFF0C\u68C0\u67E5 proposal\uFF0C\u5E76\u786E\u8BA4 exact replay data\u3002" },
    needsAttention: { status: "needs-init", summary: language === "en" ? "A confirmed initialization is required before durable Dove work can begin." : "\u5F00\u59CB durable Dove \u5DE5\u4F5C\u524D\u9700\u8981\u5148\u786E\u8BA4\u521D\u59CB\u5316\u3002" },
    changes: { intent: "none", applied: false, count: 0, rollback: "not-applicable" },
    showMore: { detailsAvailable: true },
    optionalMissionDetails: null,
    statusHome: null
  };
  result.statusHome = {
    presentation: "dove-project-situation-home",
    detail: result.detail,
    liveContextFirst: true,
    intent: result.intent,
    headline,
    scope: result.scope,
    currentContext: result.currentContext,
    nextStep: result.nextStep,
    needsAttention: result.needsAttention,
    changes: result.changes,
    showMore: result.showMore,
    optionalMissionDetails: null,
    detailsAvailable: true
  };
  return wantsFullStatus(args2) ? { ...result, detail: "full", manifest: null, project: null, missions: [], integrityAssessment: null, domainIntegrity: null, sourceIntegrity: null, reviewValidity: null, diagnostics: { artifactPathsRead: [], noRefresh: true, noCommandExecution: true, noExternalProcess: true, noGitInspection: true, noSourceMutation: true } } : result;
}
function queryDoveStatus(root, args2 = {}) {
  const language = responseLanguage(args2);
  const { workspace, missions } = readCurrentMissions(root, { allowAbsent: true, operation: "Dove status" });
  if (workspace.state === "absent") return emptyStatus(args2, language);
  const latestMission = missions.at(-1) ?? null;
  const integrityAssessment = latestMission ? assessMissionCompletion(root, { missionId: latestMission.missionId }) : null;
  const receipts = readExecutionReceipts(root);
  const malformedReceipt = receipts.find((receipt) => receipt.__readFailure);
  if (malformedReceipt) throw new Error(`Malformed durable JSON in ${path17.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${malformedReceipt.receiptId}.json`)}: ${malformedReceipt.__readFailure}`);
  const domainIntegrity = queryDomainIntegrity(root);
  const sourceItems = missions.flatMap((mission) => querySources(root, { missionId: mission.missionId, limit: 200 }).items);
  const sourceIntegrity = {
    sourceCount: sourceItems.length,
    eligibleCount: sourceItems.filter((item) => item.eligibility?.eligible === true).length,
    candidateCount: sourceItems.filter((item) => item.lifecycle === "candidate").length,
    rejectedCount: sourceItems.filter((item) => item.lifecycle === "rejected").length,
    invalidCount: sourceItems.filter((item) => item.eligibility?.eligible !== true && item.lifecycle === "verified").length
  };
  const reviewValidity = latestMission ? verifyReviewCoverage(root, { missionId: latestMission.missionId }) : { covered: false, authoritative: false, failures: ["mission-missing"] };
  const headline = language === "en" ? `Dove schema ${workspace.schemaVersion} is healthy with ${missions.length} mission contract${missions.length === 1 ? "" : "s"}.` : `Dove schema ${workspace.schemaVersion} \u5065\u5EB7\uFF0C\u5F53\u524D\u6709 ${missions.length} \u4E2A mission contract\u3002`;
  const attentionReasons = [
    ...integrityAssessment && !integrityAssessment.complete ? integrityAssessment.incompleteReasons : [],
    ...domainIntegrity.stalePaths ?? [],
    ...sourceIntegrity.invalidCount > 0 ? ["invalid-source-verification"] : []
  ];
  const currentContext = {
    missionCount: missions.length,
    receiptCount: receipts.length,
    sourceCount: sourceIntegrity.sourceCount,
    integrityAssessment: integrityAssessment ? { complete: integrityAssessment.complete, staleReceiptCount: integrityAssessment.staleReceiptIds.length, incompleteReasons: integrityAssessment.incompleteReasons } : null,
    domainIntegrity: compactDomainIntegrity(domainIntegrity),
    reviewValidity: { covered: reviewValidity.covered === true, authoritative: reviewValidity.authoritative === true, failures: reviewValidity.failures ?? [] }
  };
  const result = {
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    intent: typeof args2.intent === "string" ? args2.intent.trim() || null : null,
    responseLanguage: language,
    detail: "compact",
    detailsAvailable: true,
    summary: headline,
    headline,
    scope: { kind: "minimal-mission-workspace", schemaVersion: workspace.schemaVersion },
    currentContext,
    nextStep: { label: latestMission ? language === "en" ? "Continue the approved work with native host planning." : "\u7531\u5BBF\u4E3B\u539F\u751F plan \u7EE7\u7EED\u5DF2\u6279\u51C6\u5DE5\u4F5C\u3002" : language === "en" ? "Create one minimal mission contract." : "\u521B\u5EFA\u4E00\u4E2A\u6700\u5C0F mission contract\u3002" },
    needsAttention: attentionReasons.length ? { status: "incomplete", summary: language === "en" ? "Current mission or domain evidence is incomplete." : "\u5F53\u524D mission \u6216\u9886\u57DF\u8BC1\u636E\u5C1A\u4E0D\u5B8C\u6574\u3002", reasons: attentionReasons } : { status: "clear", summary: language === "en" ? "No current mission or domain integrity failure is present." : "\u5F53\u524D\u6CA1\u6709 mission \u6216\u9886\u57DF\u5B8C\u6574\u6027\u5931\u8D25\u3002" },
    changes: { intent: "none", applied: false, count: 0, rollback: "not-applicable" },
    showMore: { detailsAvailable: true },
    optionalMissionDetails: null,
    statusHome: null
  };
  result.statusHome = { presentation: "dove-project-situation-home", detail: result.detail, liveContextFirst: true, intent: result.intent, headline, scope: result.scope, currentContext, nextStep: result.nextStep, needsAttention: result.needsAttention, changes: result.changes, showMore: result.showMore, optionalMissionDetails: null, detailsAvailable: true };
  if (!wantsFullStatus(args2)) return result;
  return {
    ...result,
    detail: "full",
    manifest: workspace.manifest,
    project: workspace.project,
    missions,
    integrityAssessment,
    domainIntegrity,
    sourceIntegrity,
    reviewValidity,
    diagnostics: {
      artifactPathsRead: [ARTIFACT_PATHS.doveRootManifest, ARTIFACT_PATHS.projectIdentity, ARTIFACT_PATHS.missionsDir, ARTIFACT_PATHS.executionReceiptsDir, ARTIFACT_PATHS.artifactOwnership, ARTIFACT_PATHS.artifactLineage, ".dove/sources"],
      noRefresh: true,
      noCommandExecution: true,
      noExternalProcess: true,
      noGitInspection: true,
      noSourceMutation: true
    }
  };
}

// scripts/generate-command-adapters.mjs
import fs18 from "node:fs";
import path18 from "node:path";
import { fileURLToPath } from "node:url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path18.dirname(__filename);
var PACKAGE_ROOT = path18.resolve(__dirname, "..");
function markdownTitle(command3) {
  return command3.title.replace(/\b\w/g, (char) => char.toUpperCase());
}
function yamlString(value2) {
  return JSON.stringify(String(value2).replace(/\n/g, " "));
}
function policyLine(command3) {
  switch (command3.policy) {
    case "proposal-only":
      return "Only inspect and suggest; wait for explicit approval before changing anything.";
    case "query":
      return "Keep every read and query strictly read-only with zero writes; never bootstrap, refresh, or mutate state from the query path.";
    case "guarded-mutation":
      return "Only make the specific change requested for this command; do not bundle unrelated work.";
    case "explicit-approval":
      return "Ask for approval before making changes or spending the proposed work rounds.";
    case "governed-bookkeeping":
      return "Add only the explicit note or lesson the operator asked for.";
    case "guidance":
      return "Give workflow guidance only; move real changes through the matching Dove request.";
    case "isolated-handoff":
      return "Use only the reviewer materials the operator provides; do not share hidden session context.";
    default:
      return "Stay within this command's purpose and keep implementation details out of the default answer.";
  }
}
function dailyUseBullets(command3) {
  const ux = command3.ux ?? {};
  return [
    ...Array.isArray(ux.dailyFlow) ? ux.dailyFlow : [],
    ux.targetingBehavior ? `Targeting: ${ux.targetingBehavior}` : null,
    ux.confirmationBehavior ? `Confirmation: ${ux.confirmationBehavior}` : null,
    ux.expectedOutcome ? `Outcome: ${ux.expectedOutcome}` : null
  ].filter(Boolean);
}
function exampleBullets(command3, hostId = null) {
  const examples = command3.ux?.examples;
  if (!Array.isArray(examples)) {
    return [];
  }
  return examples.map((example) => {
    const text = String(example).trim();
    return hostId === "opencode" ? text.replace(/^\/dove:/u, "/dove.") : text;
  }).filter(Boolean);
}
var DIRECT_PROCESS_COMMAND_IDS = new Set(DIRECT_PROCESS_ADAPTER_COMMAND_IDS);
function adapterCliCommand(commandId, command3) {
  return DIRECT_PROCESS_COMMAND_IDS.has(commandId) ? `${command3} --mutation-mode direct-process` : command3;
}
var LOCAL_CLI_COMMANDS = /* @__PURE__ */ new Map([
  ["dove.init", { command: adapterCliCommand("dove.init", 'node ./bin/dove-package.mjs init . --goal "<project goal>"'), kind: "work", note: "Use init only to establish minimal project identity; it must not create tasks, packets, checklists, runtime, orchestration, or navigation state." }],
  ["dove.status", { command: "node ./bin/dove-package.mjs status .", kind: "check" }],
  ["dove.lessons", { command: 'node ./bin/dove-package.mjs lessons query . --mission-id "<mission id>"', kind: "check", note: "Query is the default and must remain zero-write. Never auto-capture a lesson and never auto-recall lessons from another command. Use `lessons record` only when the operator explicitly asks to preserve a specific lesson; then run only the exact confirmation command returned by the zero-write proposal." }],
  ["dove.mission", { command: adapterCliCommand("dove.mission", 'node ./bin/dove-package.mjs mission . --goal "<mission goal>"'), kind: "check", note: "After approval, run the exact confirmation command returned by the proposal, persist only that contract, and continue with native host planning and tools." }],
  ["dove.version", { command: adapterCliCommand("dove.version", 'node ./bin/dove-package.mjs version . --mission-id "<mission id>" --version-id "<version id>" --artifact "<artifact path>"'), kind: "work", note: "Snapshots and comparisons are mission-bound and hash-current; finalization fails closed without completion and trusted review proof." }],
  ["dove.source", { command: adapterCliCommand("dove.source", 'node ./bin/dove-package.mjs source . --mission-id "<mission id>" --source-id "<source id>" --title "<source title>" --locator "<url or doi>"'), kind: "work", note: "Registration creates candidate material only; public verification can reject but cannot issue positive trust." }],
  ["dove.note", { command: adapterCliCommand("dove.note", 'node ./bin/dove-package.mjs note . --mission-id "<mission id>" --note-id "<note id>" --summary "<synthesis>"'), kind: "work", note: "Use this only with substantive synthesis and current mission-bound evidence." }],
  ["dove.experience", { command: adapterCliCommand("dove.experience", 'node ./bin/dove-package.mjs experience . --mission-id "<mission id>" --experiment-id "<experiment id>" --goal "<experiment goal>" --hypothesis "<hypothesis>" --protocol "<protocol>" --success-criterion "<criterion>"'), kind: "work", note: "Results require current evidence and a clean audit before claim bridging." }],
  ["dove.draft", { command: adapterCliCommand("dove.draft", 'node ./bin/dove-package.mjs draft . --mission-id "<mission id>" --draft-id "<draft id>" --body "<draft text>"'), kind: "work", note: "Write real body content; metadata-only mode requires an existing current mission draft." }],
  ["dove.figure", { command: adapterCliCommand("dove.figure", 'node ./bin/dove-package.mjs figure . --mission-id "<mission id>" --figure-id "<figure id>" --intent "<figure request>" --purpose "<purpose>" --material "<artifact path>" --prompt "<drawing prompt>"'), kind: "work", note: "Provider execution stays host-side; import output with an exact hash, caption, QA, and independent-review boundary." }],
  ["dove.review", { command: adapterCliCommand("dove.review", 'node ./bin/dove-package.mjs review . --mission-id "<mission id>" --review-id "<review id>" --artifact "<artifact path>" --preflight'), kind: "work", note: "Use --preflight for zero-write local checks, --prepare to freeze the canonical exchange, and --import only after the reviewer writes the canonical handoff and report. Public imports never mint Reviewer authority." }],
  ["dove.rebuttal", { command: adapterCliCommand("dove.rebuttal", 'node ./bin/dove-package.mjs rebuttal . --mission-id "<mission id>" --issue-json "<finding-linked issue JSON>" --strategy "<strategy>" --response-json "<response JSON>"'), kind: "work", note: "Every issue must link a current review artifact and finding id; responses remain author-side and evidence-linked." }]
]);
function localCliBullets(command3) {
  const localCli = LOCAL_CLI_COMMANDS.get(command3.id);
  if (localCli) {
    const listedKind = localCli.kind === "work" ? "listed project action" : "listed project check";
    const directness = localCli.kind === "work" ? "Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly." : "Summarize its practical result instead of inspecting internal files directly.";
    return [
      `This request has one ${listedKind}: \`${localCli.command}\`. Run it in the host's current working directory without changing directories or reinterpreting a parent repository as the target; \`.\` is the Dove workspace being operated on. ${directness}`,
      ...localCli.note ? [localCli.note] : []
    ];
  }
  const terminalProbe = `node ./bin/dove-package.mjs ${hostCommandSlug(command3.id)} --help`;
  return [`This request has no listed project action. Do not run status, \`${terminalProbe}\`, the matching local surface, or any other unlisted command for it. If the target is unclear, ask the operator to choose from visible context. If this chat cannot finish the requested work directly, answer with what material is ready, what has not been added to the task, and the next user choice; do not explain why the tool is unavailable.`];
}
function guardrailBullets(command3) {
  const bullets = [
    "For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.",
    "If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.",
    "If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.",
    ...localCliBullets(command3),
    "Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.",
    "Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.",
    "When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.",
    "Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.",
    "When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.",
    policyLine(command3),
    ...command3.adapterConstraints ?? [],
    "Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended."
  ];
  if (command3.id === "dove.mission") {
    bullets.push("Keep the handoff brief identical to the approved contract content; do not add a next command, role, route, authority, status, or blocker-routing instruction.");
  } else if (command3.domain === "paper") {
    bullets.push("Use the top-level Dove requests for sources, notes, drafting, review, rebuttal, experiences, figures, and version lineage.");
  } else {
    bullets.push("Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.");
  }
  if (command3.id !== "dove.mission") {
    bullets.push("Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.");
  }
  return bullets;
}
function renderBullets(bullets) {
  return bullets.map((bullet) => `- ${bullet}`).join("\n");
}
function renderNumbered(bullets) {
  return bullets.map((bullet, index) => `${index + 1}. ${bullet}`).join("\n");
}
function renderExamples(command3, hostId = null) {
  const examples = exampleBullets(command3, hostId);
  return examples.length > 0 ? `

## Examples

${examples.map((example) => `- \`${example}\``).join("\n")}` : "";
}
function renderBody(command3, heading, hostId = null) {
  const dailyUse = renderBullets(dailyUseBullets(command3));
  const examples = renderExamples(command3, hostId);
  const guardrails = renderNumbered(guardrailBullets(command3));
  return `# ${heading}

${command3.summary}

## Daily use

${dailyUse}${examples}

## Operating rules

${guardrails}
`;
}
function renderFrontmatter(command3, fields = {}) {
  const lines = ["---"];
  if (fields.name) {
    lines.push(`name: ${fields.name}`);
  }
  lines.push(`description: ${yamlString(command3.summary)}`);
  lines.push("---", "");
  return lines.join("\n");
}
function renderMarkdownCommand(command3, heading, hostId = null) {
  return `${renderFrontmatter(command3)}
${renderBody(command3, heading, hostId)}`;
}
function renderSkill(command3, hostId = null) {
  const name = `dove-${hostCommandSlug(command3.id)}`;
  return `${renderFrontmatter(command3, { name })}
${renderBody(command3, markdownTitle(command3), hostId)}`;
}
function renderCommandAdapter(hostId, command3) {
  switch (hostId) {
    case "opencode":
    case "claude":
      return renderMarkdownCommand(command3, command3.id, hostId);
    case "cursor":
      return renderMarkdownCommand(command3, `dove-${hostCommandSlug(command3.id)}`, hostId);
    case "codex":
    case "agents":
      return renderSkill(command3, hostId);
    default:
      throw new Error(`Unknown host adapter: ${hostId}`);
  }
}
function generatedClaudeUserCommandEntries() {
  return COMMAND_SURFACES.map((command3) => ({
    hostId: "claude",
    command: command3,
    relativePath: adapterPathForCommand("claude", command3),
    content: renderCommandAdapter("claude", command3)
  }));
}
function writeClaudeUserCommandAdapters(claudeConfigRoot) {
  const written = [];
  for (const entry of generatedClaudeUserCommandEntries()) {
    const { fullPath: absolutePath } = resolveCanonicalContainedWrite(claudeConfigRoot, entry.relativePath, { label: "Claude command adapter path" });
    fs18.mkdirSync(path18.dirname(absolutePath), { recursive: true });
    fs18.writeFileSync(absolutePath, `${entry.content.trimEnd()}
`, "utf8");
    written.push(entry.relativePath);
  }
  return written;
}

// bin/dove.mjs
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path19.dirname(__filename2);
var PACKAGE_ROOT2 = path19.resolve(__dirname2, "..");
var LOCAL_COMMANDS = /* @__PURE__ */ new Set(["init", "mission", "receipt", "status", "lessons", "version", "source", "note", "draft", "experience", "figure", "review", "rebuttal"]);
var PUBLIC_COMMANDS = new Set(COMMAND_SURFACES.map((surface2) => surface2.id.replace(/^dove\./u, "")));
function usage() {
  console.log(`dove

Usage:
  dove init [target] --goal <text> [--archive-reset]
  dove mission [target] --goal <text>
  dove receipt [target] --input <receipt.json>
  dove status [target] [--full|--missions]
  dove lessons [query|record] [target] [--mission-id <id>]
  dove source [register|verify] [target] --mission-id <id> --source-id <id>
  dove note [target] --mission-id <id> --note-id <id>
  dove draft [target] --mission-id <id> --draft-id <id>
  dove experience [target] --mission-id <id> --experiment-id <id>
  dove figure [target] --mission-id <id> --figure-id <id>
  dove review [target] --mission-id <id> <--preflight|--prepare|--import|--verify-coverage>
  dove rebuttal [target] --mission-id <id>
  dove version [target] --mission-id <id>
  dove install [target] --host <opencode|codex|cursor|agents|claude|all>
  dove sync [target] --host <opencode|codex|cursor|agents|claude|all>
  dove doctor [target]

Dove persists only schema 7 mission, advisory lesson, receipt, ownership, lineage, source, domain, review, rebuttal, and version artifacts.
`);
}
function readFlagValue(args2, flag) {
  const index = args2.indexOf(flag);
  return index >= 0 && index + 1 < args2.length ? args2[index + 1] : null;
}
function readFlagValues(args2, flag) {
  const values = [];
  for (let index = 0; index < args2.length; index += 1) {
    if (args2[index] === flag && index + 1 < args2.length) {
      values.push(args2[index + 1]);
      index += 1;
    }
  }
  return values;
}
function parseJson(value2, label) {
  try {
    return JSON.parse(value2);
  } catch (error) {
    throw new Error(`${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function parseRepeatedJson(args2, flag) {
  return readFlagValues(args2, flag).map((value2) => parseJson(value2, flag));
}
function mutationMode(args2, fallback = "patch-plan") {
  const value2 = readFlagValue(args2, "--mutation-mode") ?? fallback;
  if (!["patch-plan", "direct-process"].includes(value2)) throw new Error("--mutation-mode must be patch-plan or direct-process.");
  return value2;
}
function withoutMutationMode(args2) {
  const result = [];
  for (let index = 0; index < args2.length; index += 1) {
    if (args2[index] === "--mutation-mode") {
      index += 1;
    } else {
      result.push(args2[index]);
    }
  }
  return result;
}
function resolveTarget(rawTarget2) {
  return path19.resolve(process2.cwd(), rawTarget2 || ".");
}
function targetAndArgs(rawTarget2, args2) {
  return !rawTarget2 || rawTarget2.startsWith("-") ? { target: resolveTarget("."), args: rawTarget2 ? [rawTarget2, ...args2] : args2 } : { target: resolveTarget(rawTarget2), args: args2 };
}
function runMutation(target2, actionId, args2, callback, fallback = "patch-plan") {
  const cleanArgs = withoutMutationMode(args2);
  return runWithMutationContext(target2, { actionId, mutationMode: mutationMode(args2, fallback), hostId: "cli" }, () => callback(cleanArgs));
}
function shellQuote(value2) {
  return `'${String(value2 ?? "").replace(/'/gu, `'"'"'`)}'`;
}
function proposalToken(result) {
  return result?.confirmation?.confirmArgs ? Buffer.from(JSON.stringify({ version: result.confirmation.proposalVersion ?? 1, mutationMode: result.confirmation.mutationMode, confirmArgs: result.confirmation.confirmArgs }), "utf8").toString("base64url") : result?.confirmation?.proposalToken ?? null;
}
function proposalCommand(command3, result, target2, token = proposalToken(result)) {
  const mode = result?.confirmation?.mutationMode ?? result?.confirmation?.confirmArgs?.mutationMode;
  if (!token || !mode) return null;
  return ["node", shellQuote(__filename2), command3, shellQuote(target2), "--proposal-token", shellQuote(token), "--confirmed", "--mutation-mode", shellQuote(mode)].join(" ");
}
function withProposalCommand(command3, result, target2) {
  const token = proposalToken(result);
  const exactConfirmationCommand = proposalCommand(command3, result, target2, token);
  return exactConfirmationCommand ? { ...result, confirmation: { ...result.confirmation, proposalToken: token, exactConfirmationCommand } } : result;
}
function decodeProposalToken(token, label) {
  if (!token || !/^[A-Za-z0-9_-]+$/u.test(token)) throw new Error(`--proposal-token must be the exact token returned by the Dove ${label} proposal.`);
  let payload;
  try {
    payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    throw new Error(`--proposal-token is malformed. Request a fresh Dove ${label} proposal.`);
  }
  if (!payload?.confirmArgs || typeof payload.confirmArgs !== "object" || Array.isArray(payload.confirmArgs)) throw new Error(`--proposal-token is not a supported Dove ${label} token.`);
  return payload;
}
function initArgs(args2) {
  const token = readFlagValue(args2, "--proposal-token");
  if (token) return { ...decodeProposalToken(token, "init").confirmArgs, confirmed: args2.includes("--confirmed") };
  return { goal: readFlagValue(args2, "--goal"), archiveReset: args2.includes("--archive-reset"), confirmed: args2.includes("--confirmed"), proposalDigest: readFlagValue(args2, "--proposal-digest"), mutationMode: mutationMode(args2, "direct-process") };
}
function missionArgs(args2) {
  const token = readFlagValue(args2, "--proposal-token");
  if (token) {
    const payload = decodeProposalToken(token, "mission");
    return { ...payload.confirmArgs, confirmed: args2.includes("--confirmed"), mutationMode: payload.mutationMode ?? payload.confirmArgs.mutationMode };
  }
  return {
    confirmed: args2.includes("--confirmed"),
    mutationMode: mutationMode(args2, "direct-process"),
    proposalDigest: readFlagValue(args2, "--proposal-digest"),
    missionId: readFlagValue(args2, "--mission-id"),
    goal: readFlagValue(args2, "--goal"),
    scope: readFlagValues(args2, "--scope"),
    outOfScope: readFlagValues(args2, "--out-of-scope"),
    targetArtifacts: readFlagValues(args2, "--target-artifact"),
    expectedArtifacts: readFlagValues(args2, "--expected-artifact"),
    completionCriteria: readFlagValues(args2, "--completion-criterion"),
    evidenceRequirements: readFlagValues(args2, "--evidence-requirement"),
    dependsOnMissionIds: readFlagValues(args2, "--depends-on-mission-id"),
    supersedesMissionId: readFlagValue(args2, "--supersedes-mission-id")
  };
}
function lessonQueryArgs(args2) {
  return Object.fromEntries(Object.entries({
    lessonId: readFlagValue(args2, "--lesson-id") ?? void 0,
    missionId: readFlagValue(args2, "--mission-id") ?? void 0,
    scope: readFlagValue(args2, "--scope") ?? void 0,
    kind: readFlagValue(args2, "--kind") ?? void 0,
    tags: readFlagValues(args2, "--tag"),
    artifactRefs: readFlagValues(args2, "--artifact"),
    includeSuperseded: args2.includes("--include-superseded"),
    includeUnscoped: args2.includes("--include-unscoped"),
    limit: readFlagValue(args2, "--limit") ?? void 0
  }).filter(([, value2]) => value2 !== void 0));
}
function lessonRecordArgs(args2) {
  const token = readFlagValue(args2, "--proposal-token");
  if (token) {
    const payload = decodeProposalToken(token, "lesson");
    return { ...payload.confirmArgs, confirmed: args2.includes("--confirmed"), mutationMode: payload.mutationMode ?? payload.confirmArgs.mutationMode };
  }
  if (args2.includes("--confirmed")) throw new Error("dove lessons record --confirmed requires the exact --proposal-token returned by the proposal.");
  return {
    mutationMode: mutationMode(args2, "direct-process"),
    missionId: readFlagValue(args2, "--mission-id"),
    lessonId: readFlagValue(args2, "--lesson-id"),
    scope: readFlagValue(args2, "--scope"),
    kind: readFlagValue(args2, "--kind"),
    summary: readFlagValue(args2, "--summary"),
    details: readFlagValue(args2, "--details") ?? void 0,
    nextTimeGuidance: readFlagValues(args2, "--next-time-guidance"),
    sourceIds: readFlagValues(args2, "--source-id"),
    noteIds: readFlagValues(args2, "--note-id"),
    artifactRefs: readFlagValues(args2, "--artifact"),
    appliesToArtifactRefs: readFlagValues(args2, "--applies-to-artifact"),
    tags: readFlagValues(args2, "--tag"),
    supersedesLessonId: readFlagValue(args2, "--supersedes-lesson-id") ?? void 0
  };
}
function receiptArgs(args2, root) {
  const input = readFlagValue(args2, "--input");
  if (input) {
    const fullPath = path19.resolve(root, input);
    const relative = path19.relative(root, fullPath);
    if (relative.startsWith("..") || path19.isAbsolute(relative)) throw new Error("--input must stay inside the selected workspace.");
    return parseJson(fs19.readFileSync(fullPath, "utf8"), "--input");
  }
  return { receiptId: readFlagValue(args2, "--receipt-id"), missionId: readFlagValue(args2, "--mission-id"), contractDigest: readFlagValue(args2, "--contract-digest"), summary: readFlagValue(args2, "--summary"), artifacts: parseRepeatedJson(args2, "--artifact-json"), validations: parseRepeatedJson(args2, "--validation-json"), criteriaSatisfied: parseRepeatedJson(args2, "--criterion-json"), producedAt: readFlagValue(args2, "--produced-at") };
}
function sourceArgs(args2, action) {
  if (action === "verify") return { missionId: readFlagValue(args2, "--mission-id"), sourceId: readFlagValue(args2, "--source-id"), method: readFlagValue(args2, "--method"), checkedMaterial: readFlagValue(args2, "--checked-material"), auditEvidence: parseJson(readFlagValue(args2, "--audit-evidence-json") ?? "[]", "--audit-evidence-json") };
  return { missionId: readFlagValue(args2, "--mission-id"), sourceId: readFlagValue(args2, "--source-id"), citationKey: readFlagValue(args2, "--citation-key"), title: readFlagValue(args2, "--title"), locator: readFlagValue(args2, "--locator"), sourceType: readFlagValue(args2, "--source-type"), origin: readFlagValue(args2, "--origin"), abstract: readFlagValue(args2, "--abstract"), year: readFlagValue(args2, "--year"), authors: readFlagValues(args2, "--author"), capturePath: readFlagValue(args2, "--capture-path") };
}
function reviewArgs(args2) {
  const modes = ["preflight", "prepare", "import", "verify-coverage"].filter((mode2) => args2.includes(`--${mode2}`));
  if (modes.length > 1) throw new Error("dove review accepts one operation mode.");
  const mode = modes[0] ?? "preflight";
  const missionId = readFlagValue(args2, "--mission-id");
  if (mode === "import") return { mode, args: { missionId, exchangeId: readFlagValue(args2, "--exchange-id"), reviewId: readFlagValue(args2, "--review-id") } };
  if (mode === "verify-coverage") return { mode, args: { missionId, artifactPaths: readFlagValues(args2, "--artifact"), requireAuthoritative: args2.includes("--require-authoritative") } };
  return { mode, args: { missionId, policy: mode === "preflight" ? "local-preflight" : readFlagValue(args2, "--policy"), artifactPaths: readFlagValues(args2, "--artifact"), finalPlanPaths: readFlagValues(args2, "--final-plan"), finalResultPaths: readFlagValues(args2, "--final-result") } };
}
function hostIds(args2) {
  const raw = [...readFlagValues(args2, "--host"), ...readFlagValues(args2, "--platform")];
  if (raw.length === 0) return DEFAULT_HOST_ADAPTERS;
  const requested = raw.flatMap((value2) => value2.split(",").map((item) => item.trim()).filter(Boolean));
  if (requested.includes("all")) return HOST_IDS;
  const invalid = requested.filter((host) => !HOST_IDS.includes(host));
  if (invalid.length) throw new Error(`Unknown host adapter(s): ${invalid.join(", ")}.`);
  return [...new Set(requested)];
}
function copyPath(source, destination, force, destinationRoot) {
  const stat = fs19.lstatSync(source);
  if (stat.isSymbolicLink()) return;
  const relative = path19.relative(destinationRoot, destination).split(path19.sep).join("/");
  const resolved = resolveCanonicalContainedWrite(destinationRoot, relative, { label: "Install destination" });
  if (stat.isDirectory()) {
    fs19.mkdirSync(resolved.fullPath, { recursive: true });
    for (const entry of fs19.readdirSync(source)) copyPath(path19.join(source, entry), path19.join(destination, entry), force, destinationRoot);
    return;
  }
  if (!stat.isFile()) return;
  fs19.mkdirSync(path19.dirname(resolved.fullPath), { recursive: true });
  if (!fs19.existsSync(resolved.fullPath) || force) fs19.copyFileSync(source, resolved.fullPath);
}
function installOrSync(target2, args2) {
  const hosts = hostIds(args2);
  const projectHosts = hosts.filter((host) => Object.hasOwn(HOST_ADAPTERS, host));
  const corePaths = [...CORE_INSTALL_PATHS];
  const hostPaths = projectHosts.flatMap((host) => HOST_ADAPTERS[host].paths.map((relativePath) => ({ host, relativePath })));
  for (const relativePath of corePaths) {
    const source = path19.join(PACKAGE_ROOT2, relativePath);
    if (fs19.existsSync(source)) copyPath(source, path19.join(target2, relativePath), args2.includes("--force"), target2);
  }
  for (const { relativePath } of hostPaths) {
    const source = path19.join(PACKAGE_ROOT2, relativePath);
    if (fs19.existsSync(source)) copyPath(source, path19.join(target2, relativePath), args2.includes("--force"), target2);
  }
  const copiedUserHostPaths = [];
  let claudeCodeGateway = null;
  if (hosts.some((host) => USER_HOST_IDS.includes(host))) {
    const claudeConfigRoot = resolveClaudeConfigRoot();
    for (const relativePath of writeClaudeUserCommandAdapters(claudeConfigRoot)) copiedUserHostPaths.push({ host: "claude", path: relativePath, root: claudeConfigRoot });
    claudeCodeGateway = configureClaudeCodeGatewayDefaults({ claudeConfigRoot, shellStartupFile: resolveClaudeShellStartupFile() });
  }
  return { target: target2, hosts, force: args2.includes("--force"), copiedCorePaths: corePaths, copiedHostPaths: hostPaths.map(({ host, relativePath }) => ({ host, path: relativePath })), copiedUserHostPaths, claudeCodeGateway };
}
function claudeCommandPaths() {
  return COMMAND_SURFACES.map((surface2) => path19.join(resolveClaudeConfigRoot(), "commands", "dove", `${surface2.id.replace(/^dove\./u, "").replace(/\./gu, "-")}.md`));
}
function detectHosts(target2, { includeClaude = false } = {}) {
  const result = Object.entries(HOST_ADAPTERS).filter(([, adapter]) => adapter.paths.some((relativePath) => fs19.existsSync(path19.join(target2, relativePath)))).map(([host]) => host);
  if (includeClaude && claudeCommandPaths().some((absolutePath) => fs19.existsSync(absolutePath))) result.push("claude");
  return result;
}
function doctor(target2) {
  const gateway = inspectClaudeCodeGatewayDefaults({ claudeConfigRoot: resolveClaudeConfigRoot(), shellStartupFile: resolveClaudeShellStartupFile() });
  const inspectGateway = Boolean(process2.env.DOVE_CLAUDE_CONFIG_DIR || process2.env.DOVE_CLAUDE_SHELL_RC || gateway.shell?.hasManagedBlock);
  const installedHosts = detectHosts(target2, { includeClaude: inspectGateway });
  const missing = installedHosts.filter((host) => host !== "claude").flatMap((host) => (HOST_ADAPTERS[host]?.requiredPaths ?? []).filter((relativePath) => !fs19.existsSync(path19.join(target2, relativePath))));
  if (installedHosts.some((host) => host !== "claude") && !fs19.existsSync(path19.join(target2, "mcp/dove-state-server-package.mjs"))) missing.push("mcp/dove-state-server-package.mjs");
  const checks = installedHosts.map((host) => ({ check: `host-adapter:${host}`, ok: host === "claude" ? claudeCommandPaths().every((absolutePath) => fs19.existsSync(absolutePath)) : (HOST_ADAPTERS[host]?.requiredPaths ?? []).every((relativePath) => fs19.existsSync(path19.join(target2, relativePath))), requiredPaths: host === "claude" ? claudeCommandPaths().map((absolutePath) => path19.relative(resolveClaudeConfigRoot(), absolutePath).split(path19.sep).join("/")) : HOST_ADAPTERS[host]?.requiredPaths ?? [] }));
  if (inspectGateway) checks.push({ check: "claude-code-gateway", ok: gateway.ok, message: gateway.ok ? "Claude Code gateway defaults are configured" : gateway.issues.join(" | ") });
  const workspace = inspectDoveWorkspace(target2);
  const workspaceOk = workspace.state === "absent" ? installedHosts.length > 0 && missing.length === 0 : workspace.healthy;
  checks.push({ check: "workspace-schema", ok: workspaceOk, message: workspace.state === "absent" ? "Dove runtime is installed and .dove is absent; initialize explicitly when needed." : workspace.healthy ? `Current Dove schema ${workspace.schemaVersion} is healthy.` : `${workspace.state}${workspace.error ? `: ${workspace.error}` : ""}; run dove init --archive-reset and confirm the exact proposal.` });
  const result = { target: target2, node: process2.version, healthy: missing.length === 0 && checks.every((check) => check.ok), workspaceMode: workspace.state === "absent" ? "runtime-only" : workspace.healthy ? "current-schema" : "archive-reset-required", workspaceSchema: { state: workspace.state, category: workspace.category, healthy: workspace.healthy, schemaVersion: workspace.schemaVersion, detectedSchema: workspace.detectedSchema, error: workspace.error ?? null, zeroWrite: true }, missing: [...new Set(missing)], checks, warnings: [], hostAdapters: installedHosts, claudeCodeGateway: inspectGateway ? gateway : null, writes: [] };
  console.log(JSON.stringify(result, null, 2));
  return result.healthy ? 0 : 1;
}
function statusArgs(args2) {
  return { detail: args2.includes("--full") || args2.includes("--missions") ? "full" : readFlagValue(args2, "--detail"), full: args2.includes("--full"), showMissions: args2.includes("--missions") };
}
function wantsJson(args2) {
  return args2.includes("--json") || readFlagValue(args2, "--format") === "json";
}
function printResult(result, args2) {
  if (wantsJson(args2)) console.log(JSON.stringify(result, null, 2));
  else console.log(result.summary ?? result.headline ?? result.status ?? "Dove operation completed.");
}
var parsed;
try {
  parsed = parseDoveCli(process2.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process2.exit(1);
}
var command2 = parsed.command;
if (!command2 || ["help", "--help", "-h"].includes(command2)) {
  usage();
  process2.exit(0);
}
if (!Object.hasOwn({ install: true, sync: true, doctor: true }, command2) && !LOCAL_COMMANDS.has(command2)) {
  usage();
  process2.exit(1);
}
var [rawTarget, ...extraPositionals] = parsed.positionals;
var sourceAction = "register";
if (command2 === "source" && ["register", "verify"].includes(rawTarget)) {
  sourceAction = rawTarget;
  [rawTarget, ...extraPositionals] = extraPositionals;
}
var lessonsAction = "query";
if (command2 === "lessons" && ["query", "record"].includes(rawTarget)) {
  lessonsAction = rawTarget;
  [rawTarget, ...extraPositionals] = extraPositionals;
}
var invalidLessonsPositionals = command2 === "lessons" && extraPositionals.length > 0;
var rawArgs = [...extraPositionals, ...parsed.args];
var selected = targetAndArgs(rawTarget, rawArgs);
var target = selected.target;
var args = selected.args;
try {
  if (invalidLessonsPositionals) throw new Error("dove lessons accepts only query or record followed by one target.");
  if (command2 === "install" || command2 === "sync") {
    if (readFlagValue(args, "--mutation-mode") === "patch-plan") throw new Error(`${command2} requires direct-process file copying.`);
    console.log(JSON.stringify(installOrSync(target, args), null, 2));
    process2.exit(0);
  }
  if (command2 === "doctor") process2.exit(doctor(target));
  if (command2 === "status") {
    const result2 = queryDoveStatus(target, statusArgs(args));
    printResult(result2, args);
    process2.exit(0);
  }
  if (command2 === "init") {
    const input = initArgs(args);
    const result2 = input.confirmed ? runMutation(target, "init-dove-goal", args, () => initDoveGoal(target, input), "direct-process") : initDoveGoal(target, input);
    printResult(withProposalCommand("init", result2, target), args);
    process2.exit(0);
  }
  if (command2 === "mission") {
    const input = missionArgs(args);
    const result2 = input.confirmed ? runMutation(target, "create-dove-mission", args, () => createDoveMission(target, input), "direct-process") : createDoveMission(target, input);
    printResult(withProposalCommand("mission", result2, target), args);
    process2.exit(0);
  }
  if (command2 === "lessons") {
    if (lessonsAction === "query") {
      printResult(queryDoveLessons(target, lessonQueryArgs(args)), args);
      process2.exit(0);
    }
    const input = lessonRecordArgs(args);
    const result2 = input.confirmed ? runMutation(target, "record-dove-lesson", args, () => recordDoveLesson(target, input), "direct-process") : recordDoveLesson(target, input);
    printResult(withProposalCommand("lessons record", result2, target), args);
    process2.exit(0);
  }
  let result;
  if (command2 === "receipt") result = runMutation(target, "ingest-execution-receipt", args, (clean) => ingestExecutionReceipt(target, receiptArgs(clean, target)));
  if (command2 === "source") result = runMutation(target, sourceAction === "verify" ? "verify-source" : "register-source", args, (clean) => sourceAction === "verify" ? verifySource(target, sourceArgs(clean, sourceAction)) : registerSource(target, sourceArgs(clean, sourceAction)));
  if (command2 === "note") result = runMutation(target, "upsert-note", args, (clean) => upsertNote(target, { missionId: readFlagValue(clean, "--mission-id"), noteId: readFlagValue(clean, "--note-id"), title: readFlagValue(clean, "--title"), summary: readFlagValue(clean, "--summary"), quotes: readFlagValues(clean, "--quote"), claims: readFlagValues(clean, "--claim"), openQuestions: readFlagValues(clean, "--open-question"), sourceIds: readFlagValues(clean, "--source-id"), artifactRefs: readFlagValues(clean, "--artifact") }));
  if (command2 === "draft") {
    const metadataOnly = args.includes("--metadata-only");
    result = runMutation(target, metadataOnly ? "upsert-draft-metadata" : "upsert-draft", args, (clean) => (metadataOnly ? upsertDraftMetadata : upsertDraft)(target, { missionId: readFlagValue(clean, "--mission-id"), draftId: readFlagValue(clean, "--draft-id"), title: readFlagValue(clean, "--title"), body: readFlagValue(clean, "--body"), summary: readFlagValue(clean, "--summary"), evidenceRefs: readFlagValues(clean, "--evidence"), artifactRefs: readFlagValues(clean, "--artifact") }));
  }
  if (command2 === "experience") result = runMutation(target, "run-experience-workflow", args, (clean) => runExperienceWorkflow(target, { missionId: readFlagValue(clean, "--mission-id"), experimentId: readFlagValue(clean, "--experiment-id"), title: readFlagValue(clean, "--title"), goal: readFlagValue(clean, "--goal"), hypothesis: readFlagValue(clean, "--hypothesis"), protocol: readFlagValue(clean, "--protocol"), successCriteria: readFlagValues(clean, "--success-criterion"), comparisonTargets: readFlagValues(clean, "--comparison-target"), result: readFlagValue(clean, "--result"), resultEvidenceRefs: readFlagValues(clean, "--result-evidence"), auditFindings: readFlagValues(clean, "--audit-finding"), integrityFlags: readFlagValues(clean, "--integrity-flag"), claimId: readFlagValue(clean, "--claim-id"), bridgeReason: readFlagValue(clean, "--bridge-reason") }));
  if (command2 === "figure") result = runMutation(target, "run-figure-workflow", args, (clean) => runFigureWorkflow(target, { missionId: readFlagValue(clean, "--mission-id"), figureId: readFlagValue(clean, "--figure-id"), intent: readFlagValue(clean, "--intent"), purpose: readFlagValue(clean, "--purpose"), materials: readFlagValues(clean, "--material"), prompt: readFlagValue(clean, "--prompt"), outputPath: readFlagValue(clean, "--output-path"), outputSha256: readFlagValue(clean, "--output-sha256"), caption: readFlagValue(clean, "--caption"), qaFindings: readFlagValues(clean, "--qa-finding") }));
  if (command2 === "review") {
    const request = reviewArgs(args);
    if (request.mode === "preflight") result = prepareReviewExchange(target, request.args);
    else if (request.mode === "verify-coverage") result = verifyReviewCoverage(target, request.args);
    else result = runMutation(target, request.mode === "prepare" ? "prepare-review-exchange" : "import-review-exchange", args, () => request.mode === "prepare" ? prepareReviewExchange(target, request.args) : importReviewExchange(target, request.args));
  }
  if (command2 === "rebuttal") {
    const input = { missionId: readFlagValue(args, "--mission-id"), issues: parseRepeatedJson(args, "--issue-json"), strategy: readFlagValue(args, "--strategy"), responses: parseRepeatedJson(args, "--response-json") };
    if (args.includes("--issues-only")) result = runMutation(target, "normalize-rebuttal-issues", args, () => normalizeRebuttalIssues(target, { missionId: input.missionId, issues: input.issues }));
    else if (args.includes("--strategy-only")) result = runMutation(target, "build-rebuttal-strategy", args, () => buildRebuttalStrategy(target, { missionId: input.missionId, strategy: input.strategy }));
    else result = runMutation(target, "build-rebuttal", args, () => buildRebuttal(target, input));
  }
  if (command2 === "version") {
    const input = { missionId: readFlagValue(args, "--mission-id"), versionId: readFlagValue(args, "--version-id"), label: readFlagValue(args, "--label"), artifactRefs: readFlagValues(args, "--artifact"), supersedesVersionId: readFlagValue(args, "--supersedes-version-id"), fromVersionId: readFlagValue(args, "--from-version-id"), toVersionId: readFlagValue(args, "--to-version-id"), finalize: args.includes("--finalize") };
    const comparing = Boolean(input.fromVersionId || input.toVersionId);
    result = runMutation(target, comparing ? "compare-versions" : "create-version-snapshot", args, () => comparing ? compareVersions(target, input) : createVersionSnapshot(target, input));
  }
  printResult(result, args);
  process2.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (wantsJson(args)) console.log(JSON.stringify({ status: "blocked", message }, null, 2));
  else console.error(message);
  process2.exit(1);
}
