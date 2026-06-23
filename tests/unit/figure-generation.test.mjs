import test from "node:test";
import assert from "node:assert/strict";
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
    svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Evidence to claim</text></svg>",
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
      finalSvgPath: "../outside.svg",
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
  finalSvgPath: ".dove/figures/runs/" + input.runId + "/provider.svg",
  svgContent: "<svg xmlns=\\"http://www.w3.org/2000/svg\\"><text>Provider output</text></svg>",
  caption: "Provider generated a workflow figure."
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

test("provider output manifests reject inline secret fields before persistence", () => {
  const root = tempRoot();
  const packetId = seedFigureWorkspace(root);
  const providerScript = path.join(root, "leaky-figure-provider.cjs");
  fs.writeFileSync(providerScript, `#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  finalSvgPath: ".dove/figures/runs/leaky-run/provider.svg",
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
