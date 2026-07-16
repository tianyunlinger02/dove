// scripts/doctor-mcp-probe.mjs
import assert2 from "node:assert/strict";
import path from "node:path";
import process from "node:process";

// scripts/mcp-stdio-client.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
var CALL_TIMEOUT_MS = 15e3;
function createMcpStdioClient({ args, cwd, command = "node", timeoutMs = CALL_TIMEOUT_MS }) {
  const server = spawn(command, args, {
    cwd,
    stdio: ["pipe", "pipe", "inherit"]
  });
  let buffer = Buffer.alloc(0);
  let nextId = 1;
  const pending = /* @__PURE__ */ new Map();
  function sendMessage(message) {
    const body = JSON.stringify(message);
    server.stdin.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r
\r
${body}`);
  }
  function call2(method, params = {}, label = null) {
    const id = nextId++;
    const callLabel = label ?? (method === "tools/call" && params?.name ? `${method}:${params.name}` : method);
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        server.kill();
        reject(new Error(`MCP call timed out after ${timeoutMs}ms: ${callLabel}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer, method, label: callLabel });
    });
    sendMessage({ jsonrpc: "2.0", id, method, params });
    return promise;
  }
  function notify2(method, params = {}) {
    sendMessage({ jsonrpc: "2.0", method, params });
  }
  function parseMessages() {
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }
      const headerText = buffer.slice(0, headerEnd).toString("utf8");
      const match = headerText.match(/Content-Length:\s*(\d+)/i);
      assert.ok(match, "Missing Content-Length header from MCP server");
      const length = Number(match[1]);
      const totalLength = headerEnd + 4 + length;
      if (buffer.length < totalLength) {
        return;
      }
      const body = buffer.slice(headerEnd + 4, totalLength).toString("utf8");
      buffer = buffer.slice(totalLength);
      const message = JSON.parse(body);
      const waiter = pending.get(message.id);
      if (!waiter) {
        continue;
      }
      pending.delete(message.id);
      clearTimeout(waiter.timer);
      if (message.error) {
        waiter.reject(new Error(`${waiter.label}: ${message.error.message}`));
      } else {
        waiter.resolve(message.result);
      }
    }
  }
  server.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    parseMessages();
  });
  server.on("exit", (code) => {
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(`MCP server exited early during ${waiter.label} with code ${code}`));
    }
    pending.clear();
  });
  return {
    call: call2,
    notify: notify2,
    kill: () => server.kill(),
    server
  };
}

