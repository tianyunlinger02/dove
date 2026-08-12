#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import { CLI_COMMAND_SPECS, parseDoveCli } from "../src/cli/command-parser.mjs";
import {
  COMMAND_SURFACE_BY_ID,
  COMMAND_SURFACES,
  HOST_ADAPTER_POLICY,
  PROJECT_HOST_IDS,
  adapterPathForCommand
} from "../src/core/command-manifest.mjs";
import { USER_RESPONSE_POLICY } from "../src/core/user-response-policy.mjs";
import {
  generatedAdapterEntries,
  generatedClaudeAmbientProjectEntries,
  renderCommandAdapter
} from "./generate-command-adapters.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_HOST_IDS = ["opencode", "codex", "cursor", "agents", "claude"];
const EXPECTED_SKILL_IDS = ["dove.research", "dove.status", "dove.source", "dove.experiment", "dove.draft", "dove.figure", "dove.review", "dove.rebuttal", "dove.lessons", "dove.auto"];
const EXPECTED_AMBIENT_PATHS = [
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  ".claude/skills/dove-lessons-intake/SKILL.md"
];

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must not contain duplicates`);
}

function text(value) {
  return JSON.stringify(value);
}

function assertSkillManifest() {
  assert.deepEqual(COMMAND_SURFACES.map((command) => command.id), EXPECTED_SKILL_IDS, "Dove flat Skill manifest drifted");
  assert.deepEqual(Object.keys(COMMAND_SURFACE_BY_ID), EXPECTED_SKILL_IDS, "Skill lookup must match the ordered public manifest");
  assert.deepEqual(PROJECT_HOST_IDS, EXPECTED_HOST_IDS, "Generated Skill hosts drifted");

  for (const command of COMMAND_SURFACES) {
    const label = command.id;
    assert.match(label, /^dove\.[a-z]+$/u, `${label} must remain a flat Skill id`);
    assert.equal(COMMAND_SURFACE_BY_ID[label], command, `${label} lookup must reference the canonical entry`);
    assert.equal(typeof command.summary, "string", `${label} needs a summary`);
    assert.deepEqual(command.requiredTools, [], `${label} must not depend on a database or MCP tool`);
    assert.ok(Array.isArray(command.guidance) && command.guidance.length <= 1, `${label} guidance must stay thin`);
    const modes = command.workflow?.modes;
    assert.ok(Array.isArray(modes) && modes.length > 0, `${label} needs workflow guidance`);
    assertUnique(modes.map((mode) => mode.id), `${label} workflow modes`);
    for (const mode of modes) {
      assert.ok(Array.isArray(mode.steps) && mode.steps.length > 0, `${label}/${mode.id} needs steps`);
      assert.ok(Array.isArray(mode.clarification), `${label}/${mode.id} clarification must be an array`);
      for (const step of mode.steps) {
        assert.equal(step.type, "host", `${label}/${mode.id} must use host-native work`);
        assert.equal(typeof step.capability, "string", `${label}/${mode.id} needs a capability`);
        assert.equal(typeof step.instruction, "string", `${label}/${mode.id} needs an instruction`);
        assert.equal(typeof step.readOnly, "boolean", `${label}/${mode.id} must classify read-only behavior`);
        assert.equal(typeof step.persistWhen, "string", `${label}/${mode.id} must classify persistence`);
        assert.equal(step.tool, undefined, `${label}/${mode.id} must not impersonate an MCP call`);
      }
    }
  }

  const serialized = text(COMMAND_SURFACES);
  assert.match(serialized, /\.dove\/research\/RESEARCH\.md/u, "Skills must share the human-maintained overview entry");
  assert.doesNotMatch(serialized, /query_dove|manage_dove|MCP tool|semantic ID|Workspace record|Mission ID/iu, "Skills must not retain the research database contract");
  assert.doesNotMatch(serialized, /SQLite|vector database|hidden state service/iu, "Skills must not prescribe a replacement database");

  const research = COMMAND_SURFACE_BY_ID["dove.research"];
  assert.equal(research.workflow.status, "single-bounded-pass");
  assert.match(text(research), /Complete exactly one bounded research or project pass/iu);
  assert.match(text(research), /rather than turning Research into multi-round autonomy/iu);

  const status = COMMAND_SURFACE_BY_ID["dove.status"];
  assert.ok(status.workflow.modes[0].steps.every((step) => step.readOnly), "Status must remain read-only");
  assert.match(text(status), /If the overview is absent.*say so naturally/isu);

  const experimentSteps = COMMAND_SURFACE_BY_ID["dove.experiment"].workflow.modes[0].steps;
  const planIndex = experimentSteps.findIndex((step) => /Before execution.*write/isu.test(step.instruction));
  const runIndex = experimentSteps.findIndex((step) => step.capability === "experiment-execution");
  assert.ok(planIndex >= 0 && runIndex > planIndex, "Experiment planning must precede execution");
  assert.match(text(COMMAND_SURFACE_BY_ID["dove.experiment"]), /positive, negative, null, mixed, failed or stopped.*denominator/isu);

  const review = COMMAND_SURFACE_BY_ID["dove.review"];
  assert.equal(review.workflow.status, "user-managed-review-document");
  assert.match(text(review), /separate reviewer chosen and managed by the user/iu);
  assert.match(text(review), /same Review document/iu);
  assert.doesNotMatch(text(review), /ReviewExchange|reviewId|findingId|verdictEnum|strictImportSchema/u);

  const auto = COMMAND_SURFACE_BY_ID["dove.auto"];
  assert.equal(auto.workflow.status, "explicit-multi-round-autonomy");
  assert.match(text(auto), /Require an existing.*RESEARCH\.md/isu);
  assert.match(text(auto), /recommendation.*report the block.*stop/isu);
  assert.match(text(auto), /without a default round count/iu);
  assert.doesNotMatch(text(auto), /task database|execution ledger.*create/iu);
}

function assertHostPolicy() {
  assert.deepEqual(HOST_ADAPTER_POLICY.toolAccess, {
    transport: "host-files",
    unavailable: "report",
    cliFallback: false,
    shellFallback: false
  });
  assert.deepEqual(HOST_ADAPTER_POLICY.privacy, { exposePrivateProtocol: false });
  const policy = HOST_ADAPTER_POLICY.adapterBullets.join("\n");
  assert.match(policy, /researcher-owned documents.*not a database/isu);
  assert.match(policy, /host file and research tools directly/iu);
  assert.match(policy, /failures.*limitations.*uncertainty.*scientific authority/isu);

  assert.ok(Array.isArray(USER_RESPONSE_POLICY) && USER_RESPONSE_POLICY.length > 0 && USER_RESPONSE_POLICY.length <= 3);
  const responseText = USER_RESPONSE_POLICY.join("\n");
  assert.match(responseText, /natural, clear Chinese.*user requests another language or format/isu);
  assert.match(responseText, /user's perspective.*faithful synthesis/isu);
  assert.match(responseText, /internal workflow.*structured machine data.*response outline/isu);
}

function assertGeneratedAdapters() {
  const entries = generatedAdapterEntries();
  assert.equal(entries.length, COMMAND_SURFACES.length * PROJECT_HOST_IDS.length);
  assertUnique(entries.map((entry) => entry.relativePath), "Generated adapter paths");
  for (const entry of entries) {
    assert.equal(entry.relativePath, adapterPathForCommand(entry.hostId, entry.command));
    assert.equal(entry.content, renderCommandAdapter(entry.hostId, entry.command));
    assert.match(entry.content, /^---\n/um);
    assert.match(entry.content, /## Internal workflow\n\nInternal guidance only; never use this workflow as the final report outline\./u);
    assert.doesNotMatch(entry.content, /Dove MCP tools|Call `(?:query|manage)_dove|semantic ID/iu);
    for (const bullet of HOST_ADAPTER_POLICY.adapterBullets) assert.ok(entry.content.includes(bullet));
    for (const bullet of USER_RESPONSE_POLICY) assert.equal(entry.content.split(bullet).length - 1, 1);
  }
}

