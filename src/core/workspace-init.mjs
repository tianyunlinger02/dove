import fs from "node:fs";
import path from "node:path";

import { openAnchoredFilesystem } from "./anchored-filesystem.mjs";
import { ARTIFACT_PATHS, DOVE_RESEARCH_FORMAT, RESEARCH_DIRECTORIES } from "./schema.mjs";
import { exactTimestamp, jsonDocument, newResearchId, nonEmptyText, readResearchText, writeResearchJsonAtomic } from "./research-records.mjs";
import { DEFAULT_DOVE_LESSONS_MARKDOWN, inspectDoveWorkspace, openDoveWorkspace, validateWorkspaceRecord } from "./workspace-schema.mjs";

function timestamp(value, label) { return value === undefined ? new Date().toISOString() : exactTimestamp(value, label); }

function workspaceRecord(args, createdAt) {
  return validateWorkspaceRecord({
    workspaceId: args.workspaceId ?? newResearchId("workspace"),
    researchQuestion: nonEmptyText(args.researchQuestion, "Workspace researchQuestion"),
    mainline: nonEmptyText(args.mainline, "Workspace mainline"),
    contributionIntent: nonEmptyText(args.contributionIntent, "Workspace contributionIntent"),
    currentFocus: nonEmptyText(args.currentFocus, "Workspace currentFocus"),
    changeHistory: [{ changedAt: createdAt, summary: nonEmptyText(args.changeSummary ?? "Established the initial research direction.", "Workspace change summary") }],
    createdAt,
    updatedAt: createdAt
  });
}

export function initializeResearchWorkspace(root, args = {}) {
  const inspection = inspectDoveWorkspace(root);
  if (!["absent", "research-absent"].includes(inspection.state)) throw new Error(`Workspace initialization refuses existing .dove state (${inspection.state}). Dove does not migrate, move, archive, reset, or replace it.`);
  const createdAt = timestamp(args.createdAt, "Workspace createdAt");
  const workspace = workspaceRecord(args, createdAt);
  const anchor = openAnchoredFilesystem(fs.realpathSync.native(path.resolve(root)), args);
  const createdPaths = [];
  try {
    if (inspection.state === "absent") {
      anchor.mkdir(ARTIFACT_PATHS.doveRoot);
      createdPaths.push(ARTIFACT_PATHS.doveRoot);
    }
    for (const directory of RESEARCH_DIRECTORIES) {
      if (anchor.exists(directory)) throw new Error(`Workspace initialization detected concurrent research state at ${directory}.`);
      anchor.mkdir(directory, { recursive: true });
      createdPaths.push(directory);
    }
    for (const [relativePath, content] of [
      [ARTIFACT_PATHS.workspace, jsonDocument(workspace)],
      [ARTIFACT_PATHS.lessons, DEFAULT_DOVE_LESSONS_MARKDOWN],
      [ARTIFACT_PATHS.format, jsonDocument({ format: DOVE_RESEARCH_FORMAT })]
    ]) {
      if (anchor.exists(relativePath)) throw new Error(`Workspace initialization detected concurrent research state at ${relativePath}.`);
      anchor.writeNewFile(relativePath, content, { mode: 0o600 });
      createdPaths.push(relativePath);
    }
  } catch (error) {
    for (const relativePath of [...createdPaths].reverse()) {
      if (!anchor.exists(relativePath)) continue;
      const stat = anchor.lstat(relativePath);
      if (stat.isDirectory()) anchor.rmdir(relativePath, { force: true });
      else anchor.unlink(relativePath, { force: true });
    }
    throw error;
  } finally {
    anchor.close();
  }
  return openDoveWorkspace(root, { operation: "Workspace initialization readback" });
}

export function updateResearchMainline(root, args = {}) {
  const opened = openDoveWorkspace(root, { operation: "Workspace mainline update" });
  const changedAt = timestamp(args.changedAt, "Workspace changedAt");
  const next = validateWorkspaceRecord({
    ...opened.workspaceRecord,
    researchQuestion: args.researchQuestion ?? opened.workspaceRecord.researchQuestion,
    mainline: args.mainline ?? opened.workspaceRecord.mainline,
    contributionIntent: args.contributionIntent ?? opened.workspaceRecord.contributionIntent,
    currentFocus: args.currentFocus ?? opened.workspaceRecord.currentFocus,
    changeHistory: [...opened.workspaceRecord.changeHistory, { changedAt, summary: nonEmptyText(args.changeSummary, "Workspace change summary") }],
    updatedAt: changedAt
  });
  writeResearchJsonAtomic(root, ARTIFACT_PATHS.workspace, next, { expectedContent: readResearchText(root, ARTIFACT_PATHS.workspace), label: "Workspace" });
  return next;
}
