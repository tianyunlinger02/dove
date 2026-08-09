#!/usr/bin/env node
import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/core/schema.mjs
function normalizeDoveResponseLanguage(value, fallback = DEFAULT_DOVE_RESPONSE_LANGUAGE, options = {}) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "zh" || normalized === "en") return normalized;
  if (options.strict && normalized) throw new Error(`Unsupported Dove response language: ${String(value)}.`);
  return fallback;
}
var PACKAGE_VERSION, DOVE_RESEARCH_FORMAT, LEGACY_DOVE_SCHEMA_VERSION, DEFAULT_DOVE_RESPONSE_LANGUAGE, ARTIFACT_PATHS, RESEARCH_DIRECTORIES, RESEARCH_REQUIRED_FILES;
var init_schema = __esm({
  "src/core/schema.mjs"() {
    PACKAGE_VERSION = "0.7.0";
    DOVE_RESEARCH_FORMAT = "dove-research-v1";
    LEGACY_DOVE_SCHEMA_VERSION = 20;
    DEFAULT_DOVE_RESPONSE_LANGUAGE = "zh";
    ARTIFACT_PATHS = Object.freeze({
      doveRoot: ".dove",
      installDir: ".dove/install",
      installationManifest: ".dove/install/manifest.json",
      transactionsDir: ".dove/install/transactions",
      format: ".dove/format.json",
      workspace: ".dove/workspace.json",
      missionsDir: ".dove/missions",
      sourcesDir: ".dove/sources",
      experimentsDir: ".dove/experiments",
      claimsDir: ".dove/claims",
      reviewsDir: ".dove/reviews",
      lessons: ".dove/LESSONS.md"
    });
    RESEARCH_DIRECTORIES = Object.freeze([
      ARTIFACT_PATHS.missionsDir,
      ARTIFACT_PATHS.sourcesDir,
      ARTIFACT_PATHS.experimentsDir,
      ARTIFACT_PATHS.claimsDir,
      ARTIFACT_PATHS.reviewsDir
    ]);
    RESEARCH_REQUIRED_FILES = Object.freeze([
      ARTIFACT_PATHS.format,
      ARTIFACT_PATHS.workspace,
      ARTIFACT_PATHS.lessons
    ]);
  }
});

