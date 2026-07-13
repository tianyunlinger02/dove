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
  DIRECT_PROCESS_ADAPTER_COMMAND_IDS,
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
  "dove.mission": ["create_dove_task"],
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
  "dove.review": ["run_review_loop"],
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

assert.deepEqual(DOVE_TASK_STATUSES, ["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"], "Boundary reasons must not be added to the public task status enum");
for (const boundaryType of DOVE_BOUNDARY_TYPES) {
  assert.equal(DOVE_TASK_STATUSES.includes(boundaryType), false, `${boundaryType} must remain boundary metadata, not a task status`);
}

const generatorText = fs.readFileSync(path.join(ROOT, "scripts", "generate-command-adapters.mjs"), "utf8");
assert.doesNotMatch(generatorText, /const\s+(?:BASE_CONTEXT_PATHS|TOOL_CONTEXT_PATHS|COMMAND_CONTEXT_PATHS|COMMAND_CONSTRAINTS)\b/, "Command context and constraint metadata belongs in src/core/command-manifest.mjs, not the adapter generator");
assert.doesNotMatch(generatorText, /dove\.paper\.\*/, "Generated adapters must not route users to removed paper-namespaced slash commands");

const agentsText = readRelative("AGENTS.md");
assert.equal(agentsText.includes("node ./bin/dove-package.mjs status ."), true, "AGENTS.md must keep compact status available for state questions");
assert.equal(agentsText.includes("first only when the user asks about Dove state"), true, "AGENTS.md must not route ordinary work prompts through status first");
assert.equal(agentsText.includes("For requests to fix, implement, research, verify, write, review, experiment, or draw, start with visible substantive work"), true, "AGENTS.md must require substantive work before status/navigation for work prompts");
assert.equal(agentsText.includes("node ./bin/dove-package.mjs status . --missions"), true, "AGENTS.md must route task-choice questions through compact mission expansion");
assert.equal(agentsText.includes("node ./bin/dove-package.mjs figure . --intent"), true, "AGENTS.md must route figure requests through the compact figure CLI");
assert.doesNotMatch(agentsText, /--full\s+--json|--json\s+--full/, "AGENTS.md must not recommend full JSON for ordinary answers");
for (const removedCommandId of removedCommandIds) {
  assert.equal(agentsText.includes(removedCommandId), false, `AGENTS.md must not mention removed command ${removedCommandId}`);
}

const commandIds = COMMAND_SURFACES.map((command) => command.id);
assert.deepEqual(commandIds, expectedCommandIds, "Public command surface must stay task-centered and flat");

const commandIdSet = new Set(commandIds);
for (const compactStatusPath of [".dove/state.json", ".dove/task-packets/index.json", ".dove/workspace/index.json", ".dove/orchestration/board.json", ".dove/meta/operator-lessons.json"]) {
  assert.equal(TOOL_CONTEXT_PATHS.query_dove_status.includes(compactStatusPath), true, `query_dove_status should read compact status path ${compactStatusPath}`);
}
for (const defaultHiddenPath of [".dove/runtime/continuation.json", ".dove/runtime/events.json", ".dove/runtime/results.json", ".dove/reviews/REVIEW_STATE.json", ".dove/reviews/concerns.json", ".dove/versions/index.json", ".dove/versions/comparisons.json", ".dove/experiments"]) {
  assert.equal(TOOL_CONTEXT_PATHS.query_dove_status.includes(defaultHiddenPath), false, `query_dove_status compact fallback should not read ${defaultHiddenPath} by default`);
}
assert.equal(TOOL_CONTEXT_PATHS.query_dove_status.includes(".dove/versions/rollback-index.json"), false, "query_dove_status must not read a Dove-specific rollback index");
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

