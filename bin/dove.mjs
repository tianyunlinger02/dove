#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseDoveCli } from "../src/cli/command-parser.mjs";
import { renderProjectIntegrationResult } from "../src/cli/project-integration-output.mjs";
import { renderDoveHome } from "../src/cli/terminal-output.mjs";
import { userPromptSubmitOutput } from "../src/core/ambient-hook.mjs";
import { resolveExecutionReceiptPostCommit } from "../src/core/execution-receipts.mjs";
import { PROJECT_HOST_IDS } from "../src/core/host-registry.mjs";
import { resolveDoveResponseLanguage } from "../src/core/i18n.mjs";
import { readDoveLessons, updateDoveLessons } from "../src/core/lessons.mjs";
import { createDoveMission, manageDoveWorkspace, newMissionId } from "../src/core/mission-contracts.mjs";
import { queryDoveStatus, resolveMissionNumber } from "../src/core/mission-queries.mjs";
import { prepareResearchDecisionReevaluation, reevaluateResearchDecision } from "../src/core/research-decision-reevaluation.mjs";
import { runWithMutationContext } from "../src/core/mutation-backend.mjs";
import { operationForTool } from "../src/core/operation-registry.mjs";
import { classifyInvocationError, classifyInvocationOutcome } from "../src/core/operational-outcome.mjs";
import { inspectProjectDoctor } from "../src/core/project-doctor.mjs";
import { initializeProjectIntegration, syncProjectIntegration } from "../src/core/project-installation.mjs";
import { readProjectInstallationManifest } from "../src/core/project-installation-manifest.mjs";
import { resolveInstalledProjectRoot, resolveProjectRootForInit } from "../src/core/project-root.mjs";
import { publicErrorResult, publicResult, renderPublicReport } from "../src/core/public-reports.mjs";
import { recordDoveDraft, recordDoveFigure, recordDoveRebuttal, runExperienceWorkflow } from "../src/core/retained-domain-workflows.mjs";
import { archiveReviewRecord, scopeReviewRecord } from "../src/core/review-records.mjs";
import { querySources, registerSource, verifySource } from "../src/core/source-trust.mjs";
import { startServer } from "../src/mcp/server.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const PACKAGE = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"));
const PACKAGE_OPTIONS = { packageName: PACKAGE.name, packageVersion: PACKAGE.version };
const BUSINESS_COMMANDS = new Set(["mission", "status", "lessons", "source", "experiment", "draft", "figure", "review", "rebuttal"]);
const KNOWN_COMMANDS = new Set(["init", "sync", "doctor", "workspace", "mcp", "hook", ...BUSINESS_COMMANDS]);

