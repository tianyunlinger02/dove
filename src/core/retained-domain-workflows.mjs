import fs from "node:fs";
import path from "node:path";

import { assessMissionCompletion } from "./completion-gates.mjs";
import {
  assertSealedDomainArgs,
  canonicalDomainPath,
  domainJson,
  domainNonEmptyText,
  domainSafeId,
  domainSha256,
  domainStringArray,
  finalizeDomainArtifacts,
  readCurrentMission,
  resolveMissionArtifactReferences
} from "./domain-artifacts.mjs";
import { readArtifactOwnership } from "./artifact-lineage.mjs";
import { verifyExpectedReviewCoverage, verifyReviewCoverage } from "./review-exchange.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { evaluateNoteReferences, evaluateSourceReferences } from "./source-trust.mjs";
import { readJson } from "./workspace.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

const NOTE_FIELDS = new Set(["missionId", "noteId", "title", "summary", "quotes", "claims", "openQuestions", "sourceIds", "artifactRefs"]);
const CLAIM_FIELDS = new Set(["missionId", "claims"]);
const CLAIM_ITEM_FIELDS = new Set(["claimId", "text", "sourceIds", "noteIds", "artifactRefs", "experimentResultIds", "gap"]);
const DRAFT_FIELDS = new Set(["missionId", "draftId", "title", "body", "summary", "evidenceRefs", "artifactRefs"]);
const DRAFT_META_FIELDS = new Set(["missionId", "draftId", "title", "summary", "evidenceRefs", "artifactRefs"]);
const EXPERIMENT_FIELDS = new Set(["missionId", "experimentId", "title", "goal", "hypothesis", "protocol", "successCriteria", "comparisonTargets", "result", "resultEvidenceRefs", "auditFindings", "integrityFlags", "claimId", "bridgeReason"]);
const FIGURE_FIELDS = new Set(["missionId", "figureId", "intent", "purpose", "materials", "prompt", "outputPath", "outputSha256", "caption", "qaFindings"]);
const REBUTTAL_FIELDS = new Set(["missionId", "issues", "strategy", "responses"]);
const VERSION_FIELDS = new Set(["missionId", "versionId", "label", "artifactRefs", "supersedesVersionId", "finalize"]);
const COMPARE_FIELDS = new Set(["missionId", "fromVersionId", "toVersionId"]);

function filePath(directory, id, extension = "json") {
  return path.posix.join(directory, `${id}.${extension}`);
}

function existingBoundRecord(root, relativePath, missionId, label) {
  const current = fs.existsSync(path.resolve(root, relativePath)) ? readJson(root, relativePath, null) : null;
  if (current && current.missionId !== missionId) throw new Error(`${label} belongs to mission ${current.missionId}, not ${missionId}.`);
  return current;
}

function currentBoundRecord(root, relativePath, missionId, label) {
  resolveMissionArtifactReferences(root, missionId, [relativePath], `${label} artifact`);
  const current = readJson(root, relativePath, null);
  if (!current || current.missionId !== missionId) throw new Error(`${label} is not a current record for mission ${missionId}.`);
  return current;
}

function normalizeFindingRefs(root, missionId, values, label) {
  return domainStringArray(values, label, { minItems: 1 }).map((reference, index) => {
    const separator = reference.lastIndexOf("#");
    if (separator <= 0 || separator === reference.length - 1) throw new Error(`${label}[${index}] must use <review-artifact-path>#<finding-id>.`);
    const artifactPath = reference.slice(0, separator);
    const findingId = domainSafeId(reference.slice(separator + 1), `${label}[${index}] finding id`);
    const [artifact] = resolveMissionArtifactReferences(root, missionId, [artifactPath], `${label}[${index}]`);
    let review;
    try {
      review = readJson(root, artifact.path, null);
    } catch {
      throw new Error(`${label}[${index}] must reference a JSON review artifact.`);
    }
    const findings = Array.isArray(review?.findings) ? review.findings : [];
    const finding = findings.find((item) => item && typeof item === "object" && (item.findingId === findingId || item.id === findingId));
    if (review?.missionId !== missionId || !finding) throw new Error(`${label}[${index}] does not resolve to a mission-bound review finding.`);
    return `${artifact.path}#${findingId}`;
  });
}

