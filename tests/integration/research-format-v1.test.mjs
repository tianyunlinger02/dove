import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { writeResearchJsonAtomic } from "../../src/core/research-records.mjs";
import {
  concludeMission, createExperimentPlan, createMission, missionReadableIds, readMissionTree,
  recordClaim, recordExperimentResult, recordReview, recordSource, replaceLessons, updateWorkspace, verifyReview
} from "../../src/core/research-stores.mjs";
import { ARTIFACT_PATHS, DOVE_RESEARCH_FORMAT, PACKAGE_VERSION, RESEARCH_DIRECTORIES } from "../../src/core/schema.mjs";
import { INSTALLATION_MANIFEST_PATH, createProjectInstallationManifest, serializeProjectInstallationManifest } from "../../src/core/project-installation-manifest.mjs";
import { PROJECT_HOST_IDS } from "../../src/core/host-registry.mjs";
import { inspectDoveWorkspace, validateLessonsMarkdown } from "../../src/core/workspace-schema.mjs";
import { initializeResearchWorkspace } from "../../src/core/workspace-init.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function writeJson(root, relativePath, value) { const full = path.join(root, relativePath); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`); }
function init(root) {
  fs.mkdirSync(path.join(root, ".dove")); for (const directory of RESEARCH_DIRECTORIES) fs.mkdirSync(path.join(root, directory), { recursive: true });
  writeJson(root, ARTIFACT_PATHS.format, { format: DOVE_RESEARCH_FORMAT });
  writeJson(root, ARTIFACT_PATHS.workspace, { workspaceId: "workspace-test", researchQuestion: "Why does the method behave differently?", mainline: "Test competing explanations.", contributionIntent: "Identify the bounded mechanism and claim boundary.", currentFocus: "Run one discriminating experiment.", changeHistory: [{ changedAt: "2026-08-08T00:00:00.000Z", summary: "Established the research direction." }], createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z" });
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.lessons), "# Lessons\n"); return inspectDoveWorkspace(root);
}
function mission(root, id = "root-mission") { return createMission(root, { missionId: id, goal: "Discriminate the leading hypotheses.", requirements: ["Preserve adverse evidence."], assumptions: ["The benchmark is representative only of itself."], scope: ["One benchmark."], outOfScope: ["Deployment."], evidenceRequirements: ["One frozen experiment."], competingHypotheses: ["optimization-effect", "measurement-artifact"], openQuestions: ["Which hypothesis explains the null cases?"], contextRefs: ["paper:introduction"], contributionRole: "mechanism-evidence", createdAt: "2026-08-08T00:01:00.000Z" }); }
function snapshot(root) { const output = {}; const visit = (dir) => { if (!fs.existsSync(dir)) return; for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory() && !entry.isSymbolicLink()) visit(full); else output[path.relative(root, full)] = entry.isSymbolicLink() ? `link:${fs.readlinkSync(full)}` : fs.readFileSync(full).toString("base64"); } }; visit(root); return output; }

test("install-only .dove is healthy research-absent and initializes without changing the manifest", () => {
  const root = createTempRoot("dove-rf1-install-only-");
  const manifest = createProjectInstallationManifest({
    installationId: "installation-123e4567-e89b-42d3-a456-426614174000",
    package: { name: "@dove-research/cli", version: PACKAGE_VERSION },
    hosts: ["claude"],
    managed: [],
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z"
  }, { hostIds: PROJECT_HOST_IDS });
  writeJson(root, INSTALLATION_MANIFEST_PATH, manifest);
  const before = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH));
  const inspection = inspectDoveWorkspace(root);
  assert.equal(inspection.state, "research-absent");
  assert.equal(inspection.healthy, true);
  initializeResearchWorkspace(root, {
    workspaceId: "workspace-install-only",
    researchQuestion: "Can installation and research state coexist?",
    mainline: "Keep installation metadata separate within one private root.",
    contributionIntent: "Validate the unified project layout.",
    currentFocus: "Initialize Research Format 1 without touching the installation manifest.",
    createdAt: "2026-08-08T00:01:00.000Z"
  });
  assert.deepEqual(fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH)), before);
  assert.equal(inspectDoveWorkspace(root).healthy, true);
});

