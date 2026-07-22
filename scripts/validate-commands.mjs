import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { build } from "esbuild";

import { GOVERNANCE_EXEMPT_MUTATIONS, GOVERNANCE_GUARDED_MUTATIONS, GOVERNANCE_READONLY_COMMANDS } from "../src/core/schema.mjs";
import { CLI_COMMAND_SPECS } from "../src/cli/command-parser.mjs";
import {
  COMMAND_SURFACES,
  PROJECT_HOST_IDS,
  TOOL_RESULT_CONTEXT_FIELDS,
  adapterPathForCommand,
  commandResultContextFields
} from "../src/core/command-manifest.mjs";
import { checkGeneratedAdapters, generatedAdapterEntries, generatedClaudeUserCommandEntries } from "./generate-command-adapters.mjs";

const ROOT = process.cwd();
const expectedCommandIds = ["dove.init", "dove.mission", "dove.status", "dove.lessons", "dove.version", "dove.source", "dove.note", "dove.figure", "dove.experience", "dove.draft", "dove.review", "dove.rebuttal"];
const expectedTools = {
  "dove.init": ["init_dove_goal"],
  "dove.mission": ["create_dove_mission"],
  "dove.status": ["query_dove_status"],
  "dove.lessons": ["query_dove_lessons", "record_dove_lesson"],
  "dove.version": ["create_version_snapshot", "compare_versions"],
  "dove.source": ["search_network", "query_sources", "register_source", "verify_source"],
  "dove.note": ["upsert_note"],
  "dove.figure": ["run_figure_workflow"],
  "dove.experience": ["run_experience_workflow", "upsert_claims"],
  "dove.draft": ["upsert_draft", "upsert_draft_metadata"],
  "dove.review": ["prepare_review_exchange", "import_review_exchange", "verify_review_coverage"],
  "dove.rebuttal": ["normalize_rebuttal_issues", "build_rebuttal_strategy", "build_rebuttal"]
};
const removedCommandIds = [
  "dove.auto", "dove.operator", "dove.review-loop", "dove.orchestrate", "dove.plan", "dove.checklist", "dove.audit", "dove.autonomy-operate", "dove.return",
  "dove.follow-through", "dove.governance-audit", "dove.onboard", "dove.launch", "dove.approvals", "dove.kill",
  "dove.planner", "dove.builder", "dove.reviewer"
];
const forbiddenSchema7Paths = [".dove/state.json", ".dove/task-packets", ".dove/orchestration", ".dove/runtime", ".dove/workspace", ".dove/mutations", ".dove/programs", ".dove/meta", ".dove/context", ".dove/wiki"];
const forbiddenPublicModules = [
  "task-workflow.mjs",
  "navigation.mjs",
  "orchestration.mjs",
  "runtime-state.mjs",
  "task-packets.mjs",
  "internal-api.mjs",
  "runtime-authorization.mjs",
  "packet-step-result.mjs",
  "operator-ux.mjs",
  "pre-action-guidance.mjs",
  "legacy-governance.mjs",
  "legacy-governance-assertion.mjs",
  "legacy-source-trust.mjs",
  "review-proof.mjs",
  "program-operating-state.mjs",
  "mutation-guard.mjs",
  "workspace-bootstrap.mjs",
  "reviews.mjs",
  "review-scope.mjs",
  "isolated-review.mjs",
  "audio-review.mjs",
  "dove-review-loop.mjs"
];
const generatedBundles = ["dist/index.mjs", "bin/dove-package.mjs", "mcp/dove-state-server-package.mjs", "scripts/doctor-mcp-probe-package.mjs"];
const retiredCallableTokens = [
  "runDoveAuto",
  "runDoveOperator",
  "runDoveReviewLoop",
  "run_dove_auto",
  "run_dove_operator",
  "run_dove_review_loop",
  "query_dove_mission_board",
  "queryCampaigns",
  "planCampaign",
  "runAutonomyOnce",
  "runAutonomyForeground",
  "runAutonomyOperate",
  "materializeGuidancePacket",
  "persistOperatorFollowThrough"
];
const runtimeSourcePaths = [
  ...fs.readdirSync(path.join(ROOT, "src/core")).filter((name) => name.endsWith(".mjs")).map((name) => `src/core/${name}`),
  ...fs.readdirSync(path.join(ROOT, "src/mcp")).filter((name) => name.endsWith(".mjs")).map((name) => `src/mcp/${name}`),
  "bin/dove.mjs",
  "mcp/dove-state-server.mjs"
];
const retiredCliFields = ["--packet-id", "--task-packet-id", "--mission-packet-id", "--target", "--domain", "--stage", "--status", "--role", "--policy-override"];

