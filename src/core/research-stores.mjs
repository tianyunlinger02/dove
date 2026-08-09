import fs from "node:fs";
import path from "node:path";

import { snapshotReviewedArtifacts, stableSnapshotSetHash, verifyReviewSnapshotSet } from "./review-artifact-snapshot.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import {
  assertFields, assertPlainObject, enumeration, exactTimestamp, newResearchId, nonEmptyText, normalizedRelativePath,
  readResearchJson, readResearchText, researchId, sha256, stringArray, writeResearchFileAtomic, writeResearchJsonAtomic
} from "./research-records.mjs";
import { openDoveWorkspace, validateLessonsMarkdown, validateWorkspaceRecord } from "./workspace-schema.mjs";

export const EXPERIMENT_RESULT_KINDS = Object.freeze(["positive", "negative", "null", "mixed", "failed", "stopped"]);
export const CLAIM_ASSESSMENTS = Object.freeze(["supported", "weakened", "refuted", "inconclusive", "blocked"]);
export const SOURCE_RELATIONSHIPS = Object.freeze(["consensus", "conflict", "condition-specific", "uncovered", "testable-gap"]);
export const REVIEW_STATUSES = Object.freeze(["completed", "blocked", "failed"]);

const MISSION_FIELDS = new Set(["missionId", "parentMissionId", "dependsOnMissionIds", "branchKind", "branchReason", "goal", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs", "contributionRole", "createdAt"]);
const CONCLUSION_FIELDS = new Set(["missionId", "synthesis", "failures", "limitations", "uncertainty", "sourceIds", "experimentIds", "claimIds", "recommendedBranches", "concludedAt"]);
const SOURCE_FIELDS = new Set(["sourceId", "missionId", "citationKey", "title", "authors", "year", "locator", "sourceType", "summary", "conditions", "relationship", "conflicts", "limitations", "capture", "recordedAt"]);
const CAPTURE_FIELDS = new Set(["path", "sizeBytes", "sha256"]);
const PLAN_FIELDS = new Set(["experimentId", "missionId", "title", "hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts", "cost", "risk", "failureValue", "contributionRole", "plannedAt"]);
const RESULT_FIELDS = new Set(["experimentId", "missionId", "kind", "summary", "observations", "measurements", "denominator", "hypothesisImpacts", "claimImpacts", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations", "recordedAt"]);
const CLAIM_FIELDS = new Set(["claimId", "missionId", "statement", "supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "assessment", "storyRole", "artifactRefs", "recordedAt"]);
const REVIEW_FIELDS = new Set(["reviewId", "missionId", "status", "verdict", "summary", "rubric", "reviewedArtifacts", "reviewedArtifactSetSha256", "findings", "actionItems", "report", "provenance", "limitations", "reviewedAt"]);

function file(directory, id, suffix = "") { return path.posix.join(directory, `${id}${suffix}.json`); }
function missionPath(id) { return file(ARTIFACT_PATHS.missionsDir, id); }
function conclusionPath(id) { return file(ARTIFACT_PATHS.missionsDir, id, ".conclusion"); }
function planPath(id) { return file(ARTIFACT_PATHS.experimentsDir, id, ".plan"); }
function resultPath(id) { return file(ARTIFACT_PATHS.experimentsDir, id, ".result"); }
function now(value, label) { return value === undefined ? new Date().toISOString() : exactTimestamp(value, label); }
function textFields(value, fields, label) { for (const field of fields) nonEmptyText(value[field], `${label}.${field}`); }
function arrayFields(value, fields, label, minimum = {}) { for (const field of fields) stringArray(value[field], `${label}.${field}`, { min: minimum[field] ?? 0 }); }
function listJson(root, directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).filter((entry) => {
    if (entry.isSymbolicLink()) throw new Error(`${directory}/${entry.name} must not be a symbolic link.`);
    return entry.isFile() && entry.name.endsWith(".json");
  }).map((entry) => path.posix.join(directory, entry.name)).sort();
}
function ensureMission(root, missionId) { const mission = readMission(root, missionId); if (!mission) throw new Error(`Unknown Mission ${missionId}.`); return mission; }

export function updateWorkspace(root, changes = {}) {
  const opened = openDoveWorkspace(root, { operation: "Workspace update" });
  const changedAt = now(changes.changedAt, "Workspace changedAt");
  const next = validateWorkspaceRecord({
    ...opened.workspaceRecord,
    researchQuestion: changes.researchQuestion ?? opened.workspaceRecord.researchQuestion,
    mainline: changes.mainline ?? opened.workspaceRecord.mainline,
    contributionIntent: changes.contributionIntent ?? opened.workspaceRecord.contributionIntent,
    currentFocus: changes.currentFocus ?? opened.workspaceRecord.currentFocus,
    changeHistory: [...opened.workspaceRecord.changeHistory, { changedAt, summary: nonEmptyText(changes.summary, "Workspace change summary") }],
    updatedAt: changedAt
  });
  writeResearchJsonAtomic(root, ARTIFACT_PATHS.workspace, next, { expectedContent: readResearchText(root, ARTIFACT_PATHS.workspace), label: "Workspace" });
  return next;
}

export function validateMission(value, label = "Mission") {
  assertFields(value, MISSION_FIELDS, label); researchId(value.missionId, `${label}.missionId`);
  if (value.parentMissionId !== null) researchId(value.parentMissionId, `${label}.parentMissionId`);
  arrayFields(value, ["dependsOnMissionIds", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs"], label);
  textFields(value, ["goal", "contributionRole"], label); exactTimestamp(value.createdAt, `${label}.createdAt`);
  if (value.parentMissionId === null && (value.branchKind !== null || value.branchReason !== null)) throw new Error(`${label} root must not declare branch metadata.`);
  if (value.parentMissionId !== null) textFields(value, ["branchKind", "branchReason"], label);
  return value;
}

export function readMission(root, missionId) { openDoveWorkspace(root, { operation: "Mission read" }); return readResearchJson(root, missionPath(researchId(missionId, "missionId")), { fallback: null }); }
export function validateMissionTree(missions) {
  const byId = new Map(); for (const mission of missions) { validateMission(mission); if (byId.has(mission.missionId)) throw new Error(`Duplicate Mission ${mission.missionId}.`); byId.set(mission.missionId, mission); }
  for (const mission of byId.values()) for (const target of [...mission.dependsOnMissionIds, ...(mission.parentMissionId ? [mission.parentMissionId] : [])]) if (!byId.has(target)) throw new Error(`Mission ${mission.missionId} references unknown Mission ${target}.`);
  const check = (edges) => { const active = new Set(); const done = new Set(); const visit = (id) => { if (active.has(id)) throw new Error(`Mission tree contains a cycle at ${id}.`); if (done.has(id)) return; active.add(id); edges(byId.get(id)).forEach(visit); active.delete(id); done.add(id); }; [...byId.keys()].forEach(visit); };
  check((mission) => mission.parentMissionId ? [mission.parentMissionId] : []); check((mission) => mission.dependsOnMissionIds); return byId;
}
export function readMissionTree(root) {
  openDoveWorkspace(root, { operation: "Mission tree read" });
  const missions = validateMissionTree(listJson(root, ARTIFACT_PATHS.missionsDir).filter((item) => !item.endsWith(".conclusion.json")).map((item) => readResearchJson(root, item)));
  const children = new Map([...missions.keys()].map((id) => [id, []])); for (const mission of missions.values()) if (mission.parentMissionId) children.get(mission.parentMissionId).push(mission.missionId); for (const values of children.values()) values.sort();
  return { missions, children, roots: [...missions.values()].filter((mission) => mission.parentMissionId === null).map((mission) => mission.missionId).sort() };
}
export function createMission(root, args = {}) {
  const graph = readMissionTree(root); const mission = validateMission({
    missionId: args.missionId ?? newResearchId("mission"), parentMissionId: args.parentMissionId ?? null, dependsOnMissionIds: args.dependsOnMissionIds ?? [], branchKind: args.branchKind ?? null, branchReason: args.branchReason ?? null,
    goal: args.goal, requirements: args.requirements ?? [], assumptions: args.assumptions ?? [], scope: args.scope ?? [], outOfScope: args.outOfScope ?? [], evidenceRequirements: args.evidenceRequirements ?? [], competingHypotheses: args.competingHypotheses ?? [], openQuestions: args.openQuestions ?? [], contextRefs: args.contextRefs ?? [], contributionRole: args.contributionRole, createdAt: now(args.createdAt, "Mission createdAt")
  });
  if (graph.missions.has(mission.missionId)) throw new Error(`Mission contract is immutable and already exists: ${mission.missionId}.`);
  for (const target of [...mission.dependsOnMissionIds, ...(mission.parentMissionId ? [mission.parentMissionId] : [])]) if (!graph.missions.has(target)) throw new Error(`Mission ${mission.missionId} references unknown Mission ${target}.`);
  validateMissionTree([...graph.missions.values(), mission]); writeResearchJsonAtomic(root, missionPath(mission.missionId), mission, { ifAbsent: true, label: "Mission contract" }); return mission;
}
export function missionReadableIds(root, missionId) { const tree = readMissionTree(root); if (!tree.missions.has(missionId)) throw new Error(`Unknown Mission ${missionId}.`); const readable = new Set(); const visit = (id) => { if (readable.has(id)) return; readable.add(id); const mission = tree.missions.get(id); if (mission.parentMissionId) visit(mission.parentMissionId); mission.dependsOnMissionIds.forEach(visit); }; visit(missionId); return readable; }
export function concludeMission(root, args = {}) {
  ensureMission(root, args.missionId); const conclusion = { missionId: args.missionId, synthesis: args.synthesis, failures: args.failures ?? [], limitations: args.limitations ?? [], uncertainty: args.uncertainty ?? [], sourceIds: args.sourceIds ?? [], experimentIds: args.experimentIds ?? [], claimIds: args.claimIds ?? [], recommendedBranches: args.recommendedBranches ?? [], concludedAt: now(args.concludedAt, "Mission conclusion concludedAt") };
  assertFields(conclusion, CONCLUSION_FIELDS, "Mission conclusion"); nonEmptyText(conclusion.synthesis, "Mission conclusion synthesis"); arrayFields(conclusion, ["failures", "limitations", "uncertainty", "sourceIds", "experimentIds", "claimIds", "recommendedBranches"], "Mission conclusion");
  writeResearchJsonAtomic(root, conclusionPath(conclusion.missionId), conclusion, { ifAbsent: true, label: "Mission conclusion" }); return conclusion;
}

export function recordSource(root, args = {}) {
  ensureMission(root, args.missionId); let capture = null;
  if (args.capturePath) { const capturePath = normalizedRelativePath(args.capturePath, "Source capturePath"); const full = path.join(fs.realpathSync.native(path.resolve(root)), capturePath); const stat = fs.lstatSync(full); if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Source capturePath must be a regular file without symbolic links."); const bytes = fs.readFileSync(full); capture = { path: capturePath, sizeBytes: bytes.byteLength, sha256: sha256(bytes) }; }
  const source = { sourceId: args.sourceId ?? newResearchId("source"), missionId: args.missionId, citationKey: args.citationKey ?? null, title: args.title ?? null, authors: args.authors ?? [], year: args.year ?? null, locator: args.locator ?? null, sourceType: args.sourceType ?? null, summary: args.summary, conditions: args.conditions ?? [], relationship: args.relationship, conflicts: args.conflicts ?? [], limitations: args.limitations ?? [], capture, recordedAt: now(args.recordedAt, "Source recordedAt") };
  assertFields(source, SOURCE_FIELDS, "Source"); researchId(source.sourceId, "Source.sourceId"); if (!source.title && !source.locator) throw new Error("Source requires title or locator."); nonEmptyText(source.summary, "Source.summary"); enumeration(source.relationship, SOURCE_RELATIONSHIPS, "Source.relationship"); arrayFields(source, ["authors", "conditions", "conflicts", "limitations"], "Source"); if (capture) assertFields(capture, CAPTURE_FIELDS, "Source.capture");
  writeResearchJsonAtomic(root, file(ARTIFACT_PATHS.sourcesDir, source.sourceId), source, { ifAbsent: true, label: "Source" }); return source;
}

export function createExperimentPlan(root, args = {}) {
  ensureMission(root, args.missionId); const plan = { experimentId: args.experimentId ?? newResearchId("experiment"), missionId: args.missionId, title: args.title, hypothesisRefs: args.hypothesisRefs ?? [], protocol: args.protocol ?? [], inputs: args.inputs ?? [], comparisons: args.comparisons ?? [], metrics: args.metrics ?? [], discriminatingObservations: args.discriminatingObservations ?? [], successConditions: args.successConditions ?? [], stopConditions: args.stopConditions ?? [], constraints: args.constraints ?? [], expectedArtifacts: args.expectedArtifacts ?? [], cost: args.cost, risk: args.risk, failureValue: args.failureValue, contributionRole: args.contributionRole, plannedAt: now(args.plannedAt, "Experiment plan plannedAt") };
  assertFields(plan, PLAN_FIELDS, "Experiment plan"); researchId(plan.experimentId, "Experiment plan.experimentId"); textFields(plan, ["title", "cost", "risk", "failureValue", "contributionRole"], "Experiment plan"); arrayFields(plan, ["hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts"], "Experiment plan", { protocol: 1, inputs: 1, metrics: 1, discriminatingObservations: 1, stopConditions: 1 });
  writeResearchJsonAtomic(root, planPath(plan.experimentId), plan, { ifAbsent: true, label: "Experiment plan" }); return plan;
}
export function recordExperimentResult(root, args = {}) {
  const experimentId = researchId(args.experimentId, "Experiment result.experimentId"); const plan = readResearchJson(root, planPath(experimentId), { fallback: null }); if (!plan) throw new Error("Experiment result requires a prior persisted protocol plan."); if (plan.missionId !== args.missionId) throw new Error("Experiment result missionId must match its plan.");
  const result = { experimentId, missionId: args.missionId, kind: args.kind, summary: args.summary, observations: args.observations ?? [], measurements: args.measurements ?? [], denominator: args.denominator, hypothesisImpacts: args.hypothesisImpacts ?? [], claimImpacts: args.claimImpacts ?? [], unexpectedObservations: args.unexpectedObservations ?? [], uncertainty: args.uncertainty ?? [], artifactRefs: args.artifactRefs ?? [], failures: args.failures ?? [], deviations: args.deviations ?? [], limitations: args.limitations ?? [], recordedAt: now(args.recordedAt, "Experiment result recordedAt") };
  assertFields(result, RESULT_FIELDS, "Experiment result"); enumeration(result.kind, EXPERIMENT_RESULT_KINDS, "Experiment result.kind"); nonEmptyText(result.summary, "Experiment result.summary"); assertPlainObject(result.denominator, "Experiment result.denominator"); if (!Array.isArray(result.measurements) || !Array.isArray(result.hypothesisImpacts) || !Array.isArray(result.claimImpacts)) throw new Error("Experiment result measurements and impacts must be arrays."); arrayFields(result, ["observations", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations"], "Experiment result"); if (["failed", "stopped"].includes(result.kind) && result.failures.length + result.limitations.length === 0) throw new Error("Failed or stopped Experiment results must preserve failures or limitations.");
  writeResearchJsonAtomic(root, resultPath(experimentId), result, { ifAbsent: true, label: "Experiment result" }); return result;
}

export function recordClaim(root, args = {}) {
  ensureMission(root, args.missionId); const claim = { claimId: args.claimId ?? newResearchId("claim"), missionId: args.missionId, statement: args.statement, supportRefs: args.supportRefs ?? [], counterEvidenceRefs: args.counterEvidenceRefs ?? [], missingEvidence: args.missingEvidence ?? [], cannotSay: args.cannotSay ?? [], uncertainty: args.uncertainty ?? [], assessment: args.assessment, storyRole: args.storyRole, artifactRefs: args.artifactRefs ?? [], recordedAt: now(args.recordedAt, "Claim recordedAt") };
  assertFields(claim, CLAIM_FIELDS, "Claim"); researchId(claim.claimId, "Claim.claimId"); textFields(claim, ["statement", "storyRole"], "Claim"); enumeration(claim.assessment, CLAIM_ASSESSMENTS, "Claim.assessment"); arrayFields(claim, ["supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "artifactRefs"], "Claim"); if (!claim.supportRefs.length) throw new Error("Claim requires supportRefs."); if (!claim.cannotSay.length) throw new Error("Claim requires an explicit cannotSay boundary.");
  writeResearchJsonAtomic(root, file(ARTIFACT_PATHS.claimsDir, claim.claimId), claim, { ifAbsent: true, label: "Claim" }); return claim;
}

export function recordReview(root, args = {}) {
  ensureMission(root, args.missionId); const snapshots = snapshotReviewedArtifacts(root, args.artifactPaths, "Review artifacts"); const review = { reviewId: args.reviewId ?? newResearchId("review"), missionId: args.missionId, status: args.status, verdict: args.verdict, summary: args.summary, rubric: args.rubric ?? [], reviewedArtifacts: snapshots.reviewedArtifacts, reviewedArtifactSetSha256: snapshots.reviewedArtifactSetSha256, findings: args.findings ?? [], actionItems: args.actionItems ?? [], report: args.report, provenance: args.provenance, limitations: args.limitations ?? [], reviewedAt: now(args.reviewedAt, "Review reviewedAt") };
  assertFields(review, REVIEW_FIELDS, "Review"); researchId(review.reviewId, "Review.reviewId"); enumeration(review.status, REVIEW_STATUSES, "Review.status"); textFields(review, ["verdict", "summary", "report"], "Review"); arrayFields(review, ["rubric", "actionItems", "limitations"], "Review", { rubric: 1 }); if (!Array.isArray(review.findings)) throw new Error("Review.findings must be an array."); assertPlainObject(review.provenance, "Review.provenance");
  writeResearchJsonAtomic(root, file(ARTIFACT_PATHS.reviewsDir, review.reviewId), review, { ifAbsent: true, label: "Review" }); return review;
}
export function verifyReview(root, reviewId) { const review = readResearchJson(root, file(ARTIFACT_PATHS.reviewsDir, researchId(reviewId, "reviewId")), { fallback: null }); if (!review) return null; const verified = verifyReviewSnapshotSet(root, review.reviewedArtifacts, review.reviewedArtifactSetSha256); return { review, ...verified }; }

export function readLessons(root) { return readResearchText(root, ARTIFACT_PATHS.lessons); }
export function replaceLessons(root, markdown) { openDoveWorkspace(root, { operation: "Lessons replacement" }); validateLessonsMarkdown(markdown, "Lessons replacement"); writeResearchFileAtomic(root, ARTIFACT_PATHS.lessons, markdown, { label: "Lessons" }); return markdown; }
