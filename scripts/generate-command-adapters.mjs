import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveCanonicalContainedWrite } from "../src/core/contained-write.mjs";
import {
  COMMAND_SURFACES,
  DIRECT_PROCESS_ADAPTER_COMMAND_IDS,
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
      return "Only inspect and suggest; wait for explicit approval before changing anything.";
    case "query":
      return "Keep this read-only unless the command explicitly asks to refresh a derived report.";
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

function dailyUseBullets(command) {
  const ux = command.ux ?? {};
  return [
    ...(Array.isArray(ux.dailyFlow) ? ux.dailyFlow : []),
    ux.targetingBehavior ? `Targeting: ${ux.targetingBehavior}` : null,
    ux.confirmationBehavior ? `Confirmation: ${ux.confirmationBehavior}` : null,
    ux.expectedOutcome ? `Outcome: ${ux.expectedOutcome}` : null
  ].filter(Boolean);
}

function exampleBullets(command, hostId = null) {
  const examples = command.ux?.examples;
  if (!Array.isArray(examples)) {
    return [];
  }
  return examples.map((example) => {
    const text = String(example).trim();
    return hostId === "opencode" ? text.replace(/^\/dove:/u, "/dove.") : text;
  }).filter(Boolean);
}

const DIRECT_PROCESS_COMMAND_IDS = new Set(DIRECT_PROCESS_ADAPTER_COMMAND_IDS);

function adapterCliCommand(commandId, command) {
  return DIRECT_PROCESS_COMMAND_IDS.has(commandId) ? `${command} --mutation-mode direct-process` : command;
}

const LOCAL_CLI_COMMANDS = new Map([
  ["dove.init", { command: adapterCliCommand("dove.init", "node ./bin/dove-package.mjs init . --goal \"<project goal>\""), kind: "work", note: "Use init only for the project-level goal; concrete research, writing, review, experiment, figure, or code work belongs in mission, auto, or the matching work request." }],
  ["dove.status", { command: "node ./bin/dove-package.mjs status .", kind: "check" }],
  ["dove.mission", { command: adapterCliCommand("dove.mission", "node ./bin/dove-package.mjs mission . --goal \"<task goal>\""), kind: "check", note: "After approval, run the exact confirmation command returned by the proposal; its proposal token binds the complete approved contract, workspace, and fixed mutation mode, materializes only that contract, and returns the recommended next route." }],
  ["dove.auto", { command: adapterCliCommand("dove.auto", "node ./bin/dove-package.mjs auto . --target \"<task title>\""), kind: "check", note: "First return the proposal without writing. When real workflow material is supplied, pass the complete structured step array once through `--steps-json '<JSON array>'`; after approval, run the exact confirmation command so the proposal token preserves those step arguments. Run auto only when the selected task has real work material or a concrete material boundary to report." }],
  ["dove.operator", { command: adapterCliCommand("dove.operator", "node ./bin/dove-package.mjs operator . --confirmed"), kind: "work", note: "Run operator only after approval. Supply real task results once through `--task-results-json '<JSON array>'` and use `--run-id \"<run id>\"` when the pass needs a stable run identifier; if no real result or safe built-in step exists, report the required material instead of claiming progress." }],
  ["dove.lessons", { command: "node ./bin/dove-package.mjs lessons .", kind: "check", note: "Use lesson writing only for distilled reusable guidance with problem, decision, pitfall, validation, and next-time behavior; add `--mutation-mode direct-process` to the explicit lesson-recording command." }],
  ["dove.version", { command: adapterCliCommand("dove.version", "node ./bin/dove-package.mjs version . --reason \"<direction change reason>\""), kind: "work", note: "Use version only for a deliberate direction reset with a short reason, not as a general undo path." }],
  ["dove.source", { command: adapterCliCommand("dove.source", "node ./bin/dove-package.mjs source . --target \"<task title>\" --title \"<source title>\" --locator \"<url or doi>\""), kind: "work", note: "Use this only after the source material is verified; if retrieval or verification fails, say no source was added and name the missing material." }],
  ["dove.note", { command: adapterCliCommand("dove.note", "node ./bin/dove-package.mjs note . --target \"<task title>\" --summary \"<synthesis>\""), kind: "work", note: "Use this only when there is real synthesis content such as a summary, quote, claim, or open question." }],
  ["dove.experience", { command: adapterCliCommand("dove.experience", "node ./bin/dove-package.mjs experience . --target \"<task title>\" --goal \"<experiment goal>\" --methodology \"<method>\" --success-metric \"<metric>\""), kind: "work", note: "Use this for experiment/evidence material; if method, metric, result evidence, or claim linkage is missing, say exactly which material is missing." }],
  ["dove.draft", { command: adapterCliCommand("dove.draft", "node ./bin/dove-package.mjs draft . --target \"<task title>\" --section-id \"<section>\" --body \"<draft text>\""), kind: "work", note: "Use draft only for real section text; status-only section changes need an explicit status request." }],
  ["dove.figure", { command: adapterCliCommand("dove.figure", "node ./bin/dove-package.mjs figure . --intent \"<figure request>\""), kind: "work", note: "For figure requests, use the CLI result as the source of truth, say the practical figure state in ordinary language, and do not apply returned file changes unless the operator explicitly approves. If the CLI says a task must be selected and the operator confirms one, rerun `node ./bin/dove-package.mjs figure . --target \"<confirmed task title>\" --intent \"<figure request>\" --mutation-mode direct-process` instead of putting the task title inside the intent." }],
  ["dove.review", { command: adapterCliCommand("dove.review", "node ./bin/dove-package.mjs review . --target \"<task title>\" --artifact-path \"<artifact path>\""), kind: "work", note: "Use this for local evidence-aware review; pass one or more `--artifact-path` values when the operator names exact materials, and use separate isolated or audio review only when explicitly requested." }],
  ["dove.review-loop", { command: adapterCliCommand("dove.review-loop", "node ./bin/dove-package.mjs review-loop . --target \"<task title>\" --artifact-path \"<artifact path>\""), kind: "work", note: "Run exactly one independent local Reviewer pass. This call does not revise Builder-owned material; return an explicit Builder handoff and invoke review again only after a separate revision call." }],
  ["dove.rebuttal", { command: adapterCliCommand("dove.rebuttal", "node ./bin/dove-package.mjs rebuttal . --target \"<task title>\" --issue \"<reviewer issue>\""), kind: "work", note: "Use rebuttal for reviewer issues and author-side response strategy; keep unsupported gaps explicit instead of drafting around them." }]
]);

function localCliBullets(command) {
  const localCli = LOCAL_CLI_COMMANDS.get(command.id);
  if (localCli) {
    const listedKind = localCli.kind === "work" ? "listed project action" : "listed project check";
    const directness = localCli.kind === "work"
      ? "Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly."
      : "Summarize its practical result instead of inspecting internal files directly.";
    return [
      `This request has one ${listedKind}: \`${localCli.command}\` from the project root; ${directness}`,
      ...(localCli.note ? [localCli.note] : [])
    ];
  }
  const terminalProbe = `node ./bin/dove-package.mjs ${hostCommandSlug(command.id)} --help`;
  return [`This request has no listed project action. Do not run status, \`${terminalProbe}\`, the matching local surface, or any other unlisted command for it. If the target is unclear, ask the operator to choose from visible context. If this chat cannot finish the requested work directly, answer with what material is ready, what has not been added to the task, and the next user choice; do not explain why the tool is unavailable.`];
}

function guardrailBullets(command) {
  const bullets = [
    "For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.",
    "If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.",
    "If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.",
    ...localCliBullets(command),
    "Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.",
    "Use ordinary task wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.",
    "When the target work is unclear, ask the operator to choose by visible task name or numbered option; do not ask for internal ids in the default answer.",
    "Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.",
    "When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.",
    policyLine(command),
    ...(command.adapterConstraints ?? []),
    "Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended."
  ];
  if (command.domain === "paper") {
    bullets.push("Use the top-level Dove requests for sources, notes, drafting, review, rebuttal, experiences, figures, and version lineage.");
  } else {
    bullets.push("Use this shared Dove task flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.");
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

function renderExamples(command, hostId = null) {
  const examples = exampleBullets(command, hostId);
  return examples.length > 0 ? `\n\n## Examples\n\n${examples.map((example) => `- \`${example}\``).join("\n")}` : "";
}

function renderBody(command, heading, hostId = null) {
  const dailyUse = renderBullets(dailyUseBullets(command));
  const examples = renderExamples(command, hostId);
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
    const { fullPath: absolutePath } = resolveCanonicalContainedWrite(claudeConfigRoot, entry.relativePath, { label: "Claude command adapter path" });
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
    const { fullPath: absolutePath } = resolveCanonicalContainedWrite(root, entry.relativePath, { label: "Generated command adapter path" });
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
