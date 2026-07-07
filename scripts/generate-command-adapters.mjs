import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  COMMAND_SURFACES,
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

function policyLine(command) {
  switch (command.policy) {
    case "proposal-only":
      return "Keep this surface proposal-only: inspect, suggest, and wait for an explicitly approved action before any change.";
    case "query":
      return "Keep this surface read-only unless the command explicitly asks for a governed refresh.";
    case "guarded-mutation":
      return "Only perform the governed change owned by this surface, scoped to the operator request.";
    case "explicit-approval":
      return "Require explicit operator approval before creating or changing saved workflow records or consuming bounded authority.";
    case "governed-bookkeeping":
      return "Record only explicit operator bookkeeping for the governed Dove workflow.";
    case "guidance":
      return "Provide workflow guidance only; route to another Dove surface for saved changes.";
    case "isolated-handoff":
      return "Use explicit handoff artifacts for reviewer isolation; do not share hidden session context.";
    default:
      return "Stay within the command contract and keep internal bookkeeping out of the default answer.";
  }
}

function dailyUseBullets(command) {
  const ux = command.ux ?? {};
  return [
    ...(Array.isArray(ux.dailyFlow) ? ux.dailyFlow : []),
    ux.targetingBehavior ? `Targeting: ${ux.targetingBehavior}` : null,
    ux.confirmationBehavior ? `Confirmation: ${ux.confirmationBehavior}` : null,
    ux.expectedOutcome ? `Outcome: ${ux.expectedOutcome}` : null
  ].filter(Boolean);
}

function exampleBullets(command) {
  const examples = command.ux?.examples;
  return Array.isArray(examples) ? examples.map((example) => String(example).trim()).filter(Boolean) : [];
}

const LOCAL_CLI_COMMANDS = new Map([
  ["dove.status", { command: "node ./bin/dove.mjs status ." }],
  ["dove.mission", { command: "node ./bin/dove.mjs mission ." }],
  ["dove.figure", { command: "node ./bin/dove.mjs figure . --intent \"<figure request>\"", note: "For figure requests, use the CLI result as the source of truth, say the practical figure state in ordinary language, and do not apply returned file changes unless the operator explicitly approves. If the CLI says a task must be selected and the operator confirms one, rerun `node ./bin/dove.mjs figure . --target \"<confirmed task title>\" --intent \"<figure request>\"` instead of putting the task title inside the intent." }]
]);

function localCliBullets(command) {
  const localCli = LOCAL_CLI_COMMANDS.get(command.id);
  if (localCli) {
    return [
      `When a local Dove CLI is available, run \`${localCli.command}\` from the project root before answering; summarize its compact output instead of inspecting saved records directly.`,
      ...(localCli.note ? [localCli.note] : [])
    ];
  }
  return ["If neither a matching Dove capability nor a documented local Dove CLI command exists for this surface, do not emulate it by reading saved records with host tools; say the Dove runtime for this command is unavailable and ask for a capability or CLI route."];
}

function guardrailBullets(command) {
  const bullets = [
    "For daily answers, first use the matching Dove capability or a local Dove CLI command; do not construct default answers by using host Read, Glob, Grep, or file-list tools over saved-record files.",
    "If the Dove capability or CLI command is unavailable, say the Dove runtime is unavailable or name the skipped live check in ordinary language instead of reading or dumping saved records.",
    "If the Dove CLI exits non-zero, report that message and stop; do not recover by reading saved records with host file tools.",
    ...localCliBullets(command),
    "Treat Dove's saved project records as the source of truth through Dove capability or local CLI results; translate those results into practical operator actions instead of repeating storage details.",
    "Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.",
    policyLine(command),
    ...(command.adapterConstraints ?? []),
    "Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended."
  ];
  if (command.domain === "paper") {
    bullets.push("Use paper workflows through the top-level Dove surfaces for sources, notes, drafting, review, rebuttal, experiences, figures, and version lineage.");
  } else {
    bullets.push("Use this shared Dove task surface across paper, engineering, experiment, review, and general missions; route concrete work through the top-level preset commands.");
  }
  bullets.push("Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.");
  return bullets;
}

function renderBullets(bullets) {
  return bullets.map((bullet) => `- ${bullet}`).join("\n");
}

function renderNumbered(bullets) {
  return bullets.map((bullet, index) => `${index + 1}. ${bullet}`).join("\n");
}

function renderExamples(command) {
  const examples = exampleBullets(command);
  return examples.length > 0 ? `\n\n## Examples\n\n${examples.map((example) => `- \`${example}\``).join("\n")}` : "";
}

function renderBody(command, heading) {
  const dailyUse = renderBullets(dailyUseBullets(command));
  const examples = renderExamples(command);
  const guardrails = renderNumbered(guardrailBullets(command));
  return `# ${heading}\n\n${command.summary}\n\n## Daily use\n\n${dailyUse}${examples}\n\n## Operating rules\n\n${guardrails}\n`;
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

function renderMarkdownCommand(command, heading) {
  return `${renderFrontmatter(command)}\n${renderBody(command, heading)}`;
}

function renderSkill(command) {
  const name = `dove-${hostCommandSlug(command.id)}`;
  return `${renderFrontmatter(command, { name })}\n${renderBody(command, markdownTitle(command))}`;
}

export function renderCommandAdapter(hostId, command) {
  switch (hostId) {
    case "opencode":
    case "claude": return renderMarkdownCommand(command, command.id);
    case "cursor": return renderMarkdownCommand(command, `dove-${hostCommandSlug(command.id)}`);
    case "codex":
    case "agents": return renderSkill(command);
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

export function generatedClaudeUserCommandEntries() {
  return COMMAND_SURFACES.map((command) => ({
    hostId: "claude",
    command,
    relativePath: adapterPathForCommand("claude", command),
    content: renderCommandAdapter("claude", command)
  }));
}

export function writeClaudeUserCommandAdapters(claudeConfigRoot) {
  const written = [];
  for (const entry of generatedClaudeUserCommandEntries()) {
    const absolutePath = path.join(claudeConfigRoot, entry.relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `${entry.content.trimEnd()}\n`, "utf8");
    written.push(entry.relativePath);
  }
  return written;
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
