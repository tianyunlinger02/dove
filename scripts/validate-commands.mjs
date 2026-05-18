import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  DOVE_BOUNDARY_TYPES,
  DOVE_TASK_STATUSES,
  GOVERNANCE_EXEMPT_MUTATIONS,
  GOVERNANCE_GUARDED_MUTATIONS,
  GOVERNANCE_READONLY_COMMANDS
} from "../src/core/schema.mjs";
import {
  COMMAND_SURFACES,
  HOST_IDS,
  OPENCODE_ROLE_SKILL_PATHS,
  TOOL_CONTEXT_PATHS,
  adapterPathForCommand,
  commandContextPaths
} from "../src/core/command-manifest.mjs";
import { checkGeneratedAdapters, generatedAdapterEntries } from "./generate-command-adapters.mjs";

const ROOT = process.cwd();

const expectedCommandIds = [
  "dove.init",
  "dove.mission",
  "dove.auto",
  "dove.status",
  "dove.operator",
  "dove.lessons",
  "dove.version",
  "dove.source",
  "dove.note",
  "dove.figure",
  "dove.experience",
  "dove.draft",
  "dove.review",
  "dove.review-loop",
  "dove.rebuttal"
];

const expectedTools = {
  "dove.init": ["init_dove_goal"],
  "dove.mission": ["create_dove_task", "record_dove_mission_pass"],
  "dove.auto": ["run_dove_auto"],
  "dove.status": ["query_dove_status", "apply_dove_status_adjustments"],
  "dove.operator": ["run_dove_operator"],
  "dove.lessons": ["query_operator_lessons", "record_operator_lesson"],
  "dove.version": ["reset_dove_version"],
  "dove.source": ["register_source"],
  "dove.note": ["upsert_note"],
  "dove.figure": ["run_figure_workflow"],
  "dove.experience": ["run_experience_workflow"],
  "dove.draft": ["upsert_draft", "set_section_status"],
  "dove.review": ["run_audio_review"],
  "dove.review-loop": ["run_dove_review_loop"],
  "dove.rebuttal": ["normalize_rebuttal_issues", "build_rebuttal_strategy", "build_rebuttal"]
};

const removedCommandIds = [
  "dove.orchestrate",
  "dove.plan",
  "dove.checklist",
  "dove.audit",
  "dove.autonomy-operate",
  "dove.return",
  "dove.follow-through",
  "dove.governance-audit",
  "dove.onboard",
  "dove.launch",
  "dove.approvals",
  "dove.kill",
  "dove.planner",
  "dove.builder",
  "dove.reviewer",
  "dove.paper.init",
  "dove.paper.source",
  "dove.paper.note",
  "dove.paper.research",
  "dove.paper.outline",
  "dove.paper.draft",
  "dove.paper.experiment",
  "dove.paper.claim-gate",
  "dove.paper.result-bridge",
  "dove.paper.figure",
  "dove.paper.audit",
  "dove.paper.review",
  "dove.paper.isolated-review",
  "dove.paper.revise",
  "dove.paper.rebuttal",
  "dove.paper.version",
  "dove.paper.citations",
  "dove.paper.meta-optimize",
  "dove.paper.pipeline",
  "dove.paper.review-loop",
  "dove.paper.rebuttal-strategy",
  "dove.paper.version-snapshot",
  "dove.paper.version-compare",
  "dove.paper.open-questions",
  "dove.paper.decisions",
  "dove.paper.lineage",
  "dove.paper.wiki"
];

