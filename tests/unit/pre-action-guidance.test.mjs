import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPreActionGuidance,
  selectPreActionLessons,
  summarizePreActionGuidance
} from "../../src/core/index.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

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