const generatedAdapterForbiddenTerms = [
  "preActionGuidance",
  "resultCard",
  "boundaryType",
  "packetId",
  "packetIds",
  "taskPacketId",
  "missionPacketId",
  ".dove/",
  "query_dove_status",
  "apply_dove_status_adjustments",
  "run_dove_auto",
  "record_dove_mission_pass",
  "create_dove_task",
  "run_figure_workflow",
  "run_dove_operator",
  "record_document_evidence",
  "register_source",
  "upsert_note",
  "upsert_draft",
  "queueSummary",
  "queuePreview",
  "ownerRole",
  "nextRole",
  "project:dove.",
  "providerId",
  "sourceSvgPath",
  "targetFinalSvgPath",
  "finalSvgPath",
  "outputManifestPath",
  "svgContent",
  "fullResult",
  "diagnostics",
  "MCP capability",
  "local CLI",
  "Dove runtime",
  "CLI route",
  "host command",
  "host",
  "bounded",
  "foreground",
  "provenance",
  "terminal check",
  "terminal or storage",
  "workflow records",
  "saved records",
  "saved-record",
  "Dove action",
  "tool limitations",
  "record was not saved",
  "cannot save",
  "save changes"
];

function requireNoGeneratedAdapterLeaks(commandText, relativePath) {
  for (const leakedTerm of generatedAdapterForbiddenTerms) {
    assert.equal(commandText.includes(leakedTerm), false, `${relativePath} leaked internal adapter term ${leakedTerm}`);
  }
}

