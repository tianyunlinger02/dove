import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  GOVERNANCE_EXEMPT_MUTATIONS,
  GOVERNANCE_GUARDED_MUTATIONS,
  GOVERNANCE_NEGATIVE_COVERAGE,
  GOVERNANCE_READONLY_COMMANDS,
  GOVERNANCE_READONLY_TOOLS,
  ensureWorkspace,
  initProject,
  createDoveTask,
  launchDoveMission,
  materializeGuidancePacket,
  planCampaign,
  queryCampaigns,
  queryMetaOptimize,
  queryOperatorFollowThrough,
  queryOperatorLessons,
  queryProgramApprovals,
  queryTaskGraph,
  readState,
  readJson,
  resolveDurableTaskPacket,
  recordOperatorFollowThrough,
  recordOperatorLesson,
  refreshWiki,
  registerSource,
  updateResearchBrief,
  appendHandoff,
  appendReviewLog,
  applyDoveStatusAdjustments,
  recordDoveMissionPass,
  runDoveAuto,
  runDoveOperator,
  isOperationalFailureOutcome,
  buildRebuttal,
  buildRebuttalStrategy,
  bridgeExperimentResultToClaim,
  compareVersions,
  createVersionSnapshot,
  normalizeRebuttalIssues,
  upsertClaims,
  upsertDraft,
  upsertExperimentPlan,
  upsertExperimentResult,
  upsertOutline,
  upsertPlan,
  upsertRevisionPlan,
  upsertNote,
  runExperimentAudit,
  runExperienceWorkflow,
  runReviewLoop,
  setSectionStatus,
  sourceIdentityFingerprint,
  syncCitations,
  upsertFigurePlan,
  prepareFigureGeneration,
  importFigureGeneration,
  artifactEvidenceRole,
  completionEvidenceIntegrity,
  evidencePathProblemFlags,
  inspectDeclaredPath,
  isExternalArtifactReference,
  normalizeProjectRelativePath,
  queryWorkspaceIndex,
  validateFigurePipeline,
  upsertOrchestrationBoard
} from "../../src/core/internal-api.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { upsertSystemOrchestrationBoard } from "../../src/core/orchestration.mjs";
import { writeJson, writeText } from "../../src/core/workspace.mjs";
import { toolDefinitions } from "../../src/mcp/tool-definitions.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import { createMetaExecutionBridgeCandidatesIndex, createMetaLongHorizonMemory, createMetaOperatorLessonsIndex, createMetaOperatorPlaybooksIndex, createMetaOptimizerState, createMetaRemediationPacksIndex } from "../../src/core/schema.mjs";
import { ensureTestWorkspace, runFixtureMutation } from "../helpers/mutation-fixture.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function tempRoot() {
  return createTempRoot("dove-phase6-");
}

test("governance audit static detector covers async exports, const exports, fs writes, and class boundaries", () => {
  const scriptPath = path.join(process.cwd(), "scripts", "audit-governance-coverage.mjs");
  const scriptText = fs.readFileSync(scriptPath, "utf8");
  assert.ok(scriptText.includes("(?:async\\s+)?function"));
  assert.ok(scriptText.includes("const\\s+(\\w+)\\s*="));
  assert.ok(scriptText.includes("=>\\s*\\{"));
  for (const writeSignal of ["writeFile", "appendFile", "rm", "cp", "copyFile", "mkdir", "rename", "writeFileSync", "appendFileSync", "rmSync", "cpSync", "copyFileSync", "mkdirSync", "renameSync"]) {
    assert.ok(scriptText.includes(writeSignal), `missing write signal ${writeSignal}`);
  }
  assert.ok(scriptText.includes("fs(?:\\.promises)?"));
  assert.ok(scriptText.includes("fsPromises"));
  assert.ok(scriptText.includes("discoverCoreFiles"));
  assert.ok(scriptText.includes("src/core"));

  const root = tempRoot();

  return runFixtureMutation(root, "governance-audit-static-detector-covers-async-exports-const-exports-fs-w", () => {
  try {
    fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
    fs.mkdirSync(path.join(root, "src", "core"), { recursive: true });
    fs.copyFileSync(scriptPath, path.join(root, "scripts", "audit-governance-coverage.mjs"));
    fs.writeFileSync(path.join(root, "src", "core", "schema.mjs"), `
export const GOVERNANCE_GUARDED_MUTATIONS = [
  { surfaceBindings: { coreFunction: "mutateAfterClass" } }
];
export const GOVERNANCE_EXEMPT_MUTATIONS = [];
`, "utf8");
    fs.writeFileSync(path.join(root, "src", "core", "class-boundary.mjs"), `
import fs from "node:fs";

export function inspectBeforeClass() {
  return "read-only";
}

export class MutatingClass {
  mutateInsideClass() {
    fs.writeFileSync("class-method.txt", "must not be attributed to inspectBeforeClass");
  }
}

export function mutateAfterClass() {
  fs.writeFileSync("after-class.txt", "must remain covered");
}
`, "utf8");

    const audit = spawnSync(process.execPath, ["./scripts/audit-governance-coverage.mjs"], {
      cwd: root,
      encoding: "utf8"
    });
    assert.equal(audit.status, 0, audit.stderr || audit.stdout);
    const report = JSON.parse(audit.stdout);
    assert.deepEqual(report.mutatingCoreFunctions, ["mutateAfterClass"]);
  } finally {
  }

  });
});

test("governance audit exempt metadata check is not a wall-clock freshness gate", () => {
  const scriptText = fs.readFileSync(path.join(process.cwd(), "scripts", "audit-governance-coverage.mjs"), "utf8");
  assert.match(scriptText, /VALID_REVIEW_CADENCES/);
  assert.doesNotMatch(scriptText, /Date\.now\(\) - reviewWindowMs/);
  assert.doesNotMatch(scriptText, /lastReviewedAt\) < Date\.now/);
});

function seedTaskPacket(root, packetId = "task-test-main", overrides = {}) {
  const timestamp = new Date(0).toISOString();
  const packetPath = `.dove/task-packets/packets/${packetId}.json`;
  const packet = {
    id: packetId,
    title: overrides.title ?? "Test task packet",
    summary: overrides.summary ?? "Test packet for scoped write validation.",
    sourceType: overrides.sourceType ?? "test-task",
    sourceId: overrides.sourceId ?? packetId,
    status: overrides.status ?? "pending",
    lifecycleStatus: overrides.lifecycleStatus ?? "active",
    active: overrides.active ?? true,
    assignedRole: overrides.assignedRole ?? "builder",
    currentFocus: overrides.currentFocus ?? "Validate scoped writes against a durable packet.",
    nextAction: overrides.nextAction ?? "Run the guarded write.",
    dependencies: [],
    evidenceLinks: [],
    outputPaths: [],
    updatedAt: timestamp,
    packetPath,
    packetContextPath: `.dove/context/packets/${packetId}.json`,
    ...overrides
  };
  writeJson(root, packetPath, packet);
  const packetIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, { version: 3, items: [], lifecycleCounts: {}, dependencyHealth: {}, updatedAt: null });
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    ...packetIndex,
    items: [...(packetIndex.items ?? []).filter((item) => item.id !== packetId), packet],
    updatedAt: timestamp
  });
  return packet.id;
}

test("operational outcomes distinguish proposals from confirmed execution stalls", () => {
  assert.equal(isOperationalFailureOutcome({ status: "needs-confirmation" }), false);
  assert.equal(isOperationalFailureOutcome({ status: "needs-task-selection" }), false);
  for (const status of ["awaiting-host-pass", "awaiting-host-results", "needs-host-results"]) {
    assert.equal(isOperationalFailureOutcome({ status }, { confirmed: false }), false, `${status} unconfirmed`);
    assert.equal(isOperationalFailureOutcome({ status }, { confirmed: true }), true, `${status} confirmed`);
  }
  for (const status of ["foreground-pass-complete", "step-budget-exhausted"]) {
    assert.equal(isOperationalFailureOutcome({ status }, { confirmed: false }), false, `${status} unconfirmed`);
    assert.equal(isOperationalFailureOutcome({ status }, { confirmed: true }), false, `${status} confirmed`);
  }
});

function writeTaskTargetSettings(root, overrides) {
  const state = readState(root);
  writeJson(root, ARTIFACT_PATHS.state, {
    ...state,
    settings: {
      ...state.settings,
      taskTargetResolution: {
        ...state.settings.taskTargetResolution,
        ...overrides
      }
    }
  });
}

const HARDENING_CRITERION = "Hardening convergence criterion";
const HARDENING_EVIDENCE_PATH = ".dove/evidence/hardening-verification.log";

function hardeningExecutionContract(overrides = {}) {
  const base = {
    chainType: "engineering-host-pass-verify",
    roleSequence: ["builder", "reviewer"],
    readFirst: [],
    action: "project:dove.auto",
    implementation: ["Produce hardening workflow evidence."],
    files: [],
    materials: {
      requiredInputs: [],
      requiredArtifacts: [],
      sourceRefs: [],
      artifactRefs: []
    },
    convergence: {
      criteria: [HARDENING_CRITERION],
      verificationCommands: ["node --test tests/unit/phase6-hardening.test.mjs"],
      evidenceRequired: [HARDENING_EVIDENCE_PATH],
      definitionOfDone: "The hardening criterion is verified."
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

function hardeningVerifiedCriteria(criterion = HARDENING_CRITERION) {
  return [{ criterion, status: "verified", evidencePaths: [HARDENING_EVIDENCE_PATH] }];
}

function writeHardeningEvidenceFile(root, relativePath = HARDENING_EVIDENCE_PATH, text = "Hardening verification passed.\n") {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text, "utf8");
  return relativePath;
}

function writeHardeningEvidenceBuffer(root, relativePath, buffer) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buffer);
  return relativePath;
}

function jpegSegment(marker, data) {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(data.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), length, data]);
}

function validCompletionJpegBuffer() {
  const quantizationTable = Buffer.concat([Buffer.from([0]), Buffer.alloc(64, 1)]);
  const frame = Buffer.from([8, 0, 1, 0, 1, 1, 1, 0x11, 0]);
  const huffmanCounts = Buffer.from([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const huffmanTables = Buffer.concat([
    Buffer.from([0]), huffmanCounts, Buffer.from([0]),
    Buffer.from([0x10]), huffmanCounts, Buffer.from([0])
  ]);
  const scan = Buffer.from([1, 1, 0, 0, 63, 0]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jpegSegment(0xdb, quantizationTable),
    jpegSegment(0xc0, frame),
    jpegSegment(0xc4, huffmanTables),
    jpegSegment(0xda, scan),
    Buffer.from([0x3f, 0xff, 0xd9])
  ]);
}

function validCompletionPdfBuffer() {
  const prefix = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n";
  return Buffer.from([
    prefix,
    "xref\n",
    "0 2\n",
    "0000000000 65535 f \n",
    "0000000009 00000 n \n",
    "trailer\n",
    "<< /Size 2 /Root 1 0 R >>\n",
    "startxref\n",
    `${prefix.length}\n`,
    "%%EOF\n"
  ].join(""), "latin1");
}

function seedHardeningSource(root, packetId, sourceId = "hardening-source") {
  return registerSource(root, {
    packetId,
    sourceId,
    citationKey: sourceId,
    title: "Hardening Source",
    authors: ["Doe"],
    year: 2026,
    sourceType: "paper"
  }).id;
}

function seedHardeningTask(root, packetId, overrides = {}) {
  return seedTaskPacket(root, packetId, {
    status: "ready",
    level: 3,
    stage: "execute",
    executionContract: hardeningExecutionContract(),
    ...overrides
  });
}

function proposeAndRunHardeningAuto(root, args = {}, replayOverrides = {}) {
  const proposal = runDoveAuto(root, args);
  assert.equal(proposal.status, "needs-confirmation");
  return runWithMutationContext(root, {
    actionId: replayOverrides.runId ?? "hardening-auto-run",
    mutationMode: proposal.confirmArgs.mutationMode
  }, () => runDoveAuto(root, {
    ...proposal.confirmArgs,
    ...replayOverrides
  }));
}

test("runDoveAuto proposals are zero-write and exact replay fails closed", () => {
  const emptyRoot = tempRoot();
  const patchRoot = tempRoot();
  const selectionRoot = tempRoot();
  const otherRoot = tempRoot();
  try {
    const demandArgs = {
      id: "auto-exact-demand",
      goal: "Bind the exact new demand instead of selecting an existing task.",
      title: "Auto exact demand",
      checklist: false,
      maxIterations: 2,
      steps: [{
        command: "dove.note",
        args: {
          noteId: "auto-exact-note",
          title: "Auto exact note",
          sectionId: "hardening",
          summary: "Approved auto replay fields stay exact."
        }
      }]
    };
    const proposal = runDoveAuto(emptyRoot, demandArgs);
    assert.equal(proposal.status, "needs-confirmation");
    assert.equal(proposal.proposalKind, "demand");
    assert.equal(proposal.proposalOnly, true);
    assert.equal(proposal.noAutoApply, true);
    assert.deepEqual(proposal.writes, []);
    assert.equal(fs.existsSync(path.join(emptyRoot, ARTIFACT_PATHS.doveRoot)), false);

    const patchProposal = runWithMutationContext(patchRoot, {
      actionId: "auto-exact-patch-proposal",
      mutationMode: "patch-plan"
    }, () => runDoveAuto(patchRoot, demandArgs));
    assert.equal(patchProposal.proposalMutationMode, "patch-plan");
    assert.equal(patchProposal.confirmArgs.mutationMode, "patch-plan");
    assert.equal(patchProposal.writesApplied, false);
    assert.equal(patchProposal.mutationSummary.operationCount, 0);
    assert.deepEqual(patchProposal.mutationPlan.operations, []);
    assert.equal(fs.existsSync(path.join(patchRoot, ARTIFACT_PATHS.doveRoot)), false);

    assert.throws(() => runDoveAuto(emptyRoot, proposal.confirmArgs), /active MutationContext/u);
    for (const alteredArgs of [
      {
        ...structuredClone(proposal.confirmArgs),
        maxIterations: 3
      },
      {
        ...structuredClone(proposal.confirmArgs),
        steps: [{
          command: "dove.note",
          completeTask: true,
          args: {
            noteId: "auto-exact-note",
            title: "Auto exact note",
            sectionId: "hardening",
            summary: "Approved auto replay fields stay exact."
          }
        }]
      },
      {
        ...structuredClone(proposal.confirmArgs),
        mutationMode: "patch-plan"
      }
    ]) {
      assert.throws(() => runWithMutationContext(emptyRoot, {
        actionId: "auto-exact-rejected-replay",
        mutationMode: alteredArgs.mutationMode
      }, () => runDoveAuto(emptyRoot, alteredArgs)), /proposal replay no longer matches|does not match the active mutation context mode/u);
      assert.equal(fs.existsSync(path.join(emptyRoot, ARTIFACT_PATHS.doveRoot)), false);
    }

    assert.throws(() => runWithMutationContext(otherRoot, {
      actionId: "auto-exact-cross-workspace",
      mutationMode: proposal.confirmArgs.mutationMode
    }, () => runDoveAuto(otherRoot, proposal.confirmArgs)), /different canonical workspace/u);
    assert.equal(fs.existsSync(path.join(otherRoot, ARTIFACT_PATHS.doveRoot)), false);

    runFixtureMutation(selectionRoot, "auto-selection-root", () => {
    ensureTestWorkspace(selectionRoot);
    seedHardeningTask(selectionRoot, "auto-existing-only");
    const demandWithExisting = runDoveAuto(selectionRoot, {
      id: "auto-new-demand",
      goal: "Create the new approved demand even when one task already exists.",
      title: "Auto new demand",
      checklist: false,
      steps: [{
        command: "dove.note",
        args: {
          noteId: "auto-new-demand-note",
          title: "Auto new demand note",
          sectionId: "hardening",
          summary: "The new demand remains distinct from the existing task."
        }
      }]
    });
    assert.equal(demandWithExisting.proposalKind, "demand");
    assert.equal(demandWithExisting.proposedTask.id, "auto-new-demand");
    const demandRun = runWithMutationContext(selectionRoot, {
      actionId: "auto-new-demand-run",
      mutationMode: demandWithExisting.confirmArgs.mutationMode
    }, () => runDoveAuto(selectionRoot, {
      ...demandWithExisting.confirmArgs,
      runId: "auto-new-demand-run"
    }));
    assert.equal(demandRun.task.id, "auto-new-demand");
    assert.equal(readJson(selectionRoot, ARTIFACT_PATHS.taskPacketsIndex).items.some((item) => item.id === "auto-existing-only"), true);

    seedHardeningTask(selectionRoot, "auto-index-first", { title: "Auto index first" });
    seedHardeningTask(selectionRoot, "auto-index-second", { title: "Auto index second" });
    const indexProposal = runDoveAuto(selectionRoot, {
      index: 1,
      steps: [{ command: "dove.status" }]
    });
    assert.equal(indexProposal.proposalKind, "selection");
    const selectedId = indexProposal.confirmArgs.packetId;
    seedHardeningTask(selectionRoot, "auto-index-order-drift", { title: "AAA order drift" });
    const indexRun = runWithMutationContext(selectionRoot, {
      actionId: "auto-index-replay",
      mutationMode: indexProposal.confirmArgs.mutationMode
    }, () => runDoveAuto(selectionRoot, {
      ...indexProposal.confirmArgs,
      runId: "auto-index-replay"
    }));
    assert.equal(indexRun.task.id, selectedId);

    const staleProposal = runDoveAuto(selectionRoot, {
      packetId: "auto-index-second",
      steps: [{ command: "dove.status" }]
    });
    const stalePacketPath = `.dove/task-packets/packets/${staleProposal.confirmArgs.packetId}.json`;
    const stalePacket = readJson(selectionRoot, stalePacketPath);
    writeJson(selectionRoot, stalePacketPath, {
      ...stalePacket,
      status: "completed",
      lifecycleStatus: "completed",
      active: false
    });
    const staleIndex = readJson(selectionRoot, ARTIFACT_PATHS.taskPacketsIndex);
    writeJson(selectionRoot, ARTIFACT_PATHS.taskPacketsIndex, {
      ...staleIndex,
      items: staleIndex.items.map((item) => item.id === staleProposal.confirmArgs.packetId
        ? { ...item, status: "completed", lifecycleStatus: "completed", active: false }
        : item)
    });
    assert.throws(() => runWithMutationContext(selectionRoot, {
      actionId: "auto-stale-replay",
      mutationMode: staleProposal.confirmArgs.mutationMode
    }, () => runDoveAuto(selectionRoot, staleProposal.confirmArgs)), /no longer exists or is not active/u);
    });
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
    fs.rmSync(patchRoot, { recursive: true, force: true });
    fs.rmSync(selectionRoot, { recursive: true, force: true });
    fs.rmSync(otherRoot, { recursive: true, force: true });
  }
});

test("runDoveAuto rejects retired governance controls recursively before workspace writes", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "rundoveauto-rejects-retired-governance-controls-recursively-before-works", () => {
  try {
    assert.throws(() => runDoveAuto(root, {
      goal: "Reject legacy nested auto controls.",
      steps: [{ command: "dove.status" }, { command: "dove.note", args: { policyOverrideFutureMode: null } }]
    }), /retired governance input policyOverrideFutureMode at \$\.steps\[1\]\.args\.policyOverrideFutureMode/u);
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.doveRoot)), false);
  } finally {
  }
  });
});

test("runDoveAuto rejects retired aliases and unknown input before workspace writes", () => {
  const cases = [
    [{ command: "dove.status" }, /retired top-level input: command/u],
    [{ workflow: "dove.status" }, /retired top-level input: workflow/u],
    [{ preset: "dove.status" }, /retired top-level input: preset/u],
    [{ nextCommand: "dove.status" }, /retired top-level input: nextCommand/u],
    [{ complete: false }, /retired top-level input: complete/u],
    [{ autoSteps: [] }, /retired top-level input: autoSteps/u],
    [{ actions: [] }, /retired top-level input: actions/u],
    [{ unexpected: true }, /unknown input \$\.unexpected/u],
    [{ steps: ["dove.status"] }, /requires an object at \$\.steps\[0\]/u],
    [{ steps: [{ command: "dove.note", unexpected: true }] }, /unknown input \$\.steps\[0\]\.unexpected/u],
    [{ steps: [{ command: "dove.note", args: { unexpected: true } }] }, /unknown input \$\.steps\[0\]\.args\.unexpected/u],
    [{ steps: [{ command: "dove.status", args: { scope: "paper" } }] }, /unknown input \$\.steps\[0\]\.args\.scope/u]
  ];

  for (const [args, expected] of cases) {
    const root = tempRoot();
    return runFixtureMutation(root, "rundoveauto-rejects-retired-aliases-and-unknown-input-before-workspace-w", () => {
    try {
      assert.throws(() => runDoveAuto(root, args), expected);
      assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.doveRoot)), false);
    } finally {
      // Mutation provenance is finalized after the callback returns.
    }
    });
  }
});

test("runDoveAuto rejects nested caller assertions and system metadata before workspace writes", () => {
  const cases = [
    [{ goal: "Reject forged figure coverage.", steps: [{ command: "dove.figure", args: { semanticCoverage: { visualElements: ["claim node"] } } }] }, /unknown input \$\.steps\[0\]\.args\.semanticCoverage\.visualElements/u],
    [{ goal: "Reject semantic coverage self-description.", steps: [{ command: "dove.figure", args: { semanticCoverage: { summary: "claim node" } } }] }, /unknown input \$\.steps\[0\]\.args\.semanticCoverage\.summary/u],
    [{ goal: "Reject forged figure review.", steps: [{ command: "dove.figure", args: { semanticReview: { reviewed: true } } }] }, /unknown input \$\.steps\[0\]\.args\.semanticReview\.reviewed/u],
    [{ goal: "Reject forged figure approval.", steps: [{ command: "dove.figure", args: { semanticReview: { status: "approved" } } }] }, /unknown input \$\.steps\[0\]\.args\.semanticReview\.status/u],
    [{ goal: "Reject forged material availability.", steps: [{ command: "dove.figure", args: { materialRequirements: [{ label: "result plot", status: "available" }] } }] }, /unknown input \$\.steps\[0\]\.args\.materialRequirements\[0\]\.status/u],
    [{ goal: "Reject material provenance injection.", steps: [{ command: "dove.figure", args: { materialHints: [{ label: "result plot", source: "trusted" }] } }] }, /unknown input \$\.steps\[0\]\.args\.materialHints\[0\]\.source/u],
    [{ goal: "Reject experience lifecycle injection.", steps: [{ command: "dove.experience", args: { plan: { goal: "Measure quality", status: "completed" } } }] }, /unknown input \$\.steps\[0\]\.args\.plan\.status/u],
    [{ goal: "Reject experience timestamp injection.", steps: [{ command: "dove.experience", args: { result: { outcome: "supports", createdAt: "2040-01-01T00:00:00.000Z" } } }] }, /unknown input \$\.steps\[0\]\.args\.result\.createdAt/u],
    [{ goal: "Reject malformed source authors.", steps: [{ command: "dove.source", args: { sources: [{ title: "Typed source", locator: "https://example.test/source", authors: ["Ada", 42] }] } }] }, /requires a string at \$\.steps\[0\]\.args\.sources\[0\]\.authors\[1\]/u],
    [{ goal: "Reject source type coercion.", steps: [{ command: "dove.source", args: { sources: [{ title: 42, locator: "https://example.test/source" }] } }] }, /requires a string at \$\.steps\[0\]\.args\.sources\[0\]\.title/u],
    [{ goal: "Reject top-level caller receipt authority.", executionReceipt: { status: "completed" }, steps: [{ command: "dove.status" }] }, /caller-controlled executionReceipt at \$\.executionReceipt/u],
    [{ goal: "Reject step caller receipt authority.", steps: [{ command: "dove.status", executionReceipt: { status: "completed" } }] }, /caller-controlled executionReceipt at \$\.steps\[0\]\.executionReceipt/u],
    [{ goal: "Reject nested failure-route receipt authority.", steps: [{ command: "dove.note", failureRoutes: [{ on: "failure", executionReceipt: { status: "completed" } }], args: { summary: "Receipt must not enter a step route." } }] }, /caller-controlled executionReceipt at \$\.steps\[0\]\.failureRoutes\[0\]\.executionReceipt/u],
    [{ goal: "Reject nested execution-contract receipt authority.", steps: [{ command: "dove.note", executionContract: { failureRoutes: [{ on: "failure", executionReceipt: { status: "completed" } }] }, args: { summary: "Receipt must not enter an execution contract." } }] }, /caller-controlled executionReceipt at \$\.steps\[0\]\.executionContract\.failureRoutes\[0\]\.executionReceipt/u],
    [{ goal: "Reject nested execution-file receipt authority.", steps: [{ command: "dove.note", executionContract: { files: [{ path: "src/example.mjs", executionReceipt: { status: "completed" } }] }, args: { summary: "Receipt must not enter an execution file." } }] }, /caller-controlled executionReceipt at \$\.steps\[0\]\.executionContract\.files\[0\]\.executionReceipt/u],
    [{ goal: "Reject nested review draft receipt authority.", steps: [{ command: "dove.review-loop", args: { draft: { body: "Builder revision.", executionReceipt: { status: "completed" } } } }] }, /caller-controlled executionReceipt at \$\.steps\[0\]\.args\.draft\.executionReceipt/u],
    [{ goal: "Reject nested review experience receipt authority.", steps: [{ command: "dove.review-loop", args: { experience: { goal: "Measure quality.", executionReceipt: { status: "completed" } } } }] }, /caller-controlled executionReceipt at \$\.steps\[0\]\.args\.experience\.executionReceipt/u],
    [{ goal: "Reject nested rebuttal receipt authority.", steps: [{ command: "dove.rebuttal", args: { issues: [{ summary: "Address concern.", executionReceipt: { status: "completed" } }] } }] }, /caller-controlled executionReceipt at \$\.steps\[0\]\.args\.issues\[0\]\.executionReceipt/u],
    [{ goal: "Reject recommended-route receipt authority.", workContract: { recommendedRoutes: [{ command: "project:dove.auto", executionReceipt: { status: "completed" } }] }, steps: [{ command: "dove.status" }] }, /caller-controlled executionReceipt at \$\.workContract\.recommendedRoutes\[0\]\.executionReceipt/u],
    [{ goal: "Reject checklist contract receipt authority.", checklistItems: [{ title: "Nested checklist", executionContract: { failureRoutes: [{ on: "failure", executionReceipt: { status: "completed" } }] } }], steps: [{ command: "dove.status" }] }, /caller-controlled executionReceipt at \$\.checklistItems\[0\]\.executionContract\.failureRoutes\[0\]\.executionReceipt/u],
    [{ goal: "Reject failure-route metadata.", steps: [{ command: "dove.note", failureRoutes: [{ on: "failure", unexpected: true }], args: { summary: "Reject unknown route fields." } }] }, /unknown input \$\.steps\[0\]\.failureRoutes\[0\]\.unexpected/u],
    [{ goal: "Reject execution-file metadata.", steps: [{ command: "dove.note", executionContract: { files: [{ path: "src/example.mjs", unexpected: true }] }, args: { summary: "Reject unknown execution file fields." } }] }, /unknown input \$\.steps\[0\]\.executionContract\.files\[0\]\.unexpected/u],
    [{ goal: "Reject execution-contract metadata.", steps: [{ command: "dove.note", executionContract: { convergence: { criteria: ["Verified"], unexpected: true } }, args: { summary: "Reject unknown convergence fields." } }] }, /unknown input \$\.steps\[0\]\.executionContract\.convergence\.unexpected/u],
    [{ goal: "Reject invalid execution chain.", steps: [{ command: "dove.note", executionContract: { chainType: "caller-defined-chain" }, args: { summary: "Reject normalized execution chain authority." } }] }, /requires one of .* at \$\.steps\[0\]\.executionContract\.chainType/u],
    [{ goal: "Reject invalid execution role.", steps: [{ command: "dove.note", executionContract: { roleSequence: ["planner", "caller-role"] }, args: { summary: "Reject normalized execution role authority." } }] }, /requires one of .* at \$\.steps\[0\]\.executionContract\.roleSequence\[1\]/u],
    [{ goal: "Reject invalid checklist execution role.", checklistItems: [{ title: "Nested checklist", executionContract: { roleSequence: ["system"] } }], steps: [{ command: "dove.status" }] }, /requires one of .* at \$\.checklistItems\[0\]\.executionContract\.roleSequence\[0\]/u],
    [{ goal: "Reject review draft metadata.", steps: [{ command: "dove.review-loop", args: { draft: { body: "Builder revision.", unexpected: true } } }] }, /unknown input \$\.steps\[0\]\.args\.draft/u],
    [{ goal: "Reject review experience metadata.", steps: [{ command: "dove.review-loop", args: { experience: { goal: "Measure quality.", unexpected: true } } }] }, /unknown input \$\.steps\[0\]\.args\.experience/u],
    [{ goal: "Reject rebuttal metadata.", steps: [{ command: "dove.rebuttal", args: { issues: [{ summary: "Address concern.", unexpected: true }] } }] }, /unknown input \$\.steps\[0\]\.args\.issues\[0\]\.unexpected/u],
    [{ goal: "Reject route metadata.", workContract: { recommendedRoutes: [{ command: "project:dove.auto", unexpected: true }] }, steps: [{ command: "dove.status" }] }, /unknown input \$\.workContract\.recommendedRoutes\[0\]\.unexpected/u],
    [{ goal: "Reject checklist metadata.", checklistItems: [{ title: "Nested checklist", unexpected: true }], steps: [{ command: "dove.status" }] }, /unknown input \$\.checklistItems\[0\]\.unexpected/u],
    [{ goal: "Reject initial demand authority.", ownerRole: "reviewer", steps: [{ command: "dove.status" }] }, /initial demand cannot set system-owned governance input: ownerRole/u],
    [{ goal: "Reject initial demand boundary.", boundary: { type: "needs-review" }, steps: [{ command: "dove.status" }] }, /initial demand cannot set system-owned governance input: boundary/u]
  ];

  for (const [args, expected] of cases) {
    const root = tempRoot();
    return runFixtureMutation(root, "rundoveauto-rejects-nested-caller-assertions-and-system-metadata-before-", () => {
    try {
      assert.throws(() => runDoveAuto(root, args), expected);
      assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.doveRoot)), false);
    } finally {
      // Mutation provenance is finalized after the callback returns.
    }
    });
  }
});