test("install-only classification allows archive and transaction residue but rejects unknown research children", () => {
  const root = createTempRoot("dove-rf1-install-only-allowed-");
  const manifest = createProjectInstallationManifest({
    installationId: "installation-123e4567-e89b-42d3-a456-426614174001",
    package: { name: "@dove-research/cli", version: PACKAGE_VERSION },
    hosts: ["claude"],
    managed: [],
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z"
  }, { hostIds: PROJECT_HOST_IDS });
  writeJson(root, INSTALLATION_MANIFEST_PATH, manifest);
  fs.mkdirSync(path.join(root, ".dove/archive/legacy"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove/archive/legacy/result.txt"), "preserve\n");
  fs.mkdirSync(path.join(root, ARTIFACT_PATHS.transactionsDir, "residue"), { recursive: true });

  assert.equal(inspectDoveWorkspace(root).state, "research-absent");
  fs.writeFileSync(path.join(root, ".dove/unknown.json"), "{}\n");
  assert.equal(inspectDoveWorkspace(root).state, "unknown-format");
});

test("Research Format 1 marker is exact and Workspace carries the approved research fields", () => {
  const root = createTempRoot("dove-rf1-workspace-"); const opened = init(root); assert.equal(opened.healthy, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.format))), { format: "dove-research-v1" });
  assert.equal(Object.hasOwn(opened.marker, "createdAt"), false); assert.equal(Object.hasOwn(opened.marker, "packageVersion"), false); assert.equal(PACKAGE_VERSION, "0.7.0");
  const next = updateWorkspace(root, { mainline: "Prioritize the measurement-artifact explanation.", currentFocus: "Collect denominator-aware null evidence.", summary: "Focused on the explanation best supported by adverse observations.", changedAt: "2026-08-08T00:02:00.000Z" });
  assert.equal(next.researchQuestion, opened.workspaceRecord.researchQuestion); assert.equal(next.contributionIntent, opened.workspaceRecord.contributionIntent); assert.equal(next.changeHistory.length, 2);
  for (const forbidden of ["currentMainline", "revision", "digest"]) assert.equal(Object.hasOwn(next, forbidden), false);
});

test("format marker extras, Schema 20, and unknown formats fail closed without fallback writes", () => {
  const extra = createTempRoot("dove-rf1-extra-"); init(extra); writeJson(extra, ARTIFACT_PATHS.format, { format: DOVE_RESEARCH_FORMAT, createdAt: "2026-08-08T00:00:00.000Z" }); assert.equal(inspectDoveWorkspace(extra).healthy, false);
  for (const [name, marker] of [["legacy", { schemaVersion: 20 }], ["unknown", { format: "future-format" }]]) { const root = createTempRoot(`dove-rf1-${name}-`); fs.mkdirSync(path.join(root, ".dove")); writeJson(root, name === "legacy" ? ".dove/manifest.json" : ARTIFACT_PATHS.format, marker); const before = snapshot(root); assert.equal(inspectDoveWorkspace(root).healthy, false); assert.throws(() => updateWorkspace(root, { summary: "Never write." }), /read-only|requires an initialized|refuses/iu); assert.deepEqual(snapshot(root), before); }
});

