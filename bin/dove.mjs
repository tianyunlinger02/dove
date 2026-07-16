#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { resolveClaudeConfigRoot } from "../src/core/claude-code-gateway.mjs";
import { parseDoveCli } from "../src/cli/command-parser.mjs";
import { COMMAND_SURFACES, CORE_INSTALL_PATHS, DEFAULT_HOST_ADAPTERS, HOST_ADAPTERS, HOST_IDS, USER_HOST_IDS } from "../src/core/command-manifest.mjs";
import { resolveCanonicalContainedWrite } from "../src/core/contained-write.mjs";
import { ingestExecutionReceipt, resolveExecutionReceiptPostCommit } from "../src/core/execution-receipts.mjs";
import { writeFileSetTransaction } from "../src/core/file-set-transaction.mjs";
import { queryDoveLessons, recordDoveLesson } from "../src/core/lessons.mjs";
import { createDoveMission, initDoveGoal } from "../src/core/mission-contracts.mjs";
import { queryDoveStatus } from "../src/core/mission-queries.mjs";
import { runWithMutationContext } from "../src/core/mutation-backend.mjs";
import { buildRebuttal, buildRebuttalStrategy, compareVersions, createVersionSnapshot, normalizeRebuttalIssues, runExperienceWorkflow, runFigureWorkflow, upsertDraft, upsertDraftMetadata, upsertNote } from "../src/core/retained-domain-workflows.mjs";
import { importReviewExchange, prepareReviewExchange, verifyReviewCoverage } from "../src/core/review-exchange.mjs";
import { registerSource, verifySource } from "../src/core/source-trust.mjs";
import { inspectDoveWorkspace } from "../src/core/workspace-schema.mjs";
import { generatedClaudeUserCommandEntries } from "../scripts/generate-command-adapters.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const LOCAL_COMMANDS = new Set(["init", "mission", "receipt", "status", "lessons", "version", "source", "note", "draft", "experience", "figure", "review", "rebuttal"]);
const PUBLIC_COMMANDS = new Set(COMMAND_SURFACES.map((surface) => surface.id.replace(/^dove\./u, "")));

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

Dove persists only schema 8 mission, advisory lesson, execution receipt ledger, source, domain, review, rebuttal, and version artifacts.
`);
}

function readFlagValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : null;
}

function readFlagValues(args, flag) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && index + 1 < args.length) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseRepeatedJson(args, flag) {
  return readFlagValues(args, flag).map((value) => parseJson(value, flag));
}

function mutationMode(args, fallback = "patch-plan") {
  const value = readFlagValue(args, "--mutation-mode") ?? fallback;
  if (!["patch-plan", "direct-process"].includes(value)) throw new Error("--mutation-mode must be patch-plan or direct-process.");
  return value;
}

function withoutMutationMode(args) {
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--mutation-mode") {
      index += 1;
    } else {
      result.push(args[index]);
    }
  }
  return result;
}

function resolveTarget(rawTarget) {
  return path.resolve(process.cwd(), rawTarget || ".");
}

function targetAndArgs(rawTarget, args) {
  return !rawTarget || rawTarget.startsWith("-")
    ? { target: resolveTarget("."), args: rawTarget ? [rawTarget, ...args] : args }
    : { target: resolveTarget(rawTarget), args };
}

function runMutation(target, actionId, args, callback, fallback = "patch-plan") {
  const cleanArgs = withoutMutationMode(args);
  const result = runWithMutationContext(target, { actionId, mutationMode: mutationMode(args, fallback), hostId: "cli" }, () => callback(cleanArgs));
  return resolveExecutionReceiptPostCommit(target, result);
}

function shellQuote(value) {
  return `'${String(value ?? "").replace(/'/gu, `'"'"'`)}'`;
}

function proposalToken(result) {
  return result?.confirmation?.proposalToken ?? null;
}

function proposalCommand(command, result, target, token = proposalToken(result)) {
  const mode = result?.confirmation?.mutationMode ?? result?.confirmation?.confirmArgs?.mutationMode;
  if (!token || !mode) return null;
  return ["node", shellQuote(__filename), command, shellQuote(target), "--proposal-token", shellQuote(token), "--confirmed", "--mutation-mode", shellQuote(mode), "--json"].join(" ");
}

