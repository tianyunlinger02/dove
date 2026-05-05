import fs from "node:fs";
import path from "node:path";

import { ARTIFACT_PATHS, normalizeLifecycleFamilyId } from "./schema.mjs";
import { writeJson } from "./workspace.mjs";

const DEFAULT_EXCLUDED_DIRS = new Set([
  ".git",
  ".dove",
  ".agents",
  ".cache",
  ".claude",
  ".codex",
  ".cursor",
  ".opencode",
  ".trellis",
  ".next",
  ".pytest_cache",
  ".venv",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "docs",
  "mcp",
  "reference_repos",
  "scripts",
  "src",
  "tmp"
]);

const IMAGE_EXTENSIONS = new Set([".eps", ".jpeg", ".jpg", ".pdf", ".png", ".svg", ".tif", ".tiff"]);
const TABLE_EXTENSIONS = new Set([".csv", ".tsv", ".xlsx"]);
const RESULT_EXTENSIONS = new Set([".json", ".jsonl", ".npy", ".npz", ".pkl", ".parquet"]);
const NOTE_EXTENSIONS = new Set([".md", ".txt"]);

function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function safeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function classifyByName(relativePath) {
  const baseName = path.basename(relativePath).toLowerCase();
  const stem = baseName.replace(/\.[^.]+$/, "");
  const extension = path.extname(baseName);
  const pathParts = relativePath.toLowerCase().split("/");
  const parentHints = new Set(pathParts.slice(0, -1));

  if (extension === ".bib") {
    return {
      artifactType: "bibliography",
      lifecycleFamily: "knowledge",
      suggestedTarget: ARTIFACT_PATHS.bibliography,
      confidence: "high",
      reason: "BibTeX bibliography file."
    };
  }

  if (["main", "paper", "manuscript", "ms", "article"].includes(stem) && [".tex", ".md"].includes(extension)) {
    return {
      artifactType: "manuscript",
      lifecycleFamily: "structure",
      suggestedTarget: extension === ".md" ? `${ARTIFACT_PATHS.draftsDir}/${stem}.md` : ARTIFACT_PATHS.draftsDir,
      confidence: ["main", "paper", "manuscript"].includes(stem) ? "high" : "medium",
      reason: "Likely primary manuscript entrypoint."
    };
  }

  if (IMAGE_EXTENSIONS.has(extension) && [...parentHints].some((part) => ["fig", "figs", "figure", "figures", "images", "plots"].includes(part))) {
    return {
      artifactType: "figure",
      lifecycleFamily: "structure",
      suggestedTarget: ARTIFACT_PATHS.figuresIndex,
      confidence: "medium",
      reason: "Image or vector asset under a figure-like directory."
    };
  }

  if ((TABLE_EXTENSIONS.has(extension) && [...parentHints].some((part) => ["table", "tables", "data"].includes(part))) || /^table[-_\d]/.test(stem)) {
    return {
      artifactType: "table",
      lifecycleFamily: "structure",
      suggestedTarget: ARTIFACT_PATHS.figuresIndex,
      confidence: "medium",
      reason: "Likely table or tabular artifact."
    };
  }

  if ((RESULT_EXTENSIONS.has(extension) || TABLE_EXTENSIONS.has(extension)) && [...parentHints].some((part) => ["result", "results", "experiment", "experiments", "eval", "evaluation", "outputs"].includes(part))) {
    return {
      artifactType: "result",
      lifecycleFamily: "audit",
      suggestedTarget: ARTIFACT_PATHS.experimentResults,
      confidence: "medium",
      reason: "Likely experiment result or evaluation output."
    };
  }

  if (NOTE_EXTENSIONS.has(extension) && /note|notes|reading|literature|survey|annot/i.test(relativePath)) {
    return {
      artifactType: "note",
      lifecycleFamily: "knowledge",
      suggestedTarget: ARTIFACT_PATHS.notes,
      confidence: "medium",
      reason: "Likely research note or literature annotation."
    };
  }

  if (NOTE_EXTENSIONS.has(extension) && /review|reviewer|critique|decision|meta-review/i.test(relativePath)) {
    return {
      artifactType: "review",
      lifecycleFamily: "concern",
      suggestedTarget: ARTIFACT_PATHS.reviewConcerns,
      confidence: "medium",
      reason: "Likely reviewer feedback or decision artifact."
    };
  }

  if (/supplement|appendix|camera-ready|submission|cover[-_ ]?letter|rebuttal|response/i.test(relativePath) && [".tex", ".md", ".pdf", ".txt"].includes(extension)) {
    return {
      artifactType: "submission",
      lifecycleFamily: "structure",
      suggestedTarget: ARTIFACT_PATHS.versionsIndex,
      confidence: "low",
      reason: "Likely submission, appendix, rebuttal, or versioned paper artifact."
    };
  }

  return null;
}

