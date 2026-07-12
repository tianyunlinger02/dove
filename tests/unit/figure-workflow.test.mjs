import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  ensureWorkspace,
  initProject,
  readJson,
  registerSource,
  runFigureWorkflow,
  upsertClaims,
  upsertFigurePlan,
  upsertNote,
  verifySource
} from "../../src/core/index.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { writeJson } from "../../src/core/workspace.mjs";
import { assertNoCompactPublicLeaks } from "../helpers/compact-public.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function tempRoot() {
  return createTempRoot("dove-figure-workflow-");
}

function seedTaskPacket(root, packetId = "figure-workflow-packet") {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: packetId,
    title: "Figure workflow packet",
    summary: "Test packet for the composite figure workflow.",
    sourceType: "test-task",
    sourceId: packetId,
    status: "pending",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    currentFocus: "Generate a paper figure from intent.",
    nextAction: "Run the composite figure workflow.",
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

function seedFigureWorkflowContext(root) {
  ensureWorkspace(root);
  initProject(root, { title: "Figure Workflow Test", objective: "Generate a figure from one user intent." });
  const packetId = seedTaskPacket(root);
  const state = readJson(root, ARTIFACT_PATHS.state, {});
  writeJson(root, ARTIFACT_PATHS.state, {
    ...state,
    sections: {
      ...(state.sections ?? {}),
      method: {
        id: "method",
        title: "Method",
        status: "drafting",
        draftPath: ".dove/drafts/method.md",
        summary: "Method section context for the figure."
      }
    }
  });
  const source = registerSource(root, { packetId, citationKey: "figure-workflow-source", title: "Figure Workflow Source", authors: ["Doe"], year: 2026, sourceType: "paper" });
  verifySource(root, {
    packetId,
    sourceId: source.id,
    decision: "verified",
    method: "test fixture inspected the canonical publication record",
    checkedMaterial: "source title, authors, year, and publication metadata",
    auditEvidence: [`fixture:${source.id}`]
  });
  const note = upsertNote(root, { packetId, noteId: "figure-workflow-note", title: "Figure workflow note", sectionId: "method", sourceIds: [source.id], summary: "Source-backed material for the figure." });
  upsertClaims(root, {
    packetId,
    claims: [{ id: "claim-figure-workflow", text: "A single figure can explain the evidence-to-claim workflow.", sectionId: "method", sourceIds: [source.id], noteIds: [note.id] }]
  });
  return packetId;
}

function readFigures(root) {
  return readJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [] });
}

function assertFigureResultCard(result, expected = {}) {
  assert.ok(result.resultCard && typeof result.resultCard === "object");
  assert.equal(result.resultCard.presentation, "compact-result-summary-card");
  assert.equal(result.resultCard.surface, "dove.figure");
  assert.equal(result.resultCard.command, "run_figure_workflow");
  assert.equal(result.resultCard.status, expected.status ?? result.status);
  assert.equal(result.resultCard.scope.kind, "figure");
  assert.equal("figureId" in result.resultCard.scope, false);
  assert.equal("packetId" in result.resultCard.scope, false);
  if (expected.happened) {
    assert.match(result.resultCard.happened, expected.happened);
  }
  const action = result.resultCard.nextActions[0];
  assert.ok(action && typeof action === "object");
  if (expected.nextActionTitle) {
    assert.match(action.title, expected.nextActionTitle);
  }
  if (expected.nextActionCommand) {
    assert.equal("command" in action, false);
  }
  if (expected.boundaryType) {
    assert.equal(result.resultCard.boundary?.type, expected.boundaryType);
    assert.equal(result.resultCard.boundary?.detail?.implementationBoundaryType, undefined);
    assert.equal(result.resultCard.boundary?.detail?.implementationReason, undefined);
    assert.equal("boundaryType" in action, false);
    assert.equal("boundary" in action, false);
  }
  for (const key of ["sourceSvgPath", "finalSvgPath", "qaPath", "providerExecution", "providerReadiness", "figureQa", "plan"]) {
    assert.equal(key in result.resultCard, false, `figure resultCard leaked ${key}`);
  }
  for (const key of ["artifactRefs", "artifactPaths", "evidencePaths", "validationEvidencePaths", "qaPath", "resultPath"]) {
    assert.equal(key in (result.resultCard.boundary ?? {}), false, `figure resultCard boundary leaked ${key}`);
  }
  assertNoCompactPublicLeaks(result.resultCard, { ignoredKeys: ["command"] });
}

