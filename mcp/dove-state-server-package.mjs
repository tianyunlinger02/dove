#!/usr/bin/env node
import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);

// src/mcp/server.mjs
import process2 from "node:process";

// src/core/completion-gates.mjs
import path18 from "node:path";

// src/core/domain-artifacts.mjs
import crypto16 from "node:crypto";
import fs12 from "node:fs";
import path16 from "node:path";

// src/core/artifact-handoffs.mjs
import crypto2 from "node:crypto";
import path5 from "node:path";

// src/core/artifact-integrity.mjs
import fs4 from "node:fs";
import path4 from "node:path";

// src/core/schema.mjs
var DOVE_WORKSPACE_SCHEMA_VERSION = 18;
var PACKAGE_VERSION = "0.4.0";
var DOVE_RESPONSE_LANGUAGES = Object.freeze(["zh", "en"]);
var DEFAULT_DOVE_RESPONSE_LANGUAGE = "zh";
var DOVE_RESEARCH_SKILL_IDS = Object.freeze([
  "source",
  "note",
  "experience",
  "experiment",
  "draft",
  "figure",
  "review",
  "rebuttal"
]);
function normalizeDoveResponseLanguage(value, fallback = DEFAULT_DOVE_RESPONSE_LANGUAGE, options = {}) {
  const normalizedFallback = DOVE_RESPONSE_LANGUAGES.includes(fallback) ? fallback : DEFAULT_DOVE_RESPONSE_LANGUAGE;
  if (typeof value !== "string" || !value.trim()) return normalizedFallback;
  const normalized3 = value.trim().toLowerCase();
  if (DOVE_RESPONSE_LANGUAGES.includes(normalized3)) return normalized3;
  if (options.strict === true) {
    throw new Error(`Unsupported Dove response language: ${value}. Supported values: ${DOVE_RESPONSE_LANGUAGES.join(", ")}.`);
  }
  return normalizedFallback;
}
var ARTIFACT_PATHS = Object.freeze({
  doveRoot: ".dove",
  doveRootManifest: ".dove/manifest.json",
  projectIdentity: ".dove/project.json",
  workspaceRevisionsDir: ".dove/workspace-revisions",
  missionsDir: ".dove/missions",
  missionTransitionsDir: ".dove/mission-transitions",
  artifactHandoffsDir: ".dove/artifact-handoffs",
  researchDecisionsDir: ".dove/research-decisions",
  lessonsDocument: ".dove/LESSONS.md",
  receiptsDir: ".dove/receipts",
  executionReceiptsDir: ".dove/receipts/execution",
  sourcesDir: ".dove/sources",
  claimsDir: ".dove/claims",
  experimentsDir: ".dove/experiments",
  reviewsDir: ".dove/reviews"
});
function governanceScopeMetadata(mutationScope) {
  return Object.freeze({
    mutationScope,
    requiresMissionId: !["project-identity", "project-lessons"].includes(mutationScope),
    artifactFields: []
  });
}
var GUARDED_MUTATIONS = [
  ["manage-dove-workspace", "Managing the explicit Dove workspace research mainline", ARTIFACT_PATHS.projectIdentity, "manageDoveWorkspace", "manage_dove_workspace", ["dove.workspace"], "project-identity"],
  ["create-dove-mission", "Persisting one minimal mission contract", ARTIFACT_PATHS.missionsDir, "createDoveMission", "manage_dove_mission", ["dove.mission", "dove.source", "dove.note", "dove.experience", "dove.experiment", "dove.draft", "dove.figure", "dove.review", "dove.rebuttal"], "mission-contract", ["create-root", "branch", "start-skill"]],
  ["create-ambient-dove-mission", "Persisting one ambient mission contract", ARTIFACT_PATHS.missionsDir, "createAmbientDoveMission", "create_ambient_dove_mission", [], "mission-contract"],
  ["append-research-decision", "Appending one immutable mission-bound research decision", ARTIFACT_PATHS.researchDecisionsDir, "appendResearchDecision", null, [], "mission-domain"],
  ["reevaluate-research-decision", "Recording one policy-validated mission-bound research reevaluation", ARTIFACT_PATHS.researchDecisionsDir, "reevaluateResearchDecision", "manage_dove_mission", ["dove.mission"], "mission-domain", ["reevaluate-research-decision"]],
  ["update-dove-lessons", "Updating the canonical advisory Lessons document", ARTIFACT_PATHS.lessonsDocument, "updateDoveLessons", "manage_dove_lessons", ["dove.lessons"], "project-lessons", ["update"]],
  ["ingest-execution-receipt", "Private core receipt ingestion used only behind canonical closure endpoints", ARTIFACT_PATHS.executionReceiptsDir, "ingestExecutionReceipt", null, [], "mission-receipt", []],
  ["close-host-outcome", "Recording current host-produced mission outcomes", ARTIFACT_PATHS.executionReceiptsDir, "closeHostOutcome", "close_host_outcome", [], "mission-receipt"],
  ["record-research-outcome", "Recording one sealed research execution receipt without changing the current scientific decision", ARTIFACT_PATHS.executionReceiptsDir, "recordResearchOutcome", "record_research_outcome", [], "mission-receipt"],
  ["register-source", "Registering a mission-bound source candidate", ARTIFACT_PATHS.sourcesDir, "registerSource", "manage_dove_sources", ["dove.source"], "mission-domain", ["register"]],
  ["verify-source", "Rejecting a mission-bound source candidate", ARTIFACT_PATHS.sourcesDir, "verifySource", "manage_dove_sources", ["dove.source"], "mission-domain", ["reject"]],
  ["upsert-claims", "Recording mission-bound evidence-backed claims", ARTIFACT_PATHS.claimsDir, "upsertClaims", "record_dove_claims", ["dove.experiment"], "mission-domain"],
  ["run-experience-workflow", "Recording a mission-bound experiment", ARTIFACT_PATHS.experimentsDir, "runExperienceWorkflow", "record_dove_experiment", ["dove.experiment"], "mission-domain"],
  ["record-dove-draft", "Archiving a current mission-owned project draft", ARTIFACT_PATHS.executionReceiptsDir, "recordDoveDraft", "record_dove_draft", ["dove.draft"], "mission-domain"],
  ["record-dove-figure", "Archiving a current mission-owned project figure", ARTIFACT_PATHS.executionReceiptsDir, "recordDoveFigure", "record_dove_figure", ["dove.figure"], "mission-domain"],
  ["archive-review-record", "Archiving one immutable non-authoritative Review record and report for a frozen mission-readable artifact scope", ARTIFACT_PATHS.reviewsDir, "archiveReviewRecord", "manage_dove_review", ["dove.review"], "mission-review", ["archive"]],
  ["record-dove-rebuttal", "Archiving a current mission-owned project rebuttal with preserved findings", ARTIFACT_PATHS.executionReceiptsDir, "recordDoveRebuttal", "record_dove_rebuttal", ["dove.rebuttal"], "mission-domain"]
];
var GOVERNANCE_GUARDED_MUTATIONS = Object.freeze(GUARDED_MUTATIONS.map(([id3, action, artifactPath, coreFunction, mcpTool, commandIds, scope, mcpOperations = null]) => Object.freeze({
  id: id3,
  action,
  artifactPath,
  surfaceBindings: Object.freeze({ coreFunction, mcpTool, mcpOperations: mcpOperations === null ? null : Object.freeze(mcpOperations), commandIds: Object.freeze(commandIds) }),
  ...governanceScopeMetadata(scope)
})));
var GOVERNANCE_EXEMPT_MUTATIONS = Object.freeze([]);
var GOVERNANCE_READONLY_COMMANDS = Object.freeze(["dove.status"]);
var GOVERNANCE_READONLY_TOOLS = Object.freeze([
  Object.freeze({ mcpTool: "manage_dove_mission", operations: Object.freeze(["query"]) }),
  Object.freeze({ mcpTool: "query_dove_status", operations: Object.freeze(["status", "completion"]) }),
  Object.freeze({ mcpTool: "manage_dove_sources", operations: Object.freeze(["query"]) }),
  Object.freeze({ mcpTool: "manage_dove_lessons", operations: Object.freeze(["read"]) }),
  Object.freeze({ mcpTool: "manage_dove_review", operations: Object.freeze(["scope"]) })
]);
var NEGATIVE_TESTS = Object.freeze({
  "manage-dove-workspace": "workspace initialization, mainline revision, and archive reset reject stale or mismatched confirmation without writing",
  "create-dove-mission": "mission confirmation rejects replay drift without writing",
  "create-ambient-dove-mission": "ambient mission creation rejects caller-controlled identity, lineage, reevaluation, workspace-mainline change, and replay fields before writing",
  "append-research-decision": "research decision append rejects malformed, stale, cross-mission, forked, gapped, or occupied state without writing",
  "reevaluate-research-decision": "research reevaluation rejects stale revision, cross-mission evidence, policy-ineligible authorization, and non-atomic decision or lesson writes",
  "update-dove-lessons": "Lessons update rejects malformed Markdown, a mismatched workspace binding, or a stale current hash without writing",
  "ingest-execution-receipt": "receipt ingestion validates current contracts, paths, hashes, and evidence before writing",
  "close-host-outcome": "host outcome closure accepts only current mission-bound files, generates receipt metadata internally, and skips without writing when no uncovered artifact remains",
  "record-research-outcome": "research outcome closure rejects stale, expired, cross-mission, evidence-drifted, invalid, or same-attempt changed content and writes one immutable receipt only",
  "register-source": "source registration requires an explicit mission and creates candidate evidence only",
  "verify-source": "public source verification cannot mint positive trust authority",
  "upsert-claims": "claims reject missing, stale, or cross-mission evidence before writing",
  "run-experience-workflow": "experiment protocol and result preflight one bounded write set",
  "record-dove-draft": "draft archive requires a current exact-mission-owned project artifact and current references",
  "record-dove-figure": "figure archive requires a current exact-mission-owned project artifact, references, caption, QA, and findings without review coverage",
  "archive-review-record": "review archive rejects changed scope, stale ownership, invalid finding links, replay drift, and caller-minted authority before atomically writing only the record, report, and Receipt",
  "record-dove-rebuttal": "rebuttal archive requires a current exact-mission-owned project artifact and preserved current findings without minting reviewer authority"
});
var GOVERNANCE_NEGATIVE_COVERAGE = Object.freeze(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => Object.freeze({
  id: entry.id,
  level: "dynamic",
  tests: Object.freeze([NEGATIVE_TESTS[entry.id]])
})));

// src/core/mutation-backend.mjs
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import fs3 from "node:fs";
import path3 from "node:path";

// src/core/anchored-filesystem.mjs
import fs from "node:fs";
import path from "node:path";
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function normalizeRelativePath(relativePath, label = "Filesystem path") {
  if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error(`${label} must be a non-empty relative path.`);
  const normalized3 = path.posix.normalize(relativePath.replace(/\\/gu, "/"));
  if (path.isAbsolute(relativePath) || normalized3 === "." || normalized3 === ".." || normalized3.startsWith("../") || normalized3.includes("\0")) {
    throw new Error(`${label} must stay inside the anchored root: ${relativePath}`);
  }
  return normalized3;
}
function requiredFunction(fsOps, name) {
  if (typeof fsOps?.[name] !== "function") throw new Error(`Anchored filesystem requires fsOps.${name}().`);
  return fsOps[name].bind(fsOps);
}
function realpathNative(fsOps, targetPath) {
  const realpath = requiredFunction(fsOps, "realpathSync");
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(targetPath) : realpath(targetPath);
}
function anchoredFilesystemCapability(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const platform = options.platform ?? process.platform;
  const procFdRoot = options.procFdRoot ?? "/proc/self/fd";
  if (platform !== "linux") return { supported: false, reason: "direct-process anchored writes require Linux" };
  const constants = fsOps.constants ?? fs.constants;
  if (!Number.isInteger(constants?.O_DIRECTORY) || !Number.isInteger(constants?.O_NOFOLLOW)) {
    return { supported: false, reason: "direct-process anchored writes require O_DIRECTORY and O_NOFOLLOW" };
  }
  try {
    const stat = requiredFunction(fsOps, "statSync")(procFdRoot);
    if (!stat.isDirectory()) return { supported: false, reason: `${procFdRoot} is not a directory` };
  } catch (error) {
    return { supported: false, reason: `direct-process anchored writes require readable ${procFdRoot}: ${errorMessage(error)}` };
  }
  return { supported: true, reason: null, procFdRoot };
}
function requireAnchoredFilesystemCapability(options = {}) {
  const capability = anchoredFilesystemCapability(options);
  if (!capability.supported) throw new Error(`Direct-process mutation is unavailable: ${capability.reason}. Use mutationMode: patch-plan or a read-only operation instead.`);
  return capability;
}
var AnchoredFilesystem = class {
  constructor(root, options = {}) {
    this.fsOps = options.fsOps ?? fs;
    this.constants = this.fsOps.constants ?? fs.constants;
    this.procFdRoot = options.procFdRoot ?? "/proc/self/fd";
    requireAnchoredFilesystemCapability({ ...options, fsOps: this.fsOps, procFdRoot: this.procFdRoot });
    const openSync = requiredFunction(this.fsOps, "openSync");
    const resolvedRoot = path.resolve(root);
    try {
      this.rootFd = openSync(resolvedRoot, this.constants.O_RDONLY | this.constants.O_DIRECTORY | this.constants.O_NOFOLLOW);
    } catch (error) {
      throw new Error(`Unable to anchor workspace root without following links: ${resolvedRoot}: ${errorMessage(error)}`, { cause: error });
    }
    this.rootHandlePath = path.posix.join(this.procFdRoot, String(this.rootFd));
    try {
      this.root = realpathNative(this.fsOps, this.rootHandlePath);
    } catch (error) {
      this.close();
      throw new Error(`Unable to resolve anchored workspace root: ${errorMessage(error)}`, { cause: error });
    }
    this.closed = false;
  }
  assertOpen() {
    if (this.closed) throw new Error("Anchored filesystem is closed.");
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.rootFd !== void 0) requiredFunction(this.fsOps, "closeSync")(this.rootFd);
  }
  normalize(relativePath, label) {
    return normalizeRelativePath(relativePath, label);
  }
  displayPath(relativePath) {
    return path.join(this.root, this.normalize(relativePath));
  }
  openDirectory(relativePath = null) {
    this.assertOpen();
    if (relativePath === null || relativePath === "" || relativePath === ".") {
      return { fd: this.rootFd, handlePath: this.rootHandlePath, relativePath: "", owned: false };
    }
    const normalized3 = this.normalize(relativePath, "Directory path");
    let currentFd = this.rootFd;
    let owned = false;
    let currentRelative = "";
    try {
      for (const component of normalized3.split("/")) {
        const currentHandle = path.posix.join(this.procFdRoot, String(currentFd));
        const candidate = path.posix.join(currentHandle, component);
        const nextFd = requiredFunction(this.fsOps, "openSync")(candidate, this.constants.O_RDONLY | this.constants.O_DIRECTORY | this.constants.O_NOFOLLOW);
        if (owned) requiredFunction(this.fsOps, "closeSync")(currentFd);
        currentFd = nextFd;
        owned = true;
        currentRelative = currentRelative ? `${currentRelative}/${component}` : component;
      }
      return { fd: currentFd, handlePath: path.posix.join(this.procFdRoot, String(currentFd)), relativePath: currentRelative, owned };
    } catch (error) {
      if (owned) requiredFunction(this.fsOps, "closeSync")(currentFd);
      throw error;
    }
  }
  closeDirectory(directory) {
    if (directory?.owned === true && directory.fd !== void 0) requiredFunction(this.fsOps, "closeSync")(directory.fd);
  }
  withParent(relativePath, callback) {
    const normalized3 = this.normalize(relativePath);
    const parentRelative = path.posix.dirname(normalized3);
    const parent = this.openDirectory(parentRelative === "." ? null : parentRelative);
    const name = path.posix.basename(normalized3);
    try {
      return callback({ normalized: normalized3, parent, name, handlePath: path.posix.join(parent.handlePath, name) });
    } finally {
      this.closeDirectory(parent);
    }
  }
  lstat(relativePath) {
    return this.withParent(relativePath, ({ handlePath }) => requiredFunction(this.fsOps, "lstatSync")(handlePath));
  }
  tryLstat(relativePath) {
    try {
      return this.lstat(relativePath);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }
  exists(relativePath) {
    return this.tryLstat(relativePath) !== null;
  }
  openFile(relativePath, flags, mode) {
    return this.withParent(relativePath, ({ handlePath }) => requiredFunction(this.fsOps, "openSync")(handlePath, flags | this.constants.O_NOFOLLOW, mode));
  }
  inspectRegularFile(relativePath) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY | (this.constants.O_NONBLOCK ?? 0));
    try {
      const stat = requiredFunction(this.fsOps, "fstatSync")(fd);
      if (!stat.isFile()) throw new Error(`Anchored read target must be a regular file: ${relativePath}`);
      return stat;
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  readFile(relativePath) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY);
    try {
      const stat = requiredFunction(this.fsOps, "fstatSync")(fd);
      if (!stat.isFile()) throw new Error(`Anchored read target must be a regular file: ${relativePath}`);
      return Buffer.from(requiredFunction(this.fsOps, "readFileSync")(fd));
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  writeNewFile(relativePath, content, options = {}) {
    const mode = options.mode ?? 384;
    const fd = this.openFile(relativePath, this.constants.O_WRONLY | this.constants.O_CREAT | this.constants.O_EXCL, mode);
    try {
      requiredFunction(this.fsOps, "writeFileSync")(fd, content, options.encoding);
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  chmod(relativePath, mode) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY);
    try {
      requiredFunction(this.fsOps, "fchmodSync")(fd, mode);
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  mkdir(relativePath, options = {}) {
    const normalized3 = this.normalize(relativePath, "Directory path");
    if (options.recursive === true) {
      let current = "";
      for (const component of normalized3.split("/")) {
        current = current ? `${current}/${component}` : component;
        const stat = this.tryLstat(current);
        if (stat) {
          if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Anchored directory component is not a real directory: ${current}`);
          continue;
        }
        this.mkdir(current, { mode: options.mode });
      }
      return;
    }
    this.withParent(normalized3, ({ handlePath }) => requiredFunction(this.fsOps, "mkdirSync")(handlePath, { recursive: false, ...options.mode === void 0 ? {} : { mode: options.mode }, anchoredPath: normalized3, displayPath: this.displayPath(normalized3) }));
  }
  readdir(relativePath = null, options = {}) {
    const directory = this.openDirectory(relativePath);
    try {
      return requiredFunction(this.fsOps, "readdirSync")(directory.handlePath, options);
    } finally {
      this.closeDirectory(directory);
    }
  }
  rename(fromRelativePath, toRelativePath) {
    const from = this.normalize(fromRelativePath, "Rename source");
    const to = this.normalize(toRelativePath, "Rename destination");
    const fromParent = this.openDirectory(path.posix.dirname(from) === "." ? null : path.posix.dirname(from));
    const toParent = this.openDirectory(path.posix.dirname(to) === "." ? null : path.posix.dirname(to));
    try {
      const sourcePath2 = path.posix.join(fromParent.handlePath, path.posix.basename(from));
      const sourceStat = requiredFunction(this.fsOps, "lstatSync")(sourcePath2);
      if (sourceStat.isSymbolicLink()) throw new Error(`Anchored rename source must not be a symbolic link: ${from}`);
      const destinationPath = path.posix.join(toParent.handlePath, path.posix.basename(to));
      try {
        const destinationStat = requiredFunction(this.fsOps, "lstatSync")(destinationPath);
        if (destinationStat.isSymbolicLink()) throw new Error(`Anchored rename destination must not be a symbolic link: ${to}`);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      requiredFunction(this.fsOps, "renameSync")(sourcePath2, destinationPath, { anchoredFrom: from, anchoredTo: to, displayFrom: this.displayPath(from), displayTo: this.displayPath(to) });
    } finally {
      this.closeDirectory(toParent);
      this.closeDirectory(fromParent);
    }
  }
  unlink(relativePath, options = {}) {
    try {
      this.withParent(relativePath, ({ handlePath }) => {
        const stat = requiredFunction(this.fsOps, "lstatSync")(handlePath);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Anchored unlink target must be a regular file: ${relativePath}`);
        requiredFunction(this.fsOps, "unlinkSync")(handlePath, { anchoredPath: this.normalize(relativePath), displayPath: this.displayPath(relativePath) });
      });
    } catch (error) {
      if (options.force === true && error?.code === "ENOENT") return;
      throw error;
    }
  }
  rmdir(relativePath, options = {}) {
    try {
      const normalized3 = this.normalize(relativePath);
      this.withParent(normalized3, ({ handlePath }) => requiredFunction(this.fsOps, "rmdirSync")(handlePath, { anchoredPath: normalized3, displayPath: this.displayPath(normalized3), recursiveCleanup: options.recursiveCleanup === true }));
    } catch (error) {
      if (options.force === true && error?.code === "ENOENT") return;
      throw error;
    }
  }
  remove(relativePath, options = {}) {
    const normalized3 = this.normalize(relativePath, "Removal path");
    const stat = this.tryLstat(normalized3);
    if (!stat) {
      if (options.force === true) return;
      const error = new Error(`Anchored removal target does not exist: ${normalized3}`);
      error.code = "ENOENT";
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Anchored removal target must not be a symbolic link: ${normalized3}`);
    if (stat.isDirectory()) {
      if (options.recursive !== true) return this.rmdir(normalized3);
      const directory = this.openDirectory(normalized3);
      try {
        const entries = requiredFunction(this.fsOps, "readdirSync")(directory.handlePath, { withFileTypes: true });
        for (const entry of entries) {
          const childPath2 = `${normalized3}/${entry.name}`;
          const childHandlePath = path.posix.join(directory.handlePath, entry.name);
          const childStat = requiredFunction(this.fsOps, "lstatSync")(childHandlePath);
          if (childStat.isSymbolicLink()) throw new Error(`Anchored cleanup encountered a symbolic link: ${childPath2}`);
          if (childStat.isDirectory()) this.remove(childPath2, { recursive: true, force: false });
          else if (childStat.isFile()) this.unlink(childPath2);
          else throw new Error(`Anchored cleanup encountered an unsupported path type: ${childPath2}`);
        }
      } finally {
        this.closeDirectory(directory);
      }
      return this.rmdir(normalized3, { force: options.force, recursiveCleanup: true });
    }
    if (stat.isFile()) return this.unlink(normalized3, { force: options.force });
    throw new Error(`Anchored removal target has an unsupported path type: ${normalized3}`);
  }
};
function openAnchoredFilesystem(root, options = {}) {
  return new AnchoredFilesystem(root, options);
}

// src/core/contained-write.mjs
import fs2 from "node:fs";
import path2 from "node:path";
function pathEscapesRoot(relativePath) {
  return relativePath === ".." || relativePath.startsWith(`..${path2.sep}`) || path2.isAbsolute(relativePath);
}
function existingAncestor(fsOps, candidatePath) {
  let currentPath = candidatePath;
  while (!fsOps.existsSync(currentPath)) {
    const parentPath = path2.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }
  return currentPath;
}
function realpathNative2(fsOps, targetPath) {
  return typeof fsOps.realpathSync?.native === "function" ? fsOps.realpathSync.native(targetPath) : fsOps.realpathSync(targetPath);
}
function resolveCanonicalContainedWrite(root, candidatePath, options = {}) {
  const label = options.label ?? "Write path";
  const fsOps = options.fsOps ?? fs2;
  const resolvedRoot = path2.resolve(root);
  const canonicalRoot = realpathNative2(fsOps, resolvedRoot);
  const requestedPath = path2.isAbsolute(candidatePath) ? path2.resolve(candidatePath) : path2.resolve(resolvedRoot, candidatePath);
  const requestedRelative = path2.relative(resolvedRoot, requestedPath);
  if (!requestedRelative || pathEscapesRoot(requestedRelative)) {
    throw new Error(`${label} must stay inside the canonical root: ${candidatePath}`);
  }
  let currentPath = resolvedRoot;
  for (const component of requestedRelative.split(path2.sep)) {
    currentPath = path2.join(currentPath, component);
    let stat;
    try {
      stat = fsOps.lstatSync(currentPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        break;
      }
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`${label} must not contain symbolic links: ${candidatePath}`);
    }
  }
  const canonicalAncestor = realpathNative2(fsOps, existingAncestor(fsOps, requestedPath));
  const canonicalRelative = path2.relative(canonicalRoot, canonicalAncestor);
  if (pathEscapesRoot(canonicalRelative)) {
    throw new Error(`${label} must stay inside the canonical root: ${candidatePath}`);
  }
  return {
    root: canonicalRoot,
    relativePath: requestedRelative.split(path2.sep).join("/"),
    fullPath: path2.join(canonicalRoot, requestedRelative)
  };
}

// src/core/mutation-backend.mjs
var mutationStorage = new AsyncLocalStorage();
var DIRECT_PROCESS_ROLLBACK_REASON = "direct-process writes are performed by the Dove process, not by host-tracked file edits; native programming-terminal rollback does not track those writes.";
var PATCH_PLAN_ROLLBACK_ADVICE = "Use mutationMode: patch-plan and apply the returned operations through host-tracked file edits before relying on host rollback.";
var MAX_CLEANUP_RESIDUES = 20;
function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}
function errorMessage2(error) {
  return error instanceof Error ? error.message : String(error);
}
function normalizeMutationMode(value) {
  if (value === void 0) return "direct-process";
  if (value === "patch-plan" || value === "direct-process") return value;
  throw new Error("mutationMode must be either patch-plan or direct-process when explicitly provided.");
}
function normalizeRelativePath2(relativePath) {
  if (typeof relativePath !== "string" || !relativePath.trim()) {
    throw new Error("Mutation path must be a non-empty relative path.");
  }
  const normalized3 = path3.posix.normalize(relativePath.replace(/\\/g, "/"));
  if (path3.isAbsolute(relativePath) || normalized3 === "." || normalized3.startsWith("../") || normalized3 === "..") {
    throw new Error(`Mutation path must stay inside the project: ${relativePath}`);
  }
  return normalized3;
}
function classifyScope(relativePath) {
  if (relativePath === ".dove" || relativePath.startsWith(".dove/")) return ".dove";
  if (relativePath.startsWith(".opencode/") || relativePath.startsWith(".cursor/") || relativePath.startsWith(".codex/") || relativePath.startsWith(".agents/")) {
    return "generated-adapter";
  }
  return "explicit-external-output";
}
function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}
function resultDeclaresWrites(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.writes) && value.writes.length > 0;
}
function pathType(stat) {
  if (stat.isFile()) return "file";
  if (stat.isDirectory()) return "directory";
  if (stat.isSymbolicLink()) return "symlink";
  return "other";
}
function directoryHash(directory, fsOps = fs3) {
  const entries = [];
  const visit = (current, prefix = "") => {
    for (const entry of fsOps.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const fullPath = path3.join(current, entry.name);
      const relativePath = prefix ? path3.posix.join(prefix, entry.name) : entry.name;
      const stat = fsOps.lstatSync(fullPath);
      const type = pathType(stat);
      const metadata = { path: relativePath, type, mode: stat.mode & 4095 };
      if (type === "file") entries.push({ ...metadata, sha256: sha256(fsOps.readFileSync(fullPath)) });
      else if (type === "symlink") entries.push({ ...metadata, target: fsOps.readlinkSync(fullPath) });
      else {
        entries.push(metadata);
        if (type === "directory") visit(fullPath, relativePath);
      }
    }
  };
  visit(directory);
  return sha256(JSON.stringify(entries));
}
function diskPathState(fullPath, fsOps = fs3) {
  let stat;
  try {
    stat = fsOps.lstatSync(fullPath);
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, type: "absent", sha256: null, mode: null };
    throw error;
  }
  const type = pathType(stat);
  return {
    exists: true,
    type,
    sha256: type === "file" ? sha256(fsOps.readFileSync(fullPath)) : type === "directory" ? directoryHash(fullPath, fsOps) : type === "symlink" ? sha256(fsOps.readlinkSync(fullPath)) : null,
    mode: stat.mode & 4095
  };
}
function samePathState(left, right) {
  return left.exists === right.exists && left.type === right.type && left.sha256 === right.sha256;
}
function buildMutationId() {
  return `mutation-${crypto.randomUUID()}`;
}
function isInside(relativePath, directoryPath) {
  return relativePath === directoryPath || relativePath.startsWith(`${directoryPath}/`);
}
function pathDepth(relativePath) {
  return relativePath.split("/").length;
}
var MutationContext = class {
  constructor(root, options = {}) {
    const resolvedRoot = path3.resolve(root);
    this.root = typeof (options.fsOps ?? fs3).realpathSync.native === "function" ? (options.fsOps ?? fs3).realpathSync.native(resolvedRoot) : (options.fsOps ?? fs3).realpathSync(resolvedRoot);
    this.id = options.id ?? buildMutationId();
    this.actionId = options.actionId ?? "unspecified";
    this.mutationMode = normalizeMutationMode(options.mutationMode);
    this.mutationModeSource = options.mutationMode === "patch-plan" || options.mutationMode === "direct-process" ? "explicit" : "default";
    this.hostId = options.hostId ?? "unknown";
    this.createdAt = options.createdAt ?? (/* @__PURE__ */ new Date()).toISOString();
    this.fsOps = options.fsOps ?? fs3;
    if (this.mutationMode === "direct-process") requireAnchoredFilesystemCapability({ fsOps: this.fsOps, platform: options.platform, procFdRoot: options.procFdRoot });
    this.platform = options.platform;
    this.procFdRoot = options.procFdRoot;
    this.overlay = /* @__PURE__ */ new Map();
    this.virtualDirectories = /* @__PURE__ */ new Set();
    this.preconditions = /* @__PURE__ */ new Map();
    this.readSet = /* @__PURE__ */ new Map();
    this.snapshotCache = /* @__PURE__ */ new Map();
    this.operationsByPath = /* @__PURE__ */ new Map();
    this.operationOrder = [];
    this.directoryReplacements = /* @__PURE__ */ new Map();
    this.directoryPreflightChecks = /* @__PURE__ */ new Map();
    this.commitLocks = /* @__PURE__ */ new Map();
    this.commitState = { phase: "not-started", rollbackAttempted: false, cleanupFailures: [] };
    this.lifecycle = "active";
  }
  get patchPlanMode() {
    return this.mutationMode === "patch-plan";
  }
  assertActive(operation = "MutationContext operation") {
    if (this.lifecycle !== "active") throw new Error(`${operation} cannot use a ${this.lifecycle} MutationContext.`);
  }
  resolve(relativePath) {
    this.assertActive("Mutation path resolution");
    const normalized3 = normalizeRelativePath2(relativePath);
    return resolveCanonicalContainedWrite(this.root, normalized3, { label: "Mutation path", fsOps: this.fsOps });
  }
  replacementFor(relativePath) {
    return [...this.directoryReplacements.keys()].find((directoryPath) => isInside(relativePath, directoryPath)) ?? null;
  }
  recordFirstTouch(normalized3, fullPath) {
    if (!this.preconditions.has(normalized3)) this.preconditions.set(normalized3, diskPathState(fullPath, this.fsOps));
    return this.preconditions.get(normalized3);
  }
  fileExists(relativePath) {
    const { relativePath: normalized3, fullPath } = this.resolve(relativePath);
    if (this.overlay.has(normalized3) || this.virtualDirectories.has(normalized3)) return true;
    if (this.replacementFor(normalized3)) return false;
    return this.fsOps.existsSync(fullPath);
  }
  readFileSnapshot(relativePath) {
    const { relativePath: normalized3, fullPath } = this.resolve(relativePath);
    if (this.overlay.has(normalized3)) {
      const content = this.overlay.get(normalized3);
      const buffer = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(content, "utf8");
      return { relativePath: normalized3, exists: true, type: "file", mode: null, sha256: sha256(buffer), buffer };
    }
    if (this.replacementFor(normalized3)) return { relativePath: normalized3, exists: false, type: "absent", mode: null, sha256: null, buffer: null };
    if (!this.snapshotCache.has(normalized3)) {
      const initial = diskPathState(fullPath, this.fsOps);
      if (initial.exists && initial.type !== "file") throw new Error(`Mutation read target must be absent or a regular file: ${normalized3}`);
      const buffer = initial.exists ? Buffer.from(this.fsOps.readFileSync(fullPath)) : null;
      const snapshot2 = { relativePath: normalized3, ...initial, buffer };
      this.snapshotCache.set(normalized3, snapshot2);
      this.readSet.set(normalized3, initial);
    }
    const snapshot = this.snapshotCache.get(normalized3);
    return { ...snapshot, buffer: snapshot.buffer === null ? null : Buffer.from(snapshot.buffer) };
  }
  readBuffer(relativePath, fallback = null) {
    const snapshot = this.readFileSnapshot(relativePath);
    if (!snapshot.exists) return typeof fallback === "function" ? fallback() : fallback === null ? null : Buffer.from(fallback);
    return Buffer.from(snapshot.buffer);
  }
  readText(relativePath, fallback = "") {
    const buffer = this.readBuffer(relativePath, null);
    return buffer === null ? fallback : buffer.toString("utf8");
  }
  readDirectory(relativePath) {
    const { relativePath: normalized3, fullPath } = this.resolve(relativePath);
    if (this.replacementFor(normalized3)) return [];
    if (this.snapshotCache.has(`${normalized3}/`)) return structuredClone(this.snapshotCache.get(`${normalized3}/`));
    const stat = diskPathState(fullPath, this.fsOps);
    if (!stat.exists) {
      this.readSet.set(normalized3, stat);
      this.snapshotCache.set(`${normalized3}/`, []);
      return [];
    }
    if (stat.type !== "directory") throw new Error(`Mutation directory read target must be a real directory: ${normalized3}`);
    const entries = this.fsOps.readdirSync(fullPath, { withFileTypes: true }).map((entry) => ({ name: entry.name, type: entry.isFile() ? "file" : entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "other" })).sort((left, right) => left.name.localeCompare(right.name));
    this.readSet.set(normalized3, stat);
    this.snapshotCache.set(`${normalized3}/`, entries);
    return structuredClone(entries);
  }
  readJson(relativePath, fallback) {
    const text11 = this.readText(relativePath, null);
    if (text11 === null) return typeof fallback === "function" ? fallback() : structuredClone(fallback);
    return JSON.parse(text11);
  }
  writeJson(relativePath, value) {
    return this.writeText(relativePath, serializeJson(value), "write-json");
  }
  writeJsonIfChanged(relativePath, value) {
    const nextContent = serializeJson(value);
    const currentContent = this.readText(relativePath, null);
    if (currentContent === nextContent) return false;
    this.writeText(relativePath, nextContent, "write-json");
    return true;
  }
  writeText(relativePath, content, kind = "write-text") {
    return this.writeContent(relativePath, String(content ?? ""), { kind, encoding: "utf8" });
  }
  writeBinary(relativePath, content, kind = "write-binary") {
    if (this.patchPlanMode) throw new Error("Binary mutations require direct-process mode; patch-plan cannot safely represent binary output.");
    const buffer = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(content);
    return this.writeContent(relativePath, buffer, { kind, encoding: "binary" });
  }
  writeContent(relativePath, content, { kind, encoding }) {
    const { relativePath: normalized3, fullPath } = this.resolve(relativePath);
    const existing = this.operationsByPath.get(normalized3);
    if (existing?.kind === "ensure-directory") throw new Error(`Mutation path cannot be both a directory and a file: ${normalized3}`);
    const initial = this.recordFirstTouch(normalized3, fullPath);
    if (!this.replacementFor(normalized3) && initial.exists && initial.type !== "file") {
      throw new Error(`Mutation file target must be absent or a regular file: ${normalized3}`);
    }
    const operation = {
      operationId: existing?.operationId ?? `op-${crypto.randomUUID()}`,
      mutationId: this.id,
      actionId: this.actionId,
      relativePath: normalized3,
      kind,
      encoding,
      ...encoding === "utf8" ? { content } : { byteLength: content.byteLength },
      previousExists: initial.exists,
      previousSha256: initial.sha256,
      expectedPreviousSha256: initial.sha256,
      nextSha256: sha256(content),
      scope: classifyScope(normalized3),
      rollbackEligibility: this.patchPlanMode ? "host-tracked-file-edits-required" : "dove-caught-failure-restore"
    };
    if (!existing) this.operationOrder.push(normalized3);
    this.operationsByPath.set(normalized3, operation);
    this.overlay.set(normalized3, content);
    return operation;
  }
  appendText(relativePath, content) {
    const previous = this.readText(relativePath, "");
    return this.writeText(relativePath, `${previous}${String(content ?? "")}`, "append-as-write");
  }
  requireCommitPrecondition(relativePath) {
    this.assertActive("Mutation commit precondition registration");
    if (this.patchPlanMode) return null;
    const { relativePath: normalized3, fullPath } = this.resolve(relativePath);
    this.recordFirstTouch(normalized3, fullPath);
    return normalized3;
  }
  requireCommitLock(relativePath, options = {}) {
    this.assertActive("Mutation commit lock registration");
    if (this.patchPlanMode) return null;
    const { relativePath: normalized3, fullPath } = this.resolve(relativePath);
    if (this.fsOps.existsSync(fullPath)) throw new Error(`${options.label ?? "Mutation commit lock"} is already held: ${normalized3}.`);
    this.commitLocks.set(normalized3, { relativePath: normalized3, fullPath, label: options.label ?? "Mutation commit lock" });
    return normalized3;
  }
  ensureFile(relativePath, content) {
    if (this.fileExists(relativePath)) return false;
    this.writeText(relativePath, content, "ensure-file");
    return true;
  }
  ensureDirectory(relativePath) {
    const { relativePath: normalized3, fullPath } = this.resolve(relativePath);
    const existing = this.operationsByPath.get(normalized3);
    if (existing && existing.kind !== "ensure-directory") throw new Error(`Mutation path cannot be both a file and a directory: ${normalized3}`);
    if (this.virtualDirectories.has(normalized3)) return false;
    const initial = this.recordFirstTouch(normalized3, fullPath);
    if (!this.replacementFor(normalized3) && initial.exists) {
      if (initial.type !== "directory") throw new Error(`Mutation directory target must be absent or a real directory: ${normalized3}`);
      return false;
    }
    const operation = {
      operationId: existing?.operationId ?? `op-${crypto.randomUUID()}`,
      mutationId: this.id,
      actionId: this.actionId,
      relativePath: normalized3,
      kind: "ensure-directory",
      encoding: null,
      previousExists: initial.exists,
      previousSha256: initial.sha256,
      expectedPreviousSha256: initial.sha256,
      nextSha256: null,
      scope: classifyScope(normalized3),
      rollbackEligibility: this.patchPlanMode ? "host-tracked-file-edits-required" : "dove-caught-failure-restore"
    };
    if (!existing) this.operationOrder.push(normalized3);
    this.operationsByPath.set(normalized3, operation);
    this.virtualDirectories.add(normalized3);
    return true;
  }
  replaceDirectory(relativePath, options = {}) {
    this.assertActive("Directory replacement");
    if (this.patchPlanMode) throw new Error("Directory replacement is direct-process only.");
    const { relativePath: normalized3, fullPath } = this.resolve(relativePath);
    const initial = this.recordFirstTouch(normalized3, fullPath);
    if (initial.exists && initial.type !== "directory") throw new Error(`Directory replacement target must be absent or a real directory: ${normalized3}`);
    let archiveTarget = null;
    if (options.archiveTarget !== void 0 && options.archiveTarget !== null) {
      const resolvedArchive = this.resolve(options.archiveTarget);
      archiveTarget = resolvedArchive.relativePath;
      const archiveInitial = this.recordFirstTouch(archiveTarget, resolvedArchive.fullPath);
      if (archiveInitial.exists) throw new Error(`Directory replacement archive target must be absent: ${archiveTarget}`);
    }
    this.directoryReplacements.set(normalized3, { relativePath: normalized3, archiveTarget });
    this.virtualDirectories.add(normalized3);
  }
  requireDirectoryPreflight(relativePath, callback) {
    this.assertActive("Directory preflight registration");
    if (this.patchPlanMode) throw new Error("Directory preflight is direct-process only.");
    if (typeof callback !== "function") throw new Error("Directory preflight requires a validation callback.");
    const normalized3 = normalizeRelativePath2(relativePath);
    if (!this.directoryReplacements.has(normalized3)) throw new Error(`Directory preflight requires a registered directory replacement: ${normalized3}.`);
    if (this.directoryPreflightChecks.has(normalized3)) throw new Error(`Directory preflight is already registered: ${normalized3}.`);
    this.directoryPreflightChecks.set(normalized3, callback);
    return normalized3;
  }
  operations() {
    return this.operationOrder.map((relativePath) => this.operationsByPath.get(relativePath)).filter(Boolean);
  }
  summary(options = {}) {
    const operations = this.operations();
    const writesApplied = options.writesApplied ?? (!this.patchPlanMode && operations.length > 0);
    const cleanupResidues = this.commitState.cleanupFailures.slice(0, MAX_CLEANUP_RESIDUES);
    return {
      mutationId: this.id,
      actionId: this.actionId,
      mutationMode: this.mutationMode,
      mutationModeSource: this.mutationModeSource,
      writesApplied,
      operationCount: operations.length,
      paths: operations.map((operation) => operation.relativePath),
      directoryEffectCount: operations.filter((operation) => operation.kind === "ensure-directory").length,
      directoryPaths: operations.filter((operation) => operation.kind === "ensure-directory").map((operation) => operation.relativePath),
      hostRollbackEligible: this.patchPlanMode,
      hostRollbackIneligibleReason: this.patchPlanMode ? null : DIRECT_PROCESS_ROLLBACK_REASON,
      recommendedMutationMode: this.patchPlanMode ? null : "patch-plan",
      rollbackAdvice: this.patchPlanMode ? null : PATCH_PLAN_ROLLBACK_ADVICE,
      externalWriteCaptureVerified: false,
      doveRestoreSupported: !this.patchPlanMode,
      doveRestoreScope: this.patchPlanMode ? null : "caught-commit-failures-only",
      crashConsistencyGuaranteed: false,
      transactionState: {
        phase: this.patchPlanMode ? "planned" : this.commitState.phase,
        rollbackAttempted: this.commitState.rollbackAttempted,
        cleanup: {
          status: this.commitState.cleanupFailures.length === 0 ? "clean" : "residue",
          residueCount: this.commitState.cleanupFailures.length,
          residues: cleanupResidues,
          omittedResidueCount: Math.max(0, this.commitState.cleanupFailures.length - cleanupResidues.length)
        }
      }
    };
  }
  revalidatePreconditions() {
    const expectedStates = new Map([...this.readSet, ...this.preconditions]);
    for (const [relativePath, expected] of expectedStates) {
      const { fullPath } = this.resolve(relativePath);
      const actual = diskPathState(fullPath, this.fsOps);
      if (!samePathState(actual, expected)) {
        throw new Error(`Mutation commit precondition changed for ${relativePath}: expected ${expected.type}${expected.sha256 ? ` ${expected.sha256}` : ""}, found ${actual.type}${actual.sha256 ? ` ${actual.sha256}` : ""}.`);
      }
    }
  }
  revalidatePreconditionsAnchored(anchor) {
    const expectedStates = new Map([...this.readSet, ...this.preconditions]);
    for (const [relativePath, expected] of expectedStates) {
      const stat = anchor.tryLstat(relativePath);
      let actual;
      if (!stat) actual = { exists: false, type: "absent", sha256: null, mode: null };
      else {
        const type = pathType(stat);
        actual = { exists: true, type, sha256: type === "file" ? sha256(anchor.readFile(relativePath)) : type === "directory" ? diskPathState(path3.join(this.root, relativePath), this.fsOps).sha256 : null, mode: stat.mode & 4095 };
      }
      if (!samePathState(actual, expected)) throw new Error(`Mutation commit precondition changed for ${relativePath}: expected ${expected.type}${expected.sha256 ? ` ${expected.sha256}` : ""}, found ${actual.type}${actual.sha256 ? ` ${actual.sha256}` : ""}.`);
    }
  }
  makeAnchoredDirectory(anchor, relativePath, createdDirectories) {
    const normalized3 = path3.posix.normalize(relativePath || ".");
    if (normalized3 === ".") return;
    let current = "";
    for (const component of normalized3.split("/")) {
      current = current ? `${current}/${component}` : component;
      const stat = anchor.tryLstat(current);
      if (stat) {
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Mutation directory component must be a real directory: ${current}`);
        continue;
      }
      anchor.mkdir(current);
      createdDirectories.push(current);
    }
  }
  stageTransaction(anchor, transactionRoot) {
    const createdDirectories = [];
    anchor.mkdir(transactionRoot);
    createdDirectories.push(transactionRoot);
    const stagedRoot = `${transactionRoot}/staged`;
    const backupsRoot = `${transactionRoot}/backups`;
    anchor.mkdir(stagedRoot);
    anchor.mkdir(backupsRoot);
    const replacementStages = /* @__PURE__ */ new Map();
    let replacementIndex = 0;
    for (const replacement of this.directoryReplacements.values()) {
      const stagePath = `${stagedRoot}/directory-${replacementIndex++}`;
      anchor.mkdir(stagePath);
      replacementStages.set(replacement.relativePath, stagePath);
      const directoryOperations = this.operations().filter((operation) => operation.kind === "ensure-directory" && isInside(operation.relativePath, replacement.relativePath));
      for (const operation of directoryOperations.sort((left, right) => pathDepth(left.relativePath) - pathDepth(right.relativePath))) {
        if (operation.relativePath === replacement.relativePath) continue;
        const nested = path3.posix.relative(replacement.relativePath, operation.relativePath);
        anchor.mkdir(`${stagePath}/${nested}`, { recursive: true });
      }
      const fileOperations = this.operations().filter((operation) => operation.kind !== "ensure-directory" && isInside(operation.relativePath, replacement.relativePath));
      for (const operation of fileOperations) {
        const nested = path3.posix.relative(replacement.relativePath, operation.relativePath);
        const stagedFile = `${stagePath}/${nested}`;
        anchor.mkdir(path3.posix.dirname(stagedFile), { recursive: true });
        anchor.writeNewFile(stagedFile, this.overlay.get(operation.relativePath), { encoding: operation.encoding === "utf8" ? "utf8" : void 0 });
      }
    }
    const fileStages = /* @__PURE__ */ new Map();
    let fileIndex = 0;
    for (const operation of this.operations()) {
      if (operation.kind === "ensure-directory" || this.replacementFor(operation.relativePath)) continue;
      const stagedFile = `${stagedRoot}/file-${fileIndex++}`;
      anchor.writeNewFile(stagedFile, this.overlay.get(operation.relativePath), { encoding: operation.encoding === "utf8" ? "utf8" : void 0 });
      const initial = this.preconditions.get(operation.relativePath);
      if (initial?.exists && initial.type === "file") anchor.chmod(stagedFile, initial.mode);
      fileStages.set(operation.relativePath, stagedFile);
    }
    return { transactionRoot, backupsRoot, replacementStages, fileStages, createdDirectories };
  }
  runDirectoryPreflightChecks(anchor, transaction) {
    for (const [relativePath, callback] of this.directoryPreflightChecks) {
      const stagedPath = transaction.replacementStages.get(relativePath);
      if (!stagedPath) throw new Error(`Directory preflight cannot resolve staged replacement: ${relativePath}.`);
      callback({
        root: this.root,
        relativePath,
        stagedRelativePath: stagedPath,
        stagedPath: anchor.displayPath(stagedPath)
      });
    }
  }
  rollbackTransaction(anchor, transaction, promotions) {
    const failures = [];
    const attempt = (callback) => {
      try {
        callback();
      } catch (error) {
        failures.push(errorMessage2(error));
      }
    };
    for (const promotion of [...promotions].reverse()) {
      if (promotion.promoted) attempt(() => anchor.remove(promotion.targetPath, { recursive: promotion.directory === true, force: true }));
      if (promotion.originalLocation && anchor.exists(promotion.originalLocation)) attempt(() => anchor.rename(promotion.originalLocation, promotion.targetPath));
      else if (promotion.backupPath && anchor.exists(promotion.backupPath)) attempt(() => anchor.rename(promotion.backupPath, promotion.targetPath));
    }
    for (const directoryPath of [...transaction.createdDirectories].sort((left, right) => right.length - left.length)) {
      if (directoryPath === transaction.transactionRoot) continue;
      if (anchor.exists(directoryPath)) attempt(() => anchor.rmdir(directoryPath));
    }
    if (anchor.exists(transaction.transactionRoot)) attempt(() => anchor.remove(transaction.transactionRoot, { recursive: true, force: true }));
    if (failures.length > 0) throw new Error(failures.join("; "));
  }
  acquireCommitLocks(anchor) {
    const acquired = [];
    try {
      for (const lock of this.commitLocks.values()) {
        try {
          anchor.writeNewFile(lock.relativePath, Buffer.alloc(0), { mode: 384 });
        } catch (error) {
          if (error?.code === "EEXIST") throw new Error(`${lock.label} is already held: ${lock.relativePath}.`);
          throw error;
        }
        acquired.push(lock);
      }
      return acquired;
    } catch (error) {
      this.releaseCommitLocks(anchor, acquired);
      throw error;
    }
  }
  releaseCommitLocks(anchor, acquired) {
    const failures = [];
    for (const lock of [...acquired].reverse()) {
      try {
        anchor.unlink(lock.relativePath, { force: true });
      } catch (error) {
        failures.push(errorMessage2(error));
      }
    }
    if (failures.length > 0) throw new Error(`Mutation commit lock cleanup failed: ${failures.join("; ")}`);
  }
  commitDirect() {
    const anchor = openAnchoredFilesystem(this.root, { fsOps: this.fsOps, platform: this.platform, procFdRoot: this.procFdRoot });
    const acquiredLocks = this.acquireCommitLocks(anchor);
    let primaryError = null;
    try {
      this.commitState.phase = "preparing";
      this.revalidatePreconditionsAnchored(anchor);
      if (this.operations().length === 0 && this.directoryReplacements.size === 0) {
        this.commitState.phase = "committed";
        return;
      }
      const transactionRoot = `.dove-transaction-${this.id.replace(/[^a-z0-9._-]/giu, "-")}`;
      if (anchor.exists(transactionRoot)) throw new Error(`Mutation transaction path is already occupied: ${anchor.displayPath(transactionRoot)}`);
      let transaction = { transactionRoot, createdDirectories: [] };
      const promotions = [];
      try {
        transaction = this.stageTransaction(anchor, transactionRoot);
        this.runDirectoryPreflightChecks(anchor, transaction);
        this.revalidatePreconditionsAnchored(anchor);
        this.commitState.phase = "promoting";
        let replacementIndex = 0;
        for (const replacement of this.directoryReplacements.values()) {
          const targetPath = replacement.relativePath;
          const stagePath = transaction.replacementStages.get(replacement.relativePath);
          const promotion = { targetPath, promoted: false, backupPath: null, originalLocation: null, directory: true };
          promotions.push(promotion);
          if (anchor.exists(targetPath)) {
            const originalLocation = replacement.archiveTarget ?? `${transaction.backupsRoot}/directory-${replacementIndex}`;
            this.makeAnchoredDirectory(anchor, path3.posix.dirname(originalLocation), transaction.createdDirectories);
            anchor.rename(targetPath, originalLocation);
            promotion.originalLocation = originalLocation;
          }
          this.makeAnchoredDirectory(anchor, path3.posix.dirname(targetPath), transaction.createdDirectories);
          anchor.rename(stagePath, targetPath);
          promotion.promoted = true;
          replacementIndex += 1;
        }
        for (const operation of this.operations().filter((item) => item.kind === "ensure-directory" && !this.replacementFor(item.relativePath)).sort((left, right) => pathDepth(left.relativePath) - pathDepth(right.relativePath))) {
          this.makeAnchoredDirectory(anchor, operation.relativePath, transaction.createdDirectories);
        }
        let fileIndex = 0;
        for (const operation of this.operations()) {
          if (operation.kind === "ensure-directory" || this.replacementFor(operation.relativePath)) continue;
          const targetPath = operation.relativePath;
          const stagedPath = transaction.fileStages.get(operation.relativePath);
          const promotion = { targetPath, promoted: false, backupPath: null, originalLocation: null, directory: false };
          promotions.push(promotion);
          this.makeAnchoredDirectory(anchor, path3.posix.dirname(targetPath), transaction.createdDirectories);
          if (anchor.exists(targetPath)) {
            const backupPath = `${transaction.backupsRoot}/file-${fileIndex}`;
            anchor.rename(targetPath, backupPath);
            promotion.backupPath = backupPath;
          }
          anchor.rename(stagedPath, targetPath);
          promotion.promoted = true;
          fileIndex += 1;
        }
      } catch (error) {
        this.commitState.phase = "rolling-back";
        this.commitState.rollbackAttempted = true;
        try {
          this.rollbackTransaction(anchor, transaction, promotions);
          this.commitState.phase = "rolled-back";
        } catch (rollbackError) {
          this.commitState.phase = "rollback-failed";
          throw new Error(`Dove mutation commit failed and rollback also failed: ${errorMessage2(error)}; rollback: ${errorMessage2(rollbackError)}`, { cause: error });
        }
        throw new Error(`Dove mutation commit failed and all staged changes were rolled back: ${errorMessage2(error)}`, { cause: error });
      }
      this.commitState.phase = "committed";
      try {
        anchor.remove(transactionRoot, { recursive: true, force: true });
      } catch (cleanupError) {
        this.commitState.cleanupFailures.push({ path: anchor.displayPath(transactionRoot), reason: errorMessage2(cleanupError) });
      }
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      try {
        this.releaseCommitLocks(anchor, acquiredLocks);
      } catch (cleanupError) {
        if (!primaryError && this.commitState.phase === "committed") this.commitState.cleanupFailures.push({ path: "commit-locks", reason: errorMessage2(cleanupError) });
      } finally {
        anchor.close();
      }
    }
  }
  finish(result = {}) {
    this.assertActive("MutationContext finish");
    const operations = this.operations();
    if (!this.patchPlanMode) this.commitDirect();
    const writesApplied = !this.patchPlanMode && (operations.length > 0 || this.directoryReplacements.size > 0 || resultDeclaresWrites(result));
    const directRestoreSupported = !this.patchPlanMode;
    const metadata = {
      mutationId: this.id,
      mutationMode: this.mutationMode,
      mutationModeSource: this.mutationModeSource,
      writesApplied,
      hostRollbackEligible: this.patchPlanMode,
      hostTrackedFileEditsRequired: this.patchPlanMode,
      directProcessWritesAreRollbackSafe: directRestoreSupported,
      externalWriteCaptureVerified: false,
      doveRestoreSupported: directRestoreSupported,
      doveRestoreScope: directRestoreSupported ? "caught-commit-failures-only" : null,
      crashConsistencyGuaranteed: false,
      hostRollbackIneligibleReason: this.patchPlanMode ? null : DIRECT_PROCESS_ROLLBACK_REASON,
      recommendedMutationMode: this.patchPlanMode ? null : "patch-plan",
      rollbackAdvice: this.patchPlanMode ? null : PATCH_PLAN_ROLLBACK_ADVICE,
      mutationSummary: this.summary({ writesApplied })
    };
    if (this.patchPlanMode) {
      metadata.mutationPlan = {
        presentation: "dove-mutation-plan",
        mutationId: this.id,
        actionId: this.actionId,
        hostId: this.hostId,
        workspaceRealpath: typeof this.fsOps.realpathSync.native === "function" ? this.fsOps.realpathSync.native(this.root) : this.fsOps.realpathSync(this.root),
        mutationModeSource: this.mutationModeSource,
        createdAt: this.createdAt,
        writesApplied: false,
        hostTrackedFileEditsRequired: true,
        directProcessWritesAreRollbackSafe: false,
        externalWriteCaptureVerified: false,
        doveRestoreSupported: false,
        doveRestoreScope: null,
        crashConsistencyGuaranteed: false,
        operations
      };
    }
    this.lifecycle = "finished";
    if (result && typeof result === "object" && !Array.isArray(result)) return { ...result, ...metadata };
    return { result, ...metadata };
  }
  abort() {
    if (this.lifecycle === "active") this.lifecycle = "aborted";
  }
};
function createMutationContext(root, options = {}) {
  return new MutationContext(root, options);
}
function runWithMutationContext(root, options, callback) {
  const context = createMutationContext(root, options);
  return mutationStorage.run(context, () => {
    try {
      const result = callback(context);
      if (result && typeof result.then === "function") {
        return result.then(
          (resolved) => context.finish(resolved),
          (error) => {
            context.abort();
            throw error;
          }
        );
      }
      return context.finish(result);
    } catch (error) {
      context.abort();
      throw error;
    }
  });
}
function currentMutationContext(root) {
  const context = mutationStorage.getStore();
  if (!context || context.lifecycle !== "active") return null;
  if (root) {
    try {
      const resolved = typeof context.fsOps.realpathSync.native === "function" ? context.fsOps.realpathSync.native(path3.resolve(root)) : context.fsOps.realpathSync(path3.resolve(root));
      if (resolved !== context.root) return null;
    } catch {
      return null;
    }
  }
  return context;
}
function isPatchPlanMode(root) {
  return currentMutationContext(root)?.patchPlanMode === true;
}

// src/core/artifact-integrity.mjs
var BOOKKEEPING_PREFIXES = Object.freeze([
  `${ARTIFACT_PATHS.missionsDir}/`,
  `${ARTIFACT_PATHS.researchDecisionsDir}/`,
  `${ARTIFACT_PATHS.receiptsDir}/`
]);
var BOOKKEEPING_FILES = /* @__PURE__ */ new Set([ARTIFACT_PATHS.doveRootManifest, ARTIFACT_PATHS.projectIdentity, ARTIFACT_PATHS.lessonsDocument]);
var DOMAIN_PREFIXES = Object.freeze([
  ARTIFACT_PATHS.sourcesDir,
  ARTIFACT_PATHS.claimsDir,
  ARTIFACT_PATHS.experimentsDir,
  ARTIFACT_PATHS.reviewsDir
]);
function normalizeProjectRelativePath(rawPath) {
  const original = typeof rawPath === "string" ? rawPath.trim() : String(rawPath ?? "").trim();
  if (!original) return { ok: false, path: original, reason: "empty path" };
  if (original.includes("\0")) return { ok: false, path: original, reason: "path contains a null byte" };
  if (path4.isAbsolute(original) || /^[A-Za-z]:[\\/]/u.test(original)) {
    return { ok: false, path: original, reason: "absolute paths are not inspected" };
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(original)) {
    return { ok: false, path: original, reason: "unsupported or malformed external reference scheme" };
  }
  const normalizedPath = path4.posix.normalize(original.replace(/\\/gu, "/"));
  if (normalizedPath === "." || normalizedPath === ".." || normalizedPath.startsWith("../")) {
    return { ok: false, path: original, normalizedPath, reason: "path escapes the project root" };
  }
  return { ok: true, path: original, normalizedPath };
}
function artifactEvidenceRole(relativePath) {
  const normalized3 = normalizeProjectRelativePath(relativePath);
  if (!normalized3.ok) return "unsupported";
  const value = normalized3.normalizedPath;
  if (!value.startsWith(`${ARTIFACT_PATHS.doveRoot}/`)) return "external-project";
  if (BOOKKEEPING_FILES.has(value) || BOOKKEEPING_PREFIXES.some((prefix) => value.startsWith(prefix))) return "bookkeeping";
  if (DOMAIN_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) return "substantive";
  return "unsupported";
}
function inspectDeclaredPath(root, rawPath, options = {}) {
  const normalized3 = normalizeProjectRelativePath(rawPath);
  const mutationContext = currentMutationContext(root);
  if (!normalized3.ok) {
    return { path: normalized3.path, normalizedPath: normalized3.normalizedPath ?? null, status: "unsafe", exists: false, file: false, reason: normalized3.reason };
  }
  const rootPath = path4.resolve(root);
  const fullPath = path4.resolve(rootPath, normalized3.normalizedPath);
  const relativeToRoot = path4.relative(rootPath, fullPath);
  if (relativeToRoot === ".." || relativeToRoot.startsWith(`..${path4.sep}`) || path4.isAbsolute(relativeToRoot)) {
    return { path: normalized3.path, normalizedPath: normalized3.normalizedPath, status: "unsafe", exists: false, file: false, reason: "resolved path escapes the project root" };
  }
  let realRootPath;
  let realFullPath;
  let canonicalRelativePath;
  let stat;
  try {
    if (mutationContext) {
      const snapshot = mutationContext.readFileSnapshot(normalized3.normalizedPath);
      if (!snapshot.exists) return { path: normalized3.path, normalizedPath: normalized3.normalizedPath, status: "missing", exists: false, file: false, reason: "path does not exist" };
    }
    realRootPath = fs4.realpathSync.native(rootPath);
    realFullPath = fs4.realpathSync.native(fullPath);
    const relativeToRealRoot = path4.relative(realRootPath, realFullPath);
    if (relativeToRealRoot === ".." || relativeToRealRoot.startsWith(`..${path4.sep}`) || path4.isAbsolute(relativeToRealRoot)) {
      return { path: normalized3.path, normalizedPath: normalized3.normalizedPath, status: "unsafe", exists: true, file: false, reason: "real path escapes the project root" };
    }
    canonicalRelativePath = relativeToRealRoot.split(path4.sep).join("/");
    stat = fs4.statSync(realFullPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { path: normalized3.path, normalizedPath: normalized3.normalizedPath, status: "missing", exists: false, file: false, reason: "path does not exist" };
    }
    return { path: normalized3.path, normalizedPath: normalized3.normalizedPath, status: "unreadable", exists: false, file: false, reason: error instanceof Error ? error.message : String(error) };
  }
  if (stat.isDirectory()) {
    return { path: normalized3.path, normalizedPath: normalized3.normalizedPath, canonicalRelativePath, status: "directory", exists: true, file: false, sizeBytes: stat.size, reason: "path is a directory" };
  }
  if (!stat.isFile()) {
    return { path: normalized3.path, normalizedPath: normalized3.normalizedPath, canonicalRelativePath, status: "unsupported", exists: true, file: false, sizeBytes: stat.size, reason: "path is not a regular file" };
  }
  const evidenceRole = artifactEvidenceRole(normalized3.normalizedPath);
  const canonicalEvidenceRole = artifactEvidenceRole(canonicalRelativePath);
  const base = { path: normalized3.path, normalizedPath: normalized3.normalizedPath, canonicalRelativePath, evidenceRole, canonicalEvidenceRole, status: "existing", exists: true, file: true, sizeBytes: stat.size };
  if (options.rejectBookkeeping === true) {
    const rejected = [evidenceRole, canonicalEvidenceRole].find((role) => role === "bookkeeping" || role === "unsupported");
    if (rejected) {
      return { ...base, status: rejected, reason: rejected === "bookkeeping" ? "path is Dove bookkeeping rather than substantive evidence" : "path is not an approved current-schema evidence artifact" };
    }
  }
  if (options.requireNonEmpty === true && stat.size === 0) return { ...base, status: "empty", reason: "path is an empty file" };
  if (options.readText !== true) return base;
  try {
    const maxBytes = Number.isInteger(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : 24 * 1024;
    if (mutationContext && canonicalRelativePath === normalized3.normalizedPath) {
      const content = mutationContext.readBuffer(canonicalRelativePath, null);
      if (content === null) return { ...base, status: "missing", exists: false, file: false, reason: "path does not exist" };
      const bytesRead = Math.min(maxBytes, content.length);
      return { ...base, text: content.subarray(0, bytesRead).toString("utf8"), bytesRead, truncated: content.length > bytesRead };
    }
    const descriptor = fs4.openSync(realFullPath, "r");
    try {
      const buffer = Buffer.alloc(Math.min(maxBytes, stat.size));
      const bytesRead = fs4.readSync(descriptor, buffer, 0, buffer.length, 0);
      return { ...base, text: buffer.subarray(0, bytesRead).toString("utf8"), bytesRead, truncated: stat.size > bytesRead };
    } finally {
      fs4.closeSync(descriptor);
    }
  } catch (error) {
    return { ...base, status: "unreadable", reason: error instanceof Error ? error.message : String(error) };
  }
}

// src/core/artifact-handoffs.mjs
var ARTIFACT_HANDOFF_SCHEMA_VERSION = 1;
var SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH = /^[0-9a-f]{64}$/u;
var FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "handoffId", "handoffDigest", "path", "fromMissionId", "toMissionId", "fromReceiptId", "fromSha256", "reason", "createdAt"]);
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  return value;
}
function serialize(value) {
  return JSON.stringify(stableValue(value));
}
function sha2562(value) {
  return crypto2.createHash("sha256").update(value).digest("hex");
}
function plain(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function sealed(value, fields, label) {
  plain(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
}
function safeId(value, label) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return value;
}
function hash(value, label) {
  if (typeof value !== "string" || !HASH.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return value;
}
function text(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function exactIso(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value;
}
function canonicalPath(value) {
  const normalized3 = normalizeProjectRelativePath(value);
  if (!normalized3.ok || normalized3.normalizedPath !== value) throw new Error("Artifact handoff path must be a canonical safe project-relative path.");
  return value;
}
function normalized(value) {
  const fromMissionId = safeId(value.fromMissionId, "Artifact handoff fromMissionId");
  const toMissionId = safeId(value.toMissionId, "Artifact handoff toMissionId");
  if (fromMissionId === toMissionId) throw new Error("Artifact handoff must transfer authority to a different mission.");
  return {
    workspaceId: safeId(value.workspaceId, "Artifact handoff workspaceId"),
    path: canonicalPath(value.path),
    fromMissionId,
    toMissionId,
    fromReceiptId: safeId(value.fromReceiptId, "Artifact handoff fromReceiptId"),
    fromSha256: hash(value.fromSha256, "Artifact handoff fromSha256"),
    reason: text(value.reason, "Artifact handoff reason"),
    createdAt: exactIso(value.createdAt, "Artifact handoff createdAt")
  };
}
function digest(value) {
  return sha2562(serialize({ schemaVersion: ARTIFACT_HANDOFF_SCHEMA_VERSION, ...normalized(value) }));
}
function id(value, handoffDigest) {
  return `artifact-handoff-${sha2562(serialize({ path: value.path, fromMissionId: value.fromMissionId, toMissionId: value.toMissionId, handoffDigest })).slice(0, 24)}`;
}
function createArtifactHandoff(value) {
  const content = normalized(value);
  const handoffDigest = digest(content);
  return { schemaVersion: ARTIFACT_HANDOFF_SCHEMA_VERSION, handoffId: id(content, handoffDigest), handoffDigest, ...content };
}
function validateArtifactHandoff(value, options = {}) {
  const label = options.label ?? "Artifact handoff";
  sealed(value, FIELDS, label);
  if (value.schemaVersion !== ARTIFACT_HANDOFF_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  const content = normalized(value);
  const handoffDigest = digest(content);
  const handoffId = id(content, handoffDigest);
  if (value.handoffDigest !== handoffDigest || value.handoffId !== handoffId) throw new Error(`${label} does not match its canonical content.`);
  if (options.workspaceId !== void 0 && content.workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest.`);
  if (options.filename !== void 0 && options.filename !== `${handoffId}.json`) throw new Error(`${label} filename must match handoffId.`);
  if (!options.missions?.has(content.fromMissionId) || !options.missions?.has(content.toMissionId)) throw new Error(`${label} references an unknown mission.`);
  return { schemaVersion: ARTIFACT_HANDOFF_SCHEMA_VERSION, handoffId, handoffDigest, ...content };
}
function validateArtifactHandoffs(values, options = {}) {
  const byPath = /* @__PURE__ */ new Map();
  const byId = /* @__PURE__ */ new Map();
  for (const value of values) {
    const handoff = validateArtifactHandoff(value, options);
    if (byId.has(handoff.handoffId)) throw new Error(`Duplicate artifact handoff ${handoff.handoffId}.`);
    byId.set(handoff.handoffId, handoff);
    const chain = byPath.get(handoff.path) ?? [];
    chain.push(handoff);
    byPath.set(handoff.path, chain);
  }
  for (const [artifactPath, chain] of byPath) {
    chain.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.handoffId.localeCompare(b.handoffId));
    const outgoing = /* @__PURE__ */ new Map();
    for (const handoff of chain) {
      if (outgoing.has(handoff.fromMissionId)) throw new Error(`Artifact handoff chain forks for ${artifactPath} at mission ${handoff.fromMissionId}.`);
      outgoing.set(handoff.fromMissionId, handoff.toMissionId);
    }
    const seen = /* @__PURE__ */ new Set();
    let current = chain[0]?.fromMissionId;
    while (current && outgoing.has(current)) {
      if (seen.has(current)) throw new Error(`Artifact handoff chain contains a cycle for ${artifactPath}.`);
      seen.add(current);
      current = outgoing.get(current);
    }
  }
  return { byId, byPath };
}
function validateArtifactHandoffAuthority(handoffs, receiptLedger) {
  if (!handoffs?.byPath || !(handoffs.byPath instanceof Map)) throw new Error("Artifact handoff authority validation requires validated handoff chains.");
  if (!receiptLedger || !Array.isArray(receiptLedger.artifactHistory)) throw new Error("Artifact handoff authority validation requires the validated execution receipt ledger.");
  const receiptByPathAndId = /* @__PURE__ */ new Map();
  for (const entry of receiptLedger.artifactHistory) receiptByPathAndId.set(`${entry.path}
${entry.receiptId}`, entry);
  for (const [artifactPath, chain] of handoffs.byPath) {
    let expectedOwner = null;
    for (const handoff of chain) {
      const source = receiptByPathAndId.get(`${artifactPath}
${handoff.fromReceiptId}`);
      if (!source || source.missionId !== handoff.fromMissionId || source.sha256 !== handoff.fromSha256) {
        throw new Error(`Artifact handoff ${handoff.handoffId} source receipt does not prove ownership of ${artifactPath} by mission ${handoff.fromMissionId}.`);
      }
      if (expectedOwner !== null && handoff.fromMissionId !== expectedOwner) {
        throw new Error(`Artifact handoff chain for ${artifactPath} does not continue from the previously authorized owner ${expectedOwner}.`);
      }
      expectedOwner = handoff.toMissionId;
    }
  }
  return handoffs;
}
function artifactHandoffPath(handoffId) {
  return path5.posix.join(ARTIFACT_PATHS.artifactHandoffsDir, `${safeId(handoffId, "Artifact handoff id")}.json`);
}
function handoffAuthorizes(handoffs, artifactPath, fromMissionId, toMissionId, receiptId, sha256Value) {
  const chain = handoffs?.byPath?.get(artifactPath) ?? [];
  return chain.some((handoff) => handoff.fromMissionId === fromMissionId && handoff.toMissionId === toMissionId && handoff.fromReceiptId === receiptId && handoff.fromSha256 === sha256Value);
}

// src/core/receipt-ledger.mjs
import crypto5 from "node:crypto";
import fs5 from "node:fs";
import path6 from "node:path";

// src/core/execution-facts.mjs
import crypto3 from "node:crypto";
var SCIENTIFIC_CONCLUSION_PATTERNS = Object.freeze([
  /\b(?:hypothesis|theory|mechanism|method|approach|model|algorithm|intervention)\b.{0,80}\b(?:proven|proved|confirmed|validated|supported|refuted|true|false|superior|inferior|causal|causes?|outperform(?:s|ed)?|improv(?:es|ed))\b/iu,
  /\b(?:results?|findings?|data|evidence|experiment)\b.{0,48}\b(?:prove[sd]?|confirm(?:s|ed)?|validate[sd]?|support(?:s|ed)?|refute[sd]?|demonstrate[sd]?|establish(?:es|ed)?|show(?:s|ed)?\s+that)\b.{0,80}\b(?:hypothesis|theory|mechanism|method|approach|model|algorithm|intervention|causal|superior|inferior)\b/iu,
  /\b(?:scientific|research)\s+conclusion\b/iu,
  /(?:假设|理论|机制|方法|方案|模型|算法|干预).{0,40}(?:被?证明|被?证实|被?确认|被?验证|成立|不成立|正确|错误|优于|劣于|具有因果|导致)/u,
  /(?:结果|发现|数据|证据|实验).{0,30}(?:证明|证实|确认|验证|支持|否定|表明|显示).{0,40}(?:假设|理论|机制|方法|方案|模型|算法|因果|结论)/u,
  /科研结论|科学结论/u
]);
var EXECUTION_FACT_FIELDS = Object.freeze(["factId", "statement"]);
var FACT_ID = /^fact-[0-9a-f]{24}$/u;
function assertExecutionFactText(value, label = "Execution fact") {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  const statement = value.trim();
  if (SCIENTIFIC_CONCLUSION_PATTERNS.some((pattern) => pattern.test(statement))) {
    throw new Error(`${label} may report execution facts only; the host cannot declare a hypothesis proven or a scientific conclusion.`);
  }
  return statement;
}
function executionFactHash(statement) {
  return crypto3.createHash("sha256").update(assertExecutionFactText(statement)).digest("hex");
}
function executionFactId(statement) {
  return `fact-${executionFactHash(statement).slice(0, 24)}`;
}
function createExecutionFact(value, label = "Execution fact") {
  const statement = typeof value === "string" ? assertExecutionFactText(value, label) : assertExecutionFactText(value?.statement, `${label}.statement`);
  const factId = typeof value === "string" || value?.factId === void 0 ? executionFactId(statement) : value.factId;
  if (!FACT_ID.test(factId) || factId !== executionFactId(statement)) throw new Error(`${label}.factId must match the stable execution fact statement digest.`);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const unknown = Object.keys(value).filter((field) => !EXECUTION_FACT_FIELDS.includes(field));
    if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
  return Object.freeze({ factId, statement });
}
function readStoredExecutionFact(value, label = "Execution fact") {
  return createExecutionFact(value, label);
}

// src/core/mission-contract-integrity.mjs
import crypto4 from "node:crypto";
var MISSION_CONTRACT_SCHEMA_VERSION = 5;
var MISSION_MODES = Object.freeze(["ordinary", "research"]);
var MISSION_BRANCH_KINDS = Object.freeze(["continuation", "alternative", "follow-up", "recovery"]);
var MISSION_CRITERION_ID_VERSION = 2;
var MISSION_EVIDENCE_REQUIREMENT_ID_VERSION = 2;
var MISSION_ARTIFACT_ROLES = Object.freeze(["output", "input-output", "supporting"]);
var MISSION_CONTRACT_INPUT_FIELDS = Object.freeze([
  "missionId",
  "mode",
  "goal",
  "requirements",
  "assumptions",
  "scope",
  "outOfScope",
  "artifacts",
  "completionCriteria",
  "evidenceRequirements",
  "dependsOnMissionIds",
  "parentMissionId",
  "branchKind",
  "branchReason"
]);
var PERSISTED_MISSION_FIELDS = Object.freeze([
  "schemaVersion",
  "workspaceId",
  "workspaceRevisionId",
  "workspaceRevisionDigest",
  "missionId",
  "mode",
  "contractDigest",
  "createdAt",
  "goal",
  "requirements",
  "assumptions",
  "scope",
  "outOfScope",
  "artifacts",
  "completionCriteria",
  "evidenceRequirements",
  "dependsOnMissionIds",
  "parentMissionId",
  "branchKind",
  "branchReason"
]);
var PERSISTED_FIELD_SET = new Set(PERSISTED_MISSION_FIELDS);
var SAFE_ID2 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH2 = /^[0-9a-f]{64}$/u;
var MODE_SET = new Set(MISSION_MODES);
var BRANCH_KIND_SET = new Set(MISSION_BRANCH_KINDS);
var ARTIFACT_ROLE_SET = new Set(MISSION_ARTIFACT_ROLES);
var TYPED_EVIDENCE_PATTERN = /^(artifact|validation):(.+)$/u;
var ARTIFACT_FIELDS = /* @__PURE__ */ new Set(["path", "required", "role"]);
var CRITERION_FIELDS = /* @__PURE__ */ new Set(["criterionId", "criterion"]);
var EVIDENCE_FIELDS = /* @__PURE__ */ new Set(["requirementId", "requirement"]);
function sha2563(value) {
  return crypto4.createHash("sha256").update(value).digest("hex");
}
function stableValue2(value) {
  if (Array.isArray(value)) return value.map(stableValue2);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue2(item)]));
  return value;
}
function stableMissionSerialize(value) {
  return JSON.stringify(stableValue2(value));
}
function plain2(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function sealed2(value, fields, label) {
  plain2(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function text2(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function safeId2(value, label) {
  const normalized3 = text2(value, label);
  if (!SAFE_ID2.test(normalized3)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized3;
}
function hash2(value, label) {
  const normalized3 = text2(value, label);
  if (!HASH2.test(normalized3)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return normalized3;
}
function exactIso2(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value;
}
function strings(value, label) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const result = value.map((item, index) => text2(item, `${label}[${index}]`));
  if (new Set(result).size !== result.length) throw new Error(`${label} must not contain duplicates.`);
  return result;
}
function canonicalPath2(rawPath, label) {
  const normalized3 = normalizeProjectRelativePath(rawPath);
  if (!normalized3.ok || normalized3.normalizedPath !== String(rawPath).trim().replace(/\\/gu, "/")) throw new Error(`${label} must be a canonical safe project-relative path.`);
  const role = artifactEvidenceRole(normalized3.normalizedPath);
  if (normalized3.normalizedPath === ARTIFACT_PATHS.lessonsDocument) throw new Error(`${label} must not reference the advisory-only Lessons document.`);
  if (role === "bookkeeping" || role === "unsupported") throw new Error(`${label} must reference a substantive current-schema or external project artifact.`);
  return normalized3.normalizedPath;
}
function normalizeArtifacts(value) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error("artifacts must be an array.");
  const result = value.map((item, index) => {
    const label = `artifacts[${index}]`;
    sealed2(item, ARTIFACT_FIELDS, label);
    const role = text2(item.role, `${label}.role`);
    if (!ARTIFACT_ROLE_SET.has(role)) throw new Error(`${label}.role must be one of: ${MISSION_ARTIFACT_ROLES.join(", ")}.`);
    if (typeof item.required !== "boolean") throw new Error(`${label}.required must be boolean.`);
    return { path: canonicalPath2(item.path, `${label}.path`), required: item.required, role };
  });
  if (new Set(result.map((item) => item.path)).size !== result.length) throw new Error("artifacts must not contain duplicate paths.");
  return result;
}
function missionCompletionCriterionId(_index, criterion) {
  return `criterion-${sha2563(stableMissionSerialize({ version: MISSION_CRITERION_ID_VERSION, criterion })).slice(0, 16)}`;
}
function missionEvidenceRequirementId(_index, requirement) {
  return `evidence-${sha2563(stableMissionSerialize({ version: MISSION_EVIDENCE_REQUIREMENT_ID_VERSION, requirement })).slice(0, 16)}`;
}
function normalizeCriteria(value) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error("completionCriteria must be an array.");
  const result = value.map((item, index) => {
    const label = `completionCriteria[${index}]`;
    if (typeof item === "string") {
      const criterion2 = text2(item, label);
      return { criterionId: missionCompletionCriterionId(index, criterion2), criterion: criterion2 };
    }
    sealed2(item, CRITERION_FIELDS, label);
    const criterion = text2(item.criterion, `${label}.criterion`);
    const criterionId = safeId2(item.criterionId, `${label}.criterionId`);
    if (criterionId !== missionCompletionCriterionId(index, criterion)) throw new Error(`${label}.criterionId does not match its canonical criterion.`);
    return { criterionId, criterion };
  });
  if (new Set(result.map((item) => item.criterionId)).size !== result.length) throw new Error("completionCriteria must not contain duplicate criteria.");
  return result;
}
function normalizeEvidenceReference(value, label) {
  const requirement = text2(value, label);
  if (requirement === "review:authoritative" || requirement.startsWith("source:")) throw new Error(`${label} requests authority that this mission contract cannot mint.`);
  const match = TYPED_EVIDENCE_PATTERN.exec(requirement);
  if (!match) throw new Error(`${label} must use artifact:<path> or validation:<path>.`);
  const [, kind, raw] = match;
  return `${kind}:${canonicalPath2(raw, label)}`;
}
function normalizeEvidenceRequirements(value) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error("evidenceRequirements must be an array.");
  const result = value.map((item, index) => {
    const label = `evidenceRequirements[${index}]`;
    if (typeof item === "string") {
      const requirement2 = normalizeEvidenceReference(item, label);
      return { requirementId: missionEvidenceRequirementId(index, requirement2), requirement: requirement2 };
    }
    sealed2(item, EVIDENCE_FIELDS, label);
    const requirement = normalizeEvidenceReference(item.requirement, `${label}.requirement`);
    const requirementId = safeId2(item.requirementId, `${label}.requirementId`);
    if (requirementId !== missionEvidenceRequirementId(index, requirement)) throw new Error(`${label}.requirementId does not match its canonical requirement.`);
    return { requirementId, requirement };
  });
  if (new Set(result.map((item) => item.requirementId)).size !== result.length) throw new Error("evidenceRequirements must not contain duplicates.");
  return result;
}
function normalizeMissionMode(value) {
  const mode = text2(value, "Mission mode");
  if (!MODE_SET.has(mode)) throw new Error(`Mission mode must be one of: ${MISSION_MODES.join(", ")}.`);
  return mode;
}
function normalizeMissionContractContent(value = {}) {
  plain2(value, "Mission contract");
  const content = {
    mode: normalizeMissionMode(value.mode),
    goal: text2(value.goal, "Dove mission goal"),
    requirements: strings(value.requirements, "requirements"),
    assumptions: strings(value.assumptions, "assumptions"),
    scope: strings(value.scope, "scope"),
    outOfScope: strings(value.outOfScope, "outOfScope"),
    artifacts: normalizeArtifacts(value.artifacts),
    completionCriteria: normalizeCriteria(value.completionCriteria),
    evidenceRequirements: normalizeEvidenceRequirements(value.evidenceRequirements),
    dependsOnMissionIds: strings(value.dependsOnMissionIds, "dependsOnMissionIds").map((item, index) => safeId2(item, `dependsOnMissionIds[${index}]`))
  };
  const parentMissionId = value.parentMissionId === void 0 ? null : safeId2(value.parentMissionId, "parentMissionId");
  const branchKind = value.branchKind === void 0 ? null : text2(value.branchKind, "branchKind");
  const branchReason = value.branchReason === void 0 ? null : text2(value.branchReason, "branchReason");
  if (parentMissionId) {
    if (!BRANCH_KIND_SET.has(branchKind)) throw new Error(`branchKind must be one of: ${MISSION_BRANCH_KINDS.join(", ")}.`);
    if (!branchReason) throw new Error("Child missions require branchReason.");
    Object.assign(content, { parentMissionId, branchKind, branchReason });
  } else if (branchKind || branchReason) throw new Error("Root missions must not declare branchKind or branchReason.");
  return content;
}
function missionCompletionCriteria(content = {}) {
  return normalizeCriteria(content.completionCriteria);
}
function missionEvidenceRequirements(content = {}) {
  return normalizeEvidenceRequirements(content.evidenceRequirements);
}
function missionContractDigest(missionId2, content, workspaceRevision = {}) {
  const normalizedMissionId = safeId2(missionId2, "missionId");
  const workspaceRevisionId2 = safeId2(workspaceRevision.workspaceRevisionId, "workspaceRevisionId");
  const workspaceRevisionDigest2 = hash2(workspaceRevision.workspaceRevisionDigest, "workspaceRevisionDigest");
  return sha2563(stableMissionSerialize({ schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION, missionId: normalizedMissionId, workspaceRevisionId: workspaceRevisionId2, workspaceRevisionDigest: workspaceRevisionDigest2, ...normalizeMissionContractContent(content) }));
}
function currentMissionContractMetadata(mission = {}) {
  sealed2(mission, PERSISTED_FIELD_SET, "Mission contract");
  if (mission.schemaVersion !== MISSION_CONTRACT_SCHEMA_VERSION) throw new Error(`Mission contract schemaVersion ${mission.schemaVersion ?? "missing"} is unsupported.`);
  const missionId2 = safeId2(mission.missionId, "Mission contract missionId");
  const workspaceId = safeId2(mission.workspaceId, "Mission contract workspaceId");
  const workspaceRevisionId2 = safeId2(mission.workspaceRevisionId, "Mission contract workspaceRevisionId");
  const workspaceRevisionDigest2 = hash2(mission.workspaceRevisionDigest, "Mission contract workspaceRevisionDigest");
  const createdAt = exactIso2(mission.createdAt, "Mission contract createdAt");
  const content = normalizeMissionContractContent(mission);
  const contractDigest = missionContractDigest(missionId2, content, { workspaceRevisionId: workspaceRevisionId2, workspaceRevisionDigest: workspaceRevisionDigest2 });
  return { missionId: missionId2, workspaceId, workspaceRevisionId: workspaceRevisionId2, workspaceRevisionDigest: workspaceRevisionDigest2, createdAt, content, contractDigest, completionCriteria: content.completionCriteria, evidenceRequirements: content.evidenceRequirements };
}
function assertCurrentMissionContract(mission = {}, options = {}) {
  const current = currentMissionContractMetadata(mission);
  const label = options.label ?? `Mission contract ${current.missionId}`;
  if (options.workspaceId !== void 0 && current.workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  if (options.filename !== void 0 && options.filename !== `${current.missionId}.json`) throw new Error(`${label} filename must match missionId ${current.missionId}.`);
  if (mission.contractDigest !== current.contractDigest) throw new Error(`${label}.contractDigest does not match its canonical mission content.`);
  return current;
}
function validatePersistedMission(mission, options = {}) {
  assertCurrentMissionContract(mission, options);
  return mission;
}

// src/core/validation-records.mjs
var VALIDATION_RESULTS = Object.freeze(["passed", "failed", "incomplete"]);
var VALIDATION_LEVELS = Object.freeze(["static", "unit", "contract", "integration", "e2e"]);
var VALIDATION_PRODUCER_KINDS = Object.freeze(["host-observed", "dove-internal"]);
var VALIDATION_KINDS = Object.freeze(["test-log", "typecheck-log", "lint-log", "build-log", "audit-log", "validation-log", "command-output"]);
var VALIDATION_FIELDS = Object.freeze(["kind", "result", "level", "producerKind", "producerOperation", "observedExitStatus", "targetReference", "targetHash", "reference", "outputHash"]);
var RESULT_SET = new Set(VALIDATION_RESULTS);
var LEVEL_SET = new Set(VALIDATION_LEVELS);
var PRODUCER_KIND_SET = new Set(VALIDATION_PRODUCER_KINDS);
var KIND_SET = new Set(VALIDATION_KINDS);
var HASH3 = /^[0-9a-f]{64}$/u;
var SAFE_ID3 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
function exactString(value, label) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) throw new Error(`${label} must be a canonical non-empty string.`);
  return value;
}
function exactHash(value, label) {
  const normalized3 = exactString(value, label);
  if (!HASH3.test(normalized3)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return normalized3;
}
function exactSafeId(value, label) {
  const normalized3 = exactString(value, label);
  if (!SAFE_ID3.test(normalized3)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized3;
}
function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function assertFields(value, fields, label) {
  assertObject(value, label);
  const allowed2 = new Set(fields);
  const unknown = Object.keys(value).filter((field) => !allowed2.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function exactExitStatus(value, label) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > 255) throw new Error(`${label} must be an integer from 0 through 255, or null when no exit status was observed.`);
  return value;
}
function createValidationRecord(value, options = {}) {
  const label = options.label ?? "validation";
  assertFields(value, VALIDATION_FIELDS, label);
  const kind = exactString(value.kind, `${label}.kind`);
  if (!KIND_SET.has(kind)) throw new Error(`${label}.kind must be one of: ${VALIDATION_KINDS.join(", ")}.`);
  const result = exactString(value.result, `${label}.result`);
  if (!RESULT_SET.has(result)) throw new Error(`${label}.result must be one of: ${VALIDATION_RESULTS.join(", ")}.`);
  const level = exactString(value.level, `${label}.level`);
  if (!LEVEL_SET.has(level)) throw new Error(`${label}.level must be one of: ${VALIDATION_LEVELS.join(", ")}.`);
  const producerKind = exactString(value.producerKind, `${label}.producerKind`);
  if (!PRODUCER_KIND_SET.has(producerKind)) throw new Error(`${label}.producerKind must be one of: ${VALIDATION_PRODUCER_KINDS.join(", ")}.`);
  const producerOperation = exactSafeId(value.producerOperation, `${label}.producerOperation`);
  const observedExitStatus = exactExitStatus(value.observedExitStatus, `${label}.observedExitStatus`);
  const targetReference = exactString(value.targetReference, `${label}.targetReference`);
  const targetHash = exactHash(value.targetHash, `${label}.targetHash`);
  const reference = exactString(value.reference, `${label}.reference`);
  const outputHash = exactHash(value.outputHash, `${label}.outputHash`);
  if (result === "passed" && observedExitStatus !== null && observedExitStatus !== 0) throw new Error(`${label}.result passed conflicts with a non-zero observedExitStatus.`);
  if (result === "failed" && observedExitStatus === 0) throw new Error(`${label}.result failed conflicts with observedExitStatus 0.`);
  return Object.freeze({ kind, result, level, producerKind, producerOperation, observedExitStatus, targetReference, targetHash, reference, outputHash });
}
function validationContributesToCompletion(validation) {
  return validation?.result === "passed";
}

// src/core/receipt-ledger.mjs
var EXECUTION_RECEIPT_SCHEMA_VERSION = 5;
var EXECUTION_RECEIPT_PRODUCER_KINDS = Object.freeze(["public-execution", "dove-internal"]);
var ORDINARY_HOST_OUTCOME_STATUSES = Object.freeze(["completed", "stopped", "blocked", "failed"]);
var ORDINARY_HOST_OUTCOME_MODES = Object.freeze(["artifact-backed", "observation-only"]);
var RECEIPT_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "receiptId",
  "ledgerSequence",
  "missionId",
  "contractDigest",
  "summary",
  "artifacts",
  "validations",
  "criteriaSatisfied",
  "producedAt",
  "recordedAt",
  "producer",
  "ordinaryHostOutcome",
  "researchOutcome"
]);
var ARTIFACT_FIELDS2 = /* @__PURE__ */ new Set(["path", "kind", "sha256", "derivedReferences"]);
var STORED_VALIDATION_FIELDS = new Set(VALIDATION_FIELDS);
var CRITERION_FIELDS2 = /* @__PURE__ */ new Set(["criterionId", "evidenceRefs", "evidenceBindings"]);
var EVIDENCE_BINDING_FIELDS = /* @__PURE__ */ new Set(["reference", "sha256", "receiptId"]);
var PRODUCER_FIELDS = /* @__PURE__ */ new Set(["kind", "actionId"]);
var ORDINARY_HOST_OUTCOME_FIELDS = /* @__PURE__ */ new Set(["attemptId", "mode", "status", "facts", "callbackDigest"]);
var RESEARCH_OUTCOME_FIELDS = /* @__PURE__ */ new Set(["attemptId", "decisionId", "decisionDigest", "actionId", "actionDigest", "envelopeId", "status", "evidenceReturned", "actualUsage", "facts", "startedAt", "finishedAt", "callbackDigest"]);
var SAFE_ID4 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH4 = /^[0-9a-f]{64}$/u;
var PRODUCER_KIND_SET2 = new Set(EXECUTION_RECEIPT_PRODUCER_KINDS);
var ORDINARY_HOST_OUTCOME_STATUS_SET = new Set(ORDINARY_HOST_OUTCOME_STATUSES);
var ORDINARY_HOST_OUTCOME_MODE_SET = new Set(ORDINARY_HOST_OUTCOME_MODES);
var INTERNAL_ACTION_IDS = new Set(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.id));
function stableValue3(value) {
  if (Array.isArray(value)) return value.map(stableValue3);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue3(item)]));
  }
  return value;
}
function sha2564(value) {
  return crypto5.createHash("sha256").update(JSON.stringify(stableValue3(value))).digest("hex");
}
function ordinaryHostOutcomeCallbackDigest(value) {
  return sha2564({
    attemptId: value.attemptId,
    missionId: value.missionId,
    contractDigest: value.contractDigest,
    summary: value.summary,
    mode: value.mode,
    status: value.status,
    facts: value.facts,
    artifacts: value.artifacts.map(({ path: artifactPath, sha256: artifactSha256 }) => ({ path: artifactPath, sha256: artifactSha256 })),
    validations: value.validations.map(({ kind, result, level, producerKind, producerOperation, observedExitStatus, targetReference, targetHash, reference, outputHash }) => ({ kind, result, level, producerKind, producerOperation, observedExitStatus, targetReference, targetHash, reference, outputHash }))
  });
}
function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function assertSealed(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function exactString2(value, label) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) throw new Error(`${label} must be a canonical non-empty string.`);
  return value;
}
function safeId3(value, label) {
  const normalized3 = exactString2(value, label);
  if (!SAFE_ID4.test(normalized3)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized3;
}
function hash3(value, label) {
  const normalized3 = exactString2(value, label);
  if (!HASH4.test(normalized3)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return normalized3;
}
function exactIso3(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value;
}
function canonicalPath3(value, label) {
  const normalized3 = normalizeProjectRelativePath(value);
  if (!normalized3.ok) throw new Error(`${label} has an unsafe path: ${normalized3.reason}.`);
  if (value !== normalized3.normalizedPath) throw new Error(`${label} must use a canonical project-relative path.`);
  return value;
}
function canonicalStringArray(value, label, options = {}) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const items = value.map((item, index) => exactString2(item, `${label}[${index}]`));
  if (new Set(items).size !== items.length) throw new Error(`${label} must not contain duplicates.`);
  if (options.sorted === true && items.some((item, index) => index > 0 && items[index - 1].localeCompare(item) > 0)) {
    throw new Error(`${label} must use canonical lexical order.`);
  }
  return items;
}
function validateProducer(value, label) {
  assertSealed(value, PRODUCER_FIELDS, label);
  if (!PRODUCER_KIND_SET2.has(value.kind)) throw new Error(`${label}.kind is unsupported.`);
  const actionId = safeId3(value.actionId, `${label}.actionId`);
  if (value.kind === "public-execution" && !["ingest-execution-receipt", "close-host-outcome"].includes(actionId)) {
    throw new Error(`${label} public-execution producer must use actionId ingest-execution-receipt or close-host-outcome.`);
  }
  if (value.kind === "dove-internal" && (!INTERNAL_ACTION_IDS.has(actionId) || actionId === "ingest-execution-receipt")) {
    throw new Error(`${label} dove-internal producer actionId is not a registered internal Dove mutation.`);
  }
  return value;
}
function validateStoredReceipt(value, context) {
  const { manifest, missions, label, filename } = context;
  assertSealed(value, RECEIPT_FIELDS, label);
  if (value.schemaVersion !== EXECUTION_RECEIPT_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  if (value.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  safeId3(value.workspaceId, `${label}.workspaceId`);
  const receiptId = safeId3(value.receiptId, `${label}.receiptId`);
  if (filename !== `${receiptId}.json`) throw new Error(`${label} filename must match receiptId ${receiptId}.`);
  if (!Number.isSafeInteger(value.ledgerSequence) || value.ledgerSequence < 1) throw new Error(`${label}.ledgerSequence must be a positive safe integer.`);
  const missionId2 = safeId3(value.missionId, `${label}.missionId`);
  const mission = missions.get(missionId2);
  if (!mission) throw new Error(`${label} references unknown mission ${missionId2}.`);
  hash3(value.contractDigest, `${label}.contractDigest`);
  if (value.contractDigest !== mission.contractDigest) throw new Error(`${label}.contractDigest does not match mission ${missionId2}.`);
  exactString2(value.summary, `${label}.summary`);
  exactIso3(value.producedAt, `${label}.producedAt`);
  exactIso3(value.recordedAt, `${label}.recordedAt`);
  validateProducer(value.producer, `${label}.producer`);
  if (!Array.isArray(value.artifacts)) throw new Error(`${label}.artifacts must be an array.`);
  if (!Array.isArray(value.validations)) throw new Error(`${label}.validations must be an array.`);
  if (!Array.isArray(value.criteriaSatisfied)) throw new Error(`${label}.criteriaSatisfied must be an array.`);
  const ordinaryHostOutcome = value.ordinaryHostOutcome;
  if (ordinaryHostOutcome !== void 0) {
    assertSealed(ordinaryHostOutcome, ORDINARY_HOST_OUTCOME_FIELDS, `${label}.ordinaryHostOutcome`);
    safeId3(ordinaryHostOutcome.attemptId, `${label}.ordinaryHostOutcome.attemptId`);
    if (!ORDINARY_HOST_OUTCOME_MODE_SET.has(ordinaryHostOutcome.mode)) throw new Error(`${label}.ordinaryHostOutcome.mode is unsupported.`);
    if (!ORDINARY_HOST_OUTCOME_STATUS_SET.has(ordinaryHostOutcome.status)) throw new Error(`${label}.ordinaryHostOutcome.status is unsupported.`);
    if (!Array.isArray(ordinaryHostOutcome.facts)) throw new Error(`${label}.ordinaryHostOutcome.facts must be an array.`);
    const facts = ordinaryHostOutcome.facts.map((fact, index) => readStoredExecutionFact(fact, `${label}.ordinaryHostOutcome.facts[${index}]`));
    if (new Set(facts.map((fact) => fact.factId)).size !== facts.length) throw new Error(`${label}.ordinaryHostOutcome.facts must not contain duplicates.`);
    ordinaryHostOutcome.facts = facts;
    hash3(ordinaryHostOutcome.callbackDigest, `${label}.ordinaryHostOutcome.callbackDigest`);
    if (ordinaryHostOutcome.mode === "observation-only" && facts.length === 0) throw new Error(`${label}.ordinaryHostOutcome observation-only mode requires at least one execution fact.`);
    if (ordinaryHostOutcome.mode === "observation-only" && (value.artifacts.length > 0 || value.validations.length > 0)) {
      throw new Error(`${label}.ordinaryHostOutcome observation-only mode cannot own artifacts or claim validations.`);
    }
    if (ordinaryHostOutcome.mode === "artifact-backed" && value.artifacts.length === 0) throw new Error(`${label}.ordinaryHostOutcome artifact-backed mode requires at least one artifact.`);
  }
  const researchOutcome = value.researchOutcome;
  if (researchOutcome !== void 0) {
    assertSealed(researchOutcome, RESEARCH_OUTCOME_FIELDS, `${label}.researchOutcome`);
    safeId3(researchOutcome.attemptId, `${label}.researchOutcome.attemptId`);
    safeId3(researchOutcome.decisionId, `${label}.researchOutcome.decisionId`);
    hash3(researchOutcome.decisionDigest, `${label}.researchOutcome.decisionDigest`);
    safeId3(researchOutcome.actionId, `${label}.researchOutcome.actionId`);
    hash3(researchOutcome.actionDigest, `${label}.researchOutcome.actionDigest`);
    safeId3(researchOutcome.envelopeId, `${label}.researchOutcome.envelopeId`);
    exactString2(researchOutcome.status, `${label}.researchOutcome.status`);
    canonicalStringArray(researchOutcome.evidenceReturned, `${label}.researchOutcome.evidenceReturned`);
    assertPlainObject(researchOutcome.actualUsage, `${label}.researchOutcome.actualUsage`);
    for (const [dimension, amount] of Object.entries(researchOutcome.actualUsage)) {
      exactString2(dimension, `${label}.researchOutcome.actualUsage dimension`);
      if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`${label}.researchOutcome.actualUsage.${dimension} must be a non-negative safe integer.`);
    }
    canonicalStringArray(researchOutcome.facts, `${label}.researchOutcome.facts`);
    exactIso3(researchOutcome.startedAt, `${label}.researchOutcome.startedAt`);
    exactIso3(researchOutcome.finishedAt, `${label}.researchOutcome.finishedAt`);
    hash3(researchOutcome.callbackDigest, `${label}.researchOutcome.callbackDigest`);
    const expectedResearchDigest = sha2564({
      attemptId: researchOutcome.attemptId,
      missionId: value.missionId,
      decisionDigest: researchOutcome.decisionDigest,
      actionId: researchOutcome.actionId,
      actionDigest: researchOutcome.actionDigest,
      status: researchOutcome.status,
      performedActionCount: researchOutcome.actualUsage.actions,
      actualUsage: researchOutcome.actualUsage,
      evidenceReturned: researchOutcome.evidenceReturned,
      artifacts: value.artifacts.map(({ path: artifactPath, sha256: artifactSha256 }) => ({ path: artifactPath, sha256: artifactSha256 })),
      validations: value.validations.map(({ reference, outputHash }) => ({ path: reference, sha256: outputHash })),
      facts: researchOutcome.facts,
      startedAt: researchOutcome.startedAt,
      finishedAt: researchOutcome.finishedAt
    });
    if (researchOutcome.callbackDigest !== expectedResearchDigest) throw new Error(`${label}.researchOutcome.callbackDigest does not match its immutable callback content.`);
    if (value.producer.kind !== "dove-internal" || value.producer.actionId !== "record-research-outcome") throw new Error(`${label}.researchOutcome requires the record-research-outcome producer.`);
  }
  if (ordinaryHostOutcome !== void 0 && researchOutcome !== void 0) throw new Error(`${label} cannot contain both ordinaryHostOutcome and researchOutcome.`);
  if (value.artifacts.length === 0 && value.validations.length === 0 && value.criteriaSatisfied.length === 0 && ordinaryHostOutcome === void 0 && researchOutcome === void 0) {
    throw new Error(`${label} must contain an artifact, validation, satisfied criterion, ordinary outcome, or research outcome.`);
  }
  const artifactPaths = /* @__PURE__ */ new Set();
  for (const [index, artifact] of value.artifacts.entries()) {
    const itemLabel = `${label}.artifacts[${index}]`;
    assertSealed(artifact, ARTIFACT_FIELDS2, itemLabel);
    const artifactPath = canonicalPath3(artifact.path, `${itemLabel}.path`);
    if (artifactPaths.has(artifactPath)) throw new Error(`${label}.artifacts contains duplicate path ${artifactPath}.`);
    artifactPaths.add(artifactPath);
    exactString2(artifact.kind, `${itemLabel}.kind`);
    hash3(artifact.sha256, `${itemLabel}.sha256`);
    canonicalStringArray(artifact.derivedReferences, `${itemLabel}.derivedReferences`, { sorted: true });
  }
  const validationPaths = /* @__PURE__ */ new Set();
  value.validations = value.validations.map((validation, index) => {
    const itemLabel = `${label}.validations[${index}]`;
    assertSealed(validation, STORED_VALIDATION_FIELDS, itemLabel);
    const normalized3 = createValidationRecord(validation, { label: itemLabel });
    const reference = canonicalPath3(normalized3.reference, `${itemLabel}.reference`);
    if (validationPaths.has(reference)) throw new Error(`${label}.validations contains duplicate reference ${reference}.`);
    if (artifactPaths.has(reference)) throw new Error(`${label} artifact and validation paths must be canonically distinct: ${reference}.`);
    validationPaths.add(reference);
    hash3(normalized3.outputHash, `${itemLabel}.outputHash`);
    const separator = normalized3.targetReference.indexOf(":");
    const targetKind = normalized3.targetReference.slice(0, separator);
    const target = normalized3.targetReference.slice(separator + 1);
    if (!["artifact", "validation"].includes(targetKind) || !target) throw new Error(`${itemLabel}.targetReference must be an exact typed file binding.`);
    canonicalPath3(target, `${itemLabel}.targetReference`);
    return normalized3;
  });
  const artifactHashByReference = new Map(value.artifacts.map((artifact) => [`artifact:${artifact.path}`, artifact.sha256]));
  const validationHashByReference = new Map(value.validations.map((validation) => [`validation:${validation.reference}`, validation.outputHash]));
  const factHashByReference = new Map((ordinaryHostOutcome?.facts ?? []).map((fact) => [`fact:${fact.factId}`, executionFactHash(fact.statement)]));
  const criterionIds = /* @__PURE__ */ new Set();
  const missionCriterionIds = new Set(missionCompletionCriteria(mission).map((item) => item.criterionId));
  for (const [index, criterion] of value.criteriaSatisfied.entries()) {
    const itemLabel = `${label}.criteriaSatisfied[${index}]`;
    assertSealed(criterion, CRITERION_FIELDS2, itemLabel);
    const criterionId = safeId3(criterion.criterionId, `${itemLabel}.criterionId`);
    if (!missionCriterionIds.has(criterionId)) throw new Error(`${itemLabel}.criterionId is unknown for mission ${missionId2}.`);
    if (criterionIds.has(criterionId)) throw new Error(`${label}.criteriaSatisfied contains duplicate criterionId ${criterionId}.`);
    criterionIds.add(criterionId);
    const references = canonicalStringArray(criterion.evidenceRefs, `${itemLabel}.evidenceRefs`);
    if (references.length === 0) throw new Error(`${itemLabel}.evidenceRefs must contain at least one item.`);
    if (!Array.isArray(criterion.evidenceBindings) || criterion.evidenceBindings.length !== references.length) {
      throw new Error(`${itemLabel}.evidenceBindings must bind every evidence reference to its original hash.`);
    }
    const bindingByReference = /* @__PURE__ */ new Map();
    for (const [bindingIndex, binding] of criterion.evidenceBindings.entries()) {
      const bindingLabel = `${itemLabel}.evidenceBindings[${bindingIndex}]`;
      assertSealed(binding, EVIDENCE_BINDING_FIELDS, bindingLabel);
      const reference = exactString2(binding.reference, `${bindingLabel}.reference`);
      if (bindingByReference.has(reference)) throw new Error(`${itemLabel}.evidenceBindings contains duplicate reference ${reference}.`);
      const receiptId2 = safeId3(binding.receiptId, `${bindingLabel}.receiptId`);
      bindingByReference.set(reference, { sha256: hash3(binding.sha256, `${bindingLabel}.sha256`), receiptId: receiptId2 });
    }
    for (const [referenceIndex, reference] of references.entries()) {
      const separator = reference.indexOf(":");
      if (separator <= 0 || separator === reference.length - 1) throw new Error(`${itemLabel}.evidenceRefs[${referenceIndex}] must be a typed evidence reference.`);
      const kind = reference.slice(0, separator);
      const target = reference.slice(separator + 1);
      if ((kind === "artifact" || kind === "validation") && canonicalPath3(target, `${itemLabel}.evidenceRefs[${referenceIndex}]`) !== target) {
        throw new Error(`${itemLabel}.evidenceRefs[${referenceIndex}] must be canonical.`);
      }
      if (!bindingByReference.has(reference)) throw new Error(`${itemLabel}.evidenceBindings is missing ${reference}.`);
      const binding = bindingByReference.get(reference);
      const declaredHash = kind === "artifact" ? artifactHashByReference.get(reference) : kind === "validation" ? validationHashByReference.get(reference) : kind === "fact" ? factHashByReference.get(reference) : null;
      if (kind === "fact" && !declaredHash) throw new Error(`${itemLabel}.evidenceRefs[${referenceIndex}] references an unknown execution fact.`);
      if (declaredHash && (binding.sha256 !== declaredHash || binding.receiptId !== receiptId)) throw new Error(`${itemLabel}.evidenceBindings does not match the receipt declaration for ${reference}.`);
    }
  }
  if (ordinaryHostOutcome !== void 0) {
    const currentDigest = ordinaryHostOutcomeCallbackDigest({
      attemptId: ordinaryHostOutcome.attemptId,
      missionId: value.missionId,
      contractDigest: value.contractDigest,
      summary: value.summary,
      mode: ordinaryHostOutcome.mode,
      status: ordinaryHostOutcome.status,
      facts: ordinaryHostOutcome.facts,
      artifacts: value.artifacts,
      validations: value.validations
    });
    if (ordinaryHostOutcome.callbackDigest !== currentDigest) {
      throw new Error(`${label}.ordinaryHostOutcome.callbackDigest does not match its canonical callback content.`);
    }
  }
  return value;
}
function readJsonStrict(fullPath, label) {
  let text11;
  try {
    text11 = fs5.readFileSync(fullPath, "utf8");
  } catch (error) {
    throw new Error(`${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return JSON.parse(text11);
  } catch (error) {
    throw new Error(`Malformed durable JSON in ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function derivedState(manifest, receipts, artifactHandoffs) {
  const currentByPath = /* @__PURE__ */ new Map();
  const artifactHistory = [];
  for (const receipt of receipts) {
    for (const artifact of receipt.artifacts) {
      const previous = currentByPath.get(artifact.path);
      if (previous && previous.missionId !== receipt.missionId && !handoffAuthorizes(artifactHandoffs, artifact.path, previous.missionId, receipt.missionId, previous.receiptId, previous.sha256)) {
        throw new Error(`Execution receipt ledger assigns artifact path ${artifact.path} to mission ${receipt.missionId} without an explicit artifact handoff from mission ${previous.missionId}.`);
      }
      const entry = {
        path: artifact.path,
        kind: artifact.kind,
        sha256: artifact.sha256,
        missionId: receipt.missionId,
        contractDigest: receipt.contractDigest,
        receiptId: receipt.receiptId,
        ledgerSequence: receipt.ledgerSequence,
        recordedAt: receipt.recordedAt,
        producer: receipt.producer,
        derivedReferences: artifact.derivedReferences
      };
      artifactHistory.push(entry);
      currentByPath.set(artifact.path, entry);
    }
  }
  const current = [...currentByPath.values()].sort((left, right) => left.path.localeCompare(right.path));
  const updatedAt = receipts.at(-1)?.recordedAt ?? null;
  return {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: manifest.workspaceId,
    receipts,
    artifactHistory,
    currentOwnership: current.map(({ derivedReferences: _derivedReferences, ledgerSequence: _ledgerSequence, recordedAt: _recordedAt, producer: _producer, ...item }) => item),
    updatedAt,
    nextLedgerSequence: receipts.length + 1
  };
}
function readExecutionReceiptLedger(root, options = {}) {
  const manifest = options.manifest;
  const missions = options.missions;
  const missionGraph = options.missionGraph;
  const artifactHandoffs = options.artifactHandoffs;
  if (!manifest || !(missions instanceof Map) || !missionGraph || !artifactHandoffs) throw new Error("Execution receipt ledger read requires the validated manifest, mission map, mission graph, and artifact handoffs.");
  const directory = path6.resolve(root, ARTIFACT_PATHS.executionReceiptsDir);
  const receipts = fs5.readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const relativePath = path6.posix.join(ARTIFACT_PATHS.executionReceiptsDir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON file.`);
    return validateStoredReceipt(readJsonStrict(path6.join(directory, entry.name), relativePath), {
      manifest,
      missions,
      label: relativePath,
      filename: entry.name
    });
  }).sort((left, right) => left.ledgerSequence - right.ledgerSequence);
  const receiptIds = /* @__PURE__ */ new Set();
  const researchAttemptIds = /* @__PURE__ */ new Set();
  const ordinaryAttemptIds = /* @__PURE__ */ new Set();
  for (const [index, receipt] of receipts.entries()) {
    const expectedSequence = index + 1;
    if (receipt.ledgerSequence !== expectedSequence) {
      throw new Error(`Execution receipt ledgerSequence must be contiguous from 1; expected ${expectedSequence}, found ${receipt.ledgerSequence} in ${receipt.receiptId}.`);
    }
    if (receiptIds.has(receipt.receiptId)) throw new Error(`Execution receipt ledger contains duplicate receiptId ${receipt.receiptId}.`);
    receiptIds.add(receipt.receiptId);
    if (receipt.researchOutcome) {
      if (researchAttemptIds.has(receipt.researchOutcome.attemptId)) throw new Error(`Execution receipt ledger contains duplicate research attemptId ${receipt.researchOutcome.attemptId}.`);
      researchAttemptIds.add(receipt.researchOutcome.attemptId);
    }
    if (receipt.ordinaryHostOutcome) {
      if (ordinaryAttemptIds.has(receipt.ordinaryHostOutcome.attemptId)) throw new Error(`Execution receipt ledger contains duplicate ordinary attemptId ${receipt.ordinaryHostOutcome.attemptId}.`);
      ordinaryAttemptIds.add(receipt.ordinaryHostOutcome.attemptId);
    }
  }
  return derivedState(manifest, receipts, artifactHandoffs);
}
function deriveArtifactReferences(receipt, explicitByPath = /* @__PURE__ */ new Map()) {
  const criterionReferences = new Map(receipt.artifacts.map((artifact) => [artifact.path, []]));
  for (const criterion of receipt.criteriaSatisfied) {
    for (const reference of criterion.evidenceRefs) {
      if (!reference.startsWith("artifact:")) continue;
      const artifactPath = reference.slice("artifact:".length);
      criterionReferences.get(artifactPath)?.push(`criterion:${criterion.criterionId}`);
    }
  }
  return receipt.artifacts.map((artifact) => ({
    ...artifact,
    derivedReferences: [.../* @__PURE__ */ new Set([...explicitByPath.get(artifact.path) ?? [], ...criterionReferences.get(artifact.path) ?? []])].sort()
  }));
}
function assertReceiptAppendable(ledger, receipt, options = {}) {
  const artifactHandoffs = options.artifactHandoffs;
  if (receipt.ledgerSequence !== ledger.nextLedgerSequence) {
    throw new Error(`Execution receipt ledgerSequence must be ${ledger.nextLedgerSequence}.`);
  }
  if (ledger.receipts.some((item) => item.receiptId === receipt.receiptId)) throw new Error(`Execution receipt id is already occupied: ${receipt.receiptId}.`);
  const currentByPath = new Map(ledger.currentOwnership.map((item) => [item.path, item]));
  const receiptById = new Map(ledger.receipts.map((item) => [item.receiptId, item]));
  for (const artifact of receipt.artifacts) {
    const current = currentByPath.get(artifact.path);
    const currentReceipt = current ? receiptById.get(current.receiptId) : null;
    if (currentReceipt?.producer?.kind === "dove-internal" && currentReceipt.producer.actionId === "archive-review-record") {
      throw new Error(`Artifact path ${artifact.path} is an immutable review archive and cannot be overwritten.`);
    }
    if (current && current.missionId !== receipt.missionId && !handoffAuthorizes(artifactHandoffs, artifact.path, current.missionId, receipt.missionId, current.receiptId, current.sha256)) {
      throw new Error(`Artifact path ${artifact.path} is already owned by mission ${current.missionId}; mission ${receipt.missionId} requires an explicit artifact handoff before overwriting it.`);
    }
  }
}

// src/core/workspace-schema.mjs
import crypto10 from "node:crypto";
import fs6 from "node:fs";
import path10 from "node:path";

// src/core/mission-graph.mjs
import path8 from "node:path";

// src/core/mission-lifecycle.mjs
import crypto6 from "node:crypto";
import path7 from "node:path";
var MISSION_TRANSITION_SCHEMA_VERSION = 1;
var MISSION_TERMINAL_STATUSES = Object.freeze(["completed", "stopped", "failed"]);
var STATUS_SET = new Set(MISSION_TERMINAL_STATUSES);
var TRIGGER_SET = /* @__PURE__ */ new Set(["user", "workspace-revision", "research-decision", "completion-gate"]);
var SAFE_ID5 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH5 = /^[0-9a-f]{64}$/u;
var FIELDS2 = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "transitionId", "transitionDigest", "missionId", "contractDigest", "workspaceRevisionId", "status", "reason", "evidenceRefs", "trigger", "createdAt"]);
function stableValue4(value) {
  if (Array.isArray(value)) return value.map(stableValue4);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue4(item)]));
  return value;
}
function serialize2(value) {
  return JSON.stringify(stableValue4(value));
}
function sha2565(value) {
  return crypto6.createHash("sha256").update(value).digest("hex");
}
function plain3(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function sealed3(value, fields, label) {
  plain3(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
}
function safeId4(value, label) {
  if (typeof value !== "string" || !SAFE_ID5.test(value)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return value;
}
function hash4(value, label) {
  if (typeof value !== "string" || !HASH5.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return value;
}
function text3(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function exactIso4(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value;
}
function strings2(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const result = value.map((item, index) => text3(item, `${label}[${index}]`));
  if (new Set(result).size !== result.length) throw new Error(`${label} must not contain duplicates.`);
  return result;
}
function normalized2(value) {
  const status = text3(value.status, "Mission transition status");
  if (!STATUS_SET.has(status)) throw new Error("Mission transition status is unsupported.");
  const trigger = text3(value.trigger, "Mission transition trigger");
  if (!TRIGGER_SET.has(trigger)) throw new Error("Mission transition trigger is unsupported.");
  return {
    workspaceId: safeId4(value.workspaceId, "Mission transition workspaceId"),
    missionId: safeId4(value.missionId, "Mission transition missionId"),
    contractDigest: hash4(value.contractDigest, "Mission transition contractDigest"),
    workspaceRevisionId: safeId4(value.workspaceRevisionId, "Mission transition workspaceRevisionId"),
    status,
    reason: text3(value.reason, "Mission transition reason"),
    evidenceRefs: strings2(value.evidenceRefs ?? [], "Mission transition evidenceRefs"),
    trigger,
    createdAt: exactIso4(value.createdAt, "Mission transition createdAt")
  };
}
function digest2(value) {
  return sha2565(serialize2({ schemaVersion: MISSION_TRANSITION_SCHEMA_VERSION, ...normalized2(value) }));
}
function transitionId(missionId2, transitionDigest) {
  return `mission-transition-${sha2565(serialize2({ missionId: missionId2, transitionDigest })).slice(0, 24)}`;
}
function createMissionTransition(value) {
  const content = normalized2(value);
  const transitionDigest = digest2(content);
  return { schemaVersion: MISSION_TRANSITION_SCHEMA_VERSION, transitionId: transitionId(content.missionId, transitionDigest), transitionDigest, ...content };
}
function validateMissionTransition(value, options = {}) {
  const label = options.label ?? "Mission transition";
  sealed3(value, FIELDS2, label);
  if (value.schemaVersion !== MISSION_TRANSITION_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  const content = normalized2(value);
  const transitionDigest = digest2(content);
  const expectedId = transitionId(content.missionId, transitionDigest);
  if (value.transitionDigest !== transitionDigest || value.transitionId !== expectedId) throw new Error(`${label} does not match its canonical content.`);
  if (options.workspaceId !== void 0 && content.workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest.`);
  if (options.filename !== void 0 && options.filename !== `${expectedId}.json`) throw new Error(`${label} filename must match transitionId.`);
  const mission = options.missions?.get(content.missionId);
  if (!mission || mission.contractDigest !== content.contractDigest) throw new Error(`${label} does not bind an existing exact mission contract.`);
  return { schemaVersion: MISSION_TRANSITION_SCHEMA_VERSION, transitionId: expectedId, transitionDigest, ...content };
}
function validateMissionTransitions(values, options = {}) {
  const byMission = /* @__PURE__ */ new Map();
  for (const value of values) {
    const transition = validateMissionTransition(value, options);
    if (byMission.has(transition.missionId)) throw new Error(`Mission ${transition.missionId} has more than one terminal transition.`);
    byMission.set(transition.missionId, transition);
  }
  return byMission;
}
function missionTransitionPath(transitionIdValue) {
  return path7.posix.join(ARTIFACT_PATHS.missionTransitionsDir, `${safeId4(transitionIdValue, "Mission transition id")}.json`);
}
function missionLifecycle(workspace, missionId2) {
  return workspace.missionTransitions?.get(missionId2) ?? null;
}
function assertMissionLifecycleAcceptsWrites(workspace, mission, options = {}) {
  const transition = missionLifecycle(workspace, mission.missionId);
  if (!transition) return;
  const suffix = options.receipt === true ? "and no longer accepts execution receipts." : "and is read-only history.";
  throw new Error(`Mission ${mission.missionId} is ${transition.status} ${suffix}`);
}

// src/core/mission-graph.mjs
function missionEntries(value) {
  if (!Array.isArray(value)) throw new Error("Mission graph entries must be an array.");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Mission graph entry ${index} must be an object.`);
    const mission = entry.mission;
    if (!mission || typeof mission !== "object" || Array.isArray(mission)) throw new Error(`Mission graph entry ${index} must contain a mission object.`);
    const missionId2 = mission.missionId;
    if (typeof missionId2 !== "string" || !missionId2) throw new Error(`Mission graph entry ${index} has no missionId.`);
    const filename = typeof entry.filename === "string" ? path8.posix.basename(entry.filename) : "";
    if (filename !== `${missionId2}.json`) throw new Error(`Mission file ${entry.filename ?? "unknown"} filename must match missionId ${missionId2}.`);
    return { filename, mission, missionId: missionId2 };
  });
}
function assertAcyclic(byId, edgeIds, label) {
  const visiting = /* @__PURE__ */ new Set();
  const visited = /* @__PURE__ */ new Set();
  const visit = (missionId2) => {
    if (visited.has(missionId2)) return;
    if (visiting.has(missionId2)) throw new Error(`${label} contains a cycle at ${missionId2}.`);
    visiting.add(missionId2);
    for (const nextId of edgeIds(byId.get(missionId2))) visit(nextId);
    visiting.delete(missionId2);
    visited.add(missionId2);
  };
  for (const missionId2 of byId.keys()) visit(missionId2);
}
function assertMissionAcceptsWrites(workspace, mission, options = {}) {
  assertMissionLifecycleAcceptsWrites(workspace, mission, options);
}
function assertLineageGraph(missionGraph) {
  if (!missionGraph || !(missionGraph.missions instanceof Map) || !(missionGraph.parentByMission instanceof Map)) {
    throw new Error("Mission read authorization requires a validated mission parent graph.");
  }
}
function missionCanReadMission(missionGraph, readerMissionId, ownerMissionId) {
  assertLineageGraph(missionGraph);
  if (!missionGraph.missions.has(readerMissionId)) throw new Error(`Mission read authorization cannot resolve reader mission ${readerMissionId}.`);
  if (!missionGraph.missions.has(ownerMissionId)) throw new Error(`Mission read authorization cannot resolve owner mission ${ownerMissionId}.`);
  let current = readerMissionId;
  let readable = false;
  const seen = /* @__PURE__ */ new Set();
  while (current) {
    if (seen.has(current)) throw new Error(`Mission parent graph contains a cycle at ${current}.`);
    seen.add(current);
    if (current === ownerMissionId) readable = true;
    const mission = missionGraph.missions.get(current);
    if (!mission) throw new Error(`Mission parent graph is missing mission ${current}.`);
    const declaredParent = mission.parentMissionId ?? null;
    const graphParent = missionGraph.parentByMission.get(current) ?? null;
    if (declaredParent !== graphParent) throw new Error(`Mission parent graph is inconsistent at ${current}.`);
    if (graphParent && !missionGraph.missions.has(graphParent)) throw new Error(`Mission parent graph references missing parent ${graphParent}.`);
    current = graphParent;
  }
  return readable;
}
function validateMissionGraph(value) {
  const entries = missionEntries(value);
  const byId = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    if (byId.has(entry.missionId)) throw new Error(`Mission graph contains duplicate missionId ${entry.missionId}.`);
    byId.set(entry.missionId, entry.mission);
  }
  for (const mission of byId.values()) {
    const dependencies = Array.isArray(mission.dependsOnMissionIds) ? mission.dependsOnMissionIds : [];
    for (const dependencyId of dependencies) {
      if (dependencyId === mission.missionId) throw new Error(`Mission ${mission.missionId} must not depend on itself.`);
      if (!byId.has(dependencyId)) throw new Error(`Mission ${mission.missionId} depends on unknown mission ${dependencyId}.`);
    }
    if (mission.parentMissionId !== void 0) {
      if (mission.parentMissionId === mission.missionId) throw new Error(`Mission ${mission.missionId} must not be its own parent.`);
      if (!byId.has(mission.parentMissionId)) throw new Error(`Mission ${mission.missionId} references unknown parent mission ${mission.parentMissionId}.`);
    }
  }
  const dependenciesByMission = new Map([...byId.values()].map((mission) => [mission.missionId, Object.freeze([...mission.dependsOnMissionIds ?? []])]));
  assertAcyclic(byId, (mission) => dependenciesByMission.get(mission.missionId), "Mission dependency graph");
  const parentByMission = /* @__PURE__ */ new Map();
  const childrenByMission = new Map([...byId.keys()].map((missionId2) => [missionId2, []]));
  for (const mission of byId.values()) {
    if (!mission.parentMissionId) continue;
    parentByMission.set(mission.missionId, mission.parentMissionId);
    childrenByMission.get(mission.parentMissionId).push(mission.missionId);
  }
  assertAcyclic(byId, (mission) => mission.parentMissionId ? [mission.parentMissionId] : [], "Mission parent graph");
  for (const [missionId2, children] of childrenByMission) childrenByMission.set(missionId2, Object.freeze(children.sort()));
  const rootMissionIds = Object.freeze([...byId.values()].filter((mission) => !mission.parentMissionId).map((mission) => mission.missionId).sort());
  return { missions: byId, dependenciesByMission, parentByMission, childrenByMission, rootMissionIds };
}

// src/core/research-decisions.mjs
import crypto7 from "node:crypto";
var RESEARCH_DECISION_SCHEMA_VERSION = 5;
var RESEARCH_DECISION_DISPOSITIONS = Object.freeze(["continue", "stop-satisfied", "stop-low-return", "stop-budget", "reject", "block-needs-user"]);
var RESEARCH_DECISION_ACTION_KINDS = Object.freeze(["retrieval", "experiment", "analysis", "engineering"]);
var RESEARCH_HYPOTHESIS_ASSESSMENTS = Object.freeze(["unresolved", "supported", "weakened", "falsified"]);
var RESEARCH_ROUTE_DISPOSITIONS = Object.freeze(["considered", "selected", "rejected"]);
var RESEARCH_DECISION_CONTENT_FIELDS = Object.freeze(["synthesis", "hypotheses", "routes", "openQuestions", "evidenceRefs", "consumedReceiptIds", "disposition", "reasonCodes", "nextAction"]);
var PERSISTED_RESEARCH_DECISION_FIELDS = Object.freeze(["schemaVersion", "decisionId", "decisionDigest", "missionId", "contractDigest", "revision", "predecessorDecisionId", "predecessorDecisionDigest", "createdAt", ...RESEARCH_DECISION_CONTENT_FIELDS]);
var SAFE_ID6 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH6 = /^[0-9a-f]{64}$/u;
var ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
var DISPOSITION_SET = new Set(RESEARCH_DECISION_DISPOSITIONS);
var ACTION_KIND_SET = new Set(RESEARCH_DECISION_ACTION_KINDS);
var ASSESSMENT_SET = new Set(RESEARCH_HYPOTHESIS_ASSESSMENTS);
var ROUTE_DISPOSITION_SET = new Set(RESEARCH_ROUTE_DISPOSITIONS);
var CONTENT_FIELDS = new Set(RESEARCH_DECISION_CONTENT_FIELDS);
var PERSISTED_FIELDS = new Set(PERSISTED_RESEARCH_DECISION_FIELDS);
var CREATE_FIELDS = /* @__PURE__ */ new Set(["missionId", "contractDigest", "revision", "predecessorDecisionId", "predecessorDecisionDigest", "createdAt", "content"]);
var APPEND_FIELDS = /* @__PURE__ */ new Set(["missionId", "contractDigest", "predecessorDecisionId", "predecessorDecisionDigest", "createdAt", "content"]);
var HYPOTHESIS_FIELDS = /* @__PURE__ */ new Set(["hypothesisId", "statement", "assessment", "supportingEvidence", "counterEvidence", "falsificationCondition"]);
var ROUTE_FIELDS = /* @__PURE__ */ new Set(["routeId", "summary", "disposition", "rationale"]);
var QUESTION_FIELDS = /* @__PURE__ */ new Set(["questionId", "question"]);
var ACTION_FIELDS = /* @__PURE__ */ new Set(["actionId", "actionDigest", "kind", "description", "rationale", "targetHypothesisOrQuestionIds", "successConditions", "stopConditions", "expectedEvidence", "budget"]);
function sha2566(value) {
  return crypto7.createHash("sha256").update(value).digest("hex");
}
function stableValue5(value) {
  if (Array.isArray(value)) return value.map(stableValue5);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue5(item)]));
  return value;
}
function stableResearchDecisionSerialize(value) {
  return JSON.stringify(stableValue5(value));
}
function plain4(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function sealed4(value, fields, label) {
  plain4(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function exact(value, fields, label) {
  sealed4(value, fields, label);
  const missing = [...fields].filter((field) => !Object.hasOwn(value, field));
  if (missing.length) throw new Error(`${label} requires fields: ${missing.join(", ")}.`);
}
function text4(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function safeId5(value, label) {
  const normalized3 = text4(value, label);
  if (!SAFE_ID6.test(normalized3)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized3;
}
function hash5(value, label) {
  const normalized3 = text4(value, label);
  if (!HASH6.test(normalized3)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return normalized3;
}
function exactIso5(value, label) {
  if (typeof value !== "string" || !ISO.test(value) || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value;
}
function array(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}
function strings3(value, label, minItems = 0) {
  const result = array(value, label).map((item, index) => text4(item, `${label}[${index}]`));
  if (result.length < minItems) throw new Error(`${label} must contain at least ${minItems} item(s).`);
  if (new Set(result).size !== result.length) throw new Error(`${label} must not contain duplicates.`);
  return result;
}
function ids(value, label) {
  return strings3(value, label).map((item, index) => safeId5(item, `${label}[${index}]`));
}
function enumValue(value, allowed2, label) {
  const normalized3 = text4(value, label);
  if (!allowed2.has(normalized3)) throw new Error(`${label} is unsupported.`);
  return normalized3;
}
function unique(items, field, label) {
  if (new Set(items.map((item) => item[field])).size !== items.length) throw new Error(`${label} identifiers must be unique.`);
}
function budget(value, label) {
  plain4(value, label);
  const result = {};
  for (const [dimension, amount] of Object.entries(value)) {
    if (!/^[a-z][A-Za-z0-9._-]{0,63}$/u.test(dimension)) throw new Error(`${label} has an invalid budget dimension ${dimension}.`);
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`${label}.${dimension} must be a non-negative safe integer.`);
    result[dimension] = amount;
  }
  if (Object.keys(result).length === 0) throw new Error(`${label} must declare at least one dimension.`);
  return result;
}
function normalizeHypothesis(value, index) {
  const label = `hypotheses[${index}]`;
  exact(value, HYPOTHESIS_FIELDS, label);
  return { hypothesisId: safeId5(value.hypothesisId, `${label}.hypothesisId`), statement: text4(value.statement, `${label}.statement`), assessment: enumValue(value.assessment, ASSESSMENT_SET, `${label}.assessment`), supportingEvidence: strings3(value.supportingEvidence, `${label}.supportingEvidence`), counterEvidence: strings3(value.counterEvidence, `${label}.counterEvidence`), falsificationCondition: text4(value.falsificationCondition, `${label}.falsificationCondition`) };
}
function normalizeRoute(value, index) {
  const label = `routes[${index}]`;
  exact(value, ROUTE_FIELDS, label);
  return { routeId: safeId5(value.routeId, `${label}.routeId`), summary: text4(value.summary, `${label}.summary`), disposition: enumValue(value.disposition, ROUTE_DISPOSITION_SET, `${label}.disposition`), rationale: text4(value.rationale, `${label}.rationale`) };
}
function normalizeQuestion(value, index) {
  const label = `openQuestions[${index}]`;
  exact(value, QUESTION_FIELDS, label);
  return { questionId: safeId5(value.questionId, `${label}.questionId`), question: text4(value.question, `${label}.question`) };
}
function actionDigest(value) {
  const { actionDigest: _actionDigest, ...content } = value;
  return sha2566(stableResearchDecisionSerialize(content));
}
function normalizeResearchDecisionAction(value, options = {}) {
  const label = options.label ?? "Research decision action";
  exact(value, ACTION_FIELDS, label);
  const action = { actionId: safeId5(value.actionId, `${label}.actionId`), kind: enumValue(value.kind, ACTION_KIND_SET, `${label}.kind`), description: text4(value.description, `${label}.description`), rationale: text4(value.rationale, `${label}.rationale`), targetHypothesisOrQuestionIds: ids(value.targetHypothesisOrQuestionIds, `${label}.targetHypothesisOrQuestionIds`), successConditions: strings3(value.successConditions, `${label}.successConditions`, 1), stopConditions: strings3(value.stopConditions, `${label}.stopConditions`, 1), expectedEvidence: strings3(value.expectedEvidence, `${label}.expectedEvidence`, 1), budget: budget(value.budget, `${label}.budget`) };
  const suppliedDigest = hash5(value.actionDigest, `${label}.actionDigest`);
  const computedDigest = actionDigest(action);
  if (suppliedDigest !== computedDigest) throw new Error(`${label}.actionDigest does not match its canonical content.`);
  return { ...action, actionDigest: computedDigest };
}
function createResearchDecisionAction(value) {
  const content = { ...value };
  delete content.actionDigest;
  const digest3 = actionDigest(content);
  return normalizeResearchDecisionAction({ ...content, actionDigest: digest3 });
}
function normalizeResearchDecisionContent(value = {}) {
  exact(value, CONTENT_FIELDS, "Research decision content");
  const hypotheses = array(value.hypotheses, "hypotheses").map(normalizeHypothesis);
  const routes = array(value.routes, "routes").map(normalizeRoute);
  const openQuestions = array(value.openQuestions, "openQuestions").map(normalizeQuestion);
  unique(hypotheses, "hypothesisId", "Hypothesis");
  unique(routes, "routeId", "Route");
  unique(openQuestions, "questionId", "Open question");
  const evidenceRefs2 = strings3(value.evidenceRefs, "evidenceRefs");
  const consumedReceiptIds = ids(value.consumedReceiptIds, "consumedReceiptIds");
  const disposition = enumValue(value.disposition, DISPOSITION_SET, "disposition");
  const reasonCodes = ids(value.reasonCodes, "reasonCodes");
  const nextAction = value.nextAction === null ? null : normalizeResearchDecisionAction(value.nextAction, { label: "nextAction" });
  const targetIds = /* @__PURE__ */ new Set([...hypotheses.map((item) => item.hypothesisId), ...openQuestions.map((item) => item.questionId)]);
  if (nextAction && nextAction.targetHypothesisOrQuestionIds.length === 0) throw new Error("nextAction must target at least one open question or hypothesis.");
  if (nextAction?.targetHypothesisOrQuestionIds.some((id3) => !targetIds.has(id3))) throw new Error("nextAction targets an unknown hypothesis or open question.");
  if (disposition === "continue" && nextAction === null) throw new Error("A continue decision requires one nextAction.");
  if (disposition !== "continue" && nextAction !== null) throw new Error(`Decision disposition ${disposition} must not retain nextAction.`);
  if (disposition !== "continue" && reasonCodes.length === 0) throw new Error(`Decision disposition ${disposition} requires reasonCodes.`);
  if (routes.filter((route) => route.disposition === "selected").length > 1) throw new Error("Research decision may select at most one route.");
  const changedHypotheses = hypotheses.filter((hypothesis) => hypothesis.assessment !== "unresolved");
  for (const hypothesis of changedHypotheses) {
    const refs = [...hypothesis.supportingEvidence, ...hypothesis.counterEvidence];
    if (refs.length === 0 || refs.some((reference) => !evidenceRefs2.includes(reference))) throw new Error(`Hypothesis ${hypothesis.hypothesisId} assessment requires current decision evidenceRefs.`);
  }
  if (disposition === "stop-satisfied" && (evidenceRefs2.length === 0 || consumedReceiptIds.length === 0)) throw new Error("stop-satisfied requires current evidence and consumed receipts.");
  return { synthesis: text4(value.synthesis, "synthesis"), hypotheses, routes, openQuestions, evidenceRefs: evidenceRefs2, consumedReceiptIds, disposition, reasonCodes, nextAction };
}
function envelope(value, label) {
  const missionId2 = safeId5(value.missionId, `${label}.missionId`);
  const contractDigest = hash5(value.contractDigest, `${label}.contractDigest`);
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error(`${label}.revision must be a positive safe integer.`);
  const predecessorDecisionId = value.predecessorDecisionId === null ? null : safeId5(value.predecessorDecisionId, `${label}.predecessorDecisionId`);
  const predecessorDecisionDigest = value.predecessorDecisionDigest === null ? null : hash5(value.predecessorDecisionDigest, `${label}.predecessorDecisionDigest`);
  if (value.revision === 1 !== (predecessorDecisionId === null && predecessorDecisionDigest === null)) throw new Error(`${label} predecessor binding does not match revision.`);
  return { missionId: missionId2, contractDigest, revision: value.revision, predecessorDecisionId, predecessorDecisionDigest, createdAt: exactIso5(value.createdAt, `${label}.createdAt`), content: normalizeResearchDecisionContent(value.content ?? Object.fromEntries(RESEARCH_DECISION_CONTENT_FIELDS.map((field) => [field, value[field]]))) };
}
function researchDecisionDigest(value) {
  const normalized3 = envelope(value, "Research decision digest input");
  return sha2566(stableResearchDecisionSerialize({ schemaVersion: RESEARCH_DECISION_SCHEMA_VERSION, missionId: normalized3.missionId, contractDigest: normalized3.contractDigest, revision: normalized3.revision, predecessorDecisionId: normalized3.predecessorDecisionId, predecessorDecisionDigest: normalized3.predecessorDecisionDigest, createdAt: normalized3.createdAt, ...normalized3.content }));
}
function researchDecisionId(missionId2, revision, decisionDigest) {
  return `research-decision-${sha2566(stableResearchDecisionSerialize({ missionId: safeId5(missionId2, "missionId"), revision, decisionDigest: hash5(decisionDigest, "decisionDigest") })).slice(0, 24)}`;
}
function createResearchDecision(args = {}) {
  exact(args, CREATE_FIELDS, "createResearchDecision");
  const normalized3 = envelope(args, "Research decision");
  const decisionDigest = researchDecisionDigest({ ...normalized3, content: normalized3.content });
  return { schemaVersion: RESEARCH_DECISION_SCHEMA_VERSION, decisionId: researchDecisionId(normalized3.missionId, normalized3.revision, decisionDigest), decisionDigest, missionId: normalized3.missionId, contractDigest: normalized3.contractDigest, revision: normalized3.revision, predecessorDecisionId: normalized3.predecessorDecisionId, predecessorDecisionDigest: normalized3.predecessorDecisionDigest, createdAt: normalized3.createdAt, ...normalized3.content };
}
function validatePersistedResearchDecision(value, options = {}) {
  exact(value, PERSISTED_FIELDS, options.label ?? "Research decision");
  if (value.schemaVersion !== RESEARCH_DECISION_SCHEMA_VERSION) throw new Error(`${options.label ?? "Research decision"} has an unsupported schemaVersion.`);
  const normalized3 = envelope(value, options.label ?? "Research decision");
  const computedDigest = researchDecisionDigest({ ...normalized3, content: normalized3.content });
  if (value.decisionDigest !== computedDigest || value.decisionId !== researchDecisionId(normalized3.missionId, normalized3.revision, computedDigest)) throw new Error(`${options.label ?? "Research decision"} does not match its canonical content.`);
  for (const field of ["missionId", "contractDigest"]) if (options[field] !== void 0 && normalized3[field] !== options[field]) throw new Error(`${options.label ?? "Research decision"}.${field} does not match the expected binding.`);
  return { schemaVersion: RESEARCH_DECISION_SCHEMA_VERSION, decisionId: value.decisionId, decisionDigest: computedDigest, missionId: normalized3.missionId, contractDigest: normalized3.contractDigest, revision: normalized3.revision, predecessorDecisionId: normalized3.predecessorDecisionId, predecessorDecisionDigest: normalized3.predecessorDecisionDigest, createdAt: normalized3.createdAt, ...normalized3.content };
}
function validateResearchDecisionChain(decisions, options = {}) {
  const normalized3 = array(decisions, "Research decision chain").map((decision, index) => validatePersistedResearchDecision(decision, { label: `${options.label ?? "Research decision chain"}[${index}]`, missionId: options.missionId, contractDigest: options.contractDigest }));
  if (normalized3.length === 0) return [];
  unique(normalized3, "decisionId", "Research decision");
  unique(normalized3, "revision", "Research decision revision");
  const byId = new Map(normalized3.map((item) => [item.decisionId, item]));
  const successors = /* @__PURE__ */ new Set();
  for (const item of normalized3) {
    if (item.revision === 1) continue;
    const predecessor = byId.get(item.predecessorDecisionId);
    if (!predecessor || predecessor.decisionDigest !== item.predecessorDecisionDigest || item.revision !== predecessor.revision + 1) throw new Error("Research decision chain has an invalid predecessor binding.");
    if (successors.has(predecessor.decisionId)) throw new Error("Research decision chain must not fork.");
    successors.add(predecessor.decisionId);
  }
  const sorted = [...normalized3].sort((a, b) => a.revision - b.revision);
  if (sorted[0].revision !== 1 || sorted.at(-1).revision !== sorted.length) throw new Error("Research decision revisions must be contiguous from 1.");
  return sorted;
}
function appendResearchDecision(decisions, args = {}) {
  exact(args, APPEND_FIELDS, "appendResearchDecision");
  const chain = validateResearchDecisionChain(decisions, { missionId: args.missionId, contractDigest: args.contractDigest });
  const head = chain.at(-1) ?? null;
  if ((args.predecessorDecisionId ?? null) !== (head?.decisionId ?? null) || (args.predecessorDecisionDigest ?? null) !== (head?.decisionDigest ?? null)) throw new Error("Research decision append rejected a stale predecessor.");
  const decision = createResearchDecision({ missionId: args.missionId, contractDigest: args.contractDigest, revision: (head?.revision ?? 0) + 1, predecessorDecisionId: head?.decisionId ?? null, predecessorDecisionDigest: head?.decisionDigest ?? null, createdAt: args.createdAt, content: args.content });
  return validateResearchDecisionChain([...chain, decision]);
}
function researchDecisionNarrativeDirective(value) {
  const decision = validatePersistedResearchDecision(value);
  if (decision.nextAction) return Object.freeze({ mode: "authorized-action" });
  if (decision.disposition === "stop-satisfied") return Object.freeze({ mode: "stop-reason", text: decision.synthesis });
  return Object.freeze({ mode: "next-step", text: decision.disposition === "block-needs-user" ? "Resolve the recorded user decision before continuing." : "Reevaluate the current evidence before authorizing another action." });
}

// src/core/evidence-contracts.mjs
import crypto8 from "node:crypto";
var EXPERIMENT_RECORD_SCHEMA_VERSION = 3;
var CLAIM_RECORD_SCHEMA_VERSION = 3;
var CLAIM_ASSESSMENTS = Object.freeze(["supported", "weakened", "refuted", "inconclusive", "blocked"]);
var EXPERIMENT_RESULT_STATUSES = Object.freeze(["completed", "stopped", "failed", "blocked"]);
var SAFE_ID7 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
}
function evidenceDigest(value) {
  return crypto8.createHash("sha256").update(`${JSON.stringify(stable(value))}
`).digest("hex");
}
function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  return value;
}
function sealed5(value, fields, label) {
  object(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  return value;
}
function text5(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function id2(value, label) {
  const normalized3 = text5(value, label);
  if (!SAFE_ID7.test(normalized3)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized3;
}
function timestamp(value, label) {
  const normalized3 = text5(value, label);
  if (!Number.isFinite(Date.parse(normalized3)) || new Date(Date.parse(normalized3)).toISOString() !== normalized3) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return normalized3;
}
function strings4(value, label, min = 0) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${label} must be an array of non-empty strings.`);
  const normalized3 = value.map((item) => item.trim());
  if (new Set(normalized3).size !== normalized3.length) throw new Error(`${label} must not contain duplicates.`);
  if (normalized3.length < min) throw new Error(`${label} must contain at least ${min} item(s).`);
  return normalized3;
}
function enumeration(value, values, label) {
  const normalized3 = text5(value, label);
  if (!values.includes(normalized3)) throw new Error(`${label} is unsupported.`);
  return normalized3;
}
function number(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}
var PROTOCOL_FIELDS = /* @__PURE__ */ new Set([
  "question",
  "hypothesis",
  "procedure",
  "inputs",
  "comparisons",
  "metrics",
  "successConditions",
  "stopConditions",
  "constraints",
  "expectedArtifacts",
  "frozenAt"
]);
function normalizeExperimentProtocol(value, label = "protocol") {
  sealed5(value, PROTOCOL_FIELDS, label);
  return {
    question: text5(value.question, `${label}.question`),
    hypothesis: text5(value.hypothesis, `${label}.hypothesis`),
    procedure: strings4(value.procedure, `${label}.procedure`, 1),
    inputs: strings4(value.inputs, `${label}.inputs`, 1),
    comparisons: strings4(value.comparisons, `${label}.comparisons`),
    metrics: strings4(value.metrics, `${label}.metrics`, 1),
    successConditions: strings4(value.successConditions, `${label}.successConditions`, 1),
    stopConditions: strings4(value.stopConditions, `${label}.stopConditions`, 1),
    constraints: strings4(value.constraints, `${label}.constraints`),
    expectedArtifacts: strings4(value.expectedArtifacts, `${label}.expectedArtifacts`, 1),
    frozenAt: timestamp(value.frozenAt, `${label}.frozenAt`)
  };
}
var DENOMINATOR_FIELDS = /* @__PURE__ */ new Set(["total", "successful", "failed", "excluded"]);
var FAILURE_FIELDS = /* @__PURE__ */ new Set(["failureId", "count", "reason", "evidenceRefs"]);
var MEASUREMENT_FIELDS = /* @__PURE__ */ new Set(["metric", "value", "comparison"]);
var RESULT_FIELDS = /* @__PURE__ */ new Set([
  "status",
  "outcome",
  "measurements",
  "artifactRefs",
  "validationRefs",
  "denominator",
  "failures",
  "deviations",
  "limitations",
  "recordedAt"
]);
function normalizeExperimentResult(value, label = "result") {
  sealed5(value, RESULT_FIELDS, label);
  sealed5(value.denominator, DENOMINATOR_FIELDS, `${label}.denominator`);
  const denominator = Object.fromEntries([...DENOMINATOR_FIELDS].map((field) => [field, number(value.denominator[field], `${label}.denominator.${field}`)]));
  if (![...DENOMINATOR_FIELDS].every((field) => Number.isSafeInteger(denominator[field]) && denominator[field] >= 0)) throw new Error(`${label}.denominator counts must be non-negative safe integers.`);
  if (denominator.successful + denominator.failed + denominator.excluded !== denominator.total) throw new Error(`${label}.denominator must account for the full total.`);
  if (!Array.isArray(value.failures)) throw new Error(`${label}.failures must be an array.`);
  const failures = value.failures.map((item, index) => {
    const itemLabel = `${label}.failures[${index}]`;
    sealed5(item, FAILURE_FIELDS, itemLabel);
    const count = number(item.count, `${itemLabel}.count`);
    if (!Number.isSafeInteger(count) || count < 1) throw new Error(`${itemLabel}.count must be a positive safe integer.`);
    return { failureId: id2(item.failureId, `${itemLabel}.failureId`), count, reason: text5(item.reason, `${itemLabel}.reason`), evidenceRefs: strings4(item.evidenceRefs, `${itemLabel}.evidenceRefs`) };
  });
  if (failures.reduce((sum, item) => sum + item.count, 0) !== denominator.failed + denominator.excluded) throw new Error(`${label}.failures must preserve every failed and excluded item.`);
  if (!Array.isArray(value.measurements)) throw new Error(`${label}.measurements must be an array.`);
  const measurements = value.measurements.map((item, index) => {
    const itemLabel = `${label}.measurements[${index}]`;
    sealed5(item, MEASUREMENT_FIELDS, itemLabel);
    return { metric: text5(item.metric, `${itemLabel}.metric`), value: number(item.value, `${itemLabel}.value`), comparison: item.comparison === null ? null : text5(item.comparison, `${itemLabel}.comparison`) };
  });
  const keys = measurements.map((item) => `${item.metric}::${item.comparison ?? ""}`);
  if (new Set(keys).size !== keys.length) throw new Error(`${label}.measurements must not duplicate a metric/comparison binding.`);
  const status = enumeration(value.status, EXPERIMENT_RESULT_STATUSES, `${label}.status`);
  const artifactRefs = strings4(value.artifactRefs, `${label}.artifactRefs`);
  const validationRefs = strings4(value.validationRefs, `${label}.validationRefs`);
  if (denominator.successful > 0 && artifactRefs.length + validationRefs.length === 0) throw new Error(`${label} requires artifactRefs or validationRefs for successful observations.`);
  return {
    status,
    outcome: text5(value.outcome, `${label}.outcome`),
    measurements,
    artifactRefs,
    validationRefs,
    denominator,
    failures,
    deviations: strings4(value.deviations, `${label}.deviations`),
    limitations: strings4(value.limitations, `${label}.limitations`, 1),
    recordedAt: timestamp(value.recordedAt, `${label}.recordedAt`)
  };
}
var EXPERIMENT_EVIDENCE_FIELDS = /* @__PURE__ */ new Set(["experimentId", "metric", "value", "comparison"]);
var CLAIM_FIELDS = /* @__PURE__ */ new Set(["experimentEvidence", "uncertainty", "unsupportedExtensions", "currentAssessment"]);
function normalizeClaimContract(value, label = "claim") {
  sealed5(value, CLAIM_FIELDS, label);
  if (!Array.isArray(value.experimentEvidence)) throw new Error(`${label}.experimentEvidence must be an array.`);
  const experimentEvidence = value.experimentEvidence.map((item, index) => {
    const itemLabel = `${label}.experimentEvidence[${index}]`;
    sealed5(item, EXPERIMENT_EVIDENCE_FIELDS, itemLabel);
    return { experimentId: id2(item.experimentId, `${itemLabel}.experimentId`), metric: text5(item.metric, `${itemLabel}.metric`), value: number(item.value, `${itemLabel}.value`), comparison: item.comparison === null ? null : text5(item.comparison, `${itemLabel}.comparison`) };
  });
  const keys = experimentEvidence.map((item) => `${item.experimentId}::${item.metric}::${item.comparison ?? ""}`);
  if (new Set(keys).size !== keys.length) throw new Error(`${label}.experimentEvidence must not duplicate an experiment measurement binding.`);
  const uncertainty = strings4(value.uncertainty, `${label}.uncertainty`);
  const unsupportedExtensions = strings4(value.unsupportedExtensions, `${label}.unsupportedExtensions`);
  const currentAssessment = enumeration(value.currentAssessment, CLAIM_ASSESSMENTS, `${label}.currentAssessment`);
  return { experimentEvidence, uncertainty, unsupportedExtensions, currentAssessment };
}

// src/core/workspace-revisions.mjs
import crypto9 from "node:crypto";
import path9 from "node:path";
var WORKSPACE_REVISION_SCHEMA_VERSION = 2;
var SAFE_ID8 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH7 = /^[0-9a-f]{64}$/u;
var ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
var FIELDS3 = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "revisionId",
  "revisionDigest",
  "revision",
  "previousRevisionId",
  "previousRevisionDigest",
  "mainline",
  "changeReason",
  "createdAt"
]);
var SCHEMA_1_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "revisionId",
  "revisionDigest",
  "revision",
  "previousRevisionId",
  "previousRevisionDigest",
  "projectGoal",
  "researchMainline",
  "changeReason",
  "createdAt"
]);
function stableValue6(value) {
  if (Array.isArray(value)) return value.map(stableValue6);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue6(item)]));
  }
  return value;
}
function stableWorkspaceRevisionSerialize(value) {
  return JSON.stringify(stableValue6(value));
}
function sha2567(value) {
  return crypto9.createHash("sha256").update(value).digest("hex");
}
function assertPlainObject2(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function assertSealed2(value, fields, label) {
  assertPlainObject2(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function safeId6(value, label) {
  if (typeof value !== "string" || !SAFE_ID8.test(value)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return value;
}
function hash6(value, label) {
  if (typeof value !== "string" || !HASH7.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return value;
}
function text6(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function exactIso6(value, label) {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value;
}
function normalizedContent(value) {
  const workspaceId = safeId6(value.workspaceId, "Workspace revision workspaceId");
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error("Workspace revision number must be a positive safe integer.");
  const previousRevisionId = value.previousRevisionId === null ? null : safeId6(value.previousRevisionId, "Workspace revision previousRevisionId");
  const previousRevisionDigest = value.previousRevisionDigest === null ? null : hash6(value.previousRevisionDigest, "Workspace revision previousRevisionDigest");
  if (value.revision === 1 && (previousRevisionId !== null || previousRevisionDigest !== null)) throw new Error("Workspace revision 1 requires null predecessor fields.");
  if (value.revision > 1 && (previousRevisionId === null || previousRevisionDigest === null)) throw new Error(`Workspace revision ${value.revision} requires predecessor fields.`);
  return {
    workspaceId,
    revision: value.revision,
    previousRevisionId,
    previousRevisionDigest,
    mainline: text6(value.mainline, "Workspace revision mainline"),
    changeReason: text6(value.changeReason, "Workspace revision changeReason"),
    createdAt: exactIso6(value.createdAt, "Workspace revision createdAt")
  };
}
function workspaceRevisionDigest(value) {
  const content = normalizedContent(value);
  return sha2567(stableWorkspaceRevisionSerialize({ schemaVersion: WORKSPACE_REVISION_SCHEMA_VERSION, ...content }));
}
function workspaceRevisionId(workspaceId, revision, digest3) {
  safeId6(workspaceId, "Workspace revision workspaceId");
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Workspace revision number must be positive.");
  hash6(digest3, "Workspace revision digest");
  return `workspace-revision-${revision}-${sha2567(stableWorkspaceRevisionSerialize({ workspaceId, revision, digest: digest3 })).slice(0, 20)}`;
}
function createWorkspaceRevision(value) {
  const content = normalizedContent(value);
  const revisionDigest = workspaceRevisionDigest(content);
  const revisionId = workspaceRevisionId(content.workspaceId, content.revision, revisionDigest);
  return { schemaVersion: WORKSPACE_REVISION_SCHEMA_VERSION, revisionId, revisionDigest, ...content };
}
function validateWorkspaceRevision(value, options = {}) {
  const label = options.label ?? "Workspace revision";
  assertSealed2(value, FIELDS3, label);
  if (value.schemaVersion !== WORKSPACE_REVISION_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  const content = normalizedContent(value);
  const revisionDigest = workspaceRevisionDigest(content);
  const revisionId = workspaceRevisionId(content.workspaceId, content.revision, revisionDigest);
  if (value.revisionDigest !== revisionDigest) throw new Error(`${label}.revisionDigest does not match its canonical content.`);
  if (value.revisionId !== revisionId) throw new Error(`${label}.revisionId does not match its canonical content.`);
  if (options.workspaceId !== void 0 && content.workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  if (options.filename !== void 0 && options.filename !== `${revisionId}.json`) throw new Error(`${label} filename must match revisionId ${revisionId}.`);
  return { schemaVersion: WORKSPACE_REVISION_SCHEMA_VERSION, revisionId, revisionDigest, ...content };
}
function validateSchema12WorkspaceRevision(value, options = {}) {
  const label = options.label ?? "Schema 12 workspace revision";
  assertSealed2(value, SCHEMA_1_FIELDS, label);
  if (value.schemaVersion !== 1) throw new Error(`${label} has an unsupported schemaVersion.`);
  const workspaceId = safeId6(value.workspaceId, `${label}.workspaceId`);
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error(`${label}.revision must be a positive safe integer.`);
  const previousRevisionId = value.previousRevisionId === null ? null : safeId6(value.previousRevisionId, `${label}.previousRevisionId`);
  const previousRevisionDigest = value.previousRevisionDigest === null ? null : hash6(value.previousRevisionDigest, `${label}.previousRevisionDigest`);
  if (value.revision === 1 && (previousRevisionId !== null || previousRevisionDigest !== null)) throw new Error(`${label} revision 1 requires null predecessor fields.`);
  if (value.revision > 1 && (previousRevisionId === null || previousRevisionDigest === null)) throw new Error(`${label} revision ${value.revision} requires predecessor fields.`);
  const content = {
    workspaceId,
    revision: value.revision,
    previousRevisionId,
    previousRevisionDigest,
    projectGoal: text6(value.projectGoal, `${label}.projectGoal`),
    researchMainline: text6(value.researchMainline, `${label}.researchMainline`),
    changeReason: text6(value.changeReason, `${label}.changeReason`),
    createdAt: exactIso6(value.createdAt, `${label}.createdAt`)
  };
  const revisionDigest = sha2567(stableWorkspaceRevisionSerialize({ schemaVersion: 1, ...content }));
  const revisionId = workspaceRevisionId(workspaceId, value.revision, revisionDigest);
  if (value.revisionDigest !== revisionDigest || value.revisionId !== revisionId) throw new Error(`${label} does not match its canonical schema 12 content.`);
  if (options.workspaceId !== void 0 && workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  if (options.filename !== void 0 && options.filename !== `${revisionId}.json`) throw new Error(`${label} filename must match revisionId ${revisionId}.`);
  return { schemaVersion: 1, revisionId, revisionDigest, ...content };
}
function validateWorkspaceRevisionChain(values, project, options = {}) {
  if (!Array.isArray(values) || values.length === 0) throw new Error("Workspace revisions must contain at least one revision.");
  const validateRevision = options.schemaVersion === 1 ? validateSchema12WorkspaceRevision : validateWorkspaceRevision;
  const revisions = values.map((value) => validateRevision(value, { workspaceId: project.workspaceId }));
  const byId = /* @__PURE__ */ new Map();
  const byNumber = /* @__PURE__ */ new Map();
  for (const revision of revisions) {
    if (byId.has(revision.revisionId) || byNumber.has(revision.revision)) throw new Error("Workspace revision chain contains duplicate identity or revision number.");
    byId.set(revision.revisionId, revision);
    byNumber.set(revision.revision, revision);
  }
  for (const revision of revisions) {
    if (revision.revision === 1) continue;
    const previous = byNumber.get(revision.revision - 1);
    if (!previous || revision.previousRevisionId !== previous.revisionId || revision.previousRevisionDigest !== previous.revisionDigest) {
      throw new Error(`Workspace revision ${revision.revision} does not directly follow revision ${revision.revision - 1}.`);
    }
    if (Date.parse(revision.createdAt) < Date.parse(previous.createdAt)) throw new Error(`Workspace revision ${revision.revision} createdAt precedes its predecessor.`);
  }
  const ordered = [...revisions].sort((left, right) => left.revision - right.revision);
  if (ordered[0].revision !== 1 || ordered.at(-1).revision !== ordered.length) throw new Error("Workspace revisions must form one contiguous append-only chain from revision 1.");
  const current = byId.get(project.currentRevisionId);
  if (!current || current.revisionDigest !== project.currentRevisionDigest || current.revision !== ordered.length) {
    throw new Error("Dove project current revision pointer does not identify the unique workspace revision head.");
  }
  return { revisions: ordered, byId, current };
}
function workspaceRevisionPath(revisionId) {
  safeId6(revisionId, "Workspace revision id");
  return path9.posix.join(ARTIFACT_PATHS.workspaceRevisionsDir, `${revisionId}.json`);
}

// src/core/workspace-schema.mjs
var DOVE_MANIFEST_SCHEMA_VERSION = 1;
var DOVE_PROJECT_SCHEMA_VERSION = 3;
var DOVE_LESSONS_SECTIONS = Object.freeze([
  Object.freeze({ id: "research-direction-methods", heading: "\u7814\u7A76\u65B9\u5411\u4E0E\u65B9\u6CD5" }),
  Object.freeze({ id: "evidence-experiments", heading: "\u8BC1\u636E\u4E0E\u5B9E\u9A8C" }),
  Object.freeze({ id: "engineering-reproducibility", heading: "\u5DE5\u7A0B\u4E0E\u53EF\u590D\u73B0\u6027" }),
  Object.freeze({ id: "writing-figures-review-rebuttal", heading: "\u5199\u4F5C\u3001\u56FE\u8868\u3001\u8BC4\u5BA1\u4E0E\u7B54\u8FA9" }),
  Object.freeze({ id: "collaboration-work-practices", heading: "\u534F\u4F5C\u4E0E\u5DE5\u4F5C\u5B9E\u8DF5" })
]);
var DEFAULT_DOVE_LESSONS_MARKDOWN = `# Dove Lessons

\u672C\u6587\u6863\u4FDD\u5B58\u53EF\u590D\u7528\u7684\u7ECF\u9A8C\u4E0E\u5DE5\u4F5C\u504F\u597D\u3002\u5B83\u4E0D\u6784\u6210\u8BC1\u636E\u3001\u6743\u5A01\u5224\u65AD\u6216\u5B8C\u6210\u8BC1\u660E\u3002

${DOVE_LESSONS_SECTIONS.map((section) => `## ${section.heading}

- \u6682\u65E0\u3002`).join("\n\n")}
`;
var MINIMAL_WORKSPACE_DIRECTORIES = Object.freeze([
  ".dove/workspace-revisions",
  ".dove/missions",
  ".dove/mission-transitions",
  ".dove/artifact-handoffs",
  ".dove/research-decisions",
  ".dove/receipts",
  ".dove/receipts/execution",
  ".dove/sources",
  ".dove/claims",
  ".dove/experiments",
  ".dove/reviews"
]);
var MINIMAL_WORKSPACE_REQUIRED_FILES = Object.freeze([
  ".dove/manifest.json",
  ".dove/project.json",
  ".dove/LESSONS.md"
]);
var CURRENT_SCHEMA_FORBIDDEN_LEGACY_PATHS = Object.freeze([
  ".dove/state.json",
  ".dove/task-packets",
  ".dove/orchestration",
  ".dove/runtime",
  ".dove/workspace",
  ".dove/mutations",
  ".dove/programs",
  ".dove/meta",
  ".dove/context",
  ".dove/wiki",
  ".dove/artifacts",
  ".dove/requirement-snapshots",
  ".dove/research-trees",
  ".dove/receipts/completion",
  ".dove/receipts/authority",
  ".dove/lessons",
  ".dove/drafts",
  ".dove/figures",
  ".dove/rebuttal"
]);
var MANIFEST_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "manifestVersion", "workspaceId", "createdAt", "packageVersion"]);
var PROJECT_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "currentRevisionId", "currentRevisionDigest", "createdAt", "updatedAt"]);
var EXPERIMENT_PLAN_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "experimentId", "missionId", "title", "protocol", "protocolDigest", "updatedAt"]);
var EXPERIMENT_RESULT_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "resultId", "experimentId", "missionId", "protocolDigest", "status", "outcome", "measurements", "artifactRefs", "validationRefs", "denominator", "failures", "deviations", "limitations", "recordedAt", "resultDigest"]);
var SOURCE_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "sourceId", "missionId", "contractDigest", "citationKey", "title", "authors", "year", "locator", "sourceType", "abstract", "origin", "capturedMaterial", "lifecycle", "currentDecision", "useLimitation"]);
var CLAIM_FIELDS2 = /* @__PURE__ */ new Set(["schemaVersion", "claimId", "missionId", "contractDigest", "text", "evidenceRefs", "experimentEvidence", "uncertainty", "unsupportedExtensions", "currentAssessment", "updatedAt"]);
var SAFE_ID9 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH8 = /^[0-9a-f]{64}$/u;
var ISO_TIMESTAMP2 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
function sha2568(value) {
  return crypto10.createHash("sha256").update(value).digest("hex");
}
function stableValue7(value) {
  if (Array.isArray(value)) return value.map(stableValue7);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue7(item)]));
  }
  return value;
}
function stableWorkspaceSerialize(value) {
  return JSON.stringify(stableValue7(value));
}
function workspaceDigest(value) {
  return sha2568(stableWorkspaceSerialize(value));
}
function canonicalWorkspacePath(root) {
  return fs6.realpathSync.native(path10.resolve(root));
}
function assertPlainObject3(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertSealed3(value, fields, label) {
  assertPlainObject3(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function exactIso7(value, label) {
  if (typeof value !== "string" || !ISO_TIMESTAMP2.test(value) || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value;
}
function safeId7(value, label) {
  if (typeof value !== "string" || !SAFE_ID9.test(value)) {
    throw new Error(`${label} must be a safe lowercase identifier.`);
  }
  return value;
}
function pathExistsNoFollow(fullPath) {
  try {
    fs6.lstatSync(fullPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
function readJsonStrict2(fullPath, label) {
  let text11;
  try {
    text11 = fs6.readFileSync(fullPath, "utf8");
  } catch (error) {
    throw new Error(`${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return JSON.parse(text11);
  } catch (error) {
    throw new Error(`Malformed durable JSON in ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function validateDoveManifest(value, options = {}) {
  assertSealed3(value, MANIFEST_FIELDS, "Dove manifest");
  const expectedSchemaVersion = options.expectedSchemaVersion ?? DOVE_WORKSPACE_SCHEMA_VERSION;
  if (value.schemaVersion !== expectedSchemaVersion) {
    throw new Error(`Dove manifest schemaVersion ${value.schemaVersion ?? "missing"} is unsupported; expected ${expectedSchemaVersion}.`);
  }
  if (value.manifestVersion !== DOVE_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Dove manifest manifestVersion ${value.manifestVersion ?? "missing"} is unsupported.`);
  }
  safeId7(value.workspaceId, "Dove manifest workspaceId");
  exactIso7(value.createdAt, "Dove manifest createdAt");
  if (typeof value.packageVersion !== "string" || !value.packageVersion.trim()) {
    throw new Error("Dove manifest packageVersion must be a non-empty string.");
  }
  return value;
}
function validateDoveProject(value, manifest) {
  assertSealed3(value, PROJECT_FIELDS, "Dove project identity");
  if (value.schemaVersion !== DOVE_PROJECT_SCHEMA_VERSION) {
    throw new Error(`Dove project schemaVersion ${value.schemaVersion ?? "missing"} is unsupported.`);
  }
  safeId7(value.workspaceId, "Dove project workspaceId");
  if (value.workspaceId !== manifest.workspaceId) {
    throw new Error("Dove project workspaceId does not match the manifest workspaceId.");
  }
  safeId7(value.currentRevisionId, "Dove project currentRevisionId");
  hash7(value.currentRevisionDigest, "Dove project currentRevisionDigest");
  exactIso7(value.createdAt, "Dove project createdAt");
  exactIso7(value.updatedAt, "Dove project updatedAt");
  if (value.createdAt !== manifest.createdAt) {
    throw new Error("Dove project createdAt must match the manifest createdAt.");
  }
  return value;
}
function hash7(value, label) {
  if (typeof value !== "string" || !HASH8.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return value;
}
function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value;
}
function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} must not contain duplicates.`);
  return value;
}
function validateMissionShape(value, manifest, label) {
  return validatePersistedMission(value, {
    label,
    workspaceId: manifest.workspaceId,
    filename: path10.posix.basename(label)
  });
}
function validateLessonsMarkdown(value, label = "Dove Lessons document") {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be non-empty Markdown.`);
  if (value.includes("\0")) throw new Error(`${label} must not contain null bytes.`);
  if (!value.endsWith("\n")) throw new Error(`${label} must end with a newline.`);
  const headings = [...value.matchAll(/^##\s+(.+?)\s*$/gmu)].map((match) => match[1]);
  const expected = DOVE_LESSONS_SECTIONS.map((section) => section.heading);
  if (headings.length !== expected.length || headings.some((heading, index) => heading !== expected[index])) {
    throw new Error(`${label} must contain the five stable sections exactly once and in order: ${expected.join("; ")}.`);
  }
  return value;
}
function evidenceReferenceOwner(reference, receiptLedger) {
  if (reference.startsWith("artifact:")) {
    const target = reference.slice("artifact:".length);
    return receiptLedger.currentOwnership.find((item) => item.path === target) ?? null;
  }
  if (reference.startsWith("validation:")) {
    const target = reference.slice("validation:".length);
    for (const receipt of receiptLedger.receipts.toReversed()) {
      const validation = receipt.validations.find((item) => item.reference === target);
      if (validation) return { missionId: receipt.missionId, sha256: validation.outputHash, receiptId: receipt.receiptId };
    }
  }
  return null;
}
function sourceReferenceMap(sources) {
  return new Map([...sources.values()].flatMap((source) => [source.sourceId, source.citationKey, source.locator].filter(Boolean).map((reference) => [reference, source])));
}
function validateCurrentSourceEvidence(reference, missionId2, sources, missionGraph, label) {
  const source = sourceReferenceMap(sources).get(reference);
  if (!source || !missionCanReadMission(missionGraph, missionId2, source.missionId)) throw new Error(`${label} is not current self-or-ancestor source evidence.`);
  if (source.lifecycle !== "candidate" || source.useLimitation !== "Captured source material is current but not independently verified.") {
    throw new Error(`${label} is not a current non-rejected captured Source with the explicit verification limitation.`);
  }
}
function validateCurrentEvidenceReferences(root, references, missionId2, receiptLedger, missionGraph, label, sources = /* @__PURE__ */ new Map()) {
  stringArray(references, label);
  for (const [index, reference] of references.entries()) {
    if (reference.startsWith("source:")) {
      validateCurrentSourceEvidence(reference.slice("source:".length), missionId2, sources, missionGraph, `${label}[${index}]`);
      continue;
    }
    if (!reference.startsWith("artifact:") && !reference.startsWith("validation:")) throw new Error(`${label}[${index}] has an unsupported typed evidence reference.`);
    const owner = evidenceReferenceOwner(reference, receiptLedger);
    if (!owner || !missionCanReadMission(missionGraph, missionId2, owner.missionId)) throw new Error(`${label}[${index}] is not current self-or-ancestor receipt evidence.`);
    const target = reference.slice(reference.indexOf(":") + 1);
    const fullPath = path10.join(root, target);
    if (!fs6.existsSync(fullPath) || !fs6.lstatSync(fullPath).isFile() || sha2568(fs6.readFileSync(fullPath)) !== owner.sha256) {
      throw new Error(`${label}[${index}] no longer matches its receipt-owned file hash.`);
    }
  }
}
function readExperimentRecords(root, missions, missionGraph, receiptLedger, sources) {
  const directory = path10.join(root, ARTIFACT_PATHS.experimentsDir);
  const byExperiment = /* @__PURE__ */ new Map();
  for (const entry of fs6.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path10.posix.join(ARTIFACT_PATHS.experimentsDir, entry.name);
    if (entry.isSymbolicLink() || !entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON file.`);
    const suffix = entry.name.endsWith(".plan.json") ? "plan" : entry.name.endsWith(".result.json") ? "result" : null;
    if (!suffix) throw new Error(`${relativePath} is not a current Experiment plan or result record.`);
    const value = readJsonStrict2(path10.join(root, relativePath), relativePath);
    if (value.schemaVersion !== EXPERIMENT_RECORD_SCHEMA_VERSION) throw new Error(`${relativePath} has an unsupported schemaVersion.`);
    assertSealed3(value, suffix === "plan" ? EXPERIMENT_PLAN_FIELDS : EXPERIMENT_RESULT_FIELDS, relativePath);
    const experimentId = safeId7(value.experimentId, `${relativePath}.experimentId`);
    const missionId2 = safeId7(value.missionId, `${relativePath}.missionId`);
    if (!missions.has(missionId2) || entry.name !== `${experimentId}.${suffix}.json`) throw new Error(`${relativePath} has an invalid mission or filename binding.`);
    const owner = receiptLedger.currentOwnership.find((item) => item.path === relativePath);
    if (!owner || owner.missionId !== missionId2 || owner.sha256 !== sha2568(fs6.readFileSync(path10.join(root, relativePath)))) throw new Error(`${relativePath} is not current hash-matching mission-owned Experiment material.`);
    if (suffix === "plan") {
      nonEmptyString(value.title, `${relativePath}.title`);
      const protocol = normalizeExperimentProtocol(value.protocol, `${relativePath}.protocol`);
      if (value.protocolDigest !== evidenceDigest(protocol)) throw new Error(`${relativePath}.protocolDigest does not bind the frozen protocol.`);
      exactIso7(value.updatedAt, `${relativePath}.updatedAt`);
    } else {
      if (safeId7(value.resultId, `${relativePath}.resultId`) !== experimentId) throw new Error(`${relativePath}.resultId must match experimentId.`);
      const { resultDigest, schemaVersion: _schemaVersion, resultId: _resultId, experimentId: _experimentId, missionId: _missionId, protocolDigest: _protocolDigest, ...contract } = value;
      normalizeExperimentResult(contract, relativePath);
      if (resultDigest !== evidenceDigest({ schemaVersion: value.schemaVersion, resultId: value.resultId, experimentId: value.experimentId, missionId: value.missionId, protocolDigest: value.protocolDigest, ...contract })) throw new Error(`${relativePath}.resultDigest does not bind the exact result.`);
      validateCurrentEvidenceReferences(root, value.artifactRefs, missionId2, receiptLedger, missionGraph, `${relativePath}.artifactRefs`, sources);
      validateCurrentEvidenceReferences(root, value.validationRefs, missionId2, receiptLedger, missionGraph, `${relativePath}.validationRefs`, sources);
      for (const [index, failure] of value.failures.entries()) validateCurrentEvidenceReferences(root, failure.evidenceRefs, missionId2, receiptLedger, missionGraph, `${relativePath}.failures[${index}].evidenceRefs`, sources);
    }
    const records = byExperiment.get(experimentId) ?? {};
    if (records[suffix]) throw new Error(`Experiment ${experimentId} has duplicate ${suffix} records.`);
    records[suffix] = value;
    byExperiment.set(experimentId, records);
  }
  for (const [experimentId, records] of byExperiment) {
    if (records.result && !records.plan) throw new Error(`Experiment ${experimentId} result recording requires a frozen plan.`);
    if (!records.result) continue;
    if (records.plan.missionId !== records.result.missionId || records.plan.protocolDigest !== records.result.protocolDigest) throw new Error(`Experiment ${experimentId} plan/result binding is inconsistent.`);
    for (const measurement of records.result.measurements) {
      if (!records.plan.protocol.metrics.includes(measurement.metric)) throw new Error(`Experiment ${experimentId} result contains a measurement outside the frozen metric contract.`);
      if (measurement.comparison !== null && !records.plan.protocol.comparisons.includes(measurement.comparison)) throw new Error(`Experiment ${experimentId} result contains a measurement outside the frozen comparison contract.`);
    }
  }
  return byExperiment;
}
function currentOwnedJson(root, relativePath, missionId2, receiptLedger, fields, label) {
  const fullPath = path10.join(root, relativePath);
  const owner = receiptLedger.currentOwnership.find((item) => item.path === relativePath);
  if (!owner || owner.missionId !== missionId2 || !fs6.existsSync(fullPath) || !fs6.lstatSync(fullPath).isFile() || owner.sha256 !== sha2568(fs6.readFileSync(fullPath))) throw new Error(`${label} is not current hash-matching mission-owned material.`);
  const value = readJsonStrict2(fullPath, relativePath);
  assertSealed3(value, fields, label);
  return value;
}
function readSourceRecords(root, missions, receiptLedger) {
  const directory = path10.join(root, ARTIFACT_PATHS.sourcesDir);
  const sources = /* @__PURE__ */ new Map();
  for (const entry of fs6.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "materials" && entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const relativePath = path10.posix.join(ARTIFACT_PATHS.sourcesDir, entry.name);
    if (entry.isSymbolicLink() || !entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON source record.`);
    const peek = readJsonStrict2(path10.join(root, relativePath), relativePath);
    const sourceId = safeId7(peek.sourceId, `${relativePath}.sourceId`);
    const missionId2 = safeId7(peek.missionId, `${relativePath}.missionId`);
    const source = currentOwnedJson(root, relativePath, missionId2, receiptLedger, SOURCE_FIELDS, relativePath);
    if (source.schemaVersion !== 3 || entry.name !== `${sourceId}.json`) throw new Error(`${relativePath} has an unsupported schema or filename.`);
    const mission = missions.get(missionId2);
    if (!mission || source.contractDigest !== mission.contractDigest) throw new Error(`${relativePath}.contractDigest does not match its mission.`);
    if (!source.title && !source.locator) throw new Error(`${relativePath} requires title or locator.`);
    stringArray(source.authors, `${relativePath}.authors`);
    assertPlainObject3(source.capturedMaterial, `${relativePath}.capturedMaterial`);
    const materialPath = source.capturedMaterial.path;
    if (typeof materialPath !== "string" || !materialPath.startsWith(`${ARTIFACT_PATHS.sourcesDir}/materials/`) || !Number.isSafeInteger(source.capturedMaterial.sizeBytes) || source.capturedMaterial.sizeBytes < 1) throw new Error(`${relativePath}.capturedMaterial is invalid.`);
    hash7(source.capturedMaterial.sha256, `${relativePath}.capturedMaterial.sha256`);
    exactIso7(source.capturedMaterial.capturedAt, `${relativePath}.capturedMaterial.capturedAt`);
    const materialFile = path10.join(root, materialPath);
    if (!fs6.existsSync(materialFile) || !fs6.lstatSync(materialFile).isFile() || fs6.statSync(materialFile).size !== source.capturedMaterial.sizeBytes || sha2568(fs6.readFileSync(materialFile)) !== source.capturedMaterial.sha256) throw new Error(`${relativePath}.capturedMaterial has drifted.`);
    if (!["candidate", "rejected"].includes(source.lifecycle) || source.currentDecision?.decision !== source.lifecycle) throw new Error(`${relativePath}.lifecycle/currentDecision is invalid.`);
    exactIso7(source.currentDecision.decidedAt, `${relativePath}.currentDecision.decidedAt`);
    if (source.useLimitation !== "Captured source material is current but not independently verified.") throw new Error(`${relativePath}.useLimitation is invalid.`);
    sources.set(sourceId, source);
  }
  return sources;
}
function readClaimRecords(root, missions, missionGraph, receiptLedger, experiments, sources) {
  const claims = /* @__PURE__ */ new Map();
  for (const entry of fs6.readdirSync(path10.join(root, ARTIFACT_PATHS.claimsDir), { withFileTypes: true })) {
    const relativePath = path10.posix.join(ARTIFACT_PATHS.claimsDir, entry.name);
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON claim record.`);
    const peek = readJsonStrict2(path10.join(root, relativePath), relativePath);
    const missionId2 = safeId7(peek.missionId, `${relativePath}.missionId`);
    const claim = currentOwnedJson(root, relativePath, missionId2, receiptLedger, CLAIM_FIELDS2, relativePath);
    const claimId = safeId7(claim.claimId, `${relativePath}.claimId`);
    if (claim.schemaVersion !== CLAIM_RECORD_SCHEMA_VERSION || entry.name !== `${claimId}.json` || missions.get(missionId2)?.contractDigest !== claim.contractDigest) throw new Error(`${relativePath} schema, filename, or mission binding is invalid.`);
    const contract = normalizeClaimContract({ experimentEvidence: claim.experimentEvidence, uncertainty: claim.uncertainty, unsupportedExtensions: claim.unsupportedExtensions, currentAssessment: claim.currentAssessment }, relativePath);
    validateCurrentEvidenceReferences(root, claim.evidenceRefs, missionId2, receiptLedger, missionGraph, `${relativePath}.evidenceRefs`, sources);
    if (claim.evidenceRefs.some((reference) => reference.startsWith("source:")) && !contract.uncertainty.includes("Captured source material is current but not independently verified.")) throw new Error(`${relativePath}.uncertainty omits the captured-source verification limitation.`);
    if (claim.evidenceRefs.length === 0 && contract.experimentEvidence.length === 0) throw new Error(`${relativePath} has no current evidence.`);
    for (const [index, binding] of contract.experimentEvidence.entries()) {
      const records = experiments.get(binding.experimentId);
      if (!records?.plan || !records.result || records.plan.missionId !== records.result.missionId || !missionCanReadMission(missionGraph, missionId2, records.plan.missionId)) throw new Error(`${relativePath}.experimentEvidence[${index}] must bind a current self-or-ancestor Experiment.`);
      const measurement = records.result.measurements.find((item) => item.metric === binding.metric && item.comparison === binding.comparison);
      if (!measurement || measurement.value !== binding.value) throw new Error(`${relativePath}.experimentEvidence[${index}] does not exactly bind the referenced measurement.`);
    }
    exactIso7(claim.updatedAt, `${relativePath}.updatedAt`);
    claims.set(claimId, claim);
  }
  return claims;
}
function validateJsonDirectory(root, relativeDirectory, manifest, validate, context = {}) {
  const directory = path10.join(root, relativeDirectory);
  const values = [];
  for (const entry of fs6.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) throw new Error(`${path10.posix.join(relativeDirectory, entry.name)} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${path10.posix.join(relativeDirectory, entry.name)} must be a regular JSON file.`);
    const relativePath = path10.posix.join(relativeDirectory, entry.name);
    values.push(validate(readJsonStrict2(path10.join(root, relativePath), relativePath), manifest, relativePath, context));
  }
  return values;
}
function requiredPathProblem(root, relativePath, kind) {
  const fullPath = path10.join(root, relativePath);
  if (!fs6.existsSync(fullPath)) return `${relativePath} is missing`;
  const stat = fs6.lstatSync(fullPath);
  if (stat.isSymbolicLink()) return `${relativePath} must not be a symbolic link`;
  if (kind === "directory" && !stat.isDirectory()) return `${relativePath} must be a directory`;
  if (kind === "file" && !stat.isFile()) return `${relativePath} must be a regular file`;
  return null;
}
function sourceIdentity(doveRoot) {
  const stat = fs6.lstatSync(doveRoot, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(".dove must be a real directory; symbolic-link workspace roots are not accepted.");
  }
  return {
    kind: "directory",
    device: String(stat.dev),
    inode: String(stat.ino),
    mode: Number(stat.mode),
    ctimeNs: String(stat.ctimeNs),
    mtimeNs: String(stat.mtimeNs)
  };
}
function treeEntries(doveRoot) {
  const entries = [];
  const visit = (directory, prefix = "") => {
    for (const entry of fs6.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? path10.posix.join(prefix, entry.name) : entry.name;
      const fullPath = path10.join(directory, entry.name);
      const stat = fs6.lstatSync(fullPath, { bigint: true });
      const metadata = {
        path: relativePath,
        device: String(stat.dev),
        inode: String(stat.ino),
        mode: Number(stat.mode),
        ctimeNs: String(stat.ctimeNs),
        mtimeNs: String(stat.mtimeNs)
      };
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "directory" });
        visit(fullPath, relativePath);
      } else if (stat.isFile()) {
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha2568(fs6.readFileSync(fullPath)) });
      } else if (stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "symlink", target: fs6.readlinkSync(fullPath) });
      } else {
        throw new Error(`Unsupported filesystem entry inside .dove: ${relativePath}.`);
      }
    }
  };
  visit(doveRoot);
  return entries;
}
function inspectDoveSourceTree(root) {
  const workspace = canonicalWorkspacePath(root);
  const doveRoot = path10.join(workspace, ".dove");
  if (!pathExistsNoFollow(doveRoot)) return null;
  const identity = sourceIdentity(doveRoot);
  const entries = treeEntries(doveRoot);
  return {
    identity,
    entryCount: entries.length,
    treeDigest: workspaceDigest(entries)
  };
}
function detectedVersionLabel(value) {
  if (Number.isInteger(value)) return String(value);
  if (value === void 0) return "missing";
  return "invalid";
}
function inspectDoveWorkspaceVersion(root) {
  const workspace = canonicalWorkspacePath(root);
  const doveRoot = path10.join(workspace, ".dove");
  if (!pathExistsNoFollow(doveRoot)) {
    return { workspace, state: "absent", category: "absent", healthy: false, schemaVersion: null, detectedSchema: "absent" };
  }
  let source;
  try {
    source = { identity: sourceIdentity(doveRoot) };
  } catch (error) {
    return { workspace, state: "invalid-root", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: "invalid-root", error: error instanceof Error ? error.message : String(error) };
  }
  const manifestPath = path10.join(doveRoot, "manifest.json");
  if (!fs6.existsSync(manifestPath)) {
    return { workspace, state: "legacy-missing-manifest", category: "legacy", healthy: false, schemaVersion: null, detectedSchema: "missing-manifest", source };
  }
  let manifest;
  try {
    manifest = readJsonStrict2(manifestPath, ".dove/manifest.json");
  } catch (error) {
    return { workspace, state: "malformed-manifest", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: "malformed", source, error: error instanceof Error ? error.message : String(error) };
  }
  const version = manifest?.schemaVersion;
  const retainedLegacyAuthorityManifest = version === void 0 && Number.isInteger(manifest?.version);
  if (retainedLegacyAuthorityManifest) {
    return { workspace, state: "legacy-authority-manifest", category: "legacy", healthy: false, schemaVersion: manifest.version, detectedSchema: `legacy-authority-${manifest.version}`, source, manifest };
  }
  if (!Number.isInteger(version)) {
    return { workspace, state: "invalid-manifest-version", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: detectedVersionLabel(version), source, manifest };
  }
  if (version < DOVE_WORKSPACE_SCHEMA_VERSION) {
    return { workspace, state: "legacy-version", category: "legacy", healthy: false, schemaVersion: version, detectedSchema: String(version), source, manifest };
  }
  if (version > DOVE_WORKSPACE_SCHEMA_VERSION) {
    return { workspace, state: "future-version", category: "future", healthy: false, schemaVersion: version, detectedSchema: String(version), source, manifest };
  }
  try {
    validateDoveManifest(manifest, { expectedSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION });
    const requiredDirectories = MINIMAL_WORKSPACE_DIRECTORIES;
    const problems = [
      ...requiredDirectories.map((relativePath) => requiredPathProblem(workspace, relativePath, "directory")),
      ...MINIMAL_WORKSPACE_REQUIRED_FILES.map((relativePath) => requiredPathProblem(workspace, relativePath, "file")),
      ...CURRENT_SCHEMA_FORBIDDEN_LEGACY_PATHS.filter((relativePath) => fs6.existsSync(path10.join(workspace, relativePath))).map((relativePath) => `${relativePath} is a retained legacy artifact and must not coexist with current schema ${DOVE_WORKSPACE_SCHEMA_VERSION}`)
    ].filter(Boolean);
    if (problems.length > 0) throw new Error(`Dove schema declaration contradicts required layout: ${problems.join("; ")}.`);
    const project = validateDoveProject(readJsonStrict2(path10.join(doveRoot, "project.json"), ".dove/project.json"), manifest);
    const workspaceRevisionValues = validateJsonDirectory(workspace, ARTIFACT_PATHS.workspaceRevisionsDir, manifest, (value, currentManifest, label) => validateWorkspaceRevision(value, {
      label,
      workspaceId: currentManifest.workspaceId,
      filename: path10.posix.basename(label)
    }));
    const workspaceRevisionChain = validateWorkspaceRevisionChain(workspaceRevisionValues, project);
    const workspaceRevisions = workspaceRevisionChain.byId;
    const currentWorkspaceRevision = workspaceRevisionChain.current;
    const missionValues = validateJsonDirectory(workspace, ARTIFACT_PATHS.missionsDir, manifest, validateMissionShape);
    const missionGraph = validateMissionGraph(missionValues.map((mission) => ({ filename: `${mission.missionId}.json`, mission })));
    const missions = missionGraph.missions;
    for (const mission of missions.values()) {
      const boundRevision = workspaceRevisions.get(mission.workspaceRevisionId);
      if (!boundRevision || boundRevision.revisionDigest !== mission.workspaceRevisionDigest) throw new Error(`Mission ${mission.missionId} references an unavailable workspace revision.`);
    }
    const missionTransitionValues = validateJsonDirectory(workspace, ARTIFACT_PATHS.missionTransitionsDir, manifest, (value, currentManifest, label) => ({ value, currentManifest, label }));
    const missionTransitions = validateMissionTransitions(missionTransitionValues.map(({ value }) => value), { workspaceId: manifest.workspaceId, missions });
    const artifactHandoffValues = validateJsonDirectory(workspace, ARTIFACT_PATHS.artifactHandoffsDir, manifest, (value, currentManifest, label) => ({ value, currentManifest, label }));
    const artifactHandoffs = validateArtifactHandoffs(artifactHandoffValues.map(({ value }) => value), { workspaceId: manifest.workspaceId, missions });
    const researchDecisionValues = validateJsonDirectory(workspace, ARTIFACT_PATHS.researchDecisionsDir, manifest, (value, _manifest, label) => {
      const decision = validatePersistedResearchDecision(value, { label });
      if (path10.posix.basename(label) !== `${decision.decisionId}.json`) throw new Error(`${label} filename must match decisionId ${decision.decisionId}.`);
      const mission = missions.get(decision.missionId);
      if (!mission || mission.mode !== "research" || decision.contractDigest !== mission.contractDigest) throw new Error(`${label} does not bind an existing research mission contract.`);
      return decision;
    });
    const decisionsByMission = /* @__PURE__ */ new Map();
    for (const decision of researchDecisionValues) {
      const decisions = decisionsByMission.get(decision.missionId) ?? [];
      decisions.push(decision);
      decisionsByMission.set(decision.missionId, decisions);
    }
    const researchDecisions = /* @__PURE__ */ new Map();
    const currentResearchDecisions = /* @__PURE__ */ new Map();
    for (const [missionId2, decisions] of decisionsByMission) {
      const mission = missions.get(missionId2);
      const chain = validateResearchDecisionChain(decisions, { label: `Research decision chain for mission ${missionId2}`, missionId: missionId2, contractDigest: mission.contractDigest });
      for (const decision of chain) researchDecisions.set(decision.decisionId, decision);
      currentResearchDecisions.set(missionId2, chain.at(-1));
    }
    for (const mission of missions.values()) {
      if (mission.mode === "research" && !currentResearchDecisions.has(mission.missionId)) throw new Error(`Research mission ${mission.missionId} requires an initial research decision.`);
      if (mission.mode === "ordinary" && currentResearchDecisions.has(mission.missionId)) throw new Error(`Ordinary mission ${mission.missionId} must not have a research decision.`);
    }
    const receiptLedger = readExecutionReceiptLedger(workspace, { manifest, missions, missionGraph, artifactHandoffs });
    for (const receipt of receiptLedger.receipts) {
      const mission = missions.get(receipt.missionId);
      if (receipt.ordinaryHostOutcome !== void 0 && mission?.mode !== "ordinary") throw new Error(`Execution receipt ${receipt.receiptId} has an ordinary outcome for non-ordinary mission ${receipt.missionId}.`);
      if (receipt.researchOutcome !== void 0 && mission?.mode !== "research") throw new Error(`Execution receipt ${receipt.receiptId} has a research outcome for non-research mission ${receipt.missionId}.`);
      if (receipt.researchOutcome !== void 0) {
        const decision = researchDecisions.get(receipt.researchOutcome.decisionId);
        if (!decision || decision.missionId !== receipt.missionId || decision.decisionDigest !== receipt.researchOutcome.decisionDigest || decision.nextAction?.actionId !== receipt.researchOutcome.actionId || decision.nextAction?.actionDigest !== receipt.researchOutcome.actionDigest) throw new Error(`Execution receipt ${receipt.receiptId}.researchOutcome does not bind an exact persisted decision action.`);
      }
    }
    const receiptById = new Map(receiptLedger.receipts.map((receipt) => [receipt.receiptId, receipt]));
    for (const decision of researchDecisions.values()) {
      for (const receiptId of decision.consumedReceiptIds) {
        const receipt = receiptById.get(receiptId);
        if (!receipt) throw new Error(`Research decision ${decision.decisionId} consumes unknown receipt ${receiptId}.`);
        if (receipt.missionId !== decision.missionId || !receipt.researchOutcome) throw new Error(`Research decision ${decision.decisionId} may consume only research receipts from its mission.`);
        if (receipt.researchOutcome.decisionId !== decision.predecessorDecisionId) throw new Error(`Research decision ${decision.decisionId} must consume receipts produced under its immediate predecessor decision.`);
      }
    }
    validateArtifactHandoffAuthority(artifactHandoffs, receiptLedger);
    const sources = readSourceRecords(workspace, missions, receiptLedger);
    const lessonsDocument = fs6.readFileSync(path10.join(workspace, ARTIFACT_PATHS.lessonsDocument), "utf8");
    validateLessonsMarkdown(lessonsDocument, ARTIFACT_PATHS.lessonsDocument);
    const experiments = readExperimentRecords(workspace, missions, missionGraph, receiptLedger, sources);
    const claims = readClaimRecords(workspace, missions, missionGraph, receiptLedger, experiments, sources);
    return {
      workspace,
      state: "current-healthy",
      category: "current",
      healthy: true,
      schemaVersion: version,
      detectedSchema: String(version),
      source,
      manifest,
      project,
      workspaceRevisions,
      currentWorkspaceRevision,
      missions,
      missionGraph,
      missionTransitions,
      artifactHandoffs,
      researchDecisions,
      currentResearchDecisions,
      lessonsDocument,
      experiments,
      sources,
      claims,
      receiptLedger
    };
  } catch (error) {
    return { workspace, state: "current-unhealthy", category: "invalid", healthy: false, schemaVersion: version, detectedSchema: String(version), source, manifest, error: error instanceof Error ? error.message : String(error) };
  }
}
function inspectDoveWorkspace(root) {
  return inspectDoveWorkspaceVersion(root);
}
function workspaceSchemaError(inspection, operation = "Dove operation") {
  if (inspection.state === "absent") {
    return new Error(`${operation} requires a current Dove workspace. Run /dove:workspace and explicitly establish the research mainline first.`);
  }
  if (inspection.category === "legacy") {
    return new Error(`${operation} cannot open unsupported Dove schema ${inspection.detectedSchema} under schema ${DOVE_WORKSPACE_SCHEMA_VERSION}. Archive the old workspace and establish a new current workspace explicitly. No files were changed.`);
  }
  if (inspection.category === "future") {
    return new Error(`${operation} refuses future Dove schema ${inspection.detectedSchema}; install a compatible Dove version. No files were changed.`);
  }
  return new Error(`${operation} refuses invalid Dove workspace state ${inspection.state}${inspection.error ? `: ${inspection.error}` : ""}. Run dove workspace reset --archive and confirm the exact proposal. No files were changed.`);
}
function openDoveWorkspace(root, options = {}) {
  const inspection = inspectDoveWorkspace(root);
  if (inspection.healthy) return inspection;
  if (inspection.state === "absent" && options.allowAbsent === true) return inspection;
  throw workspaceSchemaError(inspection, options.operation);
}
function createMinimalWorkspaceDocuments({ workspaceId, mainline, changeReason = "Establish the initial research mainline.", createdAt }) {
  safeId7(workspaceId, "workspaceId");
  exactIso7(createdAt, "createdAt");
  if (typeof mainline !== "string" || !mainline.trim()) throw new Error("Dove workspace initialization requires a non-empty research mainline.");
  const manifest = {
    schemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION,
    manifestVersion: DOVE_MANIFEST_SCHEMA_VERSION,
    workspaceId,
    createdAt,
    packageVersion: PACKAGE_VERSION
  };
  const workspaceRevision = createWorkspaceRevision({
    workspaceId,
    revision: 1,
    previousRevisionId: null,
    previousRevisionDigest: null,
    mainline: mainline.trim(),
    changeReason,
    createdAt
  });
  const project = {
    schemaVersion: DOVE_PROJECT_SCHEMA_VERSION,
    workspaceId,
    currentRevisionId: workspaceRevision.revisionId,
    currentRevisionDigest: workspaceRevision.revisionDigest,
    createdAt,
    updatedAt: createdAt
  };
  return { manifest, project, workspaceRevision };
}
function newWorkspaceId() {
  return `workspace-${crypto10.randomUUID()}`;
}
function archiveTargetFor({ workspace, detectedSchema, treeDigest }) {
  const schemaLabel = String(detectedSchema ?? "invalid").replace(/[^a-z0-9._-]+/giu, "-").toLowerCase();
  return path10.join(workspace, ".dove-archive", `schema-${schemaLabel}-${String(treeDigest).slice(0, 24)}`);
}

// src/core/artifact-lineage.mjs
function readArtifactLedger(root) {
  const workspace = openDoveWorkspace(root, { operation: "Artifact receipt ledger read" });
  return workspace.receiptLedger;
}
function readArtifactOwnership(root) {
  const ledger = readArtifactLedger(root);
  return {
    schemaVersion: ledger.schemaVersion,
    workspaceId: ledger.workspaceId,
    artifacts: ledger.currentOwnership,
    updatedAt: ledger.updatedAt
  };
}

// src/core/mission-contracts.mjs
import crypto14 from "node:crypto";
import fs10 from "node:fs";
import path14 from "node:path";

// src/core/mission-research-decision.mjs
import crypto11 from "node:crypto";
function stableId(prefix, value) {
  return `${prefix}-${crypto11.createHash("sha256").update(stableResearchDecisionSerialize(value)).digest("hex").slice(0, 20)}`;
}
function createInitialMissionResearchDecision({ mission, createdAt }) {
  const hypotheses = mission.assumptions.map((assumption, index) => ({
    hypothesisId: stableId("hypothesis", { missionId: mission.missionId, index, assumption }),
    statement: assumption,
    assessment: "unresolved",
    supportingEvidence: [],
    counterEvidence: [],
    falsificationCondition: `Observe current evidence that contradicts this assumption: ${assumption}`
  }));
  const openQuestions = mission.requirements.map((requirement, index) => ({
    questionId: stableId("question", { missionId: mission.missionId, index, requirement }),
    question: `What current evidence is needed to satisfy this mission requirement: ${requirement}`
  }));
  if (openQuestions.length === 0) {
    openQuestions.push({ questionId: stableId("question", { missionId: mission.missionId, goal: mission.goal }), question: `What bounded evidence best advances this mission goal: ${mission.goal}` });
  }
  const nextAction = createResearchDecisionAction({
    actionId: stableId("action", { missionId: mission.missionId, goal: mission.goal }),
    kind: "analysis",
    description: `Perform one bounded evidence-gathering or analysis step for: ${mission.goal}`,
    rationale: "The immutable mission authorizes one bounded step before scientific reevaluation.",
    targetHypothesisOrQuestionIds: [hypotheses[0]?.hypothesisId ?? openQuestions[0].questionId],
    successConditions: mission.completionCriteria.length > 0 ? mission.completionCriteria.map((item) => item.criterion) : ["Return one concrete bounded result relevant to the mission goal."],
    stopConditions: ["Stop after this single bounded action.", "Stop without expanding scope when required inputs or authority are unavailable."],
    expectedEvidence: mission.evidenceRequirements.length > 0 ? mission.evidenceRequirements.map((item) => item.requirement) : ["bounded-research-result"],
    budget: { actions: 1, timeMinutes: 60, costUnits: 1 }
  });
  return createResearchDecision({
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    revision: 1,
    predecessorDecisionId: null,
    predecessorDecisionDigest: null,
    createdAt,
    content: {
      synthesis: mission.goal,
      hypotheses,
      routes: [],
      openQuestions,
      evidenceRefs: [],
      consumedReceiptIds: [],
      disposition: "continue",
      reasonCodes: [],
      nextAction
    }
  });
}

// src/core/research-decision-store.mjs
import fs8 from "node:fs";
import path12 from "node:path";

// src/core/workspace.mjs
import fs7 from "node:fs";
import path11 from "node:path";
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function resolvePath(root, relativePath) {
  return path11.join(root, relativePath);
}
function cloneFallback(fallback) {
  return typeof fallback === "function" ? fallback() : structuredClone(fallback);
}
function requireMutationContext(root, operation) {
  const context = currentMutationContext(root);
  if (!context) throw new Error(`${operation} requires an active MutationContext.`);
  return context;
}
function readJson(root, relativePath, fallback) {
  const context = currentMutationContext(root);
  if (context) return context.readJson(relativePath, fallback);
  const fullPath = resolvePath(root, relativePath);
  if (!fs7.existsSync(fullPath)) return cloneFallback(fallback);
  try {
    return JSON.parse(fs7.readFileSync(fullPath, "utf8"));
  } catch (error) {
    throw new Error(`Malformed JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function writeJson(root, relativePath, value) {
  return requireMutationContext(root, "writeJson").writeJson(relativePath, value);
}
function writeText(root, relativePath, content) {
  return requireMutationContext(root, "writeText").writeText(relativePath, content);
}
function assertGovernanceMutationRegistered(actionId, expectedMode) {
  const guarded = new Set(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.id));
  const exempt = new Map(GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => [entry.id, entry]));
  if (expectedMode === "guarded") {
    if (!guarded.has(actionId)) throw new Error(`Governance registry missing guarded mutation entry: ${actionId}`);
    return;
  }
  if (expectedMode === "exempt") {
    const entry = exempt.get(actionId);
    if (!entry) throw new Error(`Governance registry missing exempt mutation entry: ${actionId}`);
    if (entry.sunsetAt && entry.sunsetAt <= nowIso()) throw new Error(`Governance exempt entry expired: ${actionId}`);
    return;
  }
  throw new Error(`Unknown governance mutation mode: ${expectedMode}`);
}

// src/core/research-decision-store.mjs
var SAFE_ID10 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var APPEND_FIELDS2 = /* @__PURE__ */ new Set([
  "missionId",
  "predecessorDecisionId",
  "predecessorDecisionDigest",
  "createdAt",
  "content"
]);
var READ_FIELDS = /* @__PURE__ */ new Set(["missionId"]);
var APPEND_LOCK_PATH = ".dove/.research-decision-append.lock";
function assertPlainObject4(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertSealed4(value, fields, label) {
  assertPlainObject4(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function safeId8(value, label) {
  if (typeof value !== "string" || !SAFE_ID10.test(value)) {
    throw new Error(`${label} must be a safe lowercase identifier.`);
  }
  return value;
}
function researchDecisionPath(decisionId) {
  return path12.posix.join(ARTIFACT_PATHS.researchDecisionsDir, `${safeId8(decisionId, "decisionId")}.json`);
}
function sortedDecisions(decisions) {
  return [...decisions].sort((left, right) => left.missionId.localeCompare(right.missionId) || left.revision - right.revision || left.decisionId.localeCompare(right.decisionId));
}
function readResearchDecisions(root, options = {}) {
  assertSealed4(options, READ_FIELDS, "Research decision read options");
  const workspace = openDoveWorkspace(root, { operation: "Research decision read" });
  const missionId2 = options.missionId === void 0 ? null : safeId8(options.missionId, "missionId");
  if (missionId2 !== null && !workspace.missions.has(missionId2)) {
    throw new Error(`Research decision read references unknown mission ${missionId2}.`);
  }
  const decisions = sortedDecisions(workspace.researchDecisions.values());
  return missionId2 === null ? decisions : decisions.filter((decision) => decision.missionId === missionId2);
}
function appendResearchDecision2(root, args = {}) {
  assertGovernanceMutationRegistered("append-research-decision", "guarded");
  assertSealed4(args, APPEND_FIELDS2, "appendResearchDecision");
  const context = currentMutationContext(root);
  if (!context) throw new Error("appendResearchDecision requires an active MutationContext.");
  const pendingAppend = context.operations().find((operation) => operation.relativePath.startsWith(`${ARTIFACT_PATHS.researchDecisionsDir}/`));
  if (pendingAppend) {
    throw new Error("appendResearchDecision allows only one research decision append per MutationContext.");
  }
  const missionId2 = safeId8(args.missionId, "missionId");
  const workspace = openDoveWorkspace(root, { operation: "Research decision append" });
  const mission = workspace.missions.get(missionId2);
  if (!mission) throw new Error(`Research decision append references unknown mission ${missionId2}.`);
  if (mission.mode !== "research") throw new Error(`Research decision append requires a research mission; ${missionId2} is ordinary.`);
  context.requireCommitPrecondition(path12.posix.join(ARTIFACT_PATHS.missionsDir, `${mission.missionId}.json`));
  context.requireCommitPrecondition(ARTIFACT_PATHS.researchDecisionsDir);
  context.requireCommitLock(APPEND_LOCK_PATH, { label: "Research decision append lock" });
  const currentChain = readResearchDecisions(root, { missionId: missionId2 });
  const nextChain = appendResearchDecision(currentChain, {
    missionId: missionId2,
    contractDigest: mission.contractDigest,
    predecessorDecisionId: args.predecessorDecisionId,
    predecessorDecisionDigest: args.predecessorDecisionDigest,
    createdAt: args.createdAt,
    content: args.content
  });
  const decision = nextChain[nextChain.length - 1];
  const relativePath = researchDecisionPath(decision.decisionId);
  if (context.fileExists(relativePath) || fs8.existsSync(path12.resolve(root, relativePath))) {
    throw new Error(`Research decision id is already occupied: ${decision.decisionId}.`);
  }
  context.ensureDirectory(ARTIFACT_PATHS.researchDecisionsDir);
  writeJson(root, relativePath, decision);
  return {
    status: "appended",
    workspaceId: workspace.manifest.workspaceId,
    missionId: missionId2,
    decision,
    currentResearchDecision: decision,
    writes: [relativePath]
  };
}

// src/core/review-mission-binding.mjs
import crypto12 from "node:crypto";
var REVIEW_MISSION_BINDING_VERSION = 1;
var BINDING_PATTERN = /^review-mission-v1-[a-f0-9]{64}$/u;
function bindingDigest(workspaceId, missionId2, contractDigest) {
  return crypto12.createHash("sha256").update(`dove-review-mission-binding
${workspaceId}
${missionId2}
${contractDigest}
`).digest("hex");
}
function reviewMissionBinding(workspace, mission) {
  const workspaceId = workspace?.manifest?.workspaceId;
  if (typeof workspaceId !== "string" || !workspaceId || typeof mission?.missionId !== "string" || typeof mission?.contractDigest !== "string") {
    throw new Error("Review Mission binding requires a current workspace and Mission contract.");
  }
  return `review-mission-v${REVIEW_MISSION_BINDING_VERSION}-${bindingDigest(workspaceId, mission.missionId, mission.contractDigest)}`;
}
function assertReviewMissionBinding(workspace, mission, value) {
  if (typeof value !== "string" || !BINDING_PATTERN.test(value) || value !== reviewMissionBinding(workspace, mission)) {
    throw new Error("The supplied Mission is not bound to the current Review Skill start.");
  }
  return value;
}

// src/core/research-handoff.mjs
import crypto13 from "node:crypto";
var RESEARCH_HANDOFF_SCHEMA_VERSION = 2;
var RESEARCH_HANDOFF_BINDING_FIELDS = Object.freeze(["missionId", "contractDigest", "decisionDigest"]);
var RESEARCH_HOST_OUTCOME_STATUSES = Object.freeze(["completed", "stopped", "aborted", "blocked", "failed"]);
var SAFE_ID11 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH9 = /^[0-9a-f]{64}$/u;
var ISO2 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
var OUTCOME_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
var STATUS_SET2 = new Set(RESEARCH_HOST_OUTCOME_STATUSES);
var ENVELOPE_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "envelopeId", ...RESEARCH_HANDOFF_BINDING_FIELDS, "actionId", "actionDigest", "budget", "expectedEvidence", "issuedAt", "expiresAt", "supersedesEnvelopeId", "seal"]);
var OUTCOME_FIELDS = /* @__PURE__ */ new Set(["status", "performedActionCount", "actualUsage", "evidenceReturned", "facts", "claims", "startedAt", "finishedAt"]);
var CURRENT_FIELDS = /* @__PURE__ */ new Set([...RESEARCH_HANDOFF_BINDING_FIELDS, "currentEnvelopeId", "supersededEnvelopeIds", "now"]);
function stable2(value) {
  if (Array.isArray(value)) return value.map(stable2);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable2(item)]));
  return value;
}
function sha2569(value) {
  return crypto13.createHash("sha256").update(JSON.stringify(stable2(value))).digest("hex");
}
function plain5(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function sealed6(value, fields, label) {
  plain5(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
}
function text7(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function safeId9(value, label) {
  const result = text7(value, label);
  if (!SAFE_ID11.test(result)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return result;
}
function hash8(value, label) {
  const result = text7(value, label);
  if (!HASH9.test(result)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return result;
}
function exactIso8(value, label) {
  if (typeof value !== "string" || !ISO2.test(value) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value;
}
function outcomeIso(value, label) {
  if (typeof value !== "string" || !OUTCOME_TIME.test(value)) throw new Error(`${label} must be an ISO-8601 UTC timestamp with seconds and optional milliseconds.`);
  const result = new Date(Date.parse(value)).toISOString();
  if (result !== (value.includes(".") ? value : value.replace("Z", ".000Z"))) throw new Error(`${label} must be an ISO-8601 UTC timestamp.`);
  return result;
}
function strings5(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const result = value.map((item, index) => text7(item, `${label}[${index}]`));
  if (new Set(result).size !== result.length) throw new Error(`${label} must not contain duplicates.`);
  return result;
}
function budget2(value, label, allowEmpty = false) {
  plain5(value, label);
  const result = {};
  for (const [dimension, amount] of Object.entries(value)) {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`${label}.${dimension} must be a non-negative safe integer.`);
    result[dimension] = amount;
  }
  if (!allowEmpty && Object.keys(result).length === 0) throw new Error(`${label} must declare at least one dimension.`);
  return result;
}
function normalizeEnvelope(value) {
  sealed6(value, ENVELOPE_FIELDS, "Research handoff");
  if (value.schemaVersion !== RESEARCH_HANDOFF_SCHEMA_VERSION) throw new Error("Research handoff has an unsupported schemaVersion.");
  const result = { schemaVersion: RESEARCH_HANDOFF_SCHEMA_VERSION, envelopeId: safeId9(value.envelopeId, "Research handoff envelopeId"), missionId: safeId9(value.missionId, "Research handoff missionId"), contractDigest: hash8(value.contractDigest, "Research handoff contractDigest"), decisionDigest: hash8(value.decisionDigest, "Research handoff decisionDigest"), actionId: safeId9(value.actionId, "Research handoff actionId"), actionDigest: hash8(value.actionDigest, "Research handoff actionDigest"), budget: budget2(value.budget, "Research handoff budget"), expectedEvidence: strings5(value.expectedEvidence, "Research handoff expectedEvidence"), issuedAt: exactIso8(value.issuedAt, "Research handoff issuedAt"), expiresAt: exactIso8(value.expiresAt, "Research handoff expiresAt"), supersedesEnvelopeId: value.supersedesEnvelopeId === null ? null : safeId9(value.supersedesEnvelopeId, "Research handoff supersedesEnvelopeId"), seal: hash8(value.seal, "Research handoff seal") };
  if (Date.parse(result.expiresAt) <= Date.parse(result.issuedAt)) throw new Error("Research handoff expiresAt must be later than issuedAt.");
  const { seal, ...payload } = result;
  if (seal !== sha2569(payload)) throw new Error("Research handoff seal does not match its content.");
  return result;
}
function createResearchHandoff(value, options = {}) {
  const decision = validatePersistedResearchDecision(value, { label: "Research handoff decision" });
  if (!decision.nextAction) throw new Error("Research handoff decision must contain one nextAction.");
  const issuedAt = exactIso8(options.issuedAt, "Research handoff issuedAt");
  const expiresAt = exactIso8(options.expiresAt, "Research handoff expiresAt");
  const envelope2 = { schemaVersion: RESEARCH_HANDOFF_SCHEMA_VERSION, envelopeId: options.envelopeId ?? `research-handoff-${sha2569({ decisionDigest: decision.decisionDigest, issuedAt, expiresAt }).slice(0, 24)}`, missionId: decision.missionId, contractDigest: decision.contractDigest, decisionDigest: decision.decisionDigest, actionId: decision.nextAction.actionId, actionDigest: decision.nextAction.actionDigest, budget: decision.nextAction.budget, expectedEvidence: decision.nextAction.expectedEvidence, issuedAt, expiresAt, supersedesEnvelopeId: options.supersedesEnvelopeId ?? null };
  return Object.freeze({ ...envelope2, seal: sha2569(envelope2) });
}
function validateResearchHandoff(value, current = {}) {
  const envelope2 = normalizeEnvelope(value);
  sealed6(current, CURRENT_FIELDS, "Current research bindings");
  const now = exactIso8(current.now, "Current research bindings.now");
  for (const field of RESEARCH_HANDOFF_BINDING_FIELDS) if (current[field] !== envelope2[field]) throw new Error(`Research handoff is stale: ${field} changed.`);
  if (current.currentEnvelopeId !== envelope2.envelopeId || (current.supersededEnvelopeIds ?? []).includes(envelope2.envelopeId)) throw new Error("Research handoff is superseded.");
  if (Date.parse(now) < Date.parse(envelope2.issuedAt) || Date.parse(now) >= Date.parse(envelope2.expiresAt)) throw new Error("Research handoff is expired.");
  return Object.freeze(envelope2);
}
function validateResearchHostOutcome(envelopeValue, outcomeValue, current = {}) {
  const envelope2 = validateResearchHandoff(envelopeValue, current);
  sealed6(outcomeValue, OUTCOME_FIELDS, "Host outcome");
  const status = text7(outcomeValue.status, "Host outcome status");
  if (!STATUS_SET2.has(status)) throw new Error("Host outcome status is unsupported.");
  if (!Number.isSafeInteger(outcomeValue.performedActionCount) || outcomeValue.performedActionCount < 0) throw new Error("performedActionCount must be a non-negative safe integer.");
  const actualUsage = budget2(outcomeValue.actualUsage, "Host outcome actualUsage", true);
  if (actualUsage.actions !== outcomeValue.performedActionCount) throw new Error("actualUsage.actions must equal performedActionCount.");
  const missingDimensions = Object.keys(envelope2.budget).filter((dimension) => !Object.hasOwn(actualUsage, dimension));
  if (missingDimensions.length) throw new Error(`actualUsage must report every budget dimension: ${missingDimensions.join(", ")}.`);
  const evidenceReturned = strings5(outcomeValue.evidenceReturned, "Host outcome evidenceReturned");
  const expected = new Set(envelope2.expectedEvidence);
  const unexpectedEvidence = evidenceReturned.filter((item) => !expected.has(item));
  const missingRequiredEvidence = envelope2.expectedEvidence.filter((item) => !evidenceReturned.includes(item));
  const facts = strings5(outcomeValue.facts, "Host outcome facts").map((fact, index) => assertExecutionFactText(fact, `Host outcome facts[${index}]`));
  if ((outcomeValue.claims ?? []).length) throw new Error("Host outcome cannot declare scientific claims.");
  const startedAt = outcomeIso(outcomeValue.startedAt, "Host outcome startedAt");
  const finishedAt = outcomeIso(outcomeValue.finishedAt, "Host outcome finishedAt");
  if (Date.parse(finishedAt) < Date.parse(startedAt) || Date.parse(startedAt) < Date.parse(envelope2.issuedAt) || Date.parse(finishedAt) >= Date.parse(envelope2.expiresAt) || Date.parse(finishedAt) > Date.parse(current.now)) throw new Error("Host outcome execution interval falls outside the sealed handoff window.");
  const scopeDeviationReasons = [...outcomeValue.performedActionCount > 1 ? ["performed-action-count-exceeded"] : [], ...Object.entries(actualUsage).filter(([dimension, amount]) => !Object.hasOwn(envelope2.budget, dimension) || amount > envelope2.budget[dimension]).map(([dimension]) => `budget-exceeded:${dimension}`), ...unexpectedEvidence.map((item) => `unexpected-evidence:${item}`)];
  return Object.freeze({ valid: scopeDeviationReasons.length === 0, status, performedActionCount: outcomeValue.performedActionCount, actualUsage: Object.freeze(actualUsage), evidenceReturned: Object.freeze(evidenceReturned), facts: Object.freeze(facts), claims: Object.freeze([]), startedAt, finishedAt, scopeDeviation: scopeDeviationReasons.length > 0, scopeDeviationReasons: Object.freeze(scopeDeviationReasons), missingRequiredEvidence: Object.freeze(missingRequiredEvidence), scientificConclusionAuthorized: false });
}

// src/core/workspace-init.mjs
import fs9 from "node:fs";
import path13 from "node:path";
var DOVE_INIT_PROPOSAL_VERSION = 2;
var DOVE_REVISE_MAINLINE_OPERATION = "revise-mainline";
var INIT_FIELDS = /* @__PURE__ */ new Set([
  "operation",
  "mainline",
  "changeReason",
  "archiveReset",
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "mutationMode",
  "workspaceId",
  "createdAt",
  "detectedState",
  "detectedSchema",
  "sourceIdentity",
  "sourceTreeDigest",
  "archiveTarget",
  "currentRevisionId",
  "currentRevisionDigest",
  "activeMissionIds"
]);
function assertPlainObject5(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function assertAllowed(args) {
  assertPlainObject5(args, "Dove workspace arguments");
  const unknown = Object.keys(args).filter((field) => !INIT_FIELDS.has(field));
  if (unknown.length > 0) throw new Error(`Dove workspace does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function text8(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function optionalReplayString(value, label) {
  if (value === null || value === void 0) return null;
  if (typeof value !== "string" || !value) throw new Error(`${label} must be a non-empty string or null.`);
  return value;
}
function operationFrom(args) {
  const operation = args.operation ?? "initialize";
  if (!["initialize", DOVE_REVISE_MAINLINE_OPERATION].includes(operation)) throw new Error("Dove workspace operation must be initialize or revise-mainline.");
  return operation;
}
function mutationModeFor(root, args) {
  const explicit = Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (explicit && active && explicit !== active) throw new Error(`Dove workspace mutationMode ${explicit} does not match the active MutationContext mode ${active}.`);
  return active ?? explicit ?? "direct-process";
}
function exactReplayInput(args) {
  const operation = operationFrom(args);
  return {
    operation,
    mainline: text8(args.mainline, "Dove workspace research mainline"),
    changeReason: text8(args.changeReason, "Dove workspace change reason"),
    archiveReset: args.archiveReset === true,
    confirmed: true,
    proposalVersion: args.proposalVersion,
    proposalWorkspace: optionalReplayString(args.proposalWorkspace, "proposalWorkspace"),
    proposalDigest: optionalReplayString(args.proposalDigest, "proposalDigest"),
    mutationMode: Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : "direct-process",
    workspaceId: optionalReplayString(args.workspaceId, "workspaceId"),
    createdAt: optionalReplayString(args.createdAt, "createdAt"),
    detectedState: optionalReplayString(args.detectedState, "detectedState"),
    detectedSchema: optionalReplayString(args.detectedSchema, "detectedSchema"),
    sourceIdentity: args.sourceIdentity ?? null,
    sourceTreeDigest: optionalReplayString(args.sourceTreeDigest, "sourceTreeDigest"),
    archiveTarget: optionalReplayString(args.archiveTarget, "archiveTarget"),
    currentRevisionId: optionalReplayString(args.currentRevisionId, "currentRevisionId"),
    currentRevisionDigest: optionalReplayString(args.currentRevisionDigest, "currentRevisionDigest"),
    activeMissionIds: Array.isArray(args.activeMissionIds) ? [...args.activeMissionIds] : []
  };
}
function assertArchiveTargetSafe(workspace, archiveTarget) {
  const archiveParent = path13.join(workspace, ".dove-archive");
  if (path13.dirname(archiveTarget) !== archiveParent) throw new Error("Dove archive target must be the deterministic workspace-local .dove-archive target.");
  if (!fs9.existsSync(archiveParent)) return;
  const parentStat = fs9.lstatSync(archiveParent);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) throw new Error("Dove archive parent .dove-archive must be a real workspace-local directory, not a symbolic link or file.");
}
function initializeProposal(root, args, workspace, replay) {
  const inspection = inspectDoveWorkspace(workspace);
  const archiveReset = args.archiveReset === true;
  if (archiveReset && inspection.state !== "absent") inspection.source = inspectDoveSourceTree(workspace);
  if (archiveReset) {
    if (inspection.state === "absent" || inspection.healthy) throw new Error("Dove workspace archive-reset applies only to an existing legacy or invalid .dove directory.");
  } else if (inspection.state !== "absent") {
    if (inspection.healthy) throw new Error("Dove workspace is already initialized. Use revise-mainline to change its research mainline.");
    throw workspaceSchemaError(inspection, "Dove workspace initialization");
  }
  const mainline = text8(args.mainline, "Dove workspace research mainline");
  const changeReason = typeof args.changeReason === "string" && args.changeReason.trim() ? args.changeReason.trim() : "Establish the initial research mainline.";
  const mutationMode2 = mutationModeFor(workspace, args);
  if (archiveReset && mutationMode2 === "patch-plan") throw new Error("Dove workspace archive-reset requires direct-process transaction semantics.");
  const workspaceId = replay?.workspaceId ?? (typeof args.workspaceId === "string" && args.workspaceId ? args.workspaceId : newWorkspaceId());
  const createdAt = replay?.createdAt ?? (typeof args.createdAt === "string" && args.createdAt ? args.createdAt : (/* @__PURE__ */ new Date()).toISOString());
  const archiveTarget = archiveReset ? archiveTargetFor({ workspace, detectedSchema: inspection.detectedSchema, treeDigest: inspection.source.treeDigest }) : null;
  if (archiveTarget) assertArchiveTargetSafe(workspace, archiveTarget);
  const documents = createMinimalWorkspaceDocuments({ workspaceId, mainline, changeReason, createdAt });
  return {
    envelope: {
      proposalVersion: DOVE_INIT_PROPOSAL_VERSION,
      operation: "initialize",
      workspace,
      mutationMode: mutationMode2,
      workspaceId,
      createdAt,
      mainline,
      changeReason,
      archiveReset,
      detectedState: inspection.state,
      detectedSchema: inspection.detectedSchema,
      sourceIdentity: inspection.source?.identity ?? null,
      sourceTreeDigest: inspection.source?.treeDigest ?? null,
      archiveTarget,
      currentRevisionId: null,
      currentRevisionDigest: null,
      activeMissionIds: [],
      newSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION
    },
    inspection,
    documents,
    workspaceRevision: documents.workspaceRevision,
    transitions: []
  };
}
function reviseProposal(root, args, workspace, replay) {
  if (args.archiveReset === true) throw new Error("revise-mainline does not accept archiveReset.");
  const opened = openDoveWorkspace(workspace, { operation: "Dove workspace mainline revision" });
  const current = opened.currentWorkspaceRevision;
  const mainline = text8(args.mainline, "Dove workspace research mainline");
  const changeReason = text8(args.changeReason, "Dove workspace mainline change reason");
  if (mainline === current.mainline) throw new Error("revise-mainline must change the research mainline.");
  const source = inspectDoveSourceTree(workspace);
  const mutationMode2 = mutationModeFor(workspace, args);
  const createdAt = replay?.createdAt ?? (typeof args.createdAt === "string" && args.createdAt ? args.createdAt : (/* @__PURE__ */ new Date()).toISOString());
  const workspaceRevision = createWorkspaceRevision({
    workspaceId: opened.manifest.workspaceId,
    revision: current.revision + 1,
    previousRevisionId: current.revisionId,
    previousRevisionDigest: current.revisionDigest,
    mainline,
    changeReason,
    createdAt
  });
  const activeMissions = [...opened.missions.values()].filter((mission) => mission.workspaceRevisionId === current.revisionId && !opened.missionTransitions.has(mission.missionId)).sort((left, right) => left.missionId.localeCompare(right.missionId));
  const transitions = activeMissions.map((mission) => createMissionTransition({
    workspaceId: opened.manifest.workspaceId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    workspaceRevisionId: current.revisionId,
    status: "stopped",
    reason: `The user explicitly changed the workspace research mainline: ${changeReason}`,
    evidenceRefs: [],
    trigger: "workspace-revision",
    createdAt
  }));
  return {
    envelope: {
      proposalVersion: DOVE_INIT_PROPOSAL_VERSION,
      operation: DOVE_REVISE_MAINLINE_OPERATION,
      workspace,
      mutationMode: mutationMode2,
      workspaceId: opened.manifest.workspaceId,
      createdAt,
      mainline,
      changeReason,
      archiveReset: false,
      detectedState: opened.state,
      detectedSchema: opened.detectedSchema,
      sourceIdentity: source.identity,
      sourceTreeDigest: source.treeDigest,
      archiveTarget: null,
      currentRevisionId: current.revisionId,
      currentRevisionDigest: current.revisionDigest,
      activeMissionIds: activeMissions.map((mission) => mission.missionId),
      newSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION
    },
    inspection: opened,
    documents: null,
    workspaceRevision,
    transitions
  };
}
function confirmArgs(envelope2, proposalDigest) {
  return {
    operation: envelope2.operation,
    mainline: envelope2.mainline,
    changeReason: envelope2.changeReason,
    archiveReset: envelope2.archiveReset,
    confirmed: true,
    proposalVersion: envelope2.proposalVersion,
    proposalWorkspace: envelope2.workspace,
    proposalDigest,
    mutationMode: envelope2.mutationMode,
    workspaceId: envelope2.workspaceId,
    createdAt: envelope2.createdAt,
    detectedState: envelope2.detectedState,
    detectedSchema: envelope2.detectedSchema,
    sourceIdentity: envelope2.sourceIdentity,
    sourceTreeDigest: envelope2.sourceTreeDigest,
    archiveTarget: envelope2.archiveTarget,
    currentRevisionId: envelope2.currentRevisionId,
    currentRevisionDigest: envelope2.currentRevisionDigest,
    activeMissionIds: envelope2.activeMissionIds
  };
}
function buildProposal(root, args = {}) {
  const workspace = canonicalWorkspacePath(root);
  const replay = args.confirmed === true ? exactReplayInput(args) : null;
  if (replay && replay.proposalVersion !== DOVE_INIT_PROPOSAL_VERSION) throw new Error("The selected Dove workspace proposal version is unsupported. Request a fresh proposal.");
  if (replay && replay.proposalWorkspace !== workspace) throw new Error("The selected Dove workspace proposal belongs to a different canonical workspace. Request a fresh proposal.");
  const operation = operationFrom(args);
  const proposal = operation === DOVE_REVISE_MAINLINE_OPERATION ? reviseProposal(root, args, workspace, replay) : initializeProposal(root, args, workspace, replay);
  proposal.proposalDigest = workspaceDigest(proposal.envelope);
  return proposal;
}
function proposalOperations(proposal) {
  if (proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION) {
    return [
      { type: "append-sealed-json", path: workspaceRevisionPath(proposal.workspaceRevision.revisionId) },
      ...proposal.transitions.map((transition) => ({ type: "append-sealed-json", path: missionTransitionPath(transition.transitionId) })),
      { type: "write-sealed-json", path: ARTIFACT_PATHS.projectIdentity }
    ];
  }
  const initialize = [
    ...MINIMAL_WORKSPACE_DIRECTORIES.map((relativePath) => ({ type: "create-directory", path: relativePath })),
    ...MINIMAL_WORKSPACE_REQUIRED_FILES.map((relativePath) => ({ type: relativePath === ARTIFACT_PATHS.lessonsDocument ? "write-markdown" : "write-sealed-json", path: relativePath })),
    { type: "write-sealed-json", path: workspaceRevisionPath(proposal.workspaceRevision.revisionId) }
  ];
  return proposal.envelope.archiveReset ? [{ type: "atomic-directory-rename", from: ".dove", to: path13.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path13.sep).join("/") }, ...initialize] : initialize;
}
function mutationPaths(proposal) {
  if (proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION) {
    return [workspaceRevisionPath(proposal.workspaceRevision.revisionId), ...proposal.transitions.map((transition) => missionTransitionPath(transition.transitionId)), ARTIFACT_PATHS.projectIdentity];
  }
  return [
    ...proposal.envelope.archiveReset ? [".dove", path13.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path13.sep).join("/")] : [],
    ...MINIMAL_WORKSPACE_REQUIRED_FILES,
    workspaceRevisionPath(proposal.workspaceRevision.revisionId)
  ];
}
function proposalResult(proposal) {
  const replay = confirmArgs(proposal.envelope, proposal.proposalDigest);
  const revise = proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION;
  return {
    status: "needs-confirmation",
    kind: revise ? "workspace-revision" : proposal.envelope.archiveReset ? "archive-reset" : "init",
    workspace: proposal.envelope.workspace,
    detectedSchemaState: { state: proposal.envelope.detectedState, detectedSchema: proposal.envelope.detectedSchema },
    source: proposal.envelope.archiveReset ? { path: ".dove", identity: proposal.envelope.sourceIdentity, treeDigest: proposal.envelope.sourceTreeDigest } : null,
    archiveTarget: proposal.envelope.archiveTarget,
    newSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION,
    operations: proposalOperations(proposal),
    proposalDigest: proposal.proposalDigest,
    approval: {
      required: true,
      noChangesApplied: true,
      summary: revise ? "Dove can append the user-approved research mainline revision while preserving the previous mission graph and scientific decisions." : proposal.envelope.archiveReset ? "Dove can replace invalid project records and establish the approved research mainline." : "Dove can create project records and establish the approved research mainline.",
      effects: revise ? ["Append one immutable workspace revision.", `Stop ${proposal.transitions.length} active mission${proposal.transitions.length === 1 ? "" : "s"} bound to the previous mainline.`, "Preserve all previous missions, evidence, artifacts, and lessons."] : proposal.envelope.archiveReset ? ["Archive the invalid Dove project records.", "Create clean minimal project records.", "Save the initial research mainline revision."] : ["Create minimal Dove project records.", "Save the initial research mainline revision."],
      question: revise ? "Apply this research mainline revision?" : proposal.envelope.archiveReset ? "Replace the invalid Dove project records and initialize this workspace?" : "Create Dove workspace records for this project?"
    },
    confirmation: { required: true, exactReplay: true, confirmArgs: replay },
    mutation: { mutationMode: proposal.envelope.mutationMode, writesApplied: false, paths: [] }
  };
}
function assertExactReplay(proposal, args) {
  const replay = exactReplayInput(args);
  const expected = confirmArgs(proposal.envelope, proposal.proposalDigest);
  if (stableWorkspaceSerialize(replay) !== stableWorkspaceSerialize(expected)) throw new Error("The selected Dove workspace proposal no longer matches the approved exact replay fields. Request a fresh proposal.");
  if (proposal.envelope.archiveReset && fs9.existsSync(proposal.envelope.archiveTarget)) throw new Error(`Archive target is already occupied: ${proposal.envelope.archiveTarget}. Request a fresh proposal.`);
}
function stageInitialization(context, proposal) {
  if (proposal.envelope.archiveReset) context.replaceDirectory(".dove", { archiveTarget: path13.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path13.sep).join("/") });
  else if (context.mutationMode === "direct-process") context.replaceDirectory(".dove");
  for (const relativePath of MINIMAL_WORKSPACE_DIRECTORIES) context.ensureDirectory(relativePath);
  context.writeJson(ARTIFACT_PATHS.doveRootManifest, proposal.documents.manifest);
  context.writeJson(ARTIFACT_PATHS.projectIdentity, proposal.documents.project);
  context.writeText(ARTIFACT_PATHS.lessonsDocument, DEFAULT_DOVE_LESSONS_MARKDOWN);
  context.writeJson(workspaceRevisionPath(proposal.workspaceRevision.revisionId), proposal.workspaceRevision);
}
function stageRevision(context, proposal) {
  const opened = openDoveWorkspace(proposal.envelope.workspace, { operation: "Confirmed Dove workspace mainline revision" });
  if (opened.currentWorkspaceRevision.revisionId !== proposal.envelope.currentRevisionId || opened.currentWorkspaceRevision.revisionDigest !== proposal.envelope.currentRevisionDigest) {
    throw new Error("The workspace mainline changed after approval. Request a fresh proposal.");
  }
  const activeMissionIds = [...opened.missions.values()].filter((mission) => mission.workspaceRevisionId === opened.currentWorkspaceRevision.revisionId && !opened.missionTransitions.has(mission.missionId)).map((mission) => mission.missionId).sort();
  if (stableWorkspaceSerialize(activeMissionIds) !== stableWorkspaceSerialize(proposal.envelope.activeMissionIds)) throw new Error("The active mission set changed after approval. Request a fresh proposal.");
  context.requireCommitPrecondition(ARTIFACT_PATHS.projectIdentity);
  context.requireCommitPrecondition(ARTIFACT_PATHS.workspaceRevisionsDir);
  context.requireCommitPrecondition(ARTIFACT_PATHS.missionTransitionsDir);
  context.writeJson(workspaceRevisionPath(proposal.workspaceRevision.revisionId), proposal.workspaceRevision);
  for (const transition of proposal.transitions) context.writeJson(missionTransitionPath(transition.transitionId), transition);
  context.writeJson(ARTIFACT_PATHS.projectIdentity, {
    ...opened.project,
    currentRevisionId: proposal.workspaceRevision.revisionId,
    currentRevisionDigest: proposal.workspaceRevision.revisionDigest,
    updatedAt: proposal.workspaceRevision.createdAt
  });
}
function initDoveWorkspace(root, args = {}) {
  assertAllowed(args);
  const proposal = buildProposal(root, args);
  if (args.confirmed !== true) return proposalResult(proposal);
  assertExactReplay(proposal, args);
  const context = currentMutationContext(root);
  if (!context) throw new Error("Confirmed Dove workspace change requires an active MutationContext.");
  const plannedOnly = context.mutationMode === "patch-plan";
  if (proposal.envelope.archiveReset && plannedOnly) throw new Error("Confirmed Dove archive-reset requires direct-process transaction semantics.");
  if (proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION) stageRevision(context, proposal);
  else stageInitialization(context, proposal);
  const paths2 = mutationPaths(proposal);
  return {
    status: plannedOnly ? proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION ? "revision-planned" : "initialization-planned" : proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION ? "revised" : proposal.envelope.archiveReset ? "archive-reset-complete" : "initialized",
    kind: proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION ? "workspace-revision" : proposal.envelope.archiveReset ? "archive-reset" : "init",
    workspaceRevision: proposal.workspaceRevision,
    stoppedMissionCount: proposal.transitions.length,
    ...proposal.documents ? { manifest: proposal.documents.manifest, project: proposal.documents.project } : {},
    archiveTarget: proposal.envelope.archiveTarget,
    mutation: { mutationMode: proposal.envelope.mutationMode, writesApplied: !plannedOnly, paths: plannedOnly ? [] : paths2 },
    writes: plannedOnly ? [] : paths2
  };
}

// src/core/mission-contracts.mjs
var MISSION_PROPOSAL_VERSION = 4;
var SAFE_ID12 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var FOUR_HOURS_MS = 4 * 60 * 60 * 1e3;
var CREATE_EXTRA_FIELDS = /* @__PURE__ */ new Set(["operation", "stopParentReason", "handoffArtifactPaths"]);
var REPLAY_FIELDS = /* @__PURE__ */ new Set(["confirmed", "proposalVersion", "proposalWorkspace", "proposalDigest", "mutationMode", "workspaceId", "workspaceRevisionId", "workspaceRevisionDigest", "createdAt", "decisionCreatedAt", "handoffIssuedAt", "handoffExpiresAt", "parentTransitionId", "artifactHandoffIds"]);
var AMBIENT_FIELDS = /* @__PURE__ */ new Set(["goal", "requirements", "assumptions", "scope", "outOfScope", "artifacts", "completionCriteria", "mode", "evidenceRequirements", "mainlineAlignment", "changesWorkspaceMainline"]);
var SKILL_START_FIELDS = /* @__PURE__ */ new Set(["operation", "skill", "goal", "requirements", "assumptions", "scope", "outOfScope", "artifacts", "completionCriteria", "evidenceRequirements", "parentMissionId", "contextArtifactPaths"]);
var WORKSPACE_FIELDS = /* @__PURE__ */ new Set(["operation", "projectBrief", "mainline", "changeReason", "archiveReset", "confirmed", "proposalVersion", "proposalWorkspace", "proposalDigest", "mutationMode", "workspaceId", "createdAt", "detectedState", "detectedSchema", "sourceIdentity", "sourceTreeDigest", "archiveTarget", "currentRevisionId", "currentRevisionDigest", "activeMissionIds"]);
var SKILL_ID_SET = new Set(DOVE_RESEARCH_SKILL_IDS);
function sha25610(value) {
  return crypto14.createHash("sha256").update(value).digest("hex");
}
function text9(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const result = value.trim();
  return result || fallback;
}
function plain6(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function allowed(value, fields, label) {
  plain6(value, `${label} arguments`);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function canonicalWorkspace(root) {
  return fs10.realpathSync.native(path14.resolve(root));
}
function slugify(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "mission";
}
function missionId(value, goal) {
  const id3 = text9(value, `mission-${slugify(goal)}-${sha25610(goal).slice(0, 10)}`);
  if (!SAFE_ID12.test(id3)) throw new Error("missionId must be a safe lowercase identifier.");
  return id3;
}
function missionPath(id3) {
  return path14.posix.join(ARTIFACT_PATHS.missionsDir, `${id3}.json`);
}
function addMilliseconds(timestamp3, milliseconds) {
  return new Date(Date.parse(timestamp3) + milliseconds).toISOString();
}
function nextCreatedAt(workspace) {
  const now = nowIso();
  const latest = [...workspace.missions.values()].reduce((value, mission) => mission.createdAt > value ? mission.createdAt : value, "");
  return latest && now <= latest ? addMilliseconds(latest, 1) : now;
}
function replayTimestamp(args, field, fallback, confirmed, label) {
  const supplied = text9(args[field], null);
  if (confirmed && !supplied) throw new Error(`Confirmed mission replay requires ${label}.`);
  const result = supplied ?? fallback;
  if (!Number.isFinite(Date.parse(result)) || new Date(Date.parse(result)).toISOString() !== result) throw new Error(`${label} must be an exact ISO timestamp.`);
  return result;
}
function mutationMode(root, args) {
  const explicit = Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (active && explicit && active !== explicit) throw new Error("Mission mutationMode does not match the active MutationContext.");
  return active ?? explicit ?? "direct-process";
}
function exists(root, relativePath) {
  return currentMutationContext(root)?.fileExists(relativePath) ?? fs10.existsSync(path14.join(root, relativePath));
}
function artifactIdentity(root, rawPath) {
  const normalized3 = normalizeProjectRelativePath(rawPath);
  if (!normalized3.ok) throw new Error(`Invalid mission artifact path: ${rawPath}.`);
  const relativePath = normalized3.normalizedPath;
  const fullPath = path14.join(root, relativePath);
  if (!fs10.existsSync(fullPath)) {
    resolveCanonicalContainedWrite(root, relativePath, { label: "Mission artifact path" });
    return { path: relativePath, exists: false };
  }
  const stat = fs10.lstatSync(fullPath);
  if (stat.isSymbolicLink()) throw new Error(`Mission artifacts must not be symbolic links: ${relativePath}.`);
  resolveCanonicalContainedWrite(root, relativePath, { label: "Mission artifact path" });
  return stat.isFile() ? { path: relativePath, exists: true, kind: "file", sizeBytes: stat.size, sha256: sha25610(fs10.readFileSync(fullPath)) } : { path: relativePath, exists: true, kind: stat.isDirectory() ? "directory" : "other" };
}
function normalizeHandoffPaths(value) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error("handoffArtifactPaths must be an array.");
  const result = value.map((item, index) => {
    const normalized3 = normalizeProjectRelativePath(item);
    if (!normalized3.ok || normalized3.normalizedPath !== item || artifactEvidenceRole(item) !== "external-project") throw new Error(`handoffArtifactPaths[${index}] must be a canonical external project path.`);
    return item;
  });
  if (new Set(result).size !== result.length) throw new Error("handoffArtifactPaths must not contain duplicates.");
  return result;
}
function branchRecords(workspace, content, args, createdAt) {
  if (!content.parentMissionId) {
    if (args.stopParentReason !== void 0 || args.handoffArtifactPaths !== void 0) throw new Error("Root mission creation must not declare parent handoff fields.");
    return { transition: null, artifactHandoffs: [] };
  }
  const parent = workspace.missions.get(content.parentMissionId);
  if (!parent) throw new Error(`Parent mission does not exist: ${content.parentMissionId}.`);
  const ordinaryChild = args.operation === "create-child";
  if (ordinaryChild) {
    if (args.stopParentReason !== void 0 || args.handoffArtifactPaths !== void 0) throw new Error("Ordinary child mission creation must not stop its parent or transfer artifact ownership.");
    return { transition: null, artifactHandoffs: [] };
  }
  const existingTransition = workspace.missionTransitions.get(parent.missionId) ?? null;
  const reason = text9(args.stopParentReason, null);
  if (!existingTransition && !reason) throw new Error("Branching from an active parent requires stopParentReason.");
  if (existingTransition && reason) throw new Error("A terminal parent must not be stopped again.");
  const transition = existingTransition ? null : createMissionTransition({ workspaceId: workspace.manifest.workspaceId, missionId: parent.missionId, contractDigest: parent.contractDigest, workspaceRevisionId: parent.workspaceRevisionId, status: "stopped", reason, evidenceRefs: [], trigger: "user", createdAt });
  const artifactHandoffs = normalizeHandoffPaths(args.handoffArtifactPaths).map((artifactPath) => {
    const owner = workspace.receiptLedger.currentOwnership.find((item) => item.path === artifactPath);
    if (!owner || owner.missionId !== parent.missionId) throw new Error(`Artifact ${artifactPath} is not owned by the parent mission.`);
    return createArtifactHandoff({ workspaceId: workspace.manifest.workspaceId, path: artifactPath, fromMissionId: parent.missionId, toMissionId: content.missionId, fromReceiptId: owner.receiptId, fromSha256: owner.sha256, reason: content.branchReason, createdAt });
  });
  return { transition, artifactHandoffs };
}
function buildProposal2(root, args) {
  const workspacePath = canonicalWorkspace(root);
  const opened = openDoveWorkspace(root, { operation: "Dove mission creation" });
  const revision = opened.currentWorkspaceRevision;
  const content = normalizeMissionContractContent(Object.fromEntries(Object.entries(args).filter(([field]) => !CREATE_EXTRA_FIELDS.has(field) && !REPLAY_FIELDS.has(field))));
  const id3 = missionId(args.missionId, content.goal);
  if (content.parentMissionId === id3) throw new Error("Mission must not be its own parent.");
  content.missionId = id3;
  if (args.confirmed && (args.workspaceId !== opened.manifest.workspaceId || args.workspaceRevisionId !== revision.revisionId || args.workspaceRevisionDigest !== revision.revisionDigest)) throw new Error("Mission replay no longer matches the current workspace revision.");
  const createdAt = replayTimestamp(args, "createdAt", nextCreatedAt(opened), args.confirmed === true, "mission createdAt");
  const persisted = { schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION, workspaceId: opened.manifest.workspaceId, workspaceRevisionId: revision.revisionId, workspaceRevisionDigest: revision.revisionDigest, missionId: id3, contractDigest: missionContractDigest(id3, content, { workspaceRevisionId: revision.revisionId, workspaceRevisionDigest: revision.revisionDigest }), createdAt, ...content };
  delete persisted.missionId;
  persisted.missionId = id3;
  validateMissionGraph([...opened.missions.values(), persisted].map((mission) => ({ filename: `${mission.missionId}.json`, mission })));
  const branch = branchRecords(opened, persisted, args, createdAt);
  let researchDecision = null;
  let researchHandoff = null;
  if (content.mode === "research") {
    const decisionCreatedAt = replayTimestamp(args, "decisionCreatedAt", createdAt, args.confirmed === true, "research decision createdAt");
    const handoffIssuedAt = replayTimestamp(args, "handoffIssuedAt", decisionCreatedAt, args.confirmed === true, "research handoff issuedAt");
    const handoffExpiresAt = replayTimestamp(args, "handoffExpiresAt", addMilliseconds(handoffIssuedAt, FOUR_HOURS_MS), args.confirmed === true, "research handoff expiresAt");
    if (decisionCreatedAt !== createdAt || handoffIssuedAt !== decisionCreatedAt || handoffExpiresAt !== addMilliseconds(handoffIssuedAt, FOUR_HOURS_MS)) throw new Error("Mission, initial decision, and handoff timestamps must use the canonical window.");
    researchDecision = createInitialMissionResearchDecision({ mission: persisted, createdAt: decisionCreatedAt });
    researchHandoff = createResearchHandoff(researchDecision, { issuedAt: handoffIssuedAt, expiresAt: handoffExpiresAt });
  }
  const targetIdentities = content.artifacts.map((item) => artifactIdentity(root, item.path));
  const mode = mutationMode(root, args);
  const creationOperation = args.operation ?? (content.parentMissionId ? "branch" : "create-root");
  const envelope2 = { proposalVersion: MISSION_PROPOSAL_VERSION, workspace: workspacePath, mutationMode: mode, workspaceSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION, workspaceId: opened.manifest.workspaceId, workspaceRevisionId: revision.revisionId, workspaceRevisionDigest: revision.revisionDigest, creationOperation, targetArtifactIdentities: targetIdentities, mission: persisted, ...researchDecision ? { researchDecision, researchHandoff } : {}, parentTransitionId: branch.transition?.transitionId ?? null, artifactHandoffIds: branch.artifactHandoffs.map((item) => item.handoffId) };
  return { workspace: workspacePath, opened, revision, mutationMode: mode, creationOperation, content, mission: persisted, researchDecision, researchHandoff, targetIdentities, branch, proposalDigest: sha25610(stableMissionSerialize(envelope2)) };
}
function confirmation(proposal) {
  return { confirmed: true, proposalVersion: MISSION_PROPOSAL_VERSION, proposalWorkspace: proposal.workspace, proposalDigest: proposal.proposalDigest, mutationMode: proposal.mutationMode, workspaceId: proposal.opened.manifest.workspaceId, workspaceRevisionId: proposal.revision.revisionId, workspaceRevisionDigest: proposal.revision.revisionDigest, createdAt: proposal.mission.createdAt, ...proposal.researchDecision ? { decisionCreatedAt: proposal.researchDecision.createdAt, handoffIssuedAt: proposal.researchHandoff.issuedAt, handoffExpiresAt: proposal.researchHandoff.expiresAt } : {}, parentTransitionId: proposal.branch.transition?.transitionId ?? null, artifactHandoffIds: proposal.branch.artifactHandoffs.map((item) => item.handoffId), operation: proposal.creationOperation, missionId: proposal.mission.missionId, ...proposal.content, ...proposal.branch.transition ? { stopParentReason: proposal.branch.transition.reason } : {}, ...proposal.branch.artifactHandoffs.length ? { handoffArtifactPaths: proposal.branch.artifactHandoffs.map((item) => item.path) } : {} };
}
function paths(proposal) {
  return [...proposal.branch.transition ? [missionTransitionPath(proposal.branch.transition.transitionId)] : [], ...proposal.branch.artifactHandoffs.map((item) => artifactHandoffPath(item.handoffId)), missionPath(proposal.mission.missionId), ...proposal.researchDecision ? [researchDecisionPath(proposal.researchDecision.decisionId)] : []];
}
var assertCurrentMissionContract2 = assertCurrentMissionContract;
function newMissionId() {
  return `mission-${crypto14.randomUUID()}`;
}
function normalizeSkillId(value) {
  const skill = text9(value, null);
  if (!SKILL_ID_SET.has(skill)) throw new Error(`Skill must be one of: ${DOVE_RESEARCH_SKILL_IDS.join(", ")}.`);
  return skill;
}
function normalizeContextArtifactPaths(value) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error("contextArtifactPaths must be an array.");
  const paths2 = value.map((item, index) => {
    const normalized3 = normalizeProjectRelativePath(item);
    if (!normalized3.ok || normalized3.normalizedPath !== item || artifactEvidenceRole(item) !== "external-project") throw new Error(`contextArtifactPaths[${index}] must be a canonical external project path.`);
    return item;
  });
  if (new Set(paths2).size !== paths2.length) throw new Error("contextArtifactPaths must not contain duplicates.");
  return paths2;
}
function skillParentMission(workspace, args) {
  const explicitParentId = text9(args.parentMissionId, null);
  const contextPaths = normalizeContextArtifactPaths(args.contextArtifactPaths);
  const owners = contextPaths.map((artifactPath) => workspace.receiptLedger.currentOwnership.find((item) => item.path === artifactPath) ?? null);
  if (owners.some((owner) => owner === null)) throw new Error("Each context artifact must have one current mission owner before it can select a parent.");
  const ownerIds = [...new Set(owners.map((owner) => owner.missionId))];
  if (ownerIds.length > 1) throw new Error("The supplied context artifacts do not identify one unambiguous parent mission.");
  if (explicitParentId) {
    const parent2 = workspace.missions.get(explicitParentId);
    if (!parent2) throw new Error("The selected parent mission is no longer available.");
    if (ownerIds.length === 1 && ownerIds[0] !== explicitParentId) throw new Error("The explicit parent hint conflicts with current context artifact ownership.");
    return parent2;
  }
  if (ownerIds.length === 0) return null;
  const parent = workspace.missions.get(ownerIds[0]);
  if (!parent) throw new Error("The supplied context artifacts refer to an unavailable parent mission.");
  return parent;
}
function startDoveSkillMission(root, args = {}) {
  assertGovernanceMutationRegistered("create-dove-mission", "guarded");
  allowed(args, SKILL_START_FIELDS, "Dove skill start");
  if (args.operation !== "start-skill") throw new Error("Dove skill start requires operation=start-skill.");
  if (!currentMutationContext(root)) throw new Error("Dove skill start requires an active MutationContext.");
  const skill = normalizeSkillId(args.skill);
  const goal = text9(args.goal, null);
  if (!goal) throw new Error("Dove skill start requires a bounded goal.");
  const workspace = openDoveWorkspace(root, { operation: "Dove skill mission routing" });
  const parent = skillParentMission(workspace, args);
  const contextPaths = normalizeContextArtifactPaths(args.contextArtifactPaths);
  const contractArgs = Object.fromEntries(Object.entries(args).filter(([field]) => !["operation", "skill", "parentMissionId", "contextArtifactPaths"].includes(field)));
  const proposal = createDoveMission(root, {
    ...contractArgs,
    operation: parent ? "create-child" : "create-root",
    missionId: newMissionId(),
    mode: "research",
    goal,
    ...parent ? { parentMissionId: parent.missionId, branchKind: "follow-up", branchReason: `Run the ${skill} research skill in service of the selected parent mission.` } : {},
    mutationMode: "direct-process"
  });
  const applied = createDoveMission(root, proposal.confirmation.confirmArgs);
  return {
    ...applied,
    operation: "start-skill",
    skill,
    ...skill === "review" ? { reviewMissionBinding: reviewMissionBinding(workspace, applied.mission) } : {},
    routing: { kind: parent ? "child" : "root", contextArtifactCount: contextPaths.length }
  };
}
function previewDoveMissionContract(root, args = {}) {
  allowed(args, new Set(MISSION_CONTRACT_INPUT_FIELDS), "Dove mission preview");
  const proposal = buildProposal2(root, args);
  return { status: "proposal", mission: proposal.mission, contractDigest: proposal.mission.contractDigest, confirmation: { required: false }, mutation: { mutationMode: proposal.mutationMode, writesApplied: false, paths: [] } };
}
function createDoveMission(root, args = {}) {
  assertGovernanceMutationRegistered("create-dove-mission", "guarded");
  const operation = args.operation ?? (args.parentMissionId ? "branch" : "create-root");
  if (operation === "reevaluate-research-decision") throw new Error("Research decision reevaluation must use its dedicated current operation.");
  if (!["create", "create-root", "create-child", "branch"].includes(operation)) throw new Error("create_dove_mission operation is unsupported.");
  allowed(args, /* @__PURE__ */ new Set([...MISSION_CONTRACT_INPUT_FIELDS, ...REPLAY_FIELDS, ...CREATE_EXTRA_FIELDS]), "create_dove_mission");
  const proposal = buildProposal2(root, args);
  if (!args.confirmed) return { status: "needs-confirmation", mission: proposal.mission, contractDigest: proposal.mission.contractDigest, approval: { required: true, noChangesApplied: true, summary: `Dove can save this immutable mission: ${proposal.mission.goal}`, effects: ["Bind the mission directly to the current workspace revision.", "Save one mission-owned delivery and evidence contract."], question: "Create this mission checkpoint?" }, confirmation: { required: true, exactReplay: true, confirmArgs: confirmation(proposal) }, mutation: { mutationMode: proposal.mutationMode, writesApplied: false, paths: [] } };
  if (!currentMutationContext(proposal.workspace)) throw new Error("Confirmed mission materialization requires an active MutationContext.");
  if (args.proposalVersion !== MISSION_PROPOSAL_VERSION || args.proposalWorkspace !== proposal.workspace || args.proposalDigest !== proposal.proposalDigest) throw new Error("The selected mission proposal no longer matches current state.");
  if (exists(root, missionPath(proposal.mission.missionId))) throw new Error(`Mission id already exists: ${proposal.mission.missionId}.`);
  if (proposal.branch.transition) writeJson(root, missionTransitionPath(proposal.branch.transition.transitionId), proposal.branch.transition);
  for (const item of proposal.branch.artifactHandoffs) writeJson(root, artifactHandoffPath(item.handoffId), item);
  writeJson(root, missionPath(proposal.mission.missionId), proposal.mission);
  if (proposal.researchDecision) writeJson(root, researchDecisionPath(proposal.researchDecision.decisionId), proposal.researchDecision);
  const planned = isPatchPlanMode(root);
  return { status: planned ? "materialization-planned" : "materialized", mission: proposal.mission, contractDigest: proposal.mission.contractDigest, ...proposal.researchDecision ? { currentResearchDecision: proposal.researchDecision, executionHandoff: proposal.researchHandoff } : {}, mutation: { mutationMode: proposal.mutationMode, writesApplied: !planned, paths: planned ? [] : paths(proposal) } };
}
function createAmbientDoveMission(root, args = {}) {
  assertGovernanceMutationRegistered("create-ambient-dove-mission", "guarded");
  allowed(args, AMBIENT_FIELDS, "create_ambient_dove_mission");
  if (!MISSION_MODES.includes(args.mode)) throw new Error(`Ambient mission creation requires explicit mode: ${MISSION_MODES.join(" or ")}.`);
  if (args.changesWorkspaceMainline !== false || !text9(args.mainlineAlignment, null)) throw new Error("Ambient mission creation requires current-mainline alignment and no mainline change.");
  const proposal = createDoveMission(root, { ...Object.fromEntries(Object.entries(args).filter(([field]) => !["mainlineAlignment", "changesWorkspaceMainline"].includes(field))), missionId: newMissionId(), operation: "create-root", mutationMode: "direct-process" });
  return createDoveMission(root, proposal.confirmation.confirmArgs);
}
function manageDoveWorkspace(root, args = {}) {
  assertGovernanceMutationRegistered("manage-dove-workspace", "guarded");
  allowed(args, WORKSPACE_FIELDS, "Dove workspace");
  if (!["set-mainline", "initialize", "revise-mainline"].includes(args.operation)) return initDoveWorkspace(root, args);
  if (args.operation !== "set-mainline") return initDoveWorkspace(root, args);
  const projectBrief = text9(args.projectBrief, null);
  const mainline = text9(args.mainline, null);
  if (!projectBrief || !mainline) throw new Error("Workspace mainline replacement requires projectBrief and mainline.");
  const inspection = openDoveWorkspace(root, { allowAbsent: true, operation: "Dove workspace mainline replacement" });
  const serviceArgs = { operation: inspection.state === "absent" ? "initialize" : "revise-mainline", mainline, ...inspection.state === "absent" ? {} : { changeReason: "Replace the current research mainline through /dove:workspace." }, mutationMode: "direct-process" };
  const proposal = initDoveWorkspace(root, serviceArgs);
  const applied = currentMutationContext(root) ? initDoveWorkspace(root, proposal.confirmation.confirmArgs) : runWithMutationContext(root, { actionId: "manage-dove-workspace", mutationMode: "direct-process", hostId: "service" }, () => initDoveWorkspace(root, proposal.confirmation.confirmArgs));
  return { ...applied, operation: "set-mainline", projectBrief };
}

// src/core/review-artifact-snapshot.mjs
import crypto15 from "node:crypto";
import fs11 from "node:fs";
import path15 from "node:path";
var HASH_PATTERN = /^[a-f0-9]{64}$/u;
function sha256Buffer(value) {
  return crypto15.createHash("sha256").update(value).digest("hex");
}
function sha256File(fullPath) {
  return sha256Buffer(fs11.readFileSync(fullPath));
}
function snapshotArtifactBuffer(root, relativePath, label = "artifact") {
  const normalized3 = normalizeProjectRelativePath(relativePath);
  if (!normalized3.ok) throw new Error(`${label} has an unsafe path ${relativePath}: ${normalized3.reason}.`);
  const suppliedPath = String(relativePath).trim().replace(/\\/gu, "/");
  if (normalized3.normalizedPath !== suppliedPath) throw new Error(`${label} must use a normalized project-relative path.`);
  const inspection = inspectDeclaredPath(root, suppliedPath, { requireNonEmpty: true });
  if (inspection.status !== "existing") throw new Error(`${label} is not a usable file at ${suppliedPath}: ${inspection.reason ?? inspection.status}.`);
  const canonicalPath4 = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath4 !== suppliedPath) throw new Error(`${label} must use its canonical realpath and cannot use an internal alias.`);
  const mutationContext = currentMutationContext(root);
  let content;
  if (mutationContext && typeof mutationContext.readFileSnapshot === "function") {
    const snapshot = mutationContext.readFileSnapshot(canonicalPath4);
    if (!snapshot.exists || snapshot.type !== "file" || !snapshot.buffer) throw new Error(`${label} must be an existing regular file.`);
    content = Buffer.from(snapshot.buffer);
  } else {
    if (mutationContext) mutationContext.requireCommitPrecondition(canonicalPath4);
    content = fs11.readFileSync(path15.resolve(root, canonicalPath4));
  }
  if (content.byteLength === 0) throw new Error(`${label} must be a non-empty regular file.`);
  return { path: canonicalPath4, content, sizeBytes: content.byteLength, sha256: sha256Buffer(content) };
}
function stableSnapshotSetHash(snapshots = []) {
  const canonical = [...snapshots].map(({ path: artifactPath, sizeBytes, sha256: sha25613 }) => ({ path: artifactPath, sizeBytes, sha256: sha25613 })).sort((left, right) => left.path.localeCompare(right.path));
  return sha256Buffer(`${JSON.stringify(canonical)}
`);
}
function canonicalReviewArtifactPath(root, relativePath, label = "review artifact") {
  const normalized3 = normalizeProjectRelativePath(relativePath);
  if (!normalized3.ok) throw new Error(`${label} has an unsafe path ${relativePath}: ${normalized3.reason}.`);
  const suppliedPath = String(relativePath).trim().replace(/\\/gu, "/");
  if (normalized3.normalizedPath !== suppliedPath) throw new Error(`${label} must use a normalized project-relative path.`);
  const inspection = inspectDeclaredPath(root, normalized3.normalizedPath, { requireNonEmpty: true, rejectBookkeeping: true });
  if (inspection.status !== "existing") throw new Error(`${label} is not a usable file at ${normalized3.normalizedPath}: ${inspection.reason ?? inspection.status}.`);
  const canonicalPath4 = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath4 !== normalized3.normalizedPath) throw new Error(`${label} must use its canonical realpath and cannot use an internal alias.`);
  return canonicalPath4;
}
function resolveReviewArtifactSnapshots(root, missionId2, relativePaths, label = "reviewed artifacts", options = {}) {
  if (!Array.isArray(relativePaths)) throw new Error(`${label} must be an array of project-relative paths.`);
  const ownership = readArtifactOwnership(root);
  const ownerByPath = new Map(ownership.artifacts.map((item) => [item.path, item]));
  const missionGraph = options.missionGraph;
  const snapshots = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, relativePath] of relativePaths.entries()) {
    if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error(`${label}[${index}] must be a non-empty path.`);
    const canonicalPath4 = canonicalReviewArtifactPath(root, relativePath, `${label}[${index}]`);
    if (seen.has(canonicalPath4)) continue;
    seen.add(canonicalPath4);
    const owner = ownerByPath.get(canonicalPath4);
    if (!owner) throw new Error(`${label}[${index}] is not a registered current-schema artifact: ${canonicalPath4}.`);
    if (!missionCanReadMission(missionGraph, missionId2, owner.missionId)) throw new Error(`${label}[${index}] belongs to mission ${owner.missionId}, which is not ${missionId2} or one of its ancestors.`);
    const inspection = inspectDeclaredPath(root, canonicalPath4, { requireNonEmpty: true, rejectBookkeeping: true });
    const snapshot = {
      path: canonicalPath4,
      sizeBytes: inspection.sizeBytes,
      sha256: sha256File(path15.resolve(root, canonicalPath4))
    };
    if (options.requireOwnershipCurrent !== false && snapshot.sha256 !== owner.sha256) {
      throw new Error(`${label}[${index}] has changed since its latest ownership receipt: ${canonicalPath4}.`);
    }
    snapshots.push(snapshot);
  }
  if (snapshots.length === 0) throw new Error(`${label} requires at least one existing non-empty non-bookkeeping mission-owned artifact.`);
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { reviewedArtifacts: snapshots, reviewedArtifactSetSha256: stableSnapshotSetHash(snapshots) };
}
function normalizeReviewSnapshots(value, label = "reviewedArtifacts") {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, snapshots: [], reason: `${label} must contain artifact snapshots` };
  const snapshots = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, snapshots: [], reason: `${label}[${index}] must be an object` };
    if (Object.keys(item).some((field) => !["path", "sizeBytes", "sha256"].includes(field))) return { ok: false, snapshots: [], reason: `${label}[${index}] has unknown fields` };
    const normalized3 = normalizeProjectRelativePath(item.path);
    if (!normalized3.ok || normalized3.normalizedPath !== item.path || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !HASH_PATTERN.test(String(item.sha256 ?? ""))) {
      return { ok: false, snapshots: [], reason: `${label}[${index}] is invalid` };
    }
    if (seen.has(item.path)) return { ok: false, snapshots: [], reason: `${label} contains duplicate paths` };
    seen.add(item.path);
    snapshots.push({ path: item.path, sizeBytes: item.sizeBytes, sha256: item.sha256 });
  }
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { ok: true, snapshots, reason: null };
}
function verifyReviewSnapshotSet(root, preparedSnapshots, expectedSetHash) {
  const normalized3 = normalizeReviewSnapshots(preparedSnapshots);
  const failures = [];
  if (!normalized3.ok) return { ok: false, failures: [normalized3.reason], reviewedArtifacts: [], reviewedArtifactSetSha256: null };
  const setHash = stableSnapshotSetHash(normalized3.snapshots);
  if (setHash !== expectedSetHash) failures.push("reviewed-artifact-set-hash-mismatch");
  for (const prepared of normalized3.snapshots) {
    const inspection = inspectDeclaredPath(root, prepared.path, { requireNonEmpty: true, rejectBookkeeping: true });
    if (inspection.status !== "existing") {
      failures.push(`reviewed-artifact-${inspection.status}:${prepared.path}`);
      continue;
    }
    const canonicalPath4 = inspection.canonicalRelativePath ?? inspection.normalizedPath;
    if (inspection.normalizedPath !== prepared.path || canonicalPath4 !== prepared.path) {
      failures.push(`reviewed-artifact-path-changed:${prepared.path}`);
      continue;
    }
    const current = { path: canonicalPath4, sizeBytes: inspection.sizeBytes, sha256: sha256File(path15.resolve(root, canonicalPath4)) };
    if (JSON.stringify(current) !== JSON.stringify(prepared)) failures.push(`reviewed-artifact-changed:${prepared.path}`);
  }
  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    reviewedArtifacts: normalized3.snapshots,
    reviewedArtifactSetSha256: setHash
  };
}

// src/core/domain-artifacts.mjs
var SAFE_ID13 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
function domainSafeId(value, label) {
  const normalized3 = typeof value === "string" ? value.trim() : "";
  if (!SAFE_ID13.test(normalized3)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized3;
}
function domainNonEmptyText(value, label) {
  const normalized3 = typeof value === "string" ? value.trim() : "";
  if (!normalized3) throw new Error(`${label} must be a non-empty string.`);
  return normalized3;
}
function domainStringArray(value, label, options = {}) {
  const source = value === void 0 ? [] : value;
  if (!Array.isArray(source)) throw new Error(`${label} must be an array of non-empty strings.`);
  const items = source.map((item, index) => domainNonEmptyText(item, `${label}[${index}]`));
  if (new Set(items).size !== items.length) throw new Error(`${label} must not contain duplicates.`);
  if (options.minItems && items.length < options.minItems) throw new Error(`${label} must contain at least ${options.minItems} item(s).`);
  return items;
}
function assertSealedDomainArgs(args, fields, label) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error(`${label} arguments must be a plain object.`);
  const unknown = Object.keys(args).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function domainJson(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}
function domainSha256(value) {
  return crypto16.createHash("sha256").update(value).digest("hex");
}
function readCurrentMission(root, missionId2, operation = "Domain workflow") {
  const workspace = openDoveWorkspace(root, { operation });
  const normalizedMissionId = domainSafeId(missionId2, "missionId");
  const relativePath = path16.posix.join(ARTIFACT_PATHS.missionsDir, `${normalizedMissionId}.json`);
  const fullPath = path16.resolve(root, relativePath);
  if (!fs12.existsSync(fullPath)) throw new Error(`Mission does not exist: ${normalizedMissionId}.`);
  const mission = readJson(root, relativePath, null);
  const current = assertCurrentMissionContract2(mission);
  if (mission.workspaceId !== workspace.manifest.workspaceId) throw new Error(`Mission ${normalizedMissionId} belongs to a different workspace.`);
  return { workspace, mission, current, relativePath };
}
function canonicalDomainPath(rawPath, label, requiredPrefix = null) {
  const normalized3 = normalizeProjectRelativePath(rawPath);
  if (!normalized3.ok) throw new Error(`${label} has an unsafe path: ${normalized3.reason}.`);
  const supplied = String(rawPath).trim().replace(/\\/gu, "/");
  if (normalized3.normalizedPath !== supplied) throw new Error(`${label} must use a canonical project-relative path.`);
  if (requiredPrefix && normalized3.normalizedPath !== requiredPrefix && !normalized3.normalizedPath.startsWith(`${requiredPrefix}/`)) {
    throw new Error(`${label} must stay under ${requiredPrefix}.`);
  }
  return normalized3.normalizedPath;
}
function currentFileHash(root, relativePath, label) {
  const inspection = inspectDeclaredPath(root, relativePath, { requireNonEmpty: true });
  if (inspection.status !== "existing") throw new Error(`${label} must reference an existing non-empty regular file (${inspection.reason ?? inspection.status}).`);
  const canonicalPath4 = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath4 !== relativePath) throw new Error(`${label} must use the canonical realpath-contained path.`);
  return { path: canonicalPath4, sha256: sha256File(path16.resolve(root, canonicalPath4)) };
}
function isDoveLessonArtifactPath(rawPath) {
  const normalized3 = normalizeProjectRelativePath(rawPath);
  return normalized3.ok && normalized3.normalizedPath === ARTIFACT_PATHS.lessonsDocument;
}
function assertNotDoveLessonArtifactPath(rawPath, label = "artifact") {
  if (isDoveLessonArtifactPath(rawPath)) {
    throw new Error(`${label} must not use a Dove lesson as substantive artifact or evidence.`);
  }
}
function resolveMissionArtifactReferences(root, missionId2, references = [], label = "artifactRefs") {
  const normalized3 = domainStringArray(references, label);
  if (normalized3.length === 0) return [];
  const { workspace, mission } = readCurrentMission(root, missionId2, label);
  const byPath = new Map(workspace.receiptLedger.currentOwnership.map((item) => [item.path, item]));
  return normalized3.map((rawPath, index) => {
    const artifactPath = canonicalDomainPath(rawPath, `${label}[${index}]`);
    assertNotDoveLessonArtifactPath(artifactPath, `${label}[${index}]`);
    const owner = byPath.get(artifactPath);
    if (!owner) throw new Error(`${label}[${index}] is not a registered current-schema artifact: ${artifactPath}.`);
    if (!missionCanReadMission(workspace.missionGraph, mission.missionId, owner.missionId)) {
      throw new Error(`${label}[${index}] belongs to mission ${owner.missionId}, which is not this mission or an ancestor of ${mission.missionId}.`);
    }
    const current = currentFileHash(root, artifactPath, `${label}[${index}]`);
    if (current.sha256 !== owner.sha256) throw new Error(`${label}[${index}] has changed since its latest ownership receipt: ${artifactPath}.`);
    return { ...owner, ...current };
  });
}
function resolveMissionValidationReference(root, missionId2, rawPath, label = "validation reference") {
  const { workspace, mission } = readCurrentMission(root, missionId2, label);
  const validationPath = canonicalDomainPath(rawPath, label);
  const receipt = workspace.receiptLedger.receipts.toReversed().find(
    (item) => missionCanReadMission(workspace.missionGraph, mission.missionId, item.missionId) && item.validations.some((validation2) => validation2.reference === validationPath)
  );
  const validation = receipt?.validations.find((item) => item.reference === validationPath);
  if (!validation) throw new Error(`${label} is not current mission-bound validation evidence: ${validationPath}.`);
  const current = currentFileHash(root, validationPath, label);
  if (current.sha256 !== validation.outputHash) throw new Error(`${label} has changed since its validation receipt: ${validationPath}.`);
  return { reference: validationPath, outputHash: validation.outputHash, receiptId: receipt.receiptId };
}
function normalizeWrite(root, missionId2, item, index, options = {}) {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`domainWrites[${index}] must be an object.`);
  const relativePath = canonicalDomainPath(item.path, `domainWrites[${index}].path`, ".dove");
  const isLesson = isDoveLessonArtifactPath(relativePath);
  if (isLesson) throw new Error(`domainWrites[${index}].path must not use the advisory Lessons document as a domain artifact.`);
  const kind = domainNonEmptyText(item.kind, `domainWrites[${index}].kind`);
  if (!["report", "document", "code", "data", "figure", "media", "other"].includes(kind)) throw new Error(`domainWrites[${index}].kind is unsupported.`);
  const content = Buffer.isBuffer(item.content) ? item.content : Buffer.from(String(item.content ?? ""), "utf8");
  if (content.byteLength === 0) throw new Error(`domainWrites[${index}].content must be non-empty.`);
  const context = currentMutationContext(root);
  context.resolve(relativePath);
  if (Buffer.isBuffer(item.content) && isPatchPlanMode(root) && path16.extname(relativePath).toLowerCase() !== ".svg") {
    throw new Error(`domainWrites[${index}] patch-plan cannot safely represent binary artifact ${relativePath}; import PNG, JPEG, or PDF output in direct-process mode.`);
  }
  const derivedReferences = domainStringArray(item.derivedReferences, `domainWrites[${index}].derivedReferences`);
  return {
    path: relativePath,
    kind,
    content,
    encoding: Buffer.isBuffer(item.content) ? "binary" : "utf8",
    sha256: domainSha256(content),
    missionId: missionId2,
    derivedReferences
  };
}
function assertWritableOwnedArtifacts(root, workspace, mission, actionId, writes, options = {}) {
  const context = currentMutationContext(root);
  const ownershipBeforeWrite = readArtifactOwnership(root);
  const ownerByPath = new Map(ownershipBeforeWrite.artifacts.map((item) => [item.path, item]));
  for (const item of writes) {
    if (!context.fileExists(item.path)) continue;
    if (isDoveLessonArtifactPath(item.path)) {
      throw new Error(`${actionId} refuses to overwrite immutable lesson artifact ${item.path}.`);
    }
    const owner = ownerByPath.get(item.path);
    if (!owner && options.allowUnownedBookkeepingPaths?.has(item.path)) continue;
    if (!owner) throw new Error(`${actionId} refuses to overwrite unowned existing artifact ${item.path}.`);
    const ownerReceipt = workspace.receiptLedger.receipts.find((receipt) => receipt.receiptId === owner.receiptId);
    if (ownerReceipt?.producer?.kind === "dove-internal" && ownerReceipt.producer.actionId === "archive-review-record") {
      throw new Error(`${actionId} refuses to overwrite immutable review archive ${item.path}.`);
    }
    if (owner.missionId !== mission.missionId && !handoffAuthorizes(workspace.artifactHandoffs, item.path, owner.missionId, mission.missionId, owner.receiptId, owner.sha256)) {
      throw new Error(`${actionId} refuses to overwrite artifact ${item.path} without an explicit handoff from mission ${owner.missionId}.`);
    }
    const current = currentFileHash(root, item.path, item.path);
    if (current.sha256 !== owner.sha256) throw new Error(`${actionId} refuses to overwrite drifted artifact ${item.path}.`);
  }
}
function writeNormalizedDomainArtifacts(root, writes) {
  const context = currentMutationContext(root);
  for (const item of writes) {
    if (item.encoding === "binary") {
      if (isPatchPlanMode(root)) writeText(root, item.path, item.content.toString("utf8"));
      else context.writeBinary(item.path, item.content);
    } else writeText(root, item.path, item.content.toString("utf8"));
  }
}
function stageConsolidatedDomainMutation(root, options = {}) {
  const actionId = domainNonEmptyText(options.actionId, "actionId");
  assertGovernanceMutationRegistered(actionId, options.governanceMode ?? "guarded");
  const context = currentMutationContext(root);
  if (!context) throw new Error(`${actionId} requires an active MutationContext.`);
  if (context.mutationMode !== "direct-process") throw new Error(`${actionId} consolidated staging requires direct-process transaction semantics.`);
  const { workspace, mission } = readCurrentMission(root, options.missionId, options.operation ?? actionId);
  assertMissionAcceptsWrites(workspace, mission, { receipt: true });
  const rawWrites = Array.isArray(options.writes) ? options.writes : [];
  const writes = rawWrites.map((item, index) => normalizeWrite(root, mission.missionId, item, index));
  const externalArtifacts = Array.isArray(options.externalArtifacts) ? options.externalArtifacts : [];
  const validations = (Array.isArray(options.validations) ? options.validations : []).map((item, index) => createValidationRecord(item, { label: `${actionId}.validations[${index}]` }));
  const allArtifactPaths = [...externalArtifacts.map((item) => item.path), ...writes.map((item) => item.path)];
  const duplicatePath = allArtifactPaths.find((item, index, items) => items.indexOf(item) !== index);
  if (duplicatePath) throw new Error(`${actionId} contains duplicate artifact path ${duplicatePath}.`);
  const validationPaths = validations.map((item) => item.reference);
  const duplicateValidation = validationPaths.find((item, index, items) => items.indexOf(item) !== index);
  if (duplicateValidation) throw new Error(`${actionId} contains duplicate validation path ${duplicateValidation}.`);
  const overlap = validationPaths.find((item) => allArtifactPaths.includes(item));
  if (overlap) throw new Error(`${actionId} artifact and validation paths must be canonically distinct: ${overlap}.`);
  assertWritableOwnedArtifacts(root, workspace, mission, actionId, writes);
  if (allArtifactPaths.length === 0 && validations.length === 0) {
    return { receipt: null, artifacts: [], writes: [] };
  }
  context.requireCommitPrecondition(ARTIFACT_PATHS.executionReceiptsDir);
  context.requireCommitLock(".dove/.receipt-ledger-append.lock", { label: "Execution receipt ledger append lock" });
  const receiptId = domainSafeId(options.receiptId, "receiptId");
  const receiptPath2 = path16.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
  if (context.fileExists(receiptPath2)) throw new Error(`Execution receipt id is already occupied: ${receiptId}.`);
  const producedAt = domainNonEmptyText(options.producedAt, "producedAt");
  const recordedAt = nowIso();
  const baseReceipt = {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    receiptId,
    ledgerSequence: workspace.receiptLedger.nextLedgerSequence,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    summary: domainNonEmptyText(options.summary, "summary"),
    artifacts: [
      ...externalArtifacts.map((item) => ({ path: item.path, kind: item.kind ?? "other", sha256: item.sha256 })),
      ...writes.map((item) => ({ path: item.path, kind: item.kind, sha256: item.sha256 }))
    ],
    validations,
    criteriaSatisfied: [],
    producedAt,
    recordedAt,
    producer: { kind: "dove-internal", actionId }
  };
  const explicitReferences = new Map([
    ...externalArtifacts.map((item) => [item.path, item.derivedReferences ?? []]),
    ...writes.map((item) => [item.path, item.derivedReferences])
  ]);
  const receipt = { ...baseReceipt, artifacts: deriveArtifactReferences(baseReceipt, explicitReferences) };
  assertReceiptAppendable(workspace.receiptLedger, receipt, { artifactHandoffs: workspace.artifactHandoffs });
  writeNormalizedDomainArtifacts(root, writes);
  writeJson(root, receiptPath2, receipt);
  return {
    receipt,
    artifacts: receipt.artifacts,
    writes: [...writes.map((item) => item.path), receiptPath2]
  };
}
function finalizeDomainArtifacts(root, options = {}) {
  const actionId = domainNonEmptyText(options.actionId, "actionId");
  assertGovernanceMutationRegistered(actionId, options.governanceMode ?? "guarded");
  const context = currentMutationContext(root);
  if (!context) throw new Error(`${actionId} requires an active MutationContext.`);
  const { workspace, mission } = readCurrentMission(root, options.missionId, options.operation ?? actionId);
  assertMissionAcceptsWrites(workspace, mission);
  context.requireCommitPrecondition(ARTIFACT_PATHS.executionReceiptsDir);
  context.requireCommitLock(".dove/.receipt-ledger-append.lock", { label: "Execution receipt ledger append lock" });
  if (!Array.isArray(options.writes) || options.writes.length === 0) throw new Error(`${actionId} requires at least one real domain artifact write.`);
  const writes = options.writes.map((item, index) => normalizeWrite(root, mission.missionId, item, index));
  const duplicatePath = writes.map((item) => item.path).find((item, index, items) => items.indexOf(item) !== index);
  if (duplicatePath) throw new Error(`${actionId} contains duplicate artifact path ${duplicatePath}.`);
  const receiptId = options.receiptId === void 0 ? `receipt-${actionId}-${crypto16.randomUUID()}` : domainSafeId(options.receiptId, "receiptId");
  const receiptPath2 = path16.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
  if (context.fileExists(receiptPath2)) throw new Error(`Generated execution receipt id is occupied: ${receiptId}.`);
  const ownershipBeforeWrite = readArtifactOwnership(root);
  const ownerByPath = new Map(ownershipBeforeWrite.artifacts.map((item) => [item.path, item]));
  for (const item of writes) {
    if (!context.fileExists(item.path)) continue;
    if (isDoveLessonArtifactPath(item.path)) {
      throw new Error(`${actionId} refuses to overwrite immutable lesson artifact ${item.path}.`);
    }
    const owner = ownerByPath.get(item.path);
    if (!owner) throw new Error(`${actionId} refuses to overwrite unowned existing artifact ${item.path}.`);
    const ownerReceipt = workspace.receiptLedger.receipts.find((receipt2) => receipt2.receiptId === owner.receiptId);
    if (ownerReceipt?.producer?.kind === "dove-internal" && ownerReceipt.producer.actionId === "archive-review-record") {
      throw new Error(`${actionId} refuses to overwrite immutable review archive ${item.path}.`);
    }
    if (owner.missionId !== mission.missionId && !handoffAuthorizes(workspace.artifactHandoffs, item.path, owner.missionId, mission.missionId, owner.receiptId, owner.sha256)) {
      throw new Error(`${actionId} refuses to overwrite artifact ${item.path} without an explicit handoff from mission ${owner.missionId}.`);
    }
    const current = currentFileHash(root, item.path, item.path);
    if (current.sha256 !== owner.sha256) throw new Error(`${actionId} refuses to overwrite drifted artifact ${item.path}.`);
  }
  const artifacts = writes.map(({ path: artifactPath, kind, sha256: sha25613 }) => ({ path: artifactPath, kind, sha256: sha25613 }));
  const completionEligible = false;
  const criteriaSatisfied = [];
  const recordedAt = nowIso();
  const baseReceipt = {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    receiptId,
    ledgerSequence: workspace.receiptLedger.nextLedgerSequence,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    summary: domainNonEmptyText(options.summary, "summary"),
    artifacts,
    validations: [],
    criteriaSatisfied,
    producedAt: recordedAt,
    recordedAt,
    producer: { kind: "dove-internal", actionId }
  };
  const receipt = {
    ...baseReceipt,
    artifacts: deriveArtifactReferences(baseReceipt, new Map(writes.map((item) => [item.path, item.derivedReferences])))
  };
  assertReceiptAppendable(workspace.receiptLedger, receipt, { artifactHandoffs: workspace.artifactHandoffs });
  for (const item of writes) {
    if (item.encoding === "binary") {
      if (isPatchPlanMode(root)) {
        writeText(root, item.path, item.content.toString("utf8"));
      } else {
        context.writeBinary(item.path, item.content);
      }
    } else writeText(root, item.path, item.content.toString("utf8"));
  }
  writeJson(root, receiptPath2, receipt);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "planned" : "recorded",
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    receipt,
    artifacts,
    completionEligible,
    mutation: {
      mutationMode: context.mutationMode,
      writesApplied: !plannedOnly,
      paths: [...writes.map((item) => item.path), receiptPath2]
    }
  };
}

// src/core/source-trust.mjs
import fs13 from "node:fs";
import path17 from "node:path";
var SOURCE_SCHEMA_VERSION = 3;
var SOURCE_LIFECYCLE_STATES = Object.freeze(["candidate", "rejected"]);
var SOURCE_USE_LIMITATION = "Captured source material is current but not independently verified.";
var HASH10 = /^[0-9a-f]{64}$/u;
var SOURCE_FIELDS2 = /* @__PURE__ */ new Set([
  "schemaVersion",
  "sourceId",
  "missionId",
  "contractDigest",
  "citationKey",
  "title",
  "authors",
  "year",
  "locator",
  "sourceType",
  "abstract",
  "origin",
  "capturedMaterial",
  "lifecycle",
  "currentDecision",
  "useLimitation"
]);
var MATERIAL_FIELDS = /* @__PURE__ */ new Set(["path", "sizeBytes", "sha256", "capturedAt"]);
var CANDIDATE_FIELDS = /* @__PURE__ */ new Set(["decision", "decidedAt", "reason"]);
var REJECTED_FIELDS = /* @__PURE__ */ new Set(["decision", "method", "checkedMaterial", "auditEvidence", "decidedAt"]);
var AUDIT_FIELDS = /* @__PURE__ */ new Set(["reference", "kind", "observation"]);
var REGISTER_FIELDS = /* @__PURE__ */ new Set(["missionId", "sourceId", "citationKey", "title", "authors", "year", "locator", "sourceType", "abstract", "origin", "capturePath"]);
var REJECT_FIELDS = /* @__PURE__ */ new Set(["missionId", "sourceId", "method", "checkedMaterial", "auditEvidence"]);
var QUERY_FIELDS = /* @__PURE__ */ new Set(["missionId", "sourceId", "lifecycle", "limit"]);
function text10(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
}
function sealed7(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  return value;
}
function timestamp2(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value;
}
function sourcePath(id3) {
  return path17.posix.join(".dove/sources", `${id3}.json`);
}
function materialSnapshot(root, rawPath, includeContent = false) {
  const canonical = canonicalDomainPath(rawPath, "capturePath");
  const snapshot = snapshotArtifactBuffer(root, canonical, "capturePath");
  return includeContent ? snapshot : { path: snapshot.path, sizeBytes: snapshot.sizeBytes, sha256: snapshot.sha256 };
}
function validateStoredSource(root, source, filename, missions, label) {
  sealed7(source, SOURCE_FIELDS2, label);
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  const sourceId = domainSafeId(source.sourceId, `${label}.sourceId`);
  if (filename !== `${sourceId}.json`) throw new Error(`${label} filename must match sourceId.`);
  const missionId2 = domainSafeId(source.missionId, `${label}.missionId`);
  const mission = missions.get(missionId2);
  if (!mission || source.contractDigest !== mission.contractDigest || !HASH10.test(String(source.contractDigest))) throw new Error(`${label}.contractDigest does not match its mission.`);
  if (!source.title && !source.locator) throw new Error(`${label} requires a title or locator.`);
  domainStringArray(source.authors, `${label}.authors`);
  if (!SOURCE_LIFECYCLE_STATES.includes(source.lifecycle)) throw new Error(`${label}.lifecycle is unsupported.`);
  if (source.useLimitation !== SOURCE_USE_LIMITATION) throw new Error(`${label}.useLimitation must preserve the explicit independent-verification limitation.`);
  sealed7(source.capturedMaterial, MATERIAL_FIELDS, `${label}.capturedMaterial`);
  const materialPath = canonicalDomainPath(source.capturedMaterial.path, `${label}.capturedMaterial.path`, ".dove/sources/materials");
  if (!HASH10.test(String(source.capturedMaterial.sha256)) || !Number.isSafeInteger(source.capturedMaterial.sizeBytes) || source.capturedMaterial.sizeBytes < 1) throw new Error(`${label}.capturedMaterial is invalid.`);
  timestamp2(source.capturedMaterial.capturedAt, `${label}.capturedMaterial.capturedAt`);
  const material = materialSnapshot(root, materialPath, true);
  if (material.path !== materialPath || material.sha256 !== source.capturedMaterial.sha256 || material.sizeBytes !== source.capturedMaterial.sizeBytes) throw new Error(`${label}.capturedMaterial is missing, aliased, empty, size-drifted, or hash-drifted.`);
  sealed7(source.currentDecision, source.lifecycle === "candidate" ? CANDIDATE_FIELDS : REJECTED_FIELDS, `${label}.currentDecision`);
  if (source.currentDecision.decision !== source.lifecycle) throw new Error(`${label}.currentDecision does not match lifecycle.`);
  timestamp2(source.currentDecision.decidedAt, `${label}.currentDecision.decidedAt`);
  if (source.lifecycle === "candidate") domainNonEmptyText(source.currentDecision.reason, `${label}.currentDecision.reason`);
  else {
    domainNonEmptyText(source.currentDecision.method, `${label}.currentDecision.method`);
    domainNonEmptyText(source.currentDecision.checkedMaterial, `${label}.currentDecision.checkedMaterial`);
    if (!Array.isArray(source.currentDecision.auditEvidence) || source.currentDecision.auditEvidence.length === 0) throw new Error(`${label}.currentDecision.auditEvidence is required.`);
    source.currentDecision.auditEvidence.forEach((item, index) => {
      sealed7(item, AUDIT_FIELDS, `${label}.currentDecision.auditEvidence[${index}]`);
      for (const field of AUDIT_FIELDS) domainNonEmptyText(item[field], `${label}.currentDecision.auditEvidence[${index}].${field}`);
    });
  }
  return source;
}
function readSourceFiles(root) {
  const workspace = openDoveWorkspace(root, { operation: "Source query" });
  return fs13.readdirSync(path17.resolve(root, ".dove/sources"), { withFileTypes: true }).filter((entry) => entry.name !== "materials").map((entry) => {
    const relativePath = path17.posix.join(".dove/sources", entry.name);
    if (entry.isSymbolicLink() || !entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON source file.`);
    return validateStoredSource(root, readJson(root, relativePath, null), entry.name, workspace.missions, relativePath);
  }).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}
function newSource(args, material, contractDigest, existing) {
  const title = text10(args.title);
  const locator = text10(args.locator);
  if (!title && !locator) throw new Error("register_source requires a real title or locator.");
  const capturedAt = (/* @__PURE__ */ new Date()).toISOString();
  return {
    schemaVersion: SOURCE_SCHEMA_VERSION,
    sourceId: domainSafeId(args.sourceId, "sourceId"),
    missionId: domainSafeId(args.missionId, "missionId"),
    contractDigest,
    citationKey: text10(args.citationKey) || null,
    title: title || null,
    authors: domainStringArray(args.authors, "authors"),
    year: args.year === void 0 || args.year === null || String(args.year).trim() === "" ? null : String(args.year).trim(),
    locator: locator || null,
    sourceType: text10(args.sourceType) || null,
    abstract: text10(args.abstract) || null,
    origin: text10(args.origin) || null,
    capturedMaterial: { ...material, capturedAt },
    lifecycle: "candidate",
    currentDecision: { decision: "candidate", decidedAt: capturedAt, reason: existing ? "source-capture-refreshed" : "source-captured" },
    useLimitation: SOURCE_USE_LIMITATION
  };
}
function registerSource(root, args = {}) {
  assertSealedDomainArgs(args, REGISTER_FIELDS, "register_source");
  const { mission } = readCurrentMission(root, args.missionId, "Source registration");
  readSourceFiles(root);
  const id3 = domainSafeId(args.sourceId, "sourceId");
  const relativePath = sourcePath(id3);
  const existing = fs13.existsSync(path17.resolve(root, relativePath)) ? readJson(root, relativePath, null) : null;
  if (existing && existing.missionId !== mission.missionId) throw new Error(`Source ${id3} belongs to another mission.`);
  const captured = materialSnapshot(root, args.capturePath, true);
  const materialPath = path17.posix.join(".dove/sources/materials", `${id3}${path17.extname(captured.path).toLowerCase() || ".bin"}`);
  const source = newSource(args, { path: materialPath, sizeBytes: captured.sizeBytes, sha256: captured.sha256 }, mission.contractDigest, existing);
  return { ...finalizeDomainArtifacts(root, { actionId: "register-source", operation: "Source registration", missionId: mission.missionId, summary: `Captured source candidate ${id3}.`, writes: [{ path: materialPath, kind: "document", content: captured.content, derivedReferences: [] }, { path: relativePath, kind: "data", content: domainJson(source), derivedReferences: [`artifact:${materialPath}`] }] }), source };
}
function auditEvidence(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("verify_source requires at least one auditEvidence item.");
  return value.map((item, index) => {
    sealed7(item, AUDIT_FIELDS, `auditEvidence[${index}]`);
    return Object.fromEntries([...AUDIT_FIELDS].map((field) => [field, domainNonEmptyText(item[field], `auditEvidence[${index}].${field}`)]));
  });
}
function verifySource(root, args = {}) {
  assertSealedDomainArgs(args, REJECT_FIELDS, "verify_source");
  const { mission } = readCurrentMission(root, args.missionId, "Source rejection");
  const id3 = domainSafeId(args.sourceId, "sourceId");
  const source = readSourceFiles(root).find((item) => item.sourceId === id3);
  if (!source || source.missionId !== mission.missionId) throw new Error("Source rejection cannot resolve the exact mission-bound source.");
  const next = { ...source, lifecycle: "rejected", currentDecision: { decision: "rejected", method: domainNonEmptyText(args.method, "method"), checkedMaterial: domainNonEmptyText(args.checkedMaterial, "checkedMaterial"), auditEvidence: auditEvidence(args.auditEvidence), decidedAt: (/* @__PURE__ */ new Date()).toISOString() } };
  return { ...finalizeDomainArtifacts(root, { actionId: "verify-source", operation: "Source rejection", missionId: mission.missionId, summary: `Rejected source ${id3}.`, writes: [{ path: sourcePath(id3), kind: "data", content: domainJson(next), derivedReferences: [`artifact:${source.capturedMaterial.path}`] }] }), source: next };
}
function sourceEligibility(source, _unused = [], options = {}) {
  const base = { source, limitation: source?.useLimitation ?? SOURCE_USE_LIMITATION };
  if (!source) return { ...base, eligible: false, reason: "unknown-source" };
  let readable = false;
  try {
    readable = missionCanReadMission(options.missionGraph, text10(options.missionId), source.missionId);
  } catch {
    readable = false;
  }
  if (!readable) return { ...base, eligible: false, reason: "source-mission-binding-mismatch" };
  if (source.lifecycle !== "candidate") return { ...base, eligible: false, reason: `source-${source.lifecycle}` };
  try {
    const material = materialSnapshot(options.root, source.capturedMaterial.path, true);
    if (material.sha256 !== source.capturedMaterial.sha256 || material.sizeBytes !== source.capturedMaterial.sizeBytes) return { ...base, eligible: false, reason: "source-captured-material-changed" };
  } catch {
    return { ...base, eligible: false, reason: "source-captured-material-invalid" };
  }
  return { ...base, eligible: true, reason: "current-captured-source-not-independently-verified" };
}
function evaluateSourceIds(root, ids2 = [], missionId2 = null) {
  const workspace = openDoveWorkspace(root, { operation: "Source evaluation" });
  const byId = new Map(readSourceFiles(root).map((source) => [source.sourceId, source]));
  return ids2.map((sourceId) => ({ sourceId, ...sourceEligibility(byId.get(sourceId), [], { root, missionId: missionId2, missionGraph: workspace.missionGraph }) }));
}
function evaluateSourceReferences(root, references = [], missionId2 = null) {
  const workspace = openDoveWorkspace(root, { operation: "Source evaluation" });
  const byRef = new Map(readSourceFiles(root).flatMap((source) => [source.sourceId, source.citationKey, source.locator].filter(Boolean).map((reference) => [reference, source])));
  return references.map((reference) => ({ reference, ...sourceEligibility(byRef.get(reference), [], { root, missionId: missionId2, missionGraph: workspace.missionGraph }) }));
}
function querySources(root, args = {}) {
  assertSealedDomainArgs(args, QUERY_FIELDS, "query_sources");
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Source query");
  const sourceId = text10(args.sourceId);
  const lifecycle = text10(args.lifecycle).toLowerCase();
  if (lifecycle && !SOURCE_LIFECYCLE_STATES.includes(lifecycle)) throw new Error(`lifecycle must be one of: ${SOURCE_LIFECYCLE_STATES.join(", ")}.`);
  const limit = Math.min(200, Math.max(1, Number.isFinite(Number(args.limit)) ? Math.trunc(Number(args.limit)) : 50));
  const items = readSourceFiles(root).filter((source) => missionCanReadMission(workspace.missionGraph, mission.missionId, source.missionId)).filter((source) => !sourceId || [source.sourceId, source.citationKey, source.locator].includes(sourceId)).filter((source) => !lifecycle || source.lifecycle === lifecycle).slice(0, limit).map((source) => ({ ...source, eligibility: sourceEligibility(source, [], { root, missionId: mission.missionId, missionGraph: workspace.missionGraph }) }));
  return { status: items.length ? "ok" : "empty", missionId: mission.missionId, sourceCount: items.length, items, writes: [] };
}

// src/core/completion-gates.mjs
var HASH_PATTERN2 = /^[0-9a-f]{64}$/u;
var ARTIFACT_KINDS = /* @__PURE__ */ new Set(["report", "document", "code", "data", "figure", "media", "other"]);
var RECEIPT_FIELDS2 = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "receiptId", "ledgerSequence", "missionId", "contractDigest", "summary", "artifacts", "validations", "criteriaSatisfied", "producedAt", "recordedAt", "producer", "ordinaryHostOutcome", "researchOutcome"]);
var ARTIFACT_FIELDS3 = /* @__PURE__ */ new Set(["path", "kind", "sha256", "derivedReferences"]);
var CURRENT_VALIDATION_FIELDS = new Set(VALIDATION_FIELDS);
var CRITERION_FIELDS3 = /* @__PURE__ */ new Set(["criterionId", "evidenceRefs", "evidenceBindings"]);
var EVIDENCE_BINDING_FIELDS2 = /* @__PURE__ */ new Set(["reference", "sha256", "receiptId"]);
function missionPath2(missionId2) {
  return path18.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId2}.json`);
}
function sealed8(value, allowed2) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => allowed2.has(key));
}
function currentHashedFile(root, relativePath, expectedHash) {
  if (isDoveLessonArtifactPath(relativePath)) return { current: false, reason: "lesson-advisory-only", path: relativePath ?? null, actualHash: null };
  if (typeof relativePath !== "string" || !relativePath.trim() || !HASH_PATTERN2.test(String(expectedHash ?? ""))) {
    return { current: false, reason: "hashed-file-input-invalid", path: relativePath ?? null, actualHash: null };
  }
  try {
    const snapshot = snapshotArtifactBuffer(root, relativePath, `completion evidence ${relativePath}`);
    return {
      current: snapshot.sha256 === expectedHash,
      reason: snapshot.sha256 === expectedHash ? null : "hash-mismatch",
      path: snapshot.path,
      actualHash: snapshot.sha256,
      sizeBytes: snapshot.sizeBytes
    };
  } catch (error) {
    return { current: false, reason: error instanceof Error ? error.message : "path-invalid", path: relativePath, actualHash: null };
  }
}
function typedEvidenceEligibility(root, missionId2, reference) {
  if (reference.startsWith("source:")) {
    const value = reference.slice("source:".length);
    const evaluation = evaluateSourceReferences(root, [value], missionId2)[0] ?? { eligible: false, reason: "unknown-source" };
    return { ...evaluation, evidenceSha256: evaluation.source?.capturedMaterial?.sha256 ?? null };
  }
  return { eligible: null, reason: null, evidenceSha256: null };
}
function assessArtifact(root, mission, artifact, currentOwnerByPath) {
  if (!sealed8(artifact, ARTIFACT_FIELDS3) || typeof artifact.path !== "string" || !artifact.path.trim() || !ARTIFACT_KINDS.has(artifact.kind) || !HASH_PATTERN2.test(String(artifact.sha256 ?? "")) || !Array.isArray(artifact.derivedReferences)) {
    return { path: artifact?.path ?? null, current: false, reason: "artifact-schema-invalid", ownerReceiptId: null, recordedSha256: artifact?.sha256 ?? null };
  }
  const owner = currentOwnerByPath.get(artifact.path);
  if (!owner || owner.missionId !== mission.missionId) {
    return { path: artifact.path, current: false, reason: owner ? "artifact-current-owner-mission-mismatch" : "artifact-current-owner-missing", ownerReceiptId: owner?.receiptId ?? null, recordedSha256: artifact.sha256 };
  }
  if (owner.sha256 !== artifact.sha256) {
    return { path: artifact.path, current: false, reason: "artifact-superseded", ownerReceiptId: owner.receiptId, recordedSha256: artifact.sha256, ownerSha256: owner.sha256 };
  }
  return { ...currentHashedFile(root, artifact.path, owner.sha256), ownerReceiptId: owner.receiptId, recordedSha256: artifact.sha256 };
}
function assessValidation(root, validation) {
  if (!sealed8(validation, CURRENT_VALIDATION_FIELDS)) {
    return { path: validation?.reference ?? null, current: false, result: "incomplete", level: null, producerKind: null, completionEligible: false, reason: "validation-schema-invalid", recordedSha256: validation?.outputHash ?? null };
  }
  try {
    const normalized3 = createValidationRecord(validation, { label: "validation" });
    const output = currentHashedFile(root, normalized3.reference, normalized3.outputHash);
    if (!output.current) return { ...output, path: normalized3.reference, result: normalized3.result, level: normalized3.level, producerKind: normalized3.producerKind, completionEligible: false, recordedSha256: normalized3.outputHash };
    const separator = normalized3.targetReference.indexOf(":");
    const targetPath = normalized3.targetReference.slice(separator + 1);
    const target = currentHashedFile(root, targetPath, normalized3.targetHash);
    if (!target.current) return { path: normalized3.reference, current: false, result: normalized3.result, level: normalized3.level, producerKind: normalized3.producerKind, completionEligible: false, reason: "validation-target-drift", recordedSha256: normalized3.outputHash, targetReference: normalized3.targetReference, targetHash: normalized3.targetHash };
    const completionEligible = validationContributesToCompletion(normalized3);
    return {
      ...output,
      path: normalized3.reference,
      result: normalized3.result,
      level: normalized3.level,
      producerKind: normalized3.producerKind,
      producerOperation: normalized3.producerOperation,
      observedExitStatus: normalized3.observedExitStatus,
      targetReference: normalized3.targetReference,
      targetHash: normalized3.targetHash,
      completionEligible,
      reason: completionEligible ? null : `validation-result-${normalized3.result}`,
      recordedSha256: normalized3.outputHash
    };
  } catch {
    return { path: validation?.reference ?? null, current: false, result: "incomplete", level: null, producerKind: null, completionEligible: false, reason: "validation-schema-invalid", recordedSha256: validation?.outputHash ?? null };
  }
}
function criterionAssessment(root, mission, criterion, receipt, artifactAssessments, validationAssessments, currentOwnerByPath, requiredIds, seenCriteria) {
  const failures = [];
  if (!sealed8(criterion, CRITERION_FIELDS3)) failures.push("criterion-schema-invalid");
  if (!requiredIds.has(criterion?.criterionId)) failures.push("criterion-unknown");
  if (seenCriteria.has(criterion?.criterionId)) failures.push("criterion-duplicate");
  seenCriteria.add(criterion?.criterionId);
  const evidenceRefs2 = Array.isArray(criterion?.evidenceRefs) ? criterion.evidenceRefs : [];
  const evidenceBindings = Array.isArray(criterion?.evidenceBindings) ? criterion.evidenceBindings : [];
  if (evidenceRefs2.length === 0 || evidenceRefs2.some((reference) => typeof reference !== "string" || !reference.trim()) || new Set(evidenceRefs2).size !== evidenceRefs2.length) failures.push("criterion-evidence-invalid");
  if (evidenceBindings.length !== evidenceRefs2.length || evidenceBindings.some((binding) => !sealed8(binding, EVIDENCE_BINDING_FIELDS2) || !evidenceRefs2.includes(binding.reference) || !HASH_PATTERN2.test(String(binding.sha256 ?? "")) || typeof binding.receiptId !== "string" || !binding.receiptId) || new Set(evidenceBindings.map((binding) => binding.reference)).size !== evidenceBindings.length) {
    failures.push("criterion-evidence-binding-invalid");
  }
  const bindingByReference = new Map(evidenceBindings.map((binding) => [binding.reference, binding]));
  const receiptArtifactByPath = new Map((receipt.artifacts ?? []).map((artifact, index) => [artifact.path, artifactAssessments[index]]));
  const receiptValidationByPath = new Map((receipt.validations ?? []).map((validation, index) => [validation.reference, validationAssessments[index]]));
  const evidence = evidenceRefs2.map((reference) => {
    const binding = bindingByReference.get(reference) ?? null;
    const boundSha256 = binding?.sha256 ?? null;
    const boundReceiptId = binding?.receiptId ?? null;
    if (reference.startsWith("artifact:")) {
      const artifactPath = reference.slice("artifact:".length);
      const owner = currentOwnerByPath.get(artifactPath);
      if (!owner) return { reference, boundSha256, eligible: false, reason: "artifact-current-owner-missing", contributingReceiptId: null };
      if (owner.missionId !== mission.missionId) return { reference, boundSha256, eligible: false, reason: "artifact-current-owner-mission-mismatch", contributingReceiptId: null };
      if (owner.sha256 !== boundSha256 || owner.receiptId !== boundReceiptId) return { reference, boundSha256, boundReceiptId, eligible: false, reason: "artifact-original-owner-superseded", contributingReceiptId: null };
      const current = currentHashedFile(root, artifactPath, owner.sha256);
      const declaration = receiptArtifactByPath.get(artifactPath);
      if (declaration && declaration.recordedSha256 !== boundSha256) return { reference, boundSha256, eligible: false, reason: "artifact-receipt-binding-mismatch", contributingReceiptId: null };
      return { reference, boundSha256, eligible: current.current, reason: current.current ? null : current.reason, contributingReceiptId: current.current ? owner.receiptId : null };
    }
    if (reference.startsWith("validation:")) {
      const validationPath = reference.slice("validation:".length);
      const declaration = receiptValidationByPath.get(validationPath);
      if (!declaration || declaration.recordedSha256 !== boundSha256 || boundReceiptId !== receipt.receiptId) return { reference, boundSha256, boundReceiptId, eligible: false, reason: "validation-receipt-binding-mismatch", contributingReceiptId: null };
      const eligible = declaration.current && declaration.completionEligible === true;
      return { reference, boundSha256, eligible, reason: eligible ? null : declaration.reason ?? "validation-not-passed", contributingReceiptId: eligible ? receipt.receiptId : null };
    }
    if (reference.startsWith("fact:")) {
      const factId = reference.slice("fact:".length);
      const fact = receipt.ordinaryHostOutcome?.facts?.find((item) => item.factId === factId) ?? null;
      const eligible = Boolean(fact) && boundReceiptId === receipt.receiptId && boundSha256 === executionFactHash(fact.statement);
      return { reference, boundSha256, boundReceiptId, eligible, reason: eligible ? null : "fact-receipt-binding-mismatch", contributingReceiptId: eligible ? receipt.receiptId : null };
    }
    const typed = typedEvidenceEligibility(root, mission.missionId, reference);
    const currentTypedReceiptId = typed.owner?.receiptId ?? receipt.receiptId;
    const bound = HASH_PATTERN2.test(String(boundSha256 ?? "")) && typed.evidenceSha256 === boundSha256 && boundReceiptId === currentTypedReceiptId;
    return { reference, boundSha256, boundReceiptId, eligible: typed.eligible === true && bound, reason: typed.eligible !== true ? typed.reason ?? "unresolved-evidence-reference" : bound ? null : "typed-evidence-original-owner-superseded", contributingReceiptId: typed.eligible === true && bound ? currentTypedReceiptId : null };
  });
  if (evidence.some((item) => !item.eligible)) failures.push("criterion-evidence-stale-or-ineligible");
  return {
    criterionId: criterion?.criterionId ?? null,
    evidence,
    failures: [...new Set(failures)],
    satisfied: failures.length === 0,
    contributingReceiptIds: [...new Set(evidence.map((item) => item.contributingReceiptId).filter(Boolean))]
  };
}
function receiptAssessment(root, mission, receipt, workspaceId, currentOwnerByPath, missionCurrent = true) {
  const failures = [];
  if (!missionCurrent) failures.push("mission-contract-invalid");
  if (!sealed8(receipt, RECEIPT_FIELDS2) || receipt.schemaVersion !== 5) failures.push("receipt-schema-invalid");
  if (receipt.workspaceId !== workspaceId || mission.workspaceId !== workspaceId) failures.push("workspace-binding-mismatch");
  if (receipt.missionId !== mission.missionId) failures.push("mission-binding-mismatch");
  if (receipt?.contractDigest !== mission.contractDigest || !missionCurrent) failures.push("contract-digest-stale");
  if (!Array.isArray(receipt.artifacts)) failures.push("artifacts-invalid");
  if (!Array.isArray(receipt.validations)) failures.push("validations-invalid");
  if (!Array.isArray(receipt.criteriaSatisfied)) failures.push("criteria-invalid");
  if ((receipt.artifacts?.length ?? 0) + (receipt.validations?.length ?? 0) + (receipt.criteriaSatisfied?.length ?? 0) === 0 && !receipt.ordinaryHostOutcome && !receipt.researchOutcome) failures.push("progress-evidence-missing");
  const artifactAssessments = (Array.isArray(receipt.artifacts) ? receipt.artifacts : []).map((artifact) => assessArtifact(root, mission, artifact, currentOwnerByPath));
  const validationAssessments = (Array.isArray(receipt.validations) ? receipt.validations : []).map((validation) => assessValidation(root, validation));
  if (artifactAssessments.some((item) => !item.current)) failures.push("artifact-drift-or-superseded");
  if (validationAssessments.some((item) => !item.current)) failures.push("validation-drift");
  if (validationAssessments.some((item) => item.current && item.completionEligible !== true)) failures.push("validation-not-passed");
  const artifactPaths = (receipt.artifacts ?? []).map((artifact) => artifact?.path).filter(Boolean);
  const validationPaths = (receipt.validations ?? []).map((validation) => validation?.reference).filter(Boolean);
  if (new Set(artifactPaths).size !== artifactPaths.length) failures.push("artifact-path-duplicate");
  if (new Set(validationPaths).size !== validationPaths.length) failures.push("validation-path-duplicate");
  const requiredIds = new Set(missionCompletionCriteria(mission).map((criterion) => criterion.criterionId));
  const seenCriteria = /* @__PURE__ */ new Set();
  const criteria = (Array.isArray(receipt.criteriaSatisfied) ? receipt.criteriaSatisfied : []).map((criterion) => criterionAssessment(root, mission, criterion, receipt, artifactAssessments, validationAssessments, currentOwnerByPath, requiredIds, seenCriteria));
  if (criteria.some((criterion) => !criterion.satisfied)) failures.push("criteria-evidence-invalid");
  const stale = failures.some((failure) => ["mission-contract-invalid", "contract-digest-stale", "artifact-drift-or-superseded", "validation-drift"].includes(failure)) || criteria.some((criterion) => criterion.failures.includes("criterion-evidence-stale-or-ineligible"));
  return {
    receiptId: receipt.receiptId ?? null,
    current: failures.length === 0,
    stale,
    failures: [...new Set(failures)],
    artifacts: artifactAssessments,
    validations: validationAssessments,
    criteria,
    producedAt: receipt.producedAt ?? null
  };
}
function artifactCoverageAssessment(root, mission, currentOwnerByPath) {
  const requiredPaths = mission.artifacts.filter((artifact) => artifact.required).map((artifact) => artifact.path).sort();
  return requiredPaths.map((artifactPath) => {
    const owner = currentOwnerByPath.get(artifactPath) ?? null;
    if (!owner) return { path: artifactPath, covered: false, reason: "artifact-current-owner-missing", receiptId: null, sha256: null };
    if (owner.missionId !== mission.missionId) return { path: artifactPath, covered: false, reason: "artifact-current-owner-mission-mismatch", receiptId: owner.receiptId, sha256: owner.sha256 };
    const current = currentHashedFile(root, artifactPath, owner.sha256);
    return { path: artifactPath, covered: current.current, reason: current.current ? null : current.reason, receiptId: current.current ? owner.receiptId : null, sha256: owner.sha256 };
  });
}
function criterionCoverageAssessment(mission, receiptAssessments, receiptById) {
  return missionCompletionCriteria(mission).map(({ criterionId, criterion }) => {
    const proofs = receiptAssessments.flatMap((receipt) => {
      const storedReceipt = receiptById.get(receipt.receiptId);
      if (storedReceipt?.ordinaryHostOutcome?.status !== void 0 && storedReceipt.ordinaryHostOutcome.status !== "completed") {
        return [];
      }
      return receipt.criteria.filter((item) => item.criterionId === criterionId && item.satisfied).map((item) => ({
        receiptId: receipt.receiptId,
        evidence: item.evidence,
        contributingReceiptIds: [.../* @__PURE__ */ new Set([receipt.receiptId, ...item.contributingReceiptIds])]
      }));
    });
    return { criterionId, criterion, covered: proofs.length > 0, contributingReceiptIds: [...new Set(proofs.flatMap((item) => item.contributingReceiptIds))], proofs };
  });
}
function researchOutcomeAssessment(workspace, missionId2) {
  const receipts = workspace.receiptLedger.receipts.filter((receipt) => receipt.missionId === missionId2 && receipt.researchOutcome);
  const consumed = new Set([...workspace.researchDecisions.values()].filter((decision) => decision.missionId === missionId2).flatMap((decision) => decision.consumedReceiptIds));
  const unconsumed = receipts.filter((receipt) => !consumed.has(receipt.receiptId));
  return {
    receiptIds: receipts.map((receipt) => receipt.receiptId),
    consumedReceiptIds: receipts.filter((receipt) => consumed.has(receipt.receiptId)).map((receipt) => receipt.receiptId),
    unconsumedReceiptIds: unconsumed.map((receipt) => receipt.receiptId),
    awaitingReevaluation: unconsumed.length > 0
  };
}
function ordinaryHostReturnAssessment(receipts) {
  const returned = receipts.filter((receipt) => receipt.ordinaryHostOutcome).map((receipt) => ({
    receiptId: receipt.receiptId,
    mode: receipt.ordinaryHostOutcome.mode,
    status: receipt.ordinaryHostOutcome.status,
    facts: receipt.ordinaryHostOutcome.facts.map((fact) => ({ factId: fact.factId, statement: fact.statement })),
    summary: receipt.summary,
    producedAt: receipt.producedAt
  }));
  const current = returned.at(-1) ?? null;
  return {
    present: current !== null,
    current,
    history: returned
  };
}
function evidenceRequirementAssessment(root, mission, receiptAssessments, artifactCoverage) {
  const requirements = missionEvidenceRequirements(mission);
  const artifactByReference = new Map(artifactCoverage.map((item) => [`artifact:${item.path}`, item]));
  const validationProofs = /* @__PURE__ */ new Map();
  for (const receipt of receiptAssessments) {
    for (const validation of receipt.validations) {
      if (validation.current && validation.completionEligible === true) validationProofs.set(`validation:${validation.path}`, receipt.receiptId);
    }
  }
  return requirements.map(({ requirementId, requirement }) => {
    if (requirement.startsWith("source:")) {
      const evaluation = typedEvidenceEligibility(root, mission.missionId, requirement);
      return { requirementId, requirement, satisfied: evaluation.eligible === true, reason: evaluation.eligible === true ? null : evaluation.reason, contributingReceiptIds: evaluation.eligible === true && evaluation.owner?.receiptId ? [evaluation.owner.receiptId] : [] };
    }
    if (requirement.startsWith("artifact:")) {
      const coverage = artifactByReference.get(requirement);
      return { requirementId, requirement, satisfied: coverage?.covered === true, reason: coverage?.covered === true ? null : coverage?.reason ?? "required-artifact-not-current", contributingReceiptIds: coverage?.covered ? [coverage.receiptId] : [] };
    }
    if (requirement.startsWith("validation:")) {
      const receiptId = validationProofs.get(requirement) ?? null;
      return { requirementId, requirement, satisfied: Boolean(receiptId), reason: receiptId ? null : "required-validation-not-current", contributingReceiptIds: receiptId ? [receiptId] : [] };
    }
    return { requirementId, requirement, satisfied: false, reason: "unsupported-evidence-requirement-syntax", contributingReceiptIds: [] };
  });
}
function assessMissionFromWorkspace(root, workspace, missionId2, state) {
  if (state.memo.has(missionId2)) return state.memo.get(missionId2);
  if (state.visiting.has(missionId2)) throw new Error(`Mission dependency assessment contains a cycle at ${missionId2}.`);
  const mission = workspace.missions.get(missionId2);
  if (!mission) throw new Error(`Mission does not exist: ${missionId2}.`);
  state.visiting.add(missionId2);
  try {
    const relativePath = missionPath2(missionId2);
    let missionContractFailure = null;
    try {
      assertCurrentMissionContract2(mission);
    } catch (error) {
      missionContractFailure = error instanceof Error ? error.message : String(error);
    }
    const receipts = workspace.receiptLedger.receipts.filter((receipt) => receipt.missionId === missionId2);
    const receiptAssessments = receipts.map((receipt) => receiptAssessment(root, mission, receipt, workspace.manifest.workspaceId, state.currentOwnerByPath, missionContractFailure === null));
    const artifactCoverage = artifactCoverageAssessment(root, mission, state.currentOwnerByPath);
    const ordinaryHostReturn = ordinaryHostReturnAssessment(receipts);
    const receiptById = new Map(receipts.map((receipt) => [receipt.receiptId, receipt]));
    const criterionCoverage = criterionCoverageAssessment(mission, receiptAssessments, receiptById);
    const requirements = evidenceRequirementAssessment(root, mission, receiptAssessments, artifactCoverage);
    const researchDecision = mission.mode === "research" ? workspace.currentResearchDecisions.get(missionId2) ?? null : null;
    const researchOutcome = mission.mode === "research" ? researchOutcomeAssessment(workspace, missionId2) : { receiptIds: [], consumedReceiptIds: [], unconsumedReceiptIds: [], awaitingReevaluation: false };
    const dependencyCoverage = (workspace.missionGraph.dependenciesByMission.get(missionId2) ?? []).map((dependencyMissionId) => {
      const assessment2 = assessMissionFromWorkspace(root, workspace, dependencyMissionId, state);
      return {
        missionId: dependencyMissionId,
        status: assessment2.status,
        complete: assessment2.complete,
        lifecycle: assessment2.lifecycle,
        incompleteReasons: assessment2.incompleteReasons
      };
    });
    const lifecycle = missionLifecycle(workspace, missionId2);
    const incompleteReasons = [];
    if (lifecycle && lifecycle.status !== "completed") incompleteReasons.push(`mission-${lifecycle.status}`);
    if (missionContractFailure) incompleteReasons.push("mission-contract-invalid");
    if (receipts.length === 0) incompleteReasons.push("execution-receipt-missing");
    if (ordinaryHostReturn.current && ordinaryHostReturn.current.status !== "completed") incompleteReasons.push(`host-outcome-${ordinaryHostReturn.current.status}`);
    if (artifactCoverage.some((item) => !item.covered)) incompleteReasons.push("mission-artifact-coverage-missing");
    if (criterionCoverage.some((item) => !item.covered)) incompleteReasons.push("criteria-coverage-missing");
    if (requirements.some((requirement) => !requirement.satisfied)) incompleteReasons.push("evidence-requirements-unmet");
    if (mission.mode === "research" && !researchDecision) incompleteReasons.push("research-decision-missing");
    if (mission.mode === "research" && researchOutcome.awaitingReevaluation) incompleteReasons.push("research-outcome-awaiting-reevaluation");
    if (mission.mode === "research" && researchDecision?.disposition === "block-needs-user") incompleteReasons.push("research-user-decision-required");
    else if (mission.mode === "research" && researchDecision?.disposition !== "stop-satisfied") incompleteReasons.push("research-decision-not-stop-satisfied");
    if (mission.mode === "research" && researchDecision?.nextAction !== null) incompleteReasons.push("research-action-still-authorized");
    if (mission.mode === "research" && researchDecision?.evidenceRefs.length === 0) incompleteReasons.push("research-terminal-evidence-missing");
    if (dependencyCoverage.some((dependency) => !dependency.complete)) incompleteReasons.push("mission-dependency-incomplete");
    const contributingReceiptIds = [...new Set([
      ...artifactCoverage.filter((item) => item.covered).map((item) => item.receiptId),
      ...criterionCoverage.flatMap((item) => item.contributingReceiptIds),
      ...requirements.flatMap((item) => item.contributingReceiptIds)
    ].filter(Boolean))].sort((left, right) => {
      const leftSequence = receipts.find((receipt) => receipt.receiptId === left)?.ledgerSequence ?? 0;
      const rightSequence = receipts.find((receipt) => receipt.receiptId === right)?.ledgerSequence ?? 0;
      return leftSequence - rightSequence;
    });
    if (receipts.length > 0 && contributingReceiptIds.length === 0 && !receiptAssessments.some((receipt) => receipt.current)) incompleteReasons.push("execution-receipts-stale-or-invalid");
    const hostActionReturned = ordinaryHostReturn.present;
    const receiptRecorded = receipts.length > 0;
    const completionEvidenceSatisfied = incompleteReasons.filter((reason) => !reason.startsWith("mission-") && !reason.startsWith("host-outcome-")).length === 0;
    const lifecycleClosed = lifecycle?.status === "completed";
    const evidenceComplete = incompleteReasons.length === 0;
    const complete = evidenceComplete && (lifecycle === null || lifecycle.status === "completed");
    const operationalIntegrity = {
      hostActionReturned,
      receiptRecorded,
      completionEvidenceSatisfied,
      lifecycleClosed
    };
    const assessment = {
      status: lifecycle?.status ?? (evidenceComplete ? "complete" : "incomplete"),
      complete,
      missionId: missionId2,
      mode: mission.mode,
      contractDigest: mission.contractDigest,
      lifecycle,
      dependencyCoverage,
      contributingReceiptIds,
      artifactCoverage,
      criterionCoverage,
      receiptCount: receipts.length,
      staleReceiptIds: receiptAssessments.filter((receipt) => receipt.stale).map((receipt) => receipt.receiptId),
      receipts: receiptAssessments,
      completionCriteria: missionCompletionCriteria(mission),
      evidenceRequirements: requirements,
      ordinaryHostReturn,
      operationalIntegrity,
      researchOutcome,
      incompleteReasons,
      diagnostics: {
        zeroWrite: true,
        missionContractFailure,
        missionPath: relativePath,
        receiptRoot: ARTIFACT_PATHS.executionReceiptsDir,
        artifactAuthority: "execution-receipt-ledger-current-ownership"
      }
    };
    state.memo.set(missionId2, assessment);
    return assessment;
  } finally {
    state.visiting.delete(missionId2);
  }
}
function assessmentState(workspace) {
  return {
    memo: /* @__PURE__ */ new Map(),
    visiting: /* @__PURE__ */ new Set(),
    currentOwnerByPath: new Map(workspace.receiptLedger.currentOwnership.map((item) => [item.path, item]))
  };
}
function assessMissionCompletion(root, args = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("assess_mission_completion arguments must be a plain object.");
  const unknown = Object.keys(args).filter((field) => field !== "missionId");
  if (unknown.length > 0) throw new Error(`assess_mission_completion does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const missionId2 = typeof args.missionId === "string" ? args.missionId.trim() : "";
  if (!missionId2) throw new Error("assess_mission_completion requires missionId.");
  const workspace = openDoveWorkspace(root, { operation: "Mission completion assessment" });
  return assessMissionFromWorkspace(root, workspace, missionId2, assessmentState(workspace));
}
function completeMissionIfEligible(root, args = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Mission completion transition arguments must be a plain object.");
  const unknown = Object.keys(args).filter((field) => !["missionId", "createdAt"].includes(field));
  if (unknown.length > 0) throw new Error(`Mission completion transition does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const missionId2 = typeof args.missionId === "string" ? args.missionId.trim() : "";
  if (!missionId2) throw new Error("Mission completion transition requires missionId.");
  if (!currentMutationContext(root)) throw new Error("Mission completion transition requires an active MutationContext.");
  const workspace = openDoveWorkspace(root, { operation: "Mission completion transition" });
  if (!workspace.missions.has(missionId2)) throw new Error(`Mission does not exist: ${missionId2}.`);
  const state = assessmentState(workspace);
  const assessments = new Map([...workspace.missions.keys()].map((candidateMissionId) => [
    candidateMissionId,
    assessMissionFromWorkspace(root, workspace, candidateMissionId, state)
  ]));
  const createdAt = args.createdAt ?? nowIso();
  const transitions = /* @__PURE__ */ new Map();
  for (const [candidateMissionId, assessment2] of assessments) {
    if (!assessment2.complete || assessment2.lifecycle) continue;
    const mission = workspace.missions.get(candidateMissionId);
    const transition2 = createMissionTransition({
      workspaceId: workspace.manifest.workspaceId,
      missionId: candidateMissionId,
      contractDigest: mission.contractDigest,
      workspaceRevisionId: mission.workspaceRevisionId,
      status: "completed",
      reason: "The mission completion gate closed with current contract-bound evidence.",
      evidenceRefs: assessment2.contributingReceiptIds.map((receiptId) => `receipt:${receiptId}`),
      trigger: "completion-gate",
      createdAt
    });
    writeJson(root, missionTransitionPath(transition2.transitionId), transition2);
    transitions.set(candidateMissionId, transition2);
  }
  const assessment = assessments.get(missionId2);
  const transition = transitions.get(missionId2) ?? null;
  return {
    assessment: transition ? { ...assessment, status: "completed", lifecycle: transition } : assessment,
    transition,
    transitions: [...transitions.values()]
  };
}

// src/core/operation-registry.mjs
var TERMINAL = "terminal";
var RESUME_ORIGINAL = "resume-original";
var NO_CLOSURE = "none";
var HOST_OUTCOME_CLOSURE = "host-outcome";
var RESEARCH_OUTCOME_CLOSURE = "research-outcome";
var DOMAIN_CLOSURE = "domain";
var DEFAULT_RETRY = Object.freeze({
  succeeded: "none",
  declined: "none",
  cancelled: "none",
  failed: "explicit-request"
});
var INTERACTIONS = /* @__PURE__ */ new Set(["read", "write", "checkpoint", "ambient-create"]);
var CONTINUATIONS = /* @__PURE__ */ new Set([TERMINAL, RESUME_ORIGINAL]);
var CLOSURES = /* @__PURE__ */ new Set([NO_CLOSURE, HOST_OUTCOME_CLOSURE, RESEARCH_OUTCOME_CLOSURE, DOMAIN_CLOSURE]);
var CALLBACK_MODES = /* @__PURE__ */ new Set([HOST_OUTCOME_CLOSURE, RESEARCH_OUTCOME_CLOSURE]);
var RETRIES = /* @__PURE__ */ new Set(["none", "explicit-request"]);
var PRESENTATIONS = /* @__PURE__ */ new Set(["show", "silent-on-success"]);
var RETRY_OUTCOMES = Object.freeze(["succeeded", "declined", "cancelled", "failed"]);
var STATUS_OUTCOMES = /* @__PURE__ */ new Set(["success", "proposal", "declined", "cancelled", "failure", "replay"]);
var STATUS_CATEGORIES = /* @__PURE__ */ new Set(["success", "success-zero-write", "awaiting-approval", "declined", "cancelled", "invalid-input", "ambiguous-target", "not-found", "stale-state", "capability-unavailable", "blocked", "evidence-incomplete", "operational-failure", "internal-failure"]);
var STATUS_PHASES = /* @__PURE__ */ new Set(["approval", "validation", "selection", "read", "execution", "evidence", "internal"]);
var STATUS_USER_ACTIONS = /* @__PURE__ */ new Set(["none", "approve-or-cancel", "clarify-input", "select-target", "refresh-state", "enable-capability", "resolve-blocker", "provide-evidence", "retry-explicitly", "reassess-read-only"]);
var SUCCESS = Object.freeze({ outcome: "success" });
var PROPOSAL = Object.freeze({ outcome: "proposal", category: "awaiting-approval", phase: "approval", userAction: "approve-or-cancel" });
var DECLINED = Object.freeze({ outcome: "declined", category: "declined", phase: "approval", userAction: "none" });
var CANCELLED = Object.freeze({ outcome: "cancelled", category: "cancelled", phase: "approval", userAction: "none" });
var REPLAY = Object.freeze({ outcome: "replay", category: "success-zero-write", phase: "execution", userAction: "none", retry: "none" });
var NO_PROGRESS = Object.freeze({ outcome: "failure", category: "blocked", phase: "execution", userAction: "resolve-blocker", retry: "explicit-request" });
var PARTIAL_COMMIT_FAILURE = Object.freeze({ outcome: "failure", category: "internal-failure", phase: "internal", userAction: "reassess-read-only", retry: "none" });
var BLOCKED = Object.freeze({ outcome: "failure", category: "blocked", phase: "execution", userAction: "resolve-blocker" });
var EVIDENCE_INCOMPLETE = Object.freeze({ outcome: "failure", category: "evidence-incomplete", phase: "evidence", userAction: "provide-evidence" });
function statusPolicy(entries) {
  return Object.freeze(Object.fromEntries(Object.entries(entries).map(([status, semantics]) => [status, Object.freeze({ ...semantics })])));
}
var READ_OK = statusPolicy({ ok: SUCCESS, empty: SUCCESS });
var RECORDED = statusPolicy({ recorded: SUCCESS, planned: SUCCESS });
var WORKSPACE_STATUSES = statusPolicy({
  "needs-confirmation": PROPOSAL,
  initialized: SUCCESS,
  revised: SUCCESS,
  "archive-reset-complete": SUCCESS,
  "initialization-planned": SUCCESS,
  "revision-planned": SUCCESS
});
var MISSION_STATUSES = statusPolicy({ proposal: SUCCESS, "needs-confirmation": PROPOSAL, materialized: SUCCESS, "materialization-planned": SUCCESS, recorded: SUCCESS });
var RECEIPT_STATUSES = statusPolicy({ ingested: SUCCESS, "ingest-planned": SUCCESS, replayed: REPLAY, "no-progress-skipped": NO_PROGRESS, "partial-commit-failure": PARTIAL_COMMIT_FAILURE });
var COMPLETION_STATUSES = statusPolicy({ complete: SUCCESS, incomplete: SUCCESS, completed: SUCCESS, stopped: SUCCESS, failed: SUCCESS });
var REVIEW_RECORD_STATUSES = statusPolicy({ scoped: SUCCESS, archived: SUCCESS, "archive-planned": SUCCESS, replayed: REPLAY });
var COMMON_OPERATION_STATUSES = statusPolicy({
  declined: DECLINED,
  cancelled: CANCELLED,
  "needs-task-selection": { outcome: "failure", category: "ambiguous-target", phase: "selection", userAction: "select-target" },
  blocked: BLOCKED,
  "no-op": NO_PROGRESS,
  noop: NO_PROGRESS,
  "step-no-progress": NO_PROGRESS,
  "needs-explicit-progress-step": NO_PROGRESS,
  "blocked-boundary": { outcome: "failure", category: "invalid-input", phase: "validation", userAction: "clarify-input" },
  "blocked-missing-materials": { outcome: "failure", category: "invalid-input", phase: "validation", userAction: "clarify-input" },
  "missing-required-materials": { outcome: "failure", category: "invalid-input", phase: "validation", userAction: "clarify-input" },
  "needs-completion-evidence": EVIDENCE_INCOMPLETE,
  "needs-source-verification": EVIDENCE_INCOMPLETE,
  "source-provenance-unverified": EVIDENCE_INCOMPLETE,
  "qa-needs-attention": EVIDENCE_INCOMPLETE,
  "verification-failed": EVIDENCE_INCOMPLETE,
  "missing-secret-env": { outcome: "failure", category: "capability-unavailable", phase: "execution", userAction: "enable-capability" },
  "provider-failed": { outcome: "failure", category: "capability-unavailable", phase: "execution", userAction: "enable-capability" },
  "awaiting-host-pass": { outcome: "failure", category: "operational-failure", phase: "execution", userAction: "retry-explicitly" },
  "awaiting-host-results": { outcome: "failure", category: "operational-failure", phase: "execution", userAction: "retry-explicitly" },
  "needs-host-results": { outcome: "failure", category: "operational-failure", phase: "execution", userAction: "retry-explicitly" },
  failed: { outcome: "failure", category: "operational-failure", phase: "execution", userAction: "retry-explicitly" },
  "materialization-failed": { outcome: "failure", category: "operational-failure", phase: "execution", userAction: "retry-explicitly" },
  "unexpected-step-status": { outcome: "failure", category: "internal-failure", phase: "internal", userAction: "retry-explicitly" },
  "workflow-error-boundary": { outcome: "failure", category: "internal-failure", phase: "internal", userAction: "retry-explicitly" }
});
var HOST_OUTCOME_CALLBACK = Object.freeze({
  tool: "close_host_outcome",
  mode: HOST_OUTCOME_CLOSURE,
  exactlyOnce: true,
  when: "success",
  missionIdPath: "mission.missionId",
  researchItemIdPath: null,
  decisionRevisionPath: null,
  boundArgNames: Object.freeze(["missionNumber"]),
  requiredOutcomeFields: Object.freeze(["attemptId", "status", "summary"]),
  defaults: Object.freeze({
    artifactPaths: Object.freeze([]),
    validationPaths: Object.freeze([]),
    facts: Object.freeze([])
  })
});
var RESEARCH_OUTCOME_FIELDS2 = Object.freeze([
  "attemptId",
  "status",
  "performedActionCount",
  "actualUsage",
  "evidenceReturned",
  "artifactPaths",
  "validationPaths",
  "facts",
  "startedAt",
  "finishedAt"
]);
var RESEARCH_OUTCOME_CONTRACT = Object.freeze({
  kind: "research-execution",
  evidenceReturnPath: "executionHandoff.expectedEvidence",
  budgetPath: "executionHandoff.budget",
  issuedAtPath: "executionHandoff.issuedAt",
  expiresAtPath: "executionHandoff.expiresAt"
});
var RESEARCH_OUTCOME_CALLBACK = Object.freeze({
  tool: "record_research_outcome",
  mode: RESEARCH_OUTCOME_CLOSURE,
  exactlyOnce: true,
  when: "research-handoff",
  missionIdPath: "decision.missionId",
  researchItemIdPath: null,
  decisionRevisionPath: "decision.revision",
  boundArgNames: Object.freeze(["missionNumber", "decisionRevision"]),
  requiredOutcomeFields: RESEARCH_OUTCOME_FIELDS2,
  defaults: Object.freeze({}),
  outcomeContract: RESEARCH_OUTCOME_CONTRACT
});
var AMBIENT_RESEARCH_OUTCOME_CALLBACK = Object.freeze({
  tool: "record_research_outcome",
  mode: RESEARCH_OUTCOME_CLOSURE,
  exactlyOnce: true,
  when: "research-handoff",
  missionIdPath: "currentResearchDecision.missionId",
  researchItemIdPath: null,
  decisionRevisionPath: "currentResearchDecision.revision",
  boundArgNames: Object.freeze(["missionNumber", "decisionRevision"]),
  requiredOutcomeFields: RESEARCH_OUTCOME_FIELDS2,
  defaults: Object.freeze({}),
  outcomeContract: RESEARCH_OUTCOME_CONTRACT
});
function resolvedPolicy(value, context) {
  return typeof value === "function" ? value(context) : value;
}
function assertPolicy(value, allowed2, label, operationId) {
  if (!allowed2.has(value)) throw new Error(`Invalid ${label} for Dove operation ${operationId}: ${value}`);
  return value;
}
function freezeCallback(callback, operationId) {
  if (callback === void 0 || callback === null) return null;
  if (typeof callback === "function") return Object.freeze(callback);
  if (!callback || typeof callback !== "object" || Array.isArray(callback)) throw new Error(`Dove operation ${operationId} callback must be an object.`);
  if (typeof callback.tool !== "string" || !callback.tool) throw new Error(`Dove operation ${operationId} callback requires a tool.`);
  assertPolicy(callback.mode, CALLBACK_MODES, "callback mode", operationId);
  if (callback.exactlyOnce !== true) throw new Error(`Dove operation ${operationId} callback must be exactly once.`);
  if (callback.when !== "success" && callback.when !== "research-handoff") throw new Error(`Invalid callback condition for Dove operation ${operationId}: ${callback.when}`);
  if (typeof callback.missionIdPath !== "string" || !callback.missionIdPath) throw new Error(`Dove operation ${operationId} callback requires a mission binding path.`);
  if (callback.researchItemIdPath !== null && (typeof callback.researchItemIdPath !== "string" || !callback.researchItemIdPath)) throw new Error(`Dove operation ${operationId} callback has an invalid research item binding path.`);
  if (callback.decisionRevisionPath !== null && (typeof callback.decisionRevisionPath !== "string" || !callback.decisionRevisionPath)) throw new Error(`Dove operation ${operationId} callback has an invalid decision revision binding path.`);
  if (callback.outcomeContract !== void 0) {
    const contract = callback.outcomeContract;
    if (!contract || typeof contract !== "object" || Array.isArray(contract) || contract.kind !== "research-execution") {
      throw new Error(`Dove operation ${operationId} callback has an invalid outcome contract.`);
    }
    for (const field of ["evidenceReturnPath", "budgetPath", "issuedAtPath", "expiresAtPath"]) {
      if (typeof contract[field] !== "string" || !contract[field]) throw new Error(`Dove operation ${operationId} callback outcome contract requires ${field}.`);
    }
  }
  return Object.freeze({
    ...callback,
    boundArgNames: Object.freeze([...callback.boundArgNames ?? []]),
    requiredOutcomeFields: Object.freeze([...callback.requiredOutcomeFields ?? []]),
    defaults: Object.freeze({ ...callback.defaults ?? {} }),
    outcomeContract: callback.outcomeContract === void 0 ? null : Object.freeze({ ...callback.outcomeContract })
  });
}
function freezeStatusSemantics(semantics, status, operationId) {
  if (!semantics || typeof semantics !== "object" || Array.isArray(semantics)) throw new Error(`Dove operation ${operationId} status ${status} requires semantics.`);
  assertPolicy(semantics.outcome, STATUS_OUTCOMES, "status outcome", operationId);
  if (semantics.category !== void 0) assertPolicy(semantics.category, STATUS_CATEGORIES, "status category", operationId);
  if (semantics.phase !== void 0) assertPolicy(semantics.phase, STATUS_PHASES, "status phase", operationId);
  if (semantics.userAction !== void 0) assertPolicy(semantics.userAction, STATUS_USER_ACTIONS, "status user action", operationId);
  if (semantics.retry !== void 0) assertPolicy(semantics.retry, RETRIES, "status retry", operationId);
  return Object.freeze({ ...semantics });
}
function freezeStatuses(statuses, operationId) {
  if (!statuses || typeof statuses !== "object" || Array.isArray(statuses)) throw new Error(`Dove operation ${operationId} requires a canonical status registry.`);
  const statusesWithCommon = { ...COMMON_OPERATION_STATUSES, ...statuses };
  const entries = Object.entries(statusesWithCommon);
  if (entries.length === 0) throw new Error(`Dove operation ${operationId} requires at least one registered status.`);
  return Object.freeze(Object.fromEntries(entries.map(([status, semantics]) => {
    if (typeof status !== "string" || !status.trim() || status !== status.trim().toLowerCase()) throw new Error(`Dove operation ${operationId} has an invalid status key: ${status}`);
    return [status, freezeStatusSemantics(semantics, status, operationId)];
  })));
}
function freezeOperation(operation) {
  if (typeof operation.id !== "string" || !operation.id) throw new Error("Dove operations require a stable id.");
  const publicProjector = operation.publicProjector;
  if (typeof publicProjector !== "string" || !publicProjector) throw new Error(`Dove operation ${operation.id} requires a public projector.`);
  if (typeof operation.interaction !== "function") assertPolicy(operation.interaction, INTERACTIONS, "interaction", operation.id);
  if (typeof operation.continuation !== "function" && operation.continuation !== void 0) assertPolicy(operation.continuation, CONTINUATIONS, "continuation", operation.id);
  if (typeof operation.closure !== "function" && operation.closure !== void 0) assertPolicy(operation.closure, CLOSURES, "closure", operation.id);
  if (typeof operation.presentation !== "function" && operation.presentation !== void 0) assertPolicy(operation.presentation, PRESENTATIONS, "presentation", operation.id);
  const retry = Object.freeze({ ...DEFAULT_RETRY, ...operation.retry ?? {} });
  for (const outcome of RETRY_OUTCOMES) assertPolicy(retry[outcome], RETRIES, `${outcome} retry`, operation.id);
  const callback = freezeCallback(operation.callback, operation.id);
  const statuses = freezeStatuses(operation.statuses, operation.id);
  return Object.freeze({
    checkpoint: false,
    continuation: TERMINAL,
    closure: NO_CLOSURE,
    presentation: "show",
    pathFields: Object.freeze([]),
    tools: Object.freeze([]),
    routes: Object.freeze({}),
    ...operation,
    publicProjector,
    statuses,
    retry,
    callback,
    pathFields: Object.freeze([...operation.pathFields ?? []]),
    tools: Object.freeze([...operation.tools ?? []]),
    routes: Object.freeze(Object.fromEntries(Object.entries(operation.routes ?? {}).map(([name, route]) => [name, Object.freeze({ ...route, pathFields: Object.freeze([...route.pathFields ?? []]) })])))
  });
}
var toolOperations = [
  freezeOperation({
    id: "tool.manage-dove-workspace",
    toolName: "manage_dove_workspace",
    publicProjector: "manage_dove_workspace",
    statuses: WORKSPACE_STATUSES,
    interaction: (args) => args?.operation === "set-mainline" ? "write" : "checkpoint",
    checkpoint: (args) => args?.operation !== "set-mainline"
  }),
  freezeOperation({
    id: "tool.manage-dove-mission",
    toolName: "manage_dove_mission",
    publicProjector: "create_dove_mission",
    statuses: statusPolicy({ ...MISSION_STATUSES, proposal: SUCCESS }),
    interaction: (args) => args?.operation === "query" ? "read" : ["start-skill", "reevaluate-research-decision"].includes(args?.operation) ? "write" : "checkpoint",
    checkpoint: (args) => ["create-root", "branch"].includes(args?.operation),
    continuation: (result) => result?.operation === "start-skill" || result?.executionHandoff ? RESUME_ORIGINAL : TERMINAL,
    closure: (result) => result?.operation === "start-skill" && !result?.executionHandoff ? HOST_OUTCOME_CLOSURE : result?.executionHandoff ? RESEARCH_OUTCOME_CLOSURE : NO_CLOSURE,
    callback: (result) => result?.operation === "start-skill" && !result?.executionHandoff ? HOST_OUTCOME_CALLBACK : result?.currentResearchDecision ? AMBIENT_RESEARCH_OUTCOME_CALLBACK : RESEARCH_OUTCOME_CALLBACK,
    routes: {
      query: { targetTool: "query_dove_mission", publicProjector: "query_dove_mission", interaction: "read", checkpoint: false, pathFields: ["artifacts[].path"] },
      "start-skill": { targetTool: "start_dove_skill_mission", publicProjector: "create_dove_mission", interaction: "write", checkpoint: false, pathFields: ["artifacts[].path", "contextArtifactPaths"] },
      "create-root": { targetTool: "create_dove_mission", publicProjector: "create_dove_mission", interaction: "checkpoint", checkpoint: true, pathFields: ["artifacts[].path"] },
      branch: { targetTool: "create_dove_mission", publicProjector: "create_dove_mission", interaction: "checkpoint", checkpoint: true, pathFields: ["artifacts[].path"] },
      "reevaluate-research-decision": { targetTool: "reevaluate_research_decision", publicProjector: "create_dove_mission", interaction: "write", checkpoint: false, pathFields: ["evidenceRefs"] }
    }
  }),
  freezeOperation({
    id: "tool.query-dove-status",
    toolName: "query_dove_status",
    publicProjector: "query_dove_status",
    statuses: statusPolicy({ ok: SUCCESS, ...COMPLETION_STATUSES }),
    interaction: "read",
    routes: {
      status: { targetTool: "query_dove_status", publicProjector: "query_dove_status", interaction: "read", checkpoint: false },
      completion: { targetTool: "assess_mission_completion", publicProjector: "assess_mission_completion", interaction: "read", checkpoint: false }
    }
  }),
  freezeOperation({
    id: "tool.manage-dove-sources",
    toolName: "manage_dove_sources",
    publicProjector: "query_sources",
    statuses: statusPolicy({ ...READ_OK, ...RECORDED }),
    interaction: (args) => args?.operation === "query" ? "read" : "write",
    routes: {
      query: { targetTool: "query_sources", publicProjector: "query_sources", interaction: "read", checkpoint: false },
      register: { targetTool: "register_source", publicProjector: "register_source", interaction: "write", checkpoint: false, pathFields: ["capturePath"] },
      reject: { targetTool: "verify_source", publicProjector: "verify_source", interaction: "write", checkpoint: false }
    },
    closure: DOMAIN_CLOSURE
  }),
  freezeOperation({ id: "tool.record-dove-experiment", toolName: "record_dove_experiment", publicProjector: "run_experience_workflow", statuses: RECORDED, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, routes: { record: { targetTool: "run_experience_workflow", publicProjector: "run_experience_workflow", interaction: "write", checkpoint: false } }, pathFields: ["result.artifactRefs", "result.validationRefs", "result.failures[].evidenceRefs"] }),
  freezeOperation({ id: "tool.record-dove-claims", toolName: "record_dove_claims", publicProjector: "upsert_claims", statuses: RECORDED, interaction: "write", closure: DOMAIN_CLOSURE, pathFields: ["claims[].artifactRefs", "claims[].validationRefs"] }),
  freezeOperation({ id: "tool.record-dove-draft", toolName: "record_dove_draft", publicProjector: "record_draft_archive", statuses: RECORDED, interaction: "write", closure: DOMAIN_CLOSURE, pathFields: ["artifactPath", "referencePaths"] }),
  freezeOperation({ id: "tool.record-dove-figure", toolName: "record_dove_figure", publicProjector: "record_figure_archive", statuses: RECORDED, interaction: "write", closure: DOMAIN_CLOSURE, pathFields: ["artifactPath", "referencePaths"] }),
  freezeOperation({
    id: "tool.manage-dove-review",
    toolName: "manage_dove_review",
    publicProjector: "scope_review_record",
    statuses: REVIEW_RECORD_STATUSES,
    interaction: (args) => args?.operation === "scope" ? "read" : "write",
    checkpoint: false,
    closure: DOMAIN_CLOSURE,
    routes: {
      scope: { targetTool: "scope_review_record", publicProjector: "scope_review_record", interaction: "read", checkpoint: false, pathFields: ["artifactPaths"] },
      archive: { targetTool: "archive_review_record", publicProjector: "archive_review_record", interaction: "write", checkpoint: false, pathFields: ["findings[].linkedArtifactPaths"] }
    }
  }),
  freezeOperation({ id: "tool.record-dove-rebuttal", toolName: "record_dove_rebuttal", publicProjector: "record_rebuttal_archive", statuses: RECORDED, interaction: "write", closure: DOMAIN_CLOSURE, pathFields: ["artifactPath", "referencePaths", "findingRefs"] }),
  freezeOperation({
    id: "tool.manage-dove-lessons",
    toolName: "manage_dove_lessons",
    publicProjector: "read_dove_lessons",
    statuses: statusPolicy({ ok: SUCCESS, updated: SUCCESS, planned: SUCCESS }),
    interaction: (args) => args?.operation === "read" ? "read" : "write",
    routes: {
      read: { targetTool: "read_dove_lessons", publicProjector: "read_dove_lessons", interaction: "read", checkpoint: false },
      update: { targetTool: "update_dove_lessons", publicProjector: "update_dove_lessons", interaction: "write", checkpoint: false }
    }
  }),
  freezeOperation({
    id: "tool.create-ambient-dove-mission",
    toolName: "create_ambient_dove_mission",
    publicProjector: "create_ambient_dove_mission",
    statuses: statusPolicy({ materialized: SUCCESS, "materialization-planned": SUCCESS }),
    interaction: "ambient-create",
    continuation: RESUME_ORIGINAL,
    closure: (result) => result?.mission?.mode === "research" ? RESEARCH_OUTCOME_CLOSURE : HOST_OUTCOME_CLOSURE,
    callback: (result) => result?.mission?.mode === "research" ? AMBIENT_RESEARCH_OUTCOME_CALLBACK : HOST_OUTCOME_CALLBACK,
    presentation: "silent-on-success",
    pathFields: ["artifacts[].path"]
  }),
  freezeOperation({ id: "tool.close-host-outcome", toolName: "close_host_outcome", publicProjector: "close_host_outcome", statuses: RECEIPT_STATUSES, interaction: "write", closure: DOMAIN_CLOSURE, pathFields: ["artifactPaths", "validationPaths"] }),
  freezeOperation({ id: "tool.record-research-outcome", toolName: "record_research_outcome", publicProjector: "record_research_outcome", statuses: statusPolicy({ recorded: SUCCESS, ...RECEIPT_STATUSES }), interaction: "write", closure: DOMAIN_CLOSURE, pathFields: ["artifactPaths", "validationPaths"] })
];
var COMMAND_STATUS = statusPolicy({ ok: SUCCESS });
var commandOperations = [
  freezeOperation({ id: "command.dove.workspace", publicProjector: "command-public-report", commandId: "dove.workspace", statuses: COMMAND_STATUS, interaction: "write", tools: ["query_dove_status", "manage_dove_workspace"], pathInput: "none" }),
  freezeOperation({ id: "command.dove.mission", publicProjector: "command-public-report", commandId: "dove.mission", statuses: COMMAND_STATUS, interaction: "checkpoint", checkpoint: true, tools: ["query_dove_status", "manage_dove_mission"], pathInput: "none" }),
  freezeOperation({ id: "command.dove.status", publicProjector: "command-public-report", commandId: "dove.status", statuses: COMMAND_STATUS, interaction: "read", tools: ["query_dove_status"], pathInput: "none" }),
  freezeOperation({ id: "command.dove.lessons", publicProjector: "command-public-report", commandId: "dove.lessons", statuses: COMMAND_STATUS, interaction: "write", tools: ["manage_dove_lessons"], pathInput: "none" }),
  freezeOperation({ id: "command.dove.source", publicProjector: "command-public-report", commandId: "dove.source", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, tools: ["query_dove_status", "manage_dove_mission", "manage_dove_sources"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.note", publicProjector: "command-public-report", commandId: "dove.note", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, tools: ["query_dove_status", "manage_dove_mission"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.experience", publicProjector: "command-public-report", commandId: "dove.experience", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, tools: ["query_dove_status", "manage_dove_mission"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.experiment", publicProjector: "command-public-report", commandId: "dove.experiment", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, tools: ["query_dove_status", "manage_dove_mission", "record_dove_experiment", "record_dove_claims"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.draft", publicProjector: "command-public-report", commandId: "dove.draft", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, tools: ["query_dove_status", "manage_dove_mission", "record_dove_draft"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.figure", publicProjector: "command-public-report", commandId: "dove.figure", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, tools: ["query_dove_status", "manage_dove_mission", "record_dove_figure"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.review", publicProjector: "command-public-report", commandId: "dove.review", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, tools: ["query_dove_status", "manage_dove_mission", "manage_dove_review"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.rebuttal", publicProjector: "command-public-report", commandId: "dove.rebuttal", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, tools: ["query_dove_status", "manage_dove_mission", "record_dove_rebuttal"], pathInput: "workspace-file" })
];
var OPERATION_REGISTRY = Object.freeze([...toolOperations, ...commandOperations]);
var TOOL_OPERATIONS = Object.freeze(toolOperations);
var COMMAND_OPERATIONS = Object.freeze(commandOperations);
var OPERATION_BY_ID = new Map(OPERATION_REGISTRY.map((operation) => [operation.id, operation]));
var OPERATION_BY_TOOL = new Map(toolOperations.map((operation) => [operation.toolName, operation]));
var OPERATION_BY_TARGET_TOOL = /* @__PURE__ */ new Map();
for (const operation of toolOperations) {
  for (const route of Object.values(operation.routes)) {
    const existing = OPERATION_BY_TARGET_TOOL.get(route.targetTool);
    if (existing && existing !== operation) throw new Error(`Dove target tool ${route.targetTool} maps to more than one canonical operation.`);
    OPERATION_BY_TARGET_TOOL.set(route.targetTool, operation);
  }
}
var OPERATION_BY_COMMAND = new Map(commandOperations.map((operation) => [operation.commandId, operation]));
if (OPERATION_BY_ID.size !== OPERATION_REGISTRY.length) throw new Error("Dove operation ids must be unique.");
if (OPERATION_BY_TOOL.size !== toolOperations.length) throw new Error("Dove tool operations must be unique.");
if (OPERATION_BY_COMMAND.size !== commandOperations.length) throw new Error("Dove command operations must be unique.");
function requireOperation(operation, label) {
  if (!operation) throw new Error(`Unknown Dove operation: ${label}`);
  return operation;
}
function operationById(id3) {
  return requireOperation(OPERATION_BY_ID.get(id3), id3);
}
function operationForTool(name) {
  return requireOperation(OPERATION_BY_TOOL.get(name) ?? OPERATION_BY_TARGET_TOOL.get(name), name);
}
function operationRoute(operation, args = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const routes = selected.routes ?? {};
  if (Object.keys(routes).length === 0) return null;
  const operationName = typeof args?.operation === "string" ? args.operation : Object.keys(routes).length === 1 ? Object.keys(routes)[0] : null;
  return operationName ? routes[operationName] ?? null : null;
}
function operationTargetTool(operation, args = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const route = operationRoute(selected, args);
  if (Object.keys(selected.routes ?? {}).length > 0 && !route) throw new Error(`${selected.toolName ?? selected.id} requires one canonical operation.`);
  return route?.targetTool ?? selected.toolName;
}
function operationInteraction(operation, args = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const route = operationRoute(selected, args);
  return assertPolicy(route?.interaction ?? resolvedPolicy(selected.interaction, args), INTERACTIONS, "interaction", selected.id);
}
function operationRequiresCheckpoint(operation, args = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const route = operationRoute(selected, args);
  const checkpoint = route?.checkpoint ?? resolvedPolicy(selected.checkpoint, args);
  if (typeof checkpoint !== "boolean") throw new Error(`Invalid checkpoint policy for Dove operation ${selected.id}: ${checkpoint}`);
  return checkpoint;
}
function operationContinuation(operation, result = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  return assertPolicy(resolvedPolicy(selected.continuation, result), CONTINUATIONS, "continuation", selected.id);
}
function operationClosure(operation, result = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  return assertPolicy(resolvedPolicy(selected.closure, result), CLOSURES, "closure", selected.id);
}
function operationRetry(operation, outcome) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  if (!RETRY_OUTCOMES.includes(outcome)) throw new Error(`Unknown Dove operation retry outcome: ${outcome}`);
  return assertPolicy(selected.retry[outcome], RETRIES, `${outcome} retry`, selected.id);
}
function operationStatus(operation, status) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const normalized3 = typeof status === "string" ? status.trim().toLowerCase() : "";
  return normalized3 ? selected.statuses[normalized3] ?? null : null;
}
function operationPresentation(operation, result = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  return assertPolicy(resolvedPolicy(selected.presentation, result), PRESENTATIONS, "presentation", selected.id);
}
function operationCallback(operation, result = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const callback = resolvedPolicy(selected.callback, result);
  if (!callback || operationClosure(selected, result) !== callback.mode) return null;
  if (callback.when === "research-handoff" && !result?.executionHandoff) return null;
  return callback;
}
function operationPublicProjector(operation, args = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const projector = operationRoute(selected, args)?.publicProjector ?? selected.publicProjector;
  if (typeof projector !== "string" || !projector) throw new Error(`Dove operation ${selected.id} requires a public projector.`);
  return projector;
}

// src/core/config.mjs
import fs14 from "node:fs";
import os from "node:os";
import path19 from "node:path";
function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function normalizedString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function configPaths(root, env) {
  const paths2 = [];
  const xdg = normalizedString(env.XDG_CONFIG_HOME) ?? path19.join(os.homedir(), ".config");
  paths2.push(path19.join(xdg, "dove", "config.json"));
  if (root) {
    paths2.push(path19.resolve(root, ".dove", "config.json"));
    paths2.push(path19.resolve(root, ".dove", "config.local.json"));
  }
  return paths2;
}
function readConfig(filePath2) {
  if (!fs14.existsSync(filePath2)) return null;
  try {
    const value = JSON.parse(fs14.readFileSync(filePath2, "utf8"));
    if (!plainObject(value)) throw new Error("top level must be an object");
    return value;
  } catch (error) {
    throw new Error(`Failed to read Dove config ${filePath2}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function merge(left, right) {
  const output = { ...left };
  for (const [key, value] of Object.entries(right ?? {})) {
    output[key] = plainObject(output[key]) && plainObject(value) ? merge(output[key], value) : structuredClone(value);
  }
  return output;
}
function loadDoveConfig(root, env = process.env) {
  let source = {};
  for (const filePath2 of configPaths(root, env)) {
    const value = readConfig(filePath2);
    if (value) source = merge(source, value);
  }
  const environmentLanguage = normalizedString(env.DOVE_LANGUAGE);
  return {
    version: 1,
    language: normalizeDoveResponseLanguage(environmentLanguage ?? source.language, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true })
  };
}
function loadExplicitDoveLanguageConfig(root, env = process.env) {
  let language = null;
  for (const filePath2 of configPaths(root, env)) {
    const value = readConfig(filePath2);
    if (value && value.language !== void 0) language = value.language;
  }
  language = normalizedString(env.DOVE_LANGUAGE) ?? language;
  return language ? normalizeDoveResponseLanguage(language, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true }) : null;
}
function loadDoveLanguageConfig(root, env = process.env) {
  return loadDoveConfig(root, env).language;
}

// src/core/i18n.mjs
function explicitLanguage(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    const value = source.language;
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}
function resolveDoveResponseLanguage(root, args = {}, options = {}) {
  const requested = explicitLanguage(args, args.settings);
  if (requested) return normalizeDoveResponseLanguage(requested, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true });
  const env = options.env ?? process.env;
  const configured = options.configLanguage ?? loadExplicitDoveLanguageConfig(root, env);
  return configured ?? loadDoveLanguageConfig(root, env);
}

// src/core/operational-outcome.mjs
var INVOCATION_OUTCOME_KINDS = /* @__PURE__ */ new Set(["succeeded", "declined", "cancelled", "failed", "continuation"]);
var OUTCOME_CATEGORIES = /* @__PURE__ */ new Set([
  "success",
  "success-zero-write",
  "awaiting-approval",
  "declined",
  "cancelled",
  "invalid-input",
  "ambiguous-target",
  "not-found",
  "stale-state",
  "capability-unavailable",
  "blocked",
  "evidence-incomplete",
  "operational-failure",
  "internal-failure"
]);
var OUTCOME_PHASES = /* @__PURE__ */ new Set(["approval", "validation", "selection", "read", "execution", "evidence", "internal"]);
var USER_ACTIONS = /* @__PURE__ */ new Set(["none", "approve-or-cancel", "clarify-input", "select-target", "refresh-state", "enable-capability", "resolve-blocker", "provide-evidence", "retry-explicitly", "reassess-read-only"]);
var CONTINUATIONS2 = /* @__PURE__ */ new Set(["terminal", "resume-original"]);
var CLOSURES2 = /* @__PURE__ */ new Set(["none", "host-outcome", "research-outcome", "domain"]);
var RETRIES2 = /* @__PURE__ */ new Set(["none", "explicit-request"]);
function normalizeStatus(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function assertEnum(value, allowed2, label) {
  if (!allowed2.has(value)) throw new Error(`Unsupported invocation ${label}: ${value}`);
  return value;
}
function deriveOutcomeSemantics(kind, reason, { zeroWrite = false } = {}) {
  if (kind === "declined") return { category: "declined", phase: "approval", blocking: false, userAction: "none" };
  if (kind === "cancelled") return { category: "cancelled", phase: "approval", blocking: false, userAction: "none" };
  if (kind === "succeeded" || kind === "continuation") return { category: zeroWrite ? "success-zero-write" : "success", phase: "execution", blocking: false, userAction: "none" };
  return { category: reason === "internal-failure" || reason === "unknown-operation-status" ? "internal-failure" : "operational-failure", phase: reason === "internal-failure" || reason === "unknown-operation-status" ? "internal" : "execution", blocking: true, userAction: "retry-explicitly" };
}
function createInvocationOutcome({
  kind,
  category,
  phase,
  blocking,
  userAction,
  continuation = "terminal",
  closure = "none",
  retry = "none",
  terminal,
  reason = null,
  zeroWrite = false
}) {
  assertEnum(kind, INVOCATION_OUTCOME_KINDS, "outcome kind");
  assertEnum(continuation, CONTINUATIONS2, "continuation");
  assertEnum(closure, CLOSURES2, "closure");
  assertEnum(retry, RETRIES2, "retry policy");
  const semantics = deriveOutcomeSemantics(kind, reason, { zeroWrite });
  const selectedCategory = category ?? semantics.category;
  const selectedPhase = phase ?? semantics.phase;
  const selectedUserAction = userAction ?? semantics.userAction;
  assertEnum(selectedCategory, OUTCOME_CATEGORIES, "category");
  assertEnum(selectedPhase, OUTCOME_PHASES, "phase");
  assertEnum(selectedUserAction, USER_ACTIONS, "user action");
  return Object.freeze({
    kind,
    category: selectedCategory,
    phase: selectedPhase,
    blocking: blocking ?? semantics.blocking,
    userAction: selectedUserAction,
    terminal: terminal ?? continuation === "terminal",
    continuation,
    closure,
    retry,
    ...typeof reason === "string" && reason.trim() ? { reason: reason.trim() } : {}
  });
}
function registeredStatus(result, operation) {
  const status = normalizeStatus(result?.status ?? result?.outcome);
  return { status, semantics: operationStatus(operation, status) };
}
function classifyInvocationOutcome(result, operation, invocationArgs = result) {
  const { status, semantics } = registeredStatus(result, operation);
  const readOnly = operationInteraction(operation, invocationArgs) === "read";
  if (!semantics) {
    return createInvocationOutcome({
      kind: "failed",
      category: "internal-failure",
      phase: "internal",
      blocking: true,
      userAction: "retry-explicitly",
      continuation: "terminal",
      closure: "none",
      retry: "none",
      reason: "unknown-operation-status",
      zeroWrite: result?.zeroWrite === true
    });
  }
  if (semantics.outcome === "proposal") {
    if (!operationRequiresCheckpoint(operation, invocationArgs)) {
      return createInvocationOutcome({ kind: "failed", category: "internal-failure", phase: "internal", blocking: true, userAction: "retry-explicitly", continuation: "terminal", closure: "none", retry: "none", reason: "unexpected-proposal-status", zeroWrite: true });
    }
    return createInvocationOutcome({ kind: "continuation", category: semantics.category, phase: semantics.phase, blocking: false, userAction: semantics.userAction, continuation: "terminal", closure: "none", retry: semantics.retry ?? "none", reason: "checkpoint-approval-required", zeroWrite: true });
  }
  if (semantics.outcome === "declined" || semantics.outcome === "cancelled") {
    return createInvocationOutcome({
      kind: semantics.outcome,
      category: semantics.category,
      phase: semantics.phase,
      blocking: false,
      userAction: semantics.userAction,
      continuation: "terminal",
      closure: "none",
      retry: semantics.retry ?? operationRetry(operation, semantics.outcome),
      reason: semantics.outcome === "declined" ? "checkpoint-declined" : "checkpoint-cancelled",
      zeroWrite: true
    });
  }
  if (semantics.outcome === "failure") {
    return createInvocationOutcome({
      kind: "failed",
      category: semantics.category,
      phase: semantics.phase,
      blocking: true,
      userAction: semantics.userAction,
      continuation: "terminal",
      closure: "none",
      retry: semantics.retry ?? operationRetry(operation, "failed"),
      reason: status,
      zeroWrite: result?.zeroWrite === true
    });
  }
  if (semantics.outcome === "replay") {
    return createInvocationOutcome({
      kind: "succeeded",
      category: semantics.category,
      phase: readOnly ? "read" : semantics.phase,
      blocking: false,
      userAction: semantics.userAction,
      continuation: "terminal",
      closure: "none",
      retry: semantics.retry ?? "none",
      reason: status,
      zeroWrite: true
    });
  }
  const continuation = operationContinuation(operation, result);
  return createInvocationOutcome({
    kind: continuation === "terminal" ? "succeeded" : "continuation",
    category: semantics.category,
    phase: readOnly ? "read" : semantics.phase,
    blocking: false,
    userAction: semantics.userAction,
    continuation,
    closure: operationClosure(operation, result),
    retry: semantics.retry ?? operationRetry(operation, "succeeded"),
    zeroWrite: readOnly || result?.zeroWrite === true
  });
}
function classifyInvocationError(error, operation) {
  const message = normalizeStatus(error instanceof Error ? error.message : String(error));
  let reason = "internal-failure";
  let category = "internal-failure";
  let phase = "internal";
  let userAction = "retry-explicitly";
  if (/ambiguous|conflict|choose|select.*explicit/u.test(message)) {
    reason = "ambiguous-target";
    category = "ambiguous-target";
    phase = "selection";
    userAction = "select-target";
  } else if (/not found|does not exist|unknown (?:mission|source|note|claim|experiment|figure|review|exchange|version|lesson|receipt|criterion)/u.test(message)) {
    reason = "not-found";
    category = "not-found";
    phase = "selection";
    userAction = "select-target";
  } else if (/stale|no longer current|no longer accepts|changed|mismatch|superseded/u.test(message)) {
    reason = "stale-state";
    category = "stale-state";
    phase = "validation";
    userAction = "refresh-state";
  } else if (/elicitation support|capability unavailable|provider unavailable|missing secret/u.test(message)) {
    reason = "capability-unavailable";
    category = "capability-unavailable";
    phase = "execution";
    userAction = "enable-capability";
  } else if (/evidence|coverage|source provenance|review (?:coverage|authority|evidence|issuer)/u.test(message)) {
    reason = "evidence-incomplete";
    category = "evidence-incomplete";
    phase = "evidence";
    userAction = "provide-evidence";
  } else if (/invalid|unsafe|does not accept|must\b|may report .* only|cannot declare|requires?\b|references unknown requirement|references unknown mission reference|regular file|future file|unsupported action|plain object/u.test(message)) {
    reason = "invalid-input";
    category = "invalid-input";
    phase = "validation";
    userAction = "clarify-input";
  } else if (/blocked|cannot proceed|could not complete/u.test(message)) {
    reason = "blocked";
    category = "blocked";
    phase = "execution";
    userAction = "resolve-blocker";
  }
  return createInvocationOutcome({
    kind: "failed",
    category,
    phase,
    blocking: true,
    userAction,
    continuation: "terminal",
    closure: "none",
    retry: operationRetry(operation, "failed"),
    reason
  });
}

// src/core/mission-queries.mjs
import fs18 from "node:fs";
import path23 from "node:path";

// src/core/execution-receipts.mjs
import crypto17 from "node:crypto";
import fs15 from "node:fs";
import path20 from "node:path";

// src/core/research-narratives.mjs
var NARRATIVE_FIELDS = /* @__PURE__ */ new Set([
  "researchDirection",
  "currentUnderstanding",
  "evidence",
  "unknowns",
  "currentValueJudgment",
  "nextStep",
  "stopReason",
  "rejectedDirections",
  "applicableLessons"
]);
var REJECTED_DIRECTION_FIELDS = /* @__PURE__ */ new Set(["direction", "reason"]);
var APPLICABLE_LESSON_FIELDS = /* @__PURE__ */ new Set(["lesson", "application"]);
var BUILD_FROM_DECISION_OPTION_FIELDS = /* @__PURE__ */ new Set(["awaitingReevaluation"]);
var RENDER_OPTION_FIELDS = /* @__PURE__ */ new Set(["language"]);
var SUPPORTED_LANGUAGES = /* @__PURE__ */ new Set(["zh", "en"]);
var FORBIDDEN_TEXT = [
  /\.dove(?:-archive)?(?:[\\/]|\b)/iu,
  /(?:^|\s)\/(?:[^\s/]+\/)+[^\s/]+/u,
  /\b[A-Za-z]:\\[^\s]+/u,
  /\b[0-9a-f]{32,128}\b/iu,
  /\b(?:schema|format)[-_ ]?version\b/iu,
  /\b(?:digest|fingerprint|proposal(?:version|workspace|digest|token)|confirmargs|exact[-_ ]?replay|mutationmode|host[-_ ]?control|resume[-_ ]?original|host[-_ ]?outcome|closure|retry|archiveTarget|resultMode|contractDigest|missionId|decisionId|actionId|lessonId)\b/iu
];
function assertPlainRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} must be a plain object.`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") throw new Error(`${label} does not accept symbol fields.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) throw new Error(`${label}.${key} must be an enumerable data field.`);
  }
}
function assertSealedRecord(value, fields, label) {
  assertPlainRecord(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function assertJsonArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const unexpected = Reflect.ownKeys(value).filter((key) => typeof key !== "string" || key !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(key));
  if (unexpected.length > 0) throw new Error(`${label} must not contain custom fields.`);
}
function normalizeResearchNarrativeText(value, label = "Research narrative text") {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  const normalized3 = value.trim().replace(/\s+/gu, " ");
  if (FORBIDDEN_TEXT.some((pattern) => pattern.test(normalized3))) throw new Error(`${label} must not contain private or control metadata.`);
  return normalized3;
}
function safeResearchNarrativeSourceText(value) {
  try {
    return normalizeResearchNarrativeText(value);
  } catch {
    return null;
  }
}
function normalizeTexts(value, label) {
  assertJsonArray(value, label);
  return Object.freeze([...new Set(value.map((item, index) => normalizeResearchNarrativeText(item, `${label}[${index}]`)))]);
}
function normalizeObjects(value, fields, label, normalizeItem) {
  assertJsonArray(value, label);
  return Object.freeze(value.map((item, index) => {
    const itemLabel = `${label}[${index}]`;
    assertSealedRecord(item, fields, itemLabel);
    for (const field of fields) if (!Object.hasOwn(item, field)) throw new Error(`${itemLabel} requires $.${field}.`);
    return Object.freeze(normalizeItem(item, itemLabel));
  }));
}
function normalizeResearchNarrative(value) {
  assertSealedRecord(value, NARRATIVE_FIELDS, "ResearchNarrative");
  for (const field of NARRATIVE_FIELDS) {
    if (!["nextStep", "stopReason"].includes(field) && !Object.hasOwn(value, field)) throw new Error(`ResearchNarrative requires $.${field}.`);
  }
  const nextStep = value.nextStep == null ? null : normalizeResearchNarrativeText(value.nextStep, "ResearchNarrative.nextStep");
  const stopReason = value.stopReason == null ? null : normalizeResearchNarrativeText(value.stopReason, "ResearchNarrative.stopReason");
  if (nextStep === null === (stopReason === null)) throw new Error("ResearchNarrative requires exactly one of nextStep or stopReason.");
  return Object.freeze({
    researchDirection: normalizeResearchNarrativeText(value.researchDirection, "ResearchNarrative.researchDirection"),
    currentUnderstanding: normalizeTexts(value.currentUnderstanding, "ResearchNarrative.currentUnderstanding"),
    evidence: normalizeTexts(value.evidence, "ResearchNarrative.evidence"),
    unknowns: normalizeTexts(value.unknowns, "ResearchNarrative.unknowns"),
    currentValueJudgment: normalizeResearchNarrativeText(value.currentValueJudgment, "ResearchNarrative.currentValueJudgment"),
    nextStep,
    stopReason,
    rejectedDirections: normalizeObjects(value.rejectedDirections, REJECTED_DIRECTION_FIELDS, "ResearchNarrative.rejectedDirections", (item, label) => ({
      direction: normalizeResearchNarrativeText(item.direction, `${label}.direction`),
      reason: normalizeResearchNarrativeText(item.reason, `${label}.reason`)
    })),
    applicableLessons: normalizeObjects(value.applicableLessons, APPLICABLE_LESSON_FIELDS, "ResearchNarrative.applicableLessons", (item, label) => ({
      lesson: normalizeResearchNarrativeText(item.lesson, `${label}.lesson`),
      application: normalizeResearchNarrativeText(item.application, `${label}.application`)
    }))
  });
}
function safeDecisionTexts(values, fallback) {
  if (values.length === 0) return [];
  const safe = values.map(safeResearchNarrativeSourceText).filter(Boolean);
  return safe.length > 0 ? safe : [fallback];
}
function buildResearchNarrativeFromDecision(value, options = {}) {
  assertSealedRecord(options, BUILD_FROM_DECISION_OPTION_FIELDS, "ResearchNarrative decision options");
  const decision = validatePersistedResearchDecision(value, { label: "Research narrative decision" });
  const directive = options.awaitingReevaluation === true ? Object.freeze({ mode: "next-step", text: "Reevaluate the recorded execution evidence before repeating or authorizing another action." }) : researchDecisionNarrativeDirective(decision);
  const synthesis = safeResearchNarrativeSourceText(decision.synthesis) ?? "A current research judgment is recorded, but its wording cannot be shown safely.";
  const evidence = safeDecisionTexts(decision.evidenceRefs, "Current recorded evidence exists, but its internal references are not public.");
  const unknowns = safeDecisionTexts(decision.openQuestions.map((item) => item.question), "A recorded research uncertainty exists, but its wording cannot be shown safely.");
  const rejectedDirections2 = decision.routes.filter((route) => route.disposition === "rejected").flatMap((route) => {
    const direction = safeResearchNarrativeSourceText(route.summary);
    const reason = safeResearchNarrativeSourceText(route.rationale);
    return direction && reason ? [{ direction, reason }] : [];
  });
  const directiveText = directive.mode === "authorized-action" ? safeResearchNarrativeSourceText(decision.nextAction.description) ?? "Perform the current bounded research action." : safeResearchNarrativeSourceText(directive.text) ?? "Reevaluate the current evidence before authorizing another action.";
  return normalizeResearchNarrative({
    researchDirection: synthesis,
    currentUnderstanding: [synthesis],
    evidence,
    unknowns,
    currentValueJudgment: synthesis,
    nextStep: directive.mode === "stop-reason" ? null : directiveText,
    stopReason: directive.mode === "stop-reason" ? directiveText : null,
    rejectedDirections: rejectedDirections2,
    applicableLessons: []
  });
}
function renderChinese(narrative) {
  const lines = [
    `\u5F53\u524D\u4EFB\u52A1\u7684\u7814\u7A76\u65B9\u5411\u662F\uFF1A${narrative.researchDirection}`,
    `\u76EE\u524D\u7684\u8BA4\u8BC6\u662F\uFF1A${narrative.currentUnderstanding.join("\uFF1B")}`,
    narrative.evidence.length > 0 ? `\u73B0\u6709\u8BC1\u636E\u5305\u62EC\uFF1A${narrative.evidence.join("\uFF1B")}` : "\u76EE\u524D\u8FD8\u6CA1\u6709\u8DB3\u4EE5\u652F\u6491\u5224\u65AD\u7684\u76F4\u63A5\u8BC1\u636E\u3002",
    narrative.unknowns.length > 0 ? `\u8FD8\u4E0D\u77E5\u9053\u7684\u662F\uFF1A${narrative.unknowns.join("\uFF1B")}` : "\u5F53\u524D\u6CA1\u6709\u660E\u786E\u7684\u5173\u952E\u672A\u77E5\u3002",
    `\u5C31\u76EE\u524D\u800C\u8A00\uFF1A${narrative.currentValueJudgment}`
  ];
  if (narrative.rejectedDirections.length > 0) lines.push(`\u5DF2\u7ECF\u5426\u5B9A\u7684\u65B9\u5411\u5305\u62EC\uFF1A${narrative.rejectedDirections.map((item) => `${item.direction}\uFF08${item.reason}\uFF09`).join("\uFF1B")}`);
  if (narrative.applicableLessons.length > 0) lines.push(`\u53EF\u6CBF\u7528\u7684\u7ECF\u9A8C\u662F\uFF1A${narrative.applicableLessons.map((item) => `${item.lesson}\uFF0C\u7528\u4E8E${item.application}`).join("\uFF1B")}`);
  lines.push(narrative.nextStep ? `\u4E0B\u4E00\u6B65\uFF1A${narrative.nextStep}` : `\u73B0\u5728\u53EF\u4EE5\u505C\u6B62\uFF0C\u56E0\u4E3A${narrative.stopReason}`);
  return lines.join("\n\n");
}
function renderEnglish(narrative) {
  const lines = [
    `This mission is centered on: ${narrative.researchDirection}`,
    `Current understanding: ${narrative.currentUnderstanding.join("; ")}`,
    narrative.evidence.length > 0 ? `The evidence so far includes: ${narrative.evidence.join("; ")}` : "There is not yet direct evidence strong enough to support the judgment.",
    narrative.unknowns.length > 0 ? `What remains unknown: ${narrative.unknowns.join("; ")}` : "There are no clearly identified critical unknowns at present.",
    `At this point: ${narrative.currentValueJudgment}`
  ];
  if (narrative.rejectedDirections.length > 0) lines.push(`Directions already ruled out: ${narrative.rejectedDirections.map((item) => `${item.direction} (${item.reason})`).join("; ")}`);
  if (narrative.applicableLessons.length > 0) lines.push(`Applicable lessons: ${narrative.applicableLessons.map((item) => `${item.lesson}, applied to ${item.application}`).join("; ")}`);
  lines.push(narrative.nextStep ? `Next: ${narrative.nextStep}` : `The mission can stop here because ${narrative.stopReason}`);
  return lines.join("\n\n");
}
function renderResearchNarrative(value, options = {}) {
  assertSealedRecord(options, RENDER_OPTION_FIELDS, "ResearchNarrative render options");
  const language = options.language ?? "zh";
  if (typeof language !== "string" || !SUPPORTED_LANGUAGES.has(language)) throw new Error("ResearchNarrative render language must be zh or en.");
  const narrative = normalizeResearchNarrative(value);
  return language === "zh" ? renderChinese(narrative) : renderEnglish(narrative);
}

// src/core/execution-receipts.mjs
var EXECUTION_RECEIPT_ARTIFACT_KINDS = Object.freeze(["report", "document", "code", "data", "figure", "media", "other"]);
var ARTIFACT_KIND_SET = new Set(EXECUTION_RECEIPT_ARTIFACT_KINDS);
var HOST_OUTCOME_FIELDS = /* @__PURE__ */ new Set([
  "missionId",
  "attemptId",
  "status",
  "summary",
  "artifactPaths",
  "validationPaths",
  "facts"
]);
var HOST_OUTCOME_STATUS_SET = new Set(ORDINARY_HOST_OUTCOME_STATUSES);
var VALIDATION_INPUT_FIELDS = new Set(VALIDATION_FIELDS);
var RECEIPT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var POST_COMMIT_ASSESSMENT_FIELDS = /* @__PURE__ */ new Set(["kind", "missionId"]);
var POST_COMMIT_ASSESSMENT_KIND = "assess-mission-completion";
function assertPlainObject6(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertAllowedFields(value, allowed2, label) {
  assertPlainObject6(value, label);
  const unknown = Object.keys(value).filter((field) => !allowed2.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function nonEmptyString2(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}
function safeId10(value, label) {
  const id3 = nonEmptyString2(value, label);
  if (!RECEIPT_ID_PATTERN.test(id3)) {
    throw new Error(`${label} must start with a lowercase letter or digit and contain only lowercase letters, digits, dot, underscore, or hyphen.`);
  }
  return id3;
}
function executionReceiptPath(receiptId) {
  return path20.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
}
function missionContractPath(missionId2) {
  return path20.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId2}.json`);
}
function inspectCurrentFile(root, rawPath, label) {
  const normalized3 = normalizeProjectRelativePath(rawPath);
  if (!normalized3.ok) {
    throw new Error(`${label} has an unsafe path ${JSON.stringify(rawPath)}: ${normalized3.reason}.`);
  }
  if (normalized3.normalizedPath !== rawPath.trim().replace(/\\/gu, "/")) {
    throw new Error(`${label} path must be canonical: ${rawPath}.`);
  }
  const inspection = inspectDeclaredPath(root, normalized3.normalizedPath, { requireNonEmpty: true });
  if (inspection.status !== "existing") {
    throw new Error(`${label} must be a safe existing non-empty regular file: ${normalized3.normalizedPath} (${inspection.reason ?? inspection.status}).`);
  }
  const canonicalPath4 = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath4 !== normalized3.normalizedPath) {
    throw new Error(`${label} must use its canonical realpath-contained path; alias ${normalized3.normalizedPath} resolves to ${canonicalPath4}.`);
  }
  const snapshot = snapshotArtifactBuffer(root, canonicalPath4, label);
  return {
    path: snapshot.path,
    sha256: snapshot.sha256
  };
}
function hostOutcomeStrings(value, label, normalize = nonEmptyString2) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const items = value.map((item, index) => normalize(item, `${label}[${index}]`));
  const identities = items.map((item) => typeof item === "string" ? item : item.factId);
  if (new Set(identities).size !== identities.length) throw new Error(`${label} must not contain duplicates.`);
  return items;
}
function hostOutcomePaths(value, label) {
  return hostOutcomeStrings(value, label);
}
function hostOutcomeFacts(value, mission) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error("facts must be an array.");
  const criteria = missionCompletionCriteria(mission);
  const normalized3 = value.map((item, index) => {
    const label = `facts[${index}]`;
    assertAllowedFields(item, /* @__PURE__ */ new Set(["statement", "criterionNumbers"]), label);
    if (!Array.isArray(item.criterionNumbers)) throw new Error(`${label}.criterionNumbers must be an array.`);
    const criterionNumbers = item.criterionNumbers.map((number2, numberIndex) => {
      if (!Number.isSafeInteger(number2) || number2 < 1 || number2 > criteria.length) throw new Error(`${label}.criterionNumbers[${numberIndex}] must select a current one-based completion criterion.`);
      return number2;
    });
    if (new Set(criterionNumbers).size !== criterionNumbers.length) throw new Error(`${label}.criterionNumbers must not contain duplicates.`);
    return { fact: createExecutionFact(item.statement, `${label}.statement`), criterionNumbers };
  });
  if (new Set(normalized3.map((item) => item.fact.factId)).size !== normalized3.length) throw new Error("facts must not contain duplicate statements.");
  return normalized3;
}
function inspectHostOutcomeFile(root, rawPath, label) {
  const inspected = inspectCurrentFile(root, rawPath, label);
  assertNotDoveLessonArtifactPath(inspected.path, label);
  const evidenceRole = artifactEvidenceRole(inspected.path);
  if (evidenceRole === "bookkeeping") {
    throw new Error(`${label} must be a substantive workspace file rather than Dove bookkeeping.`);
  }
  if (evidenceRole === "unsupported") {
    throw new Error(`${label} is not an eligible host-produced workspace file.`);
  }
  return { ...inspected, evidenceRole };
}
function skippedHostOutcome(mutationContext, status, reason, outcomeStatus = null) {
  return {
    status,
    zeroWrite: true,
    reason,
    ...outcomeStatus ? { outcomeStatus } : {},
    artifacts: [],
    validations: [],
    completion: null,
    postCommit: null,
    mutation: {
      mutationMode: mutationContext.mutationMode,
      writesApplied: false,
      paths: []
    }
  };
}
function closeHostOutcome(root, args = {}) {
  assertGovernanceMutationRegistered("close-host-outcome", "guarded");
  assertAllowedFields(args, HOST_OUTCOME_FIELDS, "close_host_outcome");
  const mutationContext = currentMutationContext(root);
  if (!mutationContext) throw new Error("close_host_outcome requires an active MutationContext.");
  const missionId2 = safeId10(args.missionId, "missionId");
  const status = nonEmptyString2(args.status, "status");
  if (!HOST_OUTCOME_STATUS_SET.has(status)) throw new Error(`status must be one of: ${ORDINARY_HOST_OUTCOME_STATUSES.join(", ")}.`);
  const summary = assertExecutionFactText(args.summary, "summary");
  const artifactPaths = hostOutcomePaths(args.artifactPaths, "artifactPaths");
  const validationPaths = hostOutcomePaths(args.validationPaths, "validationPaths");
  if (artifactPaths.length === 0 && validationPaths.length > 0) {
    throw new Error("validationPaths cannot close an ordinary host outcome without a substantive artifact path.");
  }
  const workspace = openDoveWorkspace(root, { operation: "Host outcome closure" });
  const missionRelativePath = missionContractPath(missionId2);
  if (!mutationContext.fileExists(missionRelativePath)) throw new Error(`Mission does not exist: ${missionId2}.`);
  const mission = readJson(root, missionRelativePath, null);
  if (!mission || mission.missionId !== missionId2) throw new Error(`Mission contract is malformed or mismatched: ${missionId2}.`);
  const currentContract = assertCurrentMissionContract2(mission);
  if (mission.mode !== "ordinary") throw new Error("close_host_outcome requires an ordinary mission; research missions close through record_research_outcome.");
  if (mission.workspaceId !== workspace.manifest.workspaceId) throw new Error(`Mission contract workspaceId does not match the current workspace for ${missionId2}.`);
  const factDeclarations = hostOutcomeFacts(args.facts, mission);
  const facts = factDeclarations.map((item) => item.fact);
  if (artifactPaths.length === 0 && facts.length === 0) {
    throw new Error("close_host_outcome requires at least one substantive artifact or one concrete execution fact.");
  }
  const ownerByPath = new Map(workspace.receiptLedger.currentOwnership.map((item) => [item.path, item]));
  const inspectedArtifacts = artifactPaths.map((artifactPath, index) => inspectHostOutcomeFile(root, artifactPath, `artifactPaths[${index}]`));
  const validations = validationPaths.map((validationPath, index) => inspectHostOutcomeFile(root, validationPath, `validationPaths[${index}]`));
  const allInspectedPaths = [...inspectedArtifacts, ...validations].map((item) => item.path);
  if (new Set(allInspectedPaths).size !== allInspectedPaths.length) {
    throw new Error("Host outcome artifact and validation paths must be canonically distinct.");
  }
  const attemptId = safeId10(args.attemptId, "attemptId");
  const receiptId = `receipt-host-outcome-${crypto17.createHash("sha256").update(`${missionId2}
${attemptId}`).digest("hex").slice(0, 24)}`;
  const existing = workspace.receiptLedger.receipts.find((receipt2) => receipt2.receiptId === receiptId);
  if (existing) {
    const replayMode = existing.ordinaryHostOutcome?.mode ?? (inspectedArtifacts.length > 0 ? "artifact-backed" : "observation-only");
    const replayArtifacts = existing.artifacts.map(({ path: artifactPath, sha256: sha25613 }) => ({ path: artifactPath, sha256: sha25613 }));
    const replayValidations = existing.validations;
    const callbackDigest3 = ordinaryHostOutcomeCallbackDigest({
      attemptId,
      missionId: missionId2,
      contractDigest: currentContract.contractDigest,
      summary,
      mode: replayMode,
      status,
      facts,
      artifacts: replayArtifacts,
      validations: replayValidations
    });
    if (existing.ordinaryHostOutcome?.callbackDigest === callbackDigest3) {
      return skippedHostOutcome(mutationContext, "replayed", "callback-replayed", existing.ordinaryHostOutcome.status);
    }
    throw new Error("The ordinary host outcome callback has already been recorded with different immutable content.");
  }
  const eligibleArtifacts = inspectedArtifacts.filter((artifact) => {
    const owner = ownerByPath.get(artifact.path);
    if (!owner) {
      if (artifact.evidenceRole !== "external-project") {
        throw new Error(`Host outcome cannot claim an unowned Dove domain artifact: ${artifact.path}.`);
      }
      return true;
    }
    if (owner.missionId !== missionId2) {
      if (artifact.evidenceRole === "external-project" && handoffAuthorizes(workspace.artifactHandoffs, artifact.path, owner.missionId, missionId2, owner.receiptId, owner.sha256)) return true;
      throw new Error(`Host outcome artifact is owned by another mission: ${artifact.path}.`);
    }
    if (owner.sha256 === artifact.sha256) {
      if (existing?.ordinaryHostOutcome && owner.receiptId === existing.receiptId) return true;
      return false;
    }
    if (artifact.evidenceRole !== "external-project") {
      throw new Error(`Host outcome cannot claim a changed Dove domain artifact: ${artifact.path}.`);
    }
    return true;
  });
  if (artifactPaths.length > 0 && eligibleArtifacts.length === 0 && facts.length === 0) {
    return skippedHostOutcome(mutationContext, "no-progress-skipped", "no-eligible-artifacts", status);
  }
  const mode = eligibleArtifacts.length > 0 ? "artifact-backed" : "observation-only";
  const artifacts = eligibleArtifacts.map((artifact) => ({ path: artifact.path, kind: "other", sha256: artifact.sha256 }));
  const criteria = missionCompletionCriteria(mission);
  const criteriaSatisfied = criteria.flatMap(({ criterionId }, criterionIndex) => {
    const boundFacts = factDeclarations.filter((item) => item.criterionNumbers.includes(criterionIndex + 1)).map((item) => item.fact);
    if (boundFacts.length === 0) return [];
    return [{
      criterionId,
      evidenceRefs: boundFacts.map((fact) => `fact:${fact.factId}`),
      evidenceBindings: boundFacts.map((fact) => ({ reference: `fact:${fact.factId}`, sha256: executionFactHash(fact.statement), receiptId }))
    }];
  });
  const primaryArtifact = eligibleArtifacts[0] ?? null;
  const receiptValidations = mode === "artifact-backed" ? validations.map((validation) => createValidationRecord({
    kind: "validation-log",
    result: "incomplete",
    level: "static",
    producerKind: "host-observed",
    producerOperation: "close-host-outcome",
    observedExitStatus: null,
    targetReference: `artifact:${primaryArtifact.path}`,
    targetHash: primaryArtifact.sha256,
    reference: validation.path,
    outputHash: validation.sha256
  }, { label: `validationPaths:${validation.path}` })) : [];
  const callbackDigest2 = ordinaryHostOutcomeCallbackDigest({
    attemptId,
    missionId: missionId2,
    contractDigest: currentContract.contractDigest,
    summary,
    mode,
    status,
    facts,
    artifacts,
    validations: receiptValidations
  });
  assertMissionAcceptsWrites(workspace, mission, { receipt: true });
  mutationContext.requireCommitPrecondition(ARTIFACT_PATHS.executionReceiptsDir);
  mutationContext.requireCommitLock(".dove/.receipt-ledger-append.lock", { label: "Execution receipt ledger append lock" });
  const producedAt = (/* @__PURE__ */ new Date()).toISOString();
  const baseReceipt = {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    receiptId,
    ledgerSequence: workspace.receiptLedger.nextLedgerSequence,
    missionId: missionId2,
    contractDigest: currentContract.contractDigest,
    summary,
    artifacts,
    validations: receiptValidations,
    criteriaSatisfied,
    producedAt,
    recordedAt: producedAt,
    producer: { kind: "public-execution", actionId: "close-host-outcome" },
    ordinaryHostOutcome: { attemptId, mode, status, facts, callbackDigest: callbackDigest2 }
  };
  const receipt = { ...baseReceipt, artifacts: deriveArtifactReferences(baseReceipt) };
  assertReceiptAppendable(workspace.receiptLedger, receipt, { artifactHandoffs: workspace.artifactHandoffs });
  writeJson(root, executionReceiptPath(receiptId), receipt);
  return {
    status: "ingested",
    outcomeStatus: status,
    outcomeMode: mode,
    receipt,
    completion: { missionId: missionId2, assessWith: "assess_mission_completion", assessment: null },
    postCommit: { kind: POST_COMMIT_ASSESSMENT_KIND, missionId: missionId2 },
    mutation: {
      mutationMode: mutationContext.mutationMode,
      writesApplied: true,
      paths: [executionReceiptPath(receiptId)]
    }
  };
}
function resolveExecutionReceiptPostCommit(root, result, options = {}) {
  if (!result || typeof result !== "object" || Array.isArray(result) || !Object.hasOwn(result, "postCommit")) return result;
  const unknownOptions = Object.keys(options).filter((field) => field !== "committed");
  if (unknownOptions.length > 0) throw new Error(`Execution receipt post-commit resolution does not accept unknown options: ${unknownOptions.join(", ")}.`);
  const committed = options.committed !== false;
  const { postCommit, ...publicResult2 } = result;
  if (postCommit === null) return publicResult2;
  assertAllowedFields(postCommit, POST_COMMIT_ASSESSMENT_FIELDS, "execution receipt postCommit");
  if (postCommit.kind !== POST_COMMIT_ASSESSMENT_KIND) throw new Error(`Unsupported execution receipt postCommit kind: ${postCommit.kind}.`);
  const missionId2 = safeId10(postCommit.missionId, "execution receipt postCommit.missionId");
  if (!publicResult2.completion || publicResult2.completion.missionId !== missionId2 || publicResult2.completion.assessment !== null) {
    throw new Error("Execution receipt postCommit descriptor does not match its sealed completion result.");
  }
  if (!committed) return publicResult2;
  if (publicResult2.mutationMode === "patch-plan" || publicResult2.writesApplied !== true || publicResult2.mutationSummary?.transactionState?.phase !== "committed") {
    throw new Error("Execution receipt post-commit assessment requires a successfully committed direct-process mutation result.");
  }
  try {
    let assessment = assessMissionCompletion(root, { missionId: missionId2 });
    if (assessment.complete && assessment.lifecycle === null) {
      const completionMutation = runWithMutationContext(root, {
        actionId: "ingest-execution-receipt",
        mutationMode: "direct-process",
        hostId: "dove-completion-gate"
      }, () => completeMissionIfEligible(root, { missionId: missionId2 }));
      assessment = completionMutation.assessment;
    }
    const workspace = openDoveWorkspace(root, { operation: "Execution receipt final narrative" });
    const decision = workspace.currentResearchDecisions.get(missionId2) ?? null;
    return {
      ...publicResult2,
      completion: {
        ...publicResult2.completion,
        assessment
      },
      ...decision ? { researchNarrative: buildResearchNarrativeFromDecision(decision) } : {}
    };
  } catch (error) {
    return {
      ...publicResult2,
      status: "partial-commit-failure",
      zeroWrite: false,
      writesApplied: true,
      partialCommit: {
        receiptRecorded: true,
        completionAssessmentFailed: true,
        repeatClosureAllowed: false,
        zeroWriteRetryAllowed: false,
        nextAction: "assess-mission-completion-read-only"
      },
      completion: {
        ...publicResult2.completion,
        assessment: null,
        assessmentUnavailable: true,
        reassessWith: "assess_mission_completion",
        reassessmentReadOnly: true
      },
      assessmentFailure: error instanceof Error ? error.message : String(error)
    };
  }
}
function readExecutionReceipts(root, missionId2 = null) {
  const workspace = openDoveWorkspace(root, { operation: "Execution receipt read" });
  return workspace.receiptLedger.receipts.filter((receipt) => !missionId2 || receipt.missionId === missionId2);
}

// src/core/project-research-narratives.mjs
var PROJECT_NARRATIVE_FIELDS = /* @__PURE__ */ new Set([
  "mainline",
  "activeDirections",
  "evidence",
  "unknowns",
  "rejectedDirections",
  "historicalWorkWithoutJudgment",
  "currentValueJudgment",
  "recommendation",
  "recommendationReason",
  "applicableLessons"
]);
var ACTIVE_DIRECTION_FIELDS = /* @__PURE__ */ new Set(["direction", "currentUnderstanding"]);
var REJECTED_DIRECTION_FIELDS2 = /* @__PURE__ */ new Set(["direction", "reason"]);
var APPLICABLE_LESSON_FIELDS2 = /* @__PURE__ */ new Set(["lesson", "application"]);
var RENDER_OPTION_FIELDS2 = /* @__PURE__ */ new Set(["language"]);
var SUPPORTED_LANGUAGES2 = /* @__PURE__ */ new Set(["zh", "en"]);
var TERMINAL_STOP_KINDS = /* @__PURE__ */ new Set(["stop-satisfied", "stop-low-return", "stop-budget", "reject"]);
var PROJECT_NARRATIVE_LIMITS = Object.freeze({
  activeDirections: 20,
  evidence: 24,
  unknowns: 24,
  rejectedDirections: 20,
  historicalWorkWithoutJudgment: 20,
  applicableLessons: 20
});
function assertPlainRecord2(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} must be a plain object.`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") throw new Error(`${label} does not accept symbol fields.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) throw new Error(`${label}.${key} must be an enumerable data field.`);
  }
}
function assertSealedRecord2(value, allowed2, label) {
  assertPlainRecord2(value, label);
  const unknown = Object.keys(value).filter((field) => !allowed2.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function assertJsonArray2(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const unexpected = Reflect.ownKeys(value).filter((key) => typeof key !== "string" || key !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(key));
  if (unexpected.length > 0) throw new Error(`${label} must not contain custom fields.`);
}
function assertBoundedLength(value, limit, label) {
  if (value.length > limit) throw new Error(`${label} must contain at most ${limit} items.`);
}
function normalizeTexts2(value, label, limit) {
  assertJsonArray2(value, label);
  assertBoundedLength(value, limit, label);
  const items = value.map((item, index) => normalizeResearchNarrativeText(item, `${label}[${index}]`));
  if (new Set(items).size !== items.length) throw new Error(`${label} must not contain duplicates.`);
  return Object.freeze(items);
}
function normalizeObjects2(value, fields, label, limit, normalizeItem) {
  assertJsonArray2(value, label);
  assertBoundedLength(value, limit, label);
  return Object.freeze(value.map((item, index) => {
    const itemLabel = `${label}[${index}]`;
    assertSealedRecord2(item, fields, itemLabel);
    return Object.freeze(normalizeItem(item, itemLabel));
  }));
}
function normalizeProjectResearchNarrative(value) {
  assertSealedRecord2(value, PROJECT_NARRATIVE_FIELDS, "ProjectResearchNarrative");
  for (const field of PROJECT_NARRATIVE_FIELDS) {
    if (!Object.hasOwn(value, field)) throw new Error(`ProjectResearchNarrative requires $.${field}.`);
  }
  return Object.freeze({
    mainline: normalizeResearchNarrativeText(value.mainline, "ProjectResearchNarrative.mainline"),
    activeDirections: normalizeObjects2(value.activeDirections, ACTIVE_DIRECTION_FIELDS, "ProjectResearchNarrative.activeDirections", PROJECT_NARRATIVE_LIMITS.activeDirections, (item, label) => ({
      direction: normalizeResearchNarrativeText(item.direction, `${label}.direction`),
      currentUnderstanding: normalizeResearchNarrativeText(item.currentUnderstanding, `${label}.currentUnderstanding`)
    })),
    evidence: normalizeTexts2(value.evidence, "ProjectResearchNarrative.evidence", PROJECT_NARRATIVE_LIMITS.evidence),
    unknowns: normalizeTexts2(value.unknowns, "ProjectResearchNarrative.unknowns", PROJECT_NARRATIVE_LIMITS.unknowns),
    rejectedDirections: normalizeObjects2(value.rejectedDirections, REJECTED_DIRECTION_FIELDS2, "ProjectResearchNarrative.rejectedDirections", PROJECT_NARRATIVE_LIMITS.rejectedDirections, (item, label) => ({
      direction: normalizeResearchNarrativeText(item.direction, `${label}.direction`),
      reason: normalizeResearchNarrativeText(item.reason, `${label}.reason`)
    })),
    historicalWorkWithoutJudgment: normalizeTexts2(value.historicalWorkWithoutJudgment, "ProjectResearchNarrative.historicalWorkWithoutJudgment", PROJECT_NARRATIVE_LIMITS.historicalWorkWithoutJudgment),
    currentValueJudgment: normalizeResearchNarrativeText(value.currentValueJudgment, "ProjectResearchNarrative.currentValueJudgment"),
    recommendation: normalizeResearchNarrativeText(value.recommendation, "ProjectResearchNarrative.recommendation"),
    recommendationReason: normalizeResearchNarrativeText(value.recommendationReason, "ProjectResearchNarrative.recommendationReason"),
    applicableLessons: normalizeObjects2(value.applicableLessons, APPLICABLE_LESSON_FIELDS2, "ProjectResearchNarrative.applicableLessons", PROJECT_NARRATIVE_LIMITS.applicableLessons, (item, label) => ({
      lesson: normalizeResearchNarrativeText(item.lesson, `${label}.lesson`),
      application: normalizeResearchNarrativeText(item.application, `${label}.application`)
    }))
  });
}
function safeText(value, fallback) {
  return safeResearchNarrativeSourceText(value) ?? fallback;
}
function projectEvidenceText(value) {
  const safe = safeResearchNarrativeSourceText(value);
  if (safe === null) return "Additional current evidence exists, but its wording cannot be shown safely in the project narrative.";
  if (/^artifact:/u.test(safe)) return "Current recorded artifact evidence supports the project judgment.";
  if (/^validation:/u.test(safe)) return "Current recorded validation evidence supports the project judgment.";
  if (/^source:/u.test(safe)) return "Current eligible source evidence supports the project judgment.";
  return safe;
}
function uniqueBy(items, keyOf) {
  const seen = /* @__PURE__ */ new Set();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function bounded(items, limit) {
  return items.slice(0, limit);
}
function decisionAction(decision) {
  return decision.nextAction ?? null;
}
function isTerminal(decision) {
  return TERMINAL_STOP_KINDS.has(decision.disposition) || decision.disposition === "block-needs-user";
}
function currentRecommendationEntry(entries) {
  return entries.find((entry) => entry.assessment?.researchOutcome?.awaitingReevaluation === true) ?? entries.find((entry) => entry.decision.disposition === "block-needs-user") ?? entries[0] ?? null;
}
function recommendationFor(chosen) {
  if (!chosen) return { recommendation: "Establish a current research judgment for an active mission before authorizing further work.", recommendationReason: "Only historical or terminal mission judgments are available." };
  const { decision, mission } = chosen;
  const direction = safeText(mission.goal, "the current research direction");
  if (chosen.assessment?.researchOutcome?.awaitingReevaluation === true) return { recommendation: `Reevaluate the recorded execution evidence for: ${direction}`, recommendationReason: "Execution facts exist, but the current scientific judgment has not consumed them." };
  if (decision.disposition === "block-needs-user") return { recommendation: `Resolve the user decision for: ${direction}`, recommendationReason: safeText(decision.synthesis, "The direction cannot advance until the recorded blocker is resolved.") };
  if (decision.nextAction) return { recommendation: safeText(decision.nextAction.description, "Perform the current bounded research action."), recommendationReason: safeText(decision.nextAction.rationale, "The current scientific judgment authorizes this action.") };
  if (!isTerminal(decision)) return { recommendation: `Reevaluate the current evidence for: ${direction}`, recommendationReason: safeText(decision.synthesis, "The direction remains current but has no authorized action.") };
  return { recommendation: "Stop project-level research unless new evidence or explicit user direction changes the current judgments.", recommendationReason: safeText(decision.synthesis, "The current research judgment is terminal.") };
}
function rejectedDirections(entries) {
  const rejected = [];
  for (const entry of entries.values()) {
    const decision = entry.decision;
    if (!decision) continue;
    if (!entry.active || ["stop-low-return", "stop-budget", "reject"].includes(decision.disposition)) rejected.push({ direction: safeText(entry.mission.goal, "A stopped research direction"), reason: safeText(entry.transition?.reason ?? decision.synthesis, "The current judgment does not support continuing this direction.") });
    for (const route of decision.routes.filter((item) => item.disposition === "rejected")) rejected.push({ direction: safeText(route.summary, "A rejected route"), reason: safeText(route.rationale, "The current judgment rejected this route.") });
  }
  return uniqueBy(rejected, (item) => `${item.direction}
${item.reason}`);
}
function buildProjectResearchNarrativeFromWorkspace({ mainline, currentWorkspaceRevisionId, missions, currentDecisions, assessments, missionTransitions = /* @__PURE__ */ new Map() }) {
  if (!Array.isArray(missions)) throw new Error("Project research narrative missions must be an array.");
  const researchMissions = missions.filter((mission) => mission.mode === "research");
  const entries = new Map(researchMissions.map((mission, publicOrder) => {
    const decisionValue = currentDecisions.get(mission.missionId) ?? null;
    const decision = decisionValue ? validatePersistedResearchDecision(decisionValue, { label: "Project research narrative decision" }) : null;
    return [mission.missionId, { mission, publicOrder, decision, assessment: assessments.get(mission.missionId) ?? null, transition: missionTransitions.get(mission.missionId) ?? null, active: mission.workspaceRevisionId === currentWorkspaceRevisionId && !missionTransitions.has(mission.missionId) }];
  }));
  const decisionEntries = [...entries.values()].filter((entry) => entry.decision !== null);
  if (decisionEntries.length === 0) return null;
  const currentEntries = decisionEntries.filter((entry) => entry.active);
  const chosen = currentRecommendationEntry(currentEntries);
  const activeEntries = currentEntries.filter((entry) => !isTerminal(entry.decision));
  const singleNarratives = decisionEntries.map((entry) => ({ entry, narrative: buildResearchNarrativeFromDecision(entry.decision) }));
  const evidence = uniqueBy(singleNarratives.filter(({ entry }) => entry.active).flatMap(({ narrative }) => narrative.evidence.map(projectEvidenceText)), (item) => item);
  const unknowns = uniqueBy(singleNarratives.filter(({ entry }) => entry.active).flatMap(({ narrative }) => narrative.unknowns), (item) => item);
  const recommendation = recommendationFor(chosen);
  const historicalWithoutDecision = [...entries.values()].filter((entry) => entry.decision === null).map((entry) => safeText(entry.mission.goal, "Historical research work without a current judgment"));
  const authorizedCount = currentEntries.filter((entry) => decisionAction(entry.decision) !== null).length;
  const awaitingCount = currentEntries.filter((entry) => entry.assessment?.researchOutcome?.awaitingReevaluation === true).length;
  return normalizeProjectResearchNarrative({
    mainline: safeText(mainline, "Advance the approved project research mainline."),
    activeDirections: bounded(activeEntries.map((entry) => ({ direction: safeText(entry.mission.goal, "A current mission research direction"), currentUnderstanding: safeText(entry.decision.synthesis, "A current research judgment is recorded for this direction.") })), PROJECT_NARRATIVE_LIMITS.activeDirections),
    evidence: bounded(evidence, PROJECT_NARRATIVE_LIMITS.evidence),
    unknowns: bounded(unknowns, PROJECT_NARRATIVE_LIMITS.unknowns),
    rejectedDirections: bounded(rejectedDirections(entries), PROJECT_NARRATIVE_LIMITS.rejectedDirections),
    historicalWorkWithoutJudgment: bounded(historicalWithoutDecision, PROJECT_NARRATIVE_LIMITS.historicalWorkWithoutJudgment),
    currentValueJudgment: safeText(chosen?.decision.synthesis, awaitingCount > 0 ? "Recorded research outcomes await scientific reevaluation." : authorizedCount > 0 ? "At least one current direction has a bounded authorized action." : "A current judgment exists, but no bounded action is authorized."),
    ...recommendation,
    applicableLessons: []
  });
}
function sentence(value) {
  return /[.!?。！？]$/u.test(value) ? value : `${value}\u3002`;
}
function renderChinese2(narrative) {
  const lines = [
    sentence(`\u5F53\u524D\u79D1\u7814\u4E3B\u7EBF\u662F\uFF1A${narrative.mainline}`)
  ];
  if (narrative.activeDirections.length > 0) lines.push(sentence(`\u5404\u6D3B\u8DC3\u65B9\u5411\u7684\u5F53\u524D\u8BA4\u8BC6\u662F\uFF1A${narrative.activeDirections.map((item) => `${item.direction}\uFF08${item.currentUnderstanding}\uFF09`).join("\uFF1B")}`));
  else lines.push("\u5F53\u524D\u6CA1\u6709\u4ECD\u5728\u63A8\u8FDB\u7684\u79D1\u7814\u65B9\u5411\u3002");
  lines.push(narrative.evidence.length > 0 ? sentence(`\u5173\u952E\u8BC1\u636E\u5305\u62EC\uFF1A${narrative.evidence.join("\uFF1B")}`) : "\u76EE\u524D\u8FD8\u6CA1\u6709\u53EF\u516C\u5F00\u5C55\u793A\u7684\u76F4\u63A5\u8BC1\u636E\u3002");
  lines.push(narrative.unknowns.length > 0 ? sentence(`\u6700\u5927\u672A\u77E5\u5305\u62EC\uFF1A${narrative.unknowns.join("\uFF1B")}`) : "\u5F53\u524D\u6CA1\u6709\u660E\u786E\u8BB0\u5F55\u7684\u5173\u952E\u672A\u77E5\u3002");
  if (narrative.rejectedDirections.length > 0) lines.push(sentence(`\u5DF2\u7ECF\u505C\u6B62\u3001\u62D2\u7EDD\u6216\u8F6C\u5411\u7684\u65B9\u5411\u5305\u62EC\uFF1A${narrative.rejectedDirections.map((item) => `${item.direction}\uFF08${item.reason}\uFF09`).join("\uFF1B")}`));
  if (narrative.historicalWorkWithoutJudgment.length > 0) lines.push(sentence(`\u5C1A\u65E0\u79D1\u7814\u5224\u65AD\u7684\u5386\u53F2\u5DE5\u4F5C\u5305\u62EC\uFF1A${narrative.historicalWorkWithoutJudgment.join("\uFF1B")}`));
  lines.push(sentence(`\u5F53\u524D\u4EF7\u503C\u5224\u65AD\u662F\uFF1A${narrative.currentValueJudgment}`));
  if (narrative.applicableLessons.length > 0) lines.push(sentence(`\u9002\u7528\u7ECF\u9A8C\u5305\u62EC\uFF1A${narrative.applicableLessons.map((item) => `${item.lesson}\uFF0C\u7528\u4E8E${item.application}`).join("\uFF1B")}`));
  lines.push(sentence(`\u6700\u503C\u5F97\u505A\u7684\u4E0B\u4E00\u6B65\u662F\uFF1A${narrative.recommendation}`));
  lines.push(sentence(`\u9009\u62E9\u4F9D\u636E\u662F\uFF1A${narrative.recommendationReason}`));
  return lines.join("\n\n");
}
function renderEnglish2(narrative) {
  const lines = [sentence(`The current research mainline is: ${narrative.mainline}`)];
  if (narrative.activeDirections.length > 0) lines.push(sentence(`Current understanding across active directions is: ${narrative.activeDirections.map((item) => `${item.direction} (${item.currentUnderstanding})`).join("; ")}`));
  else lines.push("There is no research direction currently advancing.");
  lines.push(narrative.evidence.length > 0 ? sentence(`Key evidence is: ${narrative.evidence.join("; ")}`) : "There is no direct public evidence to show yet.");
  lines.push(narrative.unknowns.length > 0 ? sentence(`The largest unknowns are: ${narrative.unknowns.join("; ")}`) : "There is no clearly recorded critical unknown at present.");
  if (narrative.rejectedDirections.length > 0) lines.push(sentence(`Stopped or rejected mission directions include: ${narrative.rejectedDirections.map((item) => `${item.direction} (${item.reason})`).join("; ")}`));
  if (narrative.historicalWorkWithoutJudgment.length > 0) lines.push(sentence(`Historical work without a research judgment includes: ${narrative.historicalWorkWithoutJudgment.join("; ")}`));
  lines.push(sentence(`The current value judgment is: ${narrative.currentValueJudgment}`));
  if (narrative.applicableLessons.length > 0) lines.push(sentence(`Applicable lessons include: ${narrative.applicableLessons.map((item) => `${item.lesson}, applied to ${item.application}`).join("; ")}`));
  lines.push(sentence(`The most valuable next step is: ${narrative.recommendation}`));
  lines.push(sentence(`The selection basis is: ${narrative.recommendationReason}`));
  return lines.join("\n\n");
}
function renderProjectResearchNarrative(value, options = {}) {
  assertSealedRecord2(options, RENDER_OPTION_FIELDS2, "ProjectResearchNarrative render options");
  const language = options.language ?? "zh";
  if (typeof language !== "string" || !SUPPORTED_LANGUAGES2.has(language)) throw new Error("ProjectResearchNarrative render language must be zh or en.");
  const narrative = normalizeProjectResearchNarrative(value);
  return language === "zh" ? renderChinese2(narrative) : renderEnglish2(narrative);
}

// src/core/retained-domain-workflows.mjs
import crypto18 from "node:crypto";
import fs17 from "node:fs";
import path22 from "node:path";

// src/core/review-records.mjs
import fs16 from "node:fs";
import path21 from "node:path";

// src/core/host-registry.mjs
var PROJECT_HOST_IDS = Object.freeze(["opencode", "codex", "cursor", "agents", "claude"]);
var HOST_DEFINITIONS = [
  {
    id: "opencode",
    label: "OpenCode",
    order: 0,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectMcpRegistration: false, projectHooks: false, sharedInstructions: false, nativeReviewer: true, reviewerFreshContext: true, reviewerReadOnly: true, reviewerSynchronous: true },
    legacySignatures: [".opencode.json", ".opencode/commands/dove.status.md", ".opencode/skills/dove-planner/SKILL.md"]
  },
  {
    id: "codex",
    label: "Codex",
    order: 1,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectMcpRegistration: false, projectHooks: false, sharedInstructions: false },
    legacySignatures: [".codex/skills/dove-status/SKILL.md"]
  },
  {
    id: "cursor",
    label: "Cursor",
    order: 2,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectMcpRegistration: false, projectHooks: false, sharedInstructions: false },
    legacySignatures: [".cursor/commands/dove-status.md"]
  },
  {
    id: "agents",
    label: "Shared agent skills",
    order: 3,
    projectInitializable: false,
    capabilities: { commandAdapters: true, projectMcpRegistration: false, projectHooks: false, sharedInstructions: true },
    legacySignatures: [".agents/skills/dove-status/SKILL.md", "AGENTS.md"]
  },
  {
    id: "claude",
    label: "Claude Code",
    order: 4,
    projectInitializable: true,
    capabilities: { commandAdapters: true, projectMcpRegistration: true, projectHooks: true, sharedInstructions: false, nativeReviewer: true, reviewerFreshContext: true, reviewerReadOnly: true, reviewerSynchronous: true },
    legacySignatures: [
      "mcp/dove-claude-project.json",
      ".mcp.json",
      ".claude/settings.json",
      ".claude/rules/dove.md",
      ".claude/skills/dove-intake/SKILL.md"
    ]
  }
];
function freezeHostDefinition(definition) {
  return Object.freeze({
    ...definition,
    capabilities: Object.freeze({ ...definition.capabilities }),
    legacySignatures: Object.freeze([...definition.legacySignatures])
  });
}
var HOST_REGISTRY = Object.freeze(Object.fromEntries(
  HOST_DEFINITIONS.map((definition) => [definition.id, freezeHostDefinition(definition)])
));
var DEFAULT_INITIALIZABLE_HOSTS = Object.freeze(
  PROJECT_HOST_IDS.filter((hostId) => HOST_REGISTRY[hostId].projectInitializable)
);
function requireNativeReviewerHost(hostId) {
  if (typeof hostId !== "string" || !hostId.trim() || !HOST_REGISTRY[hostId]?.capabilities.nativeReviewer) {
    throw new Error(`Host ${String(hostId)} does not support a dedicated native Reviewer launch.`);
  }
  const host = HOST_REGISTRY[hostId];
  if (!host.capabilities.reviewerFreshContext || !host.capabilities.reviewerReadOnly || !host.capabilities.reviewerSynchronous) {
    throw new Error(`Host ${hostId} does not satisfy the dedicated Reviewer launch contract.`);
  }
  return host;
}

// src/core/review-records.mjs
var REVIEW_RECORD_SCHEMA_VERSION = 1;
var REVIEW_STATUSES = Object.freeze(["completed", "blocked", "failed"]);
var REVIEW_VERDICTS = Object.freeze(["coherent", "needs-revision", "needs-evidence", "blocked"]);
var SCOPE_FIELDS = /* @__PURE__ */ new Set(["missionId", "reviewMissionBinding", "artifactPaths", "hostKind"]);
var ARCHIVE_FIELDS = /* @__PURE__ */ new Set(["missionId", "scopeBinding", "status", "verdict", "summary", "findings", "actionItems", "report", "provenance"]);
var SCOPE_BINDING_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "missionId", "contractDigest", "reviewMissionBinding", "hostKind", "reviewedArtifacts", "reviewedArtifactSetSha256"]);
var FINDING_FIELDS = /* @__PURE__ */ new Set(["findingId", "severity", "summary", "linkedArtifactPaths"]);
var PROVENANCE_FIELDS = /* @__PURE__ */ new Set(["hostKind", "reviewedAt", "provider", "model"]);
var RECORD_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "reviewId",
  "missionId",
  "contractDigest",
  "status",
  "verdict",
  "summary",
  "reviewedArtifacts",
  "reviewedArtifactSetSha256",
  "findings",
  "actionItems",
  "reportPath",
  "reportSha256",
  "provenance",
  "authority",
  "receiptId",
  "archiveDigest",
  "archivedAt"
]);
var HASH11 = /^[a-f0-9]{64}$/u;
function sealed9(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  return value;
}
function exactIso9(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value;
}
function optionalCanonicalText(value, label) {
  if (value === void 0) return void 0;
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) throw new Error(`${label} must be a canonical non-empty string when supplied.`);
  return value;
}
function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function reviewIdForMission(missionId2) {
  return `review-${domainSha256(`dove-review-record
${missionId2}
`).slice(0, 24)}`;
}
function reviewPath(reviewId) {
  return path21.posix.join(ARTIFACT_PATHS.reviewsDir, `${reviewId}.json`);
}
function reportPath(reviewId) {
  return path21.posix.join(ARTIFACT_PATHS.reviewsDir, `${reviewId}.report.md`);
}
function canonicalReviewRecordPath(value, label) {
  const candidate = domainNonEmptyText(value, label);
  const fileName = path21.posix.basename(candidate);
  if (!/^review-[a-f0-9]{24}\.json$/u.test(fileName) || candidate !== path21.posix.join(ARTIFACT_PATHS.reviewsDir, fileName)) {
    throw new Error(`${label} must be a canonical Review archive path.`);
  }
  return candidate;
}
function receiptIdForReview(reviewId) {
  return `receipt-archive-${reviewId}`;
}
function receiptPath(receiptId) {
  return path21.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
}
function scopeBinding(prepared, hostKind) {
  return {
    schemaVersion: REVIEW_RECORD_SCHEMA_VERSION,
    missionId: prepared.mission.missionId,
    contractDigest: prepared.mission.contractDigest,
    reviewMissionBinding: prepared.reviewMissionBinding,
    hostKind,
    reviewedArtifacts: prepared.snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: prepared.snapshot.reviewedArtifactSetSha256
  };
}
function normalizeScopeBinding(value) {
  sealed9(value, SCOPE_BINDING_FIELDS, "scopeBinding");
  if (value.schemaVersion !== REVIEW_RECORD_SCHEMA_VERSION) throw new Error(`scopeBinding.schemaVersion must be ${REVIEW_RECORD_SCHEMA_VERSION}.`);
  const missionId2 = domainSafeId(value.missionId, "scopeBinding.missionId");
  if (!HASH11.test(String(value.contractDigest ?? ""))) throw new Error("scopeBinding.contractDigest must be a lowercase SHA-256 hash.");
  const host = requireNativeReviewerHost(value.hostKind);
  if (typeof value.reviewMissionBinding !== "string") throw new Error("scopeBinding.reviewMissionBinding must be the original opaque Review Mission binding.");
  const snapshots = normalizeReviewSnapshots(value.reviewedArtifacts, "scopeBinding.reviewedArtifacts");
  if (!snapshots.ok) throw new Error(snapshots.reason);
  const setHash = stableSnapshotSetHash(snapshots.snapshots);
  if (value.reviewedArtifactSetSha256 !== setHash) throw new Error("scopeBinding reviewed artifact set hash is invalid.");
  return {
    schemaVersion: REVIEW_RECORD_SCHEMA_VERSION,
    missionId: missionId2,
    contractDigest: value.contractDigest,
    reviewMissionBinding: value.reviewMissionBinding,
    hostKind: host.id,
    reviewedArtifacts: snapshots.snapshots,
    reviewedArtifactSetSha256: setHash
  };
}
function prepareScope(root, args, operation) {
  const { workspace, mission } = readCurrentMission(root, args.missionId, operation);
  assertMissionAcceptsWrites(workspace, mission);
  const host = requireNativeReviewerHost(args.hostKind);
  const reviewMissionBindingValue = assertReviewMissionBinding(workspace, mission, args.reviewMissionBinding);
  const artifactPaths = domainStringArray(args.artifactPaths, "artifactPaths", { minItems: 1 });
  const snapshot = resolveReviewArtifactSnapshots(root, mission.missionId, artifactPaths, "review artifact scope", { missionGraph: workspace.missionGraph });
  if (snapshot.reviewedArtifacts.length !== artifactPaths.length) throw new Error("Review artifact scope contains an ambiguous duplicate or alias.");
  return { workspace, mission, host, reviewMissionBinding: reviewMissionBindingValue, snapshot };
}
function scopeReviewRecord(root, args = {}) {
  assertSealedDomainArgs(args, SCOPE_FIELDS, "review scope");
  const prepared = prepareScope(root, args, "Review scope");
  const binding = scopeBinding(prepared, prepared.host.id);
  return {
    schemaVersion: REVIEW_RECORD_SCHEMA_VERSION,
    status: "scoped",
    operation: "scope",
    zeroWrite: true,
    reviewedArtifactPaths: binding.reviewedArtifacts.map((item) => item.path),
    scopeBinding: binding,
    reviewerLaunch: {
      kind: "native-reviewer",
      hostKind: prepared.host.id,
      agent: "dove-reviewer",
      exactlyOnce: true,
      freshContext: true,
      readOnly: true,
      synchronous: true,
      mcpAgentLaunch: false
    }
  };
}
function normalizeFindings(items, reviewedArtifactPaths) {
  if (!Array.isArray(items)) throw new Error("findings must be an array.");
  const reviewed = new Set(reviewedArtifactPaths);
  const seen = /* @__PURE__ */ new Set();
  return items.map((item, index) => {
    sealed9(item, FINDING_FIELDS, `findings[${index}]`);
    const findingId = domainSafeId(item.findingId, `findings[${index}].findingId`);
    if (seen.has(findingId)) throw new Error(`findings contains duplicate findingId ${findingId}.`);
    seen.add(findingId);
    const severity = domainNonEmptyText(item.severity, `findings[${index}].severity`).toLowerCase();
    if (!["low", "medium", "high"].includes(severity)) throw new Error(`findings[${index}].severity must be low, medium, or high.`);
    const linkedArtifactPaths = domainStringArray(item.linkedArtifactPaths, `findings[${index}].linkedArtifactPaths`, { minItems: 1 });
    if (linkedArtifactPaths.some((artifactPath) => !reviewed.has(artifactPath))) throw new Error(`findings[${index}] links an artifact outside the frozen review scope.`);
    return { findingId, severity, summary: domainNonEmptyText(item.summary, `findings[${index}].summary`), linkedArtifactPaths };
  });
}
function normalizeProvenance(value, binding) {
  sealed9(value, PROVENANCE_FIELDS, "provenance");
  const host = requireNativeReviewerHost(value.hostKind);
  if (host.id !== binding.hostKind) throw new Error("provenance.hostKind does not match the original review scope binding.");
  return {
    hostKind: host.id,
    reviewedAt: exactIso9(value.reviewedAt, "provenance.reviewedAt"),
    ...value.provider === void 0 ? {} : { provider: optionalCanonicalText(value.provider, "provenance.provider") },
    ...value.model === void 0 ? {} : { model: optionalCanonicalText(value.model, "provenance.model") }
  };
}
function normalizeArchiveInput(root, args) {
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Review archive");
  const binding = normalizeScopeBinding(args.scopeBinding);
  if (binding.missionId !== mission.missionId || binding.contractDigest !== mission.contractDigest) throw new Error("The original review scope binding does not select the current Review Mission contract.");
  assertReviewMissionBinding(workspace, mission, binding.reviewMissionBinding);
  const current = resolveReviewArtifactSnapshots(root, mission.missionId, binding.reviewedArtifacts.map((item) => item.path), "archived review scope", { missionGraph: workspace.missionGraph });
  if (!same(current.reviewedArtifacts, binding.reviewedArtifacts) || current.reviewedArtifactSetSha256 !== binding.reviewedArtifactSetSha256) {
    throw new Error("The frozen review scope is stale or no longer current.");
  }
  const status = domainNonEmptyText(args.status, "status").toLowerCase();
  const verdict = domainNonEmptyText(args.verdict, "verdict").toLowerCase();
  if (!REVIEW_STATUSES.includes(status)) throw new Error(`status must be one of: ${REVIEW_STATUSES.join(", ")}.`);
  if (!REVIEW_VERDICTS.includes(verdict)) throw new Error(`verdict must be one of: ${REVIEW_VERDICTS.join(", ")}.`);
  if (status === "completed" && verdict === "blocked") throw new Error("A completed review must return coherent, needs-revision, or needs-evidence.");
  if (status !== "completed" && verdict !== "blocked") throw new Error("A blocked or failed review must return verdict blocked.");
  const findings = normalizeFindings(args.findings, binding.reviewedArtifacts.map((item) => item.path));
  const actionItems = domainStringArray(args.actionItems, "actionItems");
  if (["needs-revision", "needs-evidence"].includes(verdict) && (findings.length === 0 || actionItems.length === 0)) {
    throw new Error(`${verdict} requires at least one linked finding and one action item.`);
  }
  const report = domainNonEmptyText(args.report, "report");
  const provenance = normalizeProvenance(args.provenance, binding);
  return {
    workspace,
    mission,
    binding,
    status,
    verdict,
    summary: domainNonEmptyText(args.summary, "summary"),
    findings,
    actionItems,
    report: report.endsWith("\n") ? report : `${report}
`,
    provenance
  };
}
function archiveContent(input) {
  return {
    status: input.status,
    verdict: input.verdict,
    summary: input.summary,
    reviewedArtifacts: input.binding.reviewedArtifacts,
    reviewedArtifactSetSha256: input.binding.reviewedArtifactSetSha256,
    findings: input.findings,
    actionItems: input.actionItems,
    reportSha256: domainSha256(input.report),
    provenance: input.provenance
  };
}
function readJsonFile(root, relativePath, label) {
  try {
    return JSON.parse(fs16.readFileSync(path21.resolve(root, relativePath), "utf8"));
  } catch (error) {
    throw new Error(`${label} is unreadable or malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function exactReplay(root, input, paths2, digest3) {
  const presence = [paths2.record, paths2.report, paths2.receipt].map((relativePath) => fs16.existsSync(path21.resolve(root, relativePath)));
  if (!presence.some(Boolean)) return null;
  if (!presence.every(Boolean)) throw new Error("The archived review output set is incomplete and cannot be replayed.");
  const record = sealed9(readJsonFile(root, paths2.record, "Archived review record"), RECORD_FIELDS, "Archived review record");
  const report = fs16.readFileSync(path21.resolve(root, paths2.report), "utf8");
  const receipt = readJsonFile(root, paths2.receipt, "Archived review receipt");
  const expectedContent = archiveContent(input);
  const valid = record.schemaVersion === REVIEW_RECORD_SCHEMA_VERSION && record.archiveDigest === digest3 && record.reviewId === paths2.reviewId && record.missionId === input.mission.missionId && record.contractDigest === input.mission.contractDigest && record.status === expectedContent.status && record.verdict === expectedContent.verdict && record.summary === expectedContent.summary && same(record.reviewedArtifacts, expectedContent.reviewedArtifacts) && record.reviewedArtifactSetSha256 === expectedContent.reviewedArtifactSetSha256 && same(record.findings, expectedContent.findings) && same(record.actionItems, expectedContent.actionItems) && same(record.provenance, expectedContent.provenance) && record.authority === "not-established" && record.reportPath === paths2.report && record.reportSha256 === domainSha256(input.report) && report === input.report && record.receiptId === paths2.receiptId && receipt.receiptId === paths2.receiptId && receipt.missionId === input.mission.missionId && receipt.contractDigest === input.mission.contractDigest && receipt.producer?.kind === "dove-internal" && receipt.producer?.actionId === "archive-review-record" && same(receipt.artifacts?.map(({ path: artifactPath, kind, sha256: sha25613 }) => ({ path: artifactPath, kind, sha256: sha25613 })), [
    { path: paths2.record, kind: "data", sha256: domainSha256(domainJson(record)) },
    { path: paths2.report, kind: "report", sha256: domainSha256(input.report) }
  ]);
  if (!valid) throw new Error("This Review Mission already has a different immutable archive and cannot be changed or replayed.");
  return { schemaVersion: REVIEW_RECORD_SCHEMA_VERSION, status: "replayed", operation: "archive", zeroWrite: true, review: record, reviewPath: paths2.record, reportPath: paths2.report, receipt };
}
function archiveReviewRecord(root, args = {}) {
  assertSealedDomainArgs(args, ARCHIVE_FIELDS, "review archive");
  const input = normalizeArchiveInput(root, args);
  const reviewId = reviewIdForMission(input.mission.missionId);
  const paths2 = {
    reviewId,
    record: reviewPath(reviewId),
    report: reportPath(reviewId),
    receiptId: receiptIdForReview(reviewId)
  };
  paths2.receipt = receiptPath(paths2.receiptId);
  const content = archiveContent(input);
  const archiveDigest = domainSha256(domainJson({ missionId: input.mission.missionId, contractDigest: input.mission.contractDigest, ...content }));
  const replay = exactReplay(root, input, paths2, archiveDigest);
  if (replay) return replay;
  if (!currentMutationContext(root)) throw new Error("Review archive requires an active MutationContext.");
  const archivedAt = (/* @__PURE__ */ new Date()).toISOString();
  const record = {
    schemaVersion: REVIEW_RECORD_SCHEMA_VERSION,
    reviewId,
    missionId: input.mission.missionId,
    contractDigest: input.mission.contractDigest,
    status: input.status,
    verdict: input.verdict,
    summary: input.summary,
    reviewedArtifacts: input.binding.reviewedArtifacts,
    reviewedArtifactSetSha256: input.binding.reviewedArtifactSetSha256,
    findings: input.findings,
    actionItems: input.actionItems,
    reportPath: paths2.report,
    reportSha256: content.reportSha256,
    provenance: input.provenance,
    authority: "not-established",
    receiptId: paths2.receiptId,
    archiveDigest,
    archivedAt
  };
  const finalized = finalizeDomainArtifacts(root, {
    actionId: "archive-review-record",
    missionId: input.mission.missionId,
    receiptId: paths2.receiptId,
    summary: `Archived non-authoritative Review findings for the exact frozen artifact scope.`,
    writes: [
      { path: paths2.record, kind: "data", content: domainJson(record), derivedReferences: [`artifact:${paths2.report}`, ...record.reviewedArtifacts.map((item) => `artifact:${item.path}`)] },
      { path: paths2.report, kind: "report", content: input.report, derivedReferences: record.reviewedArtifacts.map((item) => `artifact:${item.path}`) }
    ]
  });
  return {
    ...finalized,
    schemaVersion: REVIEW_RECORD_SCHEMA_VERSION,
    status: finalized.status === "planned" ? "archive-planned" : "archived",
    operation: "archive",
    review: record,
    reviewPath: paths2.record,
    reportPath: paths2.report
  };
}
function assessRecord(root, workspace, requestedMissionId, relativePath) {
  const failures = [];
  let record;
  try {
    record = sealed9(readJsonFile(root, relativePath, `Review record ${relativePath}`), RECORD_FIELDS, `Review record ${relativePath}`);
    if (record.schemaVersion !== REVIEW_RECORD_SCHEMA_VERSION) failures.push("review-record-schema-invalid");
    const reviewMission = workspace.missions.get(record.missionId);
    if (!reviewMission || !missionCanReadMission(workspace.missionGraph, requestedMissionId, record.missionId)) failures.push("review-mission-not-readable");
    if (!reviewMission || reviewMission.contractDigest !== record.contractDigest) failures.push("review-contract-stale");
    if (record.authority !== "not-established") failures.push("review-authority-invalid");
    for (const forbidden of ["identity", "reviewerId", "issuer", "signoff", "authoritative"]) if (Object.hasOwn(record, forbidden)) failures.push("review-authority-field-forbidden");
    const snapshots = normalizeReviewSnapshots(record.reviewedArtifacts, "review.reviewedArtifacts");
    if (!snapshots.ok) failures.push(snapshots.reason);
    const setHash = snapshots.ok ? stableSnapshotSetHash(snapshots.snapshots) : null;
    if (!setHash || setHash !== record.reviewedArtifactSetSha256) failures.push("reviewed-artifact-set-hash-mismatch");
    if (snapshots.ok) {
      failures.push(...verifyReviewSnapshotSet(root, snapshots.snapshots, setHash).failures);
      if (reviewMission) {
        try {
          const current = resolveReviewArtifactSnapshots(root, reviewMission.missionId, snapshots.snapshots.map((item) => item.path), "archived review currentness", { missionGraph: workspace.missionGraph });
          if (!same(current.reviewedArtifacts, snapshots.snapshots) || current.reviewedArtifactSetSha256 !== setHash) failures.push("reviewed-artifact-current-ownership-mismatch");
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error));
        }
      }
    }
    const reportFullPath = path21.resolve(root, record.reportPath ?? "");
    if (record.reportPath !== reportPath(record.reviewId) || !fs16.existsSync(reportFullPath) || domainSha256(fs16.readFileSync(reportFullPath)) !== record.reportSha256) failures.push("review-report-stale");
    const receipt = workspace.receiptLedger.receipts.find((item) => item.receiptId === record.receiptId);
    const owner = workspace.receiptLedger.currentOwnership.find((item) => item.path === relativePath);
    const reportOwner = workspace.receiptLedger.currentOwnership.find((item) => item.path === record.reportPath);
    const expectedReceiptArtifacts = [
      { path: relativePath, kind: "data", sha256: domainSha256(domainJson(record)) },
      { path: record.reportPath, kind: "report", sha256: record.reportSha256 }
    ];
    if (!receipt || receipt.missionId !== record.missionId || receipt.contractDigest !== record.contractDigest || receipt.producer?.kind !== "dove-internal" || receipt.producer?.actionId !== "archive-review-record" || owner?.receiptId !== receipt.receiptId || owner?.sha256 !== expectedReceiptArtifacts[0].sha256 || reportOwner?.receiptId !== receipt.receiptId || reportOwner?.sha256 !== record.reportSha256 || !same(receipt.artifacts?.map(({ path: artifactPath, kind, sha256: sha25613 }) => ({ path: artifactPath, kind, sha256: sha25613 })), expectedReceiptArtifacts)) failures.push("review-receipt-stale");
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
    record = null;
  }
  return {
    reviewPath: relativePath,
    current: failures.length === 0,
    authority: "not-established",
    status: record?.status ?? null,
    verdict: record?.verdict ?? null,
    reviewedArtifactPaths: record?.reviewedArtifacts?.map((item) => item.path) ?? [],
    findingCount: record?.findings?.length ?? 0,
    failures: [...new Set(failures)],
    record
  };
}
function queryReviewRecords(root, args = {}) {
  assertSealedDomainArgs(args, /* @__PURE__ */ new Set(["missionId"]), "review record query");
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Review record query");
  const directory = path21.resolve(root, ARTIFACT_PATHS.reviewsDir);
  const assessments = fs16.existsSync(directory) ? fs16.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && /^review-[a-f0-9]{24}\.json$/u.test(entry.name)).map((entry) => assessRecord(root, workspace, mission.missionId, path21.posix.join(ARTIFACT_PATHS.reviewsDir, entry.name))).filter((item) => item.record && missionCanReadMission(workspace.missionGraph, mission.missionId, item.record.missionId)) : [];
  return {
    status: "ok",
    zeroWrite: true,
    authority: "not-established",
    currentCount: assessments.filter((item) => item.current).length,
    staleCount: assessments.filter((item) => !item.current).length,
    reviews: assessments.map(({ record: _record, ...item }) => item)
  };
}
function resolveCurrentReviewFinding(root, args = {}) {
  assertSealedDomainArgs(args, /* @__PURE__ */ new Set(["missionId", "reviewPath", "findingId"]), "review finding resolution");
  const reviewPathValue = canonicalReviewRecordPath(args.reviewPath, "reviewPath");
  const findingId = domainSafeId(args.findingId, "findingId");
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Review finding resolution");
  const assessment = assessRecord(root, workspace, mission.missionId, reviewPathValue);
  if (!assessment.current || !assessment.record || !missionCanReadMission(workspace.missionGraph, mission.missionId, assessment.record.missionId)) return null;
  const finding = assessment.record.findings.find((item) => item.findingId === findingId) ?? null;
  return finding ? { reviewPath: reviewPathValue, review: assessment.record, finding, authority: "not-established" } : null;
}

// src/core/retained-domain-workflows.mjs
var CLAIM_FIELDS3 = /* @__PURE__ */ new Set(["missionId", "claims"]);
var CLAIM_ITEM_FIELDS = /* @__PURE__ */ new Set(["claimId", "text", "sourceIds", "artifactRefs", "validationRefs", "experimentEvidence", "uncertainty", "unsupportedExtensions", "currentAssessment"]);
var EXPERIMENT_FIELDS = /* @__PURE__ */ new Set(["missionId", "experimentId", "title", "protocol", "result"]);
var ARCHIVE_FIELDS2 = /* @__PURE__ */ new Set(["missionId", "artifactPath", "referencePaths", "qa", "findings"]);
var FIGURE_ARCHIVE_FIELDS = /* @__PURE__ */ new Set([...ARCHIVE_FIELDS2, "caption"]);
var REBUTTAL_ARCHIVE_FIELDS = /* @__PURE__ */ new Set([...ARCHIVE_FIELDS2, "findingRefs"]);
var SOURCE_LIMITATION = "Captured source material is current but not independently verified.";
function filePath(directory, id3, suffix) {
  return path22.posix.join(directory, `${id3}.${suffix}.json`);
}
function currentReadableRecord(root, relativePath, missionId2, label) {
  const [reference] = resolveMissionArtifactReferences(root, missionId2, [relativePath], `${label} artifact`);
  const current = readJson(root, relativePath, null);
  if (!current || current.missionId !== reference.missionId) throw new Error(`${label} is not a current readable record.`);
  return current;
}
function currentOwnedRecord(root, relativePath, missionId2, label) {
  const current = currentReadableRecord(root, relativePath, missionId2, label);
  if (current.missionId !== missionId2) throw new Error(`${label} must remain owned by the exact mission that froze it.`);
  return current;
}
function typedEvidence(root, missionId2, reference, label) {
  if (reference.startsWith("source:")) {
    const evaluation = evaluateSourceReferences(root, [reference.slice("source:".length)], missionId2)[0];
    if (!evaluation?.eligible) throw new Error(`${label} is not usable current source evidence: ${evaluation?.reason ?? "unknown-source"}.`);
    return reference;
  }
  if (reference.startsWith("validation:")) {
    const validation = resolveMissionValidationReference(root, missionId2, reference.slice("validation:".length), label);
    return `validation:${validation.reference}`;
  }
  const artifactPath = reference.startsWith("artifact:") ? reference.slice("artifact:".length) : reference;
  return `artifact:${resolveMissionArtifactReferences(root, missionId2, [artifactPath], label)[0].path}`;
}
function evidenceRefs(root, missionId2, values, label) {
  return domainStringArray(values, label).map((reference, index) => typedEvidence(root, missionId2, reference, `${label}[${index}]`));
}
function experimentRecords(root, missionId2, experimentId) {
  const plan = currentReadableRecord(root, filePath(".dove/experiments", experimentId, "plan"), missionId2, `Experiment plan ${experimentId}`);
  const result = currentReadableRecord(root, filePath(".dove/experiments", experimentId, "result"), missionId2, `Experiment result ${experimentId}`);
  if (plan.schemaVersion !== EXPERIMENT_RECORD_SCHEMA_VERSION || result.schemaVersion !== EXPERIMENT_RECORD_SCHEMA_VERSION || plan.protocolDigest !== result.protocolDigest || evidenceDigest(plan.protocol) !== plan.protocolDigest) {
    throw new Error(`Experiment ${experimentId} does not bind a current immutable protocol and result.`);
  }
  return { plan, result };
}
function upsertClaims(root, args = {}) {
  assertSealedDomainArgs(args, CLAIM_FIELDS3, "upsert_claims");
  const { mission } = readCurrentMission(root, args.missionId, "Claim workflow");
  if (!Array.isArray(args.claims) || args.claims.length === 0) throw new Error("upsert_claims requires at least one claim.");
  const records = [];
  const writes = args.claims.map((item, index) => {
    const label = `claims[${index}]`;
    assertSealedDomainArgs(item, CLAIM_ITEM_FIELDS, label);
    const claimId = domainSafeId(item.claimId, `${label}.claimId`);
    const sourceIds = domainStringArray(item.sourceIds, `${label}.sourceIds`);
    const artifactRefs = domainStringArray(item.artifactRefs, `${label}.artifactRefs`).map((value) => `artifact:${value}`);
    const validationRefs = domainStringArray(item.validationRefs, `${label}.validationRefs`).map((value) => `validation:${value}`);
    const resolvedEvidence = evidenceRefs(root, mission.missionId, [...sourceIds.map((value) => `source:${value}`), ...artifactRefs, ...validationRefs], `${label}.evidenceRefs`);
    const contract = normalizeClaimContract({
      experimentEvidence: item.experimentEvidence ?? [],
      uncertainty: item.uncertainty,
      unsupportedExtensions: item.unsupportedExtensions,
      currentAssessment: item.currentAssessment
    }, label);
    if (resolvedEvidence.length === 0 && contract.experimentEvidence.length === 0) throw new Error(`${label} requires Source, artifact, validation, or Experiment evidence.`);
    if (sourceIds.length > 0 && !contract.uncertainty.includes(SOURCE_LIMITATION)) throw new Error(`${label}.uncertainty must state the explicit source limitation: ${SOURCE_LIMITATION}`);
    for (const [bindingIndex, binding] of contract.experimentEvidence.entries()) {
      const { plan, result } = experimentRecords(root, mission.missionId, binding.experimentId);
      if (!plan.protocol.metrics.includes(binding.metric)) throw new Error(`${label}.experimentEvidence[${bindingIndex}].metric is outside the frozen protocol.`);
      const measurement = result.measurements.find((entry) => entry.metric === binding.metric && entry.comparison === binding.comparison);
      if (!measurement || measurement.value !== binding.value) throw new Error(`${label}.experimentEvidence[${bindingIndex}] does not exactly match the referenced Experiment measurement.`);
    }
    const claim = {
      schemaVersion: CLAIM_RECORD_SCHEMA_VERSION,
      claimId,
      missionId: mission.missionId,
      contractDigest: mission.contractDigest,
      text: domainNonEmptyText(item.text, `${label}.text`),
      evidenceRefs: resolvedEvidence,
      ...contract,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    records.push(claim);
    return {
      path: path22.posix.join(".dove/claims", `${claimId}.json`),
      kind: "data",
      content: `${JSON.stringify(claim, null, 2)}
`,
      derivedReferences: [...resolvedEvidence, ...contract.experimentEvidence.map((entry) => `experiment-result:${entry.experimentId}`)]
    };
  });
  return { ...finalizeDomainArtifacts(root, { actionId: "upsert-claims", missionId: mission.missionId, summary: `Recorded ${writes.length} evidence-backed claim(s).`, writes }), claims: records };
}
function assertResultMatchesProtocol(result, protocol, label = "result") {
  for (const [index, measurement] of result.measurements.entries()) {
    if (!protocol.metrics.includes(measurement.metric)) throw new Error(`${label}.measurements[${index}].metric is outside the frozen protocol.`);
    if (measurement.comparison !== null && !protocol.comparisons.includes(measurement.comparison)) throw new Error(`${label}.measurements[${index}].comparison is outside the frozen protocol.`);
  }
}
function runExperienceWorkflow(root, args = {}) {
  assertSealedDomainArgs(args, EXPERIMENT_FIELDS, "run_experience_workflow");
  const { mission } = readCurrentMission(root, args.missionId, "Experiment workflow");
  const experimentId = domainSafeId(args.experimentId, "experimentId");
  const protocol = normalizeExperimentProtocol(args.protocol);
  const protocolDigest = evidenceDigest(protocol);
  const planPath = filePath(".dove/experiments", experimentId, "plan");
  if (!fs17.existsSync(path22.resolve(root, planPath))) {
    if (args.result !== void 0) throw new Error("Freeze the formal experiment protocol in a prior transaction before recording a result.");
    const plan2 = { schemaVersion: EXPERIMENT_RECORD_SCHEMA_VERSION, experimentId, missionId: mission.missionId, title: typeof args.title === "string" && args.title.trim() ? args.title.trim() : experimentId, protocol, protocolDigest, updatedAt: protocol.frozenAt };
    return { ...finalizeDomainArtifacts(root, { actionId: "run-experience-workflow", missionId: mission.missionId, summary: `Froze formal experiment protocol ${experimentId}.`, writes: [{ path: planPath, kind: "data", content: `${JSON.stringify(plan2, null, 2)}
`, derivedReferences: [] }] }), plan: plan2, result: null, hostBoundary: { executesExperiment: false, mintsIndependentAuthority: false } };
  }
  const plan = currentOwnedRecord(root, planPath, mission.missionId, `Experiment plan ${experimentId}`);
  if (plan.schemaVersion !== EXPERIMENT_RECORD_SCHEMA_VERSION || plan.protocolDigest !== protocolDigest || evidenceDigest(plan.protocol) !== protocolDigest) throw new Error("Experiment protocol is immutable once frozen; result recording must replay the exact protocol.");
  if (args.result === void 0) throw new Error("A frozen experiment protocol already exists; recording now requires a result.");
  const resultPath = filePath(".dove/experiments", experimentId, "result");
  if (fs17.existsSync(path22.resolve(root, resultPath))) throw new Error("Experiment result is immutable once recorded; use a new experimentId for another run.");
  const normalized3 = normalizeExperimentResult({
    ...args.result,
    artifactRefs: evidenceRefs(root, mission.missionId, args.result.artifactRefs.map((value) => `artifact:${value}`), "result.artifactRefs"),
    validationRefs: evidenceRefs(root, mission.missionId, args.result.validationRefs.map((value) => `validation:${value}`), "result.validationRefs"),
    failures: args.result.failures.map((failure, index) => ({ ...failure, evidenceRefs: evidenceRefs(root, mission.missionId, failure.evidenceRefs, `result.failures[${index}].evidenceRefs`) }))
  });
  assertResultMatchesProtocol(normalized3, plan.protocol);
  const result = { schemaVersion: EXPERIMENT_RECORD_SCHEMA_VERSION, resultId: experimentId, experimentId, missionId: mission.missionId, protocolDigest, ...normalized3 };
  result.resultDigest = evidenceDigest(result);
  return { ...finalizeDomainArtifacts(root, { actionId: "run-experience-workflow", missionId: mission.missionId, summary: `Recorded formal experiment ${experimentId} result with failures and limitations preserved.`, writes: [{ path: resultPath, kind: "data", content: `${JSON.stringify(result, null, 2)}
`, derivedReferences: [.../* @__PURE__ */ new Set([...result.artifactRefs, ...result.validationRefs, ...result.failures.flatMap((failure) => failure.evidenceRefs)])] }] }), plan, result, hostBoundary: { executesExperiment: false, mintsIndependentAuthority: false } };
}
function archiveArtifact(root, actionId, label, args, fields, prepareSpecializedFields = () => ({})) {
  assertSealedDomainArgs(args, fields, label);
  const { mission } = readCurrentMission(root, args.missionId, label);
  const [artifact] = resolveMissionArtifactReferences(root, mission.missionId, [args.artifactPath], `${label}.artifactPath`);
  if (artifact.missionId !== mission.missionId) throw new Error(`${label}.artifactPath must be currently owned by the exact recording mission.`);
  const references = resolveMissionArtifactReferences(root, mission.missionId, args.referencePaths ?? [], `${label}.referencePaths`);
  const qa = domainStringArray(args.qa, `${label}.qa`);
  const findings = domainStringArray(args.findings, `${label}.findings`);
  const specializedFields = prepareSpecializedFields(mission);
  const staged = stageConsolidatedDomainMutation(root, {
    actionId,
    missionId: mission.missionId,
    operation: label,
    receiptId: `receipt-${actionId}-${crypto18.randomUUID()}`,
    producedAt: (/* @__PURE__ */ new Date()).toISOString(),
    summary: `${label} archived current project artifact ${artifact.path}; QA and findings remain non-authoritative annotations.`,
    externalArtifacts: [{ path: artifact.path, kind: artifact.kind, sha256: artifact.sha256, derivedReferences: references.map((item) => `artifact:${item.path}`) }],
    writes: []
  });
  return { status: "recorded", missionId: mission.missionId, artifact, references, qa, findings, ...specializedFields, receipt: staged.receipt, artifacts: staged.artifacts, writes: staged.writes };
}
function recordDoveDraft(root, args = {}) {
  return archiveArtifact(root, "record-dove-draft", "Draft archive", args, ARCHIVE_FIELDS2);
}
function recordDoveFigure(root, args = {}) {
  return archiveArtifact(root, "record-dove-figure", "Figure archive", args, FIGURE_ARCHIVE_FIELDS, () => ({
    caption: domainNonEmptyText(args.caption, "Figure archive.caption")
  }));
}
function currentFindingReference(root, missionId2, reference, label) {
  const separator = reference.lastIndexOf("#");
  if (separator <= 0 || separator === reference.length - 1) throw new Error(`${label} must use <current-artifact-path>#<finding-id>.`);
  const artifactPath = reference.slice(0, separator);
  const findingId = domainSafeId(reference.slice(separator + 1), `${label} findingId`);
  const resolved = resolveCurrentReviewFinding(root, { missionId: missionId2, reviewPath: artifactPath, findingId });
  if (!resolved) throw new Error(`${label} does not resolve to a preserved finding in a current non-authoritative Review archive.`);
  return { reference: `${resolved.reviewPath}#${findingId}`, finding: resolved.finding, authoritative: false };
}
function recordDoveRebuttal(root, args = {}) {
  return archiveArtifact(root, "record-dove-rebuttal", "Rebuttal archive", args, REBUTTAL_ARCHIVE_FIELDS, (mission) => ({
    findingRefs: domainStringArray(args.findingRefs, "Rebuttal archive.findingRefs", { minItems: 1 }).map((reference, index) => currentFindingReference(root, mission.missionId, reference, `Rebuttal archive.findingRefs[${index}]`)),
    reviewerSignoff: false
  }));
}
function queryDomainIntegrity(root, missionId2 = null) {
  const workspace = openDoveWorkspace(root, { operation: "Domain integrity query" });
  const prefixes = [".dove/sources/", ".dove/claims/", ".dove/experiments/"];
  const domainArtifacts = workspace.receiptLedger.currentOwnership.filter((item) => prefixes.some((prefix) => item.path.startsWith(prefix))).filter((item) => !missionId2 || item.missionId === missionId2);
  const stale = domainArtifacts.filter((item) => !fs17.existsSync(path22.resolve(root, item.path)));
  return { workspaceId: workspace.manifest.workspaceId, missionId: missionId2, artifactCount: domainArtifacts.length, staleArtifactCount: stale.length, stalePaths: stale.map((item) => item.path) };
}

// src/core/mission-queries.mjs
var STATUS_GRAPH_LIMITS = Object.freeze({
  missions: 100,
  requirements: 500,
  workItems: 500,
  researchItems: 500,
  receipts: 500,
  artifacts: 500,
  validations: 500,
  gaps: 500
});
function statusDetail(args = {}) {
  const detail = args.detail ?? "compact";
  if (detail !== "compact" && detail !== "full") throw new Error("Dove status detail must be compact or full.");
  return detail;
}
function compactDomainIntegrity(integrity) {
  return {
    artifactCount: integrity.artifactCount,
    staleArtifactCount: integrity.staleArtifactCount,
    stalePaths: integrity.stalePaths
  };
}
function readCurrentMissions(root, options = {}) {
  const workspace = openDoveWorkspace(root, { allowAbsent: options.allowAbsent === true, operation: options.operation ?? "Dove mission query" });
  if (workspace.state === "absent") return { workspace, missions: [] };
  const missionsRoot = path23.resolve(root, ARTIFACT_PATHS.missionsDir);
  const missions = fs18.readdirSync(missionsRoot, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => {
    const relativePath = path23.posix.join(ARTIFACT_PATHS.missionsDir, entry.name);
    let mission;
    try {
      mission = JSON.parse(fs18.readFileSync(path23.resolve(root, relativePath), "utf8"));
    } catch (error) {
      throw new Error(`Malformed durable JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    assertCurrentMissionContract2(mission);
    return mission;
  }).sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || left.missionId.localeCompare(right.missionId));
  return { workspace, missions };
}
function bounded2(items, limit) {
  return { totalCount: items.length, truncated: items.length > limit, items: items.slice(0, limit) };
}
function missionNumberForId(missions, missionId2) {
  const index = missions.findIndex((mission) => mission.missionId === missionId2);
  if (index < 0) throw new Error("The selected work item is not available in the public mission scope.");
  return index + 1;
}
function resolveMissionNumber(root, missionNumber, options = {}) {
  if (!Number.isSafeInteger(missionNumber) || missionNumber < 1) throw new Error("missionNumber must be an integer greater than or equal to 1 in the stable public mission order.");
  const { missions } = readCurrentMissions(root, { operation: options.operation ?? "Dove public mission selection" });
  const selected = missions[missionNumber - 1] ?? null;
  if (!selected) throw new Error(`No mission exists as missionNumber ${missionNumber} in the stable public mission order.`);
  return selected;
}
function publicMissionNumberForId(root, missionId2, options = {}) {
  const { missions } = readCurrentMissions(root, { operation: options.operation ?? "Dove public mission numbering" });
  return missionNumberForId(missions, missionId2);
}
function publicMissionNumberForCandidate(root, candidate, options = {}) {
  assertCurrentMissionContract2(candidate);
  const { missions } = readCurrentMissions(root, { operation: options.operation ?? "Dove candidate public mission numbering" });
  if (missions.some((mission) => mission.missionId === candidate.missionId)) throw new Error("The candidate work item already exists in the public mission scope.");
  const ordered = [...missions, candidate].sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || left.missionId.localeCompare(right.missionId));
  return missionNumberForId(ordered, candidate.missionId);
}
function resolveVisibleMissionSelector(root, args = {}) {
  const selected = resolveMissionNumber(root, args.missionNumber, { operation: "Dove visible mission selection" });
  if (Object.hasOwn(args, "missionGoal")) {
    const missionGoal = typeof args.missionGoal === "string" ? args.missionGoal.trim() : "";
    if (!missionGoal) throw new Error("missionGoal must be a non-empty exact value shown by Dove status.");
    if (selected.goal !== missionGoal) throw new Error("missionNumber and missionGoal do not refer to the same visible mission.");
  }
  return selected.missionId;
}
function missionRequirements(mission) {
  return mission.requirements.map((description, index) => ({
    requirementId: `requirement-${index + 1}`,
    kind: "requirement",
    description
  }));
}
function missionWorkItems(mission, assessment, decision) {
  const items = [];
  for (const artifact of mission.artifacts) {
    const coverage = assessment.artifactCoverage.find((item) => item.path === artifact.path);
    items.push({ label: artifact.path, kind: "artifact", status: artifact.required && coverage?.covered !== true ? "pending" : "completed" });
  }
  for (const criterion of assessment.criterionCoverage) items.push({ label: criterion.criterion, kind: "completion-criterion", status: criterion.covered ? "completed" : "pending" });
  for (const requirement of assessment.evidenceRequirements) items.push({ label: requirement.requirement, kind: "evidence-requirement", status: requirement.satisfied ? "completed" : "pending" });
  if (decision?.disposition === "block-needs-user") items.push({ label: "Resolve the recorded user decision before continuing.", kind: "user-decision", status: "blocked" });
  if (decision?.nextAction) items.push({ label: decision.nextAction.description, kind: decision.nextAction.kind, status: assessment.researchOutcome.awaitingReevaluation ? "blocked" : "pending" });
  return items;
}
function researchDecisionItems(decision, assessment) {
  if (!decision) return [];
  const items = [
    ...decision.hypotheses.map((item) => ({ kind: "hypothesis", questionOrHypothesis: item.statement, status: item.assessment === "unresolved" ? "pending" : "completed", outcomeSummary: item.assessment, blockedReasonCode: null })),
    ...decision.openQuestions.map((item) => ({ kind: "open-question", questionOrHypothesis: item.question, status: "pending", outcomeSummary: null, blockedReasonCode: null })),
    ...decision.routes.map((item) => ({ kind: "route", questionOrHypothesis: item.summary, status: item.disposition === "selected" ? "pending" : "completed", outcomeSummary: item.rationale, blockedReasonCode: null }))
  ];
  if (assessment.researchOutcome.awaitingReevaluation) items.push({ kind: "receipt-reevaluation", questionOrHypothesis: "Reevaluate the unconsumed research execution receipts.", status: "blocked", outcomeSummary: `${assessment.researchOutcome.unconsumedReceiptIds.length} receipt(s) await scientific judgment.`, blockedReasonCode: "research-outcome-awaiting-reevaluation" });
  if (decision.disposition === "block-needs-user") items.push({ kind: "user-decision", questionOrHypothesis: "Resolve the recorded user decision before continuing.", status: "blocked", outcomeSummary: decision.synthesis, blockedReasonCode: "research-user-decision-required" });
  return items;
}
function workspaceStatusGraph(root, workspace, missions, assessments, selectedMission = null) {
  const scopedMissions = selectedMission ? [selectedMission] : missions;
  const missionBound = bounded2(scopedMissions, STATUS_GRAPH_LIMITS.missions);
  const displayedMissions = missionBound.items;
  const stableMissionDisplayById = new Map(missions.map((mission, displayIndex) => [mission.missionId, displayIndex]));
  const missionDisplayById = new Map(displayedMissions.map((mission) => [mission.missionId, stableMissionDisplayById.get(mission.missionId)]));
  const requirements = [];
  const workItems = [];
  const researchItems = [];
  const blockers = [];
  const missionItems = displayedMissions.map((mission) => {
    const missionDisplayIndex = missionDisplayById.get(mission.missionId);
    const assessment = assessments.get(mission.missionId);
    const decision = workspace.currentResearchDecisions.get(mission.missionId) ?? null;
    const requirementDisplayIndices = missionRequirements(mission).map((requirement) => {
      const item = { displayIndex: requirements.length, missionId: mission.missionId, missionDisplayIndex, ...requirement };
      requirements.push(item);
      return item.displayIndex;
    });
    for (const item of missionWorkItems(mission, assessment, decision)) workItems.push({ displayIndex: workItems.length, missionId: mission.missionId, missionDisplayIndex, dependencyDisplayIndices: [], ...item });
    for (const item of researchDecisionItems(decision, assessment)) {
      const researchItem = { displayIndex: researchItems.length, missionResearchDisplayIndex: researchItems.filter((candidate) => candidate.missionId === mission.missionId).length, missionId: mission.missionId, missionDisplayIndex, workDescription: item.kind, stopCondition: null, ...item };
      researchItems.push(researchItem);
      if (researchItem.status === "blocked") blockers.push({ researchItemDisplayIndex: researchItem.displayIndex, missionDisplayIndex, completionImpact: "required", blockedReasonCode: researchItem.blockedReasonCode, outcomeSummary: researchItem.outcomeSummary });
    }
    return {
      displayIndex: missionDisplayIndex,
      missionId: mission.missionId,
      mode: mission.mode,
      goal: mission.goal,
      createdAt: mission.createdAt,
      status: decision?.disposition === "block-needs-user" ? "blocked" : assessment.status,
      complete: assessment.complete,
      dependencyMissionIds: [...mission.dependsOnMissionIds],
      dependencyDisplayIndices: mission.dependsOnMissionIds.map((missionId2) => missionDisplayById.get(missionId2)).filter((value) => value !== void 0),
      parentMissionId: mission.parentMissionId ?? null,
      parentDisplayIndex: mission.parentMissionId ? missionDisplayById.get(mission.parentMissionId) ?? null : null,
      branchKind: mission.branchKind ?? null,
      branchReason: mission.branchReason ?? null,
      lifecycle: assessment.lifecycle,
      requirementDisplayIndices,
      declaredOutputs: mission.artifacts.filter((artifact) => artifact.role !== "supporting").map((artifact) => ({ path: artifact.path, required: artifact.required, present: inspectDeclaredPath(root, artifact.path, { requireNonEmpty: true, rejectBookkeeping: true }).status === "existing" })),
      uncoveredOutputs: assessment.artifactCoverage.filter((item) => !item.covered).map((item) => item.path),
      uncoveredCompletionCriteria: assessment.criterionCoverage.filter((item) => !item.covered).map((item) => item.criterion),
      unmetEvidenceRequirements: assessment.evidenceRequirements.filter((item) => !item.satisfied).map((item) => item.requirement),
      gapCodes: assessment.incompleteReasons
    };
  });
  const interpretedResearchReceiptIds = new Set([...workspace.researchDecisions.values()].flatMap((decision) => decision.consumedReceiptIds));
  const receipts = workspace.receiptLedger.receipts.filter((receipt) => missionDisplayById.has(receipt.missionId)).sort((left, right) => left.ledgerSequence - right.ledgerSequence).map((receipt) => ({ displayIndex: receipt.ledgerSequence - 1, receiptId: receipt.receiptId, missionId: receipt.missionId, missionDisplayIndex: missionDisplayById.get(receipt.missionId), summary: receipt.summary, producedAt: receipt.producedAt, artifactCount: receipt.artifacts.length, validationCount: receipt.validations.length, criteriaCount: receipt.criteriaSatisfied.length, outcomeMode: receipt.ordinaryHostOutcome?.mode ?? (receipt.researchOutcome ? "research-execution" : null), outcomeStatus: receipt.ordinaryHostOutcome?.status ?? receipt.researchOutcome?.status ?? null, interpretationStatus: receipt.researchOutcome ? interpretedResearchReceiptIds.has(receipt.receiptId) ? "interpreted" : "awaiting-reevaluation" : null, factCount: receipt.ordinaryHostOutcome?.facts?.length ?? receipt.researchOutcome?.facts?.length ?? 0 }));
  const receiptBound = bounded2(receipts, STATUS_GRAPH_LIMITS.receipts);
  const receiptDisplayById = new Map(receiptBound.items.map((receipt) => [receipt.receiptId, receipt.displayIndex]));
  const artifacts = workspace.receiptLedger.currentOwnership.filter((artifact) => missionDisplayById.has(artifact.missionId)).sort((left, right) => left.path.localeCompare(right.path)).map((artifact, displayIndex) => ({ displayIndex, path: artifact.path, kind: artifact.kind, missionId: artifact.missionId, missionDisplayIndex: missionDisplayById.get(artifact.missionId), receiptId: artifact.receiptId, receiptDisplayIndex: receiptDisplayById.get(artifact.receiptId) ?? null }));
  const validations = workspace.receiptLedger.receipts.filter((receipt) => missionDisplayById.has(receipt.missionId)).flatMap((receipt) => receipt.validations.map((validation) => ({ receipt, validation }))).map(({ receipt, validation }, displayIndex) => ({ displayIndex, kind: validation.kind, reference: validation.reference, missionId: receipt.missionId, missionDisplayIndex: missionDisplayById.get(receipt.missionId), receiptId: receipt.receiptId, receiptDisplayIndex: receiptDisplayById.get(receipt.receiptId) ?? null }));
  const gapItems = missionItems.flatMap((mission) => mission.gapCodes.map((code) => ({ kind: "mission-completion", code, missionId: mission.missionId, missionDisplayIndex: mission.displayIndex })));
  const gapKeys = new Set(gapItems.map((item) => `${item.missionDisplayIndex}:${item.code}`));
  for (const blocker of blockers) {
    const key = `${blocker.missionDisplayIndex}:${blocker.blockedReasonCode}`;
    if (!gapKeys.has(key)) gapItems.push({ kind: "research-blocker", code: blocker.blockedReasonCode, ...blocker });
  }
  return {
    graphVersion: 2,
    bounded: true,
    stableOrdering: "createdAt-then-id; ledger-sequence; canonical-path",
    provenanceAlignment: "mission-contract-decision-chain-and-receipt-lineage",
    textSimilarityUsed: false,
    limits: STATUS_GRAPH_LIMITS,
    missions: { ...missionBound, items: missionItems },
    requirements: bounded2(requirements, STATUS_GRAPH_LIMITS.requirements),
    workItems: bounded2(workItems, STATUS_GRAPH_LIMITS.workItems),
    researchItems: bounded2(researchItems, STATUS_GRAPH_LIMITS.researchItems),
    researchBlockers: bounded2(blockers, STATUS_GRAPH_LIMITS.researchItems),
    receipts: receiptBound,
    artifacts: bounded2(artifacts, STATUS_GRAPH_LIMITS.artifacts),
    validations: bounded2(validations, STATUS_GRAPH_LIMITS.validations),
    gaps: bounded2(gapItems.map((item, displayIndex) => ({ displayIndex, ...item })), STATUS_GRAPH_LIMITS.gaps)
  };
}
function narrativeStatus(workspace, missions, selectedMission, missionScope, assessments) {
  if (!selectedMission) {
    if (missions.length <= 1 || missionScope !== "workspace") return { state: "unavailable", kind: null, narrative: null };
    const narrative = buildProjectResearchNarrativeFromWorkspace({
      mainline: workspace.currentWorkspaceRevision.mainline,
      currentWorkspaceRevisionId: workspace.currentWorkspaceRevision.revisionId,
      missionTransitions: workspace.missionTransitions,
      missions,
      currentDecisions: workspace.currentResearchDecisions,
      assessments
    });
    return narrative ? { state: "available", kind: "project", narrative } : { state: "unavailable", kind: null, narrative: null };
  }
  const decision = workspace.currentResearchDecisions.get(selectedMission.missionId) ?? null;
  return decision ? { state: "available", kind: "mission", narrative: buildResearchNarrativeFromDecision(decision, { awaitingReevaluation: assessments.get(selectedMission.missionId)?.researchOutcome?.awaitingReevaluation === true }) } : { state: "unavailable", kind: null, narrative: null };
}
function statusGraphCollection(graph, name) {
  const value = graph?.[name];
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value, items: Array.isArray(value.items) ? value.items : [] } : { totalCount: 0, truncated: false, items: [] };
}
function statusCounts(items) {
  const counts = { completed: 0, pending: 0, blocked: 0 };
  for (const item of Array.isArray(items) ? items : []) {
    if (item && typeof item === "object" && Object.hasOwn(counts, item.status)) counts[item.status] += 1;
  }
  return counts;
}
function publicStatusScope(value, count) {
  if (value === "only-mission" || value === "explicit") return "single workstream";
  if (count === 0) return "workspace setup";
  return "workspace portfolio";
}
function statusAttentionCategory(reason) {
  const normalized3 = String(reason ?? "").toLowerCase();
  if (normalized3.includes("review") || normalized3.includes("issuer")) return "review";
  if (normalized3.includes("source")) return "source";
  if (normalized3.includes("research") || normalized3.includes("blocked")) return "work";
  if (normalized3.includes("artifact") || normalized3.includes("receipt") || normalized3.includes("evidence")) return "evidence";
  if (normalized3.includes("supersed")) return "direction";
  return "integrity";
}
function statusRiskFromReason(reason) {
  const guidance = {
    review: {
      whyItMatters: "Independent confirmation is needed before the result can be treated as final.",
      impact: "The produced work may be usable, but sign-off remains open."
    },
    source: {
      whyItMatters: "The conclusion depends on source material that is not yet eligible for use.",
      impact: "Claims may remain unsupported or require revision."
    },
    work: {
      whyItMatters: "Required work cannot advance to its stated completion condition.",
      impact: "The affected result remains partial until the blocker is resolved or the direction changes."
    },
    evidence: {
      whyItMatters: "Current evidence is needed to show that the produced work still matches the stated requirements.",
      impact: "Completion cannot be confirmed even if useful work already exists."
    },
    direction: {
      whyItMatters: "Continuing an older direction can duplicate effort or produce conflicting results.",
      impact: "Further work here may not contribute to the current objective."
    },
    integrity: {
      whyItMatters: "A required completion condition is not currently supported.",
      impact: "The overall result should not yet be presented as fully verified."
    }
  }[statusAttentionCategory(reason)];
  return { whatHappened: reason, whyItMatters: guidance.whyItMatters, impact: guidance.impact, evidenceStrength: "strong" };
}
function uniqueStatusRisks(reasons) {
  const seen = /* @__PURE__ */ new Set();
  return reasons.flatMap((reason) => {
    if (typeof reason !== "string" || !reason.trim() || seen.has(reason)) return [];
    seen.add(reason);
    return [statusRiskFromReason(reason)];
  });
}
function statusOutputPaths(items, predicate = () => true) {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.filter((item) => item && typeof item === "object" && predicate(item)).map((item) => item.path).filter((value) => typeof value === "string" && value.trim() && !/(?:^|\/)\.dove(?:-archive)?(?:\/|$)/u.test(value)))];
}
function statusCondition(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.startsWith("artifact:")) {
    const artifactPath = value.slice("artifact:".length);
    return artifactPath && !/(?:^|\/)\.dove(?:-archive)?(?:\/|$)/u.test(artifactPath) ? `a current outcome record for ${artifactPath}` : "a current outcome record for the declared output";
  }
  if (value.startsWith("validation:")) {
    const validationPath = value.slice("validation:".length);
    return validationPath && !/(?:^|\/)\.dove(?:-archive)?(?:\/|$)/u.test(validationPath) ? `a separate validation output at ${validationPath}` : "a separate validation output";
  }
  if (/^(?:source|note):/u.test(value)) return "eligible current source evidence";
  return value;
}
function statusWorkstreamItems(graph) {
  return statusGraphCollection(graph, "missions").items.filter((item) => item && typeof item === "object").map((item, index) => {
    const number2 = index + 1;
    const presentOutputs = statusOutputPaths(item.declaredOutputs, (output) => output.present === true);
    const missingOutputs = [...new Set((Array.isArray(item.uncoveredOutputs) ? item.uncoveredOutputs : []).filter((value) => typeof value === "string" && !/(?:^|\/)\.dove(?:-archive)?(?:\/|$)/u.test(value)))];
    const uncoveredCriteria = [...new Set((Array.isArray(item.uncoveredCompletionCriteria) ? item.uncoveredCompletionCriteria : []).filter((value) => typeof value === "string"))];
    const unmetConditions = [...new Set((Array.isArray(item.unmetEvidenceRequirements) ? item.unmetEvidenceRequirements : []).map(statusCondition).filter(Boolean))];
    return { number: number2, goal: item.goal, presentOutputs, missingOutputs, uncoveredCriteria, unmetConditions, complete: item.complete === true };
  });
}
function statusWorkstreamRisk(items, kind) {
  const workLabel = `Work ${items.map((item) => item.number).join(", ")}`;
  const details = items.map((item) => {
    const goal = typeof item.goal === "string" && item.goal ? ` (${item.goal})` : "";
    const outputs = (kind === "missing" ? item.missingOutputs : item.presentOutputs).join(", ");
    return `Work ${item.number}${goal}: ${outputs || "no public output file is listed"}`;
  }).join("; ");
  const criteria = [...new Set(items.flatMap((item) => item.uncoveredCriteria))];
  const conditions = [...new Set(items.flatMap((item) => item.unmetConditions))];
  const criteriaText = criteria.length ? `Uncovered completion conditions: ${criteria.join("; ")}.` : "";
  const conditionsText = conditions.length ? `Still required: ${conditions.join("; ")}.` : "";
  if (kind === "missing") return {
    whatHappened: `${workLabel} do not yet have their declared outputs. ${details}`,
    whyItMatters: "These workstreams do not yet have files that can be assessed.",
    impact: `${criteriaText} ${conditionsText}`.trim() || "Their completion conditions cannot yet be confirmed.",
    evidenceStrength: "strong"
  };
  return {
    whatHappened: `${workLabel} have output files, but completion evidence is still incomplete. ${details}`,
    whyItMatters: "The files exist, but not every completion condition can yet be confirmed.",
    impact: `${criteriaText} ${conditionsText}`.trim() || "The outputs may be usable, but completion remains open.",
    evidenceStrength: "strong"
  };
}
function statusWorkstreamRisks(graph) {
  const incomplete = statusWorkstreamItems(graph).filter((item) => !item.complete);
  const missing = incomplete.filter((item) => item.presentOutputs.length === 0 && item.missingOutputs.length > 0);
  const produced = incomplete.filter((item) => item.presentOutputs.length > 0);
  return [...missing.length ? [statusWorkstreamRisk(missing, "missing")] : [], ...produced.length ? [statusWorkstreamRisk(produced, "produced")] : []];
}
function buildPublicStatusProjection(data) {
  const context = data?.currentContext && typeof data.currentContext === "object" && !Array.isArray(data.currentContext) ? data.currentContext : {};
  const graph = data?.durableStatus?.workspaceGraph;
  const counts = statusCounts(statusGraphCollection(graph, "workItems").items);
  const trackedWorkstreams = Number(context.missionCount) || 0;
  const currentEvidenceCount = Number(context.receiptCount) || 0;
  const recordedOutputs = statusOutputPaths(statusGraphCollection(graph, "artifacts").items);
  const declaredPresentOutputs = statusGraphCollection(graph, "missions").items.flatMap((item) => statusOutputPaths(item?.declaredOutputs, (output) => output.present === true));
  const allCurrentOutputs = [.../* @__PURE__ */ new Set([...recordedOutputs, ...declaredPresentOutputs])];
  const currentOutputCount = allCurrentOutputs.length;
  const currentOutputs = allCurrentOutputs.slice(0, 5);
  const sourceCount = Number(context.sourceCount) || 0;
  const integrity = context.integrityAssessment && typeof context.integrityAssessment === "object" && !Array.isArray(context.integrityAssessment) ? context.integrityAssessment : null;
  const operationalIntegrity = {
    hostActionReturned: integrity?.operationalIntegrity?.hostActionReturned === true || integrity?.ordinaryHostReturn?.present === true,
    receiptRecorded: integrity?.operationalIntegrity?.receiptRecorded === true || currentEvidenceCount > 0,
    completionEvidenceSatisfied: integrity?.operationalIntegrity?.completionEvidenceSatisfied === true,
    lifecycleClosed: integrity?.operationalIntegrity?.lifecycleClosed === true
  };
  const hostReturn = integrity?.ordinaryHostReturn?.current && typeof integrity.ordinaryHostReturn.current === "object" ? integrity.ordinaryHostReturn.current : null;
  const hostReturnStatus = typeof hostReturn?.status === "string" ? hostReturn.status : null;
  const completedObservation = hostReturn?.mode === "observation-only" && hostReturnStatus === "completed";
  const hostReturnedNonCompletion = ["blocked", "failed", "stopped"].includes(hostReturnStatus);
  const complete = integrity?.complete === true;
  const review = context.reviewValidity && typeof context.reviewValidity === "object" && !Array.isArray(context.reviewValidity) ? context.reviewValidity : { authority: "not-established", currentCount: 0, staleCount: 0, failures: [] };
  const currentReviewCount = Number.isSafeInteger(review.currentCount) && review.currentCount > 0 ? review.currentCount : 0;
  const staleReviewCount = Number.isSafeInteger(review.staleCount) && review.staleCount > 0 ? review.staleCount : 0;
  const reviewFailures = Array.isArray(review.failures) ? review.failures.filter((item) => typeof item === "string") : [];
  const stableGaps = data?.needsAttention?.stableGaps ?? {};
  const researchReasons = Array.isArray(stableGaps.research) ? stableGaps.research.map((item) => item?.blockedReasonCode ?? item?.code).filter((item) => typeof item === "string") : [];
  const attentionReasons = [
    ...Array.isArray(data?.needsAttention?.reasons) ? data.needsAttention.reasons : [],
    ...Array.isArray(stableGaps.completion) ? stableGaps.completion : [],
    ...Array.isArray(stableGaps.review) ? stableGaps.review : [],
    ...researchReasons
  ].filter((item) => typeof item === "string");
  const specificRisks = statusWorkstreamRisks(graph);
  const specificallyCoveredCategories = new Set(specificRisks.flatMap((risk) => {
    const normalized3 = `${risk.whatHappened} ${risk.impact}`.toLowerCase();
    return [...normalized3.includes("output") || normalized3.includes("evidence") ? ["evidence", "integrity"] : [], ...normalized3.includes("review") ? ["review"] : [], ...normalized3.includes("source") ? ["source"] : []];
  }));
  const genericRisks = uniqueStatusRisks(attentionReasons).filter((risk) => !specificallyCoveredCategories.has(statusAttentionCategory(risk.whatHappened)));
  const risksAndBlockers = [...specificRisks, ...genericRisks];
  const hasCurrentWork = currentOutputCount > 0 || currentEvidenceCount > 0 || counts.completed > 0 || completedObservation;
  const hasBlockedWork = counts.blocked > 0 || hostReturnedNonCompletion || risksAndBlockers.some((risk) => statusAttentionCategory(risk.whatHappened) === "work");
  const workState = complete ? "complete" : hostReturnedNonCompletion ? "blocked" : hasCurrentWork ? "work-produced" : hasBlockedWork ? "blocked" : trackedWorkstreams > 0 || counts.pending > 0 ? "in-progress" : "not-started";
  const workSummary = complete ? "The tracked work satisfies its stated completion conditions." : hostReturnedNonCompletion ? `The work ended with status ${hostReturnStatus} and remains incomplete.` : hasCurrentWork ? completedObservation ? "The host action returned completed and concrete execution observations were recorded, but completion evidence or lifecycle closure remains open." : "Current work products exist; remaining gaps concern verification, review, or specific unfinished items." : hasBlockedWork ? "Required work is blocked before a current result can be produced." : trackedWorkstreams > 0 ? "Work is underway, but no current result has been recorded yet." : "No tracked work has started yet.";
  const hasReviewHistory = currentReviewCount > 0 || staleReviewCount > 0;
  const evidenceState = complete ? "ready" : currentEvidenceCount > 0 ? "current-with-gaps" : currentOutputCount > 0 ? "evidence-recording-missing" : "missing";
  const evidenceSummary = evidenceState === "ready" ? "Current evidence supports completion." : evidenceState === "current-with-gaps" ? "Current evidence exists, but one or more completion conditions still need support." : evidenceState === "evidence-recording-missing" ? "Output files exist, but they have not yet been supported by current completion evidence." : "Current completion evidence has not been recorded.";
  const progressTotal = counts.completed + counts.pending + counts.blocked;
  const progressState = complete ? "complete" : counts.blocked > 0 ? "blocked" : hasCurrentWork ? "advanced" : trackedWorkstreams > 0 ? "in-progress" : "not-started";
  const progressSummary = progressTotal > 0 ? `${counts.completed} completed, ${counts.pending} pending, and ${counts.blocked} blocked tracked item${progressTotal === 1 ? "" : "s"}.` : hasCurrentWork ? "Current work products are available." : "No item-level progress is available.";
  const findings = [];
  if (currentOutputs.length > 0) findings.push(`Current outputs include ${currentOutputs.join(", ")}${currentOutputCount > currentOutputs.length ? ` and ${currentOutputCount - currentOutputs.length} more` : ""}.`);
  else if (currentOutputCount > 0) findings.push(`${currentOutputCount} current output${currentOutputCount === 1 ? " is" : "s are"} available.`);
  if (counts.completed > 0) findings.push(`${counts.completed} tracked work item${counts.completed === 1 ? " has" : "s have"} reached its stated completion condition.`);
  if (sourceCount > 0) findings.push(`${sourceCount} source${sourceCount === 1 ? " is" : "s are"} available for the current scope.`);
  if (currentReviewCount > 0) findings.push(`${currentReviewCount} current non-authoritative Review archive${currentReviewCount === 1 ? " is" : "s are"} available.`);
  if (staleReviewCount > 0) findings.push(`${staleReviewCount} archived Review record${staleReviewCount === 1 ? " is" : "s are"} stale.`);
  if (complete && findings.length === 0) findings.push("The stated completion conditions are satisfied.");
  const narrativeState = context.narrativeState === "available" ? "available" : "unavailable";
  const narrativeKind = context.narrativeKind === "project" || context.narrativeKind === "mission" ? context.narrativeKind : null;
  const researchNarrative = narrativeState === "available" && context.researchNarrative && typeof context.researchNarrative === "object" ? context.researchNarrative : null;
  const recommendation = researchNarrative ? narrativeKind === "project" ? researchNarrative.recommendation : researchNarrative.nextStep ?? researchNarrative.stopReason : "No current research judgment is available; status does not invent a recommendation from progress or risk heuristics.";
  const currentSituationSummary = trackedWorkstreams === 0 ? "The workspace has no tracked workstream yet." : `${trackedWorkstreams} workstream${trackedWorkstreams === 1 ? " is" : "s are"} in scope; ${risksAndBlockers.length} material risk or blocker${risksAndBlockers.length === 1 ? " requires" : "s require"} attention.`;
  const executiveSummary = complete ? "The current work satisfies its stated completion conditions." : hostReturnedNonCompletion ? `The work ended with status ${hostReturnStatus} and is not complete.` : completedObservation ? "The host action returned completed, but the work is not complete because completion evidence or lifecycle closure remains open." : hasCurrentWork ? `Useful work is already present. ${evidenceSummary}` : hasBlockedWork ? "The current work is blocked before a usable result has been recorded." : "The current work is still in progress and does not yet have a recorded result.";
  return {
    status: typeof data?.status === "string" ? data.status : "ok",
    detailsAvailable: data?.detailsAvailable === true,
    message: executiveSummary,
    executiveSummary,
    currentSituation: { scope: publicStatusScope(context.missionScope, trackedWorkstreams), trackedWorkstreams, summary: currentSituationSummary, attentionRequired: risksAndBlockers.length > 0 },
    progress: { state: progressState, completedItems: counts.completed, inProgressItems: counts.pending, blockedItems: counts.blocked, totalItems: progressTotal, summary: progressSummary },
    findings,
    risksAndBlockers,
    workStatus: { state: workState, summary: workSummary, currentOutputCount, currentOutputs, returnStatus: hostReturnStatus, observationOnly: hostReturn?.mode === "observation-only" },
    evidenceStatus: { state: evidenceState, summary: evidenceSummary, currentEvidenceCount, sourceCount, review: { required: false, authority: "not-established", currentCount: currentReviewCount, staleCount: staleReviewCount, status: currentReviewCount > 0 ? "current" : hasReviewHistory ? "stale" : "not-recorded" } },
    operationalIntegrity,
    researchNarrative,
    narrativeKind,
    narrativeState,
    recommendation,
    nextActions: []
  };
}
function emptyStatus(args, detail) {
  const headline = "This project has no explicit Dove workspace research mainline yet.";
  const currentContext = { missionCount: 0, missionScope: "workspace", selectedMissionId: null, receiptCount: 0, sourceCount: 0, integrityAssessment: { status: "incomplete", complete: false, lifecycle: null, dependencyCoverage: [], staleReceiptCount: 0, incompleteReasons: ["workspace-not-initialized"], operationalIntegrity: { hostActionReturned: false, receiptRecorded: false, completionEvidenceSatisfied: false, lifecycleClosed: false }, researchOutcome: { receiptIds: [], consumedReceiptIds: [], unconsumedReceiptIds: [], awaitingReevaluation: false } }, domainIntegrity: null, reviewValidity: null, researchNarrative: null, narrativeKind: null, narrativeState: "unavailable" };
  const result = {
    status: "ok",
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    intent: typeof args.intent === "string" ? args.intent.trim() || null : null,
    detail: "compact",
    detailsAvailable: true,
    summary: headline,
    headline,
    scope: { kind: "minimal-mission-workspace", schemaVersion: null, state: "absent", missionScope: "workspace", missionId: null },
    currentContext,
    durableStatus: { state: "absent", workspaceGraph: null },
    liveHostActivity: { included: false, available: false, source: "host-owned-live-context" },
    needsAttention: { status: "needs-workspace", reasons: ["workspace-not-initialized"], stableGaps: { completion: ["workspace-not-initialized"], dependencies: [], lifecycle: null, sources: [], domain: [], review: [], research: [] } },
    changes: { intent: "none", applied: false, count: 0, rollback: "not-applicable" },
    showMore: { detailsAvailable: true },
    optionalMissionDetails: null
  };
  const projectedResult = { ...result, publicStatus: buildPublicStatusProjection(result) };
  return detail === "full" ? { ...projectedResult, detail: "full", manifest: null, project: null, missions: [], integrityAssessment: null, domainIntegrity: null, sourceIntegrity: null, reviewValidity: null, diagnostics: { artifactPathsRead: [], noRefresh: true, noCommandExecution: true, noExternalProcess: true, noGitInspection: true, noSourceMutation: true, liveHostActivityRead: false } } : projectedResult;
}
function queryDoveStatus(root, args = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Dove status arguments must be a plain object.");
  const allowed2 = /* @__PURE__ */ new Set(["missionNumber", "missionId", "intent", "detail", "language"]);
  const unknown = Object.keys(args).filter((field) => !allowed2.has(field));
  if (unknown.length > 0) throw new Error(`Dove status does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const detail = statusDetail(args);
  const { workspace, missions } = readCurrentMissions(root, { allowAbsent: true, operation: "Dove status" });
  if (workspace.state === "absent") return emptyStatus(args, detail);
  const hasMissionNumber = Object.hasOwn(args, "missionNumber");
  const requestedMissionId = typeof args.missionId === "string" ? args.missionId.trim() : "";
  const selectedMission = requestedMissionId ? missions.find((mission) => mission.missionId === requestedMissionId) ?? null : hasMissionNumber ? resolveMissionNumber(root, args.missionNumber, { operation: "Dove status mission selection" }) : missions.length === 1 ? missions[0] : null;
  if (requestedMissionId && !selectedMission) throw new Error(`Mission does not exist: ${requestedMissionId}.`);
  const missionScope = requestedMissionId || hasMissionNumber ? "explicit" : missions.length === 1 ? "only-mission" : "workspace";
  const assessments = new Map(missions.map((mission) => [mission.missionId, assessMissionCompletion(root, { missionId: mission.missionId })]));
  const workspaceGraph = workspaceStatusGraph(root, workspace, missions, assessments, selectedMission);
  const integrityAssessment = selectedMission ? assessments.get(selectedMission.missionId) : null;
  const receipts = readExecutionReceipts(root, selectedMission?.missionId ?? null);
  const domainIntegrity = queryDomainIntegrity(root, selectedMission?.missionId ?? null);
  const scopedMissions = selectedMission ? [selectedMission] : missions;
  const sourceItems = scopedMissions.flatMap((mission) => querySources(root, { missionId: mission.missionId, limit: 200 }).items);
  const requiredSourceIds = [];
  const requiredSources = selectedMission ? evaluateSourceIds(root, requiredSourceIds, selectedMission.missionId).map((evaluation) => ({
    sourceId: evaluation.sourceId,
    lifecycle: evaluation.source?.lifecycle ?? "missing",
    eligible: evaluation.eligible === true,
    reason: evaluation.reason
  })) : [];
  const sourceIntegrity = {
    sourceCount: sourceItems.length,
    eligibleCount: sourceItems.filter((item) => item.eligibility?.eligible === true).length,
    candidateCount: sourceItems.filter((item) => item.lifecycle === "candidate").length,
    rejectedCount: sourceItems.filter((item) => item.lifecycle === "rejected").length,
    invalidCount: 0,
    required: requiredSources
  };
  const requiresSourceEvidence = requiredSourceIds.length > 0;
  const reviewValidity = selectedMission ? queryReviewRecords(root, { missionId: selectedMission.missionId }) : { authority: "not-established", currentCount: 0, staleCount: 0, reviews: [] };
  const sourceGaps = requiresSourceEvidence ? requiredSources.filter((item) => item.eligible !== true) : [];
  const reviewGaps = reviewValidity.reviews.filter((item) => !item.current).flatMap((item) => item.failures);
  const headline = `Dove schema ${workspace.schemaVersion} is healthy with ${missions.length} mission contract${missions.length === 1 ? "" : "s"}.`;
  const lifecycle = integrityAssessment?.lifecycle ?? null;
  const workspaceGapCodes = workspaceGraph.gaps.items.map((gap) => gap.code);
  const stableGaps = {
    completion: integrityAssessment?.incompleteReasons ?? workspaceGapCodes,
    dependencies: integrityAssessment?.dependencyCoverage?.filter((dependency) => !dependency.complete) ?? [],
    lifecycle,
    sources: sourceGaps,
    domain: domainIntegrity.stalePaths ?? [],
    review: reviewGaps,
    research: integrityAssessment?.researchOutcome?.awaitingReevaluation ? [{ code: "research-outcome-awaiting-reevaluation" }] : workspaceGraph.researchBlockers.items
  };
  const attentionReasons = [.../* @__PURE__ */ new Set([
    ...stableGaps.completion,
    ...stableGaps.domain,
    ...stableGaps.sources.length > 0 ? ["source-evidence-unavailable"] : [],
    ...stableGaps.review.length > 0 ? ["review-evidence-unavailable"] : [],
    ...sourceIntegrity.invalidCount > 0 ? ["invalid-source-verification"] : []
  ])];
  const narrative = narrativeStatus(workspace, missions, selectedMission, missionScope, assessments);
  const currentContext = {
    missionCount: scopedMissions.length,
    missionScope,
    selectedMissionId: selectedMission?.missionId ?? null,
    selectedMissionMode: selectedMission?.mode ?? null,
    receiptCount: receipts.length,
    sourceCount: sourceIntegrity.sourceCount,
    integrityAssessment: integrityAssessment ? {
      status: integrityAssessment.status,
      complete: integrityAssessment.complete,
      lifecycle,
      dependencyCoverage: integrityAssessment.dependencyCoverage,
      staleReceiptCount: integrityAssessment.staleReceiptIds.length,
      incompleteReasons: integrityAssessment.incompleteReasons,
      ...integrityAssessment.ordinaryHostReturn?.present ? { ordinaryHostReturn: integrityAssessment.ordinaryHostReturn } : {},
      operationalIntegrity: integrityAssessment.operationalIntegrity,
      researchOutcome: integrityAssessment.researchOutcome
    } : null,
    domainIntegrity: compactDomainIntegrity(domainIntegrity),
    reviewValidity: { authority: "not-established", currentCount: reviewValidity.currentCount, staleCount: reviewValidity.staleCount, failures: reviewGaps },
    researchNarrative: narrative.narrative,
    narrativeKind: narrative.kind,
    narrativeState: narrative.state
  };
  const needsAttention = {
    status: attentionReasons.length ? lifecycle?.status ?? "incomplete" : "clear",
    reasons: attentionReasons,
    stableGaps
  };
  const durableStatus = { state: "current", missionScope, workspaceGraph };
  const liveHostActivity = { included: false, available: false, source: "host-owned-live-context" };
  const result = {
    status: "ok",
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    intent: typeof args.intent === "string" ? args.intent.trim() || null : null,
    detail: "compact",
    detailsAvailable: true,
    summary: headline,
    headline,
    scope: { kind: "minimal-mission-workspace", schemaVersion: workspace.schemaVersion, missionScope, missionId: selectedMission?.missionId ?? null },
    currentContext,
    durableStatus,
    liveHostActivity,
    needsAttention,
    changes: { intent: "none", applied: false, count: 0, rollback: "not-applicable" },
    showMore: { detailsAvailable: true },
    optionalMissionDetails: null
  };
  const projectedResult = { ...result, publicStatus: buildPublicStatusProjection(result) };
  if (detail !== "full") return projectedResult;
  return {
    ...projectedResult,
    detail: "full",
    manifest: workspace.manifest,
    project: workspace.project,
    missions: selectedMission ? [selectedMission] : missions,
    integrityAssessment,
    domainIntegrity,
    sourceIntegrity,
    reviewValidity,
    diagnostics: {
      artifactPathsRead: [ARTIFACT_PATHS.doveRootManifest, ARTIFACT_PATHS.projectIdentity, ARTIFACT_PATHS.missionsDir, ARTIFACT_PATHS.executionReceiptsDir, ARTIFACT_PATHS.researchDecisionsDir, ".dove/sources"],
      noRefresh: true,
      noCommandExecution: true,
      noExternalProcess: true,
      noGitInspection: true,
      noSourceMutation: true,
      liveHostActivityRead: false,
      provenanceAlignment: "mission-contract-decision-chain-and-receipt-lineage",
      textSimilarityUsed: false
    }
  };
}
function queryDoveMission(root, args = {}) {
  const inspection = openDoveWorkspace(root, { allowAbsent: true, operation: "Dove mission preview" });
  if (inspection.state !== "absent") return previewDoveMissionContract(root, args);
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Dove mission preview arguments must be a plain object.");
  const allowed2 = /* @__PURE__ */ new Set(["mode", "goal", "requirements", "assumptions", "scope", "outOfScope", "artifacts", "completionCriteria", "evidenceRequirements"]);
  const unknown = Object.keys(args).filter((field) => !allowed2.has(field));
  if (unknown.length > 0) throw new Error(`Dove mission preview without a workspace does not accept input that requires durable lineage: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const mode = typeof args.mode === "string" ? args.mode.trim() : "";
  if (!["ordinary", "research"].includes(mode)) throw new Error("Dove mission preview requires explicit mode: ordinary or research.");
  const goal = typeof args.goal === "string" ? args.goal.trim() : "";
  if (!goal) throw new Error("Dove mission preview requires a non-empty goal.");
  const stringList = (value, label) => {
    if (value === void 0) return [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${label} must be an array of non-empty strings.`);
    return [...new Set(value.map((item) => item.trim()))];
  };
  const artifacts = Array.isArray(args.artifacts) ? args.artifacts.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.path !== "string" || !item.path.trim() || typeof item.required !== "boolean" || !["output", "input-output", "supporting"].includes(item.role)) throw new Error(`artifacts[${index}] must declare path, required, and role.`);
    return { path: item.path.trim(), required: item.required, role: item.role };
  }) : [];
  return {
    status: "proposal",
    mission: { mode, goal, requirements: stringList(args.requirements, "requirements"), assumptions: stringList(args.assumptions, "assumptions"), scope: stringList(args.scope, "scope"), outOfScope: stringList(args.outOfScope, "outOfScope"), artifacts, completionCriteria: stringList(args.completionCriteria, "completionCriteria"), evidenceRequirements: stringList(args.evidenceRequirements, "evidenceRequirements") },
    confirmation: { required: false },
    needsWorkspace: true,
    mutation: { mutationMode: "none", writesApplied: false, paths: [] }
  };
}

// src/core/role-definitions.mjs
var ROLE_DEFINITIONS = Object.freeze({
  planner: Object.freeze({
    id: "planner",
    publicName: "Planner",
    title: "dove-planner",
    description: "Define a proportional mission goal, scope, dependencies, evidence needs, and completion conditions.",
    responsibility: "Frame the user's request for the three primary roles: Planner, Builder/Author, and independent Reviewer.",
    inputs: Object.freeze([
      "The user's goal, constraints, supplied context, and desired deliverable",
      "Public Dove mission or status context when durable context is needed",
      "Current external facts from visible bounded public search when they may affect the plan"
    ]),
    outputs: Object.freeze([
      "A proportional goal and clear in-scope and out-of-scope boundaries",
      "Expected deliverables, dependencies, evidence needs, assumptions, blockers, and completion conditions",
      "For research work, an explicit real problem, key unknown or hypothesis, bounded approach, discriminating evidence, resource facts, stop conditions, and claim boundary; for ordinary work, no invented research credit",
      "A handoff of substantive work to Builder/Author and frozen review scope to Reviewer"
    ])
  }),
  builder: Object.freeze({
    id: "builder",
    publicName: "Builder/Author",
    title: "dove-builder",
    description: "Produce substantive research, code, writing, experiments, figures, revisions, and author-side rebuttal.",
    responsibility: "Perform the substantive work within the approved goal and scope as Builder/Author, distinct from Planner and independent Reviewer.",
    inputs: Object.freeze([
      "The approved goal, scope, deliverables, dependencies, and completion conditions",
      "Supplied materials and public Dove context needed for the work",
      "Host tools, subagents, and visible external search when they materially advance the task"
    ]),
    outputs: Object.freeze([
      "Real user-facing research, code, writing, experiment, figure, revision, or rebuttal artifacts produced from actual resources and existing assets",
      "Raw outputs, logs, failure samples, denominator accounting, and layered validation appropriate to the task, with no unnecessary fallback or hidden post-processing path",
      "An explicit account of unsupported claims, citation gaps, integrity concerns, uncertainty, resource limits, or material scope changes; host return and passing tests are not independent acceptance",
      "Durable results recorded through public Dove surfaces, without presenting the work as independent review"
    ])
  }),
  reviewer: Object.freeze({
    id: "reviewer",
    publicName: "Reviewer",
    title: "dove-reviewer",
    description: "Independently assess one frozen declared artifact scope and return structured findings without edits.",
    responsibility: "Review independently from Planner and Builder/Author, assessing only the frozen declared scope and concise rubric supplied in the launch prompt.",
    inputs: Object.freeze([
      "Only the declared project-relative artifact paths and their frozen fingerprints in the launch prompt",
      "The concise review rubric and structured output contract in that prompt"
    ]),
    outputs: Object.freeze([
      "One structured status and verdict with a concise summary",
      "Findings only, each with a stable finding label, severity, concise rationale, and one or more declared artifact paths",
      "Action items, explicit unknowns, and a Markdown report within the declared scope",
      "Execution, rewriting, rebuttal, and scheduling stay outside Reviewer responsibility; make no edits or Dove mutation, perform no self-fix or nested reviewer launch, and access no parent transcript, Trellis task material, ResearchHandoff, or undeclared files"
    ])
  })
});
function reviewerPrompt(scopeBinding2) {
  const declared = scopeBinding2.reviewedArtifacts.map((item) => `- ${item.path} (${item.sizeBytes} bytes; SHA-256 ${item.sha256})`).join("\n");
  return `You are the dedicated fresh Dove Reviewer.

Declared frozen content boundary:
${declared}

Read only those exact project-relative files. Their content must match the supplied fingerprints. Do not access the parent transcript, Trellis task or specs, ResearchHandoff, Dove state, directories, or any undeclared file. Do not edit, write, self-fix, rebut, invoke Dove, launch another reviewer, or delegate.

Rubric: assess correctness and internal coherence; evidence and claim scope; omissions and material risk; reproducibility; fairness or information leakage; and preservation of failures, denominators, and uncertainty. Do not claim authority, identity, sign-off, or acceptance.

Return exactly one JSON object with this shape, then a Markdown report:
{
  "status": "completed|blocked|failed",
  "verdict": "coherent|needs-revision|needs-evidence|blocked",
  "summary": "concise summary",
  "findings": [{"findingId":"safe-label","severity":"low|medium|high","summary":"concise finding","linkedArtifactPaths":["one-or-more-declared-paths"]}],
  "actionItems": ["action"],
  "report": "complete Markdown report",
  "provenance": {"hostKind":"${scopeBinding2.hostKind}","reviewedAt":"ISO-8601 UTC","provider":"optional","model":"optional"}
}
Completed status cannot use blocked verdict. Blocked or failed status must use blocked verdict. needs-revision and needs-evidence require at least one finding and action item.`;
}

// src/core/public-reports.mjs
var PUBLIC_REASON_MESSAGES = Object.freeze({
  "mission-dependency-incomplete": "A required earlier workstream is not complete.",
  "mission-stopped": "This mission was stopped and preserved as research history.",
  "mission-failed": "This mission failed and is preserved as research history.",
  "explicit-mission-required": "Choose the work item explicitly.",
  "execution-receipt-missing": "No current outcome evidence has been recorded.",
  "execution-receipts-stale-or-invalid": "Recorded outcome evidence is no longer current.",
  "host-outcome-stopped": "The work was stopped before completion.",
  "host-outcome-blocked": "The work is blocked and not complete.",
  "host-outcome-failed": "The work failed and is not complete.",
  "mission-artifact-coverage-missing": "Required outputs are not yet covered by current evidence.",
  "criteria-coverage-missing": "One or more stated completion criteria are not yet covered by current evidence.",
  "evidence-requirements-unmet": "One or more required evidence conditions are not yet satisfied.",
  "required-research-pending": "Required research work is still pending.",
  "required-research-blocked": "Required research work is blocked.",
  "research-decision-not-stop-satisfied": "The current research decision does not say that the objective is satisfied.",
  "research-action-still-authorized": "The current research decision still authorizes an action.",
  "research-evidence-decision-incomplete": "The current research evidence decision is incomplete.",
  "research-outcome-awaiting-reevaluation": "Recorded research execution facts await scientific reevaluation.",
  "research-user-decision-required": "The current scientific judgment requires a user decision before research can continue.",
  "advisory-research-blocked": "Advisory research work is blocked but does not prevent completion.",
  "workspace-not-initialized": "The project research direction has not been set; run /dove:workspace explicitly.",
  "review-evidence-unavailable": "Independent review evidence is unavailable.",
  "source-evidence-unavailable": "Eligible source evidence is unavailable."
});
var PUBLIC_MESSAGES = Object.freeze({
  manage_dove_workspace: "The project research direction was updated.",
  create_dove_mission: "The mission or research update is ready.",
  create_ambient_dove_mission: "Dove recorded the work entry; the requested work has not been completed yet.",
  query_dove_mission: "The work preview is ready.",
  ingest_execution_receipt: "The current outcome evidence was recorded.",
  close_host_outcome: "The work result and supporting evidence were recorded.",
  record_research_outcome: "The research result was recorded with Dove\u2019s next recommendation.",
  assess_mission_completion: "Completion was assessed.",
  query_sources: "The source query finished.",
  read_dove_lessons: "The Lessons document is ready.",
  update_dove_lessons: "The Lessons document was updated.",
  register_source: "The source candidate was recorded.",
  verify_source: "The source audit result was recorded.",
  upsert_claims: "The evidence-backed claims were recorded.",
  run_experience_workflow: "The experiment material was recorded.",
  record_draft_archive: "The project draft was archived.",
  record_figure_archive: "The project figure was archived.",
  scope_review_record: "The frozen review scope is ready for one dedicated Reviewer.",
  archive_review_record: "The non-authoritative review findings were archived.",
  record_rebuttal_archive: "The project rebuttal was archived."
});
var REPORT_SECTION_FIELDS = Object.freeze([
  "executiveSummary",
  "currentSituation",
  "progress",
  "findings",
  "risksAndBlockers",
  "workStatus",
  "evidenceStatus",
  "recommendation",
  "nextActions"
]);
var TECHNICAL_COLLECTION_LIMIT = 100;
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function deepFreezePublic(value, seen = /* @__PURE__ */ new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const item of Array.isArray(value) ? value : Object.values(value)) deepFreezePublic(item, seen);
  return Object.freeze(value);
}
function publicReferenceName(kind) {
  return {
    workspace: "workspace",
    mission: "work record",
    source: "source",
    claim: "claim",
    experiment: "experiment",
    figure: "figure",
    review: "review",
    lesson: "lesson",
    receipt: "outcome record",
    criterion: "completion condition",
    requirement: "requirement",
    audit: "audit",
    finding: "finding",
    result: "result",
    snapshot: "snapshot",
    node: "research item",
    "work item": "work item",
    "work-item": "work item"
  }[String(kind).toLowerCase()] ?? "record";
}
function safeText2(value) {
  if (typeof value !== "string") return value;
  return value.replace(/(?:^|[\s"'(])\.dove(?:-archive)?(?:[\\/][A-Za-z0-9._\\/-]+)?/gu, " an internal Dove artifact").replace(/(^|[\s"'(\[=])(\/(?:[A-Za-z0-9._@+-]+\/)*[A-Za-z0-9._@+-]+)(?=$|[\s"',;)\]])/gu, "$1a private path").replace(/\b[A-Za-z]:\\[^\s"']+/gu, "a private path").replace(/\b(https?:\/\/)[^\s/@:]+:[^\s/@]+@/giu, "$1[REDACTED]@").replace(/([?&](?:api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|token|client[_-]?secret|secret|password|passwd|key|auth(?:orization)?|code)=)[^&#\s]+/giu, "$1[REDACTED]").replace(/\b((?:authorization|proxy-authorization)\s*:\s*(?:bearer|basic)|(?:bearer|basic))\s+[A-Za-z0-9._~+/=-]+/giu, "$1 [REDACTED]").replace(/\b((?:api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|password|passwd)\s*[:=]\s*)[^\s,;]+/giu, "$1[REDACTED]").replace(/\b[0-9a-f]{64}\b/giu, "the validated fingerprint").replace(/\bexact[ -]?replay(?:\s+data)?\b/giu, "confirmation details").replace(/\bmissionNumber\b/gu, "work number").replace(/\bresearchItemNumber\b/gu, "research item number").replace(/\bdecisionRevision\b/gu, "current research decision").replace(/\b(?:proposal(?:Digest|Workspace|Version|Token)|confirmArgs|confirm|exactReplay|resultMode|mutationMode|MutationContext|confirmed|(?:workspace|mission|source|claim|experiment|figure|review|exchange|lesson|receipt|criterion|requirement|audit|finding|result|snapshot|node|workItem|action|decision|envelope)Ids?|contractDigest|sourceTreeDigest|archiveTarget|seal|ledgerSequence)\b/gu, "validated internal state").replace(/\b(?:source|note|claim|experiment-result|review|lesson|receipt):[a-z0-9._-]+\b/giu, "recorded evidence").replace(/\bUnknown (mission|source|note|claim|experiment|figure|review|exchange|version|lesson|receipt|criterion|requirement|provider|audit|finding|result|snapshot|node|work-item):\s*[a-z0-9._-]+\b/giu, (_match, kind) => `The requested ${publicReferenceName(kind)} was not found`).replace(/\b(Mission|Source|Note|Claim|Experiment|Figure|Review|Exchange|Version|Lesson|Receipt|Criterion|Requirement|Provider|Audit|Finding|Result|Snapshot|Node|Work item)\s+[a-z0-9._-]+(?=\s+(?:belongs|does|is|has|requires|cannot|contains|was)\b)/giu, (_match, kind) => `The requested ${publicReferenceName(kind)}`).replace(/(?<!-)\b(workspace|mission|source|note|claim|experiment|figure|review|exchange|version|lesson|receipt|criterion|requirement|provider|audit|finding|result|snapshot|node|work-item)-[a-z0-9._-]+\b/giu, (_match, kind) => `the referenced ${publicReferenceName(kind)}`);
}
function safeReason(value) {
  if (typeof value === "string" && PUBLIC_REASON_MESSAGES[value]) return PUBLIC_REASON_MESSAGES[value];
  const text11 = safeText2(value);
  return typeof text11 === "string" && /\b(?:schema|contract|receipt|digest|hash|fingerprint|binding|ledger|internal state)\b/iu.test(text11) ? "Recorded evidence is unavailable or no longer current." : text11;
}
function safeStrings(value, transform = safeText2) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").map(transform) : [];
}
function publicFactStatements(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [safeText2(item)];
    return isPlainObject(item) && typeof item.statement === "string" ? [safeText2(item.statement)] : [];
  });
}
var PUBLIC_RESEARCH_JUDGMENTS = Object.freeze({
  "continue-direction": "Continue the current research direction after reviewing the available evidence.",
  "awaiting-reevaluation": "Review the recorded execution facts and evidence before making the next scientific judgment.",
  "stop-low-return": "Pause further research because the recorded return is incomplete or too low to justify another action.",
  "stop-budget": "Stop further research because at least one declared budget limit is exhausted.",
  "block-needs-user": "Pause further research until the user resolves the recorded scope or execution issue.",
  "stop-satisfied": "Stop because the research objective is satisfied.",
  "reject-low-value": "Do not continue with the low-value direction.",
  "reject-policy": "Do not authorize the proposed direction because it does not satisfy the research policy."
});
var PUBLIC_RESEARCH_DEVIATIONS = Object.freeze({
  "performed-action-count-exceeded": "More than the single authorized action was reported.",
  "completed-action-count-mismatch": "The completed outcome did not report exactly one authorized action."
});
function publicResearchDeviation(value) {
  if (PUBLIC_RESEARCH_DEVIATIONS[value]) return PUBLIC_RESEARCH_DEVIATIONS[value];
  if (typeof value === "string" && value.startsWith("budget-exceeded:")) return "The reported execution exceeded a declared budget limit.";
  if (typeof value === "string" && value.startsWith("undeclared-budget-dimension:")) return "The reported execution included an undeclared budget dimension.";
  if (typeof value === "string" && value.startsWith("unexpected-evidence:")) return "The returned evidence did not match the requested research action.";
  return "The reported work did not match the requested research action.";
}
var PUBLIC_RESEARCH_JUDGMENTS_ZH = Object.freeze({
  [PUBLIC_RESEARCH_JUDGMENTS["continue-direction"]]: "Dove \u68C0\u67E5\u73B0\u884C\u8BC1\u636E\u540E\uFF0C\u5728\u5F53\u524D\u4EFB\u52A1\u7684\u56FA\u5B9A\u7814\u7A76\u65B9\u5411\u5185\u7EE7\u7EED\u3002",
  [PUBLIC_RESEARCH_JUDGMENTS["awaiting-reevaluation"]]: "\u5148\u68C0\u67E5\u5DF2\u8BB0\u5F55\u7684\u6267\u884C\u4E8B\u5B9E\u548C\u8BC1\u636E\uFF0C\u518D\u4F5C\u51FA\u4E0B\u4E00\u9879\u79D1\u5B66\u5224\u65AD\u3002",
  [PUBLIC_RESEARCH_JUDGMENTS["stop-low-return"]]: "\u6682\u505C\u8FDB\u4E00\u6B65\u7814\u7A76\uFF0C\u56E0\u4E3A\u672C\u6B21\u56DE\u62A5\u4E0D\u5B8C\u6574\u6216\u4E0D\u8DB3\u4EE5\u652F\u6301\u4E0B\u4E00\u6B21\u884C\u52A8\u3002",
  [PUBLIC_RESEARCH_JUDGMENTS["stop-budget"]]: "\u505C\u6B62\u8FDB\u4E00\u6B65\u7814\u7A76\uFF0C\u56E0\u4E3A\u81F3\u5C11\u4E00\u9879\u65E2\u5B9A\u9884\u7B97\u5DF2\u7ECF\u8017\u5C3D\u3002",
  [PUBLIC_RESEARCH_JUDGMENTS["block-needs-user"]]: "\u6682\u505C\u8FDB\u4E00\u6B65\u7814\u7A76\uFF0C\u7B49\u5F85\u7528\u6237\u5904\u7406\u5DF2\u8BB0\u5F55\u7684\u8303\u56F4\u6216\u6267\u884C\u95EE\u9898\u3002",
  [PUBLIC_RESEARCH_JUDGMENTS["stop-satisfied"]]: "\u7814\u7A76\u76EE\u6807\u5DF2\u7ECF\u6EE1\u8DB3\uFF0C\u53EF\u4EE5\u505C\u6B62\u3002",
  [PUBLIC_RESEARCH_JUDGMENTS["reject-low-value"]]: "\u4E0D\u8981\u7EE7\u7EED\u6295\u5165\u5F53\u524D\u4F4E\u4EF7\u503C\u65B9\u5411\u3002",
  [PUBLIC_RESEARCH_JUDGMENTS["reject-policy"]]: "\u4E0D\u8981\u6388\u6743\u5F53\u524D\u65B9\u5411\uFF0C\u56E0\u4E3A\u5B83\u672A\u6EE1\u8DB3\u79D1\u7814\u7B56\u7565\u8981\u6C42\u3002"
});
function publicResearchJudgment(value) {
  return PUBLIC_RESEARCH_JUDGMENTS[value] ?? "Dove must review the available evidence before deciding whether research should continue.";
}
function chineseResearchJudgment(value) {
  return PUBLIC_RESEARCH_JUDGMENTS_ZH[value] ?? "Dove \u9700\u8981\u5148\u68C0\u67E5\u73B0\u884C\u8BC1\u636E\uFF0C\u518D\u5224\u65AD\u662F\u5426\u7EE7\u7EED\u7814\u7A76\u3002";
}
function publicPath(value) {
  return typeof value === "string" && value.trim() && !/(?:^|\/)\.dove(?:-archive)?(?:\/|$)/u.test(value) ? safeText2(value) : null;
}
function publicArtifacts(items) {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const path26 = publicPath(typeof item === "string" ? item : item?.path ?? item?.reference);
    if (!path26) return [];
    const result = { path: path26 };
    if (isPlainObject(item)) {
      if (typeof item.kind === "string") result.kind = safeText2(item.kind);
      for (const field of ["current", "covered"]) if (typeof item[field] === "boolean") result[field] = item[field];
      if (typeof item.status === "string") result.status = safeText2(item.status);
      if (typeof item.reason === "string") result.reason = safeReason(item.reason);
    }
    return [result];
  });
}
function publicFieldValue(field, value) {
  if (["message", "error", "summary", "details", "title", "snippet", "sourceName", "displayName", "kind", "access", "status", "locator", "sourceType", "abstract", "lifecycle", "scope"].includes(field)) {
    return typeof value === "string" ? safeText2(value) : void 0;
  }
  if (["authors", "capabilities", "nextTimeGuidance", "tags"].includes(field)) return safeStrings(value);
  if (["year", "resultCount", "fetchedCount"].includes(field)) return Number.isFinite(value) ? value : void 0;
  if (field === "openAccess") return typeof value === "boolean" ? value : void 0;
  if (field === "url") return typeof value === "string" ? safeText2(value) : void 0;
  if (field === "publishedAt") return typeof value === "string" ? safeText2(value) : void 0;
  if (field === "eligibility" && isPlainObject(value)) return { eligible: value.eligible === true, reason: safeReason(value.reason) };
  return void 0;
}
function publicItems(items, fields) {
  if (!Array.isArray(items)) return [];
  return items.filter(isPlainObject).map((item) => Object.fromEntries(fields.flatMap((field) => {
    if (item[field] === void 0) return [];
    const value = publicFieldValue(field, item[field]);
    return value === void 0 ? [] : [[field, value]];
  })));
}
function publicOperationalIntegrity(value, fallback = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    hostActionReturned: source.hostActionReturned === true || fallback.hostActionReturned === true,
    receiptRecorded: source.receiptRecorded === true || fallback.receiptRecorded === true,
    completionEvidenceSatisfied: source.completionEvidenceSatisfied === true,
    lifecycleClosed: source.lifecycleClosed === true
  };
}
function publicCompletion(data) {
  if (!isPlainObject(data)) return null;
  return {
    status: typeof data.status === "string" ? safeText2(data.status) : void 0,
    complete: data.complete === true,
    gaps: safeStrings(data.incompleteReasons, safeReason),
    artifacts: publicArtifacts(data.artifactCoverage),
    criteria: Array.isArray(data.criterionCoverage) ? data.criterionCoverage.filter(isPlainObject).map((item) => ({ description: safeText2(item.criterion), covered: item.covered === true })) : [],
    requirements: Array.isArray(data.evidenceRequirements) ? data.evidenceRequirements.filter(isPlainObject).map((item) => ({ requirement: safeText2(item.requirement), satisfied: item.satisfied === true, reason: safeReason(item.reason) })) : [],
    hostReturn: isPlainObject(data.ordinaryHostReturn?.current) ? {
      status: safeText2(data.ordinaryHostReturn.current.status),
      kind: data.ordinaryHostReturn.current.mode === "observation-only" ? "observation" : "files",
      summary: safeText2(data.ordinaryHostReturn.current.summary),
      facts: publicFactStatements(data.ordinaryHostReturn.current.facts)
    } : null
  };
}
function publicInvocationClassification(invocation) {
  return {
    outcome: typeof invocation.kind === "string" ? safeText2(invocation.kind) : void 0,
    category: typeof invocation.category === "string" ? safeText2(invocation.category) : void 0,
    phase: typeof invocation.phase === "string" ? safeText2(invocation.phase) : void 0,
    blocking: invocation.blocking === true,
    userAction: typeof invocation.userAction === "string" ? safeText2(invocation.userAction) : void 0,
    terminal: invocation.terminal === true,
    continuation: typeof invocation.continuation === "string" ? safeText2(invocation.continuation) : void 0,
    closure: typeof invocation.closure === "string" ? safeText2(invocation.closure) : void 0,
    retry: typeof invocation.retry === "string" ? safeText2(invocation.retry) : void 0,
    ...typeof invocation.reason === "string" ? { reason: safeText2(invocation.reason) } : {}
  };
}
function graphCollection(graph, name) {
  const value = graph?.[name];
  return isPlainObject(value) ? value : { totalCount: 0, truncated: false, items: [] };
}
var PUBLIC_REASON_MESSAGES_ZH = Object.freeze({
  "A required earlier workstream is not complete.": "\u4E00\u9879\u524D\u7F6E\u5DE5\u4F5C\u5C1A\u672A\u5B8C\u6210\u3002",
  "This work has been replaced by a newer direction.": "\u8FD9\u9879\u5DE5\u4F5C\u5DF2\u88AB\u65B0\u7684\u65B9\u5411\u53D6\u4EE3\u3002",
  "Choose the work item explicitly.": "\u8BF7\u660E\u786E\u9009\u62E9\u8981\u5904\u7406\u7684\u5DE5\u4F5C\u9879\u3002",
  "No current outcome evidence has been recorded.": "\u5C1A\u672A\u8BB0\u5F55\u5F53\u524D\u6210\u679C\u7684\u6709\u6548\u8BC1\u636E\u3002",
  "Recorded outcome evidence is no longer current.": "\u5DF2\u6709\u6210\u679C\u8BC1\u636E\u5DF2\u4E0D\u518D\u53CD\u6620\u5F53\u524D\u72B6\u6001\u3002",
  "Required outputs are not yet covered by current evidence.": "\u5F53\u524D\u8BC1\u636E\u5C1A\u672A\u8986\u76D6\u6240\u6709\u5FC5\u9700\u4EA7\u51FA\u3002",
  "One or more stated completion criteria are not yet covered by current evidence.": "\u4E00\u9879\u6216\u591A\u9879\u65E2\u5B9A\u5B8C\u6210\u6807\u51C6\u5C1A\u672A\u5F97\u5230\u5F53\u524D\u8BC1\u636E\u652F\u6301\u3002",
  "One or more required evidence conditions are not yet satisfied.": "\u4E00\u9879\u6216\u591A\u9879\u5FC5\u9700\u8BC1\u636E\u6761\u4EF6\u5C1A\u672A\u6EE1\u8DB3\u3002",
  "Required research work is still pending.": "\u4E00\u9879\u5FC5\u9700\u7684\u7814\u7A76\u5DE5\u4F5C\u4ECD\u5728\u7B49\u5F85\u5B8C\u6210\u3002",
  "Required research work is blocked.": "\u4E00\u9879\u5FC5\u9700\u7684\u7814\u7A76\u5DE5\u4F5C\u53D7\u5230\u963B\u585E\u3002",
  "The current research decision does not say that the objective is satisfied.": "\u5F53\u524D\u7814\u7A76\u5224\u65AD\u5C1A\u672A\u660E\u786E\u8BA4\u5B9A\u7814\u7A76\u76EE\u6807\u5DF2\u7ECF\u6EE1\u8DB3\u3002",
  "The current research decision still authorizes an action.": "\u5F53\u524D\u7814\u7A76\u5224\u65AD\u4ECD\u6388\u6743\u4E00\u9879\u884C\u52A8\u3002",
  "The current research evidence decision is incomplete.": "\u5F53\u524D\u7814\u7A76\u8BC1\u636E\u5224\u65AD\u5C1A\u672A\u5B8C\u6210\u3002",
  "Recorded research execution facts await scientific reevaluation.": "\u5DF2\u8BB0\u5F55\u7684\u7814\u7A76\u6267\u884C\u4E8B\u5B9E\u7B49\u5F85\u79D1\u5B66\u91CD\u65B0\u8BC4\u4F30\u3002",
  "The current scientific judgment requires a user decision before research can continue.": "\u5F53\u524D\u79D1\u5B66\u5224\u65AD\u9700\u8981\u7528\u6237\u4F5C\u51FA\u51B3\u5B9A\u540E\u624D\u80FD\u7EE7\u7EED\u7814\u7A76\u3002",
  "Advisory research work is blocked but does not prevent completion.": "\u4E00\u9879\u8F85\u52A9\u7814\u7A76\u5DE5\u4F5C\u53D7\u5230\u963B\u585E\uFF0C\u4F46\u4E0D\u4F1A\u963B\u6B62\u6574\u4F53\u5B8C\u6210\u3002",
  "Dove is not initialized in this workspace.": "\u5F53\u524D\u5DE5\u4F5C\u533A\u5C1A\u672A\u521D\u59CB\u5316 Dove\u3002",
  "Independent review evidence is unavailable.": "\u5C1A\u7F3A\u5C11\u53EF\u7528\u7684\u72EC\u7ACB\u590D\u6838\u8BC1\u636E\u3002",
  "Eligible source evidence is unavailable.": "\u5C1A\u7F3A\u5C11\u53EF\u7528\u4E14\u5408\u683C\u7684\u6765\u6E90\u8BC1\u636E\u3002",
  "Recorded evidence is unavailable or no longer current.": "\u5DF2\u6709\u8BC1\u636E\u4E0D\u53EF\u7528\uFF0C\u6216\u5DF2\u4E0D\u518D\u53CD\u6620\u5F53\u524D\u72B6\u6001\u3002"
});
function chineseReason(value, category = null) {
  const safe = safeReason(value);
  if (typeof safe !== "string" || !safe.trim()) return "\u6709\u4E00\u9879\u5B8C\u6210\u6761\u4EF6\u9700\u8981\u5904\u7406\u3002";
  if (new RegExp("\\p{Script=Han}", "u").test(safe)) return safe;
  if (/^Work \d/u.test(safe)) return safe.replace(/^Work /u, "\u5DE5\u4F5C ").replace(/ do not yet have their declared outputs\./u, " \u5C1A\u672A\u5F62\u6210\u58F0\u660E\u6210\u679C\u3002").replace(/ have output files, but completion evidence is still incomplete\./u, " \u5DF2\u6709\u6210\u679C\u6587\u4EF6\uFF0C\u4F46\u5B8C\u6210\u8BC1\u636E\u4ECD\u4E0D\u5B8C\u6574\u3002");
  if (PUBLIC_REASON_MESSAGES_ZH[safe]) return PUBLIC_REASON_MESSAGES_ZH[safe];
  return {
    review: "\u72EC\u7ACB\u590D\u6838\u5C1A\u672A\u6EE1\u8DB3\u5F53\u524D\u6210\u679C\u7684\u786E\u8BA4\u8981\u6C42\u3002",
    source: "\u5F53\u524D\u7ED3\u8BBA\u4ECD\u7F3A\u5C11\u5408\u683C\u7684\u6765\u6E90\u652F\u6301\u3002",
    work: "\u4E00\u9879\u5FC5\u9700\u5DE5\u4F5C\u5C1A\u672A\u5B8C\u6210\u6216\u53D7\u5230\u963B\u585E\u3002",
    evidence: "\u5F53\u524D\u8BC1\u636E\u5C1A\u4E0D\u8DB3\u4EE5\u786E\u8BA4\u6210\u679C\u6EE1\u8DB3\u65E2\u5B9A\u8981\u6C42\u3002",
    direction: "\u5F53\u524D\u5DE5\u4F5C\u65B9\u5411\u5DF2\u88AB\u66F4\u65B0\uFF0C\u9700\u8981\u8F6C\u5411\u65B0\u7684\u6709\u6548\u65B9\u5411\u3002",
    integrity: "\u4E00\u9879\u5FC5\u8981\u7684\u5B8C\u6210\u6761\u4EF6\u76EE\u524D\u7F3A\u5C11\u6709\u6548\u652F\u6301\u3002"
  }[category ?? attentionCategory(safe)] ?? "\u6709\u4E00\u9879\u5B8C\u6210\u6761\u4EF6\u9700\u8981\u5904\u7406\u3002";
}
function attentionCategory(reason) {
  const normalized3 = String(reason ?? "").toLowerCase();
  if (normalized3.includes("review") || normalized3.includes("issuer")) return "review";
  if (normalized3.includes("source")) return "source";
  if (normalized3.includes("research") || normalized3.includes("blocked")) return "work";
  if (normalized3.includes("artifact") || normalized3.includes("receipt") || normalized3.includes("evidence")) return "evidence";
  if (normalized3.includes("supersed")) return "direction";
  return "integrity";
}
function publicTechnicalAppendix(data) {
  const graph = data?.durableStatus?.workspaceGraph;
  if (!isPlainObject(graph) || graph.bounded !== true) return null;
  const collection = (name, project) => {
    const source = graphCollection(graph, name);
    const sourceItems = Array.isArray(source.items) ? source.items.filter(isPlainObject) : [];
    const items = sourceItems.slice(0, TECHNICAL_COLLECTION_LIMIT).map(project);
    return {
      totalCount: Number(source.totalCount) || sourceItems.length,
      truncated: source.truncated === true || sourceItems.length > TECHNICAL_COLLECTION_LIMIT,
      items
    };
  };
  const missionNumbers = new Map(graphCollection(graph, "missions").items.filter(isPlainObject).map((item, index) => [item.displayIndex, Number.isSafeInteger(item.displayIndex) ? item.displayIndex + 1 : index + 1]));
  const requirementNumbers = new Map(graphCollection(graph, "requirements").items.filter(isPlainObject).map((item, index) => [item.displayIndex, index + 1]));
  const workItemNumbers = new Map(graphCollection(graph, "workItems").items.filter(isPlainObject).map((item, index) => [item.displayIndex, index + 1]));
  const visibleNumber = (mapping, value) => Number.isSafeInteger(value) ? mapping.get(value) ?? null : null;
  const visibleNumbers = (mapping, values) => Array.isArray(values) ? values.map((value) => visibleNumber(mapping, value)).filter(Number.isSafeInteger) : [];
  return {
    bounded: true,
    workstreams: collection("missions", (item, index) => ({
      number: Number.isSafeInteger(item.displayIndex) ? item.displayIndex + 1 : index + 1,
      mode: item.mode === "research" ? "research" : "ordinary",
      goal: safeText2(item.goal),
      state: safeText2(item.status),
      complete: item.complete === true,
      dependencyNumbers: visibleNumbers(missionNumbers, item.dependencyDisplayIndices),
      requirementNumbers: visibleNumbers(requirementNumbers, item.requirementDisplayIndices),
      gaps: safeStrings(item.gapCodes, safeReason)
    })),
    requirements: collection("requirements", (item, index) => ({
      number: index + 1,
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      kind: safeText2(item.kind),
      description: safeText2(item.description)
    })),
    workItems: collection("workItems", (item, index) => ({
      number: index + 1,
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      label: safeText2(item.label),
      kind: safeText2(item.kind),
      state: safeText2(item.status),
      dependencyNumbers: visibleNumbers(workItemNumbers, item.dependencyDisplayIndices)
    })),
    researchItems: collection("researchItems", (item) => ({
      number: item.missionResearchDisplayIndex + 1,
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      question: safeText2(item.questionOrHypothesis),
      work: safeText2(item.workDescription),
      stopCondition: safeText2(item.successOrStopCriterion),
      state: safeText2(item.status),
      outcome: safeText2(item.outcomeSummary),
      blockedReason: safeReason(item.blockedReasonCode)
    })),
    outcomes: collection("receipts", (item, index) => ({
      number: index + 1,
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      summary: item.interpretationStatus === "interpreted" ? "Research execution facts were recorded and interpreted by a later scientific judgment." : safeText2(item.summary),
      interpretation: item.interpretationStatus === "interpreted" ? "interpreted" : item.interpretationStatus === "awaiting-reevaluation" ? "awaiting scientific judgment" : null,
      outputCount: Number(item.artifactCount) || 0,
      checkCount: Number(item.validationCount) || 0,
      returnStatus: typeof item.outcomeStatus === "string" ? safeText2(item.outcomeStatus) : null,
      returnMode: item.outcomeMode === "observation-only" ? "observation" : item.outcomeMode === "artifact-backed" ? "files" : null,
      factCount: Number(item.factCount) || 0
    })),
    outputs: collection("artifacts", (item, index) => ({
      number: index + 1,
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      kind: safeText2(item.kind),
      current: true
    })),
    checks: collection("validations", (item, index) => ({
      number: index + 1,
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      kind: safeText2(item.kind),
      current: true
    })),
    gaps: collection("gaps", (item, index) => ({
      number: index + 1,
      category: item.kind === "research-blocker" ? "work blocker" : "completion",
      description: safeReason(item.code),
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      workItemNumber: visibleNumber(workItemNumbers, item.workItemDisplayIndex),
      impact: safeText2(item.completionImpact)
    }))
  };
}
function publicStatusBriefing(data, options = {}) {
  const source = isPlainObject(data.publicStatus) ? data.publicStatus : buildPublicStatusProjection(data);
  const narrativeKind = source.narrativeKind === "project" || source.narrativeKind === "mission" ? source.narrativeKind : null;
  const researchNarrative = source.narrativeState === "available" && isPlainObject(source.researchNarrative) ? narrativeKind === "project" ? normalizeProjectResearchNarrative(source.researchNarrative) : normalizeResearchNarrative(source.researchNarrative) : null;
  const report = {
    status: typeof source.status === "string" ? safeText2(source.status) : "ok",
    detailsAvailable: source.detailsAvailable === true,
    message: safeText2(source.message),
    executiveSummary: safeText2(source.executiveSummary),
    currentSituation: {
      scope: safeText2(source.currentSituation?.scope),
      trackedWorkstreams: Number(source.currentSituation?.trackedWorkstreams) || 0,
      summary: safeText2(source.currentSituation?.summary),
      attentionRequired: source.currentSituation?.attentionRequired === true
    },
    progress: {
      state: safeText2(source.progress?.state),
      completedItems: Number(source.progress?.completedItems) || 0,
      inProgressItems: Number(source.progress?.inProgressItems) || 0,
      blockedItems: Number(source.progress?.blockedItems) || 0,
      totalItems: Number(source.progress?.totalItems) || 0,
      summary: safeText2(source.progress?.summary)
    },
    findings: safeStrings(source.findings),
    risksAndBlockers: Array.isArray(source.risksAndBlockers) ? source.risksAndBlockers.filter(isPlainObject).map((risk) => ({
      whatHappened: safeReason(risk.whatHappened),
      whyItMatters: safeText2(risk.whyItMatters),
      impact: safeText2(risk.impact),
      evidenceStrength: safeText2(risk.evidenceStrength)
    })) : [],
    workStatus: {
      state: safeText2(source.workStatus?.state),
      summary: safeText2(source.workStatus?.summary),
      currentOutputCount: Number(source.workStatus?.currentOutputCount) || 0,
      currentOutputs: safeStrings(source.workStatus?.currentOutputs).map(publicPath).filter(Boolean),
      returnStatus: typeof source.workStatus?.returnStatus === "string" ? safeText2(source.workStatus.returnStatus) : null,
      observationOnly: source.workStatus?.observationOnly === true
    },
    evidenceStatus: {
      state: safeText2(source.evidenceStatus?.state),
      summary: safeText2(source.evidenceStatus?.summary),
      currentEvidenceCount: Number(source.evidenceStatus?.currentEvidenceCount) || 0,
      sourceCount: Number(source.evidenceStatus?.sourceCount) || 0,
      review: {
        required: false,
        authority: "not-established",
        currentCount: Number(source.evidenceStatus?.review?.currentCount) || 0,
        staleCount: Number(source.evidenceStatus?.review?.staleCount) || 0,
        status: safeText2(source.evidenceStatus?.review?.status)
      }
    },
    operationalIntegrity: publicOperationalIntegrity(source.operationalIntegrity),
    researchNarrative,
    narrativeState: source.narrativeState === "available" ? "available" : "unavailable",
    recommendation: safeText2(source.recommendation),
    nextActions: Array.isArray(source.nextActions) ? source.nextActions.filter(isPlainObject).map((item) => ({ action: safeText2(item.action) })) : []
  };
  if (options.includeTechnicalAppendix === true) {
    const technicalAppendix = publicTechnicalAppendix(data);
    if (technicalAppendix) report.technicalAppendix = technicalAppendix;
  }
  return report;
}
function safeMessage(name, data) {
  if (name === "query_dove_status") return publicStatusBriefing(data).executiveSummary;
  return typeof data?.summary === "string" ? safeText2(data.summary) : PUBLIC_MESSAGES[name];
}
function copyPublicTopLevel(result, data) {
  for (const field of ["status", "operation", "policy", "inputBoundary"]) {
    if (typeof data[field] === "string") result[field] = safeText2(data[field]);
  }
  for (const field of ["detailsAvailable", "zeroWrite", "complete"]) {
    if (typeof data[field] === "boolean") result[field] = data[field];
  }
}
function assertHumanReportPrivacy(report) {
  const visit = (value, location = "report") => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${location}[${index}]`));
      return;
    }
    if (isPlainObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        if (/^(?:disposition|execution|outcomeClosure|continuation|closure|retry|terminal|researchHandoff|hostControl|closureRequest|tool|exactlyOnce|boundArgs|requiredOutcomeFields|defaults|missionNumber|researchItemNumber|decisionRevision|lessonsBinding|currentHash|binding)$/u.test(key)) {
          throw new Error(`Human report must not contain control field ${location}.${key}.`);
        }
        visit(item, `${location}.${key}`);
      }
      return;
    }
    if (typeof value === "string" && /\b(?:resume[-_ ]?original|host[-_ ]?outcome|research[-_ ]?outcome|host[-_ ]?control|closureRequest|boundArgs|requiredOutcomeFields|exactly[-_ ]?once)\b/iu.test(value)) {
      throw new Error(`Human report must not contain control vocabulary at ${location}.`);
    }
  };
  visit(report);
  return report;
}
function projectPublicReport(name, data, options = {}) {
  if (!isPlainObject(data)) return data;
  const publicOptions = isPlainObject(options) ? options : {};
  if (name === "query_dove_status") return publicStatusBriefing(data, publicOptions);
  const result = {};
  copyPublicTopLevel(result, data);
  result.facts = [];
  result.inferences = [];
  result.recommendations = [];
  result.unknowns = [];
  result.findings = [];
  const currentMainline = name === "manage_dove_workspace" && typeof data?.workspaceRevision?.mainline === "string" ? safeText2(data.workspaceRevision.mainline) : null;
  const message = currentMainline ?? safeMessage(name, data);
  if (message) result.message = message;
  if (currentMainline) {
    if (typeof data.projectBrief === "string" && data.projectBrief.trim()) result.projectBrief = safeText2(data.projectBrief);
    result.mainline = currentMainline;
  }
  if (isPlainObject(data.approval)) result.approval = {
    required: data.approval.required === true,
    noChangesApplied: data.approval.noChangesApplied === true,
    summary: safeText2(data.approval.summary),
    effects: safeStrings(data.approval.effects),
    question: safeText2(data.approval.question)
  };
  if (name === "query_dove_mission" && isPlainObject(data.mission)) result.mission = {
    mode: data.mission.mode === "research" ? "research" : "ordinary",
    goal: safeText2(data.mission.goal),
    requirements: safeStrings(data.mission.requirements),
    assumptions: safeStrings(data.mission.assumptions),
    scope: safeStrings(data.mission.scope),
    outOfScope: safeStrings(data.mission.outOfScope),
    artifacts: publicArtifacts(data.mission.artifacts),
    completionCriteria: Array.isArray(data.mission.completionCriteria) ? data.mission.completionCriteria.map((item) => safeText2(typeof item === "string" ? item : item?.criterion)).filter(Boolean) : [],
    evidenceRequirements: Array.isArray(data.mission.evidenceRequirements) ? data.mission.evidenceRequirements.map((item) => safeReason(typeof item === "string" ? item : item?.requirement)).filter(Boolean) : []
  };
  if (name === "query_sources") {
    result.sources = publicItems(data.items, ["title", "authors", "year", "locator", "sourceType", "abstract", "lifecycle", "useLimitation", "eligibility"]);
    result.facts = result.sources.map((source) => `Source ${source.title ?? source.locator ?? "candidate"}: ${source.lifecycle === "candidate" && source.eligibility?.eligible === true ? "current captured material" : `not usable (${source.eligibility?.reason ?? source.lifecycle ?? "unknown"})`}.`);
    result.inferences = result.sources.filter((source) => source.eligibility?.eligible === true).map(() => "The current captured material may support a bounded claim only with the explicit not-independently-verified limitation.");
    result.recommendations = result.sources.filter((source) => source.eligibility?.eligible !== true).map(() => "Do not use rejected, missing, or drifted captured material as evidence.");
  }
  if (["read_dove_lessons", "update_dove_lessons"].includes(name) && typeof data.markdown === "string") result.markdown = safeText2(data.markdown);
  const completionSource = name === "assess_mission_completion" ? data : data.completion?.assessment;
  const completion = publicCompletion(completionSource);
  if (completion) result.completion = completion;
  else if (data.completion?.assessmentUnavailable === true) result.completion = { status: "unavailable", complete: false, message: "The outcome evidence was recorded, but completion could not be assessed." };
  if (completionSource) {
    result.operationalIntegrity = publicOperationalIntegrity(completionSource.operationalIntegrity, {
      hostActionReturned: name === "close_host_outcome",
      receiptRecorded: isPlainObject(data.receipt)
    });
  } else if (data.completion?.assessmentUnavailable === true) {
    result.operationalIntegrity = publicOperationalIntegrity(null, {
      hostActionReturned: name === "close_host_outcome",
      receiptRecorded: isPlainObject(data.receipt)
    });
  }
  if (data.status === "partial-commit-failure" && isPlainObject(data.partialCommit)) {
    result.partialCommit = {
      committed: data.partialCommit.receiptRecorded === true,
      reassessmentRequired: data.partialCommit.completionAssessmentFailed === true,
      repeatClosureAllowed: data.partialCommit.repeatClosureAllowed === true,
      zeroWriteRetryAllowed: data.partialCommit.zeroWriteRetryAllowed === true,
      nextAction: "Reassess completion using the read-only completion check."
    };
  }
  if (isPlainObject(data.diff)) result.changes = {
    addedCount: data.diff.addedNodes?.length ?? 0,
    completedCount: data.diff.completedNodes?.length ?? 0,
    blockedCount: data.diff.blockedNodes?.length ?? 0,
    unchangedCount: data.diff.unchangedNodes?.length ?? 0
  };
  if (["ingest_execution_receipt", "close_host_outcome", "record_research_outcome"].includes(name) && isPlainObject(data.receipt)) {
    result.artifacts = publicArtifacts(data.receipt.artifacts);
    result.verification = publicArtifacts(data.receipt.validations);
    if (name === "close_host_outcome" && isPlainObject(data.receipt.ordinaryHostOutcome)) {
      result.outcome = {
        status: safeText2(data.receipt.ordinaryHostOutcome.status),
        kind: data.receipt.ordinaryHostOutcome.mode === "observation-only" ? "observation" : "files",
        summary: safeText2(data.receipt.summary),
        facts: publicFactStatements(data.receipt.ordinaryHostOutcome.facts)
      };
    }
  } else if (Array.isArray(data.artifacts)) {
    const artifacts = publicArtifacts(data.artifacts);
    if (artifacts.length) result.artifacts = artifacts;
  }
  if (name === "close_host_outcome" && isPlainObject(data.researchNarrative)) {
    result.researchNarrative = normalizeResearchNarrative(data.researchNarrative);
  }
  if (name === "create_dove_mission" && data.operation === "reevaluate-research-decision") {
    result.research = {
      nextJudgment: publicResearchJudgment(data.researchDisposition),
      evidenceCount: Number(data.evidenceCount) || 0,
      awaitingExecution: isPlainObject(data.executionHandoff),
      reasonCodes: safeStrings(data.decision?.reasonCodes)
    };
    if (isPlainObject(data.researchNarrative)) result.researchNarrative = normalizeResearchNarrative(data.researchNarrative);
  }
  if (name === "record_research_outcome") {
    result.outcome = {
      accepted: data.accepted === true,
      status: safeText2(data.outcomeStatus),
      evidenceComplete: data.evidenceComplete === true,
      missingEvidence: safeStrings(data.missingRequiredEvidence),
      scopeDeviation: data.scopeDeviation === true,
      deviationReasons: safeStrings(data.scopeDeviationReasons, publicResearchDeviation),
      performedActionCount: Number.isSafeInteger(data.performedActionCount) ? data.performedActionCount : 0
    };
    result.research = {
      nextJudgment: publicResearchJudgment(data.awaitingReevaluation ? "awaiting-reevaluation" : data.decision?.disposition),
      awaitingReevaluation: data.awaitingReevaluation === true,
      receiptRecorded: isPlainObject(data.receipt),
      decisionUnchanged: true
    };
  }
  if (name === "run_experience_workflow") {
    result.outcome = data.result ? { summary: safeText2(data.result.outcome), status: safeText2(data.result.status), denominator: data.result.denominator } : { summary: "The formal Experiment protocol is frozen; no result has been recorded." };
    result.facts.push(data.result ? "The immutable result preserves measurements, the full denominator, failures, deviations, limitations, and current evidence references." : "The formal protocol was frozen before result recording.");
    if (data.result) {
      result.verification = { status: safeText2(data.result.status), humanReviewAuthority: false };
      result.unknowns.push(...safeStrings(data.result.limitations));
    } else result.recommendations.push("Run the frozen protocol, preserve raw artifacts and every failure, then record the result.");
  }
  if (["record_draft_archive", "record_figure_archive", "record_rebuttal_archive"].includes(name)) {
    result.artifacts = publicArtifacts([data.artifact]);
    result.facts.push("The substantive artifact remains in the project; Dove recorded only its current Receipt-backed archive reference.");
    result.findings.push(...safeStrings(data.findings));
    result.unknowns.push(...safeStrings(data.qa));
    if (name === "record_figure_archive") result.outcome = { caption: safeText2(data.caption) };
  }
  if (name === "scope_review_record") {
    result.artifacts = publicArtifacts(data.reviewedArtifactPaths);
    result.facts.push("The declared artifacts were frozen without changing project state.");
    result.inferences.push("One dedicated fresh read-only Reviewer must assess only this declared scope.");
  }
  if (name === "archive_review_record" && isPlainObject(data.review)) {
    result.review = {
      status: safeText2(data.review.status),
      verdict: safeText2(data.review.verdict),
      summary: safeText2(data.review.summary),
      artifacts: publicArtifacts(data.review.reviewedArtifacts?.map((item) => item.path)),
      findings: Array.isArray(data.review.findings) ? data.review.findings.filter(isPlainObject).map((item) => ({ severity: safeText2(item.severity), summary: safeText2(item.summary), artifacts: publicArtifacts(item.linkedArtifactPaths) })) : [],
      actionItems: safeStrings(data.review.actionItems),
      authority: "not-established"
    };
    result.facts.push("The returned findings and Markdown report were archived against the exact frozen artifact fingerprints.");
    result.inferences.push("The archive records Reviewer observations but does not establish identity, authority, sign-off, acceptance, or scientific endorsement.");
  }
  if (name === "record_rebuttal_archive") {
    result.facts.push("This is an author-side artifact archive; referenced findings remain preserved and reviewerSignoff is false.");
    result.inferences.push("The rebuttal and revisions are author-side work, not Reviewer acceptance.");
    result.unknowns.push("Reviewer agreement remains unknown until a separate Review establishes it.");
  }
  if (isPlainObject(data.authority)) result.authority = { authoritative: data.authority.authoritative === true, reason: safeReason(data.authority.reason) };
  return result;
}
function publicResearchHandoff(data) {
  if (!isPlainObject(data?.executionHandoff)) return null;
  const action = data.currentResearchDecision?.nextAction ?? data.decision?.nextAction ?? null;
  return Object.freeze({
    ...isPlainObject(action) ? {
      action: safeText2(action.description),
      actionKind: safeText2(action.kind),
      rationale: safeText2(action.rationale),
      successConditions: Object.freeze(safeStrings(action.successConditions)),
      stopConditions: Object.freeze(safeStrings(action.stopConditions))
    } : {},
    expectedEvidence: Object.freeze(safeStrings(data.executionHandoff.expectedEvidence)),
    budget: isPlainObject(data.executionHandoff.budget) ? Object.freeze({ ...data.executionHandoff.budget }) : null
  });
}
function publicPresentation(name, invocation, data, options = {}) {
  let policy = "show";
  try {
    policy = operationPresentation(options.operation ?? operationForTool(name), data);
  } catch {
    policy = "show";
  }
  const materialResearchChange = Array.isArray(data?.userDecisionReasons) && data.userDecisionReasons.length > 0;
  const visible = policy === "show" || invocation.kind === "failed" || invocation.blocking === true || materialResearchChange;
  return Object.freeze({
    mode: visible ? "show" : "silent",
    reason: materialResearchChange ? "material-research-change" : invocation.kind === "failed" ? "failure" : invocation.blocking === true ? "blocked" : policy === "silent-on-success" ? "ambient-create-succeeded" : "operation-result"
  });
}
function valueAtPath(value, path26) {
  return path26.split(".").reduce((current, field) => isPlainObject(current) ? current[field] : void 0, value);
}
function publicOutcomeContract(callback, data) {
  if (callback.outcomeContract?.kind !== "research-execution") return null;
  const evidenceReturned = valueAtPath(data, callback.outcomeContract.evidenceReturnPath);
  const actualUsageLimits = valueAtPath(data, callback.outcomeContract.budgetPath);
  const startedAtNotBefore = valueAtPath(data, callback.outcomeContract.issuedAtPath);
  const finishedAtBefore = valueAtPath(data, callback.outcomeContract.expiresAtPath);
  if (!Array.isArray(evidenceReturned) || evidenceReturned.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("Research outcome callback projection requires exact returned-evidence labels.");
  }
  if (!isPlainObject(actualUsageLimits) || ["actions", "timeMinutes", "costUnits"].some((field) => !Number.isSafeInteger(actualUsageLimits[field]) || actualUsageLimits[field] < 0)) {
    throw new Error("Research outcome callback projection requires non-negative integer authorized usage limits.");
  }
  if (typeof startedAtNotBefore !== "string" || typeof finishedAtBefore !== "string") {
    throw new Error("Research outcome callback projection requires its execution time window.");
  }
  return Object.freeze({
    evidenceReturned: Object.freeze({
      allowedValues: Object.freeze([...evidenceReturned]),
      exactLabelsOnly: true,
      allExpectedForEvidenceComplete: true
    }),
    actualUsageLimits: Object.freeze({
      actions: actualUsageLimits.actions,
      timeMinutes: actualUsageLimits.timeMinutes,
      costUnits: actualUsageLimits.costUnits,
      fieldTypes: Object.freeze({ actions: "integer", timeMinutes: "integer", costUnits: "integer" }),
      positiveFractions: "round-up-before-reporting",
      serverCoercion: false
    }),
    timestampWindow: Object.freeze({
      startedAtNotBefore,
      finishedAtBefore,
      acceptedUtcFormats: Object.freeze(["YYYY-MM-DDTHH:mm:ssZ", "YYYY-MM-DDTHH:mm:ss.sssZ"]),
      canonicalFormat: "YYYY-MM-DDTHH:mm:ss.sssZ"
    }),
    facts: Object.freeze({
      itemType: "string",
      executionObservationsOnly: true,
      scientificJudgmentAllowed: false
    }),
    artifactPaths: Object.freeze({ projectRelativeExistingFiles: true }),
    validationPaths: Object.freeze({ projectRelativeExistingSeparateFiles: true })
  });
}
function publicOutcomeCallback(name, invocation, data, options = {}) {
  let operation = options.operation;
  if (!operation) {
    try {
      operation = operationForTool(name);
    } catch {
      return null;
    }
  }
  const callback = operationCallback(operation, data);
  if (!callback || invocation.kind === "failed" || invocation.blocking === true) return null;
  const root = options.callbackRoot;
  const resolvers = isPlainObject(options.callbackResolvers) ? options.callbackResolvers : {};
  const resolveMissionNumber2 = typeof resolvers.missionNumber === "function" ? resolvers.missionNumber : (missionId3) => {
    if (typeof root !== "string" || !root) throw new Error(`${name} outcome callback projection requires a workspace root.`);
    return publicMissionNumberForId(root, missionId3, { operation: `${name} outcome callback mission binding` });
  };
  const missionId2 = valueAtPath(data, callback.missionIdPath);
  if (typeof missionId2 !== "string" || !missionId2) throw new Error(`${name} outcome callback projection requires its durable mission binding.`);
  const missionNumber = resolveMissionNumber2(missionId2);
  if (!Number.isSafeInteger(missionNumber) || missionNumber < 1) throw new Error(`${name} outcome callback projection requires a one-based public mission number.`);
  const boundArgs = { missionNumber };
  if (callback.decisionRevisionPath) {
    const decisionRevision = valueAtPath(data, callback.decisionRevisionPath);
    if (!Number.isSafeInteger(decisionRevision) || decisionRevision < 1) throw new Error(`${name} outcome callback projection requires a positive decision revision.`);
    boundArgs.decisionRevision = decisionRevision;
  }
  return Object.freeze({
    tool: callback.tool,
    mode: callback.mode,
    exactlyOnce: true,
    boundArgs: Object.freeze(boundArgs),
    requiredOutcomeFields: Object.freeze([...callback.requiredOutcomeFields]),
    defaults: deepFreezePublic(structuredClone(callback.defaults)),
    ...callback.outcomeContract ? { outcomeContract: publicOutcomeContract(callback, data) } : {}
  });
}
function publicLessonsDocumentControl(name, data) {
  if (name !== "read_dove_lessons" || typeof data?.lessonsBinding !== "string" || typeof data?.currentHash !== "string") return null;
  return Object.freeze({
    binding: data.lessonsBinding,
    currentHash: data.currentHash
  });
}
function reviewMissionControl(name, data) {
  if (name !== "create_dove_mission" || data?.operation !== "start-skill" || data?.skill !== "review" || typeof data?.reviewMissionBinding !== "string") return null;
  return Object.freeze({ binding: data.reviewMissionBinding });
}
function reviewLaunchControl(name, data) {
  if (name !== "scope_review_record" || !isPlainObject(data?.scopeBinding) || !isPlainObject(data?.reviewerLaunch)) return null;
  return Object.freeze({
    ...data.reviewerLaunch,
    prompt: reviewerPrompt(data.scopeBinding),
    scopeBinding: deepFreezePublic(structuredClone(data.scopeBinding))
  });
}
function publicHostControl(name, invocation, data, options = {}) {
  const classification = publicInvocationClassification(invocation);
  const lessonsDocument = publicLessonsDocumentControl(name, data);
  const reviewMission = reviewMissionControl(name, data);
  const reviewerLaunch = reviewLaunchControl(name, data);
  return Object.freeze({
    classification: Object.freeze(classification),
    presentation: publicPresentation(name, invocation, data, options),
    closureRequest: publicOutcomeCallback(name, invocation, data, options),
    ...lessonsDocument ? { lessonsDocument } : {},
    ...reviewMission ? { reviewMission } : {},
    ...reviewerLaunch ? { reviewerLaunch } : {}
  });
}
function publicResult(name, data, invocation, options = {}) {
  if (!isPlainObject(invocation)) throw new Error("Public result requires an invocation classification.");
  const report = assertHumanReportPrivacy(projectPublicReport(name, data, options));
  const researchHandoff = data?.executionHandoff && (name === "create_ambient_dove_mission" || name === "create_dove_mission") ? publicResearchHandoff(data) : null;
  const selector = options.selector;
  if (selector !== void 0 && (!isPlainObject(selector) || Object.keys(selector).length !== 1 || !Number.isSafeInteger(selector.missionNumber) || selector.missionNumber < 1)) {
    throw new Error("Public result selector requires exactly one positive missionNumber.");
  }
  return deepFreezePublic({
    report,
    ...selector ? { selector: { missionNumber: selector.missionNumber } } : {},
    ...researchHandoff ? { researchHandoff } : {},
    hostControl: publicHostControl(name, invocation, data, options)
  });
}
function publicErrorResult(name, error, invocation) {
  if (!isPlainObject(invocation)) throw new Error("Public error result requires an invocation classification.");
  return deepFreezePublic({
    report: assertHumanReportPrivacy({ status: "blocked", message: publicErrorMessage(name, error) }),
    hostControl: publicHostControl(name, invocation, null)
  });
}
function publicErrorMessage(name, error) {
  const rawMessage = safeText2(error instanceof Error ? error.message : String(error));
  const message = rawMessage.replaceAll(name, "The requested action").replace(/\bhost[-_ ]?outcome\b/giu, "execution result").replace(/\bresearch[-_ ]?outcome\b/giu, "research result").replace(/\b(?:closureRequest|boundArgs|requiredOutcomeFields|exactly[-_ ]?once)\b/giu, "the supplied request contract");
  if (name === "record_research_outcome" && /returned evidence does not match the current research handoff/iu.test(message)) {
    return "evidenceReturned must use only the exact labels supplied in the closure request outcomeContract; put file paths in artifactPaths or validationPaths and descriptive observations in facts.";
  }
  if (name === "close_host_outcome" && /artifact and validation paths must be canonically distinct/iu.test(message)) {
    return "Artifact and validation paths must be different. Omit validationPaths when validation only checked an artifact in place, or provide a separate validation output file.";
  }
  if (name === "close_host_outcome" && /already been recorded with different immutable content/iu.test(message)) {
    return "This work already has a different recorded return and cannot be silently replaced.";
  }
  if (name === "run_experience_workflow" && /result\.checks must report every frozen protocol check exactly once and in order/iu.test(rawMessage)) {
    return "The experiment result must include every check from the frozen protocol once, preserving the same order.";
  }
  if (name === "create_dove_mission" && /(?:references unknown requirement|references unknown mission reference|selectedOption must name one declared option|work graph contains a cycle)/iu.test(message)) {
    return "The mission details are internally inconsistent. Submit only the goal and any complete simple scope, artifact, completion, or typed evidence fields; omit partial requirement, alignment, decision, and work-item structures.";
  }
  if (/must name one canonical regular file or future file inside the workspace/iu.test(message)) {
    return "The provided file reference is invalid. Select one regular file or future file inside the workspace.";
  }
  if (/requires MCP elicitation support/iu.test(message)) {
    return "The client cannot request the confirmation needed to continue.";
  }
  if (/approval handler failed/iu.test(message)) {
    return "The request could not be completed.";
  }
  if (name === "create_ambient_dove_mission" && /requires a current Dove workspace/iu.test(message) || /requires a current Dove workspace.*\/dove:workspace.*research mainline/iu.test(message)) {
    return "The project research mainline has not been established. Run /dove:workspace explicitly before starting new work.";
  }
  if (name === "create_ambient_dove_mission" && /(?:changes|requires changing) the project research mainline/iu.test(message)) {
    return "This request would change the project research mainline. Run /dove:workspace explicitly and approve the new direction first.";
  }
  if (/\b(?:validated internal state|schema|workspace manifest|contract|receipt|digest|token|exact replay|MutationContext|canonical workspace)\b/iu.test(message)) {
    return "The requested action could not complete because recorded internal state is unavailable or no longer current.";
  }
  return message;
}
function reportLine(value, fallback = "None") {
  return typeof value === "string" && value.trim() ? safeText2(value).trim() : fallback;
}
function chineseStatusText(report) {
  const complete = report.workStatus?.state === "complete" || report.progress?.state === "complete";
  const hasCurrentWork = report.workStatus?.state === "work-produced" || Number(report.workStatus?.currentOutputCount) > 0;
  const blocked = report.workStatus?.state === "blocked" || Number(report.progress?.blockedItems) > 0;
  const tracked = Number(report.currentSituation?.trackedWorkstreams) || 0;
  const completed = Number(report.progress?.completedItems) || 0;
  const pending = Number(report.progress?.inProgressItems) || 0;
  const blockedCount = Number(report.progress?.blockedItems) || 0;
  const outputCount = Number(report.workStatus?.currentOutputCount) || 0;
  const currentOutputs = safeStrings(report.workStatus?.currentOutputs);
  const evidenceCount = Number(report.evidenceStatus?.currentEvidenceCount) || 0;
  const sourceCount = Number(report.evidenceStatus?.sourceCount) || 0;
  const operationalIntegrity = report.operationalIntegrity ?? {};
  const review = report.evidenceStatus?.review ?? {};
  const observationOnly = report.workStatus?.observationOnly === true;
  const hostReturnStatus = typeof report.workStatus?.returnStatus === "string" ? report.workStatus.returnStatus : null;
  const hostStatusZh = { completed: "\u5B8C\u6210", blocked: "\u963B\u585E", failed: "\u5931\u8D25", stopped: "\u505C\u6B62" }[hostReturnStatus] ?? hostReturnStatus;
  const executiveSummary = complete ? "\u5F53\u524D\u5DE5\u4F5C\u5DF2\u901A\u8FC7\u5B8C\u6210\u95E8\uFF0C\u4F46\u9A8C\u6536\u4E0E\u751F\u4EA7\u5C31\u7EEA\u72B6\u6001\u9700\u8981\u5206\u522B\u67E5\u770B\u3002" : hostReturnStatus === "completed" && operationalIntegrity.hostActionReturned === true ? "\u4E3B\u673A\u52A8\u4F5C\u5DF2\u8FD4\u56DE\u5B8C\u6210\u72B6\u6001\uFF0C\u4F46\u5B8C\u6210\u8BC1\u636E\u6216\u751F\u547D\u5468\u671F\u5173\u95ED\u4ECD\u672A\u6EE1\u8DB3\uFF0C\u56E0\u6B64\u5F53\u524D\u5DE5\u4F5C\u5C1A\u672A\u5B8C\u6210\u3002" : ["blocked", "failed", "stopped"].includes(hostReturnStatus) ? `\u5DE5\u4F5C\u4EE5${hostStatusZh}\u72B6\u6001\u7ED3\u675F\uFF0C\u5F53\u524D\u5C1A\u672A\u5B8C\u6210\u3002` : hasCurrentWork ? "\u5DF2\u7ECF\u4EA7\u51FA\u53EF\u7528\u6210\u679C\uFF0C\u4F46\u4ECD\u6709\u90E8\u5206\u5B8C\u6210\u6761\u4EF6\u6216\u8BC1\u636E\u9700\u8981\u8865\u9F50\u3002" : blocked ? "\u5F53\u524D\u5DE5\u4F5C\u5728\u5F62\u6210\u53EF\u7528\u6210\u679C\u4E4B\u524D\u53D7\u5230\u963B\u585E\u3002" : "\u5F53\u524D\u5DE5\u4F5C\u4ECD\u5728\u63A8\u8FDB\uFF0C\u5C1A\u672A\u8BB0\u5F55\u53EF\u7528\u6210\u679C\u3002";
  const currentSituation = tracked === 0 ? "\u5F53\u524D\u8FD8\u6CA1\u6709\u7EB3\u5165\u8DDF\u8E2A\u7684\u5DE5\u4F5C\u4EFB\u52A1\u3002" : `\u5F53\u524D\u8DDF\u8E2A ${tracked} \u9879\u5DE5\u4F5C\uFF1B${Array.isArray(report.risksAndBlockers) ? report.risksAndBlockers.length : 0} \u9879\u91CD\u8981\u98CE\u9669\u6216\u963B\u585E\u9700\u8981\u5173\u6CE8\u3002`;
  const progress = completed + pending + blockedCount > 0 ? `\u5DF2\u5B8C\u6210 ${completed} \u9879\uFF0C\u8FDB\u884C\u4E2D ${pending} \u9879\uFF0C\u963B\u585E ${blockedCount} \u9879\u3002` : hasCurrentWork ? "\u5F53\u524D\u5DF2\u6709\u53EF\u7528\u6210\u679C\u3002" : "\u76EE\u524D\u6CA1\u6709\u53EF\u6C47\u62A5\u7684\u5206\u9879\u8FDB\u5C55\u3002";
  const findings = [];
  if (currentOutputs.length > 0) findings.push(`\u5F53\u524D\u53EF\u89C1\u7684\u6210\u679C\u6587\u4EF6\u5305\u62EC\uFF1A${currentOutputs.join("\u3001")}${outputCount > currentOutputs.length ? `\uFF0C\u53E6\u6709 ${outputCount - currentOutputs.length} \u9879` : ""}\u3002`);
  else if (outputCount > 0) findings.push(`\u5F53\u524D\u6709 ${outputCount} \u9879\u53EF\u7528\u6210\u679C\u3002`);
  if (completed > 0) findings.push(`${completed} \u9879\u5DE5\u4F5C\u5DF2\u8FBE\u5230\u65E2\u5B9A\u5B8C\u6210\u6761\u4EF6\u3002`);
  if (sourceCount > 0) findings.push(`\u5F53\u524D\u8303\u56F4\u5185\u6709 ${sourceCount} \u9879\u6765\u6E90\u6750\u6599\u53EF\u4F9B\u4F7F\u7528\u3002`);
  if (Number(review.currentCount) > 0) findings.push(`\u5F53\u524D\u6709 ${Number(review.currentCount)} \u9879\u975E\u6743\u5A01\u590D\u6838\u5F52\u6863\u3002`);
  if (Number(review.staleCount) > 0) findings.push(`\u6709 ${Number(review.staleCount)} \u9879\u590D\u6838\u5F52\u6863\u5DF2\u8FC7\u671F\u3002`);
  if (complete && findings.length === 0) findings.push("\u65E2\u5B9A\u5B8C\u6210\u6761\u4EF6\u5DF2\u7ECF\u6EE1\u8DB3\u3002 ");
  const outputSummary = currentOutputs.length > 0 ? `\uFF0C\u5305\u62EC ${currentOutputs.join("\u3001")}` : "";
  const workStatus = complete ? `\u7EB3\u5165\u8DDF\u8E2A\u7684\u5DE5\u4F5C\u5DF2\u7ECF\u6EE1\u8DB3\u65E2\u5B9A\u5B8C\u6210\u6761\u4EF6${outputSummary}\u3002` : hostReturnStatus === "completed" && operationalIntegrity.hostActionReturned === true ? `\u4E3B\u673A\u52A8\u4F5C\u5DF2\u7ECF\u8FD4\u56DE\u5B8C\u6210\u72B6\u6001${outputSummary}\uFF0C\u4F46\u5B8C\u6210\u8BC1\u636E\u6216\u751F\u547D\u5468\u671F\u5173\u95ED\u4ECD\u7136\u5F00\u653E\u3002` : ["blocked", "failed", "stopped"].includes(hostReturnStatus) ? `\u5DE5\u4F5C\u4EE5${hostStatusZh}\u72B6\u6001\u7ED3\u675F\uFF0C\u4ECD\u672A\u5B8C\u6210\u3002` : hasCurrentWork ? `\u5F53\u524D\u5DF2\u7ECF\u6709\u5B9E\u9645\u6210\u679C${outputSummary}\uFF1B\u5269\u4F59\u95EE\u9898\u4E3B\u8981\u662F\u9A8C\u8BC1\u3001\u590D\u6838\u6216\u4E2A\u522B\u672A\u5B8C\u6210\u4E8B\u9879\uFF0C\u800C\u4E0D\u662F\u5C1A\u672A\u5F00\u5C55\u5DE5\u4F5C\u3002` : blocked ? "\u5FC5\u9700\u5DE5\u4F5C\u53D7\u5230\u963B\u585E\uFF0C\u5C1A\u672A\u5F62\u6210\u5F53\u524D\u53EF\u7528\u6210\u679C\u3002" : tracked > 0 ? "\u5DE5\u4F5C\u6B63\u5728\u63A8\u8FDB\uFF0C\u4F46\u5C1A\u672A\u8BB0\u5F55\u5F53\u524D\u6210\u679C\u3002" : "\u5C1A\u672A\u5F00\u59CB\u7EB3\u5165\u8DDF\u8E2A\u7684\u5DE5\u4F5C\u3002";
  const evidenceStatus = report.evidenceStatus?.state === "ready" ? "\u5F53\u524D\u8BC1\u636E\u8DB3\u4EE5\u652F\u6301\u5B8C\u6210\u5224\u65AD\u3002" : report.evidenceStatus?.state === "evidence-recording-missing" ? "\u6210\u679C\u6587\u4EF6\u5DF2\u7ECF\u5B58\u5728\uFF0C\u4F46\u4ECD\u7F3A\u5C11\u652F\u6301\u5B8C\u6210\u5224\u65AD\u7684\u73B0\u884C\u8BC1\u636E\u3002" : evidenceCount > 0 ? "\u5F53\u524D\u5DF2\u6709\u8BC1\u636E\uFF0C\u4F46\u4ECD\u6709\u4E00\u9879\u6216\u591A\u9879\u5B8C\u6210\u6761\u4EF6\u9700\u8981\u8865\u5145\u652F\u6301\u3002" : "\u5C1A\u672A\u8BB0\u5F55\u5F53\u524D\u6210\u679C\u7684\u6709\u6548\u8BC1\u636E\u3002";
  return { executiveSummary, currentSituation, progress, findings, workStatus, evidenceStatus };
}
function chineseAction(value, fallback = "\u7EE7\u7EED\u5904\u7406\u4F18\u5148\u7EA7\u6700\u9AD8\u7684\u672A\u5B8C\u6210\u5DE5\u4F5C\uFF0C\u5E76\u8865\u5145\u5BF9\u5E94\u8BC1\u636E\u3002") {
  const text11 = reportLine(value, "");
  if (!text11) return fallback;
  if (new RegExp("\\p{Script=Han}", "u").test(text11)) return text11;
  const normalized3 = text11.toLowerCase();
  if (normalized3.includes("independent review")) return "\u4E3A\u5F53\u524D\u6210\u679C\u8865\u5145\u6216\u66F4\u65B0\u72EC\u7ACB\u590D\u6838\u3002";
  if (normalized3.includes("source")) return "\u6838\u9A8C\u6240\u9700\u6765\u6E90\uFF0C\u6216\u6539\u7528\u7B26\u5408\u8981\u6C42\u7684\u8BC1\u636E\u3002";
  if (normalized3.includes("blocker") || normalized3.includes("alternative direction")) return "\u89E3\u51B3\u5F53\u524D\u963B\u585E\uFF1B\u5982\u679C\u539F\u65B9\u5411\u4E0D\u53EF\u884C\uFF0C\u8BF7\u660E\u786E\u9009\u62E9\u6709\u4F9D\u636E\u7684\u66FF\u4EE3\u65B9\u5411\u3002";
  if (normalized3.includes("evidence") || normalized3.includes("output") || normalized3.includes("check")) return "\u66F4\u65B0\u53D7\u5F71\u54CD\u6210\u679C\u548C\u68C0\u67E5\u9879\u7684\u73B0\u884C\u8BC1\u636E\u3002";
  if (normalized3.includes("newer") || normalized3.includes("active direction")) return "\u8F6C\u5411\u66F4\u65B0\u540E\u7684\u6709\u6548\u5DE5\u4F5C\u65B9\u5411\u3002";
  if (normalized3.includes("initialize")) return "\u5148\u521D\u59CB\u5316 Dove\uFF0C\u518D\u5EFA\u7ACB\u7B2C\u4E00\u9879\u5DE5\u4F5C\u3002";
  if (normalized3.includes("create") && normalized3.includes("work")) return "\u5EFA\u7ACB\u7B2C\u4E00\u9879\u5177\u4F53\u5DE5\u4F5C\u5E76\u5F00\u59CB\u6267\u884C\u3002";
  if (normalized3.includes("choose") || normalized3.includes("select")) return "\u4ECE\u5F53\u524D\u53EF\u89C1\u5DE5\u4F5C\u4E2D\u660E\u786E\u9009\u62E9\u4E0B\u4E00\u9879\u8981\u5904\u7406\u7684\u5185\u5BB9\u3002";
  if (normalized3.includes("completion") || normalized3.includes("gap")) return "\u5904\u7406\u5F53\u524D\u7F3A\u53E3\u540E\u91CD\u65B0\u8BC4\u4F30\u5B8C\u6210\u60C5\u51B5\u3002";
  return fallback;
}
function chineseOperationMessage(report) {
  const message = reportLine(report.message, "");
  if (message && new RegExp("\\p{Script=Han}", "u").test(message)) return message;
  if (/artifact and validation paths must be different/iu.test(message)) return "\u6210\u679C\u6587\u4EF6\u4E0E\u9A8C\u8BC1\u8F93\u51FA\u5FC5\u987B\u662F\u4E0D\u540C\u6587\u4EF6\u3002\u82E5\u53EA\u662F\u539F\u5730\u68C0\u67E5\u6210\u679C\uFF0C\u8BF7\u7701\u7565 validationPaths\uFF1B\u53EA\u6709\u5B9E\u9645\u751F\u6210\u4E86\u72EC\u7ACB\u9A8C\u8BC1\u8F93\u51FA\u6587\u4EF6\u65F6\u624D\u586B\u5199\u3002";
  if (/internally inconsistent/iu.test(message)) return "\u4EFB\u52A1\u8BE6\u60C5\u5185\u90E8\u4E0D\u4E00\u81F4\u3002\u8BF7\u53EA\u4FDD\u7559\u5177\u4F53\u76EE\u6807\uFF0C\u4EE5\u53CA\u5B8C\u6574\u7684\u8303\u56F4\u3001\u6587\u4EF6\u3001\u5B8C\u6210\u6761\u4EF6\u6216\u5E26\u7C7B\u578B\u7684\u8BC1\u636E\u5B57\u6BB5\uFF1B\u4E0D\u8981\u63D0\u4EA4\u4E0D\u5B8C\u6574\u7684\u9700\u6C42\u3001\u5BF9\u9F50\u3001\u51B3\u7B56\u6216\u5DE5\u4F5C\u9879\u7ED3\u6784\u3002";
  if (/provided file reference is invalid/iu.test(message)) return "\u6587\u4EF6\u5F15\u7528\u65E0\u6548\u3002\u8BF7\u9009\u62E9\u5DE5\u4F5C\u533A\u5185\u7684\u5E38\u89C4\u6587\u4EF6\u6216\u672A\u6765\u6587\u4EF6\u3002";
  if (/client (?:lacks the capability needed|cannot request the confirmation needed)/iu.test(message)) return "\u5BA2\u6237\u7AEF\u7F3A\u5C11\u7EE7\u7EED\u5F53\u524D\u68C0\u67E5\u70B9\u6240\u9700\u7684\u80FD\u529B\u3002";
  if (/request could not be completed/iu.test(message)) return "\u8BF7\u6C42\u672A\u80FD\u5B8C\u6210\u3002";
  if (report.status === "blocked") return message || "\u8BF7\u6C42\u672A\u80FD\u5B8C\u6210\u3002";
  if (isPlainObject(report.approval) && report.approval.required === true) return "\u9700\u8981\u786E\u8BA4\u540E\u624D\u80FD\u7EE7\u7EED\u3002";
  if (report.status === "declined") return "\u5DF2\u53D6\u6D88\u672C\u6B21\u66F4\u6539\uFF0C\u6CA1\u6709\u5199\u5165\u4EFB\u4F55\u5185\u5BB9\u3002";
  if (report.status === "cancelled") return "\u672C\u6B21\u64CD\u4F5C\u5DF2\u53D6\u6D88\uFF0C\u6CA1\u6709\u5199\u5165\u4EFB\u4F55\u5185\u5BB9\u3002";
  if (report.status === "initialized") return "Dove \u9879\u76EE\u8BB0\u5F55\u5DF2\u51C6\u5907\u597D\u3002";
  if (report.status === "materialized") return /requested work has not been completed yet/iu.test(message) ? "Dove \u5DF2\u8BB0\u5F55\u5DE5\u4F5C\u5165\u53E3\uFF1B\u7528\u6237\u8BF7\u6C42\u7684\u5B9E\u9645\u5DE5\u4F5C\u5C1A\u672A\u5B8C\u6210\u3002" : "\u5DE5\u4F5C\u8BB0\u5F55\u5DF2\u5EFA\u7ACB\uFF1B\u8FD9\u4E0D\u8868\u793A\u7528\u6237\u8BF7\u6C42\u7684\u5B9E\u9645\u5DE5\u4F5C\u5DF2\u7ECF\u5B8C\u6210\u3002";
  if (report.status === "partial-commit-failure") return "\u6210\u679C\u8BC1\u636E\u5DF2\u7ECF\u8BB0\u5F55\uFF0C\u4F46\u5B8C\u6210\u8BC4\u4F30\u5931\u8D25\uFF1B\u4E0D\u8981\u91CD\u590D\u63D0\u4EA4\u5173\u95ED\u64CD\u4F5C\uFF0C\u8BF7\u4F7F\u7528\u53EA\u8BFB\u5B8C\u6210\u68C0\u67E5\u91CD\u65B0\u8BC4\u4F30\u3002";
  if (report.status === "replayed") return "\u76F8\u540C\u7684\u7ED3\u679C\u56DE\u62A5\u5DF2\u7ECF\u8BB0\u5F55\uFF1B\u672C\u6B21\u4E3A\u96F6\u5199\u5165\u91CD\u653E\u3002";
  if (report.status === "no-progress-skipped") return "\u672C\u6B21\u6CA1\u6709\u5F62\u6210\u65B0\u7684\u53EF\u8BB0\u5F55\u8FDB\u5C55\u3002";
  if (report.status === "ingested") return "\u5F53\u524D\u6210\u679C\u8BC1\u636E\u5DF2\u8BB0\u5F55\u3002";
  if (report.status === "recorded") return "\u8BF7\u6C42\u7684\u5185\u5BB9\u5DF2\u8BB0\u5F55\u3002";
  if (report.status === "imported") return "\u8FD4\u56DE\u7684\u5BA1\u9605\u7ED3\u679C\u5DF2\u5BFC\u5165\u3002";
  if (report.status === "compared") return "\u6240\u9009\u7248\u672C\u5DF2\u5B8C\u6210\u6BD4\u8F83\u3002";
  if (report.status === "ok") return "\u67E5\u8BE2\u5DF2\u5B8C\u6210\u3002";
  return "\u64CD\u4F5C\u5DF2\u5B8C\u6210\u3002";
}
function renderStatusReport(report, language) {
  const zh = language === "zh" || language.startsWith("zh-");
  const headings = zh ? {
    current: "\u5F53\u524D\u72B6\u6001",
    evidence: "\u7ED3\u679C\u4E0E\u8BC1\u636E",
    risksAndBlockers: "\u4E0D\u786E\u5B9A\u6027\u4E0E\u963B\u788D",
    recommendation: "\u5EFA\u8BAE",
    nextActions: "\u4E0B\u4E00\u6B65"
  } : {
    current: "Current status",
    evidence: "Results and evidence",
    risksAndBlockers: "Uncertainty and blockers",
    recommendation: "Recommendation",
    nextActions: "Next step"
  };
  const none = zh ? "\u65E0" : "None";
  const localized = zh ? chineseStatusText(report) : null;
  const lines = [];
  if (report.narrativeState === "available" && isPlainObject(report.researchNarrative)) {
    const renderedNarrative = Object.hasOwn(report.researchNarrative, "activeDirections") ? renderProjectResearchNarrative(report.researchNarrative, { language: zh ? "zh" : "en" }) : renderResearchNarrative(report.researchNarrative, { language: zh ? "zh" : "en" });
    lines.push(zh ? "\u79D1\u7814\u8109\u7EDC" : "Research narrative", renderedNarrative, "");
  }
  const currentLines = [
    localized?.executiveSummary ?? reportLine(report.executiveSummary, none)
  ];
  const situation = localized?.currentSituation ?? reportLine(report.currentSituation?.summary, none);
  const progress = localized?.progress ?? reportLine(report.progress?.summary, none);
  if (situation !== none && situation !== currentLines[0]) currentLines.push(situation);
  if (progress !== none && !currentLines.includes(progress)) currentLines.push(progress);
  lines.push(headings.current, ...currentLines);
  const findings = zh ? localized.findings : safeStrings(report.findings);
  const evidenceLines = [];
  if (findings.length) evidenceLines.push(...findings.map((item) => `- ${item}`));
  if (isPlainObject(report.operationalIntegrity)) {
    const integrity = report.operationalIntegrity;
    evidenceLines.push(
      zh ? `- \u4E3B\u673A\u52A8\u4F5C\u5DF2\u8FD4\u56DE\uFF1A${integrity.hostActionReturned ? "\u662F" : "\u5426"}` : `- Host action returned: ${integrity.hostActionReturned ? "yes" : "no"}`,
      zh ? `- \u6210\u679C\u8BC1\u636E\u5DF2\u8BB0\u5F55\uFF1A${integrity.receiptRecorded ? "\u662F" : "\u5426"}` : `- Receipt recorded: ${integrity.receiptRecorded ? "yes" : "no"}`,
      zh ? `- \u5B8C\u6210\u8BC1\u636E\u5DF2\u6EE1\u8DB3\uFF1A${integrity.completionEvidenceSatisfied ? "\u662F" : "\u5426"}` : `- Completion evidence satisfied: ${integrity.completionEvidenceSatisfied ? "yes" : "no"}`,
      zh ? `- \u751F\u547D\u5468\u671F\u5DF2\u5173\u95ED\uFF1A${integrity.lifecycleClosed ? "\u662F" : "\u5426"}` : `- Lifecycle closed: ${integrity.lifecycleClosed ? "yes" : "no"}`
    );
  }
  const workStatus = localized?.workStatus ?? reportLine(report.workStatus?.summary, none);
  const evidenceStatus = localized?.evidenceStatus ?? reportLine(report.evidenceStatus?.summary, none);
  if (workStatus !== none && !currentLines.includes(workStatus)) evidenceLines.push(workStatus);
  if (evidenceStatus !== none && !currentLines.includes(evidenceStatus) && evidenceStatus !== workStatus) evidenceLines.push(evidenceStatus);
  if (evidenceLines.length) lines.push("", headings.evidence, ...evidenceLines);
  const risks = Array.isArray(report.risksAndBlockers) ? report.risksAndBlockers.filter(isPlainObject) : [];
  if (risks.length) lines.push("", headings.risksAndBlockers);
  for (const risk of risks) {
    if (zh) {
      const category = attentionCategory(risk.whatHappened);
      const guidance = {
        review: ["\u6700\u7EC8\u786E\u8BA4\u524D\u4ECD\u9700\u8981\u72EC\u7ACB\u590D\u6838\u3002", "\u5F53\u524D\u6210\u679C\u53EF\u80FD\u5DF2\u7ECF\u53EF\u7528\uFF0C\u4F46\u6700\u7EC8\u7B7E\u6838\u4ECD\u672A\u5B8C\u6210\u3002"],
        source: ["\u5F53\u524D\u7ED3\u8BBA\u4F9D\u8D56\u5C1A\u672A\u8FBE\u5230\u4F7F\u7528\u6761\u4EF6\u7684\u6765\u6E90\u6750\u6599\u3002", "\u76F8\u5173\u4E3B\u5F20\u53EF\u80FD\u4ECD\u7F3A\u5C11\u652F\u6301\uFF0C\u6216\u9700\u8981\u8C03\u6574\u3002"],
        work: ["\u5FC5\u9700\u5DE5\u4F5C\u5C1A\u4E0D\u80FD\u8FBE\u5230\u65E2\u5B9A\u5B8C\u6210\u6761\u4EF6\u3002", "\u5728\u963B\u585E\u89E3\u51B3\u6216\u65B9\u5411\u8C03\u6574\u524D\uFF0C\u76F8\u5173\u7ED3\u679C\u4ECD\u4E0D\u5B8C\u6574\u3002"],
        evidence: ["\u9700\u8981\u73B0\u884C\u8BC1\u636E\u8BC1\u660E\u6210\u679C\u4ECD\u7B26\u5408\u65E2\u5B9A\u8981\u6C42\u3002", "\u5373\u4F7F\u5DF2\u6709\u5B9E\u9645\u6210\u679C\uFF0C\u4E5F\u6682\u65F6\u65E0\u6CD5\u786E\u8BA4\u6574\u4F53\u5B8C\u6210\u3002"],
        direction: ["\u7EE7\u7EED\u65E7\u65B9\u5411\u53EF\u80FD\u9020\u6210\u91CD\u590D\u5DE5\u4F5C\u6216\u4EA7\u751F\u51B2\u7A81\u7ED3\u679C\u3002", "\u540E\u7EED\u6295\u5165\u53EF\u80FD\u65E0\u6CD5\u652F\u6301\u5F53\u524D\u76EE\u6807\u3002"],
        integrity: ["\u4E00\u9879\u5FC5\u8981\u7684\u5B8C\u6210\u6761\u4EF6\u76EE\u524D\u7F3A\u5C11\u6709\u6548\u652F\u6301\u3002", "\u6574\u4F53\u7ED3\u679C\u6682\u4E0D\u5E94\u88AB\u8868\u8FF0\u4E3A\u5DF2\u7ECF\u5145\u5206\u9A8C\u8BC1\u3002"]
      }[category];
      lines.push(`- \u53D1\u751F\u4E86\u4EC0\u4E48\uFF1A${chineseReason(risk.whatHappened, category)}`);
      lines.push(`  \u4E3A\u4EC0\u4E48\u91CD\u8981\uFF1A${typeof risk.whyItMatters === "string" && new RegExp("\\p{Script=Han}", "u").test(risk.whyItMatters) ? risk.whyItMatters : guidance[0]}`);
      lines.push(`  \u5F71\u54CD\uFF1A${typeof risk.impact === "string" && new RegExp("\\p{Script=Han}", "u").test(risk.impact) ? risk.impact : guidance[1]}`);
      lines.push("  \u8BC1\u636E\u5F3A\u5EA6\uFF1A\u8F83\u5F3A");
    } else {
      lines.push(`- What happened: ${reportLine(risk.whatHappened, none)}`);
      lines.push(`  Why it matters: ${reportLine(risk.whyItMatters, none)}`);
      lines.push(`  Impact: ${reportLine(risk.impact, none)}`);
      lines.push(`  Evidence strength: ${reportLine(risk.evidenceStrength, none)}`);
    }
  }
  if (report.narrativeState !== "available") {
    const recommendation = zh && /No current research judgment is available/iu.test(report.recommendation) ? "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u79D1\u7814\u5224\u65AD\uFF1B\u72B6\u6001\u4E0D\u4F1A\u6839\u636E\u8FDB\u5EA6\u6216\u98CE\u9669\u542F\u53D1\u5F0F\u751F\u6210\u5EFA\u8BAE\u3002" : reportLine(report.recommendation, none);
    lines.push("", headings.recommendation, recommendation);
  }
  const actions = Array.isArray(report.nextActions) ? report.nextActions.filter(isPlainObject) : [];
  if (actions.length) lines.push("", headings.nextActions, ...actions.map((item, index) => `${index + 1}. ${zh ? chineseAction(item.action) : reportLine(item.action, none)}`));
  return lines.join("\n");
}
function finalOutcomeLead(report, zh) {
  if (!isPlainObject(report.outcome) || typeof report.outcome.status !== "string") return null;
  const status = report.outcome.status;
  const summary = reportLine(report.outcome.summary, zh ? "\u6CA1\u6709\u63D0\u4F9B\u7ED3\u679C\u6458\u8981\u3002" : "No result summary was provided.");
  if (status === "completed") return zh ? `\u4E3B\u673A\u52A8\u4F5C\u5DF2\u8FD4\u56DE\u5B8C\u6210\u72B6\u6001\uFF1A${summary}` : `The host action returned completed: ${summary}`;
  if (status === "blocked") return zh ? `\u5DE5\u4F5C\u53D7\u5230\u963B\u585E\uFF0C\u5C1A\u672A\u5B8C\u6210\uFF1A${summary}` : `The work is blocked and incomplete: ${summary}`;
  if (status === "failed") return zh ? `\u5DE5\u4F5C\u6267\u884C\u5931\u8D25\uFF0C\u5C1A\u672A\u5B8C\u6210\uFF1A${summary}` : `The work failed and is incomplete: ${summary}`;
  if (status === "stopped") return zh ? `\u5DE5\u4F5C\u5DF2\u505C\u6B62\uFF0C\u5C1A\u672A\u5B8C\u6210\uFF1A${summary}` : `The work stopped and is incomplete: ${summary}`;
  return null;
}
function renderOperationReport(report, language) {
  const zh = language === "zh" || language.startsWith("zh-");
  if (typeof report.markdown === "string" && report.markdown.trim()) return report.markdown;
  if (typeof report.mainline === "string" && report.mainline.trim()) {
    const mainline = report.mainline.trim();
    const projectBrief = typeof report.projectBrief === "string" ? report.projectBrief.trim() : "";
    return projectBrief ? `${projectBrief}

${mainline}` : mainline;
  }
  if (isPlainObject(report.approval) && report.approval.required === true) {
    const none = zh ? "\u65E0" : "None";
    if (zh) {
      const effects2 = safeStrings(report.approval.effects);
      return [
        "\u9700\u8981\u786E\u8BA4\u540E\u624D\u80FD\u7EE7\u7EED\u3002",
        report.approval.noChangesApplied === true ? "\u5C1A\u672A\u5E94\u7528\u4EFB\u4F55\u66F4\u6539\u3002" : "\u66F4\u6539\u5C1A\u672A\u5B8C\u6210\u3002",
        "\u786E\u8BA4\u540E\u5C06\u6267\u884C\uFF1A",
        ...effects2.length ? effects2.map((effect, index) => `- ${chineseAction(effect, `\u5E94\u7528\u9884\u89C8\u4E2D\u5217\u51FA\u7684\u7B2C ${index + 1} \u9879\u66F4\u6539\u3002`)}`) : [`- ${none}`],
        "\u662F\u5426\u7EE7\u7EED\uFF1F"
      ].join("\n");
    }
    const lines2 = [
      reportLine(report.approval.summary, "Approval is required before continuing."),
      report.approval.noChangesApplied === true ? "No files have been created or changed." : "The changes have not been completed.",
      "If approved, Dove will:"
    ];
    const effects = safeStrings(report.approval.effects);
    lines2.push(...effects.length ? effects.map((effect) => `- ${effect}`) : [`- ${none}`]);
    lines2.push(reportLine(report.approval.question, "Continue?"));
    return lines2.join("\n");
  }
  const lead = finalOutcomeLead(report, zh);
  const primaryMessage = lead ?? (zh ? chineseOperationMessage(report) : reportLine(report.message, "The operation completed."));
  const lines = [primaryMessage];
  if (isPlainObject(report.operationalIntegrity)) {
    const integrity = report.operationalIntegrity;
    lines.push(
      "",
      zh ? "\u8FD0\u884C\u5B8C\u6574\u6027" : "Operational integrity",
      zh ? `- \u4E3B\u673A\u52A8\u4F5C\u5DF2\u8FD4\u56DE\uFF1A${integrity.hostActionReturned ? "\u662F" : "\u5426"}` : `- Host action returned: ${integrity.hostActionReturned ? "yes" : "no"}`,
      zh ? `- \u6210\u679C\u8BC1\u636E\u5DF2\u8BB0\u5F55\uFF1A${integrity.receiptRecorded ? "\u662F" : "\u5426"}` : `- Receipt recorded: ${integrity.receiptRecorded ? "yes" : "no"}`,
      zh ? `- \u5B8C\u6210\u8BC1\u636E\u5DF2\u6EE1\u8DB3\uFF1A${integrity.completionEvidenceSatisfied ? "\u662F" : "\u5426"}` : `- Completion evidence satisfied: ${integrity.completionEvidenceSatisfied ? "yes" : "no"}`,
      zh ? `- \u751F\u547D\u5468\u671F\u5DF2\u5173\u95ED\uFF1A${integrity.lifecycleClosed ? "\u662F" : "\u5426"}` : `- Lifecycle closed: ${integrity.lifecycleClosed ? "yes" : "no"}`
    );
  }
  if (isPlainObject(report.partialCommit)) {
    lines.push("", zh ? "\u90E8\u5206\u63D0\u4EA4\u5931\u8D25\uFF1A\u6210\u679C\u8BC1\u636E\u5DF2\u63D0\u4EA4\uFF0C\u4F46\u5B8C\u6210\u8BC4\u4F30\u5931\u8D25\u3002\u8BF7\u52FF\u91CD\u590D\u5173\u95ED\u6216\u6309\u96F6\u5199\u5165\u91CD\u8BD5\uFF1B\u8BF7\u6267\u884C\u53EA\u8BFB\u5B8C\u6210\u91CD\u65B0\u8BC4\u4F30\u3002" : "Partial commit failure: the receipt was committed, but completion assessment failed. Do not repeat closure or retry as zero-write; run the read-only completion reassessment.");
  }
  if (isPlainObject(report.researchNarrative)) lines.push("", renderResearchNarrative(report.researchNarrative, { language: zh ? "zh" : "en" }));
  if (isPlainObject(report.outcome)) {
    const outcome = report.outcome.summary ?? report.outcome.caption;
    if (typeof outcome === "string" && !primaryMessage.includes(reportLine(outcome, ""))) lines.push(`${zh ? "\u7ED3\u679C" : "Outcome"}: ${reportLine(outcome, zh ? "\u7ED3\u679C\u5DF2\u51C6\u5907\u597D\u3002" : "The result is ready.")}`);
    else if (typeof report.outcome.accepted === "boolean") {
      lines.push(`${zh ? "\u6267\u884C\u7ED3\u679C" : "Execution outcome"}: ${report.outcome.accepted ? zh ? "\u5DF2\u63A5\u53D7" : "accepted" : zh ? "\u672A\u63A5\u53D7" : "not accepted"}`);
      lines.push(`${zh ? "\u8BC1\u636E" : "Evidence"}: ${report.outcome.evidenceComplete === true ? zh ? "\u5B8C\u6574" : "complete" : zh ? "\u4E0D\u5B8C\u6574" : "incomplete"}`);
      if (report.outcome.scopeDeviation === true) lines.push(zh ? "\u8303\u56F4\u504F\u5DEE\uFF1A\u5DF2\u68C0\u6D4B\u5230\u3002" : "Scope deviation: detected.");
    }
  }
  if (isPlainObject(report.research)) {
    const researchJudgment = zh ? chineseResearchJudgment(report.research.nextJudgment) : reportLine(report.research.nextJudgment, "Awaiting research judgment.");
    lines.push(`${zh ? "Dove \u4E0B\u4E00\u5224\u65AD" : "Dove next judgment"}: ${researchJudgment}`);
    if (report.research.awaitingReevaluation === true) lines.push(zh ? "\u6267\u884C\u4E8B\u5B9E\u5DF2\u8BB0\u5F55\uFF0C\u4F46\u5F53\u524D\u79D1\u5B66\u5224\u65AD\u5C1A\u672A\u6D88\u8D39\u8BE5 Receipt\u3002" : "Execution facts were recorded, but the current scientific judgment has not consumed the receipt.");
    if (Array.isArray(report.research.reasonCodes) && report.research.reasonCodes.length > 0) lines.push(`${zh ? "\u5224\u65AD\u539F\u56E0" : "Decision reasons"}: ${report.research.reasonCodes.join(", ")}`);
  }
  if (isPlainObject(report.completion)) {
    const label = report.completion.complete === true ? zh ? "\u5DF2\u5B8C\u6210" : "complete" : zh ? "\u5C1A\u672A\u5B8C\u6210" : "not complete";
    lines.push(`${zh ? "\u5B8C\u6210\u60C5\u51B5" : "Completion"}: ${label}`);
    for (const gap of safeStrings(report.completion.gaps)) lines.push(`- ${zh ? chineseReason(gap) : gap}`);
  }
  if (isPlainObject(report.review)) {
    if (typeof report.review.summary === "string") lines.push(`${zh ? "\u5BA1\u9605\u7ED3\u8BBA" : "Review"}: ${reportLine(report.review.summary)}`);
    else lines.push(`${zh ? "\u590D\u6838\u5F52\u6863" : "Review archives"}: ${Number(report.review.currentCount) || 0} ${zh ? "\u9879\u73B0\u884C\uFF0C" : "current, "}${Number(report.review.staleCount) || 0} ${zh ? "\u9879\u8FC7\u671F" : "stale"}`);
  }
  return lines.join("\n");
}
function renderPublicReport(report, { language = DEFAULT_DOVE_RESPONSE_LANGUAGE } = {}) {
  if (!isPlainObject(report)) return reportLine(report, "");
  const isStatusReport = REPORT_SECTION_FIELDS.every((field) => Object.hasOwn(report, field));
  return isStatusReport ? renderStatusReport(report, language) : renderOperationReport(report, language);
}

// src/core/research-decision-reevaluation.mjs
import crypto19 from "node:crypto";
var FIELDS4 = /* @__PURE__ */ new Set(["operation", "missionId", "decisionRevision", "requestedDisposition", "synthesis", "hypotheses", "routes", "openQuestions", "evidenceRefs", "consumedReceiptIds", "reasonCodes", "nextAction", "createdAt"]);
var DISPOSITIONS = /* @__PURE__ */ new Set(["continue", "stop-satisfied", "stop-low-return", "stop-budget", "reject", "block-needs-user"]);
var FOUR_HOURS_MS2 = 4 * 60 * 60 * 1e3;
function sealed10(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
}
function exactIso10(value, label) {
  if (typeof value !== "string" || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO timestamp.`);
  return value;
}
function resolveEvidence(root, missionId2, references) {
  return domainStringArray(references, "evidenceRefs").map((reference, index) => {
    if (reference.startsWith("source:")) {
      const sourceId = domainSafeId(reference.slice(7), `evidenceRefs[${index}]`);
      if (!evaluateSourceReferences(root, [sourceId], missionId2)[0]?.eligible) throw new Error(`evidenceRefs[${index}] is not current source evidence.`);
      return reference;
    }
    if (reference.startsWith("validation:")) return `validation:${resolveMissionValidationReference(root, missionId2, reference.slice(11), `evidenceRefs[${index}]`).reference}`;
    if (reference.startsWith("artifact:")) return `artifact:${resolveMissionArtifactReferences(root, missionId2, [reference.slice(9)], `evidenceRefs[${index}]`)[0].path}`;
    throw new Error(`evidenceRefs[${index}] must be a typed current evidence reference.`);
  });
}
function transitionStatus(disposition) {
  return disposition === "reject" ? "failed" : "stopped";
}
function eligibleReceiptIds(workspace, missionId2, decision) {
  const consumed = new Set(decision.consumedReceiptIds);
  return workspace.receiptLedger.receipts.filter((receipt) => receipt.missionId === missionId2 && receipt.researchOutcome?.decisionId === decision.decisionId && !consumed.has(receipt.receiptId)).map((receipt) => receipt.receiptId);
}
function currentResearchDecisionBinding(root, missionId2) {
  const { workspace, mission } = readCurrentMission(root, missionId2, "Current research decision public binding");
  if (mission.mode !== "research") throw new Error("Research decision reevaluation requires a research mission.");
  const decision = workspace.currentResearchDecisions.get(mission.missionId);
  if (!decision) throw new Error("The selected mission does not have a current research decision.");
  return { decisionRevision: decision.revision, consumedReceiptIds: eligibleReceiptIds(workspace, mission.missionId, decision) };
}
function researchStableId(prefix, missionId2, decisionRevision, index, text11) {
  const normalized3 = String(text11 ?? "").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 40) || String(index + 1);
  const digest3 = crypto19.createHash("sha256").update(`${missionId2}
${decisionRevision + 1}
${index}
${String(text11 ?? "")}`).digest("hex").slice(0, 12);
  return `${prefix}-${decisionRevision + 1}-${normalized3}-${digest3}`.slice(0, 128);
}
function prepareResearchDecisionReevaluation(root, args = {}) {
  const missionId2 = resolveVisibleMissionSelector(root, args);
  const { decisionRevision, consumedReceiptIds } = currentResearchDecisionBinding(root, missionId2);
  const hypotheses = args.hypotheses.map((item, index) => ({
    ...item,
    hypothesisId: researchStableId("hypothesis", missionId2, decisionRevision, index, item.statement)
  }));
  const openQuestions = args.openQuestions.map((item, index) => ({
    ...item,
    questionId: researchStableId("question", missionId2, decisionRevision, index, item.question)
  }));
  const routes = args.routes.map((item, index) => ({
    ...item,
    routeId: researchStableId("route", missionId2, decisionRevision, index, item.summary)
  }));
  const targetIds = new Map([
    ...hypotheses.map((item, index) => [`hypothesis:${index + 1}`, item.hypothesisId]),
    ...openQuestions.map((item, index) => [`question:${index + 1}`, item.questionId])
  ]);
  const nextAction = args.nextAction === null ? null : {
    ...args.nextAction,
    actionId: researchStableId("research-action", missionId2, decisionRevision, 0, args.nextAction.description),
    targetHypothesisOrQuestionIds: args.nextAction.targets.map((target) => {
      const resolved = targetIds.get(target);
      if (!resolved) throw new Error(`nextAction.targets contains an unknown public target ${target}.`);
      return resolved;
    })
  };
  if (nextAction) delete nextAction.targets;
  return {
    operation: args.operation,
    missionId: missionId2,
    decisionRevision,
    requestedDisposition: args.requestedDisposition,
    synthesis: args.synthesis,
    hypotheses,
    routes,
    openQuestions,
    evidenceRefs: args.evidenceRefs,
    consumedReceiptIds,
    reasonCodes: args.reasonCodes,
    nextAction
  };
}
function reevaluateResearchDecision(root, args = {}) {
  assertGovernanceMutationRegistered("reevaluate-research-decision", "guarded");
  sealed10(args, FIELDS4, "reevaluate-research-decision");
  if (args.operation !== "reevaluate-research-decision") throw new Error("Research decision reevaluation requires its explicit operation.");
  const context = currentMutationContext(root);
  if (!context || context.mutationMode !== "direct-process") throw new Error("Research decision reevaluation requires one direct-process MutationContext.");
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Research decision reevaluation");
  if (mission.mode !== "research") throw new Error("Research decision reevaluation requires a research mission.");
  assertMissionAcceptsWrites(workspace, mission);
  const current = workspace.currentResearchDecisions.get(mission.missionId);
  if (!current || current.revision !== args.decisionRevision) throw new Error("The submitted research decision revision is stale.");
  const disposition = domainNonEmptyText(args.requestedDisposition, "requestedDisposition");
  if (!DISPOSITIONS.has(disposition)) throw new Error("requestedDisposition is unsupported.");
  const createdAt = exactIso10(args.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(), "createdAt");
  if (Date.parse(createdAt) < Date.parse(current.createdAt)) throw new Error("createdAt must not precede the current decision.");
  const evidenceRefs2 = resolveEvidence(root, mission.missionId, args.evidenceRefs);
  const consumedReceiptIds = domainStringArray(args.consumedReceiptIds, "consumedReceiptIds").map((id3, index) => domainSafeId(id3, `consumedReceiptIds[${index}]`));
  const missionReceipts = new Map(workspace.receiptLedger.receipts.filter((receipt) => receipt.missionId === mission.missionId && receipt.researchOutcome).map((receipt) => [receipt.receiptId, receipt]));
  if (consumedReceiptIds.some((id3) => !missionReceipts.has(id3))) throw new Error("consumedReceiptIds must reference research receipts from the current mission.");
  if (consumedReceiptIds.some((id3) => missionReceipts.get(id3).researchOutcome.decisionId !== current.decisionId)) throw new Error("consumedReceiptIds must reference outcomes produced under the current decision.");
  const eligible = eligibleReceiptIds(workspace, mission.missionId, current);
  if (consumedReceiptIds.length !== eligible.length || consumedReceiptIds.some((id3, index) => id3 !== eligible[index])) throw new Error("consumedReceiptIds must contain every eligible unconsumed receipt under the current decision in ledger order.");
  const nextAction = args.nextAction === null ? null : createResearchDecisionAction(args.nextAction);
  const content = { synthesis: domainNonEmptyText(args.synthesis, "synthesis"), hypotheses: args.hypotheses, routes: args.routes, openQuestions: args.openQuestions, evidenceRefs: evidenceRefs2, consumedReceiptIds, disposition, reasonCodes: domainStringArray(args.reasonCodes, "reasonCodes"), nextAction };
  const appended = appendResearchDecision2(root, { missionId: mission.missionId, predecessorDecisionId: current.decisionId, predecessorDecisionDigest: current.decisionDigest, createdAt, content });
  const transition = !["continue", "stop-satisfied", "block-needs-user"].includes(disposition) ? createMissionTransition({ workspaceId: workspace.manifest.workspaceId, missionId: mission.missionId, contractDigest: mission.contractDigest, workspaceRevisionId: mission.workspaceRevisionId, status: transitionStatus(disposition), reason: content.synthesis, evidenceRefs: evidenceRefs2, trigger: "research-decision", createdAt }) : null;
  if (transition) {
    context.requireCommitPrecondition(ARTIFACT_PATHS.missionTransitionsDir);
    writeJson(root, missionTransitionPath(transition.transitionId), transition);
  }
  const handoff = nextAction ? createResearchHandoff(appended.decision, { issuedAt: createdAt, expiresAt: new Date(Date.parse(createdAt) + FOUR_HOURS_MS2).toISOString() }) : null;
  return { status: "recorded", operation: "reevaluate-research-decision", summary: "Dove recorded the current scientific judgment from explicit evidence and receipt consumption.", decision: appended.decision, researchDisposition: disposition, evidenceCount: evidenceRefs2.length, executionHandoff: handoff, ...disposition === "stop-satisfied" ? { completion: { missionId: mission.missionId, assessWith: "assess_mission_completion", assessment: null }, postCommit: { kind: "assess-mission-completion", missionId: mission.missionId } } : {}, writes: [researchDecisionPath(appended.decision.decisionId), ...transition ? [missionTransitionPath(transition.transitionId)] : []] };
}

// src/core/research-outcome.mjs
import crypto20 from "node:crypto";
import path24 from "node:path";
var RECORD_FIELDS2 = /* @__PURE__ */ new Set(["missionId", "decisionRevision", "attemptId", "status", "performedActionCount", "actualUsage", "evidenceReturned", "artifactPaths", "validationPaths", "facts", "startedAt", "finishedAt"]);
var FOUR_HOURS_MS3 = 4 * 60 * 60 * 1e3;
function plain7(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function sealed11(value, fields, label) {
  plain7(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
}
function safeId11(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return value;
}
function sha25611(value) {
  return crypto20.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : stableWorkspaceSerialize(value)).digest("hex");
}
function inspectPaths(root, values, label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array.`);
  const result = values.map((rawPath, index) => {
    const normalized3 = normalizeProjectRelativePath(rawPath);
    if (!normalized3.ok || normalized3.normalizedPath !== rawPath) throw new Error(`${label}[${index}] must be a canonical project-relative path.`);
    const inspection = inspectDeclaredPath(root, rawPath, { requireNonEmpty: true, rejectBookkeeping: true });
    if (inspection.status !== "existing") throw new Error(`${label}[${index}] must be an existing non-empty file.`);
    assertNotDoveLessonArtifactPath(rawPath, `${label}[${index}]`);
    const snapshot = snapshotArtifactBuffer(root, rawPath, `${label}[${index}]`);
    return { path: snapshot.path, sha256: snapshot.sha256 };
  });
  if (new Set(result.map((item) => item.path)).size !== result.length) throw new Error(`${label} must not contain duplicates.`);
  return result;
}
function callbackDigest(args, decision, outcome, artifacts, validations) {
  return sha25611({ attemptId: args.attemptId, missionId: decision.missionId, decisionDigest: decision.decisionDigest, actionId: decision.nextAction.actionId, actionDigest: decision.nextAction.actionDigest, status: outcome.status, performedActionCount: outcome.performedActionCount, actualUsage: outcome.actualUsage, evidenceReturned: [...outcome.evidenceReturned], artifacts: artifacts.map(({ path: artifactPath, sha256: artifactSha256 }) => ({ path: artifactPath, sha256: artifactSha256 })), validations: validations.map(({ path: validationPath, sha256: validationSha256 }) => ({ path: validationPath, sha256: validationSha256 })), facts: [...outcome.facts], startedAt: outcome.startedAt, finishedAt: outcome.finishedAt });
}
function recordResearchOutcome(root, args = {}) {
  assertGovernanceMutationRegistered("record-research-outcome", "guarded");
  sealed11(args, RECORD_FIELDS2, "recordResearchOutcome");
  const context = currentMutationContext(root);
  if (!context || context.mutationMode !== "direct-process") throw new Error("recordResearchOutcome requires one direct-process MutationContext.");
  const missionId2 = safeId11(args.missionId, "missionId");
  const attemptId = safeId11(args.attemptId, "attemptId");
  const workspace = openDoveWorkspace(root, { operation: "Research outcome closure" });
  const mission = workspace.missions.get(missionId2);
  if (!mission || mission.mode !== "research") throw new Error("Research outcome closure requires an existing research mission.");
  assertMissionAcceptsWrites(workspace, mission, { receipt: true });
  const decision = workspace.currentResearchDecisions.get(missionId2);
  if (!decision || decision.revision !== args.decisionRevision || !decision.nextAction) throw new Error("The current research decision is stale or does not authorize an action.");
  const handoff = createResearchHandoff(decision, { issuedAt: decision.createdAt, expiresAt: new Date(Date.parse(decision.createdAt) + FOUR_HOURS_MS3).toISOString() });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const outcome = validateResearchHostOutcome(handoff, { status: args.status, performedActionCount: args.performedActionCount, actualUsage: args.actualUsage, evidenceReturned: args.evidenceReturned, facts: args.facts, claims: [], startedAt: args.startedAt, finishedAt: args.finishedAt }, { missionId: decision.missionId, contractDigest: decision.contractDigest, decisionDigest: decision.decisionDigest, currentEnvelopeId: handoff.envelopeId, supersededEnvelopeIds: [], now });
  if (outcome.scopeDeviationReasons.some((reason) => reason.startsWith("unexpected-evidence:"))) throw new Error("Returned evidence does not match the current research handoff.");
  if (outcome.status === "completed" && outcome.performedActionCount !== 1) throw new Error("A completed research outcome must report the authorized action exactly once.");
  const artifacts = inspectPaths(root, args.artifactPaths, "artifactPaths");
  const validationFiles = inspectPaths(root, args.validationPaths, "validationPaths");
  const allPaths = [...artifacts, ...validationFiles].map((item) => item.path);
  if (new Set(allPaths).size !== allPaths.length) throw new Error("Research outcome artifact and validation paths must be distinct.");
  const ownerByPath = new Map(workspace.receiptLedger.currentOwnership.map((item) => [item.path, item]));
  for (const artifact of artifacts) {
    const role = artifactEvidenceRole(artifact.path);
    const owner = ownerByPath.get(artifact.path);
    if (!owner && role !== "external-project") throw new Error(`Research outcome cannot claim an unowned Dove domain artifact: ${artifact.path}.`);
    if (owner && owner.missionId !== missionId2) throw new Error(`Research outcome artifact is owned by another mission: ${artifact.path}.`);
    if (owner && owner.sha256 !== artifact.sha256 && role !== "external-project") throw new Error(`Research outcome cannot claim a changed Dove domain artifact: ${artifact.path}.`);
  }
  const digest3 = callbackDigest(args, decision, outcome, artifacts, validationFiles);
  const existing = workspace.receiptLedger.receipts.find((receipt2) => receipt2.researchOutcome?.attemptId === attemptId);
  if (existing) {
    if (existing.researchOutcome.callbackDigest === digest3) return { status: "replayed", zeroWrite: true, receipt: existing, awaitingReevaluation: !decision.consumedReceiptIds.includes(existing.receiptId), writes: [] };
    throw new Error("The research attemptId was already recorded with different immutable content.");
  }
  const receiptId = `receipt-research-${sha25611({ missionId: missionId2, attemptId }).slice(0, 24)}`;
  const primary = artifacts[0] ?? null;
  const validations = validationFiles.map((item) => createValidationRecord({ kind: "validation-log", result: outcome.status === "completed" ? "passed" : outcome.status === "failed" ? "failed" : "incomplete", level: "integration", producerKind: "dove-internal", producerOperation: "record-research-outcome", observedExitStatus: null, targetReference: primary ? `artifact:${primary.path}` : `validation:${item.path}`, targetHash: primary?.sha256 ?? item.sha256, reference: item.path, outputHash: item.sha256 }, { label: item.path }));
  const baseReceipt = { schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION, workspaceId: workspace.manifest.workspaceId, receiptId, ledgerSequence: workspace.receiptLedger.nextLedgerSequence, missionId: missionId2, contractDigest: mission.contractDigest, summary: `Research action ${outcome.status}; scientific interpretation remains pending.`, artifacts: artifacts.map((item) => ({ ...item, kind: "other" })), validations, criteriaSatisfied: [], producedAt: outcome.finishedAt, recordedAt: now, producer: { kind: "dove-internal", actionId: "record-research-outcome" }, researchOutcome: { attemptId, decisionId: decision.decisionId, decisionDigest: decision.decisionDigest, actionId: decision.nextAction.actionId, actionDigest: decision.nextAction.actionDigest, envelopeId: handoff.envelopeId, status: outcome.status, evidenceReturned: [...outcome.evidenceReturned], actualUsage: { ...outcome.actualUsage }, facts: [...outcome.facts], startedAt: outcome.startedAt, finishedAt: outcome.finishedAt, callbackDigest: digest3 } };
  const receipt = { ...baseReceipt, artifacts: deriveArtifactReferences(baseReceipt) };
  context.requireCommitPrecondition(ARTIFACT_PATHS.executionReceiptsDir);
  context.requireCommitLock(".dove/.receipt-ledger-append.lock", { label: "Execution receipt ledger append lock" });
  assertReceiptAppendable(workspace.receiptLedger, receipt, { artifactHandoffs: workspace.artifactHandoffs });
  writeJson(root, path24.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`), receipt);
  return { status: "recorded", accepted: true, evidenceComplete: outcome.missingRequiredEvidence.length === 0, missingRequiredEvidence: outcome.missingRequiredEvidence, scopeDeviation: outcome.scopeDeviation, scopeDeviationReasons: outcome.scopeDeviationReasons, outcomeStatus: outcome.status, performedActionCount: outcome.performedActionCount, receipt, awaitingReevaluation: true, decision, writes: [path24.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`)] };
}

// src/core/host-path-normalizer.mjs
import path25 from "node:path";
function invalidPath(label, value) {
  throw new Error(`${label} must name one canonical path inside the workspace: ${value}`);
}
function normalizeHostWorkspacePath(root, value, label = "Host path") {
  if (typeof value !== "string" || !value || value !== value.trim() || value.includes("\0") || value.includes("\\")) invalidPath(label, value);
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value) && !/^[A-Za-z]:[\\/]/u.test(value)) invalidPath(label, value);
  const resolvedRoot = path25.resolve(root);
  if (path25.isAbsolute(value)) {
    const normalizedAbsolute = path25.resolve(value);
    if (normalizedAbsolute !== value) invalidPath(label, value);
    const relative = path25.relative(resolvedRoot, normalizedAbsolute);
    if (!relative || relative === ".." || relative.startsWith(`..${path25.sep}`) || path25.isAbsolute(relative)) invalidPath(label, value);
    return relative.split(path25.sep).join("/");
  }
  if (/^[A-Za-z]:[\\/]/u.test(value)) invalidPath(label, value);
  const normalized3 = path25.posix.normalize(value);
  if (normalized3 !== value || normalized3 === "." || normalized3 === ".." || normalized3.startsWith("../") || value.includes("//") || value.endsWith("/")) invalidPath(label, value);
  return value;
}
function normalizeHostWorkspaceArtifactPath(root, value, label = "Host artifact path") {
  let relativePath;
  try {
    relativePath = normalizeHostWorkspacePath(root, value, label);
  } catch (error) {
    throw new Error(`${label} must name one canonical regular file or future file inside the workspace: ${value}`, { cause: error });
  }
  const anchor = openAnchoredFilesystem(root);
  try {
    const stat = anchor.tryLstat(relativePath);
    if (stat === null) return relativePath;
    anchor.inspectRegularFile(relativePath);
    return relativePath;
  } catch (error) {
    throw new Error(`${label} must name one canonical regular file or future file inside the workspace: ${value}`, { cause: error });
  } finally {
    anchor.close();
  }
}
function normalizeHostWorkspaceFilePath(root, value, label = "Host file path") {
  let relativePath;
  try {
    relativePath = normalizeHostWorkspacePath(root, value, label);
  } catch (error) {
    throw new Error(`${label} must name one canonical regular file inside the workspace: ${value}`, { cause: error });
  }
  const anchor = openAnchoredFilesystem(root);
  try {
    anchor.inspectRegularFile(relativePath);
    return relativePath;
  } catch (error) {
    throw new Error(`${label} must name one canonical regular file inside the workspace: ${value}`, { cause: error });
  } finally {
    anchor.close();
  }
}

// src/core/lessons.mjs
import crypto21 from "node:crypto";
var DOVE_LESSONS_BINDING_VERSION = 1;
var READ_FIELDS2 = /* @__PURE__ */ new Set();
var UPDATE_FIELDS = /* @__PURE__ */ new Set(["binding", "markdown"]);
var SHA256 = /^[0-9a-f]{64}$/u;
function sha25612(content) {
  return crypto21.createHash("sha256").update(content).digest("hex");
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
  if (fields.join(",") !== ["currentHash", "version", "workspace", "workspaceIdentity"].sort().join(",") || payload.version !== DOVE_LESSONS_BINDING_VERSION || typeof payload.workspace !== "string" || typeof payload.workspaceIdentity !== "string" || !SHA256.test(String(payload.currentHash ?? ""))) {
    throw new Error("The Lessons read binding is invalid. Read the current Lessons document again.");
  }
  return { binding, payload };
}
function currentLessons(root, operation) {
  const workspace = openDoveWorkspace(root, { operation });
  const context = currentMutationContext(root);
  const markdown = context ? context.readText(ARTIFACT_PATHS.lessonsDocument, null) : workspace.lessonsDocument;
  if (typeof markdown !== "string") throw new Error("The canonical Lessons document is unavailable.");
  validateLessonsMarkdown(markdown, ARTIFACT_PATHS.lessonsDocument);
  const currentHash = sha25612(markdown);
  return { workspace, markdown, currentHash };
}
function readDoveLessons(root, args = {}) {
  assertSealedDomainArgs(args, READ_FIELDS2, "read_dove_lessons");
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
function updateDoveLessons(root, args = {}) {
  assertSealedDomainArgs(args, UPDATE_FIELDS, "update_dove_lessons");
  const context = currentMutationContext(root);
  if (!context) throw new Error("Lessons update requires an active MutationContext.");
  const { binding, payload } = decodeBinding(args.binding);
  const markdown = typeof args.markdown === "string" ? args.markdown : "";
  validateLessonsMarkdown(markdown, "markdown");
  const current = currentLessons(root, "Dove Lessons update");
  const expected = bindingPayload(current.workspace, current.currentHash);
  if (binding !== encodeBinding(expected) || payload.workspace !== expected.workspace || payload.workspaceIdentity !== expected.workspaceIdentity || payload.currentHash !== expected.currentHash) {
    throw new Error("The Lessons document changed after it was read. Read the current document and apply the update again.");
  }
  context.requireCommitPrecondition(ARTIFACT_PATHS.lessonsDocument);
  context.writeText(ARTIFACT_PATHS.lessonsDocument, markdown);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "planned" : "updated",
    markdown,
    currentHash: sha25612(markdown),
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

// src/mcp/tool-definitions.mjs
var safeId12 = { type: "string", pattern: "^[a-z0-9][a-z0-9._-]{0,127}$" };
var publicNumber = { type: "integer", minimum: 1 };
var strings6 = { type: "array", items: { type: "string", minLength: 1 } };
var ambientEvidenceRequirements = {
  type: "array",
  items: {
    type: "string",
    pattern: "^(?:artifact|validation):.+$",
    description: "Use artifact:<project-relative-path> or validation:<project-relative-path>."
  }
};
var missionMode = { type: "string", enum: ["ordinary", "research"], description: "Use research only when the work changes research understanding, experiments, evidence, or paper claims; use ordinary for a clear code, documentation, configuration, cleanup, or other bounded deliverable." };
var lessonsUpdateProps = {
  binding: { type: "string", minLength: 1, description: "Pass the exact opaque binding returned by the immediately preceding Lessons read." },
  markdown: { type: "string", minLength: 1, description: "Pass the complete replacement Markdown document with all five stable sections." }
};
var missionArtifactSchema = {
  type: "object",
  properties: {
    path: { type: "string", minLength: 1 },
    required: { type: "boolean" },
    role: { type: "string", enum: ["output", "input-output", "supporting"] }
  },
  required: ["path", "required", "role"],
  additionalProperties: false
};
var missionContractProps = {
  requirements: strings6,
  assumptions: strings6,
  scope: strings6,
  outOfScope: strings6,
  artifacts: { type: "array", items: missionArtifactSchema },
  completionCriteria: strings6,
  evidenceRequirements: ambientEvidenceRequirements
};
var ambientMissionProps = {
  mode: missionMode,
  goal: { type: "string", minLength: 1 },
  ...missionContractProps,
  mainlineAlignment: { type: "string", minLength: 1, description: "Explain how this bounded request advances the already established project research mainline." },
  changesWorkspaceMainline: { type: "boolean", description: "True only when the user requests changing the project's research direction itself; ordinary edits within that direction are false." }
};
var researchUsageSchema = {
  type: "object",
  properties: {
    actions: { type: "integer", minimum: 0, description: "Non-negative whole action count." },
    timeMinutes: { type: "integer", minimum: 0, description: "Non-negative whole minutes. Express any positive fractional limit or usage by rounding up to the next minute before submission." },
    costUnits: { type: "integer", minimum: 0, description: "Non-negative whole cost units. Express any positive fractional limit or usage by rounding up to the next unit before submission." }
  },
  required: ["actions", "timeMinutes", "costUnits"],
  additionalProperties: false
};
var researchOutcomeTimestamp = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$" };
var publicHypothesisSchema = { type: "object", properties: { statement: { type: "string", minLength: 1 }, assessment: { type: "string", enum: ["unresolved", "supported", "weakened", "falsified"] }, supportingEvidence: strings6, counterEvidence: strings6, falsificationCondition: { type: "string", minLength: 1 } }, required: ["statement", "assessment", "supportingEvidence", "counterEvidence", "falsificationCondition"], additionalProperties: false };
var publicRouteSchema = { type: "object", properties: { summary: { type: "string", minLength: 1 }, disposition: { type: "string", enum: ["considered", "selected", "rejected"] }, rationale: { type: "string", minLength: 1 } }, required: ["summary", "disposition", "rationale"], additionalProperties: false };
var publicOpenQuestionSchema = { type: "object", properties: { question: { type: "string", minLength: 1 } }, required: ["question"], additionalProperties: false };
var publicResearchActionSchema = { type: "object", properties: { kind: { type: "string", enum: ["retrieval", "experiment", "analysis", "engineering"] }, description: { type: "string", minLength: 1 }, rationale: { type: "string", minLength: 1 }, targets: { type: "array", minItems: 1, items: { type: "string", pattern: "^(?:hypothesis|question):[1-9][0-9]*$", description: "Use hypothesis:<one-based-index> or question:<one-based-index> from this reevaluation input." } }, successConditions: { ...strings6, minItems: 1 }, stopConditions: { ...strings6, minItems: 1 }, expectedEvidence: { ...strings6, minItems: 1 }, budget: researchUsageSchema }, required: ["kind", "description", "rationale", "targets", "successConditions", "stopConditions", "expectedEvidence", "budget"], additionalProperties: false };
var missionReplayProps = {
  operation: { type: "string", enum: ["start-skill", "create-root", "branch", "reevaluate-research-decision"] },
  skill: { type: "string", enum: DOVE_RESEARCH_SKILL_IDS, description: "The directly invoked public research Skill. The Slash invocation itself authorizes creation of this one bounded Skill Mission." },
  contextArtifactPaths: { ...strings6, description: "Optional canonical project-relative artifact paths that all have the same current Mission owner. They may identify that owner as the parent when no explicit parentMissionNumber is supplied." },
  missionNumber: { ...publicNumber, description: "Exact one-based mission number shown by query_dove_status for work to reevaluate." },
  missionGoal: { type: "string", minLength: 1, description: "Optional exact visible goal confirming the mission selected by missionNumber; approximate matches are not used." },
  mode: missionMode,
  goal: { type: "string", minLength: 1 },
  ...missionContractProps,
  dependsOnMissionNumbers: { type: "array", items: publicNumber },
  parentMissionNumber: { ...publicNumber, description: "Optional exact one-based public parent hint shown by query_dove_status. It is never replaced by an implicit latest-Mission selection." },
  branchKind: { type: "string", enum: ["continuation", "alternative", "follow-up", "recovery"] },
  branchReason: { type: "string", minLength: 1 },
  stopParentReason: { type: "string", minLength: 1 },
  handoffArtifactPaths: strings6,
  requestedDisposition: { type: "string", enum: ["continue", "stop-satisfied", "stop-low-return", "stop-budget", "reject", "block-needs-user"] },
  synthesis: { type: "string", minLength: 1 },
  hypotheses: { type: "array", items: publicHypothesisSchema },
  routes: { type: "array", items: publicRouteSchema },
  openQuestions: { type: "array", items: publicOpenQuestionSchema },
  evidenceRefs: { ...strings6, description: "Current source, artifact, or validation references; use actual evidence rather than expected-evidence labels." },
  reasonCodes: { type: "array", items: safeId12 },
  nextAction: { anyOf: [publicResearchActionSchema, { type: "null" }] }
};
var receiptArtifactSchema = { type: "object", properties: { path: { type: "string" }, kind: { type: "string" }, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" } }, required: ["path", "kind", "sha256"], additionalProperties: false };
var receiptValidationSchema = { type: "object", properties: { kind: { type: "string", enum: ["test-log", "typecheck-log", "lint-log", "build-log", "audit-log", "validation-log", "command-output"] }, result: { type: "string", enum: ["passed", "failed", "incomplete"] }, level: { type: "string", enum: ["static", "unit", "contract", "integration", "e2e"] }, producerKind: { type: "string", enum: ["host-observed"] }, producerOperation: { type: "string", const: "ingest-execution-receipt" }, observedExitStatus: { anyOf: [{ type: "integer", minimum: 0, maximum: 255 }, { type: "null" }] }, targetReference: { type: "string", pattern: "^(artifact|validation):.+" }, targetHash: { type: "string", pattern: "^[0-9a-f]{64}$" }, reference: { type: "string" }, outputHash: { type: "string", pattern: "^[0-9a-f]{64}$" } }, required: ["kind", "result", "level", "producerKind", "producerOperation", "observedExitStatus", "targetReference", "targetHash", "reference", "outputHash"], additionalProperties: false };
var hostFactSchema = { type: "object", properties: { statement: { type: "string", minLength: 1 }, criterionNumbers: { type: "array", items: publicNumber } }, required: ["statement", "criterionNumbers"], additionalProperties: false };
var experimentEvidenceSchema = { type: "object", properties: { experimentId: safeId12, metric: { type: "string", minLength: 1 }, value: { type: "number" }, comparison: { type: ["string", "null"] } }, required: ["experimentId", "metric", "value", "comparison"], additionalProperties: false };
var claimContractProps = { experimentEvidence: { type: "array", items: experimentEvidenceSchema }, uncertainty: strings6, unsupportedExtensions: strings6, currentAssessment: { type: "string", enum: ["supported", "weakened", "refuted", "inconclusive", "blocked"] } };
var experimentProtocolSchema = { type: "object", properties: { question: { type: "string", minLength: 1 }, hypothesis: { type: "string", minLength: 1 }, procedure: { ...strings6, minItems: 1 }, inputs: { ...strings6, minItems: 1 }, comparisons: strings6, metrics: { ...strings6, minItems: 1 }, successConditions: { ...strings6, minItems: 1 }, stopConditions: { ...strings6, minItems: 1 }, constraints: strings6, expectedArtifacts: { ...strings6, minItems: 1 }, frozenAt: { type: "string", minLength: 1 } }, required: ["question", "hypothesis", "procedure", "inputs", "comparisons", "metrics", "successConditions", "stopConditions", "constraints", "expectedArtifacts", "frozenAt"], additionalProperties: false };
var experimentResultSchema = { type: "object", properties: { status: { type: "string", enum: ["completed", "stopped", "failed", "blocked"] }, outcome: { type: "string", minLength: 1 }, measurements: { type: "array", items: { type: "object", properties: { metric: { type: "string", minLength: 1 }, value: { type: "number" }, comparison: { type: ["string", "null"] } }, required: ["metric", "value", "comparison"], additionalProperties: false } }, artifactRefs: strings6, validationRefs: strings6, denominator: { type: "object", properties: Object.fromEntries(["total", "successful", "failed", "excluded"].map((field) => [field, { type: "integer", minimum: 0 }])), required: ["total", "successful", "failed", "excluded"], additionalProperties: false }, failures: { type: "array", items: { type: "object", properties: { failureId: safeId12, count: { type: "integer", minimum: 1 }, reason: { type: "string", minLength: 1 }, evidenceRefs: strings6 }, required: ["failureId", "count", "reason", "evidenceRefs"], additionalProperties: false } }, deviations: strings6, limitations: { ...strings6, minItems: 1 }, recordedAt: { type: "string", minLength: 1 } }, required: ["status", "outcome", "measurements", "artifactRefs", "validationRefs", "denominator", "failures", "deviations", "limitations", "recordedAt"], additionalProperties: false };
var archiveProps = { missionNumber: publicNumber, artifactPath: { type: "string", minLength: 1 }, referencePaths: strings6, qa: strings6, findings: strings6 };
var reviewSnapshotSchema = { type: "object", properties: { path: { type: "string", minLength: 1 }, sizeBytes: { type: "integer", minimum: 1 }, sha256: { type: "string", pattern: "^[0-9a-f]{64}$" } }, required: ["path", "sizeBytes", "sha256"], additionalProperties: false };
var reviewScopeBindingSchema = { type: "object", properties: { schemaVersion: { type: "integer", const: 1 }, missionId: safeId12, contractDigest: { type: "string", pattern: "^[0-9a-f]{64}$" }, reviewMissionBinding: { type: "string", pattern: "^review-mission-v1-[0-9a-f]{64}$" }, hostKind: { type: "string", enum: ["claude", "opencode"] }, reviewedArtifacts: { type: "array", minItems: 1, items: reviewSnapshotSchema }, reviewedArtifactSetSha256: { type: "string", pattern: "^[0-9a-f]{64}$" } }, required: ["schemaVersion", "missionId", "contractDigest", "reviewMissionBinding", "hostKind", "reviewedArtifacts", "reviewedArtifactSetSha256"], additionalProperties: false };
var reviewFindingSchema = { type: "object", properties: { findingId: safeId12, severity: { type: "string", enum: ["low", "medium", "high"] }, summary: { type: "string", minLength: 1 }, linkedArtifactPaths: { ...strings6, minItems: 1 } }, required: ["findingId", "severity", "summary", "linkedArtifactPaths"], additionalProperties: false };
var reviewProvenanceSchema = { type: "object", properties: { hostKind: { type: "string", enum: ["claude", "opencode"] }, reviewedAt: researchOutcomeTimestamp, provider: { type: "string", minLength: 1 }, model: { type: "string", minLength: 1 } }, required: ["hostKind", "reviewedAt"], additionalProperties: false };
var receiptCriterionSchema = { type: "object", properties: { criterionId: { type: "string" }, evidenceRefs: strings6 }, required: ["criterionId", "evidenceRefs"], additionalProperties: false };
function defineTool(name, description, properties, required = []) {
  return { name, description, inputSchema: { type: "object", properties, required, additionalProperties: false } };
}
var workspaceOperationSchemas = [
  { properties: { operation: { const: "set-mainline" } }, required: ["operation", "projectBrief", "mainline"], not: { anyOf: [{ required: ["changeReason"] }, { required: ["archiveReset"] }] } },
  { properties: { operation: { const: "initialize" } }, required: ["operation", "mainline"], not: { anyOf: [{ required: ["changeReason"] }, { required: ["archiveReset"] }] } },
  { properties: { operation: { const: "initialize" }, archiveReset: { const: true } }, required: ["operation", "mainline", "archiveReset"], not: { required: ["changeReason"] } }
];
function workspaceMutationTool() {
  return defineTool(
    "manage_dove_workspace",
    "Set the current project research mainline immediately for an explicit /dove:workspace request, preserving prior revisions when replacing it. Also supports explicit archive reset for unsupported workspace state.",
    {
      operation: { type: "string", enum: ["set-mainline", "initialize"], description: "Use set-mainline with mainline for the ordinary command; it initializes an absent workspace or revises a current one without confirmation. Initialize without archiveReset is the lower-level confirmed initialization surface; initialize with archiveReset=true archives unsupported state before creating a current workspace." },
      projectBrief: { type: "string", minLength: 1, maxLength: 1e3, description: "Required for set-mainline. One brief user-visible prose introduction to the project's overall situation and structure; do not include evidence, risk, or choice lists." },
      mainline: { type: "string", minLength: 1, maxLength: 240, pattern: "^[^\\r\\n]+$", description: "Required for set-mainline and archive reset. For set-mainline, use one concise title-like line." },
      changeReason: { type: "string", minLength: 1, description: "Not accepted on the ordinary set-mainline surface; Dove records a service-owned revision reason." },
      archiveReset: { type: "boolean", description: "Set to true only with initialize when explicitly archiving an unsupported workspace before replacement." }
    }
  );
}
var researchDecisionFields = ["requestedDisposition", "synthesis", "hypotheses", "routes", "openQuestions", "evidenceRefs", "reasonCodes", "nextAction"];
var skillStartOnlyFields = ["skill", "contextArtifactPaths"];
var missionCreationFields = ["mode", "goal", "requirements", "assumptions", "scope", "outOfScope", "artifacts", "completionCriteria", "evidenceRequirements", "dependsOnMissionNumbers"];
var missionOperationSchemas = [
  {
    properties: { operation: { const: "start-skill" } },
    required: ["operation", "skill", "goal"],
    not: { anyOf: ["missionNumber", "missionGoal", "mode", "dependsOnMissionNumbers", "branchKind", "branchReason", "stopParentReason", "handoffArtifactPaths", ...researchDecisionFields].map((field) => ({ required: [field] })) }
  },
  {
    properties: { operation: { const: "reevaluate-research-decision" } },
    required: ["operation", "missionNumber", ...researchDecisionFields],
    not: { anyOf: [...missionCreationFields, "parentMissionNumber", ...skillStartOnlyFields, "branchKind", "branchReason", "stopParentReason", "handoffArtifactPaths"].map((field) => ({ required: [field] })) }
  },
  {
    properties: { operation: { const: "create-root" } },
    required: ["operation", "mode", "goal"],
    not: { anyOf: ["missionNumber", "missionGoal", "parentMissionNumber", ...skillStartOnlyFields, "branchKind", "branchReason", "stopParentReason", "handoffArtifactPaths", ...researchDecisionFields].map((field) => ({ required: [field] })) }
  },
  {
    properties: { operation: { const: "branch" } },
    required: ["operation", "mode", "goal", "parentMissionNumber", "branchKind", "branchReason"],
    not: { anyOf: ["missionNumber", "missionGoal", ...skillStartOnlyFields, ...researchDecisionFields].map((field) => ({ required: [field] })) }
  }
];
function missionMutationTool() {
  return defineTool(
    "create_dove_mission",
    "Create a root or child mission with explicit mode, or append one evidence-bound reevaluation to an existing research mission selected by its exact one-based mission number from query_dove_status. Use research when work changes research understanding, experiments, evidence, or paper claims; use ordinary for clear code, documentation, configuration, cleanup, or another bounded deliverable.",
    missionReplayProps
  );
}
var toolDiscoveryInputSchema = { type: "object", properties: {}, additionalProperties: false };
var operationSchemaParts = [
  workspaceMutationTool(),
  missionMutationTool(),
  defineTool("create_ambient_dove_mission", "Create one focused mission with explicit mode. Research changes understanding, experiments, evidence, or paper claims; ordinary covers clear code, documentation, configuration, cleanup, or another bounded deliverable. Both must align with the current Workspace mainline. If supplied, evidenceRequirements entries use artifact:<path> or validation:<path>.", ambientMissionProps, ["mode", "goal", "mainlineAlignment", "changesWorkspaceMainline"]),
  defineTool("query_dove_mission", "Preview a proposed mission with explicit ordinary or research mode, requirements, scope, artifacts, completion conditions, evidence needs, and optional parent mission.", { mode: missionMode, goal: { type: "string", minLength: 1 }, ...missionContractProps, dependsOnMissionNumbers: { type: "array", items: publicNumber }, parentMissionNumber: publicNumber, branchKind: { type: "string", enum: ["continuation", "alternative", "follow-up", "recovery"] }, branchReason: { type: "string", minLength: 1 } }, ["mode", "goal"]),
  defineTool("query_dove_status", "Review current missions, requirements, research, outputs, evidence, reviews, and remaining gaps. Use missionNumber for details about one exact mission shown in status.", { missionNumber: publicNumber, detail: { type: "string", enum: ["compact", "full"] }, language: { type: "string", enum: ["zh", "en"] } }),
  defineTool("ingest_execution_receipt", "Add supplied outputs, checks, and completion evidence to one mission.", { receiptId: safeId12, missionNumber: publicNumber, contractDigest: { type: "string", pattern: "^[0-9a-f]{64}$" }, summary: { type: "string", minLength: 1 }, artifacts: { type: "array", minItems: 1, items: receiptArtifactSchema }, validations: { type: "array", items: receiptValidationSchema }, criteriaSatisfied: { type: "array", items: receiptCriterionSchema }, producedAt: { type: "string", minLength: 1 } }, ["receiptId", "missionNumber", "contractDigest", "summary", "artifacts", "validations", "criteriaSatisfied", "producedAt"]),
  defineTool("close_host_outcome", "Record one explicitly identified attempt at ordinary work. Include substantive files when produced, or concrete execution facts explicitly bound to current completion criteria for a no-file outcome. Reusing the same attemptId is an exact immutable replay; use a new attemptId for a later retry.", { missionNumber: publicNumber, attemptId: safeId12, status: { type: "string", enum: ["completed", "stopped", "blocked", "failed"] }, summary: { type: "string", minLength: 1 }, artifactPaths: { ...strings6, description: "Optional substantive files produced or changed by the work." }, validationPaths: { ...strings6, description: "Optional separate host-observed validation output files. Omit this field for in-place checks, and never repeat an artifactPaths entry. These are recorded as incomplete static observations and cannot substitute for independent review." }, facts: { type: "array", items: hostFactSchema, description: "Concrete execution observations with explicit one-based completion-criterion bindings. Required when artifactPaths is empty; do not use scientific conclusions." } }, ["missionNumber", "attemptId", "status", "summary"]),
  defineTool("record_research_outcome", "Record one explicitly identified research execution attempt as a single immutable receipt. The current research decision remains unchanged and must later consume the receipt through research reevaluation. This tool records execution facts only and does not interpret hypotheses, routes, or claims.", { missionNumber: publicNumber, decisionRevision: publicNumber, attemptId: safeId12, status: { type: "string", enum: ["completed", "stopped", "aborted", "blocked", "failed"] }, performedActionCount: { type: "integer", minimum: 0 }, actualUsage: { ...researchUsageSchema, description: "Report non-negative integer usage within the closure request budget; actions must equal performedActionCount." }, evidenceReturned: { ...strings6, description: "Use only the expected-evidence labels from the current closure request." }, artifactPaths: { ...strings6, description: "Existing non-empty project-relative files produced or used as substantive returned artifacts." }, validationPaths: { ...strings6, description: "Existing non-empty project-relative files containing separate validation output; do not repeat artifactPaths entries." }, facts: { ...strings6, description: "Concrete execution observations only, one string per fact. Do not report scientific conclusions or encode evidence labels here." }, startedAt: { ...researchOutcomeTimestamp, description: "ISO-8601 UTC execution start within the current closure request time window." }, finishedAt: { ...researchOutcomeTimestamp, description: "ISO-8601 UTC execution finish within the current closure request time window and not before startedAt." } }, ["missionNumber", "decisionRevision", "attemptId", "status", "performedActionCount", "actualUsage", "evidenceReturned", "artifactPaths", "validationPaths", "facts", "startedAt", "finishedAt"]),
  defineTool("assess_mission_completion", "Check whether one mission meets its stated outputs, completion conditions, evidence needs, dependencies, and review requirements.", { missionNumber: publicNumber }, ["missionNumber"]),
  defineTool("query_sources", "Review source candidates or rejections for one mission and whether they are currently usable.", { missionNumber: publicNumber, sourceId: safeId12, lifecycle: { type: "string", enum: ["candidate", "rejected"] }, limit: { type: "number" } }, ["missionNumber"]),
  defineTool("read_dove_lessons", "Read the complete canonical advisory Lessons Markdown document without writing.", {}),
  defineTool("update_dove_lessons", "Replace the complete canonical advisory Lessons Markdown document using the exact binding from a preceding read. Lessons are not evidence, scientific endorsement, or completion proof.", lessonsUpdateProps, ["binding", "markdown"]),
  defineTool("register_source", "Add a source candidate to one mission from real captured external material. Registration does not verify the source.", { missionNumber: publicNumber, sourceId: safeId12, citationKey: { type: "string" }, title: { type: "string" }, authors: strings6, year: { type: ["string", "number"] }, locator: { type: "string" }, sourceType: { type: "string" }, abstract: { type: "string" }, origin: { type: "string" }, capturePath: { type: "string", minLength: 1 } }, ["missionNumber", "sourceId", "capturePath"]),
  defineTool("verify_source", "Record why a source candidate must be rejected for one mission. This tool does not approve sources.", { missionNumber: publicNumber, sourceId: safeId12, method: { type: "string", minLength: 1 }, checkedMaterial: { type: "string", minLength: 1 }, auditEvidence: { type: "array", minItems: 1, items: { type: "object", properties: { reference: { type: "string", minLength: 1 }, kind: { type: "string", minLength: 1 }, observation: { type: "string", minLength: 1 } }, required: ["reference", "kind", "observation"], additionalProperties: false } } }, ["missionNumber", "sourceId", "method", "checkedMaterial", "auditEvidence"]),
  defineTool("upsert_claims", "Record bounded claims using current Source, artifact, validation, or optional exact Experiment measurement evidence.", { missionNumber: publicNumber, claims: { type: "array", minItems: 1, items: { type: "object", properties: { claimId: safeId12, text: { type: "string", minLength: 1 }, sourceIds: { type: "array", items: safeId12 }, artifactRefs: strings6, validationRefs: strings6, ...claimContractProps }, required: ["claimId", "text", "sourceIds", "artifactRefs", "validationRefs", ...Object.keys(claimContractProps)], additionalProperties: false } } }, ["missionNumber", "claims"]),
  defineTool("run_experience_workflow", "Freeze a general formal Experiment protocol, then record its immutable result with measurements, references, denominator, failures, deviations, and limitations. This endpoint does not run experiments or establish independent scientific endorsement.", { missionNumber: publicNumber, experimentId: safeId12, title: { type: "string" }, protocol: experimentProtocolSchema, result: experimentResultSchema }, ["missionNumber", "experimentId", "protocol"]),
  defineTool("record_draft_archive", "Archive one current mission-owned project draft and its current references while keeping the substantive project artifact in place.", archiveProps, ["missionNumber", "artifactPath", "referencePaths", "qa", "findings"]),
  defineTool("record_figure_archive", "Archive one current mission-owned project figure, caption, references, QA, and findings while keeping the project artifact in place and without requiring Review coverage.", { ...archiveProps, caption: { type: "string", minLength: 1 } }, ["missionNumber", "artifactPath", "referencePaths", "qa", "findings", "caption"]),
  defineTool("scope_review_record", "Freeze an explicit current mission-readable artifact scope without writing, then return a machine-only request for one dedicated native Reviewer launch.", { missionNumber: publicNumber, reviewMissionBinding: { type: "string", pattern: "^review-mission-v1-[0-9a-f]{64}$", description: "Pass the exact opaque binding from the Review Skill start hostControl." }, hostKind: { type: "string", enum: ["claude", "opencode"] }, artifactPaths: { ...strings6, minItems: 1 } }, ["missionNumber", "reviewMissionBinding", "hostKind", "artifactPaths"]),
  defineTool("archive_review_record", "Atomically archive one dedicated Reviewer's structured return for the exact frozen scope. The record is non-authoritative and its id is derived by Dove.", { missionNumber: publicNumber, scopeBinding: reviewScopeBindingSchema, status: { type: "string", enum: ["completed", "blocked", "failed"] }, verdict: { type: "string", enum: ["coherent", "needs-revision", "needs-evidence", "blocked"] }, summary: { type: "string", minLength: 1 }, findings: { type: "array", items: reviewFindingSchema }, actionItems: strings6, report: { type: "string", minLength: 1 }, provenance: reviewProvenanceSchema }, ["missionNumber", "scopeBinding", "status", "verdict", "summary", "findings", "actionItems", "report", "provenance"]),
  defineTool("record_rebuttal_archive", "Archive one current mission-owned project rebuttal and preserved current finding references while keeping the project artifact in place and without claiming Reviewer agreement.", { ...archiveProps, findingRefs: { ...strings6, minItems: 1 } }, ["missionNumber", "artifactPath", "referencePaths", "qa", "findings", "findingRefs"])
];
var schemaPartByName = new Map(operationSchemaParts.map((tool) => [tool.name, tool]));
function schemaPart(name) {
  const part = schemaPartByName.get(name);
  if (!part) throw new Error(`Unknown internal operation schema part: ${name}`);
  return part;
}
function mergedProperties(names, operationValues = []) {
  return {
    ...Object.assign({}, ...names.map((name) => schemaPart(name).inputSchema.properties)),
    ...operationValues.length > 0 ? { operation: { type: "string", enum: operationValues } } : {}
  };
}
function operationBranch(operation, required, allowed2, allFields) {
  const forbidden = allFields.filter((field) => field !== "operation" && !allowed2.includes(field));
  return {
    properties: { operation: { const: operation } },
    required: ["operation", ...required],
    ...forbidden.length > 0 ? { not: { anyOf: forbidden.map((field) => ({ required: [field] })) } } : {}
  };
}
function canonicalTool(name, description, sourceNames, operations = null) {
  const properties = mergedProperties(sourceNames, operations?.map((entry) => entry.operation) ?? []);
  return defineTool(name, description, properties, operations ? [] : schemaPart(sourceNames[0]).inputSchema.required);
}
var missionPreviewFields = ["mode", "goal", ...Object.keys(missionContractProps), "dependsOnMissionNumbers", "parentMissionNumber", "branchKind", "branchReason"];
var missionAllFields = Object.keys({ operation: true, ...missionReplayProps });
var missionCanonicalSchemas = [
  operationBranch("query", ["mode", "goal"], missionPreviewFields, missionAllFields),
  ...missionOperationSchemas
];
var statusFields = ["missionNumber", "detail", "language"];
var sourceQueryFields = ["missionNumber", "sourceId", "lifecycle", "limit"];
var sourceRegisterFields = Object.keys(schemaPart("register_source").inputSchema.properties);
var sourceRejectFields = Object.keys(schemaPart("verify_source").inputSchema.properties);
var lessonReadFields = Object.keys(schemaPart("read_dove_lessons").inputSchema.properties);
var lessonUpdateFields = Object.keys(lessonsUpdateProps);
var reviewScopeFields = Object.keys(schemaPart("scope_review_record").inputSchema.properties);
var reviewArchiveFields = Object.keys(schemaPart("archive_review_record").inputSchema.properties);
var toolDefinitions = [
  workspaceMutationTool(),
  canonicalTool("manage_dove_mission", "Query, start one directly invoked research Skill, create, branch, or reevaluate one Dove mission. Creation uses explicit mode: research covers changed understanding, experiments, evidence, or paper claims; ordinary covers code, documentation, configuration, cleanup, or another bounded deliverable. A Slash Skill start is directly authorized and creates a server-owned root or ordinary child without stopping its parent; explicit branch retains its stop and handoff behavior. Existing-work reevaluation uses the exact one-based mission number from query_dove_status.", ["create_dove_mission", "query_dove_mission"], missionCanonicalSchemas.map((schema, index) => ({ operation: ["query", "start-skill", "reevaluate-research-decision", "create-root", "branch"][index], schema }))),
  canonicalTool("query_dove_status", "Review current missions, requirements, research, outputs, evidence, reviews, and remaining gaps, or assess completion for one exact mission. Use missionNumber only for details about one mission shown in status.", ["query_dove_status", "assess_mission_completion"], [{ operation: "status" }, { operation: "completion" }]),
  canonicalTool("manage_dove_sources", "Query, register, or reject mission-bound captured source material. Registration creates a candidate; rejection never mints positive trust.", ["query_sources", "register_source", "verify_source"], [{ operation: "query" }, { operation: "register" }, { operation: "reject" }]),
  canonicalTool("record_dove_experiment", "Freeze a general formal experiment protocol or record its evidence-backed immutable result with measurements, the full denominator, failures, deviations, and limitations. This endpoint does not run experiments or substitute for independent review.", ["run_experience_workflow"]),
  canonicalTool("record_dove_claims", "Record bounded claims using current Source, artifact, validation, or optional exact Experiment measurement evidence.", ["upsert_claims"]),
  canonicalTool("record_dove_draft", "Archive a current mission-owned project draft and references while keeping the substantive project artifact in place.", ["record_draft_archive"]),
  canonicalTool("record_dove_figure", "Archive a current mission-owned project figure with caption, references, QA, and findings while keeping the project artifact in place and without requiring Review coverage.", ["record_figure_archive"]),
  canonicalTool("manage_dove_review", "Scope one exact frozen artifact boundary without writing, or atomically archive the structured return from one dedicated native fresh read-only Reviewer. Dove does not establish reviewer identity, authority, sign-off, or acceptance.", ["scope_review_record", "archive_review_record"], [{ operation: "scope" }, { operation: "archive" }]),
  canonicalTool("record_dove_rebuttal", "Archive a current mission-owned project rebuttal with preserved current findings and no claim of Reviewer agreement.", ["record_rebuttal_archive"]),
  canonicalTool("manage_dove_lessons", "Read or replace the complete canonical advisory Lessons Markdown document. Update requires the exact binding from a preceding read and does not create a Mission.", ["read_dove_lessons", "update_dove_lessons"], [{ operation: "read" }, { operation: "update" }]),
  schemaPart("create_ambient_dove_mission"),
  schemaPart("close_host_outcome"),
  schemaPart("record_research_outcome")
];
var operationSchemasByTool = /* @__PURE__ */ new Map([
  ["manage_dove_workspace", workspaceOperationSchemas],
  ["manage_dove_mission", missionCanonicalSchemas],
  ["query_dove_status", [
    operationBranch("status", [], statusFields, ["operation", ...statusFields]),
    operationBranch("completion", ["missionNumber"], ["missionNumber"], ["operation", ...statusFields])
  ]],
  ["manage_dove_sources", [
    operationBranch("query", ["missionNumber"], sourceQueryFields, ["operation", .../* @__PURE__ */ new Set([...sourceQueryFields, ...sourceRegisterFields, ...sourceRejectFields])]),
    operationBranch("register", ["missionNumber", "sourceId", "capturePath"], sourceRegisterFields, ["operation", .../* @__PURE__ */ new Set([...sourceQueryFields, ...sourceRegisterFields, ...sourceRejectFields])]),
    operationBranch("reject", ["missionNumber", "sourceId", "method", "checkedMaterial", "auditEvidence"], sourceRejectFields, ["operation", .../* @__PURE__ */ new Set([...sourceQueryFields, ...sourceRegisterFields, ...sourceRejectFields])])
  ]],
  ["manage_dove_review", [
    operationBranch("scope", ["missionNumber", "reviewMissionBinding", "hostKind", "artifactPaths"], reviewScopeFields, ["operation", .../* @__PURE__ */ new Set([...reviewScopeFields, ...reviewArchiveFields])]),
    operationBranch("archive", ["missionNumber", "scopeBinding", "status", "verdict", "summary", "findings", "actionItems", "report", "provenance"], reviewArchiveFields, ["operation", .../* @__PURE__ */ new Set([...reviewScopeFields, ...reviewArchiveFields])])
  ]],
  ["manage_dove_lessons", [
    operationBranch("read", [], lessonReadFields, ["operation", ...lessonUpdateFields]),
    operationBranch("update", ["binding", "markdown"], lessonUpdateFields, ["operation", ...lessonUpdateFields])
  ]]
]);
var TOOL_OPERATION_SCHEMAS = operationSchemasByTool;
var TOOL_INPUT_SCHEMAS = new Map(toolDefinitions.map((tool) => [tool.name, tool.inputSchema]));

// src/mcp/schema-validation.mjs
function isPlainObject2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function valueTypeMatches(value, type) {
  if (type === "null") {
    return value === null;
  }
  if (type === "array") {
    return Array.isArray(value);
  }
  if (type === "object") {
    return isPlainObject2(value);
  }
  if (type === "integer") {
    return Number.isInteger(value);
  }
  if (type === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  return typeof value === type;
}
function expectedTypeLabel(type) {
  return Array.isArray(type) ? type.join(" or ") : type;
}
function childPath(inputPath, key) {
  return /^[$A-Z_a-z][$0-9A-Z_a-z]*$/u.test(key) ? `${inputPath}.${key}` : `${inputPath}[${JSON.stringify(key)}]`;
}
function validateSchemaValue(value, schema, inputPath) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return null;
  }
  if (Array.isArray(schema.allOf)) {
    for (const branch of schema.allOf) {
      const error = validateSchemaValue(value, branch, inputPath);
      if (error) {
        return error;
      }
    }
  }
  if (schema.if) {
    const conditionError = validateSchemaValue(value, schema.if, inputPath);
    const branch = conditionError ? schema.else : schema.then;
    if (branch) {
      const error = validateSchemaValue(value, branch, inputPath);
      if (error) {
        return error;
      }
    }
  }
  if (Array.isArray(schema.anyOf)) {
    const errors = schema.anyOf.map((branch) => validateSchemaValue(value, branch, inputPath));
    if (errors.every(Boolean)) {
      return errors.at(-1) ?? `${inputPath} does not match any allowed schema.`;
    }
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.map((branch) => validateSchemaValue(value, branch, inputPath)).filter((error) => !error).length;
    if (matches !== 1) {
      return `${inputPath} must match exactly one allowed schema.`;
    }
  }
  if (schema.not && !validateSchemaValue(value, schema.not, inputPath)) {
    return `${inputPath} matches a forbidden schema.`;
  }
  if (schema.const !== void 0 && !Object.is(value, schema.const)) {
    return `${inputPath} must equal ${JSON.stringify(schema.const)}.`;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => Object.is(item, value))) {
    return `${inputPath} must be one of: ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}.`;
  }
  if (schema.type !== void 0) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => valueTypeMatches(value, type))) {
      return `${inputPath} must be ${expectedTypeLabel(schema.type)}.`;
    }
  }
  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      return `${inputPath} must contain at least ${schema.minLength} character(s).`;
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      return `${inputPath} must contain at most ${schema.maxLength} character(s).`;
    }
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) {
      return `${inputPath} does not match the required pattern.`;
    }
  }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      return `${inputPath} must be at least ${schema.minimum}.`;
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      return `${inputPath} must be at most ${schema.maximum}.`;
    }
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      return `${inputPath} must contain at least ${schema.minItems} item(s).`;
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      return `${inputPath} must contain at most ${schema.maxItems} item(s).`;
    }
    if (schema.items) {
      for (let index = 0; index < value.length; index += 1) {
        const error = validateSchemaValue(value[index], schema.items, `${inputPath}[${index}]`);
        if (error) {
          return error;
        }
      }
    }
  }
  if (isPlainObject2(value)) {
    const properties = isPlainObject2(schema.properties) ? schema.properties : {};
    if (Array.isArray(schema.required)) {
      const missing = schema.required.find((key) => !Object.hasOwn(value, key));
      if (missing) {
        return `${childPath(inputPath, missing)} is required.`;
      }
    }
    if (schema.additionalProperties === false) {
      const unknown = Object.keys(value).find((key) => !Object.hasOwn(properties, key));
      if (unknown) {
        return `${childPath(inputPath, unknown)} is not allowed.`;
      }
    }
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (!Object.hasOwn(value, key)) {
        continue;
      }
      const error = validateSchemaValue(value[key], propertySchema, childPath(inputPath, key));
      if (error) {
        return error;
      }
    }
  }
  return null;
}
function assertMcpInputSchema(name, args, schema) {
  const error = validateSchemaValue(args, schema, "$");
  if (error) {
    throw new Error(`${name} input is invalid: ${error}`);
  }
}

// src/mcp/handlers.mjs
function textResult(envelope2, { isError = false, language = DEFAULT_DOVE_RESPONSE_LANGUAGE } = {}) {
  if (!isPlainObject3(envelope2?.report) || !isPlainObject3(envelope2?.hostControl) || !isPlainObject3(envelope2.hostControl.presentation)) {
    throw new Error("MCP public output requires a sealed report, presentation, and hostControl envelope.");
  }
  const rendered = envelope2.hostControl.presentation.mode === "silent" ? "" : renderPublicReport(envelope2.report, { language });
  return {
    content: rendered ? [{ type: "text", text: rendered }] : [],
    structuredContent: envelope2,
    ...isError ? { isError: true } : {}
  };
}
function isPlainObject3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function dispatchData(root, name, args) {
  switch (name) {
    case "manage_dove_workspace":
      return manageDoveWorkspace(root, args);
    case "create_dove_mission":
      return createDoveMission(root, args);
    case "start_dove_skill_mission":
      return startDoveSkillMission(root, args);
    case "reevaluate_research_decision":
      return reevaluateResearchDecision(root, args);
    case "query_dove_mission":
      return queryDoveMission(root, args);
    case "query_dove_status":
      return queryDoveStatus(root, args);
    case "assess_mission_completion":
      return assessMissionCompletion(root, args);
    case "close_host_outcome":
      return closeHostOutcome(root, args);
    case "record_research_outcome":
      return recordResearchOutcome(root, args);
    case "query_sources":
      return querySources(root, args);
    case "read_dove_lessons":
      return readDoveLessons(root, args);
    case "update_dove_lessons":
      return updateDoveLessons(root, args);
    case "register_source":
      return registerSource(root, args);
    case "verify_source":
      return verifySource(root, args);
    case "upsert_claims":
      return upsertClaims(root, args);
    case "run_experience_workflow":
      return runExperienceWorkflow(root, args);
    case "record_dove_draft":
      return recordDoveDraft(root, args);
    case "record_dove_figure":
      return recordDoveFigure(root, args);
    case "scope_review_record":
      return scopeReviewRecord(root, args);
    case "archive_review_record":
      return archiveReviewRecord(root, args);
    case "record_dove_rebuttal":
      return recordDoveRebuttal(root, args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
function invokeMutation(root, name, callback) {
  const existing = currentMutationContext(root);
  if (existing) return { data: callback(existing), committed: false };
  return {
    data: runWithMutationContext(root, {
      actionId: name.replaceAll("_", "-"),
      mutationMode: "direct-process",
      hostId: "mcp"
    }, callback),
    committed: true
  };
}
function missionRelationshipArgs(root, args) {
  const result = { ...args };
  if (Object.hasOwn(result, "dependsOnMissionNumbers")) {
    result.dependsOnMissionIds = result.dependsOnMissionNumbers.map((missionNumber) => resolveMissionNumber(root, missionNumber, { operation: "Dove mission dependency selection" }).missionId);
    delete result.dependsOnMissionNumbers;
  }
  if (Object.hasOwn(result, "parentMissionNumber")) {
    const parent = resolveMissionNumber(root, result.parentMissionNumber, { operation: "Dove parent mission selection" });
    result.parentMissionId = parent.missionId;
    delete result.parentMissionNumber;
  }
  return result;
}
function coreCheckpointArgs(root, name, args) {
  if (name !== "create_dove_mission") return args;
  if (typeof args.goal !== "string" || !args.goal) {
    throw new Error("Mission creation requires a goal.");
  }
  return { ...missionRelationshipArgs(root, args), missionId: newMissionId() };
}
function checkpointProposal(root, name, args) {
  return dispatchData(root, name, { ...coreCheckpointArgs(root, name, args), mutationMode: "direct-process" });
}
function applyCheckpoint(root, name, args, proposal) {
  const confirmArgs2 = proposal?.confirmation?.confirmArgs;
  if (!isPlainObject3(confirmArgs2)) throw new Error(`${name} did not return private exact replay data.`);
  return invokeMutation(root, name, () => dispatchData(root, name, confirmArgs2));
}
function normalizeApprovalAction(value) {
  if (value === "accept" || value === "decline" || value === "cancel") return value;
  throw new Error("Checkpoint approval returned an unsupported action.");
}
function publicCheckpointProposalError(name, args, error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/\.dove\/|\b(?:proposal(?:Digest|Workspace|Version|Token)|confirmArgs|mutationMode|MutationContext|workspaceId|sourceTreeDigest|archiveTarget)\b/u.test(message)) {
    return new Error("The checkpoint could not be prepared because its validated workspace state is not current.");
  }
  return new Error(message);
}
function checkpointApplyError() {
  return new Error("The approved checkpoint could not be applied because its validated inputs or workspace state changed.");
}
function projectInvocation(root, projectorName, data, operation, options = {}) {
  return publicResult(projectorName, data, classifyInvocationOutcome(data, operation, options.invocationArgs ?? data), {
    operation,
    includeTechnicalAppendix: projectorName === "query_dove_status" && data?.detail === "full",
    callbackRoot: root,
    ...options.callbackResolvers ? { callbackResolvers: options.callbackResolvers } : {},
    ...options.selector ? { selector: options.selector } : {}
  });
}
function projectAmbientMissionBeforeCommit(root, name, data, operation, context, options = {}) {
  context.requireCommitPrecondition(ARTIFACT_PATHS.missionsDir);
  const missionNumber = publicMissionNumberForCandidate(root, data.mission, { operation: "Mission result selector preparation" });
  const injectedMissionNumber = options.callbackResolvers?.missionNumber;
  const callbackResolvers = {
    missionNumber: (missionId2) => {
      if (missionId2 !== data.mission.missionId) throw new Error("Mission callback projection does not bind the created candidate.");
      const resolved = typeof injectedMissionNumber === "function" ? injectedMissionNumber(missionId2) : missionNumber;
      if (resolved !== missionNumber) throw new Error("Mission callback and result selector do not bind the same public mission.");
      return resolved;
    }
  };
  return projectInvocation(root, name, data, operation, {
    callbackResolvers,
    ...data.operation === "start-skill" ? { selector: { missionNumber } } : {}
  });
}
function resolveCheckpointPostCommit(root, applied, data) {
  return resolveExecutionReceiptPostCommit(root, data, { committed: applied.committed });
}
function routedInvocation(operation, args) {
  const route = operationRoute(operation, args);
  const targetName = operationTargetTool(operation, args);
  const projectorName = operationPublicProjector(operation, args);
  const targetArgs = { ...args, ...route?.fixedArgs ?? {} };
  if (route && !["create_dove_mission", "start_dove_skill_mission", "reevaluate_research_decision"].includes(targetName)) delete targetArgs.operation;
  return { targetName, projectorName, targetArgs };
}
function executeTool(root, name, args, options = {}) {
  const operation = operationForTool(name);
  const interaction = operationInteraction(operation, args);
  const { targetName, projectorName, targetArgs } = routedInvocation(operation, args);
  const project = (data, projectionOptions = {}) => projectInvocation(root, projectorName, data, operation, { invocationArgs: args, ...projectionOptions });
  if (name === "manage_dove_workspace" && args.operation === "set-mainline") {
    const invoked2 = invokeMutation(root, name, () => manageDoveWorkspace(root, targetArgs));
    return project(resolveExecutionReceiptPostCommit(root, invoked2.data, { committed: invoked2.committed }));
  }
  if (name === "create_ambient_dove_mission" || targetName === "start_dove_skill_mission") {
    const invoked2 = invokeMutation(root, name, (context) => {
      const data = targetName === "start_dove_skill_mission" ? startDoveSkillMission(root, targetArgs) : createAmbientDoveMission(root, targetArgs);
      return {
        data,
        publicEnvelope: projectAmbientMissionBeforeCommit(root, projectorName, data, operation, context, options)
      };
    });
    resolveExecutionReceiptPostCommit(root, invoked2.data.data, { committed: invoked2.committed });
    return invoked2.data.publicEnvelope;
  }
  if (operationRequiresCheckpoint(operation, args)) {
    let proposal;
    try {
      proposal = checkpointProposal(root, targetName, targetArgs);
    } catch (error) {
      throw publicCheckpointProposalError(name, args, error);
    }
    const approval = publicResult(projectorName, proposal, classifyInvocationOutcome(proposal, operation, args), { operation }).report.approval;
    if (!approval) throw new Error(`${name} did not return a public approval card.`);
    if (typeof options.requestCheckpointApproval !== "function") throw new Error("This Dove checkpoint requires an MCP client with elicitation support.");
    return Promise.resolve(options.requestCheckpointApproval(approval)).then((value) => {
      const action = normalizeApprovalAction(value);
      if (action !== "accept") {
        const data = { status: action === "decline" ? "declined" : "cancelled", zeroWrite: true, message: "No changes were made.", approval };
        return project(data);
      }
      let applied;
      try {
        applied = applyCheckpoint(root, targetName, targetArgs, proposal);
      } catch {
        throw checkpointApplyError();
      }
      const resolvePostCommit = (data) => resolveCheckpointPostCommit(root, applied, data);
      if (applied.data && typeof applied.data.then === "function") {
        return applied.data.then((data) => project(resolvePostCommit(data))).catch(() => {
          throw checkpointApplyError();
        });
      }
      return project(resolvePostCommit(applied.data));
    });
  }
  if (interaction === "read") {
    const data = dispatchData(root, targetName, targetArgs);
    return data && typeof data.then === "function" ? data.then((value) => project(value)) : project(data);
  }
  const invoked = invokeMutation(root, name, () => dispatchData(root, targetName, targetName === "reevaluate_research_decision" ? prepareResearchDecisionReevaluation(root, targetArgs) : targetArgs));
  if (invoked.data && typeof invoked.data.then === "function") {
    return invoked.data.then((data) => project(resolveExecutionReceiptPostCommit(root, data, { committed: invoked.committed })));
  }
  return project(resolveExecutionReceiptPostCommit(root, invoked.data, { committed: invoked.committed }));
}
function hostFile(root, value, label) {
  return normalizeHostWorkspaceFilePath(root, value, label);
}
function hostFiles(root, values, label) {
  return Array.isArray(values) ? values.map((value, index) => hostFile(root, value, `${label}[${index}]`)) : values;
}
function hostArtifact(root, value, label) {
  return normalizeHostWorkspaceArtifactPath(root, value, label);
}
function typedEvidence2(root, reference, label) {
  if (typeof reference !== "string") return reference;
  for (const prefix of ["source:"]) if (reference.startsWith(prefix)) return reference;
  for (const prefix of ["artifact:", "validation:"]) {
    if (reference.startsWith(prefix)) return `${prefix}${hostFile(root, reference.slice(prefix.length), label)}`;
  }
  return hostFile(root, reference, label);
}
function typedEvidenceList(root, values, label) {
  return Array.isArray(values) ? values.map((value, index) => typedEvidence2(root, value, `${label}[${index}]`)) : values;
}
function missionEvidence(root, reference, label) {
  if (typeof reference !== "string") return reference;
  for (const prefix of ["source:"]) if (reference.startsWith(prefix)) return reference;
  for (const prefix of ["artifact:", "validation:"]) {
    if (reference.startsWith(prefix)) return `${prefix}${hostArtifact(root, reference.slice(prefix.length), label)}`;
  }
  return reference;
}
function missionEvidenceList(root, values, label) {
  return Array.isArray(values) ? values.map((value, index) => missionEvidence(root, value, `${label}[${index}]`)) : values;
}
function findingReference(root, reference, label) {
  if (typeof reference !== "string") return reference;
  const separator = reference.lastIndexOf("#");
  if (separator <= 0 || separator === reference.length - 1) return reference;
  return `${hostFile(root, reference.slice(0, separator), label)}#${reference.slice(separator + 1)}`;
}
function normalizeHostPathInputs(root, name, args) {
  const result = structuredClone(args);
  switch (name) {
    case "register_source":
      if (result.capturePath !== void 0) result.capturePath = hostFile(root, result.capturePath, "capturePath");
      break;
    case "ingest_execution_receipt":
      if (Array.isArray(result.artifacts)) result.artifacts = result.artifacts.map((item, index) => ({ ...item, path: hostFile(root, item.path, `artifacts[${index}].path`) }));
      if (Array.isArray(result.validations)) result.validations = result.validations.map((item, index) => ({ ...item, reference: hostFile(root, item.reference, `validations[${index}].reference`) }));
      if (Array.isArray(result.criteriaSatisfied)) result.criteriaSatisfied = result.criteriaSatisfied.map((item, index) => ({ ...item, evidenceRefs: typedEvidenceList(root, item.evidenceRefs, `criteriaSatisfied[${index}].evidenceRefs`) }));
      break;
    case "close_host_outcome": {
      result.artifactPaths = hostFiles(root, result.artifactPaths, "artifactPaths");
      const artifactPaths = new Set(result.artifactPaths ?? []);
      result.validationPaths = hostFiles(root, result.validationPaths, "validationPaths")?.filter((validationPath) => !artifactPaths.has(validationPath));
      break;
    }
    case "record_research_outcome": {
      result.artifactPaths = hostFiles(root, result.artifactPaths, "artifactPaths");
      const artifactPaths = new Set(result.artifactPaths ?? []);
      result.validationPaths = hostFiles(root, result.validationPaths, "validationPaths")?.filter((validationPath) => !artifactPaths.has(validationPath));
      break;
    }
    case "upsert_claims":
      if (Array.isArray(result.claims)) result.claims = result.claims.map((item, index) => ({
        ...item,
        artifactRefs: hostFiles(root, item.artifactRefs, `claims[${index}].artifactRefs`),
        validationRefs: hostFiles(root, item.validationRefs, `claims[${index}].validationRefs`)
      }));
      break;
    case "run_experience_workflow":
      if (result.result) {
        result.result.artifactRefs = hostFiles(root, result.result.artifactRefs, "result.artifactRefs");
        result.result.validationRefs = hostFiles(root, result.result.validationRefs, "result.validationRefs");
        result.result.failures = result.result.failures?.map((item, index) => ({ ...item, evidenceRefs: typedEvidenceList(root, item.evidenceRefs, `result.failures[${index}].evidenceRefs`) }));
      }
      break;
    case "record_dove_draft":
    case "record_dove_figure":
    case "record_dove_rebuttal":
      result.artifactPath = hostFile(root, result.artifactPath, "artifactPath");
      result.referencePaths = hostFiles(root, result.referencePaths, "referencePaths");
      if (Array.isArray(result.findingRefs)) result.findingRefs = result.findingRefs.map((value, index) => findingReference(root, value, `findingRefs[${index}]`));
      break;
    case "scope_review_record":
      result.artifactPaths = hostFiles(root, result.artifactPaths, "artifactPaths");
      break;
    case "archive_review_record":
      if (Array.isArray(result.findings)) result.findings = result.findings.map((item, index) => ({
        ...item,
        linkedArtifactPaths: hostFiles(root, item.linkedArtifactPaths, `findings[${index}].linkedArtifactPaths`)
      }));
      break;
    case "reevaluate_research_decision":
      result.evidenceRefs = typedEvidenceList(root, result.evidenceRefs, "evidenceRefs");
      if (Array.isArray(result.hypotheses)) result.hypotheses = result.hypotheses.map((item, index) => ({
        ...item,
        supportingEvidence: typedEvidenceList(root, item.supportingEvidence, `hypotheses[${index}].supportingEvidence`),
        counterEvidence: typedEvidenceList(root, item.counterEvidence, `hypotheses[${index}].counterEvidence`)
      }));
      break;
    case "query_dove_mission":
    case "create_dove_mission":
    case "create_ambient_dove_mission":
    case "start_dove_skill_mission":
      if (Array.isArray(result.artifacts)) result.artifacts = result.artifacts.map((item, index) => ({ ...item, path: hostArtifact(root, item.path, `artifacts[${index}].path`) }));
      if (result.evidenceRequirements !== void 0) result.evidenceRequirements = missionEvidenceList(root, result.evidenceRequirements, "evidenceRequirements");
      if (Array.isArray(result.contextArtifactPaths)) result.contextArtifactPaths = hostFiles(root, result.contextArtifactPaths, "contextArtifactPaths");
      break;
    default:
      break;
  }
  return result;
}
function dispatchTool(root, name, args = {}, options = {}) {
  let operation = null;
  let language = DEFAULT_DOVE_RESPONSE_LANGUAGE;
  try {
    const inputSchema = TOOL_INPUT_SCHEMAS.get(name);
    if (!inputSchema) throw new Error(`Unknown tool: ${name}`);
    operation = operationForTool(name);
    const schemaArgs = args;
    assertMcpInputSchema(name, schemaArgs, inputSchema);
    const operationSchemas = TOOL_OPERATION_SCHEMAS.get(name);
    if (operationSchemas) {
      assertMcpInputSchema(name, schemaArgs, { oneOf: operationSchemas });
    }
    language = resolveDoveResponseLanguage(root, schemaArgs, options);
    const targetName = operationTargetTool(operation, schemaArgs);
    let normalizedArgs = normalizeHostPathInputs(root, targetName, schemaArgs);
    if (["query_dove_mission", "start_dove_skill_mission"].includes(targetName)) normalizedArgs = missionRelationshipArgs(root, normalizedArgs);
    if (Object.hasOwn(normalizedArgs, "missionNumber") && !["create_dove_mission", "reevaluate_research_decision"].includes(targetName)) {
      normalizedArgs.missionId = resolveMissionNumber(root, normalizedArgs.missionNumber, { operation: `${name} public mission selection` }).missionId;
      delete normalizedArgs.missionNumber;
    }
    const result = executeTool(root, name, normalizedArgs, options);
    return result && typeof result.then === "function" ? result.then((value) => textResult(value, { language })).catch((error) => {
      const invocation = operation ? classifyInvocationError(error, operation) : createInvocationOutcome({ kind: "failed", category: "not-found", phase: "selection", blocking: true, userAction: "select-target", reason: "not-found" });
      return textResult(publicErrorResult(name, error, invocation), { isError: true, language });
    }) : textResult(result, { language });
  } catch (error) {
    const invocation = operation ? classifyInvocationError(error, operation) : createInvocationOutcome({ kind: "failed", category: "not-found", phase: "selection", blocking: true, userAction: "select-target", reason: "not-found" });
    return textResult(publicErrorResult(name, error, invocation), { isError: true, language });
  }
}

// src/mcp/server.mjs
var ELICITATION_PROTOCOL_VERSIONS = /* @__PURE__ */ new Set([
  "2025-06-18",
  "2025-11-25"
]);
function protocolError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function invalidParams(message) {
  return protocolError(-32602, message);
}
function notInitialized() {
  return protocolError(-32002, "MCP server is not initialized.");
}
function normalizeToolDiscoveryParams(params) {
  if (params === void 0) return {};
  if (!params || typeof params !== "object" || Array.isArray(params)) throw invalidParams("tools/list params must be a plain object.");
  const allowed2 = new Set(Object.keys(toolDiscoveryInputSchema.properties ?? {}));
  const unknown = Object.keys(params).filter((key) => !allowed2.has(key));
  if (unknown.length > 0) throw invalidParams(`tools/list does not accept unknown input: ${unknown.map((key) => `$.${key}`).join(", ")}.`);
  return params;
}
function approvalMessage(approval) {
  return [
    approval.summary,
    ...(approval.effects ?? []).map((effect) => `- ${effect}`),
    approval.question
  ].filter(Boolean).join("\n");
}
function startServer(root = process2.cwd()) {
  let buffer = Buffer.alloc(0);
  let responseFraming = "content-length";
  let nextRequestId = 1;
  let clientProtocolVersion = null;
  let clientCapabilities = {};
  let initialized = false;
  const pending = /* @__PURE__ */ new Map();
  function sendMessage(message) {
    const body = JSON.stringify(message);
    if (responseFraming === "jsonl") {
      process2.stdout.write(`${body}
`);
      return;
    }
    process2.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r
\r
${body}`);
  }
  function sendResponse(id3, result) {
    sendMessage({ jsonrpc: "2.0", id: id3, result });
  }
  function sendError(id3, code, message) {
    sendMessage({ jsonrpc: "2.0", id: id3, error: { code, message } });
  }
  function publicSafeToolFailure() {
    const message = "The MCP tool could not safely return its result. No completion, acceptance, or scientific judgment was recorded.";
    return {
      content: [{ type: "text", text: message }],
      structuredContent: {
        report: { status: "blocked", message },
        hostControl: {
          classification: {
            outcome: "failed",
            category: "internal-failure",
            phase: "internal",
            blocking: true,
            userAction: "retry-explicitly",
            terminal: true,
            continuation: "terminal",
            closure: "none",
            retry: "explicit-request",
            reason: "safe-projection-failure"
          },
          presentation: { mode: "show", reason: "failure" },
          closureRequest: null
        }
      },
      isError: true
    };
  }
  function supportsElicitation() {
    return initialized && ELICITATION_PROTOCOL_VERSIONS.has(clientProtocolVersion) && clientCapabilities?.elicitation !== void 0;
  }
  function requestClient(method, params) {
    const id3 = `dove-${nextRequestId++}`;
    return new Promise((resolve, reject) => {
      pending.set(id3, { resolve, reject });
      sendMessage({ jsonrpc: "2.0", id: id3, method, params });
    });
  }
  async function requestCheckpointApproval(approval) {
    if (!supportsElicitation()) throw new Error("This Dove checkpoint requires MCP elicitation support.");
    const response = await requestClient("elicitation/create", {
      message: approvalMessage(approval),
      requestedSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    });
    return response?.action;
  }
  function resolveClientResponse(message) {
    const waiter = pending.get(message.id);
    if (!waiter) return false;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message ?? "MCP client request failed."));
    else waiter.resolve(message.result);
    return true;
  }
  async function handleMessage(message) {
    if (message?.id !== void 0 && message?.method === void 0 && resolveClientResponse(message)) return;
    const { id: id3, method, params } = message ?? {};
    if (method === "notifications/initialized") {
      if (clientProtocolVersion === null) return;
      initialized = true;
      return;
    }
    if (method === "initialize") {
      if (clientProtocolVersion !== null) throw protocolError(-32600, "MCP server is already initialized.");
      clientProtocolVersion = params?.protocolVersion ?? null;
      clientCapabilities = params?.capabilities ?? {};
      sendResponse(id3, {
        protocolVersion: ELICITATION_PROTOCOL_VERSIONS.has(clientProtocolVersion) ? clientProtocolVersion : "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "dove", version: "0.4.0" }
      });
      return;
    }
    if (method === "ping") {
      sendResponse(id3, {});
      return;
    }
    if (method === "tools/list" || method === "tools/call") {
      if (!initialized) throw notInitialized();
    }
    if (method === "tools/list") {
      normalizeToolDiscoveryParams(params);
      sendResponse(id3, { tools: toolDefinitions });
      return;
    }
    if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};
      sendResponse(id3, await dispatchTool(root, toolName, toolArgs, { requestCheckpointApproval }));
      return;
    }
    if (id3 !== void 0) sendError(id3, -32601, `Method not found: ${method}`);
  }
  function handleJsonText(body) {
    let message;
    try {
      message = JSON.parse(body);
    } catch {
      return;
    }
    handleMessage(message).catch((error) => {
      if (message?.id === void 0 || message?.method === void 0) return;
      const code = Number.isInteger(error?.code) ? error.code : -32603;
      if (message.method === "tools/call" && code === -32603) {
        sendResponse(message.id, publicSafeToolFailure());
        return;
      }
      sendError(message.id, code, code !== -32603 && error instanceof Error ? error.message : "Internal error");
    });
  }
  function parseContentLengthMessage() {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return false;
    const headerText = buffer.slice(0, headerEnd).toString("utf8");
    const match = headerText.match(/Content-Length:\s*(\d+)/i);
    if (!match) return false;
    const length = Number(match[1]);
    const totalLength = headerEnd + 4 + length;
    if (buffer.length < totalLength) return false;
    responseFraming = "content-length";
    handleJsonText(buffer.slice(headerEnd + 4, totalLength).toString("utf8"));
    buffer = buffer.slice(totalLength);
    return true;
  }
  function parseJsonLineMessage() {
    const lineEnd = buffer.indexOf("\n");
    if (lineEnd === -1) return false;
    responseFraming = "jsonl";
    const body = buffer.slice(0, lineEnd).toString("utf8").trim();
    buffer = buffer.slice(lineEnd + 1);
    if (body) handleJsonText(body);
    return true;
  }
  function parseMessages() {
    while (buffer.length > 0) {
      const prefix = buffer.toString("utf8", 0, Math.min(buffer.length, 32)).trimStart();
      const parsed = prefix.startsWith("{") ? parseJsonLineMessage() : parseContentLengthMessage();
      if (!parsed) return;
    }
  }
  process2.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    parseMessages();
  });
  process2.stdin.on("end", () => {
    for (const waiter of pending.values()) waiter.reject(new Error("MCP client disconnected before checkpoint approval completed."));
    pending.clear();
    process2.exit(0);
  });
}

// mcp/dove-state-server.mjs
startServer(process.env.CLAUDE_PROJECT_DIR || process.cwd());
