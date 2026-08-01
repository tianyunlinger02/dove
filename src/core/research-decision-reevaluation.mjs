import crypto from "node:crypto";

import { domainNonEmptyText, domainSafeId, domainStringArray, readCurrentMission, resolveMissionArtifactReferences, resolveMissionValidationReference } from "./domain-artifacts.mjs";
import { assertMissionAcceptsWrites } from "./mission-graph.mjs";
import { createMissionTransition, missionTransitionPath } from "./mission-lifecycle.mjs";
import { resolveVisibleMissionSelector } from "./mission-queries.mjs";
import { currentMutationContext } from "./mutation-backend.mjs";
import { appendResearchDecision, researchDecisionPath } from "./research-decision-store.mjs";
import { createResearchDecisionAction } from "./research-decisions.mjs";
import { createResearchHandoff } from "./research-handoff.mjs";
import { evaluateSourceReferences } from "./source-trust.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { assertGovernanceMutationRegistered, writeJson } from "./workspace.mjs";

const FIELDS = new Set(["operation", "missionId", "decisionRevision", "requestedDisposition", "synthesis", "hypotheses", "routes", "openQuestions", "evidenceRefs", "consumedReceiptIds", "reasonCodes", "nextAction", "createdAt"]);
const DISPOSITIONS = new Set(["continue", "stop-satisfied", "stop-low-return", "stop-budget", "reject", "block-needs-user"]);
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
function sealed(value, fields, label) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`); const unknown = Object.keys(value).filter((field) => !fields.has(field)); if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`); }
function exactIso(value, label) { if (typeof value !== "string" || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO timestamp.`); return value; }
function resolveEvidence(root, missionId, references) { return domainStringArray(references, "evidenceRefs").map((reference, index) => { if (reference.startsWith("source:")) { const sourceId = domainSafeId(reference.slice(7), `evidenceRefs[${index}]`); if (!evaluateSourceReferences(root, [sourceId], missionId)[0]?.eligible) throw new Error(`evidenceRefs[${index}] is not current source evidence.`); return reference; } if (reference.startsWith("validation:")) return `validation:${resolveMissionValidationReference(root, missionId, reference.slice(11), `evidenceRefs[${index}]`).reference}`; if (reference.startsWith("artifact:")) return `artifact:${resolveMissionArtifactReferences(root, missionId, [reference.slice(9)], `evidenceRefs[${index}]`)[0].path}`; throw new Error(`evidenceRefs[${index}] must be a typed current evidence reference.`); }); }
function transitionStatus(disposition) { return disposition === "reject" ? "failed" : "stopped"; }
function eligibleReceiptIds(workspace, missionId, decision) { const consumed = new Set(decision.consumedReceiptIds); return workspace.receiptLedger.receipts.filter((receipt) => receipt.missionId === missionId && receipt.researchOutcome?.decisionId === decision.decisionId && !consumed.has(receipt.receiptId)).map((receipt) => receipt.receiptId); }

export function currentResearchDecisionBinding(root, missionId) {
  const { workspace, mission } = readCurrentMission(root, missionId, "Current research decision public binding");
  if (mission.mode !== "research") throw new Error("Research decision reevaluation requires a research mission.");
  const decision = workspace.currentResearchDecisions.get(mission.missionId);
  if (!decision) throw new Error("The selected mission does not have a current research decision.");
  return { decisionRevision: decision.revision, consumedReceiptIds: eligibleReceiptIds(workspace, mission.missionId, decision) };
}

function researchStableId(prefix, missionId, decisionRevision, index, text) {
  const normalized = String(text ?? "").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 40) || String(index + 1);
  const digest = crypto.createHash("sha256").update(`${missionId}\n${decisionRevision + 1}\n${index}\n${String(text ?? "")}`).digest("hex").slice(0, 12);
  return `${prefix}-${decisionRevision + 1}-${normalized}-${digest}`.slice(0, 128);
}

export function prepareResearchDecisionReevaluation(root, args = {}) {
  const missionId = resolveVisibleMissionSelector(root, args);
  const { decisionRevision, consumedReceiptIds } = currentResearchDecisionBinding(root, missionId);
  const hypotheses = args.hypotheses.map((item, index) => ({
    ...item,
    hypothesisId: researchStableId("hypothesis", missionId, decisionRevision, index, item.statement)
  }));
  const openQuestions = args.openQuestions.map((item, index) => ({
    ...item,
    questionId: researchStableId("question", missionId, decisionRevision, index, item.question)
  }));
  const routes = args.routes.map((item, index) => ({
    ...item,
    routeId: researchStableId("route", missionId, decisionRevision, index, item.summary)
  }));
  const targetIds = new Map([
    ...hypotheses.map((item, index) => [`hypothesis:${index + 1}`, item.hypothesisId]),
    ...openQuestions.map((item, index) => [`question:${index + 1}`, item.questionId])
  ]);
  const nextAction = args.nextAction === null ? null : {
    ...args.nextAction,
    actionId: researchStableId("research-action", missionId, decisionRevision, 0, args.nextAction.description),
    targetHypothesisOrQuestionIds: args.nextAction.targets.map((target) => {
      const resolved = targetIds.get(target);
      if (!resolved) throw new Error(`nextAction.targets contains an unknown public target ${target}.`);
      return resolved;
    })
  };
  if (nextAction) delete nextAction.targets;
  return {
    operation: args.operation,
    missionId,
    decisionRevision,
    requestedDisposition: args.requestedDisposition,
    synthesis: args.synthesis,
    hypotheses,
    routes,
    openQuestions,
    evidenceRefs: args.evidenceRefs,
    consumedReceiptIds,
    reasonCodes: args.reasonCodes,
    nextAction
  };
}

export function reevaluateResearchDecision(root, args = {}) {
  assertGovernanceMutationRegistered("reevaluate-research-decision", "guarded"); sealed(args, FIELDS, "reevaluate-research-decision"); if (args.operation !== "reevaluate-research-decision") throw new Error("Research decision reevaluation requires its explicit operation."); const context = currentMutationContext(root); if (!context || context.mutationMode !== "direct-process") throw new Error("Research decision reevaluation requires one direct-process MutationContext.");
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Research decision reevaluation"); if (mission.mode !== "research") throw new Error("Research decision reevaluation requires a research mission."); assertMissionAcceptsWrites(workspace, mission);
  const current = workspace.currentResearchDecisions.get(mission.missionId); if (!current || current.revision !== args.decisionRevision) throw new Error("The submitted research decision revision is stale.");
  const disposition = domainNonEmptyText(args.requestedDisposition, "requestedDisposition"); if (!DISPOSITIONS.has(disposition)) throw new Error("requestedDisposition is unsupported."); const createdAt = exactIso(args.createdAt ?? new Date().toISOString(), "createdAt"); if (Date.parse(createdAt) < Date.parse(current.createdAt)) throw new Error("createdAt must not precede the current decision.");
  const evidenceRefs = resolveEvidence(root, mission.missionId, args.evidenceRefs); const consumedReceiptIds = domainStringArray(args.consumedReceiptIds, "consumedReceiptIds").map((id, index) => domainSafeId(id, `consumedReceiptIds[${index}]`)); const missionReceipts = new Map(workspace.receiptLedger.receipts.filter((receipt) => receipt.missionId === mission.missionId && receipt.researchOutcome).map((receipt) => [receipt.receiptId, receipt])); if (consumedReceiptIds.some((id) => !missionReceipts.has(id))) throw new Error("consumedReceiptIds must reference research receipts from the current mission."); if (consumedReceiptIds.some((id) => missionReceipts.get(id).researchOutcome.decisionId !== current.decisionId)) throw new Error("consumedReceiptIds must reference outcomes produced under the current decision."); const eligible = eligibleReceiptIds(workspace, mission.missionId, current); if (consumedReceiptIds.length !== eligible.length || consumedReceiptIds.some((id, index) => id !== eligible[index])) throw new Error("consumedReceiptIds must contain every eligible unconsumed receipt under the current decision in ledger order.");
  const nextAction = args.nextAction === null ? null : createResearchDecisionAction(args.nextAction); const content = { synthesis: domainNonEmptyText(args.synthesis, "synthesis"), hypotheses: args.hypotheses, routes: args.routes, openQuestions: args.openQuestions, evidenceRefs, consumedReceiptIds, disposition, reasonCodes: domainStringArray(args.reasonCodes, "reasonCodes"), nextAction };
  const appended = appendResearchDecision(root, { missionId: mission.missionId, predecessorDecisionId: current.decisionId, predecessorDecisionDigest: current.decisionDigest, createdAt, content });
  const transition = !["continue", "stop-satisfied", "block-needs-user"].includes(disposition) ? createMissionTransition({ workspaceId: workspace.manifest.workspaceId, missionId: mission.missionId, contractDigest: mission.contractDigest, workspaceRevisionId: mission.workspaceRevisionId, status: transitionStatus(disposition), reason: content.synthesis, evidenceRefs, trigger: "research-decision", createdAt }) : null;
  if (transition) { context.requireCommitPrecondition(ARTIFACT_PATHS.missionTransitionsDir); writeJson(root, missionTransitionPath(transition.transitionId), transition); }
  const handoff = nextAction ? createResearchHandoff(appended.decision, { issuedAt: createdAt, expiresAt: new Date(Date.parse(createdAt) + FOUR_HOURS_MS).toISOString() }) : null;
  return { status: "recorded", operation: "reevaluate-research-decision", summary: "Dove recorded the current scientific judgment from explicit evidence and receipt consumption.", decision: appended.decision, researchDisposition: disposition, evidenceCount: evidenceRefs.length, executionHandoff: handoff, ...(disposition === "stop-satisfied" ? { completion: { missionId: mission.missionId, assessWith: "assess_mission_completion", assessment: null }, postCommit: { kind: "assess-mission-completion", missionId: mission.missionId } } : {}), writes: [researchDecisionPath(appended.decision.decisionId), ...(transition ? [missionTransitionPath(transition.transitionId)] : [])] };
}