for (const { hostId, command, relativePath, commandText } of adapterEntriesForValidation) {
  const frontmatterEnd = commandText.indexOf("\n---\n\n");
  assert.equal(commandText.startsWith("---\n"), true, `${relativePath} must expose frontmatter for host slash command lists`);
  assert.ok(frontmatterEnd > 0, `${relativePath} must close frontmatter before the command body`);
  const frontmatter = commandText.slice(0, frontmatterEnd + "\n---".length);
  assert.equal(frontmatter.includes("description:"), true, `${relativePath} must expose a short slash-list description`);
  assert.equal(frontmatter.includes(command.summary), true, `${relativePath} frontmatter description must come from the canonical command summary`);
  assert.ok(command.ux, `${command.id} should declare daily UX metadata in the manifest`);
  assert.ok(Array.isArray(command.ux.dailyFlow) && command.ux.dailyFlow.length > 0, `${command.id} should declare daily flow guidance`);
  assert.ok(Array.isArray(command.ux.examples) && command.ux.examples.length >= 2 && command.ux.examples.length <= 3, `${command.id} should declare 2-3 daily examples`);
  assert.equal(commandText.includes("## Daily use"), true, `${relativePath} must put daily use guidance before operating rules`);
  assert.equal(commandText.includes("## Examples"), true, `${relativePath} must expose concrete daily examples`);
  assert.equal(commandText.indexOf("## Daily use") < commandText.indexOf("## Examples"), true, `${relativePath} must show examples after daily use guidance`);
  assert.equal(commandText.indexOf("## Examples") < commandText.indexOf("## Operating rules"), true, `${relativePath} must show examples before operating rules`);
  assert.equal(commandText.includes("## Operating rules"), true, `${relativePath} must separate operating rules from daily flow`);
  assert.equal(commandText.includes("## Contract"), false, `${relativePath} must not expose raw contract fields in the daily adapter`);
  assert.equal(commandText.includes("## Guardrails"), false, `${relativePath} must not expose guardrail dumps in the daily adapter`);
  assert.equal(commandText.includes("## Workflow"), false, `${relativePath} must not bury daily use inside the old workflow checklist heading`);
  assert.equal(commandText.includes("response language preference"), true, `${relativePath} must instruct hosts to honor Dove language preference`);
  assert.equal(commandText.includes("respond in Chinese by default"), true, `${relativePath} must document Chinese as the default response language`);
  requireNoGeneratedAdapterLeaks(commandText, relativePath);
  if (hostId === "opencode") {
    assert.equal(commandText.includes("/dove:"), false, `${relativePath} must use OpenCode dot command examples`);
  }
  for (const example of command.ux.examples) {
    const expectedExample = hostId === "opencode" ? example.replace(/^\/dove:/u, "/dove.") : example;
    assert.equal(commandText.includes(expectedExample), true, `${relativePath} must render example ${expectedExample}`);
  }
  for (const removedCommandId of removedCommandIds) {
    assert.equal(commandText.includes(removedCommandId), false, `${relativePath} must not mention removed command ${removedCommandId}`);
  }

  assert.equal(commandText.includes("Dove's returned answer as the source of truth"), true, `${relativePath} must keep Dove answers authoritative without direct file reads`);
  assert.equal(commandText.includes("practical operator actions"), true, `${relativePath} must translate stored facts into operator actions`);
  assert.equal(commandText.includes("ordinary task wording"), true, `${relativePath} must require ordinary user-facing wording instead of implementation mechanics`);
  assert.equal(commandText.includes("answer the Dove request the operator invoked"), true, `${relativePath} must route daily answers through the invoked Dove request first`);
  assert.equal(commandText.includes("manually reading or listing internal files"), true, `${relativePath} must prohibit visible internal-file reads for default answers`);
  assert.equal(commandText.includes("practical result in ordinary language"), true, `${relativePath} must report unavailable work in ordinary language instead of dumping files`);
  assert.equal(commandText.includes("This request has one listed project check") || commandText.includes("This request has one listed project action") || commandText.includes("This request has no listed project action"), true, `${relativePath} must give a concrete project check/action or stop instead of file emulation`);
  if (DIRECT_PROCESS_ADAPTER_COMMAND_IDS.includes(command.id)) {
    assert.equal(commandText.includes("--mutation-mode direct-process"), true, `${relativePath} must explicitly use direct-process because generated host adapters do not apply mutation plans`);
  }
  assert.equal(commandText.includes("explicitly listed project check or action fails"), true, `${relativePath} must stop after project check/action failures instead of file recovery`);
  assert.equal(commandText.includes("Keep Planner, Builder, and Reviewer responsibilities separate"), true, `${relativePath} must frame the three primary responsibilities`);
  assert.equal(commandText.includes("Return the next action, evidence expectations, and unresolved blockers"), true, `${relativePath} must return actionable outcomes without fake completion`);

  if (command.id === "dove.init") {
    assert.equal(commandText.includes("one clear Dove goal"), true, `${relativePath} must frame init as goal setup`);
    assert.equal(commandText.includes("Keep init limited to the project goal"), true, `${relativePath} must keep init out of concrete execution`);
  }

  if (command.id === "dove.mission") {
    assert.equal(commandText.includes("Propose the task first"), true, `${relativePath} must require proposal-first mission intake`);
    assert.equal(commandText.includes("materialize the contract"), true, `${relativePath} must materialize only the contract`);
    assert.equal(commandText.includes("recommended next workflow"), true, `${relativePath} must hand off to recommended workflow routes`);
    assert.equal(commandText.includes("does not execute"), true, `${relativePath} must distinguish mission definition from execution`);
    assert.equal(commandText.includes("record_dove_mission_pass"), false, `${relativePath} must not route public mission through result recording`);
  }

  if (command.id === "dove.auto") {
    assert.equal(commandText.includes("target, work limit, and visible steps"), true, `${relativePath} must expose auto target and work limit`);
    assert.equal(commandText.includes("current approved interaction"), true, `${relativePath} must keep auto visible-only`);
    assert.equal(commandText.includes("real sources or materials") || commandText.includes("real verified sources or materials"), true, `${relativePath} must require material before research success`);
    assert.equal(commandText.includes("Stop clearly"), true, `${relativePath} must document auto stop conditions`);
    assert.equal(commandText.includes("hidden background continuation"), true, `${relativePath} must forbid hidden continuation`);
  }

  if (command.id === "dove.status") {
    assert.equal(commandText.includes("node ./bin/dove-package.mjs status ."), true, `${relativePath} must provide the concrete local status check`);
    assert.equal(commandText.includes("what should I do next?"), true, `${relativePath} must frame status around the ordinary next-action question`);
    assert.equal(commandText.includes("Default output should read like a project assistant"), true, `${relativePath} must describe the default human status output`);
    assert.equal(commandText.includes("fixed four-line template"), true, `${relativePath} must forbid fixed status templates`);
    assert.equal(commandText.includes("smallest useful action"), true, `${relativePath} must guide toward the smallest useful action`);
    assert.equal(commandText.includes("one clear confirmation step"), true, `${relativePath} must use one status confirmation step`);
    assert.equal(commandText.includes("raw identifiers"), true, `${relativePath} must keep internal identifiers collapsed`);
    assert.equal(commandText.includes("现在是什么情况"), false, `${relativePath} command prompt should keep canonical instructions in English`);
    assert.equal(command.constraints.some((item) => item.includes("query_dove_status")), true, `${relativePath} must keep internal status tool guidance in manifest constraints`);
    assert.equal(command.requiredTools.includes("query_dove_status"), true, `${relativePath} must keep query_dove_status as the canonical tool binding`);
    assert.equal(command.requiredTools.includes("apply_dove_status_adjustments"), true, `${relativePath} must keep status adjustment as the canonical tool binding`);
  }

  if (command.id === "dove.operator") {
    assert.equal(commandText.includes("practical queue situation"), true, `${relativePath} must preview the practical queue situation`);
    assert.equal(commandText.includes("operator pass only after confirmation"), true, `${relativePath} must keep operator confirmation-only`);
    assert.equal(commandText.includes("real results"), true, `${relativePath} must not claim work without results`);
    assert.equal(commandText.includes("blocker-investigation tasks only"), true, `${relativePath} must require explicit blocker investigation creation`);
  }

  if (command.id === "dove.lessons") {
    assert.equal(commandText.includes("distilled guidance"), true, `${relativePath} must keep lessons distilled`);
    assert.equal(commandText.includes("Do not import raw transcripts"), true, `${relativePath} must reject raw lesson imports`);
  }

  if (command.id === "dove.version") {
    assert.equal(commandText.includes("direction reset"), true, `${relativePath} must frame version as a direction reset`);
    assert.equal(commandText.includes("not as a general undo command"), true, `${relativePath} must reject generic undo semantics`);
    assert.equal(commandText.includes("Require a short reason"), true, `${relativePath} must require a reason before reset`);
    assert.equal(commandText.includes("rollbackCheckpointId"), false, `${relativePath} must not expose checkpoint restore targeting`);
    assert.equal(commandText.includes("confirmed: true"), false, `${relativePath} must not expose raw confirmation args`);
  }

  if (command.id === "dove.source") {
    assert.equal(commandText.includes("Collect and organize external material"), true, `${relativePath} must frame source as external material intake`);
    assert.equal(commandText.includes("real title, locator, citation, URL"), true, `${relativePath} must require verifiable source material`);
    assert.equal(commandText.includes("no source was added"), true, `${relativePath} must not claim source writes after retrieval failure`);
    assert.equal(commandText.includes("Keep source intake separate from synthesis"), true, `${relativePath} must route synthesis away from sources`);
    assert.equal(command.constraints.some((item) => item.includes("record_document_evidence")), true, `${relativePath} must keep the document evidence deposition route in manifest constraints`);
  }

  if (command.id === "dove.note") {
    assert.equal(commandText.includes("real synthesis content"), true, `${relativePath} must require real note material`);
    assert.equal(commandText.includes("added through source first"), true, `${relativePath} must require source details before evidence-backed synthesis`);
    assert.equal(commandText.includes("raw internal identifiers"), true, `${relativePath} must keep identifiers out of note replies`);
  }

  if (command.id === "dove.figure") {
    assert.equal(commandText.includes("node ./bin/dove-package.mjs figure . --intent"), true, `${relativePath} must provide the concrete local figure CLI route`);
    assert.equal(commandText.includes("node ./bin/dove-package.mjs figure . --target \"<confirmed task title>\" --intent"), true, `${relativePath} must rerun figure with a confirmed task title instead of hiding the task in the intent`);
    assert.equal(commandText.includes("operator explicitly approves"), true, `${relativePath} must forbid applying figure file changes without explicit approval`);
    assert.equal(commandText.includes("whether this figure is usable now"), true, `${relativePath} must answer current-figure usability`);
    assert.equal(commandText.includes("hand-drawn SVG plan"), true, `${relativePath} must support default manual SVG figure preparation`);
    assert.equal(commandText.includes("waiting for SVG output"), true, `${relativePath} must tell operators when SVG output is needed`);
    assert.equal(commandText.includes("OPENAI_API_KEY"), true, `${relativePath} must require env-var OpenAI credentials for image generation`);
    assert.equal(command.requiredTools.includes("run_figure_workflow"), true, `${relativePath} must keep run_figure_workflow as the canonical tool binding`);
    for (const lowLevelTool of ["upsert_figure_plan", "prepare_figure_generation", "import_figure_generation", "validate_figure_pipeline"]) {
      assert.equal(commandText.includes(lowLevelTool), false, `${relativePath} must not expose low-level figure tool ${lowLevelTool} as the daily slash contract`);
    }
  }

  if (command.id === "dove.experience") {
    assert.equal(commandText.includes("experiment and evidence workflow"), true, `${relativePath} must frame experience as experiment evidence work`);
    assert.equal(commandText.includes("Require a real experiment goal"), true, `${relativePath} must reject placeholder experiments`);
    assert.equal(commandText.includes("Do not promote unsupported results into claims"), true, `${relativePath} must protect claim promotion`);
  }

  if (command.id === "dove.draft") {
    assert.equal(commandText.includes("Write as much as current evidence supports"), true, `${relativePath} must draft within evidence limits`);
    assert.equal(commandText.includes("explicit placeholders"), true, `${relativePath} must use placeholders for evidence gaps`);
  }

  if (command.id === "dove.review") {
    assert.equal(commandText.includes("local evidence-aware review"), true, `${relativePath} must make ordinary review local and evidence-aware`);
    assert.equal(commandText.includes("Inspect real project materials"), true, `${relativePath} must inspect materials instead of substituting status/navigation`);
    assert.equal(commandText.includes("Use separate isolated or audio review only when the operator explicitly asks"), true, `${relativePath} must keep isolated/audio review explicit-only`);
    assert.equal(commandText.includes("plain language"), true, `${relativePath} must report review outcomes plainly`);
    assert.equal(commandText.includes("Run an isolated audio review"), false, `${relativePath} must not make ordinary review an audio handoff`);
  }

  if (command.id === "dove.review-loop") {
    assert.equal(commandText.includes("exactly one visible local Reviewer pass"), true, `${relativePath} must define one Reviewer pass`);
    assert.equal(commandText.includes("does not revise Builder-owned material"), true, `${relativePath} must keep revision out of the Reviewer call`);
    assert.equal(commandText.includes("separate explicit Builder revision call"), true, `${relativePath} must require an explicit Builder handoff before another review`);
    assert.equal(commandText.includes("three rounds by default"), false, `${relativePath} must not advertise a three-round loop`);
  }

  if (command.id === "dove.rebuttal") {
    assert.equal(commandText.includes("Organize reviewer issues before drafting responses"), true, `${relativePath} must normalize issues before responses`);
    assert.equal(commandText.includes("Keep rebuttal work on the author side"), true, `${relativePath} must keep rebuttal author-side`);
    assert.equal(commandText.includes("unresolved gaps"), true, `${relativePath} must preserve unsupported gaps`);
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