test("createDoveTask rejects initial governance injection while canonical replay remains valid", () => {
  for (const [args, expected] of [
    [{ goal: "Reject creator authority.", creatorKind: "system" }, /initial demand cannot set system-owned governance input: creatorKind/u],
    [{ goal: "Reject role authority.", nextRole: "reviewer" }, /initial demand cannot set system-owned governance input: nextRole/u],
    [{ goal: "Reject handoff authority.", handoff: { toRole: "reviewer" } }, /initial demand cannot set system-owned governance input: handoff/u]
  ]) {
    const root = tempRoot();
    try {
      assert.throws(() => createDoveTask(root, args), expected);
      assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.doveRoot)), false);
    } finally {
      }
  }

  const replayRoot = tempRoot();
  try {
    runFixtureMutation(replayRoot, "replay-root", () => {
    const proposal = createDoveTask(replayRoot, {
      id: "canonical-governance-replay",
      goal: "Keep system-generated governance replay operational.",
      checklist: false
    });
    const materialized = runWithMutationContext(replayRoot, {
      actionId: "canonical-governance-replay",
      mutationMode: proposal.confirmArgs.mutationMode
    }, () => createDoveTask(replayRoot, proposal.confirmArgs));
    assert.equal(materialized.createdTask.id, "canonical-governance-replay");
    });
  } finally {
    fs.rmSync(replayRoot, { recursive: true, force: true });
  }
});

test("nested public MCP schemas are sealed against success and governance injection", () => {
  const autoTool = toolDefinitions.find((tool) => tool.name === "run_dove_auto");
  const experienceTool = toolDefinitions.find((tool) => tool.name === "run_experience_workflow");
  const figureTool = toolDefinitions.find((tool) => tool.name === "run_figure_workflow");
  const autoStep = autoTool.inputSchema.properties.steps.items;
  const branchFor = (command) => autoStep.allOf.find((branch) => branch.if.properties.command.const === command).then.properties.args;
  const figureArgs = branchFor("dove.figure");
  const experienceArgs = branchFor("dove.experience");

  assert.equal(autoTool.inputSchema.properties.executionReceipt, undefined);
  assert.equal(autoStep.properties.executionReceipt, undefined);

  for (const schema of [
    autoTool.inputSchema.properties.boundary,
    autoTool.inputSchema.properties.handoff,
    figureArgs.properties.semanticCoverage,
    figureArgs.properties.semanticReview,
    figureArgs.properties.materialRequirements.items,
    experienceArgs.properties.plan,
    experienceArgs.properties.result,
    experienceTool.inputSchema.properties.plan,
    experienceTool.inputSchema.properties.result,
    figureTool.inputSchema.properties.materialRequirements.items
  ]) {
    assert.equal(schema.additionalProperties, false);
  }

  for (const field of ["summary", "visualElements", "coveredVisualElements", "passed", "reviewed", "humanReviewed", "approved", "status", "verdict"]) {
    assert.equal(Object.hasOwn(figureArgs.properties.semanticCoverage.properties, field), false);
  }
  for (const field of ["visualElements", "coveredVisualElements", "passed", "reviewed", "humanReviewed", "approved", "status", "verdict"]) {
    assert.equal(Object.hasOwn(figureArgs.properties.semanticReview.properties, field), false);
  }
  for (const field of ["status", "source", "evidence", "createdAt", "updatedAt", "packetId", "runId"]) {
    assert.equal(Object.hasOwn(figureArgs.properties.materialRequirements.items.properties, field), false);
  }
  for (const field of ["status", "createdAt", "updatedAt", "packetId"]) {
    assert.equal(Object.hasOwn(experienceArgs.properties.plan.properties, field), false);
  }
  for (const field of ["createdAt", "updatedAt", "packetId", "auditVerdict"]) {
    assert.equal(Object.hasOwn(experienceArgs.properties.result.properties, field), false);
  }
});

test("figure public boundaries reject semantic success and material metadata before writes", () => {
  for (const [invoke, expected] of [
    [
      (root) => prepareFigureGeneration(root, {
        materialHints: [{ label: "result plot", status: "available" }]
      }),
      /unknown input \$\.materialHints\[0\]\.status/u
    ],
    [
      (root) => importFigureGeneration(root, {
        semanticCoverage: { summary: "claim node" }
      }),
      /unknown input \$\.semanticCoverage\.summary/u
    ],
    [
      (root) => importFigureGeneration(root, {
        semanticReview: { status: "approved" }
      }),
      /unknown input \$\.semanticReview\.status/u
    ]
  ]) {
    const root = tempRoot();
    return runFixtureMutation(root, "figure-public-boundaries-reject-semantic-success-and-material-metadata-b", () => {
    try {
      assert.throws(() => invoke(root), expected);
      assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.doveRoot)), false);
    } finally {
      // Mutation provenance is finalized after the callback returns.
    }
    });
  }
});

test("caller output manifests cannot assert figure semantic success", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "caller-output-manifests-cannot-assert-figure-semantic-success", () => {
  try {
    ensureTestWorkspace(root);
    const packetId = seedTaskPacket(root, "caller-manifest-semantic-success");
    upsertFigurePlan(root, {
      packetId,
      items: [{
        id: "caller-manifest-figure",
        sourceSections: ["method"],
        requiredVisualElements: ["claim node"],
        templateSvgPath: ".dove/figures/caller-manifest-figure.template.svg",
        editableSvgPath: ".dove/figures/caller-manifest-figure.editable.svg",
        finalSvgPath: ".dove/figures/caller-manifest-figure.final.svg"
      }]
    });
    prepareFigureGeneration(root, {
      packetId,
      figureId: "caller-manifest-figure",
      runId: "caller-manifest-run"
    });
    const manifestPath = ".dove/figures/runs/caller-manifest-run/caller-output.json";
    writeJson(root, manifestPath, {
      sourceSvgPath: ".dove/figures/runs/caller-manifest-run/caller.svg",
      svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Unrelated content</text></svg>",
      semanticCoverage: { summary: "claim node" },
      semanticReview: { status: "approved" }
    });

    assert.throws(() => importFigureGeneration(root, {
      packetId,
      figureId: "caller-manifest-figure",
      runId: "caller-manifest-run",
      outputManifestPath: manifestPath
    }), /cannot set caller-controlled semantic success input: semanticCoverage, semanticReview/u);

    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "caller-manifest-figure.final.svg")), false);
    const generations = readJson(root, ARTIFACT_PATHS.figureGenerations, { version: 1, items: [] });
    assert.equal(generations.items.find((item) => item.id === "caller-manifest-run")?.status, "prepared");
  } finally {
  }
  });
});

test("runExperienceWorkflow rejects system-owned nested fields before workspace writes", () => {
  for (const [args, expected] of [
    [{ plan: { goal: "Measure quality", status: "completed" } }, /unknown input \$\.plan\.status/u],
    [{ plan: { goal: "Measure quality", createdAt: "2040-01-01T00:00:00.000Z" } }, /unknown input \$\.plan\.createdAt/u],
    [{ result: { outcome: "supports", updatedAt: "2040-01-01T00:00:00.000Z" } }, /unknown input \$\.result\.updatedAt/u]
  ]) {
    const root = tempRoot();
    return runFixtureMutation(root, "runexperienceworkflow-rejects-system-owned-nested-fields-before-workspac", () => {
    try {
      assert.throws(() => runExperienceWorkflow(root, args), expected);
      assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.doveRoot)), false);
    } finally {
      // Mutation provenance is finalized after the callback returns.
    }
    });
  }
});

test("public board mutation APIs cannot self-grant ownership after a role guard rejects the caller", () => {
  const root = tempRoot();
  try {
    runFixtureMutation(root, "public-board-ownership-escalation", () => {
      ensureTestWorkspace(root);
      const boardPath = path.join(root, ARTIFACT_PATHS.orchestrationBoard);
      const handoffPath = path.join(root, ARTIFACT_PATHS.orchestrationHandoffs);
      const boardBefore = fs.readFileSync(boardPath, "utf8");
      const handoffBefore = fs.readFileSync(handoffPath, "utf8");

      assert.throws(
        () => appendHandoff(root, { fromRole: "reviewer", toRole: "reviewer", summary: "Unauthorized reviewer mutation." }),
        /cannot claim or transfer board ownership/u
      );
      assert.throws(
        () => upsertOrchestrationBoard(root, { assignedRole: "reviewer", currentFocus: "Caller-selected owner." }),
        /cannot transfer board ownership/u
      );
      assert.equal(fs.readFileSync(boardPath, "utf8"), boardBefore);
      assert.equal(fs.readFileSync(handoffPath, "utf8"), handoffBefore);

      assert.throws(
        () => appendHandoff(root, { fromRole: "reviewer", toRole: "builder", summary: "Retry after attempted escalation." }),
        /cannot claim or transfer board ownership/u
      );
      assert.equal(fs.readFileSync(boardPath, "utf8"), boardBefore);
      assert.equal(fs.readFileSync(handoffPath, "utf8"), handoffBefore);
    });

    for (const [toolName, args, expected] of [
      ["upsert_orchestration_board", { assignedRole: "reviewer" }, /does not accept unknown input: \$\.assignedRole/u],
      ["append_handoff", { fromRole: "planner", toRole: "reviewer", summary: "MCP escalation." }, /does not accept unknown input: \$\.fromRole, \$\.toRole/u]
    ]) {
      const response = dispatchTool(root, toolName, args);
      const message = response.content?.[0]?.text ?? "";
      assert.equal(response.isError, true);
      assert.match(message, expected);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("recordDoveMissionPass rejects public authority fields at every supported envelope depth without durable writes", () => {
  const authorityValues = {
    ownerRole: "reviewer",
    nextRole: "planner",
    handoff: { reason: "caller-selected route" },
    handoffId: "caller-handoff"
  };
  const attacks = [];
  for (const [field, value] of Object.entries(authorityValues)) {
    attacks.push({ label: field, args: { [field]: value }, expectedPath: field });
    attacks.push({ label: `planned-${field}`, args: { plannedMissions: [{ [field]: value }] }, expectedPath: `plannedMissions[0].${field}` });
    for (const envelope of ["missionPass", "passResult", "result"]) {
      attacks.push({ label: `${envelope}-${field}`, args: { [envelope]: { [field]: value } }, expectedPath: `${envelope}.${field}` });
      attacks.push({ label: `${envelope}-nested-${field}`, args: { [envelope]: { result: { [field]: value } } }, expectedPath: `${envelope}.result.${field}` });
      attacks.push({ label: `${envelope}-planned-${field}`, args: { [envelope]: { plannedMissions: [{ [field]: value }] } }, expectedPath: `${envelope}.plannedMissions[0].${field}` });
    }
  }

  for (const attack of attacks) {
    const mcpRoot = tempRoot();
    try {
      const response = dispatchTool(mcpRoot, "record_dove_mission_pass", attack.args);
      assert.equal(response.isError, true);
      assert.match(response.content?.[0]?.text ?? "", /does not accept unknown input|unknown input|does not accept system-owned workflow routing fields/u);
      assert.equal(fs.existsSync(path.join(mcpRoot, ARTIFACT_PATHS.doveRoot)), false);
    } finally {
      fs.rmSync(mcpRoot, { recursive: true, force: true });
    }

    const emptyRoot = tempRoot();
    try {
      runFixtureMutation(emptyRoot, `empty-${attack.label}`, () => {
        assert.throws(
          () => recordDoveMissionPass(emptyRoot, attack.args),
          new RegExp(attack.expectedPath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u")
        );
        assert.equal(fs.existsSync(path.join(emptyRoot, ARTIFACT_PATHS.doveRoot)), false);
      });
    } finally {
      fs.rmSync(emptyRoot, { recursive: true, force: true });
    }

    const root = tempRoot();
    try {
      runFixtureMutation(root, `durable-${attack.label}`, () => {
        ensureTestWorkspace(root);
        seedHardeningTask(root, "routing-field-task", {
          ownerRole: "builder",
          nextRole: "reviewer",
          handoff: { id: "durable-handoff", fromRole: "builder", toRole: "reviewer" },
          handoffId: "durable-handoff"
        });
        const packetPath = path.join(root, ".dove", "task-packets", "packets", "routing-field-task.json");
        const indexPath = path.join(root, ARTIFACT_PATHS.taskPacketsIndex);
        const packetBefore = fs.readFileSync(packetPath, "utf8");
        const indexBefore = fs.readFileSync(indexPath, "utf8");

        assert.throws(
          () => recordDoveMissionPass(root, {
            packetId: "routing-field-task",
            resultStatus: "blocked",
            ...attack.args
          }),
          new RegExp(attack.expectedPath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u")
        );
        assert.equal(fs.readFileSync(packetPath, "utf8"), packetBefore);
        assert.equal(fs.readFileSync(indexPath, "utf8"), indexBefore);
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("workflow completion hardening rejects fake completion signals", () => {
  const missionRoot = tempRoot();
  try {
    runFixtureMutation(missionRoot, "mission-root", () => {
    ensureTestWorkspace(missionRoot);
    seedTaskPacket(missionRoot, "summary-only-mission", {
      status: "ready",
      level: 3,
      stage: "execute",
      executionContract: hardeningExecutionContract()
    });
    const summaryOnly = recordDoveMissionPass(missionRoot, {
      packetId: "summary-only-mission",
      resultStatus: "completed",
      summary: "Summary without evidence must not complete."
    });
    assert.equal(summaryOnly.status, "needs-completion-evidence");
    assert.equal(summaryOnly.boundaryType, "missing-required-materials");
    assert.deepEqual(summaryOnly.writes, []);
    assert.equal(readJson(missionRoot, ARTIFACT_PATHS.taskPacketsIndex).items.find((item) => item.id === "summary-only-mission").status, "ready");
    });
  } finally {
    fs.rmSync(missionRoot, { recursive: true, force: true });
  }

  const readOnlyRoot = tempRoot();
  try {
    runFixtureMutation(readOnlyRoot, "read-only-root", () => {
    ensureTestWorkspace(readOnlyRoot);
    seedTaskPacket(readOnlyRoot, "read-only-auto", {
      status: "ready",
      level: 3,
      stage: "execute",
      executionContract: hardeningExecutionContract(),
      nextAction: "project:dove.status"
    });
    const readOnly = proposeAndRunHardeningAuto(readOnlyRoot, {
      packetId: "read-only-auto",
      steps: [{ command: "dove.status", completeTask: true }]
    }, {
      runId: "read-only-auto-run"
    });
    assert.equal(readOnly.status, "needs-explicit-progress-step");
    assert.equal(readOnly.requestedStatus, "completed");
    assert.deepEqual(readOnly.writes, []);
    assert.equal(readOnly.task.status, "ready");
    assert.equal(readOnly.result.taskStatusAfter, "ready");
    });
  } finally {
    fs.rmSync(readOnlyRoot, { recursive: true, force: true });
  }

  const autoRoot = tempRoot();
  try {
    runFixtureMutation(autoRoot, "auto-root", () => {
    ensureTestWorkspace(autoRoot);
    seedTaskPacket(autoRoot, "auto-unverified-artifact", {
      status: "ready",
      level: 3,
      stage: "execute",
      executionContract: hardeningExecutionContract()
    });
    const hardeningSourceId = seedHardeningSource(autoRoot, "auto-unverified-artifact");
    const autoUnverified = proposeAndRunHardeningAuto(autoRoot, {
      packetId: "auto-unverified-artifact",
      steps: [{
        command: "dove.note",
        completeTask: true,
        args: {
          noteId: "auto-unverified-note",
          title: "Auto unverified note",
          sectionId: "hardening",
          sourceIds: [hardeningSourceId],
          summary: "Artifact output without verified criteria must not complete."
        }
      }]
    }, {
      runId: "auto-unverified-artifact-run"
    });
    assert.equal(autoUnverified.status, "verification-failed");
    assert.equal(autoUnverified.task.status, "blocked");
    assert.equal(autoUnverified.boundary.type, "verification-failed");
    assert.deepEqual(autoUnverified.boundary.requiredActions, ["provide-verified-criteria", "cover-missing-convergence-criteria", "attach-verification-evidence"]);
    });
  } finally {
    fs.rmSync(autoRoot, { recursive: true, force: true });
  }

  const operatorRoot = tempRoot();
  try {
    runFixtureMutation(operatorRoot, "operator-root", () => {
    ensureTestWorkspace(operatorRoot);
    seedTaskPacket(operatorRoot, "operator-summary-only", {
      status: "ready",
      level: 3,
      stage: "execute",
      goal: "Collect source provenance through a host pass.",
      nextAction: "project:dove.source",
      executionContract: hardeningExecutionContract()
    });
    const operator = runDoveOperator(operatorRoot, {
      confirmed: true,
      includeQueueDetails: true,
      runId: "operator-summary-only-run",
      taskResults: [{
        packetId: "operator-summary-only",
        resultStatus: "completed",
        summary: "Host pass says done without evidence."
      }]
    });
    assert.equal(operator.result.iterations[0].status, "needs-completion-evidence");
    assert.equal(operator.updatedTasks[0].status, "blocked");
    const operatorSummaryOnlyTask = readJson(operatorRoot, ARTIFACT_PATHS.taskPacketsIndex).items.find((item) => item.id === "operator-summary-only");
    assert.equal(operatorSummaryOnlyTask.status, "blocked");
    assert.equal(operatorSummaryOnlyTask.boundary.type, "missing-required-materials");
    });
  } finally {
    fs.rmSync(operatorRoot, { recursive: true, force: true });
  }

  const unknownRoot = tempRoot();
  try {
    runFixtureMutation(unknownRoot, "unknown-root", () => {
    ensureTestWorkspace(unknownRoot);
    seedTaskPacket(unknownRoot, "operator-unknown-status", {
      status: "ready",
      level: 3,
      stage: "execute",
      goal: "Collect source provenance through a host pass.",
      nextAction: "project:dove.source",
      executionContract: hardeningExecutionContract()
    });
    const unknown = runDoveOperator(unknownRoot, {
      confirmed: true,
      includeQueueDetails: true,
      runId: "operator-unknown-status-run",
      taskResults: [{
        packetId: "operator-unknown-status",
        resultStatus: "mystery",
        summary: "Unknown host result status should not be normalized to completed.",
        verificationEvidencePaths: [HARDENING_EVIDENCE_PATH],
        verifiedCriteria: hardeningVerifiedCriteria()
      }]
    });
    assert.equal(unknown.result.iterations[0].status, "in-progress");
    assert.equal(unknown.updatedTasks[0].status, "in-progress");
    assert.equal(readJson(unknownRoot, ARTIFACT_PATHS.taskPacketsIndex).items.find((item) => item.id === "operator-unknown-status").status, "in-progress");
    });
  } finally {
    fs.rmSync(unknownRoot, { recursive: true, force: true });
  }
});

test("completion evidence accepts eligible typed sources while source ledgers remain bookkeeping", () => {
  const root = createTempRoot("dove-typed-source-evidence-");
  const source = {
    id: "typed-source",
    title: "Typed Source Evidence",
    authors: ["Ada Researcher"],
    locator: "https://example.org/typed-source",
    lifecycle: "verified",
    packetIds: ["typed-source-packet"]
  };
  const fingerprint = sourceIdentityFingerprint(source);
  fs.mkdirSync(path.join(root, ".dove/sources"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove/sources/index.json"), `${JSON.stringify({ version: 2, items: [{ ...source, fingerprint }], updatedAt: new Date(0).toISOString() }, null, 2)}\n`);
  fs.writeFileSync(path.join(root, ".dove/sources/verifications.json"), `${JSON.stringify({ version: 1, items: [{ id: "verification-1", sourceId: source.id, packetId: "typed-source-packet", fingerprint, decision: "verified", checkedAt: new Date(0).toISOString() }], updatedAt: new Date(0).toISOString() }, null, 2)}\n`);

  const typed = completionEvidenceIntegrity(root, { evidencePaths: ["source:typed-source"] }, {
    context: { eligibleSourceReferences: ["source:typed-source"] }
  });
  assert.equal(typed.hasSubstantiveEvidence, true);
  assert.deepEqual(typed.substantiveEvidencePaths, ["source:typed-source"]);

  const ledgers = completionEvidenceIntegrity(root, { evidencePaths: [ARTIFACT_PATHS.sources, ARTIFACT_PATHS.sourceVerifications] });
  assert.equal(ledgers.hasSubstantiveEvidence, false);
  assert.ok(ledgers.pathEvidence.bookkeepingPaths.includes(ARTIFACT_PATHS.sources));
  assert.ok(ledgers.pathEvidence.bookkeepingPaths.includes(ARTIFACT_PATHS.sourceVerifications));
});

test("completion evidence integrity rejects fake local paths and bookkeeping-only evidence", () => {
  const missingRoot = tempRoot();
  try {
    runFixtureMutation(missingRoot, "missing-root", () => {
    ensureTestWorkspace(missingRoot);
    seedHardeningTask(missingRoot, "missing-evidence-task");
    const result = recordDoveMissionPass(missingRoot, {
      packetId: "missing-evidence-task",
      runId: "missing-evidence-run",
      resultStatus: "completed",
      resultSummary: "Completion cites a missing file path.",
      artifactRefs: [".dove/evidence/does-not-exist.md"],
      verificationEvidencePaths: [".dove/evidence/also-missing.log"],
      verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [".dove/evidence/also-missing.log"] }]
    });
    assert.equal(result.status, "needs-completion-evidence");
    assert.equal(result.boundaryType, "missing-required-materials");
    assert.ok(result.evidenceIntegrity.problemPaths.includes(".dove/evidence/does-not-exist.md"));
    assert.ok(result.evidenceIntegrity.problemPaths.includes(".dove/evidence/also-missing.log"));
    assert.equal(readJson(missingRoot, ARTIFACT_PATHS.taskPacketsIndex).items.find((item) => item.id === "missing-evidence-task").status, "ready");
    });
  } finally {
    fs.rmSync(missingRoot, { recursive: true, force: true });
  }

  const emptyRoot = tempRoot();
  try {
    runFixtureMutation(emptyRoot, "empty-root", () => {
    ensureTestWorkspace(emptyRoot);
    seedHardeningTask(emptyRoot, "empty-evidence-task");
    writeHardeningEvidenceFile(emptyRoot, HARDENING_EVIDENCE_PATH, "");
    const result = recordDoveMissionPass(emptyRoot, {
      packetId: "empty-evidence-task",
      runId: "empty-evidence-run",
      resultStatus: "completed",
      resultSummary: "Completion cites an empty verification file.",
      artifactRefs: [HARDENING_EVIDENCE_PATH],
      verificationEvidencePaths: [HARDENING_EVIDENCE_PATH],
      verifiedCriteria: hardeningVerifiedCriteria()
    });
    assert.equal(result.status, "needs-completion-evidence");
    assert.deepEqual(result.evidenceIntegrity.pathEvidence.emptyPaths, [HARDENING_EVIDENCE_PATH]);
    assert.equal(readJson(emptyRoot, ARTIFACT_PATHS.taskPacketsIndex).items.find((item) => item.id === "empty-evidence-task").status, "ready");
    });
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }

  const bookkeepingRoot = tempRoot();
  try {
    runFixtureMutation(bookkeepingRoot, "bookkeeping-root", () => {
    ensureTestWorkspace(bookkeepingRoot);
    seedHardeningTask(bookkeepingRoot, "bookkeeping-evidence-task");
    const result = recordDoveMissionPass(bookkeepingRoot, {
      packetId: "bookkeeping-evidence-task",
      runId: "bookkeeping-evidence-run",
      resultStatus: "completed",
      resultSummary: "Completion cites only task index bookkeeping.",
      artifactRefs: [ARTIFACT_PATHS.taskPacketsIndex],
      evidenceLinks: [ARTIFACT_PATHS.taskPacketsIndex],
      verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [ARTIFACT_PATHS.taskPacketsIndex] }]
    });
    assert.equal(result.status, "needs-completion-evidence");
    assert.deepEqual(result.evidenceIntegrity.pathEvidence.bookkeepingPaths, [ARTIFACT_PATHS.taskPacketsIndex]);
    assert.equal(result.evidenceIntegrity.hasSubstantiveEvidence, false);
    assert.equal(readJson(bookkeepingRoot, ARTIFACT_PATHS.taskPacketsIndex).items.find((item) => item.id === "bookkeeping-evidence-task").status, "ready");
    });
  } finally {
    fs.rmSync(bookkeepingRoot, { recursive: true, force: true });
  }
});

test("completion evidence roles and reference parsing fail closed", () => {
  const roleCases = [
    [ARTIFACT_PATHS.taskPacketsIndex, "bookkeeping"],
    [ARTIFACT_PATHS.runtimeResults, "bookkeeping"],
    [ARTIFACT_PATHS.metaOperatorFollowThrough, "bookkeeping"],
    [ARTIFACT_PATHS.programsIndex, "bookkeeping"],
    [ARTIFACT_PATHS.doveRootManifest, "bookkeeping"],
    [ARTIFACT_PATHS.workflowBoundaries, "bookkeeping"],
    [ARTIFACT_PATHS.reviewState, "bookkeeping"],
    [ARTIFACT_PATHS.figuresIndex, "bookkeeping"],
    [ARTIFACT_PATHS.plan, "conditional"],
    [ARTIFACT_PATHS.experimentResults, "conditional"],
    [".dove/drafts/results.md", "substantive"],
    [".dove/evidence/workflow-goal-verification.log", "validation"],
    [".dove/experiments/custom.json", "unsupported"],
    [".dove/reviews/custom.md", "unsupported"],
    [".dove/documents/arbitrary.md", "unsupported"],
    [".dove/figures/example.template.svg", "unsupported"],
    ["docs/USAGE.md", "external-project"]
  ];
  for (const [artifactPath, expectedRole] of roleCases) {
    assert.equal(artifactEvidenceRole(artifactPath), expectedRole, artifactPath);
  }

  for (const reference of ["https://example.org/paper", "http://example.org/result", "doi:10.1000/example", "arxiv:2601.01234", "10.1000/example"]) {
    assert.equal(isExternalArtifactReference(reference), true, reference);
  }
  for (const reference of ["file:///etc/passwd", "data:text/plain,done", "javascript:alert(1)", "custom://result", "urn:isbn:1234", "doi:", "arxiv:"]) {
    assert.equal(isExternalArtifactReference(reference), false, reference);
    assert.equal(normalizeProjectRelativePath(reference).ok, false, reference);
  }

  const root = tempRoot();

  return runFixtureMutation(root, "completion-evidence-roles-and-reference-parsing-fail-closed", () => {
  try {
    ensureTestWorkspace(root);
    const unknownPath = ".dove/experiments/custom.json";
    writeHardeningEvidenceFile(root, unknownPath, JSON.stringify({ status: "completed" }));
    const unknown = completionEvidenceIntegrity(root, {
      evidencePaths: [unknownPath],
      verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [unknownPath] }]
    });
    assert.equal(unknown.satisfied, false);
    assert.deepEqual(unknown.pathEvidence.unsupportedPaths, [unknownPath]);

    for (const reference of ["file:///etc/passwd", "custom://result"]) {
      const flags = evidencePathProblemFlags(root, [reference]);
      assert.equal(flags.satisfied, false);
      assert.ok(flags.flags.includes("unsafe-evidence-path"), reference);
    }
  } finally {
  }

  });
});

test("completion evidence relevance and dynamic path approval are exact and fail closed", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "completion-evidence-relevance-and-dynamic-path-approval-are-exact-and-fa", () => {
  try {
    ensureTestWorkspace(root);
    const cases = [
      {
        label: "unlinked repository file",
        evidencePath: "docs/unlinked-completion.md",
        context: { task: { id: "unlinked-repository" } },
        expectedSatisfied: false,
        expectedLinkage: null
      },
      {
        label: "task-linked repository file",
        evidencePath: "docs/task-linked-completion.md",
        context: { task: { id: "task-linked-repository", outputPaths: ["docs/task-linked-completion.md"] } },
        expectedSatisfied: true,
        expectedLinkage: "task"
      },
      {
        label: "contract-linked repository file",
        evidencePath: "docs/contract-linked-completion.md",
        context: { executionContract: { files: [{ path: "docs/contract-linked-completion.md" }] } },
        expectedSatisfied: true,
        expectedLinkage: "execution-contract"
      },
      {
        label: "unknown dynamic evidence",
        evidencePath: ".dove/evidence/unlinked-dynamic.log",
        context: { task: { id: "unlinked-dynamic" } },
        expectedSatisfied: false,
        expectedLinkage: null
      },
      {
        label: "task-linked dynamic evidence",
        evidencePath: ".dove/evidence/task-linked-dynamic.log",
        context: { task: { id: "task-linked-dynamic", verificationEvidencePaths: [".dove/evidence/task-linked-dynamic.log"] } },
        expectedSatisfied: true,
        expectedLinkage: "task"
      },
      {
        label: "contract-linked dynamic evidence",
        evidencePath: ".dove/evidence/contract-linked-dynamic.log",
        context: { executionContract: { convergence: { evidenceRequired: [".dove/evidence/contract-linked-dynamic.log"] } } },
        expectedSatisfied: true,
        expectedLinkage: "execution-contract"
      },
      {
        label: "workflow-goal fixed evidence",
        evidencePath: ".dove/evidence/workflow-goal-verification.log",
        context: {},
        expectedSatisfied: true,
        expectedLinkage: "workflow-goal-fixed"
      }
    ];

    for (const evidenceCase of cases) {
      writeHardeningEvidenceFile(root, evidenceCase.evidencePath, `${evidenceCase.label}\n`);
      const integrity = completionEvidenceIntegrity(root, {
        evidencePaths: [evidenceCase.evidencePath],
        verifiedCriteria: [{
          criterion: `Verify ${evidenceCase.label}`,
          status: "verified",
          evidencePaths: [evidenceCase.evidencePath]
        }]
      }, { context: evidenceCase.context });
      assert.equal(integrity.satisfied, evidenceCase.expectedSatisfied, evidenceCase.label);
      assert.equal(integrity.pathEvidence.items[0].completionLinkage, evidenceCase.expectedLinkage, evidenceCase.label);
      if (!evidenceCase.expectedSatisfied) {
        assert.deepEqual(integrity.pathEvidence.unlinkedPaths, [evidenceCase.evidencePath], evidenceCase.label);
      }
    }
  } finally {
  }
  });
});

test("completion evidence uses one canonical file per narrative requirement", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "completion-evidence-uses-one-canonical-file-per-narrative-requirement", () => {
  try {
    ensureTestWorkspace(root);
    const sharedPath = writeHardeningEvidenceFile(root, ".dove/evidence/shared-validation.log", "Validation status: passed\n");
    const sharedIntegrity = completionEvidenceIntegrity(root, {
      evidencePaths: [sharedPath],
      verifiedCriteria: [{ criterion: "Validation completed", status: "verified", evidencePaths: [sharedPath] }]
    }, {
      context: {
        task: { outputPaths: [sharedPath] },
        requirements: [
          { id: "validation-a", requirement: "Provide validation evidence for criterion A.", purpose: "validation" },
          { id: "validation-b", requirement: "Provide validation evidence for criterion B.", purpose: "validation" }
        ]
      }
    });
    assert.equal(sharedIntegrity.satisfied, false);
    assert.equal(sharedIntegrity.coveredRequirements.length, 1);
    assert.deepEqual(sharedIntegrity.uncoveredRequirements.map((item) => item.id), ["validation-b"]);
    assert.equal(sharedIntegrity.uncoveredRequirements[0].covered, false);
    assert.equal(sharedIntegrity.uncoveredRequirements[0].evidencePath, null);

    writeJson(root, ARTIFACT_PATHS.experimentAudits, {
      version: 1,
      items: [{ id: "audit-complete", auditVerdict: "clean", integrityFlags: [] }],
      updatedAt: new Date(0).toISOString()
    });
    writeHardeningEvidenceFile(root, ARTIFACT_PATHS.reviewReport, "# Review report\n\nReview verdict: coherent\n");
    const matchedIntegrity = completionEvidenceIntegrity(root, {
      evidencePaths: [ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.reviewReport],
      verifiedCriteria: [{
        criterion: "Audit and review completed",
        status: "verified",
        evidencePaths: [ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.reviewReport]
      }]
    }, {
      context: {
        task: { outputPaths: [ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.reviewReport] },
        requirements: [
          { id: "audit", requirement: "Provide the completed experiment audit.", purpose: "audit" },
          { id: "review", requirement: "Provide the completed reviewer verdict.", purpose: "review" }
        ]
      }
    });
    assert.equal(matchedIntegrity.satisfied, true);
    assert.deepEqual(matchedIntegrity.uncoveredRequirements, []);
    assert.deepEqual(matchedIntegrity.coveredRequirements.map((item) => item.evidencePurpose), ["audit", "review"]);
  } finally {
  }
  });
});

test("positive completion criteria reject explicit negative validation outcomes", () => {
  const cases = [
    {
      label: "blocked audit",
      evidencePath: ARTIFACT_PATHS.experimentAudits,
      contents: { version: 1, items: [{ id: "blocked-audit", auditVerdict: "blocked" }] },
      expectedStatus: "blocked"
    },
    {
      label: "held bridge",
      evidencePath: ARTIFACT_PATHS.claimBridgeLog,
      contents: { version: 1, items: [{ id: "held-bridge", bridgeStatus: "held-for-review" }] },
      expectedStatus: "held-for-review"
    },
    {
      label: "failed QA",
      evidencePath: ARTIFACT_PATHS.figureQa,
      contents: { version: 1, items: [{ figureId: "failed-figure", qaStatus: "failed" }], issues: [] },
      expectedStatus: "failed"
    },
    {
      label: "unresolved review",
      evidencePath: ARTIFACT_PATHS.reviewConcerns,
      contents: { version: 2, items: [{ id: "open-review", status: "open" }] },
      expectedStatus: "open"
    },
    {
      label: "negative review",
      evidencePath: ARTIFACT_PATHS.reviewReport,
      contents: "# Review report\n\nReview verdict: needs-revision\n",
      expectedStatus: "needs-revision"
    },
    {
      label: "incomplete comparison",
      evidencePath: ARTIFACT_PATHS.versionComparisonReport,
      contents: "# Version comparison\n\nComparison status: incomplete\n",
      expectedStatus: "incomplete"
    }
  ];

  for (const validationCase of cases) {
    const root = tempRoot();
    try {
      runFixtureMutation(root, `positive-${validationCase.label}`, () => {
      ensureTestWorkspace(root);
      if (typeof validationCase.contents === "string") {
        writeHardeningEvidenceFile(root, validationCase.evidencePath, validationCase.contents);
      } else {
        writeJson(root, validationCase.evidencePath, validationCase.contents);
      }
      const integrity = completionEvidenceIntegrity(root, {
        evidencePaths: [validationCase.evidencePath],
        verifiedCriteria: [{
          criterion: `Confirm ${validationCase.label} is complete`,
          status: "verified",
          evidencePaths: [validationCase.evidencePath]
        }]
      }, { context: { task: { outputPaths: [validationCase.evidencePath] } } });
      assert.equal(integrity.satisfied, false, validationCase.label);
      assert.equal(integrity.criteria[0].negativeOutcome.contradictory, true, validationCase.label);
      assert.ok(
        integrity.criteria[0].negativeOutcome.signals.some((signal) => signal.status === validationCase.expectedStatus),
        validationCase.label
      );
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  const negativeCriterionRoot = tempRoot();
  try {
    runFixtureMutation(negativeCriterionRoot, "negative-criterion-root", () => {
    ensureTestWorkspace(negativeCriterionRoot);
    writeJson(negativeCriterionRoot, ARTIFACT_PATHS.experimentAudits, {
      version: 1,
      items: [{ id: "expected-block", auditVerdict: "blocked" }]
    });
    const expectedNegative = completionEvidenceIntegrity(negativeCriterionRoot, {
      evidencePaths: [ARTIFACT_PATHS.experimentAudits],
      verifiedCriteria: [{
        criterion: "Audit must remain blocked when required materials are missing",
        status: "verified",
        evidencePaths: [ARTIFACT_PATHS.experimentAudits]
      }]
    }, { context: { task: { outputPaths: [ARTIFACT_PATHS.experimentAudits] } } });
    assert.equal(expectedNegative.criteria[0].negativeOutcome.contradictory, false);
    assert.equal(expectedNegative.satisfied, true);
    });
  } finally {
    fs.rmSync(negativeCriterionRoot, { recursive: true, force: true });
  }
});

test("completion evidence validates SVG PNG JPEG and PDF structures without changing ordinary inspection", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "completion-evidence-validates-svg-png-jpeg-and-pdf-structures-without-ch", () => {
  try {
    ensureTestWorkspace(root);
    const validPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    const malformedPng = Buffer.from(validPng);
    malformedPng[malformedPng.length - 1] ^= 0xff;
    const validJpeg = validCompletionJpegBuffer();
    const mediaCases = [
      {
        format: "svg",
        valid: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1\" height=\"1\"><rect width=\"1\" height=\"1\"/></svg>"),
        malformed: Buffer.from("<svg><g></svg>")
      },
      { format: "png", valid: validPng, malformed: malformedPng },
      { format: "jpg", valid: validJpeg, malformed: validJpeg.subarray(0, validJpeg.length - 2) },
      { format: "pdf", valid: validCompletionPdfBuffer(), malformed: Buffer.from("%PDF-1.4\nxref\nstartxref\n999\n%%EOF\n", "latin1") }
    ];

    for (const mediaCase of mediaCases) {
      const validPath = `.dove/evidence/valid-completion.${mediaCase.format}`;
      const malformedPath = `.dove/evidence/malformed-completion.${mediaCase.format}`;
      writeHardeningEvidenceBuffer(root, validPath, mediaCase.valid);
      writeHardeningEvidenceBuffer(root, malformedPath, mediaCase.malformed);

      const validIntegrity = completionEvidenceIntegrity(root, {
        evidencePaths: [validPath],
        verifiedCriteria: [{ criterion: `Validate ${mediaCase.format}`, status: "verified", evidencePaths: [validPath] }]
      }, { context: { task: { outputPaths: [validPath] } } });
      assert.equal(validIntegrity.satisfied, true, `${mediaCase.format} valid control`);

      const malformedIntegrity = completionEvidenceIntegrity(root, {
        evidencePaths: [malformedPath],
        verifiedCriteria: [{ criterion: `Validate malformed ${mediaCase.format}`, status: "verified", evidencePaths: [malformedPath] }]
      }, { context: { task: { outputPaths: [malformedPath] } } });
      assert.equal(malformedIntegrity.satisfied, false, `${mediaCase.format} malformed`);
      assert.deepEqual(malformedIntegrity.pathEvidence.malformedPaths, [malformedPath], `${mediaCase.format} malformed`);
      assert.equal(
        inspectDeclaredPath(root, malformedPath, { requireNonEmpty: true }).status,
        "existing",
        `${mediaCase.format} ordinary inspection`
      );
    }
  } finally {
  }
  });
});

test("experiment plan and result completion evidence requires concrete workflow semantics", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "experiment-plan-and-result-completion-evidence-requires-concrete-workflo", () => {
  try {
    ensureTestWorkspace(root);
    const inspect = (artifactPath, contents) => {
      writeJson(root, artifactPath, contents);
      return completionEvidenceIntegrity(root, {
        evidencePaths: [artifactPath],
        verifiedCriteria: [{ criterion: "Experiment evidence is concrete", status: "verified", evidencePaths: [artifactPath] }]
      }, { context: { task: { outputPaths: [artifactPath] } } });
    };
    for (const [label, item] of [
      ["pending empty", { outcome: "pending", summary: "" }],
      ["pending summary", { outcome: "pending", summary: "Still running." }],
      ["concrete empty", { outcome: "supports", summary: " " }],
      ["unknown outcome", { outcome: "mystery", summary: "Looks concrete." }]
    ]) {
      const integrity = inspect(ARTIFACT_PATHS.experimentResults, { version: 1, items: [item] });
      assert.equal(integrity.satisfied, false, label);
      assert.deepEqual(integrity.pathEvidence.placeholderPaths, [ARTIFACT_PATHS.experimentResults], label);
    }
    for (const outcome of ["supports", "refutes", "inconclusive", "failed"]) {
      assert.equal(inspect(ARTIFACT_PATHS.experimentResults, {
        version: 1, items: [{ outcome, summary: `${outcome} is a concrete experiment result.` }]
      }).satisfied, true, outcome);
    }
    for (const item of [{}, { methodology: "Method", successMetric: "" }, { methodology: "", successMetric: "Metric" }]) {
      assert.equal(inspect(ARTIFACT_PATHS.experimentPlans, { version: 1, items: [item] }).satisfied, false);
    }
    assert.equal(inspect(ARTIFACT_PATHS.experimentPlans, {
      version: 1,
      items: [{ methodology: "Run the controlled comparison.", successMetric: "Measure the declared delta." }]
    }).satisfied, true);
  } finally {
  }
  });
});

test("mission completion rejects pending or empty experiment results and accepts concrete summarized outcomes", () => {
  for (const [outcome, summary, expectedComplete] of [
    ["pending", "", false],
    ["pending", "Still running.", false],
    ["supports", "", false],
    ["supports", "The experiment supports the criterion.", true],
    ["refutes", "The experiment refutes the criterion.", true],
    ["inconclusive", "The experiment was concretely inconclusive.", true],
    ["failed", "The experiment failed with a recorded result.", true]
  ]) {
    const root = tempRoot();
    return runFixtureMutation(root, "mission-completion-rejects-pending-or-empty-experiment-results-and-accep", () => {
    try {
      ensureTestWorkspace(root);
      const packetId = `mission-${outcome}-${summary ? "summary" : "empty"}`;
      seedHardeningTask(root, packetId, {
        outputPaths: [ARTIFACT_PATHS.experimentResults],
        executionContract: hardeningExecutionContract({ convergence: { evidenceRequired: [ARTIFACT_PATHS.experimentResults] } })
      });
      writeJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [{ outcome, summary }] });
      const result = recordDoveMissionPass(root, {
        packetId,
        resultStatus: "completed",
        resultSummary: "Experiment completion attempt.",
        artifactRefs: [ARTIFACT_PATHS.experimentResults],
        verificationEvidencePaths: [ARTIFACT_PATHS.experimentResults],
        verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [ARTIFACT_PATHS.experimentResults] }]
      });
      const durable = readJson(root, ARTIFACT_PATHS.taskPacketsIndex).items.find((item) => item.id === packetId);
      assert.equal(durable.status === "completed", expectedComplete, `${outcome} ${summary}`);
      assert.equal(result.status === "completed", expectedComplete, `${outcome} ${summary}`);
    } finally {
      // Mutation provenance is finalized after the callback returns.
    }
    });
  }
});

