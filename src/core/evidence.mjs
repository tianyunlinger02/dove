import { ARTIFACT_PATHS } from "./schema.mjs";
import { loadBoard, upsertOrchestrationBoard } from "./orchestration.mjs";
import { extractCitationKeysFromText, nowIso, readJson, readText, writeJson, writeText, listDraftFiles } from "./workspace.mjs";

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function normalizeClaim(claim, index) {
  return {
    id: slugify(claim.id ?? `claim-${index + 1}`),
    text: claim.text ?? "",
    sectionId: slugify(claim.sectionId ?? "introduction"),
    sourceIds: Array.isArray(claim.sourceIds) ? claim.sourceIds : [],
    noteIds: Array.isArray(claim.noteIds) ? claim.noteIds : [],
    experimentIds: Array.isArray(claim.experimentIds) ? claim.experimentIds : [],
    evidenceLinks: Array.isArray(claim.evidenceLinks) ? claim.evidenceLinks : [],
    status: claim.status ?? "draft",
    confidence: claim.confidence ?? "medium",
    gap: claim.gap ?? ""
  };
}

function renderClaimsMarkdown(claims) {
  return [
    "# Claims from results",
    "",
    ...claims.flatMap((claim) => [
      `## ${claim.id}`,
      "",
      `- Text: ${claim.text}`,
      `- Section: ${claim.sectionId}`,
      `- Source IDs: ${claim.sourceIds.join(", ") || "none"}`,
      `- Note IDs: ${claim.noteIds.join(", ") || "none"}`,
      `- Experiment IDs: ${claim.experimentIds.join(", ") || "none"}`,
      `- Evidence links: ${claim.evidenceLinks.join(", ") || "none"}`,
      `- Status: ${claim.status}`,
      `- Confidence: ${claim.confidence}`,
      claim.gap ? `- Gap: ${claim.gap}` : null,
      ""
    ].filter(Boolean))
  ].join("\n");
}

export function upsertClaims(root, args = {}) {
  const current = readJson(root, ARTIFACT_PATHS.evidence, { version: 2, claims: [], updatedAt: null });
  const sources = readJson(root, ARTIFACT_PATHS.sources, { version: 1, items: [], updatedAt: null });
  const notes = readJson(root, ARTIFACT_PATHS.notes, { version: 1, items: [], updatedAt: null });
  const sourceIds = new Set(sources.items.flatMap((item) => [item.id, item.citationKey].filter(Boolean)));
  const noteIds = new Set(notes.items.map((item) => item.id));
  const inputClaims = Array.isArray(args.claims) ? args.claims.map(normalizeClaim) : [];
  const merged = new Map((Array.isArray(current.claims) ? current.claims : []).map((claim, index) => {
    const normalized = normalizeClaim(claim, index);
    return [normalized.id, normalized];
  }));

  for (const claim of inputClaims) {
    if (!claim.text.trim()) {
      throw new Error(`Claim ${claim.id} must include text.`);
    }
    if (claim.sourceIds.length === 0) {
      throw new Error(`Claim ${claim.id} must reference at least one source.`);
    }
    const unknownSources = claim.sourceIds.filter((id) => !sourceIds.has(id));
    if (unknownSources.length > 0) {
      throw new Error(`Claim ${claim.id} references unknown sources: ${unknownSources.join(", ")}`);
    }
    const unknownNotes = claim.noteIds.filter((id) => !noteIds.has(id));
    if (unknownNotes.length > 0) {
      throw new Error(`Claim ${claim.id} references unknown notes: ${unknownNotes.join(", ")}`);
    }
    merged.set(claim.id, claim);
  }

    const claims = Array.from(merged.values()).sort((left, right) => left.id.localeCompare(right.id));
  const next = {
    version: 2,
    claims,
    updatedAt: nowIso()
  };
  writeJson(root, ARTIFACT_PATHS.evidence, next);
  writeText(root, ARTIFACT_PATHS.claims, renderClaimsMarkdown(claims));
  const board = loadBoard(root);
  upsertOrchestrationBoard(root, {
    phase: "plan",
    assignedRole: "planner",
    evidenceLinks: Array.from(new Set([...board.evidenceLinks, ARTIFACT_PATHS.claims, ARTIFACT_PATHS.evidence]))
  });
  return next;
}

export function evaluateEvidence(root) {
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 2, claims: [], updatedAt: null });
  const sources = readJson(root, ARTIFACT_PATHS.sources, { version: 1, items: [], updatedAt: null });
  const notes = readJson(root, ARTIFACT_PATHS.notes, { version: 1, items: [], updatedAt: null });
  const sourceById = new Map(sources.items.flatMap((item) => [[item.id, item], item.citationKey ? [item.citationKey, item] : null].filter(Boolean)));
  const noteIds = new Set(notes.items.map((item) => item.id));
  const unsupportedClaims = [];
  const weakClaims = [];
  const missingSourceRefs = [];
  const missingNoteRefs = [];
  const draftClaimMismatches = [];

  for (const claim of evidence.claims) {
    if (!Array.isArray(claim.sourceIds) || claim.sourceIds.length === 0) {
      unsupportedClaims.push(claim);
      continue;
    }
    const unknownSources = claim.sourceIds.filter((id) => !sourceById.has(id));
    if (unknownSources.length > 0) {
      missingSourceRefs.push({ claim, missing: unknownSources });
      unsupportedClaims.push(claim);
      continue;
    }
    const unknownNotes = (Array.isArray(claim.noteIds) ? claim.noteIds : []).filter((id) => !noteIds.has(id));
    if (unknownNotes.length > 0) {
      missingNoteRefs.push({ claim, missing: unknownNotes });
    }
    if (claim.sourceIds.length === 1 || claim.status === "weak") {
      weakClaims.push(claim);
    }

    const draftPath = `${ARTIFACT_PATHS.draftsDir}/${claim.sectionId}.md`;
    const draftContent = readText(root, draftPath, "");
    if (!draftContent) {
      draftClaimMismatches.push({ claim, reason: "missing-draft" });
      continue;
    }
    const citedKeys = new Set(extractCitationKeysFromText(draftContent));
    const expectedKeys = claim.sourceIds.flatMap((id) => {
      const source = sourceById.get(id);
      return source ? [source.id, source.citationKey].filter(Boolean) : [];
    });
    if (expectedKeys.length > 0 && !expectedKeys.some((key) => citedKeys.has(key))) {
      draftClaimMismatches.push({ claim, reason: "draft-missing-claim-citation", expectedKeys });
    }
  }

  const citationTodos = [];
  const missingCitationRefs = [];
  for (const draftFile of listDraftFiles(root)) {
    const content = readText(root, `${ARTIFACT_PATHS.draftsDir}/${draftFile}`, "");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/TODO\[citation\]|CITATION NEEDED|TODO: citation/i.test(line)) {
        citationTodos.push({ draftFile, line: index + 1, text: line.trim() });
      }
    });
    for (const key of extractCitationKeysFromText(content)) {
      if (!sourceById.has(key)) {
        missingCitationRefs.push({ draftFile, key });
      }
    }
  }

  return {
    unsupportedClaims,
    weakClaims,
    missingSourceRefs,
    missingNoteRefs,
    missingCitationRefs,
    draftClaimMismatches,
    citationTodos,
    claimCount: evidence.claims.length
  };
}
