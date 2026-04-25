import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GOVERNANCE_EXEMPT_MUTATIONS, GOVERNANCE_GUARDED_MUTATIONS } from "../src/core/schema.mjs";

const ROOT = process.cwd();

const coreFiles = [
  "src/core/artifacts.mjs",
  "src/core/evidence.mjs",
  "src/core/reviews.mjs",
  "src/core/orchestration.mjs",
  "src/core/navigation.mjs",
  "src/core/runtime.mjs"
];

const WRITE_SIGNAL_REGEX = /(writeJson|writeText|appendText|saveState|refreshDurableSurfaces)\(/;
const EXEMPT_FUNCTIONS = new Set([
  "queryMetaOptimize",
  "recordOperatorFollowThrough"
]);

function collectExportedFunctions(filePath) {
  const content = fs.readFileSync(path.join(ROOT, filePath), "utf8");
  const matches = [...content.matchAll(/export function\s+(\w+)\s*\([^)]*\)\s*\{/g)];
  return matches.map((match, index) => {
    const name = match[1];
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

const now = new Date().toISOString();
function cadenceWindowMs(cadence) {
  switch (cadence) {
    case "per-session": return 36 * 60 * 60 * 1000;
    case "per-change": return 7 * 24 * 60 * 60 * 1000;
    case "per-release": return 90 * 24 * 60 * 60 * 1000;
    case "per-project": return 365 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}
const invalidExemptMetadata = GOVERNANCE_EXEMPT_MUTATIONS.filter((entry) => {
  if (!entry.ownerRole || !entry.approvedByRole || !entry.approvedAt || !entry.lastReviewedAt || !entry.reasonCode || !entry.reviewCadence || !entry.sunsetAt || entry.sunsetAt <= now) {
    return true;
  }
  if (Date.parse(entry.approvedAt) > Date.parse(entry.lastReviewedAt)) {
    return true;
  }
  const reviewWindowMs = cadenceWindowMs(entry.reviewCadence);
  if (reviewWindowMs <= 0) {
    return true;
  }
  return Date.parse(entry.lastReviewedAt) < Date.now() - reviewWindowMs;
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
