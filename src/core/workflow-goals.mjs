import fs from "node:fs";
import path from "node:path";

import { DOVE_RESEARCH_FORMAT } from "./schema.mjs";

function snapshot(root) {
  const files = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(fullPath);
      else files[path.relative(root, fullPath).split(path.sep).join("/")] = entry.isSymbolicLink() ? `link:${fs.readlinkSync(fullPath)}` : fs.readFileSync(fullPath).toString("base64");
    }
  };
  visit(root);
  return files;
}

async function invoke(dispatch, root, name, args) {
  const result = await dispatch(root, name, args);
  const research = result?.structuredContent?.research;
  if (result?.isError || !research || typeof research !== "object" || Array.isArray(research)) {
    throw new Error(`${name} failed: ${result?.content?.[0]?.text ?? "missing structured research result"}`);
  }
  return research;
}

async function initialize(root, dispatch) {
  return invoke(dispatch, root, "manage_dove_workspace", {
    operation: "initialize",
    researchQuestion: "Which explanation best accounts for the bounded result?",
    mainline: "Discriminate competing explanations with preserved adverse evidence.",
    contributionIntent: "Establish a bounded mechanism and explicit claim limit.",
    currentFocus: "Run one frozen discriminating experiment."
  });
}

async function createMission(root, dispatch) {
  return invoke(dispatch, root, "manage_dove_missions", {
    operation: "create",
    missionId: "semantic-preservation",
    goal: "Test competing explanations without discarding adverse evidence.",
    requirements: ["Preserve negative, null, failed, and stopped results."],
    assumptions: ["The fixture represents only its stated condition."],
    scope: ["One bounded comparison."],
    outOfScope: ["Population-level generalization."],
    evidenceRequirements: ["One frozen protocol and denominator-aware result."],
    competingHypotheses: ["mechanism-effect", "measurement-artifact"],
    openQuestions: ["Which explanation survives calibration?"],
    contextRefs: ["paper:results"],
    contributionRole: "hypothesis-discrimination"
  });
}

async function preservationGoal(root, dispatch) {
  await initialize(root, dispatch);
  await createMission(root, dispatch);
  await invoke(dispatch, root, "manage_dove_experiments", {
    operation: "freeze",
    missionId: "semantic-preservation",
    experimentId: "failed-run",
    title: "Frozen discriminating comparison",
    hypothesisRefs: ["mechanism-effect", "measurement-artifact"],
    protocol: ["Run the fixed comparison once."],
    inputs: ["repository-local fixture"],
    comparisons: ["baseline"],
    metrics: ["quality"],
    discriminatingObservations: ["Calibration removes the effect only under the artifact explanation."],
    successConditions: ["Account for every attempted case."],
    stopConditions: ["Stop after the bounded pass."],
    constraints: ["Keep the fixture and denominator unchanged."],
    expectedArtifacts: ["outputs/failed-run.json"],
    cost: "One bounded local run.",
    risk: "The run may fail before measurements are produced.",
    failureValue: "A failed run still identifies an unstable path.",
    contributionRole: "hypothesis-discrimination"
  });
  await invoke(dispatch, root, "manage_dove_experiments", {
    operation: "record-result",
    missionId: "semantic-preservation",
    experimentId: "failed-run",
    kind: "failed",
    summary: "Every attempted case failed before measurement.",
    observations: ["The adverse observation was retained."],
    measurements: [],
    denominator: { total: 3, observed: 0, failed: 3, excluded: 0 },
    hypothesisImpacts: [{ hypothesisRef: "mechanism-effect", impact: "weaken" }],
    claimImpacts: [{ claimRef: "bounded-claim", impact: "weaken" }],
    unexpectedObservations: ["Calibration also failed."],
    uncertainty: ["The failure cause remains unresolved."],
    artifactRefs: [],
    failures: ["All three attempts crashed."],
    deviations: ["No measurement was produced."],
    limitations: ["The result covers one fixture only."]
  });
  await invoke(dispatch, root, "manage_dove_claims", {
    operation: "record",
    missionId: "semantic-preservation",
    claims: [{
      claimId: "bounded-claim",
      statement: "The current evidence does not establish an improvement on this fixture.",
      supportRefs: ["experiment:failed-run"],
      counterEvidenceRefs: ["observation:calibration-failed"],
      missingEvidence: ["A successful calibrated replication."],
      cannotSay: ["Cannot infer population-level behavior."],
      uncertainty: ["The failure mechanism is unresolved."],
      assessment: "weakened",
      storyRole: "bounded-adverse-result",
      artifactRefs: []
    }]
  });

  const synthesis = await invoke(dispatch, root, "query_dove_research", { operation: "result-synthesis", missionId: "semantic-preservation" });
  const story = await invoke(dispatch, root, "query_dove_research", { operation: "claim-story", missionId: "semantic-preservation" });
  const result = synthesis.results?.find((entry) => entry.experimentId === "failed-run");
  const claim = story.claimEvidenceMatrix?.find((entry) => entry.claimId === "bounded-claim");
  if (result?.kind !== "failed" || result.denominator?.failed !== 3 || result.failures?.[0] !== "All three attempts crashed." || result.uncertainty?.[0] !== "The failure cause remains unresolved.") throw new Error("result synthesis did not preserve the failed result semantics");
  if (claim?.counterEvidenceRefs?.[0] !== "observation:calibration-failed" || claim?.missingEvidence?.[0] !== "A successful calibrated replication." || claim?.cannotSay?.[0] !== "Cannot infer population-level behavior.") throw new Error("claim story did not preserve the evidence boundary");
  return { id: "preserve-adverse-research", status: "passed", evidence: { resultKind: result.kind, failedDenominator: result.denominator.failed, failureCount: result.failures.length, cannotSayCount: claim.cannotSay.length } };
}

async function queryGoal(root, dispatch) {
  await initialize(root, dispatch);
  await createMission(root, dispatch);
  const before = snapshot(root);
  const overview = await invoke(dispatch, root, "query_dove_research", { operation: "overview", missionId: "semantic-preservation" });
  if (JSON.stringify(snapshot(root)) !== JSON.stringify(before)) throw new Error("research query changed the workspace");
  if (overview.zeroWrite !== true || overview.interpretationBoundary !== "Records and exact lineage only; no scientific meaning is inferred.") throw new Error("research query did not retain its zero-write semantic boundary");
  return { id: "queries-are-zero-write", status: "passed", evidence: { zeroWrite: true, format: DOVE_RESEARCH_FORMAT, missionCount: overview.inventory?.missions } };
}

export async function validateWorkflowGoals({ createRoot, cleanupRoot, dispatch } = {}) {
  if (typeof createRoot !== "function" || typeof cleanupRoot !== "function" || typeof dispatch !== "function") throw new Error("validateWorkflowGoals requires createRoot, cleanupRoot, and dispatch.");
  const results = [];
  for (const runner of [preservationGoal, queryGoal]) {
    const root = createRoot(`dove-research-format-1-${runner.name}-`);
    try { results.push(await runner(root, dispatch)); }
    finally { cleanupRoot(root); }
  }
  return { status: "passed", goalCount: results.length, results };
}