function normalizeEvidenceRefs(root, missionId, values, label = "evidenceRefs") {
  const references = domainStringArray(values, label);
  return references.map((reference, index) => {
    if (reference.startsWith("source:")) {
      const id = reference.slice("source:".length);
      const evaluation = evaluateSourceReferences(root, [id], missionId)[0];
      if (!evaluation?.eligible) throw new Error(`${label}[${index}] is not eligible source evidence: ${evaluation?.reason ?? "unknown-source"}.`);
      return reference;
    }
    if (reference.startsWith("note:")) {
      const id = reference.slice("note:".length);
      const evaluation = evaluateNoteReferences(root, [id], missionId)[0];
      if (!evaluation?.eligible) throw new Error(`${label}[${index}] is not eligible note evidence: ${evaluation?.reason ?? "unknown-note"}.`);
      return reference;
    }
    const artifactPath = reference.startsWith("artifact:") ? reference.slice("artifact:".length) : reference;
    const [artifact] = resolveMissionArtifactReferences(root, missionId, [artifactPath], `${label}[${index}]`);
    return `artifact:${artifact.path}`;
  });
}

function artifactRefsFromEvidence(references) {
  return references.filter((item) => item.startsWith("artifact:")).map((item) => item.slice("artifact:".length));
}

function normalizeRebuttalIssueItems(root, missionId, items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("normalize_rebuttal_issues requires at least one issue.");
  return items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`issues[${index}] must be an object.`);
    const unknown = Object.keys(item).filter((field) => !["issueId", "summary", "findingRefs", "evidenceRefs"].includes(field));
    if (unknown.length) throw new Error(`issues[${index}] does not accept unknown input: ${unknown.join(", ")}.`);
    return { issueId: domainSafeId(item.issueId, `issues[${index}].issueId`), summary: domainNonEmptyText(item.summary, `issues[${index}].summary`), findingRefs: normalizeFindingRefs(root, missionId, item.findingRefs, `issues[${index}].findingRefs`), evidenceRefs: normalizeEvidenceRefs(root, missionId, item.evidenceRefs, `issues[${index}].evidenceRefs`) };
  });
}

function rebuttalIssuesRecord(missionId, issues) {
  return { schemaVersion: 1, missionId, issues, updatedAt: new Date().toISOString() };
}

function rebuttalStrategyRecord(missionId, issues, strategy) {
  return { schemaVersion: 1, missionId, strategy: domainNonEmptyText(strategy, "strategy"), issueIds: issues.map((item) => item.issueId), updatedAt: new Date().toISOString() };
}

export function upsertNote(root, args = {}) {
  assertSealedDomainArgs(args, NOTE_FIELDS, "upsert_note");
  const { mission } = readCurrentMission(root, args.missionId, "Note workflow");
  const noteId = domainSafeId(args.noteId, "noteId");
  const summary = typeof args.summary === "string" ? args.summary.trim() : "";
  const quotes = domainStringArray(args.quotes, "quotes");
  const claims = domainStringArray(args.claims, "claims");
  const openQuestions = domainStringArray(args.openQuestions, "openQuestions");
  if (!summary && quotes.length === 0 && claims.length === 0 && openQuestions.length === 0) throw new Error("upsert_note requires substantive synthesis content.");
  const sourceIds = domainStringArray(args.sourceIds, "sourceIds");
  if (sourceIds.length > 0) {
    const failures = evaluateSourceReferences(root, sourceIds, mission.missionId).filter((item) => !item.eligible);
    if (failures.length) throw new Error(`upsert_note rejects ineligible sources: ${failures.map((item) => `${item.reference} (${item.reason})`).join(", ")}.`);
  }
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, args.artifactRefs, "artifactRefs");
  if (sourceIds.length === 0 && artifacts.length === 0) throw new Error("upsert_note requires at least one verified source or current mission artifact reference.");
  const relativePath = filePath(".dove/notes", noteId);
  existingBoundRecord(root, relativePath, mission.missionId, `Note ${noteId}`);
  const note = {
    schemaVersion: 1,
    noteId,
    missionId: mission.missionId,
    title: typeof args.title === "string" && args.title.trim() ? args.title.trim() : noteId,
    summary: summary || null,
    quotes,
    claims,
    openQuestions,
    sourceIds,
    artifactRefs: artifacts.map((item) => item.path),
    updatedAt: new Date().toISOString()
  };
  return { ...finalizeDomainArtifacts(root, { actionId: "upsert-note", missionId: mission.missionId, summary: `Recorded note ${noteId}.`, completionEligible: false, writes: [{ path: relativePath, kind: "data", content: domainJson(note), derivedReferences: [...sourceIds.map((id) => `source:${id}`), ...note.artifactRefs.map((item) => `artifact:${item}`)] }] }), note };
}