function readRelative(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Missing generated Dove adapter surface: ${relativePath}`);
  return fs.readFileSync(absolutePath, "utf8");
}

const drift = checkGeneratedAdapters(ROOT);
assert.equal(drift.length, 0, `Generated command adapter drift: ${drift.map((item) => `${item.relativePath} (${item.reason})`).join(", ")}`);

assert.deepEqual(DOVE_TASK_STATUSES, ["pending", "ready", "in-progress", "blocked", "completed", "killed"], "Boundary reasons must not be added to the public task status enum");
for (const boundaryType of DOVE_BOUNDARY_TYPES) {
  assert.equal(DOVE_TASK_STATUSES.includes(boundaryType), false, `${boundaryType} must remain boundary metadata, not a task status`);
}

const generatorText = fs.readFileSync(path.join(ROOT, "scripts", "generate-command-adapters.mjs"), "utf8");
assert.doesNotMatch(generatorText, /const\s+(?:BASE_CONTEXT_PATHS|TOOL_CONTEXT_PATHS|COMMAND_CONTEXT_PATHS|COMMAND_CONSTRAINTS)\b/, "Command context and constraint metadata belongs in src/core/command-manifest.mjs, not the adapter generator");
assert.doesNotMatch(generatorText, /dove\.paper\.\*/, "Generated adapters must not route users to removed paper-namespaced slash commands");

const commandIds = COMMAND_SURFACES.map((command) => command.id);
assert.deepEqual(commandIds, expectedCommandIds, "Public command surface must stay task-centered and flat");

const commandIdSet = new Set(commandIds);
for (const requiredRuntimePath of [".dove/runtime/continuation.json", ".dove/runtime/events.json", ".dove/runtime/results.json"]) {
  assert.equal(TOOL_CONTEXT_PATHS.query_dove_status.includes(requiredRuntimePath), true, `query_dove_status should read ${requiredRuntimePath}`);
}
for (const removedCommandId of removedCommandIds) {
  assert.equal(commandIdSet.has(removedCommandId), false, `${removedCommandId} must not remain as a public command surface`);
}

for (const command of COMMAND_SURFACES) {
  assert.ok(commandContextPaths(command).includes(".dove/context/actions/current.json"), `${command.id} should inherit base action context`);
  assert.deepEqual(command.requiredTools, expectedTools[command.id], `${command.id} should bind only its intended MCP tools`);
  for (const toolName of command.requiredTools ?? []) {
    assert.ok(TOOL_CONTEXT_PATHS[toolName], `${command.id} required tool ${toolName} should declare manifest context paths`);
  }
}

const classifiedCommandIds = new Set([
  ...GOVERNANCE_GUARDED_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []),
  ...GOVERNANCE_EXEMPT_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []),
  ...GOVERNANCE_READONLY_COMMANDS
]);
for (const command of COMMAND_SURFACES) {
  assert.equal(classifiedCommandIds.has(command.id), true, `Unclassified command surface: ${command.id}`);
}
for (const removedCommandId of removedCommandIds) {
  assert.equal(classifiedCommandIds.has(removedCommandId), false, `${removedCommandId} must not remain in governance classifications`);
}

const generatedCommandIds = new Set(generatedAdapterEntries().map(({ command }) => command.id));
for (const removedCommandId of removedCommandIds) {
  assert.equal(generatedCommandIds.has(removedCommandId), false, `${removedCommandId} must not generate adapter surfaces`);
  for (const hostId of HOST_IDS) {
    const adapterPath = adapterPathForCommand(hostId, removedCommandId);
    assert.equal(fs.existsSync(path.join(ROOT, adapterPath)), false, `${adapterPath} must be deleted instead of kept as a compatibility surface`);
  }
}

for (const { command, relativePath } of generatedAdapterEntries()) {
  const commandText = readRelative(relativePath);
  assert.ok(command.ux, `${command.id} should declare daily UX metadata in the manifest`);
  assert.ok(Array.isArray(command.ux.dailyFlow) && command.ux.dailyFlow.length > 0, `${command.id} should declare daily flow guidance`);
  assert.equal(commandText.includes("## Daily use"), true, `${relativePath} must put daily use guidance before guardrails`);
  assert.equal(commandText.includes("## Guardrails"), true, `${relativePath} must separate guardrails from daily flow`);
  assert.equal(commandText.includes("## Workflow"), false, `${relativePath} must not bury daily use inside the old workflow checklist heading`);
  assert.equal(commandText.includes("response language preference"), true, `${relativePath} must instruct hosts to honor Dove language preference`);
  assert.equal(commandText.includes("default is `zh`"), true, `${relativePath} must document Chinese as the default response language`);
  for (const requiredTool of command.requiredTools ?? []) {
    assert.equal(commandText.includes(requiredTool), true, `${relativePath} must mention ${requiredTool}`);
  }
  for (const removedCommandId of removedCommandIds) {
    assert.equal(commandText.includes(removedCommandId), false, `${relativePath} must not mention removed command ${removedCommandId}`);
  }

  if (command.id === "dove.mission") {
    assert.equal(commandText.includes("create_dove_task"), true, `${relativePath} must route demand conversion through create_dove_task`);
    assert.equal(commandText.includes("record_dove_mission_pass"), true, `${relativePath} must record the one-pass mission result`);
    assert.equal(commandText.includes("Treat the operator input as natural-language demand"), true, `${relativePath} must frame mission as demand-to-task conversion`);
    assert.equal(commandText.includes("Return a proposal-only mission contract first"), true, `${relativePath} must require proposal-first mission intake`);
    assert.equal(commandText.includes("use interactive confirmation controls"), true, `${relativePath} must require interactive confirmation when supported`);
    assert.equal(commandText.includes("AskUserQuestion"), true, `${relativePath} must name Claude Code interactive confirmation support`);
    assert.equal(commandText.includes("approve conversion and run one pass, adjust conversion, or cancel"), true, `${relativePath} must expose concrete mission conversion choices`);
    assert.equal(commandText.includes("only pass `confirmed: true` to `create_dove_task` after the operator approves the converted contract"), true, `${relativePath} must require approval before task materialization`);
    assert.equal(commandText.includes("Classify each task as `plan`, `execute`, or `audit`"), true, `${relativePath} must expose task classification`);
    assert.equal(commandText.includes("autonomous checklist proposal"), true, `${relativePath} must include checklist proposal in mission intake`);
    assert.equal(commandText.includes("compact task card"), true, `${relativePath} must surface compact task cards in mission confirmation`);
    assert.equal(commandText.includes("explicit operator-created levels 1, 2, 3, or deeper"), true, `${relativePath} must state explicit user mission levels`);
    assert.equal(commandText.includes("Autonomously decide whether a checklist is needed"), true, `${relativePath} must document autonomous checklist selection`);
    assert.equal(commandText.includes("must have level greater than the parent mission level"), true, `${relativePath} must enforce child checklist depth`);
    assert.equal(commandText.includes("execute one bounded foreground pass"), true, `${relativePath} must require one-pass mission execution after materialization`);
    assert.equal(commandText.includes("Do not tell the operator to run `/dove:auto` for the first execution pass"), true, `${relativePath} must distinguish mission from auto`);
    assert.equal(commandText.includes("stage `plan`"), true, `${relativePath} must convert completed plan passes into missions`);
    assert.equal(commandText.includes("level 3 and `pending`"), true, `${relativePath} must default converted plan missions to pending level 3`);
    assert.equal(commandText.includes("level 4, 5, or deeper"), true, `${relativePath} must allow deeper child missions from plan outputs`);
    assert.equal(commandText.includes("record a first-class boundary"), true, `${relativePath} must record explicit boundaries instead of fake completion`);
    assert.equal(commandText.includes("ownerRole, nextRole, handoff"), true, `${relativePath} must expose role handoff metadata for incomplete mission passes`);
  }

  if (command.id === "dove.auto") {
    assert.equal(commandText.includes("same demand-to-task intake and classification model as `/dove:mission`"), true, `${relativePath} must start like mission demand conversion`);
    assert.equal(commandText.includes("does not require running `/dove:mission` first"), true, `${relativePath} must allow direct auto demand intake`);
    assert.equal(commandText.includes("Return a proposal-only auto contract first"), true, `${relativePath} must expose the auto confirmation contract`);
    assert.equal(commandText.includes("`proposedTask`"), true, `${relativePath} must expose converted auto task proposals`);
    assert.equal(commandText.includes("`selectedTask`"), true, `${relativePath} must expose selected durable task proposals`);
    assert.equal(commandText.includes("compact task/auto cards"), true, `${relativePath} must surface compact cards in auto confirmation`);
    assert.equal(commandText.includes("AskUserQuestion"), true, `${relativePath} must name Claude Code interactive confirmation support`);
    assert.equal(commandText.includes("present indexed packet choices through confirmation UX"), true, `${relativePath} must use confirmation UX for task selection`);
    assert.equal(commandText.includes("Require explicit operator confirmation"), true, `${relativePath} must require confirmation`);
    assert.equal(commandText.includes("Run in the current foreground call only"), true, `${relativePath} must document foreground-only execution`);
    assert.equal(commandText.includes("default is 3"), true, `${relativePath} must document the default auto iteration count`);
    assert.equal(commandText.includes("Record each foreground iteration"), true, `${relativePath} must document runtime iteration records`);
    assert.equal(commandText.includes("source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status"), true, `${relativePath} must document internal top-level workflow calls`);
    assert.equal(commandText.includes("Stop at completed, blocked, killed"), true, `${relativePath} must document stop conditions`);
    assert.equal(commandText.includes("persist the first-class boundary"), true, `${relativePath} must persist boundary metadata when auto stops`);
    assert.equal(commandText.includes("Do not claim host/code/provider/experiment work"), true, `${relativePath} must not claim external work without evidence`);
    assert.equal(commandText.includes("hidden background work"), true, `${relativePath} must keep auto continuation explicit and foreground-only`);
  }

  if (command.id === "dove.figure") {
    assert.equal(commandText.includes("run_figure_workflow"), true, `${relativePath} must route through run_figure_workflow`);
    for (const lowLevelTool of ["upsert_figure_plan", "prepare_figure_generation", "import_figure_generation", "validate_figure_pipeline"]) {
      assert.equal(commandText.includes(lowLevelTool), false, `${relativePath} must not expose low-level figure tool ${lowLevelTool} as the daily slash contract`);
    }
  }

  if (command.id === "dove.review") {
    assert.equal(commandText.includes("audio reviewer may read only"), true, `${relativePath} must document the audio isolation boundary`);
    assert.equal(commandText.includes("Do not share writer private transcript"), true, `${relativePath} must forbid broad/private context sharing`);
  }

  if (command.id === "dove.review-loop") {
    assert.equal(commandText.includes("default 3"), true, `${relativePath} must mention the default max iteration count`);
  }

  if (command.id === "dove.version") {
    assert.equal(commandText.includes("Clear active non-init tasks"), true, `${relativePath} must state version reset behavior`);
    assert.equal(commandText.includes("Preserve the level-0 init goal"), true, `${relativePath} must state init/lesson preservation`);
  }

  if (command.id === "dove.status") {
    assert.equal(commandText.includes("query_dove_status"), true, `${relativePath} must query status before adjustment`);
    assert.equal(commandText.includes("apply_dove_status_adjustments"), true, `${relativePath} must expose the guarded status adjustment bridge`);
    assert.equal(commandText.includes("live development situation"), true, `${relativePath} must explain the live development situation`);
    assert.equal(commandText.includes("do not treat `.dove/` context as the live development situation"), true, `${relativePath} must separate live context from Dove durable context`);
    assert.equal(commandText.includes("host-visible context"), true, `${relativePath} must use host-visible context for live status`);
    assert.equal(commandText.includes("Do not print internal mission summary dumps"), true, `${relativePath} must forbid noisy mission summary dumps`);
    assert.equal(commandText.includes("mission counts, status counts, recent completed missions, or recent killed missions"), true, `${relativePath} must name the hidden status summary fields`);
    assert.equal(commandText.includes("if there are no adjustable missions, do not print a mission list"), true, `${relativePath} must omit empty adjustable mission lists`);
    assert.equal(commandText.includes("daily home screen"), true, `${relativePath} must describe status as the daily home screen`);
    assert.equal(commandText.includes("ranked 1-3 next action cards"), true, `${relativePath} must expose ranked status next actions`);
    assert.equal(commandText.includes("after live context first"), true, `${relativePath} must keep live context first before durable action cards`);
    assert.equal(commandText.includes("actionableBoundaries"), true, `${relativePath} must expose actionable boundary metadata`);
    assert.equal(commandText.includes("boundaryActionCards"), true, `${relativePath} must expose proposal-only boundary action cards`);
    assert.equal(commandText.includes("boundary action cards"), true, `${relativePath} must document boundary action cards`);
    assert.equal(commandText.includes("compact cards"), true, `${relativePath} must surface compact status cards`);
    assert.equal(commandText.includes("compact adjustment cards"), true, `${relativePath} must surface compact status adjustment cards`);
    assert.equal(commandText.includes("no counts/completed-killed recaps"), true, `${relativePath} must forbid counts and completed/killed recaps`);
    assert.equal(commandText.includes("current boundary metadata"), true, `${relativePath} must explain boundary state without treating it as live host context`);
    assert.equal(commandText.includes("Boundary types are first-class metadata, not machine status choices"), true, `${relativePath} must keep boundaries separate from status enum`);
    assert.equal(commandText.includes("现在是什么情况"), false, `${relativePath} command prompt should keep canonical instructions in English`);
    assert.equal(commandText.includes("[\"pending\", \"ready\", \"in-progress\", \"blocked\", \"completed\", \"killed\"]"), true, `${relativePath} must expose exact status choices`);
    assert.equal(commandText.includes("excluding `completed` and `killed`"), true, `${relativePath} must exclude completed and killed tasks from displayed adjustment targets`);
    assert.equal(commandText.includes("single confirmation dialog"), true, `${relativePath} must use one status confirmation dialog`);
    assert.equal(commandText.includes("do not paginate by mission count"), true, `${relativePath} must forbid paginated status confirmation by mission count`);
    assert.equal(commandText.includes("parseable `packetId -> status`"), true, `${relativePath} must require clear packet-to-status adjustments before mutation`);
    assert.equal(commandText.includes("paginate the status UX based on mission count"), false, `${relativePath} must not keep the old paginated status UX`);
    assert.equal(commandText.includes("Collect status choices across pages"), false, `${relativePath} must not collect status choices across pages`);
    assert.equal(commandText.includes("one final confirmation summary"), false, `${relativePath} must not require the old extra final confirmation summary`);
    assert.equal(commandText.includes("not a standalone public slash command"), true, `${relativePath} must route killing through status UX`);
  }

  if (command.id === "dove.operator") {
    assert.equal(commandText.includes("run_dove_operator"), true, `${relativePath} must route through run_dove_operator`);
    assert.equal(commandText.includes("compact queue cards"), true, `${relativePath} must surface compact operator queue cards`);
    assert.equal(commandText.includes("`autoRunnableTasks`"), true, `${relativePath} must include auto-runnable mission queue`);
    assert.equal(commandText.includes("`hostPassRequiredTasks`"), true, `${relativePath} must include host-pass-required mission queue`);
    assert.equal(commandText.includes("blocked missions"), true, `${relativePath} must include blocked mission handling`);
    assert.equal(commandText.includes("writes: []"), true, `${relativePath} must expose proposal-only operator preview`);
    assert.equal(commandText.includes("foreground call only"), true, `${relativePath} must keep operator foreground-only`);
    assert.equal(commandText.includes("awaiting host results"), true, `${relativePath} must not claim host work without results`);
    assert.equal(commandText.includes("`awaiting-host-pass-result` boundary"), true, `${relativePath} must persist host-result boundaries instead of fake completion`);
    assert.equal(commandText.includes("do not expose planner/builder/reviewer as separate slash commands"), true, `${relativePath} must not add role slash surfaces`);
    assert.equal(commandText.includes("pending child plan missions"), true, `${relativePath} must create blocker investigation plan missions`);
  }
}

for (const relativePath of OPENCODE_ROLE_SKILL_PATHS) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `Missing skill: ${relativePath}`);
}

const opencodeConfig = JSON.parse(fs.readFileSync(path.join(ROOT, ".opencode.json"), "utf8"));
assert.equal(opencodeConfig.mcpServers["dove"].command, "node");
assert.equal(Object.hasOwn(opencodeConfig, "$schema"), false);
console.log("Command and skill validation passed.");