// src/mcp/tool-definitions.mjs
var resultModeProperty = { type: "string", enum: ["compact", "full", "debug"] };
var mutationModeProperty = { type: "string", enum: ["patch-plan", "direct-process"] };
var safeId = { type: "string", pattern: "^[a-z0-9][a-z0-9._-]{0,127}$" };
var strings = { type: "array", items: { type: "string", minLength: 1 } };
var lessonScopes = { type: "string", enum: ["global", "mission"] };
var lessonKinds = { type: "string", enum: ["preference", "constraint", "method", "failure", "review-insight"] };
var lessonRecordProps = {
  missionId: safeId,
  lessonId: safeId,
  scope: lessonScopes,
  kind: lessonKinds,
  summary: { type: "string", minLength: 1 },
  details: { type: "string", minLength: 1 },
  nextTimeGuidance: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
  sourceIds: { type: "array", items: safeId },
  noteIds: { type: "array", items: safeId },
  artifactRefs: strings,
  appliesToArtifactRefs: strings,
  tags: strings,
  supersedesLessonId: safeId,
  confirmed: { type: "boolean" },
  proposalVersion: { type: "number", enum: [1] },
  proposalWorkspace: { type: "string", minLength: 1 },
  proposalDigest: { type: "string", pattern: "^[0-9a-f]{64}$" },
  proposalToken: { type: "string", pattern: "^[A-Za-z0-9_-]+$" },
  workspaceId: safeId,
  contractDigest: { type: "string", pattern: "^[0-9a-f]{64}$" },
  createdAt: { type: "string", minLength: 1 }
};
var missionReplayProps = {
  missionId: safeId,
  goal: { type: "string", minLength: 1 },
  scope: strings,
  outOfScope: strings,
  targetArtifacts: strings,
  expectedArtifacts: strings,
  completionCriteria: strings,
  evidenceRequirements: strings,
  dependsOnMissionIds: { type: "array", items: safeId },
  supersedesMissionId: safeId,
  confirmed: { type: "boolean" },
  proposalVersion: { type: "number", enum: [1] },
  proposalWorkspace: { type: "string" },
  proposalDigest: { type: "string", pattern: "^[0-9a-f]{64}$" },
  workspaceId: safeId,
  createdAt: { type: "string" },
  mutationMode: mutationModeProperty
};
var receiptArtifactSchema = { type: "object", properties: { path: { type: "string" }, kind: { type: "string" }, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" } }, required: ["path", "kind", "sha256"], additionalProperties: false };
var receiptValidationSchema = { type: "object", properties: { kind: { type: "string" }, reference: { type: "string" }, outputHash: { type: "string", pattern: "^[0-9a-f]{64}$" } }, required: ["kind", "reference", "outputHash"], additionalProperties: false };
var receiptCriterionSchema = { type: "object", properties: { criterionId: { type: "string" }, evidenceRefs: strings }, required: ["criterionId", "evidenceRefs"], additionalProperties: false };
var initSourceIdentitySchema = {
  type: ["object", "null"],
  properties: {
    kind: { type: "string", enum: ["directory"] },
    device: { type: "string", minLength: 1 },
    inode: { type: "string", minLength: 1 },
    mode: { type: "number" },
    ctimeNs: { type: "string", minLength: 1 },
    mtimeNs: { type: "string", minLength: 1 }
  },
  required: ["kind", "device", "inode", "mode", "ctimeNs", "mtimeNs"],
  additionalProperties: false
};
function mutationTool(name, description, properties, required = []) {
  return { name, description, inputSchema: { type: "object", properties: { ...properties, mutationMode: mutationModeProperty, resultMode: resultModeProperty }, required, additionalProperties: false } };
}
function queryTool(name, description, properties, required = []) {
  return { name, description, inputSchema: { type: "object", properties: { ...properties, resultMode: resultModeProperty }, required, additionalProperties: false } };
}
var baseToolDefinitions = [
  mutationTool("init_dove_goal", "Propose and exactly confirm schema 7 workspace initialization.", { goal: { type: "string", minLength: 1 }, archiveReset: { type: "boolean" }, confirmed: { type: "boolean" }, proposalVersion: { type: "number", enum: [1] }, proposalWorkspace: { type: "string" }, proposalDigest: { type: "string", pattern: "^[0-9a-f]{64}$" }, workspaceId: safeId, createdAt: { type: "string" }, detectedState: { type: "string" }, detectedSchema: { type: "string" }, sourceIdentity: initSourceIdentitySchema, sourceTreeDigest: { type: ["string", "null"] }, archiveTarget: { type: ["string", "null"] } }, ["goal"]),
  mutationTool("create_dove_mission", "Persist one minimal schema 7 mission after exact confirmation.", missionReplayProps, ["goal"]),
  queryTool("query_dove_mission", "Preview one minimal schema 7 mission contract.", { missionId: safeId, goal: { type: "string", minLength: 1 }, scope: strings, outOfScope: strings, targetArtifacts: strings, expectedArtifacts: strings, completionCriteria: strings, evidenceRequirements: strings, dependsOnMissionIds: { type: "array", items: safeId }, supersedesMissionId: safeId }, ["goal"]),
  queryTool("query_dove_status", "Read minimal mission, receipt, source, evidence, review, and domain integrity without writes.", { intent: { type: "string" }, detail: { type: "string" }, view: { type: "string" }, full: { type: "boolean" }, includeDetails: { type: "boolean" }, showMissions: { type: "boolean" }, includeMissionDetails: { type: "boolean" } }),
  mutationTool("ingest_execution_receipt", "Ingest an immutable hash-bound execution receipt.", { receiptId: safeId, missionId: safeId, contractDigest: { type: "string", pattern: "^[0-9a-f]{64}$" }, summary: { type: "string", minLength: 1 }, artifacts: { type: "array", minItems: 1, items: receiptArtifactSchema }, validations: { type: "array", items: receiptValidationSchema }, criteriaSatisfied: { type: "array", items: receiptCriterionSchema }, producedAt: { type: "string", minLength: 1 } }, ["receiptId", "missionId", "contractDigest", "summary", "artifacts", "validations", "criteriaSatisfied", "producedAt"]),
  queryTool("assess_mission_completion", "Reassess mission completion from current evidence and review authority.", { missionId: safeId }, ["missionId"]),
  queryTool("search_network", "Search public candidate material without writing state.", { query: { type: "string", minLength: 1 }, kind: { type: "string", enum: ["scholarly", "web", "all"] }, limit: { type: "number" }, year: { type: ["string", "number"] }, domains: strings, fieldsOfStudy: strings, openAccessOnly: { type: "boolean" }, providerIds: strings, providers: strings, locale: { type: "string" } }, ["query"]),
  queryTool("query_network_search_providers", "Inspect read-only public search provider availability.", { kind: { type: "string", enum: ["scholarly", "web", "all"] }, providerIds: strings, providers: strings }),
  queryTool("query_sources", "Query mission-bound source candidates and current eligibility.", { missionId: safeId, sourceId: safeId, lifecycle: { type: "string", enum: ["candidate", "verified", "rejected"] }, limit: { type: "number" } }, ["missionId"]),
  queryTool("query_dove_lessons", "Query explicit advisory lessons without writes, repair, refresh, automatic capture, automatic recall, transcript ingestion, or Trellis/runtime integration.", { lessonId: safeId, missionId: safeId, scope: lessonScopes, kind: lessonKinds, tags: strings, artifactRefs: strings, includeSuperseded: { type: "boolean" }, includeUnscoped: { type: "boolean" }, limit: { type: "number" } }),
  mutationTool("record_dove_lesson", "Propose one mission-provenanced advisory lesson with zero writes and record it only by exact confirmed replay inside a MutationContext; global scope changes applicability, not provenance.", lessonRecordProps, ["missionId", "lessonId", "scope", "kind", "summary", "nextTimeGuidance", "sourceIds", "noteIds", "artifactRefs", "appliesToArtifactRefs", "tags"]),
  mutationTool("register_source", "Register one mission-bound source candidate. Registration never verifies it.", { missionId: safeId, sourceId: safeId, citationKey: { type: "string" }, title: { type: "string" }, authors: strings, year: { type: ["string", "number"] }, locator: { type: "string" }, sourceType: { type: "string" }, abstract: { type: "string" }, origin: { type: "string" }, capturePath: { type: "string" } }, ["missionId", "sourceId"]),
  mutationTool("verify_source", "Record a mission-bound source rejection. Public positive verification is unavailable.", { missionId: safeId, sourceId: safeId, method: { type: "string", minLength: 1 }, checkedMaterial: { type: "string", minLength: 1 }, auditEvidence: { type: "array", minItems: 1, items: { type: "object", properties: { reference: { type: "string", minLength: 1 }, kind: { type: "string", minLength: 1 }, observation: { type: "string", minLength: 1 } }, required: ["reference", "kind", "observation"], additionalProperties: false } } }, ["missionId", "sourceId", "method", "checkedMaterial", "auditEvidence"]),
  mutationTool("upsert_note", "Record substantive mission-bound synthesis from verified sources or current artifacts.", { missionId: safeId, noteId: safeId, title: { type: "string" }, summary: { type: "string" }, quotes: strings, claims: strings, openQuestions: strings, sourceIds: { type: "array", items: safeId }, artifactRefs: strings }, ["missionId", "noteId"]),
  mutationTool("upsert_claims", "Record mission-bound evidence-backed claims.", { missionId: safeId, claims: { type: "array", minItems: 1, items: { type: "object", properties: { claimId: safeId, text: { type: "string", minLength: 1 }, sourceIds: { type: "array", items: safeId }, noteIds: { type: "array", items: safeId }, artifactRefs: strings, experimentResultIds: { type: "array", items: safeId }, gap: { type: "string" } }, required: ["claimId", "text"], additionalProperties: false } } }, ["missionId", "claims"]),
  mutationTool("run_experience_workflow", "Record experiment protocol, result evidence, audit, and optional claim bridge without scheduling execution.", { missionId: safeId, experimentId: safeId, title: { type: "string" }, goal: { type: "string", minLength: 1 }, hypothesis: { type: "string", minLength: 1 }, protocol: { type: "string", minLength: 1 }, successCriteria: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } }, comparisonTargets: strings, result: { type: "string" }, resultEvidenceRefs: strings, auditFindings: strings, integrityFlags: strings, claimId: safeId, bridgeReason: { type: "string" } }, ["missionId", "experimentId", "goal", "hypothesis", "protocol", "successCriteria"]),
  mutationTool("upsert_draft", "Write a real mission-bound draft body with evidence lineage.", { missionId: safeId, draftId: safeId, title: { type: "string" }, body: { type: "string", minLength: 1 }, summary: { type: "string" }, evidenceRefs: strings, artifactRefs: strings }, ["missionId", "draftId", "body"]),
  mutationTool("upsert_draft_metadata", "Write explicit metadata for an existing mission-bound draft.", { missionId: safeId, draftId: safeId, title: { type: "string" }, summary: { type: "string" }, evidenceRefs: strings, artifactRefs: strings }, ["missionId", "draftId"]),
  mutationTool("run_figure_workflow", "Prepare mission-bound figure materials and prompt, or import host-produced output with caption, provenance, QA, and final hash.", { missionId: safeId, figureId: safeId, intent: { type: "string", minLength: 1 }, purpose: { type: "string", minLength: 1 }, materials: { type: "array", minItems: 1, items: { type: "string" } }, prompt: { type: "string", minLength: 1 }, outputPath: { type: "string" }, outputSha256: { type: "string", pattern: "^[0-9a-f]{64}$" }, caption: { type: "string" }, qaFindings: strings }, ["missionId", "figureId", "intent", "purpose", "materials", "prompt"]),
  mutationTool("prepare_review_exchange", "Preflight or prepare one schema 7 policy-scoped mission review exchange without launching a reviewer.", { missionId: safeId, policy: { type: "string", enum: ["local-preflight", "isolated-selected-artifacts", "final-plan-results-only", "external"] }, artifactPaths: strings, finalPlanPaths: strings, finalResultPaths: strings }, ["missionId", "policy"]),
  mutationTool("import_review_exchange", "Import one canonical hash-bound schema 7 handoff and report as non-authoritative mission artifacts.", { missionId: safeId, exchangeId: safeId, reviewId: safeId }, ["missionId", "exchangeId", "reviewId"]),
  queryTool("verify_review_coverage", "Verify current exact artifact review coverage while Reviewer authority remains fail closed without a trusted issuer.", { missionId: safeId, artifactPaths: strings, requireAuthoritative: { type: "boolean" } }, ["missionId"]),
  mutationTool("normalize_rebuttal_issues", "Normalize author-side reviewer issues with finding and evidence lineage.", { missionId: safeId, issues: { type: "array", minItems: 1, items: { type: "object", properties: { issueId: safeId, summary: { type: "string", minLength: 1 }, findingRefs: strings, evidenceRefs: strings }, required: ["issueId", "summary"], additionalProperties: false } } }, ["missionId", "issues"]),
  mutationTool("build_rebuttal_strategy", "Record an author-side strategy for normalized mission-bound issues.", { missionId: safeId, strategy: { type: "string", minLength: 1 } }, ["missionId", "strategy"]),
  mutationTool("build_rebuttal", "Record evidence-linked author-side rebuttal responses.", { missionId: safeId, issues: { type: "array", items: { type: "object", properties: { issueId: safeId, summary: { type: "string", minLength: 1 }, findingRefs: strings, evidenceRefs: strings }, required: ["issueId", "summary", "findingRefs", "evidenceRefs"], additionalProperties: false } }, strategy: { type: "string" }, responses: { type: "array", minItems: 1, items: { type: "object", properties: { issueId: safeId, response: { type: "string", minLength: 1 }, evidenceRefs: { type: "array", minItems: 1, items: { type: "string" } } }, required: ["issueId", "response", "evidenceRefs"], additionalProperties: false } } }, ["missionId", "responses"]),
  mutationTool("create_version_snapshot", "Snapshot current mission artifacts, optional supersedes lineage, and fail-closed finalization assessment.", { missionId: safeId, versionId: safeId, label: { type: "string" }, artifactRefs: { type: "array", minItems: 1, items: { type: "string" } }, supersedesVersionId: safeId, finalize: { type: "boolean" } }, ["missionId", "versionId", "artifactRefs"]),
  mutationTool("compare_versions", "Compare two current mission-bound artifact snapshots and reject stale inputs.", { missionId: safeId, fromVersionId: safeId, toVersionId: safeId }, ["missionId", "fromVersionId", "toVersionId"])
];
var MUTATING_TOOL_NAMES = new Set(baseToolDefinitions.filter((tool) => Object.hasOwn(tool.inputSchema.properties, "mutationMode")).map((tool) => tool.name));
var toolDefinitions = baseToolDefinitions;
var TOOL_INPUT_SCHEMAS = new Map(toolDefinitions.map((tool) => [tool.name, tool.inputSchema]));
var TOOL_INPUT_PROPERTY_NAMES = new Map(toolDefinitions.map((tool) => [tool.name, new Set(Object.keys(tool.inputSchema.properties ?? {}))]));

