import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { checkGeneratedAdapters, writeGeneratedAdapters } from "../../scripts/generate-command-adapters.mjs";
import { HOST_IDS, commandAdapterPathsForHost } from "../../src/core/command-manifest.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "dove.mjs");
const DOVE_HOST_PATHS = Object.fromEntries(HOST_IDS.map((hostId) => [hostId, commandAdapterPathsForHost(hostId)]));

function assertDoveHostPaths(target, hostIds) {
  for (const hostId of hostIds) {
    for (const relativePath of DOVE_HOST_PATHS[hostId]) {
      assert.ok(fs.existsSync(path.join(target, relativePath)), `missing ${relativePath}`);
    }
  }
}

test("npm package dry-run includes Dove-only adapters and current public docs", () => {
  const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const [pack] = JSON.parse(result.stdout);
  const packagedPaths = new Set(pack.files.map((file) => file.path));
  for (const hostPaths of Object.values(DOVE_HOST_PATHS)) {
    for (const relativePath of hostPaths) {
      assert.ok(packagedPaths.has(relativePath), `missing packaged adapter ${relativePath}`);
    }
  }
  for (const publicDocPath of [
    "docs/README.md",
    "docs/INSTALL.md",
    "docs/USAGE.md",
    "docs/PACKAGING.md",
    "docs/CAPABILITY_MATRIX.md"
  ]) {
    assert.ok(packagedPaths.has(publicDocPath), `missing public doc ${publicDocPath}`);
  }
  for (const publicCommand of ["init", "mission", "auto", "status", "kill", "lessons", "version", "source", "note", "figure", "experience", "draft", "review", "review-loop", "rebuttal"]) {
    assert.ok(packagedPaths.has(`.opencode/commands/dove.${publicCommand}.md`), `missing public command ${publicCommand}`);
  }
  for (const removedPath of [
    ".opencode/commands/dove.orchestrate.md",
    ".opencode/commands/dove.plan.md",
    ".opencode/commands/dove.checklist.md",
    ".opencode/commands/dove.audit.md",
    ".opencode/commands/dove.autonomy-operate.md",
    ".opencode/commands/dove.return.md",
    ".opencode/commands/dove.follow-through.md",
    ".opencode/commands/dove.governance-audit.md",
    ".opencode/commands/dove.onboard.md",
    ".opencode/commands/dove.launch.md",
    ".opencode/commands/dove.approvals.md",
    ".opencode/commands/dove.paper.experiment.md",
    ".opencode/commands/dove.paper.version.md",
    ".opencode/commands/dove.paper.figure.md",
    ".claude/commands/dove/paper/draft.md",
    ".codex/skills/dove-paper-approvals/SKILL.md",
    ".agents/skills/dove-paper-orchestrate/SKILL.md"
  ]) {
    assert.equal(packagedPaths.has(removedPath), false, `packaged removed adapter ${removedPath}`);
  }
  assert.ok(packagedPaths.has(".opencode/skills/dove-pipeline/SKILL.md"));
  assert.ok(packagedPaths.has(".agents/skills/dove-lessons/SKILL.md"));
  for (const forbiddenPath of [
    ".codex/config.toml",
    ".codex/skills/parallel/SKILL.md",
    ".agents/skills/start/SKILL.md",
    ".opencode/commands/trellis/start.md",
    ".claude/commands/trellis/start.md",
    ".cursor/commands/trellis-start.md",
    "docs/DOVE_REFACTOR_PLAN_2026-05-04.md",
    "docs/ROLE_HIERARCHY_REFACTOR_PLAN_2026-05-04.md",
    "docs/PAPER_FACTORY_SYSTEM_ORIGINS.zh-CN.md",
    "docs/REFERENCE_ARCHITECTURES.zh-CN.md"
  ]) {
    assert.equal(packagedPaths.has(forbiddenPath), false, `packaged internal artifact ${forbiddenPath}`);
  }
});