export function upsertClaims(root, args = {}) {
  assertSealedDomainArgs(args, CLAIM_FIELDS, "upsert_claims");
  const { mission } = readCurrentMission(root, args.missionId, "Claim workflow");
  if (!Array.isArray(args.claims) || args.claims.length === 0) throw new Error("upsert_claims requires at least one claim.");
  const writes = args.claims.map((item, index) => {
    assertSealedDomainArgs(item, CLAIM_ITEM_FIELDS, `claims[${index}]`);
    const claimId = domainSafeId(item.claimId, `claims[${index}].claimId`);
    const sourceIds = domainStringArray(item.sourceIds, `claims[${index}].sourceIds`);
    const noteIds = domainStringArray(item.noteIds, `claims[${index}].noteIds`);
    const evidenceRefs = normalizeEvidenceRefs(root, mission.missionId, [
      ...sourceIds.map((id) => `source:${id}`),
      ...noteIds.map((id) => `note:${id}`),
      ...domainStringArray(item.artifactRefs, `claims[${index}].artifactRefs`).map((value) => `artifact:${value}`)
    ], `claims[${index}].evidenceRefs`);
    const resultIds = domainStringArray(item.experimentResultIds, `claims[${index}].experimentResultIds`);
    for (const resultId of resultIds) {
      const result = currentBoundRecord(root, filePath(".dove/experiments", `${resultId}.result`), mission.missionId, `Experiment result ${resultId}`);
      const audit = currentBoundRecord(root, filePath(".dove/experiments", `${resultId}.audit`), mission.missionId, `Experiment audit ${resultId}`);
      if (result.audit?.passed !== true || audit.passed !== true || result.audit.auditId !== audit.auditId) throw new Error(`Claim ${claimId} requires an audited mission-bound experiment result: ${resultId}.`);
    }
    if (evidenceRefs.length === 0 && resultIds.length === 0) throw new Error(`Claim ${claimId} requires eligible evidence.`);
    const relativePath = filePath(".dove/claims", claimId);
    existingBoundRecord(root, relativePath, mission.missionId, `Claim ${claimId}`);
    const claim = { schemaVersion: 1, claimId, missionId: mission.missionId, text: domainNonEmptyText(item.text, `claims[${index}].text`), evidenceRefs, experimentResultIds: resultIds, gap: typeof item.gap === "string" && item.gap.trim() ? item.gap.trim() : null, updatedAt: new Date().toISOString() };
    return { path: relativePath, kind: "data", content: domainJson(claim), derivedReferences: [...evidenceRefs, ...resultIds.map((id) => `experiment-result:${id}`)] };
  });
  return finalizeDomainArtifacts(root, { actionId: "upsert-claims", missionId: mission.missionId, summary: `Recorded ${writes.length} evidence-backed claim(s).`, completionEligible: false, writes });
}

function draftContent(draft) {
  return `# ${draft.title}\n\n${draft.body}\n\n---\nMission: ${draft.missionId}\nEvidence: ${draft.evidenceRefs.join(", ") || "none"}\n`;
}

export function upsertDraft(root, args = {}) {
  assertSealedDomainArgs(args, DRAFT_FIELDS, "upsert_draft");
  const { mission } = readCurrentMission(root, args.missionId, "Draft workflow");
  const draftId = domainSafeId(args.draftId, "draftId");
  const evidenceRefs = normalizeEvidenceRefs(root, mission.missionId, [...domainStringArray(args.evidenceRefs, "evidenceRefs"), ...domainStringArray(args.artifactRefs, "artifactRefs").map((value) => `artifact:${value}`)]);
  const draft = { schemaVersion: 1, draftId, missionId: mission.missionId, title: typeof args.title === "string" && args.title.trim() ? args.title.trim() : draftId, body: domainNonEmptyText(args.body, "body"), summary: typeof args.summary === "string" && args.summary.trim() ? args.summary.trim() : null, evidenceRefs, updatedAt: new Date().toISOString() };
  const relativePath = filePath(".dove/drafts", draftId, "md");
  return { ...finalizeDomainArtifacts(root, { actionId: "upsert-draft", missionId: mission.missionId, summary: `Recorded draft ${draftId}.`, completionEligible: true, writes: [{ path: relativePath, kind: "document", content: draftContent(draft), derivedReferences: evidenceRefs }] }), draft };
}

