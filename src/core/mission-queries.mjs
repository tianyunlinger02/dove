import fs from "node:fs";
import path from "node:path";

import { inspectDeclaredPath } from "./artifact-integrity.mjs";
import { assessMissionCompletion } from "./completion-gates.mjs";
import { readExecutionReceipts } from "./execution-receipts.mjs";
import { assertCurrentMissionContract, previewDoveMissionContract } from "./mission-contracts.mjs";
import { buildProjectResearchNarrativeFromWorkspace } from "./project-research-narratives.mjs";
import { queryDomainIntegrity } from "./retained-domain-workflows.mjs";
import { buildResearchNarrativeFromDecision } from "./research-narratives.mjs";
import { queryReviewRecords } from "./review-records.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { evaluateSourceIds, querySources } from "./source-trust.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

const STATUS_GRAPH_LIMITS = Object.freeze({
  missions: 100,
  requirements: 500,
  workItems: 500,
  researchItems: 500,
  receipts: 500,
  artifacts: 500,
  validations: 500,
  gaps: 500
});

function statusDetail(args = {}) {
  const detail = args.detail ?? "compact";
  if (detail !== "compact" && detail !== "full") throw new Error("Dove status detail must be compact or full.");
  return detail;
}

function compactDomainIntegrity(integrity) {
  return {
    artifactCount: integrity.artifactCount,
    staleArtifactCount: integrity.staleArtifactCount,
    stalePaths: integrity.stalePaths
  };
}

