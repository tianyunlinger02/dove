import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { validateArtifactHandoffAuthority, validateArtifactHandoffs } from "./artifact-handoffs.mjs";
import { validatePersistedMission } from "./mission-contract-integrity.mjs";
import { missionCanReadMission, validateMissionGraph } from "./mission-graph.mjs";
import { validateMissionTransitions } from "./mission-lifecycle.mjs";
import { validatePersistedResearchDecision, validateResearchDecisionChain } from "./research-decisions.mjs";
import { readExecutionReceiptLedger } from "./receipt-ledger.mjs";
import { ARTIFACT_PATHS, DOVE_WORKSPACE_SCHEMA_VERSION, PACKAGE_VERSION } from "./schema.mjs";
import {
  CLAIM_RECORD_SCHEMA_VERSION,
  EXPERIMENT_RECORD_SCHEMA_VERSION,
  evidenceDigest,
  normalizeClaimContract,
  normalizeExperimentProtocol,
  normalizeExperimentResult
} from "./evidence-contracts.mjs";
import { createWorkspaceRevision, validateWorkspaceRevision, validateWorkspaceRevisionChain, workspaceRevisionPath } from "./workspace-revisions.mjs";

export { DOVE_WORKSPACE_SCHEMA_VERSION };
export const DOVE_MANIFEST_SCHEMA_VERSION = 1;
export const DOVE_PROJECT_SCHEMA_VERSION = 3;
export const DOVE_LESSONS_SECTIONS = Object.freeze([
  Object.freeze({ id: "research-direction-methods", heading: "研究方向与方法" }),
  Object.freeze({ id: "evidence-experiments", heading: "证据与实验" }),
  Object.freeze({ id: "engineering-reproducibility", heading: "工程与可复现性" }),
  Object.freeze({ id: "writing-figures-review-rebuttal", heading: "写作、图表、评审与答辩" }),
  Object.freeze({ id: "collaboration-work-practices", heading: "协作与工作实践" })
]);