export function upsertDraftMetadata(root, args = {}) {
  assertSealedDomainArgs(args, DRAFT_META_FIELDS, "upsert_draft_metadata");
  const { mission } = readCurrentMission(root, args.missionId, "Draft metadata workflow");
  const draftId = domainSafeId(args.draftId, "draftId");
  const draftPath = filePath(".dove/drafts", draftId, "md");
  resolveMissionArtifactReferences(root, mission.missionId, [draftPath], "draftPath");
  const evidenceRefs = normalizeEvidenceRefs(root, mission.missionId, [...domainStringArray(args.evidenceRefs, "evidenceRefs"), ...domainStringArray(args.artifactRefs, "artifactRefs").map((value) => `artifact:${value}`)]);
  const metadataPath = filePath(".dove/drafts", `${draftId}.metadata`);
  const metadata = { schemaVersion: 1, draftId, missionId: mission.missionId, title: typeof args.title === "string" && args.title.trim() ? args.title.trim() : draftId, summary: typeof args.summary === "string" && args.summary.trim() ? args.summary.trim() : null, evidenceRefs, draftPath, updatedAt: new Date().toISOString() };
  return finalizeDomainArtifacts(root, { actionId: "upsert-draft-metadata", missionId: mission.missionId, summary: `Recorded metadata for draft ${draftId}.`, completionEligible: false, writes: [{ path: metadataPath, kind: "data", content: domainJson(metadata), derivedReferences: [`artifact:${draftPath}`, ...evidenceRefs] }] });
}

export function runExperienceWorkflow(root, args = {}) {
  assertSealedDomainArgs(args, EXPERIMENT_FIELDS, "run_experience_workflow");
  const { mission } = readCurrentMission(root, args.missionId, "Experiment workflow");
  const experimentId = domainSafeId(args.experimentId, "experimentId");
  const protocol = domainNonEmptyText(args.protocol, "protocol");
  const successCriteria = domainStringArray(args.successCriteria, "successCriteria", { minItems: 1 });
  const plan = { schemaVersion: 1, experimentId, missionId: mission.missionId, title: typeof args.title === "string" && args.title.trim() ? args.title.trim() : experimentId, goal: domainNonEmptyText(args.goal, "goal"), hypothesis: domainNonEmptyText(args.hypothesis, "hypothesis"), protocol, successCriteria, comparisonTargets: domainStringArray(args.comparisonTargets, "comparisonTargets"), updatedAt: new Date().toISOString() };
  const writes = [{ path: filePath(".dove/experiments", `${experimentId}.plan`), kind: "data", content: domainJson(plan), derivedReferences: [] }];
  let result = null;
  let audit = null;
  let bridge = null;
  if (args.result !== undefined) {
    const resultEvidenceRefs = normalizeEvidenceRefs(root, mission.missionId, args.resultEvidenceRefs, "resultEvidenceRefs");
    if (resultEvidenceRefs.length === 0) throw new Error("Experiment result requires current mission-bound evidence.");
    result = { schemaVersion: 1, resultId: experimentId, experimentId, missionId: mission.missionId, outcome: domainNonEmptyText(args.result, "result"), evidenceRefs: resultEvidenceRefs, updatedAt: new Date().toISOString() };
    writes.push({ path: filePath(".dove/experiments", `${experimentId}.result`), kind: "data", content: domainJson(result), derivedReferences: resultEvidenceRefs });
    const auditFindings = domainStringArray(args.auditFindings, "auditFindings");
    const integrityFlags = domainStringArray(args.integrityFlags, "integrityFlags");
    if (auditFindings.length === 0) throw new Error("Experiment result requires an explicit audit before claim bridging.");
    audit = { schemaVersion: 1, auditId: experimentId, experimentId, resultId: experimentId, missionId: mission.missionId, findings: auditFindings, integrityFlags, passed: integrityFlags.length === 0, updatedAt: new Date().toISOString() };
    result.audit = { passed: audit.passed, auditId: audit.auditId };
    writes[writes.length - 1] = { ...writes.at(-1), content: domainJson(result) };
    writes.push({ path: filePath(".dove/experiments", `${experimentId}.audit`), kind: "data", content: domainJson(audit), derivedReferences: [`experiment-result:${experimentId}`] });
    if (args.claimId !== undefined) {
      if (!audit.passed) throw new Error("Experiment result cannot bridge to a claim while integrity flags remain.");
      const claimId = domainSafeId(args.claimId, "claimId");
      currentBoundRecord(root, filePath(".dove/claims", claimId), mission.missionId, `Claim ${claimId}`);
      bridge = { schemaVersion: 1, bridgeId: `${experimentId}-${claimId}`, missionId: mission.missionId, experimentId, resultId: experimentId, auditId: experimentId, claimId, reason: domainNonEmptyText(args.bridgeReason, "bridgeReason"), updatedAt: new Date().toISOString() };
      writes.push({ path: filePath(".dove/claims", `${experimentId}-${claimId}.bridge`), kind: "data", content: domainJson(bridge), derivedReferences: [`experiment-result:${experimentId}`, `claim:${claimId}`] });
    }
  } else if (args.auditFindings !== undefined || args.integrityFlags !== undefined || args.claimId !== undefined) {
    throw new Error("Experiment audit or claim bridge requires a real result and result evidence.");
  }
  return { ...finalizeDomainArtifacts(root, { actionId: "run-experience-workflow", missionId: mission.missionId, summary: result ? `Recorded experiment ${experimentId} plan, result, and audit.` : `Recorded experiment ${experimentId} protocol.`, completionEligible: Boolean(result && audit?.passed), writes }), plan, result, audit, bridge, hostBoundary: { executesExperiment: false, providerScheduling: false } };
}

