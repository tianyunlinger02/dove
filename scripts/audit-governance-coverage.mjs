import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GOVERNANCE_EXEMPT_MUTATIONS, GOVERNANCE_GUARDED_MUTATIONS } from "../src/core/schema.mjs";

const ROOT = process.cwd();

const coreFiles = [
  "src/core/artifacts.mjs",
  "src/core/evidence.mjs",
  "src/core/reviews.mjs",
  "src/core/isolated-review.mjs",
  "src/core/figure-workflow.mjs",
  "src/core/orchestration.mjs",
  "src/core/navigation.mjs",
  "src/core/runtime.mjs",
  "src/core/dove.mjs"
];

const WRITE_SIGNAL_REGEX = /(?:writeJson|writeText|appendText|saveState|refreshDurableSurfaces|materializeGuidancePacket)\(|(?:fs(?:\.promises)?|fsPromises)\.(?:writeFile|appendFile|rm|cp|copyFile|mkdir|rename|writeFileSync|appendFileSync|rmSync|cpSync|copyFileSync|mkdirSync|renameSync)\(/;
const EXEMPT_FUNCTIONS = new Set([
  "queryMetaOptimize",
  "recordOperatorFollowThrough"
]);

function collectExportedFunctions(filePath) {
  const content = fs.readFileSync(path.join(ROOT, filePath), "utf8");
  const exportRegex = /export\s+(?:(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>\s*\{|const\s+(\w+)\s*=\s*(?:async\s+)?function\s*\([^)]*\)\s*\{)/g;
  const matches = [...content.matchAll(exportRegex)];
  return matches.map((match, index) => {
    const name = match[1] ?? match[2] ?? match[3];
    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? content.length) : content.length;
    const body = content.slice(start, end);
    return { filePath, name, body };
  });
}

const exports = coreFiles.flatMap(collectExportedFunctions);
const mutatingCoreFunctions = exports
  .filter((entry) => WRITE_SIGNAL_REGEX.test(entry.body))
  .map((entry) => entry.name)
  .filter((name) => !name.startsWith("read") && !name.startsWith("query") && !name.startsWith("list"));

const guarded = new Set(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.surfaceBindings.coreFunction));
const exempt = new Set(GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => entry.surfaceBindings.coreFunction));

const uncovered = mutatingCoreFunctions.filter((name) => !guarded.has(name) && !exempt.has(name) && !EXEMPT_FUNCTIONS.has(name));

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
assert.equal(invalidExemptMetadata.length, 0, `Invalid exempt governance metadata: ${invalidExemptMetadata.join(", ")}`);

console.log(JSON.stringify({
  mutatingCoreFunctions,
  guarded: [...guarded],
  exempt: [...exempt],
  uncovered,
  invalidExemptMetadata
}, null, 2));
