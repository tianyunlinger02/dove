import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveCanonicalContainedWrite } from "../src/core/contained-write.mjs";
import { writeFileSetTransaction } from "../src/core/file-set-transaction.mjs";
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
  const withMutationMode = DIRECT_PROCESS_COMMAND_IDS.has(commandId) ? `${command} --mutation-mode direct-process` : command;
  return `${withMutationMode} --json`;
}

const LOCAL_CLI_COMMANDS = new Map([
  ["dove.init", { command: adapterCliCommand("dove.init", "node ./bin/dove-package.mjs init . --goal \"<project goal>\""), kind: "work", note: "Use init only to establish minimal project identity; it must not create packets, checklists, runtime, orchestration, or persistent context." }],
  ["dove.status", { command: "node ./bin/dove-package.mjs status . --json", kind: "check", note: "When multiple missions exist, rerun with `--mission-id \"<mission id>\" --json`; never select an implicit latest mission." }],
  ["dove.lessons", { command: "node ./bin/dove-package.mjs lessons query . --mission-id \"<mission id>\" --json", kind: "check", note: "Query is the default and must remain zero-write. Never auto-capture a lesson and never auto-recall lessons from another command. Use `lessons record` only when the operator explicitly asks to preserve a specific lesson; then run only the exact confirmation command returned by the zero-write proposal." }],
  ["dove.mission", { command: adapterCliCommand("dove.mission", "node ./bin/dove-package.mjs mission . --goal \"<mission goal>\""), kind: "check", note: "After approval, run the exact confirmation command returned by the proposal, persist only that contract, and continue with native host planning and tools." }],
  ["dove.version", { command: adapterCliCommand("dove.version", "node ./bin/dove-package.mjs version . --mission-id \"<mission id>\" --version-id \"<version id>\" --artifact \"<artifact path>\""), kind: "work", note: "Snapshots and comparisons are mission-bound and hash-current; finalization fails closed without completion and trusted review proof." }],
  ["dove.source", { command: adapterCliCommand("dove.source", "node ./bin/dove-package.mjs source register . --mission-id \"<mission id>\" --source-id \"<source id>\" --title \"<source title>\" --locator \"<url or doi>\" --capture-path \"<visible captured material path>\""), kind: "work", note: "First use `search_network` to discover a non-authoritative registrationDraft, visibly capture the selected material with host tools, run the listed registration command with that exact capture path, then run `node ./bin/dove-package.mjs source . --mission-id \"<mission id>\" --source-id \"<source id>\" --json` to inspect the candidate. Search and registration make no trust claim; public verification can reject but cannot issue positive trust." }],
  ["dove.note", { command: adapterCliCommand("dove.note", "node ./bin/dove-package.mjs note . --mission-id \"<mission id>\" --note-id \"<note id>\" --summary \"<synthesis>\""), kind: "work", note: "Use this only with substantive synthesis and current mission-bound evidence." }],
  ["dove.experience", { command: adapterCliCommand("dove.experience", "node ./bin/dove-package.mjs experience . --mission-id \"<mission id>\" --experiment-id \"<experiment id>\" --goal \"<experiment goal>\" --hypothesis \"<hypothesis>\" --protocol \"<protocol>\" --success-criterion \"<criterion>\""), kind: "work", note: "Results require current evidence and a clean audit before claim bridging." }],
  ["dove.draft", { command: adapterCliCommand("dove.draft", "node ./bin/dove-package.mjs draft . --mission-id \"<mission id>\" --draft-id \"<draft id>\" --body \"<draft text>\""), kind: "work", note: "Write real body content; metadata-only mode requires an existing current mission draft." }],
  ["dove.figure", { command: adapterCliCommand("dove.figure", "node ./bin/dove-package.mjs figure . --mission-id \"<mission id>\" --figure-id \"<figure id>\" --intent \"<figure request>\" --purpose \"<purpose>\" --material \"<artifact path>\" --prompt \"<drawing prompt>\""), kind: "work", note: "Provider execution stays host-side; import output with an exact hash, caption, QA, and independent-review boundary." }],
  ["dove.review", { command: adapterCliCommand("dove.review", "node ./bin/dove-package.mjs review . --mission-id \"<mission id>\" --review-id \"<review id>\" --artifact \"<artifact path>\" --preflight"), kind: "work", note: "Use --preflight for zero-write local checks, --prepare to freeze the canonical exchange, and --import only after the reviewer writes the canonical handoff and report. Distinguish the returned operation field. For prepare, preserve actionablePaths.input, actionablePaths.manifest, actionablePaths.handoff, actionablePaths.report, and importAction exactly. For import, preserve those canonical actionable paths and nextAction exactly. Public imports never mint Reviewer authority." }],
  ["dove.rebuttal", { command: adapterCliCommand("dove.rebuttal", "node ./bin/dove-package.mjs rebuttal . --mission-id \"<mission id>\" --issue-json \"<finding-linked issue JSON>\" --strategy \"<strategy>\" --response-json \"<response JSON>\""), kind: "work", note: "Every issue must link a current review artifact and finding id; responses remain author-side and evidence-linked." }]
]);

function localCliBullets(command) {
  const localCli = LOCAL_CLI_COMMANDS.get(command.id);
  if (localCli) {
    const listedKind = localCli.kind === "work" ? "listed project action" : "listed project check";
    const directness = localCli.kind === "work"
      ? "Run it only when the needed material is present; then summarize the real artifact state or material boundary instead of inspecting internal files directly."
      : "Summarize its practical result instead of inspecting internal files directly.";
    return [
      `This request has one ${listedKind}: \`${localCli.command}\`. Run it in the host's current working directory without changing directories or reinterpreting a parent repository as the target; \`.\` is the Dove workspace being operated on. ${directness}`,
      ...(localCli.note ? [localCli.note] : [])
    ];
  }
  const terminalProbe = `node ./bin/dove-package.mjs ${hostCommandSlug(command.id)} --help`;
  return [`This request has no listed project action. Do not run status, \`${terminalProbe}\`, the matching local surface, or any other unlisted command for it. If the target is unclear, ask the operator to choose from visible context. If this chat cannot finish the requested work directly, answer with what material is ready, what has not been added to the mission, and the next user choice; do not explain why the tool is unavailable.`];
}

function guardrailBullets(command) {
  const bullets = [
    "For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.",
    "If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.",
    "If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.",
    ...localCliBullets(command),
    "Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.",
    "Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.",
    "When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.",
    "Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.",
    "When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.",
    policyLine(command),
    ...(command.adapterConstraints ?? []),
    "Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended."
  ];
  if (command.id === "dove.mission") {
    bullets.push("Keep the handoff brief identical to the approved contract content; do not add a next command, role, route, authority, status, or blocker-routing instruction.");
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
