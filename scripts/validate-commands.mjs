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
  PROJECT_HOST_IDS,
  OPENCODE_ROLE_SKILL_PATHS,
  TOOL_CONTEXT_PATHS,
  adapterPathForCommand,
  commandContextPaths
} from "../src/core/command-manifest.mjs";
import { checkGeneratedAdapters, generatedAdapterEntries, generatedClaudeUserCommandEntries } from "./generate-command-adapters.mjs";

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
  for (const hostId of PROJECT_HOST_IDS) {
    const adapterPath = adapterPathForCommand(hostId, removedCommandId);
    assert.equal(fs.existsSync(path.join(ROOT, adapterPath)), false, `${adapterPath} must be deleted instead of kept as a compatibility surface`);
  }
}

const adapterEntriesForValidation = [
  ...generatedAdapterEntries().map((entry) => ({ ...entry, commandText: readRelative(entry.relativePath) })),
  ...generatedClaudeUserCommandEntries().map((entry) => ({ ...entry, relativePath: `claude-user:${entry.relativePath}`, commandText: entry.content }))
];

for (const { command, relativePath, commandText } of adapterEntriesForValidation) {
  const frontmatterEnd = commandText.indexOf("\n---\n\n");
  assert.equal(commandText.startsWith("---\n"), true, `${relativePath} must expose frontmatter for host slash command lists`);
  assert.ok(frontmatterEnd > 0, `${relativePath} must close frontmatter before the command body`);
  const frontmatter = commandText.slice(0, frontmatterEnd + "\n---".length);
  assert.equal(frontmatter.includes("description:"), true, `${relativePath} must expose a short slash-list description`);
  assert.equal(frontmatter.includes(command.summary), true, `${relativePath} frontmatter description must come from the canonical command summary`);
  assert.ok(command.ux, `${command.id} should declare daily UX metadata in the manifest`);
  assert.ok(Array.isArray(command.ux.dailyFlow) && command.ux.dailyFlow.length > 0, `${command.id} should declare daily flow guidance`);
  assert.ok(Array.isArray(command.ux.examples) && command.ux.examples.length >= 2 && command.ux.examples.length <= 3, `${command.id} should declare 2-3 daily examples`);
  assert.equal(commandText.includes("## Daily use"), true, `${relativePath} must put daily use guidance before guardrails`);
  assert.equal(commandText.includes("## Examples"), true, `${relativePath} must expose concrete daily examples`);
  assert.equal(commandText.indexOf("## Daily use") < commandText.indexOf("## Examples"), true, `${relativePath} must show examples after daily use guidance`);
  assert.equal(commandText.indexOf("## Examples") < commandText.indexOf("## Contract"), true, `${relativePath} must show examples before the contract details`);
  assert.equal(commandText.includes("## Guardrails"), true, `${relativePath} must separate guardrails from daily flow`);
  assert.equal(commandText.includes("## Workflow"), false, `${relativePath} must not bury daily use inside the old workflow checklist heading`);
  assert.equal(commandText.includes("response language preference"), true, `${relativePath} must instruct hosts to honor Dove language preference`);
  assert.equal(commandText.includes("default is `zh`"), true, `${relativePath} must document Chinese as the default response language`);
  for (const example of command.ux.examples) {
    assert.equal(commandText.includes(example), true, `${relativePath} must render example ${example}`);
  }
  for (const requiredTool of command.requiredTools ?? []) {
    assert.equal(commandText.includes(requiredTool), true, `${relativePath} must mention ${requiredTool}`);
  }
  for (const removedCommandId of removedCommandIds) {
    assert.equal(commandText.includes(removedCommandId), false, `${relativePath} must not mention removed command ${removedCommandId}`);
  }

  assert.equal(commandText.includes("ordinary prompts"), true, `${relativePath} must route ordinary prompts through status guidance`);
  assert.equal(commandText.includes("statusHome.preActionGuidance"), true, `${relativePath} must mention preActionGuidance`);
  assert.equal(commandText.includes("bind, save, deposit, archive, or 沉淀"), true, `${relativePath} must explain ordinary prompt deposition routing`);
  assert.equal(commandText.includes("register external URLs/templates/guidelines as packet-bound sources"), true, `${relativePath} must route external evidence through sources first`);
  assert.equal(commandText.includes("`upsert_note` or `record_document_evidence`"), true, `${relativePath} must route synthesis into note or document evidence`);
  assert.equal(commandText.includes("read-only guidance"), true, `${relativePath} must keep guidance read-only`);
  assert.equal(commandText.includes(".dove/meta/operator-lessons.json"), true, `${relativePath} must auto-recall lessons from the canonical lessons path`);
  assert.equal(commandText.includes("recording lessons remains explicit"), true, `${relativePath} must forbid implicit lesson recording`);
  assert.equal(commandText.includes("Planner, Builder, and Reviewer"), true, `${relativePath} must frame the three primary roles`);
  assert.equal(commandText.includes("subagents/modes"), true, `${relativePath} must keep specialties under primary roles`);
  assert.equal(commandText.includes("not public slash surfaces"), true, `${relativePath} must forbid specialty/role public slash surfaces`);
  assert.equal(commandText.includes("status as the project command center"), true, `${relativePath} must keep status as command center`);
  assert.equal(commandText.includes("mission as a durable work contract/progress object"), true, `${relativePath} must keep mission as work contract/progress object`);
  assert.equal(commandText.includes("Never create hidden runtime"), true, `${relativePath} must forbid hidden runtime`);
  assert.equal(commandText.includes("explicit bounded foreground work"), true, `${relativePath} must keep runtime foreground-bounded`);

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
    assert.equal(commandText.includes("localized `resultCard` summary"), true, `${relativePath} must surface resultCard summaries after mission passes`);
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
    assert.equal(commandText.includes("localized `resultCard` summary"), true, `${relativePath} must surface resultCard summaries after auto runs`);
  }

  if (command.id === "dove.source") {
    assert.equal(commandText.includes("Collect and organize external provenance"), true, `${relativePath} must frame source as external provenance intake`);
    assert.equal(commandText.includes("external information intake, not internal note consolidation"), true, `${relativePath} must keep sources separate from internal synthesis`);
    assert.equal(commandText.includes("pressure-test summaries and writing-style synthesis belong in note or document evidence"), true, `${relativePath} must route internal synthesis away from sources`);
    assert.equal(commandText.includes("sources: [...]"), true, `${relativePath} must document batch source intake`);
    assert.equal(commandText.includes("multiple URLs/templates/guidelines"), true, `${relativePath} must support multi-source provenance capture`);
    assert.equal(commandText.includes("packetIds"), true, `${relativePath} must require packet-bound source provenance`);
    assert.equal(commandText.includes("reviewer-guideline or 审稿偏好 research"), true, `${relativePath} must cover reviewer-preference source research`);
    assert.equal(commandText.includes("Builder/researcher source intake"), true, `${relativePath} must keep reviewer-guideline research in Builder/researcher source intake`);
    assert.equal(commandText.includes("independent audit of an artifact"), true, `${relativePath} must reserve review workflow for explicit artifact audit`);
    assert.equal(commandText.includes("record_document_evidence"), true, `${relativePath} must mention the document evidence deposition route`);
  }

  if (command.id === "dove.note") {
    assert.equal(commandText.includes("packet-bound internal synthesis"), true, `${relativePath} must frame notes as packet-bound synthesis`);
    assert.equal(commandText.includes("pressure-test results"), true, `${relativePath} must include pressure-test results as note material`);
    assert.equal(commandText.includes("internal information consolidation, not external source discovery"), true, `${relativePath} must separate notes from source discovery`);
    assert.equal(commandText.includes("external URLs/templates/guidelines must already be registered as sources"), true, `${relativePath} must require registered source provenance before synthesis`);
    assert.equal(commandText.includes("bind/save/deposit/沉淀 requests"), true, `${relativePath} must handle deposition prompts through note or document evidence`);
    assert.equal(commandText.includes("record_document_evidence"), true, `${relativePath} must mention the document evidence alternative`);
    assert.equal(commandText.includes("packetIds"), true, `${relativePath} must require packet-bound notes`);
    assert.equal(commandText.includes("sourceIds/artifacts"), true, `${relativePath} must preserve note links to sources and artifacts`);
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
    assert.equal(commandText.includes("localized `resultCard` summary"), true, `${relativePath} must surface resultCard summaries for review states`);
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
    assert.equal(commandText.includes("whole-project situation home"), true, `${relativePath} must describe status as a project situation home`);
    assert.equal(commandText.includes("live development situation"), true, `${relativePath} must explain the live development situation`);
    assert.equal(commandText.includes("do not treat `.dove/` context as the live development situation"), true, `${relativePath} must separate live context from Dove durable context`);
    assert.equal(commandText.includes("host-visible context"), true, `${relativePath} must use host-visible context for live status`);
    assert.equal(commandText.includes("statusHome.currentContext"), true, `${relativePath} must expose current context`);
    assert.equal(commandText.includes("statusHome.preActionGuidance"), true, `${relativePath} must expose pre-action guidance after current context`);
    assert.equal(commandText.includes("automatic read-only lesson recall"), true, `${relativePath} must expose automatic lesson recall in status guidance`);
    assert.equal(commandText.includes("Planner/Builder/Reviewer role frame"), true, `${relativePath} must expose role-framed status guidance`);
    assert.equal(commandText.includes("statusHome.projectState"), true, `${relativePath} must expose project state`);
    assert.equal(commandText.includes("statusHome.blockersAndReconciliation"), true, `${relativePath} must expose blockers and reconciliation`);
    assert.equal(commandText.includes("statusHome.nextSteps"), true, `${relativePath} must expose ranked next steps`);
    assert.equal(commandText.includes("statusHome.optionalMissionDetails"), true, `${relativePath} must expose optional mission details`);
    assert.equal(commandText.includes("without `detail: \"full\"`"), true, `${relativePath} must default to compact status queries`);
    assert.equal(commandText.includes("request `detail: \"full\"`"), true, `${relativePath} must reserve full status details for explicit expansion`);
    assert.equal(commandText.includes("saved full status result file"), true, `${relativePath} must forbid reading full saved status files by default`);
    assert.equal(commandText.includes("Do not make mission lists the default body"), true, `${relativePath} must not make status a mission board`);
    assert.equal(commandText.includes("dailyHome.missionList"), false, `${relativePath} must not keep stale mission-board-first dailyHome wording`);
    assert.equal(commandText.includes("Mission 主页"), false, `${relativePath} must not keep stale Chinese mission-board wording`);
    assert.equal(commandText.includes("default status must not render a `Missions` section"), true, `${relativePath} must forbid default Missions sections`);
    assert.equal(commandText.includes("mission item groups omitted"), true, `${relativePath} must omit mission item groups by default`);
    assert.equal(commandText.includes("showMissions"), true, `${relativePath} must expose explicit mission expansion args`);
    assert.equal(commandText.includes("includeMissionDetails"), true, `${relativePath} must expose explicit mission detail args`);
    assert.equal(commandText.includes("collapsed by default"), true, `${relativePath} must collapse optional mission details by default`);
    assert.equal(commandText.includes("show current missions"), true, `${relativePath} must allow ordinary prompt mission expansion`);
    assert.equal(commandText.includes("/dove:missions"), true, `${relativePath} must explicitly forbid a dedicated missions slash command`);
    assert.equal(commandText.includes("/dove:board"), true, `${relativePath} must explicitly forbid a dedicated board slash command`);
    assert.equal(commandText.includes("/dove:list"), true, `${relativePath} must explicitly forbid a dedicated list slash command`);
    assert.equal(commandText.includes("do not route mission-list questions to `/dove:mission`"), true, `${relativePath} must keep mission intake separate from mission listing`);
    assert.equal(commandText.includes("query_dove_mission_board"), true, `${relativePath} must classify mission board as low-level/debug`);
    assert.equal(commandText.includes("Do not print raw internal dumps"), true, `${relativePath} must forbid noisy raw status dumps`);
    assert.equal(commandText.includes("raw status-count objects, recent completed mission recaps, or recent killed mission recaps"), true, `${relativePath} must name hidden raw status dump fields`);
    assert.equal(commandText.includes("if showing optional mission details, keep the `done` group collapsed"), true, `${relativePath} must collapse done mission details unless requested`);
    assert.equal(commandText.includes("ranked 1-3 next steps"), true, `${relativePath} must expose ranked status next steps`);
    assert.equal(commandText.includes("actionableBoundaries"), true, `${relativePath} must expose actionable boundary metadata`);
    assert.equal(commandText.includes("boundaryActionCards"), true, `${relativePath} must expose proposal-only boundary action cards`);
    assert.equal(commandText.includes("current boundary metadata"), true, `${relativePath} must explain boundary state without treating it as live host context`);
    assert.equal(commandText.includes("Boundary types are first-class metadata, not machine status choices"), true, `${relativePath} must keep boundaries separate from status enum`);
    assert.equal(commandText.includes("现在是什么情况"), false, `${relativePath} command prompt should keep canonical instructions in English`);
    assert.equal(commandText.includes("[\"pending\", \"ready\", \"in-progress\", \"blocked\", \"completed\", \"killed\"]"), true, `${relativePath} must expose exact status choices`);
    assert.equal(commandText.includes("excluding `completed` and `killed`"), true, `${relativePath} must exclude completed and killed tasks from displayed adjustment targets`);
    assert.equal(commandText.includes("do not ask whether to modify mission statuses during default `/dove:status`"), true, `${relativePath} must not ask for status changes by default`);
    assert.equal(commandText.includes("requestStatusAdjustment"), true, `${relativePath} must expose explicit status adjustment preview args`);
    assert.equal(commandText.includes("includeStatusAdjustmentPreview"), true, `${relativePath} must expose explicit status adjustment preview args`);
    assert.equal(commandText.includes("single confirmation dialog"), true, `${relativePath} must use one status confirmation dialog`);
    assert.equal(commandText.includes("do not paginate by mission count"), true, `${relativePath} must forbid paginated status confirmation by mission count`);
    assert.equal(commandText.includes("parseable `packetId -> status`"), true, `${relativePath} must require clear packet-to-status adjustments before mutation`);
    assert.equal(commandText.includes("paginate the status UX based on mission count"), false, `${relativePath} must not keep the old paginated status UX`);
    assert.equal(commandText.includes("Collect status choices across pages"), false, `${relativePath} must not collect status choices across pages`);
    assert.equal(commandText.includes("one final confirmation summary"), false, `${relativePath} must not require the old extra final confirmation summary`);
    assert.equal(commandText.includes("not a standalone public slash command"), true, `${relativePath} must route killing through status UX`);
    assert.equal(commandText.includes("localized `resultCard` summary"), true, `${relativePath} must surface resultCard summaries after status adjustments`);
  }

  if (command.id === "dove.operator") {
    assert.equal(commandText.includes("run_dove_operator"), true, `${relativePath} must route through run_dove_operator`);
    assert.equal(commandText.includes("compact queue cards"), true, `${relativePath} must surface compact operator queue cards`);
    assert.equal(commandText.includes("planner preActionGuidance"), true, `${relativePath} must surface operator planner guidance`);
    assert.equal(commandText.includes("read-only lesson recall"), true, `${relativePath} must surface operator lesson recall`);
    assert.equal(commandText.includes("`autoRunnableTasks`"), true, `${relativePath} must include auto-runnable mission queue`);
    assert.equal(commandText.includes("`hostPassRequiredTasks`"), true, `${relativePath} must include host-pass-required mission queue`);
    assert.equal(commandText.includes("blocked missions"), true, `${relativePath} must include blocked mission handling`);
    assert.equal(commandText.includes("writes: []"), true, `${relativePath} must expose proposal-only operator preview`);
    assert.equal(commandText.includes("foreground call only"), true, `${relativePath} must keep operator foreground-only`);
    assert.equal(commandText.includes("awaiting host results"), true, `${relativePath} must not claim host work without results`);
    assert.equal(commandText.includes("`awaiting-host-pass-result` boundary"), true, `${relativePath} must persist host-result boundaries instead of fake completion`);
    assert.equal(commandText.includes("do not expose planner/builder/reviewer as separate slash commands"), true, `${relativePath} must not add role slash surfaces`);
    assert.equal(commandText.includes("pending child plan missions"), true, `${relativePath} must create blocker investigation plan missions`);
    assert.equal(commandText.includes("localized `resultCard` summary"), true, `${relativePath} must surface resultCard summaries after operator runs`);
  }
}