for (const moduleName of forbiddenPublicModules) {
  assert.equal(fs.existsSync(path.join(ROOT, "src/core", moduleName)), false, `Retired core module still exists: ${moduleName}`);
}
for (const relativePath of runtimeSourcePaths) {
  const content = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  for (const token of retiredCallableTokens) assert.doesNotMatch(content, new RegExp(`\\b${token}\\b`, "u"), `${relativePath} contains retired callable ${token}`);
}

const drift = checkGeneratedAdapters(ROOT);
assert.deepEqual(drift, [], `Unexpected generated command adapter drift: ${drift.map((item) => `${item.relativePath} (${item.reason})`).join(", ")}`);
const initAdapters = [...generatedAdapterEntries(), ...generatedClaudeUserCommandEntries()].filter((entry) => entry.command.id === "dove.init");
for (const entry of initAdapters) {
  assert.match(entry.content, /no files have changed.*approve or cancel/is, `${entry.relativePath} must explain init approval in ordinary language`);
  assert.doesNotMatch(entry.content, /schema 9|proposal digest|workspace identity|exact replay|sealed|提案摘要|工作区身份|精确重放|密封/iu, `${entry.relativePath} exposes init integrity internals`);
}
assert.deepEqual(COMMAND_SURFACES.map((command) => command.id), expectedCommandIds, "Public schema 9 commands must stay flat and sealed");

const openCodeSkillRoot = path.join(ROOT, ".opencode", "skills");
const installedRoleSkillPaths = fs.readdirSync(openCodeSkillRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("dove-"))
  .map((entry) => `.opencode/skills/${entry.name}/SKILL.md`)
  .sort();
assert.deepEqual(installedRoleSkillPaths, [
  ".opencode/skills/dove-builder/SKILL.md",
  ".opencode/skills/dove-planner/SKILL.md",
  ".opencode/skills/dove-reviewer/SKILL.md"
], "OpenCode role skills must expose only the three primary schema 9 responsibilities");
for (const relativePath of installedRoleSkillPaths) {
  const content = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  assert.doesNotMatch(content, /\.dove\/(?:context|meta|wiki|workspace|task-packets|orchestration|runtime|mutations|programs)|\b(?:board|route|queue|lease|continuation|review loop|automatic subagent)\b/iu, `${relativePath} references retired orchestration state`);
}

