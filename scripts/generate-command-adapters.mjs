import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeFileSetTransaction } from "../src/core/file-set-transaction.mjs";
import {
  DOVE_CLAUDE_AMBIENT_RULE_PATH,
  DOVE_CLAUDE_AMBIENT_SKILL_PATH,
  renderClaudeAmbientRule,
  renderClaudeAmbientSkill
} from "../src/core/ambient-policy.mjs";
import { generatedDoveAgentEntries } from "../src/core/dove-agent-definition.mjs";
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
  hostCommandSlug,
  packageResourcePath
} from "../src/core/command-manifest.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");

function markdownTitle(command) {
  return command.title.replace(/\b\w/g, (char) => char.toUpperCase());
}

function yamlString(value) {
  return JSON.stringify(String(value).replace(/\n/g, " "));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function exampleBullets(command, hostId = null) {
  if (hostId === "dsh") return [];
  const examples = command.examples;
  if (!Array.isArray(examples)) return [];
  return examples.map((example) => String(example).trim()).filter(Boolean);
}


function renderBullets(bullets) {
  return bullets.map((bullet) => `- ${bullet}`).join("\n");
}

function renderAction(item) {
  return `- ${item.instruction}`;
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
  return renderListSection("Using host tools", values);
}

function renderSemanticItems(title, items, renderer = renderBullets) {
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  return values.length > 0 ? `#### ${title}\n\n${renderer(values)}` : "";
}

function renderSemanticSection(section) {
  const items = [
    ...(Array.isArray(section.responsibilities) ? section.responsibilities : []),
    ...(Array.isArray(section.actions) ? section.actions.map((item) => item.instruction) : []),
    ...(Array.isArray(section.boundaries) ? section.boundaries : []),
    ...(Array.isArray(section.nonGoals) ? section.nonGoals : [])
  ].filter(Boolean);
  const blocks = [
    `### ${section.title}`,
    section.purpose ? String(section.purpose) : "",
    section.description ? String(section.description) : "",
    items.length > 0 ? renderBullets(items) : ""
  ].filter(Boolean);
  return blocks.join("\n\n");
}

function renderSemanticCapabilityContract(command, hostId = null) {
  const contract = command.contract;
  const sections = [
    "## How Dove approaches this work\n\nThese are flexible research considerations, not a required order or report template.",
    `### What this is for\n\n${contract.purpose}`,
    `### When it helps\n\n${contract.when}`,
    renderListSection("Scope and changes", contract.boundaries),
    ...contract.semanticSections.map(renderSemanticSection),
    renderListSection("When Dove needs input", contract.clarification),
    renderHostGuidance(contract, hostId)
  ].filter(Boolean);
  return sections.join("\n\n");
}

function renderCapabilityContract(command, hostId = null) {
  const contract = command.contract;
  if (!contract) return "";
  if (Array.isArray(contract.semanticSections) && contract.semanticSections.length > 0) {
    return renderSemanticCapabilityContract(command, hostId);
  }
  const sections = [
    "## How Dove approaches this work\n\nThese are flexible research considerations, not a required order or report template.",
    `### What this is for\n\n${contract.purpose}`,
    `### When it helps\n\n${contract.when}`,
    renderListSection("What Dove will examine", contract.responsibilities),
    renderListSection("Scope and changes", contract.boundaries),
    Array.isArray(contract.actions) && contract.actions.length > 0 ? `### Ways Dove may proceed\n\n${contract.actions.map(renderAction).join("\n")}` : "",
    renderListSection("What this should not replace", contract.nonGoals),
    renderListSection("When Dove needs input", contract.clarification),
    renderHostGuidance(contract, hostId)
  ].filter(Boolean);
  return sections.join("\n\n");
}

function renderGuidance(command) {
  const notes = Array.isArray(command.guidance) ? command.guidance.filter(Boolean) : [];
  return notes.length > 0 ? `## Command guidance\n\n${renderBullets(notes)}` : "";
}

function renderExamples(command, hostId = null) {
  const examples = exampleBullets(command, hostId);
  return examples.length > 0 ? `\n\n## Examples\n\n${examples.map((example) => `- \`${example}\``).join("\n")}` : "";
}

function renderBody(command, heading, hostId = null) {
  const purpose = command.summary;
  const examples = renderExamples(command, hostId);
  const contract = renderCapabilityContract(command, hostId);
  const guidance = renderGuidance(command);
  return `# ${heading}\n\n${purpose}${examples}\n\n${contract}${guidance ? `\n\n${guidance}` : ""}\n`;
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
  return `${renderFrontmatter(command)}\n${renderBody(command, heading, hostId)}`;
}

function renderSkill(command, hostId = null) {
  const name = `dove-${hostCommandSlug(command.id)}`;
  return `${renderFrontmatter(command, { name })}\n${renderBody(command, markdownTitle(command), hostId)}`;
}

export function renderCommandAdapter(hostId, command) {
  switch (hostId) {
    case "claude": return renderMarkdownCommand(command, command.id, hostId);
    case "dsh": return renderSkill(command, hostId);
    default: throw new Error(`Unknown host adapter: ${hostId}`);
  }
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

export function generatedClaudeAmbientProjectEntries() {
  return [
    { destinationPath: DOVE_CLAUDE_AMBIENT_RULE_PATH, relativePath: packageResourcePath("claude", DOVE_CLAUDE_AMBIENT_RULE_PATH), content: renderClaudeAmbientRule() },
    { destinationPath: DOVE_CLAUDE_AMBIENT_SKILL_PATH, relativePath: packageResourcePath("claude", DOVE_CLAUDE_AMBIENT_SKILL_PATH), content: renderClaudeAmbientSkill() },
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
    packageResourcePath("claude", ".claude/agents/dove.md"),
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
  ], { fsOps: options.fsOps });
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

function existingGeneratedAdapterPaths(root) {
  return unique([
    ...listFiles(root, "package-resources/hosts/claude/.claude/commands/dove", (relativePath) => /\/dove\/.*\.md$/.test(relativePath)),
    ...listFiles(root, "package-resources/hosts/dsh/.dsh/skills", (relativePath) => /\/dove-[^/]+\/SKILL\.md$/.test(relativePath)),
    ...listFiles(root, "package-resources/hosts/claude/.claude/rules", (relativePath) => relativePath.endsWith("/.claude/rules/dove.md")),
    ...listFiles(root, "package-resources/hosts/claude/.claude/skills/dove-intake", (relativePath) => relativePath.endsWith("/dove-intake/SKILL.md")),
    ...listFiles(root, "package-resources/hosts/claude/.claude/skills/dove-paper-search", (relativePath) => relativePath.endsWith("/dove-paper-search/SKILL.md")),
    ...listFiles(root, "package-resources/hosts/claude/.claude/skills/dove-web-reader", (relativePath) => relativePath.endsWith("/dove-web-reader/SKILL.md"))
  ]).sort();
}

export function writeGeneratedAdapters(root = PACKAGE_ROOT, options = {}) {
  const entries = [
    ...generatedAdapterEntries().map((entry) => ({ ...entry, label: "Generated command adapter path" })),
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
  ], { fsOps: options.fsOps });
}

export function checkGeneratedAdapters(root = PACKAGE_ROOT) {
  const entries = [...generatedAdapterEntries(), ...generatedClaudeAmbientProjectEntries()];
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