// scripts/doctor-mcp-probe.mjs
var target = path.resolve(process.argv[2] ?? process.cwd());
var serverScriptPath = path.join(target, "mcp", "dove-state-server-package.mjs");
var { call, notify, kill } = createMcpStdioClient({ args: [serverScriptPath], cwd: target });
var TOOL_NAMES = toolDefinitions.map((tool) => tool.name);
function parseToolPayload(result) {
  assert2.notEqual(result.isError, true, result.content?.[0]?.text ?? "MCP tool failed");
  return JSON.parse(result.content[0].text);
}
async function callReadOnlyTool(name, args = {}) {
  return parseToolPayload(await call("tools/call", { name, arguments: { ...args, resultMode: "full" } }));
}
async function main() {
  const init = await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "dove-doctor", version: "0.2.0" }
  });
  assert2.equal(init.serverInfo.name, "dove");
  notify("notifications/initialized");
  const listed = await call("tools/list");
  assert2.deepEqual(listed.tools.map((tool) => tool.name), TOOL_NAMES, "MCP registry drifted from the sealed schema 7 surface");
  const status = await callReadOnlyTool("query_dove_status");
  assert2.equal(status.query, true);
  assert2.equal(status.proposalOnly, true);
  assert2.equal(status.changes?.applied, false);
  const providers = await callReadOnlyTool("query_network_search_providers");
  assert2.ok(Array.isArray(providers.providers));
  const search = await callReadOnlyTool("search_network", { query: "dove doctor public web status", kind: "web" });
  assert2.ok(["blocked", "completed", "partial"].includes(search.status));
  assert2.ok(Array.isArray(search.candidates));
}
try {
  await main();
  kill();
} catch (error) {
  kill();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
