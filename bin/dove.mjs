#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { discoverPaperArtifacts, ensureWorkspace, importIsolatedReview, launchDoveMission, prepareIsolatedReview, queryDoveAudit, queryDoveMission, queryDoveMissionBoard, queryDoveOrchestrate, queryDoveReturn, runAutonomyControlPlaneOnce, runAutonomyForeground, runAutonomyOperate, runIsolatedReview } from "../src/core/index.mjs";
import { toolDefinitions } from "../src/mcp/tool-definitions.mjs";
import { ARTIFACT_PATHS, GOVERNANCE_EXEMPT_MUTATIONS, GOVERNANCE_GUARDED_MUTATIONS, GOVERNANCE_NEGATIVE_COVERAGE, createDoveAuthorityManifest, normalizeDoveAuthorityManifest } from "../src/core/schema.mjs";
import {
  createWorkflowBoundaries,
  normalizeMetaExecutionBridgeCandidatesIndex,
  normalizeMetaGovernanceCoverageIndex,
  normalizeMetaLongHorizonMemory,
  normalizeMetaOperatorPlaybooksIndex,
  normalizeMetaOptimizerState,
  normalizeMetaRecommendationsIndex,
  normalizeWorkspaceIndex,
  normalizeWorkspaceMetaOptimize
} from "../src/core/schema.mjs";
import { CORE_INSTALL_PATHS, DEFAULT_HOST_ADAPTERS, HOST_ADAPTERS, HOST_IDS } from "../src/core/command-manifest.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const GLOBAL_COPY_EXCLUDE_NAMES = new Set([".git", "node_modules"]);
const GLOBAL_COPY_EXCLUDE_SUFFIXES = [".log", ".tmp", ".cache"];

function usage() {
  console.log(`dove

Usage:
  dove install [target] [--force] [--host <opencode|claude|codex|cursor|agents|all>]
  dove sync [target] [--force] [--host <opencode|claude|codex|cursor|agents|all>]
  dove doctor [target]
  dove onboard [target] [--write-map] [--max-depth <n>] [--max-files <n>]
  dove migrate [target] [--write-map] [--max-depth <n>] [--max-files <n>]
  dove orchestrate [target] [--request <text>] [--goal <text>] [--domain <id>] [--stage <id>] [--allow-autonomy]
  dove mission [target] [--goal <text>] [--domain <id>] [--stage <id>] [--artifact <path>] [--acceptance-check <text>]
  dove board [target] [--domain <id>] [--stage <id>] [--packet-id <id>|--mission-packet-id <id>] [--status <status>] [--include-archived]
  dove audit [target] [--scope <text>] [--goal <text>] [--domain <id>] [--stage <id>] [--changed-file <path>] [--test-evidence <path>] [--validation-output <path>]
  dove return [target] [--goal <text>] [--domain <id>] [--stage <id>] [--changed-file <path>] [--test-evidence <path>] [--validation-output <path>]
  dove launch [target] --source-type <type> --source-id <id> --execute-by <iso> --review-after <iso> [--mission-packet-id <id>] [--goal <text>] [--domain <id>] [--stage <id>]
  dove isolated-review [target] --reviewer-command <cmd> [--scope <text>] [--run-id <id>] [--instructions <text>]
  dove isolated-review-prepare [target] [--scope <text>] [--run-id <id>] [--instructions <text>]
  dove isolated-review-import [target] --run-id <id>
  dove autonomy-once [target] [--actor-role <role>]
  dove autonomy-foreground [target] [--actor-role <role>] [--max-steps <n>] [--packet-id <id>] [--program-run-id <id>] [--approval-id <id>]
  dove autonomy-operate [target] [--objective <text> | --source-type <type> --source-id <id>] [--actor-role <role>] [--worker-role <role>] [--max-steps <n>]
`);
}

function readFlagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) {
    return null;
  }
  return args[index + 1];
}

function readFlagValues(args, flags) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (flags.includes(args[index]) && index + 1 < args.length) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

function parseCommandArgs(command) {
  const input = String(command ?? "").trim();
  if (!input) {
    return [];
  }
  const args = [];
  let current = "";
  let quote = null;
  let escaping = false;
  for (const char of input) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (quote) {
    throw new Error("Reviewer command has an unterminated quote");
  }
  if (escaping) {
    current += "\\";
  }
  if (current) {
    args.push(current);
  }
  return args;
}

function resolveHostAdapters(args = []) {
  const rawValues = readFlagValues(args, ["--host", "--platform"]);
  if (rawValues.length === 0) {
    return DEFAULT_HOST_ADAPTERS;
  }
  const requested = rawValues.flatMap((value) => String(value).split(",").map((item) => item.trim()).filter(Boolean));
  if (requested.includes("all")) {
    return HOST_IDS;
  }
  const invalid = requested.filter((host) => !Object.hasOwn(HOST_ADAPTERS, host));
  if (invalid.length > 0) {
    throw new Error(`Unknown host adapter(s): ${invalid.join(", ")}. Available adapters: ${HOST_IDS.join(", ")}, all.`);
  }
  return Array.from(new Set(requested));
}

function resolveTarget(rawTarget) {
  return path.resolve(process.cwd(), rawTarget || ".");
}

function resolveOptionalTargetAndRest(rawTarget, rest = []) {
  if (!rawTarget || String(rawTarget).startsWith("--")) {
    return {
      target: resolveTarget("."),
      rest: rawTarget ? [rawTarget, ...rest] : rest
    };
  }
  return {
    target: resolveTarget(rawTarget),
    rest
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function shouldSkipCopy(relativePath) {
  const basename = path.basename(relativePath);
  if (GLOBAL_COPY_EXCLUDE_NAMES.has(basename)) {
    return true;
  }
  if (basename === "settings.local.json" || basename.endsWith(".local.json")) {
    return true;
  }
  if (basename === ".env" || basename.startsWith(".env.")) {
    return true;
  }
  return GLOBAL_COPY_EXCLUDE_SUFFIXES.some((suffix) => basename.endsWith(suffix));
}

function copyRecursive(source, destination, force, sourceRoot = source, skipped = []) {
  const relativePath = path.relative(sourceRoot, source).split(path.sep).join("/");
  const comparablePath = relativePath || path.basename(source);
  if (shouldSkipCopy(comparablePath)) {
    skipped.push(comparablePath);
    return;
  }

  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    ensureDir(destination);
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(destination, entry), force, sourceRoot, skipped);
    }
    return;
  }

  ensureDir(path.dirname(destination));
  if (fs.existsSync(destination) && !force) {
    return;
  }
  fs.copyFileSync(source, destination);
}

function buildInstallPaths(hosts) {
  const hostPaths = hosts.flatMap((host) => HOST_ADAPTERS[host].paths.map((relativePath) => ({ host, relativePath })));
  return {
    corePaths: CORE_INSTALL_PATHS,
    hostPaths,
    allPaths: [...CORE_INSTALL_PATHS, ...hostPaths.map((item) => item.relativePath)]
  };
}

function collectRepeatedFlagValues(args, flag) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && index + 1 < args.length) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