test("generated adapter check reports stale managed adapter files", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-generated-adapters-"));

  try {
    writeGeneratedAdapters(target);
    assert.deepEqual(checkGeneratedAdapters(target), []);

    const staleRelativePath = ".claude/commands/dove/paper-stale.md";
    const staleAbsolutePath = path.join(target, staleRelativePath);
    fs.mkdirSync(path.dirname(staleAbsolutePath), { recursive: true });
    fs.writeFileSync(staleAbsolutePath, "# stale\n", "utf8");

    const drift = checkGeneratedAdapters(target);
    assert.ok(
      drift.some((item) => item.relativePath === staleRelativePath && item.reason === "stale"),
      JSON.stringify(drift)
    );
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("release and maturity checks validate doctor through a clean install", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const maturityText = fs.readFileSync(path.join(ROOT, "scripts", "validate-maturity.mjs"), "utf8");
  const doctorValidationText = fs.readFileSync(path.join(ROOT, "scripts", "validate-doctor.mjs"), "utf8");

  assert.equal(packageJson.scripts["doctor:validate"], "node ./scripts/validate-doctor.mjs");
  assert.match(packageJson.scripts["release:check"], /npm run maturity:audit/);
  assert.doesNotMatch(packageJson.scripts["release:check"], /npm run doctor(?!:validate)/);
  assert.match(maturityText, /\["npm", \["run", "doctor:validate"\]\]/);
  assert.doesNotMatch(maturityText, /\["node", \["\.\/bin\/dove\.mjs", "doctor", "\."\]\]/);
  assert.match(doctorValidationText, /mkdtempSync\(path\.join\(os\.tmpdir\(\), "dove-doctor-"\)\)/);
  assert.match(doctorValidationText, /"install", target, "--force", "--host", "all"/);
  assert.match(doctorValidationText, /"doctor", target/);
});

test("CLI install copies the workflow pack into a target workspace", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-install-"));
  const result = spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  for (const publicCommand of ["init", "mission", "auto", "status", "kill", "lessons", "version", "source", "note", "figure", "experience", "draft", "review", "review-loop", "rebuttal"]) {
    assert.ok(fs.existsSync(path.join(target, ".opencode", "commands", `dove.${publicCommand}.md`)), `missing installed public command ${publicCommand}`);
  }
  for (const removedCommand of ["approvals", "launch", "plan", "audit", "return", "autonomy-operate", "follow-through", "onboard"]) {
    assert.equal(fs.existsSync(path.join(target, ".opencode", "commands", `dove.${removedCommand}.md`)), false);
  }
  assert.equal(fs.existsSync(path.join(target, ".opencode", "commands", "dove.paper.experiment.md")), false);
  assert.equal(fs.existsSync(path.join(target, ".opencode", "commands", "dove.paper.version.md")), false);
  assert.ok(fs.existsSync(path.join(target, ".opencode", "skills", "dove-pipeline", "SKILL.md")));
  assert.equal(fs.existsSync(path.join(target, ".opencode", "agents")), false);
  assert.equal(fs.existsSync(path.join(target, ".opencode", "plugins")), false);
  assert.ok(fs.existsSync(path.join(target, ".dove", "state.json")));
   assert.ok(fs.existsSync(path.join(target, ".dove", "workflow-pack", "boundaries.json")));
   assert.ok(fs.existsSync(path.join(target, ".dove", "task-packets", "index.json")));
  assert.ok(fs.existsSync(path.join(target, ".dove", "manifest.json")));
  assert.equal(fs.existsSync(path.join(target, ".dove")), true);
  assert.ok(fs.existsSync(path.join(target, "bin", "dove.mjs")));
  assert.ok(fs.existsSync(path.join(target, "mcp", "dove-state-server.mjs")));
  assert.ok(fs.existsSync(path.join(target, "scripts", "validate-mcp.mjs")));
  assert.ok(fs.existsSync(path.join(target, "src", "mcp", "server.mjs")));
  for (const internalDoc of [
    "DOVE_REFACTOR_PLAN_2026-05-04.md",
    "ROLE_HIERARCHY_REFACTOR_PLAN_2026-05-04.md",
    "PAPER_FACTORY_SYSTEM_ORIGINS.zh-CN.md",
    "REFERENCE_ARCHITECTURES.zh-CN.md"
  ]) {
    assert.equal(fs.existsSync(path.join(target, "docs", internalDoc)), false);
  }
  const config = JSON.parse(fs.readFileSync(path.join(target, ".opencode.json"), "utf8"));
  assert.equal(Object.hasOwn(config, "$schema"), false);
});