function withProposalCommand(command, result, target) {
  const token = proposalToken(result);
  const exactConfirmationCommand = proposalCommand(command, result, target, token);
  return exactConfirmationCommand ? { ...result, confirmation: { ...result.confirmation, exactConfirmationCommand } } : result;
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

function initArgs(args) {
  const token = readFlagValue(args, "--proposal-token");
  if (token) return { ...decodeProposalToken(token, "init").confirmArgs, confirmed: args.includes("--confirmed") };
  return { goal: readFlagValue(args, "--goal"), archiveReset: args.includes("--archive-reset"), confirmed: args.includes("--confirmed"), proposalDigest: readFlagValue(args, "--proposal-digest"), mutationMode: mutationMode(args, "direct-process") };
}

function missionArgs(args) {
  const token = readFlagValue(args, "--proposal-token");
  if (token) {
    const payload = decodeProposalToken(token, "mission");
    return { ...payload.confirmArgs, confirmed: args.includes("--confirmed"), mutationMode: payload.mutationMode ?? payload.confirmArgs.mutationMode };
  }
  return {
    confirmed: args.includes("--confirmed"), mutationMode: mutationMode(args, "direct-process"), proposalDigest: readFlagValue(args, "--proposal-digest"),
    missionId: readFlagValue(args, "--mission-id"), goal: readFlagValue(args, "--goal"), scope: readFlagValues(args, "--scope"),
    outOfScope: readFlagValues(args, "--out-of-scope"), targetArtifacts: readFlagValues(args, "--target-artifact"), expectedArtifacts: readFlagValues(args, "--expected-artifact"),
    completionCriteria: readFlagValues(args, "--completion-criterion"), evidenceRequirements: readFlagValues(args, "--evidence-requirement"),
    dependsOnMissionIds: readFlagValues(args, "--depends-on-mission-id"), supersedesMissionId: readFlagValue(args, "--supersedes-mission-id")
  };
}

function lessonQueryArgs(args) {
  return Object.fromEntries(Object.entries({
    lessonId: readFlagValue(args, "--lesson-id") ?? undefined,
    missionId: readFlagValue(args, "--mission-id") ?? undefined,
    scope: readFlagValue(args, "--scope") ?? undefined,
    kind: readFlagValue(args, "--kind") ?? undefined,
    tags: readFlagValues(args, "--tag"),
    artifactRefs: readFlagValues(args, "--artifact"),
    includeSuperseded: args.includes("--include-superseded"),
    includeUnscoped: args.includes("--include-unscoped"),
    limit: readFlagValue(args, "--limit") ?? undefined
  }).filter(([, value]) => value !== undefined));
}

function lessonRecordArgs(args) {
  const token = readFlagValue(args, "--proposal-token");
  if (token) {
    const payload = decodeProposalToken(token, "lesson");
    return { ...payload.confirmArgs, proposalToken: token, confirmed: args.includes("--confirmed"), mutationMode: payload.mutationMode ?? payload.confirmArgs.mutationMode };
  }
  if (args.includes("--confirmed")) throw new Error("dove lessons record --confirmed requires the exact --proposal-token returned by the proposal.");
  return {
    mutationMode: mutationMode(args, "direct-process"),
    missionId: readFlagValue(args, "--mission-id"),
    lessonId: readFlagValue(args, "--lesson-id"),
    scope: readFlagValue(args, "--scope"),
    kind: readFlagValue(args, "--kind"),
    summary: readFlagValue(args, "--summary"),
    details: readFlagValue(args, "--details") ?? undefined,
    nextTimeGuidance: readFlagValues(args, "--next-time-guidance"),
    sourceIds: readFlagValues(args, "--source-id"),
    noteIds: readFlagValues(args, "--note-id"),
    artifactRefs: readFlagValues(args, "--artifact"),
    appliesToArtifactRefs: readFlagValues(args, "--applies-to-artifact"),
    tags: readFlagValues(args, "--tag"),
    supersedesLessonId: readFlagValue(args, "--supersedes-lesson-id") ?? undefined
  };
}

function receiptArgs(args, root) {
  const input = readFlagValue(args, "--input");
  if (input) {
    const fullPath = path.resolve(root, input);
    const relative = path.relative(root, fullPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("--input must stay inside the selected workspace.");
    return parseJson(fs.readFileSync(fullPath, "utf8"), "--input");
  }
  return { receiptId: readFlagValue(args, "--receipt-id"), missionId: readFlagValue(args, "--mission-id"), contractDigest: readFlagValue(args, "--contract-digest"), summary: readFlagValue(args, "--summary"), artifacts: parseRepeatedJson(args, "--artifact-json"), validations: parseRepeatedJson(args, "--validation-json"), criteriaSatisfied: parseRepeatedJson(args, "--criterion-json"), producedAt: readFlagValue(args, "--produced-at") };
}

function sourceArgs(args, action) {
  if (action === "verify") return { missionId: readFlagValue(args, "--mission-id"), sourceId: readFlagValue(args, "--source-id"), method: readFlagValue(args, "--method"), checkedMaterial: readFlagValue(args, "--checked-material"), auditEvidence: parseJson(readFlagValue(args, "--audit-evidence-json") ?? "[]", "--audit-evidence-json") };
  return { missionId: readFlagValue(args, "--mission-id"), sourceId: readFlagValue(args, "--source-id"), citationKey: readFlagValue(args, "--citation-key"), title: readFlagValue(args, "--title"), locator: readFlagValue(args, "--locator"), sourceType: readFlagValue(args, "--source-type"), origin: readFlagValue(args, "--origin"), abstract: readFlagValue(args, "--abstract"), year: readFlagValue(args, "--year"), authors: readFlagValues(args, "--author"), capturePath: readFlagValue(args, "--capture-path") };
}

function reviewArgs(args) {
  const modes = ["preflight", "prepare", "import", "verify-coverage"].filter((mode) => args.includes(`--${mode}`));
  if (modes.length > 1) throw new Error("dove review accepts one operation mode.");
  const mode = modes[0] ?? "preflight";
  const missionId = readFlagValue(args, "--mission-id");
  if (mode === "import") return { mode, args: { missionId, exchangeId: readFlagValue(args, "--exchange-id"), reviewId: readFlagValue(args, "--review-id") } };
  if (mode === "verify-coverage") return { mode, args: { missionId, artifactPaths: readFlagValues(args, "--artifact"), requireAuthoritative: args.includes("--require-authoritative") } };
  return { mode, args: { missionId, policy: mode === "preflight" ? "local-preflight" : readFlagValue(args, "--policy"), artifactPaths: readFlagValues(args, "--artifact"), finalPlanPaths: readFlagValues(args, "--final-plan"), finalResultPaths: readFlagValues(args, "--final-result") } };
}

function hostIds(args) {
  const raw = [...readFlagValues(args, "--host"), ...readFlagValues(args, "--platform")];
  if (raw.length === 0) return DEFAULT_HOST_ADAPTERS;
  const requested = raw.flatMap((value) => value.split(",").map((item) => item.trim()).filter(Boolean));
  if (requested.includes("all")) return HOST_IDS;
  const invalid = requested.filter((host) => !HOST_IDS.includes(host));
  if (invalid.length) throw new Error(`Unknown host adapter(s): ${invalid.join(", ")}.`);
  return [...new Set(requested)];
}

function collectCopyEntries(source, destination, force, destinationRoot, entries) {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) return;
  const relative = path.relative(destinationRoot, destination).split(path.sep).join("/");
  resolveCanonicalContainedWrite(destinationRoot, relative, { label: "Install destination" });
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(source)) collectCopyEntries(path.join(source, entry), path.join(destination, entry), force, destinationRoot, entries);
    return;
  }
  if (!stat.isFile()) return;
  entries.push({ root: destinationRoot, relativePath: relative, content: fs.readFileSync(source), force, label: "Install destination" });
}