export const DEFAULT_DOVE_LESSONS_MARKDOWN = `# Dove Lessons

本文档保存可复用的经验与工作偏好。它不构成证据、权威判断或完成证明。

${DOVE_LESSONS_SECTIONS.map((section) => `## ${section.heading}\n\n- 暂无。`).join("\n\n")}
`;

export const MINIMAL_WORKSPACE_DIRECTORIES = Object.freeze([
  ".dove/workspace-revisions",
  ".dove/missions",
  ".dove/mission-transitions",
  ".dove/artifact-handoffs",
  ".dove/research-decisions",
  ".dove/receipts",
  ".dove/receipts/execution",
  ".dove/sources",
  ".dove/claims",
  ".dove/experiments",
  ".dove/reviews"
]);

export const MINIMAL_WORKSPACE_REQUIRED_FILES = Object.freeze([
  ".dove/manifest.json",
  ".dove/project.json",
  ".dove/LESSONS.md"
]);

const CURRENT_SCHEMA_FORBIDDEN_LEGACY_PATHS = Object.freeze([
  ".dove/state.json",
  ".dove/task-packets",
  ".dove/orchestration",
  ".dove/runtime",
  ".dove/workspace",
  ".dove/mutations",
  ".dove/programs",
  ".dove/meta",
  ".dove/context",
  ".dove/wiki",
  ".dove/artifacts",
  ".dove/requirement-snapshots",
  ".dove/research-trees",
  ".dove/receipts/completion",
  ".dove/receipts/authority",
  ".dove/lessons",
  ".dove/drafts",
  ".dove/figures",
  ".dove/rebuttal"
]);

const MANIFEST_FIELDS = new Set(["schemaVersion", "manifestVersion", "workspaceId", "createdAt", "packageVersion"]);
const PROJECT_FIELDS = new Set(["schemaVersion", "workspaceId", "currentRevisionId", "currentRevisionDigest", "createdAt", "updatedAt"]);
const EXPERIMENT_PLAN_FIELDS = new Set(["schemaVersion", "experimentId", "missionId", "title", "protocol", "protocolDigest", "updatedAt"]);
const EXPERIMENT_RESULT_FIELDS = new Set(["schemaVersion", "resultId", "experimentId", "missionId", "protocolDigest", "status", "outcome", "measurements", "artifactRefs", "validationRefs", "denominator", "failures", "deviations", "limitations", "recordedAt", "resultDigest"]);
const SOURCE_FIELDS = new Set(["schemaVersion", "sourceId", "missionId", "contractDigest", "citationKey", "title", "authors", "year", "locator", "sourceType", "abstract", "origin", "capturedMaterial", "lifecycle", "currentDecision", "useLimitation"]);
const CLAIM_FIELDS = new Set(["schemaVersion", "claimId", "missionId", "contractDigest", "text", "evidenceRefs", "experimentEvidence", "uncertainty", "unsupportedExtensions", "currentAssessment", "updatedAt"]);
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

export function stableWorkspaceSerialize(value) {
  return JSON.stringify(stableValue(value));
}

export function workspaceDigest(value) {
  return sha256(stableWorkspaceSerialize(value));
}

export function canonicalWorkspacePath(root) {
  return fs.realpathSync.native(path.resolve(root));
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}

function assertSealed(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}

function exactIso(value, label) {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value;
}

function safeId(value, label) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new Error(`${label} must be a safe lowercase identifier.`);
  }
  return value;
}

function pathExistsNoFollow(fullPath) {
  try {
    fs.lstatSync(fullPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function readJsonStrict(fullPath, label) {
  let text;
  try {
    text = fs.readFileSync(fullPath, "utf8");
  } catch (error) {
    throw new Error(`${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Malformed durable JSON in ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function validateDoveManifest(value, options = {}) {
  assertSealed(value, MANIFEST_FIELDS, "Dove manifest");
  const expectedSchemaVersion = options.expectedSchemaVersion ?? DOVE_WORKSPACE_SCHEMA_VERSION;
  if (value.schemaVersion !== expectedSchemaVersion) {
    throw new Error(`Dove manifest schemaVersion ${value.schemaVersion ?? "missing"} is unsupported; expected ${expectedSchemaVersion}.`);
  }
  if (value.manifestVersion !== DOVE_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Dove manifest manifestVersion ${value.manifestVersion ?? "missing"} is unsupported.`);
  }
  safeId(value.workspaceId, "Dove manifest workspaceId");
  exactIso(value.createdAt, "Dove manifest createdAt");
  if (typeof value.packageVersion !== "string" || !value.packageVersion.trim()) {
    throw new Error("Dove manifest packageVersion must be a non-empty string.");
  }
  return value;
}

export function validateDoveProject(value, manifest) {
  assertSealed(value, PROJECT_FIELDS, "Dove project identity");
  if (value.schemaVersion !== DOVE_PROJECT_SCHEMA_VERSION) {
    throw new Error(`Dove project schemaVersion ${value.schemaVersion ?? "missing"} is unsupported.`);
  }
  safeId(value.workspaceId, "Dove project workspaceId");
  if (value.workspaceId !== manifest.workspaceId) {
    throw new Error("Dove project workspaceId does not match the manifest workspaceId.");
  }
  safeId(value.currentRevisionId, "Dove project currentRevisionId");
  hash(value.currentRevisionDigest, "Dove project currentRevisionDigest");
  exactIso(value.createdAt, "Dove project createdAt");
  exactIso(value.updatedAt, "Dove project updatedAt");
  if (value.createdAt !== manifest.createdAt) {
    throw new Error("Dove project createdAt must match the manifest createdAt.");
  }
  return value;
}

function hash(value, label) {
  if (typeof value !== "string" || !HASH.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return value;
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} must not contain duplicates.`);
  return value;
}

function validateMissionShape(value, manifest, label) {
  return validatePersistedMission(value, {
    label,
    workspaceId: manifest.workspaceId,
    filename: path.posix.basename(label)
  });
}

export function validateLessonsMarkdown(value, label = "Dove Lessons document") {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be non-empty Markdown.`);
  if (value.includes("\0")) throw new Error(`${label} must not contain null bytes.`);
  if (!value.endsWith("\n")) throw new Error(`${label} must end with a newline.`);
  const headings = [...value.matchAll(/^##\s+(.+?)\s*$/gmu)].map((match) => match[1]);
  const expected = DOVE_LESSONS_SECTIONS.map((section) => section.heading);
  if (headings.length !== expected.length || headings.some((heading, index) => heading !== expected[index])) {
    throw new Error(`${label} must contain the five stable sections exactly once and in order: ${expected.join("; ")}.`);
  }
  return value;
}

function evidenceReferenceOwner(reference, receiptLedger) {
  if (reference.startsWith("artifact:")) {
    const target = reference.slice("artifact:".length);
    return receiptLedger.currentOwnership.find((item) => item.path === target) ?? null;
  }
  if (reference.startsWith("validation:")) {
    const target = reference.slice("validation:".length);
    for (const receipt of receiptLedger.receipts.toReversed()) {
      const validation = receipt.validations.find((item) => item.reference === target);
      if (validation) return { missionId: receipt.missionId, sha256: validation.outputHash, receiptId: receipt.receiptId };
    }
  }
  return null;
}

function sourceReferenceMap(sources) {
  return new Map([...sources.values()].flatMap((source) => [source.sourceId, source.citationKey, source.locator]
    .filter(Boolean)
    .map((reference) => [reference, source])));
}

function validateCurrentSourceEvidence(reference, missionId, sources, missionGraph, label) {
  const source = sourceReferenceMap(sources).get(reference);
  if (!source || !missionCanReadMission(missionGraph, missionId, source.missionId)) throw new Error(`${label} is not current self-or-ancestor source evidence.`);
  if (source.lifecycle !== "candidate" || source.useLimitation !== "Captured source material is current but not independently verified.") {
    throw new Error(`${label} is not a current non-rejected captured Source with the explicit verification limitation.`);
  }
}

function validateCurrentEvidenceReferences(root, references, missionId, receiptLedger, missionGraph, label, sources = new Map()) {
  stringArray(references, label);
  for (const [index, reference] of references.entries()) {
    if (reference.startsWith("source:")) {
      validateCurrentSourceEvidence(reference.slice("source:".length), missionId, sources, missionGraph, `${label}[${index}]`);
      continue;
    }
    if (!reference.startsWith("artifact:") && !reference.startsWith("validation:")) throw new Error(`${label}[${index}] has an unsupported typed evidence reference.`);
    const owner = evidenceReferenceOwner(reference, receiptLedger);
    if (!owner || !missionCanReadMission(missionGraph, missionId, owner.missionId)) throw new Error(`${label}[${index}] is not current self-or-ancestor receipt evidence.`);
    const target = reference.slice(reference.indexOf(":") + 1);
    const fullPath = path.join(root, target);
    if (!fs.existsSync(fullPath) || !fs.lstatSync(fullPath).isFile() || sha256(fs.readFileSync(fullPath)) !== owner.sha256) {
      throw new Error(`${label}[${index}] no longer matches its receipt-owned file hash.`);
    }
  }
}

function readExperimentRecords(root, missions, missionGraph, receiptLedger, sources) {
  const directory = path.join(root, ARTIFACT_PATHS.experimentsDir);
  const byExperiment = new Map();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path.posix.join(ARTIFACT_PATHS.experimentsDir, entry.name);
    if (entry.isSymbolicLink() || !entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON file.`);
    const suffix = entry.name.endsWith(".plan.json") ? "plan" : entry.name.endsWith(".result.json") ? "result" : null;
    if (!suffix) throw new Error(`${relativePath} is not a current Experiment plan or result record.`);
    const value = readJsonStrict(path.join(root, relativePath), relativePath);
    if (value.schemaVersion !== EXPERIMENT_RECORD_SCHEMA_VERSION) throw new Error(`${relativePath} has an unsupported schemaVersion.`);
    assertSealed(value, suffix === "plan" ? EXPERIMENT_PLAN_FIELDS : EXPERIMENT_RESULT_FIELDS, relativePath);
    const experimentId = safeId(value.experimentId, `${relativePath}.experimentId`);
    const missionId = safeId(value.missionId, `${relativePath}.missionId`);
    if (!missions.has(missionId) || entry.name !== `${experimentId}.${suffix}.json`) throw new Error(`${relativePath} has an invalid mission or filename binding.`);
    const owner = receiptLedger.currentOwnership.find((item) => item.path === relativePath);
    if (!owner || owner.missionId !== missionId || owner.sha256 !== sha256(fs.readFileSync(path.join(root, relativePath)))) throw new Error(`${relativePath} is not current hash-matching mission-owned Experiment material.`);
    if (suffix === "plan") {
      nonEmptyString(value.title, `${relativePath}.title`);
      const protocol = normalizeExperimentProtocol(value.protocol, `${relativePath}.protocol`);
      if (value.protocolDigest !== evidenceDigest(protocol)) throw new Error(`${relativePath}.protocolDigest does not bind the frozen protocol.`);
      exactIso(value.updatedAt, `${relativePath}.updatedAt`);
    } else {
      if (safeId(value.resultId, `${relativePath}.resultId`) !== experimentId) throw new Error(`${relativePath}.resultId must match experimentId.`);
      const { resultDigest, schemaVersion: _schemaVersion, resultId: _resultId, experimentId: _experimentId, missionId: _missionId, protocolDigest: _protocolDigest, ...contract } = value;
      normalizeExperimentResult(contract, relativePath);
      if (resultDigest !== evidenceDigest({ schemaVersion: value.schemaVersion, resultId: value.resultId, experimentId: value.experimentId, missionId: value.missionId, protocolDigest: value.protocolDigest, ...contract })) throw new Error(`${relativePath}.resultDigest does not bind the exact result.`);
      validateCurrentEvidenceReferences(root, value.artifactRefs, missionId, receiptLedger, missionGraph, `${relativePath}.artifactRefs`, sources);
      validateCurrentEvidenceReferences(root, value.validationRefs, missionId, receiptLedger, missionGraph, `${relativePath}.validationRefs`, sources);
      for (const [index, failure] of value.failures.entries()) validateCurrentEvidenceReferences(root, failure.evidenceRefs, missionId, receiptLedger, missionGraph, `${relativePath}.failures[${index}].evidenceRefs`, sources);
    }
    const records = byExperiment.get(experimentId) ?? {};
    if (records[suffix]) throw new Error(`Experiment ${experimentId} has duplicate ${suffix} records.`);
    records[suffix] = value;
    byExperiment.set(experimentId, records);
  }
  for (const [experimentId, records] of byExperiment) {
    if (records.result && !records.plan) throw new Error(`Experiment ${experimentId} result recording requires a frozen plan.`);
    if (!records.result) continue;
    if (records.plan.missionId !== records.result.missionId || records.plan.protocolDigest !== records.result.protocolDigest) throw new Error(`Experiment ${experimentId} plan/result binding is inconsistent.`);
    for (const measurement of records.result.measurements) {
      if (!records.plan.protocol.metrics.includes(measurement.metric)) throw new Error(`Experiment ${experimentId} result contains a measurement outside the frozen metric contract.`);
      if (measurement.comparison !== null && !records.plan.protocol.comparisons.includes(measurement.comparison)) throw new Error(`Experiment ${experimentId} result contains a measurement outside the frozen comparison contract.`);
    }
  }
  return byExperiment;
}