test("auto completion rejects pending experiment results and accepts concrete summarized results", () => {
  for (const [outcome, summary, expectedComplete] of [
    ["pending", "Still running.", false],
    ["supports", "", false],
    ["failed", "The run failed with a concrete recorded result.", true]
  ]) {
    const root = tempRoot();
    return runFixtureMutation(root, "auto-completion-rejects-pending-experiment-results-and-accepts-concrete-", () => {
    try {
      ensureTestWorkspace(root);
      const packetId = `auto-experiment-${outcome}-${summary ? "summary" : "empty"}`;
      seedHardeningTask(root, packetId, {
        outputPaths: [ARTIFACT_PATHS.experimentResults],
        executionContract: hardeningExecutionContract({ convergence: { evidenceRequired: [ARTIFACT_PATHS.experimentResults] } })
      });
      writeJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [{ outcome, summary }] });
      const sourceId = seedHardeningSource(root, packetId);
      const result = proposeAndRunHardeningAuto(root, {
        packetId,
        steps: [{
          command: "dove.note",
          completeTask: true,
          outputArtifacts: [ARTIFACT_PATHS.experimentResults],
          verificationEvidencePaths: [ARTIFACT_PATHS.experimentResults],
          verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [ARTIFACT_PATHS.experimentResults] }],
          args: { noteId: `${packetId}-note`, title: packetId, sectionId: "results", sourceIds: [sourceId], summary: "Record experiment outcome." }
        }]
      }, { runId: `${packetId}-run` });
      const durable = readJson(root, ARTIFACT_PATHS.taskPacketsIndex).items.find((item) => item.id === packetId);
      assert.equal(durable.status === "completed", expectedComplete, outcome);
      assert.equal(result.status === "completed", expectedComplete, outcome);
    } finally {
      // Mutation provenance is finalized after the callback returns.
    }
    });
  }
});

test("completion evidence rejects bootstrap placeholders and semantically empty indexes", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "completion-evidence-rejects-bootstrap-placeholders-and-semantically-empt", () => {
  try {
    ensureTestWorkspace(root);
    for (const artifactPath of [
      ARTIFACT_PATHS.researchBrief,
      ARTIFACT_PATHS.plan,
      ARTIFACT_PATHS.outline,
      ARTIFACT_PATHS.findings,
      ARTIFACT_PATHS.experimentLog,
      ARTIFACT_PATHS.claims,
      ARTIFACT_PATHS.reviewLog,
      ARTIFACT_PATHS.revisionPlan,
      ARTIFACT_PATHS.rebuttalStrategy,
      ARTIFACT_PATHS.rebuttalResponseDraft,
      ARTIFACT_PATHS.versionComparisonReport,
      ARTIFACT_PATHS.sources,
      ARTIFACT_PATHS.notes,
      ARTIFACT_PATHS.evidence,
      ARTIFACT_PATHS.experimentPlans,
      ARTIFACT_PATHS.experimentResults,
      ARTIFACT_PATHS.experimentAudits,
      ARTIFACT_PATHS.figureBriefs,
      ARTIFACT_PATHS.figureQa,
      ARTIFACT_PATHS.rebuttalIssues,
      ARTIFACT_PATHS.versionComparisons
    ]) {
      const integrity = completionEvidenceIntegrity(root, {
        evidencePaths: [artifactPath],
        verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [artifactPath] }]
      });
      assert.equal(integrity.satisfied, false, artifactPath);
      if ([ARTIFACT_PATHS.sources, ARTIFACT_PATHS.sourceVerifications].includes(artifactPath)) {
        assert.deepEqual(integrity.pathEvidence.bookkeepingPaths, [artifactPath], artifactPath);
      } else {
        assert.deepEqual(integrity.pathEvidence.placeholderPaths, [artifactPath], artifactPath);
      }
    }

    const draftsReadme = completionEvidenceIntegrity(root, {
      evidencePaths: [path.posix.join(ARTIFACT_PATHS.draftsDir, "README.md")],
      verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [path.posix.join(ARTIFACT_PATHS.draftsDir, "README.md")] }]
    });
    assert.equal(draftsReadme.satisfied, false);
    assert.ok(
      [...draftsReadme.pathEvidence.missingPaths, ...draftsReadme.pathEvidence.unsupportedPaths]
        .includes(path.posix.join(ARTIFACT_PATHS.draftsDir, "README.md"))
    );
  } finally {
  }
  });
});

test("completion evidence integrity rejects symlink escapes, orchestration bookkeeping, and missing contract-required paths", () => {
  const symlinkRoot = tempRoot();
  try {
    runFixtureMutation(symlinkRoot, "symlink-root", () => {
    ensureTestWorkspace(symlinkRoot);
    const outsidePath = path.join(path.dirname(symlinkRoot), `${path.basename(symlinkRoot)}-outside.md`);
    fs.writeFileSync(outsidePath, "Outside project evidence must not count.\n", "utf8");
    const symlinkPath = path.join(symlinkRoot, ".dove", "evidence", "outside-link.md");
    fs.mkdirSync(path.dirname(symlinkPath), { recursive: true });
    fs.symlinkSync(outsidePath, symlinkPath);
    const integrity = completionEvidenceIntegrity(symlinkRoot, {
      evidencePaths: [".dove/evidence/outside-link.md"],
      verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [".dove/evidence/outside-link.md"] }]
    });
    assert.equal(integrity.satisfied, false);
    assert.ok(integrity.pathEvidence.unsafePaths.includes(".dove/evidence/outside-link.md"));
    fs.rmSync(outsidePath, { force: true });
    });
  } finally {
    fs.rmSync(symlinkRoot, { recursive: true, force: true });
  }

  const boardRoot = tempRoot();
  try {
    runFixtureMutation(boardRoot, "board-root", () => {
    ensureTestWorkspace(boardRoot);
    seedHardeningTask(boardRoot, "board-bookkeeping-task", {
      executionContract: hardeningExecutionContract({ convergence: { evidenceRequired: [ARTIFACT_PATHS.orchestrationBoard] } })
    });
    const result = recordDoveMissionPass(boardRoot, {
      packetId: "board-bookkeeping-task",
      resultStatus: "completed",
      resultSummary: "Completion cites only the orchestration board.",
      artifactRefs: [ARTIFACT_PATHS.orchestrationBoard],
      verificationEvidencePaths: [ARTIFACT_PATHS.orchestrationBoard],
      verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [ARTIFACT_PATHS.orchestrationBoard] }]
    });
    assert.equal(result.status, "needs-completion-evidence");
    assert.ok(result.evidenceIntegrity.pathEvidence.bookkeepingPaths.includes(ARTIFACT_PATHS.orchestrationBoard));
    });
  } finally {
    fs.rmSync(boardRoot, { recursive: true, force: true });
  }

  const requiredRoot = tempRoot();
  try {
    runFixtureMutation(requiredRoot, "required-root", () => {
    ensureTestWorkspace(requiredRoot);
    seedHardeningTask(requiredRoot, "required-evidence-task");
    writeHardeningEvidenceFile(requiredRoot, ".dove/evidence/unrelated.log", "Unrelated evidence.\n");
    const result = recordDoveMissionPass(requiredRoot, {
      packetId: "required-evidence-task",
      resultStatus: "completed",
      resultSummary: "Completion cites a real but contract-unrelated file.",
      artifactRefs: [".dove/evidence/unrelated.log"],
      verificationEvidencePaths: [".dove/evidence/unrelated.log"],
      verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [".dove/evidence/unrelated.log"] }]
    });
    assert.equal(result.status, "verification-failed");
    assert.ok(result.missingRequiredEvidencePaths.includes(HARDENING_EVIDENCE_PATH));
    assert.equal(readJson(requiredRoot, ARTIFACT_PATHS.taskPacketsIndex).items.find((item) => item.id === "required-evidence-task").status, "ready");
    });
  } finally {
    fs.rmSync(requiredRoot, { recursive: true, force: true });
  }
});

test("completion evidence integrity resolves internal symlinks and rejects broken or bookkeeping aliases", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "completion-evidence-integrity-resolves-internal-symlinks-and-rejects-bro", () => {
  try {
    ensureTestWorkspace(root);
    const substantivePath = writeHardeningEvidenceFile(root, ".dove/evidence/substantive.md", "Substantive implementation evidence.\n");
    const internalLink = ".dove/evidence/substantive-link.md";
    fs.symlinkSync("substantive.md", path.join(root, internalLink));
    const accepted = completionEvidenceIntegrity(root, {
      evidencePaths: [internalLink],
      verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [internalLink] }]
    }, { context: { task: { outputPaths: [internalLink] } } });
    assert.equal(accepted.satisfied, true);
    assert.equal(accepted.pathEvidence.items[0].canonicalRelativePath, substantivePath);

    const brokenLink = ".dove/evidence/broken-link.md";
    fs.symlinkSync("missing-target.md", path.join(root, brokenLink));
    const broken = completionEvidenceIntegrity(root, {
      evidencePaths: [brokenLink],
      verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [brokenLink] }]
    });
    assert.equal(broken.satisfied, false);
    assert.deepEqual(broken.pathEvidence.missingPaths, [brokenLink]);

    const boardAlias = ".dove/evidence/board-alias.json";
    fs.symlinkSync("../orchestration/board.json", path.join(root, boardAlias));
    const bookkeeping = completionEvidenceIntegrity(root, {
      evidencePaths: [boardAlias],
      verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [boardAlias] }]
    });
    assert.equal(bookkeeping.satisfied, false);
    assert.deepEqual(bookkeeping.pathEvidence.bookkeepingPaths, [boardAlias]);
    assert.equal(bookkeeping.pathEvidence.items[0].canonicalRelativePath, ARTIFACT_PATHS.orchestrationBoard);
  } finally {
  }
  });
});

test("persistent contracts cannot be weakened and plan output still requires declared evidence paths", () => {
  const downgradeRoot = tempRoot();
  try {
    runFixtureMutation(downgradeRoot, "downgrade-root", () => {
    ensureTestWorkspace(downgradeRoot);
    seedHardeningTask(downgradeRoot, "contract-downgrade-task");
    const unrelatedPath = writeHardeningEvidenceFile(downgradeRoot, ".dove/evidence/unrelated-downgrade.log", "Unrelated verification output.\n");
    const result = recordDoveMissionPass(downgradeRoot, {
      packetId: "contract-downgrade-task",
      resultStatus: "completed",
      resultSummary: "A payload contract attempts to replace the durable requirement.",
      executionContract: hardeningExecutionContract({ convergence: { evidenceRequired: [unrelatedPath] } }),
      artifactRefs: [unrelatedPath],
      verificationEvidencePaths: [unrelatedPath],
      verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [unrelatedPath] }]
    });
    assert.equal(result.status, "verification-failed");
    assert.deepEqual(result.missingRequiredEvidencePaths, [HARDENING_EVIDENCE_PATH]);
    });
  } finally {
    fs.rmSync(downgradeRoot, { recursive: true, force: true });
  }

  const planRoot = tempRoot();
  try {
    runFixtureMutation(planRoot, "plan-root", () => {
    ensureTestWorkspace(planRoot);
    seedHardeningTask(planRoot, "plan-required-evidence-task", {
      stage: "plan",
      executionContract: hardeningExecutionContract({
        chainType: "plan-to-executable-missions",
        roleSequence: ["planner", "builder", "reviewer"]
      })
    });
    const unrelatedPath = writeHardeningEvidenceFile(planRoot, ".dove/evidence/plan-unrelated.log", "Plan conversion output.\n");
    const result = recordDoveMissionPass(planRoot, {
      packetId: "plan-required-evidence-task",
      resultStatus: "completed",
      resultSummary: "The plan returned an executable mission but omitted its required verification path.",
      verificationEvidencePaths: [unrelatedPath],
      verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [unrelatedPath] }],
      plannedMissions: [{
        id: "derived-plan-mission",
        title: "Execute derived hardening work",
        executionContract: hardeningExecutionContract()
      }]
    });
    assert.equal(result.status, "verification-failed");
    assert.deepEqual(result.missingRequiredEvidencePaths, [HARDENING_EVIDENCE_PATH]);
    assert.equal(result.evidenceIntegrity.satisfied, true);
    assert.deepEqual(result.evidenceIntegrity.pathEvidence.unlinkedPaths, []);
    });
  } finally {
    fs.rmSync(planRoot, { recursive: true, force: true });
  }
});

