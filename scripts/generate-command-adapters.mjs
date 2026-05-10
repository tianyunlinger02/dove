import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  COMMAND_SURFACES,
  HOST_IDS,
  adapterPathForCommand,
  commandContextPaths,
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

function formatContextPaths(command) {
  const paths = commandContextPaths(command).map((contextPath) => `\`${contextPath}\``).join(", ");
  return `Read the narrow durable context first when present: ${paths}.`;
}

function formatTools(command) {
  if (!command.requiredTools?.length) {
    return "No required MCP tool; follow the command contract and route to the owning Dove surface when mutation is needed.";
  }
  const tools = command.requiredTools.map((tool) => `\`${tool}\``).join(", ");
  return command.requiredTools.length === 1 ? `Prefer the ${tools} MCP tool when available.` : `Use the ${tools} MCP tools when available.`;
}

function policyLine(command) {
  switch (command.policy) {
    case "proposal-only":
      return "Keep this surface proposal-only: inspect and route, but do not mutate durable state.";
    case "query":
      return "Keep this surface read-only unless the named MCP tool explicitly performs a governed refresh.";
    case "guarded-mutation":
      return "Only perform the governed mutation owned by this surface, scoped to the operator request.";
    case "explicit-approval":
      return "Require explicit operator approval and bounded authority before creating, changing, or consuming program authority.";
    case "governed-bookkeeping":
      return "Record only explicit operator bookkeeping for the governed Dove workflow.";
    case "guidance":
      return "Provide workflow guidance only; route to another Dove surface for durable changes.";
    case "isolated-handoff":
      return "Use explicit handoff artifacts for reviewer isolation; do not share hidden session context.";
    default:
      return "Stay within the command contract and preserve Dove durable-state boundaries.";
  }
}

function workflowBullets(command) {
  const bullets = [
    "Treat `.dove/` as the authoritative durable root and keep repository-local development scaffolding out of the Dove product surface.",
    formatContextPaths(command),
    formatTools(command),
    policyLine(command),
    ...(command.constraints ?? []),
    "Preserve the primary role boundary: planner sets scope, builder performs work, and reviewer independently audits returned evidence."
  ];
  if (command.domain === "paper") {
    bullets.push("Use paper-domain artifacts for research, claims, citations, drafting, review, rebuttal, experiments, figures, and version lineage.");
  } else {
    bullets.push("Use this shared Dove control-plane surface across paper, engineering, experiment, review, and general missions; route to `dove.paper.*` only for paper-specific artifact workflows.");
  }
  bullets.push("Return the next action, evidence expectations, and any unresolved blockers without claiming work that was not performed.");
  return bullets;
}

function renderBody(command, heading) {
  const bullets = workflowBullets(command)
    .map((bullet, index) => `${index + 1}. ${bullet}`)
    .join("\n");
  return `# ${heading}\n\n${command.summary}\n\n## Contract\n\n- Command id: \`${command.id}\`\n- Domain: \`${command.domain}\`\n- Category: \`${command.category}\`\n- Policy: \`${command.policy}\`\n\n## Workflow\n\n${bullets}\n`;
}

function renderSkill(command) {
  const name = `dove-${hostCommandSlug(command.id)}`;
  return `---\nname: ${name}\ndescription: ${yamlString(command.summary)}\n---\n\n${renderBody(command, markdownTitle(command))}`;
}

export function renderCommandAdapter(hostId, command) {
  switch (hostId) {
    case "opencode":
    case "claude": return renderBody(command, command.id);
    case "cursor": return renderBody(command, `dove-${hostCommandSlug(command.id)}`);
    case "codex":
    case "agents": return renderSkill(command);
    default: throw new Error(`Unknown host adapter: ${hostId}`);
  }
}

export function generatedAdapterEntries() {
  return HOST_IDS.flatMap((hostId) => COMMAND_SURFACES.map((command) => ({
    hostId,
    command,
    relativePath: adapterPathForCommand(hostId, command),
    content: renderCommandAdapter(hostId, command)
  })));
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
    ...listFiles(root, ".agents/skills", (relativePath) => /^\.agents\/skills\/dove-[^/]+\/SKILL\.md$/.test(relativePath))
  ]).sort();
}

export function writeGeneratedAdapters(root = PACKAGE_ROOT) {
  const written = [];
  for (const entry of generatedAdapterEntries()) {
    const absolutePath = path.join(root, entry.relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `${entry.content.trimEnd()}\n`, "utf8");
    written.push(entry.relativePath);
  }
  return written;
}

export function checkGeneratedAdapters(root = PACKAGE_ROOT) {
  const entries = generatedAdapterEntries();
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

function main() {
  if (process.argv.includes("--check")) {
    const drift = checkGeneratedAdapters();
    if (drift.length > 0) {
      for (const item of drift) {
        console.error(`${item.relativePath}: ${item.reason}`);
      }
      process.exitCode = 1;
      return;
    }
    console.log("Generated command adapters are up to date.");
    return;
  }
  const written = writeGeneratedAdapters();
  console.log(JSON.stringify({ written }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
