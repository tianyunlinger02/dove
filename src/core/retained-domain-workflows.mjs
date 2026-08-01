import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  assertSealedDomainArgs, domainNonEmptyText, domainSafeId, domainStringArray, finalizeDomainArtifacts,
  readCurrentMission, resolveMissionArtifactReferences, resolveMissionValidationReference, stageConsolidatedDomainMutation
} from "./domain-artifacts.mjs";
import {
  CLAIM_RECORD_SCHEMA_VERSION, EXPERIMENT_RECORD_SCHEMA_VERSION, evidenceDigest,
  normalizeClaimContract, normalizeExperimentProtocol, normalizeExperimentResult
} from "./evidence-contracts.mjs";
import { resolveCurrentReviewFinding } from "./review-records.mjs";
import { evaluateSourceReferences } from "./source-trust.mjs";
import { readJson } from "./workspace.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

const CLAIM_FIELDS = new Set(["missionId", "claims"]);
const CLAIM_ITEM_FIELDS = new Set(["claimId", "text", "sourceIds", "artifactRefs", "validationRefs", "experimentEvidence", "uncertainty", "unsupportedExtensions", "currentAssessment"]);
const EXPERIMENT_FIELDS = new Set(["missionId", "experimentId", "title", "protocol", "result"]);
const ARCHIVE_FIELDS = new Set(["missionId", "artifactPath", "referencePaths", "qa", "findings"]);
const FIGURE_ARCHIVE_FIELDS = new Set([...ARCHIVE_FIELDS, "caption"]);
const REBUTTAL_ARCHIVE_FIELDS = new Set([...ARCHIVE_FIELDS, "findingRefs"]);
const SOURCE_LIMITATION = "Captured source material is current but not independently verified.";

function filePath(directory, id, suffix) { return path.posix.join(directory, `${id}.${suffix}.json`); }
function currentReadableRecord(root, relativePath, missionId, label) {
  const [reference] = resolveMissionArtifactReferences(root, missionId, [relativePath], `${label} artifact`);
  const current = readJson(root, relativePath, null);
  if (!current || current.missionId !== reference.missionId) throw new Error(`${label} is not a current readable record.`);
  return current;
}
function currentOwnedRecord(root, relativePath, missionId, label) {
  const current = currentReadableRecord(root, relativePath, missionId, label);
  if (current.missionId !== missionId) throw new Error(`${label} must remain owned by the exact mission that froze it.`);
  return current;
}
function typedEvidence(root, missionId, reference, label) {
  if (reference.startsWith("source:")) {
    const evaluation = evaluateSourceReferences(root, [reference.slice("source:".length)], missionId)[0];
    if (!evaluation?.eligible) throw new Error(`${label} is not usable current source evidence: ${evaluation?.reason ?? "unknown-source"}.`);
    return reference;
  }
  if (reference.startsWith("validation:")) {
    const validation = resolveMissionValidationReference(root, missionId, reference.slice("validation:".length), label);
    return `validation:${validation.reference}`;
  }
  const artifactPath = reference.startsWith("artifact:") ? reference.slice("artifact:".length) : reference;
  return `artifact:${resolveMissionArtifactReferences(root, missionId, [artifactPath], label)[0].path}`;
}
function evidenceRefs(root, missionId, values, label) {
  return domainStringArray(values, label).map((reference, index) => typedEvidence(root, missionId, reference, `${label}[${index}]`));
}
function experimentRecords(root, missionId, experimentId) {
  const plan = currentReadableRecord(root, filePath(".dove/experiments", experimentId, "plan"), missionId, `Experiment plan ${experimentId}`);
  const result = currentReadableRecord(root, filePath(".dove/experiments", experimentId, "result"), missionId, `Experiment result ${experimentId}`);
  if (plan.schemaVersion !== EXPERIMENT_RECORD_SCHEMA_VERSION || result.schemaVersion !== EXPERIMENT_RECORD_SCHEMA_VERSION || plan.protocolDigest !== result.protocolDigest || evidenceDigest(plan.protocol) !== plan.protocolDigest) {
    throw new Error(`Experiment ${experimentId} does not bind a current immutable protocol and result.`);
  }
  return { plan, result };
}