const guardedCommandIds = new Set(GOVERNANCE_GUARDED_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []));
const readonlyCommandIds = new Set(GOVERNANCE_READONLY_COMMANDS);
const classified = new Set([
  ...guardedCommandIds,
  ...GOVERNANCE_EXEMPT_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []),
  ...readonlyCommandIds
]);
for (const command of COMMAND_SURFACES) {
  assert.deepEqual(command.requiredTools, expectedTools[command.id], `${command.id} has stale tool bindings`);
  assert.equal(classified.has(command.id), true, `${command.id} lacks governance classification`);
  if (command.id === "dove.lessons") {
    assert.equal(guardedCommandIds.has(command.id), true, "dove.lessons record must be guarded");
    assert.equal(readonlyCommandIds.has(command.id), false, "mixed dove.lessons surface must not be classified wholly read-only");
  }
  const contextFields = commandResultContextFields(command);
  if (command.id === "dove.mission") assert.ok(contextFields.some((field) => field.startsWith("tree.") || field === "diff"), "dove.mission result context must retain research-tree output");
  if (command.id === "dove.status") assert.ok(contextFields.includes("currentContext.researchTree"), "dove.status result context must retain researchTree");
  for (const toolName of command.requiredTools) assert.ok(TOOL_RESULT_CONTEXT_FIELDS[toolName], `${toolName} lacks bounded result context fields`);
  assert.ok(contextFields.length > 0, `${command.id} lacks bounded result-scoped context`);
  for (const field of contextFields) {
    assert.doesNotMatch(field, /^\.dove\//u, `${command.id} exposes a broad durable context path instead of a result field`);
    assert.doesNotMatch(field, /(?:^|\.)(?:context|transcript|session)(?:\.|$)/iu, `${command.id} exposes persistent or private context`);
    if (/targetArtifacts|expectedArtifacts|completionCriteria|evidenceRequirements|candidates|providers|items|artifacts|reviews|nodes|lessonDrafts/u.test(field)) assert.match(field, /\[\]/u, `${command.id} must mark array result paths explicitly: ${field}`);
  }
}

const generated = [
  ...generatedAdapterEntries().map((entry) => ({ ...entry, content: entry.content })),
  ...generatedClaudeUserCommandEntries().map((entry) => ({ ...entry, content: entry.content }))
];
for (const entry of generated) {
  assert.match(entry.content, /^---\n/um, `${entry.relativePath} lacks frontmatter`);
  assert.match(entry.content, /Dove MCP tool|through MCP only/iu, `${entry.relativePath} lacks MCP-first guidance`);
  for (const toolName of entry.command.requiredTools) assert.match(entry.content, new RegExp(`\\b${toolName}\\b`, "u"), `${entry.relativePath} omits required MCP tool ${toolName}`);
  assert.doesNotMatch(entry.content, /node\s+\.\/bin\/dove(?:-package)?\.mjs|--json\b|--mutation-mode\b|through Bash|CLI fallback|fall back to (?:the )?(?:CLI|shell)/iu, `${entry.relativePath} exposes a CLI or shell fallback`);
  assert.doesNotMatch(entry.content, /schema 8/iu, `${entry.relativePath} contains stale schema 8 wording`);
  assert.doesNotMatch(entry.content, /--(?:packet-id|task-packet-id|mission-packet-id|target|domain|stage|status|role|policy-override)\b|\.dove\/(?:task-packets|orchestration|runtime|workspace)\b/u, `${entry.relativePath} exposes retired packet/orchestration input`);
  assert.match(entry.content, /Never display or request proposal, replay, workspace, digest, token, mutation-mode, confirmation payload, or generated-command data/iu, `${entry.relativePath} lacks the public control-data boundary`);
  if (entry.command.continuation === "resume-original") {
    assert.match(entry.content, /Preserve the full original user request.*resume that same request.*current host turn/isu, `${entry.relativePath} must resume the original host request`);
  }
  if (entry.command.explicitStopMode === "create-only") {
    assert.match(entry.content, /Stop after the Dove checkpoint only when the user explicitly asked solely to create or reevaluate the mission/iu, `${entry.relativePath} must keep create-only explicit`);
    assert.match(entry.content, /Words such as 'first' or 'before continuing'.*do not.*request a stop/iu, `${entry.relativePath} must not treat ordering words as create-only`);
  }
  if (entry.command.closure === "host-outcome") {
    assert.deepEqual(entry.command.closureTools, ["close_host_outcome"], `${entry.relativePath} must bind one host outcome closure tool`);
    assert.match(entry.content, /call create_dove_mission directly.*never call query_dove_mission/isu, `${entry.relativePath} must use the single checkpoint tool rather than a separate preview call`);
    assert.match(entry.content, /Target and expected artifacts must be canonical workspace-relative file paths/iu, `${entry.relativePath} must keep mission artifact fields path-shaped`);
    assert.match(entry.content, /Evidence requirements are optional.*omit them unless.*artifact:<path>.*validation:<path>.*note:<id>/isu, `${entry.relativePath} must not invent free-form evidence requirements`);
    assert.match(entry.content, /generate one private safe mission id.*pass it as `missionId`.*never show it to the user/isu, `${entry.relativePath} must retain a private checkpoint mission id for closure`);
    assert.doesNotMatch(entry.content, /missionId is explicit or deterministically proposed/iu, `${entry.relativePath} must not rely on an unrecoverable generated mission id`);
    assert.match(entry.content, /close_host_outcome.*at most once/isu, `${entry.relativePath} must close eligible host outcomes at most once`);
    assert.match(entry.content, /never retry it automatically/iu, `${entry.relativePath} must prohibit closure retries`);
    assert.match(entry.content, /preserve every host-produced file/iu, `${entry.relativePath} must preserve substantive host work after closure failure`);
    assert.match(entry.content, /Do not calculate or pass receipt identifiers/iu, `${entry.relativePath} must not ask the host to calculate closure internals`);
  } else {
    assert.doesNotMatch(entry.content, /close_host_outcome/u, `${entry.relativePath} must not expose host outcome closure outside mission continuation`);
  }
  if (entry.command.id === "dove.lessons") {
    assert.match(entry.content, /recording mission|recording-mission|provenance/iu, `${entry.relativePath} must preserve lesson mission provenance`);
    assert.match(entry.content, /preference.*constraint.*method.*failure.*review-insight/isu, `${entry.relativePath} must name all five lesson kinds`);
    assert.match(entry.content, /explicit read-only query|Query is the default/iu, `${entry.relativePath} must make lesson query explicit`);
    assert.match(entry.content, /explicit record request authorizes.*without a second confirmation/iu, `${entry.relativePath} must keep lesson recording single-call`);
    assert.match(entry.content, /advisory-only|never grant authority/iu, `${entry.relativePath} must keep lessons advisory-only`);
    assert.doesNotMatch(entry.content, /\.dove\/meta\/operator-lessons|query_operator_lessons|record_operator_lesson/iu, `${entry.relativePath} exposes retired lesson surfaces`);
  }
}
for (const removed of removedCommandIds) {
  assert.equal(classified.has(removed), false, `${removed} remains governance-reachable`);
  for (const hostId of PROJECT_HOST_IDS) assert.equal(fs.existsSync(path.join(ROOT, adapterPathForCommand(hostId, removed))), false, `${removed} adapter was not deleted for ${hostId}`);
}

for (const commandName of ["lessons", "source", "note", "draft", "experience", "figure", "review", "rebuttal", "version"]) {
  const spec = CLI_COMMAND_SPECS[commandName];
  assert.ok(spec, `Missing CLI command ${commandName}`);
  const optionNames = new Set(spec.options.map((option) => option.name));
  assert.equal(optionNames.has("--mission-id"), true, `${commandName} must require an explicit mission id option`);
  for (const retired of retiredCliFields) assert.equal(optionNames.has(retired), false, `${commandName} exposes retired option ${retired}`);
}
for (const removedCli of ["auto", "operator", "review-loop"]) assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, removedCli), false, `Removed CLI command remains: ${removedCli}`);
const statusOptionNames = new Set(CLI_COMMAND_SPECS.status.options.map((option) => option.name));
assert.deepEqual([...statusOptionNames].filter((name) => !["--json", "--format", "--help", "-h"].includes(name)).sort(), ["--detail", "--language", "--mission-id"]);
assert.equal(new Set(CLI_COMMAND_SPECS.version.options.map((option) => option.name)).has("--finalize"), false, "version must not expose finalize");
assert.equal(new Set(CLI_COMMAND_SPECS.mission.options.map((option) => option.name)).has("--operation"), true, "mission must expose nested research-tree operation");
const lessonsSpec = CLI_COMMAND_SPECS.lessons;
assert.ok(lessonsSpec, "Missing CLI command lessons");
const lessonOptionNames = new Set(lessonsSpec.options.map((option) => option.name));
assert.equal(lessonOptionNames.has("--confirmed"), true, "lessons record must expose exact confirmation");
assert.equal(lessonOptionNames.has("--confirm"), false, "lessons must not expose a confirm alias");