// src/core/anchored-filesystem.mjs
import fs2 from "node:fs";
import path2 from "node:path";
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function normalizeRelativePath(relativePath, label = "Filesystem path") {
  if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error(`${label} must be a non-empty relative path.`);
  const normalized = path2.posix.normalize(relativePath.replace(/\\/gu, "/"));
  if (path2.isAbsolute(relativePath) || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
    throw new Error(`${label} must stay inside the anchored root: ${relativePath}`);
  }
  return normalized;
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
  const fsOps = options.fsOps ?? fs2;
  const platform = options.platform ?? process.platform;
  const procFdRoot = options.procFdRoot ?? "/proc/self/fd";
  if (platform !== "linux") return { supported: false, reason: "anchored writes require Linux" };
  const constants = fsOps.constants ?? fs2.constants;
  if (!Number.isInteger(constants?.O_DIRECTORY) || !Number.isInteger(constants?.O_NOFOLLOW)) {
    return { supported: false, reason: "anchored writes require O_DIRECTORY and O_NOFOLLOW" };
  }
  try {
    const stat = requiredFunction(fsOps, "statSync")(procFdRoot);
    if (!stat.isDirectory()) return { supported: false, reason: `${procFdRoot} is not a directory` };
  } catch (error) {
    return { supported: false, reason: `anchored writes require readable ${procFdRoot}: ${errorMessage(error)}` };
  }
  return { supported: true, reason: null, procFdRoot };
}
function requireAnchoredFilesystemCapability(options = {}) {
  const capability = anchoredFilesystemCapability(options);
  if (!capability.supported) throw new Error(`Anchored writes are unavailable: ${capability.reason}. Use a read-only operation on this platform.`);
  return capability;
}
function openAnchoredFilesystem(root, options = {}) {
  return new AnchoredFilesystem(root, options);
}
var AnchoredFilesystem;
var init_anchored_filesystem = __esm({
  "src/core/anchored-filesystem.mjs"() {
    AnchoredFilesystem = class {
      constructor(root, options = {}) {
        this.fsOps = options.fsOps ?? fs2;
        this.constants = this.fsOps.constants ?? fs2.constants;
        this.procFdRoot = options.procFdRoot ?? "/proc/self/fd";
        requireAnchoredFilesystemCapability({ ...options, fsOps: this.fsOps, procFdRoot: this.procFdRoot });
        const openSync = requiredFunction(this.fsOps, "openSync");
        const resolvedRoot = path2.resolve(root);
        try {
          this.rootFd = openSync(resolvedRoot, this.constants.O_RDONLY | this.constants.O_DIRECTORY | this.constants.O_NOFOLLOW);
        } catch (error) {
          throw new Error(`Unable to anchor workspace root without following links: ${resolvedRoot}: ${errorMessage(error)}`, { cause: error });
        }
        this.rootHandlePath = path2.posix.join(this.procFdRoot, String(this.rootFd));
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
        return path2.join(this.root, this.normalize(relativePath));
      }
      openDirectory(relativePath = null) {
        this.assertOpen();
        if (relativePath === null || relativePath === "" || relativePath === ".") {
          return { fd: this.rootFd, handlePath: this.rootHandlePath, relativePath: "", owned: false };
        }
        const normalized = this.normalize(relativePath, "Directory path");
        let currentFd = this.rootFd;
        let owned = false;
        let currentRelative = "";
        try {
          for (const component of normalized.split("/")) {
            const currentHandle = path2.posix.join(this.procFdRoot, String(currentFd));
            const candidate = path2.posix.join(currentHandle, component);
            const nextFd = requiredFunction(this.fsOps, "openSync")(candidate, this.constants.O_RDONLY | this.constants.O_DIRECTORY | this.constants.O_NOFOLLOW);
            if (owned) requiredFunction(this.fsOps, "closeSync")(currentFd);
            currentFd = nextFd;
            owned = true;
            currentRelative = currentRelative ? `${currentRelative}/${component}` : component;
          }
          return { fd: currentFd, handlePath: path2.posix.join(this.procFdRoot, String(currentFd)), relativePath: currentRelative, owned };
        } catch (error) {
          if (owned) requiredFunction(this.fsOps, "closeSync")(currentFd);
          throw error;
        }
      }
      closeDirectory(directory) {
        if (directory?.owned === true && directory.fd !== void 0) requiredFunction(this.fsOps, "closeSync")(directory.fd);
      }
      withParent(relativePath, callback) {
        const normalized = this.normalize(relativePath);
        const parentRelative = path2.posix.dirname(normalized);
        const parent = this.openDirectory(parentRelative === "." ? null : parentRelative);
        const name = path2.posix.basename(normalized);
        try {
          return callback({ normalized, parent, name, handlePath: path2.posix.join(parent.handlePath, name) });
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
        const normalized = this.normalize(relativePath, "Directory path");
        if (options.recursive === true) {
          let current = "";
          for (const component of normalized.split("/")) {
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
        this.withParent(normalized, ({ handlePath }) => requiredFunction(this.fsOps, "mkdirSync")(handlePath, { recursive: false, ...options.mode === void 0 ? {} : { mode: options.mode }, anchoredPath: normalized, displayPath: this.displayPath(normalized) }));
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
        const fromParent = this.openDirectory(path2.posix.dirname(from) === "." ? null : path2.posix.dirname(from));
        const toParent = this.openDirectory(path2.posix.dirname(to) === "." ? null : path2.posix.dirname(to));
        try {
          const sourcePath = path2.posix.join(fromParent.handlePath, path2.posix.basename(from));
          const sourceStat = requiredFunction(this.fsOps, "lstatSync")(sourcePath);
          if (sourceStat.isSymbolicLink()) throw new Error(`Anchored rename source must not be a symbolic link: ${from}`);
          const destinationPath = path2.posix.join(toParent.handlePath, path2.posix.basename(to));
          try {
            const destinationStat = requiredFunction(this.fsOps, "lstatSync")(destinationPath);
            if (destinationStat.isSymbolicLink()) throw new Error(`Anchored rename destination must not be a symbolic link: ${to}`);
          } catch (error) {
            if (error?.code !== "ENOENT") throw error;
          }
          requiredFunction(this.fsOps, "renameSync")(sourcePath, destinationPath, { anchoredFrom: from, anchoredTo: to, displayFrom: this.displayPath(from), displayTo: this.displayPath(to) });
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
          const normalized = this.normalize(relativePath);
          this.withParent(normalized, ({ handlePath }) => requiredFunction(this.fsOps, "rmdirSync")(handlePath, { anchoredPath: normalized, displayPath: this.displayPath(normalized), recursiveCleanup: options.recursiveCleanup === true }));
        } catch (error) {
          if (options.force === true && error?.code === "ENOENT") return;
          throw error;
        }
      }
      remove(relativePath, options = {}) {
        const normalized = this.normalize(relativePath, "Removal path");
        const stat = this.tryLstat(normalized);
        if (!stat) {
          if (options.force === true) return;
          const error = new Error(`Anchored removal target does not exist: ${normalized}`);
          error.code = "ENOENT";
          throw error;
        }
        if (stat.isSymbolicLink()) throw new Error(`Anchored removal target must not be a symbolic link: ${normalized}`);
        if (stat.isDirectory()) {
          if (options.recursive !== true) return this.rmdir(normalized);
          const directory = this.openDirectory(normalized);
          try {
            const entries = requiredFunction(this.fsOps, "readdirSync")(directory.handlePath, { withFileTypes: true });
            for (const entry of entries) {
              const childPath2 = `${normalized}/${entry.name}`;
              const childHandlePath = path2.posix.join(directory.handlePath, entry.name);
              const childStat = requiredFunction(this.fsOps, "lstatSync")(childHandlePath);
              if (childStat.isSymbolicLink()) throw new Error(`Anchored cleanup encountered a symbolic link: ${childPath2}`);
              if (childStat.isDirectory()) this.remove(childPath2, { recursive: true, force: false });
              else if (childStat.isFile()) this.unlink(childPath2);
              else throw new Error(`Anchored cleanup encountered an unsupported path type: ${childPath2}`);
            }
          } finally {
            this.closeDirectory(directory);
          }
          return this.rmdir(normalized, { force: options.force, recursiveCleanup: true });
        }
        if (stat.isFile()) return this.unlink(normalized, { force: options.force });
        throw new Error(`Anchored removal target has an unsupported path type: ${normalized}`);
      }
    };
  }
});

// src/core/strict-json.mjs
function duplicateKeyError(label, key, path11) {
  throw new Error(`${label} must not contain duplicate JSON object keys: ${path11 === "$" ? key : `${path11}.${key}`}.`);
}
function parseJsonWithoutDuplicateKeys(text3, label = "JSON input") {
  if (typeof text3 !== "string") throw new Error(`${label} must contain valid JSON.`);
  let index = 0;
  function skipWhitespace() {
    while (/\s/u.test(text3[index] ?? "")) index += 1;
  }
  function parseString() {
    if (text3[index] !== '"') throw new Error(`${label} must contain valid JSON.`);
    const start = index;
    index += 1;
    let escaped = false;
    while (index < text3.length) {
      const character = text3[index];
      index += 1;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') {
        return JSON.parse(text3.slice(start, index));
      }
      if (character.charCodeAt(0) < 32) throw new Error(`${label} must contain valid JSON.`);
    }
    throw new Error(`${label} must contain valid JSON.`);
  }
  function parseNumber() {
    const match = text3.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
    if (!match) throw new Error(`${label} must contain valid JSON.`);
    index += match[0].length;
  }
  function parseArray(path11) {
    index += 1;
    skipWhitespace();
    if (text3[index] === "]") {
      index += 1;
      return;
    }
    let itemIndex = 0;
    while (true) {
      parseValue(`${path11}[${itemIndex}]`);
      itemIndex += 1;
      skipWhitespace();
      if (text3[index] === "]") {
        index += 1;
        return;
      }
      if (text3[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }
  function parseObject(path11) {
    index += 1;
    skipWhitespace();
    if (text3[index] === "}") {
      index += 1;
      return;
    }
    const keys = /* @__PURE__ */ new Set();
    while (true) {
      const key = parseString();
      if (keys.has(key)) duplicateKeyError(label, key, path11);
      keys.add(key);
      skipWhitespace();
      if (text3[index] !== ":") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      parseValue(path11 === "$" ? `$.${key}` : `${path11}.${key}`);
      skipWhitespace();
      if (text3[index] === "}") {
        index += 1;
        return;
      }
      if (text3[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }
  function parseValue(path11) {
    skipWhitespace();
    const character = text3[index];
    if (character === "{") parseObject(path11);
    else if (character === "[") parseArray(path11);
    else if (character === '"') parseString();
    else if (character === "-" || /\d/u.test(character ?? "")) parseNumber();
    else if (text3.startsWith("true", index)) index += 4;
    else if (text3.startsWith("false", index)) index += 5;
    else if (text3.startsWith("null", index)) index += 4;
    else throw new Error(`${label} must contain valid JSON.`);
    skipWhitespace();
  }
  try {
    parseValue("$");
    skipWhitespace();
    if (index !== text3.length) throw new Error(`${label} must contain valid JSON.`);
    return JSON.parse(text3);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label} must not contain duplicate`)) throw error;
    throw new Error(`${label} must contain valid JSON.`);
  }
}
var init_strict_json = __esm({
  "src/core/strict-json.mjs"() {
  }
});

// src/core/research-records.mjs
import crypto from "node:crypto";
import fs3 from "node:fs";
import path4 from "node:path";
function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  return value;
}
function assertFields(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  return value;
}
function researchId(value, label) {
  if (typeof value !== "string" || !SAFE_RESEARCH_ID.test(value)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return value;
}
function nonEmptyText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function exactTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value;
}
function stringArray(value, label, options = {}) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${label} must be an array of non-empty strings.`);
  const normalized = value.map((item) => item.trim());
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must not contain duplicates.`);
  if (normalized.length < (options.min ?? 0)) throw new Error(`${label} must contain at least ${options.min} item(s).`);
  return normalized;
}
function enumeration(value, values, label) {
  if (!values.includes(value)) throw new Error(`${label} must be one of: ${values.join(", ")}.`);
  return value;
}
function normalizedRelativePath(value, label, options = {}) {
  const supplied = nonEmptyText(value, label).replace(/\\/gu, "/");
  const normalized = path4.posix.normalize(supplied);
  if (path4.posix.isAbsolute(normalized) || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) throw new Error(`${label} must stay inside the project.`);
  if (supplied !== normalized) throw new Error(`${label} must be normalized.`);
  if (options.allowDove !== true && (normalized === ".dove" || normalized.startsWith(".dove/"))) throw new Error(`${label} must not reference Dove bookkeeping.`);
  return normalized;
}
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function jsonDocument(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}
function newResearchId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
function canonicalRoot(root, fsOps) {
  const resolved = path4.resolve(root);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}
function normalizedWritePath(value) {
  return normalizedRelativePath(value, "Research record path", { allowDove: true });
}
function currentFile(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return null;
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Research record target must be absent or a regular file: ${relativePath}.`);
  return { bytes: anchor.readFile(relativePath), mode: stat.mode & 4095 };
}
function readResearchText(root, relativePath, options = {}) {
  const fsOps = options.fsOps ?? fs3;
  const normalized = normalizedWritePath(relativePath);
  const anchor = openAnchoredFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
  try {
    const current = currentFile(anchor, normalized);
    return current ? current.bytes.toString("utf8") : options.fallback ?? null;
  } finally {
    anchor.close();
  }
}
function readResearchJson(root, relativePath, options = {}) {
  const text3 = readResearchText(root, relativePath, options);
  if (text3 === null) return options.fallback ?? null;
  return parseJsonWithoutDuplicateKeys(text3, options.label ?? relativePath);
}
function writeResearchFileAtomic(root, relativePath, content, options = {}) {
  const fsOps = options.fsOps ?? fs3;
  const normalized = normalizedWritePath(relativePath);
  const anchor = openAnchoredFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
  const bytes = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), options.encoding ?? "utf8");
  const transactionRoot = `.dove/install/transactions/research-${crypto.randomUUID()}`;
  const temporary = `${transactionRoot}/staged`;
  const backup = `${transactionRoot}/backup`;
  const installExisted = anchor.exists(".dove/install");
  const transactionsExisted = anchor.exists(".dove/install/transactions");
  let previous = null;
  let promoted = false;
  let backedUp = false;
  let phase = "preparing";
  try {
    previous = currentFile(anchor, normalized);
    if (options.ifAbsent === true && previous) throw new Error(`${options.label ?? "Research record"} is immutable and already exists: ${normalized}.`);
    if (options.expectedContent !== void 0) {
      const expected = Buffer.isBuffer(options.expectedContent) ? options.expectedContent : Buffer.from(String(options.expectedContent));
      if (!previous || !previous.bytes.equals(expected)) throw new Error(`${options.label ?? "Research record"} changed before replacement: ${normalized}.`);
    }
    anchor.mkdir(transactionRoot, { recursive: true });
    anchor.writeNewFile(temporary, bytes, { mode: previous?.mode ?? options.mode ?? 384 });
    const parent = path4.posix.dirname(normalized);
    if (parent !== ".") anchor.mkdir(parent, { recursive: true });
    phase = "promoting";
    if (previous) {
      anchor.rename(normalized, backup);
      backedUp = true;
    }
    anchor.rename(temporary, normalized);
    promoted = true;
    phase = "committed";
    if (backedUp) anchor.unlink(backup);
    phase = "cleanup";
    anchor.rmdir(transactionRoot);
    if (!transactionsExisted && anchor.readdir(".dove/install/transactions").length === 0) anchor.rmdir(".dove/install/transactions", { force: true });
    if (!installExisted && anchor.readdir(".dove/install").length === 0) anchor.rmdir(".dove/install", { force: true });
    return normalized;
  } catch (error) {
    if (phase === "committed" || phase === "cleanup") {
      throw new Error(`Atomic research write committed before post-commit cleanup failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    try {
      if (promoted && anchor.exists(normalized)) anchor.unlink(normalized);
      if (backedUp && anchor.exists(backup)) anchor.rename(backup, normalized);
      if (anchor.exists(transactionRoot)) anchor.remove(transactionRoot, { recursive: true, force: true });
      if (!transactionsExisted && anchor.exists(".dove/install/transactions") && anchor.readdir(".dove/install/transactions").length === 0) anchor.rmdir(".dove/install/transactions", { force: true });
      if (!installExisted && anchor.exists(".dove/install") && anchor.readdir(".dove/install").length === 0) anchor.rmdir(".dove/install", { force: true });
    } catch (rollbackError) {
      throw new Error(`Atomic research write failed and rollback also failed: ${error instanceof Error ? error.message : String(error)}; rollback: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`, { cause: error });
    }
    throw error;
  } finally {
    anchor.close();
  }
}
function writeResearchJsonAtomic(root, relativePath, value, options = {}) {
  return writeResearchFileAtomic(root, relativePath, jsonDocument(value), options);
}
var SAFE_RESEARCH_ID;
var init_research_records = __esm({
  "src/core/research-records.mjs"() {
    init_anchored_filesystem();
    init_strict_json();
    SAFE_RESEARCH_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
  }
});

// src/core/review-artifact-snapshot.mjs
import crypto2 from "node:crypto";
import fs4 from "node:fs";
import path5 from "node:path";
function sha256Buffer(value) {
  return crypto2.createHash("sha256").update(value).digest("hex");
}
function canonicalRoot2(root) {
  return fs4.realpathSync.native(path5.resolve(root));
}
function containedFile(root, relativePath, label) {
  const normalized = normalizedRelativePath(relativePath, label);
  const canonical = canonicalRoot2(root);
  let current = canonical;
  for (const segment of normalized.split("/")) {
    current = path5.join(current, segment);
    const stat2 = fs4.lstatSync(current);
    if (stat2.isSymbolicLink()) throw new Error(`${label} must not contain symbolic links: ${normalized}.`);
  }
  const stat = fs4.lstatSync(current);
  if (!stat.isFile() || stat.size === 0) throw new Error(`${label} must be an existing non-empty regular file: ${normalized}.`);
  const real = fs4.realpathSync.native(current);
  const relative = path5.relative(canonical, real);
  if (relative.startsWith("..") || path5.isAbsolute(relative)) throw new Error(`${label} must stay inside the project: ${normalized}.`);
  if (relative.split(path5.sep).join("/") !== normalized) throw new Error(`${label} must use its canonical project-relative path: ${normalized}.`);
  return { fullPath: real, path: normalized, sizeBytes: stat.size };
}
function sha256File(fullPath) {
  return sha256Buffer(fs4.readFileSync(fullPath));
}
function stableSnapshotSetHash(snapshots = []) {
  const canonical = [...snapshots].map(({ path: artifactPath, sizeBytes, sha256: sha2562 }) => ({ path: artifactPath, sizeBytes, sha256: sha2562 })).sort((left, right) => left.path.localeCompare(right.path));
  return sha256Buffer(`${JSON.stringify(canonical)}
`);
}
function snapshotReviewedArtifacts(root, relativePaths, label = "reviewed artifacts") {
  if (!Array.isArray(relativePaths) || relativePaths.length === 0) throw new Error(`${label} requires at least one project-relative path.`);
  const snapshots = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, relativePath] of relativePaths.entries()) {
    const file2 = containedFile(root, relativePath, `${label}[${index}]`);
    if (seen.has(file2.path)) continue;
    seen.add(file2.path);
    snapshots.push({ path: file2.path, sizeBytes: file2.sizeBytes, sha256: sha256File(file2.fullPath) });
  }
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
    let artifactPath;
    try {
      artifactPath = normalizedRelativePath(item.path, `${label}[${index}].path`);
    } catch (error) {
      return { ok: false, snapshots: [], reason: error instanceof Error ? error.message : String(error) };
    }
    if (!Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !HASH_PATTERN.test(String(item.sha256 ?? ""))) return { ok: false, snapshots: [], reason: `${label}[${index}] is invalid` };
    if (seen.has(artifactPath)) return { ok: false, snapshots: [], reason: `${label} contains duplicate paths` };
    seen.add(artifactPath);
    snapshots.push({ path: artifactPath, sizeBytes: item.sizeBytes, sha256: item.sha256 });
  }
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { ok: true, snapshots, reason: null };
}
function verifyReviewSnapshotSet(root, preparedSnapshots, expectedSetHash) {
  const normalized = normalizeReviewSnapshots(preparedSnapshots);
  if (!normalized.ok) return { ok: false, failures: [normalized.reason], reviewedArtifacts: [], reviewedArtifactSetSha256: null };
  const failures = [];
  const setHash = stableSnapshotSetHash(normalized.snapshots);
  if (setHash !== expectedSetHash) failures.push("reviewed-artifact-set-hash-mismatch");
  for (const prepared of normalized.snapshots) {
    try {
      const current = snapshotReviewedArtifacts(root, [prepared.path]).reviewedArtifacts[0];
      if (JSON.stringify(current) !== JSON.stringify(prepared)) failures.push(`reviewed-artifact-changed:${prepared.path}`);
    } catch {
      failures.push(`reviewed-artifact-unavailable:${prepared.path}`);
    }
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)], reviewedArtifacts: normalized.snapshots, reviewedArtifactSetSha256: setHash };
}
var HASH_PATTERN;
var init_review_artifact_snapshot = __esm({
  "src/core/review-artifact-snapshot.mjs"() {
    init_research_records();
    HASH_PATTERN = /^[a-f0-9]{64}$/u;
  }
});

// src/core/project-installation-manifest.mjs
import crypto3 from "node:crypto";
import fs5 from "node:fs";
import path6 from "node:path";
function plainObject2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function assertPlainObject2(value, label) {
  if (!plainObject2(value)) throw new Error(`${label} must be a plain object.`);
}
function assertSealed(value, fields, label) {
  assertPlainObject2(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
  const missing = [...fields].filter((field) => !Object.hasOwn(value, field));
  if (missing.length > 0) throw new Error(`${label} is missing required fields: ${missing.join(", ")}.`);
}
function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value || value !== value.trim() || value.includes("\0")) throw new Error(`${label} must be a non-empty trimmed string.`);
  return value;
}
function exactPositiveInteger(value, expected, label) {
  if (value !== expected) throw new Error(`${label} must equal ${expected}.`);
  return value;
}
function exactIsoTimestamp(value, label) {
  nonEmptyString(value, label);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) throw new Error(`${label} must be an exact ISO timestamp.`);
  return value;
}
function canonicalProjectRelativePath(value, label) {
  nonEmptyString(value, label);
  if (value.includes("\\") || path6.posix.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
    throw new Error(`${label} must be a project-relative path without backslashes: ${value}`);
  }
  const normalized = path6.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized === ".." || normalized.startsWith("../") || value.includes("//") || value.endsWith("/")) {
    throw new Error(`${label} must be one canonical project-relative path: ${value}`);
  }
  if (value === ".dove" || value.startsWith(".dove/")) throw new Error(`${label} must not manage Dove workspace state: ${value}`);
  return value;
}
function normalizeAllowedHosts(options) {
  const allowed = options.hostIds;
  if (!Array.isArray(allowed) || allowed.length === 0 || allowed.some((hostId) => typeof hostId !== "string" || !hostId || hostId === "all")) {
    throw new Error("Project installation manifest validation requires concrete hostIds in registry order.");
  }
  if (new Set(allowed).size !== allowed.length) throw new Error("Project installation manifest hostIds must be unique.");
  return allowed;
}
function validateHosts(hosts, allowedHosts) {
  if (!Array.isArray(hosts) || hosts.length === 0) throw new Error("Project installation manifest hosts must be a non-empty array.");
  for (const hostId of hosts) {
    nonEmptyString(hostId, "Project installation manifest host");
    if (hostId === "all") throw new Error("Project installation manifest hosts must contain concrete host ids, not all.");
    if (!allowedHosts.includes(hostId)) throw new Error(`Project installation manifest contains unknown host: ${hostId}.`);
  }
  const normalized = allowedHosts.filter((hostId) => hosts.includes(hostId));
  if (normalized.length !== hosts.length || normalized.some((hostId, index) => hostId !== hosts[index])) {
    throw new Error("Project installation manifest hosts must be unique and sorted in registry order.");
  }
  return hosts;
}
function validateManagedEntry(entry, index) {
  const label = `Project installation manifest managed[${index}]`;
  assertSealed(entry, MANAGED_FIELDS, label);
  canonicalProjectRelativePath(entry.path, `${label}.path`);
  nonEmptyString(entry.owner, `${label}.owner`);
  if (!MANAGED_MODES.has(entry.mode)) throw new Error(`${label}.mode is unsupported: ${entry.mode}.`);
  if (entry.mode === "exclusive-file") {
    if (entry.selector !== null) throw new Error(`${label}.selector must be null for exclusive-file ownership.`);
  } else {
    nonEmptyString(entry.selector, `${label}.selector`);
  }
  if (typeof entry.digest !== "string" || !SHA256.test(entry.digest)) throw new Error(`${label}.digest must be a lowercase 64-character SHA-256 digest.`);
  return entry;
}
function managedKey(entry) {
  return `${entry.path}\0${entry.mode}\0${entry.selector ?? ""}\0${entry.owner}`;
}
function compareManaged(left, right) {
  return left.path.localeCompare(right.path) || left.mode.localeCompare(right.mode) || String(left.selector ?? "").localeCompare(String(right.selector ?? "")) || left.owner.localeCompare(right.owner);
}
function validateManaged(managed) {
  if (!Array.isArray(managed)) throw new Error("Project installation manifest managed must be an array.");
  managed.forEach(validateManagedEntry);
  const keys = managed.map(managedKey);
  if (new Set(keys).size !== keys.length) throw new Error("Project installation manifest managed entries must be unique.");
  const sorted = [...managed].sort(compareManaged);
  if (sorted.some((entry, index) => entry !== managed[index])) throw new Error("Project installation manifest managed entries must use stable sort order.");
  return managed;
}
function deepFreezeManifest(manifest) {
  Object.freeze(manifest.package);
  Object.freeze(manifest.runtime);
  Object.freeze(manifest.hosts);
  manifest.managed.forEach(Object.freeze);
  Object.freeze(manifest.managed);
  return Object.freeze(manifest);
}
function validateProjectInstallationManifest(value, options = {}) {
  const allowedHosts = normalizeAllowedHosts(options);
  const acceptedVersionPairs = options.acceptedVersionPairs ?? [[INSTALLATION_INTEGRATION_VERSION, INSTALLATION_OWNERSHIP_VERSION]];
  if (!Array.isArray(acceptedVersionPairs) || acceptedVersionPairs.length === 0 || acceptedVersionPairs.some((pair) => !Array.isArray(pair) || pair.length !== 2 || pair.some((version) => !Number.isSafeInteger(version) || version < 1))) {
    throw new Error("Project installation manifest validation requires explicit positive integration/ownership version pairs.");
  }
  assertSealed(value, MANIFEST_FIELDS, "Project installation manifest");
  exactPositiveInteger(value.schemaVersion, INSTALLATION_MANIFEST_SCHEMA_VERSION, "Project installation manifest schemaVersion");
  if (!acceptedVersionPairs.some(([integrationVersion, ownershipVersion]) => value.integrationVersion === integrationVersion && value.ownershipVersion === ownershipVersion)) {
    throw new Error(`Project installation manifest integrationVersion/ownershipVersion must equal one accepted pair: ${acceptedVersionPairs.map((pair) => pair.join("/")).join(", ")}.`);
  }
  nonEmptyString(value.installationId, "Project installation manifest installationId");
  if (!INSTALLATION_ID.test(value.installationId)) throw new Error("Project installation manifest installationId must use installation-<uuid> format.");
  assertSealed(value.package, PACKAGE_FIELDS, "Project installation manifest package");
  nonEmptyString(value.package.name, "Project installation manifest package.name");
  nonEmptyString(value.package.version, "Project installation manifest package.version");
  if (!SEMVER.test(value.package.version)) throw new Error("Project installation manifest package.version must be a semantic version.");
  assertSealed(value.runtime, RUNTIME_FIELDS, "Project installation manifest runtime");
  if (value.runtime.mode !== "user-cli") throw new Error("Project installation manifest runtime.mode must be user-cli.");
  const acceptedRuntimeProtocolVersions = options.acceptedRuntimeProtocolVersions ?? [INSTALLATION_RUNTIME_PROTOCOL_VERSION];
  if (!Array.isArray(acceptedRuntimeProtocolVersions) || acceptedRuntimeProtocolVersions.length === 0 || acceptedRuntimeProtocolVersions.some((version) => !Number.isSafeInteger(version) || version < 1) || !acceptedRuntimeProtocolVersions.includes(value.runtime.protocolVersion)) {
    throw new Error(`Project installation manifest runtime.protocolVersion must equal one accepted version: ${acceptedRuntimeProtocolVersions.join(", ")}.`);
  }
  validateHosts(value.hosts, allowedHosts);
  validateManaged(value.managed);
  const createdAt = exactIsoTimestamp(value.createdAt, "Project installation manifest createdAt");
  const updatedAt = exactIsoTimestamp(value.updatedAt, "Project installation manifest updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Project installation manifest updatedAt must not precede createdAt.");
  return value;
}
function inspectManifestFile(root, fsOps, manifestRelativePath = INSTALLATION_MANIFEST_PATH) {
  const installationDirectory = path6.join(root, path6.posix.dirname(manifestRelativePath));
  const directoryStat = fsOps.lstatSync(installationDirectory);
  if (directoryStat.isSymbolicLink()) throw new Error(`Dove project installation directory must not be a symbolic link: ${installationDirectory}.`);
  if (!directoryStat.isDirectory()) throw new Error(`Dove project installation path must be a directory: ${installationDirectory}.`);
  const manifestPath = path6.join(root, manifestRelativePath);
  let stat;
  try {
    stat = fsOps.lstatSync(manifestPath);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`Dove project installation manifest is missing: ${manifestRelativePath}.`);
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error(`Dove project installation manifest must not be a symbolic link: ${manifestRelativePath}.`);
  if (!stat.isFile()) throw new Error(`Dove project installation manifest must be a regular file: ${manifestRelativePath}.`);
  return manifestPath;
}
function readInstallationManifestAt(root, manifestRelativePath, options = {}) {
  const fsOps = options.fsOps ?? fs5;
  const manifestPath = inspectManifestFile(root, fsOps, manifestRelativePath);
  let parsed;
  try {
    parsed = parseJsonWithoutDuplicateKeys(fsOps.readFileSync(manifestPath, "utf8"), "Dove project installation manifest");
    validateProjectInstallationManifest(parsed, options.allowPrevious === true ? {
      ...options,
      acceptedVersionPairs: [
        [PREVIOUS_INSTALLATION_INTEGRATION_VERSION, PREVIOUS_INSTALLATION_OWNERSHIP_VERSION],
        [INSTALLATION_INTEGRATION_VERSION, INSTALLATION_OWNERSHIP_VERSION]
      ],
      acceptedRuntimeProtocolVersions: [1, INSTALLATION_RUNTIME_PROTOCOL_VERSION]
    } : options);
  } catch (error) {
    throw new Error(`Invalid Dove project installation manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  return deepFreezeManifest(structuredClone(parsed));
}
function readProjectInstallationManifest(root, options = {}) {
  return readInstallationManifestAt(root, INSTALLATION_MANIFEST_PATH, options);
}
var INSTALLATION_MANIFEST_PATH, INSTALLATION_MANIFEST_SCHEMA_VERSION, INSTALLATION_INTEGRATION_VERSION, INSTALLATION_OWNERSHIP_VERSION, PREVIOUS_INSTALLATION_INTEGRATION_VERSION, PREVIOUS_INSTALLATION_OWNERSHIP_VERSION, INSTALLATION_RUNTIME_PROTOCOL_VERSION, MANIFEST_FIELDS, PACKAGE_FIELDS, RUNTIME_FIELDS, MANAGED_FIELDS, MANAGED_MODES, SHA256, INSTALLATION_ID, SEMVER;
var init_project_installation_manifest = __esm({
  "src/core/project-installation-manifest.mjs"() {
    init_schema();
    init_strict_json();
    INSTALLATION_MANIFEST_PATH = ARTIFACT_PATHS.installationManifest;
    INSTALLATION_MANIFEST_SCHEMA_VERSION = 1;
    INSTALLATION_INTEGRATION_VERSION = 2;
    INSTALLATION_OWNERSHIP_VERSION = 2;
    PREVIOUS_INSTALLATION_INTEGRATION_VERSION = 1;
    PREVIOUS_INSTALLATION_OWNERSHIP_VERSION = 1;
    INSTALLATION_RUNTIME_PROTOCOL_VERSION = 2;
    MANIFEST_FIELDS = /* @__PURE__ */ new Set([
      "schemaVersion",
      "integrationVersion",
      "ownershipVersion",
      "installationId",
      "package",
      "runtime",
      "hosts",
      "managed",
      "createdAt",
      "updatedAt"
    ]);
    PACKAGE_FIELDS = /* @__PURE__ */ new Set(["name", "version"]);
    RUNTIME_FIELDS = /* @__PURE__ */ new Set(["mode", "protocolVersion"]);
    MANAGED_FIELDS = /* @__PURE__ */ new Set(["path", "owner", "mode", "selector", "digest"]);
    MANAGED_MODES = /* @__PURE__ */ new Set(["exclusive-file", "json-fragment", "text-block"]);
    SHA256 = /^[a-f0-9]{64}$/u;
    INSTALLATION_ID = /^installation-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
    SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
  }
});

// src/core/workspace-schema.mjs
var workspace_schema_exports = {};
__export(workspace_schema_exports, {
  DEFAULT_DOVE_LESSONS_MARKDOWN: () => DEFAULT_DOVE_LESSONS_MARKDOWN,
  DOVE_RESEARCH_FORMAT: () => DOVE_RESEARCH_FORMAT,
  inspectDoveWorkspace: () => inspectDoveWorkspace,
  openDoveWorkspace: () => openDoveWorkspace,
  validateLessonsMarkdown: () => validateLessonsMarkdown,
  validateResearchFormat: () => validateResearchFormat,
  validateWorkspaceRecord: () => validateWorkspaceRecord,
  workspaceFormatError: () => workspaceFormatError
});
import fs6 from "node:fs";
import path7 from "node:path";
function canonicalWorkspace(root) {
  return fs6.realpathSync.native(path7.resolve(root));
}
function existsNoFollow(fullPath) {
  try {
    fs6.lstatSync(fullPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
function requiredPathProblem(root, relativePath, kind) {
  const fullPath = path7.join(root, relativePath);
  if (!existsNoFollow(fullPath)) return `${relativePath} is missing`;
  const stat = fs6.lstatSync(fullPath);
  if (stat.isSymbolicLink()) return `${relativePath} must not be a symbolic link`;
  if (kind === "directory" && !stat.isDirectory()) return `${relativePath} must be a directory`;
  if (kind === "file" && !stat.isFile()) return `${relativePath} must be a regular file`;
  return null;
}
function readStrictJson(root, relativePath) {
  const problem = requiredPathProblem(root, relativePath, "file");
  if (problem) throw new Error(problem);
  return parseJsonWithoutDuplicateKeys(fs6.readFileSync(path7.join(root, relativePath), "utf8"), relativePath);
}
function validateResearchFormat(value) {
  assertFields(value, FORMAT_FIELDS, "Dove research format marker");
  if (value.format !== DOVE_RESEARCH_FORMAT) throw new Error(`Unsupported Dove research format ${String(value.format ?? "missing")}.`);
  return value;
}
function validateWorkspaceRecord(value) {
  assertFields(value, WORKSPACE_FIELDS2, "Dove Workspace");
  researchId(value.workspaceId, "Dove Workspace workspaceId");
  for (const field of ["researchQuestion", "mainline", "contributionIntent", "currentFocus"]) nonEmptyText(value[field], `Dove Workspace ${field}`);
  exactTimestamp(value.createdAt, "Dove Workspace createdAt");
  exactTimestamp(value.updatedAt, "Dove Workspace updatedAt");
  if (value.updatedAt < value.createdAt) throw new Error("Dove Workspace updatedAt must not precede createdAt.");
  if (!Array.isArray(value.changeHistory) || value.changeHistory.length === 0) throw new Error("Dove Workspace changeHistory must contain at least one human-readable change.");
  value.changeHistory.forEach((entry, index) => {
    assertFields(entry, HISTORY_FIELDS, `Dove Workspace changeHistory[${index}]`);
    exactTimestamp(entry.changedAt, `Dove Workspace changeHistory[${index}].changedAt`);
    nonEmptyText(entry.summary, `Dove Workspace changeHistory[${index}].summary`);
    if (index > 0 && entry.changedAt < value.changeHistory[index - 1].changedAt) throw new Error("Dove Workspace changeHistory must be chronological.");
  });
  if (value.changeHistory.at(-1).changedAt !== value.updatedAt) throw new Error("Dove Workspace updatedAt must match the latest changeHistory entry.");
  return value;
}
function validateLessonsMarkdown(value, label = "Dove Lessons") {
  if (typeof value !== "string" || !value.trim() || !value.endsWith("\n") || value.includes("\0")) throw new Error(`${label} must be non-empty newline-terminated Markdown without null bytes.`);
  return value;
}
function detectLegacy(root) {
  const manifestPath = path7.join(root, ".dove/manifest.json");
  if (!existsNoFollow(manifestPath)) return null;
  try {
    return parseJsonWithoutDuplicateKeys(fs6.readFileSync(manifestPath, "utf8"), ".dove/manifest.json")?.schemaVersion ?? null;
  } catch {
    return null;
  }
}
function inspectInstallOnlyWorkspace(root) {
  const doveRoot = path7.join(root, ARTIFACT_PATHS.doveRoot);
  const children = fs6.readdirSync(doveRoot).map(String).sort();
  if (!children.includes("install") || children.some((child) => !["archive", "install"].includes(child))) return null;
  if (children.includes("archive")) {
    const archiveProblem = requiredPathProblem(root, ".dove/archive", "directory");
    if (archiveProblem) return { state: "invalid-install-only", category: "invalid", healthy: false, error: archiveProblem };
  }
  if (children.includes("install")) {
    const directoryProblem = requiredPathProblem(root, ARTIFACT_PATHS.installDir, "directory");
    if (directoryProblem) return { state: "invalid-install-only", category: "invalid", healthy: false, error: directoryProblem };
    const allowedInstallChildren = /* @__PURE__ */ new Set(["manifest.json", "transactions"]);
    const installDirectory = path7.join(root, ARTIFACT_PATHS.installDir);
    const installChildren = fs6.readdirSync(installDirectory).map(String).sort();
    const unknownChildren = installChildren.filter((child) => !allowedInstallChildren.has(child));
    if (unknownChildren.length > 0) {
      return { state: "invalid-install-only", category: "invalid", healthy: false, error: `${ARTIFACT_PATHS.installDir} contains unsupported children: ${unknownChildren.join(", ")}` };
    }
    const manifestProblem = requiredPathProblem(root, INSTALLATION_MANIFEST_PATH, "file");
    if (manifestProblem) return { state: "invalid-install-only", category: "invalid", healthy: false, error: manifestProblem };
    if (installChildren.includes("transactions")) {
      const transactionsProblem = requiredPathProblem(root, ARTIFACT_PATHS.transactionsDir, "directory");
      if (transactionsProblem) return { state: "invalid-install-only", category: "invalid", healthy: false, error: transactionsProblem };
    }
  }
  return { state: "research-absent", category: "absent", healthy: true, format: null };
}
function inspectDoveWorkspace(root) {
  const workspace = canonicalWorkspace(root);
  const doveRoot = path7.join(workspace, ARTIFACT_PATHS.doveRoot);
  if (!existsNoFollow(doveRoot)) return { workspace, state: "absent", category: "absent", healthy: false, format: null };
  const rootStat = fs6.lstatSync(doveRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return { workspace, state: "invalid-root", category: "invalid", healthy: false, format: null, error: ".dove must be a real directory." };
  const formatPath = path7.join(workspace, ARTIFACT_PATHS.format);
  if (!existsNoFollow(formatPath)) {
    const detectedSchema = detectLegacy(workspace);
    if (detectedSchema !== null) return { workspace, state: "legacy-schema", category: "legacy", healthy: false, format: null, detectedSchema };
    const installOnly = inspectInstallOnlyWorkspace(workspace);
    return installOnly ? { workspace, ...installOnly } : { workspace, state: "unknown-format", category: "unknown", healthy: false, format: null };
  }
  let marker;
  try {
    marker = readStrictJson(workspace, ARTIFACT_PATHS.format);
  } catch (error) {
    return { workspace, state: "malformed-format", category: "invalid", healthy: false, format: null, error: error.message };
  }
  if (marker?.format !== DOVE_RESEARCH_FORMAT) return { workspace, state: "unsupported-format", category: "unknown", healthy: false, format: marker?.format ?? null, marker };
  try {
    validateResearchFormat(marker);
    const problems = [...RESEARCH_DIRECTORIES.map((relativePath) => requiredPathProblem(workspace, relativePath, "directory")), ...RESEARCH_REQUIRED_FILES.map((relativePath) => requiredPathProblem(workspace, relativePath, "file"))].filter(Boolean);
    if (problems.length) throw new Error(`Dove Research Format 1 layout is incomplete: ${problems.join("; ")}.`);
    const workspaceRecord2 = validateWorkspaceRecord(readStrictJson(workspace, ARTIFACT_PATHS.workspace));
    const lessons = fs6.readFileSync(path7.join(workspace, ARTIFACT_PATHS.lessons), "utf8");
    validateLessonsMarkdown(lessons, ARTIFACT_PATHS.lessons);
    return { workspace, state: "current-healthy", category: "current", healthy: true, format: DOVE_RESEARCH_FORMAT, marker, workspaceRecord: workspaceRecord2, lessons };
  } catch (error) {
    return { workspace, state: "current-unhealthy", category: "invalid", healthy: false, format: DOVE_RESEARCH_FORMAT, marker, error: error.message };
  }
}
function workspaceFormatError(inspection, operation = "Dove operation") {
  if (inspection.state === "absent" || inspection.state === "research-absent") return new Error(`${operation} requires an initialized ${DOVE_RESEARCH_FORMAT} workspace.`);
  if (inspection.category === "legacy") return new Error(`${operation} recognizes legacy Dove Schema ${inspection.detectedSchema ?? LEGACY_DOVE_SCHEMA_VERSION} read-only and refuses to write. Dove does not migrate, move, archive, reset, or replace the existing .dove directory.`);
  if (inspection.category === "unknown") return new Error(`${operation} recognizes unsupported Dove format ${inspection.format ?? "unknown"} read-only and refuses to write. No files were changed.`);
  return new Error(`${operation} refuses invalid Dove Research Format 1 state ${inspection.state}${inspection.error ? `: ${inspection.error}` : ""}. No files were changed.`);
}
function openDoveWorkspace(root, options = {}) {
  const inspection = inspectDoveWorkspace(root);
  if ((inspection.state === "absent" || inspection.state === "research-absent") && options.allowAbsent === true) return inspection;
  if (inspection.state === "research-absent") throw workspaceFormatError(inspection, options.operation);
  if (inspection.healthy) return inspection;
  throw workspaceFormatError(inspection, options.operation);
}
var DEFAULT_DOVE_LESSONS_MARKDOWN, FORMAT_FIELDS, WORKSPACE_FIELDS2, HISTORY_FIELDS;
var init_workspace_schema = __esm({
  "src/core/workspace-schema.mjs"() {
    init_strict_json();
    init_project_installation_manifest();
    init_schema();
    init_research_records();
    DEFAULT_DOVE_LESSONS_MARKDOWN = "# Dove Lessons\n";
    FORMAT_FIELDS = /* @__PURE__ */ new Set(["format"]);
    WORKSPACE_FIELDS2 = /* @__PURE__ */ new Set(["workspaceId", "researchQuestion", "mainline", "contributionIntent", "currentFocus", "changeHistory", "createdAt", "updatedAt"]);
    HISTORY_FIELDS = /* @__PURE__ */ new Set(["changedAt", "summary"]);
  }
});

// src/core/research-stores.mjs
var research_stores_exports = {};
__export(research_stores_exports, {
  CLAIM_ASSESSMENTS: () => CLAIM_ASSESSMENTS,
  EXPERIMENT_RESULT_KINDS: () => EXPERIMENT_RESULT_KINDS,
  REVIEW_STATUSES: () => REVIEW_STATUSES,
  SOURCE_RELATIONSHIPS: () => SOURCE_RELATIONSHIPS,
  concludeMission: () => concludeMission,
  createExperimentPlan: () => createExperimentPlan,
  createMission: () => createMission,
  missionReadableIds: () => missionReadableIds,
  readLessons: () => readLessons,
  readMission: () => readMission,
  readMissionTree: () => readMissionTree,
  recordClaim: () => recordClaim,
  recordExperimentResult: () => recordExperimentResult,
  recordReview: () => recordReview,
  recordSource: () => recordSource,
  replaceLessons: () => replaceLessons,
  updateWorkspace: () => updateWorkspace,
  validateMission: () => validateMission,
  validateMissionTree: () => validateMissionTree,
  verifyReview: () => verifyReview
});
import fs7 from "node:fs";
import path8 from "node:path";
function file(directory, id2, suffix = "") {
  return path8.posix.join(directory, `${id2}${suffix}.json`);
}
function missionPath(id2) {
  return file(ARTIFACT_PATHS.missionsDir, id2);
}
function conclusionPath(id2) {
  return file(ARTIFACT_PATHS.missionsDir, id2, ".conclusion");
}
function planPath(id2) {
  return file(ARTIFACT_PATHS.experimentsDir, id2, ".plan");
}
function resultPath(id2) {
  return file(ARTIFACT_PATHS.experimentsDir, id2, ".result");
}
function now(value, label) {
  return value === void 0 ? (/* @__PURE__ */ new Date()).toISOString() : exactTimestamp(value, label);
}
function textFields(value, fields, label) {
  for (const field of fields) nonEmptyText(value[field], `${label}.${field}`);
}
function arrayFields(value, fields, label, minimum = {}) {
  for (const field of fields) stringArray(value[field], `${label}.${field}`, { min: minimum[field] ?? 0 });
}
function listJson(root, directory) {
  return fs7.readdirSync(path8.join(root, directory), { withFileTypes: true }).filter((entry) => {
    if (entry.isSymbolicLink()) throw new Error(`${directory}/${entry.name} must not be a symbolic link.`);
    return entry.isFile() && entry.name.endsWith(".json");
  }).map((entry) => path8.posix.join(directory, entry.name)).sort();
}
function ensureMission(root, missionId) {
  const mission = readMission(root, missionId);
  if (!mission) throw new Error(`Unknown Mission ${missionId}.`);
  return mission;
}
function updateWorkspace(root, changes = {}) {
  const opened = openDoveWorkspace(root, { operation: "Workspace update" });
  const changedAt = now(changes.changedAt, "Workspace changedAt");
  const next = validateWorkspaceRecord({
    ...opened.workspaceRecord,
    researchQuestion: changes.researchQuestion ?? opened.workspaceRecord.researchQuestion,
    mainline: changes.mainline ?? opened.workspaceRecord.mainline,
    contributionIntent: changes.contributionIntent ?? opened.workspaceRecord.contributionIntent,
    currentFocus: changes.currentFocus ?? opened.workspaceRecord.currentFocus,
    changeHistory: [...opened.workspaceRecord.changeHistory, { changedAt, summary: nonEmptyText(changes.summary, "Workspace change summary") }],
    updatedAt: changedAt
  });
  writeResearchJsonAtomic(root, ARTIFACT_PATHS.workspace, next, { expectedContent: readResearchText(root, ARTIFACT_PATHS.workspace), label: "Workspace" });
  return next;
}
function validateMission(value, label = "Mission") {
  assertFields(value, MISSION_FIELDS2, label);
  researchId(value.missionId, `${label}.missionId`);
  if (value.parentMissionId !== null) researchId(value.parentMissionId, `${label}.parentMissionId`);
  arrayFields(value, ["dependsOnMissionIds", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs"], label);
  textFields(value, ["goal", "contributionRole"], label);
  exactTimestamp(value.createdAt, `${label}.createdAt`);
  if (value.parentMissionId === null && (value.branchKind !== null || value.branchReason !== null)) throw new Error(`${label} root must not declare branch metadata.`);
  if (value.parentMissionId !== null) textFields(value, ["branchKind", "branchReason"], label);
  return value;
}
function readMission(root, missionId) {
  openDoveWorkspace(root, { operation: "Mission read" });
  return readResearchJson(root, missionPath(researchId(missionId, "missionId")), { fallback: null });
}
function validateMissionTree(missions) {
  const byId = /* @__PURE__ */ new Map();
  for (const mission of missions) {
    validateMission(mission);
    if (byId.has(mission.missionId)) throw new Error(`Duplicate Mission ${mission.missionId}.`);
    byId.set(mission.missionId, mission);
  }
  for (const mission of byId.values()) for (const target of [...mission.dependsOnMissionIds, ...mission.parentMissionId ? [mission.parentMissionId] : []]) if (!byId.has(target)) throw new Error(`Mission ${mission.missionId} references unknown Mission ${target}.`);
  const check = (edges) => {
    const active = /* @__PURE__ */ new Set();
    const done = /* @__PURE__ */ new Set();
    const visit = (id2) => {
      if (active.has(id2)) throw new Error(`Mission tree contains a cycle at ${id2}.`);
      if (done.has(id2)) return;
      active.add(id2);
      edges(byId.get(id2)).forEach(visit);
      active.delete(id2);
      done.add(id2);
    };
    [...byId.keys()].forEach(visit);
  };
  check((mission) => mission.parentMissionId ? [mission.parentMissionId] : []);
  check((mission) => mission.dependsOnMissionIds);
  return byId;
}
function readMissionTree(root) {
  openDoveWorkspace(root, { operation: "Mission tree read" });
  const missions = validateMissionTree(listJson(root, ARTIFACT_PATHS.missionsDir).filter((item) => !item.endsWith(".conclusion.json")).map((item) => readResearchJson(root, item)));
  const children = new Map([...missions.keys()].map((id2) => [id2, []]));
  for (const mission of missions.values()) if (mission.parentMissionId) children.get(mission.parentMissionId).push(mission.missionId);
  for (const values of children.values()) values.sort();
  return { missions, children, roots: [...missions.values()].filter((mission) => mission.parentMissionId === null).map((mission) => mission.missionId).sort() };
}
function createMission(root, args = {}) {
  const graph = readMissionTree(root);
  const mission = validateMission({
    missionId: args.missionId ?? newResearchId("mission"),
    parentMissionId: args.parentMissionId ?? null,
    dependsOnMissionIds: args.dependsOnMissionIds ?? [],
    branchKind: args.branchKind ?? null,
    branchReason: args.branchReason ?? null,
    goal: args.goal,
    requirements: args.requirements ?? [],
    assumptions: args.assumptions ?? [],
    scope: args.scope ?? [],
    outOfScope: args.outOfScope ?? [],
    evidenceRequirements: args.evidenceRequirements ?? [],
    competingHypotheses: args.competingHypotheses ?? [],
    openQuestions: args.openQuestions ?? [],
    contextRefs: args.contextRefs ?? [],
    contributionRole: args.contributionRole,
    createdAt: now(args.createdAt, "Mission createdAt")
  });
  if (graph.missions.has(mission.missionId)) throw new Error(`Mission contract is immutable and already exists: ${mission.missionId}.`);
  for (const target of [...mission.dependsOnMissionIds, ...mission.parentMissionId ? [mission.parentMissionId] : []]) if (!graph.missions.has(target)) throw new Error(`Mission ${mission.missionId} references unknown Mission ${target}.`);
  validateMissionTree([...graph.missions.values(), mission]);
  writeResearchJsonAtomic(root, missionPath(mission.missionId), mission, { ifAbsent: true, label: "Mission contract" });
  return mission;
}
function missionReadableIds(root, missionId) {
  const tree = readMissionTree(root);
  if (!tree.missions.has(missionId)) throw new Error(`Unknown Mission ${missionId}.`);
  const readable = /* @__PURE__ */ new Set();
  const visit = (id2) => {
    if (readable.has(id2)) return;
    readable.add(id2);
    const mission = tree.missions.get(id2);
    if (mission.parentMissionId) visit(mission.parentMissionId);
    mission.dependsOnMissionIds.forEach(visit);
  };
  visit(missionId);
  return readable;
}
function concludeMission(root, args = {}) {
  ensureMission(root, args.missionId);
  const conclusion = { missionId: args.missionId, synthesis: args.synthesis, failures: args.failures ?? [], limitations: args.limitations ?? [], uncertainty: args.uncertainty ?? [], sourceIds: args.sourceIds ?? [], experimentIds: args.experimentIds ?? [], claimIds: args.claimIds ?? [], recommendedBranches: args.recommendedBranches ?? [], concludedAt: now(args.concludedAt, "Mission conclusion concludedAt") };
  assertFields(conclusion, CONCLUSION_FIELDS, "Mission conclusion");
  nonEmptyText(conclusion.synthesis, "Mission conclusion synthesis");
  arrayFields(conclusion, ["failures", "limitations", "uncertainty", "sourceIds", "experimentIds", "claimIds", "recommendedBranches"], "Mission conclusion");
  writeResearchJsonAtomic(root, conclusionPath(conclusion.missionId), conclusion, { ifAbsent: true, label: "Mission conclusion" });
  return conclusion;
}
function recordSource(root, args = {}) {
  ensureMission(root, args.missionId);
  let capture = null;
  if (args.capturePath) {
    const capturePath = normalizedRelativePath(args.capturePath, "Source capturePath");
    const full = path8.join(fs7.realpathSync.native(path8.resolve(root)), capturePath);
    const stat = fs7.lstatSync(full);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Source capturePath must be a regular file without symbolic links.");
    const bytes = fs7.readFileSync(full);
    capture = { path: capturePath, sizeBytes: bytes.byteLength, sha256: sha256(bytes) };
  }
  const source = { sourceId: args.sourceId ?? newResearchId("source"), missionId: args.missionId, citationKey: args.citationKey ?? null, title: args.title ?? null, authors: args.authors ?? [], year: args.year ?? null, locator: args.locator ?? null, sourceType: args.sourceType ?? null, summary: args.summary, conditions: args.conditions ?? [], relationship: args.relationship, conflicts: args.conflicts ?? [], limitations: args.limitations ?? [], capture, recordedAt: now(args.recordedAt, "Source recordedAt") };
  assertFields(source, SOURCE_FIELDS2, "Source");
  researchId(source.sourceId, "Source.sourceId");
  if (!source.title && !source.locator) throw new Error("Source requires title or locator.");
  nonEmptyText(source.summary, "Source.summary");
  enumeration(source.relationship, SOURCE_RELATIONSHIPS, "Source.relationship");
  arrayFields(source, ["authors", "conditions", "conflicts", "limitations"], "Source");
  if (capture) assertFields(capture, CAPTURE_FIELDS2, "Source.capture");
  writeResearchJsonAtomic(root, file(ARTIFACT_PATHS.sourcesDir, source.sourceId), source, { ifAbsent: true, label: "Source" });
  return source;
}
function createExperimentPlan(root, args = {}) {
  ensureMission(root, args.missionId);
  const plan = { experimentId: args.experimentId ?? newResearchId("experiment"), missionId: args.missionId, title: args.title, hypothesisRefs: args.hypothesisRefs ?? [], protocol: args.protocol ?? [], inputs: args.inputs ?? [], comparisons: args.comparisons ?? [], metrics: args.metrics ?? [], discriminatingObservations: args.discriminatingObservations ?? [], successConditions: args.successConditions ?? [], stopConditions: args.stopConditions ?? [], constraints: args.constraints ?? [], expectedArtifacts: args.expectedArtifacts ?? [], cost: args.cost, risk: args.risk, failureValue: args.failureValue, contributionRole: args.contributionRole, plannedAt: now(args.plannedAt, "Experiment plan plannedAt") };
  assertFields(plan, PLAN_FIELDS2, "Experiment plan");
  researchId(plan.experimentId, "Experiment plan.experimentId");
  textFields(plan, ["title", "cost", "risk", "failureValue", "contributionRole"], "Experiment plan");
  arrayFields(plan, ["hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts"], "Experiment plan", { protocol: 1, inputs: 1, metrics: 1, discriminatingObservations: 1, stopConditions: 1 });
  writeResearchJsonAtomic(root, planPath(plan.experimentId), plan, { ifAbsent: true, label: "Experiment plan" });
  return plan;
}
function recordExperimentResult(root, args = {}) {
  const experimentId = researchId(args.experimentId, "Experiment result.experimentId");
  const plan = readResearchJson(root, planPath(experimentId), { fallback: null });
  if (!plan) throw new Error("Experiment result requires a prior persisted protocol plan.");
  if (plan.missionId !== args.missionId) throw new Error("Experiment result missionId must match its plan.");
  const result = { experimentId, missionId: args.missionId, kind: args.kind, summary: args.summary, observations: args.observations ?? [], measurements: args.measurements ?? [], denominator: args.denominator, hypothesisImpacts: args.hypothesisImpacts ?? [], claimImpacts: args.claimImpacts ?? [], unexpectedObservations: args.unexpectedObservations ?? [], uncertainty: args.uncertainty ?? [], artifactRefs: args.artifactRefs ?? [], failures: args.failures ?? [], deviations: args.deviations ?? [], limitations: args.limitations ?? [], recordedAt: now(args.recordedAt, "Experiment result recordedAt") };
  assertFields(result, RESULT_FIELDS2, "Experiment result");
  enumeration(result.kind, EXPERIMENT_RESULT_KINDS, "Experiment result.kind");
  nonEmptyText(result.summary, "Experiment result.summary");
  assertPlainObject(result.denominator, "Experiment result.denominator");
  if (!Array.isArray(result.measurements) || !Array.isArray(result.hypothesisImpacts) || !Array.isArray(result.claimImpacts)) throw new Error("Experiment result measurements and impacts must be arrays.");
  arrayFields(result, ["observations", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations"], "Experiment result");
  if (["failed", "stopped"].includes(result.kind) && result.failures.length + result.limitations.length === 0) throw new Error("Failed or stopped Experiment results must preserve failures or limitations.");
  writeResearchJsonAtomic(root, resultPath(experimentId), result, { ifAbsent: true, label: "Experiment result" });
  return result;
}
function recordClaim(root, args = {}) {
  ensureMission(root, args.missionId);
  const claim = { claimId: args.claimId ?? newResearchId("claim"), missionId: args.missionId, statement: args.statement, supportRefs: args.supportRefs ?? [], counterEvidenceRefs: args.counterEvidenceRefs ?? [], missingEvidence: args.missingEvidence ?? [], cannotSay: args.cannotSay ?? [], uncertainty: args.uncertainty ?? [], assessment: args.assessment, storyRole: args.storyRole, artifactRefs: args.artifactRefs ?? [], recordedAt: now(args.recordedAt, "Claim recordedAt") };
  assertFields(claim, CLAIM_FIELDS2, "Claim");
  researchId(claim.claimId, "Claim.claimId");
  textFields(claim, ["statement", "storyRole"], "Claim");
  enumeration(claim.assessment, CLAIM_ASSESSMENTS, "Claim.assessment");
  arrayFields(claim, ["supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "artifactRefs"], "Claim");
  if (!claim.supportRefs.length) throw new Error("Claim requires supportRefs.");
  if (!claim.cannotSay.length) throw new Error("Claim requires an explicit cannotSay boundary.");
  writeResearchJsonAtomic(root, file(ARTIFACT_PATHS.claimsDir, claim.claimId), claim, { ifAbsent: true, label: "Claim" });
  return claim;
}
function recordReview(root, args = {}) {
  ensureMission(root, args.missionId);
  const snapshots = snapshotReviewedArtifacts(root, args.artifactPaths, "Review artifacts");
  const review = { reviewId: args.reviewId ?? newResearchId("review"), missionId: args.missionId, status: args.status, verdict: args.verdict, summary: args.summary, rubric: args.rubric ?? [], reviewedArtifacts: snapshots.reviewedArtifacts, reviewedArtifactSetSha256: snapshots.reviewedArtifactSetSha256, findings: args.findings ?? [], actionItems: args.actionItems ?? [], report: args.report, provenance: args.provenance, limitations: args.limitations ?? [], reviewedAt: now(args.reviewedAt, "Review reviewedAt") };
  assertFields(review, REVIEW_FIELDS2, "Review");
  researchId(review.reviewId, "Review.reviewId");
  enumeration(review.status, REVIEW_STATUSES, "Review.status");
  textFields(review, ["verdict", "summary", "report"], "Review");
  arrayFields(review, ["rubric", "actionItems", "limitations"], "Review", { rubric: 1 });
  if (!Array.isArray(review.findings)) throw new Error("Review.findings must be an array.");
  assertPlainObject(review.provenance, "Review.provenance");
  writeResearchJsonAtomic(root, file(ARTIFACT_PATHS.reviewsDir, review.reviewId), review, { ifAbsent: true, label: "Review" });
  return review;
}
function verifyReview(root, reviewId) {
  const review = readResearchJson(root, file(ARTIFACT_PATHS.reviewsDir, researchId(reviewId, "reviewId")), { fallback: null });
  if (!review) return null;
  const verified = verifyReviewSnapshotSet(root, review.reviewedArtifacts, review.reviewedArtifactSetSha256);
  return { review, ...verified };
}
function readLessons(root) {
  return readResearchText(root, ARTIFACT_PATHS.lessons);
}
function replaceLessons(root, markdown) {
  openDoveWorkspace(root, { operation: "Lessons replacement" });
  validateLessonsMarkdown(markdown, "Lessons replacement");
  writeResearchFileAtomic(root, ARTIFACT_PATHS.lessons, markdown, { label: "Lessons" });
  return markdown;
}
var EXPERIMENT_RESULT_KINDS, CLAIM_ASSESSMENTS, SOURCE_RELATIONSHIPS, REVIEW_STATUSES, MISSION_FIELDS2, CONCLUSION_FIELDS, SOURCE_FIELDS2, CAPTURE_FIELDS2, PLAN_FIELDS2, RESULT_FIELDS2, CLAIM_FIELDS2, REVIEW_FIELDS2;
var init_research_stores = __esm({
  "src/core/research-stores.mjs"() {
    init_review_artifact_snapshot();
    init_schema();
    init_research_records();
    init_workspace_schema();
    EXPERIMENT_RESULT_KINDS = Object.freeze(["positive", "negative", "null", "mixed", "failed", "stopped"]);
    CLAIM_ASSESSMENTS = Object.freeze(["supported", "weakened", "refuted", "inconclusive", "blocked"]);
    SOURCE_RELATIONSHIPS = Object.freeze(["consensus", "conflict", "condition-specific", "uncovered", "testable-gap"]);
    REVIEW_STATUSES = Object.freeze(["completed", "blocked", "failed"]);
    MISSION_FIELDS2 = /* @__PURE__ */ new Set(["missionId", "parentMissionId", "dependsOnMissionIds", "branchKind", "branchReason", "goal", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs", "contributionRole", "createdAt"]);
    CONCLUSION_FIELDS = /* @__PURE__ */ new Set(["missionId", "synthesis", "failures", "limitations", "uncertainty", "sourceIds", "experimentIds", "claimIds", "recommendedBranches", "concludedAt"]);
    SOURCE_FIELDS2 = /* @__PURE__ */ new Set(["sourceId", "missionId", "citationKey", "title", "authors", "year", "locator", "sourceType", "summary", "conditions", "relationship", "conflicts", "limitations", "capture", "recordedAt"]);
    CAPTURE_FIELDS2 = /* @__PURE__ */ new Set(["path", "sizeBytes", "sha256"]);
    PLAN_FIELDS2 = /* @__PURE__ */ new Set(["experimentId", "missionId", "title", "hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts", "cost", "risk", "failureValue", "contributionRole", "plannedAt"]);
    RESULT_FIELDS2 = /* @__PURE__ */ new Set(["experimentId", "missionId", "kind", "summary", "observations", "measurements", "denominator", "hypothesisImpacts", "claimImpacts", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations", "recordedAt"]);
    CLAIM_FIELDS2 = /* @__PURE__ */ new Set(["claimId", "missionId", "statement", "supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "assessment", "storyRole", "artifactRefs", "recordedAt"]);
    REVIEW_FIELDS2 = /* @__PURE__ */ new Set(["reviewId", "missionId", "status", "verdict", "summary", "rubric", "reviewedArtifacts", "reviewedArtifactSetSha256", "findings", "actionItems", "report", "provenance", "limitations", "reviewedAt"]);
  }
});

// src/core/workspace-init.mjs
var workspace_init_exports = {};
__export(workspace_init_exports, {
  initializeResearchWorkspace: () => initializeResearchWorkspace,
  updateResearchMainline: () => updateResearchMainline
});
import fs8 from "node:fs";
import path9 from "node:path";
function timestamp(value, label) {
  return value === void 0 ? (/* @__PURE__ */ new Date()).toISOString() : exactTimestamp(value, label);
}
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
function initializeResearchWorkspace(root, args = {}) {
  const inspection = inspectDoveWorkspace(root);
  if (!["absent", "research-absent"].includes(inspection.state)) throw new Error(`Workspace initialization refuses existing .dove state (${inspection.state}). Dove does not migrate, move, archive, reset, or replace it.`);
  const createdAt = timestamp(args.createdAt, "Workspace createdAt");
  const workspace = workspaceRecord(args, createdAt);
  const anchor = openAnchoredFilesystem(fs8.realpathSync.native(path9.resolve(root)), args);
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
      anchor.writeNewFile(relativePath, content, { mode: 384 });
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
function updateResearchMainline(root, args = {}) {
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
var init_workspace_init = __esm({
  "src/core/workspace-init.mjs"() {
    init_anchored_filesystem();
    init_schema();
    init_research_records();
    init_workspace_schema();
  }
});

// src/mcp/server.mjs
import process2 from "node:process";

// src/core/config.mjs
init_schema();
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function normalizedString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function configPaths(root, env) {
  const paths = [];
  const xdg = normalizedString(env.XDG_CONFIG_HOME) ?? path.join(os.homedir(), ".config");
  paths.push(path.join(xdg, "dove", "config.json"));
  if (root) {
    paths.push(path.resolve(root, ".dove", "config.json"));
    paths.push(path.resolve(root, ".dove", "config.local.json"));
  }
  return paths;
}
function readConfig(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!plainObject(value)) throw new Error("top level must be an object");
    return value;
  } catch (error) {
    throw new Error(`Failed to read Dove config ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
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
  for (const filePath of configPaths(root, env)) {
    const value = readConfig(filePath);
    if (value) source = merge(source, value);
  }
  const environmentLanguage = normalizedString(env.DOVE_LANGUAGE);
  return {
    version: 1,
    language: normalizeDoveResponseLanguage(environmentLanguage ?? source.language, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true })
  };
}
function loadExplicitDoveLanguageConfig(root, env = process.env) {
  let language2 = null;
  for (const filePath of configPaths(root, env)) {
    const value = readConfig(filePath);
    if (value && value.language !== void 0) language2 = value.language;
  }
  language2 = normalizedString(env.DOVE_LANGUAGE) ?? language2;
  return language2 ? normalizeDoveResponseLanguage(language2, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true }) : null;
}
function loadDoveLanguageConfig(root, env = process.env) {
  return loadDoveConfig(root, env).language;
}

// src/core/i18n.mjs
init_schema();
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

// src/core/host-path-normalizer.mjs
init_anchored_filesystem();
import path3 from "node:path";
function invalidPath(label, value) {
  throw new Error(`${label} must name one canonical path inside the workspace: ${value}`);
}
function normalizeHostWorkspacePath(root, value, label = "Host path") {
  if (typeof value !== "string" || !value || value !== value.trim() || value.includes("\0") || value.includes("\\")) invalidPath(label, value);
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value) && !/^[A-Za-z]:[\\/]/u.test(value)) invalidPath(label, value);
  const resolvedRoot = path3.resolve(root);
  if (path3.isAbsolute(value)) {
    const normalizedAbsolute = path3.resolve(value);
    if (normalizedAbsolute !== value) invalidPath(label, value);
    const relative = path3.relative(resolvedRoot, normalizedAbsolute);
    if (!relative || relative === ".." || relative.startsWith(`..${path3.sep}`) || path3.isAbsolute(relative)) invalidPath(label, value);
    return relative.split(path3.sep).join("/");
  }
  if (/^[A-Za-z]:[\\/]/u.test(value)) invalidPath(label, value);
  const normalized = path3.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized === ".." || normalized.startsWith("../") || value.includes("//") || value.endsWith("/")) invalidPath(label, value);
  return value;
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

// src/mcp/tool-definitions.mjs
var id = { type: "string", pattern: "^[a-z0-9][a-z0-9._-]{0,127}$" };
var text = { type: "string", minLength: 1 };
var strings = { type: "array", items: text };
var object = { type: "object", additionalProperties: true };
var language = { type: "string", enum: ["zh", "en"] };
function tool(name, description, properties, required = []) {
  return { name, description, inputSchema: { type: "object", properties: { ...properties, language }, required, additionalProperties: false } };
}
var reviewReturn = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["completed", "blocked", "failed"] },
    verdict: text,
    summary: text,
    rubric: { ...strings, minItems: 1 },
    findings: { type: "array", items: object },
    actionItems: strings,
    report: text,
    provenance: object,
    limitations: strings,
    reviewedAt: text
  },
  required: ["status", "verdict", "summary", "rubric", "findings", "actionItems", "report", "provenance", "limitations", "reviewedAt"],
  additionalProperties: false
};
var toolDefinitions = [
  tool("query_dove_research", "Read one zero-write research projection by semantic identifiers.", {
    operation: { type: "string", enum: ["overview", "diagnosis", "related-work", "hypotheses", "experiment-options", "result-synthesis", "claim-story", "branch-synthesis", "reviews"] },
    missionId: id,
    branchMissionIds: { type: "array", items: id }
  }, ["operation"]),
  tool("manage_dove_workspace", "Initialize or update the current research direction without a revision ledger.", {
    operation: { type: "string", enum: ["initialize", "set-mainline"] },
    researchQuestion: text,
    mainline: text,
    contributionIntent: text,
    currentFocus: text,
    changeReason: text
  }, ["operation", "researchQuestion", "mainline", "contributionIntent", "currentFocus"]),
  tool("manage_dove_missions", "Query, create, branch, or conclude immutable research Missions using semantic identifiers.", {
    operation: { type: "string", enum: ["query", "create", "branch", "conclude"] },
    missionId: id,
    parentMissionId: id,
    dependsOnMissionIds: { type: "array", items: id },
    branchKind: text,
    branchReason: text,
    goal: text,
    requirements: strings,
    assumptions: strings,
    scope: strings,
    outOfScope: strings,
    evidenceRequirements: strings,
    competingHypotheses: strings,
    openQuestions: strings,
    contextRefs: strings,
    contributionRole: text,
    synthesis: text,
    failures: strings,
    limitations: strings,
    uncertainty: strings,
    sourceIds: { type: "array", items: id },
    experimentIds: { type: "array", items: id },
    claimIds: { type: "array", items: id },
    recommendedBranches: strings
  }, ["operation"]),
  tool("manage_dove_sources", "Query or record captured Source material and its related-work relationship.", {
    operation: { type: "string", enum: ["query", "record"] },
    missionId: id,
    sourceId: id,
    citationKey: { type: ["string", "null"] },
    title: { type: ["string", "null"] },
    authors: strings,
    year: { type: ["string", "number", "null"] },
    locator: { type: ["string", "null"] },
    sourceType: { type: ["string", "null"] },
    summary: text,
    conditions: strings,
    relationship: { type: "string", enum: ["consensus", "conflict", "condition-specific", "uncovered", "testable-gap"] },
    conflicts: strings,
    limitations: strings,
    capturePath: { type: ["string", "null"] },
    recordedAt: text
  }, ["operation", "missionId"]),
  tool("manage_dove_experiments", "Query, freeze, or record Experiment plans and full results. Dove does not execute experiments.", {
    operation: { type: "string", enum: ["query", "freeze", "record-result"] },
    view: { type: "string", enum: ["hypotheses", "experiment-options", "result-synthesis"] },
    missionId: id,
    experimentId: id,
    title: text,
    hypothesisRefs: strings,
    protocol: strings,
    inputs: strings,
    comparisons: strings,
    metrics: strings,
    discriminatingObservations: strings,
    successConditions: strings,
    stopConditions: strings,
    constraints: strings,
    expectedArtifacts: strings,
    cost: text,
    risk: text,
    failureValue: text,
    contributionRole: text,
    plannedAt: text,
    kind: { type: "string", enum: ["positive", "negative", "null", "mixed", "failed", "stopped"] },
    summary: text,
    observations: strings,
    measurements: { type: "array", items: object },
    denominator: object,
    hypothesisImpacts: { type: "array", items: object },
    claimImpacts: { type: "array", items: object },
    unexpectedObservations: strings,
    uncertainty: strings,
    artifactRefs: strings,
    failures: strings,
    deviations: strings,
    limitations: strings,
    recordedAt: text
  }, ["operation", "missionId"]),
  tool("manage_dove_claims", "Query or record Claims with support, counter-evidence, missing evidence, and explicit cannot-say boundaries.", {
    operation: { type: "string", enum: ["query", "record"] },
    missionId: id,
    claims: { type: "array", minItems: 1, items: {
      type: "object",
      properties: {
        claimId: id,
        statement: text,
        supportRefs: { ...strings, minItems: 1 },
        counterEvidenceRefs: strings,
        missingEvidence: strings,
        cannotSay: { ...strings, minItems: 1 },
        uncertainty: strings,
        assessment: { type: "string", enum: ["supported", "weakened", "refuted", "inconclusive", "blocked"] },
        storyRole: text,
        artifactRefs: strings,
        recordedAt: text
      },
      required: ["statement", "supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "assessment", "storyRole", "artifactRefs"],
      additionalProperties: false
    } }
  }, ["operation", "missionId"]),
  tool("manage_dove_reviews", "Run a user-managed review exchange: local-preflight, prepare, import, or coverage. Dove never launches a reviewer.", {
    operation: { type: "string", enum: ["local-preflight", "prepare", "import", "coverage"] },
    missionId: id,
    exchangeId: id,
    reviewId: id,
    artifactPaths: strings,
    review: reviewReturn
  }, ["operation", "missionId"]),
  tool("manage_dove_lessons", "Read or replace the complete advisory Lessons Markdown without creating a Mission.", {
    operation: { type: "string", enum: ["read", "replace"] },
    markdown: text
  }, ["operation"])
];
var toolDiscoveryInputSchema = { type: "object", properties: {}, additionalProperties: false };
var TOOL_INPUT_SCHEMAS = new Map(toolDefinitions.map((item) => [item.name, item.inputSchema]));

// src/mcp/schema-validation.mjs
function isPlainObject(value) {
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
    return isPlainObject(value);
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
  if (isPlainObject(value)) {
    const properties = isPlainObject(schema.properties) ? schema.properties : {};
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

// src/mcp/research-adapter.mjs
init_research_records();
import crypto4 from "node:crypto";
import fs9 from "node:fs";
import path10 from "node:path";

// src/core/research-context.mjs
var RESEARCH_CONTEXT_VIEWS = Object.freeze([
  "overview",
  "diagnosis",
  "related-work",
  "hypotheses",
  "experiment-options",
  "result-synthesis",
  "claim-story",
  "branch-synthesis",
  "reviews"
]);
var VIEW_SET = new Set(RESEARCH_CONTEXT_VIEWS);
var RESULT_KINDS = Object.freeze(["positive", "negative", "null", "mixed", "failed", "stopped"]);
var MODEL_FIELDS = /* @__PURE__ */ new Set(["workspace", "missions", "sources", "experiments", "claims", "reviews", "lessons"]);
var INPUT_FIELDS = /* @__PURE__ */ new Set(["experimentCandidates", "lessonApplications", "hostAnalysis"]);
var QUERY_FIELDS = /* @__PURE__ */ new Set(["view", "missionIds", "branchMissionIds"]);
var WORKSPACE_FIELDS = /* @__PURE__ */ new Set(["workspaceId", "researchQuestion", "mainline", "contributionIntent", "currentFocus", "changeHistory", "createdAt", "updatedAt"]);
var MISSION_FIELDS = /* @__PURE__ */ new Set(["missionId", "parentMissionId", "dependsOnMissionIds", "branchKind", "branchReason", "goal", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs", "contributionRole", "createdAt"]);
var SOURCE_FIELDS = /* @__PURE__ */ new Set(["sourceId", "missionId", "citationKey", "title", "authors", "year", "locator", "sourceType", "summary", "conditions", "relationship", "conflicts", "limitations", "capture", "recordedAt"]);
var CAPTURE_FIELDS = /* @__PURE__ */ new Set(["path", "sizeBytes", "sha256"]);
var EXPERIMENT_FIELDS = /* @__PURE__ */ new Set(["plan", "result"]);
var PLAN_FIELDS = /* @__PURE__ */ new Set(["experimentId", "missionId", "title", "hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts", "cost", "risk", "failureValue", "contributionRole", "plannedAt"]);
var RESULT_FIELDS = /* @__PURE__ */ new Set(["experimentId", "missionId", "kind", "summary", "observations", "measurements", "denominator", "hypothesisImpacts", "claimImpacts", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations", "recordedAt"]);
var CLAIM_FIELDS = /* @__PURE__ */ new Set(["claimId", "missionId", "statement", "supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "assessment", "storyRole", "artifactRefs", "recordedAt"]);
var REVIEW_FIELDS = /* @__PURE__ */ new Set(["reviewId", "missionId", "status", "verdict", "summary", "rubric", "reviewedArtifacts", "reviewedArtifactSetSha256", "findings", "actionItems", "report", "provenance", "limitations", "reviewedAt"]);
var CANDIDATE_FIELDS = /* @__PURE__ */ new Set(["candidateId", "title", "source", "missionId", "hypothesisRefs", "protocol", "discriminatingObservations", "cost", "risk", "failureValue", "contributionRole"]);
function plain(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  return value;
}
function sealed(value, fields, label, requireAll = true) {
  plain(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
  if (requireAll) {
    for (const field of fields) if (!Object.hasOwn(value, field)) throw new Error(`${label} requires ${field}.`);
  }
  return value;
}
function text2(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim().replace(/\s+/gu, " ");
}
function optionalText(value, label) {
  return value === null ? null : text2(value, label);
}
function list(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}
function strings2(value, label) {
  return list(value, label).map((item, index) => text2(item, `${label}[${index}]`));
}
function records(value, label) {
  return value instanceof Map ? [...value.values()] : list(value, label);
}
function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
}
function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) freeze(item);
  return Object.freeze(value);
}
function immutable(value) {
  return freeze(clone(value));
}
function unique(items, keyOf = (item) => JSON.stringify(item)) {
  const seen = /* @__PURE__ */ new Set();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function normalizeWorkspace(value) {
  sealed(value, WORKSPACE_FIELDS, "workspace");
  for (const field of ["workspaceId", "researchQuestion", "mainline", "contributionIntent", "currentFocus", "createdAt", "updatedAt"]) text2(value[field], `workspace.${field}`);
  list(value.changeHistory, "workspace.changeHistory");
  return clone(value);
}
function normalizeMission(value, index) {
  const label = `missions[${index}]`;
  sealed(value, MISSION_FIELDS, label);
  text2(value.missionId, `${label}.missionId`);
  optionalText(value.parentMissionId, `${label}.parentMissionId`);
  optionalText(value.branchKind, `${label}.branchKind`);
  optionalText(value.branchReason, `${label}.branchReason`);
  for (const field of ["goal", "contributionRole", "createdAt"]) text2(value[field], `${label}.${field}`);
  for (const field of ["dependsOnMissionIds", "requirements", "assumptions", "scope", "outOfScope", "evidenceRequirements", "competingHypotheses", "openQuestions", "contextRefs"]) strings2(value[field], `${label}.${field}`);
  return clone(value);
}
function normalizeSource(value, index) {
  const label = `sources[${index}]`;
  sealed(value, SOURCE_FIELDS, label);
  text2(value.sourceId, `${label}.sourceId`);
  text2(value.missionId, `${label}.missionId`);
  optionalText(value.citationKey, `${label}.citationKey`);
  optionalText(value.title, `${label}.title`);
  optionalText(value.locator, `${label}.locator`);
  optionalText(value.sourceType, `${label}.sourceType`);
  text2(value.summary, `${label}.summary`);
  text2(value.relationship, `${label}.relationship`);
  text2(value.recordedAt, `${label}.recordedAt`);
  for (const field of ["authors", "conditions", "conflicts", "limitations"]) strings2(value[field], `${label}.${field}`);
  if (value.capture !== null) sealed(value.capture, CAPTURE_FIELDS, `${label}.capture`);
  return clone(value);
}
function normalizePlan(value, index) {
  const label = `experiments[${index}].plan`;
  sealed(value, PLAN_FIELDS, label);
  for (const field of ["experimentId", "missionId", "title", "cost", "risk", "failureValue", "contributionRole", "plannedAt"]) text2(value[field], `${label}.${field}`);
  for (const field of ["hypothesisRefs", "protocol", "inputs", "comparisons", "metrics", "discriminatingObservations", "successConditions", "stopConditions", "constraints", "expectedArtifacts"]) strings2(value[field], `${label}.${field}`);
  return clone(value);
}
function normalizeResult(value, index) {
  const label = `experiments[${index}].result`;
  sealed(value, RESULT_FIELDS, label);
  text2(value.experimentId, `${label}.experimentId`);
  text2(value.missionId, `${label}.missionId`);
  text2(value.summary, `${label}.summary`);
  text2(value.recordedAt, `${label}.recordedAt`);
  if (!RESULT_KINDS.includes(value.kind)) throw new Error(`${label}.kind is unsupported.`);
  for (const field of ["observations", "unexpectedObservations", "uncertainty", "artifactRefs", "failures", "deviations", "limitations"]) strings2(value[field], `${label}.${field}`);
  for (const field of ["measurements", "hypothesisImpacts", "claimImpacts"]) list(value[field], `${label}.${field}`);
  plain(value.denominator, `${label}.denominator`);
  return clone(value);
}
function normalizeExperiment(value, index) {
  const label = `experiments[${index}]`;
  sealed(value, EXPERIMENT_FIELDS, label);
  const plan = normalizePlan(value.plan, index);
  const result = value.result === null ? null : normalizeResult(value.result, index);
  if (result && (result.experimentId !== plan.experimentId || result.missionId !== plan.missionId)) throw new Error(`${label} plan and result bindings differ.`);
  return { plan, result };
}
function normalizeClaim(value, index) {
  const label = `claims[${index}]`;
  sealed(value, CLAIM_FIELDS, label);
  for (const field of ["claimId", "missionId", "statement", "assessment", "storyRole", "recordedAt"]) text2(value[field], `${label}.${field}`);
  for (const field of ["supportRefs", "counterEvidenceRefs", "missingEvidence", "cannotSay", "uncertainty", "artifactRefs"]) strings2(value[field], `${label}.${field}`);
  return clone(value);
}
function normalizeReview(value, index) {
  const label = `reviews[${index}]`;
  sealed(value, REVIEW_FIELDS, label);
  for (const field of ["reviewId", "missionId", "status", "verdict", "summary", "reviewedArtifactSetSha256", "report", "reviewedAt"]) text2(value[field], `${label}.${field}`);
  for (const field of ["rubric", "actionItems", "limitations"]) strings2(value[field], `${label}.${field}`);
  list(value.reviewedArtifacts, `${label}.reviewedArtifacts`);
  list(value.findings, `${label}.findings`);
  plain(value.provenance, `${label}.provenance`);
  return clone(value);
}
function parseLessons(markdown) {
  if (typeof markdown !== "string" || !markdown.trim()) throw new Error("lessons must be non-empty Markdown.");
  const lessons = [];
  let section = null;
  for (const line of markdown.split(/\r?\n/u)) {
    const heading = /^##?\s+(.+?)\s*$/u.exec(line);
    if (heading) {
      section = heading[1];
      continue;
    }
    const bullet = /^\s*[-*]\s+(.+?)\s*$/u.exec(line);
    if (bullet) lessons.push({ lessonId: `lesson-${lessons.length + 1}`, section, text: text2(bullet[1], "lesson") });
  }
  return lessons;
}
function normalizeApplications(value, lessons) {
  if (value === void 0) return [];
  const fields = /* @__PURE__ */ new Set(["lessonId", "application", "missionId"]);
  const byId = new Map(lessons.map((lesson) => [lesson.lessonId, lesson]));
  return list(value, "lessonApplications").map((item, index) => {
    sealed(item, fields, `lessonApplications[${index}]`);
    const lesson = byId.get(item.lessonId);
    if (!lesson) throw new Error(`lessonApplications[${index}] references unknown lesson.`);
    return { lessonId: lesson.lessonId, lesson: lesson.text, application: text2(item.application, `lessonApplications[${index}].application`), missionId: item.missionId === null ? null : text2(item.missionId, `lessonApplications[${index}].missionId`) };
  });
}
function normalizeCandidate(value, index) {
  const label = `experimentCandidates[${index}]`;
  sealed(value, CANDIDATE_FIELDS, label);
  if (!["caller", "mission"].includes(value.source)) throw new Error(`${label}.source must be caller or mission.`);
  for (const field of ["candidateId", "title", "source", "cost", "risk", "failureValue", "contributionRole"]) text2(value[field], `${label}.${field}`);
  if (value.missionId !== null) text2(value.missionId, `${label}.missionId`);
  for (const field of ["hypothesisRefs", "protocol", "discriminatingObservations"]) strings2(value[field], `${label}.${field}`);
  return { ...clone(value), authorization: "not-granted-by-query" };
}
function normalizeModel(model, inputs) {
  sealed(model, MODEL_FIELDS, "Research model");
  const workspace = normalizeWorkspace(model.workspace);
  const missions = records(model.missions, "missions").map(normalizeMission);
  const missionIds = new Set(missions.map((mission) => mission.missionId));
  if (missionIds.size !== missions.length) throw new Error("missions must not duplicate missionId.");
  for (const mission of missions) {
    if (mission.parentMissionId && !missionIds.has(mission.parentMissionId)) throw new Error(`Mission ${mission.missionId} references unknown parent.`);
    for (const id2 of mission.dependsOnMissionIds) if (!missionIds.has(id2)) throw new Error(`Mission ${mission.missionId} references unknown dependency.`);
  }
  const bind = (record, label) => {
    if (!missionIds.has(record.missionId)) throw new Error(`${label} references unknown mission.`);
    return record;
  };
  const sources = records(model.sources, "sources").map(normalizeSource).map((record) => bind(record, `Source ${record.sourceId}`));
  const experiments = records(model.experiments, "experiments").map(normalizeExperiment).map((record) => {
    bind(record.plan, `Experiment ${record.plan.experimentId}`);
    return record;
  });
  const claims = records(model.claims, "claims").map(normalizeClaim).map((record) => bind(record, `Claim ${record.claimId}`));
  const reviews2 = records(model.reviews, "reviews").map(normalizeReview).map((record) => bind(record, `Review ${record.reviewId}`));
  const lessons = parseLessons(model.lessons);
  return { workspace, missions, sources, experiments, claims, reviews: reviews2, lessons, lessonApplications: normalizeApplications(inputs.lessonApplications, lessons), experimentCandidates: inputs.experimentCandidates === void 0 ? [] : list(inputs.experimentCandidates, "experimentCandidates").map(normalizeCandidate), hostAnalysis: inputs.hostAnalysis === void 0 ? {} : clone(plain(inputs.hostAnalysis, "hostAnalysis")) };
}
function lessonContext(context, missionIds) {
  const selected = new Set(missionIds);
  const applied = context.lessonApplications.filter((item) => item.missionId === null || selected.has(item.missionId));
  const appliedIds = new Set(applied.map((item) => item.lessonId));
  return { applied, available: context.lessons.filter((lesson) => !appliedIds.has(lesson.lessonId)), applicationRule: "Only explicit lessonApplications mark guidance as applied; text similarity is not used." };
}
function missionTree(context) {
  const children = new Map(context.missions.map((mission) => [mission.missionId, []]));
  for (const mission of context.missions) if (mission.parentMissionId) children.get(mission.parentMissionId).push(mission.missionId);
  return context.missions.map((mission) => ({ ...mission, childMissionIds: children.get(mission.missionId) }));
}
function scoped(context, missionIds) {
  const selectedMissionIds = missionIds === void 0 ? context.missions.map((mission) => mission.missionId) : strings2(missionIds, "missionIds");
  const known = new Set(context.missions.map((mission) => mission.missionId));
  for (const id2 of selectedMissionIds) if (!known.has(id2)) throw new Error(`Unknown missionId: ${id2}.`);
  const selected = new Set(selectedMissionIds);
  return { ...context, missions: context.missions.filter((item) => selected.has(item.missionId)), sources: context.sources.filter((item) => selected.has(item.missionId)), experiments: context.experiments.filter((item) => selected.has(item.plan.missionId)), claims: context.claims.filter((item) => selected.has(item.missionId)), reviews: context.reviews.filter((item) => selected.has(item.missionId)), experimentCandidates: context.experimentCandidates.filter((item) => item.missionId === null || selected.has(item.missionId)), selectedMissionIds };
}
function hostSection(context, name) {
  const section = context.hostAnalysis[name];
  return section === void 0 ? {} : clone(plain(section, `hostAnalysis.${name}`));
}
function hostItems(section, field) {
  if (section[field] === void 0) return [];
  return list(section[field], `hostAnalysis.${field}`).map((item) => typeof item === "string" ? { text: item, source: "host-analysis" } : { ...clone(plain(item, `hostAnalysis.${field} item`)), source: "host-analysis" });
}
function referenceState(reference, context) {
  const separator = reference.indexOf(":");
  const kind = separator > 0 ? reference.slice(0, separator) : "recorded-reference";
  const target = separator > 0 ? reference.slice(separator + 1) : reference;
  if (kind === "source") return { reference, kind, target, present: context.sources.some((source) => source.sourceId === target) };
  if (kind === "experiment") return { reference, kind, target, present: context.experiments.some((entry) => entry.plan.experimentId === target && entry.result) };
  if (kind === "claim") return { reference, kind, target, present: context.claims.some((claim) => claim.claimId === target) };
  return { reference, kind, target, present: true, presenceMeaning: "recorded reference only" };
}
function claimMatrix(context) {
  return context.claims.map((claim) => {
    const support = claim.supportRefs.map((reference) => referenceState(reference, context));
    const counterEvidence = claim.counterEvidenceRefs.map((reference) => referenceState(reference, context));
    return { ...claim, support, counterEvidence, unresolvedSupportRefs: support.filter((item) => !item.present), unresolvedCounterEvidenceRefs: counterEvidence.filter((item) => !item.present) };
  });
}
function overview(context) {
  return { view: "overview", workspace: context.workspace, missionTree: missionTree(context), inventory: { missions: context.missions.length, sources: context.sources.length, experimentPlans: context.experiments.length, experimentResults: context.experiments.filter((entry) => entry.result).length, claims: context.claims.length, reviews: context.reviews.length }, guidance: lessonContext(context, context.selectedMissionIds), interpretationBoundary: "Records and exact lineage only; no scientific meaning is inferred." };
}
function diagnosis(context) {
  const matrix = claimMatrix(context);
  const host2 = hostSection(context, "diagnosis");
  return { view: "diagnosis", researchFrame: { researchQuestion: context.workspace.researchQuestion, mainline: context.workspace.mainline, contributionIntent: context.workspace.contributionIntent, currentFocus: context.workspace.currentFocus }, contributionClaims: [...matrix.map((claim) => ({ claimId: claim.claimId, statement: claim.statement, assessment: claim.assessment, storyRole: claim.storyRole, source: "claim-record" })), ...hostItems(host2, "contributionClaims")], supportGaps: [...matrix.flatMap((claim) => [...claim.missingEvidence.map((text3) => ({ claimId: claim.claimId, text: text3, source: "claim-record" })), ...claim.unresolvedSupportRefs.map((reference) => ({ claimId: claim.claimId, text: `Unresolved support reference: ${reference.reference}`, source: "structural-derivation" }))]), ...hostItems(host2, "supportGaps")], counterEvidence: [...matrix.flatMap((claim) => claim.counterEvidenceRefs.map((reference) => ({ claimId: claim.claimId, reference, source: "claim-record" }))), ...context.experiments.flatMap((entry) => (entry.result?.claimImpacts ?? []).map((impact) => ({ experimentId: entry.plan.experimentId, resultKind: entry.result.kind, impact: clone(impact), source: "experiment-result" }))), ...hostItems(host2, "counterEvidence")], cannotSay: [...matrix.flatMap((claim) => claim.cannotSay.map((statement) => ({ claimId: claim.claimId, statement, source: "claim-record" }))), ...hostItems(host2, "cannotSay")], openQuestions: [...context.missions.flatMap((mission) => mission.openQuestions.map((question) => ({ missionId: mission.missionId, question, source: "mission-record" }))), ...hostItems(host2, "openQuestions")], assumptions: context.missions.flatMap((mission) => mission.assumptions.map((assumption) => ({ missionId: mission.missionId, assumption }))), lessonsContext: lessonContext(context, context.selectedMissionIds), hostAnalysis: host2, derivationRules: ["Claim fields are context, not endorsed conclusions.", "Support gaps use explicit missingEvidence and unresolved exact refs.", "Counter evidence uses exact refs and recorded claimImpacts."] };
}
function relatedWork(context) {
  const host2 = hostSection(context, "relatedWork");
  return { view: "related-work", sources: context.sources.map((source) => ({ ...source, linkedClaims: context.claims.filter((claim) => [...claim.supportRefs, ...claim.counterEvidenceRefs].includes(`source:${source.sourceId}`)).map((claim) => ({ claimId: claim.claimId, statement: claim.statement, assessment: claim.assessment })) })), relationships: Object.fromEntries(unique(context.sources.map((source) => source.relationship)).map((relationship) => [relationship, context.sources.filter((source) => source.relationship === relationship).map((source) => source.sourceId)])), themes: hostItems(host2, "themes"), gaps: hostItems(host2, "gaps"), hostAnalysis: host2, derivationRules: ["Source semantic fields and capture are copied directly.", "Claim links require exact source refs.", "No novelty or similarity inference is performed."] };
}
function hypotheses(context) {
  const host2 = hostSection(context, "hypotheses");
  const refs = unique([...context.missions.flatMap((mission) => mission.competingHypotheses), ...context.experiments.flatMap((entry) => entry.plan.hypothesisRefs)]);
  return { view: "hypotheses", hypotheses: [...refs.map((hypothesisRef) => ({ hypothesisRef, missions: context.missions.filter((mission) => mission.competingHypotheses.includes(hypothesisRef)).map((mission) => mission.missionId), experiments: context.experiments.filter((entry) => entry.plan.hypothesisRefs.includes(hypothesisRef)).map((entry) => ({ experimentId: entry.plan.experimentId, resultKind: entry.result?.kind ?? null, impacts: (entry.result?.hypothesisImpacts ?? []).filter((impact) => impact?.hypothesisRef === hypothesisRef) })), source: "exact-reference-projection" })), ...hostItems(host2, "items")], hostAnalysis: host2, derivationRules: ["Hypotheses are exact identifiers.", "Only matching hypothesisImpacts are attached.", "No prose matching is used."] };
}
function option(candidate, index) {
  return { displayOrder: index + 1, ...candidate, comparison: [{ dimension: "discriminatingPower", sourceField: "discriminatingObservations", value: candidate.discriminatingObservations }, { dimension: "informationGainSource", sourceField: "hypothesisRefs", value: candidate.hypothesisRefs }, { dimension: "cost", sourceField: "cost", value: candidate.cost }, { dimension: "risk", sourceField: "risk", value: candidate.risk }, { dimension: "failureValue", sourceField: "failureValue", value: candidate.failureValue }, { dimension: "contributionRole", sourceField: "contributionRole", value: candidate.contributionRole }] };
}
function experimentOptions(context) {
  const stored = context.experiments.map((entry) => ({ candidateId: `experiment:${entry.plan.experimentId}`, title: entry.plan.title, source: "mission", missionId: entry.plan.missionId, hypothesisRefs: entry.plan.hypothesisRefs, protocol: entry.plan.protocol, discriminatingObservations: entry.plan.discriminatingObservations, cost: entry.plan.cost, risk: entry.plan.risk, failureValue: entry.plan.failureValue, contributionRole: entry.plan.contributionRole, authorization: "not-granted-by-query", recordedResultKind: entry.result?.kind ?? null }));
  return { view: "experiment-options", candidates: [...stored, ...context.experimentCandidates].map(option), scoring: null, ranking: null, authorization: "No candidate is selected, scheduled, authorized, or written.", derivationRules: ["Discriminating power exposes discriminatingObservations without scoring.", "Information gain source exposes hypothesisRefs without scoring.", "Order is not rank."] };
}
function resultSynthesis(context) {
  const host2 = hostSection(context, "resultSynthesis");
  const results = context.experiments.filter((entry) => entry.result).map((entry) => ({ experimentId: entry.plan.experimentId, missionId: entry.plan.missionId, ...entry.result }));
  return { view: "result-synthesis", resultKinds: RESULT_KINDS, results, impactsSummary: { byKind: Object.fromEntries(RESULT_KINDS.map((kind) => [kind, results.filter((item) => item.kind === kind).length])), hypothesisImpactCount: results.reduce((sum, item) => sum + item.hypothesisImpacts.length, 0), claimImpactCount: results.reduce((sum, item) => sum + item.claimImpacts.length, 0), observationCount: results.reduce((sum, item) => sum + item.observations.length, 0), unexpectedObservationCount: results.reduce((sum, item) => sum + item.unexpectedObservations.length, 0), failureCount: results.reduce((sum, item) => sum + item.failures.length, 0), limitationCount: results.reduce((sum, item) => sum + item.limitations.length, 0), uncertaintyCount: results.reduce((sum, item) => sum + item.uncertainty.length, 0), denominatorRule: "Every denominator is returned unchanged.", meaning: "Counts and recorded impacts only; interpretation remains host-owned." }, hostAnalysis: host2, derivationRules: ["Result kind is copied exactly.", "Observations, denominator, impacts, failures, limitations, and uncertainty are preserved.", "No impact creates or changes a Claim."] };
}
function claimStory(context) {
  const host2 = hostSection(context, "claimStory");
  const matrix = claimMatrix(context);
  const groups = /* @__PURE__ */ new Map();
  for (const claim of matrix) {
    const items = groups.get(claim.statement) ?? [];
    items.push(claim);
    groups.set(claim.statement, items);
  }
  return { view: "claim-story", claimEvidenceMatrix: matrix, unsupported: matrix.filter((claim) => !claim.support.length || claim.unresolvedSupportRefs.length).map((claim) => ({ claimId: claim.claimId, statement: claim.statement, unresolvedSupportRefs: claim.unresolvedSupportRefs })), counterEvidence: matrix.flatMap((claim) => claim.counterEvidenceRefs.map((reference) => ({ claimId: claim.claimId, reference }))), missingEvidence: matrix.flatMap((claim) => claim.missingEvidence.map((item) => ({ claimId: claim.claimId, item }))), cannotSay: [...matrix.flatMap((claim) => claim.cannotSay.map((statement) => ({ claimId: claim.claimId, statement }))), ...hostItems(host2, "cannotSay")], contributionOutline: { intent: context.workspace.contributionIntent, byStoryRole: Object.fromEntries(unique(matrix.map((claim) => claim.storyRole)).map((role) => [role, matrix.filter((claim) => claim.storyRole === role).map((claim) => claim.claimId)])), byAssessment: Object.fromEntries(unique(matrix.map((claim) => claim.assessment)).map((assessment) => [assessment, matrix.filter((claim) => claim.assessment === assessment).map((claim) => claim.claimId)])), hostAnalysis: hostItems(host2, "contributionOutline") }, storyTensions: [...matrix.filter((claim) => claim.assessment === "supported" && (claim.counterEvidenceRefs.length || claim.missingEvidence.length || claim.uncertainty.length)).map((claim) => ({ kind: "supported-with-tensions", claimId: claim.claimId, counterEvidenceRefs: claim.counterEvidenceRefs, missingEvidence: claim.missingEvidence, uncertainty: claim.uncertainty })), ...[...groups.entries()].filter(([, claims]) => new Set(claims.map((claim) => claim.assessment)).size > 1).map(([statement, claims]) => ({ kind: "exact-statement-assessment-conflict", statement, assessments: claims.map((claim) => ({ claimId: claim.claimId, assessment: claim.assessment })) })), ...context.experiments.flatMap((entry) => (entry.result?.claimImpacts ?? []).map((impact) => ({ kind: "recorded-claim-impact", experimentId: entry.plan.experimentId, resultKind: entry.result.kind, impact: clone(impact) }))), ...context.reviews.filter((review) => review.verdict !== "coherent").map((review) => ({ kind: "review-tension", reviewId: review.reviewId, verdict: review.verdict, summary: review.summary })), ...hostItems(host2, "storyTensions")], priorities: { figures: context.experiments.filter((entry) => entry.result && (entry.result.measurements.length || entry.result.observations.length || entry.result.unexpectedObservations.length || entry.result.failures.length)).map((entry) => ({ experimentId: entry.plan.experimentId, kind: entry.result.kind, reason: "Recorded measurements or observations are available." })), draft: matrix.map((claim) => ({ claimId: claim.claimId, statement: claim.statement, assessment: claim.assessment, storyRole: claim.storyRole, missingEvidence: claim.missingEvidence, cannotSay: claim.cannotSay, uncertainty: claim.uncertainty })), rebuttal: [...context.reviews.flatMap((review) => review.findings.map((finding) => ({ reviewId: review.reviewId, finding: clone(finding), actionItems: review.actionItems }))), ...matrix.flatMap((claim) => claim.counterEvidenceRefs.map((reference) => ({ claimId: claim.claimId, counterEvidenceRef: reference })))], hostAnalysis: host2.priorities === void 0 ? {} : clone(plain(host2.priorities, "hostAnalysis.claimStory.priorities")) }, derivationRules: ["The matrix uses exact evidence refs.", "missingEvidence and cannotSay are copied directly.", "Story roles organize without ranking or authorization."] };
}
function branchGroup(context, branches) {
  const summaries = branches.map((mission) => ({ mission, claims: context.claims.filter((claim) => claim.missionId === mission.missionId), experiments: context.experiments.filter((entry) => entry.plan.missionId === mission.missionId) }));
  const statements = unique(summaries.flatMap((summary) => summary.claims.map((claim) => claim.statement)));
  const consensus = statements.flatMap((statement) => {
    const matches = summaries.map((summary) => summary.claims.filter((claim) => claim.statement === statement));
    if (matches.some((items) => !items.length)) return [];
    const assessments = unique(matches.flat().map((claim) => claim.assessment));
    return assessments.length === 1 ? [{ statement, assessment: assessments[0], basis: "exact statement and assessment in every sibling" }] : [];
  });
  const conflicts = statements.flatMap((statement) => {
    const matches = summaries.flatMap((summary) => summary.claims.filter((claim) => claim.statement === statement).map((claim) => ({ missionId: summary.mission.missionId, claimId: claim.claimId, assessment: claim.assessment })));
    return new Set(matches.map((item) => item.assessment)).size > 1 ? [{ statement, branches: matches, basis: "exact statement with different assessments" }] : [];
  });
  const unknownSets = summaries.map((summary) => unique([...summary.mission.openQuestions, ...summary.claims.flatMap((claim) => [...claim.missingEvidence, ...claim.uncertainty]), ...summary.experiments.flatMap((entry) => entry.result?.uncertainty ?? [])]));
  const commonUnknowns = unknownSets.length ? unknownSets[0].filter((item) => unknownSets.slice(1).every((set) => set.includes(item))) : [];
  const anomalies = summaries.flatMap((summary) => summary.experiments.flatMap((entry) => (entry.result?.unexpectedObservations ?? []).map((observation) => ({ missionId: summary.mission.missionId, experimentId: entry.plan.experimentId, observation }))));
  return { parentMissionId: branches[0].parentMissionId, branches: summaries.map((summary) => ({ missionId: summary.mission.missionId, goal: summary.mission.goal, contributionRole: summary.mission.contributionRole, assumptions: summary.mission.assumptions, competingHypotheses: summary.mission.competingHypotheses, openQuestions: summary.mission.openQuestions, claims: summary.claims.map((claim) => ({ claimId: claim.claimId, statement: claim.statement, assessment: claim.assessment, storyRole: claim.storyRole, cannotSay: claim.cannotSay })), experiments: summary.experiments.map((entry) => ({ experimentId: entry.plan.experimentId, hypothesisRefs: entry.plan.hypothesisRefs, discriminatingObservations: entry.plan.discriminatingObservations, resultKind: entry.result?.kind ?? null, summary: entry.result?.summary ?? null, limitations: entry.result?.limitations ?? [] })) })), consensus, conflicts, conditionalDifferences: summaries.map((summary) => ({ missionId: summary.mission.missionId, assumptions: summary.mission.assumptions, experiments: summary.experiments.map((entry) => ({ experimentId: entry.plan.experimentId, inputs: entry.plan.inputs, comparisons: entry.plan.comparisons, constraints: entry.plan.constraints, limitations: entry.result?.limitations ?? [] })) })), anomalies, commonUnknowns, nextBranchSuggestions: [...conflicts.map((conflict, index) => ({ suggestionId: `conflict-${index + 1}`, branchKind: "alternative", question: `Resolve conflicting assessments for: ${conflict.statement}`, basis: "exact sibling conflict", authorization: "not-granted-by-query" })), ...commonUnknowns.map((question, index) => ({ suggestionId: `unknown-${index + 1}`, branchKind: "follow-up", question, basis: "exact unknown shared by every sibling", authorization: "not-granted-by-query" })), ...anomalies.map((item, index) => ({ suggestionId: `anomaly-${index + 1}`, branchKind: "recovery", question: `Investigate unexpected observation: ${item.observation}`, basis: `Experiment ${item.experimentId}`, authorization: "not-granted-by-query" }))] };
}
function branchSynthesis(context, options) {
  let groups;
  if (options.branchMissionIds !== void 0) {
    const ids = strings2(options.branchMissionIds, "branchMissionIds");
    const branches = ids.map((id2) => context.missions.find((mission) => mission.missionId === id2));
    if (branches.some((mission) => !mission)) throw new Error("branchMissionIds contains an unknown Mission.");
    if (new Set(branches.map((mission) => mission.parentMissionId)).size !== 1 || branches[0].parentMissionId === null) throw new Error("branchMissionIds must select sibling branches with one parent.");
    groups = [branchGroup(context, branches)];
  } else {
    const parents = unique(context.missions.filter((mission) => mission.parentMissionId !== null).map((mission) => mission.parentMissionId));
    groups = parents.map((parentId) => branchGroup(context, context.missions.filter((mission) => mission.parentMissionId === parentId))).filter((group) => group.branches.length > 1);
  }
  const host2 = hostSection(context, "branchSynthesis");
  return { view: "branch-synthesis", groups, lessonsContext: lessonContext(context, groups.flatMap((group) => group.branches.map((branch) => branch.missionId))), hostAnalysis: host2, derivationRules: ["Siblings require one exact parent.", "Consensus, conflicts, and common unknowns use exact strings.", "Suggestions never authorize a branch."] };
}
function reviews(context) {
  const host2 = hostSection(context, "reviews");
  return { view: "reviews", reviews: context.reviews, rubricCoverage: unique(context.reviews.flatMap((review) => review.rubric)).map((rubricItem) => ({ rubricItem, reviews: context.reviews.filter((review) => review.rubric.includes(rubricItem)).map((review) => review.reviewId) })), findings: context.reviews.flatMap((review) => review.findings.map((finding) => ({ reviewId: review.reviewId, missionId: review.missionId, finding: clone(finding) }))), actionItems: context.reviews.flatMap((review) => review.actionItems.map((actionItem) => ({ reviewId: review.reviewId, actionItem }))), reports: context.reviews.map((review) => ({ reviewId: review.reviewId, report: review.report, provenance: review.provenance, limitations: review.limitations })), hostAnalysis: host2, derivationRules: ["Rubric, report, provenance, findings, and limitations are copied directly.", "Rubric coverage uses exact strings.", "No reviewer authority is established."] };
}
function project(context, view, options) {
  if (view === "overview") return overview(context);
  if (view === "diagnosis") return diagnosis(context);
  if (view === "related-work") return relatedWork(context);
  if (view === "hypotheses") return hypotheses(context);
  if (view === "experiment-options") return experimentOptions(context);
  if (view === "result-synthesis") return resultSynthesis(context);
  if (view === "claim-story") return claimStory(context);
  if (view === "branch-synthesis") return branchSynthesis(context, options);
  if (view === "reviews") return reviews(context);
  throw new Error(`Unsupported view ${view}.`);
}
function buildResearchContext(model, inputs = {}) {
  sealed(inputs, INPUT_FIELDS, "Research context inputs", false);
  const normalized = normalizeModel(model, inputs);
  return immutable({ kind: "research-format-1-context", zeroWrite: true, writes: [], ...normalized, boundaries: { format: "dove-research-v1", storeLoading: "caller-or-adapter", queryMutation: "none", semanticAuthority: "host-analysis-required", candidateAuthorization: "none", textSimilarity: "not-used" } });
}
function queryResearchContext(context, options = {}) {
  sealed(options, QUERY_FIELDS, "Research query options", false);
  const view = text2(options.view, "Research query view");
  if (!VIEW_SET.has(view)) throw new Error(`Research query view must be one of: ${RESEARCH_CONTEXT_VIEWS.join(", ")}.`);
  if (context?.kind !== "research-format-1-context") throw new Error("queryResearchContext requires buildResearchContext output.");
  const selected = scoped(clone(context), options.missionIds);
  return immutable({ status: "ok", query: true, zeroWrite: true, writes: [], selectedMissionIds: selected.selectedMissionIds, ...project(selected, view, options) });
}

// src/mcp/research-adapter.mjs
init_research_records();
init_schema();
var concludeMission2;
var createExperimentPlan2;
var createMission2;
var readLessons2;
var readMissionTree2;
var recordClaim2;
var recordExperimentResult2;
var recordReview2;
var recordSource2;
var replaceLessons2;
var verifyReview2;
var initializeResearchWorkspace2;
var updateResearchMainline2;
var openDoveWorkspace2;
var loaded = false;
async function storeModules() {
  if (loaded) return;
  const [stores, workspaceInit, workspaceSchema] = await Promise.all([
    Promise.resolve().then(() => (init_research_stores(), research_stores_exports)),
    Promise.resolve().then(() => (init_workspace_init(), workspace_init_exports)),
    Promise.resolve().then(() => (init_workspace_schema(), workspace_schema_exports))
  ]);
  ({ concludeMission: concludeMission2, createExperimentPlan: createExperimentPlan2, createMission: createMission2, readLessons: readLessons2, readMissionTree: readMissionTree2, recordClaim: recordClaim2, recordExperimentResult: recordExperimentResult2, recordReview: recordReview2, recordSource: recordSource2, replaceLessons: replaceLessons2, verifyReview: verifyReview2 } = stores);
  ({ initializeResearchWorkspace: initializeResearchWorkspace2, updateResearchMainline: updateResearchMainline2 } = workspaceInit);
  ({ openDoveWorkspace: openDoveWorkspace2 } = workspaceSchema);
  loaded = true;
}
function records2(root, directory, accept = () => true) {
  const full = path10.join(root, directory);
  if (!fs9.existsSync(full)) return [];
  return fs9.readdirSync(full, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json") && accept(entry.name)).map((entry) => readResearchJson(root, path10.posix.join(directory, entry.name)));
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
  const opened = openDoveWorkspace2(root, { operation: "Research projection" });
  const tree = readMissionTree2(root);
  const experiments = /* @__PURE__ */ new Map();
  for (const plan of records2(root, ARTIFACT_PATHS.experimentsDir, (name) => name.endsWith(".plan.json"))) experiments.set(plan.experimentId, { plan, result: null });
  for (const result of records2(root, ARTIFACT_PATHS.experimentsDir, (name) => name.endsWith(".result.json"))) experiments.set(result.experimentId, { plan: experiments.get(result.experimentId)?.plan ?? null, result });
  return {
    workspace: opened.workspaceRecord,
    missions: [...tree.missions.values()],
    sources: records2(root, ARTIFACT_PATHS.sourcesDir),
    experiments: [...experiments.values()],
    claims: records2(root, ARTIFACT_PATHS.claimsDir),
    reviews: records2(root, ARTIFACT_PATHS.reviewsDir),
    lessons: readLessons2(root)
  };
}
function queryResearch(root, args) {
  const inspection = openDoveWorkspace2(root, { operation: "Research projection", allowAbsent: true });
  if (inspection.state === "absent" || inspection.state === "research-absent") return absentResearchProjection(inspection, args);
  const context = buildResearchContext(researchModel(root));
  return queryResearchContext(context, {
    view: args.operation,
    ...args.missionId ? { missionIds: [args.missionId] } : {},
    ...args.branchMissionIds ? { branchMissionIds: args.branchMissionIds } : {}
  });
}
function manageWorkspace(root, args) {
  const changeSummary = args.changeReason ?? (args.operation === "initialize" ? "Established the initial research direction." : "Updated the current research direction.");
  if (args.operation === "initialize") return initializeResearchWorkspace2(root, { ...withoutOperation(args), changeSummary });
  if (args.operation === "set-mainline") return updateResearchMainline2(root, { ...withoutOperation(args), changeSummary });
  throw new Error(`Unsupported workspace operation: ${args.operation}.`);
}
function withoutOperation(args) {
  return Object.fromEntries(Object.entries(args).filter(([field]) => field !== "operation"));
}
function manageMissions(root, args) {
  if (args.operation === "query") return queryResearch(root, { operation: "overview", ...args.missionId ? { missionId: args.missionId } : {} });
  if (args.operation === "create") return createMission2(root, { ...withoutOperation(args), parentMissionId: null, branchKind: null, branchReason: null });
  if (args.operation === "branch") return createMission2(root, withoutOperation(args));
  if (args.operation === "conclude") return concludeMission2(root, withoutOperation(args));
  throw new Error(`Unsupported mission operation: ${args.operation}.`);
}
function manageSources(root, args) {
  if (args.operation === "query") return queryResearch(root, { operation: "related-work", missionId: args.missionId });
  if (args.operation === "record") return recordSource2(root, withoutOperation(args));
  throw new Error(`Unsupported source operation: ${args.operation}.`);
}
function manageExperiments(root, args) {
  if (args.operation === "query") return queryResearch(root, { operation: args.view ?? "result-synthesis", missionId: args.missionId });
  if (args.operation === "freeze") return createExperimentPlan2(root, withoutOperation(args));
  if (args.operation === "record-result") return recordExperimentResult2(root, withoutOperation(args));
  throw new Error(`Unsupported experiment operation: ${args.operation}.`);
}
function manageClaims(root, args) {
  if (args.operation === "query") return queryResearch(root, { operation: "claim-story", missionId: args.missionId });
  if (args.operation === "record") return { status: "recorded", claims: args.claims.map((claim) => recordClaim2(root, { ...claim, missionId: args.missionId })) };
  throw new Error(`Unsupported claim operation: ${args.operation}.`);
}
function reviewSnapshots(root, artifactPaths) {
  const workspace = fs9.realpathSync.native(path10.resolve(root));
  return artifactPaths.map((value, index) => {
    const relativePath = normalizedRelativePath(value, `Review artifactPaths[${index}]`);
    const fullPath = path10.join(workspace, relativePath);
    const stat = fs9.lstatSync(fullPath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Review artifactPaths[${index}] must be a regular file without symbolic links.`);
    const bytes = fs9.readFileSync(fullPath);
    return { path: relativePath, sizeBytes: bytes.byteLength, sha256: crypto4.createHash("sha256").update(bytes).digest("hex") };
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
  if (args.operation === "import") return recordReview2(root, {
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
    if (args.reviewId) return verifyReview2(root, args.reviewId);
    return queryResearch(root, { operation: "reviews", missionId: args.missionId });
  }
  throw new Error(`Unsupported review operation: ${args.operation}.`);
}
function manageLessons(root, args) {
  if (args.operation === "read") {
    const inspection = openDoveWorkspace2(root, { operation: "Lessons read", allowAbsent: true });
    if (inspection.state === "absent" || inspection.state === "research-absent") return absentResearchProjection(inspection, { operation: "lessons" });
    return { status: "ok", zeroWrite: true, markdown: readLessons2(root) };
  }
  return { status: "replaced", markdown: replaceLessons2(root, args.markdown) };
}
async function invokeResearchAdapter(root, name, args) {
  await storeModules();
  switch (name) {
    case "query_dove_research":
      return queryResearch(root, args);
    case "manage_dove_workspace":
      return manageWorkspace(root, args);
    case "manage_dove_missions":
      return manageMissions(root, args);
    case "manage_dove_sources":
      return manageSources(root, args);
    case "manage_dove_experiments":
      return manageExperiments(root, args);
    case "manage_dove_claims":
      return manageClaims(root, args);
    case "manage_dove_reviews":
      return manageReviews(root, args);
    case "manage_dove_lessons":
      return manageLessons(root, args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// src/mcp/handlers.mjs
var PRIVATE_KEYS = /* @__PURE__ */ new Set([
  "writes",
  "diagnostics",
  "reviewedArtifactSetSha256"
]);
function isPlainObject2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function publicValue(value) {
  if (Array.isArray(value)) return value.map((item) => publicValue(item)).filter((item) => item !== void 0);
  if (!isPlainObject2(value)) {
    if (typeof value === "string" && (value.startsWith(".dove/") || value.startsWith("/"))) return void 0;
    return value;
  }
  const projected = {};
  for (const [field, item] of Object.entries(value)) {
    if (PRIVATE_KEYS.has(field) || /(?:Digest|Token|Binding)$/u.test(field)) continue;
    const next = publicValue(item);
    if (next !== void 0) projected[field] = next;
  }
  return projected;
}
function successMessage(name, data, language2) {
  if (typeof data?.markdown === "string") return data.markdown;
  if (data?.status === "absent") {
    return language2 === "en" ? "No Dove Research Workspace has been established. Nothing was written; you can first inspect ordinary project materials and initialize research state only if explicitly needed." : "\u5F53\u524D\u5C1A\u672A\u5EFA\u7ACB Dove Research Workspace\u3002\u672C\u6B21\u6CA1\u6709\u5199\u5165\u4EFB\u4F55\u5185\u5BB9\uFF1B\u53EF\u4EE5\u5148\u67E5\u770B\u666E\u901A\u9879\u76EE\u6750\u6599\uFF0C\u53EA\u6709\u660E\u786E\u9700\u8981\u65F6\u518D\u521D\u59CB\u5316\u7814\u7A76\u72B6\u6001\u3002";
  }
  const messages = language2 === "en" ? {
    query_dove_research: "The requested research context was read without changing it.",
    manage_dove_workspace: "The research direction was updated.",
    manage_dove_missions: "The requested Mission operation completed.",
    manage_dove_sources: "The requested Source operation completed.",
    manage_dove_experiments: "The requested Experiment operation completed.",
    manage_dove_claims: "The requested Claim operation completed.",
    manage_dove_reviews: "The requested review exchange operation completed.",
    manage_dove_lessons: "The Lessons document was updated."
  } : {
    query_dove_research: "\u5DF2\u8BFB\u53D6\u6240\u9700\u7814\u7A76\u4E0A\u4E0B\u6587\uFF0C\u6CA1\u6709\u4FEE\u6539\u7814\u7A76\u72B6\u6001\u3002",
    manage_dove_workspace: "\u5DF2\u66F4\u65B0\u7814\u7A76\u65B9\u5411\u3002",
    manage_dove_missions: "\u5DF2\u5B8C\u6210\u6240\u8BF7\u6C42\u7684 Mission \u64CD\u4F5C\u3002",
    manage_dove_sources: "\u5DF2\u5B8C\u6210\u6240\u8BF7\u6C42\u7684 Source \u64CD\u4F5C\u3002",
    manage_dove_experiments: "\u5DF2\u5B8C\u6210\u6240\u8BF7\u6C42\u7684 Experiment \u64CD\u4F5C\u3002",
    manage_dove_claims: "\u5DF2\u5B8C\u6210\u6240\u8BF7\u6C42\u7684 Claim \u64CD\u4F5C\u3002",
    manage_dove_reviews: "\u5DF2\u5B8C\u6210\u6240\u8BF7\u6C42\u7684\u8BC4\u5BA1\u4EA4\u6362\u64CD\u4F5C\u3002",
    manage_dove_lessons: "\u5DF2\u66F4\u65B0 Lessons \u6587\u6863\u3002"
  };
  return messages[name] ?? (language2 === "en" ? "The requested Dove operation completed." : "\u5DF2\u5B8C\u6210\u6240\u8BF7\u6C42\u7684 Dove \u64CD\u4F5C\u3002");
}
function knownFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/Unknown missionId|unknown Mission/iu.test(message)) return "unknown-mission";
  if (/does not allow|requires|must be|unknown input|not allowed/iu.test(message)) return "invalid-input";
  if (/legacy|unsupported.*format/iu.test(message)) return "unsupported-format";
  if (/invalid Dove Research|malformed|unknown-format|invalid-root/iu.test(message)) return "invalid-research-state";
  if (/refuses|blocked|conflict/iu.test(message)) return "blocked";
  return "internal-error";
}
function failureMessage(reason, language2) {
  const messages = language2 === "en" ? {
    "unknown-mission": "The requested Mission is not present in the current research records.",
    "invalid-input": "The request does not match the public Dove tool contract. Check the supplied fields and try again.",
    "unsupported-format": "The project uses a Dove research format that this version will not read or modify.",
    "invalid-research-state": "The Dove research state is incomplete or invalid, so the operation was stopped without changes.",
    blocked: "The operation was stopped by a Dove safety boundary without applying changes.",
    "internal-error": "The Dove operation could not safely return a result. No research judgment or review authority was recorded."
  } : {
    "unknown-mission": "\u5F53\u524D\u7814\u7A76\u8BB0\u5F55\u4E2D\u4E0D\u5B58\u5728\u6240\u8BF7\u6C42\u7684 Mission\u3002",
    "invalid-input": "\u8BF7\u6C42\u4E0D\u7B26\u5408\u516C\u5F00 Dove \u5DE5\u5177\u5408\u540C\uFF0C\u8BF7\u68C0\u67E5\u6240\u63D0\u4F9B\u7684\u5B57\u6BB5\u540E\u91CD\u8BD5\u3002",
    "unsupported-format": "\u9879\u76EE\u4F7F\u7528\u4E86\u5F53\u524D\u7248\u672C\u4E0D\u8BFB\u53D6\u3001\u4E5F\u4E0D\u4FEE\u6539\u7684 Dove \u7814\u7A76\u683C\u5F0F\u3002",
    "invalid-research-state": "Dove \u7814\u7A76\u72B6\u6001\u4E0D\u5B8C\u6574\u6216\u65E0\u6548\uFF0C\u64CD\u4F5C\u5DF2\u505C\u6B62\u4E14\u672A\u505A\u4FEE\u6539\u3002",
    blocked: "\u64CD\u4F5C\u89E6\u53D1\u4E86 Dove \u5B89\u5168\u8FB9\u754C\uFF0C\u5DF2\u505C\u6B62\u4E14\u672A\u5E94\u7528\u4FEE\u6539\u3002",
    "internal-error": "Dove \u64CD\u4F5C\u672A\u80FD\u5B89\u5168\u8FD4\u56DE\u7ED3\u679C\uFF1B\u6CA1\u6709\u8BB0\u5F55\u4EFB\u4F55\u7814\u7A76\u5224\u65AD\u6216\u8BC4\u5BA1\u6743\u5A01\u3002"
  };
  return messages[reason];
}
function toolResult(name, data, language2) {
  const research = publicValue(data);
  return {
    content: [{ type: "text", text: successMessage(name, research, language2) }],
    structuredContent: {
      status: research.status ?? "ok",
      operation: name,
      research
    }
  };
}
function toolFailure(name, error, language2) {
  const reason = knownFailure(error);
  return {
    content: [{ type: "text", text: failureMessage(reason, language2) }],
    structuredContent: {
      status: "error",
      operation: name,
      research: { status: "error", reason }
    },
    isError: true
  };
}
function normalizePaths(root, name, args) {
  const result = structuredClone(args);
  delete result.language;
  const file2 = (value, label) => normalizeHostWorkspaceFilePath(root, value, label);
  const files = (values, label) => Array.isArray(values) ? values.map((value, index) => file2(value, `${label}[${index}]`)) : values;
  if (name === "manage_dove_sources" && result.capturePath !== void 0) result.capturePath = file2(result.capturePath, "capturePath");
  if (name === "manage_dove_reviews") result.artifactPaths = files(result.artifactPaths, "artifactPaths");
  if (name === "manage_dove_experiments" && result.artifactRefs !== void 0) result.artifactRefs = files(result.artifactRefs, "artifactRefs");
  if (name === "manage_dove_claims" && Array.isArray(result.claims)) result.claims = result.claims.map((claim, index) => ({
    ...claim,
    artifactRefs: files(claim.artifactRefs, `claims[${index}].artifactRefs`)
  }));
  return result;
}
function dispatchTool(root, name, args = {}, options = {}) {
  let language2;
  try {
    language2 = resolveDoveResponseLanguage(root, args, { env: options.env, configLanguage: options.language });
    const schema = TOOL_INPUT_SCHEMAS.get(name);
    if (!schema) throw new Error(`Unknown tool: ${name}`);
    assertMcpInputSchema(name, args, schema);
    const data = invokeResearchAdapter(root, name, normalizePaths(root, name, args));
    return data && typeof data.then === "function" ? data.then((value) => toolResult(name, value, language2)).catch((error) => toolFailure(name, error, language2)) : toolResult(name, data, language2);
  } catch (error) {
    return toolFailure(name, error, language2 ?? "zh");
  }
}

// src/core/command-manifest.mjs
var PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
var PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs", "mcp/dove-state-server-package.mjs", "scripts/doctor-mcp-probe-package.mjs", "scripts/dove-user-prompt-submit-package.mjs"];
var PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents", "claude"];
var HOST_IDS = [...PROJECT_HOST_IDS];
var DOVE_MCP_SERVER_NAME = "dove";
var DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([".claude/rules/dove.md", ".claude/skills/dove-intake/SKILL.md", ".claude/skills/dove-lessons-intake/SKILL.md", ".claude/settings.json"]);
var INSTALLED_DOVE_MCP_SERVER = Object.freeze({ type: "stdio", command: "dove", args: Object.freeze(["mcp", "serve", "--project", "."]) });
var HOST_DEFINITIONS = {
  opencode: { label: "OpenCode", scope: "project", jsonChecks: [".opencode.json"] },
  codex: { label: "Codex", scope: "project", jsonChecks: [] },
  cursor: { label: "Cursor", scope: "project", jsonChecks: [] },
  agents: { label: "Shared agent skills", scope: "project", jsonChecks: [] },
  claude: { label: "Claude Code", scope: "project", jsonChecks: [] }
};
var OPENCODE_ROLE_SKILL_PATHS = [".opencode/skills/dove-planner/SKILL.md", ".opencode/skills/dove-builder/SKILL.md", ".opencode/skills/dove-reviewer/SKILL.md"];
var PUBLIC_RESPONSE_CAPSULE = Object.freeze([
  "Unless the user requests another language or format, respond in natural, clear Chinese.",
  "Use internal terms, paths, and machine identifiers only when they materially improve precision, and explain them plainly.",
  "Adapt the response structure to the task instead of forcing a fixed report template; explicit user instructions and local machine-readable contracts take priority.",
  "Access durable Dove state only through public MCP tools. Use normal host tools to read, create, edit, and validate ordinary project materials and artifacts outside `.dove`."
]);
var HOST_ADAPTER_POLICY = Object.freeze({
  toolAccess: Object.freeze({ transport: "mcp-only", unavailable: "stop", cliFallback: false, shellFallback: false, directDoveStateAccess: false }),
  publicChannels: Object.freeze({ present: "human-text-and-structured-research-projection", preserveVerbatim: false }),
  privacy: Object.freeze({ exposePrivateProtocol: false }),
  language: Object.freeze({ default: "zh", style: "natural-clear-flexible", capsule: PUBLIC_RESPONSE_CAPSULE }),
  adapterBullets: Object.freeze([
    "Use only the eight public Dove MCP research tools for durable Dove state; never read or write `.dove` directly.",
    "Use semantic IDs only when durable records are needed, and do not create a Workspace or Mission merely because a Skill was invoked.",
    "Treat tests, host output, local review, and imported review as bounded evidence rather than completion or scientific authority."
  ])
});
var SURFACES = [
  ["research", "Route workspace and mission research, internal synthesis, and bounded project work.", ["query_dove_research", "manage_dove_workspace", "manage_dove_missions"]],
  ["status", "Read the current research projection without writes.", ["query_dove_research"]],
  ["source", "Discover external material and manage captured source candidates.", ["query_dove_research", "manage_dove_sources"]],
  ["experiment", "Design, freeze, execute with host tools, and record experiments and supported claims.", ["query_dove_research", "manage_dove_experiments", "manage_dove_claims"]],
  ["draft", "Write or revise ordinary project draft artifacts using current research evidence.", ["query_dove_research", "manage_dove_claims"]],
  ["figure", "Gather materials and create ordinary project figure artifacts with captions.", ["query_dove_research", "manage_dove_sources", "manage_dove_experiments"]],
  ["review", "Prepare and import a user-managed independent review exchange and inspect coverage.", ["query_dove_research", "manage_dove_reviews"]],
  ["rebuttal", "Perform author-side rebuttal and revision work from current findings and evidence.", ["query_dove_research", "manage_dove_reviews", "manage_dove_claims"]],
  ["lessons", "Read or explicitly replace the complete advisory Lessons document.", ["manage_dove_lessons"]]
];
var mcp = (tool2, instruction, options = {}) => ({
  type: "mcp",
  tool: tool2,
  required: options.required ?? [],
  readOnly: options.readOnly === true,
  persistWhen: options.persistWhen ?? "never",
  instruction
});
var host = (instruction, options = {}) => ({
  type: "host",
  capability: options.capability ?? "ordinary-project-work",
  readOnly: options.readOnly === true,
  persistWhen: options.persistWhen ?? "never",
  instruction
});
function workflow(slug) {
  const clarification = ["Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary."];
  if (slug === "research") return {
    status: "route-or-domain-work",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests research framing, investigation, synthesis, or bounded project work.", steps: [
      mcp("query_dove_research", "Request the smallest zero-write projection, normally overview or a relevant view. Treat status=absent and an empty Mission inventory as normal branchable states.", { readOnly: true }),
      host("When the Workspace is absent, there are no Missions, or no relevant Mission exists, inspect only ordinary project material outside `.dove`\u2014such as README, docs, source, tests, configuration, results, and existing artifacts\u2014to form a provisional research frame.", { capability: "project-exploration", readOnly: true }),
      host("Continue the bounded research or project investigation with normal host tools, preserving uncertainty and recording actual evidence. Do not initialize a Workspace or create a Mission automatically.", { capability: "research-work" }),
      mcp("manage_dove_workspace", "Initialize or update the research direction only when the user explicitly requests durable Workspace maintenance and provides the required research frame.", { persistWhen: "explicit-workspace-maintenance" }),
      mcp("manage_dove_missions", "Create, branch, or conclude a Mission only when the user explicitly needs a durable research node; otherwise leave Dove state unchanged.", { persistWhen: "explicit-durable-mission" })
    ], clarification }],
    examples: ["research"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "status") return {
    status: "read-only",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests current Dove research status.", steps: [
      mcp("query_dove_research", "Read the smallest relevant projection and report it without changing Dove state or ordinary project files.", { readOnly: true })
    ], clarification: [] }],
    examples: ["status"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "source") return {
    status: "route-or-domain-work",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests source discovery, reading, comparison, or verification.", steps: [
      mcp("query_dove_research", "Read related-work or claim context only when durable context is relevant.", { readOnly: true }),
      host("Discover, retrieve, read, and verify the real material with host-native project or external research tools. Distinguish what was inspected from what was actually used.", { capability: "source-research", readOnly: true }),
      mcp("manage_dove_sources", "Record only a Source that was actually used and needs a durable citation or evidence relationship; preserve conditions, conflicts, and limitations.", { persistWhen: "actual-source-used" })
    ], clarification }],
    examples: ["source"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "experiment") return {
    status: "route-or-domain-work",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests experiment design, execution, analysis, or recording.", steps: [
      mcp("query_dove_research", "Read hypotheses, experiment options, or result context when available.", { readOnly: true }),
      host("Design the smallest discriminating experiment and execute it with normal host tools. Preserve raw outputs, failures, denominator accounting, deviations, bias, and uncertainty.", { capability: "experiment-execution" }),
      mcp("manage_dove_experiments", "Freeze a plan before execution and record the full result only when a durable experiment record is needed.", { persistWhen: "durable-experiment-record" }),
      mcp("manage_dove_claims", "Record or revise only claims supported by the observed evidence, including counter-evidence, missing evidence, and cannot-say boundaries.", { persistWhen: "durable-claim-update" })
    ], clarification }],
    examples: ["experiment"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "draft") return {
    status: "route-or-domain-work",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests drafting or revision of an ordinary project artifact.", steps: [
      mcp("query_dove_research", "Read claim-story or other relevant evidence context when durable research exists.", { readOnly: true }),
      host("Read the target and surrounding ordinary project materials, then create or revise the requested draft artifact with normal host editing tools. Keep every claim within the available evidence.", { capability: "artifact-editing" }),
      host("Run the appropriate host-native checks for the artifact and report remaining unsupported claims, citation gaps, and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      mcp("manage_dove_claims", "Persist a Claim change only when the draft work materially changes a durable claim relationship.", { persistWhen: "material-claim-change" })
    ], clarification }],
    examples: ["draft"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "figure") return {
    status: "route-or-domain-work",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests a figure, diagram, plot, or caption.", steps: [
      mcp("query_dove_research", "Read the relevant evidence, source, or result synthesis when durable context exists.", { readOnly: true }),
      host("Gather actual project materials and data, then create or revise the ordinary figure artifact and its caption with host-native plotting, image, or editing tools.", { capability: "figure-creation" }),
      host("Validate labels, denominators, provenance, legibility, and agreement between the figure, caption, and underlying evidence.", { capability: "figure-validation", readOnly: true }),
      mcp("manage_dove_sources", "Record a newly used Source only when a durable reference is needed.", { persistWhen: "actual-source-used" }),
      mcp("manage_dove_experiments", "Record an experiment result only when the figure is based on a result that needs durable preservation.", { persistWhen: "durable-result-needed" })
    ], clarification }],
    examples: ["figure"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "review") return {
    status: "user-managed-exchange",
    selectors: { mission: "semantic-id", research: "semantic-id" },
    generatedFields: [],
    modes: [{ id: "exchange", when: "The user requests independent review.", steps: [
      mcp("query_dove_research", "Read the relevant review or claim context without changing it.", { readOnly: true }),
      mcp("manage_dove_reviews", "Use operation=local-preflight, then operation=prepare for an explicit frozen artifact scope.", { required: ["operation", "missionId", "artifactPaths"], readOnly: true }),
      host("Return the frozen package to the user for a separate reviewer session that the user selects and manages. Never launch, impersonate, or silently replace that reviewer.", { capability: "review-handoff", readOnly: true }),
      mcp("manage_dove_reviews", "After the user supplies the separate review return, use operation=import with the exact strict review object.", { required: ["operation", "missionId", "exchangeId", "review"], persistWhen: "user-supplied-review-return" }),
      mcp("manage_dove_reviews", "Use operation=coverage to inspect current review coverage.", { required: ["operation", "missionId"], readOnly: true })
    ], clarification }],
    examples: ["review"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  if (slug === "rebuttal") return {
    status: "route-or-domain-work",
    selectors: { mission: "semantic-id-when-needed", research: "semantic-id-when-needed" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests author-side rebuttal or revision from review findings.", steps: [
      mcp("query_dove_research", "Read review and claim context relevant to the requested response.", { readOnly: true }),
      mcp("manage_dove_reviews", "Read coverage or review records needed for the response; do not present author work as independent review.", { readOnly: true }),
      host("Analyze each finding against the actual artifact and evidence, then write the rebuttal and make requested ordinary project revisions with host-native tools.", { capability: "rebuttal-and-revision" }),
      host("Validate that every response maps to a finding and that revisions do not overstate evidence or erase failures and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      mcp("manage_dove_claims", "Persist only material claim changes introduced by the author-side revision.", { persistWhen: "material-claim-change" })
    ], clarification }],
    examples: ["rebuttal"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
  return {
    status: "route-or-domain-work",
    selectors: { mission: "none" },
    generatedFields: [],
    modes: [{ id: "default", when: "The user requests Lessons reading, remembering, or reflection.", steps: [
      mcp("manage_dove_lessons", "For reading, use operation=read. For an explicit remember or reflection request, read the complete Markdown, preserve its current structure, integrate only supported reusable guidance, and use operation=replace with the full replacement document.", { required: ["operation"], readOnly: false, persistWhen: "explicit-replace-request" })
    ], clarification }],
    examples: ["lessons"],
    channels: { result: "Return human text plus structured research projection.", privacy: "No private control envelope exists." }
  };
}
var COMMAND_SURFACES = SURFACES.map(([slug, summary, requiredTools]) => ({
  id: `dove.${slug}`,
  title: `Dove ${slug}`,
  domain: "generic",
  category: slug === "status" ? "query" : "research",
  policy: slug === "status" ? "read-only" : "bounded",
  summary,
  operationId: `command.dove.${slug}`,
  constraints: ["Protect truth, evidence integrity, uncertainty, and claim scope.", "Do not create Missions automatically.", "Use semantic IDs rather than positional selectors."],
  adapterNotes: slug === "review" ? ["Review uses a user-managed independent exchange: local-preflight, prepare, import, coverage. Never launch or impersonate a reviewer."] : [],
  callFlow: workflow(slug),
  ux: { dailyFlow: [summary], targetingBehavior: "Use semantic IDs only when durable records must be selected.", confirmationBehavior: "Explore first; clarify material ambiguity once only if it remains, otherwise proceed within the requested boundary.", expectedOutcome: summary, examples: [`/dove:${slug}`] },
  interaction: slug === "status" ? "read" : "write",
  checkpoint: false,
  continuation: "terminal",
  closure: "none",
  presentation: "show",
  retry: { succeeded: "none", declined: "none", cancelled: "none", failed: "explicit-request" },
  publicProjector: "research-projection",
  pathInput: "workspace-file",
  statuses: { ok: { outcome: "success" } },
  requiredTools
}));
var COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));
function commandIdToSlug(commandId) {
  return commandId.replace(/^dove\./u, "");
}
function hostCommandSlug(commandId) {
  return commandIdToSlug(commandId).replace(/\./gu, "-");
}
function adapterPathForCommand(hostId, command) {
  const commandId = typeof command === "string" ? command : command.id;
  const slug = hostCommandSlug(commandId);
  if (hostId === "opencode") return `.opencode/commands/${commandId}.md`;
  if (hostId === "cursor") return `.cursor/commands/dove-${slug}.md`;
  if (hostId === "codex") return `.codex/skills/dove-${slug}/SKILL.md`;
  if (hostId === "agents") return `.agents/skills/dove-${slug}/SKILL.md`;
  if (hostId === "claude") return `.claude/commands/dove/${slug}.md`;
  throw new Error(`Unknown host adapter: ${hostId}`);
}
function commandAdapterPathsForHost(hostId) {
  return COMMAND_SURFACES.map((command) => adapterPathForCommand(hostId, command));
}
var HOST_ADAPTERS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => {
  const commandPaths = commandAdapterPathsForHost(hostId);
  const extraPaths = hostId === "opencode" ? [...OPENCODE_ROLE_SKILL_PATHS, ".opencode.json"] : hostId === "agents" ? ["AGENTS.md"] : [];
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths: [...commandPaths, ...extraPaths], requiredPaths: [...commandPaths, ...extraPaths], jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));
var CURRENT_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...PACKAGE_RUNTIME_PATHS]),
  opencode: Object.freeze([...HOST_ADAPTERS.opencode.paths]),
  codex: Object.freeze([...HOST_ADAPTERS.codex.paths]),
  cursor: Object.freeze([...HOST_ADAPTERS.cursor.paths]),
  agents: Object.freeze([...HOST_ADAPTERS.agents.paths]),
  claude: Object.freeze([...commandAdapterPathsForHost("claude"), ...DOVE_CLAUDE_AMBIENT_PROJECT_PATHS])
});
var RETIRED = ["workspace", "mission", "note", "experience"];
var RETIRED_MANAGED_PATHS = Object.freeze({
  opencode: Object.freeze(RETIRED.map((slug) => `.opencode/commands/dove.${slug}.md`)),
  codex: Object.freeze(RETIRED.flatMap((slug) => [`.codex/skills/dove-${slug}/SKILL.md`, `.codex/skills/dove-${slug}`])),
  cursor: Object.freeze(RETIRED.map((slug) => `.cursor/commands/dove-${slug}.md`)),
  agents: Object.freeze(RETIRED.flatMap((slug) => [`.agents/skills/dove-${slug}/SKILL.md`, `.agents/skills/dove-${slug}`])),
  claude: Object.freeze(RETIRED.map((slug) => `.claude/commands/dove/${slug}.md`))
});
var MANAGED_PACKAGE_PATHS = Object.freeze([...CURRENT_MANAGED_PATHS.opencode, ...CURRENT_MANAGED_PATHS.codex, ...CURRENT_MANAGED_PATHS.cursor, ...CURRENT_MANAGED_PATHS.agents, ...commandAdapterPathsForHost("claude"), ...CURRENT_MANAGED_PATHS.core, ...PACKAGE_DOCUMENTATION_PATHS]);

// src/mcp/runtime-info.mjs
init_project_installation_manifest();

// src/core/host-registry.mjs
var PROJECT_HOST_IDS2 = Object.freeze(["opencode", "codex", "cursor", "agents", "claude"]);
var HOST_DEFINITIONS2 = [
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
  HOST_DEFINITIONS2.map((definition) => [definition.id, freezeHostDefinition(definition)])
));
var DEFAULT_INITIALIZABLE_HOSTS = Object.freeze(
  PROJECT_HOST_IDS2.filter((hostId) => HOST_REGISTRY[hostId].projectInitializable)
);

// src/mcp/runtime-info.mjs
init_schema();

// src/core/mcp-runtime-identity.mjs
var DOVE_MCP_PROTOCOL_VERSIONS = Object.freeze([
  "2025-06-18",
  "2025-11-25"
]);
var DOVE_MCP_PROBE_PROTOCOL_VERSION = DOVE_MCP_PROTOCOL_VERSIONS[0];
function negotiateDoveMcpProtocol(requestedProtocolVersion) {
  if (!DOVE_MCP_PROTOCOL_VERSIONS.includes(requestedProtocolVersion)) {
    throw new Error(`Unsupported MCP protocol version: ${String(requestedProtocolVersion)}.`);
  }
  return requestedProtocolVersion;
}

// src/mcp/runtime-info.mjs
function semverParts(value) {
  const match = typeof value === "string" ? value.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u) : null;
  return match ? match.slice(1).map(Number) : null;
}
function compareSemverVersions(left, right) {
  const leftParts = semverParts(left);
  const rightParts = semverParts(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] < rightParts[index] ? -1 : 1;
  }
  return 0;
}
function inspectRunningMcpRuntime(root, negotiatedProtocolVersion) {
  let projectIntegration = null;
  let comparison = {
    state: "project-integration-unavailable",
    remediation: "inspect-project-integration"
  };
  try {
    const manifest = readProjectInstallationManifest(root, { allowPrevious: true, hostIds: PROJECT_HOST_IDS2 });
    projectIntegration = {
      package: { ...manifest.package },
      integrationVersion: manifest.integrationVersion,
      ownershipVersion: manifest.ownershipVersion,
      installationId: manifest.installationId
    };
    const packageOrder = compareSemverVersions(PACKAGE_VERSION, manifest.package.version);
    comparison = manifest.package.name !== "dove" ? { state: "integration-mismatch", remediation: "sync-project-integration" } : packageOrder === 0 ? { state: "current", remediation: "none" } : packageOrder === -1 ? { state: "restart-required", remediation: "restart-host" } : { state: "integration-mismatch", remediation: "sync-project-integration" };
  } catch (error) {
    projectIntegration = {
      package: null,
      integrationVersion: null,
      ownershipVersion: null,
      installationId: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
  if (negotiatedProtocolVersion !== null && !DOVE_MCP_PROTOCOL_VERSIONS.includes(negotiatedProtocolVersion)) {
    comparison = {
      state: "protocol-incompatible",
      remediation: "update-host-or-dove"
    };
  }
  return {
    serverInfo: { name: DOVE_MCP_SERVER_NAME, version: PACKAGE_VERSION },
    protocolVersion: negotiatedProtocolVersion,
    supportedProtocolVersions: [...DOVE_MCP_PROTOCOL_VERSIONS],
    researchFormat: DOVE_RESEARCH_FORMAT,
    projectIntegration,
    comparison
  };
}

// src/mcp/server.mjs
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
  const allowed = new Set(Object.keys(toolDiscoveryInputSchema.properties ?? {}));
  const unknown = Object.keys(params).filter((key) => !allowed.has(key));
  if (unknown.length > 0) throw invalidParams(`tools/list does not accept unknown input: ${unknown.map((key) => `$.${key}`).join(", ")}.`);
  return params;
}
function startServer(root = process2.cwd()) {
  let buffer = Buffer.alloc(0);
  let responseFraming = "content-length";
  let clientProtocolVersion = null;
  let initialized = false;
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
  function sendResponse(id2, result) {
    sendMessage({ jsonrpc: "2.0", id: id2, result });
  }
  function sendError(id2, code, message) {
    sendMessage({ jsonrpc: "2.0", id: id2, error: { code, message } });
  }
  function publicSafeToolFailure() {
    const message = "Dove \u5DE5\u5177\u672A\u80FD\u5B89\u5168\u8FD4\u56DE\u7ED3\u679C\uFF1B\u6CA1\u6709\u8BB0\u5F55\u4EFB\u4F55\u7814\u7A76\u5224\u65AD\u6216\u8BC4\u5BA1\u6743\u5A01\u3002";
    return {
      content: [{ type: "text", text: message }],
      structuredContent: { status: "error", operation: "unknown", research: { message } },
      isError: true
    };
  }
  async function handleMessage(message) {
    const { id: id2, method, params } = message ?? {};
    if (method === "notifications/initialized") {
      if (clientProtocolVersion === null) return;
      initialized = true;
      return;
    }
    if (method === "initialize") {
      if (clientProtocolVersion !== null) throw protocolError(-32600, "MCP server is already initialized.");
      clientProtocolVersion = params?.protocolVersion ?? null;
      sendResponse(id2, {
        protocolVersion: negotiateDoveMcpProtocol(clientProtocolVersion),
        capabilities: { tools: {} },
        serverInfo: { name: "dove", version: inspectRunningMcpRuntime(root, negotiateDoveMcpProtocol(clientProtocolVersion)).serverInfo.version }
      });
      return;
    }
    if (method === "ping") {
      sendResponse(id2, {});
      return;
    }
    if (method === "tools/list" || method === "tools/call") {
      if (!initialized) throw notInitialized();
    }
    if (method === "tools/list") {
      normalizeToolDiscoveryParams(params);
      sendResponse(id2, { tools: toolDefinitions });
      return;
    }
    if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};
      sendResponse(id2, await dispatchTool(root, toolName, toolArgs, {
        negotiatedProtocolVersion: negotiateDoveMcpProtocol(clientProtocolVersion)
      }));
      return;
    }
    if (id2 !== void 0) sendError(id2, -32601, `Method not found: ${method}`);
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
    process2.exit(0);
  });
}

// mcp/dove-state-server.mjs
startServer(process.env.CLAUDE_PROJECT_DIR || process.cwd());