export function upsertClaims(root, args = {}) {
  assertSealedDomainArgs(args, CLAIM_FIELDS, "upsert_claims");
  const { mission } = readCurrentMission(root, args.missionId, "Claim workflow");
  if (!Array.isArray(args.claims) || args.claims.length === 0) throw new Error("upsert_claims requires at least one claim.");
  const records = [];
  const writes = args.claims.map((item, index) => {
    const label = `claims[${index}]`;
    assertSealedDomainArgs(item, CLAIM_ITEM_FIELDS, label);
    const claimId = domainSafeId(item.claimId, `${label}.claimId`);
    const sourceIds = domainStringArray(item.sourceIds, `${label}.sourceIds`);
    const artifactRefs = domainStringArray(item.artifactRefs, `${label}.artifactRefs`).map((value) => `artifact:${value}`);
    const validationRefs = domainStringArray(item.validationRefs, `${label}.validationRefs`).map((value) => `validation:${value}`);
    const resolvedEvidence = evidenceRefs(root, mission.missionId, [...sourceIds.map((value) => `source:${value}`), ...artifactRefs, ...validationRefs], `${label}.evidenceRefs`);
    const contract = normalizeClaimContract({
      experimentEvidence: item.experimentEvidence ?? [], uncertainty: item.uncertainty,
      unsupportedExtensions: item.unsupportedExtensions, currentAssessment: item.currentAssessment
    }, label);
    if (resolvedEvidence.length === 0 && contract.experimentEvidence.length === 0) throw new Error(`${label} requires Source, artifact, validation, or Experiment evidence.`);
    if (sourceIds.length > 0 && !contract.uncertainty.includes(SOURCE_LIMITATION)) throw new Error(`${label}.uncertainty must state the explicit source limitation: ${SOURCE_LIMITATION}`);
    for (const [bindingIndex, binding] of contract.experimentEvidence.entries()) {
      const { plan, result } = experimentRecords(root, mission.missionId, binding.experimentId);
      if (!plan.protocol.metrics.includes(binding.metric)) throw new Error(`${label}.experimentEvidence[${bindingIndex}].metric is outside the frozen protocol.`);
      const measurement = result.measurements.find((entry) => entry.metric === binding.metric && entry.comparison === binding.comparison);
      if (!measurement || measurement.value !== binding.value) throw new Error(`${label}.experimentEvidence[${bindingIndex}] does not exactly match the referenced Experiment measurement.`);
    }
    const claim = {
      schemaVersion: CLAIM_RECORD_SCHEMA_VERSION,
      claimId,
      missionId: mission.missionId,
      contractDigest: mission.contractDigest,
      text: domainNonEmptyText(item.text, `${label}.text`),
      evidenceRefs: resolvedEvidence,
      ...contract,
      updatedAt: new Date().toISOString()
    };
    records.push(claim);
    return {
      path: path.posix.join(".dove/claims", `${claimId}.json`), kind: "data", content: `${JSON.stringify(claim, null, 2)}\n`,
      derivedReferences: [...resolvedEvidence, ...contract.experimentEvidence.map((entry) => `experiment-result:${entry.experimentId}`)]
    };
  });
  return { ...finalizeDomainArtifacts(root, { actionId: "upsert-claims", missionId: mission.missionId, summary: `Recorded ${writes.length} evidence-backed claim(s).`, writes }), claims: records };
}

function assertResultMatchesProtocol(result, protocol, label = "result") {
  for (const [index, measurement] of result.measurements.entries()) {
    if (!protocol.metrics.includes(measurement.metric)) throw new Error(`${label}.measurements[${index}].metric is outside the frozen protocol.`);
    if (measurement.comparison !== null && !protocol.comparisons.includes(measurement.comparison)) throw new Error(`${label}.measurements[${index}].comparison is outside the frozen protocol.`);
  }
}

