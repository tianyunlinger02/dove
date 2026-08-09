import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { readResearchJson } from "../core/research-records.mjs";
import { buildResearchContext, queryResearchContext } from "../core/research-context.mjs";
import { normalizedRelativePath } from "../core/research-records.mjs";
import { ARTIFACT_PATHS } from "../core/schema.mjs";

let concludeMission, createExperimentPlan, createMission, readLessons, readMissionTree, recordClaim, recordExperimentResult, recordReview, recordSource, replaceLessons, verifyReview;
let initializeResearchWorkspace, updateResearchMainline, openDoveWorkspace;
let loaded = false;

async function storeModules() {
  if (loaded) return;
  const [stores, workspaceInit, workspaceSchema] = await Promise.all([
    import("../core/research-stores.mjs"),
    import("../core/workspace-init.mjs"),
    import("../core/workspace-schema.mjs")
  ]);
  ({ concludeMission, createExperimentPlan, createMission, readLessons, readMissionTree, recordClaim, recordExperimentResult, recordReview, recordSource, replaceLessons, verifyReview } = stores);
  ({ initializeResearchWorkspace, updateResearchMainline } = workspaceInit);
  ({ openDoveWorkspace } = workspaceSchema);
  loaded = true;
}

function records(root, directory, accept = () => true) {
  const full = path.join(root, directory);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && accept(entry.name))
    .map((entry) => readResearchJson(root, path.posix.join(directory, entry.name)));
}

function absentResearchProjection(inspection, args) {
  return {
    status: "absent",
    reason: "research-workspace-not-initialized",
    workspaceState: inspection.state,
    zeroWrite: true,
    query: true,
    view: args.operation,
    selectedMissionIds: [],
    inventory: { workspace: 0, missions: 0, sources: 0, experimentPlans: 0, experimentResults: 0, claims: 0, reviews: 0, lessons: 0 },
    guidance: "Continue with read-only exploration of ordinary project material outside Dove state. Initialize a Research Workspace only on an explicit request."
  };
}

function researchModel(root) {
  const opened = openDoveWorkspace(root, { operation: "Research projection" });
  const tree = readMissionTree(root);
  const experiments = new Map();
  for (const plan of records(root, ARTIFACT_PATHS.experimentsDir, (name) => name.endsWith(".plan.json"))) experiments.set(plan.experimentId, { plan, result: null });
  for (const result of records(root, ARTIFACT_PATHS.experimentsDir, (name) => name.endsWith(".result.json"))) experiments.set(result.experimentId, { plan: experiments.get(result.experimentId)?.plan ?? null, result });
  return {
    workspace: opened.workspaceRecord,
    missions: [...tree.missions.values()],
    sources: records(root, ARTIFACT_PATHS.sourcesDir),
    experiments: [...experiments.values()],
    claims: records(root, ARTIFACT_PATHS.claimsDir),
    reviews: records(root, ARTIFACT_PATHS.reviewsDir),
    lessons: readLessons(root)
  };
}

function queryResearch(root, args) {
  const inspection = openDoveWorkspace(root, { operation: "Research projection", allowAbsent: true });
  if (inspection.state === "absent" || inspection.state === "research-absent") return absentResearchProjection(inspection, args);
  const context = buildResearchContext(researchModel(root));
  return queryResearchContext(context, {
    view: args.operation,
    ...(args.missionId ? { missionIds: [args.missionId] } : {}),
    ...(args.branchMissionIds ? { branchMissionIds: args.branchMissionIds } : {})
  });
}

function manageWorkspace(root, args) {
  const changeSummary = args.changeReason ?? (args.operation === "initialize" ? "Established the initial research direction." : "Updated the current research direction.");
  if (args.operation === "initialize") return initializeResearchWorkspace(root, { ...withoutOperation(args), changeSummary });
  if (args.operation === "set-mainline") return updateResearchMainline(root, { ...withoutOperation(args), changeSummary });
  throw new Error(`Unsupported workspace operation: ${args.operation}.`);
}

function withoutOperation(args) { return Object.fromEntries(Object.entries(args).filter(([field]) => field !== "operation")); }

function manageMissions(root, args) {
  if (args.operation === "query") return queryResearch(root, { operation: "overview", ...(args.missionId ? { missionId: args.missionId } : {}) });
  if (args.operation === "create") return createMission(root, { ...withoutOperation(args), parentMissionId: null, branchKind: null, branchReason: null });
  if (args.operation === "branch") return createMission(root, withoutOperation(args));
  if (args.operation === "conclude") return concludeMission(root, withoutOperation(args));
  throw new Error(`Unsupported mission operation: ${args.operation}.`);
}

