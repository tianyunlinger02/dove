#!/usr/bin/env node

import assert from "node:assert/strict";

import { toolDefinitions } from "../src/mcp/tool-definitions.mjs";

const EXPECTED = Object.freeze({
  query_dove_research: { readonly: ["overview", "diagnosis", "related-work", "hypotheses", "experiment-options", "result-synthesis", "claim-story", "branch-synthesis", "reviews"], mutating: [] },
  manage_dove_workspace: { readonly: [], mutating: ["initialize", "set-mainline"] },
  manage_dove_missions: { readonly: ["query"], mutating: ["create", "branch", "conclude"] },
  manage_dove_sources: { readonly: ["query"], mutating: ["record"] },
  manage_dove_experiments: { readonly: ["query"], mutating: ["freeze", "record-result"] },
  manage_dove_claims: { readonly: ["query"], mutating: ["record"] },
  manage_dove_reviews: { readonly: ["local-preflight", "prepare", "coverage"], mutating: ["import"] },
  manage_dove_lessons: { readonly: ["read"], mutating: ["replace"] }
});

const definitions = new Map();
for (const definition of toolDefinitions) {
  assert.equal(definitions.has(definition.name), false, `Duplicate MCP tool definition: ${definition.name}`);
  definitions.set(definition.name, definition);
}
assert.deepEqual([...definitions.keys()], Object.keys(EXPECTED), "Research Format 1 exposes an unexpected public tool inventory");

const classifications = [];
for (const [name, expected] of Object.entries(EXPECTED)) {
  const definition = definitions.get(name);
  const operations = definition.inputSchema.properties?.operation?.enum;
  assert.ok(Array.isArray(operations) && operations.length > 0, `${name} must declare an operation enum`);
  assert.deepEqual([...operations].sort(), [...expected.readonly, ...expected.mutating].sort(), `${name} operation inventory changed without classification`);
  const classified = [...expected.readonly.map((operation) => ({ name, operation, classification: "readonly" })), ...expected.mutating.map((operation) => ({ name, operation, classification: "mutating" }))];
  assert.equal(new Set(classified.map((entry) => entry.operation)).size, operations.length, `${name} operations must be classified exactly once`);
  classifications.push(...classified);
}

console.log(JSON.stringify({
  status: "passed",
  toolCount: definitions.size,
  operationCount: classifications.length,
  readonly: classifications.filter((entry) => entry.classification === "readonly"),
  mutating: classifications.filter((entry) => entry.classification === "mutating")
}, null, 2));
