#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { resolveClaudeConfigRoot } from "../src/core/claude-code-gateway.mjs";
import { parseDoveCli } from "../src/cli/command-parser.mjs";
import { COMMAND_SURFACES, CORE_INSTALL_PATHS, DEFAULT_HOST_ADAPTERS, DOVE_CLAUDE_PROJECT_MARKER, DOVE_CLAUDE_PROJECT_MARKER_PATH, DOVE_MCP_CONFIG_PATH, DOVE_MCP_SERVER_NAME, HOST_ADAPTERS, HOST_IDS, INSTALLED_DOVE_MCP_SERVER, OPENCODE_ROLE_SKILL_PATHS, RETIRED_MANAGED_PATHS, USER_HOST_IDS } from "../src/core/command-manifest.mjs";
import { resolveCanonicalContainedWrite } from "../src/core/contained-write.mjs";
import { ingestExecutionReceipt, resolveExecutionReceiptPostCommit } from "../src/core/execution-receipts.mjs";
import { writeFileSetTransaction } from "../src/core/file-set-transaction.mjs";
import { queryDoveLessons, recordDoveLesson } from "../src/core/lessons.mjs";
import { createDoveMission, initDoveGoal } from "../src/core/mission-contracts.mjs";
import { queryDoveStatus } from "../src/core/mission-queries.mjs";
import { runWithMutationContext } from "../src/core/mutation-backend.mjs";
import { buildRebuttal, buildRebuttalStrategy, compareVersions, createVersionSnapshot, normalizeRebuttalIssues, runExperienceWorkflow, runFigureWorkflow, upsertDraft, upsertDraftMetadata, upsertNote } from "../src/core/retained-domain-workflows.mjs";
import { importReviewExchange, prepareReviewExchange, verifyReviewCoverage } from "../src/core/review-exchange.mjs";
import { querySources, registerSource, verifySource } from "../src/core/source-trust.mjs";
import { parseJsonWithoutDuplicateKeys } from "../src/core/strict-json.mjs";
import { inspectDoveWorkspace } from "../src/core/workspace-schema.mjs";
import { generatedAdapterEntries, generatedClaudeUserCommandEntries } from "../scripts/generate-command-adapters.mjs";

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
  dove mission [target] --operation reevaluate-research-tree --mission-id <id> --requirement <text> --node-update-json <json>
  dove receipt [target] --input <receipt.json>
  dove status [target] [--mission-id <id>] [--detail compact|full]
  dove lessons [query|record] [target] [--mission-id <id>]
  dove source [query|register|verify] [target] --mission-id <id> [--source-id <id>]
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

Dove persists only schema 9 mission, advisory lesson, execution receipt ledger, source, domain, review, rebuttal, research-tree, and version artifacts.
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

function definedObject(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined && value !== null));
}

function optionalFlagValue(args, flag) {
  return args.includes(flag) ? readFlagValue(args, flag) : undefined;
}

function optionalFlagValues(args, flag) {
  return args.includes(flag) ? readFlagValues(args, flag) : undefined;
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
  return definedObject({
    goal: optionalFlagValue(args, "--goal"),
    archiveReset: args.includes("--archive-reset") ? true : undefined,
    confirmed: args.includes("--confirmed") ? true : undefined,
    proposalDigest: optionalFlagValue(args, "--proposal-digest"),
    mutationMode: mutationMode(args, "direct-process")
  });
}