function installOrSync(target, args) {
  const hosts = hostIds(args);
  const projectHosts = hosts.filter((host) => Object.hasOwn(HOST_ADAPTERS, host));
  const corePaths = [...CORE_INSTALL_PATHS];
  const hostPaths = projectHosts.flatMap((host) => HOST_ADAPTERS[host].paths.map((relativePath) => ({ host, relativePath })));
  const force = args.includes("--force");
  const entries = [];
  for (const relativePath of corePaths) {
    const source = path.join(PACKAGE_ROOT, relativePath);
    if (fs.existsSync(source)) collectCopyEntries(source, path.join(target, relativePath), force, target, entries);
  }
  for (const { relativePath } of hostPaths) {
    const source = path.join(PACKAGE_ROOT, relativePath);
    if (fs.existsSync(source)) collectCopyEntries(source, path.join(target, relativePath), force, target, entries);
  }
  let claudeConfigRoot = null;
  if (hosts.some((host) => USER_HOST_IDS.includes(host))) {
    claudeConfigRoot = resolveClaudeConfigRoot();
    for (const entry of generatedClaudeUserCommandEntries()) entries.push({ root: claudeConfigRoot, relativePath: entry.relativePath, content: `${entry.content.trimEnd()}\n`, encoding: "utf8", force: true, label: "Claude command adapter path" });
  }
  const transaction = writeFileSetTransaction(entries);
  const writtenPaths = new Set(transaction.writtenPaths);
  const copiedUserHostPaths = claudeConfigRoot
    ? generatedClaudeUserCommandEntries().filter((entry) => writtenPaths.has(entry.relativePath)).map((entry) => ({ host: "claude", path: entry.relativePath, root: claudeConfigRoot }))
    : [];
  return { target, hosts, force: args.includes("--force"), copiedCorePaths: corePaths, copiedHostPaths: hostPaths.map(({ host, relativePath }) => ({ host, path: relativePath })), copiedUserHostPaths, transactionState: transaction.transactionState };
}