function currentOwnedJson(root, relativePath, missionId, receiptLedger, fields, label) {
  const fullPath = path.join(root, relativePath);
  const owner = receiptLedger.currentOwnership.find((item) => item.path === relativePath);
  if (!owner || owner.missionId !== missionId || !fs.existsSync(fullPath) || !fs.lstatSync(fullPath).isFile() || owner.sha256 !== sha256(fs.readFileSync(fullPath))) throw new Error(`${label} is not current hash-matching mission-owned material.`);
  const value = readJsonStrict(fullPath, relativePath);
  assertSealed(value, fields, label);
  return value;
}

function readSourceRecords(root, missions, receiptLedger) {
  const directory = path.join(root, ARTIFACT_PATHS.sourcesDir);
  const sources = new Map();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "materials" && entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const relativePath = path.posix.join(ARTIFACT_PATHS.sourcesDir, entry.name);
    if (entry.isSymbolicLink() || !entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON source record.`);
    const peek = readJsonStrict(path.join(root, relativePath), relativePath);
    const sourceId = safeId(peek.sourceId, `${relativePath}.sourceId`);
    const missionId = safeId(peek.missionId, `${relativePath}.missionId`);
    const source = currentOwnedJson(root, relativePath, missionId, receiptLedger, SOURCE_FIELDS, relativePath);
    if (source.schemaVersion !== 3 || entry.name !== `${sourceId}.json`) throw new Error(`${relativePath} has an unsupported schema or filename.`);
    const mission = missions.get(missionId);
    if (!mission || source.contractDigest !== mission.contractDigest) throw new Error(`${relativePath}.contractDigest does not match its mission.`);
    if (!source.title && !source.locator) throw new Error(`${relativePath} requires title or locator.`);
    stringArray(source.authors, `${relativePath}.authors`);
    assertPlainObject(source.capturedMaterial, `${relativePath}.capturedMaterial`);
    const materialPath = source.capturedMaterial.path;
    if (typeof materialPath !== "string" || !materialPath.startsWith(`${ARTIFACT_PATHS.sourcesDir}/materials/`) || !Number.isSafeInteger(source.capturedMaterial.sizeBytes) || source.capturedMaterial.sizeBytes < 1) throw new Error(`${relativePath}.capturedMaterial is invalid.`);
    hash(source.capturedMaterial.sha256, `${relativePath}.capturedMaterial.sha256`); exactIso(source.capturedMaterial.capturedAt, `${relativePath}.capturedMaterial.capturedAt`);
    const materialFile = path.join(root, materialPath);
    if (!fs.existsSync(materialFile) || !fs.lstatSync(materialFile).isFile() || fs.statSync(materialFile).size !== source.capturedMaterial.sizeBytes || sha256(fs.readFileSync(materialFile)) !== source.capturedMaterial.sha256) throw new Error(`${relativePath}.capturedMaterial has drifted.`);
    if (!["candidate", "rejected"].includes(source.lifecycle) || source.currentDecision?.decision !== source.lifecycle) throw new Error(`${relativePath}.lifecycle/currentDecision is invalid.`);
    exactIso(source.currentDecision.decidedAt, `${relativePath}.currentDecision.decidedAt`);
    if (source.useLimitation !== "Captured source material is current but not independently verified.") throw new Error(`${relativePath}.useLimitation is invalid.`);
    sources.set(sourceId, source);
  }
  return sources;
}

function readClaimRecords(root, missions, missionGraph, receiptLedger, experiments, sources) {
  const claims = new Map();
  for (const entry of fs.readdirSync(path.join(root, ARTIFACT_PATHS.claimsDir), { withFileTypes: true })) {
    const relativePath = path.posix.join(ARTIFACT_PATHS.claimsDir, entry.name);
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON claim record.`);
    const peek = readJsonStrict(path.join(root, relativePath), relativePath);
    const missionId = safeId(peek.missionId, `${relativePath}.missionId`);
    const claim = currentOwnedJson(root, relativePath, missionId, receiptLedger, CLAIM_FIELDS, relativePath);
    const claimId = safeId(claim.claimId, `${relativePath}.claimId`);
    if (claim.schemaVersion !== CLAIM_RECORD_SCHEMA_VERSION || entry.name !== `${claimId}.json` || missions.get(missionId)?.contractDigest !== claim.contractDigest) throw new Error(`${relativePath} schema, filename, or mission binding is invalid.`);
    const contract = normalizeClaimContract({ experimentEvidence: claim.experimentEvidence, uncertainty: claim.uncertainty, unsupportedExtensions: claim.unsupportedExtensions, currentAssessment: claim.currentAssessment }, relativePath);
    validateCurrentEvidenceReferences(root, claim.evidenceRefs, missionId, receiptLedger, missionGraph, `${relativePath}.evidenceRefs`, sources);
    if (claim.evidenceRefs.some((reference) => reference.startsWith("source:")) && !contract.uncertainty.includes("Captured source material is current but not independently verified.")) throw new Error(`${relativePath}.uncertainty omits the captured-source verification limitation.`);
    if (claim.evidenceRefs.length === 0 && contract.experimentEvidence.length === 0) throw new Error(`${relativePath} has no current evidence.`);
    for (const [index, binding] of contract.experimentEvidence.entries()) {
      const records = experiments.get(binding.experimentId);
      if (!records?.plan || !records.result || records.plan.missionId !== records.result.missionId || !missionCanReadMission(missionGraph, missionId, records.plan.missionId)) throw new Error(`${relativePath}.experimentEvidence[${index}] must bind a current self-or-ancestor Experiment.`);
      const measurement = records.result.measurements.find((item) => item.metric === binding.metric && item.comparison === binding.comparison);
      if (!measurement || measurement.value !== binding.value) throw new Error(`${relativePath}.experimentEvidence[${index}] does not exactly bind the referenced measurement.`);
    }
    exactIso(claim.updatedAt, `${relativePath}.updatedAt`); claims.set(claimId, claim);
  }
  return claims;
}

