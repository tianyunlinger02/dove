#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { configureClaudeCodeGatewayDefaults, inspectClaudeCodeGatewayDefaults, resolveClaudeConfigRoot, resolveClaudeShellStartupFile } from "../src/core/claude-code-gateway.mjs";
import { discoverPaperArtifacts, ensureWorkspace, importIsolatedReview, launchDoveMission, prepareIsolatedReview, publishDoveGlobalStatus, publishDoveStatus, queryDoveAudit, queryDoveMission, queryDoveOrchestrate, queryDoveReturn, queryDoveStatus, refreshDurableSurfaces, runAutonomyControlPlaneOnce, runAutonomyForeground, runAutonomyOperate, runFigureWorkflow, runGlobalStatusServingForeground, runIsolatedReview, runWithMutationContext } from "../src/core/index.mjs";
import { toolDefinitions } from "../src/mcp/tool-definitions.mjs";
import { ARTIFACT_PATHS, GOVERNANCE_EXEMPT_MUTATIONS, GOVERNANCE_GUARDED_MUTATIONS, GOVERNANCE_NEGATIVE_COVERAGE, createDoveAuthorityManifest, normalizeDoveAuthorityManifest } from "../src/core/schema.mjs";
import {
  createWorkflowBoundaries,
  normalizeMetaExecutionBridgeCandidatesIndex,
  normalizeMetaGovernanceCoverageIndex,
  normalizeMetaLongHorizonMemory,
  normalizeMetaOperatorLessonsIndex,
  normalizeMetaOperatorPlaybooksIndex,
  normalizeMetaOptimizerState,
  normalizeMetaRecommendationsIndex,
  normalizeWorkspaceIndex,
  normalizeWorkspaceMetaOptimize
} from "../src/core/schema.mjs";
import { COMMAND_SURFACES, CORE_INSTALL_PATHS, DEFAULT_HOST_ADAPTERS, HOST_ADAPTERS, HOST_IDS, USER_HOST_IDS } from "../src/core/command-manifest.mjs";
import { writeClaudeUserCommandAdapters } from "../scripts/generate-command-adapters.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const GLOBAL_COPY_EXCLUDE_NAMES = new Set([".git", "node_modules"]);
const INTERNAL_DOC_NAMES = new Set([
  "DOVE_REFACTOR_PLAN_2026-05-04.md",
  "ROLE_HIERARCHY_REFACTOR_PLAN_2026-05-04.md",
  "PAPER_FACTORY_SYSTEM_ORIGINS.zh-CN.md",
  "REFERENCE_ARCHITECTURES.zh-CN.md"
]);
const GLOBAL_COPY_EXCLUDE_SUFFIXES = [".log", ".tmp", ".cache"];

function usage() {
  console.log(`dove

Usage:
  dove status [target]
  dove status [target] --missions
  dove mission [target] --goal <text>
  dove figure [target] --intent <text>
  dove install [target] --host <opencode|codex|cursor|agents|claude|all>
  dove sync [target] --host <opencode|codex|cursor|agents|claude|all>
  dove doctor [target]

Other Dove paper actions are handled by their matching /dove.* request; use status first if you are unsure.
Use --json only when another tool needs structured details.
`);
}

function statusUsage() {
  console.log(`dove status

Use this as the daily project check-in: show the current situation and the next useful action.

Examples:
  dove status .
  dove status . --missions
  dove status . --json

Use --missions only when you need task choices or details. Use --json only when another tool needs structured data.
`);
}

const LOCAL_DOVE_CLI_SURFACES = new Set(["orchestrate", "mission", "status", "figure"]);
const PUBLIC_DOVE_SURFACES = new Set(COMMAND_SURFACES.map((surface) => surface.id.replace(/^dove\./u, "")));

function isHostOnlyDoveSurface(command) {
  return PUBLIC_DOVE_SURFACES.has(command) && !LOCAL_DOVE_CLI_SURFACES.has(command);
}