function missionArgs(args) {
  const token = readFlagValue(args, "--proposal-token");
  if (token) {
    const payload = decodeProposalToken(token, "mission");
    return { ...payload.confirmArgs, confirmed: args.includes("--confirmed"), mutationMode: payload.mutationMode ?? payload.confirmArgs.mutationMode };
  }
  const operation = optionalFlagValue(args, "--operation");
  return definedObject({
    operation,
    confirmed: args.includes("--confirmed") ? true : undefined,
    mutationMode: mutationMode(args, "direct-process"),
    proposalDigest: optionalFlagValue(args, "--proposal-digest"),
    missionId: optionalFlagValue(args, "--mission-id"),
    goal: optionalFlagValue(args, "--goal"),
    scope: optionalFlagValues(args, "--scope"),
    outOfScope: optionalFlagValues(args, "--out-of-scope"),
    targetArtifacts: optionalFlagValues(args, "--target-artifact"),
    expectedArtifacts: optionalFlagValues(args, "--expected-artifact"),
    completionCriteria: optionalFlagValues(args, "--completion-criterion"),
    evidenceRequirements: optionalFlagValues(args, "--evidence-requirement"),
    dependsOnMissionIds: optionalFlagValues(args, "--depends-on-mission-id"),
    supersedesMissionId: optionalFlagValue(args, "--supersedes-mission-id"),
    requirement: optionalFlagValue(args, "--requirement"),
    nodeUpdates: args.includes("--node-update-json") ? parseRepeatedJson(args, "--node-update-json") : undefined
  });
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
  return definedObject({
    receiptId: optionalFlagValue(args, "--receipt-id"),
    missionId: optionalFlagValue(args, "--mission-id"),
    contractDigest: optionalFlagValue(args, "--contract-digest"),
    summary: optionalFlagValue(args, "--summary"),
    artifacts: args.includes("--artifact-json") ? parseRepeatedJson(args, "--artifact-json") : undefined,
    validations: args.includes("--validation-json") ? parseRepeatedJson(args, "--validation-json") : undefined,
    criteriaSatisfied: args.includes("--criterion-json") ? parseRepeatedJson(args, "--criterion-json") : undefined,
    producedAt: optionalFlagValue(args, "--produced-at")
  });
}

function sourceArgs(args, action) {
  if (action === "query") return definedObject({ missionId: optionalFlagValue(args, "--mission-id"), sourceId: optionalFlagValue(args, "--source-id") });
  if (action === "verify") return definedObject({
    missionId: optionalFlagValue(args, "--mission-id"),
    sourceId: optionalFlagValue(args, "--source-id"),
    method: optionalFlagValue(args, "--method"),
    checkedMaterial: optionalFlagValue(args, "--checked-material"),
    auditEvidence: args.includes("--audit-evidence-json") ? parseJson(readFlagValue(args, "--audit-evidence-json"), "--audit-evidence-json") : undefined
  });
  return definedObject({
    missionId: optionalFlagValue(args, "--mission-id"),
    sourceId: optionalFlagValue(args, "--source-id"),
    citationKey: optionalFlagValue(args, "--citation-key"),
    title: optionalFlagValue(args, "--title"),
    locator: optionalFlagValue(args, "--locator"),
    sourceType: optionalFlagValue(args, "--source-type"),
    origin: optionalFlagValue(args, "--origin"),
    abstract: optionalFlagValue(args, "--abstract"),
    year: optionalFlagValue(args, "--year"),
    authors: optionalFlagValues(args, "--author"),
    capturePath: optionalFlagValue(args, "--capture-path")
  });
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

function requireManagedPackageSource(relativePath) {
  const source = path.join(PACKAGE_ROOT, relativePath);
  let stat;
  try {
    stat = fs.lstatSync(source);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`Managed package source is missing: ${relativePath}.`);
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error(`Managed package source must not be a symbolic link: ${relativePath}.`);
  if (!stat.isFile() && !stat.isDirectory()) throw new Error(`Managed package source must be a regular file or directory: ${relativePath}.`);
  return source;
}

function collectCopyEntries(source, destination, force, destinationRoot, entries, plannedPaths, sourceLabel) {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`Managed package source must not contain symbolic links: ${sourceLabel}.`);
  const relative = path.relative(destinationRoot, destination).split(path.sep).join("/");
  resolveCanonicalContainedWrite(destinationRoot, relative, { label: "Install destination" });
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(source)) {
      collectCopyEntries(path.join(source, entry), path.join(destination, entry), force, destinationRoot, entries, plannedPaths, `${sourceLabel}/${entry}`);
    }
    return;
  }
  if (!stat.isFile()) throw new Error(`Managed package source must contain only regular files and directories: ${sourceLabel}.`);
  entries.push({ root: destinationRoot, relativePath: relative, content: fs.readFileSync(source), force, label: "Install destination" });
  plannedPaths.push({ root: destinationRoot, path: relative, operation: "write" });
}

