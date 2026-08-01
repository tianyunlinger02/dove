import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { build } from "esbuild";

import { GOVERNANCE_EXEMPT_MUTATIONS, GOVERNANCE_GUARDED_MUTATIONS, GOVERNANCE_READONLY_COMMANDS } from "../src/core/schema.mjs";
import { CLI_COMMAND_SPECS } from "../src/cli/command-parser.mjs";
import {
  COMMAND_SURFACES,
  HOST_ADAPTER_POLICY,
  PROJECT_HOST_IDS,
  adapterPathForCommand
} from "../src/core/command-manifest.mjs";
import { COMMAND_OPERATIONS } from "../src/core/operation-registry.mjs";
import { TOOL_INPUT_SCHEMAS, TOOL_OPERATION_SCHEMAS, toolDefinitions } from "../src/mcp/tool-definitions.mjs";
import { checkGeneratedAdapters, checkGeneratedPrimaryRoles, generatedAdapterEntries, generatedClaudeAmbientProjectEntries, renderCommandAdapter } from "./generate-command-adapters.mjs";

const ROOT = process.cwd();
const SOURCE_ONLY = process.argv.includes("--source-only");
const MAX_ADAPTER_BYTES = 6000;
const MAX_ADAPTER_AGGREGATE_BYTES = 260000;
const MAX_AMBIENT_RULE_BYTES = 1800;
const MAX_AMBIENT_SKILL_BYTES = 2600;
const MAX_AMBIENT_AGGREGATE_BYTES = 6000;
const expectedCommandIds = ["dove.workspace", "dove.mission", "dove.status", "dove.lessons", "dove.source", "dove.note", "dove.experience", "dove.experiment", "dove.draft", "dove.figure", "dove.review", "dove.rebuttal"];
const retiredWorkspaceCommandId = "dove.init";
const retiredWorkspaceAdapterPaths = {
  opencode: ".opencode/commands/dove.init.md",
  codex: ".codex/skills/dove-init/SKILL.md",
  cursor: ".cursor/commands/dove-init.md",
  agents: ".agents/skills/dove-init/SKILL.md",
  claude: ".claude/commands/dove/init.md"
};
const removedCommandIds = [
  "dove.auto", "dove.operator", "dove.review-loop", "dove.orchestrate", "dove.plan", "dove.checklist", "dove.audit", "dove.autonomy-operate", "dove.return",
  "dove.version", "dove.follow-through", "dove.governance-audit", "dove.onboard", "dove.launch", "dove.approvals", "dove.kill", "dove.planner", "dove.builder", "dove.reviewer"
];
const forbiddenPublicModules = [
  "task-workflow.mjs", "navigation.mjs", "orchestration.mjs", "runtime-state.mjs", "task-packets.mjs", "internal-api.mjs", "runtime-authorization.mjs",
  "packet-step-result.mjs", "operator-ux.mjs", "pre-action-guidance.mjs", "legacy-governance.mjs", "legacy-governance-assertion.mjs", "legacy-source-trust.mjs",
  "review-proof.mjs", "program-operating-state.mjs", "mutation-guard.mjs", "workspace-bootstrap.mjs", "reviews.mjs", "review-scope.mjs", "isolated-review.mjs",
  "audio-review.mjs", "dove-review-loop.mjs", "review-exchange.mjs", "network-search.mjs"
];
const generatedBundles = ["dist/index.mjs", "bin/dove-package.mjs", "mcp/dove-state-server-package.mjs", "scripts/doctor-mcp-probe-package.mjs", "scripts/dove-user-prompt-submit-package.mjs"];
const retiredCallableTokens = [
  "runDoveAuto", "runDoveOperator", "runDoveReviewLoop", "run_dove_auto", "run_dove_operator", "run_dove_review_loop", "query_dove_mission_board",
  "queryCampaigns", "planCampaign", "runAutonomyOnce", "runAutonomyForeground", "runAutonomyOperate", "materializeGuidancePacket", "persistOperatorFollowThrough", "upsertNote", "createVersionSnapshot", "compareVersions", "searchNetwork", "queryNetworkSearchProviders"
];
const retiredCliFields = ["--packet-id", "--task-packet-id", "--mission-packet-id", "--target", "--domain", "--stage", "--status", "--role", "--policy-override"];
const retiredSchema18MissionFields = ["--snapshot-summary", "--requirement-json", "--assumption-json", "--decision-json", "--work-item-json", "--alignment-json", "--change-from-json", "--node-update-json", "--target-artifact", "--expected-artifact", "--decision-revision", "--consumed-receipt-id"];
const currentSchema18MissionFields = ["--operation", "--mission-number", "--mode", "--goal", "--requirement", "--assumption", "--scope", "--out-of-scope", "--artifact-json", "--completion-criterion", "--evidence-requirement", "--depends-on-mission-number", "--requested-disposition", "--synthesis", "--hypothesis-json", "--route-json", "--open-question-json", "--evidence-ref", "--reason-code", "--next-action-json"];
const retiredExperimentFields = ["--audit-json", "--claim-id", "--bridge-reason"];
const retiredDraftFields = ["--metadata-only"];
const runtimeSourcePaths = [
  ...fs.readdirSync(path.join(ROOT, "src/core")).filter((name) => name.endsWith(".mjs")).map((name) => `src/core/${name}`),
  ...fs.readdirSync(path.join(ROOT, "src/mcp")).filter((name) => name.endsWith(".mjs")).map((name) => `src/mcp/${name}`),
  "bin/dove.mjs", "mcp/dove-state-server.mjs"
];
const forbiddenAdapterRouting = /(?:ask (?:the operator |the user )?(?:for|to)|wait for|approve or cancel|approval (?:before|required)|confirmation (?:before|required)|terminal checkpoint|resume (?:the )?(?:original|same) request|(?:if|when|on) (?:it )?(?:fails?|failed|errors?)|retry (?:it|the call)|closure (?:state|policy)|next-action routing)/iu;
const forbiddenAmbientRouting = /(?:when it says|if (?:the )?(?:disposition|classification)|terminal.*stop|resume.*same turn|outcome.*retry|decision table)/iu;
const forbiddenRawStrategyOrSchemaDump = /(?:"(?:status|selectors|generatedFields|modes|channels)"\s*:|\b(?:status strategy|selector strategy|host-generated business labels)\s*:|\b(?:oneOf|anyOf|additionalProperties|requiredOutcomeFields)\b.{0,80}\b(?:schema|properties|required|type)\b|\bJSON Schema\b|\bschema dump\b)/isu;
const forbiddenInternalProtocolLeakage = /(?:\b(?:decisionRevision|workspaceAlignmentDigest|proposalDigest|proposalToken|confirmArgs|contractDigest|sourceTreeDigest|mutationMode|MutationContext|ledgerSequence|exactReplay)\b|\b(?:operation registry|routing table|decision table|closure state|retry policy|internal protocol|private protocol)\b)/iu;
const repeatedBoilerplatePatterns = Object.freeze([
  /Use the listed public Dove MCP tools/gu,
  /Present only the human `report`/gu,
  /Respond concisely in Chinese by default/gu
]);
const MAX_SHARED_CAPSULE_BYTES = 500;
const SURFACE_PRIVACY_RULES = Object.freeze({
  manifest: Object.freeze([
    /\.dove(?:\/|\b)/iu,
    /\b(?:mission|action|decision|envelope)(?:Id| ID)\b/iu,
    /\b(?:digest|hash|sha256|schema(?:\s+version)?|format(?:\s+version)?|exact replay|mutation(?:Mode|-mode)|authority|issuer|canonical handoff)\b/iu
  ]),
  adapter: Object.freeze([
    /\.dove(?:\/|\b)/iu,
    /\b(?:mission|action|decision|envelope)(?:Id| ID)\b/iu,
    /\b(?:digest|hash|sha256|schema(?:\s+version)?|format(?:\s+version)?|exact replay|mutation(?:Mode|-mode)|authority|issuer|canonical handoff)\b/iu,
    /\b(?:missionGoal|nodeQuestion|displayIndex)\b/u
  ]),
  role: Object.freeze([
    /\.dove(?:\/|\b)/iu,
    /\b(?:mission|action|decision|envelope)(?:Id| ID)\b/iu,
    /\b(?:digest|hash|sha256|schema(?:\s+version)?|format(?:\s+version)?|exact replay|replay|ledger|mutation(?:Mode|-mode)|authority|issuer|canonical handoff)\b/iu
  ]),
  agents: Object.freeze([
    /\.dove(?:\/|\b)/iu,
    /\b(?:mission|action|decision|envelope)(?:Id| ID)\b/iu,
    /\b(?:digest|hash|sha256|schema(?:\s+version)?|format(?:\s+version)?|exact replay|replay|ledger|mutation(?:Mode|-mode)|authority|issuer|canonical handoff)\b/iu
  ]),
  toolDescription: Object.freeze([
    /\.dove(?:\/|\b)/iu,
    /\b(?:private|internal)\s+(?:mission|action|decision|envelope|identity|binding|data)\b/iu,
    /\b(?:mission|action|decision|envelope)(?:Id| ID)\b/iu,
    /\b(?:digest|hash-bound|sha256|current-schema|schema(?:\s+version)?|format(?:\s+version)?|exact replay|trusted issuer|Reviewer authority|canonical handoff)\b/iu
  ])
});
const requiredStatusAdapterWording = /Return `report\.briefing` verbatim as the whole answer.*including every heading and line break.*Do not answer from another envelope field/isu;
const requiredWorkspaceExplorationWording = /query_dove_status.*host read-only exploration.*current project.*overall situation and structure.*Do not produce evidence or risk lists.*do not ask questions.*manage_dove_workspace.*operation=set-mainline.*projectBrief.*clean concise research mainline like a paper title.*Apply it immediately.*absent Workspace is initialized.*current Workspace is replaced.*revision history remains preserved/isu;