export function runExperienceWorkflow(root, args = {}) {
  assertSealedDomainArgs(args, EXPERIMENT_FIELDS, "run_experience_workflow");
  const { mission } = readCurrentMission(root, args.missionId, "Experiment workflow");
  const experimentId = domainSafeId(args.experimentId, "experimentId");
  const protocol = normalizeExperimentProtocol(args.protocol);
  const protocolDigest = evidenceDigest(protocol);
  const planPath = filePath(".dove/experiments", experimentId, "plan");
  if (!fs.existsSync(path.resolve(root, planPath))) {
    if (args.result !== undefined) throw new Error("Freeze the formal experiment protocol in a prior transaction before recording a result.");
    const plan = { schemaVersion: EXPERIMENT_RECORD_SCHEMA_VERSION, experimentId, missionId: mission.missionId, title: typeof args.title === "string" && args.title.trim() ? args.title.trim() : experimentId, protocol, protocolDigest, updatedAt: protocol.frozenAt };
    return { ...finalizeDomainArtifacts(root, { actionId: "run-experience-workflow", missionId: mission.missionId, summary: `Froze formal experiment protocol ${experimentId}.`, writes: [{ path: planPath, kind: "data", content: `${JSON.stringify(plan, null, 2)}\n`, derivedReferences: [] }] }), plan, result: null, hostBoundary: { executesExperiment: false, mintsIndependentAuthority: false } };
  }
  const plan = currentOwnedRecord(root, planPath, mission.missionId, `Experiment plan ${experimentId}`);
  if (plan.schemaVersion !== EXPERIMENT_RECORD_SCHEMA_VERSION || plan.protocolDigest !== protocolDigest || evidenceDigest(plan.protocol) !== protocolDigest) throw new Error("Experiment protocol is immutable once frozen; result recording must replay the exact protocol.");
  if (args.result === undefined) throw new Error("A frozen experiment protocol already exists; recording now requires a result.");
  const resultPath = filePath(".dove/experiments", experimentId, "result");
  if (fs.existsSync(path.resolve(root, resultPath))) throw new Error("Experiment result is immutable once recorded; use a new experimentId for another run.");
  const normalized = normalizeExperimentResult({
    ...args.result,
    artifactRefs: evidenceRefs(root, mission.missionId, args.result.artifactRefs.map((value) => `artifact:${value}`), "result.artifactRefs"),
    validationRefs: evidenceRefs(root, mission.missionId, args.result.validationRefs.map((value) => `validation:${value}`), "result.validationRefs"),
    failures: args.result.failures.map((failure, index) => ({ ...failure, evidenceRefs: evidenceRefs(root, mission.missionId, failure.evidenceRefs, `result.failures[${index}].evidenceRefs`) }))
  });
  assertResultMatchesProtocol(normalized, plan.protocol);
  const result = { schemaVersion: EXPERIMENT_RECORD_SCHEMA_VERSION, resultId: experimentId, experimentId, missionId: mission.missionId, protocolDigest, ...normalized };
  result.resultDigest = evidenceDigest(result);
  return { ...finalizeDomainArtifacts(root, { actionId: "run-experience-workflow", missionId: mission.missionId, summary: `Recorded formal experiment ${experimentId} result with failures and limitations preserved.`, writes: [{ path: resultPath, kind: "data", content: `${JSON.stringify(result, null, 2)}\n`, derivedReferences: [...new Set([...result.artifactRefs, ...result.validationRefs, ...result.failures.flatMap((failure) => failure.evidenceRefs)])] }] }), plan, result, hostBoundary: { executesExperiment: false, mintsIndependentAuthority: false } };
}

