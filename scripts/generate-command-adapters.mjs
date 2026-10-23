import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeFileSetTransaction } from "../src/core/file-set-transaction.mjs";
import {
  DOVE_CLAUDE_AMBIENT_RULE_PATH,
  renderClaudeAmbientRule
} from "../src/core/ambient-policy.mjs";
import { DOVE_AGENT_SURFACES, generatedDoveAgentEntries } from "../src/core/dove-agent-definition.mjs";
import {
  DOVE_RESEARCH_QUALITY_REFERENCE_PATH,
  renderDoveResearchQualityReference
} from "../src/core/dove-research-contract.mjs";
import {
  DOVE_AUTHOR_PREFERENCES_REFERENCE_PATH,
  DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATH,
  renderDoveAuthorPreferencesReference,
  renderDoveAuthorPreferencesFullReference
} from "../src/core/dove-author-preferences.mjs";
import { DOVE_TOPIC_CRITERIA_REFERENCE_PATH, renderDoveTopicCriteriaReference } from "../src/core/dove-topic-criteria.mjs";
import {
  PAPER_SEARCH_SUPPORT_SKILL_PATH,
  renderPaperSearchSupportSkill
} from "../src/core/paper-search-integration.mjs";
import {
  EXA_WEB_SUPPORT_SKILL_PATH,
  renderExaWebSupportSkill
} from "../src/core/web-access-integration.mjs";
import {
  COMMAND_SURFACES,
  PROJECT_HOST_IDS,
  adapterPathForCommand,
  packageResourcePath
} from "../src/core/command-manifest.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");

function yamlString(value) {
  return JSON.stringify(String(value).replace(/\n/g, " "));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function exampleBullets(command) {
  const examples = command.examples;
  if (!Array.isArray(examples)) return [];
  return examples.map((example) => String(example).trim()).filter(Boolean);
}


function renderBullets(bullets) {
  return bullets.map((bullet) => `- ${bullet}`).join("\n");
}

function renderListSection(title, items) {
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  return values.length > 0 ? `### ${title}\n\n${renderBullets(values)}` : "";
}

function renderHostGuidance(contract, hostId) {
  const hostGuidance = contract.hostGuidance ?? {};
  const values = unique([
    ...(hostGuidance.common ?? []),
    ...(hostId ? hostGuidance[hostId] ?? [] : [])
  ]);
  return renderListSection("使用宿主工具", values);
}

function renderReturnWith(contract) {
  return renderListSection("交付内容", contract.returnWith);
}

function renderCapabilityContract(command, hostId = null) {
  const contract = command.contract;
  if (!contract) return "";
  const sections = [
    "## 怎么做\n\n按当前问题使用这些做法，不机械套步骤或报告模板；明确需要用户决定的地方仍先交给用户。",
    `### 用途\n\n${contract.purpose}`,
    `### 适用情况\n\n${contract.when}`,
    renderListSection("要判断什么", contract.responsibilities),
    renderListSection("工作范围", contract.boundaries),
    Array.isArray(contract.actions) && contract.actions.length > 0 ? `### 具体做法\n\n${renderBullets(contract.actions)}` : "",
    contract.modelPrompt ? `### 可调整的模型提示\n\n按本次科学内容和参考填入相关项，不把它当固定布局或画风。\n\n\`\`\`text\n${contract.modelPrompt}\n\`\`\`` : "",
    renderListSection("不替代什么", contract.nonGoals),
    renderListSection("什么时候找用户", contract.clarification),
    renderHostGuidance(contract, hostId),
    renderReturnWith(contract)
  ].filter(Boolean);
  return sections.join("\n\n");
}

function renderExamples(command) {
  const examples = exampleBullets(command);
  return examples.length > 0 ? `\n\n## 示例\n\n${examples.map((example) => `- \`${example}\``).join("\n")}` : "";
}

function renderArgumentBlock(hostId) {
  if (hostId !== "claude") return "";
  return "## 当前请求\n\n$ARGUMENTS";
}

// The project rule (operating manual) owns every shared instruction; a Skill
// carries only its own practice, so nothing is stated twice in one context.
function renderBody(command, heading, hostId = null) {
  const purpose = command.summary;
  const args = renderArgumentBlock(hostId);
  const examples = renderExamples(command);
  const contract = renderCapabilityContract(command, hostId);
  return [`# ${heading}`, purpose, args, examples.trim(), contract].filter(Boolean).join("\n\n") + "\n";
}