function assertSurfacePrivacy(label, text, surface) {
  for (const rule of SURFACE_PRIVACY_RULES[surface]) {
    assert.doesNotMatch(text, rule, `${label} exposes model-facing private protocol wording (${rule})`);
  }
}

function assertPromptHygiene(label, text) {
  assert.doesNotMatch(text, forbiddenRawStrategyOrSchemaDump, `${label} dumps a raw strategy or schema instead of task guidance`);
  assert.doesNotMatch(text, forbiddenInternalProtocolLeakage, `${label} exposes internal protocol vocabulary`);
}

function assertNoRepeatedBoilerplate(label, text) {
  for (const pattern of repeatedBoilerplatePatterns) {
    assert.ok([...text.matchAll(pattern)].length <= 1, `${label} repeats canonical boilerplate (${pattern})`);
  }
}

function schemaShape(schema) {
  return {
    type: schema?.type ?? null,
    required: [...(schema?.required ?? [])].sort(),
    properties: Object.keys(schema?.properties ?? {}).sort(),
    additionalProperties: schema?.additionalProperties
  };
}

function operationValue(instruction) {
  const match = instruction.match(/\boperation=([a-z][a-z0-9-]*)\b/u);
  return match?.[1] ?? null;
}

function callRequiredFieldsReachSchema(toolName, fields, instruction) {
  const schema = TOOL_INPUT_SCHEMAS.get(toolName);
  if (!schema) return false;
  const properties = new Set(Object.keys(schema.properties ?? {}));
  if (!fields.every((field) => properties.has(field))) return false;
  const branches = TOOL_OPERATION_SCHEMAS.get(toolName);
  if (!branches) return (schema.required ?? []).every((field) => fields.includes(field));
  const selectedOperation = operationValue(instruction);
  if (!selectedOperation || !fields.includes("operation")) return false;
  const branch = branches.find((candidate) => candidate.properties?.operation?.const === selectedOperation);
  return Boolean(branch) && (branch.required ?? []).every((field) => fields.includes(field));
}