function currentOutput(root, outputPath, expectedHash) {
  const canonical = canonicalDomainPath(outputPath, "outputPath");
  if (!fs.existsSync(path.resolve(root, canonical))) throw new Error("Figure outputPath does not exist.");
  const actual = domainSha256(fs.readFileSync(path.resolve(root, canonical)));
  if (expectedHash && expectedHash !== actual) throw new Error("Figure output hash does not match the imported file.");
  return { path: canonical, sha256: actual };
}

export function runFigureWorkflow(root, args = {}) {
  assertSealedDomainArgs(args, FIGURE_FIELDS, "run_figure_workflow");
  const { mission } = readCurrentMission(root, args.missionId, "Figure workflow");
  const figureId = domainSafeId(args.figureId, "figureId");
  const materials = resolveMissionArtifactReferences(root, mission.missionId, args.materials, "materials");
  if (materials.length === 0) throw new Error("Figure workflow requires current mission-bound materials.");
  const prompt = domainNonEmptyText(args.prompt, "prompt");
  const writes = [];
  const plan = { schemaVersion: 1, figureId, missionId: mission.missionId, intent: domainNonEmptyText(args.intent, "intent"), purpose: domainNonEmptyText(args.purpose, "purpose"), materialRefs: materials.map((item) => item.path), prompt, hostBoundary: "provider-execution-outside-dove", updatedAt: new Date().toISOString() };
  writes.push({ path: filePath(".dove/figures", `${figureId}.plan`), kind: "data", content: domainJson(plan), derivedReferences: plan.materialRefs.map((item) => `artifact:${item}`) });
  let imported = null;
  let qa = null;
  if (args.outputPath !== undefined) {
    const output = currentOutput(root, args.outputPath, args.outputSha256);
    const sourceContent = fs.readFileSync(path.resolve(root, output.path));
    const extension = path.extname(output.path).toLowerCase() || ".bin";
    const finalPath = filePath(".dove/figures", `${figureId}.final`, extension.slice(1));
    const caption = domainNonEmptyText(args.caption, "caption");
    const qaFindings = domainStringArray(args.qaFindings, "qaFindings");
    const coverage = verifyExpectedReviewCoverage(root, {
      missionId: mission.missionId,
      expectedSnapshots: [{ path: finalPath, sizeBytes: sourceContent.length, sha256: output.sha256 }],
      requireAuthoritative: true
    });
    imported = { schemaVersion: 1, figureId, missionId: mission.missionId, importedFrom: output.path, finalPath, finalSha256: output.sha256, caption, provenance: { materialRefs: plan.materialRefs, promptSha256: domainSha256(prompt) }, validated: false, updatedAt: new Date().toISOString() };
    qa = { schemaVersion: 1, figureId, missionId: mission.missionId, finalPath, finalSha256: output.sha256, findings: qaFindings, reviewCoverage: coverage, status: imported.validated ? "validated" : qaFindings.length ? "needs-fix" : "ready-for-independent-review", updatedAt: new Date().toISOString() };
    writes.push({ path: finalPath, kind: "figure", content: sourceContent, derivedReferences: plan.materialRefs.map((item) => `artifact:${item}`) });
    writes.push({ path: filePath(".dove/figures", `${figureId}.caption`, "md"), kind: "document", content: `${caption}\n`, derivedReferences: [`artifact:${finalPath}`] });
    writes.push({ path: filePath(".dove/figures", `${figureId}.provenance`), kind: "data", content: domainJson(imported), derivedReferences: [`artifact:${finalPath}`, ...plan.materialRefs.map((item) => `artifact:${item}`)] });
    writes.push({ path: filePath(".dove/figures", `${figureId}.qa`), kind: "data", content: domainJson(qa), derivedReferences: [`artifact:${finalPath}`] });
  } else if (args.caption !== undefined || args.qaFindings !== undefined || args.outputSha256 !== undefined) {
    throw new Error("Figure caption, QA, or hash import requires outputPath.");
  }
  return { ...finalizeDomainArtifacts(root, { actionId: "run-figure-workflow", missionId: mission.missionId, summary: imported ? `Imported figure ${figureId} with provenance and QA.` : `Prepared figure ${figureId} materials and prompt.`, completionEligible: imported?.validated === true, writes }), plan, imported, qa, hostBoundary: { executesProvider: false, acceptsImportedOutput: true } };
}