function validateJsonDirectory(root, relativeDirectory, manifest, validate, context = {}) {
  const directory = path.join(root, relativeDirectory);
  const values = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) throw new Error(`${path.posix.join(relativeDirectory, entry.name)} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${path.posix.join(relativeDirectory, entry.name)} must be a regular JSON file.`);
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    values.push(validate(readJsonStrict(path.join(root, relativePath), relativePath), manifest, relativePath, context));
  }
  return values;
}

function requiredPathProblem(root, relativePath, kind) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return `${relativePath} is missing`;
  const stat = fs.lstatSync(fullPath);
  if (stat.isSymbolicLink()) return `${relativePath} must not be a symbolic link`;
  if (kind === "directory" && !stat.isDirectory()) return `${relativePath} must be a directory`;
  if (kind === "file" && !stat.isFile()) return `${relativePath} must be a regular file`;
  return null;
}

function sourceIdentity(doveRoot) {
  const stat = fs.lstatSync(doveRoot, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(".dove must be a real directory; symbolic-link workspace roots are not accepted.");
  }
  return {
    kind: "directory",
    device: String(stat.dev),
    inode: String(stat.ino),
    mode: Number(stat.mode),
    ctimeNs: String(stat.ctimeNs),
    mtimeNs: String(stat.mtimeNs)
  };
}