for (const relativePath of OPENCODE_ROLE_SKILL_PATHS) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `Missing skill: ${relativePath}`);
}

for (const role of ["planner", "builder", "reviewer"]) {
  const relativePath = `.opencode/skills/dove-${role}/SKILL.md`;
  const skillText = readRelative(relativePath);
  assert.equal(skillText.includes("Planner, Builder, and Reviewer as the only primary Dove roles"), true, `${relativePath} must present the three primary roles`);
  assert.equal(skillText.includes(".dove/context/actions/current.json"), true, `${relativePath} must read current action context`);
  assert.equal(skillText.includes(".dove/meta/operator-lessons.json"), true, `${relativePath} must read operator lessons before action`);
  assert.equal(skillText.includes("Do not start hidden runtimes"), true, `${relativePath} must forbid hidden runtimes`);
  assert.equal(skillText.includes("unconfirmed writes"), true, `${relativePath} must forbid unconfirmed writes`);
}

const specialtySkillParents = {
  ".opencode/skills/dove-researcher/SKILL.md": "Builder-side subagent/mode",
  ".opencode/skills/dove-experiment-planning/SKILL.md": "Builder-side subagent/mode",
  ".opencode/skills/dove-version-analyst/SKILL.md": "Planner-side audit subagent/mode",
  ".opencode/skills/dove-review-loop/SKILL.md": "Reviewer-side or reviewer-mediated subagent/mode"
};
for (const [relativePath, marker] of Object.entries(specialtySkillParents)) {
  const skillText = readRelative(relativePath);
  assert.equal(skillText.includes(marker), true, `${relativePath} must declare its primary-role parent`);
  assert.equal(skillText.includes("not a manually switchable primary role or public slash surface"), true, `${relativePath} must not look like a peer public role`);
  assert.equal(skillText.includes(".dove/meta/operator-lessons.json"), true, `${relativePath} must read operator lessons before action`);
  assert.equal(skillText.includes("Do not start hidden runtimes"), true, `${relativePath} must forbid hidden runtimes`);
}

const opencodeConfig = JSON.parse(fs.readFileSync(path.join(ROOT, ".opencode.json"), "utf8"));
assert.equal(opencodeConfig.mcpServers["dove"].command, "node");
assert.equal(Object.hasOwn(opencodeConfig, "$schema"), false);
console.log("Command and skill validation passed.");
