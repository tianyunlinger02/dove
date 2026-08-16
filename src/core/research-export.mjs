import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { openRootedFilesystem } from "./rooted-filesystem.mjs";
import { writeFileSetTransaction } from "./file-set-transaction.mjs";
import {
  IMPORTED_LESSONS_LINK,
  RESEARCH_DEFAULT_FILE_PATHS,
  RESEARCH_DEFAULT_PATHS,
  appendExactMarkdownBlocks,
  appendExactMarkdownBytes,
  appendExactMarkdownLines,
  prepareResearchDefaults
} from "./research-defaults.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";

const V2_FORMAT = "dove-research-v2";
const OLD_ROOT = ".dove";
const NEW_ROOT = ".dove/research";
const ARCHIVE_ROOT = ".dove/archive";
const REQUIRED_FILES = [".dove/format.json", ".dove/workspace.json", ".dove/LESSONS.md"];
const RECORD_DIRECTORIES = [
  ["direction-decisions", "directionDecisions"],
  ["missions", "missions"],
  ["sources", "sources"],
  ["experiments", "experiments"],
  ["claims", "claims"],
  ["review-exchanges", "reviewExchanges"],
  ["reviews", "reviews"]
];
const RECORD_DIRECTORY_PATHS = RECORD_DIRECTORIES.map(([directory]) => `.dove/${directory}`);
const SAFE_FILE_PART = /[^\p{L}\p{N}._-]+/gu;
const SAFE_RESEARCH_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const WORKSPACE_FIELDS = new Set(["workspaceId", "researchQuestion", "mainline", "contributionIntent", "currentFocus", "createdAt", "updatedAt"]);
const MISSION_FIELDS = new Set(["missionId", "parentMissionId", "dependsOnMissionIds", "branchKind", "branchReason", "goal", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs", "contributionRole", "createdAt"]);
const CONCLUSION_FIELDS = new Set(["missionId", "outcome", "synthesis", "failures", "limitations", "uncertainty", "sourceIds", "experimentIds", "claimIds", "recommendedBranches", "concludedAt"]);
const SOURCE_FIELDS = new Set(["sourceId", "missionId", "citationKey", "title", "authors", "year", "locator", "sourceType", "summary", "conditions", "relationship", "conflicts", "limitations", "capture", "recordedAt"]);
const CAPTURE_FIELDS = new Set(["path", "sha256"]);
const PLAN_FIELDS = new Set(["experimentId", "missionId", "title", "hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts", "cost", "risk", "failureValue", "contributionRole", "plannedAt"]);
const RESULT_FIELDS = new Set(["experimentId", "missionId", "kind", "summary", "observations", "measurements", "denominator", "hypothesisImpacts", "claimImpacts", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations", "recordedAt"]);
const MEASUREMENT_FIELDS = new Set(["metric", "value", "unit", "condition", "denominatorRef", "note"]);
const HYPOTHESIS_IMPACT_FIELDS = new Set(["hypothesisRef", "impact", "rationale"]);
const CLAIM_IMPACT_FIELDS = new Set(["claimId", "impact", "rationale"]);
const CLAIM_FIELDS = new Set(["claimId", "missionId", "statement", "supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "assessment", "storyRole", "artifactRefs", "supersedesClaimId", "revisionReason", "recordedAt"]);
const REVIEW_EXCHANGE_FIELDS = new Set(["exchangeId", "missionId", "artifacts", "preparedAt"]);
const REVIEW_ARTIFACT_FIELDS = new Set(["path", "sha256"]);
const REVIEW_FIELDS = new Set(["reviewId", "exchangeId", "missionId", "artifacts", "status", "verdict", "summary", "rubric", "findings", "actionItems", "report", "provenance", "limitations", "reviewedAt"]);
const DIRECTION_FIELDS = new Set(["decisionId", "priorDirection", "nextDirection", "reason", "evidenceRefs", "missionRefs", "decidedAt"]);
const DIRECTION_VALUE_FIELDS = new Set(["researchQuestion", "mainline", "contributionIntent"]);

function canonicalRoot(root, fsOps) {
  const resolved = path.resolve(root);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}

function timestamp(value) {
  const date = value === undefined ? new Date() : value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Research export now must be a Date or valid timestamp.");
  return date.toISOString().replace(/[-:]/gu, "").replace(".", "-");
}

function fileState(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return { exists: false, type: "absent", sha256: null, mode: null };
  if (stat.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
  if (stat.isDirectory()) return { exists: true, type: "directory", sha256: null, mode: stat.mode & 0o7777 };
  if (!stat.isFile()) throw new Error(`${relativePath} must be a regular file or directory.`);
  return { exists: true, type: "file", sha256: crypto.createHash("sha256").update(anchor.readFile(relativePath)).digest("hex"), mode: stat.mode & 0o7777 };
}

function expectedTransactionState(state) {
  if (state.exists) {
    if (state.type !== "file") throw new Error("Research Markdown export targets must be absent or regular files.");
    return { exists: true, type: "file", sha256: state.sha256, mode: state.mode };
  }
  return { exists: false, type: "absent", sha256: null, mode: null };
}

function readRequired(anchor, relativePath) {
  const state = fileState(anchor, relativePath);
  if (!state.exists || state.type !== "file") throw new Error(`legacy JSON research export requires ${relativePath} as a regular file.`);
  return { relativePath, bytes: anchor.readFile(relativePath), state };
}

function strictJson(file) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
  } catch (error) {
    throw new Error(`${file.relativePath} must contain valid UTF-8 JSON.`, { cause: error });
  }
  return parseJsonWithoutDuplicateKeys(text, file.relativePath);
}

function listJson(anchor, relativeDirectory) {
  const state = fileState(anchor, relativeDirectory);
  if (!state.exists) return [];
  if (state.type !== "directory") throw new Error(`${relativeDirectory} must be a real directory.`);
  const files = [];
  for (const entry of anchor.readdir(relativeDirectory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativeDirectory} may contain only regular JSON files for export: ${entry.name}.`);
    files.push(readRequired(anchor, relativePath));
  }
  return files;
}

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value;
}

function exactFields(value, fields, label) {
  plainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} contains unsupported fields: ${unknown.join(", ")}.`);
  return value;
}

function researchId(value, label) {
  if (typeof value !== "string" || !SAFE_RESEARCH_ID.test(value)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return value;
}

function nonEmptyText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be non-empty text.`);
  return value;
}

function nullableText(value, label) {
  if (value === null) return value;
  return nonEmptyText(value, label);
}

function stringArray(value, label, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${label} must be an array of non-empty strings.`);
  return value;
}

function plainArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function exactTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO timestamp.`);
  return value;
}

function enumeration(value, allowed, label) {
  if (!allowed.includes(value)) throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  return value;
}

function assertFilename(file, expected, label) {
  if (path.posix.basename(file.relativePath) !== expected) throw new Error(`${file.relativePath} does not match ${label} identifier ${expected}.`);
}

function validateWorkspace(value) {
  exactFields(value, WORKSPACE_FIELDS, "legacy JSON research Workspace");
  researchId(value.workspaceId, "legacy JSON research Workspace.workspaceId");
  for (const field of ["researchQuestion", "mainline", "contributionIntent", "currentFocus"]) nonEmptyText(value[field], `legacy JSON research Workspace.${field}`);
  exactTimestamp(value.createdAt, "legacy JSON research Workspace.createdAt");
  exactTimestamp(value.updatedAt, "legacy JSON research Workspace.updatedAt");
  if (value.updatedAt < value.createdAt) throw new Error("legacy JSON research Workspace.updatedAt must not precede createdAt.");
  return value;
}

function validateMissionEntry(entry) {
  const conclusion = entry.file.relativePath.endsWith(".conclusion.json");
  if (conclusion) {
    exactFields(entry.value, CONCLUSION_FIELDS, entry.file.relativePath);
    const missionId = researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
    assertFilename(entry.file, `${missionId}.conclusion.json`, "Mission conclusion");
    enumeration(entry.value.outcome, ["completed", "blocked", "stopped"], `${entry.file.relativePath}.outcome`);
    nonEmptyText(entry.value.synthesis, `${entry.file.relativePath}.synthesis`);
    for (const field of ["failures", "limitations", "uncertainty", "sourceIds", "experimentIds", "claimIds", "recommendedBranches"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
    exactTimestamp(entry.value.concludedAt, `${entry.file.relativePath}.concludedAt`);
    return { kind: "conclusion", id: missionId };
  }
  exactFields(entry.value, MISSION_FIELDS, entry.file.relativePath);
  const missionId = researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  assertFilename(entry.file, `${missionId}.json`, "Mission");
  if (entry.value.parentMissionId !== null) researchId(entry.value.parentMissionId, `${entry.file.relativePath}.parentMissionId`);
  for (const field of ["dependsOnMissionIds", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
  for (const field of ["goal", "contributionRole"]) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
  nullableText(entry.value.branchKind, `${entry.file.relativePath}.branchKind`);
  nullableText(entry.value.branchReason, `${entry.file.relativePath}.branchReason`);
  exactTimestamp(entry.value.createdAt, `${entry.file.relativePath}.createdAt`);
  return { kind: "mission", id: missionId };
}

function validateSourceEntry(entry) {
  exactFields(entry.value, SOURCE_FIELDS, entry.file.relativePath);
  const sourceId = researchId(entry.value.sourceId, `${entry.file.relativePath}.sourceId`);
  assertFilename(entry.file, `${sourceId}.json`, "Source");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  if (entry.value.title === null && entry.value.locator === null) throw new Error(`${entry.file.relativePath} requires title or locator.`);
  for (const field of ["citationKey", "title", "locator", "sourceType"]) if (entry.value[field] !== null) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
  stringArray(entry.value.authors, `${entry.file.relativePath}.authors`);
  if (entry.value.year !== null && !["string", "number"].includes(typeof entry.value.year)) throw new Error(`${entry.file.relativePath}.year must be text, a number, or null.`);
  if (typeof entry.value.year === "string") nonEmptyText(entry.value.year, `${entry.file.relativePath}.year`);
  if (typeof entry.value.year === "number" && !Number.isFinite(entry.value.year)) throw new Error(`${entry.file.relativePath}.year must be finite.`);
  nonEmptyText(entry.value.summary, `${entry.file.relativePath}.summary`);
  enumeration(entry.value.relationship, ["consensus", "conflict", "condition-specific", "uncovered", "testable-gap"], `${entry.file.relativePath}.relationship`);
  for (const field of ["conditions", "conflicts", "limitations"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
  if (entry.value.capture !== null) {
    exactFields(entry.value.capture, CAPTURE_FIELDS, `${entry.file.relativePath}.capture`);
    nonEmptyText(entry.value.capture.path, `${entry.file.relativePath}.capture.path`);
    if (!SHA256.test(entry.value.capture.sha256)) throw new Error(`${entry.file.relativePath}.capture.sha256 must be a lowercase SHA-256 digest.`);
  }
  exactTimestamp(entry.value.recordedAt, `${entry.file.relativePath}.recordedAt`);
  return sourceId;
}

function validateExperimentEntry(entry) {
  const plan = entry.file.relativePath.endsWith(".plan.json");
  const result = entry.file.relativePath.endsWith(".result.json");
  if (!plan && !result) throw new Error(`${entry.file.relativePath} must use .plan.json or .result.json.`);
  if (plan) {
    exactFields(entry.value, PLAN_FIELDS, entry.file.relativePath);
    const experimentId = researchId(entry.value.experimentId, `${entry.file.relativePath}.experimentId`);
    assertFilename(entry.file, `${experimentId}.plan.json`, "Experiment plan");
    researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
    for (const field of ["title", "cost", "risk", "failureValue", "contributionRole"]) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
    for (const field of ["hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`, ["protocol", "inputs", "metrics", "discriminatingObservations", "stopConditions"].includes(field) ? 1 : 0);
    exactTimestamp(entry.value.plannedAt, `${entry.file.relativePath}.plannedAt`);
    return { kind: "plan", id: experimentId };
  }
  exactFields(entry.value, RESULT_FIELDS, entry.file.relativePath);
  const experimentId = researchId(entry.value.experimentId, `${entry.file.relativePath}.experimentId`);
  assertFilename(entry.file, `${experimentId}.result.json`, "Experiment result");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  enumeration(entry.value.kind, ["positive", "negative", "null", "mixed", "failed", "stopped"], `${entry.file.relativePath}.kind`);
  nonEmptyText(entry.value.summary, `${entry.file.relativePath}.summary`);
  for (const field of ["observations", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
  plainArray(entry.value.measurements, `${entry.file.relativePath}.measurements`).forEach((measurement, index) => {
    exactFields(measurement, MEASUREMENT_FIELDS, `${entry.file.relativePath}.measurements[${index}]`);
    nonEmptyText(measurement.metric, `${entry.file.relativePath}.measurements[${index}].metric`);
    if (!["string", "number", "boolean"].includes(typeof measurement.value) || (typeof measurement.value === "number" && !Number.isFinite(measurement.value))) throw new Error(`${entry.file.relativePath}.measurements[${index}].value is invalid.`);
    for (const field of ["unit", "condition", "denominatorRef", "note"]) if (measurement[field] !== undefined) nonEmptyText(measurement[field], `${entry.file.relativePath}.measurements[${index}].${field}`);
  });
  plainObject(entry.value.denominator, `${entry.file.relativePath}.denominator`);
  plainArray(entry.value.hypothesisImpacts, `${entry.file.relativePath}.hypothesisImpacts`).forEach((impact, index) => {
    exactFields(impact, HYPOTHESIS_IMPACT_FIELDS, `${entry.file.relativePath}.hypothesisImpacts[${index}]`);
    nonEmptyText(impact.hypothesisRef, `${entry.file.relativePath}.hypothesisImpacts[${index}].hypothesisRef`);
    enumeration(impact.impact, ["supports", "weakens", "refutes", "mixed", "unchanged", "inconclusive"], `${entry.file.relativePath}.hypothesisImpacts[${index}].impact`);
    nonEmptyText(impact.rationale, `${entry.file.relativePath}.hypothesisImpacts[${index}].rationale`);
  });
  plainArray(entry.value.claimImpacts, `${entry.file.relativePath}.claimImpacts`).forEach((impact, index) => {
    exactFields(impact, CLAIM_IMPACT_FIELDS, `${entry.file.relativePath}.claimImpacts[${index}]`);
    researchId(impact.claimId, `${entry.file.relativePath}.claimImpacts[${index}].claimId`);
    enumeration(impact.impact, ["supports", "weakens", "refutes", "mixed", "unchanged", "inconclusive"], `${entry.file.relativePath}.claimImpacts[${index}].impact`);
    nonEmptyText(impact.rationale, `${entry.file.relativePath}.claimImpacts[${index}].rationale`);
  });
  exactTimestamp(entry.value.recordedAt, `${entry.file.relativePath}.recordedAt`);
  return { kind: "result", id: experimentId };
}

function validateClaimEntry(entry) {
  exactFields(entry.value, CLAIM_FIELDS, entry.file.relativePath);
  const claimId = researchId(entry.value.claimId, `${entry.file.relativePath}.claimId`);
  assertFilename(entry.file, `${claimId}.json`, "Claim");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  for (const field of ["statement", "storyRole"]) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
  for (const field of ["supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "artifactRefs"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`);
  enumeration(entry.value.assessment, ["supported", "weakened", "refuted", "inconclusive", "blocked"], `${entry.file.relativePath}.assessment`);
  if (entry.value.supersedesClaimId !== null) researchId(entry.value.supersedesClaimId, `${entry.file.relativePath}.supersedesClaimId`);
  nullableText(entry.value.revisionReason, `${entry.file.relativePath}.revisionReason`);
  exactTimestamp(entry.value.recordedAt, `${entry.file.relativePath}.recordedAt`);
  return claimId;
}

function validateReviewArtifact(value, label) {
  exactFields(value, REVIEW_ARTIFACT_FIELDS, label);
  nonEmptyText(value.path, `${label}.path`);
  if (!SHA256.test(value.sha256)) throw new Error(`${label}.sha256 must be a lowercase SHA-256 digest.`);
}

function validateReviewExchangeEntry(entry) {
  exactFields(entry.value, REVIEW_EXCHANGE_FIELDS, entry.file.relativePath);
  const exchangeId = researchId(entry.value.exchangeId, `${entry.file.relativePath}.exchangeId`);
  assertFilename(entry.file, `${exchangeId}.json`, "ReviewExchange");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  plainArray(entry.value.artifacts, `${entry.file.relativePath}.artifacts`).forEach((artifact, index) => validateReviewArtifact(artifact, `${entry.file.relativePath}.artifacts[${index}]`));
  if (entry.value.artifacts.length === 0) throw new Error(`${entry.file.relativePath}.artifacts must not be empty.`);
  exactTimestamp(entry.value.preparedAt, `${entry.file.relativePath}.preparedAt`);
  return exchangeId;
}

function validateReviewEntry(entry) {
  exactFields(entry.value, REVIEW_FIELDS, entry.file.relativePath);
  const reviewId = researchId(entry.value.reviewId, `${entry.file.relativePath}.reviewId`);
  const exchangeId = researchId(entry.value.exchangeId, `${entry.file.relativePath}.exchangeId`);
  if (reviewId !== exchangeId) throw new Error(`${entry.file.relativePath} reviewId must match exchangeId.`);
  assertFilename(entry.file, `${exchangeId}.json`, "Review");
  researchId(entry.value.missionId, `${entry.file.relativePath}.missionId`);
  plainArray(entry.value.artifacts, `${entry.file.relativePath}.artifacts`).forEach((artifact, index) => validateReviewArtifact(artifact, `${entry.file.relativePath}.artifacts[${index}]`));
  if (entry.value.artifacts.length === 0) throw new Error(`${entry.file.relativePath}.artifacts must not be empty.`);
  enumeration(entry.value.status, ["completed", "blocked", "failed"], `${entry.file.relativePath}.status`);
  enumeration(entry.value.verdict, ["coherent", "needs-revision", "needs-evidence", "blocked"], `${entry.file.relativePath}.verdict`);
  for (const field of ["summary", "report"]) nonEmptyText(entry.value[field], `${entry.file.relativePath}.${field}`);
  for (const field of ["rubric", "actionItems", "limitations"]) stringArray(entry.value[field], `${entry.file.relativePath}.${field}`, field === "rubric" ? 1 : 0);
  plainArray(entry.value.findings, `${entry.file.relativePath}.findings`).forEach((finding, index) => {
    exactFields(finding, new Set(["findingId", "severity", "summary", "linkedArtifactPaths"]), `${entry.file.relativePath}.findings[${index}]`);
    researchId(finding.findingId, `${entry.file.relativePath}.findings[${index}].findingId`);
    enumeration(finding.severity, ["low", "medium", "high"], `${entry.file.relativePath}.findings[${index}].severity`);
    nonEmptyText(finding.summary, `${entry.file.relativePath}.findings[${index}].summary`);
    stringArray(finding.linkedArtifactPaths, `${entry.file.relativePath}.findings[${index}].linkedArtifactPaths`, 1);
  });
  plainObject(entry.value.provenance, `${entry.file.relativePath}.provenance`);
  exactTimestamp(entry.value.reviewedAt, `${entry.file.relativePath}.reviewedAt`);
  return exchangeId;
}

function validateDirectionEntry(entry) {
  exactFields(entry.value, DIRECTION_FIELDS, entry.file.relativePath);
  const decisionId = researchId(entry.value.decisionId, `${entry.file.relativePath}.decisionId`);
  assertFilename(entry.file, `${decisionId}.json`, "Direction Decision");
  for (const field of ["priorDirection", "nextDirection"]) {
    exactFields(entry.value[field], DIRECTION_VALUE_FIELDS, `${entry.file.relativePath}.${field}`);
    for (const directionField of DIRECTION_VALUE_FIELDS) nonEmptyText(entry.value[field][directionField], `${entry.file.relativePath}.${field}.${directionField}`);
  }
  nonEmptyText(entry.value.reason, `${entry.file.relativePath}.reason`);
  stringArray(entry.value.evidenceRefs, `${entry.file.relativePath}.evidenceRefs`, 1);
  stringArray(entry.value.missionRefs, `${entry.file.relativePath}.missionRefs`, 1).forEach((missionId, index) => researchId(missionId, `${entry.file.relativePath}.missionRefs[${index}]`));
  exactTimestamp(entry.value.decidedAt, `${entry.file.relativePath}.decidedAt`);
  return decisionId;
}

function uniqueIds(entries, validator, label) {
  const ids = new Set();
  for (const entry of entries) {
    const id = validator(entry);
    if (ids.has(id)) throw new Error(`legacy JSON research export found duplicate ${label} identifier: ${id}.`);
    ids.add(id);
  }
  return ids;
}

function validateV2Records(workspace, raw) {
  validateWorkspace(workspace);
  const missionKinds = raw.missions.map((entry) => ({ entry, ...validateMissionEntry(entry) }));
  const missionEntries = missionKinds.filter(({ kind }) => kind === "mission").map(({ entry }) => entry);
  const conclusionEntries = missionKinds.filter(({ kind }) => kind === "conclusion").map(({ entry }) => entry);
  const missionIds = uniqueIds(missionEntries, (entry) => entry.value.missionId, "Mission");
  const conclusionIds = uniqueIds(conclusionEntries, (entry) => entry.value.missionId, "Mission conclusion");
  for (const missionId of conclusionIds) if (!missionIds.has(missionId)) throw new Error(`Mission conclusion ${missionId} has no matching Mission.`);
  for (const entry of missionEntries) {
    const references = [...entry.value.dependsOnMissionIds, ...(entry.value.parentMissionId === null ? [] : [entry.value.parentMissionId])];
    for (const reference of references) if (!missionIds.has(reference)) throw new Error(`${entry.file.relativePath} references unknown Mission ${reference}.`);
  }
  const experimentKinds = raw.experiments.map((entry) => ({ entry, ...validateExperimentEntry(entry) }));
  const planEntries = experimentKinds.filter(({ kind }) => kind === "plan").map(({ entry }) => entry);
  const resultEntries = experimentKinds.filter(({ kind }) => kind === "result").map(({ entry }) => entry);
  const planIds = uniqueIds(planEntries, (entry) => entry.value.experimentId, "Experiment plan");
  const resultIds = uniqueIds(resultEntries, (entry) => entry.value.experimentId, "Experiment result");
  const planById = new Map(planEntries.map((entry) => [entry.value.experimentId, entry.value]));
  for (const entry of resultEntries) {
    const plan = planById.get(entry.value.experimentId);
    if (!plan) throw new Error(`Experiment result ${entry.value.experimentId} has no matching prospective plan.`);
    if (plan.missionId !== entry.value.missionId) throw new Error(`Experiment result ${entry.value.experimentId} does not match its plan Mission.`);
    for (const impact of entry.value.hypothesisImpacts) if (!plan.hypothesisRefs.includes(impact.hypothesisRef)) throw new Error(`${entry.file.relativePath} references a hypothesis absent from its plan: ${impact.hypothesisRef}.`);
  }
  for (const experimentId of resultIds) if (!planIds.has(experimentId)) throw new Error(`Experiment result ${experimentId} has no matching prospective plan.`);
  const sourceIds = uniqueIds(raw.sources, validateSourceEntry, "Source");
  const claimIds = uniqueIds(raw.claims, validateClaimEntry, "Claim");
  for (const entry of [...missionEntries, ...conclusionEntries, ...raw.sources, ...raw.claims, ...planEntries, ...resultEntries, ...raw.reviewExchanges, ...raw.reviews]) {
    if (Object.hasOwn(entry.value, "missionId") && !missionIds.has(entry.value.missionId)) throw new Error(`${entry.file.relativePath} references unknown Mission ${entry.value.missionId}.`);
  }
  for (const entry of conclusionEntries) {
    for (const sourceId of entry.value.sourceIds) if (!sourceIds.has(sourceId)) throw new Error(`${entry.file.relativePath} references unknown Source ${sourceId}.`);
    for (const experimentId of entry.value.experimentIds) if (!resultIds.has(experimentId)) throw new Error(`${entry.file.relativePath} references Experiment ${experimentId} without a result.`);
    for (const claimId of entry.value.claimIds) if (!claimIds.has(claimId)) throw new Error(`${entry.file.relativePath} references unknown Claim ${claimId}.`);
  }
  for (const entry of raw.claims) if (entry.value.supersedesClaimId !== null && !claimIds.has(entry.value.supersedesClaimId)) throw new Error(`${entry.file.relativePath} supersedes unknown Claim ${entry.value.supersedesClaimId}.`);
  for (const entry of resultEntries) for (const impact of entry.value.claimImpacts) if (!claimIds.has(impact.claimId)) throw new Error(`${entry.file.relativePath} references unknown Claim ${impact.claimId}.`);
  uniqueIds(raw.directionDecisions, validateDirectionEntry, "Direction Decision");
  for (const entry of raw.directionDecisions) for (const missionId of entry.value.missionRefs) if (!missionIds.has(missionId)) throw new Error(`${entry.file.relativePath} references unknown Mission ${missionId}.`);
  const exchangeIds = uniqueIds(raw.reviewExchanges, validateReviewExchangeEntry, "ReviewExchange");
  const reviewIds = uniqueIds(raw.reviews, validateReviewEntry, "Review");
  const exchangeById = new Map(raw.reviewExchanges.map((entry) => [entry.value.exchangeId, entry.value]));
  for (const entry of raw.reviews) {
    const exchange = exchangeById.get(entry.value.exchangeId);
    if (!exchange) throw new Error(`Review ${entry.value.exchangeId} has no matching ReviewExchange.`);
    if (entry.value.missionId !== exchange.missionId || JSON.stringify(entry.value.artifacts) !== JSON.stringify(exchange.artifacts)) throw new Error(`${entry.file.relativePath} does not match its ReviewExchange scope.`);
  }
  for (const exchangeId of reviewIds) if (!exchangeIds.has(exchangeId)) throw new Error(`Review ${exchangeId} has no matching ReviewExchange.`);
}

function directoryDeleteEntries(anchor) {
  return [...RECORD_DIRECTORY_PATHS].reverse().map((relativePath) => ({
    relativePath,
    state: fileState(anchor, relativePath)
  }));
}

function valueText(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value;
  if (["number", "boolean"].includes(typeof value)) return String(value);
  return `\`${JSON.stringify(value)}\``;
}

function section(title, value) {
  const text = valueText(value);
  return text === null ? "" : `\n## ${title}\n\n${text}\n`;
}

function bulletSection(title, value) {
  if (!Array.isArray(value) || value.length === 0) return "";
  return `\n## ${title}\n\n${value.map((item) => `- ${valueText(item)}`).join("\n")}\n`;
}

function readableName(value, fallback) {
  const raw = [value?.title, value?.goal, value?.statement, value?.summary, value?.missionId, value?.experimentId, value?.sourceId, value?.exchangeId, value?.reviewId, value?.decisionId, fallback].find((item) => typeof item === "string" && item.trim());
  const normalized = raw.normalize("NFKC").trim().replace(SAFE_FILE_PART, "-").replace(/^-+|-+$/gu, "").slice(0, 80);
  return normalized || fallback;
}

function uniquePath(directory, base, used) {
  let suffix = 1;
  let relativePath = `${directory}/${base}.md`;
  while (used.has(relativePath)) {
    suffix += 1;
    relativePath = `${directory}/${base}-${suffix}.md`;
  }
  used.add(relativePath);
  return relativePath;
}

function renderObject(title, value, fields) {
  let markdown = `# ${title}\n`;
  for (const [field, heading] of fields) {
    markdown += Array.isArray(value?.[field]) ? bulletSection(heading, value[field]) : section(heading, value?.[field]);
  }
  return `${markdown.trimEnd()}\n`;
}

function renderMission(value, conclusion) {
  let markdown = renderObject(readableName(value, "Mission"), value, [
    ["goal", "Goal"], ["requirements", "Requirements"], ["assumptions", "Assumptions"], ["scope", "Scope"], ["outOfScope", "Out of scope"], ["evidenceRequirements", "Evidence needs"], ["competingHypotheses", "Competing hypotheses"], ["openQuestions", "Open questions"], ["contextRefs", "Related material"], ["branchReason", "Branch context"], ["contributionRole", "Contribution role"]
  ]);
  if (conclusion) markdown += `\n${renderObject("Recorded conclusion", conclusion, [["outcome", "Outcome"], ["synthesis", "Synthesis"], ["failures", "Failures"], ["limitations", "Limitations"], ["uncertainty", "Uncertainty"], ["recommendedBranches", "Recommended next work"]])}`;
  return markdown;
}

function renderExperiment(plan, result) {
  let markdown = renderObject(readableName(plan ?? result, "Experiment"), plan ?? {}, [
    ["title", "Why this experiment matters"], ["hypothesisRefs", "Hypotheses or competing explanations"], ["protocol", "Prospective protocol"], ["inputs", "Inputs"], ["comparisons", "Comparisons"], ["metrics", "Metrics"], ["discriminatingObservations", "Discriminating observations"], ["successConditions", "Success conditions"], ["stopConditions", "Stop conditions"], ["constraints", "Constraints"], ["expectedArtifacts", "Expected artifacts"], ["cost", "Cost"], ["risk", "Risk"], ["failureValue", "Failure value"]
  ]);
  if (result) markdown += `\n${renderObject("Actual execution and result", result, [["kind", "Recorded outcome"], ["summary", "Summary"], ["observations", "Observations"], ["measurements", "Measurements"], ["denominator", "Denominator"], ["hypothesisImpacts", "Hypothesis impacts"], ["claimImpacts", "Claim impacts"], ["unexpectedObservations", "Unexpected observations"], ["artifactRefs", "Artifacts"], ["failures", "Failures"], ["deviations", "Deviations"], ["limitations", "Limitations"], ["uncertainty", "Uncertainty"]])}`;
  return markdown;
}

function renderSource(value) {
  return renderObject(readableName(value, "Source"), value, [["citationKey", "Citation key"], ["title", "Title"], ["authors", "Authors"], ["year", "Year"], ["locator", "Locator"], ["sourceType", "Source type"], ["summary", "What was learned"], ["conditions", "Conditions"], ["relationship", "Relationship to the work"], ["conflicts", "Conflicts"], ["limitations", "Limitations"], ["capture", "Preserved capture"]]);
}

function renderClaim(value) {
  return renderObject(readableName(value, "Claim"), value, [["statement", "Claim"], ["supportRefs", "Recorded support"], ["counterEvidenceRefs", "Recorded counter-evidence"], ["missingEvidence", "Missing evidence"], ["cannotSay", "Cannot say"], ["uncertainty", "Uncertainty"], ["assessment", "Former assessment"], ["storyRole", "Role in the argument"], ["artifactRefs", "Related artifacts"], ["revisionReason", "Revision context"]]);
}

function renderDirection(value) {
  return renderObject(readableName(value, "Direction-change"), value, [["priorDirection", "Previous direction"], ["nextDirection", "Next direction"], ["reason", "Why it changed"], ["evidenceRefs", "Recorded evidence"], ["missionRefs", "Related work"]]);
}

function renderReview(exchange, review) {
  const source = exchange ?? review ?? {};
  let markdown = renderObject(readableName(source, "Review"), source, [["artifacts", "Declared artifact scope"], ["preparedAt", "Prepared at"]]);
  if (review) markdown += `\n${renderObject("Returned review", review, [["status", "Recorded status"], ["verdict", "Former verdict"], ["summary", "Summary"], ["rubric", "Rubric"], ["findings", "Findings"], ["actionItems", "Action items"], ["report", "Original report"], ["provenance", "Reported provenance"], ["limitations", "Limitations"]])}`;
  else markdown += "\n## Review return\n\nNo returned review was present in the legacy JSON research state.\n";
  return markdown;
}

function overview(workspace, links, directions) {
  const lines = ["# Research overview", "", "## Current research", "", workspace.researchQuestion ?? "Not recorded.", "", "## Mainline", "", workspace.mainline ?? "Not recorded."];
  if (workspace.contributionIntent) lines.push("", "## Contribution target", "", workspace.contributionIntent);
  if (workspace.currentFocus) lines.push("", "## Current focus", "", workspace.currentFocus);
  if (links.length > 0) lines.push("", "## Exported documents", "", ...links.map((entry) => `- [${entry.label}](${entry.link})`));
  if (directions.length > 0) lines.push("", "## Recorded direction changes", "", ...directions.map((entry) => `- [${entry.label}](${entry.link})`));
  lines.push("", "## Export note", "", "This overview was mechanically exported from legacy Dove JSON research records. Review the documents, repair natural links and names, and do not treat the export as scientific validation.", "");
  return lines.join("\n");
}

function relativeLink(from, to) {
  return path.posix.relative(path.posix.dirname(from), to);
}

export function previewResearchExport(start, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const root = canonicalRoot(start, fsOps);
  const anchor = openRootedFilesystem(root, { ...options, fsOps });
  const required = new Map(REQUIRED_FILES.map((relativePath) => [relativePath, readRequired(anchor, relativePath)]));
  const marker = strictJson(required.get(".dove/format.json"));
  if (!marker || marker.format !== V2_FORMAT || Object.keys(marker).length !== 1) throw new Error(`Research export accepts only an exact ${V2_FORMAT} marker.`);
  const workspace = strictJson(required.get(".dove/workspace.json"));
  const lessonsBytes = required.get(".dove/LESSONS.md").bytes;
  let lessonsText;
  try {
    lessonsText = new TextDecoder("utf-8", { fatal: true }).decode(lessonsBytes);
  } catch (error) {
    throw new Error(".dove/LESSONS.md must contain valid UTF-8 Markdown.", { cause: error });
  }
  if (lessonsText.includes("\0")) throw new Error(".dove/LESSONS.md contains null bytes.");

  const raw = Object.fromEntries(RECORD_DIRECTORIES.map(([directory, key]) => [key, listJson(anchor, `.dove/${directory}`).map((file) => ({ file, value: strictJson(file) }))]));
  validateV2Records(workspace, raw);
  const archiveStamp = timestamp(options.now);
  const archiveDirectory = `${ARCHIVE_ROOT}/research-format-v2-${archiveStamp}`;
  if (fileState(anchor, archiveDirectory).exists) throw new Error(`Research export archive already exists: ${archiveDirectory}.`);
  const researchRootState = fileState(anchor, NEW_ROOT);
  if (researchRootState.exists && researchRootState.type !== "directory") throw new Error(`${NEW_ROOT} must be a real directory when legacy research is exported additively.`);

  const defaults = prepareResearchDefaults(root, {
    ...options,
    fsOps,
    label: "Dove research export defaults",
    additionalLessonTexts: [lessonsText]
  });
  const used = new Set(RESEARCH_DEFAULT_FILE_PATHS);
  if (researchRootState.exists) {
    const targetDirectories = new Set(RECORD_DIRECTORIES.map(([directory]) => (
      directory === "review-exchanges" ? "reviews" : directory === "direction-decisions" ? "missions" : directory
    )));
    for (const targetDirectory of targetDirectories) {
      const relativeDirectory = `${NEW_ROOT}/${targetDirectory}`;
      const directoryState = fileState(anchor, relativeDirectory);
      if (!directoryState.exists) continue;
      if (directoryState.type !== "directory") throw new Error(`${relativeDirectory} must be a real directory when legacy research is exported additively.`);
      for (const entry of anchor.readdir(relativeDirectory, { withFileTypes: true })) {
        const relativePath = `${relativeDirectory}/${entry.name}`;
        if (entry.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
        if (entry.isFile() || entry.isDirectory()) used.add(relativePath);
        else throw new Error(`${relativePath} has an unsupported file type.`);
      }
    }
  }
  const documents = [];
  const links = [];
  const directions = [];
  const add = (directory, value, fallback, content, collection = links) => {
    const target = uniquePath(`${NEW_ROOT}/${directory}`, readableName(value, fallback), used);
    documents.push({ relativePath: target, content });
    collection.push({
      label: readableName(value, fallback),
      target,
      link: relativeLink(`${NEW_ROOT}/RESEARCH.md`, target)
    });
    return target;
  };

  const conclusionByMission = new Map(raw.missions.filter((entry) => entry.file.relativePath.endsWith(".conclusion.json")).map((entry) => [entry.value?.missionId, entry.value]));
  for (const entry of raw.missions.filter((item) => !item.file.relativePath.endsWith(".conclusion.json"))) add("missions", entry.value, "Mission", renderMission(entry.value, conclusionByMission.get(entry.value?.missionId)));
  const resultByExperiment = new Map(raw.experiments.filter((entry) => entry.file.relativePath.endsWith(".result.json")).map((entry) => [entry.value?.experimentId, entry.value]));
  for (const entry of raw.experiments.filter((item) => item.file.relativePath.endsWith(".plan.json"))) add("experiments", entry.value, "Experiment", renderExperiment(entry.value, resultByExperiment.get(entry.value?.experimentId)));
  for (const entry of raw.sources) add("sources", entry.value, "Source", renderSource(entry.value));
  for (const entry of raw.claims) add("claims", entry.value, "Claim", renderClaim(entry.value));
  for (const entry of raw.directionDecisions) add("missions", entry.value, "Direction-change", renderDirection(entry.value), directions);
  const reviewByExchange = new Map(raw.reviews.map((entry) => [entry.value?.exchangeId ?? entry.value?.reviewId, entry.value]));
  const exchangeIds = new Set();
  for (const entry of raw.reviewExchanges) { exchangeIds.add(entry.value?.exchangeId); add("reviews", entry.value, "Review", renderReview(entry.value, reviewByExchange.get(entry.value?.exchangeId))); }
  for (const entry of raw.reviews.filter((item) => !exchangeIds.has(item.value?.exchangeId ?? item.value?.reviewId))) add("reviews", entry.value, "Review", renderReview(null, entry.value));

  const desiredWrites = new Map(defaults.plan.writes);
  const desiredDeletes = new Set(defaults.plan.deletes);
  const stateFor = (relativePath) => defaults.snapshot.states.get(relativePath) ?? {
    exists: false,
    type: "absent",
    bytes: null,
    text: null,
    sha256: null,
    mode: null
  };
  const currentText = (relativePath) => desiredWrites.has(relativePath)
    ? new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(desiredWrites.get(relativePath))
    : stateFor(relativePath).text;
  const setDesired = (relativePath, content) => {
    const bytes = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), "utf8");
    const state = stateFor(relativePath);
    if (state.exists && state.bytes.equals(bytes)) desiredWrites.delete(relativePath);
    else desiredWrites.set(relativePath, bytes);
  };

  const overviewPath = RESEARCH_DEFAULT_PATHS.overview;
  const exportedOverview = overview(workspace, links, directions);
  setDesired(
    overviewPath,
    appendExactMarkdownBlocks(currentText(overviewPath) ?? "", [exportedOverview])
  );

  const summaryLinks = new Map([
    ["missions", []],
    ["experiments", []],
    ["sources", []],
    ["reviews", []],
    ["claims", []]
  ]);
  for (const link of [...links, ...directions]) {
    const directory = path.posix.basename(path.posix.dirname(link.target));
    summaryLinks.get(directory)?.push(`- [${link.label}](${relativeLink(RESEARCH_DEFAULT_PATHS[`${directory}Summary`], link.target)})`);
  }
  for (const [directory, lines] of summaryLinks) {
    if (lines.length === 0) continue;
    const summaryPath = RESEARCH_DEFAULT_PATHS[`${directory}Summary`];
    setDesired(
      summaryPath,
      appendExactMarkdownLines(currentText(summaryPath) ?? "", "## Imported legacy documents", lines)
    );
  }

  const importedLessonsPath = RESEARCH_DEFAULT_PATHS.importedLessons;
  const importedState = stateFor(importedLessonsPath);
  if (!importedState.exists) setDesired(importedLessonsPath, lessonsBytes);
  else setDesired(importedLessonsPath, appendExactMarkdownBytes(importedState.bytes, lessonsBytes));
  const lessonsSummaryPath = RESEARCH_DEFAULT_PATHS.lessonsSummary;
  setDesired(
    lessonsSummaryPath,
    appendExactMarkdownLines(currentText(lessonsSummaryPath) ?? "", "## Imported guidance", [IMPORTED_LESSONS_LINK])
  );

  documents.unshift(...[...desiredWrites.entries()].map(([relativePath, content]) => ({
    relativePath,
    content,
    expectedState: stateFor(relativePath)
  })));

  const oldFiles = [...required.values(), ...Object.values(raw).flat().map((entry) => entry.file)];
  const oldDirectories = directoryDeleteEntries(anchor);
  const archiveFiles = oldFiles.map((file) => ({ relativePath: `${archiveDirectory}/${file.relativePath.slice(`${OLD_ROOT}/`.length)}`, content: file.bytes }));
  return {
    status: "ready",
    action: "export-research",
    target: root,
    from: V2_FORMAT,
    to: "markdown",
    researchDirectory: NEW_ROOT,
    archiveDirectory,
    writtenPaths: [...documents.map((entry) => entry.relativePath), ...archiveFiles.map((entry) => entry.relativePath)],
    archivedPaths: archiveFiles.map((entry) => entry.relativePath),
    plan: {
      documents,
      researchDeletes: [...desiredDeletes].map((relativePath) => ({
        relativePath,
        state: stateFor(relativePath)
      })),
      archiveFiles,
      sourceFiles: oldFiles.map((file) => ({ relativePath: file.relativePath, state: file.state })),
      sourceDirectories: oldDirectories
    }
  };
}
export function exportResearch(start, options = {}) {
  if (options.confirmed !== true) throw new Error("Research export requires confirmed: true after preview.");
  const preview = previewResearchExport(start, options);
  const entries = [
    ...preview.plan.documents.map((entry) => ({
      root: preview.target,
      relativePath: entry.relativePath,
      content: entry.content,
      force: entry.expectedState?.exists === true,
      expectedState: expectedTransactionState(entry.expectedState ?? { exists: false }),
      label: "Research Markdown export"
    })),
    ...preview.plan.researchDeletes.map((entry) => ({
      root: preview.target,
      relativePath: entry.relativePath,
      delete: true,
      force: true,
      expectedState: expectedTransactionState(entry.state),
      label: "Retired top-level research Lessons"
    })),
    ...preview.plan.archiveFiles.map((entry) => ({ root: preview.target, relativePath: entry.relativePath, content: entry.content, force: false, expectedState: { exists: false, type: "absent", sha256: null, mode: null }, label: "Legacy JSON research archive" })),
    ...preview.plan.sourceFiles.map((entry) => ({ root: preview.target, relativePath: entry.relativePath, delete: true, expectedState: entry.state, label: "Retired Dove legacy JSON research state" })),
    ...preview.plan.sourceDirectories.map((entry) => ({
      root: preview.target,
      relativePath: entry.relativePath,
      delete: true,
      deleteEmptyDirectory: entry.state.exists,
      expectedState: entry.state,
      label: "Retired legacy JSON research directory"
    }))
  ];
  const result = writeFileSetTransaction(entries, {
    ...options,
    transactionBase: ".dove/install/transactions"
  });
  return { status: "exported", action: preview.action, target: preview.target, from: preview.from, to: preview.to, researchDirectory: preview.researchDirectory, archiveDirectory: preview.archiveDirectory, ...result };
}