test("Mission contract and one conclusion preserve research semantics and immutable branching", () => {
  const root = createTempRoot("dove-rf1-mission-"); init(root); mission(root);
  const child = createMission(root, { missionId: "child-mission", parentMissionId: "root-mission", branchKind: "alternative", branchReason: "Test the competing explanation.", goal: "Test the measurement explanation.", assumptions: ["Instrumentation is stable."], competingHypotheses: ["measurement-artifact"], openQuestions: ["Does calibration remove the effect?"], contextRefs: ["mission:root-mission"], contributionRole: "alternative-explanation", createdAt: "2026-08-08T00:02:00.000Z" });
  assert.deepEqual([...missionReadableIds(root, child.missionId)].sort(), ["child-mission", "root-mission"]); assert.deepEqual(readMissionTree(root).children.get("root-mission"), ["child-mission"]);
  assert.throws(() => mission(root), /immutable and already exists/iu);
  const conclusion = concludeMission(root, { missionId: "root-mission", synthesis: "The evidence favors a condition-specific explanation.", failures: ["One run crashed."], limitations: ["One benchmark."], uncertainty: ["Calibration remains unresolved."], sourceIds: ["source-one"], experimentIds: ["run-negative"], claimIds: ["claim-one"], recommendedBranches: ["Run a calibrated sibling experiment."], concludedAt: "2026-08-08T00:05:00.000Z" });
  assert.equal(conclusion.synthesis.startsWith("The evidence"), true); for (const forbidden of ["outcome", "attempt", "validation", "completion"]) assert.equal(Object.keys(conclusion).some((key) => key.toLowerCase().includes(forbidden)), false); assert.throws(() => concludeMission(root, { missionId: "root-mission", synthesis: "Changed." }), /immutable and already exists/iu);
});

test("Source, Experiment, Claim, Review, and Lessons store all approved semantic fields", () => {
  const root = createTempRoot("dove-rf1-entities-"); init(root); mission(root); fs.mkdirSync(path.join(root, "materials")); fs.writeFileSync(path.join(root, "materials/source.txt"), "related work\n");
  const source = recordSource(root, { sourceId: "source-one", missionId: "root-mission", title: "Prior Work", authors: ["Researcher"], locator: "https://example.test", summary: "Reports improvement under a narrower condition.", conditions: ["Small-data regime."], relationship: "condition-specific", conflicts: ["Uses a different denominator."], limitations: ["No large-scale test."], capturePath: "materials/source.txt", recordedAt: "2026-08-08T00:02:00.000Z" });
  assert.equal(source.relationship, "condition-specific"); assert.match(source.capture.sha256, /^[0-9a-f]{64}$/u);
  assert.throws(() => recordExperimentResult(root, { experimentId: "run-negative", missionId: "root-mission", kind: "negative", summary: "No plan." }), /prior persisted protocol plan/iu);
  const planArgs = { missionId: "root-mission", title: "Discriminating run", hypothesisRefs: ["optimization-effect", "measurement-artifact"], protocol: ["Run every case."], inputs: ["case-one"], comparisons: ["baseline"], metrics: ["score"], discriminatingObservations: ["Calibration removes the effect only under the artifact hypothesis."], successConditions: ["All cases accounted for."], stopConditions: ["Stop after one pass."], constraints: ["Fixed seed."], expectedArtifacts: ["outputs/result.json"], cost: "One GPU-hour.", risk: "Calibration may fail.", failureValue: "A crash still identifies an unstable path.", contributionRole: "hypothesis-discrimination", plannedAt: "2026-08-08T00:03:00.000Z" };
  for (const [id, kind] of [["run-negative", "negative"], ["run-null", "null"], ["run-failed", "failed"]]) { createExperimentPlan(root, { ...planArgs, experimentId: id }); const result = recordExperimentResult(root, { experimentId: id, missionId: "root-mission", kind, summary: `${kind} evidence`, observations: ["The adverse observation was retained."], measurements: kind === "failed" ? [] : [{ metric: "score", value: 0 }], denominator: { total: 3, observed: kind === "failed" ? 0 : 3, failed: kind === "failed" ? 3 : 0, excluded: 0 }, hypothesisImpacts: [{ hypothesisRef: "optimization-effect", impact: kind }], claimImpacts: [{ claimRef: "claim-one", impact: "weaken" }], unexpectedObservations: ["One diagnostic changed."], uncertainty: ["One benchmark."], failures: kind === "failed" ? ["All runs crashed."] : [], limitations: ["No generalization."], recordedAt: "2026-08-08T00:04:00.000Z" }); assert.equal(result.kind, kind); assert.equal(result.observations.length, 1); assert.equal(result.denominator.total, 3); assert.equal(result.hypothesisImpacts.length, 1); assert.equal(result.claimImpacts.length, 1); }
  const claim = recordClaim(root, { claimId: "claim-one", missionId: "root-mission", statement: "The method does not improve this benchmark.", supportRefs: ["experiment:run-negative"], counterEvidenceRefs: ["source:source-one"], missingEvidence: ["Calibrated replication."], cannotSay: ["Cannot claim population-level failure."], uncertainty: ["Single benchmark."], assessment: "weakened", storyRole: "bounded-negative-result", artifactRefs: ["paper:results"], recordedAt: "2026-08-08T00:05:00.000Z" }); assert.match(claim.cannotSay[0], /population-level/u);
  fs.mkdirSync(path.join(root, "paper")); fs.writeFileSync(path.join(root, "paper/draft.md"), "# Draft\n"); const review = recordReview(root, { reviewId: "review-one", missionId: "root-mission", status: "completed", verdict: "needs-evidence", summary: "Narrow the claim.", rubric: ["Evidence sufficiency", "Claim scope"], artifactPaths: ["paper/draft.md"], findings: [{ severity: "high", summary: "Evidence is narrow." }], actionItems: ["State cannotSay explicitly."], report: "# Review\n\nThe claim is too broad.\n", provenance: { host: "isolated-reviewer", model: "review-model" }, limitations: ["Non-authoritative review."], reviewedAt: "2026-08-08T00:06:00.000Z" }); assert.equal(review.reviewedArtifacts.length, 1); assert.equal(verifyReview(root, "review-one").ok, true); fs.appendFileSync(path.join(root, "paper/draft.md"), "changed\n"); assert.equal(verifyReview(root, "review-one").ok, false);
  replaceLessons(root, "# Free-form Lessons\n\nAny non-empty newline Markdown is valid.\n"); assert.equal(validateLessonsMarkdown(fs.readFileSync(path.join(root, ARTIFACT_PATHS.lessons), "utf8")).startsWith("# Free-form"), true);
});

