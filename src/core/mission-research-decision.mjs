import crypto from "node:crypto";

import { createResearchDecision, createResearchDecisionAction, stableResearchDecisionSerialize } from "./research-decisions.mjs";

function stableId(prefix, value) {
  return `${prefix}-${crypto.createHash("sha256").update(stableResearchDecisionSerialize(value)).digest("hex").slice(0, 20)}`;
}

export function createInitialMissionResearchDecision({ mission, createdAt }) {
  const hypotheses = mission.assumptions.map((assumption, index) => ({
    hypothesisId: stableId("hypothesis", { missionId: mission.missionId, index, assumption }),
    statement: assumption,
    assessment: "unresolved",
    supportingEvidence: [],
    counterEvidence: [],
    falsificationCondition: `Observe current evidence that contradicts this assumption: ${assumption}`
  }));
  const openQuestions = mission.requirements.map((requirement, index) => ({
    questionId: stableId("question", { missionId: mission.missionId, index, requirement }),
    question: `What current evidence is needed to satisfy this mission requirement: ${requirement}`
  }));
  if (openQuestions.length === 0) {
    openQuestions.push({ questionId: stableId("question", { missionId: mission.missionId, goal: mission.goal }), question: `What bounded evidence best advances this mission goal: ${mission.goal}` });
  }
  const nextAction = createResearchDecisionAction({
    actionId: stableId("action", { missionId: mission.missionId, goal: mission.goal }),
    kind: "analysis",
    description: `Perform one bounded evidence-gathering or analysis step for: ${mission.goal}`,
    rationale: "The immutable mission authorizes one bounded step before scientific reevaluation.",
    targetHypothesisOrQuestionIds: [hypotheses[0]?.hypothesisId ?? openQuestions[0].questionId],
    successConditions: mission.completionCriteria.length > 0
      ? mission.completionCriteria.map((item) => item.criterion)
      : ["Return one concrete bounded result relevant to the mission goal."],
    stopConditions: ["Stop after this single bounded action.", "Stop without expanding scope when required inputs or authority are unavailable."],
    expectedEvidence: mission.evidenceRequirements.length > 0
      ? mission.evidenceRequirements.map((item) => item.requirement)
      : ["bounded-research-result"],
    budget: { actions: 1, timeMinutes: 60, costUnits: 1 }
  });
  return createResearchDecision({
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    revision: 1,
    predecessorDecisionId: null,
    predecessorDecisionDigest: null,
    createdAt,
    content: {
      synthesis: mission.goal,
      hypotheses,
      routes: [],
      openQuestions,
      evidenceRefs: [],
      consumedReceiptIds: [],
      disposition: "continue",
      reasonCodes: [],
      nextAction
    }
  });
}
