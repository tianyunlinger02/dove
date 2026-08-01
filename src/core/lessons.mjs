import crypto from "node:crypto";

import { assertSealedDomainArgs, domainNonEmptyText } from "./domain-artifacts.mjs";
import { currentMutationContext, isPatchPlanMode } from "./mutation-backend.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { canonicalWorkspacePath, openDoveWorkspace, validateLessonsMarkdown } from "./workspace-schema.mjs";

export const DOVE_LESSONS_BINDING_VERSION = 1;

const READ_FIELDS = new Set();
const UPDATE_FIELDS = new Set(["binding", "markdown"]);
const SHA256 = /^[0-9a-f]{64}$/u;

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function bindingPayload(workspace, currentHash) {
  return {
    version: DOVE_LESSONS_BINDING_VERSION,
    workspace: canonicalWorkspacePath(workspace.workspace),
    workspaceIdentity: workspace.manifest.workspaceId,
    currentHash
  };
}

function encodeBinding(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeBinding(value) {
  const binding = domainNonEmptyText(value, "binding");
  let payload;
  try {
    payload = JSON.parse(Buffer.from(binding, "base64url").toString("utf8"));
  } catch {
    throw new Error("The Lessons read binding is invalid. Read the current Lessons document again.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The Lessons read binding is invalid. Read the current Lessons document again.");
  }
  const fields = Object.keys(payload).sort();
  if (fields.join(",") !== ["currentHash", "version", "workspace", "workspaceIdentity"].sort().join(",")
    || payload.version !== DOVE_LESSONS_BINDING_VERSION
    || typeof payload.workspace !== "string"
    || typeof payload.workspaceIdentity !== "string"
    || !SHA256.test(String(payload.currentHash ?? ""))) {
    throw new Error("The Lessons read binding is invalid. Read the current Lessons document again.");
  }
  return { binding, payload };
}

function currentLessons(root, operation) {
  const workspace = openDoveWorkspace(root, { operation });
  const context = currentMutationContext(root);
  const markdown = context
    ? context.readText(ARTIFACT_PATHS.lessonsDocument, null)
    : workspace.lessonsDocument;
  if (typeof markdown !== "string") throw new Error("The canonical Lessons document is unavailable.");
  validateLessonsMarkdown(markdown, ARTIFACT_PATHS.lessonsDocument);
  const currentHash = sha256(markdown);
  return { workspace, markdown, currentHash };
}

export function readDoveLessons(root, args = {}) {
  assertSealedDomainArgs(args, READ_FIELDS, "read_dove_lessons");
  const current = currentLessons(root, "Dove Lessons read");
  return {
    status: "ok",
    markdown: current.markdown,
    lessonsBinding: encodeBinding(bindingPayload(current.workspace, current.currentHash)),
    currentHash: current.currentHash,
    zeroWrite: true,
    advisoryOnly: true,
    authority: false,
    completionEligible: false,
    writes: []
  };
}

export function updateDoveLessons(root, args = {}) {
  assertSealedDomainArgs(args, UPDATE_FIELDS, "update_dove_lessons");
  const context = currentMutationContext(root);
  if (!context) throw new Error("Lessons update requires an active MutationContext.");
  const { binding, payload } = decodeBinding(args.binding);
  const markdown = typeof args.markdown === "string" ? args.markdown : "";
  validateLessonsMarkdown(markdown, "markdown");
  const current = currentLessons(root, "Dove Lessons update");
  const expected = bindingPayload(current.workspace, current.currentHash);
  if (binding !== encodeBinding(expected)
    || payload.workspace !== expected.workspace
    || payload.workspaceIdentity !== expected.workspaceIdentity
    || payload.currentHash !== expected.currentHash) {
    throw new Error("The Lessons document changed after it was read. Read the current document and apply the update again.");
  }
  context.requireCommitPrecondition(ARTIFACT_PATHS.lessonsDocument);
  context.writeText(ARTIFACT_PATHS.lessonsDocument, markdown);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "planned" : "updated",
    markdown,
    currentHash: sha256(markdown),
    advisoryOnly: true,
    authority: false,
    completionEligible: false,
    mutation: {
      mutationMode: context.mutationMode,
      writesApplied: !plannedOnly,
      paths: [ARTIFACT_PATHS.lessonsDocument]
    },
    writes: plannedOnly ? [] : [ARTIFACT_PATHS.lessonsDocument]
  };
}
