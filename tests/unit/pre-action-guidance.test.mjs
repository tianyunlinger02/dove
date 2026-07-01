import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPreActionGuidance,
  selectPreActionLessons,
  summarizePreActionGuidance
} from "../../src/core/index.mjs";

const GUIDANCE_CRITERION = "Guidance execution criterion";
const GUIDANCE_EVIDENCE_PATH = ".dove/evidence/guidance-verification.log";

function guidanceExecutionContract(overrides = {}) {
  const base = {
    chainType: "engineering-host-pass-verify",
    roleSequence: ["builder", "reviewer"],
    readFirst: [],
    action: "project:dove.auto",
    implementation: ["Produce guidance workflow evidence."],
    files: [],
    materials: {
      requiredInputs: [],
      requiredArtifacts: [],
      sourceRefs: [],
      artifactRefs: []
    },
    convergence: {
      criteria: [GUIDANCE_CRITERION],
      verificationCommands: ["node --test tests/unit/pre-action-guidance.test.mjs"],
      evidenceRequired: [GUIDANCE_EVIDENCE_PATH],
      definitionOfDone: "The guidance execution criterion is verified."
    },
    failureRoutes: [
      { on: "verification-failed", boundaryType: "verification-failed", nextAction: "project:dove.status", requiredActions: ["provide-verified-criteria"] }
    ]
  };
  return {
    ...base,
    ...overrides,
    roleSequence: overrides.roleSequence ?? base.roleSequence,
    readFirst: overrides.readFirst ?? base.readFirst,
    implementation: overrides.implementation ?? base.implementation,
    files: overrides.files ?? base.files,
    materials: {
      ...base.materials,
      ...(overrides.materials ?? {})
    },
    convergence: {
      ...base.convergence,
      ...(overrides.convergence ?? {})
    },
    failureRoutes: overrides.failureRoutes ?? base.failureRoutes
  };
}

test("pre-action guidance ranks active packet lessons and keeps guardrails explicit", () => {
  const operatorLessons = {
    lessons: [
      {
        id: "unrelated-active",
        title: "Unrelated active lesson",
        status: "active",
        nextTime: ["Keep as low priority."],
        tags: ["other"]
      },
      {
        id: "global-active",
        title: "Global active lesson",
        status: "active",
        nextTime: ["Use global guardrails."],
        tags: []
      },
      {
        id: "role-domain-stage",
        title: "Role domain stage lesson",
        status: "active",
        actorRole: "builder",
        domain: "engineering",
        stage: "execute",
        nextTime: ["Match builder engineering execution."],
        tags: ["figure"]
      },
      {
        id: "packet-bound",
        title: "Packet-bound lesson",
        status: "active",
        actorRole: "builder",
        domain: "engineering",
        stage: "execute",
        packetIds: ["packet-a"],
        nextTime: ["Respect the packet-specific constraint."],
        tags: ["figure"]
      },
      {
        id: "inactive-packet",
        title: "Inactive packet lesson",
        status: "inactive",
        packetIds: ["packet-a"],
        nextTime: ["Should not appear."],
        tags: ["figure"]
      }
    ]
  };

  const selected = selectPreActionLessons(operatorLessons, {
    packet: { id: "packet-a" },
    roleId: "builder",
    domain: "engineering",
    stage: "execute",
    tags: ["figure"]
  });
  assert.deepEqual(selected.map((lesson) => lesson.id), ["packet-bound", "role-domain-stage", "global-active"]);
  assert.equal(selected.some((lesson) => lesson.id === "inactive-packet"), false);

  const guidance = buildPreActionGuidance({
    surface: "dove.figure",
    responseLanguage: "zh",
    request: "Draw the workflow figure.",
    roleId: "builder",
    packet: { id: "packet-a", domain: "engineering", stage: "execute" },
    operatorLessons,
    nextAction: "project:dove.figure",
    workflowKind: "figure",
    domain: "engineering",
    stage: "execute",
    tags: ["figure"]
  });

  assert.equal(guidance.presentation, "dove-pre-action-guidance");
  assert.equal(guidance.mode, "read-only-guidance");
  assert.equal(guidance.intentFrame.ordinaryPromptFirst, true);
  assert.equal(guidance.intentFrame.missionAsWorkContract, true);
  assert.equal(guidance.roleFrame.primaryRole, "builder");
  assert.equal(guidance.lessonRecall.automatic, true);
  assert.equal(guidance.lessonRecall.readOnly, true);
  assert.equal(guidance.lessonRecall.recordingExplicitOnly, true);
  assert.equal(guidance.lessonRecall.lessonsPath, ".dove/meta/operator-lessons.json");
  assert.deepEqual(guidance.lessonRecall.topLessons.map((lesson) => lesson.id), ["packet-bound", "role-domain-stage", "global-active"]);
  assert.equal(guidance.guardrails.explicitOnly, true);
  assert.equal(guidance.guardrails.noHiddenRuntime, true);
  assert.equal(guidance.guardrails.noAutoApply, true);
  assert.equal(guidance.guardrails.requiresConfirmationForWrites, true);
  assert.equal(guidance.guardrails.boundedForegroundOnly, true);

  const summary = summarizePreActionGuidance(guidance);
  assert.equal(summary.presentation, "dove-pre-action-guidance-summary");
  assert.equal(summary.surface, "dove.figure");
  assert.equal(summary.primaryRole, "builder");
  assert.deepEqual(summary.lessonIds, ["packet-bound", "role-domain-stage", "global-active"]);
  assert.equal(summary.noHiddenRuntime, true);
  assert.equal(summary.requiresConfirmationForWrites, true);
  assert.equal(summary.recordingExplicitOnly, true);
});