test("completion evidence integrity requires criteria-specific evidence and accepts real files", () => {
  const criteriaRoot = tempRoot();
  try {
    runFixtureMutation(criteriaRoot, "criteria-root-setup", () => {
      ensureTestWorkspace(criteriaRoot);
      seedHardeningTask(criteriaRoot, "criteria-missing-evidence-task");
    });
    writeHardeningEvidenceFile(criteriaRoot);
    const result = runFixtureMutation(criteriaRoot, "criteria-root-record", () => recordDoveMissionPass(criteriaRoot, {
      packetId: "criteria-missing-evidence-task",
      runId: "criteria-missing-evidence-run",
      resultStatus: "completed",
      resultSummary: "Completion has global evidence but verified criteria lacks evidence paths.",
      artifactRefs: [HARDENING_EVIDENCE_PATH],
      verificationEvidencePaths: [HARDENING_EVIDENCE_PATH],
      verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [] }]
    }));
    assert.equal(result.status, "needs-completion-evidence");
    assert.equal(result.boundaryType, "missing-required-materials");
    assert.equal(result.evidenceIntegrity.missingCriteriaEvidence[0].criterion, HARDENING_CRITERION);
    assert.equal(readJson(criteriaRoot, ARTIFACT_PATHS.taskPacketsIndex).items.find((item) => item.id === "criteria-missing-evidence-task").status, "ready");
  } finally {
    fs.rmSync(criteriaRoot, { recursive: true, force: true });
  }

  const validRoot = tempRoot();
  try {
    const artifactPath = writeHardeningEvidenceFile(validRoot, ".dove/evidence/real-completion-artifact.md", "# Real completion artifact\n\nSubstantive evidence.\n");
    runFixtureMutation(validRoot, "valid-root-setup", () => {
      ensureTestWorkspace(validRoot);
      seedHardeningTask(validRoot, "real-evidence-task", { outputPaths: [artifactPath] });
    });
    writeHardeningEvidenceFile(validRoot);
    const result = runFixtureMutation(validRoot, "valid-root-record", () => recordDoveMissionPass(validRoot, {
      packetId: "real-evidence-task",
      runId: "real-evidence-run",
      resultStatus: "completed",
      resultSummary: "Completion cites real artifact and verification files.",
      artifactRefs: [artifactPath],
      evidenceLinks: [artifactPath],
      verificationEvidencePaths: [HARDENING_EVIDENCE_PATH],
      verifiedCriteria: hardeningVerifiedCriteria()
    }));
    assert.equal(result.status, "completed");
    assert.equal(result.executionReceipt.criteriaCoverage.complete, true);
    assert.equal(readJson(validRoot, ARTIFACT_PATHS.taskPacketsIndex).items.find((item) => item.id === "real-evidence-task").status, "completed");
  } finally {
    fs.rmSync(validRoot, { recursive: true, force: true });
  }
});

test("completion evidence integrity rejects fake status and auto completion paths", () => {
  const statusRoot = tempRoot();
  try {
    runFixtureMutation(statusRoot, "status-root-setup", () => {
      ensureTestWorkspace(statusRoot);
      seedHardeningTask(statusRoot, "status-fake-path-task");
    });
    const result = runFixtureMutation(statusRoot, "status-root-adjust", () => applyDoveStatusAdjustments(statusRoot, {
      confirmed: true,
      adjustments: [{
        packetId: "status-fake-path-task",
        status: "completed",
        reason: "Status adjustment cites a fake artifact path.",
        artifactRefs: [".dove/evidence/status-fake-path.md"],
        verificationEvidencePaths: [".dove/evidence/status-fake-path.log"],
        verifiedCriteria: [{ criterion: HARDENING_CRITERION, status: "verified", evidencePaths: [".dove/evidence/status-fake-path.log"] }]
      }]
    }));
    assert.equal(result.status, "rejected");
    assert.equal(result.rejected[0].completionBlock.status, "needs-completion-evidence");
    assert.equal(readJson(statusRoot, ARTIFACT_PATHS.taskPacketsIndex).items.find((item) => item.id === "status-fake-path-task").status, "ready");
  } finally {
    fs.rmSync(statusRoot, { recursive: true, force: true });
  }

  const autoRoot = tempRoot();
  try {
    const hardeningSourceId = runFixtureMutation(autoRoot, "auto-root-setup", () => {
      ensureTestWorkspace(autoRoot);
      seedHardeningTask(autoRoot, "auto-fake-output-task");
      return seedHardeningSource(autoRoot, "auto-fake-output-task");
    });
    writeHardeningEvidenceFile(autoRoot);
    const result = proposeAndRunHardeningAuto(autoRoot, {
      packetId: "auto-fake-output-task",
      steps: [{
        command: "dove.note",
        completeTask: true,
        outputArtifacts: [".dove/evidence/auto-fake-output.md"],
        verificationEvidencePaths: [HARDENING_EVIDENCE_PATH],
        verifiedCriteria: hardeningVerifiedCriteria(),
        args: {
          noteId: "auto-fake-output-note",
          title: "Auto fake output note",
          sectionId: "hardening",
          sourceIds: [hardeningSourceId],
          summary: "Auto output references a fake artifact path."
        }
      }]
    }, {
      runId: "auto-fake-output-run"
    });
    assert.equal(result.status, "blocked-boundary");
    assert.equal(result.task.status, "blocked");
    assert.equal(result.boundary.type, "workflow-error-boundary");
    assert.equal(readJson(autoRoot, ARTIFACT_PATHS.taskPacketsIndex).items.find((item) => item.id === "auto-fake-output-task").status, "blocked");
  } finally {
    fs.rmSync(autoRoot, { recursive: true, force: true });
  }
});

test("task packet resolver handles explicit ids, targets, ambiguity, and artifact conflicts", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "task-packet-resolver-handles-explicit-ids-targets-ambiguity-and-artifact", () => {
  ensureTestWorkspace(root);
  seedTaskPacket(root, "packet-alpha", {
    title: "Alpha experiment",
    summary: "Validate alpha packet resolution.",
    claimIds: ["claim-alpha"],
    experimentIds: ["exp-alpha"],
    outputPaths: [".dove/drafts/alpha.md"]
  });
  seedTaskPacket(root, "packet-beta", {
    title: "Beta experiment",
    summary: "Validate beta packet resolution.",
    claimIds: ["claim-beta"],
    experimentIds: ["exp-beta"],
    outputPaths: [".dove/drafts/beta.md"]
  });

  assert.equal(resolveDurableTaskPacket(root, { packetId: "packet-alpha" }).packetId, "packet-alpha");
  assert.equal(resolveDurableTaskPacket(root, { taskId: "packet-alpha" }).packetId, "packet-alpha");
  assert.equal(resolveDurableTaskPacket(root, { target: "Beta experiment" }, { targetFields: ["target"] }).packetId, "packet-beta");
  assert.equal(resolveDurableTaskPacket(root, { packetTarget: "Beta experiment" }, { targetFields: ["packetTarget"] }).packetId, "packet-beta");

  assert.throws(() => {
    resolveDurableTaskPacket(root, { packetId: "packet-alpha", claimId: "claim-beta" }, { artifactFields: ["claimId"] });
  }, /conflict/);

  writeTaskTargetSettings(root, { autoSelect: false });
  assert.throws(() => {
    resolveDurableTaskPacket(root, { target: "experiment" }, { targetFields: ["target"] });
  }, /ambiguous/);

  writeTaskTargetSettings(root, { autoSelect: true });
  let tiedError = null;
  assert.throws(() => {
    try {
      resolveDurableTaskPacket(root, { target: "experiment" }, { targetFields: ["target"] });
    } catch (error) {
      tiedError = error;
      throw error;
    }
  }, /requires confirmation/);
  assert.equal(tiedError.code, "TASK_PACKET_RESOLUTION_REQUIRED");
  assert.ok(tiedError.candidates.length >= 2);
  assert.throws(() => {
    resolveDurableTaskPacket(root, {});
  }, /requires confirmation/);
  const selected = resolveDurableTaskPacket(root, { target: "Beta experiment" }, { targetFields: ["target"] });
  assert.equal(selected.packetId, "packet-beta");
  assert.equal(selected.resolution.autoSelect, true);
  assert.equal(selected.resolution.candidates.length, 1);
  });
});

test("task packet resolver allows explicit parent to cite descendant artifacts but rejects unrelated matches", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "task-packet-resolver-allows-explicit-parent-to-cite-descendant-artifacts", () => {
  ensureTestWorkspace(root);
  const parentArtifact = ".dove/runtime/lineage-parent-result.json";
  const childArtifact = ".dove/audio/reviews/lineage-child/report.md";
  const grandchildArtifact = ".dove/runtime/lineage-grandchild-result.json";
  const siblingArtifact = ".dove/runtime/lineage-sibling-result.json";
  const unrelatedArtifact = ".dove/runtime/unrelated-result.json";

  seedTaskPacket(root, "lineage-parent", {
    title: "Lineage parent",
    parentId: "init",
    rootId: "init",
    level: 3,
    artifactRefs: [parentArtifact]
  });
  seedTaskPacket(root, "lineage-child", {
    title: "Lineage child",
    parentId: "lineage-parent",
    rootId: "init",
    level: 4,
    artifactRefs: [childArtifact],
    evidenceLinks: [childArtifact]
  });
  seedTaskPacket(root, "lineage-grandchild", {
    title: "Lineage grandchild",
    parentId: "lineage-child",
    rootId: "init",
    level: 5,
    outputPaths: [grandchildArtifact]
  });
  seedTaskPacket(root, "lineage-sibling", {
    title: "Lineage sibling",
    parentId: "init",
    rootId: "init",
    level: 3,
    evidenceLinks: [siblingArtifact]
  });
  seedTaskPacket(root, "other-root-task", {
    title: "Other root task",
    parentId: "other-init",
    rootId: "other-init",
    level: 3,
    outputPaths: [unrelatedArtifact]
  });

  const childEvidence = resolveDurableTaskPacket(root, { packetId: "lineage-parent", evidenceLinks: [childArtifact] }, { artifactFields: ["evidenceLinks"] });
  assert.equal(childEvidence.packetId, "lineage-parent");
  assert.equal(childEvidence.artifactResolution.explanationCode, "accepted-descendant-artifacts");
  assert.equal(childEvidence.artifactResolution.acceptedMatches[0].packetId, "lineage-child");
  assert.equal(childEvidence.artifactResolution.acceptedMatches[0].relation, "descendant");
  const grandchildOutput = resolveDurableTaskPacket(root, { packetId: "lineage-parent", outputPaths: [grandchildArtifact] }, { artifactFields: ["outputPaths"] });
  assert.equal(grandchildOutput.packetId, "lineage-parent");
  assert.equal(grandchildOutput.artifactResolution.acceptedMatches[0].relation, "descendant");

  let siblingError = null;
  assert.throws(() => {
    try {
      resolveDurableTaskPacket(root, { packetId: "lineage-parent", evidenceLinks: [siblingArtifact] }, { artifactFields: ["evidenceLinks"] });
    } catch (error) {
      siblingError = error;
      throw error;
    }
  }, /conflict/);
  assert.equal(siblingError.artifactResolution.explanationCode, "artifact-conflict");
  assert.equal(siblingError.artifactResolution.selectedPacket.packetId, "lineage-parent");
  assert.equal(siblingError.artifactResolution.conflictingMatches[0].relation, "sibling");
  assert.deepEqual(siblingError.artifactResolution.conflictingMatches[0].matchedArtifacts, [siblingArtifact]);
  assert.equal(siblingError.candidates[0].relation, "sibling");
  assert.deepEqual(siblingError.candidates[0].matchedArtifacts, [siblingArtifact]);
  assert.ok(siblingError.suggestedActions.includes(`write-to-owner-packet lineage-sibling for ${siblingArtifact}`));
  assert.ok(siblingError.suggestedActions.includes("choose-or-create-descendant-of lineage-parent before attaching new artifacts"));
  assert.match(siblingError.message, /Suggested actions:/);
  let unrelatedError = null;
  assert.throws(() => {
    try {
      resolveDurableTaskPacket(root, { packetId: "lineage-parent", outputPaths: [unrelatedArtifact] }, { artifactFields: ["outputPaths"] });
    } catch (error) {
      unrelatedError = error;
      throw error;
    }
  }, /conflict/);
  assert.equal(unrelatedError.artifactResolution.selectedPacket.packetId, "lineage-parent");
  assert.equal(unrelatedError.artifactResolution.conflictingMatches[0].relation, "other-root");
  assert.deepEqual(unrelatedError.artifactResolution.conflictingMatches[0].matchedArtifacts, [unrelatedArtifact]);
  assert.equal(unrelatedError.candidates[0].relation, "other-root");
  assert.deepEqual(unrelatedError.candidates[0].matchedArtifacts, [unrelatedArtifact]);
  assert.ok(unrelatedError.suggestedActions.includes(`write-to-owner-packet other-root-task for ${unrelatedArtifact}`));
  let ancestorError = null;
  assert.throws(() => {
    try {
      resolveDurableTaskPacket(root, { packetId: "lineage-child", artifactRefs: [parentArtifact] }, { artifactFields: ["artifactRefs"] });
    } catch (error) {
      ancestorError = error;
      throw error;
    }
  }, /conflict/);
  assert.equal(ancestorError.artifactResolution.selectedPacket.packetId, "lineage-child");
  assert.equal(ancestorError.artifactResolution.conflictingMatches[0].relation, "ancestor");
  assert.deepEqual(ancestorError.artifactResolution.conflictingMatches[0].matchedArtifacts, [parentArtifact]);
  assert.equal(ancestorError.candidates[0].relation, "ancestor");
  assert.deepEqual(ancestorError.candidates[0].matchedArtifacts, [parentArtifact]);
  assert.ok(ancestorError.suggestedActions.includes(`write-to-owner-packet lineage-parent for ${parentArtifact}`));
  });
});

test("task-scoped resolver rejects writes when no durable packet exists", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "task-scoped-resolver-rejects-writes-when-no-durable-packet-exists", () => {
  ensureTestWorkspace(root);

  assert.throws(() => {
    resolveDurableTaskPacket(root, {});
  }, /requires a durable task packet/);
  });
});

test("governance registry marks task-scoped writes and packet execution with packet target metadata", () => {
  const taskScoped = GOVERNANCE_GUARDED_MUTATIONS.filter((entry) => entry.mutationScope === "task-scoped-write");
  assert.equal(taskScoped.length > 0, true);
  for (const entry of taskScoped) {
    assert.equal(entry.requiresPacketTarget, true, `${entry.id} should require a packet target`);
    assert.equal(entry.targetFields.includes("packetId"), true, `${entry.id} should accept explicit packetId`);
    assert.equal(entry.targetFields.includes("target"), true, `${entry.id} should accept natural task target`);
    assert.equal(entry.targetFields.includes("scope"), false, `${entry.id} should not treat review scope as task target`);
    assert.equal(Boolean(entry.surfaceBindings?.coreFunction), true, `${entry.id} should bind a core function`);
  }

  const packetExecution = GOVERNANCE_EXEMPT_MUTATIONS.filter((entry) => entry.mutationScope === "packet-execution");
  assert.deepEqual(packetExecution, []);

  for (const entry of [...GOVERNANCE_GUARDED_MUTATIONS, ...GOVERNANCE_EXEMPT_MUTATIONS].filter((item) => ["derived-refresh", "inspection-only", "bootstrap", "workspace-global", "task-materialization", "governance-bookkeeping"].includes(item.mutationScope))) {
    assert.equal(entry.requiresPacketTarget, false, `${entry.id} should not require a packet target`);
  }
});

function seedAutonomyGuidance(root) {
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "autonomy-gap",
      summary: "Need a governed autonomous control-plane slice.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the autonomous control-plane gap."],
    unresolvedConcernIds: ["autonomy-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });
  const meta = queryMetaOptimize(root);
  return {
    remediationPack: meta.remediationPacks.packs[0],
    executionBridgeCandidate: meta.executionBridgeCandidates.candidates.find((item) => item.candidateType === "packet-candidate")
  };
}

function seedRoleScopedAutonomyGuidance(root, responseOwnerRole = "researcher") {
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: `autonomy-gap-${responseOwnerRole}`,
      summary: `Need a governed ${responseOwnerRole}-owned autonomous control-plane slice.`,
      severity: "high",
      status: "open",
      responseOwnerRole,
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: [`Close the ${responseOwnerRole}-owned autonomous control-plane gap.`],
    unresolvedConcernIds: [`autonomy-gap-${responseOwnerRole}`],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: [responseOwnerRole], separationMaintained: true }
  });
  return queryMetaOptimize(root).remediationPacks.packs[0];
}

test("planCampaign records an explicit non-executing multi-cycle campaign", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "plancampaign-records-an-explicit-non-executing-multi-cycle-campaign", () => {
  ensureTestWorkspace(root);

  const planned = planCampaign(root, {
    campaignId: "campaign-plan-alpha",
    title: "Evidence-to-review campaign",
    objective: "Collect evidence, refresh wiki, then review before approval.",
    actorRole: "planner",
    status: "active",
    programIds: ["program-alpha"],
    steps: [
      { id: "step-1", status: "planned", programId: "program-alpha", allowedStepType: "refresh-research-brief", nextAction: "Refresh the research brief." },
      { id: "step-2", status: "planned", programId: "program-alpha", allowedStepType: "run-review-loop", nextAction: "Run review only after explicit approval." }
    ],
    nextAction: "Issue explicit program approval for step-1."
  });

  assert.equal(planned.status, "planned");
  assert.equal(planned.campaignId, "campaign-plan-alpha");
  assert.equal(planned.stepCount, 2);
  assert.equal(planned.explicitApprovalRequired, true);
  assert.equal(planned.noHiddenRuntime, true);

  const campaigns = queryCampaigns(root, { campaignId: "campaign-plan-alpha" });
  assert.equal(campaigns.status, "ok");
  assert.equal(campaigns.items.length, 1);
  assert.equal(campaigns.items[0].status, "active");
  assert.equal(campaigns.items[0].steps[0].allowedStepType, "refresh-research-brief");
  assert.equal(campaigns.items[0].steps[1].allowedStepType, "run-review-loop");
  assert.equal(campaigns.items[0].explicitApprovalRequired, true);
  assert.equal(campaigns.items[0].noHiddenRuntime, true);

  const runtime = readJson(root, ARTIFACT_PATHS.runtimeControllerState, {});
  assert.equal(runtime.summary.lastStatus, "never-run");
  assert.equal(runtime.summary.requestCount, 0);
  });
});

test("queryWorkspaceIndex projects campaign summary from durable campaign state", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "queryworkspaceindex-projects-campaign-summary-from-durable-campaign-stat", () => {
  ensureTestWorkspace(root);

  writeJson(root, ARTIFACT_PATHS.campaignsIndex, {
    version: 1,
    items: [{
      id: "campaign-alpha",
      status: "active",
      programIds: ["program-alpha"],
      steps: [
        { id: "step-1", status: "completed", programId: "program-alpha", nextAction: "Already closed." },
        { id: "step-2", status: "review-needed", programId: "program-alpha", nextAction: "Review evidence before issuing fresh approval." }
      ],
      nextAction: "Continue after review."
    }],
    summary: {
      campaignCount: 1,
      plannedCount: 0,
      activeCount: 1,
      reviewNeededCount: 1,
      completedCount: 0,
      blockedCount: 0,
      topCampaignIds: ["campaign-alpha"],
      overview: "1 multi-cycle campaign is active.",
      campaignsPath: ARTIFACT_PATHS.campaignsIndex
    },
    updatedAt: "2026-04-24T00:00:00.000Z"
  });
  writeJson(root, ARTIFACT_PATHS.programsIndex, {
    version: 1,
    items: [{ id: "program-alpha", status: "active" }],
    summary: { programCount: 1, activeCount: 1, blockedCount: 0, topProgramIds: ["program-alpha"], overview: "1 program", programsPath: ARTIFACT_PATHS.programsIndex },
    updatedAt: "2026-04-24T00:00:00.000Z"
  });
  writeJson(root, ARTIFACT_PATHS.programRuns, {
    version: 1,
    items: [{ id: "run-alpha", programId: "program-alpha", status: "review-needed", reviewCheckpointRequired: true }],
    summary: { runCount: 1, approvedCount: 0, activeCount: 0, reviewNeededCount: 1, blockedCount: 0, reviewCheckpointRunCount: 1, topRunIds: ["run-alpha"], overview: "1 run", runsPath: ARTIFACT_PATHS.programRuns },
    updatedAt: "2026-04-24T00:00:00.000Z"
  });

  const workspaceIndex = queryWorkspaceIndex(root);
  assert.equal(workspaceIndex.campaigns.campaignCount, 1);
  assert.equal(workspaceIndex.campaigns.activeCount, 1);
  assert.equal(workspaceIndex.campaigns.reviewNeededCount, 1);
  assert.equal(workspaceIndex.campaigns.currentCampaignId, "campaign-alpha");
  assert.equal(workspaceIndex.campaigns.currentCampaignStatus, "active");
  assert.equal(workspaceIndex.campaigns.currentCampaignStepCount, 2);
  assert.equal(workspaceIndex.campaigns.currentCampaignCompletedStepCount, 1);
  assert.equal(workspaceIndex.campaigns.currentCampaignReviewNeededStepCount, 1);
  assert.equal(workspaceIndex.campaigns.currentCampaignNextStepId, "step-2");
  assert.equal(workspaceIndex.campaigns.currentCampaignNextAction, "Review evidence before issuing fresh approval.");
  assert.equal(workspaceIndex.campaigns.linkedProgramCount, 1);
  assert.equal(workspaceIndex.campaigns.linkedRunCount, 1);
  });
});

test("queryWorkspaceIndex treats explicit Dove engineering packets as engineering missions", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "queryworkspaceindex-treats-explicit-dove-engineering-packets-as-engineer", () => {
  ensureTestWorkspace(root);

  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    version: 3,
    items: [{
      id: "implement-api-cache",
      title: "Implement API cache",
      summary: "Engineering mission packet for a normal implementation task.",
      sourceType: "engineering-mission",
      doveDomain: "engineering",
      phase: "draft",
      status: "pending",
      lifecycleStatus: "active",
      active: true,
      assignedRole: "builder",
      nextAction: "Implement the cache and return tests plus review evidence.",
      outputPaths: ["src/cache.mjs"],
      evidenceLinks: ["tests/cache.test.mjs"]
    }],
    lifecycleCounts: {},
    dependencyHealth: {},
    updatedAt: null
  });

  const workspaceIndex = queryWorkspaceIndex(root);
  assert.equal(workspaceIndex.dove.currentDomain, "engineering");
  assert.equal(workspaceIndex.dove.domainCounts.engineering, 1);
  assert.equal(workspaceIndex.dove.domainGuidance.find((domain) => domain.id === "engineering").stageRoutes.execution, "project:dove.mission or project:dove.auto");
  assert.equal(workspaceIndex.activePackets[0].doveDomain, "engineering");
  assert.equal(workspaceIndex.activePackets[0].lifecycleFamily, "structure");
  });
});