function collectRetiredEntries(root, host, entries, plannedPaths) {
  for (const relativePath of RETIRED_MANAGED_PATHS[host] ?? []) {
    resolveCanonicalContainedWrite(root, relativePath, { label: "Retired managed path" });
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    const stat = fs.lstatSync(absolutePath);
    if (stat.isSymbolicLink()) throw new Error(`Retired managed path must not be a symbolic link: ${relativePath}.`);
    if (stat.isDirectory()) {
      const children = fs.readdirSync(absolutePath);
      if (children.length !== 1 || children[0] !== "SKILL.md") continue;
      const skillPath = `${relativePath}/SKILL.md`;
      if (!entries.some((entry) => entry.root === root && entry.relativePath === skillPath)) {
        entries.push({ root, relativePath: skillPath, delete: true, force: true, label: "Retired managed path" });
        plannedPaths.push({ root, path: skillPath, operation: "delete" });
      }
      entries.push({ root, relativePath, delete: true, deleteEmptyDirectory: true, force: true, label: "Retired managed directory" });
      plannedPaths.push({ root, path: relativePath, operation: "delete" });
      continue;
    }
    if (!stat.isFile()) throw new Error(`Retired managed path must be a regular file: ${relativePath}.`);
    if (entries.some((entry) => entry.root === root && entry.relativePath === relativePath)) continue;
    entries.push({ root, relativePath, delete: true, force: true, label: "Retired managed path" });
    plannedPaths.push({ root, path: relativePath, operation: "delete" });
  }
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameMcpServer(value, expected) {
  if (!plainObject(value)) return false;
  if (Object.keys(value).sort().join(",") !== "args,command,type") return false;
  return value.type === expected.type
    && value.command === expected.command
    && Array.isArray(value.args)
    && value.args.length === expected.args.length
    && value.args.every((item, index) => item === expected.args[index]);
}

function installedMcpServerKind(value) {
  return sameMcpServer(value, INSTALLED_DOVE_MCP_SERVER) ? "current" : null;
}

function prepareProjectMcpConfig(target) {
  const resolved = resolveCanonicalContainedWrite(target, DOVE_MCP_CONFIG_PATH, { label: "Claude project MCP configuration" });
  const absolutePath = resolved.fullPath;
  let config = {};
  if (fs.existsSync(absolutePath)) {
    const stat = fs.lstatSync(absolutePath);
    if (stat.isSymbolicLink()) throw new Error(`${DOVE_MCP_CONFIG_PATH} must not be a symbolic link.`);
    if (!stat.isFile()) throw new Error(`${DOVE_MCP_CONFIG_PATH} must be absent or a regular file.`);
    config = parseJsonWithoutDuplicateKeys(
      fs.readFileSync(absolutePath, "utf8"),
      DOVE_MCP_CONFIG_PATH
    );
    if (!plainObject(config)) throw new Error(`${DOVE_MCP_CONFIG_PATH} must contain a JSON object.`);
  }
  const servers = config.mcpServers;
  if (servers !== undefined && !plainObject(servers)) throw new Error(`${DOVE_MCP_CONFIG_PATH} mcpServers must be a JSON object.`);
  const existing = servers?.[DOVE_MCP_SERVER_NAME];
  if (existing !== undefined) {
    const kind = installedMcpServerKind(existing);
    if (kind === null) throw new Error(`${DOVE_MCP_CONFIG_PATH} already defines a conflicting Dove MCP server.`);
    if (kind === "current") return { healthy: true, status: "configured", write: null };
  }
  const merged = {
    ...config,
    mcpServers: {
      ...(servers ?? {}),
      [DOVE_MCP_SERVER_NAME]: INSTALLED_DOVE_MCP_SERVER
    }
  };
  return { healthy: true, status: "missing-dove-server", write: `${JSON.stringify(merged, null, 2)}\n` };
}

function inspectProjectMcpConfig(target) {
  try {
    const prepared = prepareProjectMcpConfig(target);
    return prepared.write === null
      ? { healthy: true, status: "registered" }
      : { healthy: false, status: prepared.status, message: `${DOVE_MCP_CONFIG_PATH} does not register the Dove MCP server.` };
  } catch (error) {
    return { healthy: false, status: "invalid", message: error instanceof Error ? error.message : String(error) };
  }
}

function installOrSync(target, args) {
  const hosts = hostIds(args);
  const projectHosts = hosts.filter((host) => Object.hasOwn(HOST_ADAPTERS, host));
  const corePaths = [...CORE_INSTALL_PATHS];
  const hostPaths = projectHosts.flatMap((host) => HOST_ADAPTERS[host].paths.map((relativePath) => ({ host, relativePath })));
  const force = args.includes("--force");
  const entries = [];
  const plannedPaths = [];
  const managedSources = new Map(
    [...corePaths, ...hostPaths.map(({ relativePath }) => relativePath)]
      .map((relativePath) => [relativePath, requireManagedPackageSource(relativePath)])
  );
  for (const relativePath of corePaths) {
    collectCopyEntries(managedSources.get(relativePath), path.join(target, relativePath), force, target, entries, plannedPaths, relativePath);
  }
  for (const { relativePath } of hostPaths) {
    collectCopyEntries(managedSources.get(relativePath), path.join(target, relativePath), force, target, entries, plannedPaths, relativePath);
  }
  for (const host of projectHosts) collectRetiredEntries(target, host, entries, plannedPaths);
  let claudeConfigRoot = null;
  const claudeEntries = generatedClaudeUserCommandEntries();
  if (hosts.some((host) => USER_HOST_IDS.includes(host))) {
    const mcpConfig = prepareProjectMcpConfig(target);
    if (mcpConfig.write !== null) {
      entries.push({ root: target, relativePath: DOVE_MCP_CONFIG_PATH, content: mcpConfig.write, encoding: "utf8", force: true, label: "Claude project MCP configuration" });
      plannedPaths.push({ root: target, path: DOVE_MCP_CONFIG_PATH, operation: "write" });
    }
    entries.push({ root: target, relativePath: DOVE_CLAUDE_PROJECT_MARKER_PATH, content: `${JSON.stringify(DOVE_CLAUDE_PROJECT_MARKER, null, 2)}\n`, encoding: "utf8", force: true, label: "Claude project installation marker" });
    plannedPaths.push({ root: target, path: DOVE_CLAUDE_PROJECT_MARKER_PATH, operation: "write" });
    claudeConfigRoot = resolveClaudeConfigRoot();
    for (const entry of claudeEntries) {
      entries.push({ root: claudeConfigRoot, relativePath: entry.relativePath, content: `${entry.content.trimEnd()}\n`, encoding: "utf8", force: true, label: "Claude command adapter path" });
      plannedPaths.push({ root: claudeConfigRoot, path: entry.relativePath, operation: "write" });
    }
    collectRetiredEntries(claudeConfigRoot, "claude", entries, plannedPaths);
  }
  const transaction = writeFileSetTransaction(entries);
  const written = new Set(transaction.writtenPaths);
  const removed = new Set(transaction.removedPaths);
  const removedPaths = plannedPaths.filter((entry) => entry.operation === "delete" && removed.has(entry.path));
  const writtenPaths = plannedPaths.filter((entry) => entry.operation === "write" && written.has(entry.path));
  const skippedPaths = plannedPaths.filter((entry) => entry.operation === "write" && !written.has(entry.path));
  const copiedUserHostPaths = claudeConfigRoot
    ? claudeEntries.filter((entry) => written.has(entry.relativePath)).map((entry) => ({ host: "claude", path: entry.relativePath, root: claudeConfigRoot }))
    : [];
  return {
    target,
    hosts,
    force,
    copiedCorePaths: corePaths,
    copiedHostPaths: hostPaths.map(({ host, relativePath }) => ({ host, path: relativePath })),
    copiedUserHostPaths,
    plannedPaths,
    writtenPaths,
    skippedPaths,
    removedPaths,
    transactionState: transaction.transactionState
  };
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function expectedProjectHostContent(host) {
  return new Map([
    ...generatedAdapterEntries().filter((entry) => entry.hostId === host).map((entry) => [entry.relativePath, `${entry.content.trimEnd()}\n`]),
    ...(host === "opencode" ? OPENCODE_ROLE_SKILL_PATHS.map((relativePath) => [relativePath, fs.readFileSync(path.join(PACKAGE_ROOT, relativePath))]) : []),
    ...(host === "opencode" ? [[".opencode.json", fs.readFileSync(path.join(PACKAGE_ROOT, ".opencode.json"))]] : []),
    ...(host === "agents" ? [["AGENTS.md", fs.readFileSync(path.join(PACKAGE_ROOT, "AGENTS.md"))]] : [])
  ]);
}

function fileMatchesExpected(absolutePath, expectedContent) {
  if (!fs.existsSync(absolutePath)) return false;
  const stat = fs.lstatSync(absolutePath);
  return stat.isFile() && !stat.isSymbolicLink() && sha256(fs.readFileSync(absolutePath)) === sha256(expectedContent);
}

function claudeCommandPaths() {
  return COMMAND_SURFACES.map((surface) => path.join(resolveClaudeConfigRoot(), "commands", "dove", `${surface.id.replace(/^dove\./u, "").replace(/\./gu, "-")}.md`));
}

function matchesClaudeProjectMarker(target) {
  const absolutePath = path.join(target, DOVE_CLAUDE_PROJECT_MARKER_PATH);
  if (!fs.existsSync(absolutePath)) return false;
  const stat = fs.lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) return false;
  try {
    const marker = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    return plainObject(marker)
      && Object.keys(marker).sort().join(",") === "host,version"
      && marker.version === DOVE_CLAUDE_PROJECT_MARKER.version
      && marker.host === DOVE_CLAUDE_PROJECT_MARKER.host;
  } catch {
    return false;
  }
}

function detectHosts(target, { includeClaude = false } = {}) {
  const result = Object.entries(HOST_ADAPTERS).filter(([, adapter]) => adapter.paths.some((relativePath) => fs.existsSync(path.join(target, relativePath)))).map(([host]) => host);
  if (includeClaude && (matchesClaudeProjectMarker(target) || fs.existsSync(path.join(target, DOVE_MCP_CONFIG_PATH)))) result.push("claude");
  return result;
}

function stripAnsi(value) {
  return String(value ?? "").replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, "");
}

