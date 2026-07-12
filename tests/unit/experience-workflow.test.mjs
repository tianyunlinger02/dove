import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  ensureWorkspace,
  initProject,
  runExperienceWorkflow
} from "../../src/core/index.mjs";
import { writeJson } from "../../src/core/workspace.mjs";
import { assertNoCompactPublicLeaks } from "../helpers/compact-public.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function tempRoot() {
  return createTempRoot("dove-experience-workflow-");
}

function seedTaskPacket(root, packetId = "experience-workflow-packet") {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: packetId,
    title: "Experience workflow packet",
    summary: "Test packet for experience workflow boundaries.",
    sourceType: "test-task",
    sourceId: packetId,
    status: "ready",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    currentFocus: "Record experiment evidence and bridge it to claims.",
    nextAction: "Run the experience workflow.",
    dependencies: [],
    evidenceLinks: [],
    outputPaths: [],
    packetPath: `.dove/task-packets/packets/${packetId}.json`,
    packetContextPath: `.dove/context/packets/${packetId}.json`,
    updatedAt: timestamp
  };
  writeJson(root, packet.packetPath, packet);
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, { version: 3, items: [packet], lifecycleCounts: {}, dependencyHealth: {}, updatedAt: timestamp });
  return packetId;
}

function seedExperienceContext(root) {
  ensureWorkspace(root);
  initProject(root, { title: "Experience Workflow Test", objective: "Validate experiment-to-claim boundaries." });
  return seedTaskPacket(root);
}

function writeEvidenceFile(root, relativePath, text = "Experiment evidence fixture.\n") {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text, "utf8");
  return relativePath;
}

test("runExperienceWorkflow returns a material boundary for blocked experiment audits", () => {
  const root = tempRoot();
  try {
    const packetId = seedExperienceContext(root);

    const result = runExperienceWorkflow(root, {
      packetId,
      experimentId: "audit-blocked",
      goal: "Check whether an incomplete experiment is blocked instead of fake-completed.",
      outcome: "pending"
    });

    assert.equal(result.status, "needs-review");
    assert.equal(result.audit.auditVerdict, "blocked");
    assert.equal(result.boundaryType, "missing-required-materials");
    assert.equal(result.boundary.type, "missing-required-materials");
    assert.deepEqual(result.boundary.requiredInputs.sort(), [
      "missing-claim-link",
      "missing-evidence-links",
      "missing-methodology",
      "missing-result-summary",
      "missing-success-metric",
      "pending-outcome"
    ].sort());
    for (const action of [
      "link-result-to-claim-or-create-claim",
      "attach-experiment-evidence",
      "provide-experiment-methodology",
      "provide-success-metric",
      "provide-result-summary",
      "provide-concrete-outcome"
    ]) {
      assert.ok(result.requiredActions.includes(action), `${action} should be required`);
    }
    assert.deepEqual(result.validationEvidencePaths, [ARTIFACT_PATHS.experimentAudits]);
    assert.equal(result.nextAction, "project:dove.experience");
    assertNoCompactPublicLeaks(result.resultCard, { ignoredKeys: ["command"] });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runExperienceWorkflow returns a material boundary when a clean result references a missing claim", () => {
  const root = tempRoot();
  try {
    const packetId = seedExperienceContext(root);
    writeJson(root, ARTIFACT_PATHS.evidence, {
      version: 3,
      claims: [{ id: "existing-claim", text: "Existing claim for contrast.", status: "needs-review" }],
      updatedAt: new Date(0).toISOString()
    });

    const result = runExperienceWorkflow(root, {
      packetId,
      experimentId: "missing-claim-bridge",
      title: "Missing claim bridge experiment",
      goal: "Validate clean experiment bridge handling.",
      methodology: "Compare the generated evidence with the claim acceptance criteria.",
      successMetric: "All claim criteria are supported by the result artifact.",
      claimId: "missing-claim",
      outcome: "supports",
      summary: "The result supports a claim that has not been created yet.",
      evidenceLinks: [writeEvidenceFile(root, ARTIFACT_PATHS.experimentLog, [
        "# Experiment Log",
        "",
        "## missing-claim-bridge",
        "",
        "- Method: Compared generated evidence with the claim acceptance criteria.",
        "- Outcome: supports",
        "- Observation: Every acceptance criterion matched the generated result.",
        ""
      ].join("\n"))],
      responseLanguage: "en"
    });

    assert.equal(result.status, "needs-review");
    assert.equal(result.audit.auditVerdict, "clean");
    assert.deepEqual(result.audit.integrityFlags, []);
    assert.deepEqual(result.audit.evidencePathIntegrity.existingPaths, [ARTIFACT_PATHS.experimentLog]);
    assert.equal(result.audit.evidencePathIntegrity.problemCount, 0);
    assert.equal(result.audit.evidencePathIntegrity.items[0].evidenceRole, "conditional");
    assert.equal(result.audit.evidencePathIntegrity.items[0].status, "existing");
    assert.equal(result.bridge.status, "held-missing-claim");
    assert.equal(result.boundaryType, "missing-required-materials");
    assert.equal(result.boundary.type, "missing-required-materials");
    assert.deepEqual(result.boundary.requiredInputs, ["missing-claim"]);
    assert.deepEqual(result.requiredActions, ["create-or-link-claim-before-bridge"]);
    assert.equal(result.nextAction, "project:dove.experience");
    assert.ok(result.artifactRefs.includes(ARTIFACT_PATHS.claimBridgeLog));
    assert.equal(result.resultCard.status, "needs-review");
    assert.equal(result.resultCard.completed, false);
    assert.equal(result.resultCard.stopped, true);
    assert.equal(result.resultCard.requiresAction, true);
    assert.equal(result.resultCard.boundary.type, "missing-required-materials");
    assert.match(result.resultCard.boundary.summary, /target claim does not exist/u);
    assert.deepEqual(result.resultCard.boundary.requiredActions, [
      "Create the target claim or link the result to an existing claim before retrying the bridge."
    ]);
    assert.equal(result.resultCard.nextActions[0].title, "Create or relink the target claim first");
    assert.match(result.resultCard.nextActions[0].why, /bridge is not complete/u);
    assertNoCompactPublicLeaks(result.resultCard, { ignoredKeys: ["command"] });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