function readFirstFlagValue(args, flags) {
  for (const flag of flags) {
    const value = readFlagValue(args, flag);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function buildDoveMissionArgs(rest = []) {
  return {
    goal: readFlagValue(rest, "--goal"),
    domain: readFirstFlagValue(rest, ["--domain", "--dove-domain", "--mission-domain"]),
    stage: readFirstFlagValue(rest, ["--stage", "--mission-stage"]),
    targetArtifacts: readFlagValues(rest, ["--artifact", "--target-artifact", "--artifact-path", "--target"]),
    acceptanceChecks: readFlagValues(rest, ["--acceptance-check", "--check"]),
    nextCommand: readFlagValue(rest, "--next-command")
  };
}

function buildDoveOrchestrateArgs(rest = []) {
  return {
    ...buildDoveMissionArgs(rest),
    request: readFlagValue(rest, "--request"),
    userRequest: readFlagValue(rest, "--user-request"),
    allowAutonomy: rest.includes("--allow-autonomy")
  };
}

function buildDoveReturnArgs(rest = []) {
  return {
    ...buildDoveMissionArgs(rest),
    scope: readFlagValue(rest, "--scope"),
    validationEvidencePaths: readFlagValues(rest, ["--validation-evidence", "--validation-evidence-path", "--evidence", "--evidence-path"]),
    changedFilePaths: readFlagValues(rest, ["--changed-file", "--changed-file-path", "--changed-path"]),
    testEvidencePaths: readFlagValues(rest, ["--test-evidence", "--test-evidence-path", "--test-path"]),
    validationOutputPaths: readFlagValues(rest, ["--validation-output", "--validation-output-path", "--validation-log", "--test-output"]),
    validationOutputs: readFlagValues(rest, ["--validation-output-text", "--test-output-text"]),
    reviewEvidencePaths: readFlagValues(rest, ["--review-evidence", "--review-evidence-path"])
  };
}

function buildDoveBoardArgs(rest = []) {
  return {
    domain: readFirstFlagValue(rest, ["--domain", "--dove-domain", "--mission-domain"]),
    stage: readFirstFlagValue(rest, ["--stage", "--mission-stage"]),
    packetIds: readFlagValues(rest, ["--packet-id", "--packet", "--mission-packet-id", "--mission-packet"]),
    statuses: readFlagValues(rest, ["--status", "--lifecycle-status"]),
    includeArchived: rest.includes("--include-archived")
  };
}

function buildDoveAuditArgs(rest = []) {
  return buildDoveReturnArgs(rest);
}

function buildDoveLaunchArgs(rest = []) {
  return {
    ...buildDoveMissionArgs(rest),
    sourceType: readFlagValue(rest, "--source-type"),
    sourceId: readFlagValue(rest, "--source-id"),
    actorRole: readFlagValue(rest, "--actor-role"),
    workerRole: readFlagValue(rest, "--worker-role"),
    doveWorkerRole: readFlagValue(rest, "--dove-worker-role"),
    packetId: readFirstFlagValue(rest, ["--packet-id", "--mission-packet-id"]),
    missionPacketId: readFlagValue(rest, "--mission-packet-id"),
    followThroughId: readFlagValue(rest, "--follow-through-id"),
    selectedConversionPathKey: readFlagValue(rest, "--conversion-path"),
    title: readFlagValue(rest, "--title"),
    summary: readFlagValue(rest, "--summary"),
    assignedRole: readFlagValue(rest, "--assigned-role"),
    lifecycleStatus: readFlagValue(rest, "--lifecycle-status"),
    currentFocus: readFlagValue(rest, "--current-focus"),
    nextAction: readFlagValue(rest, "--next-action"),
    dependencies: readFlagValues(rest, ["--dependency"]),
    evidenceLinks: readFlagValues(rest, ["--evidence", "--evidence-link"]),
    outputPaths: readFlagValues(rest, ["--output", "--output-path"]),
    programId: readFlagValue(rest, "--program-id"),
    programRunId: readFlagValue(rest, "--program-run-id"),
    approvalId: readFlagValue(rest, "--approval-id"),
    allowedStepType: readFlagValue(rest, "--allowed-step-type"),
    decisionSummary: readFlagValue(rest, "--decision-summary"),
    rationale: readFlagValue(rest, "--rationale"),
    executeBy: readFlagValue(rest, "--execute-by"),
    reviewAfter: readFlagValue(rest, "--review-after")
  };
}

function buildIsolatedReviewArgs(rest = []) {
  return {
    runId: readFlagValue(rest, "--run-id"),
    scope: readFlagValue(rest, "--scope"),
    instructions: readFlagValue(rest, "--instructions"),
    mediatorRole: readFlagValue(rest, "--mediator-role"),
    reviewerRole: readFlagValue(rest, "--reviewer-role"),
    reviewedArtifactPaths: collectRepeatedFlagValues(rest, "--artifact")
  };
}

function buildOnboardingArgs(rest = []) {
  return {
    writeMap: rest.includes("--write-map"),
    maxDepth: readFlagValue(rest, "--max-depth"),
    maxFiles: readFlagValue(rest, "--max-files"),
    excludeDirs: collectRepeatedFlagValues(rest, "--exclude-dir")
  };
}

function invokeIsolatedReviewer(reviewerCommand, prepared, target) {
  const commandArgs = parseCommandArgs(reviewerCommand);
  if (commandArgs.length === 0) {
    throw new Error("isolated-review requires --reviewer-command or DOVE_ISOLATED_REVIEWER_COMMAND");
  }
  const [executable, ...baseArgs] = commandArgs;
  const reviewer = spawnSync(executable, [
    ...baseArgs,
    "--input", prepared.inputPath,
    "--handoff", prepared.handoffPath,
    "--report", prepared.reportPath,
    "--run-id", prepared.runId
  ], {
    cwd: target,
    encoding: "utf8",
    env: {
      ...process.env,
      DOVE_ISOLATED_REVIEW_INPUT: prepared.inputPath,
      DOVE_ISOLATED_REVIEW_HANDOFF: prepared.handoffPath,
      DOVE_ISOLATED_REVIEW_REPORT: prepared.reportPath,
      DOVE_ISOLATED_REVIEW_RUN_ID: prepared.runId,
      DOVE_ISOLATED_REVIEW_INPUT_SHA256: prepared.inputSha256
    }
  });
  if (reviewer.error) {
    throw reviewer.error;
  }
  if (reviewer.status !== 0) {
    throw new Error(`isolated reviewer command failed with exit ${reviewer.status}: ${reviewer.stderr || reviewer.stdout || "no output"}`);
  }
  return {
    status: reviewer.status,
    stdout: reviewer.stdout,
    stderr: reviewer.stderr
  };
}

function installOrSync(target, force, args = []) {
  const hosts = resolveHostAdapters(args);
  const boundaries = createWorkflowBoundaries();
  const installPaths = buildInstallPaths(hosts);
  const disallowedCopies = installPaths.allPaths.filter((relativePath) => boundaries.userOwnedPaths.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`)));
  if (disallowedCopies.length > 0) {
    throw new Error(`Refusing to manage user-owned paths: ${disallowedCopies.join(", ")}`);
  }
  const skippedUnsafePaths = [];
  const copiedCorePaths = [];
  const copiedHostPaths = [];

  for (const relativePath of installPaths.corePaths) {
    const source = path.join(PACKAGE_ROOT, relativePath);
    if (!fs.existsSync(source)) {
      continue;
    }
    copyRecursive(source, path.join(target, relativePath), force, source, skippedUnsafePaths);
    copiedCorePaths.push(relativePath);
  }

  for (const { host, relativePath } of installPaths.hostPaths) {
    const source = path.join(PACKAGE_ROOT, relativePath);
    if (!fs.existsSync(source)) {
      continue;
    }
    copyRecursive(source, path.join(target, relativePath), force, source, skippedUnsafePaths);
    copiedHostPaths.push({ host, path: relativePath });
  }

  ensureWorkspace(target);
  const copied = [...copiedCorePaths, ...copiedHostPaths.map((item) => item.path), ".dove/* (bootstrap only, user-owned state preserved)"];
  return {
    target,
    copied,
    copiedCorePaths,
    copiedHostPaths,
    skippedUnsafePaths: Array.from(new Set(skippedUnsafePaths)).sort(),
    hosts,
    force,
    boundaryPolicy: {
      managedPaths: boundaries.managedPaths,
      neutralCorePaths: boundaries.neutralCorePaths ?? CORE_INSTALL_PATHS,
      defaultHostAdapters: boundaries.defaultHostAdapters ?? DEFAULT_HOST_ADAPTERS,
      availableHostAdapters: boundaries.availableHostAdapters ?? HOST_IDS,
      doveBootstrapOnlyPaths: boundaries.doveBootstrapOnlyPaths.length,
      userOwnedPaths: boundaries.userOwnedPaths
    }
  };
}

function readJsonFile(target, relativePath) {
  const fullPath = path.join(target, relativePath);
  if (!fs.existsSync(fullPath)) {
    return { status: "missing", value: null, message: `${relativePath} is missing.` };
  }
  try {
    return { status: "ok", value: JSON.parse(fs.readFileSync(fullPath, "utf8")), message: "ok" };
  } catch (error) {
    return {
      status: "invalid",
      value: null,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function describeShape(value) {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function requireObject(value, label, issues) {
  if (!isPlainObject(value)) {
    issues.push(`${label} must be an object (found ${describeShape(value)})`);
    return null;
  }
  return value;
}

function requireArray(value, label, issues) {
  if (!Array.isArray(value)) {
    issues.push(`${label} must be an array (found ${describeShape(value)})`);
    return null;
  }
  return value;
}

function maybeObject(parent, key, label, issues) {
  if (!isPlainObject(parent) || !(key in parent) || parent[key] === undefined) {
    return null;
  }
  return requireObject(parent[key], label, issues);
}

function maybeArray(parent, key, label, issues) {
  if (!isPlainObject(parent) || !(key in parent) || parent[key] === undefined) {
    return null;
  }
  return requireArray(parent[key], label, issues);
}

function validateWikiRelationsShape(value) {
  const issues = [];
  const root = requireObject(value, ".dove/wiki/relations.json", issues);
  if (!root) {
    return issues;
  }
  maybeArray(root, "items", ".dove/wiki/relations.json.items", issues);
  const summary = maybeObject(root, "summary", ".dove/wiki/relations.json.summary", issues);
  const taxonomy = summary ? maybeObject(summary, "taxonomy", ".dove/wiki/relations.json.summary.taxonomy", issues) : null;
  if (taxonomy) {
    maybeArray(taxonomy, "families", ".dove/wiki/relations.json.summary.taxonomy.families", issues);
  }
  return issues;
}

function validateFigureQaShape(value) {
  const issues = [];
  const root = requireObject(value, ".dove/figures/qa.json", issues);
  if (!root) {
    return issues;
  }
  maybeArray(root, "items", ".dove/figures/qa.json.items", issues);
  maybeArray(root, "issues", ".dove/figures/qa.json.issues", issues);
  return issues;
}

function validateWorkspaceRepairFrontierShape(value) {
  const issues = [];
  const root = requireObject(value, ".dove/workspace/index.json", issues);
  if (!root) {
    return issues;
  }
  const repairFrontier = maybeObject(root, "repairFrontier", ".dove/workspace/index.json.repairFrontier", issues);
  if (repairFrontier) {
    maybeArray(repairFrontier, "prioritizedItems", ".dove/workspace/index.json.repairFrontier.prioritizedItems", issues);
    maybeArray(repairFrontier, "relationFamilySummaries", ".dove/workspace/index.json.repairFrontier.relationFamilySummaries", issues);
    maybeArray(repairFrontier, "relationGroupSummaries", ".dove/workspace/index.json.repairFrontier.relationGroupSummaries", issues);
    maybeArray(repairFrontier, "topDegradedGroupIds", ".dove/workspace/index.json.repairFrontier.topDegradedGroupIds", issues);
  }
  const dove = maybeObject(root, "dove", ".dove/workspace/index.json.dove", issues);
  if (dove) {
    maybeObject(dove, "identity", ".dove/workspace/index.json.dove.identity", issues);
    maybeObject(dove, "authorityManifest", ".dove/workspace/index.json.dove.authorityManifest", issues);
  }
  const metaOptimize = maybeObject(root, "metaOptimize", ".dove/workspace/index.json.metaOptimize", issues);
  if (metaOptimize) {
    maybeArray(metaOptimize, "topClusterIds", ".dove/workspace/index.json.metaOptimize.topClusterIds", issues);
    maybeArray(metaOptimize, "topRecommendationIds", ".dove/workspace/index.json.metaOptimize.topRecommendationIds", issues);
    maybeArray(metaOptimize, "topClusters", ".dove/workspace/index.json.metaOptimize.topClusters", issues);
    maybeArray(metaOptimize, "topTaxonomyFamilyIds", ".dove/workspace/index.json.metaOptimize.topTaxonomyFamilyIds", issues);
    maybeArray(metaOptimize, "topTaxonomyGroupIds", ".dove/workspace/index.json.metaOptimize.topTaxonomyGroupIds", issues);
    maybeArray(metaOptimize, "pressureAreas", ".dove/workspace/index.json.metaOptimize.pressureAreas", issues);
    const operatorPlaybooks = maybeObject(metaOptimize, "operatorPlaybooks", ".dove/workspace/index.json.metaOptimize.operatorPlaybooks", issues);
    if (operatorPlaybooks) {
      maybeArray(operatorPlaybooks, "topPlaybookIds", ".dove/workspace/index.json.metaOptimize.operatorPlaybooks.topPlaybookIds", issues);
      maybeArray(operatorPlaybooks, "topTaxonomyFamilyIds", ".dove/workspace/index.json.metaOptimize.operatorPlaybooks.topTaxonomyFamilyIds", issues);
    }
    const longHorizon = maybeObject(metaOptimize, "longHorizon", ".dove/workspace/index.json.metaOptimize.longHorizon", issues);
    if (longHorizon) {
      maybeArray(longHorizon, "topFamilyIds", ".dove/workspace/index.json.metaOptimize.longHorizon.topFamilyIds", issues);
      maybeArray(longHorizon, "topTaxonomyFamilyIds", ".dove/workspace/index.json.metaOptimize.longHorizon.topTaxonomyFamilyIds", issues);
      maybeArray(longHorizon, "topTaxonomyGroupIds", ".dove/workspace/index.json.metaOptimize.longHorizon.topTaxonomyGroupIds", issues);
      maybeArray(longHorizon, "pressureAreas", ".dove/workspace/index.json.metaOptimize.longHorizon.pressureAreas", issues);
    }
  }
  return issues;
}

function validateDoveAuthorityManifestShape(value) {
  const issues = [];
  const root = requireObject(value, ARTIFACT_PATHS.doveRootManifest, issues);
  if (!root) {
    return issues;
  }
  maybeObject(root, "dualRootInvariant", `${ARTIFACT_PATHS.doveRootManifest}.dualRootInvariant`, issues);
  maybeArray(root, "phases", `${ARTIFACT_PATHS.doveRootManifest}.phases`, issues);
  return issues;
}

function validateMetaRecommendationsShape(value) {
  const issues = [];
  const root = requireObject(value, ".dove/meta/recommendations.json", issues);
  if (!root) {
    return issues;
  }
  maybeArray(root, "items", ".dove/meta/recommendations.json.items", issues);
  maybeArray(root, "clusters", ".dove/meta/recommendations.json.clusters", issues);
  const ranking = maybeObject(root, "ranking", ".dove/meta/recommendations.json.ranking", issues);
  if (ranking) {
    maybeArray(ranking, "signals", ".dove/meta/recommendations.json.ranking.signals", issues);
    maybeArray(ranking, "tieBreakOrder", ".dove/meta/recommendations.json.ranking.tieBreakOrder", issues);
  }
  const frontier = maybeObject(root, "frontier", ".dove/meta/recommendations.json.frontier", issues);
  if (frontier) {
    maybeArray(frontier, "topClusterIds", ".dove/meta/recommendations.json.frontier.topClusterIds", issues);
    maybeArray(frontier, "topRecommendationIds", ".dove/meta/recommendations.json.frontier.topRecommendationIds", issues);
    maybeArray(frontier, "activeSignalTypes", ".dove/meta/recommendations.json.frontier.activeSignalTypes", issues);
    maybeArray(frontier, "topTaxonomyFamilyIds", ".dove/meta/recommendations.json.frontier.topTaxonomyFamilyIds", issues);
    maybeArray(frontier, "topTaxonomyGroupIds", ".dove/meta/recommendations.json.frontier.topTaxonomyGroupIds", issues);
    maybeArray(frontier, "pressureAreas", ".dove/meta/recommendations.json.frontier.pressureAreas", issues);
  }
  const summary = maybeObject(root, "summary", ".dove/meta/recommendations.json.summary", issues);
  if (summary) {
    maybeArray(summary, "signalTypes", ".dove/meta/recommendations.json.summary.signalTypes", issues);
    maybeArray(summary, "topClusterIds", ".dove/meta/recommendations.json.summary.topClusterIds", issues);
    maybeArray(summary, "topRecommendationIds", ".dove/meta/recommendations.json.summary.topRecommendationIds", issues);
    maybeArray(summary, "topTaxonomyFamilyIds", ".dove/meta/recommendations.json.summary.topTaxonomyFamilyIds", issues);
    maybeArray(summary, "topTaxonomyGroupIds", ".dove/meta/recommendations.json.summary.topTaxonomyGroupIds", issues);
    maybeArray(summary, "pressureAreas", ".dove/meta/recommendations.json.summary.pressureAreas", issues);
    maybeArray(summary, "topClusters", ".dove/meta/recommendations.json.summary.topClusters", issues);
  }
  return issues;
}

function validateMetaOptimizerStateShape(value) {
  const issues = [];
  const root = requireObject(value, ".dove/meta/optimizer-state.json", issues);
  if (!root) {
    return issues;
  }
  maybeArray(root, "sourceArtifacts", ".dove/meta/optimizer-state.json.sourceArtifacts", issues);
  const frontier = maybeObject(root, "frontier", ".dove/meta/optimizer-state.json.frontier", issues);
  if (frontier) {
    maybeArray(frontier, "activeSignalTypes", ".dove/meta/optimizer-state.json.frontier.activeSignalTypes", issues);
    maybeArray(frontier, "topClusterIds", ".dove/meta/optimizer-state.json.frontier.topClusterIds", issues);
    maybeArray(frontier, "topRecommendationIds", ".dove/meta/optimizer-state.json.frontier.topRecommendationIds", issues);
    maybeArray(frontier, "topClusters", ".dove/meta/optimizer-state.json.frontier.topClusters", issues);
    maybeArray(frontier, "topTaxonomyFamilyIds", ".dove/meta/optimizer-state.json.frontier.topTaxonomyFamilyIds", issues);
    maybeArray(frontier, "topTaxonomyGroupIds", ".dove/meta/optimizer-state.json.frontier.topTaxonomyGroupIds", issues);
    maybeArray(frontier, "pressureAreas", ".dove/meta/optimizer-state.json.frontier.pressureAreas", issues);
    maybeArray(frontier, "tieBreakOrder", ".dove/meta/optimizer-state.json.frontier.tieBreakOrder", issues);
  }
  maybeArray(root, "clusters", ".dove/meta/optimizer-state.json.clusters", issues);
  const operatorPlaybooks = maybeObject(root, "operatorPlaybooks", ".dove/meta/optimizer-state.json.operatorPlaybooks", issues);
  if (operatorPlaybooks) {
    maybeArray(operatorPlaybooks, "topPlaybookIds", ".dove/meta/optimizer-state.json.operatorPlaybooks.topPlaybookIds", issues);
    maybeArray(operatorPlaybooks, "topTaxonomyFamilyIds", ".dove/meta/optimizer-state.json.operatorPlaybooks.topTaxonomyFamilyIds", issues);
  }
  const longHorizon = maybeObject(root, "longHorizon", ".dove/meta/optimizer-state.json.longHorizon", issues);
  if (longHorizon) {
    maybeArray(longHorizon, "topFamilyIds", ".dove/meta/optimizer-state.json.longHorizon.topFamilyIds", issues);
    maybeArray(longHorizon, "topTaxonomyFamilyIds", ".dove/meta/optimizer-state.json.longHorizon.topTaxonomyFamilyIds", issues);
    maybeArray(longHorizon, "topTaxonomyGroupIds", ".dove/meta/optimizer-state.json.longHorizon.topTaxonomyGroupIds", issues);
    maybeArray(longHorizon, "pressureAreas", ".dove/meta/optimizer-state.json.longHorizon.pressureAreas", issues);
  }
  return issues;
}

function validateMetaLongHorizonShape(value) {
  const issues = [];
  const root = requireObject(value, ".dove/meta/long-horizon-memory.json", issues);
  if (!root) {
    return issues;
  }
  maybeObject(root, "horizon", ".dove/meta/long-horizon-memory.json.horizon", issues);
  const summary = maybeObject(root, "summary", ".dove/meta/long-horizon-memory.json.summary", issues);
  if (summary) {
    maybeArray(summary, "topFamilyIds", ".dove/meta/long-horizon-memory.json.summary.topFamilyIds", issues);
    maybeArray(summary, "topTaxonomyFamilyIds", ".dove/meta/long-horizon-memory.json.summary.topTaxonomyFamilyIds", issues);
    maybeArray(summary, "topTaxonomyGroupIds", ".dove/meta/long-horizon-memory.json.summary.topTaxonomyGroupIds", issues);
    maybeArray(summary, "pressureAreas", ".dove/meta/long-horizon-memory.json.summary.pressureAreas", issues);
  }
  maybeArray(root, "history", ".dove/meta/long-horizon-memory.json.history", issues);
  maybeArray(root, "families", ".dove/meta/long-horizon-memory.json.families", issues);
  return issues;
}

function validateMetaOperatorPlaybooksShape(value) {
  const issues = [];
  const root = requireObject(value, ".dove/meta/operator-playbooks.json", issues);
  if (!root) {
    return issues;
  }
  maybeArray(root, "playbooks", ".dove/meta/operator-playbooks.json.playbooks", issues);
  const summary = maybeObject(root, "summary", ".dove/meta/operator-playbooks.json.summary", issues);
  if (summary) {
    maybeArray(summary, "topPlaybookIds", ".dove/meta/operator-playbooks.json.summary.topPlaybookIds", issues);
    maybeArray(summary, "topTaxonomyFamilyIds", ".dove/meta/operator-playbooks.json.summary.topTaxonomyFamilyIds", issues);
  }
  return issues;
}

function validateMetaExecutionBridgeCandidatesShape(value) {
  const issues = [];
  const root = requireObject(value, ".dove/meta/execution-bridge-candidates.json", issues);
  if (!root) {
    return issues;
  }
  maybeArray(root, "candidates", ".dove/meta/execution-bridge-candidates.json.candidates", issues);
  const summary = maybeObject(root, "summary", ".dove/meta/execution-bridge-candidates.json.summary", issues);
  if (summary) {
    maybeArray(summary, "topCandidateIds", ".dove/meta/execution-bridge-candidates.json.summary.topCandidateIds", issues);
  }
  return issues;
}

function validateMetaGovernanceCoverageShape(value) {
  const issues = [];
  const root = requireObject(value, ".dove/meta/governance-coverage.json", issues);
  if (!root) {
    return issues;
  }
  maybeArray(root, "guardedMutations", ".dove/meta/governance-coverage.json.guardedMutations", issues);
  maybeArray(root, "exemptMutations", ".dove/meta/governance-coverage.json.exemptMutations", issues);
  return issues;
}

function validateMetaOperatorFollowThroughShape(value) {
  const issues = [];
  const root = requireObject(value, ".dove/meta/operator-follow-through.json", issues);
  if (!root) {
    return issues;
  }
  maybeArray(root, "items", ".dove/meta/operator-follow-through.json.items", issues);
  const summary = maybeObject(root, "summary", ".dove/meta/operator-follow-through.json.summary", issues);
  if (summary) {
    maybeArray(summary, "topSourceIds", ".dove/meta/operator-follow-through.json.summary.topSourceIds", issues);
  }
  return issues;
}

function validateMetaOperatorFollowThroughTransitionsShape(value) {
  const issues = [];
  const root = requireObject(value, ".dove/meta/operator-follow-through-transitions.json", issues);
  if (!root) {
    return issues;
  }
  maybeArray(root, "transitions", ".dove/meta/operator-follow-through-transitions.json.transitions", issues);
  return issues;
}

function inspectOperatorFollowThrough(target) {
  const ledger = readJsonFile(target, ".dove/meta/operator-follow-through.json");
  if (ledger.status !== "ok") {
    return {
      status: ledger.status === "missing" ? "ok" : "degraded",
      itemCount: 0,
      actionRequiredCount: 0,
      reasons: ledger.status === "missing" ? [] : [ledger.message],
      staleIds: [],
      dueDeferredIds: [],
      overdueExecutionIds: [],
      invalidStatusIds: [],
      missingTargetIds: []
    };
  }
  const items = Array.isArray(ledger.value?.items) ? ledger.value.items : [];
  const staleIds = items.filter((item) => item?.stale).map((item) => item.id);
  const dueDeferredIds = items.filter((item) => item?.dueDeferred).map((item) => item.id);
  const dueReviewIds = items.filter((item) => item?.dueReview).map((item) => item.id);
  const overdueExecutionIds = items.filter((item) => item?.overdueExecution).map((item) => item.id);
  const invalidStatusIds = items.filter((item) => item?.invalidStatus).map((item) => item.id);
  const missingTargetIds = items.filter((item) => item?.status === "accepted-for-execution" && (!item?.linkedTargetArtifact || !item?.linkedTargetId)).map((item) => item.id);
  const unresolvedTargetIds = items.filter((item) => {
    if (!["accepted-for-execution", "closed"].includes(item?.status)) {
      return false;
    }
    if (!item?.linkedTargetArtifact || !item?.linkedTargetId) {
      return false;
    }
    const targetPath = path.join(target, item.linkedTargetArtifact);
    if (!fs.existsSync(targetPath)) {
      return true;
    }
    const extension = path.extname(item.linkedTargetArtifact).toLowerCase();
    if (extension === ".json") {
      try {
        const value = JSON.parse(fs.readFileSync(targetPath, "utf8"));
        const queue = [value];
        while (queue.length > 0) {
          const current = queue.shift();
          if (current === item.linkedTargetId) {
            return false;
          }
          if (Array.isArray(current)) {
            queue.push(...current);
            continue;
          }
          if (current && typeof current === "object") {
            queue.push(...Object.values(current));
          }
        }
        return true;
      } catch {
        return true;
      }
    }
    return !fs.readFileSync(targetPath, "utf8").includes(String(item.linkedTargetId));
  }).map((item) => item.id);
  const reasons = [
    ...(staleIds.length > 0 ? [`stale follow-through: ${staleIds.join(", ")}`] : []),
    ...(dueDeferredIds.length > 0 ? [`due deferred follow-through: ${dueDeferredIds.join(", ")}`] : []),
    ...(dueReviewIds.length > 0 ? [`due review follow-through: ${dueReviewIds.join(", ")}`] : []),
    ...(overdueExecutionIds.length > 0 ? [`overdue execution follow-through: ${overdueExecutionIds.join(", ")}`] : []),
    ...(invalidStatusIds.length > 0 ? [`invalid follow-through status: ${invalidStatusIds.join(", ")}`] : []),
    ...(missingTargetIds.length > 0 ? [`accepted-for-execution missing target linkage: ${missingTargetIds.join(", ")}`] : []),
    ...(unresolvedTargetIds.length > 0 ? [`follow-through target not found in linked artifact: ${unresolvedTargetIds.join(", ")}`] : [])
  ];
  return {
    status: reasons.length === 0 ? "ok" : "degraded",
    itemCount: items.length,
    actionRequiredCount: staleIds.length + dueDeferredIds.length + dueReviewIds.length + overdueExecutionIds.length + invalidStatusIds.length + missingTargetIds.length + unresolvedTargetIds.length,
    reasons,
    staleIds,
    dueDeferredIds,
    dueReviewIds,
    overdueExecutionIds,
    invalidStatusIds,
    missingTargetIds,
    unresolvedTargetIds
  };
}

function inspectAutonomyRuntime(target) {
  const workspace = readJsonFile(target, ".dove/workspace/index.json");
  if (workspace.status !== "ok") {
    return {
      status: workspace.status === "missing" ? "ok" : "degraded",
      lastStatus: "never-run",
      lastOutcome: "not-started",
      requestCount: 0,
      checkpointCount: 0,
      escalationCount: 0,
      continuationCount: 0,
      currentContinuationKind: null,
      currentContinuationPacketId: null,
      currentContinuationProgramRunId: null,
      currentContinuationCommand: null,
      reasons: workspace.status === "missing" ? [] : [workspace.message]
    };
  }
  const runtime = workspace.value?.runtime ?? {};
  const reasons = [
    ...(runtime.lastStatus === "error" ? [`runtime last status is error (${runtime.lastOutcome ?? "unknown"})`] : []),
    ...((runtime.activeLeaseCount ?? 0) > 0 ? [`runtime still has ${runtime.activeLeaseCount} active lease(s)`] : []),
    ...((runtime.escalationCount ?? 0) > 0 ? [`runtime escalations recorded: ${runtime.escalationCount}`] : [])
  ];
  return {
    status: reasons.length === 0 ? "ok" : "degraded",
    lastStatus: runtime.lastStatus ?? "never-run",
    lastOutcome: runtime.lastOutcome ?? "not-started",
    lastEnvelopeWorkerRole: runtime.lastEnvelopeWorkerRole ?? null,
    requestCount: Number.isFinite(runtime.requestCount) ? runtime.requestCount : 0,
    checkpointCount: Number.isFinite(runtime.checkpointCount) ? runtime.checkpointCount : 0,
    escalationCount: Number.isFinite(runtime.escalationCount) ? runtime.escalationCount : 0,
    continuationCount: Number.isFinite(runtime.continuationCount) ? runtime.continuationCount : 0,
    currentContinuationKind: runtime.currentContinuationKind ?? null,
    currentContinuationPacketId: runtime.currentContinuationPacketId ?? null,
    currentContinuationProgramRunId: runtime.currentContinuationProgramRunId ?? null,
    currentContinuationCommand: runtime.currentContinuationCommand ?? null,
    lastCheckpointPacketId: runtime.lastCheckpointPacketId ?? null,
    lastEscalationPacketId: runtime.lastEscalationPacketId ?? null,
    reasons
  };
}

function inspectOnboardingArtifactMap(target) {
  const proposal = discoverPaperArtifacts(target, { maxFiles: 1000 });
  const mapPath = ARTIFACT_PATHS.workspaceArtifactMap;
  const mapExists = fs.existsSync(path.join(target, mapPath));
  const likelyPaperAssets = proposal.summary.mappingCount;
  const reasons = [
    !mapExists && likelyPaperAssets > 0 ? `likely paper assets detected without artifact map: ${likelyPaperAssets}` : null,
    ...proposal.conflicts.map((conflict) => `${conflict.type}: ${conflict.sourcePaths.join(", ")}`),
    ...proposal.warnings
  ].filter(Boolean);
  return {
    status: reasons.length === 0 ? "ok" : "needs-mapping",
    mapPath,
    mapExists,
    mappingCount: proposal.summary.mappingCount,
    unmappedCount: proposal.summary.unmappedCount,
    conflictCount: proposal.summary.conflictCount,
    manuscriptCount: proposal.summary.manuscriptCount,
    bibliographyCount: proposal.summary.bibliographyCount,
    proposalOnly: true,
    noAutoApply: true,
    reasons
  };
}

function inspectProgramsSurface(target) {
  const workspace = readJsonFile(target, ".dove/workspace/index.json");
  if (workspace.status !== "ok") {
    return {
      status: workspace.status === "missing" ? "ok" : "degraded",
      programCount: 0,
      approvedRunCount: 0,
      reasons: workspace.status === "missing" ? [] : [workspace.message]
    };
  }
  const programs = workspace.value?.programs ?? {};
  return {
    status: "ok",
    programCount: Number.isFinite(programs.programCount) ? programs.programCount : 0,
    approvedRunCount: Number.isFinite(programs.approvedRunCount) ? programs.approvedRunCount : 0,
    reviewCheckpointRunCount: Number.isFinite(programs.reviewCheckpointRunCount) ? programs.reviewCheckpointRunCount : 0,
    consumedApprovalCount: Number.isFinite(programs.consumedApprovalCount) ? programs.consumedApprovalCount : 0,
    currentProgramId: programs.currentProgramId ?? null,
    currentProgramRunId: programs.currentProgramRunId ?? null,
    currentApprovalId: programs.currentApprovalId ?? null,
    currentReviewCheckpointRunId: programs.currentReviewCheckpointRunId ?? null,
    reasons: []
  };
}

function inspectDoveAuthority(target) {
  const manifest = readJsonFile(target, ARTIFACT_PATHS.doveRootManifest);
  if (manifest.status !== "ok") {
    return {
      status: "degraded",
      activeDurableRoot: ARTIFACT_PATHS.doveRoot,
      authoritativeRoot: ARTIFACT_PATHS.doveRoot,
      currentWriteAuthority: ARTIFACT_PATHS.doveRoot,
      manifestPath: ARTIFACT_PATHS.doveRootManifest,
      staleLegacyArtifacts: [],
      reasons: [manifest.message]
    };
  }

  const normalized = normalizeDoveAuthorityManifest(manifest.value, createDoveAuthorityManifest());
  const reasons = [];
  if (normalized.status !== "authoritative") {
    reasons.push("Dove manifest status must be authoritative");
  }
  if (normalized.strategy !== "dove-direct") {
    reasons.push("Dove manifest strategy must be dove-direct");
  }
  if (normalized.activeDurableRoot !== ARTIFACT_PATHS.doveRoot) {
    reasons.push(`active durable root must remain ${ARTIFACT_PATHS.doveRoot}`);
  }
  if (normalized.authoritativeRoot !== ARTIFACT_PATHS.doveRoot) {
    reasons.push(`authoritative root must remain ${ARTIFACT_PATHS.doveRoot}`);
  }
  if (normalized.currentWriteAuthority !== ARTIFACT_PATHS.doveRoot) {
    reasons.push(`current write authority must remain ${ARTIFACT_PATHS.doveRoot}`);
  }
  if (normalized.manifestPath !== ARTIFACT_PATHS.doveRootManifest) {
    reasons.push(`authority manifest path must remain ${ARTIFACT_PATHS.doveRootManifest}`);
  }
  if (normalized.dualRootInvariant.allowed !== false || normalized.dualRootInvariant.doveRootAuthoritative !== true || normalized.dualRootInvariant.legacyRootAuthoritative !== false) {
    reasons.push("dual-root invariant must keep only .dove authoritative");
  }

  const staleLegacyArtifacts = [
    ".paper/state.json",
    ".paper/workspace/index.json",
    ".paper/orchestration/board.json",
    ".paper/task-packets/index.json"
  ].filter((relativePath) => fs.existsSync(path.join(target, relativePath)));
  if (staleLegacyArtifacts.length > 0) {
    reasons.push(`stale legacy .paper artifacts detected: ${staleLegacyArtifacts.join(", ")}`);
  }

  return {
    status: reasons.length === 0 ? "ok" : "degraded",
    strategy: normalized.strategy,
    activeDurableRoot: normalized.activeDurableRoot,
    authoritativeRoot: normalized.authoritativeRoot,
    currentWriteAuthority: normalized.currentWriteAuthority,
    manifestPath: normalized.manifestPath,
    legacyRoot: normalized.legacyRoot,
    staleLegacyArtifacts,
    reasons
  };
}

function collectRawManagedArtifactChecks(target) {
  const specs = [
    ["raw-typed-wiki-relations-shape", ".dove/wiki/relations.json", validateWikiRelationsShape],
    ["raw-figure-qa-shape", ".dove/figures/qa.json", validateFigureQaShape],
    ["raw-workspace-index-shape", ".dove/workspace/index.json", validateWorkspaceRepairFrontierShape],
    ["raw-dove-authority-manifest-shape", ARTIFACT_PATHS.doveRootManifest, validateDoveAuthorityManifestShape],
    ["raw-meta-recommendations-shape", ".dove/meta/recommendations.json", validateMetaRecommendationsShape],
    ["raw-meta-optimizer-state-shape", ".dove/meta/optimizer-state.json", validateMetaOptimizerStateShape],
    ["raw-meta-operator-playbooks-shape", ".dove/meta/operator-playbooks.json", validateMetaOperatorPlaybooksShape],
    ["raw-meta-execution-bridge-candidates-shape", ".dove/meta/execution-bridge-candidates.json", validateMetaExecutionBridgeCandidatesShape],
    ["raw-meta-governance-coverage-shape", ".dove/meta/governance-coverage.json", validateMetaGovernanceCoverageShape],
    ["raw-meta-operator-follow-through-shape", ".dove/meta/operator-follow-through.json", validateMetaOperatorFollowThroughShape],
    ["raw-meta-operator-follow-through-transitions-shape", ".dove/meta/operator-follow-through-transitions.json", validateMetaOperatorFollowThroughTransitionsShape],
    ["raw-meta-long-horizon-shape", ".dove/meta/long-horizon-memory.json", validateMetaLongHorizonShape]
  ];

  return specs.map(([check, relativePath, validate]) => {
    const inspected = readJsonFile(target, relativePath);
    if (inspected.status !== "ok") {
      return {
        check,
        ok: inspected.status === "missing",
        message: inspected.status === "missing" ? `${relativePath} is missing.` : inspected.message
      };
    }
    const issues = validate(inspected.value);
    return {
      check,
      ok: issues.length === 0,
      message: issues.length === 0 ? "ok" : issues.join(" | ")
    };
  });
}

function collectRawMetaOptimizeConsistencyCheck(target) {
  const recommendations = readJsonFile(target, ".dove/meta/recommendations.json");
  const optimizerState = readJsonFile(target, ".dove/meta/optimizer-state.json");
  const executionBridgeCandidates = readJsonFile(target, ".dove/meta/execution-bridge-candidates.json");
  const operatorPlaybooks = readJsonFile(target, ".dove/meta/operator-playbooks.json");
  const longHorizonMemory = readJsonFile(target, ".dove/meta/long-horizon-memory.json");
  const workspaceIndex = readJsonFile(target, ".dove/workspace/index.json");

  if ([recommendations, optimizerState, operatorPlaybooks, longHorizonMemory, workspaceIndex].some((item) => item.status !== "ok")) {
    return {
      check: "raw-meta-optimize-mirror-consistency",
      ok: true,
      message: "skipped",
      mismatches: []
    };
  }

  const shapeIssues = [
    ...validateMetaRecommendationsShape(recommendations.value),
    ...validateMetaOptimizerStateShape(optimizerState.value),
    ...validateMetaOperatorPlaybooksShape(operatorPlaybooks.value),
    ...validateMetaLongHorizonShape(longHorizonMemory.value),
    ...validateWorkspaceRepairFrontierShape(workspaceIndex.value)
  ];
  if (shapeIssues.length > 0) {
    return {
      check: "raw-meta-optimize-mirror-consistency",
      ok: true,
      message: "skipped due to raw shape issues",
      mismatches: []
    };
  }

  const normalizedRecommendations = normalizeMetaRecommendationsIndex(recommendations.value);
  const normalizedOptimizerState = normalizeMetaOptimizerState(optimizerState.value);
  const normalizedOperatorPlaybooks = normalizeMetaOperatorPlaybooksIndex(operatorPlaybooks.value);
  const normalizedWorkspaceIndex = normalizeWorkspaceIndex(workspaceIndex.value);
  const normalizedWorkspaceMetaOptimize = normalizeWorkspaceMetaOptimize(workspaceIndex.value.metaOptimize, normalizedWorkspaceIndex.metaOptimize);
  const normalizedLongHorizonMemory = normalizeMetaLongHorizonMemory(longHorizonMemory.value);
  const mismatches = [];
  const topClusters = normalizedRecommendations.summary.topClusters;

  if (normalizedWorkspaceMetaOptimize.recommendationCount !== normalizedRecommendations.items.length) {
    mismatches.push("workspace metaOptimize recommendation count drift");
  }
  if (normalizedWorkspaceMetaOptimize.clusterCount !== normalizedRecommendations.clusters.length) {
    mismatches.push("workspace metaOptimize cluster count drift");
  }
  if (normalizedWorkspaceMetaOptimize.reportPath !== normalizedOptimizerState.frontier.reportPath) {
    mismatches.push("workspace metaOptimize reportPath drift");
  }
  if (normalizedWorkspaceMetaOptimize.recommendationsPath !== normalizedOptimizerState.frontier.recommendationsPath) {
    mismatches.push("workspace metaOptimize recommendationsPath drift");
  }
  if (normalizedWorkspaceMetaOptimize.statePath !== normalizedOptimizerState.frontier.statePath) {
    mismatches.push("workspace metaOptimize statePath drift");
  }
  if (normalizedWorkspaceMetaOptimize.longHorizonPath !== normalizedOptimizerState.frontier.longHorizonPath) {
    mismatches.push("workspace metaOptimize longHorizonPath drift");
  }
  if (normalizedWorkspaceMetaOptimize.longHorizon.memoryPath !== normalizedOptimizerState.longHorizon.memoryPath) {
    mismatches.push("workspace metaOptimize longHorizon.memoryPath drift");
  }
  if (JSON.stringify(normalizedRecommendations.frontier.topClusterIds) !== JSON.stringify(normalizedOptimizerState.frontier.topClusterIds)) {
    mismatches.push("optimizer frontier topClusterIds drift");
  }
  if (JSON.stringify(normalizedRecommendations.frontier.topClusterIds) !== JSON.stringify(normalizedWorkspaceMetaOptimize.topClusterIds)) {
    mismatches.push("workspace metaOptimize topClusterIds drift");
  }
  if (normalizedRecommendations.frontier.frontierSummary !== normalizedOptimizerState.frontier.frontierSummary) {
    mismatches.push("optimizer frontier summary drift");
  }
  if (normalizedRecommendations.frontier.frontierSummary !== normalizedWorkspaceMetaOptimize.frontierSummary) {
    mismatches.push("workspace metaOptimize frontier summary drift");
  }
  if (JSON.stringify(normalizedRecommendations.frontier.topTaxonomyFamilyIds) !== JSON.stringify(normalizedOptimizerState.frontier.topTaxonomyFamilyIds)) {
    mismatches.push("optimizer frontier topTaxonomyFamilyIds drift");
  }
  if (JSON.stringify(normalizedRecommendations.frontier.topTaxonomyFamilyIds) !== JSON.stringify(normalizedWorkspaceMetaOptimize.topTaxonomyFamilyIds)) {
    mismatches.push("workspace metaOptimize topTaxonomyFamilyIds drift");
  }
  if (JSON.stringify(normalizedRecommendations.frontier.topTaxonomyGroupIds) !== JSON.stringify(normalizedOptimizerState.frontier.topTaxonomyGroupIds)) {
    mismatches.push("optimizer frontier topTaxonomyGroupIds drift");
  }
  if (JSON.stringify(normalizedRecommendations.frontier.topTaxonomyGroupIds) !== JSON.stringify(normalizedWorkspaceMetaOptimize.topTaxonomyGroupIds)) {
    mismatches.push("workspace metaOptimize topTaxonomyGroupIds drift");
  }
  if (normalizedRecommendations.frontier.taxonomyOverview !== normalizedOptimizerState.frontier.taxonomyOverview) {
    mismatches.push("optimizer frontier taxonomy overview drift");
  }
  if (normalizedRecommendations.frontier.taxonomyOverview !== normalizedWorkspaceMetaOptimize.taxonomyOverview) {
    mismatches.push("workspace metaOptimize taxonomy overview drift");
  }
  if (normalizedOptimizerState.operatorPlaybooks.playbookCount !== normalizedOperatorPlaybooks.playbooks.length) {
    mismatches.push("optimizer state operatorPlaybooks count drift");
  }
  if (normalizedWorkspaceMetaOptimize.operatorPlaybooks.playbookCount !== normalizedOperatorPlaybooks.playbooks.length) {
    mismatches.push("workspace metaOptimize operatorPlaybooks count drift");
  }
  if (JSON.stringify(normalizedOptimizerState.operatorPlaybooks.topPlaybookIds) !== JSON.stringify(normalizedOperatorPlaybooks.summary.topPlaybookIds)) {
    mismatches.push("optimizer state operatorPlaybooks topPlaybookIds drift");
  }
  if (JSON.stringify(normalizedWorkspaceMetaOptimize.operatorPlaybooks.topPlaybookIds) !== JSON.stringify(normalizedOperatorPlaybooks.summary.topPlaybookIds)) {
    mismatches.push("workspace metaOptimize operatorPlaybooks topPlaybookIds drift");
  }
  if (JSON.stringify(normalizedRecommendations.frontier.pressureAreas) !== JSON.stringify(normalizedOptimizerState.frontier.pressureAreas)) {
    mismatches.push("optimizer frontier pressureAreas drift");
  }
  if (JSON.stringify(normalizedRecommendations.frontier.pressureAreas) !== JSON.stringify(normalizedWorkspaceMetaOptimize.pressureAreas)) {
    mismatches.push("workspace metaOptimize pressureAreas drift");
  }
  if (JSON.stringify(topClusters) !== JSON.stringify(normalizedOptimizerState.frontier.topClusters)) {
    mismatches.push("optimizer frontier topClusters drift");
  }
  if (JSON.stringify(topClusters) !== JSON.stringify(normalizedWorkspaceMetaOptimize.topClusters)) {
    mismatches.push("workspace metaOptimize topClusters drift");
  }
  if (normalizedWorkspaceMetaOptimize.longHorizon.familyCount !== normalizedLongHorizonMemory.summary.familyCount) {
    mismatches.push("workspace metaOptimize longHorizon family count drift");
  }
  if (JSON.stringify(normalizedLongHorizonMemory.summary.topFamilyIds) !== JSON.stringify(normalizedOptimizerState.longHorizon.topFamilyIds)) {
    mismatches.push("optimizer state longHorizon topFamilyIds drift");
  }
  if (JSON.stringify(normalizedLongHorizonMemory.summary.topFamilyIds) !== JSON.stringify(normalizedWorkspaceMetaOptimize.longHorizon.topFamilyIds)) {
    mismatches.push("workspace metaOptimize longHorizon topFamilyIds drift");
  }
  if (JSON.stringify(normalizedLongHorizonMemory.summary.topTaxonomyFamilyIds) !== JSON.stringify(normalizedOptimizerState.longHorizon.topTaxonomyFamilyIds)) {
    mismatches.push("optimizer state longHorizon topTaxonomyFamilyIds drift");
  }
  if (JSON.stringify(normalizedLongHorizonMemory.summary.topTaxonomyFamilyIds) !== JSON.stringify(normalizedWorkspaceMetaOptimize.longHorizon.topTaxonomyFamilyIds)) {
    mismatches.push("workspace metaOptimize longHorizon topTaxonomyFamilyIds drift");
  }
  if (JSON.stringify(normalizedLongHorizonMemory.summary.topTaxonomyGroupIds) !== JSON.stringify(normalizedOptimizerState.longHorizon.topTaxonomyGroupIds)) {
    mismatches.push("optimizer state longHorizon topTaxonomyGroupIds drift");
  }
  if (JSON.stringify(normalizedLongHorizonMemory.summary.topTaxonomyGroupIds) !== JSON.stringify(normalizedWorkspaceMetaOptimize.longHorizon.topTaxonomyGroupIds)) {
    mismatches.push("workspace metaOptimize longHorizon topTaxonomyGroupIds drift");
  }
  if (JSON.stringify(normalizedLongHorizonMemory.summary.pressureAreas) !== JSON.stringify(normalizedOptimizerState.longHorizon.pressureAreas)) {
    mismatches.push("optimizer state longHorizon pressureAreas drift");
  }
  if (JSON.stringify(normalizedLongHorizonMemory.summary.pressureAreas) !== JSON.stringify(normalizedWorkspaceMetaOptimize.longHorizon.pressureAreas)) {
    mismatches.push("workspace metaOptimize longHorizon pressureAreas drift");
  }
  if (normalizedLongHorizonMemory.summary.overview !== normalizedOptimizerState.longHorizon.overview) {
    mismatches.push("optimizer state longHorizon overview drift");
  }
  if (normalizedLongHorizonMemory.summary.overview !== normalizedWorkspaceMetaOptimize.longHorizon.overview) {
    mismatches.push("workspace metaOptimize longHorizon overview drift");
  }
  if (normalizedLongHorizonMemory.summary.snapshotCount !== normalizedOptimizerState.longHorizon.snapshotCount) {
    mismatches.push("optimizer state longHorizon snapshot count drift");
  }
  if (normalizedLongHorizonMemory.summary.snapshotCount !== normalizedWorkspaceMetaOptimize.longHorizon.snapshotCount) {
    mismatches.push("workspace metaOptimize longHorizon snapshot count drift");
  }
  if (normalizedLongHorizonMemory.summary.lastAction !== normalizedOptimizerState.longHorizon.lastAction) {
    mismatches.push("optimizer state longHorizon last action drift");
  }
  if (normalizedLongHorizonMemory.summary.lastAction !== normalizedWorkspaceMetaOptimize.longHorizon.lastAction) {
    mismatches.push("workspace metaOptimize longHorizon last action drift");
  }

  return {
    check: "raw-meta-optimize-mirror-consistency",
    ok: mismatches.length === 0,
    message: mismatches.length === 0 ? "ok" : mismatches.join(" | "),
    mismatches
  };
}

function inspectWikiRelations(target) {
  const inspected = readJsonFile(target, ".dove/wiki/relations.json");
  if (inspected.status !== "ok") {
    return { status: inspected.status, degradedCount: 0, degradedFamilyCount: 0, reasons: [inspected.message], relationIds: [], familyIds: [] };
  }
  const shapeIssues = validateWikiRelationsShape(inspected.value);
  if (shapeIssues.length > 0) {
    return { status: "malformed", degradedCount: 0, degradedFamilyCount: 0, reasons: shapeIssues, relationIds: [], familyIds: [] };
  }
  const items = Array.isArray(inspected.value?.items) ? inspected.value.items : [];
  const summary = inspected.value?.summary ?? {};
  const taxonomy = summary.taxonomy ?? {};
  const degraded = items.filter((item) => item?.integrity?.status === "degraded");
  const degradedFamilies = Array.isArray(taxonomy.families) ? taxonomy.families.filter((item) => item?.degradedCount > 0) : [];
  return {
    status: degraded.length > 0 ? "degraded" : "ok",
    degradedCount: degraded.length,
    degradedFamilyCount: degradedFamilies.length,
    relationIds: degraded.map((item) => item.id),
    familyIds: degradedFamilies.map((item) => item.id),
    taxonomyOverview: taxonomy.overview ?? null,
    reasons: [
      degradedFamilies.length > 0 ? `degraded families: ${degradedFamilies.map((item) => `${item.id}(${item.degradedCount})`).join(", ")}` : null,
      ...degraded.flatMap((item) => (item.integrity?.reasons ?? []).map((reason) => reason.message))
    ].filter(Boolean).slice(0, 10)
  };
}

function inspectFigureQa(target) {
  const inspected = readJsonFile(target, ".dove/figures/qa.json");
  if (inspected.status !== "ok") {
    return { status: inspected.status, issueCount: 0, reasons: [inspected.message], issueIds: [] };
  }
  const shapeIssues = validateFigureQaShape(inspected.value);
  if (shapeIssues.length > 0) {
    return { status: "malformed", issueCount: 0, reasons: shapeIssues, issueIds: [] };
  }
  const issues = Array.isArray(inspected.value?.issues) ? inspected.value.issues : [];
  return {
    status: issues.length > 0 ? "degraded" : "ok",
    issueCount: issues.length,
    issueIds: issues.map((issue) => issue.id),
    reasons: issues.map((issue) => issue.summary ?? issue.code ?? issue.id).slice(0, 10)
  };
}

function inspectWorkspaceRepairFrontier(target) {
  const inspected = readJsonFile(target, ".dove/workspace/index.json");
  if (inspected.status !== "ok") {
    return { status: inspected.status, count: 0, relationFamilyIssueCount: 0, reasons: [inspected.message], itemIds: [], familyIds: [] };
  }
  const shapeIssues = validateWorkspaceRepairFrontierShape(inspected.value);
  if (shapeIssues.length > 0) {
    return { status: "malformed", count: 0, relationFamilyIssueCount: 0, reasons: shapeIssues, itemIds: [], familyIds: [] };
  }
  const items = Array.isArray(inspected.value?.repairFrontier?.prioritizedItems) ? inspected.value.repairFrontier.prioritizedItems : [];
  const relationFamilySummaries = Array.isArray(inspected.value?.repairFrontier?.relationFamilySummaries) ? inspected.value.repairFrontier.relationFamilySummaries : [];
  const relationGroupSummaries = Array.isArray(inspected.value?.repairFrontier?.relationGroupSummaries) ? inspected.value.repairFrontier.relationGroupSummaries : [];
  return {
    status: items.length > 0 ? "degraded" : "ok",
    count: items.length,
    relationFamilyIssueCount: relationFamilySummaries.length,
    relationGroupIssueCount: relationGroupSummaries.length,
    governanceIssueCount: Number.isFinite(inspected.value?.repairFrontier?.governanceIssueCount) ? inspected.value.repairFrontier.governanceIssueCount : 0,
    itemIds: items.map((item) => item.id),
    familyIds: relationFamilySummaries.map((item) => item.id),
    groupIds: relationGroupSummaries.map((item) => item.id),
    prioritizedItems: items,
    taxonomyOverview: inspected.value?.repairFrontier?.taxonomyOverview ?? null,
    reasons: [
      inspected.value?.repairFrontier?.taxonomyOverview ?? null,
      ...relationFamilySummaries.map((item) => item.overview ?? item.label ?? item.id),
      ...relationGroupSummaries.map((item) => item.overview ?? item.label ?? item.id),
      ...items.map((item) => item.summary ?? item.id)
    ].filter(Boolean).slice(0, 10)
  };
}

function buildDoctorProposalFrontier(managedArtifacts, rawMetaOptimizeConsistency) {
  const workspaceItems = (managedArtifacts.workspaceRepairFrontier?.prioritizedItems ?? []).map((item) => ({
    ...item,
    proposalOnly: true,
    explicitOnly: true,
    noAutoApply: true
  }));
  const metaDriftItems = (rawMetaOptimizeConsistency?.mismatches ?? []).length > 0
    ? [{
      id: "repair-meta-optimize-drift",
      frontierType: "meta-optimize-drift",
      severity: "high",
      proposalOnly: true,
      explicitOnly: true,
      noAutoApply: true,
      summary: "Repair meta-optimize mirror drift so workspace and optimizer frontier stay aligned.",
      reasons: rawMetaOptimizeConsistency.mismatches.join(" | "),
      reasonCodes: rawMetaOptimizeConsistency.mismatches,
      artifactPath: ".dove/meta/recommendations.json",
      relatedArtifactPaths: [".dove/meta/optimizer-state.json", ".dove/meta/long-horizon-memory.json", ".dove/workspace/index.json"],
      nextAction: "Refresh the durable surfaces or repair the drifted meta artifacts explicitly, then rerun doctor until the proposal-only frontier is clear."
    }]
    : [];
  const prioritizedItems = [...workspaceItems, ...metaDriftItems];
  return {
    proposalOnly: true,
    explicitOnly: true,
    noAutoApply: true,
    count: prioritizedItems.length,
    prioritizedItems
  };
}

function inspectMetaOptimize(target) {
  const recommendations = readJsonFile(target, ".dove/meta/recommendations.json");
  const optimizerState = readJsonFile(target, ".dove/meta/optimizer-state.json");
  const executionBridgeCandidates = readJsonFile(target, ".dove/meta/execution-bridge-candidates.json");
  const governanceCoverage = readJsonFile(target, ".dove/meta/governance-coverage.json");
  const operatorPlaybooks = readJsonFile(target, ".dove/meta/operator-playbooks.json");
  const longHorizonMemory = readJsonFile(target, ".dove/meta/long-horizon-memory.json");
  const workspaceIndex = readJsonFile(target, ".dove/workspace/index.json");
  if (recommendations.status !== "ok") {
    return { status: recommendations.status, recommendationCount: 0, clusterCount: 0, topClusterIds: [], reasons: [recommendations.message] };
  }
  if (optimizerState.status !== "ok") {
    return { status: optimizerState.status, recommendationCount: 0, clusterCount: 0, topClusterIds: [], reasons: [optimizerState.message] };
  }
  if (executionBridgeCandidates.status !== "ok") {
    return { status: executionBridgeCandidates.status, recommendationCount: 0, clusterCount: 0, topClusterIds: [], reasons: [executionBridgeCandidates.message] };
  }
  if (governanceCoverage.status !== "ok") {
    return { status: governanceCoverage.status, recommendationCount: 0, clusterCount: 0, topClusterIds: [], reasons: [governanceCoverage.message] };
  }
  if (operatorPlaybooks.status !== "ok") {
    return { status: operatorPlaybooks.status, recommendationCount: 0, clusterCount: 0, topClusterIds: [], reasons: [operatorPlaybooks.message] };
  }
  if (longHorizonMemory.status !== "ok") {
    return { status: longHorizonMemory.status, recommendationCount: 0, clusterCount: 0, topClusterIds: [], reasons: [longHorizonMemory.message] };
  }
  if (workspaceIndex.status !== "ok") {
    return { status: workspaceIndex.status, recommendationCount: 0, clusterCount: 0, topClusterIds: [], reasons: [workspaceIndex.message] };
  }
  const shapeIssues = [
    ...validateMetaRecommendationsShape(recommendations.value),
    ...validateMetaOptimizerStateShape(optimizerState.value),
    ...validateMetaExecutionBridgeCandidatesShape(executionBridgeCandidates.value),
    ...validateMetaGovernanceCoverageShape(governanceCoverage.value),
    ...validateMetaOperatorPlaybooksShape(operatorPlaybooks.value),
    ...validateMetaLongHorizonShape(longHorizonMemory.value),
    ...validateWorkspaceRepairFrontierShape(workspaceIndex.value)
  ];
  if (shapeIssues.length > 0) {
    return { status: "malformed", recommendationCount: 0, clusterCount: 0, topClusterIds: [], reasons: shapeIssues };
  }
  const normalizedRecommendations = normalizeMetaRecommendationsIndex(recommendations.value);
  const normalizedOptimizerState = normalizeMetaOptimizerState(optimizerState.value);
  const normalizedExecutionBridgeCandidates = normalizeMetaExecutionBridgeCandidatesIndex(executionBridgeCandidates.value);
  const normalizedGovernanceCoverage = normalizeMetaGovernanceCoverageIndex(governanceCoverage.value);
  const normalizedOperatorPlaybooks = normalizeMetaOperatorPlaybooksIndex(operatorPlaybooks.value);
  const normalizedLongHorizonMemory = normalizeMetaLongHorizonMemory(longHorizonMemory.value);
  const normalizedWorkspaceIndex = normalizeWorkspaceIndex(workspaceIndex.value);
  const normalizedWorkspaceMetaOptimize = normalizeWorkspaceMetaOptimize(workspaceIndex.value.metaOptimize, normalizedWorkspaceIndex.metaOptimize);
  const items = normalizedRecommendations.items;
  const clusters = normalizedRecommendations.clusters;
  const longHorizonSummary = normalizedLongHorizonMemory.summary;
  const frontier = {
    ...normalizedRecommendations.frontier,
    ...normalizedOptimizerState.frontier
  };
  const topClusters = Array.isArray(frontier.topClusters) && frontier.topClusters.length > 0
    ? frontier.topClusters
    : normalizedRecommendations.summary.topClusters;
  const ranking = normalizedRecommendations.ranking;
  const countMatches = (frontier.recommendationCount ?? items.length) === items.length;
  const clusterMatches = (frontier.clusterCount ?? clusters.length) === clusters.length;
  const topClusterMatches = topClusters.length === Math.min(clusters.length, 3);
  const rankingPresent = typeof ranking.method === "string" && Array.isArray(ranking.tieBreakOrder);
  const longHorizonPresent = typeof longHorizonSummary.overview === "string" && Array.isArray(longHorizonSummary.topFamilyIds);
  const workspaceMirrorMatches = normalizedWorkspaceMetaOptimize.recommendationCount === items.length
    && normalizedWorkspaceMetaOptimize.clusterCount === clusters.length
    && normalizedWorkspaceMetaOptimize.reportPath === normalizedOptimizerState.frontier.reportPath
    && normalizedWorkspaceMetaOptimize.recommendationsPath === normalizedOptimizerState.frontier.recommendationsPath
    && normalizedWorkspaceMetaOptimize.longHorizonPath === normalizedOptimizerState.frontier.longHorizonPath
    && normalizedWorkspaceMetaOptimize.longHorizon.memoryPath === normalizedOptimizerState.longHorizon.memoryPath
    && JSON.stringify(normalizedWorkspaceMetaOptimize.topClusterIds) === JSON.stringify(normalizedRecommendations.frontier.topClusterIds)
    && normalizedWorkspaceMetaOptimize.frontierSummary === normalizedRecommendations.frontier.frontierSummary
    && JSON.stringify(normalizedWorkspaceMetaOptimize.topTaxonomyFamilyIds) === JSON.stringify(normalizedRecommendations.frontier.topTaxonomyFamilyIds)
    && JSON.stringify(normalizedWorkspaceMetaOptimize.topTaxonomyGroupIds) === JSON.stringify(normalizedRecommendations.frontier.topTaxonomyGroupIds)
    && JSON.stringify(normalizedWorkspaceMetaOptimize.pressureAreas) === JSON.stringify(normalizedRecommendations.frontier.pressureAreas)
    && normalizedWorkspaceMetaOptimize.taxonomyOverview === normalizedRecommendations.frontier.taxonomyOverview
    && JSON.stringify(normalizedWorkspaceMetaOptimize.topClusters) === JSON.stringify(normalizedRecommendations.summary.topClusters)
    && JSON.stringify(normalizedWorkspaceMetaOptimize.longHorizon.topFamilyIds) === JSON.stringify(longHorizonSummary.topFamilyIds)
    && JSON.stringify(normalizedWorkspaceMetaOptimize.longHorizon.topTaxonomyFamilyIds) === JSON.stringify(longHorizonSummary.topTaxonomyFamilyIds)
    && JSON.stringify(normalizedWorkspaceMetaOptimize.longHorizon.topTaxonomyGroupIds) === JSON.stringify(longHorizonSummary.topTaxonomyGroupIds)
    && JSON.stringify(normalizedWorkspaceMetaOptimize.longHorizon.pressureAreas) === JSON.stringify(longHorizonSummary.pressureAreas)
    && normalizedWorkspaceMetaOptimize.longHorizon.overview === longHorizonSummary.overview
    && normalizedWorkspaceMetaOptimize.longHorizon.snapshotCount === longHorizonSummary.snapshotCount
    && normalizedWorkspaceMetaOptimize.longHorizon.lastAction === longHorizonSummary.lastAction
    && normalizedWorkspaceMetaOptimize.governanceCoverage.guardedCount === normalizedGovernanceCoverage.summary.guardedCount
    && normalizedWorkspaceMetaOptimize.governanceCoverage.exemptCount === normalizedGovernanceCoverage.summary.exemptCount;
  return {
    status: countMatches && clusterMatches && topClusterMatches && rankingPresent && longHorizonPresent && workspaceMirrorMatches ? "ok" : "degraded",
    recommendationCount: items.length,
    clusterCount: clusters.length,
    criticalCount: items.filter((item) => item?.priority === "critical").length,
    topClusterIds: Array.isArray(frontier.topClusterIds) ? frontier.topClusterIds : [],
    topRecommendationIds: Array.isArray(frontier.topRecommendationIds) ? frontier.topRecommendationIds : [],
    topFamilyIds: Array.isArray(longHorizonSummary.topFamilyIds) ? longHorizonSummary.topFamilyIds : [],
    topTaxonomyFamilyIds: Array.isArray(frontier.topTaxonomyFamilyIds) ? frontier.topTaxonomyFamilyIds : [],
    topTaxonomyGroupIds: Array.isArray(frontier.topTaxonomyGroupIds) ? frontier.topTaxonomyGroupIds : [],
    governanceCoverage: normalizedGovernanceCoverage.summary,
    topPlaybookIds: Array.isArray(normalizedOperatorPlaybooks.summary.topPlaybookIds) ? normalizedOperatorPlaybooks.summary.topPlaybookIds : [],
    topCandidateIds: Array.isArray(normalizedExecutionBridgeCandidates.summary.topCandidateIds) ? normalizedExecutionBridgeCandidates.summary.topCandidateIds : [],
    taxonomyOverview: frontier.taxonomyOverview ?? null,
    frontierSummary: frontier.frontierSummary ?? null,
    rankingMethod: frontier.rankingMethod ?? ranking.method ?? null,
    topClusters,
    reasons: [
      !countMatches ? "optimizer frontier recommendation count drift" : null,
      !clusterMatches ? "optimizer frontier cluster count drift" : null,
      !topClusterMatches ? "optimizer frontier top-cluster summary drift" : null,
      !rankingPresent ? "optimizer frontier ranking semantics missing" : null,
      !longHorizonPresent ? "optimizer long-horizon memory summary missing" : null,
      !workspaceMirrorMatches ? "workspace metaOptimize mirror drift" : null,
      `grouped frontier: ${clusters.length} clusters / ${items.length} recommendations`,
      `governance coverage: ${normalizedGovernanceCoverage.summary.guardedCount ?? 0} guarded / ${normalizedGovernanceCoverage.summary.exemptCount ?? 0} exempt`,
      `execution bridge candidates: ${normalizedExecutionBridgeCandidates.summary.candidateCount ?? 0} candidates (${normalizedExecutionBridgeCandidates.summary.topCandidateIds.join(", ") || "none"})`,
      `family playbooks: ${normalizedOperatorPlaybooks.summary.playbookCount ?? 0} playbooks (${normalizedOperatorPlaybooks.summary.topTaxonomyFamilyIds.join(", ") || "none"})`,
      normalizedWorkspaceMetaOptimize.remediationPacks?.readinessOverview ? `remediation readiness: ${normalizedWorkspaceMetaOptimize.remediationPacks.readinessOverview}` : null,
      normalizedWorkspaceMetaOptimize.operatorPlaybooks?.readinessOverview ? `playbook readiness: ${normalizedWorkspaceMetaOptimize.operatorPlaybooks.readinessOverview}` : null,
      frontier.frontierSummary ? `frontier summary: ${frontier.frontierSummary}` : null,
      frontier.taxonomyOverview ? `taxonomy pressure: ${frontier.taxonomyOverview}` : null,
      longHorizonSummary.overview ? `long-horizon summary: ${longHorizonSummary.overview}` : null
    ].filter(Boolean)
  };
}

function inspectGovernanceCoverageSurfaceBindings(target, options = {}) {
  const requireCommandSurfaces = options.requireCommandSurfaces !== false;
  const coverage = readJsonFile(target, ".dove/meta/governance-coverage.json");
  if (coverage.status !== "ok") {
    return {
      status: "degraded",
      bindingCount: 0,
      reasons: [coverage.message]
    };
  }
  const toolNames = new Set(toolDefinitions.map((tool) => tool.name));
  const entries = [...(coverage.value?.guardedMutations ?? []), ...(coverage.value?.exemptMutations ?? [])];
  const boundToolNames = new Set();
  const boundCommandIds = new Set();
  const boundCoreFunctions = new Set();
  const reasons = [];
  const exemptIds = new Set((coverage.value?.exemptMutations ?? []).map((entry) => entry.id));
  for (const entry of entries) {
    const bindings = entry.surfaceBindings ?? {};
    if (exemptIds.has(entry.id) && (!entry.ownerRole || !entry.approvedByRole || !entry.approvedAt || !entry.lastReviewedAt || !entry.reasonCode || !entry.reviewCadence || !entry.sunsetAt)) {
      reasons.push(`governance coverage entry ${entry.id} is missing ownerRole/approvedByRole/approvedAt/lastReviewedAt/reasonCode/reviewCadence/sunsetAt metadata`);
    }
    if (exemptIds.has(entry.id) && entry.approvedAt && entry.lastReviewedAt && Date.parse(entry.approvedAt) > Date.parse(entry.lastReviewedAt)) {
      reasons.push(`governance coverage entry ${entry.id} has approvedAt newer than lastReviewedAt`);
    }
    if (exemptIds.has(entry.id) && entry.sunsetAt && entry.sunsetAt <= new Date().toISOString()) {
      reasons.push(`governance coverage entry ${entry.id} has an expired sunsetAt`);
    }
    if (bindings.coreFunction) {
      boundCoreFunctions.add(bindings.coreFunction);
    }
    for (const commandId of bindings.commandIds ?? []) {
      boundCommandIds.add(commandId);
      if (requireCommandSurfaces) {
        const commandPath = path.join(target, ".opencode", "commands", `${commandId}.md`);
        if (!fs.existsSync(commandPath)) {
          reasons.push(`governance coverage missing command surface ${commandId} for ${entry.id}`);
        }
      }
    }
    if (bindings.mcpTool) {
      boundToolNames.add(bindings.mcpTool);
      if (!toolNames.has(bindings.mcpTool)) {
        reasons.push(`governance coverage missing MCP tool ${bindings.mcpTool} for ${entry.id}`);
      }
    }
  }

  const registry = [...GOVERNANCE_GUARDED_MUTATIONS, ...GOVERNANCE_EXEMPT_MUTATIONS];
  const expectedMutatingTools = registry.map((entry) => entry.surfaceBindings?.mcpTool).filter(Boolean);
  const expectedMutatingCommands = registry.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []);
  const expectedCoreFunctions = registry.map((entry) => entry.surfaceBindings?.coreFunction).filter(Boolean);
  for (const toolName of expectedMutatingTools) {
    if (!boundToolNames.has(toolName)) {
      reasons.push(`governance coverage does not bind mutating MCP tool ${toolName}`);
    }
  }
  const uncoveredTools = expectedMutatingTools.filter((toolName) => !boundToolNames.has(toolName));
  for (const commandId of expectedMutatingCommands) {
    if (!boundCommandIds.has(commandId)) {
      reasons.push(`governance coverage does not bind mutating command ${commandId}`);
    }
  }
  const uncoveredCommands = expectedMutatingCommands.filter((commandId) => !boundCommandIds.has(commandId));
  for (const coreFunction of expectedCoreFunctions) {
    if (!boundCoreFunctions.has(coreFunction)) {
      reasons.push(`governance coverage does not bind core function ${coreFunction}`);
    }
  }
  const uncoveredCoreFunctions = expectedCoreFunctions.filter((coreFunction) => !boundCoreFunctions.has(coreFunction));
  const exemptIdsList = (coverage.value?.exemptMutations ?? []).map((entry) => entry.id);
  const guardedIds = (coverage.value?.guardedMutations ?? []).map((entry) => entry.id);
  const coverageIds = new Set(GOVERNANCE_NEGATIVE_COVERAGE.map((entry) => entry.id));
  const uncoveredNegativeCoverage = guardedIds.filter((id) => !coverageIds.has(id));
  for (const id of uncoveredNegativeCoverage) {
    reasons.push(`governance coverage lacks negative test mapping for ${id}`);
  }
  return {
    status: reasons.length === 0 ? "ok" : "degraded",
    bindingCount: entries.length,
    reasons,
    audit: {
      guardedIds,
      exemptIds: exemptIdsList,
      uncoveredTools,
      uncoveredCommands,
      uncoveredCoreFunctions,
      uncoveredNegativeCoverage
    }
  };
}

function detectInstalledHosts(target) {
  const detected = Object.entries(HOST_ADAPTERS)
    .filter(([, adapter]) => adapter.paths.some((relativePath) => fs.existsSync(path.join(target, relativePath))))
    .map(([host]) => host);
  return detected.length > 0 ? detected : DEFAULT_HOST_ADAPTERS;
}

function doctor(target) {
  const boundariesPath = path.join(target, ".dove", "workflow-pack", "boundaries.json");
  const installedHosts = detectInstalledHosts(target);
  const hostRequiredPaths = installedHosts.flatMap((host) => HOST_ADAPTERS[host].requiredPaths ?? []);
  const required = [
    ...hostRequiredPaths,
    ".dove/state.json",
    ".dove/wiki/entities.json",
    ".dove/wiki/relations.json",
    ".dove/figures/qa.json",
    ".dove/meta/long-horizon-memory.json",
    ".dove/workspace/index.json",
    ARTIFACT_PATHS.doveRootManifest,
    ".dove/meta/operator-playbooks.json",
    "mcp/dove-state-server.mjs",
    "src/mcp/server.mjs"
   ];

  const missing = required.filter((relativePath) => !fs.existsSync(path.join(target, relativePath)));
  const result = {
    target,
    node: process.version,
    healthy: missing.length === 0,
    missing,
    checks: [],
    hostAdapters: installedHosts,
    boundaryPolicy: null,
    managedArtifacts: null
  };

  const jsonChecks = [
    ...installedHosts.flatMap((host) => HOST_ADAPTERS[host].jsonChecks ?? []),
    ".dove/state.json"
  ];

  for (const relativePath of jsonChecks) {
    const fullPath = path.join(target, relativePath);
    try {
      JSON.parse(fs.readFileSync(fullPath, "utf8"));
      result.checks.push({ check: `json:${relativePath}`, ok: true });
    } catch (error) {
      result.checks.push({ check: `json:${relativePath}`, ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  }

  for (const host of installedHosts) {
    const requiredPaths = HOST_ADAPTERS[host].requiredPaths ?? [];
    result.checks.push({
      check: `host-adapter:${host}`,
      ok: requiredPaths.every((relativePath) => fs.existsSync(path.join(target, relativePath))),
      requiredPaths
    });
  }

  const rawJsonChecksPassed = result.checks.every((check) => check.ok);

  let boundaryRawParseOk = true;
  if (fs.existsSync(boundariesPath)) {
    try {
      JSON.parse(fs.readFileSync(boundariesPath, "utf8"));
    } catch (error) {
      boundaryRawParseOk = false;
      result.checks.push({
        check: "raw-boundary-json",
        ok: false,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  result.checks.push(...collectRawManagedArtifactChecks(target));
  const rawMetaOptimizeConsistency = collectRawMetaOptimizeConsistencyCheck(target);
  result.checks.push(rawMetaOptimizeConsistency);

  if (rawJsonChecksPassed && boundaryRawParseOk) {
    ensureWorkspace(target);
  }

  try {
    const boundaries = JSON.parse(fs.readFileSync(boundariesPath, "utf8"));
    const missingBootstrapPaths = (boundaries.doveBootstrapOnlyPaths ?? []).filter((relativePath) => !fs.existsSync(path.join(target, relativePath)));
    const boundaryHasMetadata = Boolean(boundaries.managedArtifacts?.workflowBoundaries?.revisionId)
      && Boolean(boundaries.managedArtifacts?.workflowBoundaries?.templateHash)
      && Boolean(boundaries.managedArtifacts?.workspaceIndex?.revisionId)
      && Boolean(boundaries.managedArtifacts?.doveRootManifest?.revisionId);
    const userOwnedExistingPaths = (boundaries.userOwnedPaths ?? []).filter((relativePath) => fs.existsSync(path.join(target, relativePath)));
    result.boundaryPolicy = {
      boundaryFile: ".dove/workflow-pack/boundaries.json",
      managedPaths: boundaries.managedPaths ?? [],
      missingBootstrapPaths,
      userOwnedExistingPaths,
      managedArtifactMetadataPresent: boundaryHasMetadata
    };
    result.checks.push({
      check: "boundary-policy",
      ok: missingBootstrapPaths.length === 0 && boundaryHasMetadata,
      message: missingBootstrapPaths.length === 0
        ? (boundaryHasMetadata ? "boundary metadata present" : "boundary metadata missing")
        : `missing bootstrap artifacts: ${missingBootstrapPaths.join(", ")}`
    });
  } catch (error) {
    result.checks.push({ check: "boundary-policy", ok: false, message: error instanceof Error ? error.message : String(error) });
  }

  const probeScript = path.join(target, "scripts", "doctor-mcp-probe.mjs");
  if (fs.existsSync(probeScript)) {
    const probe = spawnSync("node", [probeScript, target], {
      cwd: target,
      encoding: "utf8"
    });
    result.checks.push({
      check: "mcp-probe",
      ok: probe.status === 0,
      message: probe.status === 0 ? "ok" : (probe.stderr || probe.stdout || `exit ${probe.status}`)
    });
  }

  const managedArtifacts = {
    wikiRelations: inspectWikiRelations(target),
    figureQa: inspectFigureQa(target),
    workspaceRepairFrontier: inspectWorkspaceRepairFrontier(target),
    metaOptimize: inspectMetaOptimize(target),
    operatorFollowThrough: inspectOperatorFollowThrough(target),
    onboardingArtifactMap: inspectOnboardingArtifactMap(target),
    doveAuthorityManifest: inspectDoveAuthority(target),
    autonomyRuntime: inspectAutonomyRuntime(target),
    programsSurface: inspectProgramsSurface(target),
    governanceCoverageBindings: inspectGovernanceCoverageSurfaceBindings(target, { requireCommandSurfaces: installedHosts.includes("opencode") })
  };
  result.managedArtifacts = managedArtifacts;
  result.proposalFrontier = buildDoctorProposalFrontier(managedArtifacts, rawMetaOptimizeConsistency);
  result.checks.push({
    check: "typed-wiki-relations-health",
    ok: managedArtifacts.wikiRelations.status === "ok",
    message: managedArtifacts.wikiRelations.status === "ok"
      ? "typed wiki relations are healthy"
      : managedArtifacts.wikiRelations.reasons.join(" | ") || `degraded relations: ${managedArtifacts.wikiRelations.relationIds.join(", ")} | degraded families: ${managedArtifacts.wikiRelations.familyIds.join(", ")}`
  });
  result.checks.push({
    check: "figure-qa-health",
    ok: managedArtifacts.figureQa.status === "ok",
    message: managedArtifacts.figureQa.status === "ok"
      ? "figure qa is healthy"
      : managedArtifacts.figureQa.reasons.join(" | ") || `figure issues: ${managedArtifacts.figureQa.issueIds.join(", ")}`
  });
  result.checks.push({
    check: "workspace-repair-frontier",
    ok: managedArtifacts.workspaceRepairFrontier.status === "ok",
    message: managedArtifacts.workspaceRepairFrontier.status === "ok"
      ? "workspace repair frontier is clear"
      : managedArtifacts.workspaceRepairFrontier.reasons.join(" | ") || `repair items: ${managedArtifacts.workspaceRepairFrontier.itemIds.join(", ")} | degraded relation families: ${managedArtifacts.workspaceRepairFrontier.familyIds.join(", ")}`
  });
  result.checks.push({
    check: "meta-optimize-frontier",
    ok: managedArtifacts.metaOptimize.status === "ok",
    message: managedArtifacts.metaOptimize.reasons.join(" | ") || `clusters=${managedArtifacts.metaOptimize.clusterCount} recommendations=${managedArtifacts.metaOptimize.recommendationCount}`
  });
  result.checks.push({
    check: "governance-coverage-bindings",
    ok: managedArtifacts.governanceCoverageBindings.status === "ok",
    message: managedArtifacts.governanceCoverageBindings.status === "ok"
      ? `governance bindings verified across ${managedArtifacts.governanceCoverageBindings.bindingCount} entries`
      : managedArtifacts.governanceCoverageBindings.reasons.join(" | ")
  });
  result.checks.push({
    check: "operator-follow-through",
    ok: managedArtifacts.operatorFollowThrough.status === "ok",
    message: managedArtifacts.operatorFollowThrough.status === "ok"
      ? "operator follow-through is healthy"
      : managedArtifacts.operatorFollowThrough.reasons.join(" | ")
  });
  result.checks.push({
    check: "onboarding-artifact-map",
    ok: true,
    message: managedArtifacts.onboardingArtifactMap.mapExists
      ? `artifact map present: ${managedArtifacts.onboardingArtifactMap.mappingCount} mappings / ${managedArtifacts.onboardingArtifactMap.conflictCount} conflicts`
      : `proposal-only scan: ${managedArtifacts.onboardingArtifactMap.mappingCount} mappings / ${managedArtifacts.onboardingArtifactMap.unmappedCount} unmapped; run dove onboard . --write-map to persist`
  });
  result.checks.push({
    check: "dove-authority",
    ok: managedArtifacts.doveAuthorityManifest.status === "ok",
    message: managedArtifacts.doveAuthorityManifest.status === "ok"
      ? `Dove authority: ${managedArtifacts.doveAuthorityManifest.authoritativeRoot} authoritative, writes=${managedArtifacts.doveAuthorityManifest.currentWriteAuthority}`
      : managedArtifacts.doveAuthorityManifest.reasons.join(" | ")
  });
  result.checks.push({
    check: "autonomy-runtime",
    ok: managedArtifacts.autonomyRuntime.status === "ok",
    message: managedArtifacts.autonomyRuntime.status === "ok"
      ? `runtime=${managedArtifacts.autonomyRuntime.lastStatus}/${managedArtifacts.autonomyRuntime.lastOutcome} worker=${managedArtifacts.autonomyRuntime.lastEnvelopeWorkerRole ?? "none"} requests=${managedArtifacts.autonomyRuntime.requestCount} checkpoints=${managedArtifacts.autonomyRuntime.checkpointCount} escalations=${managedArtifacts.autonomyRuntime.escalationCount} continuation=${managedArtifacts.autonomyRuntime.continuationCount}/${managedArtifacts.autonomyRuntime.currentContinuationKind ?? "none"}/${managedArtifacts.autonomyRuntime.currentContinuationPacketId ?? "none"}/${managedArtifacts.autonomyRuntime.currentContinuationProgramRunId ?? "none"}/${managedArtifacts.autonomyRuntime.currentContinuationCommand ?? "none"}`
      : managedArtifacts.autonomyRuntime.reasons.join(" | ")
  });
  result.checks.push({
    check: "program-surfaces",
    ok: managedArtifacts.programsSurface.status === "ok",
    message: managedArtifacts.programsSurface.status === "ok"
      ? `programs=${managedArtifacts.programsSurface.programCount} approved-runs=${managedArtifacts.programsSurface.approvedRunCount} review-checkpoints=${managedArtifacts.programsSurface.reviewCheckpointRunCount} consumed-approvals=${managedArtifacts.programsSurface.consumedApprovalCount} current=${managedArtifacts.programsSurface.currentProgramId ?? "none"}/${managedArtifacts.programsSurface.currentProgramRunId ?? "none"} checkpoint=${managedArtifacts.programsSurface.currentReviewCheckpointRunId ?? "none"}`
      : managedArtifacts.programsSurface.reasons.join(" | ")
  });

  result.healthy = result.healthy && result.checks.every((check) => check.ok);

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.healthy ? 0 : 1;
}

const [, , command, maybeTarget, ...rest] = process.argv;
const force = rest.includes("--force");

function runDoveSurface(surface, rawTarget, rawRest = []) {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(rawTarget, rawRest);
  if (surface === "orchestrate") {
    return queryDoveOrchestrate(target, buildDoveOrchestrateArgs(commandRest));
  }
  if (surface === "mission") {
    return queryDoveMission(target, buildDoveMissionArgs(commandRest));
  }
  if (surface === "board") {
    return queryDoveMissionBoard(target, buildDoveBoardArgs(commandRest));
  }
  if (surface === "audit") {
    return queryDoveAudit(target, buildDoveAuditArgs(commandRest));
  }
  if (surface === "return") {
    return queryDoveReturn(target, buildDoveReturnArgs(commandRest));
  }
  return launchDoveMission(target, buildDoveLaunchArgs(commandRest));
}

if (!command || command === "help" || command === "--help") {
  usage();
  process.exit(0);
}

if (command === "install" || command === "sync") {
  const target = resolveTarget(maybeTarget);
  const result = installOrSync(target, force, rest);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (command === "doctor") {
  doctor(resolveTarget(maybeTarget));
  process.exit(process.exitCode ?? 0);
}

if (command === "onboard" || command === "migrate") {
  const target = resolveTarget(maybeTarget);
  const result = discoverPaperArtifacts(target, buildOnboardingArgs(rest));
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (["orchestrate", "mission", "board", "audit", "return", "launch"].includes(command)) {
  console.log(JSON.stringify(runDoveSurface(command, maybeTarget, rest), null, 2));
  process.exit(0);
}

if (command === "isolated-review-prepare") {
  const target = resolveTarget(maybeTarget);
  const result = prepareIsolatedReview(target, buildIsolatedReviewArgs(rest));
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (command === "isolated-review-import") {
  const target = resolveTarget(maybeTarget);
  const runId = readFlagValue(rest, "--run-id");
  const result = importIsolatedReview(target, {
    runId,
    handoffPath: readFlagValue(rest, "--handoff"),
    reportPath: readFlagValue(rest, "--report")
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (command === "isolated-review") {
  const target = resolveTarget(maybeTarget);
  const reviewerCommand = readFlagValue(rest, "--reviewer-command") ?? process.env.DOVE_ISOLATED_REVIEWER_COMMAND;
  const prepared = runIsolatedReview(target, buildIsolatedReviewArgs(rest));
  const reviewer = invokeIsolatedReviewer(reviewerCommand, prepared, target);
  const imported = importIsolatedReview(target, prepared.importArgs);
  console.log(JSON.stringify({
    ...imported,
    status: "completed",
    runId: prepared.runId,
    reviewerCommandConfigured: Boolean(reviewerCommand),
    reviewerExitStatus: reviewer.status
  }, null, 2));
  process.exit(0);
}

if (command === "autonomy-once") {
  const target = resolveTarget(maybeTarget);
  const actorRole = readFlagValue(rest, "--actor-role") ?? "planner";
  const result = runAutonomyControlPlaneOnce(target, { actorRole });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (command === "autonomy-foreground") {
  const target = resolveTarget(maybeTarget);
  const actorRole = readFlagValue(rest, "--actor-role") ?? "planner";
  const maxSteps = readFlagValue(rest, "--max-steps");
  const packetId = readFlagValue(rest, "--packet-id");
  const programRunId = readFlagValue(rest, "--program-run-id");
  const approvalId = readFlagValue(rest, "--approval-id");
  const result = runAutonomyForeground(target, {
    actorRole,
    maxSteps: maxSteps ? Number(maxSteps) : undefined,
    packetId,
    programRunId,
    approvalId
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (command === "autonomy-operate") {
  const target = resolveTarget(maybeTarget);
  const actorRole = readFlagValue(rest, "--actor-role") ?? "planner";
  const workerRole = readFlagValue(rest, "--worker-role") ?? "researcher";
  const maxSteps = readFlagValue(rest, "--max-steps");
  const result = runAutonomyOperate(target, {
    actorRole,
    workerRole,
    maxSteps: maxSteps ? Number(maxSteps) : undefined,
    objective: readFlagValue(rest, "--objective"),
    sourceType: readFlagValue(rest, "--source-type"),
    sourceId: readFlagValue(rest, "--source-id"),
    packetId: readFlagValue(rest, "--packet-id"),
    programId: readFlagValue(rest, "--program-id"),
    programRunId: readFlagValue(rest, "--program-run-id"),
    approvalId: readFlagValue(rest, "--approval-id"),
    campaignId: readFlagValue(rest, "--campaign-id"),
    campaignStepId: readFlagValue(rest, "--campaign-step-id"),
    executeBy: readFlagValue(rest, "--execute-by"),
    reviewAfter: readFlagValue(rest, "--review-after"),
    expiresAt: readFlagValue(rest, "--expires-at")
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

usage();
process.exit(1);