function readCurrentMissions(root, options = {}) {
  const workspace = openDoveWorkspace(root, { allowAbsent: options.allowAbsent === true, operation: options.operation ?? "Dove mission query" });
  if (workspace.state === "absent") return { workspace, missions: [] };
  const missionsRoot = path.resolve(root, ARTIFACT_PATHS.missionsDir);
  const missions = fs.readdirSync(missionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const relativePath = path.posix.join(ARTIFACT_PATHS.missionsDir, entry.name);
      let mission;
      try {
        mission = JSON.parse(fs.readFileSync(path.resolve(root, relativePath), "utf8"));
      } catch (error) {
        throw new Error(`Malformed durable JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
      assertCurrentMissionContract(mission);
      return mission;
    })
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || left.missionId.localeCompare(right.missionId));
  return { workspace, missions };
}

function bounded(items, limit) {
  return { totalCount: items.length, truncated: items.length > limit, items: items.slice(0, limit) };
}

function missionNumberForId(missions, missionId) {
  const index = missions.findIndex((mission) => mission.missionId === missionId);
  if (index < 0) throw new Error("The selected work item is not available in the public mission scope.");
  return index + 1;
}

export function resolveMissionNumber(root, missionNumber, options = {}) {
  if (!Number.isSafeInteger(missionNumber) || missionNumber < 1) throw new Error("missionNumber must be an integer greater than or equal to 1 in the stable public mission order.");
  const { missions } = readCurrentMissions(root, { operation: options.operation ?? "Dove public mission selection" });
  const selected = missions[missionNumber - 1] ?? null;
  if (!selected) throw new Error(`No mission exists as missionNumber ${missionNumber} in the stable public mission order.`);
  return selected;
}

export function publicMissionNumberForId(root, missionId, options = {}) {
  const { missions } = readCurrentMissions(root, { operation: options.operation ?? "Dove public mission numbering" });
  return missionNumberForId(missions, missionId);
}

export function publicMissionNumberForCandidate(root, candidate, options = {}) {
  assertCurrentMissionContract(candidate);
  const { missions } = readCurrentMissions(root, { operation: options.operation ?? "Dove candidate public mission numbering" });
  if (missions.some((mission) => mission.missionId === candidate.missionId)) throw new Error("The candidate work item already exists in the public mission scope.");
  const ordered = [...missions, candidate].sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || left.missionId.localeCompare(right.missionId));
  return missionNumberForId(ordered, candidate.missionId);
}

export function resolveVisibleMissionSelector(root, args = {}) {
  const selected = resolveMissionNumber(root, args.missionNumber, { operation: "Dove visible mission selection" });
  if (Object.hasOwn(args, "missionGoal")) {
    const missionGoal = typeof args.missionGoal === "string" ? args.missionGoal.trim() : "";
    if (!missionGoal) throw new Error("missionGoal must be a non-empty exact value shown by Dove status.");
    if (selected.goal !== missionGoal) throw new Error("missionNumber and missionGoal do not refer to the same visible mission.");
  }
  return selected.missionId;
}

function missionRequirements(mission) {
  return mission.requirements.map((description, index) => ({
    requirementId: `requirement-${index + 1}`,
    kind: "requirement",
    description
  }));
}

function missionWorkItems(mission, assessment, decision) {
  const items = [];
  for (const artifact of mission.artifacts) {
    const coverage = assessment.artifactCoverage.find((item) => item.path === artifact.path);
    items.push({ label: artifact.path, kind: "artifact", status: artifact.required && coverage?.covered !== true ? "pending" : "completed" });
  }
  for (const criterion of assessment.criterionCoverage) items.push({ label: criterion.criterion, kind: "completion-criterion", status: criterion.covered ? "completed" : "pending" });
  for (const requirement of assessment.evidenceRequirements) items.push({ label: requirement.requirement, kind: "evidence-requirement", status: requirement.satisfied ? "completed" : "pending" });
  if (decision?.disposition === "block-needs-user") items.push({ label: "Resolve the recorded user decision before continuing.", kind: "user-decision", status: "blocked" });
  if (decision?.nextAction) items.push({ label: decision.nextAction.description, kind: decision.nextAction.kind, status: assessment.researchOutcome.awaitingReevaluation ? "blocked" : "pending" });
  return items;
}

function researchDecisionItems(decision, assessment) {
  if (!decision) return [];
  const items = [
    ...decision.hypotheses.map((item) => ({ kind: "hypothesis", questionOrHypothesis: item.statement, status: item.assessment === "unresolved" ? "pending" : "completed", outcomeSummary: item.assessment, blockedReasonCode: null })),
    ...decision.openQuestions.map((item) => ({ kind: "open-question", questionOrHypothesis: item.question, status: "pending", outcomeSummary: null, blockedReasonCode: null })),
    ...decision.routes.map((item) => ({ kind: "route", questionOrHypothesis: item.summary, status: item.disposition === "selected" ? "pending" : "completed", outcomeSummary: item.rationale, blockedReasonCode: null }))
  ];
  if (assessment.researchOutcome.awaitingReevaluation) items.push({ kind: "receipt-reevaluation", questionOrHypothesis: "Reevaluate the unconsumed research execution receipts.", status: "blocked", outcomeSummary: `${assessment.researchOutcome.unconsumedReceiptIds.length} receipt(s) await scientific judgment.`, blockedReasonCode: "research-outcome-awaiting-reevaluation" });
  if (decision.disposition === "block-needs-user") items.push({ kind: "user-decision", questionOrHypothesis: "Resolve the recorded user decision before continuing.", status: "blocked", outcomeSummary: decision.synthesis, blockedReasonCode: "research-user-decision-required" });
  return items;
}

function workspaceStatusGraph(root, workspace, missions, assessments, selectedMission = null) {
  const scopedMissions = selectedMission ? [selectedMission] : missions;
  const missionBound = bounded(scopedMissions, STATUS_GRAPH_LIMITS.missions);
  const displayedMissions = missionBound.items;
  const stableMissionDisplayById = new Map(missions.map((mission, displayIndex) => [mission.missionId, displayIndex]));
  const missionDisplayById = new Map(displayedMissions.map((mission) => [mission.missionId, stableMissionDisplayById.get(mission.missionId)]));
  const requirements = [];
  const workItems = [];
  const researchItems = [];
  const blockers = [];
  const missionItems = displayedMissions.map((mission) => {
    const missionDisplayIndex = missionDisplayById.get(mission.missionId);
    const assessment = assessments.get(mission.missionId);
    const decision = workspace.currentResearchDecisions.get(mission.missionId) ?? null;
    const requirementDisplayIndices = missionRequirements(mission).map((requirement) => {
      const item = { displayIndex: requirements.length, missionId: mission.missionId, missionDisplayIndex, ...requirement };
      requirements.push(item);
      return item.displayIndex;
    });
    for (const item of missionWorkItems(mission, assessment, decision)) workItems.push({ displayIndex: workItems.length, missionId: mission.missionId, missionDisplayIndex, dependencyDisplayIndices: [], ...item });
    for (const item of researchDecisionItems(decision, assessment)) {
      const researchItem = { displayIndex: researchItems.length, missionResearchDisplayIndex: researchItems.filter((candidate) => candidate.missionId === mission.missionId).length, missionId: mission.missionId, missionDisplayIndex, workDescription: item.kind, stopCondition: null, ...item };
      researchItems.push(researchItem);
      if (researchItem.status === "blocked") blockers.push({ researchItemDisplayIndex: researchItem.displayIndex, missionDisplayIndex, completionImpact: "required", blockedReasonCode: researchItem.blockedReasonCode, outcomeSummary: researchItem.outcomeSummary });
    }
    return {
      displayIndex: missionDisplayIndex,
      missionId: mission.missionId,
      mode: mission.mode,
      goal: mission.goal,
      createdAt: mission.createdAt,
      status: decision?.disposition === "block-needs-user" ? "blocked" : assessment.status,
      complete: assessment.complete,
      dependencyMissionIds: [...mission.dependsOnMissionIds],
      dependencyDisplayIndices: mission.dependsOnMissionIds.map((missionId) => missionDisplayById.get(missionId)).filter((value) => value !== undefined),
      parentMissionId: mission.parentMissionId ?? null,
      parentDisplayIndex: mission.parentMissionId ? missionDisplayById.get(mission.parentMissionId) ?? null : null,
      branchKind: mission.branchKind ?? null,
      branchReason: mission.branchReason ?? null,
      lifecycle: assessment.lifecycle,
      requirementDisplayIndices,
      declaredOutputs: mission.artifacts.filter((artifact) => artifact.role !== "supporting").map((artifact) => ({ path: artifact.path, required: artifact.required, present: inspectDeclaredPath(root, artifact.path, { requireNonEmpty: true, rejectBookkeeping: true }).status === "existing" })),
      uncoveredOutputs: assessment.artifactCoverage.filter((item) => !item.covered).map((item) => item.path),
      uncoveredCompletionCriteria: assessment.criterionCoverage.filter((item) => !item.covered).map((item) => item.criterion),
      unmetEvidenceRequirements: assessment.evidenceRequirements.filter((item) => !item.satisfied).map((item) => item.requirement),
      gapCodes: assessment.incompleteReasons
    };
  });
  const interpretedResearchReceiptIds = new Set([...workspace.researchDecisions.values()].flatMap((decision) => decision.consumedReceiptIds));
  const receipts = workspace.receiptLedger.receipts.filter((receipt) => missionDisplayById.has(receipt.missionId)).sort((left, right) => left.ledgerSequence - right.ledgerSequence).map((receipt) => ({ displayIndex: receipt.ledgerSequence - 1, receiptId: receipt.receiptId, missionId: receipt.missionId, missionDisplayIndex: missionDisplayById.get(receipt.missionId), summary: receipt.summary, producedAt: receipt.producedAt, artifactCount: receipt.artifacts.length, validationCount: receipt.validations.length, criteriaCount: receipt.criteriaSatisfied.length, outcomeMode: receipt.ordinaryHostOutcome?.mode ?? (receipt.researchOutcome ? "research-execution" : null), outcomeStatus: receipt.ordinaryHostOutcome?.status ?? receipt.researchOutcome?.status ?? null, interpretationStatus: receipt.researchOutcome ? interpretedResearchReceiptIds.has(receipt.receiptId) ? "interpreted" : "awaiting-reevaluation" : null, factCount: receipt.ordinaryHostOutcome?.facts?.length ?? receipt.researchOutcome?.facts?.length ?? 0 }));
  const receiptBound = bounded(receipts, STATUS_GRAPH_LIMITS.receipts);
  const receiptDisplayById = new Map(receiptBound.items.map((receipt) => [receipt.receiptId, receipt.displayIndex]));
  const artifacts = workspace.receiptLedger.currentOwnership.filter((artifact) => missionDisplayById.has(artifact.missionId)).sort((left, right) => left.path.localeCompare(right.path)).map((artifact, displayIndex) => ({ displayIndex, path: artifact.path, kind: artifact.kind, missionId: artifact.missionId, missionDisplayIndex: missionDisplayById.get(artifact.missionId), receiptId: artifact.receiptId, receiptDisplayIndex: receiptDisplayById.get(artifact.receiptId) ?? null }));
  const validations = workspace.receiptLedger.receipts.filter((receipt) => missionDisplayById.has(receipt.missionId)).flatMap((receipt) => receipt.validations.map((validation) => ({ receipt, validation }))).map(({ receipt, validation }, displayIndex) => ({ displayIndex, kind: validation.kind, reference: validation.reference, missionId: receipt.missionId, missionDisplayIndex: missionDisplayById.get(receipt.missionId), receiptId: receipt.receiptId, receiptDisplayIndex: receiptDisplayById.get(receipt.receiptId) ?? null }));
  const gapItems = missionItems.flatMap((mission) => mission.gapCodes.map((code) => ({ kind: "mission-completion", code, missionId: mission.missionId, missionDisplayIndex: mission.displayIndex })));
  const gapKeys = new Set(gapItems.map((item) => `${item.missionDisplayIndex}:${item.code}`));
  for (const blocker of blockers) {
    const key = `${blocker.missionDisplayIndex}:${blocker.blockedReasonCode}`;
    if (!gapKeys.has(key)) gapItems.push({ kind: "research-blocker", code: blocker.blockedReasonCode, ...blocker });
  }
  return {
    graphVersion: 2,
    bounded: true,
    stableOrdering: "createdAt-then-id; ledger-sequence; canonical-path",
    provenanceAlignment: "mission-contract-decision-chain-and-receipt-lineage",
    textSimilarityUsed: false,
    limits: STATUS_GRAPH_LIMITS,
    missions: { ...missionBound, items: missionItems },
    requirements: bounded(requirements, STATUS_GRAPH_LIMITS.requirements),
    workItems: bounded(workItems, STATUS_GRAPH_LIMITS.workItems),
    researchItems: bounded(researchItems, STATUS_GRAPH_LIMITS.researchItems),
    researchBlockers: bounded(blockers, STATUS_GRAPH_LIMITS.researchItems),
    receipts: receiptBound,
    artifacts: bounded(artifacts, STATUS_GRAPH_LIMITS.artifacts),
    validations: bounded(validations, STATUS_GRAPH_LIMITS.validations),
    gaps: bounded(gapItems.map((item, displayIndex) => ({ displayIndex, ...item })), STATUS_GRAPH_LIMITS.gaps)
  };
}

function narrativeStatus(workspace, missions, selectedMission, missionScope, assessments) {
  if (!selectedMission) {
    if (missions.length <= 1 || missionScope !== "workspace") return { state: "unavailable", kind: null, narrative: null };
    const narrative = buildProjectResearchNarrativeFromWorkspace({
      mainline: workspace.currentWorkspaceRevision.mainline,
      currentWorkspaceRevisionId: workspace.currentWorkspaceRevision.revisionId,
      missionTransitions: workspace.missionTransitions,
      missions,
      currentDecisions: workspace.currentResearchDecisions,
      assessments
    });
    return narrative
      ? { state: "available", kind: "project", narrative }
      : { state: "unavailable", kind: null, narrative: null };
  }
  const decision = workspace.currentResearchDecisions.get(selectedMission.missionId) ?? null;
  return decision
    ? { state: "available", kind: "mission", narrative: buildResearchNarrativeFromDecision(decision, { awaitingReevaluation: assessments.get(selectedMission.missionId)?.researchOutcome?.awaitingReevaluation === true }) }
    : { state: "unavailable", kind: null, narrative: null };
}

function statusGraphCollection(graph, name) {
  const value = graph?.[name];
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value, items: Array.isArray(value.items) ? value.items : [] }
    : { totalCount: 0, truncated: false, items: [] };
}

function statusCounts(items) {
  const counts = { completed: 0, pending: 0, blocked: 0 };
  for (const item of Array.isArray(items) ? items : []) {
    if (item && typeof item === "object" && Object.hasOwn(counts, item.status)) counts[item.status] += 1;
  }
  return counts;
}

function publicStatusScope(value, count) {
  if (value === "only-mission" || value === "explicit") return "single workstream";
  if (count === 0) return "workspace setup";
  return "workspace portfolio";
}

function statusAttentionCategory(reason) {
  const normalized = String(reason ?? "").toLowerCase();
  if (normalized.includes("review") || normalized.includes("issuer")) return "review";
  if (normalized.includes("source")) return "source";
  if (normalized.includes("research") || normalized.includes("blocked")) return "work";
  if (normalized.includes("artifact") || normalized.includes("receipt") || normalized.includes("evidence")) return "evidence";
  if (normalized.includes("supersed")) return "direction";
  return "integrity";
}

function statusRiskFromReason(reason) {
  const guidance = {
    review: {
      whyItMatters: "Independent confirmation is needed before the result can be treated as final.",
      impact: "The produced work may be usable, but sign-off remains open."
    },
    source: {
      whyItMatters: "The conclusion depends on source material that is not yet eligible for use.",
      impact: "Claims may remain unsupported or require revision."
    },
    work: {
      whyItMatters: "Required work cannot advance to its stated completion condition.",
      impact: "The affected result remains partial until the blocker is resolved or the direction changes."
    },
    evidence: {
      whyItMatters: "Current evidence is needed to show that the produced work still matches the stated requirements.",
      impact: "Completion cannot be confirmed even if useful work already exists."
    },
    direction: {
      whyItMatters: "Continuing an older direction can duplicate effort or produce conflicting results.",
      impact: "Further work here may not contribute to the current objective."
    },
    integrity: {
      whyItMatters: "A required completion condition is not currently supported.",
      impact: "The overall result should not yet be presented as fully verified."
    }
  }[statusAttentionCategory(reason)];
  return { whatHappened: reason, whyItMatters: guidance.whyItMatters, impact: guidance.impact, evidenceStrength: "strong" };
}

function uniqueStatusRisks(reasons) {
  const seen = new Set();
  return reasons.flatMap((reason) => {
    if (typeof reason !== "string" || !reason.trim() || seen.has(reason)) return [];
    seen.add(reason);
    return [statusRiskFromReason(reason)];
  });
}

function statusOutputPaths(items, predicate = () => true) {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.filter((item) => item && typeof item === "object" && predicate(item)).map((item) => item.path).filter((value) => typeof value === "string" && value.trim() && !/(?:^|\/)\.dove(?:-archive)?(?:\/|$)/u.test(value)))];
}

function statusCondition(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.startsWith("artifact:")) {
    const artifactPath = value.slice("artifact:".length);
    return artifactPath && !/(?:^|\/)\.dove(?:-archive)?(?:\/|$)/u.test(artifactPath) ? `a current outcome record for ${artifactPath}` : "a current outcome record for the declared output";
  }
  if (value.startsWith("validation:")) {
    const validationPath = value.slice("validation:".length);
    return validationPath && !/(?:^|\/)\.dove(?:-archive)?(?:\/|$)/u.test(validationPath) ? `a separate validation output at ${validationPath}` : "a separate validation output";
  }
  if (/^(?:source|note):/u.test(value)) return "eligible current source evidence";
  return value;
}

function statusWorkstreamItems(graph) {
  return statusGraphCollection(graph, "missions").items.filter((item) => item && typeof item === "object").map((item, index) => {
    const number = index + 1;
    const presentOutputs = statusOutputPaths(item.declaredOutputs, (output) => output.present === true);
    const missingOutputs = [...new Set((Array.isArray(item.uncoveredOutputs) ? item.uncoveredOutputs : []).filter((value) => typeof value === "string" && !/(?:^|\/)\.dove(?:-archive)?(?:\/|$)/u.test(value)))];
    const uncoveredCriteria = [...new Set((Array.isArray(item.uncoveredCompletionCriteria) ? item.uncoveredCompletionCriteria : []).filter((value) => typeof value === "string"))];
    const unmetConditions = [...new Set((Array.isArray(item.unmetEvidenceRequirements) ? item.unmetEvidenceRequirements : []).map(statusCondition).filter(Boolean))];
    return { number, goal: item.goal, presentOutputs, missingOutputs, uncoveredCriteria, unmetConditions, complete: item.complete === true };
  });
}

function statusWorkstreamRisk(items, kind) {
  const workLabel = `Work ${items.map((item) => item.number).join(", ")}`;
  const details = items.map((item) => {
    const goal = typeof item.goal === "string" && item.goal ? ` (${item.goal})` : "";
    const outputs = (kind === "missing" ? item.missingOutputs : item.presentOutputs).join(", ");
    return `Work ${item.number}${goal}: ${outputs || "no public output file is listed"}`;
  }).join("; ");
  const criteria = [...new Set(items.flatMap((item) => item.uncoveredCriteria))];
  const conditions = [...new Set(items.flatMap((item) => item.unmetConditions))];
  const criteriaText = criteria.length ? `Uncovered completion conditions: ${criteria.join("; ")}.` : "";
  const conditionsText = conditions.length ? `Still required: ${conditions.join("; ")}.` : "";
  if (kind === "missing") return {
    whatHappened: `${workLabel} do not yet have their declared outputs. ${details}`,
    whyItMatters: "These workstreams do not yet have files that can be assessed.",
    impact: `${criteriaText} ${conditionsText}`.trim() || "Their completion conditions cannot yet be confirmed.",
    evidenceStrength: "strong"
  };
  return {
    whatHappened: `${workLabel} have output files, but completion evidence is still incomplete. ${details}`,
    whyItMatters: "The files exist, but not every completion condition can yet be confirmed.",
    impact: `${criteriaText} ${conditionsText}`.trim() || "The outputs may be usable, but completion remains open.",
    evidenceStrength: "strong"
  };
}

function statusWorkstreamRisks(graph) {
  const incomplete = statusWorkstreamItems(graph).filter((item) => !item.complete);
  const missing = incomplete.filter((item) => item.presentOutputs.length === 0 && item.missingOutputs.length > 0);
  const produced = incomplete.filter((item) => item.presentOutputs.length > 0);
  return [...(missing.length ? [statusWorkstreamRisk(missing, "missing")] : []), ...(produced.length ? [statusWorkstreamRisk(produced, "produced")] : [])];
}

export function buildPublicStatusProjection(data) {
  const context = data?.currentContext && typeof data.currentContext === "object" && !Array.isArray(data.currentContext) ? data.currentContext : {};
  const graph = data?.durableStatus?.workspaceGraph;
  const counts = statusCounts(statusGraphCollection(graph, "workItems").items);
  const trackedWorkstreams = Number(context.missionCount) || 0;
  const currentEvidenceCount = Number(context.receiptCount) || 0;
  const recordedOutputs = statusOutputPaths(statusGraphCollection(graph, "artifacts").items);
  const declaredPresentOutputs = statusGraphCollection(graph, "missions").items.flatMap((item) => statusOutputPaths(item?.declaredOutputs, (output) => output.present === true));
  const allCurrentOutputs = [...new Set([...recordedOutputs, ...declaredPresentOutputs])];
  const currentOutputCount = allCurrentOutputs.length;
  const currentOutputs = allCurrentOutputs.slice(0, 5);
  const sourceCount = Number(context.sourceCount) || 0;
  const integrity = context.integrityAssessment && typeof context.integrityAssessment === "object" && !Array.isArray(context.integrityAssessment) ? context.integrityAssessment : null;
  const operationalIntegrity = {
    hostActionReturned: integrity?.operationalIntegrity?.hostActionReturned === true || integrity?.ordinaryHostReturn?.present === true,
    receiptRecorded: integrity?.operationalIntegrity?.receiptRecorded === true || currentEvidenceCount > 0,
    completionEvidenceSatisfied: integrity?.operationalIntegrity?.completionEvidenceSatisfied === true,
    lifecycleClosed: integrity?.operationalIntegrity?.lifecycleClosed === true
  };
  const hostReturn = integrity?.ordinaryHostReturn?.current && typeof integrity.ordinaryHostReturn.current === "object" ? integrity.ordinaryHostReturn.current : null;
  const hostReturnStatus = typeof hostReturn?.status === "string" ? hostReturn.status : null;
  const completedObservation = hostReturn?.mode === "observation-only" && hostReturnStatus === "completed";
  const hostReturnedNonCompletion = ["blocked", "failed", "stopped"].includes(hostReturnStatus);
  const complete = integrity?.complete === true;
  const review = context.reviewValidity && typeof context.reviewValidity === "object" && !Array.isArray(context.reviewValidity) ? context.reviewValidity : { authority: "not-established", currentCount: 0, staleCount: 0, failures: [] };
  const currentReviewCount = Number.isSafeInteger(review.currentCount) && review.currentCount > 0 ? review.currentCount : 0;
  const staleReviewCount = Number.isSafeInteger(review.staleCount) && review.staleCount > 0 ? review.staleCount : 0;
  const reviewFailures = Array.isArray(review.failures) ? review.failures.filter((item) => typeof item === "string") : [];
  const stableGaps = data?.needsAttention?.stableGaps ?? {};
  const researchReasons = Array.isArray(stableGaps.research) ? stableGaps.research.map((item) => item?.blockedReasonCode ?? item?.code).filter((item) => typeof item === "string") : [];
  const attentionReasons = [
    ...(Array.isArray(data?.needsAttention?.reasons) ? data.needsAttention.reasons : []),
    ...(Array.isArray(stableGaps.completion) ? stableGaps.completion : []),
    ...(Array.isArray(stableGaps.review) ? stableGaps.review : []),
    ...researchReasons
  ].filter((item) => typeof item === "string");
  const specificRisks = statusWorkstreamRisks(graph);
  const specificallyCoveredCategories = new Set(specificRisks.flatMap((risk) => {
    const normalized = `${risk.whatHappened} ${risk.impact}`.toLowerCase();
    return [...(normalized.includes("output") || normalized.includes("evidence") ? ["evidence", "integrity"] : []), ...(normalized.includes("review") ? ["review"] : []), ...(normalized.includes("source") ? ["source"] : [])];
  }));
  const genericRisks = uniqueStatusRisks(attentionReasons).filter((risk) => !specificallyCoveredCategories.has(statusAttentionCategory(risk.whatHappened)));
  const risksAndBlockers = [...specificRisks, ...genericRisks];
  const hasCurrentWork = currentOutputCount > 0 || currentEvidenceCount > 0 || counts.completed > 0 || completedObservation;
  const hasBlockedWork = counts.blocked > 0 || hostReturnedNonCompletion || risksAndBlockers.some((risk) => statusAttentionCategory(risk.whatHappened) === "work");
  const workState = complete ? "complete" : hostReturnedNonCompletion ? "blocked" : hasCurrentWork ? "work-produced" : hasBlockedWork ? "blocked" : trackedWorkstreams > 0 || counts.pending > 0 ? "in-progress" : "not-started";
  const workSummary = complete
    ? "The tracked work satisfies its stated completion conditions."
    : hostReturnedNonCompletion
      ? `The work ended with status ${hostReturnStatus} and remains incomplete.`
      : hasCurrentWork
        ? completedObservation
          ? "The host action returned completed and concrete execution observations were recorded, but completion evidence or lifecycle closure remains open."
          : "Current work products exist; remaining gaps concern verification, review, or specific unfinished items."
        : hasBlockedWork
          ? "Required work is blocked before a current result can be produced."
          : trackedWorkstreams > 0
            ? "Work is underway, but no current result has been recorded yet."
            : "No tracked work has started yet.";
  const hasReviewHistory = currentReviewCount > 0 || staleReviewCount > 0;
  const evidenceState = complete ? "ready" : currentEvidenceCount > 0 ? "current-with-gaps" : currentOutputCount > 0 ? "evidence-recording-missing" : "missing";
  const evidenceSummary = evidenceState === "ready"
    ? "Current evidence supports completion."
    : evidenceState === "current-with-gaps"
        ? "Current evidence exists, but one or more completion conditions still need support."
        : evidenceState === "evidence-recording-missing"
          ? "Output files exist, but they have not yet been supported by current completion evidence."
          : "Current completion evidence has not been recorded.";
  const progressTotal = counts.completed + counts.pending + counts.blocked;
  const progressState = complete ? "complete" : counts.blocked > 0 ? "blocked" : hasCurrentWork ? "advanced" : trackedWorkstreams > 0 ? "in-progress" : "not-started";
  const progressSummary = progressTotal > 0 ? `${counts.completed} completed, ${counts.pending} pending, and ${counts.blocked} blocked tracked item${progressTotal === 1 ? "" : "s"}.` : hasCurrentWork ? "Current work products are available." : "No item-level progress is available.";
  const findings = [];
  if (currentOutputs.length > 0) findings.push(`Current outputs include ${currentOutputs.join(", ")}${currentOutputCount > currentOutputs.length ? ` and ${currentOutputCount - currentOutputs.length} more` : ""}.`);
  else if (currentOutputCount > 0) findings.push(`${currentOutputCount} current output${currentOutputCount === 1 ? " is" : "s are"} available.`);
  if (counts.completed > 0) findings.push(`${counts.completed} tracked work item${counts.completed === 1 ? " has" : "s have"} reached its stated completion condition.`);
  if (sourceCount > 0) findings.push(`${sourceCount} source${sourceCount === 1 ? " is" : "s are"} available for the current scope.`);
  if (currentReviewCount > 0) findings.push(`${currentReviewCount} current non-authoritative Review archive${currentReviewCount === 1 ? " is" : "s are"} available.`);
  if (staleReviewCount > 0) findings.push(`${staleReviewCount} archived Review record${staleReviewCount === 1 ? " is" : "s are"} stale.`);
  if (complete && findings.length === 0) findings.push("The stated completion conditions are satisfied.");
  const narrativeState = context.narrativeState === "available" ? "available" : "unavailable";
  const narrativeKind = context.narrativeKind === "project" || context.narrativeKind === "mission" ? context.narrativeKind : null;
  const researchNarrative = narrativeState === "available" && context.researchNarrative && typeof context.researchNarrative === "object" ? context.researchNarrative : null;
  const recommendation = researchNarrative
    ? narrativeKind === "project" ? researchNarrative.recommendation : researchNarrative.nextStep ?? researchNarrative.stopReason
    : "No current research judgment is available; status does not invent a recommendation from progress or risk heuristics.";
  const currentSituationSummary = trackedWorkstreams === 0 ? "The workspace has no tracked workstream yet." : `${trackedWorkstreams} workstream${trackedWorkstreams === 1 ? " is" : "s are"} in scope; ${risksAndBlockers.length} material risk or blocker${risksAndBlockers.length === 1 ? " requires" : "s require"} attention.`;
  const executiveSummary = complete
    ? "The current work satisfies its stated completion conditions."
    : hostReturnedNonCompletion
      ? `The work ended with status ${hostReturnStatus} and is not complete.`
      : completedObservation
        ? "The host action returned completed, but the work is not complete because completion evidence or lifecycle closure remains open."
        : hasCurrentWork
          ? `Useful work is already present. ${evidenceSummary}`
          : hasBlockedWork
            ? "The current work is blocked before a usable result has been recorded."
            : "The current work is still in progress and does not yet have a recorded result.";
  return {
    status: typeof data?.status === "string" ? data.status : "ok",
    detailsAvailable: data?.detailsAvailable === true,
    message: executiveSummary,
    executiveSummary,
    currentSituation: { scope: publicStatusScope(context.missionScope, trackedWorkstreams), trackedWorkstreams, summary: currentSituationSummary, attentionRequired: risksAndBlockers.length > 0 },
    progress: { state: progressState, completedItems: counts.completed, inProgressItems: counts.pending, blockedItems: counts.blocked, totalItems: progressTotal, summary: progressSummary },
    findings,
    risksAndBlockers,
    workStatus: { state: workState, summary: workSummary, currentOutputCount, currentOutputs, returnStatus: hostReturnStatus, observationOnly: hostReturn?.mode === "observation-only" },
    evidenceStatus: { state: evidenceState, summary: evidenceSummary, currentEvidenceCount, sourceCount, review: { required: false, authority: "not-established", currentCount: currentReviewCount, staleCount: staleReviewCount, status: currentReviewCount > 0 ? "current" : hasReviewHistory ? "stale" : "not-recorded" } },
    operationalIntegrity,
    researchNarrative,
    narrativeKind,
    narrativeState,
    recommendation,
    nextActions: []
  };
}

function emptyStatus(args, detail) {
  const headline = "This project has no explicit Dove workspace research mainline yet.";
  const currentContext = { missionCount: 0, missionScope: "workspace", selectedMissionId: null, receiptCount: 0, sourceCount: 0, integrityAssessment: { status: "incomplete", complete: false, lifecycle: null, dependencyCoverage: [], staleReceiptCount: 0, incompleteReasons: ["workspace-not-initialized"], operationalIntegrity: { hostActionReturned: false, receiptRecorded: false, completionEvidenceSatisfied: false, lifecycleClosed: false }, researchOutcome: { receiptIds: [], consumedReceiptIds: [], unconsumedReceiptIds: [], awaitingReevaluation: false } }, domainIntegrity: null, reviewValidity: null, researchNarrative: null, narrativeKind: null, narrativeState: "unavailable" };
  const result = {
    status: "ok",
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    intent: typeof args.intent === "string" ? args.intent.trim() || null : null,
    detail: "compact",
    detailsAvailable: true,
    summary: headline,
    headline,
    scope: { kind: "minimal-mission-workspace", schemaVersion: null, state: "absent", missionScope: "workspace", missionId: null },
    currentContext,
    durableStatus: { state: "absent", workspaceGraph: null },
    liveHostActivity: { included: false, available: false, source: "host-owned-live-context" },
    needsAttention: { status: "needs-workspace", reasons: ["workspace-not-initialized"], stableGaps: { completion: ["workspace-not-initialized"], dependencies: [], lifecycle: null, sources: [], domain: [], review: [], research: [] } },
    changes: { intent: "none", applied: false, count: 0, rollback: "not-applicable" },
    showMore: { detailsAvailable: true },
    optionalMissionDetails: null
  };
  const projectedResult = { ...result, publicStatus: buildPublicStatusProjection(result) };
  return detail === "full" ? { ...projectedResult, detail: "full", manifest: null, project: null, missions: [], integrityAssessment: null, domainIntegrity: null, sourceIntegrity: null, reviewValidity: null, diagnostics: { artifactPathsRead: [], noRefresh: true, noCommandExecution: true, noExternalProcess: true, noGitInspection: true, noSourceMutation: true, liveHostActivityRead: false } } : projectedResult;
}

export function queryDoveStatus(root, args = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Dove status arguments must be a plain object.");
  const allowed = new Set(["missionNumber", "missionId", "intent", "detail", "language"]);
  const unknown = Object.keys(args).filter((field) => !allowed.has(field));
  if (unknown.length > 0) throw new Error(`Dove status does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const detail = statusDetail(args);
  const { workspace, missions } = readCurrentMissions(root, { allowAbsent: true, operation: "Dove status" });
  if (workspace.state === "absent") return emptyStatus(args, detail);

  const hasMissionNumber = Object.hasOwn(args, "missionNumber");
  const requestedMissionId = typeof args.missionId === "string" ? args.missionId.trim() : "";
  const selectedMission = requestedMissionId
    ? missions.find((mission) => mission.missionId === requestedMissionId) ?? null
    : hasMissionNumber
      ? resolveMissionNumber(root, args.missionNumber, { operation: "Dove status mission selection" })
      : missions.length === 1 ? missions[0] : null;
  if (requestedMissionId && !selectedMission) throw new Error(`Mission does not exist: ${requestedMissionId}.`);
  const missionScope = requestedMissionId || hasMissionNumber ? "explicit" : missions.length === 1 ? "only-mission" : "workspace";
  const assessments = new Map(missions.map((mission) => [mission.missionId, assessMissionCompletion(root, { missionId: mission.missionId })]));
  const workspaceGraph = workspaceStatusGraph(root, workspace, missions, assessments, selectedMission);
  const integrityAssessment = selectedMission ? assessments.get(selectedMission.missionId) : null;
  const receipts = readExecutionReceipts(root, selectedMission?.missionId ?? null);
  const domainIntegrity = queryDomainIntegrity(root, selectedMission?.missionId ?? null);
  const scopedMissions = selectedMission ? [selectedMission] : missions;
  const sourceItems = scopedMissions.flatMap((mission) => querySources(root, { missionId: mission.missionId, limit: 200 }).items);
  const requiredSourceIds = [];
  const requiredSources = selectedMission
    ? evaluateSourceIds(root, requiredSourceIds, selectedMission.missionId).map((evaluation) => ({
      sourceId: evaluation.sourceId,
      lifecycle: evaluation.source?.lifecycle ?? "missing",
      eligible: evaluation.eligible === true,
      reason: evaluation.reason
    }))
    : [];
  const sourceIntegrity = {
    sourceCount: sourceItems.length,
    eligibleCount: sourceItems.filter((item) => item.eligibility?.eligible === true).length,
    candidateCount: sourceItems.filter((item) => item.lifecycle === "candidate").length,
    rejectedCount: sourceItems.filter((item) => item.lifecycle === "rejected").length,
    invalidCount: 0,
    required: requiredSources
  };
  const requiresSourceEvidence = requiredSourceIds.length > 0;
  const reviewValidity = selectedMission ? queryReviewRecords(root, { missionId: selectedMission.missionId }) : { authority: "not-established", currentCount: 0, staleCount: 0, reviews: [] };
  const sourceGaps = requiresSourceEvidence ? requiredSources.filter((item) => item.eligible !== true) : [];
  const reviewGaps = reviewValidity.reviews.filter((item) => !item.current).flatMap((item) => item.failures);
  const headline = `Dove schema ${workspace.schemaVersion} is healthy with ${missions.length} mission contract${missions.length === 1 ? "" : "s"}.`;
  const lifecycle = integrityAssessment?.lifecycle ?? null;
  const workspaceGapCodes = workspaceGraph.gaps.items.map((gap) => gap.code);
  const stableGaps = {
    completion: integrityAssessment?.incompleteReasons ?? workspaceGapCodes,
    dependencies: integrityAssessment?.dependencyCoverage?.filter((dependency) => !dependency.complete) ?? [],
    lifecycle,
    sources: sourceGaps,
    domain: domainIntegrity.stalePaths ?? [],
    review: reviewGaps,
    research: integrityAssessment?.researchOutcome?.awaitingReevaluation ? [{ code: "research-outcome-awaiting-reevaluation" }] : workspaceGraph.researchBlockers.items
  };
  const attentionReasons = [...new Set([
    ...stableGaps.completion,
    ...stableGaps.domain,
    ...(stableGaps.sources.length > 0 ? ["source-evidence-unavailable"] : []),
    ...(stableGaps.review.length > 0 ? ["review-evidence-unavailable"] : []),
    ...(sourceIntegrity.invalidCount > 0 ? ["invalid-source-verification"] : [])
  ])];
  const narrative = narrativeStatus(workspace, missions, selectedMission, missionScope, assessments);
  const currentContext = {
    missionCount: scopedMissions.length,
    missionScope,
    selectedMissionId: selectedMission?.missionId ?? null,
    selectedMissionMode: selectedMission?.mode ?? null,
    receiptCount: receipts.length,
    sourceCount: sourceIntegrity.sourceCount,
    integrityAssessment: integrityAssessment ? {
      status: integrityAssessment.status,
      complete: integrityAssessment.complete,
      lifecycle,
      dependencyCoverage: integrityAssessment.dependencyCoverage,
      staleReceiptCount: integrityAssessment.staleReceiptIds.length,
      incompleteReasons: integrityAssessment.incompleteReasons,
      ...(integrityAssessment.ordinaryHostReturn?.present ? { ordinaryHostReturn: integrityAssessment.ordinaryHostReturn } : {}),
      operationalIntegrity: integrityAssessment.operationalIntegrity,
      researchOutcome: integrityAssessment.researchOutcome
    } : null,
    domainIntegrity: compactDomainIntegrity(domainIntegrity),
    reviewValidity: { authority: "not-established", currentCount: reviewValidity.currentCount, staleCount: reviewValidity.staleCount, failures: reviewGaps },
    researchNarrative: narrative.narrative,
    narrativeKind: narrative.kind,
    narrativeState: narrative.state
  };
  const needsAttention = {
    status: attentionReasons.length ? lifecycle?.status ?? "incomplete" : "clear",
    reasons: attentionReasons,
    stableGaps
  };
  const durableStatus = { state: "current", missionScope, workspaceGraph };
  const liveHostActivity = { included: false, available: false, source: "host-owned-live-context" };
  const result = {
    status: "ok",
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    intent: typeof args.intent === "string" ? args.intent.trim() || null : null,
    detail: "compact",
    detailsAvailable: true,
    summary: headline,
    headline,
    scope: { kind: "minimal-mission-workspace", schemaVersion: workspace.schemaVersion, missionScope, missionId: selectedMission?.missionId ?? null },
    currentContext,
    durableStatus,
    liveHostActivity,
    needsAttention,
    changes: { intent: "none", applied: false, count: 0, rollback: "not-applicable" },
    showMore: { detailsAvailable: true },
    optionalMissionDetails: null
  };
  const projectedResult = { ...result, publicStatus: buildPublicStatusProjection(result) };
  if (detail !== "full") return projectedResult;
  return {
    ...projectedResult,
    detail: "full",
    manifest: workspace.manifest,
    project: workspace.project,
    missions: selectedMission ? [selectedMission] : missions,
    integrityAssessment,
    domainIntegrity,
    sourceIntegrity,
    reviewValidity,
    diagnostics: {
      artifactPathsRead: [ARTIFACT_PATHS.doveRootManifest, ARTIFACT_PATHS.projectIdentity, ARTIFACT_PATHS.missionsDir, ARTIFACT_PATHS.executionReceiptsDir, ARTIFACT_PATHS.researchDecisionsDir, ".dove/sources"],
      noRefresh: true,
      noCommandExecution: true,
      noExternalProcess: true,
      noGitInspection: true,
      noSourceMutation: true,
      liveHostActivityRead: false,
      provenanceAlignment: "mission-contract-decision-chain-and-receipt-lineage",
      textSimilarityUsed: false
    }
  };
}

export function queryDoveMission(root, args = {}) {
  const inspection = openDoveWorkspace(root, { allowAbsent: true, operation: "Dove mission preview" });
  if (inspection.state !== "absent") return previewDoveMissionContract(root, args);
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Dove mission preview arguments must be a plain object.");
  const allowed = new Set(["mode", "goal", "requirements", "assumptions", "scope", "outOfScope", "artifacts", "completionCriteria", "evidenceRequirements"]);
  const unknown = Object.keys(args).filter((field) => !allowed.has(field));
  if (unknown.length > 0) throw new Error(`Dove mission preview without a workspace does not accept input that requires durable lineage: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const mode = typeof args.mode === "string" ? args.mode.trim() : "";
  if (!["ordinary", "research"].includes(mode)) throw new Error("Dove mission preview requires explicit mode: ordinary or research.");
  const goal = typeof args.goal === "string" ? args.goal.trim() : "";
  if (!goal) throw new Error("Dove mission preview requires a non-empty goal.");
  const stringList = (value, label) => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${label} must be an array of non-empty strings.`);
    return [...new Set(value.map((item) => item.trim()))];
  };
  const artifacts = Array.isArray(args.artifacts) ? args.artifacts.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.path !== "string" || !item.path.trim() || typeof item.required !== "boolean" || !["output", "input-output", "supporting"].includes(item.role)) throw new Error(`artifacts[${index}] must declare path, required, and role.`);
    return { path: item.path.trim(), required: item.required, role: item.role };
  }) : [];
  return {
    status: "proposal",
    mission: { mode, goal, requirements: stringList(args.requirements, "requirements"), assumptions: stringList(args.assumptions, "assumptions"), scope: stringList(args.scope, "scope"), outOfScope: stringList(args.outOfScope, "outOfScope"), artifacts, completionCriteria: stringList(args.completionCriteria, "completionCriteria"), evidenceRequirements: stringList(args.evidenceRequirements, "evidenceRequirements") },
    confirmation: { required: false },
    needsWorkspace: true,
    mutation: { mutationMode: "none", writesApplied: false, paths: [] }
  };
}