test("pre-action guidance routes executable workflow gaps to planner builder and reviewer", () => {
  const missingContract = buildPreActionGuidance({
    surface: "dove.status",
    responseLanguage: "en",
    roleId: "builder",
    statusSummary: {
      executionGaps: {
        missingContractTaskIds: ["missing-contract-task"],
        missingMaterialTaskIds: ["missing-material-task"],
        verificationGapTaskIds: [],
        readyBuilderTaskIds: [],
        requiredMaterials: ["sources/cvpr-template.md"],
        evidenceRequired: ["executionContract"]
      }
    }
  });
  assert.equal(missingContract.workflowFrame.executionGuidance.executableContractPresent, false);
  assert.equal(missingContract.workflowFrame.executionGuidance.nextRole, "planner");
  assert.deepEqual(missingContract.workflowFrame.executionGuidance.missingContractTaskIds, ["missing-contract-task"]);
  assert.deepEqual(missingContract.workflowFrame.executionGuidance.missingMaterialTaskIds, ["missing-material-task"]);
  assert.deepEqual(missingContract.workflowFrame.executionGuidance.requiredMaterials, ["sources/cvpr-template.md"]);
  assert.deepEqual(missingContract.workflowFrame.executionGuidance.evidenceRequired, ["executionContract"]);
  assert.match(missingContract.workflowFrame.executionGuidance.stopCondition, /materials|Planner/);

  const readyBuilder = buildPreActionGuidance({
    surface: "dove.auto",
    responseLanguage: "en",
    roleId: "builder",
    statusSummary: {
      executionGaps: {
        missingContractTaskIds: [],
        missingMaterialTaskIds: [],
        verificationGapTaskIds: [],
        readyBuilderTaskIds: ["ready-builder-task"],
        requiredMaterials: [],
        evidenceRequired: [GUIDANCE_EVIDENCE_PATH]
      }
    }
  });
  assert.equal(readyBuilder.workflowFrame.executionGuidance.nextRole, "builder");
  assert.deepEqual(readyBuilder.workflowFrame.executionGuidance.readyBuilderTaskIds, ["ready-builder-task"]);
  assert.deepEqual(readyBuilder.workflowFrame.executionGuidance.evidenceRequired, [GUIDANCE_EVIDENCE_PATH]);
  assert.match(readyBuilder.workflowFrame.executionGuidance.stopCondition, /foreground pass/);

  const reviewerGate = buildPreActionGuidance({
    surface: "dove.review",
    responseLanguage: "en",
    roleId: "reviewer",
    packet: {
      id: "reviewer-gate-task",
      executionContract: guidanceExecutionContract(),
      verifiedCriteria: []
    }
  });
  assert.equal(reviewerGate.workflowFrame.executionGuidance.executableContractPresent, true);
  assert.equal(reviewerGate.workflowFrame.executionGuidance.executableContractReady, true);
  assert.equal(reviewerGate.workflowFrame.executionGuidance.nextRole, "reviewer");
  assert.deepEqual(reviewerGate.workflowFrame.executionGuidance.criteriaCoverage.missing, [GUIDANCE_CRITERION]);
  assert.equal(reviewerGate.workflowFrame.executionGuidance.criteriaCoverage.complete, false);
  assert.match(reviewerGate.workflowFrame.executionGuidance.stopCondition, /verification\/reviewer/);
});