function manageSources(root, args) {
  if (args.operation === "query") return queryResearch(root, { operation: "related-work", missionId: args.missionId });
  if (args.operation === "record") return recordSource(root, withoutOperation(args));
  throw new Error(`Unsupported source operation: ${args.operation}.`);
}

function manageExperiments(root, args) {
  if (args.operation === "query") return queryResearch(root, { operation: args.view ?? "result-synthesis", missionId: args.missionId });
  if (args.operation === "freeze") return createExperimentPlan(root, withoutOperation(args));
  if (args.operation === "record-result") return recordExperimentResult(root, withoutOperation(args));
  throw new Error(`Unsupported experiment operation: ${args.operation}.`);
}

function manageClaims(root, args) {
  if (args.operation === "query") return queryResearch(root, { operation: "claim-story", missionId: args.missionId });
  if (args.operation === "record") return { status: "recorded", claims: args.claims.map((claim) => recordClaim(root, { ...claim, missionId: args.missionId })) };
  throw new Error(`Unsupported claim operation: ${args.operation}.`);
}

function reviewSnapshots(root, artifactPaths) {
  const workspace = fs.realpathSync.native(path.resolve(root));
  return artifactPaths.map((value, index) => {
    const relativePath = normalizedRelativePath(value, `Review artifactPaths[${index}]`);
    const fullPath = path.join(workspace, relativePath);
    const stat = fs.lstatSync(fullPath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Review artifactPaths[${index}] must be a regular file without symbolic links.`);
    const bytes = fs.readFileSync(fullPath);
    return { path: relativePath, sizeBytes: bytes.byteLength, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
  });
}

function prepareReview(root, args) {
  if (!Array.isArray(args.artifactPaths) || args.artifactPaths.length === 0) throw new Error("Review preparation requires artifactPaths.");
  const reviewedArtifacts = reviewSnapshots(root, args.artifactPaths);
  return {
    status: "ready",
    zeroWrite: true,
    missionId: args.missionId,
    exchangeId: args.exchangeId,
    reviewedArtifacts,
    instructions: "Give this frozen package to a separate reviewer session selected and managed by the user. Dove does not launch the reviewer or establish its independence.",
    authority: "not-established"
  };
}

function manageReviews(root, args) {
  if (args.operation === "local-preflight" || args.operation === "prepare") return prepareReview(root, args);
  if (args.operation === "import") return recordReview(root, {
    reviewId: args.reviewId ?? args.exchangeId,
    missionId: args.missionId,
    artifactPaths: args.artifactPaths,
    status: args.review.status,
    verdict: args.review.verdict,
    summary: args.review.summary,
    rubric: args.review.rubric,
    findings: args.review.findings,
    actionItems: args.review.actionItems,
    report: args.review.report,
    provenance: args.review.provenance,
    limitations: args.review.limitations,
    reviewedAt: args.review.reviewedAt
  });
  if (args.operation === "coverage") {
    if (args.reviewId) return verifyReview(root, args.reviewId);
    return queryResearch(root, { operation: "reviews", missionId: args.missionId });
  }
  throw new Error(`Unsupported review operation: ${args.operation}.`);
}

function manageLessons(root, args) {
  if (args.operation === "read") {
    const inspection = openDoveWorkspace(root, { operation: "Lessons read", allowAbsent: true });
    if (inspection.state === "absent" || inspection.state === "research-absent") return absentResearchProjection(inspection, { operation: "lessons" });
    return { status: "ok", zeroWrite: true, markdown: readLessons(root) };
  }
  return { status: "replaced", markdown: replaceLessons(root, args.markdown) };
}

export async function invokeResearchAdapter(root, name, args) {
  await storeModules();
  switch (name) {
    case "query_dove_research": return queryResearch(root, args);
    case "manage_dove_workspace": return manageWorkspace(root, args);
    case "manage_dove_missions": return manageMissions(root, args);
    case "manage_dove_sources": return manageSources(root, args);
    case "manage_dove_experiments": return manageExperiments(root, args);
    case "manage_dove_claims": return manageClaims(root, args);
    case "manage_dove_reviews": return manageReviews(root, args);
    case "manage_dove_lessons": return manageLessons(root, args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