function treeEntries(doveRoot) {
  const entries = [];
  const visit = (directory, prefix = "") => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
      const fullPath = path.join(directory, entry.name);
      const stat = fs.lstatSync(fullPath, { bigint: true });
      const metadata = {
        path: relativePath,
        device: String(stat.dev),
        inode: String(stat.ino),
        mode: Number(stat.mode),
        ctimeNs: String(stat.ctimeNs),
        mtimeNs: String(stat.mtimeNs)
      };
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "directory" });
        visit(fullPath, relativePath);
      } else if (stat.isFile()) {
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha256(fs.readFileSync(fullPath)) });
      } else if (stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "symlink", target: fs.readlinkSync(fullPath) });
      } else {
        throw new Error(`Unsupported filesystem entry inside .dove: ${relativePath}.`);
      }
    }
  };
  visit(doveRoot);
  return entries;
}

export function inspectDoveSourceTree(root) {
  const workspace = canonicalWorkspacePath(root);
  const doveRoot = path.join(workspace, ".dove");
  if (!pathExistsNoFollow(doveRoot)) return null;
  const identity = sourceIdentity(doveRoot);
  const entries = treeEntries(doveRoot);
  return {
    identity,
    entryCount: entries.length,
    treeDigest: workspaceDigest(entries)
  };
}