function assertAmbientRouting() {
  const entries = generatedClaudeAmbientProjectEntries();
  assert.deepEqual(entries.map((entry) => entry.relativePath), EXPECTED_AMBIENT_PATHS);
  const byPath = new Map(entries.map((entry) => [entry.relativePath, entry.content]));
  const rule = byPath.get(".claude/rules/dove.md");
  const intake = byPath.get(".claude/skills/dove-intake/SKILL.md");
  const lessons = byPath.get(".claude/skills/dove-lessons-intake/SKILL.md");
  const ordinary = `${rule}\n${intake}`;
  assert.match(ordinary, /zero-write/iu);
  assert.match(ordinary, /smallest ambient-eligible Skill/iu);
  assert.match(ordinary, /Auto is explicit-only.*(?:cannot select|never select)/isu);
  assert.match(ordinary, /Do not create a research document merely because/iu);
  assert.match(ordinary, /host file and research tools directly/iu);
  assert.match(ordinary, /\.dove\/research\/RESEARCH\.md/u);
  assert.doesNotMatch(`${ordinary}\n${lessons}`, /manage_dove|public Dove MCP|semantic ID/iu);
  assert.match(lessons, /\.dove\/research\/LESSONS\.md/u);
  assert.match(lessons, /Do not introduce IDs.*schema.*database/isu);
}