const bundle = await build({
  absWorkingDir: ROOT,
  entryPoints: ["src/core/index.mjs"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  external: ["node:*"],
  metafile: true,
  logLevel: "silent"
});
const publicInputs = Object.keys(bundle.metafile.inputs);
for (const forbidden of forbiddenPublicModules) assert.equal(publicInputs.some((item) => item.endsWith(`/src/core/${forbidden}`) || item === `src/core/${forbidden}`), false, `Public package entry imports ${forbidden}`);

for (const entryPoint of ["bin/dove.mjs", "mcp/dove-state-server.mjs"]) {
  const entryBundle = await build({
    absWorkingDir: ROOT,
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    external: ["node:*"],
    metafile: true,
    logLevel: "silent"
  });
  const entryInputs = Object.keys(entryBundle.metafile.inputs);
  for (const forbidden of forbiddenPublicModules) {
    assert.equal(entryInputs.some((item) => item.endsWith(`/src/core/${forbidden}`) || item === `src/core/${forbidden}`), false, `${entryPoint} imports ${forbidden}`);
  }
}

for (const bundlePath of generatedBundles) {
  const content = fs.readFileSync(path.join(ROOT, bundlePath), "utf8");
  for (const forbidden of forbiddenPublicModules) assert.doesNotMatch(content, new RegExp(forbidden.replaceAll(".", "\\."), "u"), `${bundlePath} contains retired module ${forbidden}`);
  for (const token of retiredCallableTokens) assert.doesNotMatch(content, new RegExp(`\\b${token}\\b`, "u"), `${bundlePath} contains retired callable ${token}`);
}

console.log(JSON.stringify({ status: "passed", commandCount: COMMAND_SURFACES.length, adapterCount: generated.length, publicModuleCount: publicInputs.length }, null, 2));