function detectedVersionLabel(value) {
  if (Number.isInteger(value)) return String(value);
  if (value === undefined) return "missing";
  return "invalid";
}

function inspectDoveWorkspaceVersion(root) {
  const workspace = canonicalWorkspacePath(root);
  const doveRoot = path.join(workspace, ".dove");
  if (!pathExistsNoFollow(doveRoot)) {
    return { workspace, state: "absent", category: "absent", healthy: false, schemaVersion: null, detectedSchema: "absent" };
  }
  let source;
  try {
    source = { identity: sourceIdentity(doveRoot) };
  } catch (error) {
    return { workspace, state: "invalid-root", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: "invalid-root", error: error instanceof Error ? error.message : String(error) };
  }
  const manifestPath = path.join(doveRoot, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return { workspace, state: "legacy-missing-manifest", category: "legacy", healthy: false, schemaVersion: null, detectedSchema: "missing-manifest", source };
  }
  let manifest;
  try {
    manifest = readJsonStrict(manifestPath, ".dove/manifest.json");
  } catch (error) {
    return { workspace, state: "malformed-manifest", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: "malformed", source, error: error instanceof Error ? error.message : String(error) };
  }
  const version = manifest?.schemaVersion;
  const retainedLegacyAuthorityManifest = version === undefined && Number.isInteger(manifest?.version);
  if (retainedLegacyAuthorityManifest) {
    return { workspace, state: "legacy-authority-manifest", category: "legacy", healthy: false, schemaVersion: manifest.version, detectedSchema: `legacy-authority-${manifest.version}`, source, manifest };
  }
  if (!Number.isInteger(version)) {
    return { workspace, state: "invalid-manifest-version", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: detectedVersionLabel(version), source, manifest };
  }
  if (version < DOVE_WORKSPACE_SCHEMA_VERSION) {
    return { workspace, state: "legacy-version", category: "legacy", healthy: false, schemaVersion: version, detectedSchema: String(version), source, manifest };
  }
  if (version > DOVE_WORKSPACE_SCHEMA_VERSION) {
    return { workspace, state: "future-version", category: "future", healthy: false, schemaVersion: version, detectedSchema: String(version), source, manifest };
  }
  try {
    validateDoveManifest(manifest, { expectedSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION });
    const requiredDirectories = MINIMAL_WORKSPACE_DIRECTORIES;
    const problems = [
      ...requiredDirectories.map((relativePath) => requiredPathProblem(workspace, relativePath, "directory")),
      ...MINIMAL_WORKSPACE_REQUIRED_FILES.map((relativePath) => requiredPathProblem(workspace, relativePath, "file")),
      ...CURRENT_SCHEMA_FORBIDDEN_LEGACY_PATHS
        .filter((relativePath) => fs.existsSync(path.join(workspace, relativePath)))
        .map((relativePath) => `${relativePath} is a retained legacy artifact and must not coexist with current schema ${DOVE_WORKSPACE_SCHEMA_VERSION}`)
    ].filter(Boolean);
    if (problems.length > 0) throw new Error(`Dove schema declaration contradicts required layout: ${problems.join("; ")}.`);
    const project = validateDoveProject(readJsonStrict(path.join(doveRoot, "project.json"), ".dove/project.json"), manifest);
    const workspaceRevisionValues = validateJsonDirectory(workspace, ARTIFACT_PATHS.workspaceRevisionsDir, manifest, (value, currentManifest, label) => validateWorkspaceRevision(value, {
      label,
      workspaceId: currentManifest.workspaceId,
      filename: path.posix.basename(label)
    }));
    const workspaceRevisionChain = validateWorkspaceRevisionChain(workspaceRevisionValues, project);
    const workspaceRevisions = workspaceRevisionChain.byId;
    const currentWorkspaceRevision = workspaceRevisionChain.current;
    const missionValues = validateJsonDirectory(workspace, ARTIFACT_PATHS.missionsDir, manifest, validateMissionShape);
    const missionGraph = validateMissionGraph(missionValues.map((mission) => ({ filename: `${mission.missionId}.json`, mission })));
    const missions = missionGraph.missions;
    for (const mission of missions.values()) {
      const boundRevision = workspaceRevisions.get(mission.workspaceRevisionId);
      if (!boundRevision || boundRevision.revisionDigest !== mission.workspaceRevisionDigest) throw new Error(`Mission ${mission.missionId} references an unavailable workspace revision.`);
    }
    const missionTransitionValues = validateJsonDirectory(workspace, ARTIFACT_PATHS.missionTransitionsDir, manifest, (value, currentManifest, label) => ({ value, currentManifest, label }));
    const missionTransitions = validateMissionTransitions(missionTransitionValues.map(({ value }) => value), { workspaceId: manifest.workspaceId, missions });
    const artifactHandoffValues = validateJsonDirectory(workspace, ARTIFACT_PATHS.artifactHandoffsDir, manifest, (value, currentManifest, label) => ({ value, currentManifest, label }));
    const artifactHandoffs = validateArtifactHandoffs(artifactHandoffValues.map(({ value }) => value), { workspaceId: manifest.workspaceId, missions });
    const researchDecisionValues = validateJsonDirectory(workspace, ARTIFACT_PATHS.researchDecisionsDir, manifest, (value, _manifest, label) => {
      const decision = validatePersistedResearchDecision(value, { label });
      if (path.posix.basename(label) !== `${decision.decisionId}.json`) throw new Error(`${label} filename must match decisionId ${decision.decisionId}.`);
      const mission = missions.get(decision.missionId);
      if (!mission || mission.mode !== "research" || decision.contractDigest !== mission.contractDigest) throw new Error(`${label} does not bind an existing research mission contract.`);
      return decision;
    });
    const decisionsByMission = new Map();
    for (const decision of researchDecisionValues) {
      const decisions = decisionsByMission.get(decision.missionId) ?? []; decisions.push(decision); decisionsByMission.set(decision.missionId, decisions);
    }
    const researchDecisions = new Map();
    const currentResearchDecisions = new Map();
    for (const [missionId, decisions] of decisionsByMission) {
      const mission = missions.get(missionId);
      const chain = validateResearchDecisionChain(decisions, { label: `Research decision chain for mission ${missionId}`, missionId, contractDigest: mission.contractDigest });
      for (const decision of chain) researchDecisions.set(decision.decisionId, decision);
      currentResearchDecisions.set(missionId, chain.at(-1));
    }
    for (const mission of missions.values()) {
      if (mission.mode === "research" && !currentResearchDecisions.has(mission.missionId)) throw new Error(`Research mission ${mission.missionId} requires an initial research decision.`);
      if (mission.mode === "ordinary" && currentResearchDecisions.has(mission.missionId)) throw new Error(`Ordinary mission ${mission.missionId} must not have a research decision.`);
    }
    const receiptLedger = readExecutionReceiptLedger(workspace, { manifest, missions, missionGraph, artifactHandoffs });
    for (const receipt of receiptLedger.receipts) {
      const mission = missions.get(receipt.missionId);
      if (receipt.ordinaryHostOutcome !== undefined && mission?.mode !== "ordinary") throw new Error(`Execution receipt ${receipt.receiptId} has an ordinary outcome for non-ordinary mission ${receipt.missionId}.`);
      if (receipt.researchOutcome !== undefined && mission?.mode !== "research") throw new Error(`Execution receipt ${receipt.receiptId} has a research outcome for non-research mission ${receipt.missionId}.`);
      if (receipt.researchOutcome !== undefined) {
        const decision = researchDecisions.get(receipt.researchOutcome.decisionId);
        if (!decision || decision.missionId !== receipt.missionId || decision.decisionDigest !== receipt.researchOutcome.decisionDigest || decision.nextAction?.actionId !== receipt.researchOutcome.actionId || decision.nextAction?.actionDigest !== receipt.researchOutcome.actionDigest) throw new Error(`Execution receipt ${receipt.receiptId}.researchOutcome does not bind an exact persisted decision action.`);
      }
    }
    const receiptById = new Map(receiptLedger.receipts.map((receipt) => [receipt.receiptId, receipt]));
    for (const decision of researchDecisions.values()) {
      for (const receiptId of decision.consumedReceiptIds) {
        const receipt = receiptById.get(receiptId);
        if (!receipt) throw new Error(`Research decision ${decision.decisionId} consumes unknown receipt ${receiptId}.`);
        if (receipt.missionId !== decision.missionId || !receipt.researchOutcome) throw new Error(`Research decision ${decision.decisionId} may consume only research receipts from its mission.`);
        if (receipt.researchOutcome.decisionId !== decision.predecessorDecisionId) throw new Error(`Research decision ${decision.decisionId} must consume receipts produced under its immediate predecessor decision.`);
      }
    }
    validateArtifactHandoffAuthority(artifactHandoffs, receiptLedger);
    const sources = readSourceRecords(workspace, missions, receiptLedger);
    const lessonsDocument = fs.readFileSync(path.join(workspace, ARTIFACT_PATHS.lessonsDocument), "utf8");
    validateLessonsMarkdown(lessonsDocument, ARTIFACT_PATHS.lessonsDocument);
    const experiments = readExperimentRecords(workspace, missions, missionGraph, receiptLedger, sources);
    const claims = readClaimRecords(workspace, missions, missionGraph, receiptLedger, experiments, sources);
    return {
      workspace,
      state: "current-healthy",
      category: "current",
      healthy: true,
      schemaVersion: version,
      detectedSchema: String(version),
      source,
      manifest,
      project,
      workspaceRevisions,
      currentWorkspaceRevision,
      missions,
      missionGraph,
      missionTransitions,
      artifactHandoffs,
      researchDecisions,
      currentResearchDecisions,
      lessonsDocument,
      experiments,
      sources,
      claims,
      receiptLedger
    };
  } catch (error) {
    return { workspace, state: "current-unhealthy", category: "invalid", healthy: false, schemaVersion: version, detectedSchema: String(version), source, manifest, error: error instanceof Error ? error.message : String(error) };
  }
}