test("ensureWorkspace reconciles managed artifact metadata and structure for boundaries and workspace index", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "ensureworkspace-reconciles-managed-artifact-metadata-and-structure-for-b", () => {
  ensureTestWorkspace(root);

  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.workflowBoundaries), JSON.stringify({
    version: 1,
    managedPaths: "bad-shape",
    userOwnedPaths: [".dove/drafts"],
    managedArtifacts: {
      workflowBoundaries: { revisionId: "legacy" }
    },
    notes: ["legacy note"]
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.workspaceIndex), JSON.stringify({
    version: 1,
    currentFocus: "Legacy focus",
    workQueues: { ready: "bad-shape" },
    managed: { revisionId: "legacy-workspace" },
    metaOptimize: {
      proposalOnly: true,
      topClusterIds: "bad-shape",
      longHorizon: "bad-shape"
    }
  }, null, 2));
  writeJson(root, ARTIFACT_PATHS.metaRecommendations, {
    version: 1,
    items: [{ id: "legacy-rec" }],
    clusters: "bad-shape",
    ranking: { method: "legacy", tieBreakOrder: "bad-shape" },
    frontier: { recommendationCount: 1, topClusterIds: "bad-shape" },
    summary: { topClusters: "bad-shape", clusterMembership: { legacy: "bad-shape" } }
  });
  writeJson(root, ARTIFACT_PATHS.metaOptimizerState, {
    version: 1,
    sourceArtifacts: "bad-shape",
    frontier: { recommendationCount: 1, topClusters: "bad-shape", tieBreakOrder: "bad-shape" },
    clusters: "bad-shape",
    longHorizon: { topFamilyIds: "bad-shape" }
  });
  writeJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, {
    version: 1,
    historyWindowSize: "bad-shape",
    horizon: "bad-shape",
    summary: { topFamilyIds: "bad-shape" },
    history: "bad-shape",
    families: "bad-shape"
  });
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaRemediationPacks), JSON.stringify({
    version: 1,
    proposalOnly: true,
    packs: "bad-shape",
    summary: { topPackIds: "bad-shape", topClusterIds: "bad-shape" }
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorPlaybooks), JSON.stringify({
    version: 1,
    proposalOnly: true,
    playbooks: "bad-shape",
    summary: { topPlaybookIds: "bad-shape", topTaxonomyFamilyIds: "bad-shape" }
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorLessons), JSON.stringify({
    version: 1,
    explicitOnly: false,
    noAutoCapture: false,
    noAutoApply: false,
    lessons: "bad-shape",
    sourceArtifacts: [".trellis/tasks/example/task.json"]
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaExecutionBridgeCandidates), JSON.stringify({
    version: 1,
    proposalOnly: true,
    candidates: "bad-shape",
    summary: { topCandidateIds: "bad-shape" }
  }, null, 2));

  ensureTestWorkspace(root);

  const boundaries = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.workflowBoundaries), "utf8"));
  const workspaceIndex = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.workspaceIndex), "utf8"));
  const recommendations = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaRecommendations), "utf8"));
  const optimizerState = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerState), "utf8"));
  const longHorizonMemory = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaLongHorizonMemory), "utf8"));
  const remediationPacks = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaRemediationPacks), "utf8"));
  const operatorPlaybooks = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorPlaybooks), "utf8"));
  const operatorLessons = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorLessons), "utf8"));
  const executionBridgeCandidates = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaExecutionBridgeCandidates), "utf8"));

  assert.equal(boundaries.version, 3);
  assert.equal(boundaries.managedArtifacts.workflowBoundaries.revisionId, "schema-v6:bootstrap-only");
  assert.equal(boundaries.managedArtifacts.workspaceIndex.path, ".dove/workspace/index.json");
  assert.equal(boundaries.managedArtifacts.doveRootManifest.path, ".dove/manifest.json");
  const packageBundlePaths = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "dist/index.mjs", "bin/dove-package.mjs", "mcp/dove-state-server-package.mjs", "scripts/doctor-mcp-probe-package.mjs"];
  assert.deepEqual(boundaries.managedPaths, [".opencode/commands/dove*.md", ".opencode/skills/dove-*", ".opencode.json", ".codex/skills/dove-*", ".cursor/commands/dove-*.md", ".agents/skills/dove-*", "AGENTS.md", ...packageBundlePaths]);
  assert.deepEqual(boundaries.neutralCorePaths, packageBundlePaths);
  assert.deepEqual(boundaries.defaultHostAdapters, ["opencode"]);
  assert.deepEqual(boundaries.availableHostAdapters, ["opencode", "codex", "cursor", "agents", "claude"]);
  assert.equal(Object.hasOwn(boundaries.managedHostAdapterPaths, "claude"), false);
  assert.deepEqual(boundaries.managedHostAdapterPaths.codex, [".codex/skills/dove-*"]);
  assert.deepEqual(boundaries.managedHostAdapterPaths.cursor, [".cursor/commands/dove-*.md"]);
  assert.deepEqual(boundaries.managedHostAdapterPaths.agents, [".agents/skills/dove-*", "AGENTS.md"]);
  assert.deepEqual(boundaries.notes, ["legacy note"]);

  assert.equal(workspaceIndex.version, 9);
  assert.equal(workspaceIndex.managed.revisionId, "schema-v6:bootstrap-only");
  assert.equal(workspaceIndex.currentFocus, "Legacy focus");
  assert.deepEqual(workspaceIndex.workQueues.ready, []);
  assert.deepEqual(workspaceIndex.resumeGuidance.prioritizedPacketIds, []);
  assert.equal(workspaceIndex.behaviorDiscipline.explicitOnly, true);
  assert.equal(workspaceIndex.repairFrontier.count, 0);
  assert.deepEqual(workspaceIndex.repairFrontier.topDegradedGroupIds, []);
  assert.equal(workspaceIndex.metaOptimize.proposalOnly, true);
  assert.equal(workspaceIndex.metaOptimize.reportPath, ".dove/meta/LATEST_OPTIMIZER_REPORT.md");
  assert.equal(workspaceIndex.metaOptimize.rankingMethod, "durable-signal-frontier-v1");
  assert.deepEqual(workspaceIndex.metaOptimize.tieBreakOrder, ["score-desc", "priority-rank", "cluster-rank", "cluster-id", "category", "id"]);
  assert.equal(workspaceIndex.metaOptimize.longHorizonPath, ".dove/meta/long-horizon-memory.json");
  assert.deepEqual(workspaceIndex.metaOptimize.topTaxonomyFamilyIds, []);
  assert.deepEqual(workspaceIndex.metaOptimize.topTaxonomyGroupIds, []);
  assert.deepEqual(workspaceIndex.metaOptimize.pressureAreas, []);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.memoryPath, ".dove/meta/long-horizon-memory.json");
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.packCount, 0);
  assert.deepEqual(workspaceIndex.metaOptimize.remediationPacks.topPackIds, []);
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.readinessOverview, "No proposal-only remediation packs have been generated yet.");
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.packsPath, ARTIFACT_PATHS.metaRemediationPacks);
  assert.equal(workspaceIndex.metaOptimize.operatorPlaybooks.playbookCount, 0);
  assert.deepEqual(workspaceIndex.metaOptimize.operatorPlaybooks.topPlaybookIds, []);
  assert.equal(workspaceIndex.metaOptimize.operatorPlaybooks.readinessOverview, "No proposal-only family-level operator playbooks have been generated yet.");
  assert.equal(workspaceIndex.metaOptimize.operatorPlaybooks.playbooksPath, ARTIFACT_PATHS.metaOperatorPlaybooks);
  assert.equal(workspaceIndex.metaOptimize.operatorLessons.lessonCount, 0);
  assert.equal(workspaceIndex.metaOptimize.operatorLessons.activeLessonCount, 0);
  assert.equal(workspaceIndex.metaOptimize.operatorLessons.lessonsPath, ARTIFACT_PATHS.metaOperatorLessons);
  assert.deepEqual(workspaceIndex.metaOptimize.topClusterIds, []);
  assert.deepEqual(workspaceIndex.metaOptimize.longHorizon.topFamilyIds, []);
  assert.deepEqual(workspaceIndex.metaOptimize.longHorizon.topTaxonomyFamilyIds, []);
  assert.deepEqual(workspaceIndex.metaOptimize.longHorizon.topTaxonomyGroupIds, []);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.snapshotCount, 0);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.lastAction, "unchanged");
  assert.equal(workspaceIndex.runtime.explicitInvocationOnly, true);
  assert.equal(workspaceIndex.runtime.noDaemon, true);
  assert.equal(workspaceIndex.runtime.controllerStatePath, ARTIFACT_PATHS.runtimeControllerState);
  assert.equal(workspaceIndex.runtime.leasesPath, ARTIFACT_PATHS.runtimeLeases);
  assert.equal(workspaceIndex.runtime.eventsPath, ARTIFACT_PATHS.runtimeEvents);
  assert.equal(workspaceIndex.runtime.resultsPath, ARTIFACT_PATHS.runtimeResults);
  assert.equal(workspaceIndex.runtime.lastStatus, "never-run");
  assert.equal(workspaceIndex.runtime.lastOutcome, "not-started");
  assert.equal(workspaceIndex.runtime.activeLeaseCount, 0);
  assert.equal(workspaceIndex.runtime.eventCount, 0);
  assert.equal(workspaceIndex.runtime.resultCount, 0);

  assert.equal(recommendations.version, 3);
  assert.equal(recommendations.items[0].id, "legacy-rec");
  assert.deepEqual(recommendations.clusters, []);
  assert.deepEqual(recommendations.ranking.tieBreakOrder, ["score-desc", "priority-rank", "cluster-rank", "cluster-id", "category", "id"]);
  assert.deepEqual(recommendations.frontier.topClusterIds, []);
  assert.deepEqual(recommendations.frontier.topTaxonomyFamilyIds, []);
  assert.deepEqual(recommendations.frontier.topTaxonomyGroupIds, []);
  assert.deepEqual(recommendations.summary.topClusters, []);
  assert.deepEqual(recommendations.summary.clusterMembership, { legacy: [] });

  assert.equal(optimizerState.version, 5);
  assert.deepEqual(optimizerState.sourceArtifacts, createMetaOptimizerState().sourceArtifacts);
  assert.deepEqual(optimizerState.frontier.topClusters, []);
  assert.deepEqual(optimizerState.frontier.tieBreakOrder, ["score-desc", "priority-rank", "cluster-rank", "cluster-id", "category", "id"]);
  assert.deepEqual(optimizerState.frontier.topTaxonomyFamilyIds, []);
  assert.deepEqual(optimizerState.frontier.topTaxonomyGroupIds, []);
  assert.deepEqual(optimizerState.clusters, []);
  assert.deepEqual(optimizerState.longHorizon.topFamilyIds, []);
  assert.deepEqual(optimizerState.longHorizon.topTaxonomyFamilyIds, []);
  assert.deepEqual(optimizerState.longHorizon.topTaxonomyGroupIds, []);
  assert.equal(optimizerState.longHorizon.snapshotCount, 0);
  assert.equal(optimizerState.longHorizon.lastAction, "unchanged");
  assert.equal(optimizerState.remediationPacks.packCount, 0);
  assert.deepEqual(optimizerState.remediationPacks.topPackIds, []);
  assert.equal(optimizerState.remediationPacks.readinessOverview, "No proposal-only remediation packs have been generated yet.");
  assert.equal(optimizerState.remediationPacks.packsPath, ARTIFACT_PATHS.metaRemediationPacks);
  assert.equal(optimizerState.operatorPlaybooks.playbookCount, 0);
  assert.deepEqual(optimizerState.operatorPlaybooks.topPlaybookIds, []);
  assert.equal(optimizerState.operatorPlaybooks.readinessOverview, "No proposal-only family-level operator playbooks have been generated yet.");
  assert.equal(optimizerState.operatorPlaybooks.playbooksPath, ARTIFACT_PATHS.metaOperatorPlaybooks);
  assert.equal(optimizerState.operatorLessons.lessonCount, 0);
  assert.equal(optimizerState.operatorLessons.activeLessonCount, 0);
  assert.equal(optimizerState.operatorLessons.lessonsPath, ARTIFACT_PATHS.metaOperatorLessons);

  assert.equal(longHorizonMemory.version, 1);
  assert.equal(longHorizonMemory.historyWindowSize, 30);
  assert.deepEqual(longHorizonMemory.horizon, createMetaLongHorizonMemory().horizon);
  assert.deepEqual(longHorizonMemory.summary.topFamilyIds, []);
  assert.deepEqual(longHorizonMemory.summary.topTaxonomyFamilyIds, []);
  assert.deepEqual(longHorizonMemory.summary.topTaxonomyGroupIds, []);
  assert.equal(longHorizonMemory.summary.snapshotCount, 0);
  assert.equal(longHorizonMemory.summary.lastAction, "unchanged");
  assert.equal(longHorizonMemory.historyPolicy.mode, "deterministic-noop-drift-guard-v1");
  assert.deepEqual(longHorizonMemory.history, []);
  assert.deepEqual(longHorizonMemory.families, []);

  assert.equal(remediationPacks.version, 1);
  assert.deepEqual(remediationPacks.packs, []);
  assert.deepEqual(remediationPacks.summary.topPackIds, []);
  assert.deepEqual(remediationPacks.summary.topClusterIds, []);
  assert.equal(remediationPacks.summary.readinessOverview, "No proposal-only remediation packs have been generated yet.");
  assert.equal(remediationPacks.summary.packsPath, ARTIFACT_PATHS.metaRemediationPacks);
  assert.deepEqual(remediationPacks.sourceArtifacts, createMetaRemediationPacksIndex().sourceArtifacts);

  assert.equal(operatorPlaybooks.version, 1);
  assert.deepEqual(operatorPlaybooks.playbooks, []);
  assert.deepEqual(operatorPlaybooks.summary.topPlaybookIds, []);
  assert.equal(operatorPlaybooks.summary.readinessOverview, "No proposal-only family-level operator playbooks have been generated yet.");
  assert.equal(operatorPlaybooks.summary.playbooksPath, ARTIFACT_PATHS.metaOperatorPlaybooks);
  assert.deepEqual(operatorPlaybooks.sourceArtifacts, createMetaOperatorPlaybooksIndex().sourceArtifacts);

  assert.equal(operatorLessons.version, 1);
  assert.equal(operatorLessons.explicitOnly, true);
  assert.equal(operatorLessons.noAutoCapture, true);
  assert.equal(operatorLessons.noAutoApply, true);
  assert.deepEqual(operatorLessons.lessons, []);
  assert.deepEqual(operatorLessons.sourceArtifacts, createMetaOperatorLessonsIndex().sourceArtifacts.filter((artifactPath) => !artifactPath.startsWith(".trellis/tasks")));

  assert.equal(executionBridgeCandidates.version, 1);
  assert.deepEqual(executionBridgeCandidates.candidates, []);
  assert.deepEqual(executionBridgeCandidates.summary.topCandidateIds, []);
  assert.equal(executionBridgeCandidates.summary.candidatesPath, ARTIFACT_PATHS.metaExecutionBridgeCandidates);
  assert.deepEqual(executionBridgeCandidates.sourceArtifacts, createMetaExecutionBridgeCandidatesIndex().sourceArtifacts);
  });
});

test("queryMetaOptimize carries forward legacy long-horizon history while rewriting normalized meta surfaces", () => {
  const root = tempRoot();
  runFixtureMutation(root, "legacy-meta-setup", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Legacy Meta", objective: "Normalize legacy meta artifacts through explicit refresh." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "legacy-review-gap",
      summary: "Legacy concern persists.",
      severity: "high",
      status: "escalated",
      responseOwnerRole: "researcher",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  });
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaLongHorizonMemory), JSON.stringify({
    version: 1,
    proposalOnly: true,
    historyWindowSize: 12,
    horizon: { reviewRoundsObserved: 1 },
    summary: {
      familyCount: 1,
      recurringFamilyCount: 0,
      risingFamilyCount: 0,
      stableFamilyCount: 1,
      coolingFamilyCount: 0,
      topFamilyIds: ["review-recurrence"],
      overview: "Legacy memory overview."
    },
    history: [{
      observedAt: "2026-01-01T00:00:00.000Z",
      frontierScore: 1,
      recommendationCount: 1,
      criticalCount: 0,
      clusterCount: 1,
      topClusterIds: ["review-closure"],
      topRecommendationIds: ["legacy-rec"],
      familyCounts: { "review-recurrence": 1 },
      familyTopRecommendationIds: { "review-recurrence": ["legacy-rec"] },
      familyTopClusterIds: { "review-recurrence": ["review-closure"] }
    }],
    families: [{
      id: "review-recurrence",
      label: "Review recurrence",
      summary: "Legacy family summary.",
      currentCount: 1,
      totalCount: 1,
      activeSnapshotCount: 1,
      recurring: false,
      trend: { status: "stable", recentCount: 1, previousCount: 0 },
      topRecommendationIds: ["legacy-rec"],
      topClusterIds: ["review-closure"],
      relatedRecommendationIds: ["legacy-rec"],
      evidenceArtifactPaths: [ARTIFACT_PATHS.reviewConcerns],
      signalTypes: ["review-concern"],
      firstObservedAt: "2026-01-01T00:00:00.000Z",
      lastObservedAt: "2026-01-01T00:00:00.000Z"
    }],
    updatedAt: "2026-01-01T00:00:00.000Z"
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaRecommendations), JSON.stringify({
    version: 1,
    items: [],
    ranking: { method: "legacy-ranking" },
    summary: { topClusterIds: ["legacy-cluster"] }
  }, null, 2));
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerState), JSON.stringify({
    version: 1,
    frontier: { recommendationCount: 99, topClusterIds: ["legacy-cluster"] },
    longHorizon: { overview: "Legacy state overview." }
  }, null, 2));

  const result = runFixtureMutation(root, "legacy-meta-query", () => queryMetaOptimize(root));
  const longHorizonMemory = readJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, createMetaLongHorizonMemory);
  const workspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { version: 9 });

  assert.equal(result.proposalOnly, true);
  assert.equal(longHorizonMemory.history.length >= 2, true);
  assert.equal(longHorizonMemory.historyWindowSize, 12);
  assert.equal(longHorizonMemory.history[0].observedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(longHorizonMemory.summary.topFamilyIds.includes("review-recurrence"), true);
  assert.equal(longHorizonMemory.summary.snapshotCount, longHorizonMemory.history.length);
  assert.equal(longHorizonMemory.summary.lastAction, "append");
  assert.equal(result.longHorizon.history.length, longHorizonMemory.history.length);
  assert.equal(workspaceIndex.metaOptimize.recommendationCount, result.recommendations.length);
  assert.equal(workspaceIndex.metaOptimize.clusterCount, result.clusters.length);
  assert.equal(workspaceIndex.metaOptimize.longHorizonPath, ARTIFACT_PATHS.metaLongHorizonMemory);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.snapshotCount, longHorizonMemory.summary.snapshotCount);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.lastAction, longHorizonMemory.summary.lastAction);
});

test("queryMetaOptimize avoids long-horizon history drift on repeated no-op refreshes", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "querymetaoptimize-avoids-long-horizon-history-drift-on-repeated-no-op-re", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Meta No-op Drift", objective: "Avoid long-horizon history churn from repeated meta refreshes." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "repeat-review-gap",
      summary: "A recurring review concern remains open.",
      severity: "high",
      status: "escalated",
      responseOwnerRole: "researcher",
      recurrenceCount: 3,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the recurring review concern."],
    unresolvedConcernIds: ["repeat-review-gap"],
    escalatedConcernIds: ["repeat-review-gap"],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 3,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["researcher"], separationMaintained: true }
  });

  const first = queryMetaOptimize(root);
  const firstMemory = readJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, createMetaLongHorizonMemory);
  const firstSnapshotCount = firstMemory.summary.snapshotCount;
  const firstObservedAt = firstMemory.summary.lastObservedAt;
  const firstOverview = firstMemory.summary.overview;
  const firstFamilyIds = firstMemory.summary.topFamilyIds;

  const second = queryMetaOptimize(root);
  const secondMemory = readJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, createMetaLongHorizonMemory);
  const secondWorkspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { version: 9 });
  const secondOptimizerState = readJson(root, ARTIFACT_PATHS.metaOptimizerState, { version: 4, frontier: {}, longHorizon: {} });

  assert.equal(firstMemory.history.length >= 1, true);
  assert.equal(secondMemory.history.length, firstMemory.history.length);
  assert.equal(secondMemory.summary.snapshotCount, firstSnapshotCount);
  assert.equal(secondMemory.summary.lastObservedAt, firstObservedAt);
  assert.equal(secondMemory.summary.overview, firstOverview);
  assert.deepEqual(secondMemory.summary.topFamilyIds, firstFamilyIds);
  assert.equal(secondMemory.summary.lastAction, "unchanged");
  assert.equal(secondMemory.historyPolicy.lastAction, "unchanged");
  assert.equal(secondMemory.historyPolicy.mode, "deterministic-noop-drift-guard-v1");
  assert.equal(second.frontier.frontierSummary, first.frontier.frontierSummary);
  assert.equal(secondOptimizerState.longHorizon.snapshotCount, secondMemory.summary.snapshotCount);
  assert.equal(secondOptimizerState.longHorizon.lastAction, secondMemory.summary.lastAction);
  assert.equal(secondWorkspaceIndex.metaOptimize.longHorizon.snapshotCount, secondMemory.summary.snapshotCount);
  assert.equal(secondWorkspaceIndex.metaOptimize.longHorizon.lastAction, secondMemory.summary.lastAction);
  });
});

test("queryMetaOptimize builds proposal-only recommendations from durable review, audit, bridge, and repair signals", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "querymetaoptimize-builds-proposal-only-recommendations-from-durable-revi", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Meta Frontier", objective: "Surface optimizer recommendations from durable signals." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "review-gap-1",
      summary: "Reviewer concern keeps recurring.",
      severity: "high",
      status: "escalated",
      responseOwnerRole: "researcher",
      recurrenceCount: 3,
      linkedAuditIds: ["audit-1"],
      linkedBridgeIds: ["bridge-1"],
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.adversarialReviewState, {
    version: 2,
    round: 3,
    unresolvedConcernIds: ["review-gap-1"],
    escalatedConcernIds: ["review-gap-1"],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    concernStatusCounts: { escalated: 1 },
    escalationThresholds: { high: 1, medium: 2, low: 3 },
    lastAuditIds: ["audit-1"],
    lastBridgeIds: ["bridge-1"],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Repair the recurring review concern."],
    unresolvedConcernIds: ["review-gap-1"],
    escalatedConcernIds: ["review-gap-1"],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 3,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["researcher"], separationMaintained: true }
  });
  writeJson(root, ARTIFACT_PATHS.experimentAudits, {
    version: 1,
    items: [{
      id: "audit-1",
      experimentId: "exp-1",
      resultId: "result-1",
      integrityFlags: ["missing-reviewed-artifact-refs"],
      auditVerdict: "blocked",
      confidence: "low",
      reviewedArtifactRefs: []
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.claimBridgeLog, {
    version: 1,
    items: [{
      id: "bridge-1",
      experimentId: "exp-1",
      resultId: "result-1",
      claimId: "claim-1",
      auditIds: ["audit-1"],
      auditVerdict: "blocked",
      integrityFlags: ["missing-reviewed-artifact-refs"],
      bridgeStatus: "held-for-review",
      reason: "Audit is blocked."
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.figureQa, {
    version: 1,
    items: [],
    issues: [{
      id: "figure-issue-1",
      figureId: "figure-1",
      code: "missing-final-svg",
      severity: "high",
      summary: "Final SVG is missing.",
      artifactPaths: [ARTIFACT_PATHS.figureQa]
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.versionComparisons, {
    version: 1,
    items: [{
      id: "v1-vs-v2",
      fromVersionId: "v1",
      toVersionId: "v2",
      unresolvedConcernsAdded: ["review-gap-1"],
      unresolvedConcernsRemoved: []
    }],
    activeTargets: ["v1", "v2"],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.sessionJournal, {
    version: 1,
    entries: [
      { id: "old-1", timestamp: "2026-01-01T00:00:00.000Z", type: "append-review-log", summary: "Older review pass.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewState] },
      { id: "old-2", timestamp: "2026-01-02T00:00:00.000Z", type: "run-review-loop", summary: "Older review loop.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewLog] },
      { id: "old-3", timestamp: "2026-01-03T00:00:00.000Z", type: "query-meta-optimize", summary: "Older optimizer check.", phase: "review", assignedRole: "planner", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.metaOptimizerReport] },
      { id: "recent-1", timestamp: "2026-01-04T00:00:00.000Z", type: "append-review-log", summary: "Recent review pass.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewState] },
      { id: "recent-2", timestamp: "2026-01-05T00:00:00.000Z", type: "run-review-loop", summary: "Recent review loop.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewLog] },
      { id: "recent-3", timestamp: "2026-01-06T00:00:00.000Z", type: "append-review-log", summary: "Recent review pass again.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewState] },
      { id: "recent-4", timestamp: "2026-01-07T00:00:00.000Z", type: "run-review-loop", summary: "Recent review loop again.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewLog] },
      { id: "recent-5", timestamp: "2026-01-08T00:00:00.000Z", type: "query-meta-optimize", summary: "Recent optimizer check.", phase: "review", assignedRole: "planner", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.metaOptimizerReport] },
      { id: "recent-6", timestamp: "2026-01-09T00:00:00.000Z", type: "append-review-log", summary: "Recent review pass third.", phase: "review", assignedRole: "reviewer", taskPacketIds: [], artifactPaths: [ARTIFACT_PATHS.reviewState] }
    ],
    updatedAt: null
  });

  const result = queryMetaOptimize(root);
  const longHorizonMemory = readJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, { version: 1, summary: {}, history: [], families: [], updatedAt: null });
  const executionBridgeCandidates = readJson(root, ARTIFACT_PATHS.metaExecutionBridgeCandidates, createMetaExecutionBridgeCandidatesIndex);
  const operatorPlaybooks = readJson(root, ARTIFACT_PATHS.metaOperatorPlaybooks, createMetaOperatorPlaybooksIndex);
  const recommendations = readJson(root, ARTIFACT_PATHS.metaRecommendations, { version: 1, items: [], summary: {}, updatedAt: null });
  const optimizerState = readJson(root, ARTIFACT_PATHS.metaOptimizerState, { version: 1, frontier: {}, updatedAt: null });
  const remediationPacks = readJson(root, ARTIFACT_PATHS.metaRemediationPacks, createMetaRemediationPacksIndex);
  const report = fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerReport), "utf8");
  const workspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { version: 9 });
  const sessionSummary = fs.readFileSync(path.join(root, ARTIFACT_PATHS.sessionSummary), "utf8");

  assert.equal(result.proposalOnly, true);
  assert.equal(result.executionBridgeCandidates.proposalOnly, true);
  assert.ok(Array.isArray(result.clusters));
  assert.equal(result.groupedFrontier.ranking.method, "durable-signal-frontier-v1");
  assert.ok(Array.isArray(result.groupedFrontier.topClusters));
  assert.equal(result.longHorizon.proposalOnly, true);
  assert.equal(result.longHorizon.families.find((item) => item.id === "review-recurrence")?.trend.status, "rising");
  assert.equal(result.groupedFrontier.clusterMembership["review-closure"].includes("meta-review-review-gap-1"), true);
  assert.equal(result.clusters[0].id, "evidence-integrity");
  assert.equal(result.recommendations[0].id, "meta-review-review-gap-1");
  assert.ok(result.recommendations.some((item) => item.category === "review-discipline"));
  assert.ok(result.recommendations.some((item) => item.category === "experiment-integrity"));
  assert.ok(result.recommendations.some((item) => item.category === "claim-bridge"));
  assert.ok(result.recommendations.some((item) => item.category === "artifact-health"));
  assert.equal(result.frontier.clusterCount, recommendations.clusters.length);
  assert.ok(recommendations.summary.criticalCount >= 1);
  assert.ok(recommendations.summary.clusterCount >= 3);
  assert.equal(recommendations.frontier.topClusterIds[0], "evidence-integrity");
  assert.equal(recommendations.frontier.rankingMethod, "durable-signal-frontier-v1");
  assert.match(recommendations.frontier.frontierSummary, /ranked recommendations across/);
  assert.equal(recommendations.summary.topClusters[0].id, "evidence-integrity");
  assert.equal(recommendations.summary.clusterMembership["review-closure"].includes("meta-review-review-gap-1"), true);
  assert.match(recommendations.items[0].sortKey, /^\d{4}:\d{2}:/);
  assert.match(recommendations.items[0].tieBreakKey, /^\d{4}:\d{2}:/);
  assert.ok(Array.isArray(recommendations.items[0].rankingBasis));
  assert.equal(optimizerState.proposalOnly, true);
  assert.equal(optimizerState.frontier.clusterCount, recommendations.clusters.length);
  assert.equal(optimizerState.frontier.reportPath, ARTIFACT_PATHS.metaOptimizerReport);
  assert.equal(optimizerState.frontier.rankingMethod, "durable-signal-frontier-v1");
  assert.equal(optimizerState.frontier.longHorizonPath, ARTIFACT_PATHS.metaLongHorizonMemory);
  assert.equal(optimizerState.frontier.topClusters[0].id, "evidence-integrity");
  assert.equal(optimizerState.longHorizon.memoryPath, ARTIFACT_PATHS.metaLongHorizonMemory);
  assert.equal(optimizerState.longHorizon.snapshotCount, longHorizonMemory.summary.snapshotCount);
  assert.equal(optimizerState.longHorizon.lastAction, longHorizonMemory.summary.lastAction);
  assert.ok(Array.isArray(longHorizonMemory.history));
  assert.equal(longHorizonMemory.history.length >= 1, true);
  assert.equal(longHorizonMemory.families.find((item) => item.id === "review-recurrence")?.trend.status, "rising");
  assert.equal(longHorizonMemory.summary.snapshotCount, longHorizonMemory.history.length);
  assert.match(report, /Proposal only: true/);
  assert.match(report, /Optimization frontier/);
  assert.match(report, /Meta-optimize frontier summary:/);
  assert.match(report, /Long-horizon workflow memory/);
  assert.match(report, /Long-horizon snapshots:/);
  assert.match(report, /Long-horizon last action:/);
  assert.match(report, /Long-horizon history policy:/);
  assert.match(report, /Cluster 1: Evidence integrity/);
  assert.match(report, /Evidence-backed recommendations/);
  assert.match(report, /Execution bridge candidate scaffolds/);
  assert.match(report, /Stable tie-break order/);
  assert.match(report, /Ranking basis:/);
  assert.equal(workspaceIndex.metaOptimize.proposalOnly, true);
  assert.equal(workspaceIndex.metaOptimize.recommendationCount, recommendations.items.length);
  assert.equal(workspaceIndex.metaOptimize.clusterCount, recommendations.clusters.length);
  assert.equal(workspaceIndex.metaOptimize.topClusterIds[0], "evidence-integrity");
  assert.equal(workspaceIndex.metaOptimize.topClusters[0].id, "evidence-integrity");
  assert.equal(workspaceIndex.metaOptimize.frontierSummary, recommendations.frontier.frontierSummary);
  assert.equal(workspaceIndex.metaOptimize.longHorizonPath, ARTIFACT_PATHS.metaLongHorizonMemory);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.familyCount >= 3, true);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.snapshotCount, longHorizonMemory.summary.snapshotCount);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.lastAction, longHorizonMemory.summary.lastAction);
  assert.equal(workspaceIndex.metaOptimize.executionBridgeCandidates.candidateCount, executionBridgeCandidates.summary.candidateCount);
  assert.equal(remediationPacks.proposalOnly, true);
  assert.equal(remediationPacks.summary.packCount >= 3, true);
  assert.equal(remediationPacks.summary.topClusterIds[0], "evidence-integrity");
  assert.equal(remediationPacks.summary.packsPath, ARTIFACT_PATHS.metaRemediationPacks);
  assert.equal(executionBridgeCandidates.summary.candidateCount > 0, true);
  assert.equal(result.executionBridgeCandidates.summary.candidateCount, executionBridgeCandidates.summary.candidateCount);
  assert.equal(executionBridgeCandidates.candidates[0].proposalOnly, true);
  assert.equal(executionBridgeCandidates.candidates[0].noAutoApply, true);
  assert.equal(Array.isArray(executionBridgeCandidates.candidates[0].context.linkedPacketPointers), true);
  assert.equal(Array.isArray(executionBridgeCandidates.candidates[0].context.linkedWorkspacePointers), true);
  assert.equal(Array.isArray(executionBridgeCandidates.candidates[0].context.linkedRemediationPacks), true);
  assert.equal(Array.isArray(executionBridgeCandidates.candidates[0].context.linkedPlaybooks), true);
  assert.ok(["packet-candidate", "checklist-candidate", "revision-plan-candidate", "review-follow-up-candidate", "figure-follow-up-candidate"].includes(executionBridgeCandidates.candidates[0].candidateType));
  assert.equal(remediationPacks.packs[0].proposalOnly, true);
  assert.equal(remediationPacks.packs[0].explicitOnly, true);
  assert.equal(remediationPacks.packs[0].noAutoApply, true);
  assert.equal(remediationPacks.packs[0].clusterId, "evidence-integrity");
  assert.equal(remediationPacks.packs[0].frontier.recommendationIds.includes("meta-bridge-bridge-1"), true);
  assert.equal(remediationPacks.packs[0].frontier.recommendationIds.includes("meta-audit-audit-1"), true);
  assert.equal(remediationPacks.packs[0].reviewConcerns.some((item) => item.id === "review-gap-1"), true);
  assert.equal(remediationPacks.packs.some((pack) => pack.figureQa.some((item) => item.id === "figure-issue-1")), true);
  assert.equal(remediationPacks.packs.some((pack) => pack.longHorizonMemory.some((item) => item.id === "review-recurrence")), true);
  assert.equal(remediationPacks.packs[0].workspacePointers.includes(ARTIFACT_PATHS.workspaceIndex), true);
  assert.equal(remediationPacks.packs[0].acceptanceCriteria.length > 0, true);
  assert.equal(remediationPacks.packs[0].conversionHints.length > 0, true);
  assert.equal(remediationPacks.packs[0].rankedConversionPaths.length > 1, true);
  assert.equal(["actionable", "partially-actionable", "advisory-only"].includes(remediationPacks.packs[0].readiness.operatorReadiness), true);
  assert.ok(Array.isArray(remediationPacks.packs[0].readiness.missingIngredients));
  assert.equal(remediationPacks.packs[0].rankedConversionPaths[0].rank, 1);
  assert.ok(remediationPacks.packs[0].rankedConversionPaths[0].pathScore >= remediationPacks.packs[0].rankedConversionPaths[1].pathScore);
  assert.equal(remediationPacks.packs[0].conversionHints.some((hint) => ["create-new-packet", "update-existing-packet", "add-checklist-entry", "add-revision-item"].includes(hint.targetType)), true);
  assert.equal(remediationPacks.packs[0].manualNextActions.length > 0, true);
  assert.equal(result.remediationPacks.summary.packCount, remediationPacks.summary.packCount);
  assert.equal(result.remediationPacks.packs[0].clusterId, remediationPacks.packs[0].clusterId);
  assert.equal(operatorPlaybooks.proposalOnly, true);
  assert.equal(operatorPlaybooks.summary.playbookCount, 0);
  assert.equal(result.operatorPlaybooks.summary.playbookCount, operatorPlaybooks.summary.playbookCount);
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.packCount, remediationPacks.summary.packCount);
  assert.equal(workspaceIndex.metaOptimize.remediationPacks.topPackIds[0], remediationPacks.summary.topPackIds[0]);
  assert.match(workspaceIndex.metaOptimize.remediationPacks.readinessOverview, /actionable|advisory|partially/i);
  assert.equal(workspaceIndex.metaOptimize.operatorPlaybooks.playbookCount, operatorPlaybooks.summary.playbookCount);
  assert.match(workspaceIndex.metaOptimize.operatorPlaybooks.readinessOverview, /actionable|advisory|partially|No proposal-only family-level operator playbooks/i);
  assert.match(sessionSummary, /Long-horizon memory:/);
  assert.match(sessionSummary, /Meta-optimize frontier summary:/);
  assert.match(sessionSummary, /Remediation packs:/);
  assert.match(sessionSummary, /Remediation pack readiness:/);
  assert.match(sessionSummary, /Family playbooks:/);
  assert.match(sessionSummary, /Family playbook readiness:/);
  assert.match(sessionSummary, /Remediation packs path:/);
  assert.match(sessionSummary, /Family playbooks path:/);
  assert.match(sessionSummary, /Long-horizon snapshots:/);
  assert.match(sessionSummary, /Long-horizon last action:/);
  assert.match(sessionSummary, /Long-horizon memory path:/);
  assert.match(report, /Remediation packs/);
  assert.match(report, /Family-level operator playbooks/);
  assert.match(report, /Readiness:/);
  assert.match(report, /Missing ingredients:/);
  assert.match(report, /Acceptance criteria:/);
  assert.match(report, /Conversion hints:/);
  assert.match(report, /Manual next actions:/);
  });
});

test("queryMetaOptimize uses stable id tie-breaking for equal-scored recommendations inside a cluster", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "querymetaoptimize-uses-stable-id-tie-breaking-for-equal-scored-recommend", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Meta Tie Breaks", objective: "Keep equal-scored optimizer recommendations deterministic." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [
      {
        id: "alpha",
        summary: "Recurring alpha concern.",
        severity: "medium",
        status: "open",
        responseOwnerRole: "researcher",
        recurrenceCount: 2,
        linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
        updatedAt: new Date(0).toISOString()
      },
      {
        id: "beta",
        summary: "Recurring beta concern.",
        severity: "medium",
        status: "open",
        responseOwnerRole: "researcher",
        recurrenceCount: 2,
        linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
        updatedAt: new Date(0).toISOString()
      }
    ],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-revision",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close recurring concerns."],
    unresolvedConcernIds: ["alpha", "beta"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 2,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["researcher"], separationMaintained: true }
  });

  const result = queryMetaOptimize(root);
  const recurring = result.recommendations.filter((item) => item.clusterId === "review-closure");

  assert.equal(recurring[0].id, "meta-recurring-review-alpha");
  assert.equal(recurring[1].id, "meta-recurring-review-beta");
  assert.equal(recurring[0].score, recurring[1].score);
  assert.ok(recurring[0].sortKey < recurring[1].sortKey);
  assert.ok(recurring[0].tieBreakKey < recurring[1].tieBreakKey);
  });
});