test("post-commit research cleanup failure preserves the promoted record", () => {
  const root = createTempRoot("dove-rf1-cleanup-"); init(root);
  const target = path.join(root, ARTIFACT_PATHS.workspace);
  const previous = fs.readFileSync(target, "utf8");
  const next = { ...JSON.parse(previous), currentFocus: "Preserve the committed replacement after cleanup failure." };
  let backupDeleted = false;
  const fsOps = {
    ...fs,
    unlinkSync(targetPath, metadata) {
      if (metadata?.anchoredPath && path.posix.basename(metadata.anchoredPath) === "backup") backupDeleted = true;
      return fs.unlinkSync(targetPath);
    },
    rmdirSync(targetPath, metadata) {
      if (backupDeleted && metadata?.anchoredPath?.startsWith(`${ARTIFACT_PATHS.transactionsDir}/research-`)) {
        throw new Error("injected post-commit cleanup failure");
      }
      return fs.rmdirSync(targetPath);
    }
  };

  assert.throws(() => writeResearchJsonAtomic(root, ARTIFACT_PATHS.workspace, next, { expectedContent: previous, fsOps }), /committed before post-commit cleanup failed.*injected post-commit cleanup failure/iu);
  assert.equal(backupDeleted, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(target, "utf8")), next);
  assert.equal(fs.readdirSync(path.join(root, ARTIFACT_PATHS.transactionsDir)).some((name) => name.startsWith("research-")), true);
});

test("contained atomic writer rejects traversal and symlink components", () => {
  const root = createTempRoot("dove-rf1-path-"); init(root); assert.throws(() => writeResearchJsonAtomic(root, "../escape.json", { bad: true }), /inside|stay inside/iu); fs.symlinkSync(path.join(root, "outside"), path.join(root, ".dove/claims/link")); assert.throws(() => writeResearchJsonAtomic(root, ".dove/claims/link/value.json", { bad: true }), /symbolic|directory/iu); assert.equal(fs.existsSync(path.join(root, "escape.json")), false);
});
