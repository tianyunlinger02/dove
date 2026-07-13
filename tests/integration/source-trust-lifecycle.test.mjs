import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  ensureWorkspace,
  evaluateEvidence,
  querySources,
  readJson,
  registerSource,
  sourceEligibility,
  sourceIdentityFingerprint,
  upsertClaims,
  verifySource
} from "../../src/core/internal-api.mjs";
import { ensureTestWorkspace, runFixtureMutation } from "../helpers/mutation-fixture.mjs";
import { seedTrustedSourceVerification } from "../helpers/source-verification-fixture.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function seedTaskPacket(root, packetId = "source-trust-packet") {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: packetId,
    title: "Source trust lifecycle",
    summary: "Verify source trust behavior.",
    sourceType: "test-task",
    sourceId: packetId,
    status: "pending",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    currentFocus: "Verify a source.",
    nextAction: "Record claim evidence.",
    evidenceLinks: [],
    outputPaths: [],
    packetPath: `.dove/task-packets/packets/${packetId}.json`,
    packetContextPath: `.dove/context/packets/${packetId}.json`,
    updatedAt: timestamp
  };
  fs.mkdirSync(path.join(root, ".dove/task-packets/packets"), { recursive: true });
  fs.writeFileSync(path.join(root, packet.packetPath), `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(path.join(root, ".dove/task-packets/index.json"), `${JSON.stringify({ version: 3, items: [packet], lifecycleCounts: {}, dependencyHealth: {}, updatedAt: timestamp }, null, 2)}\n`);
  return packetId;
}

function setup(actionId, callback) {
  const root = createTempRoot("dove-source-trust-");
  return runFixtureMutation(root, actionId, () => {
    ensureTestWorkspace(root);
    return callback({ root, packetId: seedTaskPacket(root) });
  });
}

function snapshot(root) {
  const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [[path.relative(root, absolute), fs.readFileSync(absolute).toString("base64")]];
  });
  return Object.fromEntries(walk(root));
}

function registerCandidate(root, packetId, overrides = {}) {
  return registerSource(root, {
    packetId,
    sourceId: "trust-source",
    citationKey: "trustSource2026",
    title: "Trustworthy Source",
    authors: ["Ada Researcher"],
    year: 2026,
    locator: "https://example.org/paper",
    ...overrides
  });
}

function rejectCandidate(root, packetId) {
  return verifySource(root, {
    packetId,
    sourceId: "trust-source",
    decision: "rejected",
    method: "opened canonical publication page and compared metadata",
    checkedMaterial: "publisher page title, author list, and full-text abstract",
    auditEvidence: [{
      reference: "https://example.org/paper",
      kind: "source",
      observation: "Publisher page metadata did not support trusting the registered source."
    }]
  });
}

test("candidate source is registered but claim evidence rejects it with zero writes", () => setup("candidate-source-is-registered-but-claim-evidence-rejects-it-with-zero-w", ({ root, packetId }) => {
  const source = registerCandidate(root, packetId);
  assert.equal(source.lifecycle, "candidate");
  const before = snapshot(root);
  assert.throws(() => upsertClaims(root, {
    packetId,
    claims: [{ id: "candidate-claim", text: "Candidate cannot support this claim.", sourceIds: [source.id] }]
  }), /source-candidate/);
  assert.deepEqual(snapshot(root), before);
}));

test("trusted durable verification with captured material makes a source claim-eligible", () => setup("matching-durable-verification-makes-a-source-claim-eligible", ({ root, packetId }) => {
  registerCandidate(root, packetId);
  const result = seedTrustedSourceVerification(root, "trust-source", packetId);
  assert.equal(result.source.lifecycle, "verified");
  assert.equal(result.verification.sourceId, "trust-source");
  assert.equal(result.verification.fingerprint, result.source.fingerprint);
  assert.equal(result.verification.issuerRole, "reviewer");
  assert.equal(result.verification.provenance, "trusted-internal-transition");
  assert.match(result.verification.materialHash, /^[a-f0-9]{64}$/u);

  const claims = upsertClaims(root, {
    packetId,
    claims: [{ id: "verified-claim", text: "Verified material supports this claim.", sourceIds: ["trust-source"] }]
  });
  assert.equal(claims.claims.length, 1);
  assert.equal(evaluateEvidence(root).unsupportedClaims.length, 0);
}));

test("source identity mutation invalidates prior verification", () => setup("source-identity-mutation-invalidates-prior-verification", ({ root, packetId }) => {
  registerCandidate(root, packetId);
  seedTrustedSourceVerification(root, "trust-source", packetId);
  registerCandidate(root, packetId, { title: "Mutated Source Identity" });
  const before = snapshot(root);
  assert.throws(() => upsertClaims(root, {
    packetId,
    claims: [{ id: "mutated-claim", text: "Stale verification must not apply.", sourceIds: ["trust-source"] }]
  }), /source-candidate|source-identity-changed/);
  assert.deepEqual(snapshot(root), before);
}));

test("rejected source cannot support claims", () => setup("rejected-source-cannot-support-claims", ({ root, packetId }) => {
  registerCandidate(root, packetId);
  rejectCandidate(root, packetId);
  const before = snapshot(root);
  assert.throws(() => upsertClaims(root, {
    packetId,
    claims: [{ id: "rejected-claim", text: "Rejected material cannot support this.", sourceIds: ["trust-source"] }]
  }), /source-rejected/);
  assert.deepEqual(snapshot(root), before);
}));

test("caller-minted verification fields fail before any source write", () => setup("caller-minted-verification-fields-fail-before-any-source-write", ({ root, packetId }) => {
  const before = snapshot(root);
  assert.throws(() => registerCandidate(root, packetId, { verified: true }), /caller-minted trust fields/);
  assert.deepEqual(snapshot(root), before);
  assert.throws(() => registerCandidate(root, packetId, { verification: { decision: "verified" } }), /caller-minted trust fields/);
  assert.deepEqual(snapshot(root), before);
}));

test("public positive verification fails closed before any write", () => setup("public-positive-verification-fails-closed", ({ root, packetId }) => {
  registerCandidate(root, packetId);
  const before = snapshot(root);
  assert.throws(() => verifySource(root, {
    packetId,
    sourceId: "trust-source",
    decision: "verified",
    method: "caller says it checked",
    checkedMaterial: "caller-described material",
    auditEvidence: [{ reference: "https://example.org/paper", kind: "source", observation: "Caller self-attestation." }]
  }), /only records rejection|cannot issue positive verification/);
  assert.deepEqual(snapshot(root), before);
}));

test("verification record remains separate from the source index", () => setup("verification-record-remains-separate-from-the-source-index", ({ root, packetId }) => {
  registerCandidate(root, packetId);
  seedTrustedSourceVerification(root, "trust-source", packetId);
  const sourceIndex = readJson(root, ARTIFACT_PATHS.sources, {});
  const verificationIndex = readJson(root, ARTIFACT_PATHS.sourceVerifications, {});
  assert.equal(sourceIndex.items[0].verification, undefined);
  assert.equal(verificationIndex.items.length, 1);
  assert.equal(verificationIndex.items[0].packetId, packetId);
}));

test("latest verification decision controls eligibility", () => setup("latest-verification-decision-controls-eligibility", ({ root, packetId }) => {
  registerCandidate(root, packetId);
  seedTrustedSourceVerification(root, "trust-source", packetId);
  rejectCandidate(root, packetId);
  const source = querySources(root, { sourceId: "trust-source" }).items[0];
  assert.equal(source.eligibility.eligible, false);
  assert.equal(source.eligibility.reason, "source-rejected");
  assert.equal(source.eligibility.decision, "rejected");
}));

test("legacy positive authority without trusted provenance fails closed", () => setup("legacy-positive-authority-without-provenance-fails-closed", ({ root, packetId }) => {
  registerCandidate(root, packetId);
  const sourceIndex = readJson(root, ARTIFACT_PATHS.sources, {});
  const source = sourceIndex.items[0];
  source.lifecycle = "verified";
  source.fingerprint = sourceIdentityFingerprint(source);
  const eligibility = sourceEligibility(source, [{
    id: "legacy-positive",
    sourceId: source.id,
    packetId,
    fingerprint: source.fingerprint,
    decision: "verified",
    checkedAt: new Date(0).toISOString()
  }], { root });
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.reason, "source-verification-untrusted-provenance");
}));

test("source eligibility requires matching verification packet binding", () => setup("source-eligibility-requires-matching-verification-packet-binding", ({ root, packetId }) => {
  registerCandidate(root, packetId);
  seedTrustedSourceVerification(root, "trust-source", packetId);
  const verificationIndex = readJson(root, ARTIFACT_PATHS.sourceVerifications, {});
  verificationIndex.items[0].packetId = "other-packet";
  const source = readJson(root, ARTIFACT_PATHS.sources, {}).items[0];
  const eligibility = sourceEligibility(source, verificationIndex.items, { root });
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.reason, "source-packet-binding-mismatch");
}));