test("CLI install can install optional host adapters without local unsafe files", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-install-hosts-"));
  const result = spawnSync("node", [CLI, "install", target, "--force", "--host", "claude,cursor", "--host", "agents"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.hosts, ["claude", "cursor", "agents"]);
  assert.ok(fs.existsSync(path.join(target, ".claude", "commands")));
  assert.equal(fs.existsSync(path.join(target, ".claude", "agents")), false);
  assert.ok(fs.existsSync(path.join(target, ".cursor", "commands")));
  assert.ok(fs.existsSync(path.join(target, ".agents", "skills")));
  assert.ok(fs.existsSync(path.join(target, "AGENTS.md")));
  assertDoveHostPaths(target, ["claude", "cursor", "agents"]);
  assert.equal(fs.existsSync(path.join(target, ".claude", "commands", "trellis", "start.md")), false);
  assert.equal(fs.existsSync(path.join(target, ".cursor", "commands", "trellis-start.md")), false);
  assert.equal(fs.existsSync(path.join(target, ".agents", "skills", "start", "SKILL.md")), false);
  assert.equal(fs.existsSync(path.join(target, ".claude", "settings.local.json")), false);
  assert.equal(fs.existsSync(path.join(target, ".opencode", "node_modules")), false);
});

test("CLI install all host adapters skips unsafe local artifacts", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-install-all-hosts-"));
  const result = spawnSync("node", [CLI, "install", target, "--force", "--host", "all"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.hosts, ["opencode", "claude", "codex", "cursor", "agents"]);
  assert.ok(fs.existsSync(path.join(target, ".opencode", "commands", "dove.status.md")));
  assert.ok(fs.existsSync(path.join(target, ".claude", "commands")));
  assert.equal(fs.existsSync(path.join(target, ".codex", "agents")), false);
  assert.equal(fs.existsSync(path.join(target, ".codex", "config.toml")), false);
  assert.ok(fs.existsSync(path.join(target, ".cursor", "commands")));
  assert.ok(fs.existsSync(path.join(target, ".agents", "skills")));
  assertDoveHostPaths(target, ["opencode", "claude", "cursor", "codex", "agents"]);
  assert.equal(fs.existsSync(path.join(target, ".codex", "skills", "parallel", "SKILL.md")), false);
  assert.equal(fs.existsSync(path.join(target, ".opencode", "node_modules")), false);
  assert.equal(fs.existsSync(path.join(target, ".claude", "settings.local.json")), false);
});

test("CLI sync preserves user-owned .dove workspace state", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-sync-"));
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  const draftPath = path.join(target, ".dove", "drafts", "introduction.md");
  fs.mkdirSync(path.dirname(draftPath), { recursive: true });
  fs.writeFileSync(draftPath, "# Introduction\n\nUser-owned draft content.\n", "utf8");

  const result = spawnSync("node", [CLI, "sync", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(fs.readFileSync(draftPath, "utf8"), /User-owned draft content/);
});

test("CLI doctor returns non-zero for unhealthy workspaces", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-doctor-"));
  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
});

test("CLI doctor reports installed host adapters for multi-host workspaces", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-doctor-hosts-"));
  spawnSync("node", [CLI, "install", target, "--force", "--host", "claude,cursor"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.hostAdapters, ["claude", "cursor"]);
  assert.ok(payload.checks.some((check) => check.check === "host-adapter:claude" && check.ok));
  assert.ok(payload.checks.some((check) => check.check === "host-adapter:cursor" && check.ok));
  assert.ok(payload.checks.some((check) => check.check === "dove-authority" && check.ok));
  assert.equal(payload.managedArtifacts.doveAuthorityManifest.authoritativeRoot, ".dove");
  assert.equal(payload.managedArtifacts.doveAuthorityManifest.currentWriteAuthority, ".dove");
});