function walkFiles(root, options = {}) {
  const maxDepth = safeInteger(options.maxDepth, 6);
  const maxFiles = safeInteger(options.maxFiles, 3000);
  const excludedDirs = new Set([...DEFAULT_EXCLUDED_DIRS, ...(Array.isArray(options.excludeDirs) ? options.excludeDirs : [])]);
  const files = [];
  const warnings = [];

  function walk(currentDir, depth) {
    if (files.length >= maxFiles) {
      return;
    }
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (error) {
      warnings.push(`Could not read ${normalizeRelativePath(path.relative(root, currentDir)) || "."}: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) {
        warnings.push(`Scan stopped after ${maxFiles} files.`);
        return;
      }
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = normalizeRelativePath(path.relative(root, fullPath));
      if (entry.isDirectory()) {
        if (excludedDirs.has(entry.name) || depth >= maxDepth) {
          continue;
        }
        walk(fullPath, depth + 1);
        continue;
      }
      if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  walk(root, 0);
  return { files: files.sort(), warnings };
}

function buildConflicts(mappings) {
  const conflicts = [];
  const manuscriptMappings = mappings.filter((item) => item.artifactType === "manuscript" && item.confidence === "high");
  if (manuscriptMappings.length > 1) {
    conflicts.push({
      type: "multiple-primary-manuscripts",
      sourcePaths: manuscriptMappings.map((item) => item.sourcePath),
      suggestedResolution: "Choose one primary manuscript entrypoint before writing or importing drafts."
    });
  }

  const bibliographyMappings = mappings.filter((item) => item.artifactType === "bibliography");
  if (bibliographyMappings.length > 1) {
    conflicts.push({
      type: "multiple-bibliographies",
      sourcePaths: bibliographyMappings.map((item) => item.sourcePath),
      suggestedResolution: "Select the canonical bibliography or merge entries before syncing citations."
    });
  }
  return conflicts;
}

function buildRecommendedNextActions(mappings, conflicts, writeMap) {
  const actions = [];
  if (!writeMap) {
    actions.push("Run `dove onboard . --write-map` to persist this proposal under .dove/workspace/artifact-map.json.");
  }
  if (conflicts.length > 0) {
    actions.push("Resolve mapping conflicts before importing or rewriting paper artifacts.");
  }
  if (mappings.some((item) => item.artifactType === "manuscript")) {
    actions.push("Use `project:dove.paper.plan` before converting a legacy manuscript into the design/checklist/implementation/acceptance flow.");
  }
  if (mappings.some((item) => item.artifactType === "bibliography")) {
    actions.push("Use `project:dove.paper.citations` after selecting the canonical bibliography.");
  }
  if (mappings.some((item) => item.artifactType === "review")) {
    actions.push("Use `project:dove.paper.review-loop` or `project:dove.paper.rebuttal-strategy` after mapping reviewer feedback artifacts.");
  }
  return actions;
}

function buildProposal(root, options = {}) {
  const { files, warnings } = walkFiles(root, options);
  const mappings = [];
  const unmapped = [];

  for (const sourcePath of files) {
    const classified = classifyByName(sourcePath);
    if (!classified) {
      const extension = path.extname(sourcePath).toLowerCase();
      if ([".tex", ".md", ".bib", ".pdf", ".png", ".jpg", ".jpeg", ".svg", ".csv", ".tsv", ".json"].includes(extension)) {
        unmapped.push({ sourcePath, reason: "Recognized paper-adjacent extension but no confident lifecycle mapping." });
      }
      continue;
    }
    mappings.push({
      sourcePath,
      artifactType: classified.artifactType,
      lifecycleFamily: normalizeLifecycleFamilyId(classified.lifecycleFamily, "knowledge"),
      suggestedTarget: classified.suggestedTarget,
      confidence: classified.confidence,
      reason: classified.reason,
      action: "map-reference-only"
    });
  }

  const conflicts = buildConflicts(mappings);
  const writeMap = Boolean(options.writeMap);
  return {
    version: 1,
    mode: "onboarding-artifact-map",
    proposalOnly: !writeMap,
    noAutoApply: true,
    writeMap,
    artifactMapPath: ARTIFACT_PATHS.workspaceArtifactMap,
    summary: {
      scannedFileCount: files.length,
      mappingCount: mappings.length,
      conflictCount: conflicts.length,
      unmappedCount: unmapped.length,
      manuscriptCount: mappings.filter((item) => item.artifactType === "manuscript").length,
      bibliographyCount: mappings.filter((item) => item.artifactType === "bibliography").length
    },
    mappings,
    conflicts,
    unmapped,
    warnings,
    recommendedNextActions: buildRecommendedNextActions(mappings, conflicts, writeMap)
  };
}

export function discoverPaperArtifacts(root, args = {}) {
  const proposal = buildProposal(root, args);
  if (args.writeMap) {
    writeJson(root, ARTIFACT_PATHS.workspaceArtifactMap, {
      ...proposal,
      proposalOnly: true,
      writeMap: true,
      writtenAt: new Date().toISOString()
    });
    return {
      ...proposal,
      proposalOnly: true,
      written: [ARTIFACT_PATHS.workspaceArtifactMap]
    };
  }
  return {
    ...proposal,
    written: []
  };
}