export function inspectDoveWorkspace(root) {
  return inspectDoveWorkspaceVersion(root);
}

export function workspaceSchemaError(inspection, operation = "Dove operation") {
  if (inspection.state === "absent") {
    return new Error(`${operation} requires a current Dove workspace. Run /dove:workspace and explicitly establish the research mainline first.`);
  }
  if (inspection.category === "legacy") {
    return new Error(`${operation} cannot open unsupported Dove schema ${inspection.detectedSchema} under schema ${DOVE_WORKSPACE_SCHEMA_VERSION}. Archive the old workspace and establish a new current workspace explicitly. No files were changed.`);
  }
  if (inspection.category === "future") {
    return new Error(`${operation} refuses future Dove schema ${inspection.detectedSchema}; install a compatible Dove version. No files were changed.`);
  }
  return new Error(`${operation} refuses invalid Dove workspace state ${inspection.state}${inspection.error ? `: ${inspection.error}` : ""}. Run dove workspace reset --archive and confirm the exact proposal. No files were changed.`);
}

export function openDoveWorkspace(root, options = {}) {
  const inspection = inspectDoveWorkspace(root);
  if (inspection.healthy) return inspection;
  if (inspection.state === "absent" && options.allowAbsent === true) return inspection;
  throw workspaceSchemaError(inspection, options.operation);
}