test("CLI doctor fails when a required Dove adapter is missing", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-doctor-missing-host-"));
  spawnSync("node", [CLI, "install", target, "--force", "--host", "claude"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const missingAdapterPath = ".claude/commands/dove/draft.md";
  fs.rmSync(path.join(target, missingAdapterPath));

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.ok(payload.missing.includes(missingAdapterPath));
  assert.ok(payload.checks.some((check) => check.check === "host-adapter:claude" && !check.ok && check.requiredPaths.includes(missingAdapterPath)));
});

test("CLI doctor exposes grouped meta-optimize frontier visibility for healthy workspaces", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-doctor-meta-optimize-"));
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /meta-optimize-frontier/);
  assert.match(result.stdout, /grouped frontier: \d+ clusters \/ \d+ recommendations/);
  assert.match(result.stdout, /family playbooks:/);
  assert.match(result.stdout, /remediation readiness:/);
  assert.match(result.stdout, /playbook readiness:/);
  assert.match(result.stdout, /frontier summary:/);
  assert.match(result.stdout, /taxonomy pressure:/);
  assert.match(result.stdout, /long-horizon summary:/);
  assert.match(result.stdout, /dove-authority/);
  assert.match(result.stdout, /Dove authority: \.dove authoritative, writes=\.dove/);
});

test("CLI autonomy-once and doctor expose runtime status visibility", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-autonomy-runtime-"));
  const install = spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(install.status, 0, install.stderr || install.stdout);

  const autonomy = spawnSync("node", [CLI, "autonomy-once", target], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(autonomy.status, 0, autonomy.stderr || autonomy.stdout);
  assert.match(autonomy.stdout, /"status": "noop"/);
  assert.match(autonomy.stdout, /"outcome": "no-eligible-packet"/);

  const flagFirstAutonomy = spawnSync("node", [CLI, "autonomy-once", "--actor-role", "planner"], {
    cwd: target,
    encoding: "utf8"
  });
  assert.equal(flagFirstAutonomy.status, 0, flagFirstAutonomy.stderr || flagFirstAutonomy.stdout);
  assert.match(flagFirstAutonomy.stdout, /"status": "noop"/);
  assert.match(flagFirstAutonomy.stdout, /"outcome": "no-eligible-packet"/);

  const doctor = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(doctor.status, 0, doctor.stderr || doctor.stdout);
  assert.match(doctor.stdout, /autonomy-runtime/);
  assert.match(doctor.stdout, /program-surfaces/);
  assert.match(doctor.stdout, /runtime=noop\/no-eligible-packet/i);
  assert.match(doctor.stdout, /worker=none requests=0 checkpoints=0 escalations=0/);
  assert.match(doctor.stdout, /continuation=0\/none\/none\/none\/none/);
  assert.match(doctor.stdout, /programs=0 approved-runs=0 review-checkpoints=0 consumed-approvals=0 current=none\/none checkpoint=none/);
});

test("CLI doctor fails when key JSON artifacts are malformed", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-doctor-bad-json-"));
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  fs.writeFileSync(path.join(target, ".dove", "state.json"), "{bad json", "utf8");

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /json:.dove\/state.json/);
});

test("CLI doctor reports ignored stale workspace artifacts as warnings", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-doctor-legacy-root-"));
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const legacyWorkspacePath = path.join(target, ".paper", "workspace");
  fs.mkdirSync(legacyWorkspacePath, { recursive: true });
  fs.writeFileSync(path.join(legacyWorkspacePath, "index.json"), "{}\n", "utf8");

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.healthy, true);
  assert.ok(payload.checks.some((check) => check.check === "dove-authority" && check.ok));
  assert.deepEqual(payload.managedArtifacts.doveAuthorityManifest.staleLegacyArtifacts, [".paper/workspace/index.json"]);
  assert.deepEqual(payload.managedArtifacts.doveAuthorityManifest.ignoredStaleWorkspaceArtifacts, [".paper/workspace/index.json"]);
  assert.ok(payload.warnings.some((warning) => warning.code === "ignored-stale-workspace-artifacts" && warning.paths.includes(".paper/workspace/index.json")));
});