for (const moduleName of forbiddenPublicModules) {
  assert.equal(fs.existsSync(path.join(ROOT, "src/core", moduleName)), false, `Retired core module still exists: ${moduleName}`);
}
for (const relativePath of runtimeSourcePaths) {
  const content = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  for (const token of retiredCallableTokens) assert.doesNotMatch(content, new RegExp(`\\b${token}\\b`, "u"), `${relativePath} contains retired callable ${token}`);
}

const drift = checkGeneratedAdapters(ROOT);
if (!SOURCE_ONLY) assert.deepEqual(drift, [], `Unexpected generated command adapter drift: ${drift.map((item) => `${item.relativePath} (${item.reason})`).join(", ")}`);
const roleDrift = checkGeneratedPrimaryRoles(ROOT);
assert.deepEqual(roleDrift, [], `Unexpected generated primary role drift: ${roleDrift.map((item) => `${item.relativePath} (${item.reason})`).join(", ")}`);
assert.deepEqual(COMMAND_SURFACES.map((command) => command.id), expectedCommandIds, "Public commands must stay flat and sealed");
assert.equal(COMMAND_SURFACES.length, 12, "Public workflow inventory must remain exactly 12");
assert.equal(PROJECT_HOST_IDS.length, 5, "Project host inventory must remain exactly five");
assert.equal(HOST_ADAPTER_POLICY.toolAccess?.transport, "mcp-only", "Adapters must use the MCP transport");
assert.equal(HOST_ADAPTER_POLICY.toolAccess?.unavailable, "stop", "Adapters must stop when MCP is unavailable");
for (const field of ["cliFallback", "shellFallback", "directDoveStateAccess"]) {
  assert.equal(HOST_ADAPTER_POLICY.toolAccess?.[field], false, `Adapters must disable ${field}`);
}
assert.equal(HOST_ADAPTER_POLICY.publicChannels?.preserveVerbatim, true, "Adapters must preserve the human report");
assert.match(String(HOST_ADAPTER_POLICY.publicChannels?.present), /report/iu, "Presentation must be report-based");
assert.match(String(HOST_ADAPTER_POLICY.publicChannels?.researchHandoff), /consume/iu, "Research handoff must remain machine-consumed");
assert.match(String(HOST_ADAPTER_POLICY.publicChannels?.hostControl), /without-rendering|machine/iu, "Host control must remain machine-only");
assert.equal(HOST_ADAPTER_POLICY.privacy?.exposePrivateProtocol, false, "Private protocol must remain hidden");
assert.equal(HOST_ADAPTER_POLICY.language?.default, "zh", "Chinese must remain the default response language");
assert.match(String(HOST_ADAPTER_POLICY.language?.style), /concise/iu, "The public response style must remain concise");
assert.ok(Array.isArray(HOST_ADAPTER_POLICY.adapterBullets), "Canonical host policy must provide adapter guidance");
assert.ok(HOST_ADAPTER_POLICY.adapterBullets.length <= 3, "Canonical host policy must stay concise");
assert.ok(Buffer.byteLength(HOST_ADAPTER_POLICY.adapterBullets.join("\n"), "utf8") <= MAX_SHARED_CAPSULE_BYTES, `Canonical host policy exceeds the ${MAX_SHARED_CAPSULE_BYTES}-byte shared capsule budget`);
assertSurfacePrivacy("canonical host adapter policy", JSON.stringify({
  publicChannels: HOST_ADAPTER_POLICY.publicChannels,
  privacy: HOST_ADAPTER_POLICY.privacy,
  language: HOST_ADAPTER_POLICY.language,
  adapterBullets: HOST_ADAPTER_POLICY.adapterBullets
}), "manifest");
const hostPolicyProjection = renderCommandAdapter("opencode", { id: "dove.policy-probe", title: "Policy probe", summary: "Probe canonical host policy projection.", requiredTools: ["query_dove_status"], adapterNotes: [], ux: { dailyFlow: ["Probe the renderer."], examples: [] } });
for (const semantic of [
  /MCP.*unavailable.*(?:stop|re-enter)|(?:stop|re-enter).*MCP.*unavailable/isu,
  /human `report`.*machine channels.*internal/isu,
  /typed closure.*once.*binding unchanged/isu,
  /(?:CLI|shell|direct state).*access/isu,
  /concisely in Chinese by default/isu
]) assert.match(hostPolicyProjection, semantic, `Canonical host projection is missing ${semantic}`);
assertPromptHygiene("canonical host projection", hostPolicyProjection);