export function createMinimalWorkspaceDocuments({ workspaceId, mainline, changeReason = "Establish the initial research mainline.", createdAt }) {
  safeId(workspaceId, "workspaceId");
  exactIso(createdAt, "createdAt");
  if (typeof mainline !== "string" || !mainline.trim()) throw new Error("Dove workspace initialization requires a non-empty research mainline.");
  const manifest = {
    schemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION,
    manifestVersion: DOVE_MANIFEST_SCHEMA_VERSION,
    workspaceId,
    createdAt,
    packageVersion: PACKAGE_VERSION
  };
  const workspaceRevision = createWorkspaceRevision({
    workspaceId,
    revision: 1,
    previousRevisionId: null,
    previousRevisionDigest: null,
    mainline: mainline.trim(),
    changeReason,
    createdAt
  });
  const project = {
    schemaVersion: DOVE_PROJECT_SCHEMA_VERSION,
    workspaceId,
    currentRevisionId: workspaceRevision.revisionId,
    currentRevisionDigest: workspaceRevision.revisionDigest,
    createdAt,
    updatedAt: createdAt
  };
  return { manifest, project, workspaceRevision };
}

export function newWorkspaceId() {
  return `workspace-${crypto.randomUUID()}`;
}

function writeJsonAtomicContent(targetPath, value, ops) {
  ops.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function materializeMinimalWorkspaceDirectory(directory, documents, options = {}) {
  const ops = options.fsOps ?? fs;
  ops.mkdirSync(directory, { recursive: false });
  for (const relativePath of MINIMAL_WORKSPACE_DIRECTORIES.map((item) => item.slice(".dove/".length))) {
    ops.mkdirSync(path.join(directory, relativePath), { recursive: true });
  }
  writeJsonAtomicContent(path.join(directory, "manifest.json"), documents.manifest, ops);
  writeJsonAtomicContent(path.join(directory, "project.json"), documents.project, ops);
  ops.writeFileSync(path.join(directory, "LESSONS.md"), DEFAULT_DOVE_LESSONS_MARKDOWN, "utf8");
  writeJsonAtomicContent(path.join(directory, workspaceRevisionPath(documents.workspaceRevision.revisionId).slice(".dove/".length)), documents.workspaceRevision, ops);
}

export function archiveTargetFor({ workspace, detectedSchema, treeDigest }) {
  const schemaLabel = String(detectedSchema ?? "invalid").replace(/[^a-z0-9._-]+/giu, "-").toLowerCase();
  return path.join(workspace, ".dove-archive", `schema-${schemaLabel}-${String(treeDigest).slice(0, 24)}`);
}