test("CLI doctor reports degraded typed wiki relations explicitly", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-doctor-wiki-health-"));
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  fs.writeFileSync(path.join(target, ".dove", "wiki", "relations.json"), `${JSON.stringify({
    version: 3,
    items: [{
      id: "claim-bad-supported-by-source",
      fromId: "claim-bad",
      toId: "missing-source",
      relationType: "supported-by-source",
      sourceArtifactPaths: [".dove/evidence/index.json", ".dove/sources/index.json"],
      taxonomy: {
        familyId: "evidence-grounding",
        familyLabel: "Evidence grounding",
        groupId: "claim-source-support",
        groupLabel: "Claim-to-source support"
      },
      semantics: {
        relationType: "supported-by-source",
        label: "Tracks that a claim cites a registered source directly.",
        expectedFromEntityType: "claim",
        expectedToEntityType: "source",
        directionalMeaning: {
          forward: "Claim cites source",
          reverse: "Source supports claim"
        }
      },
      integrity: {
        status: "degraded",
        severity: "high",
        reasons: [{ code: "dangling-to-entity", severity: "high", message: "Relation claim-bad-supported-by-source points to a missing target endpoint missing-source." }],
        endpointChecks: [],
        sourceArtifactChecks: []
      },
      updatedAt: new Date(0).toISOString()
    }],
    summary: {
      totalRelations: 1,
      healthyCount: 0,
      degradedCount: 1,
      relationTypeCounts: { "supported-by-source": 1 },
      integrityReasonCounts: { "dangling-to-entity": 1 },
      repairFrontier: [],
      taxonomyRepairFrontier: [],
      taxonomy: {
        familyCount: 1,
        groupCount: 1,
        degradedFamilyCount: 1,
        degradedGroupCount: 1,
        familyCounts: { "evidence-grounding": 1 },
        groupCounts: { "claim-source-support": 1 },
        topDegradedFamilyIds: ["evidence-grounding"],
        topDegradedGroupIds: ["claim-source-support"],
        families: [{
          id: "evidence-grounding",
          label: "Evidence grounding",
          degradedCount: 1,
          totalRelations: 1,
          overview: "Evidence grounding has 1 degraded family relation out of 1; dominant type supported-by-source; top issues dangling-to-entity.",
          topReasonCodes: ["dangling-to-entity"]
        }],
        groups: [{
          id: "claim-source-support",
          label: "Claim-to-source support",
          degradedCount: 1,
          totalRelations: 1,
          overview: "Claim-to-source support has 1 degraded group relation out of 1; dominant type supported-by-source; top issues dangling-to-entity.",
          topReasonCodes: ["dangling-to-entity"]
        }],
        overview: "1 typed wiki relation families across 1 groups; 1 families currently degraded."
      }
    },
    updatedAt: new Date(0).toISOString()
  }, null, 2)}\n`, "utf8");

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /typed-wiki-relations-health/);
  assert.match(result.stdout, /dangling-to-entity|missing target endpoint/);
  assert.match(result.stdout, /degraded families|evidence-grounding/);
});

