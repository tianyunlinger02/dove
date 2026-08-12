import test from "node:test";
import assert from "node:assert/strict";

import { generatedAdapterEntries, generatedWriteSummary } from "../../scripts/generate-command-adapters.mjs";
import { PROJECT_HOST_IDS } from "../../src/core/command-manifest.mjs";
import { USER_RESPONSE_POLICY } from "../../src/core/user-response-policy.mjs";

test("generated adapter write summary reports actual written paths without inferred state", () => {
  const summary = generatedWriteSummary(
    { writtenPaths: ["first.md"], cleanupWarnings: [], omittedCleanupWarningCount: 0 },
    { writtenPaths: ["second.md"], cleanupWarnings: [], omittedCleanupWarningCount: 0 }
  );
  assert.deepEqual(summary, { written: ["first.md", "second.md"] });
});

test("generated adapter write summary bounds combined cleanup warnings", () => {
  const firstWarnings = Array.from({ length: 15 }, (_, index) => ({ path: `first-${index}`, reason: "cleanup failed" }));
  const secondWarnings = Array.from({ length: 10 }, (_, index) => ({ path: `second-${index}`, reason: "cleanup failed" }));
  const summary = generatedWriteSummary(
    { writtenPaths: ["first.md"], cleanupWarnings: firstWarnings, omittedCleanupWarningCount: 2 },
    { writtenPaths: ["second.md"], cleanupWarnings: secondWarnings, omittedCleanupWarningCount: 3 }
  );
  assert.deepEqual(summary.cleanupWarnings, [...firstWarnings, ...secondWarnings.slice(0, 5)]);
  assert.equal(summary.omittedCleanupWarningCount, 10);
});

test("Status adapters read the research overview without writes or database calls", () => {
  const entries = generatedAdapterEntries().filter((entry) => entry.command.id === "dove.status");
  assert.deepEqual(entries.map((entry) => entry.hostId), PROJECT_HOST_IDS);
  for (const entry of entries) {
    assert.match(entry.content, /\.dove\/research\/RESEARCH\.md/u);
    assert.match(entry.content, /If the overview is absent.*say so naturally/isu);
    assert.match(entry.content, /No file write is required/u);
    assert.doesNotMatch(entry.content, /query_dove|manage_dove|MCP tool|semantic ID/iu);
  }
});

test("all host adapters use human research documents and end with the response policy", () => {
  const entries = generatedAdapterEntries();
  const ending = `## Response policy\n\n${USER_RESPONSE_POLICY.map((bullet) => `- ${bullet}`).join("\n")}`;
  for (const entry of entries) {
    assert.match(entry.content, /## Internal workflow\n\nInternal guidance only; never use this workflow as the final report outline\./u);
    assert.match(entry.content, /researcher-owned documents, not a database/iu);
    assert.equal(entry.content.trimEnd().endsWith(ending), true, entry.relativePath);
    for (const bullet of USER_RESPONSE_POLICY) assert.equal(entry.content.split(bullet).length - 1, 1, entry.relativePath);
  }
});
