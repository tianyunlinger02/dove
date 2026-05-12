import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
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
  "dove.kill",
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
  "dove.status": ["query_dove_status"],
  "dove.kill": ["kill_dove_task"],
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

const generatorText = fs.readFileSync(path.join(ROOT, "scripts", "generate-command-adapters.mjs"), "utf8");
assert.doesNotMatch(generatorText, /const\s+(?:BASE_CONTEXT_PATHS|TOOL_CONTEXT_PATHS|COMMAND_CONTEXT_PATHS|COMMAND_CONSTRAINTS)\b/, "Command context and constraint metadata belongs in src/core/command-manifest.mjs, not the adapter generator");
assert.doesNotMatch(generatorText, /dove\.paper\.\*/, "Generated adapters must not route users to removed paper-namespaced slash commands");

const commandIds = COMMAND_SURFACES.map((command) => command.id);
assert.deepEqual(commandIds, expectedCommandIds, "Public command surface must stay task-centered and flat");

const commandIdSet = new Set(commandIds);
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
  assert.equal(commandText.includes("response language preference"), true, `${relativePath} must instruct hosts to honor Dove language preference`);
  assert.equal(commandText.includes("default is `zh`"), true, `${relativePath} must document Chinese as the default response language`);
  for (const requiredTool of command.requiredTools ?? []) {
    assert.equal(commandText.includes(requiredTool), true, `${relativePath} must mention ${requiredTool}`);
  }
  for (const removedCommandId of removedCommandIds) {
    assert.equal(commandText.includes(removedCommandId), false, `${relativePath} must not mention removed command ${removedCommandId}`);
  }

  if (command.id === "dove.mission") {
    assert.equal(commandText.includes("create_dove_task"), true, `${relativePath} must create classified tasks through create_dove_task`);
    assert.equal(commandText.includes("Classify each task as `plan`, `execute`, or `audit`"), true, `${relativePath} must expose task classification`);
    assert.equal(commandText.includes("User-created tasks default to level 3"), true, `${relativePath} must state the user task level default`);
  }

  if (command.id === "dove.auto") {
    assert.equal(commandText.includes("same intake and classification model as `/dove:mission`"), true, `${relativePath} must start like mission`);
    assert.equal(commandText.includes("Require explicit operator confirmation"), true, `${relativePath} must require confirmation`);
    assert.equal(commandText.includes("source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status"), true, `${relativePath} must document internal top-level workflow calls`);
    assert.equal(commandText.includes("Stop at completed, blocked, killed"), true, `${relativePath} must document stop conditions`);
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

  if (command.id === "dove.kill") {
    assert.equal(commandText.includes("Never kill the level-0 init task"), true, `${relativePath} must refuse init kills`);
    assert.equal(commandText.includes("Return indexed task choices"), true, `${relativePath} must prompt with indexed choices when ambiguous`);
  }
}

for (const relativePath of OPENCODE_ROLE_SKILL_PATHS) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `Missing skill: ${relativePath}`);
}

const opencodeConfig = JSON.parse(fs.readFileSync(path.join(ROOT, ".opencode.json"), "utf8"));
assert.equal(opencodeConfig.mcpServers["dove"].command, "node");
assert.equal(Object.hasOwn(opencodeConfig, "$schema"), false);
console.log("Command and skill validation passed.");