test("CLI doctor reports explicit non-object managed artifact internals before normalization", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-doctor-bad-shape-"));
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  fs.writeFileSync(path.join(target, ".dove", "meta", "recommendations.json"), `${JSON.stringify({
    version: 1,
    items: [],
    clusters: [],
    ranking: { method: "legacy", tieBreakOrder: "bad-shape" },
    frontier: { recommendationCount: 0 },
    summary: { topClusters: [] }
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(target, ".dove", "workspace", "index.json"), `${JSON.stringify({
    version: 6,
    repairFrontier: { prioritizedItems: [], relationFamilySummaries: [] },
    metaOptimize: {
      proposalOnly: true,
      topClusterIds: [],
      topRecommendationIds: [],
      topClusters: [],
      longHorizon: "bad-shape"
    }
  }, null, 2)}\n`, "utf8");

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /raw-meta-recommendations-shape/);
  assert.match(result.stdout, /ranking\.tieBreakOrder must be an array/);
  assert.match(result.stdout, /raw-workspace-index-shape/);
  assert.match(result.stdout, /metaOptimize\.longHorizon must be an object/);
});

test("CLI doctor reports workspace metaOptimize mirror drift explicitly", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "dove-doctor-meta-drift-"));
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  fs.writeFileSync(path.join(target, ".dove", "meta", "recommendations.json"), `${JSON.stringify({
    version: 3,
    proposalOnly: true,
    items: [{ id: "rec-1", priority: "critical" }],
    clusters: [{ id: "cluster-1", rank: 1 }],
    ranking: { method: "durable-signal-frontier-v1", signals: [], tieBreakOrder: ["score-desc"] },
    frontier: {
      recommendationCount: 1,
      criticalCount: 1,
      clusterCount: 1,
      frontierScore: 10,
      topClusterIds: ["cluster-1"],
      topRecommendationIds: ["rec-1"],
      activeSignalTypes: [],
      frontierSummary: "Drifted frontier.",
      rankingMethod: "durable-signal-frontier-v1",
      topClusters: [{ id: "cluster-1" }]
    },
    summary: {
      recommendationCount: 1,
      criticalCount: 1,
      clusterCount: 1,
      frontierScore: 10,
      categories: {},
      signalTypes: [],
      topClusterIds: ["cluster-1"],
      topRecommendationIds: ["rec-1"],
      clusterMembership: { "cluster-1": ["rec-1"] },
      topClusters: [{ id: "cluster-1" }]
    }
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(target, ".dove", "meta", "optimizer-state.json"), `${JSON.stringify({
    version: 4,
    proposalOnly: true,
    sourceArtifacts: [],
    frontier: {
      recommendationCount: 1,
      criticalCount: 1,
      clusterCount: 1,
      frontierScore: 10,
      activeSignalTypes: [],
      topClusterIds: ["cluster-1"],
      topRecommendationIds: ["rec-1"],
      topClusters: [{ id: "cluster-1" }],
      frontierSummary: "Drifted frontier.",
      rankingMethod: "durable-signal-frontier-v1",
      tieBreakOrder: ["score-desc"],
      reportPath: ".dove/meta/LATEST_OPTIMIZER_REPORT.md",
      recommendationsPath: ".dove/meta/recommendations.json",
      longHorizonPath: ".dove/meta/long-horizon-memory.json"
    },
    clusters: [{ id: "cluster-1" }],
    longHorizon: {
      familyCount: 1,
      recurringFamilyCount: 0,
      risingFamilyCount: 0,
      stableFamilyCount: 1,
      coolingFamilyCount: 0,
      topFamilyIds: ["family-1"],
      overview: "Long horizon.",
      memoryPath: ".dove/meta/long-horizon-memory.json"
    }
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(target, ".dove", "meta", "long-horizon-memory.json"), `${JSON.stringify({
    version: 1,
    proposalOnly: true,
    historyWindowSize: 30,
    horizon: {},
    summary: {
      familyCount: 1,
      recurringFamilyCount: 0,
      risingFamilyCount: 0,
      stableFamilyCount: 1,
      coolingFamilyCount: 0,
      topFamilyIds: ["family-1"],
      overview: "Long horizon."
    },
    history: [],
    families: []
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(target, ".dove", "workspace", "index.json"), `${JSON.stringify({
    version: 6,
    repairFrontier: { prioritizedItems: [], relationFamilySummaries: [] },
    metaOptimize: {
      proposalOnly: true,
      recommendationCount: 99,
      clusterCount: 5,
      topClusterIds: ["wrong-cluster"],
      topRecommendationIds: ["wrong-rec"],
      topClusters: [],
      reportPath: ".dove/meta/WRONG.md",
      recommendationsPath: ".dove/meta/recommendations.json",
      statePath: ".dove/meta/WRONG-STATE.json",
      longHorizonPath: ".dove/meta/WRONG-LONG.json",
      longHorizon: {
        topFamilyIds: ["wrong-family"],
        memoryPath: ".dove/meta/WRONG-LONG.json"
      }
    }
  }, null, 2)}\n`, "utf8");

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /raw-meta-optimize-mirror-consistency/);
  assert.match(result.stdout, /workspace metaOptimize recommendation count drift/);
  assert.match(result.stdout, /workspace metaOptimize reportPath drift/);
  assert.match(result.stdout, /workspace metaOptimize statePath drift/);
  assert.match(result.stdout, /proposalFrontier/);
  assert.match(result.stdout, /meta-optimize-drift/);
});