function hostOnlySurfaceUsage(command) {
  console.log(`dove.${command}

This shell can only give guidance for this Dove request.
Next: run /dove.${command} where the selected task can be updated, or provide the completed material/result here.

For a read-only project check, run:
  dove status .
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

function readPositionalArgs(args, valueFlags = []) {
  const valueFlagSet = new Set(valueFlags);
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (valueFlagSet.has(arg)) {
      index += 1;
      continue;
    }
    if (String(arg).startsWith("--")) {
      continue;
    }
    values.push(arg);
  }
  return values;
}

function readMutationMode(args = []) {
  const value = readFlagValue(args, "--mutation-mode");
  if (value === null) {
    if (args.includes("--mutation-mode")) {
      throw new Error("--mutation-mode requires patch-plan or direct-process");
    }
    return undefined;
  }
  if (value !== "patch-plan" && value !== "direct-process") {
    throw new Error("--mutation-mode must be patch-plan or direct-process");
  }
  return value;
}

function stripMutationModeFlag(args = []) {
  const stripped = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--mutation-mode") {
      index += 1;
      continue;
    }
    stripped.push(args[index]);
  }
  return stripped;
}

function withMutationContext(target, actionId, rawRest, callback, options = {}) {
  const rest = stripMutationModeFlag(rawRest);
  return runWithMutationContext(target, {
    actionId,
    mutationMode: readMutationMode(rawRest) ?? options.defaultMutationMode,
    hostId: "cli",
    packetId: options.packetId ?? readFirstFlagValue(rest, ["--packet-id", "--task-packet-id", "--mission-packet-id", "--task-id"])
  }, () => callback(rest));
}

function rejectPatchPlanMode(commandName, rawRest, reason) {
  if (readMutationMode(rawRest) === "patch-plan") {
    throw new Error(`${commandName} cannot run in patch-plan mode; ${reason}`);
  }
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
  const invalid = requested.filter((host) => !HOST_IDS.includes(host));
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
  if (INTERNAL_DOC_NAMES.has(basename)) {
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
  const projectHosts = hosts.filter((host) => Object.hasOwn(HOST_ADAPTERS, host));
  const userHosts = hosts.filter((host) => USER_HOST_IDS.includes(host));
  const hostPaths = projectHosts.flatMap((host) => HOST_ADAPTERS[host].paths.map((relativePath) => ({ host, relativePath })));
  return {
    corePaths: CORE_INSTALL_PATHS,
    hostPaths,
    userHosts,
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

function buildDoveStatusArgs(rest = []) {
  const detail = readFirstFlagValue(rest, ["--detail", "--view", "--result-mode"]);
  const intent = rest.includes("--contract-test") ? "contract-test" : rest.includes("--health") ? "health-check" : readFlagValue(rest, "--intent");
  return {
    intent,
    domain: readFirstFlagValue(rest, ["--domain", "--dove-domain", "--mission-domain"]),
    stage: readFirstFlagValue(rest, ["--stage", "--mission-stage"]),
    packetIds: readFlagValues(rest, ["--packet-id", "--packet", "--mission-packet-id", "--mission-packet"]),
    statuses: readFlagValues(rest, ["--status", "--lifecycle-status"]),
    includeArchived: rest.includes("--include-archived"),
    detail: detail ?? (rest.includes("--full") ? "full" : undefined),
    full: rest.includes("--full"),
    includeDetails: rest.includes("--include-details"),
    showMissions: rest.includes("--missions") || rest.includes("--show-missions"),
    includeMissionDetails: rest.includes("--include-mission-details"),
    requestStatusAdjustment: rest.includes("--request-status-adjustment") || rest.includes("--status-adjustment") || rest.includes("--show-status-adjustments"),
    includeStatusAdjustmentPreview: rest.includes("--include-status-adjustment-preview")
  };
}

function buildDoveFigureArgs(rest = []) {
  return {
    packetId: readFirstFlagValue(rest, ["--packet-id", "--task-packet-id", "--mission-packet-id", "--task-id"]),
    target: readFlagValue(rest, "--target"),
    packetTarget: readFlagValue(rest, "--packet-target"),
    taskName: readFlagValue(rest, "--task-name"),
    intent: readFlagValue(rest, "--intent"),
    description: readFlagValue(rest, "--description"),
    name: readFlagValue(rest, "--name"),
    title: readFlagValue(rest, "--title"),
    figureId: readFlagValue(rest, "--figure-id"),
    purpose: readFlagValue(rest, "--purpose"),
    captionIntent: readFlagValue(rest, "--caption-intent"),
    targetClaimIds: readFlagValues(rest, ["--target-claim-id", "--claim-id"]),
    sourceSections: readFlagValues(rest, ["--source-section", "--section-id"]),
    sourceArtifactPaths: readFlagValues(rest, ["--source-artifact-path", "--artifact-path"]),
    relatedExperimentIds: readFlagValues(rest, ["--related-experiment-id", "--experiment-id"]),
    reviewConcernIds: readFlagValues(rest, ["--review-concern-id"]),
    rebuttalIssueIds: readFlagValues(rest, ["--rebuttal-issue-id"]),
    requiredVisualElements: readFlagValues(rest, ["--required-visual-element"]),
    materialHints: readFlagValues(rest, ["--material-hint"]),
    providerId: readFlagValue(rest, "--provider-id") ?? "none",
    executeProvider: rest.includes("--execute-provider"),
    allowMissingMaterials: rest.includes("--allow-missing-materials"),
    runId: readFlagValue(rest, "--run-id"),
    outputFormat: readFlagValue(rest, "--output-format"),
    constraints: readFlagValues(rest, ["--constraint"]),
    outputManifestPath: readFlagValue(rest, "--output-manifest-path"),
    sourceSvgPath: readFlagValue(rest, "--source-svg-path"),
    targetFinalSvgPath: readFlagValue(rest, "--target-final-svg-path"),
    svgContent: readFlagValue(rest, "--svg-content"),
    caption: readFlagValue(rest, "--caption"),
    captionDraft: readFlagValue(rest, "--caption-draft"),
    captionId: readFlagValue(rest, "--caption-id")
  };
}

function wantsDoveStatusMissionDetails(args = {}) {
  const detail = String(args.detail ?? "").trim().toLowerCase();
  return Boolean(args.showMissions || args.includeMissionDetails || ["missions", "mission-details", "mission-list"].includes(detail));
}

function wantsJsonOutput(rest = []) {
  return rest.includes("--json") || readFlagValue(rest, "--format") === "json";
}

function writeStdout(text) {
  return new Promise((resolve, reject) => {
    process.stdout.write(text, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function printJson(value) {
  return writeStdout(`${JSON.stringify(value, null, 2)}\n`);
}

function compactText(value, maxLength = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function publicStatusText(value, maxLength = 180) {
  const text = String(value ?? "")
    .replace(/\btask-[a-z0-9][a-z0-9-]*\b/giu, "当前任务")
    .replace(/先为\s+[^\s，。:：]+\s+补/gu, "先为当前任务补");
  return compactText(text.replace(/为\s*当前任务\s*/gu, "为当前任务"), maxLength);
}

function publicStatusCommand(value, maxLength = 180) {
  const text = compactText(value, maxLength);
  if (/\btask-[a-z0-9][a-z0-9-]*\b/iu.test(text) || /--packet-id\b/u.test(text)) {
    return "";
  }
  return text;
}

function formatExpansionHint(value, responseLanguage = "zh") {
  const text = publicStatusText(value, 220);
  if (!text) {
    return "";
  }
  if (/--missions|--full|--json/u.test(text)) {
    return responseLanguage === "en" ? "If you explicitly want more detail, ask for task details or the full governance state." : "如果你明确要展开，可以再查看任务细节或完整治理状态。";
  }
  return text;
}

function formatEvidencePreview(items = []) {
  const evidence = Array.isArray(items) ? items.map((item) => compactText(item, 90)).filter(Boolean) : [];
  if (evidence.length === 0) {
    return "";
  }
  const shown = evidence.slice(0, 2).join("；");
  return evidence.length > 2 ? `${shown}；+${evidence.length - 2}` : shown;
}

function formatBoundarySummaryForCli(boundary, gaps = {}, operatorUnblock = null) {
  if (operatorUnblock?.blockedSummary) {
    return compactText(operatorUnblock.blockedSummary, 160);
  }
  if (operatorUnblock?.cannotContinueBecause) {
    return compactText(operatorUnblock.cannotContinueBecause, 160);
  }
  if (!boundary?.type && !gaps.boundaryType) {
    return "none";
  }
  return "needs operator action";
}

function formatMissionBlockedReasonForCli(value, responseLanguage = "zh") {
  const text = compactText(value, 140);
  if (!text) {
    return "";
  }
  if (text.startsWith("unresolved-dependencies:") || text.startsWith("blocked-by:")) {
    return responseLanguage === "en" ? "waiting on another mission" : "等待前置任务";
  }
  if (/^awaiting-[a-z0-9-]+$/i.test(text)) {
    const need = text.slice("awaiting-".length).replace(/-/g, " ");
    return responseLanguage === "en" ? `needs ${need}` : `需要${need}`;
  }
  return publicStatusText(text, 140);
}

function missionHumanStatus(item = {}, fallbackGroup = "todo") {
  return ["todo", "doing", "blocked", "done"].includes(item.group) ? item.group : fallbackGroup;
}

function missionTitleForCli(item = {}, maxLength = 100) {
  return publicStatusText(item.title ?? item.summary ?? "", maxLength) || "未命名任务";
}

function formatMissionListGroup(groupName, group = {}, options = {}) {
  const responseLanguage = options.responseLanguage ?? "zh";
  const items = Array.isArray(group.items) ? group.items : [];
  const itemCount = Number(group.itemCount ?? items.length);
  const limit = Number.isFinite(options.limit) ? Math.max(0, options.limit) : items.length;
  const visibleItems = options.collapsed || group.defaultCollapsed ? [] : items.slice(0, limit);
  const hiddenCount = Math.max(0, itemCount - visibleItems.length);
  const hiddenSuffix = hiddenCount > 0 ? (responseLanguage === "en" ? ` (+${hiddenCount} more)` : `（另有 ${hiddenCount} 个）`) : "";
  const lines = [`  ${groupName}: ${itemCount}${hiddenSuffix}`];
  for (const item of visibleItems) {
    const blockedReason = formatMissionBlockedReasonForCli(item.blockedReason, responseLanguage);
    lines.push(`    - ${missionTitleForCli(item)} [${missionHumanStatus(item, groupName)}]`);
    if (blockedReason && blockedReason !== item.boundaryType) {
      lines.push(responseLanguage === "en" ? `      blocked: ${blockedReason}` : `      受阻：${blockedReason}`);
    }
    if (item.boundaryType) {
      lines.push(responseLanguage === "en" ? "      needs operator action" : "      需要人工处理");
    }
  }
  return lines;
}

function formatMissionPriorityLaneForCli(priorityLane = {}, responseLanguage = "zh") {
  const focus = priorityLane.focus ?? {};
  if (!focus.packetId && !focus.title) {
    return [];
  }
  const lines = [responseLanguage === "en" ? "Priority:" : "优先处理：", `  - ${missionTitleForCli(focus)} [${missionHumanStatus(focus)}]`];
  const actionLabel = publicStatusText(priorityLane.action?.label, 160);
  const command = publicStatusCommand(priorityLane.action?.copyableCommand, 160);
  if (actionLabel || command) {
    const nextText = actionLabel || command;
    lines.push(responseLanguage === "en" ? `    Next: ${nextText}${command ? ` [${command}]` : ""}` : `    下一步：${nextText}${command ? ` [${command}]` : ""}`);
  }
  if (Array.isArray(priorityLane.needs) && priorityLane.needs.length > 0) {
    lines.push(responseLanguage === "en" ? `    Need: ${formatEvidencePreview(priorityLane.needs)}` : `    需要：${formatEvidencePreview(priorityLane.needs)}`);
  }
  if (Array.isArray(priorityLane.doneCriteria) && priorityLane.doneCriteria.length > 0) {
    lines.push(responseLanguage === "en" ? `    Done: ${formatEvidencePreview(priorityLane.doneCriteria)}` : `    完成标准：${formatEvidencePreview(priorityLane.doneCriteria)}`);
  }
  if (Array.isArray(priorityLane.unlocks) && priorityLane.unlocks.length > 0) {
    const unlocked = priorityLane.unlocks.slice(0, 3).map((item) => missionTitleForCli(item, 80)).join("；");
    const hidden = priorityLane.unlocks.length > 3 ? `；+${priorityLane.unlocks.length - 3}` : "";
    lines.push(responseLanguage === "en" ? `    Unlocks: ${unlocked}${hidden}` : `    完成后可推进：${unlocked}${hidden}`);
  }
  return lines;
}

function missionGroupCount(group = {}) {
  return Number(group.itemCount ?? group.items?.length ?? 0);
}

function formatMissionQueueSummaryForCli(groups = {}, responseLanguage = "zh") {
  const counts = ["doing", "blocked", "todo", "done"].map((name) => `${name} ${missionGroupCount(groups[name])}`);
  if (missionGroupCount(groups.archived) > 0) {
    counts.push(`archived ${missionGroupCount(groups.archived)}`);
  }
  return [responseLanguage === "en" ? `Queue summary: ${counts.join(", ")}` : `队列概览：${counts.join("，")}`];
}

function formatMissionListForCli(missionList = {}, responseLanguage = "zh") {
  const groups = missionList.groups ?? {};
  const lines = [responseLanguage === "en" ? "Task choices:" : "任务选择："];
  lines.push(...formatMissionPriorityLaneForCli(missionList.priorityLane, responseLanguage));
  lines.push(...formatMissionQueueSummaryForCli(groups, responseLanguage));
  lines.push(responseLanguage === "en" ? "Preview:" : "任务预览：");
  lines.push(...formatMissionListGroup("doing", groups.doing, { limit: 2, responseLanguage }));
  lines.push(...formatMissionListGroup("blocked", groups.blocked, { limit: 2, responseLanguage }));
  lines.push(...formatMissionListGroup("todo", groups.todo, { limit: 2, responseLanguage }));
  lines.push(...formatMissionListGroup("done", groups.done, { collapsed: true, responseLanguage }));
  if (missionGroupCount(groups.archived) > 0) {
    lines.push(...formatMissionListGroup("archived", groups.archived, { collapsed: true, responseLanguage }));
  }
  lines.push(responseLanguage === "en" ? "Ask explicitly if you need the full governance detail." : "如果还要完整治理细节，请明确提出。");
  return lines;
}

function formatDoveStatusForCli(result, target, options = {}) {
  const statusHome = result.statusHome ?? {};
  const nextStep = statusHome.nextStep ?? result.nextStep ?? null;
  const needsAttention = statusHome.needsAttention ?? result.needsAttention ?? null;
  const showMore = statusHome.showMore ?? result.showMore ?? {};
  const missionList = statusHome.optionalMissionDetails ?? result.optionalMissionDetails ?? result.dailyHome?.missionList ?? result.dashboard?.tasks?.grouped ?? {};
  const responseLanguage = result.responseLanguage ?? "zh";
  const headline = publicStatusText(statusHome.headline
    ?? result.headline
    ?? result.summary
    ?? (responseLanguage === "en"
      ? `Dove checked ${statusHome.currentContext?.title ?? result.projectSummary?.title ?? target ?? "this project"}.`
      : `Dove 已检查${statusHome.currentContext?.title ?? result.projectSummary?.title ?? target ?? "当前项目"}。`), 240);
  const nextLabel = publicStatusText(nextStep?.label, 200);
  const command = publicStatusCommand(nextStep?.copyableCommand ?? nextStep?.command, 180);
  const why = publicStatusText(needsAttention?.why ?? nextStep?.why ?? needsAttention?.summary, 240);
  const showMoreText = formatExpansionHint(showMore.text, responseLanguage);
  const lines = [headline].filter(Boolean);
  if (nextLabel) {
    lines.push(command
      ? (responseLanguage === "en" ? `${nextLabel}. You can run: ${command}` : `${nextLabel}。可以直接运行：${command}`)
      : nextLabel);
  }
  if (why && why !== headline && why !== nextLabel) {
    lines.push(why);
  }
  if (showMoreText) {
    lines.push(showMoreText);
  }
  if (options.showMissions) {
    lines.push("", ...formatMissionListForCli(missionList, responseLanguage));
  }
  return `${lines.join("\n")}\n`;
}

function publicMissionText(value, maxLength = 220) {
  const text = publicStatusText(value, maxLength);
  if (!text || /\.dove\/|\bproject:dove\.|\b(?:packetId|taskPacketId|missionPacketId|packetPath|boundaryType|workContract|executionContract|preActionGuidance|proposalOnly|noAutoApply)\b|Snapshot version-/iu.test(text)) {
    return "";
  }
  return text;
}

function formatDoveMissionForCli(result) {
  const responseLanguage = result.responseLanguage ?? "zh";
  const mission = result.mission ?? {};
  const goal = publicMissionText(mission.goal, 220);
  const lines = [responseLanguage === "en"
    ? "Dove checked this project. Start by turning the user's request into a task proposal; do not write or run anything until approved."
    : "Dove 已检查当前项目。先把用户需求整理成待确认任务；没有批准前，不写入也不执行。"];
  if (goal) {
    lines.push(responseLanguage === "en" ? `Current focus: ${goal}` : `当前关注：${goal}`);
  }
  lines.push(responseLanguage === "en"
    ? "Next: propose the task in plain language, name the evidence it needs, and wait for approval. After approval, materialize the contract and hand off to the recommended workflow."
    : "下一步：用人话给出任务草案，说明需要哪些证据，然后等确认；确认后只物化合同并交接推荐流程。");
  lines.push(responseLanguage === "en"
    ? "If materials are missing, stop and say exactly what needs to be supplied. Ask for JSON only when you need the full governance detail."
    : "如果缺材料，就停下来说明要补什么；只有需要完整治理细节时才要求 JSON。接下来可以直接给任务草案，不要输出内部字段。");
  return `${lines.join("\n")}\n`;
}

function formatDoveFigureForCli(result) {
  const card = result.resultCard ?? {};
  const action = Array.isArray(card.nextActions) ? card.nextActions[0] : null;
  const happened = compactText(card.happened ?? result.summary, 260);
  const next = compactText(action?.title, 220);
  const lines = [happened || "Dove 已检查这张图的工作流状态。"];
  if (next && next !== happened) {
    lines.push(next);
  }
  if (result.mutationMode === "patch-plan" || result.mutationPlan) {
    lines.push("这一步只是待确认方案，还没有直接改项目记录。");
  } else if (result.writesApplied === true) {
    lines.push("项目记录已经更新。");
  }
  if (card.requiresAction) {
    lines.push("接下来补齐它要求的材料或 SVG 输出，再让 Dove 继续检查这张图。");
  }
  return `${lines.filter(Boolean).join("\n")}\n`;
}

function formatDoveFigureJsonForCli(result) {
  return {
    presentation: "dove-figure-cli-result",
    status: result.status,
    figureId: result.figureId,
    runId: result.runId,
    resultCard: result.resultCard ?? null,
    mutationMode: result.mutationMode,
    writesApplied: result.writesApplied === true,
    mutationPlan: result.mutationPlan ?? null,
    detailsAvailable: true
  };
}

function formatDoveFigureErrorForCli(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/Task target requires confirmation|Task target is ambiguous|could not resolve a durable task packet|requires a durable task packet|No packets exist/u.test(message)) {
    return "这张图还不能开始：需要先选定一个 Dove 任务。先看当前最该推进的任务，或重新运行时带上明确任务。\n";
  }
  if (/follow-through still requires action|cannot override follow-through governance/u.test(message)) {
    return "这张图还不能继续：当前还有需要先处理的确认或结果回填。先按状态页的下一步补齐，再回到图表工作流。\n";
  }
  if (/secret|token|api key|inline/i.test(message)) {
    return "这张图还不能继续：检测到不安全的密钥或 provider 配置方式。请改用环境变量引用，不要把密钥写进请求或配置。\n";
  }
  return `这张图暂时不能继续：${compactText(message.replace(/\btask-[a-z0-9][a-z0-9-]*\b/giu, "当前任务"), 240)}\n`;
}

function buildDoveStatusline(result, target) {
  const statusHome = result.statusHome ?? {};
  const currentContext = statusHome.currentContext ?? result.currentContext ?? result.dashboard?.project ?? {};
  const primaryAction = statusHome.nextAction ?? result.nextAction ?? statusHome.nextSteps?.primary ?? result.dailyHome?.nextActions?.[0] ?? null;
  const gaps = statusHome.gaps ?? result.gaps ?? {};
  const executionGaps = gaps.executionGaps ?? result.dailyHome?.executionGaps?.counts ?? {};
  const focus = currentContext.currentFocus ?? result.projectSummary?.currentFocus;
  const gapParts = [];
  if (Number(executionGaps.missingContract ?? 0) > 0) {
    gapParts.push(`contract ${executionGaps.missingContract}`);
  }
  if (Number(executionGaps.missingMaterials ?? 0) > 0) {
    gapParts.push(`materials ${executionGaps.missingMaterials}`);
  }
  if (Number(executionGaps.verificationGaps ?? 0) > 0) {
    gapParts.push(`verify ${executionGaps.verificationGaps}`);
  }
  if (Number(gaps.boundaryCount ?? 0) > 0) {
    gapParts.push(`boundaries ${gaps.boundaryCount}`);
  }
  if (Number(gaps.readErrorCount ?? 0) > 0) {
    gapParts.push(`readErrors ${gaps.readErrorCount}`);
  }
  const textParts = [`Dove: ${compactText(currentContext.title ?? result.projectSummary?.title ?? "untitled", 50)}`];
  if (focus) {
    textParts.push(`focus ${compactText(focus, 70)}`);
  }
  if (primaryAction) {
    const action = primaryAction.copyableCommand ?? primaryAction.firstAction ?? primaryAction.command ?? primaryAction.title;
    textParts.push(`next ${compactText(action, 80)}`);
  }
  textParts.push(`gaps ${gapParts.length > 0 ? gapParts.join("/") : "clear"}`);
  return {
    mode: "dove-statusline",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    target,
    summary: {
      title: currentContext.title ?? result.projectSummary?.title ?? null,
      currentFocus: focus ?? null,
      nextAction: primaryAction ? {
        title: primaryAction.title ?? null,
        command: primaryAction.command ?? null,
        copyableCommand: primaryAction.copyableCommand ?? primaryAction.firstAction ?? null,
        kind: primaryAction.kind ?? null
      } : null,
      gaps: {
        status: gaps.status ?? "clear",
        boundaryType: gaps.boundaryType ?? result.boundaryType ?? null,
        boundaryCount: gaps.boundaryCount ?? 0,
        readErrorCount: gaps.readErrorCount ?? 0,
        executionGaps
      }
    },
    text: textParts.join(" | ")
  };
}

function formatDoveStatusline(result, target) {
  return `${buildDoveStatusline(result, target).text}\n`;
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
  const copiedUserHostPaths = [];
  let claudeCodeGateway = null;

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

  if (installPaths.userHosts.includes("claude")) {
    const claudeConfigRoot = resolveClaudeConfigRoot();
    const shellStartupFile = resolveClaudeShellStartupFile();
    for (const relativePath of writeClaudeUserCommandAdapters(claudeConfigRoot)) {
      copiedUserHostPaths.push({ host: "claude", path: relativePath, root: claudeConfigRoot });
    }
    claudeCodeGateway = configureClaudeCodeGatewayDefaults({ claudeConfigRoot, shellStartupFile });
  }

  ensureWorkspace(target);
  const copied = [...copiedCorePaths, ...copiedHostPaths.map((item) => item.path), ...copiedUserHostPaths.map((item) => `claude:${item.path}`), ...(claudeCodeGateway ? ["claude:code-gateway-defaults"] : []), ".dove/* (bootstrap only, user-owned state preserved)"];
  return {
    target,
    copied,
    copiedCorePaths,
    copiedHostPaths,
    copiedUserHostPaths,
    claudeCodeGateway,
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

function validateMetaOperatorLessonsShape(value) {
  const issues = [];
  const root = requireObject(value, ".dove/meta/operator-lessons.json", issues);
  if (!root) {
    return issues;
  }
  if (root.referenceOnly !== true) {
    issues.push(".dove/meta/operator-lessons.json.referenceOnly must be true");
  }
  if (root.explicitOnly !== true) {
    issues.push(".dove/meta/operator-lessons.json.explicitOnly must be true");
  }
  if (root.noAutoCapture !== true) {
    issues.push(".dove/meta/operator-lessons.json.noAutoCapture must be true");
  }
  if (root.noAutoApply !== true) {
    issues.push(".dove/meta/operator-lessons.json.noAutoApply must be true");
  }
  maybeArray(root, "lessons", ".dove/meta/operator-lessons.json.lessons", issues);
  maybeArray(root, "sourceArtifacts", ".dove/meta/operator-lessons.json.sourceArtifacts", issues);
  const rawTraceArtifacts = [
    ...(Array.isArray(root.sourceArtifacts) ? root.sourceArtifacts : []),
    ...(Array.isArray(root.lessons) ? root.lessons.flatMap((lesson) => Array.isArray(lesson?.sourceArtifacts) ? lesson.sourceArtifacts : []) : [])
  ].filter((artifactPath) => {
    const normalized = String(artifactPath ?? "").trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
    return normalized === "trellis/tasks" || normalized.startsWith("trellis/tasks/") || normalized === ".trellis/tasks" || normalized.startsWith(".trellis/tasks/");
  });
  if (rawTraceArtifacts.length > 0) {
    issues.push(`.dove/meta/operator-lessons.json cannot cite raw .trellis/tasks artifacts: ${rawTraceArtifacts.join(", ")}`);
  }
  const summary = maybeObject(root, "summary", ".dove/meta/operator-lessons.json.summary", issues);
  if (summary) {
    maybeArray(summary, "topLessonIds", ".dove/meta/operator-lessons.json.summary.topLessonIds", issues);
    maybeArray(summary, "topTags", ".dove/meta/operator-lessons.json.summary.topTags", issues);
    maybeArray(summary, "topDomains", ".dove/meta/operator-lessons.json.summary.topDomains", issues);
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

function inspectOperatorLessons(target) {
  const lessons = readJsonFile(target, ".dove/meta/operator-lessons.json");
  if (lessons.status !== "ok") {
    return {
      status: lessons.status === "missing" ? "ok" : "degraded",
      lessonCount: 0,
      activeLessonCount: 0,
      topLessonIds: [],
      reasons: lessons.status === "missing" ? [] : [lessons.message]
    };
  }
  const shapeIssues = validateMetaOperatorLessonsShape(lessons.value);
  if (shapeIssues.length > 0) {
    return {
      status: "degraded",
      lessonCount: 0,
      activeLessonCount: 0,
      topLessonIds: [],
      reasons: shapeIssues
    };
  }
  const normalized = normalizeMetaOperatorLessonsIndex(lessons.value);
  return {
    status: "ok",
    lessonCount: normalized.summary.lessonCount,
    activeLessonCount: normalized.summary.activeLessonCount,
    topLessonIds: normalized.summary.topLessonIds,
    topTags: normalized.summary.topTags,
    topDomains: normalized.summary.topDomains,
    lessonsPath: normalized.summary.lessonsPath,
    reasons: []
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
      ignoredStaleWorkspaceArtifacts: [],
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
  const ignoredStaleWorkspaceArtifacts = staleLegacyArtifacts;

  return {
    status: reasons.length === 0 ? "ok" : "degraded",
    strategy: normalized.strategy,
    activeDurableRoot: normalized.activeDurableRoot,
    authoritativeRoot: normalized.authoritativeRoot,
    currentWriteAuthority: normalized.currentWriteAuthority,
    manifestPath: normalized.manifestPath,
    legacyRoot: normalized.legacyRoot,
    staleLegacyArtifacts,
    ignoredStaleWorkspaceArtifacts,
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
    ["raw-meta-operator-lessons-shape", ".dove/meta/operator-lessons.json", validateMetaOperatorLessonsShape],
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
  const operatorLessons = readJsonFile(target, ".dove/meta/operator-lessons.json");
  const longHorizonMemory = readJsonFile(target, ".dove/meta/long-horizon-memory.json");
  const workspaceIndex = readJsonFile(target, ".dove/workspace/index.json");

  if ([recommendations, optimizerState, operatorPlaybooks, operatorLessons, longHorizonMemory, workspaceIndex].some((item) => item.status !== "ok")) {
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
    ...validateMetaOperatorLessonsShape(operatorLessons.value),
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
  const normalizedOperatorLessons = normalizeMetaOperatorLessonsIndex(operatorLessons.value);
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
  if (normalizedOptimizerState.operatorLessons.lessonCount !== normalizedOperatorLessons.lessons.length) {
    mismatches.push("optimizer state operatorLessons count drift");
  }
  if (normalizedWorkspaceMetaOptimize.operatorLessons.lessonCount !== normalizedOperatorLessons.lessons.length) {
    mismatches.push("workspace metaOptimize operatorLessons count drift");
  }
  if (JSON.stringify(normalizedOptimizerState.operatorLessons.topLessonIds) !== JSON.stringify(normalizedOperatorLessons.summary.topLessonIds)) {
    mismatches.push("optimizer state operatorLessons topLessonIds drift");
  }
  if (JSON.stringify(normalizedWorkspaceMetaOptimize.operatorLessons.topLessonIds) !== JSON.stringify(normalizedOperatorLessons.summary.topLessonIds)) {
    mismatches.push("workspace metaOptimize operatorLessons topLessonIds drift");
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
      relatedArtifactPaths: [".dove/meta/optimizer-state.json", ".dove/meta/long-horizon-memory.json", ".dove/meta/operator-lessons.json", ".dove/workspace/index.json"],
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
  const operatorLessons = readJsonFile(target, ".dove/meta/operator-lessons.json");
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
  if (operatorLessons.status !== "ok") {
    return { status: operatorLessons.status, recommendationCount: 0, clusterCount: 0, topClusterIds: [], reasons: [operatorLessons.message] };
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
    ...validateMetaOperatorLessonsShape(operatorLessons.value),
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
  const normalizedOperatorLessons = normalizeMetaOperatorLessonsIndex(operatorLessons.value);
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
    && normalizedWorkspaceMetaOptimize.operatorLessons.lessonCount === normalizedOperatorLessons.lessons.length
    && JSON.stringify(normalizedWorkspaceMetaOptimize.operatorLessons.topLessonIds) === JSON.stringify(normalizedOperatorLessons.summary.topLessonIds)
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
    operatorLessons: normalizedOperatorLessons.summary,
    topLessonIds: Array.isArray(normalizedOperatorLessons.summary.topLessonIds) ? normalizedOperatorLessons.summary.topLessonIds : [],
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
      `operator lessons: ${normalizedOperatorLessons.summary.activeLessonCount ?? 0} active / ${normalizedOperatorLessons.summary.lessonCount ?? 0} total (${normalizedOperatorLessons.summary.topLessonIds.join(", ") || "none"})`,
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

function shouldInspectClaudeCodeGatewayDefaults(preflight) {
  return Boolean(process.env.DOVE_CLAUDE_CONFIG_DIR || process.env.DOVE_CLAUDE_SHELL_RC || preflight?.shell?.hasManagedBlock);
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
    ".dove/meta/operator-lessons.json",
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
    warnings: [],
    hostAdapters: installedHosts,
    claudeCodeGateway: null,
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

  const claudeConfigRoot = resolveClaudeConfigRoot();
  const shellStartupFile = resolveClaudeShellStartupFile();
  const claudeGatewayPreflight = inspectClaudeCodeGatewayDefaults({ claudeConfigRoot, shellStartupFile });
  if (shouldInspectClaudeCodeGatewayDefaults(claudeGatewayPreflight)) {
    result.claudeCodeGateway = claudeGatewayPreflight;
    result.checks.push({
      check: "claude-code-gateway",
      ok: claudeGatewayPreflight.ok,
      message: claudeGatewayPreflight.ok
        ? "Claude Code gateway defaults are configured"
        : claudeGatewayPreflight.issues.join(" | ")
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

  const rawManagedArtifactChecks = collectRawManagedArtifactChecks(target);
  result.checks.push(...rawManagedArtifactChecks);
  const rawManagedArtifactChecksPassed = rawManagedArtifactChecks.every((check) => check.ok);
  const rawMetaOptimizeConsistency = collectRawMetaOptimizeConsistencyCheck(target);
  result.checks.push(rawMetaOptimizeConsistency);

  if (rawJsonChecksPassed && boundaryRawParseOk && rawManagedArtifactChecksPassed) {
    ensureWorkspace(target);
    try {
      refreshDurableSurfaces(target, {
        type: "doctor",
        summary: "Refreshed durable surfaces during doctor health check.",
        artifactPaths: [ARTIFACT_PATHS.workspaceIndex, ARTIFACT_PATHS.metaGovernanceCoverage, ARTIFACT_PATHS.metaGovernanceCoverageReport]
      });
      result.checks.push({ check: "durable-surface-refresh", ok: true, message: "durable surfaces refreshed" });
    } catch (error) {
      result.checks.push({ check: "durable-surface-refresh", ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  }
  result.missing = required.filter((relativePath) => !fs.existsSync(path.join(target, relativePath)));
  result.healthy = result.missing.length === 0;

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
    operatorLessons: inspectOperatorLessons(target),
    onboardingArtifactMap: inspectOnboardingArtifactMap(target),
    doveAuthorityManifest: inspectDoveAuthority(target),
    autonomyRuntime: inspectAutonomyRuntime(target),
    programsSurface: inspectProgramsSurface(target),
    governanceCoverageBindings: inspectGovernanceCoverageSurfaceBindings(target, { requireCommandSurfaces: installedHosts.includes("opencode") })
  };
  result.managedArtifacts = managedArtifacts;
  const ignoredStaleWorkspaceArtifacts = managedArtifacts.doveAuthorityManifest.ignoredStaleWorkspaceArtifacts ?? managedArtifacts.doveAuthorityManifest.staleLegacyArtifacts ?? [];
  if (ignoredStaleWorkspaceArtifacts.length > 0) {
    result.warnings.push({
      code: "ignored-stale-workspace-artifacts",
      severity: "warning",
      paths: ignoredStaleWorkspaceArtifacts,
      message: "Ignored stale workspace artifacts were found; they are not Dove authority and do not affect package health."
    });
  }
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
    check: "operator-lessons",
    ok: managedArtifacts.operatorLessons.status === "ok",
    message: managedArtifacts.operatorLessons.status === "ok"
      ? `operator lessons: ${managedArtifacts.operatorLessons.activeLessonCount} active / ${managedArtifacts.operatorLessons.lessonCount} total`
      : managedArtifacts.operatorLessons.reasons.join(" | ")
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

function runDoveSurface(surface, rawTarget, rawRest = []) {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(rawTarget, rawRest);
  if (surface === "orchestrate") {
    return queryDoveOrchestrate(target, buildDoveOrchestrateArgs(commandRest));
  }
  if (surface === "mission") {
    return queryDoveMission(target, buildDoveMissionArgs(commandRest));
  }
  if (surface === "status") {
    return queryDoveStatus(target, buildDoveStatusArgs(commandRest));
  }
  if (surface === "audit") {
    return queryDoveAudit(target, buildDoveAuditArgs(commandRest));
  }
  if (surface === "return") {
    return queryDoveReturn(target, buildDoveReturnArgs(commandRest));
  }
  return withMutationContext(target, "launch_dove_mission", commandRest, (cleanRest) => launchDoveMission(target, buildDoveLaunchArgs(cleanRest)));
}

if (!command || command === "help" || command === "--help") {
  usage();
  process.exit(0);
}

if (command === "install" || command === "sync") {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(maybeTarget, rest);
  rejectPatchPlanMode(command, commandRest, "install/sync copies adapter files and may write user-level host configuration, so use direct-process only.");
  const cleanRest = stripMutationModeFlag(commandRest);
  const result = installOrSync(target, cleanRest.includes("--force"), cleanRest);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (command === "doctor") {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(maybeTarget, rest);
  rejectPatchPlanMode(command, commandRest, "doctor may bootstrap missing workspace files while checking health, so use direct-process only.");
  doctor(target);
  process.exit(process.exitCode ?? 0);
}

if (command === "onboard") {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(maybeTarget, rest);
  const mutating = commandRest.includes("--write-map") || commandRest.includes("--mutation-mode");
  const result = mutating
    ? withMutationContext(target, "dove_onboard", commandRest, (cleanRest) => discoverPaperArtifacts(target, buildOnboardingArgs(cleanRest)))
    : discoverPaperArtifacts(target, buildOnboardingArgs(commandRest));
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (command === "publish-status") {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(maybeTarget, rest);
  const result = withMutationContext(target, "publish_dove_status", commandRest, (cleanRest) => publishDoveStatus(target, {
    includeArchived: cleanRest.includes("--include-archived"),
    responseLanguage: readFlagValue(cleanRest, "--response-language") ?? readFlagValue(cleanRest, "--language")
  }));
  if (!commandRest.includes("--quiet")) {
    console.log(JSON.stringify(result, null, 2));
  }
  process.exit(0);
}

if (command === "publish-global-status") {
  const commandRest = [maybeTarget, ...rest].filter(Boolean);
  const target = resolveTarget(".");
  const result = withMutationContext(target, "publish_dove_global_status", commandRest, (cleanRest) => {
    const projectRoots = [
      ...readPositionalArgs(cleanRest, ["--project", "--output", "--response-language", "--language", "--generated-at"]),
      ...readFlagValues(cleanRest, ["--project"])
    ];
    return publishDoveGlobalStatus(target, {
      projectRoots,
      outputDir: readFlagValue(cleanRest, "--output"),
      refresh: cleanRest.includes("--refresh"),
      includeConfig: cleanRest.includes("--include-config"),
      includeArchived: cleanRest.includes("--include-archived"),
      responseLanguage: readFlagValue(cleanRest, "--response-language") ?? readFlagValue(cleanRest, "--language"),
      generatedAt: readFlagValue(cleanRest, "--generated-at")
    });
  });
  if (!commandRest.includes("--quiet")) {
    console.log(JSON.stringify(result, null, 2));
  }
  process.exit(0);
}

if (command === "serve-global-status") {
  const commandRest = [maybeTarget, ...rest].filter(Boolean);
  rejectPatchPlanMode(command, commandRest, "serving can start a foreground server and may write global/Cloudflare configuration, so use direct-process only.");
  const cleanRest = stripMutationModeFlag(commandRest);
  const valueFlags = ["--project", "--output", "--response-language", "--language", "--generated-at", "--auth-user", "--auth-username", "--auth-password-env", "--domain", "--hostname", "--port", "--host", "--tunnel-name", "--cloudflared-path", "--cloudflare-config", "--credentials-file", "--token-env", "--dns-resolver-addrs"];
  const projectRoots = [
    ...readPositionalArgs(cleanRest, valueFlags),
    ...readFlagValues(cleanRest, ["--project"])
  ];
  const auth = cleanRest.includes("--no-auth") ? false : (cleanRest.includes("--auth") ? true : undefined);
  const cloudflare = cleanRest.includes("--no-cloudflare") ? false : (cleanRest.includes("--cloudflare") ? true : undefined);
  const result = await runGlobalStatusServingForeground(resolveTarget("."), {
    projectRoots,
    outputDir: readFlagValue(cleanRest, "--output"),
    refresh: cleanRest.includes("--refresh"),
    includeConfig: cleanRest.includes("--include-config"),
    includeArchived: cleanRest.includes("--include-archived"),
    responseLanguage: readFlagValue(cleanRest, "--response-language") ?? readFlagValue(cleanRest, "--language"),
    generatedAt: readFlagValue(cleanRest, "--generated-at"),
    auth,
    authUser: readFlagValue(cleanRest, "--auth-user") ?? readFlagValue(cleanRest, "--auth-username"),
    authPasswordEnv: readFlagValue(cleanRest, "--auth-password-env"),
    cloudflare,
    configureCloudflare: cleanRest.includes("--configure-cloudflare"),
    domain: readFlagValue(cleanRest, "--domain") ?? readFlagValue(cleanRest, "--hostname"),
    port: readFlagValue(cleanRest, "--port"),
    host: readFlagValue(cleanRest, "--host"),
    tunnelName: readFlagValue(cleanRest, "--tunnel-name"),
    cloudflaredPath: readFlagValue(cleanRest, "--cloudflared-path"),
    cloudflareConfigPath: readFlagValue(cleanRest, "--cloudflare-config"),
    credentialsFile: readFlagValue(cleanRest, "--credentials-file"),
    tokenEnv: readFlagValue(cleanRest, "--token-env"),
    dnsResolverAddrs: readFlagValues(cleanRest, ["--dns-resolver-addrs"]),
    dryRun: cleanRest.includes("--dry-run")
  });
  if (!cleanRest.includes("--quiet")) {
    console.log(JSON.stringify(result, null, 2));
  }
  process.exit(0);
}

if (command === "statusline") {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(maybeTarget, rest);
  const result = queryDoveStatus(target, buildDoveStatusArgs(commandRest));
  const statusline = buildDoveStatusline(result, target);
  if (wantsJsonOutput(commandRest)) {
    await printJson(statusline);
  } else {
    await writeStdout(formatDoveStatusline(result, target));
  }
  process.exit(0);
}

if (command === "figure") {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(maybeTarget, rest);
  try {
    const result = withMutationContext(target, "run_figure_workflow", commandRest, (cleanRest) => runFigureWorkflow(target, buildDoveFigureArgs(cleanRest)), { defaultMutationMode: "patch-plan" });
    if (wantsJsonOutput(commandRest)) {
      await printJson(formatDoveFigureJsonForCli(result));
    } else {
      await writeStdout(formatDoveFigureForCli(result));
    }
    process.exit(0);
  } catch (error) {
    if (wantsJsonOutput(commandRest)) {
      await printJson({ status: "blocked", message: formatDoveFigureErrorForCli(error).trim() });
    } else {
      await writeStdout(formatDoveFigureErrorForCli(error));
    }
    process.exit(1);
  }
}

if (["orchestrate", "mission", "status", "audit", "return", "launch"].includes(command)) {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(maybeTarget, rest);
  if (command === "status" && (commandRest.includes("--help") || commandRest.includes("-h"))) {
    statusUsage();
    process.exit(0);
  }
  const result = runDoveSurface(command, target, commandRest);
  if (command === "status" && !wantsJsonOutput(commandRest)) {
    await writeStdout(formatDoveStatusForCli(result, target, { showMissions: wantsDoveStatusMissionDetails(buildDoveStatusArgs(commandRest)) }));
  } else if (command === "mission" && !wantsJsonOutput(commandRest)) {
    await writeStdout(formatDoveMissionForCli(result));
  } else {
    await printJson(result);
  }
  process.exit(0);
}

if (command === "isolated-review-prepare") {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(maybeTarget, rest);
  const result = withMutationContext(target, "prepare_isolated_review", commandRest, (cleanRest) => prepareIsolatedReview(target, buildIsolatedReviewArgs(cleanRest)));
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (command === "isolated-review-import") {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(maybeTarget, rest);
  const result = withMutationContext(target, "import_isolated_review", commandRest, (cleanRest) => importIsolatedReview(target, {
    runId: readFlagValue(cleanRest, "--run-id"),
    handoffPath: readFlagValue(cleanRest, "--handoff"),
    reportPath: readFlagValue(cleanRest, "--report")
  }));
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (command === "isolated-review") {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(maybeTarget, rest);
  if (readMutationMode(commandRest) === "patch-plan") {
    throw new Error("isolated-review cannot run an external reviewer in patch-plan mode; use isolated-review-prepare, apply the returned plan with host-tracked edits, then run/import the reviewer artifacts.");
  }
  const result = withMutationContext(target, "run_isolated_review", commandRest, (cleanRest) => {
    const reviewerCommand = readFlagValue(cleanRest, "--reviewer-command") ?? process.env.DOVE_ISOLATED_REVIEWER_COMMAND;
    const prepared = runIsolatedReview(target, buildIsolatedReviewArgs(cleanRest));
    const reviewer = invokeIsolatedReviewer(reviewerCommand, prepared, target);
    const imported = importIsolatedReview(target, prepared.importArgs);
    return {
      ...imported,
      status: "completed",
      runId: prepared.runId,
      reviewerCommandConfigured: Boolean(reviewerCommand),
      reviewerExitStatus: reviewer.status
    };
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (command === "autonomy-once") {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(maybeTarget, rest);
  const result = withMutationContext(target, "run_autonomy_once", commandRest, (cleanRest) => runAutonomyControlPlaneOnce(target, {
    actorRole: readFlagValue(cleanRest, "--actor-role") ?? "planner"
  }));
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (command === "autonomy-foreground") {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(maybeTarget, rest);
  const result = withMutationContext(target, "run_autonomy_foreground", commandRest, (cleanRest) => {
    const maxSteps = readFlagValue(cleanRest, "--max-steps");
    return runAutonomyForeground(target, {
      actorRole: readFlagValue(cleanRest, "--actor-role") ?? "planner",
      maxSteps: maxSteps ? Number(maxSteps) : undefined,
      packetId: readFlagValue(cleanRest, "--packet-id"),
      programRunId: readFlagValue(cleanRest, "--program-run-id"),
      approvalId: readFlagValue(cleanRest, "--approval-id")
    });
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (command === "autonomy-operate") {
  const { target, rest: commandRest } = resolveOptionalTargetAndRest(maybeTarget, rest);
  const result = withMutationContext(target, "run_autonomy_operate", commandRest, (cleanRest) => {
    const maxSteps = readFlagValue(cleanRest, "--max-steps");
    return runAutonomyOperate(target, {
      actorRole: readFlagValue(cleanRest, "--actor-role") ?? "planner",
      workerRole: readFlagValue(cleanRest, "--worker-role") ?? "researcher",
      maxSteps: maxSteps ? Number(maxSteps) : undefined,
      objective: readFlagValue(cleanRest, "--objective"),
      sourceType: readFlagValue(cleanRest, "--source-type"),
      sourceId: readFlagValue(cleanRest, "--source-id"),
      packetId: readFlagValue(cleanRest, "--packet-id"),
      programId: readFlagValue(cleanRest, "--program-id"),
      programRunId: readFlagValue(cleanRest, "--program-run-id"),
      approvalId: readFlagValue(cleanRest, "--approval-id"),
      campaignId: readFlagValue(cleanRest, "--campaign-id"),
      campaignStepId: readFlagValue(cleanRest, "--campaign-step-id"),
      executeBy: readFlagValue(cleanRest, "--execute-by"),
      reviewAfter: readFlagValue(cleanRest, "--review-after"),
      expiresAt: readFlagValue(cleanRest, "--expires-at")
    });
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (isHostOnlyDoveSurface(command)) {
  hostOnlySurfaceUsage(command);
  const wantsSurfaceHelp = maybeTarget === "--help" || maybeTarget === "-h" || rest.includes("--help") || rest.includes("-h");
  process.exit(wantsSurfaceHelp ? 0 : 1);
}

usage();
process.exit(1);