function claudeCommandPaths() {
  return COMMAND_SURFACES.map((surface) => path.join(resolveClaudeConfigRoot(), "commands", "dove", `${surface.id.replace(/^dove\./u, "").replace(/\./gu, "-")}.md`));
}

function detectHosts(target, { includeClaude = false } = {}) {
  const result = Object.entries(HOST_ADAPTERS).filter(([, adapter]) => adapter.paths.some((relativePath) => fs.existsSync(path.join(target, relativePath)))).map(([host]) => host);
  if (includeClaude && claudeCommandPaths().some((absolutePath) => fs.existsSync(absolutePath))) result.push("claude");
  return result;
}

function doctor(target) {
  const installedHosts = detectHosts(target, { includeClaude: true });
  const missing = installedHosts.filter((host) => host !== "claude").flatMap((host) => (HOST_ADAPTERS[host]?.requiredPaths ?? []).filter((relativePath) => !fs.existsSync(path.join(target, relativePath))));
  if (installedHosts.some((host) => host !== "claude") && !fs.existsSync(path.join(target, "mcp/dove-state-server-package.mjs"))) missing.push("mcp/dove-state-server-package.mjs");
  const checks = installedHosts.map((host) => ({ check: `host-adapter:${host}`, ok: host === "claude" ? claudeCommandPaths().every((absolutePath) => fs.existsSync(absolutePath)) : (HOST_ADAPTERS[host]?.requiredPaths ?? []).every((relativePath) => fs.existsSync(path.join(target, relativePath))), requiredPaths: host === "claude" ? claudeCommandPaths().map((absolutePath) => path.relative(resolveClaudeConfigRoot(), absolutePath).split(path.sep).join("/")) : HOST_ADAPTERS[host]?.requiredPaths ?? [] }));
  const workspace = inspectDoveWorkspace(target);
  const workspaceOk = workspace.state === "absent" ? installedHosts.length > 0 && missing.length === 0 : workspace.healthy;
  checks.push({ check: "workspace-schema", ok: workspaceOk, message: workspace.state === "absent" ? "Dove runtime is installed and .dove is absent; initialize explicitly when needed." : workspace.healthy ? `Current Dove schema ${workspace.schemaVersion} is healthy.` : `${workspace.state}${workspace.error ? `: ${workspace.error}` : ""}; run dove init --archive-reset and confirm the exact proposal.` });
  const result = { target, node: process.version, healthy: missing.length === 0 && checks.every((check) => check.ok), workspaceMode: workspace.state === "absent" ? "runtime-only" : workspace.healthy ? "current-schema" : "archive-reset-required", workspaceSchema: { state: workspace.state, category: workspace.category, healthy: workspace.healthy, schemaVersion: workspace.schemaVersion, detectedSchema: workspace.detectedSchema, error: workspace.error ?? null, zeroWrite: true }, missing: [...new Set(missing)], checks, warnings: [], hostAdapters: installedHosts, writes: [] };
  console.log(JSON.stringify(result, null, 2));
  return result.healthy ? 0 : 1;
}

function statusArgs(args) {
  return { missionId: readFlagValue(args, "--mission-id") ?? undefined, detail: args.includes("--full") || args.includes("--missions") ? "full" : readFlagValue(args, "--detail"), full: args.includes("--full"), showMissions: args.includes("--missions") };
}

function wantsJson(args) {
  return args.includes("--json") || readFlagValue(args, "--format") === "json";
}