const registryByCommand = new Map(COMMAND_OPERATIONS.map((operation) => [operation.commandId, operation]));
assert.deepEqual([...registryByCommand.keys()], expectedCommandIds, "Command manifest and operation registry command ids must match exactly");
const toolDefinitionByName = new Map(toolDefinitions.map((tool) => [tool.name, tool]));
assert.deepEqual([...toolDefinitionByName.keys()].sort(), [...TOOL_INPUT_SCHEMAS.keys()].sort(), "Tool definitions and exported input schema registry must have exact name parity");
for (const [toolName, definition] of toolDefinitionByName) {
  assert.deepEqual(schemaShape(TOOL_INPUT_SCHEMAS.get(toolName)), schemaShape(definition.inputSchema), `${toolName} input schema registry drifted from its tool definition`);
}

const guardedCommandIds = new Set(GOVERNANCE_GUARDED_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []));
const readonlyCommandIds = new Set(GOVERNANCE_READONLY_COMMANDS);
const classified = new Set([...guardedCommandIds, ...GOVERNANCE_EXEMPT_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []), ...readonlyCommandIds]);
for (const command of COMMAND_SURFACES) {
  const operation = registryByCommand.get(command.id);
  assert.ok(operation, `${command.id} lacks an operation registry entry`);
  assert.deepEqual(command.requiredTools, operation.tools, `${command.id} manifest tools drifted from the operation registry`);
  assert.equal(command.operationId, operation.id, `${command.id} manifest operation id drifted from the operation registry`);
  assert.equal(Object.hasOwn(command, "adapterConstraints"), false, `${command.id} still exposes broad adapterConstraints`);
  assert.ok(Array.isArray(command.adapterNotes), `${command.id} adapterNotes must be an array`);
  assert.ok(command.adapterNotes.length <= 2, `${command.id} has too many adapterNotes`);
  assert.ok(command.constraints.length > command.adapterNotes.length, `${command.id} must retain full business constraints separately from adapter notes`);
  assert.ok(command.callFlow && typeof command.callFlow === "object", `${command.id} lacks canonical executable call flow metadata`);
  assert.ok(Array.isArray(command.callFlow.modes) && command.callFlow.modes.length > 0, `${command.id} call flow requires at least one mode`);
  assert.equal(typeof command.callFlow.status, "string", `${command.id} call flow requires a status strategy`);
  assert.equal(typeof command.callFlow.selectors?.mission, "string", `${command.id} call flow requires a mission selector strategy`);
  assert.equal(typeof command.callFlow.selectors?.research, "string", `${command.id} call flow requires a research selector strategy`);
  const flowTools = new Set();
  const flowModes = new Set();
  for (const flowMode of command.callFlow.modes) {
    assert.equal(typeof flowMode.id, "string", `${command.id} call flow mode requires an id`);
    assert.equal(flowModes.has(flowMode.id), false, `${command.id} duplicates call flow mode ${flowMode.id}`);
    flowModes.add(flowMode.id);
    assert.ok(Array.isArray(flowMode.steps) && flowMode.steps.length > 0, `${command.id}/${flowMode.id} requires at least one tool step`);
    for (const call of flowMode.steps) {
      flowTools.add(call.tool);
      assert.ok(toolDefinitionByName.has(call.tool), `${command.id}/${flowMode.id} references missing MCP tool ${call.tool}`);
      assert.ok(command.requiredTools.includes(call.tool), `${command.id}/${flowMode.id} tool ${call.tool} is absent from canonical command tools`);
      assert.ok(Array.isArray(call.required), `${command.id}/${flowMode.id}/${call.tool} required fields must be an array`);
      assert.equal(typeof call.instruction, "string", `${command.id}/${flowMode.id}/${call.tool} requires an instruction`);
      assert.equal(callRequiredFieldsReachSchema(call.tool, call.required, call.instruction), true, `${command.id}/${flowMode.id}/${call.tool} required fields and explicit operation cannot satisfy the canonical MCP branch`);
    }
  }
  assert.deepEqual([...flowTools].sort(), [...new Set(command.requiredTools)].sort(), `${command.id} call flow and operation tools must match exactly`);
  assert.ok(Array.isArray(command.callFlow.examples), `${command.id} call flow examples must be an array`);
  assert.equal(command.callFlow.examples.length, command.ux.examples.length, `${command.id} examples must map one-to-one to canonical modes`);
  for (const exampleMode of command.callFlow.examples) assert.equal(flowModes.has(exampleMode), true, `${command.id} example maps to unreachable mode ${exampleMode}`);
  if (command.requiredTools.some((tool) => Object.hasOwn(TOOL_INPUT_SCHEMAS.get(tool)?.properties ?? {}, "missionNumber")) && !["dove.status", "dove.workspace"].includes(command.id)) {
    assert.notEqual(command.callFlow.selectors.mission, "none", `${command.id} must define a public mission selector strategy`);
  }
  const publicSurfaceText = JSON.stringify({
    summary: command.summary,
    constraints: command.constraints,
    adapterNotes: command.adapterNotes,
    callFlow: command.callFlow,
    ux: command.ux
  });
  assertSurfacePrivacy(`${command.id} public command wording`, publicSurfaceText, "manifest");
  assert.equal(classified.has(command.id), true, `${command.id} lacks governance classification`);
  if (command.id === "dove.lessons") {
    assert.equal(guardedCommandIds.has(command.id), true, "dove.lessons record must be guarded");
    assert.equal(readonlyCommandIds.has(command.id), false, "mixed dove.lessons surface must not be classified wholly read-only");
  }
  for (const toolName of command.requiredTools) {
    assert.ok(toolDefinitionByName.has(toolName), `${command.id} references missing MCP tool ${toolName}`);
  }
}

