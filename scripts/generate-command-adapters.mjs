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
import { generatedRoleDefinitionEntries } from "../src/core/role-definitions.mjs";
import {
  PAPER_SEARCH_SUPPORT_SKILL_PATH,
  renderPaperSearchSupportSkill
} from "../src/core/paper-search-integration.mjs";
import {
  COMMAND_SURFACES,
  HOST_ADAPTER_POLICY,
  PROJECT_HOST_IDS,
  adapterPathForCommand,
  hostCommandSlug
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
  const examples = command.examples;
  if (!Array.isArray(examples)) {
    return [];
  }
  return examples.map((example) => {
    const text = String(example).trim();
    return hostId === "opencode" ? text.replace(/^\/dove:/u, "/dove.") : text;
  }).filter(Boolean);
}


function renderBullets(bullets) {
  return bullets.map((bullet) => `- ${bullet}`).join("\n");
}

function renderWorkflow(command) {
  const modes = command.workflow?.modes;
  if (!Array.isArray(modes) || modes.length === 0) return "";
  const lines = [
    "## Internal workflow",
    "",
    "Internal guidance only; never use this workflow as the final report outline.",
    ""
  ];
  for (const item of modes) {
    lines.push(`- **${item.when}**`);
    for (const [index, step] of item.steps.entries()) {
      const writeBoundary = step.readOnly
        ? " This step is read-only; do not create or modify files."
        : step.persistWhen && step.persistWhen !== "never"
          ? ` Maintain Dove research Markdown only when ${step.persistWhen}.`
          : "";
      lines.push(`  ${index + 1}. Use host tools (${step.readOnly ? "read-only" : "work"}; ${step.capability}). ${step.instruction}${writeBoundary}`);
    }
    for (const clarification of item.clarification ?? []) {
      lines.push(`  - Clarification: ${clarification}`);
    }
  }
  return lines.join("\n");
}

function renderGuidance(command) {
  const notes = Array.isArray(command.guidance) ? command.guidance.filter(Boolean) : [];
  return notes.length > 0 ? `## Command guidance\n\n${renderBullets(notes)}` : "";
}

function renderCapsule() {
  return `## Dove capsule\n\n${renderBullets(HOST_ADAPTER_POLICY.adapterBullets)}`;
}

function renderExamples(command, hostId = null) {
  const examples = exampleBullets(command, hostId);
  return examples.length > 0 ? `\n\n## Examples\n\n${examples.map((example) => `- \`${example}\``).join("\n")}` : "";
}

function renderBody(command, heading, hostId = null) {
  const purpose = command.summary;
  const examples = renderExamples(command, hostId);
  const workflow = renderWorkflow(command);
  const guidance = renderGuidance(command);
  const capsule = renderCapsule();
  return `# ${heading}\n\n${purpose}${examples}\n\n${workflow}${guidance ? `\n\n${guidance}` : ""}\n\n${capsule}\n`;
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
    case "opencode":
    case "claude": return renderMarkdownCommand(command, command.id, hostId);
    case "cursor": return renderMarkdownCommand(command, `dove-${hostCommandSlug(command.id)}`, hostId);
    case "codex":
    case "agents": return renderSkill(command, hostId);
    default: throw new Error(`Unknown host adapter: ${hostId}`);
  }
}

export function generatedAdapterEntries() {
  return PROJECT_HOST_IDS.flatMap((hostId) => COMMAND_SURFACES.map((command) => ({
    hostId,
    command,
    relativePath: adapterPathForCommand(hostId, command),
    content: renderCommandAdapter(hostId, command)
  })));
}

export function generatedClaudeAmbientProjectEntries() {
  return [
    { relativePath: DOVE_CLAUDE_AMBIENT_RULE_PATH, content: renderClaudeAmbientRule() },
    { relativePath: DOVE_CLAUDE_AMBIENT_SKILL_PATH, content: renderClaudeAmbientSkill() },
    { relativePath: PAPER_SEARCH_SUPPORT_SKILL_PATH, content: renderPaperSearchSupportSkill() }
  ];
}

export function generatedPrimaryRoleEntries() {
  return generatedRoleDefinitionEntries();
}

export function writeGeneratedPrimaryRoles(root = PACKAGE_ROOT, options = {}) {
  return writeFileSetTransaction(generatedPrimaryRoleEntries().map((entry) => ({
    root,
    relativePath: entry.relativePath,
    content: `${entry.content.trimEnd()}\n`,
    encoding: "utf8",
    force: true,
    label: "Generated Dove primary role path"
  })), { fsOps: options.fsOps });
}

export function checkGeneratedPrimaryRoles(root = PACKAGE_ROOT) {
  return generatedPrimaryRoleEntries().flatMap((entry) => {
    const absolutePath = path.join(root, entry.relativePath);
    if (!fs.existsSync(absolutePath)) return [{ relativePath: entry.relativePath, reason: "missing" }];
    return fs.readFileSync(absolutePath, "utf8") === `${entry.content.trimEnd()}\n`
      ? []
      : [{ relativePath: entry.relativePath, reason: "content differs" }];
  });
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
    ...listFiles(root, ".opencode/commands", (relativePath) => /^\.opencode\/commands\/dove.*\.md$/.test(relativePath)),
    ...listFiles(root, ".claude/commands/dove", (relativePath) => /^\.claude\/commands\/dove\/.*\.md$/.test(relativePath)),
    ...listFiles(root, ".cursor/commands", (relativePath) => /^\.cursor\/commands\/dove-.*\.md$/.test(relativePath)),
    ...listFiles(root, ".codex/skills", (relativePath) => /^\.codex\/skills\/dove-[^/]+\/SKILL\.md$/.test(relativePath)),
    ...listFiles(root, ".agents/skills", (relativePath) => /^\.agents\/skills\/dove-[^/]+\/SKILL\.md$/.test(relativePath)),
    ...listFiles(root, ".claude/rules", (relativePath) => relativePath === ".claude/rules/dove.md"),
    ...listFiles(root, ".claude/skills/dove-intake", (relativePath) => relativePath === ".claude/skills/dove-intake/SKILL.md"),
    ...listFiles(root, ".claude/skills/dove-paper-search", (relativePath) => relativePath === PAPER_SEARCH_SUPPORT_SKILL_PATH)
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