function parseClaudeMcpStatus(output) {
  const statusLines = stripAnsi(output).replaceAll("\r\n", "\n").split("\n").filter((line) => /^\s*Status\s*:/iu.test(line));
  if (statusLines.length !== 1) return "unknown";
  const value = statusLines[0].replace(/^\s*Status\s*:\s*/iu, "").trim();
  if (/Pending approval/iu.test(value)) return "pending-approval";
  if (/Failed to connect/iu.test(value)) return "failed";
  if (/Connected/iu.test(value)) return "connected";
  return "unknown";
}

function inspectClaudeMcpConnection(target) {
  const command = process.env.DOVE_CLAUDE_COMMAND || "claude";
  const result = spawnSync(command, ["mcp", "get", DOVE_MCP_SERVER_NAME], {
    cwd: target,
    encoding: "utf8",
    shell: false,
    timeout: 15000,
    maxBuffer: 1024 * 1024
  });
  if (result.error?.code === "ENOENT") return { state: "unavailable", message: "Claude Code is unavailable, so project MCP approval and connection cannot be observed." };
  if (result.error?.code === "ETIMEDOUT") return { state: "unavailable", message: "Claude Code MCP status timed out." };
  const state = parseClaudeMcpStatus(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  if (state !== "unknown") return { state, message: state === "pending-approval" ? "Dove is registered but awaits approval in a normal Claude Code project session." : state === "failed" ? "Claude Code reports that the Dove MCP server failed to connect." : null };
  return { state: "unknown", message: "Claude Code did not return one recognized Dove MCP Status line." };
}

function runInstalledMcpProbe(target) {
  const relativePath = "scripts/doctor-mcp-probe-package.mjs";
  const probePath = path.join(target, relativePath);
  if (!fs.existsSync(probePath)) {
    return { ok: false, state: "missing", message: `Installed MCP probe is missing: ${relativePath}.` };
  }
  const probeStat = fs.lstatSync(probePath);
  if (!probeStat.isFile() || probeStat.isSymbolicLink()) {
    return { ok: false, state: "invalid", message: `Installed MCP probe must be a regular file: ${relativePath}.` };
  }
  const result = spawnSync(process.execPath, [probePath, target], {
    cwd: target,
    encoding: "utf8",
    shell: false,
    timeout: 30000,
    maxBuffer: 1024 * 1024
  });
  if (result.error?.code === "ETIMEDOUT") return { ok: false, state: "timeout", message: "Installed MCP package probe timed out." };
  if (result.status !== 0) return { ok: false, state: "failed", message: "Installed MCP package probe failed." };
  const lines = String(result.stdout ?? "").trim().split("\n").filter(Boolean);
  if (lines.length !== 1) return { ok: false, state: "invalid-result", message: "Installed MCP package probe did not return one structured result." };
  let payload;
  try {
    payload = JSON.parse(lines[0]);
  } catch {
    return { ok: false, state: "invalid-result", message: "Installed MCP package probe returned invalid JSON." };
  }
  const ok = payload?.ok === true
    && payload.toolCount === 28
    && payload.hasCreateDoveMission === true
    && payload.elicitationCount === 1
    && payload.checkpointStatus === "declined"
    && payload.zeroWrite === true;
  return ok ? { ok: true, state: "passed", ...payload } : { ok: false, state: "invalid-result", message: "Installed MCP package probe returned an incomplete success result." };
}

function doctor(target) {
  const installedHosts = detectHosts(target, { includeClaude: true });
  const missing = [];
  const drifted = [];
  const checks = [];
  for (const host of installedHosts) {
    if (host === "claude") {
      const mcpConfig = inspectProjectMcpConfig(target);
      const expected = new Map(generatedClaudeUserCommandEntries().map((entry) => [entry.relativePath, `${entry.content.trimEnd()}\n`]));
      const requiredPaths = [DOVE_MCP_CONFIG_PATH, DOVE_CLAUDE_PROJECT_MARKER_PATH, ...expected.keys()];
      if (!fs.existsSync(path.join(target, DOVE_MCP_CONFIG_PATH))) missing.push(DOVE_MCP_CONFIG_PATH);
      else if (!mcpConfig.healthy) drifted.push(DOVE_MCP_CONFIG_PATH);
      if (!fs.existsSync(path.join(target, DOVE_CLAUDE_PROJECT_MARKER_PATH))) missing.push(DOVE_CLAUDE_PROJECT_MARKER_PATH);
      else if (!matchesClaudeProjectMarker(target)) drifted.push(DOVE_CLAUDE_PROJECT_MARKER_PATH);
      for (const [relativePath, content] of expected) {
        const absolutePath = path.join(resolveClaudeConfigRoot(), relativePath);
        if (!fs.existsSync(absolutePath)) missing.push(relativePath);
        else if (!fileMatchesExpected(absolutePath, content)) drifted.push(relativePath);
      }
      const registrationOk = mcpConfig.healthy && requiredPaths.every((relativePath) => !missing.includes(relativePath) && !drifted.includes(relativePath));
      checks.push({ check: "host-adapter:claude", ok: registrationOk, requiredPaths, message: mcpConfig.message ?? null });
      checks.push({ check: "claude-mcp-registration", ok: mcpConfig.healthy, state: mcpConfig.healthy ? "registered" : mcpConfig.status, message: mcpConfig.message ?? null });
      const connection = mcpConfig.healthy ? inspectClaudeMcpConnection(target) : { state: "blocked", message: "Claude MCP connection cannot be checked until project registration is current." };
      checks.push({ check: "claude-mcp-status", ok: connection.state === "connected", state: connection.state, message: connection.message });
      continue;
    }
    const expected = expectedProjectHostContent(host);
    const requiredPaths = HOST_ADAPTERS[host]?.requiredPaths ?? [];
    for (const relativePath of requiredPaths) {
      const absolutePath = path.join(target, relativePath);
      if (!fs.existsSync(absolutePath)) missing.push(relativePath);
      else if (!fileMatchesExpected(absolutePath, expected.get(relativePath))) drifted.push(relativePath);
    }
    checks.push({ check: `host-adapter:${host}`, ok: requiredPaths.every((relativePath) => !missing.includes(relativePath) && !drifted.includes(relativePath)), requiredPaths });
  }
  const runtimePath = "mcp/dove-state-server-package.mjs";
  if (installedHosts.length > 0 && !fs.existsSync(path.join(target, runtimePath))) missing.push(runtimePath);
  if (installedHosts.length > 0) {
    const claudeStatus = checks.find((check) => check.check === "claude-mcp-status")?.state;
    const probe = installedHosts.includes("claude") && claudeStatus !== "connected"
      ? { ok: false, state: "blocked", message: "The package probe was not started because Claude Code has not reported the project MCP server as connected." }
      : runInstalledMcpProbe(target);
    checks.push({ check: "runtime:mcp-package-probe", ...probe });
  }
  const workspace = inspectDoveWorkspace(target);
  const workspaceOk = workspace.state === "absent" ? installedHosts.length > 0 && missing.length === 0 : workspace.healthy;
  checks.push({ check: "workspace-schema", ok: workspaceOk, message: workspace.state === "absent" ? "Dove runtime is installed and .dove is absent; initialize explicitly when needed." : workspace.healthy ? `Current Dove schema ${workspace.schemaVersion} is healthy.` : `${workspace.state}${workspace.error ? `: ${workspace.error}` : ""}; run dove init --archive-reset and confirm the exact proposal.` });
  const result = { target, node: process.version, healthy: missing.length === 0 && drifted.length === 0 && checks.every((check) => check.ok), workspaceMode: workspace.state === "absent" ? "runtime-only" : workspace.healthy ? "current-schema" : "archive-reset-required", workspaceSchema: { state: workspace.state, category: workspace.category, healthy: workspace.healthy, schemaVersion: workspace.schemaVersion, detectedSchema: workspace.detectedSchema, error: workspace.error ?? null, zeroWrite: true }, missing: [...new Set(missing)], drifted: [...new Set(drifted)], checks, warnings: [], hostAdapters: installedHosts, writes: [] };
  console.log(JSON.stringify(result, null, 2));
  return result.healthy ? 0 : 1;
}

function statusArgs(args) {
  const detail = optionalFlagValue(args, "--detail");
  if (detail !== undefined && !["compact", "full"].includes(detail)) throw new Error("--detail must be compact or full.");
  const language = optionalFlagValue(args, "--language");
  if (language !== undefined && !["zh", "en"].includes(language)) throw new Error("--language must be zh or en.");
  return definedObject({ missionId: optionalFlagValue(args, "--mission-id"), detail, language });
}

function wantsJson(args) {
  return args.includes("--json") || readFlagValue(args, "--format") === "json";
}

function printResult(result, args) {
  if (wantsJson(args)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result?.approval?.required === true) {
    console.log([
      result.approval.summary,
      "No files have been created or changed.",
      ...result.approval.effects.map((effect) => `- ${effect}`),
      result.approval.question
    ].join("\n"));
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
let sourceAction = "query";
if (command === "source" && ["query", "register", "verify"].includes(rawTarget)) {
  sourceAction = rawTarget;
  [rawTarget, ...extraPositionals] = extraPositionals;
}
let lessonsAction = "query";
if (command === "lessons" && ["query", "record"].includes(rawTarget)) {
  lessonsAction = rawTarget;
  [rawTarget, ...extraPositionals] = extraPositionals;
}
const invalidLessonsPositionals = command === "lessons" && extraPositionals.length > 0;
const invalidSourcePositionals = command === "source" && extraPositionals.length > 0;
const rawArgs = [...extraPositionals, ...parsed.args];
const selected = targetAndArgs(rawTarget, rawArgs);
const target = selected.target;
const args = selected.args;

try {
  if (invalidLessonsPositionals) throw new Error("dove lessons accepts only query or record followed by one target.");
  if (invalidSourcePositionals) throw new Error("dove source accepts only query, register, or verify followed by one target.");
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
  if (command === "source") {
    if (sourceAction === "query") result = querySources(target, sourceArgs(args, sourceAction));
    else result = runMutation(target, sourceAction === "verify" ? "verify-source" : "register-source", args, (clean) => sourceAction === "verify" ? verifySource(target, sourceArgs(clean, sourceAction)) : registerSource(target, sourceArgs(clean, sourceAction)));
  }
  if (command === "note") result = runMutation(target, "upsert-note", args, (clean) => upsertNote(target, definedObject({ missionId: optionalFlagValue(clean, "--mission-id"), noteId: optionalFlagValue(clean, "--note-id"), title: optionalFlagValue(clean, "--title"), summary: optionalFlagValue(clean, "--summary"), quotes: optionalFlagValues(clean, "--quote"), claims: optionalFlagValues(clean, "--claim"), openQuestions: optionalFlagValues(clean, "--open-question"), sourceIds: optionalFlagValues(clean, "--source-id"), artifactRefs: optionalFlagValues(clean, "--artifact") })));
  if (command === "draft") {
    const metadataOnly = args.includes("--metadata-only");
    result = runMutation(target, metadataOnly ? "upsert-draft-metadata" : "upsert-draft", args, (clean) => (metadataOnly ? upsertDraftMetadata : upsertDraft)(target, definedObject({ missionId: optionalFlagValue(clean, "--mission-id"), draftId: optionalFlagValue(clean, "--draft-id"), title: optionalFlagValue(clean, "--title"), body: optionalFlagValue(clean, "--body"), summary: optionalFlagValue(clean, "--summary"), evidenceRefs: optionalFlagValues(clean, "--evidence"), artifactRefs: optionalFlagValues(clean, "--artifact") })));
  }
  if (command === "experience") result = runMutation(target, "run-experience-workflow", args, (clean) => runExperienceWorkflow(target, definedObject({ missionId: optionalFlagValue(clean, "--mission-id"), experimentId: optionalFlagValue(clean, "--experiment-id"), title: optionalFlagValue(clean, "--title"), goal: optionalFlagValue(clean, "--goal"), hypothesis: optionalFlagValue(clean, "--hypothesis"), protocol: optionalFlagValue(clean, "--protocol"), successCriteria: optionalFlagValues(clean, "--success-criterion"), comparisonTargets: optionalFlagValues(clean, "--comparison-target"), result: optionalFlagValue(clean, "--result"), resultEvidenceRefs: optionalFlagValues(clean, "--result-evidence"), auditFindings: optionalFlagValues(clean, "--audit-finding"), integrityFlags: optionalFlagValues(clean, "--integrity-flag"), claimId: optionalFlagValue(clean, "--claim-id"), bridgeReason: optionalFlagValue(clean, "--bridge-reason") })));
  if (command === "figure") result = runMutation(target, "run-figure-workflow", args, (clean) => runFigureWorkflow(target, definedObject({ missionId: optionalFlagValue(clean, "--mission-id"), figureId: optionalFlagValue(clean, "--figure-id"), intent: optionalFlagValue(clean, "--intent"), purpose: optionalFlagValue(clean, "--purpose"), materials: optionalFlagValues(clean, "--material"), prompt: optionalFlagValue(clean, "--prompt"), outputPath: optionalFlagValue(clean, "--output-path"), outputSha256: optionalFlagValue(clean, "--output-sha256"), caption: optionalFlagValue(clean, "--caption"), qaFindings: optionalFlagValues(clean, "--qa-finding") })));
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
    const fromVersionId = optionalFlagValue(args, "--from-version-id");
    const toVersionId = optionalFlagValue(args, "--to-version-id");
    const comparing = fromVersionId !== undefined || toVersionId !== undefined;
    const input = comparing
      ? definedObject({ missionId: optionalFlagValue(args, "--mission-id"), fromVersionId, toVersionId })
      : definedObject({ missionId: optionalFlagValue(args, "--mission-id"), versionId: optionalFlagValue(args, "--version-id"), label: optionalFlagValue(args, "--label"), artifactRefs: optionalFlagValues(args, "--artifact"), supersedesVersionId: optionalFlagValue(args, "--supersedes-version-id") });
    result = comparing
      ? compareVersions(target, input)
      : runMutation(target, "create-version-snapshot", args, () => createVersionSnapshot(target, input));
  }
  printResult(result, args);
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (wantsJson(args)) console.log(JSON.stringify({ status: "blocked", message }, null, 2));
  else console.error(message);
  process.exit(1);
}