export function normalizeRebuttalIssues(root, args = {}) {
  assertSealedDomainArgs(args, new Set(["missionId", "issues"]), "normalize_rebuttal_issues");
  const { mission } = readCurrentMission(root, args.missionId, "Rebuttal issue normalization");
  const issues = normalizeRebuttalIssueItems(root, mission.missionId, args.issues);
  const record = rebuttalIssuesRecord(mission.missionId, issues);
  return finalizeDomainArtifacts(root, { actionId: "normalize-rebuttal-issues", missionId: mission.missionId, summary: `Normalized ${issues.length} rebuttal issue(s).`, completionEligible: false, writes: [{ path: filePath(".dove/rebuttal", `${mission.missionId}.issues`), kind: "data", content: domainJson(record), derivedReferences: issues.flatMap((item) => [...item.findingRefs.map((id) => `finding:${id}`), ...item.evidenceRefs]) }] });
}

export function buildRebuttalStrategy(root, args = {}) {
  assertSealedDomainArgs(args, new Set(["missionId", "strategy"]), "build_rebuttal_strategy");
  const { mission } = readCurrentMission(root, args.missionId, "Rebuttal strategy");
  const issuesPath = filePath(".dove/rebuttal", `${mission.missionId}.issues`);
  const issues = currentBoundRecord(root, issuesPath, mission.missionId, "Rebuttal issues");
  if (!issues?.issues?.length) throw new Error("build_rebuttal_strategy requires normalized mission-bound issues.");
  const strategy = rebuttalStrategyRecord(mission.missionId, issues.issues, args.strategy);
  return finalizeDomainArtifacts(root, { actionId: "build-rebuttal-strategy", missionId: mission.missionId, summary: "Recorded author-side rebuttal strategy.", completionEligible: false, writes: [{ path: filePath(".dove/rebuttal", `${mission.missionId}.strategy`), kind: "data", content: domainJson(strategy), derivedReferences: [`artifact:${issuesPath}`] }] });
}