assert.equal(COMMAND_SURFACES.find((command) => command.id === "dove.experiment")?.title, "Dove experiment", "dove.experiment public title must use experiment semantics");
const generated = generatedAdapterEntries();
assert.equal(generated.length, 60, "Generated adapter inventory must remain exactly 60");
const adapterAggregateBytes = generated.reduce((total, entry) => total + Buffer.byteLength(entry.content, "utf8"), 0);
assert.ok(adapterAggregateBytes <= MAX_ADAPTER_AGGREGATE_BYTES, `Generated adapters exceed the ${MAX_ADAPTER_AGGREGATE_BYTES}-byte aggregate prompt budget`);
assert.deepEqual(generated.filter((entry) => entry.command.id === "dove.workspace").map((entry) => entry.relativePath), [
  ".opencode/commands/dove.workspace.md",
  ".codex/skills/dove-workspace/SKILL.md",
  ".cursor/commands/dove-workspace.md",
  ".agents/skills/dove-workspace/SKILL.md",
  ".claude/commands/dove/workspace.md"
], "dove.workspace adapter paths drifted");
for (const entry of generated) {
  assert.match(entry.content, /^---\n/um, `${entry.relativePath} lacks frontmatter`);
  assert.ok(Buffer.byteLength(entry.content, "utf8") <= MAX_ADAPTER_BYTES, `${entry.relativePath} exceeds the ${MAX_ADAPTER_BYTES}-byte thin-adapter budget`);
  const canonicalProjection = renderCommandAdapter(entry.hostId, entry.command);
  assert.equal(entry.content, canonicalProjection, `${entry.relativePath} drifted from the canonical manifest and host policy projection`);
  assert.match(entry.content, /human `report`/iu, `${entry.relativePath} does not identify the human report channel`);
  assert.match(entry.content, /machine channels.*internal/isu, `${entry.relativePath} does not keep machine channels internal`);
  assert.match(entry.content, /concisely in Chinese by default/isu, `${entry.relativePath} lacks concise Chinese-default reporting`);
  for (const toolName of entry.command.requiredTools) assert.match(entry.content, new RegExp(`\\b${toolName}\\b`, "u"), `${entry.relativePath} omits required MCP tool ${toolName}`);
  assert.doesNotMatch(entry.content, /node\s+\.\/bin\/dove(?:-package)?\.mjs|--json\b|(?:use|call|invoke|run|try|switch to|fall back to)(?:\s+the)?\s+(?:Bash|CLI|shell)(?:\s+fallback)?/iu, `${entry.relativePath} instructs a CLI or shell fallback`);
  assertSurfacePrivacy(entry.relativePath, entry.content, "adapter");
  assertPromptHygiene(entry.relativePath, entry.content);
  assertNoRepeatedBoilerplate(entry.relativePath, entry.content);
  const shellWithoutHostControlLine = entry.content.split("\n").filter((line) => !/Follow `hostControl\.presentation`.*never render `hostControl`/iu.test(line)).join("\n");
  const routingRules = shellWithoutHostControlLine.split("## Rules")[1] ?? "";
  assert.doesNotMatch(routingRules, forbiddenAdapterRouting, `${entry.relativePath} reimplements code-owned routing`);
  if (entry.command.id === "dove.status") assert.match(entry.content, requiredStatusAdapterWording, `${entry.relativePath} may compress the code-rendered status briefing`);
  if (entry.command.id === "dove.workspace") {
    assert.deepEqual(entry.command.requiredTools, ["query_dove_status", "manage_dove_workspace"], `${entry.relativePath} must expose both Workspace classification and explicit management tools`);
    assert.match(entry.content, requiredWorkspaceExplorationWording, `${entry.relativePath} must inspect, formulate, and directly write the current project mainline`);
    assert.match(entry.content, /Do not show.*elicitation.*confirmation|do not ask questions/isu, `${entry.relativePath} must not ask before ordinary Workspace replacement`);
    assert.doesNotMatch(entry.content, /supporting evidence|key unknowns|accept, edit, or exit|keep it, revise it, or exit/iu, `${entry.relativePath} must not restore the retired evidence-and-choice UX`);
    assert.doesNotMatch(entry.content, /project goal|项目总目标|optional distinct research mainline/iu, `${entry.relativePath} must expose one Workspace mainline concept`);
  }
}

