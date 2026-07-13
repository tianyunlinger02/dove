import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GOVERNANCE_EXEMPT_MUTATIONS, GOVERNANCE_GUARDED_MUTATIONS, GOVERNANCE_READONLY_TOOLS } from "../src/core/schema.mjs";
import { toolDefinitions } from "../src/mcp/tool-definitions.mjs";

const ROOT = process.cwd();

function discoverCoreFiles(directory = path.join(ROOT, "src/core")) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return discoverCoreFiles(fullPath);
      }
      if (!entry.isFile() || !entry.name.endsWith(".mjs")) {
        return [];
      }
      return [path.relative(ROOT, fullPath)];
    })
    .sort();
}

const coreFiles = discoverCoreFiles();

const WRITE_SIGNAL_REGEX = /(?:writeJson|writeText|appendText|saveState|refreshDurableSurfaces|materializeGuidancePacket|materializeDoveTask|updateTaskLifecycle|persistAutoResult|persistOperatorFollowThrough)\(|(?:fs(?:\.promises)?|fsPromises)\.(?:writeFile|appendFile|rm|cp|copyFile|mkdir|rename|writeFileSync|appendFileSync|rmSync|cpSync|copyFileSync|mkdirSync|renameSync)\(/;
const EXEMPT_FUNCTIONS = new Set([
  "appendText",
  "applyPacketStepResult",
  "recordReviewProofRequiredBoundary",
  "discoverPaperArtifacts",
  "ensureDir",
  "saveRuntimeArtifacts",
  "saveState",
  "updatePacketLifecycle",
  "writeJson",
  "writeText"
]);

function collectExportedFunctions(filePath) {
  const content = fs.readFileSync(path.join(ROOT, filePath), "utf8");
  const exportRegex = /export\s+(?:(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>\s*\{|const\s+(\w+)\s*=\s*(?:async\s+)?function\s*\([^)]*\)\s*\{|class\s+(\w+)\s*\{)/g;
  const matches = [...content.matchAll(exportRegex)];
  return matches.flatMap((match, index) => {
    if (match[4]) {
      return [];
    }
    const name = match[1] ?? match[2] ?? match[3];
    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? content.length) : content.length;
    const body = content.slice(start, end);
    return [{ filePath, name, body }];
  });
}

const exports = coreFiles.flatMap(collectExportedFunctions);
const mutatingCoreFunctions = exports
  .filter((entry) => WRITE_SIGNAL_REGEX.test(entry.body))
  .map((entry) => entry.name)
  .filter((name) => !name.startsWith("read") && !name.startsWith("query") && !name.startsWith("list"));

const guarded = new Set(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.surfaceBindings.coreFunction));
const exempt = new Set(GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => entry.surfaceBindings.coreFunction));
const exportedCoreFunctionNames = new Set(exports.map((entry) => entry.name));

function collectToolBindings(entries, classification) {
  return entries.flatMap((entry) => {
    const mcpTool = entry.surfaceBindings?.mcpTool;
    return mcpTool ? [{ name: mcpTool, classification, entryId: entry.id }] : [];
  });
}

const toolBindings = [
  ...collectToolBindings(GOVERNANCE_GUARDED_MUTATIONS, "guarded"),
  ...collectToolBindings(GOVERNANCE_EXEMPT_MUTATIONS, "exempt"),
  ...GOVERNANCE_READONLY_TOOLS.map((name) => ({ name, classification: "readonly", entryId: name }))
];
const toolClassifications = new Map();
for (const binding of toolBindings) {
  const current = toolClassifications.get(binding.name) ?? [];
  current.push(binding);
  toolClassifications.set(binding.name, current);
}
const definedToolNames = new Set(toolDefinitions.map((tool) => tool.name));
const duplicateToolDefinitions = toolDefinitions
  .map((tool) => tool.name)
  .filter((name, index, names) => names.indexOf(name) !== index);
const duplicateMutationToolBindings = [...toolClassifications.entries()]
  .filter(([, bindings]) => bindings.filter((binding) => binding.classification !== "readonly").length > 1)
  .map(([name, bindings]) => `${name}:${bindings.map((binding) => `${binding.classification}/${binding.entryId}`).join(",")}`);
const invalidToolClassifications = toolDefinitions.flatMap((tool) => {
  const bindings = toolClassifications.get(tool.name) ?? [];
  return bindings.length === 1
    ? []
    : [`${tool.name}:${bindings.length === 0 ? "unclassified" : bindings.map((binding) => `${binding.classification}/${binding.entryId}`).join(",")}`];
});
const staleToolBindings = [...toolClassifications.keys()].filter((name) => !definedToolNames.has(name));

const uncovered = mutatingCoreFunctions.filter((name) => !guarded.has(name) && !exempt.has(name) && !EXEMPT_FUNCTIONS.has(name));
const staleRegistryBindings = [
  ...GOVERNANCE_GUARDED_MUTATIONS,
  ...GOVERNANCE_EXEMPT_MUTATIONS
].filter((entry) => {
  const coreFunction = entry.surfaceBindings?.coreFunction;
  return coreFunction && !exportedCoreFunctionNames.has(coreFunction);
}).map((entry) => `${entry.id}:${entry.surfaceBindings.coreFunction}`);

const now = Date.now();
const VALID_REVIEW_CADENCES = new Set(["per-session", "per-change", "per-release", "per-project"]);

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

const invalidExemptMetadata = GOVERNANCE_EXEMPT_MUTATIONS.filter((entry) => {
  if (!entry.ownerRole || !entry.approvedByRole || !entry.reasonCode || !VALID_REVIEW_CADENCES.has(entry.reviewCadence)) {
    return true;
  }
  if (!validTimestamp(entry.approvedAt) || !validTimestamp(entry.lastReviewedAt) || !validTimestamp(entry.sunsetAt)) {
    return true;
  }
  if (Date.parse(entry.approvedAt) > Date.parse(entry.lastReviewedAt)) {
    return true;
  }
  return Date.parse(entry.sunsetAt) <= now;
}).map((entry) => entry.id);

assert.equal(uncovered.length, 0, `Uncovered mutating core functions: ${uncovered.join(", ")}`);
assert.equal(staleRegistryBindings.length, 0, `Governance registry references non-exported core functions: ${staleRegistryBindings.join(", ")}`);
assert.equal(invalidExemptMetadata.length, 0, `Invalid exempt governance metadata: ${invalidExemptMetadata.join(", ")}`);
assert.equal(duplicateToolDefinitions.length, 0, `Duplicate MCP tool definitions: ${duplicateToolDefinitions.join(", ")}`);
assert.equal(duplicateMutationToolBindings.length, 0, `Duplicate governance mutation MCP bindings: ${duplicateMutationToolBindings.join(", ")}`);
assert.equal(invalidToolClassifications.length, 0, `Every MCP tool must have exactly one governance classification: ${invalidToolClassifications.join(", ")}`);
assert.equal(staleToolBindings.length, 0, `Governance classifications reference undefined MCP tools: ${staleToolBindings.join(", ")}`);

console.log(JSON.stringify({
  mutatingCoreFunctions,
  guarded: [...guarded],
  exempt: [...exempt],
  uncovered,
  staleRegistryBindings,
  invalidExemptMetadata,
  duplicateToolDefinitions,
  duplicateMutationToolBindings,
  invalidToolClassifications,
  staleToolBindings
}, null, 2));