function renderFrontmatter(command, fields = {}) {
  const lines = ["---"];
  if (fields.name) {
    lines.push(`name: ${fields.name}`);
  }
  lines.push(`description: ${yamlString(command.summary)}`);
  if (fields.argumentHint) {
    lines.push(`argument-hint: ${yamlString(fields.argumentHint)}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

function renderMarkdownCommand(command, heading, hostId = null) {
  return `${renderFrontmatter(command, { argumentHint: "可选：请求、产物路径、投稿目标、约束或后续背景" })}\n${renderBody(command, heading, hostId)}`;
}

export function renderCommandAdapter(hostId, command) {
  if (hostId === "claude") return renderMarkdownCommand(command, command.id, hostId);
  throw new Error(`Unknown host adapter: ${hostId}`);
}

export function generatedAdapterEntries() {
  return PROJECT_HOST_IDS.flatMap((hostId) => COMMAND_SURFACES.map((command) => ({
    hostId,
    command,
    destinationPath: adapterPathForCommand(hostId, command),
    relativePath: packageResourcePath(hostId, adapterPathForCommand(hostId, command)),
    content: renderCommandAdapter(hostId, command)
  })));
}

function referenceEntries(pairs) {
  return pairs.map(([destinationPath, content]) => ({
    hostId: "claude",
    destinationPath,
    relativePath: packageResourcePath("claude", destinationPath),
    content
  }));
}

export function generatedResearchQualityReferenceEntries() {
  return referenceEntries([
    [DOVE_RESEARCH_QUALITY_REFERENCE_PATH, renderDoveResearchQualityReference()],
    [DOVE_TOPIC_CRITERIA_REFERENCE_PATH, renderDoveTopicCriteriaReference()]
  ]);
}

export function generatedAuthorPreferencesReferenceEntries() {
  return referenceEntries([
    [DOVE_AUTHOR_PREFERENCES_REFERENCE_PATH, renderDoveAuthorPreferencesReference()],
    [DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATH, renderDoveAuthorPreferencesFullReference()]
  ]);
}

export function generatedClaudeAmbientProjectEntries() {
  return [
    { destinationPath: DOVE_CLAUDE_AMBIENT_RULE_PATH, relativePath: packageResourcePath("claude", DOVE_CLAUDE_AMBIENT_RULE_PATH), content: renderClaudeAmbientRule() },
    { destinationPath: PAPER_SEARCH_SUPPORT_SKILL_PATH, relativePath: packageResourcePath("claude", PAPER_SEARCH_SUPPORT_SKILL_PATH), content: renderPaperSearchSupportSkill() },
    { destinationPath: EXA_WEB_SUPPORT_SKILL_PATH, relativePath: packageResourcePath("claude", EXA_WEB_SUPPORT_SKILL_PATH), content: renderExaWebSupportSkill() }
  ];
}

export function generatedDoveAgentSurfaceEntries() {
  return generatedDoveAgentEntries().map((entry) => ({
    ...entry,
    destinationPath: entry.relativePath,
    relativePath: packageResourcePath("claude", entry.relativePath)
  }));
}

function existingGeneratedDoveAgentPaths(root) {
  return [
    ...Object.values(DOVE_AGENT_SURFACES).map((relativePath) => packageResourcePath("claude", relativePath)),
    packageResourcePath("claude", ".claude/agents/dove-reviewer.md")
  ].filter((relativePath) => fs.existsSync(path.join(root, relativePath))).sort();
}

export function writeGeneratedDoveAgentSurfaces(root = PACKAGE_ROOT, options = {}) {
  const entries = generatedDoveAgentSurfaceEntries();
  const expectedPaths = new Set(entries.map((entry) => entry.relativePath));
  const staleEntries = existingGeneratedDoveAgentPaths(root)
    .filter((relativePath) => !expectedPaths.has(relativePath))
    .map((relativePath) => ({ root, relativePath, delete: true, force: true, label: "Stale generated Dove agent surface path" }));
  return writeFileSetTransaction([
    ...entries.map((entry) => ({
      root,
      relativePath: entry.relativePath,
      content: `${entry.content.trimEnd()}\n`,
      encoding: "utf8",
      force: true,
      label: "Generated Dove agent surface path"
    })),
    ...staleEntries
  ], { fsOps: options.fsOps, transactionBase: ".claude/tmp/dove-generated-transactions" });
}

export function checkGeneratedDoveAgentSurfaces(root = PACKAGE_ROOT) {
  const entries = generatedDoveAgentSurfaceEntries();
  const expectedPaths = new Set(entries.map((entry) => entry.relativePath));
  const drift = entries.flatMap((entry) => {
    const absolutePath = path.join(root, entry.relativePath);
    if (!fs.existsSync(absolutePath)) return [{ relativePath: entry.relativePath, reason: "missing" }];
    return fs.readFileSync(absolutePath, "utf8") === `${entry.content.trimEnd()}\n`
      ? []
      : [{ relativePath: entry.relativePath, reason: "content differs" }];
  });
  for (const relativePath of existingGeneratedDoveAgentPaths(root)) {
    if (!expectedPaths.has(relativePath)) drift.push({ relativePath, reason: "stale" });
  }
  return drift;
}

const MAX_GENERATED_CLEANUP_WARNINGS = 20;

export function generatedWriteSummary(...transactions) {
  const reportedCleanupWarnings = transactions.flatMap((transaction) => transaction?.cleanupWarnings ?? []);
  const cleanupWarnings = reportedCleanupWarnings.slice(0, MAX_GENERATED_CLEANUP_WARNINGS);
  const omittedCleanupWarningCount = transactions.reduce(
    (count, transaction) => count + (transaction?.omittedCleanupWarningCount ?? 0),
    reportedCleanupWarnings.length - cleanupWarnings.length
  );
  return {
    written: transactions.flatMap((transaction) => transaction?.writtenPaths ?? []),
    ...(cleanupWarnings.length > 0 || omittedCleanupWarningCount > 0
      ? { cleanupWarnings, omittedCleanupWarningCount }
      : {})
  };
}

function listFiles(root, relativeDir, acceptPath) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }
  const files = [];
  const stack = [relativeDir];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    for (const entry of fs.readdirSync(path.join(root, currentDir), { withFileTypes: true })) {
      const relativePath = path.join(currentDir, entry.name).split(path.sep).join("/");
      if (entry.isDirectory()) {
        stack.push(relativePath);
      } else if (acceptPath(relativePath)) {
        files.push(relativePath);
      }
    }
  }
  return files;
}

// Earlier releases also generated the full quality reference and a DSH host;
// their files are listed here so regeneration removes them as stale.
function existingGeneratedAdapterPaths(root) {
  return unique([
    ...listFiles(root, "package-resources/hosts/claude/.dove/install", (relativePath) => relativePath.endsWith(".md")),
    ...listFiles(root, "package-resources/hosts/dsh", () => true),
    ...listFiles(root, "package-resources/hosts/claude/.claude/commands/dove", (relativePath) => /\/dove\/.*\.md$/.test(relativePath)),
    ...listFiles(root, "package-resources/hosts/claude/.claude/rules", (relativePath) => relativePath.endsWith("/.claude/rules/dove.md")),
    ...listFiles(root, "package-resources/hosts/claude/.claude/skills/dove-intake", (relativePath) => relativePath.endsWith("/dove-intake/SKILL.md")),
    ...listFiles(root, "package-resources/hosts/claude/.claude/skills/dove-paper-search", (relativePath) => relativePath.endsWith("/dove-paper-search/SKILL.md")),
    ...listFiles(root, "package-resources/hosts/claude/.claude/skills/dove-web-reader", (relativePath) => relativePath.endsWith("/dove-web-reader/SKILL.md"))
  ]).sort();
}

export function writeGeneratedAdapters(root = PACKAGE_ROOT, options = {}) {
  const entries = [
    ...generatedAdapterEntries().map((entry) => ({ ...entry, label: "Generated command adapter path" })),
    ...generatedResearchQualityReferenceEntries().map((entry) => ({ ...entry, label: "Generated research quality reference path" })),
    ...generatedAuthorPreferencesReferenceEntries().map((entry) => ({ ...entry, label: "Generated author preferences reference path" })),
    ...generatedClaudeAmbientProjectEntries().map((entry) => ({ ...entry, label: "Generated Claude ambient project path" }))
  ];
  const expectedPaths = new Set(entries.map((entry) => entry.relativePath));
  const staleEntries = existingGeneratedAdapterPaths(root)
    .filter((relativePath) => !expectedPaths.has(relativePath))
    .map((relativePath) => ({ root, relativePath, delete: true, force: true, label: "Stale generated adapter path" }));
  return writeFileSetTransaction([
    ...entries.map((entry) => ({
      root,
      relativePath: entry.relativePath,
      content: `${entry.content.trimEnd()}\n`,
      encoding: "utf8",
      force: true,
      label: entry.label
    })),
    ...staleEntries
  ], { fsOps: options.fsOps, transactionBase: ".claude/tmp/dove-generated-transactions" });
}

export function checkGeneratedAdapters(root = PACKAGE_ROOT) {
  const entries = [...generatedAdapterEntries(), ...generatedClaudeAmbientProjectEntries(), ...generatedResearchQualityReferenceEntries(), ...generatedAuthorPreferencesReferenceEntries()];
  const expectedPaths = new Set(entries.map((entry) => entry.relativePath));
  const drift = [];
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.relativePath);
    const expected = `${entry.content.trimEnd()}\n`;
    if (!fs.existsSync(absolutePath)) {
      drift.push({ relativePath: entry.relativePath, reason: "missing" });
      continue;
    }
    const actual = fs.readFileSync(absolutePath, "utf8");
    if (actual !== expected) {
      drift.push({ relativePath: entry.relativePath, reason: "content differs" });
    }
  }
  for (const relativePath of existingGeneratedAdapterPaths(root)) {
    if (!expectedPaths.has(relativePath)) {
      drift.push({ relativePath, reason: "stale" });
    }
  }
  return drift;
}
