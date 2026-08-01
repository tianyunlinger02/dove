import test from "node:test";
import assert from "node:assert/strict";

import { buildPublicStatusProjection } from "../../src/core/mission-queries.mjs";
import { buildProjectResearchNarrative } from "../../src/core/project-research-narratives.mjs";
import { operationForTool } from "../../src/core/operation-registry.mjs";
import { classifyInvocationOutcome } from "../../src/core/operational-outcome.mjs";
import { publicResult, renderPublicReport } from "../../src/core/public-reports.mjs";

function statusData(overrides = {}) {
  return {
    status: "ok",
    detailsAvailable: true,
    currentContext: {
      missionCount: 1,
      missionScope: "only-mission",
      receiptCount: 1,
      sourceCount: 0,
      integrityAssessment: {
        complete: false,
        ordinaryHostReturn: { present: false },
        operationalIntegrity: {
          hostActionReturned: false,
          receiptRecorded: true,
          completionEvidenceSatisfied: false,
          lifecycleClosed: false
        }
      },
      reviewValidity: { authority: "not-established", currentCount: 0, staleCount: 0, failures: [] },
      narrativeState: "available",
      narrativeKind: "mission",
      researchNarrative: {
        researchDirection: "Interpret the bounded execution result.",
        currentUnderstanding: ["The bounded execution result has been recorded."],
        evidence: ["One current outcome record is available."],
        unknowns: ["The scientific judgment has not consumed the result."],
        currentValueJudgment: "Reevaluation has priority over repeating the previous action.",
        nextStep: "Reevaluate the recorded execution evidence before authorizing another action.",
        stopReason: null,
        rejectedDirections: [],
        applicableLessons: []
      }
    },
    durableStatus: {
      state: "current",
      workspaceGraph: {
        bounded: true,
        missions: {
          totalCount: 1,
          truncated: false,
          items: [{
            displayIndex: 0,
            complete: false,
            declaredOutputs: [{ path: "outputs/result.md", present: true }],
            uncoveredOutputs: ["outputs/result.md"],
            uncoveredCompletionCriteria: ["Interpret the result."],
            unmetEvidenceRequirements: ["artifact:outputs/result.md"]
          }]
        },
        workItems: { totalCount: 1, truncated: false, items: [{ status: "blocked" }] },
        artifacts: { totalCount: 0, truncated: false, items: [] }
      }
    },
    needsAttention: {
      summary: "Repeat the previous action to address the gap.",
      reasons: ["research-outcome-awaiting-reevaluation"],
      stableGaps: {
        completion: ["research-outcome-awaiting-reevaluation"],
        review: [],
        research: [{ code: "research-outcome-awaiting-reevaluation" }]
      }
    },
    nextStep: { label: "Repeat the previous action." },
    ...overrides
  };
}

function publicReport(data) {
  const invocation = classifyInvocationOutcome(data, operationForTool("query_dove_status"));
  return publicResult("query_dove_status", data, invocation).report;
}

test("durable status builds one locale-neutral projection with canonical reevaluation recommendation", () => {
  const projection = buildPublicStatusProjection(statusData());

  assert.equal(projection.progress.blockedItems, 1);
  assert.equal(projection.workStatus.state, "work-produced");
  assert.deepEqual(projection.workStatus.currentOutputs, ["outputs/result.md"]);
  assert.equal(projection.recommendation, projection.researchNarrative.nextStep);
  assert.match(projection.recommendation, /Reevaluate the recorded execution evidence/iu);
  assert.doesNotMatch(JSON.stringify(projection), /Repeat the previous action/iu);
  assert.equal(projection.risksAndBlockers.every((risk) => !Object.hasOwn(risk, "recommendedAction")), true);
  assert.doesNotMatch(JSON.stringify(projection), /\p{Script=Han}/u);
});

test("canonical project narrative supplies the workspace recommendation unchanged", () => {
  const projectNarrative = buildProjectResearchNarrative({
    mainline: "Determine the strongest evidence-backed project direction.",
    activeDirections: [{ direction: "Interpret the bounded outcome.", currentUnderstanding: "Execution evidence awaits judgment." }],
    evidence: ["One bounded outcome is recorded."],
    unknowns: ["Whether the outcome changes the current direction."],
    rejectedDirections: [],
    historicalWorkWithoutJudgment: [],
    currentValueJudgment: "Scientific reevaluation is the highest-value next step.",
    recommendation: "Reevaluate the recorded execution evidence for the bounded outcome.",
    recommendationReason: "The current scientific judgment has not consumed it.",
    applicableLessons: []
  });
  const data = statusData({
    currentContext: {
      ...statusData().currentContext,
      missionCount: 2,
      missionScope: "workspace",
      narrativeKind: "project",
      researchNarrative: projectNarrative
    }
  });

  const projection = buildPublicStatusProjection(data);
  assert.equal(projection.recommendation, projectNarrative.recommendation);
  assert.equal(publicReport({ ...data, publicStatus: projection }).recommendation, projectNarrative.recommendation);
});

test("public reports privacy-project the canonical DTO without re-deriving status policy", () => {
  const canonical = buildPublicStatusProjection(statusData());
  const contradictoryRawState = statusData({
    publicStatus: canonical,
    currentContext: {
      missionCount: 9,
      missionScope: "workspace",
      receiptCount: 99,
      sourceCount: 99,
      integrityAssessment: { complete: true },
      reviewValidity: { authority: "not-established", currentCount: 9, staleCount: 0, failures: [] },
      narrativeState: "unavailable",
      narrativeKind: null,
      researchNarrative: null
    },
    durableStatus: {
      state: "current",
      workspaceGraph: {
        bounded: true,
        missions: { totalCount: 0, truncated: false, items: [] },
        workItems: { totalCount: 1, truncated: false, items: [{ status: "completed" }] },
        artifacts: { totalCount: 1, truncated: false, items: [{ path: "contradictory.md" }] }
      }
    }
  });

  const report = publicReport(contradictoryRawState);
  assert.equal(report.currentSituation.trackedWorkstreams, canonical.currentSituation.trackedWorkstreams);
  assert.deepEqual(report.progress, canonical.progress);
  assert.deepEqual(report.workStatus.currentOutputs, canonical.workStatus.currentOutputs);
  assert.equal(report.workStatus.state, canonical.workStatus.state);
  assert.equal(report.evidenceStatus.currentEvidenceCount, canonical.evidenceStatus.currentEvidenceCount);
  assert.equal(report.recommendation, canonical.recommendation);
  assert.doesNotMatch(JSON.stringify(report), /research-outcome-awaiting-reevaluation/u);

  const english = renderPublicReport(report, { language: "en" });
  const chinese = renderPublicReport(report, { language: "zh" });
  assert.match(english, /Reevaluate the recorded execution evidence/iu);
  assert.equal(english.match(/Reevaluate the recorded execution evidence/giu)?.length, 1);
  assert.match(chinese, /科研脉络/u);
  assert.equal(chinese.match(/Reevaluate the recorded execution evidence/giu)?.length, 1);
});