test("refreshWiki records typed relation integrity failures and exposes them through the workspace repair frontier", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "refreshwiki-records-typed-relation-integrity-failures-and-exposes-them-t", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Relation Frontier", objective: "Track degraded typed wiki relations." });
  const packetId = seedTaskPacket(root, "relation-frontier");

  registerSource(root, { packetId, citationKey: "relation-source", title: "Relation Source", authors: ["Lee"], year: 2026 });
  upsertNote(root, { packetId, noteId: "note-main", title: "Frontier note", sectionId: "introduction", sourceIds: ["relation-source"], summary: "Source-backed note." });
  writeJson(root, ARTIFACT_PATHS.sources, {
    version: 1,
    items: [{ id: "experiment-bad-exp", citationKey: "bad-exp-source", title: "Wrong endpoint type", authors: [], year: 2026, sourceType: "paper", abstract: "", origin: "manual", addedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{
      id: "claim-frontier",
      text: "Relation integrity should surface repair work.",
      sectionId: "introduction",
      status: "supported",
      confidence: "medium",
      sourceIds: ["missing-source"],
      noteIds: ["missing-note"],
      experimentIds: ["bad-exp"]
    }],
    updatedAt: null
  });

  refreshWiki(root);

  const relations = readJson(root, ARTIFACT_PATHS.wikiRelations, { version: 3, items: [], summary: {}, updatedAt: null });
  const workspaceIndex = queryWorkspaceIndex(root);
  const degradedRelation = relations.items.find((item) => item.id === "claim-frontier-tested-by-bad-exp");
  const degradedFamily = relations.summary.taxonomy?.families?.find((item) => item.id === "validation-loop");
  const degradedReasonCodes = new Set(relations.items.flatMap((item) => (item.integrity?.reasons ?? []).map((reason) => reason.code)));

  assert.equal(relations.version, 3);
  assert.equal(relations.summary.degradedCount > 0, true);
  assert.equal(degradedRelation.integrity.status, "degraded");
  assert.equal(degradedRelation.semantics.expectedToEntityType, "experiment");
  assert.equal(degradedRelation.taxonomy.familyId, "validation-loop");
  assert.equal(degradedRelation.taxonomy.groupId, "claim-experiment-validation");
  assert.match(degradedRelation.semantics.directionalMeaning.forward, /Claim is tested by experiment/);
  assert.equal(degradedRelation.toEntityType, "source");
  assert.ok(degradedReasonCodes.has("dangling-to-entity"));
  assert.ok(degradedReasonCodes.has("invalid-to-entity-type"));
  assert.equal(relations.summary.taxonomy.degradedFamilyCount > 0, true);
  assert.equal(relations.summary.taxonomy.topDegradedFamilyIds.includes("validation-loop"), true);
  assert.equal(degradedFamily.degradedCount > 0, true);
  assert.ok(Array.isArray(relations.summary.taxonomyRepairFrontier));
  assert.equal(workspaceIndex.repairFrontier.relationIssueCount > 0, true);
  assert.equal(workspaceIndex.repairFrontier.relationFamilyIssueCount > 0, true);
  assert.match(workspaceIndex.repairFrontier.taxonomyOverview, /families currently degraded/);
  assert.equal(workspaceIndex.repairFrontier.topDegradedFamilyIds.includes("validation-loop"), true);
  assert.equal(workspaceIndex.repairFrontier.relationFamilySummaries.some((item) => item.id === "validation-loop"), true);
  assert.ok(workspaceIndex.repairFrontier.prioritizedItems.some((item) => item.frontierType === "typed-wiki-relation"));
  assert.ok(workspaceIndex.repairFrontier.prioritizedItems.some((item) => item.frontierType === "typed-wiki-relation-family"));
  });
});

test("queryMetaOptimize carries typed wiki taxonomy pressure through clusters, summaries, and long-horizon memory", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "querymetaoptimize-carries-typed-wiki-taxonomy-pressure-through-clusters-", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Taxonomy-aware Meta", objective: "Make optimizer recommendations explicitly aware of typed wiki taxonomy pressure." });
  const packetId = seedTaskPacket(root, "taxonomy-aware-meta");

  registerSource(root, { packetId, citationKey: "taxonomy-source", title: "Taxonomy Source", authors: ["Chen"], year: 2026 });
  upsertNote(root, { packetId, noteId: "taxonomy-note", title: "Taxonomy note", sectionId: "method", sourceIds: ["taxonomy-source"], summary: "Ground a note in a source." });
  writeJson(root, ARTIFACT_PATHS.sources, {
    version: 1,
    items: [{ id: "experiment-wrong-exp", citationKey: "wrong-exp-source", title: "Wrong endpoint type", authors: [], year: 2026, sourceType: "paper", abstract: "", origin: "manual", addedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{
      id: "claim-taxonomy",
      text: "Taxonomy pressure should reach the optimizer frontier.",
      sectionId: "experiments",
      status: "supported",
      confidence: "medium",
      sourceIds: ["missing-source"],
      noteIds: ["missing-note"],
      experimentIds: ["wrong-exp"]
    }],
    updatedAt: null
  });

  refreshWiki(root);

  const result = queryMetaOptimize(root);
  const recommendations = readJson(root, ARTIFACT_PATHS.metaRecommendations, { items: [], frontier: {}, summary: {}, clusters: [], updatedAt: null });
  const optimizerState = readJson(root, ARTIFACT_PATHS.metaOptimizerState, { frontier: {}, longHorizon: {}, updatedAt: null });
  const longHorizonMemory = readJson(root, ARTIFACT_PATHS.metaLongHorizonMemory, { summary: {}, families: [], history: [], updatedAt: null });
  const workspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { repairFrontier: {}, metaOptimize: {} });
  const report = fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerReport), "utf8");

  const taxonomyRecommendation = result.recommendations.find((item) => item.taxonomyPressure?.familyIds?.includes("validation-loop"));
  const taxonomyCluster = result.clusters.find((item) => item.id === "validation-loop-pressure");
  const taxonomyFamily = longHorizonMemory.families.find((item) => item.id === "taxonomy-validation-loop");

  assert.ok(taxonomyRecommendation);
  assert.equal(taxonomyRecommendation.scope, "validation-loop / artifact health");
  assert.equal(taxonomyRecommendation.taxonomyPressure.familyIds.includes("validation-loop"), true);
  assert.equal(taxonomyRecommendation.taxonomyPressure.groupIds.includes("claim-experiment-validation"), true);
  assert.equal(taxonomyRecommendation.signalStrength.taxonomyFamilyPressure > 0, true);
  assert.equal(taxonomyRecommendation.signalStrength.taxonomyGroupPressure > 0, true);
  assert.ok(taxonomyRecommendation.rankingBasis.some((item) => item.startsWith("taxonomyFamilyPressure=")));
  assert.ok(taxonomyRecommendation.rankingBasis.some((item) => item.startsWith("taxonomyGroupPressure=")));

  assert.ok(taxonomyCluster);
  assert.equal(taxonomyCluster.taxonomyPressure.familyIds.includes("validation-loop"), true);
  assert.equal(taxonomyCluster.taxonomyPressure.groupIds.includes("claim-experiment-validation"), true);
  assert.equal(recommendations.frontier.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.match(recommendations.frontier.taxonomyOverview, /Validation loop/i);
  assert.equal(recommendations.summary.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(recommendations.summary.topClusters.some((item) => item.taxonomyPressure?.familyIds?.includes("validation-loop")), true);
  assert.match(recommendations.frontier.frontierSummary, /Dominant taxonomy pressure/);

  assert.equal(optimizerState.frontier.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.match(optimizerState.frontier.taxonomyOverview, /validation loop/i);

  assert.equal(workspaceIndex.repairFrontier.topDegradedGroupIds.includes("claim-experiment-validation"), true);
  assert.equal(workspaceIndex.repairFrontier.relationGroupSummaries.some((item) => item.id === "claim-experiment-validation"), true);
  assert.equal(workspaceIndex.metaOptimize.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(workspaceIndex.metaOptimize.longHorizon.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.match(workspaceIndex.metaOptimize.taxonomyOverview, /Validation loop/i);

  assert.ok(taxonomyFamily);
  assert.equal(taxonomyFamily.relatedTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(taxonomyFamily.relatedTaxonomyGroupIds.includes("claim-experiment-validation"), true);
  assert.equal(longHorizonMemory.summary.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.match(longHorizonMemory.summary.overview, /Dominant taxonomy pressure/);
  assert.equal(longHorizonMemory.history.at(-1).topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(longHorizonMemory.history.at(-1).taxonomyGroupCounts["claim-experiment-validation"] > 0, true);

  assert.match(report, /Meta-optimize taxonomy pressure:/);
  assert.match(report, /Long-horizon taxonomy families:/);
  assert.match(report, /Taxonomy pressure:/);
  });
});

test("queryMetaOptimize derives family-level operator playbooks from taxonomy, remediation packs, and long-horizon memory", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "querymetaoptimize-derives-family-level-operator-playbooks-from-taxonomy-", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Family Playbooks", objective: "Surface family-level operator playbooks without auto-applying anything." });
  const packetId = seedTaskPacket(root, "family-playbooks");

  registerSource(root, { packetId, citationKey: "playbook-source", title: "Playbook Source", authors: ["Ng"], year: 2026 });
  upsertNote(root, { packetId, noteId: "playbook-note", title: "Playbook note", sectionId: "method", sourceIds: ["playbook-source"], summary: "Family playbooks should stay file-first." });
  writeJson(root, ARTIFACT_PATHS.sources, {
    version: 1,
    items: [{ id: "experiment-playbook-exp", citationKey: "playbook-exp-source", title: "Wrong endpoint type", authors: [], year: 2026, sourceType: "paper", abstract: "", origin: "manual", addedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{
      id: "claim-playbook",
      text: "Validation-loop playbooks should be derived from durable artifacts.",
      sectionId: "experiments",
      status: "supported",
      confidence: "medium",
      sourceIds: ["missing-source"],
      noteIds: ["missing-note"],
      experimentIds: ["playbook-exp"]
    }],
    updatedAt: null
  });

  refreshWiki(root);

  const result = queryMetaOptimize(root);
  const playbooks = readJson(root, ARTIFACT_PATHS.metaOperatorPlaybooks, createMetaOperatorPlaybooksIndex);
  const workspaceIndex = readJson(root, ARTIFACT_PATHS.workspaceIndex, { metaOptimize: {} });
  const reviewerManifest = readJson(root, `${ARTIFACT_PATHS.roleContextsDir}/researcher.json`, {});
  const currentActionBundle = readJson(root, `${ARTIFACT_PATHS.actionContextsDir}/current.json`, {});
  const report = fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOptimizerReport), "utf8");

  const validationPlaybook = playbooks.playbooks.find((item) => item.taxonomyFamilyId === "validation-loop");

  assert.ok(validationPlaybook);
  assert.equal(validationPlaybook.proposalOnly, true);
  assert.equal(validationPlaybook.noAutoApply, true);
  assert.equal(["actionable", "partially-actionable", "advisory-only"].includes(validationPlaybook.readiness.operatorReadiness), true);
  assert.equal(validationPlaybook.acceptanceCriteria.length > 0, true);
  assert.equal(validationPlaybook.conversionHints.length > 0, true);
  assert.equal(validationPlaybook.rankedConversionPaths.length > 1, true);
  assert.equal(validationPlaybook.artifactUpdateMap.targetCount > 0, true);
  assert.equal(validationPlaybook.artifactUpdateMap.updateOrder[0], validationPlaybook.artifactUpdateMap.targets[0].artifactPath);
  assert.equal(validationPlaybook.rankedConversionPaths[0].rank, 1);
  assert.ok(validationPlaybook.rankedConversionPaths[0].pathScore >= validationPlaybook.rankedConversionPaths[1].pathScore);
  assert.equal(validationPlaybook.manualNextActions.length > 0, true);
  assert.equal(validationPlaybook.remediationPackIds.length > 0, true);
  assert.equal(validationPlaybook.longHorizonFamilyIds.includes("taxonomy-validation-loop"), true);
  assert.equal(playbooks.summary.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(result.operatorPlaybooks.summary.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(workspaceIndex.metaOptimize.operatorPlaybooks.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.ok(reviewerManifest.operatorGuidance.familyPlaybook);
  assert.ok(currentActionBundle.operatorGuidance.familyPlaybook);
  assert.equal(["actionable", "partially-actionable", "advisory-only"].includes(reviewerManifest.operatorGuidance.familyPlaybook.readiness.operatorReadiness), true);
  assert.equal(reviewerManifest.operatorGuidance.familyPlaybook.rankedConversionPaths.length > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.familyPlaybook.artifactUpdateTargets.length > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.familyPlaybook.artifactUpdateOrder.length > 0, true);
  assert.equal(currentActionBundle.operatorGuidance.familyPlaybook.rankedConversionPaths.length > 0, true);
  assert.equal(playbooks.summary.topTaxonomyFamilyIds.includes(reviewerManifest.operatorGuidance.familyPlaybook.taxonomyFamilyId), true);
  assert.equal(playbooks.summary.topTaxonomyFamilyIds.includes(currentActionBundle.operatorGuidance.familyPlaybook.taxonomyFamilyId), true);
  assert.match(report, /Family-level operator playbooks/);
  assert.match(report, /Validation loop operator playbook/);
  assert.match(report, /Artifact update overview:/);
  assert.match(report, /Artifact update order:/);
  assert.match(report, /Artifact targets:/);
  });
});

test("workspace repair frontier and operator manifests surface governance repair plus remediation guidance", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "workspace-repair-frontier-and-operator-manifests-surface-governance-repa", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Governance Repair", objective: "Surface governance repair in the same operator guidance loop." });
  const packetId = seedTaskPacket(root, "governance-repair");

  registerSource(root, { packetId, citationKey: "gov-source", title: "Governance Source", authors: ["Patel"], year: 2026 });
  upsertNote(root, { packetId, noteId: "gov-note", title: "Governance note", sectionId: "method", sourceIds: ["gov-source"], summary: "Governance drift should stay proposal-only and explicit." });
  writeJson(root, ARTIFACT_PATHS.sources, {
    version: 1,
    items: [{ id: "experiment-gov-exp", citationKey: "gov-exp-source", title: "Governance mismatch experiment", authors: [], year: 2026, sourceType: "paper", abstract: "", origin: "manual", addedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{
      id: "claim-governance",
      text: "Governance drift should remain operator-visible.",
      sectionId: "method",
      status: "supported",
      confidence: "medium",
      sourceIds: ["missing-source"],
      noteIds: ["missing-note"],
      experimentIds: ["gov-exp"]
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.versionComparisons, {
    version: 1,
    activeTargets: ["v-next"],
    items: [{
      id: "cmp-governance",
      fromVersionId: "v-prev",
      toVersionId: "v-next",
      unresolvedConcernsAdded: ["concern-governance"],
      createdAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-revision",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: [],
    unresolvedConcernIds: [],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["researcher"], separationMaintained: true }
  });
  upsertSystemOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "researcher",
    intentType: "advance-paper",
    currentFocus: "Close governance-visible drift.",
    nextAction: "Review repair frontier guidance before continuing.",
    activeComparisonTargets: ["v-next"],
    tasks: [{
      id: "handoff-task",
      title: "Cross-role governance follow-up",
      assignedRole: "reviewer",
      status: "in-progress",
      lifecycleStatus: "ready-for-handoff",
      nextAction: "Hand off the governance repair packet to the reviewer.",
      evidenceLinks: [],
      outputPaths: []
    }]
  });

  refreshWiki(root);

  const metaOptimize = queryMetaOptimize(root);
  const workspaceIndex = queryWorkspaceIndex(root);
  const reviewerManifest = readJson(root, `${ARTIFACT_PATHS.roleContextsDir}/reviewer.json`, {});
  const phaseManifest = readJson(root, `${ARTIFACT_PATHS.phaseContextsDir}/research.json`, {});
  const currentActionBundle = readJson(root, `${ARTIFACT_PATHS.actionContextsDir}/current.json`, {});

  assert.equal(metaOptimize.remediationPacks.summary.packCount >= 1, true);
  assert.equal(workspaceIndex.repairFrontier.governanceIssueCount, 2);
  assert.ok(workspaceIndex.repairFrontier.prioritizedItems.some((item) => item.frontierType === "workflow-governance"));
  assert.ok(workspaceIndex.repairFrontier.prioritizedItems.some((item) => item.frontierType === "version-governance"));
  assert.equal(reviewerManifest.operatorGuidance.repairFrontier.governanceIssueCount, 2);
  assert.equal(reviewerManifest.operatorGuidance.remediationPack.manualNextActions.length > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.remediationPack.rankedConversionPaths.length > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.familyPlaybook.manualNextActions.length > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.familyPlaybook.selectionScore > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.familyPlaybook.artifactUpdateTargets.length > 0, true);
  assert.equal(reviewerManifest.operatorGuidance.taxonomyPressure.topTaxonomyFamilyIds.includes("validation-loop"), true);
  assert.equal(phaseManifest.operatorGuidance.remediationPack.manualNextActions.length > 0, true);
  assert.equal(phaseManifest.operatorGuidance.familyPlaybook.manualNextActions.length > 0, true);
  assert.equal(currentActionBundle.operatorGuidance.remediationPack.manualNextActions.length > 0, true);
  assert.equal(currentActionBundle.operatorGuidance.familyPlaybook.manualNextActions.length > 0, true);
  assert.equal(currentActionBundle.operatorGuidance.familyPlaybook.artifactUpdateOrder.length > 0, true);
  assert.equal(currentActionBundle.operatorGuidance.taxonomyPressure.topTaxonomyFamilyIds.includes("validation-loop"), true);
  });
});

test("queryMetaOptimize surfaces durable operator follow-through and marks stale source fingerprints", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "querymetaoptimize-surfaces-durable-operator-follow-through-and-marks-sta", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Follow Through", objective: "Track explicit operator follow-through decisions." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "follow-gap",
      summary: "Need explicit operator handling.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the follow-through gap."],
    unresolvedConcernIds: ["follow-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });

  const meta = queryMetaOptimize(root);
  const topPack = meta.remediationPacks.packs[0];
  const allowedActorRole = topPack.packetPointers?.[0]?.assignedRole ?? topPack.conversionHints?.[0]?.assignedRole ?? "planner";
  assert.ok(topPack);

  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
    version: 1,
    items: [{
      id: "task-follow-through",
      title: "Follow-through execution task",
      status: "pending",
      lifecycleStatus: "waiting",
      assignedRole: "planner",
      phase: "research",
      nextAction: "Take the top remediation pack into execution.",
      packetPath: ".dove/task-packets/packets/task-follow-through.json",
      packetContextPath: ".dove/context/packets/task-follow-through.json"
    }],
    clusterMembership: {},
    dependencyMap: {},
    summary: {
      itemCount: 1,
      staleCount: 0,
      reviewNeededCount: 0,
      handoffReadyCount: 0,
      rootPacketIds: ["task-follow-through"],
      topPacketIds: ["task-follow-through"]
    },
    updatedAt: null
  });
  writeJson(root, ".dove/task-packets/packets/task-follow-through.json", {
    id: "task-follow-through",
    title: "Follow-through execution task",
    status: "pending"
  });

  recordOperatorFollowThrough(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    status: "accepted-for-execution",
    actorRole: "planner",
    decisionSummary: "Promote top remediation pack into manual execution.",
    selectedConversionPathKey: topPack.rankedConversionPaths?.[0]?.deterministicKey ?? null,
    linkedTargetArtifact: ".dove/task-packets/packets/task-follow-through.json",
    linkedTargetId: "task-follow-through",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  let followThrough = queryOperatorFollowThrough(root);
  assert.equal(followThrough.summary.acceptedForExecutionCount, 1);
  assert.equal(followThrough.summary.staleCount, 0);
  assert.equal(followThrough.items[0].sourceType, "remediation-pack");
  assert.equal(followThrough.items[0].linkedTargetArtifact, ".dove/task-packets/packets/task-follow-through.json");

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "follow-gap",
      summary: "Need explicit operator handling after source change.",
      severity: "critical",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 3,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });

  followThrough = queryOperatorFollowThrough(root);
  assert.equal(followThrough.summary.staleCount, 1);
  assert.equal(followThrough.items[0].stale, true);
  assert.equal(followThrough.summary.topSourceIds.includes(topPack.id), true);

  const followThroughPath = path.join(root, ARTIFACT_PATHS.metaOperatorFollowThrough);
  const rawLedger = JSON.parse(fs.readFileSync(followThroughPath, "utf8"));
  rawLedger.items[0].status = "totally-invalid";
  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, rawLedger);

  followThrough = queryOperatorFollowThrough(root);
  assert.equal(followThrough.summary.invalidStatusCount, 1);
  assert.equal(followThrough.items[0].invalidStatus, true);

  assert.throws(() => {
    recordOperatorFollowThrough(root, {
      sourceType: "remediation-pack",
      sourceId: topPack.id,
      status: "not-a-real-status",
      actorRole: "planner"
    });
  }, /Public follow-through status must be one of/);

  assert.throws(() => {
    recordOperatorFollowThrough(root, {
      sourceType: "remediation-pack",
      sourceId: topPack.id,
      status: "accepted-for-execution",
      actorRole: "reviewer",
      linkedTargetArtifact: ".dove/task-packets/packets/task-follow-through.json",
      linkedTargetId: "task-follow-through",
      executeBy: "2099-01-01T00:00:00.000Z",
      reviewAfter: "2099-01-01T12:00:00.000Z"
    });
  }, /not allowed/);

  assert.throws(() => {
    recordOperatorFollowThrough(root, {
      sourceType: "remediation-pack",
      sourceId: topPack.id,
      status: "accepted-for-execution",
      actorRole: "planner",
      linkedTargetArtifact: ".dove/task-packets/packets/task-follow-through.json",
      linkedTargetId: "missing-target",
      executeBy: "2099-01-01T00:00:00.000Z",
      reviewAfter: "2099-01-01T12:00:00.000Z"
    });
  }, /was not found/);

  const privilegedFieldCases = [
    { status: "executing" },
    { status: "closed" },
    { status: "superseded" },
    { programId: "spoofed-program" },
    { programRunId: "spoofed-program-run" },
    { approvalId: "spoofed-approval" },
    { retryState: { attemptCount: 2 } },
    { executionStartedAt: new Date(0).toISOString() },
    { executionCompletedAt: new Date(0).toISOString() },
    { recordedAt: new Date(0).toISOString() }
  ];
  const ledgerBeforePrivilegedCalls = fs.readFileSync(
    followThroughPath,
    "utf8"
  );
  for (const privilegedInput of privilegedFieldCases) {
    assert.throws(() => {
      recordOperatorFollowThrough(root, {
        sourceType: "remediation-pack",
        sourceId: topPack.id,
        status: "accepted-for-execution",
        actorRole: allowedActorRole,
        linkedTargetArtifact: ".dove/task-packets/packets/task-follow-through.json",
        linkedTargetId: "task-follow-through",
        executeBy: "2099-01-01T00:00:00.000Z",
        reviewAfter: "2099-01-01T12:00:00.000Z",
        ...privilegedInput
      });
    }, /Public follow-through status must be one of|do not accept system-owned or unknown fields/);
    assert.equal(
      fs.readFileSync(followThroughPath, "utf8"),
      ledgerBeforePrivilegedCalls
    );
  }

  fs.rmSync(path.join(root, ".dove/task-packets/packets/task-follow-through.json"), { force: true });
  followThrough = queryOperatorFollowThrough(root);
  assert.equal(followThrough.summary.itemCount > 0, true);
  });
});

test("follow-through record identity cannot splice source or target across records", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "follow-through-record-identity-cannot-splice-source-or-target-across-rec", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Follow-through Identity", objective: "Keep source and target bound to one durable record." });
  const { remediationPack, executionBridgeCandidate } = seedAutonomyGuidance(root);
  seedTaskPacket(root, "task-follow-through-identity-a", { title: "Identity target A", status: "pending" });
  seedTaskPacket(root, "task-follow-through-identity-b", { title: "Identity target B", status: "pending" });

  const recordId = "follow-through-identity";
  recordOperatorFollowThrough(root, {
    id: recordId,
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    status: "accepted-for-execution",
    actorRole: "planner",
    linkedTargetArtifact: ".dove/task-packets/packets/task-follow-through-identity-a.json",
    linkedTargetId: "task-follow-through-identity-a",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  assert.throws(() => recordOperatorFollowThrough(root, {
    id: recordId,
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    status: "accepted-for-execution",
    actorRole: "planner",
    linkedTargetArtifact: ".dove/task-packets/packets/task-follow-through-identity-b.json",
    linkedTargetId: "task-follow-through-identity-b",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }), /cannot change target/);

  assert.ok(executionBridgeCandidate);
  assert.throws(() => recordOperatorFollowThrough(root, {
    id: recordId,
    sourceType: "execution-bridge",
    sourceId: executionBridgeCandidate.id,
    status: "accepted-for-execution",
    actorRole: "planner",
    linkedTargetArtifact: ".dove/task-packets/packets/task-follow-through-identity-a.json",
    linkedTargetId: "task-follow-through-identity-a",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }), /cannot change source/);
  });
});

