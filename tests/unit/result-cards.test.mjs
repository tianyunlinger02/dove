import test from "node:test";
import assert from "node:assert/strict";

import { buildCommandResultCard } from "../../src/core/result-cards.mjs";
import { assertNoCompactPublicLeaks } from "../helpers/compact-public.mjs";

test("buildCommandResultCard keeps compact output public-safe", () => {
  const card = buildCommandResultCard({
    surface: "dove.test",
    command: "dove.test",
    packetId: "task-internal-packet",
    packetIds: ["task-internal-packet"],
    runId: "run-internal",
    title: "Public result",
    status: "blocked",
    outcome: "missing-secret-env",
    happened: "已经准备好材料，等待操作者补输入。",
    durableWrites: [".dove/state.json", "已更新任务记录。"],
    evidencePaths: [".dove/evidence/result.log"],
    artifactPaths: [".dove/figures/method.final.svg"],
    validationEvidencePaths: [".dove/reviews/validation.json"],
    boundary: {
      id: "boundary-1",
      type: "missing-secret-env",
      boundaryType: "missing-secret-env",
      reason: "provider missing key",
      nextAction: "project:dove.figure",
      requiredInputs: [".dove/config.local.json", "提供图表输入。"],
      requiredActions: ["补一条可引用材料。", "project:dove.source"],
      resultPath: ".dove/runtime/result.json",
      detail: {
        implementationBoundaryType: "missing-secret-env",
        providerId: "gpt-image2",
        summary: "需要补环境变量引用。"
      }
    },
    scope: {
      kind: "figure",
      packetId: "task-internal-packet",
      figureId: "generated-figure-id",
      title: "方法流程图"
    },
    nextActions: [{
      title: "补一条可引用材料。",
      command: "project:dove.source",
      packetId: "task-internal-packet",
      boundaryId: "boundary-1",
      boundaryType: "missing-secret-env",
      ownerRole: "builder",
      nextRole: "reviewer",
      handoff: { ownerRole: "builder" },
      requiredActions: ["补材料", ".dove/evidence/result.log"]
    }],
    preActionGuidanceSummary: { primaryRole: "builder" },
    executionReceipt: {
      receiptId: "receipt-internal",
      runId: "run-internal",
      packetId: "task-internal-packet",
      status: "blocked",
      outcome: "missing-secret-env",
      publicSafeSummary: "已记录边界，等待操作者补输入。",
      evidencePaths: [".dove/evidence/result.log"],
      criteriaCoverage: { complete: true }
    }
  });

  assert.equal(card.presentation, "compact-result-summary-card");
  assert.equal(card.surface, "dove.test");
  assert.equal(card.command, "dove.test");
  assert.equal(card.boundary.type, "awaiting-provider-output");
  assert.deepEqual(card.scope, { kind: "figure", title: "方法流程图" });
  assert.deepEqual(card.nextActions, [{
    title: "补一条可引用材料。",
    requiredActions: ["补材料"],
    proposalOnly: true,
    noAutoApply: true
  }]);
  assert.equal(card.executionReceipt.status, "blocked");
  assert.equal(card.executionReceipt.evidenceCount, 1);
  assert.equal(card.executionReceipt.criteriaCoverage.complete, true);
  assert.equal(card.detailsAvailable, true);
  assertNoCompactPublicLeaks(card, { ignoredKeys: ["command"] });
});