function assertPackagedAgentPolicy() {
  const agentsText = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
  for (const bullet of USER_RESPONSE_POLICY) assert.equal(agentsText.split(bullet).length - 1, 1);
}

function assertTrellisSpecMirrors() {
  const sourceDir = path.join(ROOT, ".trellis/spec/frontend");
  const templateDir = path.join(ROOT, "src/templates/markdown/spec/frontend");
  const sourceNames = fs.readdirSync(sourceDir).filter((name) => name.endsWith(".md")).sort();
  const templateNames = fs.readdirSync(templateDir).filter((name) => name.endsWith(".md")).sort();
  assert.deepEqual(templateNames, sourceNames);
  for (const name of sourceNames) assert.ok(fs.readFileSync(path.join(templateDir, name)).equals(fs.readFileSync(path.join(sourceDir, name))), name);
}

function assertRuntimeCli() {
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "init"));
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "hook"));
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "mcp"), false, "CLI must not expose the retired MCP server");
  assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, "migrate-research"), false, "CLI must not expose format migration");
  assert.ok(Object.hasOwn(CLI_COMMAND_SPECS, "export-research"), "CLI must expose explicit Markdown export");
  assert.deepEqual(parseDoveCli(["hook", "user-prompt-submit", "--project=/workspace"]), {
    command: "hook",
    positionals: ["user-prompt-submit"],
    args: ["--project", "/workspace"]
  });
  assert.throws(() => parseDoveCli(["mcp", "serve"]), /Unknown|requires|unsupported/iu);
}

async function assertSourceBuilds() {
  for (const entryPoint of ["src/core/index.mjs", "bin/dove.mjs"]) {
    await build({ absWorkingDir: ROOT, entryPoints: [entryPoint], bundle: true, write: false, platform: "node", format: "esm", external: ["node:*"], logLevel: "silent" });
  }
}

assertSkillManifest();
assertHostPolicy();
assertGeneratedAdapters();
assertAmbientRouting();
assertPackagedAgentPolicy();
assertTrellisSpecMirrors();
assertRuntimeCli();
await assertSourceBuilds();

console.log(JSON.stringify({ status: "passed" }, null, 2));