test("unverifiable follow-through sources fail closed instead of trusting stale record or caller metadata", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "unverifiable-follow-through-sources-fail-closed-instead-of-trusting-stal", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Follow-through Source Trust", objective: "Reject caller-authored source authorization." });
  seedTaskPacket(root, "task-unverifiable-source", { title: "Unverifiable source target", status: "pending" });
  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, {
    version: 1,
    proposalOnly: true,
    explicitOnly: true,
    items: [{
      id: "follow-through-unverifiable-source",
      sourceType: "remediation-pack",
      sourceId: "missing-source",
      sourceArtifactPath: ARTIFACT_PATHS.metaRemediationPacks,
      sourceFingerprint: "stale-fingerprint",
      sourceTitle: "Missing source",
      sourceSummary: "No current catalog entry exists.",
      status: "accepted-for-execution",
      actorRole: "planner",
      workerRole: "researcher",
      linkedTargetArtifact: ".dove/task-packets/packets/task-unverifiable-source.json",
      linkedTargetId: "task-unverifiable-source",
      executeBy: "2099-01-01T00:00:00.000Z",
      reviewAfter: "2099-01-01T12:00:00.000Z",
      recordedAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });

  const before = fs.readFileSync(
    path.join(
      root,
      ARTIFACT_PATHS.metaOperatorFollowThrough
    ),
    "utf8"
  );
  assert.throws(() => recordOperatorFollowThrough(root, {
    id: "follow-through-unverifiable-source",
    sourceType: "remediation-pack",
    sourceId: "missing-source",
    sourceArtifactPath: ARTIFACT_PATHS.metaRemediationPacks,
    sourceFingerprint: "caller-fingerprint",
    sourceAllowedActorRoles: ["planner", "researcher"],
    status: "executing",
    actorRole: "planner",
    workerRole: "researcher",
    linkedTargetArtifact: ".dove/task-packets/packets/task-unverifiable-source.json",
    linkedTargetId: "task-unverifiable-source",
    executionStartedAt: new Date().toISOString()
  }), /do not accept system-owned or unknown fields/);
  assert.equal(
    fs.readFileSync(
      path.join(
        root,
        ARTIFACT_PATHS.metaOperatorFollowThrough
      ),
      "utf8"
    ),
    before
  );
  });
});

test("queryOperatorFollowThrough summarizes combined deferred, stale, and invalid follow-through debt", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "queryoperatorfollowthrough-summarizes-combined-deferred-stale-and-invali", () => {
  ensureTestWorkspace(root);
  const now = new Date().toISOString();
  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, {
    version: 1,
    proposalOnly: true,
    explicitOnly: true,
    items: [
      {
        id: "ft-deferred",
        sourceType: "remediation-pack",
        sourceId: "pack-a",
        sourceArtifactPath: ARTIFACT_PATHS.metaRemediationPacks,
        sourceFingerprint: "a",
        sourceTitle: "A",
        sourceSummary: "A",
        status: "deferred",
        actorRole: "planner",
        deferUntil: "2000-01-01T00:00:00.000Z",
        recordedAt: now,
        updatedAt: now
      },
      {
        id: "ft-invalid",
        sourceType: "operator-playbook",
        sourceId: "playbook-a",
        sourceArtifactPath: ARTIFACT_PATHS.metaOperatorPlaybooks,
        sourceFingerprint: "b",
        sourceTitle: "B",
        sourceSummary: "B",
        status: "not-real",
        actorRole: "planner",
        recordedAt: now,
        updatedAt: now
      },
      {
        id: "ft-overdue",
        sourceType: "remediation-pack",
        sourceId: "pack-b",
        sourceArtifactPath: ARTIFACT_PATHS.metaRemediationPacks,
        sourceFingerprint: "c",
        sourceTitle: "C",
        sourceSummary: "C",
        status: "accepted-for-execution",
        actorRole: "planner",
        linkedTargetArtifact: ".dove/task-packets/packets/task-overdue.json",
        linkedTargetId: "task-overdue",
        executeBy: "2000-01-01T00:00:00.000Z",
        reviewAfter: "2000-01-01T12:00:00.000Z",
        recordedAt: now,
        updatedAt: now
      }
    ],
    summary: { itemCount: 2 },
    updatedAt: now
  });

  const followThrough = queryOperatorFollowThrough(root);
  assert.equal(followThrough.summary.itemCount, 3);
  assert.equal(followThrough.summary.dueDeferredCount, 1);
  assert.equal(followThrough.summary.dueReviewCount, 1);
  assert.equal(followThrough.summary.invalidStatusCount, 1);
  assert.equal(followThrough.summary.overdueExecutionCount, 1);
  assert.equal(followThrough.summary.criticalOverdueExecutionCount, 1);
  assert.equal(Array.isArray(followThrough.summary.overdueExecutionIds), true);
  assert.equal(followThrough.summary.actionRequiredCount >= 3, true);
  });
});

test("executing follow-through remains a valid governed state across query and write guards", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "executing-follow-through-remains-a-valid-governed-state-across-query-and", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Executing State", objective: "Keep executing state consistent across governance surfaces." });

  seedTaskPacket(root, "task-executing", {
    title: "Executing task",
    status: "in-progress",
    lifecycleStatus: "in-progress"
  });

  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, {
    version: 1,
    proposalOnly: true,
    explicitOnly: true,
    items: [{
      id: "follow-through-executing",
      sourceType: "remediation-pack",
      sourceId: "executing-pack",
      sourceArtifactPath: ARTIFACT_PATHS.metaRemediationPacks,
      sourceFingerprint: "executing-fingerprint",
      sourceTitle: "Executing pack",
      sourceSummary: "Executing pack summary",
      status: "executing",
      actorRole: "planner",
      linkedTargetArtifact: ".dove/task-packets/packets/task-executing.json",
      linkedTargetId: "task-executing",
      executeBy: "2099-01-01T00:00:00.000Z",
      reviewAfter: "2099-01-01T12:00:00.000Z",
      executionStartedAt: "2098-12-31T23:00:00.000Z",
      recordedAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    }],
    summary: { itemCount: 1 },
    updatedAt: null
  });

  const followThrough = queryOperatorFollowThrough(root);
  assert.equal(followThrough.items[0].status, "executing");
  assert.equal(followThrough.items[0].invalidStatus, false);

  assert.throws(() => upsertPlan(root, { thesis: "blocked by executing state" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => upsertOrchestrationBoard(root, { phase: "review" }), /operator follow-through still requires action|Cannot advance orchestration from|requires routing role reviewer for phase review/);
  const doctor = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorFollowThrough), "utf8"));
  assert.equal(Array.isArray(doctor.items), true);
  });
});

test("public note and wiki APIs ignore spoofed third-argument governance context", async () => {
  const publicCore = await import("../../src/core/internal-api.mjs");
  assert.equal(Object.hasOwn(publicCore, "VALIDATED_RUNTIME_ARTIFACT_CAPABILITY"), false);
  assert.equal(Object.hasOwn(publicCore, "VALIDATED_RUNTIME_REVIEW_CAPABILITY"), false);
  assert.equal(Object.hasOwn(publicCore, "upsertNoteFromValidatedRuntime"), false);
  assert.equal(Object.hasOwn(publicCore, "refreshWikiFromValidatedRuntime"), false);

  const packageRoot = process.cwd();
  for (const subpath of [
    "dove/src/core/runtime-artifact-capability.mjs",
    "dove/src/core/artifacts.mjs",
    "dove/src/core/reviews.mjs",
    "dove/src/core/orchestration.mjs"
  ]) {
    const imported = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", `await import(${JSON.stringify(subpath)})`],
      { cwd: packageRoot, encoding: "utf8" }
    );
    assert.notEqual(imported.status, 0, `${subpath} must remain outside the package export boundary`);
    assert.match(`${imported.stderr}\n${imported.stdout}`, /ERR_PACKAGE_PATH_NOT_EXPORTED/u);
  }

  const root = tempRoot();

  return runFixtureMutation(root, "public-note-and-wiki-apis-ignore-spoofed-third-argument-governance-conte", async () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Public Context Spoof", objective: "Keep public artifact writes behind follow-through governance." });
  const packetId = seedTaskPacket(root, "task-public-context-spoof");
  const sourceId = registerSource(root, {
    packetId,
    sourceId: "public-context-source",
    citationKey: "public-context-source",
    title: "Public context source"
  }).id;
  const phaseBefore = readState(root).pipeline.currentStage;

  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, {
    version: 1,
    proposalOnly: true,
    explicitOnly: true,
    items: [{
      id: "follow-through-public-context-spoof",
      sourceType: "remediation-pack",
      sourceId: "public-context-pack",
      sourceArtifactPath: ARTIFACT_PATHS.metaRemediationPacks,
      sourceFingerprint: "public-context-fingerprint",
      sourceTitle: "Public context pack",
      sourceSummary: "Keep the public APIs gated.",
      status: "executing",
      actorRole: "planner",
      linkedTargetArtifact: `.dove/task-packets/packets/${packetId}.json`,
      linkedTargetId: packetId,
      executeBy: "2099-01-01T00:00:00.000Z",
      reviewAfter: "2099-01-01T12:00:00.000Z",
      executionStartedAt: new Date(0).toISOString(),
      recordedAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    }],
    summary: { itemCount: 1 },
    updatedAt: null
  });

  const spoofedContext = {
    skipFollowThroughReady: true,
    skipSyncPhase: true
  };
  assert.throws(() => upsertNote(root, {
    packetId,
    noteId: "spoofed-public-note",
    title: "Spoofed public note",
    sectionId: "introduction",
    sourceIds: [sourceId],
    summary: "This public call must remain gated."
  }, spoofedContext), /blocked while operator follow-through still requires action/);
  assert.throws(() => refreshWiki(root, {}, spoofedContext), /blocked while operator follow-through still requires action/);

  const notes = readJson(root, ARTIFACT_PATHS.notes, { items: [] });
  assert.equal((notes.items ?? []).some((item) => item.id === "spoofed-public-note"), false);
  assert.equal(readState(root).pipeline.currentStage, phaseBefore);

  });
});

test("queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "querymetaoptimize-exposes-governance-coverage-and-guarded-write-paths-re", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Governance Coverage", objective: "Audit guarded mutation coverage." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "coverage-gap",
      summary: "Coverage debt should block key writes.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the governance coverage gap."],
    unresolvedConcernIds: ["coverage-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });

  const meta = queryMetaOptimize(root);
  const governanceCoveragePath = meta.governanceCoverage.coveragePath ?? meta.governanceCoverage.summary?.coveragePath;
  assert.equal(typeof governanceCoveragePath, "string");
  assert.equal(governanceCoveragePath, ARTIFACT_PATHS.metaGovernanceCoverage);
  assert.equal(meta.governanceCoverageReport.summary.reportPath, ARTIFACT_PATHS.metaGovernanceCoverageReport);
  assert.equal(meta.governanceCoverageReport.summary.markdownPath, ARTIFACT_PATHS.metaGovernanceCoverageReportMarkdown);
  assert.equal(typeof meta.governanceCoverageReport.summary.staleReviewCount, "number");
  assert.equal(typeof meta.governanceCoverageReport.summary.expiringSoonCount, "number");
  const guardedIds = new Set(meta.governanceCoverage.guardedMutations.map((item) => item.id));
  for (const required of ["upsert-orchestration-board", "append-handoff", "upsert-plan", "append-review-log", "update-research-brief", "upsert-experiment-plan", "run-experiment-audit", "upsert-claims", "bridge-experiment-result-to-claim", "compare-versions"]) {
    assert.equal(guardedIds.has(required), true);
  }
  const claimBridgeCoverage = meta.governanceCoverage.guardedMutations.find((item) => item.id === "bridge-experiment-result-to-claim");
  assert.equal(claimBridgeCoverage.surfaceBindings.coreFunction, "bridgeExperimentResultToClaim");
  assert.equal(claimBridgeCoverage.surfaceBindings.mcpTool, "bridge_result_to_claim");
  assert.equal(claimBridgeCoverage.surfaceBindings.commandIds.includes("dove.experience"), true);
  const followThroughExempt = meta.governanceCoverage.exemptMutations.find((item) => item.id === "record-operator-follow-through");
  assert.equal(followThroughExempt.surfaceBindings.mcpTool, "record_operator_follow_through");
  assert.deepEqual(followThroughExempt.surfaceBindings.commandIds ?? [], []);
  const lessonExempt = meta.governanceCoverage.exemptMutations.find((item) => item.id === "record-operator-lesson");
  assert.equal(lessonExempt.surfaceBindings.coreFunction, "recordOperatorLesson");
  assert.equal(lessonExempt.surfaceBindings.mcpTool, "record_operator_lesson");
  assert.equal(lessonExempt.surfaceBindings.commandIds.includes("dove.lessons"), true);
  assert.equal(lessonExempt.reasonCode, "retrospective-bookkeeping");
  assert.equal(typeof followThroughExempt.ownerRole, "string");
  assert.equal(typeof followThroughExempt.approvedByRole, "string");
  assert.equal(typeof followThroughExempt.approvedAt, "string");
  assert.equal(typeof followThroughExempt.lastReviewedAt, "string");
  assert.equal(typeof followThroughExempt.reasonCode, "string");
  assert.equal(typeof followThroughExempt.reviewCadence, "string");
  assert.equal(typeof followThroughExempt.sunsetAt, "string");
  const guardedCoreFunctions = new Set(meta.governanceCoverage.guardedMutations.map((item) => item.surfaceBindings.coreFunction));
  for (const requiredCore of ["upsertOrchestrationBoard", "upsertClaims", "appendReviewLog", "runExperimentAudit", "bridgeExperimentResultToClaim", "compareVersions"]) {
    assert.equal(guardedCoreFunctions.has(requiredCore), true);
  }
  const exemptCoreFunctions = new Set(meta.governanceCoverage.exemptMutations.map((item) => item.surfaceBindings.coreFunction));
  assert.equal(exemptCoreFunctions.has("recordOperatorFollowThrough"), true);
  assert.equal(exemptCoreFunctions.has("recordOperatorLesson"), true);
  assert.equal(exemptCoreFunctions.has("queryMetaOptimize"), true);

  const topPack = meta.remediationPacks.packs[0];
  seedTaskPacket(root, "task-coverage", { title: "Coverage task", status: "pending" });
  recordOperatorFollowThrough(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    status: "accepted-for-execution",
    actorRole: "planner",
    decisionSummary: "Take coverage pack into execution.",
    selectedConversionPathKey: topPack.rankedConversionPaths?.[0]?.deterministicKey ?? null,
    linkedTargetArtifact: ".dove/task-packets/packets/task-coverage.json",
    linkedTargetId: "task-coverage",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  assert.throws(() => upsertPlan(root, { thesis: "blocked plan" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => upsertClaims(root, {
    claims: [{ id: "claim-blocked", text: "blocked", sectionId: "introduction", sourceIds: ["known-source"] }]
  }), /blocked while operator follow-through still requires action/);
  assert.throws(() => updateResearchBrief(root, { objective: "blocked brief" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => upsertExperimentPlan(root, { id: "blocked-exp", title: "Blocked experiment", methodology: "Method" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => appendReviewLog(root, { actorRole: "reviewer", stage: "blocked", summary: "blocked", findings: [], actionItems: [] }), /blocked while operator follow-through still requires action/);
  assert.throws(() => upsertExperimentResult(root, { id: "blocked-result", experimentId: "blocked-exp", outcome: "supports" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => runExperimentAudit(root, { experimentId: "blocked-exp" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => normalizeRebuttalIssues(root, { issues: [] }), /blocked while operator follow-through still requires action/);
  assert.throws(() => buildRebuttalStrategy(root, {}), /blocked while operator follow-through still requires action/);
  assert.throws(() => createVersionSnapshot(root, { versionId: "guard-v1" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => compareVersions(root, { fromVersionId: "guard-v1", toVersionId: "guard-v2" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => runReviewLoop(root, { actorRole: "reviewer" }), /blocked while operator follow-through still requires action/);
  assert.throws(() => bridgeExperimentResultToClaim(root, { resultId: "blocked-result" }), /blocked while operator follow-through still requires action/);
  });
});

test("recordOperatorLesson stays explicit, advisory, and disconnected from work execution", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "recordoperatorlesson-stays-explicit-advisory-and-disconnected-from-work-", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Lessons Hardening", objective: "Record a distilled lesson without launching work." });

  const result = recordOperatorLesson(root, {
    title: "Close tasks with distilled lessons",
    problem: "Operators need reusable experience without raw runtime traces.",
    decisions: ["Capture decisions manually."],
    pitfalls: ["Do not cite .trellis/tasks traces."],
    validation: ["Query lessons after recording."],
    nextTime: ["Record the retrospective during return."],
    domain: "engineering",
    stage: "return",
    actorRole: "planner",
    tags: ["hardening", "retrospective"],
    sourceArtifacts: [ARTIFACT_PATHS.sessionSummary]
  });

  assert.equal(result.explicitOnly, true);
  assert.equal(result.noAutoCapture, true);
  assert.equal(result.noAutoApply, true);
  assert.equal(result.summary.activeLessonCount, 1);
  assert.equal(result.recordedLesson.sourceArtifacts.includes(ARTIFACT_PATHS.sessionSummary), true);

  const lessons = queryOperatorLessons(root, { tag: "hardening" });
  assert.equal(lessons.resultCount, 1);
  assert.equal(lessons.lessons[0].title, "Close tasks with distilled lessons");

  assert.throws(() => recordOperatorLesson(root, {
    title: "Bad source",
    problem: "Raw traces must stay ignored.",
    decisions: ["Reject trace source artifacts."],
    pitfalls: ["Raw runtime logs are not reusable lessons."],
    validation: ["Recording fails."],
    nextTime: ["Use durable Dove summaries."],
    sourceArtifacts: [".trellis/tasks/example/task.json"]
  }), /\.trellis\/tasks/);

  const packets = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, {});
  const approvals = queryProgramApprovals(root);
  const campaigns = queryCampaigns(root);
  const executionBridgeCandidates = readJson(root, ARTIFACT_PATHS.metaExecutionBridgeCandidates, createMetaExecutionBridgeCandidatesIndex);
  const controllerState = readJson(root, ARTIFACT_PATHS.runtimeControllerState, {});
  assert.deepEqual(packets.items, []);
  assert.equal(approvals.summary.approvalCount, 0);
  assert.equal(campaigns.summary.campaignCount, 0);
  assert.deepEqual(executionBridgeCandidates.candidates, []);
  assert.equal(controllerState.lastRun, null);
  assert.equal(controllerState.summary.lastStatus, "never-run");
  assert.equal(fs.existsSync(path.join(root, ".trellis", "tasks")), false);
  });
});

test("governance registry completely binds the expected mutating command and MCP surfaces", () => {
  const toolNames = new Set(toolDefinitions.map((tool) => tool.name));
  const commandDir = path.join(process.cwd(), ".opencode", "commands");
  const registry = [...GOVERNANCE_GUARDED_MUTATIONS, ...GOVERNANCE_EXEMPT_MUTATIONS];
  const boundTools = new Set(registry.map((entry) => entry.surfaceBindings?.mcpTool).filter(Boolean));
  const boundCommands = new Set(registry.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []));

  const expectedMutatingTools = [
    "init_dove_goal",
    "create_dove_task",
    "run_dove_auto",
    "kill_dove_task",
    "apply_dove_status_adjustments",
    "run_dove_operator",
    "reset_dove_version",
    "run_experience_workflow",
    "prepare_audio_review",
    "import_audio_review",
    "run_audio_review",
    "run_dove_review_loop",
    "upsert_orchestration_board",
    "append_handoff",
    "update_research_brief",
    "register_source",
    "upsert_note",
    "upsert_claims",
    "upsert_plan",
    "upsert_outline",
    "upsert_draft",
    "set_section_status",
    "upsert_experiment_plan",
    "upsert_experiment_result",
    "run_experiment_audit",
    "bridge_result_to_claim",
    "run_review_loop",
    "append_review_log",
    "prepare_isolated_review",
    "import_isolated_review",
    "upsert_revision_plan",
    "sync_checklist",
    "sync_citations",
    "refresh_wiki",
    "normalize_rebuttal_issues",
    "build_rebuttal_strategy",
    "build_rebuttal",
    "create_version_snapshot",
    "compare_versions",
    "upsert_figure_plan",
    "run_figure_workflow",
    "prepare_figure_generation",
    "import_figure_generation",
    "validate_figure_pipeline",
    "record_operator_lesson",
    "record_operator_follow_through",
    "query_meta_optimize",
    "publish_dove_status",
    "publish_dove_global_status",
    "plan_campaign",
    "materialize_guidance_packet",
    "launch_dove_mission",
    "revoke_program_approval"
  ];
  for (const toolName of expectedMutatingTools) {
    assert.equal(boundTools.has(toolName), true);
    assert.equal(toolNames.has(toolName), true);
  }

  const expectedMutatingCommands = [
    "dove.init",
    "dove.mission",
    "dove.auto",
    "dove.status",
    "dove.operator",
    "dove.lessons",
    "dove.version",
    "dove.source",
    "dove.note",
    "dove.figure",
    "dove.experience",
    "dove.draft",
    "dove.review",
    "dove.review-loop",
    "dove.rebuttal"
  ];
  for (const commandId of expectedMutatingCommands) {
    assert.equal(boundCommands.has(commandId), true);
    assert.equal(fs.existsSync(path.join(commandDir, `${commandId}.md`)), true);
  }

  const removedCommandIds = [
    "dove.orchestrate",
    "dove.plan",
    "dove.checklist",
    "dove.audit",
    "dove.autonomy-operate",
    "dove.return",
    "dove.follow-through",
    "dove.governance-audit",
    "dove.onboard",
    "dove.launch",
    "dove.approvals",
    "dove.kill",
    "dove.paper.init",
    "dove.paper.source",
    "dove.paper.note",
    "dove.paper.research",
    "dove.paper.outline",
    "dove.paper.draft",
    "dove.paper.experiment",
    "dove.paper.claim-gate",
    "dove.paper.result-bridge",
    "dove.paper.figure",
    "dove.paper.audit",
    "dove.paper.review",
    "dove.paper.isolated-review",
    "dove.paper.revise",
    "dove.paper.rebuttal",
    "dove.paper.version",
    "dove.paper.citations",
    "dove.paper.meta-optimize",
    "dove.paper.pipeline",
    "dove.paper.review-loop",
    "dove.paper.rebuttal-strategy",
    "dove.paper.version-snapshot",
    "dove.paper.version-compare",
    "dove.paper.open-questions",
    "dove.paper.decisions",
    "dove.paper.lineage",
    "dove.paper.wiki"
  ];
  for (const removedCommandId of removedCommandIds) {
    assert.equal(boundCommands.has(removedCommandId), false);
    assert.equal(GOVERNANCE_READONLY_COMMANDS.includes(removedCommandId), false);
    assert.equal(fs.existsSync(path.join(commandDir, `${removedCommandId}.md`)), false);
  }

  assert.equal(boundCommands.has("dove.mission"), true);
  assert.equal(boundCommands.has("dove.auto"), true);
  assert.equal(boundCommands.has("dove.status"), true);
  assert.equal(boundCommands.has("dove.operator"), true);
  assert.equal(GOVERNANCE_READONLY_COMMANDS.includes("dove.mission"), false);
  assert.equal(GOVERNANCE_READONLY_COMMANDS.includes("dove.auto"), false);
  assert.equal(GOVERNANCE_READONLY_COMMANDS.includes("dove.status"), false);
  assert.equal(GOVERNANCE_READONLY_TOOLS.includes("query_dove_orchestrate"), true);
  assert.equal(GOVERNANCE_READONLY_TOOLS.includes("query_dove_status"), true);
  assert.equal(GOVERNANCE_READONLY_TOOLS.includes("query_dove_audit"), true);
  assert.equal(GOVERNANCE_READONLY_TOOLS.includes("query_operator_lessons"), true);
  assert.equal(GOVERNANCE_READONLY_TOOLS.includes("query_document_ledger"), true);
  for (const publicCommandId of ["dove.init", "dove.mission", "dove.auto", "dove.status", "dove.operator", "dove.lessons", "dove.version", "dove.source", "dove.note", "dove.figure", "dove.experience", "dove.draft", "dove.review", "dove.review-loop", "dove.rebuttal"]) {
    assert.equal(fs.existsSync(path.join(commandDir, `${publicCommandId}.md`)), true);
  }
});

test("a broader set of guarded write paths all reject unresolved follow-through debt", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "a-broader-set-of-guarded-write-paths-all-reject-unresolved-follow-throug", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Guard Matrix", objective: "Verify broader guarded write coverage." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "guard-matrix-gap",
      summary: "Guard matrix debt should block multiple write paths.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the guard matrix gap."],
    unresolvedConcernIds: ["guard-matrix-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });

  const topPack = queryMetaOptimize(root).remediationPacks.packs[0];
  seedTaskPacket(root, "task-guard-matrix", { title: "Guard matrix task", status: "pending" });
  recordOperatorFollowThrough(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    status: "accepted-for-execution",
    actorRole: "planner",
    decisionSummary: "Take this remediation pack into execution.",
    selectedConversionPathKey: topPack.rankedConversionPaths?.[0]?.deterministicKey ?? null,
    linkedTargetArtifact: ".dove/task-packets/packets/task-guard-matrix.json",
    linkedTargetId: "task-guard-matrix",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const guardedCalls = [
    () => upsertOrchestrationBoard(root, { phase: "review", assignedRole: "reviewer" }),
    () => appendHandoff(root, { fromRole: "researcher", toRole: "reviewer", summary: "Blocked handoff" }),
    () => registerSource(root, { title: "Blocked source" }),
    () => upsertNote(root, { title: "Blocked note", sectionId: "introduction" }),
    () => upsertPlan(root, { thesis: "Blocked plan" }),
    () => upsertOutline(root, { sections: [{ id: "intro", title: "Introduction" }] }),
    () => upsertDraft(root, { sectionId: "intro", body: "# Intro" }),
    () => setSectionStatus(root, { sectionId: "intro", status: "drafting" }),
    () => upsertFigurePlan(root, { items: [] }),
    () => prepareFigureGeneration(root, { figureId: "blocked-figure" }),
    () => importFigureGeneration(root, { figureId: "blocked-figure", runId: "blocked-run" }),
    () => updateResearchBrief(root, { objective: "Blocked brief" }),
    () => upsertExperimentPlan(root, { id: "guard-exp", title: "Guard experiment", methodology: "Method" }),
    () => upsertExperimentResult(root, { id: "guard-result", experimentId: "guard-exp", outcome: "supports" }),
    () => runExperimentAudit(root, { experimentId: "guard-exp" }),
    () => bridgeExperimentResultToClaim(root, { resultId: "guard-result" }),
    () => appendReviewLog(root, { actorRole: "reviewer", stage: "blocked", summary: "blocked", findings: [], actionItems: [] }),
    () => upsertRevisionPlan(root, { summary: "Blocked revision", items: ["One"] }),
    () => syncCitations(root, {}),
    () => refreshWiki(root),
    () => buildRebuttal(root),
    () => normalizeRebuttalIssues(root, { issues: [] }),
    () => buildRebuttalStrategy(root, {}),
    () => runReviewLoop(root, { actorRole: "reviewer" }),
    () => createVersionSnapshot(root, { versionId: "guard-v1" }),
    () => compareVersions(root, { fromVersionId: "guard-v1", toVersionId: "guard-v2" })
  ];

  for (const call of guardedCalls) {
    assert.throws(call, /blocked while operator follow-through still requires action|Cannot advance orchestration from|requires routing role planner for phase init|cannot transfer board ownership|cannot claim or transfer board ownership/);
  }
  });
});

test("legacy policy override fields fail closed and cannot bypass follow-through governance", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "legacy-policy-override-fields-fail-closed-and-cannot-bypass-follow-throu", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Override Guard", objective: "Validate override semantics." });

  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{ id: "override-gap", summary: "Need explicit handling.", severity: "high", status: "open", responseOwnerRole: "planner", recurrenceCount: 1, linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog], updatedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close override gap."],
    unresolvedConcernIds: ["override-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });
  upsertSystemOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "researcher",
    intentType: "advance-paper",
    currentFocus: "Resolve override-gap governance debt.",
    nextAction: "Inspect the remediation frontier before creating new work.",
    tasks: [{
      id: "override-stale-task",
      title: "Override stale task",
      assignedRole: "researcher",
      status: "in-progress",
      lifecycleStatus: "stale",
      nextAction: "Move this stale task into explicit remediation handling.",
      evidenceLinks: [],
      outputPaths: []
    }]
  });
  const topPack = queryMetaOptimize(root).remediationPacks.packs[0];
  const currentState = readState(root);
  const currentBoard = currentState.orchestrationBoard;
  const allowedActorRole = currentBoard?.assignedRole ?? "planner";
  seedTaskPacket(root, "task-override", { title: "Override task", status: "pending" });
  recordOperatorFollowThrough(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    status: "accepted-for-execution",
    actorRole: allowedActorRole,
    decisionSummary: "Take this remediation pack into execution.",
    selectedConversionPathKey: topPack.rankedConversionPaths?.[0]?.deterministicKey ?? null,
    linkedTargetArtifact: ".dove/task-packets/packets/task-override.json",
    linkedTargetId: "task-override",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const overrideAttempts = [
    { policyOverrideReason: "manual" },
    { policyOverrideReasonCode: "manual-reconciliation" },
    { policyOverrideEvidencePaths: [ARTIFACT_PATHS.metaRemediationPacks] },
    { policyOverrideSourceId: topPack.id },
    { policyOverrideTargetArtifact: ".dove/task-packets/packets/task-override.json" },
    { policyOverrideTargetId: "task-override" },
    { policyOverridePhase: "research" },
    { policyOverrideExpiresAt: "2099-01-02T00:00:00.000Z" }
  ];
  for (const legacyFields of overrideAttempts) {
    assert.throws(() => upsertPlan(root, {
      thesis: "legacy override must fail closed",
      packetId: "task-override",
      actorRole: allowedActorRole,
      ...legacyFields
    }), /does not accept retired policy override fields/);
  }

  });
});

test("materializeGuidancePacket creates a durable packet from accepted remediation guidance and binds follow-through", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "materializeguidancepacket-creates-a-durable-packet-from-accepted-remedia", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Materialize Guidance", objective: "Convert accepted guidance into a real task packet." });
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "materialize-gap",
      summary: "Need an explicit packet materialization bridge.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the materialization gap."],
    unresolvedConcernIds: ["materialize-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });

  const topPack = queryMetaOptimize(root).remediationPacks.packs[0];
  const actorRole = topPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";
  const result = materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    actorRole,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  assert.equal(result.status, "materialized");
  const packet = readJson(root, result.packetPath, null);
  assert.equal(packet.sourceType, "materialized-guidance");
  assert.equal(packet.materialization.sourceType, "remediation-pack");
  assert.equal(packet.materialization.sourceId, topPack.id);
  assert.equal(packet.materialization.followThroughId.startsWith("follow-through-"), true);

  const packetIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, null);
  assert.equal(packetIndex.items.some((item) => item.id === result.packetId), true);

  const followThrough = queryOperatorFollowThrough(root);
  const record = followThrough.items.find((item) => item.sourceType === "remediation-pack" && item.sourceId === topPack.id);
  assert.equal(record.status, "accepted-for-execution");
  assert.equal(record.linkedTargetArtifact, result.packetPath);
  assert.equal(record.linkedTargetId, result.packetId);

  const workspaceIndex = queryWorkspaceIndex(root);
  const activePacket = workspaceIndex.activePackets.find((item) => item.id === result.packetId);
  assert.equal(activePacket.materializedFrom, `remediation-pack:${topPack.id}`);

  const navigation = fs.readFileSync(path.join(root, ARTIFACT_PATHS.navigationReport), "utf8");
  assert.match(navigation, new RegExp(`materialized-from=remediation-pack:${topPack.id}`));

  assert.throws(() => materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    actorRole,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }), /duplicate work/);
  });
});

