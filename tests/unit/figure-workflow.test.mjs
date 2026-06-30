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
  writeJson
} from "../../src/core/index.mjs";
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
      svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Evidence to claim</text></svg>",
      caption: "The figure explains how source-backed evidence flows into a paper claim."
    });

    assert.equal(result.status, "validated");
    assert.equal(result.materialStatus, "ready");
    assert.equal(result.qaIssueCount, 0);
    assert.equal(result.captionId, "single-intent-single-intent-run-caption");
    assert.equal(result.finalSvgPath, ".dove/figures/single-intent.final.svg");
    assert.equal(result.stageFiles.templateCreated, true);
    assert.equal(result.stageFiles.editableCreated, true);
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

test("runFigureWorkflow auto-imports completed external-command provider output", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkflowContext(root);
    const providerScript = path.join(root, "fake-figure-provider.cjs");
    fs.writeFileSync(providerScript, `#!/usr/bin/env node
const fs = require("node:fs");
const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.stdout.write(JSON.stringify({
  finalSvgPath: ".dove/figures/runs/" + input.runId + "/provider.svg",
  svgContent: "<svg xmlns=\\"http://www.w3.org/2000/svg\\"><text>Provider workflow</text></svg>",
  caption: "Provider generated the workflow figure."
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
    assert.equal(result.providerExecution.status, "completed");
    assert.equal(result.imported.finalSvgPath, ".dove/figures/provider-intent.final.svg");
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "provider-intent.final.svg")), true);
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
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "prepared-only.final.svg")), false);
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