export function buildRebuttal(root, args = {}) {
  assertSealedDomainArgs(args, REBUTTAL_FIELDS, "build_rebuttal");
  const { mission } = readCurrentMission(root, args.missionId, "Rebuttal workflow");
  const issuesPath = filePath(".dove/rebuttal", `${mission.missionId}.issues`);
  const strategyPath = filePath(".dove/rebuttal", `${mission.missionId}.strategy`);
  const writes = [];
  const issues = args.issues !== undefined
    ? rebuttalIssuesRecord(mission.missionId, normalizeRebuttalIssueItems(root, mission.missionId, args.issues))
    : currentBoundRecord(root, issuesPath, mission.missionId, "Rebuttal issues");
  if (!issues?.issues?.length) throw new Error("build_rebuttal requires normalized mission-bound issues.");
  if (args.issues !== undefined) {
    writes.push({ path: issuesPath, kind: "data", content: domainJson(issues), derivedReferences: issues.issues.flatMap((item) => [...item.findingRefs.map((id) => `finding:${id}`), ...item.evidenceRefs]) });
  }
  const strategy = args.strategy !== undefined
    ? rebuttalStrategyRecord(mission.missionId, issues.issues, args.strategy)
    : currentBoundRecord(root, strategyPath, mission.missionId, "Rebuttal strategy");
  if (!strategy?.strategy || strategy.missionId !== mission.missionId) throw new Error("build_rebuttal requires an author-side strategy for the requested mission.");
  if (args.strategy !== undefined) {
    writes.push({ path: strategyPath, kind: "data", content: domainJson(strategy), derivedReferences: [`artifact:${issuesPath}`] });
  }
  if (!Array.isArray(args.responses) || args.responses.length === 0) throw new Error("build_rebuttal requires evidence-linked responses.");
  const responses = args.responses.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`responses[${index}] must be an object.`);
    const unknown = Object.keys(item).filter((field) => !["issueId", "response", "evidenceRefs"].includes(field));
    if (unknown.length) throw new Error(`responses[${index}] does not accept unknown input: ${unknown.join(", ")}.`);
    const issueId = domainSafeId(item.issueId, `responses[${index}].issueId`);
    if (!issues.issues.some((issue) => issue.issueId === issueId)) throw new Error(`responses[${index}] references unknown issue ${issueId}.`);
    const evidenceRefs = normalizeEvidenceRefs(root, mission.missionId, item.evidenceRefs, `responses[${index}].evidenceRefs`);
    if (evidenceRefs.length === 0) throw new Error(`responses[${index}] requires evidence.`);
    return { issueId, response: domainNonEmptyText(item.response, `responses[${index}].response`), evidenceRefs };
  });
  const content = responses.map((item) => `## ${item.issueId}\n\n${item.response}\n\nEvidence: ${item.evidenceRefs.join(", ")}\n`).join("\n");
  writes.push({ path: filePath(".dove/rebuttal", `${mission.missionId}.response`, "md"), kind: "document", content, derivedReferences: [`artifact:${issuesPath}`, `artifact:${strategyPath}`, ...responses.flatMap((item) => item.evidenceRefs)] });
  return finalizeDomainArtifacts(root, { actionId: "build-rebuttal", missionId: mission.missionId, summary: "Recorded author-side rebuttal responses.", completionEligible: true, writes });
}

function versionPath(versionId) {
  return filePath(".dove/versions", versionId);
}

export function createVersionSnapshot(root, args = {}) {
  assertSealedDomainArgs(args, VERSION_FIELDS, "create_version_snapshot");
  const { mission } = readCurrentMission(root, args.missionId, "Version snapshot");
  const versionId = domainSafeId(args.versionId, "versionId");
  if (fs.existsSync(path.resolve(root, versionPath(versionId)))) throw new Error(`Version snapshot id is already occupied: ${versionId}.`);
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, args.artifactRefs, "artifactRefs");
  if (artifacts.length === 0) throw new Error("create_version_snapshot requires current mission artifacts.");
  const supersedesVersionId = args.supersedesVersionId === undefined ? null : domainSafeId(args.supersedesVersionId, "supersedesVersionId");
  if (supersedesVersionId) {
    currentBoundRecord(root, versionPath(supersedesVersionId), mission.missionId, `Superseded version ${supersedesVersionId}`);
  }
  const completion = assessMissionCompletion(root, { missionId: mission.missionId });
  const reviewCoverage = verifyReviewCoverage(root, { missionId: mission.missionId, artifactPaths: artifacts.map((item) => item.path), requireAuthoritative: true });
  const finalization = args.finalize === true ? { eligible: completion.complete && reviewCoverage.authoritative === true && reviewCoverage.failures.length === 0, completion, reviewCoverage } : null;
  if (args.finalize === true && !finalization.eligible) throw new Error("Version finalization requires current mission completion and current authoritative review proof.");
  const copiedArtifacts = artifacts.map(({ path: artifactPath, kind, sha256, receiptId }) => {
    const extension = path.extname(artifactPath);
    const snapshotPath = filePath(path.posix.join(".dove/versions", versionId, "artifacts"), domainSha256(artifactPath).slice(0, 20), extension ? extension.slice(1) : "bin");
    return { path: artifactPath, kind, sha256, receiptId, snapshotPath };
  });
  const snapshot = { schemaVersion: 1, versionId, missionId: mission.missionId, label: typeof args.label === "string" && args.label.trim() ? args.label.trim() : versionId, artifacts: copiedArtifacts, supersedesVersionId, finalization, createdAt: new Date().toISOString() };
  const writes = [
    ...copiedArtifacts.map((item) => ({ path: item.snapshotPath, kind: item.kind, content: fs.readFileSync(path.resolve(root, item.path)), derivedReferences: [`artifact:${item.path}`] })),
    { path: versionPath(versionId), kind: "data", content: domainJson(snapshot), derivedReferences: snapshot.artifacts.map((item) => `artifact:${item.path}`) }
  ];
  return finalizeDomainArtifacts(root, { actionId: "create-version-snapshot", missionId: mission.missionId, summary: `Created version snapshot ${versionId}.`, completionEligible: false, writes });
}