test("pre-action guidance explains source note and document deposition routes", () => {
  const source = buildPreActionGuidance({
    surface: "dove.source",
    responseLanguage: "en",
    workflowKind: "source",
    tags: ["source"]
  });
  assert.equal(source.roleFrame.primaryRole, "builder");
  assert.equal(source.roleFrame.subagentSpecialty, "researcher");
  assert.match(source.intentFrame.interpretedIntent, /Register verified external links, templates, guidelines/);
  assert.match(source.intentFrame.interpretedIntent, /candidate links/);
  assert.match(source.workflowFrame.recommendedRoute, /register_source/);
  assert.match(source.workflowFrame.recommendedRoute, /candidate links separate/);
  assert.match(source.workflowFrame.recommendedRoute, /batch/);
  assert.match(source.workflowFrame.recommendedRoute, /upsert_note/);
  assert.match(source.workflowFrame.recommendedRoute, /record_document_evidence/);
  assert.equal(source.guardrails.noHiddenRuntime, true);
  assert.equal(source.lessonRecall.recordingExplicitOnly, true);

  const note = buildPreActionGuidance({
    surface: "dove.note",
    responseLanguage: "en",
    workflowKind: "note",
    tags: ["note"]
  });
  assert.equal(note.roleFrame.primaryRole, "builder");
  assert.equal(note.roleFrame.subagentSpecialty, "researcher");
  assert.match(note.intentFrame.interpretedIntent, /Synthesize registered sources/);
  assert.match(note.intentFrame.interpretedIntent, /must not be disguised as external sources/);
  assert.match(note.workflowFrame.recommendedRoute, /upsert_note/);
  assert.match(note.workflowFrame.recommendedRoute, /packet-bound synthesis/);
  assert.match(note.workflowFrame.recommendedRoute, /registered sources/);

  const documents = buildPreActionGuidance({
    surface: "dove.documents",
    responseLanguage: "en",
    workflowKind: "document-evidence",
    tags: ["document", "evidence"]
  });
  assert.equal(documents.roleFrame.primaryRole, "builder");
  assert.equal(documents.intentFrame.interpretedIntent, "Bind reports or outputs as document evidence to a durable packet while preserving source/artifact provenance.");
  assert.match(documents.workflowFrame.recommendedRoute, /record_document_evidence/);
  assert.match(documents.workflowFrame.recommendedRoute, /packet-bound report\/archive ledger/);
  assert.match(documents.workflowFrame.recommendedRoute, /source and artifact provenance/);
  assert.equal(documents.guardrails.boundedForegroundOnly, true);
});