function printResult(result, args) {
  if (wantsJson(args)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const command = result?.confirmation?.exactConfirmationCommand;
  if (command && result?.confirmation?.required === true) {
    console.log([
      "--- DOVE PROPOSAL: ZERO-WRITE BOUNDARY ---",
      result.summary ?? result.headline ?? result.status ?? "Dove proposal is ready.",
      "No durable mutation has been applied.",
      "Exact confirmation command:",
      command,
      "--- END DOVE PROPOSAL ---"
    ].join("\n"));
    return;
  }
  console.log(result.summary ?? result.headline ?? result.status ?? "Dove operation completed.");
}

let parsed;
try {
  parsed = parseDoveCli(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const command = parsed.command;
if (!command || ["help", "--help", "-h"].includes(command)) {
  usage();
  process.exit(0);
}
if (!Object.hasOwn({ install: true, sync: true, doctor: true }, command) && !LOCAL_COMMANDS.has(command)) {
  usage();
  process.exit(1);
}

let [rawTarget, ...extraPositionals] = parsed.positionals;
let sourceAction = "register";
if (command === "source" && ["register", "verify"].includes(rawTarget)) {
  sourceAction = rawTarget;
  [rawTarget, ...extraPositionals] = extraPositionals;
}
let lessonsAction = "query";
if (command === "lessons" && ["query", "record"].includes(rawTarget)) {
  lessonsAction = rawTarget;
  [rawTarget, ...extraPositionals] = extraPositionals;
}
const invalidLessonsPositionals = command === "lessons" && extraPositionals.length > 0;
const rawArgs = [...extraPositionals, ...parsed.args];
const selected = targetAndArgs(rawTarget, rawArgs);
const target = selected.target;
const args = selected.args;

try {
  if (invalidLessonsPositionals) throw new Error("dove lessons accepts only query or record followed by one target.");
  if (command === "install" || command === "sync") {
    if (readFlagValue(args, "--mutation-mode") === "patch-plan") throw new Error(`${command} requires direct-process file copying.`);
    console.log(JSON.stringify(installOrSync(target, args), null, 2));
    process.exit(0);
  }
  if (command === "doctor") process.exit(doctor(target));
  if (command === "status") {
    const result = queryDoveStatus(target, statusArgs(args));
    printResult(result, args);
    process.exit(0);
  }
  if (command === "init") {
    const input = initArgs(args);
    const result = input.confirmed ? runMutation(target, "init-dove-goal", args, () => initDoveGoal(target, input), "direct-process") : initDoveGoal(target, input);
    printResult(withProposalCommand("init", result, target), args);
    process.exit(0);
  }
  if (command === "mission") {
    const input = missionArgs(args);
    const result = input.confirmed ? runMutation(target, "create-dove-mission", args, () => createDoveMission(target, input), "direct-process") : createDoveMission(target, input);
    printResult(withProposalCommand("mission", result, target), args);
    process.exit(0);
  }
  if (command === "lessons") {
    if (lessonsAction === "query") {
      printResult(queryDoveLessons(target, lessonQueryArgs(args)), args);
      process.exit(0);
    }
    const input = lessonRecordArgs(args);
    const result = input.confirmed ? runMutation(target, "record-dove-lesson", args, () => recordDoveLesson(target, input), "direct-process") : recordDoveLesson(target, input);
    printResult(withProposalCommand("lessons record", result, target), args);
    process.exit(0);
  }
  let result;
  if (command === "receipt") result = runMutation(target, "ingest-execution-receipt", args, (clean) => ingestExecutionReceipt(target, receiptArgs(clean, target)));
  if (command === "source") result = runMutation(target, sourceAction === "verify" ? "verify-source" : "register-source", args, (clean) => sourceAction === "verify" ? verifySource(target, sourceArgs(clean, sourceAction)) : registerSource(target, sourceArgs(clean, sourceAction)));
  if (command === "note") result = runMutation(target, "upsert-note", args, (clean) => upsertNote(target, { missionId: readFlagValue(clean, "--mission-id"), noteId: readFlagValue(clean, "--note-id"), title: readFlagValue(clean, "--title"), summary: readFlagValue(clean, "--summary"), quotes: readFlagValues(clean, "--quote"), claims: readFlagValues(clean, "--claim"), openQuestions: readFlagValues(clean, "--open-question"), sourceIds: readFlagValues(clean, "--source-id"), artifactRefs: readFlagValues(clean, "--artifact") }));
  if (command === "draft") {
    const metadataOnly = args.includes("--metadata-only");
    result = runMutation(target, metadataOnly ? "upsert-draft-metadata" : "upsert-draft", args, (clean) => (metadataOnly ? upsertDraftMetadata : upsertDraft)(target, { missionId: readFlagValue(clean, "--mission-id"), draftId: readFlagValue(clean, "--draft-id"), title: readFlagValue(clean, "--title"), body: readFlagValue(clean, "--body"), summary: readFlagValue(clean, "--summary"), evidenceRefs: readFlagValues(clean, "--evidence"), artifactRefs: readFlagValues(clean, "--artifact") }));
  }
  if (command === "experience") result = runMutation(target, "run-experience-workflow", args, (clean) => runExperienceWorkflow(target, { missionId: readFlagValue(clean, "--mission-id"), experimentId: readFlagValue(clean, "--experiment-id"), title: readFlagValue(clean, "--title"), goal: readFlagValue(clean, "--goal"), hypothesis: readFlagValue(clean, "--hypothesis"), protocol: readFlagValue(clean, "--protocol"), successCriteria: readFlagValues(clean, "--success-criterion"), comparisonTargets: readFlagValues(clean, "--comparison-target"), result: readFlagValue(clean, "--result"), resultEvidenceRefs: readFlagValues(clean, "--result-evidence"), auditFindings: readFlagValues(clean, "--audit-finding"), integrityFlags: readFlagValues(clean, "--integrity-flag"), claimId: readFlagValue(clean, "--claim-id"), bridgeReason: readFlagValue(clean, "--bridge-reason") }));
  if (command === "figure") result = runMutation(target, "run-figure-workflow", args, (clean) => runFigureWorkflow(target, { missionId: readFlagValue(clean, "--mission-id"), figureId: readFlagValue(clean, "--figure-id"), intent: readFlagValue(clean, "--intent"), purpose: readFlagValue(clean, "--purpose"), materials: readFlagValues(clean, "--material"), prompt: readFlagValue(clean, "--prompt"), outputPath: readFlagValue(clean, "--output-path"), outputSha256: readFlagValue(clean, "--output-sha256"), caption: readFlagValue(clean, "--caption"), qaFindings: readFlagValues(clean, "--qa-finding") }));
  if (command === "review") {
    const request = reviewArgs(args);
    if (request.mode === "preflight") result = prepareReviewExchange(target, request.args);
    else if (request.mode === "verify-coverage") result = verifyReviewCoverage(target, request.args);
    else result = runMutation(target, request.mode === "prepare" ? "prepare-review-exchange" : "import-review-exchange", args, () => request.mode === "prepare" ? prepareReviewExchange(target, request.args) : importReviewExchange(target, request.args));
  }
  if (command === "rebuttal") {
    const input = { missionId: readFlagValue(args, "--mission-id"), issues: parseRepeatedJson(args, "--issue-json"), strategy: readFlagValue(args, "--strategy"), responses: parseRepeatedJson(args, "--response-json") };
    if (args.includes("--issues-only")) result = runMutation(target, "normalize-rebuttal-issues", args, () => normalizeRebuttalIssues(target, { missionId: input.missionId, issues: input.issues }));
    else if (args.includes("--strategy-only")) result = runMutation(target, "build-rebuttal-strategy", args, () => buildRebuttalStrategy(target, { missionId: input.missionId, strategy: input.strategy }));
    else result = runMutation(target, "build-rebuttal", args, () => buildRebuttal(target, input));
  }
  if (command === "version") {
    const input = { missionId: readFlagValue(args, "--mission-id"), versionId: readFlagValue(args, "--version-id"), label: readFlagValue(args, "--label"), artifactRefs: readFlagValues(args, "--artifact"), supersedesVersionId: readFlagValue(args, "--supersedes-version-id"), fromVersionId: readFlagValue(args, "--from-version-id"), toVersionId: readFlagValue(args, "--to-version-id"), finalize: args.includes("--finalize") };
    const comparing = Boolean(input.fromVersionId || input.toVersionId);
    result = runMutation(target, comparing ? "compare-versions" : "create-version-snapshot", args, () => comparing ? compareVersions(target, input) : createVersionSnapshot(target, input));
  }
  printResult(result, args);
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (wantsJson(args)) console.log(JSON.stringify({ status: "blocked", message }, null, 2));
  else console.error(message);
  process.exit(1);
}