test("runFigureWorkflow does not expose generated figure ids in public summaries", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);

    const result = runFigureWorkflow(root, {
      packetId,
      intent: "准备一张方法流程图，先走手工 SVG，不调用 gpt-image2"
    });

    assert.equal(result.status, "prepared-awaiting-output");
    assert.match(result.figureId, /gpt-image2/);
    assert.doesNotMatch(result.resultCard.happened, new RegExp(result.figureId));
    assert.doesNotMatch(result.resultCard.happened, /gpt-image2/);
    assert.match(result.resultCard.happened, /这张图的计划和材料包已经准备好/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow turns one SVG-backed intent into a validated figure", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);

    const result = runFigureWorkflow(root, {
      packetId,
      figureId: "single-intent",
      runId: "single-intent-run",
      intent: "Draw the evidence-to-claim workflow for the method section.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      requiredVisualElements: ["evidence node", "claim node", "review gate"],
      svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Evidence node flows to claim node through review gate</text></svg>",
      caption: "The figure explains how source-backed evidence flows through a review gate into a paper claim."
    });

    assert.equal(result.status, "validated");
    assert.equal(result.materialStatus, "ready");
    assert.equal(result.qaIssueCount, 0);
    assert.equal(result.captionId, "single-intent-single-intent-run-caption");
    assert.equal(result.finalSvgPath, ".dove/figures/single-intent.final.svg");
    assert.equal(result.stageFiles.templateCreated, true);
    assert.equal(result.stageFiles.editableCreated, true);
    assert.equal(result.boundary, null);
    assert.equal(result.boundaryType, null);
    assertFigureResultCard(result, {
      status: "validated",
      figureId: "single-intent",
      packetId,
      happened: /通过当前图检查|ready for review/,
      nextActionTitle: /review/,
      nextActionCommand: "project:dove.review"
    });
    assert.ok(result.artifactRefs.includes(ARTIFACT_PATHS.figureQa));
    assert.deepEqual(result.validationEvidencePaths, [ARTIFACT_PATHS.figureQa]);
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "single-intent.final.svg")), true);

    const captions = readJson(root, ARTIFACT_PATHS.figureCaptions, { version: 1, items: [] });
    assert.match(captions.items[0].text, /single-intent-run/);
    const figure = readFigures(root).items.find((item) => item.id === "single-intent");
    assert.equal(figure.status, "generated");
    assert.deepEqual(figure.targetClaimIds, ["claim-figure-workflow"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow result card focuses current-figure QA issues", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);

    const result = runFigureWorkflow(root, {
      packetId,
      figureId: "qa-needs-attention",
      runId: "qa-needs-attention-run",
      intent: "Draw a figure that intentionally misses one visual element.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      requiredVisualElements: ["evidence node", "review gate"],
      svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Evidence node only</text></svg>",
      caption: "Evidence-only figure caption."
    });

    assert.equal(result.status, "qa-needs-attention");
    assert.ok(result.qaIssueCount > 0);
    assertFigureResultCard(result, {
      status: "qa-needs-attention",
      figureId: "qa-needs-attention",
      packetId,
      happened: /当前图还有|still has/,
      nextActionTitle: /需要修|review issues/,
      nextActionCommand: "project:dove.review",
      boundaryType: "verification-failed"
    });
    assert.match(result.resultCard.happened, /当前图|this figure/);
    assert.doesNotMatch(result.resultCard.happened, /workspace|全工作区|全局/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow validates current figure despite unrelated workspace QA issues", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);
    upsertFigurePlan(root, {
      packetId,
      items: [{
        id: "unrelated-broken",
        name: "Unrelated Broken Figure",
        sourceSections: ["method"],
        targetClaimIds: ["claim-figure-workflow"],
        narrativeIntent: "This unrelated figure is intentionally incomplete.",
        requiredVisualElements: ["broken node"],
        templateSvgPath: ".dove/figures/unrelated-broken.template.svg",
        editableSvgPath: ".dove/figures/unrelated-broken.editable.svg",
        finalSvgPath: ".dove/figures/unrelated-broken.final.svg",
        captionIntent: "Broken figure caption intent."
      }]
    });

    const result = runFigureWorkflow(root, {
      packetId,
      figureId: "scoped-clean",
      runId: "scoped-clean-run",
      intent: "Draw the scoped clean figure.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      requiredVisualElements: ["scoped node"],
      svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Scoped node</text></svg>",
      caption: "Scoped node figure for the evidence workflow."
    });

    assert.equal(result.status, "validated");
    assert.equal(result.qaIssueCount, 0);
    assert.ok(result.workspaceQaIssueCount > 0);
    assert.equal(result.boundary, null);
    assert.equal(result.nextAction, "project:dove.review");
    assertFigureResultCard(result, {
      status: "validated",
      figureId: "scoped-clean",
      packetId,
      happened: /通过当前图检查|ready for review/,
      nextActionCommand: "project:dove.review"
    });
    assert.doesNotMatch(result.resultCard.happened, /workspace|全工作区|全局|unrelated|12/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow imports sourceSvgPath into the canonical final target", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);
    const sourceSvgPath = ".dove/figures/runs/source-path-run/manual.svg";
    fs.mkdirSync(path.dirname(path.join(root, sourceSvgPath)), { recursive: true });
    fs.writeFileSync(path.join(root, sourceSvgPath), "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Manual source node</text></svg>\n", "utf8");

    const result = runFigureWorkflow(root, {
      packetId,
      figureId: "source-path",
      runId: "source-path-run",
      intent: "Draw the manual source figure.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      requiredVisualElements: ["manual source node"],
      sourceSvgPath,
      caption: "Manual source node figure for the evidence workflow."
    });

    assert.equal(result.status, "validated");
    assert.equal(result.imported.sourceSvgPath, sourceSvgPath);
    assert.equal(result.finalSvgPath, ".dove/figures/source-path.final.svg");
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "source-path.final.svg")), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow accepts targetFinalSvgPath as the canonical final artifact target", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);

    const result = runFigureWorkflow(root, {
      packetId,
      figureId: "target-final",
      runId: "target-final-run",
      intent: "Draw the figure into a named final target.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      requiredVisualElements: ["target node"],
      targetFinalSvgPath: ".dove/figures/custom-target.final.svg",
      svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Target node</text></svg>",
      caption: "Target node figure for the evidence workflow."
    });

    assert.equal(result.status, "validated");
    assert.equal(result.finalSvgPath, ".dove/figures/custom-target.final.svg");
    const figure = readFigures(root).items.find((item) => item.id === "target-final");
    assert.equal(figure.finalSvgPath, ".dove/figures/custom-target.final.svg");
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "custom-target.final.svg")), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow rejects legacy finalSvgPath input", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);

    assert.throws(() => runFigureWorkflow(root, {
      packetId,
      figureId: "legacy-final-input",
      runId: "legacy-final-input-run",
      intent: "Draw a figure with the old source field.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      finalSvgPath: ".dove/figures/runs/legacy-final-input-run/manual.svg",
      caption: "Legacy field should be rejected."
    }), /no longer accepts finalSvgPath/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow imports inline SVG as patch-plan operations without writing final files", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);

    const result = runWithMutationContext(root, { actionId: "figure-workflow-inline-svg-patch-plan", mutationMode: "patch-plan" }, () => runFigureWorkflow(root, {
      packetId,
      figureId: "inline-svg-patch-plan",
      runId: "inline-svg-patch-plan-run",
      intent: "Draw the evidence-to-claim workflow for the method section in patch-plan mode.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      requiredVisualElements: ["evidence node", "claim node", "review gate"],
      svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Evidence node flows to claim node through review gate</text></svg>",
      caption: "The figure explains how source-backed evidence flows through a review gate into a paper claim."
    }));

    assert.equal(result.status, "validated");
    assert.equal(result.mutationMode, "patch-plan");
    assert.equal(result.writesApplied, false);
    assert.equal(result.hostRollbackEligible, true);
    assert.match(result.resultCard.durableWrites[0], /没有声明新的持久写入|no new durable writes/i);
    assert.doesNotMatch(result.resultCard.durableWrites[0], /已更新图表计划|Updated the figure plan/i);
    assert.equal(result.finalSvgPath, ".dove/figures/inline-svg-patch-plan.final.svg");
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "inline-svg-patch-plan.final.svg")), false);
    assert.ok(result.mutationPlan.operations.some((operation) => operation.relativePath === ".dove/figures/inline-svg-patch-plan.final.svg"));
    assert.ok(result.mutationPlan.operations.some((operation) => operation.relativePath === ARTIFACT_PATHS.figureQa));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow auto-imports completed external-command provider output", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);
    const providerScript = path.join(root, "fake-figure-provider.cjs");
    fs.writeFileSync(providerScript, `#!/usr/bin/env node
const fs = require("node:fs");
const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.stdout.write(JSON.stringify({
  sourceSvgPath: ".dove/figures/runs/" + input.runId + "/provider.svg",
  svgContent: "<svg xmlns=\\"http://www.w3.org/2000/svg\\"><text>Provider output claim node</text></svg>",
  caption: "Provider generated the workflow figure for the claim node.",
  semanticCoverage: { visualElements: ["provider output", "claim node"] }
}));
`, "utf8");
    fs.chmodSync(providerScript, 0o755);

    const result = runFigureWorkflow(root, {
      packetId,
      figureId: "provider-intent",
      runId: "provider-intent-run",
      intent: "Draw the provider-generated evidence workflow figure.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      requiredVisualElements: ["provider output", "claim node"],
      executeProvider: true,
      env: {
        DOVE_FIGURE_PROVIDER_ID: "fake-command",
        DOVE_FIGURE_PROVIDER_TYPE: "external-command",
        DOVE_FIGURE_COMMAND: providerScript
      }
    });

    assert.equal(result.status, "validated");
    assert.equal(result.diagnostics.providerExecution.status, "completed");
    assert.equal(result.imported.finalSvgPath, ".dove/figures/provider-intent.final.svg");
    assertFigureResultCard(result, {
      status: "validated",
      figureId: "provider-intent",
      packetId,
      happened: /通过当前图检查|ready for review/,
      nextActionCommand: "project:dove.review"
    });
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "provider-intent.final.svg")), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow keeps provider execution as a direct-process boundary in patch-plan mode", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);
    const providerScript = path.join(root, "patch-plan-workflow-provider.cjs");
    fs.writeFileSync(providerScript, `#!/usr/bin/env node
const fs = require("node:fs");
fs.writeFileSync("workflow-provider-spawned.txt", "spawned", "utf8");
process.stdout.write(JSON.stringify({
  sourceSvgPath: ".dove/figures/runs/patch-plan-workflow-run/provider.svg",
  svgContent: "<svg xmlns=\\"http://www.w3.org/2000/svg\\"><text>Provider output claim node</text></svg>",
  caption: "Provider generated the workflow figure for the claim node."
}));
`, "utf8");
    fs.chmodSync(providerScript, 0o755);

    const result = runWithMutationContext(root, { actionId: "figure-workflow-patch-plan", mutationMode: "patch-plan" }, () => runFigureWorkflow(root, {
      packetId,
      figureId: "patch-plan-workflow",
      runId: "patch-plan-workflow-run",
      intent: "Draw the provider-generated evidence workflow figure in patch-plan mode.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      requiredVisualElements: ["provider output", "claim node"],
      executeProvider: true,
      env: {
        DOVE_FIGURE_PROVIDER_ID: "patch-plan-workflow-command",
        DOVE_FIGURE_PROVIDER_TYPE: "external-command",
        DOVE_FIGURE_COMMAND: providerScript
      }
    }));

    assert.equal(result.status, "prepared-awaiting-output");
    assert.equal(result.diagnostics.providerExecution.status, "awaiting-provider-output");
    assert.equal(result.diagnostics.providerExecution.requiredMutationMode, "direct-process");
    assert.equal(result.boundaryType, "awaiting-provider-output");
    assert.equal(result.boundary.type, "awaiting-provider-output");
    assertFigureResultCard(result, {
      status: "prepared-awaiting-output",
      figureId: "patch-plan-workflow",
      packetId,
      happened: /缺 SVG 输出|needs SVG output/,
      nextActionTitle: /SVG|provider/,
      nextActionCommand: "project:dove.figure",
      boundaryType: "awaiting-provider-output"
    });
    assert.ok(result.requiredActions.includes("retry-with-mutationMode-direct-process"));
    assert.ok(result.boundary.requiredInputs.includes("mutationMode: direct-process"));
    assert.equal(result.imported, null);
    assert.equal(result.finalSvgPath, null);
    assert.equal(result.mutationMode, "patch-plan");
    assert.equal(result.writesApplied, false);
    assert.equal(fs.existsSync(path.join(root, "workflow-provider-spawned.txt")), false);
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "patch-plan-workflow.final.svg")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow prepares materials without marking a final figure ready when no output exists", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);

    const result = runFigureWorkflow(root, {
      packetId,
      figureId: "prepared-only",
      runId: "prepared-only-run",
      intent: "Prepare a figure bundle for later drawing.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      requiredVisualElements: ["draft prompt"]
    });

    assert.equal(result.status, "prepared-awaiting-output");
    assert.equal(result.imported, null);
    assert.equal(result.finalSvgPath, null);
    assert.equal(result.materialStatus, "ready");
    assert.equal(result.boundaryType, "awaiting-provider-output");
    assert.equal(result.boundary.type, "awaiting-provider-output");
    assert.deepEqual(result.boundary.requiredInputs, ["sourceSvgPath-or-outputManifestPath-or-svgContent"]);
    assertFigureResultCard(result, {
      status: "prepared-awaiting-output",
      figureId: "prepared-only",
      packetId,
      happened: /缺 SVG 输出|needs SVG output/,
      nextActionTitle: /SVG/,
      nextActionCommand: "project:dove.figure",
      boundaryType: "awaiting-provider-output"
    });
    assert.ok(result.requiredActions.includes("run-provider-or-import-output"));
    assert.ok(result.artifactRefs.includes(ARTIFACT_PATHS.figureGenerations));
    assert.deepEqual(result.validationEvidencePaths, [ARTIFACT_PATHS.figureQa]);
    assert.equal(result.nextAction, "project:dove.figure");
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "prepared-only.final.svg")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow treats providerId none as a plan-only figure run", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);

    const result = runFigureWorkflow(root, {
      packetId,
      figureId: "plan-only-provider-none",
      runId: "plan-only-provider-none-run",
      intent: "Prepare a figure plan without generating art yet.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      requiredVisualElements: ["plan-only node"],
      providerId: "none",
      executeProvider: false,
      env: {
        DOVE_FIGURE_PROVIDER_ID: "default-command-provider",
        DOVE_FIGURE_PROVIDER_TYPE: "external-command",
        DOVE_FIGURE_COMMAND: process.execPath
      }
    });

    assert.equal(result.status, "prepared-awaiting-output");
    assert.equal(result.diagnostics.providerReadiness.status, "not-configured");
    assert.equal(result.diagnostics.providerExecution, null);
    assert.equal(result.boundaryType, "awaiting-provider-output");
    assertFigureResultCard(result, {
      status: "prepared-awaiting-output",
      figureId: "plan-only-provider-none",
      packetId,
      happened: /缺 SVG 输出|needs SVG output/,
      nextActionTitle: /SVG/,
      nextActionCommand: "project:dove.figure",
      boundaryType: "awaiting-provider-output"
    });
    assert.ok(result.requiredActions.includes("run-provider-or-import-output"));
    assert.equal(result.imported, null);
    assert.equal(result.finalSvgPath, null);
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "plan-only-provider-none.final.svg")), false);
    const figure = readFigures(root).items.find((item) => item.id === "plan-only-provider-none");
    assert.equal(figure.generationProviderId, "none");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow reports no durable writes when blocked before planning", () => {
  const root = tempRoot();
  try {
    ensureWorkspace(root);
    initProject(root, { title: "Figure Pre-plan Boundary", objective: "Require real figure materials before planning." });
    const packetId = seedTaskPacket(root, "pre-plan-no-materials-packet");
    const result = runWithMutationContext(root, { actionId: "figure-pre-plan-boundary", mutationMode: "direct-process" }, () => runFigureWorkflow(root, {
      packetId,
      figureId: "pre-plan-no-materials",
      runId: "pre-plan-no-materials-run",
      intent: "Draw a figure without claim, experiment, caption, visual, or source material.",
      requiredVisualElements: []
    }));
    assert.equal(result.status, "blocked-missing-materials");
    assert.equal(result.writesApplied, false);
    assert.equal(result.mutationPlan, undefined);
    assert.match(result.resultCard.durableWrites[0], /没有声明新的持久写入|no new durable writes/i);
    assert.doesNotMatch(result.resultCard.durableWrites[0], /已更新图表计划|Updated the figure plan/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow surfaces missing figure materials as a boundary", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);

    const result = runFigureWorkflow(root, {
      packetId,
      figureId: "missing-materials",
      runId: "missing-materials-run",
      intent: "Prepare a figure that depends on an absent artifact.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      sourceArtifactPaths: [".dove/figures/missing-material.csv"],
      requiredVisualElements: ["missing artifact marker"]
    });

    assert.equal(result.status, "blocked-missing-materials");
    assert.equal(result.materialStatus, "needs-materials");
    assert.equal(result.boundaryType, "missing-required-materials");
    assert.equal(result.boundary.type, "missing-required-materials");
    assert.equal(result.boundary.requiredInputs.some((item) => item.includes("missing-material")), true);
    assertFigureResultCard(result, {
      status: "blocked-missing-materials",
      figureId: "missing-materials",
      packetId,
      happened: /缺材料|missing materials/,
      nextActionTitle: /补|missing materials/,
      nextActionCommand: "project:dove.figure",
      boundaryType: "missing-required-materials"
    });
    assert.ok(result.requiredActions.includes("provide-figure-materials"));
    assert.ok(result.requiredActions.includes("resolve-missing-figure-requirements"));
    assert.equal(result.nextAction, "project:dove.figure");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow surfaces provider failures as a boundary", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);
    const providerScript = path.join(root, "failing-figure-provider.cjs");
    fs.writeFileSync(providerScript, `#!/usr/bin/env node
process.stderr.write("provider failed intentionally");
process.exit(3);
`, "utf8");
    fs.chmodSync(providerScript, 0o755);

    const result = runFigureWorkflow(root, {
      packetId,
      figureId: "provider-failure",
      runId: "provider-failure-run",
      intent: "Try to draw a figure with a provider that exits unsuccessfully.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      requiredVisualElements: ["provider failure marker"],
      executeProvider: true,
      env: {
        DOVE_CONFIG_PATH: path.join(root, "missing-config.json"),
        DOVE_FIGURE_PROVIDER_ID: "failing-command",
        DOVE_FIGURE_PROVIDER_TYPE: "external-command",
        DOVE_FIGURE_COMMAND: providerScript
      }
    });

    assert.equal(result.status, "blocked-boundary");
    assert.equal(result.diagnostics.providerExecution.status, "failed");
    assert.match(result.diagnostics.providerExecution.error, /provider failed intentionally/);
    assert.equal(result.boundaryType, "awaiting-provider-output");
    assert.equal(result.boundary.type, "awaiting-provider-output");
    assert.equal(result.boundary.detail.implementationBoundaryType, "provider-failed");
    assertFigureResultCard(result, {
      status: "blocked-boundary",
      figureId: "provider-failure",
      packetId,
      happened: /画图服务生成失败|Drawing-provider generation failed/,
      nextActionTitle: /provider|SVG/,
      nextActionCommand: "project:dove.figure",
      boundaryType: "awaiting-provider-output"
    });
    assert.deepEqual(result.boundary.requiredInputs, ["provider-error-resolution-or-manual-output"]);
    assert.ok(result.requiredActions.includes("fix-figure-provider-and-retry"));
    assert.ok(result.requiredActions.includes("import-manual-figure-output"));
    assert.equal(result.nextAction, "project:dove.figure");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow routes gpt-image2 missing key to a secret boundary", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);

    const result = runFigureWorkflow(root, {
      packetId,
      figureId: "gpt-image2-missing-key",
      runId: "gpt-image2-missing-key-run",
      intent: "Draw the gpt-image2 evidence workflow figure.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      requiredVisualElements: ["evidence node", "claim node"],
      providerId: "gpt-image2",
      executeProvider: true,
      env: {
        DOVE_CONFIG_PATH: path.join(root, "missing-config.json"),
        DOVE_FIGURE_PROVIDER_ID: "gpt-image2"
      }
    });

    assert.equal(result.status, "blocked-boundary");
    assert.equal(result.diagnostics.providerReadiness.status, "missing-secret-env");
    assert.equal(result.diagnostics.providerExecution.status, "missing-secret-env");
    assert.equal(result.diagnostics.providerExecution.apiKeyEnv, "OPENAI_API_KEY");
    assert.equal(result.boundaryType, "awaiting-provider-output");
    assert.equal(result.boundary.type, "awaiting-provider-output");
    assert.equal(result.boundary.detail.implementationBoundaryType, "missing-secret-env");
    assertFigureResultCard(result, {
      status: "blocked-boundary",
      figureId: "gpt-image2-missing-key",
      packetId,
      happened: /OPENAI_API_KEY|provider API key/,
      nextActionTitle: /OPENAI_API_KEY|手工 SVG|manual SVG/,
      nextActionCommand: "project:dove.figure",
      boundaryType: "awaiting-provider-output"
    });
    assert.deepEqual(result.boundary.requiredInputs, ["OPENAI_API_KEY"]);
    assert.ok(result.requiredActions.includes("set-provider-api-key-env"));
    assert.equal(result.imported, null);
    assert.equal(result.finalSvgPath, null);
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "gpt-image2-missing-key.final.svg")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow rejects missing packet targets before writing figure items", () => {
  const root = tempRoot();
  try {
    ensureWorkspace(root);
    assert.throws(() => {
      runFigureWorkflow(root, {
        intent: "Draw a figure without a durable task packet.",
        svgContent: "<svg />"
      });
    }, /requires a durable task packet/);

    assert.equal(readFigures(root).items.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow rejects unsafe SVG and inline secret arguments", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);

    assert.throws(() => {
      runFigureWorkflow(root, {
        packetId,
        figureId: "unsafe-svg",
        runId: "unsafe-svg-run",
        intent: "Draw an unsafe figure.",
        targetClaimIds: ["claim-figure-workflow"],
        sourceSections: ["method"],
        svgContent: "<svg><script>alert(1)</script></svg>",
        caption: "Unsafe figure."
      });
    }, /script elements/);

    assert.throws(() => {
      runFigureWorkflow(root, {
        packetId,
        intent: "Draw with a bad inline API key.",
        apiKey: "inline-secret"
      });
    }, /inline secret/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runFigureWorkflow updates one figure without overwriting unrelated backlog items", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);
    upsertFigurePlan(root, {
      packetId,
      items: [{
        id: "existing-figure",
        name: "Existing Figure",
        sourceSections: ["method"],
        targetClaimIds: ["claim-figure-workflow"],
        narrativeIntent: "Keep this figure in the backlog.",
        requiredVisualElements: ["existing node"],
        templateSvgPath: ".dove/figures/existing-figure.template.svg",
        editableSvgPath: ".dove/figures/existing-figure.editable.svg",
        finalSvgPath: ".dove/figures/existing-figure.final.svg",
        captionIntent: "Existing figure caption intent."
      }]
    });

    const result = runFigureWorkflow(root, {
      packetId,
      figureId: "new-figure",
      runId: "new-figure-run",
      intent: "Draw the new figure while preserving the existing backlog item.",
      targetClaimIds: ["claim-figure-workflow"],
      sourceSections: ["method"],
      requiredVisualElements: ["new node"],
      svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>New</text></svg>",
      caption: "New figure caption."
    });

    assert.equal(result.figureId, "new-figure");
    const figureIds = readFigures(root).items.map((item) => item.id).sort();
    assert.deepEqual(figureIds, ["existing-figure", "new-figure"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