export function compareVersions(root, args = {}) {
  assertSealedDomainArgs(args, COMPARE_FIELDS, "compare_versions");
  const { mission } = readCurrentMission(root, args.missionId, "Version comparison");
  const fromVersionId = domainSafeId(args.fromVersionId, "fromVersionId");
  const toVersionId = domainSafeId(args.toVersionId, "toVersionId");
  const from = currentBoundRecord(root, versionPath(fromVersionId), mission.missionId, `Version ${fromVersionId}`);
  const to = currentBoundRecord(root, versionPath(toVersionId), mission.missionId, `Version ${toVersionId}`);
  const stale = [...from.artifacts, ...to.artifacts].filter((item) => {
    if (typeof item.snapshotPath !== "string") return true;
    const [snapshotArtifact] = resolveMissionArtifactReferences(root, mission.missionId, [item.snapshotPath], `Version snapshot ${item.snapshotPath}`);
    return snapshotArtifact.sha256 !== item.sha256;
  });
  if (stale.length) throw new Error(`Version comparison refuses stale artifact snapshots: ${[...new Set(stale.map((item) => item.snapshotPath ?? item.path))].join(", ")}.`);
  const fromMap = new Map(from.artifacts.map((item) => [item.path, item.sha256]));
  const toMap = new Map(to.artifacts.map((item) => [item.path, item.sha256]));
  const paths = [...new Set([...fromMap.keys(), ...toMap.keys()])].sort();
  const comparison = { schemaVersion: 1, missionId: mission.missionId, fromVersionId, toVersionId, added: paths.filter((item) => !fromMap.has(item)), removed: paths.filter((item) => !toMap.has(item)), changed: paths.filter((item) => fromMap.has(item) && toMap.has(item) && fromMap.get(item) !== toMap.get(item)), comparedAt: new Date().toISOString() };
  return finalizeDomainArtifacts(root, { actionId: "compare-versions", missionId: mission.missionId, summary: `Compared versions ${fromVersionId} and ${toVersionId}.`, completionEligible: false, writes: [{ path: filePath(".dove/versions", `${fromVersionId}--${toVersionId}.comparison`), kind: "data", content: domainJson(comparison), derivedReferences: [`version:${fromVersionId}`, `version:${toVersionId}`] }] });
}

export function queryDomainIntegrity(root) {
  const workspace = openDoveWorkspace(root, { operation: "Domain integrity query" });
  const ownership = readArtifactOwnership(root);
  const domainPrefixes = [".dove/sources/", ".dove/notes/", ".dove/claims/", ".dove/experiments/", ".dove/drafts/", ".dove/figures/", ".dove/rebuttal/", ".dove/versions/"];
  const domainArtifacts = ownership.artifacts.filter((item) => domainPrefixes.some((prefix) => item.path.startsWith(prefix)));
  const stale = domainArtifacts.filter((item) => !fs.existsSync(path.resolve(root, item.path)) || domainSha256(fs.readFileSync(path.resolve(root, item.path))) !== item.sha256);
  return { workspaceId: workspace.manifest.workspaceId, artifactCount: domainArtifacts.length, staleArtifactCount: stale.length, stalePaths: stale.map((item) => item.path) };
}