const ambientEntries = generatedClaudeAmbientProjectEntries();
assert.deepEqual(ambientEntries.map((entry) => entry.relativePath), [".claude/rules/dove.md", ".claude/skills/dove-intake/SKILL.md", ".claude/skills/dove-lessons-intake/SKILL.md"]);
const ambientByPath = new Map(ambientEntries.map((entry) => [entry.relativePath, entry.content]));
const ambientRule = ambientByPath.get(".claude/rules/dove.md");
const ambientSkill = ambientByPath.get(".claude/skills/dove-intake/SKILL.md");
const lessonsSkill = ambientByPath.get(".claude/skills/dove-lessons-intake/SKILL.md");
assert.ok(Buffer.byteLength(ambientRule, "utf8") <= MAX_AMBIENT_RULE_BYTES, `Ambient rule exceeds the ${MAX_AMBIENT_RULE_BYTES}-byte budget`);
assert.ok(Buffer.byteLength(ambientSkill, "utf8") <= MAX_AMBIENT_SKILL_BYTES, `Ambient skill exceeds the ${MAX_AMBIENT_SKILL_BYTES}-byte budget`);
assert.ok(Buffer.byteLength(lessonsSkill, "utf8") <= MAX_AMBIENT_SKILL_BYTES, `Lessons ambient skill exceeds the ${MAX_AMBIENT_SKILL_BYTES}-byte budget`);
const ambientText = ambientEntries.map((entry) => entry.content).join("\n");
assert.ok(Buffer.byteLength(ambientText, "utf8") <= MAX_AMBIENT_AGGREGATE_BYTES, `Ambient prompts exceed the ${MAX_AMBIENT_AGGREGATE_BYTES}-byte aggregate budget`);
for (const [label, text] of [["ambient rule", ambientRule], ["ambient skill", ambientSkill], ["Lessons ambient skill", lessonsSkill]]) {
  assertPromptHygiene(label, text);
  assertNoRepeatedBoilerplate(label, text);
  assert.doesNotMatch(text, forbiddenAmbientRouting, `${label} must not restate a disposition decision table`);
}
for (const capability of [
  /(?:high-confidence|conservative).*(?:new work|new task)|(?:new work|new task).*(?:high-confidence|conservative)/isu,
  /(?:one|single).*(?:zero-write )?clarification/isu,
  /create_ambient_dove_mission/iu,
  /(?:resume|continue).*original (?:request|task)/isu,
  /closureRequest.*exactly once.*boundArgs/isu
]) assert.match(ambientText, capability, `Ambient prompts are missing capability ${capability}`);
assert.match(ambientText, /(?:direct (?:Dove )?state|\.dove).*(?:public tools|host integration|never|must not)|(?:public tools|host integration|never|must not).*(?:direct (?:Dove )?state|\.dove)/isu);
assert.match(ambientText, /(?:public Dove (?:MCP )?(?:tools|surfaces)).*(?:CLI|shell)|(?:CLI|shell).*(?:public Dove (?:MCP )?(?:tools|surfaces))/isu);
assert.match(ambientText, /(?:hostControl|researchHandoff).*(?:machine channels|out of user-facing output)|(?:machine channels|out of user-facing output).*(?:hostControl|researchHandoff)/isu);
assert.match(ambientSkill, /artifact:<path>.*validation:<path>/isu, "Ambient skill must show the concise evidenceRequirements item formats");

const openCodeSkillRoot = path.join(ROOT, ".opencode", "skills");
const installedRoleSkillPaths = fs.readdirSync(openCodeSkillRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("dove-"))
  .map((entry) => `.opencode/skills/${entry.name}/SKILL.md`)
  .sort();