function archiveArtifact(root, actionId, label, args, fields, prepareSpecializedFields = () => ({})) {
  assertSealedDomainArgs(args, fields, label);
  const { mission } = readCurrentMission(root, args.missionId, label);
  const [artifact] = resolveMissionArtifactReferences(root, mission.missionId, [args.artifactPath], `${label}.artifactPath`);
  if (artifact.missionId !== mission.missionId) throw new Error(`${label}.artifactPath must be currently owned by the exact recording mission.`);
  const references = resolveMissionArtifactReferences(root, mission.missionId, args.referencePaths ?? [], `${label}.referencePaths`);
  const qa = domainStringArray(args.qa, `${label}.qa`);
  const findings = domainStringArray(args.findings, `${label}.findings`);
  const specializedFields = prepareSpecializedFields(mission);
  const staged = stageConsolidatedDomainMutation(root, {
    actionId, missionId: mission.missionId, operation: label,
    receiptId: `receipt-${actionId}-${crypto.randomUUID()}`, producedAt: new Date().toISOString(),
    summary: `${label} archived current project artifact ${artifact.path}; QA and findings remain non-authoritative annotations.`,
    externalArtifacts: [{ path: artifact.path, kind: artifact.kind, sha256: artifact.sha256, derivedReferences: references.map((item) => `artifact:${item.path}`) }], writes: []
  });
  return { status: "recorded", missionId: mission.missionId, artifact, references, qa, findings, ...specializedFields, receipt: staged.receipt, artifacts: staged.artifacts, writes: staged.writes };
}

export function recordDoveDraft(root, args = {}) {
  return archiveArtifact(root, "record-dove-draft", "Draft archive", args, ARCHIVE_FIELDS);
}
export function recordDoveFigure(root, args = {}) {
  return archiveArtifact(root, "record-dove-figure", "Figure archive", args, FIGURE_ARCHIVE_FIELDS, () => ({
    caption: domainNonEmptyText(args.caption, "Figure archive.caption")
  }));
}
function currentFindingReference(root, missionId, reference, label) {
  const separator = reference.lastIndexOf("#");
  if (separator <= 0 || separator === reference.length - 1) throw new Error(`${label} must use <current-artifact-path>#<finding-id>.`);
  const artifactPath = reference.slice(0, separator);
  const findingId = domainSafeId(reference.slice(separator + 1), `${label} findingId`);
  const resolved = resolveCurrentReviewFinding(root, { missionId, reviewPath: artifactPath, findingId });
  if (!resolved) throw new Error(`${label} does not resolve to a preserved finding in a current non-authoritative Review archive.`);
  return { reference: `${resolved.reviewPath}#${findingId}`, finding: resolved.finding, authoritative: false };
}
export function recordDoveRebuttal(root, args = {}) {
  return archiveArtifact(root, "record-dove-rebuttal", "Rebuttal archive", args, REBUTTAL_ARCHIVE_FIELDS, (mission) => ({
    findingRefs: domainStringArray(args.findingRefs, "Rebuttal archive.findingRefs", { minItems: 1 })
      .map((reference, index) => currentFindingReference(root, mission.missionId, reference, `Rebuttal archive.findingRefs[${index}]`)),
    reviewerSignoff: false
  }));
}

export function queryDomainIntegrity(root, missionId = null) {
  const workspace = openDoveWorkspace(root, { operation: "Domain integrity query" });
  const prefixes = [".dove/sources/", ".dove/claims/", ".dove/experiments/"];
  const domainArtifacts = workspace.receiptLedger.currentOwnership.filter((item) => prefixes.some((prefix) => item.path.startsWith(prefix))).filter((item) => !missionId || item.missionId === missionId);
  const stale = domainArtifacts.filter((item) => !fs.existsSync(path.resolve(root, item.path)));
  return { workspaceId: workspace.manifest.workspaceId, missionId, artifactCount: domainArtifacts.length, staleArtifactCount: stale.length, stalePaths: stale.map((item) => item.path) };
}