function usage() {
  console.log(`dove

Usage:
  dove --help
  dove --version
  dove init [--project <dir>] [--host <host>...]
  dove sync [--project <dir>] [--host <host>...]
  dove doctor [--project <dir>]
  dove workspace init|revise-mainline|migrate|reset [--project <dir>] ...
  dove mcp serve --project <dir>
  dove hook user-prompt-submit --project <dir>
  dove mission [target] [--project <dir>] --operation create-root|branch|reevaluate-research-decision --mode ordinary|research --goal <text> ...
  dove status [target] [--project <dir>] [--mission-number <number>] [--detail compact|full]
  dove lessons [read|update] [target] [--project <dir>] [--binding <opaque-binding>] [--markdown <complete-markdown>]
  dove source [query|register|verify] [target] [--project <dir>] --mission-number <number> ...
  dove experiment [target] [--project <dir>] --mission-number <number> --experiment-id <id> --protocol-json <json> [--result-json <json>]
  dove draft|figure|rebuttal [target] [--project <dir>] --mission-number <number> --artifact-path <path> ...
  dove review [target] [--project <dir>] --scope --mission-number <number> --review-mission-binding <opaque-binding> --host-kind claude|opencode --artifact <path>...
  dove review [target] [--project <dir>] --archive --mission-number <number> --scope-binding-json <json> --status completed|blocked|failed --verdict coherent|needs-revision|needs-evidence|blocked ...

Project integration is separate from current research state. Init and sync manage only project integration. The explicit Workspace operation establishes the project mainline; Mission contracts remain current Schema 18 records with explicit root or child provenance.
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

function optionalPositiveInteger(args, flag) {
  if (!args.includes(flag)) return undefined;
  const raw = readFlagValue(args, flag);
  if (!/^\d+$/u.test(raw ?? "")) throw new Error(`${flag} must be an integer greater than or equal to 1.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${flag} must be an integer greater than or equal to 1.`);
  return value;
}

function missionIdForNumber(root, args) {
  const missionNumber = optionalPositiveInteger(args, "--mission-number");
  if (missionNumber === undefined) return undefined;
  return resolveMissionNumber(root, missionNumber, { operation: "Dove CLI mission selection" }).missionId;
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

function projectFlag(args) {
  return optionalFlagValue(args, "--project");
}

function projectStart(rawTarget, args, { allowPositional = true } = {}) {
  const explicitProject = projectFlag(args);
  if (rawTarget !== undefined && !allowPositional) throw new Error("This command does not accept a positional project target.");
  if (rawTarget !== undefined && explicitProject !== undefined) throw new Error("A positional project target cannot be combined with --project.");
  return resolveTarget(explicitProject ?? rawTarget ?? ".");
}

function resolveBusinessTarget(rawTarget, args) {
  return resolveInstalledProjectRoot(projectStart(rawTarget, args));
}

function selectedHosts(args) {
  const raw = readFlagValues(args, "--host");
  if (raw.length === 0) return undefined;
  const requested = raw.flatMap((value) => value.split(",").map((item) => item.trim()).filter(Boolean));
  const expanded = requested.includes("all") ? PROJECT_HOST_IDS : requested;
  return [...new Set(expanded)];
}

function assertClaudeInstalled(root) {
  const manifest = readProjectInstallationManifest(root, { hostIds: PROJECT_HOST_IDS });
  if (!manifest.hosts.includes("claude")) throw new Error("Dove project runtime requires Claude host integration. Run dove init --host claude for this project.");
  return manifest;
}

function writeIntegrationResult(command, result, args) {
  if (wantsJson(args)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(renderProjectIntegrationResult(command, result, {
    stream: process.stdout,
    env: process.env
  }));
}

function writeDoctorResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

function runMutation(target, actionId, args, callback, fallback = "patch-plan") {
  const cleanArgs = withoutMutationMode(args);
  const result = runWithMutationContext(target, { actionId, mutationMode: mutationMode(args, fallback), hostId: "cli" }, () => callback(cleanArgs));
  return resolveExecutionReceiptPostCommit(target, result);
}

function workspaceArgs(action, args) {
  const goal = optionalFlagValue(args, "--goal");
  const mainline = optionalFlagValue(args, "--mainline");
  const changeReason = optionalFlagValue(args, "--change-reason");
  if (action === "init") {
    if (args.includes("--archive") || changeReason !== undefined) throw new Error("dove workspace init does not accept --archive or --change-reason.");
    return definedObject({ operation: "initialize", goal, mainline, mutationMode: mutationMode(args, "direct-process") });
  }
  if (action === "revise-mainline") {
    if (args.includes("--archive")) throw new Error("dove workspace revise-mainline does not accept --archive.");
    return definedObject({ operation: "revise-mainline", goal, mainline, changeReason, mutationMode: mutationMode(args, "direct-process") });
  }
  if (action === "migrate") {
    if (goal !== undefined || mainline !== undefined || changeReason !== undefined || args.includes("--archive")) throw new Error("dove workspace migrate accepts no goal, mainline, change reason, or archive fields.");
    return { operation: "migrate-workspace", mutationMode: mutationMode(args, "direct-process") };
  }
  if (action === "reset") {
    if (!args.includes("--archive")) throw new Error("dove workspace reset requires --archive.");
    return definedObject({ operation: "initialize", goal, mainline, archiveReset: true, mutationMode: mutationMode(args, "direct-process") });
  }
  throw new Error("dove workspace accepts only init, revise-mainline, migrate, or reset.");
}

function missionArgs(args) {
  const operation = optionalFlagValue(args, "--operation");
  const result = definedObject({
    operation,
    mutationMode: mutationMode(args, "direct-process"),
    missionNumber: optionalPositiveInteger(args, "--mission-number"),
    missionGoal: optionalFlagValue(args, "--mission-goal"),
    mode: optionalFlagValue(args, "--mode"),
    goal: optionalFlagValue(args, "--goal"),
    requirements: optionalFlagValues(args, "--requirement"),
    assumptions: optionalFlagValues(args, "--assumption"),
    scope: optionalFlagValues(args, "--scope"),
    outOfScope: optionalFlagValues(args, "--out-of-scope"),
    artifacts: args.includes("--artifact-json") ? parseRepeatedJson(args, "--artifact-json") : undefined,
    completionCriteria: optionalFlagValues(args, "--completion-criterion"),
    evidenceRequirements: optionalFlagValues(args, "--evidence-requirement"),
    dependsOnMissionNumbers: args.includes("--depends-on-mission-number") ? readFlagValues(args, "--depends-on-mission-number").map((value) => {
      if (!/^\d+$/u.test(value)) throw new Error("--depends-on-mission-number must contain integers greater than or equal to 1.");
      const number = Number(value);
      if (!Number.isSafeInteger(number) || number < 1) throw new Error("--depends-on-mission-number must contain integers greater than or equal to 1.");
      return number;
    }) : undefined,
    parentMissionNumber: optionalPositiveInteger(args, "--parent-mission-number"),
    branchKind: optionalFlagValue(args, "--branch-kind"),
    branchReason: optionalFlagValue(args, "--branch-reason"),
    stopParentReason: optionalFlagValue(args, "--stop-parent-reason"),
    handoffArtifactPaths: optionalFlagValues(args, "--handoff-artifact"),
    requestedDisposition: optionalFlagValue(args, "--requested-disposition"),
    synthesis: optionalFlagValue(args, "--synthesis"),
    hypotheses: args.includes("--hypothesis-json") ? parseRepeatedJson(args, "--hypothesis-json") : undefined,
    routes: args.includes("--route-json") ? parseRepeatedJson(args, "--route-json") : undefined,
    openQuestions: args.includes("--open-question-json") ? parseRepeatedJson(args, "--open-question-json") : undefined,
    evidenceRefs: optionalFlagValues(args, "--evidence-ref"),
    reasonCodes: optionalFlagValues(args, "--reason-code")
  });
  if (args.includes("--next-action-json")) result.nextAction = parseJson(readFlagValue(args, "--next-action-json"), "--next-action-json");
  return result;
}

function lessonsUpdateArgs(args) {
  return {
    binding: readFlagValue(args, "--binding"),
    markdown: readFlagValue(args, "--markdown")
  };
}

function receiptArgs(args, root) {
  const input = readFlagValue(args, "--input");
  if (input) {
    const fullPath = path.resolve(root, input);
    const relative = path.relative(root, fullPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("--input must stay inside the selected workspace.");
    const parsed = parseJson(fs.readFileSync(fullPath, "utf8"), "--input");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("--input must contain a JSON object.");
    if (Object.hasOwn(parsed, "missionId")) throw new Error("--input must use missionNumber, not a private missionId.");
    const mission = resolveMissionNumber(root, parsed.missionNumber, { operation: "Dove CLI receipt mission selection" });
    const { missionNumber: ignoredMissionNumber, ...rest } = parsed;
    return { ...rest, missionId: mission.missionId };
  }
  return definedObject({
    receiptId: optionalFlagValue(args, "--receipt-id"),
    missionId: missionIdForNumber(root, args),
    contractDigest: optionalFlagValue(args, "--contract-digest"),
    summary: optionalFlagValue(args, "--summary"),
    artifacts: args.includes("--artifact-json") ? parseRepeatedJson(args, "--artifact-json") : undefined,
    validations: args.includes("--validation-json") ? parseRepeatedJson(args, "--validation-json") : undefined,
    criteriaSatisfied: args.includes("--criterion-json") ? parseRepeatedJson(args, "--criterion-json") : undefined,
    producedAt: optionalFlagValue(args, "--produced-at")
  });
}

function sourceArgs(root, args, action) {
  if (action === "query") return definedObject({ missionId: missionIdForNumber(root, args), sourceId: optionalFlagValue(args, "--source-id") });
  if (action === "verify") return definedObject({
    missionId: missionIdForNumber(root, args),
    sourceId: optionalFlagValue(args, "--source-id"),
    method: optionalFlagValue(args, "--method"),
    checkedMaterial: optionalFlagValue(args, "--checked-material"),
    auditEvidence: args.includes("--audit-evidence-json") ? parseJson(readFlagValue(args, "--audit-evidence-json"), "--audit-evidence-json") : undefined
  });
  return definedObject({
    missionId: missionIdForNumber(root, args),
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

function reviewArgs(root, args) {
  const modes = ["scope", "archive"].filter((mode) => args.includes(`--${mode}`));
  if (modes.length > 1) throw new Error("dove review accepts one operation mode.");
  const mode = modes[0] ?? "scope";
  const missionId = missionIdForNumber(root, args);
  if (mode === "scope") return { mode, args: { missionId, reviewMissionBinding: readFlagValue(args, "--review-mission-binding"), hostKind: readFlagValue(args, "--host-kind"), artifactPaths: readFlagValues(args, "--artifact") } };
  return { mode, args: definedObject({
    missionId,
    scopeBinding: optionalFlagValue(args, "--scope-binding-json") ? parseJson(optionalFlagValue(args, "--scope-binding-json"), "--scope-binding-json") : undefined,
    status: optionalFlagValue(args, "--status"), verdict: optionalFlagValue(args, "--verdict"), summary: optionalFlagValue(args, "--summary"),
    findings: optionalFlagValue(args, "--findings-json") ? parseJson(optionalFlagValue(args, "--findings-json"), "--findings-json") : undefined,
    actionItems: optionalFlagValues(args, "--action-item"), report: optionalFlagValue(args, "--report"),
    provenance: optionalFlagValue(args, "--provenance-json") ? parseJson(optionalFlagValue(args, "--provenance-json"), "--provenance-json") : undefined
  }) };
}

function statusArgs(args) {
  const detail = optionalFlagValue(args, "--detail");
  if (detail !== undefined && !["compact", "full"].includes(detail)) throw new Error("--detail must be compact or full.");
  const language = optionalFlagValue(args, "--language");
  if (language !== undefined && !["zh", "en"].includes(language)) throw new Error("--language must be zh or en.");
  return definedObject({ missionNumber: optionalPositiveInteger(args, "--mission-number"), detail, language });
}

function wantsJson(args) {
  return args.includes("--json") || readFlagValue(args, "--format") === "json";
}

function toolForCommand(command, { lessonsAction = "read", sourceAction = "query", args = [] } = {}) {
  switch (command) {
    case "init": return null;
    case "mission": return "create_dove_mission";
    case "status": return "query_dove_status";
    case "lessons": return lessonsAction === "update" ? "update_dove_lessons" : "read_dove_lessons";
    case "source": return sourceAction === "register" ? "register_source" : sourceAction === "verify" ? "verify_source" : "query_sources";
    case "experiment": return "record_dove_experiment";
    case "draft": return "record_dove_draft";
    case "figure": return "record_dove_figure";
    case "review": return args.includes("--archive") ? "archive_review_record" : "scope_review_record";
    case "rebuttal": return "record_dove_rebuttal";
    default: return null;
  }
}

function publicReportFor(toolName, result, args) {
  const operation = operationForTool(toolName);
  const data = result?.approval?.noChangesApplied === true && result.zeroWrite !== true ? { ...result, zeroWrite: true } : result;
  return publicResult(toolName, data, classifyInvocationOutcome(data, operation), {
    includeTechnicalAppendix: toolName === "query_dove_status" && readFlagValue(args, "--detail") === "full"
  });
}

function cliResponseLanguage(target, args) {
  return resolveDoveResponseLanguage(target, definedObject({ language: optionalFlagValue(args, "--language") }));
}

function printResult(toolName, result, args, target = process.cwd()) {
  const envelope = publicReportFor(toolName, result, args);
  if (wantsJson(args)) console.log(JSON.stringify(envelope, null, 2));
  else console.log(renderPublicReport(envelope.report, { language: cliResponseLanguage(target, args) }));
}

function printError(toolName, error, args, target = process.cwd()) {
  const operation = toolName ? operationForTool(toolName) : null;
  const envelope = operation
    ? publicErrorResult(toolName, error, classifyInvocationError(error, operation))
    : { report: { status: "blocked", message: String(error instanceof Error ? error.message : error) } };
  if (wantsJson(args)) console.log(JSON.stringify(envelope, null, 2));
  else console.error(renderPublicReport(envelope.report, { language: cliResponseLanguage(target, args) }));
}

function printOperationalError(error, args = []) {
  const message = error instanceof Error ? error.message : String(error);
  if (wantsJson(args)) console.log(JSON.stringify({ status: "blocked", message }, null, 2));
  else console.error(message);
}

function integrationResult(result) {
  const { manifest, ...publicFields } = result;
  return publicFields;
}

async function readStdin() {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

let parsed;
try {
  parsed = parseDoveCli(process.argv.slice(2));
} catch (error) {
  const raw = process.argv.slice(2);
  const rawCommand = raw[0];
  const rawAction = raw[1];
  const toolName = BUSINESS_COMMANDS.has(rawCommand)
    ? toolForCommand(rawCommand, {
        lessonsAction: rawCommand === "lessons" && rawAction === "record" ? "record" : "query",
        sourceAction: rawCommand === "source" && ["register", "verify"].includes(rawAction) ? rawAction : "query",
        args: raw
      })
    : rawCommand === "workspace" ? "manage_dove_workspace" : null;
  if (toolName) printError(toolName, error, raw);
  else printOperationalError(error, raw);
  process.exit(1);
}

const command = parsed.command;
if (!command) {
  let projectInitialized = false;
  try {
    resolveInstalledProjectRoot(process.cwd());
    projectInitialized = true;
  } catch {
    projectInitialized = false;
  }
  console.log(renderDoveHome({
    stream: process.stdout,
    env: process.env,
    projectInitialized
  }));
  process.exit(0);
}
if (["help", "--help", "-h"].includes(command) || parsed.args.includes("--help")) {
  usage();
  process.exit(0);
}
if (command === "--version") {
  console.log(PACKAGE.version);
  process.exit(0);
}
if (!KNOWN_COMMANDS.has(command)) {
  usage();
  process.exit(1);
}

let [rawTarget, ...extraPositionals] = parsed.positionals;
let sourceAction = "query";
if (command === "source" && ["query", "register", "verify"].includes(rawTarget)) {
  sourceAction = rawTarget;
  [rawTarget, ...extraPositionals] = extraPositionals;
}
let lessonsAction = "read";
if (command === "lessons" && ["read", "update"].includes(rawTarget)) {
  lessonsAction = rawTarget;
  [rawTarget, ...extraPositionals] = extraPositionals;
}
const invalidLessonsPositionals = command === "lessons" && extraPositionals.length > 0;
const invalidSourcePositionals = command === "source" && extraPositionals.length > 0;
const args = [...parsed.args];
const selectedTool = command === "workspace" ? "manage_dove_workspace" : toolForCommand(command, { lessonsAction, sourceAction, args });
let target = process.cwd();

try {
  if (invalidLessonsPositionals) throw new Error("dove lessons accepts only read or update followed by one target.");
  if (invalidSourcePositionals) throw new Error("dove source accepts only query, register, or verify followed by one target.");

  if (command === "init") {
    const requestedProject = projectFlag(args);
    try {
      target = resolveProjectRootForInit(requestedProject, { cwd: process.cwd(), hostIds: PROJECT_HOST_IDS });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("Dove project integration is already initialized at")) throw error;
      target = resolveInstalledProjectRoot(requestedProject ?? process.cwd());
      const manifest = readProjectInstallationManifest(target, { hostIds: PROJECT_HOST_IDS });
      const requestedHosts = selectedHosts(args);
      if (requestedHosts !== undefined && JSON.stringify([...requestedHosts].sort()) !== JSON.stringify([...manifest.hosts].sort())) {
        throw new Error("Dove is already initialized with a different host selection. Use dove sync --host <host> to change it.");
      }
      const result = {
        status: "already-initialized",
        target,
        hosts: [...manifest.hosts],
        writtenPaths: [],
        removedPaths: [],
        changedPaths: [],
        transactionState: null
      };
      writeIntegrationResult("init", result, args);
      process.exit(0);
    }
    const result = initializeProjectIntegration(target, {
      ...PACKAGE_OPTIONS,
      hosts: selectedHosts(args)
    });
    writeIntegrationResult("init", integrationResult(result), args);
    process.exit(0);
  }
  if (command === "sync") {
    target = projectStart(undefined, args, { allowPositional: false });
    const result = syncProjectIntegration(target, {
      ...PACKAGE_OPTIONS,
      hosts: selectedHosts(args)
    });
    writeIntegrationResult("sync", integrationResult(result), args);
    process.exit(0);
  }
  if (command === "doctor") {
    target = projectStart(undefined, args, { allowPositional: false });
    const result = inspectProjectDoctor(target, {
      ...PACKAGE_OPTIONS,
      packageRoot: PACKAGE_ROOT,
      executablePath: __filename,
      claudeCommand: process.env.DOVE_CLAUDE_COMMAND || "claude"
    });
    writeDoctorResult(result);
    process.exit(result.healthy ? 0 : 1);
  }
  if (command === "mcp") {
    const action = rawTarget;
    if (action !== "serve") throw new Error("dove mcp accepts only serve.");
    if (projectFlag(args) === undefined) throw new Error("dove mcp serve requires --project <dir>.");
    target = resolveInstalledProjectRoot(projectStart(undefined, args, { allowPositional: false }));
    assertClaudeInstalled(target);
    startServer(target);
    process.stdin.resume();
    await new Promise(() => {});
  }
  if (command === "hook") {
    const action = rawTarget;
    if (action !== "user-prompt-submit") throw new Error("dove hook accepts only user-prompt-submit.");
    if (projectFlag(args) === undefined) throw new Error("dove hook user-prompt-submit requires --project <dir>.");
    target = resolveInstalledProjectRoot(projectStart(undefined, args, { allowPositional: false }));
    assertClaudeInstalled(target);
    const output = userPromptSubmitOutput(await readStdin());
    if (output !== null) process.stdout.write(JSON.stringify(output));
    process.exit(0);
  }
  if (command === "workspace") {
    const action = rawTarget;
    target = resolveInstalledProjectRoot(projectStart(undefined, args, { allowPositional: false }));
    const input = workspaceArgs(action, args);
    printResult(selectedTool, manageDoveWorkspace(target, input), args, target);
    process.exit(0);
  }

  target = resolveBusinessTarget(rawTarget, args);
  if (command === "status") {
    printResult(selectedTool, queryDoveStatus(target, statusArgs(args)), args, target);
    process.exit(0);
  }
  if (command === "mission") {
    const input = missionArgs(args);
    if (input.operation === "reevaluate-research-decision") {
      const result = runMutation(target, "reevaluate-research-decision", args, (clean) => {
        const { mutationMode: ignoredMutationMode, ...publicInput } = missionArgs(clean);
        return reevaluateResearchDecision(target, prepareResearchDecisionReevaluation(target, publicInput));
      }, "direct-process");
      printResult(selectedTool, result, args, target);
      process.exit(0);
    }
    const { missionNumber: ignoredMissionNumber, missionGoal: ignoredMissionGoal, dependsOnMissionNumbers, parentMissionNumber, ...creationInput } = input;
    if (ignoredMissionNumber !== undefined || ignoredMissionGoal !== undefined) throw new Error("Mission creation does not accept --mission-number or --mission-goal.");
    const dependsOnMissionIds = dependsOnMissionNumbers?.map((missionNumber) => resolveMissionNumber(target, missionNumber, { operation: "Dove CLI mission dependency selection" }).missionId);
    const parentMissionId = parentMissionNumber === undefined ? undefined : resolveMissionNumber(target, parentMissionNumber, { operation: "Dove CLI parent mission selection" }).missionId;
    const operation = creationInput.operation ?? (parentMissionId ? "branch" : "create-root");
    printResult(selectedTool, createDoveMission(target, definedObject({ ...creationInput, operation, dependsOnMissionIds, parentMissionId, missionId: newMissionId() })), args, target);
    process.exit(0);
  }
  if (command === "lessons") {
    if (lessonsAction === "read") {
      printResult(selectedTool, readDoveLessons(target, {}), args, target);
      process.exit(0);
    }
    const result = runMutation(target, "update-dove-lessons", args, (clean) => updateDoveLessons(target, lessonsUpdateArgs(clean)), "direct-process");
    printResult(selectedTool, result, args, target);
    process.exit(0);
  }
  let result;
  if (command === "source") {
    if (sourceAction === "query") result = querySources(target, sourceArgs(target, args, sourceAction));
    else result = runMutation(target, sourceAction === "verify" ? "verify-source" : "register-source", args, (clean) => sourceAction === "verify" ? verifySource(target, sourceArgs(target, clean, sourceAction)) : registerSource(target, sourceArgs(target, clean, sourceAction)));
  }
  if (command === "experiment") {
    result = runMutation(target, "run-experience-workflow", args, (clean) => runExperienceWorkflow(target, definedObject({
      missionId: missionIdForNumber(target, clean), experimentId: optionalFlagValue(clean, "--experiment-id"), title: optionalFlagValue(clean, "--title"),
      protocol: optionalFlagValue(clean, "--protocol-json") ? parseJson(optionalFlagValue(clean, "--protocol-json"), "--protocol-json") : undefined,
      result: optionalFlagValue(clean, "--result-json") ? parseJson(optionalFlagValue(clean, "--result-json"), "--result-json") : undefined
    })));
  }
  const archiveArgs = (clean) => definedObject({
    missionId: missionIdForNumber(target, clean), artifactPath: optionalFlagValue(clean, "--artifact-path"),
    referencePaths: optionalFlagValues(clean, "--reference-path"), qa: optionalFlagValues(clean, "--qa"), findings: optionalFlagValues(clean, "--finding")
  });
  if (command === "draft") result = runMutation(target, "record-dove-draft", args, (clean) => recordDoveDraft(target, archiveArgs(clean)));
  if (command === "figure") result = runMutation(target, "record-dove-figure", args, (clean) => recordDoveFigure(target, { ...archiveArgs(clean), caption: optionalFlagValue(clean, "--caption") }));
  if (command === "review") {
    const request = reviewArgs(target, args);
    if (request.mode === "scope") result = scopeReviewRecord(target, request.args);
    else result = runMutation(target, "archive-review-record", args, () => archiveReviewRecord(target, request.args));
  }
  if (command === "rebuttal") result = runMutation(target, "record-dove-rebuttal", args, (clean) => recordDoveRebuttal(target, { ...archiveArgs(clean), findingRefs: optionalFlagValues(clean, "--finding-ref") }));
  printResult(selectedTool, result, args, target);
  process.exit(0);
} catch (error) {
  if (selectedTool) printError(selectedTool, error, args, target);
  else printOperationalError(error, args);
  process.exit(1);
}