assert.deepEqual(installedRoleSkillPaths, [".opencode/skills/dove-builder/SKILL.md", ".opencode/skills/dove-planner/SKILL.md", ".opencode/skills/dove-reviewer/SKILL.md"]);
for (const relativePath of installedRoleSkillPaths) {
  const content = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  assert.doesNotMatch(content, /\b(?:board|route|queue|lease|continuation|review loop|automatic subagent)\b/iu, `${relativePath} references retired orchestration state`);
  assertSurfacePrivacy(relativePath, content, "role");
}
const plannerSkill = fs.readFileSync(path.join(ROOT, ".opencode/skills/dove-planner/SKILL.md"), "utf8");
assert.match(plannerSkill, /goal.*scope.*dependencies.*evidence.*completion/isu, "Planner must own goals, scope, dependencies, evidence, and completion conditions");
assert.doesNotMatch(plannerSkill, /exact|receipt|ownership|lineage|ledger/iu, "Planner must not teach execution or replay internals");
const builderSkill = fs.readFileSync(path.join(ROOT, ".opencode/skills/dove-builder/SKILL.md"), "utf8");
assert.match(builderSkill, /research.*code.*writing.*experiment.*figure.*revision.*rebuttal/isu, "Builder must own substantive author-side work including rebuttal");
const reviewerSkill = fs.readFileSync(path.join(ROOT, ".opencode/skills/dove-reviewer/SKILL.md"), "utf8");
assert.match(reviewerSkill, /frozen declared scope/iu, "Reviewer must assess only the frozen declared scope");
assert.match(reviewerSkill, /findings only/iu, "Reviewer must return findings only");
assert.match(reviewerSkill, /(?:leave|does not own|must not|do not).*(?:execution|rewriting|rebuttal|scheduling)|(?:execution|rewriting|rebuttal|scheduling).*(?:Builder\/Author|outside|not own)/iu, "Reviewer must stay out of execution and author-side revision");
assert.doesNotMatch(reviewerSkill, /own.*rebuttal|develop.*rebuttal strateg|coordinate execution|launch (?:a )?(?:reviewer|subagent|process)/iu, "Reviewer must not schedule execution or join rebuttal strategy");
for (const [label, text] of [["planner role", plannerSkill], ["builder role", builderSkill], ["reviewer role", reviewerSkill]]) assertPromptHygiene(label, text);
const claudeReviewerAgent = fs.readFileSync(path.join(ROOT, ".claude/agents/dove-reviewer.md"), "utf8");
assert.match(claudeReviewerAgent, /^---\nname: dove-reviewer\n[\s\S]*\ntools: Read\n---/u, "Claude Reviewer must expose only Read");
assert.match(claudeReviewerAgent, /declared paths.*do not inspect directories.*undeclared files/isu, "Claude Reviewer must stay within the declared content boundary");
assert.match(claudeReviewerAgent, /Do not edit files or invoke Dove tools/iu, "Claude Reviewer must be read-only and Dove-free");
const openCodeReviewerAgent = fs.readFileSync(path.join(ROOT, ".opencode/agents/dove-reviewer.md"), "utf8");
for (const denied of ["write", "edit", "bash", "glob", "grep", "task", "skill"]) assert.match(openCodeReviewerAgent, new RegExp(`\\n  ${denied}: deny`, "u"), `OpenCode Reviewer must deny ${denied}`);
assert.match(openCodeReviewerAgent, /mode: subagent/iu, "OpenCode Reviewer must be a dedicated subagent");
const trellisInjector = fs.readFileSync(path.join(ROOT, ".claude/hooks/inject-subagent-context.py"), "utf8");
assert.doesNotMatch(trellisInjector.match(/AGENTS_ALL\s*=\s*\([^\n]+\)/u)?.[0] ?? "", /dove-reviewer/u, "Trellis injector must ignore Dove Reviewer");
const ralphLoop = fs.readFileSync(path.join(ROOT, ".claude/hooks/ralph-loop.py"), "utf8");
assert.match(ralphLoop, /TARGET_AGENT\s*=\s*["']check["']/u, "Ralph loop must remain check-only");
assert.doesNotMatch(ralphLoop.match(/TARGET_AGENT\s*=\s*[^\n]+/u)?.[0] ?? "", /dove-reviewer/u, "Ralph loop must ignore Dove Reviewer");
const agentsText = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
assertSurfacePrivacy("AGENTS.md", agentsText, "agents");
assert.match(agentsText, /public Dove (?:surfaces|commands and MCP tools)/iu);
assert.match(agentsText, /substantive progress/iu);
assert.match(agentsText, /Chinese by default/iu);
assert.match(agentsText, /host-native search|native search/iu);
assert.match(agentsText, /direct Dove state.*host integration|host integration.*direct Dove state/iu);
assert.match(agentsText, /CLI access.*host integration|host integration.*CLI access/iu);

for (const tool of toolDefinitions) assertSurfacePrivacy(`${tool.name} description`, tool.description, "toolDescription");
const toolDescriptions = Object.fromEntries(toolDefinitions.map((tool) => [tool.name, tool.description]));
assert.match(toolDescriptions.manage_dove_mission, /exact one-based mission number from query_dove_status/iu);
assert.match(toolDescriptions.manage_dove_mission, /explicit mode.*research.*(?:understanding|experiments|evidence|paper claims).*ordinary.*(?:code|documentation|configuration|cleanup|bounded deliverable)/iu);
assert.match(toolDescriptions.create_ambient_dove_mission, /explicit mode.*research.*(?:understanding|experiments|evidence|paper claims).*ordinary.*(?:code|documentation|configuration|cleanup|bounded deliverable)/iu);
assert.match(toolDescriptions.query_dove_status, /current missions.*requirements.*research.*outputs.*evidence.*missionNumber.*details/iu);
assert.match(toolDescriptions.close_host_outcome, /explicitly identified attempt.*ordinary work.*substantive files.*execution facts.*completion criteria.*retry/iu);
assert.match(toolDescriptions.record_research_outcome, /research execution attempt.*single immutable receipt.*decision remains unchanged.*later consume.*reevaluation/iu);
assert.match(toolDescriptions.record_dove_experiment, /formal experiment protocol.*immutable result.*measurements.*denominator.*failures.*limitations.*does not run experiments/iu);
assert.match(toolDescriptions.manage_dove_review, /scope.*without writing.*dedicated native fresh read-only Reviewer.*does not establish.*(?:identity|sign-off|acceptance)/iu);
assert.match(toolDescriptions.record_dove_rebuttal, /archive.*project rebuttal.*preserved current findings.*no claim of reviewer agreement/iu);

for (const removed of removedCommandIds) {
  assert.equal(classified.has(removed), false, `${removed} remains governance-reachable`);
  for (const hostId of PROJECT_HOST_IDS) assert.equal(fs.existsSync(path.join(ROOT, adapterPathForCommand(hostId, removed))), false, `${removed} adapter was not deleted for ${hostId}`);
}
assert.equal(classified.has(retiredWorkspaceCommandId), false, `${retiredWorkspaceCommandId} remains governance-reachable`);
for (const hostId of PROJECT_HOST_IDS) {
  assert.equal(fs.existsSync(path.join(ROOT, retiredWorkspaceAdapterPaths[hostId])), false, `${retiredWorkspaceCommandId} adapter was not deleted for ${hostId}`);
}
for (const commandName of ["source", "experiment", "draft", "figure", "review", "rebuttal"]) {
  const spec = CLI_COMMAND_SPECS[commandName];
  assert.ok(spec, `Missing CLI command ${commandName}`);
  const optionNames = new Set(spec.options.map((option) => option.name));
  assert.equal(optionNames.has("--mission-number"), true, `${commandName} must expose the public mission-number selector`);
  assert.equal(optionNames.has("--mission-id"), false, `${commandName} must not expose a private mission-id selector`);
  for (const retired of retiredCliFields) {
    if (commandName === "review" && retired === "--status") continue;
    assert.equal(optionNames.has(retired), false, `${commandName} exposes retired option ${retired}`);
  }
}
const lessonCliOptions = new Set(CLI_COMMAND_SPECS.lessons.options.map((option) => option.name));
assert.deepEqual([...lessonCliOptions].filter((name) => !["--json", "--format", "--language"].includes(name)).sort(), ["--binding", "--markdown", "--mutation-mode", "--project"]);
for (const removedCli of ["install", "auto", "operator", "review-loop", "receipt"]) assert.equal(Object.hasOwn(CLI_COMMAND_SPECS, removedCli), false, `Removed CLI command remains: ${removedCli}`);
assert.deepEqual(Object.keys(CLI_COMMAND_SPECS), ["init", "sync", "doctor", "workspace", "mcp", "hook", "mission", "status", "lessons", "source", "experiment", "draft", "figure", "review", "rebuttal"], "CLI command inventory drifted");
for (const commandName of ["mission", "status", "lessons", "source", "experiment", "draft", "figure", "review", "rebuttal"]) {
  assert.equal(new Set(CLI_COMMAND_SPECS[commandName].options.map((option) => option.name)).has("--project"), true, `${commandName} must expose --project`);
}
const statusOptionNames = new Set(CLI_COMMAND_SPECS.status.options.map((option) => option.name));
assert.deepEqual([...statusOptionNames].filter((name) => !["--json", "--format", "--help", "-h"].includes(name)).sort(), ["--detail", "--language", "--mission-number", "--project"]);
const missionOptionNames = new Set(CLI_COMMAND_SPECS.mission.options.map((option) => option.name));
for (const field of currentSchema18MissionFields) assert.equal(missionOptionNames.has(field), true, `mission must expose current Schema 18 field ${field}`);
for (const field of retiredSchema18MissionFields) assert.equal(missionOptionNames.has(field), false, `mission must not expose retired field ${field}`);
const experimentOptionNames = new Set(CLI_COMMAND_SPECS.experiment.options.map((option) => option.name));
for (const field of ["--protocol-json", "--result-json"]) assert.equal(experimentOptionNames.has(field), true, `experiment must expose ${field}`);
for (const field of retiredExperimentFields) assert.equal(experimentOptionNames.has(field), false, `experiment must not expose retired field ${field}`);
const draftOptionNames = new Set(CLI_COMMAND_SPECS.draft.options.map((option) => option.name));
for (const field of retiredDraftFields) assert.equal(draftOptionNames.has(field), false, `draft must not expose retired field ${field}`);
const draftSurface = COMMAND_SURFACES.find((command) => command.id === "dove.draft");
assert.deepEqual(draftSurface.requiredTools, ["query_dove_status", "manage_dove_mission", "record_dove_draft"], "dove.draft must use the canonical project-artifact archive tool across new and revision lifecycles");
assert.deepEqual(draftSurface.callFlow.modes.map((mode) => mode.id), ["new", "revision"], "dove.draft must distinguish a new Skill episode from exact-Mission revision continuation");
const lessonOptionNames = new Set(CLI_COMMAND_SPECS.lessons.options.map((option) => option.name));
assert.equal(lessonOptionNames.has("--confirmed"), false, "lessons must not expose prompt-owned confirmation fields");
assert.equal(lessonOptionNames.has("--confirm"), false, "lessons must not expose a confirm alias");

const bundle = await build({ absWorkingDir: ROOT, entryPoints: ["src/core/index.mjs"], bundle: true, write: false, platform: "node", format: "esm", external: ["node:*"], metafile: true, logLevel: "silent" });
const publicInputs = Object.keys(bundle.metafile.inputs);
for (const forbidden of forbiddenPublicModules) assert.equal(publicInputs.some((item) => item.endsWith(`/src/core/${forbidden}`) || item === `src/core/${forbidden}`), false, `Public package entry imports ${forbidden}`);
for (const entryPoint of ["bin/dove.mjs", "mcp/dove-state-server.mjs"]) {
  const entryBundle = await build({ absWorkingDir: ROOT, entryPoints: [entryPoint], bundle: true, write: false, platform: "node", format: "esm", external: ["node:*"], metafile: true, logLevel: "silent" });
  const entryInputs = Object.keys(entryBundle.metafile.inputs);
  for (const forbidden of forbiddenPublicModules) assert.equal(entryInputs.some((item) => item.endsWith(`/src/core/${forbidden}`) || item === `src/core/${forbidden}`), false, `${entryPoint} imports ${forbidden}`);
}
if (!SOURCE_ONLY) {
  for (const bundlePath of generatedBundles) {
    const content = fs.readFileSync(path.join(ROOT, bundlePath), "utf8");
    for (const forbidden of forbiddenPublicModules) assert.doesNotMatch(content, new RegExp(forbidden.replaceAll(".", "\\."), "u"), `${bundlePath} contains retired module ${forbidden}`);
    for (const token of retiredCallableTokens) assert.doesNotMatch(content, new RegExp(`\\b${token}\\b`, "u"), `${bundlePath} contains retired callable ${token}`);
  }
}

console.log(JSON.stringify({ status: "passed", commandCount: COMMAND_SURFACES.length, adapterCount: generated.length, maxAdapterBytes: MAX_ADAPTER_BYTES, adapterAggregateBytes, maxAdapterAggregateBytes: MAX_ADAPTER_AGGREGATE_BYTES, maxAmbientAggregateBytes: MAX_AMBIENT_AGGREGATE_BYTES, publicModuleCount: publicInputs.length }, null, 2));
