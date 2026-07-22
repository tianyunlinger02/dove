import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveCanonicalContainedWrite } from "../src/core/contained-write.mjs";
import { writeFileSetTransaction } from "../src/core/file-set-transaction.mjs";
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
      return "Only inspect and suggest; wait for explicit approval before changing anything.";
    case "query":
      return "Keep every read and query strictly read-only with zero writes; never bootstrap, refresh, or mutate state from the query path.";
    case "guarded-mutation":
      return "Only make the specific change requested for this command; do not bundle unrelated work.";
    case "explicit-approval":
      return "Ask for approval before making the proposed change.";
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

function mcpInvocationBullets(command) {
  const tools = unique(command.requiredTools ?? []);
  const toolList = tools.map((tool) => `\`${tool}\``).join(", ");
  const bullets = [
    `Use only the Dove MCP tool matching the requested operation from this command's allowed tools: ${toolList}.`,
    "Pass only structured public arguments accepted by that tool. Call Dove through MCP only. If MCP is unavailable, stop instead of using another route.",
    "For checkpoint operations, let the MCP tool handle its one approval and application inside the same call. Never display or request proposal, replay, workspace, digest, token, mutation-mode, confirmation payload, or generated-command data."
  ];
  if (command.continuation === "resume-original") {
    bullets.push("Preserve the full original user request before calling Dove. After a successful Dove write, resume that same request in the current host turn using normal host planning, tools, files, testing, search, and review rather than ending at the Dove result.");
  }
  if (command.explicitStopMode === "create-only") {
    bullets.push("Stop after the Dove checkpoint only when the user explicitly asked solely to create or reevaluate the mission, to create it without execution, or to wait for another instruction. Words such as 'first' or 'before continuing' express order and do not by themselves request a stop.");
  }
  if (command.explicitStopMode === "protocol-only") {
    bullets.push("Stop after recording the experiment protocol only when the user explicitly asked for protocol-only setup; otherwise continue the requested experiment work with host tools when it is feasible in this turn.");
  }
  if (command.continuation === "resume-original") {
    bullets.push("If the Dove call is declined, cancelled, or fails, do not continue work that depended on the unsaved checkpoint; report the practical outcome in ordinary language.");
  }
  if (command.closure === "host-outcome") {
    const closureTools = unique(command.closureTools ?? []);
    if (closureTools.length !== 1) throw new Error(`${command.id} must declare exactly one host outcome closure tool.`);
    bullets.push(`Before the create checkpoint, generate one private safe mission id, pass it as \`missionId\`, and retain it only for this host turn; never show it to the user. After successful substantive host work, call the MCP tool \`${closureTools[0]}\` at most once. Reuse that exact mission id. Pass only that mission id, a concise outcome summary, paths actually created or materially changed, and optional real validation-output paths.`);
    bullets.push("Do not calculate or pass receipt identifiers, timestamps, fingerprints, contract data, artifact kinds, validation kinds, criterion claims, task ids, or session ids. Do not call closure after create-only, proposal-only, declined, cancelled, failed, or blocked work, and never retry it automatically.");
    bullets.push("A skipped closure is a valid zero-write outcome. If evidence recording fails, preserve every host-produced file and report that the substantive work succeeded but Dove could not record or assess its evidence; never roll back or delete the real work.");
  }
  return bullets;
}

function guardrailBullets(command) {
  const bullets = [
    "For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.",
    "If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.",
    "If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.",
    ...mcpInvocationBullets(command),
    "Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.",
    ...(command.id === "dove.init" ? ["For the visible initialization approval, say only that no files have changed, what minimal project records and goal will be saved, and ask whether to approve or cancel. Do not print or paraphrase schema versions, workspace identifiers, hashes, proposal tokens, confirmation payloads, replay fields, generated commands, or internal paths."] : []),
    "Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.",
    "When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.",
    "Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.",
    "When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.",
    policyLine(command),
    ...(command.adapterConstraints ?? []),
    "Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended."
  ];
  if (command.id === "dove.mission") {
    bullets.push("Keep the returned mission or research-tree material identical to the approved content; do not add a role, route, authority, status, or blocker-routing instruction.");
  } else if (command.domain === "paper") {
    bullets.push("Use the top-level Dove requests for sources, notes, drafting, review, rebuttal, experiences, figures, and version lineage.");
  } else {
    bullets.push("Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.");
  }
  if (command.id !== "dove.mission") {
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

export function writeClaudeUserCommandAdapters(claudeConfigRoot, options = {}) {
  const entries = generatedClaudeUserCommandEntries().map((entry) => ({
    root: claudeConfigRoot,
    relativePath: entry.relativePath,
    content: `${entry.content.trimEnd()}\n`,
    encoding: "utf8",
    force: true,
    label: "Claude command adapter path"
  }));
  return writeFileSetTransaction(entries, { fsOps: options.fsOps });
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

export function writeGeneratedAdapters(root = PACKAGE_ROOT, options = {}) {
  return writeFileSetTransaction(generatedAdapterEntries().map((entry) => ({
    root,
    relativePath: entry.relativePath,
    content: `${entry.content.trimEnd()}\n`,
    encoding: "utf8",
    force: true,
    label: "Generated command adapter path"
  })), { fsOps: options.fsOps });
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
