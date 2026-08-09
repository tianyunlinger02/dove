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
import { TOOL_INPUT_SCHEMAS, toolDefinitions } from "../src/mcp/tool-definitions.mjs";
import {
  checkGeneratedAdapters,
  generatedAdapterEntries,
  generatedClaudeAmbientProjectEntries,
  renderCommandAdapter
} from "./generate-command-adapters.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ONLY = process.argv.includes("--source-only");
const MAX_ADAPTER_BYTES = 7000;
const MAX_AMBIENT_ENTRY_BYTES = 2200;
const MAX_AMBIENT_AGGREGATE_BYTES = 5000;
const MAX_SHARED_POLICY_BYTES = 800;

const EXPECTED_HOST_IDS = ["opencode", "codex", "cursor", "agents", "claude"];
const EXPECTED_SKILL_TOOLS = Object.freeze({
  "dove.research": ["query_dove_research", "manage_dove_workspace", "manage_dove_missions"],
  "dove.status": ["query_dove_research"],
  "dove.source": ["query_dove_research", "manage_dove_sources"],
  "dove.experiment": ["query_dove_research", "manage_dove_experiments", "manage_dove_claims"],
  "dove.draft": ["query_dove_research", "manage_dove_claims"],
  "dove.figure": ["query_dove_research", "manage_dove_sources", "manage_dove_experiments"],
  "dove.review": ["query_dove_research", "manage_dove_reviews"],
  "dove.rebuttal": ["query_dove_research", "manage_dove_reviews", "manage_dove_claims"],
  "dove.lessons": ["manage_dove_lessons"]
});
const EXPECTED_TOOL_NAMES = [
  "query_dove_research",
  "manage_dove_workspace",
  "manage_dove_missions",
  "manage_dove_sources",
  "manage_dove_experiments",
  "manage_dove_claims",
  "manage_dove_reviews",
  "manage_dove_lessons"
];
const EXPECTED_CLI = Object.freeze({
  init: { options: ["--project", "--host", "--json", "--format"], positional: { min: 0, max: 0 } },
  sync: { options: ["--project", "--host", "--json", "--format"], positional: { min: 0, max: 0 } },
  upgrade: { options: ["--project", "--json", "--format"], positional: { min: 0, max: 0 } },
  reinstall: { options: ["--project", "--json", "--format"], positional: { min: 0, max: 0 } },
  doctor: { options: ["--project", "--json", "--format"], positional: { min: 0, max: 0 } },
  mcp: { options: ["--project"], positional: { min: 1, max: 1 } },
  hook: { options: ["--project"], positional: { min: 1, max: 1 } }
});
const EXPECTED_AMBIENT_PATHS = [
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  ".claude/skills/dove-lessons-intake/SKILL.md"
];

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must not contain duplicates`);
}

function schemaShape(schema) {
  return {
    type: schema?.type ?? null,
    required: [...(schema?.required ?? [])],
    properties: Object.keys(schema?.properties ?? {}),
    additionalProperties: schema?.additionalProperties
  };
}

function assertSkillManifest() {
  const expectedIds = Object.keys(EXPECTED_SKILL_TOOLS);
  assert.deepEqual(COMMAND_SURFACES.map((command) => command.id), expectedIds, "Dove must expose exactly the nine flat Skills");
  assert.deepEqual(Object.keys(COMMAND_SURFACE_BY_ID), expectedIds, "Skill lookup must match the ordered public manifest");
  assert.deepEqual(PROJECT_HOST_IDS, EXPECTED_HOST_IDS, "Generated Skill hosts drifted");

  for (const command of COMMAND_SURFACES) {
    const label = command.id;
    assert.match(label, /^dove\.[a-z]+$/u, `${label} must remain a flat Skill id`);
    assert.equal(COMMAND_SURFACE_BY_ID[label], command, `${label} lookup must reference the canonical entry`);
    assert.equal(typeof command.title, "string", `${label} needs a title`);
    assert.equal(typeof command.summary, "string", `${label} needs a summary`);
    assert.deepEqual(command.requiredTools, EXPECTED_SKILL_TOOLS[label], `${label} tool requirements drifted`);
    assertUnique(command.requiredTools, `${label} tools`);
    assert.ok(Array.isArray(command.constraints) && command.constraints.length > 0, `${label} needs research constraints`);
    assert.match(command.constraints.join("\n"), /truth.*evidence integrity.*uncertainty.*claim scope/isu, `${label} must preserve evidence discipline`);
    assert.match(command.constraints.join("\n"), /Do not create Missions automatically/iu, `${label} must not create work records merely on invocation`);
    assert.match(command.constraints.join("\n"), /semantic IDs/iu, `${label} must use semantic identifiers`);
    assert.ok(Array.isArray(command.adapterNotes), `${label} adapter notes must be an array`);
    assert.ok(command.adapterNotes.length <= 1, `${label} adapter guidance must stay thin`);

    const modes = command.callFlow?.modes;
    assert.ok(Array.isArray(modes) && modes.length > 0, `${label} needs at least one workflow mode`);
    assertUnique(modes.map((mode) => mode.id), `${label} workflow modes`);
    for (const mode of modes) {
      assert.equal(typeof mode.when, "string", `${label}/${mode.id} needs a routing condition`);
      assert.ok(Array.isArray(mode.steps) && mode.steps.length > 0, `${label}/${mode.id} needs at least one workflow step`);
      assert.ok(Array.isArray(mode.clarification), `${label}/${mode.id} clarification guidance must be an array`);
      for (const step of mode.steps) {
        assert.ok(["mcp", "host"].includes(step.type), `${label}/${mode.id} step type must be mcp or host`);
        assert.equal(typeof step.instruction, "string", `${label}/${mode.id} needs an executable instruction`);
        assert.equal(typeof step.readOnly, "boolean", `${label}/${mode.id} must classify read-only behavior`);
        assert.equal(typeof step.persistWhen, "string", `${label}/${mode.id} must classify persistence`);
        if (step.type === "host") {
          assert.equal(typeof step.capability, "string", `${label}/${mode.id} host step needs a capability`);
          assert.equal(step.tool, undefined, `${label}/${mode.id} host step must not impersonate an MCP call`);
          continue;
        }
        assert.ok(command.requiredTools.includes(step.tool), `${label}/${mode.id} uses undeclared tool ${step.tool}`);
        const schema = TOOL_INPUT_SCHEMAS.get(step.tool);
        assert.ok(schema, `${label}/${mode.id} references unknown tool ${step.tool}`);
        assert.ok(Array.isArray(step.required), `${label}/${mode.id}/${step.tool} required fields must be an array`);
        for (const field of step.required) {
          assert.ok(Object.hasOwn(schema.properties ?? {}, field), `${label}/${mode.id}/${step.tool} references unknown field ${field}`);
        }
      }
    }
    assert.deepEqual(command.callFlow.examples, command.ux.examples.map((example) => example.replace(/^\/dove:/u, "")), `${label} examples must map to the canonical workflow mode`);
  }

  const serialized = JSON.stringify(COMMAND_SURFACES);
  assert.match(JSON.stringify(COMMAND_SURFACE_BY_ID["dove.research"]), /status=absent.*ordinary project material.*Do not initialize|status=absent.*ordinary project material.*initialize/isu, "Research must branch from typed absence into host read-only exploration");
  for (const skill of ["source", "experiment", "draft", "figure", "rebuttal"]) {
    assert.match(JSON.stringify(COMMAND_SURFACE_BY_ID[`dove.${skill}`]), /"type":"host"/u, `${skill} must include substantive host work`);
  }
  assert.doesNotMatch(serialized, /directly (?:read|write).*\.dove/iu, "Skills must not directly access Dove state");
  assert.match(serialized, /Do not create Missions automatically/iu, "Skills must explicitly prohibit automatic Mission creation");

  const status = COMMAND_SURFACE_BY_ID["dove.status"];
  assert.equal(status.policy, "read-only", "Status must remain read-only");
  assert.deepEqual(status.requiredTools, ["query_dove_research"], "Status must remain a zero-write projection");

  const review = COMMAND_SURFACE_BY_ID["dove.review"];
  assert.equal(review.callFlow.status, "user-managed-exchange", "Review must remain a user-managed exchange");
  assert.deepEqual(review.callFlow.modes.map((mode) => mode.id), ["exchange"]);
  assert.match(JSON.stringify(review.callFlow), /local-preflight.*prepare.*separate reviewer session.*import.*coverage/isu, "Review must preserve the prepare, external return, import, and coverage sequence");
  assert.match(review.adapterNotes.join("\n"), /Never launch or impersonate a reviewer/iu, "Review guidance must preserve the independent-session boundary");

  const lessons = COMMAND_SURFACE_BY_ID["dove.lessons"];
  assert.deepEqual(lessons.requiredTools, ["manage_dove_lessons"], "Lessons must remain isolated from research work creation");
}

function assertToolInventory() {
  const names = toolDefinitions.map((tool) => tool.name);
  assert.deepEqual(names, EXPECTED_TOOL_NAMES, "Dove MCP must expose exactly the eight Research Format 1 tools");
  assertUnique(names, "MCP tool names");
  assert.deepEqual([...TOOL_INPUT_SCHEMAS.keys()], EXPECTED_TOOL_NAMES, "Exported tool schemas must match discovery order");

  for (const tool of toolDefinitions) {
    assert.equal(typeof tool.description, "string", `${tool.name} needs a description`);
    assert.ok(tool.description.length > 0, `${tool.name} description must not be empty`);
    assert.deepEqual(schemaShape(TOOL_INPUT_SCHEMAS.get(tool.name)), schemaShape(tool.inputSchema), `${tool.name} schema registry drifted from discovery`);
    assert.equal(tool.inputSchema.type, "object", `${tool.name} needs an object input schema`);
    assert.equal(tool.inputSchema.additionalProperties, false, `${tool.name} must reject unknown top-level fields`);
    assertUnique(tool.inputSchema.required ?? [], `${tool.name} required fields`);
    for (const field of tool.inputSchema.required ?? []) {
      assert.ok(Object.hasOwn(tool.inputSchema.properties ?? {}, field), `${tool.name} requires undefined field ${field}`);
    }
    const operations = tool.inputSchema.properties?.operation?.enum;
    if (operations !== undefined) assertUnique(operations, `${tool.name} operations`);
  }
}

function assertHostPolicy() {
  assert.deepEqual(HOST_ADAPTER_POLICY.toolAccess, {
    transport: "mcp-only",
    unavailable: "stop",
    cliFallback: false,
    shellFallback: false,
    directDoveStateAccess: false
  }, "Host tool access policy drifted");
  assert.deepEqual(HOST_ADAPTER_POLICY.publicChannels, {
    present: "human-text-and-structured-research-projection",
    preserveVerbatim: false
  }, "Host presentation policy drifted");
  assert.deepEqual(HOST_ADAPTER_POLICY.privacy, { exposePrivateProtocol: false }, "Host privacy policy drifted");
  assert.equal(HOST_ADAPTER_POLICY.language.default, "zh", "Host language default drifted");
  assert.equal(HOST_ADAPTER_POLICY.language.style, "natural-clear-flexible", "Host language style drifted");
  assert.ok(Array.isArray(HOST_ADAPTER_POLICY.language.capsule) && HOST_ADAPTER_POLICY.language.capsule.length === 4, "Host response capsule drifted");
  assert.match(HOST_ADAPTER_POLICY.language.capsule.join("\n"), /natural, clear Chinese.*internal terms.*fixed report template.*ordinary project materials/isu, "Host response capsule must preserve flexible public collaboration preferences");
  assert.ok(Array.isArray(HOST_ADAPTER_POLICY.adapterBullets), "Host policy needs canonical adapter bullets");
  assert.ok(HOST_ADAPTER_POLICY.adapterBullets.length > 0 && HOST_ADAPTER_POLICY.adapterBullets.length <= 3, "Host policy must stay thin");
  const policyText = HOST_ADAPTER_POLICY.adapterBullets.join("\n");
  assert.ok(Buffer.byteLength(policyText, "utf8") <= MAX_SHARED_POLICY_BYTES, `Host policy exceeds ${MAX_SHARED_POLICY_BYTES} bytes`);
  assert.match(policyText, /eight public Dove MCP research tools/iu, "Host policy must seal public tool access");
  assert.match(policyText, /semantic IDs.*do not create a Workspace or Mission merely because a Skill was invoked/isu, "Host policy must preserve zero-default work creation");
  assert.match(policyText, /bounded evidence.*completion.*scientific authority/isu, "Host policy must preserve evidence limits");
}

function assertGeneratedAdapters() {
  const entries = generatedAdapterEntries();
  const expectedCount = COMMAND_SURFACES.length * PROJECT_HOST_IDS.length;
  assert.equal(entries.length, expectedCount, "Every flat Skill must project to every supported host");
  assertUnique(entries.map((entry) => entry.relativePath), "Generated adapter paths");

  for (const hostId of PROJECT_HOST_IDS) {
    assert.equal(entries.filter((entry) => entry.hostId === hostId).length, COMMAND_SURFACES.length, `${hostId} must receive every flat Skill`);
  }

  let aggregateBytes = 0;
  for (const entry of entries) {
    const label = entry.relativePath;
    const bytes = Buffer.byteLength(entry.content, "utf8");
    aggregateBytes += bytes;
    assert.equal(entry.relativePath, adapterPathForCommand(entry.hostId, entry.command), `${label} path drifted`);
    assert.equal(entry.content, renderCommandAdapter(entry.hostId, entry.command), `${label} drifted from generated source`);
    assert.match(entry.content, /^---\n/um, `${label} needs frontmatter`);
    assert.ok(bytes <= MAX_ADAPTER_BYTES, `${label} exceeds the ${MAX_ADAPTER_BYTES}-byte thin-adapter budget`);
    for (const toolName of entry.command.requiredTools) {
      assert.match(entry.content, new RegExp(`\\b${toolName}\\b`, "u"), `${label} omits tool ${toolName}`);
    }
    for (const bullet of HOST_ADAPTER_POLICY.adapterBullets) {
      assert.match(entry.content, new RegExp(bullet.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), `${label} omits canonical host guidance`);
    }
    const responseCapsuleHits = HOST_ADAPTER_POLICY.language.capsule.filter((bullet) => entry.content.includes(bullet)).length;
    assert.equal(responseCapsuleHits, ["claude", "agents"].includes(entry.hostId) ? 0 : HOST_ADAPTER_POLICY.language.capsule.length, `${label} must receive the response capsule exactly through its host load path`);
    assert.doesNotMatch(entry.content, /(?:use|call|invoke|run|try|switch to|fall back to)(?:\s+the)?\s+(?:Bash|CLI|shell)/iu, `${label} offers a non-MCP fallback`);
  }
  assert.ok(aggregateBytes <= MAX_ADAPTER_BYTES * expectedCount, "Generated adapter prompts exceed the derived aggregate budget");

  if (!SOURCE_ONLY) {
    const drift = checkGeneratedAdapters(ROOT);
    assert.deepEqual(drift, [], `Generated adapter files drifted: ${drift.map((item) => `${item.relativePath} (${item.reason})`).join(", ")}`);
  }
  return { adapterCount: entries.length, adapterAggregateBytes: aggregateBytes };
}

function assertAmbientRouting() {
  const entries = generatedClaudeAmbientProjectEntries();
  assert.deepEqual(entries.map((entry) => entry.relativePath), EXPECTED_AMBIENT_PATHS, "Claude ambient source inventory drifted");
  assertUnique(entries.map((entry) => entry.relativePath), "Ambient source paths");

  let aggregateBytes = 0;
  for (const entry of entries) {
    const bytes = Buffer.byteLength(entry.content, "utf8");
    aggregateBytes += bytes;
    assert.ok(bytes <= MAX_AMBIENT_ENTRY_BYTES, `${entry.relativePath} exceeds the ${MAX_AMBIENT_ENTRY_BYTES}-byte prompt budget`);
  }
  assert.ok(aggregateBytes <= MAX_AMBIENT_AGGREGATE_BYTES, `Ambient prompts exceed the ${MAX_AMBIENT_AGGREGATE_BYTES}-byte aggregate budget`);

  const byPath = new Map(entries.map((entry) => [entry.relativePath, entry.content]));
  const rule = byPath.get(".claude/rules/dove.md");
  const intake = byPath.get(".claude/skills/dove-intake/SKILL.md");
  const lessons = byPath.get(".claude/skills/dove-lessons-intake/SKILL.md");
  const ordinary = `${rule}\n${intake}`;

  assert.match(rule, /natural, clear Chinese.*internal terms.*fixed report template.*ordinary project materials/isu, "Claude ambient rule must carry the canonical response capsule once");
  assert.doesNotMatch(`${intake}\n${lessons}`, /Unless the user requests another language|fixed report template/iu, "Claude hidden Skills must not duplicate the response capsule");
  assert.match(ordinary, /zero-write routing judgment|This routing is zero-write/iu, "Ambient work routing must be zero-write");
  assert.match(ordinary, /one (?:concise )?zero-write clarification round/iu, "Ambient work routing must allow only one clarification round");
  assert.match(ordinary, /smallest flat Skill/iu, "Ambient work routing must select the smallest flat Skill");
  assert.match(ordinary, /Do not create (?:an ambient )?Mission|Do not create a Mission/iu, "Ambient routing must not create work records by default");
  assert.match(ordinary, /continue (?:the original task|with normal host behavior)/iu, "Ambient routing must return to normal host work");
  assert.match(ordinary, /public Dove MCP research surfaces only when durable research state is actually needed/iu, "Ambient routing must use public research tools only when needed");
  assert.match(ordinary, /Do not use CLI, shell, or direct Dove state access as a fallback/iu, "Ambient routing must not escape through another transport");

  assert.match(lessons, /use only `manage_dove_lessons`|call `manage_dove_lessons`/iu, "Lessons intake must use only the Lessons tool");
  assert.match(lessons, /Do not create a Mission/iu, "Lessons intake must remain separate from work records");
  assert.match(lessons, /read request.*operation=read.*remember.*operation=replace.*reflection/isu, "Lessons intake must preserve read, replace, and reflection routing");

  return { ambientAggregateBytes: aggregateBytes };
}

function assertRuntimeCli() {
  assert.deepEqual(Object.keys(CLI_COMMAND_SPECS), Object.keys(EXPECTED_CLI), "CLI must expose only project setup and runtime integration commands");
  for (const [name, expected] of Object.entries(EXPECTED_CLI)) {
    const spec = CLI_COMMAND_SPECS[name];
    assert.deepEqual(spec.options.map((option) => option.name), expected.options, `${name} option inventory drifted`);
    assert.deepEqual(spec.positional, expected.positional, `${name} positional contract drifted`);
  }

  assert.deepEqual(parseDoveCli(["init", "--project", "/workspace", "--host", "claude", "--json"]), {
    command: "init",
    positionals: [],
    args: ["--project", "/workspace", "--host", "claude", "--json"]
  });
  assert.deepEqual(parseDoveCli(["mcp", "serve", "--project", "/workspace"]), {
    command: "mcp",
    positionals: ["serve"],
    args: ["--project", "/workspace"]
  });
  assert.deepEqual(parseDoveCli(["hook", "user-prompt-submit", "--project=/workspace"]), {
    command: "hook",
    positionals: ["user-prompt-submit"],
    args: ["--project", "/workspace"]
  });

  const binSource = fs.readFileSync(path.join(ROOT, "bin/dove.mjs"), "utf8");
  const knownCommandsMatch = binSource.match(/const KNOWN_COMMANDS = new Set\((\[[^\n]+\])\);/u);
  assert.ok(knownCommandsMatch, "Runtime entry must declare a sealed command set");
  assert.deepEqual(JSON.parse(knownCommandsMatch[1]), Object.keys(EXPECTED_CLI), "Runtime entry and parser command inventories drifted");
}

async function assertSourceBuilds() {
  const entryPoints = ["src/core/index.mjs", "bin/dove.mjs", "mcp/dove-state-server.mjs"];
  const inputPaths = new Set();
  for (const entryPoint of entryPoints) {
    const result = await build({
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
    for (const inputPath of Object.keys(result.metafile.inputs)) inputPaths.add(inputPath);
  }
  return inputPaths.size;
}

assertSkillManifest();
assertToolInventory();
assertHostPolicy();
const adapterResults = assertGeneratedAdapters();
const ambientResults = assertAmbientRouting();
assertRuntimeCli();
const publicSourceInputCount = await assertSourceBuilds();

console.log(JSON.stringify({
  status: "passed",
  sourceOnly: SOURCE_ONLY,
  skillCount: COMMAND_SURFACES.length,
  toolCount: toolDefinitions.length,
  hostCount: PROJECT_HOST_IDS.length,
  cliCommandCount: Object.keys(CLI_COMMAND_SPECS).length,
  ...adapterResults,
  ...ambientResults,
  publicSourceInputCount
}, null, 2));