test("materializeGuidancePacket validates follow-through identity before writing packet state", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "materializeguidancepacket-validates-follow-through-identity-before-writi", () => {
  ensureTestWorkspace(root);
  initProject(root, {
    title: "Atomic materialization",
    objective: "Reject immutable follow-through target conflicts without partial packet writes."
  });
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "atomic-materialization-gap",
      summary: "Need atomic guidance materialization.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the atomic materialization gap."],
    unresolvedConcernIds: ["atomic-materialization-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: {
      reviewerRole: "reviewer",
      responseOwnerRoles: ["planner"],
      separationMaintained: true
    }
  });

  const topPack = queryMetaOptimize(root).remediationPacks.packs[0];
  const actorRole = topPack.rankedConversionPaths?.find(
    (item) => item.targetType === "create-new-packet"
  )?.assignedRole ?? "planner";
  seedTaskPacket(root, "task-existing-target", {
    title: "Existing immutable target",
    status: "pending"
  });
  recordOperatorFollowThrough(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    status: "acknowledged",
    actorRole,
    decisionSummary: "Preserve the original immutable target binding.",
    linkedTargetArtifact: ".dove/task-packets/packets/task-existing-target.json",
    linkedTargetId: "task-existing-target"
  });
  const packetId = "task-conflicting-materialization";
  const packetPath = path.join(root, `.dove/task-packets/packets/${packetId}.json`);
  const packetIndexBefore = fs.readFileSync(
    path.join(root, ARTIFACT_PATHS.taskPacketsIndex)
  );
  const followThroughBefore = fs.readFileSync(
    path.join(root, ARTIFACT_PATHS.metaOperatorFollowThrough)
  );
  const transitionsBefore = fs.readFileSync(
    path.join(root, ARTIFACT_PATHS.metaOperatorFollowThroughTransitions)
  );
  const workspaceFilesBefore = new Map(
    fs.readdirSync(path.join(root, ".dove"), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const fullPath = path.join(entry.parentPath, entry.name);
        return [path.relative(root, fullPath), fs.readFileSync(fullPath)];
      })
  );

  assert.throws(() => materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: topPack.id,
    actorRole,
    packetId,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }), /cannot change target/);

  assert.deepEqual(
    fs.readFileSync(path.join(root, ARTIFACT_PATHS.taskPacketsIndex)),
    packetIndexBefore
  );
  assert.equal(fs.existsSync(packetPath), false);
  assert.deepEqual(
    fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorFollowThrough)),
    followThroughBefore
  );
  assert.deepEqual(
    fs.readFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorFollowThroughTransitions)),
    transitionsBefore
  );
  const workspaceFilesAfter = new Map(
    fs.readdirSync(path.join(root, ".dove"), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const fullPath = path.join(entry.parentPath, entry.name);
        return [path.relative(root, fullPath), fs.readFileSync(fullPath)];
      })
  );
  assert.deepEqual(workspaceFilesAfter, workspaceFilesBefore);
  });
});

test("materializeGuidancePacket rejects authority fields before workspace bootstrap", () => {
  const authorityFields = [
    "programId",
    "programRunId",
    "approvalId",
    "allowedStepType",
    "autonomyPolicy"
  ];

  for (const field of authorityFields) {
    const root = tempRoot();
    return runFixtureMutation(root, "materializeguidancepacket-rejects-authority-fields-before-workspace-boot", () => {
    assert.throws(
      () => materializeGuidancePacket(root, {
        sourceType: "remediation-pack",
        sourceId: "caller-controlled",
        actorRole: "planner",
        executeBy: "2099-01-01T00:00:00.000Z",
        reviewAfter: "2099-01-01T12:00:00.000Z",
        [field]: `forged-${field}`
      }),
      new RegExp(`rejects non-packet fields: ${field}`)
    );
    assert.equal(
      fs.existsSync(path.join(root, ".dove")),
      false,
      `${field} must fail before workspace bootstrap`
    );
    });
  }
});

test("materializeGuidancePacket remains packet-only and preserves program operating state", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "materializeguidancepacket-remains-packet-only-and-preserves-program-oper", () => {
  ensureTestWorkspace(root);
  initProject(root, {
    title: "Packet-only materialization",
    objective: "Materialize guidance without minting runtime authority."
  });
  const remediationPack = seedRoleScopedAutonomyGuidance(
    root,
    "researcher"
  );
  const programsBefore = fs.readFileSync(
    path.join(root, ARTIFACT_PATHS.programsIndex),
    "utf8"
  );
  const runsBefore = fs.readFileSync(
    path.join(root, ARTIFACT_PATHS.programRuns),
    "utf8"
  );
  const approvalsBefore = fs.readFileSync(
    path.join(root, ARTIFACT_PATHS.programApprovals),
    "utf8"
  );

  const result = materializeGuidancePacket(root, {
    sourceType: "remediation-pack",
    sourceId: remediationPack.id,
    actorRole: "planner",
    workerRole: "researcher",
    packetId: "task-packet-only-materialization",
    title: "Packet-only materialization",
    nextAction: "Hand the packet to the normal host workflow.",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const packet = readJson(root, result.packetPath, null);
  assert.equal(result.status, "materialized");
  assert.equal(packet.id, result.packetId);
  assert.equal(packet.lineage?.programId, undefined);
  assert.equal(packet.materialization?.programId, undefined);
  assert.equal(
    fs.readFileSync(
      path.join(root, ARTIFACT_PATHS.programsIndex),
      "utf8"
    ),
    programsBefore
  );
  assert.equal(
    fs.readFileSync(
      path.join(root, ARTIFACT_PATHS.programRuns),
      "utf8"
    ),
    runsBefore
  );
  assert.equal(
    fs.readFileSync(
      path.join(root, ARTIFACT_PATHS.programApprovals),
      "utf8"
    ),
    approvalsBefore
  );
  });
});

test("materializeGuidancePacket blocks unrelated follow-through debt and superseded guidance", () => {
  const blockedRoot = tempRoot();
  runFixtureMutation(blockedRoot, "blocked-materialization", () => {
  ensureTestWorkspace(blockedRoot);
  initProject(blockedRoot, { title: "Blocked Materialization", objective: "Respect follow-through governance before creating work." });
  writeJson(blockedRoot, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "blocked-materialize-gap",
      summary: "Need an explicit packet materialization bridge.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(blockedRoot, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the blocked materialization gap."],
    unresolvedConcernIds: ["blocked-materialize-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });

  const blockedMeta = queryMetaOptimize(blockedRoot);
  const blockedPack = blockedMeta.remediationPacks.packs[0];
  const blockedCandidate = blockedMeta.executionBridgeCandidates.candidates.find((item) => item.candidateType === "packet-candidate");
  const candidateActorRole = blockedCandidate.sourceConversionPath?.assignedRole ?? "planner";
  writeJson(blockedRoot, ".dove/task-packets/packets/task-blocking-guidance.json", { id: "task-blocking-guidance", title: "Blocking task", status: "pending" });
  recordOperatorFollowThrough(blockedRoot, {
    sourceType: "execution-bridge",
    sourceId: blockedCandidate.id,
    status: "accepted-for-execution",
    actorRole: candidateActorRole,
    decisionSummary: "Keep this candidate open as unrelated follow-through debt.",
    linkedTargetArtifact: ".dove/task-packets/packets/task-blocking-guidance.json",
    linkedTargetId: "task-blocking-guidance",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  });

  const packActorRole = blockedPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner";
  assert.throws(() => materializeGuidancePacket(blockedRoot, {
    sourceType: "remediation-pack",
    sourceId: blockedPack.id,
    actorRole: packActorRole,
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }), /unrelated operator follow-through/);
  });

  const supersededRoot = tempRoot();
  runFixtureMutation(supersededRoot, "superseded-materialization", () => {
  ensureTestWorkspace(supersededRoot);
  initProject(supersededRoot, { title: "Superseded Materialization", objective: "Refuse superseded guidance materialization." });
  writeJson(supersededRoot, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "superseded-materialize-gap",
      summary: "Need an explicit packet materialization bridge.",
      severity: "high",
      status: "open",
      responseOwnerRole: "planner",
      recurrenceCount: 2,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(supersededRoot, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the superseded materialization gap."],
    unresolvedConcernIds: ["superseded-materialize-gap"],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 1,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["planner"], separationMaintained: true }
  });

  const supersededPack = queryMetaOptimize(supersededRoot).remediationPacks.packs[0];
  recordOperatorFollowThrough(supersededRoot, {
    sourceType: "remediation-pack",
    sourceId: supersededPack.id,
    status: "acknowledged",
    actorRole: supersededPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner",
    decisionSummary: "This guidance was acknowledged before an internal supersession transition."
  });
  const supersededFollowThrough = readJson(
    supersededRoot,
    ARTIFACT_PATHS.metaOperatorFollowThrough,
    null
  );
  writeJson(
    supersededRoot,
    ARTIFACT_PATHS.metaOperatorFollowThrough,
    {
      ...supersededFollowThrough,
      items: (supersededFollowThrough.items ?? []).map(
        (item) => item.sourceId === supersededPack.id
          ? {
              ...item,
              status: "superseded",
              updatedAt: new Date().toISOString()
            }
          : item
      )
    }
  );

  assert.throws(() => materializeGuidancePacket(supersededRoot, {
    sourceType: "remediation-pack",
    sourceId: supersededPack.id,
    actorRole: supersededPack.rankedConversionPaths?.find((item) => item.targetType === "create-new-packet")?.assignedRole ?? "planner",
    executeBy: "2099-01-01T00:00:00.000Z",
    reviewAfter: "2099-01-01T12:00:00.000Z"
  }), /superseded guidance/);
  });
});

test("public package bundle exposes no mutation context writer or retired execution authority", async () => {
  const rootApi = await import("../../dist/index.mjs");
  for (const name of [
    "createMutationContext",
    "runWithMutationContext",
    "issueProgramApproval",
    "runAutonomyOperate",
    "runAutonomyForeground",
    "runAutonomyControlPlaneOnce",
    "saveBoard",
    "appendText",
    "saveState",
    "writeJson",
    "writeText",
    "assertRoleBoundMutation",
    "appendSystemHandoff",
    "upsertSystemOrchestrationBoard"
  ]) {
    assert.equal(name in rootApi, false, `forbidden root export ${name}`);
  }
  assert.equal(
    [...GOVERNANCE_GUARDED_MUTATIONS, ...GOVERNANCE_EXEMPT_MUTATIONS]
      .some((entry) => entry.id === "save-board"),
    false
  );
});

test("guarded core mutation implementations explicitly call assertFollowThroughReady", () => {
  const files = {
    artifacts: fs.readFileSync(path.join(process.cwd(), "src/core/artifacts.mjs"), "utf8"),
    evidence: fs.readFileSync(path.join(process.cwd(), "src/core/evidence.mjs"), "utf8"),
    reviews: fs.readFileSync(path.join(process.cwd(), "src/core/reviews.mjs"), "utf8"),
    figureWorkflow: fs.readFileSync(path.join(process.cwd(), "src/core/figure-workflow.mjs"), "utf8"),
    figureGeneration: fs.readFileSync(path.join(process.cwd(), "src/core/figure-generation.mjs"), "utf8"),
    orchestration: fs.readFileSync(path.join(process.cwd(), "src/core/orchestration.mjs"), "utf8")
  };

  const guardedFunctionAssertions = [
    [files.artifacts, "registerSource"],
    [files.artifacts, "upsertNote"],
    [files.artifacts, "upsertPlan"],
    [files.artifacts, "upsertOutline"],
    [files.artifacts, "upsertDraft"],
    [files.artifacts, "setSectionStatus"],
    [files.artifacts, "upsertFigurePlan"],
    [files.figureWorkflow, "runFigureWorkflow"],
    [files.figureGeneration, "prepareFigureGeneration"],
    [files.figureGeneration, "importFigureGeneration"],
    [files.artifacts, "syncCitations"],
    [files.artifacts, "refreshWiki"],
    [files.artifacts, "buildRebuttal"],
    [files.evidence, "upsertClaims"],
    [files.reviews, "appendReviewLog"],
    [files.reviews, "upsertRevisionPlan"],
    [files.reviews, "runReviewLoop"],
    [files.orchestration, "updateResearchBrief"],
    [files.orchestration, "upsertExperimentPlan"],
    [files.orchestration, "upsertExperimentResult"],
    [files.orchestration, "runExperimentAudit"],
    [files.orchestration, "bridgeExperimentResultToClaim"],
    [files.orchestration, "normalizeRebuttalIssues"],
    [files.orchestration, "buildRebuttalStrategy"],
    [files.orchestration, "createVersionSnapshot"],
    [files.orchestration, "compareVersions"]
  ];

  for (const [content, fnName] of guardedFunctionAssertions) {
    assert.match(content, new RegExp(`export function ${fnName}\\([^)]*\\) {[^]*?assertFollowThroughReady\\(`));
  }
});

test("every governance registry entry binds to real command or MCP surfaces plus core surfaces", () => {
  const registry = [...GOVERNANCE_GUARDED_MUTATIONS, ...GOVERNANCE_EXEMPT_MUTATIONS];
  const toolNames = new Set(toolDefinitions.map((tool) => tool.name));
  const commandDir = path.join(process.cwd(), ".opencode", "commands");
  const coreFiles = [
    fs.readFileSync(path.join(process.cwd(), "src/core/artifacts.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/evidence.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/reviews.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/isolated-review.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/figure-workflow.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/figure-generation.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/orchestration.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/navigation.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/dove.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/task-workflow.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/experience-workflow.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/audio-review.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/dove-review-loop.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/public-status.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/global-status-serving.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/documents.mjs"), "utf8"),
    fs.readFileSync(path.join(process.cwd(), "src/core/claude-code-gateway.mjs"), "utf8")
  ];

  for (const entry of registry) {
    const bindings = entry.surfaceBindings ?? {};
    assert.equal(typeof bindings.coreFunction, "string");
    assert.equal(Array.isArray(bindings.commandIds), true);
    if (bindings.mcpTool) {
      assert.equal(typeof bindings.mcpTool, "string");
      assert.equal(toolNames.has(bindings.mcpTool), true, `${entry.id} missing bound MCP tool ${bindings.mcpTool}`);
    } else if (entry.reasonCode !== "runtime-fixed-semantics-transition") {
      assert.equal(bindings.commandIds.length > 0 || typeof bindings.cliCommand === "string", true, `${entry.id} without MCP tool must bind at least one command or CLI surface`);
    }
    for (const commandId of bindings.commandIds) {
      assert.equal(fs.existsSync(path.join(commandDir, `${commandId}.md`)), true, `${entry.id} missing command surface ${commandId}`);
    }
    assert.equal(coreFiles.some((content) => content.includes(`export function ${bindings.coreFunction}`) || content.includes(`function ${bindings.coreFunction}`)), true, `${entry.id} missing core function ${bindings.coreFunction}`);
  }
});

test("every guarded governance mutation has an explicit negative coverage mapping", () => {
  const guardedIds = new Set(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.id));
  const coveredIds = new Set(GOVERNANCE_NEGATIVE_COVERAGE.map((entry) => entry.id));
  for (const id of guardedIds) {
    assert.equal(coveredIds.has(id), true, `Missing negative coverage mapping for ${id}`);
  }
});

test("playbook selection prefers packet and taxonomy specific matches over broad role-only fallbacks", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "playbook-selection-prefers-packet-and-taxonomy-specific-matches-over-bro", () => {
  ensureTestWorkspace(root);
  initProject(root, { title: "Playbook Specificity", objective: "Prefer the most specific family playbook under mixed guidance signals." });
  const packetId = seedTaskPacket(root, "playbook-specificity");

  registerSource(root, { packetId, citationKey: "specificity-source", title: "Specificity Source", authors: ["Rao"], year: 2026 });
  upsertNote(root, { packetId, noteId: "specificity-note", title: "Specificity note", sectionId: "method", sourceIds: ["specificity-source"], summary: "Specificity should remain deterministic." });
  writeJson(root, ARTIFACT_PATHS.sources, {
    version: 1,
    items: [{ id: "experiment-specificity-exp", citationKey: "specificity-exp-source", title: "Wrong endpoint type", authors: [], year: 2026, sourceType: "paper", abstract: "", origin: "manual", addedAt: new Date(0).toISOString() }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{
      id: "claim-specificity",
      text: "Specific family playbooks should beat broad fallbacks.",
      sectionId: "experiments",
      status: "supported",
      confidence: "medium",
      sourceIds: ["missing-source"],
      noteIds: ["missing-note"],
      experimentIds: ["specificity-exp"]
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
    version: 2,
    items: [{
      id: "specificity-review-gap",
      summary: "A broad review concern is still open.",
      severity: "high",
      status: "escalated",
      responseOwnerRole: "researcher",
      claimIds: ["claim-specificity"],
      recurrenceCount: 3,
      linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog],
      updatedAt: new Date(0).toISOString()
    }],
    updatedAt: null
  });
  writeJson(root, ARTIFACT_PATHS.reviewState, {
    version: 3,
    lastVerdict: "needs-work",
    lastReviewedAt: new Date(0).toISOString(),
    history: [],
    openItems: ["Close the broad review concern."],
    unresolvedConcernIds: ["specificity-review-gap"],
    escalatedConcernIds: ["specificity-review-gap"],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 3,
    reviewerIndependence: { reviewerRole: "reviewer", responseOwnerRoles: ["researcher"], separationMaintained: true }
  });
  upsertSystemOrchestrationBoard(root, {
    phase: "research",
    assignedRole: "researcher",
    intentType: "advance-paper",
    currentFocus: "Prefer the packet-specific validation playbook.",
    nextAction: "Use the packet-specific guidance next.",
    tasks: [{
      id: "specific-validation-task",
      title: "Close validation-loop packet",
      assignedRole: "researcher",
      status: "in-progress",
      lifecycleStatus: "review-needed",
      nextAction: "Repair the validation-loop relation explicitly.",
      evidenceLinks: [ARTIFACT_PATHS.wikiRelations],
      outputPaths: []
    }]
  });

  refreshWiki(root);

  const metaOptimize = queryMetaOptimize(root);
  const packetBundle = readJson(root, `${ARTIFACT_PATHS.actionContextsDir}/packet-task-specific-validation-task.json`, {});
  const roleManifest = readJson(root, `${ARTIFACT_PATHS.roleContextsDir}/researcher.json`, {});

  assert.equal(metaOptimize.operatorPlaybooks.playbooks.some((item) => item.taxonomyFamilyId === "validation-loop"), true);
  assert.equal(metaOptimize.operatorPlaybooks.playbooks.some((item) => item.taxonomyFamilyId === "evidence-grounding"), true);
  assert.equal(packetBundle.operatorGuidance.familyPlaybook.taxonomyFamilyId, "validation-loop");
  assert.equal(packetBundle.operatorGuidance.familyPlaybook.selectionRankingBasis.some((item) => item.startsWith("packet") || item.startsWith("packetText=")), true);
  assert.equal(roleManifest.operatorGuidance.familyPlaybook.selectionScore > 0, true);
  });
});

test("figure QA records missing staged files and source artifacts in qa.json", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "figure-qa-records-missing-staged-files-and-source-artifacts-in-qa-json", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root, "figure-qa-main");
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-main", text: "Main claim" }],
    updatedAt: null
  });

  fs.writeFileSync(path.join(root, ".dove", "figures", "main-figure.template.svg"), "<svg />\n", "utf8");

  upsertFigurePlan(root, {
    packetId,
    items: [{
      id: "main-figure",
      sourceSections: ["introduction"],
      sourceArtifactPaths: [ARTIFACT_PATHS.findings, ".dove/research/missing-source.md"],
      targetClaimIds: ["claim-main"],
      templateSvgPath: ".dove/figures/main-figure.template.svg",
      editableSvgPath: ".dove/figures/main-figure.editable.svg",
      finalSvgPath: ".dove/figures/main-figure.final.svg"
    }]
  });

  const qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [], updatedAt: null });
  const issueCodes = new Set(qa.issues.map((issue) => issue.code));

  assert.ok(issueCodes.has("missing-editableSvgPath-file"));
  assert.ok(issueCodes.has("missing-finalSvgPath-file"));
  assert.ok(issueCodes.has("missing-source-artifact-2"));
  assert.equal(qa.items[0].fileChecks.stagedArtifacts.templateSvgPath.exists, true);
  assert.equal(qa.items[0].fileChecks.stagedArtifacts.editableSvgPath.exists, false);
  assert.equal(qa.items[0].fileChecks.sourceArtifacts[0].exists, true);
  assert.equal(qa.items[0].fileChecks.sourceArtifacts[1].exists, false);
  });
});

test("validateFigurePipeline catches colliding stage paths and malformed stage contract drift", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "validatefigurepipeline-catches-colliding-stage-paths-and-malformed-stage", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root, "figure-qa-collision");
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-shared", text: "Shared claim" }],
    updatedAt: null
  });

  fs.writeFileSync(path.join(root, ".dove", "figures", "shared.svg"), "<svg />\n", "utf8");

  upsertFigurePlan(root, {
    packetId,
    items: [{
      id: "figure-a",
      sourceSections: ["introduction"],
      targetClaimIds: ["claim-shared"],
      templateSvgPath: ".dove/figures/shared.svg",
      editableSvgPath: ".dove/figures/shared.svg",
      finalSvgPath: ".dove/figures/shared.svg"
    }]
  });

  writeJson(root, ARTIFACT_PATHS.figureTemplates, {
    version: 1,
    items: [{
      ...readJson(root, ARTIFACT_PATHS.figureTemplates, { version: 1, items: [], updatedAt: null }).items[0],
      finalSvgPath: ".dove/figures/drifted.final.svg"
    }],
    updatedAt: null
  });

  validateFigurePipeline(root);

  const qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [], updatedAt: null });
  const issueCodes = new Set(qa.issues.map((issue) => issue.code));

  assert.ok(issueCodes.has("colliding-stage-paths"));
  assert.ok(issueCodes.has("inconsistent-template-stage-paths"));
  });
});

test("validateFigurePipeline records malformed stage paths instead of throwing on non-string values", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "validatefigurepipeline-records-malformed-stage-paths-instead-of-throwing", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root, "figure-qa-malformed-path");
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-malformed", text: "Malformed path claim" }],
    updatedAt: null
  });

  upsertFigurePlan(root, {
    packetId,
    items: [{
      id: "figure-malformed",
      sourceSections: ["introduction"],
      targetClaimIds: ["claim-malformed"],
      templateSvgPath: ".dove/figures/figure-malformed.template.svg",
      editableSvgPath: ".dove/figures/figure-malformed.editable.svg",
      finalSvgPath: ".dove/figures/figure-malformed.final.svg"
    }]
  });

  const figuresIndex = readJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: null });
  figuresIndex.items[0].templateSvgPath = null;
  writeJson(root, ARTIFACT_PATHS.figuresIndex, figuresIndex);

  assert.doesNotThrow(() => validateFigurePipeline(root));

  const qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [], updatedAt: null });
  const issueCodes = new Set(qa.issues.map((issue) => issue.code));
  assert.ok(issueCodes.has("malformed-templateSvgPath"));
  });
});

test("validateFigurePipeline records malformed non-array figure linkage fields instead of throwing", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "validatefigurepipeline-records-malformed-non-array-figure-linkage-fields", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root, "figure-qa-malformed-array");
  writeJson(root, ARTIFACT_PATHS.evidence, {
    version: 3,
    claims: [{ id: "claim-array", text: "Array claim" }],
    updatedAt: null
  });

  upsertFigurePlan(root, {
    packetId,
    items: [{
      id: "figure-array-malformed",
      sourceSections: ["introduction"],
      targetClaimIds: ["claim-array"],
      templateSvgPath: ".dove/figures/figure-array-malformed.template.svg",
      editableSvgPath: ".dove/figures/figure-array-malformed.editable.svg",
      finalSvgPath: ".dove/figures/figure-array-malformed.final.svg"
    }]
  });

  const figuresIndex = readJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: null });
  figuresIndex.items[0].sourceSections = "introduction";
  figuresIndex.items[0].targetClaimIds = { bad: true };
  figuresIndex.items[0].reviewConcernIds = "review-1";
  writeJson(root, ARTIFACT_PATHS.figuresIndex, figuresIndex);

  assert.doesNotThrow(() => validateFigurePipeline(root));

  const qa = readJson(root, ARTIFACT_PATHS.figureQa, { version: 1, items: [], issues: [], updatedAt: null });
  const issueCodes = new Set(qa.issues.map((issue) => issue.code));
  assert.ok(issueCodes.has("malformed-sourceSections"));
  assert.ok(issueCodes.has("malformed-targetClaimIds"));
  assert.ok(issueCodes.has("malformed-reviewConcernIds"));
  });
});
