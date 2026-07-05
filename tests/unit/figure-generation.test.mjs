import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  assertNoInlineSecrets,
  ensureWorkspace,
  importFigureGeneration,
  initProject,
  loadDoveConfig,
  loadDoveLanguageConfig,
  normalizeGlobalStatusProjects,
  prepareFigureGeneration,
  readJson,
  registerSource,
  resolveDoveGlobalStatusOutputDir,
  runWithMutationContext,
  upsertClaims,
  upsertFigurePlan,
  upsertNote,
  validateFigurePipeline,
  writeJson
} from "../../src/core/index.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function tempRoot() {
  return createTempRoot("dove-figure-generation-");
}

const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

async function withMockOpenAiImageServer(callback) {
  const requests = [];
  const script = `
const http = require("node:http");
const image = ${JSON.stringify(TINY_PNG_BASE64)};
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    process.stdout.write(JSON.stringify({ request: {
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
      body
    } }) + "\\n");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      id: "img-test",
      data: [{ b64_json: image, revised_prompt: "Revised workflow prompt." }]
    }));
  });
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  process.stdout.write(JSON.stringify({ endpoint: "http://127.0.0.1:" + address.port + "/v1/images/generations" }) + "\\n");
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`;
  const child = spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  let endpointResolved = false;
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Mock OpenAI image server did not start: ${stderr}`)), 5000);
    const handleLine = (line) => {
      if (!line.trim()) {
        return;
      }
      const message = JSON.parse(line);
      if (message.endpoint && !endpointResolved) {
        endpointResolved = true;
        clearTimeout(timer);
        resolve(message.endpoint);
        return;
      }
      if (message.request) {
        requests.push(message.request);
      }
    };
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      let newlineIndex = stdout.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = stdout.slice(0, newlineIndex);
        stdout = stdout.slice(newlineIndex + 1);
        handleLine(line);
        newlineIndex = stdout.indexOf("\n");
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (!endpointResolved) {
        clearTimeout(timer);
        reject(new Error(`Mock OpenAI image server exited with ${code}: ${stderr}`));
      }
    });
  });
  try {
    return await callback(endpoint, requests);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }
  }
}

async function waitForRequestCount(requests, expectedCount) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (requests.length >= expectedCount) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function seedTaskPacket(root, packetId = "figure-main-packet") {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: packetId,
    title: "Figure generation packet",
    summary: "Test packet for figure generation.",
    sourceType: "test-task",
    sourceId: packetId,
    status: "pending",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    currentFocus: "Generate a paper figure.",
    nextAction: "Prepare and import the figure.",
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

function seedFigureWorkspace(root) {
  ensureWorkspace(root);
  initProject(root, { title: "Figure Generation Test", objective: "Generate a durable evidence-linked figure." });
  const packetId = seedTaskPacket(root);
  const source = registerSource(root, { packetId, citationKey: "figure-source", title: "Figure Source", authors: ["Doe"], year: 2026, sourceType: "paper" });
  const note = upsertNote(root, { packetId, noteId: "figure-note", title: "Figure note", sectionId: "method", sourceIds: [source.id], summary: "Source-backed material for the figure." });
  upsertClaims(root, {
    packetId,
    claims: [{ id: "claim-figure", text: "The figure explains the evidence-to-claim workflow.", sectionId: "method", sourceIds: [source.id], noteIds: [note.id] }]
  });
  fs.writeFileSync(path.join(root, ".dove", "figures", "workflow.template.svg"), "<svg />\n", "utf8");
  fs.writeFileSync(path.join(root, ".dove", "figures", "workflow.editable.svg"), "<svg />\n", "utf8");
  upsertFigurePlan(root, {
    packetId,
    items: [{
      id: "workflow",
      name: "Workflow Figure",
      sourceSections: ["method"],
      targetClaimIds: ["claim-figure"],
      narrativeIntent: "Explain how evidence supports the paper claim.",
      requiredVisualElements: ["evidence node", "claim node"],
      templateSvgPath: ".dove/figures/workflow.template.svg",
      editableSvgPath: ".dove/figures/workflow.editable.svg",
      finalSvgPath: ".dove/figures/workflow.final.svg",
      captionIntent: "Explain what the workflow figure is for."
    }]
  });
  return packetId;
}

test("prepareFigureGeneration writes material and run input artifacts without fabricating a final figure", () => {
  const root = tempRoot();
  const packetId = seedFigureWorkspace(root);

  const prepared = prepareFigureGeneration(root, { packetId, figureId: "workflow", runId: "workflow-run" });
  assert.equal(prepared.runId, "workflow-run");
  assert.equal(prepared.materialStatus, "ready");
  assert.deepEqual(prepared.missingRequirementIds, []);
  assert.equal(fs.existsSync(path.join(root, prepared.inputPath)), true);
  assert.equal(fs.existsSync(path.join(root, prepared.promptPath)), true);
  assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "workflow.final.svg")), false);

  const materials = readJson(root, ARTIFACT_PATHS.figureMaterials, { version: 1, items: [] });
  const generations = readJson(root, ARTIFACT_PATHS.figureGenerations, { version: 1, items: [] });
  assert.equal(materials.items[0].figureId, "workflow");
  assert.equal(materials.items[0].packetId, packetId);
  assert.equal(generations.items[0].status, "prepared");
});

test("importFigureGeneration validates SVG, records caption provenance, and clears QA", () => {
  const root = tempRoot();
  const packetId = seedFigureWorkspace(root);
  prepareFigureGeneration(root, { packetId, figureId: "workflow", runId: "workflow-run" });

  const imported = importFigureGeneration(root, {
    packetId,
    figureId: "workflow",
    runId: "workflow-run",
    svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Evidence node flows to claim node</text></svg>",
    caption: "Workflow Figure explains how source-backed evidence flows into the claim."
  });
  assert.equal(imported.finalSvgPath, ".dove/figures/workflow.final.svg");
  assert.equal(imported.qaIssueCount, 0);

  const captions = readJson(root, ARTIFACT_PATHS.figureCaptions, { version: 1, items: [] });
  const generations = readJson(root, ARTIFACT_PATHS.figureGenerations, { version: 1, items: [] });
  const qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [] });
  assert.match(captions.items[0].text, /workflow-run/);
  assert.equal(generations.items[0].status, "imported");
  assert.equal(generations.items[0].captionId, captions.items[0].id);
  assert.equal(qa.items[0].qaStatus, "ready");
});

test("importFigureGeneration reads sourceSvgPath and scopes QA to the imported figure", () => {
  const root = tempRoot();
  const packetId = seedFigureWorkspace(root);
  const figures = readJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [] });
  upsertFigurePlan(root, {
    packetId,
    items: [
      ...figures.items,
      {
        id: "unrelated-broken",
        name: "Unrelated Broken Figure",
        sourceSections: ["method"],
        targetClaimIds: ["claim-figure"],
        narrativeIntent: "This unrelated figure is intentionally incomplete.",
        requiredVisualElements: ["broken node"],
        templateSvgPath: ".dove/figures/unrelated-broken.template.svg",
        editableSvgPath: ".dove/figures/unrelated-broken.editable.svg",
        finalSvgPath: ".dove/figures/unrelated-broken.final.svg",
        captionIntent: "Broken figure caption intent."
      }
    ]
  });
  prepareFigureGeneration(root, { packetId, figureId: "workflow", runId: "source-path-run" });
  const sourceSvgPath = ".dove/figures/runs/source-path-run/manual.svg";
  fs.mkdirSync(path.dirname(path.join(root, sourceSvgPath)), { recursive: true });
  fs.writeFileSync(path.join(root, sourceSvgPath), "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Evidence node flows to claim node</text></svg>\n", "utf8");

  const imported = importFigureGeneration(root, {
    packetId,
    figureId: "workflow",
    runId: "source-path-run",
    sourceSvgPath,
    caption: "Workflow Figure explains how source-backed evidence flows into the claim."
  });

  assert.equal(imported.sourceSvgPath, sourceSvgPath);
  assert.equal(imported.finalSvgPath, ".dove/figures/workflow.final.svg");
  assert.equal(imported.qaIssueCount, 0);
  assert.ok(imported.workspaceQaIssueCount > 0);
  assert.equal(fs.readFileSync(path.join(root, ".dove", "figures", "workflow.final.svg"), "utf8").includes("Evidence node"), true);
});

test("importFigureGeneration rejects unsafe SVG and path traversal", () => {
  const root = tempRoot();
  const packetId = seedFigureWorkspace(root);
  prepareFigureGeneration(root, { packetId, figureId: "workflow", runId: "unsafe-run" });

  assert.throws(() => {
    importFigureGeneration(root, {
      packetId,
      figureId: "workflow",
      runId: "unsafe-run",
      svgContent: "<svg><script>alert(1)</script></svg>",
      caption: "Unsafe caption."
    });
  }, /script elements/);

  assert.throws(() => {
    importFigureGeneration(root, {
      packetId,
      figureId: "workflow",
      runId: "unsafe-run",
      finalSvgPath: ".dove/figures/runs/unsafe-run/legacy.svg",
      svgContent: "<svg />",
      caption: "Legacy path field."
    });
  }, /no longer accepts finalSvgPath/);

  assert.throws(() => {
    importFigureGeneration(root, {
      packetId,
      figureId: "workflow",
      runId: "unsafe-run",
      sourceSvgPath: "../outside.svg",
      svgContent: "<svg />",
      caption: "Unsafe path."
    });
  }, /must stay under/);
});

test("prepareFigureGeneration can explicitly invoke a configured external-command provider", () => {
  const root = tempRoot();
  const packetId = seedFigureWorkspace(root);
  const providerScript = path.join(root, "fake-figure-provider.cjs");
  fs.writeFileSync(providerScript, `#!/usr/bin/env node
const fs = require("node:fs");
const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.stdout.write(JSON.stringify({
  sourceSvgPath: ".dove/figures/runs/" + input.runId + "/provider.svg",
  svgContent: "<svg xmlns=\\"http://www.w3.org/2000/svg\\"><text>Provider output claim node</text></svg>",
  caption: "Provider generated a workflow figure for the claim node.",
  semanticCoverage: { visualElements: ["evidence node", "claim node"] }
}));
`, "utf8");
  fs.chmodSync(providerScript, 0o755);

  const prepared = prepareFigureGeneration(root, {
    packetId,
    figureId: "workflow",
    runId: "provider-run",
    executeProvider: true,
    env: {
      DOVE_FIGURE_PROVIDER_ID: "fake-command",
      DOVE_FIGURE_PROVIDER_TYPE: "external-command",
      DOVE_FIGURE_COMMAND: providerScript
    }
  });
  assert.equal(prepared.providerExecution.status, "completed");
  assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "runs", "provider-run", "provider.svg")), true);

  const imported = importFigureGeneration(root, { packetId, figureId: "workflow", runId: "provider-run" });
  assert.equal(imported.qaIssueCount, 0);
});

test("prepareFigureGeneration does not execute providers in patch-plan mode", () => {
  const root = tempRoot();
  const packetId = seedFigureWorkspace(root);
  const providerScript = path.join(root, "patch-plan-provider.cjs");
  fs.writeFileSync(providerScript, `#!/usr/bin/env node
const fs = require("node:fs");
fs.writeFileSync("provider-spawned.txt", "spawned", "utf8");
process.stdout.write(JSON.stringify({
  sourceSvgPath: ".dove/figures/runs/patch-plan-provider-run/provider.svg",
  svgContent: "<svg xmlns=\\"http://www.w3.org/2000/svg\\"><text>Provider output claim node</text></svg>",
  caption: "Provider generated a workflow figure for the claim node."
}));
`, "utf8");
  fs.chmodSync(providerScript, 0o755);

  const planned = runWithMutationContext(root, { actionId: "figure-provider-patch-plan", mutationMode: "patch-plan" }, () => prepareFigureGeneration(root, {
    packetId,
    figureId: "workflow",
    runId: "patch-plan-provider-run",
    executeProvider: true,
    env: {
      DOVE_FIGURE_PROVIDER_ID: "patch-plan-command",
      DOVE_FIGURE_PROVIDER_TYPE: "external-command",
      DOVE_FIGURE_COMMAND: providerScript
    }
  }));

  assert.equal(planned.providerExecution.status, "awaiting-provider-output");
  assert.equal(planned.providerExecution.requiredMutationMode, "direct-process");
  assert.equal(planned.providerExecution.directProcessRequired, true);
  assert.equal(planned.mutationMode, "patch-plan");
  assert.equal(planned.writesApplied, false);
  assert.equal(planned.hostRollbackEligible, true);
  assert.equal(fs.existsSync(path.join(root, "provider-spawned.txt")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "runs", "patch-plan-provider-run", "provider.svg")), false);

  const generationsOperation = planned.mutationPlan.operations.find((operation) => operation.relativePath === ARTIFACT_PATHS.figureGenerations);
  assert.ok(generationsOperation);
  const generations = JSON.parse(generationsOperation.content);
  const generation = generations.items.find((item) => item.id === "patch-plan-provider-run");
  assert.equal(generation.status, "awaiting-provider-output");
  assert.equal(generation.providerExecution.requiredMutationMode, "direct-process");
});

test("provider output manifests reject inline secret fields before persistence", () => {
  const root = tempRoot();
  const packetId = seedFigureWorkspace(root);
  const providerScript = path.join(root, "leaky-figure-provider.cjs");
  fs.writeFileSync(providerScript, `#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  sourceSvgPath: ".dove/figures/runs/leaky-run/provider.svg",
  svgContent: "<svg xmlns=\\"http://www.w3.org/2000/svg\\"><text>Provider output</text></svg>",
  apiKey: "inline-secret"
}));
`, "utf8");
  fs.chmodSync(providerScript, 0o755);

  const prepared = prepareFigureGeneration(root, {
    packetId,
    figureId: "workflow",
    runId: "leaky-run",
    executeProvider: true,
    env: {
      DOVE_FIGURE_PROVIDER_ID: "leaky-command",
      DOVE_FIGURE_PROVIDER_TYPE: "external-command",
      DOVE_FIGURE_COMMAND: providerScript
    }
  });

  assert.equal(prepared.providerExecution.status, "failed");
  assert.match(prepared.providerExecution.error, /inline secret field/);
  assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "runs", "leaky-run", "output.json")), false);
});

test("Dove figure config rejects inline secrets and accepts env secret references", () => {
  assert.throws(() => assertNoInlineSecrets({ apiKey: "secret" }, "config"), /inline secret/);
  assert.throws(() => assertNoInlineSecrets({ providerHeader: "Bearer inline-token" }, "config"), /inline bearer/);

  const root = tempRoot();
  const configPath = path.join(root, "dove-config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    figureGeneration: {
      defaultProviderId: "drawing-http",
      providers: [{
        id: "drawing-http",
        type: "http-json",
        endpoint: "https://drawing.invalid/v1/figures",
        model: "svg-model",
        apiKeyEnv: "DOVE_DRAWING_API_KEY"
      }]
    }
  }), "utf8");

  const config = loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath, DOVE_DRAWING_API_KEY: "not-persisted" });
  assert.equal(config.figureGeneration.defaultProviderId, "drawing-http");
  assert.equal(config.figureGeneration.providers[0].apiKeyEnv, "DOVE_DRAWING_API_KEY");

  fs.writeFileSync(configPath, JSON.stringify({ figureGeneration: { providers: [{ id: "bad", type: "http-json", endpoint: "https://drawing.invalid", apiKey: "secret" }] } }), "utf8");
  assert.throws(() => loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath }), /inline secret/);
});

test("Dove figure config exposes gpt-image2 as an explicit env provider without inline secrets", () => {
  const root = tempRoot();
  try {
    const config = loadDoveConfig(root, {
      DOVE_CONFIG_PATH: path.join(root, "missing-config.json"),
      DOVE_FIGURE_PROVIDER_ID: "gpt-image2",
      DOVE_FIGURE_ENDPOINT: "http://127.0.0.1:1/v1/images/generations",
      DOVE_FIGURE_IMAGE_SIZE: "512x512",
      OPENAI_API_KEY: "not-persisted"
    });
    assert.equal(config.figureGeneration.defaultProviderId, "gpt-image2");
    assert.equal(config.figureGeneration.providers[0].id, "gpt-image2");
    assert.equal(config.figureGeneration.providers[0].type, "openai-image");
    assert.equal(config.figureGeneration.providers[0].model, "gpt-image-2");
    assert.equal(config.figureGeneration.providers[0].apiKeyEnv, "OPENAI_API_KEY");
    assert.equal(config.figureGeneration.providers[0].imageSize, "512x512");
    assert.equal(config.figureGeneration.providers[0].apiKey, undefined);

    const configPath = path.join(root, "dove-config.json");
    fs.writeFileSync(configPath, JSON.stringify({ figureGeneration: { defaultProviderId: "gpt-image2" } }), "utf8");
    const builtinSelection = loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath });
    assert.equal(builtinSelection.figureGeneration.defaultProviderId, "gpt-image2");
    assert.deepEqual(builtinSelection.figureGeneration.providers, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("prepareFigureGeneration invokes gpt-image2 through the OpenAI image provider path", async () => {
  await withMockOpenAiImageServer(async (endpoint, requests) => {
    const root = tempRoot();
    try {
      const packetId = seedFigureWorkspace(root);
      const env = {
        DOVE_CONFIG_PATH: path.join(root, "missing-config.json"),
        DOVE_FIGURE_PROVIDER_ID: "gpt-image2",
        DOVE_FIGURE_ENDPOINT: endpoint,
        DOVE_FIGURE_IMAGE_SIZE: "64x32",
        OPENAI_API_KEY: "test-key"
      };

      const prepared = prepareFigureGeneration(root, {
        packetId,
        figureId: "workflow",
        runId: "gpt-image2-run",
        executeProvider: true,
        env
      });
      assert.equal(prepared.providerReadiness.status, "ready");
      assert.equal(prepared.providerExecution.status, "completed");
      await waitForRequestCount(requests, 1);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].method, "POST");
      assert.equal(requests[0].authorization, "Bearer test-key");
      assert.equal(requests[0].body.model, "gpt-image-2");
      assert.equal(requests[0].body.response_format, undefined);
      assert.equal(requests[0].body.size, "64x32");
      assert.match(requests[0].body.prompt, /Workflow Figure/);

      const manifest = readJson(root, prepared.outputManifestPath, {});
      assert.equal(manifest.sourceSvgPath, ".dove/figures/runs/gpt-image2-run/gpt-image2.svg");
      assert.equal(manifest.finalSvgPath, undefined);
      assert.equal(manifest.rasterImagePath, ".dove/figures/runs/gpt-image2-run/gpt-image2.png");
      assert.equal(manifest.providerResponseId, "img-test");
      assert.equal(manifest.revisedPrompt, "Revised workflow prompt.");
      assert.equal(manifest.model, "gpt-image-2");
      assert.equal(manifest.imageSize, "64x32");
      assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "runs", "gpt-image2-run", "gpt-image2.png")), true);

      const imported = importFigureGeneration(root, { packetId, figureId: "workflow", runId: "gpt-image2-run", env });
      assert.ok(imported.qaIssueCount > 0);
      assert.equal(imported.finalSvgPath, ".dove/figures/workflow.final.svg");
      let qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [] });
      assert.ok(qa.issues.some((issue) => issue.code === "raster-semantic-review-required"));
      const finalSvg = fs.readFileSync(path.join(root, ".dove", "figures", "workflow.final.svg"), "utf8");
      assert.match(finalSvg, /<image href="runs\/gpt-image2-run\/gpt-image2\.png"/);

      const reviewedImport = importFigureGeneration(root, {
        packetId,
        figureId: "workflow",
        runId: "gpt-image2-run",
        caption: "Workflow Figure shows source-backed evidence flowing from the evidence node into the claim node.",
        semanticCoverage: { visualElements: ["evidence node", "claim node"] },
        semanticReview: { status: "approved", evidencePaths: [ARTIFACT_PATHS.figureQa] },
        env
      });
      assert.equal(reviewedImport.qaIssueCount, 0);
      qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [] });
      assert.equal(qa.items[0].semanticCoverage.rasterSemanticReviewPassed, true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

test("prepareFigureGeneration reports missing OPENAI_API_KEY for gpt-image2", () => {
  const root = tempRoot();
  try {
    const packetId = seedFigureWorkspace(root);
    const prepared = prepareFigureGeneration(root, {
      packetId,
      figureId: "workflow",
      runId: "gpt-image2-missing-key-run",
      executeProvider: true,
      env: {
        DOVE_CONFIG_PATH: path.join(root, "missing-config.json"),
        DOVE_FIGURE_PROVIDER_ID: "gpt-image2"
      }
    });
    assert.equal(prepared.providerReadiness.status, "missing-secret-env");
    assert.equal(prepared.providerReadiness.apiKeyEnv, "OPENAI_API_KEY");
    assert.equal(prepared.providerExecution.status, "missing-secret-env");
    assert.equal(prepared.providerExecution.apiKeyEnv, "OPENAI_API_KEY");
    assert.match(prepared.providerExecution.error, /OPENAI_API_KEY/);

    const generations = readJson(root, ARTIFACT_PATHS.figureGenerations, { version: 1, items: [] });
    const generation = generations.items.find((item) => item.id === "gpt-image2-missing-key-run");
    assert.equal(generation.status, "missing-secret-env");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Dove config supports response language with Chinese default and English override", () => {
  const root = tempRoot();
  const configPath = path.join(root, "dove-config.json");
  fs.writeFileSync(configPath, JSON.stringify({}), "utf8");

  assert.equal(loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath }).language, "zh");

  fs.writeFileSync(configPath, JSON.stringify({ language: "English" }), "utf8");
  assert.equal(loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath }).language, "en");
  assert.equal(loadDoveLanguageConfig(root, { DOVE_CONFIG_PATH: configPath }), "en");
  assert.equal(loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath, DOVE_LANGUAGE: "中文" }).language, "zh");

  fs.writeFileSync(configPath, JSON.stringify({ language: "fr" }), "utf8");
  assert.throws(() => loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath }), /Unsupported Dove response language/);
});

test("Dove global status config normalizes projects and output directories", () => {
  const root = tempRoot();
  const projectA = path.join(root, "project-a");
  const projectB = path.join(root, "project-b");
  const disabledProject = path.join(root, "disabled-project");
  const normalized = normalizeGlobalStatusProjects([
    projectA,
    { root: projectB, slug: "Project B", name: "Project B Title" },
    { root: projectA, title: "Project A Override" },
    { root: disabledProject, enabled: false }
  ]);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].root, projectA);
  assert.equal(normalized[0].title, "Project A Override");
  assert.equal(normalized[1].root, projectB);
  assert.equal(normalized[1].slug, "Project B");
  assert.equal(normalized.some((project) => project.root === disabledProject), false);

  const configPath = path.join(root, "dove-config.json");
  const outputDir = path.join(root, "global-public");
  fs.writeFileSync(configPath, JSON.stringify({
    globalStatus: {
      outputDir,
      projects: [projectA, { root: projectB, slug: "project-b", title: "Project B" }, { root: disabledProject, enabled: false }]
    }
  }), "utf8");
  const config = loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath });
  assert.equal(config.globalStatus.outputDir, outputDir);
  assert.deepEqual(config.globalStatus.projects.map((project) => project.root), [projectA, projectB]);
  assert.deepEqual(config.globalStatus.projects.map((project) => project.slug), [null, "project-b"]);

  fs.writeFileSync(configPath, JSON.stringify({ publicStatus: { projects: [projectA] } }), "utf8");
  const aliasConfig = loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath });
  assert.deepEqual(aliasConfig.globalStatus.projects.map((project) => project.root), [projectA]);

  const cloudflareConfigPath = path.join(root, "cloudflared.yml");
  const credentialsFile = path.join(root, "cloudflared.json");
  fs.writeFileSync(configPath, JSON.stringify({
    globalStatus: {
      outputDir,
      auth: {
        enabled: "true",
        password: "local-page-password",
        passwordEnv: "DOVE_GLOBAL_STATUS_PASSWORD"
      },
      cloudflare: {
        enabled: "true",
        domain: "KELI.EU.CC",
        tunnelName: "dove-global-status",
        originHost: "localhost",
        originPort: "8788",
        configPath: cloudflareConfigPath,
        credentialsFile,
        tokenEnv: "DOVE_CLOUDFLARE_TUNNEL_TOKEN",
        dnsResolverAddrs: ["1.1.1.1:53", "1.1.1.1:53", "1.0.0.1:53"]
      }
    }
  }), "utf8");
  const cloudflareConfig = loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath });
  assert.equal(cloudflareConfig.globalStatus.auth.enabled, true);
  assert.equal(cloudflareConfig.globalStatus.auth.password, "local-page-password");
  assert.equal(cloudflareConfig.globalStatus.auth.passwordEnv, "DOVE_GLOBAL_STATUS_PASSWORD");
  assert.equal(cloudflareConfig.globalStatus.cloudflare.enabled, true);
  assert.equal(cloudflareConfig.globalStatus.cloudflare.domain, "keli.eu.cc");
  assert.equal(cloudflareConfig.globalStatus.cloudflare.tunnelName, "dove-global-status");
  assert.equal(cloudflareConfig.globalStatus.cloudflare.originHost, "localhost");
  assert.equal(cloudflareConfig.globalStatus.cloudflare.originPort, 8788);
  assert.equal(cloudflareConfig.globalStatus.cloudflare.configPath, cloudflareConfigPath);
  assert.equal(cloudflareConfig.globalStatus.cloudflare.credentialsFile, credentialsFile);
  assert.equal(cloudflareConfig.globalStatus.cloudflare.tokenEnv, "DOVE_CLOUDFLARE_TUNNEL_TOKEN");
  assert.deepEqual(cloudflareConfig.globalStatus.cloudflare.dnsResolverAddrs, ["1.1.1.1:53", "1.0.0.1:53"]);

  fs.writeFileSync(configPath, JSON.stringify({ globalStatus: { cloudflare: { domain: "https://keli.eu.cc/status" } } }), "utf8");
  assert.throws(() => loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath }), /bare hostname/);
  fs.writeFileSync(configPath, JSON.stringify({ globalStatus: { cloudflare: { originHost: "0.0.0.0" } } }), "utf8");
  assert.throws(() => loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath }), /loopback-only/);
  fs.writeFileSync(configPath, JSON.stringify({ globalStatus: { cloudflare: { token: "secret-token" } } }), "utf8");
  assert.throws(() => loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath }), /inline secret/);
  fs.writeFileSync(configPath, JSON.stringify({ globalStatus: { auth: { enabled: true, password: "inline-password" } } }), "utf8");
  const inlinePasswordConfig = loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath });
  assert.equal(inlinePasswordConfig.globalStatus.auth.password, "inline-password");
  fs.writeFileSync(configPath, JSON.stringify({ globalStatus: { outputDir, cloudflare: { configPath: path.join(outputDir, "cloudflared.yml") } } }), "utf8");
  assert.throws(() => loadDoveConfig(root, { DOVE_CONFIG_PATH: configPath }), /public output directory/);

  const xdgDataHome = path.join(root, "xdg-data");
  assert.equal(resolveDoveGlobalStatusOutputDir(null, { XDG_DATA_HOME: xdgDataHome }), path.join(xdgDataHome, "dove", "public"));
  assert.equal(resolveDoveGlobalStatusOutputDir(outputDir, {}), outputDir);
});
